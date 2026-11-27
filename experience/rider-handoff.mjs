// The keyboard and mouse between the desk (or the keyboard tray) and the desk's shelf unit, on the stage and in the film render
// (docs/keyboard-tray/SPEC.md 0.3). The desk's auto-stow (desk-auto-stow.mjs) still decides the shelf PLACE and puts them there when the
// desktop tilts past 9 deg; this layer only changes WHEN and HOW they are seen to get there:
//   * when: by the chapter's desk-tilt timeline (tray-riders.mjs riderTimeline: leave above 9 deg, back below 7 deg), never by the tray;
//   * how, never a pop, both ways, 0.4 s: where the chapter's keyboard tray rig has riders on its plate, a cross-fade (the one at the tray /
//     desk fades out while its copy on the shelf fades in, neither moves: rider-fade.mjs), and so in the hero (FADE_CHAPTERS), which has no
//     rig; elsewhere the lift-and-travel carry (carryPath);
//   * while they are on the shelf, the keyboard tray (tray-rig.mjs) leaves them alone and has its full range (Vico, 25 Nov 2026).
//
//   const h = createRiderHandoff(api)        api = window.ErgoFlex (sceneDesks)
//   h.apply(seconds, track)                  every frame (stage tick): track = { seconds, tiltAt(s) } of the chapter (stage deskTrack())
//   h.setTray(fn, hasRiders)                 the tray rig: fn(obj) -> the rider's world matrix on the plate now (null: not a rider);
//                                            hasRiders() -> something stands on its plate (then the hand-off is the cross-fade)
//   h.setChapter(id)                         the shot's id (stage prepare): a chapter in tray-riders FADE_CHAPTERS cross-fades without a rig
//   h.fading()                               the cross-fade is the hand-off here
//   h.awayAt(s)                              0 on the tray .. 1 on the shelf (the tray's limits, the Director's panel)
//   h.restore()                              everything back as the app has it
//
// Runtime only, like the rig and the stow: the items' saved state is never touched. The layer wraps the desk manager's stow.update so
// the stow always sees (and keeps) the items' own transforms: it takes its override off before the stow runs and puts it back after.
// A chapter whose desk never crosses 9 deg, with no keyboard tray rig, is never touched (no wrapper, no write).
import * as THREE from 'three';
import { accessory } from '../catalog.mjs';
import { riderTimeline, riderAway, riderFade, carryPath, fadesInChapter, LEAVE_DEG } from './tray-riders.mjs?v=rider-fade-hero-20261126';
import { createRiderFade } from './rider-fade.mjs?v=rider-fade-hero-20261126';

const isRider = obj => { const a = obj?.userData?.accessoryId && accessory(obj.userData.accessoryId); return !!a && ['keyboard', 'mouse'].includes(a.exclusiveGroup); };
const SIZE = { '48x30': [48, 30], '60x30': [60, 30], '72x30': [72, 30] };

export function createRiderHandoff(api) {
    let track = null, timeline = null, now = 0, trayOf = null, onTray = null, chapterFades = false, wrapped = null, stowUpdate = null;
    const fades = createRiderFade();
    const fading = () => chapterFades || !!trayOf && !!onTray?.();
    const over = new Map();     // obj -> { parent, position, quaternion, scale } its own transform while the layer overrides it
    const shelf = new WeakMap(); // obj -> { parent, matrix } where the stow put it last (kept for the way back, the stow lets go at 9 deg)
    const desk = () => api.sceneDesks?.active || null;
    const stow = () => api.sceneDesks?.objects?.stow || null;
    // (a desk the film keeps its loose items on, stow.off: nothing goes to the shelf, so there is no hand-off either)
    const active = () => !stow()?.off && (!!trayOf || !!timeline?.events.length || timeline?.start === 'shelf');

    function unapply() {
        fades.hide();      // the shelf copies out of the scene and the riders' own materials back, before anything else looks at them
        for (const [obj, own] of over) { if (obj.parent === own.parent) { obj.position.copy(own.position); obj.quaternion.copy(own.quaternion); obj.scale.copy(own.scale); obj.updateMatrix(); obj.updateMatrixWorld(true); } }
        over.clear();
    }
    // The desktop's frame (mm, y up from the top, z toward the user) for the carry path.
    function deskFrame(r) {
        const m = r?.rig?.mounts?.desktop; if (!m) return null;
        m.updateWorldMatrix(true, false);
        const inv = m.matrixWorld.clone().invert(), up = new THREE.Vector3(0, 1, 0).transformDirection(inv);
        const [w, d] = SIZE[r.state?.size] || String(r.state?.size || '48x30').split('x').map(Number);
        return { m, inv, up: up.toArray(), desk: { width: (w || 48) * 25.4, depth: (d || 30) * 25.4 } };
    }
    const authoredWorld = item => { const a = item.autoStow; if (!a?.parent || !a.transform) return null; const t = a.transform; a.parent.updateWorldMatrix(true, false);
        return a.parent.matrixWorld.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(t.p.x, t.p.y, t.p.z), new THREE.Quaternion(t.q.x, t.q.y, t.q.z, t.q.w), new THREE.Vector3(t.s.x, t.s.y, t.s.z))); };
    // Where the stow puts the riders on the shelf, asked while it is NOT holding them (the desk is under 9 deg on its way back down, so
    // the shelf one still needs its place): the stow runs as for a desk just past 9 deg and is undone again at once. Asked afresh every
    // such frame, so a frame rendered on its own (a seek, a render chunk) is the frame a run from 0 s gives.
    function shelfNow(r) {
        const s = stow(), out = new Map(); if (!s || !stowUpdate) return out;
        const was = r.state.tilt, items = [...(r.objects?.values() || [])], shown = items.map(i => [i.obj, i.obj.visible, i.obj.userData.stowHidden]);
        const editing = s.editor?.editing;     // (on in the stage with nothing picked: asking must neither close the editor nor unpack a pick)
        try {
            if (s.editor) s.editor.editing = false;
            r.state.tilt = LEAVE_DEG + 1; stowUpdate.call(s, r);
            for (const item of items) if (isRider(item.obj) && item.autoStow?.role) out.set(item.obj, { parent: item.obj.parent, matrix: item.obj.matrix.clone() });
        } finally {
            r.state.tilt = was; stowUpdate.call(s, r);
            if (s.editor) s.editor.editing = editing;
            for (const [obj, visible, hidden] of shown) { obj.visible = visible; if (hidden === undefined) delete obj.userData.stowHidden; else obj.userData.stowHidden = hidden; }
        }
        return out;
    }
    const write = (obj, world) => {
        if (!over.has(obj)) over.set(obj, { parent: obj.parent, position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone() });
        obj.parent.updateWorldMatrix(true, false);
        new THREE.Matrix4().multiplyMatrices(obj.parent.matrixWorld.clone().invert(), world).decompose(obj.position, obj.quaternion, obj.scale);
        obj.updateMatrix(); obj.updateMatrixWorld(true);
    };
    // Puts every keyboard and mouse of the featured desk where it is at chapter second `now`.
    function place(r) {
        if (!r || r !== desk() || !active()) return;
        unapply();
        const cross = fading(), away = cross ? riderFade(timeline, now) : riderAway(timeline, now), between = away > 0 && away < 1;
        const frame = !cross && between ? deskFrame(r) : null;
        const asked = cross && away > 0 && [...(r.objects?.values() || [])].some(i => isRider(i.obj) && !i.saved?.removed && !i.autoStow) ? shelfNow(r) : null;
        for (const item of r.objects?.values() || []) {
            const obj = item.obj; if (!isRider(obj) || item.saved?.removed || item.autoStow?.hidden || !obj.parent) continue;
            const stowed = !!item.autoStow?.role;
            obj.updateWorldMatrix(true, false);
            if (stowed) shelf.set(obj, { parent: obj.parent, matrix: obj.matrix.clone() });
            const home = trayOf?.(obj) || (stowed ? authoredWorld(item) : obj.matrixWorld.clone());
            if (!stowed && asked?.has(obj)) shelf.set(obj, asked.get(obj));
            const kept = shelf.get(obj), up = kept && kept.parent.parent ? (kept.parent.updateWorldMatrix(true, false), kept.parent.matrixWorld.clone().multiply(kept.matrix)) : null;
            let target;
            if (away <= 0 || !up) target = home;                                   // on the desk / tray (or no shelf place known yet: as the app has it)
            else if (away >= 1) target = stowed ? null : up;                        // on the shelf (between 9 and 7 deg the stow has let go: hold it there)
            else target = cross ? home : carry(home, up, away, frame, obj);
            if (!target || !obj.visible && !stowed) continue;
            if (!target.equals(obj.matrixWorld)) write(obj, target);
            // the cross-fade: the rider itself at its tray / desk place fading out, its copy at its shelf place fading in
            if (cross && up && between) fades.show(obj, kept, away);
        }
        if (!cross || !between) fades.dispose();
    }
    // The world matrix part way between home (desk / tray) and up (the shelf): eased, along the lift-and-travel arc in the desktop's frame.
    function carry(home, up, away, frame, obj) {
        const k = away;    // (already eased by riderAway: tray-riders.mjs carryEase)
        const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(), p1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), s1 = new THREE.Vector3();
        home.decompose(p0, q0, s0); up.decompose(p1, q1, s1);
        const q = q0.clone().slerp(q1, k), s = s0.clone().lerp(s1, k);
        let p;
        if (frame) {
            const box = new THREE.Box3().setFromObject(obj), size = box.isEmpty() ? new THREE.Vector3(0, 40, 0) : box.getSize(new THREE.Vector3());
            const toDesk = v => v.clone().applyMatrix4(frame.inv).toArray(), scale = frame.m.matrixWorld.getMaxScaleOnAxis() || 1;
            const path = carryPath(toDesk(p0), toDesk(p1), { up: frame.up, desk: frame.desk, half: size.y / 2 / scale });
            p = new THREE.Vector3().fromArray(path.at(k)).applyMatrix4(frame.m.matrixWorld);
        } else p = p0.clone().lerp(p1, k);
        return new THREE.Matrix4().compose(p, q, s);
    }
    function wrap() {
        const s = stow(); if (!s || wrapped) return;
        const own = Object.prototype.hasOwnProperty.call(s, 'update') ? s.update : null, base = s.update;
        stowUpdate = base;
        s.update = function (r) { if (r === desk()) unapply(); const out = base.call(this, r); if (r === desk()) place(r); return out; };
        wrapped = { s, own };
    }
    function unwrap() { if (!wrapped) return; const { s, own } = wrapped; if (own) s.update = own; else delete s.update; wrapped = null; }

    return {
        // track: { seconds, tiltAt } (a new object whenever the chapter's desk movement changes: the timeline is walked again then only)
        apply(seconds, next) {
            if (next !== track) { track = next || null; timeline = track ? riderTimeline(track.tiltAt, track.seconds) : null; }
            now = Number.isFinite(seconds) ? seconds : 0;
            if (!active()) { unwrap(); unapply(); return; }
            wrap(); place(desk());
        },
        setTray(fn, hasRiders) {
            trayOf = typeof fn === 'function' ? fn : null; onTray = trayOf && typeof hasRiders === 'function' ? hasRiders : null;
            if (!trayOf) fades.dispose();
            if (!active()) { unwrap(); unapply(); }
        },
        setChapter(id) { chapterFades = fadesInChapter(id); if (!fading()) fades.dispose(); },
        fading,
        awayAt: s => riderAway(timeline, s),
        timeline: () => timeline,
        overridden: () => [...over.keys()],
        restore() { unapply(); fades.dispose(); unwrap(); track = null; timeline = null; trayOf = null; onTray = null; chapterFades = false; },
    };
}
