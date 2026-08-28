import { Router } from 'express';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import Application from '../models/Application.js';
import MasterResume from '../models/MasterResume.js';
import ResumeBullet from '../models/ResumeBullet.js';
import { normalizeSkills } from '../services/normalizeSkills.js';
import { canonicalizeSkill } from '../services/canonicalizeSkill.js';
import { tagBullet } from '../services/tagBullet.js';
import { verifyBullet, verifySummary } from '../services/deterministicVerification.js';
import { atsScoreAndRecruiter } from '../services/atsScoreAndRecruiter.js';
import { getJobAgentGraph } from '../graph/graphInstance.js';

const router = Router();

function buildResumeBulletsForGraph(bullets) {
  return bullets.map((bullet) => ({
    bulletId: bullet._id.toString(),
    text: bullet.text,
    role: bullet.role,
    company: bullet.company,
    dateRange: bullet.dateRange,
    canonicalSkills: bullet.canonicalSkills,
  }));
}

// Resumes the one interrupt() in node 10 with a Command, then reads back the
// resulting checkpoint — the only place this route file touches the graph.
async function resumeGraph(applicationId, resumePayload) {
  const graph = getJobAgentGraph();
  await graph.invoke(new Command({ resume: resumePayload }), { configurable: { thread_id: applicationId } });
  return graph.getState({ configurable: { thread_id: applicationId } });
}

// Section 3 — create + start.
router.post('/', async (req, res) => {
  const { masterResumeId, jdText, companyName, referenceUrl, coverLetterRequested } = req.body;

  if (!mongoose.isValidObjectId(masterResumeId)) {
    return res.status(400).json({ error: 'Invalid masterResumeId.' });
  }
  if (typeof jdText !== 'string' || !jdText.trim()) {
    return res.status(400).json({ error: 'jdText is required.' });
  }
  if (typeof companyName !== 'string' || !companyName.trim()) {
    return res.status(400).json({ error: 'companyName is required.' });
  }

  try {
    const normalizedJdText = jdText.trim().replace(/\s+/g, ' ');
    const jdTextHash = createHash('sha256').update(normalizedJdText).digest('hex');

    const existing = await Application.findOne({ masterResumeId, jdTextHash });
    if (existing) {
      return res.json({ application: existing, deduped: true });
    }

    const resume = await MasterResume.findOne({ _id: masterResumeId, status: 'active' });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found.' });
    }

    const bullets = await ResumeBullet.find({ masterResumeId });
    if (bullets.length === 0) {
      return res.status(400).json({ error: 'Selected resume has no bullets.' });
    }

    const resumeCanonicalSkills = normalizeSkills(bullets.flatMap((bullet) => bullet.skills));
    const resumeBulletsForGraph = buildResumeBulletsForGraph(bullets);

    let application;
    try {
      application = await Application.create({
        masterResumeId,
        companyName: companyName.trim(),
        referenceUrl: (referenceUrl || '').trim(),
        jdSnapshot: jdText,
        jdTextHash,
        coverLetterRequested: Boolean(coverLetterRequested),
        status: 'in_progress',
      });
    } catch (err) {
      if (err.code === 11000) {
        const winner = await Application.findOne({ masterResumeId, jdTextHash });
        return res.json({ application: winner, deduped: true });
      }
      throw err;
    }

    const applicationId = application._id.toString();
    const graph = getJobAgentGraph();

    await graph.invoke(
      {
        applicationId,
        masterResumeId,
        companyName: companyName.trim(),
        jdText,
        resumeSummary: resume.summary,
        resumeTitle: resume.personalInfo?.title,
        resumeCanonicalSkills,
        resumeBullets: resumeBulletsForGraph,
        coverLetterRequested: Boolean(coverLetterRequested),
      },
      { configurable: { thread_id: applicationId } }
    );

    const snapshot = await graph.getState({ configurable: { thread_id: applicationId } });
    const state = snapshot.values;

    application.jdKeywords = state.jdKeywords;
    application.jdCanonicalSkills = state.jdCanonicalSkills;
    application.keywordGaps = state.keywordGaps;

    if (state.roleFit?.fit === 'low') {
      application.status = 'role_mismatch';
    } else {
      application.status = 'pending_approval';
      application.tailoredBullets = state.tailoredBullets;
      application.tailoredSummary = state.tailoredSummary;
      application.coverLetterText = state.coverLetterText;
      application.atsScore = state.atsScore;
      application.atsFlags = state.atsFlags;
      application.recruiterFeedback = state.recruiterFeedback;
      application.retryCount = state.retryCount ?? 0;
    }

    await application.save();

    return res.status(201).json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create and start application.' });
  }
});

// For the Approval page — merges the Mongo doc with data section 8 doesn't
// persist (the original bullets, the verification result, the role-mismatch
// reason), sourced live from the checkpointer instead of duplicating it.
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const graph = getJobAgentGraph();
    const snapshot = await graph.getState({ configurable: { thread_id: id } });
    const state = snapshot.values || {};

    return res.json({
      application,
      originalBullets: state.resumeBullets || [],
      originalSummary: state.resumeSummary || '',
      verificationResult: state.verificationResult || null,
      roleFitReason: application.status === 'role_mismatch' ? state.roleFit?.reason : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load application.' });
  }
});

// Hand-edit one tailored bullet — direct Mongo write, no graph interaction.
router.patch('/:id/bullets/:bulletId', async (req, res) => {
  const { id, bulletId } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const bullet = application.tailoredBullets.find((b) => b.bulletId === bulletId);
    if (!bullet) {
      return res.status(404).json({ error: 'Tailored bullet not found.' });
    }

    bullet.humanEditedText = text;
    bullet.finalText = text;
    bullet.editSource = 'human';
    await application.save();

    return res.json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update tailored bullet.' });
  }
});

// Hand-edit the tailored summary — direct Mongo write, no graph interaction.
router.patch('/:id/summary', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (!application.tailoredSummary) {
      return res.status(400).json({ error: 'This application has no tailored summary to edit.' });
    }

    application.tailoredSummary.humanEditedText = text;
    application.tailoredSummary.finalText = text;
    application.tailoredSummary.editSource = 'human';
    await application.save();

    return res.json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update tailored summary.' });
  }
});

// Section 4a — re-check. Non-blocking, informational, no graph resume: runs
// node 6 AND node 9 against the current (possibly hand-edited) content,
// populating humanRecheckAtsScore/Flags alongside (never overwriting)
// atsScore/atsFlags from the original AI pass.
router.post('/:id/recheck', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (application.status === 'role_mismatch') {
      return res.status(400).json({ error: 'No tailored content to re-check for a role-mismatch application.' });
    }

    const graph = getJobAgentGraph();
    const snapshot = await graph.getState({ configurable: { thread_id: id } });
    const { resumeBullets = [], matchedSkills = [], yearsOfExperience } = snapshot.values || {};
    const bulletsById = new Map(resumeBullets.map((bullet) => [bullet.bulletId, bullet]));

    const bulletResults = application.tailoredBullets.map((tailoredBullet) => {
      const sourceBullet = bulletsById.get(tailoredBullet.sourceBulletId);
      return { bulletId: tailoredBullet.bulletId, ...verifyBullet({ generatedText: tailoredBullet.finalText, sourceBullet }) };
    });
    const bulletFlags = bulletResults.flatMap((result) => [
      ...result.fabricatedSkills.map((skill) => `bullet ${result.bulletId}: fabricated skill "${skill}"`),
      ...result.fabricatedMetrics.map((metric) => `bullet ${result.bulletId}: fabricated metric "${metric}"`),
    ]);

    const selectedBullets = application.tailoredBullets.map((tailoredBullet) => bulletsById.get(tailoredBullet.sourceBulletId));
    const summaryResult = application.tailoredSummary
      ? verifySummary({
          generatedText: application.tailoredSummary.finalText,
          matchedSkills,
          selectedBullets,
          yearsOfExperience,
        })
      : { passed: true, fabricatedSkills: [], fabricatedMetrics: [], claimedSkills: [] };

    const summaryFlags = [
      ...summaryResult.fabricatedSkills.map((skill) => `summary: fabricated skill "${skill}"`),
      ...summaryResult.fabricatedMetrics.map((metric) => `summary: fabricated metric "${metric}"`),
    ];

    const overallPassed = bulletResults.every((result) => result.passed) && summaryResult.passed;

    const atsResult = await atsScoreAndRecruiter({
      jdText: application.jdSnapshot,
      tailoredBullets: application.tailoredBullets,
      tailoredSummary: application.tailoredSummary,
      coverLetterText: application.coverLetterText,
      keywordGaps: application.keywordGaps,
      verificationResult: { bullets: bulletResults, summary: summaryResult, overallPassed },
      applicationId: id,
      resumeVersion: application.masterResumeId,
    });

    application.humanRecheckAtsScore = atsResult.atsScore;
    application.humanRecheckAtsFlags = [...bulletFlags, ...summaryFlags, ...atsResult.atsFlags.map((flag) => `ats: ${flag}`)];
    await application.save();

    return res.json({
      humanRecheckAtsScore: application.humanRecheckAtsScore,
      humanRecheckAtsFlags: application.humanRecheckAtsFlags,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to re-check application.' });
  }
});

// The endpoint that actually resumes the paused graph. action: 'approve'
// merges the current (possibly hand-edited) content and ends the run;
// action: 'retry' sends it back through tailorContent -> deterministicVerification
// -> (coverLetterGeneration) -> styleLinting -> atsScoreAndRecruiter -> humanApproval
// with the given notes, pausing again (possibly after further automatic
// retries within that same pass, capped at 3 — see shouldRetryAutomatically).
router.post('/:id/resume', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  const { action, notes } = req.body;
  if (action !== 'approve' && action !== 'retry') {
    return res.status(400).json({ error: "action must be 'approve' or 'retry'." });
  }
  if (action === 'retry' && (typeof notes !== 'string' || !notes.trim())) {
    return res.status(400).json({ error: 'notes is required for a retry.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (application.status === 'role_mismatch') {
      return res.status(400).json({ error: 'This application was a role mismatch — there is nothing to approve or retry.' });
    }
    if (application.status === 'approved') {
      return res.status(400).json({ error: 'This application has already been approved.' });
    }

    const resumePayload =
      action === 'approve'
        ? { action: 'approve', tailoredBullets: application.tailoredBullets, tailoredSummary: application.tailoredSummary }
        : { action: 'retry', notes, tailoredBullets: application.tailoredBullets };

    const snapshot = await resumeGraph(id, resumePayload);
    const state = snapshot.values;

    if (action === 'approve') {
      application.status = 'approved';
      application.approvedAt = new Date();
      application.tailoredBullets = state.tailoredBullets;
      application.tailoredSummary = state.tailoredSummary;
      application.coverLetterText = state.coverLetterText;
      application.atsScore = state.atsScore;
      application.atsFlags = state.atsFlags;
      application.recruiterFeedback = state.recruiterFeedback;
      application.retryCount = state.retryCount ?? application.retryCount;
    } else {
      application.status = 'pending_approval';
      application.retryNotes.push({ notes });
      application.tailoredBullets = state.tailoredBullets;
      application.tailoredSummary = state.tailoredSummary;
      application.keywordGaps = state.keywordGaps;
      application.coverLetterText = state.coverLetterText;
      application.atsScore = state.atsScore;
      application.atsFlags = state.atsFlags;
      application.recruiterFeedback = state.recruiterFeedback;
      application.retryCount = state.retryCount;
    }

    await application.save();

    return res.json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to resume application.' });
  }
});

// Section 4a — suggest missing skills. Never inserts text directly into the
// tailored output: writes a real resumeBullets document through the same
// tagBullet flow as a normal upload, then retries with it in the pool.
router.post('/:id/suggest-skills/accept', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid application id.' });
  }

  const { skill, bulletText } = req.body;
  if (typeof skill !== 'string' || !skill.trim()) {
    return res.status(400).json({ error: 'skill is required.' });
  }
  if (typeof bulletText !== 'string' || !bulletText.trim()) {
    return res.status(400).json({ error: 'bulletText is required.' });
  }

  try {
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (application.status === 'role_mismatch' || application.status === 'approved') {
      return res.status(400).json({ error: 'Cannot suggest a skill for this application.' });
    }
    if (!(application.keywordGaps || []).includes(skill)) {
      return res.status(400).json({ error: "skill is not one of this application's keyword gaps." });
    }

    const { skills, metrics } = await tagBullet(bulletText);
    const canonicalSkills = skills.map(canonicalizeSkill);
    const newBullet = await ResumeBullet.create({
      masterResumeId: application.masterResumeId,
      text: bulletText,
      skills,
      canonicalSkills,
      metrics,
    });

    const allBullets = await ResumeBullet.find({ masterResumeId: application.masterResumeId });
    const resumeBulletsForGraph = buildResumeBulletsForGraph(allBullets);

    const notes =
      `New skill added to resume: "${skill}". New bullet: "${bulletText}". ` +
      'Consider incorporating this bullet into the tailored content if relevant.';

    const snapshot = await resumeGraph(id, {
      action: 'retry',
      notes,
      tailoredBullets: application.tailoredBullets,
      resumeBullets: resumeBulletsForGraph,
    });
    const state = snapshot.values;

    application.status = 'pending_approval';
    application.retryNotes.push({ notes });
    application.tailoredBullets = state.tailoredBullets;
    application.tailoredSummary = state.tailoredSummary;
    application.keywordGaps = state.keywordGaps;
    application.coverLetterText = state.coverLetterText;
    application.atsScore = state.atsScore;
    application.atsFlags = state.atsFlags;
    application.recruiterFeedback = state.recruiterFeedback;
    application.retryCount = state.retryCount;
    await application.save();

    return res.json({ application, newBullet });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add suggested skill.' });
  }
});

export default router;
