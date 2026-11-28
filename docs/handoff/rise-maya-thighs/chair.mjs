// node chair.mjs dump.json chair-probe.json [partRegex]: per frame, min distance of Maya's LBS skin (arms, hands, head, neck,
// upper back) to the chair parts' triangles (Maya frame, from the render probe), by body group; the overall minimum.
import fs from 'node:fs';
import { loadModel, skinMats, skinVerts } from './lib.mjs';
const [dumpF, probeF, reA = 'chair|leap|steelcase|headrest|seat|back'] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(dumpF, 'utf8')), pr = JSON.parse(fs.readFileSync(probeF, 'utf8'));
const parts = pr.parts.filter(p => new RegExp(reA, 'i').test(p.name + ' ' + p.mat) && !p.skinned);
console.log('chair parts:', parts.map(p => p.name.split(' < ')[0] + '[' + p.n + ']').join(', '));
const T = []; for (const p of parts) for (let i = 0; i < p.tris.length; i += 9) T.push(p.tris.slice(i, i + 9));
const cell = .03, grid = new Map(); T.forEach((t, k) => { const mn = [0, 1, 2].map(c => Math.min(t[c], t[c + 3], t[c + 6])), mx = [0, 1, 2].map(c => Math.max(t[c], t[c + 3], t[c + 6]));
  for (let x = Math.floor(mn[0] / cell); x <= Math.floor(mx[0] / cell); x++) for (let y = Math.floor(mn[1] / cell); y <= Math.floor(mx[1] / cell); y++) for (let z = Math.floor(mn[2] / cell); z <= Math.floor(mx[2] / cell); z++) { const key = x + ',' + y + ',' + z; (grid.get(key) || grid.set(key, []).get(key)).push(k); } });
function cp(p, t) { const a = t.slice(0, 3), b = t.slice(3, 6), c = t.slice(6, 9); const sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a; const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; } const cq = sub(p, c), d5 = dot(ab, cq), d6 = dot(ac, cq); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; } const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; } const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
const near = (p, R = .06) => { let best = R; const r = Math.ceil(R / cell), cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell), seen = new Set();
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) for (const t of grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)) || []) { if (seen.has(t)) continue; seen.add(t); const q = cp(p, T[t]); const dd = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (dd < best) best = dd; } return best; };
const model = await loadModel('people-maya-sit-type');
const OFF = [[12, -.4035], [12.25, -.358], [12.5, -.355], [12.75, -.3547], [13, -.3166], [13.25, -.2169], [13.5, -.1039], [13.75, -.0141], [14, 0], [99, 0]]; const off = t => { if (t <= OFF[0][0]) return OFF[0][1]; for (let i = 1; i < OFF.length; i++) if (t <= OFF[i][0]) { const [a, x] = OFF[i - 1], [b, y] = OFF[i]; return x + (y - x) * (t - a) / (b - a); } return 0; };  // chair z in Maya's frame (chairhl.mjs)
const GROUP = b => /^(hand|thumb|index|middle|ring|pinky)/.test(b) ? 'hand' : /^lowerarm/.test(b) ? 'fore' : /^upperarm/.test(b) ? 'upper' : /^(head|neck)/.test(b) ? 'head' : null;
const idx = []; model.dom.forEach((b, i) => { if (GROUP(b)) idx.push(i); });
let worst = { d: 1 }; const per = {};
for (const r of d.rows) { if (!r.bones) continue; const X = skinVerts(model, skinMats(model, r.bones), idx); let fm = 1, fg = null;
  idx.forEach((vi, k) => { const dd = near([X[k * 6], X[k * 6 + 1], X[k * 6 + 2] - off(r.t)]); const g = GROUP(model.dom[vi]); if (dd < (per[g]?.d ?? 1)) per[g] = { d: dd, t: r.t, b: model.dom[vi] }; if (dd < fm) { fm = dd; fg = model.dom[vi]; } });
  if (fm < worst.d) worst = { d: fm, t: r.t, b: fg }; }
console.log('frames', d.rows.length, 'min clearance to chair', (worst.d * 1000).toFixed(1), 'mm', worst.b, '@' + worst.t?.toFixed(3), '(60 mm search cap)');
for (const [g, v] of Object.entries(per)) console.log(' ', g, (v.d * 1000).toFixed(1), 'mm', v.b, '@' + v.t.toFixed(3));
