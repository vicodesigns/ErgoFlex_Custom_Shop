// Render-harness-only film effects. render-cut.cjs imports this module inside
// the presentation stage iframe (it shares the page's import map, so 'three'
// is the app's own instance). Nothing in the app imports it; every change it
// makes lives in the disposable, memory-backed stage and is undone by clear().
//
//   fx.install(shot)          after ErgoPresentation.prepare(shot)
//   await fx.frame(t, sec)    before each ErgoPresentation.bakeFrame
//   fx.after()                after each bakeFrame
//   fx.clear()                before the next prepare
//   fx.listScreens(shot)      screen inventory (render-cut --list-screens)
//
// Shot fields (all optional; a shot without them renders exactly as before):
//   screens:[{target, src, offset=0, fit='cover'|'contain'|'stretch', loop=true,
//             rotate=0|90|180|270, flipX=false, brightness=1, rate=1}]
//             brightness may be keyframed [[chapterSeconds, gain], …] (linear), e.g. a screen waking from black.
//             blend:'add' draws the picture additively over the glass (black = the glass's own reflections stay),
//             for a small screen in the frame such as the phone on the desk (target 'phone').
//   screenGain:1   multiplies every screen's brightness (HQ20: 1.3 with film-quality screenBloom .25, the screens' glow cut to a quarter).
//   ledMode:'media'  ledSource=<target or index into screens>  ledPreset='normal'|'calm'|'intense'|'full'
//   ledGlow:0…1   LED brightness as a fraction of full (stage default .35)
//   ledSurfaces:{desktopStrength:0…200, floorStrength, shelfStrength, …}  the app's LED surface sliders
//   deskObjects:{<object id>: {p:{x,y,z}, q:{x,y,z,w}}}  place the featured desk's objects as saved
//   deskFinish:{wood:'<wood finish name, catalog.mjs>', trim:'#hex (a TRIM_COLORS value)'}  the featured desk's wood and
//     trim for this shot, through the configurator's own swatches (#wood-finishes / #trim-palette clicks: the app's
//     species tint, grain photo and trim material), restored after. E.g. the gaming desk: {wood:'Black Birch', trim:'#dc0909'}.
//     in a studio state (the stage resets a layout room's saved desks to the authored defaults)
//   featuredBuild:{woodFinish, baseFinish, trimColor, accessories:[{id, slot}]}  Director Build tab on the featured desk
//     (shot.deskBuild -> importer director-camera 'build' -> here): finishes via the swatches, the desk's complete accessory
//     set with the slot of each (desktop | shelf | lower-shelf | base-shelf), restored after (installFeaturedBuild).
//   sceneDeskPoses:[{desk:'<regex on a room desk's id or name>', height:43.5, tilt:65}]  the room's other ErgoFlex desks
//     (scene-desks.mjs stations, never the featured desk: its pose is the motion model's) set to a height / tilt for the
//     shot, through the app's own rig (rig.updatePose) and auto-stow (desk-auto-stow.mjs), restored after. tilt 65 at
//     43.5 is the Custom Shop's 65° Storage Mode: the desktop's loose objects are put away or hidden as in Studio.
//   sceneBranding:{room, artwork:{surfaces:{<surface>:{<layer>:{name, surface?, enabled?, x?, y?, scale?, rotation?}}}}}  the
//     school stickers / logos of EVERY desk in the room (the featured one too): a sparse overlay on each desk's own artwork
//     (experience/branding-edits.mjs, Director's Branding tab), through the scene desks' artwork rigs, restored after.
//   sceneDeskEdits:[{desk:'<scene desk record id>', size?, pose?:{x,z,yaw}, initial?:{height,tilt}, clips?, build?}]  Director
//     desk edits (experience/desk-edits.mjs, film-desk-edits.mjs): the room's other desks resized, placed and started at a
//     height / tilt, applied after sceneDeskPoses and restored after.
//   ledColor:'#f19c00'  the LED colour for the shot (the app's colour picker), restored after
//   ledGain:1  multiplier on the sampled media-mode pixels (beyond the app's 'full' preset)
//   sceneGlobals:{environmentScale, exposure, exposureScale}  image-based ambient multiplier (or [[s, scale], …]), renderer
//     exposure, and a multiplier on whatever exposure is set (the room's daypart, timeOfDay's blend; number or [[s, k], …]),
//     roomLight: k (or [[s, k], …])  the room's own light (its lights, image-based ambient and architectural bounce) x k,
//     on top of whatever the room/timeOfDay/sceneEdits write (and its painted additive light pools). The desk's LED light (strips, spill, floor bounce, the
//     room LED spill), screens, windows and emissive practicals keep their level, so the desk light reads against a
//     lower-key room the way it does on the dark stage.
//     ledRoomSpill: k  the app's room LED spill (room-led-spill.mjs: the desk strips' light on the room's walls and floor
//     within ~2 m, and their share of the architectural bounce across the room) x k; the desk's own receivers are
//     ledSurfaces / ledReceivers (Vico, HQ16b: the status light "bounces off too many walls").
//     ledWallGlow: k (or [[s, k], …])  the Director's "LED glow on the walls": the room LED spill on everything but the
//     floor (walls, furniture, the LEDs' share of the architectural bounce) x k on top of ledRoomSpill.
//     ledFloorGlow: k (or [[s, k], …])  the Director's "LED glow on the floor": the desk's LED light on the floor and
//     rugs x k: the room LED spill on floor surfaces (at ledRoomSpill x k, whatever the walls take), the visualizer floor
//     bounce and the app's foot glow. Both default to 1, the film's approved look (Vico, 2026-11-06: "the ground is
//     usually a different setting than the walls"). roomLight is the room's OWN light, not the desk's LEDs.
//     ledFloorSources: {foot, center, left, right: {on, x, z (cm; x toward the right wing, z toward the front), spread,
//     length, edge (softness), brightness, saturation (x)}}  the floor reflection of each LED source (film-viewer-leds:
//     the foot glow and the floor bounce's strips); fields left out are the film's (experience/film-lighting.mjs).
//   clock:{from:'08:00', to:'17:30', start=0, end=shot.seconds, ease='linear', second='real'|'clock'|'hide'}
//   timeOfDay:[{at:seconds, mode:'morning'}, …]  (lighting-only interpolation)
//   ledStatus:[{at,dur,kind,mode}], obstacles:[{x,ahead,radius,height,rise}]  see film-status.mjs
//   floorLight:{gain, foot, wings, lobe, max, soft, radius, hideApp}  foot + wing strips lighting the
//     floor (replaces the app's boxed foot glow), see 'floor light' below
//   ledReceivers:'viewer' | {mode:'viewer', …}  the app visualizer's LED receivers (floor bounce, wing glow down the
//     side plates, its wing / desktop constants, indicator level), see film-viewer-leds.mjs. Use instead of floorLight.
//   accessories:{add:['tablet-pc' | {id, role='desktop', x, y, z, rotation, tilt, roll, scale}], remove:[id]}
//     catalog accessories (drafting-kit, artist-easel, keyboards…) are toggled
//     on the prepared desk (and placed if x/z/… are given); library props
//     (e.g. tablet-pc) are added as desk objects. Both after prepare, both undone.
//     visible:[[chapterSeconds, 0|1], …] on an add entry (catalog or library): from each key on, the item is held
//     hidden (0) or shown (1) whatever the app writes (auto-stow, day phases); null hands it back to the app, as
//     before the first key.
//     A library prop with a screen (PROP_SCREENS: 'ergoflex-phone') joins the screen targets as 'phone' ('phone-2', …),
//     so screens:[{target:'phone', src, blend:'add'}] lights its glass; it rides the desk like any desk object.
//     A catalog id already on the preset's desk is listed in add just to time it. E.g. a side shelf that pops in
//     during a tilt the app would hide it at: {id:'painter-shelf', visible:[[0,0],[9.5,1]]}.
import * as THREE from 'three';
import { sampleScreenColours } from '../../led-screen-sampler.mjs';
import { accessory } from '../../catalog.mjs';

const api = window.ErgoFlex;
const sceneRoot = () => { let s = api.loadedModel; while (s?.parent) s = s.parent; return s; };
const shown = o => { for (let p = o; p; p = p.parent) { if (!p.visible || p.layers.mask === 0) return false; } return true; };
const within = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
const slug = s => String(s || '').toLowerCase().replace(/^prop:/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pathOf = (o, root) => { const out = []; for (let p = o; p && p !== root; p = p.parent) out.unshift(p.name || p.type); return out.join(' > '); };
const SCREENISH = /screen|display|monitor|\btv\b|pixels|marquee/i;
const NOT_SCREEN = /bezel|housing|chassis|side.?panel|stand\b|arm\b|mount|bracket|clamp|cable|button|trim|shelf|cabinet\b(?!.*screen)|wall\b|light panels|touch_screen|artwork/i;
// Friendly target aliases (tested against the screen's id and path).
const DEFAULT_INSET = {};
const ALIASES = {
  tv: /Gaming TV display/i, arcade: /game_screen/i, marquee: /marquee/i,
  'occ-display': /Student reel screening display/i, reel: /Student reel screening display/i,
  tablet: /Mic_Sur_P3_display/i,
  'curved-monitor': /wide-monitor.*monitor-screen|stage media/i, media: /stage media/i
};

// Library props whose glass can take a screen clip. The phone's GLB has no single front-glass mesh (its top is a body
// slab plus a bezel rim), so the film adds its own glass: a rounded rectangle in the prop's own metres (rect x0, z0,
// x1, z1 at height y), invisible itself, that the picture is fitted to like any screen mesh. normal / up: the picture's
// facing and up in the prop's axes (the phone lies screen up, +y, its top, the camera end, toward +z).
const PROP_SCREENS = {
  'ergoflex-phone': { rect: [-.0338, -.0712, .0338, .0712], y: .01205, radius: .0088, normal: [0, 1, 0], up: [0, 0, 1], alias: 'phone', label: 'Smartphone screen' }
};
function propGlass(prop, ps) {
  let glass = prop.children.find(c => c.userData.filmFxGlass);
  if (glass) return glass;
  const [x0, z0, x1, z1] = ps.rect, r = ps.radius, shape = new THREE.Shape();
  // In the shape's x/y = the prop's x and -z (rotateX below lays it flat, facing +y).
  shape.moveTo(x0 + r, -z1); shape.lineTo(x1 - r, -z1); shape.quadraticCurveTo(x1, -z1, x1, -z1 + r);
  shape.lineTo(x1, -z0 - r); shape.quadraticCurveTo(x1, -z0, x1 - r, -z0); shape.lineTo(x0 + r, -z0);
  shape.quadraticCurveTo(x0, -z0, x0, -z0 - r); shape.lineTo(x0, -z1 + r); shape.quadraticCurveTo(x0, -z1, x0 + r, -z1);
  const geo = new THREE.ShapeGeometry(shape, 6); geo.rotateX(-Math.PI / 2); geo.translate(0, ps.y, 0);
  glass = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  glass.name = ps.label + ' glass'; glass.userData.filmFxGlass = true; glass.userData.screenNormal = ps.normal; glass.userData.screenUp = ps.up;
  glass.castShadow = glass.receiveShadow = false; glass.raycast = () => {};
  prop.add(glass); return glass;
}

// ---------- discovery ----------
function discover(shot) {
  const scene = sceneRoot(); scene.updateMatrixWorld(true);
  const desk = api.loadedModel, room = api.workspaceRoom?.root, list = [], seen = new Set();
  const push = (obj, info) => {
    if (!obj?.isMesh || seen.has(obj) || !shown(obj) || obj.userData.filmFx || !obj.geometry?.attributes?.position) return;
    seen.add(obj); list.push({ obj, path: pathOf(obj, scene), ...info });
  };
  // The stage's own curved media screen (kind:'media' only).
  scene.traverse(o => { if (o.name === 'Cinematic effects') o.traverse(c => { if (c.isMesh && c.material?.isMeshBasicMaterial && c.material.map?.image instanceof HTMLCanvasElement) push(c, { source: 'stage-media', label: 'Stage media screen (curved)', id: 'media' }); }); });
  const ss = api.sceneScreens; try { ss?.update(true); } catch {}
  for (const e of ss?.entries || []) {
    const main = /:main:/.test(e.key), acc = e.key.split(':').pop();
    push(e.obj, { source: 'scene-screens', key: e.key, label: e.label, portrait: !!e.info?.portrait, main, id: main ? 'main/' + slug(acc) : null });
  }
  // Screens of library props added by accessories.add (the phone on the desk): their glass, with its own frame axes.
  const propN = {};
  scene.traverse(o => {
    const ps = PROP_SCREENS[o.userData.filmFxProp]; if (!ps) return;
    const glass = propGlass(o, ps), n = propN[ps.alias] = (propN[ps.alias] || 0) + 1;
    push(glass, { source: 'prop', label: ps.label, id: 'prop/' + o.userData.filmFxProp + (n > 1 ? '-' + n : ''), alias: ps.alias + (n > 1 ? '-' + n : '') });
  });
  scene.traverse(o => {
    if (!o.isMesh || within(o, desk) || seen.has(o)) return;
    const mats = [].concat(o.material).map(m => m?.name || '').join(' ');
    if (!(SCREENISH.test(o.name) || SCREENISH.test(mats)) || NOT_SCREEN.test(o.name) || /bezel|housing|chassis/i.test(mats)) return;
    push(o, { source: 'mesh', label: o.name || mats });
  });
  // Ids: main-desk monitors keep 'main/<accessory>', the rest a path slug.
  const used = new Set();
  for (const s of list) {
    if (!s.id) { let a = s.obj; while (a.parent && a.parent !== scene && !(a.userData.propId || a.userData.sceneAssetKey || /^Prop:|^Accessory:/.test(a.name))) a = a.parent; s.id = slug(a === s.obj ? s.obj.parent?.name : a.name) + '/' + slug(s.obj.name || s.label); }
    let id = s.id, n = 2; while (used.has(id)) id = s.id + '-' + n++; s.id = id; used.add(id);
  }
  for (const s of list) s.frame = analyse(s.obj, room);
  const big = s => s.frame.width * s.frame.height;
  const mains = list.filter(s => s.main).sort((a, b) => big(b) - big(a));
  const landscape = mains.filter(s => s.frame.aspect >= 1), portrait = mains.filter(s => s.frame.aspect < 1);
  landscape.forEach((s, i) => s.alias = 'main-landscape' + (i ? '-' + (i + 1) : ''));
  portrait.forEach((s, i) => s.alias = 'main-portrait' + (i ? '-' + (i + 1) : ''));
  const media = list.find(s => s.source === 'stage-media'); if (media && !landscape.length) media.alias = 'main-landscape';
  return list;
}
function resolve(list, target) {
  if (Number.isInteger(target)) return list[target];
  const t = String(target);
  return list.find(s => s.alias === t) || list.find(s => s.id === t) || (ALIASES[t] && list.find(s => ALIASES[t].test(s.id + ' ' + s.path + ' ' + s.label)))
    || list.find(s => s.obj.name === t) || list.find(s => s.path.toLowerCase().includes(t.toLowerCase()));
}

// ---------- geometry: a picture frame for any screen mesh ----------
// Front normal (screenFront, averaged normals, or thinnest local axis facing
// the room), up = world up projected onto the face, right = up × normal.
// Curved glass is parametrised by arc length so pictures don't stretch.
function analyse(obj, room) {
  obj.updateWorldMatrix(true, false);
  const g = obj.geometry, pos = g.attributes.position, nrm = g.attributes.normal, M = obj.matrixWorld;
  const NM = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), step = Math.max(1, Math.floor(pos.count / 8000));
  const pts = []; for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(M).clone());
  const centre = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  let n = null;
  if (obj.userData.screenNormal) n = new THREE.Vector3(...obj.userData.screenNormal).applyMatrix3(NM).normalize();
  else if (obj.userData.screenFront) n = new THREE.Vector3(0, 0, obj.userData.screenFront).applyMatrix3(NM).normalize();
  else if (nrm) { const avg = new THREE.Vector3(); let c = 0; for (let i = 0; i < nrm.count; i += step, c++) avg.add(v.fromBufferAttribute(nrm, i).applyMatrix3(NM).normalize()); if (avg.length() > .3 * c) n = avg.normalize(); }
  if (!n) {
    // Closed or two-sided slabs: the thinnest principal axis of the points.
    n = thinnestAxis(pts, centre);
    const toward = room ? new THREE.Box3().setFromObject(room).getCenter(new THREE.Vector3()) : new THREE.Vector3(0, centre.y, 0);
    if (n.dot(toward.sub(centre)) < 0) n.negate();
  }
  // screenUp (the mesh's own axes): the picture's up for glass lying flat, where world up has no say.
  const up = obj.userData.screenUp ? new THREE.Vector3(...obj.userData.screenUp).transformDirection(M) : new THREE.Vector3(0, 1, 0);
  up.addScaledVector(n, -up.dot(n));
  if (up.length() < .3) up.set(0, 1, 0).applyMatrix3(NM).addScaledVector(n, -new THREE.Vector3(0, 1, 0).applyMatrix3(NM).dot(n));
  up.normalize(); const right = new THREE.Vector3().crossVectors(up, n).normalize();
  let rmin = Infinity, rmax = -Infinity, umin = Infinity, umax = -Infinity, dmin = Infinity, dmax = -Infinity;
  for (const p of pts) { const r = p.dot(right), u = p.dot(up), d = p.dot(n); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); umin = Math.min(umin, u); umax = Math.max(umax, u); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
  // Front-most surface profile d(r) → cumulative arc length s(r).
  const B = 48, chord = Math.max(1e-6, rmax - rmin), prof = new Array(B + 1).fill(-Infinity);
  for (const p of pts) { const k = Math.round((p.dot(right) - rmin) / chord * B); prof[k] = Math.max(prof[k], p.dot(n)); }
  for (let k = 0; k <= B; k++) if (!Number.isFinite(prof[k])) { let a = k - 1, b = k + 1; while (a >= 0 && !Number.isFinite(prof[a])) a--; while (b <= B && !Number.isFinite(prof[b])) b++; prof[k] = a < 0 ? prof[b] : b > B ? prof[a] : prof[a] + (prof[b] - prof[a]) * (k - a) / (b - a); }
  const arc = [0]; for (let k = 1; k <= B; k++) arc.push(arc[k - 1] + Math.hypot(chord / B, prof[k] - prof[k - 1]));
  const width = arc[B], height = umax - umin, sag = Math.max(...prof) - Math.min(...prof);
  const curved = sag > .01 * chord;
  const s = r => { const x = THREE.MathUtils.clamp((r - rmin) / chord * B, 0, B), k = Math.min(B - 1, Math.floor(x)); return arc[k] + (arc[k + 1] - arc[k]) * (x - k); };
  const surface = r => { const x = THREE.MathUtils.clamp((r - rmin) / chord * B, 0, B), k = Math.min(B - 1, Math.floor(x)); return prof[k] + (prof[k + 1] - prof[k]) * (x - k); };
  return { centre, n, up, right, rmin, umin, chord, width, height, aspect: width / Math.max(1e-6, height), curved, sag, depth: dmax - dmin, s, surface };
}

function thinnestAxis(pts, c) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] += d[i] * d[j]; }
  // Jacobi rotations on the symmetric covariance.
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(A[p][q]) < 1e-15) continue;
    const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
    for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = cs * a - sn * b; A[k][q] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = cs * a - sn * b; A[q][k] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = cs * a - sn * b; V[k][q] = sn * a + cs * b; }
  }
  const i = [0, 1, 2].reduce((m, k) => A[k][k] < A[m][m] ? k : m, 0);
  return new THREE.Vector3(V[0][i], V[1][i], V[2][i]).normalize();
}

// Front-face picture geometry in the mesh's own space, offset 0.4 mm forward.
function pictureGeometry(obj, f) {
  const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry, pos = g.attributes.position, M = obj.matrixWorld, inv = M.clone().invert();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), cen = new THREE.Vector3();
  const out = [], uv = [], tol = Math.max(.0025, f.depth * .02);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i).applyMatrix4(M); b.fromBufferAttribute(pos, i + 1).applyMatrix4(M); c.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
    fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); if (fn.lengthSq() < 1e-14) continue; fn.normalize();
    cen.copy(a).add(b).add(c).divideScalar(3);
    if (Math.abs(fn.dot(f.n)) < .35 || cen.dot(f.n) < f.surface(cen.dot(f.right)) - tol) continue;
    for (const p of [a, b, c]) {
      uv.push(f.s(p.dot(f.right)) / f.width, (p.dot(f.up) - f.umin) / f.height);
      out.push(...p.clone().addScaledVector(f.n, .0004).applyMatrix4(inv).toArray());
    }
  }
  if (g !== obj.geometry) g.dispose();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere(); return geo;
}

// ---------- inventory ----------
function cameraFrom(view, aspect) {
  const cam = new THREE.PerspectiveCamera(view.fov, aspect, .01, 500); cam.position.fromArray(view.position); cam.lookAt(new THREE.Vector3().fromArray(view.target)); cam.updateMatrixWorld(true); return cam;
}
export function listScreens(shot, { samples = 9, outW = 1920, outH = 1080 } = {}) {
  const list = discover(shot), P = window.ErgoPresentation, stats = list.map(() => ({ maxH: 0, maxW: 0, seen: 0 }));
  for (let k = 0; k < samples; k++) {
    const t = k / (samples - 1); P.seek(t); const scene = sceneRoot(); scene.updateMatrixWorld(true);
    const cam = cameraFrom(P.captureCamera(), outW / outH);
    list.forEach((s, i) => {
      const f = analyse(s.obj, null), toCam = cam.position.clone().sub(f.centre);
      if (f.n.dot(toCam) <= 0) return; // seen from behind
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => f.centre.clone().addScaledVector(f.right, x * f.chord / 2).addScaledVector(f.up, y * f.height / 2).project(cam));
      if (corners.every(p => p.z > 1 || p.z < -1)) return;
      const xs = corners.map(p => (p.x + 1) / 2 * outW), ys = corners.map(p => (1 - p.y) / 2 * outH);
      const x0 = Math.max(0, Math.min(...xs)), x1 = Math.min(outW, Math.max(...xs)), y0 = Math.max(0, Math.min(...ys)), y1 = Math.min(outH, Math.max(...ys));
      if (x1 <= x0 || y1 <= y0) return;
      const st = stats[i]; st.seen++;
      // Full (unclipped) projected size: what the clip must resolve.
      st.maxW = Math.max(st.maxW, Math.max(...xs) - Math.min(...xs)); st.maxH = Math.max(st.maxH, Math.max(...ys) - Math.min(...ys));
    });
  }
  P.seek(0);
  return list.map((s, i) => {
    const f = s.frame, st = stats[i], yaw = Math.atan2(f.n.x, f.n.z) * 180 / Math.PI, pitch = Math.asin(THREE.MathUtils.clamp(f.n.y, -1, 1)) * 180 / Math.PI;
    return { id: s.id, alias: s.alias || null, label: s.label, source: s.source, path: s.path, mesh: s.obj.name,
      position: f.centre.toArray().map(x => +x.toFixed(3)), widthM: +f.width.toFixed(4), heightM: +f.height.toFixed(4), aspect: +f.aspect.toFixed(4),
      orientation: f.aspect >= 1 ? 'landscape' : 'portrait', curved: f.curved, sagM: +f.sag.toFixed(4), facingYawDeg: +yaw.toFixed(1), facingPitchDeg: +pitch.toFixed(1),
      visibleSamples: st.seen + '/' + samples, maxOnScreenPx: [Math.round(st.maxW), Math.round(st.maxH)] };
  });
}

// ---------- live screens ----------
let active = null;
const loadMedia = src => new Promise((resolve, reject) => {
  const url = /^(https?:)?\//.test(src) ? src : '/' + src.replace(/^\.?\/+/, '');
  if (/\.(png|jpe?g|webp|gif)$/i.test(src)) { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('Could not load ' + src)); img.src = url; return; }
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  const timer = setTimeout(() => reject(Error('Timed out loading ' + src)), 60000);
  v.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(v); }, { once: true });
  v.addEventListener('error', () => { clearTimeout(timer); reject(Error('Could not load ' + src)); }, { once: true });
  v.src = url; v.load();
});
function seek(video, time) {
  if (Math.abs(video.currentTime - time) <= .001 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(Error('A screen clip could not seek for this frame.')); }, 8000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
    const done = () => { cleanup(); resolve(); }, fail = () => { cleanup(); reject(Error('A screen clip failed to decode.')); };
    video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', fail, { once: true }); video.currentTime = time;
  });
}
function draw(sc) {
  const { ctx2d, canvas, media, spec } = sc, [il, it, ir, ib] = sc.inset, CW = canvas.width, CH = canvas.height;
  const X0 = Math.round(il * CW), Y0 = Math.round(it * CH), W = CW - X0 - Math.round(ir * CW), H = CH - Y0 - Math.round(ib * CH);
  const rot = ((Number(spec.rotate) || 0) % 360 + 360) % 360, quarter = rot === 90 || rot === 270;
  const sw = media.videoWidth || media.naturalWidth, sh = media.videoHeight || media.naturalHeight;
  // Fit in the rotated frame: the source's own aspect after rotation.
  const fw = quarter ? H : W, fh = quarter ? W : H, fit = spec.fit || 'cover';
  let sx = 0, sy = 0, sW = sw, sH = sh, dw = fw, dh = fh;
  if (fit === 'cover') { const s = Math.max(fw / sw, fh / sh); sW = fw / s; sH = fh / s; sx = (sw - sW) / 2; sy = (sh - sH) / 2; }
  else if (fit === 'contain') { const s = Math.min(fw / sw, fh / sh); dw = sw * s; dh = sh * s; }
  ctx2d.setTransform(1, 0, 0, 1, 0, 0); ctx2d.clearRect(0, 0, CW, CH); ctx2d.fillStyle = '#000'; ctx2d.fillRect(X0, Y0, W, H);
  ctx2d.save(); ctx2d.beginPath(); ctx2d.rect(X0, Y0, W, H); ctx2d.clip(); ctx2d.translate(X0 + W / 2, Y0 + H / 2); ctx2d.rotate(rot * Math.PI / 180); if (spec.flipX) ctx2d.scale(-1, 1);
  ctx2d.drawImage(media, sx, sy, sW, sH, -dw / 2, -dh / 2, dw, dh); ctx2d.restore(); ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  sc.texture.needsUpdate = true;
}
async function installScreens(shot, list) {
  const out = [];
  for (const [i, spec] of (shot.screens || []).entries()) {
    const target = resolve(list, spec.target ?? i);
    if (!target) throw Error(`screens[${i}]: no screen matches target "${spec.target}". Run render-cut --list-screens.`);
    const media = await loadMedia(spec.src), f = target.frame;
    // inset: [left, top, right, bottom] fractions of the glass left clear (bezels
    // baked into the mesh texture show through). A number applies to all sides.
    const inset = Array.isArray(spec.inset) ? spec.inset.map(Number) : Array(4).fill(Number(spec.inset ?? DEFAULT_INSET[target.alias || ''] ?? 0));
    const long = Math.min(2048, Math.max(512, Number(spec.res) || Math.max(media.videoWidth || media.naturalWidth, media.videoHeight || media.naturalHeight)));
    const canvas = document.createElement('canvas');
    if (f.aspect >= 1) { canvas.width = long; canvas.height = Math.max(2, Math.round(long / f.aspect)); } else { canvas.height = long; canvas.width = Math.max(2, Math.round(long * f.aspect)); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = api.renderer?.capabilities.getMaxAnisotropy?.() || 1; texture.minFilter = THREE.LinearMipmapLinearFilter;
    const clearEdge = inset.some(x => x > 0), add = spec.blend === 'add';
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, transparent: clearEdge || add, alphaTest: clearEdge ? .5 : 0,
      ...(add ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}) });
    material.color.setScalar((Array.isArray(spec.brightness) ? Number(spec.brightness[0][1]) : Number(spec.brightness ?? 1)) * (Number(shot.screenGain) || 1));
    const mesh = new THREE.Mesh(pictureGeometry(target.obj, f), material); mesh.name = 'Film screen · ' + target.id; mesh.userData.filmFx = true; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 2;
    target.obj.add(mesh);
    const sc = { spec, target, inset, media, canvas, ctx2d: canvas.getContext('2d', { willReadFrequently: true }), texture, mesh };
    if (!media.duration) draw(sc);
    out.push(sc);
  }
  return out;
}
async function updateScreens(screens, chapterSeconds) {
  await Promise.all(screens.map(async sc => {
    if (Array.isArray(sc.spec.brightness)) sc.mesh.material.color.setScalar(keyAt(sc.spec.brightness, chapterSeconds) * (Number(active?.shot?.screenGain) || 1));
    const v = sc.media; if (!(v instanceof HTMLVideoElement)) return;
    const rate = Number(sc.spec.rate ?? 1), raw = chapterSeconds * rate + (Number(sc.spec.offset) || 0), d = v.duration;
    const time = sc.spec.loop === false ? THREE.MathUtils.clamp(raw, 0, Math.max(0, d - .02)) : ((raw % d) + d) % d;
    // +1.5 ms: land inside the target frame (an exact n/fps boundary can resolve to frame n−1).
    await seek(v, Math.min(time + .0015, Math.max(0, d - .001))); draw(sc);
  }));
}

// ---------- LED media mode (the app's Game Mode screen-sampling path) ----------
// LedGameMode.sampleLive draws the shared picture at 160×90, runs
// sampleScreenColours (desktop strips sample successive horizontal bands, the
// wings sample the matching edges) and eases toward it with a 150 ms time
// constant. Here the same sampler reads the film screen's canvas and the
// easing runs on bake time, so the light is deterministic per frame.
// The app samples the shared picture itself (drawImage(video, 0, 0, 160, 90)),
// so the source is the clip's video element, not the monitor canvas with its
// fit/pillarbox. For the stage's own media clip (kind:'media' without screens)
// a sampler video plays the same file in lockstep with the stage's seeks.
async function ledSource(shot, screens, list) {
  const src = shot.ledSource;
  if (src !== undefined) {
    const sc = Number.isInteger(src) ? screens[src] : screens.find(s => s.spec.target === src || s.target.id === src || s.target.alias === src);
    if (sc) return { media: sc.media };
    const t = resolve(list, src); if (t?.obj.material?.map?.image instanceof HTMLCanvasElement) return { media: t.obj.material.map.image };
    throw Error('ledSource does not name a screen: ' + src);
  }
  if (screens.length) return { media: screens[0].media };
  if (shot.kind === 'media') {
    const video = await loadMedia(shot.__stageClip || 'app-reference/assets/desk_viewer/media/ambient-clip.mp4');
    return { media: video, sampler: true, offset: Number(shot.screenOffset) || 0 };
  }
  const main = list.find(s => s.alias === 'main-landscape'), img = main?.obj.material?.map?.image;
  if (img instanceof HTMLCanvasElement) return { media: img };
  throw Error('ledMode "media" needs a screen picture: add screens[] or ledSource.');
}
async function makeLed(shot, screens, list) {
  const game = api.ledGameMode, counts = game.counts, small = document.createElement('canvas'); small.width = 160; small.height = 90;
  return { game, source: await ledSource(shot, screens, list), small, c: small.getContext('2d', { willReadFrequently: true }),
    gain: Math.max(0, Number(shot.ledGain ?? 1)), target: counts.map(n => new Uint8Array(n * 4)), live: counts.map(n => new Uint8Array(n * 4)), at: null, mode: shot.ledPreset || 'normal', avg: '#000000' };
}
async function sampleLed(led, seconds, video) {
  const src = led.source;
  if (src.sampler) { const d = src.media.duration; await seek(src.media, Math.min(((seconds + src.offset) % d + d) % d + .0015, d - .001)); }
  led.c.save(); led.c.translate(160, 0); led.c.scale(-1, 1); led.c.drawImage(src.media, 0, 0, 160, 90); led.c.restore(); // flipped: screen-left lights the desk's left strip end
  const image = led.c.getImageData(0, 0, 160, 90); sampleScreenColours(led.target, image, { mode: led.mode });
  // Continuous playback eases like the app; a jump (stills, first frame) snaps.
  const dt = led.at === null ? Infinity : seconds - led.at, blend = video && dt > 0 && dt <= .25 ? 1 - Math.exp(-dt * 1000 / 150) : 1;
  const gain = led.gain;
  led.live.forEach((row, j) => row.forEach((v, i) => { const t = Math.min(255, led.target[j][i] * gain); row[i] = Math.round(v + (t - v) * blend); }));
  led.at = seconds;
  let r = 0, g = 0, b = 0; const d = image.data; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
  led.avg = '#' + [r, g, b].map(x => Math.max(25, Math.round(x / n)).toString(16).padStart(2, '0')).join('');
}

// ---------- clocks ----------
const parseTime = s => { const [h, m = 0, sec = 0] = String(s).split(':').map(Number); return h * 3600 + m * 60 + sec; };
function paintAnalog(c, S, secondsOfDay, secondAngle) {
  // Mirrors home-office.mjs paintClock, with real hour/minute/second angles.
  const hours = secondsOfDay / 3600, minutes = (secondsOfDay / 60) % 60;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#f1ead9'; c.fillRect(0, 0, S, S);
  c.save(); c.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, major = i % 5 === 0; c.strokeStyle = major ? '#2c3732' : 'rgba(44,55,50,.55)'; c.lineWidth = major ? 6 : 2; c.beginPath(); c.moveTo(Math.sin(a) * S * (major ? .36 : .41), -Math.cos(a) * S * (major ? .36 : .41)); c.lineTo(Math.sin(a) * S * .45, -Math.cos(a) * S * .45); c.stroke(); }
  c.lineCap = 'round';
  const hand = (angle, length, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(-Math.sin(angle) * S * .05, Math.cos(angle) * S * .05); c.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length); c.stroke(); };
  hand((hours % 12) / 12 * Math.PI * 2, S * .24, 9, '#2c3732');
  hand(minutes / 60 * Math.PI * 2, S * .36, 6, '#2c3732');
  if (secondAngle !== null) hand(secondAngle, S * .4, 2, '#b8573e');
  c.fillStyle = '#a88a55'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.restore();
}
function paintFlap(c, secondsOfDay) {
  // Mirrors atelier-desk-decor-generator.mjs split-flap face (24 h).
  const h = Math.floor(secondsOfDay / 3600) % 24, m = Math.floor(secondsOfDay / 60) % 60;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#14161b'; c.fillRect(0, 0, 512, 256);
  c.fillStyle = '#20242c'; c.beginPath(); c.roundRect(28, 28, 210, 200, 16); c.roundRect(274, 28, 210, 200, 16); c.fill();
  c.fillStyle = '#f8fafc'; c.font = '700 128px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(h).padStart(2, '0'), 133, 132); c.fillText(String(m).padStart(2, '0'), 379, 132);
  c.fillStyle = '#0b0d11'; c.fillRect(20, 125, 472, 6);
}
function findClocks() {
  const scene = sceneRoot(), desk = api.loadedModel, out = [];
  scene.traverse(o => {
    if (!/clock/i.test(o.name) || within(o, desk) || !shown(o) || o.isMesh) return;
    const canvasMesh = []; o.traverse(c => { const img = c.isMesh && c.material?.map?.image; if (img instanceof HTMLCanvasElement) canvasMesh.push(c); });
    const hands = o.children.filter(c => c.isGroup && !c.name && c.children.length === 1 && c.children[0].isMesh);
    if (/Decor component clock/.test(o.name) && canvasMesh.length) out.push({ kind: 'flap', obj: o, map: canvasMesh[0].material.map });
    else if (hands.length === 2) out.push({ kind: 'hands', obj: o, hour: hands[0], minute: hands[1] });
    else if (canvasMesh.length && canvasMesh[0].material.map.image.width === canvasMesh[0].material.map.image.height) out.push({ kind: 'analog', obj: o, map: canvasMesh[0].material.map });
  });
  return out.map(c => ({ ...c, saved: c.kind === 'hands' ? [c.hour.rotation.z, c.minute.rotation.z] : (() => { const k = document.createElement('canvas'), img = c.map.image; k.width = img.width; k.height = img.height; k.getContext('2d').drawImage(img, 0, 0); return k; })() }));
}
function setClocks(clocks, spec, shot, chapterSeconds) {
  const start = Number(spec.start ?? 0), end = Number(spec.end ?? shot.seconds), from = parseTime(spec.from), to = parseTime(spec.to ?? spec.from);
  let u = THREE.MathUtils.clamp((chapterSeconds - start) / Math.max(1e-6, end - start), 0, 1);
  if (spec.ease === 'smooth') u = u * u * (3 - 2 * u);
  const sod = from + (to - from) * u, mode = spec.second || 'real';
  const secondAngle = mode === 'hide' ? null : (mode === 'clock' ? sod % 60 : (from % 60) + chapterSeconds) / 60 * Math.PI * 2;
  for (const c of clocks) {
    if (c.kind === 'hands') { c.hour.rotation.z = -((sod / 3600) % 12) / 12 * Math.PI * 2; c.minute.rotation.z = -((sod / 60) % 60) / 60 * Math.PI * 2; }
    else if (c.kind === 'flap') { paintFlap(c.map.image.getContext('2d'), sod); c.map.needsUpdate = true; }
    else { const img = c.map.image; paintAnalog(img.getContext('2d'), img.width, sod, secondAngle); c.map.needsUpdate = true; }
  }
}
function restoreClocks(clocks) {
  for (const c of clocks) {
    if (c.kind === 'hands') { c.hour.rotation.z = c.saved[0]; c.minute.rotation.z = c.saved[1]; }
    else { const x = c.map.image.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.saved.width, c.saved.height); x.drawImage(c.saved, 0, 0); c.map.needsUpdate = true; }
  }
}
export function listClocks() { return findClocks().map(c => ({ kind: c.kind, name: c.obj.name, path: pathOf(c.obj, sceneRoot()), position: new THREE.Box3().setFromObject(c.obj).getCenter(new THREE.Vector3()).toArray().map(x => +x.toFixed(3)) })); }

// ---------- accessories / desk objects ----------
const accSpec = raw => typeof raw === 'string' ? { id: raw } : raw;
const isCatalog = id => !!accessory(id);
// Library props default to a sensible spot (desk-local mm, like room layouts).
const PROP_DEFAULTS = { 'tablet-pc': { x: -330, z: 230, rotation: 15 } };
// Catalog accessories used to be toggled inside applyPreset, but the stage's
// room install (installRecipe) rebuilds the featured desk and dropped them.
// They are now toggled after prepare, like library props. These two exports
// stay as no-ops so older callers keep working.
export function beforePrepare() {}
export function unhookPreset() {}
async function installDeskObjects(shot) {
  const spec = shot.accessories, out = { added: [], hidden: [], toggled: [], timed: [] }; if (!spec) return out;
  const objects = api.sceneDesks?.objects, records = api.sceneDesks?.active?.objects;
  // Catalog accessories: toggle on the prepared desk, wait for the layout,
  // then optionally place them like any desk object (key accessory-<id>).
  const catalogAdd = (spec.add || []).map(accSpec).filter(a => isCatalog(a.id)), catalogRemove = (spec.remove || []).filter(isCatalog);
  for (const { id } of catalogAdd) if (!api.currentConfig.accessories.includes(id)) { api.toggleAccessory(id); if (api.currentConfig.accessories.includes(id)) out.toggled.push(id); else console.warn('[film-fx] accessories.add: ' + id + ' does not fit this desk size'); }
  for (const id of catalogRemove) if (api.currentConfig.accessories.includes(id)) { api.toggleAccessory(id); out.toggled.push(id); }
  if (out.toggled.length) {
    await api.workspaceAccessories?.ready; await objects?.ready; objects?.syncAccessories();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const a of catalogAdd) {
      const change = {}; for (const f of ['x', 'y', 'z', 'rotation', 'tilt', 'roll', 'scale']) if (Number.isFinite(a[f])) change[f] = a[f];
      if (!Object.keys(change).length) continue;
      const key = 'accessory-' + a.id; if (!records?.has(key)) { console.warn('[film-fx] accessories.add: no desk object ' + key + ' to place'); continue; }
      objects.select(key); objects.change(change); objects.select(null);
    }
  }
  for (const raw of spec.add || []) {
    const a = { ...PROP_DEFAULTS[accSpec(raw).id], ...accSpec(raw) }; if (isCatalog(a.id)) continue;
    const key = await objects.add(a.id, a.role || 'desktop');
    if (!key) throw Error('accessories.add: could not add library prop ' + a.id);
    objects.select(key); const change = {}; for (const f of ['x', 'y', 'z', 'rotation', 'tilt', 'roll', 'scale']) if (Number.isFinite(a[f])) change[f] = a[f];
    if (Object.keys(change).length) objects.change(change);
    objects.setEditing(false); objects.select(null);
    const obj = records?.get(key)?.obj; if (obj) { obj.userData.filmFxProp = a.id; obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
    out.added.push(key);
    if (Array.isArray(a.visible)) timeVisible(out, records?.get(key)?.obj, a);
  }
  for (const a of catalogAdd) if (Array.isArray(a.visible)) timeVisible(out, records?.get('accessory-' + a.id)?.obj, a);
  for (const id of spec.remove || []) {
    if (isCatalog(id)) continue;
    for (const [key, item] of records || []) if (key === id || item.saved?.propId === id) { out.hidden.push([item.obj, item.obj.visible]); item.obj.visible = false; }
  }
  return out;
}
// accessories.add[].visible: a sticky visibility override (like sceneEdits' hide) switched by chapter time in frame().
function timeVisible(out, obj, a) {
  if (!obj) { console.warn('[film-fx] accessories.add: no desk object for ' + a.id + ' to time'); return; }
  const keys = [...a.visible].sort((p, q) => p[0] - q[0]), cell = { force: null }; let raw = obj.visible;
  Object.defineProperty(obj, 'visible', { configurable: true, enumerable: true, get: () => cell.force === null ? raw : cell.force, set: v => { raw = v; } });
  out.timed.push({ keys, cell, undo: () => { delete obj.visible; obj.visible = raw; } });
}
const visibleAt = (keys, s) => { let v = null; for (const [at, on] of keys) if (s >= at) v = on === null ? null : !!on; return v; };
function installSceneDeskPoses(list) {
  const desks = api.sceneDesks, undo = [], posed = [];
  for (const p of list) {
    const re = new RegExp(p.desk, 'i'); let hit = 0;
    for (const r of desks?.records?.values() || []) {
      if (r.id === desks.selected || r.primary || !(re.test(r.id) || re.test(r.state?.name || ''))) continue;
      if (!r.rig) desks.ensureRig(r);
      const was = { height: r.state.height, tilt: r.state.tilt, poseAt: r.poseAt };
      if (Number.isFinite(p.height)) r.state.height = p.height;
      if (Number.isFinite(p.tilt)) r.state.tilt = p.tilt;
      r.rig.updatePose(r.state.height, r.state.tilt); r.poseAt = `${r.state.height}:${r.state.tilt}`;
      desks.objects?.stow?.update(r); hit++; posed.push(r.id);
      undo.push(() => { r.state.height = was.height; r.state.tilt = was.tilt; r.rig.updatePose(was.height, was.tilt); r.poseAt = was.poseAt; desks.objects?.stow?.update(r); });
    }
    if (!hit) console.warn('[film-fx] sceneDeskPoses: no room desk matches ' + p.desk);
  }
  return { posed, restore() { for (const f of undo.reverse()) f(); } };
}
function installDeskFinish(spec) {
  const was = { wood: api.currentConfig.woodFinish, trim: api.currentConfig.trimColor };
  const click = sel => { const el = document.querySelector(sel); if (!el) { console.warn('[film-fx] deskFinish: no swatch ' + sel); return false; } el.click(); return true; };
  const was2 = { base: api.currentConfig.baseFinish };
  const wood = name => click(`#wood-finishes [data-finish="${CSS.escape(name)}"]`);
  const base = name => click(`#base-finishes [data-finish="${CSS.escape(name)}"]`);
  const trim = hex => click(`#trim-palette [data-trim-color="${CSS.escape(String(hex).toLowerCase())}"]`);
  const syncActiveDeskFinish = () => {
    const r = api.sceneDesks?.active;
    if (!r) return;
    if (r.state?.style) {
      if (api.currentConfig?.woodFinish) r.state.style.woodFinish = api.currentConfig.woodFinish;
      if (api.currentConfig?.baseFinish) r.state.style.baseFinish = api.currentConfig.baseFinish;
      if (api.currentConfig?.trimColor) r.state.style.trimColor = api.currentConfig.trimColor;
    }
    r.rig?.restyle?.();
    r.peripherals?.update?.();
    let liveWood = null;
    api.loadedModel?.traverse?.(o => { if (!liveWood && o.isMesh && o.name === 'Desktop_3' && o.material) liveWood = o.material; });
    if (liveWood && r.rig?.mounts) {
      for (const m of Object.values(r.rig.mounts)) {
        m?.traverse?.(o => {
          if (o.isMesh && (o.userData?.artistShelfWood || o.name === 'Organizer desk finish')) {
            o.material.copy(liveWood);
            o.material.name = 'Artist shelf wood';
            o.material.userData.sharedTextures = true;
            o.material.needsUpdate = true;
          }
        });
      }
    }
  };
  const info = { wood: spec.wood ? wood(spec.wood) && spec.wood : undefined, base: spec.base ? base(spec.base) && spec.base : undefined, trim: spec.trim ? trim(spec.trim) && spec.trim : undefined };
  syncActiveDeskFinish();
  console.log('[film-fx] deskFinish', JSON.stringify(info), 'was', JSON.stringify(was));
  return { info, restore() { if (info.wood && was.wood) wood(was.wood); if (info.base && was2.base) base(was2.base); if (info.trim && was.trim) trim(was.trim); syncActiveDeskFinish(); } };
}
// The featured desk's build (Director Build tab, shot.featuredBuild = {woodFinish, baseFinish, trimColor, accessories:[{id, slot}]}):
// finishes through the configurator's swatches (installDeskFinish), accessories toggled in / out like accessories.add / remove
// until the desk has exactly this set, each moved onto its slot (desktop / shelf / lower-shelf / base-shelf). Restored by clear().
async function installFeaturedBuild(build) {
  const DB = await import('../../experience/desk-build.mjs'), objects = api.sceneDesks?.objects, rec = () => api.sceneDesks?.active;
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const finish = (build.woodFinish || build.baseFinish || build.trimColor) ? installDeskFinish({ wood: build.woodFinish, base: build.baseFinish, trim: build.trimColor }) : null;
  const was = { accessories: [...api.currentConfig.accessories], roles: {} }, fresh = new Set(), flip = id => { try { api.toggleAccessory(id); } catch (e) { console.warn('[film-fx] featuredBuild toggle', id, e); } };
  if (build.accessories) {
    const want = new Set(build.accessories.map(a => a.id));
    for (const id of want) if (!api.currentConfig.accessories.includes(id)) { flip(id); if (api.currentConfig.accessories.includes(id)) fresh.add(id); else console.warn('[film-fx] featuredBuild: ' + id + ' does not fit this desk size'); }
    for (const id of [...api.currentConfig.accessories]) if (!want.has(id)) flip(id);
    await api.workspaceAccessories?.ready; await objects?.ready; objects?.syncAccessories(); await frames();
    const r = rec(), per = {};
    for (const { id, slot } of build.accessories) {
      const item = r?.objects?.get('accessory-' + id);
      if (!item || !objects || DB.slotless(id) || item.saved.role === slot) continue;
      was.roles[id] = { role: item.saved.role, transform: structuredClone(item.saved.transform) };
      item.saved.role = slot; item.saved.removed = false;
      if (!(fresh.has(id) && slot === DB.naturalSlot(id))) item.saved.transform = DB.spot(r, slot, per[slot] = per[slot] || 0), per[slot]++;
      objects.register(r, item.id, item.obj, item.saved, item.baseScale);
    }
    if (Object.keys(was.roles).length || fresh.size) { await frames(); api.sceneDesks?.sync?.(); }
  }
  return {
    info: { finish: finish?.info, accessories: build.accessories?.map(a => a.id + '@' + a.slot) },
    restore() {
      const r = rec(), now = api.currentConfig.accessories;
      for (const [id, o] of Object.entries(was.roles)) { const item = r?.objects?.get('accessory-' + id); if (!item || !objects) continue; item.saved.role = o.role; item.saved.transform = o.transform; objects.register(r, item.id, item.obj, item.saved, item.baseScale); }
      if (build.accessories) { for (const id of [...now]) if (!was.accessories.includes(id)) flip(id); for (const id of was.accessories) if (!api.currentConfig.accessories.includes(id)) flip(id); }
      finish?.restore();
    },
  };
}
function clearDeskObjects(d) {
  if (!d) return; const objects = api.sceneDesks?.objects;
  for (const v of d.timed || []) v.undo();
  for (const id of [...d.toggled].reverse()) { try { api.toggleAccessory(id); } catch (e) { console.warn('[film-fx] untoggle', id, e); } }
  for (const [obj, v] of d.hidden) obj.visible = v;
  for (const key of d.added) { try { if (api.sceneDesks?.active?.objects?.has(key)) { objects.select(key); objects.remove(); objects.select(null); } } catch (e) { console.warn('[film-fx] remove', key, e); } }
}

// ---------- floor light (foot + wing strips onto the floor) ----------
// The app's 'Foot LED floor glow' is one 60×60 in plane under the base, clipped by
// an X smoothstep (.43-.5) and by the plane's own Z edge, and its alpha saturates
// at .6 over most of the pool at the film's strengths: a flat, hard box. The two
// wing strips (under the desktop's side edges, outboard of the wing panels) light
// only the panels, never the floor. This replaces the box with irradiance from the
// real strips: each is a line of Lambertian emitters (cos^lobe about the strip's
// own -Y, so the pools move with lift and tilt) integrated per floor fragment,
// E = Σ I·cosθe·cosθr / r² · dl, each sample taking that LED's own pixel (status
// chases, fades and colours come along). Each wing panel (extended down to the floor
// for the base leg below it) is a soft-edged rectangle that shadows its strip's rays
// that cross it, so the floor inboard of the panel stays dark but the light still
// reaches the floor ahead of and behind the desk. Strip and panel matrices are
// read in onBeforeRender, so glide, turns, lift and tilt are always current.
// Strengths are the app's live uniforms (ledGlow × floor/leftWing/rightWing
// Strength), so ledGlow and ledSurfaces keep driving it. Hue-preserving roll-off:
// alpha = max·(1−e^(−m/max)) on the brightest channel, so nothing clips to white.
//   floorLight:{gain=1, foot=1, wings=1, center=wings (desktop centre strip, id 4), footLift=.25, lobe=1, max=.6, soft=.04, radius=3.2, hideApp=true}
//     gain: overall; foot / wings: per source; footLift: the foot strip's virtual height gain (scene
//     units; it hangs only .175 up under the footrest, so its true pool is a narrow band the footrest
//     hides; the lift stands in for the diffuser and the glossy floor's spread); soft: source radius
//     (softens the pool right under a strip); radius: fade-out disc around the desk.
const FLOOR_SEGS = 4, FLOOR_STEPS = 24;
// Wheel spin on travel after a turn (Vico, HQ14c: on the roll forward the front and back wheels spun opposite ways).
// The app spins each mecanum wheel by (dx + latSign * dz) / radius from the desk's WORLD step (studio.js
// applyGlideOffset), which is right only at yaw 0: after the 90 degree turn a forward roll is spun as a strafe.
// Each rendered frame this adds the difference to the same formula in the desk's own frame (the step rotated by
// -yaw), so all four wheels roll forward together. Steps that change the yaw are the app's turn spin and are left alone.
// The app (studio.js) is unchanged; restore() puts the render back. shot.wheelFix:false turns it off.
function installWheelFix(shot) {
  const desk = api.loadedModel, LAT = { Wheel_F_L: 1, Wheel_F_R: -1, Wheel_R_L: -1, Wheel_R_R: 1 }, rigs = [], matUndo = [];
  const hubMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f7fb, metalness: 0.92, roughness: 0.16, clearcoat: 0.35, clearcoatRoughness: 0.12, ior: 2.4, envMapIntensity: 1.6 });
  const rollerMat = new THREE.MeshPhysicalMaterial({ color: 0x525862, metalness: 0.52, roughness: 0.24, clearcoat: 0.48, clearcoatRoughness: 0.16, ior: 1.8, envMapIntensity: 1.55 });
  desk.traverse(o => {
    const m = /^wheelRig_(Wheel_[FR]_[LR])$/.exec(o.name); if (!m) return;
    // The app's radius: half the world height of the largest disc, measured unspun.
    const z = o.rotation.z; o.rotation.z = 0; o.updateMatrixWorld(true);
    let hub = null, area = 0;
    for (const c of o.children) {
      if (!c.isMesh || !c.geometry) continue;
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox, a = (b.max.x - b.min.x) * (b.max.y - b.min.y);
      if (a > area) { area = a; hub = c; }
      const mat = c.material, hex = mat?.color?.getHexString?.()?.toLowerCase?.() || '';
      const isHubPlate = hex === 'a38c8c' || hex === '5e4343' || hex === 'ffffff' || (mat?.roughness >= 0.9 && mat?.metalness >= 0.9);
      matUndo.push({ mesh: c, mat });
      c.material = isHubPlate ? hubMat : rollerMat;
    }
    const hb = hub ? new THREE.Box3().setFromObject(hub) : null; o.rotation.z = z; o.updateMatrixWorld(true);
    if (hb) rigs.push({ o, name: m[1], lat: LAT[m[1]], r: Math.max(.02, (hb.max.y - hb.min.y) / 2), corr: 0, base: z, written: z });
  });
  if (!rigs.length) { hubMat.dispose(); rollerMat.dispose(); return null; }
  const renderer = api.renderer, direct = renderer.render, log = shot.wheelFixDebug ? [] : null;
  let prev = null;
  const apply = () => {
    const p = desk.position, yaw = desk.rotation.y;
    if (prev) {
      const dx = p.x - prev.x, dz = p.z - prev.z;
      var travel = Math.abs(yaw - prev.yaw) < 1e-7 && (dx || dz);
      if (travel) {
        const c = Math.cos(yaw), s = Math.sin(yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
        for (const g of rigs) g.corr -= ((lx - dx) + g.lat * (lz - dz)) / g.r;
      }
    }
    prev = { x: p.x, z: p.z, yaw };
    for (const g of rigs) {
      const was = g.written; if (g.o.rotation.z !== g.written) g.base = g.o.rotation.z; g.written = g.base + g.corr; g.o.rotation.z = g.written;
      if (log && travel) { g.dApp = (g.dApp || 0) + (g.o.rotation.z - was) - (g.corr - (g.corrWas ?? g.corr)); g.dFix = (g.dFix || 0) + (g.written - was); }
      g.corrWas = g.corr;
    }
    if (log) log.push(1);
  };
  renderer.render = function (sc, cam) { apply(); return direct.call(this, sc, cam); };
  return {
    count: rigs.length,
    restore() {
      renderer.render = direct;
      for (const u of matUndo) u.mesh.material = u.mat;
      hubMat.dispose(); rollerMat.dispose();
      if (log?.length > 1) console.error('[film-fx] wheels app/fixed spin on travel steps: ' + rigs.map(g => g.name.slice(6) + ' ' + (g.dApp || 0).toFixed(2) + '/' + (g.dFix || 0).toFixed(2)).join(', '));
    }
  };
}
function installFloorLight(shot) {
  const spec = { gain: 1, foot: 1, wings: 1, footLift: .25, lobe: 1, max: .6, soft: .04, radius: 3.2, hideApp: true, ...shot.floorLight };
  spec.center ??= spec.wings; // round 8: the desktop centre strip (id 4) lights the floor under the desk too
  const scene = sceneRoot(), desk = api.loadedModel; scene.updateMatrixWorld(true);
  let app = null; desk.traverse(o => { if (o.name === 'Foot LED floor glow') app = o; });
  if (!app?.material?.uniforms?.efPixelTexture) { console.warn('[film-fx] floorLight: no bound Foot LED floor glow'); return null; }
  const byName = n => { let m = null; desk.traverse(o => { if (!m && o.isMesh && o.name === n) m = o; }); return m; };
  const strips = id => { const out = []; desk.traverse(o => { if (o.isMesh && o.userData.ledPhysicalId === id && !/reflection|bounce/.test(o.name)) out.push(o); }); return out; };
  const live = list => list.find(m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; });
  const axisEnds = (mesh, axis) => { const g = mesh.geometry; g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()); const a = c.clone(), z = c.clone(); a[axis] = b.min[axis]; z[axis] = b.max[axis]; return [a, z]; };
  // Wings: each panel pairs with the strip mesh on its side; its colours follow the
  // row the app's own panel spill samples (receiverIds leftWing:[5], rightWing:[6]),
  // so the floor pool and the lit panel above it always read as one light.
  const wings = ['Desktop_1', 'Desktop_2'].map(name => {
    const panel = byName(name); if (!panel) return null;
    const spill = panel.children.find(c => /outer reflection$/.test(c.name));
    panel.geometry.computeBoundingBox(); const pb = panel.geometry.boundingBox, pc = pb.getCenter(new THREE.Vector3()), size = pb.getSize(new THREE.Vector3());
    const thin = ['x', 'y', 'z'].reduce((a, k) => size[k] < size[a] ? k : a, 'x');
    return { panel, mat: spill?.material, row: spill?.material.userData.ledSpillSources?.[0] ?? (name === 'Desktop_1' ? 5 : 6), pc, pb, thin };
  }).filter(Boolean);
  const wingStrips = [...strips(5), ...strips(6)];
  const foot = { mat: app.material, row: 7, meshes: strips(7) };
  // Desk Top Center (physical id 4, layer 3): under the desktop, facing down; strength = the app's desktop spill uniform.
  let centreMat = null; desk.traverse(o => { if (!centreMat && o.material?.uniforms?.strength && /^Desktop(_3)? LED reflection$|Desktop base LED underside reflection/.test(o.name)) centreMat = o.material; });
  const centre = { mat: centreMat, meshes: strips(4) };
  const U = app.material.uniforms, v3 = () => new THREE.Vector3(), arr = f => Array.from({ length: FLOOR_SEGS }, f);
  const uniforms = {
    efPixelTexture: U.efPixelTexture, efPixelActive: U.efPixelActive, efPixelRows: U.efPixelRows, efPixelWidth: U.efPixelWidth, efPixelCounts: U.efPixelCounts,
    ledColor: U.ledColor, segA: { value: arr(v3) }, segB: { value: arr(v3) }, segDir: { value: arr(v3) }, segRow: { value: arr(() => 0) }, segGain: { value: arr(() => 0) }, segLift: { value: arr(v3) },
    occP: { value: arr(v3) }, occN: { value: arr(v3) }, occU: { value: arr(v3) }, occV: { value: arr(v3) }, occM: { value: arr(() => new THREE.Vector2()) }, centre: { value: new THREE.Vector2() }, radius: { value: spec.radius },
    maxA: { value: spec.max }, lobe: { value: spec.lobe }, soft2: { value: spec.soft * spec.soft }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform sampler2D efPixelTexture; uniform float efPixelActive, efPixelRows, efPixelWidth; uniform float efPixelCounts[8];
      uniform vec3 ledColor; uniform vec3 segA[${FLOOR_SEGS}], segB[${FLOOR_SEGS}], segDir[${FLOOR_SEGS}], occP[${FLOOR_SEGS}], occN[${FLOOR_SEGS}], segLift[${FLOOR_SEGS}], occU[${FLOOR_SEGS}], occV[${FLOOR_SEGS}];
      uniform vec2 occM[${FLOOR_SEGS}];
      uniform float segRow[${FLOOR_SEGS}], segGain[${FLOOR_SEGS}]; uniform vec2 centre; uniform float radius, maxA, lobe, soft2;
      varying vec3 vWorld;
      vec3 efLedLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
      vec3 efLedSample(float t, float row) {
        float count = efPixelCounts[int(row)], pixel = min(count - 1.0, floor(clamp(t, 0.0, 1.0) * count));
        return efLedLinear(texture2D(efPixelTexture, vec2((pixel + 0.5) / efPixelWidth, (row + 0.5) / efPixelRows)).rgb);
      }
      void main() {
        vec3 E = vec3(0.0);
        for (int s = 0; s < ${FLOOR_SEGS}; s++) {
          if (segGain[s] <= 0.0) continue;
          bool occ = dot(occN[s], occN[s]) > 0.0;
          vec3 acc = vec3(0.0);
          for (int k = 0; k < ${FLOOR_STEPS}; k++) {
            float t = (float(k) + 0.5) / ${FLOOR_STEPS}.0;
            vec3 S = mix(segA[s], segB[s], t) + segLift[s], d = vWorld - S; float r2 = dot(d, d) + soft2; vec3 l = d * inversesqrt(r2);
            float lit = 1.0;
            if (occ) {
              // Where the ray meets the panel's plane, inside its (soft-edged) rectangle: shadowed.
              float den = dot(d, occN[s]), x = abs(den) > 1e-5 ? dot(occP[s] - S, occN[s]) / den : -1.0;
              if (x > 0.0 && x < 1.0) {
                vec3 X = S + d * x - occP[s]; float u = dot(X, occU[s]) / dot(occU[s], occU[s]), v = dot(X, occV[s]) / dot(occV[s], occV[s]);
                vec2 m = occM[s];
                lit = 1.0 - smoothstep(-m.x, m.x, u) * smoothstep(1.0 + m.x, 1.0 - m.x, u) * smoothstep(-m.y, m.y, v) * smoothstep(1.0 + m.y, 1.0 - m.y, v);
              }
            }
            vec3 c = efPixelActive > 0.5 ? efLedSample(t, segRow[s]) : ledColor;
            acc += c * lit * pow(max(dot(l, segDir[s]), 0.0), lobe) * max(-l.y, 0.0) / r2;
          }
          E += acc * segGain[s] * length(segB[s] - segA[s]) / ${FLOOR_STEPS}.0;
        }
        E *= 1.0 - smoothstep(radius * 0.6, radius, length(vWorld.xz - centre));
        float m = max(max(E.r, E.g), E.b);
        if (m < 1e-5) discard;
        gl_FragColor = vec4(E / m, maxA * (1.0 - exp(-m / maxA)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * spec.radius, 2 * spec.radius), material);
  mesh.name = 'Film floor light'; mesh.userData.filmFx = true; mesh.rotation.x = -Math.PI / 2;
  // Drawn after the product rig's contact shadow (renderOrder 2), which otherwise blacked out the LED light under the
  // desk: the dark gap between the wing pools and no hot spot under the foot rest (Vico, HQ14d).
  mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.raycast = () => {};
  scene.add(mesh);
  // K: irradiance → alpha scale, set on the opener's dark stage (status chases light 3-4 of 11-13 LEDs at a time,
  // the regular look sits at linear ~.09), so gain 1 gives pools as bright as the lit wing panels above them.
  const K = .225 * spec.gain, M = new THREE.Matrix3(), P = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const setSeg = (i, strip, axis, row, gain, occ) => {
    const [a, b] = axisEnds(strip, axis); uniforms.segA.value[i].copy(a).applyMatrix4(strip.matrixWorld); uniforms.segB.value[i].copy(b).applyMatrix4(strip.matrixWorld);
    // Facing: the LED root's own down (the overlay meshes carry import rotations); it tilts with the desktop.
    let root = strip; while (root.parent && !/^(Desktop|Base|Shelf) LEDs$/.test(root.name)) root = root.parent;
    uniforms.segDir.value[i].copy(down).applyMatrix3(M.setFromMatrix4(root.matrixWorld)).normalize(); uniforms.segRow.value[i] = row; uniforms.segGain.value[i] = gain;
    if (occ) { for (const [k, v] of Object.entries(occ)) uniforms[k].value[i].copy(v); } else uniforms.occN.value[i].set(0, 0, 0);
  };
  mesh.onBeforeRender = () => {
    app.getWorldPosition(P); mesh.position.set(P.x, P.y, P.z); mesh.updateMatrixWorld(); uniforms.centre.value.set(P.x, P.z);
    const fm = live(foot.meshes);
    // The lift keeps the foot pool's energy (∫E ∝ I), so footLift only spreads it.
    if (fm) { setSeg(0, fm, 'z', 7, K * spec.foot * foot.mat.uniforms.strength.value, null); uniforms.segLift.value[0].set(0, spec.footLift, 0); } else uniforms.segGain.value[0] = 0;
    const cm = live(centre.meshes);
    if (cm && centre.mat && spec.center > 0) {
      setSeg(3, cm, 'z', 4, K * spec.center * centre.mat.uniforms.strength.value, null);
      // HQ14d (Vico: a dark gap in the floor between the wing pools): straight down, the centre strip's pool lands
      // under the foot shelf, which hides it. centerAhead (scene units) moves the source toward the desk front and
      // centerTilt aims it forward, so the pool fills the floor in front of the shelf. The desk front is +x at yaw 0.
      const yaw = desk.rotation.y, front = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      uniforms.segLift.value[3].copy(front).multiplyScalar(spec.centerAhead || 0);
      if (spec.centerTilt) uniforms.segDir.value[3].addScaledVector(front, spec.centerTilt).normalize();
    } else uniforms.segGain.value[3] = 0;
    wings.forEach((w, j) => {
      const i = j + 1; w.panel.updateWorldMatrix(true, false);
      const pc = w.pc.clone().applyMatrix4(w.panel.matrixWorld);
      // The strip on this panel's side: the nearest live wing strip mesh (Standard or Extended desktop).
      let best = null, bd = Infinity; for (const m of wingStrips) { if (!live([m])) continue; const d = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).distanceTo(pc); if (d < bd) { bd = d; best = m; } }
      if (!best || !w.mat) { uniforms.segGain.value[i] = 0; return; }
      // Panel outer face (its thinnest local axis, on the strip's side) as a world rectangle: corner O, edges U
      // (along the desk) and V (up), V stretched down to the floor for the base leg under the panel.
      const sc = new THREE.Box3().setFromObject(best).getCenter(new THREE.Vector3()), W = w.panel.matrixWorld;
      const n = new THREE.Vector3().setComponent('xyz'.indexOf(w.thin), 1).applyMatrix3(M.setFromMatrix4(W)).normalize(), out = n.dot(sc.clone().sub(pc)) > 0;
      const [a1, a2] = ['x', 'y', 'z'].filter(k => k !== w.thin), up = k => Math.abs(new THREE.Vector3().setComponent('xyz'.indexOf(k), 1).applyMatrix3(M).normalize().y);
      const [la, va] = up(a1) > up(a2) ? [a2, a1] : [a1, a2], corner = (l, v) => { const c = w.pc.clone(); c[w.thin] = out ? w.pb.max[w.thin] : w.pb.min[w.thin]; c[la] = l; c[va] = v; return c.applyMatrix4(W); };
      let O = corner(w.pb.min[la], w.pb.min[va]); const Uv = corner(w.pb.max[la], w.pb.min[va]).sub(O), top = corner(w.pb.min[la], w.pb.max[va]);
      if (top.y < O.y) { const t = top; top.copy(O); O = t; }
      let Vv = top.clone().sub(O); if (Vv.y > .05) { O.addScaledVector(Vv, -(O.y - P.y) / Vv.y); Vv = top.clone().sub(O); }
      if (!out) n.negate();
      setSeg(i, best, 'x', w.row, K * spec.wings * w.mat.uniforms.strength.value,
        { occP: O, occN: n, occU: Uv, occV: Vv, occM: new THREE.Vector2(.04 / Uv.length(), .04 / Vv.length()) });
    });
  };
  if (shot.floorLightDebug) { const ob = mesh.onBeforeRender; let n = 0; mesh.onBeforeRender = (...a) => { ob(...a); if (n++ === 0) console.error('[film-fx] floorLight segs gain ' + uniforms.segGain.value.map(v => v.toFixed(3)).join(',') + ' centre ' + !!live(centre.meshes) + '/' + (centreMat?.name || centreMat?.type || 'none') + ' strips4 ' + centre.meshes.map(m => m.name).join('|').slice(0, 120) + ' foot ' + foot.meshes.length); }; }
  const hidden = spec.hideApp ? [app, app.visible] : null; if (hidden) app.visible = false;
  return { restore() { mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); if (hidden) hidden[0].visible = hidden[1]; } };
}

// ---------- public API ----------
// Multiply obj[field] by factor() for every reader, chaining to an accessor already there (film-edits' light
// multipliers): writers (the app, timeOfDay) keep setting the raw value. Returns the undo.
function scaleProp(obj, field, factor) {
  const own = Object.getOwnPropertyDescriptor(obj, field); let raw = obj[field];
  const get = own?.get ? () => own.get.call(obj) : () => raw, set = own?.set ? v => own.set.call(obj, v) : v => { raw = v; };
  Object.defineProperty(obj, field, { configurable: true, enumerable: true, get: () => get() * factor(), set });
  const undo = () => { const v = get(); delete obj[field]; if (own) Object.defineProperty(obj, field, own); else obj[field] = v; };
  undo.raw = get;   // the value as written, before this factor
  return undo;
}
// The desk's LED light in the room (sceneGlobals.ledRoomSpill, ledWallGlow, ledFloorGlow; the Director's "LED glow on the
// walls" / "LED glow on the floor"). The room LED spill's uniforms live only in its patched materials' shaders (the app
// does not expose the RoomLedSpill), so they are found through the renderer once a patched material has compiled; the
// gain the app writes every frame is scaled: ledRoomSpill (the film's approved level) x ledWallGlow. The room's floor
// surfaces (the floor and rugs: thin, at floor level, patched by the spill) take their own copy of the spill's light
// at ledRoomSpill x ledFloorGlow, and ledFloorGlow scales the desk's own floor light too (the visualizer floor bounce
// and the app's foot glow; per render through film-viewer-leds, else on the foot glow's strength). 1 = the film as approved.
const FLOOR_LED_KEY = '|film-floor-led-v1';
const roomSpillFields = g => !!g && ['ledRoomSpill', 'ledWallGlow', 'ledFloorGlow'].some(k => g[k] !== undefined);
const keysOf = v => v === undefined || v === null ? null : Array.isArray(v) ? v : [[0, Number(v)]];
// The spill's light, again, with its own gain: a second copy of efRoomLight for the floor's shader.
function floorSpillMaterial(spill, gain, onGain) {
  const mat = spill.clone(), prior = spill.onBeforeCompile, key = spill.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prior.call(mat, shader, renderer); onGain(shader.uniforms.efRoomGain);
    const fn = shader.fragmentShader.match(/vec3 efRoomLight\(vec3 albedo\) \{[\s\S]*?\n\}\n/), call = 'outgoingLight+=efRoomLight(diffuseColor.rgb);';
    if (!fn || !shader.fragmentShader.includes(call)) { console.warn('[film-fx] ledFloorGlow: the room LED spill shader changed; ' + (spill.name || spill.type) + ' keeps the wall level'); return; }
    shader.uniforms.efFilmFloorGain = gain;
    shader.fragmentShader = shader.fragmentShader.replace(fn[0], fn[0] + 'uniform float efFilmFloorGain;\n' + fn[0].replace('vec3 efRoomLight(', 'vec3 efRoomLightFloor(').replace(/efRoomGain/g, 'efFilmFloorGain'))
      .replace(call, 'outgoingLight+=efRoomLightFloor(diffuseColor.rgb);');
  };
  mat.customProgramCacheKey = () => key + FLOOR_LED_KEY;
  return mat;
}
function installLedRoomSpill(g) {
  const cell = {}, undo = [];
  const retune = g => {
    cell.base = g.ledRoomSpill !== undefined && g.ledRoomSpill !== null && Number.isFinite(Number(g.ledRoomSpill)) ? Number(g.ledRoomSpill) : 1;
    cell.wk = keysOf(g.ledWallGlow); cell.fk = keysOf(g.ledFloorGlow);
    cell.wall = cell.wk ? keyAt(cell.wk, 0) : 1; cell.floor = cell.fk ? keyAt(cell.fk, 0) : 1;
  };
  retune(g);
  // Which parts this install set up (floor surfaces split, foot glow scaled): a live edit keeping them retunes in place.
  const shape = g => `${!!keysOf(g.ledWallGlow)}|${!!keysOf(g.ledFloorGlow)}`, shape0 = shape(g);
  let gainU = null, gainUndo = null;
  const rawGain = () => gainUndo ? gainUndo.raw() : gainU ? gainU.value : 0;
  const find = () => {
    let u = null; sceneRoot().traverse(o => { if (u || !o.isMesh) return; for (const m of [].concat(o.material || [])) if (!u && m?.customProgramCacheKey?.().includes('room-led-spill') && !m.customProgramCacheKey().includes(FLOOR_LED_KEY)) u = api.renderer.properties.get(m)?.uniforms?.efRoomGain; });
    if (u) { gainU = u; gainUndo = scaleProp(u, 'value', () => cell.base * cell.wall); undo.push(gainUndo); }
  };
  // Floor surfaces: only when the split is in use (a shot with ledRoomSpill alone renders exactly as before).
  const floors = [];
  if (cell.wk || cell.fk) {
    const floorGain = { get value() { return rawGain() * cell.base * cell.floor; }, set value(v) {} };
    const room = api.workspaceRoom?.root;
    if (room) {
      room.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(room), mm = Math.abs(room.getWorldScale(new THREE.Vector3()).x) || 1, b = new THREE.Box3(), made = new Map();
      // Authored in millimetres (the spill's own ranges): thinner than 50 mm, within 80 mm of the room's lowest point,
      // over 0.1 m².
      room.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        const mats = [].concat(o.material || []); if (!mats.some(m => m?.customProgramCacheKey?.().includes('room-led-spill'))) return;
        b.setFromObject(o); if (b.isEmpty()) return;
        const h = b.max.y - b.min.y, area = (b.max.x - b.min.x) * (b.max.z - b.min.z);
        if (h > 50 * mm || b.max.y - box.min.y > 80 * mm || area < 1e5 * mm * mm) return;
        const swap = m => { if (!m?.customProgramCacheKey?.().includes('room-led-spill')) return m; if (!made.has(m)) made.set(m, floorSpillMaterial(m, floorGain, u => { if (!gainU && u) gainU = u; })); return made.get(m); };
        const original = o.material; o.material = Array.isArray(original) ? original.map(swap) : swap(original);
        floors.push({ o, original, mine: o.material });
      });
      undo.push(() => { for (const f of floors) if (f.o.material === f.mine) f.o.material = f.original; for (const m of made.values()) m.dispose(); });
    }
  }
  // The desk's own floor light: the viewer receivers take the gain per render; without them, the foot glow's strength.
  if (active?.viewerLeds?.setFloorGain) { active.viewerLeds.setFloorGain(() => cell.floor); undo.push(() => active?.viewerLeds?.setFloorGain(null)); }
  else if (cell.fk) {
    let foot = null; api.loadedModel?.traverse(o => { if (!foot && o.name === 'Foot LED floor glow' && o.material?.uniforms?.strength) foot = o; });
    if (foot) undo.push(scaleProp(foot.material.uniforms.strength, 'value', () => cell.floor));
  }
  return {
    floors: floors.length,
    frame(s = 0) { if (!gainUndo) find(); if (cell.wk) cell.wall = keyAt(cell.wk, s); if (cell.fk) cell.floor = keyAt(cell.fk, s); },
    // Director live edits: new values in place while the same parts are in use.
    retune(g) { if (!roomSpillFields(g) || shape(g) !== shape0) return false; retune(g); return true; },
    restore: () => { for (const f of undo.reverse()) f(); }
  };
}
function installRoomLight(keys) {
  const k = Array.isArray(keys) ? keys : [[0, keys]], cell = { value: keyAt(k, 0) }, f = () => cell.value, undo = [];
  const scene = sceneRoot(), inDesk = o => { for (let p = o; p; p = p.parent) if (p === api.loadedModel || p.userData?.filmFx) return true; return false; };
  let n = 0, pools = 0; const seen = new Set();
  scene.traverse(o => {
    if (inDesk(o)) return;
    if (o.isLight) { undo.push(scaleProp(o, 'intensity', f)); n++; return; }
    // The rooms' painted light (lamp pools on tables, window sun patches, wall washes) is additive unlit overlays:
    // light too, so it dims with the lights. Screens and LED-named parts keep theirs.
    if (!(o.isMesh || o.isSprite) || /\bLEDs?\b|screen|display|monitor/i.test(o.name || '')) return;
    for (const m of [].concat(o.material || [])) if (m && !seen.has(m) && m.blending === THREE.AdditiveBlending && (m.isMeshBasicMaterial || m.isSpriteMaterial)) { seen.add(m); undo.push(scaleProp(m, 'opacity', f)); pools++; }
  });
  undo.push(scaleProp(scene, 'environmentIntensity', f));
  const gain = api.workspaceRoom?.bounce?.uniforms?.efBounceGain; if (gain) undo.push(scaleProp(gain, 'value', f));
  return { lights: n, pools, frame: s => { cell.value = keyAt(k, s); }, restore: () => { for (const u of undo.reverse()) u(); } };
}
// Piecewise-linear [[seconds, value], …] (held before the first key and after the last).
const keyAt = (k, s) => { const i = k.findIndex(p => p[0] > s); return i < 0 ? k.at(-1)[1] : i === 0 ? k[0][1] : k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (s - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); };
export const Box3 = THREE.Box3;
// Director: the floor reflections' pools (world-space outlines per source: foot, center, left, right) on the live stage,
// and a preview of ledFloorSources while a handle is dragged (undefined: back to the installed shot's).
export const floorPools = () => active?.viewerLeds?.pools?.() ?? [];
export const previewFloorSources = (v) => active?.viewerLeds?.setSources?.(v === undefined ? active.shot.sceneGlobals?.ledFloorSources ?? null : v);
// The desk's bounding-box centre in world space (render-cut --list-objects).
export function deskBox() { const b = new THREE.Box3().setFromObject(api.loadedModel), c = b.getCenter(new THREE.Vector3()); return [c.x, b.min.y, c.z]; }
// sceneGlobals: {environmentScale, exposure} — the image-based ambient and the
// renderer exposure, multiplied/set for this shot and restored after.
function installGlobals(shot) {
  if (!shot.sceneGlobals) return;
  let sc = api.loadedModel; while (sc.parent) sc = sc.parent; const g = shot.sceneGlobals;
  active.globals = { env: sc.environmentIntensity, exposure: api.renderer.toneMappingExposure, scene: sc };
  if (Number.isFinite(g.environmentScale)) sc.environmentIntensity *= g.environmentScale;
  // Keyframed [[seconds, scale], …] (e.g. lights out at the end of a chapter), applied per frame.
  else if (Array.isArray(g.environmentScale)) active.globals.envKeys = g.environmentScale;
  if (Number.isFinite(g.exposure)) api.renderer.toneMappingExposure = g.exposure;
  // exposureScale: a grade on top of the room's own exposure. An instance accessor, so timeOfDay's per-frame
  // blend and the app's mode switches keep writing the raw value and the render reads raw x scale.
  if (g.exposureScale !== undefined) {
    const r = api.renderer, own = Object.getOwnPropertyDescriptor(r, 'toneMappingExposure'); let raw = r.toneMappingExposure;
    const k = Array.isArray(g.exposureScale) ? g.exposureScale : [[0, g.exposureScale]], cell = { value: keyAt(k, 0) };
    Object.defineProperty(r, 'toneMappingExposure', { configurable: true, enumerable: true, get: () => raw * cell.value, set: v => { raw = v; } });
    active.globals.exposureCell = { cell, keys: k, capture: cell.value, undo: () => { delete r.toneMappingExposure; if (own) Object.defineProperty(r, 'toneMappingExposure', own); r.toneMappingExposure = raw; } };
  }
}
export async function install(shot) {
  clear();
  unhookPreset();
  const wants = shot.quality || shot.screens?.length || shot.ledMode === 'media' || shot.clock || shot.timeOfDay || shot.accessories || shot.ledGlow !== undefined || shot.sceneEdits || shot.lights || shot.ledSurfaces || shot.sceneGlobals || shot.ledStatus || shot.obstacles || shot.ledColor || shot.deskObjects || shot.floorLight || shot.ledReceivers || shot.deskFinish || shot.lightEdits?.length || shot.sceneDeskPoses?.length || shot.sceneBranding || shot.sceneDeskEdits?.length || shot.featuredBuild;
  if (!wants) return null;
  active = { shot, list: [], screens: [], led: null, clocks: [], tod: null, desk: null, edits: null, lights: null };
  active.desk = await installDeskObjects(shot);
  if (shot.deskFinish) active.finish = installDeskFinish(shot.deskFinish);
  if (shot.featuredBuild) active.featured = await installFeaturedBuild(shot.featuredBuild);
  if (shot.room === 'workshop') active.workshopToyStory = await (await import('./workshop-toy-story.mjs?v=20261113-andre-shelf')).installWorkshopToyStory(api);
  if (shot.sceneDeskPoses?.length) active.deskPoses = installSceneDeskPoses(shot.sceneDeskPoses);
  if (shot.sceneDeskEdits?.length) { active.deskEdits = (await import('./film-desk-edits.mjs')).installDeskEdits(shot.sceneDeskEdits, api); await active.deskEdits.ready; }
  // School branding on every room desk (after the poses: a rig re-poses its artwork with it).
  if (shot.sceneBranding) { active.branding = (await import('../../experience/branding-live.mjs')).installBranding(shot.sceneBranding, window); await active.branding.ready; }
  if (shot.deskObjects) {
    // The app's own object editor, as stage.mjs places the keyboard: select, change, deselect.
    const objects = api.sceneDesks?.objects, deg = THREE.MathUtils.radToDeg; active.desk.placed = [];
    for (const [id, t] of Object.entries(shot.deskObjects)) {
      const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(t.q.x, t.q.y, t.q.z, t.q.w));
      objects?.select(id); if (objects?.selected !== id) { console.warn('[film-fx] deskObjects: no object ' + id + ' on the featured desk'); continue; }
      objects.change({ x: t.p.x, y: t.p.y, z: t.p.z, rotation: deg(e.y), tilt: deg(e.x), roll: deg(e.z) }); active.desk.placed.push(id);
    }
    objects?.select(null); await objects?.ready;
  }
  if (active.desk.added.length || active.desk.toggled.length || shot.deskObjects) await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const list = active.list = discover(shot);
  active.screens = await installScreens(shot, list);
  if (shot.ledMode === 'media') {
    active.led = await makeLed(shot, active.screens, list);
    api.setLedEffect({ mode: 'solid', period: 6 }, false);
  }
  installGlobals(shot);
  // ledSurfaces: the app's LED surface sliders (desktopStrength, floorStrength, …), restored after the shot.
  if (shot.ledSurfaces) { active.surfaces = api.ledSurfaces; for (const [k, v] of Object.entries(shot.ledSurfaces)) api.setLedSurface(k, v, false); }
  active.ledColor0 = api.ledColor;   // the stage's own colour (Director update)
  if (shot.ledColor) { active.ledColor = api.ledColor; api.setLedColor(shot.ledColor, false); }
  // ledGlow: the app's LED brightness slider as a fraction of full (the stage uses .35).
  if (Number.isFinite(shot.ledGlow)) api.setLedGlow(api.ledFullBrightness * THREE.MathUtils.clamp(shot.ledGlow, 0, 1), false);
  if (shot.ledStatus || shot.obstacles) { const S = await import('./film-status.mjs'); await S.prepareObstacles(shot); active.status = S.installStatus(shot); }
  if (shot.floorLight) active.floor = installFloorLight(shot);
  if (shot.ledReceivers) active.viewerLeds = (await import('./film-viewer-leds.mjs')).installViewerLeds(shot);   // before wheels: both wrap render
  if (shot.sceneGlobals?.ledFloorSources) active.viewerLeds?.setSources?.(shot.sceneGlobals.ledFloorSources);
  if (shot.motion && shot.wheelFix !== false) active.wheels = installWheelFix(shot);   // before quality: its compositor wraps this render
  // quality: GPU render-box overrides (shadow maps, anisotropy, room reflections, GTAO, selective bloom); film-quality.mjs.
  if (shot.quality) { active.quality = await (await import('./film-quality.mjs')).installQuality(shot, { screens: active.screens }); if (active.quality) console.log('[film-quality]', JSON.stringify(active.quality.info)); }
  if (shot.clock) { active.clocks = findClocks(); if (!active.clocks.length) console.warn('[film-fx] clock: no wall clock in this room'); }
  if (shot.timeOfDay) active.tod = await (await import('./film-tod.mjs')).installTimeOfDay(shot);
  if (shot.sceneEdits || shot.lights) { const E = await import('./film-edits.mjs'); if (shot.sceneEdits) { await E.prepareAdds(shot); active.edits = E.installEdits(shot); } if (shot.lights) active.lights = E.installLights(shot); }
  // After timeOfDay (which snapshots the raw light levels) and sceneEdits (whose light multipliers it chains to).
  if (shot.sceneGlobals?.roomLight !== undefined) active.roomLight = installRoomLight(shot.sceneGlobals.roomLight);
  if (roomSpillFields(shot.sceneGlobals)) { active.roomSpill = installLedRoomSpill(shot.sceneGlobals); active.roomSpill.frame(); }
  // lightEdits: Director changes to existing lights (experience/light-edits.mjs), after the shot's own lights and edits.
  if (shot.lightEdits?.length) { active.lightEdits = (await import('../../experience/light-edits.mjs')).installLightEdits(shot.lightEdits, sceneRoot()); if (active.lightEdits.missing.length) console.warn('[film-fx] lightEdits: no light at ' + active.lightEdits.missing.join(' | ')); }
  return { accessories: active.desk.added.length + active.desk.toggled.length, deskObjects: active.desk.placed, screens: active.screens.map(s => ({ target: s.target.id, alias: s.target.alias, canvas: [s.canvas.width, s.canvas.height], aspect: +s.target.frame.aspect.toFixed(3) })), clocks: active.clocks.map(c => c.kind + ':' + c.obj.name), led: !!active.led, timeOfDay: !!active.tod, sceneEdits: active.edits?.count, lights: active.lights?.count, floorLight: !!active.floor, roomLight: active.roomLight ? [active.roomLight.lights, active.roomLight.pools] : undefined, ledRoomSpill: active.roomSpill ? { floors: active.roomSpill.floors } : undefined, ledReceivers: active.viewerLeds?.info, deskEdits: active.deskEdits ? { desks: active.deskEdits.desks, missing: active.deskEdits.missing, ...(active.deskEdits.hides?.length ? { hides: active.deskEdits.hides } : {}) } : undefined };
}
// Director live edits: apply changed lighting fields in place, without clear() / prepare, so props, screens,
// accessories and sceneEdits stay. Per-frame data (status, desk white, keyed scales, time-of-day times, light
// edits) is swapped; layers that chain onto each other are undone and re-installed together, last first.
// Returns 'ok' (in place, synchronous for data-only changes), 'slow' (time-of-day modes or a scene-globals
// shape change re-captured the room: onSlow() ran first so the caller can hold the frame) or 'full' (a field
// that needs install: the caller runs clear() + install()).
// sceneEdits too (the Director's prop edits): the edits layer and everything chained after it re-install in place.
const LIVE_FIELDS = ['lights', 'lightEdits', 'ledStatus', 'ledNeutral', 'ledColor', 'sceneGlobals', 'timeOfDay', 'obstacles', 'sceneEdits', 'sceneBranding', 'sceneDeskEdits', 'featuredBuild'];
const TAIL = ['tod', 'edits', 'lights', 'roomLight', 'roomSpill', 'lightEdits'];
export async function update(shot, { onSlow } = {}) {
  if (!active) return 'full';
  const prev = active.shot, bare = v => JSON.stringify(v, (k, x) => k === '__count' ? undefined : x), same = (a, b) => bare(a) === bare(b), changed = k => !same(prev[k], shot[k]);
  for (const k of new Set([...Object.keys(prev), ...Object.keys(shot)])) if (!LIVE_FIELDS.includes(k) && changed(k)) return 'full';
  const g0 = prev.sceneGlobals || {}, g1 = shot.sceneGlobals || {}, gChanged = k => !same(g0[k], g1[k]);
  let tail = TAIL.length, globals = false, status = false;
  if (gChanged('exposure') || gChanged('environmentScale') || gChanged('exposureScale')) {
    const G = active.globals, envFast = !gChanged('environmentScale') || (Array.isArray(g0.environmentScale) && Array.isArray(g1.environmentScale) && G?.envKeys);
    const expFast = !gChanged('exposureScale') || (G?.exposureCell && g1.exposureScale !== undefined);
    if (!gChanged('exposure') && envFast && expFast) {
      if (gChanged('environmentScale')) G.envKeys = g1.environmentScale;
      if (gChanged('exposureScale')) {
        let k = Array.isArray(g1.exposureScale) ? g1.exposureScale : [[0, g1.exposureScale]];
        // timeOfDay snapshotted the exposure through the scale it saw at install and writes that back as the raw
        // value, so a fresh install multiplies by the new scale twice. Match it without re-capturing the room.
        if (active.tod && G.exposureCell.capture) { const f = keyAt(k, 0) / G.exposureCell.capture; k = k.map(([t, v]) => [t, v * f]); }
        G.exposureCell.keys = k; G.exposureCell.cell.value = keyAt(k, 0);
      }
    } else { globals = true; tail = 0; }
  }
  if (changed('ledColor') || changed('ledStatus') || changed('ledNeutral') || changed('obstacles')) status = true;
  // Floor reflections per source: data only, in place.
  if (gChanged('ledFloorSources')) active.viewerLeds?.setSources?.(g1.ledFloorSources ?? null);
  if (changed('timeOfDay')) {
    const seq = x => [...(x || [])].sort((a, b) => a.at - b.at).map(k => k.mode).join();
    if (!(active.tod?.retime && prev.timeOfDay?.length && shot.timeOfDay?.length && seq(prev.timeOfDay) === seq(shot.timeOfDay) && active.tod.retime(shot.timeOfDay))) tail = 0;
  }
  if (changed('sceneEdits')) tail = Math.min(tail, 1);
  if (changed('lights')) tail = Math.min(tail, 2);
  if (gChanged('roomLight')) tail = Math.min(tail, 3);
  if ((gChanged('ledRoomSpill') || gChanged('ledWallGlow') || gChanged('ledFloorGlow')) && !(tail > 4 && active.roomSpill?.retune(g1))) tail = Math.min(tail, 4);
  if (changed('lightEdits')) tail = Math.min(tail, 5);
  // sceneBranding (the Director's Branding tab) is independent of the lighting chain: re-applied on its own, in place.
  if (changed('sceneBranding')) {
    await active.branding?.restore(); active.branding = null;
    if (shot.sceneBranding) { active.branding = (await import('../../experience/branding-live.mjs')).installBranding(shot.sceneBranding, window); await active.branding.ready; }
  }
  const slow = globals || tail === 0; if (slow) onSlow?.();
  for (let i = TAIL.length - 1; i >= tail; i--) { active[TAIL[i]]?.restore(); active[TAIL[i]] = null; }
  if (globals && active.globals) { active.globals.exposureCell?.undo(); active.globals.scene.environmentIntensity = active.globals.env; api.renderer.toneMappingExposure = active.globals.exposure; active.globals = null; }
  if (status) { active.status?.clear(); active.status = null; }
  active.shot = shot;
  // sceneDeskEdits (the Director's desk edits): restore and re-apply on the room's desks, in place.
  if (changed('sceneDeskEdits')) {
    active.deskEdits?.restore(); active.deskEdits = null;
    if (shot.sceneDeskEdits?.length) { active.deskEdits = (await import('./film-desk-edits.mjs')).installDeskEdits(shot.sceneDeskEdits, api); await active.deskEdits.ready; }
  }
  // featuredBuild (the Director's Build tab on the featured desk): swatches and accessories back, then applied again.
  if (changed('featuredBuild')) {
    active.featured?.restore(); active.featured = null;
    if (shot.featuredBuild) active.featured = await installFeaturedBuild(shot.featuredBuild);
  }
  if (globals) installGlobals(shot);
  if (status) {
    if (shot.ledColor && active.ledColor === undefined) active.ledColor = active.ledColor0;
    api.setLedColor(shot.ledColor || active.ledColor || active.ledColor0, false);
    if (shot.ledStatus || shot.obstacles) { const S = await import('./film-status.mjs'); await S.prepareObstacles(shot); active.status = S.installStatus(shot); }
  }
  for (let i = tail; i < TAIL.length; i++) {
    const k = TAIL[i];
    if (k === 'tod' && shot.timeOfDay) active.tod = await (await import('./film-tod.mjs')).installTimeOfDay(shot);
    if (k === 'edits' && shot.sceneEdits) { const E = await import('./film-edits.mjs'); await E.prepareAdds(shot); active.edits = E.installEdits(shot); }
    if (k === 'lights' && shot.lights) active.lights = (await import('./film-edits.mjs')).installLights(shot);
    if (k === 'roomLight' && shot.sceneGlobals?.roomLight !== undefined) active.roomLight = installRoomLight(shot.sceneGlobals.roomLight);
    if (k === 'roomSpill' && roomSpillFields(shot.sceneGlobals)) { active.roomSpill = installLedRoomSpill(shot.sceneGlobals); active.roomSpill.frame(); }
    if (k === 'lightEdits' && shot.lightEdits?.length) active.lightEdits = (await import('../../experience/light-edits.mjs')).installLightEdits(shot.lightEdits, sceneRoot());
  }
  return slow ? 'slow' : 'ok';
}
export async function frame(t, chapterSeconds, { video = false, screens = true, timing = null } = {}) {
  if (!active) return;
  let mark = timing ? performance.now() : 0; const lap = name => { if (!timing) return; const now = performance.now(); timing[name] = (timing[name] || 0) + now - mark; mark = now; };
  for (const v of active.desk?.timed || []) v.cell.force = visibleAt(v.keys, chapterSeconds);
  if (active.tod) active.tod.apply(chapterSeconds); lap('timeOfDay');
  active.workshopToyStory?.frame(chapterSeconds);
  active.deskEdits?.frame(chapterSeconds);   // the other desks' own moves by chapter time (film-desk-edits.mjs)
  active.roomLight?.frame(chapterSeconds);
  active.roomSpill?.frame(chapterSeconds);
  if (active.globals?.exposureCell) active.globals.exposureCell.cell.value = keyAt(active.globals.exposureCell.keys, chapterSeconds);
  if (active.globals?.envKeys) {
    const k = active.globals.envKeys, i = k.findIndex(p => p[0] > chapterSeconds);
    const v = i < 0 ? k.at(-1)[1] : i === 0 ? k[0][1] : k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (chapterSeconds - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
    active.globals.scene.environmentIntensity = active.globals.env * v;
  }
  active.quality?.frame();
  active.edits?.apply(chapterSeconds); active.lights?.apply(chapterSeconds); active.lightEdits?.apply(); lap('lights');
  if (active.screens.length && screens) { await updateScreens(active.screens, chapterSeconds); lap('screens'); }
  if (active.clocks.length) setClocks(active.clocks, active.shot.clock, active.shot, chapterSeconds);
  active.status?.frame(chapterSeconds); lap('status');
  if (active.led) {
    const led = active.led; await sampleLed(led, chapterSeconds, video);
    api.setLedColor(led.avg, false);
    // The app's Game Mode path: updateLedEffectFrame (inside bakeDraw) asks
    // ledGame.sample(frame) first and uploads it as linear pixels to the
    // desk strips, the desk spill and the room spill.
    led.game.sample = out => { out.forEach((row, i) => row.set(led.live[i])); return true; };
    led.game.active = true;
  }
}
export function after() {
  active?.status?.after();
  if (active?.led) { delete active.led.game.sample; active.led.game.active = false; }
}
export function clear() {
  if (!active) return;
  after();
  for (const sc of active.screens) { sc.mesh.removeFromParent(); sc.mesh.geometry.dispose(); sc.material?.dispose(); sc.mesh.material.dispose(); sc.texture.dispose(); if (sc.media instanceof HTMLVideoElement) { sc.media.removeAttribute('src'); sc.media.load(); } }
  if (active.led?.source.sampler) { active.led.source.media.removeAttribute('src'); active.led.source.media.load(); }
  if (active.clocks.length) restoreClocks(active.clocks);
  if (active.globals) { active.globals.exposureCell?.undo(); active.globals.scene.environmentIntensity = active.globals.env; api.renderer.toneMappingExposure = active.globals.exposure; }
  if (active.surfaces) for (const [k, v] of Object.entries(active.surfaces)) api.setLedSurface(k, v, false);
  if (active.ledColor) api.setLedColor(active.ledColor, false);
  active.status?.clear();
  active.quality?.restore();
  active.floor?.restore();
  active.wheels?.restore();   // after quality.restore, which hands the render back to this wrapper
  active.viewerLeds?.restore();   // after wheels.restore (installed first, so wrapped by it)
  active.lightEdits?.restore();   // first: its intensity accessor chains over the edits' and roomLight's
  active.roomSpill?.restore(); active.roomLight?.restore();   // before edits / timeOfDay: it chains to their accessors
  active.lights?.restore(); active.edits?.restore();
  active.tod?.restore();
  active.workshopToyStory?.restore();
  active.featured?.restore();   // before the film's own accessories / finish go back
  clearDeskObjects(active.desk);
  active.finish?.restore();
  active.branding?.restore();   // before the poses go back: it only swaps the desks' artwork
  active.deskEdits?.restore();   // before deskPoses (installed after it)
  active.deskPoses?.restore();
  active = null;
}
export { discover };
