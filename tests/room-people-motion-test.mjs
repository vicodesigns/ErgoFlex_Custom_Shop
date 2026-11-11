// The person at the desk moving between postures (room-people-motion.mjs): pure functions, no browser.
//   node tests/room-people-motion-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { PersonRig, DeskActor, simulateDesk, settleDesk, stepDesk, deskDescription, deskWants, solveDesk, solveStill, STAND_UP } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rigOf = who => new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs', who + '.json'), 'utf8')));
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8'));
const member = (id, role, behind) => ({ id, role, behind, scale: 1000, object: { userData: {} } });
const crew = (who, sit = who === 'sam' ? 'sit-game' : 'sit-type') => [member(`people-${who}-${sit}`, 'sit', 470), member(`people-${who}-${sit}-30`, 'sit', 470), member(`people-${who}-stand-type`, 'stand', 415)];
const snapshot = rig => rig.lq.map(q => q.toArray()).flat().concat(rig.lp[rig.b.pelvis].toArray());
const worst = (rig, key) => { let w = 0; for (let i = 0; i < rig.n; i++) w = Math.max(w, rig.wp[i].distanceTo(key.wp[i]), 1 - Math.abs(rig.wq[i].dot(key.wq[i]))); return w; };

// ---- every character has a rig file with every built posture, and the bones the motion needs
const characters = [...new Set(index.props.filter(p => p.category === 'people' && p.person).map(p => p.person.character))];
assert.ok(characters.length >= 19, 'characters in the library');
for (const who of characters) {
    const rig = rigOf(who);
    for (const p of index.props.filter(p => p.category === 'people' && p.person?.character === who)) assert.ok(rig.has(p.id), `${p.id} is in ${who}'s rig file (run tools/people/export-rigs.mjs after building people)`);
    for (const s of ['l', 'r']) { assert.ok(rig.side[s].arm.every(i => i >= 0) && rig.side[s].leg.every(i => i >= 0), who + ' has arm and leg bones'); assert.equal(rig.side[s].fingers.length, 15, who + ' has fifteen finger bones a hand'); }
    assert.ok(rig.has(`people-${who}-stand-wait`), who + ' has the standing-by posture');
}

// ---- the driver: a ten second rise, the person up in three
{
    const desc = deskDescription([28, 30], [43.5]);
    const rise = t => 28 + 15.5 * Math.min(1, Math.max(0, (t - 1) / 10));
    const sim = simulateDesk(desc, rise, 14);
    assert.deepEqual([sim.at(0).tau, sim.at(0).k], [0, 1], 'seated and typing before the desk moves');
    assert.ok(sim.at(1.6).k < .05 && sim.at(1.6).tau > 0 && sim.at(1.6).tau < .6, 'hands off first, then the body starts');
    assert.ok(Math.abs(sim.at(5).tau - STAND_UP) < 1e-6 && sim.at(5).k === 0, 'up and waiting long before the desk arrives');
    assert.ok(sim.at(9.5).k === 0 && sim.at(11.2).k > .99, 'hands return as the desk arrives');
    // monotonic: never a step back while the desk keeps rising
    for (let t = 0, last = 0; t <= 14; t += 1 / 30) { const s = sim.at(t); assert.ok(s.tau >= last - 1e-6, 'no step back at ' + t); last = s.tau; }
    // determinism and scrubbing: the same second gives the same state whatever was asked before, and a second run agrees
    const again = simulateDesk(desc, rise, 14), order = [7, 2.5, 13, .4, 2.5, 7];
    for (const t of order) assert.deepEqual(sim.at(t), again.at(t), 'same state at ' + t);
    // lowering: stays standing until the desk is near sitting height, seated with hands on as it arrives
    const lower = t => 43.5 - 15.5 * Math.min(1, Math.max(0, (t - 1) / 10)), down = simulateDesk(desc, lower, 14);
    assert.ok(down.at(.9).k === 1 && Math.abs(down.at(6).tau - STAND_UP) < 1e-6 && down.at(6).k === 0, 'hands off, standing by while it lowers');
    assert.ok(down.at(11.6).tau === 0 && down.at(12.2).k > .99, 'seated and typing once it is down');
    // stopped half way: standing by, for as long as it stays there
    const half = t => 28 + 7 * Math.min(1, Math.max(0, (t - 1) / 4.5)), stopped = simulateDesk(desc, half, 12);
    assert.ok(Math.abs(stopped.at(11).tau - STAND_UP) < 1e-6 && stopped.at(11).k === 0, 'standing by at a desk stopped at 35 in');
    // turned back before they are up: they sit down again
    const state = settleDesk(desc, 28); let h = 28;
    for (let i = 0; i < 90; i++) { h += 1.55 / 60; stepDesk(desc, state, h, 43.5, 1 / 60); }
    assert.ok(state.tau > .5 && state.tau < 1.5, 'half way up after 1.5 s');
    for (let i = 0; i < 240; i++) { h = Math.max(28, h - 1.55 / 60); stepDesk(desc, state, h, 28, 1 / 60); }
    assert.ok(state.tau === 0 && state.k === 1, 'back in the seat, hands on the keys');
    // a small change inside the sitting range keeps them seated with the hands on
    const nudge = settleDesk(desc, 28); for (let i = 0; i < 80; i++) stepDesk(desc, nudge, 28 + i / 40, 30, 1 / 60);
    assert.ok(nudge.tau === 0 && nudge.k === 1, 'stays seated and typing from 28 to 30 in');
    // a tilted top: the hands leave the keys
    assert.equal(deskWants(desc, settleDesk(desc, 43.5), 43.5, 43.5, 30).hands, false, 'hands off a tilted top');
    assert.equal(settleDesk(desc, 43.5, 30).k, 0);
    // a wheelchair user never stands; the hands leave the keys when the desk is out of reach
    const wheel = deskDescription([28, 31], []), high = settleDesk(wheel, 43.5), low = settleDesk(wheel, 29.5);
    assert.deepEqual([high.tau, high.k, low.tau, low.k], [0, 0, 0, 1]);
    const up = simulateDesk(wheel, rise, 14); for (let t = 0; t <= 14; t += .25) assert.equal(up.at(t).tau, 0, 'the wheelchair user stays seated');
    assert.ok(up.at(13).k === 0);
    // short stature at the low setting: standing throughout, hands off above her reach
    const lowStand = deskDescription([], [28, 30], true);
    assert.deepEqual([settleDesk(lowStand, 29).tau, settleDesk(lowStand, 29).k, settleDesk(lowStand, 40).tau, settleDesk(lowStand, 40).k], [STAND_UP, 1, STAND_UP, 0]);
}

// ---- the pose
for (const who of ['maya', 'andre', 'grace', 'noah', 'sam']) {
    const rig = rigOf(who), actor = new DeskActor(rig); actor.configure(crew(who));
    const [sit28, sit30] = actor.keys.sit, stand = actor.keys.stand[0], L = rig.side.l, R = rig.side.r;
    // lands exactly on the built models
    for (const [tau, height, key] of [[0, 28, sit28], [0, 30, sit30], [STAND_UP, 43.5, stand]]) {
        solveDesk(rig, actor.keys, { tau, k: 1, height, time: null, seed: actor.seed });
        assert.ok(worst(rig, key) < 1e-6, `${who}: the pose at ${height} in is the model as built (${worst(rig, key)})`);
    }
    solveDesk(rig, actor.keys, { tau: STAND_UP, k: 0, height: 36, time: null, seed: actor.seed });
    assert.ok(worst(rig, actor.keys.wait) < 1e-6, who + ': standing by is the stand-wait model');
    // through the whole motion: feet on the floor and where they were put, knees bend forward, nothing collapses
    const floor = Math.min(sit28.wp[L.leg[2]].y, stand.wp[L.leg[2]].y) - .004; let lastPelvis = null, lastFeet = null;
    for (let tau = 0; tau <= STAND_UP + 1e-9; tau += STAND_UP / 116) {
        solveDesk(rig, actor.keys, { tau, k: 0, height: 34, time: null, seed: actor.seed });
        const pelvis = rig.wp[rig.b.pelvis].clone(), feet = [L, R].map(s => rig.wp[s.leg[2]].clone());
        for (const s of [L, R]) {
            const [thigh, calf, foot] = s.leg, hip = rig.wp[thigh], knee = rig.wp[calf], ankle = rig.wp[foot];
            assert.ok(ankle.y > floor && ankle.y < floor + .05, `${who}: ankle at floor height at tau ${tau.toFixed(2)} (${ankle.y.toFixed(3)})`);
            const bend = THREE.MathUtils.radToDeg(hip.clone().sub(knee).angleTo(ankle.clone().sub(knee)));
            assert.ok(bend > 55 && bend <= 180.001, `${who}: knee angle ${bend.toFixed(0)} at tau ${tau.toFixed(2)}`);
            // the knee is in front of the line from hip to ankle (the person faces +z): it never bends backwards
            const mid = hip.clone().lerp(ankle, hip.distanceTo(knee) / (hip.distanceTo(knee) + knee.distanceTo(ankle)));
            assert.ok(knee.z > mid.z - .004, `${who}: knee forward of the leg line at tau ${tau.toFixed(2)}`);
            assert.ok(Math.abs(hip.distanceTo(knee) - hip.distanceTo(rig.wp[thigh]) - rig.offset[calf].length()) < 1e-6, 'bones keep their length');
        }
        if (tau > 1) for (const [i, s] of [L, R].entries()) assert.ok(feet[i].distanceTo(stand.wp[s.leg[2]]) < 1e-4, `${who}: feet planted while rising (tau ${tau.toFixed(2)})`);
        assert.ok(rig.wp[rig.b.head].y > rig.wp[rig.b.pelvis].y + .35, who + ': head above the hips');
        if (lastPelvis) { assert.ok(pelvis.distanceTo(lastPelvis) < .03, `${who}: no jump of the hips at tau ${tau.toFixed(2)}`); for (const i of [0, 1]) assert.ok(feet[i].distanceTo(lastFeet[i]) < .04, who + ': no jump of a foot'); }
        lastPelvis = pelvis; lastFeet = feet;
    }
    // the hands follow the keyboard between the built heights and a little beyond; the wrists stay level with it
    for (const height of [27, 28.6, 29.4, 31.5]) {
        solveDesk(rig, actor.keys, { tau: 0, k: 1, height, time: null, seed: actor.seed });
        const want = sit28.wp[L.arm[3]].y + (height - 28) * .0269;
        assert.ok(Math.abs(rig.wp[L.arm[3]].y - want) < .004, `${who}: left wrist at keyboard height at ${height} in`);
        assert.ok(rig.wp[rig.b.pelvis].distanceTo(sit28.wp[rig.b.pelvis]) < 1e-6, 'the seat does not move');
    }
    // determinism: the same inputs give the same bones, whatever was solved in between
    const input = { tau: 1.37, k: 0, height: 33.2, time: 12.345, seed: actor.seed };
    solveDesk(rig, actor.keys, input); const first = snapshot(rig);
    solveDesk(rig, actor.keys, { tau: 2.6, k: .4, height: 43, time: 99, seed: 7 }); solveDesk(rig, actor.keys, { tau: 0, k: 1, height: 28, time: 3, seed: actor.seed });
    solveDesk(rig, actor.keys, input); assert.deepEqual(snapshot(rig), first, who + ': same inputs, same pose');
    // life: small, and it keeps the hands on the keys and the feet on the floor
    let moved = 0;
    for (let time = 0; time < 40; time += .37) {
        solveDesk(rig, actor.keys, { tau: 0, k: 1, height: 28, time, seed: actor.seed });
        assert.ok(rig.wp[L.arm[3]].distanceTo(sit28.wp[L.arm[3]]) < .003 && rig.wp[R.arm[3]].distanceTo(sit28.wp[R.arm[3]]) < .003, who + ': wrists stay on the keys while breathing');
        const head = rig.wp[rig.b.head].distanceTo(sit28.wp[rig.b.head]); assert.ok(head < .03, who + ': the head moves a little, not a lot'); moved = Math.max(moved, 1 - Math.abs(rig.wq[rig.b.head].dot(sit28.wq[rig.b.head])));
        solveDesk(rig, actor.keys, { tau: STAND_UP, k: 0, height: 36, time, seed: actor.seed });
        for (const s of [L, R]) assert.ok(rig.wp[s.leg[2]].distanceTo(actor.keys.wait.wp[s.leg[2]]) < 1e-4, who + ': feet stay put while the weight shifts');
    }
    assert.ok(moved > 1e-5, who + ': the head does move');
}

// ---- who makes one person: seated and standing models of a character; someone in a wheelchair stays in it
{
    const rig = rigOf('omar'), actor = new DeskActor(rig);
    actor.configure([member('people-omar-wheel-type-28', 'wheel', 460), member('people-omar-wheel-type', 'wheel', 460), member('people-omar-stand-type', 'stand', 415)]);
    assert.deepEqual(actor.members.map(m => m.id), ['people-omar-wheel-type-28', 'people-omar-wheel-type'], 'the standing model is left out');
    assert.equal(actor.mobile, false);
    for (const [height, shown, k] of [[28, 'people-omar-wheel-type-28', 1], [31, 'people-omar-wheel-type', 1], [43.5, 'people-omar-wheel-type', 0]]) {
        actor.state = null; actor.drive({ height, time: null, dt: 0 });
        assert.equal(actor.shown.id, shown); assert.equal(actor.state.k, k); assert.equal(actor.state.tau, 0);
        assert.ok(Math.abs(rig.wp[rig.b.pelvis].y - actor.keys.sit[0].wp[rig.b.pelvis].y) < 1e-6, 'stays in the chair at ' + height);
    }
    const maya = new DeskActor(rigOf('maya')); maya.configure(crew('maya'));
    // the film path: the same second twice, with other seconds in between
    const track = { seconds: 14, heightAt: t => 28 + 15.5 * Math.min(1, Math.max(0, (t - 1) / 10)) };
    const at = t => { maya.drive({ height: track.heightAt(t), time: t, track }); return [maya.shown.id, ...snapshot(maya.rig)]; };
    const a = at(2.9), b = at(11.4); at(.2); at(13);
    assert.deepEqual(at(2.9), a, 'scrubbing back gives the same frame'); assert.deepEqual(at(11.4), b);
    assert.equal(at(0)[0], 'people-maya-sit-type'); assert.equal(at(13.9)[0], 'people-maya-stand-type');
    // the Studio path: stepping with the live height gets to the same end
    maya.state = null; let h = 28; maya.drive({ height: h, time: null, dt: 0 });
    for (let i = 0; i < 60 * 13; i++) { h = Math.min(43.5, h + 1.55 / 60); maya.drive({ height: h, target: 43.5, time: null, dt: 1 / 60 }); }
    assert.ok(maya.state.tau === STAND_UP && maya.state.k === 1 && maya.shown.id === 'people-maya-stand-type' && !maya.moving, 'standing and typing after the rise');
}
// ---- life in people who stay where they are
{
    for (const [who, pose, id] of [['grace', 'sit-read', 'people-grace-sit-read'], ['zoe', 'stand-type', 'people-zoe-stand-type'], ['leo', 'sit-write', 'people-leo-sit-write'], ['andre', 'stand-phone', 'people-andre-stand-phone'], ['kai', 'wheel-type', 'people-kai-wheel-type'], ['grace', 'cane-stand', 'people-grace-cane-stand']]) {
        const rig = rigOf(who), key = rig.key(id), seed = 77; assert.equal(key.pose, pose);
        solveStill(rig, key, { time: 5, seed, life: 0 }); assert.ok(worst(rig, key) < 1e-9, id + ': without life it is the model as built');
        let turned = false, most = 0;
        for (let time = 0; time < 90; time += .21) {
            solveStill(rig, key, { time, seed });
            for (const s of ['l', 'r']) {
                const foot = rig.side[s].leg[2], hand = rig.side[s].arm[3];
                assert.ok(rig.wp[foot].distanceTo(key.wp[foot]) < 2e-4, `${id}: ${s} foot stays put at ${time.toFixed(1)}`);
                if (/type|write|cane/.test(pose) && !(pose === 'cane-stand' && s === 'l')) assert.ok(rig.wp[hand].distanceTo(key.wp[hand]) < (pose === 'wheel-type' ? .005 : .002), `${id}: ${s} hand stays where it rests`);   // Kai's arms are at full stretch at the 28 in desk as built
            }
            const right = rig.wp[rig.side.r.arm[3]].distanceTo(key.wp[rig.side.r.arm[3]]); if (pose === 'sit-read' && right > .03) turned = true;
            most = Math.max(most, rig.wp[rig.b.head].distanceTo(key.wp[rig.b.head]));
            assert.ok(rig.wp[rig.b.head].distanceTo(key.wp[rig.b.head]) < .035, id + ': the head stays about where it was');
        }
        assert.ok(most > .0005, id + ': there is life in it');
        if (pose === 'sit-read') assert.ok(turned, 'the reader turns a page within a minute and a half');
        solveStill(rig, key, { time: 33.3, seed }); const a = snapshot(rig); solveStill(rig, key, { time: 2, seed }); solveStill(rig, key, { time: 33.3, seed });
        assert.deepEqual(snapshot(rig), a, id + ': same time and seed, same pose');
    }
}
// ---- in the room (room-people.mjs): one person at the desk at every height, their chair, the film's time path
{
    const entries = new Map(index.props.map(p => [p.id, p])), dataOf = who => JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs', who + '.json'), 'utf8'));
    const plain = async id => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), new THREE.MeshStandardMaterial())); g.scale.setScalar(1000); g.userData.propId = id; return g; };
    const library = {
        loadIndex: async () => index, entry: id => entries.get(id) || null, instance: plain, rigData: async who => dataOf(who),
        rigInstance: async id => {
            const data = dataOf(entries.get(id).person.character), g = await plain(id), bones = data.bones.map(name => { const b = new THREE.Bone(); b.name = name; return b; });
            data.bones.forEach((name, i) => { (data.parents[i] < 0 ? g : bones[data.parents[i]]).add(bones[i]); bones[i].position.fromArray(data.offsets, i * 3); bones[i].quaternion.fromArray(data.postures[id].q, i * 4); });
            bones[data.bones.indexOf('Root')].position.fromArray(data.postures[id].root); bones[data.bones.indexOf('pelvis')].position.fromArray(data.postures[id].pelvis);
            return g;
        }
    };
    const makeRoom = id => { const rootGroup = new THREE.Group(), chair = new THREE.Group(); chair.add(new THREE.Mesh(new THREE.BoxGeometry(600, 900, 600))); chair.position.set(0, 0, 900); chair.userData.propId = 'steelcase-leap-v2'; rootGroup.add(chair);
        return { room: { id, root: rootGroup, token: 1, ready: Promise.resolve(), roomLayout: { id: 'house' }, assets: () => rootGroup.children.filter(o => o.userData.propId && !o.name.startsWith('Person')), peopleState: null }, chair }; };
    const cast = [{ key: 'sits', id: 'people-maya-sit-type', desk: 'sit' }, { key: 'sits30', id: 'people-maya-sit-type-30', desk: 'sit' }, { key: 'stands', id: 'people-maya-stand-type', desk: 'stand' }];
    const { room, chair } = makeRoom('office'), people = new RoomPeople(room, library); people.setFilter({ only: [], cast, life: false });
    await people.setEnabled(true);
    people.update({ pose: { x: 100, z: -500, yaw: 0 }, height: 28, time: 0, now: 0 });
    assert.equal(people.actors.filter(a => a.members.length).length, 1, 'the three models are one person'); const actor = people.actors.find(a => a.members.length);
    const desk = { pose: { x: 100, z: -500, yaw: 0 }, keyboard: { x: 60, z: -240 } }, shown = () => people.people.filter(o => o.visible).map(o => o.userData.person.id);
    const quat = (o, bone) => o.userData.personRig.bones.get(bone).quaternion.toArray(), built = (id, bone) => { const d = dataOf('maya'), i = d.bones.indexOf(bone); return d.postures[id].q.slice(i * 4, i * 4 + 4); };
    const close = (a, b, eps = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < eps);
    // film path: the same person at every second of a rise, never nobody; the chair stays in the room, behind them
    const track = { seconds: 14, heightAt: t => 28 + 15.5 * Math.min(1, Math.max(0, (t - 1) / 10)) };
    const at = time => { people.update({ ...desk, height: track.heightAt(time), time, track, now: 0 }); return shown(); };
    assert.deepEqual(at(0), ['people-maya-sit-type']);
    const sits = people.byKey('sits'); assert.ok(close(quat(sits, 'upperarm_l'), built('people-maya-sit-type', 'upperarm_l')), 'seated at 28 in she is the model as built');
    assert.deepEqual([sits.position.x, sits.position.z], [60, 230], 'seated 470 mm behind the keys');
    assert.ok(actor.chair.visible && actor.chair.position.distanceTo(sits.position) < 1 && chair.visible === false, 'on her chair; the room\'s own chair has stepped aside');
    for (let t = 0; t <= 14; t += .1) assert.equal(at(t).length, 1, 'one model of her at ' + t.toFixed(1) + ' s');
    assert.deepEqual(at(2.2), ['people-maya-sit-type-30'], 'at 29.9 in the 30 in model is the one drawn'); assert.ok(actor.chair.position.z > 230 + 150 && actor.chair.position.z < 230 + 300, 'the chair rolls back with her');
    assert.ok(people.dirty, 'she moved: the film redraws her shadow');
    assert.deepEqual(at(6), ['people-maya-stand-type']); assert.ok(close(quat(people.byKey('stands'), 'upperarm_l'), built('people-maya-stand-wait', 'upperarm_l')), 'standing by while the desk rises');
    assert.ok(Math.abs(actor.chair.position.z - (230 + 415)) < 2 && actor.chair.visible, 'the chair is left 415 mm back');
    assert.deepEqual(at(13), ['people-maya-stand-type']); assert.ok(close(quat(people.byKey('stands'), 'upperarm_l'), built('people-maya-stand-type', 'upperarm_l')), 'typing again at 43.5 in, as built');
    assert.deepEqual([people.byKey('stands').position.x, people.byKey('stands').position.z], [60, 175]);
    at(2.2); const again = quat(people.byKey('sits30'), 'thigh_l'); at(9); at(2.2);
    assert.deepEqual(quat(people.byKey('sits30'), 'thigh_l'), again, 'scrubbing back to a second gives the same bones');
    // her own fine tuning (the Director's pose mode) turns the bone from where the motion has it
    people.setFilter({ only: [], cast: cast.map(c => c.key === 'stands' ? { ...c, pose: { head: [0, .2, 0, .98] } } : c), life: false }); await people.built; at(13);
    const tuned = new THREE.Quaternion().fromArray(built('people-maya-stand-type', 'head')).multiply(new THREE.Quaternion(0, .2, 0, .98)).normalize().toArray();
    assert.ok(close(quat(people.byKey('stands'), 'head'), tuned), 'a pose adjustment sits on top of the motion');
    // a parked chair (the film's people.chair) is where the film puts it while she stands
    people.setFilter({ only: [], cast, life: false, chair: { back: 300, side: 760, turn: -42 } }); await people.built; at(13);
    assert.ok(Math.abs(actor.chair.position.x - (60 + 760)) < 2 && Math.abs(actor.chair.position.z - 530) < 2, 'parked where the chapter says');
    // Studio path: the live height, stepped; a jump of the desk is taken as it stands
    people.setFilter({ only: [], cast, life: false }); await people.built;
    let now = 0, h = 28; const live = (target, steps) => { for (let i = 0; i < steps; i++) { now += 1000 / 60; h += Math.sign(target - h) * Math.min(Math.abs(target - h), 1.55 / 60); people.update({ ...desk, height: h, target: Math.abs(target - h) > 1e-3 ? target : null, time: null, now }); assert.equal(shown().length, 1); } };
    live(28, 2); assert.deepEqual(shown(), ['people-maya-sit-type']); assert.equal(people.moving, false);
    live(43.5, 120); assert.ok(people.moving, 'on her way up two seconds after the desk set off');
    live(43.5, 600); assert.deepEqual(shown(), ['people-maya-stand-type']); assert.ok(!people.moving && actor.state.k === 1);
    live(36, 400); assert.deepEqual(shown(), ['people-maya-stand-type']); assert.equal(actor.state.k, 0, 'a desk stopped at 36 in: standing by');
    live(28, 600); assert.deepEqual(shown(), ['people-maya-sit-type']); assert.ok(actor.state.k === 1 && Math.abs(actor.chair.position.z - 230) < 1, 'seated and typing, the chair back under her');
    await people.setEnabled(false); assert.ok(!actor.chair.visible && shown().length === 0 && chair.visible, 'people off: she and her chair are gone, the room\'s chair is back');
    // the still models for one use of the room
    people.setFilter({ only: [], cast, motion: false }); await people.setEnabled(true);
    assert.equal(people.actors.length, 0); people.update({ ...desk, height: 36, time: 5 }); assert.deepEqual(shown(), [], 'motion off: nobody between the built heights, as before');
    people.dispose();
}
console.log('PASS room people motion: rig files, the desk driver (rise, lower, stop, turn back, tilt, wheelchair, short stature), exact end poses, planted feet, knees, keyboard following, determinism, life, the person in the room (film and Studio paths, chair, pose adjustments on top).');
