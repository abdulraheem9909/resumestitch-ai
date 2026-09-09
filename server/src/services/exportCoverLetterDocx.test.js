import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildCoverLetterDocxBuffer } from './exportCoverLetterDocx.js';

// Same class of bug already found and fixed in exportResumeDocx.js: with no
// font declared at all in docDefaults, LibreOffice falls back to its own
// generic default (not even attempting a Calibri substitute) when converting
// to PDF — a real, visible font mismatch against the resume export it's
// downloaded alongside.
test('buildCoverLetterDocxBuffer declares an explicit default font', async () => {
  const buffer = await buildCoverLetterDocxBuffer({
    personalInfo: { fullName: 'Jane Doe' },
    companyName: 'Acme Corp',
    coverLetterText: 'I am excited to apply for this role.',
  });
  const zip = await JSZip.loadAsync(buffer);
  const stylesXml = await zip.file('word/styles.xml')?.async('string');

  assert.ok(stylesXml, 'styles.xml should exist');
  const docDefaults = stylesXml.match(/<w:docDefaults>.*?<\/w:docDefaults>/s)?.[0] || '';
  assert.ok(/<w:rFonts\b[^>]*w:ascii="Calibri"/.test(docDefaults), 'docDefaults should explicitly declare Calibri');
});
