// Keyboard tray rig v3 (docs/keyboard-tray/SPEC.md 0.6): VICO'S OWN MODEL of his real tray (Rhino, 25 Nov 2026), split at his parts.
//
//   node tools/props/tray-rig-v3.mjs [source.glb]
//       reads  docs/reference/keyboard-tray-real-20261125/vico-model/Keyboard_Tray.glb (branch director/tray-photos-1125; or the path given)
//       writes assets/props/ergoflex-keyboard-tray-rig-v3.glb       (v1 and v2 are kept)
//
// His file holds 7 copies of the tray (18 parts each) in 7 poses, in INCHES, Rhino Z up (the glb is Y up, glb Z = -Rhino Y), no names.
// The rig takes the copy of his pose P0 ("pulled out": the rear bracket at the front end of the top plate, the arm level, the platform
// level), node by node, and only re-expresses it: inches -> mm -> the glb's metres, his axes -> ours, and each part's vertices relative
// to the pivot it hangs from. Same vertices, same triangles, same normals and UVs as his P0 parts; nothing reshaped, filled or removed
// (his zero-thickness duplicate faces on the three webs are kept too). The build stops if a node is not the part it should be.
//
// Frames. Ours is the track frame of tray-limits.mjs: u across (u = -his x, so the frame stays right-handed), y up (0 = the desktop
// underside, the supplied tray's track top), w toward the user, mm. ALIGNMENT (Vico, 26 Nov 2026: "the tray must start where it is
// today"): his platform at rest lands exactly where the supplied tray's plate is (its centre u -9.65, w 214.89 and its top 19.70 mm under
// the desktop, measured on rig v1's Tray_Plate), so the keyboard and mouse stay where they are. His top plate then hangs 7.23 mm under
// the desktop underside (his platform is 12.47 mm under his plate, the supplied one 19.70 under the desktop): a gap we show, not hide.
// glTF: the track frame turned by the supplied tray's 7.43 deg skew (node Tray_Mount), metres (the stage scales props x1000).
//
// Nodes (every pivot has an identity rotation in the mount's frame, so local X = the bolts' axis, Y = up, Z = the track):
//   Tray (root) > Tray_Mount (skew; the top plate, fixed) > Tray_Slide (slide along Z) > Tray_Swing (vertical, at the bracket's top centre)
//     > [bracket parts] + Tray_BaseTilt (the bracket's upper bolt) > [arm parts, front bolts] + Tray_SurfaceTilt (the upper front bolt)
//     > [front plates, web, Tray_Plate (the platform)]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE = 'docs/reference/keyboard-tray-real-20261125/vico-model/Keyboard_Tray.glb';
export const SOURCE_SHA256 = 'ac24c90bd1f1a57c8d6b323041e508746b861142e20b42becfd4ee49574683f0';
export const OUT = 'assets/props/ergoflex-keyboard-tray-rig-v3.glb';
const IN = 25.4, SKEW_DEG = 7.43;
export const OLD_PLATE = Object.freeze({ u: -9.65, w: 214.89, top: -19.70 });          // the supplied tray's plate (rig v1 Tray_Plate), track frame mm
// His P0 platform, measured (inches, Rhino, bounding box): x and y centre, top z.
export const P0_PLATFORM = Object.freeze({ x: 24.4470, y: -128.1180, z: 40.0199 });
export const toTrack = ([x, y, z]) => [OLD_PLATE.u - (x - P0_PLATFORM.x) * IN, OLD_PLATE.top + (z - P0_PLATFORM.z) * IN, OLD_PLATE.w + (y - P0_PLATFORM.y) * IN];
export const MOUNT_GAP_MM = -toTrack([0, 0, 40.5110])[1];      // his top plate's top (z 40.5110 in) under the desktop underside: 7.23 mm

// The pivots, track frame mm, measured on his P0 parts (bounding-box centres, inches): the bolts' centre lines (y, w; u = the platform's
// centre line, the axis runs across) and the rear bracket web's centre for the swing (the real unit's swivel disc; not modelled).
const at = (x, y, z) => toTrack([x, y, z]).map(v => Math.round(v * 100) / 100);
export const PIVOTS = Object.freeze({
    Tray_Slide: at(24.4430, -136.8461, 40.5110),
    Tray_Swing: at(24.4430, -136.8461, 40.5110),
    Tray_BaseTilt: [OLD_PLATE.u, ...at(0, -135.6218, 38.9616).slice(1)],     // node 32: the bracket's upper bolt, the arm turns on it
    Tray_SurfaceTilt: [OLD_PLATE.u, ...at(0, -131.3396, 38.9255).slice(1)],  // node 30: the arm's upper front bolt; the arc slot is round it
});
// His P0 nodes (glb node index), what each is, the pivot it hangs from, and its vertex count (the check that it is that part).
export const PARTS = Object.freeze([
    { node: 18, name: 'Tray_MountPlate', parent: 'Tray_Mount', verts: 82 },          // the top plate (to the desktop underside), fixed
    { node: 24, name: 'Tray_Bracket_L', parent: 'Tray_Swing', verts: 721 },          // rear L-bracket side plates (_L = the user's left, -u: his x 26.4 in; _R his x 22.5)
    { node: 25, name: 'Tray_Bracket_R', parent: 'Tray_Swing', verts: 721 },
    { node: 28, name: 'Tray_BracketWeb', parent: 'Tray_Swing', verts: 190 },
    { node: 29, name: 'Tray_BracketWebFace', parent: 'Tray_Swing', verts: 25 },      // a zero-thickness face lying on the web (his duplicate)
    { node: 32, name: 'Tray_Bolt_RearUpper', parent: 'Tray_Swing', verts: 258 },     // the base tilt's bolt
    { node: 31, name: 'Tray_Bolt_RearLower', parent: 'Tray_Swing', verts: 258 },
    { node: 20, name: 'Tray_Arm_L', parent: 'Tray_BaseTilt', verts: 460 },
    { node: 19, name: 'Tray_Arm_R', parent: 'Tray_BaseTilt', verts: 484 },
    { node: 26, name: 'Tray_ArmWeb', parent: 'Tray_BaseTilt', verts: 190 },
    { node: 27, name: 'Tray_ArmWebFace', parent: 'Tray_BaseTilt', verts: 25 },
    { node: 30, name: 'Tray_Bolt_FrontUpper', parent: 'Tray_BaseTilt', verts: 258 },  // the surface tilt's bolt
    { node: 21, name: 'Tray_Bolt_FrontKnob', parent: 'Tray_BaseTilt', verts: 258 },   // the lock knob's bolt, in the front plates' arc slot
    { node: 23, name: 'Tray_Front_R', parent: 'Tray_SurfaceTilt', verts: 746 },
    { node: 22, name: 'Tray_Front_L', parent: 'Tray_SurfaceTilt', verts: 746 },
    { node: 34, name: 'Tray_FrontWeb', parent: 'Tray_SurfaceTilt', verts: 174 },
    { node: 35, name: 'Tray_FrontWebFace', parent: 'Tray_SurfaceTilt', verts: 25 },
    { node: 33, name: 'Tray_Plate', parent: 'Tray_SurfaceTilt', verts: 82 },         // the platform (the riders' frame)
]);
const PARENT = { Tray_Mount: 'Tray', Tray_Slide: 'Tray_Mount', Tray_Swing: 'Tray_Slide', Tray_BaseTilt: 'Tray_Swing', Tray_SurfaceTilt: 'Tray_BaseTilt' };

export async function readSource(file) {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
    const doc = await io.read(file);
    // per node: positions in Rhino inches (Z up), normals in Rhino axes, uvs, indices (primitives concatenated, as one part)
    return doc.getRoot().listNodes().map(n => {
        const P = [], N = [], UV = [], T = []; let base = 0;
        for (const prim of n.getMesh().listPrimitives()) {
            const p = prim.getAttribute('POSITION').getArray(), nn = prim.getAttribute('NORMAL').getArray(), uv = prim.getAttribute('TEXCOORD_0')?.getArray(), idx = prim.getIndices().getArray();
            for (let i = 0; i < p.length; i += 3) { P.push(p[i], -p[i + 2], p[i + 1]); N.push(nn[i], -nn[i + 2], nn[i + 1]); }
            for (let i = 0; i < p.length / 3; i++) UV.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0);
            for (const k of idx) T.push(k + base); base += p.length / 3;
        }
        return { P, N, UV, T };
    });
}
const sk = SKEW_DEG * Math.PI / 180;
export async function build({ source = path.join(root, SOURCE), out = path.join(root, OUT) } = {}) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    if (sha !== SOURCE_SHA256) throw Error(`not Vico's model of 25 Nov 2026 (sha256 ${sha.slice(0, 16)}): update PARTS / P0_FRAME by hand first`);
    const src = await readSource(source);
    const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('Scene');
    const mat = doc.createMaterial('Tray_Black').setBaseColorFactor([0, 0, 0, 1]).setMetallicFactor(1).setRoughnessFactor(1);
    const nodes = { Tray: doc.createNode('Tray') }; scene.addChild(nodes.Tray);
    // world (in the mount) position of each pivot, mm
    const at = { Tray_Mount: [0, 0, 0], ...PIVOTS };
    for (const name of ['Tray_Mount', 'Tray_Slide', 'Tray_Swing', 'Tray_BaseTilt', 'Tray_SurfaceTilt']) {
        const n = doc.createNode(name), parent = PARENT[name];
        if (name === 'Tray_Mount') n.setRotation([0, Math.sin(-sk / 2), 0, Math.cos(-sk / 2)]);
        else { const a = at[name], b = at[parent]; n.setTranslation([0, 1, 2].map(i => (a[i] - b[i]) / 1000)); }
        nodes[parent].addChild(n); nodes[name] = n;
    }
    const used = new Set();
    for (const part of PARTS) {
        const s = src[part.node]; if (!s || s.P.length / 3 !== part.verts) throw Error(`node ${part.node} is not ${part.name} (${s ? s.P.length / 3 : 0} vertices, ${part.verts} expected)`);
        if (used.has(part.node)) throw Error('node twice'); used.add(part.node);
        const pv = at[part.parent], n = s.P.length / 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const t = toTrack([s.P[i * 3], s.P[i * 3 + 1], s.P[i * 3 + 2]]);
            P.set([(t[0] - pv[0]) / 1000, (t[1] - pv[1]) / 1000, (t[2] - pv[2]) / 1000], i * 3);
            N.set([-s.N[i * 3], s.N[i * 3 + 2], s.N[i * 3 + 1]], i * 3);            // (x, y, z) Rhino -> (u, y, w) = (-x, z, y)
        }
        const prim = doc.createPrimitive().setMaterial(mat)
            .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
            .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
            .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(s.UV)).setBuffer(buffer))
            .setIndices(doc.createAccessor().setType('SCALAR').setArray(n > 65535 ? new Uint32Array(s.T) : new Uint16Array(s.T)).setBuffer(buffer));
        const node = doc.createNode(part.name).setMesh(doc.createMesh(part.name).addPrimitive(prim));
        nodes[part.parent].addChild(node);
    }
    doc.getRoot().getAsset().generator = 'ErgoFlex tools/props/tray-rig-v3.mjs';
    await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(out, doc);
    return { out: path.relative(root, out), bytes: fs.statSync(out).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex') };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(JSON.stringify(await build(process.argv[2] ? { source: path.resolve(process.argv[2]) } : {})));
