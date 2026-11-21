// Checks the re-baked rise camera against the film's (7ffa208c): the same view at every second up to the stretch framing key, and from the
// end beat's first key on the same view 5 s later.   node docs/rise-wellness/camera-check.mjs <old shot.json> <new shot.json> <last unshifted s> <first shifted old s>
import fs from 'node:fs';
const [a, b, t0, t1] = process.argv.slice(2), rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const at = (s, t) => { const k = s.camera.keys, x = t / s.seconds; let i = 0; while (i < k.length - 2 && k[i + 1].time < x) i++; const u = Math.min(1, Math.max(0, (x - k[i].time) / (k[i + 1].time - k[i].time))); const L = (p, q) => p.map((v, j) => v + (q[j] - v) * u); return [...L(k[i].view.position, k[i + 1].view.position), ...L(k[i].view.target, k[i + 1].view.target), k[i].view.fov + (k[i + 1].view.fov - k[i].view.fov) * u]; };
const A = rd(a), B = rd(b); let m1 = 0, m2 = 0;
for (let t = 0; t <= +t0 + 1e-9; t += 1 / 30) m1 = Math.max(m1, ...at(A, t).slice(0, 6).map((v, i) => Math.abs(v - at(B, t)[i])));
for (let t = +t1; t <= A.seconds + 1e-9; t += 1 / 30) m2 = Math.max(m2, ...at(A, t).slice(0, 6).map((v, i) => Math.abs(v - at(B, t + B.seconds - A.seconds)[i])));
console.log(`0..${t0} s: largest difference in camera position / aim ${(m1 * 1000).toFixed(2)} mm; from ${t1} s (5 s later in the new chapter): ${(m2 * 1000).toFixed(2)} mm`);
