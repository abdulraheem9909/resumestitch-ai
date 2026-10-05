import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STILLS_DIR = path.join(ROOT, 'out', 'stills');

// ~22 timestamps spanning every scene and every pipeline stage beat.
const TIMESTAMPS = [
  0.2, 4.0, 7.0, 10.5, 14.0, 20.5, 25.5, 30.0, 36.0, 41.5, 47.0, 53.0, 58.5,
  64.0, 69.5, 75.5, 82.0, 88.5, 95.0, 101.5, 109.5, 117.0,
];

async function main() {
  fs.rmSync(STILLS_DIR, { recursive: true, force: true });
  fs.mkdirSync(STILLS_DIR, { recursive: true });

  const { server, url } = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__scenesReady === true);
  await page.evaluate(() => document.fonts.ready);

  for (const t of TIMESTAMPS) {
    await page.evaluate((tt) => window.seek(tt), t);
    const fname = `t_${t.toFixed(1).padStart(6, '0')}.png`;
    await page.screenshot({ path: path.join(STILLS_DIR, fname) });
    console.log('wrote', fname);
  }

  await browser.close();
  server.close();
  console.log(`\nStills at: ${STILLS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
