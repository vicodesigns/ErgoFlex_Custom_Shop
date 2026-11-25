// stand-low is a typing posture (fingers move at a station desk), and typeStyle 'natural' (room-people-motion.mjs): bursts and
// pauses at uneven gaps, wrists and forearms moving millimetres with the keys, deterministic, off with typing 0.
//   node tests/people-natural-typing-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersonRig, solveStill } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/fern.json'), 'utf8')));
const key = rig.key('people-fern-stand-low');
const L = rig.side.l.arm[3], fingers = [...rig.side.l.fingers, ...rig.side.r.fingers];
const run = (input, seconds = 30) => {
    const rows = [];
    for (let f = 0; f <= seconds * 30; f++) {
        solveStill(rig, key, { time: f / 30, seed: 777, life: 1, taps: true, ...input }); rig.fk();
        rows.push({ wrist: rig.wp[L].toArray().map(x => x * 1000), flex: Math.max(...fingers.map(i => rig.lq[i].angleTo(key.q[i]))) });
    }
    return rows;
};
const range = (rows, k) => Math.max(...rows.map(r => r.wrist[k])) - Math.min(...rows.map(r => r.wrist[k]));

// the posture the station desk draws at 35.5 in: its fingers type (before: no taps, no pinned hands, no feet planted)
const plain = run({});
assert.ok(plain.some(r => r.flex > .12), 'stand-low: the fingers type');
assert.ok(range(plain, 0) < .01 && range(plain, 1) < .01 && range(plain, 2) < .01, 'stand-low: the hands stay on the keys (RESTING)');

// natural
const nat = run({ style: 'natural' });
for (const k of [0, 2]) assert.ok(range(nat, k) > 5 && range(nat, k) < 25, `natural: the wrist moves a little along axis ${k} (${range(nat, k).toFixed(1)} mm)`);
assert.ok(range(nat, 1) > 2 && range(nat, 1) < 8, 'natural: the wrist dips with the keys, a few millimetres');
let step = 0; for (let i = 1; i < nat.length; i++) step = Math.max(step, Math.hypot(...nat[i].wrist.map((x, k) => x - nat[i - 1].wrist[k])));
assert.ok(step < 5.5, `natural: no jerk (largest step in one frame ${step.toFixed(2)} mm)`);
// bursts and pauses: runs of finger movement of a second or more, and rests of a second or more between them
const active = nat.map(r => r.flex > .035); let runs = [], at = null;
active.forEach((a, i) => { if (a) { if (!at) at = { s: i, e: i }; at.e = i; } else if (at && i - at.e > 15) { runs.push(at); at = null; } }); if (at) runs.push(at);
assert.ok(runs.length >= 3 && runs.some(r => r.e - r.s > 30), 'natural: several bursts, some of a second or more');
const gaps = runs.slice(1).map((r, i) => (r.s - runs[i].e) / 30); assert.ok(gaps.every(g => g > .5) && Math.max(...gaps) > 1.5, 'natural: pauses between the bursts');
assert.deepEqual(run({ style: 'natural' }, 5).map(r => r.wrist), nat.slice(0, 151).map(r => r.wrist), 'natural: the same frame every time');
const off = run({ style: 'natural', typing: 0 }, 10); assert.ok(range(off, 0) < .01 && off.every(r => r.flex < 1e-6), 'typing 0: still, with the style');
console.log('people-natural-typing-test ok');
