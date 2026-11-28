// node design.mjs out-keys.json [log.json]: at every existing key time where a hand's skin is inside Maya's other arm/body,
// turn hand_<s>, the finger bones (and a little lowerarm_<s>) so the hand rests ON the surface (signed depth by nearest
// triangle of the LBS-skinned body), keys = baseKey * delta (local frame), rounded 1e-4. Keys elsewhere unchanged.
import fs from 'node:fs';
import { THREE, loadModel, skinMats, skinVerts, targetTris, signedDist, HANDRE } from './lib.mjs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-elbow-hand/';
const { filmFrames, chapterShot } = await import(W + 'tests/lib/people-film-run.mjs');
const [outF, logF] = process.argv.slice(2);
const ID = 'people-maya-sit-type', shot = chapterShot('rise');
const keys = JSON.parse(JSON.stringify(shot.people.cast[0].postures[ID].poseKeys));
const model = await loadModel(ID);
const FING = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const sideBones = s => ['lowerarm_' + s, 'hand_' + s, ...FING.flatMap(f => [1, 2, 3].map(k => `${f}_0${k}_${s}`))];
const parentOf = n => { const m = /^(\w+)_0(\d)_([lr])$/.exec(n); if (m) return m[2] === '1' ? 'hand_' + m[3] : `${m[1]}_0${+m[2] - 1}_${m[3]}`; if (/^hand_/.test(n)) return 'lowerarm_' + n.slice(-1); if (/^lowerarm_/.test(n)) return 'upperarm_' + n.slice(-1); };
const WINDOWS = { l: [14.9, 17.5], r: [18.9, 21.5] };
const times = keys.map(k => k.t).filter(t => (t >= WINDOWS.l[0] && t <= WINDOWS.l[1]) || (t >= WINDOWS.r[0] && t <= WINDOWS.r[1]));
const rows = await filmFrames({ shot, key: /maya/, times });
const Q = () => new THREE.Quaternion(), V = () => new THREE.Vector3();
const log = [];
const prev = { l: null, r: null };
for (const r of rows) {
  const s = r.t <= WINDOWS.l[1] ? 'l' : 'r', names = sideBones(s), re = HANDRE(s);
  const S0 = skinMats(model, r.bones), X0 = skinVerts(model, S0);
  // locals of the side's chain (relative to parents), from the drawn pose
  const loc = {}; for (const n of names) { const p = r.bones[parentOf(n)], b = r.bones[n]; const pq = Q().fromArray(p, 3), bq = Q().fromArray(b, 3); loc[n] = { p: V().fromArray(b).sub(V().fromArray(p)).applyQuaternion(pq.clone().invert()), q: pq.clone().invert().multiply(bq) }; }
  const probeIdx = [], foreIdx = []; model.dom.forEach((b, i) => { if (re.test(b)) probeIdx.push(i); else if (b === 'lowerarm_' + s) foreIdx.push(i); });
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const i of [...probeIdx, ...foreIdx]) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], X0[i * 6 + c]); hi[c] = Math.max(hi[c], X0[i * 6 + c]); }
  const tg = targetTris(model, X0, v => !re.test(model.dom[v]) && model.dom[v] !== 'lowerarm_' + s && model.dom[v] !== 'upperarm_' + s, lo, hi, .03);
  const fingerOf = i => FING.find(f => model.dom[i].startsWith(f + '_'));
  const sub = probeIdx.filter((_, k) => k % 2 === 0), subFore = foreIdx.filter((_, k) => k % 3 === 0);
  // pose from params: x = { name: [rx, ry, rz] } local delta rotvecs
  const bonesFor = x => { const out = { ...r.bones }; const wq = {}, wp = {};
    const up = r.bones['upperarm_' + s]; wq['upperarm_' + s] = Q().fromArray(up, 3); wp['upperarm_' + s] = V().fromArray(up);
    for (const n of names) { const par = parentOf(n), d = x[n]; let lq = loc[n].q.clone(); if (d) { const a = Math.hypot(...d); if (a > 1e-9) lq.multiply(Q().setFromAxisAngle(V().fromArray(d).divideScalar(a), a)); }
      wq[n] = wq[par].clone().multiply(lq); wp[n] = loc[n].p.clone().applyQuaternion(wq[par]).add(wp[par]); out[n] = [...wp[n].toArray(), ...wq[n].toArray()]; }
    return out; };
  const evalX = (x, idx = sub, full = false) => {
    const B = bonesFor(x), S = skinMats(model, B), useFore = !!x['lowerarm_' + s], list = useFore ? [...idx, ...subFore] : idx, Xs = skinVerts(model, S, list);
    let pen = 0, worst = 0, wb = null; const fmin = {};
    list.forEach((vi, k) => { const p = [Xs[k * 6], Xs[k * 6 + 1], Xs[k * 6 + 2]]; const q = signedDist(tg, p, .03); if (!q) return; const dep = -q.d;
      if (dep > .0005) pen += (dep - .0005) ** 2; if (dep > worst) { worst = dep; wb = model.dom[vi] + '>' + q.dom; }
      const f = fingerOf(vi); if (f && f !== 'thumb' && /_03_/.test(model.dom[vi])) fmin[f] = Math.min(fmin[f] ?? 1, q.d); });
    return { pen, worst, wb, fmin };
  };
  const base = evalX({});
  const contact = base.worst > .002;
  const REG = n => /^lowerarm/.test(n) ? 4 : /^hand/.test(n) ? 1 : /_01_/.test(n) ? .4 : .25;
  const cost = x => { const e = evalX(x); let c = 1e6 * e.pen;
    if (contact) for (const f of ['index', 'middle', 'ring', 'pinky']) { const d = e.fmin[f]; if (d === undefined) c += 2; else if (d > .003) c += 2e3 * (d - .003) ** 2; }
    for (const n in x) { const d = x[n], p = prev[s]?.[n] || [0, 0, 0]; c += REG(n) * (d[0] ** 2 + d[1] ** 2 + d[2] ** 2) + 3 * ((d[0] - p[0]) ** 2 + (d[1] - p[1]) ** 2 + (d[2] - p[2]) ** 2); }
    return c; };
  let x = {};
  if (contact) {
    x = JSON.parse(JSON.stringify(prev[s] || {}));
    const params = names.flatMap(n => [0, 1, 2].map(c => [n, c]));
    let best = cost(x);
    for (const step of [.16, .08, .04, .02, .01]) for (let sweep = 0; sweep < 3; sweep++) { let improved = false;
      for (const [n, c] of params) for (const dir of [1, -1]) { const y = { ...x, [n]: [...(x[n] || [0, 0, 0])] }; y[n][c] += dir * step; const cy = cost(y); if (cy < best - 1e-9) { best = cy; x = y; improved = true; break; } }
      if (!improved) break; }
  }
  const after = contact ? evalX(x, probeIdx, true) : base;
  prev[s] = contact ? x : null;
  const ang = n => x[n] ? (Math.hypot(...x[n]) * 180 / Math.PI).toFixed(1) : '0';
  console.log(r.t.toFixed(3), s, 'base worst', (base.worst * 1000).toFixed(1), base.wb, '-> after', (after.worst * 1000).toFixed(1), after.wb, '| lowerarm', ang('lowerarm_' + s), 'hand', ang('hand_' + s), 'fmin', Object.entries(after.fmin).map(([f, d]) => f[0] + (d * 1000).toFixed(1)).join(' '));
  log.push({ t: r.t, s, base: base.worst, after: after.worst, x });
  // write into the key at this time
  const key = keys.find(k => Math.abs(k.t - r.t) < 1e-6);
  for (const n in x) { const a = Math.hypot(...x[n]); if (a < 1e-6) continue; const K = Q().fromArray(key.pose[n]); K.multiply(Q().setFromAxisAngle(V().fromArray(x[n]).divideScalar(a), a)).normalize(); if (K.w < 0) K.set(-K.x, -K.y, -K.z, -K.w); key.pose[n] = K.toArray().map(v => Math.round(v * 1e4) / 1e4); }
}
fs.writeFileSync(outF, JSON.stringify(keys));
if (logF) fs.writeFileSync(logF, JSON.stringify(log));
