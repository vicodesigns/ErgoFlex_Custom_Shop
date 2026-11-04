import assert from 'node:assert/strict';
import * as THREE from 'three';
import { detailKit, detailFinish, books, notebook } from '../institutional-detail.mjs';

const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .68 });
base.name = 'Institutional furnishing';
const root = new THREE.Group(), kit = detailKit();
const finishes = ['paper', 'fabric', 'rubber', 'ceramic', 'metal', 'glass', 'liquid'];
finishes.forEach((finish, n) => kit.box([20, 20, 20], [n * 30, 10, 0], '#ffffff', undefined, finish));
const mesh = kit.build(root, base);
assert.equal(mesh.material.length, finishes.length);
assert.equal(mesh.geometry.groups.length, finishes.length);
assert.equal(mesh.geometry.attributes.position.count, finishes.length * 36);
mesh.geometry.computeBoundingBox();
assert(Math.abs(mesh.geometry.boundingBox.min.y) < .0001, 'Finish changes preserve support contact');
assert.equal(base.roughness, .68, 'Authored base material is not mutated');
for (const material of mesh.material) {
    assert(material.userData.roomFinishLocked, 'Room finish pass preserves the authored finish');
    if (material.bumpMap) {
        assert.equal(material.bumpMap.colorSpace, THREE.NoColorSpace);
        assert.equal(material.bumpMap, material.roughnessMap);
        const variation = new Set(Array.from(material.roughnessMap.image.data).filter((_, n) => n % 4 === 1));
        assert(variation.size > 10, 'Surface highlights include measured variation');
    }
    if (material.userData.detailFinish === 'glass') {
        assert.equal(material.metalness, 0, 'Glass is dielectric');
        assert(material.transparent);
    }
}
const artwork = new THREE.Texture(), printed = new THREE.MeshStandardMaterial({ map: artwork });
assert.equal(detailFinish(printed, 'paper').map, artwork, 'Printed artwork keeps its original map');
const stationery = detailKit();
notebook(stationery, 0, 0, 0, '#345346'); books(stationery, 400, 0, 0, 4);
const pages = stationery.build(root, base);
assert.deepEqual(new Set(pages.userData.materialFinishes), new Set(['fabric', 'paper', null]));
pages.geometry.computeBoundingBox();
assert(Math.abs(pages.geometry.boundingBox.min.y) < .0001);
assert.equal(kit.build(root, base), undefined, 'A built kit releases its source parts');
let disposed = 0;
mesh.material[0].bumpMap.addEventListener('dispose', () => disposed++);
base.dispose();
assert.equal(disposed, 1, 'Source disposal releases the derived finish texture');
console.log('Institutional material finishes: grouping, artwork, contact, linear maps and disposal pass.');
