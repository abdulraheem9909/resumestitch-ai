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
export function buildResumeDocxBuffer({
  personalInfo = {},
  tailoredSummary,
  tailoredTitle,
  tailoredBullets,
  originalBulletsById,
  education = [],
  projects = [],
  skills = [],
}) {
  const contactLine = [personalInfo.location, personalInfo.phone, personalInfo.email, personalInfo.linkedin, personalInfo.portfolio]
    .filter(Boolean)
    .join(' · ');

  const groups = groupBulletsByRole(tailoredBullets, originalBulletsById);

  const children = [
    new Paragraph({
      children: [new TextRun({ text: personalInfo.fullName || '', bold: true, size: 32 })],
    }),
  ];

  const effectiveTitle = tailoredTitle?.finalText || personalInfo.title;
  if (effectiveTitle) {
    children.push(new Paragraph({ text: effectiveTitle }));
  }
  if (contactLine) {
    children.push(new Paragraph({ text: contactLine }));
  }

  children.push(new Paragraph({ text: 'SUMMARY', heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: tailoredSummary.finalText }));

  children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }));
  for (const group of groups) {
    // A bullet added with no role/company attached (e.g. an unassigned
    // suggest-missing-skills addition) still gets a real heading rather than
    // a blank line, so it doesn't read as a formatting glitch in the
    // exported file.
    const heading = [group.company, group.role].filter(Boolean).join(' — ') || 'Additional Experience';
    children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_3 }));
    if (group.dateRange) {
      children.push(new Paragraph({ children: [new TextRun({ text: group.dateRange, italics: true })] }));
    }
    for (const bullet of group.bullets) {
      children.push(new Paragraph({ text: bullet.finalText, bullet: { level: 0 } }));
    }
  }

  if (education.length > 0) {
    children.push(new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_2 }));
    for (const entry of education) {
      const heading = [entry.degree, entry.institution].filter(Boolean).join(' — ');
      if (heading) {
        children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_3 }));
      }
      if (entry.dateRange) {
        children.push(new Paragraph({ children: [new TextRun({ text: entry.dateRange, italics: true })] }));
      }
      if (entry.location) {
        children.push(new Paragraph({ text: entry.location }));
      }
    }
  }

  if (projects.length > 0) {
    children.push(new Paragraph({ text: 'PROJECTS', heading: HeadingLevel.HEADING_2 }));
    for (const project of projects) {
      if (project.name) {
        children.push(new Paragraph({ text: project.name, heading: HeadingLevel.HEADING_3 }));
      }
      if (project.description) {
        children.push(new Paragraph({ text: project.description }));
      }
    }
  }

  if (skills.length > 0) {
    children.push(new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: skills.join(', ') }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
