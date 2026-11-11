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

// Real window sun: one shadow-casting SpotLight per room, placed outside the
// window on the key light's direction, its cookie (SpotLight.map) the window's
// panes, glazing bars and optional blind slats as seen from the light. It
// lights what stands in it (floor, rug, desk side, chair) and they shadow it.
// It is on only in daylight dayparts; while it is on, the room's key light is
// scaled by keyScale[phase] so the frame's overall exposure stays put.
//   levels: { phase: [colour, intensity] }   slats: { phase: open fraction 0..1 } (omit = no blind)
const SUN_LEVELS = { morning: ['#ffd7a3', 2.2], afternoon: ['#fff1dc', 1.5], evening: ['#ffa05a', 2.4], night: ['#000000', 0], party: ['#000000', 0] };
function findKey(root) {
    let top = root; while (top.parent) top = top.parent;
    let key = null; top.traverse(o => { if (!key && o.isDirectionalLight && o.castShadow) key = o; }); return key;
}
export function createSunLight(root, layout, windows, { levels = SUN_LEVELS, slats = {}, keyScale = { morning: .8, afternoon: .85, evening: .8 }, angles = null, bar = 38, mapSize = 1024 } = {}) {
    const light = new THREE.SpotLight('#ffffff', 0, 0, .5, 0, 0);
    light.name = 'Window sun'; light.castShadow = true; light.visible = false;
    light.shadow.mapSize.set(mapSize, mapSize); light.shadow.bias = -.0004; light.shadow.radius = 3; light.shadow.blurSamples = 8;
    light.userData.presentationOnly = true;
    root.add(light); root.add(light.target);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const cookie = new THREE.CanvasTexture(canvas); cookie.colorSpace = THREE.SRGBColorSpace; light.map = cookie;
    const dir = new THREE.Vector3(), centre = new THREE.Vector3(), p = new THREE.Vector3();
    const corners = win => {
        const at = (u, h) => win.wall === 'back' ? new THREE.Vector3(u, h, win.at) : new THREE.Vector3(win.at, h, u);
        return [at(win.from, win.bottom), at(win.to, win.bottom), at(win.to, win.top), at(win.from, win.top)];
    };
    let key = null, keySet = null, keyBase = null;
    const api = {
        light,
        update(phase, gain = 1) {
            const [color, intensity] = levels[phase] || [0, 0], lit = root.userData.lighting;
            key ??= findKey(root);
            const on = intensity > 0 && lit?.direction && lit.mode === phase;
            // Restore or scale the key: the Studio resets it before each
            // atmosphere call, so only scale a value it set, never our own.
            if (key) {
                if (key.intensity !== keySet) keyBase = key.intensity;
                if (keyBase != null) { key.intensity = keyBase * (on ? keyScale[phase] ?? 1 : 1); keySet = key.intensity; }
            }
            light.visible = !!on; if (!on) return;
            dir.fromArray(lit.direction).normalize();
            const own = angles?.[phase];
            if (own) {
                const out = layout.daylight ? [Math.sign(layout.daylight[0]), 0] : [0, -1];
                dir.set(out[0] - out[1] * own.sweep, own.elevation, out[1] + out[0] * own.sweep).normalize();
            }
            const all = windows.flatMap(corners);
            centre.set(0, 0, 0); all.forEach(c => centre.add(c)); centre.divideScalar(all.length);
            const D = 6000;
            light.position.copy(centre).addScaledVector(dir, D);
            light.target.position.copy(centre).addScaledVector(dir, -2000);
            const axis = light.target.position.clone().sub(light.position).normalize();
            let angle = 0; for (const c of all) angle = Math.max(angle, axis.angleTo(p.copy(c).sub(light.position)));
            light.angle = Math.min(1.2, angle * 1.12 + .01); light.penumbra = 0;
            const s = root.scale.x, diag = Math.hypot(layout.width, layout.depth, layout.height);
            light.shadow.camera.near = Math.max(.01, (D - 800) * s); light.shadow.camera.far = (D + diag * 1.6) * s;
            light.shadow.camera.updateProjectionMatrix();
            root.updateWorldMatrix(true, true); light.updateMatrixWorld(true); light.target.updateMatrixWorld(true);
            light.shadow.updateMatrices(light);
            const cam = light.shadow.camera, W = canvas.width, g = canvas.getContext('2d');
            g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
            const proj = v => { p.copy(v); root.localToWorld(p); p.project(cam); return [(p.x * .5 + .5) * W, (1 - (p.y * .5 + .5)) * W]; };
            const quad = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
            const open = slats[phase];
            g.filter = 'blur(1.5px)';
            for (const win of windows) {
                const cols = (win.bars ?? 1) + 1, rows = win.rows ?? 1, du = (win.to - win.from) / cols, dh = (win.top - win.bottom) / rows;
                const at = (u, h) => win.wall === 'back' ? new THREE.Vector3(u, h, win.at) : new THREE.Vector3(win.at, h, u);
                for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
                    const u0 = win.from + i * du + (i ? bar / 2 : 0), u1 = win.from + (i + 1) * du - (i < cols - 1 ? bar / 2 : 0);
                    const h0 = win.bottom + j * dh + (j ? bar / 2 : 0), h1 = win.bottom + (j + 1) * dh - (j < rows - 1 ? bar / 2 : 0);
                    if (open == null) { quad([at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)].map(proj), '#fff'); continue; }
                    // Blind slats: 64 mm pitch, the open fraction lets light between them.
                    for (let h = h0; h < h1; h += 64) quad([at(u0, h), at(u1, h), at(u1, Math.min(h1, h + 64 * open)), at(u0, Math.min(h1, h + 64 * open))].map(proj), '#fff');
                }
            }
            cookie.needsUpdate = true;
            light.color.set(color); light.intensity = intensity * gain;
        }
    };
    return api;
}
