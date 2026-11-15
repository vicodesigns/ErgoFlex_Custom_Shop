#!/usr/bin/env node
// One solid figure at every frame: an audit of the film's people for ghosting (S20).
//
// A ghost is one character visible as two models at once: two placements of the same person (two postures, or the
// desk user and a placement of them elsewhere) handed over by a fade, so for a moment both are there, each half see-
// through (the workshop's Andre turning from the shelf at storage 3.0 s, Maya at the gym's desk while she stretches).
// Every change of posture must go through the skeleton blend instead (room-people.mjs: pairUp / sameSpot / readyChange
// / changing, solveChange; a step out from the desk: fromDesk, stepOuts), which keeps one whole model at every frame.
//
// This runs each chapter of a cut through the production people code (room-people.mjs, room-people-motion.mjs) in node,
// as tests/room-people-motion-test.mjs does: box models with the real skeletons and bone data, the chapter's people
// filter (only/except/cast/when/place/chair), its desk track and dayparts. It waits for the skeletons as the film's
// export does (settled()), then samples every `step` seconds and counts, per character, the models drawn with more
// than `threshold` of their opacity. Every interval where a character is two (or more) models is reported with the two
// placement keys and why they were not one change of posture.
//
//   node tools/experience/people-ghost-audit.mjs [cut.json] [--chapter id] [--step .05] [--no-rigs] [--json]
//
// --no-rigs: as the people are before any skeleton has loaded (library without bone data): the old dissolves.
// A placement with `ghostOk: "<why>"` is a deliberate exception: its intervals are listed as exempt, not as ghosts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { RoomPeople, castEntries } from '../../room-people.mjs';
import { sampleClipMotion } from '../../experience/desk-clips.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CUT = path.join(root, 'exports/cinematic-intro-cut-cine/review-cut.json');
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8'));
const entries = new Map(index.props.map(p => [p.id, p]));
const rigFiles = new Map();
const dataOf = who => { if (!rigFiles.has(who)) { const f = path.join(root, 'assets/props/people-rigs', who + '.json'); rigFiles.set(who, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null); } return rigFiles.get(who); };

// The model library, headless: a box for each model (with a material of its own, so fades are counted), the real
// skeleton and bone data (tests/room-people-motion-test.mjs).
export function library({ rigs = true } = {}) {
    const plain = async id => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), new THREE.MeshStandardMaterial())); g.scale.setScalar(1000); g.userData.propId = id; return g; };
    const lib = { loadIndex: async () => index, entry: id => entries.get(id) || null, instance: plain };
    if (!rigs) return lib;
    lib.rigData = async who => { const d = dataOf(who); if (!d) throw Error('no rig file for ' + who); return d; };
    lib.rigInstance = async id => {
        const data = dataOf(entries.get(id)?.person?.character); if (!data?.postures?.[id]) return null;
        const g = await plain(id), bones = data.bones.map(name => { const b = new THREE.Bone(); b.name = name; return b; });
        data.bones.forEach((name, i) => { (data.parents[i] < 0 ? g : bones[data.parents[i]]).add(bones[i]); bones[i].position.fromArray(data.offsets, i * 3); bones[i].quaternion.fromArray(data.postures[id].q, i * 4); });
        bones[data.bones.indexOf('Root')].position.fromArray(data.postures[id].root); bones[data.bones.indexOf('pelvis')].position.fromArray(data.postures[id].pelvis);
        return g;
    };
    return lib;
}

// The room, headless: a stand-in for every piece of furniture a placement is put on, by or around (each its own spot),
// so placements that share a seat share its spot as they do in the real room.
export function makeRoom(id, layout, specs) {
    const group = new THREE.Group(), wanted = new Map();
    for (const s of specs) for (const ref of [s.on, s.by, s.around && s.around[0], s.toward].filter(Boolean)) for (const r of [].concat(ref)) {
        if (typeof r !== 'string') continue; const n = Array.isArray(s.on || s.by) ? (s.on || s.by)[1] || 0 : 0; wanted.set(r, Math.max(wanted.get(r) ?? 0, n));
    }
    let k = 0;
    for (const [prop, n] of wanted) for (let i = 0; i <= n; i++, k++) {
        const o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.BoxGeometry(500, 450, 500))); o.userData.propId = prop; o.position.set(-6000 + (k % 8) * 1500, 0, -6000 + Math.floor(k / 8) * 1500); group.add(o);
    }
    return { id, root: group, token: 1, ready: Promise.resolve(), roomLayout: { id: layout }, assets: () => group.children.filter(o => o.userData.propId && !String(o.name).startsWith('Person')), peopleState: null };
}

const characterOf = id => entries.get(id)?.person?.character || null;
const modeAt = (shot, t) => { const list = Array.isArray(shot.timeOfDay) ? shot.timeOfDay : null; if (!list) return shot.mode || 'morning'; let m = list[0]?.mode || shot.mode || 'morning'; for (const k of list) if (k.at <= t) m = k.mode; return m; };
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

// One chapter: { id, room, seconds, ghosts: [{ character, from, to, keys, worst, why }], exempt: [...] }
const PARTS = ['head', 'hand_l', 'hand_r'];
// JUMP: the most a head or hand may move in one 1/120 s sub-frame (mm). A brisk walk is 1.5-2 m/s (13-17 mm); a hand
// reaching or swinging peaks near 3 m/s (25 mm); a turn in place carries the head and hands round at about as much.
// 40 mm (4.8 m/s) is well above anything a person does in the film and well below a pop (a snap of 17 deg moves a
// hand at arm's length about 150 mm).
export const JUMP = 40;
export async function auditChapter(shot, { step = 1 / 120, threshold = .02, rigs = true, jump = JUMP } = {}) {
    const filter = shot.people && typeof shot.people === 'object' ? shot.people : null; if (!filter) return null;
    const layout = shot.layout || 'house', specs = [...castEntries(shot.room, layout), ...(filter.cast || [])];
    const room = makeRoom(shot.room, layout, specs), people = new RoomPeople(room, library({ rigs }));
    const seconds = shot.seconds, motion = shot.motion?.clips ? shot.motion : null;
    const deskAt = s => motion ? sampleClipMotion(motion, Math.min(seconds, Math.max(0, s))) : { height: 28, tilt: 0 };
    const track = { seconds, heightAt: s => deskAt(s).height, tiltAt: s => deskAt(s).tilt || 0 };
    const pose = { x: 0, z: 0, yaw: 0 }, keyboard = { x: 0, z: 260 };
    const state = t => ({ height: deskAt(t).height, tilt: deskAt(t).tilt || 0, mode: modeAt(shot, t), pose, keyboard, time: t, track, target: null, now: 0 });
    room.peopleState = () => state(0);
    const was = globalThis.__ERGO_PRESENTATION__; globalThis.__ERGO_PRESENTATION__ = true;
    const warn = console.warn; console.warn = () => {};
    try {
        people.setFilter(filter); await people.setEnabled(true);
        // the film's warm-up: the skeletons, the changes of posture and the lives that come with them, before any frame is kept
        // the grid, and every edge of every `when` window exactly and a render sub-frame (1/240 s) either side of it: a
        // film frame (30 fps; 120 Hz with --blur 4) can fall on an edge, where a cut with no fade has both placements in full
        const grid = []; for (let t = 0; t <= seconds + 1e-6; t += step) grid.push(round(t, 4));
        const edges = Object.values(filter.when || {}).flat().flatMap(([t0, t1]) => [t0, t1]).filter(t => t >= 0 && t <= seconds);
        const fine = edges.flatMap(e => [e - 1 / 240, e, e + 1 / 240]).filter(t => t >= 0 && t <= seconds).map(t => round(t, 5));
        const times = [...new Set([...grid, ...fine])].sort((a, b) => a - b);
        for (let pass = 0; pass < 3; pass++) { for (const t of times) people.update(state(t)); await people.settled(); await new Promise(r => setTimeout(r, 5)); if (!people.pending.size && pass) break; }
        const samples = [], heads = new Map(), pops = [], moves = new Map();
        for (const t of times) {
            people.update(state(t));
            const by = new Map();
            for (const o of people.people) {
                if (!o.visible) continue; const amount = o.userData.personAmount ?? 1; if (amount <= threshold) continue;
                const who = characterOf(o.userData.person.id); if (!who) continue;
                if (!by.has(who)) by.set(who, []); by.get(who).push({ key: people.keyOf(o.userData.person), id: o.userData.person.id, amount, o });
            }
            for (const [who, list] of by) if (list.length > 1) samples.push({ t, who, list });
            // continuity: the head and hands of one figure between consecutive render sub-frames (1/120 s; the film
            // renders 4 sub-frames a frame and blends two of them, so a jump between two sub-frames reads as a double
            // image too: two poses in one frame). Per 1/120 s; a jump over `jump` mm is a pop.
            for (const [who, list] of by) {
                const o = list.length === 1 ? list[0].o : null, bones = o?.userData.personRig?.bones; if (!bones?.get('head')) { heads.delete(who); continue; }
                o.updateMatrixWorld(true); const at = PARTS.map(n => bones.get(n)?.getWorldPosition(new THREE.Vector3()) || null), last = heads.get(who);
                if (last && t - last.t <= 1 / 120 + 1e-6) {
                    const scale = (1 / 120) / (t - last.t), d = PARTS.map((n, i) => at[i] && last.at[i] ? at[i].distanceTo(last.at[i]) * scale : 0), i = d.indexOf(Math.max(...d));
                    const m = moves.get(who) || { mm: 0 }; if (d[i] > m.mm) moves.set(who, { mm: Math.round(d[i]), part: PARTS[i], at: round(t, 4), key: list[0].key });
                    if (d[i] > jump) pops.push({ character: who, from: round(last.t, 4), to: round(t, 4), mm: Math.round(d[i]), part: PARTS[i], keys: [...new Set([last.key, list[0].key])] });
                }
                heads.set(who, { t, at, key: list[0].key });
            }
        }
        // consecutive samples of one character as the same models: one interval
        const intervals = [];
        for (const s of samples) {
            const keys = s.list.map(m => m.key).sort(), sign = s.who + '|' + keys.join('+'), last = intervals.findLast(i => i.sign === sign);
            const worst = Math.min(...s.list.map(m => m.amount));
            if (last && s.t - last.to <= step * 1.5) { last.to = s.t; last.worst = Math.max(last.worst, worst); }
            else intervals.push({ sign, character: s.who, from: s.t, to: s.t, keys, worst, at: s.t, list: s.list });
        }
        const out = { id: shot.id, room: shot.room, seconds, ghosts: [], exempt: [], pops, fastest: Object.fromEntries(moves) };
        for (const i of intervals) {
            const placements = i.keys.map(k => people.people.find(o => people.keyOf(o.userData.person) === k)?.userData.person).filter(Boolean);
            const ok = placements.find(p => p.ghostOk);
            const row = { character: i.character, from: i.from, to: i.to, keys: i.keys, worst: round(i.worst), why: explain(people, i.keys, filter) };
            if (ok) out.exempt.push({ ...row, ghostOk: ok.ghostOk }); else out.ghosts.push(row);
        }
        return out;
    } finally {
        console.warn = warn; globalThis.__ERGO_PRESENTATION__ = was;
        try { await people.setEnabled(false); people.dispose(); } catch { /* the audit's own room */ }
    }
}

// Why two placements of one character were not one change of posture (room-people.mjs pairUp's conditions, in order).
function explain(people, keys, filter) {
    const objects = keys.map(k => people.people.find(o => people.keyOf(o.userData.person) === k)).filter(Boolean);
    if (objects.length < 2) return 'one placement drawn as two models (variants of one key)';
    const [a, b] = objects, sa = a.userData.person, sb = b.userData.person, reasons = [];
    const deskA = sa.desk && !sa.station, deskB = sb.desk && !sb.station;
    if (deskA || deskB) {
        const other = deskA ? sb : sa;
        if (!other.fromDesk) reasons.push(`desk user and a placement of them elsewhere (${people.keyOf(other)}) dissolve via 'away': not marked fromDesk`);
        else reasons.push(`fromDesk step of ${people.keyOf(other)} not under way (no rig / overlapping windows / desk user not mobile)`);
        return reasons.join('; ');
    }
    if (!people.library.rigData) return 'no skeletons yet (rigs not loaded): the fallback dissolve';
    if (!people.free(a) || !people.free(b)) reasons.push('a desk/station placement');
    // (where the cast puts them, as pairUp sees them when the cast is placed: a walker at the head of its path)
    const placed = (o, s) => { const p = filter.place?.[people.keyOf(s)]?.at || s.at; return p ? { x: p[0], z: p[1], turn: THREE.MathUtils.degToRad(filter.place?.[people.keyOf(s)]?.turn ?? s.turn ?? 0) } : { x: o.position.x, z: o.position.z, turn: o.rotation.y }; };
    const pa = placed(a, sa), pb = placed(b, sb);
    const d = Math.hypot(pa.x - pb.x, pa.z - pb.z), turn = Math.abs(THREE.MathUtils.euclideanModulo(pa.turn - pb.turn + Math.PI, Math.PI * 2) - Math.PI);
    const walker = [sa, sb].find(s => s.walk);
    if (walker && d >= 220) reasons.push(`${people.keyOf(walker)} is a walker: paired at the head of its path, not at its end (${Math.round(d)} mm from the other's spot)`);
    else if (d >= 220) reasons.push(`not the same spot (${Math.round(d)} mm apart >= 220)`);
    if (turn >= .3) reasons.push(`turned ${Math.round(THREE.MathUtils.radToDeg(turn))} deg apart (>= 17)`);
    const wa = filter.when?.[keys[0]], wb = filter.when?.[keys[1]];
    if (!wa || !wb) reasons.push('one has no `when` window');
    else {
        const meet = wa.some(([, t1]) => wb.some(([t0]) => Math.abs(t1 - t0) <= .75)) || wb.some(([, t1]) => wa.some(([t0]) => Math.abs(t1 - t0) <= .75));
        if (!meet) reasons.push('windows do not meet within .75 s');
        const overlap = wa.some(([a0, a1]) => wb.some(([b0, b1]) => a0 < b1 && b0 < a1));
        if (overlap) reasons.push('windows overlap (fade overlap: a dissolve)');
    }
    const pair = people.pairs.find(p => [p.from, p.to].includes(sa) && [p.from, p.to].includes(sb));
    if (pair && !pair.ready) {
        const rig = people.rigsOf.get(people.character(a));
        reasons.push(!rig ? 'paired but no rig data' : !rig.has(sa.id) || !rig.has(sb.id) ? `paired but a posture is not in the rig file (${[sa.id, sb.id].filter(id => !rig.has(id)).join(', ')})` : 'paired but not ready (a model did not rig)');
    } else if (pair) reasons.push(`paired, change ${round(pair.at - pair.length / 2)}-${round(pair.at + pair.length / 2)} s: two models outside it (the windows' own fades)`);
    return reasons.join('; ') || 'unknown';
}

export async function auditCut(cut, opts = {}) {
    const out = [];
    for (const shot of cut.shots) { if (opts.chapter && shot.id !== opts.chapter) continue; const r = await auditChapter(shot, opts); if (r) out.push(r); }
    return out;
}

export function table(results) {
    const rows = [['chapter', 'room', 'who', 'from s', 'to s', 'placements', 'faintest', 'why not one change']];
    for (const r of results) for (const g of r.ghosts) rows.push([r.id, r.room, g.character, g.from.toFixed(2), g.to.toFixed(2), g.keys.join(' + '), String(g.worst), g.why]);
    for (const r of results) for (const g of r.exempt) rows.push([r.id, r.room, g.character, g.from.toFixed(2), g.to.toFixed(2), g.keys.join(' + '), String(g.worst), 'ghostOk: ' + g.ghostOk]);
    const pops = results.flatMap(r => (r.pops || []).map(p => `  pop ${r.id} ${p.character} ${p.from.toFixed(4)}-${p.to.toFixed(4)} s: head jumps ${p.mm} mm (${p.keys.join(' -> ')})`));
    const tail = pops.length ? '\n' + pops.join('\n') : '';
    if (rows.length === 1) return 'no ghosting: one model of each character at every sample (' + results.map(r => r.id).join(', ') + ')' + tail;
    return rows.map((r, i) => '| ' + r.join(' | ') + ' |' + (i ? '' : '\n|' + r.map(() => '---').join('|') + '|')).join('\n') + tail;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
    const file = args.find(a => a.endsWith('.json')) || CUT, cut = JSON.parse(fs.readFileSync(file, 'utf8'));
    const results = await auditCut(cut, { chapter: flag('--chapter'), step: Number(flag("--step")) || 1 / 120, rigs: !args.includes('--no-rigs') });
    if (args.includes('--json')) console.log(JSON.stringify(results, null, 1)); else console.log(table(results));
    process.exitCode = results.some(r => r.ghosts.length) ? 1 : 0;
}
