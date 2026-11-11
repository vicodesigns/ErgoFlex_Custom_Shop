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
//   { id, station: '<id>', desk: ... }                at one of the room's other ErgoFlex desks (layout.stations)
//   { id, beside: [dx, dz] }                          near the featured desk (its own frame), facing it
//   { id, on: '<prop id>' | ['<prop id>', n] }        seated on that piece of furniture, facing the way it faces
//                                                     (`turn` degrees to correct a model; `along` / `depth` mm to slide)
//   { id, near: [x, z], face: [x, z] }                seated on the chair nearest that spot, facing a point (a table)
//   { id, by: '<prop id>', reach }                    standing in front of that furniture, facing it
//   { id, at: [x, z], turn, y }                       at a spot (y mm lifts a seated pose onto a seat that is not a prop)
//   scale: n                                          a factor on the model's size (any placement; 1 = as built)
//   colors: { top, bottom, shoes, hair: '#rrggbb' }   recolours those parts of the model (the fabric's shading is kept)
//   pose: { '<bone>': [x, y, z, w] }                  fine tuning: turns that bone of the model's skeleton from the pose it
//                                                     was built in (a quaternion in the bone's own frame; the Director's
//                                                     pose mode writes these). Only such a person is drawn skinned.
//   seat: mm                                          the seat height the pose was built for; the person is raised or
//                                                     lowered (a little) onto the real seat
//   layout: '<layout id>'                             only in that room layout;  modes: [...] only in those dayparts
//   key: '<name>'                                     a name for this placement when one model is used twice
// Not scene assets: the Studio's Rearrange mode and saved room edits leave them
// alone. The film casts each chapter through a filter (setFilter): who is in, who is moved, extra people of its
// own, and the seconds of the chapter each one is there for.
import * as THREE from 'three';

// How far in front of a desk's anchor the person's pelvis is (mm), for a keyboard on the pull-out tray, and how far
// behind the keyboard's centre it is wherever the keyboard really sits (tray or desktop).
const REACH = { sit: 945, wheel: 935, stand: 890 };
const BEHIND_KEYS = { sit: 470, wheel: 460, stand: 415 };
const HEIGHT_FIT = 1.4;                       // inches either side of the height a desk pose was built for
const HEIGHT_SOLID = .45;                     // within this the person is fully there; beyond it they fade out to HEIGHT_FIT
const TASK_CHAIR = 'steelcase-leap-v2';       // seat 435 mm: what the seated desk poses were built on
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
    guestA: { top: '#e2c26a', bottom: '#2f3440' }, guestB: { top: '#3f6b4f', bottom: '#d9d3c7' }, guestC: { top: '#8a4a7a', bottom: '#22252b' },
    guestD: { top: '#d76f4a', bottom: '#3a3f4a' }, guestE: { top: '#efe9df', bottom: '#4b3a33' }
};

export const ROOM_PEOPLE = {
    // Maya's home office: 07:50 standing with the first coffee, seated focus at 14:35, tea and planning at 18:40 with
    // Grace reading in the armchair, alone at the desk at 23:20, friends with drinks at 21:15 (desk left alone).
    home: [
        { id: 'people-maya-stand-coffee', desk: 'stand', modes: ['morning'] },
        { id: 'people-maya-sit-coffee', desk: 'sit', modes: ['evening'] }, { id: 'people-maya-sit-coffee-30', desk: 'sit', modes: ['evening'] },
        { id: 'people-maya-sit-type', desk: 'sit', modes: DAY }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: DAY }, { id: 'people-maya-stand-type', desk: 'stand', modes: DAY },
        { id: 'people-grace-sit-read', on: 'armchair-poppi', seat: 420, modes: ['evening'] },
        { id: 'people-grace-sit-chat', on: 'armchair-poppi', seat: 420, modes: ['party'], colors: { top: '#2f4f6f' } },
        L => L.id === 'apartment' ? ring([-620, 1250], 420, [['people-maya-stand-talk', { colors: LOOK.homeParty }], ['people-noah-stand-drink', { colors: LOOK.guestE }]], PARTY, 300)
            : ring(L.id === 'house' ? [780, 1150] : [L.width * .14, L.back + L.depth * .62], 540, [['people-maya-stand-talk', { colors: LOOK.homeParty }], ['people-noah-stand-drink', { colors: LOOK.guestE }], ['people-zoe-stand-drink', { colors: LOOK.guestB }]], PARTY, 200)
    ],
    // Sam's gaming room: coffee and a fresh setup in the morning, practice alone after lunch, co-op on the sofa with
    // Kai in the evening, headphones on at night, game night with friends (Kai and Sofia on the sofa, two standing).
    gaming: [
        { id: 'people-sam-stand-coffee', desk: 'stand', modes: ['morning'] },
        { id: 'people-sam-sit-game', desk: 'sit', modes: ['morning', 'afternoon', 'night'] }, { id: 'people-sam-sit-game-30', desk: 'sit', modes: ['morning', 'afternoon', 'night'] },
        { id: 'people-sam-stand-type', desk: 'stand', modes: ['morning', 'afternoon', 'night'] },
        { id: 'people-kai-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: -330, depth: -150, modes: ['morning', 'evening', 'party'] },
        { id: 'people-sam-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 330, depth: -150, modes: ['evening'] },
        { id: 'people-sofia-sit-chat', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 330, depth: -150, modes: ['party'], colors: LOOK.guestC },
        L => L.id === 'house' ? [spot('people-sam-stand-drink', 350, 620, [1100, 950], PARTY), spot('people-noah-stand-drink', 1100, 950, [350, 620], { ...PARTY, colors: LOOK.guestA })]
            : ring([L.width * .12, L.back + L.depth * .58], 420, ['people-sam-stand-drink', ['people-noah-stand-drink', { colors: LOOK.guestA }]], PARTY, 60)
    ],
    // Andre's music studio: standing warm-up in the morning, seated mixing after lunch, a vocalist reading lyrics at the
    // mic in the evening, headphones on for the late mix, a small live set at the party (Andre at the mic, guests).
    music: [
        { id: 'people-andre-stand-type', desk: 'stand', modes: ['morning'] },
        { id: 'people-andre-sit-type', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] }, { id: 'people-andre-sit-type-30', desk: 'sit', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-andre-sit-mix', desk: 'sit', modes: ['night'] }, { id: 'people-andre-sit-mix-30', desk: 'sit', modes: ['night'] },
        { id: 'people-mia-stand-phone', by: 'music-vocal-mic', reach: 420, modes: ['evening'], colors: { top: '#6b4a7a', bottom: '#22242a' } },
        { id: 'people-andre-stand-talk', by: 'music-vocal-mic', reach: -330, turn: 360, modes: ['party'] },
        { id: 'people-lin-sit-chat', on: 'music-piano-bench', seat: 470, turn: 180, modes: ['party'], colors: LOOK.guestB },
        L => L.id === 'house' ? [spot('people-zoe-stand-drink', 330, 2300, [1025, 1486], { ...PARTY, colors: LOOK.guestD }), spot('people-eli-stand-drink', 1600, 2380, [1025, 1486], PARTY)]
            : ring([L.width * .1, L.back + L.depth * .72], 480, [['people-zoe-stand-drink', { colors: LOOK.guestD }], 'people-eli-stand-drink'], PARTY, 120)
    ],
    // Two artists share the studio: Sofia at the desk by day, Lin at the easel in the morning and at golden hour, Lin
    // alone reviewing at the desk at night; the open studio has visitors looking at the work.
    creative: [
        { id: 'people-lin-stand-paint', by: 'artist-easel', reach: 640, modes: ['morning', 'evening'] },
        { id: 'people-maya-stand-type', desk: 'stand', modes: [] }, { id: 'people-maya-sit-type', desk: 'sit', modes: [] },
        { id: 'people-grace-sit-read', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 380, modes: [] },   // the sofa faces the open front: feet would leave the room
        ...crewOf('sofia', ['morning', 'afternoon', 'evening'], { colors: LOOK.sofia }),
        ...crewOf('lin', ['night'], { colors: LOOK.linNight }),
        L => L.id === 'premium' ? [spot('people-lin-stand-talk', -1150, 1350, [-400, 1500], PARTY), spot('people-ben-stand-drink', -450, 950, [-1150, 1350], PARTY),
            spot('people-ava-stand-drink', -300, 1900, [-1150, 1350], { ...PARTY, colors: LOOK.guestD }), spot('people-omar-wheel-watch', 1950, 2550, [2600, 2550], PARTY),
            spot('people-sofia-stand-drink', 1450, 1250, [1950, 2550], { ...PARTY, colors: LOOK.sofia })]
            : ring([-L.width * .08, L.back + L.depth * .55], 480, ['people-lin-stand-talk', 'people-ben-stand-drink', ['people-ava-stand-drink', { colors: LOOK.guestD }]], PARTY, 30)
    ],
    // Home gym: coached mobility at sunrise (Maya at the standing desk, Priya stretching), Noah logging a strength
    // session after lunch while Priya rests on the mat, recovery stretching and notes in the evening, an empty room at
    // night, and the power circuit with three on the floor.
    gym: [
        { id: 'people-priya-stretch', by: 'training-zone', reach: 0, turn: 180, modes: ['morning', 'party'] },
        { id: 'people-maya-stand-type', desk: 'stand', modes: ['morning', 'evening', 'party'], colors: LOOK.gymMaya },
        { id: 'people-maya-sit-type', desk: 'sit', modes: ['morning', 'evening', 'party'], colors: LOOK.gymMaya }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: ['morning', 'evening', 'party'], colors: LOOK.gymMaya },
        ...crewOf('noah', ['afternoon'], { colors: LOOK.gymNoah }),
        { id: 'people-priya-sit-floor', by: 'training-zone', reach: 300, turn: 180, modes: ['afternoon'] },
        { id: 'people-priya-floor-stretch', by: 'training-zone', reach: 350, turn: 180, modes: ['evening'] },
        { id: 'people-zoe-stretch-open', by: 'training-zone', reach: 800, turn: 180, modes: ['party'], colors: { top: '#e0553f', bottom: '#1f2228' } },
        { id: 'people-kai-floor-stretch', by: 'training-zone', reach: -700, turn: 90, modes: ['party'], colors: { top: '#2f2f35', bottom: '#3c4f6b' } }
    ],
    // Jo's workshop: Jo at the bench and Andre driving the desk from his phone in the morning, Jo at the desk with
    // Leo bringing stock in the afternoon, detail work at the desk in the evening, Jo alone at the bench at night, an
    // open workshop with visitors watching a demonstration.
    workshop: [
        { id: 'people-jo-stand-work', at: [560, -790], turn: 180, modes: ['morning', 'night'] },
        { id: 'people-andre-stand-phone', beside: [1050, 520], modes: ['morning'] },
        ...crewOf('jo', ['afternoon', 'evening']),
        L => { const [x, z] = L.desk || [0, 0]; return [
            spot('people-leo-carry-box', x + 1700, z + 1000, [x + 1700, z - 1500], { modes: ['afternoon'] }),
            spot('people-jo-stand-talk', x + 650, z + 750, [x + 300, z + 1900], PARTY),
            spot('people-noah-stand-mug', x - 200, z + 1750, [x + 650, z + 750], { ...PARTY, colors: LOOK.guestB }),
            spot('people-grace-cane-stand', x + 650, z + 1950, [x + 650, z + 750], PARTY),
            spot('people-omar-wheel-watch', x + 1450, z + 1450, [x + 650, z + 750], PARTY)]; }
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
        // The Oiler showcase: students at their projects, families standing at the demos.
        { id: 'people-ava-stand-type', station: 'project-review', desk: 'stand', modes: ['party'], colors: LOOK.ava },
        { id: 'people-grace-cane-stand', layout: 'house', at: [-1350, 5850], turn: 0, modes: ['party'] },
        { id: 'people-noah-stand-mug', layout: 'house', at: [-600, 5800], turn: -10, modes: ['party'], colors: LOOK.guestE },
        spot('people-omar-wheel-watch', 4000, 2850, [4981, 2850], { layout: 'house', modes: ['party'] }),
        spot('people-lin-stand-drink', 3900, 1950, [4981, 2700], { layout: 'house', modes: ['party'], colors: LOOK.guestA }),
        spot('people-ben-stand-drink', -450, -1600, [0, -2600], { layout: 'house', modes: ['party'] }),
        spot('people-mia-stand-drink', 500, -1650, [0, -2600], { layout: 'house', modes: ['party'], colors: LOOK.guestC })
    ],
    occmedialab: [
        { id: 'people-maya-sit-type', desk: 'sit', modes: [] }, { id: 'people-maya-sit-type-30', desk: 'sit', modes: [] }, { id: 'people-maya-stand-type', desk: 'stand', modes: [] },
        // Pre-production (the film's morning), editing after lunch, sound and colour in the evening, one late editor.
        { id: 'people-andre-sit-type', station: 'sound-mix-02', desk: 'sit', modes: ['morning', 'afternoon'] },
        { id: 'people-andre-sit-mix', station: 'sound-mix-02', desk: 'sit', modes: ['evening'] },
        { id: 'people-lin-sit-type', station: 'digital-art-03', desk: 'sit', modes: ['morning', 'afternoon'] },
        { id: 'people-omar-wheel-type-28', station: 'accessible-edit-04', desk: 'wheel', modes: ['morning', 'afternoon', 'evening'] },
        { id: 'people-kai-sit-type', station: 'film-edit-01', desk: 'sit', modes: ['afternoon', 'night'], colors: LOOK.kaiLab },
        ...crewOf('ava', ['afternoon', 'evening'], { colors: LOOK.ava }),
        { id: 'people-noah-sit-laptop', on: ['ergoflex-designer-chair', 0], seat: 450, modes: ['party'] },
        { id: 'people-sofia-sit-laptop', on: ['ergoflex-designer-chair', 3], seat: 450, modes: ['morning', 'party'] },
        { id: 'people-zoe-walk', layout: 'house', at: [1900, 4300], turn: -90, modes: ['morning'] },
        // The reel showcase: people standing in the open floor, turned to the screen on the back wall.
        L => L.id === 'house' ? [spot('people-omar-wheel-watch', -1300, 350, [0, -4225], PARTY), spot('people-mia-stand-drink', -350, 700, [0, -4225], { ...PARTY, colors: LOOK.guestB }),
            spot('people-leo-stand-drink', 650, 450, [0, -4225], PARTY), spot('people-eli-stand-drink', 1600, 800, [0, -4225], { ...PARTY, colors: LOOK.guestD }),
            spot('people-ben-stand-drink', -2300, 900, [0, -4225], PARTY)] : []
    ],
    library: [
        // The commons: opening with Andre standing at the pilot desk, research together after lunch (Rosa at the desk's
        // low setting), reading at dusk (Omar at the desk at 32 in), one student at a table lamp at closing, and a
        // study night around the long table.
        { id: 'people-rosa-stand-type-low', layout: 'humboldt', desk: 'stand', reach: 830, modes: ['afternoon', 'party'] },
        { id: 'people-rosa-stand-type-30', layout: 'humboldt', desk: 'stand', reach: 830, modes: ['afternoon', 'party'] },
        { id: 'people-andre-stand-type', layout: 'humboldt', desk: 'stand', modes: ['morning'], colors: { top: '#3b4c66', bottom: '#2a2b2f' } },
        { id: 'people-omar-wheel-type', layout: 'humboldt', desk: 'wheel', modes: ['evening'] },
        { id: 'people-lin-sit-phone', layout: 'humboldt', on: 'electric-wheelchair', seat: 420, modes: ['morning', 'afternoon', 'party'] },
        { id: 'people-leo-sit-write', layout: 'humboldt', near: [-800, -5970], face: [-800, -5200], seat: 450, modes: ['morning', 'afternoon', 'night'] },
        { id: 'people-zoe-sit-laptop', layout: 'humboldt', near: [-814, -4428], face: [-814, -5200], seat: 450, modes: ['morning', 'afternoon'] },
        { id: 'people-eli-sit-listen', layout: 'humboldt', near: [550, 2945], face: [550, 3700], seat: 450, modes: ['morning', 'afternoon'] },
        { id: 'people-zoe-walk', layout: 'humboldt', at: [2500, 1500], turn: 90, modes: [] },   // Zoe also sits with her laptop: one Zoe per frame
        { id: 'people-ben-white-cane', layout: 'humboldt', at: [-2800, 2600], turn: 180, modes: ['morning', 'afternoon'] },
        { id: 'people-grace-cane-stand', layout: 'humboldt', at: [3600, 5500], turn: 200, modes: ['morning', 'evening'] },
        spot('people-noah-carry-box', 2600, 600, [2600, -1500], { layout: 'humboldt', modes: ['afternoon'] }),
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
const crew = who => DESK_CREW[who].map(id => ({ id, desk: /stand/.test(id) ? 'stand' : 'sit' }));
const DEFAULT_CREW = {
    office: 'andre', coworking: 'lin', bedroom: 'mia', lounge: 'noah', kitchen: 'maya', study: 'noah', gallery: 'lin', library: 'mia', scifi: 'andre',
    middleschool: 'mia', college: 'noah', university: 'lin', hospital: 'lin', laboratory: 'andre', mobileit: 'noah', government: 'andre', police: 'maya', security: 'andre'
};
// A room's placements for one layout (an object with id, width, depth, back, desk; or just the layout id).
export const castEntries = (id, layout) => {
    const L = typeof layout === 'object' && layout ? layout : { id: layout, width: 4000, depth: 5000, back: -1500, desk: [0, 0] };
    return (ROOM_PEOPLE[id] || []).flatMap(s => typeof s === 'function' ? [].concat(s(L) || []) : [s]).filter(s => !s.layout || s.layout === L.id);
};
const castFor = (id, layout) => { const own = castEntries(id, layout); return own.length ? own : DEFAULT_CREW[id] ? crew(DEFAULT_CREW[id]) : []; };

const down = new THREE.Vector3(0, -1, 0), poseTurn = new THREE.Quaternion();
const frontOf = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

export class RoomPeople {
    constructor(room, library) {
        this.room = room; this.library = library; this.enabled = false; this.built = null; this.people = []; this.hidden = new Map(); this.filter = null;
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
        const cast = JSON.stringify((filter?.cast || []).map(c => [c.key || c.id, c.id, c.desk || '', c.station || ''])) + JSON.stringify(Object.keys(filter?.when || {}));
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
    current(object) { const spec = object.userData.person; return spec.extra ? (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(spec)) || null : null; }
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
    byKey(key) { const all = this.people.filter(o => this.keyOf(o.userData.person) === key); return all.find(o => this.allowed(o.userData.person)) || all[0] || null; }
    // Who is in the room now (for the Director's People tab), room millimetres and degrees.
    list() {
        return this.people.map(o => { const s = o.userData.person; return { key: this.keyOf(s), id: s.id, extra: !!s.extra, desk: s.desk || null, station: s.station || null,
            at: [Math.round(o.position.x), Math.round(o.position.z)], y: Math.round(o.position.y), turn: Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10, scale: s.scale || 1,
            allowed: this.allowed(s), missing: !!o.userData.personMissing, visible: o.visible, amount: o.userData.personAmount ?? 1, rigged: !!o.userData.personRig }; });
    }
    // The cast as plain placements a film can keep: desk and station people as they are (they follow their desk),
    // everyone else at the spot and facing they have settled into (`on`, `by`, `near` resolved).
    resolved() {
        return this.people.filter(o => this.allowed(o.userData.person) && !o.userData.personMissing).map(o => {
            const s = o.userData.person, out = { key: this.keyOf(s), id: s.id };
            if (s.desk) { out.desk = s.desk; if (s.station) out.station = s.station; if (s.reach !== undefined) out.reach = s.reach; }
            else if (s.beside && !s.at) out.beside = s.beside;
            else { out.at = [Math.round(o.position.x), Math.round(o.position.z)]; out.turn = Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10; if (Math.abs(o.position.y) > .5) out.y = Math.round(o.position.y); }
            if (s.scale && s.scale !== 1) out.scale = s.scale;
            if (s.colors) out.colors = { ...s.colors };
            if (s.pose) out.pose = structuredClone(s.pose);
            return out;
        });
    }
    keyOf(spec) { return spec.key || spec.id; }
    // A film chapter that names someone in `only` shows them whatever the daypart casts (`modes` is the Studio's script).
    named(spec) { const only = this.filter?.only; return !!only && (only.includes(this.keyOf(spec)) || only.includes(spec.id)); }
    allowed(spec) { const f = this.filter, k = this.keyOf(spec), has = list => list.includes(k) || list.includes(spec.id); return !f || spec.extra || ((!f.only || has(f.only)) && !has(f.except || [])); }
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
        if (!this.enabled) { for (const object of this.people) this.show(object, false); this.restoreChairs(); }
        else this.update(this.room.peopleState?.());
    }
    async build() {
        const room = this.room, token = room.token, root = room.root, specs = this.specs();
        await room.ready; await this.library.loadIndex();
        const load = async id => { try { return await this.library.instance(id); } catch (error) { console.warn('[people] ' + id + ' did not load:', error?.message || error); return null; } };
        const loaded = await Promise.all(specs.map(async spec => ({ spec, object: await load(spec.id), chair: spec.desk === 'sit' ? await load(TASK_CHAIR) : null })));
        const posed = [];
        if (token !== room.token || root !== room.root) return;
        for (const { spec, object, chair } of loaded) {
            if (!object) continue;
            object.name = 'Person:' + spec.id; object.userData.person = spec; object.userData.personFit = this.library.entry(spec.id)?.person?.deskHeight ?? null; object.visible = false;
            if (chair) { chair.name = 'Person chair:' + spec.id; chair.visible = false; root.add(chair); object.userData.personChair = chair; }
            if ((spec.desk && !spec.station) || this.filter?.when?.[this.keyOf(spec)]) this.ownMaterials(object);
            root.add(object); this.people.push(object); this.resize(object, spec); this.recolor(object, spec);
            if (this.posed(spec)) posed.push(object);
            if (spec.station) this.atStation(object, spec);
            else if (!spec.desk && !spec.beside) this.settle(object, spec);
        }
        await Promise.all(posed.map(object => this.rig(object)));
    }
    // The featured desk's people fade with the desk height, so they need materials of their own (textures stay shared).
    ownMaterials(object) {
        const copies = new Map(); object.userData.personMaterials = [];
        object.traverse(o => { if (!o.isMesh) return; o.material = [].concat(o.material).map(m => { if (!copies.has(m)) { const c = m.clone(); c.userData.sharedTextures = true; c.userData.solid = { transparent: m.transparent, opacity: m.opacity }; copies.set(m, c); object.userData.personMaterials.push(c); } return copies.get(m); })[0]; });
    }
    fade(object, amount) {
        if (object.userData.personFade === amount) return; object.userData.personFade = amount;
        for (const m of object.userData.personMaterials || []) { const solid = amount >= 1; m.transparent = solid ? m.userData.solid.transparent : true; m.opacity = m.userData.solid.opacity * amount; m.needsUpdate = true; }
        const chair = object.userData.personChair; if (chair) chair.visible = object.visible && amount > .5;
        object.traverse(o => { if (o.isMesh) o.castShadow = amount > .5; });
    }
    props(id) { return this.room.assets().filter(o => o.userData.propId === id || o.userData.decorUpgrade === id); }
    centreOf(object) { return this.room.root.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())); }
    // At one of the room's other desks: fixed, if that desk's height suits the model.
    atStation(object, spec) {
        const station = this.room.roomLayout?.stations?.find(s => s.id === spec.station), fit = object.userData.personFit;
        if (!station || (fit !== null && Math.abs((station.height ?? 28) - fit) > HEIGHT_FIT)) { object.userData.personMissing = true; return; }
        const yaw = THREE.MathUtils.degToRad(station.turn || 0);
        object.position.set(station.at[0], 0, station.at[1]).addScaledVector(frontOf(yaw), spec.reach ?? REACH[spec.desk]); object.rotation.y = yaw + Math.PI;
    }
    // A fixed placement: on a seat, by a piece of furniture, or at a spot.
    settle(object, spec) {
        let anchor = null;
        if (spec.on || spec.by) { const [id, n] = [].concat(spec.on || spec.by); anchor = this.props(id)[n || 0] || null; }
        else if (spec.near) {
            const spot = new THREE.Vector3(spec.near[0], 0, spec.near[1]);
            anchor = this.room.assets().filter(o => CHAIRS.test((o.userData.propId || '') + ' ' + (o.userData.decorUpgrade || ''))).map(o => ({ o, d: this.centreOf(o).setY(0).distanceTo(spot) })).filter(c => c.d < 450).sort((a, b) => a.d - b.d)[0]?.o || null;
        }
        if ((spec.on || spec.by || spec.near) && !anchor) { object.userData.personMissing = true; return; }
        object.userData.personMissing = false; object.userData.personAnchor = anchor; object.userData.personAnchorAt = anchor && this.anchorKey(anchor);
        const turn = THREE.MathUtils.degToRad(spec.turn || 0);
        if (spec.on || spec.near) {
            const centre = this.centreOf(anchor); let yaw = this.yawOf(anchor) + turn;
            if (spec.face) yaw = Math.atan2(spec.face[0] - centre.x, spec.face[1] - centre.z);
            const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            object.position.copy(centre).addScaledVector(side, spec.along || 0).addScaledVector(frontOf(yaw), spec.depth ?? 60); object.position.y = 0; object.rotation.y = yaw;
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
            const spec = object.userData.person; if (spec.desk || spec.station || spec.beside || !(spec.on || spec.by || spec.near) || this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id]) continue;
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
        if (chair) { chair.visible = on; if (on) { chair.position.set(object.position.x, 0, object.position.z); chair.rotation.y = object.rotation.y; } }
    }
    // filter.chair: one task chair that stays. It is under the seated desk user while they are there (`seated` 0..1)
    // and slides back from the desk when they are not.
    stayChair(state, seated, yaw) {
        const park = this.filter?.chair, chairs = this.people.filter(o => o.userData.personChair && o.userData.person.desk === 'sit' && !o.userData.person.station && this.allowed(o.userData.person));
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
        const height = state?.height ?? 28, pose = state?.pose, mode = state?.mode, time = state?.time ?? null; let working = false, seated = 0;
        if (!this.placed) {
            this.placed = true;
            for (const object of this.people) {
                // an extra person takes the placement the filter has for it now (it may have been moved since it was built)
                const now = object.userData.person.extra && (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(object.userData.person));
                if (now) {
                    const spec = object.userData.person = { ...now, extra: true }; object.userData.personMissing = false; this.resize(object, spec); this.recolor(object, spec);
                    if (object.userData.personRig) this.pose(object, spec); else if (this.posed(spec)) this.rig(object);
                    if (spec.station) this.atStation(object, spec); else if (!spec.desk && !spec.beside) this.settle(object, spec);
                }
                const spot = this.filter?.place?.[this.keyOf(object.userData.person)] || this.filter?.place?.[object.userData.person.id]; if (!spot) continue;
                object.position.set(spot.at[0], spot.y ?? 0, spot.at[1]); object.rotation.y = THREE.MathUtils.degToRad(spot.turn || 0); object.userData.personMissing = false;
                if (Number.isFinite(spot.scale)) this.resize(object, { scale: spot.scale });
            }
        }
        this.resettle(mode);
        for (const object of this.people) {
            const spec = object.userData.person, fit = object.userData.personFit;
            const there = this.present(spec, time);
            let on = !object.userData.personMissing && this.allowed(spec) && there > 0 && (!spec.modes || spec.modes.includes(mode) || this.named(spec));
            object.userData.personAmount = there;
            if (spec.desk && !spec.station) {
                const off = fit === null ? 0 : Math.abs(height - fit);
                on = on && !!pose && !working && off <= HEIGHT_FIT;
                if (on) {
                    object.userData.personAmount = there * (1 - THREE.MathUtils.smoothstep(off, HEIGHT_SOLID, HEIGHT_FIT));
                    const yaw = pose.yaw || 0, front = frontOf(yaw), keys = state.keyboard, short = (spec.reach ?? REACH[spec.desk]) - REACH[spec.desk];
                    if (keys) object.position.set(keys.x, 0, keys.z).addScaledVector(front, BEHIND_KEYS[spec.desk] + short);
                    else object.position.set(pose.x - 6, 0, pose.z).addScaledVector(front, REACH[spec.desk] + short);
                    object.rotation.y = yaw + Math.PI; working = true;
                }
            } else if (spec.beside && (this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id])) {
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
        this.clearChairs();
    }
    // The room's own chairs make way wherever someone is working at a desk (they brought the chair the pose fits,
    // stand where the chair was, or roll in on their own wheels).
    clearChairs() {
        const spots = this.people.filter(o => o.visible && o.userData.person.desk).map(o => o.position);
        if (this.chairSpot) spots.push(this.chairSpot, this.chairHome);   // the room's own desk chair stays out while the film's is in the room
        for (const chair of this.room.assets()) {
            if (!CHAIRS.test((chair.userData.propId || '') + ' ' + (chair.userData.decorUpgrade || '')) || /student-chair|bar|artist/.test(chair.userData.propId || '')) continue;
            const centre = this.centreOf(chair).setY(0), blocked = spots.some(p => Math.hypot(p.x - centre.x, p.z - centre.z) < 850);
            if (blocked && !this.hidden.has(chair)) { this.hidden.set(chair, chair.visible); chair.visible = false; }
            else if (!blocked && this.hidden.has(chair)) { chair.visible = this.hidden.get(chair); this.hidden.delete(chair); }
        }
    }
    restoreChairs() { for (const [chair, visible] of this.hidden) chair.visible = visible; this.hidden.clear(); }
    dispose() {
        this.restoreChairs();
        for (const object of this.people) { object.userData.personChair?.removeFromParent(); object.removeFromParent(); for (const m of object.userData.personMaterials || []) m.dispose(); }
        this.people = []; this.built = null;
    }
}
