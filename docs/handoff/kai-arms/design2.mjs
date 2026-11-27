// Kai's hand-over keys from one smooth path: waypoints (Kai frame, m, left side; the right mirrored), Catmull-Rom through them,
// progress u(t) minimum-jerk over [start, end]; a key every few tenths, linear between keys, the last stretch smooth into the
// existing 13.5 s typing key. Writes keys.json.
import fs from 'node:fs';
import { THREE, M, rig, loadRow, snapLocal, keyFrom, filmFrames, shot, stripKai } from './rigtools.mjs';
const P = JSON.parse(fs.readFileSync(process.argv[2] || 'plan2.json', 'utf8'));
const { start, end, swap } = P, docksT = P.docksTimes, kaiT = P.kaiTimes, all = [...docksT, ...kaiT.filter(t => t !== swap)];
const bare = await filmFrames({ shot, key: /^kai/, times: [start, ...all, end], edit: stripKai });
const real = await filmFrames({ shot, key: /^kai/, times: [end] });
const at = t => bare.find(r => Math.abs(r.t - t) < 1e-9);
loadRow(real[0]); const finalWq = {}, finalWp = {}, finalEl = {}; for (const s of ['l', 'r']) { const h = rig.side[s].arm[3]; finalWq[s] = rig.wq[h].clone(); finalWp[s] = rig.wp[h].clone(); finalEl[s] = rig.wp[rig.side[s].arm[2]].clone().sub(rig.wp[rig.side[s].arm[1]]); }
loadRow(at(start)); const startWp = {}, startEl = {}; for (const s of ['l', 'r']) { startWp[s] = rig.wp[rig.side[s].arm[3]].clone(); startEl[s] = rig.wp[rig.side[s].arm[2]].clone().sub(rig.wp[rig.side[s].arm[1]]); }
const mj0 = x => { x = Math.min(1, Math.max(0, x)); return P.prog === "ss" ? x * x * (3 - 2 * x) : x * x * x * (10 - 15 * x + 6 * x * x); }, mj = x => mj0(x * (end - start) / ((P.progEnd ?? end) - start));
const V3 = a => new THREE.Vector3(...a);
function pathOf(s) { // control points for side s: start (as the motion has it), the plan's middle points (mirrored), the final
  const sx = s === 'l' ? 1 : -1, mid = P.points.map(p => V3([p[0] * sx, p[1], p[2]]));
  const pts = [startWp[s].clone(), ...mid, finalWp[s].clone()];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 2000; return u => curve.getPointAt(Math.min(1, Math.max(0, u)));
}
const paths = { l: pathOf('l'), r: pathOf('r') };
const lerpTab = (tab, u) => { for (let i = 1; i < tab.length; i++) if (u <= tab[i][0]) { const [u0, a] = tab[i - 1], [u1, b] = tab[i]; const x = (u - u0) / (u1 - u0); return a + (b - a) * x * x * (3 - 2 * x); } return tab.at(-1)[1]; };
const X = new THREE.Vector3(1, 0, 0), out = {};
for (const t of all) {
  const u = mj((t - start) / (end - start)); loadRow(at(t)); const m = snapLocal();
  const motionHand = {}; for (const s of ['l', 'r']) motionHand[s] = rig.wq[rig.side[s].arm[3]].clone();
  for (const s of ['l', 'r']) {
    const [, upper, lower, hand] = rig.side[s].arm, target = paths[s](u);
    const turn = lerpTab(P.turn, u), pitch = lerpTab(P.pitch, u), elbow = lerpTab(P.elbow, u);
    if (P.pole) {
      // two bones with a pole: the elbow below the shoulder-wrist line, out by P.pole.out(u) and back by P.pole.back(u)
      const sx = s === 'l' ? 1 : -1, Sh = rig.wp[upper].clone(), E0 = rig.wp[lower].clone(), H0 = rig.wp[hand].clone();
      const a = E0.distanceTo(Sh), b = H0.distanceTo(E0), d = Math.min(a + b - 1e-4, target.distanceTo(Sh)), axis = target.clone().sub(Sh).normalize();
      const pole = new THREE.Vector3(sx * lerpTab(P.pole.out, u), -lerpTab(P.pole.down, u), -lerpTab(P.pole.back, u)); pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
      const sm = v => v * v * (3 - 2 * v), ke = sm(Math.min(1, Math.max(0, u))); const dir = startEl[s].clone().normalize().lerp(finalEl[s].clone().normalize(), ke); dir.x += sx * (P.bump || 0) * Math.sin(Math.PI * Math.min(1, Math.max(0, u))); dir.y -= (P.drop || 0) * Math.sin(Math.PI * Math.min(1, Math.max(0, u))); dir.addScaledVector(axis, -dir.dot(axis)).normalize();
      const E = Sh.clone().addScaledVector(axis, x).addScaledVector(dir, h); void pole;
      const aim = (bone, child, to) => { const from = rig.wp[child].clone().sub(rig.wp[bone]).normalize(), want = to.clone().sub(rig.wp[bone]).normalize(); rig.turnWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, want)); rig.fk(); };
      aim(upper, lower, E); aim(lower, hand, target);
    } else { rig.reach(upper, lower, hand, target); rig.reach(upper, lower, hand, target); }
    const q = motionHand[s].clone().slerp(finalWq[s], turn).premultiply(new THREE.Quaternion().setFromAxisAngle(X, -pitch * Math.PI / 180));
    if (elbow > 1e-4) M.liftElbow(rig, s, elbow, 1, null);
    rig.setWorld(hand, q); rig.fk();
    const miss = rig.wp[hand].distanceTo(target); if (miss > .003) console.log('miss', t, s, miss.toFixed(4));
  }
  out[t] = keyFrom(m, snapLocal());
}
const existing = shot.people.cast.find(e => e.key === 'kai').postures['people-kai-wheel-type-31'].poseKeys.find(k => k.t === end);
const I = Object.fromEntries(['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'].map(n => [n, [0, 0, 0, 1]]));
const lin = { ease: 'linear' };
const docks = [{ t: start, pose: I, ...lin }, ...docksT.map(t => ({ t, pose: out[t], ...lin }))];
const kai = kaiT.map(t => ({ t, pose: out[t], ...lin }));
kai.push(existing);
fs.writeFileSync(P.out || 'keys.json', JSON.stringify({ 'kai-docks': { id: 'people-kai-wheel-roll', poseKeys: docks }, kai: { id: 'people-kai-wheel-type-31', poseKeys: kai } }, null, 1));
if (P.grid) {
  const gt = []; for (let f = Math.round(start * 60); f <= Math.round(end * 60); f++) gt.push(f / 60);
  const gb = await filmFrames({ shot, key: /^kai/, times: gt, edit: stripKai }), T = {};
  for (const r of gb) { const u = mj((r.t - start) / (end - start)); loadRow(r); T[r.t.toFixed(4)] = {}; for (const s of ['l', 'r']) { const mh = rig.wq[rig.side[s].arm[3]].clone(); const q = mh.slerp(finalWq[s], lerpTab(P.turn, u)).premultiply(new THREE.Quaternion().setFromAxisAngle(X, -lerpTab(P.pitch, u) * Math.PI / 180)); T[r.t.toFixed(4)][s] = { w: paths[s](u).toArray(), q: q.toArray() }; } }
  fs.writeFileSync(P.grid, JSON.stringify(T));
}
console.log('wrote', P.out || 'keys.json', 'docks', docks.map(k => k.t).join(' '), '| kai', kai.map(k => k.t).join(' '));
