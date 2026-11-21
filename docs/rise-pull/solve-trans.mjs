// Searches the intermediate pose T of the three transitions (raise 13.35 -> 13.75, swap 14.567 -> 14.9, release 17.2 -> 17.8) so that the arms
// go round the head and neck instead of through them (the keys slerp each bone on its own; the shortest arc of a forearm can cross the head).
//   node docs/rise-pull/solve-trans.mjs <poses.json> [iterations] [seed]      (prints the best T as a "direct" pose)
import fs from 'node:fs';
import { fkAt, poseAt } from './rise-pull-lib.mjs';
import { V3, buildGroups, armVerts, skinList, Grid } from './rise-pull-geom.mjs';
import { loader, baseKeys } from './rise-pull-poses.mjs';
const [posesFile, itArg, seedArg] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(posesFile, 'utf8')), which = process.env.WHICH || 'seated', c = cfg[which];
const { POST, poseOf } = await loader(which);
const G = buildGroups(POST), gHead = new Grid(G.head), gNeck = new Grid(G.neck), gTorso = new Grid(G.torso);
const AV = armVerts(3), keys0 = baseKeys(c.base, POST);
const P = {}; for (const [n, s] of Object.entries(c.poses)) if (!s.free) P[n] = poseOf(s);
const rest = t => keys0.find(k => Math.abs(k.t - t) < 1e-6).pose;
const chairZ = y => (y < 1.03 ? -0.075 : -0.12);
// transitions: [tA, tT, tB, pose A, pose B, contact at A?, contact at B?]
const TR = c.transitions;     // [{a: t|name, tA, tT, tB, from: 'rest@13.35' | 'P1', to: ...}]
const poseNamed = (n) => n.startsWith('rest@') ? rest(+n.slice(5)) : P[n];
const dirs = (p) => ({ direct: { r: { d1: [p[0], p[1]], d2: [p[2], p[3]] }, l: { d1: [p[0], -p[1]], d2: [p[2], -p[3]] } } });
function frameCost(keys, t, mid) {
    const pose = poseAt({ poseKeys: keys }, t); fkAt(POST, pose, 'rest');
    let cost = 0; const all = {}; for (const k of ['armL', 'armR', 'handL', 'handR']) all[k] = skinList(AV[k]);
    const pen = (pts, grid, margin, w) => { for (const q of pts) { const d = grid.near(q, margin) * 100; if (d < margin * 100 - 1e-6) cost += w * (margin * 100 - d) ** 2; } };
    const L = all.armL.concat(all.handL), R = all.armR.concat(all.handR);
    for (const pts of [L, R]) { pen(pts, gHead, 0.012, 3); pen(pts, gNeck, 0.012, 3); for (const q of pts) { const z = chairZ(q.y); if (q.z < z) cost += 2 * ((z - q.z) * 100) ** 2; } }
    const fore = (A, lst) => A.filter((_, i) => /lowerarm|hand|_0/.test(lst[i].bone));
    pen(fore(all.armL, AV.armL).concat(all.handL), gTorso, 0.006, 2); pen(fore(all.armR, AV.armR).concat(all.handR), gTorso, 0.006, 2);
    if (mid) { const gR = new Grid(R, 0.015); for (const q of L) { const d = gR.near(q, 0.02) * 100; if (d < 0.8) cost += 3 * (0.8 - d) ** 2; } }
    return cost;
}
function total(p) {
    const T = poseOf(dirs(p)); let cost = 0;
    for (const tr of TR) {
        const keys = [{ t: tr.tA, pose: poseNamed(tr.from) }, { t: tr.tT, pose: T }, { t: tr.tB, pose: poseNamed(tr.to) }];
        for (let t = tr.tA + 1 / 30; t < tr.tB - 1e-6; t += 1 / 30) cost += frameCost(keys, t, (t > tr.tA + 0.07 && t < tr.tB - 0.07));
    }
    return cost;
}
let rs = (+seedArg || 1) * 4099 + 7; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
let p = JSON.parse(process.env.START || '[14,-90,75,-35]'), best = total(p), step = 25; console.log('start', best.toFixed(1));
for (let i = 0; i < (+itArg || 300); i++) {
    const q = p.map(v => v + gauss() * step * (rnd() < 0.6 ? 1 : 0)); const cq = total(q);
    if (cq < best) { best = cq; p = q; console.log(i, best.toFixed(1), JSON.stringify(p.map(v => Math.round(v * 10) / 10))); }
    if (i % 100 === 99) step = Math.max(4, step * 0.65);
}
console.log('BEST', best.toFixed(1), JSON.stringify(p.map(v => Math.round(v * 10) / 10)));
