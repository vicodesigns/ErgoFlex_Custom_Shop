// S33a3: an edit of the cast (the Director re-applies the chapter's people: setFilter with the same people, a colour,
// a pose key, a turn, a retimed edge) never makes anyone jump on the frame after it. setFilter() leaves the cast to be
// placed again (placed = false); update() then ended every change of posture under way and made them again, and a
// change made again has no skeletons on its first frame: Kai changing from rolling into typing (oilers, 12.75 s)
// jumped up to 332 mm (head and hands), Noah's changes too. A change between the same two placements now goes on
// (pairUp(old)); one the edit changed takes its new shape once that is ready. For every frame of the chapter
// (1/30 s), the head and hands of everyone drawn before the edit and after it on the same frame are within 25 mm.
//   node tests/room-people-recast-jump-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { CUT, library, makeRoom } from '../tools/experience/people-ghost-audit.mjs';

const shot = JSON.parse(fs.readFileSync(CUT, 'utf8')).shots.find(s => s.id === 'oilers'), filter = shot.people, T = shot.seconds;
const state = t => ({ height: 28, tilt: 0, pose: { x: 0, z: 0, yaw: 0 }, keyboard: { x: 0, z: 260 }, time: t, now: 0 });
const LIMIT = 25;
let n = 0;
const EDITS = {
    'a colour of someone else': f => { f.cast.find(c => c.key === 'noah-watches').colors = { top: n++ % 2 ? '#334455' : '#445566' }; },
    "Kai's colour": f => { f.cast.find(c => c.key === 'kai-rolls').colors = { top: n++ % 2 ? '#334455' : '#445566' }; },
    'a pose key on Kai': f => { f.cast.find(c => c.key === 'kai-rolls').poseKeys = [{ t: 1, pose: { head: [0, .1, 0, .995] } }]; },
    "Kai's turn": f => { f.cast.find(c => c.key === 'kai-rolls').turn = n++ % 2 ? 1 : 2; },
    "Noah's tap retimed 1 ms": f => { f.when['noah-taps'][0][0] += n++ % 2 ? .001 : .002; }
};
const parts = o => { o.updateMatrixWorld(true); const b = o.userData.personRig?.bones; return ['head', 'hand_l', 'hand_r'].map(name => b?.get(name)?.getWorldPosition(new THREE.Vector3()) || null); };
const was = globalThis.__ERGO_PRESENTATION__; globalThis.__ERGO_PRESENTATION__ = true;
const warn = console.warn; console.warn = () => {};
try {
    const out = [];
    for (const [what, edit] of Object.entries(EDITS)) {
        const room = makeRoom(shot.room, shot.layout || 'house', filter.cast), people = new RoomPeople(room, library()); room.peopleState = () => state(0);
        people.setFilter(filter); await people.setEnabled(true); people.update(state(0)); await people.settled();
        const times = []; for (let t = 0; t <= T + 1e-6; t += 1 / 30) times.push(Math.round(t * 1e4) / 1e4);
        for (const t of times) people.update(state(t)); await people.settled();   // (warm: every skeleton, life and change ready, as the film's export)
        let worst = { mm: 0 };
        for (const t of times) {
            people.update(state(t)); const before = new Map(people.people.filter(o => o.visible).map(o => [people.keyOf(o.userData.person), parts(o)]));
            const f = structuredClone(filter); edit(f); people.setFilter(f); people.update(state(t));
            for (const o of people.people.filter(o => o.visible)) {
                const p = before.get(people.keyOf(o.userData.person)); if (!p) continue; const q = parts(o);
                const mm = Math.max(0, ...q.map((v, i) => v && p[i] ? v.distanceTo(p[i]) : 0)); if (mm > worst.mm) worst = { mm: Math.round(mm), key: people.keyOf(o.userData.person), t };
            }
            await people.settled();
        }
        out.push(`${what}: ${worst.mm} mm`);
        assert.ok(worst.mm <= LIMIT, `${what}: ${worst.key} jumped ${worst.mm} mm at ${worst.t} s on the frame after the edit`);
        await people.setEnabled(false); people.dispose();
    }
    console.log(`room people recast: oilers, every frame, the cast edited (${out.join(', ')}): nobody jumps more than ${LIMIT} mm`);
} finally { console.warn = warn; globalThis.__ERGO_PRESENTATION__ = was; }
