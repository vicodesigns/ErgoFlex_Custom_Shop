// The person at the desk moving between postures (room-people-motion.mjs): pure functions, no browser.
//   node tests/room-people-motion-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PersonRig, DeskActor, simulateDesk, settleDesk, stepDesk, deskDescription, deskWants, solveDesk, STAND_UP } from '../room-people-motion.mjs';

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
console.log('PASS room people motion: rig files, the desk driver (rise, lower, stop, turn back, tilt, wheelchair, short stature), exact end poses, planted feet, knees, keyboard following, determinism, life.');
