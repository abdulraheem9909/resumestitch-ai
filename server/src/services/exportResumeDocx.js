import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

function groupBulletsByRole(tailoredBullets, originalBulletsById) {
  const groups = [];
  const groupsByKey = new Map();

  for (const bullet of tailoredBullets) {
    const source = originalBulletsById.get(bullet.sourceBulletId) || {};
    const key = `${source.role || ''}|${source.company || ''}|${source.dateRange || ''}`;

    let group = groupsByKey.get(key);
    if (!group) {
      group = { role: source.role, company: source.company, dateRange: source.dateRange, bullets: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.bullets.push(bullet);
  }

  return groups;
}

/**
 * Builds an approved application's tailored content into a downloadable
 * .docx resume — generated fresh from what's already stored in Mongo each
 * time it's requested, never stored as a file itself.
 */
export function buildResumeDocxBuffer({ personalInfo = {}, tailoredSummary, tailoredBullets, originalBulletsById }) {
  const contactLine = [personalInfo.location, personalInfo.phone, personalInfo.email, personalInfo.linkedin, personalInfo.portfolio]
    .filter(Boolean)
    .join(' · ');

  const groups = groupBulletsByRole(tailoredBullets, originalBulletsById);

  const children = [
    new Paragraph({
      children: [new TextRun({ text: personalInfo.fullName || '', bold: true, size: 32 })],
    }),
  ];

  if (personalInfo.title) {
    children.push(new Paragraph({ text: personalInfo.title }));
  }
  if (contactLine) {
    children.push(new Paragraph({ text: contactLine }));
  }

  children.push(new Paragraph({ text: 'SUMMARY', heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: tailoredSummary.finalText }));

  children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }));
  for (const group of groups) {
    const heading = [group.company, group.role].filter(Boolean).join(' — ');
    if (heading) {
      children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_3 }));
    }
    if (group.dateRange) {
      children.push(new Paragraph({ children: [new TextRun({ text: group.dateRange, italics: true })] }));
    }
    for (const bullet of group.bullets) {
      children.push(new Paragraph({ text: bullet.finalText, bullet: { level: 0 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
