// node mkcut.mjs <rise.json> <out cut.json> <view> [probe.json] [keys.json]  (close views in Maya's frame: +x her left, +y up, +z ahead)
import fs from 'node:fs';
const [src, out, view, probe, keys] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(src, 'utf8'));
if (keys) o.people.cast[0].postures['people-maya-sit-type'].poseKeys = JSON.parse(fs.readFileSync(keys, 'utf8'));
const VIEWS = {
  elbowL: { p: [-0.45, 1.45, 0.25], t: [-0.08, 1.22, -0.05], fov: 24 },   // her right-front, above: right elbow + left hand (15-17.4 s)
  elbowR: { p: [0.45, 1.45, 0.25], t: [0.08, 1.22, -0.05], fov: 24 },     // her left-front, above: left elbow + right hand (19-21.3 s)
  backL: { p: [-0.3, 1.6, -0.5], t: [-0.05, 1.0, -0.14], fov: 30 },       // above-behind right: right hand down the back (15-17.4 s)
  backR: { p: [0.3, 1.6, -0.5], t: [0.05, 1.0, -0.14], fov: 30 },         // above-behind left: left hand down the back (19-21.3 s)
  lap: { p: [0.0, 1.25, 0.55], t: [0, 0.62, 0.2], fov: 34 },              // front, above the desk: hands in the lap (13-13.7 s)
};
if (view !== 'film') { const m = JSON.parse(fs.readFileSync(probe, 'utf8')).matrixWorld; const tw = p => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const v = VIEWS[view], vw = { position: tw(v.p), target: tw(v.t), fov: v.fov, aspect: 16 / 9 };
  o.camera = { ...o.camera, keys: [{ id: 'a', time: 0, label: 'a', easing: 'linear', view: vw }, { id: 'b', time: 1, label: 'b', easing: 'linear', view: vw }] }; delete o.cameraPlan; }
fs.writeFileSync(out, JSON.stringify({ id: 'rise-maya-elbow-probe', name: 'rise maya elbow probe', shots: [o] }));
console.log('wrote', out, view);
