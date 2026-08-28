import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { extractResumeText } from "../services/extractResumeText.js";
import { segmentResume } from "../services/segmentResume.js";
import { segmentResumeSections } from "../services/segmentResumeSections.js";
import { tagBullet } from "../services/tagBullet.js";
import { canonicalizeSkill } from "../services/canonicalizeSkill.js";
import MasterResume from "../models/MasterResume.js";
import ResumeBullet from "../models/ResumeBullet.js";
import Application from "../models/Application.js";
import GenerationCache from "../models/GenerationCache.js";
import { getCheckpointer } from "../graph/graphInstance.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
    return res.status(500).json({ error: "Failed to extract text from file." });
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

  try {
    // Step 2 — text extraction
    const bulletedText = await extractResumeText(req.file);
    if (bulletedText === null) {
      return res.status(400).json({
        error: "Unsupported file type. Only .docx and .pdf are accepted.",
      });
    }

    // Step 3 — segmentation
    const segments = segmentResume(bulletedText);
    const { summary, education, projects, skills } = segmentResumeSections(bulletedText);

    // Step 4 — LLM tagging, one call per bullet
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

    // Step 5 — cap check
    const activeCount = await MasterResume.countDocuments({ status: "active" });
    if (activeCount >= MAX_ACTIVE_RESUMES) {
      return res.status(409).json({ error: "delete a resume first" });
    }

    // Step 6 — save
    const masterResume = await MasterResume.create({
      label,
      personalInfo,
      summary,
      education,
      projects,
      skills,
    });
    const resumeBullets = await ResumeBullet.insertMany(
      taggedBullets.map((bullet) => ({
        masterResumeId: masterResume._id,
        text: bullet.text,
        role: bullet.role,
        company: bullet.company,
        dateRange: bullet.dateRange,
        skills: bullet.skills,
        canonicalSkills: bullet.canonicalSkills,
        metrics: bullet.metrics,
      }))
    );

    return res.status(201).json({ masterResume, resumeBullets });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process resume upload." });
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

  const { personalInfo, summary, education, projects, skills } = req.body;

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
    const resumeBullets = await ResumeBullet.find({ masterResumeId: id });
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

  const { text } = req.body;
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

    const resumeBullet = await ResumeBullet.create({
      masterResumeId: id,
      text,
      skills,
      canonicalSkills,
      metrics,
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
