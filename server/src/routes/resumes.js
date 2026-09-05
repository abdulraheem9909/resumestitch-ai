import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { extractResumeText } from "../services/extractResumeText.js";
import { segmentResume, DATE_RANGE_REGEX } from "../services/segmentResume.js";
import { segmentResumeWithAI } from "../services/segmentResumeWithAI.js";
import { segmentResumeSections } from "../services/segmentResumeSections.js";
import { segmentResumeSectionsWithAI } from "../services/segmentResumeSectionsWithAI.js";
import { extractContactInfo } from "../services/extractContactInfo.js";
import { tagBullet } from "../services/tagBullet.js";
import { canonicalizeSkill } from "../services/canonicalizeSkill.js";
import { computeVerifiedSkills } from "../services/verifiedSkills.js";
import { getSkillAliases, addSkillAliasEntries } from "../services/skillAliasesStore.js";
import { proposeSkillAliasGroups } from "../services/generateSkillAliases.js";
import MasterResume from "../models/MasterResume.js";
import ResumeBullet from "../models/ResumeBullet.js";
import Application from "../models/Application.js";
import GenerationCache from "../models/GenerationCache.js";
import { getCheckpointer } from "../graph/graphInstance.js";

const router = Router();
// No legitimate resume file needs anywhere near this much room; caps how
// much an upload can force the server to buffer into memory before any
// other validation runs.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MAX_ACTIVE_RESUMES = 5;

router.post("/extract-text", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const bulletedText = await extractResumeText(req.file);
    if (bulletedText === null) {
      return res.status(400).json({
        error: "Unsupported file type. Only .docx and .pdf are accepted.",
      });
    }

    return res.json({ text: segmentResume(bulletedText) });
  } catch (err) {
    // The only thing that can throw here is mammoth/pdf-parse choking on the
    // file's actual content — a bad-input problem, not a server fault.
    console.error(err);
    return res.status(400).json({ error: "Could not read this file — it may be corrupted or not a valid .docx/.pdf." });
  }
});

// Prefill-only: deterministically pulls personalInfo + a suggested label out of
// the file so the upload form can pre-populate its fields. Nothing is saved
// here — the user still reviews/edits before the real POST / creates anything.
router.post("/parse-preview", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const bulletedText = await extractResumeText(req.file);
    if (bulletedText === null) {
      return res.status(400).json({
        error: "Unsupported file type. Only .docx and .pdf are accepted.",
      });
    }

    const personalInfo = extractContactInfo(bulletedText);
    const suggestedLabel =
      [personalInfo.fullName, personalInfo.title].filter(Boolean).join(" — ") ||
      req.file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

    return res.json({ personalInfo, suggestedLabel });
  } catch (err) {
    // Same reasoning as /extract-text — a parsing failure here is a bad-input
    // problem, not a server fault.
    console.error(err);
    return res.status(400).json({ error: "Could not read this file — it may be corrupted or not a valid .docx/.pdf." });
  }
});

router.get("/", async (_req, res) => {
  try {
    const masterResumes = await MasterResume.find({ status: "active" }).sort({ uploadedAt: -1 });
    return res.json({ masterResumes });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list resumes." });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const { label, fullName, title, location, phone, email, linkedin, portfolio } = req.body;
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "label is required." });
  }
  if (typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "fullName is required." });
  }
  const personalInfo = {
    fullName: fullName.trim(),
    title: (title || "").trim(),
    location: (location || "").trim(),
    phone: (phone || "").trim(),
    email: (email || "").trim(),
    linkedin: (linkedin || "").trim(),
    portfolio: (portfolio || "").trim(),
  };

  // Step 2 — cap check. Runs before any text extraction or LLM tagging so a
  // 6th upload that's going to be rejected anyway never pays for either.
  const activeCount = await MasterResume.countDocuments({ status: "active" });
  if (activeCount >= MAX_ACTIVE_RESUMES) {
    return res.status(409).json({ error: "delete a resume first" });
  }

  // Step 3 — text extraction, isolated in its own try/catch: the only thing
  // that can throw here is mammoth/pdf-parse choking on the file's actual
  // content — a bad-input problem, not a server fault, so it gets its own
  // 400 rather than falling into the generic 500 below.
  let bulletedText;
  try {
    bulletedText = await extractResumeText(req.file);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Could not read this file — it may be corrupted or not a valid .docx/.pdf." });
  }
  if (bulletedText === null) {
    return res.status(400).json({
      error: "Unsupported file type. Only .docx and .pdf are accepted.",
    });
  }

  try {
    // Step 4 — segmentation
    let segments = segmentResume(bulletedText);
    const { summary, education, projects, skills, certifications, volunteerWork } = segmentResumeSections(bulletedText);

    // Fallback: the same kind of layout scrambling that can zero out bullets
    // (see below) can also leave the summary/education/skills extraction
    // looking broken — education or skills coming back completely empty, or
    // summary suspiciously long (a sign it swallowed other sections'
    // content, since a genuine summary paragraph is never this long). Only
    // replaces the specific field(s) that actually look broken; a field that
    // already extracted correctly is never second-guessed or overwritten.
    let finalSummary = summary;
    let finalEducation = education;
    let finalSkills = skills;
    const summaryLooksBroken = summary.length > 600;
    // A scrambled layout can still produce a non-empty education array —
    // e.g. one garbage entry with no institution at all, which is virtually
    // never true of a genuine degree — so "empty" alone isn't a strong
    // enough signal on its own to catch every broken parse.
    const educationLooksBroken = education.length === 0 || education.some((entry) => !entry.institution);
    // Same reasoning as education: a scrambled layout can produce a non-empty
    // but wrong skills array too — e.g. every skill on its own line with no
    // commas between them joins into one giant string, bullet glyphs and all,
    // instead of splitting into separate items. A single implausibly long
    // "skill," or one that still contains a literal bullet character, is
    // virtually never genuine.
    const skillsLooksBroken = skills.length === 0 || skills.some((skill) => /[•●]/.test(skill) || skill.length > 60);
    if (summaryLooksBroken || educationLooksBroken || skillsLooksBroken) {
      try {
        const aiSections = await segmentResumeSectionsWithAI(bulletedText);
        if (summaryLooksBroken) finalSummary = aiSections.summary || finalSummary;
        if (educationLooksBroken) finalEducation = aiSections.education.length > 0 ? aiSections.education : finalEducation;
        if (skillsLooksBroken) finalSkills = aiSections.skills.length > 0 ? aiSections.skills : finalSkills;
      } catch (err) {
        console.error("AI section-extraction fallback failed (upload still proceeds with deterministic result):", err);
      }
    }

    // Fallback: the deterministic parser above depends on recognizing a
    // bullet character and a date-range separator in the extracted text.
    // Some PDFs (bullet glyphs that don't survive extraction, multi-column
    // layouts that scatter date-range text) leave nothing for those rules to
    // key off of and come back with zero usable bullets — a resume with none
    // can't even be used to create an application. When that happens, ask an
    // AI to find the same job/bullet boundaries instead. Never invents
    // content: bullet text is still lifted verbatim from what was already
    // extracted, and this only ever runs when the free deterministic pass
    // has already come back empty.
    if (segments.length === 0) {
      try {
        segments = await segmentResumeWithAI(bulletedText);
      } catch (err) {
        console.error('AI segmentation fallback failed (upload still proceeds with zero bullets):', err);
      }
    }

    // Fallback: a resume can have *some* jobs the deterministic parser
    // handles fine (bulleted, with a recognizable date) sitting alongside
    // one written as a plain paragraph with no bullet marker at all (common
    // for a brief or less-relevant role, e.g. under an "Other Experience"
    // heading) — that job silently produces zero bullets while the rest of
    // the resume parses fine, so the all-or-nothing check above never fires.
    // Counting date-range-shaped lines in the raw text as a rough proxy for
    // "how many jobs should exist" catches this. Purely additive: only jobs
    // the deterministic pass never found at all (by role+company) get added
    // from the AI's result — anything already parsed correctly is untouched.
    const dateLineCount = bulletedText.split('\n').filter((line) => DATE_RANGE_REGEX.test(line)).length;
    const distinctJobCount = new Set(segments.map((segment) => `${segment.role}|${segment.company}|${segment.dateRange}`)).size;
    if (segments.length > 0 && distinctJobCount < dateLineCount) {
      try {
        const aiSegments = await segmentResumeWithAI(bulletedText);
        const existingJobKeys = new Set(segments.map((segment) => `${segment.role}|${segment.company}`.toLowerCase()));
        const missingJobSegments = aiSegments.filter(
          (segment) => !existingJobKeys.has(`${segment.role}|${segment.company}`.toLowerCase())
        );
        segments = [...segments, ...missingJobSegments];
      } catch (err) {
        console.error('AI segmentation fallback (recovering a job with no bullet markers) failed:', err);
      }
    }

    // Step 5 — LLM tagging, one call per bullet
    const taggedBullets = await Promise.all(
      segments.map(async (segment) => {
        const { skills, metrics } = await tagBullet(segment.text);
        return {
          ...segment,
          skills,
          canonicalSkills: skills.map(canonicalizeSkill),
          metrics,
        };
      })
    );

    // Same read-only extraction, applied to each project's description — feeds
    // gap analysis/role-fit alongside resumeBullets' skills, but a project
    // itself never becomes a tailorable bullet (see MasterResume.js).
    const taggedProjects = await Promise.all(
      projects.map(async (project) => {
        const { skills: projectSkills } = await tagBullet(project.description);
        return { ...project, skills: projectSkills, canonicalSkills: projectSkills.map(canonicalizeSkill) };
      })
    );

    // Step 5b — grow the skill-alias dictionary (server/data/skillAliases.json)
    // with anything this resume introduced that it doesn't already cover.
    // Never fails the upload — this is an enhancement to future gap-analysis/
    // verification accuracy, not a requirement of saving this resume.
    const candidateSkills = [
      ...taggedBullets.flatMap((bullet) => bullet.skills),
      ...taggedProjects.flatMap((project) => project.skills),
      ...finalSkills,
    ];
    const known = new Set(
      Object.entries(getSkillAliases()).flatMap(([alias, canonicalId]) => [alias.toLowerCase(), canonicalId.toLowerCase()])
    );
    const newTerms = [...new Set(candidateSkills.map((skill) => (skill || "").trim().toLowerCase()).filter(Boolean))].filter(
      (term) => !known.has(term)
    );

    let newSkillAliasesAdded = [];
    if (newTerms.length > 0) {
      try {
        const { groups } = await proposeSkillAliasGroups(newTerms);
        newSkillAliasesAdded = addSkillAliasEntries(groups);
      } catch (err) {
        console.error("Skill-alias generation failed (upload still succeeds):", err);
      }
    }

    // Step 6 — save
    const masterResume = await MasterResume.create({
      label,
      personalInfo,
      summary: finalSummary,
      education: finalEducation,
      projects: taggedProjects,
      // Static, verbatim, never skill-tagged — no AI-fallback recovery either,
      // matching the existing precedent that projects itself has none. See
      // key-decisions-log.md.
      certifications,
      volunteerWork,
      skills: finalSkills,
    });
    const resumeBullets = await ResumeBullet.insertMany(
      taggedBullets.map((bullet, index) => ({
        masterResumeId: masterResume._id,
        text: bullet.text,
        role: bullet.role,
        company: bullet.company,
        dateRange: bullet.dateRange,
        order: index,
        skills: bullet.skills,
        canonicalSkills: bullet.canonicalSkills,
        metrics: bullet.metrics,
      }))
    );

    return res.status(201).json({ masterResume, resumeBullets, newSkillAliasesAdded });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process resume upload." });
  }
});

// For the resume detail page — a single active resume.
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  try {
    const resume = await MasterResume.findOne({ _id: id, status: "active" });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }
    const bullets = await ResumeBullet.find({ masterResumeId: id }).sort({ order: 1 });
    const sourceTexts = [
      ...bullets.map((bullet) => bullet.text),
      resume.summary,
      ...(resume.projects || []).map((project) => project.description),
    ];
    const { verifiedSkills, skillMatchTypes } = computeVerifiedSkills(resume.skills, sourceTexts);
    return res.json({ masterResume: resume, verifiedSkills, skillMatchTypes });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load resume." });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  const { label } = req.body;
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "label is required." });
  }

  try {
    const resume = await MasterResume.findOne({ _id: id, status: "active" });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    const nameTaken = await MasterResume.findOne({
      label,
      status: "active",
      _id: { $ne: id },
    });
    if (nameTaken) {
      return res.status(409).json({ error: "A resume with this name already exists." });
    }

    resume.label = label;
    await resume.save();

    return res.json({ masterResume: resume });
  } catch (err) {
    return res.status(500).json({ error: "Failed to rename resume." });
  }
});

router.patch("/:id/profile", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  const { personalInfo, summary, education, projects, certifications, volunteerWork, skills } = req.body;

  if (personalInfo !== undefined) {
    if (typeof personalInfo !== "object" || personalInfo === null || Array.isArray(personalInfo)) {
      return res.status(400).json({ error: "personalInfo must be an object." });
    }
    if (typeof personalInfo.fullName !== "string" || !personalInfo.fullName.trim()) {
      return res.status(400).json({ error: "fullName is required." });
    }
  }
  if (summary !== undefined && typeof summary !== "string") {
    return res.status(400).json({ error: "summary must be a string." });
  }
  if (education !== undefined && !Array.isArray(education)) {
    return res.status(400).json({ error: "education must be an array." });
  }
  if (projects !== undefined && !Array.isArray(projects)) {
    return res.status(400).json({ error: "projects must be an array." });
  }
  if (certifications !== undefined && !Array.isArray(certifications)) {
    return res.status(400).json({ error: "certifications must be an array." });
  }
  if (volunteerWork !== undefined && !Array.isArray(volunteerWork)) {
    return res.status(400).json({ error: "volunteerWork must be an array." });
  }
  if (skills !== undefined && !Array.isArray(skills)) {
    return res.status(400).json({ error: "skills must be an array." });
  }

  try {
    const resume = await MasterResume.findOne({ _id: id, status: "active" });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    if (personalInfo !== undefined) resume.personalInfo = personalInfo;
    if (summary !== undefined) resume.summary = summary;
    if (education !== undefined) resume.education = education;
    if (projects !== undefined) resume.projects = projects;
    if (certifications !== undefined) resume.certifications = certifications;
    if (volunteerWork !== undefined) resume.volunteerWork = volunteerWork;
    if (skills !== undefined) resume.skills = skills;
    await resume.save();

    return res.json({ masterResume: resume });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update resume profile." });
  }
});

router.get("/:id/bullets", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  try {
    const resumeBullets = await ResumeBullet.find({ masterResumeId: id }).sort({ order: 1 });
    return res.json({ resumeBullets });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list bullets." });
  }
});

router.post("/:id/bullets", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  const { text, role, company, dateRange } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }

  try {
    const resume = await MasterResume.findOne({ _id: id, status: "active" });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    const { skills, metrics } = await tagBullet(text);
    const canonicalSkills = skills.map(canonicalizeSkill);

    // A manually added bullet always appends after everything already on
    // this resume, never at the front — see the `order` field's own comment.
    const [lastBullet] = await ResumeBullet.find({ masterResumeId: id }).sort({ order: -1 }).limit(1);
    const nextOrder = (lastBullet?.order ?? -1) + 1;

    // Same optional employer-context fields already supported when a bullet
    // is added via suggest-missing-skills (applications.js) — a bullet added
    // here with no company set just won't count toward node 5's per-employer
    // coverage guarantee, same as any other company-less bullet.
    const resumeBullet = await ResumeBullet.create({
      masterResumeId: id,
      text,
      order: nextOrder,
      skills,
      canonicalSkills,
      metrics,
      role: typeof role === "string" && role.trim() ? role.trim() : undefined,
      company: typeof company === "string" && company.trim() ? company.trim() : undefined,
      dateRange: typeof dateRange === "string" && dateRange.trim() ? dateRange.trim() : undefined,
    });

    return res.status(201).json({ resumeBullet });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add bullet." });
  }
});

router.patch("/bullets/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid bullet id." });
  }

  const { text } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }

  try {
    const bullet = await ResumeBullet.findById(id);
    if (!bullet) {
      return res.status(404).json({ error: "Bullet not found." });
    }

    const { skills, metrics } = await tagBullet(text);

    bullet.text = text;
    bullet.skills = skills;
    bullet.canonicalSkills = skills.map(canonicalizeSkill);
    bullet.metrics = metrics;
    await bullet.save();

    return res.json({ resumeBullet: bullet });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update bullet." });
  }
});

// Permanent delete of a single master-resume bullet. Safe for any existing
// application: node 5/6/9, computeHumanRecheck, the docx export route, and
// the Approval page's "Original" column all read resumeBullets off that
// application's own frozen LangGraph checkpoint, never a live query here —
// so this can never retroactively change an in-progress or already-approved
// application's score, flags, or feedback. The one live-refresh path is
// "Suggest missing skills" (applications.js), which re-fetches master
// bullets fresh — if this bullet is still on some application's tailored
// resume, it will drop out of that application's next round, even if it was
// hand-edited or manually excluded there. That's this action doing exactly
// what it says, not a bug to guard against.
router.delete("/bullets/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid bullet id." });
  }

  try {
    const bullet = await ResumeBullet.findById(id);
    if (!bullet) {
      return res.status(404).json({ error: "Bullet not found." });
    }

    // A resume with zero bullets can never be used to create an application
    // (see the `bullets.length === 0` check in applications.js's POST /) —
    // refuse here instead of letting that surface later as a confusing error.
    const remainingCount = await ResumeBullet.countDocuments({ masterResumeId: bullet.masterResumeId });
    if (remainingCount <= 1) {
      return res.status(400).json({
        error: "Cannot delete the last bullet on a resume — a resume needs at least one bullet to create an application.",
      });
    }

    await ResumeBullet.deleteOne({ _id: id });
    return res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete bullet." });
  }
});

// Section 2.4 — full cascading delete, in the given order:
// 1. applications linked to this resume, 2. their generated output files,
// 3. their LangGraph checkpoint/thread history (also cleans up GenerationCache
// entries, the same category of applicationId-keyed data section 2.4 doesn't
// literally mention), 4. every resumeBullets document, 5. the masterResumes
// document itself. Destructive and irreversible — this is what frees a slot
// under the 5-resume cap.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid resume id." });
  }

  try {
    const resume = await MasterResume.findOne({ _id: id, status: "active" });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    // Capture linked application ids before deleting their documents — the
    // checkpoint cleanup below needs them and step 1 removes the documents
    // that would otherwise let us look them up.
    const applications = await Application.find({ masterResumeId: id }, { _id: 1 });
    const applicationIds = applications.map((application) => application._id.toString());

    // Step 1 — delete linked applications documents.
    await Application.deleteMany({ masterResumeId: id });

    // Step 2 — delete any generated output files. This build never writes
    // approved .docx files to disk in the first place (server/src/routes/
    // applications.js's export routes generate them on demand straight from
    // Mongo and stream them back) — nothing to delete here by design.

    // Step 3 — delete the LangGraph checkpoint/thread history for each
    // application (thread_id === applications._id).
    const checkpointer = getCheckpointer();
    await Promise.all(applicationIds.map((applicationId) => checkpointer.deleteThread(applicationId)));

    // Not one of section 2.4's five numbered steps (written before the
    // idempotency cache in section 6 existed), but it's the same category of
    // data keyed by applicationId — GenerationCache entries for these
    // applications (nodes 1/5/7/9) would otherwise survive as orphans with
    // no application left to ever reference them again.
    await GenerationCache.deleteMany({ applicationId: { $in: applicationIds } });

    // Step 4 — delete every resumeBullets document tied to this resume.
    const { deletedCount: resumeBulletsDeleted } = await ResumeBullet.deleteMany({ masterResumeId: id });

    // Step 5 — delete the masterResumes document itself.
    await MasterResume.deleteOne({ _id: id });

    return res.json({
      deleted: true,
      applicationsDeleted: applicationIds.length,
      resumeBulletsDeleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete resume." });
  }
});

export default router;
