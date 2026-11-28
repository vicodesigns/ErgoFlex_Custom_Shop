// node mkcut.mjs <wellness.json> <out cut.json> <film|left|right> <probe.json>  (close views in Maya's frame: +x her left, +y up, +z ahead)
import fs from 'node:fs';
const [src, out, view] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(src, 'utf8'));
const VIEWS = { left: { p: [0.50, 1.10, 0.37], t: [0.03, 0.995, 0.34], fov: 30 }, right: { p: [-0.50, 1.10, 0.37], t: [-0.03, 0.995, 0.34], fov: 30 } };
const m = JSON.parse(fs.readFileSync(process.argv[5], 'utf8')).matrixWorld;   // Maya's matrixWorld from the render probe (model units, scale 1.5087)
const tw = p => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
if (view !== 'film') { const v = VIEWS[view], vw = { position: tw(v.p), target: tw(v.t), fov: v.fov, aspect: 16 / 9 };
  o.camera = { ...o.camera, keys: [{ id: 'a', time: 0, label: 'a', easing: 'linear', view: vw }, { id: 'b', time: 1, label: 'b', easing: 'linear', view: vw }] }; delete o.cameraPlan; }
fs.writeFileSync(out, JSON.stringify({ id: 'wellness-maya-hands-probe', name: 'wellness maya hands probe', shots: [o] }));
console.log('wrote', out, view);
