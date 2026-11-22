// usage: node optimize.mjs <plan.json in> <plan.json out> [pinned key indices, comma] [v0 target m/s]
// Re-times the interior keys of the chapter's first move (geometry untouched) so the BAKED camera (the repo's
// camera-spline.mjs, sampled at 30 fps like the render) has the least speed change: minimises the sum over frames of
// (acceleration along the path)^2 + (angular acceleration / 12)^2 (12 deg/s of pan reads about like 1 m/s here),
// with the opening speed held near v0. Coordinate descent on the key times; pinned keys and the move's ends stay.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SPLINE = fileURLToPath(new URL('../../../tools/experience/camera-spline.mjs', import.meta.url));      // the repo's own bake
const [inF, outF, pinS, v0S] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(inF, 'utf8')), T = plan.seconds, keys = plan.cameraPlan.keys;
const pinned = new Set((pinS || '').split(',').filter(Boolean).map(Number)), v0 = Number(v0S || 0.25);
const cutI = keys.findIndex(k => k.cut), last = cutI - 1;          // move 1 = keys[0..last]
const fps = 30, N = Math.round(T * fps), tmp = path.join(os.tmpdir(), 'fixB-o-' + process.pid + '.json');
function cost(times) {
  const ks = keys.map((k, i) => i <= last ? { ...k, at: times[i] } : k);
  fs.writeFileSync(tmp, JSON.stringify({ seconds: T, cameraPlan: { ...plan.cameraPlan, keys: ks } }));
  execFileSync('node', [SPLINE, tmp], { stdio: 'ignore' });
  const bk = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera.keys;
  const end = times[last];
  let j = 0; const P = [];
  for (let n = 0; n < N && n / (N - 1) * T < end - 1e-6; n++) {
    const t = n / (N - 1); while (j < bk.length - 2 && bk[j + 1].time <= t) j++;
    const a = bk[j], b = bk[j + 1], u = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
    const L = (x, y) => x.map((v, i) => v + (y[i] - v) * u);
    P.push({ p: L(a.view.position, b.view.position), q: L(a.view.target, b.view.target) });
  }
  const dir = f => { const d = f.q.map((v, i) => v - f.p[i]), l = Math.hypot(...d); return d.map(v => v / l); };
  const sp = [], an = [];
  for (let n = 1; n < P.length; n++) { sp.push(Math.hypot(...P[n].p.map((v, i) => v - P[n - 1].p[i])) * fps); const a = dir(P[n]), b = dir(P[n - 1]); an.push(Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180 / Math.PI * fps); }
  // 5-frame means (the bake's 15 Hz facets are not what is being tuned)
  const sm = a => a.map((_, n) => { let s = 0, c = 0; for (let k = n - 2; k <= n + 2; k++) if (a[k] !== undefined) { s += a[k]; c++; } return s / c; });
  const s5 = sm(sp), a5 = sm(an);
  let J = 0; for (let n = 1; n < s5.length; n++) { const da = (s5[n] - s5[n - 1]) * fps, dw = (a5[n] - a5[n - 1]) * fps / 12; J += da * da + dw * dw; }
  J /= fps; J += 40 * (s5[2] - v0) ** 2 + 40 * sp.at(-1) ** 2 + 10 * sp.at(-4) ** 2;
  return { J, peak: Math.max(...s5), v0: s5[2] };
}
let times = keys.slice(0, last + 1).map(k => k.at), best = cost(times);
console.log('start', best.J.toFixed(4), 'peak', best.peak.toFixed(3), 'v0', best.v0.toFixed(3));
let step = 0.4;
for (let it = 0; it < 40 && step > 0.004; it++) {
  let improved = false;
  for (let i = 1; i < last; i++) {
    if (pinned.has(i)) continue;
    for (const d of [step, -step]) {
      const t = times[i] + d; if (t <= times[i - 1] + 0.3 || t >= times[i + 1] - 0.3) continue;
      const trial = [...times]; trial[i] = Math.round(t * 1000) / 1000; const c = cost(trial);
      if (c.J < best.J - 1e-6) { times = trial; best = c; improved = true; break; }
    }
  }
  if (!improved) step /= 2;
}
fs.unlinkSync(tmp);
console.log('end  ', best.J.toFixed(4), 'peak', best.peak.toFixed(3), 'v0', best.v0.toFixed(3), 'times', times.join(' '));
keys.forEach((k, i) => { if (i <= last) k.at = times[i]; });
fs.writeFileSync(outF, JSON.stringify(plan, null, 1));
