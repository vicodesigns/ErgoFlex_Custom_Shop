import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/kai-arms/';
export const THREE = await import(W + 'node_modules/three/build/three.module.js');
export const M = await import(W + 'room-people-motion.mjs');
export const { filmFrames, chapterShot } = await import(W + 'tests/lib/people-film-run.mjs');
export const rig = new M.PersonRig(JSON.parse(fs.readFileSync('C:/Users/Vico/polish-wt/kai-arms/assets/props/people-rigs/kai.json', 'utf8')));
export const shot = chapterShot('oilers');
export const ARM = ['upperarm', 'lowerarm', 'hand'];
// put a filmFrames row (model frame) on the rig: local turns from the world turns, root and pelvis places
export function loadRow(row) {
  const wq = rig.names.map(n => row.bones[n] ? new THREE.Quaternion().fromArray(row.bones[n], 3) : null);
  for (let i = 0; i < rig.n; i++) { if (!wq[i]) continue; const p = rig.parents[i]; rig.lq[i].copy(p < 0 ? wq[i] : wq[p].clone().invert().multiply(wq[i])).normalize(); }
  const R = rig.b.Root, P = rig.b.pelvis; rig.lp[R].fromArray(row.bones[rig.names[R]]);
  // pelvis local place: from world
  const pw = new THREE.Vector3().fromArray(row.bones[rig.names[P]]); rig.lp[P].copy(pw.sub(rig.lp[R]).applyQuaternion(wq[R].clone().invert()));
  rig.fk();
  let err = 0; for (let i = 0; i < rig.n; i++) if (row.bones[rig.names[i]]) err = Math.max(err, rig.wp[i].distanceTo(new THREE.Vector3().fromArray(row.bones[rig.names[i]])));
  return err;
}
export const snapLocal = () => rig.lq.map(q => q.clone());
// the key turn (bone's own frame) that takes the motion's local turn to the wanted one
export function keyFrom(motionLq, wantLq, sides = ['l', 'r']) {
  const out = {};
  for (const s of sides) for (const b of ARM) { const i = rig.index.get(b + '_' + s); const k = motionLq[i].clone().invert().multiply(wantLq[i]).normalize(); if (k.w < 0) { k.x *= -1; k.y *= -1; k.z *= -1; k.w *= -1; } out[b + '_' + s] = [k.x, k.y, k.z, k.w].map(v => Math.round(v * 10000) / 10000 + 0); }
  return out;
}
export function applyKey(key) { for (const [n, d] of Object.entries(key || {})) { const i = rig.index.get(n); rig.lq[i].multiply(new THREE.Quaternion().fromArray(d)).normalize(); } rig.fk(); }
export const stripKai = f => { for (const e of f.cast) if (/^kai/.test(e.key)) { if (e.postures) for (const p of Object.values(e.postures)) delete p.poseKeys; } return f; };
