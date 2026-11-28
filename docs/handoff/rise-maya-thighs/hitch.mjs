import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-thighs/';
const { armPoints } = await import(W + 'tests/lib/people-film-run.mjs');
const load = f => JSON.parse(fs.readFileSync(f, 'utf8')).rows.filter(r => r.room);
const [A, B] = process.argv.slice(2).map(load);
const pts = r => { const o = {}; for (const s of ['l', 'r']) { const p = armPoints(r, s); for (const k in p) o[s + "." + k] = p[k].toArray(); } return o; };
const series = R => R.map(pts);
const SA = series(A), SB = series(B); const keys = Object.keys(SA[0]);
const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const out = [];
for (let i = 2; i < SA.length; i++) for (const k of keys) {
  const ds = S => { const a = S[i][k], b = S[i - 1][k], c = S[i - 2][k]; return Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1], a[2] - 2 * b[2] + c[2]); };
  out.push({ t: A[i].t, k, a: ds(SA), b: ds(SB) }); }
const worst = (f) => out.reduce((m, o) => f(o) > f(m) ? o : m, out[0]);
const wa = worst(o => o.a), wb = worst(o => o.b), wx = worst(o => o.b - o.a);
console.log('accel (2nd diff, mm/frame^2) max A', wa.a.toFixed(2), wa.k, wa.t.toFixed(3), '| B', wb.b.toFixed(2), wb.k, wb.t.toFixed(3), '| max B-A', (wx.b - wx.a).toFixed(2), wx.k, wx.t.toFixed(3));
const bad = out.filter(o => o.b > Math.max(2, 1.5 * o.a)).sort((x, y) => y.b - x.b).slice(0, 12);
for (const o of bad) console.log(' ', o.t.toFixed(3), o.k, 'base', o.a.toFixed(2), 'new', o.b.toFixed(2));
