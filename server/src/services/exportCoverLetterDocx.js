import { Document, Packer, Paragraph } from 'docx';

// Same reasoning as exportResumeDocx.js's identical constant — docx's own
// default margin (1 inch on every side) was never actually chosen for a
// letter specifically; a tighter, more standard margin reads better and
// wastes less of the page.
const PAGE_MARGIN_TWIPS = { top: 720, bottom: 720, left: 720, right: 720 }; // 0.5in

/**
 * generateCoverLetter.js's prompt deliberately produces body-only text (no
 * address block, date, or signature scaffolding), so this adds the minimal
 * framing needed for it to read as an actual letter. Generated fresh from
 * what's already stored in Mongo each time it's requested, never stored as
 * a file itself.
 */
export function buildCoverLetterDocxBuffer({ personalInfo = {}, companyName, coverLetterText }) {
  const bodyParagraphs = (coverLetterText || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const children = [
    new Paragraph({ text: `Dear ${companyName || 'Hiring'} Hiring Team,` }),
    ...bodyParagraphs.map((paragraph) => new Paragraph({ text: paragraph })),
    new Paragraph({ text: 'Sincerely,' }),
    new Paragraph({ text: personalInfo.fullName || '' }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { margin: PAGE_MARGIN_TWIPS } }, children }],
  });
  return Packer.toBuffer(doc);
}
