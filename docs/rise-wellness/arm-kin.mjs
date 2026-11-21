// Arm kinematics of a pose-key set over time (FK on the posture as built, the same maths as drawPose): joint positions, the three
// segment directions as (theta from +y, phi from +z toward +x) in degrees, per-bone angular speed (deg/s, world frame, between
// consecutive frames at 30 fps), wrist / elbow linear speed (m/s) and their peaks; direction reversals of the wrist's speed.
//   node docs/rise-wellness/arm-kin.mjs <keys file> <seated|standing> <from> <to> [csv out] [--table step]
// keys file: a by-key patch { "<posture id>": [keys] } or a cut / shot / export doc holding people.cast[maya-stand]
import fs from 'node:fs';
import { fkAt, poseAt, THREE } from './rise-pull-lib.mjs';
const [file, which = 'seated', fromA, toA, csv, flag, stepA] = process.argv.slice(2);
export const POSTURE = { seated: 'people-maya-sit-type', standing: 'people-maya-stand-type-41' };
export function keysOf(file, POST) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')); if (doc[POST]) return doc[POST];
    const sh = doc.shots ? (doc.shots.find(s => s.id === 'rise') || doc.shots[0]) : doc; const ppl = sh.peopleEdits || sh.people;
    return ppl.cast.find(c => c.key === 'maya-stand').postures[POST].poseKeys;
}
const R2D = 180 / Math.PI;
export const sph = v => { const n = v.clone().normalize(); return [Math.acos(Math.max(-1, Math.min(1, n.y))) * R2D, Math.atan2(n.x, n.z) * R2D]; };
const NAMES = ['clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'middle_01_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'middle_01_r', 'head', 'neck_01'];
export function sample(keys, POST, t) {
    const fk = fkAt(POST, poseAt({ poseKeys: keys }, t), 'rest'), o = { t, P: {}, Q: {} };
    for (const n of NAMES) { o.P[n] = fk.P(n); o.Q[n] = fk.Q(n); }
    return o;
}
export function kinematics(keys, POST, t0, t1, fps = 30) {
    const rows = []; let prev = null;
    const n = Math.round((t1 - t0) * fps);
    for (let i = 0; i <= n; i++) {
        const t = t0 + i / fps, s = sample(keys, POST, t), row = { t };
        for (const sd of ['l', 'r']) {
            row['S' + sd] = s.P['upperarm_' + sd]; row['E' + sd] = s.P['lowerarm_' + sd]; row['W' + sd] = s.P['hand_' + sd]; row['F' + sd] = s.P['middle_01_' + sd];
            if (prev) {
                for (const b of ['upperarm', 'lowerarm', 'hand']) { const a = prev.Q[b + '_' + sd], c = s.Q[b + '_' + sd]; row['w_' + b + '_' + sd] = 2 * Math.acos(Math.min(1, Math.abs(a.dot(c)))) * R2D * fps; }
                row['vW' + sd] = s.P['hand_' + sd].distanceTo(prev.P['hand_' + sd]) * fps; row['vE' + sd] = s.P['lowerarm_' + sd].distanceTo(prev.P['lowerarm_' + sd]) * fps;
            }
        }
        rows.push(row); prev = s;
    }
    return rows;
}
// peaks and the smoothness of the speeds: max speed, max |acceleration| (per frame change x fps), the count of local speed minima between moves ("stops")
export function summary(rows, fps = 30) {
    const out = {};
    for (const k of Object.keys(rows[1]).filter(k => /^(w_|v)/.test(k))) {
        const v = rows.slice(1).map(r => r[k]); let acc = 0, stops = 0;
        for (let i = 1; i < v.length; i++) acc = Math.max(acc, Math.abs(v[i] - v[i - 1]) * fps);
        const peak = Math.max(...v), thr = peak * 0.25;
        for (let i = 1; i < v.length - 1; i++) if (v[i] < v[i - 1] - 1e-9 && v[i] <= v[i + 1] && v[i] < thr && Math.max(...v.slice(Math.max(0, i - 8), i)) > thr && Math.max(...v.slice(i + 1, i + 9)) > thr) stops++;
        out[k] = { peak, acc, stops };
    }
    return out;
}
if ((process.argv[1] || '').endsWith('arm-kin.mjs')) {
    const POST = POSTURE[which], keys = keysOf(file, POST), rows = kinematics(keys, POST, +fromA, +toA);
    const f = (x, d = 0) => x === undefined ? '' : x.toFixed(d);
    if (csv && csv !== '-') {
        const cols = Object.keys(rows[1]).filter(k => /^(w_|v)/.test(k));
        fs.writeFileSync(csv, 't,' + cols.join(',') + ',' + ['El', 'Er', 'Wl', 'Wr'].flatMap(k => [k + 'x', k + 'y', k + 'z']).join(',') + '\n' + rows.map(r => [r.t.toFixed(4), ...cols.map(c => f(r[c], 3)), ...['El', 'Er', 'Wl', 'Wr'].flatMap(k => r[k].toArray().map(x => x.toFixed(4)))].join(',')).join('\n'));
    }
    const s = summary(rows); console.log('peaks (deg/s for w_, m/s for v), max accel (per s), stops (speed dips below a quarter of the peak between two moves within 0.27 s)');
    for (const [k, v] of Object.entries(s)) console.log(k.padEnd(14), f(v.peak, k[0] === 'w' ? 0 : 2).padStart(7), f(v.acc, k[0] === 'w' ? 0 : 2).padStart(8), String(v.stops).padStart(3));
    if (flag === '--table') {
        const step = Math.max(1, Math.round((+stepA || 0.1) * 30)); const head = sample(keys, POST, +fromA);
        console.log('head', head.P.head.toArray().map(x => f(x * 100, 1)).join(' '), 'neck', head.P.neck_01.toArray().map(x => f(x * 100, 1)).join(' '));
        console.log('t      | L: up(th,ph) fore(th,ph) hand(th,ph)  E(x,y,z)cm  W(x,y,z)cm | R: ...');
        rows.forEach((r, i) => { if (i % step) return; const side = sd => { const d1 = sph(r['E' + sd].clone().sub(r['S' + sd])), d2 = sph(r['W' + sd].clone().sub(r['E' + sd])), d3 = sph(r['F' + sd].clone().sub(r['W' + sd])); return [d1, d2, d3].map(d => d.map(x => f(x).padStart(4)).join(',')).join(' ') + '  E ' + r['E' + sd].toArray().map(x => f(x * 100).padStart(4)).join(',') + ' W ' + r['W' + sd].toArray().map(x => f(x * 100).padStart(4)).join(','); }; console.log(r.t.toFixed(2).padEnd(6), '|', side('l'), '|', side('r')); });
    }
}
