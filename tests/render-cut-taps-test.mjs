// render-cut.cjs bakes only the sub-frames its shutter keeps (tools/experience/render-shutter.cjs, S29).
// Node only, no browser: models ffmpeg's tmix + select on sub-frame indices and checks that every output frame of the
// new path blends EXACTLY the sub-frames (and so the chapter times) the old path blended, for whole chapters and
// renderRange windows, first and last frames included.
//   node tests/render-cut-taps-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { shutterPlan } = require('../tools/experience/render-shutter.cjs');

// ffmpeg tmix=frames=F: the frame at stream index i blends i-F+1 .. i; before the window is full it is filled with
// copies of the stream's first frame (checked with ffmpeg 9.0.2: frames 0,40,80,... through tmix=frames=4 give
// 0,10,30,60,..., i.e. (0+0+0+40)/4 at index 1). Returns each output frame's sorted list of stream values.
function ffmpegBlend(stream, frames, keep) {
  const out = [];
  stream.forEach((_, i) => {
    if (!keep(i)) return;
    const group = []; for (let j = i - frames + 1; j <= i; j++) group.push(stream[Math.max(0, j)]);
    out.push(group.sort((a, b) => a - b));
  });
  return out;
}
// The path before S29 (render-cut.cjs at 581ab498, lines 149-163): bake n = 0 .. (outFrames-1)*sub, then
// tmix=frames=open and select=not(mod(n,sub)) (no filter at all for sub 1).
function oldPath(outFrames, blur) {
  const sub = Math.max(1, Number(blur) | 0), total = (outFrames - 1) * sub + 1, open = Math.max(1, Math.round(sub / 2));
  const stream = Array.from({ length: total }, (_, n) => n);
  return { sub, baked: total, frames: sub > 1 ? ffmpegBlend(stream, open, i => i % sub === 0) : stream.map(n => [n]) };
}
// The new path: bake plan.order, then plan.vf (tmix=frames=open, select=eq(mod(n,open),open-1)), or no filter.
function newPath(outFrames, blur) {
  const p = shutterPlan(outFrames, blur);
  if (p.open > 1) {
    assert.deepEqual(p.vf, [`tmix=frames=${p.open}:weights=${Array(p.open).fill(1).join(' ')}`, `select=eq(mod(n\\,${p.open})\\,${p.open - 1})`]);
    return { ...p, baked: new Set(p.order).size, frames: ffmpegBlend(p.order, p.open, i => i % p.open === p.open - 1) };
  }
  assert.deepEqual(p.vf, []);
  return { ...p, baked: p.order.length, frames: p.order.map(n => [n]) };
}
const fps = 30;
// chapter seconds of each output frame's sub-frames, as render-cut samples them: (n0+n)/(fps*sub), n0 from renderRange
const times = (frames, sub, range) => { const n0 = range ? Math.round(range[0] * fps) * sub : 0; return frames.map(g => g.map(n => (n0 + n) / (fps * sub))); };
const outFramesOf = (seconds, range) => range ? Math.max(2, Math.round((range[1] - range[0]) * fps)) : Math.max(2, Math.round(seconds * fps));

let checks = 0;
for (const blur of [1, 2, 3, 4, 8, 16]) for (const [seconds, range] of [[24.978, null], [12, null], [0.05, null], [24.978, [2.2, 5.6]], [48, [40.5, 48]], [16, [0, 0.1]]]) {
  const outFrames = outFramesOf(seconds, range), a = oldPath(outFrames, blur), b = newPath(outFrames, blur), what = `blur ${blur} ${range ? 'range ' + range : seconds + ' s'}`;
  assert.equal(b.frames.length, outFrames, `${what}: one output frame per film frame`);
  assert.equal(a.frames.length, outFrames, `${what}: the old path made one output frame per film frame too`);
  assert.deepEqual(b.frames, a.frames, `${what}: every frame blends the same sub-frames as before`);
  assert.deepEqual(times(b.frames, b.sub, range), times(a.frames, a.sub, range), `${what}: the same chapter times`);
  // the edges: frame 0 is sub-frame 0 alone (repeated `open` times), the last frame ends on the last sub-frame the old path baked
  assert.ok(b.frames[0].every(n => n === 0), `${what}: frame 0 is the bare first sub-frame`);
  assert.equal(b.frames.at(-1).at(-1), a.baked - 1, `${what}: the last frame ends on the old path's last sub-frame`);
  // cost: only the kept sub-frames are baked (frame 0's repeats once)
  assert.equal(b.baked, 1 + (outFrames - 1) * b.open, `${what}: bakes ${b.baked}`);
  assert.ok(b.order.every(n => n >= 0 && n <= a.baked - 1), `${what}: no sub-frame outside the old range`);
  checks++;
}
// the numbers the film uses: 30 fps, blur 4 = 2 taps 1/120 s apart; blur 8 = 4 taps 1/240 s apart (12.5 ms span)
{ const p = shutterPlan(3, 4); assert.equal(p.open, 2); assert.deepEqual(p.order, [0, 0, 3, 4, 7, 8]); }
{ const p = shutterPlan(3, 8); assert.equal(p.open, 4); assert.deepEqual(p.order, [0, 0, 0, 0, 5, 6, 7, 8, 13, 14, 15, 16]); }
{ const p = shutterPlan(3, 1); assert.equal(p.open, 1); assert.deepEqual(p.order, [0, 1, 2]); }
// render-cut.cjs uses the plan (and no longer builds its own tmix/select)
const src = fs.readFileSync(new URL('../tools/experience/render-cut.cjs', import.meta.url), 'utf8');
assert.match(src, /require\('\.\/render-shutter\.cjs'\)/);
assert.match(src, /shutterPlan\(outFrames,blur\)/);
assert.doesNotMatch(src, /select=not\(mod/);
console.log(`render-cut taps: ${checks} cases, every frame blends the same sub-frames as the old path (open of every sub baked)`);
