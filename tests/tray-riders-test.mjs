// The keyboard and mouse ON the desk / tray or UP on the desk's shelf, and the hand-off between (experience/tray-riders.mjs,
// rider-handoff.mjs, rider-fade.mjs, docs/keyboard-tray/SPEC.md 0.3): decided by the desk tilt only (9 deg out, 7 deg back), 0.4 s,
// deterministic for any seek. With the keyboard tray: a cross-fade, nothing travels (sampled every 1/60 s with the real desk auto-stow);
// without it: the carry on a path that clears the desktop. Chapter 1's real desk movement as the example. Pure node.   node tests/tray-riders-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../experience/tray-riders.mjs';
import { sampleClipMotion } from '../experience/desk-clips.mjs';
import { sampleTray, cleanTrayEdit, trayIssues } from '../experience/tray-pose.mjs';
import * as THREE from 'three';
import { DeskAutoStow } from '../desk-auto-stow.mjs';
import { createRiderHandoff } from '../experience/rider-handoff.mjs';
import { FADE_COPY_NAME } from '../experience/rider-fade.mjs?v=rider-fade-hero-20261126';

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
{   // the cross-fade (the keyboard tray's riders): every 1/60 s of chapter 1, with the real desk auto-stow, each visible keyboard / mouse
    // is EXACTLY at its tray / desk place or EXACTLY at its shelf place (never between), the two opacities add to 1, nothing else turns
    // see-through, the riders' own materials come back, and a frame rendered on its own is the frame a run from 0 s gives
    const d = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/tray-awaken-motion-20261125.json'), 'utf8')), motion = { clips: d.clips, initial: d.initial };
    const tiltAt = s => sampleClipMotion(motion, s).tilt, track = { seconds: d.seconds, tiltAt }, tl = R.riderTimeline(tiltAt, d.seconds);
    const PLATE = new THREE.Matrix4().makeTranslation(0, -45, 520);      // the fake tray's keyboard place, in the desktop's frame
    function world(withTray = true) {
        const scene = new THREE.Scene(), desktop = new THREE.Group(), mounts = { desktop };
        desktop.position.set(0, 900, 0); scene.add(desktop);
        for (const [role, y] of [['lower-shelf', 1300], ['shelf', 1650]]) { const m = mounts[role] = new THREE.Group(); m.position.set(0, y, -330); m.userData.surfaceSize = { width: 1100, depth: 300 }; scene.add(m); }
        const shared = new THREE.MeshStandardMaterial({ color: 0x222222 }), objects = new Map();
        const add = (id, accessoryId, size, at, role, material) => {
            const obj = new THREE.Mesh(new THREE.BoxGeometry(...size), material); obj.position.set(...at); obj.castShadow = true;
            obj.userData = accessoryId ? { accessoryId, deskObject: {} } : { deskObject: {}, fixedHardware: true };
            desktop.add(obj); objects.set(id, { id, obj, saved: { role, label: id } }); return obj;
        };
        const keyboard = add('keyboard', 'ergo-keyboard', [440, 30, 200], [0, 15, 250], 'desktop', shared);
        const mouse = add('mouse', 'logitech-mx-master', [80, 40, 120], [420, 20, 200], 'desktop', new THREE.MeshStandardMaterial({ color: 0x333333 }));
        const bystander = add('hardware', null, [100, 20, 100], [-400, 10, 0], 'desktop', shared);     // stays on the desk, shares the keyboard's material
        const stow = new DeskAutoStow({ editing: true /* as in the stage: editing on, nothing picked */, selected: null, manager: { selected: null, ctx: { phase: () => 'x' } }, purchaseMount: () => null });
        const r = { id: 'desk', objects, rig: { mounts }, state: { tilt: 0, size: '48x30' }, spec: {} };
        const h = createRiderHandoff({ sceneDesks: { active: r, objects: { stow } } });
        if (withTray) h.setTray(obj => obj === keyboard ? new THREE.Matrix4().multiplyMatrices(desktop.matrixWorld, PLATE) : null, () => true);
        const own = new Map([keyboard, mouse].map(o => [o, { material: o.material, local: (o.updateMatrix(), o.matrix.clone()) }]));
        return { scene, desktop, mounts, keyboard, mouse, bystander, shared, stow, r, h, own };
    }
    // one frame as the stage draws it: the desk's pose, the stow, then the hand-off layer
    const draw = (w, s) => { w.r.state.tilt = tiltAt(s); w.desktop.rotation.x = w.r.state.tilt * Math.PI / 180; w.scene.updateMatrixWorld(true); w.stow.update(w.r); w.h.apply(s, track); w.scene.updateMatrixWorld(true); };
    const copies = w => {
        const out = [{ id: 'keyboard', o: w.keyboard, real: true }, { id: 'mouse', o: w.mouse, real: true }];
        w.scene.traverse(o => { if (o.name === FADE_COPY_NAME) out.push({ id: o.userData.riderFadeOf === 'ergo-keyboard' ? 'keyboard' : 'mouse', o, real: false }); });
        return out;
    };
    const meshOf = c => c.real ? c.o : c.o.children[0];
    const shown = c => { for (let o = c.o; o; o = o.parent) if (!o.visible) return false; return true; };
    const off = (a, b) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])));
    // the two places of a rider with the desk as it is now: tray / desk (rides the desktop) and shelf (rides the shelf mount)
    const shelfLocal = new Map();
    {
        const w = world(false); w.r.state.tilt = 20; w.desktop.rotation.x = 20 * Math.PI / 180; w.scene.updateMatrixWorld(true); w.stow.update(w.r);
        for (const [id, item] of w.r.objects) if (item.autoStow?.role) { item.obj.updateMatrix(); shelfLocal.set(id, { role: item.autoStow.role, matrix: item.obj.matrix.clone() }); }
        assert.deepEqual([...shelfLocal.keys()].sort(), ['keyboard', 'mouse'], 'the real stow puts both on a shelf');
    }
    const places = (w, id) => ({ tray: new THREE.Matrix4().multiplyMatrices(w.desktop.matrixWorld, id === 'keyboard' ? PLATE : w.own.get(w.mouse).local),
        shelf: new THREE.Matrix4().multiplyMatrices(w.mounts[shelfLocal.get(id).role].matrixWorld, shelfLocal.get(id).matrix) });
    const snapshot = w => copies(w).filter(shown).map(c => {
        c.o.updateWorldMatrix(true, false); const p = places(w, c.id), m = meshOf(c).material, atTray = off(c.o.matrixWorld, p.tray), atShelf = off(c.o.matrixWorld, p.shelf);
        return { id: c.id, where: atTray < 1e-6 ? 'tray' : atShelf < 1e-6 ? 'shelf' : 'BETWEEN ' + Math.min(atTray, atShelf).toFixed(2), opacity: +(m.transparent ? m.opacity : 1).toFixed(9) };
    }).sort((a, b) => (a.id + a.where).localeCompare(b.id + b.where));
    const w = world(), frames = Math.round(d.seconds * 60), run = [], faded = [0, 0], last = {};
    const inWindow = s => tl.events.findIndex(e => s > e.t && s < e.t + R.HANDOFF_S);
    for (let n = 0; n <= frames; n++) {
        const s = n / 60; draw(w, s); const rows = snapshot(w); run.push(rows); const win = inWindow(s), at = 'at ' + s.toFixed(3) + ' s (tilt ' + tiltAt(s).toFixed(2) + ')';
        for (const row of rows) assert.ok(row.where === 'tray' || row.where === 'shelf', `${row.id} is ${row.where} ${at}`);
        for (const id of ['keyboard', 'mouse']) {
            const mine = rows.filter(x => x.id === id), onShelf = mine.filter(x => x.where === 'shelf').reduce((a, x) => a + x.opacity, 0);
            near(mine.reduce((a, x) => a + x.opacity, 0), 1, 1e-6, `${id}: the two opacities add to 1 ${at}`);
            near(onShelf, R.riderFade(tl, s), 1e-6, `${id}: the shelf one has the fade's opacity ${at}`);
            if (n) assert.ok(Math.abs(onShelf - last[id]) < 0.07, `${id}: no pop ${at}: ${last[id]} -> ${onShelf}`);
            last[id] = onShelf; assert.equal(mine.length, win >= 0 ? 2 : 1, `${id}: one outside a hand-off, two inside ${at}`);
        }
        if (win >= 0) faded[win]++;
        else for (const o of [w.keyboard, w.mouse]) {
            assert.equal(o.material, w.own.get(o).material, 'its very own material back ' + at); assert.equal(o.children.length, 0, 'no depth pass left ' + at); assert.ok(o.castShadow && o.renderOrder === 0, 'its flags back ' + at);
        }
        for (const o of [w.keyboard, w.mouse]) { const m = w.own.get(o).material; assert.ok(m.opacity === 1 && !m.transparent && m.depthWrite, 'its own material is never written ' + at); }
        assert.ok(w.bystander.material === w.shared && !w.shared.transparent && w.shared.opacity === 1 && w.shared.depthWrite, 'nothing else turns see-through ' + at);
    }
    assert.deepEqual(tl.events.map(e => e.to), ['shelf', 'tray']); for (const f of faded) assert.ok(f >= 23 && f <= 24, 'each cross-fade is 0.4 s of frames: ' + faded);
    // seek-safe: a fresh desk that has never seen the stow (a render chunk starting inside the way back, a scrub) draws the same frames
    const around = tl.events.flatMap(e => [-0.3, -0.05, 0.05, 0.2, 0.35, 0.5].map(k => Math.round((e.t + k) * 60)));
    for (const n of around) { const cold = world(); draw(cold, n / 60); assert.deepEqual(snapshot(cold), run[n], 'cold frame ' + n + ' = the run'); }
    const jumbled = world(); for (let i = 0; i < 300; i++) { const n = i % 2 ? around[(i * 7) % around.length] : (i * 7919) % (frames + 1); draw(jumbled, n / 60); assert.deepEqual(snapshot(jumbled), run[n], 'out of order frame ' + n); }
    // restoring in the middle of a fade leaves nothing behind
    draw(jumbled, tl.events[0].t + 0.2); assert.equal(copies(jumbled).length, 4); jumbled.h.restore();
    assert.equal(copies(jumbled).length, 2); assert.equal(jumbled.keyboard.material, jumbled.own.get(jumbled.keyboard).material); assert.equal(jumbled.keyboard.children.length, 0);
    // a desk without the tray is as before: the carry, no fade copy
    const plain = world(false); draw(plain, 0); draw(plain, tl.events[0].t + 0.2);
    assert.equal(copies(plain).length, 2, 'no fade copy without the tray'); assert.equal(plain.h.fading(), false); assert.ok(snapshot(plain).every(x => x.where.startsWith('BETWEEN')), 'carried, as before');
    const bare = world(); bare.h.setTray(() => null, () => false); assert.equal(bare.h.fading(), false, 'a tray with nothing on it does not fade');
    // the hero (no tray rig, FADE_CHAPTERS): the same cross-fade both ways between the desk place and the shelf place, cold frames the same;
    // chapter 1 (by its id alone), create and storage without a rig keep the carry
    assert.deepEqual([...R.FADE_CHAPTERS], ['hero']);
    const hero = () => { const x = world(false); x.h.setChapter('hero'); return x; }, heroRun = [], h = hero();
    for (let n = 0; n <= frames; n++) {
        const s = n / 60; draw(h, s);
        for (const id of ['keyboard', 'mouse']) {
            const mine = copies(h).filter(c => c.id === id && shown(c)); let sum = 0, onShelf = 0;
            for (const c of mine) {
                c.o.updateWorldMatrix(true, false);
                const desk = new THREE.Matrix4().multiplyMatrices(h.desktop.matrixWorld, h.own.get(id === 'keyboard' ? h.keyboard : h.mouse).local), up = places(h, id).shelf, m = meshOf(c).material, o = m.transparent ? m.opacity : 1;
                const atShelf = off(c.o.matrixWorld, up) < 1e-6; assert.ok(atShelf || off(c.o.matrixWorld, desk) < 1e-6, `hero: ${id} is between its two places at ${s.toFixed(3)} s`);
                sum += o; if (atShelf) onShelf += o;
            }
            near(sum, 1, 1e-6, 'hero: opacities add to 1'); near(onShelf, R.riderFade(tl, s), 1e-6, 'hero: the fade at ' + s.toFixed(3));
        }
        heroRun.push(copies(h).filter(shown).map(c => (c.o.updateWorldMatrix(true, false), [c.id, c.real, +(meshOf(c).material.transparent ? meshOf(c).material.opacity : 1).toFixed(9), ...c.o.matrixWorld.elements.map(v => +v.toFixed(6))].join())).sort());
    }
    for (const n of around) { const cold = hero(); draw(cold, n / 60); assert.deepEqual(copies(cold).filter(shown).map(c => (c.o.updateWorldMatrix(true, false), [c.id, c.real, +(meshOf(c).material.transparent ? meshOf(c).material.opacity : 1).toFixed(9), ...c.o.matrixWorld.elements.map(v => +v.toFixed(6))].join())).sort(), heroRun[n], 'hero cold frame ' + n); }
    for (const id of ['awaken', 'create', 'storage', undefined]) {
        const other = world(false); other.h.setChapter(id); draw(other, 0); draw(other, tl.events[0].t + 0.2);
        assert.equal(other.h.fading(), false, id + ': no fade'); assert.equal(copies(other).length, 2); assert.ok(snapshot(other).every(x => x.where.startsWith('BETWEEN')), id + ': carried, as before');
    }
    h.h.setChapter('hero'); h.h.restore(); assert.equal(h.h.fading(), false, 'restore forgets the chapter');
    console.log(`  cross-fade: ${frames + 1} frames at 60 fps, ${faded.join(' + ')} fading, every visible keyboard / mouse at its tray or shelf place, ${around.length} cold and 300 out-of-order frames identical`);
}
console.log('tray-riders-test: ok (decided by the desk tilt only, 9 deg out / 7 deg back, 0.4 s hand-off without a pop, deterministic, chapter 1 frees the tray, the tray riders cross-fade in place, the carry clears the desktop)');
