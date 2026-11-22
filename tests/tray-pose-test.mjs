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
const posesNear = (p, q, eps = 1e-6) => { for (const j of T.JOINTS) near(p[j], q[j], eps); };
const REST = { slide: 0, swing: 0, tilt: 0, drop: 0 };
const ERGO = 45, MOUSE = 56.9;

{   // the joint table: four joints, Vico's ranges, rest = 0 = the glb as authored
    assert.deepEqual(T.TRAY_JOINTS.map(j => j.id), ['slide', 'swing', 'tilt', 'drop']);
    assert.deepEqual(L.JOINT_LIMITS, { slide: [0, 1], swing: [-180, 180], tilt: [-15, 15], drop: [0, 165] });
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
    assert.equal(L.SLIDE_COUPLING[0].slide, 0); assert.deepEqual(L.SLIDE_COUPLING[0].tilt, [tlo, thi]); assert.equal(L.SLIDE_COUPLING[0].swing, sMax, 'fully out: the full range');
    for (const r of Object.values(L.UNDER_RAMPS)) assert.ok(r[0] < r[1]);
    for (const [id, mm] of Object.entries(L.RIDER_MM)) assert.ok(mm > 0 && mm < 100, id);
}
{   // cleanTrayPose: hard limits, units, junk
    assert.deepEqual(T.cleanTrayPose(null), REST); assert.deepEqual(T.cleanTrayPose('x'), REST); assert.deepEqual(T.cleanTrayPose([1, 2]), REST);
    assert.deepEqual(T.cleanTrayPose({ slide: 2, swing: 400, tilt: -90, drop: 999 }), { slide: 1, swing: 180, tilt: -15, drop: 165 });
    assert.deepEqual(T.cleanTrayPose({ slide: -1, swing: -400, tilt: 90, drop: -5 }), { slide: 0, swing: -180, tilt: 15, drop: 0 });
    assert.deepEqual(T.cleanTrayPose({ tilt: 7.123456, slide: 0.123456, drop: 12.345 }), { slide: 0.1235, swing: 0, tilt: 7.12, drop: 12.3 });
    assert.deepEqual(T.cleanTrayPose({ tilt: NaN, swing: Infinity, slide: '1' }), REST, 'junk values are the rest value');
    assert.equal(T.cleanTrayPose({}, { partial: true }), null); assert.equal(T.cleanTrayPose({ tilt: 'x' }, { partial: true }), null);
    assert.deepEqual(T.cleanTrayPose({ tilt: 5, bogus: 1 }, { partial: true }), { tilt: 5 }, 'partial: only the joints named');
    assert.ok(!Object.is(T.cleanTrayPose({ tilt: -0.0001 }).tilt, -0), 'no minus zero in the file');
}
{   // the coupling: limits per joint given the others, held in the order slide, swing, tilt, drop
    posesNear(T.clampTrayPose(REST), REST); posesNear(T.clampTrayPose(REST, { riderMm: ERGO }), REST);
    assert.deepEqual(T.limitsFor(REST), { slide: [0, 1], swing: [-180, 180], tilt: [-15, 15], drop: [0, 0] }, 'fully out: nothing is narrowed, and the drop joint is off by default');
    assert.deepEqual(T.limitsFor(REST, { dropEnabled: true }).drop, [0, 165]); assert.equal(L.DROP_ENABLED, false, 'the drop joint is off by default (Vico decides later)');
    const pushed = T.limitsFor({ slide: 1 });
    assert.deepEqual(pushed.swing, [0, 0]); assert.deepEqual(pushed.tilt, [-2, 0], 'pushed in: level, no swing');
    posesNear(T.clampTrayPose({ slide: 1, swing: 90, tilt: 10 }), { slide: 1, swing: 0, tilt: 0, drop: 0 });
    posesNear(T.clampTrayPose({ slide: 0.4, swing: 170, tilt: 15 }), { slide: 0.4, swing: 170, tilt: 0, drop: 0 }, 1e-6);   // 170 swung: plate is under the desk, no tilt up
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
    assert.deepEqual(T.clampedJoints({ slide: 1, swing: 90, tilt: 10, drop: 0 }), ['swing', 'tilt']); assert.deepEqual(T.clampedJoints(REST), []);
    // hard limits still apply when an edit is sampled raw: a pose past them is clamped, never thrown
    posesNear(T.clampTrayPose({ slide: 9, swing: 999, tilt: 99, drop: 999 }), { slide: 1, swing: 0, tilt: 0, drop: 0 }); posesNear(T.clampTrayPose({ slide: 9, swing: 999, tilt: 99, drop: 999 }, { dropEnabled: true }), { slide: 1, swing: 0, tilt: 0, drop: 165 });
    assert.deepEqual(T.clampedJoints({ drop: 20 }), ['drop'], 'a keyed drop while the joint is off is named'); assert.deepEqual(T.clampedJoints({ drop: 20 }, { dropEnabled: true }), []);
}
{   // the keyboard stays on the tray and the drop joint is off: the plate may not go under the desk with a rider that does not fit (spec 0.2)
    near(T.dropNeededMm(ERGO), 45 - 19.7 + 3); near(T.dropNeededMm(MOUSE), 56.9 - 19.7 + 3); assert.equal(T.dropNeededMm(0), 0); assert.equal(T.dropNeededMm(10), 0, 'a thin rider fits at the CAD drop');
    assert.equal(T.riderThicknessMm([]), 0); near(T.riderThicknessMm(['apple-keyboard', 'magic-mouse']), 30.3); near(T.riderThicknessMm(['ergoflex-ergo-keyboard', 'gaming-mouse']), 56.9); assert.equal(T.riderThicknessMm(['mystery']), L.RIDER_UNKNOWN_MM);
    assert.equal(T.underDesk(REST), 0); assert.equal(T.underDesk({ slide: 1 }), 1); assert.equal(T.underDesk({ swing: -90 }), 1); near(T.underDesk({ slide: 0.6 }), 0.5);
    assert.ok(T.riderFitsUnder(0) && T.riderFitsUnder(10) && !T.riderFitsUnder(ERGO) && !T.riderFitsUnder(22.2) && !T.riderFitsUnder(MOUSE));
    // no rider (or a thin one): the whole range, as before
    for (const riderMm of [0, 10]) { assert.deepEqual(T.limitsFor(REST, { riderMm }).slide, [0, 1]); assert.deepEqual(T.limitsFor(REST, { riderMm }).swing, [-180, 180]); }
    // a keyboard or mouse on the plate, drop off (the default): slide <= 0.45 (106 mm of 234.5), |swing| <= 20 degrees; tilt as the coupling says there (full range)
    const kb = T.limitsFor(REST, { riderMm: ERGO }); assert.deepEqual(kb.slide, [0, 0.45]); assert.deepEqual(kb.swing, [-20, 20]); assert.deepEqual(kb.tilt, [-15, 15]); assert.deepEqual(kb.drop, [0, 0]);
    posesNear(T.clampTrayPose({ slide: 1, swing: 90, tilt: 10 }, { riderMm: ERGO }), { slide: 0.45, swing: 20, tilt: 10, drop: 0 });
    posesNear(T.clampTrayPose({ slide: 0.3, swing: -15 }, { riderMm: MOUSE }), { slide: 0.3, swing: -15, tilt: 0, drop: 0 }, 1e-9);
    assert.deepEqual(T.clampedJoints({ slide: 1, swing: 90 }, { riderMm: ERGO }), ['slide', 'swing']);
    // nothing lowers the tray by itself, ever
    for (const pose of [{ slide: 1 }, { swing: 90 }, { slide: 0.6 }]) for (const riderMm of [0, ERGO, 1000]) for (const dropEnabled of [false, true]) assert.equal(T.clampTrayPose(pose, { riderMm, dropEnabled }).drop, 0, JSON.stringify([pose, riderMm, dropEnabled]));
    // the drop joint on (an edit with bracket: true): a keyed drop that clears the rider lifts the limit, one that does not leaves it
    const on = { dropEnabled: true, riderMm: ERGO };
    posesNear(T.clampTrayPose({ slide: 1, drop: 30 }, on), { slide: 1, swing: 0, tilt: 0, drop: 30 }); posesNear(T.clampTrayPose({ slide: 1, drop: 28.3 }, on), { slide: 1, swing: 0, tilt: 0, drop: 28.3 });
    posesNear(T.clampTrayPose({ slide: 1, drop: 20 }, on), { slide: 0.45, swing: 0, tilt: 0, drop: 20 }); posesNear(T.clampTrayPose({ swing: 90, drop: 40 }, on), { slide: 0, swing: 90, tilt: 0, drop: 40 });
    assert.deepEqual(T.limitsFor({ drop: 30 }, on).slide, [0, 1]); assert.deepEqual(T.limitsFor({ drop: 10 }, on).slide, [0, 0.45]);
    assert.equal(T.clampTrayPose({ slide: 1, drop: 165 }, { dropEnabled: true, riderMm: 1000 }).slide, 0.45, 'a rider nothing can clear stays out');
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
        for (const shot of j.shots || []) { const out = cleanShot(shot); assert.ok(!('trayEdits' in out), f); assert.deepEqual(T.cleanTrayEdits(shot), {}, f); assert.equal(norm(cleanShot(out)), norm(out), f + ' cleans to itself'); shots++; }
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
    assert.deepEqual(wild.keys[0].pose, { slide: 1, swing: 120, tilt: 12 }, 'stored as keyed'); posesNear(T.sampleTray(wild, 1), { slide: 1, swing: 0, tilt: 0, drop: 0 });
    // with a rider on the plate (drop off) the slide stops at 0.45 and the swing at 20 degrees, and the tilt follows the coupling there
    posesNear(T.sampleTray(wild, 1, { riderMm: ERGO }), { slide: 0.45, swing: 20, tilt: 12, drop: 0 }, 1e-9); assert.deepEqual(T.trayIssues(wild, { riderMm: ERGO }).find(i => i.kind === 'key').joints, ['slide', 'swing']);
    // every sample stays inside the limits
    for (const riderMm of [0, ERGO]) for (let t = 0; t <= 12; t += 0.1) {
        const p = T.sampleTray(T.cleanTrayEdit({ keys: [{ t: 1, pose: { swing: 90, tilt: 12 } }, { t: 4, pose: { slide: 1, swing: 0, tilt: 0 } }, { t: 8, pose: { slide: 0, swing: -170, tilt: -15 } }, { t: 10, pose: { swing: 0 } }] }), t, { riderMm });
        assert.deepEqual(T.clampedJoints(p, { riderMm }), [], `t=${t}`); posesNear(T.clampTrayPose(p, { riderMm }), p, 1e-9);
    }
}
{   // routes: direct when allowed, a safe order when not, the issue reported otherwise
    const out = { ...REST }, inn = { slide: 1, swing: 0, tilt: 0, drop: 0 };
    let r = T.routeSegment(out, { ...REST, tilt: -12 }); assert.equal(r.mode, 'direct'); assert.deepEqual(r.issues, []);   // between deployed poses
    r = T.routeSegment(out, { ...REST, swing: 120, tilt: -2 }); assert.equal(r.mode, 'direct', 'swinging out to the side: allowed all the way');
    r = T.routeSegment({ slide: 0, swing: 90 }, inn);          // pushing in while swinging back: swing back first, then slide
    assert.equal(r.mode, 'staged'); assert.ok(r.windows.swing[1] <= r.windows.slide[1] && r.windows.swing[0] < r.windows.slide[0] + 1e-9 && r.windows.slide[1] === 1 && r.windows.swing[0] === 0, JSON.stringify(r.windows));
    r = T.routeSegment({ slide: 0, tilt: 10 }, inn);           // level first, then slide in
    assert.equal(r.mode, 'staged'); assert.ok(r.windows.tilt[1] <= 0.5 && r.windows.slide[0] >= 0.4 && r.windows.slide[1] === 1, JSON.stringify(r.windows));
    r = T.routeSegment(inn, { slide: 0, swing: 90, tilt: -2 }); assert.equal(r.mode, 'staged'); assert.ok(r.windows.slide[0] === 0 && r.windows.swing[0] > 0 && r.windows.slide[1] <= r.windows.swing[1], 'slide out first, then swing: ' + JSON.stringify(r.windows));
    r = T.routeSegment(inn, { slide: 0, swing: 90, tilt: -10 }); assert.equal(r.mode, 'clamped', 'the target itself is not allowed: nothing can fix the path'); assert.ok(r.issues.length);
    r = T.routeSegment({ slide: 0, tilt: 10 }, inn, { route: 'direct' }); assert.equal(r.mode, 'direct'); assert.ok(r.issues.length, 'forced direct is kept and reported'); assert.deepEqual(r.windows, { slide: [0, 1], swing: [0, 1], tilt: [0, 1], drop: [0, 1] });
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
    let last = null; for (let t = 0; t <= 4.0001; t += 0.02) { const p = T.sampleTray(edit, t, { riderMm: ERGO }); assert.deepEqual(T.clampedJoints(p, { riderMm: ERGO }), [], 't=' + t); if (last) for (const j of T.JOINTS) assert.ok(Math.abs(p[j] - last[j]) < (j === 'swing' ? 8 : j === 'drop' ? 3 : 0.1), `${j} jumps at ${t}`); last = p; }
    posesNear(T.sampleTray(edit, 4), { slide: 1, swing: 0, tilt: 0, drop: 0 }, 1e-9); posesNear(T.sampleTray(edit, 0), { slide: 0, swing: 90, tilt: 0, drop: 0 }, 1e-9);
    // the same move with a keyboard on the plate, drop off: held at the clearance (swing 20, slide 0.45), never lowered
    posesNear(T.sampleTray(edit, 0, { riderMm: ERGO }), { slide: 0, swing: 20, tilt: 0, drop: 0 }, 1e-9); posesNear(T.sampleTray(edit, 4, { riderMm: ERGO }), { slide: 0.45, swing: 0, tilt: 0, drop: 0 }, 1e-9);
    // an edit with bracket: true and a keyed drop that clears the keyboard is allowed all the way
    const dropped = T.cleanTrayEdit({ bracket: true, keys: [{ t: 0, pose: { slide: 0, swing: 90, tilt: 0, drop: 30 } }, { t: 4, pose: { slide: 1, swing: 0, tilt: 0, drop: 30 } }] });
    for (let t = 0; t <= 4.001; t += 0.1) { const p = T.sampleTray(dropped, t, { riderMm: ERGO }); assert.deepEqual(T.clampedJoints(p, { riderMm: ERGO, dropEnabled: true }), [], 't=' + t); near(p.drop, 30, 1e-9, 'drop'); }
    posesNear(T.sampleTray(dropped, 4, { riderMm: ERGO }), { slide: 1, swing: 0, tilt: 0, drop: 30 }, 1e-9); assert.deepEqual(T.trayIssues(dropped, { riderMm: ERGO }), []);
    assert.equal(T.sampleTray(T.setBracket(dropped, false), 4, { riderMm: ERGO }).drop, 0, 'bracket off: the drop joint is off again');    // the route field of a key is honoured
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
{   // the setup flag bracket: absent = off; only a real true is kept; it rides in the edit like the keys
    assert.deepEqual(T.cleanTrayEdit({ bracket: true, keys: [{ t: 1, pose: { tilt: 3 } }] }).bracket, true);
    for (const v of [false, 0, 1, 'true', null, undefined, {}]) assert.ok(!('bracket' in (T.cleanTrayEdit({ bracket: v, keys: [{ t: 1, pose: { tilt: 3 } }] }))), 'bracket ' + JSON.stringify(v) + ' is off');
    assert.deepEqual(T.cleanTrayEdit({ bracket: true }), { bracket: true }, 'the setup alone is kept (ticked before the first key)'); assert.equal(T.trayActive({ bracket: true }), false, 'but it needs no rig by itself');
    assert.equal(T.activeTrayEdit([{ bracket: true }], 'gaming'), null);
    const e = T.cleanTrayEdits({ trayEdits: [{ desk: 'gaming', bracket: true, keys: [{ t: 1, pose: { drop: 30 } }] }, { keys: [{ t: 1, pose: { tilt: 3 } }] }] }).trayEdits; assert.equal(e[0].bracket, true); assert.ok(!('bracket' in e[1]));
    assert.deepEqual(T.cleanTrayEdits({ trayEdits: e }), { trayEdits: e }, 'clean twice changes nothing');
    assert.equal(T.trayBracket(e[0]), true); assert.equal(T.trayBracket(e[1]), false); assert.equal(T.trayBracket(null), false);
    assert.deepEqual(T.setBracket(e[1], true), { ...e[1], bracket: true }); assert.ok(!('bracket' in T.setBracket(e[0], false))); assert.deepEqual(T.setBracket(null, true), { bracket: true });
    // it is what switches the drop joint on: a keyed drop is held to 0 without it, kept with it
    assert.equal(T.sampleTray(e[0], 1).drop, 30); assert.equal(T.sampleTray(T.setBracket(e[0], false), 1).drop, 0); assert.equal(T.sampleTray(e[0], 1, { dropEnabled: false }).drop, 0, 'an explicit option wins');
    // an edit without bracket and without a keyed drop: samples exactly as before
    posesNear(T.sampleTray(e[1], 1), { ...REST, tilt: 3 });
}
console.log('tray-pose-test: ok (joints and hard limits, coupling and the rider drop, keys, shot field and byte-identical fixtures, sampler, routes, determinism, editing)');
