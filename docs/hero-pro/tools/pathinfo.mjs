// usage: node pathinfo.mjs <shot.json> [t ...]
// Arc length (camera position, metres) along a shot's BAKED camera (sampled at 30 fps the way the render samples it),
// printed at the given chapter times (default: every story key), with the camera's azimuth / radius / height around the
// desk (world origin) and the aim height.
import fs from 'node:fs';
const [file, ...ts] = process.argv.slice(2);
let shot = JSON.parse(fs.readFileSync(file, 'utf8')); if (shot.shots) shot = shot.shots[0];
const T = shot.seconds, keys = shot.camera.keys;
export function sampleBaked(keys, T, t) {
  const f = t / T;
  if (f <= keys[0].time) return keys[0].view;
  const i = keys.findIndex(k => k.time > f); if (i < 0) return keys.at(-1).view;
  const a = keys[i - 1], b = keys[i], p = (f - a.time) / (b.time - a.time), u = a.easing === 'hold' ? 0 : a.easing === 'linear' ? p : p * p * (3 - 2 * p);
  const L = (x, y) => x.map((v, j) => v + (y[j] - v) * u);
  return { position: L(a.view.position, b.view.position), target: L(a.view.target, b.view.target), fov: a.view.fov + (b.view.fov - a.view.fov) * u };
}
const want = ts.length ? ts.map(Number) : shot.cameraPlan.keys.map(k => k.at);
const N = Math.round(T * 30); let S = 0, prev = sampleBaked(keys, T, 0); const table = [{ t: 0, S: 0 }];
for (let n = 1; n <= N; n++) { const t = n / N * T, v = sampleBaked(keys, T, t); S += Math.hypot(...v.position.map((x, i) => x - prev.position[i])); prev = v; table.push({ t, S }); }
for (const t of want) {
  const row = table.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), v = sampleBaked(keys, T, t), [x, y, z] = v.position;
  console.log(`${t.toFixed(2).padStart(6)} s  S ${row.S.toFixed(3).padStart(7)} m  az ${(Math.atan2(-z, x) * 180 / Math.PI).toFixed(1).padStart(6)}  r ${Math.hypot(x, z).toFixed(2)}  h ${y.toFixed(2)}  aimY ${v.target[1].toFixed(2)}  fov ${v.fov.toFixed(2)}`);
}
