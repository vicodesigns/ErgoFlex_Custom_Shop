import * as THREE from 'three';
import { institutionalMap, screenHeader, screenFooter, detailKit, plant, rnd } from './institutional-detail.mjs?v=institutional-sweep-20261009';

// Mobile IT group: `mobileit` (kind it). A field-service depot and tech bar.
// Devices flow intake (tech bar / asset intake) → repair (ESD bench) →
// imaging → staging carts → deployment through the door; a bayed 42U rack row
// with a 1.2 m cold aisle stands against the back wall. This module owns the
// registry overrides, ErgoFlex desk roles, displays, furnishings, decor and
// daily staging. Shared shell: institutional-room.mjs (kit).
//
// Room frame (mm): x across (−x window wall, +x door wall, door centred at
// front − 1600), z from the back wall `bz` to the open front. Small / Medium /
// Large = apartment / house / spacious (index 0 / 1 / 2). Layouts were
// clearance-checked with the real station envelope (desk ±545 deep incl. the
// shelf and feet, chair 1050 in front): ≥ 900 between independent items, door
// zone (x ≥ w/2 − 1100, z front − 2200 … front − 1000) clear, cold aisle clear.
export const GROUP = 'it';
export const SCENES = ['mobileit'];
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const LABELS = ['System checks', 'Service session', 'Maintenance', 'Overnight monitoring', 'Team deployment'];
const phaseIndex = phase => Math.max(0, PHASES.indexOf(phase));
const TAU = Math.PI * 2;
const BLUE = '#467eaa', YELLOW = '#f2c230', RACK = '#1d252b', GREEN_LED = '#58d68d', AMBER_LED = '#f5b041', BLUE_LED = '#5dade2';

// ---- Registry data (merged by institutional-scenes.mjs) -----------------
export const lighting = {
    it: { practical: [.34, .42, .76, .5, .74], wash: [.18, .18, .28, .12, .36], task: '#deedf0', bounce: '#9bbbc8' }
};
// Desktop placements: [x, y, z] in the desktop / shelf frame (+z toward the user).
const P = (id, x, z, turn = 0, y = 0, extra = {}) => ({ id, at: [x, y, z], ...(turn ? { turn } : {}), ...extra });

// Per daypart: registry light mode (from the brief, for the lighting pass to
// tune) and the main desk pose [height in, tilt deg, yaw deg]. Desk LEDs stay
// off by day (their spill washes the black desktop); low-value teal at night.
const lmode = (key, fill, sky, power, ambient, exposure, practical, wash, color) => ({ key, fill, sky, power, ambient, exposure, practical, wash, leds: !!color, ...(color ? { color } : {}) });
const MODES = [
    lmode('#f5f2ea', '#dce8ef', ['#bad8e5', '#f5e6ca'], 1.45, .42, 1.06, .34, .18),
    lmode('#f0f7ff', '#e1edf2', ['#94c5de', '#e4eff1'], 1.5, .45, 1.04, .42, .18),
    lmode('#ffd6ac', '#d0d9ea', ['#ba96a4', '#f0c89e'], .65, .26, 1.09, .76, .28),
    lmode('#a9c0dd', '#93aec9', ['#0f2034', '#2f4864'], .18, .12, 1.15, .5, .12, '#163f46'),
    lmode('#e2ebf2', '#d5e8e7', ['#a9cdd7', '#ede3cd'], 1.1, .38, 1.07, .74, .36, '#1d3d3a')
];
// System checks standing; service session seated; maintenance mid; overnight
// seated, slight back tilt; team deployment standing, turned toward the carts.
const POSE = [[43.5, 0], [28, 0], [35, 0], [28, -5], [43.5, 0, 30]];

// ---- Tier geometry ------------------------------------------------------
const tierOf = l => {
    const i = l.index, w = l.width, d = l.depth, bz = l.back, front = bz + d;
    const racks = 2 + i, rackX0 = [200, -700, -1600][i];
    return { i, w, d, bz, front, door: front - 1600, racks, rackX0, rackX1: rackX0 + racks * 600, rackZ: bz + 40 + 500, rackFront: bz + 1040,
        shelving: [w / 2 - 250, [-1200, -1933, -2667][i]], locker: i ? [[0, 2350, 2250][i], bz + 265] : null,
        carts: [[[-2350, 2050], [-2350, 2650]], [[0, 3000], [800, 3000], [1600, 3000]], [[3300, 2400], [3300, 3200], [4080, 2400], [4080, 3200]]][i],
        activity: [[-1700, 4150], [-2400, 5517], [-1700, 6983]][i],
        // Window opening (−x wall), z range.
        win: [bz + d * .54 - d * .24, bz + d * .54 + d * .24] };
};

// ---- ErgoFlex desks -----------------------------------------------------
// Fields: see docs "Extra ErgoFlex desks". `role` selects stationDetail().
// Standing roles have no chair; seated ones get a Steelcase chair 1050 in front.
const STATION = {
    imaging: (at) => ({ id: 'imaging-deployment', name: 'Laptop imaging and deployment station', size: '60x30', at, turn: 0, height: 43.5, tilt: 0, chair: false, role: 'imaging',
        // Laptops are procedural (lids open on imaging progress screens).
        desktop: [], shelf: [] }),
    techbar: (at) => ({ id: 'tech-bar-walkup', name: 'Tech bar walk-up help', size: '48x30', at, turn: 270, height: 43.5, tilt: 0, chair: false, role: 'techbar',
        desktop: [P('kenney-furniture-laptop', 160, -10), P('wireless-charger', 470, 140), P('earbuds-case', 430, -140, 25)],
        shelf: [] }),
    console: (at) => ({ id: 'rack-console', name: 'Rack-side console', size: '48x30', at, turn: 0, height: 40, tilt: 0, chair: false, role: 'console',
        desktop: [P('kenney-furniture-computer-keyboard', -40, 120), P('kenney-furniture-computer-mouse', 300, 110), P('clipboard', 450, 40, 10, 1)], shelf: [] }),
    repair: (at) => ({ id: 'repair-bench', name: 'ESD repair bench', size: '60x30', at, turn: 0, height: 28, tilt: 0, role: 'repair',
        desktop: [P('multi-tool-open', 150, 170), P('caliper', 400, 160, 15)], shelf: [] }),
    noc: (at) => ({ id: 'noc-monitoring', name: 'Network monitoring', size: '60x30', at, turn: 0, height: 28, tilt: 0, role: 'noc',
        desktop: [P('office-keyboard', -80, 120), P('kenney-furniture-computer-mouse', 330, 110), P('headphones', -580, -90, 20), P('insulated-mug', 620, 60)], shelf: [] }),
    intake: (at) => ({ id: 'asset-intake', name: 'Asset intake and returns', size: '48x30', at, turn: 0, height: 28, tilt: 0, role: 'intake',
        desktop: [P('tablet-pc', -250, 60), P('papers-envelopes', 250, 120)], shelf: [] })
};
const STATIONS = [
    [STATION.imaging([1600, 1000]), STATION.techbar([1000, 3800])],
    [STATION.console([200, 348]), STATION.imaging([2500, 600]), STATION.techbar([2100, 5167]), STATION.repair([-2550, 2000])],
    [STATION.console([-400, -386]), STATION.noc([-3450, 1500]), STATION.repair([-3450, 4500]), STATION.imaging([2000, 0]), STATION.intake([1000, 3500]), STATION.techbar([3000, 6633])]
];
export function stations(sceneId, layout) {
    return (STATIONS[layout.index] || []).map(s => ({ ...s, at: [...s.at], desktop: s.desktop.map(p => ({ ...p })), shelf: s.shelf.map(p => ({ ...p })) }));
}

// Main desk: the field technician's diagnostic desk (dock and cable coil are
// procedural, see mainDeskDetail).
export const sceneOverrides = {
    mobileit: {
        boardTitle: 'TICKETS & DEPLOYMENTS',
        caption: 'A field-service depot: intake, repair, imaging and deployment.',
        modes: Object.fromEntries(PHASES.map((p, i) => [p, { ...MODES[i], height: POSE[i][0], tilt: POSE[i][1], yaw: POSE[i][2] || 0, offset: [0, 0] }])),
        desk: [P('kenney-furniture-laptop', -260, 0), P('multi-tool', 300, 130, 20), P('headphones', -560, -110, 15)],
        shelf: [],
        layout(tier, l) {
            const t = tierOf(l);
            l.activity = [...t.activity];
            const add = (id, at, turn = 0) => l.props.push({ id, at, ...(turn ? { turn } : {}) });
            // Field tech kit: a daypack behind the diagnostic desk, by the back wall.
            add('backpack-daypack', [[-2600, -2950, -4400][t.i], 0, t.bz + 260], 20);
            if (t.i === 1) { add('cardboard-boxes', [-500, 0, 4800], 15); add('ficus', [-3500, 0, t.bz + 380]); }
            if (t.i === 2) {
                add('cardboard-boxes', [2100, 0, 3300], -10);
                add('tool-cart', [-1800, 0, 5000], 90);
                add('potted-tree', [-4300, 0, t.front - 500]);
            }
        }
    }
};
export const finish = spec => ({ name: spec.name + ' · ESD tile, powder-coated racks & wire shelving', ground: '#626f76', wood: .5, metal: .36, stone: .55, night: .92, partyDay: true });

// ---- Canvas content (generic, illustrative only) --------------------------
// Generic sign / label typography: a neo-grotesque stack (Helvetica / Arial
// metrics, Liberation or Nimbus Sans on Linux) and a mono stack for terminals.
const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif', MONO = '"DejaVu Sans Mono", "Liberation Mono", Menlo, monospace';
const reset = c => { c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.globalAlpha = 1; c.lineWidth = 1; c.setLineDash?.([]); if ('letterSpacing' in c) c.letterSpacing = '0px'; };
const text = (c, s, x, y, size, color, { align = 'left', weight = '600', font = 'sans-serif', max, spacing = 0 } = {}) => {
    c.font = `${weight} ${size}px ${font === 'sans-serif' ? SANS : font === 'monospace' ? MONO : font}`; if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
    c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y, max); c.textAlign = 'left'; if (spacing && 'letterSpacing' in c) c.letterSpacing = '0px';
};
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const dot = (c, x, y, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const SITES = ['SITE 01', 'SITE 02', 'SITE 03', 'SITE 04', 'SITE 05', 'SITE 06'];

// Network topology: core → two distribution → six access sites. `alert`
// marks one access link amber (overnight monitoring).
function topology(c, x, y, W, H, { dark = true, alert = false, scale = 1 } = {}) {
    const core = [x + W / 2, y + H * .17], dist = [[x + W * .3, y + H * .48], [x + W * .7, y + H * .48]];
    const sites = SITES.map((_, n) => [x + W * (.08 + n * .168), y + H * .82]);
    c.lineWidth = 3 * scale;
    for (const d of dist) { c.strokeStyle = dark ? '#5fb3c9' : BLUE; c.beginPath(); c.moveTo(...core); c.lineTo(...d); c.stroke(); }
    c.strokeStyle = dark ? '#5fb3c9' : BLUE; c.beginPath(); c.moveTo(...dist[0]); c.lineTo(...dist[1]); c.stroke();
    sites.forEach((s, n) => { const amber = alert && n === 4; c.strokeStyle = amber ? AMBER_LED : dark ? '#4c8ea0' : '#7d9fb8'; c.setLineDash(amber ? [8 * scale, 6 * scale] : []); c.beginPath(); c.moveTo(...dist[n < 3 ? 0 : 1]); c.lineTo(...s); c.stroke(); });
    c.setLineDash([]);
    const node = ([nx, ny], label, w, fill, ring) => { c.fillStyle = fill; rrect(c, nx - w / 2, ny - 18 * scale, w, 36 * scale, 6 * scale); c.fill(); if (ring) { c.strokeStyle = ring; c.lineWidth = 3 * scale; c.stroke(); } text(c, label, nx, ny + 6 * scale, 15 * scale, dark ? '#e3f2f2' : '#ffffff', { align: 'center' }); };
    node(core, 'CORE', 110 * scale, dark ? '#24566a' : '#2c5878');
    dist.forEach((d, n) => node(d, n ? 'DIST-B' : 'DIST-A', 110 * scale, dark ? '#2b6170' : BLUE));
    sites.forEach((s, n) => { node(s, SITES[n], 92 * scale, dark ? '#20404c' : '#5d8fb3', alert && n === 4 ? AMBER_LED : null); dot(c, s[0] + 38 * scale, s[1] - 14 * scale, 5 * scale, alert && n === 4 ? AMBER_LED : GREEN_LED); });
}
// Screen content, also used for the procedural station monitors.
function paintScreen(c, W, H, variant, phase) {
    const i = phaseIndex(phase), night = phase === 'night';
    reset(c);
    if (variant === 'queue') {
        // Tech bar queue display.
        c.fillStyle = '#10232d'; c.fillRect(0, 0, W, H);
        c.fillStyle = BLUE; c.fillRect(0, 0, W, H * .2); text(c, 'TECH BAR', 24, H * .14, H * .1, '#eaf3f8');
        if (i === 2 || i === 3) {
            text(c, 'CLOSED', W / 2, H * .55, H * .2, '#e6eef2', { align: 'center' });
            text(c, 'Use the drop-box · open 08:00', W / 2, H * .75, H * .07, '#9fc0cf', { align: 'center', weight: '400' });
        } else {
            const now = i === 4 ? 21 : i === 0 ? 4 : 12;
            text(c, 'NOW SERVING', W * .06, H * .36, H * .075, '#9fc0cf');
            text(c, String(now), W * .06, H * .68, H * .3, '#ffffff');
            text(c, 'NEXT', W * .58, H * .36, H * .075, '#9fc0cf');
            text(c, String(now + 1), W * .58, H * .62, H * .2, '#cfe4ee');
            text(c, i === 4 ? 'Deployment day · pick-ups at the bay' : 'Drop-off · loans · help', W * .06, H * .86, H * .06, '#9fc0cf', { weight: '400' });
        }
        c.fillStyle = '#18323c'; c.fillRect(0, H - H * .08, W, H * .08); return;
    }
    const titles = { topology: 'NETWORK / TOPOLOGY', imaging: 'IMAGING · DEPLOYMENT QUEUE', diag: 'DEVICE DIAGNOSTICS', terminal: 'CONSOLE · RACK 02', noc: 'NETWORK OPERATIONS', bench: 'BENCH · BOARD VIEW', intake: 'ASSET INTAKE', checklist: 'FIELD TECH · TODAY' };
    screenHeader(c, W, H, titles[variant] || 'FIELD SERVICES');
    const top = 54, bottom = H - 44;
    if (variant === 'topology' || variant === 'noc') {
        topology(c, 16, top, variant === 'noc' ? W * .64 : W - 32, bottom - top, { alert: night, scale: W / 900 });
        if (variant === 'noc') {
            const x0 = W * .67; c.fillStyle = '#16303a'; c.fillRect(x0, top + 6, W - x0 - 14, bottom - top - 12);
            text(c, 'ALERTS', x0 + 12, top + 30, 15, '#cae5e7');
            ['CORE  ok', 'DIST-A  ok', 'DIST-B  ok', night ? 'SITE 05  link degraded' : 'SITE 05  ok', 'BACKUP  ' + (night ? 'running' : 'ok')].forEach((s, n) => {
                const warn = night && (n === 3); dot(c, x0 + 18, top + 54 + n * 26, 5, warn ? AMBER_LED : GREEN_LED); text(c, s, x0 + 30, top + 59 + n * 26, 13, warn ? '#f5d29a' : '#bcd8d6', { weight: '400', font: 'monospace' });
            });
            // Throughput sparkline.
            c.strokeStyle = '#7ec4ba'; c.lineWidth = 2; c.beginPath(); for (let n = 0; n < 40; n++) c.lineTo(x0 + 12 + n * (W - x0 - 40) / 40, bottom - 30 - (Math.sin(n * .5 + i) * .4 + .6 + rnd(n) * .3) * 40); c.stroke();
        }
    } else if (variant === 'imaging') {
        const rows = 6;
        for (let n = 0; n < rows; n++) {
            const y = top + 12 + n * (bottom - top - 16) / rows, done = i === 4 ? 1 : Math.min(1, (.25 + rnd(n + i * 7) * .9) * (night ? .8 : 1));
            text(c, `LT-${(1040 + n * 7)}`, 18, y + 18, 15, '#cae5e7', { font: 'monospace', weight: '400' });
            c.fillStyle = '#21404b'; c.fillRect(W * .26, y + 6, W * .56, 14); c.fillStyle = done >= 1 ? GREEN_LED : '#5fb3c9'; c.fillRect(W * .26, y + 6, W * .56 * done, 14);
            text(c, done >= 1 ? 'READY' : `${Math.round(done * 100)}%`, W * .85, y + 18, 14, done >= 1 ? '#a8e6bf' : '#bcd8d6');
        }
    } else if (variant === 'terminal') {
        c.fillStyle = '#0a1418'; c.fillRect(8, top, W - 16, bottom - top - 4);
        const lines = ['$ show interfaces status', 'Gi1/0/1   connected   1G  full', 'Gi1/0/2   connected   1G  full', 'Gi1/0/3   notconnect', 'Te1/1/1   connected  10G  uplink', '$ show env power', 'PSU-A  ok   PSU-B  ok', i === 2 ? '$ test cable Gi1/0/3  ... pair B open' : '$ checklist 6/8 complete'];
        lines.forEach((s, n) => text(c, s, 20, top + 24 + n * ((bottom - top - 20) / lines.length), Math.max(12, H / 26), n === lines.length - 1 && i === 2 ? '#f5d29a' : '#7cf2a8', { weight: '400', font: 'monospace' }));
    } else if (variant === 'bench') {
        // Board view: a generic PCB outline with highlighted test points.
        c.fillStyle = '#1b4a3a'; c.fillRect(W * .08, top + 14, W * .6, bottom - top - 28);
        for (let n = 0; n < 14; n++) { c.fillStyle = n % 3 ? '#2d2f33' : '#c9b46a'; c.fillRect(W * (.12 + rnd(n) * .48), top + 26 + rnd(n + 30) * (bottom - top - 70), 22 + rnd(n + 3) * 40, 14 + rnd(n + 9) * 26); }
        dot(c, W * .4, top + (bottom - top) * .5, 9, AMBER_LED);
        text(c, 'TP4  3.29 V', W * .72, top + 40, 16, '#cae5e7', { font: 'monospace', weight: '400' }); text(c, 'TP7  1.80 V', W * .72, top + 66, 16, '#cae5e7', { font: 'monospace', weight: '400' }); text(c, 'TP9  0.02 V', W * .72, top + 92, 16, '#f5d29a', { font: 'monospace', weight: '400' });
    } else if (variant === 'intake') {
        text(c, 'SCAN DEVICE TAG', 18, top + 30, 18, '#cae5e7');
        for (let n = 0; n < 34; n++) { c.fillStyle = '#e6eef2'; c.fillRect(20 + n * 9, top + 44, n % 3 ? 3 : 6, 46); }
        ['LT-1061  laptop   return   ok', 'LT-1062  laptop   repair   screen', 'TB-0207  tablet   return   ok', 'DK-0311  dock     spare'].forEach((s, n) => text(c, s, 20, top + 120 + n * 24, 14, n === 1 ? '#f5d29a' : '#bcd8d6', { font: 'monospace', weight: '400' }));
    } else if (variant === 'checklist') {
        ['Rack 01 · power and fans', 'Rack 02 · uplinks', 'Backup job', 'Imaging queue', 'Carts for SITE 03', 'Spares count'].forEach((s, n) => {
            const done = n < [2, 4, 5, 6, 6][i]; c.strokeStyle = '#7ec4ba'; c.lineWidth = 2; c.strokeRect(20, top + 16 + n * 34, 16, 16);
            if (done) { c.strokeStyle = GREEN_LED; c.beginPath(); c.moveTo(23, top + 24 + n * 34); c.lineTo(28, top + 30 + n * 34); c.lineTo(35, top + 18 + n * 34); c.stroke(); }
            text(c, s, 48, top + 30 + n * 34, 16, done ? '#8fb1ad' : '#d6ecea', { weight: '400' });
        });
    } else {
        // Diagnostics: health tiles.
        ['CPU', 'MEMORY', 'STORAGE', 'BATTERY', 'NETWORK', 'DISPLAY'].forEach((s, n) => {
            const x = 18 + (n % 3) * (W - 30) / 3, y = top + 14 + Math.floor(n / 3) * (bottom - top - 20) / 2, w = (W - 60) / 3, h = (bottom - top - 40) / 2;
            c.fillStyle = '#16303a'; c.fillRect(x, y, w, h); text(c, s, x + 10, y + 24, 14, '#9fc0cf');
            const bad = n === 3; text(c, bad ? '62%' : 'PASS', x + 10, y + h - 14, h * .32, bad ? '#f5d29a' : '#a8e6bf');
        });
    }
    reset(c);
    c.fillStyle = '#18323c'; c.fillRect(0, H - 38, W, 38);
    text(c, LABELS[i].toUpperCase(), 22, H - 14, 16, '#b8d9d3', { max: W - 145 }); text(c, 'CONCEPT', W - 90, H - 14, 12, '#91aaa9', { font: 'monospace', weight: '400' });
}
// Shell monitor variants (kit.monitor): 0 topology, 2 diagnostics, 3 queue.
export function drawScreen(c, W, H, spec, variant = 0, phase = 'morning') {
    paintScreen(c, W, H, ({ 0: 'topology', 1: 'imaging', 2: 'diag', 3: 'queue', 4: 'terminal' })[variant] || 'topology', phase);
}
// Planning board: ticket kanban (left) and the deployment schedule (right).
// `variant` is the daypart index; at the team deployment every site is READY.
export function drawBoard(c, CW, CH, spec, variant = 0) {
    // Laid out on a 768 px wide grid and scaled to the canvas (the room swaps
    // in a 2× canvas for crisp type; the shell's footer strip stays 42 px).
    const sc = CW / 768, W = 768, H = CH / sc;
    c.save(); c.scale(sc, sc); drawBoardGrid(c, W, H, spec, variant); c.restore();
}
function drawBoardGrid(c, W, H, spec, variant) {
    const i = variant;
    reset(c); c.fillStyle = '#f2f4f2'; c.fillRect(0, 0, W, H);
    text(c, spec.boardTitle || 'TICKETS & DEPLOYMENTS', 26, 46, 28, '#21455f');
    c.fillStyle = BLUE; c.fillRect(26, 58, 160, 4);
    const kanbanW = W * .52, cols = ['NEW', 'IN REPAIR', 'IMAGING', 'READY'], cw = (kanbanW - 40) / 4;
    const counts = [[3, 2, 3, 1], [4, 3, 2, 2], [1, 2, 1, 4], [0, 1, 3, 4], [0, 0, 1, 6]][i] || [2, 2, 2, 2];
    cols.forEach((h, n) => {
        const x = 26 + n * cw; c.fillStyle = '#dfe6ea'; c.fillRect(x, 78, cw - 10, H - 130);
        text(c, h, x + 8, 100, 15, '#33515f');
        for (let k = 0; k < counts[n]; k++) {
            const y = 112 + k * 46; if (y > H - 100) break;
            c.fillStyle = ['#f6d76b', '#f4b6a0', '#bfe0f2', '#c7e6c4'][n]; c.fillRect(x + 6, y, cw - 22, 38);
            c.fillStyle = '#51636a'; c.fillRect(x + 12, y + 9, (cw - 40) * (.5 + rnd(k + n * 9) * .4), 4); c.fillRect(x + 12, y + 21, (cw - 40) * .4, 4);
        }
    });
    const x0 = kanbanW + 20, tw = W - x0 - 26;
    text(c, 'DEPLOYMENT SCHEDULE', x0, 100, 17, '#21455f');
    ['SITE', 'DEVICES', 'STATUS'].forEach((h, n) => text(c, h, x0 + [0, .38, .62][n] * tw, 128, 13, '#6a7f88'));
    const states = [['READY', 'STAGING', 'IMAGING', 'PLANNED', 'PLANNED', 'PLANNED'], ['READY', 'READY', 'STAGING', 'IMAGING', 'PLANNED', 'PLANNED'], ['DONE', 'READY', 'READY', 'STAGING', 'IMAGING', 'PLANNED'], ['DONE', 'READY', 'READY', 'READY', 'IMAGING', 'PLANNED'], ['READY', 'READY', 'READY', 'READY', 'READY', 'READY']][i] || [];
    const chip = { READY: '#4f9a6a', STAGING: '#d59a3a', IMAGING: BLUE, PLANNED: '#9aa7ae', DONE: '#5d6b72' };
    SITES.forEach((s, n) => {
        const y = 140 + n * ((H - 200) / 6);
        c.fillStyle = n % 2 ? '#e9eef0' : '#f7f9f9'; c.fillRect(x0 - 6, y, tw + 12, (H - 200) / 6 - 4);
        text(c, s, x0, y + 24, 15, '#2c4450'); text(c, String([12, 8, 16, 6, 10, 14][n]), x0 + .38 * tw, y + 24, 15, '#2c4450', { weight: '400' });
        c.fillStyle = chip[states[n]]; rrect(c, x0 + .62 * tw, y + 7, tw * .34, 24, 12); c.fill(); text(c, states[n], x0 + .79 * tw, y + 24, 13, '#ffffff', { align: 'center' });
    });
}
// Back-wall network topology mural (print on the wall).
function drawMural(c, W, H) {
    c.fillStyle = '#eef2f4'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#d6dee3'; c.lineWidth = 1; for (let x = 0; x < W; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    text(c, 'OUR NETWORK', 30, 52, 34, '#21455f'); text(c, 'one core · two distribution blocks · six sites', 32, 82, 18, '#5f7a88', { weight: '400' });
    topology(c, 30, 70, W - 60, H - 90, { dark: false, scale: W / 1100 });
}
// Rack elevation poster: a 42U column per rack with coloured equipment blocks.
function drawElevation(c, W, H) {
    c.fillStyle = '#f4f5f3'; c.fillRect(0, 0, W, H);
    text(c, 'RACK ELEVATION', 18, 38, 24, '#21455f'); text(c, 'R01 · R02', 18, 62, 16, '#6a7f88', { weight: '400' });
    const legend = [['#5d8fb3', 'SERVER'], ['#e0b45e', 'SWITCH'], ['#6aa56a', 'PATCH'], ['#b07a6a', 'UPS'], ['#c9d0d4', 'BLANK']];
    for (let r = 0; r < 2; r++) {
        const x = 26 + r * (W - 40) / 2, w = (W - 80) / 2, y0 = 82, uh = (H - 170) / 42;
        c.strokeStyle = '#33464f'; c.lineWidth = 3; c.strokeRect(x, y0, w, uh * 42);
        let u = 0; const plan = [[2, 2], [1, 1], [1, 2], [2, 0], [2, 0], [2, 0], [4, 4], [1, 1], [2, 0], [6, 4], [3, 3]];
        for (const [n, k] of plan) { if (u + n > 42) break; c.fillStyle = legend[(k + r) % 5][0]; c.fillRect(x + 4, y0 + (42 - u - n) * uh + 1, w - 8, n * uh - 2); u += n; }
        for (let n = 0; n <= 42; n += 6) text(c, String(n || 1), x - 22, y0 + (42 - n) * uh + 4, 10, '#6a7f88', { weight: '400' });
    }
    legend.forEach(([col, s], n) => { c.fillStyle = col; c.fillRect(20 + (n % 3) * (W / 3), H - 70 + Math.floor(n / 3) * 28, 18, 18); text(c, s, 44 + (n % 3) * (W / 3), H - 56 + Math.floor(n / 3) * 28, 13, '#33464f', { weight: '400' }); });
}
// Sign face: centred lines [text, size (× H), y (× H), colour, weight]; capitals
// get a little tracking. `rule` draws a thin accent rule under the first line.
function signText(lines, bg = BLUE, fg = '#e8f1f7', { rule = null, edge = null } = {}) {
    return (c, W, H) => {
        reset(c); c.clearRect(0, 0, W, H); c.fillStyle = bg; c.fillRect(0, 0, W, H); c.textBaseline = 'middle';
        if (edge) { c.strokeStyle = edge; c.lineWidth = Math.max(2, H * .03); c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth); }
        lines.forEach(([s, size, y, color, weight = '700']) => text(c, s, W / 2, H * y, H * size, color || fg, { align: 'center', max: W * .92, weight, spacing: s === s.toUpperCase() ? H * size * .06 : 0 }));
        if (rule && lines[0]) { c.fillStyle = rule; c.fillRect(W * .38, H * (lines[0][2] + lines[0][1] * .62), W * .24, Math.max(2, H * .025)); }
        reset(c);
    };
}
// Floor stencils.
// Anti-fatigue mat: closed-cell rubber with raised bubbles and a bevelled edge.
function drawMat(c, W, H) {
    c.fillStyle = '#2b3237'; c.fillRect(0, 0, W, H);
    for (let y = 5; y < H; y += 10) for (let x = 5 + (y / 10 % 2) * 5; x < W; x += 10) { dot(c, x, y, 3, '#353d43'); dot(c, x - .9, y - .9, 1.3, '#48525a'); }
    c.strokeStyle = '#20262a'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); c.strokeStyle = YELLOW; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4);
}
// Dissipative floor mat under the main desk: matte grey-blue rubber, fine
// grain, bevelled border, a ground snap with its cord and an ESD mark.
function drawDeskZone(c, W, H) {
    c.fillStyle = '#3b4850'; c.fillRect(0, 0, W, H);
    for (let n = 0; n < 5200; n++) { c.fillStyle = n % 3 ? '#46545d40' : '#2a333840'; c.fillRect(rnd(n) * W, rnd(n + 5200) * H, 1.5, 1.5); }
    c.strokeStyle = '#2e393f'; c.lineWidth = 16; c.strokeRect(8, 8, W - 16, H - 16); c.strokeStyle = '#6a8ba3'; c.lineWidth = 3; c.strokeRect(20, 20, W - 40, H - 40);
    dot(c, 40, H - 40, 9, '#c3c9cd'); dot(c, 40, H - 40, 4, '#7d878d'); c.strokeStyle = '#2f8a57'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, H - 40); c.bezierCurveTo(20, H - 20, 10, H - 8, 0, H - 4); c.stroke();
    c.fillStyle = '#6a8ba3'; c.fillRect(W - 130, H - 58, 100, 30); text(c, 'ESD', W - 80, H - 36, 20, '#eef4f7', { align: 'center', weight: '700', spacing: 3 });
}
function drawBriefZone(c, W, H) {
    c.fillStyle = '#41566a'; c.fillRect(0, 0, W, H);
    const t = W / 8; for (let r = 0; r * t < H; r++) for (let q = 0; q < 8; q++) { c.fillStyle = (r + q) % 2 ? '#3d5265' : '#455b6f'; c.fillRect(q * t, r * t, t, t); c.strokeStyle = '#ffffff10'; for (let n = 0; n < 10; n++) { c.beginPath(); const o = n * t / 10; if ((r + q) % 2) { c.moveTo(q * t + o, r * t); c.lineTo(q * t + o, r * t + t); } else { c.moveTo(q * t, r * t + o); c.lineTo(q * t + t, r * t + o); } c.stroke(); } }
    c.strokeStyle = '#8fb3cf'; c.lineWidth = Math.max(6, W * .012); c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth);
}
const U = 44.45;
// ---- Finishes: procedural maps and material classes ----------------------
// Batched detail is split by material class (`ck()`, as in the Government
// module): powder-coated steel, polished chrome wire, brushed / galvanised
// metal, anodised aluminium, HPL, rubber, corrugated card, polypropylene,
// perforated vent steel, shielding foil, wound cable, PVC cable jacket,
// printed labels and the rack equipment fronts. Each class merges into one
// mesh per furnishing. Class maps are near white, so vertex colours still set
// the hue; UVs are box-projected in millimetres (`uvBox`), so one material
// covers a 2 m rack and a 20 mm latch without stretching. Labels and fronts
// are atlases mapped per plane.
function tex(draw, W, H, srgb = true) {
    const map = institutionalMap(draw, W, H); if (!srgb) map.colorSpace = THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; return map;
}
const grey = (v, a = 1) => { const g = Math.max(0, Math.min(255, Math.round(v))); return a < 1 ? `rgba(${g},${g},${g},${a})` : `rgb(${g},${g},${g})`; };
// Box-projected UVs (mm / period): top faces u = x, v = -z; x faces u = z, v = y; z faces u = x, v = y.
function uvBox(geometry, pu, pv = pu) {
    const pos = geometry.attributes.position, nor = geometry.attributes.normal; if (!pos || !nor) return geometry;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
        const [u, v] = ay >= ax && ay >= az ? [x, -z] : ax >= az ? [z, y] : [x, y];
        uv[i * 2] = u / pu; uv[i * 2 + 1] = v / pv;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}
function flecks(c, W, H, { count, colors, size = [.6, 1.6], seed = 1, round = true }) {
    for (let n = 0; n < count; n++) {
        const x = rnd(n * 1.31 + seed) * W, y = rnd(n * 2.17 + seed * 3) * H, r = size[0] + rnd(n * .71 + seed * 5) * (size[1] - size[0]);
        c.fillStyle = colors[n % colors.length];
        if (round) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } else c.fillRect(x, y, r * 2, r * .8);
    }
}
// Orange-peel powder coat (colour and roughness).
const drawPowder = (c, W, H) => { c.fillStyle = grey(240); c.fillRect(0, 0, W, H); flecks(c, W, H, { count: W * H / 9, colors: [grey(252, .4), grey(228, .35), grey(236, .4)], size: [.7, 2.1], seed: 2 }); };
const drawPowderRough = (c, W, H) => { c.fillStyle = grey(196); c.fillRect(0, 0, W, H); flecks(c, W, H, { count: W * H / 10, colors: [grey(160, .5), grey(225, .5)], size: [.6, 1.8], seed: 4 }); };
// HPL: fine two-tone speckle, satin.
const drawHPL = (c, W, H) => { c.fillStyle = grey(244); c.fillRect(0, 0, W, H); flecks(c, W, H, { count: W * H / 20, colors: ['#0000000a', '#ffffff50', '#6b7a800c'], size: [.6, 1.6], seed: 7 }); };
const drawHPLRough = (c, W, H) => { c.fillStyle = grey(200); c.fillRect(0, 0, W, H); flecks(c, W, H, { count: W * H / 24, colors: [grey(190, .4), grey(212, .4)], size: [.6, 1.6], seed: 9 }); };
// Brushed / galvanised metal: long horizontal grain.
const drawBrushed = (c, W, H) => { c.fillStyle = grey(232); c.fillRect(0, 0, W, H); for (let n = 0; n < H * 3; n++) { c.fillStyle = n % 2 ? grey(255, .22 + rnd(n) * .2) : grey(200, .12 + rnd(n + 3) * .16); c.fillRect(rnd(n * 3.1) * W - W * .5, rnd(n * 1.7) * H, W * (.3 + rnd(n * 5.3) * .9), 1); } };
// Rubber: shallow diamond grip.
const drawRubber = (c, W, H) => { c.fillStyle = grey(236); c.fillRect(0, 0, W, H); c.strokeStyle = grey(200, .7); c.lineWidth = 2; for (let n = -W; n < W * 2; n += 16) { c.beginPath(); c.moveTo(n, 0); c.lineTo(n + H, H); c.stroke(); c.beginPath(); c.moveTo(n, H); c.lineTo(n + H, 0); c.stroke(); } flecks(c, W, H, { count: 400, colors: [grey(255, .25)], seed: 3 }); };
// Corrugated card: fibre streaks, flecks and faint flute shadows.
const drawCard = (c, W, H) => { c.fillStyle = grey(236); c.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 8) { c.fillStyle = grey(222, .45); c.fillRect(0, y, W, 2); } for (let n = 0; n < 900; n++) { c.fillStyle = n % 3 ? grey(205, .35) : grey(255, .4); c.fillRect(rnd(n) * W, rnd(n + 9) * H, 4 + rnd(n + 3) * 18, 1); } flecks(c, W, H, { count: 260, colors: ['#5a3a1a30'], size: [.6, 1.4], seed: 6 }); };
// Polypropylene bins: soft mottling.
const drawPoly = (c, W, H) => { c.fillStyle = grey(244); c.fillRect(0, 0, W, H); flecks(c, W, H, { count: 700, colors: [grey(255, .35), grey(226, .3)], size: [2, 7], seed: 11 }); };
// Perforated steel (lockers, vents): 3 mm holes in a staggered grid.
const drawVent = (c, W, H) => { c.fillStyle = grey(236); c.fillRect(0, 0, W, H); for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { c.fillStyle = grey(38); c.beginPath(); c.arc((q + (r % 2) * .5 + .25) * W / 4, (r + .5) * H / 4, W * .085, 0, TAU); c.fill(); } };
// Static-shielding foil: crinkle highlights.
const drawFoil = (c, W, H) => { c.fillStyle = grey(214); c.fillRect(0, 0, W, H); for (let n = 0; n < 160; n++) { const x = rnd(n) * W, y = rnd(n + 40) * H, a = rnd(n + 80) * TAU, l = 8 + rnd(n + 9) * 30; c.strokeStyle = n % 2 ? grey(255, .6) : grey(150, .4); c.lineWidth = 1 + rnd(n) * 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } };
// Wound cable on a spool (stripes along the cylinder's v).
const drawCoil = (c, W, H) => { for (let y = 0; y < H; y += 4) { c.fillStyle = grey(y % 8 ? 248 : 196); c.fillRect(0, y, W, 4); } };
// Wainscot: 1.5 mm perforation on a 12 mm pitch (48 mm repeat).
const drawWainscot = (c, W, H) => { c.fillStyle = '#a3afb7'; c.fillRect(0, 0, W, H); flecks(c, W, H, { count: 120, colors: ['#adb9c080', '#9aa6ae80'], size: [1, 3], seed: 5 }); for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { c.fillStyle = '#2f383e'; c.beginPath(); c.arc((q + .5) * W / 4, (r + .5) * H / 4, W * .034, 0, TAU); c.fill(); } };
// Rack wall: dark acoustic cladding, 600 × 1200 modules with shadow reveals.
const drawRackWall = (c, W, H) => {
    c.fillStyle = '#26323b'; c.fillRect(0, 0, W, H);
    flecks(c, W, H, { count: 5000, colors: ['#2c3943', '#202a32', '#2a363f'], size: [.6, 1.6], seed: 8 });
    for (let x = 0; x < W; x += W / 2) { c.fillStyle = '#141b20'; c.fillRect(x, 0, 3, H); c.fillStyle = '#36444e'; c.fillRect(x + 3, 0, 1, H); }
    c.fillStyle = '#141b20'; c.fillRect(0, 0, W, 3); c.fillStyle = '#36444e'; c.fillRect(0, 3, W, 1);
};
// Hex-perforated rack door steel (alpha holes, about 65 % open).
const drawHexMesh = (c, W, H) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'destination-out';
    const r = W / 4 * .5, dx = W / 2, dy = H / 2;
    for (let row = -1; row <= 2; row++) for (let col = -1; col <= 2; col++) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
        c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.lineTo(cx + Math.cos(a) * r * 1.78, cy + Math.sin(a) * r * 1.78); } c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
};

// Printed label atlas: 8 × 16 cells of 256 × 128 px. Generic content only.
const BIN_NAMES = ['SSD 512', 'SSD 1TB', 'RAM 16G', 'RAM 8G', 'USB-C', 'HDMI', 'PSU 65W', 'PSU 90W', 'CAT6 1m', 'CAT6 3m', 'SFP+', 'KEYS', 'MICE', 'BATT', 'SCREWS', 'TAGS'];
const PRINT_LABELS = [
    ...BIN_NAMES.map(s => [s, 'bin']),
    ...['R01', 'R02', 'R03', 'R04'].map(s => [s, 'rack']),
    ...Array.from({ length: 16 }, (_, n) => [String(n + 1).padStart(2, '0'), 'slot']),
    ...['IT-04127', 'IT-04133', 'IT-04150', 'IT-04162', 'IT-04178', 'IT-04185'].map(s => [s, 'tag']),
    ['FRAGILE', 'box'], ['RETURNS', 'box'], ['SPARES', 'box'], ['SITE 03', 'box'], ['SITE 05', 'box'], ['IMAGED', 'box'],
    ['ESD', 'warn'], ['A-FEED', 'feed'], ['B-FEED', 'feed'], ['DATA', 'outlet'], ['POWER', 'outlet'], ['LOAN', 'slot2'], ['REPAIR', 'slot2'], ['READY', 'ready'],
    ['E-WASTE', 'ewaste'], ['BATTERIES', 'ewaste'], ['CABLES', 'ewaste'], ['CAGE 01', 'rack'], ['SHELF A', 'rack'], ['QR', 'qr']
];
const labelCell = name => PRINT_LABELS.findIndex(l => l[0] === name);
const ASSET_TAGS = PRINT_LABELS.filter(l => l[1] === 'tag').map(l => l[0]);
function barcode(c, x, y, w, h, seed, color = '#1d252b') { let px = x; for (let b = 0; px < x + w; b++) { const bw = 1 + Math.floor(rnd(seed + b * 1.7) * 3.2); if (b % 2 === 0) { c.fillStyle = color; c.fillRect(px, y, bw, h); } px += bw + (b % 2 ? 0 : 0); } }
function drawLabelAtlas(c, W, H) {
    const cw = W / 8, ch = H / 16;
    c.fillStyle = '#f4f4ef'; c.fillRect(0, 0, W, H);
    PRINT_LABELS.forEach(([s, style], n) => {
        const x = (n % 8) * cw, y = Math.floor(n / 8) * ch;
        c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, cw, ch); c.clip(); reset(c); c.textBaseline = 'middle';
        if (style === 'bin') {
            c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#e1e4e1'; c.fillRect(0, ch - 8, cw, 8);
            text(c, s, cw / 2, ch * .36, 40, '#1d2a32', { align: 'center', weight: '700', max: cw - 20, spacing: 1 }); barcode(c, 30, ch * .62, cw - 60, 26, n * 13);
        } else if (style === 'rack') {
            c.fillStyle = '#e9ece9'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#1d2a32'; c.fillRect(8, 8, cw - 16, ch - 16);
            text(c, s, cw / 2, ch / 2 + 2, 62, '#f2f4f2', { align: 'center', weight: '700', spacing: 4 });
        } else if (style === 'slot' || style === 'slot2') {
            c.fillStyle = '#f6f6f1'; c.fillRect(0, 0, cw, ch); c.fillStyle = style === 'slot2' ? '#467eaa' : '#1d2a32'; c.fillRect(0, 0, 18, ch);
            text(c, s, cw / 2 + 9, ch / 2 + 2, style === 'slot2' ? 50 : 74, '#1d2a32', { align: 'center', weight: '700', spacing: 2 });
        } else if (style === 'tag') {
            c.fillStyle = '#e9edef'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#467eaa'; c.fillRect(0, 0, cw, 30);
            text(c, 'ASSET', 14, 16, 20, '#ffffff', { weight: '700', spacing: 3 }); text(c, 'IT DEPOT', cw - 14, 16, 16, '#d7e6f0', { align: 'right', weight: '600', spacing: 1 });
            text(c, s, 14, 54, 28, '#1d2a32', { weight: '700', font: 'monospace' }); barcode(c, 14, 76, cw - 28, 40, n * 7);
        } else if (style === 'box') {
            c.fillStyle = '#f3efe4'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#1d2a32'; c.lineWidth = 3; c.strokeRect(6, 6, cw - 12, ch - 12);
            text(c, s, cw / 2, ch * .38, 34, s === 'FRAGILE' ? '#b3352b' : '#1d2a32', { align: 'center', weight: '700', spacing: 2, max: cw - 30 }); barcode(c, 40, ch * .62, cw - 80, 30, n * 5);
        } else if (style === 'warn') {
            c.fillStyle = '#f2c230'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#1d2328'; c.beginPath(); c.moveTo(20, ch - 18); c.lineTo(70, 18); c.lineTo(120, ch - 18); c.closePath(); c.fill();
            c.fillStyle = '#f2c230'; c.beginPath(); c.moveTo(36, ch - 28); c.lineTo(70, 36); c.lineTo(104, ch - 28); c.closePath(); c.fill();
            c.strokeStyle = '#1d2328'; c.lineWidth = 6; c.beginPath(); c.moveTo(56, ch - 40); c.lineTo(84, 60); c.stroke();
            text(c, 'ESD AREA', 186, ch / 2 + 2, 30, '#1d2328', { align: 'center', weight: '700', max: 120 });
        } else if (style === 'feed') {
            c.fillStyle = s[0] === 'A' ? '#c23a2e' : '#2f6fa6'; c.fillRect(0, 0, cw, ch); text(c, s, cw / 2, ch / 2 + 2, 46, '#ffffff', { align: 'center', weight: '700', spacing: 3 });
        } else if (style === 'outlet') {
            c.fillStyle = '#eceeec'; c.fillRect(0, 0, cw, ch); text(c, s, cw / 2, ch / 2 + 2, 40, s === 'DATA' ? '#2f6fa6' : '#b3352b', { align: 'center', weight: '700', spacing: 4 });
        } else if (style === 'ready') {
            c.fillStyle = '#4f9a6a'; c.fillRect(0, 0, cw, ch); text(c, s, cw / 2, ch / 2 + 2, 52, '#ffffff', { align: 'center', weight: '700', spacing: 5 });
        } else if (style === 'ewaste') {
            c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#1d2a32'; c.lineWidth = 4;
            // Generic pictogram: crossed-out bin for e-waste, a cell for batteries, a loop for cables.
            if (s === 'E-WASTE') { c.strokeRect(22, 34, 44, 62); c.beginPath(); c.moveTo(16, 30); c.lineTo(72, 30); c.moveTo(12, 24); c.lineTo(76, 104); c.stroke(); }
            else if (s === 'BATTERIES') { c.strokeRect(20, 40, 56, 50); c.fillStyle = '#1d2a32'; c.fillRect(36, 32, 24, 8); c.fillRect(34, 52, 28, 5); c.fillRect(45, 41, 6, 26); }
            else { c.beginPath(); c.arc(46, 64, 26, 0, TAU); c.stroke(); c.beginPath(); c.arc(46, 64, 14, 0, TAU); c.stroke(); }
            text(c, s, 160, ch / 2 + 2, 32, '#1d2a32', { align: 'center', weight: '700', max: 150 });
        } else if (style === 'qr') {
            c.fillStyle = '#ffffff'; c.fillRect(0, 0, cw, ch); for (let q = 0; q < 21; q++) for (let r = 0; r < 21; r++) if (rnd(q * 31 + r) > .5) { c.fillStyle = '#1d2a32'; c.fillRect(70 + q * 5.6, 5 + r * 5.6, 5.6, 5.6); }
            for (const [qx, qy] of [[70, 5], [70 + 14 * 5.6, 5], [70, 5 + 14 * 5.6]]) { c.fillStyle = '#1d2a32'; c.fillRect(qx, qy, 39, 39); c.fillStyle = '#fff'; c.fillRect(qx + 6, qy + 6, 27, 27); c.fillStyle = '#1d2a32'; c.fillRect(qx + 11, qy + 11, 17, 17); }
        }
        c.restore();
    });
}
// A plane mapped to a pixel rectangle [x, y, w, h] of an atlas (W × H).
function atlasPlane(w, h, [px, py, pw, ph], W, H) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (px + .5 + uv.getX(i) * (pw - 1)) / W, 1 - (py + .5 + (1 - uv.getY(i)) * (ph - 1)) / H);
    return g;
}
const LABEL_W = 2048, LABEL_H = 2048;
const labelRect = n => [(n % 8) * 256, Math.floor(n / 8) * 128, 256, 128];
// Printed label plate facing +z (before rot); unknown names give a blank plate.
function tag(K, name, [w, h], at, rot = [0, 0, 0]) {
    const n = labelCell(name);
    if (n < 0) K.box([w, h, 1], at, '#ecefec', rot); else K.print.add(atlasPlane(w, h, labelRect(n), LABEL_W, LABEL_H), at, '#ffffff', [1, 1, 1], rot);
    return K;
}

// Rack equipment fronts (atlas, 2 px / mm, 482.6 mm wide 19-inch faces).
// Each kind draws its face in millimetres and lists its LEDs in the same frame
// (origin top-left), so the LED field sits exactly on the drawn indicators.
const FRONT_PX = 2, FRONT_W = 1024, FRONT_H = 2048;
const FRONT_KINDS = [['srv', 2], ['stor', 3], ['stor', 4], ['ups', 2], ['sw', 1], ['patch', 1], ['kvm', 1], ['blank', 1], ['srv1', 1]];
const FRONT_CELLS = (() => { let y = 4; const cells = {}; for (const [kind, u] of FRONT_KINDS) { const h = Math.round((u * U - 2) * FRONT_PX); cells[kind + u] = [20, y, Math.round(482 * FRONT_PX), h]; y += h + 10; } return cells; })();
const portX = j => 40.5 + j * 17.5;   // patch-panel jack centres (mm from the left)
function frontLeds(kind, units, seed) {
    const h = units * U - 2, out = [], st = (s, d = 0) => rnd(seed * 3.7 + s + d) > .93 ? AMBER_LED : GREEN_LED;
    if (kind === 'srv') { for (let b = 0; b < 12; b++) out.push([70 + b * 24.5, 12, st(b), 4, 4]); out.push([40, 22, BLUE_LED, 7, 7], [40, 40, GREEN_LED, 4, 4]); }
    if (kind === 'srv1') { for (let b = 0; b < 8; b++) out.push([72 + b * 34, 8, st(b), 4, 3]); out.push([40, 21, BLUE_LED, 6, 6]); }
    if (kind === 'stor') { const rows = units; for (let r = 0; r < rows; r++) for (let q = 0; q < 4; q++) out.push([24 + q * 111 + 96, 8 + r * ((h - 6) / rows), st(r * 4 + q), 4, 4]); }
    if (kind === 'ups') out.push([350, h * .38, BLUE_LED, 88, 22], [430, h * .3, GREEN_LED, 6, 6], [430, h * .5, GREEN_LED, 6, 6]);
    if (kind === 'sw') { for (let j = 0; j < 24; j++) { const x = 44 + j * 13.5 + Math.floor(j / 6) * 4; out.push([x + 2, 19.5, st(j, 1), 3.5, 2.6], [x + 8, 19.5, st(j, 2), 3.5, 2.6]); } for (let s = 0; s < 4; s++) out.push([418 + (s % 2) * 18, 17.5 + Math.floor(s / 2) * 7, GREEN_LED, 3, 2]); out.push([26, 12, GREEN_LED, 3, 3], [26, 21, BLUE_LED, 3, 3]); }
    if (kind === 'kvm') { for (let p = 0; p < 8; p++) out.push([160 + p * 26, 12, p === 1 ? BLUE_LED : GREEN_LED, 4, 3]); }
    return out;
}
function drawFront(c, kind, units) {
    const h = units * U - 2, W = 482;
    const ears = (col) => { for (const ex of [0, W - 16]) { c.fillStyle = col; c.fillRect(ex, 0, 16, h); for (let u = 0; u < units; u++) { c.fillStyle = '#0c1012'; c.beginPath(); c.arc(ex + 8, u * U + U / 2, 3.2, 0, TAU); c.fill(); c.fillStyle = '#7d878d'; c.beginPath(); c.arc(ex + 8, u * U + U / 2, 2.4, 0, TAU); c.fill(); c.fillStyle = '#4c555b'; c.fillRect(ex + 6.6, u * U + U / 2 - .5, 2.8, 1); } } };
    const bevel = (x, y, w, hh, base, hi = '#ffffff22', lo = '#00000055') => { c.fillStyle = base; c.fillRect(x, y, w, hh); c.fillStyle = hi; c.fillRect(x, y, w, .8); c.fillRect(x, y, .8, hh); c.fillStyle = lo; c.fillRect(x, y + hh - .8, w, .8); c.fillRect(x + w - .8, y, .8, hh); };
    const hexes = (x, y, w, hh, r = 2.2, col = '#0b0f11') => { c.save(); c.beginPath(); c.rect(x, y, w, hh); c.clip(); c.fillStyle = col; for (let yy = y, row = 0; yy < y + hh + r; yy += r * 1.75, row++) for (let xx = x + (row % 2) * r, n = 0; xx < x + w + r; xx += r * 2.1, n++) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.lineTo(xx + Math.cos(a) * r * .78, yy + Math.sin(a) * r * .78); } c.fill(); } c.restore(); };
    const g = c.createLinearGradient(0, 0, 0, h);
    reset(c);
    if (kind === 'srv' || kind === 'srv1') {
        g.addColorStop(0, '#4f5a62'); g.addColorStop(1, '#3a434a'); c.fillStyle = g; c.fillRect(0, 0, W, h); ears('#2b3339');
        // Control panel: power, ID, two USB ports, service tag pull-tab.
        bevel(20, 4, 38, h - 8, '#2a3237'); c.fillStyle = '#0d1114'; for (let u = 0; u < 2; u++) c.fillRect(27 + u * 14, h - 18, 9, 5);
        c.strokeStyle = '#8a959b'; c.lineWidth = 1; c.beginPath(); c.arc(40, kind === 'srv' ? 22 : 21, 5, 0, TAU); c.stroke();
        c.fillStyle = '#d9dedf'; c.fillRect(22, h * .5, 6, h * .3);
        const bays = kind === 'srv' ? 12 : 8, pitch = kind === 'srv' ? 24.5 : 34, bw = kind === 'srv' ? 22 : 31, top = 4, bh = h - 8;
        for (let b = 0; b < bays; b++) {
            const x = (kind === 'srv' ? 64 : 64) + b * pitch;
            bevel(x, top, bw, bh, '#66717a', '#ffffff40', '#00000070'); hexes(x + 2, top + 14, bw - 4, bh * .42, 1.6, '#20272b');
            c.fillStyle = '#2c3439'; c.fillRect(x + 2, top + bh - 16, bw - 4, 13); c.fillStyle = '#3c7fc4'; c.fillRect(x + 3, top + bh - 14, 5, 9);
            c.fillStyle = '#0c1012'; c.fillRect(x + 4, top + 5, 6, 6);
        }
        const vx = 64 + bays * pitch + 4; bevel(vx, 4, W - 22 - vx, h - 8, '#3a444b'); hexes(vx + 3, 7, W - 28 - vx, h - 14, 2.4);
        c.fillStyle = '#dfe4e5'; c.fillRect(vx + 8, h - 13, 40, 7); c.fillStyle = '#5a646a'; c.fillRect(vx + 11, h - 11, 30, 3);
    } else if (kind === 'stor') {
        g.addColorStop(0, '#3c464d'); g.addColorStop(1, '#2d353a'); c.fillStyle = g; c.fillRect(0, 0, W, h); ears('#262d32');
        const rows = units, rh = (h - 6) / rows;
        for (let r = 0; r < rows; r++) for (let q = 0; q < 4; q++) {
            const x = 24 + q * 111, y = 3 + r * rh;
            bevel(x, y, 106, rh - 3, '#5f6a72', '#ffffff40', '#00000070'); c.fillStyle = '#262d32'; c.fillRect(x + 2, y + 2, 26, rh - 7);
            for (let l = 0; l < 4; l++) { c.fillStyle = '#3a444b'; c.fillRect(x + 6, y + 5 + l * (rh - 12) / 4, 18, 1.4); }
            hexes(x + 32, y + 4, 56, rh - 11, 1.8); c.fillStyle = '#0c1012'; c.fillRect(x + 94, y + 5, 7, 7);
            c.fillStyle = '#e6e9e8'; c.fillRect(x + 32, y + rh - 9, 22, 3.5);
        }
    } else if (kind === 'ups') {
        g.addColorStop(0, '#323b41'); g.addColorStop(1, '#262d32'); c.fillStyle = g; c.fillRect(0, 0, W, h); ears('#20272b');
        for (let y = 8; y < h - 6; y += 5.5) { c.fillStyle = '#12171a'; c.fillRect(24, y, 270, 2.6); c.fillStyle = '#4a545b55'; c.fillRect(24, y + 2.6, 270, .7); }
        bevel(300, h * .22, 100, h * .34, '#0d1316'); for (let b = 0; b < 4; b++) { c.fillStyle = '#4a545b'; c.beginPath(); c.arc(312 + b * 25, h * .78, 4.5, 0, TAU); c.fill(); c.fillStyle = '#20272b'; c.beginPath(); c.arc(312 + b * 25, h * .78, 3, 0, TAU); c.fill(); }
        c.fillStyle = '#8a959b'; c.fillRect(420, h * .62, 22, 1.2); text(c, 'ON-LINE', 418, h * .74, 4.4, '#9aa5ab', { weight: '600' });
    } else if (kind === 'sw') {
        g.addColorStop(0, '#2d363b'); g.addColorStop(1, '#22292e'); c.fillStyle = g; c.fillRect(0, 0, W, h); ears('#1d2428');
        for (let j = 0; j < 24; j++) { const x = 44 + j * 13.5 + Math.floor(j / 6) * 4; for (const y of [4, 23]) { bevel(x, y, 11.5, 10.5, '#0a0d0f', '#ffffff18', '#00000080'); c.fillStyle = '#c4a446'; c.fillRect(x + 2.5, y + (y < 10 ? 7.6 : 1.4), 6.5, 1.2); } }
        for (let s = 0; s < 4; s++) bevel(398 + (s % 2) * 18, 4 + Math.floor(s / 2) * 19, 14, 10, '#0a0d0f');
        bevel(440, 9, 12, 9, '#0a0d0f'); c.fillStyle = '#3c7fc4'; c.fillRect(441, 10, 10, 1.4);
        text(c, '1', 44, h - 1.5, 4, '#9aa5ab', { weight: '400' }); text(c, '48', 386, h - 1.5, 4, '#9aa5ab', { weight: '400' });
    } else if (kind === 'patch') {
        c.fillStyle = '#1b2226'; c.fillRect(0, 0, W, h); ears('#161c1f');
        c.fillStyle = '#e9ece9'; c.fillRect(30, h - 9, 422, 6); for (let j = 0; j < 24; j++) { const x = portX(j); c.fillStyle = '#c9cfd2'; c.fillRect(x - 7.5, h - 9, .6, 6); }
        for (let j = 0; j < 24; j++) { const x = portX(j); bevel(x - 5.5, 12, 11, 12, '#0a0d0f', '#ffffff20'); c.fillStyle = '#26323a'; c.fillRect(x - 3.5, 15, 7, 1.2); text(c, String(j + 1), x, 9, 4.2, '#d7dcdd', { align: 'center', weight: '600' }); }
    } else if (kind === 'kvm') {
        g.addColorStop(0, '#323b41'); g.addColorStop(1, '#283035'); c.fillStyle = g; c.fillRect(0, 0, W, h); ears('#20272b');
        for (let p = 0; p < 8; p++) { bevel(152 + p * 26, 18, 16, 14, '#1a2024'); text(c, String(p + 1), 160 + p * 26, 28, 7, '#c9d0d3', { align: 'center' }); }
        bevel(40, 12, 22, 18, '#0a0d0f'); bevel(70, 12, 12, 8, '#0a0d0f'); bevel(70, 22, 12, 8, '#0a0d0f');
    } else if (kind === 'blank') {
        c.fillStyle = '#1a1f23'; c.fillRect(0, 0, W, h); ears('#161b1f');
        for (let y = 6; y < h - 4; y += 6) { c.fillStyle = '#0f1316'; c.fillRect(26, y, 430, 2.2); c.fillStyle = '#2a3237'; c.fillRect(26, y + 2.2, 430, .8); }
    }
}
const drawFronts = (c, W, H) => {
    c.fillStyle = '#1a1f23'; c.fillRect(0, 0, W, H);
    for (const [kind, u] of FRONT_KINDS) { const [x, y] = FRONT_CELLS[kind + u]; c.save(); c.translate(x, y); c.scale(FRONT_PX, FRONT_PX); drawFront(c, kind, u); c.restore(); }
};

// Material classes. `store` caches them: per room (kit.it) or module level
// for station / main-desk detail (disposed textures re-upload on reuse).
const IT_UVP = { powder: [320, 320], brushed: [420, 60], alu: [320, 320], hpl: [420, 420], rubber: [70, 70], card: [420, 420], poly: [260, 260], vent: [22, 22], foil: [240, 240] };
const IT_CLASSES = ['dress', 'powder', 'chrome', 'brushed', 'alu', 'hpl', 'rubber', 'card', 'poly', 'vent', 'foil', 'coil', 'cable', 'print', 'front', 'glass'];
function itMaterials(store) {
    if (store.C) return store.C;
    const std = o => new THREE.MeshStandardMaterial(o);
    const maps = store.maps = {
        powder: tex(drawPowder, 256, 256), powderR: tex(drawPowderRough, 128, 128, false), hpl: tex(drawHPL, 256, 256), hplR: tex(drawHPLRough, 128, 128, false),
        brushed: tex(drawBrushed, 256, 64), rubber: tex(drawRubber, 128, 128), card: tex(drawCard, 256, 256), poly: tex(drawPoly, 256, 256), vent: tex(drawVent, 64, 64),
        foil: tex(drawFoil, 256, 256), coil: tex(drawCoil, 64, 64), labels: tex(drawLabelAtlas, LABEL_W, LABEL_H), fronts: tex(drawFronts, FRONT_W, FRONT_H)
    };
    maps.coil.repeat.set(1, 18); maps.labels.wrapS = maps.labels.wrapT = maps.fronts.wrapS = maps.fronts.wrapT = THREE.ClampToEdgeWrapping;
    return store.C = {
        dress: std({ vertexColors: true, roughness: .62 }),
        powder: std({ vertexColors: true, map: maps.powder, roughnessMap: maps.powderR, roughness: .66, metalness: .28 }),
        chrome: std({ vertexColors: true, roughness: .2, metalness: .92 }),
        brushed: std({ vertexColors: true, map: maps.brushed, roughness: .36, metalness: .72 }),
        alu: std({ vertexColors: true, map: maps.powder, roughness: .42, metalness: .55 }),
        hpl: std({ vertexColors: true, map: maps.hpl, roughnessMap: maps.hplR, roughness: .66 }),
        hplTop: std({ color: '#d8dcdc', map: maps.hpl, roughnessMap: maps.hplR, roughness: .62 }),
        rubber: std({ vertexColors: true, map: maps.rubber, roughness: .92 }),
        card: std({ vertexColors: true, map: maps.card, roughness: .9 }),
        poly: std({ vertexColors: true, map: maps.poly, roughness: .48 }),
        vent: std({ vertexColors: true, map: maps.vent, roughness: .55, metalness: .25 }),
        foil: std({ vertexColors: true, map: maps.foil, roughness: .32, metalness: .62 }),
        coil: std({ vertexColors: true, map: maps.coil, roughness: .5 }),
        cable: std({ vertexColors: true, roughness: .42 }),
        print: std({ vertexColors: true, map: maps.labels, roughness: .45 }),
        front: std({ vertexColors: true, map: maps.fronts, roughness: .48, metalness: .08 }),
        glass: std({ color: '#d2e4e8', transparent: true, opacity: .22, roughness: .05, metalness: .1, depthWrite: false })
    };
}
const STATION_STORE = {};
const stationMats = () => itMaterials(STATION_STORE);
// Class kit: K.powder.box(...), K.chrome.cyl(...), ...; K.box/cyl/ball/add go
// to the flat "dress" class. K.build merges one mesh per non-empty class.
function ck() {
    const K = {};
    for (const c of IT_CLASSES) K[c] = detailKit();
    for (const fn of ['box', 'cyl', 'ball', 'add']) K[fn] = (...a) => { K.dress[fn](...a); return K; };
    K.build = (parent, C) => {
        let first;
        for (const c of IT_CLASSES) {
            const m = K[c].build(parent, C[c]); if (!m) continue;
            if (IT_UVP[c]) uvBox(m.geometry, ...IT_UVP[c]);
            if (c === 'glass' || c === 'print' || c === 'front') m.castShadow = false;
            if (c === 'glass') m.renderOrder = 2;
            first ||= m;
        }
        return first;
    };
    return K;
}
// Front plate for one rack unit block (kind / units), facing +z at `at` (centre).
function frontPlate(K, kind, units, at) {
    const cell = FRONT_CELLS[kind + units]; if (!cell) return;
    K.front.add(atlasPlane(482, units * U - 2, cell, FRONT_W, FRONT_H), at, '#ffffff');
}

// ---- Shell surfaces: ESD tile floor, wainscot, rack wall, window view -----
// ESD / static-dissipative vinyl tile, 600 × 600: conductive veining (quarter
// turned per tile), dark welded joints and faint wear. `light` paints the
// lighter cold-aisle tint. Canvas 1024 px = 1200 mm (2 × 2 tiles).
function drawESDTiles(c, W, H, { light = false, scuff = true } = {}) {
    const tile = W / 2, base = light ? ['#a3aeb5', '#9fabb2'] : ['#8b969d', '#87929a'];
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) {
        const x0 = q * tile, y0 = r * tile, turn = (r + q) % 2;
        c.fillStyle = base[turn]; c.fillRect(x0, y0, tile, tile);
        c.save(); c.beginPath(); c.rect(x0, y0, tile, tile); c.clip();
        // Conductive chips and veins: short streaks along the tile's direction.
        for (let n = 0; n < 900; n++) {
            const s = n + (r * 2 + q) * 977, x = x0 + rnd(s * 1.3) * tile, y = y0 + rnd(s * 2.9) * tile, l = 4 + rnd(s * .7) * 26, a = (turn ? Math.PI / 2 : 0) + (rnd(s * 5.1) - .5) * .5;
            c.strokeStyle = n % 5 === 0 ? (light ? '#bcc5ca88' : '#aab3b9aa') : n % 3 ? (light ? '#86929a55' : '#626d7466') : (light ? '#5a656c55' : '#3f494f77');
            c.lineWidth = n % 7 === 0 ? 2 : 1; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * .5 + rnd(s) * 3, y + Math.sin(a) * l * .5 - rnd(s + 1) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
        }
        flecks(c, tile, tile, { count: 0, colors: ['#000'] });
        for (let n = 0; n < 500; n++) { const s = n + q * 311 + r * 733; c.fillStyle = n % 2 ? '#2f383d55' : '#ffffff22'; c.fillRect(x0 + rnd(s * 3.3) * tile, y0 + rnd(s * 4.1) * tile, 1.4, 1.4); }
        c.restore();
    }
    // Welded joints with a fine highlight (the conductive grid).
    for (const v of [0, tile]) { c.fillStyle = light ? '#6f7a81' : '#5f6970'; c.fillRect(v, 0, 2, H); c.fillRect(0, v, W, 2); c.fillStyle = light ? '#b6bfc4' : '#9aa4aa'; c.fillRect(v + 2, 0, 1, H); c.fillRect(0, v + 2, W, 1); }
    if (scuff) for (let n = 0; n < 14; n++) { const x = rnd(n * 7.7) * W, y = rnd(n * 3.9) * H; c.strokeStyle = n % 2 ? '#4b555c22' : '#ffffff18'; c.lineWidth = 2 + rnd(n) * 4; c.beginPath(); c.arc(x, y, 20 + rnd(n * 2) * 50, rnd(n) * TAU, rnd(n) * TAU + .8 + rnd(n * 5) * 1.2); c.stroke(); }
}
// Roughness: satin tile, rougher joints, glossier wear paths (linear data).
function drawESDRough(c, W, H) {
    c.fillStyle = grey(232); c.fillRect(0, 0, W, H);
    flecks(c, W, H, { count: 2600, colors: [grey(222, .5), grey(244, .5)], size: [1, 3], seed: 13 });
    for (let n = 0; n < 6; n++) { const g = c.createRadialGradient(rnd(n * 3) * W, rnd(n * 5) * H, 0, rnd(n * 3) * W, rnd(n * 5) * H, 160); g.addColorStop(0, grey(214, .35)); g.addColorStop(1, grey(214, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    for (const v of [0, W / 2]) { c.fillStyle = grey(255); c.fillRect(v, 0, 3, H); c.fillRect(0, v, W, 3); }
}
export const floor = (spec, w, d) => {
    const map = institutionalMap((c, W, H) => drawESDTiles(c, W, H), 1024, 1024);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(w / 1200, d / 1200); map.anisotropy = 8;
    return { map, roughness: .6, surface: 'stone' };
};
function finishFloor(kit) {
    const r = tex(drawESDRough, 512, 512, false); r.repeat.set(kit.w / 1200, kit.d / 1200);
    kit.floor.roughnessMap = r; kit.floor.needsUpdate = true;
}
// Cold-aisle decal: lighter tiles on the room's 600 grid, a 50 mm yellow and
// black border with worn edges and the KEEP CLEAR stencil.
function coldAisleDraw(kit, [cx, cz], [sx, sz]) {
    return (c, W, H) => {
        const pxX = W / sx, pxZ = H / sz, x0 = cx - sx / 2, z0 = cz - sz / 2;
        // Tiles: a 1200 mm tile canvas patterned on the room's 600 mm grid (the
        // floor map starts at x = −w/2 and at the open front edge).
        const tc = document.createElement('canvas'); tc.width = tc.height = 512; drawESDTiles(tc.getContext('2d'), 512, 512, { light: true, scuff: false });
        const mod = (v, m) => ((v % m) + m) % m, ox = mod(-kit.w / 2 - x0, 1200), oz = mod(kit.front - z0, 1200);
        c.save(); c.scale(pxX, pxZ); c.translate(ox - 1200, oz - 1200); c.scale(1200 / 512, 1200 / 512); c.fillStyle = c.createPattern(tc, 'repeat'); c.fillRect(0, 0, (sx + 2400) * 512 / 1200, (sz + 2400) * 512 / 1200); c.restore();
        const b = 50 * pxX;
        c.save(); c.beginPath(); c.rect(0, 0, W, b); c.rect(0, H - b, W, b); c.rect(0, 0, b, H); c.rect(W - b, 0, b, H); c.clip(); c.fillStyle = '#1f2529'; c.fillRect(0, 0, W, H);
        c.fillStyle = YELLOW; for (let x = -H; x < W + H; x += b * 2) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + b, 0); c.lineTo(x + b + H, H); c.lineTo(x + H, H); c.fill(); } c.restore();
        for (let n = 0; n < 60; n++) { c.fillStyle = '#a3aeb5'; const e = n % 4, t = rnd(n * 3.3); c.fillRect(e === 0 ? t * W : e === 1 ? t * W : e === 2 ? 0 : W - 6, e === 0 ? 0 : e === 1 ? H - 4 : t * H, 4 + rnd(n) * 10, 3 + rnd(n + 1) * 4); }
        c.globalAlpha = .82; text(c, 'COLD AISLE · KEEP CLEAR', W / 2, H * .6, H * .17, '#f4f5f2', { align: 'center', weight: '700', max: W * .8, spacing: H * .02 }); reset(c);
        c.globalCompositeOperation = 'destination-out'; for (let n = 0; n < 220; n++) { c.fillStyle = '#00000050'; c.fillRect(W * .1 + rnd(n * 1.9) * W * .8, H * .42 + rnd(n * 2.3) * H * .24, 2 + rnd(n) * 6, 2); } c.globalCompositeOperation = 'source-over';
        // Destination-out above cut through to transparent: refill under the stencil.
        c.globalCompositeOperation = 'destination-over'; c.fillStyle = '#a3aeb5'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    };
}
// Deployment bay: white tape border with corner marks and a stencil on the
// real floor (transparent decal), with a light hatch along the border.
function drawBay(c, W, H) {
    c.clearRect(0, 0, W, H); const b = Math.max(8, W * .018);
    c.fillStyle = '#eef0ee'; c.fillRect(0, 0, W, b); c.fillRect(0, H - b, W, b); c.fillRect(0, 0, b, H); c.fillRect(W - b, 0, b, H);
    c.save(); c.beginPath(); c.rect(b * 2, b * 2, W - b * 4, H - b * 4); c.rect(b * 4, b * 4, W - b * 8, H - b * 8); c.clip('evenodd'); c.strokeStyle = '#eef0ee99'; c.lineWidth = b * .5; for (let x = -H; x < W; x += b * 3) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H, 0); c.stroke(); } c.restore();
    c.globalCompositeOperation = 'destination-out'; for (let n = 0; n < 80; n++) { c.fillStyle = '#000000a0'; c.fillRect(rnd(n * 2.1) * W, rnd(n * 3.7) < .5 ? rnd(n) * b : H - rnd(n) * b, 3 + rnd(n + 1) * 8, 2 + rnd(n + 2) * 3); } c.globalCompositeOperation = 'source-over';
    c.globalAlpha = .88; text(c, 'DEPLOYMENT BAY', W / 2, H - b * 5, H * .085, '#eef0ee', { align: 'center', weight: '700', max: W * .74, spacing: H * .012 }); reset(c);
}
// Wainscot: 1200 perforated steel panels (600 modules, shadow reveals) and a
// brushed aluminium cap on the three walls, below the sill under the glazing
// and outside the door span and the dark rack wall. Presentation only.
function wallFinishes(kit, I) {
    const { w, bz, front, d, ceiling } = kit, t = kit.itTier, height = 1200, depth = 12;
    const zoneW = t.rackX1 - t.rackX0 + 1600, zoneX = (t.rackX0 + t.rackX1) / 2, zone = [zoneX - zoneW / 2, zoneX + zoneW / 2];
    const cut = (a, b, holes) => { let segs = [[a, b]]; for (const [h0, h1] of holes) segs = segs.flatMap(([s, e]) => h1 <= s || h0 >= e ? [[s, e]] : [[s, h0], [h1, e]].filter(([x0, x1]) => x1 - x0 > 60)); return segs; };
    const win = [bz + d * .3, bz + d * .78];
    const runs = {
        back: cut(-w / 2 + 20, w / 2 - 20, [zone]).map(([a, b]) => [a, b, height]),
        right: cut(bz + 20, front, [[t.door - 580, t.door + 580]]).map(([a, b]) => [a, b, height]),
        left: [[bz + 20, win[0], height], [win[0], win[1], 780], [win[1], front, height]]
    };
    const panelMat = new THREE.MeshStandardMaterial({ map: tex(drawWainscot, 128, 128), roughness: .55, metalness: .18 });
    for (const o of kit.back.children) if (o.isMesh && o.material === kit.accent) o.visible = false;
    for (const o of kit.right.children) if (o.isMesh && o.material === kit.metal && o.geometry.parameters?.height === 110) o.visible = false;
    const walls = { back: kit.back, right: kit.right, left: kit.left };
    for (const side of ['back', 'right', 'left']) {
        const base = detailKit(), K = ck();
        for (const [a, b, hgt] of runs[side]) {
            const len = b - a, mid = (a + b) / 2;
            const at = (along, y, off = 0) => side === 'back' ? [along, y, bz + 18 + depth / 2 + off] : side === 'right' ? [w / 2 - 18 - depth / 2 - off, y, along] : [-w / 2 + 18 + depth / 2 + off, y, along];
            const size = (l, h, dd) => side === 'back' ? [l, h, dd] : [dd, h, l];
            base.box(size(len, hgt, depth), at(mid, hgt / 2), '#ffffff');
            for (let p = Math.ceil(a / 600) * 600; p < b - 30; p += 600) if (p > a + 30) K.box(size(4, hgt - 10, 2), at(p, hgt / 2, depth / 2), '#3d474e');
            K.brushed.box(size(len, 24, depth + 18), at(mid, hgt + 12, 9), '#b7c0c6');
            K.brushed.box(size(len, 4, depth + 20), at(mid, hgt + 1, 10), '#8f999f');
        }
        const g = new THREE.Group(); g.name = 'Wainscot wall finish'; g.userData.presentationOnly = true; walls[side].add(g);
        const m = base.build(g, panelMat); if (m) { uvBox(m.geometry, 48, 48); m.castShadow = false; m.receiveShadow = true; m.name = 'Perforated wainscot panels'; }
        K.build(g, I.C);
    }
    // Rack wall: dark acoustic cladding (600 × 1200 modules) with aluminium edge trims.
    const dark = kit.back.children.find(o => o.name === 'Rack wall paint');
    if (dark) {
        dark.material = new THREE.MeshStandardMaterial({ map: tex(drawRackWall, 512, 512), roughness: .86 }); uvBox(dark.geometry, 1200, 1200);
        dark.geometry.translate(0, 0, 0);
        const K = ck(); for (const x of zone) K.brushed.box([28, ceiling - 150, 34], [x, (ceiling - 150) / 2, bz + 24], '#aab3b8');
        const g = new THREE.Group(); g.name = 'Rack wall trims'; g.userData.presentationOnly = true; kit.back.add(g); K.build(g, I.C);
    }
}

// Window outlook: the depot's service yard. A business-park office block and
// trees behind a palisade fence, a loading dock with two roller shutters,
// dock bumpers and a dock light, two plain white vans (no livery), a pallet
// and a roll cage, bollards and lamp posts. The roller blind covers the top
// half, so the yard sits low in the frame. Unlit (black base, emissive map),
// redrawn per daypart; the level per daypart is VIEW_LEVEL (lighting pass).
const VIEW_LEVEL = [.9, .96, .78, .62, .88];
function installView(kit, I) {
    const pane = kit.window.children.find(o => o.isMesh && o.material === kit.sky); if (!pane) return;
    const aspect = kit.d * .48 / 1750, H = 512, W = Math.min(2048, Math.round(H * aspect / 16) * 16);
    const map = institutionalMap(() => {}, W, H); map.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .9, roughness: .9 });
    pane.replacedMaterials = [...(pane.replacedMaterials || []), pane.material]; pane.material = m; I.view = { m, map, W, H, phase: null };
}
function drawView(kit, I, phase, gain = 1) {
    const v = I.view; if (!v) return;
    const i = phaseIndex(phase);
    v.m.emissiveIntensity = VIEW_LEVEL[i] * Math.min(1.2, .6 + gain * .4);
    if (v.phase === phase) return; v.phase = phase;
    const c = v.map.image.getContext('2d'), sky = kit.spec.modes[phase]?.sky || ['#bad8e5', '#f5e6ca'];
    c.save(); reset(c); drawYard(c, v.W, v.H, phase, sky); c.restore(); v.map.needsUpdate = true;
}
const tone = (phase, day, dusk, night) => phase === 'night' ? night : phase === 'evening' ? dusk : day;
function glowDot(c, x, y, r, color, a = 'c0') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + a); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
// Plain white panel van, side view, facing right (no markings or livery).
function van(c, x, y, s, phase, flip = false) {
    const night = phase === 'night', dusk = phase === 'evening';
    c.save(); c.translate(x, y); if (flip) { c.scale(-1, 1); c.translate(-s, 0); }
    c.fillStyle = '#00000038'; c.beginPath(); c.ellipse(s * .5, 2, s * .54, s * .045, 0, 0, TAU); c.fill();
    const body = night ? '#7f878d' : dusk ? '#d9cfc5' : '#eef0ef', shadeC = night ? '#61686d' : dusk ? '#b9aea5' : '#cfd4d6';
    c.fillStyle = body; c.beginPath(); c.moveTo(0, -s * .07); c.lineTo(0, -s * .44); c.lineTo(s * .02, -s * .46); c.lineTo(s * .7, -s * .46); c.lineTo(s * .74, -s * .44);
    c.lineTo(s * .86, -s * .3); c.lineTo(s * .97, -s * .25); c.lineTo(s, -s * .2); c.lineTo(s, -s * .07); c.closePath(); c.fill();
    c.fillStyle = shadeC; c.fillRect(0, -s * .12, s, s * .05);
    // Cab glazing, side door seam and sliding-door rail, handles, mirror, lamps.
    c.fillStyle = night ? '#1d262c' : '#33475280'; c.beginPath(); c.moveTo(s * .72, -s * .42); c.lineTo(s * .84, -s * .3); c.lineTo(s * .72, -s * .3); c.closePath(); c.fill();
    c.fillStyle = night ? '#1d262c' : '#2f4350'; c.fillRect(s * .62, -s * .41, s * .09, s * .11);
    c.strokeStyle = shadeC; c.lineWidth = Math.max(1, s * .006); c.beginPath(); c.moveTo(s * .6, -s * .44); c.lineTo(s * .6, -s * .1); c.moveTo(s * .3, -s * .44); c.lineTo(s * .3, -s * .1); c.moveTo(s * .3, -s * .4); c.lineTo(s * .6, -s * .4); c.stroke();
    c.fillStyle = '#3a4248'; c.fillRect(s * .66, -s * .26, s * .03, s * .012); c.fillRect(s * .54, -s * .26, s * .03, s * .012); c.fillRect(s * .84, -s * .36, s * .02, s * .05);
    c.fillStyle = night ? '#ff4a3a' : '#c0392b'; c.fillRect(0, -s * .3, s * .012, s * .08); c.fillStyle = night ? '#f6e7b0' : '#d8dcdc'; c.fillRect(s * .985, -s * .22, s * .015, s * .04);
    if (night) { glowDot(c, s, -s * .2, s * .14, '#f6e7b0', '70'); glowDot(c, 0, -s * .26, s * .08, '#ff4a3a', '80'); }
    for (const wx of [.17, .8]) { c.fillStyle = '#16191b'; c.beginPath(); c.arc(s * wx, -s * .07, s * .075, 0, TAU); c.fill(); c.fillStyle = night ? '#4b5257' : '#9aa2a7'; c.beginPath(); c.arc(s * wx, -s * .07, s * .036, 0, TAU); c.fill(); }
    c.restore();
}
function drawYard(c, W, H, phase, sky) {
    const night = phase === 'night', dusk = phase === 'evening', hz = H * .5;
    // Sky, sun or moon, clouds or stars.
    const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, hz + 2);
    const sun = { morning: [.2, .3, '#fff4d8'], afternoon: [.75, .14, '#fffdf0'], evening: [.3, .66, '#ffc27a'], night: [.82, .16, '#eef0e4'], party: [.84, .32, '#fff2dc'] }[phase] || [.5, .2, '#ffffff'];
    glowDot(c, W * sun[0], hz * sun[1], night ? H * .1 : H * .35, sun[2], night ? '60' : 'b0'); c.fillStyle = sun[2]; c.beginPath(); c.arc(W * sun[0], hz * sun[1], night ? 9 : 14, 0, TAU); c.fill();
    if (night) { c.fillStyle = '#ffffff90'; for (let n = 0; n < W / 8; n++) c.fillRect(rnd(n * 1.7) * W, rnd(n * 3.3) * hz * .8, 1.3, 1.3); }
    else for (let n = 0; n < Math.round(W / 170); n++) { const x = rnd(n * 5 + 2) * W, y = hz * (.12 + rnd(n * 9) * .4), s = H * (.04 + rnd(n * 4) * .05); c.fillStyle = dusk ? '#f6c9a890' : '#ffffffa8'; for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + (j - 2) * s * .6, y + Math.abs(j - 2) * s * .1, s * .7, s * .32, 0, 0, TAU); c.fill(); } }
    // Business-park office block (curtain wall, spandrels) and trees behind.
    const bx = W * .02, bw = W * .5, bt = hz - H * .2;
    c.fillStyle = tone(phase, '#c9d0d3', '#a8a4a4', '#252f37'); c.fillRect(bx, bt, bw, hz - bt + H * .06);
    for (let f = 0; f < 4; f++) {
        const fy = bt + 8 + f * (hz - bt + H * .02) / 4, fh = (hz - bt) / 4 - 6;
        for (let q = 0; q < 18; q++) { const on = (night || dusk) && rnd(f * 41 + q * 3) < (night ? .3 : .45); c.fillStyle = on ? (night ? '#f3d58e' : '#f0d6a0') : tone(phase, q % 3 ? '#7f9aab' : '#93adbc', '#6b7883', '#1a252e'); c.fillRect(bx + 6 + q * (bw - 12) / 18, fy, (bw - 12) / 18 - 2, fh); if (on && night) glowDot(c, bx + 6 + (q + .5) * (bw - 12) / 18, fy + fh / 2, 16, '#f3d58e', '30'); }
        c.fillStyle = tone(phase, '#b3bbc0', '#958f90', '#1f2830'); c.fillRect(bx, fy + fh, bw, 4);
    }
    c.fillStyle = tone(phase, '#8b959b', '#78767a', '#1b232a'); c.fillRect(bx - 4, bt - 6, bw + 8, 8);
    for (let n = 0; n < 9; n++) { const x = W * (.03 + n * .065) + rnd(n) * 10, r = H * (.045 + rnd(n * 3) * .02), y = hz + H * .05; c.fillStyle = tone(phase, '#5a7a50', '#4a6646', '#18292a'); c.beginPath(); c.ellipse(x, y - r, r * .9, r * 1.1, 0, 0, TAU); c.fill(); c.fillStyle = tone(phase, '#6d9160', '#5e7a50', '#203632'); c.beginPath(); c.ellipse(x - r * .3, y - r * 1.3, r * .5, r * .55, 0, 0, TAU); c.fill(); }
    // Depot building with the loading dock (profiled cladding, two roller shutters).
    const dx = W * .56, dTop = hz - H * .12, ground = H * .74, dockH = H * .05;
    c.fillStyle = tone(phase, '#d5d9d8', '#b7b0aa', '#2b343b'); c.fillRect(dx, dTop, W - dx, ground - dTop);
    for (let y = dTop + 4; y < ground - dockH; y += 6) { c.fillStyle = tone(phase, '#c1c6c6', '#a49d98', '#252d33'); c.fillRect(dx, y, W - dx, 2); }
    c.fillStyle = tone(phase, '#5f6a70', '#545b60', '#1d2429'); c.fillRect(dx - 6, dTop - 8, W - dx + 6, 10);
    c.fillStyle = tone(phase, '#7c868b', '#6b7175', '#20272c'); c.fillRect(dx, ground - dockH, W - dx, dockH);
    for (let n = 0; n < 2; n++) {
        const sx = dx + (W - dx) * (.12 + n * .46), sw = (W - dx) * .32, st = dTop + H * .06, sb = ground - dockH;
        c.fillStyle = tone(phase, '#8e989d', '#7d8286', '#30383e'); c.fillRect(sx - 6, st - 10, sw + 12, 10);   // canopy
        const open = n === 1 && !night;
        if (open) { c.fillStyle = tone(phase, '#30383d', '#2c3237', '#11161a'); c.fillRect(sx, st + (sb - st) * .45, sw, (sb - st) * .55); c.fillStyle = tone(phase, '#b3a079', '#9c8b6c', '#2c2a25'); c.fillRect(sx + sw * .15, sb - (sb - st) * .25, sw * .3, (sb - st) * .25); }
        for (let y = st; y < (open ? st + (sb - st) * .45 : sb); y += 3.5) { c.fillStyle = tone(phase, y % 7 < 3.5 ? '#b9c0c3' : '#a9b1b5', '#958f8d', '#2a3237'); c.fillRect(sx, y, sw, 3.5); }
        c.fillStyle = '#16191b'; c.fillRect(sx - 8, sb - 10, 8, 14); c.fillRect(sx + sw, sb - 10, 8, 14);   // dock bumpers
        for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#1e2326' : (night ? '#7d6a2c' : YELLOW); c.fillRect(sx + k * sw / 8, sb, sw / 8, 4); }
        // Dock light on an arm.
        c.fillStyle = '#3a4248'; c.fillRect(sx + sw + 12, st + 6, 3, 18); c.fillRect(sx + sw + 12, st + 6, 14, 3); c.fillStyle = night || dusk ? '#f4e2b0' : '#c9cfd2'; c.fillRect(sx + sw + 22, st + 8, 8, 5);
        if (night || dusk) glowDot(c, sx + sw + 26, st + 12, H * .12, '#f4e2b0', night ? 'b0' : '50');
    }
    // Palisade fence between the business park and the yard.
    const fy = H * .66; c.fillStyle = tone(phase, '#6f7a7f', '#5d6569', '#2a3237');
    for (let x = 0; x < dx; x += 5) { c.fillRect(x, fy - H * .055, 2.4, H * .055); c.beginPath(); c.moveTo(x - 1, fy - H * .055); c.lineTo(x + 1.2, fy - H * .066); c.lineTo(x + 3.4, fy - H * .055); c.fill(); }
    c.fillRect(0, fy - H * .045, dx, 2); c.fillRect(0, fy - H * .012, dx, 2);
    // Yard: asphalt, bay lines, hatch at the dock, kerb.
    const ag = c.createLinearGradient(0, fy, 0, H); ag.addColorStop(0, tone(phase, '#7a7f82', '#66686b', '#1e2327')); ag.addColorStop(1, tone(phase, '#5c6164', '#4d5053', '#14171a')); c.fillStyle = ag; c.fillRect(0, fy, W, H - fy);
    c.fillStyle = tone(phase, '#8ea47e', '#738866', '#1b2722'); c.fillRect(0, fy, dx, H * .012);
    for (let n = 0; n < 12; n++) { c.fillStyle = tone(phase, 'rgba(26,30,33,.12)', 'rgba(26,30,33,.12)', 'rgba(0,0,0,.15)'); c.beginPath(); c.ellipse(rnd(n * 5) * W, fy + rnd(n * 7) * (H - fy), 30 + rnd(n) * 60, 4 + rnd(n * 2) * 6, 0, 0, TAU); c.fill(); }
    c.strokeStyle = tone(phase, '#ecebe4c0', '#d9d6c8a0', '#8a8d8a60'); c.lineWidth = 2;
    for (let n = 0; n < 7; n++) { const x = W * (.04 + n * .085); c.beginPath(); c.moveTo(x, H * .78); c.lineTo(x - 30, H * .97); c.stroke(); }
    c.save(); c.beginPath(); c.rect(dx, ground + 6, W - dx, H * .08); c.clip(); c.strokeStyle = night ? '#6a5a26' : '#e2b93a'; c.lineWidth = 3; for (let x = dx - 60; x < W; x += 14) { c.beginPath(); c.moveTo(x, ground + 6 + H * .08); c.lineTo(x + 40, ground + 6); c.stroke(); } c.restore();
    // Pallet with boxes and a roll cage at the dock.
    const px = dx + (W - dx) * .1, py = ground + H * .07;
    c.fillStyle = tone(phase, '#a8875c', '#8f7350', '#2c261e'); c.fillRect(px, py - 6, H * .16, 6);
    for (let n = 0; n < 4; n++) { c.fillStyle = tone(phase, ['#c49d74', '#b99067'][n % 2], '#9c7c5c', '#30291f'); c.fillRect(px + (n % 2) * H * .08, py - 6 - H * .045 * (1 + Math.floor(n / 2)), H * .078, H * .044); }
    const rx = W * .92, ry = ground + H * .09; c.strokeStyle = tone(phase, '#9aa3a8', '#848b8f', '#3a4248'); c.lineWidth = 1.5; c.strokeRect(rx, ry - H * .1, H * .07, H * .1); for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(rx, ry - k * H * .02); c.lineTo(rx + H * .07, ry - k * H * .02); c.stroke(); }
    // Two plain white vans, one reversed toward the dock.
    van(c, W * .1, H * .9, H * .42, phase); van(c, W * .4, H * .935, H * .44, phase, true);
    // Bollards and lamp posts (on in the evening and overnight).
    for (let n = 0; n < 4; n++) { const x = dx - 20 + n * (W - dx) * .27; c.fillStyle = tone(phase, '#d9b23b', '#b89a3a', '#5a4c20'); c.fillRect(x, ground + H * .02, 7, H * .07); c.fillStyle = '#1e2326'; c.fillRect(x, ground + H * .04, 7, 4); }
    for (const lx of [W * .06, W * .34]) {
        c.fillStyle = tone(phase, '#5b646a', '#4f575c', '#2a3034'); c.fillRect(lx - 2, H * .42, 4, H * .38); c.fillRect(lx - 2, H * .42, 22, 4);
        c.fillStyle = night || dusk ? '#f2d8a0' : '#c9cfd2'; c.fillRect(lx + 10, H * .425, 14, 5);
        if (night || dusk) { glowDot(c, lx + 17, H * .43, H * .1, '#f2d8a0', night ? 'd0' : '60'); glowDot(c, lx + 17, H * .86, H * .16, '#f2d8a0', night ? '40' : '18'); }
    }
}

// ---- Group kit -----------------------------------------------------------
let POOL_TEXTURE = null;
const noRay = () => {};
function poolTexture() {
    if (POOL_TEXTURE) return POOL_TEXTURE;
    POOL_TEXTURE = institutionalMap((c, W, H) => {
        const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ffffffc8'); g.addColorStop(.55, '#ffffff5c'); g.addColorStop(.8, '#ffffff16'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 128, 128);
    POOL_TEXTURE.wrapS = POOL_TEXTURE.wrapT = THREE.ClampToEdgeWrapping; return POOL_TEXTURE;
}
const FACES = { floor: [-Math.PI / 2, 0, 0], back: [0, 0, 0], right: [0, -Math.PI / 2, 0], left: [0, Math.PI / 2, 0] };
// Per-room kit: cached materials, phase-levelled glows / LEDs / pools,
// phase-only objects and canvas helpers. Levels are 5-element arrays
// [morning, afternoon, evening, night, party].
function itKit(kit) {
    if (kit.it) return kit.it;
    const cache = new Map();
    const M = (color, surface = 'powder', extra = {}) => {
        const key = color + surface + JSON.stringify(extra);
        if (!cache.has(key)) cache.set(key, kit.mat(color, surface, { roughness: .7, ...extra }));
        return cache.get(key);
    };
    const dress = kit.material('#ffffff', { vertexColors: true, roughness: .62 }); dress.userData.roomSurface = 'powder';
    const I = kit.it = { M, dress, glows: [], leds: [], pools: [], shows: [], redraws: [] };
    I.C = itMaterials(I);
    I.build = (k, parent, material = dress) => k.build(parent, material);
    I.tex = (draw, W = 512, H = 512, { surface = 'plaster', roughness = .85, transparent = false, repeat = null } = {}) => {
        const map = institutionalMap(draw, W, H); map.anisotropy = 4;
        if (repeat) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(...repeat); }
        const m = kit.material('#ffffff', { map, roughness, transparent }); if (surface) m.userData.roomSurface = surface; return m;
    };
    // Emissive material whose intensity follows the daypart.
    I.glow = (color, levels, { base = '#1a1f22', ...extra } = {}) => { const m = kit.material(base, { emissive: color, emissiveIntensity: levels[0], roughness: .45, ...extra }); I.glows.push({ m, levels }); return m; };
    // Unlit vertex-coloured LED field: one draw per furnishing, brightness per daypart.
    I.ledMat = levels => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffffff' }); I.leds.push({ m, levels }); return m; };
    I.show = (obj, phases) => { I.shows.push({ obj, phases }); return obj; };
    // Wall-mounted asset; `along` is x on the back wall, z on the side walls.
    // Marked propAnchor 'wall' so RoomInteractions never takes one for floor furniture.
    I.wall = (wall, id, name, along, y, depth = 24) => {
        const { w, bz } = kit;
        if (wall === 'back') { const g = kit.asset(id, name, [along, y, bz + 22 + depth / 2], kit.back); g.userData.propAnchor = 'wall'; return g; }
        const right = wall === 'right', g = kit.asset(id, name, [right ? w / 2 - 22 - depth / 2 : -w / 2 + 22 + depth / 2, y, along], right ? kit.right : kit.left);
        g.rotation.y = right ? -Math.PI / 2 : Math.PI / 2; g.userData.propAnchor = 'wall'; return g;
    };
    // Printed canvas panel facing +z of its group.
    I.panel = (g, W, H, draw, { res = 1024, at = [0, 0, 0], frame = null, border = 20, depth = 20, rough = .85, material = null } = {}) => {
        const wide = W >= H, cw = wide ? res : Math.max(64, Math.round(res * W / H)), ch = wide ? Math.max(64, Math.round(res * H / W)) : res;
        if (frame) kit.box(g, [W + border * 2, H + border * 2, depth], at, M(frame, 'metal', { metalness: .5, roughness: .4 }), 3);
        const m = material || I.tex(draw, cw, ch, { roughness: rough });
        const p = kit.mesh(g, new THREE.PlaneGeometry(W, H), m, [at[0], at[1], at[2] + (frame ? depth / 2 : 0) + 1.5]); p.castShadow = false; return p;
    };
    // Flat floor asset (< 35 mm: a movable rug, never a collider).
    I.flat = (id, name, [x, z], [sx, sz], draw, { res = 512, height = 5, turn = 0, transparent = false, surface = 'fabric', roughness = .8 } = {}) => {
        const g = kit.asset(id, name, [x, 0, z]); g.rotation.y = turn;
        const m = I.tex(draw, res, Math.max(32, Math.round(res * sz / sx)), { surface: transparent ? null : surface, roughness, transparent }); if (transparent) { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; }
        const o = kit.mesh(g, new THREE.BoxGeometry(sx, height, sz), m, [0, height / 2, 0]); o.castShadow = false; o.receiveShadow = true; return g;
    };
    // Additive light pool (shared radial map). Pools for an asset live in one
    // non-interactive layer and copy its transform, so the asset's bounds and
    // collider are untouched (see docs, Educational lighting).
    I.poolLayer = new THREE.Group(); I.poolLayer.name = 'Daylight and lamp light pools'; I.poolLayer.userData.grooveMarker = true; kit.root.add(I.poolLayer);
    I.pool = (parent, at, [sx, sy], color, levels, face = 'floor') => {
        I.poolGeo ||= new THREE.PlaneGeometry(1, 1);
        const m = new THREE.MeshBasicMaterial({ map: poolTexture(), color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); m.userData.sharedTextures = true;
        const o = new THREE.Mesh(I.poolGeo, m); o.name = 'Light pool'; o.position.set(...at); o.scale.set(sx, sy, 1); o.renderOrder = 2; o.castShadow = o.receiveShadow = false; o.raycast = noRay;
        o.rotation.set(...(Array.isArray(face) ? face : FACES[face]));
        if (parent.userData.propId) {
            o.updateMatrix(); const local = o.matrix.clone(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
            o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false;
            o.onBeforeRender = () => { let shown = true; for (let q = parent; q; q = q.parent) if (!q.visible) { shown = false; break; } o.matrixWorld.multiplyMatrices(parent.matrixWorld, shown && parent.parent ? local : zero); };
            I.poolLayer.add(o);
        } else parent.add(o);
        I.pools.push({ o, color: new THREE.Color(color), levels }); return o;
    };
    // Re-home `object` (currently a child of `asset`) into a non-interactive
    // overlay whose meshes copy the asset's transform when drawn: it follows a
    // moved asset and hides with it, without growing the asset's bounds.
    I.follow = (asset, object) => {
        asset.updateWorldMatrix(true, true);
        const g = new THREE.Group(); g.name = object.name; g.userData.grooveMarker = true; kit.root.add(g);
        const inv = asset.matrixWorld.clone().invert(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
        const meshes = []; object.traverse(o => { if (o.isMesh) meshes.push(o); });
        for (const o of meshes) {
            const local = inv.clone().multiply(o.matrixWorld);
            g.add(o); o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.frustumCulled = false; o.raycast = noRay; o.castShadow = false;
            o.onBeforeRender = () => { let shown = true; for (let q = asset; q; q = q.parent) if (!q.visible) { shown = false; break; } o.matrixWorld.multiplyMatrices(asset.matrixWorld, shown && asset.parent ? local : zero); };
        }
        object.removeFromParent(); return g;
    };
    // Floor markings (tape, chevrons): presentation only, never furniture.
    I.decals = new THREE.Group(); I.decals.name = 'Floor flow markings'; I.decals.userData.presentationOnly = true; kit.root.add(I.decals);
    // A canvas that is redrawn per daypart.
    I.redraw = (map, draw) => { I.redraws.push({ map, draw }); return map; };
    return I;
}
const onWall = (kit, wall, along, y, off) => wall === 'back' ? [along, y, kit.bz + 18 + off] : wall === 'right' ? [kit.w / 2 - 18 - off, y, along] : [-kit.w / 2 + 18 + off, y, along];
const wallGroup = (kit, wall) => ({ back: kit.back, right: kit.right, left: kit.left })[wall];

// ---- Builder hooks -------------------------------------------------------
export function options(spec) {
    return {
        trimColor: '#b7c0c6', acousticName: 'Wall acoustic panels', signLabel: 'TECH BAR · DROP-OFF & HELP', rugColor: null, planter: false,
        boardOnSideWall: true, boardName: 'Wall ticket and deployment board', boardFooter: '#21455f',
        storage: { height: 1800, open: false }, chairDetailHeight: 480, nightBackground: .55,
        // The second real lamp is the parts-shelving work light (extraLamps).
        lampSupport: null
    };
}

// Rack equipment plan, bottom (U1) up: [units, kind]. kind: ups, srv, blank,
// sw (switch), patch, mgr (cable manager), stor (storage shelf), kvm.
const RACK_PLAN = [
    [[2, 'ups'], [1, 'blank'], [2, 'srv'], [2, 'srv'], [1, 'blank'], [3, 'stor'], [1, 'blank'], [2, 'srv'], [2, 'srv'], [2, 'srv'], [2, 'blank'], [1, 'kvm'], [1, 'blank'], [1, 'sw'], [1, 'mgr'], [1, 'patch'], [1, 'sw'], [1, 'mgr'], [1, 'patch'], [4, 'blank'], [1, 'sw'], [1, 'patch']],
    [[2, 'ups'], [2, 'srv'], [2, 'srv'], [2, 'srv'], [1, 'blank'], [4, 'stor'], [2, 'blank'], [2, 'srv'], [1, 'blank'], [1, 'sw'], [1, 'mgr'], [1, 'patch'], [1, 'patch'], [1, 'mgr'], [1, 'sw'], [6, 'blank'], [1, 'patch'], [1, 'sw']],
    [[2, 'ups'], [1, 'blank'], [3, 'stor'], [3, 'stor'], [2, 'blank'], [2, 'srv'], [2, 'srv'], [1, 'blank'], [1, 'sw'], [1, 'mgr'], [1, 'patch'], [1, 'patch'], [1, 'mgr'], [1, 'sw'], [8, 'blank'], [1, 'patch']]
];
function buildRack(kit, I, n, x) {
    const t = kit.itTier, rack = kit.asset(`server-rack-${n}`, 'IT equipment rack', [x, 0, t.rackZ]);
    const K = ck(), leds = detailKit(), cords = detailKit();
    // 600 W × 1000 D × 2000 H, 42U, powder-coated. Front (+z) faces the cold aisle.
    for (const s of [-1, 1]) {
        K.powder.box([22, 2000, 1000], [s * 289, 1000, 0], RACK);
        // Split side panels: centre seam, lift-off grips and an earth stud (seen at the row ends).
        K.box([3, 1860, 4], [s * 300.5, 1010, 0], '#0e1316'); for (const z of [-260, 260]) K.box([3, 70, 150], [s * 300.5, 1500, z], '#12181b');
        K.brushed.add(new THREE.CylinderGeometry(6, 6, 14, 10), [s * 302, 160, 420], '#b9a46a', [1, 1, 1], [0, 0, Math.PI / 2]);
    }
    K.powder.box([600, 40, 1000], [0, 1980, 0], RACK); K.powder.box([600, 90, 980], [0, 45, 0], '#14191d');
    // Brush-strip cable entries in the roof and levelling feet under the plinth.
    for (const bx of [-140, 140]) { K.rubber.box([200, 4, 90], [bx, 2002, -300], '#0b0e10'); K.powder.box([230, 3, 120], [bx, 2001, -300], '#2a3339'); }
    for (const fx of [-260, 260]) for (const fz of [-460, 460]) K.brushed.cyl(16, 20, 18, [fx, 9, fz], '#8f999f');
    K.powder.box([556, 1880, 12], [0, 1010, -494], '#222b31');
    for (const s of [-1, 1]) { K.powder.box([18, 1880, 24], [s * 241, 1010, 452], '#2b343a'); for (let u = 0; u < 42; u++) K.box([4, 2, 26], [s * 236, 100 + u * U, 452], u % 5 === 0 ? '#9aa5ab' : '#56636b'); }
    // Front door: powder frame, hex-perforated steel, swing handle with lock, hinges, rack ID.
    const door = new THREE.Group(); door.name = 'Rack front door'; rack.add(door); door.position.set(-286, 0, 506);
    const DK = ck(); for (const y of [80, 1950]) DK.powder.box([572, 26, 18], [286, y, 0], '#232c32'); for (const dx of [12, 560]) DK.powder.box([24, 1890, 18], [dx, 1015, 0], '#232c32');
    DK.brushed.box([22, 190, 14], [532, 1100, 16], '#b4bec3'); DK.brushed.box([30, 230, 6], [532, 1100, 10], '#59646a'); DK.brushed.add(new THREE.CylinderGeometry(8, 8, 8, 14), [532, 1230, 14], '#c9d0d3', [1, 1, 1], [Math.PI / 2, 0, 0]);
    for (const hy of [300, 1015, 1730]) DK.powder.box([14, 80, 26], [-2, hy, 0], '#161c1f');
    tag(DK, `R0${n + 1}`, [120, 60], [286, 1990, 10]); tag(DK, ASSET_TAGS[n % 6], [80, 40], [470, 140, 10]);
    DK.build(door, I.C);
    I.perf ||= (() => { const m = I.tex(drawHexMesh, 64, 56, { surface: null, roughness: .5, transparent: true, repeat: [548 / 9, 1860 / 7.8] }); m.color.set('#4b5862'); m.metalness = .3; m.side = THREE.DoubleSide; m.depthWrite = false; m.alphaTest = .02; return m; })();
    const mesh = kit.mesh(door, new THREE.PlaneGeometry(548, 1860), I.perf, [286, 1015, 0]); mesh.castShadow = false; mesh.renderOrder = 1;
    // Equipment on the 19-inch rails, U1 at y 100: chassis bodies plus printed
    // fronts (drive bays, vents, ports) with the LED field on the indicators.
    let u = 0; const plan = RACK_PLAN[n % 3];
    for (const [units, kind] of plan) {
        if (u + units > 42) break;
        const y = 100 + (u + units / 2) * U, h = units * U - 2, z = 440, top = y + h / 2;
        if (kind === 'blank') for (let b = 0; b < units; b++) frontPlate(K, 'blank', 1, [0, 100 + (u + b + .5) * U, z + 9.5]);
        else if (kind === 'mgr') { K.powder.box([482, h, 50], [0, y, z + 8], '#14191c'); for (let f = 0; f < 10; f++) K.powder.box([12, h - 6, 30], [-210 + f * 46, y, z + 40], '#20272b'); }
        else {
            const key = kind === 'srv' ? 'srv' : kind, depth = { ups: 40, sw: 30, patch: 22, kvm: 24 }[kind] || 36;
            K.powder.box([440, h, depth], [0, y, z - (kind === 'patch' ? -4 : 0)], '#2a3237');
            frontPlate(K, key, units, [0, y, z + depth / 2 + (kind === 'patch' ? 4.6 : .6)]);
            for (const [lx, ly, col, lw = 8, lh = 8] of frontLeds(key, units, n * 97 + u * 13)) leds.box([lw, lh, 1.5], [-241 + lx, top - ly, z + depth / 2 + 1.8 + (kind === 'patch' ? 4 : 0)], col);
            // Pull handles on servers and storage shelves.
            if (kind === 'srv' || kind === 'stor') for (const s of [-1, 1]) { K.brushed.box([8, Math.min(h - 12, 70), 8], [s * 229, y, z + depth / 2 + 14], '#aab4b9'); for (const e of [-1, 1]) K.brushed.box([8, 8, 12], [s * 229, y + e * (Math.min(h - 12, 70) / 2 - 4), z + depth / 2 + 7], '#aab4b9'); }
        }
        // Patch cords: from every second jack down into the managers, looping to the side.
        if (kind === 'patch') {
            const cols = ['#3c7fc4', '#e0b45e', '#4f9a6a', '#d06a5a', '#e8ebe8'];
            for (let p = 0; p < 12; p++) {
                const px = -241 + portX(p * 2), side = px < 0 ? -1 : 1, y0 = top - 18, zf = z + 26;
                const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(px, y0, zf), new THREE.Vector3(px, y0 - 12, zf + 22), new THREE.Vector3(px + side * 30, y0 - 38, zf + 28), new THREE.Vector3(side * 236, y0 - 58 - (p % 4) * 14, zf + 6)]);
                cords.add(new THREE.TubeGeometry(curve, 10, 3, 5, false), [0, 0, 0], cols[(p + n) % cols.length]);
                cords.box([7, 10, 14], [px, y0, zf - 5], '#d9dedf');
            }
        }
        u += units;
    }
    // Vertical cable bundles in the side channels with hook-and-loop ties.
    for (const s of [-1, 1]) { for (let b = 0; b < 3; b++) cords.cyl(7, 7, 1700, [s * (262 - b * 6), 1000, 380 - b * 18], ['#3c7fc4', '#e0b45e', '#4f9a6a'][b]); for (let v = 0; v < 8; v++) cords.box([30, 14, 50], [s * 256, 260 + v * 210, 362], '#14191c'); }
    // Drops from the overhead ladder through the roof brush strips.
    for (const bx of [-140, 140]) for (let b = 0; b < 3; b++) cords.cyl(9, 9, 300, [bx - 20 + b * 20, 2150, -300 + (b % 2) * 14], ['#3c7fc4', '#8a949a', '#e0b45e'][b]);
    // Top-of-rack cable ladder on two brackets (y ≈ 2300), continuous across the bayed row.
    for (const s of [-1, 1]) { K.brushed.box([20, 290, 20], [s * 200, 2135, -150], '#8d979c'); K.brushed.box([600, 50, 8], [0, 2300, -150 + s * 150], '#a3acb0'); }
    for (let r = 0; r < 4; r++) K.brushed.box([24, 12, 300], [-225 + r * 150, 2282, -150], '#a3acb0');
    K.build(rack, I.C);
    const ledMesh = leds.build(rack, I.rackLeds ||= I.ledMat([.95, .95, 1.1, 1.6, 1.05])); if (ledMesh) { ledMesh.castShadow = false; ledMesh.name = 'Rack status LEDs'; }
    cords.build(rack, I.C.cable);
    return { rack, door };
}
// Cable bundles lying in the ladder along x (one run across the whole row).
function ladderCables(kit, I, x0, x1, z, y = 2300) {
    const k = detailKit(); const len = x1 - x0;
    for (let b = 0; b < 5; b++) k.add(new THREE.CylinderGeometry(12, 12, len, 10), [(x0 + x1) / 2, y + 22 + (b % 2) * 16, z - 80 + b * 34], ['#3c7fc4', '#e0b45e', '#3c7fc4', '#8a949a', '#4f9a6a'][b], [1, 1, 1], [0, 0, Math.PI / 2]);
    for (let x = x0 + 300; x < x1; x += 600) k.box([24, 70, 190], [x, y + 32, z - 12], '#14191c');
    return k;
}

// Laptop staging cart (pushable): chrome posts, powder-coated decks, rubber
// casters, a slotted top tray with laptops on edge (half loaded / full per
// daypart), a push handle with a rubber grip, asset label and boxed devices.
function stagingCart(kit, I, id, [x, z], n) {
    const g = kit.asset(id, 'Laptop staging tool-cart', [x, 0, z]);
    const K = ck(), steel = '#c3c9cd';
    for (const sx of [-320, 320]) for (const sz of [-210, 210]) {
        K.rubber.add(new THREE.CylinderGeometry(38, 38, 26, 18), [sx, 40, sz], '#22292d', [1, 1, 1], [0, 0, Math.PI / 2]); K.brushed.box([34, 22, 60], [sx, 82, sz], '#8f999f');
        K.brushed.box([8, 50, 50], [sx - 18, 52, sz], '#8f999f'); K.chrome.cyl(11, 11, 860, [sx, 520, sz], steel);
    }
    for (const y of [180, 520]) { K.powder.box([700, 22, 460], [0, y, 0], '#c7ced2'); K.powder.box([700, 40, 6], [0, y + 20, 230], '#aab3b8'); K.powder.box([700, 40, 6], [0, y + 20, -230], '#aab3b8'); }
    K.powder.box([700, 26, 460], [0, 920, 0], '#3a464d');
    for (let s = 0; s < 9; s++) K.powder.box([5, 120, 420], [-320 + s * 80, 990, 0], '#56626a');
    K.chrome.box([700, 12, 10], [0, 1050, -225], steel); K.chrome.box([700, 12, 10], [0, 1050, 225], steel);
    for (const sz of [-180, 180]) K.chrome.box([18, 140, 18], [380, 980, sz], steel); K.rubber.add(new THREE.CylinderGeometry(16, 16, 380, 14), [392, 1060, 0], '#1f2629', [1, 1, 1], [Math.PI / 2, 0, 0]);
    // Bumper corners, asset label, cart number.
    for (const sx of [-352, 352]) for (const sz of [-232, 232]) K.rubber.box([16, 40, 16], [sx, 920, sz], '#1f2629');
    tag(K, ASSET_TAGS[n % 6], [150, 75], [-160, 860, 241]); tag(K, ['SITE 03', 'SITE 05', 'IMAGED', 'SPARES'][n % 4], [150, 75], [130, 860, 241]);
    // Boxed devices (taped, labelled) and a device tote on the shelves.
    for (let b = 0; b < 3; b++) { const bx = -220 + b * 220; K.card.box([200, 120, 300], [bx, 251, -20], ['#b99067', '#c49d74', '#b38b62'][b]); K.box([56, 2, 302], [bx, 312, -20], '#d2b98d'); tag(K, b ? 'IMAGED' : 'FRAGILE', [110, 55], [bx, 255, 131]); }
    K.poly.box([300, 110, 260], [-150, 586, 0], BLUE); K.poly.box([280, 6, 240], [-150, 642, 0], '#3a6b93'); K.card.box([260, 90, 200], [200, 576, 0], '#c49d74'); K.box([60, 2, 202], [200, 622, 0], '#d2b98d');
    K.build(g, I.C);
    // Laptops on edge in the slots: half loaded (checks), full (deployment).
    const laptops = (count, phases) => {
        const L = ck();
        for (let s = 0; s < count; s++) { const lx = -280 + s * 80, col = s % 3 ? '#5b656c' : '#3a444b'; L.alu.box([22, 230, 330], [lx, 1048, 0], col); L.box([23, 226, 2], [lx, 1048, 165], '#1d2328'); tag(L, ASSET_TAGS[(s + n) % 6], [70, 35], [lx + 11.6, 1120, 110], [0, Math.PI / 2, 0]); }
        const grp = new THREE.Group(); grp.name = 'Cart laptops'; g.add(grp); L.build(grp, I.C); I.show(grp, phases);
    };
    laptops(4 + (n % 2), [0, 1, 2]); laptops(8, [4]); laptops(2 + n % 3, [3]);
    return g;
}

// Wire parts shelving (the shell's `storage` asset, re-built in place):
// 1500 × 500 × 1800, five chrome wire tiers on split-sleeve collars, with
// truss wires and levelling feet; dressed in dressShelving().
function partsShelving(kit, I) {
    const t = kit.itTier, g = kit.byId('storage'); if (!g) return;
    for (const child of [...g.children]) { child.geometry?.dispose(); g.remove(child); }
    g.name = 'Parts shelving'; g.userData.sceneAssetName = 'Parts shelving';
    g.position.set(t.shelving[0], 0, t.shelving[1]); g.rotation.y = -Math.PI / 2;
    const K = ck(), chrome = '#c9cfd3';
    for (const sx of [-735, 735]) for (const sz of [-235, 235]) {
        K.chrome.cyl(12.5, 12.5, 1790, [sx, 905, sz], chrome); K.rubber.cyl(15, 17, 14, [sx, 7, sz], '#2b3338');
        for (let p = 0; p < 36; p++) K.chrome.cyl(13.2, 13.2, 3, [sx, 20 + p * 50, sz], '#aeb5b9');   // post grooves
    }
    for (const y of [140, 520, 900, 1280, 1660]) {
        for (const sz of [240, -240]) { K.chrome.box([1500, 14, 6], [0, y + 4, sz], chrome); K.chrome.box([1500, 6, 6], [0, y - 18, sz], chrome); for (let r = 0; r < 25; r++) K.chrome.box([4, 30, 4], [-720 + r * 60, y - 7, sz], chrome, [0, 0, r % 2 ? .55 : -.55]); }
        for (let r = 0; r < 26; r++) K.chrome.box([4, 4, 480], [-725 + r * 58, y + 4, 0], '#bfc6ca');
        for (let r = 0; r < 5; r++) K.chrome.box([1470, 3, 3], [0, y + 7, -200 + r * 100], '#bfc6ca');
        for (const sx of [-735, 735]) for (const sz of [-235, 235]) K.chrome.cyl(19, 14, 34, [sx, y - 10, sz], '#d7dcdf');   // split-sleeve collars
    }
    tag(K, 'SHELF A', [110, 55], [-660, 1700, 250]);
    K.build(g, I.C);
}
// Open-front stacking bins (three colours, labelled, contents visible), boxed
// SSDs and devices, cable reels, static-shielding bags and a pothos.
function dressShelving(g, kit, I) {
    const K = ck(), cols = [BLUE, '#e0b45e', '#6aa56a'];
    for (const [y, row] of [[907, 0], [1287, 1], [1667, 2]]) for (let b = 0; b < 5; b++) {
        const x = -580 + b * 290, c = cols[(b + row) % 3], z = 20;
        // Shell: floor, back, two hopper sides (tall rear, low front) and a front lip with a label window.
        K.poly.box([250, 6, 380], [x, y + 3, z], c); K.poly.box([250, 150, 6], [x, y + 75, z - 187], c);
        for (const s of [-1, 1]) { K.poly.box([6, 150, 200], [x + s * 122, y + 75, z - 90], c); K.poly.box([6, 80, 180], [x + s * 122, y + 40, z + 100], c); K.poly.box([6, 70, 60], [x + s * 122, y + 105, z + 30], c, [-.75, 0, 0]); }
        K.poly.box([250, 80, 6], [x, y + 40, z + 187], c); K.poly.box([250, 6, 30], [x, y + 80, z + 175], c);
        tag(K, BIN_NAMES[(row * 5 + b) % 16], [110, 55], [x, y + 46, z + 191]);
        // Contents: boxed drives, RAM sticks, adapters or cable loops.
        const kind = (row * 5 + b) % 4;
        for (let p = 0; p < 4; p++) {
            const px = x - 70 + (p % 2) * 120, pz = z - 60 + Math.floor(p / 2) * 90;
            if (kind === 0) K.card.box([90, 26, 110], [px, y + 20 + (p % 2) * 26, pz], '#e8ebe8');
            else if (kind === 1) K.box([110, 4, 30], [px, y + 18 + p * 5, pz], '#2f6f4e', [0, .2 * p, 0]);
            else if (kind === 2) { K.box([70, 30, 50], [px, y + 21, pz], '#2b3338'); K.cable.cyl(4, 4, 80, [px + 30, y + 10, pz], '#2b3338'); }
            else K.cable.add(new THREE.TorusGeometry(50, 6, 6, 18), [px, y + 14 + p * 6, pz], ['#3c7fc4', '#e8ebe8', '#e0b45e', '#2b3338'][p], [1, 1, 1], [Math.PI / 2, 0, p]);
        }
    }
    // Tier 2: boxed SSDs and devices, taped and labelled.
    for (let b = 0; b < 6; b++) {
        const h = 110 + (b % 2) * 40, x = -600 + b * 240, y = 527 + h / 2 + (b % 2) * 20 - 20, light = b === 2 || b === 4;
        K.card.box([200, h, 300], [x, y, 0], ['#b99067', '#c49d74', '#e6e8e6', '#b38b62', '#dfe3e5', '#b99067'][b]);
        if (!light) K.box([50, 2, 302], [x, y + h / 2 + 1, 0], '#d2b98d'); else K.box([200, 2, 60], [x, y + h / 2 + 1, -90], '#467eaa');
        tag(K, ['SPARES', 'RETURNS', 'IMAGED', 'SITE 03', 'SITE 05', 'FRAGILE'][b], [110, 55], [x, y, 151]);
    }
    // Static-shielding bags (silver) on the top tier.
    for (let b = 0; b < 4; b++) K.foil.box([160, 8, 220], [460 + (b % 2) * 30, 1675 + 160 + b * 9, -60 + b * 10], '#b9c0c4', [0, .1 * b, 0]);
    // Cable reels: dark flanges, wound core, a tail.
    for (let s = 0; s < 3; s++) {
        const x = -520 + s * 380;
        for (const fz of [-90, 90]) K.poly.add(new THREE.CylinderGeometry(150, 150, 16, 28), [x, 297, fz], '#2b3338', [1, 1, 1], [Math.PI / 2, 0, 0]);
        K.coil.add(new THREE.CylinderGeometry(124, 124, 164, 28, 1, true), [x, 297, 0], ['#3c7fc4', '#e0b45e', '#8a949a'][s], [1, 1, 1], [Math.PI / 2, 0, 0]);
        K.cable.add(new THREE.TorusGeometry(80, 5, 6, 14, 1.6), [x + 60, 210, 120], ['#3c7fc4', '#e0b45e', '#8a949a'][s], [1, 1, 1], [0, 0, -.6]);
    }
    // Pothos on top, two vines trailing down the front of the shelving.
    plant(K.dress, 520, 1667, 0, .55);
    for (const [vx, len] of [[440, 9], [600, 6]]) for (let n = 0; n < len; n++) {
        const y = 1700 - n * 60, z = 250 + Math.sin(n * .9) * 12;
        K.box([5, 62, 5], [vx + Math.sin(n) * 10, y, z], '#4a6b3e'); K.ball(26, [vx + (n % 2 ? 22 : -22), y - 20, z + 8], n % 2 ? '#54795a' : '#3f6a4b', [1, .35, .75], [.5, n, n % 2 ? .6 : -.6]);
    }
    K.build(g, I.C);
}

// Laptop charging locker (M/L): 900 × 450 × 1200, 16 perforated doors with
// numbered labels, key locks and status LEDs, cable gland and plinth.
function chargingLocker(kit, I) {
    const t = kit.itTier; if (!t.locker) return;
    const g = kit.asset('charging-locker', 'Laptop charging locker', [t.locker[0], 0, t.locker[1]]);
    const K = ck(), leds = detailKit();
    K.powder.box([900, 1140, 450], [0, 630, 0], '#d5dade'); K.powder.box([880, 60, 430], [0, 30, 0], '#2b3338'); K.powder.box([910, 20, 460], [0, 1210, 0], '#c4cace');
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
        const x = -330 + q * 220, y = 180 + r * 240, slot = r * 4 + q;
        K.powder.box([210, 232, 10], [x, y + 110, 229], '#cfd5d9');
        K.vent.box([170, 120, 2], [x, y + 140, 235], '#c2c9cd');
        K.brushed.add(new THREE.CylinderGeometry(9, 9, 10, 14), [x + 76, y + 40, 236], '#b8c1c6', [1, 1, 1], [Math.PI / 2, 0, 0]); K.box([3, 10, 2], [x + 76, y + 40, 241], '#2b3338');
        K.powder.box([10, 60, 14], [x - 98, y + 110, 236], '#9aa4a9');
        tag(K, String(slot + 1).padStart(2, '0'), [56, 28], [x - 50, y + 40, 235]);
        leds.box([12, 12, 3], [x + 40, y + 40, 235], slot % 5 === 2 ? AMBER_LED : GREEN_LED);
        // Scuffs at hand height on the most used doors.
        if (slot % 3 === 0) K.box([40, 26, 1], [x + 60, y + 80, 234.6], '#bfc6ca');
    }
    K.poly.box([600, 90, 4], [0, 1150, 228], BLUE);
    K.rubber.cyl(22, 22, 20, [380, 1220, -180], '#2b3338'); K.cable.cyl(8, 8, 1180, [380, 620, -232], '#2b3338');
    K.build(g, I.C);
    const m = leds.build(g, I.ledMat([.6, .6, .8, 1.3, .9])); if (m) m.castShadow = false;
    const label = I.panel(g, 560, 70, signText([['CHARGE & LOAN · 16 BAYS', .5, .52]]), { res: 1024, at: [0, 1150, 231] }); label.name = 'Locker label';
}
// Secure parts cage (L): welded mesh partition with a locked door along the +x wall.
function partsCage(kit, I) {
    if (kit.itTier.i !== 2) return;
    const t = kit.itTier, z0 = -1600, z1 = 200, x = t.w / 2 - 330;
    const g = kit.asset('parts-cage', 'Secure parts cage', [x, 0, (z0 + z1) / 2]);
    const K = ck(), len = z1 - z0;
    for (const dz of [-len / 2, -len / 6, len / 6, len / 2]) { K.powder.box([40, 2000, 40], [0, 1000, dz], '#4d585f'); K.brushed.box([90, 6, 90], [0, 3, dz], '#8f999f'); }
    K.powder.box([40, 40, len], [0, 1990, 0], '#4d585f'); K.powder.box([40, 40, len], [0, 80, 0], '#4d585f');
    for (const sz of [-1, 1]) K.powder.box([300, 40, 40], [150, 1990, sz * len / 2], '#4d585f');
    K.brushed.box([16, 90, 50], [-24, 1050, len / 6 - 60], '#c3c9cd'); K.brushed.box([30, 50, 34], [-40, 990, len / 6 - 60], '#b9a46a'); K.brushed.add(new THREE.TorusGeometry(14, 4, 6, 12, Math.PI), [-40, 1020, len / 6 - 60], '#c3c9cd', [1, 1, 1], [0, Math.PI / 2, 0]);
    tag(K, 'CAGE 01', [120, 60], [-22, 1300, len / 6 - 60], [0, -Math.PI / 2, 0]);
    // Contents seen through the mesh: boxed spares and a stack of switches.
    for (let b = 0; b < 6; b++) { const bz = -500 + Math.floor(b / 3) * 560, by = 80 + 160 * (b % 3) + 80; K.card.box([240, 160, 300], [170, by, bz], ['#b99067', '#c49d74', '#b38b62'][b % 3]); K.box([242, 2, 50], [170, by + 81, bz], '#d2b98d'); }
    for (let b = 0; b < 4; b++) { K.powder.box([260, 44, 300], [170, 120 + b * 48, 450], '#2a3136'); K.box([2, 30, 260], [39, 120 + b * 48, 450], '#1a1f23'); }
    K.build(g, I.C);
    const mesh = I.tex(c => { c.clearRect(0, 0, 64, 64); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke(); }, 64, 64, { surface: null, transparent: true, repeat: [len / 60, 1900 / 60] });
    mesh.color.set('#5a666d'); mesh.metalness = .4; mesh.roughness = .45; mesh.side = THREE.DoubleSide; mesh.depthWrite = false; mesh.alphaTest = .2;
    const p = kit.mesh(g, new THREE.PlaneGeometry(len, 1900), mesh, [0, 1030, 0]); p.rotation.y = Math.PI / 2; p.castShadow = false;
}
// HPL top: box-project the table top and add a dark ABS edge band.
function hplTop(kit, I, table, w, d, h, edge = '#3a444b') {
    const top = table.children.find(o => o.isMesh); if (!top) return;
    top.material = I.C.hplTop; uvBox(top.geometry, 420, 420);
    const K = ck(); for (const s of [-1, 1]) { K.box([w + 4, 33, 2], [0, h - 17.5, s * (d / 2 + 1)], edge); K.box([2, 33, d + 4], [s * (w / 2 + 1), h - 17.5, 0], edge); }
    K.build(table, I.C);
}
// Packing and dispatch bench (L) and e-waste / recycling bins (L).
function largeExtras(kit, I) {
    if (kit.itTier.i !== 2) return;
    const bench = kit.table('packing-bench', 'Packing and dispatch bench', [-1000, 0, 2000], 1400, 700, 900, I.C.hplTop);
    hplTop(kit, I, bench, 1400, 700, 900);
    const K = ck();
    K.powder.box([1300, 18, 600], [0, 260, 0], '#9aa5ab');
    for (let b = 0; b < 3; b++) { K.card.box([360, 220, 300], [-400 + b * 400, 380, 0], ['#b99067', '#c49d74', '#b38b62'][b]); K.box([60, 2, 302], [-400 + b * 400, 491, 0], '#d2b98d'); }
    // Open box being packed, tape dispenser, label printer, a reel of labels, foam rolls.
    K.card.box([420, 160, 320], [-300, 980, -40], '#c49d74'); for (const s of [-1, 1]) K.card.box([420, 4, 150], [-300, 1062, -40 + s * 230], '#c49d74', [s * .9, 0, 0]);
    K.foil.box([300, 30, 240], [-300, 1050, -40], '#b9c0c4');
    K.powder.box([200, 120, 150], [250, 960, -150], '#2b3338'); tag(K, 'IT-04150', [110, 55], [250, 950, -74]);
    K.box([120, 4, 80], [250, 1022, -90], '#f7f7f2');
    K.cable.cyl(60, 60, 70, [450, 935, 120], '#c8b98a'); K.box([300, 2, 220], [100, 902, 160], '#f0f2f0');
    for (let r = 0; r < 3; r++) K.poly.cyl(55, 55, 100, [-560, 950, 180 - r * 130], '#eef0ee');
    K.build(bench, I.C);
    // Wheeled recycling containers with lids, posting slots and pictogram labels.
    const bins = kit.asset('ewaste-bins', 'E-waste and recycling bins', [500, 0, 6950]); bins.rotation.y = Math.PI;
    const B = ck();
    ['#3f6a4b', BLUE, '#d59a3a'].forEach((c, n) => {
        const x = -360 + n * 360;
        B.poly.box([330, 760, 440], [x, 430, 0], c); B.poly.box([300, 40, 420], [x, 30, 0], c);
        B.poly.box([346, 40, 470], [x, 830, 0], '#2b3338'); B.poly.box([346, 30, 40], [x, 815, 240], '#2b3338');
        B.box([200, 6, 60], [x, 851, 60], '#0e1214'); B.poly.box([240, 14, 20], [x, 852, 100], '#3a444b');
        for (const s of [-1, 1]) { B.rubber.add(new THREE.CylinderGeometry(45, 45, 30, 16), [x + s * 120, 45, -190], '#1d2328', [1, 1, 1], [0, 0, Math.PI / 2]); }
        B.box([300, 4, 4], [x, 800, 222], '#00000020');
        tag(B, ['E-WASTE', 'BATTERIES', 'CABLES'][n], [260, 130], [x, 620, 221]);
    });
    B.build(bins, I.C);
}

// ---- Furnish -------------------------------------------------------------
export function furnish(kit) {
    const I = itKit(kit), t = kit.itTier = tierOf(kit.layout);
    const racks = [];
    for (let n = 0; n < t.racks; n++) racks.push(buildRack(kit, I, n, t.rackX0 + 300 + n * 600));
    kit.itRacks = racks;
    // Maintenance: rack 1's front door stands open with a cable tester hanging off it.
    // The open door lives in an overlay that follows the rack (I.follow), so the
    // rack's bounds and collider do not change with the daypart.
    const open = racks[1].door, openDoor = open.clone(); openDoor.name = 'Rack front door open';
    openDoor.rotation.y = -1.75; racks[1].rack.add(openDoor);
    const tester = detailKit(); tester.box([80, 150, 30], [520, 1150, 30], YELLOW); tester.box([60, 50, 4], [520, 1185, 47], '#1d3a2a'); tester.cyl(3, 3, 300, [520, 1000, 30], '#2b3338'); I.build(tester, openDoor);
    I.show(open, [0, 1, 3, 4]); I.show(I.follow(racks[1].rack, openDoor), [2]);
    // Rack 2: one amber unit LED (evening maintenance onwards).
    const amber = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 3), I.glow(AMBER_LED, [0, 0, 2.2, 2.6, 0], { base: '#3a2a10' }));
    amber.position.set(-120, 1200, 482); amber.castShadow = false; (racks[2] || racks[1]).rack.add(amber); I.show(amber, [2, 3]);
    // Ladder cables along the whole row and an overhead run to the door wall.
    const row = new THREE.Group(); row.name = 'Overhead cable ladder'; kit.root.add(row);
    const lk = ladderCables(kit, I, t.rackX0, t.rackX1, t.rackZ - 150); lk.build(row, I.C.cable);
    const RK = ck(), run = RK.brushed, runZ = t.rackZ - 150, y = 2300, x0 = t.rackX1, x1 = t.w / 2 - 40;
    for (const s of [-1, 1]) run.box([x1 - x0, 50, 8], [(x0 + x1) / 2, y, runZ + s * 150], '#a3acb0');
    for (let x = x0 + 75; x < x1; x += 150) run.box([24, 12, 300], [x, y - 18, runZ], '#a3acb0');
    for (let x = x0 + 400; x < x1 - 100; x += 1200) for (const s of [-1, 1]) run.cyl(5, 5, kit.ceiling - y, [x, (y + kit.ceiling) / 2, runZ + s * 140], '#59656c');
    run.box([60, 300, 380], [x1 - 20, y + 150, runZ], '#a3acb0');
    // The ceiling-hung run (hangers, the run to the door wall and the riser) joins
    // the shell's ceiling group on the first atmosphere() call, so it hides with
    // the camera cutaway; the ladder sections on the racks stay visible.
    const overhead = new THREE.Group(); overhead.name = 'Overhead cable ladder run'; kit.root.add(overhead); I.ceilingItems = [overhead];
    RK.build(overhead, I.C);
    const rc = ladderCables(kit, I, x0, x1 - 40, runZ); rc.build(overhead, I.C.cable);
    // Cables rise from the ladder at the row end into a ceiling penetration.
    const rise = detailKit(); for (let b = 0; b < 4; b++) rise.cyl(12, 12, kit.ceiling - y, [t.rackX0 + 60 + b * 30, (y + kit.ceiling) / 2, runZ - 40], ['#3c7fc4', '#e0b45e', '#8a949a', '#4f9a6a'][b]); rise.build(overhead, I.C.cable);
    for (const g of [row, overhead]) g.traverse(o => { o.castShadow = false; });

    t.carts.forEach((at, n) => stagingCart(kit, I, `diagnostic-cart-${n}`, at, n));
    // Deployment briefing table: light grey HPL top with a graphite edge band.
    const brief = kit.byId('activity-table'); if (brief) { hplTop(kit, I, brief, 1300, 650, 740); for (const o of brief.children) if (o.isMesh && o.material === kit.metal) o.material = I.M('#8f999f', 'metal', { metalness: .6, roughness: .35 }); }
    partsShelving(kit, I); chargingLocker(kit, I); partsCage(kit, I); largeExtras(kit, I);
}
export function dressProp(id, k, g, kit) {
    if (id === 'storage') dressShelving(g, kit, itKit(kit));
}

// ---- Decorate: walls, floor markings, window -----------------------------
function wallStory(kit, I) {
    const t = kit.itTier, { w, bz, ceiling } = kit, i = t.i;
    // Dark rack wall behind the row (full height, between baseboard and upper rail).
    const zoneW = t.rackX1 - t.rackX0 + 1600, zoneX = (t.rackX0 + t.rackX1) / 2;
    const dark = kit.mesh(kit.back, new THREE.BoxGeometry(zoneW, ceiling - 150, 4), I.M('#26323b', 'plaster', { roughness: .85 }), [zoneX, (ceiling - 150) / 2, bz + 21]); dark.castShadow = false; dark.name = 'Rack wall paint';
    // Room sign over the rack row: FIELD SERVICES · DEPOT.
    const sign = kit.byId('room-sign');
    if (sign) {
        sign.position.set(zoneX, Math.min(ceiling - 330, 2700), bz + 50);
        const plane = sign.children.find(o => o.material?.map), SW = Math.min(zoneW - 600, 2400);
        if (plane) {
            plane.geometry.dispose(); plane.geometry = new THREE.PlaneGeometry(SW, 300);
            plane.material.map.dispose(); plane.material.map = institutionalMap((c, W, H) => {
                reset(c); c.fillStyle = '#1a2a33'; c.fillRect(0, 0, W, H); c.fillStyle = BLUE; c.fillRect(0, 0, H * .09, H);
                c.textBaseline = 'middle'; text(c, 'FIELD SERVICES', W * .055, H * .54, H * .4, '#eef4f7', { weight: '700', spacing: H * .03 });
                c.font = `700 ${H * .4}px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = `${H * .03}px`; const tw = c.measureText('FIELD SERVICES').width; reset(c); c.textBaseline = 'middle';
                c.fillStyle = BLUE; c.fillRect(W * .055 + tw + H * .2, H * .3, 3, H * .48);
                text(c, 'DEPOT', W * .055 + tw + H * .42, H * .54, H * .4, '#8fb6d4', { weight: '400', spacing: H * .03 }); reset(c);
            }, 2048, Math.round(2048 * 300 / SW)); plane.material.map.anisotropy = 4; plane.material.needsUpdate = true;
            const K = ck(); for (const sx of [-SW / 2 + 60, SW / 2 - 60]) for (const sy of [-100, 100]) K.brushed.add(new THREE.CylinderGeometry(14, 14, 30, 16), [sx, sy, -12], '#c3c9cd', [1, 1, 1], [Math.PI / 2, 0, 0]); K.build(sign, I.C);
        }
        const strip = new THREE.Mesh(new THREE.BoxGeometry(SW, 8, 8), I.glow(BLUE_LED, [.3, .3, .8, 1.1, .9], { base: '#1d3346' })); strip.position.set(0, -158, 6); strip.castShadow = false; sign.add(strip);
    }
    // Rack elevation poster left of the racks; topology mural behind the main desk.
    const poster = I.wall('back', 'rack-elevation', 'Wall rack elevation diagram', t.rackX0 - 450, 1450, 20);
    I.panel(poster, 560, 1000, drawElevation, { frame: '#2b3338', border: 16, res: 768 });
    const muralX0 = -w / 2 + 120, muralX1 = Math.min(t.rackX0 - 800, kit.layout.desk[0] + 1300), muralW = muralX1 - muralX0;
    const mural = I.wall('back', 'identity-gallery', 'Wall network topology mural', (muralX0 + muralX1) / 2, 1750, 12);
    I.panel(mural, muralW, 800, drawMural, { res: 1536, rough: .9 });
    // Fire extinguisher (CO2, black band) on a bracket by the rack row, with its sign.
    const ext = I.wall('back', 'fire-extinguisher', 'Wall fire extinguisher', t.rackX1 + 260, 520, 160);
    const EK = ck(); EK.poly.cyl(70, 70, 560, [0, 0, 0], '#c42f24'); EK.poly.ball(70, [0, 280, 0], '#c42f24', [1, .35, 1]); EK.poly.cyl(70.5, 70.5, 60, [0, 200, 0], '#17191b');
    EK.brushed.cyl(26, 34, 60, [0, 330, 0], '#b9c1c5'); EK.powder.box([150, 24, 34], [40, 365, 0], '#2b3338'); EK.powder.box([120, 14, 30], [30, 392, 0], '#2b3338', [0, 0, .25]); EK.brushed.cyl(5, 5, 40, [-20, 372, 22], '#d9b23b');
    EK.rubber.add(new THREE.CylinderGeometry(14, 14, 300, 10), [96, 230, 16], '#17191b', [1, 1, 1], [0, 0, .12]); EK.rubber.cyl(30, 18, 90, [104, 60, 20], '#17191b');
    EK.powder.box([180, 70, 40], [0, -110, -60], '#59656c'); EK.powder.box([40, 300, 20], [0, 60, -72], '#59656c'); tag(EK, 'IT-04185', [70, 35], [0, -40, 71]);
    EK.build(ext, I.C);
    I.panel(ext, 200, 260, (c, W, H) => { reset(c); c.fillStyle = '#c42f24'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.fillRect(W * .06, W * .06, W * .88, H - W * .12); c.fillStyle = '#c42f24'; c.fillRect(W * .1, W * .1, W * .8, H * .55); c.textBaseline = 'middle'; text(c, 'CO₂', W / 2, H * .3, H * .2, '#ffffff', { align: 'center', weight: '700' }); text(c, 'FIRE', W / 2, H * .5, H * .1, '#ffffff', { align: 'center', weight: '700', spacing: 4 }); c.fillStyle = '#1d1f21'; c.fillRect(W * .1, H * .7, W * .8, H * .2); text(c, 'ELECTRICAL', W / 2, H * .8, H * .075, '#ffffff', { align: 'center', weight: '700', spacing: 2 }); }, { res: 512, at: [0, 740, -78] });
    // Door bay (+x wall, between the door and the front): queue screen and after-hours drop-box.
    const bayZ = (t.front - 1090 + t.front) / 2;
    const queue = I.wall('right', 'queue-display', 'Tech bar queue display', bayZ, 1720, 40);
    kit.monitor(queue, [0, -200, 0], 900, 3, true);
    const drop = I.wall('right', 'device-drop-box', 'After-hours device drop-box', bayZ, 1000, 260);
    const DB = ck(); DB.powder.box([520, 640, 260], [0, 0, 0], '#4f5b62'); DB.powder.box([440, 70, 40], [0, 175, 140], '#3d474e', [-.35, 0, 0]); DB.box([400, 18, 4], [0, 168, 158], '#0d1113', [-.35, 0, 0]);
    DB.brushed.add(new THREE.CylinderGeometry(14, 14, 12, 16), [180, -140, 134], '#c3c9cd', [1, 1, 1], [Math.PI / 2, 0, 0]); DB.powder.box([470, 220, 4], [0, -170, 131], '#566269'); DB.vent.box([300, 100, 2], [-40, -170, 134], '#4a555c');
    DB.build(drop, I.C);
    I.panel(drop, 440, 110, signText([['DEVICE DROP-BOX', .36, .38], ['Returns and repairs after hours', .2, .74, '#d7e6f0', '500']], BLUE), { res: 1024, at: [0, 70, 131] });
    // Tech bar sign: the door-wall label becomes a backlit box (CLOSED after hours).
    const label = kit.right.children.find(o => o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters?.width === 1050 && o.material?.map);
    if (label) {
        label.geometry.dispose(); label.geometry = new THREE.PlaneGeometry(1400, 300); label.position.x = w / 2 - 68;
        label.material.map.dispose(); const map = label.material.map = institutionalMap(() => {}, 1536, 330); map.anisotropy = 4;
        label.material.emissive.set('#ffffff'); label.material.emissiveMap = map; label.material.emissiveIntensity = .35; label.material.needsUpdate = true; I.glows.push({ m: label.material, levels: [.32, .3, .45, .5, .45] });
        I.redraw(map, (c, W, H, p) => {
            const closed = p === 2 || p === 3;
            reset(c); c.fillStyle = closed ? '#2f4a5e' : BLUE; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff18'; c.fillRect(0, 0, W, H * .5);
            // Generic icon: a laptop with a spanner across the screen.
            c.save(); c.translate(H * .62, H * .5); c.strokeStyle = '#e8f1f7'; c.lineWidth = H * .045; c.lineJoin = 'round';
            c.strokeRect(-H * .26, -H * .24, H * .52, H * .34); c.beginPath(); c.moveTo(-H * .36, H * .18); c.lineTo(H * .36, H * .18); c.stroke();
            c.beginPath(); c.moveTo(-H * .12, H * .02); c.lineTo(H * .1, -H * .14); c.stroke(); c.beginPath(); c.arc(H * .13, -H * .16, H * .06, 0, TAU); c.stroke(); c.restore();
            c.textBaseline = 'middle';
            text(c, 'TECH BAR', H * 1.15, H * .38, H * .3, '#ffffff', { weight: '700', spacing: H * .025 });
            text(c, closed ? 'CLOSED · USE THE DROP-BOX' : 'DROP-OFF · LOANS · HELP', H * 1.17, H * .73, H * .14, '#d7e6f0', { weight: '600', spacing: H * .02 });
            c.fillStyle = '#e8f1f7'; c.fillRect(W - H * .5, H * .22, 3, H * .56); text(c, closed ? '08:00' : 'OPEN', W - H * .27, H * .5, H * .13, closed ? '#f5d29a' : '#bfe8cc', { align: 'center', weight: '700', spacing: 2 });
            reset(c);
        });
        const BX = ck(); BX.powder.box([60, 340, 1440], [w / 2 - 35, label.position.y, label.position.z], '#2b3338'); BX.brushed.box([62, 6, 1440], [w / 2 - 35, label.position.y - 172, label.position.z], '#aab3b8'); BX.build(kit.right, I.C);
    }
    // Planning board: a 2× canvas so the ticket and schedule type stays crisp.
    const boardPlane = kit.board?.children.find(o => o.material?.map);
    if (boardPlane) { const old = boardPlane.material.map; boardPlane.material.map = institutionalMap((c, W, H) => drawBoard(c, W, H, kit.spec, 0), 1536, 768); boardPlane.material.map.anisotropy = 4; boardPlane.material.needsUpdate = true; old.dispose(); }
    // Wall outlets (data + power) at desk positions, with patch leads to the floor.
    const OK = ck(), outlets = [[kit.layout.desk[0] + 650, 'back'], [t.rackX0 - 950, 'back'], ...(t.locker ? [[t.locker[0] + 600, 'back']] : [])];
    for (const [along] of outlets) {
        const z = bz + 36;
        OK.poly.box([170, 90, 10], [along, 420, z], '#eceeec'); for (const dx of [-45, 45]) OK.box([30, 26, 2], [along + dx, 425, z + 5.5], '#1d2328');
        tag(OK, 'DATA', [56, 18], [along - 45, 395, z + 5.6]); tag(OK, 'POWER', [56, 18], [along + 45, 395, z + 5.6]);
        OK.cable.cyl(3.5, 3.5, 400, [along - 45, 220, z + 12], '#3c7fc4'); OK.cable.cyl(4.5, 4.5, 400, [along + 45, 220, z + 12], '#1d2328');
    }
    OK.build(kit.back, I.C);
    // Window wall: acoustic panels move to the rear bay (behind the desk);
    // the service tools pegboard hangs in the front bay by the briefing table.
    const acoustic = kit.byId('acoustic-panels');
    if (acoustic) { acoustic.position.set(-w / 2 + 45, 1850, (bz + t.win[0]) / 2); acoustic.rotation.y = Math.PI / 2; kit.left.add(acoustic); }
    const tools = I.wall('left', 'diagnostic-wall', 'Wall service tools', (t.win[1] + t.front) / 2 + (i === 2 ? -300 : 0), 1650, 30);
    const k = ck(); k.powder.box([1300, 800, 18], [0, 0, 0], '#5f7479'); k.brushed.box([1316, 16, 26], [0, 408, 4], '#aab3b8'); k.brushed.box([1316, 16, 26], [0, -408, 4], '#aab3b8');
    for (let row = 0; row < 7; row++) for (let col = 0; col < 18; col++) k.box([8, 8, 2], [-600 + col * 70, -340 + row * 110, 9.5], '#22343a');
    // Shadow-board outlines, then screwdrivers, spudgers, pliers, crimper, tester, multimeter, cable loops.
    for (let n = 0; n < 7; n++) { k.box([26, 290, 1], [-540 + n * 60, 110, 9.6], '#e8ebe8'); k.poly.box([20, 150, 20], [-540 + n * 60, 170, 30], ['#c23a2e', '#e0b45e', BLUE, '#c23a2e', '#3f6a4b', '#e0b45e', '#2b3338'][n]); k.chrome.cyl(3.5, 3.5, 120, [-540 + n * 60, 40, 30], '#c3c9cd'); k.chrome.box([12, 30, 6], [-540 + n * 60, 270, 22], '#c3c9cd'); }
    for (let n = 0; n < 4; n++) { k.poly.box([14, 120, 10], [-90 + n * 45, 150, 30], n % 2 ? '#2b3338' : '#e8ebe8'); }
    k.poly.box([150, 230, 50], [170, 120, 40], YELLOW); k.box([110, 70, 4], [170, 180, 66], '#1d3a2a'); k.poly.cyl(30, 30, 10, [170, 80, 66], '#2b3338');
    k.poly.box([130, 200, 40], [380, 120, 36], '#d06a5a'); k.box([90, 60, 4], [380, 170, 57], '#cfd8d0');
    for (let n = 0; n < 3; n++) { k.cable.add(new THREE.TorusGeometry(90 - n * 10, 7, 6, 24), [-380 + n * 260, -230, 30], ['#3c7fc4', '#e0b45e', '#2b3338'][n]); k.chrome.box([10, 40, 30], [-380 + n * 260, -150 + n * 10, 18], '#c3c9cd'); }
    k.powder.box([200, 60, 120], [520, -230, 60], '#59656c'); k.brushed.box([150, 10, 10], [520, -195, 121], '#c3c9cd');
    k.build(tools, I.C);
    // Kit-check sign over the pegboard.
    I.panel(tools, 640, 96, signText([['SIGN OUT · SIGN IN', .46, .52]], '#2b3338'), { res: 1024, at: [0, 470, 10] });
}
function floorStory(kit, I) {
    const t = kit.itTier, { w } = kit, i = t.i;
    // Cold aisle (flat, never a collider) in front of the rack row.
    const aisle = [(t.rackX0 + t.rackX1) / 2, t.rackFront + 625], aisleSize = [t.rackX1 - t.rackX0 + 100, 1200];
    I.flat('cold-aisle', 'Cold aisle floor marking', aisle, aisleSize, coldAisleDraw(kit, aisle, aisleSize), { res: 1536, height: 3, surface: 'stone', roughness: .55 });
    // Rack LED field: a faint cool pool on the cold-aisle floor (after hours).
    I.pool(I.poolLayer, [(t.rackX0 + t.rackX1) / 2, 6, t.rackFront + 450], [t.rackX1 - t.rackX0 + 500, 1300], '#7fb6ff', [0, 0, .04, .12, .03]);
    // Deployment bay under the staging carts.
    const xs = t.carts.map(c => c[0]), zs = t.carts.map(c => c[1]);
    const bx0 = Math.min(...xs) - 450, bx1 = Math.max(...xs) + 450, bz0 = Math.min(...zs) - 380, bz1 = Math.max(...zs) + 480;
    I.flat('deployment-bay', 'Deployment bay floor marking', [(bx0 + bx1) / 2, (bz0 + bz1) / 2], [bx1 - bx0, bz1 - bz0], drawBay, { res: 1024, height: 2, transparent: true });
    // Anti-fatigue mats where people stand (imaging, tech bar staff side, rack console).
    for (const s of STATIONS[i]) {
        if (s.chair !== false) continue;
        const a = (s.turn || 0) * Math.PI / 180, off = 381 + 400, at = [s.at[0] + Math.sin(a) * off, s.at[1] + Math.cos(a) * off];
        const mat = I.flat(`mat-${s.id}`, 'Anti-fatigue mat', at, [s.size === '60x30' ? 1500 : 1200, 700], drawMat, { height: 12, turn: a, surface: 'rubber', roughness: .9 });
        // Bevelled safety edges (rubber ramps) on the long sides.
        const sx = s.size === '60x30' ? 1500 : 1200, MK = ck(); for (const e of [-1, 1]) { MK.rubber.box([sx, 3, 40], [0, 4, e * 362], YELLOW, [e * -.25, 0, 0]); MK.rubber.box([40, 3, 700], [e * (sx / 2 + 12), 4, 0], YELLOW, [0, 0, e * .25]); } MK.build(mat, I.C);
    }
    // Briefing area: carpet-tile inlay under the deployment briefing table.
    I.flat('briefing-zone', 'Briefing area carpet tile', t.activity, [2300, [1300, 1500, 1500][i]], drawBriefZone, { height: 4 });
    // Main desk ESD zone mat (keeps the shell's desk-zone-rug key).
    I.flat('desk-zone-rug', 'ESD floor mat', [kit.layout.desk[0], kit.layout.desk[1] + 250], [2000, 1900], drawDeskZone, { height: 6, surface: 'rubber', roughness: .85 });
    // Flow chevrons: blue = devices in (tech bar → repair / intake → imaging),
    // green = deployment out (imaging → carts → door).
    const FLOWS = [
        { blue: [[[300, 3100], [950, 2350]]], green: [[[700, 2350], [-1700, 2350]], [[-1500, 3150], [2350, 3150]]] },
        { blue: [[[950, 4750], [-1500, 4750]], [[-1600, 4350], [-1600, 3600]], [[-1500, 2200], [1800, 2200]]], green: [[[2300, 2350], [2300, 3500]], [[2500, 3800], [3300, 4500]]] },
        { blue: [[[1850, 6150], [1150, 5250]], [[250, 4750], [-2350, 4750]], [[-2250, 4000], [-2250, 3000]], [[-2000, 950], [900, 950]]], green: [[[2700, 1250], [3200, 1750]], [[3700, 3800], [3950, 5300]]] }
    ][i];
    const k = detailKit();
    const chevrons = (segs, color) => { for (const [[x0, z0], [x1, z1]] of segs) { const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / 600)); for (let s = 0; s <= n; s++) { const f = s / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; for (const side of [-1, 1]) { const ang = a + side * .7; k.box([70, 3, 300], [x - Math.sin(ang) * 130, 2, z - Math.cos(ang) * 130], color, [0, ang, 0]); } } } };
    chevrons(FLOWS.blue, BLUE); chevrons(FLOWS.green, '#4f9a6a');
    // Yellow/black tape keeps the door swing and the tech bar queue clear.
    const qx = STATIONS[i].find(s => s.role === 'techbar').at;
    for (let n = 0; n < 6; n++) k.box([60, 3, 380], [qx[0] + 700 + n * 120, 2, qx[1] - 900], n % 2 ? '#20262b' : YELLOW);
    I.build(k, I.decals);
    // "Please wait here" stencil on the visitor side of the tech bar.
    const wait = kit.mesh(I.decals, new THREE.PlaneGeometry(700, 220), I.tex((c, W, H) => { signText([['PLEASE WAIT HERE', .38, .55]], '#00000000', '#eef1ee')(c, W, H); c.globalCompositeOperation = 'destination-out'; for (let n = 0; n < 160; n++) { c.fillStyle = '#000000b0'; c.fillRect(rnd(n * 1.3) * W, H * .3 + rnd(n * 2.9) * H * .45, 2 + rnd(n) * 5, 2); } c.globalCompositeOperation = 'source-over'; }, 1024, 320, { surface: null, transparent: true }), [qx[0] + 1000, 3, qx[1] - 700]);
    wait.rotation.set(-Math.PI / 2, 0, Math.PI / 2); wait.castShadow = false; wait.material.depthWrite = false;
    // Wear: faint caster tracks and scuffs on the cart route from the bay to the door.
    const from = [(bx0 + bx1) / 2, (bz0 + bz1) / 2], to = [w / 2 - 700, t.door], len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const wear = kit.mesh(I.decals, new THREE.PlaneGeometry(900, len), I.tex((c, W, H) => {
        c.clearRect(0, 0, W, H);
        for (let n = 0; n < 9; n++) { const x = W * (.2 + rnd(n * 3) * .6); c.strokeStyle = n % 3 ? 'rgba(40,46,50,.10)' : 'rgba(255,255,255,.07)'; c.lineWidth = 2 + rnd(n) * 3; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (rnd(n + 1) - .5) * 60, H * .33, x + (rnd(n + 2) - .5) * 60, H * .66, x + (rnd(n + 4) - .5) * 40, H); c.stroke(); }
        for (let n = 0; n < 40; n++) { c.fillStyle = n % 2 ? 'rgba(35,40,44,.07)' : 'rgba(255,255,255,.05)'; c.beginPath(); c.ellipse(rnd(n * 5) * W, rnd(n * 7) * H, 6 + rnd(n) * 26, 2 + rnd(n * 2) * 6, rnd(n * 9) * 3, 0, TAU); c.fill(); }
    }, 256, 1024, { surface: null, transparent: true }), [(from[0] + to[0]) / 2, 1.5, (from[1] + to[1]) / 2]);
    wear.rotation.set(-Math.PI / 2, 0, Math.atan2(to[0] - from[0], to[1] - from[1]) + Math.PI); wear.material.depthWrite = false; wear.name = 'Floor wear';
    I.decals.traverse(o => { o.castShadow = false; o.raycast = noRay; });
}
function windowStory(kit, I) {
    const { d } = kit, span = d * .48;
    // Low-glare roller blinds, half drawn (the lighting pass may vary the drop per daypart).
    const k = detailKit();
    k.box([span + 40, 110, 110], [0, 830, 70], '#c9cfd3');
    const weave = I.tex((c, W, H) => { c.fillStyle = '#e4e6e1'; c.fillRect(0, 0, W, H); for (let n = 0; n < W; n += 4) { c.fillStyle = 'rgba(160,166,162,.35)'; c.fillRect(n, 0, 1.5, H); c.fillRect(0, n, W, 1.5); } }, 64, 64, { surface: null, roughness: .95, transparent: true, repeat: [(span - 30) / 24, 860 / 24] });
    weave.opacity = .84; weave.side = THREE.DoubleSide; weave.color.set('#dfe1dc');
    const blind = kit.mesh(kit.window, new THREE.PlaneGeometry(span - 30, 860), weave, [0, 400, 95]);
    blind.castShadow = false; blind.name = 'Roller blind';
    k.box([span - 30, 26, 22], [0, -40, 95], '#aab3b8');
    I.build(k, kit.window);
    // Returned laptops in a sorter on the sill, tagged for intake.
    const s = ck();
    for (let n = 0; n < 3; n++) { const z = -span * .3 + n * span * .22; s.powder.box([300, 16, 140], [z, -858, 80], '#7d888e'); for (let l = 0; l < 3; l++) { s.alu.box([300, 220, 20], [z, -740, 40 + l * 34], l % 2 ? '#9aa3a8' : '#5b656c'); s.box([290, 2, 21], [z, -631, 40 + l * 34], '#2b3338'); s.box([70, 26, 2], [z - 90, -660, 51 + l * 34], '#f2c230'); } tag(s, ASSET_TAGS[n], [80, 40], [z + 70, -700, 112]); }
    s.build(kit.window, I.C);
}
export function decorate(kit) {
    const I = itKit(kit);
    wallStory(kit, I); wallFinishes(kit, I); floorStory(kit, I); windowStory(kit, I); finishFloor(kit); installView(kit, I);
    // Party: two field backpacks by the door, ready to go out with the carts.
    const t = kit.itTier, bags = kit.asset('deployment-bags', 'Deployment kit bags', t.i ? [t.w / 2 - 650, 0, t.door - 1250] : [t.w / 2 - 600, 0, t.front - 350]);
    const b = ck();
    for (let n = 0; n < 2; n++) { const x = n * 260, c = n ? '#2e3a42' : '#3a4f3f'; b.rubber.box([300, 440, 190], [x, 230, 0], c); b.rubber.box([260, 160, 60], [x, 170, 120], c); b.rubber.box([300, 30, 200], [x, 460, -5], '#1d2328'); b.box([60, 30, 6], [x, 360, 98], YELLOW); b.cable.box([30, 300, 8], [x - 90, 260, -98], '#1d2328'); b.cable.box([30, 300, 8], [x + 90, 260, -98], '#1d2328'); tag(b, ASSET_TAGS[n + 3], [70, 35], [x + 60, 120, 96]); }
    b.build(bags, I.C); I.show(bags, [4]);
    kit.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m?.isMeshStandardMaterial) m.dithering = true; });
}
export function finishDecor() {}

// Briefing table, per daypart: rack checklist and site list; tickets; spares
// and a cable tester; a closed laptop and a mug; site map, device checklist
// and boxed laptops for the team deployment.
export function activityMaterials(k, phase, y) {
    const sheet = (x, z, w, d, r = 0, c = '#f2f2ec') => k.box([w, 2, d], [x, y + 1, z], c, [0, r, 0]);
    if (phase === 0) { k.box([230, 12, 330], [260, y + 6, 40], '#7d5f3f'); sheet(260, 50, 210, 290, 0); for (let n = 0; n < 8; n++) k.box([150, 2, 4], [270, y + 13, -60 + n * 30], '#7d888e'); sheet(-80, 80, 210, 290, .1, '#e8eef2'); }
    if (phase === 1) for (let n = 0; n < 5; n++) sheet(-120 + n * 110, 60 + (n % 2) * 50, 100, 140, (rnd(n) - .5) * .4, ['#f6d76b', '#f4b6a0', '#bfe0f2', '#c7e6c4', '#f6d76b'][n]);
    if (phase === 2) { k.box([90, 160, 40], [250, y + 20, 60], YELLOW, [Math.PI / 2, 0, .3]); for (let n = 0; n < 3; n++) k.box([180, 30, 120], [-60 + n * 40, y + 15 + n * 30, -40], ['#c9cfd3', '#b99067', '#2b3338'][n]); k.add(new THREE.TorusGeometry(80, 6, 6, 20), [80, y + 6, 160], '#3c7fc4', [1, 1, 1], [Math.PI / 2, 0, 0]); }
    if (phase === 3) { k.box([330, 18, 230], [200, y + 9, 40], '#2c3439'); k.cyl(42, 38, 110, [-120, y + 55, 120], '#e8ebe8'); }
    if (phase === 4) {
        k.box([640, 2, 420], [60, y + 1, 30], '#e3ebe4'); for (let n = 0; n < 6; n++) k.cyl(18, 18, 4, [-160 + n * 80, y + 3, -40 + (n % 3) * 70], ['#c23a2e', BLUE, '#4f9a6a'][n % 3]);
        sheet(-420, 120, 210, 290, -.1); for (let n = 0; n < 3; n++) k.box([340, 60, 250], [-420, y + 30 + n * 60, -140], ['#c49d74', '#b99067', '#c49d74'][n]);
    }
}
// Second real lamp: the work light under the parts shelving's top tier.
export function extraLamps(kit) {
    const shelf = kit.byId('storage'); if (!shelf || kit.lamps.length >= 2) return;
    const lens = kit.material('#f4f6f2', { emissive: '#eef6ff', emissiveIntensity: .3, roughness: .4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1100, 10, 40), lens); bar.position.set(0, 1640, 120); bar.castShadow = false; shelf.add(bar);
    const light = new THREE.PointLight('#eef6ff', 0, 2200 * kit.root.scale.x, 2); light.position.set(0, 1560, 260); shelf.add(light);
    kit.lamps.push({ light, luminous: lens, color: '#eef6ff' });
}
// Per-daypart changes: glows, LED fields, pools, phase-only objects, signs, stations.
export function atmosphere(phase, gain, kit) {
    const I = kit.it; if (!I) return;
    const i = phaseIndex(phase);
    drawView(kit, I, phase, gain);
    if (I.ceilingItems && kit.room?.ceilingFixture) { for (const g of I.ceilingItems) kit.room.ceilingFixture.add(g); I.ceilingItems = null; }
    for (const { m, levels } of I.glows) m.emissiveIntensity = levels[i] * gain;
    for (const { m, levels } of I.leds) m.color.setScalar(levels[i] * Math.min(gain, 1.3));
    for (const { o, color, levels } of I.pools) { const v = levels[i] * gain; o.material.color.copy(color).multiplyScalar(v); o.visible = v > .004; }
    for (const { obj, phases } of I.shows) obj.visible = phases.includes(i);
    if (I.phase !== phase) { for (const { map, draw } of I.redraws) { draw(map.image.getContext('2d'), map.image.width, map.image.height, i); map.needsUpdate = true; } I.phase = phase; }
    kit.root.userData.itPhase = { i, phase, gain };
    MAIN_PHASE = i; paintMainScreens();
    for (const station of kit.root.children) if (station.userData.officeStation) applyStationPhase(station, i, gain);
}
function applyStationPhase(root, i, gain = 1) {
    root.traverse(o => {
        const u = o.userData;
        if (u.itGlow) o.material.emissiveIntensity = u.itGlow[i] * gain;
        if (u.itLed) o.material.color.setScalar(u.itLed[i] * Math.min(gain, 1.3));
        if (u.itPool) { const v = u.itPool[i] * gain; o.material.color.set(u.itPoolColor).multiplyScalar(v); o.visible = v > .004; }
        if (u.itShow) o.visible = u.itShow.includes(i);
        if (u.itScreen && u.itScreen.phase !== i) { const map = o.material.map; paintScreen(map.image.getContext('2d'), map.image.width, map.image.height, u.itScreen.variant, PHASES[i]); map.needsUpdate = true; u.itScreen.phase = i; }
    });
}

// ---- Station role detail (moves and is disposed with the station) --------
// Screen levels per daypart (emissive); LED fields (unlit, brightness).
const SCREEN = [.32, .3, .36, .42, .34], LEDS = [.8, .8, .9, 1.2, .9];
export function stationDetail(spec, mount, T, { role: mountRole }) {
    const k = ck(), led = detailKit(), cable = k.cable, extras = [];
    const role = spec.role, desk = mountRole === 'desktop', shelf = mountRole === 'shelf', half = spec.size === '48x30' ? 610 : 762;
    const add = (geometry, material, at, rot = [0, 0, 0]) => { const o = new T.Mesh(geometry, material); o.position.set(...at); o.rotation.set(...rot); extras.push(o); return o; };
    const glow = (color, levels, base = '#141a1d') => { const m = new T.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: levels[0], roughness: .4 }); return m; };
    const pool = (w, h, color, levels, at) => {
        const m = new T.MeshBasicMaterial({ map: poolTexture(), color: '#000000', transparent: true, depthWrite: false, blending: T.AdditiveBlending }); m.userData.sharedTextures = true;
        const o = add(new T.PlaneGeometry(w, h), m, at, [-Math.PI / 2, 0, 0]); o.renderOrder = 2; o.raycast = noRay; o.castShadow = o.receiveShadow = false; o.userData.itPool = levels; o.userData.itPoolColor = color; return o;
    };
    // A screen plane (canvas, repainted per daypart).
    const screen = (variant, w, h, at, rot = [0, 0, 0], res = 512) => {
        const map = institutionalMap(() => {}, res, Math.round(res * h / w));
        const m = new T.MeshStandardMaterial({ map, color: '#ffffff', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: SCREEN[0], roughness: .35 });
        const o = add(new T.PlaneGeometry(w, h), m, at, rot); o.castShadow = false; o.userData.itScreen = { variant, phase: -1 }; o.userData.itGlow = SCREEN; return o;
    };
    // Procedural monitor with stand on the shelf / desktop, screen facing +z.
    const monitor = (variant, x, z, width = 540, yaw = 0, y = 0) => {
        const h = width * .58, cy = y + 150 + h / 2, c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        k.powder.box([width + 24, h + 24, 24], [x, cy, z], '#1a2227', [0, yaw, 0]);
        const st = at(0, -40); k.alu.box([34, 160, 26], [st[0], y + 80, st[1]], '#59646b', [0, yaw, 0]); k.alu.box([220, 12, 160], [st[0], y + 6, st[1]], '#59646b', [0, yaw, 0]);
        const sp = at(0, 13); return screen(variant, width, h, [sp[0], cy, sp[1]], [0, yaw, 0]);
    };
    // Procedural laptop (screen facing the user): base, keyboard deck, asset
    // tag and a lid leaning back 15° with its own screen, or closed.
    const laptop = (x, z, { open = true, variant = 'imaging', tag = true, y = 0, color = '#3a444b' } = {}) => {
        k.alu.box([330, 16, 230], [x, y + 8, z], color); k.box([290, 2, 110], [x, y + 17, z - 30], '#1e2428'); k.box([100, 1, 60], [x, y + 16.6, z + 70], '#4a545b');
        if (tag) k.print.add(atlasPlane(60, 30, labelRect(labelCell(ASSET_TAGS[Math.abs(Math.round(x / 480)) % 6])), LABEL_W, LABEL_H), [x + 115, y + 17, z + 90], '#ffffff', [1, 1, 1], [-Math.PI / 2, 0, 0]);
        if (!open) { k.alu.box([330, 12, 230], [x, y + 22, z], color); return; }
        const a = .26, cy = y + 16 + 112 * Math.cos(a), cz = z - 115 - 112 * Math.sin(a);
        k.alu.add(new T.BoxGeometry(330, 224, 8), [x, cy, cz], color, [1, 1, 1], [-a, 0, 0]);
        return screen(variant, 300, 192, [x, cy + 5 * Math.sin(a), cz + 5 * Math.cos(a)], [-a, 0, 0], 384);
    };
    const show = (obj, phases) => { obj.userData.itShow = phases; return obj; };
    if (role === 'imaging') {
        if (desk) {
            // Three laptops imaging, an 8-port switch with link LEDs and patch leads, asset tags.
            for (const x of [-480, 0, 480]) laptop(x, -40);
            k.powder.box([440, 44, 200], [0, 22, 220], '#262e33'); k.vent.box([2, 30, 150], [221, 22, 220], '#3a444b'); for (let p = 0; p < 8; p++) { k.box([30, 18, 4], [-170 + p * 48, 26, 321], '#0d1114'); led.box([8, 5, 2], [-180 + p * 48, 40, 322], GREEN_LED); }
            led.box([10, 8, 2], [180, 30, 322], BLUE_LED);
            const cols = ['#3c7fc4', '#e0b45e', '#4f9a6a'];
            [-480, 0, 480].forEach((x, n) => { const curve = new T.CatmullRomCurve3([new T.Vector3(-170 + n * 48, 26, 330), new T.Vector3(-170 + n * 48, 6, 360), new T.Vector3(x * .7, 4, 260), new T.Vector3(x + 150, 8, 40)]); cable.add(new T.TubeGeometry(curve, 16, 3.5, 5, false), [0, 0, 0], cols[n]); });
            for (let n = 0; n < 4; n++) k.box([60, 3, 30], [-640 + n * 20, 2 + n * 3, 300], '#f2c230', [0, .2 * n, 0]);
            pool(1400, 640, '#cfe4ff', [.02, .02, .08, .16, .06], [0, 4, -20]);
        }
        if (shelf) {
            monitor('imaging', -100, 0, 560);
            // Imaging tower: multi-bay USB duplicator with bay LEDs.
            k.powder.box([180, 260, 240], [-560, 130, 0], '#2b3338'); k.vent.box([2, 200, 200], [-469, 130, 0], '#3a444b'); for (let b = 0; b < 5; b++) { k.box([150, 30, 6], [-560, 40 + b * 45, 121], '#1a2024'); led.box([10, 8, 2], [-500, 40 + b * 45, 124], b === 4 ? AMBER_LED : GREEN_LED); }
            k.poly.box([120, 160, 60], [380, 80, 30], '#e8ebe8'); for (let r = 0; r < 4; r++) k.box([90, 4, 2], [380, 30 + r * 34, 61], '#9aa5ab');
        }
    }
    if (role === 'techbar') {
        if (desk) {
            // Check-in tablet on a stand turned to the visitor (−z side, the door), a loaner
            // basket and a counter plate; staff laptop is a library prop.
            k.box([160, 14, 120], [-260, 7, -230], '#2b3338'); k.box([30, 120, 30], [-260, 70, -230], '#59656c');
            k.add(new T.BoxGeometry(270, 190, 10), [-260, 180, -240], '#1a2227', [1, 1, 1], [.35, Math.PI, 0]);
            screen('intake', 250, 170, [-260, 181, -247], [-.35, Math.PI, 0], 256).rotation.set(-.35, Math.PI, 0, 'YXZ');
            k.box([300, 70, 200], [-60, 35, 200], '#5d6970'); for (let n = 0; n < 4; n++) k.box([60, 16, 150], [-160 + n * 66, 78, 200], ['#2b3338', '#e8ebe8', '#2b3338', '#3c7fc4'][n]);
            k.box([360, 100, 8], [0, 50, -half / 2 - 60], '#2b3338');
            // A device being dropped off (service session, deployment pick-ups).
            { const C = stationMats(), drop = new T.Group(); drop.name = 'Dropped-off device'; extras.push(drop); show(drop, [1, 4]); const D = ck(); D.card.box([220, 40, 160], [-450, 20, 60], '#b99067'); D.box([50, 1, 162], [-450, 40.6, 60], '#d2b98d'); D.print.add(atlasPlane(80, 40, labelRect(labelCell('RETURNS')), LABEL_W, LABEL_H), [-450, 41.2, 100], '#ffffff', [1, 1, 1], [-Math.PI / 2, 0, 0]); D.build(drop, C); }
        }
        if (shelf) {
            // Queue / help screen facing the visitor, and a small sign.
            monitor('queue', 120, 20, 480, Math.PI);
            k.box([300, 90, 8], [-260, 45, 120], BLUE);
        }
    }
    if (role === 'console') {
        if (desk) {
            // KVM switch and the console cable looping toward the racks (−z).
            k.powder.box([220, 44, 160], [-480, 22, -60], '#2b3338'); led.box([8, 8, 2], [-420, 30, 21], GREEN_LED); led.box([8, 8, 2], [-400, 30, 21], GREEN_LED);
            const curve = new T.CatmullRomCurve3([new T.Vector3(-480, 30, -140), new T.Vector3(-520, 10, -330), new T.Vector3(-560, -200, -420), new T.Vector3(-600, -500, -460)]);
            cable.add(new T.TubeGeometry(curve, 16, 6, 6, false), [0, 0, 0], '#2b3338');
            // Cable tester and a label maker.
            k.poly.box([90, 30, 160], [120, 15, -180], YELLOW); k.box([60, 4, 70], [120, 31, -200], '#1d3a2a');
            pool(1100, 560, '#d8ecff', [.03, .03, .1, .16, .06], [0, 4, 0]);
        }
        if (shelf) monitor('terminal', 0, 0, 520);
    }
    if (role === 'repair') {
        if (desk) {
            // ESD mat with a coiled wrist strap and ground cord, a parts tray, a
            // generic circuit board, screwdriver kit and spudgers, a multimeter.
            k.rubber.box([1300, 4, 600], [0, 2, 40], '#3d6f8e'); k.rubber.box([1300, 3, 10], [0, 1.5, 345], '#335f7a'); k.chrome.cyl(12, 12, 6, [600, 5, 300], '#c3c9cd'); k.print.add(atlasPlane(110, 55, labelRect(labelCell('ESD')), LABEL_W, LABEL_H), [-560, 4.6, 290], '#ffffff', [1, 1, 1], [-Math.PI / 2, 0, 0]);
            k.add(new T.TorusGeometry(42, 6, 6, 20), [520, 10, 240], '#2b3338', [1, 1, .4], [Math.PI / 2, 0, 0]);
            const cord = new T.CatmullRomCurve3([new T.Vector3(560, 8, 250), new T.Vector3(600, 6, 290), new T.Vector3(640, -40, 330), new T.Vector3(690, -300, 340)]); cable.add(new T.TubeGeometry(cord, 12, 3, 5, false), [0, 0, 0], '#2f8a57');
            k.box([300, 3, 200], [-200, 6, -10], '#1b4a3a'); for (let n = 0; n < 9; n++) k.box([20 + rnd(n) * 40, 6, 16 + rnd(n + 4) * 30], [-300 + (n % 3) * 90, 10, -70 + Math.floor(n / 3) * 60], n % 4 ? '#2d2f33' : '#c9b46a');
            k.powder.box([300, 30, 160], [450, 15, -100], '#5d6970'); for (let n = 0; n < 6; n++) k.box([86, 22, 70], [360 + (n % 3) * 90, 24, -140 + Math.floor(n / 3) * 80], '#3a444b');
            for (let n = 0; n < 6; n++) k.ball(6, [340 + (n % 3) * 90 + rnd(n) * 20, 30, -140 + Math.floor(n / 3) * 80], '#c3c9cd');
            k.poly.box([260, 30, 110], [-500, 15, 200], '#2b3338'); for (let n = 0; n < 8; n++) { k.poly.box([14, 14, 70], [-600 + n * 28, 34, 190], ['#c23a2e', '#e0b45e', BLUE, '#2b3338'][n % 4]); k.chrome.cyl(2.5, 2.5, 40, [-600 + n * 28, 34, 240], '#c3c9cd'); }
            for (let n = 0; n < 3; n++) k.box([12, 6, 140], [-250 + n * 26, 8, 200], ['#2b3338', '#3c7fc4', '#2b3338'][n], [0, .3, 0]);
            k.poly.box([90, 34, 170], [140, 17, 270], YELLOW); k.box([60, 4, 50], [140, 35, 240], '#1d3a2a'); k.cyl(3, 3, 260, [80, 6, 220], '#c23a2e');
            // Service sessions: a laptop opened on the mat.
            const open = new T.Group(); open.name = 'Laptop under repair'; extras.push(open); show(open, [0, 1, 2]);
            // Upside down with the base cover off: battery, board, fan, heat pipe, RAM and SSD; the cover and screws beside it.
            const lk = ck(); lk.alu.box([330, 12, 230], [60, 10, 20], '#5b656c'); lk.box([314, 2, 214], [60, 16.5, 20], '#20272b');
            lk.powder.box([300, 8, 80], [60, 21, 85], '#2b3338'); lk.box([120, 1, 30], [20, 25.6, 85], '#d8dcdc');
            lk.box([200, 3, 110], [20, 19, -15], '#1f5a43'); for (let n = 0; n < 6; n++) lk.box([20 + rnd(n) * 18, 3, 16 + rnd(n + 2) * 14], [-50 + n * 28, 21.5, -40 + (n % 2) * 40], n % 3 ? '#16191b' : '#c9b46a');
            lk.cable.cyl(34, 34, 6, [160, 21, -30], '#15191b'); lk.chrome.cyl(26, 26, 7, [160, 21.5, -30], '#7d878d'); lk.box([120, 4, 12], [110, 22, -40], '#b87333', [0, .4, 0]);
            for (let n = 0; n < 2; n++) lk.box([70, 3, 28], [-30, 22, -15 + n * 34], '#2f6f4e'); lk.box([80, 3, 22], [-95, 22, 20], '#1d2328');
            lk.alu.box([330, 3, 230], [60, 2, 290], '#5b656c'); for (let n = 0; n < 8; n++) lk.chrome.cyl(4, 4, 3, [-60 + (n % 4) * 12, 4, 330 + Math.floor(n / 4) * 10], '#9aa5ab');
            lk.build(open, stationMats());
            // Magnifier lamp: clamp, two-part arm and a ring head with an emissive ring.
            k.box([60, 80, 60], [-640, 40, -300], '#2b3338'); k.cyl(10, 10, 380, [-640, 260, -300], '#c3c9cd'); k.box([16, 16, 360], [-560, 440, -170], '#c3c9cd', [.4, .6, 0]);
            k.add(new T.TorusGeometry(80, 18, 10, 28), [-430, 360, -20], '#e8ebe8', [1, 1, 1], [Math.PI / 2, 0, 0]);
            const ring = add(new T.TorusGeometry(70, 6, 8, 28), glow('#f4fbff', [.4, .4, 1.4, 1.8, .9], '#e8ebe8'), [-430, 348, -20], [Math.PI / 2, 0, 0]); ring.userData.itGlow = [.4, .4, 1.4, 1.8, .9];
            const lens = add(new T.CircleGeometry(64, 24), new T.MeshStandardMaterial({ color: '#cfe4ef', transparent: true, opacity: .35, roughness: .05, metalness: .2 }), [-430, 352, -20], [-Math.PI / 2, 0, 0]); lens.castShadow = false;
            pool(820, 700, '#f2f8ff', [.06, .06, .3, .46, .2], [-330, 6, 20]);
        }
        if (shelf) {
            monitor('bench', 300, 0, 520);
            // Bench power supply and a generic bench oscilloscope with a live trace.
            k.powder.box([200, 120, 160], [-420, 60, 0], '#2b3338'); k.box([170, 60, 4], [-420, 80, 81], '#14191c'); led.box([60, 20, 2], [-420, 82, 84], '#7cf2a8');
            k.powder.box([300, 170, 220], [-130, 85, 0], '#c9cfd3'); k.vent.box([2, 120, 180], [21, 85, 0], '#9aa5ab'); k.box([170, 110, 4], [-170, 95, 111], '#14191c'); for (let n = 0; n < 6; n++) k.cyl(9, 9, 10, [-10 + (n % 2) * 40, 60 + Math.floor(n / 2) * 40, 112], '#2b3338');
            const trace = new T.Mesh(new T.PlaneGeometry(150, 2.5), glow('#7cf2a8', [.8, .8, 1, 1.2, .9], '#7cf2a8')); trace.position.set(-170, 95, 114); trace.userData.itGlow = [.8, .8, 1, 1.2, .9]; extras.push(trace);
        }
    }
    if (role === 'noc') {
        if (desk) pool(1500, 700, '#cfe4ff', [.02, .02, .1, .22, .08], [0, 4, -40]);
        if (shelf) { monitor('noc', -300, 10, 560, .18); monitor('topology', 300, 10, 560, -.18); }
    }
    if (role === 'intake') {
        if (desk) {
            // Label printer with a label coming out; barcode scanner in its cradle; a returns tote.
            k.poly.box([160, 120, 200], [-480, 60, -90], '#e8ebe8'); k.box([110, 4, 40], [-480, 90, 15], '#f7f7f2'); led.box([8, 8, 2], [-430, 100, 11], GREEN_LED);
            k.box([90, 40, 70], [450, 20, -130], '#2b3338'); k.add(new T.BoxGeometry(60, 160, 50), [450, 110, -130], '#2b3338', [1, 1, 1], [.4, 0, 0]); led.box([40, 6, 3], [450, 175, -100], '#e05a4a');
            const tote = show(new T.Group(), [1, 2, 4]); tote.name = 'Returns tote'; extras.push(tote);
            const tk = ck(); tk.poly.box([380, 140, 260], [80, 70, -170], BLUE); tk.alu.box([300, 30, 200], [80, 130, -170], '#5b656c'); tk.alu.box([300, 60, 20], [80, 140, -100], '#3a444b'); tk.print.add(atlasPlane(120, 60, labelRect(labelCell('RETURNS')), LABEL_W, LABEL_H), [80, 80, -39.4], '#ffffff'); tk.build(tote, stationMats());
        }
    }
    // A small potted plant on the shelf of the imaging, tech bar and intake desks.
    if (shelf && ['imaging', 'techbar', 'intake'].includes(role)) plant(k, { imaging: 600, techbar: -470, intake: 450 }[role], 0, 0, .32);
    const group = new T.Group(); group.name = `${spec.name} role detail`;
    k.build(group, stationMats());
    const lm = new T.MeshBasicMaterial({ vertexColors: true }); const lo = led.build(group, lm); if (lo) { lo.userData.itLed = LEDS; lo.castShadow = false; } else lm.dispose();
    extras.filter(Boolean).forEach(o => { if (!o.parent) group.add(o); });
    if (!group.children.length) return; mount.add(group);
    // Match the current daypart (stations are added after the room build).
    let root = mount; while (root.parent && !root.userData.itPhase) root = root.parent;
    const now = root.userData.itPhase || { i: 1, gain: 1 };
    applyStationPhase(group, now.i, now.gain);
}

// Main desk: a procedural monitor with the field tech's checklist (repainted
// per daypart), USB-C dock, cable coil, asset tags and a multimeter.
const MAIN_SCREENS = new Set(); let MAIN_PHASE = 1;
function paintMainScreens() {
    for (const o of MAIN_SCREENS) {
        let n = o; while (n.parent) n = n.parent; if (!n.isScene && o.userData.itScreen.phase !== -1) { MAIN_SCREENS.delete(o); continue; }
        if (o.userData.itScreen.phase === MAIN_PHASE) continue;
        const map = o.material.map; paintScreen(map.image.getContext('2d'), map.image.width, map.image.height, 'checklist', PHASES[MAIN_PHASE]); map.needsUpdate = true;
        o.material.emissiveIntensity = SCREEN[MAIN_PHASE]; o.userData.itScreen.phase = MAIN_PHASE;
    }
}
export function mainDeskDetail({ role, THREE: T, add }) {
    if (role === 'shelf') {
        const k = detailKit(), width = 560, h = width * .58, cy = 150 + h / 2;
        k.box([width + 24, h + 24, 24], [-60, cy, 0], '#1a2227'); k.box([34, 160, 26], [-60, 80, -40], '#3b464d'); k.box([220, 12, 160], [-60, 6, -40], '#3b464d');
        plant(k, 520, 0, 0, .3); k.cyl(40, 36, 100, [330, 50, 30], '#e8ebe8'); k.cyl(36, 36, 3, [330, 100, 30], '#3b2a20');
        const g = new T.Group(); g.name = 'Field tech monitor'; k.build(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .5 }));
        const map = institutionalMap(() => {}, 512, 297);
        const screen = new T.Mesh(new T.PlaneGeometry(width, h), new T.MeshStandardMaterial({ map, color: '#ffffff', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: SCREEN[MAIN_PHASE], roughness: .35 }));
        screen.position.set(-60, cy, 13); screen.castShadow = false; screen.userData.itScreen = { phase: -1 }; g.add(screen); add(g);
        MAIN_SCREENS.add(screen); paintMainScreens();
        return;
    }
    if (role !== 'desktop') return;
    const k = detailKit();
    k.box([120, 20, 60], [80, 10, -60], '#2b3338'); k.box([90, 3, 4], [80, 14, -29], '#59656c');
    const curve = new T.CatmullRomCurve3([new T.Vector3(80, 8, -90), new T.Vector3(40, 4, -160), new T.Vector3(-120, 4, -140), new T.Vector3(-240, 8, -60)]); k.add(new T.TubeGeometry(curve, 12, 3, 5, false), [0, 0, 0], '#1d2328');
    k.add(new T.TorusGeometry(60, 6, 6, 24), [520, 6, 70], '#2b3638', [1, 1, 1], [Math.PI / 2, 0, 0]); k.add(new T.TorusGeometry(48, 6, 6, 24), [520, 14, 70], '#3c7fc4', [1, 1, 1], [Math.PI / 2, 0, .3]);
    for (let n = 0; n < 3; n++) k.box([60, 3, 22], [-520 + n * 20, 2 + n * 3, 230], '#f2c230', [0, .25 * n, 0]);
    // Multimeter with probes, and a small parts tray.
    k.box([90, 34, 170], [420, 17, -150], YELLOW); k.box([60, 4, 50], [420, 35, -180], '#1d3a2a'); k.cyl(22, 22, 8, [420, 36, -120], '#2b3338');
    k.add(new T.TorusGeometry(50, 3, 5, 18), [330, 4, -60], '#c23a2e', [1, 1, 1], [Math.PI / 2, 0, 0]); k.add(new T.TorusGeometry(44, 3, 5, 18), [330, 7, -60], '#1d2328', [1, 1, 1], [Math.PI / 2, 0, .5]);
    k.box([160, 18, 110], [-380, 9, 150], '#5d6970'); for (let n = 0; n < 4; n++) k.box([34, 12, 46], [-430 + (n % 2) * 70, 16, 128 + Math.floor(n / 2) * 50], '#3a444b');
    const g = new T.Group(); g.name = 'Field tech desk kit'; k.build(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .6 })); add(g);
}

// ---- Daily staging (room-life.mjs) --------------------------------------
export function stageKit({ h, m, g, y, THREE: T }) {
    h.box(g, [115, 10, 90], [160, y + 5, 0], m.ink, 4);
    for (let n = 0; n < 4; n++) h.box(g, [15, 4, 18], [125 + n * 22, y + 12, 0], m.brass, 1);
    const cable = h.mesh(g, new T.TorusGeometry(36, 3, 6, 20), m.ink, [160, y + 3, 100]); cable.rotation.x = Math.PI / 2;
}
