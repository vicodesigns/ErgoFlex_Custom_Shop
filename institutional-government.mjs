import * as THREE from 'three';
import { institutionalMap, rnd, boardFrame, boardColumns, screenHeader, screenFooter, detailKit, notebook, plant, workstationDetail } from './institutional-detail.mjs?v=institutional-sweep-20261009';

// Government group: `government` Government office, `police` Police / PD,
// `security` Security operations (kinds government / police / operations).
// This module owns the group's registry overrides, extra ErgoFlex stations,
// displays, furnishings, decor and daily staging. Shared shell and helpers:
// institutional-room.mjs (kit) and institutional-detail.mjs.
//
// Three distinct public-sector rooms, each in Small / Medium / Large:
//   security    a compact security operations centre: an operator console row
//               facing a framed video wall, a supervision row behind it, an
//               incident / dispatch position and a shift briefing bench.
//   police      a patrol squad room: report-writing bench, duty sergeant,
//               intake counter at the door, briefing lectern and seats (M/L),
//               equipment lockers and a property drop locker.
//   government  a one-stop public service centre: caseworker bench, ErgoFlex
//               public counters at standing and accessible heights facing the
//               door, consultation / language-access desks and wall seating.
// All content is illustrative and generic: no agencies, insignia, people,
// places or operational data.
export const GROUP = 'government';
export const SCENES = ['security', 'police', 'government'];
const KIND = { security: 'operations', police: 'police', government: 'government' };
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const phaseIndex = phase => Math.max(0, PHASES.indexOf(phase));

// ---- Registry data (merged by institutional-scenes.mjs) -----------------
// Per-kind light balance: practical/wash per phase [morning, afternoon,
// evening, night, party], task and bounce light colours.
export const lighting = {
    // (The full per-daypart modes, incl. these, are in LIGHT below.)
    government: { practical: [.28,.35,.78,.4,.76], wash: [.22,.2,.4,.18,.4], task: '#fff0dc', bounce: '#c9d3c0' },
    police: { practical: [.35,.4,.74,.55,.78], wash: [.22,.2,.3,.12,.36], task: '#f1eee6', bounce: '#a9bdc8' },
    operations: { practical: [.35,.3,.55,.5,.6], wash: [.3,.22,.25,.08,.35], task: '#f6ecdc', bounce: '#a9c6c8' }
};
// Desk roles: desktop frame x across the top (±600 on 48, ±750 on 60), +z
// toward the user; shelf props sit on the rear monitor shelf.
const P = (id, at, turn) => turn ? { id, at, turn } : { id, at };
// ---- Lighting by daypart (government.md A5 / B5 / C5) --------------------
// Per kind and daypart [morning 09:00, afternoon 14:00, evening 18:00, night
// 22:00, party 16:00]: the registry mode (sun key / fill colour and power,
// ambient, sky, exposure, practical / wash for the 3 room lights with their
// task and bounce colours, desk LEDs) plus this module's own levels:
//   view     window outlook emission (the pane is unlit, emissive only)
//   sun      additive window patch on the floor (blinds attenuate it)
//   ceiling  shell linear fixtures (per strip: rear, middle, front)
//   desk     scale on the room light over the main desk
//   lamps    the two real local lamps (activity table, workstation-0)
//   glow     scale on the group's emissive lines (dado line, halo, nosing)
//   screens  emissive of wall displays / desk monitors
// Desk LED colours are mid-value on purpose: the room spill scales with the
// LED colour, and these rooms are small with dark or pale-tinted walls.
const lmode = (key, fill, sky, power, ambient, exposure, practical, wash, bounce, colors, color) => ({ key, fill, sky, power, ambient, exposure, practical, wash, bounce, colors, leds: !!color, ...(color ? { color } : {}) });
const LIGHT = {
    operations: {
        // SOC: blackout blinds, cove strips at 40 %, Ø120 downlights over the
        // console seats, cyan bias halo. Night watch is the signature mood.
        modes: [lmode('#f6efe2', '#d6e6ee', ['#a9cfe3', '#f0e4cc'], 1.2, .38, 1.08, .35, .3, .62, ['#f6ecdc', '#a9c6c8']),
            lmode('#f3f6fb', '#dde9f0', ['#8fc0dc', '#e2eef1'], 1.25, .4, 1.06, .3, .22, .66, ['#eef2f2', '#a3c4c8']),
            lmode('#ffcf9e', '#c9d3e8', ['#6f7fa7', '#f0b285'], .55, .26, 1.12, .55, .25, .46, ['#ffe3c0', '#8fb3b6'], '#1a4f57'),
            lmode('#9fb6d6', '#8aa4c2', ['#0e1d30', '#28405a'], .14, .15, 1.22, .55, .09, .28, ['#ffe2bf', '#5f8f98'], '#1d5961'),
            // Team handover 16:00: warm late sun under raised blinds, briefing bench lit.
            lmode('#ffe1c0', '#d3dfe6', ['#9fc0d3', '#f2d6b2'], 1.05, .36, 1.08, .72, .4, .6, ['#f8e6cc', '#a6cacb'], '#3c6763')],
        view: [.8, .85, .72, 1, .9], sun: [.14, .09, .08, 0, .2], ceiling: ['#e9f3f4', [[.4, .35, .3, .02, .6]]], desk: [.8, .8, .75, .62, .85],
        lamps: [[.38, .14, .3, .08, .62], [.1, .08, .38, .42, .24]], glow: [.75, .7, .55, .95, .9], screens: [.2, .2, .2, .22, .21], station: [.34, .34, .32, .28, .34]
    },
    police: {
        // Squad room: 4000K suspended linears, desk task pools, a picture-light
        // bar on the beat board, the exit sign. Night: bench and sergeant only.
        modes: [lmode('#fff0dc', '#dceaf0', ['#bad8e5', '#f5e6ca'], 1.45, .42, 1.06, .35, .22, .7, ['#f1eee6', '#a9bdc8']),
            lmode('#f0f7ff', '#e1edf2', ['#94c5de', '#e4eff1'], 1.5, .45, 1.04, .4, .2, .76, ['#eef2f2', '#a3b9c4']),
            lmode('#ffd2a6', '#cdd6ea', ['#ba96a4', '#f0c89e'], .62, .27, 1.1, .74, .3, .5, ['#ffe6c8', '#a7b4c2'], '#2a4c53'),
            lmode('#b8cde8', '#a2bcd6', ['#132842', '#36506a'], .22, .2, 1.24, .7, .14, .3, ['#fbe2c2', '#7f97ab'], '#27474e'),
            // Team briefing 16:00: warm late-afternoon light, every practical on.
            lmode('#ffe3c6', '#d5e1ea', ['#a6c4d6', '#f0d6b4'], 1.2, .4, 1.07, .84, .4, .62, ['#fbe8d0', '#aac3c9'])],
        view: [.85, .9, .75, .7, .9], sun: [.1, .07, .11, 0, .15], ceiling: ['#f4f6f2', [[.55, .5, .72, .5, .85], [.55, .5, .72, .08, .85], [.55, .5, .72, .08, .85]]], desk: [1, 1, .65, .8, .9],
        lamps: [[.3, .2, .55, .1, .62], [.14, .16, .55, .58, .4]], glow: [1, 1, 1, 1, 1], screens: [.18, .18, .19, .2, .2], station: [.32, .32, .3, .3, .32]
    },
    government: {
        // Service centre: oak-trimmed suspended linears, opal globes over the
        // counters, a wall-washer on the service board, a gallery picture light.
        modes: [lmode('#ffeed8', '#dceaf0', ['#bad8e5', '#f5e6ca'], 1.5, .42, 1.06, .28, .22, .7, ['#fff0dc', '#c9d3c0']),
            lmode('#f2f6fb', '#e1edf2', ['#94c5de', '#e4eff1'], 1.55, .46, 1.04, .35, .2, .76, ['#fbf4e8', '#c3d0c2']),
            lmode('#ffd6ac', '#d7deee', ['#ba96a4', '#f0c89e'], .7, .28, 1.1, .78, .4, .5, ['#ffe2bd', '#d6c6ad'], '#5a4630'),
            lmode('#c3d7ee', '#a9c8e1', ['#172c47', '#3c5265'], .22, .19, 1.24, .58, .2, .3, ['#ffdcb0', '#8ea3b4']),
            // Team workshop 16:00: warm late sun through half-drawn sheers, globes and pendants on.
            lmode('#ffe4c6', '#d9e0ea', ['#a7c4d8', '#f2d6b4'], 1.2, .4, 1.07, .86, .45, .62, ['#ffe6c4', '#d6ccb4'])],
        view: [.85, .9, .78, .72, .9], sun: [.11, .08, .12, 0, .16], ceiling: ['#fff1dc', [[.42, .36, .62, .22, .72], [.42, .36, .62, .03, .72], [.42, .36, .62, .03, .72]]], desk: [1, 1, .58, .9, .9],
        lamps: [[.26, .16, .52, .05, .66], [.14, .14, .55, .58, .4]], glow: [1, 1, 1, 1, 1], screens: [.18, .18, .19, .2, .2], station: [.3, .3, .3, .26, .3]
    }
};
// Main desk pose per daypart [height in, tilt deg, yaw deg, offset [x, z] mm],
// merged with the light mode. The main desk sits in a benching row with
// 470-580 mm gaps: a turn is kept small (<= 18 deg, clear of the neighbours)
// and the desk steps 150 mm back toward the wall so it also clears its chair.
const pose = (list, kind) => Object.fromEntries(PHASES.map((p, i) => [p, { ...LIGHT[kind].modes[i], height: list[i][0], tilt: list[i][1], yaw: list[i][2] || 0, offset: list[i][3] || [0, 0] }]));
// Per-scene overrides. Any scene field (name, caption, wall, accent,
// dimensions, labels, boardTitle) may be replaced; `modes` merges partial
// per-phase values over the generated profile; `layout(tier, layout)` adjusts
// a generated layout in place; `desk` / `shelf` replace the main desk's
// generic dressing (placements may list `phases`).
export const sceneOverrides = {
    security: {
        boardTitle: 'OPERATIONS / OVERVIEW',
        caption: 'Lead the watch from a console row facing the video wall.',
        modes: pose([[43.5, 0, 16, [0, -150]], [28, 0], [28, 0], [28, -5], [43.5, 0]], 'operations'),
        desk: [P('office-keyboard', [-60, 0, 110]), P('magic-mouse', [300, 0, 100], 90), P('walkie-talkie', [-540, 0, -60], 20),
            P('headphones', [-330, 0, -190], 10), P('insulated-mug', [500, 0, -110])],
        shelf: [],
        layout(tier, l) {
            const i = l.index, front = l.back + l.depth;
            l.activity = [[-1700, -2300, -2900][i], front - [1100, 1250, 1400][i]];
            // Large: a leather armchair by the coffee point (rest corner off the floor).
            if (i === 2) l.props.push({ id: 'armchair-leather', at: [l.width / 2 - 1500, 0, front - 650], turn: 200 });
        }
    },
    police: {
        boardTitle: 'SQUAD ROOM / BEATS & ROSTER',
        caption: 'Brief, write up and respond from one squad room.',
        modes: pose([[43.5, 0], [28, 0], [35, 10], [28, 0], [43.5, 0]], 'police'),
        desk: [P('office-keyboard', [-60, 0, 110]), P('magic-mouse', [300, 0, 100], 90), P('clipboard', [-500, 1, -40], 8),
            P('papers', [430, 0, 150], -10), P('insulated-mug', [520, 0, -120])],
        shelf: [],
        layout(tier, l) {
            const i = l.index, front = l.back + l.depth;
            l.activity = [[-1700, -2500, -3400][i], front - 1300];
            // Detective case boxes beside the large room's case-file desk.
            if (i === 2) l.props.push({ id: 'case-boxes', at: [-300, 0, l.back + 5200 - 120], turn: 4 });
        }
    },
    government: {
        boardTitle: 'HOW WE CAN HELP',
        caption: 'A calm one-stop service centre with flexible counters.',
        modes: pose([[43.5, 0], [28, 0], [35, 15], [28, 0], [43.5, 0, 16, [0, -150]]], 'government'),
        desk: [P('office-keyboard', [-60, 0, 110]), P('magic-mouse', [300, 0, 100], 90), P('papers', [-470, 0, -60], 8),
            P('letter-tray', [330, 0, -160]), P('painted-mug', [560, 0, 230])],
        shelf: [],
        layout(tier, l) {
            const i = l.index, front = l.back + l.depth;
            l.activity = [[-1800, -2200, 0][i], front - [1150, 1250, 900][i]];
            // Visitor chairs face the consultation and language-access desks.
            if (i === 2) for (const [x, z] of [[-4430, front - 1500], [GOV_LANGUAGE_X - 940, front - 3300]]) l.props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, z], turn: 90 });
            // Greenery and soft seating (library props, floor colliders): a fig by
            // the main desk's slat wall (M/L), a monstera at the start of the
            // waiting bench, a lounge chair in the front waiting corner.
            const W = l.width / 2, bz = l.back, door = front - 1600;
            if (i) l.props.push({ id: 'ficus', at: [-W + 420, 0, bz + 430] });
            if (i) l.props.push({ id: 'monstera', at: [W - 430, 0, door - [0, 3600, 3750][i]] });
            if (i) l.props.push({ id: 'armchair-poppi', at: [W - 1250, 0, front - 430], turn: 180 });
            // A tall tree in front of the glazing beside the public service workstation.
            if (i) l.props.push({ id: 'potted-tree', at: [-W + 420, 0, [0, 1700, 967][i]] });
            else l.props.push({ id: 'monstera', at: [-W + 420, 0, bz + 420] });
        }
    }
};
// Surface finish profile used by room-polish.mjs.
export const finish = spec => ({ name: spec.name + ' · ' + ({ operations: 'graphite carpet tile, acoustic fabric & powder-coated steel', police: 'carpet tile, navy wipe-clean wainscot & steel lockers', government: 'oak, sage panelling, carpet tile & porcelain' }[spec.kind] || 'woven carpet & acoustic felt'),
    ground: { operations: '#3f4b52', police: '#5a656d', government: '#857e72' }[spec.kind] || '#626f76', wood: .55, metal: .34, stone: .5, night: .92, partyDay: true });

// ---- Extra ErgoFlex desks -----------------------------------------------
// Fields: id, name, at [x, z] (desk centre, mm), size, turn (0 = user faces
// the back wall; 90 faces the window; 270 faces the door wall), height (in),
// tilt (deg), chair (false = standing role), desktop/shelf placements, plan.
// `role` drives stationDetail(). Layouts were clearance-checked: >= 900 mm
// between independent items, door clear zone kept free, benching neighbours
// 280-530 mm apart on purpose.
// Government public counters: x of the counter row per tier. The counters
// face the door wall; everything on their +x side is the public zone
// (S 1.2 m, M 2.0 m, L 1.9 m wide, porcelain floor, waiting and entry).
const GOV_COUNTER_X = [1200, 1300, 2300], GOV_LANGUAGE_X = -1350;
export function stations(sceneId, layout) {
    const { back: bz, depth, width: w, index: i } = layout, front = bz + depth, row1 = bz + 1900, row2 = bz + 4700;
    const seat = (id, name, size, at, desktop, shelf, extra = {}) => ({ id, name, size, at, turn: 0, height: 28, tilt: 0, desktop, shelf, ...extra });
    const stand = (id, name, size, at, desktop, shelf, extra = {}) => seat(id, name, size, at, desktop, shelf, { height: 43.5, chair: false, ...extra });
    const list = [];
    if (sceneId === 'security') {
        list.push(seat('operator-2', 'Video operator', '48x30', [[150, -650, -1550][i], row1],
            [P('kenney-furniture-computer-keyboard', [-40, 0, 130]), P('kenney-furniture-computer-mouse', [290, 0, 120]), P('headset-stand', [-480, 0, -60]), P('clipboard', [430, 1, 20], 10)], [], { role: 'operator' }));
        list.push(stand('shift-supervisor', 'Shift supervisor', '60x30', [[700, 0, 0][i], i ? row2 : bz + 4600],
            [P('office-phone', [480, 0, -60]), P('walkie-talkie', [250, 0, 130], -20), P('papers', [-80, 0, 140], -6)],
            [], { role: 'supervisor' }));
        if (i) {
            list.push(seat('intel-analyst', 'Intelligence and alarm analyst', '60x30', [[0, -2600, -3000][i], row2],
                [P('office-keyboard', [-80, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('journal', [-560, 0, 60], -8), P('glasses', [470, 0, -150]), P('insulated-mug', [610, 0, 40])],
                [], { role: 'analyst' }));
            list.push(stand('incident-lead', 'Incident lead plan review', '48x30', [[0, 2350, 2700][i], row2],
                [P('papers', [-200, 1, 40]), P('metal-ruler', [360, 1, 0], 90), P('clipboard', [-470, 1, 110], 8)],
                [P('tablet-folder', [-300, 0, 0]), P('walkie-talkie', [320, 0, 0])], { tilt: 20, plan: true, role: 'incident' }));
        }
        if (i === 2) {
            list.push(seat('operator-3', 'Access control operator', '60x30', [2200, row1],
                [P('office-keyboard', [-70, 0, 120]), P('magic-mouse', [320, 0, 110], 90), P('papers-envelopes', [-560, 0, 80])], [], { role: 'operator' }));
            list.push(seat('radio-dispatch', 'Radio dispatch', '48x30', [2300, front - 3300],
                [P('site-radio', [-430, 0, -120]), P('walkie-talkie', [-210, 0, 120]), P('walkie-talkie', [-120, 0, 140], 12), P('headphones', [420, 0, -120]), P('kenney-furniture-computer-keyboard', [80, 0, 120])],
                [], { turn: 270, role: 'dispatch' }));
        }
    } else if (sceneId === 'police') {
        const zc = bz + 5200;
        list.push(stand('duty-sergeant', 'Duty sergeant', '60x30', i ? [[0, -2900, -3800][i], zc] : [2000, 300],
            [P('office-phone', [480, 0, -60]), P('letter-tray', [-480, 0, -40]), P('walkie-talkie', [250, 0, 120], 25), P('tablet-pc', [-130, 0, 100]), P('clipboard', [-440, 1, 150], -8)],
            [], { turn: i ? 0 : 90, role: 'sergeant' }));
        list.push(seat('intake-officer', 'Intake and front counter', '48x30', [[1500, 2100, 3000][i], front - 1600],
            [P('kenney-furniture-computer-keyboard', [-20, 0, 130]), P('papers-envelopes', [-400, 0, 60]), P('pen', [300, 0, 130], 30), P('letter-tray', [420, 0, -90])],
            [], { turn: 270, role: 'intake' }));
        if (i) {
            list.push(seat('report-writing-2', 'Officer report writing', '48x30', [[0, -900, -1800][i], row1],
                [P('kenney-furniture-laptop', [-80, 0, 20]), P('papers', [380, 0, 110], 8), P('water-bottle', [-520, 0, -120]), P('walkie-talkie', [520, 0, 90], -30)],
                [P('paper-holder', [-300, 0, 0])], { role: 'report' }));
            list.push(stand('briefing-lectern', 'Briefing lectern', '48x30', [[0, 3000, 3900][i], zc],
                [P('papers', [-120, 1, 60]), P('tablet-folder', [300, 1, 40]), P('pen', [80, 1, 150], 70)],
                [], { turn: 90, tilt: 15, plan: true, role: 'lectern' }));
        }
        if (i === 2) {
            list.push(seat('crime-analyst', 'Crime analysis', '60x30', [1800, row1],
                [P('office-keyboard', [-70, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('journal', [-560, 0, 60]), P('calculator', [560, 0, 90]), P('glasses', [470, 0, -150])],
                [], { role: 'analyst' }));
            list.push(seat('report-writing-3', 'Detective case file desk', '48x30', [-1500, zc],
                [P('papers-envelopes', [-300, 0, 80]), P('clipboard', [300, 1, 60], -6)],
                [P('kenney-furniture-books', [-280, 0, 0]), P('paper-holder', [280, 0, 0])], { height: 35, role: 'casefile' }));
        }
    } else if (sceneId === 'government') {
        list.push(stand('plan-review', 'Permit and plan review', '48x30', [[200, -700, -1600][i], row1],
            [P('papers', [-150, 1, 30]), P('metal-ruler', [380, 1, -20], 90), P('ruler-set-square', [-430, 1, 120]), P('pen', [160, 1, 150], 70)],
            [P('paper-stand', [-300, 0, 0]), P('kenney-furniture-books', [290, 0, 0])], { tilt: 20, plan: true, role: 'plan' }));
        if (!i) list.push(seat('service-counter', 'Public counter, accessible', '60x30', [GOV_COUNTER_X[0], front - 1840],
            [P('kenney-furniture-computer-keyboard', [-20, 0, 130]), P('tablet-pc', [-280, 0, -170], 180), P('pen', [330, 0, 140], 30), P('papers-envelopes', [-570, 0, 60])],
            [], { turn: 270, role: 'counter', counter: 1, accessible: true }));
        else {
            list.push(seat('records-lead', 'Records and team lead', '60x30', [[0, 1250, 350][i], row1],
                [P('office-keyboard', [-70, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('filing-tray-wood', [-540, 0, 20]), P('office-phone', [560, 0, -70]), P('glasses', [380, 0, -170])],
                [P('curved-monitor', [0, 0, 0])], { role: 'records' }));
            list.push(stand('counter-standing', 'Public counter, standing', '60x30', [GOV_COUNTER_X[i], front - [0, 3300, 3300][i]],
                [P('tablet-pc', [-250, 0, 60]), P('calculator', [300, 0, 110]), P('letter-tray', [-560, 0, -90]), P('clipboard', [520, 1, 90], -6)],
                [], { turn: 270, role: 'counter', counter: 1 }));
            list.push(seat('counter-accessible', 'Public counter, accessible', '48x30', [GOV_COUNTER_X[i], front - [0, 1780, 1780][i]],
                [P('kenney-furniture-computer-keyboard', [-20, 0, 130]), P('tablet-pc', [-250, 0, -170], 180), P('pen', [330, 0, 140], 30), P('papers-envelopes', [-480, 0, 60])],
                [], { turn: 270, role: 'counter', counter: 2, accessible: true }));
        }
        if (i === 2) {
            list.push(stand('team-huddle', 'Standing team huddle', '60x30', [300, row2],
                [P('kenney-furniture-laptop', [-220, 0, 0]), P('journal', [330, 0, 130], -10), P('coffee-cups', [540, 0, -90])], [], { role: 'huddle' }));
            list.push(seat('consultation', 'Appointment and consultation', '60x30', [-3500, front - 1500],
                [P('journal', [-200, 0, 60], 6), P('pen', [-40, 0, 140], 40), P('tea-cup', [480, 0, 80]), P('glasses', [420, 0, -130])],
                [P('kenney-furniture-laptop', [0, 0, 0])], { turn: 90, role: 'consult' }));
            list.push(seat('language-access', 'Language and accessibility support', '48x30', [GOV_LANGUAGE_X, front - 3300],
                [P('tablet-pc', [-150, 0, 0]), P('headphones', [350, 0, -80]), P('papers', [-430, 0, 120], 6)],
                [P('kenney-furniture-laptop', [0, 0, 0])], { turn: 90, role: 'language' }));
        }
    }
    void w;
    return list;
}

// ---- Illustrative screen and board content -------------------------------
// Pure canvas drawing, also used by stationDetail with a minimal spec.
const mono = (c, size, weight = '') => { c.font = `${weight} ${size}px monospace`.trim(); };
const sans = (c, size, weight = '') => { c.font = `${weight} ${size}px sans-serif`.trim(); };
function opsContent(c, W, H, content, variant, phase) {
    const night = phase === 'night', top = 50, bottom = H - 44;
    if (content === 'cameras') {
        // Architectural camera concepts with different views, no real footage.
        for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
            const x = 14 + col * W / 2, y = top + 6 + row * (bottom - top) / 2, pw = W / 2 - 24, ph = (bottom - top) / 2 - 10;
            c.fillStyle = night ? '#2c3f48' : '#536c76'; c.fillRect(x, y, pw, ph);
            c.fillStyle = night ? '#1b2a31' : '#304b57'; c.beginPath(); c.moveTo(x, y + ph); c.lineTo(x + pw * (.3 + rnd(variant + col) * .4), y + 18); c.lineTo(x + pw, y + ph); c.fill();
            c.strokeStyle = night ? '#6a8790' : '#94aeb5'; for (let n = 0; n < 4; n++) c.strokeRect(x + 8 + n * pw / 4, y + 16, pw / 7, ph * .5);
            c.strokeStyle = '#65cdbb'; c.lineWidth = 2; c.strokeRect(x + pw * (.25 + (variant + row) % 3 * .14), y + ph * .38, 34, 52); c.lineWidth = 1;
            c.fillStyle = '#e3ece7'; mono(c, 12); c.fillText(`CAM ${String(1 + col + row * 2 + variant * 4).padStart(2, '0')} / DEMO`, x + 6, y + ph - 6);
            if (night && row === 0 && col === 0) { c.fillStyle = '#e0483f'; c.beginPath(); c.arc(x + pw - 14, y + 12, 5, 0, 7); c.fill(); c.fillStyle = '#f1c9c4'; mono(c, 11); c.fillText('REC', x + pw - 46, y + 16); }
        }
    } else if (content === 'sitemap') {
        c.fillStyle = '#132b34'; c.fillRect(10, top + 4, W - 20, bottom - top - 8);
        c.strokeStyle = '#2d5360'; for (let x = 20; x < W; x += 30) { c.beginPath(); c.moveTo(x, top + 4); c.lineTo(x, bottom - 4); c.stroke(); }
        const blocks = [[.08, .18, .26, .3], [.4, .14, .22, .24], [.68, .2, .24, .34], [.12, .6, .3, .22], [.5, .52, .18, .3], [.74, .64, .18, .2]];
        blocks.forEach(([bx, by, bw, bh], n) => {
            const x = bx * W, y = top + by * (bottom - top), ww = bw * W, hh = bh * (bottom - top);
            c.fillStyle = n === variant % 6 ? '#2f6d6c' : '#24434d'; c.fillRect(x, y, ww, hh); c.strokeStyle = '#6fb7b3'; c.strokeRect(x, y, ww, hh);
            c.fillStyle = '#bfe1dc'; sans(c, 16, 600); c.fillText(`Z${n + 1}`, x + 8, y + 22);
        });
        c.strokeStyle = '#d9c06a'; c.lineWidth = 3; c.setLineDash([10, 6]); c.strokeRect(18, top + 12, W - 36, bottom - top - 24); c.setLineDash([]); c.lineWidth = 1;
        for (let n = 0; n < 7; n++) { c.fillStyle = n === 3 ? '#efb24a' : '#62d6c2'; c.beginPath(); c.arc(W * (.15 + rnd(n + variant) * .7), top + (bottom - top) * (.2 + rnd(n + 40) * .65), n === 3 ? 7 : 5, 0, 7); c.fill(); }
        c.fillStyle = '#9ec9c4'; mono(c, 12); c.fillText('SITE PLAN / ILLUSTRATIVE', 20, bottom - 10);
    } else if (content === 'alarms') {
        sans(c, 13, 600); c.fillStyle = '#7fa9b0'; ['TIME', 'ZONE', 'EVENT', 'STATUS'].forEach((t, n) => c.fillText(t, 22 + [0, .18, .36, .74][n] * W, top + 24));
        for (let row = 0; row < 6; row++) {
            const y = top + 36 + row * (bottom - top - 44) / 6, rh = (bottom - top - 44) / 6 - 6;
            c.fillStyle = row % 2 ? '#162f39' : '#1b3742'; c.fillRect(14, y, W - 28, rh);
            c.fillStyle = '#d6e6e4'; mono(c, 14); c.fillText(`${String(6 + row * 2 + variant).padStart(2, '0')}:${String(row * 7 % 60).padStart(2, '0')}`, 22, y + rh * .68);
            c.fillText(`Z${1 + (row + variant) % 6}`, 22 + .18 * W, y + rh * .68);
            c.fillText(['DOOR HELD', 'MOTION', 'GATE CALL', 'PATROL CHECK', 'FIRE PANEL TEST', 'VISITOR'][row], 22 + .36 * W, y + rh * .68);
            const st = (row + variant) % 3; c.fillStyle = ['#e4a646', '#4fb6a8', '#617681'][st]; c.fillRect(.74 * W + 10, y + 5, W * .18, rh - 10);
            c.fillStyle = '#10232d'; sans(c, 12, 600); c.fillText(['OPEN', 'ACK', 'CLEAR'][st], .74 * W + 18, y + rh * .66);
        }
    } else if (content === 'weather') {
        const cx = W * .45, cy = (top + bottom) / 2, r = (bottom - top) * .42;
        c.fillStyle = '#0f2730'; c.fillRect(10, top + 4, W - 20, bottom - top - 8);
        c.strokeStyle = '#2f6c6b'; for (let n = 1; n <= 3; n++) { c.beginPath(); c.arc(cx, cy, r * n / 3, 0, 7); c.stroke(); }
        for (let n = 0; n < 6; n++) { const a = rnd(n + 10) * 6.28, d = r * (.3 + rnd(n + 20) * .6); c.fillStyle = ['#3d8f63aa', '#c9b24daa', '#4fa57aaa'][n % 3]; c.beginPath(); c.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 30 + rnd(n) * 30, 18 + rnd(n + 3) * 16, a, 0, 7); c.fill(); }
        c.strokeStyle = '#7fe0cf'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(variant) * r, cy + Math.sin(variant) * r); c.stroke(); c.lineWidth = 1;
        c.fillStyle = '#bfe1dc'; sans(c, 18, 600); c.fillText('WEATHER', W * .76, top + 40); sans(c, 14); c.fillText('WIND 12', W * .76, top + 70); c.fillText('RAIN 20%', W * .76, top + 92); c.fillText('VIS GOOD', W * .76, top + 114);
    } else if (content === 'handover') {
        // Shift handover checklist: generic items, outgoing / incoming ticks.
        c.fillStyle = '#163640'; c.fillRect(10, top + 4, W - 20, bottom - top - 8);
        c.fillStyle = '#e4a646'; c.fillRect(10, top + 4, W - 20, 30); c.fillStyle = '#10232d'; sans(c, 17, 600); c.fillText('SHIFT HANDOVER 16:00', 22, top + 25);
        ['Open alarms reviewed', 'Patrol log signed', 'Keys and radios counted', 'Visitor list closed', 'Camera faults logged', 'Briefing notes shared'].forEach((t, n) => {
            const y = top + 50 + n * (bottom - top - 60) / 6; c.fillStyle = n % 2 ? '#1b3e49' : '#18394300'; c.fillRect(14, y - 4, W - 28, (bottom - top - 60) / 6 - 4);
            c.strokeStyle = '#7fe0d6'; c.lineWidth = 2; c.strokeRect(24, y + 2, 16, 16);
            if (n < 4) { c.strokeStyle = '#4fd07f'; c.lineWidth = 3; c.beginPath(); c.moveTo(27, y + 10); c.lineTo(31, y + 15); c.lineTo(38, y + 4); c.stroke(); }
            c.fillStyle = '#d6e6e4'; sans(c, 15); c.fillText(t, 52, y + 15);
            c.fillStyle = n < 4 ? '#4fb6a8' : '#e4a646'; c.fillRect(W - 110, y + 2, 84, 16); c.fillStyle = '#10232d'; sans(c, 11, 600); c.fillText(n < 4 ? 'DONE' : 'IN PROGRESS', W - 106, y + 14, 78);
        });
        c.lineWidth = 1;
    } else if (content === 'doors') {
        for (let n = 0; n < 16; n++) {
            const col = n % 4, row = Math.floor(n / 4), cw = (W - 40) / 4, ch = (bottom - top - 12) / 4, x = 20 + col * cw, y = top + 8 + row * ch;
            const amber = n === (5 + variant) % 16;
            c.fillStyle = amber ? '#e4a646' : n % 7 === 3 ? '#35505a' : '#2f8f7f'; c.fillRect(x + 4, y + 4, cw - 8, ch - 8);
            c.fillStyle = amber ? '#2a1d07' : '#d8efe9'; mono(c, 14); c.fillText(`D${String(n + 1).padStart(2, '0')}`, x + 12, y + ch * .6);
        }
    } else {
        // Shift clock: three generic sites, illustrative times.
        const hour = [7, 14, 18, 22, 16][phaseIndex(phase)];
        ['SITE A', 'SITE B', 'SITE C'].forEach((label, n) => {
            const x = 20 + n * (W - 40) / 3, cw = (W - 40) / 3 - 12;
            c.fillStyle = '#16323c'; c.fillRect(x, top + 10, cw, bottom - top - 20);
            c.fillStyle = '#86b9b8'; sans(c, 15, 600); c.fillText(label, x + 12, top + 36);
            c.fillStyle = '#e1f1ee'; mono(c, 40); c.fillText(`${String((hour + n * 3) % 24).padStart(2, '0')}:00`, x + 10, top + 100);
            c.fillStyle = n ? '#4fb6a8' : '#e4a646'; c.fillRect(x + 12, bottom - 46, cw - 24, 8);
        });
    }
}
function policeContent(c, W, H, content, variant, phase) {
    const top = 50, bottom = H - 44;
    if (content === 'case') {
        c.fillStyle = '#e8ecef'; c.fillRect(14, top + 6, W * .58, bottom - top - 12);
        c.fillStyle = '#234e72'; sans(c, 15, 600); c.fillText(`CASE FILE / DEMO ${String(410 + variant * 7).padStart(4, '0')}`, 26, top + 30);
        for (let n = 0; n < 7; n++) { c.fillStyle = '#9aa8b2'; c.fillRect(26, top + 46 + n * 26, 90, 8); c.fillStyle = '#c7d0d6'; c.fillRect(130, top + 44 + n * 26, W * .58 - 140, 14); }
        c.fillStyle = '#d9b44a'; c.fillRect(26, bottom - 34, 120, 18);
        c.fillStyle = '#1c3a52'; c.fillRect(W * .62, top + 6, W * .35, bottom - top - 12);
        for (let n = 0; n < 6; n++) { c.fillStyle = n === variant % 6 ? '#d9b44a' : '#3f6584'; c.fillRect(W * .64, top + 18 + n * 30, W * .31, 22); }
    } else if (content === 'roster') {
        ['DAY', 'EVENING', 'NIGHT'].forEach((label, n) => {
            const x = 16 + n * (W - 32) / 3, cw = (W - 32) / 3 - 10;
            c.fillStyle = n === Math.min(2, Math.floor(phaseIndex(phase) / 1.5)) ? '#234e72' : '#1a3346'; c.fillRect(x, top + 8, cw, bottom - top - 16);
            c.fillStyle = '#e4ecf1'; sans(c, 15, 600); c.fillText(label, x + 10, top + 30);
            for (let r = 0; r < 6; r++) { c.fillStyle = '#8fa4b3'; c.fillRect(x + 10, top + 44 + r * 24, cw * (.5 + rnd(r + n * 6) * .4), 12); }
        });
    } else if (content === 'briefing') {
        c.fillStyle = '#e8edf1'; sans(c, 26, 600); c.fillText(['BRIEFING 09:00', 'CASE REVIEW 14:00', 'SHIFT CHANGE 18:00', 'NIGHT SHIFT 22:00', 'TEAM BRIEFING 16:00'][phaseIndex(phase)], 24, top + 40);
        ['Community events this week', 'Road works on Beat 2', 'Lost property returns', 'Safety reminders'].forEach((t, n) => { c.fillStyle = '#d9b44a'; c.fillRect(28, top + 64 + n * 34, 12, 12); c.fillStyle = '#c9d5de'; sans(c, 17); c.fillText(t, 50, top + 76 + n * 34); });
        beatMap(c, W * .6, top + 56, W * .37, bottom - top - 66, variant);
    } else beatMap(c, 16, top + 8, W - 32, bottom - top - 16, variant);
}
// Generic street grid with four coloured beats and numbered pins.
function beatMap(c, x, y, w, h, variant = 0) {
    c.fillStyle = '#eef0ea'; c.fillRect(x, y, w, h);
    const beats = ['#5f8fb3', '#8fb39a', '#c9a35f', '#b37a6a'];
    for (let n = 0; n < 4; n++) { c.fillStyle = beats[n] + '66'; c.fillRect(x + (n % 2) * w / 2 + 4, y + Math.floor(n / 2) * h / 2 + 4, w / 2 - 8, h / 2 - 8); }
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(3, w / 120);
    for (let n = 1; n < 7; n++) { c.beginPath(); c.moveTo(x + n * w / 7 + (n % 2) * 6, y); c.lineTo(x + n * w / 7 - (n % 3) * 5, y + h); c.stroke(); }
    for (let n = 1; n < 5; n++) { c.beginPath(); c.moveTo(x, y + n * h / 5); c.lineTo(x + w, y + n * h / 5 + (n % 2 ? 8 : -6)); c.stroke(); }
    c.strokeStyle = '#7c8c94'; c.lineWidth = Math.max(5, w / 70); c.beginPath(); c.moveTo(x, y + h * .78); c.bezierCurveTo(x + w * .3, y + h * .6, x + w * .6, y + h * .9, x + w, y + h * .55); c.stroke(); c.lineWidth = 1;
    for (let n = 0; n < 4; n++) { c.fillStyle = '#29313a'; c.font = `600 ${Math.max(12, w / 30)}px sans-serif`; c.fillText(`BEAT ${n + 1}`, x + (n % 2) * w / 2 + 10, y + Math.floor(n / 2) * h / 2 + Math.max(18, w / 26)); }
    for (let n = 0; n < 7; n++) {
        const px = x + w * (.1 + rnd(n + variant * 3) * .8), py = y + h * (.15 + rnd(n + 30) * .75);
        c.fillStyle = n % 3 ? '#234e72' : '#d9b44a'; c.beginPath(); c.arc(px, py, Math.max(6, w / 70), 0, 7); c.fill();
        c.fillStyle = '#ffffff'; c.font = `600 ${Math.max(9, w / 90)}px sans-serif`; c.fillText(n + 1, px - 3, py + 4);
    }
}
function governmentContent(c, W, H, content, variant, phase) {
    const top = 50, bottom = H - 44, i = phaseIndex(phase), closed = i === 3;
    if (content === 'queue') {
        c.fillStyle = '#f2efe6'; c.fillRect(14, top + 6, W - 28, bottom - top - 12);
        if (closed) { c.fillStyle = '#395d60'; sans(c, 34, 600); c.fillText('COUNTERS CLOSED', 34, top + 80); sans(c, 20); c.fillText('Open weekdays 08:30 – 16:30', 34, top + 120); return; }
        if (i === 4) {
            // Team workshop: the counters close early for the monthly service review.
            c.fillStyle = '#b39b6a'; c.fillRect(14, top + 6, W - 28, 34); c.fillStyle = '#24302e'; sans(c, 18, 600); c.fillText('TEAM WORKSHOP 16:00', 30, top + 29);
            c.fillStyle = '#395d60'; sans(c, 30, 600); c.fillText('Counters reopen', 30, top + 84); c.fillText('tomorrow 08:30', 30, top + 120);
            ['#f2d36b', '#9fd0b4', '#f0a98f', '#a9c7e6'].forEach((col, n) => { c.fillStyle = col; c.fillRect(W * .62 + (n % 2) * 70, top + 56 + Math.floor(n / 2) * 66, 58, 58); });
            sans(c, 15); c.fillStyle = '#6d7a73'; c.fillText('Self-service and online forms stay open', 30, bottom - 14);
            return;
        }
        c.fillStyle = '#6d7a73'; sans(c, 16, 600); c.fillText(i === 0 ? 'OPENING 08:30' : 'NOW SERVING', 32, top + 34);
        c.fillStyle = '#395d60'; sans(c, 64, 600); c.fillText(`A ${String(12 + variant * 3 + i * 5).padStart(3, '0')}`, 30, top + 106);
        c.fillStyle = '#b39b6a'; sans(c, 22, 600); c.fillText(`COUNTER ${1 + variant % 2}`, 34, top + 140);
        for (let n = 0; n < 4; n++) { c.fillStyle = n % 2 ? '#dfe7e1' : '#e9e3d4'; c.fillRect(W * .55, top + 20 + n * 38, W * .38, 30); c.fillStyle = '#395d60'; sans(c, 16, 600); c.fillText(`${['A', 'B', 'A', 'C'][n]} ${String(13 + n + i * 5).padStart(3, '0')}`, W * .57, top + 41 + n * 38); }
    } else if (content === 'form') {
        c.fillStyle = '#f4f2ea'; c.fillRect(14, top + 6, W * .62, bottom - top - 12);
        c.fillStyle = '#395d60'; sans(c, 15, 600); c.fillText(['PERMIT APPLICATION', 'RECORD REQUEST', 'PAYMENT PLAN', 'APPOINTMENT'][variant % 4] + ' / DEMO', 26, top + 30);
        for (let n = 0; n < 6; n++) { c.fillStyle = '#9fa89f'; c.fillRect(26, top + 48 + n * 26, 80, 7); c.strokeStyle = '#b8bfb6'; c.strokeRect(118, top + 42 + n * 26, W * .62 - 130, 16); }
        for (let n = 0; n < 3; n++) { c.strokeStyle = '#395d60'; c.strokeRect(26 + n * 90, bottom - 34, 14, 14); if (n !== 1) { c.fillStyle = '#395d60'; c.fillRect(29 + n * 90, bottom - 31, 8, 8); } }
        c.fillStyle = '#1e3d42'; c.fillRect(W * .66, top + 6, W * .31, bottom - top - 12);
        for (let n = 0; n < 5; n++) { c.fillStyle = n === variant % 5 ? '#b39b6a' : '#4c7271'; c.fillRect(W * .68, top + 20 + n * 32, W * .27, 22); }
    } else if (content === 'records') {
        sans(c, 13, 600); c.fillStyle = '#8fb0a8'; ['REF', 'TYPE', 'STAGE', 'DUE'].forEach((t, n) => c.fillText(t, 22 + [0, .2, .5, .78][n] * W, top + 24));
        for (let r = 0; r < 6; r++) {
            const y = top + 34 + r * 30; c.fillStyle = r % 2 ? '#183a40' : '#1e454b'; c.fillRect(14, y, W - 28, 24);
            c.fillStyle = '#dfeae5'; mono(c, 13); c.fillText(`R-${String(200 + r * 13 + variant).padStart(4, '0')}`, 22, y + 17);
            c.fillText(['Permit', 'Record', 'Payment', 'Licence', 'Housing', 'Records'][r], 22 + .2 * W, y + 17);
            c.fillStyle = ['#b39b6a', '#7fb3a2', '#9fb0b8'][(r + variant) % 3]; c.fillRect(.5 * W + 18, y + 6, W * .2 * (.3 + rnd(r) * .7), 12);
            c.fillStyle = '#dfeae5'; c.fillText(`D+${r + 1}`, 22 + .78 * W, y + 17);
        }
    } else {
        c.fillStyle = '#dae8e3'; sans(c, 24, 600); c.fillText(closed ? 'SERVICE CENTRE · CLOSED' : 'SERVICE CENTRE', 28, top + 42, W - 60);
        ['PERMITS', 'RECORDS', 'PAYMENTS'].forEach((t, n) => { c.fillStyle = ['#527c85', '#8e9d86', '#ac956d'][n]; c.fillRect(30 + n * (W - 45) / 3, top + 70, (W - 85) / 3, bottom - top - 90); c.fillStyle = '#eef2ea'; sans(c, 18, 600); c.fillText(t, 42 + n * (W - 45) / 3, top + 100); });
    }
}
const OPS_ORDER = ['cameras', 'sitemap', 'alarms', 'weather', 'doors', 'clock'];
const OPS_LEAD = { morning: 'sitemap', afternoon: 'cameras', evening: 'alarms', night: 'cameras', party: 'handover' };
// Variants 0-5: video wall tiles (tile 1 is the lead feed for the daypart);
// 10+: console monitors; 20+: briefing / counter / lectern displays.
function screenFor(kind, variant, phase) {
    if (kind === 'operations') {
        if (variant >= 10) return { title: ['VIDEO / OPERATOR', 'ALARM QUEUE', 'ACCESS EVENTS', 'SITE PLAN'][variant % 4], content: ['cameras', 'alarms', 'doors', 'sitemap'][variant % 4] };
        const lead = OPS_LEAD[phase] || 'cameras';
        const rest = OPS_ORDER.filter(c => c !== lead);
        const content = variant === 1 ? lead : rest[[0, 0, 1, 2, 3, 4][variant] ?? 0];
        return { title: ({ cameras: 'CAMERA GRID', sitemap: 'SITE PLAN', alarms: 'ALARM QUEUE', weather: 'WEATHER', doors: 'DOOR STATUS', clock: 'SHIFT CLOCK', handover: 'SHIFT HANDOVER' })[content], content };
    }
    if (kind === 'police') {
        if (variant >= 20) return { title: 'BRIEFING', content: 'briefing' };
        return { title: ['CASE REVIEW', 'SHIFT ROSTER', 'BEAT MAP', 'CASE REVIEW'][variant % 4], content: ['case', 'roster', 'map', 'case'][variant % 4] };
    }
    if (variant >= 20) return { title: 'QUEUE', content: 'queue' };
    return { title: ['CASEWORK', 'RECORDS', 'SERVICE DESK', 'CASEWORK'][variant % 4], content: ['form', 'records', 'slides', 'form'][variant % 4] };
}
function paintScreen(c, W, H, spec, variant, phase) {
    const { title, content } = screenFor(spec.kind, variant, phase);
    screenHeader(c, W, H, title);
    if (spec.kind === 'operations') opsContent(c, W, H, content, variant, phase);
    else if (spec.kind === 'police') policeContent(c, W, H, content, variant, phase);
    else governmentContent(c, W, H, content, variant, phase);
    screenFooter(c, W, H, spec, phase);
}

// ---- Finishes: palettes, procedural maps and material classes -----------
// Every large surface carries a canvas map at a physical scale. `uvBox`
// writes box-projected UVs in millimetres, so one material covers a 1.9 m
// locker bank and a 60 mm label holder without stretching. Detail that used
// to share the flat vertex-colour "dress" material is now batched by
// material class (`ck()`): powder-coated steel, brushed metal, oak (two grain
// directions), HPL, woven fabric, rubber, glass, printed labels and paper.
// Each class merges into one mesh per furnishing; the class maps are near
// white, so vertex colours still set the hue. Palettes follow the brief
// (government.md A4 / B4 / C4).
const TAU = Math.PI * 2;
const shade = (hex, l = 0, s = 0) => '#' + new THREE.Color(hex).offsetHSL(0, s, l).getHexString();
const grey = v => { const g = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${g},${g},${g})`; };
const PAL = {
    operations: { wall: '#273c4b', dado: '#1c2e3a', stripe: '#48aeb0', felt: ['#2f4a58', '#365563'], carpet: ['#3f4c54', '#45525a', '#5e7480'], dais: ['#2a363d', '#303d45', '#4b6370'], top: '#2a3238', edge: '#11181d', steel: '#56636b', door: '#5f6c74', seat: '#33444d', task: '#2b3940', blind: '#2b3439' },
    police: { wall: '#e0e5e9', dado: '#234e72', rail: '#9aa4ab', felt: ['#2f4f6b', '#3b5d7a'], carpet: ['#525d66', '#58636c', '#7a8892'], top: '#c7c3b8', edge: '#3b4650', steel: '#3d4b57', door: '#475766', seat: '#2f4f6b', task: '#2e3d49', blind: '#c9ced1' },
    government: { wall: '#e8e4da', dado: '#7f9a8b', rail: '#a8895f', felt: ['#7f9a8b', '#5d7b70'], carpet: ['#857e72', '#8b8478', '#a69e8f'], porcelain: ['#cfc8ba', '#b9b2a3'], top: '#ffffff', edge: '#8f7350', steel: '#6f7a72', door: '#7b8780', seat: '#395d60', task: '#394947', blind: '#ece7da' }
};
const pal = kind => PAL[kind] || PAL.government;
function tex(draw, W, H, srgb = true) {
    const map = institutionalMap(draw, W, H); if (!srgb) map.colorSpace = THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; return map;
}
// Box-projected UVs (mm / period): top faces u = x, v = -z; x-facing faces
// u = z, v = y; z-facing faces u = x, v = y.
function uvBox(geometry, pu, pv = pu) {
    const pos = geometry.attributes.position, nor = geometry.attributes.normal; if (!pos || !nor) return geometry;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
        const [u, v] = ay >= ax && ay >= az ? [x, -z] : ax >= az ? [z, y] : [x, y];
        uv[i * 2] = u / pu; uv[i * 2 + 1] = v / pv;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.userData.govUV = true; return geometry;
}
// Box-project every mesh whose material carries a physical period (walls,
// table tops, seats, oak trims). Geometry is never shared in this shell.
function applyUV(root) {
    root.traverse(o => {
        const p = o.isMesh && o.material?.userData?.govUV; if (!p || o.geometry.userData.govUV) return;
        uvBox(o.geometry, p[0], p[1]);
    });
}
function speckle(c, W, H, { base, flecks, count, size = [1, 2], seed = 1, alpha = 1 }) {
    if (base) { c.fillStyle = base; c.fillRect(0, 0, W, H); }
    c.globalAlpha = alpha;
    for (let i = 0; i < count; i++) { const s = size[0] + rnd(i * 3.1 + seed) * (size[1] - size[0]); c.fillStyle = flecks[i % flecks.length]; c.fillRect(rnd(i * 1.7 + seed) * W, rnd(i * 2.3 + seed * 7) * H, s, s); }
    c.globalAlpha = 1;
}
// Near-white detail maps (tinted by vertex colour or material colour).
const drawPowder = (c, W, H) => {
    speckle(c, W, H, { base: '#efefef', flecks: ['#ffffff', '#dadada', '#e6e6e6'], count: W * H / 3, size: [1, 2.2], alpha: .5 });
    for (let i = 0; i < 90; i++) { const x = rnd(i * 4.1) * W, y = rnd(i * 5.3) * H, r = 6 + rnd(i) * 14, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 2 ? '#ffffff22' : '#0000000c'); g.addColorStop(1, i % 2 ? '#ffffff00' : '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
};
const drawPowderRough = (c, W, H) => speckle(c, W, H, { base: grey(214), flecks: [grey(240), grey(188), grey(226)], count: W * H / 2, size: [1, 2] });
const drawBrushed = (c, W, H) => {
    c.fillStyle = '#e6e6e6'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < H * 7; i++) { const y = rnd(i * 1.9) * H, x = rnd(i * 2.3) * W, len = 30 + rnd(i) * W * .7; c.fillStyle = i % 2 ? '#ffffff60' : '#bdbdbd50'; c.fillRect(x, y, len, 1); c.fillRect(x - W, y, len, 1); }
};
const drawHPL = (c, W, H) => speckle(c, W, H, { base: '#ececec', flecks: ['#ffffff', '#d2d2d2', '#c2c2c2', '#f7f7f7'], count: W * H / 6, size: [1, 2] });
const drawHPLRough = (c, W, H) => speckle(c, W, H, { base: grey(200), flecks: [grey(225), grey(180)], count: W * H / 3, size: [1, 2] });
const drawWeave = (c, W, H) => {
    c.fillStyle = '#d6d6d6'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const o = ((x + y) / 4) % 2; c.fillStyle = o ? '#f0f0f0' : '#c2c2c2'; c.fillRect(x, y, o ? 4 : 3, o ? 3 : 4); }
    for (let i = 0; i < W * H / 9; i++) { c.fillStyle = i % 2 ? '#ffffff30' : '#00000020'; c.fillRect(rnd(i * 1.3) * W, rnd(i * 2.9) * H, 1, 2 + rnd(i) * 2); }
};
const drawRubber = (c, W, H) => speckle(c, W, H, { base: '#d4d4d4', flecks: ['#e8e8e8', '#bcbcbc'], count: W * H / 4, size: [1, 2] });
// Limewash / eggshell wall paint: soft clouds and faint roller lap marks.
const drawLimewash = (c, W, H) => {
    c.fillStyle = '#f3f3f3'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
        const x = rnd(i * 2.1) * W, y = rnd(i * 3.7) * H, r = 40 + rnd(i * 1.3) * 80;
        for (const [dx, dy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) { const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); g.addColorStop(0, i % 2 ? '#ffffff0c' : '#00000005'); g.addColorStop(1, i % 2 ? '#ffffff00' : '#00000000'); c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }
    }
        speckle(c, W, H, { flecks: ['#ffffff', '#dcdcdc'], count: W * H / 14, size: [1, 1.6], alpha: .18 });
};
// Oak with straight grain, cathedral figure, veneer leaves and pores. Grain
// runs along u (horizontal) or, `vertical`, along v.
function drawOak(c, W, H, { base = '#b99a72', dark = '#6e5236', light = '#e2c597', seed = 3, vertical = false } = {}) {
    if (vertical) { c.save(); c.translate(W, 0); c.rotate(Math.PI / 2); [W, H] = [H, W]; }
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    const leaves = 4; for (let l = 0; l < leaves; l++) { c.fillStyle = l % 2 ? light + '1c' : dark + '14'; c.fillRect(0, l * H / leaves, W, H / leaves); }
    for (let n = 0; n < H * 1.1; n++) {
        const y = rnd(n * 1.31 + seed) * H, amp = 1.5 + rnd(n * 2.7 + seed) * 5, ph = rnd(n * 3.3 + seed) * TAU;
        c.strokeStyle = (n % 3 ? dark : light) + (n % 5 ? '22' : '3c'); c.lineWidth = .6 + rnd(n * 5.1) * 1.3;
        for (const dy of [-H, 0, H]) { c.beginPath(); for (let x = 0; x <= W; x += W / 32) c.lineTo(x, y + dy + Math.sin(x / W * TAU * 2 + ph) * amp); c.stroke(); }
    }
    for (let k = 0; k < leaves; k++) {
        const cx = rnd(k * 9.7 + seed) * W, cy = (k + .7) * H / leaves;
        for (let r = 0; r < 8; r++) { c.strokeStyle = dark + '24'; c.lineWidth = 1.1; for (const dx of [-W, 0, W]) { c.beginPath(); c.ellipse(cx + dx, cy, W * .1 + r * 13, 10 + r * 4.5, 0, Math.PI * 1.04, TAU * .98); c.stroke(); } }
    }
    for (let i = 0; i < W * H / 50; i++) { c.fillStyle = dark + '2c'; c.fillRect(rnd(i * 1.7 + seed) * W, rnd(i * 2.9 + seed) * H, 2 + rnd(i) * 5, 1); }
    if (vertical) c.restore();
}
// Carpet tiles, 2 x 2 per texture, quarter-turn: pile rows alternate
// direction, loop flecks, seams and an optional faint cross-hatch.
function drawCarpet(c, W, H, [a, b, hatch], { seed = 1, hatchAlpha = '1c' } = {}) {
    const t = W / 2;
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) {
        const x0 = q * t, y0 = r * t, turn = (r + q) % 2;
        c.save(); c.beginPath(); c.rect(x0, y0, t, t); c.clip();
        c.fillStyle = turn ? a : b; c.fillRect(x0, y0, t, t);
        for (let n = 0; n < t; n += 3) { c.fillStyle = (n / 3) % 2 ? '#ffffff0e' : '#00000012'; if (turn) c.fillRect(x0, y0 + n, t, 1.5); else c.fillRect(x0 + n, y0, 1.5, t); }
        for (let i = 0; i < t * t / 7; i++) { const k = i + (r * 2 + q) * 7919 + seed * 77; c.fillStyle = i % 3 ? '#ffffff14' : '#0000001c'; c.fillRect(x0 + rnd(k * 1.3) * t, y0 + rnd(k * 2.1) * t, 1 + rnd(k) * 1.6, 1 + rnd(k * 1.9) * 1.6); }
        if (hatch) { c.strokeStyle = hatch + hatchAlpha; c.lineWidth = 1; for (let n = -t; n < t * 2; n += 22) { c.beginPath(); c.moveTo(x0 + n, y0); c.lineTo(x0 + n + t, y0 + t); c.stroke(); c.beginPath(); c.moveTo(x0 + n + t, y0); c.lineTo(x0 + n, y0 + t); c.stroke(); } }
        c.restore();
        c.fillStyle = '#00000038'; c.fillRect(x0, y0, t, 1.5); c.fillRect(x0, y0, 1.5, t);
    }
}
// Large-format porcelain, 2 x 2 tiles with cloudy tone, specks and grout.
function drawPorcelain(c, W, H, [base, joint], rough = false) {
    const t = W / 2;
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) {
        const x0 = q * t, y0 = r * t, n = r * 2 + q;
        c.fillStyle = rough ? grey(104) : shade(base, (rnd(n * 3.3) - .5) * .035); c.fillRect(x0, y0, t, t);
        if (!rough) {
            c.save(); c.beginPath(); c.rect(x0, y0, t, t); c.clip();
            for (let i = 0; i < 26; i++) { const x = x0 + rnd(i * 2.7 + n) * t, y = y0 + rnd(i * 4.1 + n) * t, rr = 20 + rnd(i + n) * 60, g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, i % 2 ? '#ffffff22' : '#8a806c14'); g.addColorStop(1, i % 2 ? '#ffffff00' : '#8a806c00'); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
            speckle(c, t, t, { flecks: ['#8f877699', '#ffffffaa', '#a99f8b88'], count: t * t / 40, size: [1, 2.2], seed: n + 4 });
            c.restore();
        }
        c.fillStyle = rough ? grey(236) : joint; c.fillRect(x0, y0, t, 3); c.fillRect(x0, y0, 3, t);
        if (!rough) { c.fillStyle = '#ffffff40'; c.fillRect(x0, y0 + 3, t, 1); c.fillRect(x0 + 3, y0, 1, t); }
    }
}
// Wainscot panel maps covering one panel pitch [pu mm] x the full height.
function drawDado(c, W, H, kind) {
    const P = pal(kind);
    if (kind === 'government') {
        // Raised sage panel: stiles and rails with bevelled field.
        c.fillStyle = P.dado; c.fillRect(0, 0, W, H); speckle(c, W, H, { flecks: ['#ffffff', '#5f786a'], count: W * H / 10, size: [1, 1.5], alpha: .12 });
        const s = W * .085, top = H * .1, bot = H * .2, bv = W * .022;
        const fx = s, fy = top, fw = W - 2 * s, fh = H - top - bot;
        c.fillStyle = shade(P.dado, .05); c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + fw, fy); c.lineTo(fx + fw - bv, fy + bv); c.lineTo(fx + bv, fy + bv); c.closePath(); c.fill();
        c.fillStyle = shade(P.dado, .03); c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + bv, fy + bv); c.lineTo(fx + bv, fy + fh - bv); c.lineTo(fx, fy + fh); c.closePath(); c.fill();
        c.fillStyle = shade(P.dado, -.07); c.beginPath(); c.moveTo(fx, fy + fh); c.lineTo(fx + bv, fy + fh - bv); c.lineTo(fx + fw - bv, fy + fh - bv); c.lineTo(fx + fw, fy + fh); c.closePath(); c.fill();
        c.fillStyle = shade(P.dado, -.05); c.beginPath(); c.moveTo(fx + fw, fy); c.lineTo(fx + fw, fy + fh); c.lineTo(fx + fw - bv, fy + fh - bv); c.lineTo(fx + fw - bv, fy + bv); c.closePath(); c.fill();
        c.fillStyle = shade(P.dado, .015); c.fillRect(fx + bv, fy + bv, fw - 2 * bv, fh - 2 * bv);
        c.fillStyle = '#00000022'; c.fillRect(0, 0, 2, H); c.fillStyle = '#ffffff22'; c.fillRect(2, 0, 1, H);
        c.fillStyle = shade(P.dado, -.1); c.fillRect(0, H - H * .09, W, 2);
        return;
    }
    // Security: dark wipe-clean dado with a reveal per panel and a kick band.
    // Police: navy wipeable panel, 3 mm reveals every 600.
    c.fillStyle = P.dado; c.fillRect(0, 0, W, H);
    speckle(c, W, H, { flecks: ['#ffffff', '#000000'], count: W * H / 6, size: [1, 1.6], alpha: kind === 'police' ? .06 : .08 });
    for (let i = 0; i < 40; i++) { const x = rnd(i * 3.7) * W, y = rnd(i * 1.9) * H, r = 20 + rnd(i) * 40, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 2 ? '#ffffff0c' : '#00000010'); g.addColorStop(1, i % 2 ? '#ffffff00' : '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.fillStyle = '#00000070'; c.fillRect(0, 0, 3, H); c.fillStyle = '#ffffff1e'; c.fillRect(3, 0, 1, H);
    const kick = kind === 'police' ? 0 : H * .09; if (kick) { c.fillStyle = shade(P.dado, -.04); c.fillRect(0, H - kick, W, kick); c.fillStyle = '#00000050'; c.fillRect(0, H - kick, W, 2); }
}
// Printed matter: generic labels (4 x 16 cells) and paper (4 x 2 cells).
const LABELS = {
    common: [['EXIT', '#1f9a5a', '#f2fff6'], ['FIRE EXTINGUISHER', '#b23a32', '#fff4f0'], ['FIRST AID', '#2f9d5b', '#f4fff6'], ['AED', '#2f9d5b', '#f4fff6'], ['STAFF ONLY', '#26323a', '#eef1ee'], ['PUSH', '#d8dcd9', '#26323a'], ['POWER', '#2a2f33', '#e9b949'], ['DATA', '#2a2f33', '#9fd4e6'], ['RECYCLING', '#3f6c4f', '#eef6ee'], ['NO FOOD OR DRINK', '#e9e5d8', '#3a2b24']],
    operations: [['KEYS', '#e9e5d8', '#1c2e3a'], ['RADIOS · CHARGE', '#e9e5d8', '#1c2e3a'], ['PPE', '#e9e5d8', '#1c2e3a'], ['SPARES', '#e9e5d8', '#1c2e3a'], ['CONSOLE 1', '#1c2e3a', '#7fe0d6'], ['CONSOLE 2', '#1c2e3a', '#7fe0d6'], ['CONSOLE 3', '#1c2e3a', '#7fe0d6'], ['SUPERVISOR', '#1c2e3a', '#7fe0d6'], ['VW-01', '#11181d', '#9fb7bd'], ['DO NOT UNPLUG', '#e4a646', '#10232d'], ['RACK A', '#11181d', '#9fb7bd'], ['KEY CABINET', '#e9e5d8', '#1c2e3a'], ['EQUIPMENT', '#e9e5d8', '#1c2e3a'], ['LOG BOOKS', '#e9e5d8', '#1c2e3a'], ['SITE MAPS', '#e9e5d8', '#1c2e3a'], ['BRIEFING', '#1c2e3a', '#7fe0d6'], ['ZONE A', '#48aeb0', '#0d1a20'], ['ZONE B', '#48aeb0', '#0d1a20'], ['ZONE C', '#48aeb0', '#0d1a20'], ['AUTHORISED ONLY', '#17232a', '#e9eee9']],
    police: [['LOCKER 01', '#e9ece6', '#234e72'], ['LOCKER 02', '#e9ece6', '#234e72'], ['LOCKER 03', '#e9ece6', '#234e72'], ['LOCKER 04', '#e9ece6', '#234e72'], ['PROPERTY 1', '#d9b44a', '#1c2a36'], ['PROPERTY 2', '#d9b44a', '#1c2a36'], ['PROPERTY 3', '#d9b44a', '#1c2a36'], ['PROPERTY 4', '#d9b44a', '#1c2a36'], ['PROPERTY 5', '#d9b44a', '#1c2a36'], ['PROPERTY 6', '#d9b44a', '#1c2a36'], ['RADIOS', '#234e72', '#f1f3ef'], ['VESTS', '#234e72', '#f1f3ef'], ['REPORTS IN', '#e9ece6', '#234e72'], ['REPORTS OUT', '#e9ece6', '#234e72'], ['BRIEFING', '#234e72', '#f1f3ef'], ['EVIDENCE', '#d9b44a', '#1c2a36'], ['SQUAD ROOM', '#234e72', '#f1f3ef'], ['INTAKE', '#234e72', '#f1f3ef'], ['PROPERTY DROP', '#d9b44a', '#1c2a36'], ['AUTHORISED STAFF', '#1c2a36', '#e9ece6']],
    government: [['RECORDS A', '#efe9dc', '#2c3d3b'], ['RECORDS B', '#efe9dc', '#2c3d3b'], ['RECORDS C', '#efe9dc', '#2c3d3b'], ['RECORDS D', '#efe9dc', '#2c3d3b'], ['RECORDS E', '#efe9dc', '#2c3d3b'], ['RECORDS F', '#efe9dc', '#2c3d3b'], ['FORMS', '#395d60', '#f1efe6'], ['PERMITS', '#395d60', '#f1efe6'], ['PAYMENTS', '#395d60', '#f1efe6'], ['APPOINTMENTS', '#395d60', '#f1efe6'], ['ARCHIVE', '#efe9dc', '#2c3d3b'], ['PLEASE TAKE ONE', '#b39b6a', '#24302e'], ['COUNTER 1', '#395d60', '#f1efe6'], ['COUNTER 2', '#395d60', '#f1efe6'], ['IN', '#efe9dc', '#2c3d3b'], ['OUT', '#efe9dc', '#2c3d3b'], ['ACCESSIBLE COUNTER', '#395d60', '#f1efe6'], ['ROOM 1.04', '#b39b6a', '#24302e'], ['SERVICE CENTRE', '#395d60', '#f1efe6'], ['HAND SANITISER', '#e9f1ec', '#395d60']]
};
const labelList = kind => [...LABELS.common, ...(LABELS[kind] || [])];
function drawLabels(c, W, H, kind) {
    const cw = W / 4, ch = H / 16;
    labelList(kind).forEach(([text, bg, fg], n) => {
        const x = (n % 4) * cw, y = Math.floor(n / 4) * ch;
        c.fillStyle = bg; c.fillRect(x, y, cw, ch); c.strokeStyle = fg + '55'; c.lineWidth = 2; c.strokeRect(x + 5, y + 5, cw - 10, ch - 10);
        c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 ${text.length > 12 ? 22 : 30}px sans-serif`; c.fillText(text, x + cw / 2, y + ch / 2 + 1, cw - 22);
    });
}
// Paper cells: 0 form, 1 roster, 2 site plan, 3 radio-code card, 4 checklist,
// 5 memo, 6 street map, 7 handwritten note. Generic content only.
function drawPaper(c, W, H, kind) {
    const cw = W / 4, ch = H / 2, ink = { operations: '#1c2e3a', police: '#234e72', government: '#395d60' }[kind] || '#2c3d3b';
    const lines = (x, y, w, n, step, col = '#8d969a', h = 3) => { for (let i = 0; i < n; i++) { c.fillStyle = col; c.fillRect(x, y + i * step, w * (.55 + rnd(i * 3.1 + x) * .45), h); } };
    for (let n = 0; n < 8; n++) {
        const x = (n % 4) * cw, y = Math.floor(n / 4) * ch;
        c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, cw, ch); c.clip();
        c.fillStyle = n === 3 ? '#e8d77a' : n === 7 ? '#fbf8ec' : '#f7f5ee'; c.fillRect(0, 0, cw, ch);
        speckle(c, cw, ch, { flecks: ['#00000010', '#ffffff40'], count: 900, size: [1, 2], seed: n });
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        if (n === 0) {
            c.fillStyle = ink; c.fillRect(14, 14, cw - 28, 34); c.fillStyle = '#f2f2ec'; c.font = '600 17px sans-serif'; c.fillText('APPLICATION FORM', 24, 38);
            for (let i = 0; i < 9; i++) { c.fillStyle = '#6f7a7e'; c.fillRect(18, 74 + i * 40, 70, 5); c.strokeStyle = '#a8b0b2'; c.lineWidth = 1.5; c.strokeRect(98, 64 + i * 40, cw - 116, 22); if (i % 3 === 1) { c.fillStyle = '#3f5368'; c.fillRect(104, 72 + i * 40, 60 + rnd(i) * 70, 4); } }
            for (let i = 0; i < 3; i++) { c.strokeStyle = ink; c.strokeRect(20 + i * 74, ch - 82, 16, 16); if (i !== 1) { c.fillStyle = ink; c.fillRect(24 + i * 74, ch - 78, 8, 8); } }
            c.strokeStyle = '#59646a'; c.beginPath(); c.moveTo(20, ch - 30); c.lineTo(cw - 30, ch - 30); c.stroke(); c.strokeStyle = '#2b4b8a'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, ch - 36); c.bezierCurveTo(70, ch - 60, 90, ch - 20, 120, ch - 44); c.bezierCurveTo(140, ch - 54, 150, ch - 30, 180, ch - 40); c.stroke();
        } else if (n === 1) {
            c.fillStyle = ink; c.font = '600 18px sans-serif'; c.fillText('SHIFT ROSTER', 18, 34);
            for (let r = 0; r <= 12; r++) { c.fillStyle = r ? '#c9cfd2' : ink; c.fillRect(14, 50 + r * 34, cw - 28, r ? 1.5 : 26); }
            for (let col = 1; col < 4; col++) { c.fillStyle = '#c9cfd2'; c.fillRect(14 + col * (cw - 28) / 4, 50, 1.5, 12 * 34 + 26); }
            for (let r = 1; r <= 12; r++) { c.fillStyle = '#7d878c'; c.fillRect(20, 62 + r * 34 - 8, 40 + rnd(r) * 20, 5); for (let col = 1; col < 4; col++) if (rnd(r * 4 + col) > .35) { c.fillStyle = ['#7fb3a2', '#d9b44a', '#8fa4c6'][col - 1]; c.fillRect(22 + col * (cw - 28) / 4, 56 + r * 34 - 6, (cw - 28) / 4 - 16, 12); } }
        } else if (n === 2) {
            c.strokeStyle = '#b9c6cc'; c.lineWidth = 1; for (let gx = 10; gx < cw; gx += 16) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, ch); c.stroke(); } for (let gy = 10; gy < ch; gy += 16) { c.beginPath(); c.moveTo(0, gy); c.lineTo(cw, gy); c.stroke(); }
            c.strokeStyle = '#3b4e58'; c.lineWidth = 3; c.strokeRect(30, 60, cw - 60, ch * .45); c.strokeRect(50, 80, 70, 90); c.strokeRect(140, 80, 70, 60); c.strokeRect(30, 60 + ch * .45, 110, ch * .2);
            c.fillStyle = '#8fb39a66'; c.fillRect(40, ch * .78, cw - 80, 50); c.fillStyle = '#3b4e58'; c.font = '13px sans-serif'; c.fillText('PLAN · ILLUSTRATIVE', 20, ch - 16);
            c.strokeStyle = '#c0392b'; c.lineWidth = 3; c.beginPath(); c.ellipse(170, 160, 46, 34, .2, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(210, 140); c.lineTo(236, 110); c.stroke();
            c.strokeStyle = '#3b4e58'; c.lineWidth = 1; c.beginPath(); c.moveTo(30, 44); c.lineTo(cw - 30, 44); c.stroke();
        } else if (n === 3) {
            c.fillStyle = '#1c2a36'; c.font = '600 20px sans-serif'; c.fillText('RADIO CODES', 18, 36);
            for (let r = 0; r < 10; r++) { c.fillStyle = r % 2 ? '#efe39a' : '#e8d77a'; c.fillRect(12, 52 + r * 42, cw - 24, 40); c.fillStyle = '#1c2a36'; c.font = '600 16px monospace'; c.fillText(`C${r + 1}`, 22, 78 + r * 42); c.fillStyle = '#4c5156'; c.fillRect(70, 66 + r * 42, 80 + rnd(r) * 80, 5); }
            c.strokeStyle = '#ffffff90'; c.lineWidth = 6; c.strokeRect(4, 4, cw - 8, ch - 8);
        } else if (n === 4) {
            c.fillStyle = ink; c.font = '600 17px sans-serif'; c.fillText('CHECKLIST', 18, 34);
            for (let r = 0; r < 11; r++) { c.strokeStyle = '#5b6970'; c.lineWidth = 2; c.strokeRect(20, 56 + r * 38, 18, 18); if (r < 7) { c.strokeStyle = '#2f7d55'; c.lineWidth = 3; c.beginPath(); c.moveTo(23, 66 + r * 38); c.lineTo(29, 72 + r * 38); c.lineTo(38, 58 + r * 38); c.stroke(); } c.fillStyle = '#7d878c'; c.fillRect(50, 62 + r * 38, 90 + rnd(r * 2) * 90, 5); }
        } else if (n === 5) {
            c.fillStyle = ink; c.font = '600 17px sans-serif'; c.fillText('NOTICE', 18, 34); c.fillStyle = ink; c.fillRect(18, 44, cw - 36, 2);
            lines(18, 64, cw - 36, 22, 18); c.fillStyle = '#c8b27a'; c.fillRect(cw - 70, ch - 70, 46, 46);
        } else if (n === 6) {
            c.fillStyle = '#eef0ea'; c.fillRect(0, 0, cw, ch);
            ['#5f8fb366', '#8fb39a66', '#c9a35f66', '#b37a6a66'].forEach((col, k) => { c.fillStyle = col; c.fillRect((k % 2) * cw / 2 + 4, Math.floor(k / 2) * ch / 2 + 4, cw / 2 - 8, ch / 2 - 8); });
            c.strokeStyle = '#ffffff'; c.lineWidth = 5; for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(k * cw / 5, 0); c.lineTo(k * cw / 5 + 8, ch); c.stroke(); } for (let k = 1; k < 8; k++) { c.beginPath(); c.moveTo(0, k * ch / 8); c.lineTo(cw, k * ch / 8 + 6); c.stroke(); }
            c.strokeStyle = '#7c8c94'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, ch * .7); c.bezierCurveTo(cw * .3, ch * .55, cw * .7, ch * .85, cw, ch * .5); c.stroke();
            for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#c0392b' : ink; c.beginPath(); c.arc(cw * (.15 + rnd(k * 5) * .7), ch * (.1 + rnd(k * 7) * .8), 6, 0, TAU); c.fill(); }
        } else {
            c.strokeStyle = '#b8cbe0'; c.lineWidth = 1; for (let r = 0; r < 18; r++) { c.beginPath(); c.moveTo(0, 50 + r * 25); c.lineTo(cw, 50 + r * 25); c.stroke(); }
            c.strokeStyle = '#e3a3a3'; c.beginPath(); c.moveTo(36, 0); c.lineTo(36, ch); c.stroke();
            c.strokeStyle = '#2b4b8a'; c.lineWidth = 1.6; for (let r = 0; r < 13; r++) { c.beginPath(); let px = 44; c.moveTo(px, 45 + r * 25); const len = 120 + rnd(r * 3) * 80; while (px < 44 + len) { px += 6 + rnd(px + r) * 6; c.lineTo(px, 45 + r * 25 - rnd(px * 1.3 + r) * 10); } c.stroke(); }
        }
        c.restore();
    }
}
// Material classes. `store` caches them: per room (kit.gov) or per kind for
// station / main-desk detail (module level; three re-uploads after a dispose).
const UVP = { steel: [260, 260], brushed: [420, 60], oak: [1400, 700], oakV: [700, 1400], hpl: [300, 300], fabric: [60, 60], rubber: [160, 160] };
const CLASSES = ['dress', 'steel', 'brushed', 'oak', 'oakV', 'hpl', 'fabric', 'rubber', 'glass', 'print', 'paper'];
function govMaterials(kind, store) {
    if (store.M) return store.M;
    const std = (o, surface) => { const m = new THREE.MeshStandardMaterial(o); if (surface) m.userData.roomSurface = surface; return m; };
    const powder = tex(drawPowder, 256, 256), powderR = tex(drawPowderRough, 128, 128, false), hpl = tex(drawHPL, 256, 256), hplR = tex(drawHPLRough, 128, 128, false);
    const oakH = tex((c, W, H) => drawOak(c, W, H, { seed: 3 }), 1024, 512), oakV = tex((c, W, H) => drawOak(c, W, H, { seed: 11, vertical: true }), 512, 1024);
    const maps = store.maps = { powder, powderR, hpl, hplR, oakH, oakV, brushed: tex(drawBrushed, 256, 64), weave: tex(drawWeave, 128, 128), rubber: tex(drawRubber, 128, 128), limewash: tex(drawLimewash, 512, 512) };
    const labels = tex((c, W, H) => drawLabels(c, W, H, kind), 1024, 1024), paper = tex((c, W, H) => drawPaper(c, W, H, kind), 1024, 1024);
    labels.wrapS = labels.wrapT = paper.wrapS = paper.wrapT = THREE.ClampToEdgeWrapping;
    return store.M = {
        dress: std({ vertexColors: true, roughness: .62 }),
        steel: std({ vertexColors: true, map: powder, roughnessMap: powderR, roughness: .6, metalness: .32 }),
        brushed: std({ vertexColors: true, map: maps.brushed, roughness: .34, metalness: .72 }),
        oak: std({ vertexColors: true, map: oakH, roughness: .55 }, 'wood'),
        oakV: std({ vertexColors: true, map: oakV, roughness: .55 }, 'wood'),
        hpl: std({ vertexColors: true, map: hpl, roughnessMap: hplR, roughness: .68 }),
        fabric: std({ vertexColors: true, map: maps.weave, roughness: .95 }, 'fabric'),
        rubber: std({ vertexColors: true, map: maps.rubber, roughness: .88 }, 'rubber'),
        glass: std({ color: '#d2e4e8', transparent: true, opacity: .2, roughness: .05, metalness: .1, depthWrite: false }),
        print: std({ vertexColors: true, map: labels, roughness: .5 }),
        paper: std({ vertexColors: true, map: paper, roughness: .82, side: THREE.DoubleSide })
    };
}
const stationStore = {};
const roomMats = kit => govMaterials(kit.spec.kind, kit.gov ||= {});
const stationMats = kind => govMaterials(kind, stationStore[kind] ||= {});
// Class kit: K.steel.box(...), K.oak.box(...), ...; K.box/cyl/ball/add go to
// the flat "dress" class. K.build merges one mesh per non-empty class.
function ck(kind) {
    const K = { kind };
    for (const c of CLASSES) K[c] = detailKit();
    for (const fn of ['box', 'cyl', 'ball', 'add']) K[fn] = (...a) => { K.dress[fn](...a); return K; };
    K.build = (parent, M) => {
        let first;
        for (const c of CLASSES) {
            const m = K[c].build(parent, M[c]); if (!m) continue;
            if (UVP[c]) uvBox(m.geometry, ...UVP[c]); else m.geometry.userData.govUV = true;
            if (c === 'glass' || c === 'print' || c === 'paper') m.castShadow = false;
            if (c === 'glass') m.renderOrder = 2;
            first ||= m;
        }
        return first;
    };
    return K;
}
// A plane mapped to one atlas cell (cols x rows), facing +z before `rot`.
function atlasPlane(w, h, cell, cols, rows) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, cx = cell % cols, cy = Math.floor(cell / cols);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + .01 + uv.getX(i) * .98) / cols, 1 - (cy + 1 - (.01 + uv.getY(i) * .98)) / rows);
    return g;
}
// Printed label plate (+z facing unless rotated). Unknown text → blank plate.
function tag(K, text, [w, h], at, rot = [0, 0, 0]) {
    const n = labelList(K.kind).findIndex(l => l[0] === text);
    if (n < 0) { K.box([w, h, 2], at, '#e9e5d8', rot); return K; }
    K.print.add(atlasPlane(w, h, n, 4, 16), at, '#ffffff', [1, 1, 1], rot); return K;
}
// Flat paper sheet lying on a surface at height y (cell, see drawPaper).
function paperSheet(K, cell, x, y, z, w, d, yaw = 0, tint = '#ffffff') { K.paper.add(atlasPlane(w, d, cell, 4, 2), [x, y + 1.2, z], tint, [1, 1, 1], [-Math.PI / 2, 0, yaw]); return K; }

// ---- Room shell finishes --------------------------------------------------
// Surfaces shared by the shell (walls, seats, oak, table tops) get maps and
// physical UV periods; wainscots, rails, acoustic panels and blinds follow
// the brief per scene. Wall finishes are non-asset children of the cutaway
// wall groups, so they disappear with their wall.
function finishShell(kit) {
    const { spec } = kit, kind = spec.kind, P = pal(kind), M = roomMats(kit), maps = kit.gov.maps;
    // Walls: limewash / eggshell paint at 1.6 m.
    kit.wall.map = maps.limewash; kit.wall.userData.govUV = [1600, 1600]; kit.wall.needsUpdate = true;
    // Seats: woven upholstery in the scene colour (cyan stays a light accent).
    for (const [m, color] of [[kit.seat, P.seat], [kit.taskSeat, P.task]]) { m.color.set(color); m.map = maps.weave; m.userData.govUV = [60, 60]; m.needsUpdate = true; }
    // Shell oak (door leaf, frames, government tables): real grain.
    kit.oak.map = maps.oakH; kit.oak.userData.govUV = [1400, 700]; kit.oak.needsUpdate = true;
    // The shell's accent band and kick strip give way to the wainscot.
    for (const o of kit.back.children) if (o.isMesh && o.material === kit.accent) o.visible = false;
    for (const o of kit.right.children) if (o.isMesh && o.material === kit.metal && o.geometry.parameters?.height === 110) o.visible = false;
    const dado = new THREE.MeshStandardMaterial({ map: tex((c, W, H) => drawDado(c, W, H, kind), kind === 'police' ? 256 : 512, 448), roughness: { operations: .7, police: .55, government: .7 }[kind] ?? .7 });
    const pitch = { operations: 1200, police: 600, government: 1300 }[kind] ?? 1200, height = 1100;
    const skip = kind === 'government' ? [[-kit.w / 2, -kit.w / 2 + 2440]] : [];
    wainscot(kit, M, dado, pitch, height, skip);
    acousticGrid(kit, M);
}
// Wainscot runs along the back wall, the door wall (door span skipped) and
// the window wall (below the 800 sill under the glazing).
function wainscot(kit, M, mat, pitch, height, skip) {
    const { w, bz, front, d, spec } = kit, kind = spec.kind, P = pal(kind), depth = 16, doorZ = front - 1600, win = [bz + d * .3, bz + d * .78];
    const cut = (a, b, holes) => { let segs = [[a, b]]; for (const [h0, h1] of holes) segs = segs.flatMap(([s, e]) => h1 <= s || h0 >= e ? [[s, e]] : [[s, h0], [h1, e]].filter(([x0, x1]) => x1 - x0 > 60)); return segs; };
    const runs = {
        back: cut(-w / 2 + 20, w / 2 - 20, skip).map(([a, b]) => [a, b, height]),
        right: cut(bz + 20, front, [[doorZ - 560, doorZ + 560]]).map(([a, b]) => [a, b, height]),
        left: [[bz + 20, win[0], height], [win[0], win[1], 780], [win[1], front, height]]
    };
    const walls = { back: kit.back, right: kit.right, left: kit.left };
    for (const side of ['back', 'right', 'left']) {
        const base = detailKit(), K = ck(kind), glow = detailKit();
        for (const [a, b, hgt] of runs[side]) {
            const len = b - a, mid = (a + b) / 2, full = hgt === height;
            // Panel boards (box-projected below), plus raised fields for government.
            const at = (y, off = 0) => side === 'back' ? [mid, y, bz + 18 + depth / 2 + off] : side === 'right' ? [w / 2 - 4 - depth / 2 - off, y, mid] : [-w / 2 + 4 + depth / 2 + off, y, mid];
            const size = (l, h, dd) => side === 'back' ? [l, h, dd] : [dd, h, l];
            base.box(size(len, hgt, depth), at(hgt / 2), '#ffffff');
            if (kind === 'government' && full) {
                // Raised fields aligned with the drawn 1300 mm panel pitch.
                const first = Math.ceil(a / pitch) * pitch - pitch;
                for (let p = first; p < b; p += pitch) {
                    const f0 = Math.max(a + 40, p + pitch * .085 + 30), f1 = Math.min(b - 40, p + pitch * (1 - .085) - 30); if (f1 - f0 < 200) continue;
                    const fm = (f0 + f1) / 2, fy0 = height * .2 + 26, fy1 = height * .9 - 26;
                    const c = side === 'back' ? [fm, (fy0 + fy1) / 2, bz + 18 + depth + 3] : side === 'right' ? [w / 2 - 4 - depth - 3, (fy0 + fy1) / 2, fm] : [-w / 2 + 4 + depth + 3, (fy0 + fy1) / 2, fm];
                    base.box(side === 'back' ? [f1 - f0, fy1 - fy0, 6] : [6, fy1 - fy0, f1 - f0], c, '#ffffff');
                }
            }
            if (!full) continue;
            // Cap rails / stripes.
            const capAt = (y, dd) => side === 'back' ? [mid, y, bz + 18 + dd / 2] : side === 'right' ? [w / 2 - 4 - dd / 2, y, mid] : [-w / 2 + 4 + dd / 2, y, mid];
            if (kind === 'operations') {
                K.steel.box(size(len, 14, depth + 10), capAt(height + 7, depth + 10), '#1a2832');
                glow.box(size(len, 40, 6), capAt(height + 34, 6), '#48aeb0');
                K.steel.box(size(len, 10, depth + 6), capAt(height + 59, depth + 6), '#1a2832');
            } else if (kind === 'police') {
                K.brushed.box(size(len, 56, depth + 22), capAt(height + 28, depth + 22), P.rail);
                K.dress.box(size(len, 6, depth + 24), capAt(height + 10, depth + 24), '#7d878d');
            } else {
                K.oak.box(size(len + 4, 40, depth + 22), capAt(height + 20, depth + 22), '#ffffff');
                K.oak.box(size(len + 4, 14, depth + 30), capAt(height + 47, depth + 30), '#f1e6d6');
            }
        }
        // presentationOnly: RoomInteractions would otherwise take this floor-
        // standing wall group for furniture, re-parent it to the room root (it
        // then stays up when its wall is cut away) and make it a draggable collider.
        const g = new THREE.Group(); g.name = 'Wainscot wall finish'; g.userData.presentationOnly = true; walls[side].add(g);
        const m = base.build(g, mat); if (m) { uvBox(m.geometry, pitch, height); m.castShadow = false; m.receiveShadow = true; m.name = 'Wainscot panels'; }
        K.build(g, M);
        if (kind === 'operations') { const gm = glowMat(kit, '#48aeb0', .55); const s = glow.build(g, gm); if (s) { s.castShadow = false; s.name = 'Dado light line'; } }
    }
}
// Fabric-wrapped acoustic panels on the door wall (keeps the shell asset key).
function acousticGrid(kit, M) {
    const g = kit.byId('acoustic-panels'); if (!g) return;
    strip(g);
    const kind = kit.spec.kind, P = pal(kind), K = ck(kind);
    if (kind === 'operations') {
        // Staggered 600 x 1200 panels with 600 x 600 toppers.
        for (const [x, y, w, h, n] of [[-330, 0, 600, 1200, 0], [330, 200, 600, 1200, 1], [-330, 820, 600, 400, 1], [330, 920, 600, 200, 0]]) {
            K.fabric.box([w - 8, h - 8, 44], [x, y, 0], P.felt[n]); K.fabric.box([w - 40, h - 40, 6], [x, y, 25], shade(P.felt[n], .02));
            K.steel.box([w - 60, 12, 20], [x, y + h / 2 - 60, -26], '#2a343a');
        }
    } else {
        // Five tall felt strips with grooves (shell layout), retextured.
        for (let n = 0; n < 5; n++) {
            K.fabric.box([210, 1050, 45], [-560 + n * 280, 0, 0], P.felt[n % 2]);
            for (let line = 0; line < 4; line++) K.dress.box([4, 980, 2], [-640 + n * 280 + line * 54, 0, 23], shade(P.felt[n % 2], -.08));
        }
    }
    K.build(g, M);
}
// Blinds: blackout roller (security), aluminium venetian (police), sheer
// roller (government). Drop set per daypart in atmosphere().
function blindMaterial(kind, bw) {
    const P = pal(kind);
    if (kind === 'police') {
        const map = tex((c, W, H) => {
            c.clearRect(0, 0, W, H);
            for (let s = 0; s < 2; s++) { const y0 = s * H / 2, sh = H / 2 - 7, g = c.createLinearGradient(0, y0, 0, y0 + sh); g.addColorStop(0, '#ffffff'); g.addColorStop(.45, '#e4e6e8'); g.addColorStop(1, '#a9afb4'); c.fillStyle = g; c.fillRect(0, y0, W, sh); c.fillStyle = '#ffffff70'; c.fillRect(0, y0 + 2, W, 2); }
            for (let i = 0; i < 300; i++) { c.fillStyle = '#ffffff40'; c.fillRect(rnd(i) * W, rnd(i * 3) * H, 6 + rnd(i * 2) * 20, 1); }
        }, 64, 64);
        map.repeat.set(1, 1);
        const m = new THREE.MeshStandardMaterial({ color: P.blind, map, alphaTest: .5, roughness: .4, metalness: .45, side: THREE.DoubleSide });
        m.userData.blind = { pu: bw, pv: 100 }; return m;
    }
    const sheer = kind === 'government';
    const map = tex((c, W, H) => {
        c.fillStyle = sheer ? '#f4f1ea' : '#3a444a'; c.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 2) { c.fillStyle = y % 4 ? '#ffffff14' : '#00000018'; c.fillRect(0, y, W, 1); }
        for (let x = 0; x < W; x += 2) { c.fillStyle = x % 4 ? '#ffffff10' : '#00000014'; c.fillRect(x, 0, 1, H); }
        if (sheer) for (let i = 0; i < 40; i++) { c.fillStyle = '#ffffff30'; c.fillRect(rnd(i * 3) * W, 0, 1 + rnd(i) * 2, H); }
        speckle(c, W, H, { flecks: sheer ? ['#ffffff20', '#00000014'] : ['#ffffff07', '#00000018'], count: W * H / 8, size: [1, 2] });
    }, 128, 128);
    const m = new THREE.MeshStandardMaterial({ color: sheer ? P.blind : '#8b979d', map, roughness: .95, side: THREE.DoubleSide, transparent: sheer, opacity: sheer ? .8 : 1 });
    m.userData.blind = { pu: 160, pv: 160 }; return m;
}

// ---- Window views: one generic outlook per scene ---------------------------
// Security: perimeter fence, lamp posts, car park, gatehouse. Police: station
// yard with palisade fence, three plain white / blue patrol cars, a flagless
// pole and street trees. Government: civic plaza with a columned hall, steps,
// bus shelter and street trees. Redrawn per daypart; no text or insignia.
function installView(kit) {
    const pane = kit.window.children.find(o => o.isMesh && o.material === kit.sky); if (!pane) return;
    const aspect = kit.d * .48 / 1750, H = 512, W = Math.min(2048, Math.round(H * aspect / 16) * 16);
    const map = institutionalMap(() => {}, W, H); map.anisotropy = 4;
    // Unlit outlook (black base, emissive map): the room lights never grey it;
    // its brightness is set per daypart (LIGHT[kind].view).
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .8, roughness: .9 });
    pane.material = m; pane.castShadow = true; kit.gov.view = { m, map, W, H, phase: null };
}
function drawView(kit, phase, gain = 1) {
    const v = kit.gov?.view; if (!v) return;
    v.m.emissiveIntensity = (LIGHT[kit.spec.kind]?.view[phaseIndex(phase)] ?? .8) * Math.min(1.2, .6 + gain * .4);
    if (v.phase === phase) return; v.phase = phase;
    const c = v.map.image.getContext('2d'), sky = kit.spec.modes[phase]?.sky || ['#bad8e5', '#f5e6ca'];
    c.save(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    VIEWS[kit.spec.kind]?.(c, v.W, v.H, phase, sky);
    c.restore(); v.map.needsUpdate = true;
}
const isNight = p => p === 'night', isDusk = p => p === 'evening';
function viewSky(c, W, H, phase, sky, horizon) {
    const night = isNight(phase), dusk = isDusk(phase);
    const g = c.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, horizon + 2);
    const sun = { morning: [.18, .26, '#fff4d8'], afternoon: [.8, .12, '#fffdf0'], evening: [.32, .62, '#ffc27a'], night: [.84, .14, '#eef0e4'], party: [.86, .3, '#fff2dc'] }[phase] || [.5, .2, '#fff'];
    const sx = W * sun[0], sy = horizon * sun[1], halo = c.createRadialGradient(sx, sy, 2, sx, sy, night ? H * .12 : H * .4);
    halo.addColorStop(0, sun[2] + (night ? '70' : 'c0')); halo.addColorStop(1, sun[2] + '00'); c.fillStyle = halo; c.fillRect(0, 0, W, horizon);
    c.fillStyle = sun[2]; c.beginPath(); c.arc(sx, sy, night ? 10 : 15, 0, TAU); c.fill();
    if (night) { c.fillStyle = '#ffffffa0'; for (let i = 0; i < W / 7; i++) c.fillRect(rnd(i * 1.7) * W, rnd(i * 3.3) * horizon * .8, 1 + rnd(i * 7) * 1.3, 1 + rnd(i * 7) * 1.3); }
    else for (let i = 0; i < Math.round(W / 160); i++) {
        const x = rnd(i * 5 + 2) * W, y = horizon * (.12 + rnd(i * 9) * .4), s = H * (.04 + rnd(i * 4) * .05);
        c.fillStyle = dusk ? '#f6c9a890' : '#ffffffa8';
        for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + (j - 2) * s * .6, y + Math.abs(j - 2) * s * .1, s * .7, s * .32, 0, 0, TAU); c.fill(); }
    }
}
const tone = (phase, day, dusk, night) => isNight(phase) ? night : isDusk(phase) ? dusk : day;
function glowDot(c, x, y, r, color, a = 'c0') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + a); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function viewTrees(c, W, y, n, size, phase, seed = 1) {
    for (let i = 0; i < n; i++) {
        const x = (i + .3 + rnd(i * 3 + seed) * .4) * W / n, r = size * (.8 + rnd(i * 5 + seed) * .45);
        c.fillStyle = tone(phase, '#5a4632', '#4d3c2c', '#221d1a'); c.fillRect(x - r * .08, y - r * .6, r * .16, r * .9);
        c.fillStyle = tone(phase, '#557f4f', '#4a6646', '#1c2f2c'); c.beginPath(); c.ellipse(x, y - r * 1.1, r * .8, r, 0, 0, TAU); c.fill();
        c.fillStyle = tone(phase, '#6f9a5c', '#5e7a50', '#24403a'); c.beginPath(); c.ellipse(x - r * .25, y - r * 1.35, r * .48, r * .55, 0, 0, TAU); c.fill();
    }
}
function lampPost(c, x, ground, h, phase, color = '#f2d8a0') {
    c.fillStyle = tone(phase, '#5b646a', '#4f575c', '#2a3034'); c.fillRect(x - 2, ground - h, 4, h); c.fillRect(x - 2, ground - h, 18, 4);
    c.fillStyle = isNight(phase) || isDusk(phase) ? color : '#c9cfd2'; c.fillRect(x + 8, ground - h + 3, 12, 4);
    if (isNight(phase) || isDusk(phase)) { glowDot(c, x + 14, ground - h + 6, h * .35, color, isNight(phase) ? 'd0' : '70'); glowDot(c, x + 14, ground, h * .5, color, isNight(phase) ? '50' : '20'); }
}
// Generic hatchback silhouette (side view), no markings beyond a plain band.
function car(c, x, y, s, body, phase, band = null) {
    const night = isNight(phase), shadeBody = night ? shade(body, -.32) : body;
    c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(x + s * .5, y + 2, s * .55, s * .05, 0, 0, TAU); c.fill();
    c.fillStyle = shadeBody; c.beginPath(); c.moveTo(x, y - s * .08); c.lineTo(x + s * .02, y - s * .24); c.lineTo(x + s * .22, y - s * .27); c.lineTo(x + s * .34, y - s * .44); c.lineTo(x + s * .72, y - s * .44); c.lineTo(x + s * .86, y - s * .27); c.lineTo(x + s, y - s * .24); c.lineTo(x + s, y - s * .08); c.closePath(); c.fill();
    c.fillStyle = night ? '#1b252c' : '#2f4350'; c.beginPath(); c.moveTo(x + s * .25, y - s * .27); c.lineTo(x + s * .36, y - s * .41); c.lineTo(x + s * .52, y - s * .41); c.lineTo(x + s * .52, y - s * .27); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + s * .55, y - s * .27); c.lineTo(x + s * .55, y - s * .41); c.lineTo(x + s * .7, y - s * .41); c.lineTo(x + s * .82, y - s * .27); c.closePath(); c.fill();
    if (band) { c.fillStyle = night ? shade(band, -.25) : band; c.fillRect(x + s * .02, y - s * .19, s * .96, s * .05); }
    c.fillStyle = '#1b1f22'; for (const wx of [.2, .8]) { c.beginPath(); c.arc(x + s * wx, y - s * .06, s * .085, 0, TAU); c.fill(); c.fillStyle = '#8e969b'; c.beginPath(); c.arc(x + s * wx, y - s * .06, s * .035, 0, TAU); c.fill(); c.fillStyle = '#1b1f22'; }
    if (night) { glowDot(c, x + s, y - s * .18, s * .12, '#ff4a3a', '90'); }
}
function windows(c, x, y, w, h, rows, cols, phase, { lit = .5, seed = 1, dayColor = '#7f97a4', frame = null } = {}) {
    const night = isNight(phase), dusk = isDusk(phase), cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const on = (night || dusk) && rnd(seed * 31 + r * 7 + q) < lit;
        c.fillStyle = on ? (night ? '#f3d58e' : '#f0d6a0') : night ? '#1d2a33' : dusk ? '#5c6b78' : dayColor;
        c.fillRect(x + q * cw + cw * .18, y + r * rh + rh * .2, cw * .64, rh * .58);
        if (frame) { c.fillStyle = frame; c.fillRect(x + q * cw + cw * .18, y + r * rh + rh * .48, cw * .64, 1); }
        if (on && night) glowDot(c, x + q * cw + cw / 2, y + r * rh + rh / 2, cw * .9, '#f3d58e', '28');
    }
}
const VIEWS = {
    operations(c, W, H, phase, sky) {
        const hz = H * .5, night = isNight(phase);
        viewSky(c, W, H, phase, sky, hz);
        // Distant tree line and low industrial units.
        viewTrees(c, W, hz + 4, Math.round(W / 46), H * .05, phase, 4);
        for (let i = 0; i < 4; i++) { const x = W * (.05 + i * .26), bw = W * .17, bh = H * (.06 + rnd(i) * .04); c.fillStyle = tone(phase, '#b9bfc0', '#9ea3a8', '#26323a'); c.fillRect(x, hz - bh, bw, bh); c.fillStyle = tone(phase, '#9aa2a6', '#858b90', '#1c262d'); c.fillRect(x, hz - bh, bw, 4); windows(c, x + 6, hz - bh + 8, bw - 12, bh - 12, 1, 6, phase, { lit: .3, seed: i }); }
        // Ground: verge then asphalt car park.
        c.fillStyle = tone(phase, '#8ea47e', '#738866', '#1b2722'); c.fillRect(0, hz, W, H * .1);
        const lot = hz + H * .1; const g = c.createLinearGradient(0, lot, 0, H); g.addColorStop(0, tone(phase, '#6c7277', '#5a5f66', '#1f2428')); g.addColorStop(1, tone(phase, '#555b60', '#474c52', '#16191c')); c.fillStyle = g; c.fillRect(0, lot, W, H - lot);
        // Perimeter fence: posts, chain-link and a top wire.
        const fy = hz + H * .1, fh = H * .1; c.strokeStyle = tone(phase, '#7d868b88', '#6a727788', '#3c464c88'); c.lineWidth = 1;
        for (let x = -fh; x < W + fh; x += 7) { c.beginPath(); c.moveTo(x, fy - fh); c.lineTo(x + fh, fy); c.stroke(); c.beginPath(); c.moveTo(x + fh, fy - fh); c.lineTo(x, fy); c.stroke(); }
        c.fillStyle = tone(phase, '#5d666b', '#4f575c', '#2a3034'); for (let x = 10; x < W; x += 70) c.fillRect(x, fy - fh - 8, 3, fh + 8);
        c.fillRect(0, fy - fh - 8, W, 2); c.fillRect(0, fy - fh, W, 2);
        for (let x = 0; x < W; x += 8) c.fillRect(x, fy - fh - 12 + (x / 8 % 2) * 4, 4, 1);
        // Gatehouse with barrier arm.
        const gx = W * .74, gw = H * .22, gh = H * .14, gb = fy + H * .02;
        c.fillStyle = tone(phase, '#d6d3c8', '#b9b2a6', '#39434a'); c.fillRect(gx, gb - gh, gw, gh); c.fillStyle = tone(phase, '#58636a', '#4b545a', '#20272c'); c.fillRect(gx - 8, gb - gh - 8, gw + 16, 10);
        windows(c, gx + 6, gb - gh + 12, gw - 12, gh * .45, 1, 3, phase, { lit: 1, seed: 9, dayColor: '#6f8794' });
        c.fillStyle = tone(phase, '#3f4b52', '#36414a', '#151b1f'); c.fillRect(gx + gw * .4, gb - gh * .45, gw * .2, gh * .45);
        for (let n = 0; n < 8; n++) { c.fillStyle = n % 2 ? '#e8e6e0' : '#c0392b'; if (night) c.fillStyle = n % 2 ? '#7c7e80' : '#6a2620'; c.fillRect(gx - 30 - n * 18, gb - gh * .38, 18, 5); }
        // Bay lines and four plain cars.
        c.strokeStyle = tone(phase, '#e9e9e2c0', '#d9d6c8a0', '#8a8d8a70'); c.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const x = W * (.04 + i * .062); c.beginPath(); c.moveTo(x, H * .7); c.lineTo(x - 26, H * .86); c.stroke(); }
        [['#c8ccd0', .06], ['#2e3a46', .19], ['#e6e6e2', .32], ['#7c8790', .5]].forEach(([col, x], n) => car(c, W * x, H * .82, H * .2, col, phase));
        c.strokeStyle = tone(phase, '#e9e9e2b0', '#d9d6c890', '#8a8d8a60'); c.beginPath(); c.moveTo(0, H * .93); c.lineTo(W, H * .93); c.stroke();
        // Lamp posts (sodium at night) and a pool near the sill for the blind slot.
        for (let i = 0; i < 4; i++) lampPost(c, W * (.12 + i * .26), H * .88, H * .3, phase, '#e8b56a');
        if (night) { const pool = c.createLinearGradient(0, H * .9, 0, H); pool.addColorStop(0, '#e8b56a00'); pool.addColorStop(1, '#e8b56a55'); c.fillStyle = pool; c.fillRect(0, H * .9, W, H * .1); }
    },
    police(c, W, H, phase, sky) {
        const hz = H * .5, night = isNight(phase);
        viewSky(c, W, H, phase, sky, hz);
        // Neighbourhood beyond: roofs and street trees.
        for (let i = 0; i < 7; i++) { const x = W * (i / 7) + rnd(i) * 20, bw = W / 7 - 12, bh = H * (.08 + rnd(i * 3) * .05); c.fillStyle = tone(phase, ['#c9b9a2', '#b7a58f', '#d2c5b1'][i % 3], '#a08f80', '#2b343b'); c.fillRect(x, hz - bh, bw, bh); c.fillStyle = tone(phase, '#7b5a4a', '#6a4d40', '#1f2226'); c.beginPath(); c.moveTo(x - 6, hz - bh); c.lineTo(x + bw / 2, hz - bh - H * .045); c.lineTo(x + bw + 6, hz - bh); c.fill(); windows(c, x + 6, hz - bh + 6, bw - 12, bh - 10, 2, 3, phase, { lit: .45, seed: i + 3, dayColor: '#8aa0ac' }); }
        viewTrees(c, W, hz + H * .02, 6, H * .075, phase, 8);
        // Station annex (brick) on the left with two flood lights.
        const ax = W * .02, aw = W * .3, ah = H * .26, ab = hz + H * .1;
        c.fillStyle = tone(phase, '#8a5a48', '#74503f', '#2c2423'); c.fillRect(ax, ab - ah, aw, ah);
        c.strokeStyle = '#00000018'; for (let y = ab - ah; y < ab; y += 6) { c.beginPath(); c.moveTo(ax, y); c.lineTo(ax + aw, y); c.stroke(); }
        c.fillStyle = tone(phase, '#4c5a63', '#414d55', '#1a2026'); c.fillRect(ax - 4, ab - ah - 6, aw + 8, 8);
        windows(c, ax + 10, ab - ah + 14, aw - 20, ah * .6, 2, 6, phase, { lit: .6, seed: 21, dayColor: '#7e96a4' });
        for (const fx of [.3, .7]) { c.fillStyle = '#c9cfd2'; c.fillRect(ax + aw * fx - 6, ab - ah + 4, 12, 6); if (night || isDusk(phase)) glowDot(c, ax + aw * fx, ab - ah + 30, H * .16, '#dfe8ff', night ? '70' : '30'); }
        // Flagless pole.
        c.fillStyle = tone(phase, '#e6e8e8', '#cfd0cf', '#5d666b'); c.fillRect(W * .4, hz - H * .3, 3, H * .4); c.beginPath(); c.arc(W * .4 + 1.5, hz - H * .3, 4, 0, TAU); c.fill();
        // Yard: asphalt, palisade fence, bays and three plain patrol cars.
        const yard = hz + H * .1, g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, tone(phase, '#73787c', '#62676c', '#1f2428')); g.addColorStop(1, tone(phase, '#5a5f63', '#4c5054', '#15181b')); c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
        c.fillStyle = tone(phase, '#8ea47e', '#738866', '#1b2722'); c.fillRect(0, hz, W, H * .03);
        c.fillStyle = tone(phase, '#3e4a52', '#343e45', '#151a1e'); for (let x = 0; x < W; x += 9) { c.fillRect(x, yard - H * .12, 3, H * .12); c.beginPath(); c.moveTo(x, yard - H * .12); c.lineTo(x + 1.5, yard - H * .13); c.lineTo(x + 3, yard - H * .12); c.fill(); }
        c.fillRect(0, yard - H * .1, W, 3); c.fillRect(0, yard - H * .03, W, 3);
        c.strokeStyle = tone(phase, '#e9e9e2b0', '#d9d6c890', '#8a8d8a60'); c.lineWidth = 2; for (let i = 0; i < 8; i++) { const x = W * (.42 + i * .075); c.beginPath(); c.moveTo(x, H * .72); c.lineTo(x - 22, H * .9); c.stroke(); }
        for (const [n, x] of [.44, .6, .76].entries()) car(c, W * x, H * .86 - n * 2, H * .22, '#eef0f2', phase, '#2a5d9f');
        for (let i = 0; i < 3; i++) lampPost(c, W * (.36 + i * .25), H * .9, H * .32, phase, '#f0c27c');
        viewTrees(c, W * .35, H * 1.02, 2, H * .1, phase, 13);
    },
    government(c, W, H, phase, sky) {
        const hz = H * .55, night = isNight(phase), dusk = isDusk(phase);
        viewSky(c, W, H, phase, sky, hz);
        viewTrees(c, W, hz + 2, Math.round(W / 60), H * .05, phase, 2);
        // Plaza paving in perspective.
        const g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, tone(phase, '#d8d0bf', '#bfb2a2', '#3a3f41')); g.addColorStop(1, tone(phase, '#cbc1ad', '#ad9f8e', '#2b2f31')); c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
        c.strokeStyle = tone(phase, '#b3a993', '#9b8f7f', '#25292b'); c.lineWidth = 1;
        for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(W * .45 + i * 20, hz); c.lineTo(W * .45 + i * 130, H); c.stroke(); }
        for (let k = 1; k < 8; k++) { const y = hz + (H - hz) * (k / 8) ** 1.6; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        // Civic hall: steps, colonnade, entablature and pediment.
        const hx = W * .14, hw = Math.min(W * .5, H * 1.3), base = hz + H * .02, hh = H * .26, stone = tone(phase, '#e2d7bd', '#cdbd9f', '#4a4842'), shadow = tone(phase, '#b8aa8d', '#a08f74', '#2c2b28');
        c.fillStyle = shadow; c.fillRect(hx + hw * .06, base - hh, hw * .88, hh);
        windows(c, hx + hw * .1, base - hh * .9, hw * .8, hh * .7, 2, 7, phase, { lit: .85, seed: 41, dayColor: '#6f7f86' });
        for (let s = 0; s < 3; s++) { c.fillStyle = s % 2 ? stone : shade(stone, -.04); c.fillRect(hx - s * 8, base + s * 5, hw + s * 16, 5); }
        const cols = 8; for (let n = 0; n < cols; n++) { const x = hx + hw * .05 + n * hw * .9 / (cols - 1) - 6; c.fillStyle = stone; c.fillRect(x, base - hh, 12, hh); c.fillStyle = '#ffffff22'; c.fillRect(x + 2, base - hh, 3, hh); c.fillStyle = shadow; c.fillRect(x - 2, base - 6, 16, 6); c.fillRect(x - 2, base - hh, 16, 6); }
        c.fillStyle = stone; c.fillRect(hx - 4, base - hh - 22, hw + 8, 22); c.fillStyle = shadow; c.fillRect(hx - 4, base - hh - 8, hw + 8, 3);
        c.fillStyle = stone; c.beginPath(); c.moveTo(hx - 10, base - hh - 22); c.lineTo(hx + hw / 2, base - hh - 22 - H * .1); c.lineTo(hx + hw + 10, base - hh - 22); c.fill();
        c.strokeStyle = shadow; c.lineWidth = 2; c.beginPath(); c.moveTo(hx + 10, base - hh - 26); c.lineTo(hx + hw / 2, base - hh - 22 - H * .085); c.lineTo(hx + hw - 10, base - hh - 26); c.closePath(); c.stroke();
        if (night || dusk) glowDot(c, hx + hw / 2, base - hh * .5, hw * .45, '#f3d79a', night ? '40' : '18');
        // Bus shelter on the right with a lit ad panel at night.
        const bx = W * .76, bb = hz + H * .2, bw2 = H * .32, bh = H * .17;
        c.fillStyle = tone(phase, '#4f5a60', '#454f55', '#1e2427'); c.fillRect(bx - 4, bb - bh - 6, bw2 + 8, 7); c.fillRect(bx, bb - bh, 3, bh); c.fillRect(bx + bw2 - 3, bb - bh, 3, bh);
        c.fillStyle = tone(phase, '#bcd6df70', '#a9bcc670', '#30404a90'); c.fillRect(bx + 3, bb - bh, bw2 - 6, bh * .8);
        c.fillStyle = night || dusk ? '#e9f2f0' : '#d7e3e0'; c.fillRect(bx + bw2 - 30, bb - bh + 8, 22, bh * .55); if (night) glowDot(c, bx + bw2 - 19, bb - bh * .6, 40, '#e9f2f0', '60');
        c.fillStyle = tone(phase, '#6b5a48', '#5c4d3e', '#24201c'); c.fillRect(bx + 12, bb - bh * .32, bw2 * .5, 5);
        c.fillStyle = tone(phase, '#5b646a', '#4f575c', '#2a3034'); c.fillRect(bx - 26, bb - bh * 1.25, 3, bh * 1.25); c.fillStyle = tone(phase, '#3f7f8c', '#36707c', '#1c3a40'); c.beginPath(); c.arc(bx - 24.5, bb - bh * 1.25, 9, 0, TAU); c.fill();
        // Street trees in planters, lamp posts, a bench.
        for (let i = 0; i < 4; i++) { const x = W * (.08 + i * .24) + 40; c.fillStyle = tone(phase, '#a59a86', '#8f8473', '#2c2b28'); c.fillRect(x - 22, H * .92, 44, 14); }
        viewTrees(c, W, H * .93, 4, H * .12, phase, 19);
        for (let i = 0; i < 3; i++) lampPost(c, W * (.22 + i * .3), H * .95, H * .34, phase, '#f6dca8');
        c.fillStyle = tone(phase, '#7a5c40', '#6a5038', '#24201c'); c.fillRect(W * .6, H * .84, 60, 5); c.fillRect(W * .6 + 4, H * .845, 3, 12); c.fillRect(W * .6 + 53, H * .845, 3, 12);
    }
};

// ---- Procedural station detail (no real lights) --------------------------
// Dual screens, radios, trays, scanners, plan sheets and signage for each
// role. Everything is batched per station and disposed with it.
// Rotate a local (x, z) offset by yaw (about +y).
const rotXZ = (x, z, lx, lz, yaw) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
// Desk-monitor screens repaint for the daypart (content, footer label and
// brightness); `closed` counters show a closed notice at night, `dim` scales
// the brightness per daypart (e.g. the supervisor's screen at night watch).
const SHIFT_LABELS = { operations: ['Shift briefing', 'Active watch', 'Evening watch', 'Night watch', 'Team handover'], police: ['Morning briefing', 'Case review', 'Evening shift', 'Night shift', 'Team briefing'], government: ['Daily planning', 'Public service', 'Review session', 'Quiet work', 'Team workshop'] };
function screenPlane(parent, W, H, kind, variant, size, at, rotY = 0, opts = {}) {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .32, roughness: .4 }));
    m.userData.govScreen = { kind, variant, closed: !!opts.closed, dim: opts.dim || null, phase: null };
    paintDeskScreen(m, 'afternoon');
    m.position.set(...at); m.rotation.y = rotY; parent.add(m); return m;
}
function paintDeskScreen(o, phase, gain = 1) {
    const s = o.userData.govScreen, i = phaseIndex(phase), closed = s.closed && phase === 'night';
    o.material.emissiveIntensity = (LIGHT[s.kind]?.station[i] ?? .32) * (s.dim?.[i] ?? 1) * (closed ? .55 : 1) * Math.min(gain, 1.3);
    if (s.phase === phase) return; s.phase = phase;
    const map = o.material.map, c = map.image.getContext('2d'), W = map.image.width, H = map.image.height;
    c.save(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if (closed) {
        // Counter closed: calm notice, opening hours, no queue numbers.
        screenHeader(c, W, H, `COUNTER ${s.variant === 3 ? 2 : 1}`);
        c.fillStyle = '#1e3d42'; c.fillRect(14, 56, W - 28, H - 104);
        c.fillStyle = '#e9efe9'; sans(c, 40, 600); c.fillText('CLOSED', 36, H * .48);
        c.fillStyle = '#b39b6a'; c.fillRect(38, H * .48 + 16, 130, 4);
        c.fillStyle = '#c4d3cf'; sans(c, 18); c.fillText('Open weekdays 08:30 – 16:30', 38, H * .48 + 52);
        screenFooter(c, W, H, { name: 'Quiet work', modes: {} }, phase);
    } else paintScreen(c, W, H, { kind: s.kind, accent: '#48aeb0', name: SHIFT_LABELS[s.kind]?.[i] || 'Concept', boardTitle: 'CONCEPT', modes: {} }, s.variant, phase);
    c.restore(); map.needsUpdate = true;
}
// A flat procedural monitor with stand, its screen facing +z (the user):
// bezel and chin, VESA plate, graphite stand and foot, cable and power LED.
function deskMonitor(k, parent, kind, variant, x, z, width = 540, yaw = 0, y = 0, opts) {
    const h = width * .58, cy = y + 150 + h / 2, at = (lx, lz) => rotXZ(x, z, lx, lz, yaw), r = [0, yaw, 0], steel = k.steel || k, rubber = k.rubber || k;
    k.box([width + 24, h + 24, 26], [x, cy, z], '#1a2227', r);
    k.box([width + 24, 22, 30], [at(0, 0)[0], cy - h / 2 - 1, at(0, 0)[1]], '#20292e', r);
    const hump = at(0, -24); k.box([width * .4, h * .45, 30], [hump[0], cy + 10, hump[1]], '#232c31', r);
    k.box([150, 150, 16], [at(0, -44)[0], cy, at(0, -44)[1]], '#2c353a', r);
    steel.box([34, 160, 26], [at(0, -52)[0], y + 80, at(0, -52)[1]], '#3b464d', r);
    steel.box([230, 12, 170], [at(0, -40)[0], y + 6, at(0, -40)[1]], '#3b464d', r);
    rubber.box([10, 150, 10], [at(40, -72)[0], y + 82, at(40, -72)[1]], '#15191c', r);
    const led = at(width * .44, 15); k.box([10, 4, 3], [led[0], cy - h / 2 - 4, led[1]], '#58d68d', r);
    const sp = at(0, 14); return screenPlane(parent, 512, 300, kind, variant, [width, h], [sp[0], cy, sp[1]], yaw, opts);
}
// Paper and cards: printed planes from the paper atlas when the kit carries
// material classes, plain boxes otherwise. Cell 3 is the laminated code card.
const card = (k, x, y, z, w, d, color, lines = 3, rot = 0) => {
    if (k.paper) { const cell = color === '#d9c873' ? 3 : lines >= 6 ? 5 : 4; if (cell === 3) k.box([w + 8, 1.2, d + 8], [x, y + .6, z], '#d8c968', [0, rot, 0]); paperSheet(k, cell, x, y + (cell === 3 ? .6 : 0), z, w, d, rot); return; }
    k.box([w, 2, d], [x, y + 1, z], color, [0, rot, 0]); for (let n = 0; n < lines; n++) k.box([w * .7, 1, 6], [x, y + 2.4, z - d / 2 + 16 + n * (d - 24) / Math.max(1, lines - 1)], '#5d6a70', [0, rot, 0]);
};
const sheet = (k, x, y, z, w, d, rot = 0, color = '#eeeadf', cell = 0) => k.paper ? paperSheet(k, cell, x, y, z, w, d, rot, color) : k.box([w, 1.5, d], [x, y + .8, z], color, [0, rot, 0]);
// Manila / pressboard folders with tabs, paper inside, the top one printed.
const folderStack = (k, x, y, z, n = 3, colors = ['#d8c08d', '#c9b07a', '#b8cfd8']) => {
    for (let i = 0; i < n; i++) {
        const r = [0, (i - 1) * .05, 0], fx = x + (i % 2) * 8, fz = z + i * 5, fy = y + i * 10;
        k.box([235, 3, 315], [fx, fy + 1.5, fz], colors[i % colors.length], r); k.box([226, 5, 302], [fx + 3, fy + 5.5, fz], '#efece2', r);
        k.box([235, 2, 315], [fx, fy + 9, fz], colors[i % colors.length], r); k.box([70, 2, 24], [fx - 60 + i * 40, fy + 9, fz - 166], colors[i % colors.length], r);
        if (i === n - 1 && k.paper) paperSheet(k, 0, fx + 4, fy + 9.5, fz + 4, 205, 290, r[1]);
    }
};
// Multi-bay radio charger: base, bays with LEDs, handsets and antennas.
const radioDock = (k, x, y, z, count = 4) => {
    const rubber = k.rubber || k, hpl = k.hpl || k;
    hpl.box([count * 75 + 30, 40, 110], [x, y + 20, z], '#2a3236'); k.box([count * 75 + 34, 6, 114], [x, y + 3, z], '#15191c');
    for (let n = 0; n < count; n++) {
        const px = x - (count - 1) * 37.5 + n * 75;
        k.box([60, 6, 40], [px, y + 41, z], '#11161a');
        rubber.box([52, 150, 32], [px, y + 105, z], '#1d2427'); rubber.box([10, 60, 10], [px + 14, y + 210, z], '#1d2427'); k.box([8, 18, 8], [px - 12, y + 190, z], '#3a4247');
        k.box([36, 40, 2], [px, y + 120, z + 17], '#2b3a42'); k.box([14, 6, 4], [px - 10, y + 44, z + 56], n % 3 ? '#45d07a' : '#e6a43c');
    }
};
function stationDetailBase(spec, mount, THREE_, { role: mountRole, sceneId }) {
    const kind = KIND[sceneId], role = spec.role, k = ck(kind), M = stationMats(kind), half = spec.size === '60x30' ? 762 : 610;
    if (mountRole === 'shelf') {
        // Operator consoles carry two generic flat screens on the rear shelf.
        if (role === 'operator') { deskMonitor(k, mount, kind, 10 + (spec.id === 'operator-3' ? 2 : 0), -290, 0, 540, .12); deskMonitor(k, mount, kind, 11 + (spec.id === 'operator-3' ? 2 : 0), 290, 0, 540, -.12); tag(k, spec.id === 'operator-3' ? 'CONSOLE 3' : 'CONSOLE 2', [150, 38], [0, 40, 60]); }
        if (role === 'supervisor') { deskMonitor(k, mount, kind, 15, 0, 0, 680, 0, 0, { dim: [1, 1, .85, .5, 1] }); tag(k, 'SUPERVISOR', [170, 42], [-470, 40, 60]); }
        if (role === 'analyst') { deskMonitor(k, mount, kind, kind === 'police' ? 2 : 11, -290, 0, 540, .12); deskMonitor(k, mount, kind, kind === 'police' ? 0 : 12, 290, 0, 540, -.12); }
        if (role === 'sergeant') { deskMonitor(k, mount, kind, 1, -170, 0, 540, .06); radioDock(k, 420, 0, 0, 2); }
        if (role === 'huddle') {
            // Mobile pin-up board: felt face, aluminium frame, sticky notes and printed sheets.
            k.fabric.box([900, 520, 18], [0, 330, -10], '#dcd6c8');
            for (const y of [70, 590]) k.brushed.box([930, 20, 26], [0, y, -10], '#b9c0c2'); for (const x of [-455, 455]) k.brushed.box([20, 540, 26], [x, 330, -10], '#b9c0c2');
            for (let n = 0; n < 12; n++) k.box([75, 75, 4], [-330 + n % 6 * 130, 450 - Math.floor(n / 6) * 150, 2], ['#f2d36b', '#9fd0b4', '#f0a98f', '#a9c7e6'][n % 4], [0, 0, (rnd(n) - .5) * .12]);
            k.paper.add(atlasPlane(210, 150, 4, 4, 2), [300, 170, 1], '#ffffff', [1, 1, 1], [0, 0, .04]); k.paper.add(atlasPlane(150, 210, 5, 4, 2), [-330, 180, 1], '#ffffff', [1, 1, 1], [0, 0, -.05]);
            k.steel.box([30, 330, 30], [-420, 165, -10], '#6f7a72'); k.steel.box([30, 330, 30], [420, 165, -10], '#6f7a72');
        }
        if (role === 'lectern') {
            // Briefing laptop: aluminium base, keyboard deck and a lid leaning back
            // 15 deg; its screen shows the daypart's briefing slide ("BRIEFING 09:00").
            const a = .26;
            k.brushed.box([330, 16, 230], [0, 8, 10], '#9aa4ab'); k.box([296, 2, 112], [0, 17, -6], '#1b2024'); k.box([90, 1, 60], [0, 17, 88], '#7d878c');
            k.brushed.box([330, 220, 8], [0, 16 + 110 * Math.cos(a), -105 - 110 * Math.sin(a)], '#9aa4ab', [-a, 0, 0]);
            const sp = screenPlane(mount, 512, 300, kind, 20, [300, 186], [0, 16 + 110 * Math.cos(a) + 5 * Math.sin(a), -105 - 110 * Math.sin(a) + 5 * Math.cos(a)], 0, { dim: [1.5, 1.2, 1.2, .8, 1.5] });
            sp.rotation.x = -a;
        }
        if (role === 'plan') { k.add(new THREE.CylinderGeometry(45, 45, 620, 16), [0, 45, 40], '#c9b48a', [1, 1, 1], [0, 0, Math.PI / 2]); for (const x of [-315, 315]) k.add(new THREE.CylinderGeometry(47, 47, 30, 16), [x, 45, 40], '#5a6a63', [1, 1, 1], [0, 0, Math.PI / 2]); }
        if (role === 'counter' || role === 'intake' || role === 'dispatch') deskMonitor(k, mount, kind, role === 'dispatch' ? 15 : role === 'intake' ? 0 : spec.counter === 2 ? 3 : 0, 0, 0, 520, 0, 0, { closed: role === 'counter' });
        if (role === 'counter' || role === 'intake') {
            // Visitor-facing number plate on a post behind the counter screen.
            k.brushed.box([24, 640, 24], [0, 320, -75], '#8e989e'); k.steel.box([360, 150, 12], [0, 640, -70], '#26393c');
            k.steel.box([160, 10, 120], [0, 5, -75], '#4c5a63');
        }
        const built = k.build(mount, M);
        if (role === 'counter' || role === 'intake') counterPlate(mount, spec, kind);
        return built;
    }
    // Desktop detail per role. Local frame: +z toward the user, y up from the top.
    if (role === 'operator' || role === 'analyst' || role === 'dispatch') {
        card(k, -half + 260, 0, 150, 130, 95, '#d9c873', 4, .2);   // laminated radio-code card
        k.rubber.cyl(40, 40, 4, [half - 180, 1, 200], '#3a3f42');     // coaster
        // Grommet and a tidy cable bundle dropping to the tray.
        k.cyl(32, 32, 3, [-half + 140, 1.5, -300], '#15191c'); k.rubber.cyl(14, 14, 3, [-half + 140, 2.5, -300], '#2a2f33');
    }
    if (role === 'operator') {
        // Under-desk steel cable tray with cables, cable ties, a power strip with lit switches and a headset hook.
        k.steel.box([1000, 10, 140], [0, -215, -260], '#262e33'); for (const z of [-330, -190]) k.steel.box([1000, 80, 6], [0, -175, z], '#262e33');
        for (let n = 0; n < 5; n++) k.rubber.box([14, 12, 980], [0, -202, -310 + n * 22], ['#3e8fa0', '#2b3338', '#c56d4f', '#2b3338', '#4c9c6b'][n], [0, Math.PI / 2, 0]);
        for (let n = 0; n < 4; n++) k.box([8, 30, 70], [-420 + n * 280, -196, -260], '#e6e6e0');
        k.steel.box([360, 40, 50], [200, -185, -300], '#d8dadb'); for (let n = 0; n < 4; n++) k.box([20, 6, 14], [80 + n * 80, -163, -300], n === 0 ? '#e0483f' : '#20262a');
        k.brushed.box([20, 110, 20], [half - 30, -60, -200], '#9aa4ab'); k.brushed.box([20, 20, 70], [half - 30, -110, -170], '#9aa4ab');
    }
    if (role === 'dispatch') { radioDock(k, 380, 0, -230, 3); card(k, 120, 0, -20, 220, 150, '#eae6da', 5); tag(k, 'RADIOS · CHARGE', [180, 40], [380, 70, -172]); }
    if (role === 'supervisor') {
        card(k, 260, 0, -160, 297, 210, '#efece4', 6, -.08); k.hpl.box([180, 60, 120], [-620, 30, -230], '#2b3336'); k.box([12, 4, 6], [-560, 61, -175], '#45d07a'); paperSheet(k, 1, 240, 2, -150, 210, 297, -.08);
        // Supervisor's tablet, lit, showing the site plan (dimmed at night watch).
        k.rubber.box([318, 9, 226], [-430, 4.5, 60], '#1d2427', [0, .1, 0]); k.box([300, 1, 6], [-430, 9.5, -46], '#11161a', [0, .1, 0]);
        const tab = screenPlane(mount, 384, 256, kind, 13, [282, 192], [-430, 9.8, 62], 0, { dim: [1.6, 1.3, 1.3, .7, 1.5] }); tab.rotation.set(-Math.PI / 2, 0, .1);
    }
    if (role === 'incident' || role === 'lectern' || role === 'plan') {
        // A large generic site-plan sheet with markups lies flat on the tilted top.
        const sheetW = role === 'lectern' ? 420 : 840, sheetD = role === 'lectern' ? 297 : 594;
        k.box([sheetW + 10, 1, sheetD + 10], [60, .5, -20], '#d9d4c6', [0, .03, 0]);
        sheet(k, 60, .6, -20, sheetW, sheetD, .03, '#ffffff', role === 'lectern' ? 5 : 2);
        for (let n = 0; n < 4; n++) k.box([10, 4, 10], [60 + (n % 2 - .5) * (sheetW - 30), 3, -20 + (Math.floor(n / 2) - .5) * (sheetD - 30)], '#c0392b');   // magnets / tape
        if (role !== 'lectern') { k.cyl(6, 6, 140, [380, 5, 120], '#c0392b'); k.cyl(6, 6, 140, [410, 5, 120], '#1f3f8a'); }
    }
    if (role === 'sergeant') { k.rubber.box([150, 85, 90], [560, 42, 140], '#151a1d'); k.rubber.box([150, 10, 92], [560, 88, 140], '#262d31'); k.brushed.box([60, 8, 4], [560, 60, 186], '#9aa4ab'); radioDock(k, 0, 0, -250, 4); folderStack(k, -170, 0, -150, 2); card(k, -420, 0, 120, 150, 210, '#f0ece0', 4, .12); }
    if (role === 'report' || role === 'casefile') { folderStack(k, role === 'report' ? 120 : -20, 0, -140, role === 'report' ? 2 : 4); card(k, -420, 0, 140, 150, 210, '#f0ece0', 6); if (role === 'casefile') paperSheet(k, 7, 260, 0, 150, 210, 297, .1); }
    if (role === 'intake' || role === 'counter') {
        // Visitor side is local -z. Transaction shelf at about 1050 mm from the floor for the seated counters.
        const deskTop = spec.height * 25.4, shelfY = spec.height < 40 ? Math.max(260, 1050 - deskTop) : 40, z = -381 - 150;
        if (spec.height < 40) {
            if (role === 'intake') k.hpl.box([half * 2 - 120, 30, 300], [0, shelfY, z], '#c7c3b8'); else k.oak.box([half * 2 - 120, 30, 300], [0, shelfY, z], '#ffffff');
            k.box([half * 2 - 116, 32, 4], [0, shelfY, z - 152], role === 'intake' ? '#3b4650' : '#b39b6a');
            for (const x of [-half + 120, half - 120]) { k.brushed.box([30, shelfY, 30], [x, shelfY / 2, z + 120], '#9aa4ab'); k.brushed.box([90, 8, 90], [x, shelfY - 18, z + 100], '#9aa4ab'); }
        }
        const top = spec.height < 40 ? shelfY + 30 : 0, zz = spec.height < 40 ? z : -250;
        k.brushed.cyl(12, 12, 6, [-200, top + 3, zz + 40], '#7d878c');                                  // pen chain base
        for (let n = 0; n < 6; n++) k.brushed.ball(4, [-200 + n * 18, top + 4, zz + 40 + n * 6], '#8d979c');
        k.cyl(5, 4, 140, [-90, top + 6, zz + 70], '#1d2a52');
        if (role === 'intake') { k.steel.box([120, 220, 120], [half - 170, top + 110, zz], '#d0d4d6'); k.box([90, 30, 10], [half - 170, top + 170, zz - 61], '#2d3133'); k.box([70, 4, 30], [half - 170, top + 100, zz - 66], '#efe9dc'); paperSheet(k, 0, 80, top, zz + 20, 210, 297, .06); }
        else {
            k.oak.box([200, 70, 50], [half - 220, top + 35, zz], '#ffffff'); tag(k, spec.counter === 2 ? 'COUNTER 2' : 'COUNTER 1', [180, 42], [half - 220, top + 40, zz - 26], [0, Math.PI, 0]);   // name block
            k.brushed.cyl(45, 55, 30, [-half + 160, top + 15, zz], '#b39b6a'); k.brushed.ball(16, [-half + 160, top + 40, zz], '#d9c08a'); // service bell
            k.box([110, 20, 70], [-half + 300, 10, 150], '#2a3b3f'); k.oak.cyl(20, 26, 70, [-half + 300, 55, 150], '#8a6a4a'); k.rubber.box([90, 6, 60], [-half + 300, 22, 150], '#20262a'); // stamp + pad
            paperSheet(k, 0, 120, top, zz + 10, 210, 297, -.05);
        }
    }
    if (role === 'records') { folderStack(k, -280, 0, -170, 3); card(k, 160, 0, 170, 297, 210, '#f1ede2', 6, .05); }
    if (role === 'consult' || role === 'language') { card(k, -420, 0, -60, 297, 210, '#f1ede2', 5, -.1); k.box([160, 120, 20], [420, 60, -260], '#395d60'); tag(k, role === 'consult' ? 'APPOINTMENTS' : 'SERVICE CENTRE', [150, 38], [420, 60, -249]); }
    if (role === 'huddle') for (let n = 0; n < 9; n++) k.box([75, 2, 75], [-560 + n % 3 * 85, 1, -170 + Math.floor(n / 3) * 85], ['#f2d36b', '#9fd0b4', '#f0a98f'][n % 3], [0, (rnd(n) - .5) * .3, 0]);
    return k.build(mount, M);
}
// Station hook: role detail, then the station's light (a task pool on the
// desktop, the console screens' spill, the records lead's LED lamp), set to
// the room's current daypart (stations are added after the room build).
export function stationDetail(spec, mount, T, ctx) {
    const built = stationDetailBase(spec, mount, T, ctx), kind = KIND[ctx.sceneId], role = spec.role, half = spec.size === '60x30' ? 762 : 610;
    if (ctx.role === 'desktop') {
        const levels = STATION_POOL[kind]?.[role];
        if (levels) mount.add(poolPlane([half * 2 - 60, 700], TASK_COLOR[kind], levels, [0, 2, 20]));
        if (kind === 'operations' && ['operator', 'analyst', 'dispatch'].includes(role)) mount.add(poolPlane([half * 2 - 100, 360], '#86d3dc', SCREEN_SPILL, [0, 2.5, -190]));
        if (role === 'records') {
            // Compact LED arm lamp at the back-left corner: on into the evening.
            const k = ck(kind), x = -half + 150;
            k.steel.cyl(60, 66, 14, [x, 7, -290], '#3a3f42'); k.steel.box([14, 360, 14], [x, 190, -290], '#5b6266'); k.steel.box([260, 22, 60], [x + 120, 368, -270], '#3a3f42');
            k.build(mount, stationMats(kind));
            mount.add(lensMesh(new THREE.BoxGeometry(230, 4, 44), '#fff0d6', [.1, .1, .7, 1, .35], [x + 120, 356, -270]));
            mount.add(poolPlane([600, 560], '#ffe2b8', [.02, .02, .14, .24, .06], [x + 180, 2.2, -90]));
        }
    }
    applyPhase(mount, phaseOf(mount));
    return built;
}
// Counter number / accessibility plate on the visitor side of a counter shelf.
function counterPlate(mount, spec, kind) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 108; const c = canvas.getContext('2d');
    const police = kind === 'police';
    c.fillStyle = police ? '#234e72' : '#395d60'; c.fillRect(0, 0, 256, 108);
    c.fillStyle = '#f2f1ea'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '600 30px sans-serif'; c.fillText(police ? 'FRONT COUNTER' : `COUNTER ${spec.counter || 1}`, 128 - (spec.accessible ? 22 : 0), police ? 40 : 52, 200);
    if (police) { c.font = '600 15px sans-serif'; c.fillStyle = '#d9b44a'; c.fillText('PLEASE WAIT TO BE CALLED', 128, 80, 230); }
    if (spec.accessible) { c.strokeStyle = '#f2f1ea'; c.lineWidth = 5; c.beginPath(); c.arc(222, 62, 18, .3, Math.PI * 1.8); c.stroke(); c.beginPath(); c.arc(222, 30, 6, 0, 7); c.fill(); c.fillRect(219, 36, 6, 24); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(344, 140), new THREE.MeshStandardMaterial({ map, roughness: .6 }));
    m.position.set(0, 640, -77); m.rotation.y = Math.PI; mount.add(m);
}
// Procedural detail on the visitor's live main desk.
export function mainDeskDetail({ sceneId, role, THREE: T, add }) {
    const kind = KIND[sceneId], k = ck(kind), g = new T.Group();
    if (role === 'desktop') {
        if (sceneId === 'security') { card(k, 430, 0, 150, 130, 95, '#d9c873', 4, -.15); paperSheet(k, 1, -470, 0, 175, 150, 210, .08); k.rubber.cyl(40, 40, 4, [500, 1, -110], '#3a3f42'); }
        if (sceneId === 'police') { folderStack(k, 380, 0, -170, 3); card(k, -260, 0, 170, 150, 210, '#f0ece0', 6, .1); }
        if (sceneId === 'government') {
            k.box([110, 20, 70], [-360, 10, 170], '#2a3b3f'); k.rubber.box([90, 6, 56], [-360, 22, 170], '#20262a'); k.oak.cyl(20, 26, 70, [-230, 35, 170], '#8a6a4a'); k.box([60, 14, 50], [-230, 7, 170], '#3a4448');
            k.oak.box([180, 60, 45], [130, 30, -230], '#ffffff'); paperSheet(k, 0, -520, 0, 120, 210, 297, .1);
        }
    } else if (role === 'shelf' && sceneId === 'security') {
        deskMonitor(k, g, 'operations', 0, -300, 0, 560, .12); deskMonitor(k, g, 'operations', 13, 300, 0, 560, -.12); tag(k, 'CONSOLE 1', [150, 38], [0, 40, 60]);
    } else if (role === 'shelf') {
        deskMonitor(k, g, kind, sceneId === 'police' ? 0 : 1, -40, 0, 600);
        if (sceneId === 'police') radioDock(k, 420, 0, 0, 1);
        else {
            // Oak desktop file sorter: base, three dividers and standing folders.
            k.oak.box([220, 14, 170], [450, 7, 0], '#ffffff'); for (let n = 0; n < 3; n++) k.oak.box([220, 200 - n * 40, 10], [450, 14 + (200 - n * 40) / 2, -60 + n * 60], '#efe3d0');
            for (let n = 0; n < 3; n++) { k.box([200, 230 - n * 40, 5], [450, 14 + (230 - n * 40) / 2, -35 + n * 60], ['#cfdcd2', '#d8c08d', '#c7d6e0'][n]); k.box([190, 210 - n * 40, 8], [450, 14 + (210 - n * 40) / 2, -28 + n * 60], '#efece2'); }
        }
    }
    // Task-light pool on the main desktop (from the downlight / pendant above
    // it) and, on the security console, the screens' cool spill.
    if (role === 'desktop') {
        g.add(poolPlane([1100, 700], TASK_COLOR[kind], MAIN_POOL[kind], [0, 2, 20]));
        if (kind === 'operations') g.add(poolPlane([1100, 360], '#86d3dc', SCREEN_SPILL, [0, 2.5, -190]));
    }
    if (!k.build(g, stationMats(kind)) && !g.children.length) return;
    // Follow the daypart: the dressing loads after the room build, so it takes
    // the scene's current phase and is updated by atmosphere() from then on.
    MAIN_DETAIL.push({ g, sceneId }); applyPhase(g, CURRENT[sceneId] || { phase: 'morning', gain: 1 });
    add(g);
}

// ---- Lighting practicals (no extra real lights) ---------------------------
// Additive pools: a soft radial falloff quad (additive blending, no depth
// write, no shadows) whose colour × level follows the daypart. It fakes a
// fixture's light landing on a floor, wall, board or desktop. Emissive
// fixtures carry their own 5-level arrays. Pools, glows and desk screens carry
// their levels in userData (govPool / govGlow / govScreen), so room, station
// and main-desk detail are all updated by applyPhase().
const TASK_COLOR = { operations: '#ffe6c6', police: '#fff0dc', government: '#ffe8c8' };
const MAIN_POOL = { operations: [.05, .04, .13, .2, .09], police: [.05, .05, .15, .17, .1], government: [.05, .05, .15, .2, .1] };
const SCREEN_SPILL = [0, 0, .03, .07, .02];
// Station desktop pools by role [m, a, e, n, p]. Night: SOC consoles on and
// the supervisor dimmed; squad-room bench and sergeant on; government counters
// closed (off), records lead on.
const STATION_POOL = {
    operations: { operator: [.05, .04, .13, .2, .09], analyst: [.05, .04, .13, .18, .09], dispatch: [.05, .04, .13, .2, .09], supervisor: [.05, .04, .11, .06, .09], incident: [.06, .05, .12, .08, .1] },
    police: { report: [.05, .05, .15, .17, .1], analyst: [.05, .05, .15, .16, .1], casefile: [.05, .05, .15, .12, .1], sergeant: [.05, .05, .15, .17, .1], intake: [.05, .05, .13, .04, .09], lectern: [.06, .05, .12, .02, .13] },
    government: { plan: [.05, .05, .13, 0, .1], records: [.04, .04, .14, .18, .1], counter: [.05, .05, .13, 0, .09], huddle: [.05, .05, .13, 0, .12], consult: [.04, .04, .14, 0, .1], language: [.04, .04, .14, 0, .1] }
};
const MAIN_DETAIL = [], CURRENT = {};
const FACES = { floor: [-Math.PI / 2, 0, 0], back: [0, 0, 0], right: [0, -Math.PI / 2, 0], left: [0, Math.PI / 2, 0] };
let POOL_MAP = null;
function poolMap() {
    if (POOL_MAP) return POOL_MAP;
    POOL_MAP = institutionalMap((c, W, H) => {
        const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ffffffc8'); g.addColorStop(.55, '#ffffff5c'); g.addColorStop(.8, '#ffffff16'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 128, 128);
    POOL_MAP.wrapS = POOL_MAP.wrapT = THREE.ClampToEdgeWrapping; return POOL_MAP;
}
// One pool quad (own geometry: stations dispose their trees).
function poolPlane([sx, sy], color, levels, at, face = 'floor') {
    const m = new THREE.MeshBasicMaterial({ map: poolMap(), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.sharedTextures = true;
    const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); o.name = 'Light pool'; o.scale.set(sx, sy, 1); o.position.set(...at);
    o.rotation.set(...(Array.isArray(face) ? face : FACES[face])); o.renderOrder = 2; o.castShadow = o.receiveShadow = false;
    o.raycast = noRay; o.userData.govPool = { color: new THREE.Color(color), levels }; return o;
}
// Room pools live in one overlay layer (not furniture: no Groove obstacle,
// no collider, no ray hits, never enlarging an asset's bounds). A pool that
// belongs to an asset (a table top, a wall board) copies the asset's world
// transform just before drawing, so it follows a rearranged or cut-away asset.
function poolLayer(kit) {
    if (!kit.govPools) { const g = kit.govPools = new THREE.Group(); g.name = 'Daylight and lamp light pools'; g.userData.grooveMarker = true; kit.root.add(g); }
    return kit.govPools;
}
const noRay = () => {};
const addPool = (kit, parent, at, size, color, levels, face) => {
    if (!parent) return null;
    const o = poolPlane(size, color, levels, at, face), layer = poolLayer(kit);
    if (parent !== kit.root) {
        o.updateMatrix(); const local = o.matrix.clone(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
        o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false;
        o.onBeforeRender = () => { let shown = true; for (let q = parent; q; q = q.parent) if (!q.visible) { shown = false; break; } o.matrixWorld.multiplyMatrices(parent.matrixWorld, shown && parent.parent ? local : zero); };
    }
    layer.add(o); return o;
};
// Emissive fixture lens (a mesh whose emissive follows the daypart).
function lensMesh(geometry, color, levels, at, rot = [0, 0, 0]) {
    const o = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: levels[0], roughness: .4 }));
    o.position.set(...at); o.rotation.set(...rot); o.castShadow = false; o.userData.govGlow = levels; return o;
}
function applyPhase(root, { phase, gain = 1 }) {
    const i = phaseIndex(phase);
    root.traverse(o => {
        const p = o.userData.govPool; if (p) { const v = p.levels[i] * gain; o.material.color.copy(p.color).multiplyScalar(v); o.visible = v > .003; }
        const g = o.userData.govGlow; if (g) o.material.emissiveIntensity = g[i] * gain;
        if (o.userData.govScreen) paintDeskScreen(o, phase, gain);
    });
}
const phaseOf = node => { for (let n = node; n; n = n.parent) if (n.userData.govPhase) return n.userData.govPhase; return { phase: 'morning', gain: 1 }; };
const attached = node => { let n = node; while (n.parent) n = n.parent; return !!n.isScene; };

// Shell ceiling: the shell's three linear fixtures are restyled per scene the
// first time atmosphere() runs (the ceiling group is built after decorate()).
// Security: cove strips at 40 % length. Police: 4000K linears suspended at
// 2600 on cables. Government: oak-trimmed linears suspended at 2650. Each strip
// gets its own lens material so the rear strip can stay on at night. The
// group's own ceiling fixtures (downlights, globes) move into the same group,
// so they hide with the camera cutaway like the shell strips.
function ensureCeiling(kit) {
    const ceil = kit.room?.ceilingFixture; if (!ceil || kit.govStrips) return;
    const kind = kit.spec.kind, L = LIGHT[kind], strips = kit.govStrips = [];
    const kids = ceil.children.filter(o => o.isMesh).slice(0, 6), extra = new THREE.Group(); extra.name = 'Suspension and trims';
    for (let n = 0; n < 3; n++) {
        const housing = kids[n * 2], lens = kids[n * 2 + 1]; if (!housing || !lens) continue;
        const m = lens.material.clone(); lens.material = m; strips.push({ m, levels: L.ceiling[1][Math.min(n, L.ceiling[1].length - 1)] });
        lens.castShadow = housing.castShadow = false;
        if (kind === 'operations') { housing.scale.x = lens.scale.x = .4; continue; }
        const y = kind === 'police' ? 2600 : 2650, z = housing.position.z, len = kit.w * .68;
        housing.position.y = y + 29; lens.position.y = y;
        for (const x of [-len * .4, len * .4]) kit.rod(extra, [x, y + 54, z], [x, kit.ceiling - 4, z], 3, kit.metal).castShadow = false;
        for (const x of [-len * .4, len * .4]) kit.box(extra, [80, 10, 80], [x, kit.ceiling - 5, z], kit.metal, 3).castShadow = false;
        if (kind === 'government') for (const s of [-1, 1]) kit.box(extra, [len + 20, 64, 20], [0, y + 26, z + s * 85], kit.oak, 4).castShadow = false;
    }
    ceil.add(extra);
    if (kit.govCeil) ceil.add(kit.govCeil);
}
// Window daylight patch on the floor: the glazing silhouette projected along
// the shared rig's sun direction (room-refinement DAY_ANGLES) and clipped to
// the room. The blinds cut it: blackout fabric stops it (security keeps the
// sill slot), venetian slats and sheer fabric let part through.
const SUN_ANGLE = { morning: [.62, -.36], afternoon: [1.45, .12], evening: [.32, .48], night: null, party: [1.35, .25] };
const BLIND_PASS = { operations: 0, police: .3, government: .5 };
function sunPatch(kit) {
    const { w, d, bz, front } = kit, z0 = bz + d * .54, half = d * .24, pass = BLIND_PASS[kit.spec.kind] ?? .5;
    const map = tex((c, W, H) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, W, H); c.filter = 'blur(14px)'; c.fillStyle = '#ffffff';
        for (const [x0, x1] of [[.05, .48], [.52, .95]]) c.fillRect(x0 * W, H * .06, (x1 - x0) * W, H * .88);
        c.filter = 'none';
    }, 512, 256);
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.PlaneGeometry(1, 1, 8, 36); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const sun = new THREE.Mesh(geo, mat); sun.name = 'Window daylight patch'; sun.renderOrder = 2; sun.castShadow = sun.receiveShadow = false; sun.frustumCulled = false; sun.raycast = noRay; poolLayer(kit).add(sun);
    kit.govSun = (phase, color, strength, drop) => {
        const angle = SUN_ANGLE[phase]; sun.visible = !!angle && strength > .01; if (!sun.visible) return;
        const [elevation, sweep] = angle, bottom = 2560 - Math.max(1, Math.min(1690, 1750 * drop)), pos = geo.attributes.position, uv = geo.attributes.uv, col = geo.attributes.color;
        for (let i = 0; i < pos.count; i++) {
            // uv.y = 1 at the window head (2600), 0 at the sill (800).
            const y = 800 + uv.getY(i) * 1800, z = z0 - half + uv.getX(i) * half * 2, t = y / elevation, x = -w / 2 + 25 + t, zz = z + sweep * t;
            const inside = x < w / 2 - 40 && zz > bz + 30 && zz < front - 30 ? 1 - .25 * uv.getY(i) : 0, through = y > bottom + 40 ? pass : y > bottom - 40 ? pass + (1 - pass) * (bottom + 40 - y) / 80 : 1;
            pos.setXYZ(i, Math.min(x, w / 2 - 40), 10, THREE.MathUtils.clamp(zz, bz + 30, front - 30)); col.setXYZ(i, inside * through, inside * through, inside * through);
        }
        pos.needsUpdate = col.needsUpdate = true; geo.computeBoundingSphere();
        mat.color.set(color).multiplyScalar(strength);
    };
}
// A slim linear picture light / wall-washer on two arms (local frame of a wall
// asset: +z into the room, the wall behind at -z): housing, downward lens and
// a soft scallop on the wall or artwork below it.
function linearWasher(kit, parent, { y, span, out = 150, wall = -60, levels, color = '#fff0d8', pool = [span * 1.3, 1500], poolY = y - 600, poolZ = 26, finish = '#2f3438' }) {
    const g = new THREE.Group(); g.name = 'Picture light'; parent.add(g);
    const metal = kit.material(finish, { metalness: .55, roughness: .38 });
    kit.box(g, [span, 34, 64], [0, y, out], metal, 6).castShadow = false;
    g.add(lensMesh(new THREE.BoxGeometry(span - 30, 5, 40), '#fff3df', levels.map(v => .1 + v * 4), [0, y - 18, out]));
    for (const x of [-span * .36, span * .36]) { kit.rod(g, [x, y + 6, wall + 2], [x, y + 6, out - 20], 6, metal).castShadow = false; kit.box(g, [50, 70, 10], [x, y + 6, wall + 5], metal, 2).castShadow = false; }
    addPool(kit, g, [0, poolY, poolZ], pool, color, levels, 'back');
    return g;
}
// Ceiling-mounted fixtures (downlight discs, globes) are built into
// kit.govCeil and join the shell's ceiling group in ensureCeiling().
function ceilingGroup(kit) { if (!kit.govCeil) { kit.govCeil = new THREE.Group(); kit.govCeil.name = 'Group ceiling practicals'; kit.root.add(kit.govCeil); } return kit.govCeil; }
function downlight(kit, x, z, levels, r = 60) {
    const g = ceilingGroup(kit), y = kit.ceiling - 2;
    kit.mesh(g, new THREE.CylinderGeometry(r + 22, r + 22, 10, 24), kit.govMats.dark, [x, y - 4, z]).castShadow = false;
    g.add(lensMesh(new THREE.CircleGeometry(r, 24), '#fff4e4', levels, [x, y - 10, z], [Math.PI / 2, 0, 0]));
}
// Seat point for a desk at [x, z] turned `turn` degrees (+z local toward the user).
const seatAt = ([x, z], turn = 0, off = 600) => { const a = turn * Math.PI / 180; return [x + Math.sin(a) * off, z + Math.cos(a) * off]; };
function lightFixtures(kit) {
    const { w, d, bz, front, spec, layout, byId } = kit, kind = spec.kind, stations = layout.stations || [];
    const ws0 = byId('workstation-0'), act = byId('activity-table'), task = TASK_COLOR[kind];
    const strips = [0, 1, 2].map(n => bz + d * (.2 + n * .29));
    // The room's own work tables carry a task pool on their tops.
    if (ws0) addPool(kit, ws0, [0, 743, 0], [1750, 1050], task, kind === 'police' ? [.05, .05, .15, .17, .1] : kind === 'operations' ? [.05, .04, .13, .2, .09] : [.05, .05, .15, .18, .1]);
    if (kind === 'operations') {
        if (ws0) addPool(kit, ws0, [0, 743.5, -250], [1400, 420], '#86d3dc', SCREEN_SPILL);
        // Ø120 downlights over every console seat (main desk, console table,
        // operator consoles, dispatch) and the supervision row; floor pools below.
        const consoles = [[layout.desk, 0], ...(ws0 ? [[[ws0.position.x, ws0.position.z], 0]] : []), ...stations.filter(s => ['operator', 'analyst', 'dispatch'].includes(s.role)).map(s => [s.at, s.turn || 0])];
        for (const [at, turn] of consoles) {
            const [x, z] = seatAt(at, turn, 380), [fx, fz] = seatAt(at, turn, 650);
            downlight(kit, x, z, [.5, .45, .9, 1.15, .8]); addPool(kit, kit.root, [fx, 9, fz], [1700, 1700], '#ffe4c0', [.04, .03, .1, .15, .07]);
        }
        for (const s of stations.filter(s => ['supervisor', 'incident'].includes(s.role))) {
            const [x, z] = seatAt(s.at, s.turn || 0, 300); downlight(kit, x, z, [.5, .45, .8, .3, .8]); addPool(kit, kit.root, [x, 9, z], [1500, 1500], '#ffe4c0', [.03, .025, .08, .03, .06]);
        }
        // Video wall: bias-light spill on the wall round the frame and a faint
        // cyan wash on the floor in front of it (stronger as the room darkens).
        const vw = byId('overview');
        if (vw) addPool(kit, vw, [0, 100, -60], [4300, 2500], '#4fbfc4', [.05, .04, .09, .16, .07], 'back');
        addPool(kit, kit.root, [0, 9, bz + 1050], [3600, 1700], '#62c6cc', [.015, .015, .035, .07, .03]);
        // Briefing table (activity) pool: on for briefing and handover.
        if (act) addPool(kit, act, [0, 744, 0], [1700, 1100], '#fff0d8', [.14, .05, .08, .02, .18]);
        // Night: sodium perimeter light leaks through the blind's sill slot.
        addPool(kit, kit.root, [-w / 2 + 260, 9, bz + d * .54], [700, d * .5], '#e8b56a', [0, 0, .03, .1, 0]);
        // The incident status board on the door wall gets a soft wash.
        const board = byId('incident-board'); if (board) linearWasher(kit, board, { y: 560, span: 1300, levels: [.1, .07, .13, .07, .15], color: '#f4eadb', pool: [1900, 1300], poolY: 120, poolZ: 22, wall: -30 });
    } else if (kind === 'police') {
        // Suspended 4000K linears: long soft pools below; only the rear one
        // (over the report-writing bench) stays on at night.
        strips.forEach((z, n) => addPool(kit, kit.root, [0, 9, z], [w * .74, 1800], '#f3f1ea', n ? [.03, .025, .08, 0, .08] : [.03, .025, .08, .05, .08]));
        // Picture-light bar over the beat map / roster board, and over the
        // briefing display (M/L).
        linearWasher(kit, kit.board, { y: 585, span: 2000, levels: [.07, .05, .18, .05, .2], color: '#fff0da', pool: [2700, 1500], poolY: 100, poolZ: 28 });
        const disp = byId('briefing-display'); if (disp) linearWasher(kit, disp, { y: 585, span: 2000, levels: [.12, .06, .14, .02, .24], color: '#fff0da', pool: [2700, 1500], poolY: 100, poolZ: 28, wall: -35 });
        if (act) addPool(kit, act, [0, 744, 0], [1700, 1100], '#fff0d8', [.12, .08, .14, .03, .16]);
        // Emergency exit sign: green glow on the wall and the floor by the door (always on).
        const exit = byId('exit-sign'); if (exit) addPool(kit, exit, [0, -60, -36], [1100, 900], '#3ccf7c', [.02, .015, .04, .1, .03], 'back');
        addPool(kit, kit.root, [w / 2 - 520, 9, front - 1600], [1000, 1400], '#3ccf7c', [0, 0, .012, .04, .008]);
    } else {
        strips.forEach((z, n) => addPool(kit, kit.root, [0, 9, z], [w * .74, 1700], '#fff0dc', n ? [.025, .02, .07, 0, .07] : [.03, .025, .08, 0, .08]));
        // Opal globes over the public counters (off when the counters close).
        for (const s of stations.filter(s => s.role === 'counter')) {
            const [x, z] = s.at, gy = kit.ceiling - 760, g = ceilingGroup(kit);
            g.add(lensMesh(new THREE.SphereGeometry(165, 28, 18), '#fff1dc', [.28, .22, .95, .05, .7], [x - 140, gy, z]));
            kit.rod(g, [x - 140, gy + 165, z], [x - 140, kit.ceiling - 4, z], 3, kit.metal).castShadow = false;
            kit.mesh(g, new THREE.CylinderGeometry(55, 55, 18, 20), kit.govMats.sage, [x - 140, kit.ceiling - 9, z]).castShadow = false;
            kit.mesh(g, new THREE.CylinderGeometry(30, 60, 50, 20), kit.material('#b39b6a', { metalness: .6, roughness: .35 }), [x - 140, gy + 175, z]).castShadow = false;
            addPool(kit, kit.root, [x, 9, z], [2100, 2100], '#ffe2bd', [.04, .03, .12, 0, .09]);
        }
        // Wall-washer on the service board (stays on after hours) and a picture
        // light on the community gallery.
        linearWasher(kit, kit.board, { y: 590, span: 2000, levels: [.06, .04, .18, .16, .16], color: '#fff0d8', pool: [2800, 1700], poolY: 100, poolZ: 28, finish: '#b39b6a' });
        const gal = byId('identity-gallery'); if (gal) linearWasher(kit, gal, { y: 470, span: 1800, levels: [.04, .03, .17, .05, .14], color: '#ffe6c4', pool: [2500, 1300], poolY: -20, poolZ: 30, wall: -30, finish: '#b39b6a' });
        if (act) addPool(kit, act, [0, 744, 0], [1700, 1100], '#ffecd2', [.08, .05, .1, 0, .15]);
    }
    sunPatch(kit);
}

// ---- Builder hooks -------------------------------------------------------
export function options(spec) {
    const ops = spec.kind === 'operations', police = spec.kind === 'police';
    return {
        trimColor: ops ? '#1c2e3a' : police ? '#9aa4ab' : '#c4c2b6', acousticName: 'Wall acoustic panels',
        signLabel: ops ? 'AUTHORISED PERSONNEL ONLY' : police ? 'SQUAD ROOM · STAFF ONLY' : 'WELCOME · SERVICE CENTRE',
        rugColor: spec.kind === 'government' ? '#889b85' : null, planter: spec.kind === 'government',
        boardName: ops ? 'Wall operations overview' : police ? 'Wall beat map and shift roster' : 'Wall public service guide',
        boardFooter: ops ? '#17323c' : '#f1f0e7',
        storage: { height: spec.kind === 'government' ? 1200 : 1900, open: false }, chairDetailHeight: 480, nightBackground: ops ? .35 : .72,
        lampSupport: { id: 'workstation-0', height: 740 }
    };
}
// Carpet tiles per scene (500 mm, quarter-turn): darker graphite with a faint
// cross-hatch (security), cool grey-blue (police), warm grey (government).
export const floor = (spec, w, d) => {
    const P = pal(spec.kind), tile = 500;
    const map = tex((c, W, H) => drawCarpet(c, W, H, P.carpet, { seed: spec.kind.length, hatchAlpha: spec.kind === 'operations' ? '26' : '10' }), 512, 512);
    map.repeat.set(w / (2 * tile), d / (2 * tile)); map.anisotropy = 8;
    return { map, roughness: .93, surface: 'fabric' };
};
export function drawBoard(c, W, H, spec, variant = 0) {
    const dark = spec.kind === 'operations';
    boardFrame(c, W, H, spec, { dark });
    if (spec.kind === 'police') {
        beatMap(c, 28, 68, W * .56, H - 132, variant);
        ['DAY', 'EVENING', 'NIGHT'].forEach((label, n) => {
            const x = W * .62 + n * W * .125, active = n === [0, 0, 1, 2, 0][variant];
            c.fillStyle = active ? '#234e72' : '#d9dfe3'; c.fillRect(x, 68, W * .115, H - 132);
            c.fillStyle = active ? '#f1f0e7' : '#234e72'; c.font = '600 14px sans-serif'; c.fillText(label, x + 8, 88);
            for (let r = 0; r < 7; r++) { c.fillStyle = active ? '#9fb6c8' : '#9aa6ad'; c.fillRect(x + 8, 102 + r * 26, W * .115 * (.5 + rnd(r + n * 7) * .4), 13); c.fillStyle = '#d9b44a'; if ((r + n) % 4 === 0) c.fillRect(x + W * .1, 102 + r * 26, 6, 13); }
        });
    } else if (spec.kind === 'government' && variant === 4) {
        // Team workshop: the service guide is papered over with a service-journey
        // map, sticky notes and dot votes (generic content).
        c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#b39b6a'; c.fillRect(0, 0, W, 64); c.fillStyle = '#24302e'; c.font = '600 28px sans-serif'; c.fillText('TEAM WORKSHOP · SERVICE JOURNEY', 28, 44, W - 56);
        const cols = ['ARRIVE', 'WAIT', 'BE SERVED', 'FOLLOW UP', 'IDEAS'], cw = (W - 56) / 5, notes = ['#f2d36b', '#9fd0b4', '#f0a98f', '#a9c7e6', '#f6c1d0'];
        c.strokeStyle = '#395d60'; c.lineWidth = 4; c.beginPath(); c.moveTo(28, 120); c.lineTo(W - 28, 120); c.stroke();
        cols.forEach((t, n) => {
            const x = 28 + n * cw; c.fillStyle = '#395d60'; c.beginPath(); c.arc(x + cw / 2, 120, 12, 0, TAU); c.fill(); c.font = '600 17px sans-serif'; c.fillText(t, x + 10, 98, cw - 16);
            for (let r = 0; r < 3 + (n + 1) % 3; r++) {
                const nx = x + 12 + (r % 2) * (cw / 2 - 6), ny = 146 + Math.floor(r / 2) * 92 + (r % 2) * 10, a = (rnd(n * 7 + r) - .5) * .12;
                c.save(); c.translate(nx + 42, ny + 38); c.rotate(a); c.fillStyle = '#00000018'; c.fillRect(-40, -34, 86, 76); c.fillStyle = notes[(n + r) % 5]; c.fillRect(-43, -38, 86, 76);
                c.fillStyle = '#3c4a47'; for (let l = 0; l < 3; l++) c.fillRect(-34, -22 + l * 14, 50 + rnd(l + r + n) * 20, 3); c.restore();
            }
            for (let v = 0; v < 2 + n % 3; v++) { c.fillStyle = ['#c0392b', '#2f6d6c'][v % 2]; c.beginPath(); c.arc(x + 20 + v * 16, H - 70, 7, 0, TAU); c.fill(); }
        });
    } else if (spec.kind === 'government') {
        const tiles = [['PERMITS', 'doc'], ['RECORDS', 'folder'], ['PAYMENTS', 'card'], ['APPOINTMENTS', 'cal']];
        tiles.forEach(([label, icon], n) => {
            const x = 28 + (n % 2) * W * .3, y = 70 + Math.floor(n / 2) * (H - 130) / 2, tw = W * .28, th = (H - 140) / 2;
            c.fillStyle = ['#dfe7df', '#e9e1cf', '#dbe4e6', '#e6ddd8'][n]; c.fillRect(x, y, tw, th);
            c.strokeStyle = '#395d60'; c.fillStyle = '#395d60'; c.lineWidth = 4; const ix = x + 22, iy = y + 18;
            if (icon === 'doc') { c.strokeRect(ix, iy, 44, 58); for (let l = 0; l < 3; l++) c.fillRect(ix + 8, iy + 14 + l * 12, 28, 3); c.beginPath(); c.arc(ix + 40, iy + 52, 12, 0, 7); c.stroke(); }
            if (icon === 'folder') { c.strokeRect(ix, iy + 12, 62, 44); c.fillRect(ix, iy + 6, 24, 8); }
            if (icon === 'card') { c.strokeRect(ix, iy + 10, 64, 42); c.fillRect(ix, iy + 20, 64, 8); }
            if (icon === 'cal') { c.strokeRect(ix, iy + 6, 58, 52); c.fillRect(ix, iy + 6, 58, 12); for (let d = 0; d < 6; d++) c.fillRect(ix + 8 + d % 3 * 16, iy + 26 + Math.floor(d / 3) * 14, 8, 8); }
            c.lineWidth = 1; c.font = '600 19px sans-serif'; c.fillText(label, x + 100, y + 44, tw - 110);
            c.fillStyle = '#6e7b79'; c.font = '13px sans-serif'; c.fillText(['Apply and check plans', 'Request a copy', 'Pay or set up a plan', 'Book a time to talk'][n], x + 100, y + 68, tw - 110);
        });
        const x = W * .64, closed = variant === 3;
        c.fillStyle = '#395d60'; c.fillRect(x, 70, W * .33, H - 130);
        c.fillStyle = '#f1f0e7'; c.font = '600 20px sans-serif'; c.fillText('TODAY', x + 18, 100);
        c.font = '15px sans-serif'; c.fillText(closed ? 'Closed · reopens 08:30' : 'Open 08:30 – 16:30', x + 18, 128);
        c.fillText('Counters 1 – 2 · Appointments', x + 18, 152, W * .3); c.fillText('Language help on request', x + 18, 176, W * .3);
        c.fillStyle = '#b39b6a'; c.fillRect(x + 18, 196, W * .29, 3);
        c.fillStyle = '#f1f0e7'; c.font = '600 34px sans-serif'; c.fillText(closed ? '—' : `A ${String(12 + variant * 9).padStart(3, '0')}`, x + 18, 246);
        c.font = '13px sans-serif'; c.fillText(closed ? '' : 'NOW SERVING', x + 18, 268);
    } else boardColumns(c, W, H, spec, ['OPEN', 'MONITOR', 'CLOSED'], dark);
}
export function drawScreen(c, W, H, spec, variant = 0, phase = 'morning') { paintScreen(c, W, H, spec, variant, phase); }

// Furnishing helpers local to this group.
const strip = g => { for (const child of [...g.children]) { child.geometry?.dispose(); g.remove(child); } };
// A canvas-textured plane; `glow` makes it self-lit (backlit signage, displays).
function panel(kit, parent, draw, size, at, { cw = 512, ch = 256, glow = 0, rotY = 0 } = {}) {
    const m = kit.canvasMat(draw, cw, ch);
    if (glow) { m.emissive.set('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = glow; }
    const p = kit.mesh(parent, new THREE.PlaneGeometry(...size), m, at); p.rotation.y = rotY; p.castShadow = false; return p;
}
const glowMat = (kit, color, intensity = .8) => { const m = kit.material(color, { emissive: color, emissiveIntensity: intensity, roughness: .5 }); (kit.govGlow ||= []).push({ m, base: intensity }); return m; };
const signText = (text, bg, fg, font = '600 54px sans-serif') => (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 2, W - 30); };
// Right (door) wall asset: local +x runs toward the front, +z into the room.
const rightAsset = (kit, id, name, z, y, inset = 30) => { const g = kit.asset(id, name, [kit.w / 2 - inset, y, z], kit.right); g.rotation.y = -Math.PI / 2; return g; };
// Analog clock face drawn for an hour.
function clockFace(c, W, H, hour, label) {
    c.fillStyle = '#e9e6d8'; c.fillRect(0, 0, W, H); c.fillStyle = c.strokeStyle = '#25343c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6; c.fillRect(W / 2 + Math.cos(a) * W * .4 - 3, H / 2 + Math.sin(a) * H * .4 - 3, 6, 6); }
    c.font = '600 20px sans-serif'; c.fillText(label, W / 2, H * .7);
    c.lineWidth = 7; c.lineCap = 'round';
    for (const [angle, len] of [[hour % 12 * Math.PI / 6 - Math.PI / 2, W * .23], [-Math.PI / 2, W * .33]]) { c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(angle) * len, H / 2 + Math.sin(angle) * len); c.stroke(); }
}

export function furnish(kit) {
    const { spec, index: i, w, bz, front, table, monitor, box, chair, asset, back, byId, mat } = kit;
    const row1 = bz + 1900;
    // Solid (non vertex-colour) finishes for kit.box parts; box-projected in
    // finishDecor via userData.govUV. Class materials for batched detail: roomMats.
    const M = roomMats(kit), maps = kit.gov.maps, P = pal(spec.kind), uv = (m, p) => { m.userData.govUV = p; return m; };
    kit.govMats = {
        steel: uv(mat(P.steel, null, { map: maps.powder, roughnessMap: maps.powderR, roughness: .6, metalness: .32 }), [260, 260]),
        dark: uv(mat('#11181d', null, { map: maps.powder, roughnessMap: maps.powderR, roughness: .55, metalness: .2 }), [260, 260]),
        frame: uv(mat('#0c1114', null, { map: maps.powder, roughness: .4, metalness: .25 }), [260, 260]),
        hpl: spec.kind === 'government' ? uv(mat('#ffffff', 'wood', { map: maps.oakH, roughness: .55 }), [1400, 700]) : uv(mat(P.top, null, { map: maps.hpl, roughnessMap: maps.hplR, roughness: spec.kind === 'operations' ? .8 : .86 }), [300, 300]),
        sage: uv(mat('#395d60', null, { map: maps.powder, roughnessMap: maps.powderR, roughness: .75 }), [260, 260]),
        navy: uv(mat('#2e3f4c', null, { map: maps.powder, roughnessMap: maps.powderR, roughness: .7 }), [260, 260])
    };
    void M;
    const { hpl, dark } = kit.govMats;
    // The fixed, test-named workstation of each room joins its role's row.
    const at = {
        operations: [[1800, 1150, 300][i], row1],
        police: [[-100, 750, -150][i], row1],
        government: i ? [[0, -1850, -2750][i], bz + 4700] : [1950, row1]
    }[spec.kind];
    const name = { operations: 'Security console table', police: 'Case review workstation', government: 'Public service workstation' }[spec.kind];
    const g = table('workstation-0', name, [at[0], 0, at[1]], 1500, 750, 740, hpl);
    monitor(g, [-350, 740, -190], 560, 10);
    monitor(g, [350, 740, -190], 560, 11);
    box(g, [420, 18, 145], [0, 752, 160], kit.ink, 5);
    if (spec.kind !== 'police') box(g, [1500, 140, 22], [0, 520, -360], spec.kind === 'operations' ? dark : kit.govMats.sage, 4);  // modesty panel
    if (spec.kind === 'government') box(g, [1500, 450, 30], [0, 965, -390], kit.govMats.sage, 8);                                 // privacy screen
    chair('operator-chair-0', [at[0], 0, at[1] + 680]);
    // Briefing / report tables share the room's work-surface finish.
    const act = byId('activity-table'); if (act && spec.kind !== 'government') act.children[0].material = hpl;
    if (spec.kind === 'operations') {
        // Video wall: 3 x 2 framed displays, a mullion frame, a cyan bias halo
        // and a ledge of status lamps. The planning board is hidden.
        kit.board.visible = false;
        const overview = asset('overview', 'Wall security display array', [0, 1520, bz + 70], back);
        overview.userData.propAnchor = 'wall';   // its cable trunking reaches the floor: keep it a wall asset
        box(overview, [2660, 1120, 30], [0, 100, -38], kit.govMats.frame, 6);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) monitor(overview, [-850 + col * 850, row * 500 - 350, 0], 800, row * 3 + col, true);
        const halo = glowMat(kit, '#48aeb0', 1.1);
        for (const [sx, sy, x, y] of [[2800, 22, 0, 700], [2800, 22, 0, -500], [22, 1222, -1400, 100], [22, 1222, 1400, 100]]) box(overview, [sx, sy, 10], [x, y, -50], halo);
        box(overview, [2700, 30, 150], [0, -478, 20], kit.govMats.steel, 4);
        [['#4fd07f', 1.2], ['#e6a43c', 1.2], ['#3a4348', 0]].forEach(([color, glow], n) => box(overview, [70, 22, 40], [980 + n * 110, -452, 50], glow ? glowMat(kit, color, glow) : dark, 4));
        videoWallDetail(kit, overview);
    }
    // Storage becomes a role-specific cabinet: key and radio cabinet, locker
    // bank, or oak records cabinet (same saved key `storage`).
    const storage = byId('storage');
    if (storage) {
        strip(storage);
        if (spec.kind === 'police') storage.position.z = bz + 300;
        storage.name = storage.userData.sceneAssetName = { operations: 'Key and radio cabinet', police: 'Equipment lockers', government: 'Records cabinet' }[spec.kind];
    }
    void front; void w;
}
// Batched detail per furnishing (called once for every furnish() asset).
export function dressProp(id, k, g, kit) {
    const { spec } = kit, kind = spec.kind, M = roomMats(kit), K = ck(kind), P = pal(kind);
    if (id === 'storage') {
        // Shared carcass detail: recessed plinth, top cap, hinges.
        const hinges = (x0, x1, h, z) => { for (const x of [x0, x1]) for (const y of [h * .16, h * .5, h * .84]) K.brushed.box([10, 70, 12], [x, y, z], '#9aa4ab'); };
        if (kind === 'operations') {
            // Steel key and radio cabinet: two doors with reveals, swing handles and
            // locks, a glazed key box with a 6 x 4 hook grid, louvres, radio bank on top.
            K.rubber.box([1190, 60, 380], [0, 30, -6], '#15191c'); K.steel.box([1250, 1840, 420], [0, 980, 0], P.steel); K.steel.box([1262, 20, 432], [0, 1910, 0], shade(P.steel, -.04));
            for (const s of [-1, 1]) {
                K.steel.box([612, 1780, 14], [s * 309, 980, 217], P.door);
                K.brushed.box([24, 190, 26], [s * 42, 1000, 232], '#b7bfc3'); K.brushed.cyl(11, 11, 14, [s * 42, 1130, 226], '#c9cfd2'); K.box([4, 12, 2], [s * 42, 1130, 234], '#2b3236');
                for (let v = 0; v < 9; v++) K.box([300, 6, 3], [s * 309, 120 + v * 20, 225], '#262e33');
            }
            K.box([6, 1780, 4], [0, 980, 222], '#11161a'); hinges(-612, 612, 1900, 214);
            // Key box on the left door.
            K.steel.box([440, 540, 20], [-308, 1380, 234], '#2b363d'); K.box([396, 496, 4], [-308, 1380, 246], '#3c4a52');
            for (let n = 0; n < 24; n++) { const x = -468 + n % 6 * 64, y = 1560 - Math.floor(n / 6) * 112; K.brushed.box([8, 24, 18], [x, y, 256], '#c7b27a'); if (n % 5) { K.box([22, 36, 3], [x, y - 32, 262], ['#d9b44a', '#48aeb0', '#c56d4f'][n % 3]); K.brushed.ball(7, [x, y - 10, 262], '#c9cfd2'); } }
            K.glass.box([400, 500, 3], [-308, 1380, 268], '#ffffff'); K.brushed.box([16, 70, 14], [-110, 1380, 272], '#b7bfc3');
            tag(K, 'KEYS', [150, 40], [-308, 1690, 236]); K.brushed.box([230, 136, 4], [308, 1608, 226], '#9aa4ab'); tag(K, 'KEY CABINET', [210, 54], [308, 1640, 229]); tag(K, 'AUTHORISED ONLY', [210, 54], [308, 1577, 229]);
            // A laminated radio sign-out sheet taped on the right door.
            K.paper.add(atlasPlane(210, 297, 4, 4, 2), [308, 1250, 225.5], '#ffffff'); for (const [x, y] of [[-95, 140], [95, 140]]) K.box([40, 14, 1], [308 + x, 1250 + y, 226], '#e9e5d8');
            radioDock(K, -260, 1920, 0, 4); tag(K, 'RADIOS · CHARGE', [200, 30], [-260, 1940, 56]); K.rubber.box([12, 12, 300], [-120, 1925, -120], '#15191c');
            // Trailing ivy on top of the cabinet.
            K.hpl.cyl(110, 90, 140, [260, 1990, 0], '#3a4247'); K.box([200, 8, 200], [260, 2058, 0], '#3b2f25');
            for (let n = 0; n < 30; n++) { const t = n / 30; K.ball(38, [260 + Math.sin(n * 2.1) * 180, 2070 - t * 420 * (n % 2), 120 + Math.cos(n * 1.7) * 60 + (n % 2) * 100], n % 3 ? '#4c7556' : '#36604a', [.75, 1.05, .6], [0, n, .5]); }
        } else if (kind === 'police') {
            // Four vented locker doors (3 x 8 slots top and bottom), name-plate
            // holders with printed labels, lever handles and padlocks; radio
            // charger and caps on the sloped top.
            K.rubber.box([1190, 70, 410], [0, 35, -8], '#15191c'); K.steel.box([1250, 1830, 450], [0, 985, 0], P.steel); K.steel.box([1262, 22, 462], [0, 1910, 0], shade(P.steel, -.03));
            for (let n = 0; n < 4; n++) {
                const x = -469 + n * 312.5;
                K.steel.box([306, 1780, 12], [x, 980, 231], P.door);
                for (const y0 of [1660, 230]) for (let v = 0; v < 8; v++) for (let c = -1; c <= 1; c++) K.box([66, 7, 3], [x + c * 82, y0 + v * 20, 238], '#232d36');
                K.brushed.box([130, 48, 5], [x, 1450, 239], '#b7bfc3'); tag(K, `LOCKER 0${n + 1}`, [116, 34], [x, 1450, 242.5]);
                K.brushed.box([16, 130, 24], [x + 112, 1000, 246], '#b7bfc3'); K.brushed.box([40, 20, 20], [x + 112, 1080, 246], '#b7bfc3');
                if (n !== 2) { K.brushed.box([44, 40, 16], [x + 112, 1120, 256], '#c9a64a'); K.add(new THREE.TorusGeometry(14, 4, 6, 12, Math.PI), [x + 112, 1140, 256], '#c9cfd2'); }
                K.box([6, 1780, 3], [x + 155, 980, 236], '#151c22');
                for (const y of [300, 980, 1660]) K.brushed.box([8, 60, 10], [x - 150, y, 230], '#9aa4ab');
            }
            radioDock(K, -250, 1920, 0, 6); tag(K, 'RADIOS', [140, 30], [-250, 1940, 56]);
            for (let n = 0; n < 4; n++) { const x = 160 + n * 120; K.box([110, 8, 70], [x, 1924, 60], '#20262b'); K.fabric.cyl(55, 50, 60, [x, 1954, 40], '#1f2b3a'); K.fabric.box([90, 6, 60], [x, 1926, 110], '#1a2430'); }
        } else {
            // Oak records cabinet: six drawers with reveals, brass label holders
            // (printed A-F) and bar pulls, lock, file boxes and a plant on top.
            K.rubber.box([1190, 60, 380], [0, 30, -6], '#2b2621'); K.oak.box([1250, 1110, 420], [0, 615, 0], '#e8dcc8'); K.oak.box([1280, 30, 440], [0, 1185, 8], '#ffffff');
            for (let n = 0; n < 6; n++) {
                const x = -416 + (n % 3) * 416, y = 900 - Math.floor(n / 3) * 520;
                K.oak.box([404, 500, 16], [x, y, 218], '#f6efe3'); K.box([408, 4, 6], [x, y - 252, 214], '#4a3a2a');
                K.brushed.box([140, 12, 18], [x, y + 170, 234], '#b39b6a'); for (const dx of [-60, 60]) K.brushed.box([12, 12, 22], [x + dx, y + 170, 228], '#b39b6a');
                K.brushed.box([108, 54, 4], [x, y + 100, 227], '#b39b6a'); tag(K, `RECORDS ${'ABCDEF'[n]}`, [96, 42], [x, y + 100, 229.5]);
            }
            K.box([4, 1040, 6], [-208, 615, 214], '#4a3a2a'); K.box([4, 1040, 6], [208, 615, 214], '#4a3a2a'); K.brushed.cyl(10, 10, 8, [0, 1130, 222], '#b39b6a');
            for (let n = 0; n < 3; n++) { const x = -380 + n * 270; K.box([260, 260, 330], [x, 1330, 0], ['#d9cdb4', '#cfdcd2', '#d9cdb4'][n]); K.box([262, 30, 332], [x, 1445, 0], shade(['#d9cdb4', '#cfdcd2', '#d9cdb4'][n], -.04)); tag(K, 'ARCHIVE', [150, 40], [x, 1320, 166]); K.box([60, 26, 2], [x, 1400, 166], '#5c4c3a'); }
            plant(K, 420, 1200, 0, .62);
        }
        K.build(g, M);
    }
    if (id === 'workstation-0') {
        workstationDetail(K, 740);
        // Edge banding on the fixed workstation top.
        const edge = { operations: '#11181d', police: '#3b4650', government: '#8f7350' }[kind];
        for (const z of [-376.5, 376.5]) K.box([1504, 36, 3], [0, 722.5, z], edge); for (const x of [-751.5, 751.5]) K.box([3, 36, 754], [x, 722.5, 0], edge);
        if (kind === 'operations') {
            for (const x of [-70, 70]) K.rubber.ball(28, [x, 775, -10], '#293e48', [.5, 1, 1]);
            K.brushed.box([130, 12, 12], [0, 795, -10], '#738c94'); K.brushed.box([12, 60, 12], [0, 765, -10], '#738c94');
            // CPU tower: vented front, power LED; steel cable tray and cables.
            K.hpl.box([200, 430, 450], [520, 215, 50], '#1b2226'); for (let v = 0; v < 10; v++) K.box([150, 6, 3], [520, 120 + v * 22, 276], '#0c1012'); K.box([10, 10, 4], [580, 380, 276], '#4fd07f'); K.brushed.cyl(10, 10, 4, [460, 380, 276], '#9aa4ab');
            K.steel.box([1100, 10, 150], [0, 565, -280], '#262e33'); for (const z of [-352, -208]) K.steel.box([1100, 70, 6], [0, 600, z], '#262e33');
            for (let n = 0; n < 4; n++) K.rubber.box([1060, 12, 14], [0, 576, -320 + n * 24], ['#3e8fa0', '#2b3338', '#c56d4f', '#2b3338'][n]);
            card(K, -560, 740, 150, 130, 95, '#d9c873', 4, .2); tag(K, 'DO NOT UNPLUG', [180, 40], [520, 330, 276]);
        }
        if (kind === 'police') { folderStack(K, -560, 740, -40, 4); K.rubber.box([60, 140, 30], [530, 810, -200], '#1d2427'); paperSheet(K, 7, 420, 740, 200, 210, 297, -.12); }
        if (kind === 'government') {
            K.box([110, 20, 70], [-600, 750, 250], '#2a3b3f'); K.steel.box([300, 60, 220], [-560, 770, -20], '#6f8a8b'); paperSheet(K, 0, -560, 800, -20, 210, 297, .02);
            for (const z of [-372, -348]) K.brushed.box([1500, 3, 3], [0, 452, z], '#b39b6a');
        }
        K.build(g, M);
    }
}

// Perimeter features, zones and storytelling (kit.dress is available here).
export function decorate(kit) {
    const { spec } = kit;
    finishShell(kit);
    installView(kit);
    if (spec.kind === 'operations') decorateSecurity(kit);
    else if (spec.kind === 'police') decoratePolice(kit);
    else decorateGovernment(kit);
    exitSign(kit);
    lightFixtures(kit);
}
function exitSign(kit) {
    // An illuminated exit sign over the door (always on), generic pictogram.
    const { w, front, right } = kit;
    const sign = kit.asset('exit-sign', 'Illuminated exit sign', [w / 2 - 40, 2310, front - 1600], right); sign.rotation.y = -Math.PI / 2;
    kit.box(sign, [380, 120, 50], [0, 0, 0], kit.govMats.dark, 6);
    panel(kit, sign, (c, W, H) => {
        c.fillStyle = '#1f9a5a'; c.fillRect(0, 0, W, H); c.fillStyle = '#eafff1'; c.font = '600 64px sans-serif'; c.textBaseline = 'middle'; c.fillText('EXIT', W * .42, H / 2 + 3);
        c.fillRect(30, 30, 64, 68); c.fillStyle = '#1f9a5a'; c.beginPath(); c.arc(62, 46, 8, 0, 7); c.fill(); c.fillRect(56, 56, 12, 28);
    }, [360, 104], [0, 0, 27], { cw: 256, ch: 74, glow: .9 });
    const K = ck(kit.spec.kind); for (const x of [-120, 120]) K.brushed.box([12, 70, 12], [x, 95, -10], '#9aa4ab'); K.build(sign, roomMats(kit));
}
// Room-identity header that replaces the shell's room-sign label.
function header(kit, text, { bg, fg, glow = 0, font }) {
    const sign = kit.byId('room-sign'); if (!sign) return;
    strip(sign);
    const width = Math.min(kit.w - 500, 2700);
    kit.box(sign, [width + 60, 380, 40], [0, 0, -10], glow ? kit.govMats.dark : kit.govMats.hpl, 6);
    panel(kit, sign, signText(text, bg, fg, font), [width, 330], [0, 0, 12], { cw: 1024, ch: 128, glow });
    // Stand-off fixings at the corners.
    const K = ck(kit.spec.kind); for (const x of [-width / 2 - 5, width / 2 + 5]) for (const y of [-160, 160]) K.brushed.add(new THREE.CylinderGeometry(11, 11, 14, 12), [x, y, 14], '#b7bfc3', [1, 1, 1], [Math.PI / 2, 0, 0]);
    K.build(sign, roomMats(kit));
}
function roomBlinds(kit, count) {
    // Blinds across the daylight opening; drop set per daypart in atmosphere().
    const { window: win, d, spec } = kit, kind = spec.kind, span = d * .48, blinds = [], M = roomMats(kit), K = ck(kind);
    const housing = kind === 'government' ? '#d9d6cc' : kind === 'police' ? '#c9ced1' : '#2f383d';
    K.steel.box([span + 60, 90, 130], [0, 905, 80], housing); for (const x of [-span / 2 - 34, span / 2 + 34]) K.steel.box([12, 100, 116], [x, 905, 70], shade(housing, -.08));
    const bw = span / count - 30, m = blindMaterial(kind, bw); m.map.repeat.x = bw / m.userData.blind.pu; kit.gov.blind = m;
    for (let n = 0; n < count; n++) {
        const x = -span / 2 + (n + .5) * span / count;
        const p = kit.mesh(win, new THREE.PlaneGeometry(bw, 1), m, [x, 860, 118]); p.castShadow = p.receiveShadow = false; p.name = 'Window blind';
        kit.mesh(win, new THREE.BoxGeometry(bw, 26, 18), kit.govMats.steel, [x, 860, 123]);
        blinds.push(p);
        // Bead chain / wand on the outer edge with a weight.
        const cx = x + bw / 2 - 26;
        if (kind === 'police') { K.brushed.box([10, 640, 10], [cx, 530, 132], '#c9ced1'); K.box([16, 40, 16], [cx, 200, 132], '#9aa4ab'); }
        else { K.box([4, 760, 4], [cx, 480, 134], '#8b8f91'); K.box([4, 760, 4], [cx + 10, 480, 134], '#8b8f91'); K.brushed.box([16, 30, 16], [cx + 5, 95, 134], '#9aa4ab'); }
    }
    K.build(win, M);
    kit.govBlinds = blinds;
}
const setBlinds = (kit, drop) => {
    const h = Math.max(1, Math.min(1690, 1750 * drop));
    for (const p of kit.govBlinds || []) {
        p.scale.y = h; p.position.y = 860 - h / 2;
        const rail = p.parent.children[p.parent.children.indexOf(p) + 1]; if (rail) rail.position.y = 860 - h;
    }
    const m = kit.gov?.blind; if (m) { const r = h / m.userData.blind.pv; m.map.repeat.y = r; m.map.offset.y = Math.ceil(r) - r; }
};
// A thin edge band around a table top (top centre y, size w x d).
const edgeBand = (K, w, d, y, color, t = 3) => { for (const z of [-d / 2 - t / 2, d / 2 + t / 2]) K.box([w + t * 2, 36, t], [0, y, z], color); for (const x of [-w / 2 - t / 2, w / 2 + t / 2]) K.box([t, 36, d], [x, y, 0], color); };
// Video wall dressing: 80 mm mullions, bezel fixings, cable trunking, label.
function videoWallDetail(kit, overview) {
    const K = ck('operations');
    for (const x of [-425, 425]) K.box([52, 990, 20], [x, 100, 6], '#0c1114');
    K.box([2560, 22, 20], [0, 100, 6], '#0c1114');
    for (const x of [-1300, 1300]) for (const y of [-430, 630]) K.brushed.add(new THREE.CylinderGeometry(9, 9, 8, 10), [x, y, -18], '#6f7a80', [1, 1, 1], [Math.PI / 2, 0, 0]);
    K.steel.box([90, 1040, 44], [-1180, -999, -12], '#1a2329'); K.box([60, 6, 2], [-1180, -700, 11], '#48aeb0');
    for (let n = 0; n < 3; n++) K.rubber.box([16, 520, 16], [-1020 + n * 22, -730, -32], '#15191c');
    tag(K, 'VW-01', [120, 30], [-1100, -478, 96]);
    K.build(overview, roomMats(kit));
}
function decorateSecurity(kit) {
    const { w, d, bz, front, index: i, asset, box, back, chair, table, govMats } = kit, M = roomMats(kit), P = pal('operations');
    header(kit, 'OPERATIONS', { bg: '#0f1a20', fg: '#7fe0d6', glow: 1, font: '600 72px sans-serif' });
    // Three zone clocks beside the header.
    const clocks = asset('zone-clocks', 'Wall zone clocks', [(1400 + w / 2) / 2, 2470, bz + 45], back);
    kit.govClocks = [];
    for (let n = 0; n < 3; n++) {
        const x = (n - 1) * 380; kit.mesh(clocks, new THREE.CylinderGeometry(150, 150, 30, 40), govMats.dark, [x, 0, 0]).rotation.x = Math.PI / 2;
        const face = kit.mesh(clocks, new THREE.CircleGeometry(135, 40), kit.canvasMat((c, W, H) => clockFace(c, W, H, 9 + n * 3, `SITE ${'ABC'[n]}`), 192, 192), [x, 0, 17]); face.castShadow = false;
        kit.govClocks.push(face);
    }
    { const K = ck('operations'); for (let n = 0; n < 3; n++) { K.brushed.add(new THREE.TorusGeometry(142, 7, 6, 40), [(n - 1) * 380, 0, 18], '#7d8a90'); K.glass.add(new THREE.CircleGeometry(136, 32), [(n - 1) * 380, 0, 22], '#ffffff'); tag(K, `ZONE ${'ABC'[n]}`, [120, 30], [(n - 1) * 380, -185, 4]); } K.build(clocks, M); }
    // Supervision zone: a darker carpet field with an LED nosing line (flat, walkable).
    const sup = asset('supervision-zone', 'Supervision zone floor field', [0, 0, i ? bz + 4900 : bz + 4750]);
    const zw = i ? w - 1200 : 3000, zd = 1900;
    sup.position.x = i ? 0 : 700;
    const daisMap = tex((c, W, H) => drawCarpet(c, W, H, P.dais, { seed: 9, hatchAlpha: '30' }), 512, 512); daisMap.repeat.set(zw / 1000, zd / 1000);
    const dais = kit.mat('#ffffff', 'fabric', { map: daisMap, roughness: .96 });
    kit.mesh(sup, new THREE.BoxGeometry(zw, 4, zd), dais, [0, 2, 0]).castShadow = false;
    kit.mesh(sup, new THREE.BoxGeometry(zw, 5, 30), glowMat(kit, '#48aeb0', .7), [0, 3, -zd / 2 + 15]).castShadow = false;
    { const K = ck('operations'); K.brushed.box([zw, 6, 20], [0, 3, -zd / 2 + 40], '#8a959b'); K.brushed.box([zw, 6, 12], [0, 3, -zd / 2 - 6], '#8a959b'); K.build(sup, M); }
    // Briefing bench (activity table + Large second table) with chairs.
    const act = kit.layout.activity;
    const seats = [[1, 2, 3][i]];
    if (i === 2) {
        const t2 = table('briefing-table', 'Team briefing table', [-1000, 0, act[1]], 1550, 700, 740, govMats.hpl);
        const K = ck('operations'); notebook(K, -470, 740, 0, '#5e7480'); card(K, 380, 740, -40, 297, 210, '#efece4', 7, .05); paperSheet(K, 1, 120, 740, -60, 210, 297, -.06); K.rubber.box([150, 45, 110], [120, 762, 120], '#1f272b'); K.rubber.cyl(38, 38, 4, [-120, 741, 150], '#3a3f42');
        edgeBand(K, 1550, 700, 722.5, P.edge); K.build(t2, M);
        for (let n = 0; n < 5; n++) chair(`briefing-chair-${n}`, [-3600 + n * 680, 0, act[1] + 650], 450);
    } else for (let n = 0; n < seats[0] + 1; n++) chair(`briefing-chair-${n}`, [act[0] + (n - seats[0] / 2) * (i ? 520 : 600), 0, act[1] + 650], 450);
    { const actT = kit.byId('activity-table'); if (actT) { const K = ck('operations'); edgeBand(K, 1300, 650, 722.5, P.edge); K.build(actT, M); } }
    // Equipment cabinet, first aid and AED on the door wall (M/L).
    if (i) {
        const eq = asset('equipment-cabinet', 'Equipment cabinet', [w / 2 - 260, 0, bz + 1500]); eq.rotation.y = -Math.PI / 2;
        const K = ck('operations');
        K.rubber.box([1360, 60, 460], [0, 30, -6], '#15191c'); K.steel.box([1400, 1940, 500], [0, 1030, 0], P.steel); K.steel.box([1412, 20, 512], [0, 2000, 0], shade(P.steel, -.04));
        for (const s of [-1, 1]) {
            K.steel.box([692, 1880, 14], [s * 351, 1030, 257], P.door); K.brushed.box([24, 190, 26], [s * 40, 1050, 272], '#b7bfc3'); K.brushed.cyl(11, 11, 14, [s * 40, 1180, 266], '#c9cfd2');
            for (let v = 0; v < 9; v++) K.box([340, 6, 3], [s * 351, 160 + v * 20, 265], '#262e33');
            for (const y of [300, 1030, 1760]) K.brushed.box([10, 70, 12], [s * 694, y, 254], '#9aa4ab');
        }
        K.box([6, 1880, 4], [0, 1030, 262], '#11161a');
        // Wall-mount first-aid box on the right door, PPE / spares labels on the left.
        K.hpl.box([340, 240, 110], [352, 1450, 320], '#f2f1ea'); K.box([60, 160, 4], [352, 1450, 377], '#2f9d5b'); K.box([160, 60, 4], [352, 1450, 377], '#2f9d5b'); tag(K, 'FIRST AID', [220, 44], [352, 1600, 266]);
        tag(K, 'EQUIPMENT', [240, 50], [-352, 1720, 266]); tag(K, 'PPE', [160, 40], [-352, 1640, 266]); tag(K, 'SPARES', [160, 40], [-352, 1585, 266]);
        K.paper.add(atlasPlane(210, 297, 4, 4, 2), [-352, 1300, 265], '#ffffff');
        K.build(eq, M);
        const aed = rightAsset(kit, 'aed-cabinet', 'Wall AED cabinet', bz + 1500 + 950, 1200, 70);
        const a = ck('operations');
        a.steel.box([380, 460, 140], [0, 0, 0], '#2f9d5b'); a.steel.box([340, 330, 8], [0, -30, 72], '#2a8a50'); a.glass.box([300, 290, 3], [0, -30, 78], '#ffffff');
        a.hpl.box([200, 240, 80], [0, -40, 20], '#e9e5d8'); a.box([120, 40, 4], [0, 0, 61], '#2f9d5b'); tag(a, 'AED', [180, 60], [0, 180, 71]); a.brushed.box([16, 90, 16], [150, -30, 84], '#c9cfd2');
        a.build(aed, M);
    }
    // Door wall: acoustic panel grid, incident status board, evacuation plan,
    // card reader and an extinguisher; plaque on the door leaf.
    const acoustic = kit.byId('acoustic-panels'); if (acoustic) acoustic.position.z = bz + [1600, 3550, 3850][i];
    const board = rightAsset(kit, 'incident-board', 'Wall incident status board', bz + (i ? 5300 : 3350), 1600, 30);
    box(board, [1400, 940, 30], [0, 0, 0], govMats.steel, 6);
    panel(kit, board, (c, W, H) => {
        c.fillStyle = '#f0f1ec'; c.fillRect(0, 0, W, H); c.fillStyle = '#17323c'; c.font = '600 26px sans-serif'; c.fillText('INCIDENT STATUS', 22, 38);
        ['OPEN', 'MONITOR', 'CLOSED'].forEach((t, n) => {
            const x = 20 + n * (W - 30) / 3; c.fillStyle = ['#e4a646', '#48aeb0', '#7d8b91'][n]; c.fillRect(x, 54, (W - 60) / 3, 26); c.fillStyle = '#10232d'; c.font = '600 15px sans-serif'; c.fillText(t, x + 8, 73);
            for (let r = 0; r < 3; r++) { c.fillStyle = ['#fbe6bd', '#cdeceb', '#dfe3e4'][n]; c.fillRect(x + 4, 92 + r * 52, (W - 70) / 3, 42); c.fillStyle = '#41545c'; c.fillRect(x + 12, 104 + r * 52, 70 + rnd(r + n * 3) * 50, 5); c.fillRect(x + 12, 116 + r * 52, 40 + rnd(r + n) * 40, 5); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x + (W - 70) / 3 - 8, 98 + r * 52, 5, 0, 7); c.fill(); }
        });
        c.strokeStyle = '#c7cdcf'; c.lineWidth = 1; for (let n = 1; n < 3; n++) { c.beginPath(); c.moveTo(20 + n * (W - 30) / 3 - 6, 54); c.lineTo(20 + n * (W - 30) / 3 - 6, H - 20); c.stroke(); }
    }, [1360, 900], [0, 0, 17], { cw: 640, ch: 424 });
    { const K = ck('operations'); markerTray(K, 1300, -470, 40); K.build(board, M); }
    const evac = rightAsset(kit, 'evacuation-plan', 'Wall evacuation plan', front - 2650, 1550, 30);
    box(evac, [440, 600, 20], [0, 0, 0], govMats.steel, 4);
    panel(kit, evac, (c, W, H) => {
        c.fillStyle = '#f4f3ee'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f9a5a'; c.fillRect(0, 0, W, 40); c.fillStyle = '#ffffff'; c.font = '600 18px sans-serif'; c.fillText('EVACUATION PLAN', 12, 27);
        c.strokeStyle = '#3d4a52'; c.lineWidth = 4; c.strokeRect(24, 70, W - 48, H - 130); c.lineWidth = 2; for (let n = 1; n < 4; n++) { c.beginPath(); c.moveTo(24 + n * (W - 48) / 4, 70); c.lineTo(24 + n * (W - 48) / 4, 70 + (H - 130) * .45); c.stroke(); }
        c.strokeStyle = '#1f9a5a'; c.lineWidth = 6; c.beginPath(); c.moveTo(W * .3, H * .5); c.lineTo(W * .7, H * .62); c.lineTo(W * .78, H - 62); c.stroke(); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(W * .3, H * .5, 9, 0, 7); c.fill(); c.fillStyle = '#3d4a52'; c.font = '13px sans-serif'; c.fillText('YOU ARE HERE', W * .3 - 40, H * .5 - 16);
    }, [400, 560], [0, 0, 11], { cw: 256, ch: 360 });
    { const K = ck('operations'); K.glass.box([404, 564, 2], [0, 0, 13], '#ffffff'); K.build(evac, M); }
    wallSafety(kit, { extZ: front - 850 });
    coffeePoint(kit, 'operations');
    if (i) {
        // Incident cell: a standing map table (Medium: front-right, clear of the
        // door; Large: beside the briefing bench) with two high stools.
        const [mx, mz] = i === 2 ? [-2000, 3900] : [1500, front - 1500];
        const map = table('incident-map-table', 'Incident map table', [mx, 0, mz], 1800, 900, 900, govMats.hpl);
        const K = ck('operations'); sheet(K, 0, 900, 0, 1500, 700, 0, '#ffffff', 6); K.box([1510, 1, 710], [0, 900.4, 0], '#d9d4c6');
        for (let n = 0; n < 5; n++) K.cyl(16, 16, 30, [-400 + n * 200, 915, -100 + (n % 2) * 180], ['#c0392b', '#e4a646', '#48aeb0'][n % 3]);
        K.rubber.box([60, 140, 34], [700, 970, 250], '#1d2427'); K.steel.box([600, 16, 600], [0, 300, 0], '#3a4247'); paperSheet(K, 3, -760, 900, 300, 130, 95, .2);
        edgeBand(K, 1800, 900, 882.5, P.edge); K.build(map, M);
        for (const [n, x] of [-500, 500].entries()) chair(`map-stool-${n}`, [mx + x, 0, mz + 760], 620);
    }
    roomBlinds(kit, 3);
    void d;
}
// Whiteboard marker tray with three markers and an eraser (board-local).
function markerTray(K, width, y, z) {
    K.brushed.box([width * .6, 14, 60], [0, y, z], '#b7bfc3'); K.brushed.box([width * .6, 30, 6], [0, y + 10, z + 30], '#b7bfc3');
    ['#1f3f8a', '#c0392b', '#1f7a4a'].forEach((col, n) => K.add(new THREE.CylinderGeometry(9, 9, 130, 8), [-200 + n * 50, y + 16, z + 4], col, [1, 1, 1], [0, 0, Math.PI / 2]));
    K.box([120, 30, 46], [180, y + 22, z], '#2b2f31'); K.fabric.box([118, 10, 44], [180, y + 4, z], '#d8d8d8');
}
function coffeePoint(kit, kind) {
    // Low coffee and water point against the door wall, in front of the door.
    const { w, front } = kit, P = pal(kind);
    const g = kit.asset('coffee-point', 'Coffee and water point', [w / 2 - 320, 0, front - 380]); g.rotation.y = -Math.PI / 2;
    const K = ck(kind);
    K.rubber.box([580, 70, 520], [0, 35, -10], '#15191c'); K.steel.box([600, 810, 560], [0, 475, 0], P.steel); K.hpl.box([620, 30, 580], [0, 895, 0], '#c7c3b8'); K.box([624, 30, 3], [0, 895, 291], '#3b4650');
    for (const x of [-150, 150]) { K.steel.box([292, 790, 12], [x, 470, 284], P.door); K.brushed.box([12, 140, 22], [x + (x < 0 ? 120 : -120), 640, 298], '#b7bfc3'); }
    K.box([4, 790, 4], [0, 470, 290], '#11161a');
    // Coffee machine with drip tray, a water dispenser bottle and cups.
    K.hpl.box([260, 380, 300], [-120, 1100, -40], '#1d2427'); K.box([180, 80, 10], [-120, 1180, 112], '#3c6f78'); K.brushed.box([150, 14, 90], [-120, 925, 80], '#9aa4ab'); K.brushed.box([40, 40, 40], [-120, 1000, 90], '#b7bfc3'); K.box([10, 10, 4], [-40, 1240, 112], '#4fd07f');
    for (let n = 0; n < 4; n++) K.cyl(38, 32, 90, [120 + (n % 2) * 90, 955, -150 + Math.floor(n / 2) * 110], ['#e6e3da', '#48aeb0', '#e6e3da', '#d9b44a'][n]);
    K.box([140, 160, 120], [200, 990, 170], '#c9b48a'); K.box([100, 4, 60], [200, 1071, 170], '#7b5e3c');
    tag(K, 'NO FOOD OR DRINK', [260, 60], [0, 1450, -316]);
    K.build(g, roomMats(kit));
}
function wallSafety(kit, { reader = true, extZ, extSign = true } = {}) {
    const { front } = kit, M = roomMats(kit), kind = kit.spec.kind;
    if (reader) {
        const r = rightAsset(kit, 'door-access', 'Door card reader and release', front - 2250, 1150, 25);
        const K = ck(kind); K.hpl.box([90, 140, 30], [0, 0, 0], '#1d2427'); K.glass.box([62, 62, 3], [0, 20, 17], '#ffffff'); K.box([60, 60, 3], [0, 20, 15.5], '#2c3c44'); K.box([14, 6, 4], [0, -40, 16], '#45d07a');
        K.steel.box([90, 90, 30], [0, -260, 0], '#2f9d5b'); K.add(new THREE.CylinderGeometry(26, 26, 12, 16), [0, -260, 18], '#eaf1ec', [1, 1, 1], [Math.PI / 2, 0, 0]); K.build(r, M);
        // Authorised-access plaque on the door leaf.
        panel(kit, kit.door, signText('AUTHORISED PERSONNEL ONLY', '#17232a', '#e9eee9', '600 30px sans-serif'), [420, 110], [0, 1080, 44], { cw: 512, ch: 134 });
    }
    // Fire extinguisher on a bracket beyond the door (clear of the floor zone).
    const ext = rightAsset(kit, 'fire-extinguisher', 'Wall fire extinguisher', extZ ?? front - 700, 980, 110);
    const K = ck(kind);
    K.hpl.cyl(80, 80, 480, [0, 0, 0], '#b23a32'); K.hpl.ball(80, [0, 240, 0], '#b23a32', [1, .5, 1]); K.brushed.box([60, 70, 50], [0, 300, 0], '#2b2f31'); K.brushed.box([200, 20, 40], [0, 340, 40], '#9aa4ab');
    K.brushed.cyl(22, 22, 8, [0, 300, 32], '#c9cfd2'); K.box([30, 30, 2], [0, 300, 37], '#f2f1ea'); K.rubber.box([24, 300, 24], [60, 140, 40], '#1b1f22'); K.rubber.box([30, 50, 30], [60, -20, 40], '#1b1f22');
    K.box([164, 120, 2], [0, 40, 81], '#f2f1ea'); K.steel.box([40, 260, 18], [0, 120, -90], '#3a4247'); K.steel.box([180, 30, 60], [0, -150, -70], '#3a4247');
    if (extSign) tag(K, 'FIRE EXTINGUISHER', [260, 70], [0, 560, -94]);
    K.build(ext, M);
}
function decoratePolice(kit) {
    const { w, d, bz, front, index: i, asset, box, chair, govMats } = kit, M = roomMats(kit), P = pal('police');
    header(kit, 'SQUAD ROOM', { bg: '#234e72', fg: '#f1f3ef', font: '600 64px sans-serif' });
    // The beat map board sits to the left of the lockers on the back wall.
    kit.board.position.x = [-150, 300, 600][i];
    { const K = ck('police'); markerTray(K, 2200, -520, 40); K.build(kit.board, M); }
    // Walk-off sheet vinyl inside the door (flat): ribbed rubber with a signal-yellow border.
    const mat1 = asset('walk-off-mat', 'Door walk-off vinyl', [w / 2 - 620, 0, front - 1600]);
    const rib = tex((c, W, H) => { c.fillStyle = '#5d666c'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 8) { const g = c.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, '#6c767c'); g.addColorStop(.5, '#545d63'); g.addColorStop(1, '#474f55'); c.fillStyle = g; c.fillRect(x, 0, 6, H); } speckle(c, W, H, { flecks: ['#ffffff18', '#00000020'], count: W * H / 6, size: [1, 2] }); }, 128, 128);
    rib.repeat.set(1200 / 100, 1600 / 100);
    kit.mesh(mat1, new THREE.BoxGeometry(1200, 4, 1600), kit.mat('#ffffff', 'rubber', { map: rib, roughness: .85 }), [0, 2, 0]).castShadow = false;
    { const K = ck('police'); for (const x of [-603, 603]) K.box([24, 5, 1606], [x, 2.5, 0], '#d9b44a'); for (const z of [-803, 803]) K.box([1206, 5, 24], [0, 2.5, z], '#d9b44a'); K.build(mat1, M); }
    // Property drop locker (wall-hugging, six numbered small doors).
    const prop = asset('property-locker', 'Property drop locker', [w / 2 - 240, 0, front - 500]); prop.rotation.y = -Math.PI / 2;
    const k = ck('police');
    k.rubber.box([570, 60, 420], [0, 30, -6], '#15191c'); k.steel.box([600, 1740, 450], [0, 930, 0], P.steel); k.steel.box([610, 20, 460], [0, 1810, 0], shade(P.steel, -.04)); k.box([600, 60, 6], [0, 1720, 228], '#d9b44a');
    tag(k, 'PROPERTY DROP', [360, 50], [0, 1720, 232]);
    for (let n = 0; n < 6; n++) {
        const x = (n % 2 - .5) * 290, y = 1390 - Math.floor(n / 2) * 480;
        k.steel.box([272, 450, 12], [x, y, 231], P.door); k.box([270, 4, 4], [x, y - 228, 230], '#151c22');
        tag(k, `PROPERTY ${n + 1}`, [180, 40], [x, y + 160, 238]); k.brushed.box([196, 52, 3], [x, y + 160, 236.5], '#b7bfc3');
        k.brushed.box([30, 50, 18], [x + 90, y, 245], '#c5ccd0'); k.box([8, 14, 2], [x + 90, y, 254.5], '#2b3236'); k.box([200, 40, 3], [x, y - 160, 238], '#2d3842');
    }
    k.build(prop, M);
    // Coat and vest rail above the locker bank: hi-vis vests and caps.
    const lockerLeft = w / 2 - 760 - 625, boardRight = kit.board.position.x + 1100, vests = [2, 3, 4][i];
    const rail = asset('vest-rail', 'Wall vest and cap rail', [(lockerLeft + boardRight) / 2, 1500, bz + 40], kit.back);
    const r = ck('police'); r.brushed.box([vests * 300 + 40, 30, 40], [0, 360, 0], '#9aa4ab'); for (const x of [-(vests * 150) - 5, vests * 150 + 5]) r.brushed.box([20, 80, 50], [x, 360, -5], '#7d878d');
    tag(r, 'VESTS', [160, 40], [0, 395, 22]);
    for (let n = 0; n < vests; n++) {
        const x = (n - (vests - 1) / 2) * 300;
        r.brushed.box([20, 60, 60], [x, 330, 30], '#5b666d'); r.fabric.box([270, 520, 40], [x, 50, 60], '#d7e04a'); r.fabric.box([120, 120, 42], [x, 270, 60], '#c9d23f');
        for (const y of [-60, 80]) r.hpl.box([274, 34, 42], [x, y, 61], '#e9ece6'); r.box([60, 30, 2], [x - 70, 170, 81], '#1f2b3a');
        r.fabric.box([180, 70, 140], [x, 440, 90], '#1f2b3a'); r.fabric.box([180, 10, 80], [x, 408, 180], '#18222e');
    }
    r.build(rail, M);
    // Notices cork-board, first-aid cabinet, card reader and extinguisher on the door wall.
    const acoustic = kit.byId('acoustic-panels'); if (acoustic && i) acoustic.position.z = bz + 1500;
    const notices = rightAsset(kit, 'notice-board', 'Wall notices cork-board', bz + [3400, 3083, 2767][i], 1550, 30);
    box(notices, [1000, 560, 26], [0, 0, 0], kit.oak, 4);
    panel(kit, notices, (c, W, H) => {
        c.fillStyle = '#b8936a'; c.fillRect(0, 0, W, H); for (let n = 0; n < 2400; n++) { c.fillStyle = n % 2 ? '#a5835c55' : '#cfae8455'; c.fillRect(rnd(n) * W, rnd(n + 900) * H, 2, 2); }
        for (let n = 0; n < 6; n++) {
            const x = 20 + n % 3 * (W - 30) / 3, y = 18 + Math.floor(n / 3) * H / 2, pw = (W - 70) / 3, ph = H / 2 - 30;
            c.fillStyle = '#00000022'; c.save(); c.translate(x + pw / 2 + 3, y + ph / 2 + 3); c.rotate((rnd(n) - .5) * .08); c.fillRect(-pw / 2, -ph / 2, pw, ph); c.restore();
            c.fillStyle = ['#f3f0e4', '#e3ecf1', '#f4ead0', '#e8f0e2', '#f3f0e4', '#f1e1dc'][n]; c.save(); c.translate(x + pw / 2, y + ph / 2); c.rotate((rnd(n) - .5) * .08); c.fillRect(-pw / 2, -ph / 2, pw, ph);
            c.fillStyle = '#4c5d68'; c.font = '600 12px sans-serif'; c.fillText(['NOTICE', 'TRAINING', 'ROSTER', 'SAFETY', 'EVENTS', 'LOST PROPERTY'][n], -pw / 2 + 8, -ph / 2 + 18);
            for (let l = 0; l < 5; l++) c.fillRect(-pw / 2 + 8, -ph / 2 + 30 + l * 14, pw * (.5 + rnd(l + n) * .35), 3);
            if (n === 4) { c.strokeStyle = '#5f8fb3'; c.lineWidth = 3; c.strokeRect(-pw / 2 + 10, 10, pw - 20, ph / 2 - 16); }
            c.fillStyle = '#c0392b'; c.beginPath(); c.arc(0, -ph / 2 + 4, 5, 0, 7); c.fill(); c.restore();
        }
    }, [960, 520], [0, 0, 14], { cw: 768, ch: 416 });
    const aid = rightAsset(kit, 'first-aid', 'Wall first-aid cabinet', bz + [4300, 3833, 3617][i], 1450, 70);
    const a = ck('police'); a.steel.box([360, 360, 130], [0, 0, 0], '#f2f1ea'); a.box([360, 4, 132], [0, 0, 0], '#c7c9c4'); a.box([60, 200, 4], [0, -10, 66], '#2f9d5b'); a.box([200, 60, 4], [0, -10, 66], '#2f9d5b'); a.brushed.box([14, 60, 16], [150, 0, 70], '#9aa4ab'); tag(a, 'FIRST AID', [220, 44], [0, 230, -60]); a.build(aid, M);
    wallSafety(kit, { extZ: front - 2550 });
    // Briefing display, tablet-arm seats and lectern zone (M / L).
    if (i) {
        const zc = bz + 5200;
        // Briefing area: a navy carpet-tile field under the seats and lectern,
        // edged in signal yellow (flat, walkable: not a collider).
        const [fx0, fx1] = i === 1 ? [-500, w / 2 - 450] : [250, w / 2 - 400], fz = 2150, fw = fx1 - fx0;
        const field = asset('briefing-zone', 'Briefing area floor field', [(fx0 + fx1) / 2, 0, zc]);
        const fmap = tex((c, W, H) => drawCarpet(c, W, H, ['#3d4d5e', '#435467', '#6a7f92'], { seed: 5, hatchAlpha: '14' }), 512, 512); fmap.repeat.set(fw / 1000, fz / 1000);
        kit.mesh(field, new THREE.BoxGeometry(fw, 4, fz), kit.mat('#ffffff', 'fabric', { map: fmap, roughness: .95 }), [0, 2, 0]).castShadow = false;
        { const K = ck('police'); for (const s of [-1, 1]) K.box([fw, 5, 30], [0, 2.5, s * (fz / 2 - 15)], '#d9b44a'); K.box([30, 5, fz], [-fw / 2 + 15, 2.5, 0], '#d9b44a'); K.build(field, M); }
        const disp = rightAsset(kit, 'briefing-display', 'Wall briefing display', zc, 1640, 35);
        box(disp, [2200, 1000, 40], [0, 0, 0], kit.metal, 8);
        const dp = panel(kit, disp, (c, W, H) => briefingDisplay(c, W, H, 'morning'), [2140, 940], [0, 0, 22], { cw: 768, ch: 336 });
        (kit.govRedraw ||= []).push({ map: dp.material.map, draw: briefingDisplay });
        { const K = ck('police'); markerTray(K, 2200, -520, 40); tag(K, 'BRIEFING', [220, 50], [-900, 545, 21]); K.build(disp, M); }
        // Large room: a briefing screen beside the board, toward the door.
        if (i === 2) { const scr = rightAsset(kit, 'briefing-screen', 'Wall briefing screen', zc + 1950, 1640, 40); kit.monitor(scr, [0, -200, 0], 1400, 20, true); }
        const rows = i === 1 ? [219, 1219] : [769, 1619, 2469];
        for (let row = 0; row < rows.length; row++) for (let n = 0; n < 3; n++) {
            const seat = asset(`briefing-seat-${row * 3 + n}`, 'Tablet-arm briefing chair', [rows[row], 0, zc - 550 + n * 550]); seat.rotation.y = -Math.PI / 2;
            const s = ck('police');
            s.fabric.box([440, 60, 420], [0, 450, 0], P.seat); s.fabric.box([400, 20, 380], [0, 487, -5], shade(P.seat, .03)); s.fabric.box([440, 380, 40], [0, 680, 200], P.seat); s.hpl.box([440, 380, 8], [0, 680, 224], '#26303a');
            for (const x of [-190, 190]) for (const z of [-170, 170]) { s.steel.box([22, 430, 22], [x, 215, z], '#5b666d'); s.rubber.box([28, 10, 28], [x, 5, z], '#15191c'); }
            for (const z of [-170, 170]) s.steel.box([400, 20, 20], [0, 300, z], '#5b666d');
            s.hpl.box([280, 20, 380], [300, 700, -70], '#c7c3b8'); s.box([284, 22, 3], [300, 700, -261], '#3b4650'); s.steel.box([24, 240, 24], [250, 580, 40], '#5b666d');
            paperSheet(s, 7, 300, 710, -60, 150, 200, 0); s.cyl(5, 4, 130, [370, 714, -60], '#1d2a52');
            s.build(seat, M);
        }
    }
    if (i === 2) {
        // Evidence review table: generic sealed bags with tags and a property log.
        const ev = kit.table('evidence-table', 'Evidence review table', [-300, 0, front - 2733], 1600, 800, 740, govMats.hpl);
        const e = ck('police');
        for (let n = 0; n < 5; n++) {
            const x = -560 + n * 260, z = -120 + (n % 2) * 140;
            e.box([170, 6, 220], [x, 744, z], ['#c9b48a', '#5d6a70', '#e9e5d8', '#8a6a4a', '#2f3b44'][n]); e.glass.box([200, 14, 260], [x, 748, z], '#ffffff');
            e.box([200, 4, 30], [x, 756, z - 115], '#c0392b'); paperSheet(e, 4, x + 40, 756, z + 40, 70, 110, .05);
        }
        notebook(e, 520, 740, 180, '#234e72'); e.box([180, 120, 120], [-640, 800, 220], '#c9b48a'); tag(e, 'EVIDENCE', [150, 40], [-640, 800, 281]); paperSheet(e, 1, 260, 740, 220, 210, 297, .08);
        edgeBand(e, 1600, 800, 722.5, P.edge); e.build(ev, M);
        for (const [n, x] of [-450, 450].entries()) chair(`evidence-chair-${n}`, [-300 + x, 0, front - 2733 + 680], 450);
    }
    if (i) {
        // Kit-check bench between the briefing area and the report table: a low
        // oak-slat bench with duty bags, a folded hi-vis vest and boots beneath.
        const kb = asset('kit-bench', 'Kit-check bench', i === 1 ? [-700, 0, front - 2300] : [900, 0, front - 3950]);
        const K = ck('police');
        for (let n = 0; n < 5; n++) K.oak.box([1600, 28, 62], [0, 436, -132 + n * 66], '#ffffff');
        for (const x of [-700, 700]) { K.steel.box([50, 420, 340], [x, 210, 0], '#3b4650'); K.rubber.box([60, 10, 350], [x, 5, 0], '#15191c'); }
        K.steel.box([1500, 20, 20], [0, 120, 0], '#3b4650');
        K.fabric.box([480, 260, 300], [-380, 580, -10], '#1f2b3a'); K.fabric.box([480, 40, 300], [-380, 720, -10], '#18222e'); K.brushed.box([300, 12, 12], [-380, 745, -10], '#9aa4ab'); K.box([140, 70, 4], [-380, 600, 142], '#d9b44a');
        K.fabric.box([380, 70, 300], [260, 485, 20], '#d7e04a'); for (const z of [-60, 60]) K.hpl.box([382, 72, 30], [260, 486, 20 + z], '#e9ece6');
        for (const x of [-180, 20, 420]) { K.rubber.box([110, 140, 260], [x, 70, 40], '#15191c'); K.rubber.box([110, 40, 120], [x, 160, -30], '#15191c'); }
        K.build(kb, M);
    }
    // Report / briefing table chairs on the front side.
    const act = kit.layout.activity;
    for (let n = 0; n < 2; n++) chair(`briefing-chair-${n}`, [act[0] + (n - .5) * 600, 0, act[1] + 650], 450);
    { const actT = kit.byId('activity-table'); if (actT) { const K = ck('police'); edgeBand(K, 1300, 650, 722.5, P.edge); K.build(actT, M); } }
    // Venetian blinds tinted aluminium and a snake plant on the sill.
    roomBlinds(kit, 2);
    const sill = ck('police'); snakePlant(sill, -d * .12, -860, 90); sill.build(kit.window, M);
}
// Briefing display per daypart: patrol-area map with the session's agenda
// panel (briefings) or a slim header (generic content only).
function briefingDisplay(c, W, H, phase) {
    const i = phaseIndex(phase), briefing = i === 0 || i === 4;
    beatMap(c, 0, 0, W, H, 3);
    c.fillStyle = '#234e72'; c.fillRect(0, 0, W, 34); c.fillStyle = '#f1f3ef'; c.font = '600 20px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(['BRIEFING 09:00', 'CASE REVIEW 14:00 · PATROL AREA', 'SHIFT CHANGE 18:00 · PATROL AREA', 'NIGHT SHIFT · PATROL AREA', 'TEAM BRIEFING 16:00'][i], 14, 24);
    if (!briefing) return;
    c.fillStyle = '#1c3a52ee'; c.fillRect(0, 34, W * .42, H - 34);
    c.fillStyle = '#d9b44a'; c.font = '600 18px sans-serif'; c.fillText(i ? 'TODAY · TEAM ITEMS' : 'AGENDA', 18, 66);
    (i ? ['Community event cover', 'Training updates', 'Station tidy-up rota', 'Questions'] : ['Overnight summary', 'Beat priorities', 'Road works on Beat 2', 'Safety reminders']).forEach((t, n) => { c.fillStyle = '#d9b44a'; c.fillRect(20, 88 + n * 46, 12, 12); c.fillStyle = '#e4ecf1'; c.font = '17px sans-serif'; c.fillText(t, 42, 99 + n * 46, W * .42 - 52); });
}
function snakePlant(k, x, y, z) {
    (k.hpl || k).cyl(70, 55, 140, [x, y + 70, z], '#d6d0c2'); k.box([120, 6, 120], [x, y + 136, z], '#3b2f25');
    for (let n = 0; n < 9; n++) k.box([34, 280 + rnd(n) * 160, 8], [x + (rnd(n + 3) - .5) * 80, y + 280, z + (rnd(n + 7) - .5) * 70], n % 2 ? '#4f7046' : '#6c8a4b', [(rnd(n + 1) - .5) * .25, n, (rnd(n + 2) - .5) * .25]);
}
function decorateGovernment(kit) {
    const { w, d, bz, front, index: i, asset, box, chair, govMats } = kit, M = roomMats(kit), P = pal('government');
    header(kit, 'SERVICE CENTRE', { bg: '#b99a72', fg: '#2c3d3b', font: '600 66px Georgia, serif' });
    // Oak slat feature panel behind the caseworker bench (window end of the back wall):
    // vertical-grain battens on a dark acoustic felt backing with an oak cap.
    // Wall-anchored: it reaches the floor, so RoomInteractions would otherwise
    // re-parent it to the root as floor furniture (left standing in the cutaway).
    const slats = asset('feature-slats', 'Wall oak slat feature', [-w / 2 + 1250, 1150, bz + 25], kit.back); slats.userData.propAnchor = 'wall';
    const k = ck('government');
    for (let n = 0; n < 20; n++) k.oakV.box([22, 2100, 30], [-1140 + n * 120, 0, 0], n % 3 ? '#ffffff' : '#f2e8da');
    k.fabric.box([2380, 2100, 8], [0, 0, -14], '#2e2a25'); k.oak.box([2400, 40, 40], [0, 1070, 0], '#e9dcc6'); k.oak.box([2400, 30, 44], [0, -1035, 2], '#e9dcc6');
    k.build(slats, M);
    // Public zone: porcelain-look floor on the visitor side of the counters,
    // from the back of the waiting area to the open front. Visitors enter by
    // the door, take a number at the kiosk, wait on the wall bench (M/L: under
    // the community gallery) or in the front corner, and are called forward.
    const counterX = GOV_COUNTER_X[i], cx = counterX + 381 + 60, door = front - 1600, W2 = w / 2;
    const z0 = [front - 3200, front - 5600, front - 7050][i], pw = W2 - cx, pd = front - z0;
    const pub = asset('public-zone', 'Public zone porcelain floor', [(cx + W2) / 2, 0, (z0 + front) / 2]);
    const pmap = tex((c, W, H) => drawPorcelain(c, W, H, P.porcelain), 512, 512), prough = tex((c, W, H) => drawPorcelain(c, W, H, P.porcelain, true), 256, 256, false);
    pmap.repeat.set(pw / 1200, pd / 1200); prough.repeat.copy(pmap.repeat);
    kit.mesh(pub, new THREE.BoxGeometry(pw, 4, pd), kit.mat('#ffffff', null, { map: pmap, roughnessMap: prough, roughness: 1 }), [0, 2, 0]).castShadow = false;
    { const K = ck('government'); K.brushed.box([8, 5, pd], [-pw / 2 - 4, 2.5, 0], '#b39b6a'); K.brushed.box([pw, 5, 8], [0, 2.5, -pd / 2 - 4], '#b39b6a'); K.build(pub, M); }
    // "WAIT HERE" floor decals 1 m in front of each counter.
    const counterZ = i ? [front - 3300, front - 1780] : [front - 1840];
    for (const [n, z] of counterZ.entries()) {
        const decal = kit.mesh(pub, new THREE.PlaneGeometry(600, 300), kit.canvasMat(signText('WAIT HERE', '#395d60', '#f1efe6', '600 60px sans-serif'), 256, 128), [counterX + 381 + 900 - (cx + W2) / 2, 6, z - (z0 + front) / 2]);
        decal.rotation.x = -Math.PI / 2; decal.rotation.z = Math.PI / 2; decal.castShadow = false;
        // Suspended counter number sign above each counter.
        const hang = asset(`counter-sign-${n + 1}`, 'Suspended counter sign', [counterX + 200, kit.ceiling - 700, z]);
        for (const s of [-1, 1]) kit.rod(hang, [0, 200, s * 300], [0, 680, s * 300], 4, kit.metal);
        box(hang, [60, 280, 760], [0, 60, 0], govMats.sage, 8);
        for (const s of [-1, 1]) panel(kit, hang, signText(`${n + 1}`, '#395d60', '#f1efe6', '600 150px Georgia, serif'), [240, 240], [s * 32, 60, -230], { cw: 128, ch: 128, rotY: s * Math.PI / 2 });
        for (const s of [-1, 1]) panel(kit, hang, signText(i && n === 1 || !i ? 'COUNTER · ACCESSIBLE' : 'COUNTER', '#395d60', '#f1efe6', '600 40px sans-serif'), [470, 120], [s * 32, 60, 120], { cw: 512, ch: 128, rotY: s * Math.PI / 2 });
        const K = ck('government'); for (const s of [-1, 1]) K.brushed.box([62, 8, 40], [0, 200, s * 300], '#b39b6a'); K.brushed.box([64, 6, 762], [0, -82, 0], '#b39b6a'); K.build(hang, M);
    }
    // Wall waiting bench: oak frame, sage seat and back pads on a sage panel.
    // Small: two seats by the front with the brochure rack above; Medium /
    // Large: four seats (two pairs) under the community gallery.
    const seatN = i ? 4 : 2, benchL = seatN * 410 + 40 + (i ? 60 : 0), benchZ = i ? door - 2250 : front - 500;
    const seats = asset('waiting-seats', 'Wall waiting bench', [W2 - 240, 0, benchZ]); seats.rotation.y = -Math.PI / 2;
    const s = ck('government'), seatX = n => (n - (seatN - 1) / 2) * 410 + (i ? (n < 2 ? -30 : 30) : 0);
    // (Local +z faces the room: the back panel and rack sit against the wall at -z.)
    s.oak.box([benchL, 50, 440], [0, 440, 0], '#ffffff');
    for (let n = 0; n < seatN; n++) { s.fabric.box([380, 50, 400], [seatX(n), 490, 0], P.seat); s.fabric.box([360, 6, 380], [seatX(n), 516, 0], shade(P.seat, .04)); s.fabric.box([360, 300, 40], [seatX(n), 720, -180], shade(P.seat, .06)); }
    s.hpl.box([benchL + 20, 700, 30], [0, 820, -215], P.dado);
    for (const x of [-benchL / 2 + 40, benchL / 2 - 40]) { s.oak.box([50, 420, 380], [x, 210, 0], '#efe3d0'); s.rubber.box([56, 10, 386], [x, 5, 0], '#2b2621'); }
    for (let n = 1; n < seatN; n++) if (!(i && n === 2)) s.oak.box([30, 160, 300], [(seatX(n - 1) + seatX(n)) / 2, 560, -10], '#efe3d0');
    if (i) { s.oak.box([90, 160, 300], [0, 560, -10], '#efe3d0'); s.oak.box([110, 8, 300], [0, 644, -10], '#ffffff'); paperSheet(s, 5, 0, 648, 20, 90, 130, .1); }
    const rack = (K, y, z, lean = 0) => {
        // Brochure rack: oak with three pockets of printed leaflets.
        K.oak.box([600, 360, 80], [0, y, z], '#ffffff');
        for (let n = 0; n < 3; n++) { const x = -190 + n * 190; K.glass.box([170, 220, 4], [x, y - 40, z + 42], '#ffffff'); K.paper.add(atlasPlane(150, 250, [0, 5, 4][n], 4, 2), [x, y + 30, z + 38], ['#e9f1ec', '#f7efdc', '#e8eef4'][n], [1, 1, 1], [-.08, 0, 0]); K.paper.add(atlasPlane(150, 250, [0, 5, 4][n], 4, 2), [x, y + 30, z + 32], '#ffffff', [1, 1, 1], [-.08, 0, 0]); }
        tag(K, 'PLEASE TAKE ONE', [300, 50], [0, y + 210, z - 39 + lean]);
    };
    if (!i) { rack(s, 1450, -190); }
    s.build(seats, M);
    // Ticket kiosk where visitors arrive, the queue display above it (S: above the bench).
    const kz = i ? door - 900 : front - 3500;
    const qd = rightAsset(kit, 'queue-display', 'Wall queue display', i ? kz : front - 500, i ? 2150 : 2050, 40);
    kit.monitor(qd, [0, -200, 0], 820, 20, true);
    const kiosk = asset('queue-kiosk', 'Queue ticket kiosk', [W2 - (i ? 380 : 450), 0, kz]); kiosk.rotation.y = -Math.PI / 2;
    const q = ck('government');
    q.steel.box([380, 60, 300], [0, 30, 0], '#2f4447'); q.brushed.box([120, 900, 120], [0, 480, 0], '#9aa4ab'); q.steel.box([420, 560, 140], [0, 1180, 10], P.seat, [-.12, 0, 0]);
    q.box([340, 260, 6], [0, 1250, 82], '#d9e6e0', [-.12, 0, 0]); q.box([120, 14, 30], [0, 1010, 70], '#1d2427'); q.box([70, 4, 50], [0, 1000, 90], '#f1efe6'); q.brushed.box([380, 90, 8], [0, 1480, 60], '#b39b6a');
    q.build(kiosk, M);
    panel(kit, kiosk, signText('TAKE A NUMBER', '#395d60', '#f1efe6', '600 44px sans-serif'), [330, 70], [0, 1480, 66], { cw: 384, ch: 80 });
    if (i) {
        // Front waiting corner: a brochure rack on the wall over a round wool rug
        // (the lounge chair and fig are library props, see sceneOverrides).
        const br = rightAsset(kit, 'brochure-rack', 'Wall brochure rack', front - 650, 1450, 40);
        const r = ck('government'); rack(r, 0, 40); r.build(br, M);
        const corner = asset('waiting-rug', 'Waiting corner rug', [W2 - 1150, 0, front - 770]);
        const rmap = tex((c, W, H) => {
            c.fillStyle = '#c9bea6'; c.fillRect(0, 0, W, H);
            for (let n = 0; n < 9; n++) { c.strokeStyle = n % 3 === 1 ? '#7f9a8b' : n % 3 === 2 ? '#b39b6a' : '#ddd3bd'; c.lineWidth = n % 3 === 1 ? 10 : 4; c.beginPath(); c.arc(W / 2, H / 2, W * .47 - n * 22, 0, TAU); c.stroke(); }
            speckle(c, W, H, { flecks: ['#efe7d455', '#a8987a40'], count: W * H / 6, size: [1, 3] });
        }, 512, 512);
        rmap.wrapS = rmap.wrapT = THREE.ClampToEdgeWrapping;
        kit.mesh(corner, new THREE.CylinderGeometry(750, 750, 6, 48), kit.mat('#ffffff', 'fabric', { map: rmap, roughness: .96 }), [0, 3, 0]).castShadow = false;
    }
    if (i === 2) selfService(kit, [W2 - 280, front - 6550]);
    staffCredenza(kit);
    // Door wall: accessibility plaque, hand sanitiser, three civic prints, notice.
    wallSafety(kit, { reader: false, extZ: bz + 800, extSign: false });
    const san = rightAsset(kit, 'hand-sanitiser', 'Wall hand-sanitiser station', front - 2350, 1150, 60);
    const h = ck('government'); h.hpl.box([120, 260, 110], [0, 0, 0], '#f1efe6'); h.box([80, 80, 6], [0, 40, 57], '#395d60'); h.brushed.box([30, 40, 40], [0, -150, 30], '#c7c3b8'); h.glass.box([70, 90, 4], [0, -50, 57], '#ffffff'); tag(h, 'HAND SANITISER', [200, 50], [0, 210, -54]); h.build(san, M);
    const gallery = rightAsset(kit, 'identity-gallery', 'Wall community gallery', i ? benchZ : bz + d * .47, i ? 1740 : 1620, 30);
    const prints = [['PARK', '#8fb39a'], ['LIBRARY', '#c9b48a'], ['RIVERSIDE', '#7fa7b8']];
    const gk = ck('government');
    prints.forEach(([title, tone], n) => {
        const x = (n - 1) * 640; box(gallery, [560, 720, 30], [x, 0, 0], kit.oak, 5);
        gk.box([520, 680, 4], [x, 0, 16], '#f4f0e6');
        panel(kit, gallery, (c, W, H) => civicPrint(c, W, H, n, tone, title), [440, 600], [x, 0, 19], { cw: 240, ch: 320 });
        gk.glass.box([520, 680, 2], [x, 0, 22], '#ffffff');
    });
    gk.build(gallery, M);
    // Sheer roller blinds, an oak sill with three small pots.
    roomBlinds(kit, 3);
    const sill = ck('government'); sill.oak.box([d * .48 + 80, 30, 160], [0, -880 + 30, 80], '#ffffff');
    for (let n = 0; n < 3; n++) { const x = (n - 1) * d * .12; sill.hpl.cyl(60, 46, 110, [x, -850 + 55, 90], ['#d6d0c2', '#b07a5a', '#e6e2d8'][n]); plant(sill, x, -850 + 100, 90, .32); }
    sill.build(kit.window, M);
    // Fig in the front corner of the public zone (moves the shell planter).
    const planter = kit.byId('corner-planter'); if (planter) planter.position.set(i ? W2 - 330 : W2 - 900, 0, front - (i ? 330 : 380));
    // Floor zoning: the caseworker bench stands on a deeper carpet-tile field
    // (oak edge toward the room); the public service workstation on a wool rug.
    const row1 = bz + 1900, fx1 = i ? counterX + 800 : W2 - 60, fz1 = row1 + 1450, fw = fx1 + W2, fd = fz1 - bz;
    const bench = asset('bench-zone', 'Caseworker zone carpet field', [(fx1 - W2) / 2, 0, (bz + fz1) / 2]);
    const bmap = tex((c, W, H) => drawCarpet(c, W, H, ['#6f675b', '#746b5f', '#8f8676'], { seed: 7, hatchAlpha: '0c' }), 512, 512); bmap.repeat.set(fw / 1000, fd / 1000);
    kit.mesh(bench, new THREE.BoxGeometry(fw, 3, fd), kit.mat('#ffffff', 'fabric', { map: bmap, roughness: .95 }), [0, 1.5, 0]).castShadow = false;
    { const K = ck('government'); K.oak.box([fw, 5, 40], [0, 2.5, fd / 2 - 20], '#ffffff'); K.oak.box([40, 5, fd], [fw / 2 - 20, 2.5, 0], '#ffffff'); K.build(bench, M); }
    if (i) {
        const ws = kit.byId('workstation-0');
        const wr = asset('workstation-rug', 'Public service workstation rug', [ws.position.x, 0, ws.position.z + 330]);
        const wmap = tex((c, W, H) => {
            c.fillStyle = '#8fa393'; c.fillRect(0, 0, W, H);
            for (let y = 0; y < H; y += 4) { c.fillStyle = (y / 4) % 2 ? '#9db0a033' : '#7d918130'; c.fillRect(0, y, W, 2); }
            c.strokeStyle = '#e4dccb'; c.lineWidth = 16; c.strokeRect(26, 26, W - 52, H - 52); c.strokeStyle = '#b39b6a'; c.lineWidth = 4; c.strokeRect(46, 46, W - 92, H - 92);
            speckle(c, W, H, { flecks: ['#ffffff22', '#00000018'], count: W * H / 8, size: [1, 3] });
        }, 512, 400);
        wmap.wrapS = wmap.wrapT = THREE.ClampToEdgeWrapping;
        kit.mesh(wr, new THREE.BoxGeometry(2300, 5, 1800), kit.mat('#ffffff', 'fabric', { map: wmap, roughness: .96 }), [0, 2.5, 0]).castShadow = false;
    }
    // Team / consultation table chairs on the front side.
    const act = kit.layout.activity;
    for (let n = 0; n < (i === 2 ? 3 : 2); n++) chair(`team-chair-${n}`, [act[0] + (n - (i === 2 ? 1 : .5)) * 560, 0, act[1] + 650], 450);
    { const actT = kit.byId('activity-table'); if (actT) { const K = ck('government'); edgeBand(K, 1300, 650, 722.5, P.edge); K.build(actT, M); } }
    // Oatmeal wool rug under the team / consultation table: loop pile, border.
    const rug = asset('team-rug', 'Team table rug', [act[0], 0, Math.min(act[1] + 250, front - 820)]);
    const rugMap = tex((c, W, H) => {
        c.fillStyle = '#d8cfbd'; c.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { c.fillStyle = (x + y) % 6 ? '#e2d9c722' : '#b8aa8e30'; c.fillRect(x, y, 2, 2); }
        c.strokeStyle = '#a8987a'; c.lineWidth = 14; c.strokeRect(22, 22, W - 44, H - 44); c.strokeStyle = '#efe7d4'; c.lineWidth = 3; c.strokeRect(40, 40, W - 80, H - 80);
        speckle(c, W, H, { flecks: ['#efe7d455', '#a8987a40'], count: W * H / 8, size: [1, 3] });
    }, 512, 410);
    rugMap.wrapS = rugMap.wrapT = THREE.ClampToEdgeWrapping;
    kit.mesh(rug, new THREE.BoxGeometry(2000, 5, 1600), kit.mat('#ffffff', 'fabric', { map: rugMap, roughness: .96 }), [0, 2.5, 0]).castShadow = false;
}
// Large room: a wall-hugging self-service point in the public zone (standing
// height, two lit form / payment tablets with a privacy fin, card reader).
function selfService(kit, [x, z]) {
    const P = pal('government'), g = kit.asset('self-service', 'Self-service point', [x, 0, z]); g.rotation.y = -Math.PI / 2;
    const K = ck('government');
    K.rubber.box([1240, 60, 380], [0, 30, -30], '#2b2621'); K.steel.box([1300, 930, 420], [0, 525, -30], P.seat); K.oak.box([1340, 30, 480], [0, 1005, 0], '#ffffff');
    K.brushed.box([1342, 4, 4], [0, 990, 241], '#b39b6a'); K.oak.box([1340, 520, 24], [0, 1280, -228], '#f1e6d6'); K.oak.box([24, 380, 360], [0, 1210, -40], '#efe3d0');
    for (const sx of [-1, 1]) {
        const tx = sx * 330;
        K.brushed.box([70, 110, 50], [tx, 1075, -70], '#8e989e', [-.35, 0, 0]); K.box([330, 236, 16], [tx, 1150, -50], '#1d2427', [-.35, 0, 0]);
        K.hpl.box([110, 70, 150], [tx + sx * 230, 1055, 60], '#2b3336'); K.box([70, 4, 40], [tx + sx * 230, 1091, 50], '#3c6f78');
        paperSheet(K, 0, tx - sx * 10, 1020, 150, 150, 210, sx * .12);
    }
    K.build(g, roomMats(kit));
    for (const sx of [-1, 1]) {
        const p = panel(kit, g, (c, W, H) => {
            c.fillStyle = '#f2efe6'; c.fillRect(0, 0, W, H); c.fillStyle = '#395d60'; c.fillRect(0, 0, W, 44); c.fillStyle = '#f1efe6'; c.font = '600 22px sans-serif'; c.fillText('SELF-SERVICE', 14, 30);
            ['Apply for a permit', 'Request a record', 'Make a payment', 'Book an appointment'].forEach((t, n) => { c.fillStyle = n === (sx > 0 ? 2 : 0) ? '#b39b6a' : '#dfe7e1'; c.fillRect(14, 58 + n * 40, W - 28, 32); c.fillStyle = '#24302e'; c.font = '17px sans-serif'; c.fillText(t, 26, 80 + n * 40); });
        }, [300, 208], [sx * 330, 1152, -41], { cw: 256, ch: 224, glow: .55 });
        p.rotation.x = -.35;
    }
    panel(kit, g, signText('SELF-SERVICE · FORMS & PAYMENTS', '#395d60', '#f1efe6', '600 40px sans-serif'), [1000, 110], [0, 1440, -215], { cw: 768, ch: 84 });
}
// Staff print-and-supply credenza under the service board (back office):
// oak carcass with sage doors, a multifunction printer, paper and a plant.
function staffCredenza(kit) {
    const { bz, index: i } = kit, L = [1100, 1900, 1900][i], x = i ? kit.board.position.x : 800, P = pal('government');
    const g = kit.asset('staff-credenza', 'Staff print and supply credenza', [x, 0, bz + 262]);
    const K = ck('government');
    K.rubber.box([L - 40, 60, 420], [0, 30, -6], '#2b2621'); K.oak.box([L, 690, 450], [0, 405, 0], '#e8dcc8'); K.oak.box([L + 20, 30, 470], [0, 765, 6], '#ffffff');
    const n = Math.round(L / 460), dw = L / n;
    for (let k = 0; k < n; k++) {
        const dx = -L / 2 + dw * (k + .5);
        K.steel.box([dw - 12, 620, 14], [dx, 405, 231], P.dado); K.brushed.box([12, 120, 18], [dx + (k % 2 ? -dw / 2 + 50 : dw / 2 - 50), 520, 246], '#b39b6a');
    }
    if (n > 2) tag(K, 'FORMS', [140, 40], [-L / 2 + dw * 1.5, 650, 239]);
    // Multifunction printer: body, scanner lid, paper drawers, panel, output.
    const px = -L / 2 + 330;
    K.hpl.box([560, 360, 520], [px, 960, -10], '#dfe1de'); K.hpl.box([560, 70, 500], [px, 1175, -20], '#c9ccc9'); K.box([520, 6, 440], [px, 1213, -20], '#2b3336');
    for (let k = 0; k < 2; k++) { K.box([540, 4, 4], [px, 830 + k * 90, 252], '#9aa0a0'); K.box([120, 14, 8], [px, 870 + k * 90, 254], '#7d8484'); }
    K.box([200, 14, 90], [px + 150, 1140, 220], '#26323a', [-.3, 0, 0]); K.box([140, 4, 50], [px + 150, 1148, 226], '#5fb0b8', [-.3, 0, 0]); K.box([10, 6, 6], [px + 240, 1150, 250], '#45d07a');
    K.box([380, 10, 260], [px - 40, 1110, 120], '#c9ccc9'); paperSheet(K, 0, px - 40, 1115, 120, 210, 260, .03);
    // Paper reams, a forms tray, a file box and a plant.
    for (let k = 0; k < 3; k++) { K.box([300, 55, 215], [px + 470, 808 + k * 56, -40 + (k % 2) * 8], k % 2 ? '#f4f2ea' : '#e9eef0', [0, (k - 1) * .05, 0]); K.box([302, 14, 217], [px + 470, 808 + k * 56, -40 + (k % 2) * 8], '#7f9a8b', [0, (k - 1) * .05, 0]); }
    if (i) { K.oak.box([340, 80, 260], [px + 860, 820, 0], '#ffffff'); paperSheet(K, 0, px + 860, 860, 0, 210, 297, -.04); K.box([300, 260, 330], [L / 2 - 420, 910, -20], '#d9cdb4'); tag(K, 'ARCHIVE', [150, 40], [L / 2 - 420, 900, 146]); }
    plant(K, L / 2 - 140, 780, 0, .5);
    K.build(g, roomMats(kit));
}
function civicPrint(c, W, H, n, tone, title) {
    c.fillStyle = '#efe9da'; c.fillRect(0, 0, W, H); c.fillStyle = tone; c.fillRect(14, 14, W - 28, H * .72);
    c.fillStyle = '#f6efd8'; c.beginPath(); c.arc(W * .72, H * .17, 18, 0, 7); c.fill();
    if (n === 0) { for (let t = 0; t < 4; t++) { c.fillStyle = '#4f7356'; c.beginPath(); c.ellipse(40 + t * 55, H * .5 - t % 2 * 14, 26, 40, 0, 0, 7); c.fill(); c.fillRect(38 + t * 55, H * .5, 4, 40); } c.fillStyle = '#d9cfa8'; c.fillRect(14, H * .62, W - 28, 12); }
    if (n === 1) { c.fillStyle = '#efe6cf'; c.fillRect(40, H * .28, W - 80, H * .36); c.fillStyle = '#b8a27a'; for (let col = 0; col < 5; col++) c.fillRect(52 + col * (W - 104) / 5, H * .34, 12, H * .3); c.beginPath(); c.moveTo(30, H * .28); c.lineTo(W / 2, H * .16); c.lineTo(W - 30, H * .28); c.fill(); }
    if (n === 2) { c.fillStyle = '#5d8ea3'; c.beginPath(); c.moveTo(14, H * .6); c.bezierCurveTo(W * .4, H * .5, W * .6, H * .7, W - 14, H * .55); c.lineTo(W - 14, H * .74); c.lineTo(14, H * .74); c.fill(); c.strokeStyle = '#efe9da'; c.lineWidth = 4; c.beginPath(); c.arc(W / 2, H * .62, 60, Math.PI, 0); c.stroke(); }
    c.fillStyle = '#3c4a47'; c.font = '600 20px Georgia, serif'; c.fillText(title, 18, H * .86); c.font = '12px sans-serif'; c.fillText('COMMUNITY PRINT SERIES', 18, H * .93);
}
// After every furnishing exists: box-project the mapped shell materials.
export function finishDecor(kit) { applyUV(kit.root); }
// Per-daypart briefing / planning-table kit on the activity table. Built into
// the variant group the shell just created (the shell's own kit stays empty).
export function activityMaterials(k0, phase, y, kit) {
    const kind = kit.spec.kind, act = kit.byId('activity-table'), g = act?.children[act.children.length - 1], k = ck(kind);
    if (kind === 'operations') {
        // Roster, radios, earpiece box, tablet; handover shows both rosters.
        if (phase === 0 || phase === 4) { paperSheet(k, 1, 180, y, -40, 210, 297, .06); if (phase === 4) paperSheet(k, 1, -120, y + .4, 30, 210, 297, -.1); }
        if (phase !== 3) { k.rubber.box([60, 140, 34], [380, y + 70, 120], '#1d2427'); k.rubber.box([10, 60, 10], [395, y + 170, 120], '#1d2427'); k.box([150, 45, 110], [-60, y + 22, -180], '#2b3336'); k.box([120, 2, 80], [-60, y + 45.5, -180], '#48aeb0'); }
        if (phase === 1 || phase === 4) for (const x of [460, 520]) { k.cyl(40, 34, 95, [x, y + 47, -150 + (x - 460) * 2], '#e6e3da'); }
        if (phase === 2) for (let n = 0; n < 4; n++) sheet(k, 120 + n * 30, y + n * 2, -60 + n * 25, 210, 297, (n - 2) * .1, '#ffffff', [5, 4, 0, 5][n]);
        if (phase === 3) { notebook(k, 200, y, -40, '#3c4c55'); k.rubber.box([60, 140, 34], [420, y + 70, 100], '#1d2427'); }
        k.hpl.box([200, 12, 280], [-260, y + 6, 40], '#1a2227'); k.box([180, 2, 250], [-260, y + 13, 40], '#3c6f78');
        k.rubber.cyl(40, 40, 4, [520, y + 2, 160], '#3a3f42'); k.cyl(38, 38, .5, [520, y + 4.3, 160], '#6a5a49');
    } else if (kind === 'police') {
        if (phase === 0 || phase === 4) for (let n = 0; n < 3; n++) notebook(k, -220 + n * 240, y, 60, ['#234e72', '#5e7480', '#8a7a5c'][n]);
        if (phase === 0) paperSheet(k, 6, 360, y, -120, 297, 210, .05);
        if (phase === 1) { folderStack(k, 200, y, -40, 4); paperSheet(k, 7, -200, y, 20, 210, 297, -.08); }
        if (phase === 2) { card(k, 160, y, -40, 297, 210, '#efece4', 7); k.cyl(40, 34, 95, [460, y + 47, 140], '#e6e3da'); }
        if (phase === 3) k.rubber.box([60, 140, 34], [380, y + 70, 100], '#1d2427');
        if (phase === 4) for (const x of [420, 500, 560]) k.cyl(40, 34, 95, [x, y + 47, -150 + (x - 420)], '#e6e3da');
    } else {
        if (phase === 0) for (let n = 0; n < 6; n++) k.box([75, 2, 75], [120 + n % 3 * 85, y + 1, -120 + Math.floor(n / 3) * 85], ['#f2d36b', '#9fd0b4', '#f0a98f'][n % 3]);
        if (phase === 1) { for (let n = 0; n < 3; n++) sheet(k, 160 + n * 25, y + n * 2, -40 + n * 18, 210, 297, (n - 1) * .1, '#ffffff', [0, 4, 0][n]); k.box([110, 20, 70], [460, y + 10, 140], '#2a3b3f'); }
        if (phase === 2) folderStack(k, 220, y, -40, 3, ['#c7d6cc', '#d8c08d', '#c9b07a']);
        if (phase === 3) notebook(k, 300, y, -60, '#6c8680');
        if (phase === 4) { for (let n = 0; n < 12; n++) k.box([75, 2, 75], [-60 + n % 4 * 85, y + 1, -140 + Math.floor(n / 4) * 85], ['#f2d36b', '#9fd0b4', '#f0a98f', '#a9c7e6'][n % 4]); for (const x of [400, 470]) k.cyl(40, 34, 95, [x, y + 47, 150], '#e6e3da'); }
    }
    if (g) k.build(g, roomMats(kit)); else void k0;
}
// Per-phase group changes: window view, blinds, zone clocks and glow strength.
export function atmosphere(phase, gain, kit) {
    const i = phaseIndex(phase), kind = kit.spec.kind;
    drawView(kit, phase, gain);
    // Blind drop per daypart: the handover / briefing / workshop afternoon
    // raises or half-draws them so it reads apart from the working afternoon.
    const drop = { operations: [.55, .85, .9, 1, .32], police: [.25, .3, .5, .7, .45], government: [.15, .25, .5, .6, .42] }[kind][i];
    setBlinds(kit, drop);
    if (kit.govPhase !== phase) {
        for (const r of kit.govRedraw || []) { const c = r.map.image.getContext('2d'); c.save(); r.draw(c, r.map.image.width, r.map.image.height, phase); c.restore(); r.map.needsUpdate = true; }
        (kit.govClocks || []).forEach((face, n) => { const map = face.material.map, c = map.image.getContext('2d'); clockFace(c, map.image.width, map.image.height, [9, 14, 18, 22, 16][i] + n * 3, `SITE ${'ABC'[n]}`); map.needsUpdate = true; });
        kit.govPhase = phase;
    }
    const L = LIGHT[kind], look = kit.spec.modes[phase] || {};
    ensureCeiling(kit);
    // Emissive lines (dado line, bias halo, nosing, status lamps) and the
    // shell strips, now one lens material per strip.
    for (const { m, base } of kit.govGlow || []) m.emissiveIntensity = base * L.glow[i] * gain;
    for (const { m, levels } of kit.govStrips || []) { m.color.set(L.ceiling[0]); m.emissive.set(L.ceiling[0]); m.emissiveIntensity = levels[i] * gain; }
    // Room light over the main desk and the two local lamps.
    if (kit.lights?.[0]) kit.lights[0].intensity *= L.desk[i];
    (kit.lamps || []).forEach(({ light, luminous }, n) => {
        const v = L.lamps[n]?.[i]; if (v === undefined) return;
        light.intensity = (kit.root.scale.x * 1000) ** 2 * v * gain; luminous.emissiveIntensity = .1 + v * gain * 1.3;
    });
    // Wall displays (video wall, briefing screens, queue display).
    for (const m of kit.screenMats || []) m.emissiveIntensity = L.screens[i] * Math.min(gain, 1.3);
    kit.govSun?.(phase, look.key || '#fff4e0', L.sun[i] * Math.min(gain, 1.4), drop);
    // Pools, lenses and desk screens in the room and on the stations; the main
    // desk's dressing is outside the room root, so it is updated from its list.
    const now = CURRENT[kit.spec.id] = kit.root.userData.govPhase = { phase, gain };
    applyPhase(kit.root, now);
    for (let n = MAIN_DETAIL.length - 1; n >= 0; n--) {
        const e = MAIN_DETAIL[n], on = attached(e.g);
        if (!on) { if (e.seen || !e.g.parent) MAIN_DETAIL.splice(n, 1); continue; }   // dressing replaced
        e.seen = true; if (e.sceneId === kit.spec.id) applyPhase(e.g, now);
    }
}

// ---- Daily staging (room-life.mjs) --------------------------------------
// ctx: { life, h, m (staging materials), g, y, phase, active, social, quiet, small, spec, THREE }
export function stageKit({ h, m, g, y, social, quiet }) {
    if (!quiet) for (let n = 0; n < (social ? 4 : 2); n++) h.box(g, [45, 2, 60], [105 + n % 2 * 55, y + 1, -50 + Math.floor(n / 2) * 70], n % 2 ? m.clay : m.paper, 2);
}
