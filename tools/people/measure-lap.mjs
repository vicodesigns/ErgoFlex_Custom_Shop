#!/usr/bin/env node
// How far the skin of each wheelchair user's thighs is from the thigh bone (people-lap.mjs keeps the hands out of it):
//
//     node tools/people/measure-lap.mjs        ->  people-lap-data.mjs
//
// For every character with a 'wheel-watch' model: the points of the baked skin that the thigh bone moves most, in the thigh
// bone's own frame, binned by where they are along the way to the knee (LAP.stations) and the angle round it (LAP.bins):
// the farthest of each bin, in millimetres. The skin is its triangles, sampled every SAMPLE metres (not only their corners: a low-poly
// thigh has its corners 40 mm apart along it, and the cloth between them lies well inside the farthest corner: read off the corners,
// widened to the bins round each, the table stood 10 to 17 mm over the jeans where the hands rest, and they hovered: 24 Nov 2026).
// A bin no skin falls in has none (past the knee cap's front, the skin has closed). Run it after the wheel-watch models are rebuilt
// (tools/people/build.py).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PersonRig } from '../../room-people-motion.mjs';
import { thighFrame, LAP_STATIONS, LAP_BINS, LAP_FROM, LAP_TO } from '../../people-lap-frame.mjs';
import { bodyPoints, bodyTriangles, posed, intoSkin } from '../../tests/lib/people-surface.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), RIGS = path.join(ROOT, 'assets/props/people-rigs');
const STATIONS = LAP_STATIONS, BINS = LAP_BINS;
const who = fs.readdirSync(RIGS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(c => fs.existsSync(path.join(ROOT, 'assets/props', `people-${c}-wheel-watch.glb`)));
// (the shin's skin counts only as far as KNEE_CAP metres down from the knee: the knee cap. Below it the shin hangs away from the thigh, and
// in the thigh's frame it would stand for skin half a metre from the bone, a whole sector of nothing taken for leg: 24 Nov 2026)
const KNEE_CAP = .09;
// The hand's and the forearm's skin, as a few points that stand for it: HAND_POINTS picks of a farthest-point walk over the vertices of
// the hand and the fingers (all three bones of each), in the frame of the bone that moves each ([bone, x, y, z], millimetres).
const HAND_POINTS = 128, FORE_STATIONS = 6, FORE_BINS = 12, SAMPLE = .003;
// Points every `step` metres over a triangle (its corners and edges too).
function sampleTriangle(a, b, c, step, out) {
    const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, w = j / n; out.push(new THREE.Vector3().addScaledVector(a, 1 - u - w).addScaledVector(b, u).addScaledVector(c, w)); }
}
function walk(list, count) {
    if (list.length <= count) return list;
    const far = (a, b) => (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2, mid = list.reduce((m, p) => [0, m[1] + p[1] / list.length, m[2] + p[2] / list.length, m[3] + p[3] / list.length], [0, 0, 0, 0]);
    const picked = [list.reduce((best, p) => far(p, mid) > far(best, mid) ? p : best)], dist = list.map(p => far(p, picked[0]));
    while (picked.length < count) { let at = 0; for (let i = 1; i < list.length; i++) if (dist[i] > dist[at]) at = i; picked.push(list[at]); for (let i = 0; i < list.length; i++) dist[i] = Math.min(dist[i], far(list[i], list[at])); }
    return picked;
}
function armPoints(points, rig, side) {
    // (in the hand's own frame, so that the walk goes over the whole hand and not along the bones: the hand and finger bones' points go to the hand bone's frame by the pose as built)
    const key = rig.key(rig.postures && Object.keys(rig.postures).find(id => /wheel-watch$/.test(id))), v = new THREE.Vector3(), handI = rig.index.get('hand_' + side), q = new THREE.Quaternion();
    const hand = [];
    for (const name of ['hand_' + side, ...rig.names.filter(n => /^(thumb|index|middle|ring|pinky)_0\d_/.test(n) && n.endsWith('_' + side))]) {
        const i = rig.index.get(name);
        for (const [x, y, z] of points[name] || []) { v.set(x, y, z).applyQuaternion(key.wq[i]).add(key.wp[i]).sub(key.wp[handI]).applyQuaternion(q.copy(key.wq[handI]).invert()); hand.push([name, v.x, v.y, v.z, x, y, z]); }
    }
    // (the walk by the hand's frame, the point kept in its own bone's frame)
    const pick = walk(hand.map(p => [p[0], p[1], p[2], p[3], p]), HAND_POINTS).map(p => p[4]);
    // (and the tip of every finger: its last bone's points farthest along it, where a hand laid on a knee touches it first)
    for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) { const tip = hand.filter(p => p[0] === `${f}_03_${side}`).sort((a, b) => b[5] - a[5]).slice(0, 3); for (const p of tip) if (!pick.includes(p)) pick.push(p); }
    return pick.map(p => [p[0], Math.round(p[4] * 1000), Math.round(p[5] * 1000), Math.round(p[6] * 1000)]);
}
// The forearm's skin: how far it is from the elbow-wrist line, at FORE_STATIONS places along it and FORE_BINS angles round it (millimetres,
// the angle from the frame people-lap-frame.mjs thighFrame gives the elbow-to-wrist direction), in the forearm bone's frame.
function foreRadii(points, rig, side) {
    const wrist = rig.offset[rig.side[side].arm[3]], len = wrist.length(), { axis, u1, u2 } = thighFrame(wrist), v = new THREE.Vector3(), grid = Array(FORE_STATIONS * FORE_BINS).fill(0);
    for (const [x, y, z] of points['lowerarm_' + side] || []) {
        v.set(x, y, z); const t = v.dot(axis) / len; if (t < 0 || t >= 1) continue;
        const px = v.dot(u1), py = v.dot(u2), r = Math.hypot(px, py), j = Math.floor((Math.atan2(py, px) + Math.PI) / (2 * Math.PI) * FORE_BINS) % FORE_BINS, k = Math.floor(t * FORE_STATIONS);
        if (r > grid[k * FORE_BINS + j]) grid[k * FORE_BINS + j] = r;
    }
    fill(grid, FORE_STATIONS, FORE_BINS);
    return grid.map(r => Math.round(r * 1000));
}
// (bins with no point: the mean of the nearest filled ones round, then along)
function fill(grid, stations, bins) {
    for (let pass = 0; pass < 6; pass++) {
        const next = grid.slice();
        for (let k = 0; k < stations; k++) for (let j = 0; j < bins; j++) if (!grid[k * bins + j]) {
            const near = [grid[k * bins + (j + 1) % bins], grid[k * bins + (j + bins - 1) % bins], k > 0 ? grid[(k - 1) * bins + j] : 0, k < stations - 1 ? grid[(k + 1) * bins + j] : 0].filter(x => x > 0);
            if (near.length) next[k * bins + j] = near.reduce((a, b) => a + b, 0) / near.length;
        }
        for (let i = 0; i < grid.length; i++) grid[i] = next[i];
    }
}
const characters = {};
for (const c of who) {
    const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(RIGS, c + '.json'), 'utf8')));
    const points = await bodyPoints(`people-${c}-wheel-watch`), triangles = await bodyTriangles(`people-${c}-wheel-watch`), out = {};
    rig.load(rig.key(`people-${c}-wheel-watch`)); rig.fk();       // (the posture the skin was measured in)
    for (const side of ['l', 'r']) {
        const [thigh, calf] = rig.side[side].leg, f = thighFrame(rig.offset[calf]), len = rig.offset[calf].length();
        const grid = Array.from({ length: STATIONS * BINS }, () => 0), v = new THREE.Vector3();
        // (the thigh's skin, and the top of the shin's: the knee cap, in the thigh's frame as the posture was built: the triangles with a
        // corner on the thigh or on the knee cap, every corner taken to the thigh's frame by the bone that moves it)
        const shin = rig.offset[rig.side[side].leg[2]].clone().normalize(), inv = rig.wq[thigh].clone().invert();
        const toThigh = ([bone, x, y, z]) => { if (bone === 'thigh_' + side) return new THREE.Vector3(x, y, z); const i = rig.index.get(bone); if (i === undefined) return null; return new THREE.Vector3(x, y, z).applyQuaternion(rig.wq[i]).add(rig.wp[i]).sub(rig.wp[thigh]).applyQuaternion(inv); };
        const onCap = ([bone, x, y, z]) => bone === 'calf_' + side && v.set(x, y, z).dot(shin) < KNEE_CAP;
        const skin = [];
        for (const tri of triangles) {
            if (!tri.some(c => c[0] === 'thigh_' + side || onCap(c))) continue;
            const [a, b, c] = tri.map(toThigh); if (!a || !b || !c) continue;
            // (a triangle that reaches down the shin past the knee cap: only its part near the knee)
            sampleTriangle(a, b, c, SAMPLE, skin);
        }
        const capAt = rig.offset[calf].clone(), shinIn = shin.clone().applyQuaternion(rig.wq[calf]).applyQuaternion(inv);
        for (const p of skin) {
            if (p.clone().sub(capAt).dot(shinIn) > KNEE_CAP) continue;
            const s = p.dot(f.axis) / len;
            if (s < LAP_FROM || s >= LAP_TO) continue;
            const px = p.dot(f.u1), py = p.dot(f.u2), r = Math.hypot(px, py), j = Math.floor((Math.atan2(py, px) + Math.PI) / (2 * Math.PI) * BINS) % BINS, k = Math.floor((s - LAP_FROM) / (LAP_TO - LAP_FROM) * STATIONS);
            if (r > grid[k * BINS + j]) grid[k * BINS + j] = r;
        }
        // (a bin is made from its neighbours only where it is a hole in skin all round it, round the leg or along it: the bins past the end
        // of the skin, the front of the knee cap, stay empty)
        const near = grid.slice(), at = (kk, jj) => kk < 0 || kk >= STATIONS ? 0 : grid[kk * BINS + (jj + BINS) % BINS];
        for (let k = 0; k < STATIONS; k++) for (let j = 0; j < BINS; j++) {
            if (grid[k * BINS + j]) continue;
            const round = [1, 2].map(d => [at(k, j - d), at(k, j + d)]).find(([a, b]) => a && b), along = [at(k - 1, j), at(k + 1, j)];
            if (round) near[k * BINS + j] = Math.max(...round); else if (along[0] && along[1]) near[k * BINS + j] = Math.max(...along);
        }
        out[side] = near.map(m => Math.round(m * 1000));
    }
    out.arm = {}; out.fore = {};
    for (const side of ['l', 'r']) { out.arm[side] = armPoints(points, rig, side); out.fore[side] = foreRadii(points, rig, side); }
    characters[c] = out;
}
// (a character with no wheel-watch model: the mean of the others)
const mean = side => Array.from({ length: STATIONS * BINS }, (_, i) => Math.round(who.reduce((a, c) => a + characters[c][side][i], 0) / who.length));
characters.default = { l: mean('l'), r: mean('r'), arm: characters[who[0]].arm, fore: characters[who[0]].fore };
const packHand = pts => { const names = [...new Set(pts.map(p => p[0]))]; for (const p of pts) for (const v of p.slice(1)) if (v < -128 || v > 127) throw Error('a hand point out of a byte: ' + p); return `hand('${names.join(' ')}', '${Buffer.from(pts.flatMap(p => [names.indexOf(p[0]), ...p.slice(1)]).map(v => v & 255)).toString('base64')}')`; };
// (a table as one byte a bin, millimetres, in base64: the stations from the hip, each the angles round it)
const rows = a => { const b64 = Buffer.from(a.map(v => Math.max(0, Math.min(255, v)))).toString('base64'), lines = []; for (let i = 0; i < b64.length; i += 120) lines.push("      '" + b64.slice(i, i + 120) + "'"); return lines.join(' +\n'); };
let text = `// Generated by tools/people/measure-lap.mjs: the skin of the thighs, millimetres from the thigh bone's axis (stations from the hip to
// the knee x angles round it, in the thigh bone's own frame: people-lap.mjs thighFrame, people-lap-frame.mjs LAP_STATIONS x LAP_BINS),
// per character; one byte a bin, in base64.
const mm = b64 => Array.from(atob(b64), c => c.charCodeAt(0) / 1000);
// (the hand's points: [bone, x, y, z] mm, as four signed bytes each, the bone by its place in the list of names, in base64)
const hand = (names, b64) => { const n = names.split(' '), b = Array.from(atob(b64), c => { const v = c.charCodeAt(0); return v > 127 ? v - 256 : v; }), out = []; for (let i = 0; i < b.length; i += 4) out.push([n[b[i]], b[i + 1], b[i + 2], b[i + 3]]); return out; };
export default {
  characters: {
`;
for (const [c, t] of Object.entries(characters)) text += `    ${c}: {
      l: mm(
${rows(t.l)}),
      r: mm(
${rows(t.r)}),
      arm: { l: ${packHand(t.arm.l)}, r: ${packHand(t.arm.r)} },
      fore: { l: ${JSON.stringify(t.fore.l)}, r: ${JSON.stringify(t.fore.r)} },
    },
`;
// The typing postures in a wheelchair whose model as built has the hands or forearms in the thighs (millimetres, by the skin's own normals:
// tests/lib/people-surface.mjs): a change to or from one of them is kept out of the lap as a wheel-watch one is (people-lap.mjs lapModel).
// Those under LAP_POSTURE_MM are not listed: their people are drawn exactly as before.
const LAP_POSTURE_MM = 8, typing = {};
for (const c of fs.readdirSync(RIGS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))) {
    const rig = new PersonRig(JSON.parse(fs.readFileSync(path.join(RIGS, c + '.json'), 'utf8')));
    for (const id of Object.keys(rig.postures || {}).filter(id => /-wheel-type(-\d+)?$/.test(id) && fs.existsSync(path.join(ROOT, 'assets/props', id + '.glb')))) {
        const points = await bodyPoints(id); rig.load(rig.key(id)); rig.fk();
        const body = posed(rig, points, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']);
        let deep = 0;
        for (const s of ['l', 'r']) {
            const hand = posed(rig, points, ['hand_' + s, ...rig.names.filter(n => /^(thumb|index|middle|ring|pinky)_0\d_/.test(n) && n.endsWith('_' + s))]).map(p => p.slice(0, 3));
            deep = Math.max(deep, intoSkin(body, hand).depth, intoSkin(body, posed(rig, points, ['lowerarm_' + s]).map(p => p.slice(0, 3))).depth);
        }
        if (deep * 1000 >= LAP_POSTURE_MM) typing[id] = Math.round(deep * 1000);
    }
}
text += '  },\n';
text += `  // typing postures (wheel-type) whose model as built has the hands or forearms this many mm in the thighs (>= ${LAP_POSTURE_MM} mm)\n  typing: ${JSON.stringify(typing)},\n`;
text += '};\n';
fs.writeFileSync(path.join(ROOT, 'people-lap-data.mjs'), text);
console.log('people-lap-data.mjs:', who.length, 'characters');
