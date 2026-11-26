// The keyboard / mouse cross-fade (rider-handoff.mjs, docs/keyboard-tray/SPEC.md 0.3): for the length of one hand-off the rider itself (at
// its tray / desk place) fades out while a copy at its shelf place fades in. Nothing moves.
//
//   const f = createRiderFade();
//   f.show(obj, { parent, matrix }, a)   a = the shelf copy's opacity (0..1, exclusive); obj gets 1 - a
//   f.hide()                             copies out of the scene, obj's own materials and shadow flags back (call before anything reads obj)
//   f.dispose()                          hide() and free the fade materials (hand-off over)
//
// The rider's own materials are NEVER written: while it fades its meshes wear clones (so nothing sharing a material turns transparent),
// and hide() puts the very same material objects back, so opacity / transparent / depthWrite are exactly as before.
// So that a half-faded keyboard does not show its own insides, every faded mesh first lays down its depth (no colour); only its nearest
// surface is then blended. Depth is still tested, so the desk in front of a copy hides it as it does the solid one.
import * as THREE from 'three';

export const FADE_COPY_NAME = 'Rider fade copy';
const ORDER = 900;      // after the room's other see-through things; the depth pass first, the colour right after it

// Material.clone() leaves out the shader hooks a film pass may have put on this very material.
function cloneOf(source) {
    const c = source.clone();
    for (const k of ['onBeforeCompile', 'customProgramCacheKey', 'onBeforeRender']) if (Object.prototype.hasOwnProperty.call(source, k)) c[k] = source[k];
    return c;
}
// part = { source, material }: the clone at opacity k.
function dim({ source, material }, k) {
    if (source.isShaderMaterial) { material.visible = source.visible && k >= 0.5; return; }     // (its own shader may ignore opacity)
    material.opacity = source.opacity * k; material.transparent = true; material.depthWrite = source.depthWrite;
    if (source.alphaTest > 0) material.alphaTest = source.alphaTest * k;
}
const depthOf = source => {
    const m = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true, side: source.side, map: source.alphaTest > 0 ? source.map || null : null,
        alphaMap: source.alphaMap || null, alphaTest: source.alphaTest || 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    m.visible = source.visible && !source.isShaderMaterial && source.depthWrite && !(source.transparent && source.opacity < 1);
    return m;
};
// What it takes for a mesh to wear fade clones: the clones and its depth pass (a child, drawn first).
function dress(mesh) {
    const own = mesh.material, list = [].concat(own), parts = list.map(source => ({ source, material: cloneOf(source) })), depths = list.map(depthOf);
    const depth = new THREE.Mesh(mesh.geometry, Array.isArray(own) ? depths : depths[0]);
    depth.name = 'Rider fade depth'; depth.userData.riderDepth = true; depth.castShadow = false; depth.receiveShadow = false; depth.renderOrder = ORDER;
    depth.raycast = () => {};
    return { mesh, own, parts, depths, depth, worn: Array.isArray(own) ? parts.map(p => p.material) : parts[0].material };
}
function wear(d, k, castShadow) {
    for (const p of d.parts) dim(p, k);
    d.mesh.material = d.worn; d.mesh.add(d.depth);
    d.mesh.renderOrder = ORDER + 1;
    d.mesh.castShadow = castShadow;
}
const meshesOf = obj => {
    const out = [], visit = o => {
        if (o !== obj && !o.visible) return;
        if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.material && !o.userData.riderDepth) out.push(o);
        for (const c of o.children) visit(c);
    };
    visit(obj); return out;
};
const keyOf = meshes => meshes.map(o => o.uuid + ':' + [].concat(o.material).map(x => x.uuid).join()).join('|');

export function createRiderFade() {
    const made = new Map();     // obj -> { key, real: [dressed], ghost, copy: [dressed], flags: the real meshes' own flags while worn, else null }
    function build(obj, meshes) {
        obj.updateWorldMatrix(true, true);
        const inverse = obj.matrixWorld.clone().invert(), ghost = new THREE.Group();
        ghost.name = FADE_COPY_NAME; ghost.userData.riderFadeOf = obj.userData.accessoryId || obj.name || 'rider'; ghost.matrixAutoUpdate = false;
        const copy = meshes.map(o => {
            const m = new THREE.Mesh(o.geometry, o.material);
            m.name = o.name; m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(inverse, o.matrixWorld); m.receiveShadow = o.receiveShadow; m.layers.mask = o.layers.mask;
            ghost.add(m);
            return { ...dress(m), cast: o.castShadow };
        });
        return { key: keyOf(meshes), real: meshes.map(dress), ghost, copy, flags: null };
    }
    function off(e) {
        if (!e.flags) return;
        e.ghost.removeFromParent();
        for (const d of e.copy) d.depth.removeFromParent();
        e.real.forEach((d, i) => { d.depth.removeFromParent(); d.mesh.material = d.own; d.mesh.castShadow = e.flags[i].castShadow; d.mesh.renderOrder = e.flags[i].renderOrder; });
        e.flags = null;
    }
    function free(e) { off(e); for (const d of [...e.real, ...e.copy]) { for (const p of d.parts) p.material.dispose(); for (const m of d.depths) m.dispose(); } }
    return {
        show(obj, shelf, a) {
            let e = made.get(obj);
            if (e) off(e);
            const meshes = meshesOf(obj);
            if (!e || e.key !== keyOf(meshes)) { if (e) free(e); e = build(obj, meshes); made.set(obj, e); }
            // the app may animate a rider's materials (lights, glow): the clones follow them, then take the fade
            for (const d of [...e.real, ...e.copy]) for (const p of d.parts) p.material.copy(p.source);
            e.flags = e.real.map(d => ({ castShadow: d.mesh.castShadow, renderOrder: d.mesh.renderOrder }));
            // one shadow at a time: from whichever of the two is the more solid
            e.real.forEach((d, i) => wear(d, 1 - a, e.flags[i].castShadow && a <= 0.5));
            for (const d of e.copy) wear(d, a, d.cast && a > 0.5);
            e.ghost.matrix.copy(shelf.matrix); shelf.parent.add(e.ghost); e.ghost.updateMatrixWorld(true);
        },
        hide() { for (const e of made.values()) off(e); },
        dispose() { for (const e of made.values()) free(e); made.clear(); },
        count: () => [...made.values()].filter(e => e.flags).length,
    };
}
