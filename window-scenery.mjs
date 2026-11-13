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
// - Its own light. The scenery is not lit by the room's lamps (they would reach it through the wall): the shader lights
//   it with the hour's sun and sky, so the shade is on the side away from the sun in the sky; occlusion (under a car, a
//   tree, at a wall's foot) is baked into each vertex's colour, and so is the light its street lamps and lit windows
//   throw after dark. Every hour's values are uniforms, so the film's time-of-day blend (film-tod) carries them from one
//   hour to the next.
// - Calm. LEVEL scales the brightness of everything outside; haze takes far things toward the sky's colour.
// - The sky is drawn on the pane by view direction (it is at infinity): a gradient, a soft sun or moon, slow clouds,
//   stars after dark.
//
// Per world: one mesh for the land, one of foliage (leaf cards cut out of a generated texture), one for what glows
// after dark, one of soft halos round the lamps; two small generated textures shared by every world (window-scenery-kit
// sharedTextures). The land is lit in the shader by the hour's sun and sky (its normals are uploaded), with the
// occlusion under cars, trees and at buildings' feet baked into its colour; far things go into the air by distance. The
// geometry is kept and reused when the room is rebuilt.
import * as THREE from 'three';
import { Builder, Leaves, Halos, rand, sharedTextures } from './window-scenery-kit.mjs?v=polish-20261113b';
import { SCENES } from './window-scenery-scenes.mjs?v=polish-20261113b';
export { SCENES };

// One number for how bright the world outside is against the room (the sky and the land alike).
export const LEVEL = .8;

// What every room's windows show unless asked otherwise ('photo', 'scenery' or 'painted'). '*' is every room; a room's
// id (home, creative, library, library-humboldt, occmedialab, highschool, gym, gaming, music, workshop, lounge,
// lounge-contemporary, ...) overrides it for that room. Making scenery the default is one line here: '*': 'scenery',
// or e.g. music: 'scenery' for one room.
export const DEFAULT_VIEW = { '*': 'photo' };

// The hour outside. tint: what the light does to the land's colours. zenith / horizon: the sky. sun: [degrees to the
// right of straight out, degrees up, colour, strength in the sky] (the moon after dark). light: [how much the sky lights
// the land, how much the sun does]. clouds: 0..1. lamp: lit windows, street and garden lights. haze: how much far
// things take the colour of the air. stars: after dark.
// A scene may adjust any of these for its place (SCENES[name].hours), e.g. a marine layer or a city's glow.
// Party is an ordinary late evening outside (the room's own party lights carry the mood; M7 of the November 13 review).
export const HOURS = {
    morning:   { tint: [1.0, .95, .86], zenith: '#7aabd2', horizon: '#e6d8c2', sun: [-52, 13, '#ffe2b0', .8], light: [.62, .62], clouds: .42, lamp: 0, haze: .42, air: '#dcd6ca', stars: 0 },
    afternoon: { tint: [.98, .99, .97], zenith: '#7aa9cf', horizon: '#dbe3e6', sun: [48, 50, '#fff4e2', .45], light: [.58, .7], clouds: .5, lamp: 0, haze: .34, air: '#d3dbe0', stars: 0 },
    evening:   { tint: [.78, .62, .55], zenith: '#55628c', horizon: '#e49c6c', sun: [38, 5, '#ff9f5c', 1.0], light: [.6, .75], clouds: .55, lamp: .5, haze: .55, air: '#b88a74', stars: 0 },
    night:     { tint: [.11, .135, .21], zenith: '#09101f', horizon: '#1d2a40', sun: [30, 36, '#c9d6f0', .22], light: [.8, .3], clouds: .2, lamp: 1, haze: .45, air: '#151d30', stars: 1 },
    party:     { tint: [.13, .14, .22], zenith: '#0c1226', horizon: '#2a2a40', sun: [-40, 30, '#d0d4ec', .2], light: [.8, .3], clouds: .25, lamp: 1, haze: .45, air: '#1b1e30', stars: .6 }
};
export const hourOf = (name, id) => ({ ...(HOURS[id] || HOURS.afternoon), ...(SCENES[name]?.hours?.all || {}), ...(SCENES[name]?.hours?.[id] || {}) });

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
// (position is in the window's frame: the meshes sit in a group that is the frame)
const VERTEX = `attribute vec3 tone; attribute vec3 glow; varying vec3 vTone; varying vec3 vGlow; varying vec3 vWorld; varying vec3 vFrame; varying vec3 vNormal;
#ifdef LEAVES
varying vec2 vUv;
#endif
void main() { vTone = tone; vGlow = glow; vFrame = position; vNormal = normal;
    #ifdef LEAVES
    vUv = uv;
    #endif
    vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// The land: its colour lit by the sky (a hemisphere, the ground's bounce below) and the sun (the hour's direction, so
// shade falls on the side away from the sun in the sky), a grain from the noise on walls and ground, into the air by
// distance, a little greyer after dark; the lamps' light on top.
const LAND = `uniform vec3 tint, air, sunDirF, sunLight, skyLight, groundLight; uniform float haze, hazeFar, level, lamp, lampLevel, ambient, sunShare, facadeLit;
uniform sampler2D noiseMap;
#ifdef LEAVES
uniform sampler2D leafMap; varying vec2 vUv;
#endif
varying vec3 vTone; varying vec3 vGlow; varying vec3 vWorld; varying vec3 vFrame; varying vec3 vNormal;
${PORTAL}
float cellHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
    if (!throughWindow(vWorld)) discard;
    vec3 tone = vTone, lit = vec3(0.);
    #ifdef LEAVES
    if (vUv.x >= 0.) { vec4 t = texture2D(leafMap, vUv); float lod = log2(max(length(dFdx(vUv)), length(dFdy(vUv))) * 512.);
        if (t.a * (1. + clamp(lod, 0., 5.) * .3) < .45) discard; tone *= t.r * 1.4; }   // (alpha holds up in the small mip levels, so far crowns keep their mass)
    else tone *= .78 + .44 * texture2D(noiseMap, vFrame.xy / 2600.).b;
    #endif
    float d = length(vFrame.xz), h = haze * (1. - exp(-1.7 * d / hazeFar)) + (1. - haze) * (1. - exp(-d / (hazeFar * 8.)));   // the air: near things keep their colour, far ones go into it
    #ifdef LAMP
    if (lamp < .02) discard;
    vec2 gv = abs(vNormal.x) > abs(vNormal.z) ? vFrame.zy : vFrame.xy; float v = texture2D(noiseMap, gv / 3600.).r;
    vec3 c = mix(tone * (.35 + 1.1 * v * v), air * level, h * .5) * lamp * lampLevel;   // a room's light is uneven: a lamp, a curtain
    #else
    float nl = length(vNormal); vec3 light;
    if (nl < .3) light = tint * (ambient + sunShare * .3);
    else {
        vec3 n = vNormal / nl, s = normalize(sunDirF);
        float ndl = dot(n, s);
        #ifdef LEAVES
        ndl = max(ndl * .55 + .45, 0.);
        #else
        ndl = nl < .72 ? abs(ndl) * .75 : max(ndl, 0.);
        if (nl > .72 && nl < .93) {   // a facade drawn as a grid of windows (far blocks and towers): glass darker, a few lit after dark
            vec2 fc = vec2(abs(n.x) > .7 ? vFrame.z : vFrame.x, vFrame.y) / vec2(3300., 3400.), fw = fwidth(fc), f = fract(fc);
            float blur = clamp(max(fw.x, fw.y) * 2.5 - .4, 0., 1.), win = step(.26, f.x) * step(f.x, .74) * step(.28, f.y) * step(f.y, .8);
            float on = step(cellHash(floor(fc)), facadeLit) * (.5 + .5 * cellHash(floor(fc) + 7.));
            win = mix(win, .22, blur); on = mix(on * win, facadeLit * .15, blur);
            tone = mix(tone, tone * .3 + vec3(.035, .04, .05), win); lit = vec3(1., .78, .52) * on * .45;
        }
        vec2 g = abs(n.y) > .6 ? vFrame.xz : vec2(vFrame.x + vFrame.z, vFrame.y);
        tone *= .8 + .4 * dot(texture2D(noiseMap, g / 6400.), vec4(.36, .3, .22, .12));
        #endif
        light = tint * (ambient * mix(groundLight, skyLight, n.y * .5 + .5) + sunShare * sunLight * ndl);
    }
    vec3 day = tone * light;
    day = mix(day, vec3(dot(day, vec3(.3, .59, .11))), lamp * .35);   // after dark colours go grey
    vec3 c = mix(day, air, h) * level + (vGlow + lit) * lamp * level * (1. - h * .6);
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
// The sea (a scene that has one): a level plane far out, its colour the sky it reflects (more of it toward the
// horizon) over the water's own, the sun's (or moon's) glitter broken into soft sparkles, fading into the horizon's haze.
const SEA_AT = `
float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 seaAt(vec3 view, vec3 sunDir, vec2 spot) {
    float down = clamp(-view.y, 0., 1.), fres = exp(-down * 12.);
    float day = clamp(dot(zenith, vec3(.3, .59, .11)) * 4., .06, 1.);   // the water's own colour is lit by the day (dark at night)
    vec3 c = mix(seaColor * day * (.55 + .45 * clamp(sunDir.y * 2. + .3, 0., 1.)), mix(horizon, zenith, .45), .1 + .28 * fres);
    vec3 r = reflect(view, vec3(0., 1., 0.)); float s = max(dot(r, sunDir), 0.), s2 = s * s, s6 = s2 * s2 * s2;
    vec2 g = spot / 1800., cell = floor(g), f = fract(g) - .5; float sparkle = step(.55, seaHash(cell)) * (.5 + .5 * seaHash(cell + 3.1)) * smoothstep(.5, .1, length(f));
    float s48 = s6 * s6; s48 *= s48; s48 *= s48;
    c += sunColor * sunPower * (s48 * 1.4 * sparkle + s6 * .12);
    return mix(c, horizon * .92, exp(-down * 220.) * .45);           // into the haze at the horizon
}`;
const SEA = `uniform vec3 zenith, horizon, sunLocal, sunColor, wOut, wRight, seaColor; uniform float sunPower, level;
varying vec3 vWorld;
${PORTAL}
${SEA_AT}
void main() {
    if (!throughWindow(vWorld)) discard;
    vec3 view = isOrthographic ? vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]) : normalize(vWorld - cameraPosition);
    vec3 sunDir = normalize(wRight * sunLocal.x + vec3(0., sunLocal.y, 0.) + wOut * sunLocal.z);
    gl_FragColor = vec4(seaAt(view, sunDir, (portalInv * vec4(vWorld, 1.)).xz) * level, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
const SKY_VERTEX = `varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// The sky on the pane, by view direction: a gradient, the sun or moon, soft clouds (two fetches of the noise texture,
// coloured from the sky itself, so they go dark with it at night), stars as soft points sized to the pixel. drift moves
// the clouds (left at 0: they stand still unless a film animates it).
const SKY = `uniform vec3 zenith, horizon, sunLocal, sunColor, wOut, wRight, seaColor; uniform float sunPower, clouds, stars, level, drift, nearZ, sea; uniform mat4 portalInv;
uniform sampler2D noiseMap;
varying vec3 vWorld;
${SEA_AT}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fbmT(vec2 p) { return dot(texture2D(noiseMap, p), vec4(.48, .26, .16, .1)); }
void main() {
    vec3 view = vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2]);
    if (isOrthographic ? (mat3(portalInv) * view).z > -1e-5 : (portalInv * vec4(cameraPosition, 1.)).z <= nearZ) discard;   // from outside the wall: nothing
    vec3 dir = isOrthographic ? view : normalize(vWorld - cameraPosition);
    vec3 sunDir = normalize(wRight * sunLocal.x + vec3(0., sunLocal.y, 0.) + wOut * sunLocal.z);
    float up = dir.y;
    vec3 c = mix(horizon, zenith, pow(smoothstep(-.02, .62, up), .75));
    if (up < 0.) { c = mix(c, horizon * .92, smoothstep(.0, -.12, up));            // below the horizon: the far air (behind the scenery)
        if (sea > .5) c = up > -.035 ? seaAt(dir, sunDir, dir.xz / max(-up, 1e-4) * 9e5) : mix(horizon, seaColor, .5); }   // beyond the modelled sea: more of it, to the horizon (lower down the sea mesh covers it: a plain colour there)
    float s = max(dot(dir, sunDir), 0.), s2 = s * s, s5 = s2 * s2 * s, s40 = s5 * s5; s40 *= s40; s40 *= s40;
    c += sunColor * sunPower * (pow(s, 900.) * 1.6 + s40 * .32 + s5 * .1);
    // stars after dark: sparse soft points, fewer toward the horizon's glow
    if (stars > .01 && up > .03) { vec2 a = vec2(atan(dir.x, dir.z), asin(clamp(up, -1., 1.))) * 420., g = floor(a); float h = hash(g);
        if (h > .9975) { vec2 f = fract(a) - .5 - (vec2(hash(g + 3.), hash(g + 5.)) - .5) * .5; float px = max(fwidth(a.x), 1e-4), r = max(.07, px * .8);
            c += vec3(.75, .8, 1.) * (.35 + .65 * hash(g + 7.)) * stars * smoothstep(.04, .3, up) * .5 * smoothstep(r, r * .25, length(f)) * min(1., .2 / px); } }
    // clouds on a level sheet above: soft-edged, lit from the sun's side, coloured from the sky, thinning toward the horizon
    if (clouds > .01 && up > -.01) {
        vec2 q = vec2(dot(dir, wRight), dot(dir, wOut)) / max(up + .16, .1) * .085 + vec2(drift, 0.);
        float n = fbmT(q) * .62 + fbmT(q * 2.71 + .37) * .38;
        float cover = smoothstep(1. - clouds * .62, 1.36 - clouds * .5, n + .3) * smoothstep(-.01, .2, up);
        vec3 grey = vec3(dot(horizon, vec3(.33))), lit = mix(horizon, grey, .35) * 1.04, shade = mix(zenith, horizon, .55) * .86;
        vec3 cloud = mix(shade, lit, smoothstep(.35, .8, n)) + sunColor * sunPower * .2 * s2 * s;
        c = mix(c, cloud, cover * .85);
    }
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
// moment). The last few are kept; a scene pushed out is freed on the GPU (a room still showing it uploads it again). The
// meshes are marked sharedProp so the room's own disposal (workspace-3d disposeTree) leaves the kept geometry alone and
// frees only their materials.
const BUILT = new Map(), KEEP = 4;
const geometriesOf = e => [e.land, e.lights, e.halos, e.leaves, e.sea].filter(Boolean);
function built(key, make) {
    let entry = BUILT.get(key);
    if (entry) { BUILT.delete(key); BUILT.set(key, entry); return entry; }
    entry = make(); BUILT.set(key, entry);
    while (BUILT.size > KEEP) { const [old, e] = BUILT.entries().next().value; BUILT.delete(old); for (const g of geometriesOf(e)) g.dispose(); }
    return entry;
}

const rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), v = new THREE.Vector3(), box = new THREE.Box3(), size = new THREE.Vector3();
// (an opening's size is the pane's geometry times its own scale; a scaled frame pane is not supported: the group copies
// the first pane's position and turn, not its scale)
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

// Draw order: the pane (the sky) first, without depth; the room; then the land, so the room's walls reject what is
// behind them before it is shaded (it is only ever seen through the openings).
export const ORDER = { pane: -20, sea: 9, land: 10, leaves: 11, lights: 12, halos: 13 };

function world(panes, name, scene, options) {
    const frame = panes[0], parent = frame.parent;
    inv.copy(frame.matrixWorld).invert();
    const openings = panes.map(pane => { rel.multiplyMatrices(inv, pane.matrixWorld); const at = new THREE.Vector3().setFromMatrixPosition(rel), half = halfOf(pane, options.single ? options : {});
        return { pane, at, half }; });
    const group = new THREE.Group(); group.name = 'Window scenery · ' + name + (options.facing ? ' · ' + options.facing : ''); group.position.copy(frame.position); group.quaternion.copy(frame.quaternion); parent.add(group);
    const portal = { portalInv: { value: new THREE.Matrix4() }, openAt: { value: openings.map(o => o.at.clone()) }, openHalf: { value: openings.map(o => o.half.clone()) } };
    const defines = { OPENINGS: openings.length }, tex = sharedTextures();
    // the scene, built in the window's frame (or taken from the ones already built)
    const seed = (options.seed ?? 20261113) + options.facing * 7919, round = x => Math.round(x / 10) * 10;
    const ctx = { openings: openings.map(o => ({ x: o.at.x, y: o.at.y, z: o.at.z, w: o.half.x * 2, h: o.half.y * 2 })), floor: options.floor, facing: options.facing, variant: options.variant, seed, storey: options.storey ?? scene.storey ?? 0 };
    ctx.left = Math.min(...ctx.openings.map(o => o.x - o.w / 2)); ctx.right = Math.max(...ctx.openings.map(o => o.x + o.w / 2));
    ctx.bottom = Math.min(...ctx.openings.map(o => o.y - o.h / 2)); ctx.top = Math.max(...ctx.openings.map(o => o.y + o.h / 2)); ctx.near = Math.min(...ctx.openings.map(o => o.z));
    ctx.width = ctx.right - ctx.left; ctx.height = ctx.top - ctx.bottom; ctx.ground = ctx.floor - ctx.storey;
    const key = [name, options.variant, seed, ctx.storey, round(ctx.floor), ...ctx.openings.flatMap(o => [round(o.x), round(o.y), round(o.z), round(o.w), round(o.h)])].join('|');
    const entry = built(key, () => {
        const k = { land: new Builder(), lights: new Builder(), halos: new Halos(), r: rand(seed) };
        k.leaves = k.land.leaves = new Leaves(k.land);
        // what the room's cameras can see through the openings: a wedge, wider past 15 m (oblique cameras)
        k.land.view = { cx: (ctx.left + ctx.right) / 2, half: ctx.width / 2 + 3000, slope: 1.6, far: 2.8 };
        scene.build(k, ctx);
        const e = { land: k.land.geometry(), lights: k.lights.geometry(), halos: k.halos.geometry(), leaves: k.leaves.position.length ? k.leaves.geometry() : null, sea: null, seaSpec: k.sea || null };
        if (k.sea) { const { y, x0, x1, z0, z1 } = k.sea; e.sea = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2); }
        e.hazeFar = k.hazeFar; e.triangles = k.land.triangles + k.lights.triangles + k.leaves.triangles + k.halos.position.length / 9;
        return e;
    });
    const shared = { ...portal, tint: { value: new THREE.Vector3(1, 1, 1) }, air: { value: new THREE.Color() }, haze: { value: 0 }, hazeFar: { value: entry.hazeFar ?? scene.hazeFar ?? 52000 }, level: { value: LEVEL }, lamp: { value: 0 },
        lampLevel: { value: scene.lampLevel ?? 1 }, haloLevel: { value: scene.haloLevel ?? 1 }, ambient: { value: .6 }, sunShare: { value: .7 }, facadeLit: { value: scene.facadeLit ?? .14 },
        sunDirF: { value: new THREE.Vector3(0, 1, 0) }, sunLight: { value: new THREE.Color(1, 1, 1) }, skyLight: { value: new THREE.Color(1, 1, 1) }, groundLight: { value: new THREE.Color(.5, .5, .5) },
        noiseMap: { value: tex.noise }, leafMap: { value: tex.leaves } };
    const material = kind => { const m = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERTEX, fragmentShader: LAND, defines: kind ? { ...defines, [kind]: 1 } : defines, side: THREE.DoubleSide });
        m.name = 'Window scenery' + (kind ? ' ' + kind.toLowerCase() : ''); return m; };
    const haloMaterial = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: HALO_VERTEX, fragmentShader: HALO, defines, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    haloMaterial.name = 'Window scenery halos';
    const land = new THREE.Mesh(entry.land, material(null)), glow = new THREE.Mesh(entry.lights, material('LAMP')), halos = new THREE.Mesh(entry.halos, haloMaterial);
    const leaves = entry.leaves ? new THREE.Mesh(entry.leaves, material('LEAVES')) : null;
    land.name = 'Window scenery land'; glow.name = 'Window scenery lights'; halos.name = 'Window scenery halos'; if (leaves) leaves.name = 'Window scenery leaves';
    const meshes = [[land, ORDER.land], [glow, ORDER.lights], [halos, ORDER.halos], ...(leaves ? [[leaves, ORDER.leaves]] : [])];
    const keep = mesh => { mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.userData.windowScenery = true; mesh.userData.sharedProp = true; mesh.ownedMaterials = [mesh.material]; group.add(mesh); };
    for (const [mesh, order] of meshes) { mesh.renderOrder = order; keep(mesh); }
    const sky = new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY, depthWrite: false, side: frame.material?.side ?? THREE.FrontSide, uniforms: {
        portalInv: portal.portalInv, nearZ: { value: Math.min(...openings.map(o => o.at.z)) - 5 },
        zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunLocal: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunPower: { value: 0 },
        clouds: { value: .4 }, stars: { value: 0 }, level: { value: LEVEL }, drift: { value: 0 }, wOut: { value: new THREE.Vector3(0, 0, -1) }, wRight: { value: new THREE.Vector3(1, 0, 0) },
        seaColor: { value: new THREE.Color(entry.seaSpec?.color || '#3a5f75') }, sea: { value: entry.seaSpec ? 1 : 0 }, noiseMap: { value: tex.noise } } });
    sky.name = 'Window sky · ' + name;
    let sea = null;
    if (entry.sea) {
        const u = sky.uniforms, seaMaterial = new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SEA, defines, side: THREE.DoubleSide, uniforms: { ...portal,
            zenith: u.zenith, horizon: u.horizon, sunLocal: u.sunLocal, sunColor: u.sunColor, sunPower: u.sunPower, wOut: u.wOut, wRight: u.wRight, level: u.level, seaColor: u.seaColor } });
        seaMaterial.name = 'Window sea · ' + name;
        sea = new THREE.Mesh(entry.sea, seaMaterial); sea.name = 'Window scenery sea'; sea.renderOrder = ORDER.sea; keep(sea);
    }
    const befores = new Map();
    for (const { pane } of openings) {
        pane.userData.paintedMaterial ||= pane.material; pane.userData.viewMaterial = pane.material; pane.material = sky; pane.userData.windowScenery = name; pane.userData.sceneryRenderOrder = pane.renderOrder; pane.renderOrder = ORDER.pane;
        if (!pane.replacedMaterials?.includes(pane.userData.viewMaterial)) pane.replacedMaterials = [...(pane.replacedMaterials || []), pane.userData.viewMaterial];   // freed with the room
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
    const lum = c => .3 * c.r + .59 * c.g + .11 * c.b, toneOf = (c, white) => c.multiplyScalar(1 / Math.max(lum(c), 1e-4)).lerp(new THREE.Color(1, 1, 1), white);
    const setHour = id => {
        const h = hourOf(name, id), a = THREE.MathUtils.degToRad(h.sun[0]), e = THREE.MathUtils.degToRad(h.sun[1]), [amb, sun] = h.light || [.6, .7];
        shared.tint.value.fromArray(h.tint); shared.air.value.set(h.air); shared.haze.value = h.haze; shared.lamp.value = h.lamp; shared.ambient.value = amb; shared.sunShare.value = sun;
        const s = sky.uniforms; s.zenith.value.set(h.zenith); s.horizon.value.set(h.horizon); s.sunColor.value.set(h.sun[2]); s.sunPower.value = h.sun[3]; s.clouds.value = h.clouds; s.stars.value = h.stars ?? 0;
        s.sunLocal.value.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
        // the land's light in the window's frame (out is -z): the sun's direction and colour, the sky's and the ground's
        shared.sunDirF.value.set(s.sunLocal.value.x, s.sunLocal.value.y, -s.sunLocal.value.z);
        toneOf(shared.sunLight.value.set(h.sun[2]), .15); toneOf(shared.skyLight.value.copy(s.zenith.value).lerp(s.horizon.value, .35), .5);
        toneOf(shared.groundLight.value.set(h.ground || '#8c8676'), .3).multiplyScalar(.5);
    };
    const dispose = () => {
        for (const { pane } of openings) { pane.onBeforeRender = befores.get(pane) || (() => {}); pane.material = pane.userData.viewMaterial; pane.renderOrder = pane.userData.sceneryRenderOrder ?? 0; delete pane.userData.windowScenery; }
        group.removeFromParent(); for (const [mesh] of meshes) mesh.material.dispose(); sky.dispose(); sea?.material.dispose();
    };
    return { group, setHour, sky, materials: [land.material, glow.material, haloMaterial, ...(leaves ? [leaves.material] : []), sky, ...(sea ? [sea.material] : [])], triangles: entry.triangles, openings: ctx.openings, dispose };
}
