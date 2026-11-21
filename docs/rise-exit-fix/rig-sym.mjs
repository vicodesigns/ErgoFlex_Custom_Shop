// Is Maya's rig mirror-symmetric with identity bind frames? (then a left/right mirror is q -> (x, -y, -z, w) per bone)
import { rig, THREE } from './rise-pull-lib.mjs';
const chain = ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb_01', 'thumb_02', 'thumb_03', 'index_01', 'index_03', 'middle_01', 'pinky_03'];
for (const c of chain) {
    const l = rig.index.get(c + '_l'), r = rig.index.get(c + '_r');
    console.log(c.padEnd(10), 'offL', rig.offset[l].toArray().map(x => x.toFixed(4)).join(','), ' offR', rig.offset[r].toArray().map(x => x.toFixed(4)).join(','), ' parents', rig.names[rig.parents[l]], rig.names[rig.parents[r]]);
}
// the posture's own local quats, left vs mirrored right
const key = rig.key('people-maya-sit-type');
for (const c of ['clavicle', 'upperarm', 'lowerarm', 'hand', 'index_01']) {
    const l = key.q[rig.index.get(c + '_l')], r = key.q[rig.index.get(c + '_r')], m = new THREE.Quaternion(r.x, -r.y, -r.z, r.w);
    console.log(c, 'posture L', l.toArray().map(x => x.toFixed(3)).join(','), ' mirror(R)', m.toArray().map(x => x.toFixed(3)).join(','), ' angle', (2 * Math.acos(Math.min(1, Math.abs(l.dot(m)))) * 180 / Math.PI).toFixed(1));
}
for (const n of ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head']) { const q = key.q[rig.index.get(n)]; console.log(n, q.toArray().map(x => x.toFixed(3)).join(','), rig.offset[rig.index.get(n)].toArray().map(x => x.toFixed(3)).join(',')); }
