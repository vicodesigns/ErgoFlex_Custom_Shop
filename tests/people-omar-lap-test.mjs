// Omar in the media film (24 Nov 2026, Vico's 3rd cut, chapter 'media', "Movie night, upgraded."): he rolls in with his hands on the
// rims, lets go at 4.2 s and brings them up to rest on his knees, and between 4.2 and 4.9 s his hands and forearms went through his
// thighs (and through the knees for the rest of the chapter). The hand's and forearm's skin points against the thigh, knee and trunk
// skin of the baked model, by its own normals (tests/lib/people-surface.mjs), over the whole chapter:
//   - the roll along the path (0 to 4.2 s): the lap fix leaves the pose exactly as the roll made it
//   - the change from the roll posture to the watching one, every 1/120 s, with Vico's pose keys on the watch placement, and with the
//     arms moving in other parts of the change (the chapter's timing shifts: the same maths of `w`, so the same holds)
//   - the watching, 4.9 s to 17 s, every frame at 30 fps, for several seeds (breathing, the nods, a hand that lets go and comes back)
// It also checks that what the fix is for is real (without it the same frames are 50 mm deep in his thighs), that people whose arms
// never went into their laps are not moved at all, and the places in the code the film's frames pass through.
//   node tests/people-omar-lap-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rollPlan, solveStill } from '../room-people-motion.mjs';
import { blendPoses } from '../people-pose-keys.mjs';
import { lapPose, lapClear, armBones } from '../people-lap.mjs';
import LAP from '../people-lap-data.mjs';
import { Lap, turned } from './lib/people-lap-run.mjs';
import { ROOT } from './lib/people-surface.mjs';

const mm = m => (m * 1000).toFixed(1) + ' mm', TOL = .006;
// Vico's pose keys on the media film's 'omar' placement (the 3rd cut, checkpoint director/checkpoint-1124e): one key at 0 s that turns
// both arms to lift the hands onto the knees. The arms' own bones only.
const FINE = {
    upperarm_l: [-.0727, -.0141, .0286, .9968], lowerarm_l: [.2233, 0, .0217, .9745], hand_l: [.0793, .004, -.1361, .9875],
    upperarm_r: [-.0672, .0108, -.025, .9974], lowerarm_r: [.2013, 0, -.0196, .9793], hand_r: [.0694, -.0035, .1215, .9902],
};
const omar = await new Lap('omar', { fine: FINE }).load(), raw = await new Lap('omar', { fine: FINE, lap: false }).load(), built = await new Lap('omar', { lap: false }).load();

// ---- the fault is real: the same frames without the fix
{
    let hand = 0, fore = 0;
    for (let w = 0; w <= 1.0001; w += 1 / 60) { raw.change(Math.min(1, w)); const d = raw.depth(); hand = Math.max(hand, d.hand); fore = Math.max(fore, d.fore); }
    assert.ok(hand > .03 && fore > .03, `without the fix the hands (${mm(hand)}) and the forearms (${mm(fore)}) are deep in the thighs during the change`);
    let rest = 0;
    for (let t = 5; t < 17; t += .5) { raw.still(t, 3); const d = raw.depth(); rest = Math.max(rest, d.hand, d.fore); }
    assert.ok(rest > .01, `and at rest (${mm(rest)}) with the pose keys' turn on the posture as built`);
    built.still(8, 3); const b = built.depth(); assert.ok(b.hand > .03, `the posture as built has the hands ${mm(b.hand)} in the thighs`);
}

// ---- the roll: his hands stay on the rims, the fix does nothing there
{
    const rig = omar.rig, plan = rollPlan([[0, 2.55], [.56, 1.33], [.38, .823]], { speed: .7, radius: .6 });
    let frames = 0, most = 0;
    for (let t = 0; t <= Math.min(plan.seconds, 4.2) + 1e-9; t += 1 / 30) {
        solveStill(rig, omar.roll, { time: t, seed: 3, life: 1, roll: plan.at(t) }); rig.fk();
        assert.equal(lapPose(rig, null), null, `the pose of the roll at ${t.toFixed(2)} s is left as it is`);
        if (frames++ % 6 === 0) { const d = omar.depth(); most = Math.max(most, d.hand, d.fore); }
    }
    assert.ok(most < TOL, `rolling: hands and forearms are clear of his body (${mm(most)})`);
}

// ---- the change, every 1/120 s: nothing of his hands or forearms in his thighs, knees, shins or trunk
for (const arms of [null, [0, .6], [.4, 1], [.1, .45]]) {
    let hand = 0, fore = 0, at = 0;
    for (let w = 0; w <= 1.00001; w += 1 / 120) {
        omar.change(Math.min(1, w), { arms }); const d = omar.depth();
        if (d.hand > hand) { hand = d.hand; at = w; } fore = Math.max(fore, d.fore);
    }
    assert.ok(hand < TOL, `change, arms ${JSON.stringify(arms)}: the hands are ${mm(hand)} deep at w ${at.toFixed(3)}`);
    assert.ok(fore < TOL, `change, arms ${JSON.stringify(arms)}: the forearms are ${mm(fore)} deep`);
}
{
    // it starts exactly as the roll posture and ends on the watching one (no jump at the ends: the first frame of the change and the last are the rig's own)
    omar.change(0); const first = omar.rig.wp.map(v => v.clone()); omar.rig.load(omar.roll); omar.rig.fk();
    omar.rig.wp.forEach((v, i) => assert.ok(v.distanceTo(first[i]) < 1e-6, 'w 0 is the roll posture'));
    omar.change(1); const gap = ['hand_l', 'hand_r'].map(n => omar.rig.wp[omar.rig.index.get(n)].clone());
    omar.still(4.9, 3, 0); ['hand_l', 'hand_r'].forEach((n, i) => assert.ok(omar.rig.wp[omar.rig.index.get(n)].distanceTo(gap[i]) < .004, `the change ends where the watching begins (${n})`));
}

// ---- the watching, 4.9 s to the end of the chapter (17 s), every frame, several seeds
for (const seed of [0, 3, 7, 12, 99]) {
    let hand = 0, fore = 0, at = 0, floating = 0;
    for (let f = Math.round(4.9 * 30); f <= 17 * 30; f++) {
        const t = f / 30; omar.still(t, seed); const d = omar.depth({ step: 3 });
        if (d.hand > hand) { hand = d.hand; at = t; } fore = Math.max(fore, d.fore); floating = Math.max(floating, ...d.gap);
    }
    assert.ok(hand < TOL, `watching, seed ${seed}: the hands are ${mm(hand)} deep at ${at.toFixed(2)} s`);
    assert.ok(fore < TOL, `watching, seed ${seed}: the forearms are ${mm(fore)} deep`);
    assert.ok(floating < .05, `watching, seed ${seed}: the hands rest on the legs, they are not held up in the air (${mm(floating)} off the skin)`);
}

// ---- the same fault in the others (the posture as built puts the wrists in the thighs for them too)
for (const who of ['andre', 'ben', 'hale', 'jo', 'priya', 'maya']) {
    const fixed = await new Lap(who).load(), loose = await new Lap(who, { lap: false }).load();
    let before = 0, after = 0;
    for (let w = 0; w <= 1.0001; w += 1 / 30) { loose.change(Math.min(1, w)); before = Math.max(before, loose.depth().hand); fixed.change(Math.min(1, w)); after = Math.max(after, fixed.depth().hand, fixed.depth().fore); }
    for (let t = 5; t < 17; t += 1) { fixed.still(t, 5); after = Math.max(after, fixed.depth().hand, fixed.depth().fore); }
    assert.ok(after < TOL, `${who}: hands and forearms are ${mm(after)} deep with the fix (${mm(before)} without)`);
}

// ---- Kai (oilers) and Mia (commons) and the others whose arms never went into their laps: not moved at all
for (const who of ['kai', 'mia', 'ava', 'lin', 'sofia']) {
    const a = await new Lap(who).load(), b = await new Lap(who, { lap: false }).load(), P = L => ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r'].map(n => L.rig.wp[L.rig.index.get(n)].clone());
    let most = 0;
    for (let w = 0; w <= 1.0001; w += 1 / 60) { a.change(Math.min(1, w)); b.change(Math.min(1, w)); P(a).forEach((p, i) => { most = Math.max(most, p.distanceTo(P(b)[i])); }); }
    for (let t = 0; t < 17; t += .25) { a.still(t, 5); b.still(t, 5); P(a).forEach((p, i) => { most = Math.max(most, p.distanceTo(P(b)[i])); }); }
    assert.ok(most < 1e-6, `${who}: the pose is the pose (${mm(most)} moved)`);
}

// ---- the pieces
{
    // a hand already clear of the thigh is not touched
    const rig = omar.rig; omar.rig.load(omar.roll); rig.fk();
    assert.equal(lapClear(rig), 0, 'hands on the rims: nothing to move');
    // the turns of the pose keys are blended with the arms, not switched at the swap
    const only = armBones(rig); assert.ok(only.includes('hand_l') && only.includes('index_02_r') && !only.includes('head'), 'the arm bones: arms, hands and fingers');
    const half = blendPoses(null, FINE, .5, only);
    assert.ok(Math.abs(half.hand_l[3] - Math.sqrt((1 + FINE.hand_l[3]) / 2)) < 2e-3, 'half way is half the turn');
    assert.deepEqual(blendPoses(null, FINE, 1, only).hand_l, FINE.hand_l, 'the whole turn at the end');
    assert.ok(Object.values(blendPoses(null, FINE, 0, only)).every(q => Math.abs(q[3] - 1) < 1e-9), 'none at the start (the identity)');
    // every wheelchair user has a thigh table
    const chars = fs.readdirSync(path.join(ROOT, 'assets/props')).filter(f => /^people-.+-wheel-watch\.glb$/.test(f)).map(f => f.slice(7, -16));
    for (const c of chars) assert.ok(LAP.characters[c]?.l.length === 12 * 24 && LAP.characters[c].arm.l.length > 20 && LAP.characters[c].fore.l.length === 6 * 12, `${c} has measured thighs (tools/people/measure-lap.mjs)`);
}

// ---- where the film's frames pass: the model is told it is a wheelchair user's, the change blends the keys' turns, every draw goes through drawPose
{
    const people = fs.readFileSync(path.join(ROOT, 'room-people.mjs'), 'utf8'), motion = fs.readFileSync(path.join(ROOT, 'room-people-motion.mjs'), 'utf8');
    assert.match(people, /personRig = \{ bones, rest, lap: this\.library\.entry\?\.\(spec\.id\)\?\.person\?\.pose === 'wheel-watch' \}/, 'the drawn model of a wheel-watch person has lap set (a rolling one has not: his hands on the rims are left alone)');
    assert.match(people, /blendPoses\(poseNow\(a\.userData\.person\), poseNow\(b\.userData\.person\), armsNow, armBones\(pair\.rig\)\)/, 'a change eases the pose keys of the two placements in with the arms');
    assert.match(motion, /if \(!hold && lap\) pose = lapPose\(rig, pose\);/, 'drawPose keeps the hands out of the thighs');
    assert.match(people, /drawPose\(pair\.rig, shown\.userData\.personRig, 0, [^;]*, lap\);/, 'a change to or from a watcher is drawn with the lap fix, whichever of the two models is shown');
    assert.match(motion, /export const changeArms = /, 'the arms\' share of a change is one function');
}
console.log('people-omar-lap-test ok: Omar, rims to knees, 0 to 17 s: hands and forearms never deeper than', TOL * 1000, 'mm in thighs, knees or trunk (without the fix: up to 55 mm)');
