// Measures a pose-key set on Maya's real mesh over time: surface clearances (arms vs head / neck / torso / ponytail / chair back /
// the other arm) and the pulling hand's distance to the stretching elbow, at the holds and at the transitions.
//   node docs/rise-pull/measure-pull.mjs <patch.json> <seated|standing> [step seconds=0.1] [from] [to]
// patch.json: { "people-maya-sit-type": [ {t, pose}, ... ] }  (the by-key patch) or a cut / export file holding people.cast[maya-stand]
import fs from 'node:fs';
import { rig, fkAt, poseAt } from './rise-pull-lib.mjs';
import { useMesh } from './rise-pull-skin.mjs';
import { V3, buildGroups, armVerts, skinList, Grid, cmv } from './rise-pull-geom.mjs';
const [file, which = 'seated', stepArg, fromArg, toArg] = process.argv.slice(2);
const POST = which === 'standing' ? 'people-maya-stand-type-41' : 'people-maya-sit-type';
useMesh(POST);
let doc = JSON.parse(fs.readFileSync(file, 'utf8')), keys;
if (doc[POST]) keys = doc[POST]; else { const sh = doc.shots ? doc.shots[0] : doc; const ppl = sh.peopleEdits || sh.people; keys = ppl.cast.find(c => c.key === 'maya-stand').postures[POST].poseKeys; }
const times = keys.map(k => k.t), t0 = +fromArg || (which === 'standing' ? 9.0 : 13.0), t1 = +toArg || (which === 'standing' ? 16.4 : 18.9), step = +stepArg || 0.1;
const ZBACK = which === 'seated' ? -0.12 : -5;
const G = buildGroups(POST), gHead = new Grid(G.head), gNeck = new Grid(G.neck), gPony = new Grid(G.pony), gTorso = new Grid(G.torso);
const AV = armVerts(1);
const nearest = (pts, grid, cap = 0.06) => { let m = cap; for (const p of pts) m = Math.min(m, grid.near(p, cap)); return m * 100; };
export function frame(t) {
    const entry = { poseKeys: keys }, d = poseAt(entry, t);
    const fk = fkAt(POST, d, 'rest');
    const out = { t };
    const arms = {}; for (const k of ['armL', 'armR', 'handL', 'handR']) arms[k] = skinList(AV[k]);
    const fore = (k, hk) => arms[k].filter((_, i) => /lowerarm|hand|_0/.test(AV[k][i].bone)).concat(arms[hk]);
    for (const [s, A, H] of [['L', 'armL', 'handL'], ['R', 'armR', 'handR']]) {
        const all = arms[A].concat(arms[H]), fa = fore(A, H);
        out['head' + s] = nearest(all, gHead); out['neck' + s] = nearest(all, gNeck); out['torso' + s] = nearest(fa, gTorso); out['pony' + s] = nearest(all, gPony, 0.03);
        out['zmin' + s] = Math.min(...all.map(p => p.z)) * 100;
    }
    // arm against arm: min distance between the two arms, and the pulling hand (either) to the other's elbow
    const L = arms.armL.concat(arms.handL), R = arms.armR.concat(arms.handR), gR = new Grid(R, 0.015), gL = new Grid(L, 0.015);
    let m = 1; for (const p of L) m = Math.min(m, gR.near(p, 0.05)); out.armarm = m * 100;
    const handsL = arms.handL, handsR = arms.handR; let a = 1, b = 1; for (const p of handsL) a = Math.min(a, gR.near(p, 0.05)); for (const p of handsR) b = Math.min(b, gL.near(p, 0.05));
    out.handLtoR = a * 100; out.handRtoL = b * 100;
    const P = n => fk.P(n); out.elbR = P('lowerarm_r'); out.elbL = P('lowerarm_l'); out.wrL = P('hand_l'); out.wrR = P('hand_r');
    out.dWL_ER = P('hand_l').distanceTo(P('lowerarm_r')) * 100; out.dWR_EL = P('hand_r').distanceTo(P('lowerarm_l')) * 100;
    return out;
}
if (process.argv[1].endsWith('measure-pull.mjs')) {
    const f = x => (x >= 60 ? '  --' : x.toFixed(1)).padStart(5);
    console.log('t      headL headR neckL neckR torsL torsR ponyL ponyR zminL zminR armarm hLtoR hRtoL  dWL-ER dWR-EL');
    const ts = new Set(); for (let t = t0; t <= t1 + 1e-9; t += step) ts.add(Math.round(t * 1000) / 1000); for (const t of times) if (t >= t0 && t <= t1) ts.add(t);
    for (const t of [...ts].sort((a, b) => a - b)) { const o = frame(t); console.log(String(t).padEnd(7) + ['headL', 'headR', 'neckL', 'neckR', 'torsoL', 'torsoR', 'ponyL', 'ponyR'].map(k => f(o[k])).join(' ') + ' ' + f(o.zminL) + f(o.zminR) + ' ' + f(o.armarm) + ' ' + f(o.handLtoR) + ' ' + f(o.handRtoL) + '  ' + o.dWL_ER.toFixed(1).padStart(6) + ' ' + o.dWR_EL.toFixed(1).padStart(6)); }
}
