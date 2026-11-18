// Held things (a person model's own: the Robo-Pal in Andre's hands, a phone, a mug; tools/people/held.py, materials
// 'Held.<name>') moved, turned and resized on their own, while they still follow the hand (17 Nov 2026, Vico: "build the
// held robot offset feature").
//
// Stored per posture model, beside its pose: cast[i].postures[modelId].held = { '<bone>': { at, turn, scale } }
//   bone   the bone the thing is held by in the model ('hand_r', 'hand_l'; a worn badge follows its own bone)
//   at     [x, y, z] metres in the model's own frame at rest: x his left (+) / right (-), y up, z forward (away from him)
//   turn   [x, y, z] degrees about the thing's own base (x tips it toward / away from him, y turns it, z leans it)
//   scale  size factor (1 as built)
// The thing is skinned to its bone in the model. With an offset it is skinned to a bone of its own instead, a child of
// that bone placed by the offset, so it keeps following the hand (pose keys, the live motion) and moves with the offset.
// A model with no `held` is left exactly as it was.
import * as THREE from 'three';
import {isIdentity,partsOf,boneOf} from './people-held-data.mjs';
export {archivedHeld,isIdentity,heldItems} from './people-held-data.mjs';

const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4();
// Puts each held thing where `held` says (null / {}: as built). Needs the skeleton (room-people.mjs rig()); cheap when
// nothing changed.
export function applyHeld(object, held) {
    const sig = held && Object.keys(held).length ? JSON.stringify(held) : '';
    if ((object.userData.heldSig || '') === sig) return false;
    object.userData.heldSig = sig;
    const parts = partsOf(object); if (!parts.length) return false;
    const groups = new Map(); for (const m of parts) { const b = boneOf(m); if (b) { if (!groups.has(b)) groups.set(b, []); groups.get(b).push(m); } }
    for (const [bone, meshes] of groups) {
        const h = held?.[bone];
        if (isIdentity(h)) { for (const m of meshes) if (m.userData.heldOriginal) { m.bind(m.userData.heldOriginal, m.bindMatrix); delete m.userData.heldOriginal; } continue; }
        const sk = meshes[0].userData.heldOriginal || meshes[0].skeleton, j = sk.bones.findIndex(b => b.name === bone); if (j < 0) continue;
        const hand = sk.bones[j], inv = sk.boneInverses[j];
        // the thing's own bone, under the hand
        let own = hand.children.find(c => c.userData.heldOf === bone);
        if (!own) { own = new THREE.Bone(); own.name = 'held_' + bone; own.userData.heldOf = bone; own.matrixAutoUpdate = true; hand.add(own); }
        // its base (the bottom of its middle) in the bind frame: the offset turns and scales the thing about it
        if (!own.userData.heldBase) {
            const box = new THREE.Box3(), b = new THREE.Box3();
            for (const m of meshes) { m.geometry.boundingBox || m.geometry.computeBoundingBox(); box.union(b.copy(m.geometry.boundingBox).applyMatrix4(m.bindMatrix)); }
            const c = box.getCenter(new THREE.Vector3()); c.y = box.min.y; own.userData.heldBase = c;
        }
        const c = own.userData.heldBase, at = h.at || [0, 0, 0], turn = h.turn || [0, 0, 0], s = h.scale ?? 1;
        // the offset in the bind frame: about the base, then moved; seen from the hand's own frame at rest
        const offset = new THREE.Matrix4().makeTranslation(c.x + at[0], c.y + at[1], c.z + at[2])
            .multiply(m4.makeRotationFromQuaternion(q.setFromEuler(e.set(...turn.map(THREE.MathUtils.degToRad), 'YXZ'))))
            .multiply(m5.makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
        const local = inv.clone().multiply(offset).multiply(inv.clone().invert());
        local.decompose(own.position, own.quaternion, own.scale); own.updateMatrix();
        for (const m of meshes) {
            if (!m.userData.heldOriginal) {
                const orig = m.skeleton, bones = orig.bones.slice(); bones[j] = own;
                m.userData.heldOriginal = orig; m.bind(new THREE.Skeleton(bones, orig.boneInverses), m.bindMatrix);
            }
        }
    }
    return true;
}
