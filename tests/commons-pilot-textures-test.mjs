// The Commons pilot sign and carpet (library-humboldt-commons.mjs, film chapter 4): the Studio refresh look uses the crisp
// 2048-wide webp prints built by tools/rooms/build-commons-textiles.py; the Classic look keeps the old canvas-drawn ones.
// Plain node, no browser or GPU: canvases are stubs, an image load never arrives (the requested file is recorded on the texture).
//   1. the generated assets: sizes (capped at 2048), file weight, tileable fibre normal
//   2. refresh builds with the new textures, Classic with the old canvas textures (and never names the new files)
//   3. disposing the room's tree disposes every one of them, and the shared fibre normal is cloned per user
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = path.join(root, 'assets/rooms/library');

// ---- 1. the assets
const EXPECT = { 'commons-pilot-sign': [2048, 568], 'commons-pilot-sign-bump': [1024, 284], 'commons-pilot-carpet': [2048, 1728], 'commons-pilot-legend': [2048, 320], 'commons-fibre-normal': [256, 256] };
let total = 0;
for (const [name, [w, h]] of Object.entries(EXPECT)) {
  const file = path.join(dir, name + '.webp'), meta = await sharp(file).metadata();
  assert.equal(meta.width, w, name + ' width'); assert.equal(meta.height, h, name + ' height');
  assert(meta.width <= 2048 && meta.height <= 2048, name + ': capped at 2048');
  total += fs.statSync(file).size;
}
assert(total < 600 * 1024, 'the five textures weigh ' + total + ' bytes');
assert.equal((await sharp(path.join(dir, 'commons-pilot-legend.webp')).metadata()).hasAlpha, true, 'the legend inlay carries alpha');
assert(Math.abs(2048 / 568 - 1800 / 500) < .01 && Math.abs(2048 / 1728 - 3200 / 2700) < .01 && 2048 / 320 === 1600 / 250, 'texture aspects match the 1800x500 sign, 3200x2700 bay and 1600x250 legend');
{ // the fibre normal map tiles: its opposite edges are as close as neighbouring columns
  const { data, info } = await sharp(path.join(dir, 'commons-fibre-normal.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, C = info.channels;
  const at = (x, y) => (y * W + x) * C, d = (a, b) => { let s = 0; for (let c = 0; c < 3; c++) s += Math.abs(data[a + c] - data[b + c]); return s; };
  let seam = 0, inner = 0; for (let y = 0; y < W; y++) { seam += d(at(0, y), at(W - 1, y)); for (let x = 0; x < W - 1; x++) inner += d(at(x, y), at(x + 1, y)) / (W - 1); }
  assert(seam < inner * 1.5, 'fibre normal map wraps seamlessly');
}

// ---- 2. both looks build
const context = () => new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: s.length * 7 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) }, { get: (o, k) => k in o ? o[k] : () => {} });
const element = () => ({ width: 512, height: 512, style: {}, getContext: context, addEventListener() {}, removeEventListener() {}, setAttribute() {} });
globalThis.document = { createElement: element, createElementNS: element };
globalThis.fetch = async () => { throw Error('no network in this test'); };
globalThis.Image = class { addEventListener() {} set src(v) {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });
const mesh = (p, g, m, at = [0, 0, 0]) => { const o = new THREE.Mesh(g, m); o.position.set(...at); p.add(o); return o; };
const box = (p, size, at, m) => mesh(p, new THREE.BoxGeometry(...size), m, at);
const sphere = (p, size, at, m) => { const o = mesh(p, new THREE.SphereGeometry(1, 16, 12), m, at); o.scale.set(...size); return o; };
const rod = (p, a, b, r, m) => { const s = new THREE.Vector3(...a), e = new THREE.Vector3(...b), d = e.clone().sub(s), o = mesh(p, new THREE.CylinderGeometry(r, r, d.length(), 12), m); o.position.copy(s).add(e).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; };
const loadTexture = THREE.TextureLoader.prototype.load;   // an image load never arrives here, so remember which file each texture asked for
THREE.TextureLoader.prototype.load = function (url, ...rest) { const t = loadTexture.call(this, url, ...rest); t.userData.srcUrl = String(url); return t; };
const helpers = { material, mesh, box, sphere, rod, markSceneAsset: (o, { key } = {}) => { o.userData.sceneAssetKey = key; } };
const { LIBRARY_LAYOUTS, buildLibraryRoom } = await import('../library-room.mjs');
const { disposeWorkspaceObject } = await import('../workspace-3d.mjs');
const layout = LIBRARY_LAYOUTS.humboldt;
const build = look => {
  const r = new THREE.Group(); r.scale.setScalar(.001);
  const room = { id: 'library', look, root: r, roomLayout: layout, walls: [], propSupports: [], missingProps: [], windowViewReady: Promise.resolve(), token: 0 };
  buildLibraryRoom(room, r, layout, helpers); return { room, r };
};
const parts = r => {
  let bay, legend, sign; const groups = {};
  r.traverse(o => { if (o.userData?.propId) groups[o.userData.propId] = o; });
  groups['humboldt-pilot-bay'].traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.width === 3200) bay = o; if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width === 1600) legend = o; });
  groups['humboldt-pilot-header'].traverse(o => { if (o.isMesh && o.geometry.type === 'PlaneGeometry') sign = o; });
  return { bay, legend, sign };
};
const src = t => t?.userData?.srcUrl || '';

const refresh = build(null), classic = build('classic'), R = parts(refresh.r), C = parts(classic.r);
for (const [what, o] of Object.entries(R)) assert(o, 'refresh has the ' + what);
assert(src(R.sign.material.map).endsWith('/commons-pilot-sign.webp') && src(R.sign.material.bumpMap).endsWith('/commons-pilot-sign-bump.webp'), 'refresh sign: the 2048 print and its height map');
assert(src(R.bay.material.map).endsWith('/commons-pilot-carpet.webp') && src(R.bay.material.normalMap).endsWith('/commons-fibre-normal.webp'), 'refresh bay: the carpet and the fibre normal map');
assert(src(R.legend.material.map).endsWith('/commons-pilot-legend.webp') && R.legend.material.transparent && !R.legend.material.depthWrite, 'refresh legend: the alpha inlay');
for (const o of [R.sign, R.bay, R.legend]) assert(!o.material.map.isCanvasTexture, 'refresh: no canvas texture on the sign / carpet / legend');
assert.equal(R.bay.material.normalMap.colorSpace, THREE.NoColorSpace); assert.equal(R.bay.material.map.colorSpace, THREE.SRGBColorSpace);
assert.notEqual(R.bay.material.normalMap, R.legend.material.normalMap, 'each user clones the shared fibre normal map (its own repeat)');
assert.deepEqual(R.bay.material.normalMap.repeat.toArray(), [3200 / 60, 2700 / 60]);
// the geometry is as it was
assert.deepEqual([R.bay.geometry.parameters.width, R.bay.geometry.parameters.height, R.bay.geometry.parameters.depth], [3200, 2, 2700]);
assert.deepEqual([R.sign.geometry.parameters.width, R.sign.geometry.parameters.height], [1800, 500]);
assert.deepEqual([R.legend.geometry.parameters.width, R.legend.geometry.parameters.height], [1600, 250]);
// Classic: the old canvas textures, a plain green bay and the old 1024-wide prints; it never names the new files
assert(C.sign.material.map.isCanvasTexture && C.sign.material.map.image.width === 1024 && C.sign.material.map.image.height === 512, 'Classic sign: the old 1024x512 canvas');
assert(C.legend.material.map.isCanvasTexture && C.legend.material.map.image.width === 1024 && !C.legend.material.transparent, 'Classic legend: the old 1024x160 canvas');
assert(!C.bay.material.map && !C.bay.material.normalMap && C.bay.material.color.getHexString() === '154c3d', 'Classic bay: the plain green with the old plank bump');
classic.r.traverse(o => { for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v?.isTexture) assert(!/commons-(pilot|fibre)/.test(src(v)), 'Classic uses a new commons texture'); });
const classicSrc = fs.readFileSync(path.join(root, 'library-humboldt-commons-classic.mjs'), 'utf8');
assert(!/commons-(pilot|fibre)/.test(classicSrc) && classicSrc.includes("fillText('FLEXIBLE STUDY'"), 'the frozen Classic module is the old code path');
assert.match(fs.readFileSync(path.join(root, 'library-room.mjs'), 'utf8'), /room\.look === 'classic' \? buildHumboldtCommonsClassic : buildHumboldtCommons/);
assert(!/fillText\('FLEXIBLE STUDY'/.test(fs.readFileSync(path.join(root, 'library-humboldt-commons.mjs'), 'utf8')), 'the default look no longer draws the old sign');

// ---- 3. dispose
{
  const mats = [R.sign.material, R.bay.material, R.legend.material], textures = new Set();
  for (const m of mats) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
  const base = refresh.r.ownedTextures.filter(t => src(t).endsWith('commons-fibre-normal.webp')); assert.equal(base.length, 1, 'the shared fibre base is owned by the room root');
  base.forEach(t => textures.add(t));
  assert(textures.size >= 7, 'sign map+bump, carpet map+normal, legend map+normal, fibre base');
  const disposed = new Set(); for (const t of textures) t.addEventListener('dispose', () => disposed.add(t));
  disposeWorkspaceObject(refresh.r);
  for (const t of textures) assert(disposed.has(t), 'disposed: ' + (src(t) || t.uuid));
}
console.log('commons-pilot-textures-test: ok (assets ' + total + ' bytes, refresh = new prints, Classic = old canvas path, dispose)');
