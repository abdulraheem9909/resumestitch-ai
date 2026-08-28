import { Document, Packer, Paragraph } from 'docx';

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

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
