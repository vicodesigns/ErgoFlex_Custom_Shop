// The person at the desk moving between postures (room-people-motion.mjs): pure functions, no browser.
//   node tests/room-people-motion-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { PersonRig, DeskActor, simulateDesk, settleDesk, stepDesk, deskDescription, deskWants, solveDesk, solveStill, solveChange, walkPlan, solveWalk, STAND_UP, solveTread, shoeFit } from '../room-people-motion.mjs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

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
    assert.ok(rig.has(`people-${who}-stand-wait`) || rig.has(`people-${who}-kid-stand-wait`), who + ' has the standing-by posture');
}

// In the Commons, Mia supports the phone with both hands. Check the relative
// wrist transform as she scrolls, and that the chair and footplate contacts stay put.
{
    const rig = rigOf('mia'), key = rig.key('people-mia-power-phone');
    const right = rig.side.r.arm[3], left = rig.side.l.arm[3], thumb = rig.index.get('thumb_01_r');
    const offset = (points, turns) => points[left].clone().sub(points[right]).applyQuaternion(turns[right].clone().invert());
    const rest = offset(key.wp, key.wq);
    const restTurn = key.wq[right].clone().invert().multiply(key.wq[left]);
    let travel = 0;
    for (let frame = 0; frame <= 300; frame++) {
        solveStill(rig, key, { time: frame / 30, seed: 21, life: 1 });
        assert.ok(offset(rig.wp, rig.wq).distanceTo(rest) < .002, 'supporting wrist stays with the phone');
        assert.ok(rig.wq[right].clone().invert().multiply(rig.wq[left]).angleTo(restTurn) < .003, 'palms keep their relative turn');
        for (const i of [rig.b.pelvis, rig.side.l.leg[2], rig.side.r.leg[2]]) {
            assert.ok(rig.wp[i].distanceTo(key.wp[i]) < .001, 'seated contacts stay on the chair');
        }
        travel = Math.max(travel, rig.lq[thumb].angleTo(key.q[thumb]));
    }
    assert.ok(travel > .1, 'scrolling moves the thumb');
}

// Yara briefly gathers the pack strap during the first strides. Compare to
// the same gait without the pack gesture, including a seek back to mid-reach.
{
    const rig = rigOf('yara'), start = rig.key('people-yara-walk'), end = rig.key('people-yara-stand-wait');
    const plan = walkPlan(rig, start, end, [[0, 0], [0, 6]], { pace: 2 });
    const ordinary = walkPlan(rig, end, end, [[0, 0], [0, 6]], { pace: 2 });
    const wrist = rig.side.r.arm[3];
    for (const g of [0, 1, 2, 1]) {
        solveWalk(rig, ordinary, g);
        const y = rig.wp[wrist].y, feet = ['l','r'].map(s => rig.wp[rig.side[s].leg[2]].clone());
        solveWalk(rig, plan, g);
        if (g === 1) assert.ok(rig.wp[wrist].y > y + .12, 'the hand lifts toward the strap');
        else assert.ok(Math.abs(rig.wp[wrist].y - y) < .001, 'the hand returns to its authored swing');
        for (const [i,s] of ['l','r'].entries()) assert.ok(rig.wp[rig.side[s].leg[2]].distanceTo(feet[i]) < .001, 'the gesture preserves foot placement');
    }
}

// OCC edits must scrub to the same frame with wrists still on the keyboard.
{
    const rig = rigOf('andre'), key = rig.key('people-andre-sit-type');
    rig.castDetail = true; rig.editorCast = true;
    const sample = time => {
        solveStill(rig, key, {time, seed:41});
        for (const side of ['l','r']) {
            const wrist = rig.side[side].arm[3];
            assert.ok(rig.wp[wrist].distanceTo(key.wp[wrist]) < .005, 'editing wrist stays over the keys');
        }
        return snapshot(rig);
    };
    const edit = sample(2.5);
    assert.notDeepEqual(sample(5), edit);
    assert.deepEqual(sample(2.5), edit, 'seeking back reproduces the edit gesture');
}

// The cast detail motion (finger travel, resting beat, neighbouring digit, audience reaction) is every room's but the frozen
// Classic casts; the editor's timeline scan (editorCast) and fader hand (mediaLab) stay the media lab's. The media lab moves
// exactly as it did when one flag (rig.coastCast) held all of it: both modules solved side by side, bone for bone.
{
    const { execFileSync } = await import('node:child_process');
    let old = null; try { old = execFileSync('git', ['show', '4abe6181:room-people-motion.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch { old = null; }
    const fresh = (who, flags) => Object.assign(rigOf(who), flags), poses = ['sit-type', 'stand-type', 'wheel-type', 'sit-laptop', 'sit-listen', 'wheel-watch', 'stand-wait', 'sit-mix-30'];
    const sweep = (make, solve) => {
        const out = [];
        for (const who of ['andre', 'ava', 'lin', 'kai', 'maya']) for (const pose of poses) {
            const probe = rigOf(who), id = `people-${who}-${pose}`; if (!probe.has(id)) continue;
            for (const time of [0, 1.3, 2.5, 7.1, 13.2]) for (const seed of [41, 5]) {
                const rig = make(who), key = rig.key(id);
                solve(rig, key, { time, seed }); out.push(snapshot(rig));
            }
        }
        return out;
    };
    const cases = sweep(who => fresh(who, { castDetail: true, editorCast: true }), solveStill);
    assert.ok(cases.length > 100, 'a sweep of postures, times and seeds');
    const flat = sweep(who => fresh(who, {}), solveStill);
    assert.notDeepEqual(cases, flat, 'the cast detail moves the fingers, heads and the audience');
    const lab = sweep(who => fresh(who, { castDetail: true, editorCast: true, mediaLab: true }), solveStill), labFlat = sweep(who => fresh(who, { mediaLab: true }), solveStill);
    assert.notDeepEqual(lab, labFlat);
    if (old) {
        const file = path.join(root, `.old-motion-${process.pid}.mjs`); fs.writeFileSync(file, old);
        try {
            const O = await import(file + '?old');
            const oldRig = (who, flags) => Object.assign(new O.PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs', who + '.json'), 'utf8'))), flags);
            const before = (flags) => sweep(who => oldRig(who, flags), O.solveStill);
            assert.deepEqual(cases, before({ coastCast: true }), 'media lab Classic: bone for bone what it was');
            assert.deepEqual(lab, before({ coastCast: true, mediaLab: true }), 'media lab refresh: bone for bone what it was');
            assert.deepEqual(flat, before({}), 'the frozen Classic casts (no detail flags) move as before');
            assert.deepEqual(labFlat, before({ mediaLab: true }));
            // the desk user (solveDesk) too
            const desk = (M, make) => { const out = []; for (const who of ['maya', 'andre', 'grace']) for (const [tau, k, height, time] of [[0, 1, 28, 3.3], [0, 1, 30, 9.9], [2.6, .4, 36, 14.1], [8, 0, 43.5, 6.2]]) { const rig = make(who), actor = new M.DeskActor(rig); actor.configure(crew(who)); M.solveDesk(rig, actor.keys, { tau, k, height, time, seed: actor.seed }); out.push(snapshot(rig)); } return out; };
            assert.deepEqual(desk({ DeskActor, solveDesk }, who => fresh(who, { castDetail: true, editorCast: true })), desk(O, who => oldRig(who, { coastCast: true })), 'the media lab\'s desk user: the same');
            assert.deepEqual(desk({ DeskActor, solveDesk }, who => fresh(who, {})), desk(O, who => oldRig(who, {})), 'a frozen Classic desk user: the same');
        } finally { fs.rmSync(file, { force: true }); }
    }
    // the flags split as they say: a typist anywhere has the finger sequence but not the timeline scan; only the editor scans
    for (const pose of ['sit-type', 'stand-type', 'wheel-type', 'sit-laptop']) {
        const who = 'ava', id = `people-${who}-${pose}`; const gaze = flags => { const rig = fresh(who, flags), key = rig.key(id); solveStill(rig, key, { time: 3.7, seed: 41 }); return rig.wq[rig.b.head].toArray(); };
        const fingers = flags => { const rig = fresh(who, flags), key = rig.key(id); solveStill(rig, key, { time: 3.7, seed: 41 }); return rig.side.l.fingers.concat(rig.side.r.fingers).map(i => rig.lq[i].toArray()).flat(); };
        assert.deepEqual(gaze({ castDetail: true }), gaze({}), pose + ': detail alone does not scan a timeline');
        assert.notDeepEqual(gaze({ castDetail: true, editorCast: true }), gaze({ castDetail: true }), pose + ': the editor follows the timeline');
        assert.deepEqual(fingers({ editorCast: true }), fingers({}), pose + ': the scan alone does not move the fingers');
    }
    // every character: typing, laptop and wheelchair postures stay finite and over the keys with the detail on
    for (const who of characters) for (const pose of ['sit-type', 'stand-type', 'stand-type-low', 'wheel-type', 'sit-laptop', 'sit-listen', 'wheel-watch']) {
        const probe = rigOf(who), id = `people-${who}-${pose}`; if (!probe.has(id)) continue;
        for (const time of [0.4, 2.2, 5.9]) {
            const rig = fresh(who, { castDetail: true }), key = rig.key(id); solveStill(rig, key, { time, seed: 7 });
            assert.ok(snapshot(rig).every(Number.isFinite), `${id}: finite`);
            if (pose.includes('type') || pose === 'sit-laptop') for (const side of ['l', 'r']) { const wrist = rig.side[side].arm[3]; assert.ok(rig.wp[wrist].distanceTo(key.wp[wrist]) < .01, `${id}: wrist stays over the keys`); }
        }
    }
}

{
    // The driver: a ten second rise, the person up in three.
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

// ---- a child drawing at the desk: hands stay on a top tilted for drawing, leave it past 12 degrees, in the Studio and on a film's track
{
    const nora = new DeskActor(rigOf('nora')); nora.configure([member('people-nora-kid-sit-desk', 'sit', 470)]);
    assert.equal(nora.draws, true, 'a child at the desk draws');
    const hands = tilt => { nora.state = null; nora.drive({ height: 28, tilt, time: null, dt: 0 }); return nora.state.k; };
    assert.deepEqual([hands(0), hands(8), hands(12), hands(20)], [1, 1, 1, 0], 'on the top to 12 degrees, off beyond');
    const track = { seconds: 12, heightAt: () => 28, tiltAt: t => t < 4 ? 0 : t < 8 ? 10 : 30 };
    const at = t => { nora.drive({ height: 28, time: t, track }); return nora.state.k; };
    assert.equal(at(2), 1); assert.equal(at(6), 1, 'a 10 degree drawing tilt in a film keeps the hands on'); assert.ok(at(11.5) < .05, 'a 30 degree tilt takes them off');
    const maya = new DeskActor(rigOf('maya')); maya.configure(crew('maya')); assert.equal(maya.draws, false);
    maya.state = null; maya.drive({ height: 28, tilt: 15, time: null, dt: 0 }); assert.equal(maya.state.k, 0, 'an adult typist still takes the hands off a tilted top');
    maya.state = null; maya.drive({ height: 28, tilt: -5, time: null, dt: 0 }); assert.equal(maya.state.k, 1, 'a slight ergonomic tilt (5 degrees) keeps the typist on the keys');
    nora.configure([member('people-nora-kid-stand-wait', 'stand', 415)]); assert.equal(nora.draws, false, 'recomputed when the cast changes');
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
    // (with life on, the seated back sits upright, SIT_UPRIGHT: the head is measured from that pose, without life)
    solveDesk(rig, actor.keys, { tau: 0, k: 1, height: 28, time: null, seed: actor.seed, upright: true }); const upright = rig.wp[rig.b.head].clone(), uprightQ = rig.wq[rig.b.head].clone();
    let moved = 0;
    for (let time = 0; time < 40; time += .37) {
        solveDesk(rig, actor.keys, { tau: 0, k: 1, height: 28, time, seed: actor.seed });
        assert.ok(rig.wp[L.arm[3]].distanceTo(sit28.wp[L.arm[3]]) < .003 && rig.wp[R.arm[3]].distanceTo(sit28.wp[R.arm[3]]) < .003, who + ': wrists stay on the keys while breathing');
        const head = rig.wp[rig.b.head].distanceTo(upright); assert.ok(head < .03, who + ': the head moves a little, not a lot'); moved = Math.max(moved, 1 - Math.abs(rig.wq[rig.b.head].dot(uprightQ)));
        solveDesk(rig, actor.keys, { tau: STAND_UP, k: 0, height: 36, time, seed: actor.seed });
        for (const s of [L, R]) assert.ok(rig.wp[s.leg[2]].distanceTo(actor.keys.wait.wp[s.leg[2]]) < 1e-4, who + ': feet stay put while the weight shifts');
    }
    assert.ok(moved > 1e-5, who + ': the head does move');
}

// ---- a drink at the desk (sit-coffee, stand-coffee): the right hand holds the cup (no keystrokes in it; it rests where
// it was built, and now and then it comes to the mouth), the left hand types; life off is the model as built
for (const who of ['maya', 'sam']) {
    const rig = rigOf(who), actor = new DeskActor(rig);
    actor.configure([member(`people-${who}-sit-coffee`, 'sit', 470), member(`people-${who}-sit-coffee-30`, 'sit', 470), member(`people-${who}-stand-coffee`, 'stand', 415)]);
    const [sit28, sit30] = actor.keys.sit, stand = actor.keys.stand[0], L = rig.side.l, R = rig.side.r, angle = (a, c) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(c))));
    assert.deepEqual([sit28.pose, sit30.pose, stand.pose], ['sit-coffee', 'sit-coffee', 'stand-coffee']);
    for (const [tau, height, key] of [[0, 28, sit28], [0, 30, sit30], [STAND_UP, 43.5, stand]]) {
        solveDesk(rig, actor.keys, { tau, k: 1, height, time: null, seed: actor.seed });
        assert.ok(worst(rig, key) < 1e-6, `${who}: with a drink at ${height} in, the model as built`);
        let typed = 0, sipped = Infinity, held = 0, samples = 0, still = 0;
        for (let time = 0; time < 40; time += .13) {
            solveDesk(rig, actor.keys, { tau, k: 1, height, time, seed: actor.seed });
            // the cup hand's fingers hold the cup: never a keystroke in them
            for (const i of R.fingers) still = Math.max(still, angle(rig.lq[i], key.q[i]));
            typed = Math.max(typed, ...L.fingers.map(i => angle(rig.lq[i], key.q[i])));
            assert.ok(rig.wp[L.arm[3]].distanceTo(key.wp[L.arm[3]]) < .005, `${who}: the typing hand stays on the keys at ${height} in`);      // (Maya at 28 in is built with that arm at full stretch: breathing moves it 4 mm)
            const toMouth = rig.wp[R.arm[3]].distanceTo(rig.wp[rig.b.head]), off = rig.wp[R.arm[3]].distanceTo(key.wp[R.arm[3]]);
            sipped = Math.min(sipped, toMouth); held += off < .002 ? 1 : 0; samples++;
        }
        assert.ok(still < 1e-6, `${who}: no keystrokes in the hand with the cup (${still.toFixed(4)})`);
        assert.ok(typed > .02, `${who}: the other hand types`);
        assert.ok(sipped < .26, `${who}: the cup comes to the mouth at ${height} in (${sipped.toFixed(3)})`);
        assert.ok(held / samples > .65, `${who}: between sips the cup is held where it was built, within 2 mm (${(100 * held / samples).toFixed(0)} % of the time)`);
        solveDesk(rig, actor.keys, { tau, k: 1, height, time: 17.3, seed: actor.seed }); const a = snapshot(rig); solveDesk(rig, actor.keys, { tau, k: 1, height, time: 3, seed: actor.seed }); solveDesk(rig, actor.keys, { tau, k: 1, height, time: 17.3, seed: actor.seed });
        assert.deepEqual(snapshot(rig), a, who + ': same time, same pose');
    }
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
        let turned = false, most = 0, wrote = 0, onPage = 0, samples = 0;
        for (let time = 0; time < 90; time += .21) {
            solveStill(rig, key, { time, seed });
            for (const s of ['l', 'r']) {
                const foot = rig.side[s].leg[2], hand = rig.side[s].arm[3];
                assert.ok(rig.wp[foot].distanceTo(key.wp[foot]) < 2e-4, `${id}: ${s} foot stays put at ${time.toFixed(1)}`);
                // the writing hand writes: it stays on the table (its height) within a line's length of where it was
                // (it lifts off the page, at most 12 mm, only on its way back to the start of the next line)
                if (pose === 'sit-write' && s === 'r') { const dy = rig.wp[hand].y - key.wp[hand].y; assert.ok(dy > -.003 && dy < .012 && rig.wp[hand].distanceTo(key.wp[hand]) < .07, id + ': the pen stays on the page'); onPage += dy < .003 ? 1 : 0; samples++; wrote = Math.max(wrote, rig.wp[hand].distanceTo(key.wp[hand])); }
                else if (/type|write|cane/.test(pose) && !(pose === 'cane-stand' && s === 'l')) assert.ok(rig.wp[hand].distanceTo(key.wp[hand]) < (pose === 'wheel-type' ? .005 : .002), `${id}: ${s} hand stays where it rests`);   // Kai's arms are at full stretch at the 28 in desk as built
            }
            const right = rig.wp[rig.side.r.arm[3]].distanceTo(key.wp[rig.side.r.arm[3]]); if (pose === 'sit-read' && right > .03) turned = true;
            most = Math.max(most, rig.wp[rig.b.head].distanceTo(key.wp[rig.b.head]));
            assert.ok(rig.wp[rig.b.head].distanceTo(key.wp[rig.b.head]) < .035, id + ': the head stays about where it was');
        }
        assert.ok(most > .0005, id + ': there is life in it');
        if (pose === 'sit-read') assert.ok(turned, 'the reader turns a page within a minute and a half');
        if (pose === 'sit-write') { assert.ok(wrote > .03, 'the writer writes'); assert.ok(onPage / samples > .8, 'the pen is on the page most of the time (' + (onPage / samples).toFixed(2) + ')'); }
        solveStill(rig, key, { time: 33.3, seed }); const a = snapshot(rig); solveStill(rig, key, { time: 2, seed }); solveStill(rig, key, { time: 33.3, seed });
        assert.deepEqual(snapshot(rig), a, id + ': same time and seed, same pose');
    }
}
// ---- training on the gym's equipment: hands stay on the bar, feet go round the crank, the same second is the same pose
{
    const far = (rig, key, i) => rig.wp[i].distanceTo(key.wp[i]);
    for (const [who, pose] of [['zoe', 'gym-cycle'], ['kai', 'gym-cycle'], ['lin', 'gym-pullup'], ['andre', 'gym-press'], ['lin', 'gym-curl'], ['sofia', 'gym-box']]) {
        const id = `people-${who}-${pose}`, rig = rigOf(who), key = rig.key(id), seed = 41; assert.equal(key.pose, pose);
        solveStill(rig, key, { time: 5, seed, life: 0 }); assert.ok(worst(rig, key) < 1e-9, id + ': without life it is the model as built');
        const L = rig.side.l, R = rig.side.r, fl = L.leg[2], fr = R.leg[2], hl = L.arm[3], hr = R.arm[3], pelvis = rig.b.pelvis;
        const mid = key.wp[fl].clone().add(key.wp[fr]).multiplyScalar(.5), throwOf = Math.hypot(key.wp[fl].y - key.wp[fr].y, key.wp[fl].z - key.wp[fr].z) / 2;
        let low = Infinity, high = -Infinity, reach = 0;
        for (let time = 0; time < 30; time += .13) {
            const out = solveStill(rig, key, { time, seed });
            assert.ok(rig.lq.every(q => Number.isFinite(q.x + q.y + q.z + q.w)), id + ': a pose at ' + time.toFixed(2));
            if (pose === 'gym-cycle') {
                assert.ok(Number.isFinite(out.crank), 'the rider tells the bike how far its crank has turned');
                for (const [foot, hand] of [[fl, hl], [fr, hr]]) {
                    assert.ok(Math.abs(Math.hypot(rig.wp[foot].y - mid.y, rig.wp[foot].z - mid.z) - throwOf) < .004, id + ': a foot stays on its pedal\'s circle');
                    assert.ok(far(rig, key, hand) < .003, id + ': hands stay on the handlebar');
                }
                // the left pedal: down as built, then round with the crank (the top goes forward)
                assert.ok(Math.abs(rig.wp[fl].y - (mid.y - throwOf * Math.cos(out.crank))) < .004 && Math.abs(rig.wp[fl].z - (mid.z - throwOf * Math.sin(out.crank))) < .004, id + ': the foot is where the crank has the pedal');
            }
            if (pose === 'gym-pullup') { assert.ok(far(rig, key, hl) < .003 && far(rig, key, hr) < .003, id + ': hands stay on the bar'); assert.ok(rig.wp[rig.b.head].y < key.wp[hl].y + .06, id + ': the head stays under the bar'); }
            if (pose === 'gym-curl' || pose === 'gym-box') assert.ok(far(rig, key, fl) < 2e-4 && far(rig, key, fr) < 2e-4, id + ': feet stay put');
            if (pose === 'gym-press') assert.ok(far(rig, key, pelvis) < 1e-6 && rig.wp[hl].y <= key.wp[hl].y + 1e-6, id + ': the hips stay on the bench, the weights come down from the top');
            const y = pose === 'gym-pullup' ? rig.wp[pelvis].y : rig.wp[hl].y; low = Math.min(low, y); high = Math.max(high, y); reach = Math.max(reach, far(rig, key, hl));
        }
        if (pose === 'gym-pullup') assert.ok(high - low > .12, id + ': the body rises and sinks');
        if (pose === 'gym-press' || pose === 'gym-curl') assert.ok(high - low > .2, id + ': the weight travels');
        if (pose === 'gym-box') assert.ok(reach > .2, id + ': the glove comes back to the guard');
        solveStill(rig, key, { time: 12.7, seed }); const a = snapshot(rig); solveStill(rig, key, { time: 3, seed }); solveStill(rig, key, { time: 12.7, seed });
        assert.deepEqual(snapshot(rig), a, id + ': same time and seed, same pose');
    }
    // the treadmill: the stride of a walk on the spot, the same every two steps, feet passing each other
    const rig = rigOf('andre'), key = rig.key('people-andre-stand-wait'), plan = walkPlan(rig, key, key, [[0, 0], [0, 24]], { pace: 2.05 }), fl = rig.side.l.leg[2], fr = rig.side.r.leg[2];
    solveTread(rig, plan, 1.3); const a = snapshot(rig); solveTread(rig, plan, 1.3 + 2 / 2.05); const b = snapshot(rig);
    assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), 'the treadmill walk repeats every two steps');
    let ahead = -Infinity, behind = Infinity;
    for (let time = 0; time < 2; time += .05) { solveTread(rig, plan, time); const d = rig.wp[fl].z - rig.wp[fr].z; ahead = Math.max(ahead, d); behind = Math.min(behind, d); assert.ok(Math.abs(rig.wp[rig.b.pelvis].z - key.wp[rig.b.pelvis].z) < .05, 'the walker stays on the spot'); }
    assert.ok(ahead > .3 && behind < -.3, 'the feet pass each other, a stride apart');
}
// ---- what people do where they are: a drink is sipped, a hand that is up waves, a brush paints, feet stay put
{
    for (const [who, pose] of [['ben', 'stand-mug'], ['leo', 'sit-raise'], ['lin', 'stand-paint'], ['hale', 'stand-present'], ['kai', 'sit-controller'], ['jo', 'stand-work'], ['priya', 'stretch'], ['zoe', 'stretch-open'], ['andre', 'stand-talk']]) {
        const id = `people-${who}-${pose}`, rig = rigOf(who), key = rig.key(id), seed = 23, hr = rig.side.r.arm[3], hl = rig.side.l.arm[3], head = rig.b.head;
        if (!key) continue;
        solveStill(rig, key, { time: 4, seed, life: 0 }); assert.ok(worst(rig, key) < 1e-9, id + ': without life it is the model as built');
        let moved = 0, near = Infinity;
        for (let time = 0; time < 80; time += .17) {
            solveStill(rig, key, { time, seed });
            assert.ok(rig.lq.every(q => Number.isFinite(q.x + q.y + q.z + q.w)), id + ': a pose at ' + time.toFixed(2));
            moved = Math.max(moved, rig.wp[hr].distanceTo(key.wp[hr])); near = Math.min(near, rig.wp[hr].distanceTo(rig.wp[head]));
            if (!/controller/.test(pose)) for (const s of ['l', 'r']) assert.ok(rig.wp[rig.side[s].leg[2]].distanceTo(key.wp[rig.side[s].leg[2]]) < 3e-4, `${id}: ${s} foot stays put`);
            if (pose === 'stand-work') assert.ok(rig.wp[hl].distanceTo(key.wp[hl]) < .002 && Math.abs(rig.wp[hr].y - key.wp[hr].y) < .004, id + ': one hand steadies the piece, the tool stays at the bench');
            if (pose === 'sit-controller') assert.ok(Math.abs(rig.wp[hl].distanceTo(rig.wp[hr]) - key.wp[hl].distanceTo(key.wp[hr])) < .012, id + ': both hands stay on the pad');
        }
        assert.ok(moved > (pose === 'sit-controller' ? .01 : .03), id + ': it is an activity (' + moved.toFixed(3) + ')');
        if (pose === 'stand-mug') assert.ok(near < .26, id + ': the cup reaches the mouth (' + near.toFixed(3) + ')');
        solveStill(rig, key, { time: 21.4, seed }); const a = snapshot(rig); solveStill(rig, key, { time: 6, seed }); solveStill(rig, key, { time: 21.4, seed });
        assert.deepEqual(snapshot(rig), a, id + ': same time and seed, same pose');
    }
}
// ---- the activity loops of every other posture (ACTS): with life off the model as built; the same second and seed the
// same pose; hands that rest or hold stay on it (a few mm); feet planted, hips on the seat; the head and spine turn a
// little, not a lot; something visibly happens; two people in the same posture do not move together
{
    // contact: 'rest:<sides>' hands at the built place, 'pair' the two hands keep their relation (the box), 'belt' the
    // hands keep their place on the pelvis; 'feet' / 'seat': feet planted / the pelvis where it was built
    const LOOPS = [
        ['mia', 'sit-listen', 'rest:lr seat', 'head'], ['rosa', 'sit-listen', 'rest:lr seat', 'head'], ['maya', 'stand-wait', 'feet', 'head'], ['tess', 'kid-stand-wait', 'feet', 'head'],
        ['andre', 'stand-phone', 'feet', 'thumb'], ['priya', 'sit-phone', 'seat', 'thumb'], ['tess', 'kid-sit-floor', 'rest:lr seat', 'head'], ['priya', 'sit-floor', 'rest:lr seat', 'head'],
        ['jun', 'kid-stand', 'feet', 'hand'], ['ravi', 'kid-read-floor', 'seat', 'hand'], ['grace', 'sit-read', 'seat', 'hand'], ['omar', 'wheel-watch', 'seat', 'hand'],
        ['grace', 'cane-stand', 'rest:r feet', 'hand'], ['jo', 'carry-box', 'pair feet', 'hand'], ['nina', 'stand-chart', 'rest:l feet', 'hand'], ['lin', 'kneel-shelf', 'rest:l seat', 'hand'],
        ['reyes', 'stand-brief', 'belt feet', 'head'], ['reyes', 'stand-radio', 'feet', 'hand'], ['vega', 'sit-microscope', 'rest:lr seat', 'head'], ['noah', 'stand-talk', 'feet', 'hand'],
        ['hale', 'stand-present', 'feet', 'hand'], ['zoe', 'stand-drink', 'feet', 'hand'], ['sofia', 'sit-chat', 'seat', 'hand'], ['kai', 'sit-write', 'seat', 'hand'], ['kai', 'sit-controller', 'seat', 'thumb'],
        ['hale', 'stand-present-left', 'feet', 'head']
    ];
    const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
    const inFrame = (rig, base, i) => rig.wp[i].clone().sub(rig.wp[base]).applyQuaternion(rig.wq[base].clone().invert());
    for (const [who, pose, contact, acts] of LOOPS) {
        const id = `people-${who}-${pose}`, rig = rigOf(who), key = rig.key(id); assert.ok(key, id + ' is built'); assert.equal(key.pose, pose);
        const L = rig.side.l, R = rig.side.r, hl = L.arm[3], hr = R.arm[3], b = rig.b;
        solveStill(rig, key, { time: 7.7, seed: 5, life: 0 }); assert.ok(worst(rig, key) < 1e-9, id + ': without life it is the model as built');
        const pair0 = inFrame(rig, hr, hl), belt0 = [hl, hr].map(h => inFrame(rig, b.pelvis, h)), thumb = rig.index.get('thumb_01_r');
        let miss = 0, active = 0;
        for (const seed of [3, 1009]) for (let time = 0; time < 45; time += .19) {
            solveStill(rig, key, { time, seed });
            assert.ok(rig.lq.every(q => Number.isFinite(q.x + q.y + q.z + q.w)), id + ': a pose at ' + time.toFixed(2));
            const rest = /rest:(\w+)/.exec(contact)?.[1] || '';
            for (const s of rest) miss = Math.max(miss, rig.wp[rig.side[s].arm[3]].distanceTo(key.wp[rig.side[s].arm[3]]));
            if (/pair/.test(contact)) miss = Math.max(miss, inFrame(rig, hr, hl).distanceTo(pair0));
            if (/belt/.test(contact)) [hl, hr].forEach((h, i) => { miss = Math.max(miss, inFrame(rig, b.pelvis, h).distanceTo(belt0[i])); });
            if (/feet/.test(contact)) for (const s of [L, R]) assert.ok(rig.wp[s.leg[2]].distanceTo(key.wp[s.leg[2]]) < 3e-4, `${id}: feet planted at ${time.toFixed(2)}`);
            if (/seat/.test(contact)) assert.ok(rig.wp[b.pelvis].distanceTo(key.wp[b.pelvis]) < 1e-6, `${id}: on the seat at ${time.toFixed(2)}`);
            // a little, not a lot: the head within 4.5 cm of where it was built, neck and head together within 45 degrees
            // (a look about or up from a phone), the spine within 12 degrees
            assert.ok(rig.wp[b.head].distanceTo(key.wp[b.head]) < .045, `${id}: the head stays about where it was (${rig.wp[b.head].distanceTo(key.wp[b.head]).toFixed(3)})`);
            assert.ok(angle(rig.lq[b.neck_01], key.q[b.neck_01]) + angle(rig.lq[b.head], key.q[b.head]) < THREE.MathUtils.degToRad(45), id + ': no broken neck');
            assert.ok([b.spine_01, b.spine_02, b.spine_03].reduce((sum, i) => sum + angle(rig.lq[i], key.q[i]), 0) < THREE.MathUtils.degToRad(12), id + ': the back bends a little');
            active = Math.max(active, acts === 'head' ? angle(rig.wq[b.head], key.wq[b.head]) : acts === 'thumb' ? angle(rig.lq[thumb], key.q[thumb]) : Math.max(rig.wp[hl].distanceTo(key.wp[hl]), rig.wp[hr].distanceTo(key.wp[hr])));
        }
        // (Rosa is built with the arms at full stretch to the table: the breathing alone moves her hands 4 mm, as before)
        assert.ok(miss < (who === 'rosa' ? .005 : .002), `${id}: what is held or rested on stays in the hands (${(miss * 1000).toFixed(2)} mm)`);
        assert.ok(active > (acts === 'head' ? .15 : acts === 'thumb' ? .12 : .03), `${id}: the activity shows (${active.toFixed(3)})`);
        solveStill(rig, key, { time: 18.3, seed: 11 }); const a = snapshot(rig); solveStill(rig, key, { time: 4, seed: 11 }); solveStill(rig, key, { time: 18.3, seed: 11 });
        assert.deepEqual(snapshot(rig), a, id + ': same time and seed, same pose');
        let apart = 0; for (let time = 0; time < 30; time += .5) { solveStill(rig, key, { time, seed: 1 }); const one = [hl, hr, b.head].map(i => rig.wp[i].clone()); solveStill(rig, key, { time, seed: 2 }); apart = Math.max(apart, ...[hl, hr, b.head].map((i, n) => one[n].distanceTo(rig.wp[i]))); }
        assert.ok(apart > .005, id + ': two people in this posture do not move together');
    }
    // the drink comes to the mouth every 8 to 14 seconds, with pauses between
    for (const seed of [1, 2, 3, 77]) {
        const rig = rigOf('zoe'), key = rig.key('people-zoe-stand-drink'), hr = rig.side.r.arm[3], starts = []; let up = false;
        for (let time = 0; time < 120; time += .1) { solveStill(rig, key, { time, seed }); const near = rig.wp[hr].distanceTo(rig.wp[rig.b.head]) < .3; if (near && !up) starts.push(time); up = near; }
        const gaps = starts.slice(1).map((t, i) => t - starts[i]);
        assert.ok(gaps.length >= 7 && gaps.every(g => g > 6 && g < 16.5), 'sips every 8 to 14 s (seed ' + seed + ': ' + gaps.map(g => g.toFixed(1)).join(' ') + ')');
    }
    // the high school's teacher points at the board with his left arm (stand-present-left): with life the point is
    // re-aimed a few degrees, the index fingertip stays within 150 mm of the line it was built on (shoulder to fingertip,
    // which the room aims at the board), the arm within 5 degrees of the posture, the finger as built; the tablet stays level
    {
        const rig = rigOf('hale'), key = rig.key('people-hale-stand-present-left'); assert.ok(key, 'stand-present-left is built');
        const sh = rig.side.l.arm[1], hl = rig.side.l.arm[3], tip = rig.index.get('index_03_l'), tab = rig.side.r.arm[3];
        const index = ['index_01_l', 'index_02_l', 'index_03_l'].map(n => rig.index.get(n));
        solveStill(rig, key, { time: 12.3, seed: 4, life: 0 }); assert.ok(worst(rig, key) < 1e-9, 'stand-present-left: without life it is the model as built');
        const from = key.wp[sh], along = key.wp[tip].clone().sub(from).normalize(), arm0 = key.wp[hl].clone().sub(key.wp[sh]).normalize();
        assert.ok(along.x > .8, 'the point goes out to his left (' + along.toArray().map(v => v.toFixed(2)) + ')');
        let off = 0, turned = 0, finger = 0, tilt = 0;
        for (const seed of [1, 7, 23, 41, 99]) for (let time = 0; time < 20; time += 1 / 20) {
            solveStill(rig, key, { time, seed });
            const p = rig.wp[tip].clone().sub(from); off = Math.max(off, p.clone().sub(along.clone().multiplyScalar(p.dot(along))).length());
            turned = Math.max(turned, rig.wp[hl].clone().sub(rig.wp[sh]).normalize().angleTo(arm0));
            for (const i of index) finger = Math.max(finger, 1 - Math.abs(rig.lq[i].dot(key.q[i])));
            tilt = Math.max(tilt, 2 * Math.acos(Math.min(1, Math.abs(rig.wq[tab].dot(key.wq[tab])))));
        }
        const deg = THREE.MathUtils.radToDeg;
        assert.ok(off < .15, `the fingertip stays on the line to the board (${(off * 1000).toFixed(1)} mm)`);
        assert.ok(turned < THREE.MathUtils.degToRad(5) && turned > THREE.MathUtils.degToRad(1), `the point is re-aimed a few degrees (${deg(turned).toFixed(2)})`);
        assert.ok(finger < 1e-9, 'the index finger stays extended as built');
        assert.ok(tilt < 1e-6, 'the tablet stays level');
    }
}
// ---- a change of posture on the spot
{
    for (const [who, a, bId] of [['grace', 'people-grace-sit-read', 'people-grace-sit-phone'], ['andre', 'people-andre-stand-phone', 'people-andre-stand-wait'], ['mia', 'people-mia-sit-phone', 'people-mia-stand-phone'], ['noah', 'people-noah-stand-wait', 'people-noah-sit-laptop'], ['maya', 'people-maya-stretch', 'people-maya-stand-phone']]) {
        const rig = rigOf(who), from = rig.key(a), to = rig.key(bId); assert.ok(from && to, a + ' -> ' + bId);
        assert.equal(solveChange(rig, from, to, 0).model, 'from'); assert.ok(worst(rig, from) < 1e-9, a + ': starts as built');
        assert.equal(solveChange(rig, from, to, 1).model, 'to'); assert.ok(worst(rig, to) < 1e-9, bId + ': ends as built');
        let last = null; const floor = Math.min(from.wp[rig.side.l.leg[2]].y, to.wp[rig.side.l.leg[2]].y, from.wp[rig.side.r.leg[2]].y, to.wp[rig.side.r.leg[2]].y) - .005;
        for (let w = 0; w <= 1.0001; w += 1 / 90) {
            solveChange(rig, from, to, w);
            const now = rig.wp.map(v => v.clone());
            if (last) for (let i = 0; i < rig.n; i++) assert.ok(now[i].distanceTo(last[i]) < .06, `${a} -> ${bId}: ${rig.names[i]} does not jump at ${w.toFixed(2)} (${now[i].distanceTo(last[i]).toFixed(3)})`);
            for (const s of ['l', 'r']) {
                const [thigh, calf, foot] = rig.side[s].leg; assert.ok(rig.wp[foot].y > floor, `${a} -> ${bId}: ${s} foot not under the floor at ${w.toFixed(2)}`);
                const bend = THREE.MathUtils.radToDeg(rig.wp[thigh].clone().sub(rig.wp[calf]).angleTo(rig.wp[foot].clone().sub(rig.wp[calf]))); assert.ok(bend > 40, `${a} -> ${bId}: knee angle ${bend.toFixed(0)} at ${w.toFixed(2)}`);
            }
            assert.ok(rig.wp[rig.b.head].y > rig.wp[rig.b.pelvis].y + .3, 'head above the hips');
            last = now;
        }
        solveChange(rig, from, to, .43); const x = snapshot(rig); solveChange(rig, from, to, .9); solveChange(rig, from, to, .43); assert.deepEqual(snapshot(rig), x, 'same progress, same pose');
    }
}

// ---- a walk: footprints that stay put, legs that reach them, knees that bend forward, built postures at both ends
for (const who of ['zoe', 'andre', 'grace', 'ben', 'rosa']) {
    const rig = rigOf(who), key = rig.key(`people-${who}-stand-wait`), plan = walkPlan(rig, key, key, [[0, 0], [0, 3], [2, 4.5]]), total = plan.steps.length;
    assert.ok(plan.steps.length >= 8 && Math.abs(plan.length - 5.5) < 1e-9);
    solveWalk(rig, plan, 0); assert.ok(worst(rig, key) < 1e-6, who + ': starts in the posture as built'); solveWalk(rig, plan, total); assert.ok(worst(rig, key) < 1e-6, who + ': ends in it');
    const hold = [null, null]; let last = null, lastRoot = null;
    for (let g = 0; g <= total + 1e-9; g += 1 / 50) {
        const root = { ...solveWalk(rig, plan, g) }, c = Math.cos(root.yaw), sn = Math.sin(root.yaw), world = v => new THREE.Vector3(root.x + v.x * c + v.z * sn, v.y, root.z - v.x * sn + v.z * c);
        ['l', 'r'].forEach((s, which) => {
            const [thigh, calf, foot, ball] = rig.side[s].leg, inAir = plan.steps.some(st => st.which === which && g > st.g0 && g < st.g1 + .18), at = world(rig.wp[ball]);
            if (inAir) hold[which] = null; else if (!hold[which]) hold[which] = at; else assert.ok(at.distanceTo(hold[which]) < .004, `${who}: the ${s} foot stays on its footprint at step ${g.toFixed(2)} (${at.distanceTo(hold[which]).toFixed(4)})`);
            assert.ok(rig.wp[ball].y > .005 && rig.wp[foot].y > .04, who + ': feet above the floor');
            const mid = rig.wp[thigh].clone().lerp(rig.wp[foot], .5); assert.ok(rig.wp[calf].z > mid.z - .015, `${who}: knee bends forward at step ${g.toFixed(2)}`);
        });
        const now = rig.wp.map(world); if (last) for (let i = 0; i < rig.n; i++) assert.ok(now[i].distanceTo(last[i]) < .12, `${who}: ${rig.names[i]} does not jump at step ${g.toFixed(2)}`); last = now;
        if (lastRoot) assert.ok(Math.hypot(root.x - lastRoot.x, root.z - lastRoot.z) < .03 && Math.abs(root.yaw - lastRoot.yaw) < .08, who + ': the hips travel smoothly'); lastRoot = root;
    }
    solveWalk(rig, plan, 4.37); const a = snapshot(rig); solveWalk(rig, plan, 9); solveWalk(rig, plan, 4.37); assert.deepEqual(snapshot(rig), a, who + ': same step, same pose');
}

// ---- the film's walkers (S19, Nov 14): a walk cast in the built walking posture (mid-stride, feet pitched, hips low)
// starts and ends standing; a gait of a person, not a crouch or a march: steps that fit the leg and the pace, feet
// that stay on their footprints without going into the floor, the toes flat while the heel is up, the swinging foot
// clear of the floor, about 10 degrees of knee in mid-stance and about 60 in the swing, a hip bob of a few
// centimetres, the trunk nearly upright and the eyes ahead. (The paths and paces of the cine cut's walkers.)
{
    const mm = list => list.map(([x, z]) => [x / 1000, z / 1000]), deg = r => r * 180 / Math.PI;
    const walkers = [
        ['andre', 'people-andre-walk', 'people-andre-stand-phone-pull', mm([[100, 1560], [-107, 1948], [-201, 2080], [-476, 2245], [-1136, 2267], [-1397, 2155], [-1496, 1890], [-1436, 1707], [-1291, 1582], [-1120, 1538]]), { pace: 2.1, step: .45 }],
        ['yara', 'people-yara-walk', 'people-yara-stand-wait', mm([[7230, -1657], [6827, -2453], [5568, -3049], [4242, -3447], [2651, -3513], [1326, -3579]]), {}],
        ['zoe', 'people-zoe-walk', 'people-zoe-stand-wait', mm([[2500, 1500], [3900, 1500]]), {}],
        ['noah', 'people-noah-stand-wait', 'people-noah-stand-screen-pull', mm([[-2681, -1248], [-2818, -914], [-2930, -1080]]), { pace: 2.2 }],
        ['ben', 'people-ben-walk', 'people-ben-walk', mm([[0, 0], [0, 4000]]), {}],
    ];
    for (const [who, fromId, toId, route, options] of walkers) {
        const rig = rigOf(who); if (!rig.has(fromId) || !rig.has(toId)) continue;
        const stand = rig.key(`people-${who}-stand-wait`), from = rig.key(fromId), to = rig.key(toId), plan = walkPlan(rig, from, to, route, options), total = plan.steps.length;
        const leg = rig.offset[rig.side.l.leg[1]].length() + rig.offset[rig.side.l.leg[2]].length();
        // a walking posture is not where a walk starts: standing is
        if (from.pose === 'walk') { assert.equal(plan.from, stand, who + ': the walk starts from standing, not mid-stride'); solveWalk(rig, plan, 0); assert.ok(worst(rig, stand) < 1e-6, who + ': standing at the start'); }
        if (to.pose === 'walk') assert.equal(plan.to, stand, who + ': and ends standing');
        // steps that fit the leg and the pace: 0.45-0.75 of the leg (hip to ankle) a step, 0.6-1.4 m/s
        assert.ok(plan.step > .45 * leg && plan.step < .75 * leg, `${who}: a step of ${plan.step.toFixed(3)} m for a leg of ${leg.toFixed(3)} m`);
        assert.ok(plan.step * plan.pace > .6 && plan.step * plan.pace < 1.4, `${who}: ${(plan.step * plan.pace).toFixed(2)} m/s`);
        // the feet set apart about as the hips are, not the stance's width (no waddle)
        const across = plan.steps.slice(0, -2).map(st => { const at = plan.along(st.to.s); return 2 * Math.hypot(st.to.x - at.x, st.to.z - at.z); });
        if (across.length) assert.ok(Math.max(...across) < .16, `${who}: step width ${Math.max(...across).toFixed(3)} m`);
        const ballStand = ['l', 'r'].map(s => stand.wp[rig.side[s].leg[3]].y), held = [null, null];
        let midKnee = [], swingKnee = 0, pelvis = [], trunk = [];
        for (let g = 0; g <= total + 1e-9; g += 1 / 60) {
            const root = { ...solveWalk(rig, plan, g) }, c = Math.cos(root.yaw), sn = Math.sin(root.yaw), world = v => new THREE.Vector3(root.x + v.x * c + v.z * sn, v.y, root.z - v.x * sn + v.z * c);
            const steady = g > 1.2 && g < total - 1.5, knee = s => { const [th, ca, fo] = rig.side[s].leg; return deg(rig.wp[ca].clone().sub(rig.wp[th]).angleTo(rig.wp[fo].clone().sub(rig.wp[ca]))); };
            ['l', 'r'].forEach((s, which) => {
                const [, , foot, ball] = rig.side[s].leg, st = plan.steps.find(x => x.which === which && g > x.g0 && g < x.g1), air = st ? (g - st.g0) / (st.g1 - st.g0) : -1;
                const prints = plan.prints[which], print = st ? st.from : plan.steps.filter(x => x.which === which && g >= x.g1).pop()?.to || prints[0];
                // the ball of a planted foot: on its footprint (not sliding), never under the floor; the toes flat (the toe
                // tip, 6 cm on from the ball along the toes, the bone's y, not below the ball's standing height)
                if (!st) {
                    const at = world(rig.wp[ball]), flat = rig.wp[ball].y < ballStand[which] + .004; if (!held[which]) { if (flat) held[which] = at; } else if (flat) assert.ok(Math.hypot(at.x - held[which].x, at.z - held[which].z) < .004, `${who}: the ${s} foot stays put at ${g.toFixed(2)}`);
                    assert.ok(rig.wp[ball].y > ballStand[which] - (print.y - (stand.wp[foot].y)) - .002, `${who}: the ${s} ball is not in the floor at ${g.toFixed(2)} (${rig.wp[ball].y.toFixed(4)})`);
                    const toe = new THREE.Vector3(0, .06, 0).applyQuaternion(rig.wq[ball]).add(rig.wp[ball]);
                    assert.ok(toe.y > ballStand[which] - .012, `${who}: the ${s} toes stay flat, not through the floor, at ${g.toFixed(2)} (${toe.y.toFixed(4)})`);
                } else held[which] = null;
                // the swinging foot clears the floor in mid-swing (ball and ankle), but is not lifted like a march
                if (air > .3 && air < .7 && steady) {
                    assert.ok(rig.wp[ball].y > ballStand[which] + .012, `${who}: the ${s} toes clear the floor in the swing at ${g.toFixed(2)}`);
                    assert.ok(rig.wp[foot].y < stand.wp[foot].y + .14, `${who}: the ${s} foot is not lifted high at ${g.toFixed(2)} (${rig.wp[foot].y.toFixed(3)})`);
                    swingKnee = Math.max(swingKnee, knee(s));
                    if (air > .4 && air < .6) midKnee.push(knee(s === 'l' ? 'r' : 'l'));
                }
            });
            if (steady) { pelvis.push(rig.wp[rig.b.pelvis].y); const tr = rig.wp[rig.b.neck_01].clone().sub(rig.wp[rig.b.pelvis]); trunk.push(deg(Math.atan2(tr.z, tr.y))); }
        }
        if (total >= 6) {
            const mean = midKnee.reduce((a, b) => a + b, 0) / midKnee.length, bob = Math.max(...pelvis) - Math.min(...pelvis), drop = stand.wp[rig.b.pelvis].y - Math.max(...pelvis);
            assert.ok(mean > 3 && mean < 18, `${who}: the standing knee in mid-stance ${mean.toFixed(1)} deg`);
            assert.ok(swingKnee > 45 && swingKnee < 72, `${who}: the knee in the swing up to ${swingKnee.toFixed(1)} deg`);
            assert.ok(bob > .01 && bob < .055, `${who}: the hips bob ${(bob * 1000).toFixed(0)} mm`);
            assert.ok(drop < .03, `${who}: the hips at their highest ${(drop * 1000).toFixed(0)} mm under standing (no crouch)`);
            assert.ok(Math.min(...trunk) > 0 && Math.max(...trunk) < 6, `${who}: the trunk ${Math.min(...trunk).toFixed(1)}-${Math.max(...trunk).toFixed(1)} deg forward`);
        }
    }
    // relaxed arms (Vico/chingon: Yara's arms held out): in the steady walk the elbow is loose, 15-45 degrees, and the
    // forearm never comes up in front past 60 degrees from hanging
    for (const who of ['andre', 'yara', 'zoe', 'dina']) {
        const rig = rigOf(who), k = rig.key(`people-${who}-walk`), plan = walkPlan(rig, k, k, [[0, 0], [0, 5]]), sag = (a, b) => { const d = rig.wp[b].clone().sub(rig.wp[a]); return deg(Math.atan2(d.z, -d.y)); };
        for (let g = 2; g < plan.steps.length - 2; g += .05) {
            solveWalk(rig, plan, g);
            for (const s of ['l', 'r']) { const [, u, l, h] = rig.side[s].arm, elbow = sag(l, h) - sag(u, l); assert.ok(elbow > 15 && elbow < 45 && sag(l, h) < 60, `${who}: the ${s} arm hangs loose at ${g.toFixed(2)} (elbow ${elbow.toFixed(0)}, forearm ${sag(l, h).toFixed(0)} deg)`); }
        }
    }
    // chingon's rule (S20): nobody near the lens turns faster than about 120 deg/s, body or head: the walks' corners and
    // end turns are spread out (TURN_RATE), Andre's U-turn behind the desk and Noah's short walk to the screen included
    for (const [who, fromId, toId, route, options] of walkers) {
        const rig = rigOf(who); if (!rig.has(fromId) || !rig.has(toId)) continue;
        const plan = walkPlan(rig, rig.key(fromId), rig.key(toId), route, who === 'andre' ? { ...options, endYaw: THREE.MathUtils.degToRad(117) } : options), dt = 1 / 120, wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
        let body = null, head = null, fastest = 0, fastestHead = 0;
        for (let t = 0; t <= plan.seconds + 1e-9; t += dt) {
            const root = { ...solveWalk(rig, plan, plan.at(t)) }, f = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.wq[rig.b.head]), h = root.yaw + Math.atan2(f.x, f.z);
            if (body !== null) { fastest = Math.max(fastest, Math.abs(wrapped(root.yaw - body)) / dt); fastestHead = Math.max(fastestHead, Math.abs(wrapped(h - head)) / dt); }
            body = root.yaw; head = h;
        }
        assert.ok(deg(fastest) <= 120 && deg(fastestHead) <= 120, `${who}: turns at most 120 deg/s (body ${deg(fastest).toFixed(0)}, head ${deg(fastestHead).toFixed(0)})`);
    }
    // the end of a walk faces exactly the way asked (endYaw: the next placement's turn), or along the last leg however
    // short it is (S9's reviewer: Noah's 0.2 m last leg left him 47 degrees off, then a snap at the change)
    {
        const rig = rigOf('noah'), key = rig.key('people-noah-stand-wait'), route = [[-2.681, -1.248], [-2.818, -.914], [-2.930, -1.080]], last = Math.atan2(-.112, -.166);
        const wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
        const p1 = walkPlan(rig, key, key, route, { pace: 2.2 }), r1 = { ...solveWalk(rig, p1, p1.steps.length) };
        assert.ok(Math.abs(wrapped(r1.yaw - last)) < 1e-6, `facing along the short last leg at the end (${(r1.yaw * 180 / Math.PI).toFixed(1)} deg)`);
        const p2 = walkPlan(rig, key, key, route, { pace: 2.2, endYaw: THREE.MathUtils.degToRad(-146) }), r2 = { ...solveWalk(rig, p2, p2.steps.length) };
        assert.ok(Math.abs(wrapped(r2.yaw - THREE.MathUtils.degToRad(-146))) < 1e-6, 'facing the way asked at the end');
        const p3 = walkPlan(rig, key, key, [[0, 0], [0, 1.5], [.15, 1.6]], { endYaw: Math.PI / 2 }), r3 = { ...solveWalk(rig, p3, 0) };
        assert.ok(Math.abs(r3.yaw) < 1e-6, 'and along the first leg at the start');
        let last3 = null; for (let g = 0; g <= p3.steps.length; g += 1 / 60) { const y = solveWalk(rig, p3, g).yaw; if (last3 !== null) assert.ok(Math.abs(wrapped(y - last3)) < .06, 'turning smoothly to it'); last3 = y; }
        assert.ok(p3.prints.every(list => Math.abs(wrapped(list[list.length - 1].yaw - Math.PI / 2)) < 1e-6), 'the feet end turned that way too');
    }
    // a turn too big for the walk at TURN_RATE keeps both ends exact (the rate rises, plan.turnRate says so)
    {
        const rig = rigOf('noah'), key = rig.key('people-noah-stand-wait'), plan = walkPlan(rig, key, key, [[0, 0], [0, .6]], { endYaw: Math.PI, pace: 2.6 }), wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
        assert.ok(Math.abs(wrapped(solveWalk(rig, plan, 0).yaw)) < 1e-6 && Math.abs(wrapped(solveWalk(rig, plan, plan.steps.length).yaw - Math.PI)) < 1e-6, 'both ends of an over-fast turn kept');
        assert.ok(plan.turnRate > 120, `and the rate reported: ${plan.turnRate.toFixed(0)} deg/s`);
    }
    // the drawn heels (shoeFit on the film walkers' own models, skinned as the stage does): behind the ankle, so every
    // foot lands heel first (S19 review: Zoe's 'heel' was 81 mm ahead of the ankle and she landed toe first)
    {
        await MeshoptDecoder.ready;
        const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
        const skin = async (rig, id) => {
            const doc = await io.read(path.join(root, 'assets/props', id + '.glb')), node = doc.getRoot().listNodes().find(n => n.getMesh() && n.getSkin()), sk = node.getSkin();
            const joints = sk.listJoints().map(j => j.getName()), ibm = joints.map((_, i) => new THREE.Matrix4().fromArray(sk.getInverseBindMatrices().getElement(i, []))), side = joints.map(n => { const m = /^(calf|foot|ball)_(l|r)$/.exec(n); return m ? (m[2] === 'l' ? 0 : 1) : -1; });
            return () => { const M = joints.map((n, k) => new THREE.Matrix4().compose(rig.wp[rig.index.get(n)], rig.wq[rig.index.get(n)], new THREE.Vector3(1, 1, 1)).multiply(ibm[k])), out = [], a = [], b = [], c = [], v = new THREE.Vector3(), w = new THREE.Vector3();
                for (const prim of node.getMesh().listPrimitives()) { if (/Held/.test(prim.getMaterial()?.getName() || '')) continue; const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
                    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, a); J.getElement(i, b); W.getElement(i, c); const t = c[0] + c[1] + c[2] + c[3] || 1; w.set(0, 0, 0); let best = -1, k0 = -1; for (let k = 0; k < 4; k++) { if (!c[k]) continue; w.addScaledVector(v.fromArray(a).applyMatrix4(M[b[k]]), c[k] / t); if (c[k] > best) { best = c[k]; k0 = b[k]; } } if (w.y < .15 && side[k0] >= 0) out.push([w.x, w.y, w.z, side[k0]]); } }
                return out; };
        };
        for (const [who, fromId, toId, route, options] of walkers.slice(0, 4)) {
            const rig = rigOf(who); if (!rig.has(fromId) || !rig.has(toId)) continue;
            const points = await skin(rig, fromId); let plan = walkPlan(rig, rig.key(fromId), rig.key(toId), route, options);
            solveWalk(rig, plan, 0); const fit = shoeFit(rig, points());
            assert.ok(fit.heels.every(h => h && h[1] < 0), `${who}: the measured heels are behind the ankles (${JSON.stringify(fit.heels)})`);
            plan = walkPlan(rig, rig.key(fromId), rig.key(toId), route, { ...options, ...fit });
            for (const st of plan.steps.slice(1, -2)) {
                solveWalk(rig, plan, st.g1 + .02); const a = rig.wp[rig.side[st.which ? 'r' : 'l'].leg[2]]; let low = null;
                for (const [x, y, z, k] of points()) if (k === st.which && (!low || y < low[1])) low = [x, y, z];
                assert.ok(low[2] < a.z + .02, `${who}: lands heel first at ${st.g1.toFixed(2)} (lowest point ${((low[2] - a.z) * 1000).toFixed(0)} mm from the ankle)`);
            }
        }
    }
    // the drawn soles (room-people.mjs soleOf / landOf): the footprints lower by the sole's height, the ankle at a
    // landing lower by the heel's
    const rig = rigOf('zoe'), key = rig.key('people-zoe-walk'), a = walkPlan(rig, key, key, [[0, 0], [0, 3]]), b = walkPlan(rig, key, key, [[0, 0], [0, 3]], { sole: [.004, .011], land: [.005, .006] });
    assert.ok(a.prints.every((list, i) => list.every((p, j) => Math.abs(p.y - b.prints[i][j].y - [.004, .011][i]) < 1e-9)), 'the footprints lower by the drawn soles');
    const land = b.steps.find(st => st.which === 0 && st.g1 > 2); solveWalk(rig, a, land.g1 + .01); const ya = rig.wp[rig.side.l.leg[2]].y; solveWalk(rig, b, land.g1 + .01);
    assert.ok(Math.abs(ya - .004 - rig.wp[rig.side.l.leg[2]].y - .005) < .0015, 'a landing foot lower by the drawn heel');
    // toes: 'stiff' keeps the whole foot pitched at heel-off (the old way); the default bends the toes
    const stiff = walkPlan(rig, key, key, [[0, 0], [0, 3]], { toes: 'stiff' }), off = a.steps[3].g0 - .05;
    const toes = rig.side[a.steps[3].which ? 'r' : 'l'].leg[3];
    solveWalk(rig, a, off); const bent = rig.lq[toes].clone(); solveWalk(rig, stiff, off);
    assert.ok(!stiff.toes && a.toes && 1 - Math.abs(bent.dot(rig.lq[toes])) > 1e-4, 'the toes bend unless stiff');
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
    assert.deepEqual(at(2.2), ['people-maya-sit-type-30'], 'at 29.9 in the 30 in model is the one drawn'); assert.ok(actor.chair.position.z > 230 + 150 && actor.chair.position.z < 230 + 340, 'the chair rolls back with her');
    assert.ok(people.dirty, 'she moved: the film redraws her shadow');
    // (half way up she is drawn as her bench-height model, one of her desk postures, with her arms loose)
    assert.deepEqual(at(6), ['people-maya-stand-low']); assert.ok(close(quat(people.people.find(o => o.visible), 'upperarm_l'), built('people-maya-stand-wait', 'upperarm_l')), 'standing by while the desk rises');
    assert.ok(Math.abs(actor.chair.position.z - (230 + 505)) < 2 && actor.chair.visible, 'the chair is left 505 mm back');
    assert.deepEqual(at(13), ['people-maya-stand-type']); assert.ok(close(quat(people.byKey('stands'), 'upperarm_l'), built('people-maya-stand-type', 'upperarm_l')), 'typing again at 43.5 in, as built');
    assert.deepEqual([people.byKey('stands').position.x, people.byKey('stands').position.z], [60, 175]);
    at(2.2); const again = quat(people.byKey('sits30'), 'thigh_l'); at(9); at(2.2);
    assert.deepEqual(quat(people.byKey('sits30'), 'thigh_l'), again, 'scrubbing back to a second gives the same bones');
    // her own fine tuning (the Director's pose mode) turns the bone from where the motion has it
    people.setFilter({ only: [], cast: cast.map(c => c.key === 'stands' ? { ...c, pose: { head: [0, .2, 0, .98] } } : c), life: false }); await people.built; at(13);
    const tuned = new THREE.Quaternion().fromArray(built('people-maya-stand-type', 'head')).multiply(new THREE.Quaternion(0, .2, 0, .98)).normalize().toArray();
    assert.ok(close(quat(people.byKey('stands'), 'head'), tuned), 'a pose adjustment sits on top of the motion');
    // a tilted top stows its keyboard: she stays where she stood, hands off the keys
    {
        const flat = { seconds: 14, heightAt: () => 43.5, tiltAt: t => t > 4 ? 30 : 0 };
        people.update({ ...desk, height: 43.5, tilt: 0, time: 1, track: flat, now: 0 }); const stood = people.byKey('stands').position.clone(); assert.equal(actor.state.k, 1);
        people.update({ pose: desk.pose, keyboard: { x: -400, z: -900 }, height: 43.5, tilt: 30, time: 8, track: flat, now: 0 });
        assert.deepEqual(shown(), ['people-maya-stand-type']); assert.ok(people.byKey('stands').position.distanceTo(stood) < 1 && actor.state.k === 0, 'she has not followed the stowed keyboard, and her hands are off');
    }
    // a parked chair (the film's people.chair) is where the film puts it while she stands
    people.setFilter({ only: [], cast, life: false, chair: { back: 300, side: 760, turn: -42 } }); await people.built; at(13);
    assert.ok(Math.abs(actor.chair.position.x - (60 + 760)) < 2 && Math.abs(actor.chair.position.z - 530) < 2, 'parked where the chapter says');
    // away from the desk for a moment (the gym chapter: Maya stretches while the desk rises): the film's own cast of her
    // elsewhere is her, so she is not at the desk as well; her chair stays where it was parked (review, November 13)
    {
        const { room: gym } = makeRoom('gym'), p2 = new RoomPeople(gym, library), seen = time => { p2.update({ ...desk, height: track.heightAt(time), time, track, now: 0 }); return p2.people.filter(o => o.visible).map(o => o.userData.person.id); };
        p2.setFilter({ only: [], cast: [...cast, { key: 'break', id: 'people-maya-stretch', at: [-421, 350], turn: 180 }], when: { break: [[5, 9, 0, 0]] }, life: false, chair: { back: 300, side: 760, turn: -42 } }); await p2.setEnabled(true);
        assert.deepEqual(seen(7), ['people-maya-stretch'], 'stretching, and not at the desk too'); assert.ok(p2.actors.find(a => a.members.length).chair.visible, 'her chair stays in the room');
        assert.deepEqual(seen(13), ['people-maya-stand-type'], 'back at the desk when the stretch is over');
        p2.setFilter({ only: [], cast: [...cast, { key: 'waits', id: 'people-maya-stand-wait', at: [-167, 405], turn: 180 }], when: { waits: [[5, 9, 0, 0]] }, life: false }); await p2.setEnabled(true);
        assert.equal(seen(7).length, 1, 'an older cut\'s standing-by stand-in still gives way to the desk user (one of her)');
        await p2.setEnabled(false);
    }
    // stepping out from the desk (`fromDesk`, the gym chapter since November 14: Vico saw her go from seated to stretching
    // to standing in dissolves): she gets up at the desk as it sets off (the chair rolls aside), then her bones change
    // from where she stands to the stretch and, at the window's end, back to where she is at the keys; one whole model of
    // her at every moment, with no jump at either end
    {
        const { room: gym } = makeRoom('gym'), p3 = new RoomPeople(gym, library), park = { back: 100, side: -700, turn: 60 };
        const seen = time => { p3.update({ ...desk, height: track.heightAt(time), time, track, now: 0 }); return p3.people.filter(o => o.visible); };
        p3.setFilter({ only: [], cast: [...cast, { key: 'break', id: 'people-maya-stretch', fromDesk: true, at: [60, 260], turn: 180 }], when: { break: [[5.5, 12.5, .3, .35]] }, life: false, chair: park }); await p3.setEnabled(true);
        seen(0); await p3.settled(); seen(0);
        const me = p3.actors.find(a => a.members.length), stretch = () => p3.byKey('break'), L = 1.4 + Math.min(1, Math.abs(me.rig.key('people-maya-stretch').wp[me.rig.b.pelvis].y - me.keys.wait.wp[me.rig.b.pelvis].y) / .3);
        const [start, end] = [5.5 - L / 2, 12.5 + L / 2], bones = o => [...o.userData.personRig.bones.entries()].filter(([n]) => n !== 'still').map(([n, b]) => [n, b.quaternion.clone(), b.position.clone()]);
        const sameBones = (a, b, eps) => a.every(([n, q, p], i) => n === b[i][0] && q.angleTo(b[i][1]) < eps && p.distanceTo(b[i][2]) < eps);
        assert.ok(stretch().userData.personRig && stretch().userData.personStepHome, 'the stretch is rigged before it is needed');
        seen(start - .3); assert.ok(me.state.tau >= 2.6 - 1e-6 && me.state.k === 0, 'she is up, hands off the keys, before she steps out');
        for (let t = 0; t <= 14; t += .05) { const v = seen(t); assert.equal(v.length, 1, 'one model of her at ' + t.toFixed(2) + ' s'); assert.equal(v[0].userData.personAmount, 1, 'whole, not dissolving, at ' + t.toFixed(2)); assert.ok(me.chair.visible, 'her chair stays'); }
        // out: the last frame at the desk and the first of the change are the same body in the same place
        const before = seen(start - 1e-4)[0], b0 = bones(before), p0 = before.position.clone(); assert.match(before.userData.person.id, /^people-maya-stand-/);
        const first = seen(start + 1e-4)[0]; assert.equal(first.userData.person.id, 'people-maya-stretch');
        assert.ok(sameBones(bones(first), b0, 2e-3) && first.position.distanceTo(p0) < 2, 'she steps out from where she stands, as she stands');
        assert.ok(Math.abs(me.chair.position.x - (60 - 700)) < 2, 'the chair has rolled aside (parked) by then');
        // half way she is on her way; after it she is in the stretch as built, at its spot
        const mid = seen(5.5)[0]; assert.equal(mid.userData.person.id, 'people-maya-stretch'); assert.ok(!sameBones(bones(mid), b0, 1e-2) && mid.position.distanceTo(stretch().userData.personStepHome.position) > 1, 'half way through the change');
        const held = seen(9)[0], built9 = new THREE.Quaternion().fromArray(built('people-maya-stretch', 'upperarm_l'));
        assert.equal(held, stretch()); assert.ok(held.userData.personRig.bones.get('upperarm_l').quaternion.angleTo(built9.normalize()) < 1e-3, 'stretching, as built'); assert.ok(held.position.distanceTo(held.userData.personStepHome.position) < 1e-6, 'where the film put her');
        // in: the change ends as the desk user is then (hands on the keys), and she carries on from there
        const last = seen(end - 1e-4)[0], b1 = bones(last), p1 = last.position.clone(); assert.equal(last.userData.person.id, 'people-maya-stretch');
        const after = seen(end + 1e-4)[0]; assert.equal(after.userData.person.id, 'people-maya-stand-type'); assert.equal(me.state.k, 1);
        assert.ok(sameBones(bones(after), b1, 2e-3) && after.position.distanceTo(p1) < 2, 'back at the keys from where the change left her');
        // scrubbing gives the same bones; outside the window the stretch is at its own spot again, unseen
        seen(6); const a6 = bones(stretch()); seen(10); seen(13.9); seen(6); assert.ok(sameBones(bones(stretch()), a6, 1e-6), 'same second, same pose');
        seen(13.9); assert.ok(!stretch().visible && stretch().position.distanceTo(stretch().userData.personStepHome.position) < 1e-6);
        // a second placement stepping out at the same time is left out (one of her), with one warning
        const warn = console.warn, warned = []; console.warn = m => warned.push(m);
        p3.setFilter({ only: [], cast: [...cast, { key: 'break', id: 'people-maya-stretch', fromDesk: true, at: [60, 260], turn: 180 }, { key: 'break2', id: 'people-maya-stretch-2', fromDesk: true, at: [60, 260], turn: 180 }], when: { break: [[5.5, 12.5]], break2: [[8, 10]] }, life: false, chair: park }); await p3.setEnabled(true);
        seen(0); await p3.settled(); seen(0);
        for (const t of [7, 9, 11]) for (let i = 0; i < 2; i++) assert.deepEqual(seen(t).map(o => o.userData.person.id), ['people-maya-stretch'], 'one of her at ' + t + ' s');
        console.warn = warn; assert.equal(warned.filter(m => /break2/.test(m)).length, 1, 'warned once');
        await p3.setEnabled(false);
    }
    // Studio path: the live height, stepped; a jump of the desk is taken as it stands
    people.setFilter({ only: [], cast, life: false }); await people.built;
    let now = 0, h = 28; const live = (target, steps) => { for (let i = 0; i < steps; i++) { now += 1000 / 60; h += Math.sign(target - h) * Math.min(Math.abs(target - h), 1.55 / 60); people.update({ ...desk, height: h, target: Math.abs(target - h) > 1e-3 ? target : null, time: null, now }); assert.equal(shown().length, 1); } };
    live(28, 2); assert.deepEqual(shown(), ['people-maya-sit-type']); assert.equal(people.moving, false);
    live(43.5, 120); assert.ok(people.moving, 'on her way up two seconds after the desk set off');
    live(43.5, 600); assert.deepEqual(shown(), ['people-maya-stand-type']); assert.ok(!people.moving && actor.state.k === 1);
    live(36, 400); assert.deepEqual(shown(), ['people-maya-stand-low']); assert.equal(actor.state.k, 1, 'a desk stopped at 36 in: she works at it standing low, hands on the keys');
    live(28, 600); assert.deepEqual(shown(), ['people-maya-sit-type']); assert.ok(actor.state.k === 1 && Math.abs(actor.chair.position.z - 230) < 1, 'seated and typing, the chair back under her');
    await people.setEnabled(false); assert.ok(!actor.chair.visible && shown().length === 0 && chair.visible, 'people off: she and her chair are gone, the room\'s chair is back');
    // a change of posture inside a shot: two windows that meet are one person whose bones go from one to the other
    {
        const two = [{ key: 'reads', id: 'people-grace-sit-read', at: [1500, 900], turn: 20 }, { key: 'phones', id: 'people-grace-sit-phone', at: [1500, 900], turn: 20 }];
        people.setFilter({ only: [], cast: two, when: { reads: [[0, 5]], phones: [[5, 10]] }, life: false }); await people.setEnabled(true);
        const see = time => { people.update({ ...desk, height: 28, time, now: 0 }); return shown(); };
        see(0); await new Promise(r => setTimeout(r, 20)); await Promise.all(people.pairs.map(p => people.readyChange(p)));
        assert.equal(people.pairs.length, 1, 'the two windows make one change'); const pair = people.pairs[0]; assert.ok(pair.ready && Math.abs(pair.length - 1.4) < .2);
        assert.deepEqual(see(3), ['people-grace-sit-read']);
        const arm = key => quat(people.byKey(key), 'lowerarm_l'), builtArm = id => { const d = dataOf('grace'), i = d.bones.indexOf('lowerarm_l'); return d.postures[id].q.slice(i * 4, i * 4 + 4); };
        assert.ok(close(arm('reads'), builtArm('people-grace-sit-read')), 'before the change she reads, as built');
        for (let t = 4.2; t <= 5.8; t += .05) { const who = see(t); assert.equal(who.length, 1, 'one model of her at ' + t.toFixed(2)); assert.equal(people.byKey(who[0] === 'people-grace-sit-read' ? 'reads' : 'phones').userData.personAmount, 1, 'whole, not dissolving'); }
        assert.deepEqual(see(4.8), ['people-grace-sit-read']); assert.ok(!close(arm('reads'), builtArm('people-grace-sit-read'), 1e-3), 'her arm is on its way');
        assert.deepEqual(see(5.3), ['people-grace-sit-phone']); assert.ok(!close(arm('phones'), builtArm('people-grace-sit-phone'), 1e-3));
        assert.deepEqual(see(7), ['people-grace-sit-phone']); assert.ok(close(arm('phones'), builtArm('people-grace-sit-phone')), 'after it she is on her phone, as built');
        assert.deepEqual(see(3), ['people-grace-sit-read']); assert.ok(close(arm('reads'), builtArm('people-grace-sit-read')), 'scrubbed back: reading, as built');
        // Studio: the same two cast for different dayparts change when the daypart does
        people.setFilter({ only: [], cast: [{ ...two[0], modes: ['morning'] }, { ...two[1], modes: ['evening'] }], life: false }); await people.setEnabled(true);
        let clock = 0; const day = (mode, steps = 1) => { for (let i = 0; i < steps; i++) { clock += 1000 / 60; people.update({ ...desk, height: 28, time: null, mode, now: clock }); assert.equal(shown().length, 1, 'one of her in the ' + mode); } return shown(); };
        day('morning'); await new Promise(r => setTimeout(r, 20)); await Promise.all(people.pairs.map(p => people.readyChange(p)));
        assert.equal(people.pairs.filter(p => p.ready).length, 2, 'a change each way between the two dayparts');
        assert.deepEqual(day('morning', 5), ['people-grace-sit-read']); assert.equal(people.moving, false);
        assert.deepEqual(day('evening', 20), ['people-grace-sit-read'], 'the daypart changes: she is still the reader, turning into the other posture'); assert.ok(people.moving);
        assert.deepEqual(day('evening', 200), ['people-grace-sit-phone']); assert.ok(close(arm('phones'), builtArm('people-grace-sit-phone')) && !people.moving, 'two seconds later she is on her phone, as built');
        assert.deepEqual(day('morning', 200), ['people-grace-sit-read']); assert.ok(close(arm('reads'), builtArm('people-grace-sit-read')), 'and back in the morning');
    }
    // a cast replaced while its models are still loading leaves nobody behind
    {
        people.setFilter({ only: [], cast: [{ key: 'o', id: 'people-omar-wheel-type-28', desk: 'wheel' }] }); const first = people.setEnabled(true);
        people.setFilter({ only: [], cast }); await people.setEnabled(true); await first; await new Promise(r => setTimeout(r, 20));
        assert.ok(!people.people.some(o => /omar/.test(o.userData.person.id)) && !room.root.children.some(o => /omar/.test(o.name)), 'the replaced cast is not in the room');
    }
    // a film's walker: standing at the start, walking the path, standing at its end; the same second is the same stride
    {
        people.setFilter({ only: [], cast: [{ key: 'walker', id: 'people-zoe-stand-wait', at: [0, 1000], turn: 0, walk: { path: [[0, 1000], [0, 3500], [1500, 4500]], start: 2 } }] }); await people.setEnabled(true);
        const see = time => { people.update({ ...desk, height: 28, time, now: 0 }); const o = people.byKey('walker'); return [o.position.x, o.position.z, o.rotation.y]; };
        see(0); await new Promise(r => setTimeout(r, 30)); const start = see(0);
        assert.ok(people.byKey('walker').userData.personLife?.plan, 'the walk is planned');
        assert.ok(Math.hypot(start[0], start[1] - 1000) < 1 && Math.abs(start[2]) < 1e-6, 'before the start she stands at the head of the path, facing along it');
        assert.deepEqual(see(1.9), start);
        const length = 2500 + Math.hypot(1500, 1000), plan = people.byKey('walker').userData.personLife.plan; let last = see(2), gone = 0;
        for (let t = 2; t <= 2 + plan.seconds + .001; t += .05) { const p = see(t), d = Math.hypot(p[0] - last[0], p[1] - last[1]); assert.ok(d < 90, 'no jump along the path at ' + t.toFixed(2) + ' (' + d.toFixed(0) + ' mm)'); gone += d; last = p; }
        assert.ok(Math.abs(gone - length) < 60, 'she walks the length of the path (' + gone.toFixed(0) + ' of ' + length.toFixed(0) + ' mm)');
        const end = see(2 + plan.seconds + 1); assert.ok(Math.hypot(end[0] - 1500, end[1] - 4500) < 1, 'and stands at its end');
        const mid = see(5); const bones = quat(people.byKey('walker'), 'thigh_l'); see(8); see(3); assert.deepEqual(see(5), mid); assert.deepEqual(quat(people.byKey('walker'), 'thigh_l'), bones, 'scrubbed back: the same stride');
    }
    // the still models for one use of the room
    people.setFilter({ only: [], cast, motion: false }); await people.setEnabled(true);
    assert.equal(people.actors.length, 0); people.update({ ...desk, height: 39.5, time: 5 }); assert.deepEqual(shown(), [], 'motion off, in a film: nobody at 38 to 40 in, as its chapters were made (the mid-height posture is the Studio\'s)');
    people.update({ ...desk, height: 33, time: 5 }); assert.deepEqual(shown(), [], 'motion off: nobody between the built heights, as before');
    people.dispose();
    // ---- a stroll: in the Studio someone cast in a walking posture walks a clear stretch, turns and comes back
    {
        const { ROOM_PEOPLE } = await import('../room-people.mjs');
        ROOM_PEOPLE.strolltest = [{ id: 'people-zoe-walk', at: [0, 0], turn: 0 }];
        const { room } = makeRoom('strolltest'); room.roomLayout = { id: 'house', width: 6000, depth: 7000, back: -1500 }; room.root.children[0].position.set(2500, 0, -1000);      // (the chair out of the way)
        const walkers = new RoomPeople(room, library); await walkers.setEnabled(true); await walkers.built;
        let now = 0, far = 0, back = Infinity, maxStep = 0, last = null;
        for (let i = 0; i < 60 * 30; i++) {
            now += 1000 / 60; walkers.update({ pose: { x: -2000, z: -1200, yaw: 0 }, height: 28, time: null, now }); if (i % 30 === 0) await walkers.settled(200);
            const o = walkers.people[0], d = Math.hypot(o.position.x, o.position.z);
            assert.ok(Math.abs(o.position.x) < 3000 - 250 && o.position.z > -1500 + 250 && o.position.z < 5500 - 250, 'the stroller stays inside the room');
            if (last) maxStep = Math.max(maxStep, Math.hypot(o.position.x - last[0], o.position.z - last[1])); last = [o.position.x, o.position.z];
            far = Math.max(far, d); if (far > 1400) back = Math.min(back, d);
        }
        assert.ok(far >= 1500 && far <= 4600, 'the stroller walks a stretch of the room (' + Math.round(far) + ' mm)');
        assert.ok(back < 60, 'and comes back to where the room put them (' + Math.round(back) + ' mm)');
        assert.ok(maxStep < 40, 'at a walk, without a jump (' + maxStep.toFixed(1) + ' mm a frame)');
        // a film: the same person keeps their place
        for (let i = 0; i < 200; i++) { now += 1000 / 60; walkers.update({ pose: { x: -2000, z: -1200, yaw: 0 }, height: 28, time: null, now }); }      // out on the stretch again
        walkers.update({ pose: { x: -2000, z: -1200, yaw: 0 }, height: 28, time: 3, now });
        assert.deepEqual([walkers.people[0].position.x, walkers.people[0].position.z], [0, 0], 'at a film\'s second the walker stands where the room (or the cut) has them');
        walkers.dispose(); delete ROOM_PEOPLE.strolltest;
    }
    // ---- the Studio's lively people: chosen in the camera's picture (someone behind it is never made skinned), made
    // skinned in idle time, and coming to life gradually from the posture as built (no jump at the hand-over)
    {
        const { ROOM_PEOPLE } = await import('../room-people.mjs');
        ROOM_PEOPLE.livelytest = [{ key: 'front', id: 'people-zoe-stand-wait', at: [0, 0], turn: 180 }, { key: 'side', id: 'people-andre-stand-wait', at: [1200, 1500], turn: 180 }, { key: 'behind', id: 'people-grace-stand-wait', at: [0, -7000], turn: 0 }];
        const { room } = makeRoom('livelytest'); room.roomLayout = { id: 'house', width: 9000, depth: 16000, back: -8000 }; room.root.children[0].position.set(4000, 0, 6000);
        const crowd = new RoomPeople(room, library); await crowd.setEnabled(true); await crowd.built;
        const camera = new THREE.PerspectiveCamera(45, 16 / 9, 10, 1e6); camera.position.set(0, 1500, -4000); camera.lookAt(0, 800, 3000); camera.updateMatrixWorld();
        crowd.view = camera; let now = 0; const step = () => { now += 1000 / 60; crowd.update({ pose: { x: -4000, z: 7000, yaw: 0 }, height: 28, time: null, now }); };
        const of = key => crowd.byKey(key);
        step(); await crowd.settled(2000); step();
        assert.ok(of('front').userData.personRig && of('side').userData.personRig, 'the two in the picture are made skinned');
        assert.equal(of('behind').userData.personLife, undefined, 'someone behind the camera is never made skinned');
        // the first frames of life: a small part of it, the bones close to the posture as built
        const life = of('front').userData.personLife, rig = life.rig, key = life.key; assert.ok(life.amount > 0 && life.amount < .1, 'comes to life gradually (' + life.amount.toFixed(3) + ')');
        let most = 0; for (let i = 0; i < rig.n; i++) most = Math.max(most, rig.wp[i].distanceTo(key.wp[i])); assert.ok(most < .004, 'at the hand-over the pose is the one built (' + (most * 1000).toFixed(1) + ' mm)');
        for (let i = 0; i < 60; i++) step(); assert.equal(life.amount, 1, 'fully alive after a second'); assert.ok(life.live);
        // turned away from them: they go back to the posture as built over the easing, and stop
        camera.lookAt(0, 800, -12000); camera.updateMatrixWorld(); now += 600; for (let i = 0; i < 70; i++) step();
        assert.equal(life.amount, 0); assert.equal(life.live, false, 'out of the picture: back to the posture as built');
        let off = 0; for (let i = 0; i < rig.n; i++) off = Math.max(off, rig.wp[i].distanceTo(key.wp[i])); assert.ok(off < 1e-6, 'exactly as built');
        crowd.dispose(); delete ROOM_PEOPLE.livelytest;
    }
    // ---- seats: someone a film places at a spot in a seated posture sits on the room's chair that is there (it stays);
    // with nothing to sit on they get a task chair of their own; someone standing where a chair is still clears it
    {
        const { ROOM_PEOPLE } = await import('../room-people.mjs');
        ROOM_PEOPLE.seattest = [];
        const desk = { pose: { x: -3000, z: -3000, yaw: 0 }, height: 28, time: 0, now: 0 };
        const seatRoom = () => { const made = makeRoom('seattest'); made.room.roomLayout = { id: 'house', width: 8000, depth: 8000, back: -4000 }; made.chair.position.set(1000, 0, 1000); return made; };
        const run = async (cast, life = false) => { const made = seatRoom(), seats = new RoomPeople(made.room, library); seats.setFilter({ only: [], cast, ...(life ? {} : { life: false }) }); await seats.setEnabled(true); await seats.built;
            for (let i = 0; i < 3; i++) { seats.update(desk); await seats.settled(500); } return { seats, chair: made.chair }; };
        const sat = await run([{ key: 'on-chair', id: 'people-sofia-sit-laptop', at: [1000, 1000], turn: 0 }, { key: 'on-air', id: 'people-kai-sit-write', at: [-1500, 1500], turn: 90 }]);
        assert.ok(sat.chair.visible, 'the room\'s chair stays under someone seated on its spot');
        assert.ok(!sat.seats.byKey('on-chair').userData.personChair, 'and they get no second chair');
        const air = sat.seats.byKey('on-air'), own = air.userData.personChair;
        assert.ok(own && own.visible && own.parent === sat.seats.room.root, 'seated where there is nothing to sit on: a chair of their own');
        assert.ok(Math.hypot(own.position.x - air.position.x, own.position.z - air.position.z) < 1 && Math.abs(own.rotation.y - air.rotation.y) < 1e-6, 'under them, facing the way they face');
        sat.seats.dispose();
        const stood = await run([{ key: 'stands', id: 'people-zoe-stand-wait', at: [1000, 1000], turn: 0 }]);
        assert.ok(!stood.chair.visible && !stood.seats.byKey('stands').userData.personChair, 'someone standing where a chair is: the chair makes way, and they get none');
        stood.seats.dispose();
        // a film's walker: cast in the walking posture with a path, they walk it (the stride, then the standing posture)
        const walk = await run([{ key: 'walks', id: 'people-zoe-walk', at: [0, 0], turn: 90, walk: { to: [1400, 0], start: 0, then: 'people-zoe-stand-wait' } }], true);
        const xs = []; for (const time of [0, .4, .8, 1.2, 3]) { walk.seats.update({ ...desk, time }); xs.push(walk.seats.byKey('walks').position.x); }
        assert.ok(xs[0] < 5 && xs.every((x, i) => !i || x >= xs[i - 1] - 1e-6) && xs[2] > 150 && Math.abs(xs[4] - 1400) < 5, 'a film\'s walker in the walking posture walks their path: ' + xs.map(x => Math.round(x)).join(', '));
        walk.seats.dispose();
        // the walk ends turned as the placement that takes over there stands (the `then` posture at the path's end), and
        // a walker with `look` looks at them (S9's reviewer: Noah ended 47 degrees off and looked away)
        const head = run => run.seats.byKey('walks').userData.personRig.bones.get('head').getWorldQuaternion(new THREE.Quaternion());
        const walker = more => ({ key: 'walks', id: 'people-zoe-walk', at: [0, 0], turn: 90, walk: { to: [1400, 0], start: 0, then: 'people-zoe-stand-wait' }, ...more });
        const friend = { key: 'friend', id: 'people-ben-stand-wait', at: [2600, -400], turn: -60 }, then = { key: 'then', id: 'people-zoe-stand-wait', at: [1400, 0], turn: 120 };
        const plain = await run([walker({}), then, friend], true); plain.seats.update({ ...desk, time: 5 });
        assert.ok(Math.abs(plain.seats.byKey('walks').rotation.y - THREE.MathUtils.degToRad(120)) < 1e-3, 'the walk ends facing as the next placement stands: ' + (plain.seats.byKey('walks').rotation.y * 180 / Math.PI).toFixed(1));
        const looks = await run([walker({ look: 'friend' }), then, friend], true); looks.seats.update({ ...desk, time: 5 });
        assert.ok(1 - Math.abs(head(plain).dot(head(looks))) > 1e-3, 'a walker with `look` turns the head to them');
        plain.seats.dispose(); looks.seats.dispose(); delete ROOM_PEOPLE.seattest;
    }
}
// ---- the working cut: whoever steps out from the desk (`fromDesk`) is up before the step and has their hands back on
// the keys by the end of the step back, inside the chapter (the wellness chapter since November 14)
{
    const { sampleClipMotion } = await import('../experience/desk-clips.mjs');
    const cut = JSON.parse(fs.readFileSync(path.join(root, 'exports/cinematic-intro-cut-cine/review-cut.json'), 'utf8')), byId = new Map(index.props.map(p => [p.id, p]));
    let checked = 0;
    for (const shot of cut.shots) for (const c of shot.people?.cast || []) {
        if (!c.fromDesk) continue;
        const who = byId.get(c.id)?.person?.character, rig = rigOf(who), ids = [...(shot.people.cast || []).filter(d => d.desk && !d.station).map(d => d.id), ...(shot.people.only || [])];
        const desk = ids.map(id => byId.get(id)?.person).filter(p => p && p.character === who && Number.isFinite(p.deskHeight));
        const heights = role => desk.filter(p => p.pose.startsWith(role)).map(p => p.deskHeight);
        const sim = simulateDesk(deskDescription(heights('sit'), heights('stand')), t => sampleClipMotion(shot.motion, t).height, shot.seconds, 60);
        const length = 1.4 + Math.min(1, Math.abs(rig.key(c.id).wp[rig.b.pelvis].y - rig.key(`people-${who}-stand-wait`).wp[rig.b.pelvis].y) / .3);
        for (const [t0, t1] of shot.people.when[c.key]) {
            const out = sim.at(t0 - length / 2), back = sim.at(t1 + length / 2);
            assert.ok(out.tau >= STAND_UP - 1e-3 && out.k < 1e-3, `${shot.id}: ${c.key} steps out at ${(t0 - length / 2).toFixed(2)} s once ${who} is up, hands off the keys (tau ${out.tau.toFixed(2)}, k ${out.k.toFixed(2)})`);
            assert.ok(back.tau >= STAND_UP - 1e-3 && back.k > 1 - 1e-3, `${shot.id}: ${c.key} is back at the keys, hands on, at ${(t1 + length / 2).toFixed(2)} s (k ${back.k.toFixed(2)})`);
            assert.ok(t1 - t0 >= length && t1 + length / 2 <= shot.seconds, `${shot.id}: ${c.key}'s window holds both steps inside the chapter`);
            // nobody else of hers away from the desk meanwhile (another step out, an older placement that dissolves in): one of her
            for (const d of shot.people.cast.filter(d => d !== c && !d.desk && shot.people.when?.[d.key] && byId.get(d.id)?.person?.character === who && byId.get(d.id)?.person?.pose !== 'stand-wait'))
                for (const [u0, u1] of shot.people.when[d.key]) assert.ok(u1 + (d.fromDesk ? length / 2 : 0) < t0 - length / 2 || u0 - (d.fromDesk ? length / 2 : 0) > t1 + length / 2, `${shot.id}: ${d.key} is not away from the desk while ${c.key} is`);
            checked++;
        }
    }
    assert.ok(checked >= 1, 'the wellness chapter steps out from the desk');
}
// ---- the workshop film's change options (room-people-motion.mjs solveChange `arms` and `shift`, walkPlan `toes`)
{
    const rig = rigOf('andre'), shelf = rig.key('people-andre-stand-robot-shelf'), go = rig.key('people-andre-stand-wait'), hand = rig.side.r.arm[3];
    // without the options a change is as before
    solveChange(rig, shelf, go, .3); const plain = snapshot(rig); solveChange(rig, shelf, go, .3, null, null); assert.deepEqual(snapshot(rig), plain, 'no options: the change as before');
    // arms: [.35, 1]: the hands have not left the shelf posture's place (in the model's frame) before .35 of the change
    solveChange(rig, shelf, go, .3, [.35, 1]); const early = rig.wp[hand].clone(); solveChange(rig, shelf, go, .3);
    assert.ok(rig.wp[hand].distanceTo(go.wp[hand]) < early.distanceTo(go.wp[hand]) - .01, 'arms [.35, 1]: the hands still at the shelf at .3, the default has them on the way');
    solveChange(rig, shelf, go, 1, [.35, 1]); assert.ok(worst(rig, go) < 1e-9, 'arms window: ends as built');
    // shift: a step back 0.2 m (the model moves -z in its own frame... its spot moves +0.2 m behind him): each foot stays on
    // the floor where it was in the room until its step, then is where the new spot has it
    const fl = rig.side.l.leg[2], fr = rig.side.r.leg[2], back = .2, room = (v, e) => v.z + back * e;
    for (const w of [0, .02]) { const e = THREE.MathUtils.smoothstep(w, 0, .6); solveChange(rig, shelf, go, w, [.35, 1], { x: 0, z: back, e }); assert.ok(Math.abs(room(rig.wp[fl], e) - shelf.wp[fl].z) < .002 && Math.abs(room(rig.wp[fr], e) - shelf.wp[fr].z) < .002, 'step: both feet planted at the start'); }
    { const w = .42, e = THREE.MathUtils.smoothstep(w, 0, .6); solveChange(rig, shelf, go, w, [.35, 1], { x: 0, z: back, e }); assert.ok(Math.abs(room(rig.wp[fl], e) - (go.wp[fl].z + back)) < .003, 'step: the left foot has stepped back'); assert.ok(Math.abs(room(rig.wp[fr], e) - shelf.wp[fr].z) < .03, 'step: the right foot not yet'); }
    for (let w = 0, last = null; w <= 1.0001; w += 1 / 60) { const e = THREE.MathUtils.smoothstep(w, 0, .6); solveChange(rig, shelf, go, w, [.35, 1], { x: 0, z: back, e }); const f = [room(rig.wp[fl], e), room(rig.wp[fr], e)]; if (last) assert.ok(Math.abs(f[0] - last[0]) < .03 && Math.abs(f[1] - last[1]) < .03, 'step: no foot jumps'); for (const i of [fl, fr]) assert.ok(rig.wp[i].y > .07, 'step: feet not under the floor'); last = f; }
    solveChange(rig, shelf, go, 1, [.35, 1], { x: 0, z: back, e: 1 }); assert.ok(worst(rig, go) < 1e-9, 'step: ends as built');
    // a step that turns as well (the workshop's turn away, 105 deg): a foot on the floor stays where it is in the room
    // while the model turns under it, and nothing jumps
    {
        const walkKey = rig.key('people-andre-walk'), yaw = THREE.MathUtils.degToRad(105), d = { x: -.04, z: .12 }, ease = w => THREE.MathUtils.smoothstep(w, 0, 1);
        const room = (v, e) => new THREE.Vector3(v.x, v.y, v.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw * e).add(new THREE.Vector3(d.x * e, 0, d.z * e));
        let last = null;
        for (let w = 0; w <= 1.0001; w += 1 / 120) {
            const e = ease(w); solveChange(rig, go, walkKey, w, [.1, .6], { ...d, yaw, e });
            const f = [fl, fr].map(i => room(rig.wp[i], e));
            if (w > .01 && w < .03) assert.ok(f[0].distanceTo(room(go.wp[fl], 0)) < .003 && f[1].distanceTo(room(go.wp[fr], 0)) < .003, 'turning step: both feet where they stood at the start');
            if (last) for (const k of [0, 1]) assert.ok(f[k].distanceTo(last[k]) < .03, 'turning step: no foot jumps at ' + w.toFixed(3));
            last = f;
        }
        // over 60 deg the turn is two steps each, the feet taking turns (left first: a turn to his left): each foot is
        // planted while the other steps, and no foot is ever turned much further round than the body over it (one step
        // each had the left foot 70-80 deg out from the body, Nov 17)
        { const e = ease(.15); solveChange(rig, go, walkKey, .15, [.1, .6], { ...d, yaw, e }); assert.ok(room(rig.wp[fr], e).distanceTo(room(go.wp[fr], 0)) < .003, 'turning step: the right foot planted while the left steps'); }
        { const e0 = ease(.3), e1 = ease(.4); solveChange(rig, go, walkKey, .3, [.1, .6], { ...d, yaw, e: e0 }); const l0 = room(rig.wp[fl], e0); solveChange(rig, go, walkKey, .4, [.1, .6], { ...d, yaw, e: e1 });
            assert.ok(room(rig.wp[fl], e1).distanceTo(l0) < .003 && room(rig.wp[fr], e1).distanceTo(room(go.wp[fr], 0)) > .02, 'turning step: the left foot planted half way round while the right steps'); }
        const ankleYaw = (r, k, f) => { const [, , foot, ball] = r.side[f].leg, v = k.wp[ball].clone().sub(k.wp[foot]); return Math.atan2(v.x, v.z); };
        let most = 0;
        for (let w = 0; w <= 1.0001; w += 1 / 60) { const e = ease(w); solveChange(rig, go, walkKey, w, [.1, .6], { ...d, yaw, e }); for (const s of ['l', 'r']) { const [, , foot, ball] = rig.side[s].leg, v = rig.wp[ball].clone().sub(rig.wp[foot]); most = Math.max(most, Math.abs(THREE.MathUtils.radToDeg(Math.atan2(Math.sin(Math.atan2(v.x, v.z) - ankleYaw(rig, go, s)), Math.cos(Math.atan2(v.x, v.z) - ankleYaw(rig, go, s)))))); } }
        assert.ok(most < 50, `turning step: a foot at most ${most.toFixed(0)} deg round from the body (as it stands)`);
        solveChange(rig, go, walkKey, 1, [.1, .6], { ...d, yaw, e: 1 }); assert.ok(worst(rig, walkKey) < 1e-9, 'turning step: ends as built');
        // a turn under 60 deg is one step each, as before
        const small = THREE.MathUtils.degToRad(14), es = ease(.3); solveChange(rig, go, walkKey, .3, [.1, .6], { ...d, yaw: small, e: es });
        const rs = (v, e) => new THREE.Vector3(v.x, v.y, v.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), small * e).add(new THREE.Vector3(d.x * e, 0, d.z * e));
        assert.ok(rs(rig.wp[fr], es).distanceTo(rs(go.wp[fr], 0)) < .003, 'a small turn: the right foot planted while the left makes its one step');
    }
    // the workshop film's chain of postures pairs into skeleton blends with margin: one spot (< 215 mm, < 0.27 rad apart)
    // and windows that meet, so no step of it falls back to a dissolve (sameSpot: 220 mm, 0.3 rad)
    {
        const cut = JSON.parse(fs.readFileSync(new URL('../exports/cinematic-intro-cut-cine/review-cut.json', import.meta.url), 'utf8')), st = cut.shots.find(s => s.id === 'storage').people, by = Object.fromEntries(st.cast.map(c => [c.key, c]));
        const chain = ['andre-robot', 'andre-lift', 'andre-shelf', 'andre-lets-go', 'andre-steps-back'];
        for (let i = 1; i < chain.length; i++) {
            const a = by[chain[i - 1]], b = by[chain[i]], turn = Math.abs(THREE.MathUtils.euclideanModulo(THREE.MathUtils.degToRad(a.turn - b.turn) + Math.PI, Math.PI * 2) - Math.PI);
            assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) < 215 && turn < .27, `${a.key} -> ${b.key} pairs with margin`);
            assert.equal(st.when[a.key][0][1], st.when[b.key][0][0], `${a.key} -> ${b.key}: the windows meet`);
        }
    }
    // the robot postures as built, whoever is in them: the hands out at the robot (on the workbench mat, then lifting it),
    // not at the chest, and no wrist turned past what a forearm turns from the arm hanging (stand-wait): the hand bone
    // carries all of it (no twist bones), so more pinches the wrist (Nov 17: the left at 132 deg, both hands 1 cm in
    // front of the shoulders; the lift's wrists 120-145 deg)
    {
        // (the hand's turn about the forearm's length: the hand bone's turn in the forearm's frame, about its y)
        const twist = (rig, k, s) => { const [, , lower, hand] = rig.side[s].arm, q = k.wq[lower].clone().invert().multiply(k.wq[hand]); return THREE.MathUtils.radToDeg(2 * Math.atan2(q.y, q.w)); };
        const apart = (a, b) => Math.abs(THREE.MathUtils.euclideanModulo(a - b + 180, 360) - 180);
        let robots = 0; const rigs = new URL('../assets/props/people-rigs/', import.meta.url);   // (`path` is this block's walk path below)
        for (const file of fs.readdirSync(rigs).filter(f => f.endsWith('.json'))) {
            const who = file.slice(0, -5), data = JSON.parse(fs.readFileSync(new URL(file, rigs), 'utf8'));
            const ids = Object.keys(data.postures).filter(id => /^stand-robot-/.test(data.postures[id].pose)); if (!ids.length) continue;
            const rig = rigOf(who), hang = rig.key(`people-${who}-stand-wait`);
            for (const id of ids) {
                const k = rig.key(id);
                for (const s of ['l', 'r']) {
                    const [, upper, , hand] = rig.side[s].arm, out = k.wp[hand].z - k.wp[upper].z;
                    assert.ok(out > .2, `${id}: the ${s} hand ${(out * 1000).toFixed(0)} mm in front of the shoulder (out at the robot, not at the chest)`);
                    if (hang) { const d = apart(twist(rig, k, s), twist(rig, hang, s)); assert.ok(d < 110, `${id}: the ${s} wrist turned ${d.toFixed(0)} deg from hanging (a pinch at the wrist)`); }
                }
                robots++;
            }
        }
        assert.ok(robots >= 3, 'the workshop robot postures are checked');
    }
    // toes: 'bend': while a heel is up the toes stay level (the ball bone flat), and the walk is otherwise the same
    const key = rig.key('people-andre-stand-wait'), path = [[0, 0], [0, 3]], a = walkPlan(rig, key, key, path, { toes: 'stiff' }), b = walkPlan(rig, key, key, path, { toes: 'bend' }), ball = rig.side.l.leg[3];
    assert.equal(a.toes, false); assert.equal(b.toes, true);
    let flatter = 0;
    for (let g = .5; g < a.steps.length - 1; g += 1 / 20) {
        solveWalk(rig, a, g); const pa = rig.wp.map(v => v.clone()), ta = Math.abs(new THREE.Euler().setFromQuaternion(rig.wq[ball]).x);
        solveWalk(rig, b, g); const tb = Math.abs(new THREE.Euler().setFromQuaternion(rig.wq[ball]).x);
        for (const i of [rig.b.pelvis, rig.b.head, rig.side.l.leg[2], rig.side.r.leg[2]]) assert.ok(rig.wp[i].distanceTo(pa[i]) < 1e-9, 'toes: the body and ankles walk as before');
        if (tb < ta - .05) flatter++;
    }
    assert.ok(flatter > 10, 'toes: the toes are flatter while the heel is up (' + flatter + ' samples)');
}
// ---- swing: 'path' (Nov 17, storage's Andre: his legs crossed on the tight turn round the desk's end): the swinging
// foot goes along the path on its own side of it, not on the straight line between its footprints. The same walk on a
// straight path; on a tight turn the shins stay apart and the feet never cross under the body.
{
    const rig = rigOf('andre'), key = rig.key('people-andre-stand-wait'), walk = rig.key('people-andre-walk');
    const straight = [[0, 0], [0, 3]], a = walkPlan(rig, walk, key, straight), b = walkPlan(rig, walk, key, straight, { swing: 'path' });
    assert.equal(a.swing, false); assert.equal(b.swing, true);
    for (let g = 0; g <= a.steps.length; g += 1 / 30) { solveWalk(rig, a, g); const pa = snapshot(rig); solveWalk(rig, b, g); assert.ok(snapshot(rig).every((v, i) => Math.abs(v - pa[i]) < 1e-9), 'swing path: a straight walk as before at ' + g.toFixed(2)); }
    // the old storage route (a 0.37 m U-turn behind the desk's end, 0.49 m steps) and the cut's route now
    const mm = list => list.map(([x, z]) => [x / 1000, z / 1000]);
    const old = mm([[60, 1935], [-250, 2107], [-345, 2200], [-476, 2245], [-636, 2267], [-1136, 2267], [-1232, 2254], [-1321, 2216], [-1397, 2155], [-1454, 2077], [-1487, 1986], [-1496, 1890], [-1478, 1794], [-1436, 1707], [-1372, 1635], [-1291, 1582], [-1199, 1552], [-1120, 1538]]);
    const cut = JSON.parse(fs.readFileSync(path.join(root, 'exports/cinematic-intro-cut-cine/review-cut.json'), 'utf8')), w = cut.shots.find(s => s.id === 'storage').people.cast.find(c => c.key === 'andre-steps-back').walk;
    const legsOf = (r, from, to, route, options) => {
        const plan = walkPlan(r, from, to, route, { endYaw: THREE.MathUtils.degToRad(117), ...options }); let shins = Infinity, across = Infinity;
        for (let g = 0; g <= plan.steps.length; g += 1 / 60) {
            solveWalk(r, plan, g); const [, c1, f1] = r.side.l.leg, [, c2, f2] = r.side.r.leg;
            for (let u = 0; u <= 10; u++) for (let v = 0; v <= 10; v++) shins = Math.min(shins, r.wp[c1].clone().lerp(r.wp[f1], u / 10).distanceTo(r.wp[c2].clone().lerp(r.wp[f2], v / 10)));
            across = Math.min(across, r.wp[f1].x - r.wp[f2].x);      // (the model's frame: + the left ankle on his left)
        }
        return { shins, across };
    };
    const pull = rig.key('people-andre-stand-phone-pull'), opts = { pace: w.pace, step: w.step / 1000 };
    const before = legsOf(rig, walk, pull, old, { pace: 2.33, step: .45 }), now = legsOf(rig, walk, pull, mm(w.path), { ...opts, swing: w.swing });
    assert.ok(before.shins < .05 && before.across < -.1, `the old route crossed his legs (shins ${(before.shins * 1000).toFixed(0)} mm apart, ankles ${(before.across * 1000).toFixed(0)} mm)`);
    assert.equal(w.swing, 'path', 'the storage walk follows its path with the swinging foot');
    assert.ok(now.shins > .1 && now.across > .02, `the cut's route: shins ${(now.shins * 1000).toFixed(0)} mm apart at the closest, ankles never crossed (${(now.across * 1000).toFixed(0)} mm)`);
    // the same route with straight swings still crosses: the option, not the route alone, keeps them apart
    const straightSwing = legsOf(rig, walk, pull, mm(w.path), opts);
    assert.ok(straightSwing.shins < now.shins - .05, `straight swings on that route: shins ${(straightSwing.shins * 1000).toFixed(0)} mm`);
    // another man in the slot (the walk travels with the placement): the same route keeps his legs apart too
    for (const who of ['ben', 'noah']) {
        const r2 = rigOf(who), got = legsOf(r2, r2.key(`people-${who}-walk`), r2.key(`people-${who}-stand-wait`), mm(w.path), { ...opts, swing: 'path' });
        assert.ok(got.shins > .1 && got.across > .02, `${who} on Andre's route: shins ${(got.shins * 1000).toFixed(0)} mm apart, ankles ${(got.across * 1000).toFixed(0)} mm`);
    }
    // the feet on the turn (Nov 17, Vico: "his shoes, his feet look pretty awkward"): with swing: 'path' a footprint faces
    // the way the body does while the foot is on it, and the foot pivots on its ball before it leaves, so a planted foot
    // is never turned far from the body (heading-laid footprints had them up to 69 deg out); the ankles move smoothly
    // through the pivot (no jump), for any man's rig
    for (const who of ['andre', 'ben', 'noah']) {
        const r = rigOf(who), key = r.key(`people-${who}-stand-wait`), route = mm(w.path), axis = (k, s) => { const [, , foot, ball] = r.side[s].leg, v = k.wp[ball].clone().sub(k.wp[foot]); return Math.atan2(v.x, v.z); };
        const base = { l: axis(key, 'l'), r: axis(key, 'r') }, Yv = new THREE.Vector3(0, 1, 0);
        const turned = options => {
            const plan = walkPlan(r, key, key, route, { ...opts, endYaw: THREE.MathUtils.degToRad(117), ...options }); let most = 0, jump = 0, last = null;
            for (let g = 0; g <= plan.steps.length; g += 1 / 120) {
                const root = { ...solveWalk(r, plan, g) }, now = ['l', 'r'].map(s => r.wp[r.side[s].leg[2]].clone().applyAxisAngle(Yv, root.yaw).add(new THREE.Vector3(root.x, 0, root.z)));
                if (last) jump = Math.max(jump, ...now.map((p, i) => p.distanceTo(last[i]))); last = now;
                ['l', 'r'].forEach((s, k) => { if (plan.steps.some(st => st.which === k && g > st.g0 && g < st.g1)) return; const a = axis(r, s) - base[s]; most = Math.max(most, Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))); });
            }
            return { most: THREE.MathUtils.radToDeg(most), jump };
        };
        const laid = turned({}), faced = turned({ swing: 'path' });
        assert.ok(laid.most > 60, `${who}: footprints along the path's heading: a planted foot ${laid.most.toFixed(0)} deg from the body`);
        assert.ok(faced.most < 52, `${who}: footprints facing with the body: a planted foot at most ${faced.most.toFixed(0)} deg from it`);
        assert.ok(faced.jump < .02, `${who}: no ankle jumps through the pivots (${(faced.jump * 1000).toFixed(1)} mm a 1/120 step)`);
    }
}
console.log('PASS room people motion: rig files, the desk driver (rise, lower, stop, turn back, tilt, wheelchair, short stature), exact end poses, planted feet, knees, keyboard following, determinism, life, the person in the room (film and Studio paths, chair, pose adjustments on top), posture changes in a shot and with the daypart, a walk along a path, stepping out from the desk and back.');
