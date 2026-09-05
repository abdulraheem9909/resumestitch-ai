import { randomUUID } from 'node:crypto';
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
import { suggestResumeTitle } from '../services/suggestResumeTitle.js';
import { rephraseIntensity } from '../services/rephraseIntensity.js';
import { verifyBullet, verifySummary, trustHumanEdit, extractClaimedSkills } from '../services/deterministicVerification.js';
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
  rejected: z.boolean().default(() => false),
  // Who last set `rejected` — independent of editSource, which is only about
  // the bullet's text. 'human' means a manual include/exclude toggle on the
  // Approval page, and it must survive a retry even when node 5's own
  // guarantees would otherwise override it.
  rejectionSource: z.enum(['ai', 'human']).default(() => 'ai'),
});

const tailoredSummarySchema = z.object({
  generatedText: z.string(),
  humanEditedText: z.string().nullable(),
  finalText: z.string(),
  editSource: z.enum(['ai', 'human']),
});

const tailoredTitleSchema = z.object({
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

// Display-only, frozen-at-creation snapshots of the master resume's
// non-tailored sections — never touched by scoring/gap-analysis/tailoring
// (which is why these mirror MasterResume.js's own entry shapes exactly,
// rather than reusing resumeBulletSchema-style fields). Deliberately
// `.optional()` with no default array below, so a checkpoint from before
// this existed reads back as `undefined` rather than `[]` — every read site
// depends on telling "never captured" apart from "captured, genuinely
// empty" to fall back to a live MongoDB read for pre-existing applications.
const projectEntrySchema = z.object({
  name: z.string().default(() => ''),
  description: z.string().default(() => ''),
  canonicalSkills: z.array(z.string()).default(() => []),
});
const educationEntrySchema = z.object({
  degree: z.string().default(() => ''),
  institution: z.string().default(() => ''),
  location: z.string().default(() => ''),
  dateRange: z.string().default(() => ''),
});
const certificationEntrySchema = z.object({
  name: z.string().default(() => ''),
  issuer: z.string().default(() => ''),
  date: z.string().default(() => ''),
});
const volunteerEntrySchema = z.object({
  role: z.string().default(() => ''),
  organization: z.string().default(() => ''),
  dateRange: z.string().default(() => ''),
  description: z.string().default(() => ''),
});

const JobAgentState = new StateSchema({
  applicationId: z.string(),
  masterResumeId: z.string().optional(),
  companyName: z.string().optional(),
  jdText: z.string(),
  // The JD posting's own title (application.jobTitle) — distinct from
  // resumeTitle below, which is the master resume's own tagline.
  jdTitle: z.string().optional(),
  resumeSummary: z.string().optional(),
  resumeTitle: z.string().optional(),
  resumeCanonicalSkills: z.array(z.string()).default(() => []),
  resumeBullets: z.array(resumeBulletSchema).default(() => []),
  // Skills extracted from the master resume's Projects section the same way a
  // bullet's skills are (read-only, never rephrased). Set once at creation and
  // never touched again — projects don't change mid-flow the way resumeBullets
  // can (suggest-missing-skills), so no retry path needs to resupply this.
  // Folded into resumeCanonicalSkills by gapAnalysisNode, but a project entry
  // itself is never added to the resumeBullets tailoring pool.
  projectCanonicalSkills: z.array(z.string()).default(() => []),
  // Full project/education/certification/volunteer-work entries, frozen at
  // creation the same way resumeBullets is — unlike projectCanonicalSkills
  // above (which only ever fed scoring), these exist purely so the Approval
  // page and every export of THIS application keep showing the resume
  // exactly as it was when this application was created, even after the
  // master resume is later edited. See key-decisions-log.md.
  resumeProjects: z.array(projectEntrySchema).optional(),
  resumeEducation: z.array(educationEntrySchema).optional(),
  resumeCertifications: z.array(certificationEntrySchema).optional(),
  resumeVolunteerWork: z.array(volunteerEntrySchema).optional(),
  // Transient: set only when a retry is adding a bullet meant to plug a specific
  // JD skill gap, so tailorContent can guarantee its inclusion. Reset to null on
  // every retry unless explicitly re-supplied (section 4a).
  requiredBulletId: z.string().nullable().optional().default(() => null),
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
  tailoredTitle: tailoredTitleSchema.optional(),
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
  humanDecision: z.enum(['end', 'retry', 'override']).optional(),
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
  const jdKeywords = await extractJdKeywords({
    jdText: state.jdText,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
  });
  return { jdKeywords };
}

// Node 2 (section 4)
function normalizeSkillsNode(state) {
  const jdCanonicalSkills = normalizeSkills([...state.jdKeywords.skills, ...state.jdKeywords.tools]);
  return { jdCanonicalSkills };
}

// Node 3 (section 4)
// Recomputes resumeCanonicalSkills from the current resumeBullets on every run
// (not just the first pass) so a bullet added mid-flow (e.g. via the
// suggest-missing-skills flow) is reflected in keywordGaps after a retry.
export function gapAnalysisNode(state) {
  const resumeCanonicalSkills = [
    ...new Set([
      ...(state.resumeBullets || []).flatMap((bullet) => bullet.canonicalSkills || []),
      ...(state.projectCanonicalSkills || []),
    ]),
  ];
  const keywordGaps = gapAnalysis(state.jdCanonicalSkills, resumeCanonicalSkills);
  return { resumeCanonicalSkills, keywordGaps };
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

// Preserves a bullet the human already hand-edited AND/OR manually
// included/excluded across a retry, instead of letting tailorContent's fresh
// regeneration silently overwrite either decision. Carrying the whole previous
// entry forward (rather than just its `rejected` flag) also means the human's
// include/exclude choice keeps whatever text it already had, exactly like a
// text edit would.
export function mergeHumanEditedBullets(freshBullets, previousBullets) {
  const editedBySource = new Map(
    (previousBullets || [])
      .filter((bullet) => bullet.editSource === 'human' || bullet.rejectionSource === 'human')
      .map((bullet) => [bullet.sourceBulletId, { ...bullet }])
  );
  return freshBullets.map((bullet) => editedBySource.get(bullet.sourceBulletId) || bullet);
}

function verbatimTailoredBullet(sourceBullet) {
  return {
    bulletId: randomUUID(),
    sourceBulletId: sourceBullet.bulletId,
    generatedText: sourceBullet.text,
    humanEditedText: null,
    finalText: sourceBullet.text,
    editSource: 'ai',
    rephraseIntensity: rephraseIntensity(sourceBullet.text, sourceBullet.text),
    rejected: false,
  };
}

// Guarantees a bullet added specifically to plug a JD skill gap actually ends up
// in the tailored resume, rather than depending on the model's discretion. The
// candidate pool now always contains an entry for every source bullet, so this
// also has to un-reject one the model marked out of context, not just append a
// missing one. A human's own manual exclude always wins, though — if you
// deliberately took this exact bullet back out, that decision is left alone
// even though it's the one this retry was meant to guarantee.
export function ensureRequiredBulletIncluded(bullets, requiredBulletId, resumeBulletsById) {
  if (!requiredBulletId) {
    return bullets;
  }
  const index = bullets.findIndex((bullet) => bullet.sourceBulletId === requiredBulletId);
  const sourceBullet = resumeBulletsById.get(requiredBulletId);
  if (index === -1) {
    return sourceBullet ? [...bullets, verbatimTailoredBullet(sourceBullet)] : bullets;
  }
  if (!bullets[index].rejected || bullets[index].rejectionSource === 'human') {
    return bullets;
  }
  const forced = verbatimTailoredBullet(sourceBullet || { bulletId: requiredBulletId, text: bullets[index].finalText });
  const updated = [...bullets];
  updated[index] = forced;
  return updated;
}

// Guarantees every real employer (one with a `company` on its source bullets)
// keeps at least one non-rejected bullet on the tailored resume, so an
// out-of-context classification can never silently erase an entire job from the
// work history. "Represented" now means "has a kept bullet" — if an employer's
// bullets are all currently rejected, the best-overlap one is un-rejected in
// place rather than appended as a duplicate. A human's own manual exclude
// always wins, though: a bullet the human deliberately took out is never
// eligible to be picked back up as that employer's fallback — if every one of
// an employer's bullets was manually excluded, that employer just goes
// unrepresented rather than having an exclude silently reversed.
export function ensureEveryEmployerRepresented(bullets, resumeBullets, jdCanonicalSkills) {
  const humanExcluded = new Set(
    bullets.filter((bullet) => bullet.rejected && bullet.rejectionSource === 'human').map((bullet) => bullet.sourceBulletId)
  );
  const representedCompanies = new Set(
    bullets
      .filter((bullet) => !bullet.rejected)
      .map((bullet) => resumeBullets.find((rb) => rb.bulletId === bullet.sourceBulletId)?.company)
      .filter(Boolean)
  );
  const jdSkillSet = new Set(jdCanonicalSkills || []);
  const bestByCompany = new Map();
  for (const resumeBullet of resumeBullets) {
    if (!resumeBullet.company || representedCompanies.has(resumeBullet.company) || humanExcluded.has(resumeBullet.bulletId)) {
      continue;
    }
    const overlap = (resumeBullet.canonicalSkills || []).filter((skill) => jdSkillSet.has(skill)).length;
    const best = bestByCompany.get(resumeBullet.company);
    if (!best || overlap > best.overlap) {
      bestByCompany.set(resumeBullet.company, { bullet: resumeBullet, overlap });
    }
  }
  let result = bullets;
  for (const { bullet: resumeBullet } of bestByCompany.values()) {
    const index = result.findIndex((bullet) => bullet.sourceBulletId === resumeBullet.bulletId);
    const forced = verbatimTailoredBullet(resumeBullet);
    result = index === -1 ? [...result, forced] : result.map((bullet, i) => (i === index ? forced : bullet));
  }
  return result;
}

// Rephrasing is only constrained to never ADD a skill/tool/employer/metric
// absent from the source bullet — nothing stops it from DROPPING one that
// was already there. That's harmless most of the time, but not when the
// dropped word is a skill this JD actually asked for and the resume actually
// has: literal keyword matching (this app's own gap analysis, and some real
// ATS software) can't credit "MERN stack" for "Express.js" the way a human
// reader would. For every kept, non-human-edited bullet, if its source text
// literally claims a skill that's also in `matchedSkills` but the tailored
// text no longer does, revert that bullet to its verbatim source text —
// same safe fallback the two guarantees above already use, rather than
// trying to surgically patch one word back into an arbitrary sentence.
// Scoped to matchedSkills only: a dropped word irrelevant to this JD isn't
// worth losing an otherwise-good rephrase over.
export function preserveMatchedSkillWording(bullets, resumeBulletsById, matchedSkills) {
  const matchedSet = new Set(matchedSkills || []);
  if (matchedSet.size === 0) return bullets;

  return bullets.map((bullet) => {
    if (bullet.rejected || bullet.editSource === 'human') return bullet;
    const sourceBullet = resumeBulletsById.get(bullet.sourceBulletId);
    if (!sourceBullet) return bullet;

    const sourceSkills = extractClaimedSkills(sourceBullet.text);
    const tailoredSkills = extractClaimedSkills(bullet.finalText);
    const droppedMatchedSkill = [...sourceSkills].some(
      (skill) => matchedSet.has(skill) && !tailoredSkills.has(skill)
    );
    if (!droppedMatchedSkill) return bullet;

    return verbatimTailoredBullet(sourceBullet);
  });
}

// Preserves a hand-edited title across a retry, the same shape as the
// tailoredSummary preservation check inline in tailorContentNode — pulled out
// as its own function purely so it's directly unit-testable, mirroring
// mergeHumanEditedBullets above.
export function mergeHumanEditedTitle(freshTitle, previousTitle) {
  return previousTitle?.editSource === 'human' ? previousTitle : freshTitle;
}

// Node 5 (section 4)
async function tailorContentNode(state) {
  if (!state.resumeBullets?.length) {
    throw new Error('tailorContent requires at least one resume bullet.');
  }

  const matched = matchedSkills(state.jdCanonicalSkills, state.resumeCanonicalSkills);
  const yearsOfExperience = calculateYearsOfExperience(state.resumeBullets);

  // Deterministic, not an LLM output — see suggestResumeTitle.js. Computed
  // fresh every pass (like yearsOfExperience) but a human edit still wins,
  // same preservation pattern as tailoredSummary below. Computed before the
  // tailorContent() call (rather than after, as originally written) so the
  // summary can open with this exact title instead of the model guessing
  // its own role phrase from the bullets — see key-decisions-log.md.
  const suggestedTitle = suggestResumeTitle(state.jdTitle, state.resumeTitle);
  const freshTitle = { generatedText: suggestedTitle, humanEditedText: null, finalText: suggestedTitle, editSource: 'ai' };
  const tailoredTitle = mergeHumanEditedTitle(freshTitle, state.tailoredTitle);

  const generated = await tailorContent({
    jdText: state.jdText,
    resumeBullets: state.resumeBullets,
    matchedSkills: matched,
    yearsOfExperience,
    title: tailoredTitle.finalText,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
    retryNotes: state.retryNotes,
  });
  const { generationId } = generated;

  const resumeBulletsById = new Map(state.resumeBullets.map((bullet) => [bullet.bulletId, bullet]));

  let tailoredBullets = mergeHumanEditedBullets(generated.tailoredBullets, state.tailoredBullets);
  tailoredBullets = ensureRequiredBulletIncluded(tailoredBullets, state.requiredBulletId, resumeBulletsById);
  tailoredBullets = ensureEveryEmployerRepresented(tailoredBullets, state.resumeBullets, state.jdCanonicalSkills);
  tailoredBullets = preserveMatchedSkillWording(tailoredBullets, resumeBulletsById, matched);

  const tailoredSummary =
    state.tailoredSummary?.editSource === 'human' ? state.tailoredSummary : generated.tailoredSummary;

  return { matchedSkills: matched, yearsOfExperience, tailoredBullets, tailoredSummary, tailoredTitle, generationId };
}

// Node 6 (section 4)
function deterministicVerificationNode(state) {
  const bulletsById = new Map(state.resumeBullets.map((bullet) => [bullet.bulletId, bullet]));

  const bullets = state.tailoredBullets.map((tailoredBullet) => ({
    bulletId: tailoredBullet.bulletId,
    ...(tailoredBullet.editSource === 'human'
      ? trustHumanEdit(tailoredBullet.finalText)
      : verifyBullet({
          generatedText: tailoredBullet.finalText,
          sourceBullet: bulletsById.get(tailoredBullet.sourceBulletId),
        })),
  }));

  const selectedBullets = state.tailoredBullets
    .filter((tailoredBullet) => !tailoredBullet.rejected)
    .map((tailoredBullet) => bulletsById.get(tailoredBullet.sourceBulletId));
  const summary =
    state.tailoredSummary.editSource === 'human'
      ? trustHumanEdit(state.tailoredSummary.finalText)
      : verifySummary({
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
    tailoredBullets: state.tailoredBullets.filter((bullet) => !bullet.rejected),
    tailoredSummary: state.tailoredSummary,
    matchedSkills: state.matchedSkills,
    keywordGaps: state.keywordGaps,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
    retryNotes: state.retryNotes,
  });
  return { coverLetterText };
}

// Node 8 (section 4): mostly rule-based, no LLM in the common case. Its return
// value replaces state.tailoredBullets wholesale (unlike the cover-letter/ATS
// nodes, which only return their own fields) — so it must always be handed
// and must always hand back every bullet, rejected included, or a rejected
// bullet silently disappears from the application instead of staying tagged.
// Rejected and human-edited bullets both come back verbatim; only the rest
// get relinted (see styleLinting.js for the guard).
async function styleLintingNode(state) {
  return styleLinting({
    tailoredBullets: state.tailoredBullets,
    tailoredSummary: state.tailoredSummary,
    coverLetterText: state.coverLetterText,
  });
}

// Node 9 (section 4/5): single structured call; also decides the retry edge.
async function atsScoreAndRecruiterNode(state) {
  const activeTailoredBullets = state.tailoredBullets.filter((bullet) => !bullet.rejected);
  const { atsScore, atsFlags, recruiterFeedback } = await atsScoreAndRecruiter({
    jdText: state.jdText,
    tailoredBullets: activeTailoredBullets,
    tailoredSummary: state.tailoredSummary,
    resumeTitle: state.tailoredTitle?.finalText || state.resumeTitle,
    coverLetterText: state.coverLetterText,
    keywordGaps: state.keywordGaps,
    verificationResult: state.verificationResult,
    applicationId: state.applicationId,
    resumeVersion: state.masterResumeId,
  });

  const retryCount = state.retryCount ?? 0;
  const willRetry = shouldRetryAutomatically(atsFlags, retryCount, activeTailoredBullets);

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
          tailoredTitle: state.tailoredTitle,
          verificationResult: state.verificationResult,
          keywordGaps: state.keywordGaps,
        }
  );

  if (isRoleMismatch) {
    // 'override' — the human disagrees with node 4's gate and wants to
    // proceed anyway. Everything tailorContent needs (jdCanonicalSkills,
    // resumeCanonicalSkills, resumeBullets) was already computed by nodes
    // 1-3 before the gate ever ran, so this can go straight to tailorContent
    // rather than re-running the gate (which would very likely reproduce
    // the same verdict on the same inputs).
    return { humanDecision: resumeValue?.action === 'override' ? 'override' : 'end' };
  }

  if (resumeValue.action === 'approve') {
    return {
      tailoredBullets: resumeValue.tailoredBullets ?? state.tailoredBullets,
      tailoredSummary: resumeValue.tailoredSummary ?? state.tailoredSummary,
      tailoredTitle: resumeValue.tailoredTitle ?? state.tailoredTitle,
      humanDecision: 'end',
    };
  }

  // resumeValue.action === 'retry' — manual "send back with notes" or an
  // accepted suggest-missing-skills addition, both routed through the same
  // pathway per section 4a. tailoredSummary is re-synced from Mongo here the
  // same way tailoredBullets already is, so a hand-edited summary
  // (editSource: 'human') is actually visible to tailorContentNode's own
  // preservation check on the next pass — without this, that check always
  // saw stale pre-edit state and could never fire (see key-decisions-log.md).
  return {
    tailoredBullets: resumeValue.tailoredBullets ?? state.tailoredBullets,
    tailoredSummary: resumeValue.tailoredSummary ?? state.tailoredSummary,
    tailoredTitle: resumeValue.tailoredTitle ?? state.tailoredTitle,
    resumeBullets: resumeValue.resumeBullets ?? state.resumeBullets,
    retryNotes: resumeValue.notes ?? '',
    requiredBulletId: resumeValue.requiredBulletId ?? null,
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
    .addConditionalEdges('gapAnalysis', (state) => ((state.retryCount ?? 0) > 0 ? 'retry' : 'first'), {
      first: 'roleFitGate',
      retry: 'tailorContent',
    })
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
      retry: 'gapAnalysis',
      end: 'humanApproval',
    })
    .addConditionalEdges('humanApproval', (state) => state.humanDecision, {
      end: END,
      retry: 'gapAnalysis',
      override: 'tailorContent',
    });

  const graph = builder.compile({ checkpointer });

  return { graph, client, checkpointer };
}
