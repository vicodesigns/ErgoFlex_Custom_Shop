// typeStyle at the MOVING desk (room-people-motion.mjs DeskActor / solveDesk, opt-in): a desk user whose drawn member's
// cast entry says typeStyle 'busy' (or 'natural') types as a station typist does; everyone else has the stock taps,
// bit for bit; the other member of the same person keeps theirs; hands off the keys, typing 0 and taps off stay still.
//   node tests/people-desk-typing-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersonRig, DeskActor } from '../room-people-motion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/maya.json'), 'utf8')));
const SIT = 'people-maya-sit-type', STAND = 'people-maya-stand-type-41';
const actor = (styles = {}) => {
    const a = new DeskActor(rig), member = (id, role) => ({ id, role, behind: 0, scale: 1000, object: { userData: { person: styles[role] ? { id, typeStyle: styles[role] } : { id } } } });
    a.configure([member(SIT, 'sit'), member(STAND, 'stand')]); return a;
};
const fingers = [...rig.side.l.fingers, ...rig.side.r.fingers], hands = [rig.side.l.arm[3], rig.side.r.arm[3]];
const frame = (a, input) => {
    a.drive({ taps: true, ...input }); rig.fk();
    return { q: rig.lq.flatMap(q => q.toArray()), f: fingers.flatMap(i => rig.lq[i].toArray()), w: hands.map(i => rig.wp[i].toArray()), shown: a.shown?.id, on: a.state.k * a.state.k * (3 - 2 * a.state.k) };      // (on: how far the hands are on the keys, solveDesk's ke)
};
const run = (styles, input = {}, seconds = 20) => { const a = actor(styles), rows = []; for (let n = 0; n <= seconds * 30; n++) rows.push(frame(a, { height: 41, time: n / 30, ...input })); return rows; };
// seconds the fingers are still, the longest stretch, and the share of frames they move
const stillness = rows => { let longest = 0, now = 0, moving = 0; for (let i = 1; i < rows.length; i++) { const d = Math.max(...rows[i].f.map((v, j) => Math.abs(v - rows[i - 1].f[j]))); if (d > 2e-3) { moving++; now = 0; } else longest = Math.max(longest, ++now / 30); } return { longest, share: moving / (rows.length - 1) }; };

const stock = run({});
assert.ok(stock.every(r => r.shown === STAND), 'at 41 in the standing model is drawn');
assert.ok(stillness(stock).longest > 1.5, `the stock taps pause to read (longest still ${stillness(stock).longest.toFixed(2)} s)`);

// opt-in: only the drawn member's own style counts, and only the two styles there are
assert.deepEqual(run({ sit: 'busy' }), stock, "the sitting model's style does not touch the standing one");
assert.deepEqual(run({ stand: 'brisk' }), stock, 'an unknown style: the stock taps');

const busy = run({ stand: 'busy' }), b = stillness(busy);
assert.ok(b.longest <= 1.1, `busy: no rest over 1.1 s (longest ${b.longest.toFixed(2)} s)`);
assert.ok(b.share > .65 && b.share > stillness(stock).share + .15, `busy: the fingers move most of the time (${(b.share * 100).toFixed(0)} %, stock ${(stillness(stock).share * 100).toFixed(0)} %)`);
for (const s of [0, 1]) {
    let step = 0, far = 0;
    for (let i = 0; i < busy.length; i++) {
        far = Math.max(far, Math.hypot(...busy[i].w[s].map((v, k) => v - stock[i].w[s][k])) * 1000);
        if (i) step = Math.max(step, Math.hypot(...busy[i].w[s].map((v, k) => v - busy[i - 1].w[s][k])) * 1000);
    }
    assert.ok(far < 25, `busy: the wrist stays over the keys (at most ${far.toFixed(1)} mm from the stock one)`);
    assert.ok(step < 7, `busy: no jerk (largest step in one frame ${step.toFixed(2)} mm)`);
}
assert.deepEqual(run({ stand: 'busy' }, {}, 5), busy.slice(0, 151), 'busy: the same frame every time');
assert.ok(stillness(run({ stand: 'natural' })).longest > 1.1, 'natural: the same keys with its pauses');
for (const [what, input] of [['typing 0', { typing: 0 }], ['taps off', { taps: false }]]) assert.ok(stillness(run({ stand: 'busy' }, input, 5)).share === 0, `busy, ${what}: the fingers are still`);

// through the desk's moves (sit, stand, sit): wherever the hands are not on the keys, and while the sitting model is drawn,
// every bone is as without the style; the fingers change in no frame by more than a keystroke does (no snap in or out)
const heightAt = t => t < 3 ? 28 : t < 8 ? 28 + 13 * (t - 3) / 5 : t < 14 ? 41 : t < 19 ? 41 - 13 * (t - 14) / 5 : 28;
const track = { seconds: 24, heightAt, tiltAt: null };
const moved = styles => { const a = actor(styles), rows = []; for (let n = 0; n <= 24 * 60; n++) rows.push(frame(a, { height: heightAt(n / 60), time: n / 60, track })); return rows; };
const was = moved({}), is = moved({ stand: 'busy' });
let off = 0, on = 0;
is.forEach((r, i) => { if (r.shown === SIT || r.on < .82) { off++; assert.deepEqual(r.q, was[i].q, `frame ${i} (${r.shown}, on the keys ${r.on.toFixed(2)}): as without the style`); } else if (r.f.some((v, j) => v !== was[i].f[j])) on++; });
assert.ok(off > 300 && on > 200, `both cases are in the run (${off} frames as stock, ${on} typing busy)`);
const jump = rows => Math.max(...rows.slice(1).map((r, i) => Math.max(...r.f.map((v, j) => Math.abs(v - rows[i].f[j])))));
assert.ok(jump(is) <= Math.max(.04, jump(was) * 1.25), `no finger snaps (largest change in one frame ${jump(is).toFixed(4)}, stock ${jump(was).toFixed(4)})`);
console.log(`people-desk-typing-test ok: stock longest still ${stillness(stock).longest.toFixed(2)} s (${(stillness(stock).share * 100).toFixed(0)} % moving), busy ${b.longest.toFixed(2)} s (${(b.share * 100).toFixed(0)} %)`);
