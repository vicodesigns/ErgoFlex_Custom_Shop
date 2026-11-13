// Modelled scenery outside a window: real depth behind the glass.
//
// A photograph on the pane (window-vista.mjs) sits at the horizon: it shifts with the camera the way a far view does,
// but nothing in it is near, so the window reads as a picture of a place. Here the place is built: planting under the
// sill, a lawn, trees, a street, the buildings across it, each at its own distance, so near things slide past far ones
// as the camera moves. Vico (November 12): "open to 3D environments outside of the windows to make the depth and
// feeling of more immersion", and the view must not compete with the room. November 13: "I like that 3D like
// environment for the outside of the window"; one scene per kind of place (window-scenery-scenes.mjs).
//
// How it stays behind the room:
// - Seen only through the openings. The rooms are cutaways (walls come off for the camera), so a garden behind a wall
//   would show beside and above it. Every fragment is kept only if the sight line from the camera to it crosses one of
//   the wall's window rectangles (a test in the shader: no stencil, no clipping planes, right for any camera and render
//   target). A camera on the outside of the wall sees none of it.
// - One world per wall. The windows of one wall look out on one scene (several openings in one test), so what is seen
//   through window A lines up with window B. A wall facing another way gets its own scene (attachScenery groups the
//   panes it is given by the way they face).
// - Its own light. The scenery is not lit by the room's lamps (they would reach it through the wall): each vertex
//   carries its colour with a fixed daylight baked in, plus the light its street lamps and lit windows throw after
//   dark; the hour is a tint over all of it. Every hour's values are uniforms, so the film's time-of-day blend
//   (film-tod) carries them from one hour to the next.
// - Calm. LEVEL scales the brightness of everything outside; haze takes far things toward the sky's colour.
// - The sky is drawn on the pane by view direction (it is at infinity): a gradient, a soft sun or moon, slow clouds,
//   stars after dark.
//
// Per world: one mesh for the land, one for what glows after dark, one of soft halos round the lamps; no textures, no
// shadows, about 60 000 triangles. The geometry is kept and reused when the room is rebuilt.
import * as THREE from 'three';
import { Builder, Halos, rand, SUN } from './window-scenery-kit.mjs?v=polish-20261113a';
import { SCENES } from './window-scenery-scenes.mjs?v=polish-20261113a';
export { SCENES };

// One number for how bright the world outside is against the room (the sky and the land alike).
export const LEVEL = .8;

// What every room's windows show unless asked otherwise ('photo', 'scenery' or 'painted'). '*' is every room; a room's
// id (home, creative, library, occmedialab, highschool, gym, gaming, music, workshop, ...) overrides it for that room.
// Making scenery the default is one line here: '*': 'scenery', or e.g. music: 'scenery' for one room.
export const DEFAULT_VIEW = { '*': 'photo' };

// The hour outside. tint: what the light does to the land's colours. zenith / horizon: the sky. sun: [degrees to the
// right of straight out, degrees up, colour, strength] (the moon after dark). clouds: 0..1. lamp: lit windows, street
// and garden lights. haze: how much far things take the colour of the air. stars: after dark.
// A scene may adjust any of these for its place (SCENES[name].hours), e.g. a marine layer or a city's glow.
export const HOURS = {
    morning:   { tint: [1.0, .95, .84], zenith: '#7aabd2', horizon: '#e9d9bf', sun: [-52, 13, '#ffe6b8', .8], clouds: .42, lamp: 0, haze: .5, air: '#e6dccb', stars: 0 },
    afternoon: { tint: [.98, .99, .97], zenith: '#7aa9cf', horizon: '#dfe7ea', sun: [48, 50, '#fff6e6', .45], clouds: .5, lamp: 0, haze: .42, air: '#d9e1e6', stars: 0 },
    evening:   { tint: [.8, .6, .52], zenith: '#55628c', horizon: '#eea06a', sun: [38, 5, '#ff9f5c', 1.1], clouds: .55, lamp: .55, haze: .55, air: '#c99378', stars: 0 },
    night:     { tint: [.12, .15, .25], zenith: '#0a1126', horizon: '#22324f', sun: [30, 36, '#c9d6f0', .28], clouds: .2, lamp: 1, haze: .45, air: '#18213a', stars: 1 },
    party:     { tint: [.16, .16, .3], zenith: '#15163a', horizon: '#402f63', sun: [-40, 30, '#d4d0f2', .25], clouds: .28, lamp: 1, haze: .45, air: '#241f44', stars: .6 }
};
export const hourOf = (name, id) => ({ ...(HOURS[id] || HOURS.afternoon), ...(SCENES[name]?.hours?.[id] || SCENES[name]?.hours?.all || {}) });

// The sight line from the camera to this point crosses one of the wall's openings (rectangles in the window's frame:
// centre openAt.xy at depth openAt.z, half size openHalf; the room on +z). False from outside the wall.
const PORTAL = `
uniform mat4 portalInv; uniform vec3 openAt[OPENINGS]; uniform vec2 openHalf[OPENINGS];
bool throughWindow(vec3 world) {
    vec3 p = (portalInv * vec4(world, 1.)).xyz, o = (portalInv * vec4(cameraPosition, 1.)).xyz;
    vec3 d = mat3(portalInv) * vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]);
    for (int i = 0; i < OPENINGS; i++) {
        float z = openAt[i].z; if (p.z >= z) continue;
        vec2 hit;
        if (isOrthographic) { if (d.z > -1e-5) continue; hit = p.xy - d.xy * ((p.z - z) / d.z); }
        else { if (o.z <= z) continue; hit = o.xy + (p.xy - o.xy) * ((o.z - z) / (o.z - p.z)); }
        if (abs(hit.x - openAt[i].x) <= openHalf[i].x && abs(hit.y - openAt[i].y) <= openHalf[i].y) return true;
    }
    return false;
}`;
const VERTEX = `attribute vec3 tone; attribute vec3 glow; varying vec3 vTone; varying vec3 vGlow; varying vec3 vWorld;
void main() { vTone = tone; vGlow = glow; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LAND = `uniform vec3 tint, air; uniform float haze, hazeFar, level, lamp, lampLevel;
varying vec3 vTone; varying vec3 vGlow; varying vec3 vWorld;
${PORTAL}
void main() {
    if (!throughWindow(vWorld)) discard;
    float far = smoothstep(0., hazeFar, -(portalInv * vec4(vWorld, 1.)).z);
    #ifdef LAMP
    if (lamp < .02) discard;
    vec3 c = mix(vTone, air * level, haze * far * .5) * lamp * lampLevel;
    #else
    float h = haze * far;
    vec3 c = mix(vTone * tint, air, h) * level + vGlow * lamp * level * (1. - h * .6);
    #endif
    gl_FragColor = vec4(c, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
// Halos: quads turned to face the camera round each lamp; the opening test runs on the quad itself.
const HALO_VERTEX = `attribute vec2 corner; attribute vec3 tone; attribute float size; varying vec3 vTone; varying vec2 vCorner; varying vec3 vWorld;
void main() {
    vec4 c = modelMatrix * vec4(position, 1.0); float s = size * length(modelMatrix[0].xyz);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vWorld = c.xyz + (right * corner.x + up * corner.y) * s; vTone = tone; vCorner = corner;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
}`;
const HALO = `uniform vec3 air; uniform float haze, hazeFar, level, lamp, haloLevel;
varying vec3 vTone; varying vec2 vCorner; varying vec3 vWorld;
${PORTAL}
void main() {
    float r2 = dot(vCorner, vCorner); if (lamp < .02 || r2 > 1. || !throughWindow(vWorld)) discard;
    float a = (exp(-r2 * 7.) * .8 + exp(-r2 * 2.2) * .2) * (1. - r2);
    gl_FragColor = vec4(vTone * a * lamp * haloLevel, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
const SKY_VERTEX = `varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SKY = `uniform vec3 zenith, horizon, sunLocal, sunColor, wOut, wRight; uniform float sunPower, clouds, stars, level, drift, nearZ; uniform mat4 portalInv;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.; a *= .5; } return v; }
void main() {
    vec3 view = vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]);
    if (isOrthographic ? (mat3(portalInv) * view).z > -1e-5 : (portalInv * vec4(cameraPosition, 1.)).z <= nearZ) discard;   // from outside the wall: nothing
    vec3 dir = isOrthographic ? view : normalize(vWorld - cameraPosition);
    vec3 sunDir = normalize(wRight * sunLocal.x + vec3(0., sunLocal.y, 0.) + wOut * sunLocal.z);
    float up = dir.y;
    vec3 c = mix(horizon, zenith, pow(smoothstep(-.02, .62, up), .75));
    c = mix(c, horizon * .92, smoothstep(.0, -.12, up));            // below the horizon: the far air (behind the scenery)
    float s = max(dot(dir, sunDir), 0.);
    c += sunColor * sunPower * (pow(s, 900.) * 1.6 + pow(s, 40.) * .32 + pow(s, 5.) * .1);
    // stars after dark: sparse points, fewer toward the horizon's glow
    if (stars > .01) { vec2 g = floor(vec2(atan(dir.x, dir.z), asin(clamp(up, -1., 1.))) * 420.); float h = hash(g);
        c += vec3(.75, .8, 1.) * step(.9975, h) * (.35 + .65 * hash(g + 7.)) * stars * smoothstep(.04, .3, up) * .5; }
    // clouds on a level sheet above: soft, lit from the sun's side, thinning toward the horizon
    vec2 q = vec2(dot(dir, wRight), dot(dir, wOut)) / max(up + .16, .1) * 1.15 + vec2(drift, 0.);
    float n = fbm(q + 3.7), cover = smoothstep(1. - clouds * .62, 1.08 - clouds * .3, n + .32) * smoothstep(-.01, .16, up);
    vec3 cloud = mix(horizon, vec3(1.), .55) * (.82 + .18 * fbm(q * 2.3)) + sunColor * sunPower * .12 * pow(s, 3.);
    c = mix(c, cloud * mix(.5, 1., smoothstep(0., .6, max(max(zenith.r, zenith.g), zenith.b) * 2.)), cover * .78);
    gl_FragColor = vec4(c * level, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

// Which view a window shows: 'photo' (window-vista.mjs), 'scenery' (this module) or 'painted' (the room's own canvas,
// the look before the photographs). Asked for with `?window=scenery` in the address, localStorage
// `ergoflex.windowView`, or globalThis.__efWindowView (a film or a test); otherwise DEFAULT_VIEW for the room.
const VIEWS = ['photo', 'scenery', 'painted'];
export function windowView(room) {
    let stored = null; try { stored = globalThis.localStorage?.getItem('ergoflex.windowView'); } catch { /* no storage */ }
    let asked = null; try { asked = new URLSearchParams(globalThis.location?.search || '').get('window'); } catch { /* no address */ }
    const view = globalThis.__efWindowView || asked || stored;
    return VIEWS.includes(view) ? view : DEFAULT_VIEW[room] ?? DEFAULT_VIEW['*'];
}

// Built scenes, kept for when the room is rebuilt (switching hours rebuilds rooms in places; building a scene takes a
// moment). The last few are kept.
const BUILT = new Map(), KEEP = 4;
function built(name, key, make) {
    let entry = BUILT.get(key);
    if (entry) { BUILT.delete(key); BUILT.set(key, entry); return entry; }
    entry = make(); BUILT.set(key, entry);
    while (BUILT.size > KEEP) { const [old, e] = BUILT.entries().next().value; BUILT.delete(old); if (!e.users) for (const g of e.geometries) g.dispose(); else e.evicted = true; }
    return entry;
}

const rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), v = new THREE.Vector3(), box = new THREE.Box3(), size = new THREE.Vector3();
const halfOf = (pane, options) => {
    const g = pane.geometry; if (!g.boundingBox) g.computeBoundingBox(); box.copy(g.boundingBox).getSize(size);
    return new THREE.Vector2((options.width ?? size.x * pane.scale.x) / 2, (options.height ?? size.y * pane.scale.y) / 2);
};
const outward = pane => { const q = new THREE.Quaternion(); pane.getWorldQuaternion(q); return new THREE.Vector3(0, 0, -1).applyQuaternion(q); };

// panes: a window's view mesh, or several (its local +Z faces the room). The panes are grouped by the way they face; each
// group is one world seen through all of its openings. Options:
//   floor: the room's floor below the first pane's centre (negative, in the panes' units; default -1550)
//   width, height: the opening, when there is one pane and its geometry is not the opening's size
//   seed, variant: which of a scene's variants and arrangements (two rooms with "a city" do not see the same street)
//   storey: how far the room's floor is above the ground outside (mm; a scene has its own default)
//   hour: to start with
// Place the panes first (attach after any rotation is set). Returns { group, groups, setHour(hour), sky, materials,
// triangles, dispose() }.
export function attachScenery(panes, name, options = {}) {
    const scene = SCENES[name]; if (!scene) throw Error('No window scenery "' + name + '".');
    const list = (Array.isArray(panes) ? panes : [panes]).filter(Boolean); if (!list.length) throw Error('Window scenery "' + name + '" needs a pane.');
    for (const pane of list) pane.updateWorldMatrix(true, false);
    const facings = [];
    for (const pane of list) { const out = outward(pane), same = facings.find(f => f.out.dot(out) > .99); if (same) same.panes.push(pane); else facings.push({ out, panes: [pane] }); }
    const first = list[0], scaleWorld = first.matrixWorld.getMaxScaleOnAxis(), floorWorld = first.getWorldPosition(new THREE.Vector3()).y + (options.floor ?? -1550) * scaleWorld;
    const worlds = facings.map((f, facing) => world(f.panes, name, scene, { ...options, facing, floor: (floorWorld - f.panes[0].getWorldPosition(v).y) / scaleWorld, single: list.length === 1 }));
    const setHour = id => { for (const w of worlds) w.setHour(id); };
    setHour(options.hour || 'afternoon');
    return { group: worlds[0].group, groups: worlds.map(w => w.group), setHour, sky: worlds[0].sky, materials: worlds.flatMap(w => w.materials), worlds,
        triangles: worlds.reduce((n, w) => n + w.triangles, 0), dispose: () => worlds.forEach(w => w.dispose()) };
}

function world(panes, name, scene, options) {
    const frame = panes[0], parent = frame.parent;
    inv.copy(frame.matrixWorld).invert();
    const openings = panes.map(pane => { rel.multiplyMatrices(inv, pane.matrixWorld); const at = new THREE.Vector3().setFromMatrixPosition(rel), half = halfOf(pane, options.single ? options : {});
        return { pane, at, half }; });
    const group = new THREE.Group(); group.name = 'Window scenery · ' + name + (options.facing ? ' · ' + options.facing : ''); group.position.copy(frame.position); group.quaternion.copy(frame.quaternion); parent.add(group);
    const portal = { portalInv: { value: new THREE.Matrix4() }, openAt: { value: openings.map(o => o.at.clone()) }, openHalf: { value: openings.map(o => o.half.clone()) } };
    const defines = { OPENINGS: openings.length };
    // the scene, built in the window's frame (or taken from the ones already built)
    const seed = (options.seed ?? 20261113) + options.facing * 7919, round = x => Math.round(x / 10) * 10;
    const ctx = { openings: openings.map(o => ({ x: o.at.x, y: o.at.y, z: o.at.z, w: o.half.x * 2, h: o.half.y * 2 })), floor: options.floor, facing: options.facing, variant: options.variant, seed, storey: options.storey ?? scene.storey ?? 0 };
    ctx.left = Math.min(...ctx.openings.map(o => o.x - o.w / 2)); ctx.right = Math.max(...ctx.openings.map(o => o.x + o.w / 2));
    ctx.bottom = Math.min(...ctx.openings.map(o => o.y - o.h / 2)); ctx.top = Math.max(...ctx.openings.map(o => o.y + o.h / 2)); ctx.near = Math.min(...ctx.openings.map(o => o.z));
    ctx.width = ctx.right - ctx.left; ctx.height = ctx.top - ctx.bottom; ctx.ground = ctx.floor - ctx.storey;
    const key = [name, options.variant, seed, ctx.storey, round(ctx.floor), ...ctx.openings.flatMap(o => [round(o.x), round(o.y), round(o.z), round(o.w), round(o.h)])].join('|');
    const entry = built(name, key, () => {
        const k = { land: new Builder(scene.sun || SUN), lights: new Builder(scene.sun || SUN), halos: new Halos(), r: rand(seed) };
        k.land.view = { cx: (ctx.left + ctx.right) / 2, half: ctx.width / 2 + 3000, slope: 1.6 };   // what the room's cameras can see through the openings
        scene.build(k, ctx);
        const geometries = [k.land.geometry(), k.lights.geometry(), k.halos.geometry()];
        return { geometries, users: 0, triangles: k.land.triangles + k.lights.triangles + k.halos.position.length / 9 };
    });
    entry.users++;
    const shared = { ...portal, tint: { value: new THREE.Vector3(1, 1, 1) }, air: { value: new THREE.Color() }, haze: { value: 0 }, hazeFar: { value: scene.hazeFar ?? 52000 }, level: { value: LEVEL }, lamp: { value: 0 }, lampLevel: { value: scene.lampLevel ?? 1 }, haloLevel: { value: scene.haloLevel ?? 1 } };
    const material = lamp => { const m = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERTEX, fragmentShader: LAND, defines: lamp ? { ...defines, LAMP: 1 } : defines, side: THREE.DoubleSide }); m.name = 'Window scenery' + (lamp ? ' lights' : ''); return m; };
    const haloMaterial = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: HALO_VERTEX, fragmentShader: HALO, defines, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    haloMaterial.name = 'Window scenery halos';
    const [landGeometry, lightGeometry, haloGeometry] = entry.geometries;
    const land = new THREE.Mesh(landGeometry, material(false)), glow = new THREE.Mesh(lightGeometry, material(true)), halos = new THREE.Mesh(haloGeometry, haloMaterial);
    land.name = 'Window scenery land'; glow.name = 'Window scenery lights'; halos.name = 'Window scenery halos';
    [land, glow, halos].forEach((mesh, i) => { mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = -10 + i; mesh.userData.windowScenery = true; group.add(mesh); });
    const sky = new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY, depthWrite: false, side: frame.material?.side ?? THREE.FrontSide, uniforms: {
        portalInv: portal.portalInv, nearZ: { value: Math.min(...openings.map(o => o.at.z)) - 5 },
        zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunLocal: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunPower: { value: 0 },
        clouds: { value: .4 }, stars: { value: 0 }, level: { value: LEVEL }, drift: { value: 0 }, wOut: { value: new THREE.Vector3(0, 0, -1) }, wRight: { value: new THREE.Vector3(1, 0, 0) } } });
    sky.name = 'Window sky · ' + name;
    const befores = new Map();
    for (const { pane } of openings) {
        pane.userData.paintedMaterial ||= pane.material; pane.userData.viewMaterial = pane.material; pane.material = sky; pane.userData.windowScenery = name; pane.userData.sceneryRenderOrder = pane.renderOrder; pane.renderOrder = -20;
        befores.set(pane, pane.onBeforeRender);
    }
    // where the window is: the frame follows the first pane, the openings follow theirs; straight out and right, level
    const quaternion = new THREE.Quaternion(), out = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const sync = () => {
        group.position.copy(frame.position); group.quaternion.copy(frame.quaternion); group.updateWorldMatrix(true, false); portal.portalInv.value.copy(group.matrixWorld).invert();
        openings.forEach((o, i) => { o.pane.updateWorldMatrix(true, false); portal.openAt.value[i].setFromMatrixPosition(rel.multiplyMatrices(portal.portalInv.value, o.pane.matrixWorld)); });
        frame.getWorldQuaternion(quaternion); out.set(0, 0, -1).applyQuaternion(quaternion); out.y = 0; if (out.lengthSq() < 1e-6) return; out.normalize(); right.crossVectors(out, UP).normalize();
        sky.uniforms.wOut.value.copy(out); sky.uniforms.wRight.value.copy(right);
    };
    for (const { pane } of openings) { const before = befores.get(pane); pane.onBeforeRender = function (...args) { sync(); before?.apply(this, args); }; }
    land.onBeforeRender = sync;
    sync();
    const setHour = id => {
        const h = hourOf(name, id), a = THREE.MathUtils.degToRad(h.sun[0]), e = THREE.MathUtils.degToRad(h.sun[1]);
        shared.tint.value.fromArray(h.tint); shared.air.value.set(h.air); shared.haze.value = h.haze; shared.lamp.value = h.lamp;
        const s = sky.uniforms; s.zenith.value.set(h.zenith); s.horizon.value.set(h.horizon); s.sunColor.value.set(h.sun[2]); s.sunPower.value = h.sun[3]; s.clouds.value = h.clouds; s.stars.value = h.stars ?? 0;
        s.sunLocal.value.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    };
    const dispose = () => {
        for (const { pane } of openings) { pane.onBeforeRender = befores.get(pane) || (() => {}); pane.material = pane.userData.viewMaterial; pane.renderOrder = pane.userData.sceneryRenderOrder ?? 0; delete pane.userData.windowScenery; }
        group.removeFromParent(); land.material.dispose(); glow.material.dispose(); haloMaterial.dispose(); sky.dispose();
        entry.users--; if (entry.evicted && !entry.users) for (const g of entry.geometries) g.dispose();
    };
    return { group, setHour, sky, materials: [land.material, glow.material, haloMaterial, sky], triangles: entry.triangles, openings: ctx.openings, dispose };
}
