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
import crypto from 'crypto';
import {CLIPS} from './clips.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const EXPORT = path.join(ROOT, 'exports/cinematic-intro-20261030');
// CAPTURE_OUT=<dir> writes the clips elsewhere (e.g. a later work version's screens/), and
// CAPTURE_SHOT=<shot.json> samples the desk pose from that shot instead of shots/NN.json here.
// TWIN=<video> puts the real 3D desk in ch01's DIGITAL TWIN card: a render-cut --video of the twin cut
// (tools/experience/build-round8-twin.py), chapter time 0 at frame 0. The card draws frame round(t * 30)
// (pre-decoded like the demo clips, held on the last frame). Unset, ch01 draws the 2D side view as before.
// CHROME_PATH overrides the browser (default: the standard Windows install on win32, else /usr/bin/google-chrome).
// Cine clips (clips.mjs entries with shot:'<chapter id>', Nov 14 2026): the desk pose is sampled from that chapter of the
// working cut (CINE_CUT, default exports/cinematic-intro-cut-cine/review-cut.json; CAPTURE_SHOT=<cut.json or shot.json>
// overrides) and the clip goes to the entry's out dir (default exports/cinematic-intro-cut-cine/screens; CAPTURE_OUT
// overrides). An entry with still:true writes one PNG (<id>.png, frame at opts.stillAt or 0) instead of an MP4.
// Music (audio:true), cine clips: the cut's own score (S7): the spectrum from <cut dir>/score/score.wav at the chapter's
// start in <cut dir>/edl.json (by id), the beat from <cut dir>/score/tempo-map.json chapters.<id> (beats_rel from
// music_from) handed to the scene as SHOT.tempo (see scenes/ch09.js). Both are read at capture time (regenerated with
// the final score). Without score.wav: no spectrum (the scene's own pulse). CINE_SCORE=<wav> + CINE_SCORE_START=<s> and
// CINE_TEMPO=<json> override them.
// PYTHON overrides the interpreter for audio-bands.py (default python on win32, else python3).
const OUT = process.env.CAPTURE_OUT ? path.resolve(ROOT, process.env.CAPTURE_OUT) : path.join(EXPORT, 'screens');
const CINE_CUT = path.resolve(ROOT, process.env.CINE_CUT || 'exports/cinematic-intro-cut-cine/review-cut.json');
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const outDir = clip => process.env.CAPTURE_OUT ? OUT : clip.out ? path.resolve(ROOT, clip.out) : OUT;
const CACHE = path.join(HERE, '.cache');
const FPS = 30;
const TWIN = process.env.TWIN ? path.resolve(ROOT, process.env.TWIN) : null;
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
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

function cineShot(id) {
  const file = process.env.CAPTURE_SHOT ? path.resolve(ROOT, process.env.CAPTURE_SHOT) : CINE_CUT;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const shot = Array.isArray(data.shots) ? data.shots.find(s => s.id === id) : data;
  if (!shot || shot.id !== id) throw new Error(`no shot '${id}' in ${path.relative(ROOT, file)}`);
  return shot;
}
// the same key as check-screens.py motion_key(): sha1 of {motion, seconds} with sorted keys, compact
function sortKeys(v) { return Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v; }
function motionKey(id) { const s = cineShot(id); return crypto.createHash('sha1').update(JSON.stringify(sortKeys({motion: s.motion ?? null, seconds: s.seconds ?? null}))).digest('hex').slice(0, 16); }
function shotData(chapter, clip = {}) {
  const nn = String(chapter).padStart(2, '0');
  const shot = clip.shot ? cineShot(clip.shot) : JSON.parse(fs.readFileSync(process.env.CAPTURE_SHOT ? path.resolve(ROOT, process.env.CAPTURE_SHOT) : path.join(EXPORT, 'shots', nn + '.json'), 'utf8'));
  shot.motion = shot.motion || {initial: {height: 28, tilt: 0, x: 0, z: 0, yaw: 0}, clips: []}; shot.motion.clips = shot.motion.clips || [];
  const seconds = shot.seconds, dur = seconds + 1, rate = 60;
  const poses = [];
  for (let i = 0; i <= dur * rate; i++) poses.push(sampleClipMotion(shot.motion, i / rate));
  const clips = shot.motion.clips.map(c => ({lane: c.lane, kind: c.kind, start: c.start, duration: c.duration, label: c.label, target: c.target, value: c.value, direction: c.direction}));
  // lightsOn: the end of a leading 'off' LED state (the desk is dark until then, so its monitor is too); absent otherwise.
  const off = (shot.ledStatus || []).find(e => e.kind === 'off' && e.at === 0);
  return {id: shot.id, chapter, seconds, duration: dur, rate, poses, clips, initial: shot.motion.initial, title: shot.title, ...(off ? {lightsOn: off.dur} : {})};
}

// Demo exercise clips etc. are pre-decoded to jpg frames at 30 fps so the page
// can draw frame N deterministically (no <video> seeking).
// An old absolute path (the Linux render box's /home/ergo/ErgoFlex_Custom_Shop/...) falls back to the same path in this checkout.
const localSrc = src => fs.existsSync(src) ? src : /ErgoFlex_Custom_Shop\//.test(src) ? path.join(ROOT, src.split('ErgoFlex_Custom_Shop/').pop()) : path.resolve(ROOT, src);
function prepVideo(v) {
  const dir = path.join(CACHE, v.cache || v.key);
  const done = path.join(dir, '.done');
  // a .done marker without frames (the markers are in git, the frames are not) decodes again
  if (!fs.existsSync(done) || !fs.readdirSync(dir).some(f => f.endsWith('.jpg'))) {
    v = {...v, src: localSrc(v.src)};
    fs.mkdirSync(dir, {recursive: true});
    const vf = [`fps=${FPS}`, v.scale ? `scale=${v.scale}` : null, v.crop ? `crop=${v.crop}` : null].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...(v.ss ? ['-ss', String(v.ss)] : []), '-i', v.src, '-t', String(v.t || 30), '-vf', vf, '-q:v', String(v.q || 3), path.join(dir, 'f%05d.jpg')]);
    fs.writeFileSync(done, '');
  }
  const count = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
  return {key: v.key, url: pathToFileURL(dir).href + '/', count};
}

// Score spectrum for the chapter's span of the film (audio-reactive screens).
function prepAudio(chapter, dur, clip = {}) {
  if (clip.shot && !process.env.CINE_SCORE) {   // the cut's own score and edl
    const dir = path.dirname(CINE_CUT), wav = path.join(dir, 'score/score.wav'), edlF = path.join(dir, 'edl.json');
    const ch = fs.existsSync(edlF) && JSON.parse(fs.readFileSync(edlF, 'utf8')).chapters.find(c => c.id === clip.shot);
    if (!ch || !fs.existsSync(wav)) { console.log(`  audio: ${!ch ? path.relative(ROOT, edlF) + ' (chapter ' + clip.shot + ')' : path.relative(ROOT, wav)} missing -> no spectrum (beat pulse only)`); return null; }
    process.env.CINE_SCORE = path.relative(ROOT, wav); process.env.CINE_SCORE_START = String(ch.start);
    try { return prepAudio(chapter, dur); } finally { delete process.env.CINE_SCORE; delete process.env.CINE_SCORE_START; }
  }
  if (process.env.CINE_SCORE) {
    const wav = path.resolve(ROOT, process.env.CINE_SCORE), start = Number(process.env.CINE_SCORE_START);
    if (!Number.isFinite(start)) throw new Error('CINE_SCORE needs CINE_SCORE_START (seconds of the chapter start in the score)');
    const stamp = fs.statSync(wav).mtimeMs.toFixed(0), file = path.join(CACHE, `audio-cine-${chapter}-${start}-${stamp}.json`);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(CACHE, {recursive: true});
      try { fs.writeFileSync(file, execFileSync(PYTHON, [path.join(HERE, 'audio-bands.py'), wav, String(start), String(dur), String(FPS), '32'], {maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe']})); }
      catch (e) { console.log(`  audio: audio-bands.py failed (${String(e.stderr || e.message).trim().split(String.fromCharCode(10)).pop()}) -> no spectrum (needs numpy)`); return null; }
    }
    return {...JSON.parse(fs.readFileSync(file, 'utf8')), filmStart: start};
  }
  const edl = JSON.parse(fs.readFileSync(path.join(EXPORT, 'edl.json'), 'utf8'));
  const ch = edl.chapters.find(c => c.index === chapter);
  const wav = path.join(EXPORT, 'score/score.wav');
  if (!fs.existsSync(wav)) {   // no score here: the analysis cached in git for this chapter, else none (the scene's own pulse)
    const hit = fs.existsSync(CACHE) && fs.readdirSync(CACHE).find(f => f.startsWith(`audio-${chapter}-${ch.start}-`) && f.endsWith('.json'));
    console.log(`  audio: ${path.relative(ROOT, wav)} missing -> ${hit ? 'cached ' + hit : 'none (beat pulse only)'}`);
    return hit ? {...JSON.parse(fs.readFileSync(path.join(CACHE, hit), 'utf8')), filmStart: ch.start} : null;
  }
  const stamp = fs.statSync(wav).mtimeMs.toFixed(0);
  const file = path.join(CACHE, `audio-${chapter}-${ch.start}-${stamp}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, {recursive: true});
    const json = execFileSync(PYTHON, [path.join(HERE, 'audio-bands.py'), wav, String(ch.start), String(dur), String(FPS), '32'], {maxBuffer: 1 << 28});
    fs.writeFileSync(file, json);
  }
  return {...JSON.parse(fs.readFileSync(file, 'utf8')), filmStart: ch.start};
}

// The score's tempo map for a clip: CINE_TEMPO / clip.tempo, else the cut's score/tempo-map.json (cine clips). A map with
// chapters.<id> (S7's tempo-map.json) gives that chapter's beats in chapter seconds from music_from; a plain
// {bpm, first?} or {beats, in, chapterStart} object is passed through.
function tempoFor(clip) {
  const f = process.env.CINE_TEMPO || clip.tempo || (clip.shot ? path.join(path.dirname(CINE_CUT), 'score/tempo-map.json') : null);
  if (!f || !fs.existsSync(path.resolve(ROOT, f))) return null;
  const m = JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
  const c = m.chapters ? m.chapters[clip.shot] : m;
  if (!c) return null;
  if (Array.isArray(c.beats_rel)) return {beats: c.beats_rel, in: 'chapter', first: c.music_from ?? c.beats_rel[0], bpm: c.bpm, source: path.relative(ROOT, path.resolve(ROOT, f))};
  return c;
}

async function renderClip(clip) {
  const shot = shotData(clip.chapter, clip);
  const audio = clip.audio ? prepAudio(clip.chapter, shot.duration, clip) : null;
  const tempo = clip.audio ? tempoFor(clip) : null;
  if (clip.audio) console.log(`  ${clip.id}: tempo ${tempo ? (tempo.beats ? tempo.beats.length + ' beats from ' + tempo.first + ' s, ~' + tempo.bpm + ' BPM' : tempo.bpm + ' BPM') : 'none (115.2 BPM default)'}, spectrum ${audio ? 'from ' + (audio.filmStart ?? '?') + ' s' : 'none'}`);
  const videos = (clip.videos || []).map(prepVideo);
  if (TWIN && clip.scene === 'ch01') {
    // Cache per twin file (path, size, mtime), so a re-rendered twin is decoded again.
    const st = fs.statSync(TWIN), id = crypto.createHash('sha1').update(`${TWIN}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 12);
    videos.push(prepVideo({key: 'twin', cache: 'twin-' + id, src: TWIN, t: shot.duration, q: 2}));
    console.log(`${clip.id}: twin ${path.relative(ROOT, TWIN)} (${videos.at(-1).count} frames)`);
  }
  const total = Math.round(shot.duration * FPS);
  const frames = limitFrames ? Math.min(total, Number(limitFrames)) : clip.frames ? Math.min(total, clip.frames) : total;   // clip.frames: a clip that plays only inside a window
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
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
      videos: Object.fromEntries(videos.map(v => [v.key, v])), audio, tempo, root: pathToFileURL(ROOT).href,
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
    const OUT = outDir(clip);
    fs.mkdirSync(OUT, {recursive: true});
    if (clip.still) {
      const t0 = Date.now(), png = path.join(OUT, clip.id + '.png');
      await page.evaluate(t => window.render(t), (clip.opts || {}).stillAt || 0);
      await page.screenshot({path: png});
      console.log(`${clip.id}: still ${clip.w}x${clip.h} -> ${path.relative(ROOT, png)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
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
    // sidecar: what the clip was captured from (check-screens.py compares it with the cut: stale moves, missing tempo)
    if (clip.shot) fs.writeFileSync(out.replace(/\.mp4$/, '.capture.json'), JSON.stringify({id: clip.id, shot: clip.shot, frames,
      motion: motionKey(clip.shot), audio: !!clip.audio, tempo: tempo ? {beats: tempo.beats?.length || 0, first: tempo.first, bpm: tempo.bpm, source: tempo.source || null} : null,
      spectrum: audio ? (audio.filmStart ?? true) : null, twin: TWIN && clip.scene === 'ch01' ? path.relative(ROOT, TWIN) : null, at: new Date().toISOString()}, null, 1));
    console.log(`${clip.id}: ${frames} frames ${clip.w}x${clip.h} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } finally {
    if (ff && ff.exitCode === null && !ff.stdin.writableEnded) ff.stdin.end();
    await browser.close();
  }
}

for (const clip of clips) await renderClip(clip);
