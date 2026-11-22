// Ava's drawn hands from a probe-bones.cjs probe.jsonl (the stage's own skinned models, world metres): per frame which
// model is shown, its wrist / knuckle / fingertip positions, and the one-frame jumps (mm, degrees).
//   node probe-jumps.mjs <probe.jsonl> <out.csv> [x-window: only models whose Root is within 3 m of (-1.6, 5.1)]
import fs from 'node:fs';
const [inF, outF] = process.argv.slice(2);
const lines = fs.readFileSync(inF, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const model = p => (p.match(/([A-Za-z0-9-]+)>Root/) || [])[1] || '?';
const bones = ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r', 'middle_01_l', 'middle_01_r', 'index_03_l', 'index_03_r'];
const rows = [];
for (const { t, objects } of lines) {
    // Ava at the featured desk: the shown skeleton near the free suite (x about -1.6, z about 5.1)
    const near = objects.filter(o => o.shown && Math.hypot(o.pos[0] + 1.6, o.pos[2] - 5.1) < 1.5);
    const by = {}; for (const o of near) by[o.name] ||= o;
    const m = by.hand_l ? model(by.hand_l.path) : 'none';
    rows.push({ t, m, by, count: near.filter(o => o.name === 'hand_l').length });
}
const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000;
const out = ['t,model,shownHands,' + bones.flatMap(b => [b + '_x', b + '_y', b + '_z']).join(',') + ',dHandL_mm,dHandR_mm,dTipL_mm,dTipR_mm,rotHandL_deg,rotHandR_deg,rotLowerL_deg,rotLowerR_deg'];
const worst = {};
rows.forEach((r, i) => {
    const p = rows[i - 1], cols = [r.t.toFixed(4), r.m, r.count, ...bones.flatMap(b => r.by[b] ? r.by[b].pos : ['', '', ''])];
    if (p && r.by.hand_l && p.by.hand_l) {
        const v = [dist(r.by.hand_l.pos, p.by.hand_l.pos), dist(r.by.hand_r.pos, p.by.hand_r.pos), dist(r.by.index_03_l.pos, p.by.index_03_l.pos), dist(r.by.index_03_r.pos, p.by.index_03_r.pos),
            ang(r.by.hand_l.quat, p.by.hand_l.quat), ang(r.by.hand_r.quat, p.by.hand_r.quat), ang(r.by.lowerarm_l.quat, p.by.lowerarm_l.quat), ang(r.by.lowerarm_r.quat, p.by.lowerarm_r.quat)];
        cols.push(...v.map(x => x.toFixed(1)));
        ['dHandL', 'dHandR', 'dTipL', 'dTipR', 'rotHandL', 'rotHandR', 'rotLowerL', 'rotLowerR'].forEach((k, j) => { if (!worst[k] || v[j] > worst[k][0]) worst[k] = [+v[j].toFixed(1), r.t]; });
        console.log(r.t.toFixed(4), r.m.padEnd(14), 'hands', v.slice(0, 2).map(x => x.toFixed(1).padStart(6)).join(' '), 'tips', v.slice(2, 4).map(x => x.toFixed(1).padStart(6)).join(' '), 'rot', v.slice(4).map(x => x.toFixed(1).padStart(5)).join(' '), p.m !== r.m ? '  <== MODEL SWITCH ' + p.m + ' -> ' + r.m : '');
    } else console.log(r.t.toFixed(4), r.m, 'shown', r.count);
    out.push(cols.join(','));
});
fs.writeFileSync(outF, out.join('\n') + '\n');
console.log('worst (value, t):', JSON.stringify(worst));
