// Noah and the desk's onboard touchscreen (the high school film): the pull and the tap (room-people-motion.mjs
// SCREEN_ACTS through solveStill's input.act), timed by the film.
//   node tests/room-people-screen-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PersonRig, solveStill, actedKey } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/noah.json'), 'utf8')));
const ids = ['people-noah-stand-screen-pull', 'people-noah-stand-screen-tap', 'people-noah-stand-screen-press'];
for (const id of ids) assert.ok(rig.has(id), id + ' is in his rig file');
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8'));
for (const id of ids) assert.ok(index.props.some(p => p.id === id && p.person?.character === 'noah'), id + ' is in the library');
const tipOf = () => { const i3 = rig.wp[rig.index.get('index_03_r')], i2 = rig.wp[rig.index.get('index_02_r')]; return i3.clone().add(i3.clone().sub(i2).normalize().multiplyScalar(.024)); };
const hand = rig.side.r.arm[3];

// the tap: hovering before its moment, on the glass (the pressed posture) at it, back up after
{
    const hover = rig.key(ids[1]), press = rig.key(ids[2]);
    rig.load(press); rig.fk(); const pressed = tipOf(); rig.load(hover); rig.fk(); const over = tipOf();
    assert.ok(over.distanceTo(pressed) > .018 && over.distanceTo(pressed) < .03, 'built 25 mm apart (hover and pressed)');
    const tip = since => { solveStill(rig, hover, { time: 3, seed: 5, life: 1, act: { since, dur: 1, by: null, press } }); return tipOf(); };
    const at0 = tip(0);
    assert.ok(at0.distanceTo(pressed) < .012, `on the glass at the moment (${(at0.distanceTo(pressed) * 1000).toFixed(1)} mm from the pressed tip)`);
    assert.ok(tip(.2).distanceTo(pressed) < .012, 'held');
    assert.ok(tip(-.5).distanceTo(over) < .012 && tip(1).distanceTo(over) < .012, 'over it before and after');
    let last = tip(-.3); for (let s = -.3; s < .6; s += 1 / 60) { const t = tip(s); assert.ok(t.distanceTo(last) < .006, 'no jump'); last = t; }
}
// the pull: the hand goes with the screen, `by` over `dur`, and stays
{
    const key = rig.key(ids[0]), by = new THREE.Vector3(.559, 0, -.829).multiplyScalar(.12);      // (the slide, toward him and to his left: cast.py SCREEN_SLIDE)
    const wrist = since => { solveStill(rig, key, { time: 3, seed: 5, life: 1, act: { since, dur: 1.2, by, press: null } }); return rig.wp[hand].clone(); };
    const before = wrist(-1), after = wrist(2), mid = wrist(.6);
    assert.ok(after.clone().sub(before).distanceTo(by) < .012, 'drawn out by the screen\'s travel');
    assert.ok(Math.abs(mid.clone().sub(before).length() - by.length() / 2) < .015, 'half way at half the time');
    solveStill(rig, key, { time: 3, seed: 5, life: 1 }); assert.ok(rig.wp[hand].distanceTo(before) < .01, 'without an act: the posture as built (with its life)');
    // a change that follows the pull starts where the hand drew the screen to (actedKey), the built key untouched
    const acted = actedKey(rig, key, { since: Infinity, dur: 1.2, by, press: null }), built = key.wp[hand].clone();
    assert.ok(acted.wp[hand].clone().sub(built).distanceTo(by) < .012 && key.wp[hand].equals(built), 'the acted key has the hand at the end of the pull');
    assert.equal(actedKey(rig, rig.key(ids[1]), { since: Infinity, dur: 1, by: null, press: null }).wp[hand].distanceTo(rig.key(ids[1]).wp[hand]) < 1e-9, true, 'after a tap: as built');
}
console.log('PASS room people screen: Noah\'s pull and tap postures in his rig, the tap on the glass at its moment, the pull with the screen.');
