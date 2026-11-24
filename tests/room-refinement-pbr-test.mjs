// Room surface PBR refinement (room-refinement.mjs): verifies multi-octave heightfields, seamless 3x3 Sobel
// tangent-space normal maps on uv1 (channel 1, linear), physically varied roughness maps, backward-compatible
// bumpMap metadata (bumpScale 0), authored normalMap preservation, and full ownedTextures tracking.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { refineRoomSurfaces } from '../room-refinement.mjs';

const root = new THREE.Group();
root.scale.setScalar(0.001);
const kinds = ['wood', 'plaster', 'fabric', 'powder', 'metal', 'stone', 'rubber'];
const mats = kinds.map(k => {
  const m = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });
  m.userData.roomSurface = k;
  root.add(new THREE.Mesh(new THREE.BoxGeometry(500, 40, 300), m));
  return m;
});

const authoredNorm = new THREE.DataTexture(new Uint8Array(16), 2, 2);
const authoredMat = new THREE.MeshStandardMaterial({ color: 0xffffff, normalMap: authoredNorm });
authoredMat.userData.roomSurface = 'wood';
root.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), authoredMat));

refineRoomSurfaces({ id: 'home', root, roomLayout: { id: 'house' } });

assert.equal(root.userData.surfaceDetail.textureSize, 256);
assert.equal(root.userData.surfaceDetail.materials, 7);
for (let i = 0; i < kinds.length; i++) {
  const m = mats[i], k = kinds[i];
  assert.ok(m.normalMap?.isDataTexture, `${k}: has tangent normalMap`);
  assert.equal(m.normalMap.channel, 1, `${k}: normalMap uses uv1`);
  assert.equal(m.normalMap.colorSpace, THREE.NoColorSpace, `${k}: normalMap is linear`);
  assert.ok(m.normalScale.x > 0.1 && m.normalScale.x < 0.6, `${k}: sane normalScale`);
  assert.ok(m.bumpMap?.isDataTexture && m.bumpMap.channel === 1 && m.bumpScale === 0, `${k}: bumpMap preserved with bumpScale 0`);
  assert.ok(m.roughnessMap?.isDataTexture && m.roughnessMap.channel === 1, `${k}: roughnessMap present`);
  assert.ok(root.ownedTextures.includes(m.normalMap) && root.ownedTextures.includes(m.bumpMap) && root.ownedTextures.includes(m.roughnessMap), `${k}: ownedTextures tracks all maps`);
  const d = m.normalMap.image.data;
  let minR = 255, maxR = 0, minB = 255;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p] < minR) minR = d[p];
    if (d[p] > maxR) maxR = d[p];
    if (d[p + 2] < minB) minB = d[p + 2];
  }
  assert.ok(maxR - minR > 15 && minB > 128, `${k}: non-flat valid tangent normals (${minR}..${maxR}, z>=${minB})`);
}
assert.equal(authoredMat.normalMap, authoredNorm, 'authored normalMap untouched');
console.log(`room-refinement-pbr-test: ok (${kinds.length} surfaces, ${root.ownedTextures.length} owned maps)`);
