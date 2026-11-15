// One solid figure at every frame (S20): nobody in the Cinematographer's cut is ever two models at once (a dissolve
// between two postures of one person: a see-through double image), and nobody's head or hands jump between two of
// the film's 1/120 s sub-frames (the render blends sub-frames: a jump reads as a double image too). Every change of
// posture goes through the skeleton blend (room-people.mjs pairUp / changing, solveChange; fromDesk, stepOuts).
//   node tests/room-people-ghost-test.mjs
// The audit is tools/experience/people-ghost-audit.mjs (run it for the table). A deliberate exception needs a
// `ghostOk: "<why>"` on one of the two placements; there is none today.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { RoomPeople } from '../room-people.mjs';
import { CUT, JUMP, auditChapter, auditCut, library, makeRoom, table } from '../tools/experience/people-ghost-audit.mjs';

const cut = JSON.parse(fs.readFileSync(CUT, 'utf8'));
const film = (id, seconds, people, extra = {}) => ({ id, room: 'office', layout: 'house', seconds, people: { only: [], ...people }, ...extra });

// ---- the cut: every chapter with people, sampled at the render's sub-frame rate and on every window edge
{
    const results = await auditCut(cut);
    assert.ok(results.length >= 8, 'the chapters with people are audited (' + results.map(r => r.id).join(', ') + ')');
    const ghosts = results.flatMap(r => r.ghosts.map(g => ({ chapter: r.id, ...g })));
    assert.equal(ghosts.length, 0, 'one model of each character at every sample of the cut:\n' + table(results));
    const exempt = results.flatMap(r => r.exempt);
    for (const e of exempt) assert.ok(typeof e.ghostOk === 'string' && e.ghostOk.trim().length > 8, 'an exception says why: ' + JSON.stringify(e));
    assert.equal(exempt.length, 0, 'no exceptions today');
    const pops = results.flatMap(r => r.pops.map(p => ({ chapter: r.id, ...p })));
    assert.equal(pops.length, 0, `no head or hand moves more than ${JUMP} mm between two 1/120 s sub-frames:\n` + pops.map(p => JSON.stringify(p)).join('\n'));
    // (and the audit does see people move: the fastest of each chapter is a real movement, not a frozen cast)
    assert.ok(results.some(r => Object.values(r.fastest).some(m => m.mm >= 10)), 'people move in the cut');
    for (const shot of cut.shots) for (const c of shot.people?.cast || []) if (c.ghostOk !== undefined) assert.ok(typeof c.ghostOk === 'string' && c.ghostOk.trim(), `${shot.id} ${c.key}: ghostOk is a note`);
}

// ---- a cut with no fade: on the very frame one window ends and the next begins, only the next placement is there
{
    const two = [{ key: 'reads', id: 'people-grace-sit-read', at: [1500, 900], turn: 20 }, { key: 'away', id: 'people-grace-stand-wait', at: [3500, 900], turn: 20 }];
    const r = await auditChapter(film('edge', 10, { cast: two, when: { reads: [[0, 5, 0, 0]], away: [[5, 10, 0, 0]] } }));
    assert.equal(r.ghosts.length, 0, 'not both at 5.000 s: ' + JSON.stringify(r.ghosts));
}

// ---- the old dissolve is caught (the audit is not blind): two placements of one person fading across each other
{
    const two = [{ key: 'reads', id: 'people-grace-sit-read', at: [1500, 900], turn: 20 }, { key: 'away', id: 'people-grace-stand-wait', at: [3500, 900], turn: 20 }];
    const r = await auditChapter(film('dissolve', 10, { cast: two, when: { reads: [[0, 5.5, 0, .8]], away: [[4.7, 10, .8, 0]] } }));
    assert.ok(r.ghosts.length === 1 && r.ghosts[0].from < 5 && r.ghosts[0].to > 5 && /same spot/.test(r.ghosts[0].why), 'a dissolve is two of her: ' + JSON.stringify(r.ghosts));
    const ok = await auditChapter(film('dissolve-ok', 10, { cast: [two[0], { ...two[1], ghostOk: 'test: a deliberate double exposure' }], when: { reads: [[0, 5.5, 0, .8]], away: [[4.7, 10, .8, 0]] } }));
    assert.ok(ok.ghosts.length === 0 && ok.exempt.length === 1, 'ghostOk lists it as an exception');
}

// ---- a change of posture in a film: the life goes out of the first model before it and into the second after it
{
    const L = library(), cast = [{ key: 'reads', id: 'people-grace-sit-read', at: [1500, 900], turn: 20, look: ['other'] }, { key: 'phones', id: 'people-grace-sit-phone', at: [1500, 900], turn: 20, look: ['other'] }, { key: 'other', id: 'people-leo-stand-wait', at: [1500, 2200], turn: 200 }];
    const room = makeRoom('office', 'house', cast), people = new RoomPeople(room, L), desk = { pose: { x: 0, z: 0, yaw: 0 }, height: 28 };
    people.setFilter({ only: [], cast, when: { reads: [[0, 5]], phones: [[5, 10]] } }); await people.setEnabled(true);
    const see = t => { people.update({ ...desk, time: t, now: 0 }); return people; };
    see(0); await people.settled(); for (let t = 0; t <= 10; t += .25) see(t); await people.settled();
    const pair = people.pairs.find(p => p.ready); assert.ok(pair, 'the two windows make one change');
    const s = pair.at - pair.length / 2, e = pair.at + pair.length / 2, life = key => people.byKey(key).userData.personPairLife;
    see(s - .7); assert.equal(life('reads'), 1, 'fully alive before'); see(s - .3); assert.ok(life('reads') > 0 && life('reads') < 1, 'the life going out');
    see(s); assert.equal(life('reads'), 0, 'as built as the change starts');
    see(e); assert.equal(life('phones'), 0, 'as built as it ends'); see(e + .7); assert.equal(life('phones'), 1, 'alive again after');
    const r = await auditChapter(film('change', 10, { cast, when: { reads: [[0, 5]], phones: [[5, 10]] } }));
    assert.deepEqual([r.ghosts.length, r.pops.length], [0, 0], 'one figure, no jump: ' + JSON.stringify(r.pops));
    await people.setEnabled(false); people.dispose();
}

// ---- a walker handing over to the same person where the path ends: they turn to that placement's facing as they arrive
{
    // a short last leg (0.2 m) leaves the walk facing between the last two legs; the placement faces along the last one
    const path = [[0, 1000], [0, 2600], [120, 2760]], end = path.at(-1), face = THREE.MathUtils.radToDeg(Math.atan2(120, 160)) - 40;
    const cast = [{ key: 'walks', id: 'people-zoe-stand-wait', at: path[0], turn: 0, walk: { path, start: 1 } }, { key: 'stops', id: 'people-zoe-stand-wait', at: end, turn: face }];
    const r = await auditChapter(film('walker', 8, { cast, when: { walks: [[0, 5, 0, 0]], stops: [[5, 8, 0, 0]] } }));
    assert.deepEqual([r.ghosts.length, r.pops.length], [0, 0], 'one figure, turning as they arrive: ' + JSON.stringify(r.pops));
    // without the turn the hand-over snaps: the audit sees it (the same cast with the end turn switched off)
    const proto = RoomPeople.prototype.walkEndTurn; RoomPeople.prototype.walkEndTurn = () => null;
    try { const snap = await auditChapter(film('walker-snap', 8, { cast, when: { walks: [[0, 5, 0, 0]], stops: [[5, 8, 0, 0]] } })); assert.ok(snap.pops.some(p => p.character === 'zoe' && p.from <= 5 && p.to >= 5), 'a snap at 5 s is a pop: ' + JSON.stringify(snap.pops)); }
    finally { RoomPeople.prototype.walkEndTurn = proto; }
    // a walker nobody takes over from, or one whose next placement already faces the way the walk ends: as before
    const L = library(), alone = [cast[0]], room = makeRoom('office', 'house', alone), people = new RoomPeople(room, L);
    people.setFilter({ only: [], cast: alone, when: { walks: [[0, 8, 0, 0]] } }); await people.setEnabled(true);
    for (let t = 0; t <= 8; t += .5) people.update({ pose: { x: 0, z: 0, yaw: 0 }, height: 28, time: t, now: 0 }); await people.settled(); people.update({ pose: { x: 0, z: 0, yaw: 0 }, height: 28, time: 6, now: 0 });
    assert.equal(people.byKey('walks').userData.personLife?.endTurn, null, 'no hand-over: no end turn');
    await people.setEnabled(false); people.dispose();
}

console.log('PASS room people ghost: the cut has one model of each character at every 1/120 s sub-frame and window edge, no head or hand jump over ' + JUMP + ' mm between sub-frames, no ghostOk exceptions; a cut on a window edge, a caught dissolve, the life easing round a change, a walker turning to the next placement as they arrive.');
