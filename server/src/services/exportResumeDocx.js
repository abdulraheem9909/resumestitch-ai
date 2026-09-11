import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopType, Tab, ExternalHyperlink } from 'docx';

function toAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

// Email/LinkedIn/portfolio previously rendered as plain text that only
// happened to look like a URL — nothing declared them as actual hyperlinks,
// so nothing was clickable in either the .docx or the converted PDF. A real
// hyperlink needs its own relationship (ExternalHyperlink), not just
// URL-shaped text. Location/phone stay plain text — there's nothing to link.
//
// Styled to look identical to the surrounding text (no color, no underline)
// — deliberately not the usual blue-underline convention.
//
// LinkedIn's displayed text is its own full https:// URL, not the bare
// stored value ("linkedin.com/in/...") — this app's PDF export currently
// has no real embedded hyperlink annotations at all (a separate, already-
// documented LibreOffice conversion limitation), so the only way a link is
// clickable in the PDF today is if the viewer auto-detects URL/email-shaped
// TEXT on its own. Found live: email and portfolio (whose displayed text is
// already a full https:// URL) were clickable this way in a browser PDF
// viewer; a bare "linkedin.com/in/..." with no protocol in the visible text
// wasn't reliably auto-detected. Matching portfolio's own already-prefixed
// display form closes that gap.
function buildContactLineChildren(personalInfo) {
  const parts = [];
  if (personalInfo.location) parts.push({ text: personalInfo.location });
  if (personalInfo.phone) parts.push({ text: personalInfo.phone });
  if (personalInfo.email) parts.push({ text: personalInfo.email, link: `mailto:${personalInfo.email}` });
  if (personalInfo.linkedin) {
    const link = toAbsoluteUrl(personalInfo.linkedin);
    parts.push({ text: link, link });
  }
  if (personalInfo.portfolio) parts.push({ text: personalInfo.portfolio, link: toAbsoluteUrl(personalInfo.portfolio) });

  const children = [];
  parts.forEach((part, index) => {
    if (index > 0) children.push(new TextRun({ text: ' · ' }));
    if (part.link) {
      children.push(new ExternalHyperlink({ link: part.link, children: [new TextRun({ text: part.text })] }));
    } else {
      children.push(new TextRun({ text: part.text }));
    }
  });
  return children;
}

// A custom numbering definition, not the `bullet: { level: 0 }` shorthand:
// that shorthand has no way to size the glyph independently of body text,
// which is exactly why it renders "●" (BLACK CIRCLE) at full 11pt — heavier
// than a typical resume bullet. This uses the lighter "•" (BULLET) at a
// smaller size, with a tighter hanging indent than the shorthand's default.
// docx's own default page margin (1440 twips = 1 inch on every side) was
// never actually chosen for a resume specifically — it's just Word's
// generic document default, left unset here until now. Found live,
// comparing against a resume built with a real resume template: the extra
// inch of unused width on both sides forces more lines to wrap than
// necessary, and that accumulates — across dozens of bullets/entries — into
// enough extra height to push identical content onto a 3rd, mostly-empty
// page that a tighter, resume-appropriate margin doesn't need at all.
const PAGE_MARGIN_TWIPS = { top: 720, bottom: 720, left: 720, right: 720 }; // 0.5in

// Explicit A4 (11906 x 16838 twips) — matches the TealHQ resume this export
// was benchmarked against, and matches what LibreOffice/Word already assume
// when a page size isn't declared at all, so declaring it here doesn't
// change existing output. Found live: the right-tab date position below had
// been computed against an assumed Letter width (12240 twips) even though
// this document actually renders at A4 (11906 twips) — a 334-twip (0.23in)
// gap that pushed every job's date past the true right margin, into the
// blank margin space. Declaring the size explicitly, and deriving the tab
// position from this same constant, means the two can never independently
// drift apart again.
const PAGE_SIZE_TWIPS = { width: 11906, height: 16838 };

// The printable text width (page width minus both margins) — where a right
// tab stop lands a date flush against the right margin, on the same line as
// the entry heading it belongs to, instead of the date sitting on its own
// separate line below.
const RIGHT_TAB_POSITION = PAGE_SIZE_TWIPS.width - PAGE_MARGIN_TWIPS.left - PAGE_MARGIN_TWIPS.right;

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
  const contactLineChildren = buildContactLineChildren(personalInfo);

  const groups = groupBulletsByRole(tailoredBullets, originalBulletsById);

  const children = [
    new Paragraph({
      children: [new TextRun({ text: personalInfo.fullName || '', bold: true, size: 32 })],
    }),
  ];

  if (contactLineChildren.length > 0) {
    children.push(new Paragraph({ children: contactLineChildren }));
  }

  // After the contact block, not before it, matching Heading2's size/weight/
  // spacing (13pt, bold, real before/after spacing) inline — but explicitly
  // NOT its blue color, since referencing the actual Heading2 *style* here
  // made the personal title indistinguishable from a real section label.
  // Black keeps it reading as "who you are," equal in visual weight to
  // SUMMARY/EXPERIENCE below it without being mistaken for one of them.
  // Found live: plain bold body text (11pt, no spacing of its own) sat
  // squeezed between the contact line and "SUMMARY" — it read as an
  // afterthought, not a heading.
  const effectiveTitle = tailoredTitle?.finalText || personalInfo.title;
  if (effectiveTitle) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: effectiveTitle, bold: true, size: 26 })],
      })
    );
  }

  children.push(new Paragraph({ text: 'SUMMARY', heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: tailoredSummary.finalText }));

  children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }));
  for (const group of groups) {
    // A bullet added with no role/company attached (e.g. an unassigned
    // suggest-missing-skills addition) still gets a real heading rather than
    // a blank line, so it doesn't read as a formatting glitch in the
    // exported file. Role leads (it's what a reviewer scans for first), with
    // Company as a real fallback only when there's no role to show at all —
    // matching a real resume template (TealHQ): Role on top, larger; Company
    // on its own line directly below, smaller. Found live, comparing against
    // that template: the two previously ran together on one "Company — Role"
    // line, with no visual hierarchy between them at all.
    const primaryHeading = group.role || group.company || 'Additional Experience';
    const secondaryHeading = group.role && group.company ? group.company : null;

    if (group.dateRange) {
      // Heading + date share one line (a right tab stop lands the date at
      // the right margin) instead of the date sitting on its own separate
      // line below — more scannable, and less vertical space per entry.
      // Not using HeadingLevel.HEADING_3 here since that style can't also
      // carry a mid-paragraph tab stop — the bold run below matches
      // Heading3's own (colorless, 12pt) run styling directly.
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POSITION }],
          spacing: { before: 120, after: secondaryHeading ? 0 : 40 },
          children: [
            new TextRun({ text: primaryHeading, bold: true, size: 24 }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: group.dateRange, italics: true }),
          ],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: secondaryHeading ? 0 : 40 },
          children: [new TextRun({ text: primaryHeading, bold: true, size: 24 })],
        })
      );
    }

    if (secondaryHeading) {
      // 10pt — smaller than both the 11pt body text and the 12pt role above
      // it, so Company reads as clearly secondary information, not a second
      // equally-weighted heading.
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: secondaryHeading, italics: true, size: 20 })],
        })
      );
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
        // Each heading level repeats `font: 'Calibri'` explicitly rather than
        // relying on inheriting it from docDefaults above — found live: this
        // document has no fontScheme/theme part, and LibreOffice doesn't
        // reliably fall through to docDefaults for a style's own run without
        // one. A real converted PDF showed every heading rendered in
        // LibreOffice's generic "Liberation Sans" fallback instead of
        // Carlito, the Calibri substitute the rest of the body correctly used.
        heading1: {
          run: { font: 'Calibri', bold: true, color: '2E74B5', size: 32 },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading2: {
          run: { font: 'Calibri', bold: true, color: '2E74B5', size: 26 },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        // No color, unlike heading1/2 above — found live, comparing against
        // a real resume template: coloring every single entry-level heading
        // (one per job, degree, project, certification, volunteer role)
        // reads as a much "heavier"/busier page than reserving color for
        // just the top-level section labels (SUMMARY/EXPERIENCE/...).
        // Size is bumped one point above body text (11pt) so an entry
        // header still reads as a heading at a glance, while staying a
        // point below the section labels (13pt) it's nested under.
        heading3: {
          run: { font: 'Calibri', bold: true, size: 24 },
          paragraph: { spacing: { before: 120, after: 40 } },
        },
      },
    },
    sections: [{ properties: { page: { size: PAGE_SIZE_TWIPS, margin: PAGE_MARGIN_TWIPS } }, children }],
  });
  return Packer.toBuffer(doc);
}
