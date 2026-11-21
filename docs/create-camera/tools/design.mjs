// usage: node design.mjs <design.json> <out plan.json>
// design: { seconds, moves: [ { speed: [[t, w], ...], keys: [ {position, target, fov, label, at?} ... ] } ], tail: [plan keys kept as they are] }
// Each move's keys get their times from arc length: the camera-spline metric length up to the key (measured on a dense bake of the
// repo's own camera-spline.mjs) is laid on the integral of the move's relative speed curve `speed` (piecewise linear in chapter
// seconds, first t = move start, last t = move end). So the speed profile is authored and the keys' times follow from it.
// A key with its own "at" is pinned there (a story beat); the curve is then laid span by span between the pins, and the
// printed scale of each span (metres of metric per unit of curve) says how well the spans agree (equal = one continuous profile).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SPLINE = fileURLToPath(new URL('../../../tools/experience/camera-spline.mjs', import.meta.url));      // the repo's own bake
const [designF, outF] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(designF, 'utf8'));
const bake = plan => { const tmp = path.join(os.tmpdir(), 'fixB-d-' + process.pid + '.json'); fs.writeFileSync(tmp, JSON.stringify({ seconds: D.seconds, cameraPlan: plan })); execFileSync('node', [SPLINE, tmp], { stdio: 'ignore' }); const c = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; fs.unlinkSync(tmp); return c; };
const metric = (a, b) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]) + .5 * Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]);
const round = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
const keysOut = [];
for (const [mi, mv] of D.moves.entries()) {
  const t0 = mv.speed[0][0], t1 = mv.speed.at(-1)[0], n = mv.keys.length;
  // 1. geometry: lengths at the keys, from a dense bake with placeholder (even) times
  const tmpKeys = mv.keys.map((k, i) => ({ at: i / (n - 1) * D.seconds, position: k.position, target: k.target, fov: k.fov }));
  const dense = bake({ easeIn: false, easeOut: false, samples: 6000, keys: tmpKeys }).keys;
  const L = [0]; let acc = 0, ki = 1;
  for (let j = 1; j < dense.length; j++) {
    acc += metric(dense[j].view, dense[j - 1].view);
    while (ki < n && dense[j].time >= ki / (n - 1) - 1e-9) { L[ki] = acc; ki++; }
  }
  while (ki < n) { L[ki] = acc; ki++; }
  // 2. the speed curve's integral, piecewise linear w(t)
  const S = t => { let s = 0; for (let j = 1; j < mv.speed.length; j++) { const [a, wa] = mv.speed[j - 1], [b, wb] = mv.speed[j]; if (t <= a) break; const e = Math.min(t, b), we = wa + (wb - wa) * (e - a) / (b - a); s += (wa + we) / 2 * (e - a); } return s; };
  const pins = mv.keys.map((k, i) => i === 0 ? t0 : i === n - 1 ? t1 : Number.isFinite(k.at) ? k.at : null);
  const at = [...pins]; let a = 0; const scales = [];
  for (let b = 1; b < n; b++) {
    if (pins[b] === null) continue;
    const Sa = S(pins[a]), Sb = S(pins[b]), La = L[a], Lb = L[b];
    scales.push(`${pins[a]}-${pins[b]} s: ${((Lb - La) / (Sb - Sa)).toFixed(3)}`);
    for (let i = a + 1; i < b; i++) { const frac = (L[i] - La) / (Lb - La); let lo = pins[a], hi = pins[b]; for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if ((S(m) - Sa) / (Sb - Sa) < frac) lo = m; else hi = m; } at[i] = (lo + hi) / 2; }
    a = b;
  }
  mv.keys.forEach((k, i) => { keysOut.push({ at: round(at[i], 3), position: k.position, target: k.target, fov: k.fov, label: k.label }); });
  console.log(`move ${mi + 1}: ${t0}-${t1} s, ${n} keys, metric length ${L[n - 1].toFixed(2)}; span scales (metric per curve unit): ${scales.join(' | ')}`);
}
for (const k of D.tail || []) keysOut.push(k);
const plan = { easeIn: false, easeOut: false, keys: keysOut };
fs.writeFileSync(outF, JSON.stringify({ id: 'create', seconds: D.seconds, cameraPlan: plan }, null, 1));
const C = D.centre || [-1.37, 0.31];
for (const k of keysOut) { const dx = k.position[0] - C[0], dz = k.position[2] - C[1]; console.log(`${String(k.at).padStart(7)} s  pos (${k.position.map(v => v.toFixed(2)).join(', ')})  r ${Math.hypot(dx, dz).toFixed(2)} az ${(Math.atan2(dz, dx) * 180 / Math.PI).toFixed(1)}  aim (${k.target.map(v => v.toFixed(2)).join(', ')}) fov ${k.fov}${k.cut ? ' CUT' : ''}  ${k.label || ''}`); }
