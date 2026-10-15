import * as THREE from 'three';

// Frame pacing for the main viewer. The animation loop used to draw the whole
// scene at the display's refresh rate (144 Hz on a gaming monitor) and redraw
// every shadow on every frame, even when nothing moved. Large rooms are well
// over a thousand draw calls plus the shadow pass, so that kept the GPU and
// the browser's main thread saturated and made editing feel sluggish.
//
// plan() decides, per animation-loop tick, whether to draw at all and whether
// the shadow map must be redrawn:
// - Active (recent input, camera moving, anything animating): at most `fps`.
// - Idle: a slow `idleInterval` trickle, so async loads still appear.
// - Shadows: the key light's shadow camera is fitted to the room, so orbiting
//   does not change them. They redraw while objects move, briefly after a
//   discrete edit (click, key, slider), when wall or ceiling cutaways flip, and
//   on a slow `shadowInterval` fallback for anything not tracked here.
// Callers set renderer.shadowMap.autoUpdate from plan().shadows only around
// their own render, so any other render (tests, captures) stays exact.
export class RenderPacing {
    constructor({ controls, fps = 60, idleInterval = 100, shadowInterval = 1000, activeFor = 1500, editFor = 300 }) {
        Object.assign(this, { fps, idleInterval, shadowInterval, activeFor, editFor });
        this.nextAt = 0; this.lastInput = -Infinity; this.lastEdit = -Infinity; this.lastCamera = -Infinity;
        this.lastShadow = -Infinity; this.signature = null; this.orbiting = false; this.idle = false;
        const now = () => performance.now();
        const edit = () => { this.lastInput = this.lastEdit = now(); };
        for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'click', 'input', 'change']) window.addEventListener(type, edit, { capture: true, passive: true });
        // Hover and wheel keep the frame rate up; only a held drag that is not
        // an orbit counts as an edit that can move shadow casters.
        window.addEventListener('pointermove', e => { this.lastInput = now(); if (e.buttons && !this.orbiting) this.lastEdit = this.lastInput; }, { capture: true, passive: true });
        window.addEventListener('wheel', () => { this.lastInput = now(); }, { capture: true, passive: true });
        controls?.addEventListener('start', () => { this.orbiting = true; });
        controls?.addEventListener('end', () => { this.orbiting = false; });
        controls?.addEventListener('change', () => { this.lastCamera = now(); });
    }
    // Forces the next tick to draw everything, shadows included.
    invalidate() { this.nextAt = 0; this.lastShadow = -Infinity; }
    // animating: something on screen changes without moving shadow casters.
    // moving: shadow casters are moving. signature: anything whose change
    // alters the shadow (cutaway visibility). Returns null to skip the tick.
    plan(time, { animating = false, moving = false, signature = null } = {}) {
        const active = moving || animating || time - this.lastInput < this.activeFor || time - this.lastCamera < this.activeFor;
        const interval = active ? 1000 / this.fps : this.idleInterval;
        // Waking from idle draws immediately instead of finishing the idle wait.
        if (active && this.nextAt - time > interval) this.nextAt = time;
        // 1 ms tolerance keeps a 60 Hz display from dropping every other frame.
        if (time < this.nextAt - 1) return null;
        this.nextAt = Math.max(this.nextAt + interval, time);
        const resumed = this.idle && active; this.idle = !active;
        const flipped = signature !== this.signature; this.signature = signature;
        const shadows = moving || flipped || time - this.lastEdit < this.editFor || time - this.lastShadow >= this.shadowInterval;
        if (shadows) this.lastShadow = time;
        return { active, resumed, shadows };
    }
}

// Shadows from screws, washers and other tiny parts are smaller than a texel
// of the room's shadow map, yet each one is a separate draw in the shadow
// pass. A large room carried several hundred of these (the desk alone ~600).
// Each mesh is checked once, by its world-space size, after it has rendered
// with a current world matrix. Instanced and skinned meshes keep their flag.
const checked = new WeakSet(), box = new THREE.Box3(), size = new THREE.Vector3();
export function pruneTinyCasters(root, minSize = .05) {
    let pruned = 0;
    root.traverse(o => {
        if (!o.isMesh || checked.has(o)) return;
        checked.add(o);
        if (!o.castShadow || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).isEmpty()) return;
        box.getSize(size);
        if (Math.max(size.x, size.y, size.z) < minSize) { o.castShadow = false; o.userData.tinyShadowCaster = true; pruned++; }
    });
    return pruned;
}
