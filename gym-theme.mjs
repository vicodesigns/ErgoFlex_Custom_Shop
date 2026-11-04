import { ROOM_DESK_STYLES, GYM_BLACKRED_DESK, cleanDeskStyle } from './room-desk-styles.mjs?v=gym-black-red-m1-20261104';

// Home gym colourways. Plain data and pure helpers (no three.js), so the theme
// can be tested in node. Green is the authored room and stays the default:
// its modes ARE GYM_MODES, and its null finish and palette leave the room's
// existing defaults in place, so the green build is unchanged byte for byte.
export const GYM_MODES = {
    morning: { label: 'Morning', description: 'Sunrise mobility · standing coach station', key: '#ffe9c9', fill: '#d6e8f2', accent: '#bded66', power: 1.65, ambient: .44, bounce: .62, exposure: 1.04, sky: ['#87bed5', '#f9dfac'], practical: .3, wash: .24, colors: ['#bbc99a', '#9fc2bc'], sun: [.9, -.36, '#ffcf96', .4], glass: .34, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Daylight strength · workout tracking at standing height', key: '#f3f9ff', fill: '#dcebf3', accent: '#c1ed69', power: 1.75, ambient: .46, bounce: .66, exposure: 1.04, sky: ['#79b7d6', '#dbece8'], practical: .4, wash: .3, colors: ['#b7ce90', '#8fbbb9'], sun: [1.45, .12, '#fff1dc', .26], glass: .4, height: 43.5, tilt: -5, offset: [0, 70], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Recovery & stretching · lowered desk for session notes', key: '#ffc39c', fill: '#c4d6e6', accent: '#75e0ce', power: .72, ambient: .28, bounce: .36, exposure: 1.09, sky: ['#837eaa', '#e5a984'], practical: .78, wash: .34, colors: ['#cfbe94', '#8cbeb2'], sun: [.72, .48, '#ff9e62', .42], glass: .2, height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#69dec9' },
    night: { label: 'Night', description: 'Reset & recharge · gear stowed, desk folded, floor clear', key: '#a9c8ec', fill: '#b6cce4', accent: '#55dbe1', power: .15, ambient: .17, bounce: .23, exposure: 1.1, sky: ['#132b48', '#3c5b75'], practical: .45, wash: .18, colors: ['#b8b497', '#8da8af'], sun: [1.2, -.1, '#8fb8ff', .07], glass: .045, height: 43.5, tilt: 65, offset: [50, 180], yaw: -8, leds: true, color: '#aaa487' },
    party: { label: 'Power circuit', description: 'High-energy circuit · desk turned toward the training zone', key: '#dce6fc', fill: '#d4dfee', accent: '#c3f343', power: 1.2, ambient: .4, bounce: .55, exposure: 1.08, sky: ['#3c4b70', '#8b85a1'], practical: .85, wash: .68, colors: ['#b2ce79', '#77afa6'], sun: [1.2, 0, '#000000', 0], glass: .09, height: 43.5, tilt: 12, offset: [50, 260], yaw: -14, leds: true, color: '#b6f348' }
};

// Black & red: red marks the edges (channel 0: feature wall, coach strip, left
// lane and skirting) while channel 1 stays cool white by day, so the room
// reads as matte black with red light, never as a red-washed box. Only the
// listed numbers differ from green (night keeps a dim cool lane on the mirror
// wall for depth); posture, timing and sun stay the same.
// Black surfaces absorb light, so exposure, ambient and (evening, night) bounce are lifted per mode
// (tuned against stills) to keep the room from reading as a void.
const BLACKRED_MODE_CHANGES = {
    morning: { key: '#fff0e0', fill: '#dfe3ea', accent: '#ff4d4d', colors: ['#ff3b3b', '#dfe6ee'], wash: .2, exposure: 1.22, ambient: .52 },
    afternoon: { key: '#f6f8ff', fill: '#e2e6ee', accent: '#ff3b30', colors: ['#ff2a2a', '#e4e9f0'], wash: .26, exposure: 1.22, ambient: .54 },
    // Evening: warm-white key and a warm-white (not orange) sun patch, so the red stays on the edges.
    evening: { key: '#ffd9c6', fill: '#c9ccd6', accent: '#ff2d2d', colors: ['#e01b24', '#d5d9e2'], wash: .22, color: '#e0101c', exposure: 1.2, ambient: .42, bounce: .46, sun: [.72, .48, '#ffc9a6', .3] },
    night: { key: '#b8c4dc', fill: '#a8b0c4', accent: '#b3122a', colors: ['#8a0c16', '#a6b0c6'], wash: .34, color: '#c4101e', exposure: 1.38, ambient: .6, bounce: .46 },
    party: { key: '#e6e9f5', fill: '#d8dbe6', accent: '#ff1030', colors: ['#ff0f2e', '#ff3d1f'], wash: .78, color: '#ff0a1e', exposure: 1.16, ambient: .48 }
};

const GREEN = {
    id: 'green', label: 'Green & grey', modes: GYM_MODES, desk: ROOM_DESK_STYLES.gym,
    finish: null, detailPalette: null, screenAccent: null, screenMono: null, book: null, lightTint: [.12, .32],
    // [colour, material options] for the room's shared materials (variable names in gym-room.mjs).
    materials: {
        graphite: ['#242d32', { roughness: .85 }], steel: ['#414e54', { metalness: .7, roughness: .35 }],
        rubber: ['#111c23', { roughness: .92 }], lime: ['#c0ea50', { roughness: .55 }],
        silver: ['#becbd0', { metalness: .8, roughness: .28 }], oak: ['#a58560', { roughness: .8 }],
        ash: ['#c9ab83', { roughness: .74 }], slate: ['#1a252b', { roughness: .8 }],
        coachFloor: ['#3b4c53', { roughness: .95 }], bellHandle: ['#6b787e', { metalness: .65, roughness: .38 }]
    },
    canvas: {
        floor: { tones: ['#36424a', '#323e45', '#34404a', '#303b42'], flecks: ['#a6b2b766', '#8fa7b14d', '#0f181d99', '#c3e96a40', '#5e7c8a55'], seams: ['#151e23', '#4b585f66'] },
        wall: { base: '#86939a', mottle: ['235,242,245', '28,38,44'], specks: ['#2a363c40', '#e6eef033'] },
        sign: { background: '#14242d', slash: '#c2f250', title: '#e5eddf', line: '#c2f250', footer: '#679098' },
        mirror: ['#b9c9cf', '#7f939b', '#4b5b62', '#26333a'],
        label: ['#d9f3a5', '#1d292f'], strip: '#b9ec62', practical: '#fff1d8', blinds: '#455f6380'
    },
    instances: {
        chalk: ['#f2f0ea', '#c0ea50', '#6ae3e0'], towels: ['#eef0ea', '#c0ea50', '#7d8c93', '#eef0ea'],
        shakers: ['#22313a', '#c0ea50', '#4ec9d5', '#e9eee8', '#d7d2c6'],
        plants: ['#5f9a5a', '#7bb066', '#4e8950', '#86b96d', '#5f9a5a', '#6aa45f'],
        plates: ['#c0ea50', '#1a252c'], bells: [['#7c64b8', '#5e9e58'], ['#4f8fc0', '#d9c24a']],
        medBalls: ['#2b3439', '#c0ea50', '#2b3439'], mats: ['#46c9d6', '#384850', '#c0ea50'],
        bands: ['#c0ea50', '#4ec9d5', '#7c64b8', '#1d2a30'],
        bikeScreen: '#c4f45b', treadmillScreen: '#65e3df', bagText: '#c0ed57', recovery: ['#e9deca', '#5c675f']
    },
    // Point lights: warm practical, cool base, and the warm wall-wash tint.
    lights: { point: '#d2ef9d', warm: '#f1d1a6', cool: '#e3ece9', warmWash: '#ffe2b8' },
    sessions: {
        accents: { morning: '#aac68a', afternoon: '#b9d476', evening: '#a4c9bb', night: '#d2b896', party: '#aecd81' },
        board: { background: '#202b2c', erased: '#dbe8d904', title: '#edf0e4', subtitle: '#abbdb4', rows: '#dfe6da', frame: '#62786d', note: '#b6c6b8' },
        timer: { background: '#090f11', ghost: '#17211d', status: '#9caca6' },
        materials: {
            rubber: ['#293c3c', { roughness: .94 }], cork: ['#b18e60', { roughness: .89 }], linen: ['#c8d1c6', { roughness: .98 }],
            trim: ['#93a982', { roughness: .74 }], steel: ['#a8b3b5', { metalness: .88, roughness: .38 }], dark: ['#283238', { roughness: .75 }]
        },
        rackLabel: ['#d5dece', '#293536'], wipeLabel: ['#abbfb2', '#263735'],
        poster: { paper: '#e0dfcc', ink: '#304d48', strokes: ['#5d7e6d', '#a78351', '#447979'] }
    },
    props: null, dressing: null
};

const BLACKRED = {
    id: 'blackred', label: 'Black & red', desk: GYM_BLACKRED_DESK,
    modes: Object.fromEntries(Object.entries(GYM_MODES).map(([id, mode]) => [id, { ...mode, ...BLACKRED_MODE_CHANGES[id] }])),
    // Backdrops a step lighter than the walls so the room's edges hold against them.
    finish: { backdrops: { morning: ['#5a5c62', '#1c1c1f'], afternoon: ['#5a5c62', '#1c1c1f'], evening: ['#3a2224', '#120a0b'], night: ['#2a1416', '#070506'], party: ['#3a0c12', '#0c0405'] },
        name: 'Matte black & signal red', ground: '#1a1a1c', wood: .62, metal: .24, stone: .5, night: .95 },
    // [textile, accent, paper, glazed ceramic], as ROOM_DETAIL_PALETTES.
    detailPalette: ['#2a2a2d', '#c8102e', '#e6e4e0', '#1c1c1e'], screenAccent: '#ff3b3b', screenMono: true, book: '#7a0a16', lightTint: [.18, .45],
    materials: {
        graphite: ['#1b1b1d', { roughness: .88 }], steel: ['#2a2a2d', { metalness: .75, roughness: .3 }],
        rubber: ['#0d0d0e', { roughness: .95 }], lime: ['#c8102e', { roughness: .24, metalness: .05 }],
        silver: ['#d6d8db', { metalness: .92, roughness: .16 }], oak: ['#171719', { roughness: .45 }],
        ash: ['#1f1f22', { roughness: .6 }], slate: ['#0b0b0c', { roughness: .9 }],
        coachFloor: ['#151517', { roughness: .95 }], bellHandle: ['#3a3a3d', { metalness: .65, roughness: .38 }]
    },
    canvas: {
        floor: { tones: ['#252527', '#222224', '#242426', '#202022'], flecks: ['#8a8a8a55', '#6e6e6e40', '#05050599', '#d0202a38', '#4a4a4a55'], seams: ['#0a0a0b', '#3a3a3c66'] },
        wall: { base: '#424247', mottle: ['120,120,124', '8,8,10'], specks: ['#0c0c0e40', '#7a7a7e26'] },
        sign: { background: '#0c0c0d', slash: '#e10600', title: '#f4f4f4', line: '#ff2b2b', footer: '#8a8a8f' },
        mirror: ['#8d8f94', '#4f5156', '#24252a', '#141416'],
        label: ['#ece9e6', '#111113'], strip: '#ff2a2a', practical: '#fff1d8', blinds: '#1a1a1c80'
    },
    instances: {
        chalk: ['#f2f0ea', '#e0182d', '#bfbfbf'], towels: ['#1a1a1c', '#c8102e', '#3a3a3d', '#1a1a1c'],
        shakers: ['#141416', '#c8102e', '#2a2a2d', '#e9e9e9', '#3a3a3a'],
        // Foliage is not an accent: the snake plant stays green.
        plants: ['#5f9a5a', '#7bb066', '#4e8950', '#86b96d', '#5f9a5a', '#6aa45f'],
        plates: ['#c8102e', '#141416'], bells: [['#121214', '#b00d22'], ['#2c2c2f', '#e01f2f']],
        medBalls: ['#161618', '#c8102e', '#161618'], mats: ['#2a2a2d', '#151517', '#c8102e'],
        bands: ['#c8102e', '#7a0a16', '#3a3a3d', '#111113'],
        bikeScreen: '#ff3030', treadmillScreen: '#ff3030', bagText: '#ff3030', recovery: ['#e9e4df', '#1c1c1e']
    },
    // A neutral picture light: amber over a black board reads as sepia.
    lights: { point: '#ffd9d4', warm: '#f1d1a6', cool: '#e8ecf2', warmWash: '#f3ece6' },
    sessions: {
        accents: { morning: '#e8736b', afternoon: '#ff3b30', evening: '#e0473f', night: '#a33a3a', party: '#ff1f3d' },
        board: { background: '#111113', erased: '#f2f2f204', title: '#f2f2f2', subtitle: '#a7a7ab', rows: '#e2e2e2', frame: '#4a4a4e', note: '#9a9a9e' },
        timer: { background: '#070707', ghost: '#1e0b0b', status: '#a7a7ab' },
        materials: {
            rubber: ['#1a1a1c', { roughness: .94 }], cork: ['#2a211c', { roughness: .89 }], linen: ['#2a2a2d', { roughness: .98 }],
            trim: ['#c8102e', { roughness: .4 }], steel: ['#b8babd', { metalness: .9, roughness: .3 }], dark: ['#18181a', { roughness: .75 }]
        },
        rackLabel: ['#ece9e6', '#141416'], wipeLabel: ['#bdbdc1', '#141416'],
        poster: { paper: '#141416', ink: '#f0f0f0', strokes: ['#c8102e', '#e8e8e8', '#7a0a16'] }
    },
    // Imported GLB recolours: placement id -> material name -> colour. The
    // textures multiply the tint (yellow frame x red = red, blue mat x grey = black).
    props: {
        'gym-props-3': { gym_frame: '#ff2a2a', soft_matt01: '#3a3436', pushup_2: '#b00d22', pushup_3: '#b00d22' },
        'party-speaker': { Orange: '#ff1a1a', Glow: '#ff1a1a', Glow_2: '#ff1a1a', Speaker_Lights: '#ff1a1a' },
        'kenney-furniture-bench-cushion-low': { wood: '#2e221c' },
        // Lime printed pouch x red = a dark red pouch with red print; the
        // orange basketball becomes red with black seams.
        'hemp-protein': { Material_001: '#ff3b3b' }, basketball: { Basketball: '#ff4040' },
        // The floor plant loads as ergoflex-plant-2: its terracotta pot goes black, the leaves stay natural.
        'decor-plant2': { 'Terracotta planter': '#161618' }
    },
    // Desk dressing (WorkspaceAccessories): notebook and daily-kit covers,
    // and the sports bottle's blue body.
    // The tablet's blue tiles x red = a black screen with red tiles; its blue
    // keyboard cover becomes plain matte black ({ color, untextured }).
    dressing: { accent: '#7a0a16', print: '#c8102e', props: { 'sports-bottle': { Material_001: '#b00d22' },
        'tablet-pc': { Mic_Sur_P3_display: '#ff2a2a', body: { color: '#1c1c1e', untextured: true }, material: { color: '#2a2a2d', untextured: true } } } }
};

// Null prototype: ids come from localStorage, URLs and imported projects.
export const GYM_THEMES = Object.freeze(Object.assign(Object.create(null), { green: GREEN, blackred: BLACKRED }));
export const GYM_THEME_IDS = Object.keys(GYM_THEMES);
export const gymTheme = id => GYM_THEMES[id] || GREEN;
export const gymModes = id => gymTheme(id).modes;

// Green returns the very layout object; black/red is a shallow copy carrying
// the room-level finish and palette that room-polish and room-life read.
export function themedGymLayout(layout, id) {
    const t = GYM_THEMES[id];
    if (!layout || !t || t === GREEN) return layout;
    return { ...layout, theme: t.id, finish: t.finish, detailPalette: t.detailPalette, detailBook: t.book };
}

// Saved scene desks and Groove lights were authored in one colourway. Swap an
// exact authored value of another colourway for this one's; custom values
// (a visitor's own finish or LED colour) pass through untouched.
// Call these on a colourway CHANGE only (studio setGymTheme), never on load:
// the black & red desk is also the catalog's Gaming desk, so in the green
// room it may be the visitor's own choice.
export function themeGymDeskStyle(style, id) {
    const target = gymTheme(id).desk, value = cleanDeskStyle(style);
    if (!value) return style;
    const same = desk => desk.woodFinish === value.woodFinish && desk.baseFinish === value.baseFinish && desk.trimColor.toLowerCase() === value.trimColor;
    if (same(target)) return style;
    const source = Object.values(GYM_THEMES).find(t => t.desk !== target && same(t.desk))?.desk;
    if (!source) return style;
    // The authored sheen follows the colourway (satin green, gloss black & red); a visitor's own stays.
    const sheen = value.sheen === (source.sheen || 'satin') ? target.sheen || 'satin' : value.sheen;
    return { ...style, woodFinish: target.woodFinish, baseFinish: target.baseFinish, trimColor: target.trimColor, sheen };
}
export function themeGymLights(lights, id) {
    const target = gymTheme(id).modes, colour = typeof lights?.color === 'string' ? lights.color.toLowerCase() : null;
    if (!colour) return lights;
    for (const t of Object.values(GYM_THEMES)) {
        if (t.modes === target) continue;
        const mode = Object.keys(t.modes).find(m => t.modes[m].color?.toLowerCase() === colour);
        if (mode && target[mode].color) return { ...lights, color: target[mode].color };
    }
    return lights;
}
// A saved scene-desk state moved to colourway id: the changed fields (style,
// lights, per-setting lights), or null when nothing is authored in the other one.
export function themeGymDeskState(state, id) {
    if (!state || typeof state !== 'object') return null;
    const patch = {}, style = themeGymDeskStyle(state.style, id), lights = themeGymLights(state.lights, id);
    if (style !== state.style) patch.style = style;
    if (lights !== state.lights) patch.lights = lights;
    let phases = null;
    for (const [key, phase] of Object.entries(state.phases || {})) {
        const moved = themeGymLights(phase?.lights, id);
        if (moved !== phase?.lights) (phases ||= { ...state.phases })[key] = { ...phase, lights: moved };
    }
    if (phases) patch.phases = phases;
    return Object.keys(patch).length ? patch : null;
}
