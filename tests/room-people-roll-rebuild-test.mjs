// Desk-proof: hiding a desk whose user is in the cast (Fern's, the high school's review desk), its Undo and its Redo
// change WHO is in the cast, so setFilter() rebuilds the whole cast (dispose). A person rebuilt mid-roll has no life
// on the frame after the edit (enliven is async), liven() skipped rollAlong() and Kai was drawn at his cast spot,
// the start of his roll (-850, 500), 237 mm and more off where he was rolling, for one frame (Director, real Chrome:
// tests/director-desk-workflow-e2e.mjs 2.3 / 3.h3a / 3.h3b). For every frame (1/30 s) of Kai's roll, the root (x, z)
// of everyone drawn before and after the edit on the same frame is within 25 mm.
//   node tests/room-people-roll-rebuild-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RoomPeople } from '../room-people.mjs';
import { CUT, library, makeRoom } from '../tools/experience/people-ghost-audit.mjs';

const shot = JSON.parse(fs.readFileSync(CUT, 'utf8')).shots.find(s => s.id === 'oilers'), filter = shot.people;
const state = t => ({ height: 28, tilt: 0, pose: { x: 0, z: 0, yaw: 0 }, keyboard: { x: 0, z: 260 }, time: t, now: 0 });
const LIMIT = 25, roll = filter.cast.find(c => c.key === 'kai-rolls').roll, END = Math.min(shot.seconds, (filter.when?.['kai-rolls']?.[0]?.[1] ?? shot.seconds));
// the Director's hide of Fern's desk reaches the stage as the cast without Fern; Undo brings her back; Redo hides again
const hidden = (() => { const f = structuredClone(filter); f.cast = f.cast.filter(c => c.key !== 'fern'); return f; })();
const EDITS = [['hide', hidden], ['undo', filter], ['redo', hidden]];
const roots = people => new Map(people.people.filter(o => o.visible).map(o => [people.keyOf(o.userData.person), [o.position.x, o.position.z]]));
const was = globalThis.__ERGO_PRESENTATION__; globalThis.__ERGO_PRESENTATION__ = true;
const warn = console.warn; console.warn = () => {};
try {
    const room = makeRoom(shot.room, shot.layout || 'house', filter.cast), people = new RoomPeople(room, library()); room.peopleState = () => state(0);
    people.setFilter(filter); await people.setEnabled(true); people.update(state(0)); await people.settled();
    const times = []; for (let t = (roll.start || 0) + 1 / 30; t < END - 1e-6; t += 1 / 30) times.push(Math.round(t * 1e4) / 1e4);
    let current = filter, worst = { mm: 0 }, frames = 0;
    for (const t of times) {
        for (const [what, next] of EDITS) {
            people.update(state(t)); await people.settled(); people.update(state(t));
            const before = roots(people);
            if (next !== current) { people.setFilter(next); current = next; await people.setEnabled(true); }
            people.update(state(t)); frames++;
            for (const [key, q] of roots(people)) {
                const p = before.get(key); if (!p) continue; const mm = Math.hypot(q[0] - p[0], q[1] - p[1]);
                if (mm > worst.mm) worst = { mm: Math.round(mm), key, t, what, at: q.map(Math.round), was: p.map(Math.round) };
            }
        }
        if (t > times[0] + 3) break;   // (the first 3 s of the roll: every corner of the way out of the aisle)
    }
    await people.settled();
    console.log(`room people roll rebuild: oilers, ${frames} edits (hide / undo / redo of Fern's desk mid-roll): worst ${worst.mm} mm${worst.key ? ` (${worst.key} ${worst.what} at ${worst.t} s: ${worst.was} -> ${worst.at})` : ''}`);
    assert.ok(worst.mm <= LIMIT, `${worst.key} jumped ${worst.mm} mm on the frame after the ${worst.what} at ${worst.t} s (${worst.was} -> ${worst.at})`);
    await people.setEnabled(false); people.dispose();
} finally { console.warn = warn; globalThis.__ERGO_PRESENTATION__ = was; }
