// Pose keys (people-pose-keys.mjs), the Director's people data that keeps every film field (experience/people-edits.mjs,
// v: 2), and the stage showing a keyed joint at the right second (room-people.mjs).   node tests/people-pose-keys-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { cleanPoseKeys, poseAt, setPoseKey, removePoseKey, moveKey, setKeyEase, copyKey, pasteKey, keyTimes, keyedBones, cleanTurn, KEY_SNAP } from '../people-pose-keys.mjs';
import { cleanPeople, cleanPerson, peopleFilter, cleanPeopleEdits } from '../experience/people-edits.mjs';
import { RoomPeople } from '../room-people.mjs';

const about = (a, b, eps = 2e-4) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);
const turnY = deg => { const h = deg * Math.PI / 360; return [0, Math.sin(h), 0, Math.cos(h)]; };
const angle = q => 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI;
const ID = [0, 0, 0, 1];

{   // cleaning: sorted, unit, w >= 0, the identity kept, junk dropped, close keys merged
    assert.deepEqual(cleanTurn([0, 0, 0, -2]), ID);
    assert.equal(cleanTurn([0, 0, 0, 0]), null); assert.equal(cleanTurn([1, 2, 3]), null);
    const keys = cleanPoseKeys([{ t: 3, pose: { head: turnY(40) } }, { t: 1, pose: { head: ID, 'bad name!': ID } }, { t: -1, pose: { head: ID } }, { t: 2, pose: {} }, { t: 3.005, pose: { neck_01: turnY(10) }, ease: 'linear' }, 'x']);
    assert.deepEqual(keys.map(k => k.t), [1, 3]); assert.deepEqual(keys[0].pose, { head: ID }, 'the identity is a key');
    assert.deepEqual(Object.keys(keys[1].pose), ['head', 'neck_01'], 'keys closer than a sixtieth are one'); assert.equal(keys[1].ease, 'linear');
    assert.equal(cleanPoseKeys([]), null); assert.equal(cleanPoseKeys('x'), null);
    assert.equal(cleanPoseKeys(Array.from({ length: 300 }, (_, i) => ({ t: i, pose: { head: ID } }))).length, 200);
}
{   // the value at a time: per-bone channels, held outside, eased between, the static pose under the bones no key names
    const e = { pose: { hand_l: turnY(20), head: turnY(5) }, poseKeys: cleanPoseKeys([{ t: 2, pose: { head: ID } }, { t: 3, pose: { head: turnY(40), lowerarm_r: turnY(30) } }, { t: 5, pose: { head: ID } }]) };
    assert.equal(poseAt(e, null), e.pose, 'without a time: the static pose');
    assert.equal(poseAt({ pose: e.pose }, 3), e.pose, 'without keys: the static pose');
    assert.equal(poseAt({}, 3), null);
    const at = t => poseAt(e, t);
    assert.ok(about(at(0).head, ID) && about(at(2).head, ID), 'before the first key a bone holds it (a keyed bone does not take the static turn)');
    assert.ok(about(at(3).head, turnY(40)) && about(at(9).head, ID));
    assert.ok(Math.abs(angle(at(2.5).head) - 20) < .01, 'half way through a smooth stretch: half the turn');
    assert.ok(angle(at(2.25).head) < 10 && angle(at(2.75).head) > 30, 'smooth eases out of a key and into the next');
    assert.ok(about(at(0).lowerarm_r, turnY(30)) && about(at(9).lowerarm_r, turnY(30)), 'a bone with one key has it throughout');
    assert.ok(about(at(2.5).hand_l, turnY(20)), 'a bone no key names keeps the static pose');
    const lin = { poseKeys: cleanPoseKeys([{ t: 0, pose: { head: ID }, ease: 'linear' }, { t: 4, pose: { head: turnY(80) } }]) };
    assert.ok(Math.abs(angle(poseAt(lin, 1).head) - 20) < .01, 'linear');
    const hold = { poseKeys: cleanPoseKeys([{ t: 0, pose: { head: ID }, ease: 'hold' }, { t: 4, pose: { head: turnY(80) } }]) };
    assert.ok(about(poseAt(hold, 3.99).head, ID) && about(poseAt(hold, 4).head, turnY(80)), 'hold stays until the next key');
    const far = { poseKeys: cleanPoseKeys([{ t: 0, pose: { head: turnY(170) } }, { t: 1, pose: { head: turnY(-170) } }]) };
    assert.ok(angle(poseAt(far, .5).head) > 170, 'the short way round');
    const buf = {}; assert.equal(poseAt(e, 2.5, buf), buf, 'a buffer is reused'); buf.stale = 1; assert.equal(poseAt(e, 2.5, buf).stale, undefined);
    for (const t of [0, 1.3, 2.5, 3, 4.2]) for (const q of Object.values(poseAt(e, t))) assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-3, 'unit turns');
}
{   // editing: every helper returns a new entry
    const a = { id: 'people-noah-stand-wait', key: 'noah' }, b = setPoseKey(a, 3.2, 'lowerarm_r', turnY(25));
    assert.equal(a.poseKeys, undefined); assert.deepEqual(keyTimes(b), [3.2]);
    const c = setPoseKey(b, 3.2 + KEY_SNAP / 2, 'hand_r', turnY(10)); assert.deepEqual(keyTimes(c), [3.2], 'a change within a sixtieth goes into the key that is there');
    assert.deepEqual(keyedBones(c).sort(), ['hand_r', 'lowerarm_r']);
    const d = setPoseKey(setPoseKey(c, 2.6, { lowerarm_r: ID, hand_r: ID }), 4, { lowerarm_r: ID, hand_r: ID }, undefined, { ease: 'linear' });
    assert.deepEqual(keyTimes(d), [2.6, 3.2, 4]); assert.equal(d.poseKeys[2].ease, 'linear');
    assert.ok(about(poseAt(d, 0).lowerarm_r, ID) && about(poseAt(d, 3.2).lowerarm_r, turnY(25)) && about(poseAt(d, 9).lowerarm_r, ID), 'a local correction: neutral, corrected, neutral');
    assert.deepEqual(keyTimes(moveKey(d, 3.2, 3.5)), [2.6, 3.5, 4]);
    const merged = moveKey(d, 3.2, 4); assert.deepEqual(keyTimes(merged), [2.6, 4]); assert.ok(about(merged.poseKeys[1].pose.lowerarm_r, turnY(25)), 'a key dragged onto another: the moved one wins');
    assert.deepEqual(keyTimes(removePoseKey(d, 3.2)), [2.6, 4]);
    assert.deepEqual(Object.keys(removePoseKey(d, 3.2, 'hand_r').poseKeys[1].pose), ['lowerarm_r']);
    assert.equal(removePoseKey(removePoseKey(b, 3.2, 'lowerarm_r'), 3.2).poseKeys, undefined, 'the last bone out: no key, no field');
    assert.equal(setKeyEase(d, 2.6, 'hold').poseKeys[0].ease, 'hold'); assert.equal(setKeyEase(setKeyEase(d, 2.6, 'hold'), 2.6, 'smooth').poseKeys[0].ease, undefined);
    const copied = copyKey(d, 3.2); assert.deepEqual(keyTimes(pasteKey(d, 6, copied)), [2.6, 3.2, 4, 6]);
    assert.equal(setPoseKey(a, -1, 'head', ID), a); assert.equal(moveKey(d, 99, 1), d); assert.equal(removePoseKey(d, 99), d);
    assert.deepEqual(d.poseKeys, cleanPoseKeys(d.poseKeys), 'what the helpers write is already clean');
}
{   // The Director's people data. Field by field (no v): the film's own fields are no longer dropped.
    const walker = { key: 'noah-steps', id: 'people-noah-stand-wait', at: [-2681, -1248], turn: 43, walk: { path: [[-2681, -1248], [-2818, -914]], start: 4, pace: 2.2, then: 'people-noah-stand-screen-pull' }, look: ['kai'], poseKeys: [{ t: 4.5, pose: { head: turnY(12) } }] };
    assert.deepEqual(cleanPerson(walker), walker, 'legacy key precision survives a read');
    const roller = { key: 'kai-rolls', id: 'people-kai-wheel-roll', at: [-961, 1300], turn: 0, roll: { path: [[-961, 1300], [-961, -265]], start: .3, speed: 1, radius: 350 } };
    assert.deepEqual(cleanPerson(roller), roller);
    const actor = { key: 'noah-taps', id: 'people-noah-stand-screen-tap', at: [-2930, -1080], turn: -146, act: { at: 8.2 } }; assert.deepEqual(cleanPerson(actor), actor);
    const seated = { key: 'nia-class', id: 'people-nia-sit-write', on: 'student-chair-0-0-0', seat: 450, turn: 180 };
    assert.deepEqual(cleanPerson(seated), seated, 'someone on a seat is a placement, with the turn that corrects the seat');
    assert.equal(cleanPerson({ id: 'people-nia-sit-write' }), null, 'nowhere: not a placement');
}
{   // v: 2: the film's whole people object, verbatim, for every chapter of the Cinematographer's cut
    const cut = JSON.parse(readFileSync(new URL('../exports/cinematic-intro-cut-cine/review-cut.json', import.meta.url), 'utf8'));
    let checked = 0;
    for (const shot of cut.shots) {
        const people = shot.people; if (!people || typeof people !== 'object' || !Array.isArray(people.cast)) continue;
        const edits = cleanPeople({ v: 2, ...people }); assert.equal(edits.v, 2);
        const { v, ...back } = edits; assert.deepEqual(back, people, shot.id + ': through the Director and back unchanged');
        assert.deepEqual(peopleFilter({ v: 2, ...people }), people, shot.id + ': the film gets the same people');
        assert.deepEqual(cleanPeopleEdits({ peopleEdits: { v: 2, ...people } }).peopleEdits, { v: 2, ...people });
        checked++;
    }
    assert.ok(checked >= 5, 'chapters with a cast: ' + checked);
    const oilers = cut.shots.find(s => s.id === 'oilers').people, hidden = structuredClone(oilers);
    hidden.cast.find(c => c.key === 'fern').hide = true; hidden.cast.find(c => c.key === 'noah-taps').hide = true;
    const film = peopleFilter({ v: 2, ...hidden });
    assert.ok(!film.cast.some(c => c.key === 'fern' || c.key === 'noah-taps') && film.when['noah-taps'] === undefined && film.when['noah-pulls'], 'a hidden person and their times are not in the film');
    assert.deepEqual(film.except, oilers.except, 'except / only / place stay');
    const keyed = structuredClone(oilers); keyed.cast[0].poseKeys = [{ t: 2, pose: { head: [0, 0, 0, -1] } }, { t: 1, pose: { head: turnY(10) } }, { t: 'x' }];
    assert.deepEqual(cleanPeople({ v: 2, ...keyed }).cast[0].poseKeys, keyed.cast[0].poseKeys.slice(0,2), 'valid archived keys keep their order, precision, and quaternion sign');
    assert.equal(cleanPeople({ v: 2, cast: [{ id: 'not a person' }, 7, { id: 'people-kai-wheel-roll', anything: { kept: true } }] }).cast.length, 1);
}
{   // The stage: a keyed joint at this second of the chapter, for someone nothing else moves, and back with the time.
    const index = JSON.parse(readFileSync(new URL('../assets/props/index.json', import.meta.url), 'utf8')), entries = new Map(index.props.map(p => [p.id, p]));
    const model = id => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), new THREE.MeshStandardMaterial())); g.scale.setScalar(1000); g.userData.propId = id; return g; };
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, 0, .1));
    const library = { loadIndex: async () => index, entry: id => entries.get(id) || null, instance: async id => model(id),
        rigInstance: async id => { const g = model(id); for (const name of ['head', 'lowerarm_r']) { const b = new THREE.Bone(); b.name = name; b.quaternion.copy(rest); g.add(b); } return g; } };
    const root = new THREE.Group(), room = { id: 'creative', root, token: 1, ready: Promise.resolve(), roomLayout: { id: 'house' }, assets: () => [], peopleState: null };
    const people = new RoomPeople(room, library), id = 'people-lin-stand-paint';
    const cast = [{ key: 'keyed', id, at: [-1700, 2500], turn: 0, pose: { lowerarm_r: turnY(15) }, poseKeys: cleanPoseKeys([{ t: 2, pose: { head: ID } }, { t: 3, pose: { head: turnY(40) } }, { t: 4, pose: { head: ID } }]) },
        { key: 'plain', id, at: [1700, 2500], turn: 0 }];
    people.setFilter({ only: [], cast }); await people.setEnabled(true);
    assert.ok(people.posed(cast[0]) && !people.posed(cast[1]) && people.posed({ poseKeys: cast[0].poseKeys }), 'someone with pose keys gets a skeleton');
    const state = time => ({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 }, time, now: time * 1000 });
    people.update(state(0)); await people.settled(); people.update(state(0));
    const keyed = people.people.find(o => o.userData.person.key === 'keyed'), plain = people.people.find(o => o.userData.person.key === 'plain');
    assert.ok(keyed.userData.personRig, 'rigged'); assert.ok(!plain.userData.personRig, 'the others stay plain meshes');
    const turnOf = name => { const b = keyed.userData.personRig.bones.get(name); return rest.clone().invert().multiply(b.quaternion).toArray(); };
    const show = t => { people.update(state(t)); return turnOf('head'); };
    assert.ok(about(show(0), ID, 1e-3) && about(show(2), ID, 1e-3), 'as built before the correction');
    assert.ok(about(show(3), turnY(40), 1e-3), 'the keyed turn at its second');
    assert.ok(Math.abs(angle(show(2.5)) - 20) < .05 && Math.abs(angle(show(3.5)) - 20) < .05, 'eased on the way in and out');
    assert.ok(about(show(9), ID, 1e-3), 'and gone after'); assert.ok(about(show(3), turnY(40), 1e-3), 'scrubbing back shows it again');
    assert.ok(about(turnOf('lowerarm_r'), turnY(15), 1e-3), 'a bone no key names keeps the static pose');
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 } }); assert.ok(about(turnOf('head'), ID, 1e-3), 'without a film time (the Studio): the static pose only');
    assert.equal(cast[0].poseNow, undefined, 'the cast the film gave is not written to');
}
console.log('people pose keys: cleaning, per-bone channels and eases, editing helpers, the Director\'s people data keeps every film field (v2 verbatim for every chapter of the cut), the stage shows a keyed joint at its second: OK');
