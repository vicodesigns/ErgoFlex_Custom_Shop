// Numbers from a wellness-probe.cjs log: per sample the desk (height in, desktop top mm when the probe found it), the desk
// user's state, Maya (which model; pelvis, lowest hand / fingertip, knees) and the chair, plus the clearance checks:
//   - hands / fingertips / forearms against the desktop slab: a point inside the desktop's footprint (x, z) must be above
//     its top or below its underside (bottom); the smallest margin is reported (negative = inside the slab = an intersection)
//   - knees / thighs against the underside while she sits (inside the footprint: must be below it)
//   - the chair: its distance from her pelvis while she is not seated (it must not be where she stands), from the desk
//     footprint (it must not be under a moving top while parked), and where it is when she sits
//   node docs/wellness-order/summarize.mjs <probe.jsonl> [every=0.5] [--csv out.csv]
import fs from 'node:fs';
const [file, everyA = '0.5'] = process.argv.slice(2), every = +everyA, csvAt = process.argv.indexOf('--csv');
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const PTS = ['hand_l', 'hand_r', 'middle_03_l', 'middle_03_r', 'lowerarm_l', 'lowerarm_r'], LEG = ['calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'pelvis'];
let worst = { m: Infinity }, worstLeg = { m: Infinity };
const out = [], csv = ['t,height_in,top_mm,bottom_mm,tau,k,away,model,pelvis_y,hand_min_y,finger_min_y,knee_y,head_y,slab_margin_mm,chair_x,chair_z,chair_yaw,chair_to_pelvis_mm'];
for (const r of rows) {
    const d = r.desk && r.desk.n ? r.desk : null, m = r.maya.find(x => x.amount > .5) || r.maya[0], b = m?.bones || {};
    const inside = p => d && p[0] > d.x[0] && p[0] < d.x[1] && p[2] > d.z[0] && p[2] < d.z[1];
    let margin = Infinity, legM = Infinity;
    if (d) {
        for (const n of PTS) if (b[n] && inside(b[n])) { const y = b[n][1], mm = y >= d.top ? y - d.top : y <= d.bottom ? d.bottom - y : -Math.min(y - d.bottom, d.top - y); if (mm < margin) margin = mm; }
        for (const n of LEG) if (b[n] && inside(b[n])) { const y = b[n][1], mm = y <= d.bottom ? d.bottom - y : -(y - d.bottom); if (mm < legM) legM = mm; }
    }
    if (margin < worst.m) worst = { m: margin, s: r.s }; if (legM < worstLeg.m) worstLeg = { m: legM, s: r.s };
    const ch = r.chair, cp = ch && b.pelvis ? Math.hypot(ch.at[0] - b.pelvis[0], ch.at[2] - b.pelvis[2]) : null;
    const lo = (...n) => Math.min(...n.filter(k => b[k]).map(k => b[k][1]));
    const line = { t: r.s, h: r.h, top: d?.top, bot: d?.bottom, tau: r.tau, k: r.k, away: r.away, model: m ? m.key + '/' + m.id.replace('people-maya-', '') : '-', pelvis: b.pelvis?.[1], hand: lo('hand_l', 'hand_r'), finger: lo('middle_03_l', 'middle_03_r'), knee: lo('calf_l', 'calf_r'), head: b.head?.[1], slab: margin === Infinity ? '' : Math.round(margin), chair: ch ? [Math.round(ch.at[0]), Math.round(ch.at[2]), ch.yaw] : null, chairToPelvis: cp && Math.round(cp) };
    csv.push([r.s, r.h, d?.top ?? '', d?.bottom ?? '', r.tau, r.k, r.away, line.model, line.pelvis, line.hand, line.finger, line.knee, line.head, line.slab, ch?.at[0] ?? '', ch?.at[2] ?? '', ch?.yaw ?? '', cp ? Math.round(cp) : ''].join(','));
    if (Math.abs(r.s / every - Math.round(r.s / every)) < 1e-6) out.push(line);
}
const f = v => v === undefined || v === null || v === '' ? '-' : String(typeof v === 'number' ? Math.round(v * 10) / 10 : v);
console.log('t      height  top    tau   k    away  model                              pelvis  hand   finger knee   head   slab   chair(x,z,yaw)        chair-pelvis');
for (const l of out) console.log([f(l.t).padEnd(6), f(l.h).padEnd(7), f(l.top).padEnd(6), f(l.tau).padEnd(5), f(l.k).padEnd(4), f(l.away).padEnd(5), l.model.padEnd(34), f(l.pelvis).padEnd(7), f(l.hand).padEnd(6), f(l.finger).padEnd(6), f(l.knee).padEnd(6), f(l.head).padEnd(6), f(l.slab).padEnd(6), (l.chair ? l.chair.join(',') : '-').padEnd(21), f(l.chairToPelvis)].join(' '));
console.log(`samples ${rows.length}; smallest hand/forearm margin to the desktop slab where over its footprint: ${worst.m === Infinity ? 'never over it' : Math.round(worst.m) + ' mm at ' + worst.s + ' s'}; knees/thighs under it: ${worstLeg.m === Infinity ? 'never under it' : Math.round(worstLeg.m) + ' mm at ' + worstLeg.s + ' s'}`);
if (csvAt > 0) fs.writeFileSync(process.argv[csvAt + 1], csv.join('\n') + '\n');
