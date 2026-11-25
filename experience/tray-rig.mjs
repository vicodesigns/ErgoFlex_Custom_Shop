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
// Rest pose (every joint 0): the pivots keep the transforms the glb has and the riders get their own transforms back exactly, so a
// tray that has not started to move is the rigid tray. Nothing is written to the desk's saved state (item.saved): the riders'
// transforms are runtime overrides, put back by restore().
import * as THREE from 'three';
import { accessory } from '../catalog.mjs';
import { sampleTray, isRestPose, riderThicknessMm, trayBracket } from './tray-pose.mjs';
import { SLIDE_TRAVEL_MM, TRAY_SKEW_DEG, BRACKET } from './tray-limits.mjs';

export const RIGID_ID = 'ergoflex-keyboard-tray', RIG_ID = 'ergoflex-keyboard-tray-rig', TRAY_ITEM = 'accessory-keyboard-tray';
const PIVOTS = ['Tray_Drop', 'Tray_Slide', 'Tray_Swing', 'Tray_Tilt'];
export const BRACKET_NAME = 'Tray_MountBracket';
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

    // The pivots of one rig model, with the transforms the glb gave them (the joints are offsets from these).
    function pivotsOf(model) {
        const out = {};
        for (const name of PIVOTS) { const n = model.getObjectByName(name); if (n) out[name] = { node: n, position: n.position.clone(), quaternion: n.quaternion.clone(), scale: n.scale.clone() }; }
        return out;
    }
    // The pose of the rig's joints. pose = tray-pose.mjs { slide, swing, tilt, drop }: mm / degrees as the model has them.
    // Node units are the glb's (metres under a x1000 root).
    function pose(p, pivots) {
        const { Tray_Drop: drop, Tray_Slide: slide, Tray_Swing: swing, Tray_Tilt: tilt } = pivots;
        if (drop) drop.node.position.copy(drop.position).addScaledVector(Y, -p.drop / 1000);
        if (slide) slide.node.position.copy(slide.position).addScaledVector(Z.clone().applyQuaternion(slide.quaternion), -p.slide * SLIDE_TRAVEL_MM / 1000);
        if (swing) swing.node.quaternion.copy(swing.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(Y, p.swing * RAD));            // + = the plate's front to the user's right
        if (tilt) tilt.node.quaternion.copy(tilt.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, -p.tilt * RAD));              // + = front edge up
    }
    // The optional mount bracket (an edit's `bracket: true`; Vico's Inspector switch): a plain block that hangs from the desktop underside to the
    // track once the tray is dropped. Built here at runtime, never in the glb: off, the scene has exactly the original model's meshes.
    function addBracket(i, source) {
        if (i.bracket || !source) return;
        const geo = new THREE.BoxGeometry(BRACKET.width / 1000, 1, BRACKET.length / 1000); geo.translate(0, -0.5, 0);      // 1 m tall, top at y 0 (units of the glb: metres)
        const mat = source.clone(); mat.userData.sharedTextures = true;
        const mesh = new THREE.Mesh(geo, mat); mesh.name = BRACKET_NAME; mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
        mesh.position.set(BRACKET.at[0] / 1000, BRACKET.at[1] / 1000, BRACKET.at[2] / 1000); mesh.quaternion.setFromAxisAngle(Y, -TRAY_SKEW_DEG * RAD);   // on the track's centre line, skewed like it
        mesh.scale.y = 1 / 1000; (i.model.getObjectByName('Tray') || i.model).add(mesh); i.bracket = mesh;
    }
    function removeBracket(i) {
        const m = i?.bracket; if (!m) return; i.bracket = null; m.removeFromParent(); m.geometry.dispose(); m.material.dispose();
    }
    const sourceMaterial = i => { let m = null; i.rigid.traverse(o => { if (!m && o.isMesh) m = [].concat(o.material)[0]; }); return m; };
    // Rest-pose offsets of the things standing on the plate, in the plate's frame (nothing of them is saved).
    function findRiders(rigRoot, plate) {
        rigRoot.updateWorldMatrix(true, true);
        const toRig = rigRoot.matrixWorld.clone().invert(), plateBox = new THREE.Box3();
        plate.geometry.computeBoundingBox(); plateBox.copy(plate.geometry.boundingBox).applyMatrix4(toRig.clone().multiply(plate.matrixWorld));
        const inverse = plate.matrixWorld.clone().invert(), riders = [], centre = new THREE.Vector3(), box = new THREE.Box3();
        for (const item of desk()?.objects?.values() || []) {
            const obj = item.obj, acc = riderOf(obj);
            if (!acc || item.saved?.removed || !obj.visible || obj.userData.stowHidden || item.autoStow) continue;
            obj.updateWorldMatrix(true, true);
            box.setFromObject(obj); if (box.isEmpty()) continue;
            box.getCenter(centre).applyMatrix4(toRig);
            // standing on the plate: over its footprint, within 60 mm above its top (spec 6.3)
            if (centre.x < plateBox.min.x || centre.x > plateBox.max.x || centre.z < plateBox.min.z || centre.z > plateBox.max.z || centre.y < plateBox.max.y - 5 || centre.y > plateBox.max.y + 60) continue;
            riders.push({ obj, propId: acc.propId, offset: inverse.clone().multiply(obj.matrixWorld), own: { position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone() } });
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
        const plate = model.getObjectByName('Tray_Plate'), pivots = pivotsOf(model);
        installed = { item, tray, rigid, model, pivots, plate, bracket: null, riders: plate ? findRiders(model, plate) : [] };
        if (trayBracket(edit)) addBracket(installed, source);
        return true;
    }
    function uninstall() {
        const i = installed; installed = null; last = null;
        if (!i) return;
        removeBracket(i);
        for (const r of i.riders) { r.obj.position.copy(r.own.position); r.obj.quaternion.copy(r.own.quaternion); r.obj.scale.copy(r.own.scale); r.obj.updateMatrix(); }
        i.tray.remove(i.model); i.tray.add(i.rigid);
        disposerOf(api)?.(i.model);
    }
    const sameTray = () => installed && trayItem()?.obj === installed.tray && installed.model.parent === installed.tray;
    // The riders' thickness for the drop the tray needs under the desk (tray-limits.mjs RIDER_MM).
    const riderMm = () => installed ? riderThicknessMm(installed.riders.map(r => r.propId)) : 0;

    return {
        count: () => installed ? 1 : 0,
        pose: () => last ? { ...last } : null,
        riders: () => installed ? installed.riders.map(r => r.obj) : [],
        // Resolves true when the rig is in the scene (or already was), false when there is none to show (no tray on this desk, or
        // an edit that does not move it).
        set(next) {
            edit = next || null; const mine = ++token;
            chain = chain.then(async () => {
                if (mine !== token) return !!installed;
                if (!edit) { uninstall(); return false; }
                if (installed && !sameTray()) uninstall();     // the room was rebuilt under us: the old model is gone with it
                if (installed) { if (trayBracket(edit)) addBracket(installed, sourceMaterial(installed)); else removeBracket(installed); return true; }
                try { return await install(mine); } catch (error) { console.warn('[tray-rig]', error?.message || error); uninstall(); return false; }
            });
            return chain;
        },
        apply(seconds) {
            if (!installed || !edit) return null;
            if (!sameTray()) { uninstall(); return null; }
            const p = sampleTray(edit, seconds, { riderMm: riderMm() }); last = p;
            pose(p, installed.pivots);
            if (installed.bracket) { installed.bracket.scale.y = Math.max(p.drop, 1) / 1000; installed.bracket.visible = p.drop > 0.5; }   // sized to the drop: 1 mm and hidden at drop 0
            installed.model.updateWorldMatrix(true, true);
            const { riders, plate } = installed;
            if (isRestPose(p)) { for (const r of riders) { r.obj.position.copy(r.own.position); r.obj.quaternion.copy(r.own.quaternion); r.obj.scale.copy(r.own.scale); r.obj.updateMatrix(); } return p; }
            const world = new THREE.Matrix4(), local = new THREE.Matrix4();
            for (const r of riders) {
                const parent = r.obj.parent; if (!parent || r.obj.userData.stowHidden || !r.obj.visible) continue;
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
