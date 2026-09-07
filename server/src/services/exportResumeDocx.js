import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

// A custom numbering definition, not the `bullet: { level: 0 }` shorthand:
// that shorthand has no way to size the glyph independently of body text,
// which is exactly why it renders "●" (BLACK CIRCLE) at full 11pt — heavier
// than a typical resume bullet. This uses the lighter "•" (BULLET) at a
// smaller size, with a tighter hanging indent than the shorthand's default.
const BULLET_NUMBERING_REFERENCE = 'resume-bullets';
const bulletNumberingConfig = {
  reference: BULLET_NUMBERING_REFERENCE,
  levels: [
    {
      level: 0,
      format: 'bullet',
      text: '•',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: { indent: { left: 360, hanging: 180 } },
        run: { size: 18 },
      },
    },
  ],
};

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
  certifications = [],
  volunteerWork = [],
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
      children.push(
        new Paragraph({ text: bullet.finalText, numbering: { reference: BULLET_NUMBERING_REFERENCE, level: 0 } })
      );
    }
  }

  if (education.length > 0) {
    children.push(new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_2 }));
    for (const entry of education) {
      if (entry.degree) {
        children.push(new Paragraph({ text: entry.degree, heading: HeadingLevel.HEADING_3 }));
      }
      // Institution, dateRange, and location together on one subline —
      // matches the single-subline shape Experience already uses, instead
      // of three visually disconnected pieces.
      const institutionAndDate = [entry.institution, entry.dateRange].filter(Boolean).join(' — ');
      const detailLine = [institutionAndDate, entry.location].filter(Boolean).join(' · ');
      if (detailLine) {
        children.push(new Paragraph({ children: [new TextRun({ text: detailLine, italics: true })] }));
      }
    }
  }

  if (certifications.length > 0) {
    children.push(new Paragraph({ text: 'CERTIFICATIONS', heading: HeadingLevel.HEADING_2 }));
    for (const entry of certifications) {
      if (entry.name) {
        children.push(new Paragraph({ text: entry.name, heading: HeadingLevel.HEADING_3 }));
      }
      const subline = [entry.issuer, entry.date].filter(Boolean).join(' · ');
      if (subline) {
        children.push(new Paragraph({ children: [new TextRun({ text: subline, italics: true })] }));
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

  if (volunteerWork.length > 0) {
    children.push(new Paragraph({ text: 'VOLUNTEER WORK', heading: HeadingLevel.HEADING_2 }));
    for (const entry of volunteerWork) {
      if (entry.role) {
        children.push(new Paragraph({ text: entry.role, heading: HeadingLevel.HEADING_3 }));
      }
      const subline = [entry.organization, entry.dateRange].filter(Boolean).join(' — ');
      if (subline) {
        children.push(new Paragraph({ children: [new TextRun({ text: subline, italics: true })] }));
      }
      if (entry.description) {
        children.push(new Paragraph({ text: entry.description }));
      }
    }
  }

  if (skills.length > 0) {
    children.push(new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2 }));
    // Single flowing paragraph, same as Summary — Word's own natural
    // line-wrapping breaks it based on actual page width. A fixed-count
    // "N per row" split was tried and reverted: skill names vary too much
    // in length to wrap evenly at a fixed count, and it leaves an orphaned
    // short row whenever the total isn't a clean multiple of the row size.
    children.push(new Paragraph({ text: skills.join(', ') }));
  }

  const doc = new Document({
    numbering: { config: [bulletNumberingConfig] },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          // Word's own "Normal" default (~10pt spacing-after on every single
          // paragraph) is what was actually pushing this document onto a
          // near-empty extra page — not any one section on its own, but
          // dozens of bullets/lines each carrying that gap. Headings get
          // their own spacing back below so sections/entries still read as
          // visually separated.
          paragraph: { spacing: { after: 40 } },
        },
        // heading1 isn't used anywhere in this document today, but it's kept
        // bold/consistent with heading2/heading3 rather than left at docx's
        // own unbolded built-in default, in case it's ever reached for.
        heading1: {
          run: { bold: true, color: '2E74B5', size: 32 },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading2: {
          run: { bold: true, color: '2E74B5', size: 26 },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading3: {
          run: { bold: true, color: '1F4D78', size: 24 },
          paragraph: { spacing: { before: 120, after: 40 } },
        },
      },
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
