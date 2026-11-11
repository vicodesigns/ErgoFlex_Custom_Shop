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
//   { id, at: [x, z], turn, y }                       at a spot (y mm lifts a seated pose onto a seat that is not a prop)
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
// Not scene assets: the Studio's Rearrange mode and saved room edits leave them
// alone. The film casts each chapter through a filter (setFilter): who is in, who is moved, extra people of its
// own, and the seconds of the chapter each one is there for.
import * as THREE from 'three';
import { PersonRig, DeskActor, solveStill, solveChange, walkPlan, solveWalk, drawPose, livelyPose, seedOf } from './room-people-motion.mjs?v=polish-20261111d';

// How far in front of a desk's anchor the person's pelvis is (mm), for a keyboard on the pull-out tray, and how far
// behind the keyboard's centre it is wherever the keyboard really sits (tray or desktop).
const REACH = { sit: 945, wheel: 935, stand: 890 };
const BEHIND_KEYS = { sit: 470, wheel: 460, stand: 415 };
const HEIGHT_FIT = 1.4;                       // inches either side of the height a desk pose was built for
const LIVELY = 4;                             // Studio: how many people besides the desk user breathe and shift (the nearest to the camera)
const HEIGHT_SOLID = .45;                     // within this the person is fully there; beyond it they fade out to HEIGHT_FIT
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
// Clothes per room, so the same person does not wear the same outfit in every room of the film.
const LOOK = {
    gymMaya: { top: '#2d7d8a', bottom: '#1f2228', shoes: '#ececec' }, gymNoah: { top: '#c44a32', bottom: '#25272d', shoes: '#f0f0f0' },
    homeParty: { top: '#7b2f3d', bottom: '#2a2730' }, sofia: { top: '#c26a3e', bottom: '#2c303b' }, linNight: { top: '#4a4f5c', bottom: '#2b2b2e' },
    hale: { top: '#33465e', bottom: '#2d3036' }, ava: { top: '#2f5f8f', bottom: '#d8d2c4' }, kaiLab: { top: '#3a3d44', bottom: '#5b6470' },
    homeNight: { top: '#5d6b7a', bottom: '#2a2c33' }, benStudio: { top: '#7a5a3a', bottom: '#2b2d33' }, benSchool: { top: '#3d5a4a', bottom: '#30323a' }, graceSchool: { top: '#6a4d7d', bottom: '#2c2a33' }, graceShop: { top: '#3f6a6a', bottom: '#33302c' },
    omarStudio: { top: '#8a3f3a', bottom: '#2a2c31' }, omarSchool: { top: '#2f4d7a', bottom: '#2c2f36' }, omarShop: { top: '#4a5a3a', bottom: '#2b2b2b' },
    teacherK: { top: '#3f7a6b', bottom: '#2c2f38' }, teacherE: { top: '#8a5a3a', bottom: '#2a2d35' },
    guestA: { top: '#e2c26a', bottom: '#2f3440' }, guestB: { top: '#3f6b4f', bottom: '#d9d3c7' }, guestC: { top: '#8a4a7a', bottom: '#22252b' },
    guestD: { top: '#d76f4a', bottom: '#3a3f4a' }, guestE: { top: '#efe9df', bottom: '#4b3a33' }
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
            : ring(L.id === 'house' ? [450, 1150] : [L.width * .14, L.back + L.depth * .62], L.id === 'house' ? 600 : 540, [['people-maya-stand-talk', { colors: LOOK.homeParty }], ['people-noah-stand-drink', { colors: LOOK.guestE }], ['people-zoe-stand-drink', { colors: LOOK.guestB }]], PARTY, 200)
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
            : ring([L.width * .12, L.back + L.depth * .58], 420, ['people-sam-stand-drink', ['people-noah-stand-drink', { colors: LOOK.guestA }]], PARTY, 60)
    ],
    // Andre's music studio: standing warm-up in the morning, seated mixing after lunch, a vocalist reading lyrics at the
    // mic in the evening, headphones on for the late mix, a small live set at the party (Andre at the mic, guests).
    music: [
        { id: 'people-andre-stand-type', desk: 'stand', modes: ['morning', 'afternoon', 'evening', 'night'] },   // he stands when the desk goes up, at any hour
        { id: 'people-andre-sit-type', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] }, { id: 'people-andre-sit-type-30', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-andre-sit-mix', desk: 'sit', modes: ['night'] }, { id: 'people-andre-sit-mix-30', desk: 'sit', modes: ['night'] },
        { id: 'people-mia-stand-phone', by: 'music-vocal-mic', reach: 420, modes: ['evening'], colors: { top: '#6b4a7a', bottom: '#22242a' } },
        { id: 'people-andre-stand-talk', by: 'music-vocal-mic', reach: -330, turn: 360, modes: ['party'] },
        { id: 'people-lin-sit-chat', on: 'music-piano-bench', seat: 470, turn: 180, modes: ['party'], colors: LOOK.guestB },
        L => L.id === 'house' ? [spot('people-zoe-stand-drink', 330, 2300, [1025, 1486], { ...PARTY, colors: LOOK.guestD }), spot('people-eli-stand-drink', 1450, 2250, [1025, 1486], PARTY)]
            : ring([L.width * .1, L.back + L.depth * .72], 480, [['people-zoe-stand-drink', { colors: LOOK.guestD }], 'people-eli-stand-drink'], PARTY, 120)
    ],
    // Two artists share the studio: Sofia at the desk by day, Lin at the easel in the morning and at golden hour, Lin
    // alone reviewing at the desk at night; the open studio has visitors looking at the work.
    creative: [
        // the film's painter (as its chapters know her); in the Studio she stands a little nearer the easel, clear of the worktable
        { id: 'people-lin-stand-paint', by: 'artist-easel', reach: 640, modes: [] },
        { key: 'lin-at-easel', id: 'people-lin-stand-paint', by: 'artist-easel', reach: 500, modes: ['morning', 'evening'] },
        { id: 'people-maya-stand-type', desk: 'stand', modes: [] }, { id: 'people-maya-sit-type', desk: 'sit', modes: [] },
        { id: 'people-grace-sit-read', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 380, modes: [] },   // the sofa faces the open front: feet would leave the room
        // the evening's 30 degree drawing tilt brings the top through a standing typist: Lin paints alone until the desk
        // user can follow the tilt
        ...crewOf('sofia', ['morning', 'afternoon'], { colors: LOOK.sofia }),
        ...crewOf('lin', ['night'], { colors: LOOK.linNight }),
        L => L.id === 'premium' ? [spot('people-lin-stand-talk', -950, 1600, [-300, 1700], PARTY), spot('people-ben-stand-drink', -300, 1250, [-950, 1600], { ...PARTY, colors: LOOK.benStudio }),
            spot('people-ava-stand-drink', -550, 2250, [-950, 1600], { ...PARTY, colors: LOOK.guestB }), spot('people-omar-wheel-watch', 1950, 2550, [2600, 2550], { ...PARTY, colors: LOOK.omarStudio }),
            spot('people-sofia-stand-drink', 1450, 1250, [1950, 2550], { ...PARTY, colors: LOOK.sofia })]
            : ring([-L.width * .08, L.back + L.depth * .55], 480, ['people-lin-stand-talk', 'people-ben-stand-drink', ['people-ava-stand-drink', { colors: LOOK.guestD }]], PARTY, 30)
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
            return [{ id: circuit[0][0], by: 'training-zone', reach: 0, turn: 180, ...PARTY, ...circuit[0][1] }, { id: circuit[1][0], by: 'training-zone', reach: 800, turn: 180, ...PARTY, ...circuit[1][1] }, { id: circuit[2][0], by: 'training-zone', reach: -700, turn: 90, ...PARTY, ...circuit[2][1] }]; }
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
        { key: 'jo-night-bench', id: 'people-jo-stand-work', at: [560, -790], turn: 180, modes: ['night'] },
        L => { const [x, z] = L.desk || [0, 0]; return [
            spot('people-leo-carry-box', x + 1700, z + 1000, [x + 1700, z - 1500], { modes: ['afternoon'] }),
            spot('people-jo-stand-talk', x + 650, z + 750, [x + 300, z + 1900], PARTY),
            spot('people-noah-stand-mug', x - 200, z + 1750, [x + 650, z + 750], { ...PARTY, colors: LOOK.guestB }),
            spot('people-grace-cane-stand', x + 650, z + 1950, [x + 650, z + 750], { ...PARTY, colors: LOOK.graceShop }),
            spot('people-omar-wheel-watch', x + 1450, z + 1450, [x + 650, z + 750], { ...PARTY, colors: LOOK.omarShop })]; }
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
        spot('people-mia-stand-drink', 500, -1650, [0, -2600], { layout: 'house', modes: ['party'], colors: LOOK.guestC })
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
        { id: 'people-noah-sit-laptop', on: ['ergoflex-designer-chair', 0], seat: 450, modes: ['party'] },
        { id: 'people-sofia-sit-laptop', on: ['ergoflex-designer-chair', 3], seat: 450, modes: ['morning', 'party'] },
        { id: 'people-zoe-walk', layout: 'house', at: [1900, 4300], turn: -90, modes: ['morning'] },
        // The reel showcase: people standing in the open floor, turned to the screen on the back wall.
        L => L.id === 'house' ? [spot('people-omar-wheel-watch', -1300, 350, [0, -4225], PARTY), { id: 'people-mia-stand-drink', beside: [1050, 450], ...PARTY, colors: LOOK.guestB },   // by the featured bay, a drink in her hand
            
            spot('people-leo-stand-drink', 650, 450, [0, -4225], PARTY), spot('people-eli-stand-drink', 1600, 800, [0, -4225], { ...PARTY, colors: LOOK.guestD }),
            spot('people-ben-stand-drink', -2300, 900, [0, -4225], PARTY)] : []
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
                spot('people-ravi-kid-sit-floor', px + 480, pz + 120, [px - 150, pz], { modes: ['party'] })];
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
                spot('people-ines-kid-sit-floor', px + 600, pz + 150, [px, pz + 80], { modes: ['party'] })];
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
        { id: 'people-grace-sit-floor', around: ['circle-rug', 170, 520], modes: ['party'], colors: { top: '#7d5a6b' } }, { id: 'people-tess-kid-read-floor', around: ['circle-rug', 250, 380], modes: ['party'] }
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
        { id: 'people-jun-kid-stand', around: ['meeting-carpet', 75, 650], modes: ['party'] }, { id: 'people-theo-kid-stand', around: ['meeting-carpet', 285, 650], modes: ['party'] }, { id: 'people-lila-kid-stand-wait', around: ['meeting-carpet', 330, 800], modes: ['party'] }
    ],
    library: [
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
        spot('people-ava-stand-drink', -2550, 1950, [-1087, 1500], { layout: 'humboldt', modes: ['party'] })
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
// bench-height desk (35 to 36 in) and stands at 43.5 in, a wheelchair user has poses for 28 in and 31 in. Poses built for one special desk (low standing) have none.
export function deskFamily(id) {
    const m = /^people-([a-z]+)-(.+)$/.exec(id || ''); if (!m) return [];
    const [, who, posture] = m, as = (p, desk) => ['people-' + who + '-' + p, desk]; let list = [];
    if (/^wheel-/.test(posture)) { const base = posture.replace(/-(28|31)$/, ''); list = [as(base, 'wheel'), as(base + '-28', 'wheel'), as(base + '-31', 'wheel')]; }
    // (the standing counterpart of the seated posture first, so what is in the hand stays there: sit-coffee stands as stand-coffee)
    else if (/^sit-/.test(posture)) { const base = posture.replace(/-30$/, ''); list = [as(base, 'sit'), as(base + '-30', 'sit'), as('stand-low', 'stand'), as(base.replace(/^sit-/, 'stand-'), 'stand'), as('stand-type', 'stand')]; }
    else if (posture === 'stand-type' || posture === 'stand-low') list = [as('sit-type', 'sit'), as('sit-type-30', 'sit'), as('stand-low', 'stand'), as('stand-type', 'stand')];
    return list.filter(([other]) => other !== id);
}

const down = new THREE.Vector3(0, -1, 0), poseTurn = new THREE.Quaternion();
const frontOf = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

export class RoomPeople {
    constructor(room, library) {
        this.room = room; this.library = library; this.enabled = false; this.built = null; this.people = []; this.hidden = new Map(); this.filter = null;
        this.actors = []; this.clock = null; this.lifeClock = 0; this.eye = null; this.rigsOf = new Map(); this.pickedAt = -Infinity; this.picked = []; this.pairs = []; this.lastMode = undefined; this.generation = 0; this.keysHome = null;
        this.dirty = false;       // dirty: someone moved since the Studio last looked (their shadow has to follow)
        this.ray = new THREE.Raycaster();
    }
    specs() { return [...castFor(this.room.id, this.room.roomLayout || null), ...(this.filter?.cast || []).map(spec => ({ ...spec, extra: true }))]; }
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
        const specs = this.withFamilies(this.specs());
        const load = async id => { try { return await this.library.instance(id); } catch (error) { console.warn('[people] ' + id + ' did not load:', error?.message || error); return null; } };
        const loaded = await Promise.all(specs.map(async spec => ({ spec, object: await load(spec.id), chair: spec.desk === 'sit' && !ownSeat(spec) ? await load(TASK_CHAIR) : null })));
        const posed = [];
        // (a cast that was replaced while its models loaded is dropped: its people would stay in the room for good)
        if (token !== room.token || root !== room.root || cast !== this.generation) return;
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
        await Promise.all(posed.map(object => this.rig(object)));
        if (cast === this.generation) await this.cast(token, root);
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
        object.userData.personMissing = false; object.userData.personAnchor = anchor; object.userData.personAnchorAt = anchor && this.anchorKey(anchor);
        const turn = THREE.MathUtils.degToRad(spec.turn || 0);
        if (spec.on || spec.near) {
            const centre = this.centreOf(anchor); let yaw = this.yawOf(anchor) + turn;
            if (spec.face) yaw = Math.atan2(spec.face[0] - centre.x, spec.face[1] - centre.z);
            const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            object.position.copy(centre).addScaledVector(side, spec.along || 0).addScaledVector(frontOf(yaw), spec.depth ?? 60); object.position.y = 0; object.rotation.y = yaw;
        } else if (spec.around) {
            // round a rug, a mat or a table: at that angle (degrees, 0 = the room's front side of it) and distance (mm) from its middle, facing it
            const centre = this.centreOf(anchor), a = THREE.MathUtils.degToRad(spec.around[1] || 0), r = spec.around[2] ?? 600;
            object.position.set(centre.x + Math.sin(a) * r, 0, centre.z + Math.cos(a) * r); object.rotation.y = a + Math.PI + turn;
        } else if (spec.by) {
            const yaw = this.yawOf(anchor); object.position.copy(this.room.root.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()))).addScaledVector(frontOf(yaw), spec.reach ?? 600); object.position.y = 0;
            object.rotation.y = yaw + Math.PI + turn - Math.PI * (spec.turn ? 1 : 0);
        } else { object.position.set(spec.at[0], spec.y || 0, spec.at[1]); object.rotation.y = turn; }
        if (spec.seat && anchor) object.position.y = this.seatLift(object, spec, anchor);
    }
    // The way a piece of furniture faces in the room (its own turn and that of any group it sits in), and a key that
    // changes when the room moves, turns or swaps it (a daypart that turns the armchair): the person settles again.
    yawOf(object) {
        const root = this.room.root; root.updateWorldMatrix(true, false); object.updateWorldMatrix(true, false);
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(object.getWorldQuaternion(new THREE.Quaternion())));
        return Math.atan2(f.x, f.z);
    }
    anchorKey(object) { const p = this.room.root.worldToLocal(object.getWorldPosition(new THREE.Vector3())); return `${Math.round(p.x)},${Math.round(p.z)},${this.yawOf(object).toFixed(3)},${!!object.parent}`; }
    resettle(mode) {
        const again = mode !== this.settledMode; this.settledMode = mode;
        for (const object of this.people) {
            const spec = object.userData.person; if (spec.desk || spec.station || spec.beside || !(spec.on || spec.by || spec.near || spec.around) || this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id]) continue;
            const anchor = object.userData.personAnchor;
            if (again || !anchor || this.anchorKey(anchor) !== object.userData.personAnchorAt) this.settle(object, spec);
        }
    }
    // How far the person moves up or down so the pose's seat height meets the real seat under the pelvis.
    seatLift(object, spec, anchor) {
        const root = this.room.root; root.updateWorldMatrix(true, true);
        this.ray.set(root.localToWorld(new THREE.Vector3(object.position.x, 1500, object.position.z)), down.clone().transformDirection(root.matrixWorld));
        const hit = this.ray.intersectObject(anchor, true).map(h => root.worldToLocal(h.point.clone()).y).find(y => y > 250 && y < 700);
        return hit === undefined ? 0 : THREE.MathUtils.clamp(hit - spec.seat, -40, 70);
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
        if (mode !== this.modeNow) { this.modeNow = mode; if (this.placed) for (const actor of this.actors) this.recast(actor); }   // another hour: the person at the desk is recast from that hour's models
        if (!this.placed) {
            this.placed = true;
            for (const object of this.people) {
                // an extra person takes the placement the filter has for it now (it may have been moved since it was built)
                const now = object.userData.person.extra && (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(object.userData.person));
                if (now) {
                    const spec = object.userData.person = { ...this.asVariant(now, object.userData.person), extra: true }; object.userData.personMissing = false; this.resize(object, spec); this.recolor(object, spec);
                    if (object.userData.personRig) this.pose(object, spec); else if (this.posed(spec)) this.rig(object);
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
        }
        this.resettle(mode);
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
            chosen = pool.filter(o => this.picked.includes(o.userData.person));
        }
        const hold = typeof window !== 'undefined' && !!window.__directorDragging;
        for (const object of pool) {
            const life = object.userData.personLife, on = chosen.includes(object);
            if (life === undefined) { if (on) { object.userData.personLife = null; this.enliven(object).catch(error => console.warn('[people]', error)); } continue; }
            if (!life || !object.userData.personRig || (!on && !life.live)) continue;
            if (object.userData.person.walk && on) { this.walkAlong(object, life, object.userData.person.walk, film ? time : null, hold); continue; }
            // out of the nearest few: back to the posture as built, once
            solveStill(life.rig, life.key, { time: this.lifeClock, seed: life.seed, life: on ? 1 : 0, taps: film || dt < .05 });
            drawPose(life.rig, object.userData.personRig, 0, object.userData.person.pose || null, hold); life.live = on;
        }
    }
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
        for (const pair of pairs) this.readyChange(pair).catch(error => console.warn('[people]', error));
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
        if (!person || !livelyPose(person.pose)) return still(object);
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
        const there = actor.objects.some(o => o.visible);
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
        const feet = this.people.filter(o => { const s = o.userData.person; return o.visible && !s.desk && !s.on && !s.near; }).map(o => o.position);
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
                seat = { source, copy, mode: this.modeNow, y: source.position.y }; seats.set(key, seat);
            }
            live.add(key);
            if (seat.copy.parent !== person.parent) person.parent.add(seat.copy);
            // the room's own chair is out while its copy is under the child, however far the room has pushed it back
            if (!this.hidden.has(seat.source)) { this.hidden.set(seat.source, seat.source.visible); seat.source.visible = false; }
            seat.copy.visible = true; seat.copy.position.set(person.position.x, seat.y, person.position.z); seat.copy.rotation.set(0, person.rotation.y + Math.PI, 0);   // (a room seat faces -z, the desk side; the child faces +z)
        }
        for (const [key, seat] of seats) if (!live.has(key)) seat.copy.visible = false;
    }
    returnSeats() { for (const seat of (this.kidSeats || new Map()).values()) seat.copy.visible = false; }
    dispose() {
        this.restoreChairs();
        for (const seat of (this.kidSeats || new Map()).values()) seat.copy.removeFromParent(); this.kidSeats?.clear();
        for (const object of this.people) { object.userData.personChair?.removeFromParent(); object.removeFromParent(); for (const m of object.userData.personMaterials || []) m.dispose(); object.traverse(o => o.skeleton?.dispose?.()); }
        this.people = []; this.built = null; this.actors = []; this.pairs = []; this.generation++;
    }
}
