// Modelled scenery outside a window: real depth behind the glass.
//
// A photograph on the pane (window-vista.mjs) sits at the horizon: it shifts with the camera the way a far view does,
// but nothing in it is near, so the window reads as a picture of a place. Here the place is built: planting under the
// sill, a lawn, trees, a fence, the neighbours' houses, each at its own distance, so near things slide past far ones
// as the camera moves. Vico (November 12): "open to 3D environments outside of the windows to make the depth and
// feeling of more immersion", and the view must not compete with the room.
//
// How it stays behind the room:
// - Seen only through the opening. The rooms are cutaways (walls come off for the camera), so a garden behind a wall
//   would show beside and above it. Every fragment is kept only if the sight line from the camera to it crosses the
//   window's rectangle (a test in the shader: no stencil, no clipping planes, right for any camera and render target).
//   A camera on the outside of the wall sees none of it.
// - Its own light. The scenery is not lit by the room's lamps (they would reach it through the wall): each vertex
//   carries its colour with a fixed daylight baked in, and the hour is a tint over all of it. Every hour's values are
//   uniforms, so the film's time-of-day blend (film-tod) carries them from one hour to the next.
// - Calm. LEVEL scales the brightness of everything outside; haze takes far things toward the sky's colour.
// - The sky is drawn on the pane by view direction (it is at infinity): a gradient, a soft sun or moon, slow clouds.
//
// One mesh for the garden, one for what glows after dark, no textures, no shadows: about 60 000 triangles.
import * as THREE from 'three';

// One number for how bright the world outside is against the room (the sky and the garden alike).
export const LEVEL = .8;

// The hour outside. tint: what the light does to the garden's colours. zenith / horizon: the sky. sun: [degrees to the
// right of straight out, degrees up, colour, strength] (the moon after dark). clouds: 0..1. lamp: lit windows and
// garden lights. haze: how much far things take the colour of the air.
export const HOURS = {
    morning:   { tint: [1.0, .95, .84], zenith: '#7aabd2', horizon: '#e9d9bf', sun: [-52, 13, '#ffe6b8', .8], clouds: .42, lamp: 0, haze: .5, air: '#e6dccb' },
    afternoon: { tint: [.98, .99, .97], zenith: '#7aa9cf', horizon: '#dfe7ea', sun: [48, 50, '#fff6e6', .45], clouds: .5, lamp: 0, haze: .42, air: '#d9e1e6' },
    evening:   { tint: [.86, .62, .5], zenith: '#55628c', horizon: '#eea06a', sun: [38, 5, '#ff9f5c', 1.1], clouds: .55, lamp: .5, haze: .55, air: '#c99378' },
    night:     { tint: [.1, .135, .23], zenith: '#0a1126', horizon: '#22324f', sun: [30, 36, '#c9d6f0', .28], clouds: .2, lamp: 1, haze: .5, air: '#141d33' },
    party:     { tint: [.15, .15, .28], zenith: '#15163a', horizon: '#402f63', sun: [-40, 30, '#d4d0f2', .25], clouds: .28, lamp: 1, haze: .5, air: '#211e40' }
};

const PORTAL = `
uniform mat4 portalInv; uniform vec2 portalHalf;
// The sight line from the camera to this point crosses the window's rectangle (z = 0 of the window's frame, the room
// on +z). False from outside the wall.
bool throughWindow(vec3 world) {
    vec3 p = (portalInv * vec4(world, 1.)).xyz; vec2 hit;
    if (isOrthographic) {
        vec3 d = mat3(portalInv) * vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]);
        if (d.z > -1e-5) return false; hit = p.xy - d.xy * (p.z / d.z);
    } else {
        vec3 o = (portalInv * vec4(cameraPosition, 1.)).xyz;
        if (o.z <= 0. || p.z >= o.z) return false; hit = o.xy + (p.xy - o.xy) * (o.z / (o.z - p.z));
    }
    return abs(hit.x) <= portalHalf.x && abs(hit.y) <= portalHalf.y;
}`;
const VERTEX = `attribute vec3 tone; varying vec3 vTone; varying vec3 vWorld;
void main() { vTone = tone; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GARDEN = `uniform vec3 tint, air; uniform float haze, hazeFar, level, lamp;
varying vec3 vTone; varying vec3 vWorld;
${PORTAL}
void main() {
    if (!throughWindow(vWorld)) discard;
    #ifdef LAMP
    if (lamp < .02) discard;
    vec3 c = vTone * lamp;
    #else
    vec3 c = vTone * tint * level;
    float far = -(portalInv * vec4(vWorld, 1.)).z;
    c = mix(c, air * level, haze * smoothstep(0., hazeFar, far));
    #endif
    gl_FragColor = vec4(c, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
const SKY_VERTEX = `varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SKY = `uniform vec3 zenith, horizon, sunDir, sunColor, wOut, wRight; uniform float sunPower, clouds, level, drift;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.; a *= .5; } return v; }
void main() {
    vec3 dir = isOrthographic ? vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]) : normalize(vWorld - cameraPosition);
    float up = dir.y;
    vec3 c = mix(horizon, zenith, pow(smoothstep(-.02, .62, up), .75));
    c = mix(c, horizon * .92, smoothstep(.0, -.12, up));            // below the horizon: the far air (behind the scenery)
    float s = max(dot(dir, sunDir), 0.);
    c += sunColor * sunPower * (pow(s, 900.) * 1.6 + pow(s, 40.) * .32 + pow(s, 5.) * .1);
    // clouds on a level sheet above: soft, lit from the sun's side, thinning toward the horizon
    vec2 q = vec2(dot(dir, wRight), dot(dir, wOut)) / max(up + .16, .1) * 1.15 + vec2(drift, 0.);
    float n = fbm(q + 3.7), cover = smoothstep(1. - clouds * .62, 1.08 - clouds * .3, n + .32) * smoothstep(-.01, .16, up);
    vec3 cloud = mix(horizon, vec3(1.), .55) * (.82 + .18 * fbm(q * 2.3)) + sunColor * sunPower * .12 * pow(s, 3.);
    c = mix(c, cloud * mix(.5, 1., smoothstep(0., .6, max(max(zenith.r, zenith.g), zenith.b) * 2.)), cover * .78);
    gl_FragColor = vec4(c * level, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

// ---- building: geometry with a colour per vertex, daylight baked in
const SUN = new THREE.Vector3(-.42, .78, .46).normalize();      // in the window's frame: from above, a little from the room's side
const rand = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const colour = hex => new THREE.Color(hex);      // (linear working values)
const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();

class Builder {
    constructor() { this.position = []; this.tone = []; }
    // geometry in place (matrix), coloured by shade(position, normal) -> Color, lit by the baked sun
    // lumps: the surface pushed in and out along its normal (a mass of leaves, not a ball); dapple: light and shade in patches
    add(geometry, matrix, shade, { ambient = .6, flat = false, lumps = 0, dapple = 0, seed = 0 } = {}) {
        const g = geometry.index ? geometry.toNonIndexed() : geometry; if (flat) g.computeVertexNormals();
        const p = g.attributes.position, n = g.attributes.normal; normalMatrix.getNormalMatrix(matrix);
        for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i); normal.fromBufferAttribute(n, i);
            let patch = 0;
            if (lumps || dapple) { const { x, y, z } = point, w = Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 3.3 + seed * .6) + .55 * Math.sin(x * 6.3 + seed * 2.1) * Math.sin(y * 5.9 + seed) * Math.sin(z * 6.7 + seed * 1.3);
                patch = Math.sin(x * 9.1 + seed * 3) * Math.sin(y * 8.3 + seed) * Math.sin(z * 9.7 + seed * 2); point.addScaledVector(normal, w * lumps); }
            point.applyMatrix4(matrix); normal.applyMatrix3(normalMatrix).normalize();
            const c = shade(point, normal), light = (ambient + (1 - ambient) * Math.max(0, normal.dot(SUN)) + .05 * normal.y) * (1 + patch * dapple);
            this.position.push(point.x, point.y, point.z); this.tone.push(c.r * light, c.g * light, c.b * light);
        }
        if (g !== geometry) g.dispose();
        return this;
    }
    box(size, at, hex, vary = 0, r = null) { const c = colour(hex); if (vary && r) c.offsetHSL(0, 0, (r() - .5) * vary);
        return this.add(new THREE.BoxGeometry(...size), new THREE.Matrix4().makeTranslation(...at), () => c); }
    geometry() { const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3)); g.setAttribute('tone', new THREE.Float32BufferAttribute(this.tone, 3));
        g.computeBoundingSphere(); return g; }
}
const M = (x, y, z, sx = 1, sy = sx, sz = sx, turn = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), new THREE.Vector3(sx, sy, sz));
const BLOB = new THREE.IcosahedronGeometry(1, 2), DOT = new THREE.IcosahedronGeometry(1, 0), CONE = new THREE.ConeGeometry(1, 1, 10, 3), TRUNK = new THREE.CylinderGeometry(.72, 1, 1, 8, 1);
// A mass of leaves: darker underneath and inside, each clump a little its own green.
const leaves = (b, r, x, y, z, radius, hex, { squash = .82, jitter = .06 } = {}) => {
    const c = colour(hex); c.offsetHSL((r() - .5) * .03, (r() - .5) * .08, (r() - .5) * jitter);
    const dark = c.clone().multiplyScalar(.62), out = new THREE.Color();
    b.add(BLOB, M(x, y, z, radius * (.9 + r() * .2), radius * squash, radius * (.9 + r() * .2), r() * 6.28), (p, n) => out.copy(dark).lerp(c, THREE.MathUtils.smoothstep(n.y, -.7, .55)), { ambient: .55, lumps: .2, dapple: .16, seed: r() * 40 });
};
const tree = (b, r, x, ground, z, { height = 5200, crown = 1500, hex = '#6a8a57', trunk = '#6a5444', clumps = 13 } = {}) => {
    const stem = height * .5, c = colour(trunk);
    b.add(TRUNK, M(x, ground + stem / 2, z, crown * .085, stem, crown * .085), () => c, { ambient: .5 });
    // a main limb or two showing under the crown
    for (const lean of [-.5, .45]) b.add(TRUNK, new THREE.Matrix4().compose(new THREE.Vector3(x + lean * crown * .3, ground + stem * 1.02, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean * .9), new THREE.Vector3(crown * .04, stem * .5, crown * .04)), () => c, { ambient: .5 });
    for (let i = 0; i < clumps * 2; i++) {
        const a = r() * 6.28, up = r(), d = Math.sqrt(r()) * crown * .82 * (1 - up * .45);
        leaves(b, r, x + Math.cos(a) * d, ground + stem * .9 + up * (height - stem) * .9 + crown * .16, z + Math.sin(a) * d, crown * (.26 + r() * .2), hex);
    }
};
const conifer = (b, r, x, ground, z, height = 6500, hex = '#44644f') => {
    const c = colour(hex); c.offsetHSL(0, 0, (r() - .5) * .05); const dark = c.clone().multiplyScalar(.6), out = new THREE.Color();
    b.add(TRUNK, M(x, ground + height * .08, z, height * .022, height * .16, height * .022), () => colour('#5b483c'));
    for (let i = 0; i < 7; i++) { const k = i / 7, w = height * (.19 - k * .15), h = height * .24;
        b.add(CONE, M(x, ground + height * (.12 + k * .11) + h / 2, z, w, h, w, r() * 6.28), (p, n) => out.copy(dark).lerp(c, THREE.MathUtils.smoothstep(n.y, -.2, .7)), { ambient: .55, lumps: .06, dapple: .12, seed: r() * 40 }); }
};
// A house: walls, a pitched roof along x, windows on the face toward the room (dark glass by day, some lit after dark).
const house = (b, lamps, r, x, ground, z, { width = 9000, depth = 7000, eaves = 5600, ridge = 2600, wall = '#d6cab5', roof = '#96705e', lit = [1, 4] } = {}) => {
    b.box([width, eaves, depth], [x, ground + eaves / 2, z], wall);
    const shape = new THREE.Shape(); shape.moveTo(-depth / 2 - 350, 0); shape.lineTo(0, ridge); shape.lineTo(depth / 2 + 350, 0); shape.closePath();
    const prism = new THREE.ExtrudeGeometry(shape, { depth: width + 500, bevelEnabled: false }), c = colour(roof), gable = colour(wall).multiplyScalar(.93);
    b.add(prism, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x - width / 2 - 250, ground + eaves, z), (p, n) => Math.abs(n.x) > .9 ? gable : c, { flat: true });
    b.box([520, 1500, 520], [x + width * .28, ground + eaves + ridge * .8, z - depth * .12], '#8e7767');
    const face = z + depth / 2, glass = colour('#4d5c68'), frame = '#efe8dc'; let k = 0;
    for (const level of [1500, 4150]) for (const u of [-.32, 0, .32]) {
        const wx = x + u * width, wy = ground + level, door = level < 2000 && u === 0;
        if (door) { b.box([1050, 2150, 40], [wx, ground + 1075, face + 20], '#6d5a4c'); k++; continue; }
        b.box([1350, 1450, 30], [wx, wy, face + 15], frame); b.box([1190, 1290, 20], [wx, wy, face + 32], '#4d5c68');
        if (lit.includes(k)) lamps.box([1190, 1290, 12], [wx, wy, face + 46], k % 2 ? '#ffd9a0' : '#ffe6bd');
        k++; void glass;
    }
};

// The garden behind a house: `floor` is the room's floor below the window's centre (mm, negative), `width` the opening.
function garden(b, lamps, { width, height, floor }) {
    const r = rand(20261113), ground = floor - 220, sill = -height / 2;
    // lawn: mown stripes and patches, out to the far hedge
    const lawn = new THREE.PlaneGeometry(90000, 52000, 150, 86).rotateX(-Math.PI / 2), grass = colour('#72865e'), dry = colour('#889869'), out = new THREE.Color();
    b.add(lawn, M(0, ground, -26200), p => { const stripe = Math.sin(p.x / 620) * .5 + .5, patch = Math.sin(p.x / 3100 + 1.3) * Math.sin(p.z / 2700) * .5 + .5;
        return out.copy(grass).lerp(dry, stripe * .16 + patch * .34).multiplyScalar(.93 + r() * .07); }, { ambient: .72 });
    // terrace by the house: stone slabs
    for (let i = -9; i <= 9; i++) for (let j = 0; j < 3; j++) b.box([880, 40, 880], [i * 900, ground + 20, -520 - j * 900], '#b8b0a2', .05, r);
    // planting under the window: a timber planter, low shrubs just above the sill, flowers
    const span = width / 2 + 700;
    b.box([span * 2 + 300, 520, 520], [0, sill - 560, -520], '#7b5d47'); b.box([span * 2 + 240, 60, 460], [0, sill - 290, -520], '#4a3a2e');
    const blooms = ['#d394a8', '#dba266', '#efe8d8', '#9d8fc4', '#cf7676'];
    for (let x = -span; x <= span; x += 250 + r() * 130) {
        const rise = r(), top = sill - 150 + rise * 330, radius = 190 + r() * 90, z = -520 + (r() - .5) * 160;
        leaves(b, r, x, top - radius * .55, z, radius, r() < .3 ? '#5d7d52' : '#6f8f5a');
        const bloom = colour(blooms[Math.floor(r() * blooms.length)]);
        if (r() < .75) for (let k = 0; k < 18; k++) { const a = r() * 6.28, e = .15 + r() * .85;
            b.add(DOT, M(x + Math.cos(a) * radius * e * .95, top - radius * .55 + radius * .86 * Math.sqrt(1 - e * e * .7), z + Math.sin(a) * radius * e * .95, 15 + r() * 11), () => bloom, { ambient: .8 }); }
    }
    // tall grasses and a shrub at each end of the terrace
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) leaves(b, r, side * (span + 900 + k * 520), ground + 520 + r() * 300, -1500 - r() * 900, 520 + r() * 220, k % 2 ? '#627f55' : '#75925e');
    // the lawn's trees: one near on the right, an ornamental one further left, a bench under the near one
    tree(b, r, width * .5 + 2700, ground, -6000, { height: 5600, crown: 1750, hex: '#688856', clumps: 15 });
    tree(b, r, -width * .5 - 2300, ground, -8200, { height: 4300, crown: 1500, hex: '#84996a', clumps: 11 });
    tree(b, r, -width * .5 - 5200, ground, -12800, { height: 5000, crown: 1700, hex: '#5f7d53', clumps: 12 });
    const bx = width * .5 + 2300, bz = -4700;
    b.box([1500, 50, 420], [bx, ground + 450, bz], '#8a6a50'); b.box([1500, 420, 50], [bx, ground + 720, bz - 200], '#8a6a50');
    for (const s of [-650, 650]) b.box([60, 450, 400], [bx + s, ground + 225, bz], '#5a4a40');
    // flower border along the left
    for (let k = 0; k < 14; k++) { const z = -2600 - k * 640, x = -width * .5 - 3300 + Math.sin(k * 1.7) * 260;
        leaves(b, r, x, ground + 260 + r() * 160, z, 330 + r() * 120, '#6b8a58'); const bloom = colour(blooms[k % blooms.length]);
        for (let j = 0; j < 12; j++) b.add(DOT, M(x + (r() - .5) * 460, ground + 470 + r() * 190, z + (r() - .5) * 460, 20 + r() * 14), () => bloom, { ambient: .8 }); }
    // the boundary: a board fence with a hedge grown along it
    const fz = -15200;
    for (let x = -24000; x <= 24000; x += 150) b.box([138, 1750 + (Math.abs(x) % 450 === 0 ? 60 : 0), 26], [x, ground + 875, fz], '#9a7d62', .07, r);
    for (let x = -24000; x <= 24000; x += 2400) b.box([110, 1900, 110], [x, ground + 950, fz + 60], '#7a614c');
    for (let x = -24000; x <= 24000; x += 900 + r() * 300) if (Math.abs(x - 5200) > 2600) leaves(b, r, x, ground + 1150 + r() * 250, fz + 620, 900 + r() * 260, '#516f4d', { squash: 1.05 });
    // garden lights along the terrace (after dark)
    for (const x of [-span - 500, 0, span + 500]) { b.box([36, 520, 36], [x, ground + 260, -2100], '#3b3b3d'); lamps.add(BLOB, M(x, ground + 560, -2100, 62), () => colour('#ffd9a2'), { ambient: 1 }); }
    // beyond the fence: the neighbours, their trees, the far wood
    // (kept low and apart: from inside the room the window shows only the first fifteen degrees above the horizon,
    // and the sky has to have its share of them)
    house(b, lamps, r, -10500, ground, -31000, { lit: [0, 3] });
    house(b, lamps, r, 12500, ground, -34000, { width: 10500, eaves: 5200, ridge: 3000, wall: '#cbbfae', roof: '#7c6a64', lit: [2, 4] });
    for (const [x, z, h] of [[-17500, -24000, 7200], [4200, -25500, 6400], [19000, -25000, 7400], [-3800, -27500, 5600]]) tree(b, r, x, ground, z, { height: h, crown: h * .36, hex: '#58754f', clumps: 12 });
    for (const [x, z, h] of [[6500, -24500, 6800], [-15000, -33000, 8200], [20500, -36000, 8000]]) conifer(b, r, x, ground, z, h);
    for (let x = -42000; x <= 42000; x += 2400 + r() * 900) leaves(b, r, x, ground + 1300 + r() * 900, -47000 - r() * 4000, 3000 + r() * 1100, '#557260', { squash: 1.1 });
}
export const SCENES = { garden };

// Which view a window shows: 'photo' (window-vista.mjs, the default), 'scenery' (this module) or 'painted' (the room's own
// canvas, the look before the photographs). A trial switch until Vico chooses: `?window=scenery` in the address,
// localStorage `ergoflex.windowView`, or globalThis.__efWindowView (a film or a test).
export function windowView() {
    let stored = null; try { stored = globalThis.localStorage?.getItem('ergoflex.windowView'); } catch { /* no storage */ }
    let asked = null; try { asked = new URLSearchParams(globalThis.location?.search || '').get('window'); } catch { /* no address */ }
    const view = globalThis.__efWindowView || asked || stored;
    return view === 'scenery' || view === 'painted' ? view : 'photo';
}

// pane: the window's view mesh (its local +Z faces the room); width, height: the opening (in the pane's parent's
// units); floor: the room's floor below the window's centre (negative). The pane gets the sky; the scenery is added
// to the pane's parent. Returns { group, setHour(hour), sky, materials, dispose() }.
export function attachScenery(pane, name, { width, height, floor = -1550, hour = 'afternoon' } = {}) {
    const build = SCENES[name]; if (!build) throw Error('No window scenery "' + name + '".');
    const group = new THREE.Group(); group.name = 'Window scenery · ' + name; group.position.copy(pane.position); group.quaternion.copy(pane.quaternion); pane.parent.add(group);
    const portal = { portalInv: { value: new THREE.Matrix4() }, portalHalf: { value: new THREE.Vector2(width / 2, height / 2) } };
    const shared = { ...portal, tint: { value: new THREE.Vector3(1, 1, 1) }, air: { value: new THREE.Color() }, haze: { value: 0 }, hazeFar: { value: 52000 }, level: { value: LEVEL }, lamp: { value: 0 } };
    const material = lampOn => { const m = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERTEX, fragmentShader: GARDEN, defines: lampOn ? { LAMP: 1 } : {} }); m.name = 'Window scenery' + (lampOn ? ' lights' : ''); return m; };
    const b = new Builder(), lamps = new Builder(); build(b, lamps, { width, height, floor });
    const land = new THREE.Mesh(b.geometry(), material(false)), glow = new THREE.Mesh(lamps.geometry(), material(true));
    land.name = 'Window scenery land'; glow.name = 'Window scenery lights';
    for (const mesh of [land, glow]) { mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = -10; mesh.userData.windowScenery = true; group.add(mesh); }
    const sky = new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY, depthWrite: false, side: pane.material?.side ?? THREE.FrontSide, uniforms: {
        zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunPower: { value: 0 },
        clouds: { value: .4 }, level: { value: LEVEL }, drift: { value: 0 }, wOut: { value: new THREE.Vector3(0, 0, -1) }, wRight: { value: new THREE.Vector3(1, 0, 0) } } });
    sky.name = 'Window sky · ' + name;
    pane.userData.paintedMaterial ||= pane.material; pane.userData.viewMaterial = pane.material; pane.material = sky; pane.renderOrder = -20; pane.userData.windowScenery = name;
    // the sun as the hour has it: [right of straight out, up] in degrees, turned into the world with the window
    const sunAim = { right: 0, up: 45 }, quaternion = new THREE.Quaternion(), out = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const sync = () => {
        group.updateWorldMatrix(true, false); portal.portalInv.value.copy(group.matrixWorld).invert();
        pane.getWorldQuaternion(quaternion); out.set(0, 0, -1).applyQuaternion(quaternion); out.y = 0; if (out.lengthSq() < 1e-6) return; out.normalize(); right.crossVectors(out, UP).normalize();
        const a = THREE.MathUtils.degToRad(sunAim.right), e = THREE.MathUtils.degToRad(sunAim.up);
        sky.uniforms.wOut.value.copy(out); sky.uniforms.wRight.value.copy(right);
        sky.uniforms.sunDir.value.copy(out).multiplyScalar(Math.cos(a) * Math.cos(e)).addScaledVector(right, Math.sin(a) * Math.cos(e)).addScaledVector(UP, Math.sin(e)).normalize();
    };
    const before = pane.onBeforeRender; pane.onBeforeRender = function (...args) { sync(); before?.apply(this, args); };
    land.onBeforeRender = sync;
    const setHour = id => {
        const h = HOURS[id] || HOURS.afternoon;
        shared.tint.value.fromArray(h.tint); shared.air.value.set(h.air); shared.haze.value = h.haze; shared.lamp.value = h.lamp;
        sky.uniforms.zenith.value.set(h.zenith); sky.uniforms.horizon.value.set(h.horizon); sky.uniforms.sunColor.value.set(h.sun[2]); sky.uniforms.sunPower.value = h.sun[3]; sky.uniforms.clouds.value = h.clouds;
        sunAim.right = h.sun[0]; sunAim.up = h.sun[1]; sync();
    };
    setHour(hour);
    const dispose = () => { pane.onBeforeRender = before || (() => {}); pane.material = pane.userData.viewMaterial; pane.renderOrder = 0; delete pane.userData.windowScenery;
        group.removeFromParent(); land.geometry.dispose(); glow.geometry.dispose(); land.material.dispose(); glow.material.dispose(); sky.dispose(); };
    return { group, setHour, sky, materials: [land.material, glow.material, sky], dispose };
}
