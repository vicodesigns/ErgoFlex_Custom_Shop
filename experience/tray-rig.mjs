// The keyboard tray rig on the stage (docs/keyboard-tray/SPEC.md sections 3 and 7.1): swaps the rigid tray model for the
// articulated one while a chapter has tray keys, poses its pivots from tray-pose.mjs (the one sampler of the live stage and the
// film), and carries the keyboard and mouse that stand on the plate. Loaded only for such a chapter (stage.mjs, film-fx.mjs import it
// dynamically): a chapter without tray keys never gets here, so its scene is the one it always was.
//
//   const rig = createTrayRig(api);          api = window.ErgoFlex (sceneDesks, loadProp)
//   await rig.set(edit, preset)              edit = the chapter's tray edit (tray-pose.mjs activeTrayEdit); null / inactive = restore()
//   rig.apply(seconds)                       pose the pivots (and the riders) for this chapter second; every frame, after the desks'
//                                            own moves, the prop edits and the stow, so the riders ride the final plate matrix
//   rig.restore()                            the rigid model and the riders' own transforms back; safe to call any time
//   rig.count()                              1 while a rig is in the scene, else 0
//
// Rest pose (every joint 0): the pivots keep the transforms the glb has and the riders keep their own transforms exactly, so a
// tray that has not started to move is the rigid tray. Nothing is written to the desk's saved state (item.saved): the riders'
// transforms are runtime overrides, put back by restore().
//
// Riders (25 Nov 2026, SPEC.md 0.3): the keyboard and mouse that stand on the plate AS BUILT (found against the rest pose, wherever the
// desk's stow has them when the rig loads). Where they are is the desk tilt's business, never the tray's: on the stage and in the film
// the rider hand-off layer (rider-handoff.mjs, api.riderHandoff) places them (on the plate = rig.riderWorld, on the shelf, or carried
// between) and says how far away they are (awayAt) for the limits; a rider on the shelf leaves the tray its full range. Without that
// layer (node tests) the rig places them itself and never touches one the stow has put away.
import * as THREE from 'three';
import { accessory } from '../catalog.mjs';
import { sampleTray, isRestPose, riderThicknessMm } from './tray-pose.mjs';
import { SLIDE_TRAVEL_MM, TRAY_SKEW_DEG, BASE_TILT_AT, SURFACE_TILT_AT } from './tray-limits.mjs';

export const RIGID_ID = 'ergoflex-keyboard-tray', RIG_ID = 'ergoflex-keyboard-tray-rig', TRAY_ITEM = 'accessory-keyboard-tray';
const PIVOTS = ['Tray_Slide', 'Tray_Swing', 'Tray_BaseTilt', 'Tray_SurfaceTilt'];      // (Tray_Drop, the mount, has no joint: the drop was taken out)
export const BASE_PIVOT = 'Tray_BaseTilt', SURFACE_PIVOT = 'Tray_SurfaceTilt';
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const RAD = Math.PI / 180;
const riderOf = obj => { const a = obj?.userData?.accessoryId && accessory(obj.userData.accessoryId); return a && ['keyboard', 'mouse'].includes(a.exclusiveGroup) ? a : null; };

// window.ErgoFlex (the api the stage and film-fx hand in) has no loadProp / disposeObject of its own: they live on the desk manager's
// context (studio.js, SceneDesks ctx). Using api.loadProp alone made the rig install throw "loadProp is not a function" on the real page.
const loaderOf = api => (api.loadProp ? api.loadProp.bind(api) : api.sceneDesks?.ctx?.loadProp?.bind(api.sceneDesks.ctx)) || (() => { throw Error('no prop loader on the stage api'); });
const disposerOf = api => (api.disposeObject ? api.disposeObject.bind(api) : api.sceneDesks?.ctx?.disposeObject?.bind(api.sceneDesks.ctx));
export function createTrayRig(api) {
    let edit = null, installed = null, token = 0, chain = Promise.resolve(), last = null;
    const desk = () => api.sceneDesks?.active || null;
    const trayItem = () => desk()?.objects?.get(TRAY_ITEM) || null;

    // The two tilt pivots on the real bolts (25 Nov 2026, Vico's unit; SPEC.md 0.4), made at runtime so the glb stays the supplied model split:
    // Tray_BaseTilt at the rear bracket's upper bolt (under Tray_Swing; the arm Tray_Links and the platform group Tray_Tilt hang from it) and
    // Tray_SurfaceTilt at the arm's front bolt (under it; Tray_Tilt hangs from that). Both carry no rotation of their own beyond the track's
    // (as every pivot under Tray_Slide), so local X is the bolts' axis. Pure re-parenting: at rest every part is exactly where it was.
    function addTiltPivots(model) {
        const swing = model.getObjectByName('Tray_Swing'), links = model.getObjectByName('Tray_Links'), tilt = model.getObjectByName('Tray_Tilt'), root = model.getObjectByName('Tray') || model;
        if (!swing || !links || !tilt || model.getObjectByName(BASE_PIVOT)) return;
        model.updateWorldMatrix(true, true);
        const sk = TRAY_SKEW_DEG * RAD, at = ([u, y, w]) => root.localToWorld(new THREE.Vector3((u * Math.cos(sk) - w * Math.sin(sk)) / 1000, y / 1000, (u * Math.sin(sk) + w * Math.cos(sk)) / 1000));
        const make = (name, parent, world) => { const n = new THREE.Object3D(); n.name = name; parent.add(n); parent.updateWorldMatrix(true, false); n.position.copy(parent.worldToLocal(world.clone())); n.updateWorldMatrix(true, false); return n; };
        const base = make(BASE_PIVOT, swing, at(BASE_TILT_AT)); base.attach(links); base.attach(tilt);
        const surface = make(SURFACE_PIVOT, base, at(SURFACE_TILT_AT)); surface.attach(tilt);
    }
    // The pivots of one rig model, with the transforms the glb gave them (the joints are offsets from these).
    function pivotsOf(model) {
        const out = {};
        for (const name of PIVOTS) { const n = model.getObjectByName(name); if (n) out[name] = { node: n, position: n.position.clone(), quaternion: n.quaternion.clone(), scale: n.scale.clone() }; }
        return out;
    }
    // The pose of the rig's joints. pose = tray-pose.mjs { slide, swing, baseTilt, tilt }: fraction / degrees.
    // Node units are the glb's (metres under a x1000 root).
    function pose(p, pivots) {
        const { Tray_Slide: slide, Tray_Swing: swing, Tray_BaseTilt: base, Tray_SurfaceTilt: tilt } = pivots;
        if (base) base.node.quaternion.copy(base.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, -(p.baseTilt || 0) * RAD));  // + = the arm's front up
        if (slide) slide.node.position.copy(slide.position).addScaledVector(Z.clone().applyQuaternion(slide.quaternion), -p.slide * SLIDE_TRAVEL_MM / 1000);
        if (swing) swing.node.quaternion.copy(swing.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(Y, p.swing * RAD));            // + = the plate's front to the user's right
        if (tilt) tilt.node.quaternion.copy(tilt.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, -p.tilt * RAD));              // + = front edge up
    }
    // The pose the desk's stow took an item from (its own place on the desk), as a world matrix; null when it is not put away.
    const authoredWorld = item => { const a = item?.autoStow; if (!a?.parent || !a.transform) return null; const t = a.transform; a.parent.updateWorldMatrix(true, false);
        return a.parent.matrixWorld.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(t.p.x, t.p.y, t.p.z), new THREE.Quaternion(t.q.x, t.q.y, t.q.z, t.q.w), new THREE.Vector3(t.s.x, t.s.y, t.s.z))); };
    // Rest-pose offsets of the things standing on the plate as built, in the plate's frame (nothing of them is saved). A keyboard the
    // desk's stow has on the shelf right now (the rig loaded with the desk tilted) is taken where it stands on the desk.
    function findRiders(rigRoot, plate) {
        rigRoot.updateWorldMatrix(true, true);
        const toRig = rigRoot.matrixWorld.clone().invert(), plateBox = new THREE.Box3();
        plate.geometry.computeBoundingBox(); plateBox.copy(plate.geometry.boundingBox).applyMatrix4(toRig.clone().multiply(plate.matrixWorld));
        const inverse = plate.matrixWorld.clone().invert(), riders = [], centre = new THREE.Vector3(), box = new THREE.Box3();
        for (const item of desk()?.objects?.values() || []) {
            const obj = item.obj, acc = riderOf(obj);
            if (!acc || item.saved?.removed || !obj.visible || obj.userData.stowHidden || item.autoStow?.hidden) continue;
            obj.updateWorldMatrix(true, true);
            box.setFromObject(obj); if (box.isEmpty()) continue;
            const home = authoredWorld(item), world = home || obj.matrixWorld.clone();
            box.getCenter(centre); if (home) centre.applyMatrix4(obj.matrixWorld.clone().invert()).applyMatrix4(home);
            centre.applyMatrix4(toRig);
            // standing on the plate: over its footprint, within 60 mm above its top (spec 6.3)
            if (centre.x < plateBox.min.x || centre.x > plateBox.max.x || centre.z < plateBox.min.z || centre.z > plateBox.max.z || centre.y < plateBox.max.y - 5 || centre.y > plateBox.max.y + 60) continue;
            riders.push({ obj, item, propId: acc.propId, offset: inverse.clone().multiply(world), own: { parent: obj.parent, position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone() } });
        }
        return riders;
    }
    async function install(mine) {
        const item = trayItem(); if (!item) return false;
        await api.workspaceAccessories?.ready;
        const tray = item.obj, rigid = tray.getObjectByName('Prop:' + RIGID_ID);
        if (!rigid) return false;
        const model = await loaderOf(api)(RIG_ID);
        if (mine !== token || !model) { if (model) disposerOf(api)?.(model); return false; }
        model.position.copy(rigid.position); model.quaternion.copy(rigid.quaternion); model.scale.copy(rigid.scale);
        // the finish the rigid model has now (black, white, steel), as plain copies: this model's own materials, textures shared
        let source = null; rigid.traverse(o => { if (!source && o.isMesh) source = [].concat(o.material)[0]; });
        model.traverse(o => {
            if (!o.isMesh || !source) return;
            const mat = source.clone(); mat.userData.sharedTextures = true; o.material = mat; o.ownedMaterials = [mat];
        });
        tray.remove(rigid); tray.add(model); tray.updateWorldMatrix(true, true);
        addTiltPivots(model);
        const plate = model.getObjectByName('Tray_Plate'), pivots = pivotsOf(model);
        installed = { item, tray, rigid, model, pivots, plate, riders: plate ? findRiders(model, plate) : [] };
        api.riderHandoff?.setTray(riderWorld);
        return true;
    }
    function uninstall() {
        const i = installed; installed = null; last = null;
        if (!i) return;
        if (api.riderHandoff) api.riderHandoff.setTray(null);       // (the layer puts back what it moved)
        else for (const r of i.riders) ownBack(r);
        i.tray.remove(i.model); i.tray.add(i.rigid);
        disposerOf(api)?.(i.model);
    }
    const sameTray = () => installed && trayItem()?.obj === installed.tray && installed.model.parent === installed.tray;
    // The riders' thickness: what keeps the plate out from under the desk while they are on it (tray-limits.mjs RIDER_MM).
    const riderMm = () => installed ? riderThicknessMm(installed.riders.map(r => r.propId)) : 0;
    const ownBack = r => { if (r.obj.parent !== r.own.parent || r.item?.autoStow) return; r.obj.position.copy(r.own.position); r.obj.quaternion.copy(r.own.quaternion); r.obj.scale.copy(r.own.scale); r.obj.updateMatrix(); };
    // A rider's world matrix standing on the plate as it is posed now; null when obj is not a rider, or the tray is at rest (then the
    // rider's own place on the desk is exactly right: the rest pose is the rigid tray).
    function riderWorld(obj) {
        const r = installed?.riders.find(x => x.obj === obj); if (!r || !last || isRestPose(last)) return null;
        installed.plate.updateWorldMatrix(true, false);
        return new THREE.Matrix4().multiplyMatrices(installed.plate.matrixWorld, r.offset);
    }
    // How far the riders are from the plate at chapter second s (0 on it .. 1 on the desk's shelf): the hand-off layer's timeline, else
    // (no layer) 1 when the stow has them all put away.
    const awayAt = s => api.riderHandoff ? api.riderHandoff.awayAt(s) : installed?.riders.length && installed.riders.every(r => r.item?.autoStow) ? 1 : 0;

    return {
        count: () => installed ? 1 : 0,
        pose: () => last ? { ...last } : null,
        riders: () => installed ? installed.riders.map(r => r.obj) : [],
        riderWorld, awayAt,
        // Resolves true when the rig is in the scene (or already was), false when there is none to show (no tray on this desk, or
        // an edit that does not move it).
        set(next) {
            edit = next || null; const mine = ++token;
            chain = chain.then(async () => {
                if (mine !== token) return !!installed;
                if (!edit) { uninstall(); return false; }
                if (installed && !sameTray()) uninstall();     // the room was rebuilt under us: the old model is gone with it
                if (installed) return true;
                try { return await install(mine); } catch (error) { console.warn('[tray-rig]', error?.message || error); uninstall(); return false; }
            });
            return chain;
        },
        apply(seconds) {
            if (!installed || !edit) return null;
            if (!sameTray()) { uninstall(); return null; }
            const p = sampleTray(edit, seconds, { riderMm: riderMm(), riderAway: awayAt(seconds) }); last = p;
            pose(p, installed.pivots);
            installed.model.updateWorldMatrix(true, true);
            if (api.riderHandoff) return p;      // the riders: the hand-off layer places them, after this (stage tick / film frame)
            const { riders, plate } = installed;
            if (isRestPose(p)) { for (const r of riders) ownBack(r); return p; }
            const world = new THREE.Matrix4(), local = new THREE.Matrix4();
            for (const r of riders) {
                const parent = r.obj.parent; if (!parent || r.obj.userData.stowHidden || !r.obj.visible || r.item?.autoStow) continue;    // put away on the shelf: not the tray's
                parent.updateWorldMatrix(true, false);
                world.multiplyMatrices(plate.matrixWorld, r.offset);
                local.multiplyMatrices(parent.matrixWorld.clone().invert(), world).decompose(r.obj.position, r.obj.quaternion, r.obj.scale);
                r.obj.updateMatrix();
            }
            return p;
        },
        // The rigid model and the riders' own transforms back, now. An install still loading is cancelled (the token).
        restore() { token++; edit = null; uninstall(); },
    };
}
