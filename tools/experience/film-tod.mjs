// timeOfDay for render-cut (harness only). Lighting-only interpolation between
// a room's daypart presets, e.g. shot.timeOfDay = [{at:0,mode:'morning'},
// {at:8,mode:'afternoon'},{at:16,mode:'evening',ease:'smooth'}].
//
// The app switches dayparts discretely (setMeasuredRoomMode → applyRoomLighting
// → room.roomAtmosphere …). Every lighting parameter those presets touch is
// continuous: light colours/intensities/positions, renderer exposure, scene
// environment intensity, the architectural bounce radiance, emissive levels and
// opacities, the blind drop (object scale + texture repeat) and canvas-painted
// window views. This snapshots that state once per mode, restores the shot's own
// mode, then blends the snapshots every frame. Geometry, desk dressing and
// activity props stay as prepared (only scale-only object changes blend), so the
// chapter keeps one continuous set while the light moves through the day.
import * as THREE from 'three';

const api = window.ErgoFlex;
const sceneRoot = () => { let s = api.loadedModel; while (s?.parent) s = s.parent; return s; };
// Canvases that carry content rather than light: never cross-dissolve them.
const CONTENT_CANVAS = /touchscreen|pinboard|clock|monitor|screen|display|journal|notebook/i;

function capture() {
  const scene = sceneRoot(), objs = new Map(), lights = new Map(), mats = new Map(), canv = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    objs.set(o, [o.scale.clone(), o.visible, o.position.clone()]);
    if (o.isLight) lights.set(o, { color: o.color.clone(), ground: o.groundColor?.clone(), intensity: o.intensity, position: o.position.clone(), target: o.target?.position.clone() });
    for (const m of [].concat(o.material || [])) if (m && !mats.has(m)) {
      const r = { owner: o.name || o.parent?.name || '' };
      for (const k of ['color', 'emissive']) if (m[k]?.isColor) r[k] = m[k].clone();
      for (const k of ['emissiveIntensity', 'opacity', 'envMapIntensity']) if (typeof m[k] === 'number') r[k] = m[k];
      r.visible = m.visible; if (m.map?.repeat) r.repeat = m.map.repeat.clone();
      if (m.uniforms) { r.uniforms = {}; for (const [k, u] of Object.entries(m.uniforms)) if (typeof u.value === 'number' || u.value?.isColor || u.value?.isVector3) r.uniforms[k] = u.value.clone ? u.value.clone() : u.value; }
      mats.set(m, r);
      for (const t of [m.map, m.emissiveMap]) { const img = t?.image; if (img instanceof HTMLCanvasElement && !canv.has(img) && !CONTENT_CANVAS.test(r.owner + ' ' + m.name)) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); canv.set(img, { copy: c, textures: new Set([t]) }); } else if (canv.has(img)) canv.get(img).textures.add(t); }
    }
  });
  const g = { exposure: api.renderer.toneMappingExposure, env: scene.environmentIntensity, bgI: scene.backgroundIntensity, bounce: {} };
  for (const [k, u] of Object.entries(api.workspaceRoom?.bounce?.uniforms || {})) {
    const v = u.value; g.bounce[k] = typeof v === 'number' ? v : v?.isColor || v?.isVector3 ? v.clone() : Array.isArray(v) && v.every(x => x?.isVector3 || x?.isColor) ? v.map(x => x.clone()) : Array.isArray(v) && v.every(x => typeof x === 'number') ? [...v] : undefined;
  }
  return { objs, lights, mats, canv, g };
}
const same = (a, b) => a === b || (a?.equals && b && a.equals(b)) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i])));
const lerpValue = (a, b, u, out) => {
  if (typeof a === 'number') return a + (b - a) * u;
  if (a?.isColor || a?.isVector3 || a?.isVector2) return out.copy(a).lerp(b, u);
  return u < .5 ? a : b;
};

export async function installTimeOfDay(shot) {
  const keys = [...shot.timeOfDay].sort((a, b) => a.at - b.at), room = shot.room, original = api.measuredRoom?.mode || shot.mode;
  if (!api.measuredRoom?.modes) throw Error('timeOfDay needs a measured room (not the product stage).');
  for (const k of keys) if (!api.measuredRoom.modes[k.mode]) throw Error(`timeOfDay: room "${room}" has no mode "${k.mode}" (has ${Object.keys(api.measuredRoom.modes).join(', ')}).`);
  const before = capture(), states = new Map();
  for (const mode of new Set(keys.map(k => k.mode))) { api.setMeasuredRoomMode(room, mode, false); await new Promise(r => setTimeout(r, 50)); states.set(mode, capture()); }
  // Back to the prepared daypart, then put any geometry the mode switches
  // touched (dressing, activity props, blinds) exactly where it was.
  api.setMeasuredRoomMode(room, original, false); await new Promise(r => setTimeout(r, 50));
  for (const [o, [s, v, p]] of before.objs) { o.scale.copy(s); o.visible = v; o.position.copy(p); }
  for (const [o, l] of before.lights) { o.color.copy(l.color); o.intensity = l.intensity; o.position.copy(l.position); if (l.target) o.target.position.copy(l.target); l.ground && o.groundColor.copy(l.ground); }
  // Anything a mode switch built that the prepared set did not have stays hidden.
  sceneRoot().traverse(o => { if (!before.objs.has(o) && !o.isScene) o.visible = false; });
  for (const [img, c] of before.canv) { const x = img.getContext('2d'); x.clearRect(0, 0, img.width, img.height); x.drawImage(c.copy, 0, 0); for (const t of c.textures) t.needsUpdate = true; }

  // Channels: only properties that differ between at least two keyed modes.
  const S = keys.map(k => states.get(k.mode)), channels = [], base = S[0];
  const add = (read, set, scratch) => { const vals = S.map(read); if (vals.some(v => v === undefined) || vals.every(v => same(v, vals[0]))) return; channels.push({ vals, set, scratch }); };
  for (const [o] of base.lights) {
    const L = s => s.lights.get(o);
    add(s => L(s)?.color, v => o.color.copy(v), new THREE.Color()); add(s => L(s)?.intensity, v => { o.intensity = v; });
    add(s => L(s)?.ground, v => o.groundColor.copy(v), new THREE.Color());
    add(s => L(s)?.position, v => { o.position.copy(v); if (o.castShadow) o.shadow.needsUpdate = true; }, new THREE.Vector3());
    add(s => L(s)?.target, v => { o.target.position.copy(v); o.target.updateMatrixWorld(); }, new THREE.Vector3());
  }
  for (const [m] of base.mats) {
    const R = s => s.mats.get(m);
    for (const k of ['color', 'emissive']) add(s => R(s)?.[k], v => m[k].copy(v), new THREE.Color());
    for (const k of ['emissiveIntensity', 'opacity', 'envMapIntensity']) add(s => R(s)?.[k], v => { m[k] = v; });
    add(s => R(s)?.repeat, v => m.map?.repeat.copy(v), new THREE.Vector2());
    // A material that is invisible in one mode fades via its opacity; it is
    // visible whenever any neighbouring key shows it.
    const vis = S.map(s => R(s)?.visible); if (vis.some(v => v !== vis[0])) channels.push({ vals: vis, set: v => { m.visible = v; }, any: true });
    for (const k of Object.keys(R(base)?.uniforms || {})) add(s => R(s)?.uniforms?.[k], v => { const u = m.uniforms[k]; if (typeof v === 'number') u.value = v; else u.value.copy(v); }, R(base).uniforms[k]?.clone?.());
  }
  // Scale-only object changes (window blinds). Moving or appearing objects are dressing, not light.
  for (const [o] of base.objs) {
    const rows = S.map(s => s.objs.get(o)); if (rows.some(r => !r)) continue;
    if (rows.some(r => r[1] !== rows[0][1] || !r[2].equals(rows[0][2]))) continue;
    add(s => s.objs.get(o)[0], v => o.scale.copy(v), new THREE.Vector3());
  }
  add(s => s.g.exposure, v => { api.renderer.toneMappingExposure = v; }); add(s => s.g.env, v => { sceneRoot().environmentIntensity = v; }); add(s => s.g.bgI, v => { sceneRoot().backgroundIntensity = v; });
  const bounce = api.workspaceRoom?.bounce?.uniforms || {};
  for (const k of Object.keys(base.g.bounce)) {
    const v0 = base.g.bounce[k]; if (v0 === undefined) continue;
    if (Array.isArray(v0)) { const vals = S.map(s => s.g.bounce[k]); if (vals.every(v => same(v, vals[0]))) continue; channels.push({ vals, set: v => { const u = bounce[k].value; v.forEach((x, j) => { if (typeof x === 'number') u[j] = x; else u[j].copy(x); }); }, array: true }); }
    else add(s => s.g.bounce[k], v => { if (typeof v === 'number') bounce[k].value = v; else bounce[k].value.copy(v); }, v0.clone?.());
  }
  const canvases = [];
  for (const [img] of base.canv) { const copies = S.map(s => s.canv.get(img)?.copy); if (copies.some(c => !c)) continue; const d = copies.map(c => c.getContext('2d').getImageData(0, 0, Math.min(64, c.width), Math.min(64, c.height)).data.join()); if (d.every(x => x === d[0])) continue; canvases.push({ img, copies, textures: before.canv.get(img)?.textures || new Set() }); }

  const segment = seconds => {
    if (seconds <= keys[0].at) return [0, 0, 0]; const last = keys.length - 1; if (seconds >= keys[last].at) return [last, last, 0];
    let i = 0; while (keys[i + 1].at < seconds) i++;
    let u = (seconds - keys[i].at) / Math.max(1e-6, keys[i + 1].at - keys[i].at); if ((keys[i + 1].ease || shot.timeOfDayEase) === 'smooth') u = u * u * (3 - 2 * u);
    return [i, i + 1, u];
  };
  return {
    channels: channels.length, canvases: canvases.length,
    // Director: new times / blends for the same daypart sequence, without re-capturing the room.
    retime(next) { const n = [...next].sort((a, b) => a.at - b.at); if (n.length !== keys.length || n.some((k, i) => k.mode !== keys[i].mode)) return false; n.forEach((k, i) => { keys[i] = { ...keys[i], at: k.at, ease: k.ease }; }); return true; },
    apply(seconds) {
      const [a, b, u] = segment(seconds);
      for (const c of channels) {
        if (c.any) { c.set(u === 0 ? c.vals[a] : u === 1 ? c.vals[b] : c.vals[a] || c.vals[b]); continue; }
        if (c.array) { c.set(c.vals[a].map((x, j) => typeof x === 'number' ? x + (c.vals[b][j] - x) * u : x.clone().lerp(c.vals[b][j], u))); continue; }
        c.set(lerpValue(c.vals[a], c.vals[b], u, c.scratch));
      }
      for (const c of canvases) { const x = c.img.getContext('2d'); x.globalAlpha = 1; x.drawImage(c.copies[a], 0, 0); if (u > 0 && b !== a) { x.globalAlpha = u; x.drawImage(c.copies[b], 0, 0); x.globalAlpha = 1; } for (const t of c.textures) t.needsUpdate = true; }
      // Moving sun: redraw shadow maps this frame (bakeDraw only does so when geometry moved).
      api.renderer.shadowMap.needsUpdate = true;
    },
    restore() {
      for (const [o, l] of before.lights) { o.color.copy(l.color); o.intensity = l.intensity; o.position.copy(l.position); if (l.target) o.target.position.copy(l.target); l.ground && o.groundColor.copy(l.ground); }
      for (const [m, r] of before.mats) { for (const k of ['color', 'emissive']) r[k] && m[k].copy(r[k]); for (const k of ['emissiveIntensity', 'opacity', 'envMapIntensity']) if (r[k] !== undefined) m[k] = r[k]; m.visible = r.visible; if (r.repeat && m.map) m.map.repeat.copy(r.repeat); for (const [k, v] of Object.entries(r.uniforms || {})) { const u = m.uniforms[k]; if (typeof v === 'number') u.value = v; else u.value.copy(v); } }
      for (const [o, [s]] of before.objs) o.scale.copy(s);
      api.renderer.toneMappingExposure = before.g.exposure; sceneRoot().environmentIntensity = before.g.env;
      for (const [k, v] of Object.entries(before.g.bounce)) { const u = api.workspaceRoom?.bounce?.uniforms?.[k]; if (!u || v === undefined) continue; if (typeof v === 'number') u.value = v; else if (Array.isArray(v)) v.forEach((x, j) => typeof x === 'number' ? u.value[j] = x : u.value[j].copy(x)); else u.value.copy(v); }
      for (const [img, c] of before.canv) { const x = img.getContext('2d'); x.clearRect(0, 0, img.width, img.height); x.drawImage(c.copy, 0, 0); for (const t of c.textures) t.needsUpdate = true; }
    }
  };
}
