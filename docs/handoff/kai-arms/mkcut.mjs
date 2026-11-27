// node mkcut.mjs <oilers.json> <out cut.json> <view: film|back-left|side-low|...> [kai-probe.json] [patch.json]
// view cameras are given in Kai's own frame (metres, +x his left, +y up, +z ahead) and put in the world by his matrixWorld from the probe.
import fs from 'node:fs';
const [src, out, view, probeFile, patchFile] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(src, 'utf8'));
if (patchFile) { const K = JSON.parse(fs.readFileSync(patchFile, 'utf8')); for (const e of o.people.cast) if (K[e.key]) { e.postures ||= {}; e.postures[K[e.key].id] = { ...(e.postures[K[e.key].id] || {}), poseKeys: K[e.key].poseKeys }; } }
const VIEWS = {
  'back-left': { p: [0.62, 1.30, -0.55], t: [0.02, 0.74, 0.30], fov: 38 },
  'side-low': { p: [0.95, 0.86, 0.02], t: [0.0, 0.73, 0.30], fov: 36 },
  'side-high': { p: [0.95, 1.15, 0.10], t: [0.0, 0.72, 0.30], fov: 36 },
  'wide': { p: [1.3, 1.6, -1.2], t: [0, 0.75, 0.25], fov: 40 },
};
if (view !== 'film') {
  const pr = JSON.parse(fs.readFileSync(probeFile, 'utf8')), m = pr.matrixWorld, v = VIEWS[view];
  const tw = p => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const view_ = { position: tw(v.p), target: tw(v.t), fov: v.fov, aspect: 16 / 9 };
  o.camera = { ...o.camera, keys: [{ id: 'a', time: 0, label: 'a', easing: 'linear', view: view_ }, { id: 'b', time: 1, label: 'b', easing: 'linear', view: view_ }] };
  delete o.cameraPlan;
}
fs.writeFileSync(out, JSON.stringify({ id: 'kai-arms-probe', name: 'kai arms probe', shots: [o] }));
console.log('wrote', out, view);
