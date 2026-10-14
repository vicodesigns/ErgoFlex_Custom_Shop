import * as THREE from 'three';

// Additive light pools: the visible landing of lamp, screen and fixture light
// without spending real lights or shadow maps. Pools live in one overlay layer
// (no collider, no Groove obstacle, no ray hits, ignored by drop-to-surface).
// A pool owned by a furnishing copies that furnishing's world transform each
// frame, so it follows moves and hides with cutaway walls. Levels are either a
// per-daypart array [morning, afternoon, evening, night, party] or a function
// of the daypart index, evaluated by apply().
let MAP = null;
function poolMap() {
    if (MAP) return MAP;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ffffffc8'); g.addColorStop(.55, '#ffffff5c'); g.addColorStop(.8, '#ffffff16'); g.addColorStop(1, '#ffffff00');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    MAP = new THREE.CanvasTexture(canvas); MAP.colorSpace = THREE.SRGBColorSpace; MAP.wrapS = MAP.wrapT = THREE.ClampToEdgeWrapping; return MAP;
}
const noRay = () => {};
export const POOL_FACES = { floor: [-Math.PI / 2, 0, 0], back: [0, 0, 0], left: [0, Math.PI / 2, 0], right: [0, -Math.PI / 2, 0] };
export const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];

export function createPoolLayer(root, name = 'Light pools') {
    const group = new THREE.Group(); group.name = name; group.userData.grooveMarker = true; group.userData.presentationOnly = true; root.add(group);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const api = {
        group,
        add(parent, at, [sx, sy], color, levels, face = 'floor', geometry = null) {
            const m = new THREE.MeshBasicMaterial({ map: poolMap(), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            m.userData.sharedTextures = true;
            const o = new THREE.Mesh(geometry || new THREE.PlaneGeometry(1, 1), m); o.name = 'Light pool';
            if (!geometry) o.scale.set(sx, sy, 1);
            o.position.set(...at); o.rotation.set(...(Array.isArray(face) ? face : POOL_FACES[face]));
            o.renderOrder = 2; o.castShadow = o.receiveShadow = false; o.raycast = noRay;
            o.userData.lightPool = { color: new THREE.Color(color), levels };
            if (parent && parent !== root) {
                o.updateMatrix(); const local = o.matrix.clone();
                o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false;
                o.onBeforeRender = () => {
                    let shown = true; for (let q = parent; q; q = q.parent) if (!q.visible) { shown = false; break; }
                    o.matrixWorld.multiplyMatrices(parent.matrixWorld, shown && parent.parent ? local : zero);
                };
            }
            group.add(o); return o;
        },
        apply(phase, gain = 1) {
            const i = typeof phase === 'number' ? phase : Math.max(0, PHASES.indexOf(phase));
            for (const o of group.children) {
                const u = o.userData.lightPool; if (!u) continue;
                const v = (typeof u.levels === 'function' ? u.levels(i) : u.levels[i]) * gain;
                o.material.color.copy(u.color).multiplyScalar(v); o.visible = v > .003;
            }
        }
    };
    return api;
}
