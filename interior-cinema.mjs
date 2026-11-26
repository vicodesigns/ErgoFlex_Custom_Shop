import * as THREE from 'three';
import { INTERIOR_RECIPES } from './interior-cinema-rooms.mjs?v=interior-20261125a';

// Interior pass for the film and the Director (25 Nov 2026, branch director/fable-interior).
//
// The rooms were lit evenly: every wall the same value from skirting to ceiling, every corner as bright as the middle
// of the room. At film camera distances that reads as a model, not a place. This pass shapes the light the way a
// lighting cameraman would flag and wash a set, without spending real lights or shadow maps:
//
//   envelope   soft shade under the ceiling line, in the room's corners and along the skirting, and a falloff on the
//              floor toward the walls (dark, colour-tinted alpha quads: the "Daylight architectural contact" seams of
//              room-polish.mjs, a metre wide instead of 160 mm)
//   washes     additive light landing on walls: daylight raking in from the window end, scallops under wall washers
//              and picture lights, the glow above a lamp
//   pools      additive light landing on the floor under fixtures that are on in the film's daytime
//   finishes   small corrections to architectural materials (roughness, value separation between wall, trim and floor)
//   dressing   plain built pieces where a keyed camera looks at a bare wall or an empty corner
//
// Rules it keeps:
//   * Film and Director only (window.__ERGO_PRESENTATION__): the Studio's rooms are untouched. A room's Classic look
//     (room-looks.mjs) is a frozen version and gets no pass.
//   * OFF unless asked for (25 Nov 2026: only the coast room's recipe was seen in a still before the session was wound
//     up; the others are written from the rooms' measurements and not yet looked at). ?interior=1 on the Director's or
//     the stage's address switches it on, ?interior=1,-washes drops single layers (envelope, washes, pools, finishes,
//     dressing). To make it the default once the stills are approved: DEFAULT_ON below.
//   * Nothing here is a scene asset, a collider, a ray target or a Groove obstacle; nothing moves, hides or renames what
//     a room builds, so saved transforms, hides and the Director's prop edits keep their targets.
//   * No real lights. Overlays are transparent and do not write depth, so the film's ambient occlusion pass skips them
//     (film-quality.mjs) and they cost one draw each.
//   * The shade draws before every additive overlay (renderOrder .5; sun patch, lamp pools 2; desk LED floor light 3),
//     so the desk's LED light lands on top of it at full strength: the desk LED look is the visualizer's, unchanged.
//   * Wall overlays are children of their cutaway wall and vanish with it. They stand 50 to 60 mm off the wall plane
//     (flat wall decor is 2 to 40 mm deep and is shaded with its wall; anything deeper stands in front), far enough
//     apart in depth for a 4K frame.
//
// Dayparts: every layer has levels [morning, afternoon, evening, night, party]. They are applied from the room's
// atmosphere call, so the film's timeOfDay blend (film-tod.mjs snapshots uniforms, colours and opacities) carries them.

export const INTERIOR_LAYERS = ['envelope', 'washes', 'pools', 'finishes', 'dressing'];
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];

// ?interior=1 | ?interior=1,-washes,-dressing | ?interior=0 (the stage is an iframe of the Director page: either
// address counts)
export const DEFAULT_ON = false;
function readSwitch() {
    const off = new Set(); let all = DEFAULT_ON;
    const read = search => {
        const v = new URLSearchParams(search || '').get('interior'); if (v == null) return;
        for (const part of v.split(',')) {
            if (part === '0' || part === 'off') all = false; else if (part === '1' || part === 'on') all = true;
            else if (part.startsWith('-')) off.add(part.slice(1));
        }
    };
    try { read(globalThis.location?.search); } catch { /* no window (node tests) */ }
    try { if (globalThis.top && globalThis.top !== globalThis.self) read(globalThis.top.location.search); } catch { /* another origin */ }
    return { all, off };
}
export function interiorPassOn(room) {
    if (!globalThis.__ERGO_PRESENTATION__ || !room?.roomLayout || room.look === 'classic') return false;
    return readSwitch().all && !!recipeFor(room);
}

const noRay = () => {};
const levelAt = (levels, i) => typeof levels === 'number' ? levels : typeof levels === 'function' ? levels(i) : levels[i] ?? levels[0] ?? 0;

// ---- gradient maps (one per kind, shared by every room; never disposed with a room) ---------------------------------
const MAPS = new Map();
function gradientMap(kind) {
    if (MAPS.has(kind)) return MAPS.get(kind);
    const n = 128, data = new Uint8Array(n * n * 4).fill(255), s = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const u = (x + .5) / n, v = (y + .5) / n, dx = u * 2 - 1, dy = v * 2 - 1, r2 = dx * dx + dy * dy; let a = 0;
        // round: a lamp's landing. Value and slope reach zero before the quad ends.
        if (kind === 'round') a = Math.max(0, 1 - r2) ** 2 * Math.exp(-2.2 * r2);
        // rake: light entering at u = 0 and dying along the wall, feathered top and bottom (daylight from a window end)
        else if (kind === 'rake') a = Math.exp(-3.2 * u) * (1 - s(.72, 1, u)) * s(0, .22, v) * (1 - s(.7, 1, v));
        // scallop: a wall washer's cone, brightest just under the fixture at the top of the quad
        else if (kind === 'scallop') { const w = .16 + .62 * (1 - v), c = Math.max(0, 1 - (dx / w) ** 2); a = c * c * Math.exp(-2.4 * (1 - v)) * s(0, .08, 1 - v) * (1 - s(.82, 1, 1 - v)); }
        // up: the glow a lamp or a cove throws up a wall from the bottom of the quad
        else if (kind === 'up') { const w = .2 + .7 * v, c = Math.max(0, 1 - (dx / w) ** 2); a = c * c * Math.exp(-2.6 * v) * (1 - s(.8, 1, v)); }
        // band: an even strip that fades at both ends and across (a cove, a light slot, a window's bounce on a ceiling)
        else if (kind === 'band') a = s(0, .18, u) * (1 - s(.82, 1, u)) * Math.max(0, 1 - dy * dy) ** 2;
        data[(y * n + x) * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
    }
    const map = new THREE.DataTexture(data, n, n); map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
    MAPS.set(kind, map); return map;
}

// ---- the envelope shader ---------------------------------------------------------------------------------------------
// Amounts are alpha in the frame buffer as drawn (display-encoded in the live view and in the film alike: film-quality.mjs
// draws straight to the canvas and multiplies its ambient occlusion on afterwards).
const SHADE_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SHADE_FRAGMENT = `
uniform vec3 uTint; uniform float uStrength; uniform float uFlat;
uniform vec4 uAmount;   // wall: top, corner at u=0, corner at u=1, skirting · floor: back, left, right, front edge
uniform vec4 uWidth;    // the same four, as a fraction of the quad
uniform float uFloor;
uniform vec4 uHole[6];   // what the shade must leave clear (windows, screens): u0, v0, u1, v1
varying vec2 vUv;
float fall(float d, float w){ float t = clamp(1.0 - d / max(w, 0.0001), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void main(){
    float a;
    if (uFloor > 0.5) {
        float back = uAmount.x * fall(1.0 - vUv.y, uWidth.x), left = uAmount.y * fall(vUv.x, uWidth.y);
        float right = uAmount.z * fall(1.0 - vUv.x, uWidth.z), front = uAmount.w * fall(vUv.y, uWidth.w);
        a = 1.0 - (1.0 - back) * (1.0 - left) * (1.0 - right) * (1.0 - front);
    } else {
        float top = uAmount.x * pow(fall(1.0 - vUv.y, uWidth.x), 1.35), c0 = uAmount.y * fall(vUv.x, uWidth.y);
        float c1 = uAmount.z * fall(1.0 - vUv.x, uWidth.z), base = uAmount.w * fall(vUv.y, uWidth.w);
        a = 1.0 - (1.0 - top) * (1.0 - c0) * (1.0 - c1) * (1.0 - base);
    }
    a = clamp((1.0 - (1.0 - a) * (1.0 - uFlat)) * uStrength, 0.0, 0.8);
    for (int i = 0; i < 6; i++) { vec4 h = uHole[i]; if (h.z > h.x) a *= 1.0 - step(h.x, vUv.x) * step(vUv.x, h.z) * step(h.y, vUv.y) * step(vUv.y, h.w); }
    gl_FragColor = vec4(uTint, a);
}`;

class InteriorPass {
    constructor(room, helpers, off) {
        this.room = room; this.helpers = helpers; this.off = off; this.items = []; this.phase = 0; this.gain = 1;
        const L = room.roomLayout;
        this.w = L.width; this.d = L.depth; this.h = L.height; this.back = L.back; this.x0 = L.left ?? -L.width / 2; this.x1 = this.x0 + L.width; this.front = L.back + L.depth;
        this.group = new THREE.Group(); this.group.name = 'Interior pass'; this.group.userData.grooveMarker = true; this.group.userData.presentationOnly = true;
        room.root.add(this.group);
    }
    on(layer) { return !this.off.has(layer); }
    // The cutaway wall standing on a side of the room, if the room has one there ('back' | 'left' | 'right').
    wall(side) {
        const s = this.room.root.scale.x, near = (a, b) => Math.abs(a - b) < 250 * s;
        // room z = world x / s, room x = -world z / s (the room root is turned a quarter)
        if (side === 'back') return this.room.walls.find(w => w.axis === 'x' && near(w.limit, this.back * s))?.obj || null;
        const x = side === 'left' ? this.x0 : this.x1;
        return this.room.walls.find(w => w.axis === 'z' && near(w.limit, -x * s))?.obj || null;
    }
    // A wall quad in room millimetres: from..to along the wall, bottom..top, `off` millimetres into the room. u = 0 is at
    // `from` whichever way that runs (the quad's own u runs +x on the back wall, toward the back on the left wall and
    // toward the front on the right wall; `mirror` says the uv must be turned to match).
    frame(side, from, to, bottom, top, off) {
        const mid = (from + to) / 2, y = (bottom + top) / 2, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        const at = side === 'back' ? [mid, y, this.back + off] : side === 'left' ? [this.x0 + off, y, mid] : side === 'right' ? [this.x1 - off, y, mid] : [mid, y, this.front - off];
        e.set(0, side === 'back' ? 0 : side === 'left' ? Math.PI / 2 : side === 'right' ? -Math.PI / 2 : Math.PI, 0);
        const natural = side === 'back' || side === 'right' ? 1 : -1;
        return { matrix: m.compose(new THREE.Vector3(...at), q.setFromEuler(e), new THREE.Vector3(Math.abs(to - from), top - bottom, 1)), mirror: Math.sign(to - from) !== natural };
    }
    // What on a wall gives light of its own and sits behind an overlay `off` millimetres out: screens, lit signs and
    // light boxes. [[from, to, bottom, top]] in room millimetres along the wall. A shade must not darken them.
    litOnWall(side, off) {
        const wall = this.wall(side); if (!wall) return [];
        const root = this.room.root; root.updateWorldMatrix(true, true);
        const inv = root.matrixWorld.clone().invert(), box = new THREE.Box3(), out = [];
        wall.traverse(o => {
            if (!o.isMesh || !o.geometry || o.userData.interiorPass || o.userData.windowScenery || o.userData.lightPool) return;
            const m = [].concat(o.material || [])[0]; if (!m || m.isShaderMaterial || (m.transparent && !m.depthWrite)) return;
            // a screen (scene-screens.mjs tags them), a picture that lights itself, or a plainly glowing face
            const screen = m.userData?.screenVariant !== undefined || o.userData.sceneDisplay || m.userData?.sceneDisplay || o.userData.mediaLabScreen;
            const glow = screen || (m.emissiveMap && m.emissiveIntensity > .03) || (m.emissive && m.emissiveIntensity > .2 && m.emissive.r + m.emissive.g + m.emissive.b > .25);
            let named = false; for (let p = o; p && p !== wall; p = p.parent) if (/screen|display|monitor|television|\btv\b|marquee|projection/i.test(p.name || '')) named = true;
            if (!glow && !m.isMeshBasicMaterial && !named) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            const proud = side === 'back' ? box.max.z - this.back : side === 'left' ? box.max.x - this.x0 : this.x1 - box.min.x;
            const a = side === 'back' ? [box.min.x, box.max.x] : [box.min.z, box.max.z];
            if (proud > off || proud < -200 || (a[1] - a[0]) * (box.max.y - box.min.y) < 40000) return;   // in front of the overlay, outside the room, or a pilot light
            out.push([a[0] - 12, a[1] + 12, box.min.y - 12, box.max.y + 12]);
        });
        return out;
    }
    quad(mirror = false) {
        const g = new THREE.PlaneGeometry(1, 1);
        if (mirror) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
        return g;
    }
    // Hang an overlay on the room: on its cutaway wall when it has one (it hides with the wall), else on the pass group.
    hang(mesh, matrix, side = null) {
        const parent = (side && this.wall(side)) || this.group, root = this.room.root;
        root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false);
        mesh.matrixAutoUpdate = false; mesh.matrix.copy(parent.matrixWorld).invert().multiply(root.matrixWorld).multiply(matrix);
        mesh.castShadow = mesh.receiveShadow = false; mesh.raycast = noRay; mesh.frustumCulled = false; mesh.userData.presentationOnly = true; mesh.userData.interiorPass = true;
        parent.add(mesh); if (parent !== this.group) this.hung = (this.hung || []).concat(mesh);
        return mesh;
    }
    shadeMaterial(amount, width, tint, floor, flat = 0, holes = []) {
        const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: SHADE_VERTEX, fragmentShader: SHADE_FRAGMENT,
            uniforms: { uTint: { value: new THREE.Color(tint) }, uStrength: { value: 0 }, uFlat: { value: flat }, uAmount: { value: new THREE.Vector4(...amount) }, uWidth: { value: new THREE.Vector4(...width) }, uFloor: { value: floor ? 1 : 0 }, uHole: { value: [0, 1, 2, 3, 4, 5].map(i => new THREE.Vector4(...(holes[i] || [0, 0, 0, 0]))) } } });
        return material;
    }
    // envelope: { tint, levels, walls: { back|left|right: { top, corners: [at u=0, at u=1], base, from?, to?, height? } | false },
    //             (a side takes one spec or a list; flat = an even shade on top of the gradients, for a wall that stands
    //             against the light; holes = its windows, [[from, to, bottom, top]], which the shade leaves clear)
    //             topWidth, cornerWidth, baseWidth (mm), floor: { back, left, right, front, width } | false }
    envelope(spec) {
        if (!this.on('envelope')) return;
        const tint = spec.tint || '#0b0e14', levels = spec.levels || [1, 1, 1.15, 1.3, 1.2];
        for (const side of ['back', 'left', 'right']) for (const s of [].concat(spec.walls?.[side] || [])) {
            const along = side === 'back' ? [this.x0, this.x1] : side === 'left' ? [this.back, this.front] : [this.front, this.back];
            const from = s.from ?? along[0], to = s.to ?? along[1], length = Math.abs(to - from), bottom = s.bottom ?? 0, top = s.height ?? this.h, height = top - bottom;
            const amount = [s.top ?? .2, s.corners?.[0] ?? 0, s.corners?.[1] ?? 0, s.base ?? 0], cw = s.cornerWidth ?? spec.cornerWidth ?? 1800;
            const width = [(s.topWidth ?? spec.topWidth ?? height * .8) / height, cw / length, cw / length, (spec.baseWidth ?? 450) / height];
            // holes: [[from, to, bottom, top], ...] in room millimetres along this wall: the recipe's windows, then whatever
            // on the wall gives light of its own behind the shade (screens, lit signs), largest first, six in all
            const offset = s.offset ?? spec.offset ?? 52, lit = this.litOnWall(side, offset).sort((p, q) => (q[1] - q[0]) * (q[3] - q[2]) - (p[1] - p[0]) * (p[3] - p[2]));
            const u = v => (v - from) / (to - from), holes = [...(s.holes || []), ...lit].slice(0, 6).map(([a, b, y0, y1]) => [Math.min(u(a), u(b)), (y0 - bottom) / height, Math.max(u(a), u(b)), (y1 - bottom) / height]);
            const f = this.frame(side, from, to, bottom, top, offset);
            const mesh = new THREE.Mesh(this.quad(f.mirror), this.shadeMaterial(amount, width, s.tint || tint, false, s.flat ?? 0, holes)); mesh.name = 'Interior pass: wall shade (' + side + ')';
            mesh.renderOrder = .5; this.track(mesh, s.levels || levels, 'shade');
            this.hang(mesh, f.matrix, side);
        }
        const f = spec.floor; if (f === false) return;
        // floor: the falloff toward the walls, over the whole floor or over { x: [x0, x1], z: [z0, z1] } of it
        const fx = f?.x || [this.x0, this.x1], fz = f?.z || [this.back, this.front], sx = fx[1] - fx[0], sz = fz[1] - fz[0];
        const fw = f?.width ?? 1500, amount = [f?.back ?? .16, f?.left ?? .14, f?.right ?? .14, f?.front ?? 0];
        const material = this.shadeMaterial(amount, [fw / sz, fw / sx, fw / sx, fw / sz], f?.tint || tint, true);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material); mesh.name = 'Interior pass: floor falloff'; mesh.renderOrder = .5; this.track(mesh, f?.levels || levels, 'shade');
        const m = new THREE.Matrix4().compose(new THREE.Vector3(fx[0] + sx / 2, f?.y ?? 2.5, fz[0] + sz / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(sx, sz, 1));
        this.hang(mesh, m);
    }
    lightMaterial(kind, color) {
        const material = new THREE.MeshBasicMaterial({ map: gradientMap(kind), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        material.userData.sharedTextures = true; material.userData.interiorColor = new THREE.Color(color); return material;
    }
    // wash: additive light on a wall. { side, from, to, bottom, top, kind: 'rake'|'scallop'|'up'|'band'|'round', color, levels, off }
    // (a rake enters at `from` and dies toward `to`)
    wash(spec) {
        if (!this.on('washes')) return null;
        const f = this.frame(spec.side, spec.from, spec.to, spec.bottom, spec.top, spec.off ?? 58);
        const mesh = new THREE.Mesh(this.quad(f.mirror), this.lightMaterial(spec.kind || 'scallop', spec.color || '#fff1dc')); mesh.name = 'Interior pass: wall wash (' + (spec.name || spec.kind || 'scallop') + ')';
        mesh.renderOrder = 2; this.track(mesh, spec.levels ?? .2, 'light');
        return this.hang(mesh, f.matrix, spec.side);
    }
    // pool: additive light on the floor (or any level surface). { at: [x, z], size: [sx, sz], y, color, levels, kind, turn }
    pool(spec) {
        if (!this.on('pools')) return null;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.lightMaterial(spec.kind || 'round', spec.color || '#fff0dc')); mesh.name = 'Interior pass: light pool' + (spec.name ? ' (' + spec.name + ')' : '');
        mesh.renderOrder = 2; this.track(mesh, spec.levels ?? .2, 'light');
        const m = new THREE.Matrix4().compose(new THREE.Vector3(spec.at[0], spec.y ?? 5, spec.at[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, spec.turn || 0)), new THREE.Vector3(spec.size[0], spec.size[1], 1));
        return this.hang(mesh, m);
    }
    track(mesh, levels, type) { this.items.push({ mesh, levels, type }); }
    // finishes: fn(material, mesh) for every architectural material the room owns (walls, floor, ceiling and built
    // fixtures; never a prop-library model, whose materials are shared between rooms).
    finishes(fn) {
        if (!this.on('finishes')) return;
        const seen = new Set();
        this.room.root.traverse(o => {
            if (!o.isMesh || o.userData.interiorPass) return;
            for (let p = o; p && p !== this.room.root; p = p.parent) if (/^Prop:/.test(p.name) || p.userData.person || p.userData.libraryProp) return;
            for (const m of [].concat(o.material || [])) if (m?.isMeshStandardMaterial && !seen.has(m)) { seen.add(m); fn(m, o); }
        });
    }
    // dressing: a plain group for built pieces. Not a scene asset: it cannot be selected, moved or hidden by name.
    dressing(name, build, side = null) {
        if (!this.on('dressing')) return null;
        const g = new THREE.Group(); g.name = 'Interior pass: ' + name; g.userData.presentationOnly = true; g.userData.grooveMarker = true; g.userData.interiorPass = true;
        build(g, this.helpers); g.traverse(o => { o.raycast = noRay; o.userData.interiorPass = true; });
        const parent = (side && this.wall(side)) || this.group; parent.add(g); return g;
    }
    apply(mode, gain = 1) {
        const i = Math.max(0, PHASES.indexOf(mode)); this.phase = i; this.gain = gain;
        for (const { mesh, levels, type } of this.items) {
            const v = levelAt(levels, i);
            if (type === 'shade') { mesh.material.uniforms.uStrength.value = v; mesh.visible = v > .003; }
            else { mesh.material.color.copy(mesh.material.userData.interiorColor).multiplyScalar(v * gain); mesh.visible = v * gain > .003; }
        }
    }
    dispose() {
        const drop = o => { o.removeFromParent(); o.traverse(m => { if (!m.isMesh) return; m.geometry?.dispose(); for (const x of [].concat(m.material || [])) x.dispose(); }); };
        for (const m of this.hung || []) drop(m);
        drop(this.group); this.items = [];
    }
}

// ---- recipes ---------------------------------------------------------------------------------------------------------
// One per film room, written against the room as its builder makes it (sizes in room millimetres; x0/x1 = left/right
// wall, back/front = z). Keep each step named: the Director's report and docs/interior-pass.md list them.
const recipeFor = room => INTERIOR_RECIPES[room.id + '/' + room.roomLayout?.id] || INTERIOR_RECIPES[room.id] || null;

// Called by WorkspaceRoom.set once the room's shell, ceiling and surface refinement are built.
export function applyInteriorPass(room, helpers) {
    room.interiorPass?.dispose?.(); room.interiorPass = null;
    if (!interiorPassOn(room)) return null;
    const recipe = recipeFor(room), pass = new InteriorPass(room, helpers, readSwitch().off);
    try { recipe.shell?.(pass, room); } catch (error) { console.warn('[interior pass] ' + room.id + ': ' + (error?.message || error)); }
    // the room's daypart call drives the pass too (the Studio's applyRoomLighting, the film's timeOfDay snapshots)
    const before = room.roomAtmosphere;
    room.roomAtmosphere = (mode, accent = 1) => { const r = before?.(mode, accent); pass.apply(mode, accent); return r; };
    pass.recipe = recipe; pass.apply(room.root.userData.lighting?.mode || 'morning');
    room.root.userData.interiorPass = { room: room.id, layout: room.roomLayout.id, layers: INTERIOR_LAYERS.filter(l => pass.on(l)), steps: recipe.steps || [] };
    return room.interiorPass = pass;
}
// Called once the room's props, fixtures and life are in: steps that need them (finishes on upgraded fixtures, light
// landing next to a placed lamp).
export function finishInteriorPass(room) {
    const pass = room.interiorPass; if (!pass?.recipe?.furnished) return;
    try { pass.recipe.furnished(pass, room); pass.apply(PHASES[pass.phase], pass.gain); } catch (error) { console.warn('[interior pass] ' + room.id + ': ' + (error?.message || error)); }
}
