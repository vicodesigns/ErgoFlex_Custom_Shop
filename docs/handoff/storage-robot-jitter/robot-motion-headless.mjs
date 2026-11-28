#!/usr/bin/env node
// Headless (CPU) check of the Robo-Pal Andre carries in Storage (ch 11): the production people code (room-people.mjs,
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
    const e = entries.get(id); if (!e?.file || !/people-andre-stand-robot/.test(id)) return null;
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

const v = new THREE.Vector3();
function sample(t) {
    const andre = people.people.filter(o => o.visible && (o.userData.personAmount ?? 1) > .02 && entries.get(o.userData.person.id)?.person?.character === 'andre' && o.userData.realGlb);
    const parts = new Map(), body = [], tris = [], handInv = [];
    for (const o of andre) {
        o.updateMatrixWorld(true);
        o.traverse(m => {
            if (!m.isSkinnedMesh || !m.visible) return;
            const name = [].concat(m.material)[0]?.name || '', held = /^Held\./.test(name), g = m.geometry, n = g.attributes.position.count;
            const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = (m.skeleton).bones;
            m.skeleton.update?.();
            const pts = new Array(n);
            for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); pts[i] = [v.x, v.y, v.z]; }
            if (held && !handInv.length) { const hb = (m.userData.heldOriginal || m.skeleton).bones.find(b => b.name === 'hand_r'); if (hb) { hb.updateMatrixWorld(true); handInv.push(hb.matrixWorld.clone().invert()); } }
            if (held) {
                const key = name + '@' + o.userData.person.id; parts.set(key, pts);
                const idx = g.index; for (let i = 0; i < (idx ? idx.count : n); i += 3) (tris[tris.length - 1]?.key === key ? tris[tris.length - 1] : (tris.push(Object.assign([], { key })), tris[tris.length - 1])).push([pts[idx ? idx.getX(i) : i], pts[idx ? idx.getX(i + 1) : i + 1], pts[idx ? idx.getX(i + 2) : i + 2]]);
            } else if (/body|shirt|low-poly/.test(name) && !/low-poly/.test(name)) {
                for (let i = 0; i < n; i++) { let best = 0, bi = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; bi = si.getComponent(i, k); } } body.push([...pts[i], bones[bi]?.name || '']); }
            }
        });
    }
    const hw = []; for (const o of andre) { const b = o.userData.personRig?.bones?.get('hand_r'); if (b) hw.push(b.getWorldPosition(new THREE.Vector3()).toArray().map(x => +x.toFixed(1))); }
    return { t, hw, obj: andre.map(o => [o.position.toArray().map(x => +x.toFixed(1)), +o.scale.x.toFixed(2)]), handInv: handInv[0], shown: andre.map(o => o.userData.person.id.replace('people-andre-', '') + ':' + (+(o.userData.personAmount ?? 1).toFixed(2))), parts, body, tris };
}
const rayHits = (p, dir, tris) => { let h = 0; for (const [a, b, d] of tris) { const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = d[0] - a[0], e2y = d[1] - a[1], e2z = d[2] - a[2]; const px = dir[1] * e2z - dir[2] * e2y, py = dir[2] * e2x - dir[0] * e2z, pz = dir[0] * e2y - dir[1] * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue; const inv = 1 / det, tx = p[0] - a[0], ty = p[1] - a[1], tz = p[2] - a[2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue; const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv; if (w < 0 || u + w > 1) continue; if ((e2x * qx + e2y * qy + e2z * qz) * inv > 0) h++; } return h; };
const D = [[1, .013, .007], [-.011, 1, .017], [.009, -.019, -1]];
const cen = pts => { const c = [0, 0, 0]; for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length; return c; };
// distance from p to triangle [a,b,c] (Ericson, closest point on triangle)
function triDist(p, [a, b, c]) {
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); let q;
    if (d1 <= 0 && d2 <= 0) q = a; else { const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
        if (d3 >= 0 && d4 <= d3) q = b; else { const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; } else { const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
                if (d6 >= 0 && d5 <= d6) q = c; else { const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; } else { const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
                        else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; } } } } } }
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rows = []; let prev = null; const handSteps = [];
for (let t = T0; t <= T1 + 1e-9; t += STEP) {
    if (people.pending.size) await people.settled();
    people.update(state(t));
    const s = sample(t), row = { t: +t.toFixed(4), shown: s.shown, hw: s.hw, obj: s.obj, parts: {}, step: {}, inside: 0, insideBy: {}, depthBy: {}, maxDepth: 0 };
    const all = []; for (const [k, pts] of s.parts) { const c = cen(pts), mat = k.split('@')[0].replace('Held.robo-pal ', 'm'); row.parts[mat] = (row.parts[mat] ? [row.parts[mat], c] : c); all.push(...pts); }
    if (all.length && s.handInv) { const c = new THREE.Vector3(...cen(all)).applyMatrix4(s.handInv); row.inHand = c.toArray().map(x => +x.toFixed(2)); }
    if (all.length) {
        const min = [1e18, 1e18, 1e18], max = [-1e18, -1e18, -1e18]; for (const p of all) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
        // gap: how near each hand comes to the robot's surface (mm; left / right hand and finger skin outside the robot)
        const gap = { l: 1e9, r: 1e9 }, pad = 40;
        for (const p of s.body) { const side = /^(hand|thumb|index|middle|ring|pinky)\w*_([lr])$/.exec(p[3])?.[2]; if (!side) continue; if (p[0] < min[0] - pad || p[1] < min[1] - pad || p[2] < min[2] - pad || p[0] > max[0] + pad || p[1] > max[1] + pad || p[2] > max[2] + pad) continue; for (const pt of s.tris) for (const tr of pt) { const d = triDist(p, tr); if (d < gap[side]) gap[side] = d; } }
        row.gapL = +gap.l.toFixed(1); row.gapR = +gap.r.toFixed(1);
        for (const p of s.body) {
            if (p[0] < min[0] || p[1] < min[1] || p[2] < min[2] || p[0] > max[0] || p[1] > max[1] || p[2] > max[2]) continue;
            if (!s.tris.some(pt => { let odd = 0; for (const d of D) odd += rayHits(p, d, pt) & 1; return odd >= 2; })) continue;
            row.inside++; row.insideBy[p[3]] = (row.insideBy[p[3]] || 0) + 1;
            let b = 1e18; for (const pt of s.tris) for (const tr of pt) b = Math.min(b, triDist(p, tr)); row.maxDepth = Math.max(row.maxDepth, b); row.depthBy[p[3]] = Math.max(row.depthBy[p[3]] || 0, +b.toFixed(1));   // depth: distance to the robot's nearest surface
        }
        row.maxDepth = +row.maxDepth.toFixed(1);
    }
    if (prev) for (const k of Object.keys(row.parts)) if (prev.parts[k] && !Array.isArray(row.parts[k][0]) && !Array.isArray(prev.parts[k][0])) row.step[k] = +dist(row.parts[k], prev.parts[k]).toFixed(2);
    for (const k of Object.keys(row.parts)) row.parts[k] = Array.isArray(row.parts[k][0]) ? 'TWO COPIES' : row.parts[k].map(x => +x.toFixed(1));
    if (prev?.inHand && row.inHand) handSteps.push({ t: row.t, d: +dist(prev.inHand, row.inHand).toFixed(3), keys: prev.shown[0] + '>' + row.shown[0] });
    rows.push(row); prev = row;
}
console.warn = warn;
const out = flag('--out', null); if (out) fs.writeFileSync(out, JSON.stringify(rows));
// summary: largest per-sample part step, largest change of step (jerk = direction change), two copies, worst inside
const steps = []; for (let i = 1; i < rows.length; i++) for (const [k, s] of Object.entries(rows[i].step)) { const p = rows[i - 1].step[k]; steps.push({ t: rows[i].t, k, s, ds: p == null ? 0 : Math.abs(s - p) }); }
const top = (a, f, n = 6) => [...a].sort((x, y) => f(y) - f(x)).slice(0, n);
console.log('samples', rows.length, 'step', STEP.toFixed(5), 's; two copies of a part at', rows.filter(r => Object.values(r.parts).includes('TWO COPIES')).map(r => r.t).join(',') || 'none');
console.log('largest part steps (mm/sample):', top(steps, x => x.s).map(x => `${x.k} ${x.s}@${x.t}`).join('  '));
console.log('largest step changes (mm):', top(steps, x => x.ds).map(x => `${x.k} ${x.ds.toFixed(2)}@${x.t}`).join('  '));
console.log('largest steps of the robot in the hand_r bone frame (bone units):', top(handSteps, x => x.d).map(x => `${x.d}@${x.t} ${x.keys}`).join('  '));
const ins = rows.filter(r => r.inside); console.log('samples with Andre skin inside the robot:', ins.length, '/', rows.filter(r => Object.keys(r.parts).length).length);
for (const r of top(rows, r => r.maxDepth, 8)) console.log('  t', r.t, r.shown.join(' '), 'inside', r.inside, 'depth', r.maxDepth, 'mm', JSON.stringify(r.depthBy));
process.exit(0);
