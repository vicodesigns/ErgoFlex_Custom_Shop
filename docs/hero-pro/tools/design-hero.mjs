// usage: node design-hero.mjs <design.json> <vico hero shot.json (director-film/hero.json)> <out plan.json>
// Re-times Vico's hero camera path (his geometry, his end card) onto authored speed curves, and replaces his 1.0-1.8 s whip
// (3.7 m in 0.8 s) with an arc from his opening view to his orbit view.
//   design: { seconds, easeOut, arc: {to: <Vico time of the orbit view the arc joins, 1.8>, mid: [{f, az, r, h}] (optional
//             cylinder points around the desk, f = fraction of the arc)}, segments: [{t0, t1, v: [[t, m/s], ...]}, ...] (the
//             first segment covers the arc, the next ones Vico's path; each is scaled to its own length), keyEvery: s,
//             beats: [s, ...] (extra key times), aim: [{t0, t1, dy, ease}] (aim height offsets, metres, smoothstep ramps),
//             rest: s (the camera arrives here; keys after it hold), labels: {s: label} }
// The path: Vico's BAKED camera (what the render shows) from `arc.to` to his last key, by position arc length; before it a
// cylindrical arc (azimuth, radius, height around the desk) from his first key, aims and lens blended with smoothstep.
// Keys are placed every keyEvery seconds of the new timeline (plus beats), each at the arc length the speed curve reaches.
import fs from 'node:fs';
import { sampleBaked } from './pathinfo-lib.mjs';
const [designF, shotF, outF] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(designF, 'utf8'));
const shot = JSON.parse(fs.readFileSync(shotF, 'utf8'));
const VT = shot.seconds, vkeys = shot.camera.keys, plan = shot.cameraPlan.keys;
const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
// 1. Vico's path from arc.to to the end, dense
const tEnd = plan.at(-1).at, vico = [];
for (let t = D.arc.to; t <= tEnd + 1e-9; t += 1 / 300) vico.push(sampleBaked(vkeys, VT, Math.min(t, tEnd)));
// 2. the arc: cylinder coordinates around the desk (x = front, -z = left)
const cyl = p => ({ az: Math.atan2(-p[2], p[0]), r: Math.hypot(p[0], p[2]), h: p[1] });
const fromCyl = c => [c.r * Math.cos(c.az), c.h, -c.r * Math.sin(c.az)];
const A = plan[0], B = vico[0], ca = cyl(A.position), cb = cyl(B.position);
const pts = [{ f: 0, ...ca }, ...(D.arc.mid || []).map(m => ({ f: m.f, az: m.az * Math.PI / 180, r: m.r, h: m.h })), { f: 1, ...cb }];
const arcAt = f => {      // piecewise smooth (Catmull-like via smoothstep between points) on az / r / h
  let i = pts.findIndex(p => p.f >= f); if (i <= 0) i = 1;
  const a = pts[i - 1], b = pts[i], u = (f - a.f) / (b.f - a.f), ue = u;   // linear in f between cylinder points (the timing makes it smooth)
  return fromCyl({ az: a.az + (b.az - a.az) * ue, r: a.r + (b.r - a.r) * ue, h: a.h + (b.h - a.h) * ue });
};
const arc = [];
for (let j = 0; j <= 3000; j++) { const f = j / 3000, w = sm(Math.min(1, f * (D.arc.aimLead || 1))); arc.push({ position: arcAt(f), target: lerp(A.target, B.target, w), fov: A.fov + (B.fov - A.fov) * w }); }
// 3. one path, by position arc length
const path = [...arc, ...vico.slice(1)], S = [0];
for (let j = 1; j < path.length; j++) S.push(S[j - 1] + Math.hypot(...path[j].position.map((v, i) => v - path[j - 1].position[i])));
const Sarc = S[arc.length - 1], Stot = S.at(-1);
const at = s => { let lo = 0, hi = S.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m + 1; else hi = m; } const b = path[lo], a = path[Math.max(0, lo - 1)], u = lo > 0 && S[lo] > S[lo - 1] ? (s - S[lo - 1]) / (S[lo] - S[lo - 1]) : 0; return { position: lerp(a.position, b.position, u), target: lerp(a.target, b.target, u), fov: a.fov + (b.fov - a.fov) * u }; };
// Vico's time on his path for a given arc length (for labels / reporting)
const vicoTime = s => s <= Sarc ? null : D.arc.to + (S.findIndex(x => x >= s) - (arc.length - 1)) / 300;
// 4. the speed curves, each segment scaled to its share of the path: segment 1 = the arc, segment 2.. = Vico's path split at pins
const segs = D.segments;
const integ = (v, a, b) => { let s = 0; const n = 2000; for (let j = 0; j < n; j++) { const t = a + (b - a) * (j + .5) / n; s += vAt(v, t) * (b - a) / n; } return s; };
function vAt(v, t) { if (t <= v[0][0]) return v[0][1]; for (let j = 1; j < v.length; j++) if (t <= v[j][0]) { const [a, va] = v[j - 1], [b, vb] = v[j]; return va + (vb - va) * (t - a) / (b - a); } return v.at(-1)[1]; }
const lens = segs.map((g, i) => i === 0 ? Sarc : null);
// segments after the first share Vico's path by their pin "S" (arc length of Vico's path at Vico time g.vicoTo), the last runs to the end
let s0 = Sarc;
const bounds = segs.map((g, i) => { if (i === 0) return [0, Sarc]; const s1 = g.vicoTo != null ? Sarc + vicoS(g.vicoTo) : Stot; const r = [s0, s1]; s0 = s1; return r; });
function vicoS(tv) { const j = arc.length - 1 + Math.round((tv - D.arc.to) * 300); return S[Math.min(S.length - 1, j)] - Sarc; }
const scale = segs.map((g, i) => (bounds[i][1] - bounds[i][0]) / integ(g.v, g.t0, g.t1));
const Snew = t => { let s = 0; for (const [i, g] of segs.entries()) { if (t <= g.t0) break; s += scale[i] * integ(g.v, g.t0, Math.min(t, g.t1)); } return Math.min(s, Stot); };
const vNew = t => { for (const [i, g] of segs.entries()) if (t >= g.t0 && t <= g.t1) return scale[i] * vAt(g.v, t); return 0; };
// 5. keys
const rest = segs.at(-1).t1, times = new Set();
for (let t = 0; t < rest - 1e-6; t += D.keyEvery) times.add(Math.round(t * 1000) / 1000);
for (const b of D.beats || []) if (b < rest) times.add(b);
times.add(rest);
const aimDy = t => (D.aim || []).reduce((s, a) => s + a.dy * (a.hold ? (t < a.t0 ? sm((t - (a.t0 - a.ramp)) / a.ramp) : t > a.t1 ? 1 - sm((t - a.t1) / a.ramp) : 1) : sm((t - a.t0) / (a.t1 - a.t0))), 0);
const fovD = t => (D.fov || []).reduce((s, a) => s + a.d * sm((t - a.t0) / (a.t1 - a.t0)), 0);
const r4 = x => Math.round(x * 1e4) / 1e4;
const keys = [...times].sort((a, b) => a - b).map(t => {
  const s = Snew(t), v = at(s), vt = vicoTime(s), lab = (D.labels || {})[String(t)];
  const tgt = [...v.target]; tgt[1] += aimDy(t);
  return { at: t, position: v.position.map(r4), target: tgt.map(r4), fov: r4(v.fov + fovD(t)), label: lab || (vt == null ? `Arc from the opening view (${t.toFixed(2)} s)` : `Vico path at his ${vt.toFixed(2)} s`) };
});
if (D.hold != null && rest < D.seconds) keys.push({ ...keys.at(-1), at: D.seconds, label: keys.at(-1).label.replace(/^.*$/, 'End card held') });
const out = { id: 'hero', seconds: D.seconds, cameraPlan: { easeIn: false, easeOut: D.easeOut !== false, keys } };
fs.writeFileSync(outF, JSON.stringify(out, null, 1));
console.log(`path ${Stot.toFixed(2)} m (arc ${Sarc.toFixed(2)} m), ${keys.length} keys; segment scales ${scale.map(x => x.toFixed(3)).join(' ')}`);
for (const [i, g] of segs.entries()) console.log(`  segment ${i + 1} ${g.t0}-${g.t1} s: ${(bounds[i][1] - bounds[i][0]).toFixed(2)} m, speed at ends ${vNew(g.t0 + 1e-6).toFixed(3)} / ${vNew(g.t1 - 1e-6).toFixed(3)} m/s`);
