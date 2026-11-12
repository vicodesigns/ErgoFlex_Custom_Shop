// sceneEdits + lights for render-cut (harness only; see film-fx.mjs header).
//
// sceneEdits:[{match:'<regex on object name>', path:'<regex on the full
//   "A > B > C" path>' (optional, narrows), materialName:'<regex>',
//   materialColor:'#hex', materialType:'Basic' (optional: only those
//   materials), hide:true,
//   position:[dx,dy,dz] (world metres, added once; with space:'local' metres along the parent's own axes, for props
//   riding on the desk: they keep the offset through lift and tilt whatever pose the edit is installed at), rotation:[dx,dy,dz] (deg,
//   added to the local Euler), scale:s or [sx,sy,sz] (local, multiplied), hide:false
//   shows an object an earlier edit hid (back to whatever the app sets), material:{color, emissive, roughness, metalness, clearcoat,
//   clearcoatRoughness, envMapIntensity, emissiveIntensity, opacity,
//   emissiveScale, opacityScale, colorScale (unlit backdrops), mapBlur (mip
//   LOD, ~2^lod texels), mapRotation (deg: the colour map turned about its centre, e.g. 180 for a picture
//   the right way up on a prop placed upside down)}, opacity:<multiplier or [[sec,value],…]>,
//   radialFade:[r0,r1] (lines/meshes fade out between r0 and r1 metres from
//   the object's own origin), clone:false}]
//   dropFaces:{min:[x,y,z], max:[x,y,z]}: removes the matched meshes' triangles lying wholly inside that box, in each
//   mesh's glTF node space (metres of the supplied file), e.g. the MagSafe-style puck merged into the phone's frame.
//   Material values may be keyframed: [[chapterSeconds, value], …] (linear).
//   emissiveScale / opacityScale / opacity multiply whatever the app or the
//   stage writes each frame (time-of-day, the stage's pulse fade …).
//   Stage aliases for match: @grid @pulse @sweep @pylons @stageLight @floor;
//   @window = the room's exterior backdrop (home, creative, gym, highschool).
//   material.brightness: colour gain for unlit backdrops, emissive gain otherwise.
//   minArea (m²): skip matched meshes smaller than this.
//   near:[x, z, r]: keep only matches whose world origin lies within r (scene units, xz) of (x, z),
//   for one of several same-named props (e.g. a single chair at a table).
//   asset:'<Studio scene asset key>' keeps only the object whose userData.sceneAssetKey is that key (one of many
//   same-named room props, wherever it stands; the Director targets Studio props this way).
//   add:{asset:'<assets/props id>'}, id, parent:'desk'|'shelf'|'lower-shelf'|'base-shelf'|'room', position, rotation, scale (with director:true): a library
//   prop the film doesn't have (experience/prop-edits.mjs cleanAddEdit), placed in its parent's frame (desk: the
//   featured desk's desktop dressing, riding lift and tilt; room: the room's asset root, else the stage). Loaded by
//   prepareAdds(shot) (await it before installEdits; film-fx does) through Studio's own PROP_LIBRARY (workspace-3d.mjs,
//   the same module instance and GLB cache as the app), named 'Added prop:<asset>#<id>', removed by restore().
//   desk:'<preset id>' (Director edits in a chapter rendered as sub-shots): the edit is skipped unless the shot's
//   preset is that desk, so each desk of the finale keeps its own props (experience/prop-edits.mjs).
//   show:{from, to, fadeIn, fadeOut} (seconds; chapter seconds, or with desk: seconds after the sub-shot's
//   renderRange start): the matched objects (or the added prop) are drawn only from…to, their opacity ramped over
//   fadeIn / fadeOut inside the window (materials are copied only while a fade runs).
//   director:true marks the Director's own prop edits (experience/prop-edits.mjs): offsets from the film's
//   placement, applied after every hand-made edit; build-round8-director.py replaces them on import.
//   lightType:'<regex on light type>' (PointLight|SpotLight|HemisphereLight|
//   DirectionalLight|RectAreaLight) selects lights instead; then intensity:
//   <multiplier | keyframes> and color:'#hex'.
//   materialType:'!Basic' (leading !) keeps only materials whose type lacks it.
//   recolor:[{hue:[h0,h1], minChroma, maxChroma, h, s, sScale, l}, …] remaps
//   colours in sRGB HSL on the matched objects: material color/emissive,
//   InstancedMesh per-instance colours, canvas/image colour maps (map,
//   emissiveMap; copied, alpha kept) and, with lightType, light color/
//   groundColor. Per colour the first rule whose hue band (degrees; [340,20]
//   wraps) and chroma (max-min of sRGB, 0…1) hold applies: h = new hue, s = new
//   HSL saturation (or sScale ×), l = lightness × number or a [[in,out],…]
//   piecewise curve. Unmatched colours stay. Off unless given (film-only
//   room recolours, e.g. tools/experience/gym-black-red.json).
// lights:[{preset:'productRig', …overrides} | {type:'rect'|'spot'|'point'|
//   'directional', position:[x,y,z] | at:{az,el,dist} (degrees/metres around
//   the desk; az 0 = desk front, + = desk's left), target:[x,y,z], color,
//   intensity, width, height, angle, penumbra, distance, castShadow:false}]
//   Light intensity and pool strength / contact opacity may be keyframed like
//   material values: [[chapterSeconds, value], …] (linear).
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const api = window.ErgoFlex;
const sceneRoot = () => { let s = api.loadedModel; while (s?.parent) s = s.parent; return s; };
const pathOf = (o, root) => { const out = []; for (let p = o; p && p !== root; p = p.parent) out.unshift(p.name || p.type); return out.join(' > '); };
const keyed = v => Array.isArray(v) && Array.isArray(v[0]);
const sample = (v, s) => {
  if (!keyed(v)) return v;
  if (s <= v[0][0]) return v[0][1]; const last = v[v.length - 1]; if (s >= last[0]) return last[1];
  let i = 0; while (v[i + 1][0] < s) i++; const [t0, a] = v[i], [t1, b] = v[i + 1];
  return a + (b - a) * (s - t0) / Math.max(1e-6, t1 - t0);
};

function stageObjects() {
  const scene = sceneRoot(), fx = scene.children.find(o => o.name === 'Cinematic effects'), out = { grid: [], pulse: [], sweep: [], pylons: [], stageLight: [], floor: [] };
  for (const o of fx?.children || []) {
    if (o.type === 'GridHelper' || o.isLineSegments) out.grid.push(o);
    else if (o.isMesh && o.geometry?.type === 'RingGeometry') (o.geometry.parameters.thetaLength < 6.28 ? out.sweep : out.pulse).push(o);
    else if (o.isMesh && o.geometry?.type === 'CylinderGeometry') out.pylons.push(o);
    else if (o.isLight) out.stageLight.push(o);
  }
  scene.traverse(o => { if (o.isMesh && o.material?.isShadowMaterial) out.floor.push(o); });
  return out;
}
// The objects one sceneEdit acts on (the Director checks its prop targets with this, in the stage frame).
export function editTargets(edit) { return targets(edit); }
function targets(edit) {
  const scene = sceneRoot(), m = String(edit.match || '');
  if (m === '@window') { const w = WINDOWS[api.roomScene]; if (!w) { console.warn('[film-fx] @window: no exterior backdrop known for room', api.roomScene); return []; } return targets({ ...edit, ...w, match: '' }); }
  if (m.startsWith('@')) return stageObjects()[m.slice(1)] || [];
  if (edit.lightType) {
    const lt = new RegExp(edit.lightType, 'i'), re = new RegExp(m, edit.flags ?? 'i'), pre = edit.path ? new RegExp(edit.path, 'i') : null, out = [];
    scene.traverse(o => { if (o.isLight && !o.userData.filmFx && lt.test(o.type) && re.test(o.name) && (!pre || pre.test(pathOf(o, scene)))) out.push(o); });
    return out;
  }
  const re = new RegExp(m, edit.flags ?? 'i'), pre = edit.path ? new RegExp(edit.path, 'i') : null, mok = materialFilter(edit), out = [];
  scene.traverse(o => {
    if (o.userData.filmFx) return;
    if (mok) { if (o.isMesh && o.visible && [].concat(o.material).some(x => x && mok(x)) && re.test(o.name) && (!pre || pre.test(pathOf(o, scene)))) out.push(o); return; }
    if (re.test(o.name) && (!pre || pre.test(pathOf(o, scene)))) out.push(o);
  });
  if (edit.asset) for (let i = out.length - 1; i >= 0; i--) if (out[i].userData.sceneAssetKey !== edit.asset) out.splice(i, 1);
  if (edit.near) { const [nx, nz, nr] = edit.near, w = new THREE.Vector3(); scene.updateMatrixWorld(true); for (let i = out.length - 1; i >= 0; i--) { out[i].getWorldPosition(w); if (Math.hypot(w.x - nx, w.z - nz) > nr) out.splice(i, 1); } }
  if (edit.minArea) { const sz = new THREE.Vector3(); for (let i = out.length - 1; i >= 0; i--) { new THREE.Box3().setFromObject(out[i]).getSize(sz); if (Math.max(sz.x * sz.y, sz.y * sz.z, sz.x * sz.z) < edit.minArea) out.splice(i, 1); } }
  // Drop descendants of other matches (a group and its children both matching).
  return out.filter(o => !out.some(p => p !== o && (() => { for (let q = o.parent; q; q = q.parent) if (q === p) return true; return false; })()));
}

// Optional material filters: materialName (regex), materialColor ('#a38c8c'),
// materialType ('MeshStandardMaterial' or 'Basic'); all given must hold.
function materialFilter(edit) {
  if (!edit.materialName && !edit.materialColor && !edit.materialType) return null;
  const re = edit.materialName ? new RegExp(edit.materialName, 'i') : null, col = edit.materialColor ? new THREE.Color(edit.materialColor).getHex() : null;
  const not = String(edit.materialType || '').startsWith('!'), type = not ? edit.materialType.slice(1) : edit.materialType;
  return m => (!re || re.test(m.name || '')) && (col === null || m.color?.getHex() === col) && (!type || m.type.includes(type) !== not);
}
// Window exteriors (painted backdrops behind the glazing) per room, found by
// --list-screens-style probing: unlit canvas backdrops, or the HBHS emissive pane.
const WINDOWS = {
  home: { path: 'Window wall', materialType: 'Basic', minArea: 3 },
  creative: { path: 'Artist daylight wall', materialType: 'Basic', minArea: 3 },
  gym: { path: 'daylight and entry wall', materialType: 'Basic', minArea: 3 },
  highschool: { path: 'Daylight window', materialType: 'Standard', minArea: 10 }
};
// A room whose window is a photographed vista (window-vista.mjs) takes `vista: { brightness, soften, zoom, horizon }`
// on its @window edit: brightness multiplies the daypart grade, the others replace the vista's own values. The
// painted-backdrop keys of the same edit (material.brightness, mapBlur) were tuned for the canvas and are skipped.
function vistaEdit(edit, undo) {
  const panes = []; sceneRoot().traverse(o => { if (o.isMesh && o.userData.windowVista && o.material?.uniforms?.gain) panes.push(o); });
  if (!panes.length) return false;
  for (const pane of panes) {
    const u = pane.material.uniforms, v = edit.vista || {};
    if (v.brightness !== undefined) { const before = u.gain.value.clone(); u.gain.value.multiplyScalar(Number(v.brightness)); undo.push(() => u.gain.value.copy(before)); }
    for (const [key, name] of [['soften', 'soften'], ['zoom', 'zoom'], ['horizon', 'horizon']]) if (v[key] !== undefined) { const before = u[name].value; u[name].value = Number(v[key]); undo.push(() => { u[name].value = before; }); }
  }
  return true;
}
// ---------- added props (sceneEdits[].add) ----------
// Studio's prop library, the very module the app imported (same URL, so the same PROP_LIBRARY and GLB cache).
let library = null;
export function propLibrary() {
  return library ||= (async () => {
    let url = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/workspace-3d\.mjs(\?|$)/.test(n));
    if (!url) { try { const src = await (await fetch('/studio.js', { cache: 'force-cache' })).text(), m = /from '\.\/(workspace-3d\.mjs[^']*)'/.exec(src); if (m) url = '/' + m[1]; } catch {} }
    const mod = await import(url || '/workspace-3d.mjs');
    await mod.PROP_LIBRARY.loadIndex(); return mod.PROP_LIBRARY;
  })().catch(error => { library = null; throw error; });
}
const prepared = new WeakMap();
// Load every added prop of the shot (cached GLBs, fresh instances) so installEdits can place them synchronously.
// An edit kept to one desk of a sub-shot chapter (desk:'<preset id>') holds only in the shot whose preset is that desk.
export const forThisDesk = (edit, shot) => !edit?.desk || edit.desk === shot?.preset;
// Opacity (0…1) of a timed edit at chapter seconds s (the same rule as experience/prop-edits.mjs showFactor);
// a window that reaches the end of the shot stays on through its last frame.
export function showFactor(edit, shot, s) {
  const w = edit?.show; if (!w) return 1;
  const t = s - (edit.desk ? shot?.renderRange?.[0] || 0 : 0);
  if (t < w.from - 1e-6 || t > w.to + 1e-6) return 0;
  let f = 1; if (w.fadeIn > 0) f = Math.min(f, (t - w.from) / w.fadeIn); if (w.fadeOut > 0) f = Math.min(f, (w.to - t) / w.fadeOut);
  return Math.max(0, Math.min(1, f));
}
let lastSeconds = 0;   // the last chapter time applied: a timed prop installed while paused is right before the next frame
// A timed edit on its objects: not drawn outside the window (a getter over whatever else sets visible), and while a
// fade runs the meshes wear see-through copies of their materials (shared maps, so a playing screen keeps playing).
function installShow(edit, objects, shot, undo, live) {
  const cell = { f: 1 }, fades = [];
  for (const o of objects) {
    const own = Object.getOwnPropertyDescriptor(o, 'visible'); let raw = own && !('value' in own) ? undefined : o.visible;
    const get = own?.get ? () => own.get.call(o) : () => raw, set = own?.set ? v => own.set.call(o, v) : v => { raw = v; };
    Object.defineProperty(o, 'visible', { configurable: true, enumerable: true, get: () => cell.f > 0 && get(), set });
    undo.push(() => { delete o.visible; if (own && !('value' in own)) Object.defineProperty(o, 'visible', own); else o.visible = raw; });
    o.traverse(mesh => { if (mesh.material && !mesh.userData.filmFx) fades.push({ mesh, orig: null, copy: null }); });
  }
  const endFade = x => { if (!x.copy) return; if (x.mesh.material === x.copy) x.mesh.material = x.orig; for (const m of [].concat(x.copy)) m.dispose(); x.orig = x.copy = null; };
  const tick = s => {
    cell.f = showFactor(edit, shot, s);
    const fading = cell.f > 0 && cell.f < 1;
    for (const x of fades) {
      if (!fading) { endFade(x); continue; }
      if (!x.copy || x.mesh.material !== x.copy) {
        if (x.copy) for (const m of [].concat(x.copy)) m.dispose();
        x.orig = x.mesh.material;
        const dup = m => { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.userData = { ...m.userData, filmFxCopy: true, showBase: m.opacity }; c.transparent = true; return c; };
        x.copy = Array.isArray(x.orig) ? x.orig.map(dup) : dup(x.orig); x.mesh.material = x.copy;
      }
      for (const m of [].concat(x.copy)) m.opacity = m.userData.showBase * cell.f;
    }
  };
  tick(lastSeconds); live.push(tick); undo.push(() => { for (const x of fades) endFade(x); });
}
export async function prepareAdds(shot, library = null) {   // library: tests pass a stand-in for PROP_LIBRARY
  const adds = (shot.sceneEdits || []).filter(e => e?.add && forThisDesk(e, shot));
  if (!adds.length) return 0;
  const lib = library || await propLibrary();
  await Promise.all(adds.map(async e => {
    const asset = typeof e.add === 'string' ? e.add : e.add.asset;
    if (!lib.entry(asset)) { console.warn('[film-fx] sceneEdits add: no library prop ' + asset); return; }
    try { prepared.set(e, await lib.instance(asset)); } catch (error) { console.warn('[film-fx] sceneEdits add: ' + asset + ' could not load', error); }
  }));
  return adds.length;
}
const shownTree = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const inScene = (o, scene) => { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; };
// Where an added prop lives: 'desk' = the featured desk's desktop, 'shelf' / 'lower-shelf' / 'base-shelf' = that shelf
// (a scene desk's dressing, else the product desk's accessory mount: it rides the surface through lift and tilt);
// 'room' = the room's asset root, else the stage.
export const DESK_SURFACES = { desk: 'desktop', shelf: 'shelf', 'lower-shelf': 'lower-shelf', 'base-shelf': 'base-shelf' };
export function addParent(kind) {
  const scene = sceneRoot(), role = Object.hasOwn(DESK_SURFACES, kind) ? DESK_SURFACES[kind] : null;
  if (role) {
    const rig = api.sceneDesks?.active?.rig?.mounts?.[role]; if (rig && inScene(rig, scene)) return rig;
    const m = api.workspaceAccessories?.mounts?.get(role); if (m?.group && inScene(m.group, scene)) return m.group;
    return null;
  }
  const root = api.workspaceRoom?.root; return root && inScene(root, scene) && shownTree(root) ? root : scene;
}
// Scene units per millimetre (a library instance is in millimetres at scale 1000 under a millimetre parent).
export const mmScale = () => api.workspaceAccessories?.scale || api.workspaceRoom?.scale || .001;
function installAdd(edit, n, undo) {
  const o = prepared.get(edit); if (!o) { console.warn(`[film-fx] sceneEdits[${n}] add: ${edit.add?.asset || edit.add} not loaded (prepareAdds first)`); return null; }
  const parent = addParent(edit.parent); if (!parent) { console.warn(`[film-fx] sceneEdits[${n}] add: no desk to put ${edit.add?.asset || edit.add} on`); return null; }
  const asset = typeof edit.add === 'string' ? edit.add : edit.add.asset;
  parent.updateWorldMatrix(true, false); const k = parent.getWorldScale(new THREE.Vector3()).x || 1, base = 1000 * mmScale() / k;
  o.name = `Added prop:${asset}#${edit.id}`; o.userData.directorAdd = { asset, id: edit.id, label: edit.label || asset, parent: Object.hasOwn(DESK_SURFACES, edit.parent) ? edit.parent : 'room' };
  const p = edit.position || [0, 0, 0], r = edit.rotation || [0, 0, 0], s = edit.scale || [1, 1, 1], d = THREE.MathUtils.degToRad;
  o.position.set(p[0] / k, p[1] / k, p[2] / k); o.rotation.set(d(r[0]), d(r[1]), d(r[2])); o.scale.set(base * s[0], base * s[1], base * s[2]);
  parent.add(o); o.updateMatrixWorld(true);
  (o.userData.__filmFxEdits ||= []).push(edit); edit.__count = 1;
  undo.push(() => { o.removeFromParent(); delete o.userData.__filmFxEdits; prepared.delete(edit); });
  return o;
}
const PHYSICAL = new Set(['clearcoat', 'clearcoatRoughness', 'sheen', 'transmission', 'iridescence']);
export function installEdits(shot) {
  const undo = [], live = [], swapped = new Map();
  const wrap = (m, field, factor) => {
    // Instance accessor: everything that writes m[field] is multiplied by factor().
    const own = Object.getOwnPropertyDescriptor(m, field); let raw = m[field];
    Object.defineProperty(m, field, { configurable: true, enumerable: true, get: () => raw * factor(), set: v => { raw = v; } });
    undo.push(() => { delete m[field]; if (own) Object.defineProperty(m, field, own); m[field] = raw; });
  };
  const timed = [];
  for (const [n, edit] of (shot.sceneEdits || []).entries()) {
    if (!forThisDesk(edit, shot)) continue;
    if (edit?.add) { const o = installAdd(edit, n, undo); if (o && edit.show) timed.push([edit, [o]]); continue; }
    if (edit?.match === '@window' && vistaEdit(edit, undo)) continue;
    const found = targets(edit);
    if (!found.length) { console.warn(`[film-fx] sceneEdits[${n}] matched nothing: ${edit.match}`); continue; }
    edit.__count = found.length; if (edit.show) timed.push([edit, found]);
    for (const o of found) {
      // Which edits act on each object (the Director reads its own director:true entry and the film's moves here).
      (o.userData.__filmFxEdits ||= []).push(edit); undo.push(() => { const a = o.userData.__filmFxEdits, i = a ? a.lastIndexOf(edit) : -1; if (i >= 0) a.splice(i, 1); if (a && !a.length) delete o.userData.__filmFxEdits; });
      // Sticky hide: the app's own per-frame sync (desk dressing, day kits) sets visible back, so hold it false.
      // hide:false (a later edit, e.g. the Director's) shows it again: the raw value under an earlier sticky hide.
      if (typeof edit.hide === 'boolean' && (edit.hide || o.userData.__filmFxRawVisible)) {
        const own = Object.getOwnPropertyDescriptor(o, 'visible'), prior = o.userData.__filmFxRawVisible, hidden = edit.hide;
        let raw = prior ? prior() : o.visible;
        Object.defineProperty(o, 'visible', { configurable: true, enumerable: true, get: () => hidden ? false : raw, set: v => { raw = v; own?.set?.call(o, v); } });
        o.userData.__filmFxRawVisible = () => raw;
        undo.push(() => { delete o.visible; if (own?.get || own?.set) Object.defineProperty(o, 'visible', own); else o.visible = raw; if (prior) o.userData.__filmFxRawVisible = prior; else delete o.userData.__filmFxRawVisible; });
      }
      if (edit.position && edit.space === 'local') { const p = o.position.clone(), s = o.parent ? (o.parent.updateWorldMatrix(true, false), o.parent.getWorldScale(new THREE.Vector3())) : new THREE.Vector3(1, 1, 1); o.position.add(new THREE.Vector3(...edit.position).divide(s)); undo.push(() => o.position.copy(p)); }
      else if (edit.position) { const p = o.position.clone(), w = o.getWorldPosition(new THREE.Vector3()), to = w.clone().add(new THREE.Vector3(...edit.position)); if (o.parent) { o.parent.worldToLocal(w); o.parent.worldToLocal(to); } o.position.add(to.sub(w)); undo.push(() => o.position.copy(p)); }
      if (edit.rotation) { const r = o.rotation.clone(); o.rotation.x += THREE.MathUtils.degToRad(edit.rotation[0] || 0); o.rotation.y += THREE.MathUtils.degToRad(edit.rotation[1] || 0); o.rotation.z += THREE.MathUtils.degToRad(edit.rotation[2] || 0); undo.push(() => o.rotation.copy(r)); }
      if (o.isLight && edit.intensity !== undefined) {
        // Multiplier on whatever the room/app writes (mode switches, time of day).
        const cell = { value: sample(edit.intensity, 0) }; wrap(o, 'intensity', () => cell.value);
        if (keyed(edit.intensity)) live.push(s => { cell.value = sample(edit.intensity, s); });
      }
      if (o.isLight && edit.color) { const c = o.color.clone(); o.color.set(edit.color); undo.push(() => o.color.copy(c)); }
      if (o.isLight && edit.recolor) for (const k of ['color', 'groundColor']) if (o[k]?.isColor) recolorColor(o[k], recolorFn(edit.recolor), undo);
      if (Number.isFinite(edit.scale)) { const s = o.scale.clone(); o.scale.multiplyScalar(edit.scale); undo.push(() => o.scale.copy(s)); }
      else if (Array.isArray(edit.scale) && edit.scale.length === 3 && edit.scale.every(Number.isFinite)) { const s = o.scale.clone(); o.scale.multiply(new THREE.Vector3(...edit.scale)); undo.push(() => o.scale.copy(s)); }
      if (edit.dropFaces) {
        // Cut triangles out of a supplied model: those whose three corners lie in the box {min,max}, in the mesh's
        // node space (its own glTF transform applied, so quantized models measure in the file's metres).
        const lo = new THREE.Vector3(...edit.dropFaces.min), hi = new THREE.Vector3(...edit.dropFaces.max), box = new THREE.Box3(lo, hi), v = new THREE.Vector3();
        o.traverse(mesh => {
          if (!mesh.isMesh || mesh.userData.filmFx || !mesh.geometry?.attributes.position) return;
          const g = mesh.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, kept = [];
          mesh.updateMatrix(); const inside = i => box.containsPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix));
          for (let t = 0; t < n; t += 3) { const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2; if (!(inside(a) && inside(b) && inside(c))) kept.push(a, b, c); }
          if (kept.length === n) return;
          const cut = g.clone(); cut.setIndex(kept); mesh.geometry = cut; edit.__dropped = (edit.__dropped || 0) + (n - kept.length) / 3;
          undo.push(() => { mesh.geometry = g; cut.dispose(); });
        });
      }
      const mat = { ...(edit.material || {}) }; if (edit.opacity !== undefined) mat.opacityScale = edit.opacity;
      if (!Object.keys(mat).length && !edit.radialFade && !edit.recolor) continue;
      const rc = edit.recolor && !o.isLight ? recolorFn(edit.recolor) : null;
      const mok = materialFilter(edit);
      o.traverse(mesh => {
        if (!mesh.material || mesh.userData.filmFx) return;
        const list = [].concat(mesh.material), next = list.map(m => {
          if (!m || (mok && !mok(m))) return m;
          const needPhysical = Object.keys(mat).some(k => PHYSICAL.has(k)) && !m.isMeshPhysicalMaterial && m.isMeshStandardMaterial;
          if (!(needPhysical || edit.clone)) return m;
          if (!swapped.has(m)) {
            let c; if (needPhysical) { c = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(c, m); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; } else c = m.clone();
            c.userData = { ...m.userData, filmFxCopy: true }; swapped.set(m, c);
          }
          return swapped.get(m);
        });
        if (next.some((m, i) => m !== list[i])) { const orig = mesh.material; mesh.material = Array.isArray(orig) ? next : next[0]; undo.push(() => { mesh.material = orig; }); }
        // An opaque surface made fadeable joins the transparent pass; keep it
        // drawn first there, as in the opaque pass (otherwise e.g. the shadow-
        // catcher floor 2 mm above the grid can win the depth sort and hide it).
        if (rc && mesh.isInstancedMesh && mesh.instanceColor && !mesh.userData.__filmFxRecolor?.has(n) && next.some(m => m && (!mok || mok(m)))) {
          (mesh.userData.__filmFxRecolor ||= new Set()).add(n); undo.push(() => mesh.userData.__filmFxRecolor?.delete(n));
          const a = mesh.instanceColor, before = a.array.slice(), c = new THREE.Color();
          for (let i = 0; i < a.count; i++) { c.fromBufferAttribute(a, i); recolorColor(c, rc); a.setXYZ(i, c.r, c.g, c.b); }
          a.needsUpdate = true; undo.push(() => { a.array.set(before); a.needsUpdate = true; });
        }
        if (('opacityScale' in mat || 'opacity' in mat || edit.radialFade) && next.some(m => m && !m.transparent)) { const ro = mesh.renderOrder; mesh.renderOrder = Math.min(ro, -1); undo.push(() => { mesh.renderOrder = ro; }); }
        for (const m of next) {
          if (!m || (mok && !mok(m) && !m.userData.filmFxCopy) || m.userData.__filmFxEdited?.has(n)) continue;
          (m.userData.__filmFxEdited ||= new Set()).add(n); undo.push(() => m.userData.__filmFxEdited?.delete(n));
          if (rc) { recolorColor(m.color, rc, undo); if (m.emissive?.isColor && m.emissive.getHex() !== 0) recolorColor(m.emissive, rc, undo); for (const k of ['map', 'emissiveMap']) recolorMap(m[k], rc, undo, n); }
          for (const [k, v] of Object.entries(mat)) {
            if (k === 'brightness') { if (m.isMeshBasicMaterial) { const c = m.color.clone(); m.color.multiplyScalar(Number(v)); undo.push(() => m.color.copy(c)); } else { const cell = { value: Number(v) }; wrap(m, 'emissiveIntensity', () => cell.value); } continue; }
            if (k === 'colorScale') { if (m.color) { const c = m.color.clone(); m.color.multiplyScalar(Number(v)); undo.push(() => m.color.copy(c)); } continue; }
            if (k === 'mapBlur') { if (m.map) mapBlur(m, Number(v), undo); continue; }
            if (k === 'mapRotation') { const t = m.map; if (t) { const c = t.center.clone(), r = t.rotation; t.center.set(.5, .5); t.rotation = THREE.MathUtils.degToRad(Number(v)); undo.push(() => { t.center.copy(c); t.rotation = r; }); } continue; }
            if (k === 'emissiveScale' || k === 'opacityScale') {
              const field = k === 'emissiveScale' ? 'emissiveIntensity' : 'opacity', cell = { value: sample(v, 0) };
              if (field === 'opacity' && !m.transparent) { m.transparent = true; m.needsUpdate = true; undo.push(() => { m.transparent = false; m.needsUpdate = true; }); }
              wrap(m, field, () => cell.value); if (keyed(v)) live.push(s => { cell.value = sample(v, s); });
              continue;
            }
            if (!(k in m)) continue;
            if (m[k]?.isColor) { const c = m[k].clone(); m[k].set(v); undo.push(() => m[k].copy(c)); continue; }
            const before = m[k]; m[k] = sample(v, 0); undo.push(() => { m[k] = before; });
            if (k === 'opacity' && !m.transparent) { m.transparent = true; m.needsUpdate = true; undo.push(() => { m.transparent = false; m.needsUpdate = true; }); }
            if (k === 'clearcoat' && m.clearcoat > 0) m.needsUpdate = true;
            if (keyed(v)) live.push(s => { m[k] = sample(v, s); });
          }
          if (edit.radialFade) radialFade(m, o, edit.radialFade, undo);
        }
      });
    }
  }
  // Timed edits go on last, over every hide and material edit above.
  for (const [edit, objects] of timed) installShow(edit, objects, shot, undo, live);
  return {
    count: (shot.sceneEdits || []).map(e => e.__count || 0),
    apply(seconds) { lastSeconds = seconds; for (const f of live) f(seconds); },
    restore() { for (const f of undo.reverse()) f(); for (const c of swapped.values()) c.dispose(); }
  };
}
// ---------- recolor (sceneEdits[].recolor) ----------
const lcurve = (v, l) => { if (l === undefined) return v; if (!Array.isArray(l)) return v * l; if (v <= l[0][0]) return l[0][1]; for (let i = 1; i < l.length; i++) if (v <= l[i][0]) { const [a, b] = l[i - 1], [c, d] = l[i]; return b + (d - b) * (v - a) / Math.max(1e-6, c - a); } return l[l.length - 1][1]; };
const hsl2rgb = (h, s, l, o) => { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; o[0] = f(h + 1 / 3); o[1] = f(h); o[2] = f(h - 1 / 3); };
// sRGB 0…1 in, out[] written; false when no rule applies.
function recolorFn(spec) {
  const rules = Array.isArray(spec) ? spec : spec.rules || [];
  return (r, g, b, out) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), C = max - min, L = (max + min) / 2;
    let H = 0; if (C > 1e-6) H = 60 * (max === r ? ((g - b) / C + 6) % 6 : max === g ? (b - r) / C + 2 : (r - g) / C + 4);
    for (const u of rules) {
      if (C < (u.minChroma ?? 0) || C > (u.maxChroma ?? 1)) continue;
      if (u.hue) { const [a, z] = u.hue; if (a <= z ? (H < a || H > z) : (H < a && H > z)) continue; }
      const den = 1 - Math.abs(2 * L - 1), S = den < 1e-6 ? 0 : Math.min(1, C / den);
      hsl2rgb((u.h ?? H) / 360, Math.min(1, u.s ?? S * (u.sScale ?? 1)), Math.min(1, Math.max(0, lcurve(L, u.l))), out); return true;
    }
    return false;
  };
}
function recolorColor(col, rc, undo) {
  if (!col?.isColor) return;
  const s = col.getRGB({}, THREE.SRGBColorSpace), o = [0, 0, 0];
  if (!rc(s.r, s.g, s.b, o)) return; const before = col.clone(); col.setRGB(o[0], o[1], o[2], THREE.SRGBColorSpace); undo?.push(() => col.copy(before));
}
const recolored = new WeakMap();   // source image → { [edit index]: recoloured copy }
function recolorMap(t, rc, undo, n) {
  const img = t?.image; if (!img || !(img instanceof HTMLCanvasElement || img instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) return;
  if (img.__filmFxRecolorOf !== undefined) return;   // already a recoloured copy
  const per = recolored.get(img) || {}; recolored.set(img, per);
  if (!per[n]) {
    const w = img.width, h = img.height; if (!w || !h) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h), p = d.data, o = [0, 0, 0], cache = new Map();
    for (let i = 0; i < p.length; i += 4) {
      const key = p[i] << 16 | p[i + 1] << 8 | p[i + 2]; let v = cache.get(key);
      if (v === undefined) { v = rc(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255, o) ? (Math.round(o[0] * 255) << 16 | Math.round(o[1] * 255) << 8 | Math.round(o[2] * 255)) : key; cache.set(key, v); }
      p[i] = v >> 16 & 255; p[i + 1] = v >> 8 & 255; p[i + 2] = v & 255;
    }
    g.putImageData(d, 0, 0); c.__filmFxRecolorOf = n; per[n] = c;
  }
  t.image = per[n]; t.needsUpdate = true; undo.push(() => { t.image = img; t.needsUpdate = true; });
}
// Out-of-focus backdrop: sample the colour map at a fixed mip LOD (≈ 2^lod texels).
function mapBlur(m, lod, undo) {
  const t = m.map, prior = m.onBeforeCompile, key = m.customProgramCacheKey, filt = t.minFilter, gen = t.generateMipmaps;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  m.onBeforeCompile = (shader, renderer) => {
    prior?.call(m, shader, renderer); shader.uniforms.fxMapLod = { value: lod };
    shader.fragmentShader = 'uniform float fxMapLod;\n' + shader.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = textureLod( map, vMapUv, fxMapLod );\n diffuseColor *= sampledDiffuseColor;\n#endif');
  };
  m.customProgramCacheKey = () => (key?.call(m) || '') + '|fx-blur-' + lod; m.needsUpdate = true;
  undo.push(() => { m.onBeforeCompile = prior; m.customProgramCacheKey = key; m.needsUpdate = true; t.minFilter = filt; t.generateMipmaps = gen; t.needsUpdate = true; });
}
function radialFade(m, origin, [r0, r1], undo) {
  const centre = origin.getWorldPosition(new THREE.Vector3()), prior = m.onBeforeCompile, key = m.customProgramCacheKey;
  if (!m.transparent) { m.transparent = true; undo.push(() => { m.transparent = false; }); }
  m.onBeforeCompile = (shader, renderer) => {
    prior?.call(m, shader, renderer);
    shader.uniforms.fxFadeCentre = { value: new THREE.Vector2(centre.x, centre.z) }; shader.uniforms.fxFade = { value: new THREE.Vector2(r0, r1) };
    shader.vertexShader = 'varying vec3 fxWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n fxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 fxWorld; uniform vec2 fxFadeCentre; uniform vec2 fxFade;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= 1.0 - smoothstep(fxFade.x, fxFade.y, length(fxWorld.xz - fxFadeCentre));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => (key?.call(m) || '') + `|fx-radial-${r0}-${r1}`; m.needsUpdate = true;
  undo.push(() => { m.onBeforeCompile = prior; m.customProgramCacheKey = key; m.needsUpdate = true; });
}

// ---------- extra lights ----------
const K5600 = '#fff0e0', K7000 = '#eef1ff';
function productRig(o = {}) {
  const s = Number(o.scale ?? 1);
  return [
    { type: 'rect', name: 'key', at: { az: 45, el: 35, dist: 3.2 }, width: 2, height: 1, color: K5600, intensity: 40 * s, ...o.key },
    { type: 'spot', name: 'rimLeft', at: { az: 135, el: 28, dist: 3.6 }, angle: 22, penumbra: .55, color: K7000, intensity: 200 * s, ...o.rimLeft },
    { type: 'spot', name: 'rimRight', at: { az: -135, el: 28, dist: 3.6 }, angle: 22, penumbra: .55, color: K7000, intensity: 200 * s, ...o.rimRight },
    { type: 'pool', name: 'pool', radius: 1.5, strength: .3 * s, color: '#c9d6e6', ...o.pool },
    { type: 'contact', name: 'contact', opacity: .7, ...o.contact }
  ].filter(l => o[l.name] !== false);
}
function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, col] of stops) grad.addColorStop(at, col); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function installLights(shot) {
  const specs = [].concat(shot.lights || []).flatMap(l => l.preset === 'productRig' ? productRig(l) : [l]);
  if (!specs.length) return null;
  const scene = sceneRoot(), desk = api.loadedModel, group = new THREE.Group(); group.name = 'Film lights'; group.userData.filmFx = true; scene.add(group);
  desk.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(desk), centre = box.getCenter(new THREE.Vector3()), floorY = box.min.y;
  // Desk front: from the main monitor glass toward the user (monitors face the seat).
  const front = new THREE.Vector3(1, 0, 0); { const scr = []; desk.traverse(o => { if (o.name === 'monitor-screen') scr.push(o); }); if (!scr.length) scene.traverse(o => { if (o.name === 'monitor-screen' && /Accessory mount/.test(o.parent?.parent?.parent?.name || '') ) scr.push(o); }); if (scr[0]) { const n = new THREE.Vector3(0, 0, 1).transformDirection(scr[0].matrixWorld); n.y = 0; if (n.lengthSq() > .01) front.copy(n.normalize()); } }
  const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), front).normalize();
  const place = (l, fallbackY = centre.y) => {
    if (l.position) return new THREE.Vector3(...l.position);
    const { az = 0, el = 30, dist = 3 } = l.at || {}, a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    return centre.clone().addScaledVector(front, Math.cos(a) * Math.cos(e) * dist).addScaledVector(left, Math.sin(a) * Math.cos(e) * dist).add(new THREE.Vector3(0, Math.sin(e) * dist, 0));
  };
  const aim = l => l.target ? new THREE.Vector3(...l.target) : centre.clone();
  const followers = [], keyedLights = [];
  for (const l of specs) {
    let light = null;
    // intensity (lights) and strength/opacity (pool/contact) may be keyframed: [[chapterSeconds, value], …].
    const k0 = v => sample(v, 0);
    if (l.type === 'rect') { RectAreaLightUniformsLib.init(); light = new THREE.RectAreaLight(l.color || '#ffffff', k0(l.intensity ?? 5), l.width ?? 2, l.height ?? 1); light.position.copy(place(l)); light.lookAt(aim(l)); }
    else if (l.type === 'spot') { light = new THREE.SpotLight(l.color || '#ffffff', k0(l.intensity ?? 20), l.distance ?? 0, THREE.MathUtils.degToRad(l.angle ?? 25), l.penumbra ?? .5, l.decay ?? 2); light.position.copy(place(l)); light.target.position.copy(aim(l)); group.add(light.target); }
    else if (l.type === 'point') { light = new THREE.PointLight(l.color || '#ffffff', k0(l.intensity ?? 5), l.distance ?? 0, l.decay ?? 2); light.position.copy(place(l)); }
    else if (l.type === 'directional') { light = new THREE.DirectionalLight(l.color || '#ffffff', k0(l.intensity ?? 1)); light.position.copy(place(l)); light.target.position.copy(aim(l)); group.add(light.target); }
    else if (l.type === 'pool' || l.type === 'contact') {
      // Floor decals that follow the desk across the void: a soft light pool
      // (additive) and a contact shadow (multiply-like darkening) under it.
      const pool = l.type === 'pool', r = pool ? (l.radius ?? 1.5) : (l.radius ?? Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * .62);
      const c = new THREE.Color(l.color || '#ffffff'), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
      const map = pool ? radial([[0, `rgba(${rgb},1)`], [.45, `rgba(${rgb},.55)`], [1, `rgba(${rgb},0)`]]) : radial([[0, 'rgba(0,0,0,1)'], [.55, 'rgba(0,0,0,.75)'], [1, 'rgba(0,0,0,0)']]);
      const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, opacity: k0(pool ? (l.strength ?? .16) : (l.opacity ?? .7)), blending: pool ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: pool ? -2 : -4 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat); m.rotation.x = -Math.PI / 2; m.position.set(centre.x, floorY + (pool ? .002 : .003), centre.z); m.renderOrder = pool ? 1 : 2; m.name = 'Film ' + l.type; m.userData.filmFx = true;
      if (l.aspect) m.scale.set(l.aspect, 1, 1);
      const ko = pool ? l.strength : l.opacity; if (keyed(ko)) keyedLights.push(t => { mat.opacity = sample(ko, t); });
      group.add(m); followers.push(m); continue;
    }
    if (!light) { console.warn('[film-fx] unknown light type', l.type); continue; }
    if (keyed(l.intensity)) { const lt = light, ki = l.intensity; keyedLights.push(t => { lt.intensity = sample(ki, t); }); }
    light.name = 'Film light · ' + (l.name || l.type); light.castShadow = !!l.castShadow; light.userData.filmFx = true; group.add(light);
  }
  return {
    count: group.children.length,
    apply(seconds = 0) {
      for (const f of keyedLights) f(seconds);
      if (!followers.length) return;
      // Follow the desk base across the void (ch 1 glide), not its lift.
      const b = new THREE.Box3().setFromObject(desk), c = b.getCenter(new THREE.Vector3());
      for (const m of followers) { m.position.x = c.x; m.position.z = c.z; }
    },
    restore() { group.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); o.dispose?.(); }); group.removeFromParent(); }
  };
}
