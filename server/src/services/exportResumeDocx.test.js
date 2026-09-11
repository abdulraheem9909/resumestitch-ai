import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { buildResumeDocxBuffer } from './exportResumeDocx.js';

function hasBinary(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildFixture(overrides = {}) {
  const originalBulletsById = new Map([
    ['b1', { role: 'Software Engineer', company: 'Acme Corp', dateRange: '01/2022 - Present' }],
  ]);
  return {
    personalInfo: {
      fullName: 'Jane Doe',
      title: 'Software Engineer',
      location: 'Manchester, UK',
      phone: '+447700900123',
      email: 'jane.doe@example.com',
      linkedin: 'linkedin.com/in/janedoe',
      portfolio: '',
    },
    tailoredSummary: { finalText: 'Software Engineer with 5+ years of experience.' },
    tailoredTitle: { finalText: 'Software Engineer' },
    tailoredBullets: [
      { sourceBulletId: 'b1', finalText: 'Built and shipped a real-time notifications service.', rejected: false },
    ],
    originalBulletsById,
    education: [
      {
        degree: 'BSc Computer Science',
        institution: 'University of Salford',
        dateRange: '09/2018 - 06/2021',
        location: 'Manchester, UK',
      },
    ],
    projects: [{ name: 'Side Project', description: 'A small tool built for fun.' }],
    skills: ['Node.js', 'React', 'MongoDB'],
    ...overrides,
  };
}

test('buildResumeDocxBuffer keeps contact info in the body text, not a header', async () => {
  const fixture = buildFixture();
  const buffer = await buildResumeDocxBuffer(fixture);
  const { value: text } = await mammoth.extractRawText({ buffer });

  assert.ok(text.includes(fixture.personalInfo.phone), 'phone number should appear in the extracted body text');
  assert.ok(text.includes(fixture.personalInfo.email), 'email should appear in the extracted body text');
});

test('buildResumeDocxBuffer never emits a table or text-box element', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  assert.ok(!documentXml.includes('<w:tbl'), 'document.xml should not contain a table element');
  assert.ok(!documentXml.includes('txbxContent'), 'document.xml should not contain a text-box element');
});

test('buildResumeDocxBuffer declares an explicit default font and bolds every heading level', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const stylesXml = await zip.file('word/styles.xml').async('string');

  const docDefaults = stylesXml.match(/<w:docDefaults>.*?<\/w:docDefaults>/s)?.[0] || '';
  assert.ok(/<w:rFonts\b/.test(docDefaults), 'docDefaults should declare an explicit font, not the empty default from before');

  for (const styleId of ['Heading1', 'Heading2', 'Heading3']) {
    const block = stylesXml.match(new RegExp(`<w:style w:type="paragraph" w:styleId="${styleId}">.*?</w:style>`, 's'))?.[0];
    assert.ok(block, `${styleId} should exist in styles.xml`);
    assert.ok(/<w:b\/?>/.test(block), `${styleId} should be bold`);
  }
});

// Found live: docDefaults declares Calibri, but this document has no
// fontScheme/theme part, and LibreOffice doesn't reliably fall back to
// docDefaults for a paragraph style's own run properties without one — a
// real converted PDF showed every heading rendered in LibreOffice's own
// generic "Liberation Sans" default instead of Carlito (the Calibri
// substitute the rest of the body correctly used). Each heading level must
// declare its font explicitly, not rely on inheriting the document default.
test('buildResumeDocxBuffer declares an explicit font on every heading level too, not just docDefaults', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const stylesXml = await zip.file('word/styles.xml').async('string');

  for (const styleId of ['Heading1', 'Heading2', 'Heading3']) {
    const block = stylesXml.match(new RegExp(`<w:style w:type="paragraph" w:styleId="${styleId}">.*?</w:style>`, 's'))?.[0];
    assert.ok(/<w:rFonts\b[^>]*w:ascii="Calibri"/.test(block), `${styleId} should explicitly declare Calibri, not rely on inheriting docDefaults`);
  }
});

// Real-world repro, comparing against a resume built with a real resume
// template: every entry-level heading (job header, degree, project,
// certification, volunteer role) was bold AND colored AND a size bump over
// body text — repeated once per entry, that reads as a much "heavier" page
// than a template that reserves color for just the top-level section labels
// (SUMMARY/EXPERIENCE/EDUCATION/...) and keeps entry headers plain bold
// black. Heading3 (used for every entry) should stay bold (already asserted
// above) but drop the color and the size bump.
test('buildResumeDocxBuffer keeps entry-level headings (Heading3) bold but plain black, not colored', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const stylesXml = await zip.file('word/styles.xml').async('string');

  const block = stylesXml.match(/<w:style w:type="paragraph" w:styleId="Heading3">.*?<\/w:style>/s)?.[0];
  assert.ok(block, 'Heading3 should exist in styles.xml');
  assert.ok(/<w:b\/?>/.test(block), 'Heading3 should still be bold');
  assert.ok(!/<w:color\b/.test(block), 'Heading3 should no longer declare a color — entry headers should read as plain black, not blue');
  // 1pt bigger than the 11pt body text, but smaller than the 13pt top-level
  // section headings — sits visually between the two, per request.
  assert.ok(/<w:sz w:val="24"\/>/.test(block), 'Heading3 should be 12pt (24 half-points) — 1pt above body, 1pt below the 13pt section headings');
});

// Real-world repro: the job header used to read "Company — Role" as one
// combined line — a real resume template (TealHQ) instead puts the Role on
// its own top line (larger, paired with the date) and the Company on its
// own line directly below it, smaller — a clearer visual hierarchy than one
// run-on line, and consistent with how Education already separates
// degree/institution.
test('buildResumeDocxBuffer puts an entry\'s Role on top (larger, with the date) and Company below it (smaller), not run together on one line', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  const role = 'Software Engineer';
  const company = 'Acme Corp';
  const dateRange = '01/2022 - Present';
  const paragraphs = documentXml.match(/<w:p\b.*?<\/w:p>/gs) || [];

  const roleIndex = paragraphs.findIndex((p) => p.includes(role) && p.includes(dateRange));
  assert.ok(roleIndex >= 0, 'a paragraph combining the role and the date should exist');
  const roleParagraph = paragraphs[roleIndex];
  assert.ok(!roleParagraph.includes(company), 'the role/date line should not also contain the company name');
  assert.ok(/<w:tab w:val="right"/.test(roleParagraph), 'the role/date paragraph should declare a right tab stop for the date');
  assert.ok(/<w:r><w:tab\/><\/w:r>/.test(roleParagraph), 'the run between the role and the date should be a real <w:tab/> element, not a literal tab character in a text node');
  assert.ok(/<w:sz w:val="24"\/>/.test(roleParagraph), 'the role should be 12pt — 1pt larger than body text, matching Heading3');

  const companyParagraph = paragraphs[roleIndex + 1];
  assert.ok(companyParagraph?.includes(company), 'the very next paragraph after the role should be the company name');
  assert.ok(/<w:sz w:val="20"\/>/.test(companyParagraph), 'the company name should be 10pt — smaller than both the 11pt body text and the 12pt role');
});

// The right-tab-stop position that lands a date flush against the page's
// right margin is only correct if it's actually derived from the page's own
// declared width — found live: it had been hardcoded against an assumed
// Letter-width (12240 twips) page, but this document's own declared page
// size is really A4 (11906 twips, matching the reference TealHQ resume it
// was benchmarked against) since nothing had ever declared a size
// explicitly. That ~334-twip (0.23in) gap pushed every job's date past the
// true right margin, into the blank margin space. This test locks the
// invariant generally — tab position + right margin must never exceed the
// page's own declared width — so the two can't independently drift again
// regardless of which absolute page size is chosen later.
test('buildResumeDocxBuffer\'s right-aligned date tab stop lands exactly at the page\'s own declared right margin, not past it', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  const pgSz = documentXml.match(/<w:pgSz w:w="(\d+)"/);
  const pgMarTag = documentXml.match(/<w:pgMar\b[^/]*\/>/)?.[0];
  const tabPos = documentXml.match(/<w:tab w:val="right" w:pos="(\d+)"\/>/);

  assert.ok(pgSz, 'document should declare an explicit page width');
  assert.ok(pgMarTag, 'document should declare page margins');
  assert.ok(tabPos, 'document should declare a right tab stop position');

  const pageWidth = Number(pgSz[1]);
  const leftMargin = Number(pgMarTag.match(/w:left="(\d+)"/)?.[1]);
  const rightMargin = Number(pgMarTag.match(/w:right="(\d+)"/)?.[1]);
  const tabPosition = Number(tabPos[1]);

  assert.equal(
    tabPosition,
    pageWidth - leftMargin - rightMargin,
    'the right tab stop should land exactly at the printable text width (page width minus both margins), derived from the page\'s own declared size'
  );
});

// Real-world repro: the title ("Software Engineer") rendered as plain,
// unstyled body text directly under the name, before the contact line —
// easy to overlook. A real resume template gives it real emphasis and
// places it after the contact block, functioning as a header for the
// summary that follows.
test('buildResumeDocxBuffer renders the title in bold, positioned after the contact line', async () => {
  const fixture = buildFixture();
  const buffer = await buildResumeDocxBuffer(fixture);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  const titleParagraph = (documentXml.match(/<w:p\b.*?<\/w:p>/gs) || []).find((p) =>
    p.includes(fixture.tailoredTitle.finalText)
  );
  assert.ok(titleParagraph, 'a paragraph containing the title should exist');
  // Found live: a title styled as plain bold body text (11pt, same size as
  // everything around it) sat squeezed between the contact line and
  // "SUMMARY" (which jumps straight to bold-blue-13pt) — it read as a
  // visual afterthought, not a heading. Give it the same SIZE/WEIGHT as the
  // other top-level headings (bold, 13pt, real spacing) but deliberately
  // NOT their blue color — found live again: using the literal Heading2
  // style (color included) made the personal title indistinguishable from
  // an actual section label; black keeps it reading as "identity", not
  // "structure", while still carrying equal visual weight.
  assert.ok(/<w:b\/?>/.test(titleParagraph), 'the title should be bold');
  assert.ok(/<w:sz w:val="26"\/>/.test(titleParagraph), 'the title should be the same 13pt size as the other top-level headings');
  assert.ok(!/<w:color\b/.test(titleParagraph), 'the title should stay plain black, not inherit the blue heading color');

  const { value: text } = await mammoth.extractRawText({ buffer });
  const contactIndex = text.indexOf(fixture.personalInfo.phone);
  const titleIndex = text.indexOf(fixture.tailoredTitle.finalText);
  assert.ok(contactIndex >= 0 && titleIndex >= 0, 'both the contact info and title should appear in the extracted text');
  assert.ok(contactIndex < titleIndex, 'the contact line should appear before the title, not after');
});

test('buildResumeDocxBuffer\'s bullets actually render with a small "•" glyph, not the heavy "●" default', async () => {
  // The docx package always emits an unused, built-in "●" numbering
  // definition regardless of what's configured — checking numbering.xml
  // for the mere absence of "●" would be a false negative. What matters is
  // which definition the bullet paragraphs actually reference.
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const numberingXml = await zip.file('word/numbering.xml').async('string');

  const numId = documentXml.match(/<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="(\d+)"\/><\/w:numPr>/)?.[1];
  assert.ok(numId, 'a tailored bullet paragraph should reference a numbering id');

  const abstractNumId = numberingXml.match(new RegExp(`<w:num w:numId="${numId}"><w:abstractNumId w:val="(\\d+)"`))?.[1];
  const abstractNumBlock = numberingXml.match(
    new RegExp(`<w:abstractNum w:abstractNumId="${abstractNumId}"[^>]*>.*?</w:abstractNum>`, 's')
  )?.[0];

  assert.ok(abstractNumBlock?.includes('w:val="•"'), 'the numbering definition actually used by bullets should be the light "•" character');
  assert.ok(!abstractNumBlock?.includes('w:val="●"'), 'the numbering definition actually used by bullets should not be the heavy "●" character');
  assert.ok(/<w:sz w:val="18"\/>/.test(abstractNumBlock || ''), 'the bullet glyph should be rendered smaller than body text');
});

test('buildResumeDocxBuffer renders CERTIFICATIONS and VOLUNTEER WORK sections when present', async () => {
  const buffer = await buildResumeDocxBuffer(
    buildFixture({
      certifications: [{ name: 'AWS Certified Solutions Architect', issuer: 'Amazon', date: '2023' }],
      volunteerWork: [
        {
          role: 'Youth Coding Mentor',
          organization: 'Code Club',
          dateRange: '2020 - 2022',
          description: 'Ran weekly programming workshops for teenagers.',
        },
      ],
    })
  );
  const { value: text } = await mammoth.extractRawText({ buffer });

  assert.ok(text.includes('CERTIFICATIONS'), 'CERTIFICATIONS heading should be present');
  assert.ok(text.includes('AWS Certified Solutions Architect'), 'certification name should be present');
  assert.ok(text.includes('Amazon'), 'certification issuer should be present');
  assert.ok(text.includes('VOLUNTEER WORK'), 'VOLUNTEER WORK heading should be present');
  assert.ok(text.includes('Youth Coding Mentor'), 'volunteer role should be present');
  assert.ok(text.includes('Ran weekly programming workshops'), 'volunteer description should be present');
});

test('buildResumeDocxBuffer omits CERTIFICATIONS and VOLUNTEER WORK headings when both are empty', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture({ certifications: [], volunteerWork: [] }));
  const { value: text } = await mammoth.extractRawText({ buffer });

  assert.ok(!text.includes('CERTIFICATIONS'), 'CERTIFICATIONS heading should not be present when empty');
  assert.ok(!text.includes('VOLUNTEER WORK'), 'VOLUNTEER WORK heading should not be present when empty');
});

test('buildResumeDocxBuffer renders skills as one flowing paragraph, matching Summary, not fixed-count rows', async () => {
  // A fixed "N skills per row" split was tried and reverted: skill names
  // vary too much in length to wrap evenly at a fixed count, and it leaves
  // an orphaned short row whenever the total isn't a clean multiple of the
  // row size. Word's own natural line-wrapping (same as Summary) handles
  // this correctly with no manual row-splitting logic at all.
  const manySkills = Array.from({ length: 32 }, (_, i) => `Skill ${i + 1}`);
  const buffer = await buildResumeDocxBuffer(buildFixture({ skills: manySkills }));
  const { value: text } = await mammoth.extractRawText({ buffer });

  const skillsSectionText = text.split('SKILLS')[1] || '';
  const skillLines = skillsSectionText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  assert.equal(skillLines.length, 1, 'skills should render as a single paragraph, not split across multiple lines');
  assert.equal(skillLines[0], manySkills.join(', '));
});

// Sanity check for the Skills-section overflow bug: a long skills list used
// to render as one giant unbroken paragraph and could push an otherwise-short
// resume onto a near-empty extra page. Renders the real buffer to an actual
// PDF via LibreOffice headless (the same tool used for manual visual
// verification) and checks the real page count, rather than inferring page
// count from text length. Skipped when soffice/pdfinfo aren't on PATH, since
// this test depends on system tools this suite otherwise doesn't require.
test(
  'buildResumeDocxBuffer keeps a short resume with a long skills list within 2 pages',
  { timeout: 30000 },
  async (t) => {
    if (!hasBinary('soffice') || !hasBinary('pdfinfo')) {
      t.skip('soffice/pdfinfo not found on PATH — skipping PDF page-count regression test');
      return;
    }

    const manySkills = Array.from({ length: 32 }, (_, i) => `Skill ${i + 1}`);
    const buffer = await buildResumeDocxBuffer(buildFixture({ skills: manySkills }));

    const dir = mkdtempSync(path.join(tmpdir(), 'docx-page-count-'));
    try {
      const docxPath = path.join(dir, 'resume.docx');
      writeFileSync(docxPath, buffer);

      execFileSync(
        'soffice',
        [
          '--headless',
          `-env:UserInstallation=file://${dir}/lo-profile`,
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          docxPath,
        ],
        { stdio: 'ignore' }
      );

      const info = execFileSync('pdfinfo', [path.join(dir, 'resume.pdf')]).toString();
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);

      assert.ok(pages > 0, 'pdfinfo should report a page count');
      assert.ok(pages <= 2, `expected at most 2 pages for a short resume with 32 skills, got ${pages}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

// Real-world repro: email, LinkedIn, and portfolio in the contact line were
// plain text that only happened to look like a URL — nothing in the file
// declared them as actual hyperlinks, so nothing was clickable in either
// the .docx or the converted PDF. A real hyperlink needs its own relationship
// (registered in document.xml.rels), not just URL-shaped text.
test('buildResumeDocxBuffer makes email, LinkedIn, and portfolio real clickable hyperlinks', async () => {
  const fixture = buildFixture({
    personalInfo: {
      fullName: 'Jane Doe',
      title: 'Software Engineer',
      location: 'Manchester, UK',
      phone: '+447700900123',
      email: 'jane.doe@example.com',
      linkedin: 'linkedin.com/in/janedoe',
      portfolio: 'https://janedoe.dev',
    },
  });
  const buffer = await buildResumeDocxBuffer(fixture);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const relsXml = await zip.file('word/_rels/document.xml.rels').async('string');

  const hyperlinkIds = [...documentXml.matchAll(/<w:hyperlink[^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(hyperlinkIds.length, 3, 'email, LinkedIn, and portfolio should each render as a real <w:hyperlink>');

  const relTargets = hyperlinkIds.map((id) => {
    const rel = relsXml.match(new RegExp(`<Relationship Id="${id}"[^>]*Target="([^"]*)"`));
    return rel?.[1];
  });
  assert.ok(relTargets.includes('mailto:jane.doe@example.com'), 'email should link to a mailto: target');
  assert.ok(relTargets.includes('https://linkedin.com/in/janedoe'), 'LinkedIn should link to an https:// target even though the stored value has no protocol');
  assert.ok(relTargets.includes('https://janedoe.dev'), 'portfolio should link to its own https:// target unchanged');

  // Phone and location are plain contact details, not links — must stay
  // plain text, not accidentally wrapped in a hyperlink too.
  assert.equal(hyperlinkIds.length, [...relsXml.matchAll(/TargetMode="External"/g)].length);
});

// Requested styling: no blue color, no underline — the link should read as
// plain text, indistinguishable in appearance from the rest of the contact
// line, while still being a real, clickable <w:hyperlink> underneath.
test('buildResumeDocxBuffer styles hyperlinks as plain text — no color, no underline', async () => {
  const buffer = await buildResumeDocxBuffer(buildFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  const hyperlinkBlocks = documentXml.match(/<w:hyperlink\b.*?<\/w:hyperlink>/gs) || [];
  assert.ok(hyperlinkBlocks.length > 0, 'at least one hyperlink should exist to check styling on');
  for (const block of hyperlinkBlocks) {
    assert.ok(!/<w:color\b/.test(block), 'a hyperlink run should not declare a color');
    assert.ok(!/<w:u\b/.test(block), 'a hyperlink run should not declare an underline');
  }
});

// Real-world repro: this app's exported PDF currently has no real embedded
// hyperlink annotations at all (a separate, already-documented LibreOffice
// conversion limitation) — the only way a link is clickable in the PDF
// today is if the PDF VIEWER auto-detects URL/email-shaped text on its own.
// A bare "linkedin.com/in/..." (no protocol in the visible text) isn't
// reliably auto-detected the way "https://janedoe.dev" or an email address
// already is — found live: email and portfolio were clickable in a browser
// PDF viewer, LinkedIn wasn't. Displaying the LinkedIn text with the same
// https:// prefix its own link target already uses closes that gap.
test('buildResumeDocxBuffer displays the LinkedIn link with an https:// prefix, matching its own target, so PDF viewers can auto-detect it too', async () => {
  const fixture = buildFixture({
    personalInfo: {
      fullName: 'Jane Doe',
      title: 'Software Engineer',
      location: 'Manchester, UK',
      phone: '+447700900123',
      email: 'jane.doe@example.com',
      linkedin: 'linkedin.com/in/janedoe',
      portfolio: '',
    },
  });
  const { value: text } = await mammoth.extractRawText({ buffer: await buildResumeDocxBuffer(fixture) });
  assert.ok(text.includes('https://linkedin.com/in/janedoe'), 'the displayed LinkedIn text should include the https:// prefix');
});
