// The keyboard and mouse between the desk (or the keyboard tray) and the desk's shelf unit, on the stage and in the film render
// (docs/keyboard-tray/SPEC.md 0.3). The desk's auto-stow (desk-auto-stow.mjs) still decides the shelf PLACE and puts them there when the
// desktop tilts past 9 deg; this layer only changes WHEN and HOW they are seen to get there:
//   * when: by the chapter's desk-tilt timeline (tray-riders.mjs riderTimeline: leave above 9 deg, back below 7 deg), never by the tray;
//   * how: a 0.4 s eased lift-and-travel carry (tray-riders.mjs carryPath) instead of the pop, both ways;
//   * while they are on the shelf, the keyboard tray (tray-rig.mjs) leaves them alone and has its full range (Vico, 25 Nov 2026).
//
//   const h = createRiderHandoff(api)        api = window.ErgoFlex (sceneDesks)
//   h.apply(seconds, track)                  every frame (stage tick): track = { seconds, tiltAt(s) } of the chapter (stage deskTrack())
//   h.setTray(fn)                            the tray rig: fn(obj) -> the rider's world matrix on the plate now (null: not a rider)
//   h.awayAt(s)                              0 on the tray .. 1 on the shelf (the tray's limits, the Director's panel)
//   h.restore()                              everything back as the app has it
//
// Runtime only, like the rig and the stow: the items' saved state is never touched. The layer wraps the desk manager's stow.update so
// the stow always sees (and keeps) the items' own transforms: it takes its override off before the stow runs and puts it back after.
// A chapter whose desk never crosses 9 deg, with no keyboard tray rig, is never touched (no wrapper, no write).
import * as THREE from 'three';
import { accessory } from '../catalog.mjs';
import { riderTimeline, riderAway, carryPath } from './tray-riders.mjs';

const isRider = obj => { const a = obj?.userData?.accessoryId && accessory(obj.userData.accessoryId); return !!a && ['keyboard', 'mouse'].includes(a.exclusiveGroup); };
const SIZE = { '48x30': [48, 30], '60x30': [60, 30], '72x30': [72, 30] };

export function createRiderHandoff(api) {
    let track = null, timeline = null, now = 0, trayOf = null, wrapped = null;
    const over = new Map();     // obj -> { parent, position, quaternion, scale } its own transform while the layer overrides it
    const shelf = new WeakMap(); // obj -> { parent, matrix } where the stow put it last (kept for the way back, the stow lets go at 9 deg)
    const desk = () => api.sceneDesks?.active || null;
    const stow = () => api.sceneDesks?.objects?.stow || null;
    const active = () => !!trayOf || !!timeline?.events.length || timeline?.start === 'shelf';

    function unapply() {
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
        const away = riderAway(timeline, now), frame = away > 0 && away < 1 ? deskFrame(r) : null;
        for (const item of r.objects?.values() || []) {
            const obj = item.obj; if (!isRider(obj) || item.saved?.removed || item.autoStow?.hidden || !obj.parent) continue;
            const stowed = !!item.autoStow?.role;
            obj.updateWorldMatrix(true, false);
            if (stowed) shelf.set(obj, { parent: obj.parent, matrix: obj.matrix.clone() });
            const home = trayOf?.(obj) || (stowed ? authoredWorld(item) : obj.matrixWorld.clone());
            const kept = shelf.get(obj), up = kept && kept.parent.parent ? (kept.parent.updateWorldMatrix(true, false), kept.parent.matrixWorld.clone().multiply(kept.matrix)) : null;
            let target;
            if (away <= 0 || !up) target = home;                                   // on the desk / tray (or no shelf place known yet: as the app has it)
            else if (away >= 1) target = stowed ? null : up;                        // on the shelf (between 9 and 7 deg the stow has let go: hold it there)
            else target = carry(home, up, away, frame, obj);
            if (!target || !obj.visible && !stowed) continue;
            if (target.equals(obj.matrixWorld)) continue;
            write(obj, target);
        }
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
        setTray(fn) { trayOf = typeof fn === 'function' ? fn : null; if (!active()) { unwrap(); unapply(); } },
        awayAt: s => riderAway(timeline, s),
        timeline: () => timeline,
        overridden: () => [...over.keys()],
        restore() { unapply(); unwrap(); track = null; timeline = null; trayOf = null; },
    };
}
