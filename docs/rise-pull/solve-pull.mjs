// Searches the elbow-pull pose (stretching right arm, pulling left hand) for Maya seated; prints the best parameters and the cost breakdown.
//   node docs/rise-pull/solve-pull.mjs [iterations] [seed] [posture]
import fs from 'node:fs';
import * as THREE from 'three';
import { rig, fkAt } from './rise-pull-lib.mjs';
import { V3, armDeltas, dirFrom, buildGroups, armVerts, skinList, Grid, cmv } from './rise-pull-geom.mjs';
const POST = process.env.POSTURE || 'people-maya-sit-type', ITER = +process.argv[2] || 3000, SEED = +process.argv[3] || 1;
let rs = SEED * 9301 + 49297; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
export const ZBACK = (process.env.POSTURE || 'people-maya-sit-type').includes('sit') ? -0.12 : -5;     // chair back plane (m), model frame: arms must stay in front of it
import { useMesh } from './rise-pull-skin.mjs'; useMesh(POST);
const G = buildGroups(POST), gHead = new Grid(G.head), gNeck = new Grid(G.neck), gPony = new Grid(G.pony), gTorso = new Grid(G.torso);
const AV = armVerts(2);
const NECK = fkAt(POST, null, 'rest').P('neck_01');      // the posture's neck: the nape and ear level are measured from it
const OUT = +(process.env.OUT || 2);
const COVER = +(process.env.COVER || 60);
const D2R = Math.PI / 180;
// parameters: [R up th,ph, fore th,ph, hand th,ph, roll,  L up th,ph, fore th,ph, roll]  (degrees)
export function poseFromParams(p, posture = POST, stretch = 'r') {
    // stretch: the side of the stretching arm ('r' as the parameters are written; 'l' = the mirror image, hands swapped)
    const sg = stretch === 'r' ? 1 : -1, s1 = stretch, s2 = stretch === 'r' ? 'l' : 'r';
    const d = (a, b) => dirFrom(a * D2R, b * sg * D2R);
    const R = armDeltas(posture, s1, d(p[0], p[1]), d(p[2], p[3]), d(p[4], p[5]), p[6] * sg);
    const fk = fkAt(posture, R, 'rest'); const Er = fk.P('lowerarm_' + s1);
    // pulling arm; the hand aims at the stretching elbow from where the wrist is
    const U = d(p[7], p[8]), F = d(p[9], p[10]);
    const pre = armDeltas(posture, s2, U, F, V3(0, 1, 0), 0);
    const fk2 = fkAt(posture, pre, 'rest'), Wl = fk2.P('hand_' + s2), aim = p.length > 12 ? d(p[12], p[13]) : Er.clone().sub(Wl).normalize();
    const L = armDeltas(posture, s2, U, F, aim, p[11] * sg);
    return { deltas: { ...R, ...L }, Er };
}
// the palm normal of a hand in the pose now in the rig (unit, pointing out of the palm, the side the fingers curl to)
export function palm(fk, side) {
    const W = fk.P('hand_' + side), I1 = fk.P('index_01_' + side), P1 = fk.P('pinky_01_' + side), M1 = fk.P('middle_01_' + side), M3 = fk.P('middle_03_' + side);
    const n = I1.clone().sub(P1).cross(M1.clone().sub(W)).normalize(); if (M3.clone().sub(M1).dot(n) < 0) n.negate();
    return { n, c: W.clone().add(M1).multiplyScalar(0.5) };
}
export function evaluate(p, posture = POST, detail = false) {
    const { deltas, Er } = poseFromParams(p, posture);
    const fk = fkAt(posture, deltas, 'rest');
    const aR = skinList(AV.armR), hR = skinList(AV.handR), aL = skinList(AV.armL), hL = skinList(AV.handL);
    const t = {}; const add = (k, v) => { t[k] = (t[k] || 0) + v; };
    const pen = (pts, grid, margin, w, k, onlyBones = null) => { for (let i = 0; i < pts.length; i++) { const d = grid.near(pts[i], margin) * 100; if (d < margin * 100 - 1e-6) add(k, w * (margin * 100 - d) ** 2); } };
    // clearances (arm surface vs head / neck / torso; a vertex nearer than the margin counts)
    const R_all = aR.concat(hR), L_all = aL.concat(hL);
    for (const pts of [R_all, L_all]) { pen(pts, gHead, 0.012, 3, 'head'); pen(pts, gNeck, 0.012, 3, 'neck'); }
    // forearm / hands vs torso
    const forearm = (A, list) => A.filter((_, i) => list[i].bone && /lowerarm|hand|_0/.test(list[i].bone));
    for (const [A, lst] of [[aR, AV.armR], [aL, AV.armL]]) { const f = forearm(A, lst); pen(f, gTorso, 0.008, 2, 'torso'); }
    pen(hR, gTorso, 0.008, 2, 'torso'); pen(hL, gTorso, 0.008, 2, 'torso');
    pen(R_all, gPony, 0.002, 0.3, 'pony'); pen(L_all, gPony, 0.002, 0.3, 'pony');
    // chair back
    for (const pts of [R_all, L_all]) for (const q of pts) if (q.z < ZBACK) add('chair', 2 * ((ZBACK - q.z) * 100) ** 2);
    // arm against arm (everything but the left hand against the right forearm)
    const gRA = new Grid(R_all, 0.015);
    let minContact = 1; for (const q of hL) minContact = Math.min(minContact, gRA.near(q, 0.1));
    for (const q of aL) { const d = gRA.near(q, 0.02) * 100; if (d < 1.0) add('armarm', 3 * (1.0 - d) ** 2); }
    // the contact: left hand surface on the right elbow, 0..0.5 cm away; the contact point near the elbow
    add('contact', 4 * Math.max(0, minContact * 100 - 0.4) ** 2);
    const hlc = hL.reduce((a, q) => a.add(q), V3()).multiplyScalar(1 / hL.length);   // left hand centre
    add('elbowHand', 1.0 * Math.max(0, hlc.distanceTo(Er) * 100 - 5) ** 2);          // palm centre within 6 cm of the elbow joint
    // right hand behind the head: wrist near the nape side, below the head
    const Wr = fk.P('hand_r'); const nape = NECK.clone().add(V3(-0.05, 0.018, -0.079));
    add('handR', 0.15 * Math.max(0, Wr.distanceTo(nape) * 100 - 6) ** 2);
    // right elbow up beside the head: near ear level or above, out from the midline
    const Ee = fk.P('lowerarm_r'); add('elbowUp', 0.5 * Math.max(0, NECK.y + 0.128 - Ee.y) * 100);
    // joint sanity: elbow flexion not past 150 deg (forearm folded onto upper arm) and left arm not hyperextended
    const flex = (s) => { const S = fk.P('upperarm_' + s), E = fk.P('lowerarm_' + s), W = fk.P('hand_' + s); return Math.acos(THREE.MathUtils.clamp(S.clone().sub(E).normalize().dot(W.clone().sub(E).normalize()), -1, 1)) / D2R; };
    const fr = flex('r'), fl = flex('l'); if (fr < 35) add('flex', 0.2 * (35 - fr) ** 2); if (fl < 35) add('flex', 0.2 * (35 - fl) ** 2);
    if (fl > 172) add('flex', 5 * (fl - 172) ** 2);
    // palms: the stretching hand's palm toward the nape, the pulling hand's palm toward the elbow
    const pR = palm(fk, 'r'), pL = palm(fk, 'l');
    const cosR = pR.n.dot(nape.clone().sub(pR.c).normalize()), cosL = pL.n.dot(Ee.clone().sub(pL.c).normalize());
    add('palmR', 6 * Math.max(0, 0.7 - cosR) ** 2 * 10); add('palmL', 6 * Math.max(0, 0.7 - cosL) ** 2 * 10);
    // cover: how much of the pulling hand lies on the elbow's arm (vertices within 1.5 cm)
    let cover = 0; for (const q of hL) if (gRA.near(q, 0.02) < 0.015) cover++;
    add('cover', 0.04 * Math.max(0, COVER - cover) ** 2);
    // readable from behind-right: the hand centre sits on the elbow's outer (right, -x) and back (-z) side
    add('visible', 3 * Math.max(0, (hlc.x - Ee.x) * 100 + OUT) ** 2 + 2 * Math.max(0, (hlc.z - Ee.z) * 100 + 1.5) ** 2 + 1 * Math.max(0, 1 - (hlc.y - Ee.y) * 100) ** 2);
    // the deeper pull (PULL_X0 / PULL_DX, cm): the stretching elbow drawn toward the midline while the hand keeps hold
    if (process.env.PULL_X0) add('pull', 4 * (Ee.x * 100 - (+process.env.PULL_X0 + +process.env.PULL_DX)) ** 2);
    const total = Object.values(t).reduce((a, b) => a + b, 0);
    return detail ? { total, t, cosR, cosL, cover, nHL: hL.length, minContact: minContact * 100, flexR: fr, flexL: fl, Er: cmv(Ee), Wr: cmv(Wr), Wl: cmv(fk.P('hand_l')), hlc: cmv(hlc), deltas } : total;
}
if ((process.argv[1] || '').endsWith('solve-pull.mjs')) {
    // start: right arm up beside the head, hand to the nape; left arm toward the right elbow around the back of the head
    let best = null, bc = 1e18;
    const starts = [
        [10, -20, 150, 160, 160, 170, 0, 70, 130, 110, 200, 0],
        [15, -10, 170, 180, 180, 180, 0, 80, 170, 100, 230, 0],
        [20, -30, 140, 120, 150, 120, 0, 60, 160, 100, 250, 0],
        [8, 0, 160, 150, 170, 150, 0, 70, 20, 100, 330, 0],
    ];
    for (const st of starts) {
        let p = st.slice(), c = evaluate(p), step = 12;
        for (let it = 0; it < ITER; it++) {
            const q = p.map(v => v + gauss() * step * (rnd() < 0.4 ? 1 : 0));
            const cq = evaluate(q); if (cq < c) { p = q; c = cq; }
            if (it % 500 === 499) step = Math.max(1.5, step * 0.7);
        }
        console.log('start result', c.toFixed(1), p.map(v => Math.round(v * 10) / 10).join(','));
        if (c < bc) { bc = c; best = p; }
    }
    const det = evaluate(best, POST, true); delete det.deltas;
    console.log(JSON.stringify(det, null, 1)); console.log('BEST', JSON.stringify(best.map(v => Math.round(v * 10) / 10)));
}
