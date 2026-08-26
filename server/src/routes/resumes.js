import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { segmentResume } from "../services/segmentResume.js";
import { htmlToBulletedText } from "../services/htmlToBulletedText.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/extract-text", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const { originalname, buffer } = req.file;
  const extension = originalname.split(".").pop().toLowerCase();

  try {
    if (extension === "docx") {
      const { value: html } = await mammoth.convertToHtml({ buffer });
      const bulletedText = htmlToBulletedText(html);
      const bulletText = segmentResume(bulletedText);
      return res.json({ text: bulletText });
    }

    if (extension === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const { text } = await parser.getText();
        const bulletText = segmentResume(text);
        return res.json({ text: bulletText });
      } finally {
        await parser.destroy();
      }
    }

    return res.status(400).json({
      error: "Unsupported file type. Only .docx and .pdf are accepted.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to extract text from file." });
  }
});

export default router;
