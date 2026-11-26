// Noah's right wrist between drawing the touchscreen out and tapping it (the high school film): a change with
// `wrist: { r: { turn: 'pronate', ... } }` (room-people-motion.mjs turnWrist, arcFinger) turns the hand back through
// thumb-up to palm-down, the way a wrist can, instead of the +187 degrees round the back that the plain blend takes.
//   node tests/room-people-screen-wrist-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PersonRig, solveChange, actedKey, rollSplit } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/noah.json'), 'utf8')));
const DEG = 180 / Math.PI;
// (the film's own numbers: the pull moves the hand 142 mm along room +z with him turned -146 degrees)
const turned = -146 / DEG, by = new THREE.Vector3(-.142 * Math.sin(turned), 0, .142 * Math.cos(turned));
const from = actedKey(rig, rig.key('people-noah-stand-screen-pull'), { since: Infinity, dur: 1.1, by, press: null });
const to = rig.key('people-noah-stand-screen-tap');
// (as tools/experience/drafts/polish1124-noah/build.py writes it)
const WRIST = { r: { turn: 'pronate', over: [.06, .96], relax: .6, arc: { lift: .06, k: 1, p: .4 } } };
const build = fs.readFileSync(path.join(root, 'tools/experience/drafts/polish1124-noah/build.py'), 'utf8');
assert.ok(build.includes("WRIST = {'r': {'turn': 'pronate', 'over': [0.06, 0.96], 'relax': 0.6, 'arc': {'lift': 0.06, 'k': 1, 'p': 0.4}}}"), 'the draft writes what is tested here');

const at = (name, wp = rig.wp) => wp[rig.index.get(name)].clone();
// An arm's anatomy from its joints alone. sup: the forearm's rotation, from thumb-up as the elbow's own hinge has it (+ palm
// up, - palm down); flex: the wrist toward the back (+) or the palm (-) of the hand.
function anatomy(s) {
    const S = at('upperarm_' + s), E = at('lowerarm_' + s), W = at('hand_' + s);
    const u = E.clone().sub(S).normalize(), f = W.clone().sub(E).normalize(), thumbUp = u.clone().cross(f).normalize().cross(f).normalize();
    const d = at('middle_01_' + s).sub(W).normalize(), r = at('index_01_' + s).sub(at('pinky_01_' + s)).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(d, f));
    r.addScaledVector(f, -r.dot(f)).normalize();
    const side = s === 'r' ? 1 : -1, sup = side * Math.atan2(thumbUp.clone().cross(r).dot(f), thumbUp.dot(r)) * DEG;
    const back = r.clone().cross(f).multiplyScalar(side).normalize(), lat = d.clone().addScaledVector(f, -d.dot(f)).normalize(), bend = f.angleTo(d) * DEG;
    return { sup, flex: bend * lat.dot(back), dev: bend * lat.dot(r) };
}
const handRoll = s => rollSplit(rig.lq[rig.side[s].arm[3]]).roll * DEG;
const tip = (wp = rig.wp) => { const i3 = at('index_03_r', wp), i2 = at('index_02_r', wp); return i3.clone().add(i3.clone().sub(i2).setLength(.024)); };
const run = (wrist, f = from, z = to) => Array.from({ length: 199 }, (_, i) => {
    const w = (i + 1) / 200; solveChange(rig, f, z, w, null, null, false, wrist);
    return { w, roll: handRoll('r'), ...anatomy('r'), tip: tip(), wp: rig.wp.map(v => v.clone()), q: rig.lq.map(q => q.clone()) };
});
// the roll without its wrap at 180
const unwrap = rows => rows.reduce((out, r) => { const last = out.at(-1) ?? r.roll; out.push(last + THREE.MathUtils.euclideanModulo(r.roll - last + 180, 360) - 180); return out; }, []);

const old = run(null), now = run(WRIST), a = unwrap(old), b = unwrap(now);
// the fault, as it was: the roll goes UP from the pull's +71 through 180 to the tap's -102 (+187), the forearm further palm up
assert.ok(Math.max(...a) > 250 && old.some(r => Math.abs(r.sup) > 170), 'the plain blend rolls round the back');
// the fix: the roll only ever goes down, from the pull's to the tap's, nothing past either
for (let i = 1; i < b.length; i++) assert.ok(b[i] <= b[i - 1] + .05, `the hand turns one way only (w ${now[i].w}: ${b[i - 1].toFixed(1)} -> ${b[i].toFixed(1)})`);
solveChange(rig, from, to, 0, null, null, false, WRIST); const start = handRoll('r'), sup0 = anatomy('r').sup;
solveChange(rig, from, to, 1, null, null, false, WRIST); const end = handRoll('r'), sup1 = anatomy('r').sup;
assert.ok(Math.abs(start - 71) < 3 && Math.abs(end + 102) < 3 && Math.max(...b) <= start + .5 && Math.min(...b) >= end - .5, `roll ${start.toFixed(0)} -> ${end.toFixed(0)}`);
let rate = 0;
for (let i = 0; i < now.length; i++) {
    const r = now[i];
    assert.ok(r.sup <= sup0 + .5 && r.sup >= sup1 - 1.5, `forearm between its two ends at w ${r.w}: ${r.sup.toFixed(0)}`);
    assert.ok(r.flex >= -80 && r.flex <= 70, `wrist flexion within a human's at w ${r.w}: ${r.flex.toFixed(0)}`);
    // (deviation: between what the two postures themselves have, 77 radial at the screen's edge and 86 ulnar at the tap)
    assert.ok(r.dev <= 78 && r.dev >= -88, `deviation no further than the two postures' at w ${r.w}: ${r.dev.toFixed(0)}`);
    // (the change takes 1.417 s in the film, and a step here is 1/200 of it; the elbow and the arm move with it)
    if (i) rate = Math.max(rate, now[i - 1].q[rig.side.r.arm[3]].angleTo(r.q[rig.side.r.arm[3]]) * DEG / (1.417 / 200));
}
assert.ok(rate < 320, `the hand against the forearm turns ${rate.toFixed(0)} deg/s at most`);
// only the right arm differs from the plain blend
const arm = new Set([...rig.side.r.arm.slice(1), ...rig.side.r.fingers]);
now.forEach((r, i) => r.q.forEach((q, bone) => { if (!arm.has(bone)) assert.ok(q.angleTo(old[i].q[bone]) < 1e-6, `${rig.names[bone]} as it was`); }));
// both ends are the two postures exactly, and next to them there is no step
for (const [w, key] of [[0, from], [1, to], [.001, from], [.999, to]]) {
    solveChange(rig, from, to, w, null, null, false, WRIST);
    assert.ok(at('hand_r').distanceTo(key.wp[rig.side.r.arm[3]]) < .002 && tip().distanceTo(tip(key.wp)) < .004, `the posture itself at w ${w}`);
}
// the finger goes cleanly to the button: not through the open glass once the screen is up (7.1 s: w .43), and not far past
// the button (cast.py SCREEN_BUTTON / SCREEN_FACE, in the model's frame)
const button = new THREE.Vector3(0, 1.079, .414), face = new THREE.Vector3(.296, .848, -.439).normalize();
for (const r of now) {
    const off = r.tip.clone().sub(button), up = off.dot(face);
    if (r.w >= .43 && off.clone().addScaledVector(face, -up).length() < .13) assert.ok(up > 0, `over the glass at w ${r.w} (${(up * 1000).toFixed(0)} mm)`);
    assert.ok(off.x < .045, `the index finger stays by the button, w ${r.w}: ${(off.x * 1000).toFixed(0)} mm past`);
}
// a change that names no turn is solved as it always was
const same = run({ r: { relax: .6 } });
same.forEach((r, i) => r.q.forEach((q, bone) => assert.ok(q.angleTo(old[i].q[bone]) < 1e-6)));
// the left hand is mirrored: 'pronate' there turns it toward palm down too (from standing by, thumb forward, to typing)
{
    const wait = rig.key('people-noah-stand-wait'), type = rig.key('people-noah-stand-type');
    let last = null, first = null;
    for (let i = 0; i <= 40; i++) { solveChange(rig, wait, type, i / 40, [0, 1], null, false, { l: { turn: 'pronate' } }); const sup = anatomy('l').sup; first ??= sup; if (last !== null) assert.ok(sup <= last + 2, 'left forearm toward palm down'); last = sup; }
    assert.ok(first > 0 && last < -60, `left: ${first.toFixed(0)} -> ${last.toFixed(0)}`);
}
console.log(`PASS room people screen wrist: from the screen's edge to the tap the hand turns one way (roll ${start.toFixed(0)} -> ${end.toFixed(0)}, forearm ${sup0.toFixed(0)} -> ${sup1.toFixed(0)}), wrist flexion within ${Math.min(...now.map(r => r.flex)).toFixed(0)}..${Math.max(...now.map(r => r.flex)).toFixed(0)}, ${rate.toFixed(0)} deg/s at most.`);
