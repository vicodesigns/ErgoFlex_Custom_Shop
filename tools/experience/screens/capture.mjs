#!/usr/bin/env node
// Deterministic monitor-screen clip generator for the 2026-10-30 intro film.
//
//   node tools/experience/screens/capture.mjs                 # every clip
//   node tools/experience/screens/capture.mjs 02-portrait 09-chat
//   node tools/experience/screens/capture.mjs 02-portrait --stills 0,4,8,12
//   node tools/experience/screens/capture.mjs --list
//
// Each clip is a canvas page (page.html + lib.js + scenes/*.js) exposing
// window.render(t) where t is chapter seconds. The desk pose for the chapter is
// sampled here from shots/NN.json with the app's own sampleClipMotion(), then
// injected as window.__SHOT so screen readouts track the lift/tilt/wheel clips.
// Frames are captured one by one in headless Chrome (CPU only) and piped to
// ffmpeg: H.264, 30 fps, duration = chapter seconds + 1.
import {createRequire} from 'module';
import {spawn, execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {CLIPS} from './clips.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const EXPORT = path.join(ROOT, 'exports/cinematic-intro-20261030');
const OUT = path.join(EXPORT, 'screens');
const CACHE = path.join(HERE, '.cache');
const FPS = 30;
const puppeteer = require(path.join(ROOT, 'node_modules/puppeteer-core'));
const {sampleClipMotion} = await import(pathToFileURL(path.join(ROOT, 'experience/desk-clips.mjs')).href);

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const stills = flag('--stills');
const stillDir = flag('--still-dir') || path.join(OUT, '_qa');
const limitFrames = flag('--frames');
if (args.includes('--list')) { for (const c of CLIPS) console.log(c.id.padEnd(22), `${c.w}x${c.h}`, c.role); process.exit(0); }
const wanted = args.filter(a => !a.startsWith('--'));
const clips = wanted.length ? CLIPS.filter(c => wanted.some(w => c.id === w || c.id.startsWith(w))) : CLIPS;
if (!clips.length) { console.error('no clips match', wanted); process.exit(1); }

function shotData(chapter) {
  const nn = String(chapter).padStart(2, '0');
  const shot = JSON.parse(fs.readFileSync(path.join(EXPORT, 'shots', nn + '.json'), 'utf8'));
  const seconds = shot.seconds, dur = seconds + 1, rate = 60;
  const poses = [];
  for (let i = 0; i <= dur * rate; i++) poses.push(sampleClipMotion(shot.motion, i / rate));
  const clips = shot.motion.clips.map(c => ({lane: c.lane, kind: c.kind, start: c.start, duration: c.duration, label: c.label, target: c.target}));
  return {id: shot.id, chapter, seconds, duration: dur, rate, poses, clips, initial: shot.motion.initial, title: shot.title};
}

// Demo exercise clips etc. are pre-decoded to jpg frames at 30 fps so the page
// can draw frame N deterministically (no <video> seeking).
function prepVideo(v) {
  const dir = path.join(CACHE, v.key);
  const done = path.join(dir, '.done');
  if (!fs.existsSync(done)) {
    fs.mkdirSync(dir, {recursive: true});
    const vf = [`fps=${FPS}`, v.scale ? `scale=${v.scale}` : null, v.crop ? `crop=${v.crop}` : null].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...(v.ss ? ['-ss', String(v.ss)] : []), '-i', v.src, '-t', String(v.t || 30), '-vf', vf, '-q:v', '3', path.join(dir, 'f%05d.jpg')]);
    fs.writeFileSync(done, '');
  }
  const count = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
  return {key: v.key, url: pathToFileURL(dir).href + '/', count};
}

// Score spectrum for the chapter's span of the film (audio-reactive screens).
function prepAudio(chapter, dur) {
  const edl = JSON.parse(fs.readFileSync(path.join(EXPORT, 'edl.json'), 'utf8'));
  const ch = edl.chapters.find(c => c.index === chapter);
  const wav = path.join(EXPORT, 'score/score.wav');
  const stamp = fs.statSync(wav).mtimeMs.toFixed(0);
  const file = path.join(CACHE, `audio-${chapter}-${ch.start}-${stamp}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, {recursive: true});
    const json = execFileSync('python3', [path.join(HERE, 'audio-bands.py'), wav, String(ch.start), String(dur), String(FPS), '32'], {maxBuffer: 1 << 28});
    fs.writeFileSync(file, json);
  }
  return {...JSON.parse(fs.readFileSync(file, 'utf8')), filmStart: ch.start};
}

async function renderClip(clip) {
  const shot = shotData(clip.chapter);
  const audio = clip.audio ? prepAudio(clip.chapter, shot.duration) : null;
  const videos = (clip.videos || []).map(prepVideo);
  const total = Math.round(shot.duration * FPS);
  const frames = limitFrames ? Math.min(total, Number(limitFrames)) : total;
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader', '--allow-file-access-from-files',
      '--disable-dev-shm-usage', '--no-first-run', '--hide-scrollbars', '--mute-audio', '--font-render-hinting=none'],
    defaultViewport: {width: clip.w, height: clip.h, deviceScaleFactor: 1},
  });
  let ff = null;
  try {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text()); });
    page.on('pageerror', e => console.log('  [pageerror]', e.message));
    await page.evaluateOnNewDocument((data) => { window.__SHOT = data; }, {
      ...shot, clip: {id: clip.id, role: clip.role, scene: clip.scene, w: clip.w, h: clip.h, opts: clip.opts || {}},
      videos: Object.fromEntries(videos.map(v => [v.key, v])), audio, root: pathToFileURL(ROOT).href,
    });
    await page.goto(pathToFileURL(path.join(HERE, 'page.html')).href, {waitUntil: 'load'});
    await page.evaluate(() => window.__ready);
    if (stills) {
      fs.mkdirSync(stillDir, {recursive: true});
      for (const s of stills.split(',').map(Number)) {
        await page.evaluate(t => window.render(t), s);
        await page.screenshot({path: path.join(stillDir, `${clip.id}-${s.toFixed(1)}.png`)});
      }
      console.log(`${clip.id}: stills -> ${stillDir}`);
      return;
    }
    const out = path.join(OUT, clip.id + '.mp4');
    const tmp = out.replace(/\.mp4$/, '.part.mp4');
    ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '15', '-r', String(FPS), '-movflags', '+faststart',
      '-frames:v', String(frames), tmp], {stdio: ['pipe', 'inherit', 'inherit']});
    const ffDone = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      const buf = await page.screenshot({type: 'jpeg', quality: 93, optimizeForSpeed: true});
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) process.stdout.write(`  ${clip.id} ${i}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s\r`);
    }
    ff.stdin.end();
    await ffDone;
    fs.renameSync(tmp, out);
    console.log(`${clip.id}: ${frames} frames ${clip.w}x${clip.h} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } finally {
    if (ff && ff.exitCode === null && !ff.stdin.writableEnded) ff.stdin.end();
    await browser.close();
  }
}

for (const clip of clips) await renderClip(clip);
