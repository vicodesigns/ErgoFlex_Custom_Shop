// Desk Squats (wellness): Maya's hands relative to her chest through the step out, the reps and the step back in, before and after
// the Nov 21 fix. An EMULATION of room-people.mjs stepOuts / drawStep / moveOne in node (the same solveChange / solveStill, the same
// windows and step length; the desk user's key is taken as the standing typing posture as built, the walk's shift is left out since
// only the arms against the body are measured). The film frames are the verification; this gives the numbers.
//   node docs/rise-wellness/squat-kin.mjs <old room-people-motion module (file URL or path)> [csv out]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
const here = new URL('.', import.meta.url);
const NEW = await import('../../room-people-motion.mjs'), OLD = process.argv[2] && process.argv[2] !== '-' ? await import(pathToFileURL(process.argv[2]).href) : null;
const rigData = JSON.parse(fs.readFileSync(new URL('../../assets/props/people-rigs/maya.json', here), 'utf8'));
const ACT = { at: 10.2, dur: 5.2, reps: 3 }, LEN = 1.4, sm = (t, a, b) => THREE.MathUtils.smoothstep(t, a, b);
function run(M, when, fixed) {
    const rig = new M.PersonRig(rigData), desk = rig.key('people-maya-stand-type-41'), post = rig.key('people-maya-stand-type');
    const ready = fixed ? M.squatKey(rig, post) : post, [t0, t1] = when, rows = [];
    for (let f = Math.round(8.5 * 30); f <= Math.round(17.2 * 30); f++) {
        const t = f / 30, act = { since: t - ACT.at, dur: ACT.dur, squat: { reps: ACT.reps } }; let phase;
        if (t < t0 - LEN / 2) { rig.load(desk); rig.fk(); phase = 'desk'; }
        else if (t < t0 + LEN / 2) { M.solveChange(rig, desk, ready, (t - (t0 - LEN / 2)) / LEN); phase = 'out'; }
        else if (t > t1 + LEN / 2) { rig.load(desk); rig.fk(); phase = 'desk'; }
        else if (t > t1 - LEN / 2) { M.solveChange(rig, ready, desk, (t - (t1 - LEN / 2)) / LEN); phase = 'in'; }
        else { const life = sm(t, t0 + LEN / 2, t0 + LEN / 2 + 1) * (1 - sm(t, t1 - LEN / 2 - 1, t1 - LEN / 2)); M.solveStill(rig, post, { time: t, seed: 7, life, actLife: fixed ? 1 : life, taps: true, act }); rig.fk(); phase = 'hold'; }
        const chest = rig.wp[rig.b.spine_03], cq = rig.wq[rig.b.spine_03].clone().invert(), row = { t, phase, pelvis: rig.wp[rig.b.pelvis].y };
        for (const s of ['l', 'r']) row['h' + s] = rig.wp[rig.side[s].arm[3]].clone().sub(chest).applyQuaternion(cq);
        rows.push(row);
    }
    return rows;
}
function report(name, rows) {
    let peak = 0, at = 0, jumps = [];
    for (let i = 1; i < rows.length; i++) for (const s of ['l', 'r']) { const v = rows[i]['h' + s].distanceTo(rows[i - 1]['h' + s]) * 30; rows[i]['v' + s] = v; if (v > peak) { peak = v; at = rows[i].t; } }
    for (let i = 2; i < rows.length; i++) { const a = Math.abs(rows[i].vl - rows[i - 1].vl) * 30; rows[i].al = a; if (a > 25) jumps.push(rows[i].t.toFixed(2) + ' (' + rows[i - 1].vl.toFixed(2) + ' -> ' + rows[i].vl.toFixed(2) + ' m/s)'); }
    const depth = [0, 1, 2].map(k => { const t = ACT.at + ACT.dur * (2 * k + 1) / 6, r = rows.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a); return ((rows[0].pelvis - r.pelvis) * 100).toFixed(1); });
    console.log(name + ': peak hand speed against the chest ' + peak.toFixed(2) + ' m/s at ' + at.toFixed(2) + ' s; one-frame speed jumps over 25 m/s2: ' + (jumps.length ? jumps.join(', ') : 'none') + '; hip drop at the three bottoms (cm): ' + depth.join(' / '));
}
const after = run(NEW, [9.5, 16.1], true); report('after ', after);
let before = null; if (OLD) { before = run(OLD, [9.7, 15.8], false); report('before', before); }
if (process.argv[3]) fs.writeFileSync(process.argv[3], 't,phase_after,v_after,phase_before,v_before\n' + after.slice(1).map((r, i) => [r.t.toFixed(3), r.phase, r.vl.toFixed(3), before ? before[i + 1].phase : '', before ? before[i + 1].vl.toFixed(3) : ''].join(',')).join('\n'));
