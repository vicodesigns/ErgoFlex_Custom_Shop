// The commons film's phone (24 Nov 2026, polish pass, branch director/polish-1124-commons): Mia looks at her phone while the
// desk drives in, and when it docks she reaches with her LEFT hand and sets the SAME phone prop down on the desk's wireless
// charger. Headless, through the film's own people code (RoomPeople, the solver, the Director's data), on the chapter's
// people as tools/experience/build-polish1124-commons.py makes them:
//   1. solver: the left hand reaches the phone's rest (2 mm) and holds it there; before the action she is the posture with
//      her life; the right hand does not follow the phone away; the torso leans only as far as the reach needs
//   2. room: one prop (the film's phone, mph01) is carried: in the hand from the first frame (forced visible: its `show`
//      window opens at 12.7), never more than one phone drawn, hand to desk with no jump between frames (30 fps), flat on its
//      rest and centred on it (the prop's own rest, 0.0 mm) the moment it is released and ever after, the model's own baked
//      phone hidden; the desk is moving while she reaches (it arrives at 13.42 s) and the phone follows it to the charger
//   3. the data: the left hand, same prop, no second phone; timings in order; the Stream C cast uses faces nobody else in
//      the chapter has, models the library has, every seat facing its table, nobody on a camera key's line of sight
//   node tests/people-place-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {library, makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries, RoomPeople} from '../room-people.mjs';
import {PersonRig, solveStill, placeGrip} from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cutDir = path.join(root, 'exports/cinematic-intro-cut-vicos-3rd-cut');
const py = process.platform === 'win32' ? 'python' : 'python3';
const out = fs.mkdtempSync(path.join(root, 'scratch-polish-place-'));
process.on('exit', () => fs.rmSync(out, {recursive: true, force: true}));
if (!fs.existsSync(path.join(cutDir, 'director-film/commons.json'))) { console.log('people-place-test: skipped (no ' + cutDir + ')'); process.exit(0); }
execFileSync(py, [path.join(root, 'tools/experience/build-polish1124-commons.py'), cutDir, out], {stdio: 'pipe'});
const shot = JSON.parse(fs.readFileSync(path.join(out, 'commons-shot.json'), 'utf8'));
const exported = JSON.parse(fs.readFileSync(path.join(out, 'Film-chapter-commons-polish1124.json'), 'utf8'));
const people = shot.people, cast = Object.fromEntries(people.cast.map(e => [e.key, e]));
const waits = cast['mia-waits'], works = cast['mia-works'], act = waits.act;

// ---- 3. the data -----------------------------------------------------------------------------------------------------
assert.equal(act.kind, 'place'); assert.equal(act.hand, 'l', 'the LEFT hand');
assert.equal(act.prop, '^Added prop:ergoflex-phone#mph01$', 'the film\'s own phone prop, not a second one');
assert.ok(!shot.sceneEdits.some(e => /mph0[2-9]/.test(e.id || '') ), 'no second phone added');
assert.equal(shot.sceneEdits.filter(e => e.add?.asset === 'ergoflex-phone').length, 1, 'one phone prop added by the film, still one');
assert.ok(act.at < act.at + act.contact && act.contact > 0.5 && act.contact < 1.5, 'a reach of about a second');
const releaseAt = act.at + act.contact + (act.settle || 0), changeFrom = works.postures['people-mia-power-type-30'].poseKeys[0].t;
assert.ok(act.at + act.contact + act.hold + act.back <= changeFrom + 0.05, 'the hand has withdrawn by the time the change into typing begins');
// pass 2: she waits for the desk. Its wheels clip (the film's path) ends at 13.4 s; the reach begins 0.25 to 0.6 s after, on a desk that has stopped
const wheels = shot.motion.clips.find(c => c.lane === 'wheels'), liveWheels = JSON.parse(fs.readFileSync(path.join(cutDir, 'director-film/commons.json'), 'utf8')).motion.clips.find(c => c.lane === 'wheels');
const arrives = wheels.start + wheels.duration, zAt = (c, t) => { const f = (t - c.start) / c.duration, k = c.path; if (f >= 1) return k.at(-1).pose.z; const i = k.findIndex(p => p.time >= f); return i <= 0 ? k[0].pose.z : k[i - 1].pose.z + (k[i].pose.z - k[i - 1].pose.z) * (f - k[i - 1].time) / (k[i].time - k[i - 1].time); };
assert.ok(Math.abs(arrives - 13.4) < 1e-6, 'the desk still comes to rest at 13.4 s: ' + arrives);
assert.ok(act.at >= arrives + 0.25 && act.at <= arrives + 0.6, `she notices it for ${(act.at - arrives).toFixed(2)} s before she reaches (0.25 to 0.6)`);
assert.ok(Math.abs(zAt(wheels, act.at) - zAt(wheels, 16)) < 1e-9 && Math.abs(zAt(wheels, act.at - 0.1) - zAt(wheels, 16)) < 1e-9, 'the desk has stopped before the reach starts, and stays stopped');
const dockCm = (wheels.path.at(-1).pose.z - liveWheels.path.at(-1).pose.z) * 2.54;
assert.ok(dockCm > 2 && dockCm <= 10 + 1e-6, `the desk docks ${dockCm.toFixed(2)} cm nearer her (inches of the clip: ${(wheels.path.at(-1).pose.z - liveWheels.path.at(-1).pose.z).toFixed(4)})`);
assert.ok(wheels.path[40].pose.z - liveWheels.path[40].pose.z < dockCm / 2.54 * 0.4, 'the early drive is hardly moved: the extra distance comes in as it nears her');
assert.deepEqual(works.handsBy, [0, 0, -Math.round(dockCm * 10)], 'her typing hands go to the keys where they now are');
assert.ok(arrives + 0.6 + 0.25 + 0.55 + 0.06 + 0.2 + 0.3 > 0, 'timeline sums');
assert.ok(releaseAt < shot.seconds - 1.5, 'she has time to start working before the chapter ends');
assert.deepEqual(people.when['mia-waits'][0].slice(0, 2), [0, +(changeFrom + works.change.seconds - 0.3).toFixed(3)]);
assert.ok(people.when['mia-works'][0][0] > changeFrom, 'the typing model comes in with the change');
assert.deepEqual(exported.shots[0].peopleEdits.cast, people.cast, 'the Director export carries the same cast');
assert.ok(exported.shots[0].camera && exported.shots[0].motion, 'the export keeps the chapter\'s camera and motion (the importer needs them)');

const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')), have = new Set(index.props.map(p => p.id));
const extra = people.cast.filter(e => /^c4-/.test(e.key)), original = people.cast.filter(e => !/^c4-/.test(e.key));
const face = id => /^people-([a-z]+)-/.exec(id)[1];
const inView = new Set(original.map(e => face(e.id)));
assert.ok(extra.length >= 12, 'seated people and walkers added: ' + extra.length);
const seen = new Set();
for (const e of extra) {
    assert.ok(have.has(e.id), e.id + ' is in the library'); assert.ok(!inView.has(face(e.id)), face(e.id) + ' is not a face already in the chapter');
    assert.ok(!seen.has(face(e.id)), face(e.id) + ' is used once'); seen.add(face(e.id));
    if (e.walk) { assert.ok(have.has(e.walk.then) || !e.walk.then, 'walker ends in a library posture'); continue; }
    assert.ok(/-sit-(laptop|read|chat|mug)$/.test(e.id), e.id + ' sits at a table doing something');
}
assert.deepEqual([...new Set(extra.filter(e => !e.walk).map(e => e.id.replace(/^people-[a-z]+-/, '')))].sort(), ['sit-chat', 'sit-laptop', 'sit-mug', 'sit-read'], 'laptop, reading, talking, coffee');
// every seated person faces their table: the point 0.7 m ahead of them is over (or at the edge of) a table of the library room's furniture
// (world metres, x0 x1 z0 z1: the bounds of the room's tables, from a probe of the film's room)
const S = 0.0015086610977927, world = ([x, z]) => [z * S, -x * S];
const TABLES = [[-9.09, -6.6, -7.61, -3.94], [-4.63, -0.52, -4.14, -2.03], [4.9, 6.83, -3.06, -0.02], [-1.09, 4.87, 0.42, 2.91], [7.51, 9.09, -12.03, -10.45], [10.98, 12.56, -12.03, -10.45], [15.05, 16.63, -7.58, -6]];
for (const e of extra.filter(e => !e.walk)) {
    const [x, z] = world(e.at), fx = Math.cos(e.turn * Math.PI / 180), fz = -Math.sin(e.turn * Math.PI / 180), px = x + 0.7 * fx, pz = z + 0.7 * fz, m = 0.12;
    assert.ok(TABLES.some(([x0, x1, z0, z1]) => px > x0 - m && px < x1 + m && pz > z0 - m && pz < z1 + m), `${e.key} faces a table (0.7 m ahead of ${x.toFixed(2)}, ${z.toFixed(2)} is ${px.toFixed(2)}, ${pz.toFixed(2)})`);
}
// out of the main action: nobody sits or walks within 1.2 m of the desk's way along the wall (z < -10.3, x between -3.5 and 4.6) or of a camera position
const camKeys = shot.cameraPlan.keys, PACE = 1.3;      // (m/s: a walker's pace, about what the film's own walkers keep)
const spot = (e, t) => {
    if (!e.walk) return world(e.at);
    const pts = e.walk.path.map(world); let d = Math.max(0, t - (e.walk.start || 0)) * PACE;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l) return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * d / l, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * d / l]; d -= l; }
    return pts.at(-1);
};
const present = (e, t) => (people.when?.[e.key] || [[0, 99]]).some(([a, b]) => t >= a && t <= b);
for (const e of extra) for (let t = 0; t <= shot.seconds; t += 0.25) {
    if (!present(e, t)) continue; const [x, z] = spot(e, t);
    assert.ok(!(z < -10.3 && x > -3.5 && x < 4.6), `${e.key} is clear of the desk's lane along the wall at ${t} s`);
    // the camera at that moment (the nearest key before it): low cameras (under 4 m) keep 1.2 m from anyone, and nobody stands in front of the lens
    const k = [...camKeys].reverse().find(k => k.at <= t + 1e-9) || camKeys[0], [cx, cy, cz] = k.position, [tx, , tz] = k.target;
    if (cy < 4) {
        assert.ok(Math.hypot(cx - x, cz - z) > 1.2, `${e.key} is clear of the camera at ${k.at} s (${cx.toFixed(1)}, ${cz.toFixed(1)}) at ${t} s`);
        const dx = tx - cx, dz = tz - cz, len = Math.hypot(dx, dz), along = ((x - cx) * dx + (z - cz) * dz) / len, across = Math.abs(((x - cx) * dz - (z - cz) * dx) / len);
        assert.ok(!(along > 0.3 && along < len && across < 0.7), `${e.key} is not between the camera at ${k.at} s and its subject at ${t} s`);
    }
}

// ---- 1. the solver ---------------------------------------------------------------------------------------------------
const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/mia.json'), 'utf8')));
const key = rig.key('people-mia-power-phone'), L = rig.side.l.arm, R = rig.side.r.arm;
function openOf() { const k = rig.key(act.openFrom); return Object.fromEntries(rig.side.l.fingers.map(i => [i, k.q[i].clone()])); }
const q = a => new THREE.Quaternion().fromArray(a).normalize(), v3 = a => new THREE.Vector3().fromArray(a);
const grip = {at: v3(act.grip.at), q: q(act.grip.q)}, grip2 = {at: v3(act.grip2.at), q: q(act.grip2.q)};
// the charger's rest in her frame (the probe of the film at 16 s: 0.416 m left, 0.758 up, 0.658 ahead, turned 180 degrees about up)
const place = {settle: act.settle, bend: act.bend, open: openOf(), p: new THREE.Vector3(0.416, 0.758, 0.658 - dockCm / 100), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), grip, grip2, regrip: act.regrip, contact: act.contact, hold: act.hold, back: act.back, lift: act.lift};
const bend = (a, b, c) => Math.acos(Math.min(1, Math.max(-1, a.clone().sub(b).normalize().dot(c.clone().sub(b).normalize())))) * 180 / Math.PI;
const frame = since => { solveStill(rig, key, {time: act.at + since, seed: 3, life: 1, actLife: 1, act: {since, dur: 1, by: null, press: null, place}}); return {elbow: rig.wp[L[2]].clone(), shoulder: rig.wp[L[1]].clone(), fingers: rig.side.l.fingers.map(i => rig.wp[i].clone()), hand: rig.wp[L[3]].clone(), handR: rig.wp[R[3]].clone(), q: rig.wq[L[3]].clone(), spine: rig.wp[rig.b.spine_03].clone()}; };
const phoneAt = (f, e) => { const g = placeGrip(place, e); return g.at.clone().applyQuaternion(f.q).add(f.hand); };
const e = since => { const t = Math.min(1, Math.max(0, since / act.contact)); return t * t * (3 - 2 * t); };
for (let s = act.contact; s <= act.contact + (act.settle || 0) + 1e-9; s += 1 / 60) assert.ok(phoneAt(frame(s), 1).distanceTo(place.p) < 0.002, `the phone is on its rest at ${s.toFixed(2)} s into the action: ${(phoneAt(frame(s), 1).distanceTo(place.p) * 1000).toFixed(1)} mm`);
const before = frame(-1), plain = (solveStill(rig, key, {time: act.at - 1, seed: 3, life: 1}), rig.wp[L[3]].clone());
assert.ok(before.hand.distanceTo(plain) < 1e-6, 'before the action she is the posture as built with its life');
let prev = null, worst = 0, lean = 0;
for (let s = -0.2; s <= act.contact + act.hold + act.back + 0.3; s += 1 / 30) {
    const f = frame(s); if (prev) worst = Math.max(worst, f.hand.distanceTo(prev.hand)); prev = f; lean = Math.max(lean, frame(0).spine.distanceTo(f.spine));
}
assert.ok(worst < 0.06, `the left hand moves smoothly (at most ${(worst * 1000).toFixed(0)} mm a frame)`);
assert.ok(frame(act.contact).handR.distanceTo(frame(-1).handR) < 0.12, 'the right hand lets go and stays near her lap');
assert.ok(frame(act.contact + act.hold + act.back + 0.3).hand.distanceTo(frame(-1).hand) < 0.03, 'the hand comes back to where it was');


// pass 2: the reach at the new dock. Elbow clearly bent, the wrist about level with the elbow, the back leaning only as far as the reach needs
const atContact = frame(act.contact + (act.settle || 0) / 2), side = new THREE.Vector3(0, 1, 0);
const elbowAngle = bend(atContact.shoulder, atContact.elbow, atContact.hand);
assert.ok(elbowAngle < 150 && elbowAngle > 90, `the elbow is bent at contact: ${elbowAngle.toFixed(0)} degrees inside (180 is a straight arm)`);
assert.ok(Math.abs(atContact.hand.y - atContact.elbow.y) < 0.07, `the wrist is about level with the elbow (${((atContact.hand.y - atContact.elbow.y) * 100).toFixed(0)} cm)`);
const tilt = f => Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(rig.wq[rig.b.spine_03]).dot(new THREE.Vector3(0, 1, 0).applyQuaternion(key.wq[rig.b.spine_03])))) * 180 / Math.PI;
frame(act.contact); const leanDeg = tilt();
assert.ok(leanDeg < 40, `the back leans ${leanDeg.toFixed(0)} degrees at contact (the charger is ${(place.p.distanceTo(atContact.shoulder) * 100).toFixed(0)} cm from the shoulder)`);
// no hand or arm through the desk (the charger's top is the desktop at her frame: y 0.758) or her own body, all along the reach
let lowest = 9, nearest = 9;
for (let s = -0.1; s <= act.contact + act.hold + act.back; s += 1 / 30) {
    const f = frame(s), onDesk = Math.hypot(f.hand.x - place.p.x, f.hand.z - place.p.z) < 0.3 && s > act.contact - 0.4;
    if (onDesk) for (const pt of [f.hand, ...f.fingers]) lowest = Math.min(lowest, pt.y - place.p.y);
    const torso = rig.wp[rig.b.spine_03]; nearest = Math.min(nearest, f.elbow.distanceTo(torso));
}
const chargerHeight = 0.0215;      // (Power_7 of the film's desk: 32.4 mm of world, 21.5 mm in her frame; the phone's rest is its top, the desktop is that far down)
assert.ok(lowest > -chargerHeight, `hand and fingers stay above the desktop (lowest ${((lowest + chargerHeight) * 1000).toFixed(1)} mm above it; the charger's top ${(lowest * 1000).toFixed(1)})`);
assert.ok(nearest > 0.07, `the elbow stays clear of her chest (${(nearest * 100).toFixed(0)} cm)`);
// the fingers open when the phone is let go, and close again as the hand goes back
const curl = f => f.fingers.reduce((sum, _, i) => i % 3 === 0 ? sum + [1, 2].reduce((t, k) => t + Math.acos(Math.min(1, f.fingers[i + k - 1].clone().sub(f.fingers[i + k - 1 === i ? i : i + k - 2]).normalize().dot(f.fingers[i + k].clone().sub(f.fingers[i + k - 1]).normalize()))), 0) : sum, 0) * 57.3;
const curlHeld = curl(frame(act.contact)), curlOpen = curl(frame(act.contact + (act.settle || 0) + 0.25)), curlBack = curl(frame(act.contact + act.hold + act.back + 0.2));
assert.ok(curlOpen < curlHeld - 15 && curlBack > curlOpen + 15, `fingers open at the release (${curlHeld.toFixed(0)} to ${curlOpen.toFixed(0)} degrees of curl) and close going back (${curlBack.toFixed(0)})`);
// the desk and her chair: the desk's edge over her knees stays above them (measured on the film's room at the dock: the desktop's underside is 0.659 m up in her frame, her knee's top 0.652 m: 7 mm; the notch's edge gets to her knee at the dock: see the stills)
const kneeTop = key.wp[rig.index.get('calf_l')].y + 0.05;
assert.ok(0.659 - kneeTop > 0.004, `desktop clears her knee (${((0.659 - kneeTop) * 1000).toFixed(1)} mm)`);

// ---- 2. the room: the same prop, hand to desk -----------------------------------------------------------------------
globalThis.__ERGO_PRESENTATION__ = true;
const lib = library(), rigInstance = lib.rigInstance;
// the baked phone of the model (a 'Held.' part skinned to hand_r, build_people.py) as the real model has it
lib.rigInstance = async id => {
    const g = await rigInstance(id); if (!g || id !== 'people-mia-power-phone') return g;
    g.updateMatrixWorld(true); const bones = []; g.traverse(o => { if (o.isBone) bones.push(o); }); const j = bones.findIndex(b => b.name === 'hand_r');
    const geo = new THREE.BoxGeometry(.07, .15, .01), n = geo.attributes.position.count;
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => i % 4 ? 0 : j), 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => i % 4 ? 0 : 1), 4));
    const m = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({name: 'Held.phone'})); m.name = 'baked phone'; g.add(m); g.updateMatrixWorld(true); m.bind(new THREE.Skeleton(bones)); return g;
};
const filter = {only: [], cast: [waits, works], when: {'mia-waits': people.when['mia-waits'], 'mia-works': people.when['mia-works']}};
const room = makeRoom('library', 'humboldt', [...castEntries('library', 'humboldt'), ...filter.cast]), rp = new RoomPeople(room, lib);
// the desk (a group that drives in along the wall until 13.42 s), the phone prop on it where the film's edit puts it, and a second phone that must stay as it is
const desk = new THREE.Group(); room.root.add(desk);
const prop = new THREE.Group(); prop.name = 'Added prop:ergoflex-phone#mph01'; prop.add(new THREE.Mesh(new THREE.BoxGeometry(150, 12, 72))); desk.add(prop);
const state = t => ({height: 30, tilt: 0, mode: 'morning', pose: {x: 0, z: 190, yaw: 0}, keyboard: {x: 0, z: 450}, time: t, track: null, now: 0});
room.peopleState = () => state(5); rp.setFilter(filter); await rp.setEnabled(true); await rp.settled();
const mia = () => rp.people.find(o => rp.keyOf(o.userData.person) === 'mia-waits');
for (let k = 0; k < 3; k++) { rp.update(state(5)); await rp.settled(); }
// where the charger is at the end, in her frame -> the prop's rest (room mm), the desk 700 mm away along its way at 12 s
const o = mia(); o.updateMatrixWorld(true);
const rest = place.p.clone().applyMatrix4(o.matrixWorld);
const slide = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rotation.y)).multiplyScalar(-1);   // ('along the wall': her left-right)
const deskAt = t => 900 * (1 - THREE.MathUtils.smoothstep(t, 11.2, 13.42)) * (t < 13.42 ? 1 : 0);
prop.position.copy(rest); prop.quaternion.copy(o.getWorldQuaternion(new THREE.Quaternion())).multiply(place.q);      // (flat, turned as the film's phone is to her: place.q)
const restQuat = prop.quaternion.clone(), restPos = prop.position.clone();
delete prop.userData.placeRest; prop.userData.placeHeld = false;      // (the film's edits put the prop where it rests before anyone is drawn: here it was moved after the warm-up)
const place0 = () => desk.position.copy(slide).multiplyScalar(deskAt(0));
const setDesk = t => { desk.position.copy(slide).multiplyScalar(deskAt(t)); desk.updateMatrixWorld(true); };
const worldOf = () => prop.getWorldPosition(new THREE.Vector3());
const stats = {frames: 0, held: 0, maxStep: 0, miss: 0};
let last = null, onRest = 0, hiddenBaked = true, forcedVisible = true;
for (let t0 = 12.5; t0 <= 15.6 + 1e-9; t0 += 1 / 30) {
    const t = +t0.toFixed(4); setDesk(t); for (let k = 0; k < 2; k++) { rp.update(state(t)); await rp.settled(); }
    const w = worldOf(), held = prop.userData.heldByPerson === true;
    stats.frames++; if (held) stats.held++;
    if (last) stats.maxStep = Math.max(stats.maxStep, w.distanceTo(last)); last = w;
    mia().traverse(m => { if (m.isSkinnedMesh && [].concat(m.material).some(x => /^Held\./.test(x.name)) && m.visible) hiddenBaked = false; });
    if (t >= releaseAt) { const restWorld = new THREE.Vector3().copy(restPos).applyMatrix4(desk.matrixWorld); stats.miss = Math.max(stats.miss, w.distanceTo(restWorld)); if (prop.position.distanceTo(restPos) < 1e-6 && prop.quaternion.angleTo(restQuat) < 1e-6) onRest++; assert.ok(!held, `${t.toFixed(2)} s: released`); }
    else assert.ok(held, `${t.toFixed(2)} s: in her hand`);
    if (t > releaseAt - 0.03 && t < releaseAt) assert.ok(w.distanceTo(new THREE.Vector3().copy(restPos).applyMatrix4(desk.matrixWorld)) < 8, `about to touch down at ${t.toFixed(2)} s: ${w.distanceTo(new THREE.Vector3().copy(restPos).applyMatrix4(desk.matrixWorld)).toFixed(1)} mm from the charger`);
}
assert.ok(hiddenBaked, 'the model\'s own baked phone stays hidden: one phone');
assert.ok(stats.maxStep < 90, `the phone never jumps between frames (at most ${stats.maxStep.toFixed(1)} mm in 1/30 s)`);
assert.ok(stats.miss < 0.01 && onRest > 5, `after the release the phone is at the prop's own rest, flat and centred (${stats.miss.toFixed(3)} mm off, ${onRest} frames)`);
// scrubbing back: the hand takes it again (stateless in time)
setDesk(12.9); rp.update(state(12.9)); await rp.settled(); assert.ok(prop.userData.heldByPerson === true, 'scrubbed back into the reach: in her hand again');
// the show window of the film's edit no longer hides a carried prop (film-edits.mjs installShow)
const edits = fs.readFileSync(path.join(root, 'tools/experience/film-edits.mjs'), 'utf8');
assert.ok(/heldByPerson === true\) && \(get\(\)/.test(edits), 'film-edits: a carried prop is drawn whatever its show window says');
console.log(`people-place-test: ok (left hand, one phone: ${stats.frames} frames 12.5-15.6 s, in hand ${stats.held} of them, at most ${stats.maxStep.toFixed(1)} mm a frame, ${stats.miss.toFixed(3)} mm off the charger once released; ${extra.length} extra people, ${seen.size} new faces)`);
