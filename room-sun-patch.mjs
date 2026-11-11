import * as THREE from 'three';

// Window sun on the floor, cast along the room's real key light.
// configureRoomLightRig() publishes the key direction (room-local) in
// root.userData.lighting before a room's atmosphere runs, so the patch lands
// where that light's shadows say the sun comes from: low and long in the
// morning, short under the window at midday, long and golden in the evening,
// gone after dark. One additive quad per window, clipped to the floor; no
// lights, no shadow maps. Windows are in room millimetres:
//   { wall: 'back' | 'left' | 'right', at: wall plane (z for back, x for sides),
//     from, to: along the wall (x for back, z for sides), bottom, top, bars: mullion count }
// update(phase) uses levels[phase] = [colour, strength] (strength 0 hides it).
const PHASE_LEVELS = {
    morning: ['#ffdcae', .42], afternoon: ['#fff1da', .26], evening: ['#ff9d58', .5], night: ['#000000', 0], party: ['#000000', 0]
};
const MAPS = new Map();
function paneMap(bars, rows) {
    const key = bars + ':' + rows; if (MAPS.has(key)) return MAPS.get(key);
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d'); g.filter = 'blur(5px)'; g.fillStyle = '#ffffff';
    const m = 10, cols = bars + 1, cw = (256 - m * 2) / cols, rh = (256 - m * 2) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.fillRect(m + i * cw + 4, m + j * rh + 4, cw - 8, rh - 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; MAPS.set(key, t); return t;
}
// Sutherland-Hodgman against the floor rectangle, carrying uv.
function clip(poly, x0, x1, z0, z1) {
    const edges = [[p => p[0] - x0], [p => x1 - p[0]], [p => p[2] - z0], [p => z1 - p[2]]];
    for (const [f] of edges) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
            if (fa >= 0) out.push(a);
            if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(a.map((v, k) => v + (b[k] - v) * t)); }
        }
        poly = out; if (poly.length < 3) return [];
    }
    return poly;
}
// angles (optional): { phase: { elevation, sweep } } for rooms whose key light
// keeps one broad angle through the day (the workshop); same convention as the rig.
export function createSunPatch(root, layout, windows, { levels = PHASE_LEVELS, angles = null, y = 9, inset = 30 } = {}) {
    const group = new THREE.Group(); group.name = 'Window sun on the floor'; group.userData.grooveMarker = true; group.userData.presentationOnly = true; root.add(group);
    const x0 = (layout.left ?? -layout.width / 2) + inset, x1 = x0 + layout.width - inset * 2, z0 = layout.back + inset, z1 = layout.back + layout.depth - inset;
    const patches = windows.map(win => {
        const material = new THREE.MeshBasicMaterial({ map: paneMap(win.bars ?? 1, win.rows ?? 2), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true });
        material.userData.sharedTextures = true;
        const geometry = new THREE.BufferGeometry(), o = new THREE.Mesh(geometry, material);
        o.name = 'Window sun patch'; o.renderOrder = 2; o.castShadow = o.receiveShadow = false; o.raycast = () => {}; o.frustumCulled = false;
        group.add(o); return { win, o, geometry, material };
    });
    const dir = new THREE.Vector3();
    return {
        group,
        update(phase, gain = 1) {
            const [color, strength] = levels[phase] || levels.afternoon, lit = root.userData.lighting;
            const show = strength * gain > .003 && lit?.direction && lit.mode === phase;
            group.visible = !!show; if (!show) return;
            dir.fromArray(lit.direction).normalize();   // room-local, points from the room toward the sun
            const own = angles?.[phase];
            if (own) {
                const out = layout.daylight ? [Math.sign(layout.daylight[0]), 0] : [0, -1];
                dir.set(out[0] - out[1] * own.sweep, own.elevation, out[1] + out[0] * own.sweep).normalize();
            }
            if (dir.y < .05) { group.visible = false; return; }
            for (const { win, o, geometry, material } of patches) {
                // A window corner at height h lands h / dir.y along -dir from the wall.
                const corner = (u, h, uvx, uvy) => {
                    const p = win.wall === 'back' ? [u, h, win.at] : [win.at, h, u], t = h / dir.y;
                    return [p[0] - dir.x * t, y, p[2] - dir.z * t, uvx, uvy];
                };
                const inward = win.wall === 'back' ? -dir.z : win.wall === 'left' ? -dir.x : dir.x;
                if (inward <= .02) { o.visible = false; continue; }
                const poly = clip([corner(win.from, win.bottom, 0, 0), corner(win.to, win.bottom, 1, 0), corner(win.to, win.top, 1, 1), corner(win.from, win.top, 0, 1)], x0, x1, z0, z1);
                o.visible = poly.length >= 3; if (!o.visible) continue;
                const pos = [], uv = [], index = [];
                for (const p of poly) { pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); }
                for (let i = 1; i < poly.length - 1; i++) index.push(0, i, i + 1);
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index);
                geometry.computeBoundingSphere();
                // Longer, lower sun spreads the same light over more floor.
                material.color.set(color).multiplyScalar(strength * gain * Math.min(1, .55 + dir.y * .5));
            }
        }
    };
}
