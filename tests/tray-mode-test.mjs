// The Director's Tray mode (experience/scene-tray-editor.mjs, tray-ui.mjs; docs/keyboard-tray/SPEC.md 5): what the panel and the lane say, every
// edit as one undo step, the keys (select, Shift, retime, Delete, ease, route, copy / paste), the bracket switch, the live tray track and the wiring
// into director.mjs / stage.mjs / player.mjs. Pure node: the editor runs on fake deps (the Director's commit with its undo grouping, a fake stage).
//   node tests/tray-mode-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTrayEditor } from '../experience/scene-tray-editor.mjs';
import * as U from '../experience/tray-ui.mjs';
import * as T from '../experience/tray-pose.mjs';
import { SLIDE_TRAVEL_MM } from '../experience/tray-limits.mjs';
import { deleteTarget } from '../experience/director-selection.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const ERGO = 45, KEYBOARD = [{ kind: 'keyboard', propId: 'ergoflex-ergo-keyboard' }, { kind: 'mouse', propId: 'ergoflex-mx-master-mouse' }];

{   // tray-pose additions: the raw sample, retimeKeys
    const e = T.cleanTrayEdit({ keys: [{ t: 2, pose: { slide: 1, swing: 90 } }] });
    const raw = T.sampleTray(e, 3, { raw: true, riderMm: ERGO }), held = T.sampleTray(e, 3, { riderMm: ERGO });
    assert.deepEqual([raw.slide, raw.swing], [1, 90], 'raw: only the hard limits'); assert.deepEqual([held.slide, held.swing], [0.45, 20]);
    assert.deepEqual(T.sampleTray(null, 3, { raw: true }), { slide: 0, swing: 0, tilt: 0, drop: 0 });
    let k = T.cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 1 } }, { t: 2, pose: { tilt: 2 } }, { t: 3, pose: { tilt: 3 } }, { t: 4, pose: { tilt: 4 } }] });
    assert.deepEqual(T.trayKeyTimes(T.retimeKeys(k, [[2, 2.5], [3, 3.5]])), [1, 2.5, 3.5, 4], 'two keys together');
    const merged = T.retimeKeys(k, [[1, 4]]); assert.deepEqual(T.trayKeyTimes(merged), [2, 3, 4]); assert.equal(merged.keys[2].pose.tilt, 1, 'a moved key wins where it lands');
    assert.deepEqual(T.trayKeyTimes(T.retimeKeys(k, [[4, 99]])), [1, 2, 3, 99]); assert.deepEqual(T.trayKeyTimes(T.retimeKeys(k, [[2, -5]])), [0, 1, 3, 4], 'held at 0');
    assert.equal(T.retimeKeys(k, [['x', 1], null, [9, 9]]).keys.length, 4); assert.deepEqual(k, T.cleanTrayEdit(k), 'the edit given is not changed');
}
{   // tray-ui: what the panel shows
    assert.deepEqual(['slide', 'swing', 'tilt', 'drop'].map(j => U.toDisplay(j, 0.5)), [50, 0.5, 0.5, 0.5]); assert.equal(U.fromDisplay('slide', 50), 0.5); assert.equal(U.fromDisplay('swing', 30), 30);
    const none = U.panelModel(null, 0); assert.deepEqual(none.rows.map(r => r.joint), ['slide', 'swing', 'tilt'], 'no drop slider without the bracket');
    assert.ok(none.rows.every(r => r.value === 0 && r.shown === 0 && !r.reason && !r.clamped)); assert.equal(none.rows[0].limitText, '0–100 %'); assert.equal(none.rows[1].limitText, '-180–180°'); assert.equal(none.rows[2].limitText, '-15–15°');
    const on = U.panelModel(T.cleanTrayEdit({ bracket: true, keys: [{ t: 1, pose: { drop: 30 } }] }), 2); assert.deepEqual(on.rows.map(r => r.joint), ['slide', 'swing', 'tilt', 'drop']); assert.equal(on.rows[3].shown, 30); assert.equal(on.rows[3].limitText, '0–165 mm');
    // a keyboard on the tray, the drop off: the keyed value and the value the tray takes, with the reason in words
    const e = T.cleanTrayEdit({ keys: [{ t: 2, pose: { slide: 1, swing: 90, tilt: 5 } }] }), m = U.panelModel(e, 3, { riderMm: ERGO, riders: ['keyboard'] });
    const by = Object.fromEntries(m.rows.map(r => [r.joint, r]));
    assert.equal(by.slide.value, 100); assert.equal(by.slide.shown, 45); assert.ok(by.slide.clamped); assert.match(by.slide.reason, /keyboard \(45 mm\) does not fit under the desk/); assert.match(by.slide.reason, /45 % of its slide \(106 of 234\.5 mm\)/); assert.match(by.slide.reason, /Mount bracket \(added\)/); assert.match(by.slide.reason, /28\.3 mm/);
    assert.equal(by.swing.shown, 20); assert.match(by.swing.reason, /swings no further than 20°/); assert.equal(by.tilt.reason, '', 'tilt 5 is fine there');
    assert.equal(by.slide.limitText, '0–45 %'); assert.equal(by.swing.limitText, '-20–20°');
    // with the bracket on and the drop short of what the keyboard needs: the same limit, and the fix in words
    const short = U.panelModel(T.cleanTrayEdit({ bracket: true, keys: [{ t: 2, pose: { slide: 1, drop: 10 } }] }), 3, { riderMm: ERGO, riders: ['keyboard'] }); assert.match(short.rows[0].reason, /Key a drop of 28\.3 mm or more \(it is 10 mm here\)/);
    const ok = U.panelModel(T.cleanTrayEdit({ bracket: true, keys: [{ t: 2, pose: { slide: 1, drop: 30 } }] }), 3, { riderMm: ERGO }); assert.equal(ok.rows[0].shown, 100); assert.equal(ok.rows[0].reason, '');
    // a limit that is not the rider's: the coupling
    const c = U.panelModel(T.cleanTrayEdit({ keys: [{ t: 2, pose: { slide: 0.9, swing: 100, tilt: 10 } }] }), 3); const cb = Object.fromEntries(c.rows.map(r => [r.joint, r])); assert.match(cb.swing.reason, /Swing stops at ±\d+(\.\d)?° at this slide/); assert.match(cb.tilt.reason, /Tilt is held to/); assert.equal(cb.slide.reason, '');
    // a keyed drop with the joint off
    assert.match(U.limitReason('drop', { slide: 0, swing: 0, tilt: 0, drop: 20 }, T.cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 1 } }] })), /The drop is off\. Switch on "Mount bracket \(added\)"/);
    assert.equal(U.BRACKET_LABEL, 'Mount bracket (added)'); assert.ok(U.BRACKET_HINT.length > 40 && !U.BRACKET_HINT.includes('\n'));
    // presets and saved poses
    assert.deepEqual(U.PRESETS.map(p => p.id), ['out', 'tilt', 'side', 'in']); assert.equal(Object.isFrozen(U.PRESETS), true);
    const s1 = U.addSaved([], ' Typing ', { slide: 0, tilt: -5, junk: 1, swing: NaN }); assert.deepEqual(s1, [{ name: 'Typing', pose: { slide: 0, tilt: -5 } }]); assert.equal(U.addSaved(s1, 'Typing', { tilt: 3 }).length, 1, 'the same name replaces'); assert.deepEqual(U.addSaved(s1, 'B', { tilt: 3 }).map(p => p.name), ['B', 'Typing']);
    assert.deepEqual(U.cleanSaved([null, { name: '', pose: { tilt: 1 } }, { name: 'x', pose: {} }, { name: 'ok', pose: { tilt: 1 } }, 'z']), [{ name: 'ok', pose: { tilt: 1 } }]); assert.equal(U.cleanSaved(Array.from({ length: 40 }, (_, i) => ({ name: 'n' + i, pose: { tilt: 1 } }))).length, 24);
    // the lane: keys, segments, warnings
    const lane = U.laneModel(T.cleanTrayEdit({ keys: [{ t: 2, pose: { slide: 0 } }, { t: 4, pose: { slide: 1, swing: 90 }, route: 'direct' }, { t: 8, pose: { slide: 0, swing: 0 } }] }), 10, { riderMm: ERGO, selected: [4] });
    assert.deepEqual(lane.keys.map(k => [k.t, k.left, k.selected, k.warn]), [[2, 20, false, false], [4, 40, true, true], [8, 80, false, false]]); assert.equal(lane.segments.length, 2); assert.deepEqual(lane.segments.map(s => [s.from, s.to, s.route]), [[2, 4, 'auto'], [4, 8, 'direct']]); assert.ok(lane.warnings >= 1);
    assert.match(lane.keys[1].why, /Slide, Swing held to the limits here/); assert.match(U.keyTitle(lane.keys[1]), /Tray key at 4\.00 s.*held to the limits.*Shift: add.*Delete: remove/);
    assert.deepEqual(U.laneModel(null, 10).keys, []); assert.equal(U.laneModel(T.cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 3 } }] }), 10).warnings, 0, 'an allowed key has no warning');
}

// the Director's commit, as far as the editor sees it: one undo step per call, calls with the same key merged
function director({ film = null, has = true, riders = KEYBOARD, preset = 'gaming', store = null, doc = null, shotInit = {} } = {}) {
    const shot = { id: 'awareness', seconds: 12, ...shotInit }, undo = [], calls = { seek: [], status: [], rerender: 0, picked: [] }; let group = null, t = 0, soft = 0;
    const commit = (fn, { key = null } = {}) => { if (!key || group !== key) undo.push(structuredClone(shot)); group = key; fn(); };
    const memory = new Map(), local = store || { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
    const ed = createTrayEditor({ shot: () => shot, film: () => film, commit, status: (m, bad) => calls.status.push([m, !!bad]), rerender: s => { if (s === true) soft++; else calls.rerender++; }, time: () => t, seek: x => { calls.seek.push(x); t = x; }, seconds: () => shot.seconds,
        stage: () => ({ trayInfo: () => ({ has, preset, riders }), trayAt: () => true }), keyPicked: x => calls.picked.push(x), store: local, doc });
    return { ed, shot, undo, calls, at: x => { t = x; }, soft: () => soft, local, group: () => { group = null; } };
}
const edit0 = d => d.shot.trayEdits?.[0];

{   // the panel states
    const none = director({ has: false }); assert.match(none.ed.panel(), /no keyboard tray/); assert.equal(none.ed.laneRow(), '', 'no lane without a tray'); assert.equal(none.ed.enter(), false); assert.equal(none.ed.active(), false);
    const d = director(); assert.match(d.ed.panel(), /Double-click the tray/); assert.match(d.ed.panel(), /data-action="tr-enter"/); assert.ok(!/name="tr-slide"/.test(d.ed.panel()), 'Tray mode is not entered yet');
    assert.match(d.ed.laneRow(), /data-tray-lane/); assert.match(d.ed.laneRow(), /Double-click the tray to key it/); assert.match(d.ed.laneRow(), /empty/);
    assert.equal(d.ed.enter(), true); assert.equal(d.ed.active(), true); const p = d.ed.panel();
    for (const n of ['tr-slide', 'tr-swing', 'tr-tilt', 'tr-slide-n', 'tr-swing-n', 'tr-tilt-n', 'tr-bracket']) assert.ok(p.includes(`name="${n}"`), n); assert.ok(!p.includes('name="tr-drop"'), 'no drop slider with the bracket off');
    assert.ok(!/name="tr-bracket" checked/.test(p)); assert.match(p, /Mount bracket \(added\)/); assert.ok(p.includes(U.BRACKET_HINT.slice(0, 40)), 'the one-line hint');
    assert.match(p, /data-action="tr-done"/); assert.match(p, /data-action="tr-auto" aria-pressed="false"/); assert.ok(!/autofocus/.test(p), 'no field is focused for the user (the Director\'s keys stay free)');
    assert.equal(d.undo.length, 0, 'entering changes nothing in the cut');
}
{   // a change is one undo step: starting pose (no keys, Auto-key off), a key (Auto-key on), a slider drag
    const d = director(); d.ed.enter();
    d.ed.changed({ name: 'tr-tilt-n', value: '-8' }); assert.deepEqual(edit0(d), { initial: { tilt: -8 } }); assert.equal(d.undo.length, 1); assert.match(d.calls.status.at(-1)[0], /the whole chapter/);
    d.ed.changed({ name: 'tr-slide-n', value: '40' }); assert.deepEqual(edit0(d).initial, { tilt: -8, slide: 0.4 }); assert.equal(d.undo.length, 2, 'one step per edit');
    d.ed.changed({ name: 'tr-tilt-n', value: '0' }); assert.deepEqual(edit0(d).initial, { slide: 0.4 }, 'a joint back at rest leaves the starting pose'); d.ed.changed({ name: 'tr-slide-n', value: '0' }); assert.equal(d.shot.trayEdits, undefined, 'nothing left, nothing of the film\'s: no field');
    assert.throws(() => d.ed.changed({ name: 'tr-tilt-n', value: 'abc' }), /Type a number/); assert.throws(() => d.ed.changed({ name: 'tr-tilt-n', value: '' }), /Type a number/);
    // a slider drag: many input events, ONE undo step, the number follows
    const s = director(); s.ed.enter(); s.undo.length = 0;
    for (const v of ['-1', '-3', '-6', '-9']) s.ed.input({ name: 'tr-tilt', value: v }); assert.equal(s.undo.length, 1, 'a whole drag is one undo step'); assert.deepEqual(edit0(s).initial, { tilt: -9 }); assert.equal(s.calls.rerender, 1, 'the panel is not redrawn under the slider (only on the first enter())');
    s.ed.changed({ name: 'tr-tilt', value: '-9' }); assert.equal(s.undo.length, 1, 'and the release is the same step'); assert.ok(s.calls.rerender >= 2, 'the release redraws');
    // Auto-key: a key at the playhead
    const a = director(); a.ed.enter(); a.ed.action('tr-auto'); assert.equal(a.ed.autoKey(), true); assert.equal(a.local.getItem('ergoflex.director.autoKey'), '1', 'the pose mode\'s habit, shared');
    a.at(2); a.ed.changed({ name: 'tr-swing-n', value: '30' }); assert.deepEqual(edit0(a).keys.map(k => [k.t, k.pose]), [[2, { swing: 30 }]]); assert.equal(a.ed.keySelected(), true, 'the new key is selected');
    a.at(5); a.ed.changed({ name: 'tr-tilt-n', value: '-10' }); a.ed.changed({ name: 'tr-slide-n', value: '20' }); assert.deepEqual(edit0(a).keys.map(k => [k.t, Object.keys(k.pose).sort()]), [[2, ['swing']], [5, ['slide', 'tilt']]]);
    a.ed.action('tr-auto'); a.at(5); a.ed.changed({ name: 'tr-tilt-n', value: '-4' }); assert.equal(edit0(a).keys[1].pose.tilt, -4, 'Auto-key off: the key that is at the playhead is changed');
    a.at(8); a.ed.changed({ name: 'tr-tilt-n', value: '-2' }); assert.deepEqual(edit0(a).initial, { tilt: -2 }); assert.match(a.calls.status.at(-1)[0], /Auto-key is off and there is no key here: this is the tray's starting pose/);
    // presets
    const pr = director(); pr.ed.enter(); pr.ed.action('tr-preset', 2); assert.deepEqual(edit0(pr).initial, { swing: 90 }, 'Side storage (slide 0, tilt 0 are rest)'); pr.ed.action('tr-preset', 0); assert.equal(pr.shot.trayEdits, undefined, 'Out (as built) puts everything back'); assert.equal(pr.undo.length, 2);
    pr.ed.action('tr-preset', 9); assert.equal(pr.undo.length, 2);
}
{   // the clamped reason in the panel and the lane's warning
    const d = director({ shotInit: { trayEdits: [{ keys: [{ id: 'k1', t: 2, pose: { slide: 1, swing: 90 } }] }] } }); d.ed.enter(); d.at(3);
    const p = d.ed.panel(); assert.match(p, /tray-joint clamped/); assert.match(p, /keyed 100 % · the tray takes 45 %/); assert.match(p, /keyboard and mouse \(47\.2 mm\) does not fit under the desk/); assert.match(p, /name="tr-slide" min="0" max="100" step="1" value="45"/);
    const lane = d.ed.laneRow(); assert.match(lane, /tray-key  warn|tray-key\s+warn/); assert.match(lane, /1 key · held/); assert.match(lane, /<button type="button" class="tray-key/, 'keys are buttons: the timeline marquee ignores buttons');
    d.at(2); d.ed.changed({ name: 'tr-bracket', checked: true }); assert.equal(edit0(d).bracket, true); assert.match(d.ed.panel(), /name="tr-drop"/); assert.match(d.ed.panel(), /name="tr-bracket" checked/);
    d.ed.changed({ name: 'tr-drop-n', value: '31' }); assert.equal(edit0(d).keys[0].pose.drop, 31, 'a key at the playhead takes the drop'); d.at(3); assert.ok(!/does not fit under the desk/.test(d.ed.panel()) && /name="tr-slide" min="0" max="100" step="1" value="100"/.test(d.ed.panel()), 'a drop that clears the keyboard lifts the rider limit so slide reaches 100 %'); assert.equal(d.undo.length, 2);
    d.ed.changed({ name: 'tr-bracket', checked: false }); assert.ok(!('bracket' in edit0(d))); assert.ok(!/name="tr-drop"/.test(d.ed.panel())); assert.equal(d.undo.length, 3);
}
{   // keys: select, Shift, retime, delete, ease, route, label, copy / paste, prev / next
    const d = director({ shotInit: { trayEdits: [{ keys: [{ t: 1, pose: { tilt: 3 } }, { t: 3, pose: { tilt: -3 } }, { t: 6, pose: { swing: 20 } }, { t: 9, pose: { tilt: 0 } }] }] } }); d.ed.enter();
    d.ed.setSelection([3]); assert.equal(d.ed.keySelected(), true); const fields = d.ed.panel(); assert.match(fields, /name="tr-key-t" value="3.00"/); assert.match(fields, /name="tr-key-ease"/); assert.match(fields, /name="tr-key-route"/);
    d.ed.changed({ name: 'tr-key-ease', value: 'hold' }); assert.equal(edit0(d).keys[1].ease, 'hold'); d.ed.changed({ name: 'tr-key-route', value: 'direct' }); assert.equal(edit0(d).keys[1].route, 'direct'); d.ed.changed({ name: 'tr-key-label', value: ' Typing ' }); assert.equal(edit0(d).keys[1].label, 'Typing'); assert.equal(d.undo.length, 3);
    d.ed.changed({ name: 'tr-key-t', value: '4' }); assert.deepEqual(T.trayKeyTimes(edit0(d)), [1, 4, 6, 9]); assert.deepEqual(d.ed.selectedKeys(), [4], 'the moved key stays selected'); assert.equal(edit0(d).keys[1].ease, 'hold', 'and keeps its ease');
    d.ed.changed({ name: 'tr-key-t', value: '999' }); assert.deepEqual(T.trayKeyTimes(edit0(d)), [1, 6, 9, 12], 'held inside the chapter (12 s)');
    d.ed.setSelection([1, 6]); d.ed.retime([[1, 1.5], [6, 6.5]]); assert.deepEqual(T.trayKeyTimes(edit0(d)), [1.5, 6.5, 9, 12]); assert.equal(d.undo.length, 6, 'a retime of two keys is one step');
    d.ed.setSelection([1.5, 9]); assert.equal(d.ed.deleteKeys(), true); assert.deepEqual(T.trayKeyTimes(edit0(d)), [6.5, 12]); assert.equal(d.undo.length, 7); assert.equal(d.ed.keySelected(), false); assert.equal(d.ed.deleteKeys(), false); assert.match(d.calls.status.at(-1)[0], /Select a tray key/);
    // copy / paste at the playhead
    d.ed.setSelection([6.5]); d.ed.action('tr-key-copy'); d.at(2); d.ed.action('tr-key-paste'); assert.deepEqual(T.trayKeyTimes(edit0(d)), [2, 6.5, 12]); assert.deepEqual(edit0(d).keys[0].pose, { swing: 20 }); assert.notEqual(edit0(d).keys[0].id, edit0(d).keys[1].id);
    // previous / next move the playhead to a key
    d.at(5); d.ed.action('tr-key-prev'); assert.equal(d.calls.seek.at(-1), 2); d.ed.action('tr-key-next'); assert.equal(d.calls.seek.at(-1), 6.5); assert.deepEqual(d.calls.picked.slice(-2), [2, 6.5]);
    // Key all: every joint as the tray is now
    d.at(7); d.ed.action('tr-key-all'); assert.deepEqual(Object.keys(edit0(d).keys.find(k => k.t === 7).pose).sort(), ['slide', 'swing', 'tilt']);
    // saved poses (this browser)
    const doc = { querySelector: () => ({ value: 'Typing' }), querySelectorAll: () => [], addEventListener() {} }, s = director({ doc, shotInit: { trayEdits: [{ initial: { tilt: -6 } }] } }); s.ed.enter();
    s.ed.action('tr-save'); assert.deepEqual(JSON.parse(s.local.getItem(U.SAVED_KEY)), [{ name: 'Typing', pose: { slide: 0, swing: 0, tilt: -6 } }]); assert.match(s.ed.panel(), /data-action="tr-apply" data-index="0"/);
    s.ed.action('tr-preset', 0); assert.equal(s.shot.trayEdits, undefined); s.ed.action('tr-apply', 0); assert.deepEqual(edit0(s).initial, { tilt: -6 }); s.ed.action('tr-forget', 0); assert.equal(JSON.parse(s.local.getItem(U.SAVED_KEY)).length, 0);
    // the reset, with and without keys of the film's
    const r = director({ shotInit: { trayEdits: [{ keys: [{ t: 1, pose: { tilt: 3 } }] }] } }); r.ed.enter(); r.ed.action('tr-reset'); assert.equal(r.shot.trayEdits, undefined, 'no film keys to take off: no field');
    const f = director({ film: { sceneTray: [{ keys: [{ t: 2, pose: { swing: 40 } }] }] } }); f.ed.enter(); assert.deepEqual(T.trayKeyTimes(f.ed.current()), [2], 'the film\'s own keys are the Director\'s until it edits');
    f.ed.action('tr-reset'); assert.deepEqual(f.shot.trayEdits, [], 'a present empty list takes the film\'s off'); f.undo.length = 0;
    const g = director({ film: { sceneTray: [{ keys: [{ t: 2, pose: { swing: 40 } }] }] } }); g.ed.enter(); g.at(5); g.ed.action('tr-auto'); g.ed.changed({ name: 'tr-tilt-n', value: '6' }); assert.deepEqual(T.trayKeyTimes(g.shot.trayEdits[0]), [2, 5], 'the first edit copies the film\'s keys in and adds its own');
    // the edit for a desk model: the hero's sub-shot edit is the one edited there
    const h = director({ preset: 'office', shotInit: { trayEdits: [{ keys: [{ t: 1, pose: { tilt: 1 } }] }, { desk: 'office', keys: [{ t: 2, pose: { tilt: 2 } }] }] } }); h.ed.enter(); assert.deepEqual(T.trayKeyTimes(h.ed.current()), [2]); h.ed.setSelection([2]); h.ed.changed({ name: 'tr-key-ease', value: 'linear' }); assert.equal(h.shot.trayEdits.find(e => e.desk === 'office').keys[0].ease, 'linear'); assert.equal(h.shot.trayEdits.find(e => !e.desk).keys[0].ease, undefined);
    // the Done button and leaving
    d.ed.action('tr-done'); assert.equal(d.ed.active(), false); d.ed.enter(); d.ed.exit(); assert.equal(d.ed.active(), false); assert.match(d.ed.panel(), /Double-click the tray/);
}
{   // the double-click on the stage: the listener enters Tray mode only when the stage says the tray is under the pointer
    const listeners = {}, dom = { addEventListener: (type, fn, capture) => { listeners[type] = { fn, capture }; } }; let hit = true;
    const calls = []; const ed = createTrayEditor({ shot: () => ({ seconds: 10 }), film: () => null, commit: fn => fn(), status: () => {}, rerender: () => {}, time: () => 0, seconds: () => 10, three: () => ({ renderer: { domElement: dom } }), stage: () => ({ trayInfo: () => ({ has: true, riders: [] }), trayAt: (x, y) => { calls.push([x, y]); return hit; } }), reveal: () => calls.push('reveal') });
    ed.poll(); ed.poll(); assert.ok(listeners.dblclick.capture, 'one listener, in the capture phase'); let prevented = 0;
    listeners.dblclick.fn({ button: 0, clientX: 40, clientY: 50, preventDefault: () => prevented++ }); assert.equal(ed.active(), true); assert.deepEqual(calls[0], [40, 50]); assert.equal(prevented, 1); assert.ok(calls.includes('reveal'), 'the Tray tab opens');
    hit = false; listeners.dblclick.fn({ button: 0, clientX: 1, clientY: 1, preventDefault() {} }); assert.equal(ed.active(), false, 'a double-click elsewhere leaves it, as pose mode does');
    hit = true; listeners.dblclick.fn({ button: 2, clientX: 1, clientY: 1, preventDefault() {} }); assert.equal(ed.active(), false, 'only the left button');
}
{   // the wiring (source): director.mjs, stage.mjs, player.mjs, director-selection.mjs, the css
    const dir = read('experience/director.mjs'), stage = read('experience/stage.mjs'), player = read('experience/player.mjs');
    assert.ok(dir.includes("import {createTrayEditor} from './scene-tray-editor.mjs"), 'imported');
    assert.ok(dir.includes('<div data-inspector-page="tray"><div data-scene-tray>'), 'the Tray page'); assert.ok(/\['graphics','props','people','layers','desks'\]:\[\]\),\.\.\.\(filmShot\(\)&&trayEd\.has\(\)\?\['tray'\]/.test(dir), 'the Tray tab, only for a desk with a tray');
    assert.ok(dir.includes("${deskEditor.timeline()}${filmShot()?trayEd.laneRow():''}</div>"), 'the Tray lane is in the Motion group, after the desk lanes');
    assert.ok(dir.includes("if(name.startsWith('tr-')){trayEd.action(name,index);return;}"), 'clicks'); assert.ok(dir.includes("name.startsWith('tr-')&&el.type==='range'"), 'live sliders'); assert.ok(dir.includes("if(name?.startsWith('tr-')){try{trayEd.changed(event.target)"), 'changes');
    assert.ok(dir.includes('trayEd.sync();'), 'the playhead updates the panel and the lane\'s playhead'); assert.ok(dir.includes('trayKey:trayEd.keySelected()') && dir.includes("case 'tray-key':trayEd.deleteKeys();return true;"), 'Delete removes the selected tray keys');
    // Escape: leaves Tray mode, after the typing check (in a field it only blurs: escape-rule.mjs)
    const esc = dir.indexOf("event.target.closest?.('input,select,textarea'))return;"), tray = dir.indexOf('if(trayEd.active()){event.preventDefault();event.stopImmediatePropagation();trayEd.exit();return;}'); assert.ok(esc > 0 && tray > esc, 'the field check comes first');
    assert.ok(dir.includes('if(trayEd.active()){trayEd.exit();return;}'), 'Esc with the 3D view focused too');
    // the marquee trap: the lane's keys are buttons, and `button` is in the marquee's exclusion list
    assert.ok(/event\.target\.closest\('\.time-ruler,button,select,input,label,/.test(dir), 'the marquee ignores buttons'); assert.ok(U && read('experience/scene-tray-editor.mjs').includes('<button type="button" class="tray-key'));
    assert.ok(!/autofocus|\.focus\(\)/.test(read('experience/scene-tray-editor.mjs').replace(/\/\/.*$/gm, '')), 'the editor never focuses a field itself');
    // the stage: the live track, the info and the pick; the player pushes every edit
    for (const n of ['trayEditsTrack:async(edits,id)', 'trayInfo:()=>', 'trayAt:(cx,cy)=>']) assert.ok(stage.includes(n), n);
    assert.ok(player.includes('stage().trayEditsTrack?.(effectiveTrayEdits(filmSetup(shots[index].id),shots[index]),shots[index].id)'), 'the player pushes the tray keys with every edit, as the desk clips');
    assert.ok(/activeTrayEdit\(edits,trayPreset\)/.test(stage) && stage.includes("await import('./tray-rig.mjs')"), 'the rig only for an active edit');
    assert.equal(deleteTarget(null, { trayKey: true }), 'tray-key'); assert.equal(deleteTarget({ kind: 'camera', key: 'x' }, { trayKey: true }), 'tray-key'); assert.equal(deleteTarget({ kind: 'camera', key: 'x' }), 'camera'); assert.equal(deleteTarget(null, {}), null);
    // 44 px under (pointer: coarse); tray-mode.css has the lane and the panel and is linked before director-phone.css
    const phone = read('experience/director-phone.css'), css = read('experience/tray-mode.css'), html = read('experience/index.html');
    assert.ok(phone.includes('#director-timeline .tray-key{width:44px;height:44px;') && phone.includes('.tray-joint-controls input[type=range]{min-height:44px}'), '44 px'); assert.ok(css.includes('.tray-key.warn::after') && css.includes('.tray-seg.direct'));
    assert.ok(html.includes('href="./tray-mode.css"') && html.indexOf('tray-mode.css') < html.indexOf('director-phone.css'), 'tray-mode.css linked before director-phone.css');
    assert.ok(phone.indexOf('.tray-key{width:44px') > phone.indexOf('@media (pointer: coarse){'), 'inside the coarse block');
}
console.log('tray-mode-test: ok (panel and limits text, one undo step per edit, Auto-key / starting pose, keys, bracket switch, saved poses, the double-click, the wiring into the Director, stage and player)');
