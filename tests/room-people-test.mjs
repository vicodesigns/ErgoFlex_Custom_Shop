// People in the rooms (room-people.mjs): who is shown at which desk height, the fade between them, the film's
// filter and placement, and stations whose height a pose does not fit.   node tests/room-people-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoomPeople, ROOM_PEOPLE, castEntries } from '../room-people.mjs';
import { readFileSync } from 'node:fs';

const index = JSON.parse(readFileSync(new URL('../assets/props/index.json', import.meta.url), 'utf8'));
const entries = new Map(index.props.map(p => [p.id, p]));

// Every person a room asks for is in the library, in the people category, with a model on disk.
const LAYOUTS = ['apartment', 'house', 'spacious', 'premium', 'executive', 'humboldt'].map((id, i) => ({ id, width: 2800 + i * 1400, depth: 3200 + i * 1600, back: -1050 - i * 400, desk: [-200, -500] }));
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
for (const room of Object.keys(ROOM_PEOPLE)) for (const L of LAYOUTS) {
    const specs = castEntries(room, L), keys = specs.map(s => s.key || s.id);
    assert.equal(new Set(keys).size, keys.length, `${room} ${L.id}: every placement has a key of its own`);
    for (const phase of PHASES) {   // nobody is shown twice in one daypart (a model may only recur under another key at another hour)
        const shown = specs.filter(s => !s.modes || s.modes.includes(phase)), who = shown.filter(s => !s.desk || s.station).map(s => s.id);
        assert.equal(new Set(who).size, who.length, `${room} ${L.id} ${phase}: one of each model away from the desk`);
        const characters = shown.filter(s => !s.desk || s.station).map(s => s.id.split('-')[1]);
        assert.equal(new Set(characters).size, characters.length, `${room} ${L.id} ${phase}: a character is in the room once`);
    }
}
for (const [room, specs] of Object.entries(ROOM_PEOPLE)) for (const spec of LAYOUTS.flatMap(L => castEntries(room, L))) {
    const entry = entries.get(spec.id); assert.ok(entry, `${room}: ${spec.id} is in the prop index`);
    assert.equal(entry.category, 'people'); assert.ok(readFileSync(new URL('../' + entry.file, import.meta.url)).length > 10000, spec.id + ' has a model');
    if (spec.desk) assert.ok(Number.isFinite(entry.person?.deskHeight), spec.id + ' records the desk height its pose fits');
}

{   // Rooms without their own cast get a desk user; children's rooms get nobody.
    const cast = id => new RoomPeople({ id, roomLayout: { id: 'house' } }, null).specs();
    assert.deepEqual(cast('office').map(s => s.desk), ['sit', 'sit', 'stand']);
    for (const spec of cast('office')) assert.ok(entries.get(spec.id)?.person?.deskHeight, spec.id + ' is built');
    assert.deepEqual(cast('childroom'), []); assert.deepEqual(cast('kindergarten'), []); assert.deepEqual(cast('product'), []);
}
const library = {
    loadIndex: async () => index, entry: id => entries.get(id) || null,
    instance: async id => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), new THREE.MeshStandardMaterial())); g.scale.setScalar(1000); g.userData.propId = id; return g; }
};
function makeRoom(id, layout = { id: 'house' }) {
    const root = new THREE.Group(), chair = new THREE.Group(); chair.add(new THREE.Mesh(new THREE.BoxGeometry(600, 900, 600))); chair.position.set(0, 0, 900); chair.userData.propId = 'steelcase-leap-v2'; root.add(chair);
    const room = { id, root, token: 1, ready: Promise.resolve(), roomLayout: layout, assets: () => root.children.filter(o => o.userData.propId && !o.name.startsWith('Person')), peopleState: null };
    return { room, chair };
}
const shown = people => people.people.filter(o => o.visible).map(o => o.userData.person.id);

{   // Home: seated at 28 in, nobody in between, standing at 43.5 in; the person follows the desk and brings a chair.
    const { room, chair } = makeRoom('home'), people = new RoomPeople(room, library);
    assert.ok(people.available); await people.setEnabled(true);
    people.update({ mode: 'afternoon', height: 28, pose: { x: 100, z: -500, yaw: 0 } });
    assert.deepEqual(shown(people).filter(id => /maya/.test(id)), ['people-maya-sit-type']);
    const maya = people.people.find(o => o.userData.person.id === 'people-maya-sit-type');
    assert.ok(Math.abs(maya.position.z - 445) < 1 && Math.abs(maya.position.x - 94) < 1, 'sits 945 mm in front of the desk anchor');
    assert.equal(maya.userData.personChair.visible, true); assert.equal(chair.visible, false, "the room's own chair steps aside");
    assert.equal(maya.userData.personFade, 1);
    people.update({ mode: 'afternoon', height: 29, pose: { x: 100, z: -500, yaw: 0 } });
    assert.ok(maya.visible && maya.userData.personFade > 0 && maya.userData.personFade < 1, 'fades as the desk leaves sitting height');
    people.update({ mode: 'afternoon', height: 36, pose: { x: 100, z: -500, yaw: 0 } });
    assert.deepEqual(shown(people).filter(id => /maya/.test(id)), []); assert.equal(chair.visible, true, 'the chair is back');
    people.update({ mode: 'afternoon', height: 30, pose: { x: 100, z: -500, yaw: 0 } });
    assert.deepEqual(shown(people).filter(id => /maya/.test(id)), ['people-maya-sit-type-30']);
    people.update({ mode: 'afternoon', height: 43.5, pose: { x: 100, z: -500, yaw: Math.PI / 2 } });
    assert.deepEqual(shown(people).filter(id => /maya/.test(id)), ['people-maya-stand-type']);
    const standing = people.people.find(o => o.userData.person.id === 'people-maya-stand-type');
    assert.ok(Math.abs(standing.position.x - (94 + 890)) < 1 && Math.abs(standing.position.z + 500) < 1, 'follows the desk when it turns');
    // With the keyboard's position known, the person lines up on the keyboard (a desktop keyboard sits further in).
    people.update({ mode: 'afternoon', height: 43.5, pose: { x: 100, z: -500, yaw: 0 }, keyboard: { x: 60, z: -240 } });
    assert.deepEqual([standing.position.x, standing.position.z], [60, 175]);
    await people.setEnabled(false); assert.deepEqual(shown(people), []);
    people.dispose(); assert.equal(people.people.length, 0);
}
{   // Film filter: only / except, and a one-off placement that also holds for a "beside" person.
    const { room } = makeRoom('workshop'), people = new RoomPeople(room, library);
    people.setFilter({ only: ['people-andre-stand-phone'], place: { 'people-andre-stand-phone': { at: [900, 2300], turn: 90 } } });
    await people.setEnabled(true); people.update({ height: 30, pose: { x: 0, z: 0, yaw: 0 } });
    assert.deepEqual(shown(people), ['people-andre-stand-phone']);
    const andre = people.people.find(o => o.userData.person.id === 'people-andre-stand-phone');
    assert.deepEqual([andre.position.x, andre.position.z], [900, 2300]);
    people.setFilter({ except: ['people-andre-stand-phone'] }); people.update({ height: 30, pose: { x: 0, z: 0, yaw: 0 } });
    assert.ok(!shown(people).includes('people-andre-stand-phone'));
}
{   // Stations: a pose only goes to a desk whose height it fits; layout-specific placements stay in their layout.
    const stations = [{ id: 'student-standing', at: [4380, 1000], turn: 0, height: 41 }, { id: 'window-research', at: [-4300, 1000], turn: 180, height: 36 }];
    const { room } = makeRoom('highschool', { id: 'spacious', stations }), people = new RoomPeople(room, library);
    await people.setEnabled(true); people.update({ mode: 'morning', height: 36, pose: { x: 0, z: 0, yaw: 0 } });
    const ids = shown(people);
    assert.ok(ids.includes('people-zoe-stand-type'), 'the 41 in pose fits the 41 in station');
    assert.ok(!ids.includes('people-mia-sit-type'), 'a 28 in pose is not put at a 36 in station');
    assert.ok(!ids.includes('people-hale-stand-present'), 'house-layout placements stay out of other layouts');
    const zoe = people.people.find(o => o.userData.person.id === 'people-zoe-stand-type');
    assert.deepEqual([zoe.position.x, zoe.position.z], [4380, 1890]);
}
{   // A person at one of the room's other desks follows that desk as it is now: where it stands, and sitting or standing with its height.
    const stations = [{ id: 'window-research', at: [-4300, 1000], turn: 0, height: 28 }];
    const { room } = makeRoom('highschool', { id: 'house', stations }), people = new RoomPeople(room, library);
    let desk = { height: 28, pose: { x: -4300, z: 1000, yaw: 0 } };
    const state = () => ({ mode: 'morning', height: 30, pose: { x: 0, z: 0, yaw: 0 }, station: id => id === 'window-research' ? desk : null });
    await people.setEnabled(true); people.update(state());
    const mia = () => people.people.filter(o => o.visible && /mia/.test(o.userData.person.id)).map(o => o.userData.person.id);
    assert.deepEqual(mia(), ['people-mia-sit-type'], 'seated while her desk is at 28 in');
    desk = { height: 43.5, pose: { x: -4000, z: 1200, yaw: 0 } }; people.update(state());
    assert.deepEqual(mia(), ['people-mia-stand-type'], 'she stands when her desk is raised');
    const up = people.byKey('people-mia-sit-type');
    assert.equal(up.userData.person.id, 'people-mia-stand-type', 'her name finds whichever of her postures is showing');
    assert.deepEqual([up.position.x, up.position.z], [-4000, 1200 + 890], 'and she is where the desk has been moved to');
    desk = { height: 36, pose: desk.pose }; people.update(state()); assert.deepEqual(mia(), ['people-mia-stand-low'], 'at bench height she stands low at it');
    desk = { height: 39.5, pose: desk.pose }; people.update(state()); assert.deepEqual(mia(), [], 'nobody works at a desk between bench and standing height');
    desk = { height: 30, pose: desk.pose }; people.update(state()); assert.deepEqual(mia(), ['people-mia-sit-type-30'], 'the 30 in seat at 30 in');
    assert.ok(!people.resolved().some(p => /mia-(stand-type|sit-type-30)/.test(p.id)), 'a film keeps the placement, not its other postures');
    // The Director's entry names the standing posture while the desk is down: she is there, seated (she used to vanish).
    people.setFilter({ only: [], cast: [{ key: 'm', id: 'people-mia-stand-type', desk: 'stand', station: 'window-research' }] }); await people.setEnabled(true);
    desk = { height: 28, pose: { x: -4300, z: 1000, yaw: 0 } }; people.update(state());
    assert.deepEqual(mia(), ['people-mia-sit-type']); assert.equal(people.keyOf(people.byKey('m').userData.person), 'm');
    assert.deepEqual(people.list().filter(p => p.key === 'm' && p.visible).map(p => p.variant), ['m']);
}
{   // Film casting: extra people (one model twice, by key), the seconds each is there for, and a chair that stays.
    const { room, chair } = makeRoom('creative'), people = new RoomPeople(room, library);
    people.setFilter({ only: [], cast: [{ key: 'at-easel', id: 'people-lin-stand-paint', at: [-1700, 2500], turn: 0 }, { key: 'at-desk', id: 'people-lin-stand-paint', at: [-200, -130], turn: 180, y: 40 }],
        when: { 'at-easel': [[0, 14]], 'at-desk': [[19.5, 99, 0, 0]] } });
    await people.setEnabled(true);
    const keys = () => people.people.filter(o => o.visible).map(o => o.userData.person.key);
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 }, time: 2 }); assert.deepEqual(keys(), ['at-easel']);
    const easel = people.people.find(o => o.userData.person.key === 'at-easel'), desk = people.people.find(o => o.userData.person.key === 'at-desk');
    assert.equal(easel.userData.personFade, 1, 'there from the first frame: no fade in at the start of a chapter');
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 }, time: 13.8 }); assert.ok(easel.userData.personFade > 0 && easel.userData.personFade < 1, 'fades out over the last half second');
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 }, time: 19.49 }); assert.deepEqual(keys(), []);
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 }, time: 19.5 }); assert.deepEqual(keys(), ['at-desk']);
    assert.equal(desk.userData.personFade, 1, 'a zero fade cuts');
    assert.deepEqual([desk.position.x, desk.position.y, desk.position.z], [-200, 40, -130]);
    people.update({ height: 43.5, pose: { x: 0, z: 0, yaw: 0 } }); assert.deepEqual(keys(), ['at-easel', 'at-desk'], 'without a film time everyone is there');
    // A different cast rebuilds the room's people.
    people.setFilter({ only: ['people-maya-sit-type', 'people-maya-stand-type'], chair: { back: 300, side: 760, turn: -42 } }); await people.setEnabled(true);
    assert.ok(!people.people.some(o => o.userData.person.extra), 'the earlier chapter\'s extras are gone');
    people.update({ height: 28, pose: { x: 100, z: -500, yaw: 0 }, keyboard: { x: 100, z: -30 } });
    const seat = people.people.find(o => o.userData.person.id === 'people-maya-sit-type').userData.personChair;
    assert.deepEqual([seat.visible, seat.position.x, seat.position.z], [true, 100, 440], 'under her while she sits');
    people.update({ height: 36, pose: { x: 100, z: -500, yaw: 0 }, keyboard: { x: 100, z: -30 } });
    assert.deepEqual(shown(people), []); assert.deepEqual([seat.visible, seat.position.x, seat.position.z], [true, 860, 740], 'pushed back and aside while she is up');
    assert.equal(chair.visible, false, "the room's own chair stays out while hers is in the room");
}
{   // The daypart decides who is there; a film chapter that names someone in `only` shows them at any daypart.
    const { room } = makeRoom('library', { id: 'humboldt' }), people = new RoomPeople(room, library);
    await people.setEnabled(true);
    const at = mode => { people.update({ mode, height: 43, pose: { x: 0, z: 0, yaw: 0 } }); return shown(people); };
    assert.ok(!at('morning').includes('people-zoe-walk'), 'one Zoe per frame: the walker is not in the Studio');
    assert.ok(at('afternoon').includes('people-noah-carry-box') && !at('morning').includes('people-noah-carry-box'));
    people.setFilter({ only: ['people-zoe-walk', 'people-ben-white-cane'] }); await people.setEnabled(true);
    assert.deepEqual(at('night').sort(), ['people-ben-white-cane', 'people-zoe-walk'], "a film cut's own choice stands at any daypart");
    const night = castEntries('home', { id: 'house', width: 3600, depth: 4200, back: -1450 }).filter(s => !s.modes || s.modes.includes('night'));
    assert.ok(night.every(s => s.desk), 'home at night: only the desk user');
    const party = castEntries('home', { id: 'house', width: 3600, depth: 4200, back: -1450 }).filter(s => s.modes?.includes('party'));
    assert.ok(party.length >= 3 && party.every(s => !s.desk), 'home party: guests, nobody at the desk');
}
console.log('PASS room people: library entries, desk-height casting and fade, chair hand-over, film filter and placement, film casting, stations.');
