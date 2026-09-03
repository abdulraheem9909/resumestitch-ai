import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { convertDocxBufferToPdf } from './convertDocxToPdf.js';

function hasBinary(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function countLeftoverTempDirs() {
  return readdirSync(tmpdir()).filter((name) => name.startsWith('docx-to-pdf-')).length;
}

// Minimal but genuinely valid .docx: a zip containing the bare minimum parts
// Word/LibreOffice need to open it. Built by hand rather than pulling in
// buildResumeDocxBuffer, so this test has no dependency on that module.
async function buildMinimalDocxBuffer() {
  const { Document, Packer, Paragraph } = await import('docx');
  const doc = new Document({ sections: [{ children: [new Paragraph({ text: 'Hello, PDF conversion.' })] }] });
  return Packer.toBuffer(doc);
}

test(
  'convertDocxBufferToPdf converts a real docx buffer into a valid PDF buffer',
  { timeout: 30000 },
  async (t) => {
    if (!hasBinary('soffice')) {
      t.skip('soffice not found on PATH — skipping PDF conversion test');
      return;
    }

    const docxBuffer = await buildMinimalDocxBuffer();
    const pdfBuffer = await convertDocxBufferToPdf(docxBuffer);

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 0);
    assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-', 'output should start with the PDF magic bytes');
  }
);

test(
  'convertDocxBufferToPdf leaves nothing on disk after a successful conversion',
  { timeout: 30000 },
  async (t) => {
    if (!hasBinary('soffice')) {
      t.skip('soffice not found on PATH — skipping cleanup test');
      return;
    }

    const before = countLeftoverTempDirs();
    const docxBuffer = await buildMinimalDocxBuffer();
    await convertDocxBufferToPdf(docxBuffer);
    const after = countLeftoverTempDirs();

    assert.equal(after, before, 'no docx-to-pdf- temp directory should remain after conversion');
  }
);

// No "malformed input" test: empirically confirmed that LibreOffice's own
// format auto-detection is lenient here — given a garbage, non-zip buffer,
// it falls back to importing it as plain text and happily produces a PDF
// containing that literal text, rather than failing (reproduced manually
// with `soffice --convert-to pdf` on a plain-text file named .docx: exit
// code 0, a real PDF produced). Since buildResumeDocxBuffer/
// buildCoverLetterDocxBuffer are internal, trusted code paths that always
// produce a genuinely valid .docx, this isn't a realistic failure mode for
// these routes anyway — "the binary can't be found at all" below is the
// practically relevant failure case.
test(
  'convertDocxBufferToPdf rejects clearly (and still cleans up) when the soffice binary cannot be found, rather than resolving with an empty buffer',
  { timeout: 30000 },
  async (t) => {
    if (!hasBinary('soffice')) {
      t.skip('soffice not found on PATH — skipping binary-missing test');
      return;
    }

    const before = countLeftoverTempDirs();
    const docxBuffer = await buildMinimalDocxBuffer();

    const originalPath = process.env.PATH;
    process.env.PATH = '/nonexistent-path-for-testing';
    try {
      await assert.rejects(() => convertDocxBufferToPdf(docxBuffer), /LibreOffice PDF conversion failed/);
    } finally {
      process.env.PATH = originalPath;
    }

    const after = countLeftoverTempDirs();
    assert.equal(after, before, 'no docx-to-pdf- temp directory should remain even after a failed conversion');
  }
);
