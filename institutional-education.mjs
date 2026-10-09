import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { institutionalMap, boardFrame, boardGrid, boardCurve, screenHeader, screenFooter, detailKit, books, notebook, plant, storageBooks, storageTray, activityNotebook, identityGallery, rnd } from './institutional-detail.mjs?v=institutional-sweep-20261009';

// Educational group: `kindergarten`, `elementary`, `middleschool`,
// `highschool`, `college`, `university` (kinds early / primary / secondary /
// college / university). Each stage has one fixed layout (EDUCATIONAL_LEVELS
// in institutional-scenes.mjs). This module owns the group's registry
// overrides, extra ErgoFlex stations, displays, furnishings, decor and daily
// staging. Shared shell: institutional-room.mjs (kit).
//
// Coordinates are mm in the room frame: x across (−x window wall, +x door
// wall), z from the back (teaching) wall `bz` to the open front. Layouts and
// clearances follow the design brief (≥ 900 mm walkways, door path clear).
// Stage progression: learning centres (KG) → table pods and a meeting carpet
// (elementary) → STEM clusters and a maker bench (middle) → paired rows and a
// demonstration desk (high) → active-learning team tables (college) → a
// hollow-square graduate seminar (university). ErgoFlex desks grow 3 → 7.
export const GROUP = 'education';
export const SCENES = ['kindergarten', 'elementary', 'middleschool', 'highschool', 'college', 'university'];
const isYoung = spec => spec.kind === 'early' || spec.kind === 'primary';
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const TAU = Math.PI * 2;

// ---- Registry data (merged by institutional-scenes.mjs) -----------------
export const lighting = {
    early: { practical: [.24,.3,.7,.35,.65], wash: [.2,.18,.35,.16,.4], task: '#ffe6bf', bounce: '#c6d4bb' },
    primary: { practical: [.28,.32,.74,.4,.7], wash: [.2,.18,.36,.18,.4], task: '#ffe9ca', bounce: '#c2d8cb' },
    secondary: { practical: [.3,.38,.8,.45,.76], wash: [.18,.18,.36,.18,.4], task: '#f5ebd8', bounce: '#bdced5' },
    college: { practical: [.28,.34,.8,.46,.78], wash: [.2,.18,.4,.2,.42], task: '#ffe8c9', bounce: '#cfbdab' },
    university: { practical: [.3,.36,.82,.48,.8], wash: [.2,.18,.38,.2,.4], task: '#f4ead3', bounce: '#b6ccbf' }
};

// Desk prop placement: [x, y, z] in the desktop/shelf frame (+z toward the user).
const p = (id, x, z, turn = 0, y = 0, extra = {}) => ({ id, at: [x, y, z], ...(turn ? { turn } : {}), ...extra });
const notEvening = { phases: ['morning', 'afternoon', 'night', 'party'] };

// Per stage: the extra ErgoFlex desks (roles), the main (teacher/lecturer)
// desk dressing, the main desk pose per daypart [height in, tilt deg, yaw deg],
// the daily planning table position and loose library props on the floor.
const STAGES = {
    kindergarten: {
        // MAIN: the teacher's mobile observation and documentation station.
        desk: [p('kenney-furniture-laptop', -70, -60, 0, 0, notEvening), p('journal', 300, 120, -6), p('tablet-pc', -440, 170, 12, 0, notEvening),
            p('pencil-case', 250, -175), p('painted-mug', 470, -120, 0, 0, notEvening), p('sketchbook', -180, 40, 4, 0, { phases: ['evening'] })],
        shelf: [p('paper-holder', -300, 0), p('kenney-furniture-plant-small1', 330, 0)],
        pose: [[43.5, 0], [35, 0], [43.5, 20], [28, 0], [35, 0, 20]],
        activity: [2200, 4300],
        props: [p('toy-train', 1150, -640, 25), { id: 'kenney-furniture-bear', at: [-2790, 720, 4380], turn: 90, scale: .34 }],
        stations: [
            // Child height (28 in) is a standing surface for 4–6-year-olds.
            { id: 'discovery-light-table', name: 'Discovery light table', size: '60x30', at: [1800, -1400], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('globe', -560, -120), p('lego-bricks', 260, 175, 0, 40)], shelf: [p('kenney-furniture-books', -260, 0), p('kenney-furniture-plant-small2', 330, 0)] },
            { id: 'art-easel', name: "Children's painting easel", size: '48x30', at: [0, 3400], turn: 0, height: 28, tilt: 35, chair: false, plan: true,
                desktop: [p('sketchbook', -400, 190, 0, 1), p('painters-tape', 450, 190, 0, 1)], shelf: [p('pencil-case', -330, 0)] }
        ]
    },
    elementary: {
        desk: [p('kenney-furniture-laptop', -200, -20), p('tablet-folder', 320, 120, -8), p('pencil-case', 560, -100), p('painted-mug', -580, 150)],
        shelf: [p('paper-holder', -300, 0), p('kenney-furniture-books', 290, 0)],
        pose: [[35, 0], [43.5, 0], [43.5, 15], [28, 0], [43.5, 0, -25]],
        activity: [2300, 5883],
        props: [
            // (The reading floor lamp by the carpet is procedural, with a real light: extraLamps.)
            ...[-525, -175, 175, 525].map(dz => ({ id: 'kenney-furniture-stool-bar-square', at: [1969, 0, 433 + dz], turn: 90, scale: .6 }))
        ],
        stations: [
            { id: 'class-tech-cart', name: 'Document camera cart', size: '48x30', at: [-300, -2167], turn: 180, height: 43.5, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', 280, 20), p('papers', -260, 120)] },
            { id: 'guided-reading', name: 'Guided reading table', size: '60x30', at: [2600, 433], turn: 90, height: 28, tilt: 0,
                desktop: [p('kenney-furniture-books', -440, -110), p('comics', -80, 90), p('journal', 260, 120), p('tablet-folder', 540, -80)], shelf: [p('kenney-furniture-plant-small3', 0, 0)] },
            { id: 'science-window', name: 'Science and grow table', size: '60x30', at: [-3500, 1800], turn: 90, height: 28, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-plant-small1', -600, 170), p('water-bottle', 600, 160), p('sketchbook', 120, 200, 6)], shelf: [p('globe', -250, 0)] },
            { id: 'accessible-student', name: 'Accessible student desk', size: '48x30', at: [-3000, 4683], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('tablet-pc', 0, -100), p('kenney-furniture-computer-keyboard', -40, 160), p('headphones', -460, -60), p('pencil-case', 450, 60)] }
        ]
    },
    middleschool: {
        desk: [p('kenney-furniture-laptop', -200, -10), p('clipboard', 330, 110, -8, 1), p('calculator', 580, -100), p('insulated-mug', -600, 150)],
        shelf: [p('paper-holder', -300, 0), p('kenney-furniture-books', 300, 0)],
        pose: [[43.5, 0], [35, 0], [28, 0], [28, 0], [43.5, 0, 30]],
        activity: [-1100, 6950],
        props: [p('backpack-daypack', -2950, 2550, 60),
            // Chromebook-style laptops on three clusters (they travel with the tables).
            p('kenney-furniture-laptop', -1100, 1240, 180, 740), p('kenney-furniture-laptop', 1100, 1960, 0, 740), p('kenney-furniture-laptop', -1100, 4960, 0, 740)],
        stations: [
            { id: 'maker-bench', name: 'Maker and 3D-print bench', size: '60x30', at: [2900, -1367], turn: 0, height: 38, tilt: 0, chair: false,
                desktop: [p('printer-3d', -420, -70), p('caliper', 250, 150, 20), p('multi-tool-open', 470, 130), p('lego-bricks', 80, -60), p('fpv-drone', 580, -160)], shelf: [p('toolbox', 0, 0)] },
            { id: 'presentation-desk', name: 'Presentation desk', size: '48x30', at: [3500, 4300], turn: 90, height: 43.5, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -100, 0), p('pen', 320, 150, 70), p('clipboard', -430, 140, 0, 1)] },
            { id: 'standing-student', name: 'Student standing desk', size: '48x30', at: [-3700, 1600], turn: 90, height: 38, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', 0, 0), p('water-bottle', -470, -100), p('journal', 400, 130)], shelf: [p('kenney-furniture-books', 0, 0)] },
            { id: 'accessible-student', name: 'Accessible student desk', size: '60x30', at: [-3500, 4640], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('tablet-pc', -200, -80), p('kenney-furniture-computer-keyboard', -200, 160), p('headphones', 460, -90), p('sketchbook', 470, 140)] }
        ]
    },
    highschool: {
        desk: [p('kenney-furniture-laptop', -200, -20), p('calculator', 300, 140), p('papers', 470, 40, -8), p('insulated-mug', -600, 150)],
        shelf: [p('curved-monitor', 0, 0)],
        pose: [[43.5, 0], [28, 0], [35, 10], [28, 0], [43.5, 0, 25]],
        activity: [-3800, 7300],
        props: [p('backpack-daypack', -1830, 650, 20), p('backpack', 320, 2650, -30), p('backpack-daypack', 2470, 4650, 160), p('backpack', -1830, 4650, 10),
            p('water-bottle', -2520, 360, 0, 740), p('water-bottle', 520, 2360, 0, 740), p('water-bottle', 1780, 360, 0, 740), p('water-bottle', -380, 4360, 0, 740)],
        stations: [
            { id: 'demonstration-desk', name: 'Physics demonstration desk', size: '60x30', at: [0, -2600], turn: 180, height: 43.5, tilt: 0, chair: false,
                desktop: [p('oscilloscope', -450, -90), p('voltage-regulator', 40, -110), p('kenney-furniture-laptop', 470, 30), p('multi-tool', -120, 160)] },
            { id: 'student-standing', name: 'Student standing desk', size: '48x30', at: [4380, 1000], turn: 0, height: 41, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -60, 0), p('calculator', 420, 120), p('journal', -460, 130)] },
            { id: 'window-research', name: 'Research nook desk', size: '48x30', at: [-4300, 1000], turn: 0, height: 28, tilt: 0,
                desktop: [p('kenney-furniture-laptop', -120, 0), p('kenney-furniture-books', 400, -100), p('glasses', 380, 150)], shelf: [p('paper-holder', 0, 0)] },
            { id: 'accessible-student', name: 'Accessible student desk', size: '48x30', at: [-4300, 3800], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('tablet-pc', -150, -80), p('office-keyboard', -50, 160), p('headphones', 470, -90)] },
            { id: 'project-review', name: 'Poster and project review desk', size: '60x30', at: [-1000, 6700], turn: 0, height: 43.5, tilt: 25, chair: false, plan: true,
                desktop: [p('metal-ruler', 560, 0, 90, 1), p('sketchbook', -580, 160, 0, 1)], shelf: [p('kenney-furniture-books', -300, 0), p('paper-stand', 300, 0)] },
            { id: 'research-desk', name: 'Research and data desk', size: '60x30', at: [1500, 6600], turn: 0, height: 28, tilt: 0,
                desktop: [p('office-keyboard', -80, 120), p('magic-mouse', 330, 110, 90), p('journal', -560, 60), p('kenney-furniture-plant-small1', 610, -150)], shelf: [p('kenney-furniture-computer-screen', 0, 0)] }
        ]
    },
    college: {
        desk: [p('kenney-furniture-laptop', -200, -20), p('journal', 320, 120), p('glasses', 560, -80), p('tea-cup', -600, 150)],
        shelf: [p('kenney-furniture-books', -300, 0), p('paper-holder', 300, 0)],
        pose: [[43.5, 0], [35, 0], [43.5, 10], [28, 0], [43.5, 0, 30]],
        activity: [3300, 7967],
        props: [p('kenney-furniture-stool-bar', -3150, 2250, 200), p('kenney-furniture-stool-bar', -2450, 7980, 170), p('kenney-furniture-stool-bar', -1900, 7980, 185), p('kenney-furniture-stool-bar', -1350, 7980, 195),
            // Team laptops (travel with the team tables).
            p('kenney-furniture-laptop', -1700, 420, 0, 740), p('kenney-furniture-laptop', -900, 910, 180, 740), p('kenney-furniture-laptop', 2400, 420, 0, 740),
            p('kenney-furniture-laptop', 1800, 910, 180, 740), p('kenney-furniture-laptop', -1300, 3720, 0, 740), p('kenney-furniture-laptop', 3000, 4210, 180, 740)],
        stations: [
            { id: 'instructor-podium', name: 'Teaching podium', size: '60x30', at: [0, -3133], turn: 180, height: 43.5, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -260, 20), p('papers', -560, 140), p('pen', 80, 160)] },
            { id: 'lab-practical', name: 'Hands-on practical bench', size: '48x30', at: [4400, -1933], turn: 90, height: 40, tilt: 0, chair: false,
                desktop: [p('mars-rover', -150, -60), p('multi-tool-open', 330, 130), p('caliper', -430, 160), p('voltage-regulator', 400, -120)], shelf: [p('toolbox', 0, 0)] },
            { id: 'ta-help', name: 'TA office-hours desk', size: '60x30', at: [-4250, 1267], turn: 0, height: 28, tilt: 0,
                desktop: [p('kenney-furniture-laptop', -200, 0), p('papers', 300, 120, -6), p('tea-cup', 580, -80), p('calculator', -580, 140)], shelf: [p('kenney-furniture-books', 0, 0)] },
            { id: 'accessible-student', name: 'Accessible student position', size: '48x30', at: [-4250, 6667], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -60, 0), p('headphones', 430, -100), p('journal', -440, 130)] },
            { id: 'team-pitch', name: 'Standing pitch and collaboration desk', size: '60x30', at: [600, 7067], turn: 0, height: 43.5, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -320, 0), p('sketchbook', 250, 130), p('coffee-cups', 420, -190)] }
        ]
    },
    university: {
        desk: [p('office-keyboard', -60, 120), p('magic-mouse', 300, 110, 90), p('antique-book', -560, 60), p('glasses', 480, -140), p('tea-cup', 600, 150)],
        shelf: [p('curved-monitor', 0, 0)],
        pose: [[43.5, 0], [28, 0], [43.5, 10], [28, -5], [43.5, 0, 20]],
        activity: [-800, 8633],
        props: [p('armchair-leather', 1750, 8450, 200), p('armchair-leather', 3250, 8450, 160)],
        stations: [
            { id: 'lecturer-lectern', name: 'Lecture lectern', size: '48x30', at: [-600, -3467], turn: 180, height: 43.5, tilt: 15, chair: false, plan: true,
                desktop: [p('tablet-folder', 380, 80, 0, 1), p('pen', 120, 170, 70, 1)], shelf: [p('kenney-furniture-laptop', 0, 0)] },
            { id: 'accessible-seminar', name: 'Accessible seminar seat', size: '60x30', at: [-600, 2958], turn: 0, height: 28, tilt: 0, chair: false,
                desktop: [p('kenney-furniture-laptop', -150, 0), p('journal', 350, 120), p('glass-of-water', 610, -80)] },
            { id: 'research-assistant', name: 'Research assistant desk', size: '60x30', at: [-4750, 5033], turn: 0, height: 28, tilt: 0,
                desktop: [p('office-keyboard', -80, 120), p('magic-mouse', 330, 110, 90), p('journal', -560, 60), p('insulated-mug', 610, -80)], shelf: [p('curved-monitor', 0, 0)] },
            { id: 'poster-review', name: 'Poster and figure review desk', size: '60x30', at: [4800, -1667], turn: 270, height: 43.5, tilt: 30, chair: false, plan: true,
                desktop: [p('metal-ruler', 600, 0, 90, 1), p('sketchbook', -590, 150, 0, 1)], shelf: [p('paper-stand', 0, 0)] },
            { id: 'graduate-carrel-1', name: 'Graduate study carrel', size: '48x30', at: [4800, 6133], turn: 270, height: 28, tilt: 0,
                desktop: [p('kenney-furniture-laptop', -60, 0), p('kenney-furniture-books', 420, -110), p('glasses', 360, 150)], shelf: [p('kenney-furniture-plant-small2', 250, 0)] },
            { id: 'graduate-carrel-2', name: 'Graduate study carrel', size: '48x30', at: [4800, 3803], turn: 270, height: 35, tilt: 0,
                desktop: [p('kenney-furniture-laptop', -60, 0), p('journal', 400, 130), p('painted-mug', 470, -110)], shelf: [p('kenney-furniture-books', 0, 0)] }
        ]
    }
};

// ---- Lighting by daypart (architectural lighting brief §x.5) -------------
// Per stage and daypart [morning 09:00, afternoon 14:00, evening 18:00,
// night 22:00, party 16:00]: the registry mode (sun key/fill colour and power,
// ambient, sky, exposure, practical/wash for the 3 room lights, their task and
// bounce colours, desk LEDs) plus the module's own levels: `sun` floor patch
// through the glazing, `view` window outlook emission, `ceiling` shell linear
// fixtures, `lamps` local lamp strengths (activity-table lamp, second lamp),
// `desk` a scale on the room light over the main desk (keeps walls near it calm).
// Every emissive fixture and additive pool carries its own 5-level array.
// Desk LEDs: the shelf strips wash the desktop in their own colour, so in
// daylight any bright warm colour turns the black ErgoFlex desktop tan. Desk
// LEDs stay off by day (golden-hour evening included); at night they glow a
// low-value warm white, and for the shared event a deep ErgoFlex red (deep
// teal in the middle-school STEM studio): black desktop with a coloured sheen.
const mode =(key, fill, sky, power, ambient, exposure, practical, wash, bounce, colors, leds = false, color) => ({ key, fill, sky, power, ambient, exposure, practical, wash, bounce, colors, leds, ...(color ? { color } : {}) });
const SKY = { morning: ['#a9cfe4', '#f7e6c8'], afternoon: ['#8fc2df', '#e2eef2'], evening: ['#8f86a8', '#f3bf8f'], night: ['#0f2038', '#2f4660'], party: ['#a3c0d6', '#f4d4ac'] };
const LIGHT = {
    kindergarten: {
        // 3000K paper lanterns, the light table as the strongest practical, picture lights on the cards and the art line.
        modes: [mode('#fff0dc', '#e3edf0', SKY.morning, 1.55, .44, 1.06, .24, .2, .7, ['#ffe6bf', '#d6dcc6']),
            mode('#fff6ea', '#e1edf2', SKY.afternoon, 1.6, .46, 1.04, .3, .18, .76, ['#ffeccc', '#cfdcd2']),
            mode('#ffcf9e', '#d9d6e6', ['#b48fa2', '#f6c58e'], .52, .3, 1.1, .74, .4, .5, ['#ffd49e', '#e7c7aa']),
            mode('#b4c8e2', '#9fb8d4', SKY.night, .1, .11, 1.21, .44, .14, .24, ['#ffcf98', '#8ea4be'], true, '#5a3e2a'),
            mode('#ffe6c4', '#dfe4e4', SKY.party, .9, .38, 1.09, .58, .4, .6, ['#ffe4c0', '#e3dccb'], true, '#4a1a14')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .62, .9], ceiling: ['#fff1dc', [.35, .3, .45, .04, .5]], lamps: [[.14, .16, .78, .3, .55]]
    },
    elementary: {
        // 3500K linear pendants, reading floor lamp, grow strip, word-wall picture light.
        modes: [mode('#fff0dc', '#dceaf0', SKY.morning, 1.5, .42, 1.06, .28, .2, .7, ['#ffe9ca', '#d0dccf']),
            mode('#f4f8ff', '#e1edf2', SKY.afternoon, 1.55, .46, 1.04, .32, .18, .76, ['#fff0d8', '#c8dacd']),
            mode('#ffd2a6', '#d7dbec', ['#a98ea6', '#f2c398'], .52, .29, 1.1, .72, .36, .5, ['#ffd8a6', '#dfc9b2']),
            mode('#b6cae4', '#a0bad6', SKY.night, .1, .11, 1.21, .46, .14, .24, ['#ffd09c', '#8fa7c0'], true, '#5a3e2a'),
            mode('#ffe6c4', '#d8e2e0', SKY.party, .9, .36, 1.09, .6, .42, .6, ['#ffe6c4', '#d4e2d8'], true, '#4a1813')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .6, .9], ceiling: ['#fff3e2', [.35, .3, .55, .05, .55]], lamps: [[.14, .16, .7, .28, .5], [0, 0, .62, .66, .3]]
    },
    middleschool: {
        // 4000K suspended linears under the baffles, maker task strip, screen glow, printer ring.
        modes: [mode('#fff0dc', '#dceaf0', SKY.morning, 1.5, .42, 1.06, .3, .18, .7, ['#f5ebd8', '#c9d6da']),
            mode('#f2f7ff', '#e1edf2', SKY.afternoon, 1.55, .46, 1.04, .36, .18, .76, ['#f4f2ea', '#c4d4d8']),
            mode('#ffd3a8', '#d6dcee', ['#9d8ea8', '#efc39a'], .52, .29, 1.1, .74, .34, .5, ['#ffdcae', '#c7c9d2']),
            mode('#b4c8e4', '#9fb9d6', SKY.night, .1, .11, 1.21, .46, .14, .24, ['#ffd8a6', '#8aa4c0'], true, '#5a3e2a'),
            mode('#ffe4c0', '#d6dfe6', SKY.party, .82, .34, 1.1, .66, .44, .56, ['#f8ecd8', '#c8dee0'], true, '#0e3036')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .58, .9], ceiling: ['#f6f8f8', [.4, .35, .6, .05, .6]], lamps: [[.12, .16, .7, .32, .5]]
    },
    highschool: {
        // 4000K linears, demonstration spot on the slate inlay, gallery rail light, oscilloscope trace.
        modes: [mode('#fff0dc', '#dceaf0', SKY.morning, 1.5, .42, 1.06, .3, .18, .7, ['#f5ebd8', '#c4d0d6']),
            mode('#f0f7ff', '#e1edf2', SKY.afternoon, 1.55, .46, 1.04, .36, .18, .76, ['#f4efe4', '#c0ccd2']),
            mode('#ffcfa2', '#d5daec', ['#9a8aa6', '#efbf94'], .52, .28, 1.1, .76, .34, .5, ['#ffd8a8', '#c4c6d0']),
            mode('#b4c8e4', '#9fb9d6', SKY.night, .1, .11, 1.21, .46, .14, .24, ['#ffd4a0', '#88a2be'], true, '#5a3e2a'),
            mode('#ffe4c0', '#d6dfe6', SKY.party, .82, .34, 1.1, .66, .44, .56, ['#f8e8d0', '#c6d6dc'], true, '#4a1813')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .58, .9], ceiling: ['#f6f8f8', [.4, .35, .6, .05, .6]], lamps: [[.12, .16, .7, .3, .5]]
    },
    college: {
        // 3500K pendant clusters over the team tables, track spots on the teaching wall, lounge floor lamp.
        modes: [mode('#fff0dc', '#dceaf0', SKY.morning, 1.5, .42, 1.06, .28, .2, .7, ['#ffe8c9', '#d6c8b8']),
            mode('#f0f7ff', '#e1edf2', SKY.afternoon, 1.55, .46, 1.04, .34, .18, .76, ['#fff0dc', '#d2c6b8']),
            mode('#ffc994', '#d2d6ea', ['#8f80a4', '#f0b98a'], .52, .27, 1.11, .76, .4, .48, ['#ffd09a', '#dcbca2']),
            mode('#b4c6e2', '#9fb8d4', SKY.night, .1, .11, 1.21, .48, .16, .23, ['#ffcf98', '#8ca1ba'], true, '#5a3e2a'),
            mode('#ffe2bc', '#dcdfe2', SKY.party, .82, .33, 1.1, .68, .46, .54, ['#ffe2bc', '#e2d4c2'], true, '#4a1813')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .6, .9], ceiling: ['#fff3e2', [.35, .3, .5, .04, .55]], lamps: [[.12, .16, .62, .26, .45], [.0, .0, .7, .62, .45]]
    },
    university: {
        // 3000K long seminar pendant, brass picture lights, banker's lamps, lounge reading lamp.
        modes: [mode('#fff0dc', '#dceaf0', SKY.morning, 1.5, .42, 1.06, .3, .2, .7, ['#f6ead2', '#c8d4c8']),
            mode('#f2f6fb', '#e1edf2', SKY.afternoon, 1.5, .44, 1.04, .36, .2, .74, ['#f8eedc', '#c4d2c6']),
            mode('#ffc890', '#cfd4e8', ['#857ca2', '#ecb487'], .52, .26, 1.12, .78, .42, .46, ['#ffcc94', '#d8b896']),
            mode('#b2c5e0', '#9cb6d2', ['#0d1d33', '#2b415a'], .11, .14, 1.22, .5, .16, .22, ['#ffcc94', '#889eb8'], true, '#5a3e2a'),
            mode('#ffe2bc', '#dce0e0', SKY.party, .82, .33, 1.1, .7, .46, .54, ['#ffe0b8', '#d8d4be'], true, '#4a1813')],
        sun: [.08, .06, .2, .05, .12], desk: [1, 1, .55, .7, .6], view: [.9, .95, .82, .6, .9], ceiling: ['#fff1dc', [.35, .3, .4, .03, .5]], lamps: [[.12, .16, .6, .24, .45], [.0, .0, .72, .66, .45]]
    }
};
const modesFor = id => Object.fromEntries(STAGES[id].pose.map(([height, tilt, yaw = 0], i) => [PHASES[i], { ...LIGHT[id].modes[i], height, tilt, yaw }]));
const stageLayout = id => (tier, layout) => {
    const s = STAGES[id]; layout.activity = [...s.activity];
    // Loose library props on the floor or on furniture tops (physical coordinates).
    for (const prop of s.props) layout.props.push({ ...prop, at: [...prop.at] });
};
const override = (id, boardTitle) => ({ boardTitle, desk: STAGES[id].desk, shelf: STAGES[id].shelf, modes: modesFor(id), layout: stageLayout(id) });
export const sceneOverrides = {
    kindergarten: override('kindergarten', 'LITTLE DISCOVERIES'),
    elementary: override('elementary', 'READ / EXPLORE / CREATE'),
    middleschool: override('middleschool', 'DESIGN A BETTER CITY'),
    highschool: override('highschool', 'ENERGY / SYSTEMS / CHANGE'),
    college: override('college', 'IDEAS INTO PRACTICE'),
    university: override('university', 'RESEARCH / SHARED DISCOVERY')
};
export const finish = spec => ({ name: spec.name + ' · natural oak & learning textiles', ground: '#9b8768', wood: .53, metal: .31, stone: .6, night: .92, partyDay: true });

// Extra ErgoFlex desks per stage (fields: see docs "Extra ErgoFlex desks").
export function stations(sceneId) {
    return (STAGES[sceneId]?.stations || []).map(s => ({ ...s, at: [...s.at] }));
}

// ---- Canvas drawing helpers ---------------------------------------------
const reset = c => { c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineWidth = 1; c.globalAlpha = 1; c.setLineDash?.([]); };
const dot = (c, x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const write = (c, s, x, y, size = 20, color = '#33464c', align = 'center', weight = '600', max) => {
    c.fillStyle = color; c.font = `${weight} ${size}px sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y, max);
};
const textLines = (c, x, y, w, n, gap = 10, color = '#8a9597', thick = 3) => { c.fillStyle = color; for (let i = 0; i < n; i++) c.fillRect(x, y + i * gap, w * (i === n - 1 ? .55 : 1 - (i % 3) * .07), thick); };
const paperNoise = (c, W, H, n = 600, color = '#7a6a5010') => { c.fillStyle = color; for (let i = 0; i < n; i++) c.fillRect(rnd(i + 3) * W, rnd(i + 911) * H, 1 + rnd(i) * 2, 1); };
const PASTEL = ['#d9534f', '#f0c24b', '#4f8fc0', '#6aa56a', '#b07cc6', '#ef8a4c'];

// A child's painting: sun and house, rainbow, handprints, family, flowers, blobs.
function childPainting(c, x, y, w, h, n) {
    c.save(); c.translate(x, y);
    c.fillStyle = ['#fffdf6', '#fbf4e4', '#f6faff', '#fff9ef'][n % 4]; c.fillRect(0, 0, w, h);
    const r = k => rnd(n * 17 + k), lw = Math.max(2, w * .035); c.lineWidth = lw; c.lineCap = 'round';
    switch (n % 6) {
        case 0:
            c.fillStyle = '#7cb36a'; c.fillRect(0, h * .78, w, h * .22);
            c.fillStyle = '#e48e6e'; c.fillRect(w * .3, h * .45, w * .36, h * .34);
            c.fillStyle = '#b5523f'; c.beginPath(); c.moveTo(w * .25, h * .46); c.lineTo(w * .48, h * .24); c.lineTo(w * .71, h * .46); c.fill();
            c.fillStyle = '#4f8fc0'; c.fillRect(w * .43, h * .6, w * .1, h * .19);
            dot(c, w * .8, h * .18, w * .1, '#f0c24b'); break;
        case 1:
            ['#d9534f', '#ef8a4c', '#f0c24b', '#6aa56a', '#4f8fc0', '#8a6cc0'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = lw * 1.4; c.beginPath(); c.arc(w * .5, h * .9, w * (.42 - i * .055), Math.PI, TAU); c.stroke(); });
            dot(c, w * .2, h * .2, w * .07, '#f0c24b'); break;
        case 2:
            for (let k = 0; k < 2; k++) {
                const hx = w * (.3 + k * .38), hy = h * (.55 - k * .1), col = PASTEL[(n + k * 2) % 6];
                c.fillStyle = col; c.beginPath(); c.ellipse(hx, hy, w * .12, h * .13, 0, 0, TAU); c.fill();
                for (let f = 0; f < 5; f++) { const a = -2.6 + f * .45; c.beginPath(); c.ellipse(hx + Math.cos(a) * w * .17, hy + Math.sin(a) * h * .2, w * .035, h * .07, a + Math.PI / 2, 0, TAU); c.fill(); }
            } break;
        case 3:
            dot(c, w * .85, h * .15, w * .08, '#f0c24b');
            for (let k = 0; k < 3; k++) {
                const fx = w * (.22 + k * .28), s = 1 - k * .2; c.strokeStyle = PASTEL[(k + n) % 6];
                dot(c, fx, h * (.36 + k * .05), w * .06 * s, PASTEL[(k + n) % 6]);
                c.beginPath(); c.moveTo(fx, h * (.42 + k * .05)); c.lineTo(fx, h * .72); c.moveTo(fx - w * .08 * s, h * .55); c.lineTo(fx + w * .08 * s, h * .55);
                c.moveTo(fx, h * .72); c.lineTo(fx - w * .06, h * .88); c.moveTo(fx, h * .72); c.lineTo(fx + w * .06, h * .88); c.stroke();
            } break;
        case 4:
            c.fillStyle = '#7cb36a'; c.fillRect(0, h * .85, w, h * .15);
            for (let k = 0; k < 3; k++) {
                const fx = w * (.2 + k * .3), fy = h * (.35 + r(k) * .2); c.strokeStyle = '#4e8a4a'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, h * .86); c.stroke();
                for (let q = 0; q < 6; q++) dot(c, fx + Math.cos(q) * w * .07, fy + Math.sin(q) * w * .07, w * .05, PASTEL[(k + n) % 6]);
                dot(c, fx, fy, w * .04, '#f0c24b');
            } break;
        default:
            for (let k = 0; k < 7; k++) { c.fillStyle = PASTEL[(k + n) % 6] + 'cc'; c.beginPath(); c.ellipse(w * r(k), h * r(k + 20), w * (.08 + r(k + 40) * .12), h * (.06 + r(k + 60) * .1), r(k + 80) * 3, 0, TAU); c.fill(); }
    }
    c.restore();
}
function letterCard(c, x, y, w, h, i) {
    const col = ['#e48e6e', '#7fb3a5', '#dba55d', '#88a9bf', '#b48d99', '#9fbf72'][i % 6];
    c.fillStyle = '#fffaf0'; rrect(c, x, y, w, h, 8); c.fill(); c.fillStyle = col; c.fillRect(x + 6, y + 6, w - 12, h * .52);
    const cx = x + w / 2, cy = y + h * .32, s = Math.min(w, h) * .2; c.fillStyle = '#fffaf0';
    switch (i % 6) {
        case 0: dot(c, cx, cy, s, '#fffaf0'); break;
        case 1: c.beginPath(); c.moveTo(cx - s, cy + s); c.lineTo(cx, cy - s); c.lineTo(cx + s, cy + s); c.fill(); break;
        case 2: c.fillRect(cx - s * .9, cy - s * .9, s * 1.8, s * 1.8); break;
        case 3: c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? s * .45 : s; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.fill(); break;
        case 4: dot(c, cx - s * .45, cy - s * .2, s * .55, '#fffaf0'); dot(c, cx + s * .45, cy - s * .2, s * .55, '#fffaf0'); c.beginPath(); c.moveTo(cx - s, cy); c.lineTo(cx, cy + s); c.lineTo(cx + s, cy); c.fill(); break;
        default: c.strokeStyle = '#fffaf0'; c.lineWidth = 4; c.beginPath(); for (let k = 0; k <= 20; k++) c.lineTo(cx - s + k * s / 10, cy + Math.sin(k * .9) * s * .4); c.stroke();
    }
    write(c, String.fromCharCode(65 + i) + String.fromCharCode(97 + i), cx, y + h * .78, Math.round(h * .26), '#45585c');
}
function face(c, x, y, r, mood, color) {
    dot(c, x, y, r, color); c.strokeStyle = '#3d4b4f'; c.lineWidth = Math.max(2, r * .09); c.lineCap = 'round';
    dot(c, x - r * .33, y - r * .2, r * .09, '#3d4b4f'); dot(c, x + r * .33, y - r * .2, r * .09, '#3d4b4f');
    c.beginPath();
    if (mood === 0) c.arc(x, y + r * .05, r * .45, .3, Math.PI - .3);
    else if (mood === 1) c.arc(x, y + r * .6, r * .4, Math.PI + .5, TAU - .5);
    else if (mood === 2) { c.moveTo(x - r * .35, y + r * .35); c.lineTo(x + r * .35, y + r * .35); }
    else if (mood === 3) { c.arc(x, y + r * .1, r * .45, 0, Math.PI); c.closePath(); }
    else if (mood === 4) { c.moveTo(x - r * .3, y + r * .35); c.quadraticCurveTo(x, y + r * .25, x + r * .3, y + r * .4); }
    else c.arc(x, y + r * .4, r * .16, 0, TAU);
    c.stroke();
}

// ---- Boards (planning board, redrawn per daypart: variant = phase index) --
function drawBoardKG(c, W, H, v) {
    c.fillStyle = '#efe2c6'; c.fillRect(0, 0, W, H); paperNoise(c, W, H, 900, '#9b7a5018');
    write(c, 'OUR DAY', 28, 40, 28, '#b9803f', 'left');
    // Weather: sun, cloud, rain, with today's peg.
    const today = [0, 0, 1, 1, 2][v] ?? 0;
    for (let n = 0; n < 3; n++) {
        const x = 30 + n * 112, y = 74; c.fillStyle = n === today ? '#fff6dc' : '#f8f1e1'; rrect(c, x, y, 100, 100, 10); c.fill();
        if (n === today) { c.strokeStyle = '#dba55d'; c.lineWidth = 5; rrect(c, x, y, 100, 100, 10); c.stroke(); }
        if (n === 0) { dot(c, x + 50, y + 50, 22, '#f0c24b'); c.strokeStyle = '#f0c24b'; c.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = k * TAU / 8; c.beginPath(); c.moveTo(x + 50 + Math.cos(a) * 28, y + 50 + Math.sin(a) * 28); c.lineTo(x + 50 + Math.cos(a) * 38, y + 50 + Math.sin(a) * 38); c.stroke(); } }
        else { dot(c, x + 38, y + 52, 18, '#b8c7d1'); dot(c, x + 58, y + 44, 22, '#c7d4dc'); dot(c, x + 72, y + 56, 15, '#b8c7d1'); c.fillStyle = '#c7d4dc'; c.fillRect(x + 30, y + 52, 50, 18); if (n === 2) { c.fillStyle = '#4f8fc0'; for (let k = 0; k < 4; k++) c.fillRect(x + 32 + k * 13, y + 76 + k % 2 * 6, 4, 12); } }
    }
    // Days of the week strips with today's marker.
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    days.forEach((d, n) => { const x = 380 + n * 74; c.fillStyle = ['#e48e6e', '#f0c24b', '#7fb3a5', '#88a9bf', '#b48d99'][n]; rrect(c, x, 74, 66, 150, 8); c.fill(); write(c, d, x + 33, 96, 15, '#fffaf0'); textLines(c, x + 10, 124, 46, 4, 18, '#fffaf0aa', 4); if (n === 2) { c.strokeStyle = '#4b5d61'; c.lineWidth = 4; rrect(c, x - 4, 70, 74, 158, 10); c.stroke(); } });
    // Seasons and counting cues.
    ['#9fbf72', '#f0c24b', '#e48e6e', '#88a9bf'].forEach((col, n) => { dot(c, 60 + n * 82, 232, 26, col); });
    write(c, 'spring  summer  autumn  winter', 30, 272, 14, '#7b6a55', 'left');
    for (let n = 1; n <= 10; n++) { const x = 380 + (n - 1) * 37; write(c, String(n), x + 12, 258, 18, '#566b65'); for (let k = 0; k < n; k++) dot(c, x + 4 + k % 3 * 9, 278 + Math.floor(k / 3) * 9, 3.4, PASTEL[n % 6]); }
    write(c, 'ERGOFLEX  /  LEARNING & WORKSPACE CONCEPT', 30, H - 58, 12, '#8a7c66', 'left', '400');
}
function drawBoardPrimary(c, W, H, spec, v) {
    boardFrame(c, W, H, spec, { young: true }); reset(c);
    const heads = ['READ', 'EXPLORE', 'CREATE'], cols = ['#5d8b78', '#e0b45e', '#88a9bf'];
    heads.forEach((head, n) => {
        const x = 30 + n * 240, y = 70; c.fillStyle = '#fffaf0'; rrect(c, x, y, 222, 250, 10); c.fill();
        c.fillStyle = cols[n]; rrect(c, x, y, 222, 44, 10); c.fill(); write(c, head, x + 111, y + 23, 20, '#fffaf0');
        if ((v + 1) % 3 === n) { c.strokeStyle = cols[n]; c.lineWidth = 5; rrect(c, x - 3, y - 3, 228, 256, 12); c.stroke(); }
        const cx = x + 111, cy = y + 110;
        if (n === 0) { c.fillStyle = '#5d8b78'; c.fillRect(cx - 60, cy - 30, 56, 70); c.fillRect(cx + 4, cy - 30, 56, 70); textLines(c, cx - 52, cy - 18, 40, 5, 11, '#fffaf0', 3); textLines(c, cx + 12, cy - 18, 40, 5, 11, '#fffaf0', 3); }
        if (n === 1) { c.strokeStyle = '#a07a3c'; c.lineWidth = 9; c.beginPath(); c.arc(cx - 10, cy - 8, 30, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(cx + 12, cy + 14); c.lineTo(cx + 46, cy + 48); c.stroke(); dot(c, cx - 10, cy - 8, 22, '#cfe6ef'); }
        if (n === 2) { for (let k = 0; k < 4; k++) dot(c, cx - 45 + k * 30, cy + Math.sin(k) * 18, 16, PASTEL[k]); c.fillStyle = '#7b5a3a'; c.save(); c.translate(cx + 40, cy + 20); c.rotate(-.7); c.fillRect(-4, -50, 8, 70); c.fillStyle = '#e0b45e'; c.fillRect(-6, -62, 12, 16); c.restore(); }
        textLines(c, x + 24, y + 182, 174, 3, 18, '#93a19a', 4);
    });
}
const CYCLE = ['EMPATHISE', 'DEFINE', 'IDEATE', 'PROTOTYPE', 'TEST'];
function drawBoardMiddle(c, W, H, spec, v) {
    boardFrame(c, W, H, spec); reset(c);
    c.fillStyle = '#f7f8f4'; c.fillRect(24, 64, W - 48, H - 130);
    const cx = W * .3, cy = 196, R = 98;
    CYCLE.forEach((label, n) => {
        const a = -Math.PI / 2 + n * TAU / 5, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, b = a + TAU / 5;
        c.strokeStyle = '#9cb6bd'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, a + .32, b - .32); c.stroke();
        const ex = cx + Math.cos(b - .32) * R, ey = cy + Math.sin(b - .32) * R; dot(c, ex, ey, 4, '#9cb6bd');
        const hot = n === v % 5; dot(c, x, y, 36, hot ? '#e07a3f' : ['#498698', '#6aa0ad', '#88b5be', '#5f8f9a', '#3e6f7c'][n]);
        write(c, label.slice(0, 4), x, y, 12, '#ffffff');
    });
    write(c, 'design cycle', cx, cy, 14, '#5c7479');
    // Sticky ideas and a simple street plan.
    for (let n = 0; n < 12; n++) { const x = 330 + n % 4 * 62, y = 80 + Math.floor(n / 4) * 58; c.fillStyle = ['#f6d76b', '#9fd3c7', '#f4a6a0', '#b8d38f'][n % 4]; c.save(); c.translate(x, y); c.rotate((rnd(n) - .5) * .12); c.fillRect(0, 0, 50, 46); textLines(c, 6, 12, 36, 3, 9, '#5c6466aa', 2); c.restore(); }
    c.strokeStyle = '#7c9196'; c.lineWidth = 2; c.strokeRect(590, 80, 150, 166);
    c.fillStyle = '#b8d38f'; c.fillRect(600, 92, 50, 50); c.fillStyle = '#c4d1d6'; c.fillRect(660, 92, 70, 30); c.fillRect(660, 130, 30, 106); c.fillStyle = '#7fb6d6'; c.fillRect(700, 130, 30, 106);
    c.fillStyle = '#e0b45e'; c.fillRect(600, 152, 50, 84);
}
function drawBoardHigh(c, W, H, spec, v) {
    boardFrame(c, W, H, spec); reset(c);
    boardGrid(c, W, H, spec); boardCurve(c, W, H, spec, v, 'E = P × t'); reset(c);
    // A small circuit sketch in the corner.
    c.strokeStyle = '#d9a441'; c.lineWidth = 3; c.strokeRect(560, 92, 160, 110);
    c.beginPath(); for (let k = 0; k < 7; k++) c.lineTo(600 + k * 12, 92 + (k % 2 ? -10 : 10)); c.stroke();
    dot(c, 720, 147, 12, '#567081'); write(c, 'V', 720, 147, 12, '#ffffff'); c.fillStyle = '#567081'; c.fillRect(556, 130, 8, 34);
    write(c, 'R = V / I', 640, 228, 16, '#567081');
}
function drawBoardCollege(c, W, H, spec, v) {
    boardFrame(c, W, H, spec); reset(c);
    const steps = ['FRAME', 'RESEARCH', 'BUILD', 'TEST', 'SHARE'];
    steps.forEach((s, n) => {
        const x = 30 + n * 144; c.fillStyle = n <= v ? '#866653' : '#c9b08f'; rrect(c, x, 72, 128, 36, 6); c.fill(); write(c, s, x + 64, 90, 14, '#fff8ee');
        for (let k = 0; k < 3; k++) { c.fillStyle = ['#f6d76b', '#f4b6a0', '#cfe0c3', '#c6d7e6'][(n + k) % 4]; c.save(); c.translate(x + 14 + k % 2 * 52, 124 + k * 54); c.rotate((rnd(n * 3 + k) - .5) * .1); c.fillRect(0, 0, 58, 46); textLines(c, 6, 12, 44, 3, 9, '#5c6466aa', 2); c.restore(); }
    });
    c.strokeStyle = '#a5624a'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 300); for (let k = 0; k < 6; k++) c.lineTo(80 + k * 120, 300 - k * 8 - (k % 2) * 10); c.stroke();
}
function drawBoardUniversity(c, W, H, spec, v) {
    boardFrame(c, W, H, spec); reset(c);
    write(c, 'SEMINAR · WEEK ' + (7 + v), 30, 84, 16, '#285c4b', 'left');
    textLines(c, 30, 108, 280, 6, 18, '#7d8b86', 4);
    const boxes = ['QUESTION', 'METHOD', 'EVIDENCE', 'CLAIM'];
    boxes.forEach((b, n) => { const x = 350 + n % 2 * 190, y = 78 + Math.floor(n / 2) * 116; c.strokeStyle = '#285c4b'; c.lineWidth = 3; c.strokeRect(x, y, 170, 92); write(c, b, x + 85, y + 20, 14, '#285c4b'); textLines(c, x + 14, y + 42, 140, 3, 14, '#9aa59f', 3); });
    c.strokeStyle = '#b39b6a'; c.lineWidth = 3; c.beginPath(); c.moveTo(520, 124); c.lineTo(540, 124); c.moveTo(445, 170); c.lineTo(445, 194); c.stroke();
    c.font = 'italic 20px serif'; c.fillStyle = '#285c4b'; c.textAlign = 'left'; c.fillText('Hypothesis → Exploration → Discovery', 30, 300, 330);
}
export function drawBoard(c, W, H, spec, variant = 0) {
    reset(c);
    if (spec.id === 'kindergarten') drawBoardKG(c, W, H, variant);
    else if (spec.id === 'elementary') drawBoardPrimary(c, W, H, spec, variant);
    else if (spec.id === 'middleschool') drawBoardMiddle(c, W, H, spec, variant);
    else if (spec.id === 'highschool') drawBoardHigh(c, W, H, spec, variant);
    else if (spec.id === 'college') drawBoardCollege(c, W, H, spec, variant);
    else drawBoardUniversity(c, W, H, spec, variant);
    reset(c);
}

// ---- Presentation screens (generic illustrative content) ---------------
function slideCity(c, W, H, n) {
    const x0 = 30, y0 = 58, w = W - 60, h = H - 110;
    c.fillStyle = '#e7efe8'; c.fillRect(x0, y0, w, h);
    if (n === 0) { // city map
        c.fillStyle = '#7fb6d6'; c.beginPath(); c.moveTo(x0, y0 + h * .7); c.bezierCurveTo(x0 + w * .3, y0 + h * .5, x0 + w * .6, y0 + h * .95, x0 + w, y0 + h * .75); c.lineTo(x0 + w, y0 + h * .85); c.bezierCurveTo(x0 + w * .6, y0 + h, x0 + w * .3, y0 + h * .62, x0, y0 + h * .8); c.fill();
        for (let k = 0; k < 18; k++) { c.fillStyle = k % 5 === 0 ? '#9fcb8a' : '#c4ccd0'; c.fillRect(x0 + 20 + k % 6 * w / 6.3, y0 + 18 + Math.floor(k / 6) * h * .19, w / 7.5, h * .14); }
    } else if (n === 1) { // transit lines
        const cols = ['#e07a3f', '#498698', '#8a6cc0'];
        cols.forEach((col, k) => { c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 + 20, y0 + 40 + k * 60); c.lineTo(x0 + w * .4, y0 + 40 + k * 60); c.lineTo(x0 + w * .55, y0 + h * .5); c.lineTo(x0 + w - 20, y0 + h * .5 + (k - 1) * 70); c.stroke(); for (let s = 0; s < 5; s++) dot(c, x0 + 40 + s * w * .2, s < 2 ? y0 + 40 + k * 60 : y0 + h * .5 + (k - 1) * 70 * (s - 2) / 2, 8, '#ffffff'); });
    } else if (n === 2) { // solar roofs
        dot(c, x0 + w * .82, y0 + 50, 30, '#f0c24b');
        for (let k = 0; k < 3; k++) { const bx = x0 + 40 + k * 190; c.fillStyle = '#c4ccd0'; c.fillRect(bx, y0 + h * .55, 150, h * .4); c.fillStyle = '#2f4f6a'; c.beginPath(); c.moveTo(bx - 10, y0 + h * .56); c.lineTo(bx + 75, y0 + h * .3); c.lineTo(bx + 160, y0 + h * .56); c.fill(); c.strokeStyle = '#9fc4dd'; c.lineWidth = 1; for (let q = 1; q < 6; q++) { c.beginPath(); c.moveTo(bx + q * 28, y0 + h * .55); c.lineTo(bx + 75, y0 + h * .31); c.stroke(); } }
    } else { // green park
        c.fillStyle = '#9fcb8a'; c.fillRect(x0, y0, w, h); c.strokeStyle = '#efe5c8'; c.lineWidth = 12; c.beginPath(); c.moveTo(x0, y0 + h * .8); c.bezierCurveTo(x0 + w * .4, y0 + h * .2, x0 + w * .6, y0 + h, x0 + w, y0 + h * .3); c.stroke();
        for (let k = 0; k < 14; k++) dot(c, x0 + 30 + rnd(k) * (w - 60), y0 + 20 + rnd(k + 9) * (h - 40), 14 + rnd(k + 4) * 10, k % 2 ? '#5e9a5a' : '#4d8752');
        c.fillStyle = '#7fb6d6'; c.beginPath(); c.ellipse(x0 + w * .7, y0 + h * .65, 70, 34, 0, 0, TAU); c.fill();
    }
}
function slideChart(c, W, H, n, accent) {
    const x0 = 40, y0 = 70, w = W - 80, h = H - 130;
    c.fillStyle = '#16303a'; c.fillRect(x0, y0, w, h); c.strokeStyle = '#3d5a64'; c.lineWidth = 1;
    for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(x0, y0 + k * h / 5); c.lineTo(x0 + w, y0 + k * h / 5); c.stroke(); }
    if (n % 2 === 0) for (let k = 0; k < 8; k++) { c.fillStyle = k % 3 ? '#7ec4ba' : accent; const bh = h * (.25 + rnd(k + n * 9) * .6); c.fillRect(x0 + 20 + k * (w - 40) / 8, y0 + h - bh, (w - 40) / 8 - 14, bh); }
    else { c.strokeStyle = '#e0b45e'; c.lineWidth = 4; c.beginPath(); for (let k = 0; k <= 40; k++) c.lineTo(x0 + k * w / 40, y0 + h * (.8 - .6 * (1 - Math.exp(-k / 12))) + Math.sin(k) * 4); c.stroke(); for (let k = 0; k < 12; k++) dot(c, x0 + rnd(k) * w, y0 + h * (.2 + rnd(k + 5) * .6), 4, '#9fd3c7'); }
}
export function drawScreen(c, W, H, spec, variant = 0, phase = 'morning') {
    reset(c);
    const i = Math.max(0, PHASES.indexOf(phase));
    const titles = { kindergarten: 'OUR DAY', elementary: 'CLASS SHOWCASE', middleschool: 'DESIGN A BETTER CITY', highschool: 'ENERGY SYSTEMS', college: 'TEAM PROJECTS', university: 'SYMPOSIUM' };
    screenHeader(c, W, H, (titles[spec.id] || 'LEARNING') + (variant ? `  ·  ${variant + 1}` : ''));
    reset(c);
    if (spec.id === 'middleschool') {
        if (i === 4) { c.fillStyle = '#e07a3f'; c.fillRect(30, 58, W - 60, H - 110); write(c, 'SHOWCASE', W / 2, H / 2 - 20, 56, '#fff6ec'); write(c, 'student city prototypes', W / 2, H / 2 + 34, 20, '#fff6ec', 'center', '400'); }
        else slideCity(c, W, H, (i + variant) % 4);
    } else if (spec.id === 'highschool') slideChart(c, W, H, i + variant, '#d9a441');
    else if (spec.id === 'college') {
        slideChart(c, W, H, i + variant, '#a5624a');
        c.fillStyle = '#f2e6d8'; c.fillRect(W - 220, 80, 160, 90); write(c, 'TEAM ' + (variant + 1), W - 140, 108, 20, '#866653'); textLines(c, W - 205, 132, 130, 3, 11, '#a5624a', 3);
    } else {
        slideChart(c, W, H, i + variant + 1, '#b39b6a');
        c.font = '600 22px sans-serif'; c.fillStyle = '#dae8e3'; c.textAlign = 'left'; c.fillText(variant ? 'Findings and discussion' : 'Shared discovery: methods and data', 54, 104, W - 120);
    }
    reset(c); screenFooter(c, W, H, spec, phase); reset(c);
}

// ---- Wall content -------------------------------------------------------
function drawFrieze(c, W, H) { c.fillStyle = '#f0e7d6'; c.fillRect(0, 0, W, H); const n = 26, cw = W / n; for (let i = 0; i < n; i++) letterCard(c, i * cw + 3, 2, cw - 6, H - 4, i); }
function drawFeelings(c, W, H) {
    c.fillStyle = '#fbf3e2'; c.fillRect(0, 0, W, H); c.strokeStyle = '#dba55d'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10);
    write(c, 'How are you', W / 2, 46, 30, '#9a6a3a'); write(c, 'feeling?', W / 2, 82, 30, '#9a6a3a');
    const cols = ['#f0c24b', '#88a9bf', '#9fbf72', '#e48e6e', '#c9b6d6', '#f2a35e'];
    for (let n = 0; n < 6; n++) { const x = W * (.28 + n % 2 * .44), y = 150 + Math.floor(n / 2) * (H - 170) / 3; face(c, x, y, W * .13, n, cols[n]); for (let k = 0; k < 2 + n % 2; k++) { c.fillStyle = PASTEL[(n + k) % 6]; c.fillRect(x + W * .15 + k * 12, y - 20 + k * 10, 9, 28); } }
}
function drawChildArtWall(c, W, H) {
    c.fillStyle = '#f0e7d6'; c.fillRect(0, 0, W, H);
    // Numbers 1–10 with dots above the painting line.
    for (let n = 1; n <= 10; n++) { const x = (n - .5) * W / 10, col = PASTEL[n % 6]; c.fillStyle = col; rrect(c, x - W / 24, 6, W / 12, H * .17, 8); c.fill(); write(c, String(n), x - W / 70, 6 + H * .085, H * .1, '#fffaf0'); for (let k = 0; k < n; k++) dot(c, x + W / 70 + (k % 2) * 9, 16 + Math.floor(k / 2) * 9, 3.5, '#fffaf0'); }
    // Two wires of six A4 paintings.
    for (let row = 0; row < 2; row++) {
        const y = H * (.27 + row * .37), wireY = y - 6;
        c.strokeStyle = '#6f6458'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, wireY); c.quadraticCurveTo(W / 2, wireY + 10, W, wireY); c.stroke();
        for (let n = 0; n < 6; n++) { const x = 12 + n * (W - 24) / 6, pw = (W - 24) / 6 - 18, ph = H * .32; c.save(); c.translate(x + pw / 2, y + ph / 2); c.rotate((rnd(n + row * 7) - .5) * .06); childPainting(c, -pw / 2, -ph / 2, pw, ph, n + row * 6); c.restore(); c.fillStyle = '#c99a5b'; c.fillRect(x + pw / 2 - 5, y - 10, 10, 16); }
    }
}
function drawFamilyTree(c, W, H) {
    c.fillStyle = '#f6efe0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8d6a4a'; c.fillRect(W * .44, H * .45, W * .12, H * .5); c.strokeStyle = '#8d6a4a'; c.lineCap = 'round';
    for (let k = 0; k < 5; k++) { c.lineWidth = 14 - k; c.beginPath(); c.moveTo(W * .5, H * .55); c.lineTo(W * (.15 + k * .175), H * (.2 + (k % 2) * .08)); c.stroke(); }
    for (let k = 0; k < 16; k++) dot(c, W * (.1 + rnd(k) * .8), H * (.08 + rnd(k + 30) * .4), W * (.07 + rnd(k + 60) * .06), ['#9fbf72', '#7fb3a5', '#b9d38f'][k % 3] + 'cc');
    for (let n = 0; n < 10; n++) {
        const x = W * (.14 + (n % 4) * .24) - (Math.floor(n / 4) === 2 ? -W * .12 : 0), y = H * (.12 + Math.floor(n / 4) * .2), s = W * .14;
        c.fillStyle = '#c99a5b'; c.fillRect(x - s / 2 - 4, y - s / 2 - 4, s + 8, s * 1.1 + 8); c.fillStyle = ['#e9eef0', '#f3e6d6', '#e6efe3'][n % 3]; c.fillRect(x - s / 2, y - s / 2, s, s * 1.1);
        for (let q = 0; q < 1 + n % 3; q++) { const fx = x - s * .2 + q * s * .2; dot(c, fx, y - s * .05, s * .1, '#7b8c94'); c.fillStyle = '#7b8c94'; c.beginPath(); c.ellipse(fx, y + s * .4, s * .15, s * .2, 0, Math.PI, TAU); c.fill(); }
    }
    write(c, 'OUR FAMILIES', W / 2, H - 26, Math.round(W * .07), '#8d6a4a');
}
function drawWordWall(c, W, H) {
    c.fillStyle = '#e8eddc'; c.fillRect(0, 0, W, H);
    write(c, 'WORD WALL', 20, 26, 26, '#5d8b78', 'left');
    const n = 13, cw = (W - 30) / n;
    for (let col = 0; col < 26; col++) {
        const row = Math.floor(col / n), x = 15 + (col % n) * cw, y = 52 + row * (H - 60) / 2;
        c.fillStyle = ['#5d8b78', '#e0b45e', '#88a9bf', '#d58f6c'][col % 4]; rrect(c, x + 4, y, cw - 8, 40, 6); c.fill();
        write(c, String.fromCharCode(65 + col), x + cw / 2, y + 21, 26, '#fffaf0');
        for (let k = 0; k < 4; k++) { c.fillStyle = '#fffdf6'; c.fillRect(x + 6, y + 48 + k * 30, cw - 12, 24); c.fillStyle = '#6e7d7a'; c.fillRect(x + 12, y + 58 + k * 30, (cw - 30) * (.5 + rnd(col * 4 + k) * .45), 4); }
    }
}
function drawNumberLine(c, W, H) {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, W, H); c.strokeStyle = '#4b5d61'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, H * .55); c.lineTo(W - 14, H * .55); c.stroke();
    for (let n = 0; n <= 20; n++) { const x = 30 + n * (W - 60) / 20; c.fillStyle = n % 5 === 0 ? '#5d8b78' : '#4b5d61'; c.fillRect(x - 1.5, H * .4, 3, H * .3); write(c, String(n), x, H * .84, H * .26, n % 5 === 0 ? '#5d8b78' : '#4b5d61'); if (n < 20 && n % 2 === 0) { c.strokeStyle = PASTEL[n % 6]; c.lineWidth = 3; c.beginPath(); c.arc(x + (W - 60) / 20, H * .42, (W - 60) / 20, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); } }
}
function drawJobs(c, W, H) {
    c.fillStyle = '#5d8b78'; c.fillRect(0, 0, W, H); write(c, 'CLASS JOBS', W / 2, 34, 30, '#fffaf0');
    for (let n = 0; n < 12; n++) { const x = 16 + n % 3 * (W - 32) / 3, y = 64 + Math.floor(n / 3) * (H - 76) / 4, w = (W - 32) / 3 - 12, h = (H - 76) / 4 - 12;
        c.fillStyle = '#fffaf0'; rrect(c, x, y, w, h, 8); c.fill(); dot(c, x + 24, y + h / 2, 15, PASTEL[n % 6]); textLines(c, x + 46, y + 14, w - 60, 2, 10, '#7d8a8c', 3);
        c.fillStyle = ['#f6d76b', '#9fd3c7', '#f4a6a0', '#c6d7e6'][n % 4]; c.fillRect(x + 46, y + h - 22, w - 62, 16); }
}
function drawAnchorCharts(c, W, H) {
    c.fillStyle = '#e9ecdf'; c.fillRect(0, 0, W, H);
    for (let n = 0; n < 3; n++) {
        const x = 10 + n * W / 3, w = W / 3 - 20, y = 18, h = H - 26; c.fillStyle = '#fffdf8'; c.fillRect(x, y, w, h); c.fillStyle = '#3e4b4f'; c.fillRect(x + w * .4, 2, w * .2, 22);
        write(c, ['STORY MAP', 'PLACE VALUE', 'WATER CYCLE'][n], x + w / 2, y + 26, 20, ['#d58f6c', '#5d8b78', '#4f8fc0'][n]);
        if (n === 0) ['beginning', 'middle', 'end'].forEach((s, k) => { c.strokeStyle = PASTEL[k * 2]; c.lineWidth = 3; c.strokeRect(x + 14, y + 52 + k * (h - 70) / 3, w - 28, (h - 70) / 3 - 10); write(c, s, x + 24, y + 66 + k * (h - 70) / 3, 13, '#5c6466', 'left', '400'); textLines(c, x + 24, y + 80 + k * (h - 70) / 3, w - 60, 2, 10, '#a3abab', 2); });
        if (n === 1) ['H', 'T', 'O'].forEach((s, k) => { const cx = x + 20 + k * (w - 40) / 3; write(c, s, cx + (w - 40) / 6, y + 64, 20, '#5d8b78'); for (let q = 0; q < 3 + k * 2; q++) { c.fillStyle = ['#e0b45e', '#88a9bf', '#d58f6c'][k]; if (k === 0) c.fillRect(cx + 8, y + 84 + q * 34, (w - 40) / 3 - 16, 28); else if (k === 1) c.fillRect(cx + 10 + q % 3 * 14, y + 84 + Math.floor(q / 3) * 70, 9, 60); else dot(c, cx + 16 + q % 3 * 16, y + 92 + Math.floor(q / 3) * 18, 6, '#d58f6c'); } });
        if (n === 2) { dot(c, x + w * .78, y + 70, 22, '#f0c24b'); dot(c, x + w * .3, y + 78, 18, '#c7d4dc'); dot(c, x + w * .42, y + 70, 22, '#c7d4dc'); c.fillStyle = '#4f8fc0'; for (let q = 0; q < 4; q++) c.fillRect(x + w * .28 + q * 12, y + 104 + q % 2 * 6, 4, 14); c.fillStyle = '#7fb6d6'; c.fillRect(x + 12, y + h - 50, w - 24, 36); c.strokeStyle = '#4f8fc0'; c.lineWidth = 3; c.beginPath(); c.arc(x + w / 2, y + h * .55, w * .3, Math.PI * .1, Math.PI * .9, true); c.stroke(); }
    }
}
function drawWritingLine(c, W, H) {
    c.fillStyle = '#e9ecdf'; c.fillRect(0, 0, W, H); c.strokeStyle = '#6f6458'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(W / 2, 30, W, 12); c.stroke();
    for (let n = 0; n < 10; n++) { const pw = W / 10 - 12, x = 6 + n * W / 10, y = 22 + Math.sin(n / 9 * Math.PI) * 9; c.save(); c.translate(x + pw / 2, y); c.rotate((rnd(n) - .5) * .08); c.fillStyle = '#fffdf8'; c.fillRect(-pw / 2, 0, pw, H - 34);
        childPainting(c, -pw / 2 + 6, 6, pw - 12, (H - 34) * .38, n + 3); c.fillStyle = '#9fb7c9'; for (let k = 0; k < 6; k++) c.fillRect(-pw / 2 + 6, (H - 34) * .48 + k * 12, pw - 12, 1);
        c.fillStyle = '#4b5d61'; for (let k = 0; k < 5; k++) c.fillRect(-pw / 2 + 8, (H - 34) * .48 + k * 12 - 5, (pw - 20) * (.5 + rnd(n * 5 + k) * .5), 3); c.fillStyle = '#c99a5b'; c.fillRect(-4, -6, 8, 14); c.restore(); }
}
function drawWeatherPoster(c, W, H) {
    c.fillStyle = '#eef3ea'; c.fillRect(0, 0, W, H); write(c, 'OUR WEATHER', W / 2, 36, 28, '#5d8b78');
    c.fillStyle = '#ffffff'; rrect(c, 30, 70, 50, H - 110, 24); c.fill(); dot(c, 55, H - 60, 30, '#d9534f'); c.fillStyle = '#d9534f'; c.fillRect(48, 140, 14, H - 200);
    for (let k = 0; k < 7; k++) { const x = 110 + k * (W - 140) / 7, h = 40 + rnd(k) * (H - 190); c.fillStyle = ['#f0c24b', '#88a9bf', '#7fb6d6'][k % 3]; c.fillRect(x, H - 50 - h, (W - 140) / 7 - 10, h); }
    dot(c, W - 60, 90, 24, '#f0c24b');
}
function drawExitSign(c, W, H) { c.fillStyle = '#2f8a57'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.fillRect(W * .12, H * .2, W * .2, H * .6); dot(c, W * .48, H * .28, H * .1, '#ffffff'); c.fillRect(W * .44, H * .38, W * .07, H * .3); c.beginPath(); c.moveTo(W * .62, H * .3); c.lineTo(W * .88, H * .5); c.lineTo(W * .62, H * .7); c.fill(); }
function drawSkillsGrid(c, W, H, spec) {
    c.fillStyle = '#f4f6f2'; c.fillRect(0, 0, W, H); write(c, 'FUTURE-READY SKILLS', 24, 30, 24, spec.accent, 'left');
    const sym = ['Co', 'Cr', 'Cm', 'Ct', 'Em', 'Re', 'Pl', 'Re', 'Iq', 'Ds', 'Ma', 'Pr', 'Lo', 'Te', 'Ev', 'Mo', 'Ri', 'Su', 'Cu', 'Gr', 'Fe', 'Sy', 'Da', 'Ex'];
    const cols = ['#498698', '#e07a3f', '#7fb6a5', '#e0b45e', '#8a6cc0', '#5f8f9a'];
    for (let n = 0; n < 24; n++) { const x = 20 + n % 6 * (W - 40) / 6, y = 54 + Math.floor(n / 6) * (H - 64) / 4, w = (W - 40) / 6 - 8, h = (H - 64) / 4 - 8; c.fillStyle = cols[(n + Math.floor(n / 6)) % 6]; c.fillRect(x, y, w, h); write(c, String(n + 1), x + 10, y + 13, 11, '#ffffffcc', 'left', '400'); write(c, sym[n], x + w / 2, y + h * .52, h * .38, '#ffffff'); c.fillStyle = '#ffffffaa'; c.fillRect(x + w * .2, y + h * .8, w * .6, 3); }
}
function drawStickyPatch(c, W, H) {
    c.fillStyle = '#f7f8f4'; c.fillRect(0, 0, W, H); c.strokeStyle = '#b9c6c9'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    write(c, 'BRAINSTORM: what makes a city better?', 24, 30, 20, '#498698', 'left');
    const centres = [[.22, .4], [.6, .36], [.3, .76], [.74, .74]];
    centres.forEach(([cx, cy], g) => { c.strokeStyle = '#7c9196'; c.lineWidth = 2; c.beginPath(); c.arc(W * cx, H * cy, 50, 0, TAU); c.stroke(); });
    for (let n = 0; n < 30; n++) { const [cx, cy] = centres[n % 4], a = n * 2.4, r = 30 + (n % 3) * 34; c.save(); c.translate(W * cx + Math.cos(a) * r * 1.4, H * cy + Math.sin(a) * r * .8); c.rotate((rnd(n) - .5) * .25); c.fillStyle = ['#f6d76b', '#9fd3c7', '#f4a6a0', '#b8d38f'][n % 4]; c.fillRect(-26, -24, 52, 48); textLines(c, -20, -12, 40, 3, 10, '#5c6466aa', 2); c.restore(); }
}
function cityPoster(c, x, y, w, h, n) {
    c.save(); c.translate(x, y); c.fillStyle = '#fdfcf7'; c.fillRect(0, 0, w, h);
    c.fillStyle = ['#498698', '#e07a3f', '#5f8f9a', '#6aa56a', '#e0b45e', '#4f8fc0'][n]; c.fillRect(0, 0, w, h * .14);
    write(c, ['GREEN STREETS', 'CITY TRANSIT', 'SOLAR ROOFS', 'POCKET PARK', 'BIKE LOOP', 'CLEAN RIVER'][n], w / 2, h * .07, w * .085, '#ffffff');
    c.translate(0, h * .16);
    const ih = h * .6;
    c.fillStyle = '#e4eee6'; c.fillRect(w * .06, 0, w * .88, ih);
    for (let k = 0; k < 6; k++) { const bx = w * (.1 + k * .14), bh = ih * (.25 + rnd(k + n * 7) * .5); c.fillStyle = ['#c4ccd0', '#aebcc2', '#d3d8d0'][k % 3]; c.fillRect(bx, ih - bh, w * .11, bh); if (n === 2) { c.fillStyle = '#2f4f6a'; c.fillRect(bx, ih - bh - 6, w * .11, 6); } }
    if (n === 1) { c.strokeStyle = '#e07a3f'; c.lineWidth = 6; c.beginPath(); c.moveTo(w * .06, ih * .3); c.lineTo(w * .5, ih * .55); c.lineTo(w * .94, ih * .4); c.stroke(); }
    if (n === 3 || n === 0) for (let k = 0; k < 5; k++) dot(c, w * (.12 + k * .18), ih * .85, w * .06, '#5e9a5a');
    if (n === 4) { c.strokeStyle = '#4f8fc0'; c.lineWidth = 4; c.beginPath(); c.ellipse(w * .5, ih * .7, w * .35, ih * .18, 0, 0, TAU); c.stroke(); }
    if (n === 5) { c.fillStyle = '#7fb6d6'; c.fillRect(w * .06, ih * .78, w * .88, ih * .22); }
    textLines(c, w * .08, ih + h * .06, w * .84, 3, h * .05, '#8a9597', 3);
    c.restore();
}
function sankey(c, W, H, spec) {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, W, H); write(c, 'ENERGY FLOW', 24, 30, 22, spec.accent, 'left');
    const x0 = 40, x1 = W - 60, top = 70, total = H - 130;
    c.fillStyle = '#d9a441'; c.fillRect(x0, top, 26, total);
    const parts = [[.45, '#567081', 'useful'], [.3, '#d9a441', 'heat'], [.15, '#c97c5d', 'sound'], [.1, '#9aa8b0', 'light']];
    let y = top, outY = top;
    for (const [f, col, label] of parts) {
        const h = total * f, oy = outY; c.fillStyle = col + 'cc'; c.beginPath(); c.moveTo(x0 + 26, y); c.bezierCurveTo(W * .5, y, W * .5, oy, x1, oy); c.lineTo(x1, oy + h); c.bezierCurveTo(W * .5, oy + h, W * .5, y + h, x0 + 26, y + h); c.fill();
        c.fillStyle = col; c.fillRect(x1, oy, 18, h); write(c, label, x1 - 6, oy + h / 2, 13, '#3f4b52', 'right', '400'); y += h; outY += h + 10;
    }
}
function periodic(c, W, H, spec) {
    c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, W, H); write(c, 'PERIODIC TABLE', W / 2, 26, 22, spec.accent);
    const cw = (W - 40) / 18, ch = (H - 70) / 9.4, cols = ['#d97b6a', '#e0a96b', '#e7cf7a', '#9fc38f', '#7fb6c2', '#8f9fcc', '#b39bcc', '#c9c4b8'];
    for (let r = 0; r < 7; r++) for (let g = 0; g < 18; g++) {
        if (r === 0 && g > 0 && g < 17) continue; if ((r === 1 || r === 2) && g > 1 && g < 12) continue;
        const cat = g < 1 ? 0 : g < 2 ? 1 : g < 12 ? 2 : g < 14 ? 3 : g < 16 ? 4 : g < 17 ? 5 : 6;
        c.fillStyle = cols[cat]; c.fillRect(20 + g * cw + 1, 44 + r * ch + 1, cw - 2, ch - 2); c.fillStyle = '#ffffff99'; c.fillRect(20 + g * cw + 4, 44 + r * ch + ch * .45, cw - 8, 2);
    }
    for (let r = 0; r < 2; r++) for (let g = 0; g < 15; g++) { c.fillStyle = cols[7 - r]; c.fillRect(20 + (g + 2.5) * cw + 1, 44 + (7.4 + r) * ch + 1, cw - 2, ch - 2); }
}
function sciencePoster(c, x, y, w, h, n, accent) {
    c.save(); c.translate(x, y); c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
    c.fillStyle = accent; c.fillRect(0, 0, w, h * .1); write(c, ['WIND', 'SOLAR', 'HYDRO', 'CIRCUITS', 'MOTION', 'WAVES'][n], w / 2, h * .05, w * .1, '#ffffff');
    const cx = w / 2, cy = h * .4, s = w * .3; c.strokeStyle = '#3f4b52'; c.lineWidth = Math.max(2, w * .012); c.lineCap = 'round';
    if (n === 0) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + s * 1.3); c.stroke(); for (let k = 0; k < 3; k++) { const a = k * TAU / 3 - .4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); c.stroke(); } }
    if (n === 1) { dot(c, cx + s * .6, cy - s * .6, s * .3, '#d9a441'); c.fillStyle = '#2f4f6a'; c.save(); c.translate(cx - s * .2, cy + s * .3); c.rotate(-.35); c.fillRect(-s * .6, -s * .3, s * 1.2, s * .6); c.restore(); }
    if (n === 2) { c.fillStyle = '#9aa8b0'; c.fillRect(cx - s * .1, cy - s * .7, s * .3, s * 1.5); c.fillStyle = '#7fb6d6'; c.fillRect(cx - s, cy - s * .3, s * .9, s * 1.1); c.fillRect(cx + s * .2, cy + s * .5, s * .8, s * .3); }
    if (n === 3) { c.strokeRect(cx - s, cy - s * .6, s * 2, s * 1.2); c.beginPath(); for (let k = 0; k < 7; k++) c.lineTo(cx - s * .4 + k * s * .13, cy - s * .6 + (k % 2 ? -10 : 10)); c.stroke(); dot(c, cx + s, cy, s * .15, accent); }
    if (n === 4) { c.beginPath(); c.moveTo(cx - s, cy + s); c.lineTo(cx + s, cy + s); c.moveTo(cx - s, cy + s); c.lineTo(cx - s, cy - s); c.stroke(); c.strokeStyle = '#d9a441'; c.beginPath(); for (let k = 0; k <= 20; k++) c.lineTo(cx - s + k * s / 10, cy + s - (k / 20) ** 2 * s * 1.8); c.stroke(); }
    if (n === 5) { c.strokeStyle = '#4f8fc0'; for (let q = 0; q < 2; q++) { c.beginPath(); for (let k = 0; k <= 40; k++) c.lineTo(cx - s + k * s / 20, cy + Math.sin(k * (.5 + q * .3)) * s * (.4 - q * .15) + q * s * .6); c.stroke(); } }
    textLines(c, w * .08, h * .75, w * .84, 4, h * .04, '#8a9597', Math.max(2, h * .008));
    c.restore();
}
function projectPhoto(c, x, y, w, h, n) {
    c.save(); c.translate(x, y); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, ['#cfd8dc', '#e2d4c4', '#d4dccd', '#d8d1df'][n]); g.addColorStop(1, ['#9aa8ad', '#b99f88', '#99a98f', '#a69bb3'][n]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5b4a3e'; c.fillRect(w * .1, h * .72, w * .8, h * .06);
    if (n === 0) { c.fillStyle = '#a5624a'; c.fillRect(w * .3, h * .35, w * .4, h * .37); dot(c, w * .5, h * .3, w * .1, '#e0c9a6'); }
    if (n === 1) { for (let k = 0; k < 4; k++) dot(c, w * (.25 + k * .17), h * .55, w * .07, ['#866653', '#c9b08f', '#a5624a', '#6b5a4c'][k]); }
    if (n === 2) { c.strokeStyle = '#3f4b52'; c.lineWidth = 6; c.beginPath(); c.moveTo(w * .2, h * .72); c.lineTo(w * .5, h * .25); c.lineTo(w * .8, h * .72); c.stroke(); }
    if (n === 3) { c.fillStyle = '#3f4b52'; c.fillRect(w * .25, h * .3, w * .5, h * .32); c.fillStyle = '#7ec4ba'; c.fillRect(w * .28, h * .33, w * .44, h * .26); }
    c.restore();
}
function eventPosters(c, W, H) {
    c.fillStyle = '#e8e4db'; c.fillRect(0, 0, W, H); c.fillStyle = '#6b5a4c'; c.fillRect(0, 0, W, 10);
    for (let n = 0; n < 8; n++) { const w = W / 8 - 14, x = 7 + n * W / 8, y = 22 + (n % 2) * 10, h = H - 36 - (n % 3) * 14; c.fillStyle = ['#a5624a', '#866653', '#d9b27c', '#5f7d72', '#c9b08f', '#8a6c8f', '#4f6f86', '#d58f6c'][n]; c.fillRect(x, y, w, h); c.fillStyle = '#ffffffdd'; c.fillRect(x + 8, y + 10, w - 16, h * .12); dot(c, x + w / 2, y + h * .45, w * .26, '#ffffff55'); textLines(c, x + 8, y + h * .72, w - 16, 3, h * .07, '#ffffffbb', 3); c.fillStyle = '#c0c4c4'; c.fillRect(x + w / 2 - 4, y - 6, 8, 10); }
}
function researchPoster(c, W, H, n) {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#285c4b'; c.fillRect(0, 0, W, H * .11); c.fillStyle = '#e8efe9'; c.fillRect(W * .06, H * .03, W * .7, H * .03); c.fillRect(W * .06, H * .072, W * .45, H * .016);
    dot(c, W * .9, H * .055, W * .04, '#b39b6a');
    const blocks = [[.05, .14, .42, .25], [.53, .14, .42, .25], [.05, .43, .9, .24], [.05, .71, .42, .25], [.53, .71, .42, .25]];
    blocks.forEach(([bx, by, bw, bh], k) => {
        const x = W * bx, y = H * by, w = W * bw, h = H * bh; c.fillStyle = '#285c4b'; c.fillRect(x, y, w * .4, H * .012);
        if ((k + n) % 3 === 0) { for (let q = 0; q < 6; q++) { const v = .25 + rnd(q + n * 11 + k) * .65; c.fillStyle = q % 2 ? '#7fa596' : '#b39b6a'; c.fillRect(x + q * w / 6 + 4, y + h - v * h * .8, w / 6 - 8, v * h * .8); } }
        else if ((k + n) % 3 === 1) { c.strokeStyle = '#9aa59f'; c.lineWidth = 1; c.strokeRect(x, y + h * .1, w, h * .9); for (let q = 0; q < 26; q++) dot(c, x + rnd(q + k) * w, y + h * .2 + rnd(q + 40 + n) * h * .75, 3, q % 3 ? '#285c4b' : '#b39b6a'); }
        else textLines(c, x, y + h * .12, w, Math.floor(h / 16), 12, '#8a9597', 3);
    });
}
// Teacher-corner wall content on the window wall's back bay (seen behind the main desk in hero views).
function timetable(c, W, H, title, accent, tones) {
    c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, W, H); c.fillStyle = accent; c.fillRect(0, 0, W, H * .13); write(c, title, W * .05, H * .067, H * .07, '#ffffff', 'left');
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'], cw = (W * .9) / 5, rh = (H * .76) / 6;
    days.forEach((d, n) => write(c, d, W * .05 + cw * (n + .5), H * .18, H * .038, '#5c6466'));
    for (let r = 0; r < 6; r++) for (let n = 0; n < 5; n++) {
        const x = W * .05 + n * cw, y = H * .22 + r * rh; c.strokeStyle = '#d6d9d4'; c.lineWidth = 1.5; c.strokeRect(x, y, cw, rh);
        if (rnd(r * 5 + n + title.length) < .62) { c.fillStyle = tones[(r + n * 2) % tones.length]; rrect(c, x + 5, y + 5, cw - 10, rh - 10, 6); c.fill(); textLines(c, x + 12, y + rh * .4, cw - 24, 2, rh * .22, '#ffffffcc', 3); }
    }
}
function safetyPoster(c, W, H) {
    c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, W, H); c.fillStyle = '#2f8a57'; c.fillRect(0, 0, W, H * .14); write(c, 'LAB SAFETY', W / 2, H * .07, H * .075, '#ffffff');
    const icons = ['#2a6aa8', '#2a6aa8', '#c2412f', '#2f8a57', '#c2412f', '#d9a441'];
    for (let n = 0; n < 6; n++) {
        const x = W * (.25 + (n % 2) * .5), y = H * (.3 + Math.floor(n / 2) * .24), r = Math.min(W, H) * .1; dot(c, x, y, r, icons[n]); c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = r * .14;
        if (n === 0) { c.beginPath(); c.arc(x - r * .35, y, r * .28, 0, TAU); c.arc(x + r * .35, y, r * .28, 0, TAU); c.stroke(); }
        if (n === 1) { c.fillRect(x - r * .3, y - r * .5, r * .6, r * .9); }
        if (n === 2 || n === 4) { c.beginPath(); c.arc(x, y, r * .62, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x - r * .44, y - r * .44); c.lineTo(x + r * .44, y + r * .44); c.stroke(); }
        if (n === 3) { c.fillRect(x - r * .12, y - r * .55, r * .24, r * 1.1); c.fillRect(x - r * .55, y - r * .12, r * 1.1, r * .24); }
        if (n === 5) { c.beginPath(); c.moveTo(x, y - r * .6); c.lineTo(x + r * .55, y + r * .45); c.lineTo(x - r * .55, y + r * .45); c.closePath(); c.stroke(); }
        textLines(c, x - W * .2, y + r * 1.25, W * .4, 1, 10, '#6b7477', 3);
    }
}
function engraving(c, W, H, n) {
    c.fillStyle = '#f1ead8'; c.fillRect(0, 0, W, H); paperNoise(c, W, H, 1400, '#7a6a5014'); c.strokeStyle = '#3b3328'; c.lineWidth = 2; c.strokeRect(W * .06, H * .05, W * .88, H * .82);
    c.lineWidth = 2.2; const cx = W / 2, cy = H * .45;
    if (n === 0) { // classical portico
        c.beginPath(); c.moveTo(W * .14, H * .3); c.lineTo(cx, H * .14); c.lineTo(W * .86, H * .3); c.closePath(); c.stroke();
        for (let k = 0; k < 6; k++) { const x = W * (.18 + k * .128); c.strokeRect(x, H * .33, W * .05, H * .44); for (let q = 1; q < 4; q++) { c.beginPath(); c.moveTo(x + q * W * .0125, H * .34); c.lineTo(x + q * W * .0125, H * .76); c.stroke(); } }
        c.strokeRect(W * .12, H * .77, W * .76, H * .04);
    } else if (n === 1) { // botanical leaf study
        c.beginPath(); c.moveTo(cx, H * .8); c.quadraticCurveTo(cx - W * .02, cy, cx, H * .12); c.stroke();
        for (let k = 0; k < 7; k++) { const y = H * (.2 + k * .085), s = W * (.16 + Math.sin(k / 6 * Math.PI) * .14); for (const d of [-1, 1]) { c.beginPath(); c.moveTo(cx, y + 18); c.quadraticCurveTo(cx + d * s, y - 10, cx + d * s * 1.2, y - 34); c.quadraticCurveTo(cx + d * s * .5, y + 8, cx, y + 18); c.stroke(); } }
    } else { // orrery
        for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(cx, cy, W * .09 * k, H * .035 * k, -.2, 0, TAU); c.stroke(); dot(c, cx + Math.cos(k * 1.7) * W * .09 * k, cy + Math.sin(k * 1.7) * H * .035 * k, 6 + k, '#3b3328'); }
        dot(c, cx, cy, 16, '#b39b6a'); c.beginPath(); c.moveTo(cx, cy + 16); c.lineTo(cx, H * .74); c.moveTo(cx - W * .14, H * .76); c.lineTo(cx + W * .14, H * .76); c.stroke();
    }
    textLines(c, W * .22, H * .91, W * .56, 1, 10, '#5a5246', 3);
}
function campusMap(c, W, H) {
    c.fillStyle = '#ece6d6'; c.fillRect(0, 0, W, H); c.fillStyle = '#b9cfa6'; c.fillRect(20, 20, W - 40, H - 40);
    c.strokeStyle = '#efe5c8'; c.lineWidth = 12; c.beginPath(); c.moveTo(20, H * .55); c.lineTo(W - 20, H * .45); c.moveTo(W * .4, 20); c.lineTo(W * .55, H - 20); c.stroke();
    for (let k = 0; k < 9; k++) { c.fillStyle = k === 4 ? '#285c4b' : '#a39a88'; c.fillRect(40 + (k % 3) * (W - 80) / 3 + rnd(k) * 20, 40 + Math.floor(k / 3) * (H - 80) / 3 + rnd(k + 5) * 20, (W - 80) / 3 * .55, (H - 80) / 3 * .45); }
    dot(c, W * .48, H * .5, 16, '#7fb6d6'); c.strokeStyle = '#285c4b'; c.lineWidth = 6; c.strokeRect(6, 6, W - 12, H - 12);
    write(c, 'CAMPUS', W - 40, H - 34, 22, '#285c4b', 'right');
}
function drawCircleRug(c, W, H) {
    c.fillStyle = '#a9c5bc'; c.fillRect(0, 0, W, H); const cx = W / 2, cy = H / 2, R = W / 2;
    for (let i = 0; i < 3500; i++) { c.fillStyle = i % 2 ? '#ffffff12' : '#40625a12'; c.fillRect(rnd(i) * W, rnd(i + 3500) * H, 1, 3); }
    c.strokeStyle = '#8fb1a6'; c.lineWidth = 34; c.beginPath(); c.arc(cx, cy, R - 24, 0, TAU); c.stroke();
    c.strokeStyle = '#f1e6cf'; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, R - 52, 0, TAU); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = cx + Math.cos(a) * R * .7, y = cy + Math.sin(a) * R * .7; dot(c, x, y, R * .095, ['#dcaa73', '#6f9fb1', '#b48d99'][i % 3]); c.strokeStyle = '#f7efe0'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, R * .07, 0, TAU); c.stroke(); }
    c.fillStyle = '#e8b443'; for (let k = 0; k < 12; k++) { const a = k * TAU / 12; c.beginPath(); c.moveTo(cx + Math.cos(a - .14) * R * .17, cy + Math.sin(a - .14) * R * .17); c.lineTo(cx + Math.cos(a) * R * .27, cy + Math.sin(a) * R * .27); c.lineTo(cx + Math.cos(a + .14) * R * .17, cy + Math.sin(a + .14) * R * .17); c.fill(); }
    dot(c, cx, cy, R * .17, '#f0c24b');
}
function drawCarpetGrid(c, W, H) {
    c.fillStyle = '#5d8b78'; c.fillRect(0, 0, W, H);
    const cols = ['#e0b45e', '#88a9bf', '#d58f6c', '#9fbf72', '#b48d99', '#7fb3a5'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { c.fillStyle = cols[(r * 2 + k) % 6]; c.fillRect(40 + k * (W - 80) / 6 + 6, 40 + r * (H - 80) / 4 + 6, (W - 80) / 6 - 12, (H - 80) / 4 - 12); }
    for (let i = 0; i < 4000; i++) { c.fillStyle = i % 2 ? '#ffffff10' : '#00000010'; c.fillRect(rnd(i) * W, rnd(i + 4000) * H, 1, 3); }
}
function drawJute(c, W, H) {
    c.fillStyle = '#c8b48a'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 12) { c.fillStyle = (x / 12 + y / 6) % 2 ? '#b9a378' : '#d3c196'; c.fillRect(x + (y / 6 % 2) * 6, y, 8, 5); }
    c.strokeStyle = '#a58f63'; c.lineWidth = 10; c.strokeRect(8, 8, W - 16, H - 16);
}
function drawRoboticsMat(c, W, H) {
    c.fillStyle = '#f2f1ea'; c.fillRect(0, 0, W, H); c.strokeStyle = '#c7cfd0'; c.lineWidth = 1;
    for (let x = 0; x < W; x += W / 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += H / 15) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = '#6aa56a'; c.fillRect(20, H - 90, 90, 70); c.fillStyle = '#e07a3f'; c.fillRect(W - 110, 20, 90, 70);
    c.strokeStyle = '#2f3b44'; c.lineWidth = 10; c.beginPath(); c.moveTo(65, H - 90); c.bezierCurveTo(W * .2, H * .2, W * .6, H * .9, W - 65, 90); c.stroke();
    c.strokeStyle = '#498698'; c.lineWidth = 6; c.strokeRect(4, 4, W - 8, H - 8);
}
function drawRug(color, border = '#efe6d2', inner = true) {
    // Wool: woven rows, tuft noise, a bound border band and fringe at the short ends.
    return (c, W, H) => { c.fillStyle = color; c.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 4) { c.fillStyle = y % 8 ? '#ffffff0a' : '#0000000f'; c.fillRect(0, y, W, 2); }
        for (let i = 0; i < W * H / 40; i++) { c.fillStyle = i % 2 ? '#ffffff14' : '#00000014'; c.fillRect(rnd(i) * W, rnd(i + 2500) * H, 1, 3); }
        c.strokeStyle = border; c.lineWidth = 18; c.strokeRect(26, 26, W - 52, H - 52); if (inner) { c.lineWidth = 3; c.strokeRect(54, 54, W - 108, H - 108); c.setLineDash([10, 8]); c.lineWidth = 2; c.strokeRect(70, 70, W - 140, H - 140); c.setLineDash([]); }
        c.fillStyle = border; for (let x = 4; x < W; x += 6) { c.fillRect(x, 0, 2, 14); c.fillRect(x, H - 14, 2, 14); } };
}
// College team colours (inlay, table flag): terracotta, ochre, sage, slate blue.
const TEAM = ['#80604f', '#8b7653', '#5f7168', '#5c6879'];
// Carpet-tile inlay: 500 mm quarter-turned tiles in one team colour, a darker border row.
function carpetInlay(color, sx, sz) {
    return (c, W, H) => {
        const nx = Math.round(sx / 500), nz = Math.round(sz / 500), tw = W / nx, th = H / nz;
        for (let r = 0; r < nz; r++) for (let k = 0; k < nx; k++) {
            const edge = !r || !k || r === nz - 1 || k === nx - 1, x = k * tw, y = r * th;
            c.fillStyle = shade(color, edge ? -.05 : ((r + k) % 2 ? .008 : -.008)); c.fillRect(x, y, tw, th);
            for (let i = 0; i < tw; i += 3) { c.fillStyle = i % 6 ? '#ffffff05' : '#00000009'; if ((r + k) % 2) c.fillRect(x + i, y, 1.2, th); else c.fillRect(x, y + i, tw, 1.2); }
            c.strokeStyle = '#00000026'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, tw - 1, th - 1);
        }
        for (let i = 0; i < W * H / 14; i++) { c.fillStyle = i % 3 ? '#ffffff12' : '#00000016'; c.fillRect(rnd(i * 1.7) * W, rnd(i * 2.3 + 4) * H, 1.2, 1.2); }
    };
}
function drawPainting(c, W, H) { childPainting(c, 0, 0, W, H, 0); c.fillStyle = '#f0c24b88'; c.beginPath(); c.ellipse(W * .2, H * .8, W * .1, H * .06, 0, 0, TAU); c.fill(); }
function drawPosterSheet(spec) { return (c, W, H) => spec.id === 'university' ? researchPoster(c, W, H, 2) : sankey(c, W, H, spec); }
function drawLectureNotes(c, W, H) { c.fillStyle = '#fbfaf3'; c.fillRect(0, 0, W, H); write(c, 'Lecture 7 · Notes', 20, 26, 22, '#285c4b', 'left'); textLines(c, 20, 56, W - 40, 12, 18, '#7d8784', 3); }

// ---- Surfaces: procedural colour / roughness maps per stage --------------
// Every large surface carries a canvas map at a physical scale. `uvBox`
// writes box-projected UVs in millimetres, so one material covers a 2.5 m
// table and a 0.4 m stool without stretching. Roughness maps are linear.
// Stage palettes follow the brief (education.md §x.4): pale ash and birch
// (kindergarten) → oak, tack-board and lino (elementary) → HPL, write-on wall
// and studded rubber (middle) → slate, cork and painted dado (high) → carpet
// tile, oak slats and terracotta (college) → carpet, walnut, panelled green
// and brass (university).
const shade = (hex, l = 0, s = 0) => '#' + new THREE.Color(hex).offsetHSL(0, s, l).getHexString();
const pick = (list, n) => list[Math.floor(rnd(n) * list.length) % list.length];
const grey = v => { const g = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${g},${g},${g})`; };
function canvasTexture(draw, W, H, srgb = true) {
    const map = institutionalMap(draw, W, H); if (!srgb) map.colorSpace = THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; return map;
}
// One soft radial falloff shared by every light pool (rooms and stations);
// materials mark it `sharedTextures` so disposing a room or station keeps it.
let POOL_TEXTURE = null;
const noRay = () => {}; // light overlays never intercept picking
function poolTexture() {
    if (POOL_TEXTURE) return POOL_TEXTURE;
    POOL_TEXTURE = institutionalMap((c, W, H) => {
        const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ffffffc8'); g.addColorStop(.55, '#ffffff5c'); g.addColorStop(.8, '#ffffff16'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 128, 128);
    POOL_TEXTURE.wrapS = POOL_TEXTURE.wrapT = THREE.ClampToEdgeWrapping; return POOL_TEXTURE;
}
// Box-projected UVs (mm / period). Top faces: u = x, v = −z; x-facing faces:
// u = z, v = y; z-facing faces: u = x, v = y. Offsets shift the origin.
export function uvBox(geometry, pu, pv = pu, [ox, oy, oz] = [0, 0, 0]) {
    const pos = geometry.attributes.position, nor = geometry.attributes.normal; if (!pos || !nor) return geometry;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz, ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
        const [u, v] = ay >= ax && ay >= az ? [x, -z] : ax >= az ? [z, y] : [x, y];
        uv[i * 2] = u / pu; uv[i * 2 + 1] = v / pv;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}
// Draw a tile three times across each seam so strokes near an edge wrap.
const wrapped = (W, H, fn) => { for (const dx of W ? [-W, 0, W] : [0]) for (const dy of H ? [-H, 0, H] : [0]) fn(dx, dy); };

// Plank floor: staggered boards whose lengths sum to the tile width (seamless),
// each with its own tone, straight grain, flat-sawn figure, pores and the odd
// knot; a bevel highlight and shadow at every long edge. `rough` draws the
// matching roughness map (gaps rough, faces satin, wear lanes smoother).
function plank(c, x, y, len, h, id, o, rough, px) {
    const g = 1.3 * px;
    c.save(); c.beginPath(); c.rect(x + g, y + g, len - 2 * g, h - 2 * g); c.clip();
    if (rough) {
        c.fillStyle = grey(196 + (rnd(id) - .5) * 30); c.fillRect(x, y, len, h);
        for (let i = 0; i < 18; i++) { const yy = y + rnd(id * 13 + i) * h; c.fillStyle = grey(215 + rnd(id + i) * 35); c.fillRect(x, yy, len, (.6 + rnd(id * 3 + i)) * px); }
    } else {
        const tone = pick(o.tones, id * 3.7), lg = c.createLinearGradient(x, y, x + len, y + h);
        lg.addColorStop(0, shade(tone, (rnd(id * 2) - .5) * .045)); lg.addColorStop(.55, tone); lg.addColorStop(1, shade(tone, (rnd(id * 5) - .5) * .05));
        c.fillStyle = lg; c.fillRect(x, y, len, h);
        if (!o.straight) for (let k = 0; k < 2; k++) {
            const cx = x + len * (.15 + rnd(id + k * 9) * .7), cy = y + h * (.25 + rnd(id * 3 + k) * .5);
            for (let q = 0; q < 6; q++) { c.strokeStyle = o.grain[0] + '1a'; c.lineWidth = (1 + q % 2) * px; c.beginPath(); c.ellipse(cx, cy, len * (.05 + q * .045), h * (.08 + q * .07), 0, 0, TAU); c.stroke(); }
        }
        for (let i = 0; i < 30; i++) {
            const yy = y + rnd(id * 13 + i) * h, wv = (rnd(id + i * 7) - .5) * h * (o.straight ? .08 : .22);
            c.strokeStyle = o.grain[i % 4 ? 0 : 1] + (i % 4 ? '1e' : '26'); c.lineWidth = (.5 + rnd(id * 3 + i) * 1.3) * px;
            c.beginPath(); c.moveTo(x, yy); c.bezierCurveTo(x + len * .33, yy + wv, x + len * .66, yy - wv, x + len, yy + wv * .3); c.stroke();
        }
        const pores = len * h / (110 * px * px);
        for (let i = 0; i < pores; i++) { c.fillStyle = o.grain[0] + '24'; c.fillRect(x + rnd(id + i * 1.37) * len, y + rnd(id * 2 + i * 1.71) * h, (1.5 + rnd(i) * 2.5) * px, .8 * px); }
        if (rnd(id * 11) < o.knots) { const kx = x + len * (.2 + rnd(id * 17) * .6), ky = y + h * (.3 + rnd(id * 19) * .4); c.fillStyle = o.grain[0] + '66'; c.beginPath(); c.ellipse(kx, ky, 5 * px, 3.4 * px, 0, 0, TAU); c.fill(); for (let q = 1; q < 4; q++) { c.strokeStyle = o.grain[0] + '2a'; c.lineWidth = px; c.beginPath(); c.ellipse(kx, ky, (6 + q * 5) * px, (4 + q * 3) * px, 0, 0, TAU); c.stroke(); } }
    }
    c.restore();
    if (!rough) { c.fillStyle = '#ffffff22'; c.fillRect(x + g, y + g, len - 2 * g, 1.3 * px); c.fillStyle = '#00000024'; c.fillRect(x + g, y + h - g - 1.3 * px, len - 2 * g, 1.3 * px); c.fillStyle = '#00000018'; c.fillRect(x + len - g - px, y + g, px, h - 2 * g); }
}
function drawPlanks(c, W, H, o, rough = false) {
    const rows = o.rows || 8, rh = H / rows, px = W / 1024, seed = o.seed || 1;
    c.fillStyle = rough ? grey(255) : o.gap; c.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
        const lens = []; let sum = 0;
        while (sum < W - 1) { let len = W * (.3 + rnd(seed * 31 + r * 7 + lens.length * 3) * .42); if (W - sum - len < W * .2) len = W - sum; lens.push(len); sum += len; }
        let x = rnd(seed * 53 + r * 5) * W;
        lens.forEach((len, n) => { for (const off of [0, -W]) plank(c, x + off, r * rh, len, rh, seed * 997 + r * 31 + n, o, rough, px); x = (x + len) % W; });
    }
}
// Carpet tile: 500 mm quarter-turned tiles with directional loop rows, a
// heathered yarn fleck and quiet seams (4 × 4 tiles per 2 m map).
function drawCarpet(c, W, H, { tones, fleck, seam }) {
    const n = 4, t = W / n;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        const x = k * t, y = r * t, along = (r + k) % 2; c.fillStyle = tones[(r * 3 + k) % tones.length]; c.fillRect(x, y, t, t);
        // Directional loop rows stay faint: strong rows mip to a checkerboard at a distance.
        for (let i = 0; i < t; i += 3) { c.fillStyle = i % 6 ? '#ffffff04' : '#00000007'; if (along) c.fillRect(x + i, y, 1.4, t); else c.fillRect(x, y + i, t, 1.4); }
        c.strokeStyle = seam; c.lineWidth = 1.2; c.strokeRect(x + .6, y + .6, t - 1.2, t - 1.2);
    }
    for (let i = 0; i < W * H / 12; i++) { c.fillStyle = fleck[i % fleck.length]; c.fillRect(rnd(i * 1.13) * W, rnd(i * 2.71 + 9) * H, 1.3, 1.3); }
}
// Furniture timber: grain along u (or v when `vertical`), optional flat-sawn
// cathedral figure and darker streaks (walnut), open pores.
function drawWood(c, W, H, o) {
    if (o.vertical) { c.save(); c.translate(W, 0); c.rotate(Math.PI / 2); [W, H] = [H, W]; }
    c.fillStyle = o.base; c.fillRect(0, 0, W, H); const seed = o.seed || 3;
    if (o.streak) for (let i = 0; i < 7; i++) { const y = rnd(i * 4.3 + seed) * H; wrapped(0, H, (dx, dy) => { c.fillStyle = (i % 2 ? o.dark : o.light) + '14'; c.fillRect(0, y + dy, W, H * (.03 + rnd(i) * .06)); }); }
    if (o.figure) for (let k = 0; k < 4; k++) {
        const cx = W * rnd(k * 7 + seed), cy = H * rnd(k * 11 + seed + 2);
        wrapped(W, H, (dx, dy) => { for (let q = 0; q < 7; q++) { c.strokeStyle = o.dark + '16'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx + dx, cy + dy, W * (.06 + q * .04), H * (.025 + q * .018), 0, 0, TAU); c.stroke(); } });
    }
    for (let i = 0; i < 120; i++) {
        const y = rnd(i * 3.1 + seed) * H, wv = (rnd(i * 1.7 + seed) - .5) * H * .04;
        wrapped(0, H, (dx, dy) => { c.strokeStyle = (i % 4 ? o.dark : o.light) + (i % 4 ? '1c' : '26'); c.lineWidth = .6 + rnd(i * 5.3) * 1.8; c.beginPath(); c.moveTo(-4, y + dy); c.bezierCurveTo(W * .3, y + dy + wv, W * .7, y + dy - wv, W + 4, y + dy); c.stroke(); });
    }
    for (let i = 0; i < W * H / 260; i++) { c.fillStyle = o.dark + '28'; c.fillRect(rnd(i * 1.9) * W, rnd(i * 2.3 + 1) * H, 2 + rnd(i) * 4, .9); }
    if (o.vertical) c.restore();
}
// Fine fleck surfaces: HPL laminate, sheet vinyl, linoleum, rubber, felt, cork.
function drawFleck(c, W, H, { base, flecks, count = W * H / 30, size = [1, 2], marble = null, seed = 5 }) {
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    if (marble) for (let i = 0; i < 40; i++) {
        const y = rnd(i * 7.7 + seed) * H, amp = H * (.02 + rnd(i) * .05), col = marble[i % marble.length];
        wrapped(0, H, (dx, dy) => { c.strokeStyle = col; c.lineWidth = 2 + rnd(i * 3) * 6; c.beginPath(); c.moveTo(-5, y + dy); for (let x = 0; x <= W + 10; x += 16) c.lineTo(x, y + dy + Math.sin(x / W * TAU * (1 + i % 3) + i) * amp); c.stroke(); });
    }
    for (let i = 0; i < count; i++) { c.fillStyle = flecks[i % flecks.length]; const s = size[0] + rnd(i * 3.3) * (size[1] - size[0]); c.fillRect(rnd(i * 1.31 + seed) * W, rnd(i * 2.17 + seed) * H, s, s * (.6 + rnd(i) * .8)); }
}
function drawFelt(c, W, H, base, light, dark) {
    drawFleck(c, W, H, { base, flecks: [light + '30', dark + '30'], count: W * H / 5, size: [1, 1.6] });
    for (let i = 0; i < W * H / 60; i++) { const x = rnd(i * 1.7) * W, y = rnd(i * 3.9) * H, a = rnd(i * 5.1) * TAU; c.strokeStyle = (i % 2 ? light : dark) + '26'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); c.stroke(); }
}
function drawCork(c, W, H) {
    c.fillStyle = '#b9946a'; c.fillRect(0, 0, W, H);
    const cols = ['#a07a50', '#c9a77a', '#8a6440', '#d4b68c', '#6f4f30', '#b08758'];
    for (let i = 0; i < W * H / 6; i++) { c.fillStyle = cols[i % cols.length] + 'b0'; c.beginPath(); c.ellipse(rnd(i * 1.3) * W, rnd(i * 2.9) * H, .8 + rnd(i * 4.1) * 2.6, .6 + rnd(i * 6.7) * 1.8, rnd(i) * 3, 0, TAU); c.fill(); }
    for (let i = 0; i < 90; i++) dot(c, rnd(i * 9.1) * W, rnd(i * 7.3) * H, .9, '#3a281888');
}
// Studded rubber (coin dots), slate tiles with cleft relief, sheet vinyl.
function drawStudRubber(c, W, H, rough = false) {
    c.fillStyle = rough ? grey(240) : '#5f7378'; c.fillRect(0, 0, W, H);
    if (!rough) for (let i = 0; i < W * H / 18; i++) { c.fillStyle = i % 2 ? '#6c8085' : '#55686d'; c.fillRect(rnd(i * 1.7) * W, rnd(i * 3.1) * H, 1.2, 1.2); }
    const p = W / 16;
    for (let r = 0; r < 16; r++) for (let k = 0; k < 16; k++) {
        const x = (k + .5) * p, y = (r + .5) * p;
        if (rough) dot(c, x, y, p * .3, grey(170));
        else { dot(c, x + 1.2, y + 1.6, p * .3, '#43555a'); dot(c, x, y, p * .3, '#687d82'); dot(c, x - p * .08, y - p * .1, p * .16, '#74898e'); }
    }
}
function drawSlate(c, W, H, rough = false) {
    // 600 x 300 tiles, half-bond; the map is 1200 x 1200 mm.
    c.fillStyle = rough ? grey(255) : '#3a454c'; c.fillRect(0, 0, W, H);
    const tw = W / 2, th = H / 4, tones = ['#4b5a63', '#47555e', '#505f67', '#44525a', '#4d5b61'];
    for (let r = 0; r < 4; r++) for (let k = -1; k < 2; k++) {
        const x = k * tw + (r % 2) * tw / 2, y = r * th, id = r * 5 + k + 9;
        c.save(); c.beginPath(); c.rect(x + 2, y + 2, tw - 4, th - 4); c.clip();
        if (rough) { c.fillStyle = grey(165 + rnd(id) * 40); c.fillRect(x, y, tw, th); for (let i = 0; i < 30; i++) { c.fillStyle = grey(190 + rnd(id + i) * 60); c.beginPath(); c.ellipse(x + rnd(id * 3 + i) * tw, y + rnd(id * 7 + i) * th, tw * (.05 + rnd(i) * .2), th * .06, rnd(i * 3) * .4, 0, TAU); c.fill(); } }
        else {
            c.fillStyle = tones[id % tones.length]; c.fillRect(x, y, tw, th);
            for (let i = 0; i < 26; i++) { c.fillStyle = (i % 2 ? '#6c7a82' : '#2f393f') + '30'; c.beginPath(); c.ellipse(x + rnd(id * 3 + i) * tw, y + rnd(id * 7 + i) * th, tw * (.05 + rnd(i) * .22), th * (.03 + rnd(i * 2) * .06), rnd(i * 3) * .3 - .15, 0, TAU); c.fill(); }
            for (let i = 0; i < tw * th / 40; i++) { c.fillStyle = i % 3 ? '#5f6d7522' : '#c2ccd01a'; c.fillRect(x + rnd(id + i * 1.3) * tw, y + rnd(id * 2 + i * 1.9) * th, 1.4, 1.4); }
        }
        c.restore();
    }
}
// Wainscot and wall finishes. Each map covers `period` mm across and the
// finish's full height, so v = 0…1 runs floor → cap.
function drawBirchWainscot(c, W, H) {
    c.fillStyle = '#e3cfa5'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 180; i++) { const x = rnd(i * 2.3) * W, wv = (rnd(i * 4.1) - .5) * 18; wrapped(W, 0, dx => { c.strokeStyle = (i % 5 ? '#b8976a' : '#f4e4c4') + '24'; c.lineWidth = .7 + rnd(i * 3) * 1.6; c.beginPath(); c.moveTo(x + dx, 0); c.bezierCurveTo(x + dx + wv, H * .35, x + dx - wv, H * .7, x + dx + wv * .4, H); c.stroke(); }); }
    for (let n = 0; n < 10; n++) {
        const x = (n + .5) * W / 10, gg = c.createLinearGradient(x - 5, 0, x + 5, 0);
        gg.addColorStop(0, '#cdb185'); gg.addColorStop(.3, '#8f7149'); gg.addColorStop(.65, '#b39363'); gg.addColorStop(1, '#f2e0bb'); c.fillStyle = gg; c.fillRect(x - 5, 0, 10, H);
    }
    for (let i = 0; i < 40; i++) dot(c, rnd(i * 5.1) * W, H * (.86 + rnd(i * 2.2) * .12), 1.5 + rnd(i) * 2, '#a98a5c30'); // scuffs near the floor
}
function drawPanelledWainscot(c, W, H, field = '#285c4b') {
    // Library-room raised panels (two per 1300 mm), re-toned per stage.
    c.fillStyle = field; c.fillRect(0, 0, W, H);
    const dark = shade(field, -.06), mid = shade(field, .015), light = shade(field, .1), deep = shade(field, -.1);
    for (const x0 of [16, W / 2 + 16]) {
        const pw = W / 2 - 32, top = 22, ph = H - 64;
        c.fillStyle = dark; c.fillRect(x0, top, pw, ph); c.fillStyle = mid; c.fillRect(x0 + 16, top + 16, pw - 32, ph - 32);
        c.strokeStyle = light; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, top + ph); c.lineTo(x0, top); c.lineTo(x0 + pw, top); c.stroke();
        c.beginPath(); c.moveTo(x0 + pw - 16, top + 16); c.lineTo(x0 + pw - 16, top + ph - 16); c.lineTo(x0 + 16, top + ph - 16); c.stroke();
        c.strokeStyle = deep; c.beginPath(); c.moveTo(x0 + pw, top); c.lineTo(x0 + pw, top + ph); c.lineTo(x0, top + ph); c.stroke();
        c.beginPath(); c.moveTo(x0 + 16, top + ph - 16); c.lineTo(x0 + 16, top + 16); c.lineTo(x0 + pw - 16, top + 16); c.stroke();
    }
    for (let i = 0; i < W * H / 30; i++) { c.fillStyle = i % 2 ? '#ffffff08' : '#00000008'; c.fillRect(rnd(i * 1.3) * W, rnd(i * 2.1) * H, 1, 1); }
}
function drawPaint(c, W, H, base) { drawFleck(c, W, H, { base, flecks: [shade(base, .03) + '40', shade(base, -.03) + '40'], count: W * H / 6, size: [1, 1.5] }); }
function drawPlaster(c, W, H, base) {
    // Limewash: soft clouds of lighter and darker wash.
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const x = rnd(i * 2.3) * W, y = rnd(i * 4.7) * H, r = W * (.04 + rnd(i * 6.1) * .12); wrapped(W, H, (dx, dy) => { const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); g.addColorStop(0, (i % 2 ? shade(base, .05) : shade(base, -.05)) + '55'); g.addColorStop(1, base + '00'); c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }); }
    drawFleck(c, W, H, { base: '#00000000', flecks: ['#ffffff14', '#00000014'], count: W * H / 10, size: [1, 1.6] });
}
// Write-on wall: a gloss panel with ghosted, half-erased marker work and
// today's sketches (generic diagrams only).
function drawWriteOn(c, W, H) {
    c.fillStyle = '#f4f6f2'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = rnd(i * 3.3) * W, y = rnd(i * 5.9) * H, r = 40 + rnd(i) * 140; c.strokeStyle = '#9aa8ad14'; c.lineWidth = 10 + rnd(i * 2) * 26; c.beginPath(); c.ellipse(x, y, r, r * .4, rnd(i * 7) * 3, 0, TAU * .8); c.stroke(); }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pen = (col, w = 4) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; };
    // Left: a street-grid sketch with arrows; right: equations in three colours.
    pen('#2f5f9e'); const gx = W * .06, gy = H * .2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(gx + k * 46, gy); c.lineTo(gx + k * 46 + 6, gy + 200); c.stroke(); c.beginPath(); c.moveTo(gx - 10, gy + k * 46); c.lineTo(gx + 200, gy + k * 46 + 4); c.stroke(); }
    pen('#2e8a57', 5); for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(gx + 30 + rnd(k) * 150, gy + 30 + rnd(k + 9) * 150, 9, 0, TAU); c.stroke(); }
    pen('#c2412f', 4); c.beginPath(); c.moveTo(gx + 230, gy + 90); c.quadraticCurveTo(gx + 300, gy + 30, gx + 380, gy + 80); c.stroke(); c.beginPath(); c.moveTo(gx + 366, gy + 64); c.lineTo(gx + 382, gy + 82); c.lineTo(gx + 360, gy + 90); c.stroke();
    c.font = '600 34px sans-serif'; c.textBaseline = 'middle'; c.fillText('ideas?', gx + 250, gy + 150);
    pen('#20323a', 3); c.font = '30px sans-serif';
    [['A = l × w', '#20323a'], ['P = 2(l + w)', '#2f5f9e'], ['1 : 100 scale', '#c2412f'], ['bus every 10 min', '#2e8a57']].forEach(([s, col], k) => { c.fillStyle = col; c.fillText(s, W * .64, H * (.22 + k * .15)); });
    pen('#20323a', 2); c.strokeRect(W * .62, H * .12, W * .3, H * .66);
    // Marker tray shadow line at the bottom.
    c.fillStyle = '#d6dbd8'; c.fillRect(0, H - 6, W, 6);
}

// Book spine atlas (16 cells): cloth, paper and archive styles with gilt
// bands, title blocks and imprint dots; the last cell is the page block.
function drawSpines(c, W, H, palette) {
    const cw = W / 16;
    for (let n = 0; n < 15; n++) {
        const x = n * cw, col = palette[n % palette.length], style = n % 5;
        c.fillStyle = col; c.fillRect(x, 0, cw, H);
        for (let i = 0; i < 160; i++) { c.fillStyle = i % 2 ? '#ffffff10' : '#00000014'; c.fillRect(x + rnd(n * 50 + i) * cw, rnd(n * 70 + i) * H, 1, 2); }
        const gilt = style % 2 ? '#d8c07a' : '#efe6cc';
        if (style !== 3) { c.fillStyle = gilt; for (const y of [H * .07, H * .1, H * .9, H * .93]) c.fillRect(x + 3, y, cw - 6, 2); }
        if (style === 0 || style === 4) { c.fillStyle = shade(col, -.12); c.fillRect(x + 4, H * .2, cw - 8, H * .2); c.fillStyle = gilt; for (let k = 0; k < 4; k++) c.fillRect(x + 10, H * .24 + k * 10, cw - 20, 3); }
        if (style === 1) { c.fillStyle = '#f3ecd9'; c.fillRect(x + 6, H * .16, cw - 12, H * .26); c.fillStyle = '#3b3b38'; for (let k = 0; k < 3; k++) c.fillRect(x + 12, H * .2 + k * 12, cw - 24 - k * 6, 3); }
        if (style === 2) { c.fillStyle = '#f7f3ea'; c.fillRect(x, H * .55, cw, H * .12); c.fillStyle = col; c.fillRect(x + 10, H * .59, cw - 20, 4); }
        if (style === 3) { c.fillStyle = '#efe8d6'; c.fillRect(x + 8, H * .3, cw - 16, H * .2); c.fillStyle = '#5a5246'; for (let k = 0; k < 3; k++) c.fillRect(x + 13, H * .34 + k * 10, cw - 26, 2); dot(c, x + cw / 2, H * .8, 7, '#e9e1cc'); }
        dot(c, x + cw / 2, H * .84, 4, gilt);
        c.fillStyle = '#00000030'; c.fillRect(x, 0, 2, H); c.fillStyle = '#ffffff20'; c.fillRect(x + cw - 2, 0, 2, H);
    }
    const x = 15 * cw; c.fillStyle = '#efe6cf'; c.fillRect(x, 0, cw, H); c.fillStyle = '#d7ccb2'; for (let y = 0; y < H; y += 3) c.fillRect(x, y, cw, 1);
}
// One merged mesh of books for a shelf run (spines face +z). runs: { x0, x1,
// y, front, depth, hMin, hMax, seed } in the parent's frame; books lean at ends.
function bookRuns(runs, material) {
    const parts = [];
    for (const r of runs) {
        let x = r.x0, n = 0;
        while (x < r.x1 - 20) {
            const id = (r.seed || 1) * 131 + n++, t = 18 + rnd(id) * 30, h = r.hMin + rnd(id * 3.3) * (r.hMax - r.hMin), dep = r.depth * (.82 + rnd(id * 5.7) * .18);
            if (x + t > r.x1) break;
            if (rnd(id * 9.1) < .06 && n > 3) { x += 40; continue; } // a gap where a book is out
            const g = new THREE.BoxGeometry(t, h, dep).toNonIndexed(), cell = Math.floor(rnd(id * 7.7) * 15), uv = g.attributes.uv, nor = g.attributes.normal;
            for (let i = 0; i < uv.count; i++) {
                const spine = nor.getZ(i) > .5, u = uv.getX(i), v = uv.getY(i);
                uv.setXY(i, spine ? (cell + .04 + u * .92) / 16 : (15.1 + u * .8) / 16, spine ? v : .1 + v * .8);
            }
            const lean = rnd(id * 2.9) < .08 ? (rnd(id) - .5) * .25 : 0;
            g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x + t / 2, r.y + h / 2, r.front - dep / 2 - (lean ? 0 : rnd(id * 4.4) * 12)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean)), new THREE.Vector3(1, 1, 1)));
            parts.push(g); x += t + (lean ? 12 : 1);
        }
    }
    if (!parts.length) return null;
    const merged = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
    const mesh = new THREE.Mesh(merged, material); mesh.name = 'Shelf books'; mesh.castShadow = mesh.receiveShadow = true; return mesh;
}

// Stage palettes: floor, trim, wainscot, furniture tops and upholstery.
const PALETTE = {
    kindergarten: { floor: { kind: 'planks', tones: ['#dcc7a3', '#d4bd96', '#e0ccaa', '#cfb68e', '#d9c39e', '#d6c09a'], grain: ['#8a6c48', '#fff3dc'], gap: '#a68b65', straight: true, knots: .05, seed: 2 },
        trim: '#d9be8f', top: { base: '#e7d3ac', dark: '#a8875a', light: '#fff2d6', seed: 4 }, shell: 'plastic' },
    elementary: { floor: { kind: 'planks', tones: ['#cdb58e', '#c6ad85', '#d3bb94', '#c2a87f', '#cbb28a'], grain: ['#6f5435', '#fbe6c4'], gap: '#8f7552', knots: .12, seed: 7 },
        trim: '#b48f62', top: { base: '#e3d2ae', dark: '#a8875a', light: '#fff2d6', seed: 6 }, shell: 'plastic' },
    middleschool: { floor: { kind: 'planks', tones: ['#c9ad85', '#c2a57c', '#ceb28b', '#bea079', '#c7aa82'], grain: ['#694d31', '#f6dfbb'], gap: '#7d6346', knots: .15, seed: 11 },
        trim: '#3e5f6a', top: { hpl: '#f1efe8', seed: 8 }, shell: 'plastic' },
    highschool: { floor: { kind: 'planks', tones: ['#bfa47c', '#b89c74', '#c4a982', '#b39670', '#bca079'], grain: ['#5f452b', '#f2d9b2'], gap: '#735a3e', knots: .2, seed: 13 },
        trim: '#2f3b44', top: { hpl: '#ece8df', seed: 9 }, shell: 'plastic' },
    college: { floor: { kind: 'carpet', tones: ['#756f68', '#76706a', '#746e67', '#77716a'], fleck: ['#8e877c66', '#5c574f66', '#a5643f22', '#9b938866'], seam: '#5a554f' },
        stage: { tones: ['#b8915f', '#b08a5a', '#bf9867', '#ad8656'], grain: ['#5e4329', '#f3d8ae'], gap: '#6e5438', knots: .1, seed: 17 },
        trim: '#5b4636', top: { base: '#b08d63', dark: '#6b4b2c', light: '#e8c99a', figure: true, seed: 12 }, shell: 'fabric' },
    university: { floor: { kind: 'carpet', tones: ['#5d625c', '#5f645e', '#5b605a', '#61665f'], fleck: ['#7a7f7666', '#454a4466', '#2f544633', '#86897f55'], seam: '#4c514b' },
        stage: { tones: ['#b8915f', '#ae8858', '#bd9564', '#a98353'], grain: ['#5e4329', '#f3d8ae'], gap: '#6e5438', knots: .1, seed: 19 },
        trim: '#e4dfcf', top: { base: '#6b4a33', dark: '#3b2516', light: '#a07650', figure: true, streak: true, seed: 15 }, shell: 'leather' }
};
const SPINES = {
    highschool: ['#567081', '#d9a441', '#c97c5d', '#3f4b52', '#6f8796', '#2f5f9e', '#9aa8b0', '#7a8f5a'],
    university: ['#285c4b', '#7a2f2f', '#2f3f5c', '#b39b6a', '#3d2f26', '#5e6b4a', '#8a6a3a', '#20302a', '#6b4a33']
};
// Room floor (shell hook): a seamless 1.6 m plank tile or 2 m carpet tile.
export function floor(spec, w, d) {
    const p = PALETTE[spec.id]?.floor || PALETTE.highschool.floor, carpet = p.kind === 'carpet', period = carpet ? 2000 : 1600;
    const map = canvasTexture((c, W, H) => carpet ? drawCarpet(c, W, H, p) : drawPlanks(c, W, H, p), 1024, 1024);
    map.repeat.set(w / period, d / period);
    if (!carpet) { const rough = canvasTexture((c, W, H) => drawPlanks(c, W, H, p, true), 512, 512, false); rough.repeat.copy(map.repeat); map.userData.roughnessMap = rough; }
    return { map, roughness: carpet ? .95 : .58, surface: carpet ? 'fabric' : 'wood' };
}

// ---- Window views: one distinct, generic outlook per stage --------------
// Drawn into the stage's own window texture (aspect matches the opening) and
// redrawn per daypart: playground (KG), school garden (elementary), sports
// field and bus loop (middle), car park, gym and floodlit field (high), quad
// (college), research campus with lab and clock tower (university).
function viewSky(c, W, H, phase, sky) {
    const night = phase === 'night', dusk = phase === 'evening';
    const g = c.createLinearGradient(0, 0, 0, H * .62); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sun = { morning: [.16, .3, '#fff4d8'], afternoon: [.78, .12, '#fffdf0'], evening: [.3, .5, '#ffc27a'], night: [.82, .14, '#eef0e4'], party: [.86, .32, '#fff2dc'] }[phase] || [.5, .2, '#fff'];
    const sx = W * sun[0], sy = H * sun[1], halo = c.createRadialGradient(sx, sy, 3, sx, sy, night ? H * .14 : H * .45);
    halo.addColorStop(0, sun[2] + (night ? '80' : 'd0')); halo.addColorStop(1, sun[2] + '00'); c.fillStyle = halo; c.fillRect(0, 0, W, H);
    dot(c, sx, sy, night ? H * .03 : H * .045, sun[2]);
    if (night) { c.fillStyle = '#ffffffa8'; for (let i = 0; i < W / 9; i++) c.fillRect(rnd(i * 1.7) * W, rnd(i * 3.3) * H * .5, 1.2 + rnd(i * 7) * 1.4, 1.2 + rnd(i * 7) * 1.4); }
    else for (let i = 0; i < Math.round(W / 140); i++) {
        const x = rnd(i * 5 + 2) * W, y = H * (.06 + rnd(i * 9) * .26), s = H * (.06 + rnd(i * 4) * .07);
        c.fillStyle = dusk ? '#f6c9a8a0' : phase === 'party' ? '#f4ece0a8' : '#ffffffb8';
        for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + (j - 2) * s * .55, y + Math.abs(j - 2) * s * .1, s * .62, s * .32, 0, 0, TAU); c.fill(); }
    }
}
const viewTone = phase => ({ night: phase === 'night', dusk: phase === 'evening', lit: phase === 'night' || phase === 'evening' });
function viewTrees(c, W, H, y, n, phase, seed = 1, scale = 1) {
    const { night, dusk } = viewTone(phase);
    for (let i = 0; i < n; i++) {
        const x = (i + rnd(i * 3 + seed) * .8) * W / n, r = H * (.07 + rnd(i * 5 + seed) * .05) * scale, ty = y - rnd(i * 7 + seed) * H * .03;
        c.fillStyle = night ? '#2a2420' : '#5a4632'; c.fillRect(x - r * .1, ty - r * .2, r * .2, r * 1.4);
        c.fillStyle = night ? '#1d3330' : dusk ? '#4a6544' : '#55804f'; c.beginPath(); c.ellipse(x, ty - r * .7, r, r * 1.05, 0, 0, TAU); c.fill();
        c.fillStyle = night ? '#25403a' : dusk ? '#5e7a50' : '#6f9a5c'; c.beginPath(); c.ellipse(x - r * .25, ty - r * .95, r * .62, r * .66, 0, 0, TAU); c.fill();
    }
}
function viewBuilding(c, x, y, w, h, { wall, roof = null, rows = 2, cols = 6, phase, litShare = .5, seed = 1, glass = false }) {
    const { night, dusk, lit } = viewTone(phase);
    c.fillStyle = night ? shade(wall, -.35) : dusk ? shade(wall, -.12) : wall; c.fillRect(x, y, w, h);
    if (roof) { c.fillStyle = night ? '#1f2629' : roof; c.fillRect(x - 4, y - h * .08, w + 8, h * .08); }
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const on = lit && rnd(seed * 97 + r * 13 + k) < (night ? litShare : litShare * .5);
        c.fillStyle = on ? '#ffd88a' : glass ? (night ? '#1c2a36' : '#9fbccb') : night ? '#26323a' : dusk ? '#b8a08e' : '#9fb7c2';
        if (glass) c.fillRect(x + k * cw + 1, y + r * rh + 1, cw - 2, rh - 2); else c.fillRect(x + k * cw + cw * .22, y + r * rh + rh * .22, cw * .56, rh * .5);
    }
}
function viewGround(c, W, H, y, phase, color = '#7fa35e') { const { night, dusk } = viewTone(phase); c.fillStyle = night ? '#1f3a2c' : dusk ? shade(color, -.12) : color; c.fillRect(0, y, W, H - y); }
const VIEWS = {
    kindergarten(c, W, H, phase) {
        const { night, dusk } = viewTone(phase), y0 = H * .6;
        viewTrees(c, W, H, H * .6, Math.round(W / 70), phase, 3, .8);
        viewBuilding(c, W * .62, H * .38, W * .36, H * .22, { wall: '#d9c7a8', roof: '#8b5a46', rows: 1, cols: 7, phase, litShare: .3, seed: 2 });
        if (night) { c.fillStyle = '#ffd88a'; c.fillRect(W * .7, H * .43, W * .03, H * .07); c.fillRect(W * .86, H * .43, W * .03, H * .07); }
        viewGround(c, W, H, y0, phase, '#86ac63');
        // Soft-fall surface, play structure with a slide, sandpit and raised beds.
        c.fillStyle = night ? '#3b3330' : dusk ? '#a8705c' : '#c98a6c'; c.beginPath(); c.ellipse(W * .32, H * .74, W * .2, H * .08, 0, 0, TAU); c.fill();
        const px = W * .26, py = H * .7, s = H * .2;
        c.fillStyle = night ? '#4a3f37' : '#9a6f48'; for (const dx of [0, s * .9]) c.fillRect(px + dx, py - s, s * .07, s);
        c.fillStyle = night ? '#3f4a52' : '#4f8fc0'; c.fillRect(px - s * .05, py - s * .6, s * 1.05, s * .08);
        c.fillStyle = night ? '#55413a' : '#d9534f'; c.beginPath(); c.moveTo(px - s * .1, py - s); c.lineTo(px + s * .48, py - s * 1.35); c.lineTo(px + s * 1.05, py - s); c.fill();
        c.strokeStyle = night ? '#6a6044' : '#f0c24b'; c.lineWidth = s * .09; c.beginPath(); c.moveTo(px + s, py - s * .58); c.quadraticCurveTo(px + s * 1.5, py - s * .4, px + s * 1.8, py); c.stroke();
        c.strokeStyle = night ? '#4a4a40' : '#6aa56a'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(px - s * .55 + k * s * .12, py); c.lineTo(px - s * .05, py - s * .55); c.stroke(); }
        c.fillStyle = night ? '#4f4a3c' : '#e9d9a8'; c.fillRect(W * .52, H * .75, W * .12, H * .05); c.strokeStyle = night ? '#3a3027' : '#a07a4a'; c.lineWidth = 4; c.strokeRect(W * .52, H * .75, W * .12, H * .05);
        dot(c, W * .56, H * .76, H * .012, night ? '#55413a' : '#d9534f'); dot(c, W * .6, H * .775, H * .01, night ? '#3f4a52' : '#4f8fc0');
        for (let k = 0; k < 3; k++) { const bx = W * (.04 + k * .07); c.fillStyle = night ? '#3a3027' : '#a07a4a'; c.fillRect(bx, H * .8, W * .06, H * .04); for (let q = 0; q < 6; q++) dot(c, bx + W * .006 + q * W * .009, H * .795, H * .014, night ? '#23402e' : ['#6aa56a', '#8fbf5a', '#d9534f'][q % 3]); }
        viewTrees(c, W, H, H * .83, 3, phase, 9, 1.45);
        // Picket fence across the foreground.
        c.fillStyle = night ? '#6b7570' : '#f4f1e8'; c.fillRect(0, H * .86, W, H * .012); c.fillRect(0, H * .92, W, H * .012);
        for (let x = 0; x < W; x += H * .035) { c.fillRect(x, H * .84, H * .02, H * .14); c.beginPath(); c.moveTo(x, H * .84); c.lineTo(x + H * .01, H * .825); c.lineTo(x + H * .02, H * .84); c.fill(); }
        if (night) { c.fillStyle = '#3a3f44'; c.fillRect(W * .47, H * .5, 4, H * .4); const g = c.createRadialGradient(W * .47, H * .5, 2, W * .47, H * .5, H * .12); g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, '#ffe2a800'); c.fillStyle = g; c.fillRect(W * .47 - H * .12, H * .38, H * .24, H * .24); }
    },
    elementary(c, W, H, phase) {
        const { night, dusk } = viewTone(phase);
        viewTrees(c, W, H, H * .58, Math.round(W / 60), phase, 5, .9);
        viewBuilding(c, W * .05, H * .36, W * .3, H * .24, { wall: '#d8b9a0', roof: '#6d5446', rows: 2, cols: 8, phase, litShare: .35, seed: 4 });
        viewGround(c, W, H, H * .6, phase, '#82a85f');
        // Asphalt playground with a hopscotch and a climbing frame; bike rack.
        c.fillStyle = night ? '#2f3438' : dusk ? '#6f7174' : '#8c9196'; c.fillRect(W * .38, H * .64, W * .62, H * .36);
        c.strokeStyle = night ? '#6b6550' : '#f4f1e8'; c.lineWidth = 3; const hx = W * .5, hy = H * .9, q = H * .05;
        [[0, 0], [0, -1], [-.5, -2], [.5, -2], [0, -3], [-.5, -4], [.5, -4], [0, -5]].forEach(([dx, dy], k) => { c.fillStyle = night ? '#4a4a40' : PASTEL[k % 6] + '66'; c.fillRect(hx + dx * q * 1.6, hy + dy * q * .55, q * 1.6, q * .55); c.strokeRect(hx + dx * q * 1.6, hy + dy * q * .55, q * 1.6, q * .55); });
        const fx = W * .72, fy = H * .86, s = H * .22; c.strokeStyle = night ? '#4a5560' : '#d9534f'; c.lineWidth = 5; c.beginPath(); c.arc(fx, fy, s, Math.PI, TAU); c.stroke(); c.beginPath(); c.ellipse(fx, fy, s, s * .35, 0, Math.PI, TAU); c.stroke(); for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(fx, fy, s * k / 4, s, 0, Math.PI, TAU); c.stroke(); }
        c.strokeStyle = night ? '#55606a' : '#9aa8b0'; c.lineWidth = 3; for (let k = 0; k < 5; k++) { const bx = W * .88 + k * H * .045; c.beginPath(); c.arc(bx, H * .9, H * .02, Math.PI, TAU); c.stroke(); }
        for (let k = 0; k < 2; k++) { const bx = W * .9 + k * H * .09; c.strokeStyle = night ? '#4a5560' : ['#4f8fc0', '#6aa56a'][k]; c.lineWidth = 3; c.beginPath(); c.arc(bx, H * .93, H * .025, 0, TAU); c.arc(bx + H * .06, H * .93, H * .025, 0, TAU); c.moveTo(bx, H * .93); c.lineTo(bx + H * .03, H * .89); c.lineTo(bx + H * .06, H * .93); c.stroke(); }
        // Garden beds with rows of vegetables in the foreground.
        for (let k = 0; k < 4; k++) { const bx = W * (.03 + k * .085); c.fillStyle = night ? '#3a3027' : '#9a6f48'; c.fillRect(bx, H * .8, W * .07, H * .08); c.fillStyle = night ? '#2a2420' : '#5a4636'; c.fillRect(bx + 3, H * .8, W * .07 - 6, H * .02); for (let qn = 0; qn < 7; qn++) { c.fillStyle = night ? '#1f3a2c' : qn % 2 ? '#5e9a5a' : '#8fbf5a'; c.beginPath(); c.ellipse(bx + W * .006 + qn * W * .009, H * .795, H * .012, H * .022, 0, 0, TAU); c.fill(); } }
        viewTrees(c, W, H, H * .7, 1, phase, 12, 2.4);
    },
    middleschool(c, W, H, phase) {
        const { night } = viewTone(phase);
        viewTrees(c, W, H, H * .55, Math.round(W / 55), phase, 7, .8);
        c.fillStyle = night ? '#2b3236' : '#c9ccc4'; c.fillRect(W * .78, H * .44, W * .2, H * .12); for (let k = 0; k < 5; k++) { c.fillStyle = night ? '#3a4248' : '#aab0aa'; c.fillRect(W * .78, H * .45 + k * H * .022, W * .2, H * .006); }
        viewGround(c, W, H, H * .56, phase, '#78a85a');
        // Running track (perspective oval) round a pitch with goals.
        const cx = W * .45, cy = H * .7, rx = W * .38, ry = H * .1;
        c.fillStyle = night ? '#3b2a2a' : '#b5523f'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill();
        c.strokeStyle = night ? '#6b5a50' : '#f4ead8'; c.lineWidth = 1.5; for (let k = 1; k < 6; k++) { c.beginPath(); c.ellipse(cx, cy, rx - k * H * .012, ry - k * H * .005, 0, 0, TAU); c.stroke(); }
        c.fillStyle = night ? '#24402c' : '#6faa4e'; c.beginPath(); c.ellipse(cx, cy, rx - H * .08, ry - H * .032, 0, 0, TAU); c.fill();
        c.strokeStyle = night ? '#6b7570' : '#f4f6f0'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy - ry + H * .032); c.lineTo(cx, cy + ry - H * .032); c.stroke();
        for (const gx of [cx - rx * .62, cx + rx * .62]) { c.lineWidth = 3; c.strokeRect(gx - H * .012, cy - H * .055, H * .024, H * .055); }
        // Bus loop with a school bus in the foreground.
        c.fillStyle = night ? '#2a2e31' : '#8a8f93'; c.fillRect(0, H * .84, W, H * .1); c.fillStyle = night ? '#6b6550' : '#f2e3a0'; for (let x = 0; x < W; x += H * .12) c.fillRect(x, H * .888, H * .06, 3);
        const bx = W * .12, by = H * .78; c.fillStyle = night ? '#6a5a28' : '#f0b429'; c.fillRect(bx, by, H * .42, H * .1); c.fillStyle = night ? '#2a3036' : '#2f3b44'; for (let k = 0; k < 7; k++) c.fillRect(bx + H * .02 + k * H * .055, by + H * .015, H * .04, H * .03);
        dot(c, bx + H * .08, by + H * .1, H * .02, '#222'); dot(c, bx + H * .34, by + H * .1, H * .02, '#222'); if (night) dot(c, bx + H * .41, by + H * .07, H * .01, '#ffe7a8');
        viewTrees(c, W, H, H * .86, 2, phase, 15, 1.8);
    },
    highschool(c, W, H, phase) {
        const { night, lit } = viewTone(phase);
        viewTrees(c, W, H, H * .52, Math.round(W / 60), phase, 11, .7);
        viewGround(c, W, H, H * .55, phase, '#79a65a');
        // Gymnasium block with high clerestory windows (lit in the evening).
        const gx = W * .55, gy = H * .32, gw = W * .4, gh = H * .28;
        c.fillStyle = night ? '#3a3533' : '#b9a38c'; c.fillRect(gx, gy, gw, gh); c.fillStyle = night ? '#1f2629' : '#5f6b70'; c.beginPath(); c.moveTo(gx - 6, gy); c.quadraticCurveTo(gx + gw / 2, gy - gh * .3, gx + gw + 6, gy); c.fill();
        for (let k = 0; k < 10; k++) { c.fillStyle = lit ? '#ffe2a0' : '#9fb7c2'; c.fillRect(gx + gw * (.04 + k * .096), gy + gh * .12, gw * .07, gh * .18); }
        c.fillStyle = night ? '#2a2420' : '#8c7a66'; c.fillRect(gx + gw * .44, gy + gh * .55, gw * .12, gh * .45);
        // Floodlit sports field beyond the car park.
        c.fillStyle = night ? '#24402c' : '#6faa4e'; c.fillRect(0, H * .58, W * .52, H * .1);
        for (const mx of [W * .04, W * .24, W * .46]) {
            c.fillStyle = '#5c6670'; c.fillRect(mx, H * .2, 4, H * .4); c.fillStyle = night ? '#fff6d8' : '#c8cfd2'; c.fillRect(mx - H * .03, H * .19, H * .065, H * .03);
            if (night || phase === 'evening') { const g = c.createRadialGradient(mx, H * .21, 2, mx, H * .21, H * .22); g.addColorStop(0, '#fff2c8d0'); g.addColorStop(1, '#fff2c800'); c.fillStyle = g; c.fillRect(mx - H * .22, 0, H * .44, H * .44); }
        }
        // Staff car park with bays and parked cars.
        c.fillStyle = night ? '#2a2e31' : '#8a8f93'; c.fillRect(0, H * .7, W, H * .3);
        c.fillStyle = night ? '#5a5a50' : '#f2f2ec'; for (let x = 0; x < W; x += H * .16) c.fillRect(x, H * .76, 3, H * .14);
        for (let k = 0; k < Math.floor(W / (H * .16)); k++) if (rnd(k * 3.3) > .35) { const x = k * H * .16 + H * .02, col = ['#c94a3c', '#3c5a7a', '#d9d9d2', '#2f3b44', '#7f8a8f'][k % 5]; c.fillStyle = night ? shade(col, -.3) : col; c.fillRect(x, H * .79, H * .12, H * .07); c.fillStyle = night ? '#1c2228' : '#9fbccb'; c.fillRect(x + H * .02, H * .775, H * .08, H * .03); }
    },
    college(c, W, H, phase) {
        const { night, dusk, lit } = viewTone(phase);
        viewTrees(c, W, H, H * .48, Math.round(W / 70), phase, 21, .7);
        // Brick hall / library across the quad (lit in the evening).
        const hx = W * .18, hy = H * .26, hw = W * .62, hh = H * .3;
        c.fillStyle = night ? '#3b2a2a' : dusk ? '#8a5a48' : '#a8705a'; c.fillRect(hx, hy, hw, hh);
        c.fillStyle = night ? '#1f2629' : '#4f5a5e'; c.beginPath(); c.moveTo(hx - 8, hy); c.lineTo(hx + hw / 2, hy - hh * .32); c.lineTo(hx + hw + 8, hy); c.fill();
        c.fillStyle = night ? '#4a3a32' : '#d8c8b0'; for (let k = 0; k < 6; k++) c.fillRect(hx + hw * .35 + k * hw * .06, hy + hh * .35, hw * .02, hh * .65);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 14; k++) { if (k > 4 && k < 10 && r) continue; const on = lit && rnd(k * 3 + r) < (night ? .75 : .5); c.fillStyle = on ? '#ffd88a' : night ? '#29343c' : '#bcd0d8'; c.fillRect(hx + hw * (.03 + k * .069), hy + hh * (.15 + r * .4), hw * .035, hh * .22); }
        viewGround(c, W, H, H * .56, phase, '#7fa35e');
        // Crossing paths, mature trees, bike racks and a bench.
        c.fillStyle = night ? '#4a4c46' : '#d8cdb2'; c.beginPath(); c.moveTo(W * .2, H); c.lineTo(W * .48, H * .56); c.lineTo(W * .52, H * .56); c.lineTo(W * .36, H); c.fill(); c.beginPath(); c.moveTo(W * .6, H); c.lineTo(W * .5, H * .56); c.lineTo(W * .54, H * .56); c.lineTo(W * .82, H); c.fill();
        c.fillRect(0, H * .62, W, H * .025);
        viewTrees(c, W, H, H * .66, 4, phase, 25, 2.2);
        c.strokeStyle = night ? '#55606a' : '#7d8a92'; c.lineWidth = 3; for (let k = 0; k < 8; k++) { const bx = W * .66 + k * H * .05; c.beginPath(); c.arc(bx, H * .9, H * .022, Math.PI, TAU); c.stroke(); if (k % 2 === 0) { c.strokeStyle = night ? '#4a5560' : ['#3c5a7a', '#c94a3c', '#2f3b44'][k % 3]; c.beginPath(); c.arc(bx, H * .92, H * .02, 0, TAU); c.stroke(); c.strokeStyle = night ? '#55606a' : '#7d8a92'; } }
        c.fillStyle = night ? '#3a3027' : '#8a6a4a'; c.fillRect(W * .08, H * .86, H * .2, H * .02); c.fillRect(W * .08, H * .82, H * .2, H * .015);
    },
    university(c, W, H, phase) {
        const { night, dusk, lit } = viewTone(phase);
        viewTrees(c, W, H, H * .5, Math.round(W / 70), phase, 31, .7);
        // Historic stone hall with a clock tower.
        const sx = W * .06, sy = H * .3, sw = W * .4, sh = H * .28, stone = night ? '#4a4840' : dusk ? '#b5a58a' : '#cfc2a4';
        c.fillStyle = stone; c.fillRect(sx, sy, sw, sh); c.fillRect(sx + sw * .42, H * .08, sw * .16, sh + sy - H * .08);
        c.fillStyle = night ? '#1f2629' : '#5a6466'; c.beginPath(); c.moveTo(sx + sw * .4, H * .08); c.lineTo(sx + sw * .5, H * .0); c.lineTo(sx + sw * .6, H * .08); c.fill(); c.beginPath(); c.moveTo(sx - 6, sy); c.lineTo(sx + sw / 2, sy - sh * .22); c.lineTo(sx + sw + 6, sy); c.fill();
        dot(c, sx + sw * .5, H * .15, H * .03, night ? '#e9d79c' : '#efe6cf');
        for (let k = 0; k < 10; k++) { if (k === 4 || k === 5) continue; const on = lit && rnd(k * 5.1) < .45, wx = sx + sw * (.04 + k * .096); c.fillStyle = on ? '#ffd88a' : night ? '#29343c' : '#a9bcc4'; c.fillRect(wx, sy + sh * .3, sw * .045, sh * .45); c.beginPath(); c.arc(wx + sw * .0225, sy + sh * .3, sw * .0225, Math.PI, TAU); c.fill(); }
        // Modern glass laboratory (mostly lit at night).
        viewBuilding(c, W * .55, H * .2, W * .4, H * .38, { wall: '#7f97a4', roof: '#3a4650', rows: 5, cols: 14, phase, litShare: .85, seed: 7, glass: true });
        c.fillStyle = night ? '#39434a' : '#dfe5e6'; for (let k = 0; k <= 14; k++) c.fillRect(W * .55 + k * W * .4 / 14 - 1, H * .2, 2, H * .38);
        viewGround(c, W, H, H * .58, phase, '#7da35c');
        // Fountain on the lawn and mature oaks.
        c.fillStyle = night ? '#4a4c46' : '#d8cdb2'; c.beginPath(); c.ellipse(W * .5, H * .78, W * .07, H * .035, 0, 0, TAU); c.fill();
        c.fillStyle = night ? '#24384a' : '#7fb6d6'; c.beginPath(); c.ellipse(W * .5, H * .775, W * .06, H * .026, 0, 0, TAU); c.fill();
        c.strokeStyle = night ? '#8fa6b6' : '#e6f3fa'; c.lineWidth = 2; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(W * .5, H * .76); c.quadraticCurveTo(W * .5 + k * H * .015, H * .64, W * .5 + k * H * .03, H * .77); c.stroke(); }
        viewTrees(c, W, H, H * .7, 3, phase, 35, 2.4);
        c.fillStyle = night ? '#4a4c46' : '#d8cdb2'; c.fillRect(0, H * .9, W, H * .03);
    }
};

// ---- Stage finishes: materials, wainscot, window view, glazing ---------
// Materials are made once per room (cached on kit.edu) and carry their UV
// period in userData.eduUV; `applyUV` box-projects every such mesh after the
// build (geometry is never shared between furnishings here).
function finishKit(kit, E) {
    if (E.S) return E.S;
    const cache = new Map(), id = kit.spec.id, P = PALETTE[id] || PALETTE.highschool;
    // name → material; draw(c, W, H) at [W, H] px covering [pu, pv] mm.
    const mapped = (name, draw, [W, H], [pu, pv], { roughness = .8, surface = null, rough = null, color = '#ffffff', ...extra } = {}) => {
        if (cache.has(name)) return cache.get(name);
        const map = canvasTexture(draw, W, H);
        const m = kit.material(color, { map, roughness, ...extra }); if (surface) m.userData.roomSurface = surface;
        if (rough) m.roughnessMap = canvasTexture(rough, Math.max(64, W / 2), Math.max(64, H / 2), false);
        m.userData.eduUV = [pu, pv]; cache.set(name, m); return m;
    };
    const S = E.S = { mapped, P };
    const t = P.top;
    S.top = t.hpl
        ? mapped('top', (c, W, H) => drawFleck(c, W, H, { base: t.hpl, flecks: [shade(t.hpl, -.06) + '90', shade(t.hpl, -.12) + '60', '#ffffff80'], count: W * H / 9, size: [1, 1.8], seed: t.seed }), [512, 512], [400, 400], { roughness: .42 })
        : mapped('top', (c, W, H) => drawWood(c, W, H, t), [1024, 512], [1400, 700], { roughness: t.streak ? .42 : .5 });
    S.oakStage = P.stage && mapped('oak-stage', (c, W, H) => drawPlanks(c, W, H, P.stage), [1024, 1024], [1600, 1600], { roughness: .5, surface: 'wood', rough: (c, W, H) => drawPlanks(c, W, H, P.stage, true) });
    // Upholstery / shells, tinted per chair colour over a shared grey map.
    const weave = cache.get('weave') || canvasTexture((c, W, H) => { c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { c.fillStyle = (x + y) % 8 ? '#f4f4f4' : '#b8b8b8'; c.fillRect(x, y, 3, 3); } for (let i = 0; i < W * H / 8; i++) { c.fillStyle = i % 2 ? '#ffffff30' : '#00000024'; c.fillRect(rnd(i * 1.3) * W, rnd(i * 2.9) * H, 1, 2); } }, 128, 128);
    const pebble = canvasTexture((c, W, H) => { c.fillStyle = '#d6d6d6'; c.fillRect(0, 0, W, H); for (let i = 0; i < W * H / 14; i++) { c.fillStyle = i % 3 ? '#ffffff26' : '#0000002e'; c.beginPath(); c.ellipse(rnd(i * 1.1) * W, rnd(i * 2.3) * H, 1 + rnd(i) * 2.2, .8 + rnd(i * 3) * 1.6, rnd(i * 5) * 3, 0, TAU); c.fill(); } for (let i = 0; i < 14; i++) { c.strokeStyle = '#00000018'; c.lineWidth = 1; c.beginPath(); const x = rnd(i * 7) * W, y = rnd(i * 9) * H; c.moveTo(x, y); c.quadraticCurveTo(x + 20, y + (rnd(i) - .5) * 20, x + 40, y + (rnd(i * 2) - .5) * 30); c.stroke(); } }, 256, 256);
    S.shell = color => {
        const key = 'shell' + color; if (cache.has(key)) return cache.get(key);
        let m;
        if (P.shell === 'fabric') { m = kit.material(color, { map: weave, roughness: .95 }); m.userData.eduUV = [40, 40]; m.userData.roomSurface = 'fabric'; }
        else if (P.shell === 'leather') { m = kit.material(shade(color, .06), { map: pebble, roughness: .55 }); m.userData.eduUV = [220, 220]; }
        else m = kit.material(color, { roughness: .4 }); // polypropylene, untagged keeps its sheen
        cache.set(key, m); return m;
    };
    // Floor zones (flat assets).
    S.vinyl = () => mapped('vinyl', (c, W, H) => drawFleck(c, W, H, { base: '#cfe0d8', flecks: ['#9fbcb0a0', '#ffffffa0', '#7f9c90a0', '#e9b9a080'], count: W * H / 90, size: [1, 3], seed: 2 }), [512, 512], [600, 600], { roughness: .38, surface: 'stone' });
    S.lino = () => mapped('lino', (c, W, H) => drawFleck(c, W, H, { base: '#d7e3c8', flecks: ['#b9c9a8a0', '#f2f6ea90'], count: W * H / 40, size: [1, 2], marble: ['#c2d2b0aa', '#e6eedbb0', '#b3c49e80'], seed: 4 }), [512, 512], [700, 700], { roughness: .42, surface: 'stone' });
    S.rubber = () => mapped('rubber', (c, W, H) => drawStudRubber(c, W, H), [512, 512], [500, 500], { roughness: .85, rough: (c, W, H) => drawStudRubber(c, W, H, true) });
    S.slate = () => mapped('slate', (c, W, H) => drawSlate(c, W, H), [1024, 1024], [1200, 1200], { roughness: .78, rough: (c, W, H) => drawSlate(c, W, H, true) });
    return S;
}
// Box-project every mapped mesh (tables, flats, wainscot, chairs …).
function applyUV(root) {
    root.traverse(o => {
        const p = o.isMesh && o.material?.userData?.eduUV; if (!p || o.geometry.userData.eduUV) return;
        uvBox(o.geometry, p[0], p[1]); o.geometry.userData.eduUV = true;
    });
}
// Wainscot and wall finish along the three walls (non-assets: they belong to
// the cutaway wall groups). The door span is skipped; under the glazing the
// finish stops below the sill (800). `skip` holds back-wall x ranges.
function wainscot(kit, mat, height, { depth = 8, cap = null, capH = 32, capD = 22, skip = [], sides = ['back', 'right', 'left'], lift = 0 } = {}) {
    const { w, bz, front, d } = kit, doorZ = front - 1600, win = [bz + d * .3, bz + d * .78];
    const runs = { back: [], right: [], left: [] };
    const cut = (a, b, holes) => { let segs = [[a, b]]; for (const [h0, h1] of holes) segs = segs.flatMap(([s, e]) => h1 <= s || h0 >= e ? [[s, e]] : [[s, h0], [h1, e]].filter(([x0, x1]) => x1 - x0 > 60)); return segs; };
    if (sides.includes('back')) runs.back = cut(-w / 2, w / 2, skip).map(s => [...s, height]);
    if (sides.includes('right')) runs.right = cut(bz, front, [[doorZ - 560, doorZ + 560]]).map(s => [...s, height]);
    if (sides.includes('left')) runs.left = height + lift > 790 ? [[bz, win[0], height], [win[0], win[1], Math.min(height, 790 - lift)], [win[1], front, height]] : [[bz, front, height]];
    const parts = { back: [], right: [], left: [] }, caps = { back: cap && detailKit(), right: cap && detailKit(), left: cap && detailKit() };
    for (const side of ['back', 'right', 'left']) for (const [a, b, hgt] of runs[side]) {
        if (hgt <= 0) continue;
        const len = b - a, mid = (a + b) / 2, y = lift + hgt / 2;
        const g = side === 'back' ? new THREE.BoxGeometry(len, hgt, depth) : new THREE.BoxGeometry(depth, hgt, len);
        const at = side === 'back' ? [mid, y, bz + 18 + depth / 2] : side === 'right' ? [w / 2 - 4 - depth / 2, y, mid] : [-w / 2 + 4 + depth / 2, y, mid];
        g.translate(...at); uvBox(g, mat.userData.eduUV[0], hgt, [0, -lift, 0]); g.userData.eduUV = true; parts[side].push(g);
        const k = caps[side]; if (!k || hgt < height) continue;
        const top = lift + hgt + capH / 2, cd = side === 'back' ? [len + 4, capH, capD] : [capD, capH, len + 4];
        const ca = side === 'back' ? [mid, top, bz + 18 + capD / 2] : side === 'right' ? [w / 2 - 4 - capD / 2, top, mid] : [-w / 2 + 4 + capD / 2, top, mid];
        k.box(cd, ca, cap); k.box(side === 'back' ? [len + 4, 6, capD + 6] : [capD + 6, 6, len + 4], [ca[0] + (side === 'right' ? -3 : side === 'left' ? 3 : 0), top + capH / 2 - 3, ca[2] + (side === 'back' ? 3 : 0)], shade(cap, .04));
    }
    const walls = { back: kit.back, right: kit.right, left: kit.left };
    for (const side of ['back', 'right', 'left']) {
        if (parts[side].length) {
            const geo = mergeGeometries(parts[side], false); parts[side].forEach(p => p.dispose()); geo.userData.eduUV = true;
            const m = new THREE.Mesh(geo, mat); m.name = 'Wainscot wall finish'; m.receiveShadow = true; m.castShadow = false; walls[side].add(m);
        }
        if (caps[side]) { const g = new THREE.Group(); g.name = 'Wainscot cap rail'; walls[side].add(g); caps[side].build(g, kit.edu.dress); }
    }
}
// Per stage wall treatment (brief §x.4 Materials).
const WALLS = {
    kindergarten(kit, E, S) {
        const ply = S.mapped('birch-ply', drawBirchWainscot, [1024, 512], [1000, 900], { roughness: .6 });
        wainscot(kit, ply, 900, { cap: '#c99a5b' });
    },
    elementary(kit, E, S) {
        const tack = S.mapped('tack-board', (c, W, H) => drawFelt(c, W, H, '#7c9b7e', '#a9c2aa', '#566f58'), [512, 512], [600, 1000], { roughness: .95, surface: 'fabric' });
        wainscot(kit, tack, 1000, { cap: '#b48f62', depth: 10 });
        pinnedSheets(kit, E, 'elementary');
    },
    middleschool(kit, E, S) {
        // 300 rubber skirting all round, and a write-on feature wall behind the board.
        const rubber = kit.material('#3e5f6a', { roughness: .8 }); rubber.userData.eduUV = [300, 300];
        wainscot(kit, rubber, 300, { depth: 10 });
        const dado = kit.back.children.find(o => o.isMesh && o.material === kit.accent && Math.abs(o.position.y - 325) < 1); if (dado) dado.visible = false;
        const g = new THREE.Group(); g.name = 'Write-on feature wall'; kit.back.add(g);
        const x0 = -1300, x1 = 3000, W = x1 - x0, cx = (x0 + x1) / 2, y0 = 780, Hh = 1720;
        const wo = kit.material('#ffffff', { map: canvasTexture(drawWriteOn, 2048, Math.round(2048 * Hh / W)), roughness: .22, metalness: 0 });
        kit.mesh(g, new THREE.PlaneGeometry(W, Hh), wo, [cx, y0 + Hh / 2, kit.bz + 21]).castShadow = false;
        const k = detailKit(), al = '#b9c2c6';
        k.box([W + 12, 12, 10], [cx, y0 + Hh + 6, kit.bz + 23], al); k.box([W + 12, 12, 10], [cx, y0 - 6, kit.bz + 23], al);
        for (const x of [x0 - 6, x1 + 6]) k.box([12, Hh + 24, 10], [x, y0 + Hh / 2, kit.bz + 23], al);
        k.box([W * .6, 18, 70], [cx - W * .15, y0 - 20, kit.bz + 55], '#c8cfd2'); k.box([W * .6, 30, 6], [cx - W * .15, y0 - 4, kit.bz + 88], '#c8cfd2');
        ['#2f5f9e', '#c2412f', '#2e8a57', '#20323a', '#e07a3f'].forEach((col, n) => { k.add(new THREE.CylinderGeometry(9, 9, 130, 8), [cx - W * .38 + n * 46, y0 - 1, kit.bz + 50], col, [1, 1, 1], [0, 0, Math.PI / 2]); k.box([30, 18, 18], [cx - W * .38 + n * 46 + 74, y0 - 1, kit.bz + 50], '#f4f4f0'); });
        k.box([150, 50, 60], [cx - W * .38 + 280, y0 + 15, kit.bz + 52], '#3f4b52'); k.box([140, 10, 56], [cx - W * .38 + 280, y0 - 12, kit.bz + 52], '#f4f4f0');
        k.build(g, E.dress);
    },
    highschool(kit, E, S) {
        const dado = S.mapped('dado', (c, W, H) => drawPaint(c, W, H, '#567081'), [256, 256], [800, 900], { roughness: .62 });
        const cork = S.mapped('cork', drawCork, [512, 256], [600, 200], { roughness: .9 });
        wainscot(kit, dado, 900, { cap: '#c8cfd2', capH: 10, capD: 14 }); wainscot(kit, cork, 200, { lift: 900, cap: '#c8cfd2', capH: 14, capD: 16, depth: 10 });
        pinnedSheets(kit, E, 'highschool');
    },
    college(kit, E, S) {
        // Oak slat wainscot to 1100 on the teaching wall; limewash terracotta panel.
        slatWall(kit, E, S, -kit.w / 2 + 40, -1460, 1100); slatWall(kit, E, S, 1460, kit.w / 2 - 40, 1100);
        const tc = byName(kit, 'teaching-wall-accent'); const panel = tc?.children.find(o => o.isMesh);
        if (panel) { panel.material = S.mapped('terracotta', (c, W, H) => drawPlaster(c, W, H, '#a5624a'), [512, 512], [1500, 1500], { roughness: .9 }); }
        const side = S.mapped('college-dado', (c, W, H) => drawPaint(c, W, H, '#cfc6b7'), [256, 256], [800, 1100], { roughness: .7 });
        wainscot(kit, side, 1100, { sides: ['right', 'left'], cap: '#b08d63', capH: 26, capD: 18 });
    },
    university(kit, E, S) {
        const panels = S.mapped('green-panels', (c, W, H) => drawPanelledWainscot(c, W, H, '#285c4b'), [512, 256], [1300, 900], { roughness: .62 });
        wainscot(kit, panels, 900, { cap: '#7a5638', capH: 40, capD: 34, depth: 18 });
        // Plaster cornice on the back and side walls.
        // Each wall carries its own run, so the cutaway removes it with the wall.
        const { w, bz, d, ceiling } = kit, cream = '#ebe6d7';
        const b = detailKit(); b.box([w, 70, 60], [0, ceiling - 35, bz + 30], cream).box([w, 30, 90], [0, ceiling - 85, bz + 45], shade(cream, -.03)).box([w, 14, 110], [0, ceiling - 107, bz + 55], cream);
        const runs = [[b, kit.back]];
        for (const [s, parent] of [[1, kit.right], [-1, kit.left]]) { const k = detailKit(); k.box([60, 70, d], [s * (w / 2 - 30), ceiling - 35, bz + d / 2], cream).box([90, 30, d], [s * (w / 2 - 45), ceiling - 85, bz + d / 2], shade(cream, -.03)).box([110, 14, d], [s * (w / 2 - 55), ceiling - 107, bz + d / 2], cream); runs.push([k, parent]); }
        for (const [k, parent] of runs) { const g = new THREE.Group(); g.name = 'Plaster cornice'; parent.add(g); k.build(g, E.dress); }
    }
};
const byName = (kit, id) => kit.byId(id);
// Oak acoustic slats (60 wide, 22 deep at 120) on a dark felt backing.
function slatWall(kit, E, S, x0, x1, height, parent = kit.back, z = kit.bz + 18) {
    const oak = S.mapped('slat-oak', (c, W, H) => drawWood(c, W, H, { base: '#b08d63', dark: '#6b4b2c', light: '#e8c99a', vertical: true, seed: 21 }), [256, 1024], [240, 1200], { roughness: .55 });
    const felt = S.mapped('slat-felt', (c, W, H) => drawFelt(c, W, H, '#2e2620', '#4a3d33', '#1c1612'), [256, 256], [300, 300], { roughness: .95 });
    const parts = [];
    for (let x = x0 + 60; x < x1 - 30; x += 120) { const g = new THREE.BoxGeometry(60, height, 22); g.translate(x, height / 2, z + 10 + 11); parts.push(g); }
    const geo = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); uvBox(geo, 240, 1200); geo.userData.eduUV = true;
    const slats = new THREE.Mesh(geo, oak); slats.name = 'Oak slat wainscot'; slats.castShadow = slats.receiveShadow = true; parent.add(slats);
    const back = new THREE.BoxGeometry(x1 - x0, height, 10); back.translate((x0 + x1) / 2, height / 2, z + 5); uvBox(back, 300, 300); back.userData.eduUV = true;
    const b = new THREE.Mesh(back, felt); b.name = 'Slat felt backing'; b.receiveShadow = true; parent.add(b);
    const cap = new THREE.BoxGeometry(x1 - x0 + 20, 24, 40); cap.translate((x0 + x1) / 2, height + 12, z + 20); uvBox(cap, 1400, 700); cap.userData.eduUV = true;
    parent.add(new THREE.Mesh(cap, S.top));
}
// Sheets pinned to the tack-board / cork: worksheets, drawings and notices,
// each with a coloured push pin; generic content.
function pinnedSheets(kit, E, stage) {
    const { w, bz, front } = kit, young = stage === 'elementary';
    const yMid = young ? 560 : 1000, list = [];
    // [wall, along, y, w, h, rot]
    if (young) { for (let n = 0; n < 7; n++) list.push(['right', -900 + n * 500, yMid + (n % 2) * 70, 210, 297, (rnd(n) - .5) * .12]); for (let n = 0; n < 6; n++) list.push(['back', -3600 + n * 330, yMid + (n % 3) * 40, 210, 297, (rnd(n + 9) - .5) * .12]); }
    else { for (let n = 0; n < 9; n++) list.push(['back', -1250 + n * 310, yMid, 210, 150, (rnd(n) - .5) * .08]); for (let n = 0; n < 8; n++) list.push(['right', -1100 + n * 420, yMid, 150, 180, (rnd(n + 4) - .5) * .1]); }
    const sheet = kit.material('#ffffff', { map: canvasTexture((c, W, H) => {
        // 4 x 2 atlas: worksheets, drawings, notices.
        for (let n = 0; n < 8; n++) {
            const x = (n % 4) * W / 4, y = Math.floor(n / 4) * H / 2, cw = W / 4, ch = H / 2; c.fillStyle = ['#fffdf6', '#fdf7e4', '#f4f8fb', '#fff8f0'][n % 4]; c.fillRect(x, y, cw, ch);
            if (n % 3 === 0) { childPainting(c, x + 14, y + 14, cw - 28, ch * .5, n + (young ? 0 : 4)); textLines(c, x + 18, y + ch * .66, cw - 36, 4, 14, '#7d8a8c', 3); }
            else if (n % 3 === 1) { write(c, young ? ['My story', 'Maths', 'Spelling', 'Plants'][n % 4] : ['LAB 4', 'DATA', 'NOTICE', 'CLUB'][n % 4], x + cw / 2, y + 26, 20, young ? '#5d8b78' : '#567081'); textLines(c, x + 16, y + 52, cw - 32, 9, 16, '#8a9597', 3); }
            else { c.strokeStyle = '#c9d4d8'; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(x + 10, y + 30 + k * 26); c.lineTo(x + cw - 10, y + 30 + k * 26); c.stroke(); } c.strokeStyle = young ? '#e07a3f' : '#d9a441'; c.lineWidth = 3; c.beginPath(); for (let k = 0; k < 10; k++) c.lineTo(x + 20 + k * (cw - 40) / 9, y + ch * .75 - rnd(n * 10 + k) * ch * .5); c.stroke(); c.lineWidth = 1; }
        }
    }, 1024, 512), roughness: .9, side: THREE.DoubleSide });
    const pins = { back: detailKit(), right: detailKit() }, parts = [];
    list.forEach(([wall, along, y, sw, sh, rot], n) => {
        const cell = n % 8, g = new THREE.PlaneGeometry(sw, sh), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, ((cell % 4) + .02 + uv.getX(i) * .96) / 4, (cell < 4 ? .5 : 0) + (.02 + uv.getY(i) * .96) / 2);
        g.rotateZ(rot);
        const pinCol = PASTEL[n % 6];
        if (wall === 'back') { g.translate(along, y, bz + (young ? 30 : 30)); pins.back.ball(7, [along + Math.sin(-rot) * sh * .42, y + sh * .42, bz + 34], pinCol, [1, 1, .6]); }
        else { g.rotateY(-Math.PI / 2); g.translate(w / 2 - 16, y, along); pins.right.ball(7, [w / 2 - 20, y + sh * .42, along], pinCol, [.6, 1, 1]); }
        parts.push(g);
    });
    // Back-wall and side-wall sheets merge into one mesh per wall group.
    const back = [], right = []; parts.forEach((g, n) => (list[n][0] === 'back' ? back : right).push(g));
    for (const [arr, parent] of [[back, kit.back], [right, kit.right]]) { if (!arr.length) continue; const geo = mergeGeometries(arr, false); arr.forEach(a => a.dispose()); const m = new THREE.Mesh(geo, sheet); m.name = 'Pinned sheets'; m.castShadow = false; m.receiveShadow = true; parent.add(m); }
    for (const [side, parent] of [['back', kit.back], ['right', kit.right]]) { const pg = new THREE.Group(); pg.name = 'Push pins'; parent.add(pg); pins[side].build(pg, E.dress); }
}
// The stage's own window outlook (replaces the shared campus drawing on the
// daylight pane; the shared hook still updates its own unused canvas).
function installView(kit, E) {
    const pane = kit.window.children.find(o => o.isMesh && o.material === kit.sky); if (!pane || !VIEWS[kit.spec.id]) return;
    const aspect = kit.d * .48 / 1750, H = 512, W = Math.min(2048, Math.round(H * aspect / 16) * 16);
    const map = canvasTexture(() => {}, W, H); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    // Unlit by the room: the outlook carries only its own (daypart) emission, like real glazing.
    const m = kit.material('#000000', { emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .9, roughness: .9 });
    pane.material = m; E.view = { m, map, W, H, phase: null };
    kit.sky.map?.dispose(); kit.sky.dispose(); // the shared canvas is still drawn, never uploaded
}
function drawView(kit, E, phase) {
    const v = E.view; if (!v || v.phase === phase) return; v.phase = phase;
    const c = v.map.image.getContext('2d'), sky = kit.spec.modes[phase]?.sky || ['#bad8e5', '#f5e6ca'];
    c.save(); viewSky(c, v.W, v.H, phase, sky); VIEWS[kit.spec.id](c, v.W, v.H, phase); c.restore(); reset(c);
    v.map.needsUpdate = true;
    // The outlook reads as daylight beyond the glass; at night only lit windows and lamps carry.
    v.m.emissiveIntensity = LIGHT[kit.spec.id]?.view[Math.max(0, PHASES.indexOf(phase))] ?? .9;
}
// Glass-door cabinet (high-school equipment, university archive): the solid
// doors are replaced by framed glazing with shelves and visible contents.
function glazeCabinet(kit, E, cab, contents) {
    if (!cab) return;
    const width = 1250, depth = 420, height = kit.options.storage.height;
    for (const o of [...cab.children]) if (o.isMesh && (o.material === kit.trim || o.material === kit.metal) && o.position.z > depth / 2 - 30) { cab.remove(o); o.geometry.dispose(); }
    const k = detailKit(), frame = '#2f3b44', iw = width - 60;
    for (let s = 1; s <= 3; s++) k.box([iw, 18, depth - 40], [0, 45 + s * (height - 90) / 4, -5], '#b99a72');
    for (const side of [-1, 1]) {
        const cx = side * width / 4, dw = width / 2 - 30, dh = height - 90, z = depth / 2 + 8;
        k.box([40, dh, 22], [cx - dw / 2 + 20, height / 2, z], frame); k.box([40, dh, 22], [cx + dw / 2 - 20, height / 2, z], frame);
        k.box([dw, 50, 22], [cx, height / 2 + dh / 2 - 25, z], frame); k.box([dw, 60, 22], [cx, height / 2 - dh / 2 + 30, z], frame);
        k.box([14, 260, 24], [side * 40, height / 2, z + 18], '#c8cfd2'); k.box([14, 10, 30], [side * 40, height / 2 + 120, z + 8], '#c8cfd2'); k.box([14, 10, 30], [side * 40, height / 2 - 120, z + 8], '#c8cfd2');
        k.box([30, 60, 20], [side * (width / 2 - 26), height * .5, z], '#9aa8b0');
    }
    const runs = contents(k, height, (height - 90) / 4, iw);
    k.build(cab, E.dress);
    if (runs?.length) { const b = bookRuns(runs, E.spines()); if (b) cab.add(b); }
    const glass = kit.material('#dfeff2', { transparent: true, opacity: .16, roughness: .04, metalness: .1, depthWrite: false });
    for (const side of [-1, 1]) { const p = kit.mesh(cab, new THREE.PlaneGeometry(width / 2 - 110, height - 200), glass, [side * width / 4, height / 2 + 5, depth / 2 + 6]); p.castShadow = false; p.receiveShadow = false; }
}
const CABINET = {
    highschool: (k, height, gap, iw) => {
        for (let s = 0; s < 4; s++) {
            const y = s ? 45 + s * gap + 9 : 45;
            for (let n = 0; n < 5; n++) {
                const x = -iw / 2 + 80 + n * (iw - 160) / 4, kind = (s * 5 + n) % 5;
                if (kind === 0) { k.box([180, 120, 240], [x, y + 60, -20], ['#d9a441', '#567081', '#c97c5d'][s % 3]); k.box([110, 40, 3], [x, y + 80, 101], '#f4f1e8'); }
                if (kind === 1) for (let q = 0; q < 3; q++) { k.cyl(28, 32, 110 - q * 15, [x - 50 + q * 50, y + 55, 0], '#d7eaef'); k.cyl(30, 30, 6, [x - 50 + q * 50, y + 10 + q * 3, 0], '#9fd3c7'); }
                if (kind === 2) { k.box([150, 110, 90], [x, y + 55, 0], '#f0c24b'); k.box([100, 50, 4], [x, y + 75, 46], '#1f2f2a'); for (let q = 0; q < 2; q++) k.cyl(8, 8, 60, [x - 40 + q * 80, y + 140, 40], q ? '#d9534f' : '#2f3b44'); }
                if (kind === 3) { k.box([80, 20, 140], [x, y + 10, 0], '#3f4b52'); k.cyl(12, 12, 180, [x, y + 110, -30], '#4b5a63'); k.box([40, 60, 40], [x, y + 200, 0], '#3f4b52'); k.cyl(20, 14, 70, [x, y + 140, 30], '#2f3b44'); }
                if (kind === 4) { k.add(new THREE.TorusGeometry(45, 9, 6, 18, Math.PI), [x, y + 55, 0], '#d9534f', [1, 1, 1], [0, 0, Math.PI]); k.cyl(36, 36, 50, [x + 80, y + 25, 0], '#b06a36'); }
            }
        }
    },
    university: (k, height, gap, iw) => {
        for (let n = 0; n < 4; n++) { k.box([250, 260, 340], [-iw / 2 + 150 + n * 290, 45 + 130, -10], n % 2 ? '#c9b48f' : '#b3a07c'); k.box([150, 50, 3], [-iw / 2 + 150 + n * 290, 45 + 180, 161], '#efe8d6'); }
        return [1, 2, 3].map(s => ({ x0: -iw / 2 + 20, x1: iw / 2 - 20, y: 45 + s * gap + 9, front: 170, depth: 300, hMin: 230, hMax: Math.min(380, gap - 40), seed: s + 40 }));
    }
};
// Child stools and the TA stool: re-tint the GLB's coral 'carpet' seat (shared
// library materials are cloned and owned by the room).
function tintProps(kit) {
    const tints = { elementary: { 'kenney-furniture-stool-bar-square': ['#5d8b78', '#e0b45e', '#88a9bf', '#7fb3a5'] }, college: { 'kenney-furniture-stool-bar': ['#866653'] } }[kit.spec.id];
    if (!tints) return;
    let n = 0;
    kit.room.decorateProp = (object, placement) => {
        const cols = tints[placement.id]; if (!cols) return; const col = cols[n++ % cols.length];
        object.traverse(o => {
            if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
            const next = mats.map(m => { const c = m.clone(); if (/carpet/i.test(m.name)) { c.color.set(col); c.roughness = .55; } else if (/wood/i.test(m.name)) c.color.set(kit.spec.id === 'college' ? '#6b4a33' : '#d9bf92'); kit.room.ownedMaterials?.add(c); return c; });
            o.material = Array.isArray(o.material) ? next : next[0];
        });
    };
}

// Picture-book covers (4 x 4 atlas): child-art illustration, title band,
// spine shadow; generic titles drawn as bars.
function drawCovers(c, W, H) {
    const cw = W / 4, ch = H / 4, bgs = ['#f6d76b', '#9fd3c7', '#f4a6a0', '#b8d38f', '#c6d7e6', '#e8c6d8', '#f2c6a0', '#d9e8c4'];
    for (let n = 0; n < 16; n++) {
        const x = (n % 4) * cw, y = Math.floor(n / 4) * ch; c.fillStyle = bgs[n % 8]; c.fillRect(x, y, cw, ch);
        childPainting(c, x + 18, y + ch * .3, cw - 36, ch * .6, n + 2);
        c.fillStyle = '#fffaf0e0'; c.fillRect(x + 12, y + 12, cw - 24, ch * .2);
        c.fillStyle = ['#d9534f', '#4f8fc0', '#6aa56a', '#b07cc6'][n % 4]; c.fillRect(x + 24, y + 24, (cw - 48) * (.55 + rnd(n) * .4), 14); c.fillStyle = '#7d8a8c'; c.fillRect(x + 24, y + 46, (cw - 48) * .4, 7);
        c.fillStyle = '#00000022'; c.fillRect(x, y, 10, ch); c.fillStyle = '#ffffff30'; c.fillRect(x + 10, y, 3, ch);
    }
}
// Door-side services in one column beside the door frame: light switches,
// fire-alarm call point, thermostat and alarm strobe (generic, illustrative).
function doorServices(kit, E) {
    const { w, front } = kit, side = kit.spec.id === 'elementary' ? -1 : 1, z = front - 1600 + side * 575, x = w / 2 - 22, k = detailKit();
    const plate = (dz, y, [pw, ph], col, depth = 10) => k.box([depth, ph, pw], [x - depth / 2, y, z + dz], col);
    plate(0, 1100, [86, 86], '#f1f0ea'); plate(-14, 1100, [16, 34], '#d9d6cc', 16); plate(14, 1100, [16, 34], '#d9d6cc', 16);
    plate(0, 1300, [90, 90], '#c8342b', 26); plate(0, 1300, [58, 44], '#f2efe8', 30);
    plate(0, 1520, [84, 110], '#e9e7df', 24); plate(0, 1540, [48, 26], '#7ec4ba', 26); plate(0, 1490, [40, 10], '#9aa8b0', 26);
    plate(0, 2160, [100, 140], '#c8342b', 30); plate(0, 2190, [64, 36], '#f4f4f0', 34);
    const g = new THREE.Group(); g.name = 'Door services'; kit.right.add(g); k.build(g, E.dress);
}

// ---- Builder kit (materials, wall assets, glow, daypart toggles) ---------
function eduKit(kit) {
    if (kit.edu) return kit.edu;
    const cache = new Map();
    const M = (color, surface = 'powder', extra = {}) => {
        const key = color + surface + JSON.stringify(extra);
        if (!cache.has(key)) cache.set(key, kit.mat(color, surface, { roughness: .8, ...extra }));
        return cache.get(key);
    };
    const dress = kit.material('#ffffff', { vertexColors: true, roughness: .72 }); dress.userData.roomSurface = 'powder';
    const ceiling = new THREE.Group(); ceiling.name = 'Ceiling classroom decor'; kit.root.add(ceiling);
    const E = kit.edu = { M, dress, ceiling, glows: [], shows: [], chairsUp: [] };
    E.build = (k, parent) => k.build(parent, dress);
    E.tex = (draw, width = 512, height = 512, surface = 'plaster', roughness = .88) => {
        const map = institutionalMap(draw, width, height); map.anisotropy = 4;
        const m = kit.material('#ffffff', { map, roughness }); m.userData.roomSurface = surface; return m;
    };
    // Wall-mounted asset. `along` is x on the back wall, z on side walls.
    E.wall = (wall, id, name, along, y, depth = 24) => {
        const { w, bz } = kit;
        if (wall === 'back') return kit.asset(id, name, [along, y, bz + 22 + depth / 2], kit.back);
        const right = wall === 'right', g = kit.asset(id, name, [right ? w / 2 - 22 - depth / 2 : -w / 2 + 22 + depth / 2, y, along], right ? kit.right : kit.left);
        g.rotation.y = right ? -Math.PI / 2 : Math.PI / 2; return g;
    };
    // A printed panel (canvas) on a group, optionally framed.
    E.panel = (g, W, H, draw, { frame = null, border = 24, depth = 22, res = 1024, at = [0, 0, 0], rough = .86 } = {}) => {
        const wide = W >= H, cw = wide ? res : Math.max(64, Math.round(res * W / H)), ch = wide ? Math.max(64, Math.round(res * H / W)) : res;
        if (frame) kit.box(g, [W + border * 2, H + border * 2, depth], at, frame === 'oak' ? kit.oak : M(frame, frame === '#b39b6a' ? 'metal' : 'wood', frame === '#b39b6a' ? { metalness: .6, roughness: .35 } : {}), 4);
        const p = kit.mesh(g, new THREE.PlaneGeometry(W, H), E.tex(draw, cw, ch, 'plaster', rough), [at[0], at[1], at[2] + (frame ? depth / 2 : 0) + 1.5]);
        p.castShadow = false; return p;
    };
    // Flat floor zone or rug (< 35 mm high, so it is not a collider).
    E.flat = (id, name, [x, z], [sx, sz], look, { round = false, height = 6, lift = 0, res = 1024 } = {}) => {
        const g = kit.asset(id, name, [x, 0, z]);
        const m = typeof look === 'function' ? E.tex(look, res, round ? res : Math.max(64, Math.round(res * sz / sx)), 'fabric', .95) : look?.isMaterial ? look : M(look, 'fabric', { roughness: .9 });
        const geo = round ? new THREE.CylinderGeometry(sx / 2, sx / 2, height, 64) : new THREE.BoxGeometry(sx, height, sz);
        const mesh = kit.mesh(g, geo, m, [0, lift + height / 2, 0]); mesh.castShadow = false; mesh.receiveShadow = true; return g;
    };
    // Emissive material whose intensity follows the daypart (5 levels).
    E.glow = (color, levels, extra = {}) => { const m = kit.material(color, { emissive: color, emissiveIntensity: levels[0], roughness: .5, ...extra }); E.glows.push({ m, levels }); return m; };
    E.show = (obj, phases) => { E.shows.push({ obj, phases }); return obj; };
    // Additive light pool (coworking technique): a soft radial quad that fakes a
    // fixture's falloff on a wall, floor or worktop; colour × level per daypart.
    // face: floor | back (faces +z) | right (faces −x) | left (faces +x) | [rx, ry, rz].
    // A pool for a furnishing (an asset: table, rug, lamp, cabinet …) is not
    // parented to it: it would grow the asset's bounds (drag box, collisions,
    // tests). It lives in one non-interactive layer and copies the asset's
    // transform just before it is drawn, so it still follows a moved furnishing
    // and hides with it.
    E.pools = [];
    // Light overlays are not furniture: no Groove obstacle, no interaction, no ray hits.
    E.poolLayer = new THREE.Group(); E.poolLayer.name = 'Daylight and lamp light pools'; E.poolLayer.userData.grooveMarker = true; kit.root.add(E.poolLayer);
    E.pool = (parent, at, [sx, sy], color, levels, face = 'floor') => {
        E.poolGeo ||= new THREE.PlaneGeometry(1, 1);
        const m = new THREE.MeshBasicMaterial({ map: poolTexture(), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        m.userData.sharedTextures = true;
        const o = new THREE.Mesh(E.poolGeo, m); o.name = 'Light pool'; o.position.set(...at); o.scale.set(sx, sy, 1); o.renderOrder = 2; o.castShadow = o.receiveShadow = false; o.raycast = noRay;
        o.rotation.set(...(Array.isArray(face) ? face : { floor: [-Math.PI / 2, 0, 0], back: [0, 0, 0], right: [0, -Math.PI / 2, 0], left: [0, Math.PI / 2, 0] }[face]));
        if (parent.userData.propId) {
            o.updateMatrix(); const local = o.matrix.clone(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
            o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false;
            o.onBeforeRender = () => { let shown = true; for (let q = parent; q; q = q.parent) if (!q.visible) { shown = false; break; } o.matrixWorld.multiplyMatrices(parent.matrixWorld, shown && parent.parent ? local : zero); };
            E.poolLayer.add(o);
        } else parent.add(o);
        E.pools.push({ o, color: new THREE.Color(color), levels }); return o;
    };
    // Chair shells / upholstery follow the stage palette (plastic, woven fabric, leather).
    E.recolor = (g, color) => { const m = finishKit(kit, E).shell(color); g.traverse(o => { if (o.isMesh && o.material === kit.seat) o.material = m; }); return g; };
    // A metal or tape edge round a flat floor zone (kept under 35 mm: not a collider).
    E.edge = (g, [sx, sz], color, width = 30, height = 7) => { const k = detailKit(); for (const s of [-1, 1]) { k.box([sx + width, height, width], [0, height / 2, s * sz / 2], color); k.box([width, height, sz], [s * sx / 2, height / 2, 0], color); } k.build(g, dress); };
    // Book spine atlas material (cached per room).
    E.spines = () => E.spineMat || (E.spineMat = kit.material('#ffffff', { map: canvasTexture((c, W, H) => drawSpines(c, W, H, SPINES[kit.spec.id] || SPINES.university), 1024, 256), roughness: .78 }));
    // At night (or another phase) the chair is shown upturned on its table.
    E.chairUp = (chair, table, [x, z], phases, seat = 450, color = '#7c8a8f') => {
        const k = detailKit(), top = (table.children[0]?.position.y ?? 722.5) + 17.5, wide = seat < 400 ? 310 : 420;
        k.box([wide, 40, wide * .9], [x, top + seat - 20 + 40, z], color); k.box([wide, seat * .55, 30], [x, top + seat - seat * .55 / 2 + 20, z + wide * .42], color);
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box([16, seat - 20, 16], [x + dx * wide * .39, top + (seat - 20) / 2 + 20, z + dz * wide * .33], '#74808a');
        const g = new THREE.Group(); g.name = 'Chairs up for cleaning'; table.add(g); k.build(g, dress); g.visible = false;
        E.chairsUp.push({ chair, up: g, phases });
    };
    E.right = (z, y) => [kit.w / 2 - 45, y, z];
    return E;
}

// ---- Builder hooks -------------------------------------------------------
export function options(spec) {
    const young = isYoung(spec), id = spec.id;
    return {
        trimColor: PALETTE[id]?.trim || '#c4c2b6', acousticName: young ? 'Wall discovery gallery' : 'Wall acoustic panels', signLabel: young ? 'A PLACE TO GROW' : 'CONNECTED WORKSPACE',
        rugColor: { kindergarten: '#c9b48d', elementary: '#8fae98', middleschool: '#7f9aa1', highschool: '#8b97a0', college: '#8a7466', university: '#4d6a5d' }[id] || '#889b85',
        planter: ['elementary', 'college', 'university'].includes(id), boardName: 'Wall teaching and planning board', boardFooter: id === 'kindergarten' ? '#efe2c6' : young ? '#eadfc8' : '#f1f0e7',
        storage: { height: id === 'kindergarten' ? 940 : ['highschool', 'university'].includes(id) ? 1900 : 1200, open: young || id === 'middleschool' },
        chairDetailHeight: spec.kind === 'early' ? 260 : spec.kind === 'primary' ? 360 : 480, nightBackground: .55,
        lampSupport: null // classrooms keep one task lamp on the planning table; extraLamps adds a lounge lamp
    };
}

// Two butted tables with chairs. chairs: [dx, dz, turn] relative to the pod centre.
function pod(kit, E, key, name, [x, z], [tw, td], height, top, tables, chairs, seat, colors) {
    const made = tables.map(([dx, dz], n) => kit.table(`student-table-${key}-${'ab'[n]}`, name, [x + dx, 0, z + dz], tw, td, height, top));
    const seats = chairs.map(([dx, dz, turn], n) => E.recolor(kit.chair(`student-chair-${key}-${n}`, [x + dx, 0, z + dz], seat, turn), colors[n % colors.length]));
    return { tables: made, chairs: seats };
}

const BUILD = {
    kindergarten(kit, E) {
        const { bz, table, chair, asset, byId, M } = { ...kit, M: E.M };
        const birch = E.S.top, T = 520, tz = 1300;
        // Learning centre 1: one 8-child shared table (two butted 1250 x 620 tables).
        const tables = [625, 1875].map((x, n) => table(`student-table-0-${n}`, 'Shared learning table', [x, 0, tz], 1250, 620, T, birch));
        const shells = ['#dba55d', '#7fb3a5', '#e48e6e'];
        [-937, -312, 312, 937].forEach((dx, n) => [-1, 1].forEach((s, m) => {
            const c = E.recolor(chair(`student-chair-${n}-${m}`, [1250 + dx, 0, tz + s * 470], 260, s > 0 ? 0 : Math.PI), shells[(n + m) % 3]);
            if (s < 0) { const t = dx < 0 ? 0 : 1; E.chairUp(c, tables[t], [1250 + dx - [625, 1875][t], -130], [3], 260, shells[(n + m) % 3]); }
        }));
        // Floor zones: circle carpet (story and welcome), block rug, art vinyl.
        const rug = E.flat('circle-rug', 'Learning circle floor rug', [-1700, 3300], [1800, 1800], drawCircleRug, { round: true, height: 8 });
        const soft = detailKit(); [[-640, -380, '#dba55d'], [-760, 60, '#7fb3a5'], [-600, 470, '#e48e6e']].forEach(([x, z, col]) => soft.ball(1, [x, 18, z], col, [230, 13, 210])); E.build(soft, rug);
        E.flat('block-rug', 'Block area jute rug', [1800, -1400], [1600, 1200], drawJute, { height: 6, res: 512 });
        E.edge(E.flat('art-floor-zone', 'Art area sheet vinyl', [0, 3400], [2000, 1800], E.S.vinyl(), { height: 3 }), [2000, 1800], '#b9c2c6', 24, 5);
        // Block tower on the rug corner (blocks back in the cubbies at night).
        const tower = asset('block-tower', 'Wooden block tower', [2420, 0, -700]);
        const blocks = detailKit(); for (let n = 0; n < 8; n++) blocks.box([n % 2 ? 180 : 60, 60, n % 2 ? 60 : 180], [0, 30 + n * 60, 0], ['#d9534f', '#f0c24b', '#4f8fc0', '#6aa56a', '#e7d3ac'][n % 5]);
        blocks.box([60, 60, 60], [-120, 30, 90], '#e7d3ac'); E.build(blocks, tower); E.show(tower.children.at(-1), [0, 1, 2, 4]);
        // Story corner: a low adult rocking chair facing the carpet and a big-book easel.
        const rocker = asset('story-rocker', 'Story time rocking chair', [-1700, 0, 2100]);
        const rk = detailKit(), wood = '#b98a5a';
        rk.box([480, 40, 430], [0, 400, 10], wood); rk.box([480, 40, 430], [0, 425, 10], '#7fb3a5'); rk.box([470, 560, 36], [0, 700, -215], wood, [-.16, 0, 0]);
        for (const x of [-225, 225]) { rk.box([30, 330, 30], [x, 220, -160], wood); rk.box([30, 330, 30], [x, 220, 170], wood); rk.box([40, 30, 470], [x, 600, 20], wood); rk.box([32, 22, 620], [x, 38, 10], '#8d6a4a', [.06, 0, 0]); }
        rk.box([360, 260, 22], [0, 690, -195], '#e48e6e', [-.16, 0, 0]); E.build(rk, rocker);
        const easel = asset('big-book-stand', 'Big book easel', [-1050, 0, 2050]);
        const ek = detailKit(); for (const x of [-170, 170]) ek.box([30, 1000, 30], [x, 500, 0], '#b98a5a', [-.08, 0, 0]); ek.box([30, 980, 30], [0, 490, -120], '#b98a5a', [.25, 0, 0]);
        ek.box([420, 30, 70], [0, 520, 60], '#b98a5a'); ek.box([440, 320, 12], [-115, 700, 40], '#4f8fc0', [-.1, -.12, 0]); ek.box([440, 320, 12], [115, 700, 40], '#f7f1e0', [-.1, .12, 0]);
        E.build(ek, easel);
        // Learning centre 2: nature and discovery shelf (the storage, open cubbies).
        const nature = byId('storage'); if (nature) { nature.position.set(-500, 0, bz + 210); nature.name = 'Nature and discovery shelf'; }
        // Learning centre 3: front-facing book display by the window, outside the glazing.
        const display = asset('reading-shelf', 'Front-facing book display', [-kit.w / 2 + 210, 0, kit.front - 750]); display.rotation.y = Math.PI / 2;
        const dk = detailKit(), covers = []; for (const x of [-660, 660]) dk.box([30, 720, 400], [x, 360, 0], '#d9bf92');
        dk.box([1350, 30, 400], [0, 705, 0], '#d9bf92'); dk.box([1350, 60, 380], [0, 30, 0], '#c9a97a'); dk.box([1320, 690, 16], [0, 360, -190], '#e9dcc0');
        for (let t = 0; t < 3; t++) {
            const y = 100 + t * 205; dk.box([1300, 18, 210], [0, y, 30 - t * 30], '#d9bf92', [-.24, 0, 0]); dk.box([1300, 46, 12], [0, y + 18, 130 - t * 30], '#d9bf92');
            for (let n = 0; n < 5; n++) {
                const col = PASTEL[(n + t * 2) % 6], x = -500 + n * 250, z = 55 - t * 30; dk.box([210, 230, 10], [x, y + 115, z], shade(col, -.1), [-.24, 0, 0]);
                const g = new THREE.PlaneGeometry(204, 224), uv = g.attributes.uv, cell = (t * 5 + n) % 16;
                for (let i = 0; i < uv.count; i++) uv.setXY(i, ((cell % 4) + uv.getX(i)) / 4, (3 - Math.floor(cell / 4) + uv.getY(i)) / 4);
                g.rotateX(-.24); g.translate(x, y + 115 + 5.6 * .238, z + 5.6 * .971); covers.push(g);
            }
        }
        { const geo = mergeGeometries(covers, false); covers.forEach(c => c.dispose()); const m = new THREE.Mesh(geo, kit.material('#ffffff', { map: canvasTexture(drawCovers, 1024, 1024), roughness: .6 })); m.name = 'Picture book covers'; m.castShadow = false; display.add(m); }
        // The back faces the window side: a painted story mural.
        kit.mesh(display, new THREE.PlaneGeometry(1300, 660), E.tex((c, W, H) => { c.fillStyle = '#cfe3e6'; c.fillRect(0, 0, W, H); dot(c, W * .82, H * .28, H * .14, '#f0c24b'); ['#9fbf72', '#7fb3a5', '#dba55d'].forEach((col, n) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (.55 + n * .13) + Math.sin(x / W * 6 + n * 2) * H * .08); c.lineTo(W, H); c.fill(); }); write(c, 'STORY CORNER', W * .32, H * .22, H * .14, '#4b6b70'); }, 1024, 520, 'plaster'), [0, 360, -199]).rotation.y = Math.PI;
        E.build(dk, display);
    },
    elementary(kit, E) {
        const { bz, w, asset, byId } = kit, top = E.S.top;
        const shells = ['#5d8b78', '#e0a85e', '#88a9bf', '#d58f6c'];
        // Three 4-child pods (12 children) with pod caddies; plus the ErgoFlex centres.
        const pods = { A: [-400, 1900], B: [2800, 3200], C: [-400, 5000] };
        for (const [key, at] of Object.entries(pods)) pod(kit, E, key, 'Shared learning table', at, [1250, 620], 620, top, [[0, -310], [0, 310]],
            [[0, -850, Math.PI], [0, 850, 0], [-855, 0, -Math.PI / 2], [855, 0, Math.PI / 2]], 360, shells);
        // Meeting carpet in front of the teaching wall, with the classroom library under the board.
        E.flat('meeting-carpet', 'Meeting carpet', [1400, -2000], [3000, 2200], drawCarpetGrid, { height: 8 });
        // Wet zone: marbled linoleum under the science and grow table, with a metal edge.
        E.edge(E.flat('science-floor-zone', 'Science area linoleum', [-3150, 1800], [1800, 2000], E.S.lino(), { height: 3 }), [1800, 2000], '#b9c2c6', 24, 5);
        const bins = asset('library-bins', 'Classroom library book bins', [1550, 0, bz + 180]);
        const bk = detailKit(); bk.box([2100, 60, 340], [0, 30, 0], '#b48f62');
        for (let n = 0; n < 8; n++) { const x = -920 + n * 262; bk.box([240, 300, 300], [x, 210, 0], ['#5d8b78', '#e0b45e', '#88a9bf', '#d58f6c'][n % 4]); bk.box([200, 50, 6], [x, 300, 152], '#fffaf0');
            for (let q = 0; q < 5; q++) bk.box([200, 230 - q * 12, 14], [x + (rnd(n * 5 + q) - .5) * 20, 270 - q * 6, -90 + q * 34], PASTEL[(n + q) % 6], [-.25, 0, 0]); }
        E.build(bk, bins);
        // Maths manipulatives shelf (storage) turned against the door wall.
        const maths = byId('storage'); if (maths) { maths.position.set(w / 2 - 210, 0, -1767); maths.rotation.y = -Math.PI / 2; maths.name = 'Maths manipulatives shelf'; }
        // Two pushable reading beanbags and two book baskets on the carpet.
        [[300, -1200, '#e0b45e'], [2600, -1300, '#88a9bf']].forEach(([x, z, col], n) => {
            const bag = asset(`beanbag-${n + 1}`, 'Reading beanbag ottoman', [x, 0, z]); const k = detailKit();
            k.ball(1, [0, 210, 0], col, [340, 210, 330]); k.ball(1, [0, 380, -150], col, [260, 170, 150], [.3, 0, 0]); E.build(k, bag);
        });
        [[800, -2500], [2250, -2550]].forEach(([x, z], n) => {
            const basket = asset(`book-basket-${n + 1}`, 'Book basket', [x, 0, z]); const k = detailKit();
            k.cyl(190, 160, 200, [0, 100, 0], '#b38d5e'); for (let q = 0; q < 6; q++) k.box([170, 220, 16], [-80 + q * 32, 200, (rnd(q + n) - .5) * 60], PASTEL[(q + n) % 6], [(rnd(q) - .5) * .3, 0, 0]); E.build(k, basket);
        });
    },
    middleschool(kit, E) {
        const { asset } = kit, top = E.S.top, shells = ['#498698', '#e0b45e'];
        const chairs = [[-310, -900, Math.PI], [310, -900, Math.PI], [-310, 900, 0], [310, 900, 0]];
        [[-1100, 1600], [1100, 1600], [3300, 1600], [-1100, 4640], [1100, 4640]].forEach((at, n) => {
            const c = pod(kit, E, String(n), 'Student work table', at, [1250, 620], 740, top, [[0, -310], [0, 310]], chairs, 480, shells);
            // After school, three of the five clusters have their chairs up.
            if (n >= 2) c.chairs.forEach((chair, q) => E.chairUp(chair, c.tables[q < 2 ? 0 : 1], [chairs[q][0], q < 2 ? -40 : 40], [2, 3], 480, shells[q % 2]));
        });
        E.flat('robotics-mat', 'Robotics test mat', [0, -1367], [2000, 1500], drawRoboticsMat, { height: 5 });
        // Studded rubber maker zone with a safety-orange edge (the only orange on the floor).
        E.edge(E.flat('maker-floor-zone', 'Maker zone rubber floor', [2900, -1367], [2600, 2200], E.S.rubber(), { height: 4 }), [2600, 2200], '#e07a3f', 50, 6);
        // Lockers along the door wall, in front of the door path.
        const lockers = asset('lockers', 'Student lockers', [kit.w / 2 - 170, 0, 6800]); lockers.rotation.y = -Math.PI / 2;
        const lk = detailKit(); lk.box([820, 1850, 300], [0, 925, 0], '#3e5f6a');
        for (let n = 0; n < 8; n++) { const x = -300 + (n % 4) * 200, y = n < 4 ? 1380 : 470; lk.box([186, 880, 8], [x, y, 152], n % 3 ? '#498698' : '#5a96a7'); for (let v = 0; v < 4; v++) lk.box([120, 6, 4], [x, y + 330 - v * 16, 157], '#2f4a52'); lk.box([14, 60, 8], [x + 70, y, 158], '#c8cfd2'); }
        E.build(lk, lockers);
    },
    highschool(kit, E) {
        const { asset } = kit, top = E.S.top, shells = ['#567081', '#6f8796'];
        const cols = [-2075, 75, 2225], rows = [500, 2500, 4500];
        rows.forEach((z, r) => cols.forEach((x, c) => {
            const t = kit.table(`student-table-${r}-${c}`, 'Student work table', [x, 0, z], 1250, 620, 740, top);
            [-310, 310].forEach((dx, n) => { const ch = E.recolor(kit.chair(`student-chair-${r}-${c}-${n}`, [x + dx, 0, z + 570], 480, 0), shells[n]); if ((r + c) % 2) E.chairUp(ch, t, [dx, 60], [2, 3], 480, shells[n]); });
        }));
        E.edge(E.flat('demo-floor-inlay', 'Demonstration zone slate inlay', [0, -2600], [2400, 1600], E.S.slate(), { height: 4 }), [2400, 1600], '#9aa8b0', 26, 6);
        // Lab wall bench with a sink along the door wall (back third).
        const bench = asset('wall-bench', 'Lab wall bench with sink', [kit.w / 2 - 300, 0, -1650]);
        const bk = detailKit(); bk.box([600, 860, 2100], [0, 430, 0], '#567081'); bk.box([640, 40, 2140], [0, 880, 0], '#2f3b44');
        bk.box([420, 20, 520], [0, 892, -400], '#9fb0b8'); bk.box([30, 300, 30], [200, 1050, -400], '#c8cfd2'); bk.box([30, 30, 200], [200, 1190, -330], '#c8cfd2');
        for (let n = 0; n < 4; n++) { bk.box([8, 700, 470], [-304, 430, -790 + n * 520], '#4b6372'); bk.box([10, 20, 120], [-308, 760, -790 + n * 520], '#c8cfd2'); }
        for (let n = 0; n < 5; n++) bk.cyl(40, 40, 120 + n * 20, [-120 + n % 2 * 120, 960 + n * 10, 300 + n * 110], ['#c8dfe6', '#e0b45e', '#9fd3c7'][n % 3]);
        E.build(bk, bench);
        // Lockers by the front corner.
        const lockers = asset('lockers', 'Student lockers', [kit.w / 2 - 170, 0, 7500]); lockers.rotation.y = -Math.PI / 2;
        const lk = detailKit(); lk.box([820, 1850, 300], [0, 925, 0], '#2f3b44');
        for (let n = 0; n < 8; n++) { const x = -300 + (n % 4) * 200, y = n < 4 ? 1380 : 470; lk.box([186, 880, 8], [x, y, 152], n % 2 ? '#567081' : '#62808f'); for (let v = 0; v < 4; v++) lk.box([120, 6, 4], [x, y + 330 - v * 16, 157], '#26323a'); lk.box([14, 60, 8], [x + 70, y, 158], '#d9a441'); }
        E.build(lk, lockers);
    },
    college(kit, E) {
        const { asset } = kit, top = E.S.top, shells = ['#866653', '#c9b08f'];
        // Oak teaching stage strip along the back wall over the carpet tile, with an aluminium nosing.
        // (It stops short of the instructor's desk rug at the window end.)
        const sx0 = -3150, sx1 = kit.w / 2 - 40, sw = sx1 - sx0, stage = E.flat('teaching-stage', 'Oak teaching stage strip', [(sx0 + sx1) / 2, kit.bz + 1220], [sw, 2400], E.S.oakStage, { height: 5 });
        { const k = detailKit(); k.box([sw, 8, 30], [0, 4, 1205], '#aeb6ba'); k.box([30, 8, 2400], [-sw / 2, 4, 0], '#aeb6ba'); k.build(stage, E.dress); }
        const chairs = [-600, 0, 600].flatMap(x => [[x, -700, Math.PI], [x, 700, 0]]);
        // Each team has its own colour: a carpet-tile inlay under its table (and a table flag, dressProp).
        [[-1300, 667], [2400, 667], [-1300, 3967], [2400, 3967]].forEach(([x, z], n) => E.flat(`team-zone-${n + 1}`, 'Team zone carpet inlay', [x, z], [2800, 2500], carpetInlay(TEAM[n], 2800, 2500), { height: 4, res: 768 }));
        // Breakout: a standing-height collaboration table with stools (front, between the access desk and the pitch desk).
        E.flat('breakout-rug', 'Breakout zone rug', [-1900, 7450], [2300, 1900], drawRug('#5f7d72', '#e8dcc6', false), { height: 8 });
        kit.table('collab-table', 'Standing collaboration table', [-1900, 0, 7250], 1400, 700, 1050, top);
        [[-1300, 667], [2400, 667], [-1300, 3967], [2400, 3967]].forEach(([x, z], n) => {
            kit.table(`student-table-${n}`, 'Student work table', [x, 0, z], 1800, 900, 740, top);
            chairs.forEach(([dx, dz, turn], q) => E.recolor(kit.chair(`student-chair-${n}-${q}`, [x + dx, 0, z + dz], 480, turn), shells[(q + n) % 2]));
        });
        // Mobile team whiteboards beside the right-hand team tables.
        [667, 3967].forEach((z, n) => {
            const wb = asset(`team-whiteboard-${n + 1}`, 'Mobile team whiteboard', [3900, 0, z]); wb.rotation.y = -Math.PI / 2;
            const k = detailKit(); for (const x of [-560, 560]) { k.box([40, 1750, 40], [x, 905, 0], '#4a4a48'); k.box([60, 30, 460], [x, 60, 0], '#4a4a48'); for (const z2 of [-200, 200]) k.cyl(30, 30, 30, [x, 30, z2], '#2a2a2a'); }
            k.box([1200, 900, 30], [0, 1350, 0], '#f4f4f0'); k.box([1220, 20, 50], [0, 890, 20], '#9a9a96');
            for (let q = 0; q < 9; q++) k.box([90, 85, 3], [-450 + q % 3 * 120 + (n * 200), 1600 - Math.floor(q / 3) * 110, 17], ['#f6d76b', '#f4b6a0', '#cfe0c3', '#c6d7e6'][(q + n) % 4]);
            k.box([500, 4, 3], [180 - n * 300, 1150, 17], '#3f4b52'); k.box([4, 260, 3], [-50, 1280, 17], '#a5624a');
            E.build(k, wb);
            const screen = new THREE.Group(); screen.name = 'Team whiteboard writing'; wb.add(screen);
        });
        // Lounge edge with a wool rug, side table and floor lamp (second real lamp).
        E.flat('lounge-rug', 'Lounge wool rug', [3300, 6200], [2600, 1600], drawRug('#8a6a55', '#efe3cc'), { height: 8 });
        [[2750, 6300, -.35, '#a5624a'], [3900, 6300, .35, '#c9b08f']].forEach(([x, z, turn, col], n) => {
            const g = asset(`lounge-seat-${n + 1}`, 'Lounge armchair', [x, 0, z]); g.rotation.y = Math.PI + turn; const k = detailKit();
            k.box([760, 200, 700], [0, 230, 0], col); k.box([600, 110, 560], [0, 385, 50], col); k.box([760, 430, 170], [0, 545, -265], col);
            for (const sx of [-325, 325]) k.box([110, 250, 690], [sx, 455, 0], col);
            for (const sx of [-320, 320]) for (const sz of [-280, 280]) k.cyl(18, 14, 130, [sx, 65, sz], '#3a2e26');
            k.box([380, 300, 90], [60, 560, -150], n ? '#866653' : '#e8dcc6', [-.2, .1, 0]); E.build(k, g);
        });
        const side = asset('lounge-side-table', 'Lounge side table', [3330, 0, 6050]); const sk = detailKit();
        sk.cyl(230, 230, 30, [0, 520, 0], '#6b4a33'); sk.cyl(25, 25, 500, [0, 260, 0], '#2f2f2f'); sk.cyl(160, 160, 20, [0, 10, 0], '#2f2f2f'); books(sk, -60, 535, 40, 3); E.build(sk, side);
        // Window bench (low; keeps the front-left low) within the glazing.
        const bench = asset('window-bench', 'Oak bench seat by the glazing', [-kit.w / 2 + 200, 0, 3950]); const wk = detailKit();
        wk.box([400, 40, 3300], [0, 430, 0], '#b08d63'); for (const z of [-1500, 0, 1500]) wk.box([360, 410, 40], [0, 205, z], '#8a6a4a'); wk.box([300, 50, 600], [0, 475, -900], '#c9b08f'); wk.box([280, 60, 420], [0, 480, 700], '#a5624a');
        E.build(wk, bench);
    },
    university(kit, E) {
        const { asset } = kit, walnut = E.S.top, leather = ['#3d2f26', '#285c4b'];
        const cx = -600, cz = 1533;
        // Hollow-square seminar table (outer 4800 x 3600, 750 deep); the front's
        // middle is the accessible ErgoFlex seat.
        const segments = [['back', [cx, cz - 1425], [4800, 750]], ['left', [cx - 2025, cz], [750, 2100]], ['right', [cx + 2025, cz], [750, 2100]],
            ['front-left', [cx - 1630, cz + 1425], [1540, 750]], ['front-right', [cx + 1630, cz + 1425], [1540, 750]]];
        for (const [id, [x, z], [sx, sz]] of segments) kit.table(`seminar-table-${id}`, 'Seminar table', [x, 0, z], sx, sz, 740, walnut);
        const seats = [
            ...[0, 1, 2, 3, 4, 5].map(n => [cx - 2000 + n * 800, cz - 2200, Math.PI]),
            ...[-633, 0, 633].map(dz => [cx - 2800, cz + dz, -Math.PI / 2]), ...[-633, 0, 633].map(dz => [cx + 2800, cz + dz, Math.PI / 2]),
            ...[-2000, -1250, 1250, 2000].map(dx => [cx + dx, cz + 2200, 0])];
        seats.forEach(([x, z, turn], n) => E.recolor(kit.chair(`seminar-chair-${n}`, [x, 0, z], 480, turn), leather[n % 2]));
        // Library wall bookcases: series runs of books and archive boxes.
        [2800, 3700].forEach((x, n) => {
            const g = asset(`library-shelf-${n + 1}`, 'Library wall bookcase', [x, 0, kit.bz + 230]), k = detailKit(), wood = '#6b4a33', runs = [];
            k.box([800, 1760, 20], [0, 880, -190], '#4a3324'); for (const sx of [-390, 390]) k.box([20, 1760, 400], [sx, 880, 0], wood);
            for (let s = 0; s < 6; s++) k.box([780, 22, 380], [0, 40 + s * 340, 0], wood);
            for (let s = 0; s < 5; s++) {
                const y = 51 + s * 340;
                if (s === 0) for (let q = 0; q < 3; q++) { k.box([240, 250, 330], [-250 + q * 250, y + 125, 10], q % 2 ? '#c9b48f' : '#b3a07c'); k.box([140, 50, 3], [-250 + q * 250, y + 170, 176], '#efe8d6'); }
                else { runs.push({ x0: -372, x1: 150 - (s + n) % 3 * 60, y, front: 175, depth: 240, hMin: 205, hMax: 300, seed: n * 10 + s }); for (let q = 0; q < 3; q++) k.box([28, 150 + q * 10, 140], [180 + q * 34, y + 80 + q * 5, 30], ['#285c4b', '#7a2f2f', '#2f3f5c'][(q + s) % 3]); if ((s + n) % 2) k.box([170, 60, 220], [300, y + 30, 20], '#b39b6a'); }
            }
            E.build(k, g); const b = bookRuns(runs, E.spines()); if (b) g.add(b);
        });
        E.flat('seminar-rug', 'Deep green wool rug', [cx, cz], [6000, 5000], drawRug('#2f5446', '#e9e1cc'), { height: 8 });
        const stage = E.flat('lectern-stage', 'Oak lectern stage strip', [0, kit.bz + 1200], [6000, 2400], E.S.oakStage, { height: 5 });
        { const k = detailKit(); k.box([6030, 8, 30], [0, 4, 1200], '#b39b6a'); for (const x of [-3000, 3000]) k.box([30, 8, 2400], [x, 4, 0], '#b39b6a'); k.build(stage, E.dress); }
        // Lounge: leather armchairs either side of a globe table (lamp: extraLamps).
        const side = asset('lounge-side-table', 'Lounge side table', [2500, 0, 8400]); const sk = detailKit();
        sk.cyl(260, 260, 30, [0, 560, 0], '#6b4a33'); for (let n = 0; n < 3; n++) { const a = n * TAU / 3; sk.box([30, 540, 30], [Math.cos(a) * 180, 270, Math.sin(a) * 180], '#5a3d29'); }
        sk.cyl(60, 80, 30, [80, 590, 60], '#b39b6a'); sk.cyl(10, 10, 120, [80, 660, 60], '#b39b6a'); sk.ball(140, [80, 820, 60], '#4f7f8f'); sk.ball(141, [80, 820, 60], '#9fb98a', [1, .55, 1], [.4, 0, 0]);
        E.build(sk, side);
        E.flat('lounge-rug', 'Lounge wool rug', [2500, 8400], [2800, 1500], drawRug('#7b5a44', '#e7dcc4'), { height: 8 });
        // Radiator cover bench under the window sill.
        const bench = asset('window-bench', 'Radiator cover bench', [-kit.w / 2 + 200, 0, 2200]); const wk = detailKit();
        wk.box([400, 450, 3800], [0, 225, 0], '#e3dccb'); wk.box([420, 40, 3840], [0, 470, 0], '#7a5638');
        for (let n = 0; n < 19; n++) wk.box([6, 300, 160], [202, 230, -1800 + n * 200], '#cfc6b2');
        wk.box([300, 60, 500], [0, 520, -1200], '#285c4b'); books(wk, -100, 490, 800, 4); E.build(wk, bench);
        // Reading commons in the front half: a long walnut library table with
        // green-shaded lamps (dressProp) and eight chairs on an oxblood rug.
        const rx = -1700, rz = 6200;
        E.flat('reading-rug', 'Reading room wool rug', [rx, rz], [4200, 2900], drawRug('#6b3a2e', '#e3d6b8'), { height: 8 });
        kit.table('reading-table', 'Library reading table', [rx, 0, rz], 2800, 1100, 740, walnut);
        [-1000, -330, 330, 1000].forEach((dx, n) => [-1, 1].forEach((s, m) => E.recolor(kit.chair(`reading-chair-${n}-${m}`, [rx + dx, 0, rz + s * 800], 480, s > 0 ? 0 : Math.PI), leather[(n + m + 1) % 2])));
        // Low library bookcases along the window wall's front bay (kept low: the camera side).
        const low = asset('reading-room-shelves', 'Low library bookcases', [-kit.w / 2 + 202, 0, 8000]); low.rotation.y = Math.PI / 2;
        { const k = detailKit(), wood = '#6b4a33', runs = [];
            k.box([2200, 1050, 18], [0, 525, -171], '#4a3324'); for (const x of [-1100, -366, 366, 1100]) k.box([24, 1050, 360], [x, 525, 0], wood);
            for (const y of [40, 380, 720]) k.box([2200, 24, 350], [0, y, 0], wood); k.box([2240, 30, 380], [0, 1062, 6], '#5a3d29'); k.box([2200, 80, 20], [0, 40, 172], '#3d2b1f');
            for (let b = 0; b < 3; b++) { const x0 = -1088 + b * 732; runs.push({ x0, x1: x0 + (b % 2 ? 440 : 700), y: 392, front: 168, depth: 240, hMin: 220, hMax: 300, seed: 40 + b }, { x0: x0 + 60 * (b % 2), x1: x0 + 700, y: 52, front: 168, depth: 260, hMin: 240, hMax: 310, seed: 50 + b }); if (b % 2) { k.box([240, 290, 300], [x0 + 580, 392 + 145, 10], '#b3a07c'); k.box([150, 50, 3], [x0 + 580, 392 + 190, 161], '#efe8d6'); } }
            // On top: a plaster bust, a brass reading lamp base, a stack of folios and a fern.
            k.cyl(70, 80, 60, [-760, 1107, 20], '#3d2b1f'); k.box([150, 170, 110], [-760, 1222, 20], '#e6e1d4'); k.ball(72, [-760, 1370, 25], '#ece8dc', [1, 1.15, 1]);
            for (let q = 0; q < 4; q++) k.box([360, 22, 270], [120 + (q % 2) * 12, 1088 + q * 22, 20], ['#285c4b', '#7a2f2f', '#2f3f5c', '#b39b6a'][q]);
            k.cyl(80, 90, 26, [760, 1090, 30], '#b39b6a'); k.cyl(9, 9, 380, [760, 1270, 30], '#b39b6a');
            plant(k, -330, 1077, 40, .55); k.build(low, E.dress);
            const b = bookRuns(runs, E.spines()); if (b) low.add(b);
            const shade = kit.material('#efe3c6', { emissive: '#ffd9a8', emissiveIntensity: .3, roughness: .8, side: THREE.DoubleSide }); E.glows.push({ m: shade, levels: [.08, .06, .9, .95, .75] });
            kit.mesh(low, new THREE.CylinderGeometry(110, 150, 170, 20, 1, true), shade, [760, 1500, 30]);
        }
        // A glass vitrine with the campus model (low: keeps the views over it open).
        { const g = asset('model-vitrine', 'Glass vitrine with campus model', [1350, 0, 5450]); const k = detailKit();
            k.box([1400, 720, 700], [0, 360, 0], '#5a3d29'); k.box([1440, 30, 740], [0, 735, 0], '#6b4a33'); k.box([1380, 40, 680], [0, 40, 0], '#3d2b1f');
            for (const x of [-690, 690]) for (const z of [-330, 330]) k.box([20, 300, 20], [x, 900, z], '#b39b6a');
            for (const z of [-340, 340]) k.box([1400, 16, 16], [0, 1056, z], '#b39b6a'); for (const x of [-700, 700]) k.box([16, 16, 680], [x, 1056, 0], '#b39b6a');
            // Campus model: base board, lawns, paths, a stone hall with a clock tower, a glass lab, trees.
            k.box([1200, 16, 560], [0, 758, 0], '#e8e2d2'); k.box([520, 4, 240], [-300, 768, -110], '#a9c08f'); k.box([420, 4, 200], [340, 768, 140], '#a9c08f'); k.box([1100, 3, 60], [0, 768, 40], '#efe5c8');
            k.box([360, 110, 150], [-280, 821, -170], '#d8cdb6'); k.box([90, 230, 90], [-120, 881, -170], '#cfc3aa'); k.box([100, 40, 100], [-120, 1016, -170], '#7a6a55');
            k.box([300, 130, 160], [330, 831, -150], '#9fbfcf'); for (let n = 0; n < 6; n++) { k.cyl(5, 5, 50, [-480 + n * 190, 791, 190], '#6b5a44'); k.ball(34, [-480 + n * 190, 836, 190], '#6f9a5e'); }
            k.build(g, E.dress);
            const glass = kit.material('#dfeff2', { transparent: true, opacity: .16, roughness: .04, metalness: .1, depthWrite: false });
            kit.mesh(g, new THREE.BoxGeometry(1380, 300, 680), glass, [0, 900, 0]).castShadow = false;
        }
    }
};

export function furnish(kit) {
    const E = eduKit(kit); finishKit(kit, E);
    // Plank floors carry a matching roughness map (gaps rough, boards satin).
    const rough = kit.floor.map?.userData.roughnessMap; if (rough) { kit.floor.roughnessMap = rough; kit.floor.needsUpdate = true; }
    tintProps(kit); installView(kit, E);
    BUILD[kit.spec.id]?.(kit, E);
    // Presentation display for the secondary stages (the university uses back-wall screens).
    const { spec } = kit;
    if (['middleschool', 'highschool'].includes(spec.id)) {
        const display = E.wall('right', 'presentation-display', 'Wall presentation display', kit.bz + kit.d * .57, 1350, 10); display.position.x = kit.w / 2 - 30;
        kit.monitor(display, [0, 0, 0], 1500, 0, true);
    }
}

// Batched detail per furnishing (runs for every asset, including the shell's).
export function dressProp(id, k, g, kit) {
    const { spec } = kit, young = isYoung(spec);
    if (id === 'storage') {
        const top = kit.options.storage.height;
        if (spec.id === 'kindergarten') {
            // Nature table: pinecones, shells, a jar of leaves and picture labels.
            for (let n = 0; n < 5; n++) k.ball(38, [-480 + n * 70, top + 38, 60 + n % 2 * 50], '#7b5a3a', [1, 1.4, 1]);
            for (let n = 0; n < 4; n++) k.ball(32, [-110 + n * 60, top + 16, -70 + n % 2 * 60], ['#f1e2cc', '#e8c9b3', '#f6efe3'][n % 3], [1.3, .55, 1]);
            k.cyl(80, 80, 210, [200, top + 105, 0], '#cfe2df'); for (let n = 0; n < 6; n++) k.ball(42, [180 + n % 3 * 25, top + 70 + n * 26, (n % 2 - .5) * 40], ['#d48a3c', '#a9b04a', '#c9632f'][n % 3], [1, .3, .7], [0, n, .5]);
            plant(k, 470, top, 0, .5);
            for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (col < 2 || row < 2) { const x = -417 + col * 417, y = 178 + row * 275; k.box([150, 90, 3], [x, y + 20, 142], '#fffaf0'); k.ball(26, [x, y + 20, 145], PASTEL[(row * 3 + col) % 6], [1, 1, .1]); }
        } else if (spec.id === 'elementary') {
            for (let n = 0; n < 4; n++) { k.box([200, 140, 180], [-450 + n * 300, top + 70, 0], PASTEL[n + 1]); k.box([120, 40, 3], [-450 + n * 300, top + 80, 92], '#fffaf0'); }
            for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (col < 2 || row < 2) { const x = -417 + col * 417, y = 178 + row * 275; k.box([150, 60, 3], [x, y + 30, 142], '#fffaf0'); for (let q = 0; q < 6; q++) k.ball(14, [x - 50 + q * 20, y + 110, 40], PASTEL[(q + row) % 6]); }
        } else if (spec.id === 'middleschool') {
            for (let n = 0; n < 5; n++) k.cyl(35, 35, 520, [-450 + n * 45, top + 260, -40 + n % 2 * 50], '#c9a97a');
            k.box([500, 60, 360], [180, top + 30, 0], '#b28f62'); k.box([480, 60, 340], [190, top + 90, 0], '#c3a06e');
            for (let n = 0; n < 4; n++) k.cyl(50, 50, 40, [380 + (n % 2) * 110, top + 20 + Math.floor(n / 2) * 40, -120], ['#e07a3f', '#498698', '#f0c24b', '#6aa56a'][n]);
            for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (col < 2 || row < 2) { const x = -417 + col * 417, y = 178 + row * 275; k.box([150, 50, 3], [x, y + 30, 142], '#f4f6f2'); }
        } else if (spec.id === 'highschool') {
            // Equipment cabinet (glazed in decorate): boxed sets on top.
            for (let n = 0; n < 3; n++) k.box([300, 120, 260], [-380 + n * 330, top + 60 + (n % 2) * 4, 0], ['#d9a441', '#567081', '#6f8796'][n]);
            k.cyl(60, 60, 260, [480, top + 130, 0], '#9fb0b8');
        } else if (spec.id === 'university') {
            for (let n = 0; n < 4; n++) k.box([260, 300, 380], [-440 + n * 280, top + 150, 0], n % 2 ? '#c9b48f' : '#b3a07c');
            for (let n = 0; n < 4; n++) k.box([180, 60, 3], [-440 + n * 280, top + 200, 192], '#efe8d6');
        } else { storageBooks(k, top); storageTray(k, top); }
        if (spec.id === 'college') { storageBooks(k, top); }
    }
    if (id === 'activity-table') {
        const y = 740;
        if (spec.id === 'kindergarten') { k.cyl(70, 55, 200, [470, y + 100, -150], '#cfe2df'); for (let n = 0; n < 7; n++) k.ball(45, [470 + Math.cos(n) * 60, y + 230 + n % 3 * 25, -150 + Math.sin(n) * 60], PASTEL[n % 6], [1, .7, 1]); k.cyl(130, 110, 90, [200, y + 45, -170], '#b38d5e'); for (let n = 0; n < 8; n++) k.box([16, 90, 16], [150 + n % 4 * 30, y + 95, -190 + Math.floor(n / 4) * 40], PASTEL[n % 6]); }
        if (spec.id === 'middleschool') {
            // Foam-board city model: blocks, trees and a cardboard river.
            k.box([900, 10, 520], [150, y + 5, 0], '#e8e2d2'); k.box([900, 3, 90], [150, y + 11, 120], '#7fb6d6', [0, .1, 0]);
            for (let n = 0; n < 9; n++) k.box([110, 80 + rnd(n) * 220, 110], [-200 + n % 5 * 160, y + 50 + rnd(n) * 110, -150 + Math.floor(n / 5) * 160], ['#f4f2ea', '#d7d3c5', '#c9d4d6'][n % 3]);
            for (let n = 0; n < 6; n++) { k.cyl(6, 6, 50, [-260 + n * 150, y + 35, 220], '#7b5a3a'); k.ball(34, [-260 + n * 150, y + 80, 220], '#5e9a5a'); }
        }
        if (spec.id === 'highschool') {
            // Wind turbine model, solar panel and a circuit board.
            k.cyl(60, 70, 30, [380, y + 15, -120], '#9fb0b8'); k.cyl(12, 16, 520, [380, y + 290, -120], '#e8ecee'); k.box([60, 50, 80], [380, y + 560, -100], '#e8ecee');
            for (let n = 0; n < 3; n++) k.box([16, 260, 30], [380 + Math.sin(n * TAU / 3) * 130, y + 560 + Math.cos(n * TAU / 3) * 130, -60], '#f4f6f6', [0, 0, -n * TAU / 3]);
            k.box([380, 14, 260], [-40, y + 90, 120], '#2f4f6a', [-.5, 0, 0]); k.box([20, 90, 20], [-40, y + 45, 60], '#9fb0b8');
            k.box([240, 10, 160], [100, y + 5, -170], '#3f7a53'); for (let n = 0; n < 6; n++) k.box([30, 16, 20], [20 + n % 3 * 60, y + 16, -200 + Math.floor(n / 3) * 60], n % 2 ? '#2f3b44' : '#d9a441');
        }
        if (spec.id === 'college') { k.box([500, 300, 300], [250, y + 150, -60], '#e8e4db'); k.box([340, 160, 200], [250, y + 380, -60], '#a5624a'); k.box([300, 6, 200], [-20, y + 3, 150], '#f2ead8'); }
        if (spec.id === 'university') {
            k.cyl(70, 60, 240, [430, y + 120, -150], '#2f2f2f'); k.cyl(50, 50, 30, [430, y + 255, -150], '#b39b6a');
            k.cyl(65, 55, 220, [250, y + 110, -170], '#cfe2e6'); for (let n = 0; n < 8; n++) k.cyl(38, 32, 95, [-60 + n % 4 * 85, y + 48, 40 + Math.floor(n / 4) * 95], '#f2efe8');
            for (let n = 0; n < 6; n++) k.box([110, 60, 70], [80 + n % 3 * 120, y + 30, 230], ['#a37a52', '#c99a6a'][n % 2]);
        }
    }
    if (id === 'reading-table' && kit.edu) {
        // Library reading table: two banker's lamps, open books, notes and pencils at the places.
        const E = kit.edu, y = 740, brass = '#b39b6a';
        for (const [x, n] of [[-700, 0], [700, 1]]) {
            k.cyl(75, 85, 24, [x, y + 12, 0], brass); k.cyl(9, 9, 300, [x, y + 170, 0], brass); k.box([20, 20, 130], [x, y + 320, 45], brass);
            const shadeMesh = kit.mesh(g, new THREE.CylinderGeometry(75, 75, 330, 18, 1, false, 0, Math.PI), E.M('#1f5a3d', 'metal', { metalness: .25, roughness: .3, side: THREE.DoubleSide }), [x, y + 335, 95]); shadeMesh.rotation.z = Math.PI / 2;
            kit.box(g, [300, 3, 110], [x, y + 322, 95], E.readingGlow ||= E.glow('#ffe2b0', [.15, .12, 1, 1.15, .75]), 1);
        }
        for (const [x, s] of [[-1050, -1], [-350, 1], [350, -1], [1050, 1], [-1050, 1], [350, 1]]) {
            const z = s * 210, open = (x + s * 100) % 3 === 0;
            k.box([340, 6, 240], [x, y + 3, z], '#f3eedf'); k.box([4, 8, 230], [x, y + 6, z], '#cfc6ae');
            if (open) k.box([150, 2, 210], [x + 200, y + 1, z + s * 40], '#fbf8ef'); else notebook(k, x + 210, y, z - s * 20, ['#285c4b', '#7a2f2f', '#2f3f5c'][Math.abs(x / 350) % 3]);
            k.box([8, 8, 150], [x - 210, y + 4, z], '#d9a441', [0, .4 * s, 0]);
        }
        books(k, -180, y, -60, 5); k.cyl(36, 30, 110, [140, y + 55, 80], '#d7e6ea');
    }
    if (id === 'collab-table') {
        const y = 1050; for (const [x, z] of [[-420, -120], [380, 130]]) notebook(k, x, y, z, ['#a5624a', '#5f7d72'][x > 0 ? 1 : 0]);
        k.cyl(40, 34, 110, [80, y + 55, -150], '#f2efe8'); k.cyl(40, 34, 110, [180, y + 55, -110], '#2f3b44');
        for (let n = 0; n < 6; n++) k.box([75, 3, 75], [-120 + n % 3 * 85, y + 2 + n * .4, 120 + Math.floor(n / 3) * 85], ['#f6d76b', '#f4b6a0', '#cfe0c3', '#c6d7e6'][n % 4], [0, (rnd(n + 3) - .5) * .4, 0]);
    }
    if (/student-table|seminar-table/.test(id)) {
        const top = spec.kind === 'early' ? 520 : spec.kind === 'primary' ? 620 : 740;
        if (spec.id === 'kindergarten') {
            // Name cards and wooden trays at each place (four per table).
            for (const x of [-312, 313]) for (const s of [-1, 1]) {
                k.box([250, 18, 170], [x, top + 9, s * 150], '#c9a06a'); k.box([230, 6, 150], [x, top + 18, s * 150], '#dcb985');
                k.box([110, 45, 4], [x + 80, top + 24 + 22, s * 255], '#fffaf0', [s * .35, 0, 0]); k.ball(12, [x + 80, top + 48, s * 258], PASTEL[(x > 0 ? 2 : 0) + (s > 0 ? 1 : 0)], [1, 1, .2]);
                k.ball(28, [x - 60, top + 40, s * 150], PASTEL[(x > 0 ? 1 : 3) + (s > 0 ? 1 : 0)], [1, .5, 1]); k.box([60, 40, 60], [x + 30, top + 40, s * 140], PASTEL[(x > 0 ? 4 : 2)]);
            }
        } else if (spec.id === 'elementary') {
            const caddy = /-a$/.test(id), s = caddy ? 1 : -1;
            if (caddy) { k.box([220, 90, 160], [0, top + 45, 230], '#5d8b78'); for (let n = 0; n < 8; n++) k.cyl(6, 6, 170, [-80 + n % 4 * 50, top + 130, 200 + Math.floor(n / 4) * 50], PASTEL[n % 6]); k.cyl(45, 45, 110, [140, top + 55, 230], '#e0b45e'); }
            notebook(k, -300, top, -160 * s, '#88a9bf'); k.box([150, 70, 4], [300, top + 35, -230 * s], '#fffaf0', [.35 * s, 0, 0]);
            k.box([200, 3, 260], [380, top + 2, -60 * s], '#f3ead7'); k.box([180, 3, 240], [-420, top + 2, 0], '#d9c6a0');
        } else if (spec.id === 'middleschool') {
            if (/-a$/.test(id)) { k.box([200, 80, 140], [0, top + 40, 230], '#498698'); for (let n = 0; n < 7; n++) k.cyl(6, 6, 160, [-70 + n * 22, top + 120, 230 + (n % 2) * 20], PASTEL[n % 6]); k.box([300, 3, 30], [250, top + 2, 220], '#e8eef0'); k.cyl(80, 80, 3, [-260, top + 2, 200], '#cfe6ef'); }
            notebook(k, -330, top, /-a$/.test(id) ? -140 : 140, '#e0b45e'); k.box([210, 3, 290], [330, top + 2, /-a$/.test(id) ? -120 : 120], '#f4f4ee');
            if (/student-table-0-b/.test(id)) { k.box([360, 180, 260], [200, top + 90, -40], '#c9a97a'); k.box([140, 120, 120], [80, top + 240, -60], '#d9bb8c'); for (let n = 0; n < 3; n++) k.box([60, 60, 3], [140 + n * 80, top + 120, 92], '#7fb6d6'); }
        } else if (spec.id === 'highschool') {
            for (const x of [-310, 310]) { k.box([210, 2, 290], [x, top + 1, 110], '#f4f4ee'); for (let n = 0; n < 6; n++) k.box([190, 1, 1.5], [x, top + 3, -15 + n * 45], '#a8c3d6'); k.box([75, 14, 150], [x + 170, top + 7, 100], '#2f3b44'); k.box([60, 2, 40], [x + 170, top + 15, 60], '#9fc4a0'); }
            k.box([1120, 45, 22], [0, top - 80, -240], '#2f3b44');
        } else if (spec.id === 'college') {
            k.cyl(70, 70, 24, [0, top + 12, 0], '#2f2f2f'); k.cyl(40, 40, 4, [0, top + 25, 0], '#7ec4ba');
            // Team flag at the table end (team colour, white roundel).
            const team = Number(id.match(/(\d+)$/)?.[1] ?? 0);
            k.cyl(55, 60, 14, [-820, top + 7, 0], '#2f2f2f'); k.cyl(7, 7, 520, [-820, top + 260, 0], '#9aa0a2');
            k.box([8, 200, 260], [-820, top + 420, 130], TEAM[team % 4]); k.ball(55, [-814, top + 430, 130], '#f4efe2', [.15, 1, 1]); k.ball(55, [-826, top + 430, 130], '#f4efe2', [.15, 1, 1]);
            k.cyl(55, 50, 230, [250, top + 115, -40], '#cfe2e6'); k.cyl(50, 50, 6, [250, top + 232, -40], '#2f3b44');
            for (const [x, z] of [[-600, -200], [600, -200], [0, 200], [-600, 220], [600, 210]]) { notebook(k, x - 60, top, z, ['#a5624a', '#866653', '#5f7d72'][Math.abs(x / 600) | 0]); k.cyl(38, 33, 100, [x + 150, top + 50, z + 30], '#f2efe8'); }
        } else if (spec.id === 'university') {
            // Leather pads, name tents, water glasses and papers at every place.
            const seats = [];
            if (/back/.test(id)) for (let n = 0; n < 6; n++) seats.push([-2000 + n * 800, -200, 0]);
            if (/left|right/.test(id)) for (const dz of [-633, 0, 633]) seats.push([/left/.test(id) ? -200 : 200, dz, 1]);
            if (/front-left/.test(id)) seats.push([-370, 200, 2], [380, 200, 2]);
            if (/front-right/.test(id)) seats.push([-380, 200, 2], [370, 200, 2]);
            for (const [x, z, side] of seats) {
                const along = side === 1, pad = along ? [330, 3, 480] : [480, 3, 330];
                k.box(pad, [x, top + 1.5, z], '#2f5446');
                const ox = along ? 0 : 150, oz = along ? 150 : 0, tz = along ? 0 : (z < 0 ? 130 : -130), tx = along ? (x < 0 ? 130 : -130) : 0;
                k.cyl(32, 28, 110, [x + ox + tx * .3, top + 55, z + oz + tz * .3], '#d7e6ea');
                k.box(along ? [4, 60, 140] : [140, 60, 4], [x + tx, top + 30, z + tz], '#f4efe2'); k.box([170, 1.5, 230], [x - ox * .6, top + 4, z - oz * .6], '#fbf8ef');
                k.box([10, 10, 110], [x - ox * .2 + 60, top + 8, z - oz * .2], ['#f0e04b', '#f4a6a0', '#9fd3c7'][Math.abs(Math.round(x + z)) % 3]);
            }
        }
        if (/student-table/.test(id) && ['middleschool', 'highschool'].includes(spec.id)) {
            // HPL tops get a coloured (middle) or graphite (high) ABS edge band.
            const geo = g.children[0].geometry; geo.computeBoundingBox(); const b = geo.boundingBox, tw = b.max.x - b.min.x, td = b.max.z - b.min.z, edge = spec.id === 'middleschool' ? '#498698' : '#2f3b44';
            for (const s of [-1, 1]) { k.box([tw + 4, 24, 4], [0, top - 17.5, s * (td / 2 + 1)], edge); k.box([4, 24, td + 4], [s * (tw / 2 + 1), top - 17.5, 0], edge); }
        }
        if (!young && spec.id !== 'highschool' && spec.id !== 'university') { const geo = g.children[0].geometry; geo.computeBoundingBox(); const b = geo.boundingBox, tw = b.max.x - b.min.x, td = b.max.z - b.min.z; k.box([tw - 130, 45, 22], [0, top - 80, -td / 2 + 70], '#72818a'); }
    }
    if (/student-chair/.test(id) && ['middleschool', 'highschool', 'college'].includes(spec.id)) {
        // Some satchels and backpacks hang on chair backs.
        const n = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        if (n % 3 === 0) { k.box([220, 260, 100], [0, 380, 210], ['#8d9c90', '#a5624a', '#4f6f86', '#c9b08f'][n % 4]); k.box([150, 90, 12], [0, 290, 262], '#b8b39b'); }
    }
}

// Wall content, ceiling decor and perimeter features (after the shell detail).
const DECOR = {
    kindergarten(kit, E) {
        const { w, bz, front, byId } = kit;
        byId('room-sign')?.position.set(0, 2770, bz + 50);
        // Teaching wall: alphabet frieze, LITTLE DISCOVERIES child cards, feelings chart.
        const frieze = E.wall('back', 'alphabet-frieze', 'Wall alphabet frieze', 330, 2330, 12); E.panel(frieze, 4940, 200, drawFrieze, { res: 2048 });
        const cards = E.wall('back', 'learning-gallery', 'Wall learning gallery', -1560, 1660, 35);
        E.panel(cards, 1830, 860, (c, W, H) => { reset(c); drawBoardCardsYoung(c, W, H, kit.spec); }, { frame: 'oak', border: 35, depth: 35, res: 768 });
        const feelings = E.wall('back', 'feelings-chart', 'Wall feelings chart', 2560, 1500, 20); E.panel(feelings, 700, 820, drawFeelings, { frame: '#dba55d', border: 18, res: 512 });
        // Door wall: children's art at child height with numbers, coat pegs, family photo tree.
        const art = E.wall('right', 'student-art', 'Wall student artwork', -1180, 1250, 14); E.panel(art, 1900, 860, drawChildArtWall, { res: 1024 });
        const acoustic = byId('acoustic-panels'); if (acoustic) acoustic.position.set(w / 2 - 45, 2230, -1180);
        pegs(kit, E, 'right', 1000, 880, 8, 175, ['#e48e6e', '#7fb3a5', '#dba55d', '#88a9bf'], true);
        const tree = E.wall('right', 'family-photo-tree', 'Wall family photo tree', 2180, 1450, 14); E.panel(tree, 700, 1100, drawFamilyTree, { res: 512 });
        // Window: sill garden of cress pots and sun-catcher film.
        const sill = E.wall('left', 'sill-garden', 'Sill cress garden', 800, 840, 10); const sk = detailKit();
        for (let n = 0; n < 4; n++) { const x = -420 + n * 280; sk.cyl(60, 48, 100, [x, 50, 70], ['#e48e6e', '#dba55d', '#7fb3a5', '#b48d99'][n]); sk.cyl(55, 55, 8, [x, 100, 70], '#5a4636'); for (let q = 0; q < 14; q++) sk.cyl(3, 3, 60 + rnd(q + n * 14) * 30, [x - 35 + (q % 5) * 17, 135, 50 + Math.floor(q / 5) * 20], '#8fbf5a'); sk.box([12, 160, 3], [x + 45, 160, 95], '#e7d3ac'); sk.box([60, 40, 3], [x + 45, 230, 96], '#fffaf0'); }
        E.build(sk, sill);
        const glass = ['#f0c24b', '#e48e6e', '#7fb3a5', '#4f8fc0', '#b48d99'];
        // Sun-catcher film glows while the sun is on the glass.
        for (let n = 0; n < 7; n++) { const m = E.glow(glass[n % 5], [.5, .55, .42, .04, .5], { transparent: true, opacity: .55, roughness: .2 }); const disc = kit.mesh(kit.window, new THREE.CircleGeometry(70 + (n % 3) * 25, 24), m, [-1500 + n * 90 + (n > 3 ? 1650 : 0), 300 + (n % 3) * 170, 6]); disc.castShadow = false; }
        // Ceiling: paper lanterns over the three centres and a bunting line.
        // 3000K paper lanterns; after hours only the story-carpet lantern stays on.
        const lanternMat = E.glow('#ffe9c8', [.32, .26, 1.05, .1, .95]), storyLantern = E.glow('#ffe9c8', [.32, .26, 1.05, .9, .95]);
        for (const [x, y, z, r] of [[-1700, 2450, 3300, 210], [1250, 2350, 1300, 200], [1800, 2500, -1400, 170], [-250, 2550, 600, 150]]) {
            kit.mesh(E.ceiling, new THREE.SphereGeometry(r, 20, 14), x === -1700 ? storyLantern : lanternMat, [x, y, z]).castShadow = false; kit.rod(E.ceiling, [x, y + r, z], [x, kit.ceiling - 10, z], 3, kit.ink);
            const ribs = detailKit(); for (let q = 0; q < 5; q++) ribs.add(new THREE.TorusGeometry(r * Math.sin((q + 1) / 6 * Math.PI), 2.5, 4, 32), [x, y + r * Math.cos((q + 1) / 6 * Math.PI), z], '#e6d2b0', [1, 1, 1], [Math.PI / 2, 0, 0]); E.build(ribs, E.ceiling);
        }
        bunting(kit, E, [[-w / 2 + 60, 2700, 200], [w / 2 - 60, 2700, 2300]], 16, ['#e48e6e', '#f0c24b', '#7fb3a5', '#88a9bf', '#b48d99']);
        bunting(kit, E, [[-w / 2 + 60, 2780, -1600], [w / 2 - 60, 2780, -300]], 14, ['#7fb3a5', '#dba55d', '#e48e6e', '#b48d99']);
        identityGallery(kit, { right: false, z: .87, name: 'Wall community and project gallery', landscape: true, trees: 7 });
    },
    elementary(kit, E) {
        const { w, bz, byId } = kit;
        byId('room-sign')?.position.set(0, 2880, bz + 50);
        const words = E.wall('back', 'learning-gallery', 'Wall word wall', -1750, 2080, 20); E.panel(words, 2600, 800, drawWordWall, { frame: '#b48f62', border: 20, res: 2048 });
        const numbers = E.wall('back', 'number-line', 'Wall number line', 1400, 2330, 10); E.panel(numbers, 2600, 170, drawNumberLine, { res: 1536 });
        const jobs = E.wall('back', 'jobs-chart', 'Wall class jobs chart', 3300, 1600, 16); E.panel(jobs, 950, 1050, drawJobs, { res: 768 });
        const acoustic = byId('acoustic-panels'); if (acoustic) acoustic.position.set(w / 2 - 45, 2080, -1767);
        const anchors = E.wall('right', 'anchor-charts', 'Wall anchor charts', 1200, 1720, 12); E.panel(anchors, 2300, 820, drawAnchorCharts, { res: 1536 });
        const writing = E.wall('right', 'student-art', 'Wall student writing gallery', 3450, 1550, 10); E.panel(writing, 1700, 520, drawWritingLine, { res: 1536 });
        const exit = E.wall('right', 'fire-drill-sign', 'Wall fire-drill route sign', 4150, 1750, 8); E.panel(exit, 300, 150, drawExitSign, { res: 256 });
        pegs(kit, E, 'right', 6000, 1200, 8, 112, ['#5d8b78', '#e0a85e', '#88a9bf', '#d58f6c'], false);
        const weather = E.wall('left', 'weather-poster', 'Wall weather station poster', -2300, 1650, 14); E.panel(weather, 900, 700, drawWeatherPoster, { frame: '#b48f62', border: 18, res: 768 });
        identityGallery(kit, { right: false, z: .87, name: 'Wall community and project gallery', landscape: true, trees: 7 });
        // Ceiling: hanging paper planets over the pods, hanging planters by the window.
        const planetMat = ['#f2c6a0', '#c6d9ea', '#d9e8c4', '#e8c6d8', '#f4e2a8'].map(c => E.M(c, 'powder', { roughness: .9 }));
        [[-400, 1900], [2800, 3200], [-400, 5000]].forEach(([x, z], n) => { for (let q = 0; q < 3; q++) { const r = 110 + (q + n) % 3 * 40, px = x - 450 + q * 450, py = 2500 - q % 2 * 180, pz = z + (q - 1) * 200; kit.mesh(E.ceiling, new THREE.SphereGeometry(r, 18, 12), planetMat[(q + n * 2) % 5], [px, py, pz]).castShadow = false; kit.rod(E.ceiling, [px, py + r, pz], [px, kit.ceiling - 10, pz], 2.5, kit.ink); if (q === 1) { const ring = detailKit(); ring.add(new THREE.TorusGeometry(r * 1.6, 8, 4, 40), [px, py, pz], '#e0c58e', [1, 1, 1], [1.3, 0, .3]); E.build(ring, E.ceiling); } } });
        hangingPlanter(kit, E, [-w / 2 + 380, 2350, 200]); hangingPlanter(kit, E, [-w / 2 + 380, 2400, 3800]);
    },
    middleschool(kit, E) {
        const { w, bz, byId } = kit;
        byId('room-sign')?.position.set(0, 2880, bz + 50);
        const grid = E.wall('back', 'research-gallery', 'Wall skills poster', -2430, 1700, 20); E.panel(grid, 1830, 830, (c, W, H) => drawSkillsGrid(c, W, H, kit.spec), { frame: '#3e5f6a', border: 20, res: 1024 });
        const notes = E.wall('back', 'brainstorm-wall', 'Wall brainstorm notes', 3300, 1950, 10); E.panel(notes, 1250, 760, drawStickyPatch, { frame: '#c4ccd0', border: 12, res: 1024 });
        const posters = E.wall('right', 'city-posters', 'Wall city poster pin-up', 4200, 1700, 10);
        E.panel(posters, 1500, 1300, (c, W, H) => { c.fillStyle = '#cfd9d6'; c.fillRect(0, 0, W, H); for (let n = 0; n < 6; n++) cityPoster(c, 12 + n % 3 * W / 3, 12 + Math.floor(n / 3) * H / 2, W / 3 - 24, H / 2 - 24, n); }, { frame: '#c4ccd0', border: 14, res: 1024 });
        identityGallery(kit, { right: true, z: .405, name: 'Wall community and project gallery', landscape: false, squares: true });
        // Teacher corner (window wall, back bay): the week's project timetable beside a framed city poster.
        const tt = E.wall('left', 'teacher-timetable', 'Wall project timetable', kit.layout.desk[1] - 150, 1900, 16); E.panel(tt, 1300, 900, (c, W, H) => timetable(c, W, H, 'PROJECT WEEK', '#498698', ['#498698', '#e0b45e', '#6aa0ad', '#e07a3f', '#88b5be']), { frame: '#3e5f6a', border: 18, res: 1024 });
        const cp = E.wall('left', 'city-map-poster', 'Wall framed city poster', kit.layout.desk[1] - 1450, 1750, 16); E.panel(cp, 700, 960, (c, W, H) => cityPoster(c, 0, 0, W, H, 1), { frame: '#c4ccd0', border: 16, res: 768 });
        // Ceiling: felt acoustic baffles over the clusters; pothos by the window.
        const felt = [E.M('#498698', 'fabric', { roughness: .95 }), E.M('#9aa7ab', 'fabric', { roughness: .95 })];
        // 4000K linear lights ride under the blades; after school only the two
        // clusters still in use stay lit (the others have their chairs up), and
        // they stay on, dimmed, while the teacher plans at night.
        const linear = [E.glow('#f4f6f2', [.35, .3, 1, .5, .9]), E.glow('#f4f6f2', [.35, .3, .12, .04, .9])];
        for (let n = 0; n < 6; n++) {
            const x = -1100 + (n % 3) * 2200, z = n < 3 ? 1600 : 4640, y = kit.ceiling - 480;
            kit.box(E.ceiling, [1200, 300, 30], [x, y, z], felt[n % 2], 6);
            for (const dx of [-450, 450]) kit.rod(E.ceiling, [x + dx, y + 150, z], [x + dx, kit.ceiling, z], 3, kit.ink);
            kit.box(E.ceiling, [1080, 26, 54], [x, y - 163, z], kit.metal, 4); kit.box(E.ceiling, [1040, 6, 40], [x, y - 178, z], linear[n < 2 ? 0 : 1], 2);
        }
        hangingPlanter(kit, E, [-w / 2 + 380, 2400, 0]); hangingPlanter(kit, E, [-w / 2 + 380, 2350, 3600]);
    },
    highschool(kit, E) {
        const { w, bz, d, byId } = kit;
        byId('room-sign')?.position.set(0, 2880, bz + 50);
        const shelf = kit.cabinet('resource-shelf', [-2200, 0, bz + 340], 1550, 1050, true); const sk = detailKit();
        for (const x of [-660, 120]) { sk.box([12, 160, 140], [x, 1050 + 80, 60], '#2f3b44'); sk.box([120, 8, 140], [x + 60 * (x < 0 ? 1 : -1), 1054, 60], '#2f3b44'); }
        sk.box([220, 70, 300], [400, 1050 + 35, 20], '#d9a441'); sk.box([200, 60, 280], [410, 1050 + 100, 20], '#567081'); E.build(sk, shelf);
        const hsBooks = bookRuns([{ x0: -650, x1: 110, y: 1050, front: 130, depth: 190, hMin: 190, hMax: 260, seed: 77 }], E.spines()); if (hsBooks) shelf.add(hsBooks);
        const table = E.wall('back', 'research-gallery', 'Wall periodic table poster', -2200, 1900, 18); E.panel(table, 1800, 840, (c, W, H) => periodic(c, W, H, kit.spec), { frame: '#2f3b44', border: 18, res: 1024 });
        const flow = E.wall('back', 'sankey-poster', 'Wall energy flow poster', -500, 1750, 14); E.panel(flow, 1000, 760, (c, W, H) => sankey(c, W, H, kit.spec), { frame: '#2f3b44', border: 14, res: 768 });
        // Projector screen roll-down box above the board.
        const box = E.wall('back', 'projector-screen-box', 'Projector screen box', kit.w * .17, 2560, 120); const pk = detailKit(); pk.box([2500, 110, 120], [0, 0, 0], '#e8ecee'); pk.box([2400, 10, 6], [0, -58, 40], '#2f3b44'); E.build(pk, box);
        const acoustic = byId('acoustic-panels'); if (acoustic) acoustic.position.set(w / 2 - 45, 1900, 1000);
        // Door wall: goggles rack and eyewash sign over the bench, poster gallery, lockers.
        const goggles = E.wall('right', 'goggles-rack', 'Wall safety goggles rack', -2000, 1500, 60); const gk = detailKit(); gk.box([800, 40, 50], [0, 0, 0], '#9fb0b8');
        for (let n = 0; n < 8; n++) { gk.box([80, 40, 30], [-350 + n * 100, -50, 40], '#2f3b44'); gk.box([70, 45, 20], [-350 + n * 100, -90, 50], '#c9e4ec'); } E.build(gk, goggles);
        const eye = E.wall('right', 'eyewash-sign', 'Wall eyewash and goggles signs', -1000, 1750, 8); E.panel(eye, 420, 300, (c, W, H) => { c.fillStyle = '#2f8a57'; c.fillRect(0, 0, W / 2 - 4, H); c.fillStyle = '#2a6aa8'; c.fillRect(W / 2 + 4, 0, W / 2 - 4, H); dot(c, W * .25, H * .45, H * .18, '#ffffff'); dot(c, W * .25, H * .45, H * .07, '#2f8a57'); for (let n = 0; n < 3; n++) dot(c, W * (.15 + n * .1), H * .78, 6, '#ffffff'); c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.beginPath(); c.arc(W * .66, H * .45, H * .12, 0, TAU); c.arc(W * .86, H * .45, H * .12, 0, TAU); c.stroke(); write(c, 'EYE WASH', W * .25, H * .12, 16, '#ffffff'); write(c, 'GOGGLES', W * .76, H * .12, 16, '#ffffff'); }, { res: 512 });
        const gallery = E.wall('right', 'poster-gallery', 'Wall student poster gallery', 4800, 1700, 10);
        E.panel(gallery, 2000, 1750, (c, W, H) => { c.fillStyle = '#e7e4de'; c.fillRect(0, 0, W, H); for (let n = 0; n < 6; n++) { const x = n % 3 * W / 3, y = Math.floor(n / 3) * H / 2; c.fillStyle = '#2f3b44'; c.fillRect(x + 10, y + 10, W / 3 - 20, H / 2 - 20); sciencePoster(c, x + 22, y + 22, W / 3 - 44, H / 2 - 44, n, '#567081'); } }, { res: 1024 });
        identityGallery(kit, { right: false, z: (6700 - bz) / d, name: 'Wall community and project gallery', landscape: false });
        // Teacher corner (window wall, back bay): lab safety poster and the department timetable.
        const safe = E.wall('left', 'safety-poster', 'Wall lab safety poster', kit.layout.desk[1] - 1350, 1800, 14); E.panel(safe, 760, 1000, safetyPoster, { frame: '#2f3b44', border: 16, res: 768 });
        const tt = E.wall('left', 'teacher-timetable', 'Wall department timetable', kit.layout.desk[1] + 50, 1900, 16); E.panel(tt, 1300, 900, (c, W, H) => timetable(c, W, H, 'PHYSICS · TERM 2', '#567081', ['#567081', '#d9a441', '#6f8796', '#9aa8b0']), { frame: '#2f3b44', border: 18, res: 1024 });
        // A pendulum model hanging from the ceiling near the window.
        const px = -w / 2 + 1500, pz = 2500; kit.rod(E.ceiling, [px, kit.ceiling - 10, pz], [px + 120, 1850, pz], 2, kit.ink); kit.mesh(E.ceiling, new THREE.SphereGeometry(70, 18, 12), E.M('#d9a441', 'metal', { metalness: .6, roughness: .3 }), [px + 125, 1780, pz]);
        kit.box(E.ceiling, [300, 20, 60], [px, kit.ceiling - 10, pz], kit.metal, 3);
    },
    college(kit, E) {
        const { w, bz, d, byId } = kit;
        byId('room-sign')?.position.set(0, 2880, bz + 50);
        // Teaching wall: terracotta accent, oak slats behind the podium, two screens.
        const accentWall = E.wall('back', 'teaching-wall-accent', 'Terracotta teaching wall panel', 0, 1600, 10); kit.box(accentWall, [3000, 2300, 10], [0, 0, 0], E.M('#a5624a', 'plaster', { roughness: .85 }), 2);
        // The podium bay of the oak slat wainscot (WALLS.college runs the rest of the wall).
        const slats = E.wall('back', 'oak-slat-panel', 'Oak acoustic slat panel', 0, 0, 30); slatWall(kit, E, E.S, -1440, 1440, 1100, slats, -19);
        kit.board.position.set(0, 1720, bz + 65);
        [[-2600, 0], [2600, 1]].forEach(([x, v]) => { const s = E.wall('back', v ? 'teaching-screen-2' : 'teaching-screen-1', 'Wall teaching display', x, 1350, 10); kit.monitor(s, [0, 0, 0], 1500, v + 2, true); });
        const acoustic = byId('acoustic-panels'); if (acoustic) acoustic.position.set(w / 2 - 45, 1900, -1300);
        // Door wall: team displays behind the whiteboards, project photos, event rail.
        [[667, 'presentation-display', 0], [3967, 'team-display-2', 1]].forEach(([z, id, v]) => { const s = E.wall('right', id, 'Wall team display', z, 1450, 10); kit.monitor(s, [0, 0, 0], 1000, v, true); });
        const photos = E.wall('right', 'research-gallery', 'Wall project photo gallery', 2320, 1650, 16);
        E.panel(photos, 1100, 900, (c, W, H) => { c.fillStyle = '#e8e4db'; c.fillRect(0, 0, W, H); for (let n = 0; n < 4; n++) { const x = n % 2 * W / 2, y = Math.floor(n / 2) * H / 2; c.fillStyle = '#3a2e26'; c.fillRect(x + 8, y + 8, W / 2 - 16, H / 2 - 16); c.fillStyle = '#f2ece0'; c.fillRect(x + 16, y + 16, W / 2 - 32, H / 2 - 32); projectPhoto(c, x + 30, y + 30, W / 2 - 60, H / 2 - 60, n); } }, { res: 768 });
        const events = E.wall('right', 'event-rail', 'Wall event notice rail', 5650, 1500, 10); E.panel(events, 1700, 560, eventPosters, { res: 1024 });
        identityGallery(kit, { right: false, z: (7600 - bz) / d, name: 'Wall community and project gallery', landscape: false });
        // Instructor corner (window wall, back bay): the course calendar.
        const tt = E.wall('left', 'teacher-timetable', 'Wall course calendar', kit.layout.desk[1] - 100, 1850, 16); E.panel(tt, 1500, 1000, (c, W, H) => timetable(c, W, H, 'COURSE CALENDAR', '#866653', ['#a5624a', '#c9b08f', '#5f7d72', '#866653', '#d9b27c']), { frame: 'oak', border: 20, res: 1024 });
        // Window wall front bay (reverse view): a cork pin-up board of project sketches and a bag rail.
        const pin = E.wall('left', 'pinup-board', 'Wall project pin-up board', 6500, 1700, 20);
        E.panel(pin, 1500, 900, (c, W, H) => { drawCork(c, W, H); for (let n = 0; n < 6; n++) { const x = 30 + n % 3 * W / 3, y = 30 + Math.floor(n / 3) * H / 2, w = W / 3 - 60, h = H / 2 - 60; c.save(); c.translate(x + w / 2, y + h / 2); c.rotate((rnd(n + 2) - .5) * .08); c.fillStyle = '#00000030'; c.fillRect(-w / 2 + 5, -h / 2 + 6, w, h); c.fillStyle = '#f7f3ea'; c.fillRect(-w / 2, -h / 2, w, h); projectPhoto(c, -w / 2 + 12, -h / 2 + 12, w - 24, h * .62, n % 4); textLines(c, -w / 2 + 12, h * .2, w - 24, 3, 12, '#8a9597', 3); dot(c, 0, -h / 2 + 8, 7, ['#d9534f', '#4f8fc0', '#f0c24b'][n % 3]); c.restore(); } }, { frame: 'oak', border: 22, res: 1024 });
        pegs(kit, E, 'left', 7900, 1650, 6, 150, ['#866653', '#5f7d72', '#a5624a', '#4f6f86'], false);
        // Ceiling: pendant clusters over the four team tables.
        // 3500K pendant clusters; during independent study only the first team table stays lit.
        const shade = E.M('#3a2e26', 'metal', { metalness: .4, roughness: .45 }), lit = [E.glow('#ffe2b8', [.3, .25, 1.1, .95, .95]), E.glow('#ffe2b8', [.3, .25, 1.1, .05, .95])];
        [[-1300, 667], [2400, 667], [-1300, 3967], [2400, 3967]].forEach(([x, z], n) => { for (const dx of [-450, 0, 450]) {
            kit.rod(E.ceiling, [x + dx, kit.ceiling - 5, z], [x + dx, 2350, z], 3, kit.ink); kit.mesh(E.ceiling, new THREE.CylinderGeometry(70, 160, 160, 20, 1, true), shade, [x + dx, 2280, z]);
            kit.mesh(E.ceiling, new THREE.CircleGeometry(150, 20), lit[n ? 1 : 0], [x + dx, 2205, z]).rotation.x = Math.PI / 2;
        } });
    },
    university(kit, E) {
        const { w, bz, d, byId } = kit;
        byId('room-sign')?.position.set(0, 2880, bz + 50);
        kit.board.position.set(-600, 1640, bz + 65);
        [[-2950, 'presentation-display', 0], [1550, 'symposium-display-2', 1]].forEach(([x, id, v]) => { const s = E.wall('back', id, 'Wall symposium display', x, 1350, 10); kit.monitor(s, [0, 0, 0], 1500, v, true); });
        const map = E.wall('back', 'campus-map', 'Wall framed campus map', -4900, 1550, 24); E.panel(map, 900, 680, campusMap, { frame: '#3d2f26', border: 30, res: 768 });
        // Door wall: framed A0 research posters on a picture rail with brass lights.
        const rail = E.wall('right', 'research-gallery', 'Wall research poster gallery', -1100, 1700, 24);
        const rk = detailKit(); rk.box([5800, 30, 30], [0, 1060, -10], '#b39b6a'); E.build(rk, rail);
        const brass = E.M('#b39b6a', 'metal', { metalness: .6, roughness: .35 }), bulb = E.glow('#fff1d6', [.15, .12, 1.1, .7, .9]);
        for (let n = 0; n < 5; n++) {
            const x = -2300 + n * 1150; E.panel(rail, 841, 1189, (c, W, H) => researchPoster(c, W, H, n), { frame: '#3d2f26', border: 26, res: 768, at: [x, 0, 0] });
            kit.rod(rail, [x, 1060, 0], [x, 760, 60], 6, brass); kit.box(rail, [360, 40, 70], [x, 740, 90], brass, 8); kit.box(rail, [330, 4, 40], [x, 718, 92], bulb, 2);
            kit.rod(rail, [x - 150, 1060, -10], [x - 330, 640, 0], 1.2, kit.ink); kit.rod(rail, [x + 150, 1060, -10], [x + 330, 640, 0], 1.2, kit.ink);
        }
        // Felt panels behind the graduate carrels; acoustic panels on the window wall's front bay.
        for (const [z, id] of [[6133, 'carrel-felt-1'], [3803, 'carrel-felt-2']]) { const f = E.wall('right', id, 'Wall carrel felt panel', z, 1300, 40); kit.box(f, [1400, 1200, 40], [0, 0, 0], E.M('#2f5446', 'fabric', { roughness: .95 }), 10); }
        const acoustic = byId('acoustic-panels'); if (acoustic) { kit.left.attach(acoustic); acoustic.position.set(-w / 2 + 45, 1850, 7900); acoustic.rotation.y = Math.PI / 2; }
        // Lecturer's corner (window wall, back bay): three framed engravings under a brass picture light.
        for (let n = 0; n < 3; n++) { const g = E.wall('left', `engraving-${n + 1}`, 'Wall framed engraving', kit.layout.desk[1] - 1150 + n * 850, 1700, 30); E.panel(g, 560, 760, (c, W, H) => engraving(c, W, H, n), { frame: '#3d2f26', border: 40, depth: 30, res: 512 }); }
        // Linen drapes on a brass rod at the window ends.
        const drapes = E.wall('left', 'window-drapes', 'Window linen drapes', bz + d * .54, 1500, 140); const dk = detailKit(), span = d * .48;
        dk.box([span + 900, 30, 30], [0, 1150, -10], '#b39b6a'); for (const x of [-(span + 900) / 2, (span + 900) / 2]) dk.ball(30, [x, 1150, -10], '#b39b6a');
        for (const side of [-1, 1]) for (let n = 0; n < 9; n++) dk.box([90, 2600, 40 + (n % 2) * 30], [side * (span / 2 + 20) - side * n * 85 + side * 300, -160, 10 + (n % 2) * 15], n % 2 ? '#e9e1cf' : '#ded4bf');
        E.build(dk, drapes);
    }
};
function drawBoardCardsYoung(c, W, H, spec) {
    boardFrame(c, W, H, spec, { young: true }); reset(c);
    for (let n = 0; n < 5; n++) {
        const x = 30 + n * (W - 45) / 5, y = 80 + n % 2 * 12, width = (W - 90) / 5;
        c.fillStyle = '#fffaf0'; c.save(); c.translate(x, y); c.rotate((n - 2) * .025); c.fillRect(0, 0, width, H - 140);
        childPainting(c, 10, 10, width - 20, (H - 140) * .55, n * 2 + 1);
        write(c, ['Aa', 'Bb', 'Cc', '123', '★'][n], width / 2, (H - 140) * .75, 22, '#566b65'); c.restore();
    }
}
function pegs(kit, E, wall, along, y, count, pitch, colors, child) {
    const g = E.wall(wall, 'learning-pegs', child ? 'Wall coats and learning bags' : 'Wall backpack hooks', along, y, 40), k = detailKit(), span = count * pitch;
    k.box([span + 80, 95, 30], [0, 0, 0], '#c6aa85');
    for (let n = 0; n < count; n++) {
        const x = -span / 2 + pitch / 2 + n * pitch, bw = Math.min(160, pitch - 10);
        k.cyl(14, 14, 70, [x, 10, 45], '#8a9795'); k.box([bw, 230, 90], [x, -170, 65], colors[n % colors.length]); k.box([bw * .7, 75, 8], [x, -235, 112], '#d4c3a0');
        k.box([bw * .2, 120, 10], [x - bw * .3, -40, 40], colors[(n + 1) % colors.length]);
        if (child) { k.box([90, 70, 3], [x, 95, 17], '#fffaf0'); k.ball(22, [x, 98, 19], PASTEL[n % 6], [1, 1, .1]); }
    }
    if (child) for (let n = 0; n < 2; n++) { k.box([70, 50, 150], [-200 + n * 90, -y + 25, 230], ['#e48e6e', '#4f8fc0'][n]); k.box([70, 20, 150], [-200 + n * 90, -y + 10, 230], '#f4f1ea'); }
    E.build(k, g);
}
function bunting(kit, E, [[x0, y0, z0], [x1, y1, z1]], count, colors) {
    const k = detailKit(), seg = 24, pt = t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 220, z0 + (z1 - z0) * t];
    for (let n = 0; n < seg; n++) { const a = pt(n / seg), b = pt((n + 1) / seg), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const mid = a.map((v, i) => (v + b[i]) / 2); k.add(new THREE.CylinderGeometry(2.5, 2.5, len, 4), mid, '#e6dccb', [1, 1, 1], [0, -Math.atan2(b[2] - a[2], b[0] - a[0]), Math.PI / 2 - Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]))]); }
    const yaw = -Math.atan2(z1 - z0, x1 - x0);
    for (let n = 0; n < count; n++) { const at = pt((n + .5) / count); at[1] -= 85; k.add(new THREE.ConeGeometry(80, 170, 3), at, colors[n % colors.length], [1, 1, .06], [Math.PI, yaw, 0]); }
    E.build(k, E.ceiling);
}
function hangingPlanter(kit, E, [x, y, z]) {
    const k = detailKit(); k.cyl(140, 100, 160, [x, y, z], '#d9cbb0'); for (let n = 0; n < 3; n++) { const a = n * TAU / 3; k.add(new THREE.CylinderGeometry(2, 2, kit.ceiling - y - 80, 4), [x + Math.cos(a) * 60, (y + kit.ceiling) / 2 + 40, z + Math.sin(a) * 60], '#cbbf9f'); }
    for (let n = 0; n < 14; n++) { const a = n * 2.4, r = 90 + n % 3 * 30; k.ball(50, [x + Math.cos(a) * r, y + 20 - n * 26, z + Math.sin(a) * r], n % 2 ? '#4f7f52' : '#6b9a5e', [.6, 1.6, .5], [0, a, .4]); }
    E.build(k, E.ceiling);
}
// ---- Lighting fixtures, pools and the sun patch --------------------------
// Real lights stay within budget (3 room lights + the activity-table lamp +
// one lounge/reading lamp). Everything else is an emissive fixture plus an
// additive pool, levelled per daypart in `atmosphere`.
//
// Sun patch: the glazing's silhouette projected on the floor along the same
// sun direction as the shared shadow rig (room-refinement DAY_ANGLES).
const SUN_ANGLE = { morning: [.62, -.36], afternoon: [1.45, .12], evening: [.32, .48], night: [1.2, -.18], party: [1.0, .3] }; // night: lamp-post / moon glow
function sunPatch(kit, E) {
    const { w, d, bz, front } = kit, z0 = bz + d * .54, half = d * .24;
    const map = canvasTexture((c, W, H) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, W, H); c.filter = 'blur(9px)';
        // Two panes either side of the mullion; the blind band at the head lets less through.
        for (const [x0, x1] of [[.025, .485], [.515, .975]]) {
            c.fillStyle = '#ffffff'; c.fillRect(x0 * W, H * .2, (x1 - x0) * W, H * .76);
            for (let y = .04; y < .2; y += .028) { c.fillStyle = '#ffffff70'; c.fillRect(x0 * W, y * H, (x1 - x0) * W, H * .014); }
        }
        c.filter = 'none';
    }, 512, 256);
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.PlaneGeometry(1, 1, 16, 16); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const sun = new THREE.Mesh(geo, mat); sun.name = 'Window daylight patch'; sun.renderOrder = 2; sun.raycast = noRay; sun.castShadow = sun.receiveShadow = false; sun.frustumCulled = false; kit.root.add(sun);
    E.sun = (phase, color, strength) => {
        const angle = SUN_ANGLE[phase]; sun.visible = !!angle && strength > .01; if (!sun.visible) return;
        const [elevation, sweep] = angle, pos = geo.attributes.position, uv = geo.attributes.uv, col = geo.attributes.color;
        for (let i = 0; i < pos.count; i++) {
            // uv.y = 1 at the window head (2600), 0 at the sill (800).
            const y = 800 + uv.getY(i) * 1800, z = z0 - half + uv.getX(i) * half * 2, t = y / elevation, x = -w / 2 + 25 + t, zz = z + sweep * t;
            const inside = x < w / 2 - 40 && zz > bz + 30 && zz < front - 30 ? 1 - .3 * uv.getY(i) : 0;
            pos.setXYZ(i, Math.min(x, w / 2 - 40), 11, THREE.MathUtils.clamp(zz, bz + 30, front - 30)); col.setXYZ(i, inside, inside, inside);
        }
        pos.needsUpdate = col.needsUpdate = true; geo.computeBoundingSphere();
        mat.color.set(color).multiplyScalar(strength);
    };
}
// Wall placement: [x, y, z] at `off` mm from the wall surface, facing into the room.
const onWall = (kit, wall, along, y, off) => wall === 'back' ? [along, y, kit.bz + 18 + off] : wall === 'right' ? [kit.w / 2 - 18 - off, y, along] : [-kit.w / 2 + 18 + off, y, along];
const wallGroup = (kit, wall) => ({ back: kit.back, right: kit.right, left: kit.left })[wall];
// Picture / rail light: a slim bar on two arms above the artwork, its emissive
// lens and a soft wash down the wall (and the artwork).
function pictureLight(kit, E, wall, along, y, span, levels, { drop = 1000, finish = '#3a3a36', color = '#ffdcae', heads = 0, poolW = span * 1.35 } = {}) {
    const g = wallGroup(kit, wall), side = wall !== 'back', size = l => side ? [70, 30, l] : [l, 30, 70];
    const metal = E.M(finish, 'metal', { metalness: .55, roughness: .38 }), lens = E.glow('#fff1d8', levels.map(v => .12 + v * 2.2));
    kit.box(g, size(span), onWall(kit, wall, along, y, 130), metal, 6);
    kit.box(g, side ? [50, 6, span - 30] : [span - 30, 6, 50], onWall(kit, wall, along, y - 17, 130), lens, 2);
    for (const s of [-.35, .35]) { const a = along + s * span; kit.rod(g, onWall(kit, wall, a, y + 40, 4), onWall(kit, wall, a, y + 10, 120), 5, metal); }
    for (let n = 0; n < heads; n++) { const a = along + (n - (heads - 1) / 2) * span / heads; kit.mesh(g, new THREE.CylinderGeometry(34, 42, 110, 14), metal, onWall(kit, wall, a, y - 60, 150)).rotation[side ? 'z' : 'x'] = wall === 'right' ? .5 : wall === 'left' ? -.5 : .5; }
    E.pool(g, onWall(kit, wall, along, y - drop * .5, 62), [poolW, drop * 1.3], color, levels.map(v => v * .32), wall);
}
// Screen spill: a cool halo round a wall display (evening, night, presentations).
const screenHalo = (kit, E, wall, along, y, width, levels) => E.pool(wallGroup(kit, wall), onWall(kit, wall, along, y, 46), [width * 1.7, width * 1.05], '#cfe1ff', levels, wall);
// Pool on a table top (travels with the table).
const tablePool = (kit, E, id, [sx, sz], color, levels, top = 740, at = [0, 0]) => { const t = kit.byId(id); if (t) E.pool(t, [at[0], top + 3, at[1]], [sx, sz], color, levels); };
const WARM = '#ffd7a2';
const FIXTURES = {
    kindergarten(kit, E) {
        const { w } = kit;
        // Picture lights: the LITTLE DISCOVERIES cards (teaching wall) and the children's art line.
        pictureLight(kit, E, 'back', -1560, 2180, 1500, [.04, .02, .55, .2, .45], { finish: '#c99a5b', drop: 1100 });
        pictureLight(kit, E, 'right', -1180, 1730, 1600, [.04, .02, .55, .12, .45], { finish: '#c99a5b', drop: 900 });
        // Lantern light on the story carpet and the shared table; the light table's spill on the block rug.
        const rug = kit.byId('circle-rug'); if (rug) E.pool(rug, [0, 14, 0], [2600, 2600], '#ffd49c', [0, 0, .3, .42, .26]);
        for (const n of [0, 1]) tablePool(kit, E, `student-table-0-${n}`, [1500, 1000], WARM, [0, 0, .26, 0, .22], 520, [n ? -300 : 300, 0]);
        const blocks = kit.byId('block-rug'); if (blocks) E.pool(blocks, [0, 12, 0], [2600, 2000], '#fff0cf', [.04, .06, .3, .16, .26]);
    },
    elementary(kit, E) {
        pictureLight(kit, E, 'back', -1750, 2570, 2400, [.04, .02, .5, .18, .42], { finish: '#b48f62', drop: 1200 });
        for (const key of ['A', 'B', 'C']) tablePool(kit, E, `student-table-${key}-a`, [1800, 1800], WARM, [0, 0, .24, 0, .2], 620, [0, 310]);
        const carpet = kit.byId('meeting-carpet'); if (carpet) E.pool(carpet, [0, 14, 0], [3600, 2600], '#ffe2b8', [0, 0, .14, 0, .16]);
    },
    middleschool(kit, E) {
        pictureLight(kit, E, 'back', -2430, 2240, 1600, [.04, .02, .42, .15, .36], { drop: 1000 });
        [0, 1, 2, 3, 4].forEach(n => tablePool(kit, E, `student-table-${n}-a`, [1800, 1800], '#fff0dc', n < 2 ? [0, 0, .3, .22, .22] : [0, 0, .03, 0, .22], 740, [0, 310]));
        screenHalo(kit, E, 'right', kit.bz + kit.d * .57, 1350, 1500, [.03, .03, .22, .3, .32]);
        const maker = kit.byId('maker-floor-zone'); if (maker) E.pool(maker, [0, 12, 0], [3000, 2400], '#fff2dc', [0, 0, .12, .16, .14]);
    },
    highschool(kit, E) {
        const { bz } = kit;
        pictureLight(kit, E, 'back', -2200, 2440, 1700, [.04, .02, .42, .16, .36], { drop: 1100 });
        // Demonstration spot: a ceiling can over the desk and a pool on the slate inlay.
        const can = E.M('#2f3b44', 'metal', { metalness: .5, roughness: .4 });
        kit.mesh(E.ceiling, new THREE.CylinderGeometry(95, 110, 150, 20), can, [0, kit.ceiling - 75, -2600]);
        kit.mesh(E.ceiling, new THREE.CircleGeometry(80, 20), E.glow('#fff4e0', [.4, .35, 1.4, 1.6, 1.5]), [0, kit.ceiling - 151, -2600]).rotation.x = Math.PI / 2;
        const inlay = kit.byId('demo-floor-inlay'); if (inlay) E.pool(inlay, [0, 12, 120], [2900, 2100], '#fff1da', [.06, .05, .32, .48, .38]);
        // Gallery rail light over the student posters; screen spill; the lit equipment cabinet.
        pictureLight(kit, E, 'right', 4800, 2700, 2100, [.04, .02, .5, .14, .44], { drop: 1500, heads: 3 });
        screenHalo(kit, E, 'right', bz + kit.d * .57, 1350, 1500, [.03, .03, .22, .3, .32]);
        const cab = kit.byId('storage'); if (cab) { E.pool(cab, [0, 1050, -150], [1500, 2100], '#fff1d8', [.05, .04, .42, .32, .36], 'back'); kit.box(cab, [1150, 8, 30], [0, kit.options.storage.height - 70, 150], E.glow('#fff4e2', [.2, .15, 1, .8, .9]), 2); }
    },
    college(kit, E) {
        const { w, bz } = kit;
        // Track spots on the teaching wall: scallops on the terracotta panel and grazing on the oak slats.
        const metal = E.M('#2a2a28', 'metal', { metalness: .5, roughness: .4 });
        kit.box(kit.back, [8000, 34, 34], [0, 3140, bz + 300], metal, 4);
        for (const x of [-3600, -2600, -1000, 0, 1000, 2600, 3600]) { kit.rod(kit.back, [x, 3140, bz + 300], [x, 3060, bz + 300], 6, metal); const head = kit.mesh(kit.back, new THREE.CylinderGeometry(42, 52, 140, 14), metal, [x, 3010, bz + 270]); head.rotation.x = -.6; }
        for (const x of [-1000, 0, 1000]) E.pool(kit.back, [x, 1950, bz + 75], [1250, 2300], '#ffd8a8', [.06, .04, .3, .16, .3], 'back');
        for (const x of [-3600, 3600]) E.pool(kit.back, [x, 900, bz + 75], [1700, 1800], '#ffd8a8', [.05, .03, .26, .12, .24], 'back');
        for (const x of [-2600, 2600]) screenHalo(kit, E, 'back', x, 1350, 1500, [.02, .02, .18, .22, .28]);
        for (const z of [667, 3967]) screenHalo(kit, E, 'right', z, 1450, 1000, [.02, .02, .16, z < 1000 ? .2 : 0, .26]);
        const stage = kit.byId('teaching-stage'); if (stage) E.pool(stage, [-stage.position.x, 12, -3133 - stage.position.z + 200], [3800, 2400], '#ffe0b4', [.05, .04, .28, .16, .3]);
        [0, 1, 2, 3].forEach(n => tablePool(kit, E, `student-table-${n}`, [2600, 1500], WARM, n ? [0, 0, .34, 0, .3] : [0, 0, .34, .4, .3]));
    },
    university(kit, E) {
        const { bz } = kit, cx = -600, cz = 1533;
        // One long 3000K seminar pendant over the hollow square.
        const bronze = E.M('#3a2e26', 'metal', { metalness: .5, roughness: .4 });
        kit.box(E.ceiling, [4400, 48, 150], [cx, 2460, cz], bronze, 10);
        kit.box(E.ceiling, [4300, 6, 112], [cx, 2434, cz], E.glow('#ffe4ba', [.3, .25, 1.15, .22, 1]), 3);
        for (const dx of [-1900, 1900]) kit.rod(E.ceiling, [cx + dx, 2484, cz], [cx + dx, kit.ceiling - 5, cz], 3, kit.ink);
        for (const [id, size] of [['back', [5300, 1300]], ['left', [1300, 2700]], ['right', [1300, 2700]], ['front-left', [2000, 1250]], ['front-right', [2000, 1250]]]) tablePool(kit, E, `seminar-table-${id}`, size, WARM, [0, 0, .3, .08, .32]);
        const rug = kit.byId('seminar-rug'); if (rug) E.pool(rug, [0, 14, 0], [3800, 2600], '#ffd9a6', [0, 0, .14, 0, .12]);
        // Banker's lamps on the reading table: pools on the table and the rug round it.
        for (const x of [-700, 700]) tablePool(kit, E, 'reading-table', [1600, 1300], '#ffd49a', [.02, .02, .5, .8, .34], 740, [x, 60]);
        const reading = kit.byId('reading-rug'); if (reading) E.pool(reading, [0, 14, 0], [4400, 3000], '#ffcf96', [0, 0, .14, .3, .1]);
        // Picture lights: research posters (the brass lights already on the rail), campus map, library bookcases.
        const rail = kit.byId('research-gallery'); if (rail) for (let n = 0; n < 5; n++) E.pool(rail, [-2300 + n * 1150, 120, 70], [1250, 1750], '#ffdcaa', [.04, .03, .5, .3, .42], 'back');
        pictureLight(kit, E, 'back', -4900, 2030, 800, [.03, .02, .36, .3, .3], { finish: '#b39b6a', drop: 1100 });
        for (const x of [2800, 3700]) { E.pool(kit.back, [x, 1050, bz + 445], [1150, 2000], '#ffd9a6', [.04, .03, .42, .26, .38], 'back'); kit.box(kit.back, [700, 20, 40], [x, 1785, bz + 400], E.glow('#fff0d4', [.2, .15, 1, .7, .9]), 3); }
        for (const x of [-2950, 1550]) screenHalo(kit, E, 'back', x, 1350, 1500, [.02, .02, .16, .1, .28]);
        // The glazed archive cabinet is lit inside after dark.
        const cab = kit.byId('storage'); if (cab) { E.pool(cab, [0, 1050, -150], [1500, 2100], '#ffe6c2', [.04, .03, .36, .26, .3], 'back'); kit.box(cab, [1150, 8, 30], [0, kit.options.storage.height - 70, 150], E.glow('#fff0d8', [.2, .15, .9, .7, .8]), 2); }
    }
};
// Shared-event banner (party daypart only): a double-sided fabric banner on two
// cables over the teaching area, so the event reads in every camera (the
// middle-school banner hangs lower, under the acoustic baffles).
const EVENT_BANNER = {
    elementary: { text: 'WORKSHOP DAY', at: [-500, 3500], color: '#5d8b78', ink: '#fffaf0', dots: ['#e0b45e', '#88a9bf', '#d58f6c'] },
    middleschool: { text: 'STEM SHOWCASE', at: [0, 3100], y: 2240, color: '#498698', ink: '#ffffff', dots: ['#e07a3f', '#f0c24b', '#9fd3c7'] },
    highschool: { text: 'PROJECT FAIR', at: [0, 1500], color: '#2f3b44', ink: '#f4efe2', dots: ['#d9a441', '#9fb0b8', '#c97c5d'] },
    college: { text: 'DEMO DAY', at: [550, 2300], color: '#a5624a', ink: '#fff8ee', dots: ['#c9b08f', '#5f7d72', '#f2ead8'] },
    university: { text: 'RESEARCH SYMPOSIUM', at: [-600, -1000], color: '#285c4b', ink: '#efe6cc', dots: ['#b39b6a', '#e9e1cf', '#7a2f2f'] }
};
function eventBanner(kit, E) {
    const b = EVENT_BANNER[kit.spec.id]; if (!b) return;
    const W = 2800, H = 520, y = b.y || 2620, [x, z] = b.at, g = new THREE.Group(); g.name = 'Ceiling event banner'; E.ceiling.add(g);
    const m = E.tex((c, cw, ch) => {
        c.fillStyle = b.color; c.fillRect(0, 0, cw, ch); for (let i = 0; i < cw * ch / 30; i++) { c.fillStyle = i % 2 ? '#ffffff0c' : '#0000000e'; c.fillRect(rnd(i) * cw, rnd(i + 77) * ch, 1, 2); }
        c.fillStyle = b.ink; c.fillRect(0, ch * .1, cw, 4); c.fillRect(0, ch * .9 - 4, cw, 4);
        b.dots.forEach((col, n) => { dot(c, cw * .07 + n * 34, ch / 2, 13, col); dot(c, cw * .93 - n * 34, ch / 2, 13, col); });
        write(c, b.text, cw / 2, ch / 2 + 2, Math.round(ch * .36), b.ink, 'center', '700', cw * .74);
    }, 1024, 190, 'fabric', .92);
    for (const face of [1, -1]) { const p = kit.mesh(g, new THREE.PlaneGeometry(W, H), m, [x, y, z + face * 2]); p.rotation.y = face > 0 ? 0 : Math.PI; p.castShadow = false; }
    for (const dy of [H / 2 + 12, -H / 2 - 12]) kit.box(g, [W + 60, 24, 24], [x, y + dy, z], kit.metal, 4);
    for (const dx of [-W / 2 + 80, W / 2 - 80]) kit.rod(g, [x + dx, y + H / 2 + 24, z], [x + dx, kit.ceiling - 5, z], 2, kit.ink);
    E.show(g, [4]);
}
export function decorate(kit) {
    const E = eduKit(kit);
    DECOR[kit.spec.id]?.(kit, E); eventBanner(kit, E);
    FIXTURES[kit.spec.id]?.(kit, E); sunPatch(kit, E);
    WALLS[kit.spec.id]?.(kit, E, E.S); doorServices(kit, E);
    if (CABINET[kit.spec.id]) glazeCabinet(kit, E, kit.byId('storage'), CABINET[kit.spec.id]);
    applyUV(kit.root);
    // Hanging decor reads better without hard shadows across the walls.
    E.ceiling.traverse(o => { o.castShadow = false; });
    // Smooth lamp falloff across large plain walls bands in 8-bit output: dither every room surface.
    kit.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m?.isMeshStandardMaterial) m.dithering = true; });
}
export function finishDecor() {}
export function activityMaterials(k, phase, y, kit) {
    const id = kit.spec.id;
    if (id === 'kindergarten') {
        // Welcome / sign-in table: clipboard and name pegs by day, portfolios for families.
        if (phase === 0) { k.box([240, 10, 330], [80, y + 5, 60], '#8d6a4a'); k.box([220, 3, 300], [80, y + 11, 65], '#fbf6ea'); for (let n = 0; n < 8; n++) k.box([180, 2, 3], [80, y + 13, -60 + n * 30], '#9aa59f'); }
        if (phase === 2) for (let n = 0; n < 3; n++) { k.box([320, 16, 240], [40 + n * 40, y + 8 + n * 16, 40 - n * 20], ['#dba55d', '#7fb3a5', '#e48e6e'][n], [0, (n - 1) * .1, 0]); k.box([300, 4, 220], [40 + n * 40, y + 17 + n * 16, 40 - n * 20], '#fbf6ea', [0, (n - 1) * .1, 0]); }
        if (phase === 1 || phase === 4) for (let n = 0; n < (phase === 4 ? 4 : 2); n++) k.box([210, 2, 290], [-120 + n * 150, y + 1 + n, 120 - n * 30], '#fbf6ea', [0, (rnd(n) - .5) * .4, 0]);
        if (phase === 3) for (let n = 0; n < 4; n++) k.box([60, 50, 60], [100 + n % 2 * 70, y + 25 + Math.floor(n / 2) * 50, 120], PASTEL[n]);
    } else if (id === 'elementary') {
        if (phase === 2) for (let n = 0; n < 5; n++) k.box([210, 2, 290], [-150 + n * 140, y + 1, 60 + (n % 2) * 40], '#fbf6ea', [0, (rnd(n + 3) - .5) * .3, 0]);
        else if (phase === 1 || phase === 4) { k.box([300, 4, 220], [150, y + 2, 60], '#e48e6e'); k.box([240, 4, 200], [170, y + 6, 70], '#88a9bf'); k.box([30, 90, 30], [380, y + 45, -60], '#f4f1ea'); k.box([120, 12, 50], [-60, y + 6, 160], '#d9534f'); }
        else activityNotebook(k, phase, y);
    } else if (id === 'middleschool') {
        if (phase === 4) for (let n = 0; n < 4; n++) k.box([110, 120 + n * 40, 110], [-240 + n * 130, y + 60 + n * 20, 250], ['#f4f2ea', '#c9d4d6'][n % 2]);
        else if (phase !== 3) { k.box([200, 3, 280], [-200, y + 2, 230], '#f4f4ee'); k.box([20, 6, 260], [-60, y + 3, 220], '#c8cfd2'); }
    } else if (id === 'highschool') {
        if (phase === 4 || phase === 1) for (let n = 0; n < 3; n++) k.box([300, 2, 420], [-200 + n * 70, y + 1 + n * 2, 150 - n * 20], '#f4f4ee', [0, (n - 1) * .12, 0]);
        else activityNotebook(k, phase, y);
    } else if (id === 'university') {
        if (phase === 4 || phase === 0) for (let n = 0; n < 6; n++) k.cyl(30, 26, 80, [-180 + n * 70, y + 40, -60], '#f2efe8');
        if (phase === 2 || phase === 3) notebook(k, -150, y, 60, '#285c4b');
    } else activityNotebook(k, phase, y);
}
// Second real lamp: the reading floor lamp by the elementary meeting carpet,
// the lounge floor lamp for college and university. Each carries its pool.
export function extraLamps(kit) {
    const id = kit.spec.id; if (!['elementary', 'college', 'university'].includes(id)) return;
    if (id !== 'elementary' && !kit.byId('lounge-side-table')) return;
    const brass = id === 'university', reading = id === 'elementary';
    const lamp = reading ? kit.asset('reading-floor-lamp', 'Reading floor lamp', [-330, 0, -1050]) : kit.asset('lounge-floor-lamp', 'Lounge floor lamp', id === 'college' ? [3330, 0, 5500] : [2500, 0, 7700]);
    const k = detailKit(); k.cyl(150, 160, 30, [0, 15, 0], '#2f2f2f'); k.cyl(14, 14, reading ? 1300 : 1500, [0, reading ? 680 : 780, 0], brass ? '#b39b6a' : reading ? '#b48f62' : '#3a2e26'); k.build(lamp, kit.dress);
    const shade = kit.material(brass ? '#eadfc6' : '#efe3cc', { emissive: '#ffd9a8', emissiveIntensity: .3, roughness: .8, side: THREE.DoubleSide });
    kit.mesh(lamp, new THREE.CylinderGeometry(reading ? 150 : 170, reading ? 200 : 230, reading ? 260 : 300, 24, 1, true), shade, [0, reading ? 1420 : 1600, 0]);
    const light = new THREE.PointLight('#ffd9a8', 0, 2600 * kit.root.scale.x, 2); light.position.set(0, reading ? 1330 : 1500, 0); lamp.add(light);
    kit.lamps.push({ light, luminous: shade, color: '#ffd9a8' });
    // Warm pool on the floor / rug round the lamp, kept inside the walls.
    const E = kit.edu; E?.pool(lamp, [0, 13, 0], [2500, 2500], '#ffcf96', reading ? [0, 0, .36, .44, .22] : [0, 0, .4, .48, .28]);
}
// Per-phase changes: glow levels, phase-only objects and chairs up for cleaning.
export function atmosphere(phase, gain, kit) {
    const E = kit.edu; if (!E) return;
    const i = Math.max(0, PHASES.indexOf(phase));
    drawView(kit, E, phase);
    for (const { m, levels } of E.glows) m.emissiveIntensity = levels[i] * gain;
    const L = LIGHT[kit.spec.id], look = kit.spec.modes[phase] || {};
    if (L) {
        for (const { o, color, levels } of E.pools) { const v = levels[i] * gain; o.material.color.copy(color).multiplyScalar(v); o.visible = v > .004; }
        E.sun?.(phase, look.key || '#fff4e0', L.sun[i] * Math.min(gain, 1.4));
        // Shell linear fixtures: stage colour temperature; off after hours.
        kit.glow.color.set(L.ceiling[0]); kit.glow.emissive.set(L.ceiling[0]); kit.glow.emissiveIntensity = L.ceiling[1][i] * gain;
        if (kit.lights?.[0]) kit.lights[0].intensity *= L.desk[i];
        // Local lamps (activity-table lamp, reading/lounge lamp): stage strengths per daypart.
        kit.lamps.forEach(({ light, luminous }, n) => {
            const s = L.lamps[n]?.[i]; if (s === undefined) return;
            light.intensity = (kit.root.scale.x * 1000) ** 2 * s * gain; luminous.emissiveIntensity = .1 + s * gain * 1.3;
        });
    }
    for (const { obj, phases } of E.shows) obj.visible = phases.includes(i);
    for (const { chair, up, phases } of E.chairsUp) { const on = phases.includes(i); up.visible = on; chair.visible = !on; }
    kit.root.userData.eduPhase = { i, gain };
    for (const station of kit.root.children) if (station.userData.officeStation) applyStationPhase(station, i, gain);
}
function applyStationPhase(root, i, gain = 1) {
    root.traverse(o => {
        const glow = o.userData.eduGlow; if (glow) o.material.emissiveIntensity = glow[i] * gain;
        const pool = o.userData.eduPool; if (pool) { const v = pool[i] * gain; o.material.color.set(o.userData.eduPoolColor).multiplyScalar(v); o.visible = v > .004; }
        const show = o.userData.eduShow; if (show) o.visible = show.includes(i);
    });
}

// ---- Station role detail (moves and is disposed with the station) -------
// Stations with a compact LED task lamp: side of the desktop (−1 left, +1 right).
const STATION_LAMPS = { 'guided-reading': 1, 'window-research': -1, 'research-desk': -1, 'ta-help': -1, 'research-assistant': -1 };
export function stationDetail(spec, mount, T, { role, sceneId }) {
    const k = detailKit(), extras = [];
    const glowMat = (color, levels) => { const m = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: levels[0], roughness: .4 }); return { m, levels }; };
    const add = (geometry, material, at, levels, rot = [0, 0, 0]) => { const o = new T.Mesh(geometry, material); o.position.set(...at); o.rotation.set(...rot); if (levels) o.userData.eduGlow = levels; extras.push(o); return o; };
    const sheet = (draw, W, H, at, rot = [-Math.PI / 2, 0, 0], res = 512) => {
        const map = institutionalMap(draw, res, Math.round(res * H / W)); const m = new T.MeshStandardMaterial({ map, roughness: .85 });
        return add(new T.PlaneGeometry(W, H), m, at, null, rot);
    };
    // Additive pool (shared falloff map), levelled per daypart like the room pools.
    const pool = (w, h, color, levels, at, rot = [-Math.PI / 2, 0, 0]) => {
        const m = new T.MeshBasicMaterial({ map: poolTexture(), color: '#000000', transparent: true, depthWrite: false, blending: T.AdditiveBlending }); m.userData.sharedTextures = true;
        const o = add(new T.PlaneGeometry(w, h), m, at, null, rot); o.renderOrder = 2; o.raycast = noRay; o.castShadow = o.receiveShadow = false; o.userData.eduPool = levels; o.userData.eduPoolColor = color; return o;
    };
    const id = spec.id, desk = role === 'desktop', half = spec.size === '48x30' ? 610 : 762;
    // Compact LED task lamp at the back corner of a desktop, with its pool.
    const taskLamp = (x, levels) => {
        k.cyl(60, 66, 14, [x, 7, -300], '#3a3f42'); k.box([14, 360, 14], [x, 190, -300], '#5b6266', [0, 0, x < 0 ? -.18 : .18]); k.box([240, 22, 60], [x + (x < 0 ? 130 : -130), 368, -280], '#3a3f42');
        const g = glowMat('#fff2dc', levels.map(v => .1 + v * 2.4)); add(new T.BoxGeometry(220, 3, 46), g.m, [x + (x < 0 ? 130 : -130), 356, -280], g.levels);
        pool(760, 620, '#ffdcae', levels, [x + (x < 0 ? 260 : -260), 3, -90]);
    };
    if (STATION_LAMPS[id] && desk && !spec.plan) taskLamp(STATION_LAMPS[id] * (half - 110), [0, 0, .62, .8, .32]);
    if (id === 'discovery-light-table' && desk) {
        // (Its spill on the block rug is a room pool on 'block-rug': a pool below
        // the desk would drop the station's bounds under the floor and lose its collider.)
        const lb = glowMat('#fff6e0', [.55, .7, .9, .5, .8]);
        k.box([920, 36, 560], [100, 18, 20], '#f4f2ec'); add(new T.BoxGeometry(880, 4, 520), lb.m, [100, 38, 20], lb.levels);
        const tiles = ['#d9534f', '#f0c24b', '#4f8fc0', '#6aa56a'].map(c => { const m = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .35, transparent: true, opacity: .75, roughness: .3 }); return m; });
        for (let n = 0; n < 12; n++) add(new T.BoxGeometry(n % 3 ? 90 : 120, 5, 90), tiles[n % 4], [-200 + (n % 6) * 85, 43, -150 + Math.floor(n / 6) * 110 + (n % 2) * 18], [.3, .4, .6, .3, .5], [0, rnd(n) * .8, 0]);
        for (let n = 0; n < 2; n++) { k.add(new T.TorusGeometry(55, 8, 8, 24), [-260 + n * 600, 52, 200 - n * 60], '#2f3b44', [1, 1, 1], [Math.PI / 2, 0, 0]); k.box([22, 12, 150], [-260 + n * 600 + 20, 46, 290 - n * 60], '#d9534f', [0, .3, 0]); }
        for (let n = 0; n < 6; n++) k.ball(22, [380 + n % 3 * 40, 48, -160 + Math.floor(n / 3) * 40], ['#f1e2cc', '#d48a3c', '#a9b04a'][n % 3], [1.2, .5, 1]);
    }
    if (id === 'art-easel') {
        if (desk) { sheet(drawPainting, 720, 500, [0, 3, -60], [-Math.PI / 2, 0, 0]); k.box([760, 2, 540], [0, 1, -60], '#d9d2c2'); k.box([120, 30, 40], [0, 18, -330], '#c99a5b'); }
        else for (let n = 0; n < 4; n++) { k.cyl(35, 35, 80, [60 + n * 95, 40, 0], '#f4f2ec'); k.cyl(32, 32, 4, [60 + n * 95, 80, 0], ['#d9534f', '#f0c24b', '#4f8fc0', '#6aa56a'][n]); k.cyl(4, 4, 200, [60 + n * 95 + 10, 120, 10], '#c99a5b'); }
    }
    if ((id === 'class-tech-cart' || id === 'instructor-podium') && desk) {
        // Document camera: base, articulated arm and camera head over the worksheet.
        const x = id === 'class-tech-cart' ? -260 : 300;
        k.box([200, 20, 280], [x, 10, -60], '#2f3b44'); k.cyl(14, 14, 380, [x, 200, -170], '#4b5a63'); k.box([28, 28, 260], [x, 390, -60], '#4b5a63', [-.25, 0, 0]);
        k.box([110, 70, 90], [x, 360, 60], '#2f3b44'); k.cyl(22, 22, 20, [x, 320, 60], '#7ec4ba');
        if (id === 'instructor-podium') { k.box([210, 2, 290], [x, 22, 80], '#f4f4ee'); }
        const led = glowMat('#dff3ff', [.2, .2, .5, .5, .4]); add(new T.BoxGeometry(80, 3, 60), led.m, [x, 324, 60], led.levels);
    }
    if (id === 'science-window') {
        if (desk) pool(1400, 640, '#ead6ff', [.03, .03, .3, .46, .16], [0, 60, -60]);
        if (desk) for (let n = 0; n < 3; n++) { const x = -380 + n * 330; k.box([290, 50, 200], [x, 25, -110], '#2f3b44'); k.box([270, 10, 180], [x, 48, -110], '#5a4636'); for (let q = 0; q < 12; q++) { const sx = x - 110 + q % 4 * 70, sz = -170 + Math.floor(q / 4) * 60, hgt = 40 + n * 35 + rnd(q + n * 12) * 30; k.cyl(3, 3, hgt, [sx, 53 + hgt / 2, sz], '#7aa64f'); k.ball(14, [sx, 53 + hgt, sz], '#8fbf5a', [1.4, .4, 1]); } }
        else { k.box([1300, 18, 60], [0, 520, 0], '#e8ecee'); for (const x of [-600, 600]) k.cyl(6, 6, 520, [x, 260, 0], '#9fb0b8'); const g = glowMat('#f2e6ff', [.15, .15, .8, 1, .4]); add(new T.BoxGeometry(1240, 4, 40), g.m, [0, 509, 0], g.levels); }
    }
    if (id === 'guided-reading' && desk) for (let n = 0; n < 4; n++) { k.box([150, 8, 210], [-560 + n * 50, 4 + n * 8, 160], PASTEL[n], [0, (n - 2) * .08, 0]); }
    if (id === 'maker-bench' && desk) {
        const ring = glowMat('#e07a3f', [.6, .9, .6, .4, 1]); add(new T.TorusGeometry(45, 6, 8, 24), ring.m, [-420, 60, 110], ring.levels, [Math.PI / 2, 0, 0]);
        // Task strip over the bench (on two uprights at the back edge) and its pool.
        for (const x of [-660, 660]) k.box([22, 520, 22], [x, 260, -360], '#3a3f42'); k.box([1360, 26, 60], [0, 530, -330], '#3a3f42');
        const strip = glowMat('#fff4e4', [.3, .3, 1.3, 1.5, 1.2]); add(new T.BoxGeometry(1300, 4, 44), strip.m, [0, 516, -330], strip.levels);
        pool(1400, 700, '#fff2de', [.06, .06, .34, .46, .3], [0, 3, -40]);
        k.box([600, 3, 400], [200, 1.5, 60], '#3f6b5a'); for (let n = 0; n < 6; n++) k.box([70, 30, 50], [60 + n * 60, 15, 190], ['#e07a3f', '#498698', '#f0c24b'][n % 3]);
    }
    if (id === 'demonstration-desk' && desk) {
        // Newton's cradle and a trolley track.
        k.box([260, 12, 160], [220, 6, 140], '#2f3b44'); for (const x of [100, 340]) for (const z of [80, 200]) k.cyl(4, 4, 220, [x, 120, z], '#c8cfd2'); k.box([250, 6, 6], [220, 230, 80], '#c8cfd2'); k.box([250, 6, 6], [220, 230, 200], '#c8cfd2');
        for (let n = 0; n < 5; n++) { k.ball(22, [140 + n * 44, 70, 140], '#c8cfd2'); k.cyl(1, 1, 160, [140 + n * 44, 150, 140], '#9aa8b0'); }
        k.box([700, 20, 60], [-150, 10, 280], '#9fb0b8'); k.box([120, 60, 60], [-300, 50, 280], '#d9a441');
        const trace = glowMat('#7cf2a8', [.5, .5, .8, .9, .7]); add(new T.PlaneGeometry(190, 4), trace.m, [-450, 330, 30], trace.levels);
        pool(1400, 700, '#fff1da', [.04, .04, .22, .34, .26], [0, 3, 0]);
    }
    if ((id === 'project-review' || id === 'poster-review') && desk) {
        sheet(drawPosterSheet({ id: sceneId, accent: sceneId === 'university' ? '#285c4b' : '#567081' }), 1000, 640, [-40, 3, -40]); k.box([1040, 2, 680], [-40, 1, -40], '#e8e6df');
        for (let n = 0; n < 3; n++) k.box([60, 6, 20], [-480 + n * 440, 4, -350], '#c8cfd2');
    }
    if (id === 'lecturer-lectern' && desk) { sheet(drawLectureNotes, 300, 420, [-120, 3, 40]); sheet(drawLectureNotes, 300, 420, [-430, 3, 60], [-Math.PI / 2, 0, .08]); }
    if (id === 'team-pitch' && desk) for (let n = 0; n < 8; n++) k.box([75, 3, 75], [-40 + n % 4 * 85, 2 + n * .5, -200 + Math.floor(n / 4) * 90], ['#f6d76b', '#f4b6a0', '#cfe0c3', '#c6d7e6'][n % 4], [0, (rnd(n) - .5) * .4, 0]);
    if (id === 'ta-help' && desk) { k.box([210, 3, 290], [0, 2, 220], '#f4f4ee'); k.box([12, 10, 140], [110, 8, 220], '#d9534f', [0, .5, 0]); }
    if (/graduate-carrel/.test(id) && desk) {
        // Banker's lamp: brass base and stem, green shade, warm glow under it.
        k.cyl(70, 80, 24, [-450, 12, -230], '#b39b6a'); k.cyl(8, 8, 300, [-450, 170, -230], '#b39b6a'); k.box([20, 20, 120], [-450, 320, -180], '#b39b6a');
        const shade = new T.Mesh(new T.CylinderGeometry(70, 70, 300, 16, 1, false, 0, Math.PI), new T.MeshStandardMaterial({ color: '#1f5a3d', roughness: .3, metalness: .2, side: T.DoubleSide })); shade.position.set(-450, 330, -140); shade.rotation.z = Math.PI / 2; extras.push(shade);
        const g = glowMat('#ffe2b0', [.2, .2, .8, 1, .5]); add(new T.BoxGeometry(280, 3, 100), g.m, [-450, 318, -140], g.levels);
        pool(760, 660, '#ffd49a', [0, 0, .66, .82, .34], [-250, 3, -40]);
    }
    if (id === 'accessible-student' || id === 'accessible-seminar') { if (desk) k.box([180, 2, 120], [0, 1, 300], '#2a6aa8'); }
    const group = new T.Group(); group.name = `${spec.name} role detail`;
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
    if (!k.build(group, mat)) mat.dispose(); extras.forEach(o => group.add(o));
    if (!group.children.length) return; mount.add(group);
    // Match the current daypart (stations are added after the room build).
    let root = mount; while (root.parent && !root.userData.eduPhase) root = root.parent;
    const now = root.userData.eduPhase || { i: 0, gain: 1 };
    applyStationPhase(group, now.i, now.gain);
}

// Main (teacher/lecturer) desk extras: sticky notes and a lanyard badge.
export function mainDeskDetail({ sceneId, role, THREE: T, add }) {
    if (role !== 'desktop') return;
    const k = detailKit(), young = ['kindergarten', 'elementary'].includes(sceneId);
    for (let n = 0; n < 4; n++) k.box([70, 2, 70], [430 - n % 2 * 80, 1 + n * .4, 200 - Math.floor(n / 2) * 80], ['#f6d76b', '#f4b6a0', '#9fd3c7', '#cfe0c3'][n], [0, (rnd(n + 5) - .5) * .5, 0]);
    k.box([60, 3, 90], [-560, 2, -220], young ? '#e48e6e' : '#2f5446'); k.box([8, 2, 260], [-560, 1, -60], young ? '#7fb3a5' : '#3f4b52', [0, .3, 0]);
    const g = new T.Group(); g.name = 'Teacher desk notes'; k.build(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .75 })); add(g);
}

// ---- Daily staging (room-life.mjs) --------------------------------------
export function stageKit({ h, m, g, y, spec, social, quiet }) {
    if (isYoung(spec)) {
        for (let n = 0; n < (quiet ? 2 : 4); n++) h.box(g, [36, 25 + n * 8, 36], [110 + n % 2 * 55, y + 13 + n * 4, -45 + Math.floor(n / 2) * 65], n % 2 ? m.clay : m.brass, 4);
    } else if (!quiet) for (let n = 0; n < (social ? 4 : 2); n++) h.box(g, [45, 2, 60], [105 + n % 2 * 55, y + 1, -50 + Math.floor(n / 2) * 65], n % 2 ? m.clay : m.paper, 2);
}
