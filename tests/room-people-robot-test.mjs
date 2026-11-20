// The Storage cut's two-handed lift and the small adjustment on the workbench.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PersonRig, solveStill } from '../room-people-motion.mjs';

const rig = new PersonRig(JSON.parse(readFileSync(new URL('../assets/props/people-rigs/andre.json', import.meta.url))));
for (const pose of ['stand-robot-work', 'stand-robot-lift']) {
    const key = rig.key('people-andre-' + pose);
    const working = pose === 'stand-robot-work';
    const workingHand = rig.side.l.arm[3], index = rig.index.get('index_02_l');
    let previous = null, maxCurl = 0;
    for (let frame = 0; frame <= 240; frame++) {
        solveStill(rig, key, { time: frame / 60, seed: 19, life: 1 });
        for (const side of ['l', 'r']) {
            const foot = rig.side[side].leg[2], hand = rig.side[side].arm[3];
            assert.ok(rig.wp[foot].distanceTo(key.wp[foot]) < .002, 'foot remains planted during ' + pose);
            if (!working || side === 'r') {
                assert.ok(rig.wp[hand].distanceTo(key.wp[hand]) < .002, 'support hand stays on the robot');
                assert.ok(rig.wq[hand].angleTo(key.wq[hand]) < .005, 'grip keeps its orientation');
            }
        }
        if (previous) assert.ok(previous.distanceTo(rig.wp[workingHand]) < .003, 'wrist moves smoothly between frames');
        previous = rig.wp[workingHand].clone();
        maxCurl = Math.max(maxCurl, rig.lq[index].angleTo(key.q[index]));
    }
    if (working) assert.ok(maxCurl > .12, 'index finger closes for the adjustment');
    const sample = time => {
        solveStill(rig, key, { time, seed: 19, life: 1 });
        return rig.lq.flatMap(q => q.toArray());
    };
    const held = sample(.8);
    sample(2.7);
    assert.deepEqual(sample(.8), held, 'scrubbing back reproduces the same gesture');
}
console.log('PASS workshop robot grip, planted feet, finger travel and scrubbing');
