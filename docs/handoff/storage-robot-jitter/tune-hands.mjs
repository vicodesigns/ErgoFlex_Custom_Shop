#!/usr/bin/env node
// Hand-pose tuner for the Robo-Pal carry; setup shared with robot-motion-headless.mjs.
// room-people-motion.mjs, people-held.mjs) driven as people-ghost-audit.mjs does, but with Andre's REAL posture GLBs
// (textures stripped), so the skinned robot (Held.robo-pal 0-8) and his skin are where the stage draws them.
// Per sample (default 1/240 s: the film's 60 fps x 4 sub-frames): each robot material part's centroid in room mm, its
// step since the last sample, and Andre's skin vertices inside the robot (ray parity, 3 rays, majority) per bone.
//   node docs/handoff/storage-robot-jitter/robot-motion-headless.mjs <cut.json> [--from 0] [--to 3.3] [--step .0041667] [--out file.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomPeople, castEntries } from '../../../room-people.mjs';
import { sampleClipMotion } from '../../../experience/desk-clips.mjs';
import { library, makeRoom } from '../../../tools/experience/people-ghost-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const cut = JSON.parse(fs.readFileSync(args[0], 'utf8')), shot = cut.shots ? cut.shots.find(s => s.id === 'storage') : cut;
const T0 = +flag('--from', 0), T1 = +flag('--to', 3.3), STEP = +flag('--step', 1 / 240);
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')), entries = new Map(index.props.map(p => [p.id, p]));

function stripGlb(buf) {   // drop images/textures so GLTFLoader parses in node
    const len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
    delete json.images; delete json.textures; delete json.samplers;
    for (const m of json.materials || []) { const p = m.pbrMetallicRoughness || {}; delete p.baseColorTexture; delete p.metallicRoughnessTexture; delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; m.extensions = {}; }
    json.extensionsUsed = (json.extensionsUsed || []).filter(e => !/texture/i.test(e)); json.extensionsRequired = (json.extensionsRequired || []).filter(e => !/texture/i.test(e));
    let js = Buffer.from(JSON.stringify(json), 'utf8'); const pad = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
    const rest = buf.subarray(20 + len), head = Buffer.alloc(20); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
    return Buffer.concat([head, js, rest]);
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), glbCache = new Map();
async function realModel(id) {
    const e = entries.get(id); if (!e?.file || !/^people-andre-/.test(id)) return null;
    if (!glbCache.has(id)) { const b = stripGlb(fs.readFileSync(path.join(root, e.file))); glbCache.set(id, b); }
    const b = glbCache.get(id), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const g = await new Promise((res, rej) => loader.parse(ab, '', res, rej)).catch(e => { console.error('glb', id, e?.message || e); throw e; });
    const scene = g.scene; scene.scale.setScalar(1000); scene.userData.propId = id; scene.userData.realGlb = true; return scene;
}
const lib = library({ rigs: true }), baseInstance = lib.instance, baseRig = lib.rigInstance;
lib.instance = async id => (await realModel(id)) || baseInstance(id);
lib.rigInstance = async id => (await realModel(id)) || baseRig(id);

const filter = shot.people, layout = shot.layout || 'house', specs = [...castEntries(shot.room, layout), ...(filter.cast || [])];
const room = makeRoom(shot.room, layout, specs), people = new RoomPeople(room, lib), seconds = shot.seconds;
const motion = shot.motion?.clips ? shot.motion : null, deskAt = s => motion ? sampleClipMotion(motion, Math.min(seconds, Math.max(0, s))) : { height: 28, tilt: 0 };
const track = { seconds, heightAt: s => deskAt(s).height, tiltAt: s => deskAt(s).tilt || 0 };
const pose = { x: 0, z: 0, yaw: 0 }, keyboard = { x: 0, z: 260 };
const state = t => ({ height: deskAt(t).height, tilt: deskAt(t).tilt || 0, mode: shot.mode || 'morning', pose, keyboard, time: t, track, target: null, now: 0 });
room.peopleState = () => state(0);
globalThis.__ERGO_PRESENTATION__ = true; const warn = console.warn; console.warn = () => {};
people.setFilter(filter); await people.setEnabled(true); people.update(state(T0)); await people.settled();

// ---- tuner ---------------------------------------------------------------------------------------------------------
// For each key time: Andre's drawn pose (existing keys included), then small extra turns (post-multiplied, as pose keys
// are) on the left arm/hand/fingers and the right fingers, so every skin vertex of those parts ends >= MARGIN outside the
// robot, a hand that touched the robot still touches it (nearest skin <= CONTACT), and the turns stay small and smooth.
// The robot is rigid to hand_r, so its signed distance field is built once per posture model in hand_r's frame.
const OUT = flag('--out', null), KEYS = String(flag('--keys', '')).split(',').filter(Boolean).map(Number);
const MARGIN = +flag('--margin', 0.0008), CONTACT = +flag('--contact', 0.0025), FCONTACT = +flag('--finger-contact', 0.003);   // metres (hand_r frame is in model metres)
const tri = (p, a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const dot = (u, w) => u[0] * w[0] + u[1] * w[1] + u[2] * w[2], d1 = dot(ab, ap), d2 = dot(ac, ap); let q;
    if (d1 <= 0 && d2 <= 0) q = a;
    else {
        const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]], d3 = dot(ab, bp), d4 = dot(ac, bp);
        if (d3 >= 0 && d4 <= d3) q = b;
        else {
            const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); q = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]; }
            else {
                const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], d5 = dot(ab, cp), d6 = dot(ac, cp);
                if (d6 >= 0 && d5 <= d6) q = c;
                else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); q = [a[0] + t * ac[0], a[1] + t * ac[1], a[2] + t * ac[2]]; }
                    else {
                        const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + t * (c[0] - b[0]), b[1] + t * (c[1] - b[1]), b[2] + t * (c[2] - b[2])]; }
                        else { const den = 1 / (va + vb + vc), v2 = vb * den, w2 = vc * den; q = [a[0] + ab[0] * v2 + ac[0] * w2, a[1] + ab[1] * v2 + ac[1] * w2, a[2] + ab[2] * v2 + ac[2] * w2]; }
                    }
                }
            }
        }
    }
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
const RAYS = [[1, .013, .007], [-.011, 1, .017], [.009, -.019, -1]];
const hits = (p, d, T) => {
    let h = 0;
    for (const [a, b, c] of T) {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const px = d[1] * e2[2] - d[2] * e2[1], py = d[2] * e2[0] - d[0] * e2[2], pz = d[0] * e2[1] - d[1] * e2[0], det = e1[0] * px + e1[1] * py + e1[2] * pz;
        if (Math.abs(det) < 1e-14) continue;
        const iv = 1 / det, tx = p[0] - a[0], ty = p[1] - a[1], tz = p[2] - a[2], u = (tx * px + ty * py + tz * pz) * iv; if (u < 0 || u > 1) continue;
        const qx = ty * e1[2] - tz * e1[1], qy = tz * e1[0] - tx * e1[2], qz = tx * e1[1] - ty * e1[0], w = (d[0] * qx + d[1] * qy + d[2] * qz) * iv; if (w < 0 || u + w > 1) continue;
        if ((e2[0] * qx + e2[1] * qy + e2[2] * qz) * iv > 0) h++;
    }
    return h;
};
function buildSdf(parts) {   // parts: [[tri...]] in hand_r frame (metres). 2 mm grid, signed (negative inside any part), band 12 mm
    const all = parts.flat(), min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (const t of all) for (const p of t) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    const h = 0.002, pad = 0.014, band = 0.012, o = min.map(x => x - pad), n = max.map((x, k) => Math.ceil((x + pad - o[k]) / h) + 1), g = new Float32Array(n[0] * n[1] * n[2]).fill(band);
    // bucket triangles (with their part) into 8 mm bins, each triangle in every bin its box + band touches
    const B = 0.008, nb = n.map(x => Math.ceil(x * h / B) + 1), bins = new Map(), key = (i, j, k) => (i * nb[1] + j) * nb[2] + k;
    parts.forEach((T, pi) => T.forEach(t => { const lo = [0, 1, 2].map(k => Math.max(0, Math.floor((Math.min(t[0][k], t[1][k], t[2][k]) - band - o[k]) / B))), hi = [0, 1, 2].map(k => Math.min(nb[k] - 1, Math.floor((Math.max(t[0][k], t[1][k], t[2][k]) + band - o[k]) / B)));
        for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const q = key(i, j, k); if (!bins.has(q)) bins.set(q, []); bins.get(q).push(t); } }));
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
        const p = [o[0] + i * h, o[1] + j * h, o[2] + k * h], list = bins.get(key(Math.floor(i * h / B), Math.floor(j * h / B), Math.floor(k * h / B))); if (!list) continue;
        let d = band; for (const t of list) { const e = tri(p, t[0], t[1], t[2]); if (e < d) d = e; }
        if (d >= band) continue;
        let inside = false; for (const T of parts) { let odd = 0; for (const r of RAYS) odd += hits(p, r, T) & 1; if (odd >= 2) { inside = true; break; } }
        g[(i * n[1] + j) * n[2] + k] = inside ? -d : d;
    }
    return {
        o, n, h, g, min, max,
        at(x, y, z) {
            const fx = (x - o[0]) / h, fy = (y - o[1]) / h, fz = (z - o[2]) / h;
            if (fx < 0 || fy < 0 || fz < 0 || fx >= n[0] - 1 || fy >= n[1] - 1 || fz >= n[2] - 1) return 0.012;
            const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v2 = fy - j, w = fz - k, G = (a, b, c) => g[((i + a) * n[1] + (j + b)) * n[2] + (k + c)];
            return (1 - u) * ((1 - v2) * ((1 - w) * G(0, 0, 0) + w * G(0, 0, 1)) + v2 * ((1 - w) * G(0, 1, 0) + w * G(0, 1, 1))) + u * ((1 - v2) * ((1 - w) * G(1, 0, 0) + w * G(1, 0, 1)) + v2 * ((1 - w) * G(1, 1, 0) + w * G(1, 1, 1)));
        }
    };
}
const FING = ['index', 'middle', 'ring', 'pinky'];
const STATIC_T = flag('--static', null) === null ? null : +flag('--static', 0);
let staticParts = null;   // world tris (scaled to metres) of the robot at STATIC_T: the stowed figure takes exactly this spot
const PARAMS = [...['upperarm_l', 'lowerarm_l', 'hand_l', 'thumb_01_l'].flatMap(b => ['x', 'y', 'z'].map(a => ({ b, a }))),
    ...FING.map(f => ({ f, s: 'l' })), { thumb: 'l' }, ...FING.map(f => ({ f, s: 'r' })), { thumb: 'r' }, ...['x', 'y', 'z'].map(a => ({ b: 'thumb_01_r', a })),
].filter(p => !args.includes('--fingers-only') || !p.b || /thumb/.test(p.b));
// turn limits (deg): a finger's curl / the thumb's base, so a finger never bends back or folds away
const LIMIT = p => p.b ? (/thumb/.test(p.b) ? +flag('--thumb-limit', 20) : 30) : +flag('--finger-limit', 25);
const sdfs = new Map(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3();
let bendAxis = null;
function current(t) { people.update(state(t)); const o = people.people.find(x => x.visible && x.userData.realGlb && (x.userData.personAmount ?? 1) > .5); o.updateMatrixWorld(true); return o; }
function setup(o) {
    const id = o.userData.person.id, bones = o.userData.personRig.bones, rb = bones.get('hand_r');
    const inv = STATIC_T !== null ? new THREE.Matrix4().makeScale(1e-3, 1e-3, 1e-3) : rb.matrixWorld.clone().invert();
    const meshes = []; o.traverse(m => { if (m.isSkinnedMesh && m.visible) meshes.push(m); });
    if (STATIC_T !== null) { if (!sdfs.has('static')) { const t0 = Date.now(); sdfs.set('static', buildSdf(staticParts)); console.error('sdf static', ((Date.now() - t0) / 1000).toFixed(1) + 's'); } sdfs.set(id, sdfs.get('static')); }
    if (!sdfs.has(id)) {
        const parts = [];
        for (const m of meshes) {
            if (!/^Held\./.test([].concat(m.material)[0]?.name || '')) continue;
            const g = m.geometry, idx = g.index, P = [], T = [];
            for (let i = 0; i < g.attributes.position.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld).applyMatrix4(inv); P.push(V.toArray()); }
            for (let i = 0; i < (idx ? idx.count : P.length); i += 3) T.push([P[idx ? idx.getX(i) : i], P[idx ? idx.getX(i + 1) : i + 1], P[idx ? idx.getX(i + 2) : i + 2]]);
            parts.push(T);
        }
        const t0 = Date.now(); sdfs.set(id, buildSdf(parts)); console.error('sdf', id, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    const RE = /^(lowerarm|hand|thumb|index|middle|ring|pinky)\w*_([lr])$/, verts = [];
    for (const m of meshes) {
        const name = [].concat(m.material)[0]?.name || ''; if (/^Held\.|low-poly|eye|teeth|hair|brow|lash/.test(name)) continue;
        const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bs = m.skeleton.bones;
        for (let i = 0; i < g.attributes.position.count; i++) {
            let best = 0, bi = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; bi = si.getComponent(i, k); } }
            const r = RE.exec(bs[bi]?.name || ''); if (!r) continue; verts.push({ m, i, side: r[2], fing: r[1] !== 'lowerarm', bone: bs[bi].name, finger: /^(thumb|index|middle|ring|pinky)/.test(r[1]) ? r[1] + '_' + r[2] : null });
        }
    }
    return { id, bones, rb, inv, verts, sdf: sdfs.get(id), q0: new Map([...bones].map(([n, b]) => [n, b.quaternion.clone()])) };
}
function apply(S, th) {
    for (const [n, b] of S.bones) b.quaternion.copy(S.q0.get(n));
    PARAMS.forEach((p, k) => {
        const deg = th[k]; if (!deg) return; const r = THREE.MathUtils.degToRad(deg);
        if (p.b) { E.set(p.a === 'x' ? r : 0, p.a === 'y' ? r : 0, p.a === 'z' ? r : 0); S.bones.get(p.b).quaternion.multiply(Q.setFromEuler(E)); }
        else {
            const s = p.s || p.thumb, list = p.f ? [1, 2, 3].map(j => `${p.f}_0${j}_${s}`) : [`thumb_02_${s}`, `thumb_03_${s}`];
            for (const n of list) S.bones.get(n).quaternion.multiply(Q.setFromAxisAngle(V.set(...(bendAxis[n] || bendAxis.default)), r));
        }
    });
    for (const n of ['upperarm_l', STATIC_T !== null ? 'upperarm_r' : 'hand_r']) S.bones.get(n).updateMatrixWorld(true);
}
function measure(S) {   // signed distances (m): penalty, nearest finger/hand skin per side, the deepest vertex
    const out = { pen: 0, minL: 1, minR: 1, worst: 1, worstBone: '', fmin: {}, palmL: 1, palmR: 1 }, cache = new Map();
    for (const v of S.verts) {
        let M = cache.get(v.m); if (!M) { M = S.inv.clone().multiply(v.m.matrixWorld); cache.set(v.m, M); }
        v.m.getVertexPosition(v.i, V); V.applyMatrix4(M); const d = S.sdf.at(V.x, V.y, V.z);
        if (d < MARGIN) out.pen += (MARGIN - d) ** 2;
        if (d < out.worst) { out.worst = d; out.worstBone = v.bone; }
        if (v.fing) { if (v.side === 'l') out.minL = Math.min(out.minL, d); else out.minR = Math.min(out.minR, d); }
        if (v.finger) out.fmin[v.finger] = Math.min(out.fmin[v.finger] ?? 1, d); else if (/^hand_l/.test(v.bone)) out.palmL = Math.min(out.palmL, d); else if (/^hand_r/.test(v.bone)) out.palmR = Math.min(out.palmR, d);
    }
    return out;
}
function solve(S, init, prev, contactL, contactR, touching = []) {
    let th = init.slice();
    const cost = x => {
        apply(S, x); const m = measure(S); let c = m.pen * 4e7;
        if (contactL) c += Math.max(0, m.minL - CONTACT) ** 2 * 4e6;
        if (contactR) c += Math.max(0, m.minR - CONTACT) ** 2 * 4e6;
        for (const f of touching) c += Math.max(0, (m.fmin[f] ?? 1) - FCONTACT) ** 2 * 4e7;
        for (let k = 0; k < x.length; k++) c += 0.002 * x[k] ** 2 + (prev ? 0.01 * (x[k] - prev[k]) ** 2 : 0);
        return c;
    };
    let best = cost(th);
    for (const step of [8, 4, 2, 1, 0.5]) {
        let improved = true, guard = 0;
        while (improved && guard++ < 12) {
            improved = false;
            for (let k = 0; k < th.length; k++) for (const s of [step, -step]) { const x = th.slice(); x[k] += s; if (Math.abs(x[k]) > LIMIT(PARAMS[k])) continue; const c = cost(x); if (c < best - 1e-9) { best = c; th = x; improved = true; } }
        }
    }
    apply(S, th); return { th, m: measure(S) };
}
// the bend axis of each finger joint: the local unit axis that, turned +, brings the fingertip nearest the palm
function findBend(o) {
    const S = setup(o), out = {};
    for (const n of [...S.bones.keys()].filter(x => /^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(x) && !/thumb_01/.test(x))) {
        const b = S.bones.get(n), tip = S.bones.get(n.replace(/_0\d_/, '_03_')), palm = S.bones.get('hand_' + n.slice(-1)); let best = null;
        for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]]) {
            b.quaternion.copy(S.q0.get(n)).multiply(Q.setFromAxisAngle(V.set(...ax), 0.3)); b.updateMatrixWorld(true);
            const tp = (tip.children[0] || tip).getWorldPosition(new THREE.Vector3()), d = tp.distanceTo(palm.getWorldPosition(new THREE.Vector3()));
            if (!best || d < best.d) best = { d, ax };
        }
        b.quaternion.copy(S.q0.get(n)); b.updateMatrixWorld(true); out[n] = best.ax;
    }
    out.default = [0, 0, 1]; return out;
}
const results = [];
let prevTh = null, prevId = null;
if (STATIC_T !== null) {
    const o = current(STATIC_T); staticParts = [];
    o.traverse(m => { if (!m.isSkinnedMesh || !/^Held\./.test([].concat(m.material)[0]?.name || '')) return; const g = m.geometry, idx = g.index, P = [], T = [];
        for (let i = 0; i < g.attributes.position.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld).multiplyScalar(1e-3); P.push(V.toArray()); }
        for (let i = 0; i < (idx ? idx.count : P.length); i += 3) T.push([P[idx ? idx.getX(i) : i], P[idx ? idx.getX(i + 1) : i + 1], P[idx ? idx.getX(i + 2) : i + 2]]); staticParts.push(T); });
    console.error('static robot from', o.userData.person.id, staticParts.length, 'parts');
}
const NOTUNE = args.includes('--measure');
// --pin 1:0.983,2:1.983 : the key at the first time takes the extra turns solved at the second (a posture swap: the drawn
// base is continuous there, so equal turns keep the hands continuous); --init file.json: start from earlier results' turns
const PIN = new Map(String(flag('--pin', '')).split(',').filter(Boolean).map(x => x.split(':').map(Number)));
const INIT = flag('--init', null) ? JSON.parse(fs.readFileSync(flag('--init', null), 'utf8')).results : [];
const solvedTh = new Map();
for (const t of KEYS) {
    const o = current(t); if (!bendAxis) bendAxis = findBend(o);
    const S = setup(o), zero = PARAMS.map(() => 0); apply(S, zero); const m0 = measure(S);
    const contactL = STATIC_T === null && m0.minL < 0.006, contactR = STATIC_T === null && m0.minR < 0.006;
    const pinned = PIN.has(t) ? solvedTh.get(PIN.get(t)) || INIT.find(x => Math.abs(x.t - PIN.get(t)) < 1e-6)?.th : null;
    const r = pinned ? (apply(S, pinned), { th: pinned, m: measure(S) }) : NOTUNE ? (apply(S, zero), { th: zero, m: measure(S) }) : solve(S, prevTh && prevId === S.id ? prevTh : zero, prevId === S.id ? prevTh : null, contactL, contactR, Object.keys(m0.fmin).filter(f => m0.fmin[f] < FCONTACT));
    const turns = {}; for (const [n, b] of S.bones) { const d = S.q0.get(n).clone().invert().multiply(b.quaternion); if (1 - Math.abs(d.w) > 1e-7) turns[n] = d.toArray().map(x => +x.toFixed(5)); }
    apply(S, zero);
    const mm = x => +(x * 1000).toFixed(2);
    const row = { t, id: S.id, palm: { L: mm(m0.palmL) + '->' + mm(r.m.palmL), R: mm(m0.palmR) + '->' + mm(r.m.palmR) }, fingers: Object.fromEntries(Object.keys(m0.fmin).map(f => [f, mm(m0.fmin[f]) + '->' + mm(r.m.fmin[f])])), turns, before: { worst: mm(m0.worst), bone: m0.worstBone, minL: mm(m0.minL), minR: mm(m0.minR) }, after: { worst: mm(r.m.worst), bone: r.m.worstBone, minL: mm(r.m.minL), minR: mm(r.m.minR) }, th: r.th };
    results.push(row);
    console.log(t.toFixed(4), S.id.slice(13), 'worst', row.before.worst, row.before.bone, '->', row.after.worst, row.after.bone, 'mm; nearest L', row.before.minL, '->', row.after.minL, 'R', row.before.minR, '->', row.after.minR, 'max turn', Math.max(...r.th.map(Math.abs)).toFixed(1), 'palm', JSON.stringify(row.palm), JSON.stringify(row.fingers));
    solvedTh.set(t, r.th); prevTh = r.th; prevId = S.id;
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ PARAMS, bendAxis, results }, null, 1));
process.exit(0);
