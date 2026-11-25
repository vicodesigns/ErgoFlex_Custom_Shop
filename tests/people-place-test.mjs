// The commons film's phone (polish passes of 24 Nov 2026, branch director/polish-1124-commons): Mia looks at her phone while
// the desk drives in; when it has docked she sets the SAME phone prop down on the desk's wireless charger with her LEFT hand
// and goes straight on to the keys. Headless, through the film's own people code (RoomPeople, the solver, the Director's
// data), on the chapter's people as tools/experience/build-polish1124-commons.py makes them from the cut.
// Pass 3 (Vico's notes on 1:46.55-1:48.05, after his own desk edit: lift 29 in, dock z 150.5):
//   1. the hands against the phone: every frame (1/30 s, 1/60 s through the grab) from the reach to the hands on the keys,
//      every skinned vertex of both hands and wrists (tests/fixtures/mia-hands-phone.json, from the render) is outside the
//      phone's box: no thumb or finger through it
//   2. the wrist on the way back: shortest arc (the twist about the forearm only ever goes one way, a few degrees a frame,
//      no flip), the palm down all the way, and over the whole beat no turn faster than ~30 degrees a frame, the wrist never
//      bent back further than 70 degrees
//   3. no pose of holding a phone after it is let go: both hands keep away from where they held it, the left hand goes from
//      the charger to the keys without stopping, the head comes up (the eyes to the screen, not the empty hands), and the
//      change to the typing model moves nothing (the action ends in that posture)
//   4. the reach at the new desk: the elbow bent at the charger, the back leaning little, the head up
//   5. kept: one phone (in the hand, then at the prop's own rest, 0 mm off, released at the glow cue's time), the 14 extras,
//      Vico's desk exactly as he set it (nothing here moves it)
// Commons4 (Vico's three yeses on Commons3's 'not fixed' list), section 6: her seat 5 mm lower so the keyboard tray clears her thighs (it was
// 3.1 to 3.8 mm into them at 29 in), the wheelchair 20 mm further back (a Director prop edit; the desk is not moved) so the keyboard's end is clear of
// the armrest and joystick (checked to 0.7 mm, not on the 5 mm grid), the typing pose still fits (handsBy; the fingertips as high above the keys as before)
//   node tests/people-place-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {library, makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries, RoomPeople} from '../room-people.mjs';
import {placeTimes} from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cutDir = path.join(root, 'exports/cinematic-intro-cut-vicos-3rd-cut');
const py = process.platform === 'win32' ? 'python' : 'python3';
const out = fs.mkdtempSync(path.join(root, 'scratch-polish-place-'));
process.on('exit', () => fs.rmSync(out, {recursive: true, force: true}));
if (!fs.existsSync(path.join(cutDir, 'director-film/commons.json'))) { console.log('people-place-test: skipped (no ' + cutDir + ')'); process.exit(0); }
execFileSync(py, [path.join(root, 'tools/experience/build-polish1124-commons.py'), cutDir, out], {stdio: 'pipe'});
const shot = JSON.parse(fs.readFileSync(path.join(out, 'commons-shot.json'), 'utf8'));
const live = JSON.parse(fs.readFileSync(path.join(cutDir, 'director-film/commons.json'), 'utf8'));
const exported = JSON.parse(fs.readFileSync(path.join(out, 'Film-chapter-commons-polish1124.json'), 'utf8'));
const cue = JSON.parse(fs.readFileSync(path.join(out, 'phone-cue-patch.json'), 'utf8'));
const people = shot.people, cast = Object.fromEntries(people.cast.map(e => [e.key, e]));
const waits = cast['mia-waits'], works = cast['mia-works'], act = waits.act;
const T = placeTimes(act), at = t => act.at + t, grabAt = at(T.grab), contactAt = at(T.contact), releaseAt = at(T.release), endAt = at(T.end);

// ---- 5. the data -----------------------------------------------------------------------------------------------------
assert.equal(act.kind, 'place'); assert.equal(act.hand, 'l', 'the LEFT hand');
assert.equal(act.prop, '^Added prop:ergoflex-phone#mph01$', 'the film\'s own phone prop, not a second one');
assert.ok(!shot.sceneEdits.some(e => /mph0[2-9]/.test(e.id || '')), 'no second phone added');
assert.equal(shot.sceneEdits.filter(e => e.add?.asset === 'ergoflex-phone').length, 1, 'one phone prop added by the film, still one');
assert.equal(act.to, works.id, 'the action ends in the typing model\'s own posture');
assert.deepEqual(act.handsBy, works.handsBy, 'with its hands where the typing model has them');
assert.ok(act.at < grabAt && grabAt < contactAt && contactAt < releaseAt && releaseAt < endAt, 'grab, touch down, let go, on the keys: in order');
// Vico's desk as he set it: every motion clip of the draft is the cut's own (lift 29 in and the wheels' end z 150.5 in his live cut)
assert.deepEqual(shot.motion, live.motion, 'the desk\'s motion is the cut\'s own: nothing here moves it');
assert.deepEqual(exported.shots[0].motion, JSON.parse(fs.readFileSync(path.join(cutDir, 'director-import/ErgoFlex-film-ch04-commons-director.json'), 'utf8')).shots[0].motion, 'the export carries the Director\'s own desk motion unchanged');
const wheels = shot.motion.clips.find(c => c.lane === 'wheels'), arrives = wheels.start + wheels.duration;
assert.ok(act.at >= arrives + 0.15 && act.at <= arrives + 0.6, `she notices the desk has docked ${(act.at - arrives).toFixed(2)} s before she moves (0.15 to 0.6)`);
assert.ok(Math.abs(contactAt - 14.45) < 0.2, `the phone touches down at ${contactAt.toFixed(2)} s (about 1:46.8 of the film)`);
assert.ok(endAt > 14.8 && endAt < 15.35, `the hands are on the keys at ${endAt.toFixed(2)} s (about 15 s)`);
assert.ok(Math.abs(cue.emissiveIntensity[0][0] - +releaseAt.toFixed(2)) < 1e-9, `the phone's glow cue starts where it is let go (${cue.emissiveIntensity[0][0]} s)`);
// the change of model comes right after the action and is centred 0.3 s after it ends (the change is 0.6 s)
assert.deepEqual(people.when['mia-waits'][0].slice(0, 2), [0, +(endAt + 0.3).toFixed(3)]);
assert.equal(people.when['mia-works'][0][0], +(endAt + 0.3).toFixed(3));
assert.ok(works.postures[works.id].poseKeys.length === 1, 'the typing model holds Vico\'s typing arms from its first frame (no drift of the arms after the hands land)');
assert.deepEqual(exported.shots[0].peopleEdits.cast, people.cast, 'the Director export carries the same cast');
assert.ok(exported.shots[0].camera && exported.shots[0].motion, 'the export keeps the chapter\'s camera and motion (the importer needs them)');

const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')), have = new Set(index.props.map(p => p.id));
const extra = people.cast.filter(e => /^c4-/.test(e.key)), original = people.cast.filter(e => !/^c4-/.test(e.key));
const face = id => /^people-([a-z]+)-/.exec(id)[1];
const inView = new Set(original.map(e => face(e.id)));
assert.equal(extra.length, 14, 'the 14 extras (11 seated, 3 walkers): ' + extra.length);
const seen = new Set();
for (const e of extra) {
    assert.ok(have.has(e.id), e.id + ' is in the library'); assert.ok(!inView.has(face(e.id)), face(e.id) + ' is not a face already in the chapter');
    assert.ok(!seen.has(face(e.id)), face(e.id) + ' is used once'); seen.add(face(e.id));
    if (e.walk) { assert.ok(have.has(e.walk.then) || !e.walk.then, 'walker ends in a library posture'); continue; }
    assert.ok(/-sit-(laptop|read|chat|mug)$/.test(e.id), e.id + ' sits at a table doing something');
}
// every seated person faces their table (world metres: the bounds of the library room's tables, from a probe of the film's room)
const S = 0.0015086610977927, world = ([x, z]) => [z * S, -x * S];
const TABLES = [[-9.09, -6.6, -7.61, -3.94], [-4.63, -0.52, -4.14, -2.03], [4.9, 6.83, -3.06, -0.02], [-1.09, 4.87, 0.42, 2.91], [7.51, 9.09, -12.03, -10.45], [10.98, 12.56, -12.03, -10.45], [15.05, 16.63, -7.58, -6]];
for (const e of extra.filter(e => !e.walk)) {
    const [x, z] = world(e.at), fx = Math.cos(e.turn * Math.PI / 180), fz = -Math.sin(e.turn * Math.PI / 180), px = x + 0.7 * fx, pz = z + 0.7 * fz, m = 0.12;
    assert.ok(TABLES.some(([x0, x1, z0, z1]) => px > x0 - m && px < x1 + m && pz > z0 - m && pz < z1 + m), `${e.key} faces a table`);
}

// ---- the film's people code on Mia, frame by frame ---------------------------------------------------------------------
const FX = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/mia-hands-phone.json'), 'utf8'));
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
// the desk (a group that drives in along the wall until 13.4 s) and the phone prop on it, resting where the live film has it in her frame
const desk = new THREE.Group(); room.root.add(desk);
const prop = new THREE.Group(); prop.name = 'Added prop:ergoflex-phone#mph01'; prop.add(new THREE.Mesh(new THREE.BoxGeometry(150, 12, 72))); desk.add(prop);
const state = t => ({height: 29, tilt: 0, mode: 'morning', pose: {x: 0, z: 190, yaw: 0}, keyboard: {x: 0, z: 450}, time: t, track: null, now: 0});
room.peopleState = () => state(5); rp.setFilter(filter); await rp.setEnabled(true); await rp.settled();
const mias = () => rp.people.filter(o => /^mia-/.test(rp.keyOf(o.userData.person)));
for (let k = 0; k < 3; k++) { rp.update(state(5)); await rp.settled(); }
const o0 = mias().find(o => o.visible && rp.keyOf(o.userData.person) === 'mia-waits'); o0.updateMatrixWorld(true);
const restPos = new THREE.Vector3().fromArray(FX.phone.p).applyMatrix4(o0.matrixWorld), restQuat = o0.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().fromArray(FX.phone.q));
const slide = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o0.rotation.y));
const deskAt = t => t < 13.4 ? 900 * (1 - THREE.MathUtils.smoothstep(t, 11.2, 13.4)) : 0;
prop.position.copy(restPos); prop.quaternion.copy(restQuat); delete prop.userData.placeRest; prop.userData.placeHeld = false;
const setDesk = t => { desk.position.copy(slide).multiplyScalar(deskAt(t)); desk.updateMatrixWorld(true); };
// one frame: Mia's drawn bones (model frame: position, turn, scale) and the phone in her frame
const V = () => new THREE.Vector3(), Qn = () => new THREE.Quaternion();
async function frameAt(t) {
    setDesk(t); for (let k = 0; k < 2; k++) { rp.update(state(t)); await rp.settled(); }
    const shown = mias().filter(o => o.visible && o.userData.personRig); assert.equal(shown.length, 1, `${t.toFixed(3)} s: one Mia drawn`);
    const o = shown[0]; o.updateWorldMatrix(true, true); const inv = o.matrixWorld.clone().invert(), bones = {};
    for (const [n, b] of o.userData.personRig.bones) { b.updateWorldMatrix(true, false); const p = V(), q = Qn(), s = V(); inv.clone().multiply(b.matrixWorld).decompose(p, q, s); bones[n] = {p, q, s: s.x}; }
    prop.updateWorldMatrix(true, false); const pp = V(), pq = Qn(), ps = V(); inv.clone().multiply(prop.matrixWorld).decompose(pp, pq, ps);
    let baked = false; o.traverse(m => { if (m.isSkinnedMesh && [].concat(m.material).some(x => /^Held\./.test(x.name)) && m.visible) baked = true; });
    return {t, who: rp.keyOf(o.userData.person), bones, phone: {p: pp, q: pq}, held: prop.userData.heldByPerson === true, baked, world: prop.getWorldPosition(V())};
}
// the hands' skin: each vertex the weighted sum of its bones' transforms
const skinPts = (f, side) => FX.verts.filter(v => v[0][0].endsWith('_' + side)).map(v => v.reduce((acc, [n, w, x, y, z]) => { const b = f.bones[n]; return acc.addScaledVector(V().set(x, y, z).multiplyScalar(b.s).applyQuaternion(b.q).add(b.p), w); }, V()));
const lo = V().fromArray(FX.phone.min), hi = V().fromArray(FX.phone.max);
function depth(f, side) {      // (how far the deepest vertex is inside the phone's box, metres; negative: the nearest is that far outside)
    const iq = f.phone.q.clone().invert(); let worst = -1;
    for (const p of skinPts(f, side)) { const l = p.clone().sub(f.phone.p).applyQuaternion(iq); worst = Math.max(worst, Math.min(l.x - lo.x, hi.x - l.x, l.y - lo.y, hi.y - l.y, l.z - lo.z, hi.z - l.z)); }
    return worst;
}
const dir = (a, b) => b.clone().sub(a).normalize();
const palmOf = f => { const h = f.bones.hand_l.p; return dir(h, f.bones.index_01_l.p).cross(dir(h, f.bones.pinky_01_l.p)).normalize().negate(); };      // (the way the left palm faces)
function twistOf(f) {      // (the left hand's turn about the forearm, relative to the forearm bone: swing-twist, degrees)
    const ql = f.bones.lowerarm_l.q, rel = ql.clone().invert().multiply(f.bones.hand_l.q), axis = f.bones.hand_l.p.clone().sub(f.bones.lowerarm_l.p).applyQuaternion(ql.clone().invert()).normalize();
    const p = rel.x * axis.x + rel.y * axis.y + rel.z * axis.z, a = 2 * Math.atan2(p, rel.w) * 180 / Math.PI; return ((a + 540) % 360) - 180;
}
const extension = f => { const fing = dir(f.bones.hand_l.p, f.bones.middle_01_l.p), a = dir(f.bones.lowerarm_l.p, f.bones.hand_l.p), p = palmOf(f); return Math.abs(Math.atan2(a.dot(p), a.dot(fing)) * 180 / Math.PI); };
const elbow = f => dir(f.bones.lowerarm_l.p, f.bones.upperarm_l.p).angleTo(dir(f.bones.lowerarm_l.p, f.bones.hand_l.p)) * 180 / Math.PI;
const wrap = d => ((d + 540) % 360) - 180;

const times = [];
for (let t = 12.5; t < act.at - 0.1; t += 0.25) times.push(+t.toFixed(4));
for (let t = act.at - 0.1; t < grabAt + 0.1; t += 1 / 60) times.push(+t.toFixed(4));
for (let t = grabAt + 0.1; t <= endAt + 0.9 + 1e-9; t += 1 / 30) times.push(+t.toFixed(4));
const F = []; for (const t of times) F.push(await frameAt(t));
const hold = F.find(f => f.t >= act.at - 0.1);      // (the posture holding the phone, just before she moves)
const stats = {penL: -1, penR: -1, penAt: 0, twistStep: 0, ext: 0, phoneStep: 0};
let prev = null;
for (const f of F) {
    // 1. nothing through the phone, either hand, from the first frame of the window to the hands on the keys
    const dl = depth(f, 'l'), dr = depth(f, 'r');
    if (dl > stats.penL) { stats.penL = dl; stats.penAt = f.t; } stats.penR = Math.max(stats.penR, dr);
    assert.ok(dl <= 0.0005 && dr <= 0.0005, `${f.t.toFixed(3)} s: ${dl > dr ? 'left' : 'right'} hand ${(Math.max(dl, dr) * 1000).toFixed(1)} mm inside the phone`);
    // 5. one phone, in her hand until it is let go, then at the prop's own rest
    assert.ok(!f.baked, `${f.t.toFixed(2)} s: the model's own baked phone stays hidden: one phone`);
    if (f.t < releaseAt - 1e-6) assert.ok(f.held, `${f.t.toFixed(3)} s: in her hand`);
    else { assert.ok(!f.held, `${f.t.toFixed(3)} s: released`); assert.ok(prop.position.distanceTo(restPos) < 1e-6 || f.world.distanceTo(restPos) < 1e-3, `${f.t.toFixed(3)} s: at its rest`); }
    if (f.t > releaseAt - 0.035 && f.t < releaseAt) assert.ok(f.world.distanceTo(restPos) / 1.5087 < 2, `about to be let go at ${f.t.toFixed(3)} s: ${(f.world.distanceTo(restPos) / 1.5087).toFixed(2)} mm from the charger`);
    // 2. no turn of the wrist faster than about 30 degrees a frame (1/30 s), never bent back past 70 degrees
    if (f.t >= act.at && f.t <= endAt + 0.2) {
        stats.ext = Math.max(stats.ext, extension(f)); assert.ok(extension(f) < 70, `${f.t.toFixed(3)} s: the wrist bent ${extension(f).toFixed(0)} degrees`);
        if (prev && prev.t >= act.at) { const step = Math.abs(wrap(twistOf(f) - twistOf(prev))) * (1 / 30) / (f.t - prev.t); stats.twistStep = Math.max(stats.twistStep, step); assert.ok(step < 32, `${f.t.toFixed(3)} s: the wrist turns ${step.toFixed(0)} degrees in a frame`); }
    }
    if (prev && f.t > 12.6) stats.phoneStep = Math.max(stats.phoneStep, f.world.distanceTo(prev.world) * (1 / 30) / (f.t - prev.t));
    prev = f;
}
assert.ok(stats.phoneStep < 90, `the phone never jumps between frames (at most ${stats.phoneStep.toFixed(1)} room mm in 1/30 s)`);
// 2. the way back (from the hand lifting off the phone to the keys): the twist goes one way only, a few degrees a frame, palm down
const back = F.filter(f => f.t >= releaseAt && f.t <= endAt + 0.05), tw = back.map(twistOf);
const net = wrap(tw.at(-1) - tw[0]), travel = tw.slice(1).reduce((s, v, i) => s + Math.abs(wrap(v - tw[i])), 0), backStep = Math.max(...tw.slice(1).map((v, i) => Math.abs(wrap(v - tw[i]))));
assert.ok(travel <= Math.abs(net) + 5, `shortest arc on the way back: the wrist turns ${travel.toFixed(1)} degrees in all for a net ${net.toFixed(1)}`);
// (the only turn against the way it goes: a wobble of a degree or two as the elbow swings in, never a turn the other way)
let against = 0, run = 0; for (let i = 1; i < tw.length; i++) { const d = wrap(tw[i] - tw[i - 1]); if (Math.sign(d) === -Math.sign(net)) { run += Math.abs(d); against = Math.max(against, run); } else run = 0; }
assert.ok(against < 2.5, `no turn the long way: at most ${against.toFixed(1)} degrees against the way the wrist goes`);
assert.ok(backStep < 4, `the wrist turns at most ${backStep.toFixed(1)} degrees a frame on the way back`);
for (const f of back) assert.ok(palmOf(f).y < -0.6, `${f.t.toFixed(2)} s: the palm faces down on the way back (${palmOf(f).toArray().map(v => v.toFixed(2))})`);
// 3. no phone-holding pose after it is let go: both hands keep away from where they held it, the left hand goes on to the keys without
// stopping, the head comes up and stays up, and the change to the typing model moves nothing
const typing = F.find(f => f.t >= endAt + 0.05), ends = {l: typing.bones.hand_l.p, r: typing.bones.hand_r.p};
for (const f of F.filter(f => f.t >= releaseAt)) {
    // (the left hand's typing place is only a few cm from where it held the phone, so: never palm up as it held it; the right hand off its hold)
    assert.ok(palmOf(f).y < -0.3 && palmOf(hold).y > 0.3, `${f.t.toFixed(2)} s: the left palm is not turned up to hold a phone (${palmOf(f).y.toFixed(2)})`);
    assert.ok(f.bones.hand_r.p.distanceTo(hold.bones.hand_r.p) > 0.06, `${f.t.toFixed(2)} s: the right hand is not back where it held the phone`);
}
const toKeys = F.filter(f => f.t >= releaseAt + T.hold && f.t <= endAt).map(f => f.bones.hand_l.p.distanceTo(ends.l));
assert.ok(toKeys.slice(1).every((d, i) => d < toKeys[i] + 0.0005), 'the left hand goes from the charger to the keys without stopping or turning back');
assert.ok(toKeys.slice(1, -3).every((d, i) => toKeys[i] - d > 0.0015), 'and keeps moving until it is there');
const headUp = f => new THREE.Vector3(0, 0, 1).applyQuaternion(f.bones.head.q).y;
for (const f of F.filter(f => f.t >= releaseAt + 0.45)) assert.ok(headUp(f) >= headUp(typing) - 0.05, `${f.t.toFixed(2)} s: the head is up (eyes to the screen), not down at her hands`);
for (const f of F.filter(f => f.t >= endAt + 0.02 && f.t <= endAt + 0.58)) for (const n of ['hand_l', 'hand_r', 'head', 'spine_03']) assert.ok(f.bones[n].p.distanceTo(typing.bones[n].p) < 0.002, `${f.t.toFixed(2)} s: nothing moves through the change of model (${n})`);
assert.ok(F.some(f => f.who === 'mia-works' && f.t > endAt + 0.35), 'the typing model takes over after the action');
// 4. the reach at the new desk: the elbow bent at the charger, the back leaning little, the head up
const atRest = F.find(f => f.t >= contactAt + 0.03), lean = f => new THREE.Vector3(0, 1, 0).applyQuaternion(f.bones.spine_03.q).angleTo(new THREE.Vector3(0, 1, 0).applyQuaternion(hold.bones.spine_03.q)) * 180 / Math.PI;
assert.ok(elbow(atRest) > 110 && elbow(atRest) < 150, `the elbow is bent at the charger: ${elbow(atRest).toFixed(0)} degrees inside (180 is straight)`);
assert.ok(lean(atRest) < 28, `the back leans and turns ${lean(atRest).toFixed(0)} degrees from where it sat (pass 2: 34)`);
assert.ok(hold.bones.head.p.y - atRest.bones.head.p.y < 0.09, `the head drops ${((hold.bones.head.p.y - atRest.bones.head.p.y) * 100).toFixed(1)} cm at the charger (pass 2: 13)`);
// scrubbing back: the hand takes it again (stateless in time)
setDesk(14.2); rp.update(state(14.2)); await rp.settled(); assert.ok(prop.userData.heldByPerson === true, 'scrubbed back into the reach: in her hand again');
const edits = fs.readFileSync(path.join(root, 'tools/experience/film-edits.mjs'), 'utf8');
assert.ok(/heldByPerson === true\) && \(get\(\)/.test(edits), 'film-edits: a carried prop is drawn whatever its show window says');

// ---- 6. Commons4 (Vico's three yeses): the keyboard tray clears her thighs, the keyboard clears the armrest, her seat -----------------
// The geometry is the render's, before the fixes (tests/fixtures/mia-desk-clearance.json: her thighs, the tray, the keyboard end, the wheelchair's armrest,
// in her frame, metres); here it is moved by what the DATA now says (the cast's seat, the wheelchair's prop edit) and measured. Her seat: the pose's
// seat height the real seat is met at (room-people.mjs seatLift), a person stands that much lower the larger it is; the wheelchair: a Director prop edit
// (world metres, the film's 1.5087 scale), she sits on it and goes with it.
const CL = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/mia-desk-clearance.json'), 'utf8')), c4 = {};
const WORLD = 1.5087, seatNow = waits.seat, dSeat = (seatNow - CL.ref.seat) / 1000;
assert.equal(works.seat, seatNow, 'both of Mia\'s models sit at the same seat height');
assert.ok(dSeat >= 0.0045 && dSeat <= 0.012, `her seat is ${seatNow - CL.ref.seat} mm lower than before (Vico: 5 mm; not more than 12)`);
const chairEdits = list => list.filter(e => e.match === '^Prop:electric-wheelchair$' && e.position && /Wheelchair: .* back from the desk/.test(e.label || ''));
const chairShot = chairEdits(shot.sceneEdits || []), chairExport = chairEdits(exported.shots[0].propEdits || []);
assert.equal(chairShot.length, 1, 'one Director edit of the wheelchair in the chapter shot'); assert.equal(chairExport.length, 1, 'and one in the Director export (propEdits)');
assert.deepEqual(chairShot[0].position, chairExport[0].position, 'the same edit in both');
const chBack = chairShot[0].position[0] / WORLD;       // (metres of her frame, back from the desk: the world +x is her -z)
assert.ok(chairShot[0].position[1] === 0 && chairShot[0].position[2] === 0 && chBack > 0.015 && chBack < 0.03, `the wheelchair rolls straight back ${(chBack * 1000).toFixed(1)} mm from the desk (nothing sideways, nothing up)`);
assert.deepEqual(shot.motion, live.motion, 'the desk is the cut own (lift, dock end z): nothing here moves it, the chair goes back instead');
const tri = (a, i) => [a.slice(i * 9, i * 9 + 3), a.slice(i * 9 + 3, i * 9 + 6), a.slice(i * 9 + 6, i * 9 + 9)];
const triN = a => a.length / 9;
// 6a. tray against her thighs: each thigh skin point (moved down by the seat, back with the chair) against the tray's triangles above it: the number of
// surfaces above it (odd: inside the tray's plate) and the gap up to the underside
const trayClear = (dy, dz) => {
    const T = Array.from({ length: triN(CL.tray) }, (_, i) => tri(CL.tray, i)); let worst = Infinity, inside = 0, n = 0;
    for (let i = 0; i < CL.thigh.length; i += 3) {
        const x = CL.thigh[i], y = CL.thigh[i + 1] - dy, z = CL.thigh[i + 2] - dz; let up = Infinity, down = Infinity, above = 0;
        for (const [a, b, c] of T) {
            const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
            const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
            if (l1 < 0 || l2 < 0 || l3 < 0) continue;
            const h = l1 * a[1] + l2 * b[1] + l3 * c[1];
            if (h >= y) { above++; up = Math.min(up, h - y); } else down = Math.min(down, y - h);
        }
        if (!isFinite(up)) continue; n++;
        const clear = above % 2 === 1 ? -down : up; if (clear < 0) inside++; worst = Math.min(worst, clear);
    }
    return { worst, inside, n };
};
{
    const now = trayClear(dSeat, chBack), only = trayClear(dSeat, 0), was = trayClear(0, 0);
    assert.ok(now.n > 100, `the tray is over her thighs (${now.n} skin points under it)`);
    assert.equal(now.inside, 0, `the keyboard tray is not in her thighs: ${now.inside} skin points inside the tray's plate, the nearest ${(now.worst * 1000).toFixed(1)} mm`);
    assert.ok(only.worst * 1000 >= 1, `the seat alone (without the chair's move) clears them by ${(only.worst * 1000).toFixed(2)} mm`);
    assert.ok(now.worst * 1000 >= 1.5, `the tray's underside clears her thighs by ${(now.worst * 1000).toFixed(2)} mm (aim: a few mm; it was 3.8 mm INTO them at the desk's 29 in)`);
    // (the check sees what Vico saw, on the Commons3 seat)
    assert.ok(was.worst < -0.0030 && was.worst > -0.0045, `the same check on the Commons3 seat: ${(was.worst * 1000).toFixed(1)} mm (the 3.1 to 3.8 mm into the thighs that was seen)`);
    c4.tray = now.worst * 1000;
}
// 6b. the keyboard's right end against the wheelchair's right armrest and joystick, to 0.7 mm (the first check was on a 5 mm grid): both surfaces sampled
// every 0.7 mm, the chair's moved back with her; the two surfaces must be at least 1 mm apart (crossing surfaces have points within the sampling)
{
    const H = 0.0007, sample = (a, dz) => { const pts = []; for (let i = 0; i < triN(a); i++) { const [p, q, r] = tri(a, i), n = Math.max(1, Math.ceil(Math.max(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2]), Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2])) / H));
        for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) { const s = u / n, t = v / n; pts.push([p[0] + (q[0] - p[0]) * s + (r[0] - p[0]) * t, p[1] + (q[1] - p[1]) * s + (r[1] - p[1]) * t, p[2] + (q[2] - p[2]) * s + (r[2] - p[2]) * t + dz]); } } return pts; };
    const K = sample(CL.kb, 0), A = sample(CL.arm, -chBack), A0 = sample(CL.arm, 0);
    const key = (x, y, z, c) => Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c), C = 0.002, grid = new Map();
    for (const p of K) { const k = key(p[0], p[1], p[2], C); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
    let nearest = Infinity;
    for (const p of A) { const cx = Math.floor(p[0] / C), cy = Math.floor(p[1] / C), cz = Math.floor(p[2] / C);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const q of grid.get(`${cx + i},${cy + j},${cz + k}`) || []) nearest = Math.min(nearest, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
    // (a wheelchair surface that is in the keyboard crosses the keyboard's surface, so it has points within the sampling of it: the two apart by 1 mm or more is no overlap)
    let before = Infinity;
    for (const p of A0) { const cx = Math.floor(p[0] / C), cy = Math.floor(p[1] / C), cz = Math.floor(p[2] / C);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const q of grid.get(`${cx + i},${cy + j},${cz + k}`) || []) before = Math.min(before, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
    assert.ok(before * 1000 < 0.7, `the check finds the armrest in the keyboard's end with the chair where it was (the surfaces ${(before * 1000).toFixed(2)} mm apart: crossing)`);
    assert.ok(nearest * 1000 >= 1, `the armrest and joystick are ${(nearest * 1000).toFixed(2)} mm from the keyboard's end (at least 1 mm: no overlap)`);
    c4.arm = nearest * 1000;
}
// 6c. the typing pose still fits: her hands follow the keys (the keys are 5 mm higher and 20 mm further ahead in her frame; handsBy is the arm solve's
// answer, found by rendering: the fingertips as high above the key tops as before, within 1.5 mm), and the model change moves nothing (section 5)
{
    assert.deepEqual(CL.fingers.handsBy_after, works.handsBy, 'handsBy is what the render check (tests/fixtures/mia-desk-clearance.json fingers) measured');
    for (const k of Object.keys(CL.fingers.before_mm).filter(k => CL.fingers.before_mm[k] !== null && CL.fingers.after_mm[k] !== null)) assert.ok(Math.abs(CL.fingers.after_mm[k] - CL.fingers.before_mm[k]) <= 1.5, `finger ${k}: ${CL.fingers.before_mm[k]} mm above the keys before, ${CL.fingers.after_mm[k]} mm after`);
    assert.ok(Math.min(...Object.values(CL.fingers.after_mm).filter(v => v !== null)) >= 3, 'no finger is pressed into the keys: the lowest is 3 mm or more above the key tops');
    assert.ok(CL.rendered_after.calf_vs_desk_mm >= CL.rendered_after.calf_vs_desk_before_mm && CL.rendered_after.chair_vs_desk_min_mm >= 2, 'knees and shins are no nearer the desk; the chair is clear of the desk and the keyboard (rendered)');
}
console.log(`people-place-test: ok (Commons4: the tray clears her thighs by ${c4.tray.toFixed(1)} mm with her seat ${waits.seat - CL.ref.seat} mm lower and the chair ${(chBack * 1000).toFixed(0)} mm back, the keyboard is ${c4.arm.toFixed(1)} mm from the armrest; pass 3: ${F.length} frames ${F[0].t}-${F.at(-1).t} s; deepest hand vertex ${(-stats.penL * 1000).toFixed(1)} mm (left) / ${(-stats.penR * 1000).toFixed(1)} mm (right) outside the phone; wrist at most ${stats.twistStep.toFixed(0)} deg a frame, bent back at most ${stats.ext.toFixed(0)} deg; back to the keys ${travel.toFixed(1)} deg of twist for ${net.toFixed(1)} net (${against.toFixed(1)} against); elbow ${elbow(atRest).toFixed(0)} deg at the charger, lean ${lean(atRest).toFixed(0)} deg; grab ${grabAt.toFixed(2)} s, touch down ${contactAt.toFixed(2)}, let go ${releaseAt.toFixed(2)}, on the keys ${endAt.toFixed(2)}; one phone; ${extra.length} extras)`);
