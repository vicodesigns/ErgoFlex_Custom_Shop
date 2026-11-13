// People who live and work in the rooms (Studio "People" toggle, film `people`).
//
// The models are posed, static library props (category "people", built by
// tools/people/build.py). This module decides who is in which room and keeps
// the person at the featured desk honest: a seated typist is only there while
// the desk is at sitting height, a standing one while it is raised, and both
// follow the desk when it glides. Poses are built for measured furniture
// (tools/people/cast.py), so every desk user brings the task chair the pose was
// built on, and the room's own chair at that spot steps aside.
//
// Placements, in room millimetres:
//   { id, desk: 'sit' | 'stand' | 'wheel' }           at the featured desk, while its height suits the model
//                                                     (the model's library entry carries person.deskHeight, inches)
//   { id, station: '<id>', desk: ... }                at one of the room's other ErgoFlex desks (layout.stations); they
//                                                     follow that desk as the featured desk's user follows theirs
// Anyone at a desk sits or stands with it: beside the model a placement names, the same character's other desk
// postures are loaded under the same key (deskFamily) and whichever was built for the desk's height now is shown.
//   { id, beside: [dx, dz] }                          near the featured desk (its own frame), facing it
//   { id, on: '<prop id>' | ['<prop id>', n] }        seated on that piece of furniture, facing the way it faces
//                                                     (`turn` degrees to correct a model; `along` / `depth` mm to slide)
//   { id, near: [x, z], face: [x, z] }                seated on the chair nearest that spot, facing a point (a table)
//   { id, by: '<prop id>', reach }                    standing in front of that furniture, facing it
//   { id, around: ['<prop id>', degrees, mm] }        round a rug, a mat or a table: at that angle and distance from its middle, facing it
//   toward: '<prop id>' | ['<id prefix>', ...]        with on / near: seated the way the seat allows that faces that prop
//                                                     (a list: the nearest piece whose id starts with one of them)
//   clear: true                                       with by / around: the nearest spot along / round that prop that is free of
//                                                     furniture, walls, the desk and the others there then (none: not there)
//   { id, at: [x, z], turn, y }                       at a spot (y mm lifts a seated pose onto a seat that is not a prop);
//                                                     with clear: true there or the nearest free place within half a metre
//   scale: n                                          a factor on the model's size (any placement; 1 = as built)
//   colors: { top, bottom, shoes, hair: '#rrggbb' }   recolours those parts of the model (the fabric's shading is kept)
//   pose: { '<bone>': [x, y, z, w] }                  fine tuning: turns that bone of the model's skeleton from the pose it
//                                                     was built in (a quaternion in the bone's own frame; the Director's
//                                                     pose mode writes these). Only such a person is drawn skinned.
//   chair: false                                      at a desk: seated on the room's own kind of seat (a copy of the desk's stool or
//                                                     study chair, under the child), not on the adults' task chair
//   seat: mm                                          the seat height the pose was built for; the person is raised or
//                                                     lowered (a little) onto the real seat
//   walk: { path: [[x, z], ...] | to: [x, z], start: seconds, pace: steps a second, then: '<model id>' }
//                                                     film only, on a standing person: from `start` they walk the path
//                                                     (from where they stand, or along `path`) and stand at its end, in
//                                                     the posture of `then` if given; they face along the path at both ends
//   layout: '<layout id>'                             only in that room layout;  modes: [...] only in those dayparts
//   key: '<name>'                                     a name for this placement when one model is used twice
//   studio: true                                      only in the Studio: left out whenever a film casts the room (its chapters stay as they were)
// Not scene assets: the Studio's Rearrange mode and saved room edits leave them
// alone. The film casts each chapter through a filter (setFilter): who is in, who is moved, extra people of its
// own, and the seconds of the chapter each one is there for.
import * as THREE from 'three';
import { PersonRig, DeskActor, solveStill, solveChange, walkPlan, solveWalk, solveTread, WORKOUTS, drawPose, livelyPose, seedOf } from './room-people-motion.mjs?v=polish-20261112d';

// How far in front of a desk's anchor the person's pelvis is (mm), for a keyboard on the pull-out tray, and how far
// behind the keyboard's centre it is wherever the keyboard really sits (tray or desktop).
const REACH = { sit: 945, wheel: 935, stand: 890 };
const BEHIND_KEYS = { sit: 470, wheel: 460, stand: 415 };
const HEIGHT_FIT = 1.4;                       // inches either side of the height a desk pose was built for
const LIVELY = 4;                             // Studio: how many people besides the desk user breathe and shift (the nearest to the camera)
const HEIGHT_SOLID = .45;                     // within this the person is fully there; beyond it they fade out to HEIGHT_FIT
const NEARBY = [[0, 0], [250, 0], [-250, 0], [0, 250], [0, -250], [350, 350], [-350, 350], [350, -350], [-350, -350], [550, 0], [-550, 0], [0, 550], [0, -550]];   // where a person at a spot looks for room (mm)
const TASK_CHAIR = 'steelcase-leap-v2';       // seat 435 mm: what the seated desk poses were built on
// A child's seated desk posture is built on the room's own study seat (495 mm), not on the task chair: said with
// chair: false, and implied by the model (a film or the Director placing a child at the desk needs no flag).
const ownSeat = spec => spec.desk === 'sit' && (spec.chair === false || /-kid-sit-desk(-|$)/.test(spec.id));
const CHAIRS = /chair|stool|steelcase-leap|aeron/i;
// Which part of a person a material is (MakeHuman names: 'Human.<asset>'); null = skin, eyes, teeth, things held.
const NOT_WORN = /^(body|low-poly|teeth|tongue|eyebrow|eyelashes|eyes)/i, PARTS = { glasses: /glasses/i, shoes: /shoe|flats|boot|sneaker/i, bottom: /pants|skirt|jeans|shorts|trousers/i, hair: /hair|ponytail|afro|bob|braid|bun|^short\d|^long\d|mohawk|pigtail/i };
export const partOf = name => { if (!/^Human\./.test(name || '')) return null; const n = name.slice(6); if (NOT_WORN.test(n)) return null; for (const [part, re] of Object.entries(PARTS)) if (re.test(n)) return part; return 'top'; };
// What a garment looks like as built: its average colour and brightness (linear), over all of it and separately above
// and below the waist (personLower, workspace-3d.mjs), read from its texture where its vertices sit.
const statCache = new WeakMap();
function garmentStats(object, material) {
    const blank = { color: [.25, .26, .28], lum: .2 }, none = { all: blank, up: blank, low: blank };
    const image = material.map?.image; if (!image || typeof document === 'undefined') return none;
    let mesh = null; object.traverse(o => { if (!mesh && o.isMesh && [].concat(o.material).includes(material)) mesh = o; });
    const uv = mesh?.geometry.getAttribute('uv'); if (!uv) return none;
    if (statCache.has(mesh.geometry)) return statCache.get(mesh.geometry);
    let out = none;
    try {
        const N = 96, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, N, N);
        const d = g.getImageData(0, 0, N, N).data, lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }, lower = mesh.geometry.getAttribute('personLower');
        const sums = { all: [0, 0, 0, 0], up: [0, 0, 0, 0], low: [0, 0, 0, 0] }, step = Math.max(1, Math.floor(uv.count / 4000)), k = material.color || { r: 1, g: 1, b: 1 };
        for (let i = 0; i < uv.count; i += step) {
            const x = Math.min(N - 1, Math.max(0, Math.floor((uv.getX(i) % 1 + 1) % 1 * N))), y = Math.min(N - 1, Math.max(0, Math.floor((uv.getY(i) % 1 + 1) % 1 * N))), at = (y * N + x) * 4;
            if (d[at + 3] < 128) continue;
            const rgb = [lin(d[at]) * k.r, lin(d[at + 1]) * k.g, lin(d[at + 2]) * k.b];
            for (const key of ['all', lower && lower.getX(i) > .5 ? 'low' : 'up']) { const t = sums[key]; t[0] += rgb[0]; t[1] += rgb[1]; t[2] += rgb[2]; t[3]++; }
        }
        const mean = t => t[3] > 8 ? { color: [t[0] / t[3], t[1] / t[3], t[2] / t[3]], lum: Math.max(.01, (.2126 * t[0] + .7152 * t[1] + .0722 * t[2]) / t[3]) } : null;
        const all = mean(sums.all) || blank; out = { all, up: mean(sums.up) || all, low: mean(sums.low) || all };
    } catch { /* a texture the canvas cannot read keeps the default */ }
    statCache.set(mesh.geometry, out); return out;
}
const hexOf = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(1, v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055)) * 255).toString(16).padStart(2, '0')).join('');

// ---- Who is where, and when -----------------------------------------------------------------------------------
// Each daypart of a room tells its own hour: the room's *_MODES give it a label, an activity and a desk height, and the
// cast follows that script (an early start with a coffee, seated focus after lunch, a few guests standing with drinks
// at the party, one person or nobody at night). An entry may also be a function of the room layout ({ id, width,
// depth, back, desk }) returning placements, for people whose spot depends on the room's size.
// Film cuts name people by key in `only`, `except` and `place`: those keys stay resolvable. `modes: []` keeps a
// placement resolvable for a film cut that names it, but never shows it in the Studio.
const DAY = ['morning', 'afternoon', 'evening', 'night'];
const deg = r => Math.round(THREE.MathUtils.radToDeg(r));
// standing (or sitting on something that is not a prop) at a spot, facing a point
const spot = (id, x, z, to, extra = {}) => ({ id, at: [Math.round(x), Math.round(z)], turn: deg(Math.atan2(to[0] - x, to[1] - z)), ...extra });
// the person at the featured desk: their typing poses at 28, 30 and 43.5 in, for those dayparts
const crewOf = (who, modes, extra = {}) => [['sit-type', 'sit'], ['sit-type-30', 'sit'], ['stand-type', 'stand']].map(([pose, desk]) => ({ id: `people-${who}-${pose}`, desk, modes, ...extra }));
// people standing round a point, facing it (a conversation): ids or [id, extra]; `from` turns the ring (degrees)
const ring = (centre, radius, people, extra = {}, from = 0) => people.map((p, i) => {
    const [id, more] = [].concat(p), a = THREE.MathUtils.degToRad(from + i * 360 / people.length);
    return spot(id, centre[0] + Math.sin(a) * radius, centre[1] + Math.cos(a) * radius, centre, { ...extra, ...(more || {}) });
});
const PARTY = { modes: ['party'] };
const NO_SEATED_TYPING = /^sam$/;   // built without the seated typing postures: only at desks that stand
// Rooms with several ErgoFlex desks (layout.stations): the people at them, as [station, who, dayparts, extra]. Each sits
// or stands with the height of that desk; a station the layout does not have (a smaller room) has nobody.
const staffAt = (L, rows) => rows.flatMap(([station, who, modes, extra]) => L.stations?.some(s => s.id === station)
    ? [{ id: `people-${who}-${extra?.desk === 'wheel' ? 'wheel-type' : NO_SEATED_TYPING.test(who) ? 'stand-type' : 'sit-type'}`, station, desk: NO_SEATED_TYPING.test(who) ? 'stand' : 'sit', ...(modes ? { modes } : {}), ...extra }] : []);
// Someone across a station's desk from its user (a visitor at a counter): `mm` from the desk, facing it.
const across = (L, station, id, mm, extra = {}) => { const s = L.stations?.find(s => s.id === station); if (!s) return [];
    const a = THREE.MathUtils.degToRad(s.turn || 0), { side = 0, ...rest } = extra;
    return [spot(id, s.at[0] - Math.sin(a) * mm - Math.cos(a) * side, s.at[1] - Math.cos(a) * mm + Math.sin(a) * side, s.at, { clear: true, ...rest })]; };
// Someone standing beside a station's desk, turned the way its user would look (a teacher or a sergeant at a lectern that
// stands too close to the wall to get behind): `mm` to the side (negative: the other side), where there is room.
const besideStation = (L, station, id, mm = 950, extra = {}) => { const s = L.stations?.find(s => s.id === station); if (!s) return [];
    const a = THREE.MathUtils.degToRad(s.turn || 0), u = [Math.sin(a), Math.cos(a)], side = [Math.cos(a), -Math.sin(a)], x = s.at[0] + side[0] * mm + u[0] * 100, z = s.at[1] + side[1] * mm + u[1] * 100;
    return [spot(id, x, z, [x - u[0] * 2000, z - u[1] * 2000], { clear: true, ...extra })]; };
// The person at the featured desk at every height it is set to: seated at 28 and 30 in, standing at 35.5 and 43.5 in.
const deskCrew = (who, modes, extra = {}) => [['sit-type', 'sit'], ['sit-type-30', 'sit'], ['stand-low', 'stand'], ['stand-type', 'stand']].map(([pose, desk]) => ({ id: `people-${who}-${pose}`, desk, ...(modes ? { modes } : {}), ...extra }));
// A class at its tables, as [who, posture, chair, table, dayparts]: each on that chair, facing that table.
const atTables = rows => rows.map(([who, pose, chair, table, modes, extra]) => seated(`people-${who}-${pose}`, chair, table, { modes, key: `${who}-${chair}-${pose}`, ...extra }));
// Two or three talking in the open floor: at a place given as fractions of the room (0..1 across, 0..1 from the back
// wall to the front), each where there is room to stand (whoever finds none is not there).
const chat = (L, across, deep, people, extra = {}, radius = 520, from = 90) => ring([(L.left ?? -L.width / 2) + across * L.width, L.back + deep * L.depth], radius, people, { clear: true, ...extra }, from);
// How full a room is: 0 the smallest layout, 1 the middle one, 2 and up the large ones (people are added with the floor area).
const tier = L => Number.isFinite(L.index) ? L.index : Math.max(0, ['apartment', 'house', 'spacious', 'premium', 'executive'].indexOf(L.id));
// on a seat, sitting the way that faces what the seat belongs to (its table, the coffee table, the screen)
const seated = (id, on, toward, extra = {}) => ({ id, on, seat: /sit-(laptop|write|listen|raise)/.test(id) ? 450 : 420, toward, ...extra });
const DINING = 'kenney-furniture-chair-modern-cushion';
// standing by or round a piece of furniture, wherever there is room to (clear)
const standBy = (id, by, reach, extra = {}) => ({ id, by, reach, clear: true, ...extra });
const standRound = (id, prop, degrees, mm, extra = {}) => ({ id, around: [prop, degrees, mm], clear: true, ...extra });
// Clothes per room, so the same person does not wear the same outfit in every room of the film.
const LOOK = {
    gymMaya: { top: '#2d7d8a', bottom: '#1f2228', shoes: '#ececec' }, gymNoah: { top: '#c44a32', bottom: '#25272d', shoes: '#f0f0f0' },
    homeParty: { top: '#7b2f3d', bottom: '#2a2730' }, sofia: { top: '#c26a3e', bottom: '#2c303b' }, linNight: { top: '#4a4f5c', bottom: '#2b2b2e' },
    hale: { top: '#33465e', bottom: '#2d3036' }, ava: { top: '#2f5f8f', bottom: '#d8d2c4' }, kaiLab: { top: '#3a3d44', bottom: '#5b6470' },
    homeNight: { top: '#5d6b7a', bottom: '#2a2c33' }, benStudio: { top: '#7a5a3a', bottom: '#2b2d33' }, benSchool: { top: '#3d5a4a', bottom: '#30323a' }, graceSchool: { top: '#6a4d7d', bottom: '#2c2a33' }, graceShop: { top: '#3f6a6a', bottom: '#33302c' },
    omarStudio: { top: '#8a3f3a', bottom: '#2a2c31' }, omarSchool: { top: '#2f4d7a', bottom: '#2c2f36' }, omarShop: { top: '#4a5a3a', bottom: '#2b2b2b' },
    teacherK: { top: '#3f7a6b', bottom: '#2c2f38' }, teacherE: { top: '#8a5a3a', bottom: '#2a2d35' },
    guestA: { top: '#e2c26a', bottom: '#2f3440' }, guestB: { top: '#3f6b4f', bottom: '#d9d3c7' }, guestC: { top: '#8a4a7a', bottom: '#22252b' },
    guestD: { top: '#d76f4a', bottom: '#3a3f4a' }, guestE: { top: '#efe9df', bottom: '#4b3a33' },
    // work clothes: the rest of a squad or a watch beside the uniformed characters, a ward's staff, a lab's coats
    police: { top: '#1c2942', bottom: '#171b24', shoes: '#101114' }, guard: { top: '#25282d', bottom: '#1a1c20', shoes: '#101114' },
    scrubsTeal: { top: '#2f8f8a', bottom: '#2f8f8a', shoes: '#e9e9e6' }, scrubsBlue: { top: '#3d6fae', bottom: '#3d6fae', shoes: '#e9e9e6' }, scrubsPlum: { top: '#7a4a78', bottom: '#7a4a78', shoes: '#e9e9e6' },
    labCoat: { top: '#eef0ee', bottom: '#3a4250' }, techPolo: { top: '#2d5f8f', bottom: '#2b2f38' }
};

export const ROOM_PEOPLE = {
    // Maya's home office: 07:50 standing with the first coffee, seated focus at 14:35, tea and planning at 18:40 with
    // Grace reading in the armchair, alone at the desk at 23:20, friends with drinks at 21:15 (desk left alone).
    home: [
        { id: 'people-maya-stand-coffee', desk: 'stand', modes: ['morning'] },
        // evening: she finishes up while Grace reads; night: alone with a tea, in the jumper she has put on
        { id: 'people-maya-sit-coffee', desk: 'sit', modes: ['night'], colors: LOOK.homeNight }, { id: 'people-maya-sit-coffee-30', desk: 'sit', modes: ['night'], colors: LOOK.homeNight },
        { id: 'people-maya-sit-type', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] }, { id: 'people-maya-stand-type', desk: 'stand', modes: ['afternoon', 'evening'] },
        { key: 'maya-night-stand', id: 'people-maya-stand-coffee', desk: 'stand', modes: ['night'], colors: LOOK.homeNight },   // the tea stays in her hand if the desk goes up
        { id: 'people-grace-sit-read', on: 'armchair-poppi', seat: 420, depth: -20, modes: ['evening'] },
        { id: 'people-grace-sit-chat', on: 'armchair-poppi', seat: 420, depth: -20, modes: ['party'], colors: { top: '#2f4f6f' } },
        L => L.id === 'apartment' ? [spot('people-maya-stand-talk', -950, 250, [750, 450], { ...PARTY, colors: LOOK.homeParty }), spot('people-noah-stand-drink', 780, 420, [-950, 250], { ...PARTY, colors: LOOK.guestE })]   // either side of the desk's front, the desk in view between them
            : ring(L.id === 'house' ? [450, 1150] : [L.width * .14, L.back + L.depth * .62], L.id === 'house' ? 600 : 540, [['people-maya-stand-talk', { colors: LOOK.homeParty }], ['people-noah-stand-drink', { colors: LOOK.guestE }], ['people-zoe-stand-drink', { colors: LOOK.guestB }]], PARTY, 200),
        // the two largest homes have a lounge end: someone on the sofa after lunch, coffee being made in the morning
        L => tier(L) < 3 ? [] : [
            { id: 'people-noah-sit-read', on: 'sofa-fabric', seat: 420, along: -420, depth: -120, modes: ['afternoon'], key: 'noah-sofa' },   // (a book: the laptop posture brings its own table-height laptop, which floated in front of him)
            standBy('people-andre-stand-mug', 'kenney-furniture-kitchen-coffee-machine', 850, { modes: ['morning'], key: 'andre-coffee' })]
    ],
    // Sam's gaming room: coffee and a fresh setup in the morning, practice alone after lunch, co-op on the sofa with
    // Kai in the evening, headphones on at night, game night with friends (Kai and Sofia on the sofa, two standing).
    gaming: [
        { id: 'people-sam-stand-coffee', desk: 'stand', modes: ['morning'] },
        // after lunch he watches the replays with a drink in his hand; the headset goes on for the night's session
        { id: 'people-sam-sit-coffee', desk: 'sit', modes: ['afternoon'] }, { id: 'people-sam-sit-coffee-30', desk: 'sit', modes: ['afternoon'] },
        { id: 'people-sam-sit-game', desk: 'sit', modes: ['morning', 'night'] }, { id: 'people-sam-sit-game-30', desk: 'sit', modes: ['morning', 'night'] },
        { id: 'people-sam-stand-type', desk: 'stand', modes: ['night'] }, { key: 'sam-afternoon-stand', id: 'people-sam-stand-coffee', desk: 'stand', modes: ['afternoon'] },   // the drink stays in his hand if the desk goes up
        { id: 'people-kai-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: -330, depth: -150, modes: ['morning', 'evening', 'party'] },
        { id: 'people-sam-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 330, depth: -150, modes: ['evening'] },
        { id: 'people-sofia-sit-chat', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 330, depth: -150, modes: ['party'], colors: LOOK.guestC },
        L => L.id === 'house' ? [spot('people-sam-stand-drink', 480, 700, [1180, 1050], PARTY), spot('people-noah-stand-drink', 1180, 1050, [480, 700], { ...PARTY, colors: LOOK.guestA })]
            : ring([L.width * .12, L.back + L.depth * .58], 420, ['people-sam-stand-drink', ['people-noah-stand-drink', { colors: LOOK.guestA }]], { ...PARTY, clear: true }, 60),
        // (the smallest den has no sofa: in the evening and on game night he plays at the desk, a friend on the ottoman)
        L => L.id !== 'apartment' ? [] : [{ key: 'sam-evening', id: 'people-sam-sit-game', desk: 'sit', modes: ['evening', 'party'] }, { key: 'sam-evening-30', id: 'people-sam-sit-game-30', desk: 'sit', modes: ['evening', 'party'] }, { key: 'sam-evening-stand', id: 'people-sam-stand-type', desk: 'stand', modes: ['evening', 'party'] },
            { id: 'people-leo-sit-controller', on: 'kenney-furniture-lounge-sofa-ottoman', seat: 420, modes: ['evening', 'party'], key: 'leo-ottoman' }],
        // the two largest dens: a friend in the lounge chair, another at the game table
        L => tier(L) < 3 ? [] : [
            { id: 'people-leo-sit-controller', on: 'kenney-furniture-lounge-chair', seat: 420, modes: ['afternoon', 'night'], key: 'leo-chair' },
            { id: 'people-ava-sit-phone', on: 'gaming-stool-0', seat: 435, rise: 300, toward: 'ergoflex-game-table', modes: ['evening'], key: 'ava-stool' }]
    ],
    // Andre's music studio: standing warm-up in the morning, seated mixing after lunch, a vocalist reading lyrics at the
    // mic in the evening, headphones on for the late mix, a small live set at the party (Andre at the mic, guests).
    music: [
        { id: 'people-andre-stand-type', desk: 'stand', modes: ['morning', 'afternoon', 'evening', 'night'] },   // he stands when the desk goes up, at any hour
        { id: 'people-andre-sit-type', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] }, { id: 'people-andre-sit-type-30', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-andre-sit-mix', desk: 'sit', modes: ['night'] }, { id: 'people-andre-sit-mix-30', desk: 'sit', modes: ['night'] },
        // (in the smallest studio the mic stands near the open front: in front of it she stood half off the floor, so there
        // she sings from behind it, facing the room, where Andre stands at the party)
        L => [{ id: 'people-mia-stand-phone', by: 'music-vocal-mic', ...(L.id === 'apartment' ? { reach: -330, turn: 360 } : { reach: 420 }), modes: ['evening'], colors: { top: '#6b4a7a', bottom: '#22242a' } }],
        { id: 'people-andre-stand-talk', by: 'music-vocal-mic', reach: -330, turn: 360, modes: ['party'] },
        { id: 'people-lin-sit-chat', on: 'music-piano-bench', seat: 470, turn: 180, modes: ['party'], colors: LOOK.guestB },
        L => L.id === 'house' ? [spot('people-zoe-stand-drink', 330, 2300, [1025, 1486], { ...PARTY, colors: LOOK.guestD }), spot('people-eli-stand-drink', 1450, 2250, [1025, 1486], PARTY)]
            : ring([L.width * .1, L.back + L.depth * .72], 480, [['people-zoe-stand-drink', { colors: LOOK.guestD }], 'people-eli-stand-drink'], { ...PARTY, clear: true }, 120),
        // the two largest studios: someone listening on the sofa, and in the largest a drummer waiting for the take
        L => tier(L) < 3 ? [] : [
            seated('people-zoe-sit-listen', 'kenney-furniture-lounge-sofa', 'ergoflex-coffee-table', { along: -420, modes: ['afternoon', 'evening'], key: 'zoe-sofa' }),
            standBy('people-noah-stand-phone', 'music-drum-kit', 1100, { modes: ['afternoon'], key: 'noah-drums' })]
    ],
    // Two artists share the studio: Sofia at the desk by day (the tilted desk is the easel), Lin throwing a pot at
    // the wheel in the morning and at golden hour, Lin alone reviewing at the desk at night; the open studio has
    // visitors looking at the work.
    creative: [
        // (the painter of films cut before the wheel replaced the floor easel: only where a cut still places her)
        { id: 'people-lin-stand-paint', by: 'artist-easel', reach: 640, modes: [] },
        // on the wheel's stool, facing the wheel (the posture is built on it: tools/people/cast.py sit_pottery)
        { key: 'lin-at-wheel', id: 'people-lin-sit-pottery', by: 'ceramics-wheel', reach: 560, turn: 180, modes: ['morning', 'evening'] },
        { id: 'people-maya-stand-type', desk: 'stand', modes: [] }, { id: 'people-maya-sit-type', desk: 'sit', modes: [] },
        { id: 'people-grace-sit-read', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 380, modes: [] },   // the sofa faces the open front: feet would leave the room
        // the evening's 30 degree drawing tilt brings the top through a standing typist: Lin paints alone until the desk
        // user can follow the tilt
        ...crewOf('sofia', ['morning', 'afternoon'], { colors: LOOK.sofia }),
        ...crewOf('lin', ['night'], { colors: LOOK.linNight }),
        L => L.id === 'premium' ? [spot('people-lin-stand-talk', -950, 1600, [-300, 1700], PARTY), spot('people-ben-stand-drink', -300, 1250, [-950, 1600], { ...PARTY, colors: LOOK.benStudio }),
            spot('people-ava-stand-drink', -550, 2250, [-950, 1600], { ...PARTY, colors: LOOK.guestB }), spot('people-omar-wheel-watch', 1950, 2550, [2600, 2550], { ...PARTY, colors: LOOK.omarStudio }),
            spot('people-sofia-stand-drink', 1450, 1250, [1950, 2550], { ...PARTY, colors: LOOK.sofia })]
            : ring([-L.width * .08, L.back + L.depth * .55 + (L.id === 'apartment' ? 200 : 0)], 480, ['people-lin-stand-talk', 'people-ben-stand-drink', ['people-ava-stand-drink', { colors: LOOK.guestD }]], PARTY, 30),   // (200 mm further from the desk in the smallest atelier: Ben stood against its front edge)
        // (the smallest atelier has no easel: in the evening Sofia sketches sitting on the floor)
        L => L.id !== 'apartment' ? [] : chat(L, .6, .62, [['people-sofia-sit-floor', { key: 'sofia-floor', colors: LOOK.sofia }]], { modes: ['evening'] }, 250),
        // the largest atelier (the film's is the one before it): someone at the worktable, a visitor on the sofa
        L => tier(L) < 4 ? [] : [
            standRound('people-priya-stand-work', 'artist-worktable', 180, 1000, { modes: ['afternoon'], key: 'priya-worktable' }),
            seated('people-ben-sit-read', 'kenney-furniture-lounge-sofa', 'ergoflex-coffee-table', { along: -420, modes: ['afternoon', 'evening'], key: 'ben-sofa' })]
    ],
    // Home gym: coached mobility at sunrise (Maya at the standing desk, Priya stretching), Noah logging a strength
    // session after lunch while Priya rests on the mat, recovery stretching and notes in the evening, an empty room at
    // night, and the power circuit with three on the floor.
    gym: [
        { id: 'people-priya-stretch', by: 'training-zone', reach: 0, turn: 180, modes: ['morning'] },
        { id: 'people-maya-stand-type', desk: 'stand', modes: ['morning', 'evening'], colors: LOOK.gymMaya },
        { id: 'people-maya-sit-type', desk: 'sit', modes: ['morning', 'evening'], colors: LOOK.gymMaya }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: ['morning', 'evening'], colors: LOOK.gymMaya },
        ...crewOf('noah', ['afternoon'], { colors: LOOK.gymNoah }),
        { id: 'people-priya-sit-floor', by: 'training-zone', reach: 300, turn: 180, modes: ['afternoon'] },
        { id: 'people-priya-floor-stretch', by: 'training-zone', reach: 150, turn: 180, modes: ['evening'] },   // (350 put her feet past the open front edge of the three smaller rooms)
        // the circuit: on both sides of the equipment laid out down the middle of the training zone
        L => { const circuit = [['people-priya-stretch', { key: 'priya-circuit' }], ['people-zoe-stretch-open', { colors: { top: '#e0553f', bottom: '#1f2228' } }], ['people-kai-floor-stretch', { colors: { top: '#2f2f35', bottom: '#3c4f6b' } }]];
            if (L.id === 'house') return [spot(circuit[0][0], -380, 2000, [-380, 1000], { ...PARTY, ...circuit[0][1] }), spot(circuit[1][0], -380, 3000, [-380, 1000], { ...PARTY, ...circuit[1][1] }), spot(circuit[2][0], 720, 2250, [720, 3250], { ...PARTY, ...circuit[2][1] })];
            return [{ id: circuit[0][0], by: 'training-zone', reach: 0, turn: 180, ...PARTY, ...circuit[0][1] }, { id: circuit[1][0], by: 'training-zone', reach: 800, turn: 180, ...PARTY, ...circuit[1][1] }, { id: circuit[2][0], by: 'training-zone', reach: -700, turn: 90, ...PARTY, ...circuit[2][1] }]; },
        // On the equipment (postures built on it, tools/people/cast.py gym_*: `by` with the machine's own origin).
        // The bike from the house up; the rack's bar, the bench and the dumbbells from the studio up; the treadmill in
        // the two largest; the bag in the wellness suite. Someone at the water, Ben spotting at the bench.
        L => tier(L) < 1 ? [] : [
            { id: 'people-kai-gym-cycle', by: 'spin-bike', reach: 290, turn: 180, modes: tier(L) < 2 ? ['morning', 'afternoon'] : ['afternoon'], key: 'kai-bike', colors: { top: '#2f2f35', bottom: '#3c4f6b' } },
            { id: 'people-zoe-gym-cycle', by: 'spin-bike', reach: 290, turn: 180, modes: tier(L) < 2 ? ['evening'] : ['morning', 'evening'], key: 'zoe-bike', colors: { top: '#e0553f', bottom: '#1f2228' } }],
        L => tier(L) < 2 ? [] : [
            { id: 'people-lin-gym-pullup', by: 'power-rack', reach: 460, turn: 360, modes: ['morning', 'evening'], key: 'lin-bar', colors: { top: '#3a4a5c', bottom: '#1f2228' } },
            standBy('people-lin-gym-curl', 'dumbbell-rack', 1000, { modes: ['afternoon'], key: 'lin-weights', colors: { top: '#3a4a5c', bottom: '#1f2228' } }),
            { id: 'people-andre-gym-press', by: 'weight-bench', reach: 300, turn: 360, modes: ['morning'], key: 'andre-bench', colors: { top: '#30343c', bottom: '#22252b' } },
            standRound('people-ben-stand-wait', 'weight-bench', 270, 1100, { modes: ['morning'], key: 'ben-bench' }),
            standBy('people-sam-stand-phone', 'hydration-station', 800, { modes: ['afternoon', 'evening'], key: 'sam-water' }),
            // walking on the treadmill's belt (186 mm up; `tread`: the walk on the spot, room-people-motion.mjs)
            { id: 'people-andre-stand-wait', by: 'treadmill', reach: -60, turn: 180, up: 186, tread: { pace: 2.05 }, modes: ['afternoon', 'evening'], key: 'andre-treadmill', colors: { top: '#30343c', bottom: '#22252b' } },
            { id: 'people-sofia-stand-wait', by: 'treadmill', reach: -60, turn: 180, up: 186, tread: { pace: 1.9 }, modes: ['morning'], key: 'sofia-treadmill', colors: { top: '#7a3b8f', bottom: '#1f2228' } },
            { id: 'people-sofia-gym-box', around: ['boxing-station', 235, 810], modes: ['evening'], key: 'sofia-bag', colors: { top: '#7a3b8f', bottom: '#1f2228' } }]
    ],
    // Jo's workshop: Jo planning standing at the desk in the morning, at bench height with Leo bringing stock in the
    // afternoon, seated detail work in the evening, alone at the desk at night, an open workshop with visitors
    // watching a demonstration.
    workshop: [
        // the film's morning (Jo at the bench, Andre driving the desk from his phone): shown when a chapter names them
        { id: 'people-jo-stand-work', at: [560, -790], turn: 180, modes: [] },
        { id: 'people-andre-stand-phone', beside: [1050, 520], modes: [] },
        { id: 'people-jo-stand-low', desk: 'stand', modes: ['afternoon'] },
        ...crewOf('jo', ['morning', 'afternoon', 'evening']),
        // night: back at the bench under the strip light, the desk left as she had it
        L => L.id === 'house' ? [{ key: 'jo-night-bench', id: 'people-jo-stand-work', at: [560, -790], turn: 180, modes: ['night'] }]
            : [standBy('people-jo-stand-work', 'bench-run', 750, { modes: ['night'], key: 'jo-night-bench' })],   // (the bench stands elsewhere in the other sizes)
        L => { const [x, z] = L.desk || [0, 0]; return [
            spot('people-leo-carry-box', x + 1700, z + 1000, [x + 1700, z - 1500], { modes: ['afternoon'], ...(L.id === 'house' ? {} : { clear: true }) }),
            spot('people-jo-stand-talk', x + 650, z + 750, [x + 300, z + 1900], PARTY),
            spot('people-noah-stand-mug', x - 200, z + 1750, [x + 650, z + 750], { ...PARTY, colors: LOOK.guestB }),
            // (the smallest workshop: Grace and Omar where there is room, or not there; Omar's chair stood in the tool cart)
            spot('people-grace-cane-stand', x + 650, z + 1950, [x + 650, z + 750], { ...PARTY, colors: LOOK.graceShop, ...(L.id === 'apartment' ? { clear: true } : {}) }),
            spot('people-omar-wheel-watch', x + 1450, z + 1450, [x + 650, z + 750], { ...PARTY, colors: LOOK.omarShop, ...(L.id === 'apartment' ? { clear: true } : {}) })]; },
        // the larger workshops: two at the assembly island, others at the machines
        L => tier(L) < 2 ? [] : [
            standRound('people-andre-stand-work', 'assembly-island', 180, 1050, { modes: ['morning', 'afternoon'], key: 'andre-island' }),
            standRound('people-priya-stand-present', 'assembly-island', 0, 1100, { modes: ['afternoon'], key: 'priya-island' }),
            standBy('people-sam-stand-work', 'cnc-router', 950, { modes: ['afternoon', 'evening'], key: 'sam-cnc' }),
            standBy('people-lin-stand-present', 'laser-bay', 950, { modes: ['morning'], key: 'lin-laser' }),
            standBy('people-ben-stand-work', 'shop-machine', 900, { modes: ['evening'], key: 'ben-machine' })]
    ],
    highschool: [
        { id: 'people-maya-stand-type', desk: 'stand', modes: [] }, { id: 'people-maya-sit-type', desk: 'sit', modes: [] },
        // First bell (the film's lesson) and the afternoon wave lab; after school two stay on; nobody at night.
        { id: 'people-kai-wheel-type', station: 'accessible-student', desk: 'wheel', modes: ['morning', 'afternoon'] },
        { id: 'people-zoe-stand-type', station: 'student-standing', desk: 'stand', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-mia-sit-type', station: 'window-research', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-noah-sit-type', station: 'research-desk', desk: 'sit', modes: ['morning', 'afternoon'] },
        { id: 'people-leo-sit-raise', on: 'student-chair-0-1-0', seat: 450, turn: 180, modes: ['morning'] },
        { id: 'people-ava-sit-write', on: 'student-chair-0-0-1', seat: 450, turn: 180, modes: ['morning', 'afternoon'] },
        { id: 'people-eli-sit-listen', on: 'student-chair-0-2-0', seat: 450, turn: 180, modes: ['morning', 'afternoon'] },
        { id: 'people-sofia-sit-laptop', on: 'student-chair-1-1-1', seat: 450, turn: 180, modes: ['morning', 'afternoon'] },
        { id: 'people-hale-stand-present', layout: 'house', at: [2600, -3250], turn: 0, modes: ['morning'] },
        { id: 'people-hale-stand-type', station: 'demonstration-desk', desk: 'stand', modes: ['afternoon', 'party'], colors: LOOK.hale },
        { id: 'people-leo-sit-type', desk: 'sit', modes: ['afternoon'] }, { id: 'people-leo-sit-type-30', desk: 'sit', modes: ['afternoon'] },
        { id: 'people-hale-stand-low', desk: 'stand', modes: ['evening'], colors: LOOK.hale },   // after school, the desk at 35 in
        // The Oiler showcase: students at their projects, families standing at the demos.
        { id: 'people-ava-stand-type', station: 'project-review', desk: 'stand', modes: ['party'], colors: LOOK.ava },
        { id: 'people-grace-cane-stand', layout: 'house', at: [-1350, 5850], turn: 0, modes: ['party'], colors: LOOK.graceSchool },
        { id: 'people-noah-stand-mug', layout: 'house', at: [-600, 5800], turn: -10, modes: ['party'], colors: LOOK.guestE },
        spot('people-omar-wheel-watch', 4000, 2850, [4981, 2850], { layout: 'house', modes: ['party'], colors: LOOK.omarSchool }),
        spot('people-lin-stand-drink', 3900, 1950, [4981, 2700], { layout: 'house', modes: ['party'], colors: LOOK.guestA }),
        spot('people-ben-stand-drink', -450, -1600, [0, -2600], { layout: 'house', modes: ['party'], colors: LOOK.benSchool }),
        spot('people-mia-stand-drink', 500, -1650, [0, -2600], { layout: 'house', modes: ['party'], colors: LOOK.guestC }),
        // The rest of the class, in the Studio (the film's chapters keep the people they were made with): eight more at
        // the tables by day, a study group after school at the chairs that stay down, the teacher planning at night,
        // more of them standing at the projects for the showcase.
        L => { const M = ['morning'], A = ['afternoon'], MA = ['morning', 'afternoon'], E = ['evening'], P = ['party'];
            const seat = (who, pose, chair, modes) => ({ id: `people-${who}-${pose}`, on: 'student-chair-' + chair, seat: /sit-read/.test(pose) ? 420 : 450, turn: 180, modes, key: `${who}-class-${pose}-${modes[0]}`, studio: true });
            return [
                seat('nia', 'sit-write', '0-0-0', MA), seat('max', 'sit-listen', '0-1-1', MA), seat('yara', 'sit-laptop', '0-2-1', ['morning', 'afternoon', 'evening']), seat('finn', 'sit-listen', '1-0-0', MA),
                seat('suki', 'sit-write', '1-0-1', MA), seat('diego', 'sit-raise', '1-1-0', M), seat('diego', 'sit-write', '1-1-0', ['afternoon', 'evening']), seat('amal', 'sit-listen', '1-2-0', MA), seat('jack', 'sit-laptop', '1-2-1', MA),
                seat('nia', 'sit-read', '0-0-0', E), seat('suki', 'sit-laptop', '2-0-0', E), seat('jack', 'sit-write', '2-2-0', E),
                { id: 'people-hale-sit-type', desk: 'sit', modes: ['night'], colors: LOOK.hale, studio: true }, { id: 'people-hale-sit-type-30', desk: 'sit', modes: ['night'], colors: LOOK.hale, studio: true },
                ...chat(L, .5, .62, [['people-nia-stand-talk', { key: 'nia-showcase' }], ['people-max-stand-drink', { key: 'max-showcase' }], ['people-finn-stand-phone', { key: 'finn-showcase' }]], { modes: P, studio: true }, 620),
                ...chat(L, .32, .8, [['people-yara-stand-present', { key: 'yara-showcase' }], ['people-amal-stand-wait', { key: 'amal-showcase' }]], { modes: P, studio: true })
            ]; }
    ],
    occmedialab: [
        { id: 'people-maya-sit-type', desk: 'sit', modes: [] }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: [] }, { id: 'people-maya-stand-type', desk: 'stand', modes: [] },
        // Pre-production (the film's morning), editing after lunch, sound and colour in the evening, one late editor.
        { id: 'people-andre-sit-type', station: 'sound-mix-02', desk: 'sit', modes: ['morning', 'afternoon'] },
        { id: 'people-andre-sit-mix', station: 'sound-mix-02', desk: 'sit', modes: ['evening'] },
        { id: 'people-lin-sit-type', station: 'digital-art-03', desk: 'sit', modes: ['morning', 'afternoon'] },
        { id: 'people-omar-wheel-type-28', station: 'accessible-edit-04', desk: 'wheel', modes: ['morning', 'afternoon', 'evening'] },
        { key: 'kai-edit-bay', id: 'people-kai-sit-type', station: 'film-edit-01', desk: 'sit', modes: ['afternoon'], colors: LOOK.kaiLab },
        ...crewOf('ava', ['afternoon', 'evening'], { colors: LOOK.ava }),
        ...crewOf('kai', ['night'], { colors: LOOK.kaiLab }),   // the late edit is at the featured bay, the one bay the room still lights
        { id: 'people-ava-stand-low', desk: 'stand', modes: ['morning'], colors: LOOK.ava },   // the desk at 35 in; at the screening everyone has turned to the screen
        // at the screening the designer chairs stand in a row with no table: watching, not at a laptop (whose laptop would float)
        { key: 'people-noah-sit-laptop', id: 'people-noah-sit-listen', on: ['ergoflex-designer-chair', 0], seat: 450, modes: ['party'] },
        { id: 'people-sofia-sit-laptop', on: ['ergoflex-designer-chair', 3], seat: 450, modes: ['morning'] },   // (at the table in the morning: the film's lab)
        { key: 'sofia-screening', id: 'people-sofia-sit-listen', on: ['ergoflex-designer-chair', 3], seat: 450, modes: ['party'] },
        { id: 'people-zoe-walk', layout: 'house', at: [1900, 4300], turn: -90, modes: ['morning'] },
        // The reel showcase: people standing in the open floor, turned to the screen on the back wall.
        L => L.id === 'house' ? [spot('people-omar-wheel-watch', -1300, 350, [0, -4225], PARTY), { id: 'people-mia-stand-drink', beside: [1050, 450], ...PARTY, colors: LOOK.guestB },   // by the featured bay, a drink in her hand
            
            spot('people-leo-stand-drink', 650, 450, [0, -4225], PARTY), spot('people-eli-stand-drink', 1600, 800, [0, -4225], { ...PARTY, colors: LOOK.guestD }),
            spot('people-ben-stand-drink', -2300, 900, [0, -4225], PARTY)] : [],
        // the larger labs (not the film's): a student at every other bay, one on the couch
        L => tier(L) < 2 ? [] : [
            ...staffAt(L, [['colour-grade-05', 'priya', ['afternoon', 'evening']], ['animation-06', 'zoe', ['morning', 'afternoon']], ['film-edit-07', 'mia', ['afternoon', 'evening']],
                ['sound-design-08', 'eli', ['afternoon']], ['digital-art-09', 'sofia', ['afternoon']], ['film-edit-10', 'leo', ['afternoon']], ['animation-11', 'noah', ['afternoon', 'evening']]]),
            { id: 'people-rosa-sit-phone', on: 'ergoflex-couch', seat: 420, modes: ['afternoon'], key: 'rosa-couch' },   // (no table at the couch for a laptop)
            standBy('people-hale-stand-present', 'mobile-review-display', 1200, { modes: ['evening'], colors: LOOK.hale, key: 'hale-review' })],
        // every size, in the Studio only (the film's chapter takes the room's cast as it was): someone at the capture stage,
        // and the reel showcase in the sizes that had none
        L => [standRound('people-sam-stand-work', 'capture-stage', 180, 2200, { modes: ['morning', 'evening'], key: 'sam-stage', studio: true }),
            standRound('people-jo-stand-talk', 'capture-stage', 140, 1700, { modes: ['afternoon'], key: 'jo-stage', studio: true }),
            ...(L.id === 'house' ? [] : [...chat(L, .42, .3, [['people-mia-stand-drink', { key: 'mia-showcase' }], ['people-leo-stand-drink', { key: 'leo-showcase' }], ['people-eli-stand-drink', { key: 'eli-showcase' }]], { modes: ['party'], studio: true }, 650),
                ...chat(L, .62, .34, [['people-ben-stand-drink', { key: 'ben-showcase' }], ['people-grace-stand-drink', { key: 'grace-showcase' }]], { modes: ['party'], studio: true }),
                ...chat(L, .3, .42, [['people-omar-wheel-watch', { key: 'omar-showcase' }], ['people-kai-stand-drink', { key: 'kai-showcase' }]], { modes: ['party'], studio: true }, 600)])]
    ],
    // The growing child's room: who lives in it follows the age stage of the layout (L.ageStage), and each hour its
    // own activity (child-growth-profiles.mjs labels them). The youngest stand at the desk on its lowest setting; school
    // children sit on the room's own stool. Nobody is shown at night: the child is asleep.
    childroom: [
        L => {
            const age = L.ageStage || 'early', [px, pz] = L.play || [0, 2000], [rx, rz] = L.reading || [-1100, 3000], [dx, dz] = L.desk || [1000, -300];
            if (age === 'early') return [
                spot('people-tess-kid-play-floor', px - 260, pz - 120, [px + 300, pz + 150], { modes: ['morning'] }),
                { id: 'people-tess-kid-stand-desk', desk: 'stand', reach: 540, modes: ['afternoon'] },
                spot('people-tess-kid-sit-floor', px - 50, pz - 100, [px - 600, pz - 150], { modes: ['evening'] }),   // story time on the mat (the nook itself is out of the Studio's opening view)
                spot('people-grace-sit-floor', px - 450, pz - 380, [px - 50, pz - 100], { modes: ['evening'], colors: { top: '#7d5a6b' } }),   // the grown-up who shares the story, down on the rug with her
                spot('people-tess-kid-play-floor', px - 320, pz - 60, [px + 250, pz + 40], { key: 'tess-plays-with-a-friend', modes: ['party'] }),
                spot('people-ravi-kid-sit-floor', px + 480, pz + 120, [px - 150, pz], { modes: ['party'] }),
                spot('people-zuri-kid-sit-floor', px - 250, pz + 720, [px, pz], { modes: ['party'], clear: true })];   // (a third on the mat, where there is room)
            if (age === 'primary') return [
                { id: 'people-nora-kid-stand-desk', desk: 'stand', reach: 600, modes: ['morning'] },   // on her feet at the desk, getting her things together
                { id: 'people-nora-kid-sit-desk', desk: 'sit', chair: false, modes: ['afternoon'] },
                spot('people-nora-kid-read-floor', rx + 700, rz - 500, [rx + 1500, rz - 1200], { modes: ['evening'] }),
                spot('people-nora-kid-play-floor', px - 250, pz + 50, [px + 450, pz + 120], { key: 'nora-builds', modes: ['party'] }),
                spot('people-jun-kid-sit-floor', px + 600, pz + 150, [px, pz + 80], { modes: ['party'] })];
            if (age === 'preteen') return [
                { id: 'people-jun-kid-stand-desk', desk: 'stand', reach: 600, modes: ['morning'] },
                { id: 'people-jun-kid-sit-desk', desk: 'sit', chair: false, modes: ['afternoon', 'evening'] },
                spot('people-jun-kid-sit-floor', px - 250, pz + 50, [px + 450, pz + 120], { key: 'jun-with-a-friend', modes: ['party'] }),
                spot('people-ines-kid-sit-floor', px + 600, pz + 150, [px, pz + 80], { modes: ['party'] }),
                spot('people-kian-kid-sit-floor', px + 150, pz + 700, [px + 100, pz + 80], { modes: ['party'], clear: true })];
            // High school and college: the room's young person at the desk (an adult's chair and postures), a friend over at the party.
            const who = age === 'teen' ? 'mia' : 'noah', friend = age === 'teen' ? 'people-zoe-stand-phone' : 'people-eli-stand-drink';
            return [...crewOf(who, age === 'teen' ? ['morning', 'afternoon', 'evening', 'party'] : ['morning', 'afternoon', 'evening', 'night', 'party']),
                { id: friend, beside: [1150, 650], modes: ['party'] }];
        }
    ],
    // Kindergarten: circle time on the rug with the teacher in the rocker, discovery at the table, the light table and the
    // easel, a parent and child at the family evening, nobody during the room reset.
    kindergarten: [
        { id: 'people-sofia-sit-read', on: 'story-rocker', seat: 420, modes: ['morning'], colors: LOOK.teacherK },
        { id: 'people-tess-kid-sit-floor', around: ['circle-rug', 200, 560], modes: ['morning'] }, { id: 'people-milo-kid-sit-floor', around: ['circle-rug', 140, 600], modes: ['morning'] },
        { id: 'people-lila-kid-sit-floor', around: ['circle-rug', 255, 580], modes: ['morning'] }, { id: 'people-ravi-kid-sit-floor', around: ['circle-rug', 90, 620], modes: ['morning'] },
        { id: 'people-lila-kid-sit-k', on: 'student-chair-0-0', seat: 260, turn: 180, depth: 30, modes: ['afternoon', 'party'] },
        { id: 'people-milo-kid-sit-k', on: 'student-chair-1-1', seat: 260, turn: 180, depth: 30, modes: ['afternoon', 'party'] },
        { id: 'people-ravi-kid-sit-k', on: 'student-chair-2-0', seat: 260, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-tess-kid-stand-desk', station: 'art-easel', desk: 'stand', reach: 640, modes: ['afternoon'] },
        { id: 'people-sofia-stand-low', desk: 'stand', modes: ['afternoon', 'party'], colors: LOOK.teacherK }, ...crewOf('sofia', ['afternoon', 'evening', 'party'], { colors: LOOK.teacherK }),
        { id: 'people-maya-stand-talk', around: ['circle-rug', 0, 1000], modes: ['evening'], colors: LOOK.homeParty }, { id: 'people-tess-kid-stand', around: ['circle-rug', 40, 650], modes: ['evening'] },
        { id: 'people-grace-sit-floor', around: ['circle-rug', 170, 520], modes: ['party'], colors: { top: '#7d5a6b' } }, { id: 'people-tess-kid-read-floor', around: ['circle-rug', 250, 380], modes: ['party'] },
        // three more in the class (Zuri, Hugo, Yuki), and two parents at the family evening
        { id: 'people-zuri-kid-sit-floor', around: ['circle-rug', 310, 600], modes: ['morning'] }, { id: 'people-yuki-kid-sit-floor', around: ['circle-rug', 5, 600], modes: ['morning'] }, { id: 'people-hugo-kid-sit-floor', around: ['circle-rug', 48, 880], modes: ['morning'] },
        { id: 'people-zuri-kid-sit-k', on: 'student-chair-0-1', seat: 260, turn: 180, depth: 30, modes: ['afternoon'] }, { id: 'people-hugo-kid-sit-k', on: 'student-chair-1-0', seat: 260, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-yuki-kid-kneel-craft', around: ['circle-rug', 200, 450], modes: ['afternoon'] },
        { id: 'people-hugo-kid-stand', around: ['circle-rug', 300, 700], modes: ['evening'] }, standRound('people-kofi-stand-talk', 'circle-rug', 320, 1200, { modes: ['evening'], key: 'kofi-family' }),
        { id: 'people-yuki-kid-stand-wait', around: ['circle-rug', 200, 800], modes: ['evening'] }, standRound('people-elena-stand-mug', 'circle-rug', 180, 1300, { modes: ['evening'], key: 'elena-family' }),
        { id: 'people-zuri-kid-play-floor', around: ['circle-rug', 90, 450], modes: ['party'] }, { id: 'people-yuki-kid-sit-floor', around: ['circle-rug', 20, 520], modes: ['party'], key: 'yuki-shared' },
        { id: 'people-hugo-kid-sit-k', on: 'student-chair-2-1', seat: 260, turn: 180, depth: 30, modes: ['party'], key: 'hugo-shared' }
    ],
    // Elementary school: morning reading on the meeting carpet, project time at the table pods and the science window,
    // a family evening, the teacher planning alone at night, the class on its feet at the workshop.
    elementary: [
        { id: 'people-nora-kid-read-floor', around: ['meeting-carpet', 310, 750], modes: ['morning'] }, { id: 'people-theo-kid-read-floor', around: ['meeting-carpet', 50, 750], modes: ['morning'] },
        { id: 'people-ines-kid-read-floor', around: ['meeting-carpet', 0, 900], modes: ['morning'] }, { id: 'people-jun-kid-sit-floor', around: ['meeting-carpet', 95, 520], modes: ['morning'] },
        { id: 'people-lin-stand-low', desk: 'stand', modes: ['morning'], colors: LOOK.teacherE }, ...crewOf('lin', ['morning', 'afternoon', 'evening', 'night'], { colors: LOOK.teacherE }),
        { id: 'people-nora-kid-sit-e', on: 'student-chair-A-0', seat: 360, turn: 180, depth: 30, modes: ['afternoon', 'party'] }, { id: 'people-theo-kid-sit-e', on: 'student-chair-A-2', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-ines-kid-sit-e', on: 'student-chair-B-1', seat: 360, turn: 180, depth: 30, modes: ['afternoon', 'party'] }, { id: 'people-ravi-kid-sit-e', on: 'student-chair-B-3', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-lila-kid-sit-e', on: 'student-chair-C-0', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-jun-kid-stand-desk', station: 'science-window', desk: 'stand', reach: 700, modes: ['afternoon'] },
        { id: 'people-noah-stand-talk', around: ['meeting-carpet', 10, 1500], modes: ['evening'], colors: LOOK.guestE }, { id: 'people-ines-kid-stand', around: ['meeting-carpet', 30, 1100], modes: ['evening'] },
        { id: 'people-lin-stand-talk', around: ['meeting-carpet', 0, 1350], modes: ['party'], colors: LOOK.teacherE },
        { id: 'people-jun-kid-stand', around: ['meeting-carpet', 75, 650], modes: ['party'] }, { id: 'people-theo-kid-stand', around: ['meeting-carpet', 285, 650], modes: ['party'] }, { id: 'people-lila-kid-stand-wait', around: ['meeting-carpet', 330, 800], modes: ['party'] },
        // three more in the class (Karim, Lucia, Kian), a parent and a grandmother at the family evening
        { id: 'people-karim-kid-sit-floor', around: ['meeting-carpet', 180, 700], modes: ['morning'] }, { id: 'people-lucia-kid-read-floor', around: ['meeting-carpet', 272, 780], modes: ['morning'] }, { id: 'people-kian-kid-sit-floor', around: ['meeting-carpet', 140, 720], modes: ['morning'] },
        { id: 'people-karim-kid-sit-e', on: 'student-chair-A-1', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] }, { id: 'people-lucia-kid-sit-e', on: 'student-chair-B-0', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-kian-kid-sit-e', on: 'student-chair-C-2', seat: 360, turn: 180, depth: 30, modes: ['afternoon'] },
        { id: 'people-lucia-kid-stand', around: ['meeting-carpet', 330, 1050], modes: ['evening'] }, standRound('people-mina-stand-talk', 'meeting-carpet', 345, 1550, { modes: ['evening'], key: 'mina-family' }),
        { id: 'people-kian-kid-read-floor', around: ['meeting-carpet', 200, 700], modes: ['evening'] }, standRound('people-ivy-stand-wait', 'meeting-carpet', 250, 1450, { modes: ['evening'], key: 'ivy-family' }),
        { id: 'people-karim-kid-stand', around: ['meeting-carpet', 180, 700], modes: ['party'], key: 'karim-workshop' }, { id: 'people-lucia-kid-stand-wait', around: ['meeting-carpet', 130, 820], modes: ['party'] },
        { id: 'people-kian-kid-kneel-craft', around: ['meeting-carpet', 105, 420], modes: ['party'] }
    ],
    // ---- The living and working rooms: the desk user the room always had, and the people the furniture is there for.
    // Everyone is placed by a piece of furniture; the smallest layouts have other seats (a banquette, a bench, one armchair).
    // Study: Grace reads in the leather armchair in the evening; at the conversation hour Hale has come by with a mug.
    study: [
        () => crew('noah', 'study'),
        { id: 'people-grace-sit-read', on: 'armchair-leather', seat: 420, depth: -30, modes: ['evening'] },
        { id: 'people-grace-sit-chat', on: 'armchair-leather', seat: 420, depth: -30, modes: ['party'], key: 'grace-talks', colors: { top: '#2f4f6f' } },
        // (not in the smallest study: the only free floor there is in front of the camera the room opens with)
        L => L.id === 'apartment' ? [] : [standRound('people-hale-stand-mug', 'armchair-leather', 250, 1300, { modes: ['party'] })],
        // the two largest studies have a sofa: someone reading on it after lunch
        L => tier(L) < 3 ? [] : [seated('people-ben-sit-read', 'sofa-leather-wood', 'coffee-table', { along: -420, modes: ['afternoon'], key: 'ben-sofa' })]
    ],
    // Office: coffee at the bar first thing, someone reading on the sofa after lunch, a late call by the credenza, the
    // team round the coffee table at the social. Closed at night. (The smallest office has an armchair and a side table
    // for a sofa and a coffee table; in the largest a station stands in front of the coffee bar.)
    office: [
        () => crew('andre', 'office'),
        L => { const small = L.id === 'apartment', seat = small ? 'armchair-leather' : 'kenney-furniture-lounge-sofa', table = small ? 'ergoflex-triangle-table' : 'coffee-table';
            const sit = (id, extra) => small ? { id, on: seat, seat: 420, depth: -50, ...extra } : seated(id, seat, table, { along: -420, ...extra });   // (the armchair stands near the open front: well back in it)
            return [
                L.id === 'executive' ? standBy('people-rosa-stand-mug', 'office-credenza', 800, { modes: ['morning'] }) : standBy('people-rosa-stand-mug', 'office-coffee-bar', 800, { modes: ['morning'] }),
                sit('people-lin-sit-read', { modes: ['afternoon'] }),
                standBy('people-hale-stand-phone', 'office-credenza', 800, { modes: ['evening'] }),
                sit('people-lin-sit-chat', { modes: ['party'], key: 'lin-social' }),
                standRound('people-rosa-stand-drink', table, small ? 110 : 150, 1100, { modes: ['party'], key: 'rosa-social' }),
                standRound('people-hale-stand-talk', table, small ? 180 : 215, 1100, { modes: ['party'], key: 'hale-social' })]; },   // (in the smallest office across the side table from Lin, not behind her chair)
        // the larger offices: someone at each of the other desks, a review at the long table
        L => { const big = tier(L); return [
            ...staffAt(L, [['drafter', 'jo', ['morning', 'afternoon']], ['designer', 'priya', ['morning', 'afternoon', 'evening']], ['prototype', 'sam', ['afternoon']],
                ['architect', 'maya', ['morning', 'afternoon']], ['analyst', 'omar', ['afternoon', 'evening'], { desk: 'wheel' }]]),
            ...(big > 3 ? [...atTables([['ben', 'sit-write', [DINING, 0], 'office-review-table', ['afternoon']], ['grace', 'sit-listen', [DINING, 2], 'office-review-table', ['afternoon']],
                ['maya', 'sit-listen', [DINING, 1], 'office-review-table', ['evening']], ['sam', 'sit-laptop', [DINING, 3], 'office-review-table', ['evening']], ['ben', 'sit-listen', [DINING, 5], 'office-review-table', ['evening']]]),
                standRound('people-jo-stand-present', 'office-review-table', 270, 1900, { modes: ['evening'], key: 'jo-review' })] : []),
            ...(big > 1 ? [standBy('people-priya-stand-mug', 'office-coffee-bar', 900, { modes: ['party'], key: 'priya-social' }), standRound('people-jo-stand-talk', 'coffee-table', 300, 1300, { modes: ['party'], key: 'jo-social' })] : []),
            ...(big > 2 ? [standBy('people-sam-stand-mug', 'office-bookshelf', 900, { modes: ['party'], key: 'sam-social' }), standBy('people-maya-stand-talk', 'office-bookshelf', 1100, { modes: ['party'], key: 'maya-social' })] : [])]; }
    ],
    // Kitchen: Andre with a mug at the table in the morning, Grace cooking in the evening (at the island where there is
    // one, at the counter where not), a dinner party. The smallest kitchen has a banquette at its table. (Of the
    // dining chairs the first stands right behind whoever is at the desk: nobody is put on it.)
    kitchen: [
        () => crew('maya', 'kitchen'),
        L => { const small = L.id === 'apartment', island = !small && L.id !== 'house';
            const sit = (id, n, along, extra) => small ? seated(id, 'breakfast-banquette', 'dining-table', { along, ...extra }) : seated(id, [DINING, n], 'dining-table', extra);
            return [
                sit('people-andre-sit-mug', 2, -320, { modes: ['morning'] }),   // (beside the banquette table's pedestal, not astride it)
                island ? { id: 'people-grace-stand-work', around: ['stone-island', 180, 820], modes: ['evening'] } : standBy('people-grace-stand-work', 'cabinet-2', 720, { modes: ['evening'] }),
                sit('people-andre-sit-chat', 2, -300, { modes: ['party'], key: 'andre-dinner' }),
                sit('people-rosa-sit-mug', 3, 300, { modes: ['party'] }),
                ...(small ? [] : [sit('people-hale-sit-chat', 1, 0, { modes: ['party'] })]),
                small ? standRound('people-grace-stand-drink', 'dining-table', 90, 1150, { modes: ['party'], key: 'grace-hosts' }) : standBy('people-grace-stand-drink', 'coffee-bar', 750, { modes: ['party'], key: 'grace-hosts' })]; },
        // the kitchens with an island: breakfast on its stools
        L => tier(L) < 2 ? [] : [
            { id: 'people-zoe-sit-mug', on: ['bar-stool-brass', 0], seat: 435, rise: 400, toward: 'stone-island', modes: ['morning'], key: 'zoe-island' },
            { id: 'people-ben-sit-mug', on: ['bar-stool-brass', 1], seat: 435, rise: 400, toward: 'stone-island', modes: ['morning', 'afternoon'], key: 'ben-island' }]
    ],
    // Lounge: Zoe reading on the sofa in the evening, two on the sofa at movie night, controllers out at game night.
    lounge: [
        () => crew('noah', 'lounge'),
        L => { const sofa = L.id === 'apartment' ? 'sofa-leather-wood' : 'sofa-fabric'; return [   // (the apartment lounge has the leather sofa)
            seated('people-zoe-sit-read', sofa, 'coffee-table', { along: -420, modes: ['evening'] }),
            seated('people-zoe-sit-mug', sofa, 'coffee-table', { along: -420, modes: ['night'], key: 'zoe-movie' }),
            seated('people-kai-sit-chat', sofa, 'coffee-table', { along: 420, modes: ['night'] }),
            seated('people-kai-sit-controller', sofa, 'coffee-table', { along: 420, modes: ['party'], key: 'kai-plays' }),
            seated('people-sam-sit-controller', sofa, 'coffee-table', { along: -420, modes: ['party'] })]; },
        // Eli stands at the end of the sofa, watching the screen with them (not in the smallest lounge: a side table is there)
        L => L.id === 'apartment' ? [] : [standRound('people-eli-stand-drink', 'sofa-fabric', 180, 1550, { turn: 90, modes: ['party'] })],
        // the largest lounges: two at the bar, a game of table football, the billiard table, someone at the arcade
        L => tier(L) < 3 ? [] : [
            { id: 'people-andre-sit-mug', on: ['bar-stool-brass', 0], seat: 435, rise: 400, toward: 'lounge-bar', modes: ['evening', 'party'], key: 'andre-bar' },
            { id: 'people-rosa-sit-mug', on: ['bar-stool-brass', 1], seat: 435, rise: 400, toward: 'lounge-bar', modes: ['party'], key: 'rosa-bar' },
            standRound('people-leo-stand-work', 'foosball', 0, 850, { modes: ['evening', 'party'], key: 'leo-foosball' }),
            standRound('people-mia-stand-work', 'foosball', 180, 850, { modes: ['evening', 'party'], key: 'mia-foosball' }),
            standRound('people-hale-stand-wait', 'billiard-table', 90, 1500, { modes: ['party'], key: 'hale-billiards' }),
            standRound('people-lin-stand-talk', 'billiard-table', 270, 1500, { modes: ['party'], key: 'lin-billiards' }),
            standBy('people-ava-stand-work', 'arcade-pixel-garden', 750, { modes: ['afternoon', 'night'], key: 'ava-arcade' })]
    ],
    // Bedroom: Ava reads in the armchair in the evening (on the bench at the foot of the bed in the smallest bedroom);
    // at the weekend she stays to talk and Zoe stands by her, on her phone.
    bedroom: [
        () => crew('mia', 'bedroom'),
        L => { const seat = L.id === 'apartment' ? 'bedroom-bench' : 'armchair-poppi', extra = L.id === 'apartment' ? { along: -250 } : { depth: 10, rise: 130 }; return [   // (the armchair's cushion is a high one)
            { id: 'people-ava-sit-read', on: seat, seat: 420, ...extra, modes: ['evening'] },
            { id: 'people-ava-sit-chat', on: seat, seat: 420, ...extra, modes: ['party'], key: 'ava-weekend' },
            standRound('people-zoe-stand-phone', seat, 25, 1200, { modes: ['party'] })]; },   // (by Ava, not across the room from her)
        // the largest bedroom has a sitting end
        L => tier(L) < 4 ? [] : [seated('people-zoe-sit-phone', 'sofa-fabric', 'coffee-table', { along: -420, modes: ['afternoon'], key: 'zoe-sofa' })]
    ],
    // Gallery: a visitor resting on the bench and another before the Thinker in the afternoon, a last visitor by the
    // vase in the evening, the opening night guests round the bench. Closed at night.
    gallery: [
        () => crew('lin', 'gallery'),
        { id: 'people-hale-sit-phone', on: 'gallery-bench', seat: 420, turn: 180, along: -300, modes: ['afternoon'] },   // (facing the back wall and the Thinker)
        standRound('people-jo-stand-wait', 'thinker-plinth', 90, 1350, { modes: ['afternoon'] }),
        standRound('people-ben-stand-wait', 'vase-plinth', 90, 1150, { modes: ['evening'] }),
        standRound('people-rosa-stand-drink', 'gallery-bench', 300, 1400, { modes: ['party'] }),
        standRound('people-andre-stand-talk', 'gallery-bench', 60, 1400, { modes: ['party'] }),
        standRound('people-grace-stand-drink', 'gallery-bench', 180, 1300, { modes: ['party'] }),
        // the larger galleries: visitors at each of the other works, a guide in the morning, someone resting on the sofa
        L => { const big = tier(L); return big ? [
            standRound('people-priya-stand-present', 'aphrodite-plinth', 80, 1350, { modes: ['morning'], key: 'priya-guide' }),   // (at 90 degrees her presenting arm went through the back wall)
            standRound('people-sofia-stand-wait', 'aphrodite-plinth', 60, 1400, { modes: ['afternoon', 'evening'], key: 'sofia-aphrodite' }),
            standRound('people-maya-stand-talk', 'mercury-plinth', 250, 1500, { modes: ['afternoon'], key: 'maya-mercury' }),
            standRound('people-nora-kid-stand', 'mercury-plinth', 290, 1400, { modes: ['afternoon'], key: 'nora-mercury' }),
            standRound('people-ben-cane-stand', 'mercury-plinth', 270, 1500, { modes: ['morning'], key: 'ben-mercury' }),
            standRound('people-omar-wheel-watch', 'thinker-plinth', 140, 1600, { modes: ['afternoon', 'evening'], key: 'omar-thinker' }),
            standRound('people-zoe-stand-phone', 'collection-case', 180, 1250, { modes: ['afternoon'], key: 'zoe-case' }),
            standRound('people-eli-stand-phone', 'collection-case', 0, 1250, { modes: ['evening'], key: 'eli-case' }),
            standRound('people-sam-stand-wait', 'ribbon-sculpture', 200, 1500, { modes: ['afternoon', 'evening'], key: 'sam-ribbon' }),
            seated('people-mia-sit-phone', 'sofa-fabric', 'coffee-table', { along: -420, modes: ['afternoon', 'evening'], key: 'mia-sofa' }),
            ...(big > 1 ? [standRound('people-hale-stand-talk', 'mercury-plinth', 240, 1500, { modes: ['party'], key: 'hale-social' }), standRound('people-jo-stand-talk', 'mercury-plinth', 300, 1500, { modes: ['party'], key: 'jo-social' }),
                standRound('people-noah-stand-drink', 'collection-case', 180, 1300, { modes: ['party'], key: 'noah-social' }), standRound('people-zoe-stand-drink', 'collection-case', 140, 1350, { modes: ['party'], key: 'zoe-social' })] : []),
            ...(big > 2 ? [...chat(L, .62, .62, [['people-kai-stand-phone', { key: 'kai-floor' }], ['people-ava-stand-wait', { key: 'ava-floor' }]], { modes: ['afternoon'] }),
                ...chat(L, .3, .8, [['people-leo-stand-wait', { key: 'leo-floor' }], ['people-grace-cane-stand', { key: 'grace-floor' }]], { modes: ['afternoon', 'evening'] }),
                ...chat(L, .62, .62, [['people-priya-stand-talk', { key: 'priya-social' }], ['people-sam-stand-drink', { key: 'sam-social' }], ['people-mia-stand-drink', { key: 'mia-social' }]], { modes: ['party'] }, 620)] : [])] : []; }
    ],
    // Coworking: coffee at the counter, two at the meeting table after lunch, Jo on the sofa in the evening, the community
    // social round the coffee table. Closed at night. (The smallest space has a lounge chair for the sofa and its table.)
    coworking: [
        () => crew('lin', 'coworking'),
        standBy('people-hale-stand-mug', 'cafe-counter', 850, { modes: ['morning'] }),
        seated('people-rosa-sit-laptop', [DINING, 0], 'meeting-table', { modes: ['afternoon'] }),
        seated('people-sam-sit-write', [DINING, 1], 'meeting-table', { modes: ['afternoon'] }),
        L => { const small = L.id === 'apartment', seat = small ? 'kenney-furniture-lounge-chair' : 'kenney-furniture-lounge-sofa', middle = small ? seat : 'coffee-table';
            const sit = (id, extra) => small ? { id, on: seat, seat: 420, ...extra } : seated(id, seat, 'coffee-table', { along: -420, ...extra });
            return [
                sit('people-jo-sit-read', { modes: ['evening'] }),
                sit('people-jo-sit-chat', { modes: ['party'], key: 'jo-social' }),
                standRound('people-hale-stand-drink', middle, 150, small ? 1250 : 1100, { modes: ['party'], key: 'hale-social' }),
                standRound('people-rosa-stand-talk', middle, 215, small ? 1250 : 1100, { modes: ['party'], key: 'rosa-social' })]; },
        standBy('people-sam-stand-mug', 'cafe-counter', 850, { modes: ['party'], key: 'sam-social' }),
        // the larger spaces: members at the other desks, two more at the meeting table, people standing at the long table
        L => { const big = tier(L); return [
            ...staffAt(L, [['digital', 'andre', ['morning', 'afternoon', 'evening']], ['remote', 'priya', ['morning', 'afternoon']], ['illustrator', 'maya', ['afternoon', 'evening']],
                ['research', 'omar', ['morning', 'afternoon'], { desk: 'wheel' }], ['founder', 'ben', ['afternoon']]]),
            ...(big ? atTables([['kai', 'sit-laptop', [DINING, 2], 'meeting-table', ['afternoon']], ['ava', 'sit-write', [DINING, 3], 'meeting-table', ['afternoon', 'evening']]]) : []),
            standRound('people-zoe-stand-phone', 'communal-table', 0, 1150, { modes: ['afternoon'], key: 'zoe-communal' }),
            standRound('people-noah-stand-mug', 'communal-table', 180, 1150, { modes: ['morning', 'afternoon'], key: 'noah-communal' }),
            standBy('people-grace-stand-phone', 'call-booth', 1100, { modes: ['afternoon'], key: 'grace-call' }),
            ...(big > 1 ? [standRound('people-andre-stand-drink', 'coffee-table', 60, 1250, { modes: ['party'], key: 'andre-social' }), standBy('people-ben-stand-drink', 'cafe-counter', 1000, { modes: ['party'], key: 'ben-social' })] : []),
            ...(big > 2 ? [standRound('people-maya-stand-talk', 'communal-table', 150, 1200, { modes: ['party'], key: 'maya-social' }), standRound('people-priya-stand-mug', 'communal-table', 210, 1200, { modes: ['party'], key: 'priya-social' }),
                ...chat(L, .45, .78, [['people-mia-stand-phone', { key: 'mia-floor' }], ['people-leo-stand-wait', { key: 'leo-floor' }]], { modes: ['afternoon'] }),
                ...chat(L, .3, .45, [['people-eli-stand-wait', { key: 'eli-floor' }], ['people-sofia-stand-present', { key: 'sofia-floor' }]], { modes: ['morning', 'afternoon'] }),
                ...chat(L, .45, .78, [['people-zoe-stand-drink', { key: 'zoe-social' }], ['people-noah-stand-drink', { key: 'noah-social' }], ['people-kai-stand-drink', { key: 'kai-social' }]], { modes: ['party'] }, 620)] : [])]; }
    ],
    // Orbital deck: Priya at the service counter on the dawn watch, Kai briefing at the mission console in the evening,
    // both at the console for the jump (the smallest deck has room there for one of them).
    scifi: [
        () => crew('andre', 'scifi'),
        standBy('people-priya-stand-work', 'service-counter', 750, { modes: ['morning'] }),
        standRound('people-kai-stand-present', 'mission-console', 0, 1150, { modes: ['evening'] }),
        standRound('people-priya-stand-talk', 'mission-console', 340, 1250, { modes: ['party'], key: 'priya-jump' }),
        standRound('people-kai-stand-phone', 'mission-console', 15, 1350, { modes: ['party'], key: 'kai-jump' }),
        // the larger decks: more of the crew, at the research core, the tactical table, the fabrication floor and the cargo
        L => { const big = tier(L); return big ? [
            standBy('people-noah-carry-box', 'cargo-cases', 950, { modes: ['morning'], key: 'noah-cargo' }),
            standBy('people-zoe-stand-wait', 'crew-lockers', 900, { modes: ['evening'], key: 'zoe-lockers' }),
            standRound('people-lin-stand-work', 'research-core', 90, 1150, { modes: ['morning', 'afternoon'], key: 'lin-core' }),
            standRound('people-sam-stand-present', 'tactical-table', 180, 1300, { modes: ['afternoon', 'evening'], key: 'sam-tactical' }),
            standRound('people-jo-stand-talk', 'tactical-table', 90, 1300, { modes: ['afternoon', 'party'], key: 'jo-tactical' }),
            standRound('people-omar-stand-work', 'fabrication-floor', 90, 1700, { modes: ['afternoon'], key: 'omar-fabrication' }),
            standBy('people-leo-carry-box', 'cargo-cradle', 1100, { modes: ['afternoon'], key: 'leo-cradle' }),
            ...(big > 1 ? [...chat(L, .5, .36, [['people-maya-stand-talk', { key: 'maya-deck' }], ['people-rosa-stand-talk', { key: 'rosa-deck' }]], { modes: ['afternoon', 'evening'] }),
                ...chat(L, .5, .36, [['people-maya-stand-talk', { key: 'maya-jump' }], ['people-ben-stand-drink', { key: 'ben-jump' }], ['people-grace-stand-drink', { key: 'grace-jump' }]], { modes: ['party'] }, 620)] : []),
            ...(big > 2 ? [standRound('people-hale-stand-talk', 'tactical-table', 270, 1300, { modes: ['party'], key: 'hale-jump' }), standRound('people-lin-stand-talk', 'research-core', 90, 1200, { modes: ['party'], key: 'lin-jump' }),
                ...chat(L, .68, .55, [['people-ben-stand-wait', { key: 'ben-deck' }], ['people-mia-stand-phone', { key: 'mia-deck' }]], { modes: ['morning', 'afternoon'] }),
                ...chat(L, .3, .3, [['people-eli-stand-present', { key: 'eli-deck' }], ['people-ava-stand-wait', { key: 'ava-deck' }]], { modes: ['afternoon'] })] : [])] : []; }
    ],
    // Government office. Daily planning before the doors open (the team at their desks, the day's plan at the board,
    // coffee at the credenza); public service after lunch (every counter staffed, people at the counters, the kiosk
    // and the waiting seats); a review round the team table in the evening; one person finishing up at night; the
    // whole team standing round the table for the workshop. Larger offices have more desks, and more people at them.
    government: [
        () => deskCrew('darius'),
        L => { const big = tier(L), day = ['morning', 'afternoon'], open = ['afternoon'], review = ['evening'], shop = ['party'];
            return [
                ...staffAt(L, [
                    ['plan-review', 'helen', ['morning', 'afternoon', 'party']],
                    ['service-counter', 'mei', day], ['counter-standing', 'mei', day],
                    ['counter-accessible', 'priya', open],
                    ['records-lead', 'hale', ['morning', 'afternoon', 'evening', 'night']],
                    ['team-huddle', 'sam', ['morning', 'party']],
                    ['consultation', 'rosa', ['afternoon', 'evening']],
                    ['language-access', 'omar', day, { desk: 'wheel' }]]),
                { id: 'people-sam-sit-laptop', on: 'operator-chair-0', seat: 450, toward: 'workstation-0', modes: big > 1 ? ['afternoon'] : ['morning', 'afternoon'], key: 'sam-workstation' },
                standBy('people-priya-stand-present', 'planning-board', 900, { modes: ['morning'] }),
                ...(big ? [standBy('people-rosa-stand-mug', 'staff-credenza', 800, { modes: ['morning'] })] : []),
                ...(big > 1 ? [standBy('people-maya-stand-talk', 'planning-board', 1500, { modes: ['morning'], key: 'maya-plan' })] : []),
                // the public, in opening hours
                ...across(L, 'service-counter', 'people-ben-stand-wait', 1000, { modes: open }),
                ...across(L, 'counter-standing', 'people-ben-stand-wait', 1000, { modes: open }),
                ...across(L, 'counter-accessible', 'people-kai-wheel-watch', 1050, { modes: open }),
                { id: 'people-grace-sit-read', on: 'waiting-seats', seat: 420, along: -420, modes: open },
                ...(big ? [{ id: 'people-mia-sit-phone', on: 'waiting-seats', seat: 420, along: 420, modes: open }] : []),
                standBy('people-zoe-stand-phone', 'queue-kiosk', 750, { modes: open }),
                standBy('people-sofia-stand-wait', 'brochure-rack', 750, { modes: open }),
                standBy('people-eli-stand-work', 'self-service', 750, { modes: open }),
                { id: 'people-ava-sit-phone', on: 'armchair-poppi', seat: 420, modes: open },
                { id: 'people-maya-sit-listen', on: [DINING, 0], seat: 450, depth: -90, modes: open },
                { id: 'people-noah-sit-listen', on: [DINING, 1], seat: 450, depth: -90, modes: open },
                // the review: round the team table
                { id: 'people-jo-sit-listen', on: 'team-chair-0', seat: 450, toward: 'activity-table', modes: review },
                { id: 'people-priya-sit-write', on: 'team-chair-1', seat: 450, toward: 'activity-table', modes: review },
                { id: 'people-lin-sit-laptop', on: 'team-chair-2', seat: 450, toward: 'activity-table', modes: review },
                standRound('people-sam-stand-present', 'activity-table', 180, 1150, { modes: review, key: 'sam-review' }),
                // the workshop: everyone on their feet round it
                standRound('people-hale-stand-talk', 'activity-table', 180, 1150, { modes: shop, key: 'hale-workshop' }),
                standRound('people-lin-stand-talk', 'activity-table', 120, 1200, { modes: shop, key: 'lin-workshop' }),
                standRound('people-priya-stand-mug', 'activity-table', 240, 1200, { modes: shop, key: 'priya-workshop' }),
                ...(big ? [standRound('people-rosa-stand-talk', 'activity-table', 70, 1250, { modes: shop, key: 'rosa-workshop' }),
                    standRound('people-omar-wheel-watch', 'activity-table', 215, 1600, { modes: shop, key: 'omar-workshop' })] : [])
            ]; }
    ],
    // Middle school. The morning seminar with three tables of twelve-year-olds and Ms Jo at the mobile desk; team projects
    // after lunch (the same groups, two at the robotics mat, one at the maker bench); a homework club after school; the
    // teacher planning lessons alone at night; and the STEM workshop: projects shown standing, a parent or two.
    middleschool: [
        () => deskCrew('jo'),
        L => { const M = ['morning'], A = ['afternoon'], MA = ['morning', 'afternoon'], E = ['evening'], P = ['party'], C = (g, n) => `student-chair-${g}-${n}`, T = g => [`student-table-${g}-`];   // (each group is two tables pushed together: a chair faces the nearer one)
            return [
                ...staffAt(L, [
                    
                    ['accessible-student', 'kai', MA, { desk: 'wheel' }],
                    ['standing-student', 'dina', MA], ['maker-bench', 'emeka', ['afternoon', 'party']]]),
                ...atTables([
                    ['aiden', 'sit-listen', C(0, 0), T(0), M], ['aiden', 'sit-write', C(0, 0), T(0), A], ['bella', 'sit-write', C(0, 1), T(0), MA], ['carlos', 'sit-raise', C(0, 2), T(0), M], ['fern', 'sit-listen', C(0, 3), T(0), MA],
                    ['leo', 'sit-write', C(1, 0), T(1), MA], ['ava', 'sit-listen', C(1, 1), T(1), M], ['ava', 'sit-laptop', C(1, 1), T(1), A], ['mia', 'sit-laptop', C(1, 2), T(1), MA], ['eli', 'sit-listen', C(1, 3), T(1), MA],
                    ['emeka', 'sit-write', C(2, 0), T(2), M], ['sofia', 'sit-listen', C(2, 1), T(2), MA], ['zoe', 'sit-write', C(2, 2), T(2), MA],
                    // (after school the chairs of the three far groups go up on the tables: the homework club sits at the two near ones)
                    ['bella', 'sit-laptop', C(0, 1), T(0), E], ['emeka', 'sit-write', C(0, 2), T(0), E, { depth: -60 }], ['fern', 'sit-read', C(0, 3), T(0), E], ['leo', 'sit-read', C(1, 0), T(1), E], ['dina', 'sit-write', C(1, 1), T(1), E],
                    ['hale', 'sit-write', C(1, 2), T(1), ['night'], { colors: LOOK.hale }]]),
                ...besideStation(L, 'presentation-desk', 'people-hale-stand-present', 950, { modes: M, colors: LOOK.hale, key: 'hale-presents' }),
                ...besideStation(L, 'presentation-desk', 'people-bella-stand-present', 950, { modes: P, key: 'bella-presents' }),
                standRound('people-carlos-stand-talk', 'robotics-mat', 120, 1000, { modes: A, key: 'carlos-robots' }),
                standRound('people-noah-stand-work', 'robotics-mat', 240, 1000, { modes: A, key: 'noah-robots' }),
                standBy('people-hale-stand-talk', 'brainstorm-wall', 1000, { modes: A, colors: LOOK.hale, key: 'hale-wall' }),
                // the workshop
                standRound('people-aiden-stand-work', 'robotics-mat', 0, 1000, { modes: P, key: 'aiden-workshop' }),
                standRound('people-carlos-stand-talk', 'robotics-mat', 90, 1050, { modes: P, key: 'carlos-workshop' }),
                standRound('people-fern-stand-present', 'robotics-mat', 270, 1050, { modes: P, key: 'fern-workshop' }),
                standRound('people-dina-stand-wait', 'robotics-mat', 180, 1100, { modes: P, key: 'dina-workshop' }),
                standRound('people-hale-stand-talk', 'activity-table', 180, 1150, { modes: P, colors: LOOK.hale, key: 'hale-workshop' }),
                standRound('people-grace-cane-stand', 'activity-table', 120, 1200, { modes: P, key: 'grace-workshop' }),
                standRound('people-andre-stand-phone', 'activity-table', 240, 1200, { modes: P, key: 'andre-workshop' }),
                standBy('people-leo-carry-box', 'lockers', 900, { modes: P, key: 'leo-workshop' })
            ]; }
    ],
    // College classroom. A morning lecture (Mr Hale at the podium, three tables of students, Lin at the help desk, Kai at
    // the accessible desk); the working seminar after lunch (the same groups, two at the team whiteboards, Sam at the
    // pitch desk); an evening class of adult learners with Ben teaching; three students studying on their own at
    // night; and the group presentation: Sam and Priya presenting at the back, the class turned round to watch.
    college: [
        () => deskCrew('noah'),
        L => { const M = ['morning'], A = ['afternoon'], MA = ['morning', 'afternoon'], E = ['evening'], N = ['night'], P = ['party'];
            return [
                ...staffAt(L, [
                    ['instructor-podium', 'hale', M, { colors: LOOK.hale }], ['instructor-podium', 'ben', E, { key: 'ben-podium' }],
                    ['ta-help', 'lin', ['morning', 'afternoon', 'evening']],
                    ['accessible-student', 'kai', MA, { desk: 'wheel' }], ['accessible-student', 'omar', E, { desk: 'wheel', key: 'omar-accessible' }],
                    ['team-pitch', 'sam', ['afternoon', 'party']]]),
                ...atTables([
                    ['zoe', 'sit-write', 'student-chair-0-1', 'student-table-0', MA], ['mia', 'sit-listen', 'student-chair-0-3', 'student-table-0', M],
                    ['mia', 'sit-laptop', 'student-chair-0-3', 'student-table-0', A], ['leo', 'sit-laptop', 'student-chair-0-5', 'student-table-0', MA],
                    ['ava', 'sit-raise', 'student-chair-0-0', 'student-table-0', M],
                    ['eli', 'sit-listen', 'student-chair-1-1', 'student-table-1', MA], ['sofia', 'sit-write', 'student-chair-1-3', 'student-table-1', MA],
                    ['maya', 'sit-laptop', 'student-chair-1-5', 'student-table-1', ['morning', 'afternoon', 'evening']], ['andre', 'sit-listen', 'student-chair-1-0', 'student-table-1', M],
                    ['priya', 'sit-write', 'student-chair-2-1', 'student-table-2', M], ['priya', 'sit-laptop', 'student-chair-2-1', 'student-table-2', E],
                    ['rosa', 'sit-listen', 'student-chair-2-3', 'student-table-2', ['morning', 'evening']], ['sam', 'sit-laptop', 'student-chair-2-5', 'student-table-2', ['morning', 'evening']],
                    ['andre', 'sit-laptop', 'student-chair-3-1', 'student-table-3', ['afternoon', 'evening']], ['ava', 'sit-write', 'student-chair-3-3', 'student-table-3', A],
                    ['grace', 'sit-write', 'student-chair-3-5', 'student-table-3', E],
                    ['sofia', 'sit-laptop', 'student-chair-0-2', 'student-table-0', N],
                    // the presentation: the far side of the back tables, facing the pitch desk
                    ['zoe', 'sit-listen', 'student-chair-2-0', 'student-table-2', P], ['mia', 'sit-listen', 'student-chair-2-2', 'student-table-2', P],
                    ['leo', 'sit-raise', 'student-chair-2-4', 'student-table-2', P], ['jo', 'sit-listen', 'student-chair-3-0', 'student-table-3', P],
                    ['ava', 'sit-write', 'student-chair-3-2', 'student-table-3', P], ['eli', 'sit-listen', 'student-chair-3-4', 'student-table-3', P]]),
                standBy('people-priya-stand-present', 'team-whiteboard-1', 900, { modes: A, key: 'priya-board' }),
                standBy('people-rosa-stand-talk', 'team-whiteboard-2', 900, { modes: A, key: 'rosa-board' }),
                standRound('people-jo-stand-talk', 'student-table-2', 270, 1500, { modes: A, key: 'jo-seminar' }),
                { id: 'people-eli-sit-read', on: 'lounge-seat-1', seat: 420, modes: N, key: 'eli-lounge' },
                { id: 'people-grace-sit-read', on: 'lounge-seat-2', seat: 420, modes: ['afternoon', 'party'], key: 'grace-lounge' },
                spot('people-priya-stand-present', 1900, 6700, [1200, 4300], { modes: P, clear: true, key: 'priya-pitch' }),
                spot('people-hale-stand-wait', -2700, 5900, [600, 6900], { modes: P, clear: true, colors: LOOK.hale, key: 'hale-watch' }),
                spot('people-kai-wheel-watch', 600, 5450, [600, 7000], { modes: P, clear: true, key: 'kai-watch' })
            ]; }
    ],
    // University classroom. The morning lecture (the seminar tables' far side and flanks face the lectern); the research
    // seminar round the tables with three of the faculty, readers at the long table; an evening lecture; graduate
    // study at night (the research assistant, a carrel, the reading table); and the symposium: Ben chairing, Andre at
    // the poster desk, people standing in groups by the model and the reading table.
    university: [
        () => deskCrew('lin'),
        L => { const M = ['morning'], A = ['afternoon'], MA = ['morning', 'afternoon'], E = ['evening'], N = ['night'], P = ['party'], T = n => 'seminar-table-' + n, C = n => 'seminar-chair-' + n;
            return [
                ...staffAt(L, [
                    ['lecturer-lectern', 'hale', M, { colors: LOOK.hale }], ['lecturer-lectern', 'jo', E, { key: 'jo-lectern' }], ['lecturer-lectern', 'ben', P, { key: 'ben-lectern' }],
                    ['accessible-seminar', 'omar', ['morning', 'afternoon', 'party'], { desk: 'wheel' }],
                    ['research-assistant', 'priya', ['morning', 'afternoon', 'evening', 'night']],
                    ['poster-review', 'andre', ['afternoon', 'party']],
                    ['graduate-carrel-1', 'maya', ['afternoon', 'evening', 'night']],
                    ['graduate-carrel-2', 'sam', ['morning', 'afternoon', 'evening']]]),
                ...atTables([
                    ['zoe', 'sit-write', C(12), T('front-left'), MA], ['eli', 'sit-listen', C(13), T('front-left'), M],
                    ['sofia', 'sit-laptop', C(14), T('front-right'), MA], ['ava', 'sit-raise', C(15), T('front-right'), M],
                    ['mia', 'sit-listen', C(6), T('left'), M], ['mia', 'sit-laptop', C(6), T('left'), A], ['leo', 'sit-write', C(7), T('left'), M], ['leo', 'sit-listen', C(8), T('left'), A],
                    ['noah', 'sit-laptop', C(9), T('right'), MA], ['rosa', 'sit-listen', C(10), T('right'), M], ['kai', 'sit-write', C(11), T('right'), MA],
                    ['jo', 'sit-listen', C(0), T('back'), A], ['grace', 'sit-write', C(2), T('back'), A], ['ben', 'sit-listen', C(4), T('back'), A],
                    ['grace', 'sit-write', C(12), T('front-left'), E], ['ben', 'sit-listen', C(13), T('front-left'), E], ['andre', 'sit-laptop', C(14), T('front-right'), E],
                    ['rosa', 'sit-listen', C(15), T('front-right'), E], ['hale', 'sit-listen', C(7), T('left'), E, { colors: LOOK.hale }], ['noah', 'sit-write', C(10), T('right'), E],
                    ['eli', 'sit-read', 'reading-chair-1-0', 'reading-table', A], ['ava', 'sit-write', 'reading-chair-2-1', 'reading-table', A],
                    ['zoe', 'sit-laptop', 'reading-chair-0-0', 'reading-table', E], ['eli', 'sit-laptop', 'reading-chair-2-0', 'reading-table', N],
                    ['sofia', 'sit-listen', C(12), T('front-left'), P], ['kai', 'sit-listen', C(15), T('front-right'), P]]),
                standBy('people-hale-stand-present', 'presentation-display', 1000, { modes: A, colors: LOOK.hale, key: 'hale-seminar' }),
                { id: 'people-rosa-sit-read', on: ['armchair-leather', 0], seat: 420, modes: A, key: 'rosa-armchair' },
                { id: 'people-andre-sit-read', on: ['armchair-leather', 1], seat: 420, modes: N, key: 'andre-armchair' },
                // the symposium
                standRound('people-grace-cane-stand', 'model-vitrine', 200, 1300, { modes: P, key: 'grace-model' }),
                standRound('people-hale-stand-talk', 'model-vitrine', 140, 1300, { modes: P, colors: LOOK.hale, key: 'hale-model' }),
                standRound('people-zoe-stand-drink', 'model-vitrine', 260, 1350, { modes: P, key: 'zoe-model' }),
                standRound('people-jo-stand-talk', 'reading-table', 180, 1450, { modes: P, key: 'jo-symposium' }),
                standRound('people-sam-stand-mug', 'reading-table', 150, 1500, { modes: P, key: 'sam-symposium' }),
                standRound('people-mia-stand-drink', 'reading-table', 210, 1500, { modes: P, key: 'mia-symposium' }),
                ...across(L, 'poster-review', 'people-priya-stand-present', 1100, { modes: P, side: 500, key: 'priya-poster' }),
                ...across(L, 'poster-review', 'people-noah-stand-drink', 1250, { modes: P, side: -500, key: 'noah-poster' }),
                standBy('people-rosa-stand-talk', 'library-shelf-1', 900, { modes: P, key: 'rosa-shelf' })
            ]; }
    ],
    // Police squad room. Morning briefing: the sergeant at the lectern (in the smallest room at his own desk), the squad
    // on the briefing seats; case review after lunch: every desk in use, the detective at the analyst's desk, two at
    // the evidence table, someone from the public at the intake desk; a thinner evening shift, two on their break at
    // the table; four on the night shift; and the team briefing on their feet at the planning board.
    police: [
        () => deskCrew('reyes'),
        L => { const big = tier(L), M = ['morning'], A = ['afternoon'], E = ['evening'], N = ['night'], P = ['party'], U = { colors: LOOK.police };
            const seat = (who, pose, n, modes) => ({ id: `people-${who}-${pose}`, on: 'briefing-seat-' + n, seat: 450, modes, key: `${who}-briefing-${n}`, ...(/^(reyes|cole|brandt|tran|hale)$/.test(who) ? {} : U) });
            // (the lectern stands a metre from the display wall: whoever briefs stands beside it, not behind it)
            const lectern = L.stations?.find(d => d.id === 'briefing-lectern')?.at, row = (who, pose, n, extra = {}) => lectern ? [spot(`people-${who}-${pose}`, lectern[0] - 3000 + n * 680, lectern[1] + 1700, lectern, { clear: true, modes: P, key: `${who}-team`, ...extra })] : [];
            return [
                ...(lectern ? [spot('people-brandt-stand-present', lectern[0] - 150, lectern[1] - 950, [lectern[0] - 1800, lectern[1]], { clear: true, modes: ['morning', 'party'], key: 'brandt-briefs' })] : []),
                ...staffAt(L, [
                    ['duty-sergeant', 'brandt', big ? ['afternoon', 'evening', 'night'] : null, { key: 'brandt-duty' }],
                    ['intake-officer', 'cole', ['afternoon', 'evening']], ['intake-officer', 'lin', ['morning', 'night'], { ...U, key: 'lin-intake' }],
                    ['report-writing-2', 'andre', ['afternoon', 'evening'], U], ['report-writing-2', 'kofi', ['morning', 'night'], { desk: 'wheel', key: 'kofi-dispatch', ...U }],
                    ['crime-analyst', 'tran', ['afternoon', 'evening']],
                    ['report-writing-3', 'priya', ['afternoon', 'night'], U]]),
                { id: 'people-sam-sit-laptop', on: 'operator-chair-0', seat: 450, toward: 'workstation-0', modes: big ? ['afternoon', 'evening', 'night'] : ['afternoon', 'night'], key: 'sam-workstation', ...U },
                // the morning briefing
                ...(big ? [seat('cole', 'sit-listen', 0, M), seat('andre', 'sit-write', 1, M), seat('priya', 'sit-listen', 2, M), seat('tran', 'sit-write', 3, M), seat('sam', 'sit-listen', 4, M), seat('jo', 'sit-listen', 5, M),
                    seat('omar', 'sit-write', 6, M), seat('maya', 'sit-listen', 7, M), seat('hale', 'sit-listen', 8, M)]
                    : [{ id: 'people-cole-sit-listen', on: 'briefing-chair-0', seat: 450, toward: 'activity-table', modes: M }, { id: 'people-andre-sit-write', on: 'briefing-chair-1', seat: 450, toward: 'activity-table', modes: M, ...U }]),
                // the rest of the room while the squad is briefed: two detectives at the evidence table, the property clerk
                { id: 'people-elena-sit-write', on: 'evidence-chair-0', seat: 450, toward: 'evidence-table', modes: M, key: 'elena-evidence' },
                { id: 'people-raj-sit-listen', on: 'evidence-chair-1', seat: 450, toward: 'evidence-table', modes: M, key: 'raj-evidence' },
                ...(big ? [standBy('people-mina-stand-work', 'property-locker', 900, { modes: ['morning', 'afternoon'], key: 'mina-property' })] : []),
                // case review (in the two larger rooms a couple give a statement at the table, and there is a queue at intake)
                ...(big ? [{ id: 'people-tom-sit-listen', on: 'briefing-chair-0', seat: 450, toward: 'activity-table', modes: A, key: 'tom-statement' },
                    { id: 'people-ivy-sit-listen', on: 'briefing-chair-1', seat: 450, toward: 'activity-table', modes: A, key: 'ivy-statement' },
                    standRound('people-raj-stand-present', 'activity-table', 180, 1150, { modes: A, key: 'raj-statement' })] : []),
                ...(big > 1 ? across(L, 'intake-officer', 'people-bruno-stand-wait', 1800, { modes: A, side: 350, key: 'bruno-intake' }) : []),
                standRound('people-dee-stand-phone', 'walk-off-mat', 110, 950, { modes: ['afternoon', 'evening'], key: 'dee-waiting' }),
                { id: 'people-luca-sit-phone', on: 'briefing-chair-0', seat: 420, toward: 'activity-table', modes: N, key: 'luca-waiting' },
                { id: 'people-jo-sit-write', on: 'evidence-chair-0', seat: 450, toward: 'evidence-table', modes: A, key: 'jo-evidence' },
                { id: 'people-hale-sit-listen', on: 'evidence-chair-1', seat: 450, toward: 'evidence-table', modes: A, key: 'hale-evidence' },
                ...across(L, 'intake-officer', 'people-grace-cane-stand', 1000, { modes: A }),
                standRound('people-ben-stand-wait', 'walk-off-mat', 200, 900, { modes: A }),
                // the evening shift
                standBy('people-maya-stand-work', 'kit-bench', 700, { modes: E, key: 'maya-kit', ...U }),
                standBy('people-omar-stand-wait', 'vest-rail', 800, { modes: E, key: 'omar-vests', ...U }),
                { id: 'people-jo-sit-chat', on: 'briefing-chair-0', seat: 420, toward: 'activity-table', modes: E, key: 'jo-break', ...U },
                { id: 'people-lin-sit-chat', on: 'briefing-chair-1', seat: 420, toward: 'activity-table', modes: E, key: 'lin-break', ...U },
                standBy('people-cole-stand-radio', 'property-locker', 900, { modes: N, key: 'cole-radio' }),
                // the team briefing: on their feet behind the seats, facing the sergeant (in the smallest room round the table)
                ...row('cole', 'stand-brief', 0), ...row('tran', 'stand-phone', 1), ...row('andre', 'stand-talk', 2, U), ...row('priya', 'stand-mug', 3, U), ...row('sam', 'stand-mug', 4, U),
                ...(big > 1 ? [...row('jo', 'stand-talk', 5, U), ...row('omar', 'stand-wait', 6, U)] : []),
                ...(big ? [] : [standRound('people-cole-stand-brief', 'activity-table', 180, 1150, { modes: P, key: 'cole-team' }), standRound('people-tran-stand-phone', 'activity-table', 110, 1200, { modes: P, key: 'tran-team' }),
                    standRound('people-andre-stand-talk', 'activity-table', 250, 1200, { modes: P, key: 'andre-team', ...U })])
            ]; }
    ],
    // Security operations. The shift briefing on the briefing chairs with the supervisor standing at her desk; the
    // active watch with every console manned and two at the incident map; the evening and night watches thinning
    // out; the handover on their feet at the incident board.
    security: [
        () => deskCrew('okoye'),
        L => { const big = tier(L), M = ['morning'], A = ['afternoon'], E = ['evening'], N = ['night'], P = ['party'], watch = ['afternoon', 'evening', 'night'], G = { colors: LOOK.guard };
            const brief = (who, pose, n) => ({ id: `people-${who}-${pose}`, on: 'briefing-chair-' + n, seat: 450, toward: big > 1 ? 'briefing-table' : 'activity-table', modes: M, key: `${who}-briefing`, ...G });
            return [
                ...staffAt(L, [
                    ['shift-supervisor', 'walsh', watch],
                    ['operator-2', 'andre', watch, G], ['operator-3', 'lin', watch, G],
                    ['intel-analyst', 'priya', ['afternoon', 'evening']],
                    ['incident-lead', 'hale', ['afternoon', 'party']],
                    ['radio-dispatch', 'rosa', ['afternoon', 'evening'], G]]),
                { id: 'people-jo-sit-laptop', on: 'operator-chair-0', seat: 450, toward: 'workstation-0', modes: ['afternoon', 'evening'], key: 'jo-workstation', ...G },
                brief('andre', 'sit-listen', 0), brief('lin', 'sit-write', 1), brief('sam', 'sit-listen', 2), brief('jo', 'sit-listen', 3), brief('priya', 'sit-write', 4),
                standRound('people-walsh-stand-brief', big > 1 ? 'briefing-table' : 'activity-table', 180, 1500, { modes: M, key: 'walsh-briefs' }),
                standBy('people-omar-stand-mug', 'coffee-point', 900, { modes: M, key: 'omar-coffee', ...G }),
                { id: 'people-maya-sit-write', on: 'map-stool-0', seat: 450, toward: 'incident-map-table', modes: ['afternoon', 'evening'], key: 'maya-map', ...G },
                standRound('people-noah-stand-talk', 'incident-map-table', 0, 1150, { modes: ['afternoon', 'evening'], key: 'noah-map', ...G }),
                { id: 'people-omar-sit-phone', on: 'armchair-leather', seat: 420, modes: N, key: 'omar-break', ...G },
                // the handover: the supervisor at the incident board, the two watches standing round
                standBy('people-walsh-stand-brief', 'incident-board', 900, { modes: P, key: 'walsh-handover' }),
                standBy('people-andre-stand-wait', 'incident-board', 1000, { modes: P, key: 'andre-handover', ...G }),
                standBy('people-lin-stand-talk', 'incident-board', 1100, { modes: P, key: 'lin-handover', ...G }),
                ...(big ? chat(L, .55, .66, [['people-jo-stand-talk', { key: 'jo-handover', ...G }], ['people-priya-stand-mug', { key: 'priya-handover' }]], { modes: P }) : []),
                ...(big > 1 ? chat(L, .36, .6, [['people-sam-stand-mug', { key: 'sam-handover', ...G }], ['people-maya-stand-wait', { key: 'maya-handover', ...G }]], { modes: P }) : [])
            ]; }
    ],
    // Hospital ward. Morning rounds: the doctors and the charge nurse at the first bed, nurses at the medication and
    // linen trolleys; care coordination after lunch with every desk in use, a visitor and her child at a bedside, a
    // family member at the discharge desk; the evening handover standing round the team table; night observation with
    // the lights low (the charge nurse, one at the medication station, one on rounds); the team review.
    hospital: [
        () => deskCrew('nina'),
        L => { const big = tier(L), M = ['morning'], A = ['afternoon'], E = ['evening'], N = ['night'], P = ['party'];
            const teal = { colors: LOOK.scrubsTeal }, blue = { colors: LOOK.scrubsBlue }, plum = { colors: LOOK.scrubsPlum }, coat = { colors: LOOK.labCoat };
            return [
                ...staffAt(L, [
                    ['medication-station', 'mateo', ['morning', 'afternoon', 'evening']], ['medication-station', 'lin', N, { ...blue, key: 'lin-medication' }],
                    ['physician-charting', 'patel', ['afternoon', 'party']], ['physician-charting', 'stone', E, { key: 'stone-charting' }],
                    ['charge-nurse', 'amara', ['morning', 'afternoon', 'evening']],
                    ['telehealth-consult', 'stone', A],
                    ['pharmacist-verify', 'priya', ['morning', 'afternoon'], coat],
                    ['discharge-planning', 'jo', A]]),
                // rounds at the first bed
                standBy('people-stone-stand-chart', 'care-bed-0', 1500, { modes: M, key: 'stone-rounds' }),
                standBy('people-patel-stand-talk', 'care-bed-0', 1650, { modes: M, key: 'patel-rounds' }),
                ...(big ? [standBy('people-sam-stand-wait', 'care-bed-0', 1900, { modes: M, key: 'sam-rounds', ...coat })] : []),
                standBy('people-andre-stand-work', 'clinical-cart', 650, { modes: big ? ['morning'] : ['morning', 'afternoon'], key: 'andre-cart', ...teal }),
                { id: 'people-mateo-push-cart', by: 'clinical-cart', reach: 720, modes: N, key: 'mateo-cart' },
                standBy('people-amara-stand-chart', 'care-bed-0', 1500, { modes: N, key: 'amara-observes' }),
                standBy('people-lin-stand-work', 'linen-trolley', 800, { modes: M, key: 'lin-linen', ...blue }),
                // the patients: in bed all day, one up in the armchair after lunch
                { id: 'people-walter-lie-bed', on: 'care-bed-0', depth: -170, modes: [...DAY, 'party'], key: 'walter-bed' },
                { id: 'people-june-lie-bed', on: 'care-bed-1', depth: -170, modes: ['morning', 'evening', 'night', 'party'], key: 'june-bed' },
                { id: 'people-june-sit-read', on: ['armchair-poppi', 0], seat: 420, modes: A, key: 'june-armchair' },
                { id: 'people-ben-lie-bed', on: 'care-bed-2', depth: -170, modes: [...DAY, 'party'], key: 'ben-bed' },
                // visitors
                standBy('people-maya-stand-talk', big ? 'care-bed-1' : 'care-bed-0', 1500, { modes: A, key: 'maya-visit' }),
                standBy('people-nora-kid-stand', big ? 'care-bed-1' : 'care-bed-0', 1500, { modes: A, key: 'nora-visit' }),
                { id: 'people-grace-sit-read', on: ['armchair-poppi', 1], seat: 420, modes: ['afternoon', 'evening'], key: 'grace-visit' },
                { id: 'people-rosa-sit-listen', on: DINING, seat: 450, depth: -90, modes: A, key: 'rosa-discharge' },
                // the handover, and the team review, on the room's side of the team table
                standRound('people-mateo-stand-talk', 'activity-table', big ? 180 : 100, big ? 1150 : 1250, { modes: P, key: 'mateo-review' }),
                standRound('people-lin-stand-talk', 'activity-table', 135, 1250, { modes: ['evening', 'party'], key: 'lin-handover', ...blue }),
                standRound('people-andre-stand-wait', 'activity-table', 225, 1250, { modes: ['evening', 'party'], key: 'andre-handover', ...teal }),
                ...(big ? [standRound('people-priya-stand-mug', 'activity-table', 100, 1400, { modes: ['evening', 'party'], key: 'priya-handover', ...plum }),
                    standRound('people-stone-stand-chart', 'activity-table', 260, 1400, { modes: P, key: 'stone-review' }),
                    standRound('people-amara-stand-talk', 'activity-table', 180, 1900, { modes: P, key: 'amara-review' })] : [])
            ]; }
    ],
    // Science laboratory. Preparation: the scientist at the mobile desk, others at the fume hood, the sink and the
    // sample cart; the practical session with a class on the bench stools and two teaching; analysis in the evening at
    // the instruments; one on the instrument watch at night; the research review round the team table.
    laboratory: [
        () => deskCrew('vega'),
        L => { const big = tier(L), M = ['morning'], A = ['afternoon'], E = ['evening'], N = ['night'], P = ['party'], coat = { colors: LOOK.labCoat };
            // (the bench stools are 650 mm high and stand close to the bench: sat well back on them)
            const stool = (who, pose, bench, n, modes) => ({ id: `people-${who}-${pose}`, on: `lab-seat-${bench}-${n}`, seat: 450, rise: 260, depth: -230, toward: 'lab-bench-' + bench, modes, key: `${who}-bench-${bench}-${n}`, ...coat });
            return [
                ...staffAt(L, [
                    ['instrument-control', 'andre', A, coat], ['instrument-control', 'yusuf', ['evening'], { key: 'yusuf-instruments' }],
                    ['microscopy', 'chen', ['morning', 'afternoon', 'evening']],
                    ['sample-prep', 'priya', ['morning', 'afternoon'], coat],
                    
                    ['data-review', 'andre', ['evening', 'party'], { ...coat, key: 'andre-data' }],
                    ['pi-review', 'hale', ['evening', 'party']]]),
                standBy('people-lin-stand-work', 'fume-hood', 800, { modes: ['morning', 'afternoon'], key: 'lin-hood', ...coat }),
                standBy('people-sam-stand-work', 'wash-station', 800, { modes: M, key: 'sam-wash', ...coat }),
                standBy('people-maya-stand-present', 'sample-cart', 750, { modes: M, key: 'maya-samples', ...coat }),
                { id: 'people-yusuf-sit-microscope', on: 'lab-seat-0-3', y: 0, depth: -240, toward: 'lab-bench-0', modes: M, key: 'yusuf-microscope' },
                ...besideStation(L, 'teaching-demo', 'people-jo-stand-present', 950, { modes: A, key: 'jo-teaches', ...coat }),
                // the practical
                stool('zoe', 'sit-write', 0, 0, A), stool('kai', 'sit-listen', 0, 1, A), stool('mia', 'sit-write', 0, 2, A), stool('leo', 'sit-listen', 0, 3, A),
                stool('ava', 'sit-write', 1, 0, A), stool('eli', 'sit-listen', 1, 1, A), stool('sofia', 'sit-write', 1, 2, A), stool('noah', 'sit-listen', 1, 3, A),
                stool('maya', 'sit-write', 2, 0, A), stool('sam', 'sit-laptop', 2, 1, A),
                standRound('people-yusuf-stand-talk', 'lab-bench-0', 90, 1500, { modes: A, key: 'yusuf-teaching' }),
                // analysis and the watch
                stool('maya', 'sit-write', 0, 0, E), stool('sam', 'sit-laptop', 0, 1, E),
                standBy('people-lin-stand-present', 'sample-fridge', 800, { modes: E, key: 'lin-fridge', ...coat }),
                { id: 'people-yusuf-sit-microscope', on: 'lab-seat-0-3', y: 0, depth: -240, toward: 'lab-bench-0', modes: ['night'], key: 'yusuf-night' },
                standBy('people-chen-stand-chart', 'fume-hood', 900, { modes: N, key: 'chen-watch' }),
                // the review
                standRound('people-yusuf-stand-chart', 'activity-table', 180, 1150, { modes: P, key: 'yusuf-review' }),
                standRound('people-chen-stand-talk', 'activity-table', 120, 1200, { modes: P, key: 'chen-review' }),
                standRound('people-priya-stand-mug', 'activity-table', 240, 1200, { modes: P, key: 'priya-review', ...coat }),
                ...(big ? [standRound('people-lin-stand-talk', 'activity-table', 60, 1250, { modes: P, key: 'lin-review', ...coat }), standRound('people-jo-stand-talk', 'activity-table', 300, 1250, { modes: P, key: 'jo-review', ...coat })] : [])
            ]; }
    ],
    // Mobile IT. System checks at the racks first thing; the service session with the tech bar open and people queuing
    // at it, every bench busy; maintenance in the evening (one kneeling at a rack); one on the monitoring desk
    // overnight; and the team deployment: a briefing on their feet, boxes carried out.
    mobileit: [
        () => deskCrew('devi'),
        L => { const big = tier(L), M = ['morning'], A = ['afternoon'], E = ['evening'], N = ['night'], P = ['party'], polo = { colors: LOOK.techPolo };
            return [
                ...staffAt(L, [
                    ['rack-console', 'tomas', ['morning', 'afternoon', 'evening']],
                    ['noc-monitoring', 'lin', ['afternoon', 'evening', 'night'], polo],
                    ['repair-bench', 'omar', ['morning', 'afternoon', 'evening'], polo],
                    ['imaging-deployment', 'andre', ['morning', 'afternoon', 'party'], polo],
                    ['asset-intake', 'priya', A, polo],
                    ['tech-bar-walkup', 'maya', ['morning', 'afternoon'], polo]]),
                ...(L.stations?.some(d => d.id === 'rack-console') ? [] : [standBy('people-tomas-stand-work', 'server-rack-1', 800, { modes: ['morning', 'evening'], key: 'tomas-rack' })]),
                { id: 'people-tomas-push-cart', by: 'diagnostic-cart-1', reach: 730, modes: N, key: 'tomas-cart-night' },
                ...(big > 1 ? [standBy('people-priya-stand-present', 'planning-board', 1000, { modes: M, key: 'priya-plan', ...polo })] : []),
                standBy('people-jo-stand-work', 'server-rack-0', 800, { modes: M, key: 'jo-rack-morning', ...polo }),
                standBy('people-maya-stand-phone', 'device-drop-box', 900, { modes: E, key: 'maya-dropbox', ...polo }),
                standBy('people-jo-kneel-shelf', 'server-rack-0', 700, { modes: E, key: 'jo-rack', ...polo }),
                ...across(L, 'tech-bar-walkup', 'people-ben-stand-wait', 1000, { modes: A, key: 'ben-techbar' }),
                ...across(L, 'tech-bar-walkup', 'people-zoe-stand-phone', 1700, { modes: A, side: 350, key: 'zoe-techbar' }),
                ...(big ? across(L, 'tech-bar-walkup', 'people-hale-stand-wait', 2400, { modes: A, side: -200, key: 'hale-techbar' }) : []),
                standBy('people-sam-stand-work', 'packing-bench', 750, { modes: ['morning', 'afternoon'], key: 'sam-packing', ...polo }),
                standBy('people-rosa-stand-phone', 'charging-locker', 800, { modes: A, key: 'rosa-locker' }),
                // the deployment
                standRound('people-tomas-stand-present', 'briefing-zone', 180, 900, { modes: P, key: 'tomas-briefing' }),
                standRound('people-sam-stand-wait', 'briefing-zone', 110, 1000, { modes: P, key: 'sam-briefing', ...polo }),
                standRound('people-lin-stand-talk', 'briefing-zone', 250, 1000, { modes: P, key: 'lin-briefing', ...polo }),
                ...(big ? [standRound('people-priya-stand-mug', 'briefing-zone', 40, 1050, { modes: P, key: 'priya-briefing', ...polo }),
                    standBy('people-noah-carry-box', 'deployment-bay', 900, { modes: P, key: 'noah-boxes', ...polo }), standBy('people-jo-carry-box', 'device-drop-box', 900, { modes: P, key: 'jo-boxes', ...polo })] : [])
            ]; }
    ],
    library: [
        // The reading rooms (every library but the commons): readers at the tables and carrels from opening to dusk, one
        // or two on the sofa, people at the stacks, the catalogue and the periodicals, a librarian shelving returns; a
        // study group at the tables on the late evening. Larger rooms have more tables, and more readers at them.
        L => { if (L.id === 'humboldt') return []; const big = tier(L), T = ['reading-table-', 'carrel-'], open = ['morning', 'afternoon', 'evening'];
            const reader = (who, pose, n, modes) => ({ id: `people-${who}-${pose}`, on: [DINING, n], seat: /sit-read|sit-phone/.test(pose) ? 420 : 450, toward: T, modes, key: `${who}-table-${n}-${pose}` });
            return [
                ...deskCrew('mia', ['morning', 'afternoon', 'evening', 'party']),
                reader('zoe', 'sit-read', 0, ['morning', 'afternoon']), reader('eli', 'sit-laptop', 1, ['afternoon', 'evening']), reader('grace', 'sit-write', 2, ['afternoon']), reader('ben', 'sit-read', 3, ['morning', 'evening']),
                ...(big > 1 ? [reader('kai', 'sit-write', 4, ['afternoon']), reader('ava', 'sit-laptop', 5, ['morning', 'afternoon']), reader('andre', 'sit-read', 6, ['afternoon', 'evening'])] : []),
                ...(big > 2 ? [reader('maya', 'sit-write', 8, ['morning', 'afternoon']), reader('sam', 'sit-laptop', 9, ['afternoon', 'evening']), reader('priya', 'sit-read', 11, ['afternoon'])] : []),
                ...(big > 3 ? [reader('noah', 'sit-laptop', 12, ['afternoon']), reader('sofia', 'sit-write', 14, ['afternoon', 'evening']), reader('leo', 'sit-read', 16, ['morning', 'afternoon'])] : []),
                big ? seated('people-jo-sit-read', 'sofa-leather-couch', 'coffee-table', { along: -420, modes: ['afternoon', 'evening'], key: 'jo-sofa' }) : { id: 'people-jo-sit-read', on: 'armchair-leather', seat: 420, modes: ['afternoon', 'evening'], key: 'jo-armchair' },
                standBy('people-rosa-stand-work', 'book-return-cart', 700, { modes: ['morning', 'evening', 'night'], key: 'rosa-returns' }),   // (at night she is the last one in, shelving the returns)
                standBy('people-hale-stand-present', 'stack-0-0', 750, { modes: ['afternoon'], colors: LOOK.hale, key: 'hale-stacks' }),
                standBy('people-lin-kneel-shelf', 'current-periodicals', 700, { modes: ['afternoon'], key: 'lin-periodicals' }),
                standRound('people-omar-wheel-watch', 'globe', 180, 1150, { modes: ['morning', 'afternoon'], key: 'omar-globe' }),
                standBy('people-priya-stand-talk', 'research-help-counter', 850, { modes: ['morning'], key: 'priya-help' }),
                standRound('people-noah-stand-work', 'digital-research-table', 180, 1250, { modes: ['evening'], key: 'noah-digital' }),
                // the study night
                reader('ava', 'sit-laptop', 0, ['party']), reader('leo', 'sit-write', 1, ['party']), reader('sofia', 'sit-listen', 2, ['party']), reader('eli', 'sit-laptop', 3, ['party']),
                ...(big ? [standRound('people-noah-stand-drink', 'coffee-table', 150, 1250, { modes: ['party'], key: 'noah-night' }), standRound('people-zoe-stand-drink', 'coffee-table', 210, 1250, { modes: ['party'], key: 'zoe-night' })] : [])
            ]; },
        // The commons: opening with Andre standing at the pilot desk, research together after lunch (Rosa at the desk's
        // low setting), reading at dusk (Omar at the desk at 32 in), one student at a table lamp at closing, and a
        // study night around the long table.
        { id: 'people-rosa-stand-type-low', layout: 'humboldt', desk: 'stand', reach: 830, modes: ['afternoon', 'party'] },
        { id: 'people-rosa-stand-type-30', layout: 'humboldt', desk: 'stand', reach: 830, modes: ['afternoon', 'party'] },
        { id: 'people-andre-stand-type', layout: 'humboldt', desk: 'stand', modes: ['morning'], colors: { top: '#3b4c66', bottom: '#2a2b2f' } },
        { id: 'people-omar-wheel-type', layout: 'humboldt', desk: 'wheel', modes: ['evening'] },
        { id: 'people-lin-sit-phone', layout: 'humboldt', on: 'electric-wheelchair', seat: 420, modes: [] },   // the parked chair faces the wall: her feet would be in it
        { id: 'people-leo-sit-write', layout: 'humboldt', near: [-800, -5970], face: [-800, -5200], seat: 450, modes: ['morning', 'afternoon', 'night'] },
        { id: 'people-zoe-sit-laptop', layout: 'humboldt', near: [-814, -4428], face: [-814, -5200], seat: 450, modes: ['morning', 'afternoon'] },
        { id: 'people-eli-sit-listen', layout: 'humboldt', near: [550, 2945], face: [550, 3700], seat: 450, modes: ['morning', 'afternoon'] },
        { id: 'people-zoe-walk', layout: 'humboldt', at: [2500, 1500], turn: 90, modes: [] },   // Zoe also sits with her laptop: one Zoe per frame
        { id: 'people-ben-white-cane', layout: 'humboldt', at: [-2800, 2600], turn: 180, modes: ['morning', 'afternoon'] },
        { id: 'people-grace-cane-stand', layout: 'humboldt', at: [3600, 5500], turn: 200, modes: ['morning', 'evening'] },
        spot('people-noah-carry-box', 3350, 900, [3350, -1500], { layout: 'humboldt', modes: ['afternoon'] }),
        { id: 'people-mia-sit-mug', layout: 'humboldt', near: [6621, 5496], face: [7450, 5500], seat: 450, modes: ['evening'] },
        { id: 'people-ben-sit-read', layout: 'humboldt', near: [550, 4456], face: [550, 3700], seat: 450, modes: ['evening'] },
        { key: 'leo-study-night', id: 'people-leo-sit-write', layout: 'humboldt', near: [-1858, 750], face: [-1087, 750], seat: 450, modes: ['party'] },
        { id: 'people-sofia-sit-chat', layout: 'humboldt', near: [-344, 750], face: [-1087, 750], seat: 450, modes: ['party'], colors: LOOK.guestA },
        { key: 'zoe-study-night', id: 'people-zoe-sit-laptop', layout: 'humboldt', near: [-1851, 1650], face: [-1087, 1650], seat: 450, modes: ['party'] },
        { key: 'eli-study-night', id: 'people-eli-sit-listen', layout: 'humboldt', near: [-300, 1638], face: [-1087, 1638], seat: 450, modes: ['party'] },
        spot('people-noah-stand-mug', -1087, 3400, [-1087, 1500], { layout: 'humboldt', modes: ['party'], colors: LOOK.guestC }),
        spot('people-ava-stand-drink', -2550, 1950, [-1087, 1500], { layout: 'humboldt', modes: ['party'] }),
        // The rest of the hall (thirty-five metres of it): readers at the other tables and down the cafe tables, someone at the
        // information point, people on their way through. The film's chapter names its own six, so these are the Studio's.
        L => { if (L.id !== 'humboldt') return []; const M = 'morning', A = 'afternoon', E = 'evening', N = 'night', P = 'party';
            const sit = (who, pose, chair, face, modes) => ({ id: `people-${who}-${pose}`, near: chair, face, seat: /sit-(read|phone|chat|coffee|mug)/.test(pose) ? 420 : 450, modes, key: `${who}-hall-${pose}-${modes[0]}` });
            return [
                sit('priya', 'sit-laptop', [2555, -4349], [2555, -5199], [M]), sit('sam', 'sit-write', [3437, -5974], [3437, -5199], [M]),
                sit('maya', 'sit-coffee', [6621, 5496], [7450, 5500], [M]), sit('hale', 'sit-read', [3641, 10511], [4500, 10500], [M, A]),
                sit('kai', 'sit-laptop', [208, -1590], [1186, -1590], [M, A, E, P]), sit('ava', 'sit-write', [1807, -1595], [1186, -1595], [M]),
                sit('sofia', 'sit-read', [4915, 416], [4915, 1613], [M, A]),
                standBy('people-lin-stand-present', 'humboldt-info-point', 900, { modes: [M, A], key: 'lin-information' }),
                sit('maya', 'sit-laptop', [-1939, -170], [-1102, -170], [A, P]), sit('priya', 'sit-write', [-277, -143], [-1102, -143], [A, P]), sit('sam', 'sit-listen', [-2012, 766], [-1102, 766], [A]),
                sit('ava', 'sit-laptop', [3131, -1404], [4285, -1404], [A]), sit('mia', 'sit-phone', [3699, 15404], [4500, 15400], [A]), sit('grace', 'sit-read', [1400, 13385], [1400, 14200], [A]),
                { id: 'people-jo-walk', at: [2300, 8000], turn: 180, clear: true, modes: [A], key: 'jo-hall-walk' },
                sit('maya', 'sit-read', [6646, 7803], [7450, 7800], [E]), sit('sam', 'sit-laptop', [1440, 2895], [1440, 3887], [E]), sit('priya', 'sit-read', [6095, 442], [6095, 1613], [E]),
                sit('ava', 'sit-read', [4117, -2385], [4117, -1397], [E]), sit('sofia', 'sit-chat', [3671, 12944], [4500, 12950], [E]), sit('jo', 'sit-chat', [4890, 13615], [4500, 12950], [E]),
                spot('people-hale-stand-phone', -2250, 8600, [-3450, 8600], { clear: true, modes: [E], colors: LOOK.hale, key: 'hale-hall-canoe' }),
                standBy('people-jo-stand-work', 'humboldt-returns-cart', 750, { modes: [N], key: 'jo-hall-returns' }),
                spot('people-priya-stand-phone', 2500, 6000, [2500, 9000], { clear: true, modes: [N], key: 'priya-hall-leaving' }),
                spot('people-hale-stand-talk', 400, 3300, [-1087, 1500], { clear: true, modes: [P], colors: LOOK.hale, key: 'hale-hall-project' }),
                spot('people-jo-stand-present', -3000, 800, [-1087, 800], { clear: true, modes: [P], key: 'jo-hall-project' }),
                spot('people-sam-stand-mug', -1100, 4300, [-1087, 1500], { clear: true, modes: [P], key: 'sam-hall-project' }),
                // the far end of the hall: students down the cafe tables, people on their way through
                sit('nia', 'sit-laptop', [3671, 17844], [4500, 17850], [M, A]), sit('max', 'sit-read', [4901, 18531], [4500, 17850], [A]),
                sit('yara', 'sit-write', [3690, 20301], [4500, 20300], [A, E]), sit('finn', 'sit-phone', [4898, 21003], [4500, 20300], [A]),
                sit('suki', 'sit-laptop', [3701, 22747], [4500, 22750], [M, A, E]), sit('diego', 'sit-chat', [1395, 18204], [1400, 19000], [A, E]), sit('amal', 'sit-chat', [1406, 19794], [1400, 19000], [A, E]),
                sit('elena', 'sit-read', [1400, 14977], [1400, 14200], [M, E]), sit('tom', 'sit-read', [4901, 16082], [4500, 15400], [M, E]),
                { id: 'people-jack-walk', at: [2600, 16500], turn: 0, clear: true, modes: [M], key: 'jack-hall-walk' },
                { id: 'people-sara-walk', at: [2300, 19500], turn: 180, clear: true, modes: [A], key: 'sara-hall-walk' },
                spot('people-tom-cane-stand', -2800, 13000, [-3896, 13000], { clear: true, modes: [A], key: 'tom-hall-sculpture' }),
                spot('people-raj-stand-phone', -2500, 15200, [-3896, 15200], { clear: true, modes: [A], key: 'raj-hall' }),
                spot('people-luca-stand-talk', -900, 21000, [0, 21000], { clear: true, modes: [A, E], key: 'luca-hall' }), spot('people-dee-stand-talk', 150, 21000, [-900, 21000], { clear: true, modes: [A, E], key: 'dee-hall' }),
                sit('nia', 'sit-write', [3671, 17844], [4500, 17850], [P]), sit('max', 'sit-laptop', [4901, 18531], [4500, 17850], [P]), sit('yara', 'sit-listen', [3690, 20301], [4500, 20300], [P]), sit('finn', 'sit-laptop', [4898, 21003], [4500, 20300], [P]),
                spot('people-bruno-stand-drink', 300, 6200, [-400, 6200], { clear: true, modes: [P], key: 'bruno-hall-project' }), spot('people-mina-stand-drink', -400, 6200, [300, 6200], { clear: true, modes: [P], key: 'mina-hall-project' })
            ].map(s => ({ ...s, layout: 'humboldt' })); }
    ]
};

// Rooms without a cast of their own still get someone at the featured desk, seated or standing with its height.
// Children's rooms are left out: these are adults and teenagers, and those desks are set for children.
const DESK_CREW = {
    maya: ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type'],
    andre: ['people-andre-sit-type', 'people-andre-sit-type-30', 'people-andre-stand-type'],
    lin: ['people-lin-sit-type', 'people-lin-sit-type-30', 'people-lin-stand-type'],
    noah: ['people-noah-sit-type', 'people-noah-sit-type-30', 'people-noah-stand-type'],
    mia: ['people-mia-sit-type', 'people-mia-sit-type-30', 'people-mia-stand-type']
};
// (In offices, schools, galleries and labs nobody is at the desk at night; at home, in a hospital, a control room or a station someone is.)
const CLOSED_AT_NIGHT = /^(office|coworking|gallery|library|middleschool|college|university|laboratory|government)$/;
const crew = (who, room) => DESK_CREW[who].map(id => ({ id, desk: /stand/.test(id) ? 'stand' : 'sit', ...(CLOSED_AT_NIGHT.test(room) ? { modes: ['morning', 'afternoon', 'evening', 'party'] } : {}) }));
const DEFAULT_CREW = {
    office: 'andre', coworking: 'lin', bedroom: 'mia', lounge: 'noah', kitchen: 'maya', study: 'noah', gallery: 'lin', library: 'mia', scifi: 'andre',
    middleschool: 'mia', college: 'noah', university: 'lin', hospital: 'lin', laboratory: 'andre', mobileit: 'noah', government: 'andre', police: 'maya', security: 'andre'
};
// A room's placements for one layout (an object with id, width, depth, back, desk; or just the layout id).
export const castEntries = (id, layout) => {
    const L = typeof layout === 'object' && layout ? layout : { id: layout, width: 4000, depth: 5000, back: -1500, desk: [0, 0] };
    return (ROOM_PEOPLE[id] || []).flatMap(s => typeof s === 'function' ? [].concat(s(L) || []) : [s]).filter(s => !s.layout || s.layout === L.id);
};
const castFor = (id, layout) => { const own = castEntries(id, layout); return own.length ? own : DEFAULT_CREW[id] ? crew(DEFAULT_CREW[id], id) : []; };

// The same character's other desk postures, as [id, desk role]: a typist sits at 28 in and at 30 in, stands low at a
// bench-height desk (35 to 36 in), at a mid-height one (38 to 40 in: stand-mid, built for 39 in) and at 43.5 in, a wheelchair user has poses for 28 in and 31 in. Poses built for one special desk (low standing) have none.
export function deskFamily(id) {
    const m = /^people-([a-z]+)-(.+)$/.exec(id || ''); if (!m) return [];
    const [, who, posture] = m, as = (p, desk) => ['people-' + who + '-' + p, desk]; let list = [];
    if (/^wheel-/.test(posture)) { const base = posture.replace(/-(28|31)$/, ''); list = [as(base, 'wheel'), as(base + '-28', 'wheel'), as(base + '-31', 'wheel')]; }
    // (the standing counterpart of the seated posture first, so what is in the hand stays there: sit-coffee stands as stand-coffee)
    else if (/^sit-/.test(posture)) { const base = posture.replace(/-30$/, ''); list = [as(base, 'sit'), as(base + '-30', 'sit'), as('stand-low', 'stand'), as('stand-mid', 'stand'), as(base.replace(/^sit-/, 'stand-'), 'stand'), as('stand-type', 'stand')]; }
    else if (posture === 'stand-type' || posture === 'stand-low' || posture === 'stand-mid') list = [as('sit-type', 'sit'), as('sit-type-30', 'sit'), as('stand-low', 'stand'), as('stand-mid', 'stand'), as('stand-type', 'stand')];
    return list.filter(([other]) => other !== id);
}

const down = new THREE.Vector3(0, -1, 0), poseTurn = new THREE.Quaternion();
const frontOf = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

export class RoomPeople {
    constructor(room, library) {
        this.room = room; this.library = library; this.enabled = false; this.built = null; this.people = []; this.hidden = new Map(); this.filter = null;
        this.actors = []; this.clock = null; this.lifeClock = 0; this.eye = null; this.rigsOf = new Map(); this.pickedAt = -Infinity; this.picked = []; this.pairs = []; this.pending = new Set(); this.cranks = new Set(); this.waiting = []; this.lastMode = undefined; this.generation = 0; this.keysHome = null;
        this.dirty = false;       // dirty: someone moved since the Studio last looked (their shadow has to follow)
        this.ray = new THREE.Raycaster();
    }
    // (a placement marked `studio` is in the Studio's room only: a film that takes "everyone except" does not get it)
    specs() { return [...castFor(this.room.id, this.room.roomLayout || null).filter(spec => !(spec.studio && this.filter)), ...(this.filter?.cast || []).map(spec => ({ ...spec, extra: true }))]; }
    // filter, for one use of the room (a film chapter):
    //   only: [keys], except: [keys]          who of the room's cast is shown (a key is a placement's `key`, or its id)
    //   place: { '<key>': { at: [x, z], turn, y } }   moves someone (clear of a camera path, onto a prop the film moved)
    //   cast: [placements]                    extra people, placed like the room's own (always shown)
    //   when: { '<key>': [[t0, t1], ...] }    the seconds (state.time) that person is there; fades over `fade` seconds
    //                                         (default .5; 0 cuts). Without a time (the Studio) everyone is simply there.
    //   chair: { back, side, turn }           the featured desk's task chair stays in the room when its user is not
    //                                         seated: pushed back and aside (mm, the desk's frame) and turned (degrees)
    // Only a change of who is in the cast (model, key, desk role) rebuilds; moving, turning, scaling or re-timing an
    // extra person re-places the model that is already there (the Director edits these live).
    setFilter(filter) {
        const cast = JSON.stringify((filter?.cast || []).map(c => [c.key || c.id, c.id, c.desk || '', c.station || ''])) + JSON.stringify(Object.keys(filter?.when || {})) + (filter?.motion === false ? 'still' : '');
        if (this.built && cast !== this.castKey) this.dispose();
        this.castKey = cast; this.filter = filter || null; this.placed = false;
        // someone already in the room who now has a pose gets their skeleton before anyone waiting on `built` goes on
        if (this.built && (filter?.cast || []).some(c => c.pose)) this.built = this.built.then(() => this.rigPosed());
    }
    posed(spec) { return !!spec.pose && Object.keys(spec.pose).length > 0; }
    async rigPosed() {
        await Promise.all(this.people.map(object => { const now = this.current(object); return now && this.posed(now) && !object.userData.personRig ? this.rig(object) : null; }));
    }
    // The placement the filter has now for an extra person (it may have been edited since the model was built).
    current(object) { const spec = object.userData.person, now = spec.extra ? (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(spec)) || null : null; return now && this.asVariant(now, spec); }
    // A placement as one of its desk postures wears it: the same place, size, clothes and timing, its own model and
    // role. The fine-tuned joints belong to the posture the placement names, so the others do not take them.
    asVariant(now, spec) { return spec.variant ? { ...now, id: spec.id, desk: spec.desk, variant: spec.variant, pose: undefined } : now; }
    // Everyone to build: the placements, and for each person a film or the Director put at a desk, or who works at one
    // of the room's other desks, the character's other desk postures (deskFamily) that are in the library and not
    // already placed at that desk by the same hand (a film's cast and the room's own are told apart: a film often
    // leaves the room's own out).
    withFamilies(list) {
        const at = spec => (spec.extra ? 'film ' : 'room ') + (spec.station || '') + '|', seen = new Set(list.filter(s => s.desk).map(s => at(s) + s.id)), out = [];
        for (const spec of list) {
            out.push(spec); if (!spec.desk || !(spec.extra || spec.station)) continue;   // the rooms' own featured-desk crews name their postures
            for (const [id, desk] of deskFamily(spec.id)) {
                if (seen.has(at(spec) + id) || !this.library.entry?.(id)) continue;
                if (this.filter && /-stand-mid$/.test(id)) continue;   // (a film's chapters keep the people they were made with: the mid-height posture is the Studio's)
                seen.add(at(spec) + id); out.push({ ...spec, id, desk, variant: this.keyOf(spec), pose: undefined });
            }
        }
        return out;
    }
    // The same person with a skeleton, in the same place (the Director's pose mode, a placement with `pose`).
    rig(object) {
        if (object.userData.personRig) return Promise.resolve(object);
        return object.userData.personRigging ||= (async () => {
            const spec = object.userData.person, rigged = await this.library.rigInstance?.(spec.id).catch(() => null), at = this.people.indexOf(object);
            if (!rigged || at < 0) { delete object.userData.personRigging; return object; }
            const bones = new Map(), rest = new Map(); rigged.traverse(o => { if (o.isBone) { bones.set(o.name, o); rest.set(o.name, o.quaternion.clone()); } });
            rigged.name = object.name; rigged.position.copy(object.position); rigged.rotation.copy(object.rotation); rigged.visible = object.visible;
            for (const k of ['person', 'personFit', 'personChair', 'personChairBase', 'personMissing', 'personAmount']) if (object.userData[k] !== undefined) rigged.userData[k] = object.userData[k];
            rigged.userData.personRig = { bones, rest };
            if (object.userData.personMaterials) { for (const m of object.userData.personMaterials) m.dispose(); this.ownMaterials(rigged); }
            object.parent?.add(rigged); object.removeFromParent(); this.people[at] = rigged;
            const now = this.current(rigged) || spec; this.resize(rigged, now); this.recolor(rigged, now); this.pose(rigged, now);
            return rigged;
        })();
    }
    // spec.pose on the skeleton: every bone at the pose the model was built in, turned by its entry.
    pose(object, spec) {
        const rig = object.userData.personRig; if (!rig) return;
        for (const [name, bone] of rig.bones) { const d = spec.pose?.[name]; bone.quaternion.copy(rig.rest.get(name)); if (Array.isArray(d) && d.length === 4) bone.quaternion.multiply(poseTurn.fromArray(d)).normalize(); }
    }
    // The size a placement asks for, on top of the size the model was loaded at.
    resize(object, spec) {
        const base = object.userData.personBase ||= object.scale.clone(), k = Number.isFinite(spec.scale) && spec.scale > 0 ? spec.scale : 1;
        object.scale.copy(base).multiplyScalar(k); object.userData.personChair?.scale.copy(object.userData.personChairBase ||= object.userData.personChair.scale.clone()).multiplyScalar(k);
    }
    // spec.colors: each named part takes the new colour, shaded by the brightness of its own texture. A one-piece outfit
    // (no garment of its own below the waist) takes `top` above the waist and `bottom` below it.
    recolor(object, spec) {
        const colors = spec.colors || null; if (!colors && !object.userData.personTinted) return;
        if (!object.userData.personMaterials) this.ownMaterials(object);
        object.userData.personTinted = !!colors;
        const onePiece = !object.userData.personMaterials.some(m => partOf(m.name) === 'bottom');
        for (const m of object.userData.personMaterials) {
            const part = partOf(m.name), split = onePiece && part === 'top', hex = colors?.[part], lowHex = split ? colors?.bottom : hex;
            if (!m.userData.tint) {
                if (!hex && !lowHex) continue;
                const tint = m.userData.tint = { color: { value: new THREE.Vector4(1, 1, 1, .2) }, on: { value: 0 }, low: { value: new THREE.Vector4(1, 1, 1, .2) }, lowOn: { value: 0 } };
                m.onBeforeCompile = shader => {
                    shader.uniforms.personTint = tint.color; shader.uniforms.personTintOn = tint.on; shader.uniforms.personTintLow = tint.low; shader.uniforms.personTintLowOn = tint.lowOn;
                    shader.vertexShader = 'attribute float personLower;\nvarying float vPersonLower;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPersonLower = personLower;');
                    shader.fragmentShader = 'uniform vec4 personTint;\nuniform float personTintOn;\nuniform vec4 personTintLow;\nuniform float personTintLowOn;\nvarying float vPersonLower;\n' + shader.fragmentShader.replace('#include <map_fragment>',
                        '#include <map_fragment>\n\t{ bool pLow = vPersonLower > .5; if ((pLow ? personTintLowOn : personTintOn) > .5) { vec4 pt = pLow ? personTintLow : personTint; float pl = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); diffuseColor.rgb = pt.rgb * clamp(pl / max(pt.a, .01), 0., 2.4); } }');
                };
                m.customProgramCacheKey = () => 'person-tint-2'; m.needsUpdate = true;
            }
            const tint = m.userData.tint, stats = garmentStats(object, m), set = (v, value, lum) => { const c = new THREE.Color(value); v.value.set(c.r, c.g, c.b, lum); };
            tint.on.value = hex ? 1 : 0; tint.lowOn.value = lowHex ? 1 : 0;
            if (hex) set(tint.color, hex, split ? stats.up.lum : stats.all.lum);
            if (lowHex) set(tint.low, lowHex, split ? stats.low.lum : stats.all.lum);
        }
    }
    // The colours a person's clothes and hair have as built ('#rrggbb' per part they have; a one-piece outfit gives
    // top and bottom from above and below its waist), for the Director's swatches.
    partColors(key) {
        const object = this.byKey(key); if (!object) return null;
        const mats = []; object.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (!mats.includes(m)) mats.push(m); });
        const onePiece = !mats.some(m => partOf(m.name) === 'bottom'), out = {};
        for (const m of mats) {
            const part = partOf(m.name); if (!part || part === 'glasses') continue; const stats = garmentStats(object, m);
            if (part === 'top' && onePiece) { out.top = hexOf(stats.up.color); out.bottom = hexOf(stats.low.color); }
            else if (!out[part] || part !== 'top') out[part] = hexOf(stats.all.color);
        }
        return out;
    }
    // The person shown under that key (a film's own entry wins over a room person of the same name it has replaced).
    // Of a person's desk postures it is the one showing now, else the one the placement names.
    byKey(key) { const all = this.people.filter(o => this.keyOf(o.userData.person) === key && this.allowed(o.userData.person)), any = all.length ? all : this.people.filter(o => this.keyOf(o.userData.person) === key); return any.find(o => o.visible) || any.find(o => !o.userData.person.variant) || any[0] || null; }
    // Who is in the room now (for the Director's People tab), room millimetres and degrees.
    list() {
        return this.people.map(o => { const s = o.userData.person; return { key: this.keyOf(s), id: s.id, extra: !!s.extra, desk: s.desk || null, station: s.station || null,
            at: [Math.round(o.position.x), Math.round(o.position.z)], y: Math.round(o.position.y), turn: Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10, scale: s.scale || 1,
            allowed: this.allowed(s), missing: !!o.userData.personMissing, visible: o.visible, amount: o.userData.personAmount ?? 1, rigged: !!o.userData.personRig, variant: s.variant || null }; });
    }
    // The cast as plain placements a film can keep: desk and station people as they are (they follow their desk),
    // everyone else at the spot and facing they have settled into (`on`, `by`, `near` resolved).
    resolved() {
        // (the people of the daypart the room is in: a film chapter that takes the room's people over takes that hour's cast)
        const now = s => !s.modes || this.modeNow === undefined || s.modes.includes(this.modeNow) || this.named(s);
        return this.people.filter(o => this.allowed(o.userData.person) && !o.userData.personMissing && !o.userData.person.variant && now(o.userData.person)).map(o => {
            const s = o.userData.person, out = { key: this.keyOf(s), id: s.id };
            if (s.desk) { out.desk = s.desk; if (s.station) out.station = s.station; if (s.reach !== undefined) out.reach = s.reach; if (s.chair === false) out.chair = false; }
            else if (s.beside && !s.at) out.beside = s.beside;
            else { out.at = [Math.round(o.position.x), Math.round(o.position.z)]; out.turn = Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10; if (Math.abs(o.position.y) > .5) out.y = Math.round(o.position.y); }
            if (s.scale && s.scale !== 1) out.scale = s.scale;
            if (s.colors) out.colors = { ...s.colors };
            if (s.pose) out.pose = structuredClone(s.pose);
            return out;
        });
    }
    // A placement's name: its `key`, else its model's id; one of its other desk postures (variant) answers to the same name.
    keyOf(spec) { return spec.key || spec.variant || spec.id; }
    // A film chapter that names someone in `only` shows them whatever the daypart casts (`modes` is the Studio's script).
    // (A model id in a film's list means the placement without a key of its own: the room may cast the same model a second
    // time under a key, for another daypart, and that twin is not the one an older cut meant.)
    named(spec) { const only = this.filter?.only; return !!only && (only.includes(this.keyOf(spec)) || (!spec.key && !spec.variant && only.includes(spec.id))); }
    allowed(spec) { const f = this.filter, k = this.keyOf(spec), has = list => list.includes(k) || (!spec.key && !spec.variant && list.includes(spec.id)); return !f || spec.extra || ((!f.only || has(f.only)) && !has(f.except || [])); }
    // 0..1: how much of the person is there at this second of the film.
    present(spec, time) {
        const spans = this.filter?.when?.[this.keyOf(spec)]; if (!spans || !Number.isFinite(time)) return 1;
        const fade = this.filter.fade ?? .5; let amount = 0;
        for (const [t0, t1, fin = fade, fout = fade] of spans) {
            if (time < t0 || time > t1) continue;
            amount = Math.max(amount, Math.min(fin > 0 && t0 > 0 ? (time - t0) / fin : 1, fout > 0 ? (t1 - time) / fout : 1, 1));
        }
        return THREE.MathUtils.smoothstep(amount, 0, 1);
    }
    get available() { return this.specs().length > 0; }
    // Loading is deferred to the first time the toggle is on: nobody pays for models they never see.
    async setEnabled(on) {
        this.enabled = !!on;
        if (this.enabled && !this.built) this.built = this.build();
        await this.built;
        if (!this.enabled) { for (const object of this.people) this.show(object, false); for (const actor of this.actors) if (actor.chair) actor.chair.visible = false; this.restoreChairs(); }
        else this.update(this.room.peopleState?.());
    }
    async build() {
        const room = this.room, token = room.token, root = room.root, cast = this.generation;
        await room.ready; await this.library.loadIndex();
        // The Studio loads the people of the hour (and whoever is at the featured desk); the rest of the cast comes when
        // its hour does (bringFor): a room with fifty placements over the day holds the dozen who are there now. A film
        // or a review frame loads its whole cast at once: its frames may not wait for a model.
        const all = this.withFamilies(this.specs()), hour = room.peopleState?.()?.mode;
        const lazy = !this.filter && !!hour && (globalThis.__PEOPLE_LAZY__ ?? !globalThis.__ERGO_PRESENTATION__);
        const now = s => !lazy || !s.modes || s.modes.includes(hour) || (s.desk && !s.station);
        this.waiting = all.filter(s => !now(s)); this.loadedFor = hour;
        if (await this.bring(all.filter(now), token, root, cast)) await this.cast(token, root);
    }
    // Loads these placements' models and puts them in the room; false when the cast was replaced meanwhile.
    async bring(specs, token, root, cast) {
        const room = this.room;
        const load = async id => { try { return await this.library.instance(id); } catch (error) { console.warn('[people] ' + id + ' did not load:', error?.message || error); return null; } };
        const loaded = await Promise.all(specs.map(async spec => ({ spec, object: await load(spec.id), chair: spec.desk === 'sit' && !ownSeat(spec) ? await load(TASK_CHAIR) : null })));
        const posed = [];
        // (a cast that was replaced while its models loaded is dropped: its people would stay in the room for good)
        if (token !== room.token || root !== room.root || cast !== this.generation) return false;
        for (const { spec, object, chair } of loaded) {
            if (!object) continue;
            object.name = 'Person:' + spec.id; object.userData.person = spec; object.userData.personFit = this.library.entry(spec.id)?.person?.deskHeight ?? null; object.visible = false;
            if (chair) { chair.name = 'Person chair:' + spec.id; chair.visible = false; root.add(chair); object.userData.personChair = chair; }
            if (spec.desk || this.filter?.when?.[this.keyOf(spec)]) this.ownMaterials(object);
            root.add(object); this.people.push(object); this.resize(object, spec); this.recolor(object, spec);
            if (this.posed(spec)) posed.push(object);
            if (spec.station) this.atStation(object, spec);
            else if (!spec.desk && !spec.beside) this.settle(object, spec);
        }
        this.blocked = null;
        await Promise.all(posed.map(object => this.rig(object)));
        return cast === this.generation;
    }
    // Another hour of the day: whoever of the cast is there then and not loaded yet.
    bringFor(mode) {
        this.loadedFor = mode; const due = this.waiting.filter(s => s.modes.includes(mode)); if (!due.length) return;
        this.waiting = this.waiting.filter(s => !due.includes(s));
        const room = this.room, cast = this.generation;
        this.later(this.bring(due, room.token, room.root, cast).then(here => { if (here) { this.placed = false; this.dirty = true; } }));
    }
    // The people at the featured desk who can move (room-people-motion.mjs): the models of one character there become
    // one person, drawn skinned, who sits, stands and takes their hands off the keys with the desk. Needs the
    // character's bone data (library.rigData); without it they stay still models that show at their own height.
    //   filter.motion === false keeps the still models for one use of the room.
    async cast(token, root) {
        const generation = this.generation; this.actors = [];
        if (!this.library.rigData || this.filter?.motion === false) return;
        const groups = new Map();
        for (const object of this.people) {
            const spec = object.userData.person, who = spec.desk && !spec.station ? this.library.entry(spec.id)?.person?.character : null;
            if (who) { if (!groups.has(who)) groups.set(who, []); groups.get(who).push(object); }
        }
        for (const [who, objects] of groups) {
            const data = await this.library.rigData(who).catch(() => null); if (generation !== this.generation) return; if (!data) continue;
            const rig = new PersonRig(data); if (objects.some(o => !rig.has(o.userData.person.id))) continue;
            const drawn = await Promise.all(objects.map(o => this.rig(o)));
            if (generation !== this.generation) return;
            if (token !== this.room.token || root !== this.room.root || drawn.some(o => !o.userData.personRig || !this.people.includes(o))) continue;
            const actor = new DeskActor(rig); actor.objects = drawn; actor.chair = null;
            for (const o of drawn) { o.userData.personActor = actor; if (o.userData.personChair) { if (!actor.chair) actor.chair = o.userData.personChair; else o.userData.personChair.visible = false; } }
            this.actors.push(actor);
        }
        this.placed = false;
    }
    // Still on the way up or down, or moving their hands: the Studio keeps drawing at full rate meanwhile.
    get moving() { return this.enabled && (this.actors.some(a => a.moving) || this.pairs.some(c => c.live)); }
    // Which of an actor's models are in this use of the room, and how far from the keys each stands.
    recast(actor) {
        // (of the casts for the hours of the day, the models cast for this one: the morning's coffee is not the night's tea)
        const now = s => !s.modes || this.modeNow === undefined || s.modes.includes(this.modeNow) || this.named(s);
        const members = actor.objects.filter(o => this.people.includes(o) && !o.userData.personMissing && this.allowed(o.userData.person) && now(o.userData.person)).map(object => {
            const spec = object.userData.person;
            return { object, id: spec.id, role: spec.desk, behind: BEHIND_KEYS[spec.desk] + (spec.reach ?? REACH[spec.desk]) - REACH[spec.desk], scale: object.scale.z || 1000 };
        });
        // two models of one stance built for one height (coffee in hand and typing, both at 43.5 in): the first one cast is her
        const fit = m => m.role + '|' + (this.library.entry(m.id)?.person?.deskHeight ?? ''), kept = members.filter((m, i) => members.findIndex(n => fit(n) === fit(m)) === i);
        const used = actor.configure(kept); for (const o of actor.objects) o.userData.personDriven = used.some(m => m.object === o);
    }
    // The featured desk's people fade with the desk height, so they need materials of their own (textures stay shared).
    ownMaterials(object) {
        const copies = new Map(); object.userData.personMaterials = [];
        object.traverse(o => { if (!o.isMesh) return; o.material = [].concat(o.material).map(m => { if (!copies.has(m)) { const c = m.clone(); c.userData.sharedTextures = true; c.userData.solid = { transparent: m.transparent, opacity: m.opacity }; copies.set(m, c); object.userData.personMaterials.push(c); } return copies.get(m); })[0]; });
    }
    fade(object, amount) {
        if (object.userData.personFade === amount) return; object.userData.personFade = amount;
        for (const m of object.userData.personMaterials || []) { const solid = amount >= 1; m.transparent = solid ? m.userData.solid.transparent : true; m.opacity = m.userData.solid.opacity * amount; m.needsUpdate = true; }
        const chair = object.userData.personChair; if (chair && !object.userData.personDriven) chair.visible = object.visible && amount > .5;
        object.traverse(o => { if (o.isMesh) o.castShadow = amount > .5; });
    }
    props(id) { return this.room.assets().filter(o => o.userData.propId === id || o.userData.decorUpgrade === id); }
    centreOf(object) { return this.room.root.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())); }
    // The nearest piece of furniture whose id starts with one of these (a chair's own table, of the room's several).
    nearest(prefixes, at) {
        let best = null, least = Infinity;
        for (const o of this.room.assets()) {
            const id = o.userData.propId || o.userData.decorUpgrade; if (!id || !prefixes.some(p => id.startsWith(p))) continue;
            const c = this.centreOf(o), d = Math.hypot(c.x - at.x, c.z - at.z); if (d < least) { least = d; best = o; }
        }
        return best;
    }
    // At one of the room's other desks. That desk as it is now (state.station: where it stands, how high it is; the
    // Director moves and raises these desks) decides where the person is and whether their pose suits it (update);
    // without a live desk it is the layout's station as designed.
    stationNow(spec, state) {
        const live = state?.station?.(spec.station); if (live?.pose) return live;
        const station = this.room.roomLayout?.stations?.find(s => s.id === spec.station);
        return station ? { height: station.height ?? 28, pose: { x: station.at[0], z: station.at[1], yaw: THREE.MathUtils.degToRad(station.turn || 0) } } : null;
    }
    atStation(object, spec, state = null) {
        const desk = this.stationNow(spec, state); if (!desk) { object.userData.personMissing = true; return null; }
        const yaw = desk.pose.yaw || 0;
        object.position.set(desk.pose.x, 0, desk.pose.z).addScaledVector(frontOf(yaw), spec.reach ?? REACH[spec.desk]); object.rotation.y = yaw + Math.PI;
        return desk;
    }
    // A fixed placement: on a seat, by a piece of furniture, or at a spot.
    settle(object, spec) {
        let anchor = null;
        if (spec.on || spec.by || spec.around) { const [id, n] = [].concat(spec.on || spec.by || spec.around[0]); anchor = this.props(id)[n || 0] || null; }
        else if (spec.near) {
            const spot = new THREE.Vector3(spec.near[0], 0, spec.near[1]);
            anchor = this.room.assets().filter(o => CHAIRS.test((o.userData.propId || '') + ' ' + (o.userData.decorUpgrade || ''))).map(o => ({ o, d: this.centreOf(o).setY(0).distanceTo(spot) })).filter(c => c.d < 450).sort((a, b) => a.d - b.d)[0]?.o || null;
        }
        if ((spec.on || spec.by || spec.near || spec.around) && !anchor) { object.userData.personMissing = true; return; }
        // (the Studio: a seat the room has put away for the hour, chairs up on the tables after school, has nobody on it)
        if (!this.filter && (spec.on || spec.near) && anchor) { for (let o = anchor; o && o !== this.room.root; o = o.parent) if (!o.visible) { object.userData.personMissing = true; return; } }
        object.userData.personMissing = false; object.userData.personAnchor = anchor; object.userData.personAnchorAt = anchor && this.anchorKey(anchor);
        const turn = THREE.MathUtils.degToRad(spec.turn || 0);
        if (spec.on || spec.near) {
            const centre = this.centreOf(anchor); let yaw = this.yawOf(anchor) + turn;
            if (spec.face) yaw = Math.atan2(spec.face[0] - centre.x, spec.face[1] - centre.z);
            // toward: of the four ways a seat can be sat on, the one that faces that prop (a chair at its table, a sofa and
            // its coffee table). Chair models do not agree on which way is front; what they belong to does. It is the
            // nearest part of the prop that is faced, not its middle: a chair far along a long table faces the table.
            const to = spec.toward && (Array.isArray(spec.toward) ? this.nearest(spec.toward, centre) : this.props(spec.toward)[0]);
            if (to) {
                this.room.root.updateWorldMatrix(true, false);
                const box = new THREE.Box3().setFromObject(to).applyMatrix4(this.room.root.matrixWorld.clone().invert()), c = box.containsPoint(new THREE.Vector3(centre.x, (box.min.y + box.max.y) / 2, centre.z)) ? this.centreOf(to) : box.clampPoint(centre, new THREE.Vector3());
                const want = Math.atan2(c.x - centre.x, c.z - centre.z), own = this.yawOf(anchor); let off = Infinity;
                for (let k = 0; k < 4; k++) { const y = own + k * Math.PI / 2, e = Math.abs(Math.atan2(Math.sin(y - want), Math.cos(y - want))); if (e < off) { off = e; yaw = y + turn; } }
            }
            // a seat with a back is sat on facing away from it, whichever way its model points (the university's wing
            // chairs are built facing -z: Rosa and Andre sat in them the wrong way round). `toward` and `face` are left
            // as they are: they face what the seat belongs to.
            if (spec.on && !to && !spec.face && /-(kid-)?sit-(?!floor)/.test(spec.id) && this.backAhead(anchor, centre, yaw)) yaw += Math.PI;
            const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            object.position.copy(centre).addScaledVector(side, spec.along || 0).addScaledVector(frontOf(yaw), spec.depth ?? 60); object.position.y = 0; object.rotation.y = yaw;
        } else if (spec.around) {
            // round a rug, a mat or a table: at that angle (degrees, 0 = the room's front side of it) and distance (mm) from its middle, facing it
            const centre = this.centreOf(anchor), a = THREE.MathUtils.degToRad(spec.around[1] || 0), r = spec.around[2] ?? 600;
            const at = (da, dr) => new THREE.Vector3(centre.x + Math.sin(a + da) * (r + dr), 0, centre.z + Math.cos(a + da) * (r + dr));
            let da = 0, dr = 0, found = !spec.clear;
            if (spec.clear) search: for (let k = 0; k <= 8; k++) for (const sign of k ? [1, -1] : [1]) for (const out of [0, 200, -200]) {
                if (r + out < 550) continue;
                if (this.spotFree(at(sign * k * Math.PI / 9, out), object, spec)) { da = sign * k * Math.PI / 9; dr = out; found = true; break search; }
            }
            if (!found) { object.userData.personMissing = true; return; }   // nowhere to stand: not there
            object.position.copy(at(da, dr)); object.rotation.y = a + da + Math.PI + turn;
        } else if (spec.by) {
            const yaw = this.yawOf(anchor), home = this.room.root.worldToLocal(anchor.getWorldPosition(new THREE.Vector3())), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const at = (along, out) => home.clone().addScaledVector(frontOf(yaw), (spec.reach ?? 600) + out).addScaledVector(side, along).setY(0);
            let along = 0, out = 0, found = !spec.clear;
            if (spec.clear) search: for (const o of [0, 250]) for (let k = 0; k <= 4; k++) for (const sign of k ? [1, -1] : [1]) {
                if (this.spotFree(at(sign * k * 250, o), object, spec)) { along = sign * k * 250; out = o; found = true; break search; }
            }
            if (!found) { object.userData.personMissing = true; return; }   // nowhere to stand: not there
            object.position.copy(at(along, out));
            object.rotation.y = yaw + Math.PI + turn - Math.PI * (spec.turn ? 1 : 0);
        } else {
            // at a spot; with clear: there, or the nearest free place within about half a metre (none: not there)
            let x = spec.at[0], z = spec.at[1];
            if (spec.clear) {
                const hit = NEARBY.find(([dx, dz]) => this.spotFree(new THREE.Vector3(x + dx, 0, z + dz), object, spec));
                if (!hit) { object.userData.personMissing = true; return; }
                x += hit[0]; z += hit[1];
            }
            object.position.set(x, spec.y || 0, z); object.rotation.y = turn;
        }
        if (spec.seat && anchor) object.position.y = this.seatLift(object, spec, anchor);
        else if (spec.up) object.position.y = spec.up;      // standing on something (a treadmill's belt), mm
        object.userData.personHome = [object.position.x, object.position.z, object.rotation.y];      // (where a stroller starts from and comes back to)
    }
    // ---- A free spot. A fixed angle that suits one size of a room puts a guest in a sculpture or through a wall in
    // another: a placement with clear: true takes the nearest spot round (or along) its prop where a standing person
    // is clear of the furniture, the walls, the desk and its user, and the others who are there at that hour.
    obstacles() {
        if (this.blocked) return this.blocked;
        const root = this.room.root; root.updateWorldMatrix(true, true);
        const inv = root.matrixWorld.clone().invert(), boxes = [], own = new Set(); for (const o of this.people) { own.add(o); if (o.userData.personChair) own.add(o.userData.personChair); }
        const add = b => { if (!b.isEmpty() && b.max.y > 150 && b.min.y < 1300) boxes.push(b); };   // (not a rug underfoot, not what hangs overhead)
        boxes.seats = [];
        for (const asset of this.room.assets()) {
            if (own.has(asset) || /^Person/.test(asset.name)) continue;
            // a loose chair is taken out of the room when someone stands where it is (clearChairs, 600 mm): a guest
            // looking for a place keeps that far from it, so the chair stays (seen or not at this moment)
            const id = (asset.userData.propId || '') + ' ' + (asset.userData.decorUpgrade || '');
            if (CHAIRS.test(id) && !/armchair|lounge|sofa/i.test(asset.userData.propId || '')) boxes.seats.push(this.centreOf(asset).setY(0));
            asset.traverse(c => {
                if (!c.isMesh || !c.geometry) return;
                for (let v = c; v && v !== root; v = v.parent) if (!v.visible) return;
                if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
                if (c.isInstancedMesh) {   // each of its copies (a row of plants, battens), up to a sensible number
                    const m = new THREE.Matrix4();
                    for (let i = 0; i < Math.min(c.count, 400); i++) { c.getMatrixAt(i, m); add(c.geometry.boundingBox.clone().applyMatrix4(m).applyMatrix4(c.matrixWorld).applyMatrix4(inv)); }
                } else add(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld).applyMatrix4(inv));
            });
        }
        return this.blocked = boxes;
    }
    spotFree(at, object, spec) {
        const L = this.room.roomLayout, body = 260;
        if (L && Number.isFinite(L.width) && Number.isFinite(L.depth) && Number.isFinite(L.back)) {
            const left = L.left ?? -L.width / 2;   // (a room need not be centred on x = 0)
            if (at.x < left + body + 60 || at.x > left + L.width - body - 60 || at.z < L.back + body + 60 || at.z > L.back + L.depth - body) return false;
        }
        const blocked = this.obstacles();
        for (const b of blocked) if (Math.hypot(Math.max(b.min.x - at.x, 0, at.x - b.max.x), Math.max(b.min.z - at.z, 0, at.z - b.max.z)) < body) return false;
        for (const seat of blocked.seats) if (Math.hypot(seat.x - at.x, seat.z - at.z) < 620) return false;
        const desk = this.deskAt;   // the desk and the place of whoever is at it (in front of it)
        if (desk) { const dx = at.x - desk.x, dz = at.z - desk.z, c = Math.cos(desk.yaw || 0), sn = Math.sin(desk.yaw || 0), x = dx * c - dz * sn, z = dx * sn + dz * c; if ((Math.abs(x) < 1150 && z > -750 && z < 1350) || Math.hypot(x, z - 650) < 1300) return false; }   // (and not at the user's shoulder)
        const hours = spec.modes || null;
        for (const other of this.people) {
            const o = other.userData.person; if (other === object || o.desk || o.station || other.userData.personMissing || !this.allowed(o)) continue;   // (not someone a film has taken out)
            if (hours && o.modes && !o.modes.some(m => hours.includes(m))) continue;
            if (Math.hypot(other.position.x - at.x, other.position.z - at.z) < 650) return false;
        }
        return true;
    }
    // The way a piece of furniture faces in the room (its own turn and that of any group it sits in), and a key that
    // changes when the room moves, turns or swaps it (a daypart that turns the armchair): the person settles again.
    yawOf(object) {
        const root = this.room.root; root.updateWorldMatrix(true, false); object.updateWorldMatrix(true, false);
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(object.getWorldQuaternion(new THREE.Quaternion())));
        return Math.atan2(f.x, f.z);
    }
    anchorKey(object) { const p = this.room.root.worldToLocal(object.getWorldPosition(new THREE.Vector3())); return `${Math.round(p.x)},${Math.round(p.z)},${this.yawOf(object).toFixed(3)},${!!object.parent}`; }
    resettle(mode, desk = null) {
        const again = mode !== this.settledMode; this.settledMode = mode; this.deskAt = desk || this.deskAt || null;
        // (the desk appeared, or was moved or turned: whoever took a free spot looks again; steps of 100 mm and about 6 degrees)
        const d = this.deskAt, deskKey = d ? `${Math.round(d.x / 100)},${Math.round(d.z / 100)},${Math.round((d.yaw || 0) * 10)}` : '', moved = deskKey !== this.deskKey; this.deskKey = deskKey;
        this.blocked = null;   // (what is in the way is looked up once per pass: the room moves its furniture with the hour, the user at any time)
        for (const object of this.people) {
            const spec = object.userData.person; if (spec.desk || spec.station || spec.beside || !(spec.on || spec.by || spec.near || spec.around || (spec.at && spec.clear)) || this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id]) continue;
            const anchor = object.userData.personAnchor;
            if (spec.at ? again || moved : again || !anchor || this.anchorKey(anchor) !== object.userData.personAnchorAt || (spec.clear && moved)) this.settle(object, spec);
        }
        this.blocked = null;
    }
    // Whether a seat's back is ahead of someone sat on it facing `yaw`: the middle of its highest quarter (the back,
    // with arms that cancel out side to side) more than 80 mm ahead of its centre. A seat without a back (a stool, a
    // bench) has that middle near its centre and keeps the way it was given.
    backAhead(seat, centre, yaw) {
        const root = this.room.root; root.updateWorldMatrix(true, true); const inv = root.matrixWorld.clone().invert(), pts = [], v = new THREE.Vector3();
        seat.traverse(m => { if (!m.isMesh || m.isInstancedMesh || !m.geometry?.attributes?.position) return; const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 600)); for (let i = 0; i < p.count; i += step) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv).clone()); });
        if (pts.length < 8) return false;
        let lo = Infinity, hi = -Infinity; for (const p of pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
        const top = pts.filter(p => p.y > lo + (hi - lo) * .75); if (!top.length) return false;
        const ahead = top.reduce((a, p) => a + (p.x - centre.x) * Math.sin(yaw) + (p.z - centre.z) * Math.cos(yaw), 0) / top.length;
        return ahead > 80;
    }
    // How far the person moves up or down so the pose's seat height meets the real seat under the pelvis.
    seatLift(object, spec, anchor) {
        const root = this.room.root; root.updateWorldMatrix(true, true);
        this.ray.set(root.localToWorld(new THREE.Vector3(object.position.x, 1500, object.position.z)), down.clone().transformDirection(root.matrixWorld));
        const hit = this.ray.intersectObject(anchor, true).map(h => root.worldToLocal(h.point.clone()).y).find(y => y > 250 && y < 700);
        return hit === undefined ? 0 : THREE.MathUtils.clamp(hit - spec.seat, -40, spec.rise ?? 70);   // (rise: a seat that is higher than most)
    }
    show(object, on) {
        object.visible = on;
        const chair = object.userData.personChair;
        // the chair faces the way its user faces: toward the desk (it was turned half round, backrest against the user's chest)
        if (chair && !object.userData.personDriven) { chair.visible = on; if (on) { chair.position.set(object.position.x, 0, object.position.z); chair.rotation.y = object.rotation.y; } }
    }
    // filter.chair: one task chair that stays. It is under the seated desk user while they are there (`seated` 0..1)
    // and slides back from the desk when they are not.
    stayChair(state, seated, yaw) {
        const park = this.filter?.chair, chairs = this.people.filter(o => o.userData.personChair && !o.userData.personDriven && o.userData.person.desk === 'sit' && !o.userData.person.station && this.allowed(o.userData.person));
        if (!park || !chairs.length || !state?.pose) return;
        const keep = chairs[0].userData.personChair, front = frontOf(yaw), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const base = state.keyboard ? new THREE.Vector3(state.keyboard.x, 0, state.keyboard.z).addScaledVector(front, BEHIND_KEYS.sit) : new THREE.Vector3(state.pose.x - 6, 0, state.pose.z).addScaledVector(front, REACH.sit);
        const away = 1 - THREE.MathUtils.smoothstep(seated, 0, 1);
        for (const o of chairs) o.userData.personChair.visible = false;
        keep.visible = true; keep.position.copy(base).addScaledVector(front, (park.back ?? 620) * away).addScaledVector(side, (park.side ?? 0) * away);
        keep.rotation.y = yaw + Math.PI + THREE.MathUtils.degToRad((park.turn ?? 0) * away);
        this.chairSpot = keep.position; this.chairHome = base;
    }
    // state: { height (inches), mode, pose: { x, z, yaw }, keyboard: { x, z } | null, time } of the featured desk, room
    // millimetres; called every frame while enabled. With a keyboard the person lines up on it, not on the desk anchor.
    // time: seconds into a film chapter (null in the Studio), for the filter's `when`.
    update(state) {
        if (!this.enabled || !this.people.length) return;
        const height = state?.height ?? 28, pose = state?.pose, mode = state?.mode, time = state?.time ?? null, busy = new Set(); let working = false, seated = 0;
        const now = state?.now ?? (typeof performance !== 'undefined' ? performance.now() : 0), dt = this.clock === null ? 0 : (now - this.clock) / 1000; this.clock = now;
        // A tilted top stows its keyboard somewhere else (under the desk): the person stays where the keyboard was while
        // the top was flat (kept in the desk's own frame), or lines up on the desk itself if it never was.
        if (state?.keyboard && pose && Number.isFinite(state.tilt)) {
            const c = Math.cos(pose.yaw || 0), sn = Math.sin(pose.yaw || 0);
            if (Math.abs(state.tilt) <= 2) { const dx = state.keyboard.x - pose.x, dz = state.keyboard.z - pose.z; this.keysHome = { side: dx * c - dz * sn, ahead: dx * sn + dz * c }; }
            else state = { ...state, keyboard: this.keysHome ? { x: pose.x + this.keysHome.side * c + this.keysHome.ahead * sn, z: pose.z - this.keysHome.side * sn + this.keysHome.ahead * c } : null };
        }
        if (this.waiting?.length && mode !== this.loadedFor) this.bringFor(mode);
        if (mode !== this.modeNow) { this.modeNow = mode; if (this.placed) for (const actor of this.actors) this.recast(actor); }   // another hour: the person at the desk is recast from that hour's models
        if (!this.placed) {
            this.placed = true;
            for (const object of this.people) {
                // an extra person takes the placement the filter has for it now (it may have been moved since it was built)
                const now = object.userData.person.extra && (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(object.userData.person));
                if (now) {
                    const spec = object.userData.person = { ...this.asVariant(now, object.userData.person), extra: true }; object.userData.personMissing = false; this.resize(object, spec); this.recolor(object, spec);
                    if (object.userData.personRig) this.pose(object, spec); else if (this.posed(spec)) this.later(this.rig(object));
                    if (spec.station) this.atStation(object, spec); else if (!spec.desk && !spec.beside) this.settle(object, spec);
                }
                const spot = this.filter?.place?.[this.keyOf(object.userData.person)] || this.filter?.place?.[object.userData.person.id]; if (!spot) continue;
                object.position.set(spot.at[0], spot.y ?? 0, spot.at[1]); object.rotation.y = THREE.MathUtils.degToRad(spot.turn || 0); object.userData.personMissing = false;
                if (Number.isFinite(spot.scale)) this.resize(object, { scale: spot.scale });
            }
            for (const object of this.people) object.userData.personChanging = false;   // a re-placed cast is not half way through a change of posture
            for (const actor of this.actors) this.recast(actor);
            for (const pair of this.pairs) if (pair.live) { const a = this.people.find(o => o.userData.person === pair.from), b = this.people.find(o => o.userData.person === pair.to); if (a && b) this.endChange(pair, a, b); }
            this.pairs = this.pairUp();
        }
        this.lifeClock = time !== null ? time : this.lifeClock + Math.min(.1, Math.max(0, dt));
        const changing = this.changing(time, mode);
        // the people who move: where each is in sitting, standing and typing at this moment, and which of them the
        // desk belongs to at this height when the cast has more than one (the nearest built height wins)
        const there = actor => Math.max(0, ...actor.members.map(m => this.present(m.object.userData.person, time)));
        const driven = this.actors.filter(a => a.members.length && there(a) > 0);   // (a film hands the desk from one person to the next with `when`: who is not there yet is no rival)
        for (const actor of driven) {
            actor.drive({ height, target: state?.target, tilt: state?.tilt, time, track: state?.track || null, dt, life: this.filter?.life === false ? false : undefined, taps: time !== null || dt < .05 });
            const sign = actor.state.tau.toFixed(3) + '|' + actor.state.k.toFixed(3) + '|' + actor.shown?.id; if (sign !== actor.drawnAs) { actor.drawnAs = sign; this.dirty = true; }
            actor.off = Math.min(...actor.members.map(m => m.key.deskHeight === null ? 0 : Math.abs(height - m.key.deskHeight)));
            if (actor.mobile) { const fits = actor.members.map(m => m.key.deskHeight); if (height >= Math.min(...fits) && height <= Math.max(...fits)) actor.off = 0; }
        }
        const others = this.people.filter(o => o.userData.person.desk && !o.userData.person.station && !o.userData.personDriven && !o.userData.personMissing && this.allowed(o.userData.person) && o.userData.personFit !== null && (!o.userData.person.modes || o.userData.person.modes.includes(mode) || this.named(o.userData.person)))   /* (only who is cast for this hour can share the desk) */.map(o => Math.abs(height - o.userData.personFit));
        for (const [n, actor] of driven.entries()) {
            const rivals = driven.filter(a => a !== actor), rival = Math.min(...rivals.map(a => a.off), ...others, Infinity);
            // two who fit the height equally: the first cast has the desk (they used to share it, each half there)
            const tied = rivals.some((a, i) => Math.abs(a.off - actor.off) < 1e-6 && driven.indexOf(a) < n);
            actor.cover = rival === Infinity ? 1 : tied ? 0 : Math.abs(rival - actor.off) < 1e-6 ? 1 : THREE.MathUtils.smoothstep(rival - actor.off, -.5, .5);
            // someone with one stance only (seated, with the desk gone up past them) is not at the desk beyond the heights their poses reach
            if (!actor.mobile) actor.cover *= 1 - THREE.MathUtils.smoothstep(actor.off, HEIGHT_SOLID, HEIGHT_FIT);
            // away from the desk for a moment: a film's own cast of the same character somewhere else, timed with `when` (Maya
            // stretching while the gym's desk rises) is that person, so they are not at the desk as well. (A standing-by
            // model, stand-wait, is an older cut's stand-in for the gap: the desk user fills that gap themselves, below.)
            actor.away = 0;
            if (time !== null) for (const o of this.people) {
                const s = o.userData.person; if (!s.extra || s.desk || o.userData.personMissing || !this.allowed(s) || !this.filter?.when?.[this.keyOf(s)]) continue;
                const person = this.library.entry(s.id)?.person; if (person && person.pose !== 'stand-wait' && person.character === actor.character) actor.away = Math.max(actor.away, this.present(s, time));
            }
            actor.cover *= 1 - actor.away;
        }
        this.resettle(mode, pose);
        for (const object of this.people) {
            const spec = object.userData.person, fit = object.userData.personFit;
            const there = this.present(spec, time);
            let on = !object.userData.personMissing && this.allowed(spec) && there > 0 && (!spec.modes || spec.modes.includes(mode) || this.named(spec));
            object.userData.personAmount = there;
            const actor = object.userData.personDriven ? object.userData.personActor : null, change = changing.get(object);
            // changing posture on the spot: one of the two models, whole, with the bones on their way
            if (change) { on = !object.userData.personMissing && this.allowed(spec) && change.shown === object; object.userData.personAmount = 1; }
            // an older cut's stand-in for the gap (a standing-by model of the desk user, cast by hand for the seconds the
            // desk moves): the desk user fills that gap themselves now
            if (on && !spec.desk && spec.extra && driven.length && this.filter?.when?.[this.keyOf(spec)]) {
                const person = this.library.entry(spec.id)?.person;
                if (person?.pose === 'stand-wait' && driven.some(a => a.mobile && a.character === person.character)) on = false;
            }
            if (actor) {
                // one moving person: drawn as the model built for the stance they are in, always there
                on = on && !!pose && actor.shown?.object === object && actor.cover > 0;
                if (on) {
                    object.userData.personAmount = there * actor.cover;
                    const yaw = pose.yaw || 0, front = frontOf(yaw), keys = state.keyboard, short = (spec.reach ?? REACH[spec.desk]) - REACH[spec.desk];
                    if (keys) object.position.set(keys.x, 0, keys.z).addScaledVector(front, BEHIND_KEYS[spec.desk] + short);
                    else object.position.set(pose.x - 6, 0, pose.z).addScaledVector(front, REACH[spec.desk] + short);
                    object.rotation.y = yaw + Math.PI; working = true;
                    actor.apply(actor.shown, spec.pose || null, typeof window !== 'undefined' && !!window.__directorDragging);
                }
            } else if (spec.desk && !spec.station) {
                const off = fit === null ? 0 : Math.abs(height - fit);
                on = on && !!pose && !working && off <= HEIGHT_FIT;
                if (on) {
                    object.userData.personAmount = there * (1 - THREE.MathUtils.smoothstep(off, HEIGHT_SOLID, HEIGHT_FIT));
                    const yaw = pose.yaw || 0, front = frontOf(yaw), keys = state.keyboard, short = (spec.reach ?? REACH[spec.desk]) - REACH[spec.desk];
                    if (keys) object.position.set(keys.x, 0, keys.z).addScaledVector(front, BEHIND_KEYS[spec.desk] + short);
                    else object.position.set(pose.x - 6, 0, pose.z).addScaledVector(front, REACH[spec.desk] + short);
                    object.rotation.y = yaw + Math.PI; working = true;
                }
            } else if (spec.desk && spec.station && !(this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id])) {
                // at another desk of the room: there while that desk is at the height the pose was built for, and where it stands now
                const desk = on ? this.atStation(object, spec, state) : null, off = !desk || fit === null ? 0 : Math.abs(desk.height - fit);
                on = on && !!desk && !busy.has(spec.station) && off <= HEIGHT_FIT;
                if (on) { busy.add(spec.station); object.userData.personAmount = there * (1 - THREE.MathUtils.smoothstep(off, HEIGHT_SOLID, HEIGHT_FIT)); }
            } else if (spec.variant) on = false;   // put somewhere by hand (filter.place): only the posture the placement names
            else if (spec.beside && (this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id])) {
                // placed for this use: stays where it was put
            } else if (spec.beside && pose) {
                const yaw = pose.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), [dx, dz] = spec.beside;
                object.position.set(pose.x + dx * c + dz * s, 0, pose.z - dx * s + dz * c);
                object.rotation.y = Math.atan2(pose.x - object.position.x, pose.z + 350 - object.position.z);   // toward the desk's working edge
            } else if (spec.beside) on = false;
            this.show(object, on);
            if (on && object.userData.personMaterials) this.fade(object, object.userData.personAmount ?? 1);
            if (on && spec.desk === 'sit' && !spec.station) seated = Math.max(seated, object.userData.personAmount ?? 1);
        }
        this.chairSpot = this.chairHome = null;
        if (this.filter?.chair) this.stayChair(state, seated, pose?.yaw || 0);
        for (const actor of driven) this.chairOf(actor, state);
        this.liven(time, dt, now);
        this.clearChairs();
        this.ownChairs();
        this.seatChildren();
    }
    // Life in the people who stay where they are (room-people-motion.mjs solveStill): breathing, a drifting head, a
    // shift of weight, typing fingers, a page turned. They are drawn skinned for it. In a film everyone in the shot;
    // in the Studio the LIVELY nearest to the camera (this.eye, room millimetres), picked again twice a second.
    // Walkers are left alone. filter.life === false: nobody.
    liven(time, dt, now) {
        if (!this.library.rigData || this.filter?.life === false) return;
        const film = time !== null;
        const pool = this.people.filter(o => o.visible && !o.userData.personDriven && !o.userData.personStill && !o.userData.personChanging);
        let chosen = pool;
        if (!film && pool.length > LIVELY) {
            if (now - this.pickedAt > 500) {
                this.pickedAt = now; const eye = this.eye, far = o => eye ? o.position.distanceToSquared(eye) : 0;
                this.picked = [...pool].sort((a, b) => far(a) - far(b)).slice(0, LIVELY).map(o => o.userData.person);
            }
            // (whoever is training on a machine always moves: a rider who is not pedalling is a statue)
            chosen = pool.filter(o => this.picked.includes(o.userData.person) || this.training(o));
        }
        const turning = new Set();
        const hold = typeof window !== 'undefined' && !!window.__directorDragging;
        for (const object of pool) {
            const life = object.userData.personLife, on = chosen.includes(object);
            if (life === undefined) { if (on) { object.userData.personLife = null; this.later(this.enliven(object)); } continue; }
            if (!life || !object.userData.personRig || (!on && !life.live)) continue;
            if (object.userData.person.walk && on) { this.walkAlong(object, life, object.userData.person.walk, film ? time : null, hold); continue; }
            // someone cast in a walking posture walks (the Studio; a film gives its walkers a path of their own)
            if (this.strolls(object)) { if (!film && on && this.stroll(object, life, hold)) continue; this.strollHome(object, life); }
            // walking on a treadmill's belt: the stride of a walk, on the spot
            if (object.userData.person.tread && on) {
                life.tread ||= walkPlan(life.rig, life.key, life.key, [[0, 0], [0, 24]], { pace: object.userData.person.tread.pace, step: object.userData.person.tread.step ? object.userData.person.tread.step / 1000 : undefined });
                solveTread(life.rig, life.tread, this.lifeClock, (life.seed % 1000) / 1000);
                drawPose(life.rig, object.userData.personRig, 0, object.userData.person.pose || null, hold); life.live = true; continue;
            }
            // out of the nearest few: back to the posture as built, once
            const moved = solveStill(life.rig, life.key, { time: this.lifeClock, seed: life.seed, life: on ? 1 : 0, taps: film || dt < .05 });
            drawPose(life.rig, object.userData.personRig, 0, object.userData.person.pose || null, hold); life.live = on;
            // a rider's bike: its crank turns with the feet, the pedals stay level
            if (moved?.crank !== undefined) { const crank = object.userData.personAnchor?.getObjectByName('Bike crank'); if (crank) { this.turnCrank(crank, moved.crank); turning.add(crank); this.cranks.add(crank); } }
            // a potter's wheel: its head (and the pot on it) turns while they throw
            if (moved?.wheel !== undefined) { const head = object.userData.personAnchor?.getObjectByName('Pottery wheel head'); if (head) { head.rotation.y = moved.wheel; this.dirty = true; turning.add(head); this.cranks.add(head); } }
        }
        for (const crank of this.cranks) if (!turning.has(crank)) { if (crank.name === 'Bike crank') this.turnCrank(crank, 0); else { crank.rotation.y = 0; this.dirty = true; } this.cranks.delete(crank); }      // (nobody on it any more: as the room built it)
    }
    training(object) { return !!object.userData.person.tread || this.strolls(object) || WORKOUTS.has(this.library.entry?.(object.userData.person.id)?.person?.pose); }
    // ---- a stroll: a walker in the Studio goes along the longest clear stretch from where they stand (their own
    // heading first), stops, looks about, turns and comes back. The stretch is checked like a guest's free spot
    // (walls, furniture, the desk and its user, loose chairs, the others); under 1.5 m they stay where they are.
    strolls(object) { const s = object.userData.person; return !s.walk && !s.desk && !s.station && object.userData.personLife?.stroll !== false && this.library.entry?.(s.id)?.person?.pose === 'walk'; }
    stroll(object, life, hold) {
        // (the model drawn with its skeleton is another object than the one the room placed: it stands where that one stood)
        const spec = object.userData.person, home = object.userData.personHome ||= [object.position.x, object.position.z, object.rotation.y];
        const sign = home.map(v => v.toFixed(2)).join();
        if (!life.stroll || life.stroll.sign !== sign) {
            const who = this.character(object), id = `people-${who}-stand-wait`, stand = life.rig.has(id) ? life.rig.key(id) : null, [hx, hz, hyaw] = home;
            let best = null;
            if (stand) for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
                const yaw = hyaw + turn * Math.PI / 4, dx = Math.sin(yaw), dz = Math.cos(yaw); let d = 0;
                while (d < 4500 && this.spotFree(new THREE.Vector3(hx + dx * (d + 250), 0, hz + dz * (d + 250)), object, spec)) d += 250;
                if (d >= 1500 && (!best || d > best.d + 500)) best = { d, dx, dz }; if (!turn && d >= 2500) break;
            }
            this.blocked = null;
            if (!best) { life.stroll = false; return false; }
            const a = [hx / 1000, hz / 1000], b = [(hx + best.dx * best.d) / 1000, (hz + best.dz * best.d) / 1000], pace = 1.55 + (life.seed % 100) / 400;
            life.stroll = { sign, stand, there: walkPlan(life.rig, stand, stand, [a, b], { pace }), back: walkPlan(life.rig, stand, stand, [b, a], { pace }), pause: 3 + (life.seed % 7) * .45, a, b, y: object.position.y, start: this.lifeClock };      // (they set off from where they stand, now)
        }
        const st = life.stroll, t1 = st.there.seconds, t2 = st.back.seconds, u = Math.max(0, this.lifeClock - st.start) % (t1 + t2 + st.pause * 2), yawOut = Math.atan2(st.b[0] - st.a[0], st.b[1] - st.a[1]);
        let x, z, yaw;
        const rest = (at, from, w) => { solveStill(life.rig, st.stand, { time: this.lifeClock, seed: life.seed, life: 1 }); x = at[0]; z = at[1]; yaw = from + Math.PI * THREE.MathUtils.smoothstep(w, .3, .75); };
        if (u < t1) { const r = solveWalk(life.rig, st.there, st.there.at(u)); x = r.x; z = r.z; yaw = r.yaw; }
        else if (u < t1 + st.pause) rest(st.b, yawOut, (u - t1) / st.pause);
        else if (u < t1 + st.pause + t2) { const r = solveWalk(life.rig, st.back, st.back.at(u - t1 - st.pause)); x = r.x; z = r.z; yaw = r.yaw; }
        else rest(st.a, yawOut + Math.PI, (u - t1 - st.pause - t2) / st.pause);
        drawPose(life.rig, object.userData.personRig, 0, spec.pose || null, hold);
        object.position.set(x * 1000, st.y, z * 1000); object.rotation.y = yaw; life.live = life.strolling = true; this.dirty = true;
        return true;
    }
    // (a stroller who stops being one, a film, a change of cast, is back where the room put them)
    strollHome(object, life) { if (!life.strolling) return; const home = object.userData.personHome; if (home) { object.position.x = home[0]; object.position.z = home[1]; object.rotation.y = home[2]; } life.strolling = false; this.dirty = true; }

    turnCrank(crank, angle) { crank.rotation.x = -angle; for (const pedal of crank.children) if (pedal.name === 'Bike pedal') pedal.rotation.x = angle; this.dirty = true; }
    // ---- a change of posture on the spot (room-people-motion.mjs solveChange) instead of a dissolve
    // Two placements of one character at one spot make a change when one leaves as the other comes:
    //   film: their `when` windows meet (one ends within .75 s of the other's start);
    //   Studio: the daypart changes and one is cast for the old one, the other for the new (`modes`).
    // (Pairs are found when the cast is placed and their skeletons loaded then; a pair that is not ready changes as before.)
    // The person is then one model, whole, whose bones go from the first posture to the second (1.4 s, 2.4 s where
    // they get up or sit down), centred on the moment the windows meet. Things held appear and go half way.
    sameSpot(a, b) {
        const turn = Math.abs(THREE.MathUtils.euclideanModulo(a.rotation.y - b.rotation.y + Math.PI, Math.PI * 2) - Math.PI);
        return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) < 220 && turn < .3;
    }
    character(object) { return this.library.entry?.(object.userData.person.id)?.person?.character || null; }
    // Work left running in the background: rig() swaps a person for the rigged model and frees the old materials when it
    // lands. settled() resolves when none is under way (at most `limit` ms); the film's warm-up waits for it.
    later(work) { const job = work.catch(error => console.warn('[people]', error)).finally(() => this.pending.delete(job)); this.pending.add(job); return job; }
    async settled(limit = 20000) {
        for (const until = performance.now() + limit; this.pending.size && performance.now() < until;) await Promise.race([Promise.all(this.pending), new Promise(done => setTimeout(done, 250))]);
    }
    free(object) { const s = object.userData.person; return !s.desk && !s.station && !object.userData.personMissing && this.allowed(s); }
    pairUp() {
        const pairs = [], when = this.filter?.when; if (!this.library.rigData || this.filter?.motion === false) return pairs;
        const free = this.people.filter(o => this.free(o) && this.character(o)), modes = o => o.userData.person.modes;
        for (const a of free) for (const b of free) {
            if (a === b || this.character(a) !== this.character(b) || !this.sameSpot(a, b)) continue;
            const wa = when?.[this.keyOf(a.userData.person)], wb = when?.[this.keyOf(b.userData.person)];
            if (wa && wb) { for (const [, t1] of wa) for (const [t0] of wb) if (Math.abs(t1 - t0) <= .75) pairs.push({ from: a.userData.person, to: b.userData.person, at: (t1 + t0) / 2 }); }
            // cast for different dayparts: a change waiting for the daypart to change
            else if (modes(a) && modes(b) && modes(a).some(m => !modes(b).includes(m)) && modes(b).some(m => !modes(a).includes(m))) pairs.push({ from: a.userData.person, to: b.userData.person, at: null, start: null });
        }
        for (const pair of pairs) this.later(this.readyChange(pair));
        return pairs;
    }
    // Who is changing now: Map object -> { shown } for both models of each change under way.
    changing(time, mode) {
        const out = new Map(), film = time !== null, find = spec => this.people.find(o => o.userData.person === spec), inMode = (spec, m) => !spec.modes || spec.modes.includes(m);
        if (!film) {
            // the daypart changed: whoever leaves and whoever comes at the same spot are one person changing posture
            if (this.lastMode !== undefined && mode !== this.lastMode) for (const pair of this.pairs) {
                if (pair.at !== null || !pair.ready) continue;
                if (inMode(pair.from, this.lastMode) && !inMode(pair.from, mode) && !inMode(pair.to, this.lastMode) && inMode(pair.to, mode)) pair.start = this.lifeClock;
                else if (pair.start !== null) { pair.start = null; pair.stop = true; }
            }
            this.lastMode = mode;
        }
        const under = [];
        for (const pair of this.pairs) {
            const a = find(pair.from), b = find(pair.to); if (!a || !b || !pair.ready || (film ? pair.at === null : pair.at !== null)) continue;
            const length = pair.length, w = film ? (time - (pair.at - length / 2)) / length : pair.start === null ? -1 : (this.lifeClock - pair.start) / length, on = w > 0 && w < 1;
            if (!film && w >= 1) pair.start = null;
            if (on) under.push([pair, a, b, w]);
            else if (pair.live || pair.stop) { pair.live = pair.stop = false; this.endChange(pair, a, b); }
        }
        for (const [pair, a, b, w] of under) {
            const { model } = solveChange(pair.rig, pair.keyFrom, pair.keyTo, w), shown = model === 'from' ? a : b, ease = THREE.MathUtils.smoothstep(w, 0, .72);
            shown.position.lerpVectors(pair.homeFrom.position, pair.homeTo.position, ease); shown.rotation.y = pair.homeFrom.turn + (pair.homeTo.turn - pair.homeFrom.turn) * ease;
            drawPose(pair.rig, shown.userData.personRig, 0, shown.userData.person.pose || null);
            a.userData.personChanging = b.userData.personChanging = true; pair.live = true; this.dirty = true; out.set(a, { shown }); out.set(b, { shown });
        }
        return out;
    }
    // Both models with their skeletons, and the bone data: until then the two simply dissolve as before.
    async readyChange(change) {
        const find = spec => this.people.find(o => o.userData.person === spec), first = find(change.from); if (!first) return;
        const who = this.character(first), data = await this.library.rigData(who).catch(() => null); if (!data) return;
        if (!this.rigsOf.has(who)) this.rigsOf.set(who, new PersonRig(data));
        const rig = this.rigsOf.get(who), a = find(change.from), b = find(change.to); if (!a || !b || !rig.has(change.from.id) || !rig.has(change.to.id)) return;
        const [ra, rb] = await Promise.all([this.rig(a), this.rig(b)]); if (!ra.userData.personRig || !rb.userData.personRig) return;
        const home = o => ({ position: o.position.clone(), turn: o.rotation.y });
        Object.assign(change, { rig, keyFrom: rig.key(change.from.id), keyTo: rig.key(change.to.id), homeFrom: home(ra), homeTo: home(rb) });
        // a turn the short way round
        change.homeTo.turn = change.homeFrom.turn + THREE.MathUtils.euclideanModulo(change.homeTo.turn - change.homeFrom.turn + Math.PI, Math.PI * 2) - Math.PI;
        change.length = 1.4 + THREE.MathUtils.clamp(Math.abs(change.keyTo.wp[rig.b.pelvis].y - change.keyFrom.wp[rig.b.pelvis].y) / .3, 0, 1);
        change.ready = true;
    }
    // After a change both models are as built again, each where it belongs.
    endChange(change, a, b) {
        for (const [o, key, home] of [[a, change.keyFrom, change.homeFrom], [b, change.keyTo, change.homeTo]]) {
            solveChange(change.rig, key, key, 0); drawPose(change.rig, o.userData.personRig, 0, o.userData.person.pose || null);
            o.position.copy(home.position); o.rotation.y = home.turn; o.userData.personChanging = false;
        }
        this.dirty = true;
    }
    // A film's walker (a placement with `walk`): at the start of the path until `start`, then walking it, then standing
    // at its end. Footprints are planned once per path, so the same second is always the same stride.
    walkAlong(object, life, walk, time, hold) {
        const sign = JSON.stringify(walk) + '|' + JSON.stringify(object.userData.person.at || null);
        if (life.walkSign !== sign) {
            const path = (walk.path || [walk.from || [object.position.x, object.position.z], walk.to]).map(([x, z]) => [x / 1000, z / 1000]);
            life.walkSign = sign; life.plan = path.length > 1 && path.every(p => p.every(Number.isFinite)) ? walkPlan(life.rig, life.key, (walk.then && life.rig.key(walk.then)) || life.key, path, { pace: walk.pace, step: walk.step ? walk.step / 1000 : undefined }) : null;
        }
        if (!life.plan) return;
        const g = life.plan.at(time === null ? 0 : Math.max(0, time - (walk.start || 0))), root = solveWalk(life.rig, life.plan, g);
        drawPose(life.rig, object.userData.personRig, 0, object.userData.person.pose || null, hold);
        object.position.x = root.x * 1000; object.position.z = root.z * 1000; object.rotation.y = root.yaw; life.live = true;
        if (g > 0 && g < life.plan.steps.length) this.dirty = true;
    }
    get lively() { return this.enabled && this.people.some(o => o.visible && (o.userData.personLife?.live || o.userData.personDriven)); }
    async enliven(object) {
        const spec = object.userData.person, person = this.library.entry(spec.id)?.person, still = o => { o.userData.personStill = true; };
        if (!person || !(livelyPose(person.pose) || (person.pose === 'walk' && (spec.walk ? !!this.filter : !this.filter)))) return still(object);      // (a Studio walker strolls: stroll(); a film's walker with a path walks it)
        const data = await this.library.rigData(person.character).catch(() => null); if (!data) return still(object);
        if (!this.rigsOf.has(person.character)) this.rigsOf.set(person.character, new PersonRig(data));
        const rig = this.rigsOf.get(person.character); if (!rig.has(spec.id)) return still(object);
        const drawn = await this.rig(object); if (!drawn.userData.personRig) return still(drawn);
        drawn.userData.personLife = { rig, key: rig.key(spec.id), seed: seedOf(this.keyOf(spec)), live: false };
    }
    // A moving person's task chair: under them while they sit, rolled back with them before they stand, and left a
    // little further back (or where filter.chair parks it) while they are on their feet.
    chairOf(actor, state) {
        const chair = actor.chair, pose = state?.pose; if (!chair) return;
        const there = actor.objects.some(o => o.visible) || actor.away > 0;   // (their chair stays while they are away from the desk)
        chair.visible = there && !!pose; if (!chair.visible) return;
        const yaw = pose.yaw || 0, front = frontOf(yaw), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), sitter = actor.members.find(m => m.role === 'sit');
        const short = sitter ? sitter.behind - BEHIND_KEYS.sit : 0;
        const home = state.keyboard ? new THREE.Vector3(state.keyboard.x, 0, state.keyboard.z).addScaledVector(front, BEHIND_KEYS.sit + short) : new THREE.Vector3(pose.x - 6, 0, pose.z).addScaledVector(front, REACH.sit + short);
        const out = actor.out.chair, park = this.filter?.chair, parked = park ? THREE.MathUtils.smoothstep(actor.state.tau, 1.3, 2.5) : 0, back = out.back * 1000;
        chair.position.copy(home).addScaledVector(front, park ? back + ((park.back ?? 620) - back) * parked : back).addScaledVector(side, (park?.side ?? 0) * parked);
        chair.rotation.y = yaw + Math.PI + THREE.MathUtils.degToRad(park ? (park.turn ?? 0) * parked : out.turn);
        this.chairSpot = chair.position; this.chairHome = home;
    }
    // The room's own chairs make way wherever someone is working at a desk (they brought the chair the pose fits,
    // stand where the chair was, or roll in on their own wheels).
    clearChairs() {
        const spots = this.people.filter(o => o.visible && o.userData.person.desk).map(o => o.position);
        if (this.chairSpot) spots.push(this.chairSpot, this.chairHome);   // the room's own desk chair stays out while the film's is in the room
        // anyone standing or sitting on the floor where a chair is (a party guest by the desk): the chair is not there with them
        // (someone placed at a spot in a seated posture sits on the chair that is there: it stays under them)
        const feet = this.people.filter(o => { const s = o.userData.person; return o.visible && !s.desk && !s.on && !s.near && !this.sitter(o); }).map(o => o.position);
        const taken = new Set(this.people.filter(o => o.visible && o.userData.personAnchor).map(o => o.userData.personAnchor));   // the seat somebody is on stays
        const chairs = this.room.assets().filter(chair => CHAIRS.test((chair.userData.propId || '') + ' ' + (chair.userData.decorUpgrade || '')) && !/armchair|lounge|sofa/i.test(chair.userData.propId || '') && !taken.has(chair)).map(chair => {
            // stools and classroom chairs stay unless someone stands right where they are (the workshop's bar stool)
            const fixed = /student-chair|bar|artist/.test(chair.userData.propId || ''), reach = fixed ? 420 : 850, centre = this.centreOf(chair).setY(0), near = list => list.some(p => Math.hypot(p.x - centre.x, p.z - centre.z) < reach);
            return { chair, fixed, centre, blocked: near(spots) || feet.some(p => Math.hypot(p.x - centre.x, p.z - centre.z) < 600) };
        });
        // The featured desk's user sits on the chair they brought. Where the room has pushed its own desk chair back (an
        // evening at a tilted top) it is out of the 850 mm: every loose task chair within 1.3 m of them goes.
        const seat = this.people.find(o => o.visible && o.userData.person.desk === 'sit' && !o.userData.person.station);
        if (seat) for (const c of chairs) if (!c.fixed && Math.hypot(seat.position.x - c.centre.x, seat.position.z - c.centre.z) < 1300) c.blocked = true;
        for (const { chair, blocked } of chairs) {
            if (blocked && !this.hidden.has(chair)) { this.hidden.set(chair, chair.visible); chair.visible = false; }
            else if (!blocked && this.hidden.has(chair)) { chair.visible = this.hidden.get(chair); this.hidden.delete(chair); }
        }
    }
    // Seated on a seat (not on the floor, not a child on a child's seat): the posture needs something under it.
    sitter(object) { return /^sit-(?!floor)/.test(this.library.entry?.(object.userData.person.id)?.person?.pose || ''); }
    // Nobody sits on air: someone placed at a spot in a seated posture (a film's cast, the Director) with nothing to sit
    // on under them gets a task chair of their own, facing the way they face. Looked up once per place: a ray down
    // through the pelvis that meets anything of the room between 250 and 700 mm is a seat.
    ownChairs() {
        const root = this.room.root; let things = null;
        for (const object of this.people) {
            const spec = object.userData.person;
            if (object.userData.personChair || object.userData.personMissing || spec.desk || spec.station || spec.on || spec.near || spec.by || spec.around || !spec.at || !this.sitter(object)) continue;
            const key = Math.round(object.position.x) + ',' + Math.round(object.position.z); if (object.userData.personSeatProbe === key) continue;
            object.userData.personSeatProbe = key;
            // the room without its people: their matrices are left to the renderer (refreshed here, a skinned model's
            // bind matrix would lag its world matrix until the next frame), and a ray through one would leave it a
            // bounding sphere of this moment
            if (!things) { things = root.children.filter(o => o.visible && !/^Person/.test(o.name || '')); root.updateWorldMatrix(true, false); for (const o of things) o.updateWorldMatrix(false, true); }
            this.ray.set(root.localToWorld(new THREE.Vector3(object.position.x, 1500, object.position.z)), down.clone().transformDirection(root.matrixWorld));
            const seat = this.ray.intersectObjects(things, true).some(hit => {
                for (let a = hit.object; a && a !== root; a = a.parent) if (!a.visible || /^Person/.test(a.name || '')) return false;
                const y = root.worldToLocal(hit.point.clone()).y; return y > 250 && y < 700; });
            if (seat) continue;
            const token = this.room.token, cast = this.generation;
            this.later(Promise.resolve(this.library.instance(TASK_CHAIR)).then(chair => {
                const person = this.people.find(o => o.userData.person === spec);   // (the model with a skeleton may have taken the first one's place)
                if (!chair || !person || person.userData.personChair || token !== this.room.token || root !== this.room.root || cast !== this.generation) return;
                chair.name = 'Person chair:' + spec.id; root.add(chair); person.userData.personChair = chair; this.show(person, person.visible);
                if (person.userData.personAmount !== undefined) chair.visible = person.visible && person.userData.personAmount > .5;
                this.dirty = true;
            }).catch(error => console.warn('[people] a chair for ' + spec.id + ' did not load:', error?.message || error)));
        }
    }
    restoreChairs() { for (const [chair, visible] of this.hidden) chair.visible = visible; this.hidden.clear(); this.returnSeats(); }
    // A child at the desk sits on the room's own seat (chair: false), which the room keeps where its story has it
    // (pushed back, turned away from the desk). Like the adults' task chair, the seat under the child is the people's
    // own: a copy of the room's seat, under them and facing the desk with them, while the room's (hidden by
    // clearChairs) stays where it is, so nothing the Studio saves about the room's furniture changes.
    seatChildren() {
        const seats = this.kidSeats ||= new Map(), live = new Set();
        for (const person of this.people) {
            const spec = person.userData.person; if (!ownSeat(spec)) continue;
            // (keyed by the placement, not the object: a person drawn again with a skeleton is a new object in the same seat)
            const key = this.keyOf(spec) + '|' + spec.id, on = person.visible && (person.userData.personFade === undefined || person.userData.personFade > .5); let seat = seats.get(key);
            if (!on) continue;
            if (!seat || seat.mode !== this.modeNow || !seat.source.parent) {
                if (seat) { seat.copy.removeFromParent(); seats.delete(key); }
                const at = this.room.root.worldToLocal(person.getWorldPosition(new THREE.Vector3())).setY(0);
                const source = this.room.assets().filter(c => (c.visible || this.hidden.has(c)) && CHAIRS.test((c.userData.propId || '') + ' ' + (c.userData.decorUpgrade || '')) && !/armchair|lounge|sofa|student-chair|^lived-/i.test(c.userData.propId || ''))   // (lived-chair-…: the clothes over the chair back, part of the chair)
                    .map(c => ({ c, d: this.centreOf(c).setY(0).distanceTo(at) })).filter(x => x.d < 1600).sort((a, b) => a.d - b.d)[0]?.c;
                if (!source) continue;
                const copy = source.clone(true);
                // the clothes the room hangs over the chair back by the hour stay on the room's chair: nobody sits against them
                for (const o of [...copy.children]) if (/^lived-/.test(o.userData.propId || '') || o.userData.childLivedIn) copy.remove(o);
                copy.traverse(o => { o.userData = {}; }); copy.name = 'The seat under ' + (spec.key || spec.id);
                // which way the seat faces as built: library chairs face +z, as people do; a room's own seat built facing its desk says so
                seat = { source, copy, mode: this.modeNow, y: source.position.y, turn: source.userData.seatFront === '-z' ? Math.PI : 0 }; seats.set(key, seat);
            }
            live.add(key);
            if (seat.copy.parent !== person.parent) person.parent.add(seat.copy);
            // the room's own chair is out while its copy is under the child, however far the room has pushed it back
            if (!this.hidden.has(seat.source)) { this.hidden.set(seat.source, seat.source.visible); seat.source.visible = false; }
            seat.copy.visible = true; seat.copy.position.set(person.position.x, seat.y, person.position.z); seat.copy.rotation.set(0, person.rotation.y + seat.turn, 0);
        }
        for (const [key, seat] of seats) if (!live.has(key)) seat.copy.visible = false;
    }
    returnSeats() { for (const seat of (this.kidSeats || new Map()).values()) seat.copy.visible = false; }
    dispose() {
        this.restoreChairs();
        for (const seat of (this.kidSeats || new Map()).values()) seat.copy.removeFromParent(); this.kidSeats?.clear();
        for (const object of this.people) { object.userData.personChair?.removeFromParent(); object.removeFromParent(); for (const m of object.userData.personMaterials || []) m.dispose(); object.traverse(o => o.skeleton?.dispose?.()); }
        this.people = []; this.built = null; this.actors = []; this.pairs = []; this.waiting = []; this.generation++;
    }
}
