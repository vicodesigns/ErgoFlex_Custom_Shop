// Keyboard tray rig v2 (docs/keyboard-tray/SPEC.md 0.5): the supplied tray's ARM and FRONT PIN made to match Vico's real unit (his profile
// photos of 25 Nov 2026; option B+ he chose). Vico lifted the "never change the supplied model" rule for this purpose only.
//
//   node tools/props/tray-rig-v2.mjs        reads  assets/props/ergoflex-keyboard-tray-rig.glb (v1: the supplied model only split; kept)
//                                           writes assets/props/ergoflex-keyboard-tray-rig-v2.glb
//
// The track's frame: u across, y up from the track top (= the desktop underside), w along the track toward the user; mm.
//   * Tray_Links (the arm): ARM_MM bolt to bolt instead of 120 (cut in its straight middle, the front half moved back along it; both eyes
//     unchanged), then placed: its rear eye on the rear bolt (moved, below), its front eye on the forks' pin (moved, below).
//   * Tray_Forks: the pin piece and the rod across it (the arm's front bolt) PIN_UP_MM higher on the forks plate: the real front plate
//     carries the platform that much lower under its bolt (23 mm instead of the CAD's 50).
//   * Tray_Carriage (the rear bracket): its two bolts with their rods BOLTS_FWD_MM further forward, and the front of its hanging side
//     plates stretched forward with them, so the platform stays EXACTLY where the supplied model has it at rest (Vico's photos cannot tell
//     the platform's fore-aft place under the desk; today's is kept, so no chapter's platform or keyboard moves).
//   * Nothing else: track, slide block, guide rails, forks plate, cross-bar, knob, screw, plate; same triangles, same material.
// The platform group (Tray_Tilt) does not move at all; the arm's rest angle is ARM_REST_DEG down (the supplied model's: 22.5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ARM_MM = 75, PIN_UP_MM = 27;
export const REAR_BOLT = [-10, -23.85, 8.75], FORK_PIN = [-10, -69.7, 119.45];      // v1 (the supplied model), measured pin centres
const SK = 7.43 * Math.PI / 180, c = Math.cos(SK), s = Math.sin(SK);
const L = Math.hypot(FORK_PIN[1] - REAR_BOLT[1], FORK_PIN[2] - REAR_BOLT[2]), DIR = [0, (FORK_PIN[1] - REAR_BOLT[1]) / L, (FORK_PIN[2] - REAR_BOLT[2]) / L];
export const FRONT_BOLT = [FORK_PIN[0], FORK_PIN[1] + PIN_UP_MM, FORK_PIN[2]];                              // the new pin: the platform group stays put
const restDown = Math.asin((REAR_BOLT[1] - FRONT_BOLT[1]) / ARM_MM);                                          // the arm's slope at rest, the rear bolt at its height
export const REAR_BOLT_V2 = [REAR_BOLT[0], REAR_BOLT[1], FRONT_BOLT[2] - ARM_MM * Math.cos(restDown)];
export const BOLTS_FWD_MM = REAR_BOLT_V2[2] - REAR_BOLT[2], ARM_REST_DEG = restDown * 180 / Math.PI;
const oldDown = Math.atan2(REAR_BOLT[1] - FORK_PIN[1], FORK_PIN[2] - REAR_BOLT[2]);

const toTrack = p => [(p[0] * c + p[2] * s) * 1000, p[1] * 1000, (-p[0] * s + p[2] * c) * 1000];
const toWorld = t => [(t[0] * c - t[2] * s) / 1000, t[1] / 1000, (t[0] * s + t[2] * c) / 1000];
const mul = (m, p) => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
const dirMul = (m, p) => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2]);
function invert(m) {
    const inv = new Array(16), [a, b, cc, d, e, f, g, h, i, j, k, l, mm, n, o, p] = m;
    inv[0] = f * k * p - f * l * o - j * g * p + j * h * o + n * g * l - n * h * k; inv[4] = -e * k * p + e * l * o + i * g * p - i * h * o - mm * g * l + mm * h * k; inv[8] = e * j * p - e * l * n - i * f * p + i * h * n + mm * f * l - mm * h * j; inv[12] = -e * j * o + e * k * n + i * f * o - i * g * n - mm * f * k + mm * g * j;
    inv[1] = -b * k * p + b * l * o + j * cc * p - j * d * o - n * cc * l + n * d * k; inv[5] = a * k * p - a * l * o - i * cc * p + i * d * o + mm * cc * l - mm * d * k; inv[9] = -a * j * p + a * l * n + i * b * p - i * d * n - mm * b * l + mm * d * j; inv[13] = a * j * o - a * k * n - i * b * o + i * cc * n + mm * b * k - mm * cc * j;
    inv[2] = b * g * p - b * h * o - f * cc * p + f * d * o + n * cc * h - n * d * g; inv[6] = -a * g * p + a * h * o + e * cc * p - e * d * o - mm * cc * h + mm * d * g; inv[10] = a * f * p - a * h * n - e * b * p + e * d * n + mm * b * h - mm * d * f; inv[14] = -a * f * o + a * g * n + e * b * o - e * cc * n - mm * b * g + mm * cc * f;
    inv[3] = -b * g * l + b * h * k + f * cc * l - f * d * k - j * cc * h + j * d * g; inv[7] = a * g * l - a * h * k - e * cc * l + e * d * k + i * cc * h - i * d * g; inv[11] = -a * f * l + a * h * j + e * b * l - e * d * j - i * b * h + i * d * f; inv[15] = a * f * k - a * g * j - e * b * k + e * cc * j + i * b * g - i * cc * f;
    const det = a * inv[0] + b * inv[4] + cc * inv[8] + d * inv[12]; return inv.map(v => v / det);
}
// a point (and a direction) of the arm, track frame: shortened, turned about the old rear bolt from the old slope to the new, moved to the new bolt
const turnA = oldDown - restDown;     // + = the arm's front up
const turn = ([u, y, w], aboutY, aboutW) => { const dy = y - aboutY, dw = w - aboutW, ca = Math.cos(turnA), sa = Math.sin(turnA); return [u, aboutY + dy * ca + dw * sa, aboutW - dy * sa + dw * ca]; };
function armPoint(t) {
    const rel = [t[0], t[1], t[2]], along = (t[1] - REAR_BOLT[1]) * DIR[1] + (t[2] - REAR_BOLT[2]) * DIR[2];
    if (along > L / 2) { rel[1] -= (L - ARM_MM) * DIR[1]; rel[2] -= (L - ARM_MM) * DIR[2]; }
    const r = turn(rel, REAR_BOLT[1], REAR_BOLT[2]); return [r[0], r[1], r[2] + BOLTS_FWD_MM];
}
const armDir = t => turn(t, 0, 0);
// the rear bracket: the bolts and rods (small pieces round the two bolts) move whole; the hanging side plates stretch forward over FWD_RAMP
const FWD_RAMP = [-45, -12], inBolt = t => t[1] < -12 && t[1] > -56 && t[2] > -12 && t[2] < 20 && (Math.abs(t[0] + 56.45) < 5 || Math.abs(t[0] - 36.45) < 5 || Math.abs(t[0] + 10) < 49);
const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export async function build({ out = path.join(root, 'assets/props/ergoflex-keyboard-tray-rig-v2.glb') } = {}) {
    await MeshoptDecoder.ready; await MeshoptEncoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
    const doc = await io.read(path.join(root, 'assets/props/ergoflex-keyboard-tray-rig.glb'));
    const nodes = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
    function edit(name, point, normal = null, piece = null) {
        const nd = nodes.get(name), W = nd.getWorldMatrix(), Wi = invert(W);
        for (const prim of nd.getMesh().listPrimitives()) {
            const pa = prim.getAttribute('POSITION'), na = prim.getAttribute('NORMAL'), n = pa.getCount(), P = new Float32Array(n * 3), N = new Float32Array(n * 3), v = [0, 0, 0];
            // pieces: vertices welded by position into connected parts (so a bolt moves whole)
            const tr = []; for (let i = 0; i < n; i++) { pa.getElement(i, v); tr.push(toTrack(mul(W, v))); }
            const group = piece ? piece(prim, tr) : null;
            for (let i = 0; i < n; i++) {
                P.set(mul(Wi, toWorld(point(tr[i], group?.[i]))), i * 3);
                na.getElement(i, v); let nn = [...v];
                if (normal) { const wn = dirMul(W, v), t = toTrack(wn).map(x => x / 1000), r = normal(t), back = toWorld(r).map(x => x * 1000), ln = dirMul(Wi, back), len = Math.hypot(...ln); nn = ln.map(x => x / len); }
                N.set(nn, i * 3);
            }
            prim.setAttribute('POSITION', doc.createAccessor(pa.getName()).setType('VEC3').setArray(P).setBuffer(pa.getBuffer()));
            if (normal) prim.setAttribute('NORMAL', doc.createAccessor(na.getName()).setType('VEC3').setArray(N).setBuffer(na.getBuffer()));
        }
    }
    // connected pieces of a primitive (by shared indices and welded positions): the pieces wholly near the bolts are the bolts and rods
    const pieces = (prim, tr) => {
        const n = tr.length, par = [...Array(n).keys()], f = x => par[x] === x ? x : (par[x] = f(par[x])), key = t => t.map(q => Math.round(q * 20)).join(','), seen = new Map();
        for (let i = 0; i < n; i++) { const k = key(tr[i]); if (seen.has(k)) par[f(i)] = f(seen.get(k)); else seen.set(k, i); }
        const idx = prim.getIndices(); for (let i = 0; i < idx.getCount(); i += 3) { const a = idx.getScalar(i), b = idx.getScalar(i + 1), d = idx.getScalar(i + 2); par[f(a)] = f(b); par[f(b)] = f(d); }
        const members = new Map(); for (let i = 0; i < n; i++) { const r = f(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
        const bolt = new Array(n).fill(false);
        for (const list of members.values()) if (list.length < 1000 && list.every(i => inBolt(tr[i]))) for (const i of list) bolt[i] = true;
        return bolt;
    };
    edit('Tray_Carriage', (t, bolt) => {
        if (bolt) return [t[0], t[1], t[2] + BOLTS_FWD_MM];
        if (t[1] >= -12) return t;
        return [t[0], t[1], t[2] + BOLTS_FWD_MM * smooth((t[2] - FWD_RAMP[0]) / (FWD_RAMP[1] - FWD_RAMP[0]))];
    }, null, pieces);
    edit('Tray_Links', armPoint, armDir);
    edit('Tray_Forks', t => (t[1] > -77 && t[1] < -62 && t[2] > 111 && t[2] < 127) ? [t[0], t[1] + PIN_UP_MM, t[2]] : t);
    await io.write(out, doc);
    return { out: path.relative(root, out), bytes: fs.statSync(out).size };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const r = await build();
    console.log(JSON.stringify({ ...r, ARM_MM, PIN_UP_MM, BOLTS_FWD_MM: +BOLTS_FWD_MM.toFixed(2), ARM_REST_DEG: +ARM_REST_DEG.toFixed(2), REAR_BOLT_V2: REAR_BOLT_V2.map(v => +v.toFixed(2)), FRONT_BOLT }));
}
