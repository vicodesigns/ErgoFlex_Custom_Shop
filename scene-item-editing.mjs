import * as THREE from 'three';

export const localPose = o => ({ p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray() });
export function applyPose(o, t) { o.position.fromArray(t.p); o.quaternion.fromArray(t.q); o.scale.fromArray(t.s); o.updateMatrixWorld(true); }
const walk = (o, fn, path = '') => { fn(o, path); o.children.forEach((c, i) => walk(c, fn, path ? path + '/' + i : String(i))); };
export const topLevelItems = objects => [...new Set(objects)].filter(o => o.parent && !objects.some(p => p !== o && (() => { for (let n = o.parent; n; n = n.parent) if (n === p) return true; return false; })()));

// Store references to the authored model and small node/finish snapshots, rather
// than embedding geometry and image data in browser storage for every paste.
export function nodeSnapshot(object) {
    const nodes = [];
    walk(object, (o, path) => nodes.push({ path, ...localPose(o), visible: o.visible,
        ...(o.isMesh ? { finishes: [].concat(o.material).map(m => ({ color: m.color?.getHex(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive?.getHex(), emissiveIntensity: m.emissiveIntensity })) } : {}) }));
    return nodes;
}
export function cloneItem(source, nodes = null) {
    const copy = source.clone(true), snapshots = new Map((nodes || nodeSnapshot(source)).map(n => [n.path, n]));
    const geometries = new Map(), materials = new Map(), textures = new Map();
    const texture = t => {
        if (!textures.has(t)) {
            const clone = t.clone();
            if (t.image?.tagName === 'CANVAS') { const c = document.createElement('canvas'); c.width = t.image.width; c.height = t.image.height; c.getContext('2d').drawImage(t.image, 0, 0); clone.image = c; }
            clone.needsUpdate = true; textures.set(t, clone);
        }
        return textures.get(t);
    };
    walk(copy, (o, path) => {
        const snap = snapshots.get(path); if (snap) { applyPose(o, snap); o.visible = snap.visible; }
        o.userData = { ...o.userData, sceneAsset: false, sharedProp: false };
        for (const key of ['editorId', 'sceneAssetKey', 'sceneAssetCustom', 'deskObject', 'accessoryId', 'dailyDelta', 'dressPhases', 'dailyInput', 'dayKit', 'copySource', 'sceneCopyRecipe']) delete o.userData[key];
        if (o.geometry) { if (!geometries.has(o.geometry)) geometries.set(o.geometry, o.geometry.clone()); o.geometry = geometries.get(o.geometry); }
        if (o.material) {
            const convert = (m, i) => {
                if (!materials.has(m)) { const c = m.clone(); c.userData = { ...c.userData, sharedTextures: false }; for (const [k, v] of Object.entries(c)) if (v?.isTexture) c[k] = texture(v); materials.set(m, c); }
                const c = materials.get(m), finish = snap?.finishes?.[i];
                if (finish) for (const [key, value] of Object.entries(finish)) { if (value == null) continue; if (c[key]?.isColor) c[key].setHex(value); else c[key] = value; }
                return c;
            };
            o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material, 0);
        }
    });
    return copy;
}

export class DoubleItemTap {
    constructor() { this.last = null; }
    test(key, e) { const p = this.last; this.last = null; return !!p && p.key === key && performance.now() - p.time < 450 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 24; }
    remember(key, e, moved) { this.last = !moved && e ? { key, time: performance.now(), x: e.clientX, y: e.clientY } : null; }
}

// Keep the original parents intact. Moving an empty proxy forwards its world
// delta to the selected items; mounts, daily staging and save IDs stay valid.
export class ItemGizmo {
    constructor({ control, scene, canvas, before, commit, changed }) {
        Object.assign(this, { control, scene, canvas, before, commit, changed });
        this.proxy = new THREE.Group(); this.proxy.name = 'Selected item gumball'; scene.add(this.proxy);
        control.addEventListener('objectChange', () => this.move());
        control.addEventListener('dragging-changed', e => {
            if (!this.active || control.object !== this.proxy) return;
            if (e.value) {
                this.proxy.updateMatrixWorld(true);
                this.drag = { inverse: this.proxy.matrixWorld.clone().invert(), items: this.objects.map(obj => { obj.updateWorldMatrix(true, false); return { obj, matrix: obj.matrixWorld.clone() }; }), edit: before(this.active) };
            } else this.finish();
        });
    }
    open(selection) { this.close(); this.active = selection; this.objects = topLevelItems(selection.objects); if (!this.objects.length) { this.active = null; return false; } this.center(); this.control.setMode('unified'); this.control.attach(this.proxy); return true; }
    center() { const box = new THREE.Box3(); this.objects.forEach(o => box.expandByObject(o)); box.getCenter(this.proxy.position); this.proxy.quaternion.identity(); this.proxy.scale.setScalar(1); this.proxy.updateMatrixWorld(true); }
    move() {
        if (!this.drag || this.control.object !== this.proxy) return;
        this.proxy.scale.max(new THREE.Vector3(.01,.01,.01));
        this.proxy.updateMatrixWorld(true); const delta = this.proxy.matrixWorld.clone().multiply(this.drag.inverse);
        for (const { obj, matrix } of this.drag.items) { if (!obj.parent) continue; obj.parent.updateWorldMatrix(true, false); obj.parent.matrixWorld.clone().invert().multiply(delta).multiply(matrix).decompose(obj.position, obj.quaternion, obj.scale); obj.updateMatrixWorld(true); }
        this.changed?.(this.active);
    }
    finish() { const d = this.drag; if (!d) return; this.drag = null; this.commit(this.active, d.edit); if (this.active) this.center(); }
    close() { if(this.control.dragging)this.control.controls.forEach(c=>{if(c.dragging)c.pointerUp({button:0});}); this.finish(); if (this.control.object === this.proxy) this.control.detach(); this.active = null; this.objects = []; }
    ownsPointer(e) {
        if (!this.active || e.target !== this.canvas || e.button !== 0) return false;
        if (this.control.dragging) return true;
        const r = this.canvas.getBoundingClientRect(), p = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1, button: e.button };
        this.control.controls.forEach(c => c.pointerHover(p));
        return this.control.axis !== null;
    }
}
