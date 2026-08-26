import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { extractResumeText } from "../services/extractResumeText.js";
import { segmentResume } from "../services/segmentResume.js";
import { tagBullet } from "../services/tagBullet.js";
import { canonicalizeSkill } from "../services/canonicalizeSkill.js";
import MasterResume from "../models/MasterResume.js";
import ResumeBullet from "../models/ResumeBullet.js";

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

  const { label } = req.body;
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "label is required." });
  }

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
    const masterResume = await MasterResume.create({ label });
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

    resume.status = "deleted";
    await resume.save();

    return res.json({ masterResume: resume });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete resume." });
  }
});

export default router;
