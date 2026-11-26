// The keyboard and mouse ON the desk / tray or UP on the desk's shelf, and the carry between (experience/tray-riders.mjs,
// docs/keyboard-tray/SPEC.md 0.3): decided by the desk tilt only (9 deg out, 7 deg back), eased over 0.4 s, on a path that clears the
// desktop, deterministic for any seek; chapter 1's real desk movement as the example. Pure node.   node tests/tray-riders-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../experience/tray-riders.mjs';
import { sampleClipMotion } from '../experience/desk-clips.mjs';
import { sampleTray, cleanTrayEdit, trayIssues } from '../experience/tray-pose.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b} (+-${eps})`);

{   // the thresholds are the desk's own: out above the stow angle, back a little lower (hysteresis)
    const stow = fs.readFileSync(path.join(root, 'desk-auto-stow.mjs'), 'utf8').match(/export const STOW_ANGLE = (\d+(?:\.\d+)?)/);
    assert.equal(R.LEAVE_DEG, Number(stow[1]), 'leave = desk-auto-stow STOW_ANGLE'); assert.ok(R.RETURN_DEG < R.LEAVE_DEG && R.RETURN_DEG >= 6, 'back a little lower');
    assert.ok(R.HANDOFF_S >= 0.3 && R.HANDOFF_S <= 0.5, 'quick but not a pop');
}
{   // decided by the desk tilt only: a flat desk never sends them anywhere, whatever happens; up past 9 and back under 7
    assert.deepEqual(R.riderTimeline(() => 0, 30).events, []); assert.equal(R.riderAway(R.riderTimeline(() => 0, 30), 12), 0);
    const ramp = s => s < 10 ? 0 : s < 20 ? (s - 10) * 3 : s < 30 ? 30 - (s - 20) * 3 : 0;      // 0 -> 30 deg over 10..20 s, back over 20..30 s
    const tl = R.riderTimeline(ramp, 40);
    assert.deepEqual(tl.events.map(e => e.to), ['shelf', 'tray']); near(tl.events[0].t, 13, 0.002, 'leaves when the tilt passes 9 (13 s)'); near(tl.events[1].t, 27 + 2 / 3, 0.002, 'back when it is under 7 (27.67 s), not at 9');
    assert.equal(R.riderAway(tl, 12.9), 0); assert.equal(R.riderAway(tl, 13 + R.HANDOFF_S + 0.001), 1); assert.equal(R.riderAway(tl, 27.5), 1, 'between 9 and 7 on the way down: still on the shelf');
    assert.equal(R.riderAway(tl, 28.2), 0); assert.equal(R.riderState(tl, 20).where, 'shelf'); assert.equal(R.riderState(tl, 13.2).where, 'to shelf'); assert.equal(R.riderState(tl, 27.8).where, 'to tray');
    // a desk that hovers about 9 deg does not send them back and forth: one hand-off up, none down until it is under 7
    const hover = s => s < 5 ? 0 : 8.5 + Math.sin(s * 3);     // 7.5 .. 9.5 deg
    assert.deepEqual(R.riderTimeline(hover, 30).events.map(e => e.to), ['shelf'], 'hysteresis');
    // starts tilted: on the shelf from 0 s
    const up = R.riderTimeline(() => 40, 10); assert.equal(up.start, 'shelf'); assert.equal(R.riderAway(up, 0), 1);
}
{   // the hand-off is eased (no pop): continuous, monotone, quick start, soft landing, 0.4 s long
    const tl = R.riderTimeline(s => s < 2 ? 0 : 20, 10), t0 = tl.events[0].t;
    let last = 0; const steps = [];
    for (let k = 0; k <= 40; k++) { const a = R.riderAway(tl, t0 + k * R.HANDOFF_S / 40); assert.ok(a >= last - 1e-12, 'monotone'); steps.push(a - last); last = a; }
    near(last, 1, 1e-9, 'arrives'); assert.ok(Math.max(...steps) < 0.08, 'no step bigger than 8 % of the way at 100 fps: a carry, not a pop');
    near(R.carryEase(0.5), 0.5, 1e-12, 'half way at half time'); assert.ok(R.carryEase(0.1) < 0.01 && R.carryEase(0.9) > 0.99, 'eases in and out');
    // two hand-offs closer than 0.4 s: the second starts from where the first was (no jump)
    const quick = R.riderTimeline(s => s < 2 ? 0 : s < 2.2 ? 20 : 0, 5); assert.equal(quick.events.length, 2);
    const at = quick.events[1].t, before = R.riderAway(quick, at - 1e-6), after = R.riderAway(quick, at + 1e-6); near(after, before, 1e-3, 'no jump at the second event');
    // determinism: out of order = in order
    const times = Array.from({ length: 500 }, (_, i) => (i * 7919) % 1000 / 100); assert.deepEqual(times.map(t => R.riderAway(tl, t)), [...times].reverse().map(t => R.riderAway(tl, t)).reverse());
}
{   // chapter 1 (the 3rd cut's awaken, frozen in tests/fixtures/tray-awaken-motion-20261125.json: Vico re-times the live cut): the desk tilts up over 18.65..24.6 s (they go at about 20.4 s) and level over 31.55..35.7 s (back at about 34.9 s)
    const d = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/tray-awaken-motion-20261125.json'), 'utf8')), motion = { clips: d.clips, initial: d.initial };
    const tl = R.riderTimeline(s => sampleClipMotion(motion, s).tilt, d.seconds);
    assert.deepEqual(tl.events.map(e => e.to), ['shelf', 'tray']); assert.ok(tl.events[0].t > 20 && tl.events[0].t < 21, 'up at ' + tl.events[0].t); assert.ok(tl.events[1].t > 34 && tl.events[1].t < 36, 'back at ' + tl.events[1].t);
    // Vico's tray keys there (tilt -10 at 20.8 s, then slide it in): the tray is free while they are up, no warning, and held again once they are back
    const edit = cleanTrayEdit({ keys: [{ t: 20.8, pose: { tilt: -10 } }, { t: 26, pose: { slide: 1, tilt: 0 } }, { t: 30, pose: { slide: 0 } }] }), awayAt = s => R.riderAway(tl, s);
    near(sampleTray(edit, 26, { riderMm: 45, riderAwayAt: awayAt }).slide, 1, 1e-9, 'slid all the way in with the keyboard on the shelf');
    assert.deepEqual(trayIssues(edit, { riderMm: 45, riderAwayAt: awayAt }), [], 'and no clash warning');
    near(sampleTray(edit, 26, { riderMm: 45 }).slide, 0.75, 1e-9, '(the same key with the keyboard on the tray, the arm level, is held)');
}
{   // the carry path: leaves straight up, ends level into the shelf from the user's side, clears the desktop, never less than a small lift
    const from = [0, -25, 420], to = [-90, 700, -300], desk = { width: 1219, depth: 762 }, p = R.carryPath(from, to, { desk, half: 22 });
    assert.deepEqual(p.at(0), from); for (let i = 0; i < 3; i++) near(p.at(1)[i], to[i], 1e-9, 'arrives');
    assert.ok(p.lift >= R.MIN_LIFT_MM);
    const a = p.at(0.02), b = p.at(0.98); assert.ok(a[1] - from[1] > 5 * Math.hypot(a[0] - from[0], a[2] - from[2]), 'leaves upward'); assert.ok(b[2] - to[2] > 4 * Math.abs(b[1] - to[1]), 'arrives level, from the front');
    for (let u = 0; u <= 1.0001; u += 0.01) { const q = p.at(u); if (Math.abs(q[0]) < desk.width / 2 && q[2] < desk.depth / 2 - 10 && u > 0.05 && u < 0.95) assert.ok(q[1] - 22 >= R.CLEAR_MM - 1e-6, 'clear of the desktop at u=' + u.toFixed(2) + ' y=' + q[1].toFixed(1)); }
    // a tilted desktop (world up leaning in the desk's frame): still clear, and a bigger lift when the shelf is lower
    const tilted = R.carryPath(from, [-90, 120, -300], { up: [0, Math.cos(0.2), Math.sin(0.2)], desk, half: 22 }); assert.ok(tilted.lift >= R.MIN_LIFT_MM);
    for (let u = 0.05; u <= 0.95; u += 0.01) { const q = tilted.at(u); if (Math.abs(q[0]) < desk.width / 2 && q[2] < desk.depth / 2 - 10) assert.ok(q[1] - 22 >= R.CLEAR_MM - 1e-6, 'tilted: clear at ' + u.toFixed(2)); }
}
console.log('tray-riders-test: ok (decided by the desk tilt only, 9 deg out / 7 deg back, eased 0.4 s hand-off without a pop, deterministic, chapter 1 frees the tray, the carry clears the desktop)');
