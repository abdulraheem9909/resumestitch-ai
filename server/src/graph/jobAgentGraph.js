import { StateGraph, StateSchema, START, END, interrupt } from '@langchain/langgraph';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { extractJdKeywords } from '../services/extractJdKeywords.js';
import { normalizeSkills } from '../services/normalizeSkills.js';
import { gapAnalysis } from '../services/gapAnalysis.js';
import { roleFitGate } from '../services/roleFitGate.js';
import { matchedSkills } from '../services/matchedSkills.js';
import { calculateYearsOfExperience } from '../services/calculateYearsOfExperience.js';
import { tailorContent } from '../services/tailorContent.js';
import { verifyBullet, verifySummary } from '../services/deterministicVerification.js';
import { generateCoverLetter } from '../services/generateCoverLetter.js';
import { styleLinting } from '../services/styleLinting.js';
import { atsScoreAndRecruiter, shouldRetryAutomatically, buildAutoRetryNotes } from '../services/atsScoreAndRecruiter.js';

const resumeBulletSchema = z.object({
  bulletId: z.string(),
  text: z.string(),
  role: z.string().optional(),
  company: z.string().optional(),
  dateRange: z.string().optional(),
  canonicalSkills: z.array(z.string()).default(() => []),
});

const tailoredBulletSchema = z.object({
  bulletId: z.string(),
  sourceBulletId: z.string(),
  generatedText: z.string(),
  humanEditedText: z.string().nullable(),
  finalText: z.string(),
  editSource: z.enum(['ai', 'human']),
  rephraseIntensity: z.number(),
});

const tailoredSummarySchema = z.object({
  generatedText: z.string(),
  humanEditedText: z.string().nullable(),
  finalText: z.string(),
  editSource: z.enum(['ai', 'human']),
});

const verificationEntrySchema = z.object({
  passed: z.boolean(),
  fabricatedSkills: z.array(z.string()),
  fabricatedMetrics: z.array(z.string()),
  claimedSkills: z.array(z.string()),
});

const JobAgentState = new StateSchema({
  applicationId: z.string(),
  masterResumeId: z.string().optional(),
  companyName: z.string().optional(),
  jdText: z.string(),
  resumeSummary: z.string().optional(),
  resumeTitle: z.string().optional(),
  resumeCanonicalSkills: z.array(z.string()).default(() => []),
  resumeBullets: z.array(resumeBulletSchema).default(() => []),
  jdKeywords: z
    .object({
      skills: z.array(z.string()),
      tools: z.array(z.string()),
      seniority: z.string(),
    })
    .optional(),
  jdCanonicalSkills: z.array(z.string()).optional(),
  keywordGaps: z.array(z.string()).optional(),
  roleFit: z
    .object({
      fit: z.enum(['plausible', 'low']),
      reason: z.string(),
    })
    .optional(),
  matchedSkills: z.array(z.string()).optional(),
  yearsOfExperience: z.number().optional(),
  tailoredBullets: z.array(tailoredBulletSchema).optional(),
  tailoredSummary: tailoredSummarySchema.optional(),
  generationId: z.string().optional(),
  verificationResult: z
    .object({
      bullets: z.array(verificationEntrySchema.extend({ bulletId: z.string() })),
      summary: verificationEntrySchema,
      overallPassed: z.boolean(),
    })
    .optional(),
  retryNotes: z
    .string()
    .optional()
    .default(() => ''),
  humanDecision: z.enum(['end', 'retry']).optional(),
  coverLetterRequested: z.boolean().optional().default(() => false),
  coverLetterText: z.string().optional(),
  atsScore: z.number().optional(),
  atsFlags: z
    .array(z.enum(['missingRequirement', 'unsupportedClaim', 'excessiveRewrite', 'poorReadability']))
    .optional()
    .default(() => []),
  recruiterFeedback: z.string().optional(),
  retryCount: z.number().optional().default(() => 0),
  retryDecision: z.enum(['retry', 'end']).optional(),
});

// Node 1 (section 4)
async function extractJdKeywordsNode(state) {
  const jdKeywords = await extractJdKeywords(state.jdText);
  return { jdKeywords };
}

// Node 2 (section 4)
function normalizeSkillsNode(state) {
  const jdCanonicalSkills = normalizeSkills([...state.jdKeywords.skills, ...state.jdKeywords.tools]);
  return { jdCanonicalSkills };
}

// Node 3 (section 4)
function gapAnalysisNode(state) {
  const keywordGaps = gapAnalysis(state.jdCanonicalSkills, state.resumeCanonicalSkills);
  return { keywordGaps };
}

// Node 4 (section 5a)
async function roleFitGateNode(state) {
  const roleFit = await roleFitGate({
    jdText: state.jdText,
    jdCanonicalSkills: state.jdCanonicalSkills,
    resumeCanonicalSkills: state.resumeCanonicalSkills,
    resumeSummary: state.resumeSummary,
    resumeTitle: state.resumeTitle,
  });
  return { roleFit };
}

// Node 5 (section 4)
async function tailorContentNode(state) {
  if (!state.resumeBullets?.length) {
    throw new Error('tailorContent requires at least one resume bullet.');
  }

  const matched = matchedSkills(state.jdCanonicalSkills, state.resumeCanonicalSkills);
  const yearsOfExperience = calculateYearsOfExperience(state.resumeBullets);

  const { tailoredBullets, tailoredSummary, generationId } = await tailorContent({
    jdText: state.jdText,
    resumeBullets: state.resumeBullets,
    matchedSkills: matched,
    yearsOfExperience,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
    retryNotes: state.retryNotes,
  });

  return { matchedSkills: matched, yearsOfExperience, tailoredBullets, tailoredSummary, generationId };
}

// Node 6 (section 4)
function deterministicVerificationNode(state) {
  const bulletsById = new Map(state.resumeBullets.map((bullet) => [bullet.bulletId, bullet]));

  const bullets = state.tailoredBullets.map((tailoredBullet) => ({
    bulletId: tailoredBullet.bulletId,
    ...verifyBullet({
      generatedText: tailoredBullet.finalText,
      sourceBullet: bulletsById.get(tailoredBullet.sourceBulletId),
    }),
  }));

  const selectedBullets = state.tailoredBullets.map((tailoredBullet) => bulletsById.get(tailoredBullet.sourceBulletId));
  const summary = verifySummary({
    generatedText: state.tailoredSummary.finalText,
    matchedSkills: state.matchedSkills,
    selectedBullets,
    yearsOfExperience: state.yearsOfExperience,
  });

  const overallPassed = bullets.every((bullet) => bullet.passed) && summary.passed;

  return { verificationResult: { bullets, summary, overallPassed } };
}

// Node 7 (section 4): conditional — only reached when coverLetterRequested.
async function coverLetterGenerationNode(state) {
  const coverLetterText = await generateCoverLetter({
    jdText: state.jdText,
    companyName: state.companyName,
    resumeTitle: state.resumeTitle,
    tailoredBullets: state.tailoredBullets,
    tailoredSummary: state.tailoredSummary,
    matchedSkills: state.matchedSkills,
    keywordGaps: state.keywordGaps,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
    retryNotes: state.retryNotes,
  });
  return { coverLetterText };
}

// Node 8 (section 4): mostly rule-based, no LLM in the common case.
async function styleLintingNode(state) {
  return styleLinting({
    tailoredBullets: state.tailoredBullets,
    tailoredSummary: state.tailoredSummary,
    coverLetterText: state.coverLetterText,
  });
}

// Node 9 (section 4/5): single structured call; also decides the retry edge.
async function atsScoreAndRecruiterNode(state) {
  const { atsScore, atsFlags, recruiterFeedback } = await atsScoreAndRecruiter({
    jdText: state.jdText,
    tailoredBullets: state.tailoredBullets,
    tailoredSummary: state.tailoredSummary,
    coverLetterText: state.coverLetterText,
    keywordGaps: state.keywordGaps,
    verificationResult: state.verificationResult,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
  });

  const retryCount = state.retryCount ?? 0;
  const willRetry = shouldRetryAutomatically(atsFlags, retryCount, state.tailoredBullets);

  return {
    atsScore,
    atsFlags,
    recruiterFeedback,
    retryDecision: willRetry ? 'retry' : 'end',
    retryCount: willRetry ? retryCount + 1 : retryCount,
    retryNotes: willRetry ? buildAutoRetryNotes(atsFlags, recruiterFeedback) : state.retryNotes,
  };
}

// Node 10 (section 4 / 4a): pauses the graph via interrupt() and shows React
// the tailored diff (or, for a role-mismatch run, the reason instead — same
// node, per the doc's "or, if routed here from node 4" line). Only "approve"
// and "retry" ever resume this node — hand-editing and re-check are
// non-blocking and handled entirely at the Express layer without touching
// the graph, so this function's only I/O is the interrupt() call itself.
// Everything after interrupt() runs exactly once, on the resume that
// actually supplies a value.
function humanApprovalNode(state) {
  const isRoleMismatch = state.roleFit?.fit === 'low';

  const resumeValue = interrupt(
    isRoleMismatch
      ? { kind: 'role_mismatch', roleFit: state.roleFit }
      : {
          kind: 'review',
          tailoredBullets: state.tailoredBullets,
          tailoredSummary: state.tailoredSummary,
          verificationResult: state.verificationResult,
          keywordGaps: state.keywordGaps,
        }
  );

  if (isRoleMismatch) {
    return { humanDecision: 'end' };
  }

  if (resumeValue.action === 'approve') {
    return {
      tailoredBullets: resumeValue.tailoredBullets ?? state.tailoredBullets,
      tailoredSummary: resumeValue.tailoredSummary ?? state.tailoredSummary,
      humanDecision: 'end',
    };
  }

  // resumeValue.action === 'retry' — manual "send back with notes" or an
  // accepted suggest-missing-skills addition, both routed through the same
  // pathway per section 4a.
  return {
    tailoredBullets: resumeValue.tailoredBullets ?? state.tailoredBullets,
    resumeBullets: resumeValue.resumeBullets ?? state.resumeBullets,
    retryNotes: resumeValue.notes ?? '',
    retryCount: (state.retryCount ?? 0) + 1,
    humanDecision: 'retry',
  };
}

/**
 * Assembles nodes 1-10 (sections 4/4a/5) into a LangGraph StateGraph with a
 * MongoDB-backed checkpointer. The role-mismatch ('low') path skips straight
 * to node 10, bypassing nodes 5-9 entirely (section 5a). The normal
 * ('plausible') path runs tailorContent -> deterministicVerification ->
 * (coverLetterGeneration, conditional) -> styleLinting -> atsScoreAndRecruiter,
 * whose retry edge loops back to tailorContent on a retryable flag (capped at
 * 3 automatic retries) or proceeds to node 10. Nothing reaches END without a
 * human resuming node 10 with action: 'approve'.
 */
export function createJobAgentGraph(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);
  const checkpointer = new MongoDBSaver(dbName ? { client, dbName } : { client });

  const builder = new StateGraph(JobAgentState)
    .addNode('extractJdKeywords', extractJdKeywordsNode)
    .addNode('normalizeSkills', normalizeSkillsNode)
    .addNode('gapAnalysis', gapAnalysisNode)
    .addNode('roleFitGate', roleFitGateNode)
    .addNode('tailorContent', tailorContentNode)
    .addNode('deterministicVerification', deterministicVerificationNode)
    .addNode('coverLetterGeneration', coverLetterGenerationNode)
    .addNode('styleLinting', styleLintingNode)
    .addNode('atsScoreAndRecruiter', atsScoreAndRecruiterNode)
    .addNode('humanApproval', humanApprovalNode)
    .addEdge(START, 'extractJdKeywords')
    .addEdge('extractJdKeywords', 'normalizeSkills')
    .addEdge('normalizeSkills', 'gapAnalysis')
    .addEdge('gapAnalysis', 'roleFitGate')
    .addConditionalEdges('roleFitGate', (state) => state.roleFit.fit, {
      low: 'humanApproval',
      plausible: 'tailorContent',
    })
    .addEdge('tailorContent', 'deterministicVerification')
    .addConditionalEdges('deterministicVerification', (state) => (state.coverLetterRequested ? 'coverLetterGeneration' : 'styleLinting'), {
      coverLetterGeneration: 'coverLetterGeneration',
      styleLinting: 'styleLinting',
    })
    .addEdge('coverLetterGeneration', 'styleLinting')
    .addEdge('styleLinting', 'atsScoreAndRecruiter')
    .addConditionalEdges('atsScoreAndRecruiter', (state) => state.retryDecision, {
      retry: 'tailorContent',
      end: 'humanApproval',
    })
    .addConditionalEdges('humanApproval', (state) => state.humanDecision, {
      end: END,
      retry: 'tailorContent',
    });

  const graph = builder.compile({ checkpointer });

  return { graph, client };
}
