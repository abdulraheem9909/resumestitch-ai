import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const { TOTAL_FRAMES, FPS, DURATION } = await import('../src/timeline.js');

const FRAMES_DIR = path.join(ROOT, 'out', 'frames');
const OUT_MP4 = path.join(ROOT, 'out', 'workflow.mp4');

function checkFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version']);
  return r.status === 0;
}

async function renderFrames() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const { server, url } = await startServer();
  const browser = await chromium.launch();

  const workerCount = Math.max(1, Math.min(os.cpus().length, 4));
  console.log(`Rendering ${TOTAL_FRAMES} frames (${DURATION}s @ ${FPS}fps) across ${workerCount} page(s)...`);

  const chunkSize = Math.ceil(TOTAL_FRAMES / workerCount);
  const chunks = [];
  for (let i = 0; i < workerCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(TOTAL_FRAMES, start + chunkSize);
    if (start < end) chunks.push([start, end]);
  }

  let rendered = 0;
  const logEvery = Math.max(1, Math.floor(TOTAL_FRAMES / 20));

  await Promise.all(
    chunks.map(async ([start, end]) => {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__scenesReady === true);
      await page.evaluate(() => document.fonts.ready);

      for (let f = start; f < end; f++) {
        const t = f / FPS;
        await page.evaluate((tt) => window.seek(tt), t);
        const fname = `frame_${String(f).padStart(6, '0')}.png`;
        await page.screenshot({ path: path.join(FRAMES_DIR, fname) });
        rendered++;
        if (rendered % logEvery === 0 || rendered === TOTAL_FRAMES) {
          console.log(`  ${rendered}/${TOTAL_FRAMES} frames`);
        }
      }
      await page.close();
    })
  );

  await browser.close();
  server.close();
  console.log('Frame rendering complete.');
}

function encodeVideo() {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-r', String(FPS),
      '-i', path.join(FRAMES_DIR, 'frame_%06d.png'),
      '-c:v', 'libx264',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      OUT_MP4,
    ];
    console.log('Encoding: ffmpeg ' + args.join(' '));
    const ff = spawn('ffmpeg', args, { stdio: 'inherit' });
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))));
  });
}

async function main() {
  await renderFrames();

  if (!checkFfmpeg()) {
    console.log('\nffmpeg is not installed, so frames were rendered but NOT encoded.');
    console.log(`Frames are at: ${FRAMES_DIR}`);
    console.log('Install ffmpeg, then re-run: npm run render');
    console.log('\nUbuntu/Debian:  sudo apt install -y ffmpeg');
    console.log('Fedora:         sudo dnf install -y ffmpeg');
    console.log('Arch:           sudo pacman -S ffmpeg');
    console.log('macOS (brew):   brew install ffmpeg');
    process.exit(0);
  }

  await encodeVideo();
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  console.log(`\nDone: ${OUT_MP4}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
