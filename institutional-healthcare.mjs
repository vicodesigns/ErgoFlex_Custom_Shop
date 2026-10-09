import * as THREE from 'three';
import { institutionalMap, institutionalFloor, rnd, boardFrame, detailKit, notebook, plant } from './institutional-detail.mjs?v=institutional-sweep-20261009';

// Healthcare group: `hospital` Hospital workspace and `laboratory` Science
// laboratory (kinds hospital / lab). This module owns the group's registry
// overrides, extra ErgoFlex stations, displays, furnishings, decor and daily
// staging. Shared shell and helpers: institutional-room.mjs (kit) and
// institutional-detail.mjs.
//
//   hospital    an inpatient ward bay. Beds head to a services headwall
//               (medical gases, suction, nurse call, reading light, vitals
//               monitor arm) with ceiling-track cubicle curtains (drawn at
//               night). Documentation happens at the point of care: the main
//               ErgoFlex is a nurse workstation on wheels beside bed 1; a
//               barcode-scanned medication station, physician charting, charge
//               nurse, telehealth, pharmacist and discharge planning desks
//               follow with the room size. Staff zone with a handover table and
//               unit huddle board on the door side.
//   laboratory  a teaching and research wet lab with a separate dry
//               (write-up) zone along the window: analysis, instrument control
//               and microscopy ErgoFlex desks; island benches with reagent
//               shelving and a service spine; fume hood, flammables cabinet,
//               sample fridge and reagent cabinet on the back wall; wash,
//               eyewash and safety shower and the PPE station by the exit.
// Everything is illustrative and generic: no patient, product or regulatory
// content. No food or drink on clinical or laboratory work surfaces (mugs only
// on the hospital handover table and the lab PI's office desk).
export const GROUP = 'healthcare';
export const SCENES = ['laboratory', 'hospital'];
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const phaseIndex = phase => Math.max(0, PHASES.indexOf(phase));
const TAU = Math.PI * 2, rad = d => d * Math.PI / 180;
const P = (id, at, turn, extra) => ({ id, at, ...(turn ? { turn } : {}), ...(extra || {}) });
const LABELS = { hospital: ['Morning rounds', 'Care coordination', 'Evening handover', 'Night observation', 'Team review'], lab: ['Lab preparation', 'Practical session', 'Analysis', 'Instrument watch', 'Research review'] };

// ---- Registry data (merged by institutional-scenes.mjs) -----------------
// Per-kind light balance: practical / wash per phase, task and bounce colours.
export const lighting = {
    lab: { practical: [.42, .5, .88, .62, .84], wash: [.2, .2, .35, .18, .38], task: '#eef4fb', bounce: '#b7d1cc' },
    hospital: { practical: [.3, .38, .66, .3, .64], wash: [.22, .2, .3, .08, .3], task: '#ffecd5', bounce: '#bfd6d0' }
};
// Registry modes per kind and daypart (healthcare.md A5 / B5). The lighting
// specialist owns the values; this pass sets the brief's starting points.
const lmode = (key, fill, sky, power, ambient, exposure, practical, wash, bounce, color) => ({ key, fill, sky, power, ambient, exposure, practical, wash, bounce, leds: !!color, ...(color ? { color } : {}) });
const MODES = {
    hospital: [
        lmode('#fff3e2', '#e2eef0', ['#bad8e5', '#f5e6ca'], 1.55, .45, 1.05, .3, .22, .7),
        lmode('#f2f7fb', '#e1edf2', ['#94c5de', '#e4eff1'], 1.55, .46, 1.04, .38, .2, .76),
        lmode('#ffd9b0', '#d6e0ec', ['#ba96a4', '#f0c89e'], .75, .3, 1.08, .66, .3, .5, '#34544c'),
        // Night observation: ward dark, local practicals only, very low LEDs.
        lmode('#9fb4cf', '#8ea6c0', ['#0f2238', '#2c4560'], .14, .15, 1.18, .3, .08, .26, '#1c2d29'),
        lmode('#e8eef2', '#d5e8e7', ['#a9cdd7', '#ede3cd'], 1.1, .38, 1.07, .64, .3, .57, '#2c4d55')],
    lab: [
        lmode('#f3f6f8', '#dce9ee', ['#bad8e5', '#f5e6ca'], 1.5, .44, 1.05, .42, .2, .7),
        lmode('#f0f7ff', '#e1edf2', ['#94c5de', '#e4eff1'], 1.55, .46, 1.04, .5, .2, .76),
        lmode('#ffe2c2', '#d7deee', ['#ba96a4', '#f0c89e'], .8, .3, 1.08, .88, .35, .5, '#334d55'),
        lmode('#b9cde4', '#a4bed6', ['#172c47', '#3c5265'], .22, .18, 1.13, .62, .18, .28, '#173a40'),
        lmode('#e8eef2', '#d5e8e7', ['#a9cdd7', '#ede3cd'], 1.1, .38, 1.07, .84, .38, .57, '#4a1813')]
};
// Main desk pose per daypart [height in, tilt deg, yaw deg, offset [x, z] mm].
// Positive yaw turns the user toward the door wall (+x): the beds and benches.
const pose = (kind, list) => Object.fromEntries(PHASES.map((p, i) => [p, { ...MODES[kind][i], height: list[i][0], tilt: list[i][1], yaw: list[i][2] || 0, offset: list[i][3] || [0, 0] }]));
export const sceneOverrides = {
    hospital: {
        boardTitle: 'UNIT HUDDLE · SAFE CARE TODAY',
        caption: 'A workstation on wheels at the bedside, a whole care team around it.',
        // Morning rounds: standing WOW turned toward bed 1; handover turned
        // toward the staff side; night observation perched with a dim screen.
        modes: pose('hospital', [[43.5, 0, 24], [28, 0], [43.5, 0, 12], [35, 0], [43.5, 0]]),
        desk: [P('office-keyboard', [-60, 0, 110]), P('magic-mouse', [300, 0, 100], 90), P('clipboard', [500, 1, 80], -8)],
        shelf: [],
        layout(tier, l) {
            const plan = hospitalPlan(l); l.activity = plan.activity;
            // Family and visitor corner at the front of the window wall (M/L),
            // and a visitor chair beside the discharge planning desk (L).
            if (l.index) l.props.push({ id: 'armchair-poppi', at: [-plan.W + 470, 0, plan.front - [0, 480, 1300][l.index]], turn: 90 }, { id: 'ficus', at: [-plan.W + 300, 0, plan.front - [0, 1180, 2100][l.index]] });
            if (l.index === 2) l.props.push({ id: 'armchair-poppi', at: [-plan.W + 1400, 0, plan.front - 450], turn: 180 }, { id: 'kenney-furniture-chair-modern-cushion', at: [-440, 0, 6150], turn: 270 });
        }
    },
    laboratory: {
        boardTitle: 'QUESTION → EXPERIMENT → EVIDENCE',
        caption: 'Analyse in the dry zone, experiment at the benches, teach from one mobile desk.',
        modes: pose('lab', [[43.5, 0], [43.5, 0, 18], [28, 0], [35, 0], [28, 10]]),
        desk: [P('office-keyboard', [-60, 0, 110]), P('magic-mouse', [300, 0, 100], 90), P('journal', [-500, 0, 80], 8), P('calculator', [520, 0, 90])],
        shelf: [],
        layout(tier, l) { l.activity = labPlan(l).activity; }
    }
};
export const finish = spec => ({ name: spec.name + (spec.kind === 'lab' ? ' · chemical-resistant vinyl, epoxy & white laminate' : ' · sheet vinyl, oak-look headwalls & satin enamel'), ground: '#809c95', wood: .53, metal: .31, stone: .43, night: .92, partyDay: true });

// ---- Plans (healthcare.md A2 / B2; clearance-checked) --------------------
// Units mm, x across (window wall at -x, door wall at +x), z from the back wall
// (bz) to the open front. Beds: [x, z, rotation deg]; rotation -90 heads a bed
// to the door wall. Bed local frame: head at -z, the bay set (locker,
// recliner, IV pole) on +x, the nurse's working side on -x.
function hospitalPlan(l) {
    const i = l.index, W = l.width / 2, bz = l.back, front = bz + l.depth, bedZ = bz + 1150;
    return {
        i, W, bz, front,
        beds: [[[900, bedZ, 0]], [[-500, bedZ, 0], [2300, bedZ, 0]], [[-1450, bedZ, 0], [1350, bedZ, 0], [W - 1150, 600, -90]]][i],
        supply: [[W - 225, 1300, -90], [W - 225, 1500, -90], [W - 875, bz + 225, 0]][i],
        cart: [[700, 3500], [1400, 3400], [-2900, 5450]][i],
        activity: [[-1300, front - 650], [2300, front - 533], [2000, front - 700]][i],
        linen: [null, [W - 350, 3700], [3400, 3600]][i],
        // Door wall: unit huddle board (z, scale), PPE point and hand hygiene by the door, waste bins.
        board: [[-700, 1], [3300, .85], [-2200, 1]][i],
        ppe: [2280, front - 783, front - 2620][i], doorHygiene: [2700, front - 283, front - 3060][i],
        bins: [[W - 230, front - 550], [W - 230, 2730], [W - 230, front - 500]][i],
        // Back-wall hygiene points at each bed entry: [x, gloves side].
        hygiene: [[[-450, -1]], [[-1900, -1], [1200, 0]], [[-2850, -1], [300, 0]]][i]
    };
}
function labPlan(l) {
    const i = l.index, W = l.width / 2, bz = l.back, front = bz + l.depth;
    return {
        i, W, bz, front,
        benches: [[[900, 633]], [[500, -100], [500, 3200]], [[500, -1033], [500, 2117], [500, 5267]]][i],
        hood: [300, 600, 600][i],
        fridge: [1533, 2200, 2200][i],
        incubator: i === 2 ? 3100 : null,
        flammables: -W + 1100,
        wash: [2033, 3300, 4767][i],
        cart: [[2900, 900], [2400, 4700], [-2000, 7600]][i],
        activity: [[2600, front - 600], [1300, front - 700], [0, front - 617]][i],
        board: [-900, 800, 1000][i], safety: [2950, 4300, 3000][i], ppe: front - 545, spill: [650, -700, 2300][i],
        dryEdge: -W + 2200
    };
}

// ---- Extra ErgoFlex desks -----------------------------------------------
// Fields as in institutional-government.mjs; `role` drives stationDetail().
// Desktop frame: x across (±610 on 48, ±762 on 60), +z toward the user, y up
// from the desktop; shelf props sit on the rear monitor shelf (223 mm higher,
// 290 mm back). Envelopes were checked: >= 900 mm between independent items,
// beds keep >= 900 mm on the working side and 1000 mm at the foot.
export function stations(sceneId, layout) {
    const i = layout.index, list = [];
    const seat = (id, name, size, at, desktop, shelf, extra = {}) => list.push({ id, name, size, at, turn: 0, height: 28, tilt: 0, desktop, shelf, ...extra });
    const stand = (id, name, size, at, desktop, shelf, extra = {}) => seat(id, name, size, at, desktop, shelf, { height: 43.5, chair: false, ...extra });
    if (sceneId === 'hospital') {
        const med = [[1100, 1200], [2100, 1600], [1000, 3300]][i], doc = [[-1300, 2200], [-700, 1600], [-1700, 600]][i];
        stand('medication-station', 'Medication administration', '48x30', med,
            [P('tablet-pc', [-320, 0, 60])], [], { role: 'medication' });
        stand('physician-charting', 'Physician charting', '60x30', doc,
            [P('office-keyboard', [-80, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('glasses', [-560, 0, -110]), P('tablet-folder', [-470, 0, 140], 6)], [], { role: 'physician' });
        if (i) {
            seat('charge-nurse', 'Charge nurse coordination', '60x30', [[0, -2750, -3650][i], [0, 3600, 3300][i]],
                [P('office-keyboard', [-80, 0, 110]), P('office-phone', [560, 0, -60]), P('headphones', [-600, 0, -90]), P('papers', [300, 0, 150], -6)], [], { role: 'charge' });
            seat('telehealth-consult', 'Telehealth consult', '48x30', [[0, -300, -1300][i], [0, 4133, 3300][i]],
                [P('headphones', [430, 0, -90]), P('journal', [-470, 0, 110], 6)], [P('kenney-furniture-plant-small3', [430, 0, 0])], { role: 'telehealth' });
        }
        if (i === 2) {
            stand('pharmacist-verify', 'Pharmacist verification', '60x30', [1000, 600],
                [P('office-keyboard', [-80, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('calculator', [-560, 0, 90]), P('glasses', [470, 0, -150])], [], { role: 'pharmacist' });
            seat('discharge-planning', 'Discharge planning', '48x30', [-1300, 6000],
                [P('kenney-furniture-laptop', [-150, 0, -10]), P('papers-envelopes', [360, 0, 120]), P('office-phone', [-490, 0, -90])], [P('paper-holder', [-330, 0, 0])], { role: 'discharge' });
        }
    } else if (sceneId === 'laboratory') {
        // Small: microscopy at the window, instrument control front-centre.
        const instrument = [[200, 3900], [-2950, 1200], [-3850, 467]][i], micro = [[-2000, 1933], [-2950, 3900], [-3850, 3167]][i];
        seat('instrument-control', 'Instrument control', '60x30', instrument,
            [P('kenney-furniture-computer-keyboard', [250, 0, 130]), P('kenney-furniture-computer-mouse', [560, 0, 120])], [], { role: 'instrument' });
        seat('microscopy', 'Microscopy and imaging', '48x30', micro,
            [P('journal', [-500, 0, 130], -6)], [], { role: 'microscopy' });
        if (i) {
            stand('sample-prep', 'Sample preparation', '60x30', [[0, 3100, 3400][i], [0, -1500, -2233][i]], [], [], { role: 'prep' });
            stand('teaching-demo', 'Teaching demonstration', '48x30', [[0, 3200, 4000][i], [0, 1200, 1000][i]],
                [P('kenney-furniture-laptop', [-220, 0, 0])], [], { turn: 90, role: 'demo' });
        }
        if (i === 2) {
            stand('data-review', 'Data review', '48x30', [-3850, 6567],
                [P('tablet-folder', [330, 1, 60], -4), P('pen', [80, 1, 170], 70)], [P('paper-holder', [0, 0, 0])], { tilt: 15, plan: true, role: 'review' });
            seat('pi-review', 'Principal investigator review', '60x30', [3100, 6300],
                [P('office-keyboard', [-80, 0, 110]), P('magic-mouse', [330, 0, 100], 90), P('journal', [-560, 0, 60]), P('glasses', [470, 0, -150]), P('painted-mug', [600, 0, 160])],
                [P('kenney-furniture-plant-small2', [520, 0, 0])], { role: 'pi' });
        }
    }
    return list;
}

// ---- Shared drawing ------------------------------------------------------
const sans = (c, size, weight = '') => { c.font = `${weight} ${size}px sans-serif`.trim(); };
const mono = (c, size, weight = '') => { c.font = `${weight} ${size}px monospace`.trim(); };
const bars = (c, x, y, w, n, gap = 14, color = '#9fb3b4', h = 4) => { c.fillStyle = color; for (let r = 0; r < n; r++) c.fillRect(x, y + r * gap, w * (.55 + rnd(r * 3 + x) * .45), h); };
function screenTop(c, W, H, title, accent = '#2f6f74') {
    c.fillStyle = '#0f1d24'; c.fillRect(0, 0, W, H); c.fillStyle = accent; c.fillRect(0, 0, W, 34);
    c.fillStyle = '#e4f1ef'; sans(c, 16, 600); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(title, 14, 23, W - 90);
    c.fillStyle = '#9fe0c2'; c.beginPath(); c.arc(W - 18, 17, 5, 0, TAU); c.fill();
}
function screenFoot(c, W, H, kind, phase) {
    c.fillStyle = '#17303a'; c.fillRect(0, H - 26, W, 26); c.fillStyle = '#b8d9d3'; sans(c, 12, 600); c.textAlign = 'left';
    c.fillText(((LABELS[kind] || [])[phaseIndex(phase)] || '').toUpperCase(), 12, H - 9, W - 110); c.fillStyle = '#7f9a9a'; mono(c, 10); c.fillText('ILLUSTRATIVE', W - 92, H - 9);
}
const wave = (c, x0, y0, w, amp, color, type = 'ecg', lw = 2) => {
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
    for (let j = 0; j <= 120; j++) {
        const t = j / 120, p = (j % 30) / 30;
        const y = type === 'ecg' ? (p > .3 && p < .34 ? -amp : p >= .34 && p < .37 ? amp * .45 : Math.sin(p * TAU * 2) * amp * .06) : type === 'pleth' ? -Math.max(0, Math.sin(p * Math.PI)) * amp * (1 - p * .3) : Math.sin(t * TAU * 2) * amp * .5;
        c.lineTo(x0 + t * w, y0 + y);
    } c.stroke();
};
// Bedside vitals: generic waveforms and numbers (not patient data).
function vitals(c, W, H, variant = 0, phase = 'morning') {
    c.fillStyle = '#071216'; c.fillRect(0, 0, W, H);
    const rows = [['#5fe08a', 'ecg', 'HR', 68 + variant * 7], ['#5fd3e6', 'pleth', 'SpO₂', 97 - variant % 2], ['#f2e46b', 'resp', 'RR', 14 + variant]];
    rows.forEach(([color, type, label, value], n) => {
        const y = 52 + n * (H - 80) / 3; wave(c, 14, y, W * .62, 32, color, type);
        c.fillStyle = color; sans(c, 13, 600); c.fillText(label, W * .7, y - 22); sans(c, 40, 600); c.fillText(String(value), W * .7, y + 16);
    });
    c.fillStyle = '#e0e6e8'; sans(c, 13); c.fillText(`NIBP ${112 + variant * 6}/${72 + variant * 3}`, W * .7, H - 16);
    c.fillStyle = '#5a6b70'; c.fillText(`BED ${variant + 1}`, 14, H - 16);
    if (phase === 'night') { c.fillStyle = '#00000066'; c.fillRect(0, 0, W, H); }
}
const ROLE_SCREENS = {
    emar(c, W, H, phase) {
        screenTop(c, W, H, 'MEDICATION ADMINISTRATION · BAY', '#2f6f74');
        const cols = ['08', '12', '16', '20', '22'], now = [0, 1, 2, 4, 3][phaseIndex(phase)];
        c.fillStyle = '#88a7a8'; sans(c, 11, 600); cols.forEach((t, n) => c.fillText(t + ':00', W * .42 + n * W * .11, 54));
        for (let r = 0; r < 6; r++) {
            const y = 66 + r * ((H - 110) / 6); c.fillStyle = r % 2 ? '#132831' : '#173039'; c.fillRect(10, y, W - 20, (H - 110) / 6 - 4);
            c.fillStyle = '#c8dad8'; c.fillRect(20, y + 9, 70 + rnd(r) * 70, 6); c.fillStyle = '#6f8b8c'; c.fillRect(20, y + 21, 50 + rnd(r + 7) * 60, 4);
            cols.forEach((_, n) => { const s = n < now ? (r + n) % 5 ? '#4fb67c' : '#c9b25a' : n === now ? '#e7a23c' : null; const x = W * .42 + n * W * .11; if (s) { c.fillStyle = s; c.fillRect(x, y + 8, W * .08, 14); } else { c.strokeStyle = '#3d5961'; c.strokeRect(x + .5, y + 8.5, W * .08, 14); } });
        }
        c.fillStyle = '#4fb67c'; c.fillRect(W - 128, H - 58, 110, 22); c.fillStyle = '#0f1d24'; sans(c, 11, 600); c.fillText('SCAN ✓  2 IDs', W - 120, H - 43);
        screenFoot(c, W, H, 'hospital', phase);
    },
    chart(c, W, H, phase) {
        screenTop(c, W, H, 'CLINICAL NOTES · PROGRESS', '#355f76');
        bars(c, 18, 56, W * .45, 9, 15, '#a9bfc2');
        c.strokeStyle = '#2c4752'; c.strokeRect(W * .55, 48, W * .42, H - 100);
        [['#5fe08a', 0], ['#5fd3e6', 1], ['#f2c46b', 2]].forEach(([col, n]) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let j = 0; j < 12; j++) c.lineTo(W * .57 + j * W * .035, 80 + n * 40 + Math.sin(j * .8 + n) * 10 + rnd(j + n * 12) * 8); c.stroke(); });
        screenFoot(c, W, H, 'hospital', phase);
    },
    census(c, W, H, phase) {
        screenTop(c, W, H, 'UNIT OVERVIEW · BEDS & FLOW', '#4a6b52');
        for (let n = 0; n < 8; n++) {
            const x = 14 + (n % 4) * (W - 28) / 4, y = 46 + Math.floor(n / 4) * ((H - 120) / 2), s = ['#4fb67c', '#e7a23c', '#4fb67c', '#5fa6d6', '#4fb67c', '#b9c4c6', '#e7a23c', '#4fb67c'][(n + phaseIndex(phase)) % 8];
            c.fillStyle = '#173039'; c.fillRect(x, y, (W - 28) / 4 - 8, (H - 120) / 2 - 8); c.fillStyle = s; c.fillRect(x, y, 6, (H - 120) / 2 - 8);
            c.fillStyle = '#d9e8e6'; sans(c, 13, 600); c.fillText(`BED ${n + 1}`, x + 14, y + 20); bars(c, x + 14, y + 32, 60, 2, 12, '#7f9a9a');
        }
        c.fillStyle = '#c8dad8'; sans(c, 12, 600); c.fillText('STAFFING', 16, H - 52); c.fillStyle = '#4fb67c'; c.fillRect(90, H - 62, W * .4, 10); c.fillStyle = '#2c4752'; c.fillRect(90 + W * .4, H - 62, W * .12, 10);
        screenFoot(c, W, H, 'hospital', phase);
    },
    video(c, W, H, phase) {
        c.fillStyle = '#1c2a33'; c.fillRect(0, 0, W, H);
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5b7c86'); g.addColorStop(1, '#2d434b'); c.fillStyle = g; c.fillRect(10, 10, W - 20, H - 56);
        c.fillStyle = '#c9d6d2'; c.fillRect(W * .62, 24, W * .26, H * .5); c.fillStyle = '#e8e2d2'; c.fillRect(W * .66, 34, W * .18, H * .36);   // shelf / window behind
        c.fillStyle = '#d7b79c'; c.beginPath(); c.arc(W * .45, H * .36, H * .13, 0, TAU); c.fill();
        c.fillStyle = '#3f6f78'; c.beginPath(); c.ellipse(W * .45, H * .78, H * .3, H * .22, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#0e171c'; c.fillRect(W - 120, H - 120, 100, 66); c.fillStyle = '#4c6670'; c.beginPath(); c.arc(W - 70, H - 92, 14, 0, TAU); c.fill();
        c.fillStyle = '#0f1d24'; c.fillRect(0, H - 40, W, 40); [['#d9534f', W / 2], ['#55707a', W / 2 - 46], ['#55707a', W / 2 + 46]].forEach(([col, x]) => { c.fillStyle = col; c.beginPath(); c.arc(x, H - 20, 12, 0, TAU); c.fill(); });
        c.fillStyle = '#b8d9d3'; sans(c, 11, 600); c.fillText('SPECIALIST CONSULT · 12:04', 12, H - 15);
    },
    verify(c, W, H, phase) {
        screenTop(c, W, H, 'ORDER VERIFICATION · QUEUE', '#5b5f86');
        for (let r = 0; r < 7; r++) { const y = 52 + r * ((H - 96) / 7); c.fillStyle = r % 2 ? '#132831' : '#173039'; c.fillRect(10, y, W - 20, (H - 96) / 7 - 4); bars(c, 22, y + 10, 120, 1, 0, '#c8dad8', 5); c.fillStyle = '#6f8b8c'; c.fillRect(W * .45, y + 10, 70, 4); const ok = r < 4 + phaseIndex(phase) % 3; c.fillStyle = ok ? '#4fb67c' : '#e7a23c'; c.fillRect(W - 80, y + 6, 54, 14); }
        screenFoot(c, W, H, 'hospital', phase);
    },
    discharge(c, W, H, phase) {
        screenTop(c, W, H, 'DISCHARGE PLANNING · TODAY', '#7a6447');
        ['Transport', 'Medicines to take home', 'Follow-up booked', 'Teach-back', 'Equipment'].forEach((t, n) => { const y = 60 + n * 34, done = n < 2 + phaseIndex(phase) % 3; c.strokeStyle = '#7f9a9a'; c.strokeRect(18.5, y - 12.5, 16, 16); if (done) { c.strokeStyle = '#4fb67c'; c.lineWidth = 3; c.beginPath(); c.moveTo(21, y - 4); c.lineTo(26, y + 1); c.lineTo(33, y - 10); c.stroke(); c.lineWidth = 1; } c.fillStyle = '#d0dfdc'; sans(c, 14); c.fillText(t, 46, y); });
        screenFoot(c, W, H, 'hospital', phase);
    },
    analysis(c, W, H, phase) {
        screenTop(c, W, H, 'ANALYSIS · ABSORBANCE SERIES', '#2f6f74');
        c.strokeStyle = '#2c4752'; for (let x = 30; x < W * .62; x += 30) { c.beginPath(); c.moveTo(x, 44); c.lineTo(x, H - 40); c.stroke(); }
        ['#5fd3e6', '#f2c46b', '#e58fa6'].forEach((col, n) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let j = 0; j < 100; j++) { const t = j / 100; c.lineTo(30 + t * W * .58, H - 50 - Math.exp(-((t - .35 - n * .12) ** 2) / .006) * (H - 120) * (.9 - n * .2) - 6); } c.stroke(); });
        for (let r = 0; r < 8; r++) { c.fillStyle = r % 2 ? '#132831' : '#173039'; c.fillRect(W * .66, 46 + r * 22, W * .32, 20); c.fillStyle = '#9fb3b4'; c.fillRect(W * .68, 53 + r * 22, 40, 4); c.fillRect(W * .82, 53 + r * 22, 30, 4); }
        screenFoot(c, W, H, 'lab', phase);
    },
    instrument(c, W, H, phase) {
        screenTop(c, W, H, 'SPECTROPHOTOMETER · RUN 12', '#2d6d63');
        const run = phaseIndex(phase) !== 0;
        c.strokeStyle = '#5fd3e6'; c.lineWidth = 2; c.beginPath(); for (let j = 0; j < 140; j++) { const t = j / 140; c.lineTo(20 + t * (W - 180), H - 50 - (run ? Math.exp(-((t - .45) ** 2) / .01) * (H - 120) + Math.exp(-((t - .72) ** 2) / .004) * (H - 160) * .4 : 4)); } c.stroke();
        c.fillStyle = '#c8dad8'; sans(c, 12, 600); ['λ 260 nm', 'λ 280 nm', run ? 'RUNNING' : 'READY'].forEach((t, n) => c.fillText(t, W - 140, 64 + n * 24));
        c.fillStyle = run ? '#4fb67c' : '#e7a23c'; c.fillRect(W - 140, 120, 110, 8);
        screenFoot(c, W, H, 'lab', phase);
    },
    micro(c, W, H, phase) {
        const fluo = phaseIndex(phase) === 3;
        c.fillStyle = fluo ? '#03080a' : '#e9e3d4'; c.fillRect(0, 0, W, H);
        for (let n = 0; n < 34; n++) { const x = rnd(n) * W, y = rnd(n + 40) * H, r = 10 + rnd(n + 80) * 16; c.fillStyle = fluo ? '#2b8a4f88' : '#c9a3b766'; c.beginPath(); c.ellipse(x, y, r, r * .8, rnd(n) * 3, 0, TAU); c.fill(); c.fillStyle = fluo ? '#4f7fe0' : '#7c5a86'; c.beginPath(); c.arc(x + 2, y, r * .35, 0, TAU); c.fill(); }
        c.fillStyle = '#0f1d24cc'; c.fillRect(0, H - 26, W, 26); c.fillStyle = '#b8d9d3'; sans(c, 12, 600); c.fillText(fluo ? '40× · FLUORESCENCE' : '40× · BRIGHTFIELD', 12, H - 9);
    },
    data(c, W, H, phase) {
        screenTop(c, W, H, 'CHROMATOGRAM · BATCH 3', '#5b5f86');
        c.strokeStyle = '#f2c46b'; c.lineWidth = 2; c.beginPath(); for (let j = 0; j < 160; j++) { const t = j / 160; let y = 0; for (const [m, s, a] of [[.2, .0008, .5], [.38, .0012, .9], [.55, .0006, .35], [.74, .001, .7]]) y += a * Math.exp(-((t - m) ** 2) / s); c.lineTo(16 + t * (W - 32), H - 44 - y * (H - 110)); } c.stroke();
        screenFoot(c, W, H, 'lab', phase);
    },
    pi(c, W, H, phase) {
        screenTop(c, W, H, 'MANUSCRIPT DRAFT · FIGURE 2', '#4a5f78');
        c.fillStyle = '#e9ecea'; c.fillRect(16, 46, W * .5, H - 84); bars(c, 26, 60, W * .46, 12, 14, '#7e8f91');
        c.fillStyle = '#f4f6f4'; c.fillRect(W * .56, 46, W * .4, H * .5); ['#2f6f74', '#c97a5b', '#7a9b5e'].forEach((col, n) => { c.fillStyle = col; c.fillRect(W * .6 + n * W * .1, 46 + H * .5 - 20 - (40 + n * 25), W * .06, 40 + n * 25); });
        screenFoot(c, W, H, 'lab', phase);
    }
};

// ---- Light pools, glows and phase staging --------------------------------
// Additive radial pools (no real lights), emissive lenses and per-daypart
// visibility / position carry their levels in userData and are refreshed by
// applyPhase(): hcPool { color, levels }, hcGlow levels, hcShow booleans,
// hcY y-positions, hcScreen { paint, levels }. The lighting pass tunes levels.
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
const noRay = () => {};
const FACES = { floor: [-Math.PI / 2, 0, 0], back: [0, 0, 0], up: [Math.PI / 2, 0, 0] };
function poolPlane([sx, sy], color, levels, at, face = 'floor') {
    const m = new THREE.MeshBasicMaterial({ map: poolMap(), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.sharedTextures = true;
    const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); o.name = 'Light pool'; o.scale.set(sx, sy, 1); o.position.set(...at);
    o.rotation.set(...(Array.isArray(face) ? face : FACES[face])); o.renderOrder = 2; o.castShadow = o.receiveShadow = false;
    o.raycast = noRay; o.userData.hcPool = { color: new THREE.Color(color), levels }; return o;
}
// Room pools live in one overlay layer (no collider, no Groove obstacle, no
// ray hits); a pool owned by a furnishing copies its world transform.
function poolLayer(kit) {
    if (!kit.hcPools) { const g = kit.hcPools = new THREE.Group(); g.name = 'Clinical light pools'; g.userData.grooveMarker = true; g.userData.presentationOnly = true; kit.root.add(g); }
    return kit.hcPools;
}
function addPool(kit, parent, at, size, color, levels, face) {
    if (!parent) return null;
    const o = poolPlane(size, color, levels, at, face), layer = poolLayer(kit);
    if (parent !== kit.root) {
        o.updateMatrix(); const local = o.matrix.clone(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
        o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false;
        o.onBeforeRender = () => { let shown = true; for (let q = parent; q; q = q.parent) if (!q.visible) { shown = false; break; } o.matrixWorld.multiplyMatrices(parent.matrixWorld, shown && parent.parent ? local : zero); };
    }
    layer.add(o); return o;
}
function lens(parent, geometry, color, levels, at, rot = [0, 0, 0]) {
    const o = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: levels[0], roughness: .4 }));
    o.position.set(...at); o.rotation.set(...rot); o.castShadow = false; o.userData.hcGlow = levels; parent.add(o); return o;
}
const show = (o, list) => { o.userData.hcShow = list; return o; };
function applyPhase(root, { phase, gain = 1 }) {
    const i = phaseIndex(phase);
    root.traverse(o => {
        const u = o.userData;
        if (u.hcPool) { const v = u.hcPool.levels[i] * gain; o.material.color.copy(u.hcPool.color).multiplyScalar(v); o.visible = v > .003; }
        if (u.hcGlow) o.material.emissiveIntensity = u.hcGlow[i] * gain;
        if (u.hcShow) o.visible = !!u.hcShow[i];
        if (u.hcY) o.position.y = u.hcY[i];
        if (u.hcScreen) paintScreen(o, phase, gain);
    });
}
const phaseOf = node => { for (let n = node; n; n = n.parent) if (n.userData.hcPhase) return n.userData.hcPhase; return { phase: 'morning', gain: 1 }; };
const attached = node => { let n = node; while (n.parent) n = n.parent; return !!n.isScene; };
const MAIN_DETAIL = [], CURRENT = {};

// Procedural screen plane; repainted per daypart, brightness per level.
function screenPlane(parent, type, size, at, { W = 512, H = 300, levels = [.32, .32, .3, .2, .32], rot = [0, 0, 0] } = {}) {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: levels[0], roughness: .35 }));
    m.userData.hcScreen = { type, levels, phase: null }; m.position.set(...at); m.rotation.set(...rot); m.castShadow = false; parent.add(m);
    paintScreen(m, 'morning'); return m;
}
function paintScreen(o, phase, gain = 1) {
    const s = o.userData.hcScreen; o.material.emissiveIntensity = s.levels[phaseIndex(phase)] * Math.min(gain, 1.3);
    if (s.phase === phase) return; s.phase = phase;
    const map = o.material.map, c = map.image.getContext('2d'); c.save(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    (ROLE_SCREENS[s.type] || ROLE_SCREENS.chart)(c, map.image.width, map.image.height, phase); c.restore(); map.needsUpdate = true;
}
// A flat desk monitor with stand on a mount (screen faces +z, the user).
function deskMonitor(k, parent, type, x, z, width = 540, opts = {}) {
    const h = width * .58, cy = 150 + h / 2;
    k.box([width + 22, h + 22, 24], [x, cy, z], '#1a2227'); k.box([width * .38, h * .4, 26], [x, cy, z - 22], '#232c31');
    k.box([34, 150, 24], [x, 80, z - 40], '#3b464d'); k.box([220, 12, 160], [x, 6, z - 30], '#3b464d'); k.box([10, 4, 3], [x + width * .44, cy - h / 2 - 5, z + 13], '#58d68d');
    return screenPlane(parent, type, [width - 6, h - 6], [x, cy, z + 13], opts);
}

// ---- Procedural props (batched in a detailKit) ---------------------------
// Positions are the item's footprint centre on its support (y = support top).
const props = {
    scanner(k, x, y, z, yaw = 0) {
        // Handheld barcode scanner resting in its cradle; red read window.
        k.box([90, 40, 110], [x, y + 20, z], '#2a3237', [0, yaw, 0]);
        k.box([46, 130, 52], [x, y + 92, z + 6], '#2a3237', [-.35, yaw, 0]); k.box([74, 54, 84], [x, y + 160, z - 26], '#2f383d', [-.35, yaw, 0]);
        k.box([60, 30, 4], [x, y + 160, z - 70], '#c0392b', [-.35, yaw, 0]); k.box([8, 8, 4], [x + 18, y + 44, z + 56], '#4fd07f');
    },
    sharps(k, x, y, z, w = 260, h = 280, d = 150) {
        k.box([w, h - 40, d], [x, y + (h - 40) / 2, z], '#f2c230'); k.box([w + 8, 46, d + 8], [x, y + h - 23, z], '#c8433a');
        k.box([w * .5, 10, d * .35], [x - w * .12, y + h + 1, z], '#7d2a24'); k.box([w * .6, 50, 2], [x, y + h * .45, z + d / 2 + 1], '#ffffff');
        k.box([w * .2, 26, 2], [x - w * .18, y + h * .45, z + d / 2 + 2], '#c8433a');
    },
    gloves(k, x, y, z, color = '#7ea4c9', yaw = 0) {
        // Glove box: printed carton, oval opening with a tuft of glove.
        k.box([250, 92, 128], [x, y + 46, z], '#e8eef0', [0, yaw, 0]); k.box([252, 30, 130], [x, y + 60, z], color, [0, yaw, 0]);
        k.box([110, 4, 52], [x, y + 93, z], '#9aa8ad', [0, yaw, 0]); k.ball(30, [x, y + 100, z], color, [1.3, .6, .9]);
    },
    sanitiser(k, x, y, z) { k.cyl(36, 38, 170, [x, y + 85, z], '#eef2f0'); k.cyl(34, 34, 40, [x, y + 70, z], '#5fae8c'); k.cyl(12, 12, 50, [x, y + 195, z], '#dfe5e3'); k.box([60, 12, 18], [x + 18, y + 220, z], '#dfe5e3'); },
    stethoscope(k, x, y, z) {
        k.add(new THREE.TorusGeometry(70, 7, 8, 28, Math.PI * 1.6), [x, y + 7, z], '#2b3a42', [1, 1, 1], [Math.PI / 2, 0, .4]);
        k.cyl(18, 18, 16, [x + 75, y + 9, z + 30], '#b9c2c6'); k.cyl(24, 24, 10, [x + 75, y + 9, z + 30], '#5f6b70'); k.box([8, 8, 90], [x - 50, y + 7, z - 70], '#c9d0d3', [0, .5, 0]);
    },
    medCups(k, x, y, z) { for (let n = 0; n < 6; n++) k.cyl(20, 16, 36, [x, y + 18 + n * 9, z], '#f6f7f4'); for (let n = 0; n < 3; n++) k.cyl(20, 16, 30, [x + 60, y + 15, z - 40 + n * 42], '#f6f7f4'); },
    drawers(k, x, y, z) {
        // Locked unit-dose drawer module: carcass, three teal fronts, label holders, keypad.
        k.box([420, 140, 300], [x, y + 70, z], '#e9eef0');
        for (let n = 0; n < 3; n++) { k.box([125, 112, 6], [x - 135 + n * 135, y + 70, z + 153], '#608e9d'); k.box([70, 16, 4], [x - 135 + n * 135, y + 100, z + 157], '#f4f6f2'); k.box([50, 8, 10], [x - 135 + n * 135, y + 40, z + 158], '#c7d0d2'); }
        k.box([60, 50, 8], [x + 170, y + 150, z + 120], '#2b3439'); k.box([40, 10, 4], [x + 170, y + 165, z + 125], '#4fd07f');
    },
    wristband(k, x, y, z) { k.box([150, 110, 190], [x, y + 55, z], '#e9ecea'); k.box([110, 6, 10], [x, y + 84, z + 96], '#2b3439'); k.box([80, 2, 70], [x, y + 86, z + 120], '#f7f3e8', [.25, 0, 0]); k.box([10, 6, 4], [x + 55, y + 100, z + 96], '#4fd07f'); },
    webcam(k, x, y, z) { k.box([150, 34, 40], [x, y + 17, z], '#1d2427'); k.cyl(11, 11, 4, [x, y + 17, z + 21], '#4a7de0'); k.box([8, 6, 3], [x + 40, y + 24, z + 21], '#c0392b'); },
    tablet(parent, k, type, x, y, z, yaw = 0, levels) {
        k.box([280, 9, 200], [x, y + 4.5, z], '#1d2427', [0, yaw, 0]);
        return screenPlane(parent, type, [258, 178], [x, y + 9.6, z], { W: 384, H: 260, levels: levels || [.38, .38, .36, .28, .38], rot: [-Math.PI / 2, 0, yaw] });
    },
    glasses(k, x, y, z) { for (const s of [-1, 1]) { k.box([62, 38, 4], [x + s * 36, y + 22, z], '#d9e8ee'); k.box([70, 6, 6], [x + s * 36, y + 42, z], '#3a4a52'); k.box([5, 6, 120], [x + s * 72, y + 40, z - 60], '#3a4a52'); } k.box([20, 6, 6], [x, y + 36, z], '#3a4a52'); },
    microscope(k, x, y, z) {
        // Compound microscope: base, C-arm, stage, objective turret, binocular head.
        k.box([200, 50, 280], [x, y + 25, z], '#eef0ee'); k.cyl(30, 30, 10, [x, y + 54, z + 60], '#fff6d8');
        k.box([70, 260, 80], [x, y + 160, z - 100], '#eef0ee', [.12, 0, 0]); k.box([70, 70, 170], [x, y + 300, z - 40], '#eef0ee');
        k.box([140, 12, 140], [x, y + 150, z + 30], '#2f3a40'); k.box([60, 6, 22], [x, y + 160, z + 30], '#d8e6ea');
        for (let n = 0; n < 3; n++) k.cyl(9, 7, 50, [x - 18 + n * 18, y + 200, z + 20 + (n % 2) * 8], ['#c9a03c', '#5f7f9a', '#c0392b'][n]);
        k.cyl(28, 28, 30, [x, y + 238, z + 15], '#2f3a40'); k.box([80, 50, 110], [x, y + 342, z - 20], '#eef0ee', [.6, 0, 0]);
        for (const s of [-1, 1]) k.cyl(14, 14, 90, [x + s * 24, y + 385, z + 50], '#2f3a40');
        for (const s of [-1, 1]) k.cyl(26, 26, 22, [x + s * 50, y + 120, z - 70], '#2f3a40');
    },
    spectro(parent, k, x, y, z) {
        // Benchtop spectrophotometer: housing, sloped lid with a lit screen, cuvette port.
        k.box([480, 150, 380], [x, y + 75, z], '#e8ece9'); k.box([480, 90, 220], [x, y + 190, z - 75], '#dfe4e1', [.32, 0, 0]);
        k.box([140, 30, 120], [x + 140, y + 165, z - 40], '#c7cfcc'); k.box([60, 8, 40], [x + 140, y + 182, z - 40], '#2b3439');
        k.box([300, 6, 24], [x, y + 40, z + 191], '#7da9a0');
        return screenPlane(parent, 'instrument', [170, 100], [x - 90, y + 196, z + 30], { W: 340, H: 200, levels: [.4, .44, .44, .36, .42], rot: [-1.0, 0, 0] });
    },
    cuvettes(k, x, y, z) { k.box([130, 30, 50], [x, y + 15, z], '#3b6fa5'); for (let n = 0; n < 6; n++) k.box([12, 45, 12], [x - 50 + n * 20, y + 45, z], n % 2 ? '#f0c24b' : '#d8e6e6'); },
    tubeRack(k, x, y, z, seed = 0) {
        k.box([200, 50, 90], [x, y + 25, z], '#e8eef0'); k.box([200, 4, 90], [x, y + 52, z], '#c9d3d6');
        for (let n = 0; n < 12; n++) { const tx = x - 82 + (n % 6) * 33, tz = z - 20 + Math.floor(n / 6) * 40; if (rnd(n + seed) < .15) continue; k.cyl(7, 7, 90, [tx, y + 72, tz], '#e9f0f0'); k.cyl(8, 8, 14, [tx, y + 122, tz], ['#d9534f', '#4f8fc0', '#f0c24b'][(n + seed) % 3]); }
    },
    pipettes(k, x, y, z) {
        // Carousel stand with five single-channel pipettes.
        k.cyl(70, 80, 16, [x, y + 8, z], '#d9dfe0'); k.cyl(10, 10, 340, [x, y + 170, z], '#b9c2c6'); k.cyl(55, 55, 10, [x, y + 300, z], '#d9dfe0');
        for (let n = 0; n < 5; n++) { const a = n * TAU / 5, px = x + Math.cos(a) * 52, pz = z + Math.sin(a) * 52; k.cyl(13, 9, 200, [px, y + 230, pz], '#eef1ee'); k.cyl(15, 15, 30, [px, y + 340, pz], ['#c0392b', '#3b6fa5', '#2e8b57', '#f0c24b', '#7a5aa6'][n]); k.cyl(5, 2, 50, [px, y + 105, pz], '#c9d3d6'); }
    },
    vortex(k, x, y, z) { k.cyl(60, 70, 70, [x, y + 35, z], '#e8ece9'); k.cyl(30, 30, 16, [x, y + 78, z], '#2b3439'); k.box([40, 10, 4], [x, y + 40, z + 66], '#f0c24b'); },
    miniFuge(k, x, y, z) { k.cyl(105, 110, 120, [x, y + 60, z], '#eef1ee'); k.cyl(95, 95, 10, [x, y + 124, z], '#8fb9c9'); k.box([60, 20, 4], [x, y + 60, z + 108], '#2b3439'); },
    beaker(k, x, y, z, r = 50, h = 110, liquid = '#d8e6e6') { k.cyl(r, r, h, [x, y + h / 2, z], '#dfeaea'); k.cyl(r - 4, r - 4, h * .5, [x, y + h * .25 + 2, z], liquid); },
    bottle(k, x, y, z, glass = '#8a5a2b', cap = '#3b6fa5', h = 180, r = 38) { k.cyl(r, r, h * .72, [x, y + h * .36, z], glass); k.cyl(r * .5, r, h * .14, [x, y + h * .79, z], glass); k.cyl(r * .5, r * .5, h * .14, [x, y + h * .93, z], cap); k.box([r * 1.3, h * .28, 2], [x, y + h * .4, z + r], '#f2f2ea'); },
    washBottle(k, x, y, z, cap = '#e3a23c') { k.cyl(38, 40, 170, [x, y + 85, z], '#f1f4f2'); k.cyl(18, 22, 30, [x, y + 185, z], cap); k.box([6, 6, 90], [x, y + 210, z + 40], '#f1f4f2', [.6, 0, 0]); },
    flask(k, x, y, z, liquid = '#79c2b3', scale = 1) { const s = scale; k.cyl(15 * s, 62 * s, 120 * s, [x, y + 60 * s, z], '#dfeaea'); k.cyl(15 * s, 15 * s, 60 * s, [x, y + 150 * s, z], '#dfeaea'); k.cyl(30 * s, 58 * s, 55 * s, [x, y + 28 * s, z], liquid); },
    burner(k, x, y, z) { k.cyl(45, 50, 18, [x, y + 9, z], '#3a4247'); k.cyl(12, 12, 140, [x, y + 88, z], '#b9c2c6'); k.box([60, 12, 12], [x + 30, y + 30, z], '#c9a03c'); },
    timer(k, x, y, z) { k.box([90, 60, 40], [x, y + 30, z], '#f4f6f2', [-.3, 0, 0]); k.box([70, 26, 3], [x, y + 38, z + 18], '#1d2427', [-.3, 0, 0]); },
    tipBox(k, x, y, z, color = '#3b6fa5') { k.box([125, 70, 85], [x, y + 35, z], color); k.box([125, 6, 85], [x, y + 73, z], '#e9eef0'); for (let n = 0; n < 24; n++) k.cyl(3, 3, 10, [x - 52 + (n % 8) * 15, y + 80, z - 28 + Math.floor(n / 8) * 28], '#d9e3e5'); },
    notebook(k, x, y, z, color = '#2f5e6b') { notebook(k, x, y, z, color); },
    molecule(k, x, y, z) {
        const atoms = [[0, 80, 0, '#2f3a40', 26], [60, 120, 20, '#d9534f', 22], [-60, 120, -10, '#e8e8e8', 16], [20, 40, 50, '#e8e8e8', 16], [-40, 60, -50, '#e8e8e8', 16], [90, 170, 40, '#e8e8e8', 16]];
        k.cyl(40, 50, 14, [x, y + 7, z], '#5f6b70'); k.cyl(4, 4, 70, [x, y + 45, z], '#9aa4ab');
        for (const [ax, ay, az, col, r] of atoms) k.ball(r, [x + ax, y + ay, z + az], col);
        for (const [ax, ay, az] of atoms.slice(1)) { const from = atoms[ax === 90 ? 1 : 0], dx = ax - from[0], dy = ay - from[1], dz = az - from[2], len = Math.hypot(dx, dy, dz); const g = new THREE.CylinderGeometry(4, 4, len, 8); g.rotateX(Math.PI / 2); g.lookAt(new THREE.Vector3(dx, dy, dz)); k.add(g, [x + (ax + from[0]) / 2, y + (ay + from[1]) / 2, z + (az + from[2]) / 2], '#b9c2c6'); }
    },
    docCam(k, x, y, z) { k.box([160, 20, 200], [x, y + 10, z], '#2b3439'); k.box([18, 300, 18], [x - 60, y + 160, z - 70], '#3b464d', [.25, 0, 0]); k.box([110, 40, 60], [x - 20, y + 300, z - 10], '#2b3439'); k.cyl(14, 14, 8, [x - 20, y + 276, z - 10], '#4a7de0'); },
    slideBox(k, x, y, z) { k.box([110, 30, 80], [x, y + 15, z], '#3b6fa5'); for (let n = 0; n < 6; n++) k.box([75, 2, 25], [x, y + 32, z - 30 + n * 12], '#e9f0f0'); },
    printout(k, x, y, z, w = 297, d = 210, rot = 0) { k.box([w, 1.5, d], [x, y + .8, z], '#f4f2ea', [0, rot, 0]); for (let n = 0; n < 6; n++) k.box([w * .7, 1, 5], [x, y + 1.8, z - d / 2 + 22 + n * (d - 40) / 5], n === 2 ? '#c9a03c' : '#6f8288', [0, rot, 0]); },
    lanyards(k, x, y, z) { for (let n = 0; n < 4; n++) { k.box([14, 260, 3], [x + n * 60, y - 130, z], ['#2e8b57', '#3b6fa5', '#c8433a', '#7a5aa6'][n]); k.box([54, 82, 4], [x + n * 60, y - 290, z + 2], '#f4f6f2'); } }
};

// ---- Station detail (no real lights) -------------------------------------
function stationKit() { return { k: detailKit(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }) }; }
// Station desktop pools by role [m, a, e, n, p]: the medication station has
// its own 4000K task light (drugs are read under neutral light).
const STATION_POOL = { medication: [.05, .05, .12, .14, .08], physician: [.03, .03, .1, .04, .06], charge: [.03, .03, .1, .08, .07], telehealth: [.03, .03, .08, .02, .06], pharmacist: [.03, .03, .1, .03, .07], discharge: [.03, .03, .1, .02, .06],
    instrument: [.03, .04, .1, .1, .06], microscopy: [.03, .04, .1, .06, .06], prep: [.04, .05, .1, .03, .06], demo: [.03, .03, .08, .02, .08], review: [.03, .03, .1, .04, .07], pi: [.03, .03, .1, .04, .07] };
export function stationDetail(spec, mount, T, ctx) {
    const role = spec.role, half = spec.size === '60x30' ? 762 : 610, { k, mat } = stationKit();
    const glow = []; // lenses added after build
    if (ctx.role === 'shelf') {
        if (role === 'medication') { props.sharps(k, -300, 0, 0); props.gloves(k, 160, 0, -10, '#7ea4c9'); props.sanitiser(k, 420, 0, 10); }
        if (role === 'physician') { deskMonitor(k, mount, 'chart', -120, 0, 600); props.stethoscope(k, 470, 0, 0); k.box([10, 140, 10], [half - 60, -60, 70], '#2b3a42'); k.cyl(18, 18, 14, [half - 60, -140, 76], '#b9c2c6'); }
        if (role === 'charge') { deskMonitor(k, mount, 'census', -120, 0, 620); props.wristband(k, 470, 0, 0); }
        if (role === 'telehealth') { deskMonitor(k, mount, 'video', -140, 0, 560, { levels: [.36, .36, .34, .2, .36] }); props.webcam(k, -140, 150 + 560 * .58 + 12, 0); }
        if (role === 'pharmacist') { deskMonitor(k, mount, 'verify', 0, 0, 620); for (let n = 0; n < 3; n++) k.box([150, 90, 110], [-560 + n * 0, 45 + n * 92, 0], ['#e9eef0', '#dfe8ea', '#e9eef0'][n]); k.box([120, 30, 3], [-560, 60, 56], '#608e9d'); }
        if (role === 'discharge') { for (let n = 0; n < 4; n++) k.box([22, 230, 300], [150 + n * 34, 115, 0], ['#a9c5d0', '#e3a28c', '#cfe1db', '#f4f2ea'][n]); }
        if (role === 'instrument') deskMonitor(k, mount, 'instrument', -60, 0, 600);
        if (role === 'microscopy') deskMonitor(k, mount, 'micro', 0, 0, 520, { levels: [.32, .34, .32, .3, .34] });
        if (role === 'prep') { props.gloves(k, -330, 0, 0, '#9fc49b'); props.beaker(k, 300, 0, 0, 70, 160, '#e9eef0'); k.box([110, 40, 4], [300, 100, 72], '#c8433a'); props.washBottle(k, 520, 0, 0); }
        if (role === 'pi') deskMonitor(k, mount, 'pi', -80, 0, 620);
        if (role === 'medication') {
            // 4000K task light under the shelf, read by the desktop pool.
            k.box([half * 2 - 260, 24, 50], [0, -30, 60], '#d9dfe0');
            glow.push([new THREE.BoxGeometry(half * 2 - 280, 4, 34), '#f1f3ee', [.6, .6, 1.2, 1.4, .9], [0, -44, 60]]);
        }
    } else {
        if (role === 'medication') { props.drawers(k, 250, 0, -60); props.medCups(k, 470, 0, 160); props.scanner(k, -520, 0, -90); k.box([160, 2, 110], [-80, 1, 170], '#f4f2ea'); }
        if (role === 'physician') { props.printout(k, 120, 0, -170, 297, 210, .05); }
        if (role === 'charge') { props.printout(k, -330, 0, 140, 210, 297, .1); k.box([300, 230, 60], [-420, 115, -260], '#d9dfe0'); k.box([280, 200, 4], [-420, 120, -228], '#f4f6f2'); for (let n = 0; n < 4; n++) k.box([60, 30, 2], [-500 + n * 55, 180 - (n % 2) * 60, -225], ['#4fb67c', '#e7a23c', '#5fa6d6', '#c8433a'][n]); }
        if (role === 'telehealth') { props.tablet(mount, k, 'chart', 120, 0, 150, .1); }
        if (role === 'pharmacist') { props.printout(k, 450, 0, 140, 297, 210, -.1); props.medCups(k, 640, 0, -150); k.box([200, 70, 140], [-350, 35, -200], '#e9eef0'); for (let n = 0; n < 3; n++) k.box([55, 50, 4], [-420 + n * 70, 50, -128], ['#608e9d', '#e3a28c', '#9fc49b'][n]); }
        if (role === 'discharge') { for (let n = 0; n < 3; n++) k.box([230, 12, 310], [420 + n * 6, 6 + n * 12, -170 + n * 4], ['#a9c5d0', '#cfe1db', '#e3a28c'][n]); }
        if (role === 'instrument') { props.spectro(mount, k, -380, 0, -90); props.cuvettes(k, -60, 0, 140); props.notebook(k, -560, 0, 170, '#7a5aa6'); }
        if (role === 'microscopy') { props.microscope(k, -150, 0, -60); props.slideBox(k, 200, 0, 140); props.tablet(mount, k, 'micro', 380, 0, 60, -.1); props.glasses(k, -480, 0, -150); }
        if (role === 'prep') {
            props.pipettes(k, -560, 0, -90); props.tubeRack(k, -220, 0, 40, 1); props.tubeRack(k, 60, 0, 40, 5); props.vortex(k, 360, 0, 60); props.miniFuge(k, 560, 0, -150);
            props.tipBox(k, 300, 0, -190); props.glasses(k, -280, 0, -230); k.box([500, 1, 300], [-80, .5, 60], '#cfe1db');
        }
        if (role === 'demo') { props.molecule(k, 300, 0, 60); props.docCam(k, -480, 0, -60); props.printout(k, 120, 0, 170, 210, 297, .2); }
        if (role === 'review') { for (const [x, z, r] of [[-200, -20, .03], [160, 40, -.05]]) props.printout(k, x, 0, z, 420, 297, r); k.box([30, 3, 260], [-420, 2, 30], '#c9a03c', [0, .2, 0]); }
        if (role === 'pi') props.printout(k, 120, 0, -180, 297, 210, .06);
        const levels = STATION_POOL[role];
        if (levels) mount.add(poolPlane([half * 2 - 80, 640], role === 'medication' ? '#f1f3ee' : '#ffe9cc', levels, [0, 2, 30]));
    }
    const built = k.build(mount, mat);
    for (const [geo, color, levels, at] of glow) lens(mount, geo, color, levels, at);
    applyPhase(mount, phaseOf(mount));
    return built;
}
// Procedural detail on the live main desk (follows the daypart).
export function mainDeskDetail({ sceneId, role, THREE: T, add }) {
    const { k, mat } = stationKit(), g = new T.Group();
    if (sceneId === 'hospital') {
        if (role === 'desktop') { props.scanner(k, -470, 0, -60); props.sanitiser(k, -560, 0, -230); g.add(poolPlane([1050, 640], '#ffe9cc', [.03, .03, .1, .1, .06], [0, 2, 30])); }
        else if (role === 'shelf') { deskMonitor(k, g, 'emar', -60, 0, 560, { levels: [.32, .32, .3, .16, .32] }); props.gloves(k, 470, 0, 0, '#9fc49b'); }
    } else if (sceneId === 'laboratory') {
        // Dry zone: no drinks here; safety glasses ready by the notebook.
        if (role === 'desktop') { props.glasses(k, 470, 0, -150); g.add(poolPlane([1050, 640], '#ffe9cc', [.03, .03, .1, .1, .06], [0, 2, 30])); }
        else if (role === 'shelf') { deskMonitor(k, g, 'analysis', -40, 0, 640); for (let n = 0; n < 3; n++) props.notebook(k, 480, n * 23, 0, ['#2f5e6b', '#7a5aa6', '#c97a5b'][n]); }
    }
    if (!k.build(g, mat) && !g.children.length) return;
    MAIN_DETAIL.push({ g, sceneId }); applyPhase(g, CURRENT[sceneId] || { phase: 'morning', gain: 1 });
    add(g);
}

// ---- Builder hooks -------------------------------------------------------
export function options(spec) {
    const lab = spec.kind === 'lab';
    return {
        trimColor: lab ? '#7c9a97' : '#97aca8', acousticName: lab ? 'Wall safety and PPE point' : 'Wall gloves and PPE point',
        signLabel: lab ? 'LAB 2.04 · PPE REQUIRED' : 'CARE BAY · CLEAN YOUR HANDS', rugColor: null, planter: false,
        boardOnSideWall: false, boardName: lab ? 'Wall experiment board' : 'Wall unit huddle board', boardFooter: '#f1f0e7',
        storage: { height: 1900, open: false }, chairDetailHeight: 480, nightBackground: lab ? .55 : .3,
        // The hospital's second lamp is the reading light on the first bed (extraLamps).
        lampSupport: lab ? { id: 'lab-bench-0', height: 900, clinical: true, color: '#eaf3ed' } : null
    };
}
export const floor = (spec, w, d) => institutionalFloor('clinical', w, d);
export function drawBoard(c, W, H, spec, variant = 0) {
    boardFrame(c, W, H, spec);
    if (spec.kind === 'lab') {
        // Experiment flow, a results plot and a sample log (generic).
        const steps = ['QUESTION', 'HYPOTHESIS', 'EXPERIMENT', 'EVIDENCE'];
        steps.forEach((t, n) => { const x = 30 + n * (W * .62 - 30) / 4; c.fillStyle = n === Math.min(3, variant) ? spec.accent : '#dde8e4'; c.fillRect(x, 70, (W * .62 - 30) / 4 - 22, 46); c.fillStyle = n === Math.min(3, variant) ? '#f3f5f0' : '#2d4b48'; sans(c, 15, 600); c.fillText(t, x + 10, 99, (W * .62 - 30) / 4 - 40); if (n < 3) { c.fillStyle = '#7c9a97'; c.beginPath(); c.moveTo(x + (W * .62 - 30) / 4 - 18, 85); c.lineTo(x + (W * .62 - 30) / 4 - 6, 93); c.lineTo(x + (W * .62 - 30) / 4 - 18, 101); c.fill(); } });
        c.strokeStyle = '#d4ded6'; c.lineWidth = 1; for (let x = 40; x < W * .6; x += 24) { c.beginPath(); c.moveTo(x, 140); c.lineTo(x, H - 60); c.stroke(); } for (let y = 140; y < H - 55; y += 24) { c.beginPath(); c.moveTo(40, y); c.lineTo(W * .6, y); c.stroke(); }
        c.strokeStyle = spec.accent; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 100; i++) c.lineTo(46 + i * (W * .55) / 100, H - 70 - (H - 230) * (1 - Math.exp(-i / (24 + variant * 6)))); c.stroke();
        c.fillStyle = '#c97a5b'; for (let i = 0; i < 9; i++) { const t = 6 + i * 11; c.beginPath(); c.arc(46 + t * (W * .55) / 100, H - 70 - (H - 230) * (1 - Math.exp(-t / (24 + variant * 6))) + (rnd(i) - .5) * 14, 4, 0, TAU); c.fill(); }
        c.fillStyle = '#ffffff'; c.fillRect(W * .66, 66, W * .31, H - 126); c.fillStyle = '#2d4b48'; sans(c, 15, 600); c.fillText('SAMPLE LOG', W * .68, 90);
        for (let r = 0; r < 8; r++) { c.fillStyle = r % 2 ? '#eef2ef' : '#ffffff'; c.fillRect(W * .67, 100 + r * 24, W * .29, 22); c.fillStyle = '#6e7b79'; mono(c, 12); c.fillText(`S-${String(101 + r + variant * 8).padStart(3, '0')}`, W * .68, 116 + r * 24); c.fillStyle = r < 3 + variant ? '#4fb67c' : '#c9d3cf'; c.fillRect(W * .9, 106 + r * 24, 26, 10); }
        return;
    }
    // Hospital unit huddle board: safety / flow / staffing / wins, magnet chips.
    const heads = ['SAFETY', 'FLOW', 'STAFFING', 'WINS'], cw = (W - 60) / 4;
    heads.forEach((t, n) => {
        const x = 30 + n * cw; c.fillStyle = ['#c8433a', '#608e9d', '#7a6447', '#4f8a5b'][n]; c.fillRect(x, 66, cw - 14, 30); c.fillStyle = '#f3f5f0'; sans(c, 16, 600); c.fillText(t, x + 10, 87);
        const rows = n === 3 ? 3 + (variant === 4 ? 2 : variant % 2) : 3 + (n + variant) % 2;
        for (let r = 0; r < rows; r++) {
            const y = 108 + r * 44; c.fillStyle = r % 2 ? '#e9eeeb' : '#f6f7f2'; c.fillRect(x, y, cw - 14, 38);
            c.fillStyle = ['#e8c46e', '#9fd0b4', '#f0a98f', '#a9c7e6'][(r + n) % 4]; c.beginPath(); c.arc(x + 16, y + 19, 8, 0, TAU); c.fill();
            bars(c, x + 32, y + 12, cw - 70, 2, 12, '#6e7b79', 3);
        }
    });
    if (variant === 3) { c.fillStyle = '#26404a'; c.fillRect(W - 230, 64, 200, 26); c.fillStyle = '#e4f1ef'; sans(c, 13, 600); c.fillText('NIGHT SHIFT · QUIET HOURS', W - 222, 82); }
    if (variant === 4) for (let n = 0; n < 6; n++) { c.save(); c.translate(W * .78 + (n % 3) * 46, 250 + Math.floor(n / 3) * 46); c.rotate((rnd(n) - .5) * .2); c.fillStyle = ['#f2d36b', '#9fd0b4', '#f0a98f'][n % 3]; c.fillRect(-20, -20, 40, 40); c.restore(); }
}
export function drawScreen(c, W, H, spec, variant = 0, phase = 'morning') {
    if (spec.kind === 'hospital') { vitals(c, W, H, variant, phase); return; }
    ROLE_SCREENS[['instrument', 'data', 'analysis'][variant % 3]](c, W, H, phase);
}

// ---- Shared room helpers --------------------------------------------------
const strip = g => { for (const child of [...g.children]) { child.geometry?.dispose(); g.remove(child); } };
// Wall assets: 'back' (local +x across, +z into the room), 'right' (door wall:
// local +x toward the front), 'left' (window wall: local +x toward the back).
function wallAsset(kit, wall, id, name, along, y, inset = 0) {
    const { w, bz } = kit, W = w / 2;
    if (wall === 'back') return kit.asset(id, name, [along, y, bz + inset], kit.back);
    const g = kit.asset(id, name, [wall === 'right' ? W - inset : -W + inset, y, along], wall === 'right' ? kit.right : kit.left);
    g.rotation.y = wall === 'right' ? -Math.PI / 2 : Math.PI / 2; return g;
}
const anchorWall = g => { g.userData.propAnchor = 'wall'; return g; };
// A canvas-textured plane on a parent.
function panel(kit, parent, draw, size, at, { cw = 512, ch = 256, glow = 0, rot = [0, 0, 0] } = {}) {
    const m = kit.canvasMat(draw, cw, ch); m.userData.roomSurface = 'plaster';
    if (glow) { m.emissive.set('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = glow; }
    const p = kit.mesh(parent, new THREE.PlaneGeometry(...size), m, at); p.rotation.set(...rot); p.castShadow = false; return p;
}
const signText = (text, bg, fg, font = '600 54px sans-serif', sub) => (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, W / 2, H / 2 + (sub ? -H * .12 : 2), W - 30); if (sub) { c.font = '500 26px sans-serif'; c.globalAlpha = .8; c.fillText(sub, W / 2, H * .78, W - 30); c.globalAlpha = 1; }
};
// Bed-local (x, z) to room (x, z) for a bed at [bx, bz, rot].
const bedXZ = ([bx, bzz, rot], x, z) => { const a = rad(rot), c = Math.cos(a), s = Math.sin(a); return [bx + x * c + z * s, bzz - x * s + z * c]; };
function hcMaterials(kit) {
    if (kit.hcM) return kit.hcM;
    const { mat, material } = kit;
    return kit.hcM = {
        frame: mat('#d9dfe0', 'powder'), dark: mat('#3a4247', 'powder'), rail: mat('#9aa7ad', 'metal', { metalness: .55, roughness: .35 }),
        mattress: mat('#b9cfd3', 'fabric'), linen: mat('#f4f6f2', 'fabric'), blanket: mat('#a9c5d0', 'fabric'), pillow: mat('#ffffff', 'fabric'),
        recliner: mat('#4f7d8a', 'fabric'), wood: mat('#c9a77c', 'wood'), hpl: mat('#eef1ee', 'powder'), epoxy: mat('#22282b', 'stone', { roughness: .3 }),
        teal: mat('#608e9d', 'powder'), yellow: mat('#e1b12c', 'powder'), white: mat('#f2f4f1', 'powder'), steel: mat('#c9d0d3', 'metal', { metalness: .6, roughness: .3 }),
        glass: material('#cfe6ea', { transparent: true, opacity: .26, roughness: .08, metalness: .1, depthWrite: false }),
        liquid: material('#ffffff', { vertexColors: true, transparent: true, opacity: .62, roughness: .15 })
    };
}
// ---- Hospital furnishing --------------------------------------------------
function buildBed(kit, n, at) {
    const { asset, box, mesh } = kit, M = hcMaterials(kit), [x, z, rot] = at;
    const bed = asset(`care-bed-${n}`, 'Hospital care bed', [x, 0, z]); bed.rotation.y = rad(rot);
    for (const dx of [-400, 400]) for (const dz of [-870, 870]) {
        const wheel = mesh(bed, new THREE.CylinderGeometry(52, 52, 34, 16), M.dark, [dx, 52, dz]); wheel.rotation.z = Math.PI / 2;
        box(bed, [40, 70, 40], [dx, 125, dz], M.rail, 4);
    }
    box(bed, [880, 80, 1880], [0, 195, 0], M.dark, 10);
    box(bed, [300, 220, 900], [0, 330, 0], M.frame, 20);
    box(bed, [990, 60, 2030], [0, 475, 0], M.frame, 12);
    // Mattress: foot section flat, back section raised ~19 degrees at the head.
    box(bed, [930, 150, 1250], [0, 580, 375], M.mattress, 34);
    const a = .33, hinge = -250;
    const back = box(bed, [930, 150, 780], [0, 580 + 390 * Math.sin(a), hinge - 390 * Math.cos(a)], M.mattress, 34); back.rotation.x = a;
    box(bed, [936, 8, 1240], [0, 659, 375], M.linen, 3);
    const pillow = box(bed, [640, 120, 360], [0, 700 + 560 * Math.sin(a), hinge - 560 * Math.cos(a)], M.pillow, 50); pillow.rotation.x = a;
    box(bed, [940, 46, 520], [0, 686, 760], M.blanket, 16);
    // Head and foot boards: HPL panels in powder-coated frames.
    box(bed, [1000, 620, 54], [0, 830, -1045], M.frame, 18); box(bed, [860, 460, 58], [0, 850, -1045], M.wood, 10);
    box(bed, [1000, 440, 54], [0, 720, 1045], M.frame, 18); box(bed, [860, 300, 58], [0, 730, 1045], M.teal, 10);
    // Split side rails (down on the nurse's working side by day).
    for (const s of [-1, 1]) for (const [z0, len] of [[-640, 620], [260, 820]]) {
        box(bed, [30, 300, len], [s * 500, 790, z0], M.rail, 10); box(bed, [36, 210, len - 70], [s * 500, 790, z0], M.frame, 8);
    }
    return bed;
}
function buildBay(kit, n, bedAt) {
    // One furnishing per bed: bedside locker, recliner, IV pole with pump and an
    // overbed table (key kept from the former observation monitor stand).
    const [x, z] = bedXZ(bedAt, 900, -250), M = hcMaterials(kit);
    const bay = kit.asset(`patient-monitor-${n}`, 'Bedside locker, recliner and IV pole', [x, 0, z]); bay.rotation.y = rad(bedAt[2]);
    kit.box(bay, [440, 790, 440], [110, 395, -480], M.hpl, 14); kit.box(bay, [460, 24, 460], [110, 800, -480], M.wood, 6);
    // Recliner facing the bed (-x): vinyl seat, raked back, wooden arms.
    kit.box(bay, [560, 140, 600], [80, 420, 390], M.recliner, 40); kit.box(bay, [560, 300, 600], [80, 230, 390], M.dark, 20);
    const backrest = kit.box(bay, [150, 640, 600], [360, 760, 390], M.recliner, 40); backrest.rotation.z = -.22;
    for (const s of [-1, 1]) { kit.box(bay, [560, 60, 90], [100, 610, 390 + s * 330], M.wood, 14); kit.box(bay, [480, 230, 70], [110, 470, 390 + s * 330], M.recliner, 18); }
    // Overbed table: H-base, column, top cantilevered over the bed.
    kit.box(bay, [620, 30, 60], [-200, 40, -110], M.frame, 6); kit.box(bay, [620, 30, 60], [-200, 40, 120], M.frame, 6);
    kit.box(bay, [60, 820, 60], [-30, 440, 0], M.frame, 8); kit.box(bay, [820, 26, 400], [-380, 860, 0], M.wood, 8);
    // IV pole with pump and bag.
    kit.rod(bay, [-260, 60, -620], [-260, 2050, -620], 13, M.rail);
    for (let i = 0; i < 5; i++) { const t = i * TAU / 5; kit.rod(bay, [-260, 70, -620], [-260 + Math.cos(t) * 260, 40, -620 + Math.sin(t) * 260], 12, M.rail); }
    kit.box(bay, [180, 210, 130], [-260, 1200, -560], M.white, 14);
    return bay;
}
function buildHeadwall(kit, n, bedAt, wallSide) {
    // Medical services headwall: oak-look panel, gas rail, care board, reading
    // light, vitals monitor arm, nurse call and night-lights near the floor.
    const M = hcMaterials(kit), [x, z] = bedAt;
    const g = wallSide === 'right' ? wallAsset(kit, 'right', n ? `care-services-${n}` : 'care-services', 'Wall bed headwall services', z, 0, 0)
        : wallAsset(kit, 'back', n ? `care-services-${n}` : 'care-services', 'Wall bed headwall services', x, 0, 0);
    anchorWall(g);
    kit.box(g, [1600, 1500, 18], [0, 950, 9], M.wood, 4);
    kit.box(g, [1500, 220, 70], [0, 1500, 54], M.hpl, 12); kit.box(g, [1520, 24, 80], [0, 1622, 58], M.frame, 4);
    // Patient care board above (generic headings and blank lines, no patient data).
    kit.box(g, [940, 640, 24], [0, 2050, 12], M.frame, 6);
    panel(kit, g, (c, W, H) => {
        c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, W, H); c.fillStyle = '#608e9d'; c.fillRect(0, 0, W, 46); c.fillStyle = '#ffffff'; sans(c, 22, 600); c.fillText(`BED ${n + 1} · MY CARE TODAY`, 16, 31);
        c.fillStyle = '#2d4b48'; sans(c, 15, 600); c.fillText("TODAY'S CARE TEAM", 18, 74); bars(c, 18, 86, 200, 4, 16, '#b3c0bf', 4);
        c.fillText('GOALS', 270, 74); bars(c, 270, 86, 200, 2, 16, '#b3c0bf', 4);
        c.fillText('HOW ARE YOU FEELING?', 18, 172); ['#4fb67c', '#8cc56b', '#d9d35a', '#f0b24b', '#ea8a46', '#d9534f'].forEach((col, i) => { const cx = 36 + i * 50, cy = 204; c.fillStyle = col; c.beginPath(); c.arc(cx, cy, 18, 0, TAU); c.fill(); c.fillStyle = '#2d3b3b'; c.beginPath(); c.arc(cx - 6, cy - 4, 2.4, 0, TAU); c.arc(cx + 6, cy - 4, 2.4, 0, TAU); c.fill(); c.strokeStyle = '#2d3b3b'; c.lineWidth = 2; c.beginPath(); const smile = (2.5 - i) * 1.6; c.moveTo(cx - 8, cy + 7 - smile * .3); c.quadraticCurveTo(cx, cy + 7 + smile, cx + 8, cy + 7 - smile * .3); c.stroke(); });
        c.fillStyle = '#2d4b48'; sans(c, 15, 600); c.fillText('QUESTIONS FOR THE TEAM', 330, 172); bars(c, 330, 186, 160, 3, 16, '#b3c0bf', 4);
    }, [900, 600], [0, 2050, 25], { cw: 512, ch: 340 });
    const k = detailKit();
    // Gas outlets: oxygen (green), medical air, vacuum (yellow ring); flowmeter.
    [[-560, '#2e8b57', 'O2'], [-420, '#e8e8e0', 'AIR'], [-280, '#f2f2f2', 'VAC']].forEach(([ox, col], i) => {
        k.cyl(32, 32, 14, [ox, 1520, 94], col); k.add(new THREE.CylinderGeometry(32, 32, 14, 6), [ox, 1520, 104], '#c9d0d3', [1, 1, 1], [Math.PI / 2, 0, 0]);
        if (i === 2) k.add(new THREE.TorusGeometry(34, 5, 6, 20), [ox, 1520, 112], '#f2c230');
        k.box([70, 20, 4], [ox, 1460, 90], col);
    });
    k.cyl(18, 18, 120, [-560, 1420, 120], '#e9f0f0'); k.ball(12, [-560, 1440, 120], '#2e8b57'); k.cyl(22, 22, 20, [-560, 1495, 120], '#c9d0d3');
    // Suction canister on its bracket, nurse-call plate and handset cord.
    k.box([150, 30, 90], [-280, 1290, 110], '#c9d0d3'); k.cyl(55, 55, 200, [-280, 1205, 140], '#dde9ec'); k.cyl(58, 58, 24, [-280, 1316, 140], '#f4f6f2'); k.cyl(48, 48, 60, [-280, 1140, 140], '#e9e0c4');
    k.box([110, 150, 14], [200, 1500, 96], '#f4f6f2'); k.cyl(20, 20, 8, [200, 1520, 106], '#c8433a'); k.box([10, 520, 10], [210, 1230, 110], '#e8e8e0');
    for (let s = 0; s < 4; s++) { k.box([70, 70, 10], [360 + s * 90, 1500, 95], s > 1 ? '#c8433a' : '#f4f6f2'); k.box([6, 18, 3], [352 + s * 90, 1500, 101], '#4b555a'); k.box([6, 18, 3], [368 + s * 90, 1500, 101], '#4b555a'); }
    // Reading light (arm lamp) on the patient side, the bed number and a call label.
    k.box([80, 140, 50], [480, 1870, 40], '#d9dfe0'); k.box([280, 40, 60], [380, 1940, 120], '#d9dfe0', [0, 0, -.12]);
    // Vitals monitor arm on the working side.
    k.box([90, 120, 40], [-680, 1660, 30], '#9aa7ad'); k.box([40, 40, 220], [-680, 1660, 150], '#9aa7ad'); k.box([40, 40, 160], [-660, 1660, 300], '#9aa7ad', [0, .6, 0]);
    // Night-lights: two recessed amber rectangles low on the wall.
    for (const s of [-1, 1]) k.box([200, 90, 10], [s * 640, 330, 5], '#b9c2c6');
    k.build(g, kit.dress);
    kit.monitor(g, [-640, 1470, 400], 440, n, true);
    lens(g, new THREE.BoxGeometry(250, 6, 46), '#fff1db', [.05, .05, .5, .1, .3], [380, 1915, 125], [0, 0, -.12]);
    for (const s of [-1, 1]) lens(g, new THREE.BoxGeometry(170, 60, 4), '#ffb86b', [0, 0, .25, 1.4, .15], [s * 640, 330, 12]);
    // Indirect wall-wash strip above the care board.
    kit.box(g, [1600, 40, 90], [0, 2440, 45], M.frame, 6); lens(g, new THREE.BoxGeometry(1560, 4, 60), '#fff4e6', [.2, .2, .6, .1, .5], [0, 2462, 45]);
    panel(kit, g, signText(`BED ${n + 1}`, '#608e9d', '#ffffff', '600 64px sans-serif'), [280, 90], [-720, 2050, 14], { cw: 256, ch: 82 });
    addPool(kit, g, [0, 2300, 30], [2200, 900], '#fff1dc', [.02, .02, .08, .015, .07], 'back');
    for (const s of [-1, 1]) addPool(kit, g, [s * 640, 6, 360], [900, 700], '#ffb06a', [0, 0, .02, .11, .01], 'floor');
    return g;
}
// Ceiling-track cubicle curtains: U-track round each bay at h-100 (open:
// stacked at the headwall by day; drawn on the working side and half the
// foot at night). Architecture, not furniture: the name keeps them out of
// RoomInteractions and the Groove planner.
function curtainMaterial(kit, kind) {
    const map = institutionalMap((c, W, H) => {
        c.fillStyle = '#cfe1db'; c.fillRect(0, 0, W, H);
        for (let n = 0; n < 60; n++) { const x = rnd(n) * W, y = H * .16 + rnd(n + 60) * H * .84; c.fillStyle = ['#a8c8bc', '#b9d4c9', '#9cbcb4'][n % 3]; c.beginPath(); c.ellipse(x, y, 10, 26, rnd(n + 9) * 3, 0, TAU); c.fill(); }
        c.fillStyle = '#f4f7f5'; c.fillRect(0, 0, W, H * .12); c.strokeStyle = '#c9d6d2'; for (let x = 0; x < W; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H * .12); c.stroke(); }
        for (let x = 0; x < W; x += 32) { c.fillStyle = '#00000014'; c.fillRect(x, H * .12, 14, H); }
    }, 256, 512);
    map.wrapS = THREE.RepeatWrapping; void kind;
    return kit.material('#ffffff', { map, roughness: .9, side: THREE.DoubleSide });
}
function curtainPiece(length, height, amp, period, mat) {
    const seg = Math.max(8, Math.round(length / (period / 4))), geo = new THREE.PlaneGeometry(length, height, seg, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / period * TAU) * amp);
    geo.computeVertexNormals(); const m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(length / 900, 1);
    const o = new THREE.Mesh(geo, m); o.castShadow = false; return o;
}
function buildCurtains(kit, beds) {
    const { ceiling } = kit, M = hcMaterials(kit), mat = curtainMaterial(kit);
    const g = new THREE.Group(); g.name = 'Cubicle curtain tracks'; g.userData.presentationOnly = true; kit.root.add(g);
    const top = ceiling - 100, hang = top - 30, bottom = 380, height = hang - bottom;
    beds.forEach(at => {
        const corner = [[-1150, -1150], [-1150, 1500], [1300, 1500], [1300, -1150]].map(([x, z]) => bedXZ(at, x, z));
        for (let s = 0; s < 3; s++) {
            const [ax, az] = corner[s], [bx, bzz] = corner[s + 1], len = Math.hypot(bx - ax, bzz - az), yaw = Math.atan2(-(bzz - az), bx - ax);
            const rail = kit.box(g, [len + 40, 28, 34], [(ax + bx) / 2, top, (az + bzz) / 2], M.rail, 4); rail.rotation.y = yaw; rail.castShadow = false;
            for (const t of [.1, .9]) kit.rod(g, [ax + (bx - ax) * t, top + 14, az + (bzz - az) * t], [ax + (bx - ax) * t, ceiling - 4, az + (bzz - az) * t], 5, M.rail).castShadow = false;
            // Each side: a short open stack (day) and the drawn length (night).
            const along = (t0, t1) => [ax + (bx - ax) * (t0 + t1) / 2, az + (bzz - az) * (t0 + t1) / 2];
            // Night: drawn on the bay side and half the foot; the nurse's working
            // side stays open for observation from the workstation.
            const stackAt = s === 0 ? 0 : s === 2 ? 1 : null, drawn = s === 2 ? [0, 1] : s === 1 ? [.45, 1] : null;
            if (stackAt !== null) { const len0 = 380 / len, [cx, cz] = stackAt ? along(1 - len0, 1) : along(0, len0); const o = curtainPiece(380, height, 55, 70, mat); o.position.set(cx, bottom + height / 2, cz); o.rotation.y = yaw; g.add(o); show(o, s === 0 ? [1, 1, 1, 1, 1] : [1, 1, 1, 0, 1]); }
            if (drawn) { const l = len * (drawn[1] - drawn[0]), [cx, cz] = along(...drawn); const o = curtainPiece(l, height, 26, 140, mat); o.position.set(cx, bottom + height / 2, cz); o.rotation.y = yaw; g.add(o); show(o, [0, 0, 0, 1, 0]); }
        }
    });
    return g;
}
function hygieneUnit(kit, wall, id, along, side = 1, y = 1100) {
    // Alcohol hand-rub dispenser with drip tray, a 'clean your hands' card and gloves.
    const g = wallAsset(kit, wall, id, 'Wall hand hygiene point', along, y, 0), k = detailKit();
    k.box([120, 260, 110], [0, 0, 55], '#f4f6f2'); k.box([70, 90, 6], [0, 30, 112], '#5fae8c'); k.box([60, 30, 30], [0, -110, 120], '#d9dfe0'); k.box([100, 20, 80], [0, -190, 60], '#c9d0d3');
    if (side) for (let n = 0; n < 3; n++) props.gloves(k, side * 230, -140 + n * 105, 70, ['#7ea4c9', '#9fc49b', '#c8a6d0'][n]);
    k.build(g, kit.dress);
    panel(kit, g, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.fillStyle = '#5fae8c'; c.fillRect(0, 0, W, 54); c.fillStyle = '#ffffff'; sans(c, 26, 600); c.textAlign = 'center'; c.fillText('CLEAN YOUR HANDS', W / 2, 36); c.strokeStyle = '#5fae8c'; c.lineWidth = 8; c.beginPath(); c.ellipse(W / 2 - 40, 150, 34, 58, -.3, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(W / 2 + 40, 150, 34, 58, .3, 0, TAU); c.stroke(); sans(c, 18); c.fillStyle = '#2d4b48'; c.fillText('Before and after every patient', W / 2, H - 22); }, [210, 280], [0, 330, 6], { cw: 256, ch: 340 });
    return g;
}
function framedPrint(kit, wall, id, along, y, [fw, fh], seed = 0) {
    // Calming nature print: layered hills, a lake and soft coral sky.
    const g = wallAsset(kit, wall, id, 'Wall calming nature print', along, y, 0);
    kit.box(g, [fw + 60, fh + 60, 30], [0, 0, 15], kit.oak, 4);
    panel(kit, g, (c, W, H) => {
        const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f6e3cf'); sky.addColorStop(.6, '#f3c8b4'); sky.addColorStop(1, '#e3a28c'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
        c.fillStyle = '#fbefd9'; c.beginPath(); c.arc(W * (.25 + seed * .2), H * .3, 26, 0, TAU); c.fill();
        ['#a8c4b4', '#86a99a', '#608e7d', '#47705f'].forEach((col, n) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (.42 + n * .13) + Math.sin(x / W * (5 + n) + seed * 3 + n * 1.7) * H * .07); c.lineTo(W, H); c.fill(); });
        c.fillStyle = '#b7d3d8'; c.beginPath(); c.ellipse(W * .62, H * .86, W * .22, H * .05, 0, 0, TAU); c.fill();
    }, [fw, fh], [0, 0, 32], { cw: 512, ch: Math.round(512 * fh / fw) });
    return g;
}
function supplyCabinet(kit, storage, [x, z, rot]) {
    // Clean supply cabinet: glass upper doors over labelled bins, solid lower doors.
    strip(storage); storage.position.set(x, 0, z); storage.rotation.y = rad(rot);
    storage.name = storage.userData.sceneAssetName = 'Clean supply cabinet';
    const M = hcMaterials(kit), k = detailKit();
    kit.box(storage, [1250, 1900, 420], [0, 950, 0], M.hpl, 8); kit.box(storage, [1200, 60, 380], [0, 30, -10], M.dark, 4);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const bx = -440 + c * 293, by = 1020 + r * 210; k.box([250, 150, 330], [bx, by, 10], ['#5fa6d6', '#e3a28c', '#9fc49b', '#e8c46e'][(r + c) % 4]); k.box([150, 50, 4], [bx, by + 20, 177], '#ffffff'); k.box([1180, 12, 360], [0, by - 82, 0], '#e9eef0'); }
    for (const s of [-1, 1]) { k.box([590, 870, 8], [s * 300, 1430, 206], '#9aa7ad'); k.box([12, 140, 24], [s * 20, 1300, 214], '#7f8a8f'); k.box([590, 900, 14], [s * 300, 520, 212], '#e9eef0'); k.box([12, 140, 24], [s * 20, 700, 222], '#7f8a8f'); }
    k.build(storage, kit.dress);
    for (const s of [-1, 1]) kit.box(storage, [560, 840, 6], [s * 300, 1430, 212], M.glass, 2);
    panel(kit, storage, signText('CLEAN SUPPLY', '#4f8a5b', '#ffffff', '600 46px sans-serif'), [420, 80], [0, 1940 - 70, 212], { cw: 512, ch: 98 });
}
function hospitalFurnish(kit) {
    const plan = hospitalPlan(kit.layout), M = hcMaterials(kit);
    plan.beds.forEach((at, n) => { buildBed(kit, n, at); buildBay(kit, n, at); });
    kit.cart('clinical-cart', [plan.cart[0], 0, plan.cart[1]], 'hospital');
    const storage = kit.byId('storage'); if (storage) supplyCabinet(kit, storage, plan.supply);
    if (plan.i) {
        // Side table with a lamp-free top: magazines, tissues and a water jug for visitors.
        const t = kit.asset('visitor-side-table', 'Visitor side table', plan.i === 1 ? [-plan.W + 1250, 0, plan.front - 350] : [-plan.W + 420, 0, plan.front - 600]);
        kit.box(t, [420, 24, 420], [0, 560, 0], M.wood, 8); kit.rod(t, [0, 30, 0], [0, 550, 0], 22, M.rail); kit.mesh(t, new THREE.CylinderGeometry(180, 190, 20, 20), M.dark, [0, 10, 0]);
        const k = detailKit(); k.box([230, 6, 300], [-40, 575, -20], '#c97a5b', [0, .2, 0]); k.box([220, 5, 290], [-30, 581, -10], '#7fa6b8', [0, -.1, 0]); k.box([120, 80, 110], [120, 612, 120], '#f4f6f2'); k.build(t, kit.dress);
    }
    if (plan.linen) {
        // Linen trolley: steel frame, fabric bag, clean folded linen on top.
        const t = kit.asset('linen-trolley', 'Mobile linen tool-cart', [plan.linen[0], 0, plan.linen[1]]); t.rotation.y = plan.i === 1 ? Math.PI / 2 : 0;
        for (const x of [-260, 260]) for (const z of [-180, 180]) { const wheel = kit.mesh(t, new THREE.CylinderGeometry(40, 40, 26, 12), M.dark, [x, 40, z]); wheel.rotation.z = Math.PI / 2; kit.rod(t, [x, 60, z], [x, 1000, z], 13, M.rail); }
        kit.box(t, [560, 620, 380], [0, 600, 0], kit.mat('#a8c0d0', 'fabric'), 30); kit.box(t, [600, 20, 420], [0, 990, 0], M.rail, 4);
    }
}
function hospitalDecorate(kit) {
    const plan = hospitalPlan(kit.layout), { w, bz, front, d, ceiling } = kit, W = w / 2, M = hcMaterials(kit);
    plan.beds.forEach((at, n) => buildHeadwall(kit, n, at, at[2] ? 'right' : 'back'));
    buildCurtains(kit, plan.beds);
    // One calming print per bay beside its headwall, and one behind the main desk.
    plan.beds.forEach((at, n) => { if (at[2]) { const [, z] = bedXZ(at, 1150, 0); framedPrint(kit, 'right', `calming-print-${n}`, z, 1650, [700, 500], n); } else framedPrint(kit, 'back', `calming-print-${n}`, at[0] + 1150, 1650, [700, 500], n); });
    framedPrint(kit, 'back', 'calming-print-desk', kit.layout.desk[0] - 80, 1600, [1100, 720], 2);
    plan.hygiene.forEach(([x, side], n) => hygieneUnit(kit, 'back', n ? `hygiene-station-${n}` : 'hygiene-station', x, side));
    hygieneUnit(kit, 'right', 'hygiene-station-door', plan.doorHygiene, 0);
    // Unit huddle board on the door wall (the shell's planning board).
    const board = kit.board; kit.right.add(board); board.position.set(W - 45, 1640, plan.board[0]); board.rotation.y = -Math.PI / 2; board.scale.setScalar(plan.board[1]);
    // Gloves, sharps on a bracket, aprons and lanyards by the door (former acoustic panels).
    const ppe = kit.byId('acoustic-panels');
    if (ppe) {
        strip(ppe); ppe.position.set(W - 30, 1250, plan.ppe); ppe.name = ppe.userData.sceneAssetName = 'Wall gloves, sharps and PPE point';
        const k = detailKit(); k.box([520, 760, 20], [0, 0, 10], '#e9eef0');
        for (let n = 0; n < 3; n++) props.gloves(k, -150 + n * 0, 260 - n * 105, 80, ['#7ea4c9', '#9fc49b', '#c8a6d0'][n]);
        k.box([240, 20, 160], [140, -320, 80], '#9aa7ad'); props.sharps(k, 140, -310, 80, 220, 260, 140);
        k.box([180, 260, 90], [140, 220, 55], '#f4f6f2'); for (let n = 0; n < 5; n++) k.box([150, 3, 70], [140, 140 + n * 30, 102], '#f6c9b8'); k.box([120, 30, 6], [140, 320, 104], '#c8433a');
        props.lanyards(k, -200, 650, 30); k.build(ppe, kit.dress);
    }
    // Waste: clinical (yellow) and general (black) pedal bins, a soiled linen skip.
    const bins = kit.asset('waste-bins', 'Clinical waste and linen bins', [plan.bins[0], 0, plan.bins[1]]); bins.rotation.y = -Math.PI / 2;
    { const k = detailKit(); [['#f2c230', -260], ['#2b3236', 30]].forEach(([col, x]) => { k.box([280, 600, 300], [x, 300, 0], col); k.box([290, 30, 310], [x, 615, 0], col); k.box([180, 20, 60], [x, 20, 170], '#6f7a80'); k.box([160, 60, 3], [x, 430, 151], '#ffffff'); }); k.cyl(14, 14, 900, [320, 450, 0], '#9aa7ad'); k.box([280, 20, 280], [320, 900, 0], '#9aa7ad'); k.box([270, 560, 270], [320, 600, 0], '#e3a28c'); k.build(bins, kit.dress); }
    // Wayfinding and room identity.
    const sign = kit.byId('room-sign');
    if (sign) { strip(sign); sign.position.set(kit.layout.desk[0] + 1000, 2620, bz + 50); kit.box(sign, [1640, 300, 30], [0, 0, -5], M.frame, 6); panel(kit, sign, signText(`CARE BAY ${plan.i + 3}`, '#608e9d', '#ffffff', '600 64px sans-serif', 'Inpatient ward · beds ' + (plan.i ? `1–${plan.beds.length}` : '1')), [1600, 260], [0, 0, 12], { cw: 1024, ch: 166 }); }
    const way = wallAsset(kit, 'right', 'wayfinding', 'Wall wayfinding sign', front - 1600 - 1050, 2250, 0);
    panel(kit, way, (c, W, H) => { c.fillStyle = '#26404a'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; sans(c, 30, 600); ['← CLEAN UTILITY', 'SOILED UTILITY →', '← NURSES\' STATION'].forEach((t, n) => c.fillText(t, 24, 52 + n * 50)); }, [620, 300], [0, 0, 8], { cw: 512, ch: 248 });
    // PPE caddy on the room door: aprons and a glove trio (part of the door).
    { const k = detailKit(); k.box([360, 420, 70], [-200, 1350, 75], '#e9eef0'); for (let n = 0; n < 3; n++) props.gloves(k, -200, 1180 + n * 100, 125, ['#7ea4c9', '#9fc49b', '#c8a6d0'][n]); k.box([300, 80, 20], [-200, 1530, 115], '#f6c9b8'); k.build(kit.door, kit.dress); }
    const clock = kit.byId('wall-clock'); if (clock) clock.position.x = -W + 450;
    // Window: sill planter and double roller blinds (sheer + blackout).
    const win = kit.window, k = detailKit();
    for (let n = 0; n < 3; n++) { const x = -d * .2 + n * 200; k.cyl(70, 55, 120, [x, -840, 70], ['#d8cbb2', '#c9b79a', '#e0d6c2'][n]); k.cyl(64, 64, 6, [x, -780, 70], '#5a4a3a'); for (let l = 0; l < 7; l++) k.ball(34, [x + Math.cos(l * 2.4) * 34, -740 + l * 10, 70 + Math.sin(l * 2.4) * 34], l % 2 ? '#6f9a6a' : '#4f7f58', [.6, 1.3, .6], [0, l, .5]); }
    k.build(win, kit.dress);
    windowBlinds(kit, 'hospital');
    // Floor: oak-look sheet vinyl inlay under each bay (zone, not furniture).
    const zones = floorZones(kit);
    plan.beds.forEach(at => { const [cx, cz] = bedXZ(at, 150, 150); const o = kit.box(zones, [at[2] ? 2600 : 2400, 3, at[2] ? 2400 : 2600], [cx, 1.5, cz], M.wood); o.receiveShadow = true; o.castShadow = false; });
    void ceiling;
}
function floorZones(kit) {
    if (kit.hcZones) return kit.hcZones;
    const g = kit.hcZones = new THREE.Group(); g.name = 'Clinical floor zones'; g.userData.presentationOnly = true; g.userData.grooveMarker = true; kit.root.add(g); return g;
}
function windowBlinds(kit, kind) {
    // Roller blinds inside the daylight opening (window-local: x along the
    // wall, y about the opening centre, +z into the room). Drops per daypart.
    const { window: win, d } = kit, span = d * .48, count = 3, bw = span / count - 30, M = hcMaterials(kit);
    const k = detailKit(); k.box([span + 60, 90, 130], [0, 905, 80], '#e3e7e4'); k.build(win, kit.dress);
    const sheer = kit.material('#f3f1ea', { transparent: true, opacity: kind === 'lab' ? .9 : .55, roughness: .9, side: THREE.DoubleSide });
    const blackout = kit.material(kind === 'lab' ? '#cdd6d4' : '#5f7f86', { roughness: .9, side: THREE.DoubleSide });
    const drops = kind === 'lab' ? { sheer: [.25, .45, .2, .7, .3] } : { sheer: [.15, .4, .9, 1, .3], blackout: [0, 0, 0, .96, 0] };
    for (let n = 0; n < count; n++) {
        const x = -span / 2 + (n + .5) * span / count;
        for (const [name, m, z] of [['sheer', sheer, 100], ['blackout', blackout, 122]]) {
            if (!drops[name]) continue;
            const p = kit.mesh(win, new THREE.PlaneGeometry(bw, 1), m, [x, 860, z]); p.castShadow = false; p.name = 'Window blind';
            const rail = kit.mesh(win, new THREE.BoxGeometry(bw, 24, 16), M.frame, [x, 860, z + 4]); rail.castShadow = false;
            p.userData.hcBlind = { levels: drops[name], rail };
        }
    }
}
const setBlinds = (root, i) => root.traverse(o => {
    const b = o.userData.hcBlind; if (!b) return; const h = Math.max(1, Math.min(1690, 1750 * b.levels[i]));
    o.scale.y = h; o.position.y = 860 - h / 2; b.rail.position.y = 860 - h; o.visible = b.levels[i] > .01;
});

// ---- Laboratory furnishing ------------------------------------------------
function buildBench(kit, n, [x, z]) {
    // Island bench: plinth, two drawer pedestals, black epoxy top with a lip,
    // a two-tier reagent shelf on a service spine (gas taps, sockets).
    const M = hcMaterials(kit), g = kit.asset(`lab-bench-${n}`, 'Laboratory bench', [x, 0, z]);
    kit.box(g, [1700, 100, 720], [0, 50, 0], M.dark, 4);
    for (const s of [-1, 1]) kit.box(g, [520, 780, 830], [s * 620, 490, 0], M.hpl, 6);
    kit.box(g, [720, 700, 30], [0, 520, 0], M.hpl, 4);
    kit.box(g, [1800, 30, 850], [0, 885, 0], M.epoxy, 4);
    kit.box(g, [1640, 110, 130], [0, 955, 0], M.frame, 8);
    for (const sx of [-820, 820]) kit.box(g, [30, 720, 30], [sx, 1260, 0], M.rail, 3);
    for (const y of [1200, 1500]) kit.box(g, [1680, 18, 230], [0, y, 0], M.white, 4);
    for (const y of [1200, 1500]) for (const s of [-1, 1]) lens(g, new THREE.BoxGeometry(1500, 4, 30), '#eef4fb', [.3, .5, .7, .1, .6], [0, y - 12, s * 70]);
    for (let s = 0; s < 4; s++) chairStool(kit, `lab-seat-${n}-${s}`, [x + (s % 2 ? 450 : -450), z + (s < 2 ? 720 : -720)]);
    return g;
}
function chairStool(kit, id, [x, z]) {
    // Laboratory stool: round seat, gas column, foot ring, five-star glides.
    const M = hcMaterials(kit), g = kit.asset(id, 'Laboratory stool', [x, 0, z]);
    kit.mesh(g, new THREE.CylinderGeometry(190, 180, 70, 24), kit.mat('#3f5f66', 'fabric'), [0, 640, 0]);
    kit.rod(g, [0, 80, 0], [0, 610, 0], 24, M.rail); kit.mesh(g, new THREE.TorusGeometry(190, 10, 8, 28), M.rail, [0, 330, 0]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + .3; kit.rod(g, [0, 90, 0], [Math.cos(a) * 260, 30, Math.sin(a) * 260], 15, M.dark); kit.mesh(g, new THREE.SphereGeometry(22, 10, 8), M.dark, [Math.cos(a) * 260, 22, Math.sin(a) * 260]); }
    return g;
}
function buildHood(kit, x) {
    // Fume hood: base cabinets, epoxy work surface, lined enclosure, sliding
    // sash (position per daypart), top housing with an airflow monitor, duct.
    const { bz, ceiling } = kit, M = hcMaterials(kit), hood = kit.asset('fume-hood', 'Laboratory extraction hood', [x, 0, bz + 330]);
    kit.box(hood, [1700, 850, 640], [0, 425, 0], M.hpl, 6); kit.box(hood, [1720, 30, 680], [0, 865, 10], M.epoxy, 4);
    for (const s of [-1, 1]) kit.box(hood, [80, 1460, 650], [s * 810, 1610, 0], M.white, 6);
    kit.box(hood, [1560, 1460, 30], [0, 1610, -300], kit.mat('#e8ecea', 'powder'), 4);
    kit.box(hood, [1700, 320, 660], [0, 2490, 0], M.white, 8);
    kit.mesh(hood, new THREE.CylinderGeometry(150, 150, ceiling - 2650 - 5, 24), M.steel, [0, (ceiling + 2650) / 2 - 2, -60]);
    const sash = new THREE.Group(); sash.name = 'Hood sash'; hood.add(sash);
    kit.box(sash, [1580, 40, 50], [0, 0, 340], M.rail, 6); kit.box(sash, [1580, 30, 40], [0, 760, 340], M.rail, 4);
    for (const s of [-1, 1]) kit.box(sash, [30, 760, 40], [s * 775, 380, 340], M.rail, 4);
    kit.box(sash, [1520, 720, 8], [0, 380, 340], M.glass, 2); kit.box(sash, [900, 26, 40], [0, 20, 372], M.steel, 8);
    sash.userData.hcY = [900, 1180, 900, 900, 1040];
    lens(hood, new THREE.BoxGeometry(1400, 6, 120), '#eef4fb', [.2, .9, .15, .5, .5], [0, 2320, -60]);
    // Airflow monitor (green status), digital face velocity readout.
    const k = detailKit(); k.box([200, 140, 30], [620, 2470, 340], '#2b3439'); k.box([150, 50, 6], [610, 2490, 357], '#0f2a1f');
    k.box([160, 40, 4], [-500, 2490, 333], '#f2c230'); k.box([1700, 12, 20], [0, 2335, 330], '#c9d0d3');
    props.bottle(k, -450, 880, -100, '#8a5a2b', '#3b6fa5'); props.bottle(k, -360, 880, -150, '#d8e6e6', '#c8433a', 220, 42); props.flask(k, 200, 880, -60, '#e3c46a', 1.1);
    k.build(hood, kit.dress);
    lens(hood, new THREE.BoxGeometry(20, 20, 6), '#4fd07f', [1.2, 1.2, 1.2, 1.4, 1.2], [690, 2440, 358]);
    panel(kit, hood, signText('SASH ≤ 500 mm', '#f2c230', '#1d2427', '600 40px sans-serif'), [160, 40], [-500, 2490, 336], { cw: 256, ch: 64 });
    panel(kit, hood, (c, W, H) => { c.fillStyle = '#0f2a1f'; c.fillRect(0, 0, W, H); c.fillStyle = '#5fe08a'; mono(c, 30, 600); c.fillText('0.5 m/s', 12, 38); }, [150, 50], [610, 2490, 361], { cw: 192, ch: 64, glow: .9 });
    return hood;
}
function reagentCabinet(kit, storage) {
    // Ventilated reagent cabinet: glazed upper doors (amber / clear bottles),
    // solid lower doors with acids / bases labels, vent stub.
    strip(storage); storage.name = storage.userData.sceneAssetName = 'Ventilated reagent cabinet';
    const M = hcMaterials(kit), k = detailKit();
    kit.box(storage, [1250, 1900, 420], [0, 950, 0], M.white, 8); kit.box(storage, [1200, 60, 380], [0, 30, -10], M.dark, 4);
    for (let r = 0; r < 3; r++) { k.box([1180, 12, 360], [0, 1080 + r * 260, 0], '#e9eef0'); for (let b = 0; b < 9; b++) props.bottle(k, -520 + b * 130, 1086 + r * 260, 20 - (b % 2) * 60, b % 3 ? '#8a5a2b' : '#d8e6e6', ['#3b6fa5', '#c8433a', '#2b3439'][(b + r) % 3], 170 + (b % 3) * 20, 34); }
    for (const s of [-1, 1]) { k.box([590, 860, 8], [s * 300, 1440, 206], '#9aa7ad'); k.box([590, 880, 14], [s * 300, 520, 212], '#eef1ee'); k.box([12, 140, 24], [s * 20, 700, 222], '#7f8a8f'); k.box([12, 140, 24], [s * 20, 1300, 214], '#7f8a8f'); }
    for (let v = 0; v < 8; v++) k.box([400, 8, 4], [0, 150 + v * 22, 221], '#9aa7ad');
    k.cyl(80, 80, 120, [380, 1960, -60], '#c9d0d3');
    k.build(storage, kit.dress);
    for (const s of [-1, 1]) kit.box(storage, [560, 830, 6], [s * 300, 1440, 212], M.glass, 2);
    panel(kit, storage, signText('ACIDS', '#3b6fa5', '#ffffff', '600 46px sans-serif'), [200, 64], [-300, 860, 221], { cw: 256, ch: 82 });
    panel(kit, storage, signText('BASES', '#7a5aa6', '#ffffff', '600 46px sans-serif'), [200, 64], [300, 860, 221], { cw: 256, ch: 82 });
}
function hazardDiamond(c, x, y, s, icon) {
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#ffffff'; c.fillRect(-s / 2, -s / 2, s, s); c.strokeStyle = '#d0312d'; c.lineWidth = s * .09; c.strokeRect(-s / 2 + c.lineWidth / 2, -s / 2 + c.lineWidth / 2, s - c.lineWidth, s - c.lineWidth); c.restore();
    c.fillStyle = '#1d2427'; c.strokeStyle = '#1d2427'; c.lineWidth = s * .05; const u = s * .18;
    if (icon === 'flame') { c.beginPath(); c.moveTo(x, y - u * 1.6); c.quadraticCurveTo(x + u * 1.3, y, x + u * .6, y + u); c.lineTo(x - u * .6, y + u); c.quadraticCurveTo(x - u * 1.3, y - u * .2, x, y - u * 1.6); c.fill(); c.fillRect(x - u, y + u * 1.2, u * 2, u * .3); }
    if (icon === 'excl') { c.fillRect(x - u * .2, y - u * 1.4, u * .4, u * 1.7); c.beginPath(); c.arc(x, y + u * .9, u * .25, 0, TAU); c.fill(); }
    if (icon === 'corrosion') { c.fillRect(x - u * 1.2, y + u * .6, u * 2.4, u * .5); for (const dx of [-u * .6, u * .6]) { c.beginPath(); c.moveTo(dx + x - u * .3, y - u * 1.3); c.lineTo(dx + x + u * .3, y - u * 1.3); c.lineTo(dx + x, y - u * .2); c.fill(); } }
    if (icon === 'health') { c.beginPath(); c.arc(x, y - u * .9, u * .45, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - u * .9, y + u * 1.2); c.lineTo(x - u * .5, y - u * .3); c.lineTo(x + u * .5, y - u * .3); c.lineTo(x + u * .9, y + u * 1.2); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + u * .3, y + u * .4); c.lineTo(x, y + u * .8); c.lineTo(x - u * .3, y + u * .4); c.fill(); }
    if (icon === 'env') { c.fillRect(x - u * .1, y - u * .2, u * .2, u * 1.2); c.beginPath(); c.arc(x, y - u * .5, u * .7, 0, TAU); c.fill(); c.fillRect(x - u * 1.3, y + u, u * 2.6, u * .25); c.beginPath(); c.ellipse(x + u * .9, y + u * .7, u * .4, u * .2, 0, 0, TAU); c.fill(); }
}
function labFurnish(kit) {
    const plan = labPlan(kit.layout), M = hcMaterials(kit), { bz } = kit;
    plan.benches.forEach((at, n) => buildBench(kit, n, at));
    buildHood(kit, plan.hood);
    { const cart = kit.cart('sample-cart', [plan.cart[0], 0, plan.cart[1]], 'hospital'); cart.name = cart.userData.sceneAssetName = 'Mobile sample tool-cart'; }
    const storage = kit.byId('storage'); if (storage) reagentCabinet(kit, storage);
    // Flammables safety cabinet (yellow, self-closing doors, flame pictogram).
    const fl = kit.asset('flammables-cabinet', 'Flammables safety cabinet', [plan.flammables, 0, bz + 255]);
    kit.box(fl, [1100, 1650, 500], [0, 825, 0], M.yellow, 8);
    { const k = detailKit(); for (const s of [-1, 1]) { k.box([530, 1560, 10], [s * 272, 830, 252], '#e6bb3a'); k.box([20, 220, 30], [s * 40, 900, 262], '#2b3236'); } k.box([4, 1560, 6], [0, 830, 256], '#7d5f12'); for (const s of [-1, 1]) k.cyl(40, 40, 12, [s * 420, 1580, 252], '#2b3236'); for (const s of [-1, 1]) for (const t of [-1, 1]) k.cyl(25, 25, 30, [s * 500, 15, t * 200], '#2b3236'); k.build(fl, kit.dress); }
    panel(kit, fl, (c, W, H) => { c.fillStyle = '#e1b12c'; c.fillRect(0, 0, W, H); c.fillStyle = '#c8433a'; sans(c, 44, 700); c.textAlign = 'center'; c.fillText('FLAMMABLE', W / 2, 52); c.textAlign = 'left'; hazardDiamond(c, W / 2, 150, 110, 'flame'); sans(c, 22, 600); c.fillStyle = '#1d2427'; c.textAlign = 'center'; c.fillText('KEEP FIRE AWAY', W / 2, 240); }, [460, 300], [0, 1250, 258], { cw: 384, ch: 256 });
    // Sample fridge: glass door over racked tubes, temperature readout, no-food sign.
    const fr = kit.asset('sample-fridge', 'Laboratory sample fridge', [plan.fridge, 0, bz + 330]);
    kit.box(fr, [600, 1800, 640], [0, 900, 0], M.white, 10);
    { const k = detailKit(); k.box([540, 1440, 10], [0, 960, 322], '#b9c2c6'); for (let r = 0; r < 5; r++) { k.box([500, 8, 520], [0, 380 + r * 280, 30], '#d9e3e5'); props.tubeRack(k, -110, 388 + r * 280, 60, r); props.tubeRack(k, 130, 388 + r * 280, 60, r + 7); } k.box([30, 300, 40], [240, 1000, 345], '#9aa7ad'); k.box([560, 120, 20], [0, 60, 330], '#3a4247'); k.build(fr, kit.dress); }
    kit.box(fr, [520, 1400, 6], [0, 960, 330], M.glass, 2);
    panel(kit, fr, (c, W, H) => { c.fillStyle = '#0f2a1f'; c.fillRect(0, 0, W, H); c.fillStyle = '#5fe08a'; mono(c, 34, 600); c.fillText('4.0 °C', 12, 42); }, [140, 50], [0, 1740, 330], { cw: 192, ch: 64, glow: .8 });
    panel(kit, fr, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.strokeStyle = '#c8433a'; c.lineWidth = 12; c.beginPath(); c.arc(W / 2, H * .42, H * .3, 0, TAU); c.stroke(); c.fillStyle = '#2b3236'; c.fillRect(W / 2 - 22, H * .3, 30, 40); c.beginPath(); c.arc(W / 2 + 26, H * .42, 12, 0, TAU); c.fill(); c.strokeStyle = '#c8433a'; c.beginPath(); c.moveTo(W / 2 - H * .21, H * .21); c.lineTo(W / 2 + H * .21, H * .63); c.stroke(); c.fillStyle = '#2b3236'; sans(c, 24, 600); c.textAlign = 'center'; c.fillText('NO FOOD OR DRINK', W / 2, H - 14); }, [200, 210], [0, 1560, 332], { cw: 256, ch: 270 });
    if (plan.i === 2) {
        // Refrigerated floor-standing centrifuge beside the door-wall services.
        const cf = kit.asset('floor-centrifuge', 'Refrigerated floor centrifuge', [kit.w / 2 - 420, 0, 3350]); cf.rotation.y = -Math.PI / 2;
        kit.box(cf, [640, 860, 700], [0, 430, 0], M.white, 20); kit.box(cf, [600, 30, 640], [0, 870, -10], kit.mat('#8fb9c9', 'powder'), 10);
        const k = detailKit(); k.box([220, 90, 10], [0, 760, 352], '#1d2427'); k.box([180, 40, 4], [0, 770, 358], '#2f6f74'); for (let v = 0; v < 6; v++) k.box([400, 8, 4], [0, 120 + v * 24, 352], '#9aa7ad'); k.build(cf, kit.dress);
    }
    if (plan.incubator) {
        const inc = kit.asset('incubator-stack', 'CO2 incubator stack', [plan.incubator, 0, bz + 360]);
        kit.box(inc, [720, 500, 660], [0, 250, 0], M.dark, 8);
        for (const y of [800, 1460]) { kit.box(inc, [700, 640, 680], [0, y, 0], M.white, 12); kit.box(inc, [600, 520, 14], [0, y, 346], M.hpl, 6); panel(kit, inc, (c, W, H) => { c.fillStyle = '#0f2a2a'; c.fillRect(0, 0, W, H); c.fillStyle = '#7fd1c0'; mono(c, 26, 600); c.fillText('37.0 °C  5.0 %', 10, 40); }, [220, 60], [180, y + 220, 356], { cw: 256, ch: 70, glow: .8 }); }
    }
}
function labDecorate(kit) {
    const plan = labPlan(kit.layout), { w, bz, front, d } = kit, W = w / 2, M = hcMaterials(kit);
    // Wash station with eyewash and a plumbed emergency shower over it.
    const wash = kit.asset('wash-station', 'Laboratory wash, eyewash and safety shower', [W - 300, 0, plan.wash]); wash.rotation.y = -Math.PI / 2;
    kit.box(wash, [1250, 850, 580], [0, 425, 0], M.hpl, 6); kit.box(wash, [1300, 40, 620], [0, 870, 0], M.epoxy, 4);
    { const k = detailKit(); k.box([440, 14, 360], [-250, 892, 10], '#9aa7ad'); k.box([380, 8, 300], [-250, 899, 10], '#4a5a60'); k.cyl(16, 16, 260, [-250, 1020, -250], '#c9d0d3'); k.box([20, 20, 200], [-250, 1150, -160], '#c9d0d3');
        for (const s of [-1, 1]) { k.cyl(55, 45, 50, [230 + s * 70, 950, 60], '#e1b12c'); k.cyl(60, 60, 6, [230 + s * 70, 978, 60], '#2e8b57'); } k.box([200, 30, 40], [230, 930, 150], '#2e8b57');
        k.cyl(22, 22, 1500, [480, 1650, -260], '#e1b12c'); k.box([40, 40, 640], [480, 2400, 40], '#e1b12c'); k.cyl(140, 60, 90, [480, 2340, 340], '#2e8b57'); k.box([10, 520, 10], [560, 2050, 340], '#c9d0d3'); k.add(new THREE.TorusGeometry(70, 8, 6, 3), [560, 1770, 340], '#2e8b57');
        for (let n = 0; n < 4; n++) props.washBottle(k, -520 + n * 70, 890, -220, ['#e3a23c', '#3b6fa5', '#c8433a', '#e3a23c'][n]);
        k.build(wash, kit.dress); }
    panel(kit, wash, (c, W2, H) => { c.fillStyle = '#1f9a5a'; c.fillRect(0, 0, W2, H); c.fillStyle = '#ffffff'; sans(c, 36, 700); c.fillText('EMERGENCY SHOWER', 20, 52); c.fillText('EYEWASH', 20, 100); c.beginPath(); c.arc(W2 - 70, 70, 40, 0, TAU); c.fill(); c.fillStyle = '#1f9a5a'; c.fillRect(W2 - 76, 40, 12, 60); }, [620, 180], [80, 2600, -284], { cw: 512, ch: 148 });
    // PPE station after the door: lab coats on hooks, goggle cabinet, gloves.
    const ppe = wallAsset(kit, 'right', 'ppe-station', 'Wall PPE station', plan.ppe, 0, 0);
    { const k = detailKit(); k.box([1000, 40, 60], [0, 1760, 30], '#c9d0d3');
        for (let n = 0; n < 4; n++) { const x = -370 + n * 210; k.box([20, 40, 60], [x, 1740, 60], '#7f8a8f'); k.box([300, 760, 90], [x, 1340, 80], '#f6f7f4'); k.box([320, 140, 100], [x, 1660, 80], '#eef0ec'); k.box([60, 600, 100], [x - 170, 1320, 70], '#eceee9', [0, 0, .08]); k.box([60, 600, 100], [x + 170, 1320, 70], '#eceee9', [0, 0, -.08]); k.box([4, 600, 3], [x, 1300, 126], '#d4d8d2'); }
        k.box([420, 300, 140], [-200, 760, 70], '#e9eef0'); for (let n = 0; n < 6; n++) props.glasses(k, -330 + (n % 3) * 130, 690 + Math.floor(n / 3) * 110, 60);
        for (let n = 0; n < 3; n++) props.gloves(k, 280, 640 + n * 105, 70, ['#7ea4c9', '#9fc49b', '#c8a6d0'][n]);
        k.build(ppe, kit.dress); kit.box(ppe, [400, 280, 6], [-200, 760, 142], M.glass, 2); }
    panel(kit, ppe, (c, W2, H) => { c.fillStyle = '#2f6fb0'; c.fillRect(0, 0, W2, H); c.fillStyle = '#ffffff'; sans(c, 30, 700); c.textAlign = 'center'; c.fillText('PPE REQUIRED BEYOND THIS POINT', W2 / 2, 40); ['COAT', 'GOGGLES', 'GLOVES'].forEach((t, n) => { const x = W2 * (.2 + n * .3); c.beginPath(); c.arc(x, 100, 34, 0, TAU); c.fill(); c.fillStyle = '#2f6fb0'; sans(c, 18, 700); c.fillText(t, x, 106); c.fillStyle = '#ffffff'; }); }, [900, 220], [0, 2000, 8], { cw: 640, ch: 156 });
    // Safety information board: evacuation plan, spill procedure, first aid.
    const safety = wallAsset(kit, 'right', 'safety-board', 'Wall safety information board', plan.safety, 1550, 0);
    kit.box(safety, [560, 760, 20], [0, 0, 10], M.frame, 4);
    panel(kit, safety, (c, W2, H) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, W2, H); c.fillStyle = '#1f9a5a'; c.fillRect(0, 0, W2, 50); c.fillStyle = '#ffffff'; sans(c, 24, 700); c.fillText('SAFETY INFORMATION', 14, 34);
        c.strokeStyle = '#2d4b48'; c.lineWidth = 3; c.strokeRect(20, 66, W2 - 40, 200); c.beginPath(); c.moveTo(W2 * .45, 66); c.lineTo(W2 * .45, 200); c.moveTo(20, 170); c.lineTo(W2 * .7, 170); c.stroke();
        c.strokeStyle = '#1f9a5a'; c.lineWidth = 6; c.beginPath(); c.moveTo(90, 220); c.lineTo(W2 * .8, 220); c.lineTo(W2 * .8, 120); c.stroke(); c.fillStyle = '#c8433a'; c.beginPath(); c.arc(90, 220, 9, 0, TAU); c.fill();
        c.fillStyle = '#2d4b48'; sans(c, 18, 700); c.fillText('SPILL? STOP · CONTAIN · REPORT', 18, 300);
        ['1', '2', '3', '4'].forEach((t, n) => { c.fillStyle = '#e1b12c'; c.beginPath(); c.arc(40 + n * 100, 340, 20, 0, TAU); c.fill(); c.fillStyle = '#1d2427'; c.fillText(t, 34 + n * 100, 347); });
        c.fillStyle = '#1f9a5a'; c.fillRect(W2 - 120, H - 130, 100, 100); c.fillStyle = '#ffffff'; c.fillRect(W2 - 80, H - 115, 20, 70); c.fillRect(W2 - 105, H - 90, 70, 20);
        bars(c, 20, H - 120, 260, 5, 18, '#9aa7ad');
    }, [520, 720], [0, 0, 22], { cw: 384, ch: 532 });
    // Back wall: periodic table, hazard pictograms, room identity.
    const periodic = wallAsset(kit, 'back', 'periodic-table', 'Wall periodic table poster', plan.flammables - 50, 2120, 0);
    kit.box(periodic, [1160, 680, 20], [0, 0, 10], M.frame, 4);
    panel(kit, periodic, (c, W2, H) => {
        c.fillStyle = '#f7f8f4'; c.fillRect(0, 0, W2, H); c.fillStyle = '#2d4b48'; sans(c, 20, 700); c.fillText('PERIODIC TABLE OF THE ELEMENTS', 16, 26);
        const cw = (W2 - 32) / 18, ch = (H - 70) / 9.4, col = (g, p) => g === 0 || (g === 1 && p > 0) ? '#e58f7b' : g === 1 ? '#f2b56b' : g < 12 ? '#9fc6d9' : g < 16 ? '#a6cf98' : g === 16 ? '#f3df7d' : '#c8a6d0';
        const rows = [[0, 17], [0, 1, 12, 13, 14, 15, 16, 17], [0, 1, 12, 13, 14, 15, 16, 17]];
        for (let p = 0; p < 7; p++) for (let g = 0; g < 18; g++) { if (p < 3 && !rows[p].includes(g)) continue; if (p >= 5 && g === 2) continue; c.fillStyle = col(g, p); c.fillRect(16 + g * cw, 38 + p * ch, cw - 2, ch - 2); }
        for (let r = 0; r < 2; r++) for (let g = 0; g < 15; g++) { c.fillStyle = r ? '#d9b2c9' : '#e7c3d3'; c.fillRect(16 + (g + 2.5) * cw, 38 + (7.4 + r) * ch, cw - 2, ch - 2); }
    }, [1120, 640], [0, 0, 22], { cw: 768, ch: 440 });
    const haz = wallAsset(kit, 'back', 'hazard-signs', 'Wall hazard pictograms', plan.fridge + (plan.i ? 900 : 700), 2130, 0);
    panel(kit, haz, (c, W2, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W2, H); ['flame', 'excl', 'corrosion', 'health', 'env'].forEach((t, n) => hazardDiamond(c, 60 + n * 112, H / 2, 74, t)); }, [1000, 180], [0, 0, 6], { cw: 600, ch: 108 });
    const sign = kit.byId('room-sign');
    if (sign) { strip(sign); sign.position.set(plan.fridge + (plan.i ? 900 : 700), 2560, bz + 50); kit.box(sign, [1700, 280, 30], [0, 0, -5], M.frame, 6); panel(kit, sign, signText('LAB 2.04', '#408d89', '#ffffff', '600 70px sans-serif', 'Teaching & research'), [1660, 240], [0, 0, 12], { cw: 1024, ch: 148 }); }
    const clock = kit.byId('wall-clock'); if (clock) clock.position.x = plan.hood - 1250;
    // Experiment board on the door wall (behind the demonstration desk in M/L).
    const board = kit.board; kit.right.add(board); board.position.set(W - 45, 1800, plan.board); board.rotation.y = -Math.PI / 2; board.scale.setScalar(plan.i ? .9 : .82);
    // The former acoustic panels become a spill kit and fire blanket point.
    const spill = kit.byId('acoustic-panels');
    if (spill) {
        strip(spill); spill.name = spill.userData.sceneAssetName = 'Wall spill kit and fire blanket';
        spill.position.set(W - 30, 1250, plan.spill);
        const k = detailKit(); k.box([360, 420, 140], [-120, 0, 70], '#e1b12c'); k.box([300, 60, 4], [-120, 120, 142], '#1d2427'); k.box([200, 260, 80], [220, 0, 40], '#c8433a'); k.box([180, 30, 10], [220, -150, 84], '#f4f6f2'); k.build(spill, kit.dress);
        panel(kit, spill, signText('SPILL KIT', '#e1b12c', '#1d2427', '600 46px sans-serif'), [300, 60], [-120, 120, 144], { cw: 256, ch: 52 });
    }
    // Window sill: plant growth experiment (pots A-F under a grow light).
    const win = kit.window, k = detailKit(), x0 = -d * .17;
    for (let n = 0; n < 6; n++) { const x = x0 + n * 150, h = 30 + n * 22; k.box([110, 90, 110], [x, -835, 70], '#c9b79a'); k.box([104, 6, 104], [x, -788, 70], '#5a4a3a'); k.box([6, h, 6], [x, -785 + h / 2, 70], '#5f8f4f'); for (let l = 0; l < 3; l++) k.ball(16 + n * 2, [x + (l - 1) * 16, -785 + h - l * 8, 70], '#6fa85a', [1.4, .5, 1], [0, l, 0]); k.box([40, 30, 3], [x, -840, 127], '#ffffff'); }
    for (const s of [-1, 1]) k.box([14, 420, 14], [x0 + 375 + s * 440, -590, 40], '#9aa7ad'); k.box([920, 30, 60], [x0 + 375, -380, 70], '#3a4247');
    k.build(win, kit.dress);
    lens(win, new THREE.BoxGeometry(880, 4, 40), '#e6b8ff', [.3, .3, .8, 1.2, .5], [x0 + 375, -397, 70]);
    panel(kit, win, (c, W2, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W2, H); c.fillStyle = '#2d4b48'; sans(c, 24, 700); 'ABCDEF'.split('').forEach((t, n) => c.fillText(t, 10 + n * (W2 / 6), 30)); }, [900, 30], [x0 + 375, -840, 128], { cw: 384, ch: 40 });
    windowBlinds(kit, 'lab');
    // Floor: warmer dry zone along the window, hazard tape round the hood,
    // a green safety square under the shower (zones, not furniture).
    const zones = floorZones(kit), tape = kit.material('#e8c22e', { roughness: .6 });
    kit.box(zones, [plan.dryEdge + W, 3, d], [(-W + plan.dryEdge) / 2, 1.5, bz + d / 2], kit.mat('#d6d2c4', 'stone', { roughness: .45 })).castShadow = false;
    kit.box(zones, [50, 4, d], [plan.dryEdge, 2, bz + d / 2], tape).castShadow = false;
    const hx = plan.hood; for (const [sx, sz, x, z] of [[2100, 50, hx, bz + 1100], [50, 1100, hx - 1050, bz + 550], [50, 1100, hx + 1050, bz + 550]]) kit.box(zones, [sx, 4, sz], [x, 2, z], tape).castShadow = false;
    kit.box(zones, [1000, 4, 1000], [W - 900, 2, plan.wash], kit.material('#2e8b57', { roughness: .6, transparent: true, opacity: .55 })).castShadow = false;
    void front;
}

export function furnish(kit) {
    // Batched vertex-colour detail built here needs the dress material before
    // the shared enrichment pass creates kit.dress.
    if (!kit.dress) { kit.dress = kit.material('#ffffff', { vertexColors: true, roughness: .68 }); kit.dress.userData.roomSurface = 'powder'; }
    hcMaterials(kit);
    // The planning table is the hospital handover table / the lab results table.
    if (kit.spec.kind === 'lab') labFurnish(kit); else hospitalFurnish(kit);
}
export function dressProp(id, k, g, kit) {
    const lab = kit.spec.kind === 'lab';
    if (/^care-bed/.test(id)) {
        // Rails' bars, call bell cord and handset, urinal hanger, bed controls,
        // folded blanket stripe and a footboard bed number plate.
        for (const s of [-1, 1]) for (const [z0, len] of [[-640, 620], [260, 820]]) for (let b = 0; b < 3; b++) k.box([12, 12, len - 90], [s * 520, 700 + b * 70, z0], '#9aa7ad');
        k.box([942, 48, 40], [0, 688, 600], '#e3a28c');
        k.box([60, 150, 30], [-330, 690, -380], '#e8e8e0', [Math.PI / 2, 0, .3]); k.box([8, 8, 600], [-330, 680, -700], '#e8e8e0');
        k.box([90, 190, 60], [535, 650, 480], '#e9e2c8'); k.box([40, 60, 30], [535, 760, 480], '#e9e2c8');
        k.box([80, 160, 40], [535, 700, -200], '#d9dfe0'); k.box([60, 40, 6], [535, 730, -178], '#2b3439');
        k.box([300, 120, 8], [0, 860, 1078], '#f4f6f2'); k.box([200, 30, 3], [0, 880, 1083], '#608e9d');
        k.box([920, 3, 1210], [0, 664, 380], '#f8f9f6');
    }
    if (/^patient-monitor/.test(id)) {
        // Locker: drawer fronts, personal book, photo frame and get-well card.
        for (let n = 0; n < 2; n++) { k.box([400, 180, 8], [110, 560 - n * 220, -258], '#608e9d'); k.box([140, 20, 14], [110, 600 - n * 220, -250], '#d9dfe0'); }
        k.box([160, 30, 220], [40, 827, -520], '#c97a5b'); k.box([150, 24, 210], [44, 828, -518], '#f1ead6');
        k.box([120, 160, 14], [220, 895, -560], '#8a6a4a', [-.2, 0, 0]); k.box([96, 130, 4], [220, 897, -553], '#a9c7d6', [-.2, 0, 0]);
        k.box([110, 150, 3], [10, 885, -400], '#f2d36b', [0, 0, .5]); k.box([110, 150, 3], [70, 885, -400], '#f6c1d0', [0, 0, -.5]);
        // Infusion pump screen, bag and line; overbed table edge; recliner seam.
        k.box([120, 70, 4], [-260, 1240, -494], '#2b3439'); k.box([60, 14, 3], [-275, 1240, -491], '#5fe08a');
        k.box([140, 220, 30], [-260, 1860, -620], '#e8f2f0'); k.box([100, 40, 32], [-260, 1980, -620], '#f4f6f2'); k.box([6, 650, 6], [-260, 1450, -600], '#e8f2f0');
        k.box([560, 6, 610], [80, 492, 390], '#3f6874');
    }
    if (id === 'clinical-cart' || id === 'sample-cart') {
        // Labelled drawers / bins; portable vitals monitor (hospital) or racks (lab).
        for (let n = 0; n < 3; n++) { k.box([120, 30, 4], [-175 + n * 175, 600, 132], '#ffffff'); }
        if (lab) { props.tubeRack(k, -120, 945, 0, 3); props.tubeRack(k, 140, 945, 0, 9); props.bottle(k, 230, 515, -100, '#d8e6e6', '#3b6fa5', 160, 34); k.box([160, 120, 120], [-200, 580, -60], '#3b6fa5'); }
        else { props.gloves(k, -180, 913, 140, '#7ea4c9'); props.sanitiser(k, 230, 913, 150); props.sharps(k, 200, 913, -120, 200, 220, 120); k.box([240, 190, 120], [-150, 1040, -120], '#e9ecea'); k.box([200, 120, 4], [-150, 1050, -59], '#0f1d24'); for (let n = 0; n < 3; n++) k.box([120, 4, 2], [-170, 1080 - n * 30, -56], ['#5fe08a', '#5fd3e6', '#f2e46b'][n]); k.box([30, 30, 2], [-60, 1080, -56], '#5fe08a'); }
    }
    if (/^lab-bench/.test(id)) {
        // Pedestal drawers and handles, spine taps and sockets, reagent bottles,
        // wash bottles, a teaching microscope, tip box, timer, burner, notebook,
        // the broken-glass bin at the bench end.
        for (const s of [-1, 1]) for (const zs of [-1, 1]) for (let r = 0; r < 3; r++) { k.box([480, 220, 8], [s * 620, 760 - r * 240, zs * 419], '#f3f5f2'); k.box([140, 16, 16], [s * 620, 830 - r * 240, zs * 428], '#7f8a8f'); }
        for (const zs of [-1, 1]) { for (const x of [-450, 450]) { k.box([40, 50, 30], [x, 955, zs * 80], '#c9a03c'); k.box([60, 14, 14], [x, 985, zs * 92], '#e1b12c'); } for (let n = 0; n < 4; n++) k.box([70, 70, 8], [-180 + n * 120, 955, zs * 69], n === 3 ? '#c8433a' : '#f4f6f2'); }
        for (const y of [1209, 1509]) for (let b = 0; b < 11; b++) props.bottle(k, -720 + b * 144, y, (b % 2 ? 40 : -40), b % 3 === 1 ? '#d8e6e6' : '#8a5a2b', ['#3b6fa5', '#c8433a', '#2b3439'][(b + y) % 3], 150 + (b % 3) * 25, 32);
        props.washBottle(k, -760, 900, 300, '#e3a23c'); props.washBottle(k, 760, 900, -300, '#3b6fa5');
        props.microscope(k, 560, 900, 230); props.tipBox(k, -260, 900, -320); props.timer(k, -360, 900, 330); props.notebook(k, 300, 900, -310, '#7a5aa6');
        props.miniFuge(k, 20, 900, -290);
        if (id === 'lab-bench-1' && kit.layout.index === 1) { k.box([420, 380, 380], [-640, 1090, -210], '#eef1ee'); k.box([340, 300, 6], [-640, 1090, -18], '#d9dfe0'); k.box([120, 40, 4], [-560, 1210, -14], '#0f2a2a'); }
        k.box([300, 420, 260], [1050, 210, 0], '#f2f4f1'); k.box([310, 30, 270], [1050, 435, 0], '#c8433a'); k.box([200, 60, 3], [1050, 300, 131], '#c8433a');
    }
    if (id === 'activity-table') {
        // Handover / results table finishing: edge band and a tray of supplies.
        k.box([1304, 36, 3], [0, 722, 327], lab ? '#22282b' : '#8f7350'); k.box([1304, 36, 3], [0, 722, -327], lab ? '#22282b' : '#8f7350');
    }
}
// Daypart staging groups attached to their own furnishing.
function stageGroups(kit) {
    const M = hcMaterials(kit), lab = kit.spec.kind === 'lab';
    if (lab) {
        labPlan(kit.layout).benches.forEach((_, n) => {
            const bench = kit.byId(`lab-bench-${n}`); if (!bench) return;
            // Practical session: flasks with coloured liquid, beakers, lit burners
            // (staged on the bench, the reagent shelves stay as they are).
            const g = new THREE.Group(); g.name = 'Practical session glassware'; bench.add(g); show(g, [0, 1, 0, 0, 0]);
            const prep = new THREE.Group(); prep.name = 'Reagents set out'; bench.add(prep); show(prep, [1, 0, 0, 0, 0]);
            { const kp = detailKit(); for (let b = 0; b < 5; b++) props.bottle(kp, -520 + b * 130, 900, 230 - (b % 2) * 420, b % 2 ? '#d8e6e6' : '#8a5a2b', ['#3b6fa5', '#c8433a'][b % 2], 170, 34); for (let b = 0; b < 4; b++) props.printout(kp, -400 + b * 260, 900, b % 2 ? -250 : 260, 210, 150, (b - 1.5) * .05); kp.build(prep, kit.dress); }
            const k = detailKit(), liquid = detailKit();
            for (const s of [-1, 1]) { props.burner(k, s * 300, 900, s * 200); }
            [[-500, 150, '#79c2b3'], [-200, -180, '#e3c46a'], [180, 170, '#c97a8f'], [420, -150, '#79c2b3']].forEach(([x, z, col], m) => { props.beaker(k, x + 80, 900, z, 40, 90, '#dfeaea'); liquid.cyl(54, 58, 50, [x, 925, z], col); k.cyl(15, 62, 110, [x, 955, z], '#dfeaea'); k.cyl(15, 15, 55, [x, 1037, z], '#dfeaea'); void m; });
            k.build(g, kit.dress); liquid.build(g, M.liquid);
            const flames = new THREE.Group(); g.add(flames); show(flames, [0, 1, 0, 0, 0]);
            for (const s of [-1, 1]) lens(flames, new THREE.ConeGeometry(16, 70, 10), '#5fa6ff', [1.4, 1.4, 1.4, 1.4, 1.4], [s * 300, 1060, s * 200]);
            // Instrument watch: one tube rack left in the centrifuge queue.
            const night = new THREE.Group(); night.name = 'Overnight samples'; bench.add(night); show(night, [0, 0, 0, 1, 0]);
            const kn = detailKit(); props.tubeRack(kn, 200, 900, 150, 4); props.timer(kn, 420, 900, 160); kn.build(night, kit.dress);
        });
    } else {
        hospitalPlan(kit.layout).beds.forEach((_, n) => {
            const bay = kit.byId(`patient-monitor-${n}`); if (!bay) return;
            // Morning: water jug and cup on the overbed table; afternoon: a
            // visitor's coat over the recliner arm; night: a blanket on the recliner.
            const k = detailKit(); const m = new THREE.Group(); bay.add(m); show(m, [1, 0, 0, 0, 0]);
            k.cyl(55, 50, 200, [-500, 973, -60], '#e9f2f2'); k.cyl(56, 56, 14, [-500, 1078, -60], '#5fa6d6'); k.cyl(32, 28, 90, [-360, 918, 60], '#f4f6f2'); k.box([200, 4, 150], [-620, 875, 80], '#f4f2ea'); k.build(m, kit.dress);
            const a = new THREE.Group(); bay.add(a); show(a, [0, 1, 0, 0, 1]);
            const ka = detailKit(); ka.box([500, 30, 240], [120, 660, 700], '#5d4a6e', [0, 0, -.1]); ka.box([200, 300, 20], [100, 520, 740], '#5d4a6e'); ka.build(a, kit.dress);
            const nb = new THREE.Group(); bay.add(nb); show(nb, [0, 0, 1, 1, 0]);
            const kb = detailKit(); kb.box([520, 40, 500], [60, 515, 390], '#a9c5d0', [0, 0, .05]); kb.box([200, 50, 140], [-470, 900, 10], '#f4f2ea'); kb.build(nb, kit.dress);
        });
    }
}
export function decorate(kit) {
    if (kit.spec.kind === 'lab') labDecorate(kit); else hospitalDecorate(kit);
    stageGroups(kit);
}
export function finishDecor(kit) {
    // Every room surface dithered (lamp falloff on large plain walls).
    kit.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) m.dithering = true; });
}
export function activityMaterials(k, phase, y, kit) {
    if (kit?.spec.kind === 'lab') {
        // Lab prep / results table: checklists, worksheets, printouts, overnight log, posters.
        if (phase === 0) { props.printout(k, 300, y, -60, 297, 210, .1); props.printout(k, 120, y, 120, 210, 297, -.1); props.bottle(k, 480, y, 160, '#8a5a2b', '#3b6fa5', 160, 32); props.bottle(k, 560, y, 140, '#d8e6e6', '#c8433a', 150, 30); }
        if (phase === 1) for (let n = 0; n < 4; n++) props.printout(k, 0 + n * 150, y + n, -40 + (n % 2) * 160, 210, 297, (rnd(n) - .5) * .4);
        if (phase === 2) { props.printout(k, 260, y, -40, 420, 297, .05); props.printout(k, 380, y + 1, 150, 297, 210, -.08); props.notebook(k, -120, y, 120, '#2f5e6b'); }
        if (phase === 3) { props.notebook(k, 300, y, -60, '#2f5e6b'); props.tubeRack(k, 120, y, 140, 2); }
        if (phase === 4) { for (let n = 0; n < 3; n++) props.printout(k, -80 + n * 260, y + n, 20, 594 * .4, 420 * .4, (n - 1) * .06); props.molecule(k, 480, y, -170); }
        return;
    }
    // Hospital handover table: rounds list, discharge folders, SBAR card and
    // two mugs (the only mugs in the ward), the night log, huddle cards.
    const sbar = (x, z, r = 0) => { k.box([210, 2, 150], [x, y + 1, z], '#f4f2ea', [0, r, 0]); ['#c8433a', '#e1b12c', '#4f8a5b', '#5fa6d6'].forEach((col, n) => k.box([196, 1.5, 28], [x, y + 2.4, z - 51 + n * 34], col, [0, r, 0])); };
    if (phase === 0) { props.printout(k, 300, y, -60, 297, 210, .1); k.box([236, 11, 330], [120, y + 5, 100], '#6f5a3a', [0, -.12, 0]); }
    if (phase === 1) for (let n = 0; n < 3; n++) k.box([230, 12, 310], [160 + n * 120, y + 6 + n * 12, -20], ['#a9c5d0', '#cfe1db', '#e3a28c'][n]);
    if (phase === 2) { sbar(220, -40, .08); for (const [x, z] of [[460, 140], [-60, 160]]) { k.cyl(40, 34, 95, [x, y + 47, z], '#e6d6b8'); k.cyl(36, 36, 3, [x, y + 94, z], '#5a3e2a'); } }
    if (phase === 3) { props.notebook(k, 300, y, -60, '#2f5e6b'); k.box([60, 24, 160], [80, y + 12, 120], '#3a4247'); }
    if (phase === 4) { sbar(-80, 40, -.06); for (let n = 0; n < 9; n++) k.box([75, 2, 75], [180 + (n % 3) * 90, y + 1, -150 + Math.floor(n / 3) * 90], ['#f2d36b', '#9fd0b4', '#f0a98f'][n % 3], [0, (rnd(n) - .5) * .3, 0]); k.cyl(40, 34, 95, [560, y + 47, 200], '#e6d6b8'); }
}
// The first care bed carries a reading light (second local lamp).
export function extraLamps(kit) {
    const { spec, byId, dress, box, material, root, lamps } = kit;
    if (spec.kind !== 'hospital') return;
    const bed = byId('care-bed-0');
    if (bed) {
        const k = detailKit(); k.box([24, 340, 24], [-380, 1240, -1060], '#9aa7ad'); k.box([260, 60, 90], [-300, 1400, -1000], '#d9dfe0', [-.5, 0, 0]); k.build(bed, dress);
        const m = material('#fff1db', { emissive: '#ffdeb0', emissiveIntensity: .4 }); box(bed, [220, 8, 60], [-300, 1378, -985], m, 2);
        const light = new THREE.PointLight('#ffe4bf', 0, 1700 * root.scale.x, 2); light.position.set(-300, 1300, -860); bed.add(light); lamps.push({ light, luminous: m, clinicalLamp: true, color: '#ffe4bd' });
    }
}
export function atmosphere(phase, gain, kit) {
    const i = phaseIndex(phase), now = CURRENT[kit.spec.id] = kit.root.userData.hcPhase = { phase, gain };
    setBlinds(kit.root, i);
    if (kit.spec.kind === 'hospital' && kit.lights?.[0]) kit.lights[0].intensity *= [1, 1, .8, .5, 1][i];
    applyPhase(kit.root, now);
    for (let n = MAIN_DETAIL.length - 1; n >= 0; n--) {
        const e = MAIN_DETAIL[n], on = attached(e.g);
        if (!on) { if (e.seen || !e.g.parent) MAIN_DETAIL.splice(n, 1); continue; }
        e.seen = true; if (e.sceneId === kit.spec.id) applyPhase(e.g, now);
    }
}

// ---- Daily staging (room-life.mjs) --------------------------------------
export function stageKit({ h, m, g, y, spec, active, social, THREE: T }) {
    if (spec.kind === 'lab') {
        h.box(g, [130, 8, 70], [160, y + 4, 0], m.linen, 4);
        for (let n = 0; n < (active || social ? 4 : 2); n++) { h.mesh(g, new T.CylinderGeometry(8, 8, 45, 10), m.linen, [115 + n * 28, y + 30, 0]); h.mesh(g, new T.CylinderGeometry(9, 9, 6, 10), m.clay, [115 + n * 28, y + 56, 0]); }
    } else {
        h.box(g, [105, 6, 140], [170, y + 3, 0], m.ink, 5); h.box(g, [92, 2, 120], [170, y + 7, 0], m.paper, 3);
        h.box(g, [40, 4, 9], [170, y + 10, -60], m.brass, 2);
    }
}
