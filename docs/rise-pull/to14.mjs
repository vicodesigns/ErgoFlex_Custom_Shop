// 12 -> 14 parameters: appends the pulling hand's direction (theta, phi) as the 12-parameter pose had it (aimed at the elbow)
import { poseFromParams } from './solve-pull.mjs';
import { fkAt } from './rise-pull-lib.mjs';
const p = JSON.parse(process.argv[2]), POST = process.env.POSTURE || 'people-maya-sit-type';
const { deltas } = poseFromParams(p, POST); const fk = fkAt(POST, deltas, 'rest');
const w = fk.P('hand_l'), f = fk.P('middle_01_l').sub(w).normalize();
console.log(JSON.stringify([...p, +(Math.acos(f.y) * 180 / Math.PI).toFixed(1), +(Math.atan2(f.x, f.z) * 180 / Math.PI).toFixed(1)]));
