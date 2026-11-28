// node post.mjs log-v2.json keys-v3.json [ramp=0.3]: ease the corrections in and out (smoothstep over `ramp` s of existing keys)
// before the first and after the last deep contact key of each side, keep the designed turns in between; keys = base * delta.
import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-elbow-hand/';
const THREE = await import(W + 'node_modules/three/build/three.module.js');
const [logF, outF, rampA = '0.3'] = process.argv.slice(2), ramp = +rampA;
const log = JSON.parse(fs.readFileSync(logF, 'utf8')), keys = JSON.parse(fs.readFileSync('keys-base.json', 'utf8'));
const ss = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const X = {};   // t -> { side, x }
for (const s of ['l', 'r']) {
  const L = log.filter(e => e.s === s), deep = L.filter(e => e.base > .01);
  const B = deep[0], C = deep.at(-1);
  for (const k of keys) {
    let x = null;
    if (k.t >= B.t - 1e-9 && k.t <= C.t + 1e-9) x = (L.find(e => Math.abs(e.t - k.t) < 1e-6) || {}).x || {};
    else if (k.t < B.t && k.t > B.t - ramp) { const f = ss((k.t - (B.t - ramp)) / ramp); x = Object.fromEntries(Object.entries(B.x).map(([n, d]) => [n, d.map(v => v * f)])); }
    else if (k.t > C.t && k.t < C.t + ramp) { const f = 1 - ss((k.t - C.t) / ramp); x = Object.fromEntries(Object.entries(C.x).map(([n, d]) => [n, d.map(v => v * f)])); }
    if (x && Object.keys(x).length) (X[k.t] ||= []).push(x);
  }
  console.log(s, 'deep contact keys', B.t, '-', C.t, 'ramp in from', (B.t - ramp).toFixed(3), 'out to', (C.t + ramp).toFixed(3));
}
const Q = () => new THREE.Quaternion(), V = () => new THREE.Vector3();
let n = 0;
for (const k of keys) for (const x of X[k.t] || []) for (const b in x) { const a = Math.hypot(...x[b]); if (a < 1e-6) continue;
  const K = Q().fromArray(k.pose[b]); K.multiply(Q().setFromAxisAngle(V().fromArray(x[b]).divideScalar(a), a)).normalize(); if (K.w < 0) K.set(-K.x, -K.y, -K.z, -K.w); k.pose[b] = K.toArray().map(v => Math.round(v * 1e4) / 1e4); n++; }
fs.writeFileSync(outF, JSON.stringify(keys)); console.log('turned', n, 'bone keys;', keys.length, 'keys');
