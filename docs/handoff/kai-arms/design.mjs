// Pose keys for Kai's hand-over from wrist targets (Kai frame, m), hand turns and an elbow roll. Writes keys.json.
import fs from 'node:fs';
import { THREE, M, rig, loadRow, snapLocal, keyFrom, filmFrames, shot, stripKai } from './rigtools.mjs';
const P = JSON.parse(fs.readFileSync(process.argv[2] || 'plan.json', 'utf8'));
const times = P.keys.map(k => k.t);
const bare = await filmFrames({ shot, key: /^kai/, times: [...times, 13.5], edit: stripKai });
const real = await filmFrames({ shot, key: /^kai/, times: [13.5] });
loadRow(real[0]); const finalWq = {}, finalWp = {};
for (const s of ['l', 'r']) { const h = rig.side[s].arm[3]; finalWq[s] = rig.wq[h].clone(); finalWp[s] = rig.wp[h].clone(); }
const X = new THREE.Vector3(1, 0, 0);
const out = {};
P.keys.forEach((k, idx) => {
  loadRow(bare[idx]); const m = snapLocal();
  const motionHand = {}; for (const s of ['l', 'r']) motionHand[s] = rig.wq[rig.side[s].arm[3]].clone();
  for (const s of ['l', 'r']) {
    const [, upper, lower, hand] = rig.side[s].arm, sx = s === 'l' ? 1 : -1, w = k.wrist;
    const target = new THREE.Vector3(w[0] * sx, w[1], w[2]);
    rig.reach(upper, lower, hand, target); rig.reach(upper, lower, hand, target);
    // hand turn: from the motion's toward the final typing turn by k.turn, then pitched (fingers up, +) by k.pitch degrees about the model x
    const q = motionHand[s].clone().slerp(finalWq[s], k.turn).premultiply(new THREE.Quaternion().setFromAxisAngle(X, -(k.pitch || 0) * Math.PI / 180));
    if (k.elbow) M.liftElbow(rig, s, k.elbow, 1, null);
    rig.setWorld(hand, q); rig.fk();
    const got = rig.wp[hand]; if (got.distanceTo(target) > .003) console.log('miss', k.t, s, got.distanceTo(target).toFixed(4));
  }
  out[k.t] = keyFrom(m, snapLocal());
});
const existing = shot.people.cast.find(e => e.key === 'kai').postures['people-kai-wheel-type-31'].poseKeys;
const I = { upperarm_l: [0, 0, 0, 1], lowerarm_l: [0, 0, 0, 1], hand_l: [0, 0, 0, 1], upperarm_r: [0, 0, 0, 1], lowerarm_r: [0, 0, 0, 1], hand_r: [0, 0, 0, 1] };
const swap = P.swap;
const docks = [{ t: P.start, pose: I }, ...P.keys.filter(k => k.t <= swap).map(k => ({ t: k.t, pose: out[k.t] }))];
const kai = [...P.keys.filter(k => k.t >= swap).map(k => ({ t: k.t, pose: out[k.t] })), existing.find(k => k.t === 13.5)];
fs.writeFileSync(P.out || 'keys.json', JSON.stringify({ 'kai-docks': { id: 'people-kai-wheel-roll', poseKeys: docks }, kai: { id: 'people-kai-wheel-type-31', poseKeys: kai } }, null, 1));
console.log('wrote', P.out || 'keys.json', docks.length, kai.length);
