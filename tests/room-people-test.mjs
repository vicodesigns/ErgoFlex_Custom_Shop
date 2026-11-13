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

{   // The gym: people on the equipment, each on the machine their posture was built on, from the size that has it.
    const { GYM_LAYOUTS } = await import('../gym-room.mjs');
    const on = (L, pose) => castEntries('gym', L).filter(s => entries.get(s.id)?.person?.pose === pose);
    assert.equal(castEntries('gym', GYM_LAYOUTS.apartment).filter(s => /gym-/.test(s.id)).length, 0, 'the nook has no machines and nobody on one');
    for (const [id, L] of Object.entries(GYM_LAYOUTS)) {
        if (!L.tier) continue;
        assert.ok(on(L, 'gym-cycle').length === 2 && on(L, 'gym-cycle').every(s => s.by === 'spin-bike' && s.turn === 180), id + ': riders on the bike, facing its handlebar');
        const riders = on(L, 'gym-cycle').flatMap(s => s.modes); assert.equal(new Set(riders).size, riders.length, id + ': one rider at a time');
        assert.equal(on(L, 'gym-pullup').length, L.tier >= 2 ? 1 : 0, id + ': the rack\'s bar from the studio up');
        assert.equal(on(L, 'gym-press').length, L.tier >= 2 ? 1 : 0, id + ': the bench press from the studio up');
    }
    assert.ok(!castEntries('gym', GYM_LAYOUTS.house).some(s => /gym-/.test(s.id) && s.modes.includes('morning')), 'the film\'s gym (house, morning) keeps its cast');
    const walkers = castEntries('gym', GYM_LAYOUTS.executive).filter(s => s.tread); assert.ok(walkers.length === 2 && walkers.every(s => s.by === 'treadmill' && s.up === 186), 'walkers stand on the treadmill\'s belt');
    for (const s of castEntries('gym', GYM_LAYOUTS.executive).filter(s => /gym-/.test(s.id))) assert.ok(readFileSync(new URL('../assets/props/people-rigs/' + s.id.split('-')[1] + '.json', import.meta.url), 'utf8').includes(`"${s.id}"`), s.id + ' has its bones on file (it moves)');
}
{   // Rooms without their own cast get a desk user; the children's rooms have children in them, on child furniture.
    const cast = id => new RoomPeople({ id, roomLayout: { id: 'house' } }, null).specs();
    // the institutional rooms have casts of their own: the person at the mobile desk at each of its four heights, the others
    // at the room's other desks (in the layouts that have them), on its seats and by its furniture, each for their hours
    for (const room of ['government', 'police', 'security', 'hospital', 'laboratory', 'mobileit', 'middleschool', 'college', 'university']) {
        const c = cast(room), desk = c.filter(s => s.desk && !s.station), others = c.filter(s => !s.desk);
        assert.deepEqual(desk.map(s => s.desk), ['sit', 'sit', 'stand', 'stand'], room + ': someone at the mobile desk, seated and standing');
        for (const spec of desk) assert.ok(entries.get(spec.id)?.person?.deskHeight, spec.id + ' is built');
        assert.ok(others.length >= 6 && others.every(s => s.modes?.length), room + ': a cast, each for their hours');
        assert.ok(others.every(s => s.on || s.by || s.around || (s.at && s.clear)), room + ': placed on a seat, by furniture, or at a spot that is checked for room');
        assert.ok(others.filter(s => s.on).every(s => s.toward || /armchair|waiting-seats|briefing-seat|lounge-seat|chair-modern-cushion|care-bed/.test(String(s.on))), room + ': a seated person faces what the seat belongs to');
    }
    {   // with the layout's other desks: staff at them, nobody twice in a daypart, one person to a desk
        const { INSTITUTIONAL_ROOMS } = await import('../institutional-scenes.mjs');
        for (const [room, def] of Object.entries(INSTITUTIONAL_ROOMS)) for (const L of Object.values(def.layouts)) {
            const specs = castEntries(room, L); if (!specs.length) continue;
            for (const phase of PHASES) {
                const shown = specs.filter(s => !s.modes || s.modes.includes(phase)), where = new Map(), at = new Map();
                for (const s of shown) { const who = s.id.split('-')[1], spot = s.desk && !s.station ? 'desk' : s.station ? 'station ' + s.station : s.key || s.id; where.set(who, (where.get(who) || new Set()).add(spot)); if (s.station) at.set(s.station, (at.get(s.station) || new Set()).add(who)); }
                for (const [who, spots] of where) assert.equal(spots.size, 1, `${room} ${L.id} ${phase}: ${who} is in one place (${[...spots].join(', ')})`);
                for (const [station, who] of at) assert.equal(who.size, 1, `${room} ${L.id} ${phase}: one person at ${station}`);
            }
        }
    }
    // the living and working rooms keep that desk user and add the people their furniture is there for, by a piece of furniture each
    for (const room of ['study', 'office', 'kitchen', 'lounge', 'bedroom', 'gallery', 'coworking', 'scifi']) {
        const c = cast(room), desk = c.filter(s => s.desk), others = c.filter(s => !s.desk);
        assert.deepEqual(desk.map(s => s.desk), ['sit', 'sit', 'stand'], room + ': the desk user it always had');
        assert.ok(others.length >= 3 && others.every(s => s.on || s.by || s.around), room + ': everyone else is placed by a piece of furniture (absent where a layout lacks it)');
        assert.ok(others.every(s => s.modes?.length), room + ': each for their hours');
        assert.ok(others.filter(s => s.on).every(s => s.toward || /armchair|bench/.test(String(s.on))), room + ': a seated person faces what the seat belongs to');
        assert.ok(others.filter(s => s.by).every(s => s.clear) && others.filter(s => s.around && !/island/.test(s.around[0])).every(s => s.clear), room + ': whoever stands takes a free spot by their furniture (the cook stays at the island)');
        // the smallest layout has other furniture: it still has people in it, on what it does have
        const small = new RoomPeople({ id: room, roomLayout: { id: 'apartment' } }, null).specs().filter(s => !s.desk);
        assert.ok(small.length >= 2 && !small.some(s => /lounge-sofa|chair-modern-cushion|armchair-poppi|stone-island|^coffee-bar$/.test(String([].concat(s.on || s.by || s.around)[0])) && ['office', 'kitchen', 'bedroom'].includes(room)), room + ': the smallest layout is cast on its own furniture');
    }
    assert.ok(cast('office').every(s => !s.modes?.includes('night')) && cast('lounge').some(s => !s.desk && s.modes.includes('night')), 'the office is closed at night, the lounge has its movie night');
    assert.deepEqual(cast('product'), []);
    const child = id => /^people-(tess|milo|lila|ravi|theo|ines|nora|jun|zuri|hugo|yuki|karim|lucia|kian)-kid-/.test(id), grownUp = id => !/-kid-/.test(id) && !/^people-(tess|milo|lila|ravi|theo|ines|nora|jun|zuri|hugo|yuki|karim|lucia|kian)-/.test(id);
    const early = new RoomPeople({ id: 'childroom', roomLayout: { id: 'house', ageStage: 'early', play: [0, 2150], reading: [-1150, 3050], desk: [1050, -250] } }, null).specs();
    assert.ok(early.some(s => child(s.id)) && early.every(s => child(s.id) || grownUp(s.id)), 'the toddler stage has a child, in child postures only');
    assert.ok(early.filter(s => s.modes?.includes('night')).length === 0, 'nobody is shown at night: the child is asleep');
    assert.ok(early.find(s => s.desk === 'stand' && s.reach < 800), 'the youngest stand at the desk on its lowest setting');
    const primary = new RoomPeople({ id: 'childroom', roomLayout: { id: 'houseprimary', ageStage: 'primary', play: [0, 2150], reading: [-1150, 3050], desk: [1200, -400] } }, null).specs();
    assert.ok(primary.find(s => s.desk === 'sit' && s.chair === false), 'a school child sits on the room\'s own stool at the desk');
    for (const room of ['kindergarten', 'elementary']) { const c = cast(room); assert.ok(c.filter(s => child(s.id)).length >= 6 && c.some(s => grownUp(s.id) && s.desk), room + ': children and a teacher at the desk');
        assert.ok(c.filter(s => child(s.id) && s.on).every(s => s.seat === (room === 'kindergarten' ? 260 : 360)), room + ': children sit on that room\'s chairs'); }
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

{   // A school child at the desk sits on a copy of the room's own study chair, facing the desk with them; the room's chair
    // is hidden where the room put it and is never moved (nothing for the Studio to save); it is back when the child leaves.
    const layout = { id: 'houseprimary', ageStage: 'primary', play: [0, 2150], reading: [-1150, 3050], desk: [1200, -400] };
    const { room, chair } = makeRoom('childroom', layout); chair.userData.propId = 'desk-stool'; chair.userData.seatFront = '-z'; chair.position.set(1200, 0, 550);   // (as child-room.mjs builds it: facing the desk)
    const people = new RoomPeople(room, library); await people.setEnabled(true);
    people.update({ mode: 'afternoon', height: 28, pose: { x: 1200, z: -400, yaw: 0 } });
    const nora = people.people.find(o => o.userData.person.id === 'people-nora-kid-sit-desk');
    assert.ok(nora?.visible, 'Nora does her homework at the desk in the afternoon');
    const seat = [...people.kidSeats.values()][0];
    assert.ok(seat && seat.source === chair && seat.copy.visible && seat.copy.parent === nora.parent, 'she has a seat of the room\'s kind under her');
    assert.ok(Math.abs(seat.copy.position.x - nora.position.x) < 1 && Math.abs(seat.copy.position.z - nora.position.z) < 1 && Math.abs(seat.copy.rotation.y - nora.rotation.y - Math.PI) < 1e-6, 'under her, facing the way she faces (this seat is built facing -z, she faces +z)');
    assert.ok(!chair.visible && chair.position.x === 1200 && chair.position.z === 550 && chair.rotation.y === 0, 'the room\'s chair is hidden, not moved');
    assert.ok(!room.assets().includes(seat.copy) && seat.copy.userData.propId === undefined, 'the copy is not a piece of the room\'s furniture');
    people.update({ mode: 'evening', height: 28, pose: { x: 1200, z: -400, yaw: 0 } });
    assert.ok(!nora.visible && !seat.copy.visible && chair.visible, 'in the evening she reads on the floor: the copy is gone and the room\'s chair is back');
    await people.setEnabled(false); assert.ok(chair.visible && [...people.kidSeats.values()].every(k => !k.copy.visible), 'people off: the room as it was');
    // a chair the room has pushed further back than the adults' 1.3 m is still out while its copy is under the child
    await people.setEnabled(true); chair.position.set(1200, 0, 2050);
    people.update({ mode: 'afternoon', height: 28, pose: { x: 1200, z: -400, yaw: 0 } });
    assert.ok(!chair.visible && [...people.kidSeats.values()].some(k => k.copy.visible), 'a chair pushed 1.5 m back does not stand in the room twice');
    // what a film chapter takes over, and a child the Director puts at the desk (no chair flag): no task chair, the room's seat
    const taken = people.resolved().find(c => c.id === 'people-nora-kid-sit-desk');
    assert.ok(taken && taken.desk === 'sit' && taken.chair === false, 'the hour\'s cast hands the seat on with the child');
    people.dispose(); assert.equal(people.kidSeats.size, 0, 'dispose takes the copies out');
    const film = new RoomPeople(room, library); film.setFilter({ only: [], cast: [{ key: 'kid', id: 'people-jun-kid-sit-desk', desk: 'sit' }] }); await film.setEnabled(true);
    chair.position.set(1200, 0, 550); film.update({ mode: 'afternoon', height: 28, pose: { x: 1200, z: -400, yaw: 0 }, time: 1, now: 0 });
    const jun = film.people.find(o => o.userData.person.id === 'people-jun-kid-sit-desk');
    assert.ok(jun?.visible && !jun.userData.personChair && film.actors.every(a => !a.chair), 'a child at the film desk brings no task chair');
    assert.ok([...film.kidSeats.values()].some(k => k.copy.visible && k.source === chair) && !chair.visible, 'and sits on a copy of the room\'s seat');
    film.dispose();
    // any other room's desk chair is a library chair, built facing +z like the people: its copy is not turned
    const { room: office, chair: leap } = makeRoom('office'), other = new RoomPeople(office, library); leap.position.set(0, 0, 600);
    other.setFilter({ only: [], cast: [{ key: 'kid', id: 'people-jun-kid-sit-desk', desk: 'sit' }] }); await other.setEnabled(true);
    other.update({ mode: 'afternoon', height: 28, pose: { x: 0, z: -400, yaw: 0 }, time: 1, now: 0 });
    const kid = other.people.find(o => o.userData.person.id === 'people-jun-kid-sit-desk'), under = [...other.kidSeats.values()][0];
    assert.ok(kid.visible && under?.source === leap && Math.abs(under.copy.rotation.y - kid.rotation.y) < 1e-6, 'a child at an office desk sits on that room\'s chair the right way round');
    other.dispose();
}
{   // A free spot: a guest whose place round the bench is taken by a sculpture in this size of the room stands at the
    // nearest free place round it instead, still facing it, clear of the others; with nowhere to stand they are not there.
    const prop = (room, id, size, at) => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(...size)); m.position.y = size[1] / 2; g.add(m); g.position.set(at[0], 0, at[1]); g.userData.propId = id; room.root.add(g); return g; };
    const { room } = makeRoom('gallery', { id: 'house', width: 4800, depth: 5800, back: -1800 });
    prop(room, 'gallery-bench', [1800, 505, 480], [0, 1200]);
    const a = THREE.MathUtils.degToRad(300), loop = prop(room, 'marble-loop', [631, 826, 620], [Math.sin(a) * 1400, 1200 + Math.cos(a) * 1400]);
    // a loose chair near where Andre would stand: clear of its box, but close enough that the room would take the chair away
    const stool = prop(room, 'kenney-furniture-chair-modern-cushion', [510, 781, 608], [Math.sin(Math.PI / 3) * 1400 + 560, 1200 + Math.cos(Math.PI / 3) * 1400]);
    const people = new RoomPeople(room, library); await people.setEnabled(true); people.update({ mode: 'party', height: 43.5, pose: { x: 1501, z: -795, yaw: 0 } });
    const guests = people.people.filter(o => o.visible && o.userData.person.around), rosa = guests.find(o => o.userData.person.id === 'people-rosa-stand-drink');
    assert.equal(guests.length, 3, 'the three opening night guests are there');
    for (const g of guests) assert.ok(Math.hypot(g.position.x - stool.position.x, g.position.z - stool.position.z) >= 619, 'nobody stands where the room would have to take a chair away');
    assert.ok(stool.visible, 'and the chair is still there');
    const gap = (o, g) => Math.hypot(Math.max(Math.abs(o.position.x - g.position.x) - 631 / 2, 0), Math.max(Math.abs(o.position.z - g.position.z) - 620 / 2, 0));
    assert.ok(gap(rosa, loop) >= 259, 'Rosa stands clear of the sculpture that is where she was put');
    const far = Math.hypot(rosa.position.x, rosa.position.z - 1200), facing = new THREE.Vector3(Math.sin(rosa.rotation.y), 0, Math.cos(rosa.rotation.y)), toBench = new THREE.Vector3(-rosa.position.x, 0, 1200 - rosa.position.z).normalize();
    assert.ok(far > 1150 && far < 1650 && facing.dot(toBench) > .999, 'still round the bench, facing it');
    for (const g of guests) for (const h of guests) if (g !== h) assert.ok(Math.hypot(g.position.x - h.position.x, g.position.z - h.position.z) >= 649, 'the guests keep their distance from each other');
    for (const g of guests) assert.ok(Math.abs(g.position.x) < 2400 - 300 && g.position.z > -1800 + 300 && g.position.z < 4000 - 250, 'inside the room, off its walls');
    for (const g of guests) { const dx = g.position.x - 1501, dz = g.position.z + 795; assert.ok(!(Math.abs(dx) < 1150 && dz > -750 && dz < 1350), 'and out of the way of the desk and whoever is at it'); }
    people.dispose();
    const tiny = makeRoom('gallery', { id: 'house', width: 1000, depth: 1000, back: 700 }).room; prop(tiny, 'gallery-bench', [1800, 505, 480], [0, 1200]);
    const none = new RoomPeople(tiny, library); await none.setEnabled(true); none.update({ mode: 'party', height: 43.5, pose: { x: 0, z: 0, yaw: 0 } });
    assert.ok(none.people.filter(o => o.userData.person.around).every(o => !o.visible && o.userData.personMissing), 'no room to stand: the guests are not shown inside the furniture');
    none.dispose();
}
{   // A free spot along a counter: Priya's place at the service counter has the robot dog in it, so she stands further
    // along the counter, still facing it; when the desk is moved to where she is, she looks for a place again.
    const prop = (room, id, size, at, turn = 0) => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(...size)); m.position.y = size[1] / 2; g.add(m); g.position.set(at[0], 0, at[1]); g.rotation.y = turn; g.userData.propId = id; room.root.add(g); return g; };
    const { room } = makeRoom('scifi', { id: 'house', width: 5200, depth: 6200, back: -1800 });
    prop(room, 'service-counter', [1880, 1270, 793], [-2186, 350], Math.PI / 2); prop(room, 'robot-dog', [550, 315, 700], [-1436, 350]);
    const people = new RoomPeople(room, library); await people.setEnabled(true); people.update({ mode: 'morning', height: 43.5, pose: { x: 1701, z: -795, yaw: 0 } });
    const priya = people.people.find(o => o.userData.person.id === 'people-priya-stand-work');
    assert.ok(priya.visible && Math.abs(priya.position.x + 1436) < 1 && Math.abs(priya.position.z - 350) >= 609, 'Priya stands at the counter, along from the dog');
    assert.ok(new THREE.Vector3(Math.sin(priya.rotation.y), 0, Math.cos(priya.rotation.y)).dot(new THREE.Vector3(-1, 0, 0)) > .999, 'facing the counter');
    const was = priya.position.clone(), desk = { x: was.x, z: was.z - 200, yaw: 0 };
    people.update({ mode: 'morning', height: 43.5, pose: desk });
    const dx = priya.position.x - desk.x, dz = priya.position.z - desk.z;
    assert.ok(!priya.visible || !(Math.abs(dx) < 1150 && dz > -750 && dz < 1350), 'the desk moved to where she stood: she is out of its way (or gone), in the same hour');
    people.dispose();
}
{   // toward: a chair far along a long table faces the table (its nearest edge), not the table's middle from the side.
    const prop = (room, id, size, at) => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(...size)); m.position.y = size[1] / 2; g.add(m); g.position.set(at[0], 0, at[1]); g.userData.propId = id; room.root.add(g); return g; };
    const { room } = makeRoom('kitchen', { id: 'executive', width: 8200, depth: 9000, back: -2000 });
    prop(room, 'dining-table', [2813, 740, 1019], [28, 5681]);
    for (const at of [[-982, 4922], [-960, 6477], [17, 4900], [39, 6454]]) prop(room, 'kenney-furniture-chair-modern-cushion', [510, 781, 608], at);
    const people = new RoomPeople(room, library); await people.setEnabled(true); people.update({ mode: 'party', height: 38, pose: { x: -3199, z: 255, yaw: 0 } });
    const hale = people.people.find(o => o.userData.person.id === 'people-hale-sit-chat'), andre = people.people.find(o => o.userData.person.key === 'andre-dinner');
    const yaw = o => Math.atan2(Math.sin(o.rotation.y), Math.cos(o.rotation.y));
    assert.ok(hale.visible && Math.abs(Math.abs(yaw(hale)) - Math.PI) < .01, 'Hale, on the chair at the far end of the front side, faces the table (not along it)');
    assert.ok(andre.visible && Math.abs(yaw(andre)) < .01, 'Andre, on the back side, faces it from there');
    people.dispose();
}
{   // Round a rug: at that angle and distance from its middle, facing it; a room without the rug leaves the person out.
    const { room } = makeRoom('kindergarten', { id: 'apartment' }), rug = new THREE.Group(); rug.add(new THREE.Mesh(new THREE.BoxGeometry(1800, 10, 1800))); rug.position.set(-1745, 0, 3300); rug.userData.propId = 'circle-rug'; room.root.add(rug);
    const people = new RoomPeople(room, library); await people.setEnabled(true); people.update({ mode: 'morning', height: 43.5, pose: { x: -1750, z: -500, yaw: 0 } });
    const tess = people.people.find(o => o.userData.person.id === 'people-tess-kid-sit-floor'), a = THREE.MathUtils.degToRad(200);
    assert.ok(tess.visible && Math.abs(tess.position.x - (-1745 + Math.sin(a) * 560)) < 1 && Math.abs(tess.position.z - (3300 + Math.cos(a) * 560)) < 1, 'Tess sits 560 mm from the middle of the rug, at 200 degrees');
    const facing = new THREE.Vector3(Math.sin(tess.rotation.y), 0, Math.cos(tess.rotation.y)), toMiddle = new THREE.Vector3(-1745 - tess.position.x, 0, 3300 - tess.position.z).normalize();
    assert.ok(facing.dot(toMiddle) > .999, 'facing the middle of it');
    rug.position.set(-1000, 0, 3000); people.update({ mode: 'afternoon', height: 35, pose: { x: -1750, z: -500, yaw: 0 } }); people.update({ mode: 'morning', height: 43.5, pose: { x: -1750, z: -500, yaw: 0 } });
    assert.ok(Math.abs(tess.position.x - (-1000 + Math.sin(a) * 560)) < 1, 'and follows the rug when the room moves it for another hour');
    assert.ok(people.people.filter(o => o.userData.person.on === 'story-rocker').every(o => !o.visible), 'no rocker in this room: the teacher is not shown hovering');
    people.dispose();
}
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
    desk = { height: 39.5, pose: desk.pose }; people.update(state()); assert.deepEqual(mia(), ['people-mia-stand-mid'], 'at 38 to 40 in she stands at it in the mid-height posture');
    desk = { height: 33, pose: desk.pose }; people.update(state()); assert.deepEqual(mia(), [], 'nobody works at a desk between sitting and bench height');
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
{   // The Studio loads the people of the hour and brings the others when their hour comes; a film loads its whole cast.
    const { INSTITUTIONAL_ROOMS } = await import('../institutional-scenes.mjs');
    const layout = INSTITUTIONAL_ROOMS.government.layouts.spacious, mode = { now: 'morning' }, loads = [];
    const counting = { ...library, instance: async id => { loads.push(id); return library.instance(id); } };
    const { room } = makeRoom('government', layout); room.peopleState = () => ({ mode: mode.now, height: 43.5, pose: { x: layout.desk[0], z: layout.desk[1], yaw: 0 } });
    const all = castEntries('government', layout), mornings = all.filter(s => !s.modes || s.modes.includes('morning')).length;
    globalThis.__PEOPLE_LAZY__ = true;
    const people = new RoomPeople(room, counting); await people.setEnabled(true);
    const first = people.people.length;
    assert.ok(people.waiting.length > 15 && first < people.people.length + people.waiting.length, 'the cast of the other hours waits');
    assert.ok(people.people.every(o => { const s = o.userData.person; return !s.modes || s.modes.includes('morning') || (s.desk && !s.station); }), 'only the morning\'s people (and whoever is at the mobile desk) are loaded');
    assert.ok(people.people.filter(o => !o.userData.person.variant).length >= mornings, 'everyone of the morning is there');
    mode.now = 'afternoon'; people.update(room.peopleState()); await people.settled();
    people.update(room.peopleState());
    assert.ok(people.people.length > first + 8, 'the afternoon\'s people were brought in when the hour changed');
    assert.ok(people.people.some(o => o.visible && o.userData.person.station === 'counter-accessible' && o.userData.person.modes.join() === 'afternoon'), 'and they are shown (the clerk at the accessible counter)');
    assert.ok(!people.waiting.some(s => s.modes.includes('afternoon')), 'nobody of the afternoon still waits');
    mode.now = 'morning'; people.update(room.peopleState()); const again = loads.length; mode.now = 'afternoon'; people.update(room.peopleState()); await people.settled();
    assert.equal(loads.length, again, 'an hour that was loaded is not loaded again');
    delete globalThis.__PEOPLE_LAZY__;
    const { room: set } = makeRoom('government', layout); set.peopleState = room.peopleState;
    const film = new RoomPeople(set, library); film.setFilter({}); await film.setEnabled(true);
    assert.equal(film.waiting.length, 0, 'a film loads the whole cast at once');
    const studioOnly = castEntries('occmedialab', { id: 'house', index: 1, width: 10200, depth: 13000, back: -4333, stations: [] }).filter(s => s.studio);
    const { room: lab } = makeRoom('occmedialab', { id: 'house', index: 1, width: 10200, depth: 13000, back: -4333, stations: [] });
    const coast = new RoomPeople(lab, library); coast.setFilter({ except: [] });
    assert.ok(studioOnly.length >= 2 && !coast.specs().some(s => s.studio), 'people marked for the Studio are not in a film that takes the whole room');
}
console.log('PASS room people: library entries, desk-height casting and fade, chair hand-over, film filter and placement, film casting, stations, loading by the hour.');
