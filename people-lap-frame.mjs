// The frame a thigh's skin table (people-lap-data.mjs, tools/people/measure-lap.mjs) is in, apart from the data so that the
// tool that measures it can use it: the axis is the way the shin's bone leaves the thigh's, the first side direction is the
// bone's own one most across it, the second completes it. All local to the thigh bone. (offset: the shin's offset from the thigh)
import * as THREE from 'three';

export const LAP_STATIONS = 48, LAP_BINS = 36;       // along the thigh x round it (every 11 mm x 10 degrees)
export const LAP_FROM = 0, LAP_TO = 1.25;            // from the hip joint to past the front of the knee cap, in thigh lengths (the table has no skin where there is none)
export function thighFrame(offset) {
    const axis = new THREE.Vector3().copy(offset).normalize(), pick = Math.abs(axis.x) < .8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u1 = pick.addScaledVector(axis, -pick.dot(axis)).normalize(), u2 = new THREE.Vector3().crossVectors(axis, u1);
    return { axis, u1, u2 };
}
