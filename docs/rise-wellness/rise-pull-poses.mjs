// Pose specs -> pose-key poses ({bone: [x,y,z,w]}): a pose is {p, stretch} (solve-pull.mjs parameters, the right arm stretching and the
// left hand pulling, or the mirror image with stretch 'l') or {direct: {r|l: {d1:[th,ph], d2, d3, roll}}} (degrees; theta from +y, phi from +z toward +x).
import fs from 'node:fs';
import { cleanTurn } from '../../people-pose-keys.mjs';
export const BONES = ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
export const FINGERS = side => ['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap(f => [1, 2, 3].map(i => f + '_0' + i + '_' + side));
export const POSTURE = { seated: 'people-maya-sit-type', standing: 'people-maya-stand-type-41' };
export async function loader(which) {
    const POST = POSTURE[which]; process.env.POSTURE = POST;
    const { useMesh } = await import('./rise-pull-skin.mjs'); useMesh(POST);
    const { poseFromParams } = await import('./solve-pull.mjs');
    const { armDeltas, dirFrom } = await import('./rise-pull-geom.mjs');
    const d = v => dirFrom(v[0] * Math.PI / 180, v[1] * Math.PI / 180);
    const { rig, fkAt } = await import('./rise-pull-lib.mjs');
    const { palm } = await import('./solve-pull.mjs');
    const THREE = (await import('three'));
    // finger curl about the palm's across axis (the fingers bend toward the palm), per joint angles in degrees; thumb at a third; returns {bone: delta}
    const curlDeltas = (armPose, side, deg) => {
        const fk = fkAt(POST, armPose, 'rest'), pm = palm(fk, side), W = fk.P('hand_' + side), f = fk.P('middle_01_' + side).sub(W).normalize();
        const a = f.clone().cross(pm.n).normalize(), out = {};
        for (const fing of ['index', 'middle', 'ring', 'pinky', 'thumb']) [1, 2, 3].forEach((i, j) => {
            const name = fing + '_0' + i + '_' + side, k = fing === 'thumb' ? 0.35 : 1, wq = fk.Q(name);
            const ax = a.clone().applyQuaternion(wq.clone().invert()), q = new THREE.Quaternion().setFromAxisAngle(ax, deg[j] * k * Math.PI / 180);
            out[name] = cleanTurn(q.toArray());
        });
        return out;
    };
    const identityFingers = o => { for (const sd of ['l', 'r']) for (const b of FINGERS(sd)) o[b] = [0, 0, 0, 1]; return o; };
    return { POST, identityFingers, poseOf(spec) {
        const o = {};
        if (spec.direct) { if (spec.fingers === 'identity') identityFingers(o); for (const [side, a] of Object.entries(spec.direct)) { const r = armDeltas(POST, side, d(a.d1), d(a.d2), d(a.d3 || a.d2), a.roll || 0); for (const k of Object.keys(r)) o[k] = cleanTurn(r[k]); } return o; }
        const { deltas } = poseFromParams(spec.p, POST, spec.stretch); for (const b of BONES) o[b] = cleanTurn(deltas[b]);
        if (spec.curl !== false) { const c = spec.curl || {}, st = spec.stretch, pu = st === 'r' ? 'l' : 'r'; Object.assign(o, curlDeltas(o, st, c.stretch || [12, 18, 12]), curlDeltas(o, pu, c.pull || [40, 55, 40])); }
        return o;
    } };
}
export function baseKeys(file, POST) {
    const base = JSON.parse(fs.readFileSync(file, 'utf8')), sh = base.shots ? base.shots[0] : base;
    return (sh.peopleEdits || sh.people).cast.find(k => k.key === 'maya-stand').postures[POST].poseKeys;
}
