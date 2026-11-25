// One person of a film chapter, frame by frame, through the film's own people code (RoomPeople headless, as
// tools/experience/people-ghost-audit.mjs and tests/people-place-test.mjs run it): the drawn bones of the model shown at each
// moment, in the model's frame (metres) and in the room (mm).
//   filmFrames({ shot, key: /^omar/, times: [...], edit: filter => filter, code: <dir with room-people.mjs> })
//     -> [{ t, shown: ['<key>:<model id>'], bones: { name: [x, y, z, qx, qy, qz, qw] } (model frame), room: { name: [x, y, z] } (mm) }]
// A chapter shot is <cut>/director-film/<chapter>.json (the Director's film of Vico's cut).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { library, makeRoom } from '../../tools/experience/people-ghost-audit.mjs';
import { sampleClipMotion } from '../../experience/desk-clips.mjs';
import { ROOT } from './people-surface.mjs';

export const CUT = path.join(ROOT, 'exports/cinematic-intro-cut-vicos-3rd-cut');
export const chapterShot = (id, cut = CUT) => { const f = path.join(cut, 'director-film', id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
export async function filmFrames({ shot, key, times, edit = f => f, code = ROOT, bones: only = null }) {
    const { RoomPeople, castEntries } = await import(pathToFileURL(path.join(code, 'room-people.mjs')).href);
    const filter = edit(JSON.parse(JSON.stringify(shot.people))); delete filter.v;
    const layout = shot.layout || 'house', room = makeRoom(shot.room, layout, [...castEntries(shot.room, layout), ...(filter.cast || [])]), people = new RoomPeople(room, library());
    const motion = shot.motion?.clips ? shot.motion : null, seconds = shot.seconds;
    const deskAt = s => motion ? sampleClipMotion(motion, Math.min(seconds, Math.max(0, s))) : { height: 28, tilt: 0 };
    const track = { seconds, heightAt: s => deskAt(s).height, tiltAt: s => deskAt(s).tilt || 0 };
    const modeAt = t => { const list = Array.isArray(shot.timeOfDay) ? shot.timeOfDay : null; if (!list) return shot.mode || 'morning'; let m = list[0]?.mode || shot.mode || 'morning'; for (const k of list) if (k.at <= t) m = k.mode; return m; };
    const state = t => ({ height: deskAt(t).height, tilt: deskAt(t).tilt || 0, mode: modeAt(t), pose: { x: 0, z: 0, yaw: 0 }, keyboard: { x: 0, z: 260 }, time: t, track, target: null, now: 0 });
    room.peopleState = () => state(0);
    const was = globalThis.__ERGO_PRESENTATION__; globalThis.__ERGO_PRESENTATION__ = true;
    const warn = console.warn; console.warn = () => {};
    try {
        people.setFilter(filter); await people.setEnabled(true);
        const first = Math.max(0, times[0] - 1);
        for (let k = 0; k < 4; k++) { people.update(state(first)); await people.settled(); }
        const out = [], V = () => new THREE.Vector3();
        for (const t of times) {
            if (people.pending.size) await people.settled();
            people.update(state(t));
            const shown = people.people.filter(o => o.visible && (o.userData.personAmount ?? 1) > .02 && o.userData.personRig && key.test(people.keyOf(o.userData.person)));
            const row = { t, shown: shown.map(o => people.keyOf(o.userData.person) + ':' + o.userData.person.id), pairs: people.pairs };
            const o = shown[0];
            if (o) {
                o.updateMatrixWorld(true); const inv = o.matrixWorld.clone().invert(); row.bones = {}; row.room = {};
                for (const [n, b] of o.userData.personRig.bones) {
                    if (only && !only.includes(n)) continue;
                    b.updateWorldMatrix(true, false); const p = V(), q = new THREE.Quaternion(), sc = V(); inv.clone().multiply(b.matrixWorld).decompose(p, q, sc);
                    row.bones[n] = [...p.toArray(), ...q.toArray()]; row.room[n] = b.getWorldPosition(V()).toArray();
                }
            }
            out.push(row);
        }
        return out;
    } finally { console.warn = warn; globalThis.__ERGO_PRESENTATION__ = was; }
}
// The points the tests follow on each arm (room mm): the wrist, the tip of the middle finger (its last bone's length on from its last
// joint), the elbow and the middle of the forearm.
export function armPoints(row, side) {
    const p = n => new THREE.Vector3().fromArray(row.room[n]), wrist = p('hand_' + side), elbow = p('lowerarm_' + side), m3 = p('middle_03_' + side), m2 = p('middle_02_' + side);
    return { wrist, tip: m3.clone().add(m3.clone().sub(m2)), elbow, mid: wrist.clone().add(elbow).multiplyScalar(.5) };
}
// Per-frame motion of those points over frames at a steady rate: the most a point moves in one frame (step), the most its move changes
// from one frame to the next (dstep: a kick, a stop or a jump), the most a frame's step is over the larger of its two neighbours'
// (jump: a step, a frame that moves more than the frames round it), and the most its way turns in one frame while it moves (turn,
// degrees, where it moves at least `moving` mm a frame). mm; with where (t) each was.
export function motionOf(rows, { moving = 3 } = {}) {
    const out = {};
    for (const side of ['l', 'r']) for (const k of ['wrist', 'tip', 'elbow', 'mid']) {
        const P = rows.map(r => armPoints(r, side)[k]), d = [], o = { step: 0, dstep: 0, jump: 0, turn: 0 }, at = {};
        for (let i = 1; i < P.length; i++) d.push(P[i].clone().sub(P[i - 1]));
        d.forEach((v, i) => {
            const s = v.length(); if (s > o.step) { o.step = s; at.step = rows[i + 1].t; }
            if (i > 0) { const c = v.clone().sub(d[i - 1]).length(); if (c > o.dstep) { o.dstep = c; at.dstep = rows[i].t; } }
            if (i > 0 && i < d.length - 1) { const j = s - Math.max(d[i - 1].length(), d[i + 1].length()); if (j > o.jump) { o.jump = j; at.jump = rows[i + 1].t; } }
            if (i > 0 && s > moving && d[i - 1].length() > moving) { const a = v.angleTo(d[i - 1]) * 180 / Math.PI; if (a > o.turn) { o.turn = a; at.turn = rows[i].t; } }
        });
        out[side + '.' + k] = { ...o, at };
    }
    return out;
}
export const worstOf = (m, field) => Object.entries(m).reduce((best, [k, v]) => v[field] > best.value ? { value: v[field], point: k, at: v.at[field] } : best, { value: 0, point: null, at: null });
