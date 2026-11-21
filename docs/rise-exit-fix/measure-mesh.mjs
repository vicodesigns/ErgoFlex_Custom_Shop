// The Rise exit on Maya's SKINNED mesh (assets/props/people-maya-sit-type.glb, linear-blend skinning onto the rig's FK of the
// pose keys, the film's own poseAt; posture as built, no procedural life layer), per 1/30 s frame:
//   clearances (cm, capped at 6; pony capped at 3): each arm+hand to the head, neck, torso (forearm+hand only), ponytail; arm to arm
//   desk: the lowest hand / forearm vertex (cm) against the same in the typing pose (negative = lower than where the hands
//         rest on the keyboard = into the keyboard / desk); the lowest forearm vertex likewise
//   chair: the most backward arm vertex z (cm; the chair back is behind the shoulders)
//   tearing: over the body + shirt triangles that follow the shoulder / arm / hand bones: the largest edge stretch and the
//            smallest triangle area against the mesh as built (1.00 = as modelled; LBS tearing shows as stretch >> 1, a
//            candy-wrapper wrist / elbow collapse as area -> 0), per region: shoulder, elbow, wrist
//   node measure-mesh.mjs <doc or patch> <from> <to> [label] [out.csv]
import fs from 'node:fs';
import { rig, fkAt, poseAt } from './rise-pull-lib.mjs';
import { mesh } from './rise-pull-skin.mjs';
import { buildGroups, armVerts, skinList, Grid } from './rise-pull-geom.mjs';
import { keysOf, POST } from './kin-lib.mjs';
const [file, a0, a1, label = '', csvF] = process.argv.slice(2), K = keysOf(file), T0 = +a0, T1 = +a1;
const G = buildGroups(POST), gHead = new Grid(G.head), gNeck = new Grid(G.neck), gPony = new Grid(G.pony), gTorso = new Grid(G.torso);
const AV = armVerts(1);
const nearest = (pts, grid, cap = 0.06) => { let m = cap; for (const p of pts) m = Math.min(m, grid.near(p, cap)); return m * 100; };
// triangles for the tearing measure
const jn = mesh.jointNames, dom = (prim, i) => { let b = -1, w = -1; for (let k = 0; k < 4; k++) { const x = prim.weights.data[i * 4 + k]; if (x > w) { w = x; b = prim.joints.data[i * 4 + k]; } } return jn[b]; };
const REGION = { clavicle: 'shoulder', upperarm: 'shoulder', lowerarm: 'elbow', hand: 'wrist' };
const tris = [], verts = new Map(), vlist = [];
mesh.prims.forEach((prim, pi) => {
    if (!/body|shirt/.test(prim.name) || !prim.index) return;
    const ix = prim.index.data;
    for (let t = 0; t < ix.length; t += 3) {
        const v = [ix[t], ix[t + 1], ix[t + 2]], parts = v.map(i => dom(prim, i)), reg = parts.map(p => REGION[p.replace(/_[lr]$/, '')]).filter(Boolean);
        if (!reg.length) continue;
        // a triangle belongs to the joint it spans: shoulder (clavicle/upperarm/spine), elbow (upperarm+lowerarm), wrist (lowerarm+hand)
        const set = new Set(parts.map(p => p.replace(/_[lr]$/, ''))), side = (parts.find(p => /_[lr]$/.test(p)) || '_x').slice(-1);
        const region = set.has('hand') || [...set].some(p => /_0\d/.test(p)) ? 'wrist' : set.has('lowerarm') ? 'elbow' : 'shoulder';
        tris.push({ side, region, v: v.map(i => { const k = pi + ':' + i; if (!verts.has(k)) { verts.set(k, vlist.length); vlist.push({ pi, i }); } return verts.get(k); }) });
    }
});
const skinV = () => skinList(vlist);
fkAt(POST, null, 'rest'); const REF = skinV();
const len = (P, a, b) => P[a].distanceTo(P[b]), area = (P, [a, b, c]) => P[b].clone().sub(P[a]).cross(P[c].clone().sub(P[a])).length() / 2;
const refL = tris.map(t => [len(REF, t.v[0], t.v[1]), len(REF, t.v[1], t.v[2]), len(REF, t.v[2], t.v[0])]), refA = tris.map(t => area(REF, t.v));
// the typing pose's lowest hand / forearm vertices
const handYmin = (arms) => Math.min(...arms.handL.map(p => p.y), ...arms.handR.map(p => p.y), ...arms.armL.filter((_, i) => /^hand/.test(AV.armL[i].bone)).map(p => p.y), ...arms.armR.filter((_, i) => /^hand/.test(AV.armR[i].bone)).map(p => p.y)) * 100;
const foreYmin = (arms) => Math.min(...arms.armL.filter((_, i) => /^lowerarm/.test(AV.armL[i].bone)).map(p => p.y), ...arms.armR.filter((_, i) => /^lowerarm/.test(AV.armR[i].bone)).map(p => p.y)) * 100;
const skinArms = () => { const o = {}; for (const k of ['armL', 'armR', 'handL', 'handR']) o[k] = skinList(AV[k]); return o; };
fkAt(POST, poseAt({ poseKeys: K }, 28.5), 'rest'); const typArms = skinArms(), TYP_HAND = handYmin(typArms), TYP_FORE = foreYmin(typArms);
export function frame(t) {
    fkAt(POST, poseAt({ poseKeys: K }, t), 'rest');
    const arms = skinArms(), o = { t };
    for (const [s, A, H] of [['L', 'armL', 'handL'], ['R', 'armR', 'handR']]) {
        const all = arms[A].concat(arms[H]), fore = arms[A].filter((_, i) => /lowerarm|hand/.test(AV[A][i].bone)).concat(arms[H]);
        o['head' + s] = nearest(all, gHead); o['neck' + s] = nearest(all, gNeck); o['torso' + s] = nearest(fore, gTorso); o['pony' + s] = nearest(all, gPony, 0.03);
        o['zmin' + s] = Math.min(...all.map(p => p.z)) * 100;
    }
    const L = arms.armL.concat(arms.handL), gR = new Grid(arms.armR.concat(arms.handR), 0.015); let m = 0.06; for (const p of L) m = Math.min(m, gR.near(p, 0.06)); o.armarm = m * 100;
    o.deskHand = handYmin(arms) - TYP_HAND; o.deskFore = foreYmin(arms) - TYP_FORE;
    const P = skinV();
    for (const s of ['l', 'r']) for (const r of ['shoulder', 'elbow', 'wrist']) { o[`str_${r}_${s}`] = 0; o[`area_${r}_${s}`] = 9; }
    tris.forEach((tr, k) => {
        if (tr.side === 'x') return;
        const L3 = [len(P, tr.v[0], tr.v[1]), len(P, tr.v[1], tr.v[2]), len(P, tr.v[2], tr.v[0])], st = Math.max(...L3.map((x, j) => refL[k][j] > 1e-5 ? x / refL[k][j] : 1));
        const ar = refA[k] > 1e-8 ? area(P, tr.v) / refA[k] : 1, key = `${tr.region}_${tr.side}`;
        if (st > o['str_' + key]) o['str_' + key] = st; if (ar < o['area_' + key]) o['area_' + key] = ar;
    });
    return o;
}
const COLS = ['headL', 'headR', 'neckL', 'neckR', 'torsoL', 'torsoR', 'ponyL', 'ponyR', 'armarm', 'zminL', 'zminR', 'deskHand', 'deskFore', ...['shoulder', 'elbow', 'wrist'].flatMap(r => ['l', 'r'].flatMap(s => [`str_${r}_${s}`, `area_${r}_${s}`]))];
const rows = [];
for (let i = Math.round(T0 * 30); i <= Math.round(T1 * 30); i++) rows.push(frame(i / 30));
const f = (k, x) => (/^(head|neck|torso|armarm)/.test(k) && x >= 6) || (/^pony/.test(k) && x >= 3) ? '--' : x.toFixed(/^(str|area)/.test(k) ? 2 : 1);
if (csvF) fs.writeFileSync(csvF, 't,' + COLS.join(',') + '\n' + rows.map(o => o.t.toFixed(3) + ',' + COLS.map(k => o[k].toFixed(3)).join(',')).join('\n') + '\n');
console.log(`${label} ${file.split('/').pop()} ${T0}..${T1} s; typing pose: lowest hand vertex y ${TYP_HAND.toFixed(1)} cm, lowest forearm vertex ${TYP_FORE.toFixed(1)} cm; ${tris.length} arm/shoulder triangles`);
console.log('t      ' + COLS.map(k => k.replace('str_', 's').replace('area_', 'a').replace('shoulder', 'sh').replace('elbow', 'el').replace('wrist', 'wr').padStart(7)).join(''));
for (const o of rows) console.log(o.t.toFixed(3).padEnd(7) + COLS.map(k => f(k, o[k]).padStart(7)).join(''));
const mn = k => Math.min(...rows.map(o => o[k])), mx = k => Math.max(...rows.map(o => o[k])), at = (k, fn) => rows.find(o => o[k] === fn(k)).t.toFixed(3);
console.log('min   ' + COLS.map(k => f(k, mn(k)).padStart(7)).join('') + '\nmax   ' + COLS.map(k => f(k, mx(k)).padStart(7)).join(''));
console.log(`SUMMARY ${label}: head min ${Math.min(mn('headL'), mn('headR')).toFixed(1)} neck ${Math.min(mn('neckL'), mn('neckR')).toFixed(1)} torso ${Math.min(mn('torsoL'), mn('torsoR')).toFixed(1)} pony ${Math.min(mn('ponyL'), mn('ponyR')).toFixed(1)} arm-arm ${mn('armarm').toFixed(1)} cm; below typing: hand ${mn('deskHand').toFixed(1)} forearm ${mn('deskFore').toFixed(1)} cm; z back ${Math.min(mn('zminL'), mn('zminR')).toFixed(1)} cm; ` +
    ['shoulder', 'elbow', 'wrist'].map(r => `${r} stretch max ${Math.max(mx('str_' + r + '_l'), mx('str_' + r + '_r')).toFixed(2)} area min ${Math.min(mn('area_' + r + '_l'), mn('area_' + r + '_r')).toFixed(2)}`).join('; '));
