// A wheelchair user rolling along a film's path (room-people-motion.mjs rollPlan, pushRims; room-people.mjs rollAlong
// and the hand-off into a desk posture at the path's end): pure path maths, the wheels and the hands in time, and the
// person in the room.
//   node tests/room-people-roll-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { PersonRig, rollPlan, solveStill, WHEEL_AXLE } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const EIGHTH = Math.PI / 4;
const onEighth = (a, msg) => assert.ok(Math.abs(a / EIGHTH - Math.round(a / EIGHTH)) < 1e-6, `${msg}: ${a} rad is a whole number of eighths of a turn`);

// ---- the path: eased off and to rest, corners rounded, facing along it, ends where it should
{
    const straight = rollPlan([[0, 0], [0, 4]], { speed: .8, ease: 1.2 });
    assert.ok(Math.abs(straight.length - 4) < 1e-9);
    assert.ok(Math.abs(straight.seconds - (4 / .8 + 1.2)) < 1e-9, 'cruise time plus one ease');
    const a0 = straight.at(0), a1 = straight.at(straight.seconds), mid = straight.at(straight.seconds / 2);
    assert.deepEqual([a0.x, a0.z, a0.v], [0, 0, 0], 'at rest at the start');
    assert.ok(Math.abs(a1.z - 4) < 1e-9 && a1.v === 0, 'at rest at the end');
    assert.ok(Math.abs(mid.v - .8) < 1e-9 && Math.abs(mid.z - 2) < 1e-9, 'cruising in the middle, half way');
    assert.ok(straight.at(.3).z < .8 * .3 * .25, 'sets off gently (smoothstep speed)');
    assert.ok(Math.abs(straight.at(-1).z) < 1e-12 && Math.abs(straight.at(99).z - 4) < 1e-12, 'held before and after');
    const short = rollPlan([[0, 0], [0, .5]], { speed: .8, ease: 1.2 });
    assert.ok(short.speed < .8 && Math.abs(short.at(short.seconds).z - .5) < 1e-9, 'a short path never reaches full speed and still ends at its end');
    // speed: never above the cruise speed; position never steps more than speed / fps (no jumps), at any frame rate
    for (const fps of [24, 30, 60]) {
        let last = straight.at(0);
        for (let f = 1; f <= straight.seconds * fps + 1; f++) { const p = straight.at(f / fps), d = Math.hypot(p.x - last.x, p.z - last.z); assert.ok(d <= .8 / fps + 1e-9, `no jump at ${fps} fps`); assert.ok(p.z >= last.z - 1e-12, 'never backwards'); last = p; }
    }
}
{
    // an L: 3 m along +z, then 2 m along +x (to the chair's left as it goes): the heading turns smoothly through the corner
    const plan = rollPlan([[0, 0], [0, 3], [2, 3]], { radius: .45 });
    assert.ok(plan.length < 5 && plan.length > 5 - 2 * .45 + Math.PI / 2 * .45 - .01, 'the corner is cut by a .45 m arc');
    assert.ok(Math.abs(plan.end.x - 2) < 1e-9 && Math.abs(plan.end.z - 3) < 1e-9 && Math.abs(plan.end.yaw - Math.PI / 2) < 1e-6, 'ends at the last point, facing along the last leg');
    assert.ok(Math.abs(plan.at(0).yaw) < 1e-6, 'starts facing along the first leg');
    let last = plan.at(0), most = 0;
    for (let t = 1 / 60; t <= plan.seconds + 1e-9; t += 1 / 60) { const p = plan.at(t); most = Math.max(most, Math.abs(wrap(p.yaw - last.yaw))); last = p; }
    assert.ok(most < .8 / .45 / 60 * 1.05, `the heading turns no faster than speed / radius (${(most * 60).toFixed(2)} rad/s)`);
    // the arc keeps within the corner: nowhere further than the radius' worth from the two legs
    for (let s = 0; s <= plan.length; s += .01) { const p = plan.along(s); assert.ok(Math.min(Math.abs(p.x), Math.abs(p.z - 3)) < .45 * (1 - Math.SQRT1_2) + .02 || p.z < 2.55 || p.x > .45, 'on the legs or on the arc'); }
    // wheels: forward on both, the outer (right) one further in a left turn, each at rest on an eighth of a turn
    const w = plan.at(plan.seconds).wheel; onEighth(w.l, 'left wheel'); onEighth(w.r, 'right wheel');
    assert.ok(w.r > w.l, 'the outer wheel rolls further');
    assert.ok(Math.abs(w.r - w.l - 2 * WHEEL_AXLE.x * Math.PI / 2 / .3) < EIGHTH * 1.01, 'by the track times the turn');
    assert.ok(Math.abs((w.l + w.r) / 2 - plan.length / .3) / (plan.length / .3) < .03, 'the wheels turn with the distance (within the 3 % that brings them to rest on an eighth)');
    let lw = plan.at(0).wheel; for (let t = 0; t <= plan.seconds; t += 1 / 30) { const x = plan.at(t).wheel; assert.ok(x.l >= lw.l - 1e-9 && x.r >= lw.r - 1e-9, 'the wheels only roll forward'); assert.ok(x.l - lw.l < .8 / .3 / 30 * 1.6, 'no jump'); lw = x; }
    // the pushes: while a hand grips, it turns about the axle exactly as its wheel does; it lets go and comes back; no
    // jumps; the first push starts from the built grip and the hands end there
    const p0 = plan.at(0).push; assert.deepEqual([p0.l.turn, p0.r.turn, p0.l.lift], [0, 0, 0], 'the built grip at the start');
    const pe = plan.at(plan.seconds).push; assert.ok(Math.abs(pe.l.turn) < 1e-9 && Math.abs(pe.r.turn) < 1e-9 && pe.l.lift === 0, 'and at the end');
    let prev = plan.at(0), gripped = 0;
    for (let t = 1 / 60; t <= plan.seconds; t += 1 / 60) {
        const now = plan.at(t);
        for (const s of ['l', 'r']) {
            assert.ok(Math.abs(now.push[s].turn - prev.push[s].turn) < .12, `${s} hand does not jump at ${t.toFixed(2)} s`);
            if (now.push.grip && prev.push.grip && now.push[s].lift === 0 && prev.push[s].lift === 0 && now.push[s].turn < .4 - 1e-9) { assert.ok(Math.abs((now.push[s].turn - prev.push[s].turn) - (now.wheel[s] - prev.wheel[s])) < 1e-9, 'gripping: the hand goes with the rim'); gripped++; }
        }
        prev = now;
    }
    assert.ok(gripped > 60 && plan.pushes >= 5, 'it pushes all the way');
    for (let t = 0; t <= plan.seconds; t += .1) { const b = plan.at(t).push.bend; assert.ok(b >= 0 && b <= .45, 'the trunk leans in, within reason'); }
    assert.equal(plan.at(0).push.bend, 0); assert.equal(plan.at(plan.seconds).push.bend, 0, 'upright at rest');
    // the hands stay within the measured reach (-0.2 to 0.4 rad about the axle from the built grip), the first push too
    let lo = 0, hi = 0; for (let t = 0; t <= plan.seconds; t += 1 / 60) { const p = plan.at(t).push; for (const s of ['l', 'r']) { lo = Math.min(lo, p[s].turn); hi = Math.max(hi, p[s].turn); } }
    assert.ok(lo >= -.2 - 1e-6 && hi <= .4 + 1e-6, `pushes within reach (${lo.toFixed(2)}..${hi.toFixed(2)} rad)`);
    { let first = 0; for (let t = 0; t <= 1.5; t += 1 / 60) first = Math.max(first, plan.at(t).push.l.turn); assert.ok(first <= .4 + 1e-6, 'the first push lets go at 0.4 rad (' + first.toFixed(3) + ')'); }
    // a path too short for a push: no push, no spin
    for (const len of [.0, .1, .15]) {
        const tiny = rollPlan([[0, 0], [0, len]]); let most = 0, w = tiny.at(0).wheel.l;
        for (let t = 0; t <= tiny.seconds; t += 1 / 60) { const x = tiny.at(t); assert.equal(x.push.l.turn, 0, 'hands on the rims for a ' + len + ' m roll'); most = Math.max(most, Math.abs(x.wheel.l - w) * 60); w = x.wheel.l; }
        assert.ok(most <= 2.5 * Math.max(.0001, tiny.speed) / .3 + 1e-6, 'the wheel never spins faster than it rolls (' + len + ' m)');
    }
    { const short = rollPlan([[0, 0], [0, .25]]), e = short.at(short.seconds).push; assert.ok(short.pushes === 1 && e.l.turn === 0 && e.l.lift === 0, 'a short roll with one push ends with the hands back on the grip'); }
    // frame-deterministic: the same second gives the same answer however it is reached
    const once = JSON.stringify(plan.at(3.21)); plan.at(9); plan.at(.4); assert.equal(JSON.stringify(plan.at(3.21)), once);
}

// ---- the hands on the rims (pushRims through solveStill): the wrists turn about the axle with the push
const rigData = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/kai.json'), 'utf8')), rig = new PersonRig(rigData);
{
    const key = rig.key('people-kai-wheel-roll'), plan = rollPlan([[0, 0], [0, 4]]), hand = rig.side.l.arm[3];
    const angle = p => Math.atan2(p.z - WHEEL_AXLE.z, p.y - WHEEL_AXLE.y);
    for (let t = .2; t < plan.seconds; t += .1) {
        const r = plan.at(t); solveStill(rig, key, { time: t, seed: 7, life: 1, roll: r });
        const got = rig.wp[hand], want = angle(key.wp[hand]) + r.push.l.turn, reach = Math.hypot(key.wp[hand].y - WHEEL_AXLE.y, key.wp[hand].z - WHEEL_AXLE.z);
        if (r.push.l.lift === 0) {
            assert.ok(Math.abs(wrap(angle(got) - want)) < .03, `left wrist on the rim at the push angle at ${t} s (${angle(got).toFixed(3)} vs ${want.toFixed(3)})`);
            assert.ok(Math.abs(Math.hypot(got.y - WHEEL_AXLE.y, got.z - WHEEL_AXLE.z) - reach) < .01, 'at the grip\'s distance from the axle');
        } else if (r.push.l.lift > .5) assert.ok(Math.hypot(got.y - WHEEL_AXLE.y, got.z - WHEEL_AXLE.z) > reach + .005 || got.x > key.wp[hand].x + .01, `off the rim on the way back at ${t.toFixed(1)} s`);
    }
    // without a roll the posture keeps its own rhythm (unchanged): the same as before for the same input
    solveStill(rig, key, { time: 2, seed: 7, life: 1 }); const own = rig.wp[hand].clone(); solveStill(rig, key, { time: 2, seed: 7, life: 1, roll: plan.at(2) });
    assert.ok(own.distanceTo(rig.wp[hand]) > .01, 'a roll moves the hands by the wheels, not by the clock');
}

// ---- in the room: Kai rolls in along the aisle and docks at the desk (wheel-type-31) at the path's end
{
    const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')), entries = new Map(index.props.map(p => [p.id, p]));
    const glbBones = id => { const d = fs.readFileSync(path.join(root, 'assets/props', id + '.glb')), n = d.readUInt32LE(12), g = JSON.parse(d.subarray(20, 20 + n)); return g.skins[0].joints.map(i => g.nodes[i]); };
    const wheelsOf = glbBones('people-kai-wheel-roll').filter(n => /^wheel_[lr]$/.test(n.name));
    assert.equal(wheelsOf.length, 2, 'the rolling model has its two wheel bones');
    for (const n of wheelsOf) { const y = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().fromArray(n.rotation)); assert.ok(Math.abs(Math.abs(y.x) - 1) < .01, n.name + ' runs along the axle'); assert.ok(Math.abs(n.translation[1] - WHEEL_AXLE.y) < 1e-3 && Math.abs(n.translation[2] - WHEEL_AXLE.z) < 1e-3, n.name + ' at the hub'); }
    const plain = async id => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), new THREE.MeshStandardMaterial())); g.scale.setScalar(1000); g.userData.propId = id; return g; };
    const library = {
        loadIndex: async () => index, entry: id => entries.get(id) || null, instance: plain, rigData: async () => rigData,
        rigInstance: async id => {
            const data = rigData, g = await plain(id), bones = data.bones.map(name => { const b = new THREE.Bone(); b.name = name; return b; });
            data.bones.forEach((name, i) => { (data.parents[i] < 0 ? g : bones[data.parents[i]]).add(bones[i]); bones[i].position.fromArray(data.offsets, i * 3); bones[i].quaternion.fromArray(data.postures[id].q, i * 4); });
            bones[data.bones.indexOf('Root')].position.fromArray(data.postures[id].root); bones[data.bones.indexOf('pelvis')].position.fromArray(data.postures[id].pelvis);
            for (const n of glbBones(id).filter(n => /^wheel_/.test(n.name))) { const b = new THREE.Bone(); b.name = n.name; b.position.fromArray(n.translation); b.quaternion.fromArray(n.rotation); g.add(b); }
            return g;
        }
    };
    const rootGroup = new THREE.Group(), room = { id: 'rolltest', root: rootGroup, token: 1, ready: Promise.resolve(), roomLayout: { id: 'house' }, assets: () => [], peopleState: null };
    const people = new RoomPeople(room, library), dock = [-3757, -1110], path_ = [[-1500, 2600], [-3757, 2600], [-3757, -1110]], start = .6;
    const plan = rollPlan(path_.map(([x, z]) => [x / 1000, z / 1000])), arrive = start + plan.seconds, handoff = arrive + 1;
    people.setFilter({ only: [], cast: [
        { key: 'kai-rolls', id: 'people-kai-wheel-roll', at: path_[0], turn: -90, roll: { path: path_, start } },
        { key: 'kai', id: 'people-kai-wheel-type-31', at: dock, turn: 180 }
    ], when: { 'kai-rolls': [[0, handoff, 0, 0]], kai: [[handoff, 99, 0, 0]] } });
    await people.setEnabled(true);
    const desk = { pose: { x: -3757, z: -1700, yaw: 0 } }, shown = () => people.people.filter(o => o.visible);
    const see = time => { people.update({ ...desk, height: 31, time, now: 0 }); return shown(); };
    see(0); await new Promise(r => setTimeout(r, 30)); await people.settled(); await Promise.all(people.pairs.map(p => people.readyChange(p)));
    assert.equal(people.pairs.length, 1, 'rolling in and docking is one change of posture (paired at the path\'s end, not where he set off)');
    const pair = people.pairs[0]; assert.ok(pair.ready);
    assert.ok(Math.hypot(pair.homeFrom.position.x - dock[0], pair.homeFrom.position.z - dock[1]) < 1, 'the change starts where the path ends');
    assert.ok(Math.abs(wrap(pair.homeFrom.turn - Math.PI)) < 1e-6, 'facing the desk, along the last leg');
    assert.ok(handoff - pair.length / 2 >= arrive - 1e-9, 'the change begins once he has come to rest');
    let last = null, most = 0;
    for (let t = 0; t <= handoff + 2; t += 1 / 30) {
        const who = see(t); assert.equal(who.length, 1, 'one Kai at ' + t.toFixed(2) + ' s'); const o = who[0];
        if (last) most = Math.max(most, Math.hypot(o.position.x - last.x, o.position.z - last.z));
        last = { x: o.position.x, z: o.position.z };
    }
    assert.ok(most < 800 / 30 + 1, `no jump anywhere from the aisle to the desk (${most.toFixed(1)} mm a frame at most)`);
    assert.ok(Math.hypot(last.x - dock[0], last.z - dock[1]) < 1, 'docked where the typing posture is placed');
    const roller = people.byKey('kai-rolls'), wheel = side => roller.userData.personRig?.bones.get('wheel_' + side);
    see(start + plan.seconds / 2);
    assert.ok(wheel('l') && wheel('r'), 'the drawn model has its wheels');
    const restL = roller.userData.personRig.rest.get('wheel_l'), turned = q => 2 * Math.acos(Math.min(1, Math.abs(q.dot(restL))));
    assert.ok(turned(wheel('l').quaternion) > .05, 'the wheels turn while he rolls');
    see(arrive + .2); const endTurn = new THREE.Quaternion().copy(restL).invert().multiply(wheel('l').quaternion), angle = 2 * Math.atan2(Math.hypot(endTurn.x, endTurn.y, endTurn.z), endTurn.w);
    onEighth(angle, 'at rest the left wheel');
    const at = see(start + plan.seconds * .4)[0]; const mid = plan.at(plan.seconds * .4);
    assert.ok(Math.hypot(at.position.x - mid.x * 1000, at.position.z - mid.z * 1000) < 1 && Math.abs(wrap(at.rotation.y - mid.yaw)) < 1e-6, 'on the path, facing along it');
    people.dispose();
}
console.log('PASS room people roll: path maths (ease, corners, heading, determinism), wheels with the distance and at rest on an eighth, pushes in time with the rims, the hand-off into the desk posture at the path\'s end.');
