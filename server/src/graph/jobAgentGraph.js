import { StateGraph, StateSchema, START, END } from '@langchain/langgraph';
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

/**
 * Assembles nodes 1-6 (section 4) into a LangGraph StateGraph with a
 * MongoDB-backed checkpointer. The 'low' branch of node 4's conditional edge
 * still routes to END — node 10 (human approval, for role_mismatch) doesn't
 * exist yet. The 'plausible' branch continues to node 5/6; redirecting 'low'
 * later only requires changing the path map below, not the router function.
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
    .addEdge(START, 'extractJdKeywords')
    .addEdge('extractJdKeywords', 'normalizeSkills')
    .addEdge('normalizeSkills', 'gapAnalysis')
    .addEdge('gapAnalysis', 'roleFitGate')
    .addConditionalEdges('roleFitGate', (state) => state.roleFit.fit, { low: END, plausible: 'tailorContent' })
    .addEdge('tailorContent', 'deterministicVerification')
    .addEdge('deterministicVerification', END);

  const graph = builder.compile({ checkpointer });

  return { graph, client };
}
