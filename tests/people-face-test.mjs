// Exercise the landmark registration against the actual quantized film meshes.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { faceData, performFace, prepareFace } from '../people-face.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const postures = [
    'yara-walk', 'yara-stand-mid', 'mia-power-type-30', 'ava-stand-mid', 'ava-sit-type',
    'sofia-sit-laptop', 'lin-stand-paint', 'kai-wheel-roll', 'noah-stand-wait', 'maya-stand-type-41', 'maya-sit-type',
    'omar-wheel-watch', 'andre-stand-phone-watch', 'priya-stretch', 'jo-stand-work',
    'zoe-sit-laptop', 'eli-sit-listen', 'nia-sit-write', 'hale-stand-present-left',
];
assert.equal(faceData('people-sam-sit-type'), null);
for (const posture of postures) {
    const id = 'people-' + posture;
    const doc = await io.read(fileURLToPath(new URL('../assets/props/' + id + '.glb', import.meta.url)));
    const root = new Group();
    root.userData.person = { id, key: posture.split('-')[0] + '-desk' };
    for (const p of doc.getRoot().listMeshes()[0].listPrimitives()) {
        const material = new MeshStandardMaterial();
        material.name = p.getMaterial().getName();
        if (!/^Human\.(?:body|eyebrow\d+|eyelashes\d+|low-poly|eyes_cornea)$/.test(material.name)) continue;
        const g = new BufferGeometry();
        for (const [semantic, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv']]) {
            const a = p.getAttribute(semantic);
            if (!a) continue;
            const values = Array.from({ length: a.getCount() }, (_, i) => a.getElement(i, [])).flat();
            g.setAttribute(name, new Float32BufferAttribute(values, a.getElementSize()));
        }
        root.add(new Mesh(g, material));
    }
    prepareFace(root, await faceData(id), id);
    const body = root.children.find(m => m.material.name === 'Human.body');
    for (const mesh of root.children) {
        const g = mesh.geometry, targets = g.morphAttributes.position;
        assert.ok(targets?.length, id + ' missing facial targets on ' + mesh.material.name);
        assert.ok(targets.some(a => a.array.some(v => v !== 0)), id + ' no registered UVs');
        assert.ok(targets.every(a => a.count === g.attributes.position.count && a.array.every(Number.isFinite)));
    }
    const brows = root.children.find(m => m.material.name.startsWith('Human.eyebrow'));
    const lashes = root.children.find(m => m.material.name.startsWith('Human.eyelashes'));
    assert.ok(brows.geometry.morphAttributes.position[2].array.some(v => Math.abs(v) > .001), id + ' brow follows forehead');
    assert.ok(lashes.geometry.morphAttributes.position[1].array.some(v => Math.abs(v) > .002), id + ' lashes follow closing lids');
    const mouth = body.geometry.morphAttributes.position[0];
    const uv = body.geometry.attributes.uv;
    const corner = Array.from({length: uv.count}, (_, i) => i).find(i =>
        Math.round(uv.getX(i) * 4095) * 4096 + Math.round(uv.getY(i) * 4095) === 15247528);
    assert.ok(Number.isInteger(corner) && Math.hypot(mouth.getX(corner), mouth.getY(corner), mouth.getZ(corner)) > .003, id + ' lip corner moves');
    const eyeline = root.children.find(m => m.material.name === 'Human.low-poly');
    const sample = (room, chapter, seconds, time) => {
        performFace(root, room, time, true, true, { id: chapter, seconds });
        return { mouth: body.morphTargetInfluences.slice(), gaze: eyeline.morphTargetInfluences.slice() };
    };
    if (posture === 'andre-stand-phone-watch') {
        assert.ok(body.geometry.morphAttributes.position[3].array.some(v => Math.abs(v) > .001));
        const tap = sample('workshop', 'storage', 24.978, 11.2);
        const watching = sample('workshop', 'storage', 24.978, 13.8);
        assert.ok(tap.mouth[3] > .4 && tap.gaze[1] < -.6);
        assert.ok(watching.mouth[0] > .65 && watching.mouth[3] === 0 && watching.gaze[1] > 0);
        assert.deepEqual(sample('workshop', 'storage', 24.978, 11.2), tap);
    }
    if (posture === 'maya-sit-type') {
        delete root.userData.person.key; // Rise takes the room's built-in desk sitter.
        for (const duration of [18, 28.5]) {
            assert.ok(sample('home', 'rise', duration, 8.3).mouth[0] > .6);
            assert.ok(sample('home', 'rise', duration, duration - 2).mouth[0] > .5);
        }
        assert.ok(sample('home', 'rise', 28.5, 16.8).mouth[1] > .1, 'relaxed eyelids in the longer stretch');
        root.userData.person.station = 'background';
        assert.equal(sample('home', 'rise', 28.5, 8.3).mouth[3], 0);
    }
    if (posture === 'omar-wheel-watch') {
        const detail = sample('music', 'media', 17, 9.85), smile = sample('music', 'media', 17, 12.4);
        assert.ok(detail.mouth[2] > .5 && detail.mouth[0] < .25);
        assert.ok(smile.mouth[0] > .65 && smile.mouth[2] < .2);
        sample('music', 'media', 17, 8.6);
        assert.equal(sample('music', 'another-cut', 17, 8.6).mouth[3], 0, 'switching chapters releases the lips');
    }
    performFace(root, 'library', 6.7, true, true);
    const first = body.morphTargetInfluences.slice();
    if (posture.startsWith('yara')) assert.ok(first[0] > .60 && first[0] < .80);
    performFace(root, 'library', 2.3, true, true);
    performFace(root, 'library', 6.7, true, true);
    assert.deepEqual(body.morphTargetInfluences, first, 'scrubbing to a frame restores the expression');
    const copy = root.clone();
    performFace(copy, 'library', 6.7, true, false);
    assert.ok(copy.children.every(m => m.morphTargetInfluences.every(v => v === 0)), 'life off restores neutral');
    assert.deepEqual(body.morphTargetInfluences, first, 'instances sharing geometry have independent faces');
}
console.log('PASS face registration, animated mouth corners, eyes, brow and lash cards, independent actors and repeatable film time on ' + postures.length + ' postures.');
