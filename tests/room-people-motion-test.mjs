// The person at the desk moving between postures (room-people-motion.mjs): pure functions, no browser.
//   node tests/room-people-motion-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { PersonRig, DeskActor, simulateDesk, settleDesk, stepDesk, deskDescription, deskWants, solveDesk, solveStill, solveChange, walkPlan, solveWalk, STAND_UP } from '../room-people-motion.mjs';

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
    maya.state = null; maya.drive({ height: 28, tilt: 8, time: null, dt: 0 }); assert.equal(maya.state.k, 0, 'an adult typist still takes the hands off a tilted top');
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
}
console.log('PASS room people motion: rig files, the desk driver (rise, lower, stop, turn back, tilt, wheelchair, short stature), exact end poses, planted feet, knees, keyboard following, determinism, life, the person in the room (film and Studio paths, chair, pose adjustments on top), posture changes in a shot and with the daypart, a walk along a path.');
