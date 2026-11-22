// usage: node analyze.mjs <shot-or-plan.json> <out.csv> [--rebake] [--label name]
// Reads {seconds, cameraPlan, camera?}. With --rebake (or no camera) bakes cameraPlan with the repo's camera-spline.mjs
// (on a temp copy), then samples the baked keys exactly as the render does (frame n of N at t = n/(N-1), linear between
// baked keys, 'hold' = stay) at 30 fps and writes per-frame motion numbers + a summary line (JSON) on stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SPLINE = fileURLToPath(new URL('../../../tools/experience/camera-spline.mjs', import.meta.url));      // the repo's own bake
const argv = process.argv.slice(2), file = argv[0], out = argv[1], rebake = argv.includes('--rebake');
const label = argv.includes('--label') ? argv[argv.indexOf('--label') + 1] : path.basename(file);
let shot = JSON.parse(fs.readFileSync(file, 'utf8'));
if (shot.shots) shot = shot.shots.find(s => s.id === 'create') || shot.shots[0];
if (rebake || !shot.camera) {
  const tmp = path.join(os.tmpdir(), 'fixB-an-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify({ seconds: shot.seconds, cameraPlan: shot.cameraPlan }));
  execFileSync('node', [SPLINE, tmp], { stdio: 'ignore' });
  shot.camera = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; fs.unlinkSync(tmp);
}
const T = shot.seconds, fps = 30, N = Math.max(2, Math.round(T * fps)), keys = shot.camera.keys;
function sample(t) {
  if (t <= keys[0].time) return keys[0].view;
  const i = keys.findIndex(k => k.time > t); if (i < 0) return keys.at(-1).view;
  const a = keys[i - 1], b = keys[i], p = (t - a.time) / (b.time - a.time), u = a.easing === 'hold' ? 0 : a.easing === 'linear' ? p : p * p * (3 - 2 * p);
  const L = (x, y) => x.map((v, j) => v + (y[j] - v) * u);
  return { position: L(a.view.position, b.view.position), target: L(a.view.target, b.view.target), fov: a.view.fov + (b.view.fov - a.view.fov) * u };
}
const cutTimes = (shot.cameraPlan?.keys || []).filter(k => k.cut).map(k => k.at);
const F = [];
for (let n = 0; n < N; n++) { const v = sample(n / (N - 1)); F.push({ n, s: n / fps, ...v }); }
const sub = (a, b) => a.map((v, i) => v - b[i]), len = a => Math.hypot(...a), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const dir = f => { const d = sub(f.target, f.position), l = len(d); return d.map(v => v / l); };
const dt = 1 / fps;
// a frame pair that straddles a cut is not motion
const isCut = n => cutTimes.some(c => F[n - 1].s < c - 1e-6 && F[n].s >= c - 1e-6);
for (let n = 0; n < N; n++) {
  const f = F[n]; f.cut = n > 0 && isCut(n);
  if (n === 0 || f.cut) { f.v = [0, 0, 0]; f.speed = 0; f.ang = 0; f.fovRate = 0; f.fresh = true; continue; }
  const p = F[n - 1];
  f.v = sub(f.position, p.position).map(x => x / dt); f.speed = len(f.v);
  f.ang = Math.acos(Math.max(-1, Math.min(1, dot(dir(f), dir(p))))) * 180 / Math.PI / dt;
  const d0 = dir(p), d1 = dir(f);
  f.yawRate = (Math.atan2(Math.sin(Math.atan2(d1[0], d1[2]) - Math.atan2(d0[0], d0[2])), Math.cos(Math.atan2(d1[0], d1[2]) - Math.atan2(d0[0], d0[2])))) * 180 / Math.PI / dt;
  f.pitchRate = (Math.asin(d1[1]) - Math.asin(d0[1])) * 180 / Math.PI / dt;
  f.fovRate = (f.fov - p.fov) / dt;
  f.tspeed = len(sub(f.target, p.target)) / dt;
}
for (let n = 0; n < N; n++) {
  const f = F[n], p = F[n - 1];
  if (n === 0 || f.fresh || p.fresh && false) { f.acc = 0; f.angAcc = 0; continue; }
  if (p.fresh) { f.acc = 0; f.angAcc = 0; continue; }
  f.acc = len(sub(f.v, p.v)) / dt; f.sAcc = (f.speed - p.speed) / dt; f.angAcc = (f.ang - p.ang) / dt;
}
for (let n = 0; n < N; n++) { const f = F[n], p = F[n - 1]; f.jerk = n < 2 || f.fresh || p.fresh || F[n - 2].fresh ? 0 : Math.abs((f.sAcc || 0) - (p.sAcc || 0)) / dt; }
// 5-frame smoothed (what the eye reads; the baked polyline's 15 Hz facets are in the raw numbers)
const sm = (k, n) => { let s = 0, c = 0; for (let j = n - 2; j <= n + 2; j++) if (F[j] && !F[j].fresh) { s += F[j][k] || 0; c++; } return c ? s / c : 0; };
for (let n = 0; n < N; n++) { F[n].speedS = sm('speed', n); F[n].angS = sm('ang', n); F[n].yawS = sm('yawRate', n); }
for (let n = 1; n < N; n++) { const f = F[n], p = F[n - 1]; f.accS = f.fresh || p.fresh ? 0 : (f.speedS - p.speedS) / dt; f.angAccS = f.fresh || p.fresh ? 0 : (f.angS - p.angS) / dt; } F[0].accS = 0; F[0].angAccS = 0;
// direction changes: travel direction reverses (velocity heading turns more than 90 deg within 0.5 s while moving) and yaw-rate sign flips
let reversals = [], yawFlips = [], stops = [];
const moving = f => f.speedS > 0.05;
for (let n = 16; n < N; n++) {
  const a = F[n - 15], b = F[n]; if (a.fresh || b.fresh || !moving(a) || !moving(b)) continue;
  let cut = false; for (let j = n - 15; j <= n; j++) if (F[j].cut) cut = true; if (cut) continue;
  const c = dot(a.v, b.v) / (len(a.v) * len(b.v)); if (c < 0 && !(reversals.length && b.s - reversals.at(-1) < 1)) reversals.push(+b.s.toFixed(2));
}
let lastSign = 0;
for (let n = 1; n < N; n++) { const f = F[n]; if (f.fresh) { lastSign = 0; continue; } if (Math.abs(f.yawS) < 1.5) continue; const s = Math.sign(f.yawS); if (lastSign && s !== lastSign) yawFlips.push(+f.s.toFixed(2)); lastSign = s; }
// stops: camera at rest (< 0.02 m/s and < 0.3 deg/s) for 3+ frames between moving stretches
let run = null;
for (let n = 1; n < N; n++) { const f = F[n], still = !f.fresh && f.speed < 0.02 && f.ang < 0.3; if (still) { run = run || { from: f.s, to: f.s }; run.to = f.s; } else { if (run && run.to - run.from >= 2 / fps) stops.push([+run.from.toFixed(2), +run.to.toFixed(2)]); run = null; } }
if (run && run.to - run.from >= 2 / fps) stops.push([+run.from.toFixed(2), +run.to.toFixed(2)]);
const max = k => { let m = F[0]; for (const f of F) if (Math.abs(f[k] || 0) > Math.abs(m[k] || 0)) m = f; return [+Math.abs(m[k] || 0).toFixed(3), +m.s.toFixed(2)]; };
let dist = 0; for (const f of F) dist += f.speed * dt;
const cols = ['n', 's', 'px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov', 'speed', 'acc', 'sAcc', 'jerk', 'ang', 'angAcc', 'yawRate', 'pitchRate', 'fovRate', 'tspeed', 'speedS', 'angS', 'accS', 'angAccS', 'cut'];
fs.writeFileSync(out, cols.join(',') + '\n' + F.map(f => [f.n, f.s.toFixed(4), ...f.position.map(x => x.toFixed(4)), ...f.target.map(x => x.toFixed(4)), f.fov.toFixed(3), ...['speed', 'acc', 'sAcc', 'jerk', 'ang', 'angAcc', 'yawRate', 'pitchRate', 'fovRate', 'tspeed', 'speedS', 'angS', 'accS', 'angAccS'].map(k => (f[k] || 0).toFixed(4)), f.cut ? 1 : 0].join(',')).join('\n') + '\n');
console.log(JSON.stringify({ label, seconds: T, frames: N, bakedKeys: keys.length, storyKeys: shot.cameraPlan?.keys?.length, pathMetres: +dist.toFixed(2),
  peakSpeed_mps: max('speed'), peakSpeed5f: max('speedS'), peakAccel_mps2: max('sAcc'), peakAccel5f: max('accS'), peakJerk_mps3: max('jerk'),
  peakAngular_dps: max('ang'), peakAngular5f: max('angS'), peakAngAccel_dps2: max('angAcc'), peakAngAccel5f: max('angAccS'), peakFovRate_dps: max('fovRate'),
  travelReversals_s: reversals, yawFlips_s: yawFlips, stops_s: stops }, null, 1));
