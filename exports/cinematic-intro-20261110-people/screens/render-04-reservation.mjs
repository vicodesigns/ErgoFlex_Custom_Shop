#!/usr/bin/env node
// Renders 04-reservation.mp4 (the commons desk's reservation screen) from 04-reservation.js with the film's screen
// toolkit (tools/experience/screens: lib.js, boot.js, the Poppins fonts), the way tools/experience/screens/capture.mjs
// renders the other chapters' clips: a canvas page in headless Chrome (CPU only), frame by frame into ffmpeg.
//
//   node exports/cinematic-intro-20261110-people/screens/render-04-reservation.mjs [--stills 0,4,8,12]
//
// 1920x800 (the curved monitor, as 04-curved.mp4), 30 fps, 17 s (the chapter's 16 s plus one).
import {createRequire} from 'module';
import {spawn} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..'), SCREENS = path.join(ROOT, 'tools/experience/screens');
const puppeteer = require(path.join(ROOT, 'node_modules/puppeteer-core'));
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
const W = 1920, H = 800, FPS = 30, SECONDS = 17, OUT = path.join(HERE, '04-reservation.mp4');
const stills = process.argv.includes('--stills') ? process.argv[process.argv.indexOf('--stills') + 1].split(',').map(Number) : null;
const url = p => pathToFileURL(p).href, font = w => `@font-face{font-family:Poppins;font-weight:${w[0]};src:url(${url(path.join(ROOT, 'app-reference/assets/google_fonts/Poppins-' + w[1] + '.ttf'))})}`;
const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${[[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']].map(font).join('')}
html,body{margin:0;padding:0;background:#000;overflow:hidden}canvas{display:block}</style></head><body><canvas id="c"></canvas>
<script src="${url(path.join(SCREENS, 'lib.js'))}"></script><script src="${url(path.join(HERE, '04-reservation.js'))}"></script><script src="${url(path.join(SCREENS, 'boot.js'))}"></script></body></html>`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ch04r-')), file = path.join(tmp, 'page.html'); fs.writeFileSync(file, page);
const browser = await puppeteer.launch({executablePath: CHROME, headless: 'new', defaultViewport: {width: W, height: H, deviceScaleFactor: 1},
  args: ['--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader', '--allow-file-access-from-files', '--no-first-run', '--hide-scrollbars', '--mute-audio', '--font-render-hinting=none']});
try {
  const tab = await browser.newPage();
  tab.on('pageerror', e => console.log('  [pageerror]', e.message));
  await tab.evaluateOnNewDocument(data => { window.__SHOT = data; }, {id: 'commons', chapter: 4, seconds: 16, duration: SECONDS, rate: 60, poses: [{height: 43.5, tilt: 0, x: 0, z: 0, yaw: 0}], clips: [],
    clip: {id: '04-reservation', scene: 'ch04r', w: W, h: H, opts: {}}, videos: {}, root: url(ROOT)});
  await tab.goto(url(file), {waitUntil: 'load'}); await tab.evaluate(() => window.__ready);
  if (stills) {
    for (const s of stills) { await tab.evaluate(t => window.render(t), s); await tab.screenshot({path: path.join(tmp, `still-${s}.png`)}); }
    console.log('stills ->', tmp);
  } else {
    const part = OUT.replace(/\.mp4$/, '.part.mp4');
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-g', '15', '-r', String(FPS), '-movflags', '+faststart', '-frames:v', String(SECONDS * FPS), part], {stdio: ['pipe', 'inherit', 'inherit']});
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
    for (let i = 0; i < SECONDS * FPS; i++) {
      await tab.evaluate(t => window.render(t), i / FPS);
      const buf = await tab.screenshot({type: 'jpeg', quality: 93, optimizeForSpeed: true});
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await done; fs.renameSync(part, OUT);
    console.log('04-reservation:', SECONDS * FPS, 'frames ->', path.relative(ROOT, OUT));
  }
} finally { await browser.close(); }
