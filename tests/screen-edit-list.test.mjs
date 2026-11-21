// Screen edit list (docs/screen-edit-list/CONTRACT.md): the composer (tools/experience/compose-screen-edit.mjs) and the
// cache key (tools/experience/chapter-keys.py).   node --test tests/screen-edit-list.test.mjs
// Synthetic sources only (ffmpeg lavfi in a temp dir): every source frame carries its own index in its colour
// (g = (n % 32) * 8, b = floor(n / 32) * 24) and its identity in red (A 220, B 40, C 130), so a composed frame can be
// checked numerically: which source, which source frame, how far through a blend.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {execFileSync, spawnSync} from 'child_process';
import {fileURLToPath} from 'url';
import {planTrack, applyScreenEdits, editTracks, ffmpegArgs, probe} from '../tools/experience/compose-screen-edit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-edl-'));
const FIX = path.join(ROOT, 'tests/fixtures/screen-edit-list');
const PY = process.env.PYTHON || (fs.existsSync('C:/Python312/python.exe') ? 'C:/Python312/python.exe' : 'python3');
test.after(() => fs.rmSync(TMP, {recursive: true, force: true}));

function source(name, red, seconds, {audio = false, w = 64, h = 36} = {}) {
  const out = path.join(TMP, 'src', name); fs.mkdirSync(path.dirname(out), {recursive: true});
  if (fs.existsSync(out)) return out;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=30:d=${seconds}`,
    ...(audio ? ['-f', 'lavfi', '-i', `sine=f=440:d=${seconds}`] : []),
    '-vf', `format=gbrp,geq=r=${red}:g='mod(N,32)*8':b='floor(N/32)*24'`, '-c:v', 'libx264', '-crf', '0', '-pix_fmt', 'yuv444p', '-g', '10',
    ...(audio ? ['-c:a', 'aac', '-shortest'] : []), out]);
  return out;
}
const A = () => source('a.mp4', 220, 10), B = () => source('b.mp4', 40, 10), C = () => source('c.mp4', 130, 10);
const rel = f => path.relative(TMP, f).split(path.sep).join('/');
// mean RGB of every frame
function frames(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=8:8:flags=area,format=rgb24', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 28});
  const out = []; for (let o = 0; o + 192 <= raw.length; o += 192) { let r = 0, g = 0, b = 0; for (let p = 0; p < 64; p++) { r += raw[o + 3 * p]; g += raw[o + 3 * p + 1]; b += raw[o + 3 * p + 2]; } out.push([r / 64, g / 64, b / 64]); }
  return out;
}
const index = ([, g, b]) => Math.round(b / 24) * 32 + Math.round(g / 8);
const ident = ([r]) => Math.abs(r - 220) < 8 ? 'A' : Math.abs(r - 40) < 8 ? 'B' : Math.abs(r - 130) < 8 ? 'C' : '?';
const infoOf = src => probe(path.join(TMP, src));

test('a plain screens list (no transitionIn) is not an edit list and comes back as the same object', async () => {
  const old = JSON.parse(fs.readFileSync(path.join(FIX, 'media-ch10-today.json'), 'utf8'));
  assert.equal(editTracks(old).length, 0);
  assert.equal(await applyScreenEdits(old, {root: TMP}), old);
  const split = {id: 'x', seconds: 10, screens: [{target: 'tv', src: 'a.mp4', start: 0, end: 4}, {target: 'tv', src: 'a.mp4', start: 4, end: 10, offset: 6}]};
  assert.equal(await applyScreenEdits(split, {root: TMP}), split);
  assert.equal(await applyScreenEdits({id: 'y', seconds: 3}, {root: TMP}).then(s => s.screens), undefined);
});

test('plan: frame lengths, dissolve head-handle clamping, dip halves, first-clip and gap rules', () => {
  A(); B(); C();
  const p = planTrack([
    {target: 'tv', src: 'src/a.mp4', start: 0, end: 2, offset: 1},
    {target: 'tv', src: 'src/b.mp4', start: 2, end: 4, offset: 0.4, transitionIn: {type: 'dissolve', dur: 1}},   // handle 0.4 s -> 12 frames
    {target: 'tv', src: 'src/c.mp4', start: 4, end: 5, offset: 0, transitionIn: {type: 'dissolve', dur: 0.5}},    // no handle -> cut
    {target: 'tv', src: 'src/a.mp4', start: 5, end: 5.5, offset: 2, transitionIn: {type: 'dip', dur: 2, color: '#ffffff'}},   // 0.5 s clip: halves clamp to 15 frames
    {target: 'tv', src: 'src/b.mp4', start: 6, end: 7, offset: 1, transitionIn: {type: 'dissolve', dur: 0.5}},    // after a gap -> cut
  ], {seconds: 17, info: infoOf, label: 'tv'});
  assert.deepEqual(p.clips.map(c => c.len), [60, 60, 30, 15, 30]);
  assert.deepEqual(p.clips.map(c => c.transition), ['cut', 'dissolve', 'cut', 'dip', 'cut']);
  assert.equal(p.clips[1].xIn, 12);
  assert.equal(p.clips[3].dipIn, 15); assert.equal(p.clips[2].dipOut, 30); assert.equal(p.clips[3].dipInColor, '#ffffff');
  assert.deepEqual(p.runs.map(r => [r.start, r.end]), [[0, 5.5], [6, 7]]);
  assert.equal(p.endF - p.startF, 210);
  const rep = p.report.join('\n');
  assert.match(rep, /clip 2: dissolve 1\.00 s -> 0\.40 s \(head handle/);
  assert.match(rep, /clip 3: dissolve 0\.50 s -> cut/);
  assert.match(rep, /clip 4: dip 2\.00 s -> out 1\.00 s \+ in 0\.50 s/);
  assert.match(rep, /clip 5: dissolve 0\.50 s -> cut \(a gap before it/);
  // a dissolve never eats into the frames the outgoing clip's own dip-in uses
  const q = planTrack([
    {src: 'src/a.mp4', start: 0, end: 1, offset: 0},
    {src: 'src/b.mp4', start: 1, end: 1.5, offset: 0, transitionIn: {type: 'dip', dur: 0.6}},   // b fades in over 9 frames of its 15
    {src: 'src/c.mp4', start: 1.5, end: 3, offset: 5, transitionIn: {type: 'dissolve', dur: 2}}, // wants 60, b has 15 - 9 = 6 free
  ], {seconds: 3, info: infoOf, label: 'x'});
  assert.equal(q.clips[1].dipIn, 9); assert.equal(q.clips[2].xIn, 6);
  assert.throws(() => planTrack([{src: 'src/a.mp4', start: 0, end: 2}, {src: 'src/b.mp4', start: 1.5, end: 3, transitionIn: {type: 'cut'}}], {seconds: 3, info: infoOf}), /overlap/);
  // loop:false past the source end is reported as a frozen hold; loop wraps
  const h = planTrack([{src: 'src/a.mp4', start: 0, end: 4, offset: 8, loop: false, transitionIn: {type: 'cut'}}], {seconds: 4, info: infoOf, label: 'h'});
  assert.equal(h.clips[0].hold, 60); assert.match(h.report.join('\n'), /HOLDS ITS LAST FRAME for 60 frames/);
  const l = planTrack([{src: 'src/a.mp4', start: 0, end: 4, offset: 8, transitionIn: {type: 'cut'}}], {seconds: 4, info: infoOf, label: 'l'});
  assert.equal(l.clips[0].loopSrc, true); assert.equal(l.clips[0].hold, 0);
});

test('compose: cut, dissolve and dip land on the right source frames; no black or frozen frames outside the dip', async () => {
  A(); B(); C();
  const shot = {id: 'media', seconds: 8, screens: [
    {target: 'main-landscape', src: 'src/a.mp4', start: 0, end: 2, offset: 1, brightness: 0.9},
    {target: 'main-landscape', src: 'src/b.mp4', start: 2, end: 4, offset: 3, transitionIn: {type: 'dissolve', dur: 1}},
    {target: 'main-landscape', src: 'src/c.mp4', start: 4, end: 6, offset: 0.5, rate: 2, transitionIn: {type: 'dip', dur: 0.6, color: '#000000'}},
    {target: 'main-landscape', src: 'src/a.mp4', start: 6, end: 7, offset: 0, transitionIn: {type: 'cut'}},
    {target: 'tablet', src: 'src/c.mp4', offset: 0}]};
  const logs = [], next = await applyScreenEdits(shot, {root: TMP, outDir: 'out', log: l => logs.push(l)});
  // the track becomes one run entry; the other target is untouched and keeps its place
  assert.equal(next.screens.length, 2); assert.equal(next.screens[1], shot.screens[4]);
  const e = next.screens[0];
  assert.match(e.src, /^out\/media-main-landscape-[0-9a-f]{12}\.mp4$/);
  assert.deepEqual({start: e.start, end: e.end, offset: e.offset, rate: e.rate, loop: e.loop, brightness: e.brightness, target: e.target}, {start: 0, end: 7, offset: 0, rate: 1, loop: false, brightness: 0.9, target: 'main-landscape'});
  assert.equal(e.transitionIn, undefined);
  const file = path.join(TMP, e.src), f = frames(file);
  assert.equal(f.length, 210, 'composed length = 7 s at 30 fps');
  const i = probe(file); assert.equal(i.w, 64); assert.equal(i.h, 36); assert.equal(Math.round(i.fps), 30); assert.equal(i.audio, false);
  // A: frames 0..29 = source 30..59 (offset 1 s); untouched by the dissolve until frame 30
  for (let n = 0; n < 30; n++) { assert.equal(ident(f[n]), 'A', `frame ${n}`); assert.equal(index(f[n]), 30 + n, `frame ${n} source index`); }
  // dissolve 30..59: red goes from A to B monotonically, never dark; B continues exactly at its in point from frame 60
  for (let n = 30; n < 60; n++) {
    assert.ok(f[n][0] <= f[n - 1][0] + 1.5, `dissolve frame ${n} red ${f[n][0]} after ${f[n - 1][0]}`);
    assert.ok(f[n][0] > 40 && f[n][0] < 220, `dissolve frame ${n} is a blend (${f[n][0]})`);
    assert.ok(f[n][0] + f[n][1] + f[n][2] > 60, `dissolve frame ${n} not black`);
  }
  const mid = f[45][0]; assert.ok(Math.abs(mid - 130) < 20, `mid-dissolve red ${mid} is about halfway`);
  for (let n = 60; n < 120 - 9; n++) { assert.equal(ident(f[n]), 'B', `frame ${n}`); assert.equal(index(f[n]), 90 + n - 60, `frame ${n} B source index`); }
  // dip 0.6 s: B fades out over its last 9 frames (111..119), C fades in from black over 120..128; frame 120 is black
  for (let n = 111; n < 120; n++) assert.ok(f[n][0] < f[n - 1][0] + 1 && f[n][0] > 2, `dip out frame ${n} ${f[n][0]}`);
  assert.ok(f[120].every(v => v < 4), `the dip's own frame is black: ${f[120]}`);
  for (let n = 121; n < 129; n++) assert.ok(f[n][0] > f[n - 1][0] - 1, `dip in frame ${n}`);
  // C at rate 2: source frame 15 + 2k, every frame a new one
  for (let n = 129; n < 180; n++) { assert.equal(ident(f[n]), 'C', `frame ${n}`); assert.equal(index(f[n]), 15 + 2 * (n - 120), `frame ${n} C index (rate 2)`); }
  // a plain cut back to A at its frame 0
  for (let n = 180; n < 210; n++) { assert.equal(ident(f[n]), 'A'); assert.equal(index(f[n]), n - 180); }
  // no frozen frames: outside the dip, consecutive frames always differ
  for (let n = 1; n < 210; n++) if (n < 111 || n > 129) assert.ok(f[n].some((v, c) => Math.abs(v - f[n - 1][c]) > 2), `frame ${n} repeats frame ${n - 1}`);
  // cached: same list -> same file, not recomposed; the report sidecar is there
  const again = await applyScreenEdits(shot, {root: TMP, outDir: 'out', log: () => {}});
  assert.equal(again.screens[0].src, e.src); assert.equal(again.__screenEdits[0].made, false);
  assert.ok(fs.existsSync(file.replace(/\.mp4$/, '.json')));
  assert.ok(logs.some(l => /dissolve/.test(l)));
});

test('compose: gaps split the track into runs that point into one file; the gap is never shown', async () => {
  A(); B();
  const shot = {id: 'g', seconds: 6, screens: [
    {target: 'tv', src: 'src/a.mp4', start: 0.5, end: 2, offset: 0, transitionIn: {type: 'dip', dur: 0.4, color: '#ffffff'}},
    {target: 'tv', src: 'src/b.mp4', start: 3, end: 5, offset: 2}]};
  const next = await applyScreenEdits(shot, {root: TMP, outDir: 'out', log: () => {}});
  assert.deepEqual(next.screens.map(s => [s.start, s.end, s.offset]), [[0.5, 2, 0], [3, 5, 2.5]]);
  assert.equal(next.screens[0].src, next.screens[1].src);
  const f = frames(path.join(TMP, next.screens[0].src));
  assert.equal(f.length, 135);
  assert.ok(f[0].every(v => v > 240), 'fades up from white');
  assert.equal(ident(f[30]), 'A');
  // run 2 starts at file second 2.5 = frame 75: B at its in point (source frame 60)
  assert.equal(ident(f[75]), 'B'); assert.equal(index(f[75]), 60);
});

test('compose: audio only when asked and every source has it; rate changes keep the length', async () => {
  const a = source('sa.mp4', 220, 6, {audio: true}), b = source('sb.mp4', 40, 6, {audio: true});
  const shot = {id: 'au', seconds: 4, screens: [
    {target: 'tv', src: 'src/sa.mp4', start: 0, end: 2, offset: 1, compose: {audio: true}},
    {target: 'tv', src: 'src/sb.mp4', start: 2, end: 4, offset: 1, rate: 1.5, transitionIn: {type: 'dissolve', dur: 0.5}}]};
  const next = await applyScreenEdits(shot, {root: TMP, outDir: 'out', log: () => {}});
  const file = path.join(TMP, next.screens[0].src), i = probe(file);
  assert.equal(i.audio, true); assert.ok(Math.abs(i.duration - 4) < 0.05, `duration ${i.duration}`);
  assert.equal(frames(file).length, 120);
  const silent = {...shot, screens: shot.screens.map((s, k) => k ? s : {...s, compose: undefined})};
  delete silent.screens[0].compose;
  const n2 = await applyScreenEdits(silent, {root: TMP, outDir: 'out', log: () => {}});
  assert.equal(probe(path.join(TMP, n2.screens[0].src)).audio, false);
});

test('fixture: the chapter 10 sample edit list plans (3 clips, a dissolve and a dip) against a 100 s stand-in movie', () => {
  const movie = source('movie.mp4', 220, 100, {w: 128, h: 72});
  const shot = JSON.parse(fs.readFileSync(path.join(FIX, 'media-ch10.json'), 'utf8'));
  const t = editTracks(shot); assert.equal(t.length, 1); assert.equal(t[0].entries.length, 3);
  const p = planTrack(t[0].entries, {seconds: shot.seconds, info: () => probe(movie), label: 'media'});
  assert.deepEqual(p.clips.map(c => c.transition), ['cut', 'dissolve', 'dip']);
  assert.equal(p.clips[1].xIn, 30); assert.equal(p.clips[2].dipIn, 12); assert.equal(p.clips[1].dipOut, 12);
  assert.equal(p.endF - p.startF, Math.round(shot.seconds * 30)); assert.deepEqual(p.report, []);
  assert.ok(ffmpegArgs(p, 'x.mp4', {root: TMP}).includes('-an'));
});

// ---- cache key ----------------------------------------------------------------------------------------------------------
function keys(script, hqRel, root) {
  const r = spawnSync(PY, [script, hqRel, '--json', '--resolution', '480p', '--root', root], {encoding: 'utf8'});
  if (r.status !== 0) throw Error(r.stderr); return JSON.parse(r.stdout).keys;
}
test('chapter key: no list = the key before this change; unchanged list = same key; edited list = new key for that chapter only', () => {
  const cut = path.join(ROOT, 'exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json');
  const base = JSON.parse(fs.readFileSync(cut, 'utf8'));
  const root = path.join(TMP, 'keys'), hq = path.join(root, 'exports/hq'); fs.mkdirSync(hq, {recursive: true});
  const write = d => fs.writeFileSync(path.join(hq, 'review-cut.json'), JSON.stringify(d));
  // the chapter-keys.py of the commit before the screen edit list, next to its own render-epoch.txt
  const oldDir = path.join(TMP, 'old-keys'); fs.mkdirSync(oldDir, {recursive: true});
  const show = rev => execFileSync('git', ['-C', ROOT, 'show', rev], {maxBuffer: 1 << 26});

  const parent = execFileSync('git', ['-C', ROOT, 'merge-base', 'HEAD', 'origin/video/cinematic-intro-hq']).toString().trim();
  fs.writeFileSync(path.join(oldDir, 'chapter-keys.py'), show(`${parent}:tools/experience/chapter-keys.py`));
  fs.copyFileSync(path.join(ROOT, 'tools/experience/render-epoch.txt'), path.join(oldDir, 'render-epoch.txt'));
  const hqRel = 'exports/hq', now = path.join(ROOT, 'tools/experience/chapter-keys.py'), old = path.join(oldDir, 'chapter-keys.py');
  const drop = d => ({...d, shots: d.shots.filter(s => s.id !== 'awaken' && s.id !== 'hero')});   // (awaken / hero read other files)
  write(drop(base));
  const k0 = keys(now, hqRel, root), kOld = keys(old, hqRel, root);
  assert.deepEqual(k0, kOld, 'no edit list: every key identical to the script before this change');
  const sample = JSON.parse(fs.readFileSync(path.join(FIX, 'media-ch10.json'), 'utf8'));
  const withList = structuredClone(drop(base)); withList.shots.find(s => s.id === 'media').screens = sample.screens;
  write(withList); const k1 = keys(now, hqRel, root);
  write(withList); const k1b = keys(now, hqRel, root);
  assert.deepEqual(k1, k1b, 'unchanged list -> same keys');
  for (const id of Object.keys(k0)) if (id !== 'media') assert.equal(k1[id], k0[id], `${id} untouched`);
  assert.notEqual(k1.media, k0.media);
  const edited = structuredClone(withList); edited.shots.find(s => s.id === 'media').screens[1].transitionIn.dur = 0.5;
  write(edited); const k2 = keys(now, hqRel, root);
  assert.notEqual(k2.media, k1.media, 'edited list -> new key'); for (const id of Object.keys(k0)) if (id !== 'media') assert.equal(k2[id], k0[id]);

});
