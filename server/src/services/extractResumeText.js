import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { htmlToBulletedText } from './htmlToBulletedText.js';

/**
 * Deterministic text extraction (section 2.1, step 2). Returns bulleted plain
 * text ready for segmentResume(), or null for an unsupported file extension.
 */
export async function extractResumeText({ originalname, buffer }) {
  const extension = originalname.split('.').pop().toLowerCase();

  if (extension === 'docx') {
    const { value: html } = await mammoth.convertToHtml({ buffer });
    return htmlToBulletedText(html);
  }

  if (extension === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      return text;
    } finally {
      await parser.destroy();
    }
  }

  return null;
}
