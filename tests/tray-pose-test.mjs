// Keyboard tray pose model (experience/tray-pose.mjs, tray-limits.mjs): joints and hard limits, the coupling between joints,
// key cleaning, the sampler (ease, inheritance, initial, hold), the route planner, editing, and "no keys = today's rigid tray"
// (docs/keyboard-tray/SPEC.md 0.1, 4, 6, 8).   node tests/tray-pose-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as L from '../experience/tray-limits.mjs';
import * as T from '../experience/tray-pose.mjs';
import { cleanShot } from '../experience/cuts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const posesNear = (p, q, eps = 1e-6) => { for (const j of T.JOINTS) near(p[j], q[j] ?? 0, eps); };   // (a joint the expectation leaves out is 0)
const REST = { slide: 0, swing: 0, baseTilt: 0, tilt: 0 };
const ERGO = 45, MOUSE = 56.9;

{   // the joint table: Vico's ranges, rest = 0 = the glb as authored (no drop joint since 25 Nov 2026: "not even a real thing on the product")
    assert.deepEqual(T.TRAY_JOINTS.map(j => j.id), ['slide', 'swing', 'baseTilt', 'tilt']);
    assert.deepEqual(T.TRAY_JOINTS.map(j => j.label), ['Slide', 'Swing', 'Base tilt', 'Surface tilt']);
    assert.deepEqual(L.JOINT_LIMITS, { slide: [0, 1], swing: [-180, 180], baseTilt: [-25, 10], tilt: [-30, 30] });
    for (const gone of ['DROP_ENABLED', 'BRACKET', 'DROP_CAD_LINKS_MM']) assert.ok(!(gone in L), gone + ' is gone');
    for (const gone of ['dropNeededMm', 'setBracket', 'trayBracket']) assert.ok(!(gone in T), gone + ' is gone');
    assert.equal(L.SLIDE_TRAVEL_MM, 234.5, 'the CAD travel along the track (the rig test measures it)');
    assert.ok(T.TRAY_JOINTS.every(j => j.rest === 0 && j.min <= 0 && j.max > 0 && j.min === L.JOINT_LIMITS[j.id][0]));
    assert.deepEqual(T.restPose(), REST); assert.ok(T.isRestPose(REST) && !T.isRestPose({ ...REST, tilt: 0.01 }));
}
{   // tray-limits.mjs sanity: every table value inside the joints' hard limits; coupling only ever narrows as the slide goes in
    const [tlo, thi] = L.JOINT_LIMITS.tilt, [, sMax] = L.JOINT_LIMITS.swing;
    for (const r of L.SLIDE_COUPLING) { assert.ok(r.slide >= 0 && r.slide <= 1 && r.swing >= 0 && r.swing <= sMax && r.tilt[0] >= tlo && r.tilt[1] <= thi && r.tilt[0] <= r.tilt[1]); }
    for (const r of L.SWING_TILT) { assert.ok(r.swing >= 0 && r.swing <= sMax && r.tilt[0] >= tlo && r.tilt[1] <= thi && r.tilt[0] <= r.tilt[1]); }
    for (const rows of [L.SLIDE_COUPLING, L.SWING_TILT]) for (let i = 1; i < rows.length; i++) {
        const k = 'slide' in rows[0] ? 'slide' : 'swing'; assert.ok(rows[i][k] > rows[i - 1][k], 'rows ascending');
        assert.ok(rows[i].tilt[0] >= rows[i - 1].tilt[0] && rows[i].tilt[1] <= rows[i - 1].tilt[1], 'tilt range only narrows');
        if (rows[i].swing !== undefined && k === 'slide') assert.ok(rows[i].swing <= rows[i - 1].swing, 'swing room only shrinks');
    }
    assert.equal(L.SLIDE_COUPLING[0].slide, 0); assert.deepEqual(L.SLIDE_COUPLING[0].tilt, [-15, 15], 'fully out: the platform within +-15 deg of level (its own angle, base + surface)'); assert.equal(L.SLIDE_COUPLING[0].swing, sMax, 'fully out: the full range');
    for (const r of Object.values(L.UNDER_RAMPS)) assert.ok(r[0] < r[1]);
    for (const [id, mm] of Object.entries(L.RIDER_MM)) assert.ok(mm > 0 && mm < 100, id);
}
{   // cleanTrayPose: hard limits, units, junk
    assert.deepEqual(T.cleanTrayPose(null), REST); assert.deepEqual(T.cleanTrayPose('x'), REST); assert.deepEqual(T.cleanTrayPose([1, 2]), REST);
    assert.deepEqual(T.cleanTrayPose({ slide: 2, swing: 400, tilt: -90, drop: 999 }), { slide: 1, swing: 180, baseTilt: 0, tilt: -30 }, 'an old drop is ignored');
    assert.deepEqual(T.cleanTrayPose({ slide: -1, swing: -400, tilt: 90, drop: -5, baseTilt: -99 }), { slide: 0, swing: -180, baseTilt: -25, tilt: 30 });
    assert.deepEqual(T.cleanTrayPose({ tilt: 7.123456, slide: 0.123456, drop: 12.345 }), { slide: 0.1235, swing: 0, baseTilt: 0, tilt: 7.12 });
    assert.equal(T.cleanTrayPose({ drop: 30 }, { partial: true }), null, 'a pose that names only the old drop says nothing');
    assert.deepEqual(T.cleanTrayPose({ tilt: NaN, swing: Infinity, slide: '1' }), REST, 'junk values are the rest value');
    assert.equal(T.cleanTrayPose({}, { partial: true }), null); assert.equal(T.cleanTrayPose({ tilt: 'x' }, { partial: true }), null);
    assert.deepEqual(T.cleanTrayPose({ tilt: 5, bogus: 1 }, { partial: true }), { tilt: 5 }, 'partial: only the joints named');
    assert.ok(!Object.is(T.cleanTrayPose({ tilt: -0.0001 }).tilt, -0), 'no minus zero in the file');
}
{   // the coupling: limits per joint given the others, held in the order slide, swing, tilt
    posesNear(T.clampTrayPose(REST), REST); posesNear(T.clampTrayPose(REST, { riderMm: ERGO }), REST);
    assert.deepEqual(T.limitsFor(REST), { slide: [0, 1], swing: [-180, 180], baseTilt: [-25, 10], tilt: [-15, 15] }, 'fully out: nothing is narrowed (the platform within +-15 deg of level)');
    const pushed = T.limitsFor({ slide: 1 });
    assert.deepEqual(pushed.swing, [0, 0]); assert.deepEqual(pushed.tilt, [-2, 0], 'pushed in: level, no swing');
    posesNear(T.clampTrayPose({ slide: 1, swing: 90, tilt: 10 }), { slide: 1, swing: 0, tilt: 0 });
    posesNear(T.clampTrayPose({ slide: 0.4, swing: 170, tilt: 15 }), { slide: 0.4, swing: 170, tilt: 0 }, 1e-6);   // 170 swung: plate is under the desk, no tilt up
    const half = T.limitsFor({ slide: 0.625 });         // halfway down the 0.4 -> 0.85 ramp
    near(half.swing[1], 90); near(half.tilt[1], 7.5); near(half.tilt[0], -8.5);
    // symmetric swing at every slide, monotone in the slide, every limit inside the hard limits, lo <= hi
    let prev = null;
    for (let s = 0; s <= 1.0001; s += 0.05) {
        const l = T.limitsFor({ slide: s }); near(l.swing[0], -l.swing[1]); assert.ok(l.tilt[0] <= l.tilt[1]);
        assert.ok(l.swing[1] <= L.JOINT_LIMITS.swing[1] && l.tilt[0] >= L.JOINT_LIMITS.tilt[0] && l.tilt[1] <= L.JOINT_LIMITS.tilt[1]);
        if (prev) { assert.ok(l.swing[1] <= prev.swing[1] + 1e-9 && l.tilt[0] >= prev.tilt[0] - 1e-9 && l.tilt[1] <= prev.tilt[1] + 1e-9, 'monotone in the slide'); }
        prev = l;
    }
    for (const sw of [0, 10, 20, 40, 60, 120, 180]) { assert.deepEqual(T.limitsFor({ swing: sw }).tilt, T.limitsFor({ swing: -sw }).tilt, 'tilt coupling is symmetric in the swing'); }
    assert.deepEqual(T.limitsFor({ swing: 20 }).tilt, [-15, 15]); assert.deepEqual(T.limitsFor({ swing: 60 }).tilt, [-2, 0]);
    assert.deepEqual(T.clampedJoints({ slide: 1, swing: 90, tilt: 10 }), ['swing', 'tilt']); assert.deepEqual(T.clampedJoints(REST), []);
    // hard limits still apply when an edit is sampled raw: a pose past them is clamped, never thrown
    posesNear(T.clampTrayPose({ slide: 9, swing: 999, tilt: 99, drop: 999 }), { slide: 1, swing: 0, tilt: 0 }); assert.ok(!('drop' in T.clampTrayPose({ drop: 20 })));
    assert.deepEqual(T.clampedJoints({ drop: 20 }), [], 'an old keyed drop is not a joint: nothing to warn about');
}
{   // a keyboard or mouse ON the plate keeps it out from under the desk (spec 0.2); OFF it (on the desk's shelf, the desk tilted, 0.3) the tray is free
    assert.equal(T.riderThicknessMm([]), 0); near(T.riderThicknessMm(['apple-keyboard', 'magic-mouse']), 30.3); near(T.riderThicknessMm(['ergoflex-ergo-keyboard', 'gaming-mouse']), 56.9); assert.equal(T.riderThicknessMm(['mystery']), L.RIDER_UNKNOWN_MM);
    assert.equal(T.underDesk(REST), 0); assert.equal(T.underDesk({ slide: 1 }), 1); assert.equal(T.underDesk({ swing: -90 }), 1); near(T.underDesk({ slide: 0.6 }), 0.5);
    assert.ok(T.riderFitsUnder(0) && T.riderFitsUnder(10) && !T.riderFitsUnder(ERGO) && !T.riderFitsUnder(22.2) && !T.riderFitsUnder(MOUSE));
    // no rider (or a thin one): the whole range
    for (const riderMm of [0, 10]) { assert.deepEqual(T.limitsFor(REST, { riderMm }).slide, [0, 1]); assert.deepEqual(T.limitsFor(REST, { riderMm }).swing, [-180, 180]); }
    // a keyboard or mouse on the plate: slide <= 0.45 (106 mm of 234.5), |swing| <= 20 degrees; tilt as the coupling says there (full range)
    const kb = T.limitsFor(REST, { riderMm: ERGO }); assert.deepEqual(kb.slide, [0, 0.45]); assert.deepEqual(kb.swing, [-20, 20]); assert.deepEqual(kb.tilt, [-15, 15]);
    posesNear(T.clampTrayPose({ slide: 1, swing: 90, tilt: 10 }, { riderMm: ERGO }), { slide: 0.45, swing: 20, tilt: 10 });
    posesNear(T.clampTrayPose({ slide: 0.3, swing: -15 }, { riderMm: MOUSE }), { slide: 0.3, swing: -15, tilt: 0 }, 1e-9);
    assert.deepEqual(T.clampedJoints({ slide: 1, swing: 90 }, { riderMm: ERGO }), ['slide', 'swing']);
    // the riders on the desk's shelf (riderAway 1): the full range and nothing named, whatever they weigh
    for (const riderMm of [ERGO, MOUSE, 1000]) { assert.deepEqual(T.limitsFor({ slide: 1 }, { riderMm, riderAway: 1 }), T.limitsFor({ slide: 1 })); assert.deepEqual(T.clampedJoints({ slide: 1, swing: 0 }, { riderMm, riderAway: 1 }), []); }
    posesNear(T.clampTrayPose({ slide: 1, tilt: -1 }, { riderMm: ERGO, riderAway: 1 }), { slide: 1, swing: 0, tilt: -1 });
    // while they are carried off (0 < away < 1) the limit opens in step: no jump when it lets go
    let prev = -1; for (let a = 0; a <= 1.0001; a += 0.05) { const hi = T.limitsFor(REST, { riderMm: ERGO, riderAway: a }).slide[1]; assert.ok(hi >= prev - 1e-12 && hi >= 0.45 - 1e-12 && hi <= 1, 'opens monotonically'); prev = hi; }
    near(T.limitsFor(REST, { riderMm: ERGO, riderAway: 0.5 }).slide[1], 0.725); near(T.limitsFor(REST, { riderMm: ERGO, riderAway: 0.5 }).swing[1], 100);
    // the options along the chapter: riderAwayAt(seconds), resolved at the time sampled
    const awayAt = s => s < 5 ? 0 : 1, pushed = T.cleanTrayEdit({ keys: [{ t: 1, pose: { slide: 1 } }] });
    near(T.sampleTray(pushed, 3, { riderMm: ERGO, riderAwayAt: awayAt }).slide, 0.45); near(T.sampleTray(pushed, 6, { riderMm: ERGO, riderAwayAt: awayAt }).slide, 1);
    assert.deepEqual(T.ridersAt({ riderMm: 1, riderAwayAt: awayAt }, 6).riderAway, 1); assert.deepEqual(T.ridersAt({ riderMm: 1 }, 6), { riderMm: 1 });
    // the warnings follow: the key at 1 s (riders on) is named; the same key at 6 s (riders on the shelf) is not
    assert.ok(T.trayIssues(pushed, { riderMm: ERGO, riderAwayAt: awayAt }).some(i => i.kind === 'key'));
    assert.deepEqual(T.trayIssues(T.cleanTrayEdit({ keys: [{ t: 6, pose: { slide: 1 } }, { t: 8, pose: { slide: 0.2, swing: 90 } }] }), { riderMm: ERGO, riderAwayAt: awayAt }).filter(i => i.t >= 5), [], 'riders on the shelf: no clash warning');
}
{   // keys: sorted, close ones merged, ids unique, defaults omitted, idempotent, capped
    const keys = T.cleanTrayKeys([{ t: 3, pose: { tilt: 5 }, ease: 'linear', label: ' Out ' }, { t: 1, pose: { slide: 0.5, junk: 1 }, id: 'a' }, { t: -1, pose: { tilt: 1 } }, { t: 2, pose: {} }, { t: 3.005, pose: { swing: 20 }, ease: 'smooth', route: 'direct' }, 'x', { t: 'no', pose: { tilt: 1 } }, { t: 2000, pose: { tilt: 1 }, id: 'a' }]);
    assert.deepEqual(keys.map(k => k.t), [1, 3, 2000]); assert.deepEqual(keys[0], { id: 'a', t: 1, pose: { slide: 0.5 } });
    assert.deepEqual(keys[1].pose, { tilt: 5, swing: 20 }, 'keys within a sixtieth are one key'); assert.equal(keys[1].ease, undefined, 'the later key (smooth = default) wins'); assert.equal(keys[1].route, 'direct'); assert.equal(keys[1].label, 'Out');
    assert.equal(new Set(keys.map(k => k.id)).size, 3, 'a repeated id is made new'); assert.ok(keys.every(k => /^[A-Za-z0-9_-]+$/.test(k.id)));
    assert.deepEqual(T.cleanTrayKeys(keys), keys, 'cleaning twice changes nothing');
    assert.deepEqual(T.cleanTrayKeys('x'), []); assert.deepEqual(T.cleanTrayKeys([]), []); assert.deepEqual(T.cleanTrayKeys(null), []);
    assert.equal(T.cleanTrayKeys(Array.from({ length: 100 }, (_, i) => ({ t: i, pose: { tilt: 1 } }))).length, T.MAX_KEYS);
    assert.equal(T.cleanTrayKeys([{ t: 1, pose: { tilt: 1 }, ease: 'bounce', route: 'zigzag' }])[0].ease, undefined);
    assert.deepEqual(Object.keys(T.cleanTrayKeys([{ t: 1, pose: { tilt: 1 }, ease: 'hold', label: 'x' }])[0]), ['id', 't', 'pose', 'ease', 'label']);
}
{   // edits and the shot field: absent = nothing (so an untouched chapter's cut is byte-identical)
    assert.deepEqual(T.cleanTrayEdits({}), {}); assert.deepEqual(T.cleanTrayEdits(), {}); assert.deepEqual(T.cleanTrayEdits({ trayEdits: 'x' }), {}); assert.deepEqual(T.cleanTrayEdits({ trayEdits: null }), {});
    assert.deepEqual(T.cleanTrayEdits({ trayEdits: [] }), { trayEdits: [] }, 'a present empty list stays (it replaces the film\'s own, as deskEdits does)');
    assert.deepEqual(T.cleanTrayEdits({ trayEdits: [{}, { desk: 'BAD ID', keys: [] }, { initial: { tilt: 0 } }, null] }), { trayEdits: [] }, 'an edit that says nothing is dropped');
    const e = T.cleanTrayEdits({ trayEdits: [{ desk: 'gaming', initial: { tilt: 0, swing: 30 }, keys: [{ t: 1, pose: { tilt: 5 } }] }, { keys: [{ t: 2, pose: { slide: 1 } }] }, { desk: 'gaming', keys: [{ t: 9, pose: { tilt: -5 } }] }] }).trayEdits;
    assert.equal(e.length, 2, 'one edit per desk, the later wins'); assert.deepEqual(e.find(x => x.desk === 'gaming').keys.map(k => k.t), [9]);
    assert.deepEqual(T.cleanTrayEdit({ initial: { tilt: 0, swing: 30 }, keys: [{ t: 1, pose: { slide: 0 } }] }).initial, { swing: 30 }, 'a rest joint in `initial` means nothing');
    assert.equal(T.cleanTrayEdit({ initial: { tilt: 0 } }), null);
    assert.deepEqual(T.cleanTrayEdits({ trayEdits: e }), { trayEdits: e }, 'cleaning twice changes nothing');
    assert.equal(T.cleanTrayEdits({ trayEdits: Array.from({ length: 60 }, (_, i) => ({ desk: 'd' + i, keys: [{ t: 1, pose: { tilt: 1 } }] })) }).trayEdits.length, T.MAX_EDITS);
    assert.equal(T.pickTrayEdit(e, 'gaming').desk, 'gaming'); assert.equal(T.pickTrayEdit(e, 'office').desk, undefined); assert.equal(T.pickTrayEdit(e.filter(x => x.desk), 'office'), null); assert.equal(T.pickTrayEdit([], 'x'), null); assert.equal(T.pickTrayEdit(null, 'x'), null);
    assert.ok(!T.trayActive(null) && !T.trayActive({}) && !T.trayActive({ keys: [] }) && T.trayActive({ keys: [{ t: 1, pose: { tilt: 0 } }] }) && T.trayActive({ initial: { tilt: 2 } }));
}
{   // NO KEYS = NO CHANGE: the rigid tray, whatever the time or the rider
    for (const edit of [undefined, null, {}, { keys: [] }, { desk: 'gaming' }, { initial: { tilt: 0 } }]) for (const t of [undefined, NaN, -5, 0, 3, 1e6]) for (const riderMm of [0, ERGO]) assert.deepEqual(T.sampleTray(edit, t, { riderMm }), REST);
    // keys that all name the rest pose: the rest pose at every time, with or without a rider (the authored pose is never lowered)
    const still = T.cleanTrayEdit({ keys: [{ t: 1, pose: REST }, { t: 5, pose: { tilt: 0 } }] });
    for (let t = 0; t <= 8; t += 0.25) for (const riderMm of [0, ERGO, MOUSE]) assert.deepEqual(T.sampleTray(still, t, { riderMm }), REST);
    assert.deepEqual(T.trayIssues(still, { riderMm: ERGO }), []); assert.deepEqual(T.trayIssues(null), []);
    // the cut: a shot without trayEdits keeps no trayEdits key; every tracked fixture shot cleans the same as ever
    const files = execSync('git ls-files exports', { cwd: root }).toString().split('\n').filter(f => /(cut|review-cut)\.json$/.test(f));
    let shots = 0;
    const norm = s => JSON.stringify(s, (k, v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) ? 'U' : v);   // (cleaning mints random ids)
    for (const f of files) {
        let j; try { j = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { continue; }
        for (const shot of j.shots || []) { const out = cleanShot(shot); if (!('trayEdits' in shot)) { assert.ok(!('trayEdits' in out), f); assert.deepEqual(T.cleanTrayEdits(shot), {}, f); } assert.equal(norm(cleanShot(out)), norm(out), f + ' cleans to itself'); shots++; }   // (a live cut Vico has keyed the tray in keeps them: only shots without trayEdits must gain none)
    }
    assert.ok(shots > 50, 'fixture shots were checked: ' + shots);
    const withKeys = cleanShot({ room: 'product', seconds: 12, trayEdits: [{ keys: [{ t: 2, pose: { tilt: -10 } }] }] });
    assert.deepEqual(withKeys.trayEdits[0].keys.map(k => [k.t, k.pose]), [[2, { tilt: -10 }]], 'cleanShot keeps and cleans tray keys');
    assert.ok(!('trayEdits' in cleanShot({ room: 'product', seconds: 12 })), 'and nothing when there are none');
    assert.deepEqual(cleanShot({ room: 'product', seconds: 12, trayEdits: [] }).trayEdits, [], 'a present empty list is kept');
}
{   // the sampler: initial, implicit key at 0 s, eases, inheritance, hold
    const edit = T.cleanTrayEdit({ initial: { tilt: 10 }, keys: [{ t: 2, pose: { tilt: 0, swing: 40 }, ease: 'linear' }, { t: 4, pose: { swing: 0 } }, { t: 6, pose: { tilt: -10 }, ease: 'hold' }, { t: 8, pose: { tilt: 5 } }] });
    posesNear(T.sampleTray(edit, 0), { ...REST, tilt: 10 }); posesNear(T.sampleTray(edit, undefined), { ...REST, tilt: 10 }, 1e-9);
    posesNear(T.sampleTray(edit, 1), { ...REST, tilt: 5, swing: 20 }, 1e-9); const s = T.sampleTray(edit, 1); assert.ok(s.tilt < 10 && s.tilt > 0);   // 0 -> 2 s eases (smooth, the implicit key at 0 s): a smoothstep half = 5
    posesNear(T.sampleTray(edit, 2), { ...REST, tilt: 0, swing: 40 });
    posesNear(T.sampleTray(edit, 3), { ...REST, swing: 20, tilt: 0 }, 1e-9);        // linear leaving the 2 s key: halfway, tilt inherited
    near(T.sampleTray(edit, 2.5).swing, 30); near(T.sampleTray(edit, 2.5).tilt, 0, 1e-9);
    posesNear(T.sampleTray(edit, 4), REST); posesNear(T.sampleTray(edit, 5), { ...REST, swing: 0, tilt: -5 }, 1e-9);  // smooth leaving 4 s, mid = half
    posesNear(T.sampleTray(edit, 6), { ...REST, tilt: -10 });
    posesNear(T.sampleTray(edit, 7.99), { ...REST, tilt: -10 });   // hold: stays at the 6 s key until the next
    posesNear(T.sampleTray(edit, 8), { ...REST, tilt: 5 }); posesNear(T.sampleTray(edit, 100), { ...REST, tilt: 5 }, 1e-9);   // after the last key: hold
    // smoothstep and linear on a single move
    const move = ease => T.cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 0 }, ease }, { t: 3, pose: { tilt: 10 } }] });
    near(T.sampleTray(move('smooth'), 2).tilt, 5); near(T.sampleTray(move('smooth'), 1.5).tilt, 10 * 0.25 * 0.25 * (3 - 0.5 * 1), 1e-9);
    near(T.sampleTray(move('linear'), 1.5).tilt, 2.5); near(T.sampleTray(move('hold'), 2.9).tilt, 0); near(T.sampleTray(move('hold'), 3).tilt, 10);
    // a key at 0 s replaces the implicit one; a first key at 3 s makes the tray ease from the start (no jump)
    const first = T.cleanTrayEdit({ keys: [{ t: 3, pose: { tilt: 12 } }] });
    posesNear(T.sampleTray(first, 0), REST); near(T.sampleTray(first, 1.5).tilt, 6); posesNear(T.sampleTray(first, 3), { ...REST, tilt: 12 });
    posesNear(T.sampleTray(T.cleanTrayEdit({ keys: [{ t: 0, pose: { tilt: 12 } }, { t: 3, pose: { tilt: 0 } }] }), 0), { ...REST, tilt: 12 });
    // the coupling is applied at sampling, not to the stored keys
    const wild = T.cleanTrayEdit({ keys: [{ t: 1, pose: { slide: 1, swing: 120, tilt: 12 } }] });
    assert.deepEqual(wild.keys[0].pose, { slide: 1, swing: 120, tilt: 12 }, 'stored as keyed'); posesNear(T.sampleTray(wild, 1), { slide: 1, swing: 0, tilt: 0 });
    // with a rider on the plate the slide stops at 0.45 and the swing at 20 degrees, and the tilt follows the coupling there
    posesNear(T.sampleTray(wild, 1, { riderMm: ERGO }), { slide: 0.45, swing: 20, tilt: 12 }, 1e-9); assert.deepEqual(T.trayIssues(wild, { riderMm: ERGO }).find(i => i.kind === 'key').joints, ['slide', 'swing']);
    // every sample stays inside the limits
    for (const riderMm of [0, ERGO]) for (let t = 0; t <= 12; t += 0.1) {
        const p = T.sampleTray(T.cleanTrayEdit({ keys: [{ t: 1, pose: { swing: 90, tilt: 12 } }, { t: 4, pose: { slide: 1, swing: 0, tilt: 0 } }, { t: 8, pose: { slide: 0, swing: -170, tilt: -15 } }, { t: 10, pose: { swing: 0 } }] }), t, { riderMm });
        assert.deepEqual(T.clampedJoints(p, { riderMm }), [], `t=${t}`); posesNear(T.clampTrayPose(p, { riderMm }), p, 1e-9);
    }
}
{   // routes: direct when allowed, a safe order when not, the issue reported otherwise
    const out = { ...REST }, inn = { slide: 1, swing: 0, tilt: 0 };
    let r = T.routeSegment(out, { ...REST, tilt: -12 }); assert.equal(r.mode, 'direct'); assert.deepEqual(r.issues, []);   // between deployed poses
    r = T.routeSegment(out, { ...REST, swing: 120, tilt: -2 }); assert.equal(r.mode, 'direct', 'swinging out to the side: allowed all the way');
    r = T.routeSegment({ slide: 0, swing: 90 }, inn);          // pushing in while swinging back: swing back first, then slide
    assert.equal(r.mode, 'staged'); assert.ok(r.windows.swing[1] <= r.windows.slide[1] && r.windows.swing[0] < r.windows.slide[0] + 1e-9 && r.windows.slide[1] === 1 && r.windows.swing[0] === 0, JSON.stringify(r.windows));
    r = T.routeSegment({ slide: 0, tilt: 10 }, inn);           // level first, then slide in
    assert.equal(r.mode, 'staged'); assert.ok(r.windows.tilt[1] <= 0.5 && r.windows.slide[0] >= 0.4 && r.windows.slide[1] === 1, JSON.stringify(r.windows));
    r = T.routeSegment(inn, { slide: 0, swing: 90, tilt: -2 }); assert.equal(r.mode, 'staged'); assert.ok(r.windows.slide[0] === 0 && r.windows.swing[0] > 0 && r.windows.slide[1] <= r.windows.swing[1], 'slide out first, then swing: ' + JSON.stringify(r.windows));
    r = T.routeSegment(inn, { slide: 0, swing: 90, tilt: -10 }); assert.equal(r.mode, 'clamped', 'the target itself is not allowed: nothing can fix the path'); assert.ok(r.issues.length);
    r = T.routeSegment({ slide: 0, tilt: 10 }, inn, { route: 'direct' }); assert.equal(r.mode, 'direct'); assert.ok(r.issues.length, 'forced direct is kept and reported'); assert.deepEqual(r.windows, { slide: [0, 1], swing: [0, 1], baseTilt: [0, 1], tilt: [0, 1] });
    // every staged window set is a path the coupling allows (the validation), checked on a grid of targets
    let staged = 0;
    for (const sl of [0, 0.3, 0.7, 1]) for (const sw of [-90, 0, 90, 170]) for (const ti of [-15, 0, 15]) for (const sl2 of [0, 0.5, 1]) for (const sw2 of [-90, 0, 90]) {
        const a = T.clampTrayPose({ slide: sl, swing: sw, tilt: ti }), b = T.clampTrayPose({ slide: sl2, swing: sw2, tilt: 0 }), rt = T.routeSegment(a, b);
        for (const j of T.JOINTS) assert.ok(rt.windows[j][0] >= -1e-9 && rt.windows[j][1] <= 1 + 1e-9 && rt.windows[j][0] <= rt.windows[j][1]);
        if (rt.mode === 'staged') { staged++; assert.deepEqual(rt.issues, []); }
    }
    assert.ok(staged > 20, 'staging was used: ' + staged);
    // a sampled staged move never leaves the allowed set, and is smooth in time (no joint jumps)
    const edit = T.cleanTrayEdit({ keys: [{ t: 0, pose: { slide: 0, swing: 90, tilt: 0 } }, { t: 4, pose: { slide: 1, swing: 0, tilt: 0 } }] });
    let last = null; for (let t = 0; t <= 4.0001; t += 0.02) { const p = T.sampleTray(edit, t, { riderMm: ERGO }); assert.deepEqual(T.clampedJoints(p, { riderMm: ERGO }), [], 't=' + t); if (last) for (const j of T.JOINTS) assert.ok(Math.abs(p[j] - last[j]) < (j === 'swing' ? 8 : 0.1), `${j} jumps at ${t}`); last = p; }
    posesNear(T.sampleTray(edit, 4), { slide: 1, swing: 0, tilt: 0 }, 1e-9); posesNear(T.sampleTray(edit, 0), { slide: 0, swing: 90, tilt: 0 }, 1e-9);
    // the same move with a keyboard on the plate: held at the clearance (swing 20, slide 0.45)
    posesNear(T.sampleTray(edit, 0, { riderMm: ERGO }), { slide: 0, swing: 20, tilt: 0 }, 1e-9); posesNear(T.sampleTray(edit, 4, { riderMm: ERGO }), { slide: 0.45, swing: 0, tilt: 0 }, 1e-9);
    // and with the keyboard on the desk's shelf the whole way: allowed all the way, nothing reported
    for (let t = 0; t <= 4.001; t += 0.1) assert.deepEqual(T.clampedJoints(T.sampleTray(edit, t, { riderMm: ERGO, riderAway: 1 }), { riderMm: ERGO, riderAway: 1 }), [], 't=' + t);
    posesNear(T.sampleTray(edit, 4, { riderMm: ERGO, riderAway: 1 }), { slide: 1, swing: 0, tilt: 0 }, 1e-9); assert.deepEqual(T.trayIssues(edit, { riderMm: ERGO, riderAway: 1 }), []);
    // the route field of a key is honoured
    const forced = T.cleanTrayEdit({ keys: [{ t: 0, pose: { slide: 0, tilt: 10 }, route: 'direct' }, { t: 4, pose: { slide: 1, tilt: 0 } }] });
    assert.ok(T.trayIssues(forced).some(i => i.kind === 'segment' && i.joint === 'tilt' && i.mode === 'direct'), 'a direct segment that is not allowed is reported');
    assert.deepEqual(T.trayIssues(T.cleanTrayEdit({ keys: [{ t: 0, pose: { slide: 0, tilt: 10 } }, { t: 4, pose: { slide: 1, tilt: 0 } }] })), [], 'auto stages it: nothing to report');
    const issues = T.trayIssues(T.cleanTrayEdit({ keys: [{ t: 1, pose: { slide: 1, swing: 120, tilt: 12 } }] })); assert.deepEqual(issues.find(i => i.kind === 'key'), { kind: 'key', t: 1, id: 'k1', joints: ['swing', 'tilt'] });
}
{   // determinism: a pure function of the edit and the time, out-of-order seeks agree
    const edit = T.cleanTrayEdit({ initial: { swing: 20 }, keys: [{ t: 1, pose: { swing: 90 } }, { t: 3, pose: { slide: 1, swing: 0, tilt: -1 }, route: 'auto' }, { t: 5, pose: { slide: 0.3, swing: -120, drop: 30 }, ease: 'linear' }, { t: 9, pose: { tilt: 14 }, ease: 'hold' }] });
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const times = Array.from({ length: 1000 }, () => rnd() * 11);
    const first = times.map(t => T.sampleTray(edit, t, { riderMm: ERGO })), again = [...times].reverse().map(t => T.sampleTray(edit, t, { riderMm: ERGO })).reverse();
    assert.deepEqual(again, first); assert.deepEqual(times.map(t => T.sampleTray(JSON.parse(JSON.stringify(edit)), t, { riderMm: ERGO })), first);
    assert.ok(first.every(p => T.JOINTS.every(j => Number.isFinite(p[j]))));
    const before = JSON.stringify(edit); T.sampleTray(edit, 2); T.trayIssues(edit); assert.equal(JSON.stringify(edit), before, 'sampling does not touch the edit');
    // unsorted keys (an archive) sample the same as sorted ones
    const keys = edit.keys, shuffled = { ...edit, keys: [keys[2], keys[0], keys[3], keys[1]] };
    for (const t of [0.5, 2, 4, 6, 10]) assert.deepEqual(T.sampleTray(shuffled, t), T.sampleTray(edit, t));
}
{   // editing: immutable, same shape as the people pose keys
    const e0 = {}, e1 = T.setKey(e0, 2, { tilt: -10 }); assert.deepEqual(e0, {}); assert.equal(e1.keys.length, 1); assert.deepEqual(e1.keys[0].pose, { tilt: -10 }); assert.equal(e1.keys[0].id, 'k1');
    const e2 = T.setKey(e1, 2.005, { swing: 30 }, { ease: 'hold', route: 'direct', label: 'Out' }); assert.equal(e2.keys.length, 1, 'a key within a sixtieth is the same key'); assert.deepEqual(e2.keys[0].pose, { tilt: -10, swing: 30 }); assert.equal(e2.keys[0].ease, 'hold'); assert.equal(e2.keys[0].route, 'direct'); assert.equal(e2.keys[0].label, 'Out'); assert.equal(e1.keys[0].ease, undefined);
    const e3 = T.setKey(e2, 5, { slide: 1 }); assert.deepEqual(T.trayKeyTimes(e3), [2, 5]); assert.deepEqual(T.trayKeyedJoints(e3), ['slide', 'swing', 'tilt']);
    assert.equal(T.setKey(e3, -1, { tilt: 1 }), e3); assert.equal(T.setKey(e3, 1, {}), e3); assert.equal(T.setKey(e3, NaN, { tilt: 1 }), e3);
    const e4 = T.setKeyEase(T.setKeyRoute(e3, 5, 'direct'), 5, 'linear'); assert.equal(e4.keys[1].route, 'direct'); assert.equal(e4.keys[1].ease, 'linear'); const e5 = T.setKeyEase(T.setKeyRoute(e4, 5, 'auto'), 5, 'smooth'); assert.ok(!('route' in e5.keys[1]) && !('ease' in e5.keys[1]));
    assert.equal(T.setKeyEase(e3, 5, 'bounce'), e3); assert.equal(T.setKeyEase(e3, 99, 'linear'), e3);
    const e6 = T.moveKey(e3, 5, 7); assert.deepEqual(T.trayKeyTimes(e6), [2, 7]); const e7 = T.moveKey(e3, 5, 2); assert.equal(e7.keys.length, 1); assert.deepEqual(e7.keys[0].pose, { tilt: -10, swing: 30, slide: 1 }, 'moved onto a key: joints merge, the moved key wins');
    assert.equal(T.moveKey(e3, 99, 3), e3); assert.equal(T.moveKey(e3, 5, -1), e3);
    const e8 = T.removeKey(e3, 2, 'swing'); assert.deepEqual(e8.keys[0].pose, { tilt: -10 }); assert.equal(T.removeKey(e3, 2).keys.length, 1); assert.ok(!('keys' in T.removeKey(T.removeKey(e3, 2), 5))); assert.equal(T.removeKey(e3, 99), e3);
    assert.equal(T.removeKey(T.setKey({}, 1, { tilt: 5 }), 1, 'tilt').keys, undefined, 'the last joint out takes the key out');
    const c = T.copyKey(e3, 2); assert.deepEqual(c, { pose: { tilt: -10, swing: 30 }, ease: 'hold', route: 'direct', label: 'Out' }); assert.equal(T.copyKey(e3, 99), null);
    const e9 = T.pasteKey(e3, 8, c); assert.deepEqual(T.trayKeyTimes(e9), [2, 5, 8]); assert.deepEqual(e9.keys[2].pose, c.pose); assert.equal(e9.keys[2].ease, 'hold'); assert.notEqual(e9.keys[2].id, e9.keys[0].id); assert.equal(T.pasteKey(e3, 8, null), e3);
    c.pose.tilt = 99; assert.equal(T.copyKey(e3, 2).pose.tilt, -10, 'a copy is a copy');
    const i1 = T.setInitial({}, { tilt: 5, swing: 10 }); assert.deepEqual(i1.initial, { tilt: 5, swing: 10 }); assert.deepEqual(T.setInitial(i1, { tilt: 0 }).initial, { swing: 10 }); assert.ok(!('initial' in T.setInitial(i1, null))); assert.ok(!('initial' in T.setInitial(T.setInitial(i1, { tilt: 0 }), { swing: 0 })));
    assert.equal(T.cleanTrayEdit(e0), null, 'an empty shell is nothing in the cut'); assert.ok(T.cleanTrayEdit(e3));
    for (const e of [e1, e2, e3, e9]) assert.deepEqual(T.cleanTrayEdit(e), e, 'every edit is already clean');
}
{   // OLD DATA: a trayEdits from before 25 Nov 2026 with the mount bracket and drop keys still loads, without error, and they are ignored
    const old = [{ desk: 'gaming', bracket: true, initial: { drop: 40, tilt: 3 }, keys: [{ t: 1, pose: { drop: 30 } }, { t: 2, pose: { slide: 0.3, drop: 60 } }] }, { bracket: true }, { bracket: 'true', keys: [{ t: 1, pose: { tilt: 3, drop: 10 } }] }];
    const e = T.cleanTrayEdits({ trayEdits: old }).trayEdits;
    assert.equal(e.length, 2, 'a bracket-only edit says nothing now'); assert.ok(e.every(x => !('bracket' in x)), 'no bracket field is carried');
    assert.deepEqual(e[0], { desk: 'gaming', initial: { tilt: 3 }, keys: [{ id: 'k1', t: 2, pose: { slide: 0.3 } }] }, 'a key that named only the drop is gone, the drop out of the others');
    assert.deepEqual(e[1].keys[0].pose, { tilt: 3 });
    assert.deepEqual(T.cleanTrayEdits({ trayEdits: e }), { trayEdits: e }, 'clean twice changes nothing');
    assert.equal(T.cleanTrayEdit({ bracket: true }), null); assert.equal(T.activeTrayEdit([{ bracket: true }], 'gaming'), null);
    // sampling the raw old data directly (an archive never cleaned) works too, and no drop comes out
    for (const t of [0, 1, 1.5, 2, 9]) { const p = T.sampleTray(old[0], t, { riderMm: ERGO }); assert.deepEqual(Object.keys(p).sort(), ['baseTilt', 'slide', 'swing', 'tilt']); assert.ok(T.JOINTS.every(j => Number.isFinite(p[j]))); }
    assert.ok(Array.isArray(T.trayIssues(old[0], { riderMm: ERGO }))); assert.equal(cleanShot({ room: 'product', seconds: 12, trayEdits: old }).trayEdits.length, 2);
}
{   // BASE TILT (K1, 25 Nov 2026): the arm on the rear bracket's upper bolt; its limits, and the surface tilt that keeps the platform's own angle
    // (base + surface) within +-15 deg of level (level under the desk); "Level the platform" = surface -base
    assert.deepEqual(T.cleanTrayPose({ baseTilt: -40 }), { ...REST, baseTilt: -25 }); assert.deepEqual(T.cleanTrayPose({ baseTilt: 30 }), { ...REST, baseTilt: 10 });
    assert.deepEqual(T.limitsFor({ baseTilt: -25 }).tilt, [10, 30], 'arm 25 deg down: the surface must tilt up at least 10 deg, level at +25');
    assert.deepEqual(T.limitsFor({ baseTilt: 10 }).tilt, [-25, 5]);
    posesNear(T.clampTrayPose({ baseTilt: -25, tilt: 25 }), { baseTilt: -25, tilt: 25 }); posesNear(T.clampTrayPose({ baseTilt: 10, tilt: -10 }), { baseTilt: 10, tilt: -10 });
    posesNear(T.clampTrayPose({ baseTilt: -25, tilt: 0 }), { baseTilt: -25, tilt: 10 }, 1e-9);     // the platform may not hang 25 deg down: held at -15
    // under the desk the arm may not lift the plate, and the platform stays level
    assert.deepEqual(T.limitsFor({ slide: 1 }).baseTilt, [-25, 0]); near(T.limitsFor({ slide: 0.6 }).baseTilt[1], 5);
    posesNear(T.clampTrayPose({ slide: 1, baseTilt: 8, tilt: -8 }), { slide: 1, baseTilt: 0, tilt: -2 }, 1e-9);
    posesNear(T.clampTrayPose({ slide: 1, baseTilt: -20, tilt: 20 }), { slide: 1, baseTilt: -20, tilt: 20 }, 1e-9, 'arm down under the desk, platform level: allowed');
    // Level the platform
    assert.equal(T.levelTilt(-25), 25); assert.equal(T.levelTilt(10), -10); assert.equal(T.levelTilt(0), 0); assert.equal(T.levelTilt(NaN), 0); assert.ok(!Object.is(T.levelTilt(0), -0));
    // keys without baseTilt (every edit before it) sample it as 0: the old tray, unchanged
    const old = T.cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: -10 } }, { t: 3, pose: { slide: 0.4 } }] });
    for (const t of [0, 1, 2, 3, 5]) assert.equal(T.sampleTray(old, t).baseTilt, 0);
    // a move with the base tilt: eased like the others, and staged (level first) when it goes under the desk
    const move = T.cleanTrayEdit({ keys: [{ t: 0, pose: { baseTilt: -25, tilt: 25 } }, { t: 4, pose: { slide: 1, baseTilt: 0, tilt: 0 } }] });
    for (let t = 0; t <= 4.001; t += 0.1) assert.deepEqual(T.clampedJoints(T.sampleTray(move, t)), [], 't=' + t);
    assert.deepEqual(T.trayIssues(move), []);
}
console.log('tray-pose-test: ok (joints and hard limits, coupling and the riders on / off the tray, old bracket / drop data ignored, keys, shot field and byte-identical fixtures, sampler, routes, determinism, editing)');
