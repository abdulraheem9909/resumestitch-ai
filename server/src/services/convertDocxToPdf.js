import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Converts a .docx buffer to a .pdf buffer using LibreOffice headless — the
 * same tool already used elsewhere in this project's own tooling for
 * rendering/verification. Nothing is left on disk once this resolves or
 * rejects: the source .docx, the converted .pdf, and LibreOffice's own
 * per-call profile directory all live under one temp directory that's
 * always removed in the finally block, matching the "never stored
 * server-side" rule the .docx export routes already follow.
 */
export async function convertDocxBufferToPdf(docxBuffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'docx-to-pdf-'));
  try {
    const docxPath = path.join(dir, 'input.docx');
    await writeFile(docxPath, docxBuffer);

    try {
      await execFileAsync('soffice', [
        '--headless',
        `-env:UserInstallation=file://${dir}/lo-profile`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        docxPath,
      ]);
    } catch (err) {
      throw new Error(`LibreOffice PDF conversion failed: ${err.message}`);
    }

    try {
      return await readFile(path.join(dir, 'input.pdf'));
    } catch (err) {
      throw new Error(`LibreOffice did not produce a PDF output file: ${err.message}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
