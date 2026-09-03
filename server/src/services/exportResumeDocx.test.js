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
