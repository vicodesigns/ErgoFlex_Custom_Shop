import * as THREE from 'three';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';
import { migrateHumboldtGroupFurniture } from './humboldt-furniture-migration.mjs?v=commons-home-comfort-20261024';
import { buildHumboldtLife } from './library-humboldt-life.mjs?v=env-shared-20261111';
import { addCampusLife } from './campus-lived-in.mjs?v=env-shared-20261111';
import { humboldtStudyChairs, humboldtReadingDetails } from './humboldt-commons-detail.mjs?v=commons-home-comfort-20261024';

// A sixth Library layout inspired by the ground-floor commons of Cal Poly
// Humboldt Library: a double-height reading commons on charcoal carpet tile,
// a beige gallery band with a carved redwood canoe and white figures, a glass
// bay, a long tackboard wall and black suspended light frames. The owner's
// ErgoFlex desk stands against the right wall just left of the tackboard.
// It is inspired by the space, not a survey; furniture keeps real sizes. The
// proposed pilot is identified explicitly as a concept. Specs:
// docs/library-humboldt-commons.md.
//
// One long, narrow building: the commons, the canoe at the junction, then a
// long gallery hall (café tables along the glass, white figures along the
// inner wall). The right wall stays at x +9000 so the desk bay and any saved
// furniture edits keep their places; the shell is asymmetric about x = 0
// (layout.left), which the shared room systems honour.
//
// Millimetres, room-local: x across (left wall -4400, right wall +9000),
// z along the building (back wall -7000, hall end +26000), y up.
// Prop turn θ faces (sin θ, 0, cos θ).
const XL = -4400, XR = 9000, W = XR - XL, D = 35000, H = 7200, BACK = -7000, FRONT = BACK + D;
const SOFFIT = 3600, SOFFIT_X = 4800, BAND_Z = 5000, GLASS_Z = 4400;
// The figure hall is narrower than the commons (about 1:4, photo 2): past the
// junction the glass steps in from x 9000 to 6000 at STEP_Z, under a lower
// café soffit. Figures start at HALL_Z; the mezzanine runs over the junction.
const HALL_XR = 6000, STEP_Z = 9000, HALL_Z = 12000, CAFE_SOFFIT = 3000, CAFE_SOFFIT_X = 2200, SOLID_Z = 20000, MEZ = [-3000, 12000];
const DESK = [8240, -1850];
// The high ceiling slopes from 4800 at the back wall to 7200 at z 5000, then runs flat.
const SLOPE_Z = 5000, slopeY = z => z < SLOPE_Z ? 4800 + (z - BACK) / (SLOPE_Z - BACK) * 2400 : H, SLOPE = Math.atan2(2400, SLOPE_Z - BACK);
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function makeHumboldtLayout() {
    const chair = (x, z, turn) => ({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, z], turn });
    // Saved furniture edits are keyed by each placement's index in this list, so the
    // order matches the first commons build; anything new is appended at the end.
    const props = [
        // Task chair on the room side of the wall desk, facing the wall.
        { id: 'steelcase-leap-v2', at: [DESK[0] - 1050, 0, DESK[1]], turn: 90 },
        // Reading nook away from the pilot's route to the shared project table.
        { id: 'atelier-timber-obsidian', at: [-2800, 0, 4700], turn: 0, finish: 'charcoal' },
        { id: 'atelier-timber-clay', at: [-1500, 0, 4700], turn: 0, finish: 'raspberry' },
        { id: 'monstera', at: [8600, 0, 4300] },
        { id: 'atelier-timber-obsidian', at: [-3800, 0, 3700], turn: 90, finish: 'charcoal' },
        { id: 'campus-board-compact-nordic', at: [-3950, 0, -3000], turn: 90 },
        { id: 'campus-board-compact-nordic', at: [4200, 0, 3600], turn: 180 },
        // A pair of bins by the end lounge (the junction has the recycling station).
        { id: 'kenney-furniture-trashcan', at: [-3950, 0, 27500], turn: 90 },
        { id: 'kenney-furniture-trashcan', at: [-3450, 0, 27550], turn: 90 },
        { id: 'ficus', at: [3800, 0, -6650] }
    ];
    // Study tables: a back row in front of the glass bay, the long group run,
    // a square four-top and the project table, all kept about 2.3 m (8 ft) off
    // the gallery wall as the owner arranged them. Chairs tuck 750 from centre.
    for (const x of [-1600, -800, 0]) props.push(chair(x, -5950, 0), chair(x, -4450, 180));
    for (const x of [550, 1450]) props.push(chair(x, 2950, 0), chair(x, 4450, 180));
    for (const x of [2550, 3450]) props.push(chair(x, -5950, 0), chair(x, -4450, 180));
    for (const z of [-150, 750, 1650, 2550]) props.push(chair(-1850, z, 90), chair(-350, z, -90));
    for (const z of [-2400, -1600, -800]) props.push(chair(250, z, 90), chair(1750, z, -90));
    props.push(chair(4100, -2300, 0), chair(4100, -500, 180), chair(3200, -1400, 90), chair(5000, -1400, -90));
    // Café: two along the junction glass, then a row 1.5 m from the hall glass;
    // two-seat tables in the hall aisle are appended after the newer props.
    for (const [x, z] of HUMBOLDT_CAFE.slice(0, 8)) props.push(chair(x - 750, z, 90), chair(x + 375, z + 650, -150), chair(x + 375, z - 650, -30));
    props.push(
        // Planters against the hall glass, and a lounge pair at the end of the figure side.
        { id: 'decor-plant2', at: [5550, 0, 11700] }, { id: 'decor-plant1', at: [5550, 0, 19100] },
        { id: 'atelier-timber-obsidian', at: [-2150, 0, 27250], turn: 180, finish: 'charcoal' },
        { id: 'atelier-timber-obsidian', at: [-850, 0, 27250], turn: 180, finish: 'charcoal' });
    for (const [x, z] of HUMBOLDT_CAFE.slice(8)) props.push(chair(x, z - 750, 0), chair(x, z + 750, 180));
    // New seats are appended to preserve every existing furniture edit key.
    for (const x of [4900, 6100]) props.push({ ...chair(x, 500, 0), finish: 'group-forest' }, { ...chair(x, 2700, 180), finish: 'group-forest' });
    // A genuine mobility seat shares the group, rather than an isolated pilot bay.
    props.push({ id: 'electric-wheelchair', at: [8500, 0, -5500], turn: 90 });
    props.push({ id: 'atelier-lamp-mushroom-warm', at: [-2260, 550, 5130] });
    const tables = [
        { id: 'humboldt-table-b1', at: [-800, -5200], size: [2400, 900] },
        { id: 'humboldt-table-b2', at: [1000, 3700], size: [1800, 900] },
        { id: 'humboldt-table-b3', at: [3000, -5200], size: [1800, 900] },
        { id: 'humboldt-table-g1', at: [-1100, 1200], size: [900, 3600] },
        { id: 'humboldt-table-g2', at: [1000, -1600], size: [900, 2400] },
        { id: 'humboldt-table-s1', at: [4100, -1400], size: [1200, 1200] },
        { id: 'humboldt-table-l1', at: [5500, 1600], size: [2400, 1400], light: true }
    ];
    const cafe = HUMBOLDT_CAFE;
    return ['humboldt', {
        id: 'humboldt', name: 'Humboldt-inspired commons', width: W, depth: D, height: H, back: BACK, left: XL,
        // Shared Library systems treat this as the largest tier.
        index: 4, tier: 'executive', humboldt: true, desktopSize: '60x30',
        desk: DESK, deskTurn: -90, reading: [...tables.map(t => t.at), ...cafe], stacks: [], carrels: [], research: null, service: null, lounge: null, sideTable: [-2150, 5200],
        // Daylight enters through the hall and junction glass (+x), not the solid back wall.
        daylight: [HALL_XR - 100, 16000],
        tables, cafe, props,
        insideView: { eye: [6700, 2750, 6100], target: [6500, 1100, 1400], fov: 62 },
        finish: { partyDay: false, name: 'Commons white & charcoal', ground: '#5e5f5c', wood: .51, metal: .30, stone: .67, night: .96 },
        // Groove poses relative to the wall desk: always step back into the room (-x).
        groovePoses: {
            morning: { dx: -60, dz: -120, yaw: -Math.PI / 2 },
            afternoon: { dx: -640, dz: 3450, yaw: 0 },
            evening: { dx: 0, dz: 0, yaw: -Math.PI / 2 },
            night: { dx: 0, dz: -80, yaw: -Math.PI / 2 },
            party: { dx: -640, dz: 3450, yaw: 0 }
        },
        stories: ['Opening: standing plans, coffee and book returns', 'Join the research group at the shared table · an open approach and a place for everyone', 'Dusk: quiet reading, annotated books and warm pools of light', 'Closing: return to the wall, stow loose items and fold to 65°', 'Project workshop: bring the ErgoFlex alongside the group for maps, notes and conversation'],
        groupStudy: { phases: ['afternoon', 'party'], table: 'humboldt-table-l1', desk: [7600, 1600], wheelchair: [7600, 2950], chairPark: [8500, -4200], turningBay: { x: 6500, z: 4350, diameter: 1500 } },
        modes: HUMBOLDT_MODES
    }];
}

// North Coast overcast by day, the reference photo's warm-neutral 3500 K
// commons at dusk, half the frames at closing, and a lit collection for an
// evening event. Groove moves forward for shared use and returns to the
// wall-facing bay to fold into Storage Mode. Same fields as LIBRARY_MODES.
export const HUMBOLDT_MODES = {
    morning: { label: 'Opening / stand', description: 'Marine-layer daylight · standing study at the proposed pilot', key: '#e4ecf0', fill: '#dde6ec', accent: '#efe3d1', power: 1, ambient: .52, bounce: .58, exposure: 1.1, sky: ['#b7c4cb', '#e2e6e3'], practical: .45, wash: .35, colors: ['#fff0de', '#f6efe4'], height: 43.5, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Research / together', description: 'Roll alongside the shared research table · everyone works at the same height', key: '#f6f4ef', fill: '#e0e8ec', accent: '#eadccb', power: 1.25, ambient: .55, bounce: .62, exposure: 1.08, sky: ['#c3d0d7', '#eef0ec'], practical: .5, wash: .4, colors: ['#fff0de', '#f6efe4'], height: 29.53, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Dusk / reading', description: 'Warm frames and task light · an 8° reading surface', key: '#d9b597', fill: '#b9bcc4', accent: '#f0caa2', power: .24, ambient: .22, bounce: .34, exposure: 1.22, sky: ['#4a5a7e', '#d49a7a'], practical: 1.05, wash: .8, colors: ['#ffecd6', '#ece4d6'], height: 32, tilt: 8, offset: [0, 0], yaw: 0, leds: true, color: '#4f4232' },
    night: { label: 'Closing / storage', description: '65° Storage Mode · parked at the wall, clear floor for cleaning', key: '#d6d0c6', fill: '#9eaac0', accent: '#efc79a', power: .1, ambient: .1, bounce: .12, exposure: 1.04, sky: ['#06090f', '#111824'], practical: .7, wash: .26, colors: ['#ffe9d0', '#ece4d6'], height: 43, tilt: 65, offset: [0, 0], yaw: 0, leds: false, color: '#3a3226' },
    party: { label: 'Project / together', description: 'An evening mapping workshop · bring your workstation into the group', key: '#f0d4b4', fill: '#b6bed4', accent: '#f5c58e', power: .22, ambient: .26, bounce: .5, exposure: 1.1, sky: ['#141d30', '#3e3d55'], practical: .8, wash: .95, colors: ['#ffe6c8', '#ffdcb4'], height: 29.53, tilt: 0, offset: [0, 0], yaw: 0, leds: true, color: '#5c4a2c' }
};
// White figures along the hall's inner wall: [z, plinth height, seated].
// [z, plinth length along the wall, plinth height, figures [offset along wall, height, seated, turn]].
const FIGURES = [
    [13000, 700, 850, [[0, 1700, true]]],
    [15000, 1000, 800, [[-230, 2050, false, .08], [230, 1980, false, -.06]]],
    [16900, 600, 900, [[0, 2100, false]]],
    [18800, 700, 850, [[0, 1650, true, -.1]]],
    [21000, 1400, 750, [[-470, 2000, false, .3], [0, 2100, false, -.15], [470, 1950, false, .5]]]
];
const CANOE = [-3450, 8600], CANOE_HEADS = [6600, 7800, 9000, 10200, 11400];
const FIGURE_HEADS = Array.from({ length: 10 }, (_, i) => 12600 + i * 1050);
// Café tables: two along the junction glass, one row 1.5 m from the hall glass, and
// two two-seat tables out in the hall where people linger near the figures.
const HUMBOLDT_CAFE = [[7450, 5500], [7450, 7800], ...[10500, 12950, 15400, 17850, 20300, 22750].map(z => [4500, z]), [1400, 14200], [1400, 19000]];
const PHASE = ['morning', 'afternoon', 'evening', 'night', 'party'];
const T3500 = '#ffe7cc', T4000 = '#fff0de', T3000 = '#ffdcb4';

export function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
const repeating = (map, anisotropy = 4) => { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = anisotropy; return map; };
// Draw at every wrap copy that can touch the canvas, so scatter tiles seamlessly.
const tile = (S, T, x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-T, 0, T]) { const X = x + ox, Y = y + oy; if (X + r >= 0 && Y + r >= 0 && X - r <= S && Y - r <= T) fn(X, Y); } };
const mottle = (c, S, T, count, seed, light, dark, rMin, rMax) => {
    for (let n = 0; n < count; n++) {
        const r = rMin + rnd(seed + n * 1.9) * (rMax - rMin);
        tile(S, T, rnd(seed + n * 3.3) * S, rnd(seed + n * 7.7) * T, r, (x, y) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, n % 2 ? light : dark); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); });
    }
};
// Bakes parts into one geometry (one draw); optional per-part vertex colour.
export function kit() {
    const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const api = {
        add(geometry, at, { rot = [0, 0, 0], scale = [1, 1, 1], color = null } = {}) {
            const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
            g.applyMatrix4(m.compose(p.set(...at), q.setFromEuler(e.set(...rot)), s.set(...scale)));
            parts.push({ g, color: color && new THREE.Color(color) }); return api;
        },
        box: (size, at, o) => api.add(new THREE.BoxGeometry(...size), at, o),
        cyl: (top, bottom, height, at, o = {}) => api.add(new THREE.CylinderGeometry(top, bottom, height, o.seg || 16, 1, !!o.open), at, o),
        plane: (size, at, o) => api.add(new THREE.PlaneGeometry(...size), at, o),
        get count() { return parts.length; },
        build() {
            let n = 0; for (const { g } of parts) n += g.attributes.position.count;
            const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
            let o = 0;
            for (const { g, color } of parts) {
                const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
                if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
                if (color) for (let i = 0; i < c; i++) col.set([color.r, color.g, color.b], (o + i) * 3);
                o += c; g.dispose();
            }
            const out = new THREE.BufferGeometry();
            out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
            out.computeBoundingBox(); out.computeBoundingSphere(); parts.length = 0; return out;
        }
    };
    return api;
}

// Window views: the campus photograph graded for each daypart. Night glass is
// a dark mirror with faint interior reflections, never a black hole.
function gradeWindow(c, image, modeId, mode) {
    const S = c.canvas, w = S.width, h = S.height;
    c.save(); c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    if (image?.naturalWidth) {
        c.filter = { morning: 'brightness(0.94) saturate(0.62) contrast(0.88)', afternoon: 'brightness(1) saturate(0.72) contrast(0.9)', evening: 'brightness(0.62) saturate(0.6)', night: 'brightness(0.22) saturate(0.35)', party: 'brightness(0.3) saturate(0.45)' }[modeId];
        const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight), iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
        c.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih); c.filter = 'none';
    } else {
        // Marine-layer fog over layered conifers, tall straight red-brown trunks
        // in front, a damp lawn and a pale path. Seamless left/right, since long panes repeat it.
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, mode.sky[0]); g.addColorStop(1, mode.sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
        const wrapX = (x, r, fn) => { for (const o of [-w, 0, w]) if (x + o + r >= 0 && x + o - r <= w) fn(x + o); };
        // Soft edges: the far bands sit in fog, so their outlines blur.
        for (const [band, color, top, count] of [[0, '#7d8a84', .14, 22], [1, '#55665c', .24, 18], [2, '#3a4a40', .36, 14]]) {
            c.filter = `blur(${2.4 - band * .8}px)`;
            c.fillStyle = color;
            for (let i = 0; i < count; i++) {
                const x = (i + rnd(band * 31 + i) * .8) / count * w, half = w * (.022 + rnd(band * 7 + i) * .016), y = h * (top + rnd(band * 13 + i) * .1);
                // A jagged spire: branch tiers step out and back down each side.
                wrapX(x, half * 1.3, X => {
                    const tiers = 9, H0 = h * .8 - y; c.beginPath(); c.moveTo(X, y);
                    for (let k = 1; k <= tiers; k++) { const t = k / tiers, r = half * t * (.85 + rnd(band * 97 + i * 13 + k) * .45); c.lineTo(X + r, y + H0 * (t - .04)); c.lineTo(X + r * .62, y + H0 * t); }
                    for (let k = tiers; k >= 1; k--) { const t = k / tiers, r = half * t * (.85 + rnd(band * 89 + i * 7 + k) * .45); c.lineTo(X - r * .62, y + H0 * t); c.lineTo(X - r, y + H0 * (t - .04)); }
                    c.closePath(); c.fill();
                });
            }
            // Fog thins each band toward the sky.
            c.filter = 'none'; const f = c.createLinearGradient(0, h * top, 0, h * .8); f.addColorStop(0, '#d6dcdc55'); f.addColorStop(1, '#d6dcdc00'); c.fillStyle = f; c.fillRect(0, h * top, w, h * (.8 - top));
        }
        c.fillStyle = '#4f6a45'; c.fillRect(0, h * .78, w, h * .22);
        c.fillStyle = '#5d7a50'; for (let i = 0; i < 400; i++) c.fillRect(rnd(i * 2.3) * w, h * (.79 + rnd(i * 5.1) * .2), 3, 1);
        c.fillStyle = '#b9b6ab'; c.beginPath(); c.moveTo(0, h * .9); c.bezierCurveTo(w * .35, h * .86, w * .65, h * .95, w, h * .9); c.lineTo(w, h * .94); c.bezierCurveTo(w * .65, h * .99, w * .35, h * .9, 0, h * .94); c.fill();
        // Redwood trunks: straight, tapering, with darker bark furrows and a foliage crown above the frame.
        for (let i = 0; i < 6; i++) {
            const x = (i + .3 + rnd(i * 4.7) * .4) / 6 * w, wd = w * (.012 + rnd(i * 9.1) * .012);
            wrapX(x, wd * 3, X => {
                c.fillStyle = '#5e4436'; c.beginPath(); c.moveTo(X - wd * .7, 0); c.lineTo(X + wd * .7, 0); c.lineTo(X + wd, h * .8); c.lineTo(X - wd, h * .8); c.fill();
                c.fillStyle = '#4a2a1c'; for (let k = 0; k < 5; k++) c.fillRect(X - wd * .6 + k * wd * .3, 0, 2, h * .8);
                // Foliage hangs in irregular dark sprays high on the trunk, not stacked cones.
                c.fillStyle = '#25332a'; for (let k = 0; k < 7; k++) { const y = h * (.01 + k * .045), side = k % 2 ? 1 : -1, r = wd * (1.6 + rnd(i * 31 + k) * 1.8); c.beginPath(); c.ellipse(X + side * r * .55, y, r, h * .018, side * .25, 0, Math.PI * 2); c.fill(); }
            });
        }
    }
    if (modeId === 'morning' || modeId === 'afternoon') { c.globalCompositeOperation = 'screen'; c.fillStyle = modeId === 'morning' ? '#dfe6ea2e' : '#e9eef01f'; c.fillRect(0, 0, w, h); }
    if (modeId === 'evening') {
        c.globalCompositeOperation = 'multiply'; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2f3c5c'); g.addColorStop(.6, '#9a7a74'); g.addColorStop(1, '#3a3a40'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'soft-light'; c.fillStyle = '#e39a6e26'; c.fillRect(0, 0, w, h);
    }
    if (modeId === 'night' || modeId === 'party') { c.globalCompositeOperation = 'multiply'; c.fillStyle = modeId === 'night' ? '#1a2335' : '#1a2238'; c.fillRect(0, 0, w, h); }
    if (modeId === 'evening' || modeId === 'night' || modeId === 'party') {
        c.globalCompositeOperation = 'source-over';
        // The lit interior mirrored in the glass: a row of downlight reflections and a warm haze of floor and tables.
        for (let x = w / 20; x < w; x += w / 10) {
            const g = c.createRadialGradient(x, h * .07, 0, x, h * .07, 14); g.addColorStop(0, 'rgba(255,226,190,.55)'); g.addColorStop(.35, 'rgba(255,226,190,.12)'); g.addColorStop(1, 'rgba(255,226,190,0)');
            c.fillStyle = g; c.fillRect(x - 14, h * .07 - 14, 28, 28);
        }
        const haze = c.createLinearGradient(0, h * .5, 0, h * .75), a = { evening: .08, night: .05, party: .12 }[modeId];
        haze.addColorStop(0, 'rgba(255,214,170,0)'); haze.addColorStop(.5, `rgba(255,214,170,${a})`); haze.addColorStop(1, 'rgba(255,214,170,0)'); c.fillStyle = haze; c.fillRect(0, h * .5, w, h * .25);
    }
    if (modeId === 'night' || modeId === 'party') {
        c.globalCompositeOperation = 'source-over';
        // Faint reflections of the frames and soffit, and a mullion glint.
        for (const [y, a] of [[.22, modeId === 'night' ? .07 : .12], [.36, .06], [.58, .05]]) { c.fillStyle = `rgba(255,231,204,${a})`; c.fillRect(0, h * y, w, h * .012); }
        c.fillStyle = 'rgba(255,255,255,.05)'; for (let x = w * .17; x < w; x += w / 3) c.fillRect(x, 0, 2, h);
        // Outside: campus path lights between the trunks. In the pane: the lamp-lit
        // study tables and the red exit signs, mirrored as soft glows.
        const glow = (x, y, r, rgb, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.4, `rgba(${rgb},${a * .3})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
        for (let n = 0; n < 5; n++) { const x = w * (.08 + n * .21 + rnd(n * 7.7) * .06); glow(x, h * .83, 26, '255,232,196', .5); glow(x, h * .9, 60, '255,232,196', .12); }
        if (modeId === 'night') { for (let n = 0; n < 3; n++) glow(w * (.18 + n * .31), h * .6, 22, '255,214,160', .35); glow(w * .92, h * .14, 12, '255,70,50', .45); }
    }
    c.restore();
}

export function buildHumboldtCommons(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const s = root.scale.x, w = W, d = D, h = H, bz = BACK, front = FRONT;
    const own = m => { room.ownedMaterials?.add?.(m); return m; };
    const tag = (m, surface) => { m.userData.roomSurface = surface; return m; };
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `library:${layout.id}:fixture:${id}` }); return obj; };
    const group = (id, name, at = [0, 0, 0], parent = root, turn = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); if (id) register(g, id, name); return g; };
    const baked = (parent, k, mat, shadow = true) => { const obj = mesh(parent, k.build(), mat); obj.castShadow = shadow; return obj; };

    // ---------- Materials (docs/library-humboldt-commons.md · materials) ----------
    // Painted gypsum is near-uniform: a faint 250 mm roller-lap rhythm and a 2 mm
    // stipple, no blotches. 1024 px = 2000 mm, sampled on refineRoomSurfaces' world
    // uv1 (mm / 120), so every wall, soffit and ceiling plane shares one texel density.
    // The shared plaster pass adds the 120 mm orange-peel bump.
    const PLASTER_MM = 2000;
    const plasterMap = repeating(canvasMap((c, S) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S);
        const lap = S / 8;
        for (let i = 0; i < 8; i++) {
            const g = c.createLinearGradient(i * lap, 0, (i + 1) * lap, 0), a = (.003 + rnd(i * 4.1) * .005).toFixed(3);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, `rgba(${i % 2 ? '0,0,0' : '255,255,255'},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.fillRect(i * lap, 0, lap, S);
        }
        for (let n = 0; n < 40000; n++) { c.fillStyle = n % 2 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'; c.fillRect(rnd(n * 1.37) * S | 0, rnd(n * 2.71) * S | 0, 1, 1); }
    }, 1024, 1024), 8);
    plasterMap.channel = 1; plasterMap.repeat.setScalar(120 / PLASTER_MM);
    // One material per paint colour; the old (length, height) arguments are no longer needed.
    const paints = new Map();
    const paint = color => paints.get(color) || paints.set(color, tag(own(material(color, { roughness: .92, map: plasterMap, dithering: true })), 'plaster')).get(color);
    const whiteFlat = tag(own(material('#ebeae5', { roughness: .92, dithering: true })), 'plaster');
    // Khaki olive eggshell (photo R:G:B ≈ 1 : .97 : .80); its roughness is restored after refine.
    const olive = tag(own(material('#84816f', { roughness: .92, dithering: true })), 'plaster');
    olive.userData.humboldtRoughness = .72;
    // Satin vinyl cove base, a touch lighter than black.
    const rubber = own(material('#2d2d2e', { roughness: .55 }));
    // Dark bronze anodised: a visible brown cast (the 'powder' pass sets roughness .60).
    const bronze = tag(own(material('#3a332b', { roughness: .5, metalness: .45 })), 'powder');
    // Matte black powder coat on frames and track.
    const frameBlack = tag(own(material('#1c1c1e', { roughness: .5, metalness: 0 })), 'powder');
    const plinthWhite = own(material('#ebe9e3', { roughness: .8 }));
    // Bleached redwood: wandering growth rings along each limb and a few seasoning
    // checks (dark core, lit lip). The same canvas is the bump: about .2 mm of raised
    // latewood and 1 mm checks.
    const boneGrain = canvasMap((c, cw, ch) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 120; i++) {
            c.strokeStyle = i % 3 ? 'rgba(0,0,0,.05)' : 'rgba(120,105,90,.06)'; c.lineWidth = .8 + rnd(i) * 1.6;
            const x0 = rnd(i * 3.1) * cw, dv = (rnd(i * 5.7) - .5) * 14;
            for (const ox of [-cw, 0, cw]) { c.beginPath(); c.moveTo(x0 + ox, 0); c.bezierCurveTo(x0 + ox + dv, ch * .33, x0 + ox - dv, ch * .66, x0 + ox, ch); c.stroke(); }
        }
        for (let i = 0; i < 9; i++) {
            const x = rnd(i * 13.3) * cw, y = rnd(i * 17.9) * ch * .8, len = 40 + rnd(i * 2.3) * 110, dx = (rnd(i) - .5) * 6;
            c.lineWidth = 1; c.strokeStyle = 'rgba(70,58,48,.32)'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3, y + len / 2, x + dx, y + len); c.stroke();
            c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x + 1.5, y + 4); c.quadraticCurveTo(x + 4.5, y + len / 2, x + 1.5 + dx, y + len - 4); c.stroke();
        }
    }, 256, 512);
    boneGrain.anisotropy = 4;
    // Bleached, oiled redwood rather than white plaster: each group carries its own tone (vertex colour).
    const sculptureWhite = own(material('#ffffff', { roughness: .78, map: boneGrain, bumpMap: boneGrain, bumpScale: 6 * s, vertexColors: true }));
    // Gallery accent on the figures only: five virtual spots from the aisle track
    // (x -600, 45° onto the fronts). No extra draws, no THREE lights; aimed in roomAtmosphere.
    const accentU = { efAccPos: { value: FIGURES.map(() => new THREE.Vector3()) }, efAccAim: { value: FIGURES.map(() => new THREE.Vector3(0, -1, 0)) }, efAccColor: { value: new THREE.Color(T3500) }, efAccGain: { value: 0 } };
    const accentSpots = FIGURES.map(([z, , ph, figs]) => ({ at: [-600, 5000, z - 500], target: [XL + 500, ph + (figs.every(f => f[2]) ? 850 : 1150), z] }));
    sculptureWhite.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, accentU);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 efAccWorld; varying vec3 efAccN;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nefAccWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; efAccN = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 efAccWorld; varying vec3 efAccN; uniform vec3 efAccPos[${FIGURES.length}]; uniform vec3 efAccAim[${FIGURES.length}]; uniform vec3 efAccColor; uniform float efAccGain;
vec3 efAccent(vec3 albedo) { vec3 n = normalize(efAccN); float sum = 0.0;
  for (int i = 0; i < ${FIGURES.length}; i++) { vec3 L = normalize(efAccPos[i] - efAccWorld); sum += max(dot(n, L), 0.0) * smoothstep(0.940, 0.970, dot(-L, efAccAim[i])); }
  return albedo * efAccColor * efAccGain * sum; }`)
            .replace('#include <opaque_fragment>', 'outgoingLight += efAccent(diffuseColor.rgb);\n#include <opaque_fragment>');
    };
    sculptureWhite.customProgramCacheKey = () => 'humboldt-figure-accent-v1';
    const pilotGreen = own(material('#154c3d', { roughness: .94 }));
    const pilotGold = own(material('#bca56d', { roughness: .42, metalness: .55 }));
    const paper = own(material('#eee8d9', { roughness: .94 }));
    const ink = own(material('#273d39', { roughness: .72 }));
    // Charcoal plank carpet tile, 250 × 1000 mm, monolithic random ashlar (never a
    // laminate half-bond); a 3 m repeat with ±4 % dye-lot variation between planks.
    const plank = { mm: 3000, courses: 12, per: 3 };
    const carpetMap = repeating(canvasMap((c, S) => {
        const ph = S / plank.courses, pw = S / plank.per;
        const tones = ['#53575d', '#4e5257', '#585c61', '#4b4f54', '#5b5e63', '#515559'], flecks = ['#8f979f2c', '#262b3234', '#8a857c1e', '#a39d931a'];
        const draw = (x, y, id) => {
            c.save(); c.beginPath(); c.rect(x, y, pw, ph); c.clip();
            c.fillStyle = tones[Math.floor(rnd(id * 3.1) * tones.length)]; c.fillRect(x, y, pw, ph);
            for (let n = 0; n < 1100; n++) { const k = id * 5003 + n; c.fillStyle = flecks[n % 4]; c.fillRect(x + rnd(k) * pw, y + rnd(k + .37) * ph, 2 + rnd(k + .71) * 2, 1); }
            if (rnd(id * 7.3) < .45) for (let b = 0, bands = 2 + Math.floor(rnd(id * 1.7) * 2); b < bands; b++) {
                const by = Math.round(y + 6 + rnd(id * 11 + b) * (ph - 12)); c.fillStyle = `rgba(170,176,182,${(.05 + rnd(id + b) * .05).toFixed(2)})`;
                for (let dx = rnd(id + b * 3) * 6; dx < pw;) { const len = 4 + rnd(id * 13 + dx) * 6; c.fillRect(x + dx, by, len, 1); dx += len + 2 + rnd(id * 17 + dx) * 3; }
            }
            c.fillStyle = '#14181d1c'; c.fillRect(x, y + ph - 1, pw, 1); c.fillRect(x + pw - 1, y, 1, ph); c.fillStyle = '#ffffff0a'; c.fillRect(x, y, pw, 1);
            c.restore();
        };
        for (let r = 0; r < plank.courses; r++) {
            const shift = (.1 + rnd(r * 5.3 + 1) * .8) * pw;
            for (let k = 0; k < plank.per; k++) { const x = shift + k * pw, id = r * plank.per + k + 1; draw(x, r * ph, id); if (x + pw > S) draw(x - S, r * ph, id); }
        }
    }, 1024, 1024), 8);
    // Taupe heathered loop pile (photo ≈ #867565, σ ≈ 18): 4 mm tuft rows, 2–7 mm
    // tufts, and 6–14 mm heather clusters that survive mipmapping. 1024 px = 1000 mm.
    const BROADLOOM_MM = 1000;
    const broadloomMap = repeating(canvasMap((c, S) => {
        c.fillStyle = '#8a7a6a'; c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 4) { c.fillStyle = (y >> 2) % 2 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.02)'; c.fillRect(0, y, S, 1); }
        const yarn = [['#5d5044', .18], ['#ac9d88', .16], ['#6c6861', .14], ['#9c836a', .16]];
        for (let n = 0; n < 26000; n++) {
            const [col, a] = yarn[n % 4], len = 2 + rnd(n * 5.3) * 5, wd = 1 + (rnd(n * 2.9) > .6);
            c.globalAlpha = a * (.5 + rnd(n * 7.1) * .5); c.fillStyle = col;
            tile(S, S, rnd(n * 1.1) * S, rnd(n * 3.7) * S, len, (x, y) => c.fillRect(x, y, len, wd));
        }
        for (let n = 0; n < 2600; n++) {
            const r = 4 + rnd(n * 9.7) * 5; c.globalAlpha = .15; c.fillStyle = n % 3 ? '#4d4136' : '#c2b4a0';
            tile(S, S, rnd(n * 4.3) * S, rnd(n * 8.9) * S, r * 1.4, (x, y) => { c.beginPath(); c.ellipse(x, y, r * 1.4, r * .8, 0, 0, 6.2832); c.fill(); });
        }
        c.globalAlpha = 1;
    }, 1024, 1024), 8);
    // Agglomerated cork, 1–4 mm granules, with ≈7 pinholes per 100 cm² (crushed lip, dark core). 512 px = 300 mm.
    const tackMap = repeating(canvasMap((c, S) => {
        c.fillStyle = '#b38c62'; c.fillRect(0, 0, S, S); mottle(c, S, S, 24, 77, '#ffffff07', '#00000007', 30, 110);
        const grain = ['#6e5233', '#c9a67a', '#56402a', '#bd9668'];
        for (let n = 0; n < 9000; n++) {
            const r = 1.2 + rnd(n * 2.9) ** 2 * 3.2, a = rnd(n * 4.3) * Math.PI; c.globalAlpha = .1 + rnd(n * 6.6) * .1; c.fillStyle = grain[n % 4];
            tile(S, S, rnd(n * 1.7) * S, rnd(n * 6.1) * S, r * 1.5, (x, y) => { c.beginPath(); c.ellipse(x, y, r * 1.4, r, a, 0, Math.PI * 2); c.fill(); });
        }
        c.globalAlpha = 1;
        for (let n = 0; n < 60; n++) {
            const x = rnd(n * 9.1) * S | 0, y = rnd(n * 3.7) * S | 0, big = n % 4 === 0;
            c.fillStyle = 'rgba(214,190,156,.55)'; c.fillRect(x - 1, y - 1, 3, 3); c.fillStyle = 'rgba(38,24,12,.85)'; c.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
        }
    }), 8);
    // Wood grain; `staves` adds edge-glued solid-wood staves, each a little different in tone.
    const oakGrain = (base, dark, light, strength = 1, staves = 0) => repeating(canvasMap((c, Wc, Hc) => {
        c.fillStyle = base; c.fillRect(0, 0, Wc, Hc);
        for (let k = 0; k < staves; k++) {
            const y = k * Hc / staves, warm = rnd(k * 3.3) > .5;
            c.fillStyle = `rgba(${warm ? '255,244,225' : '110,80,45'},${(.03 + rnd(k * 7.7) * .05).toFixed(3)})`; c.fillRect(0, y, Wc, Hc / staves);
            c.fillStyle = 'rgba(80,55,30,.10)'; c.fillRect(0, Math.round(y), Wc, 1);
        }
        for (let i = 0; i < 140; i++) {
            const y0 = rnd(i * 3.7) * Hc, k1 = 1 + i % 3, k2 = 3 + i % 5, a1 = 2 + rnd(i) * 6, a2 = .5 + rnd(i * 2) * 1.5, p1 = rnd(i * 5) * 6.2832, p2 = rnd(i * 7) * 6.2832;
            c.strokeStyle = i % 3 ? dark : light; c.globalAlpha = (.1 + rnd(i * 9) * .14) * strength; c.lineWidth = .6 + rnd(i * 11) * 1.8;
            for (const oy of [-Hc, 0, Hc]) { c.beginPath(); for (let x = 0; x <= Wc; x += 8) { const y = y0 + oy + a1 * Math.sin(6.2832 * k1 * x / Wc + p1) + a2 * Math.sin(6.2832 * k2 * x / Wc + p2); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
        }
        c.globalAlpha = .18 * strength; c.fillStyle = dark;
        for (let n = 0; n < 2000; n++) { const len = 2 + rnd(n) * 3; tile(Wc, Hc, rnd(n * 1.3) * Wc, rnd(n * 2.1) * Hc, len, (x, y) => c.fillRect(x, y, len, 1)); }
        c.globalAlpha = 1;
    }, 1024, 256));
    // Maple tops: eight 56 mm staves per 450 mm board (the top repeat is max/1800, min/450).
    const honeyOakMap = oakGrain('#b38a5a', '#5e3f22', '#e6c996'), mapleMap = oakGrain('#dccaa9', '#a07d55', '#f2e6cf', .7, 8);
    const honeyOak = tag(own(material('#ffffff', { map: honeyOakMap, roughness: .51 })), 'wood');
    // Café and side tables: maple tops with honey-oak bases in one draw. The parts carry
    // vertex colours (white top, HONEY base) over the shared maple map.
    const HONEY = '#ab8d66', cafeMap = mapleMap.clone(); cafeMap.repeat.set(1050 / 1800, 1050 / 450);
    const cafeWood = tag(own(material('#ffffff', { map: cafeMap, roughness: .45, vertexColors: true })), 'wood');
    const cafeOak = tag(own(material('#ffffff', { map: cafeMap, roughness: .45 })), 'wood');   // plain variant for life dressings (no colour attribute)
    const mapleTop = own(material('#ffffff', { map: mapleMap, roughness: .5 }));
    for (const m of [honeyOak, cafeWood, cafeOak, mapleTop]) { m.bumpMap = m.map.clone(); m.bumpMap.colorSpace = THREE.NoColorSpace; m.bumpScale = .08 * s; m.userData.roomFinishLocked = true; }
    const laminate = own(material('#e9e4d8', { roughness: .64, bumpMap: mapleMap.clone(), bumpScale: .12 * s })), steelGrey = own(material('#8a8d90', { roughness: .36, metalness: .78, envMapIntensity: .7 }));
    laminate.bumpMap.colorSpace = THREE.NoColorSpace; laminate.userData.roomFinishLocked = steelGrey.userData.roomFinishLocked = true;
    // 2×4 lay-in acoustic tile (1200 × 600 per 512 × 256 px): pinholes and worm
    // fissures, a 24 mm exposed tee that is brighter and proud, and a hairline reveal.
    // The map is its own bump, so refine leaves this material at roughness .95.
    const ceilingMap = repeating(canvasMap((c, Wc, Hc) => {
        c.fillStyle = '#f0efea'; c.fillRect(0, 0, Wc, Hc);
        for (let n = 0; n < 2600; n++) { c.fillStyle = `rgba(0,0,0,${(.05 + rnd(n * 3.9) * .07).toFixed(3)})`; c.fillRect(8 + rnd(n * 1.3) * (Wc - 16) | 0, 8 + rnd(n * 2.9) * (Hc - 16) | 0, 1, 1); }
        c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.08)';
        for (let n = 0; n < 260; n++) { let x = 10 + rnd(n * 1.7) * (Wc - 20), y = 10 + rnd(n * 2.3) * (Hc - 20); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd(n * 9 + k) - .5) * 6; y += (rnd(n * 13 + k) - .5) * 6; c.lineTo(x, y); } c.stroke(); }
        c.fillStyle = '#fbfbf9'; c.fillRect(0, 0, Wc, 5); c.fillRect(0, Hc - 5, Wc, 5); c.fillRect(0, 0, 5, Hc); c.fillRect(Wc - 5, 0, 5, Hc);
        c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(5, 5, Wc - 10, 1); c.fillRect(5, 5, 1, Hc - 10);
        c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(5, Hc - 6, Wc - 10, 1); c.fillRect(Wc - 6, 5, 1, Hc - 10);
    }, 512, 256), 8);
    const ceilingTile = (wx, dz) => { const map = ceilingMap.clone(); map.repeat.set(wx / 1200, dz / 600); return tag(own(material('#ffffff', { map, bumpMap: map, bumpScale: 1.5 * s, roughness: .95, dithering: true })), 'plaster'); };
    // Fixture lenses follow the architectural (wash) layer; desk task light follows practical.
    const lens = (color = '#fff6ea', emissive = T3500) => own(material(color, { emissive, emissiveIntensity: .4, roughness: .4 }));
    const lensA = lens(), lensB = lens(), canLens = lens('#fffaf2', '#fff0dc'), trackLens = lens('#fff3e2', T3000), grazerLens = lens();

    // ---------- Floors: charcoal tile commons, beige broadloom band ----------
    const floorBox = (mapSrc, x0, x1, z0, z1, rough, offset) => {
        const period = mapSrc === carpetMap ? plank.mm : BROADLOOM_MM;
        const map = mapSrc.clone(); map.repeat.set((x1 - x0) / period, (z1 - z0) / period); map.offset.set(...offset);
        const mat = tag(own(material('#ffffff', { map, bumpMap: map, bumpScale: (mapSrc === carpetMap ? .6 : .5) * s, roughness: rough, dithering: true })), 'fabric');
        const o = box(root, [x1 - x0, 30, z1 - z0], [(x0 + x1) / 2, -15, (z0 + z1) / 2], mat); o.castShadow = false; o.userData.humboldtFloor = mapSrc === carpetMap ? 'tile' : 'broadloom'; return o;
    };
    // A straight tile → broadloom edge across the full width (photo 1).
    floorBox(carpetMap, XL, XR, bz, BAND_Z, .96, [0, 0]);
    floorBox(broadloomMap, XL, XR, BAND_Z, STEP_Z, .96, [.37, .61]);
    floorBox(broadloomMap, XL, HALL_XR, STEP_Z, front, .96, [.11, .23]);
    // A carpet-to-carpet binder seam, not a metal reducer (photo 1).
    const strip = kit(); strip.box([XR - XL, 1, 10], [(XR + XL) / 2, .5, BAND_Z]);
    baked(root, strip, own(material('#302d2a', { roughness: .9 })), false);

    // A flush inset, not an extra loose rug: the green bay holds the home and
    // study poses without occupying the central gallery / circulation.
    const pilot = group('humboldt-pilot-bay', 'Proposed ErgoFlex pilot · green study bay', [7350, 0, DESK[1]]);
    pilotGreen.bumpMap = carpetMap.clone(); pilotGreen.bumpMap.repeat.set(3200 / plank.mm, 2700 / plank.mm); pilotGreen.bumpScale = .4 * s;
    const bay = box(pilot, [3200, 2, 2700], [0, 1.2, 0], pilotGreen); bay.castShadow = false;
    const edging = kit();
    for (const z of [-1335, 1335]) edging.box([3170, 1, 12], [0, 2.7, z]);
    for (const x of [-1585, 1585]) edging.box([12, 1, 2670], [x, 2.7, 0]);
    baked(pilot, edging, pilotGold, false);
    pilot.userData.humboldtPilot = { concept: true, size: [3200, 2700], clearAisleMm: 1800 };
    const floorText = canvasMap((c, cw, ch) => {
        c.fillStyle = '#154c3d'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#e1d3a6';
        c.font = '600 46px sans-serif'; c.textAlign = 'center'; c.fillText('ERGOFLEX  /  PILOT CONCEPT', cw / 2, 65);
        c.font = '24px sans-serif'; c.fillText('SIT   ·   STAND   ·   TILT   ·   RELOCATE', cw / 2, 111);
    }, 1024, 160);
    const floorLegend = mesh(pilot, new THREE.PlaneGeometry(1600, 250), own(material('#ffffff', { map: floorText, roughness: .96 })), [-1150, 3, 0]);
    floorLegend.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); floorLegend.castShadow = false;

    // ---------- Walls ----------
    const base = (parent, k) => baked(parent, k, rubber, false);
    // Back wall: white, glass bay with two grey columns, three wall washers.
    const back = new THREE.Group(); back.name = 'Humboldt commons back wall'; root.add(back);
    const backSeg = (x0, x1, y0 = 0, y1 = h) => box(back, [x1 - x0, y1 - y0, 80], [(x0 + x1) / 2, (y0 + y1) / 2, bz - 40], paint('#ebeae5', x1 - x0, y1 - y0));
    backSeg(XL, 750); backSeg(750, 4850, 4600, h); backSeg(4850, XR);
    const columns = kit(); for (const x of [1000, 4600]) columns.box([500, h, 500], [x, h / 2, bz + 250]);
    baked(back, columns, own(tag(material('#6b6c63', { roughness: .9 }), 'plaster')));
    const glassBack = { x0: 1250, x1: 4350, y1: 4600 };
    const backBase = kit(); backBase.box([750 - XL - 250, 100, 12], [(XL + 750 - 250) / 2, 50, bz + 6]).box([XR - 4850 - 250, 100, 12], [(XR + 4850 + 250) / 2, 50, bz + 6]); base(back, backBase);
    room.walls.push({ obj: back, axis: 'x', limit: bz * s });
    // Right wall: glass slot with olive column, the desk bay, the tackboard, an olive pilaster.
    const right = new THREE.Group(); right.name = 'Humboldt commons tackboard wall'; root.add(right);
    const rightSeg = (z0, z1, y0 = 0, y1 = h) => box(right, [80, y1 - y0, z1 - z0], [XR + 40, (y0 + y1) / 2, (z0 + z1) / 2], paint('#ebeae5', z1 - z0, y1 - y0));
    // Solid in the commons; past the olive pilaster the junction is glazed below the soffit.
    rightSeg(bz, -4800); rightSeg(-4800, -3200, SOFFIT, h); rightSeg(-3200, GLASS_Z); rightSeg(GLASS_Z, STEP_Z, SOFFIT, h);
    box(right, [500, SOFFIT, 500], [XR - 300, SOFFIT / 2, -4450], olive);
    box(right, [450, SOFFIT, 600], [XR - 225, SOFFIT / 2, 3700], olive);
    // The step: a white return wall to the narrower hall, an olive corner column,
    // then the hall's glass side at x 6000 and a solid run with a dark slot to the end.
    box(right, [XR - HALL_XR, h, 80], [(XR + HALL_XR) / 2, h / 2, STEP_Z + 40], paint('#ebeae5', XR - HALL_XR, h));
    const hallSeg = (z0, z1, y0 = 0, y1 = SOFFIT) => box(right, [80, y1 - y0, z1 - z0], [HALL_XR + 40, (y0 + y1) / 2, (z0 + z1) / 2], paint('#ebeae5', z1 - z0, y1 - y0));
    hallSeg(STEP_Z, SOLID_Z, CAFE_SOFFIT, SOFFIT); hallSeg(SOLID_Z, 23050); hallSeg(23950, front); hallSeg(23050, 23950, CAFE_SOFFIT - 50, SOFFIT);
    // Full height above the café soffit, so a raised camera never looks out through a gap.
    hallSeg(STEP_Z, front, SOFFIT, h);
    const hallColumns = kit(); hallColumns.box([600, CAFE_SOFFIT, 600], [HALL_XR, CAFE_SOFFIT / 2, STEP_Z + 300]);
    for (const z of [12500, 18500]) hallColumns.box([500, CAFE_SOFFIT, 500], [HALL_XR - 250, CAFE_SOFFIT / 2, z]);
    hallColumns.box([450, CAFE_SOFFIT, 300], [HALL_XR - 150, CAFE_SOFFIT / 2, 22000]);
    baked(right, hallColumns, olive);
    // The tall hall wall above the café soffit: redwood slat acoustic panels on
    // black felt, in a rhythm with the columns below, instead of 30 m of white.
    {
        const slats = kit();
        for (const [n, zc] of [10800, 13400, 16000, 18600, 21200, 23800].entries()) {
            slats.box([24, 2600, 2100], [HALL_XR - 14, 4950, zc], { color: '#1e2220' });
            for (let q = 0; q < 30; q++) { const t = rnd(n * 37 + q * 3.1); slats.box([38, 2560, 34], [HALL_XR - 45, 4950, zc - 1015 + q * 70], { color: t < .33 ? '#8a573a' : t < .66 ? '#7b4b31' : '#94634a' }); }
        }
        const panels = baked(right, slats, own(tag(material('#ffffff', { roughness: .62, vertexColors: true }), 'wood')), false); panels.name = 'Redwood slat acoustic panels'; panels.receiveShadow = false;
    }
    const tack = group('humboldt-tackboard', 'Tackboard wall', [0, 0, 0], right);
    for (let i = 0; i < 4; i++) {
        const z0 = -1000 + i * 900, map = tackMap.clone(); map.repeat.set(900 / 300, 2950 / 300); map.offset.set(rnd(i), rnd(i + 3));
        const panel = box(tack, [25, 2950, 897], [XR - 32.5, 1925, z0 + 450], own(material('#ffffff', { map, bumpMap: map, bumpScale: .8 * s, roughness: .92 }))); panel.castShadow = false;
    }
    const tackTrim = kit(); tackTrim.box([30, 40, 3640], [XR - 35, 450, 800]).box([30, 40, 3640], [XR - 35, 3400, 800]).box([30, 2990, 40], [XR - 35, 1925, -1020]).box([30, 2990, 40], [XR - 35, 1925, 2620]);
    baked(tack, tackTrim, honeyOak, false);
    // Signs sit flat against the existing wall. No floor-standing display in
    // the chair pullback zone. All text describes a proposed installation.
    const wallPrint = (parent, id, name, at, size, draw, resolution = [1024, 512]) => {
        const g = group(id, name, at, parent, -Math.PI / 2);
        box(g, [size[0] + 30, size[1] + 30, 24], [0, 0, -13], honeyOak).castShadow = false;
        const map = canvasMap(draw, ...resolution);
        const face = mesh(g, new THREE.PlaneGeometry(...size), own(material('#ffffff', { map, roughness: .85 })), [0, 0, 1]);
        face.castShadow = false; return { g, map };
    };
    wallPrint(right, 'humboldt-pilot-header', 'Flexible study · pilot concept sign', [XR - 65, 2870, DESK[1]], [1800, 500], (c, cw, ch) => {
        c.fillStyle = '#123f33'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#d3b96f'; c.fillRect(32, 32, 8, ch - 64);
        c.fillStyle = '#ece8d8'; c.font = '600 76px sans-serif'; c.fillText('FLEXIBLE STUDY', 70, 160);
        c.font = '42px sans-serif'; c.fillText('ErgoFlex · proposed pilot', 70, 255);
        c.fillStyle = '#d3b96f'; c.font = '32px sans-serif'; c.fillText('HUMBOLDT-INSPIRED COMMONS', 70, 365);
    });
    const bulletin = wallPrint(tack, 'humboldt-pilot-notice', 'Pilot daily activity and welcome board', [XR - 72, 2150, 200], [1100, 1450], () => {}, [768, 1024]);
    const agendas = {
        morning: ['OPENING / STAND', 'A fresh start', 'Raise the desk and plan the day.', 'Stand for a short research session.', 'Leave the main commons aisle clear.'],
        afternoon: ['RESEARCH / TOGETHER', 'A place at the same table', 'Roll alongside the shared study table.', 'Match the seated work surface height.', 'Keep the approach and turning bay clear.'],
        evening: ['DUSK / READING', 'Read, reflect, annotate', 'An 8° tilt brings the page closer.', 'Warm task light supports the pilot.', 'The gallery stays softly illuminated.'],
        night: ['CLOSING / STORAGE', 'Make room for tomorrow', 'Stow loose tools in the shelving.', 'Fold the desktop to 65° at the wall.', 'Open the floor for cleaning.'],
        party: ['PROJECT / TOGETHER', 'Bring your desk to the group', 'Join the mapping workshop.', 'Spread out notes, maps and ideas.', 'Keep the main gallery route open.']
    };
    const updateBulletin = phase => {
        const lines = agendas[phase] || agendas.morning, c = bulletin.map.image.getContext('2d'), cw = c.canvas.width, ch = c.canvas.height;
        c.fillStyle = '#f0ebdc'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#163f33'; c.fillRect(0, 0, cw, 210);
        c.fillStyle = '#d4be7b'; c.font = '600 25px sans-serif'; c.fillText('PROPOSED ERGOFLEX PILOT', 45, 65);
        c.fillStyle = '#ffffff'; c.font = '600 34px sans-serif'; c.fillText(lines[0], 45, 145);
        c.fillStyle = '#173e34'; c.font = '600 33px sans-serif'; c.fillText(lines[1], 45, 300);
        lines.slice(2).forEach((text, i) => { const y = 405 + i * 120; c.fillStyle = '#b29a55'; c.beginPath(); c.arc(62, y - 8, 18, 0, Math.PI * 2); c.fill(); c.fillStyle = '#253d36'; c.font = '24px sans-serif'; c.fillText(text, 100, y); });
        c.fillStyle = '#d6d3c3'; c.fillRect(45, 770, cw - 90, 2);
        c.fillStyle = '#446258'; c.font = '25px sans-serif'; c.fillText('SIT  /  STAND  /  TILT  /  RELOCATE', 45, 840);
        c.font = '20px sans-serif'; c.fillText('Explore the times of day · then Start Groove', 45, 910);
        c.fillText('A design concept inspired by the commons', 45, 960);
        bulletin.map.needsUpdate = true; bulletin.g.userData.dailyFocus = lines[1];
    };
    // Pinboard material samples / sketch cards leave most of the cork visible.
    wallPrint(tack, 'humboldt-material-notice', 'Commons material palette study', [XR - 72, 1950, 1700], [680, 900], (c, cw, ch) => {
        c.fillStyle = '#eee8d9'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#193e32'; c.font = '600 52px sans-serif'; c.fillText('MATERIAL NOTES', 55, 90);
        ['#154c3d', '#bca56d', '#b38a5a', '#54565a'].forEach((v, i) => { c.fillStyle = v; c.fillRect(55 + i * 235, 160, 200, 170); });
        c.fillStyle = '#32453e'; c.font = '34px sans-serif'; c.fillText('Forest  /  Brass  /  Oak  /  Charcoal', 55, 400);
        c.font = '30px sans-serif'; c.fillText('Quiet materials. Flexible workspace.', 55, 465);
    });
    const rightBase = kit(); rightBase.box([12, 100, -4800 - bz], [XR - 6, 50, (bz - 4800) / 2]).box([12, 100, GLASS_Z + 3200], [XR - 6, 50, (GLASS_Z - 3200) / 2])
        .box([XR - HALL_XR, 100, 12], [(XR + HALL_XR) / 2, 50, STEP_Z - 6]).box([12, 100, front - SOLID_Z], [HALL_XR - 6, 50, (SOLID_Z + front) / 2]); base(right, rightBase);
    room.walls.push({ obj: right, axis: 'z', limit: -XR * s });
    // Left wall: plain commons wall under the mezzanine balcony, the olive
    // gallery wall behind the canoe, then the full-height figure wall of the hall.
    const left = new THREE.Group(); left.name = 'Humboldt mezzanine and gallery wall'; root.add(left);
    const leftSeg = (z0, z1, y0, y1, mat) => box(left, [80, y1 - y0, z1 - z0], [XL - 40, (y0 + y1) / 2, (z0 + z1) / 2], mat || paint('#ebeae5', z1 - z0, y1 - y0));
    const OLIVE_Z = 4600, MEZ_LEN = MEZ[1] - MEZ[0], MEZ_MID = (MEZ[0] + MEZ[1]) / 2;
    leftSeg(bz, MEZ[0], 0, h); leftSeg(MEZ[0], OLIVE_Z, 0, 3800); leftSeg(OLIVE_Z, MEZ[1], 0, 3800, olive); leftSeg(MEZ[1], front, 0, h);
    // A 450 mm honey-oak fascia band along the balcony slab edge (photo 2's dark wood band).
    const fasciaMap = honeyOakMap.clone(); fasciaMap.repeat.set(MEZ_LEN / 1200, 450 / 300);
    box(left, [60, 450, MEZ_LEN], [XL - 30, 3800 + 225, MEZ_MID], tag(own(material('#ffffff', { map: fasciaMap, roughness: .51 })), 'wood'));
    // Olive pilasters break the long commons run; thin dark reveals line the olive and figure walls.
    const leftTrim = kit(); for (const z of [-1000, 3000]) leftTrim.box([300, 3800, 450], [XL + 150, 1900, z]);
    baked(left, leftTrim, olive);
    const reveals = kit(); for (const y of [1100, 2600]) reveals.box([6, 10, MEZ[1] - OLIVE_Z], [XL + 2, y, (OLIVE_Z + MEZ[1]) / 2]);
    for (const y of [3000, 4800]) reveals.box([6, 10, front - MEZ[1]], [XL + 2, y, (MEZ[1] + front) / 2]);
    reveals.box([6, 3800, 20], [XL + 2, 1900, MEZ[1]]);
    // Veneered fascia panels: 2440 mm long, with hairline joints.
    for (let z = MEZ[0] + 2440; z < MEZ[1]; z += 2440) reveals.box([4, 450, 4], [XL + 1, 3800 + 225, z]);
    baked(left, reveals, own(material('#8d8a80', { roughness: .9 })), false);
    // Mezzanine just outside the rectangle: floor slab, olive back wall, side walls and a ceiling.
    const mez = kit(); mez.box([3000, 400, MEZ_LEN], [XL - 1500, 4000, MEZ_MID]);
    baked(left, mez, whiteFlat);
    const mezFloor = broadloomMap.clone(); mezFloor.repeat.set(3000 / BROADLOOM_MM, MEZ_LEN / BROADLOOM_MM);
    box(left, [3000, 6, MEZ_LEN], [XL - 1500, 4203, MEZ_MID], tag(own(material('#ffffff', { map: mezFloor, roughness: .96 })), 'fabric')).castShadow = false;
    box(left, [80, h - 4200, MEZ_LEN], [XL - 3040, (h + 4200) / 2, MEZ_MID], olive);
    for (const z of MEZ) box(left, [3000, h - 4200, 80], [XL - 1500, (h + 4200) / 2, z + (z < 0 ? -40 : 40)], whiteFlat);
    box(left, [3080, 80, MEZ_LEN + 160], [XL - 1540, h + 40, MEZ_MID], whiteFlat).castShadow = false;
    const guard = kit(), guardCap = kit();
    for (let z = MEZ[0] + 50; z <= MEZ[1] - 50; z += 1500) guard.box([50, 1070, 50], [XL + 50, 4200 + 535, z]);
    for (const y of [4250, 5200]) guard.box([10, 40, MEZ_LEN - 100], [XL + 50, y, MEZ_MID]);
    for (let z = MEZ[0] + 100; z < MEZ[1] - 40; z += 100) guard.box([12, 950, 12], [XL + 50, 4725, z]);
    guardCap.box([80, 50, MEZ_LEN - 60], [XL + 50, 5245, MEZ_MID]);
    baked(left, guard, bronze, false); baked(left, guardCap, honeyOak, false);
    // Generic framed landscape prints and a blank placard on the olive wall, above the canoe.
    const print = (seed, Wp, Hp) => canvasMap((c, cw, ch) => {
        const g = c.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, ['#c9d4d6', '#d8cfbd'][seed % 2]); g.addColorStop(1, '#f1ece0'); c.fillStyle = g; c.fillRect(0, 0, cw, ch);
        for (let band = 0; band < 4; band++) { c.fillStyle = ['#5f735e', '#3f5547', '#8a8f6b', '#2f4038'][(band + seed) % 4]; c.beginPath(); c.moveTo(0, ch); for (let x = 0; x <= cw; x += cw / 16) c.lineTo(x, ch * (.42 + band * .13) + Math.sin(x / cw * 6 + seed + band) * ch * .05); c.lineTo(cw, ch); c.fill(); }
    }, Wp, Hp);
    const art = (id, z, size, seed, y = 2050) => {
        const g = group(id, 'Framed landscape print', [XL + 20, y, z], left);
        box(g, [30, size[1] + 60, size[0] + 60], [0, 0, 0], own(material('#2b2622', { roughness: .6 })));
        box(g, [4, size[1], size[0]], [17, 0, 0], own(material('#ffffff', { map: print(seed, 512, Math.round(512 * size[1] / size[0])), roughness: .8 }))).castShadow = false;
    };
    art('humboldt-art-0', 9300, [800, 650], 1, 1750); art('humboldt-art-1', 7400, [350, 450], 2, 1900);
    const plaque = own(material('#3a2c1f', { roughness: .55, metalness: .3 })), card = own(material('#f1eee6', { roughness: .9 }));
    box(left, [12, 200, 600], [XL + 6, 1350, 7400], plaque).castShadow = false;
    box(left, [4, 280, 215], [XL + 4, 1450, 10300], card).castShadow = false; box(left, [4, 280, 215], [XL + 4, 1400, 12400], card).castShadow = false;
    // Gallery track: under the balcony fascia over the canoe, then hung from the
    // high ceiling along the figure wall. Heads aim at the canoe and figures.
    // Track heads: [x, y, z, lean]. lean > 0 aims toward +x, < 0 toward the wall.
    const track = kit(), trackHeads = kit(), trackLensKit = kit(), TRACK_Y = 3780, HALL_TRACK_Y = 5200;
    const head = (k, lk, x, y, z, lean) => {
        k.cyl(8, 8, 90, [x, y - 60, z], { seg: 6 });
        trackHeads.cyl(45, 45, 150, [x + Math.sign(lean) * 55, y - 140, z], { rot: [0, 0, lean], seg: 14 });
        lk.cyl(38, 38, 4, [x + Math.sign(lean) * 115, y - 185, z], { rot: [0, 0, lean], seg: 14 });
    };
    // Under the balcony fascia, aimed out at the canoe.
    track.box([35, 35, 5800], [XL + 60, TRACK_Y, 8700]);
    for (const z of CANOE_HEADS) head(track, trackLensKit, XL + 60, TRACK_Y, z, .9);
    baked(left, track, frameBlack, false); baked(left, trackHeads, frameBlack, false); baked(left, trackLensKit, trackLens, false);
    // Down the figure hall two tracks hang from the high ceiling: the gallery run
    // aimed back at the figures, and an aisle run. Hidden with the other
    // 'Ceiling …' groups when the camera rises above the room.
    const hallTracks = new THREE.Group(); hallTracks.name = 'Ceiling gallery tracks'; root.add(hallTracks);
    const hallTrack = kit(), hallLens = kit();
    for (const [x, z0, z1] of [[-2900, HALL_Z, 22800], [-600, HALL_Z + 600, 24000]]) {
        hallTrack.box([35, 35, z1 - z0], [x, HALL_TRACK_Y, (z0 + z1) / 2]);
        for (let z = z0 + 500; z < z1; z += 3500) hallTrack.cyl(4, 4, h - HALL_TRACK_Y, [x, (h + HALL_TRACK_Y) / 2, z], { seg: 5 });
    }
    // Wall-track heads wash the upper figure wall; aisle-track heads are the figure accents
    // (the shader spots), plus two toward the café and the storefront path.
    for (const z of FIGURE_HEADS) head(hallTrack, hallLens, -2900, HALL_TRACK_Y, z, -1);
    for (const [z] of FIGURES) head(hallTrack, hallLens, -600, HALL_TRACK_Y, z - 500, -.83);
    for (const z of [23400, 25200]) head(hallTrack, hallLens, -600, HALL_TRACK_Y, z, .35);
    // The aisle run is a direct/indirect pendant: an up-facing lens strip over its length.
    hallLens.box([30, 4, 24000 - HALL_Z - 600], [-600, HALL_TRACK_Y + 20, (HALL_Z + 600 + 24000) / 2]);
    baked(hallTracks, hallTrack, frameBlack, false); baked(hallTracks, trackHeads, frameBlack, false); baked(hallTracks, hallLens, trackLens, false);
    const leftBase = kit(); leftBase.box([12, 100, front - bz], [XL + 6, 50, (bz + front) / 2]); base(left, leftBase);
    room.walls.push({ obj: left, axis: 'z', limit: -XL * s, sign: -1 });

    // ---------- Hall end wall: a glass storefront entry on the café half (cut away from outside) ----------
    const frontWall = new THREE.Group(); frontWall.name = 'Humboldt hall end wall'; root.add(frontWall);
    const DOOR = [1600, 5600], DOOR_H = 2100, TRANSOM = CAFE_SOFFIT - 50, alu = own(material('#c2c5c6', { roughness: .45, metalness: .35, envMapIntensity: .6 }));   // satin clear anodised: mostly diffuse, so it reads silver under room light
    const endSeg = (x0, x1, y0, y1) => box(frontWall, [x1 - x0, y1 - y0, 80], [(x0 + x1) / 2, (y0 + y1) / 2, front + 40], paint('#ebeae5', x1 - x0, y1 - y0));
    endSeg(XL, DOOR[0], 0, h); endSeg(DOOR[1], HALL_XR, 0, h); endSeg(DOOR[0], DOOR[1], TRANSOM, h);
    // Dark vestibule behind the glass, then the storefront: two pairs of 900 mm doors and a transom.
    const vestGlass = box(frontWall, [DOOR[1] - DOOR[0], TRANSOM, 10], [(DOOR[0] + DOOR[1]) / 2, TRANSOM / 2, front + 10], own(new THREE.MeshStandardMaterial({ color: '#8da0aa', roughness: .05, metalness: .1, transparent: true, opacity: .18, depthWrite: false, envMapIntensity: .35 })));
    vestGlass.castShadow = false;
    const storefront = kit(), mid = (DOOR[0] + DOOR[1]) / 2;
    for (const x of [DOOR[0], DOOR[0] + 1000, mid - 900, mid, mid + 900, DOOR[1] - 1000, DOOR[1]]) storefront.box([60, TRANSOM, 110], [x, TRANSOM / 2, front - 10]);
    storefront.box([DOOR[1] - DOOR[0], 60, 110], [mid, DOOR_H, front - 10]).box([DOOR[1] - DOOR[0], 60, 110], [mid, 30, front - 10]);
    for (const x of [mid - 120, mid + 120]) storefront.box([28, 900, 40], [x, 1050, front - 70]);
    baked(frontWall, storefront, alu, false);
    const endColumns = kit(); for (const x of [DOOR[0] - 300, DOOR[1] + 150]) endColumns.box([x === DOOR[0] - 300 ? 600 : 300, h, 450], [x, h / 2, front - 225]);
    baked(frontWall, endColumns, olive);
    const endBase = kit(); endBase.box([DOOR[0] - 600 - XL, 100, 12], [(XL + DOOR[0] - 600) / 2, 50, front - 6]); base(frontWall, endBase);
    room.walls.push({ obj: frontWall, axis: 'x', limit: front * s, sign: -1 });

    // ---------- Soffits and clerestory walls (hidden when the camera rises above them) ----------
    // The commons band (3600) over the desk bay and tackboard, and the lower café
    // soffit (3000, 3.8 m deep) along the hall glass. Each meets the high zone
    // with a fascia, then a white clerestory wall with a linear grazer at the top.
    const soffit = new THREE.Group(); soffit.name = 'Humboldt soffit band'; root.add(soffit);
    const band = (x0, x1, z0, z1, y) => {
        box(soffit, [x1 - x0, 600, z1 - z0], [(x0 + x1) / 2, y + 300, (z0 + z1) / 2], whiteFlat).castShadow = false;
        box(soffit, [x1 - x0, 4, z1 - z0], [(x0 + x1) / 2, y - 2, (z0 + z1) / 2], ceilingTile(x1 - x0, z1 - z0)).castShadow = false;
        box(soffit, [80, h - y - 600, z1 - z0], [x0 - 40, (h + y + 600) / 2, (z0 + z1) / 2], paint('#ebeae5', z1 - z0, h - y - 600)).castShadow = false;
    };
    band(SOFFIT_X, XR, bz, STEP_Z, SOFFIT); band(CAFE_SOFFIT_X, HALL_XR, STEP_Z, front, CAFE_SOFFIT);
    // Where the two meet: the clerestory return across x 2200–4800, and the 600 mm drop.
    box(soffit, [SOFFIT_X - CAFE_SOFFIT_X, h - SOFFIT, 80], [(SOFFIT_X + CAFE_SOFFIT_X) / 2, (h + SOFFIT) / 2, STEP_Z - 40], paint('#ebeae5', SOFFIT_X - CAFE_SOFFIT_X, h - SOFFIT)).castShadow = false;
    box(soffit, [HALL_XR - SOFFIT_X, SOFFIT - CAFE_SOFFIT, 80], [(HALL_XR + SOFFIT_X) / 2, (SOFFIT + CAFE_SOFFIT) / 2, STEP_Z + 40], whiteFlat).castShadow = false;
    const grilles = kit(); for (const z of [-3000, 2000, 7000]) grilles.box([10, 400, 600], [SOFFIT_X - 85, 5600, z]);
    for (const z of [13000, 18000, 23000]) grilles.box([10, 400, 600], [CAFE_SOFFIT_X - 85, 5600, z]);
    baked(soffit, grilles, own(material('#d8d8d4', { roughness: .7 })), false);
    room.walls.push({ obj: soffit, axis: 'y', limit: (SOFFIT - 50) * s, sign: -1 });

    // ---------- Glazing with graded North Coast views ----------
    const view = canvasMap(() => {}, 1536, 1024), viewCanvas = view.image, campus = new Image(); let viewMode = 'morning';
    const drawView = modeId => { gradeWindow(viewCanvas.getContext('2d'), campus, modeId, HUMBOLDT_MODES[modeId] || HUMBOLDT_MODES.morning); view.needsUpdate = true; root.userData.humboldtWindow = { mode: modeId, source: 'procedural-north-coast' }; };
    room.windowViewReady = Promise.resolve();
    const glass = new THREE.MeshBasicMaterial({ map: view }); own(glass);
    // Each pane samples the view at its own aspect, so the tall slot and the long curtain wall are not stretched.
    view.wrapS = THREE.RepeatWrapping;
    const pane = (parent, size, at, rotY, offset = 0) => {
        const g = new THREE.PlaneGeometry(...size), uv = g.attributes.uv, span = size[0] / size[1] / (viewCanvas.width / viewCanvas.height);
        for (let i = 0; i < uv.count; i++) uv.setX(i, .5 + offset + (uv.getX(i) - .5) * span);
        const p = mesh(parent, g, glass, at); p.rotation.y = rotY; p.castShadow = p.receiveShadow = false; return p;
    };
    pane(back, [glassBack.x1 - glassBack.x0, glassBack.y1], [(glassBack.x0 + glassBack.x1) / 2, glassBack.y1 / 2, bz - 30], 0);
    const bayFrame = kit(); for (const x of [glassBack.x0, 2280, 3320, glassBack.x1]) bayFrame.box([60, glassBack.y1, 150], [x, glassBack.y1 / 2, bz + 20]);
    for (const y of [40, 2400, glassBack.y1 - 30]) bayFrame.box([glassBack.x1 - glassBack.x0, 60, 150], [(glassBack.x0 + glassBack.x1) / 2, y, bz + 20]);
    baked(back, bayFrame, bronze, false);
    pane(right, [1600, SOFFIT], [XR + 30, SOFFIT / 2, -4000], -Math.PI / 2);
    const slotFrame = kit(); for (const z of [-4800, -4000, -3200]) slotFrame.box([150, SOFFIT, 60], [XR - 20, SOFFIT / 2, z]); slotFrame.box([150, 60, 1600], [XR - 20, 30, -4000]);
    baked(right, slotFrame, bronze, false);
    // The junction's curtain wall (x 9000) and the hall's (x 6000, to z 20000):
    // silver aluminium verticals every 1.5 m, transoms at 900 and 2300, a white
    // heater enclosure along the sill. Dusk glass after dark, not a billboard.
    const frontGlass = own(glass.clone()), curtain = kit(), sills = kit();
    const run = (x, z0, z1, top, inward) => {
        const p = pane(right, [z1 - z0, top], [x + 30, top / 2, (z0 + z1) / 2], -Math.PI / 2, rnd(z0 * .001) * .7); p.material = frontGlass;
        for (let z = z0; z <= z1 + 1; z += 1500) curtain.box([110, top, 50], [x - 55, top / 2, Math.min(Math.max(z, z0 + 25), z1 - 25)]);
        for (const y of [900, 2300, top - 20]) curtain.box([110, 45, z1 - z0], [x - 55, y, (z0 + z1) / 2]);
        sills.box([200, 350, z1 - z0], [x - 100 - inward, 175, (z0 + z1) / 2]);
        return p;
    };
    const frontPane = run(XR, GLASS_Z, STEP_Z, SOFFIT, 0); run(HALL_XR, STEP_Z + 600, SOLID_Z, CAFE_SOFFIT, 0);
    baked(right, curtain, alu, false); baked(right, sills, plinthWhite, false);
    // Behind the storefront: the outdoor view a short vestibule away, so the entry reads by day and dusk.
    const vestibule = pane(frontWall, [DOOR[1] - DOOR[0], TRANSOM], [(DOOR[0] + DOOR[1]) / 2, TRANSOM / 2, front + 600], Math.PI); vestibule.material = frontGlass;
    const vestSides = kit(); for (const x of [DOOR[0], DOOR[1]]) vestSides.box([40, TRANSOM, 600], [x, TRANSOM / 2, front + 300]);
    baked(frontWall, vestSides, whiteFlat, false);
    // Tall narrow dark-glass slot in the hall's solid run.
    box(right, [20, CAFE_SOFFIT - 50, 900], [HALL_XR + 10, (CAFE_SOFFIT - 50) / 2, 23500], own(material('#262c31', { roughness: .06, metalness: 0, envMapIntensity: .5 }))).castShadow = false;

    // ---------- Suspended black light frames (two switching circuits) ----------
    const ceiling = new THREE.Group(); ceiling.name = 'Ceiling light frames'; root.add(ceiling); room.ceilingFixture = ceiling;
    const frameBody = kit(), lensKitA = kit(), lensKitB = kit(), bottom = 4200, barY = bottom + 150;
    const frames = [
        { id: 'F1', c: [1000, -800], size: [4800, 4800], grid: 2, circuit: 'A' },
        { id: 'F2', c: [-400, -5000], size: [4800, 1800], grid: 1, circuit: 'B' },
        { id: 'F3', c: [700, 6200], size: [4800, 1800], grid: 1, circuit: 'B' }
    ];
    for (const f of frames) {
        const [cx, cz] = f.c, [sx, sz] = f.size, lk = f.circuit === 'A' ? lensKitA : lensKitB;
        const xs = f.grid === 2 ? [cx - sx / 2, cx, cx + sx / 2] : [cx - sx / 2, cx + sx / 2], zs = f.grid === 2 ? [cz - sz / 2, cz, cz + sz / 2] : [cz - sz / 2, cz + sz / 2];
        for (const z of zs) { frameBody.box([sx + 150, 300, 150], [cx, barY, z]); lk.box([sx, 4, 50], [cx, bottom - 2, z]); }
        for (const x of xs) { frameBody.box([150, 300, sz], [x, barY, cz]); lk.box([50, 4, sz], [x, bottom - 2, cz]); }
        for (const x of [cx - sx / 2, cx + sx / 2]) for (const z of [cz - sz / 2, cz + sz / 2]) { const top = slopeY(z); frameBody.cyl(3, 3, top - bottom - 300, [x, (top + bottom + 300) / 2, z], { seg: 5 }); }
    }
    baked(ceiling, frameBody, frameBlack, false); baked(ceiling, lensKitA, lensA, false); baked(ceiling, lensKitB, lensB, false);
    // Bright sloped plaster ceiling over the commons, flat down the junction and
    // the hall's high zone (hidden, like every 'Ceiling …' group, when the camera rises above it).
    const lid = new THREE.Group(); lid.name = 'Ceiling Humboldt sloped ceiling'; root.add(lid);
    const lidPaint = paint('#efeee9', SOFFIT_X - XL, 12000);
    const slopeLength = Math.hypot(SLOPE_Z - BACK, 2400), sloped = mesh(lid, new THREE.PlaneGeometry(SOFFIT_X - XL, slopeLength), lidPaint, [(SOFFIT_X + XL) / 2, (4800 + H) / 2, (BACK + SLOPE_Z) / 2]);
    sloped.rotation.x = Math.PI / 2 - SLOPE;
    const flat = (x0, x1, z0, z1) => { const m = mesh(lid, new THREE.PlaneGeometry(x1 - x0, z1 - z0), lidPaint, [(x0 + x1) / 2, H, (z0 + z1) / 2]); m.rotation.x = Math.PI / 2; };
    flat(XL, SOFFIT_X, SLOPE_Z, STEP_Z); flat(XL, CAFE_SOFFIT_X, STEP_Z, front);
    // A 600 mm white transfer beam marks the start of the figure hall.
    box(lid, [CAFE_SOFFIT_X - XL, 600, 400], [(CAFE_SOFFIT_X + XL) / 2, H - 300, HALL_Z], whiteFlat).castShadow = false;
    // Close the triangle between the slope and the mezzanine ceiling above the balcony opening.
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([XL, slopeY(MEZ[0]), MEZ[0], XL, H, SLOPE_Z, XL, H, MEZ[0]], 3)); tri.computeVertexNormals();
    mesh(lid, tri, own(material('#ebeae5', { roughness: .92, side: THREE.DoubleSide })));

    // ---------- Power: a flush floor box under every study table (one draw) ----------
    {
        const power = kit();
        for (const t of layout.tables) power.box([170, 4, 170], [t.at[0], 2, t.at[1]], { color: '#8d8a80' }).box([120, 5, 60], [t.at[0], 3, t.at[1] - 25], { color: '#2f3134' }).box([60, 5, 30], [t.at[0] + 40, 3, t.at[1] + 40], { color: '#b59a5a' });
        const boxes = baked(root, power, own(material('#ffffff', { vertexColors: true, roughness: .45, metalness: .4 })), false); boxes.name = 'Floor power boxes'; boxes.raycast = () => {};
    }
    // ---------- Recessed downlights (one instanced draw) ----------
    const cans = [];
    for (const x of [5900, 7700]) for (let z = -6200; z < STEP_Z - 400; z += 1800) cans.push([x, SOFFIT - 3, z, soffit]);
    cans.push([7700, SOFFIT - 3, -1700, soffit]);
    for (const [x, z] of HUMBOLDT_CAFE.filter(([x, z]) => z > STEP_Z && x > CAFE_SOFFIT_X)) cans.push([x, CAFE_SOFFIT - 3, z, soffit]);
    for (let z = 10200; z < front - 600; z += 2400) cans.push([2900, CAFE_SOFFIT - 3, z, soffit]);
    {
        const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(75, 75, 6, 20), canLens, cans.length), t = new THREE.Object3D();
        cans.forEach(([x, y, z], i) => { t.position.set(x, y, z); t.updateMatrix(); inst.setMatrixAt(i, t.matrix); });
        inst.castShadow = inst.receiveShadow = false; inst.name = 'Recessed downlights'; soffit.add(inst);
    }
    // Linear grazers along the top of both high clerestory walls.
    const grazer = kit(); grazer.box([40, 30, STEP_Z - bz - 400], [SOFFIT_X - 100, h - 60, (bz + STEP_Z) / 2]).box([40, 30, front - STEP_Z - 400], [CAFE_SOFFIT_X - 100, h - 60, (STEP_Z + front) / 2]);
    baked(soffit, grazer, grazerLens, false);

    // ---------- Furniture: study tables, café tables, side table ----------
    const tableLegs = (k, sx, sz, inset = 80) => { for (const x of [-sx / 2 + inset, sx / 2 - inset]) for (const z of [-sz / 2 + inset, sz / 2 - inset]) k.box([60, 720, 60], [x, 360, z]); };
    for (const t of layout.tables) {
        const [sx, sz] = t.size, g = group(t.id === layout.tables[0].id ? 'reading-table-0' : t.id, t.light ? 'Light laminate project table' : 'Commons study table', [t.at[0], 0, t.at[1]]);
        g.userData.humboldtTable = t.id;
        const legs = kit(); tableLegs(legs, sx, sz); if (!t.light) legs.box([sx - 160, 90, 22], [0, 670, -sz / 2 + 80]).box([sx - 160, 90, 22], [0, 670, sz / 2 - 80]);
        baked(g, legs, t.light ? steelGrey : honeyOak);
        const topMat = t.light ? laminate : mapleTop.clone(); if (!t.light) { topMat.map = mapleMap.clone(); topMat.map.center.set(.5, .5); topMat.map.repeat.set(Math.max(sx, sz) / 1800, Math.min(sx, sz) / 450); own(topMat); }
        const top = box(g, [sx, 30, sz], [0, 735, 0], topMat); if (!t.light && sz > sx) top.material.map.rotation = Math.PI / 2;
        box(g, [sx + 6, 28, sz + 6], [0, 734, 0], honeyOak).castShadow = false;
        g.userData.roomSupportHeights = [750];
    }
    for (const [i, [x, z]] of layout.cafe.entries()) {
        const g = group(`humboldt-cafe-${i}`, 'Round oak café table', [x, 0, z]), k = kit();
        k.cyl(520, 520, 30, [0, 735, 0], { seg: 64 });
        k.add(new THREE.TorusGeometry(520,5,8,64),[0,735,0],{rot:[Math.PI/2,0,0]});
        baked(g,k,cafeWood);
        const base=kit();base.cyl(275,290,16,[0,8,0],{seg:48}).cyl(54,70,693,[0,362.5,0],{seg:24}).cyl(225,90,14,[0,716,0],{seg:32});
        baked(g,base,bronze);g.userData.roomSupportHeights = [750];
    }
    const side = group('humboldt-side-table', 'Round oak side table', [layout.sideTable[0], 0, layout.sideTable[1]]), sk = kit();
    sk.cyl(250, 250, 30, [0, 535, 0], { seg: 28 }).cyl(28, 34, 500, [0, 270, 0], { color: HONEY }).cyl(170, 190, 25, [0, 12, 0], { seg: 24, color: HONEY }); baked(side, sk, cafeWood);
    room.propSupports.push({ obj: side, id: 'atelier-lamp-mushroom-warm', at: [-2260, 550, 5130] });

    // Student life: table and café dressings, per daypart (library-humboldt-life.mjs).
    const life = buildHumboldtLife({ room, root, layout, helpers, kit, group, baked, own, tag, canvasMap, PHASE, materials: { pilotGreen, pilotGold, ink, paper, honeyOak, cafeOak } });
    const studyChair = humboldtStudyChairs(room, layout, canvasMap);
    const readingDetails = humboldtReadingDetails(room, layout, helpers);
    const campusLife = addCampusLife({ room, root, layout, asset: group, byId: id => {
        let found; root.traverse(o => { if (o.userData.propId === id || o.userData.humboldtTable === id) found = o; }); return found;
    } });

    // ---------- Gallery: carved redwood canoe on a plinth, white figures ----------
    // Redwood dugout: straight coarse grain along the hull, adze facets at true size
    // (≈100 × 45 mm, lit lead edge, shadowed heel), and greyed oil-starved patches.
    // 1024 × 256: about 5 mm/px along the hull and 6 mm/px around the girth.
    const canoeMap = canvasMap((c, Wc, Hc) => {
        c.fillStyle = '#9a7a66'; c.fillRect(0, 0, Wc, Hc);
        for (let i = 0; i < 160; i++) {
            const y = rnd(i * 4.1) * Hc, amp = 2 + rnd(i * 6.3) * 5;
            c.strokeStyle = i % 3 ? 'rgba(40,22,14,.22)' : 'rgba(190,140,105,.14)'; c.lineWidth = .7 + rnd(i * 8.7) * 1.4;
            c.beginPath(); for (let x = 0; x <= Wc; x += 16) { const yy = y + amp * Math.sin(x / Wc * 6.2832 * (1 + i % 3) + i); x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke();
        }
        // Adze facets scattered (not in courses), so the hull reads hewn, not planked.
        for (let n = 0; n < 1768; n++) {
            const fw = 14 + rnd(n * 3.1) * 14, fh = 5 + rnd(n * 1.7) * 5;
            const x = rnd(n * 7.3 + .21) * Wc, y = rnd(n * 2.9 + .77) * Hc;
            const g = c.createLinearGradient(x - fw / 2, y, x + fw / 2, y);
            g.addColorStop(0, 'rgba(225,180,140,.20)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(25,12,6,.30)');
            c.fillStyle = g; c.beginPath(); c.ellipse(x, y, fw / 2, fh / 2, (rnd(n * 5.7 + 1) - .5) * .5, 0, 6.2832); c.fill();
        }
        mottle(c, Wc, Hc, 18, 9, 'rgba(150,140,130,.16)', 'rgba(0,0,0,0)', 20, 70);
    }, 1024, 256);
    canoeMap.anisotropy = 8; canoeMap.center.set(.5, .5); canoeMap.rotation = Math.PI / 2;
    // Long axis along the building, between the commons and the figure hall, against the olive wall.
    // Parallel to the wall (photo 2): a 1400 × 420 × 6000 plinth, a 5.2 m hull, 1 m beam, 550 deep.
    const canoe = group('humboldt-canoe', 'Carved redwood canoe on display', [CANOE[0], 0, CANOE[1]], root);
    canoe.userData.noSurfaceDrop = true;
    const PLINTH = 420, R = 500, HALF = 2600, DEPTH = 1.1;
    box(canoe, [1400, PLINTH, 6000], [0, PLINTH / 2, 0], plinthWhite, 6);
    // A plain hand-hewn dugout: half-round shell, lofted toward raised, tapered ends.
    const taper = along => Math.max(.32, Math.cos(along * Math.PI / 2) ** .35), sheer = along => along * along * 220, HULL_Y = PLINTH + 110 + R * DEPTH;
    const hull = (radius, inset) => {
        const g = new THREE.CylinderGeometry(radius, radius, HALF * 2, 28, 40, true, Math.PI / 2, Math.PI), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const along = p.getY(i) / HALF, t = taper(along);
            p.setXYZ(i, p.getX(i) * t, p.getZ(i) * t * DEPTH + sheer(along) + inset, p.getY(i));
        }
        g.computeVertexNormals(); return g;
    };
    // Two cradles whose tops meet the hull's keel line, so it rests rather than floats.
    const cradles = kit(); for (const z of [-1350, 1350]) { const a = z / HALF, top = HULL_Y - R * taper(a) * DEPTH + sheer(a); cradles.box([600, top - PLINTH, 160], [0, (top + PLINTH) / 2, z]); }
    baked(canoe, cradles, own(material('#3a2a20', { roughness: .6 })));
    // Swapping the cylinder's axes mirrors its winding, so both shells render double-sided.
    // Oiled exterior (albedo ≈ #583a2a, satin) and a drier, greyer interior (≈ #4e3a30) whose
    // adze facets read as real dents through the bump (about 1.5 mm).
    const canoeOut = own(material('#958073', { map: canoeMap, bumpMap: canoeMap, bumpScale: 3 * s, roughness: .56, side: THREE.DoubleSide }));
    const canoeIn = own(material('#86807e', { map: canoeMap, bumpMap: canoeMap, bumpScale: 6 * s, roughness: .7, side: THREE.DoubleSide }));
    mesh(canoe, hull(R, 0), canoeOut, [0, HULL_Y, 0]);
    mesh(canoe, hull(R - 38, -12), canoeIn, [0, HULL_Y, 0]);
    // Gunwale rim closes the 38 mm gap between the shells: lighter, hand-worn, a little glossier.
    const rim = kit(), rimPts = side => Array.from({ length: 41 }, (_, i) => { const a = -1 + i / 20; return new THREE.Vector3(side * (R - 19) * taper(a), HULL_Y + sheer(a) - 6, a * HALF); });
    for (const side of [-1, 1]) rim.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts(side)), 80, 21, 6), [0, 0, 0]);
    baked(canoe, rim, own(material('#83593f', { roughness: .48 })));
    // Solid bow and stern blocks close the shell's ends; one plain seat block near the stern. No carving.
    const solid = canoeOut, ends = kit();
    // Rounded bow and stern: a lower half-ellipsoid closes each open end of the shell.
    for (const sign of [-1, 1]) { const t = taper(sign), half = R * t, depth = R * t * DEPTH; ends.add(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, HULL_Y + sheer(1), sign * HALF], { scale: [half, depth, 280] }); }
    ends.box([580, 150, 260], [0, HULL_Y - 360, -1750]); baked(canoe, ends, solid);
    // Larger-than-life bleached figures, columnar, arms fused to the torso, small
    // faceless heads: one seated, a pair, one standing, one seated, a triad.
    // Each plinth is one editable group facing into the hall (+x).
    // Chainsaw-carved forms: tapered square blocks (legs as two touching blocks,
    // arms fused to the torso) and a capsule head, rather than turned limbs.
    const figure = (base, x, ph, height, seated, turn = 0, tone = null) => {
        const tint = o => ({ ...(o || {}), color: tone }), k = { add: (g, a, o) => base.add(g, a, tint(o)), box: (size, a, o) => base.box(size, a, tint(o)) };
        const c = Math.cos(turn), sn = Math.sin(turn), at = (dx, y, dz) => [x + dx * c + dz * sn, ph + y, -dx * sn + dz * c];
        const block = (w0, w1, len, dx, y, dz, depth = .7, tilt = 0) => { const g = new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, len, 4); g.rotateY(Math.PI / 4); k.add(g, at(dx, y, dz), { rot: [tilt, turn, 0], scale: [1, 1, depth] }); };
        const head = (y, dz, r) => k.add(new THREE.CapsuleGeometry(r * .8, r * .75, 4, 10), at(0, y, dz), { rot: [0, turn, 0], scale: [.92, 1, 1.05] });
        const H = height, r = H / 19;
        if (seated) {
            // Upright on a cube seat with a vertical slot, lower legs down to the plinth.
            k.box([460, 460, 460], at(0, 230, -60), { rot: [0, turn, 0] }); k.box([30, 300, 470], at(0, 260, -60), { rot: [0, turn, 0] });
            for (const dx of [-82, 82]) { block(150, 140, 470, dx, 235, 235, .9); block(150, 150, 360, dx, 520, 90, 1.1, Math.PI / 2); }
            block(320, 400, H * .38, 0, 470 + H * .19, -70, .55); for (const dx of [-225, 225]) block(80, 90, H * .32, dx, 480 + H * .17, -55, .75);
            block(90, 90, 80, 0, 470 + H * .38 + 40, -70, 1); head(470 + H * .38 + 80 + r * 1.2, -65, r);
        } else {
            for (const dx of [-79, 79]) block(150, 165, H * .47, dx, H * .235, 0, .8);
            block(330, 420, H * .34, 0, H * .64, 0, .55); for (const dx of [-232, 232]) block(80, 92, H * .37, dx, H * .615, 8, .78);
            block(92, 96, H * .045, 0, H * .832, 0, 1); head(H * .855 + r * 1.2, 4, r);
        }
    };
    const figurePlate = own(material('#5a4a34', { roughness: .4, metalness: .6, vertexColors: true }));
    for (const [i, [z, along, ph, figs]] of FIGURES.entries()) {
        const g = group(`humboldt-sculpture-${i}`, 'Bleached wood figure group on plinth', [XL + 500, 0, z], root, Math.PI / 2), k = kit();
        box(g, [along, ph, 700], [0, ph / 2, 0], plinthWhite, 4);
        const tones = ['#f3eee4', '#ece4d5', '#f5f1e9', '#e7dcc9', '#efe8db'];   // limed, pale: the figures stay the hall's light notes (the film's morning was graded with them white)
        for (const [n, [dz, height, seated, turn]] of figs.entries()) figure(k, -dz, ph, height, seated, turn || 0, tones[(i * 2 + n) % tones.length]);
        baked(g, k, sculptureWhite);
        // A bronze caption plate on the plinth face, as a gallery would label the work.
        const plate = kit(); plate.box([300, 95, 6], [0, ph - 170, 353]); plate.box([220, 8, 2], [0, ph - 150, 357], { color: '#d9c9a0' }); plate.box([170, 6, 2], [0, ph - 180, 357], { color: '#c9b78e' });
        baked(g, plate, figurePlate, false);
    }

    // ---------- Exit sign ----------
    const exitMap = canvasMap((c, cw, ch) => { c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#ff3b2f'; c.font = 'bold 74px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT', cw / 2, ch / 2 + 4); }, 256, 128);
    const EXIT = [(DOOR[0] + DOOR[1]) / 2, DOOR_H + 300];
    // A second, ceiling-hung double-face sign under the café soffit near the junction (photo 2).
    const exitMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', map: exitMap, emissive: '#ff2a1f', emissiveMap: exitMap, emissiveIntensity: 1.2, toneMapped: false }));
    box(soffit, [300, 160, 40], [3600, CAFE_SOFFIT - 150, STEP_Z + 900], exitMat).castShadow = false;
    rod(soffit, [3600, CAFE_SOFFIT - 70, STEP_Z + 900], [3600, CAFE_SOFFIT, STEP_Z + 900], 6, frameBlack).castShadow = false;
    const exit = box(frontWall, [300, 160, 40], [EXIT[0], EXIT[1], front - 20], own(new THREE.MeshStandardMaterial({ color: '#ffffff', map: exitMap, emissive: '#ff2a1f', emissiveMap: exitMap, emissiveIntensity: 1.2, toneMapped: false })));
    exit.castShadow = false;

    // ---------- Wear: multiply decals (white = untouched) ----------
    // Broadloom traffic lanes, the storefront walk-off, wall-base grime and chair-back
    // rub. MultiplyBlending on the tone-mapped sRGB result, so a decal can only darken,
    // in any daypart. One 512 × 256 atlas; floor lanes in root, wall grime inside each
    // cut-away wall group. Presentation only: no shadows, rays, Groove or editor identity.
    const wearMap = canvasMap((c, cw, ch) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, cw, ch);
        // Lane (top-left): an ellipse inscribed in its plane, −6 % at the centre.
        c.save(); c.translate(128, 64); c.scale(124, 60); let g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, '#efedea'); g.addColorStop(.55, '#f5f4f2'); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
        // Base (top-right): grime darkest at the floor edge (canvas y 128), scuffs and heel marks.
        g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, '#eceae6'); g.addColorStop(.35, '#f8f7f5'); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fillRect(256, 0, 256, 128);
        for (let n = 0; n < 40; n++) {
            const x = 262 + rnd(n * 2.7) * 230, y = 126 - rnd(n * 5.1) ** 2 * 90, len = 6 + rnd(n * 8.3) * 26;
            c.strokeStyle = n % 5 ? 'rgba(120,112,104,.22)' : 'rgba(30,28,26,.30)'; c.lineWidth = n % 5 ? 1 : 1.5;
            c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y - 1.5, x + len, y + rnd(n) * 2); c.stroke();
        }
        // Rub (bottom-left): a soft horizontal smudge where chair backs touch the wall.
        c.save(); c.translate(128, 192); c.scale(124, 26); g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, '#eeece8'); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
    }, 512, 256);
    const wearMat = own(new THREE.MeshBasicMaterial({ map: wearMap, transparent: true, depthWrite: false, toneMapped: false,
        blending: THREE.MultiplyBlending, premultipliedAlpha: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    // Atlas regions [u0, v0, u1, v1]; CanvasTexture flips Y, so the canvas top is v 1.
    const ATLAS = { lane: [.005, .505, .495, .995], base: [.505, .505, .995, .995], rub: [.005, .005, .495, .495] };
    const decal = (k, part, size, at, rot) => {
        const g = new THREE.PlaneGeometry(...size), uv = g.attributes.uv, [u0, v0, u1, v1] = ATLAS[part];
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
        return k.add(g, at, { rot });
    };
    const noRay = () => {};
    const wearOut = (parent, k, name) => {
        const o = mesh(parent, k.build(), wearMat); o.name = name; o.castShadow = o.receiveShadow = false; o.renderOrder = 1; o.raycast = noRay;
        o.userData.presentationOnly = true; o.userData.grooveMarker = true; o.userData.humboldtWear = true; return o;
    };
    const ON_FLOOR = [-Math.PI / 2, 0, 0], ON_LEFT = [0, Math.PI / 2, 0], ON_RIGHT = [0, -Math.PI / 2, 0], ON_FRONT = [0, Math.PI, 0], ON_BACK = [0, 0, 0];
    {
        // Beige broadloom shows soil; the charcoal tile hides it, so the lanes stay on the broadloom.
        const wear = new THREE.Group(); wear.name = 'Humboldt carpet wear'; wear.userData.grooveMarker = true; wear.userData.presentationOnly = true; root.add(wear);
        const lanes = kit(), doorX = (DOOR[0] + DOOR[1]) / 2;
        decal(lanes, 'lane', [3000, 15500], [200, 1.5, 17000], ON_FLOOR);          // hall walkway between figures and café
        decal(lanes, 'lane', [3400, 6500], [1800, 1.5, 7000], ON_FLOOR);           // commons → hall crossing past the canoe
        decal(lanes, 'lane', [3200, 2400], [doorX, 1.5, front - 1200], ON_FLOOR);  // storefront walk-off,
        decal(lanes, 'lane', [2200, 1600], [doorX, 1.6, front - 900], ON_FLOOR);   // doubled at the threshold
        wearOut(wear, lanes, 'Broadloom traffic lanes');
        // Wall bases and chair-back rub, only where furniture, bins or carts really touch.
        const lw = kit();
        decal(lw, 'base', [6000, 300], [XL + 1.5, 150, 1500], ON_LEFT); decal(lw, 'base', [1600, 300], [XL + 1.5, 150, 4500], ON_LEFT);
        decal(lw, 'rub', [1100, 260], [XL + 1.5, 820, 3700], ON_LEFT); wearOut(left, lw, 'Gallery wall base grime');
        const rw = kit(); decal(rw, 'base', [5000, 300], [XR - 1.5, 150, 800], ON_RIGHT); wearOut(right, rw, 'Tackboard wall base grime');
        const bw = kit(); decal(bw, 'base', [750 - XL, 300], [(XL + 750) / 2, 150, bz + 1.5], ON_BACK); decal(bw, 'base', [XR - 4850, 300], [(XR + 4850) / 2, 150, bz + 1.5], ON_BACK);
        wearOut(back, bw, 'Back wall base grime');
        const fw = kit(); decal(fw, 'base', [3000, 300], [-1500, 150, front - 1.5], ON_FRONT); decal(fw, 'rub', [2200, 260], [-1500, 820, front - 1.5], ON_FRONT);
        wearOut(frontWall, fw, 'End wall base grime');
    }
    // Eggshell paint: refine's roomSurfaceFinish forces plaster to .92. This runs after
    // the synchronous refine pass, on the materials actually on the meshes.
    queueMicrotask(() => root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m?.userData?.humboldtRoughness) m.roughness = m.userData.humboldtRoughness; }));

    // ---------- Light pools: scallops, floor pools, cork and desk accents ----------
    const pools = createPoolLayer(root, 'Humboldt architectural light');
    const merged = (quads, face) => { const k = kit(); for (const [size, at] of quads) k.plane(size, at, { rot: face }); return k.build(); };
    const FLOOR = [-Math.PI / 2, 0, 0], BACKF = [0, 0, 0], RIGHTF = [0, -Math.PI / 2, 0], LEFTF = [0, Math.PI / 2, 0];
    const addMerged = (parent, quads, face, color, levels) => pools.add(parent, [0, 0, 0], [1, 1], color, levels, [0, 0, 0], merged(quads, face));
    // Linear ("ramp") pools for grazers, coves and ceilings: one quad with a smooth
    // 1-D falloff per axis, so long washes never scallop or ring.
    // Stops are [[t, alpha], ...]; u runs along the plane's local x, v from bottom (0) to top (1).
    const smooth = (stops, t) => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, a0] = stops[i - 1], [t1, a1] = stops[i], k = (t - t0) / (t1 - t0 || 1); return a0 + (a1 - a0) * k * k * (3 - 2 * k); } return stops.at(-1)[1]; };
    const rampMap = (u, v) => {
        const map = canvasMap((c, cw, ch) => {
            const img = c.createImageData(cw, ch);
            for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = (y * cw + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * smooth(u, x / (cw - 1)) * smooth(v, 1 - y / (ch - 1))); }
            c.putImageData(img, 0, 0);
        }, 256, 256);
        map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; return map;
    };
    const rampPool = (parent, at, size, face, color, levels, map) => { const o = pools.add(parent, at, size, color, levels, face); o.material.map = map; o.material.userData.sharedTextures = false; return o; };
    const edges = [[0, 0], [.03, 1], [.97, 1], [1, 0]];
    // Back-wall washer scallops (apex + long tail), avoiding the glass bay.
    const backScallops = [[-3300, 4800], [-1000, 4800], [7000, SOFFIT]];
    addMerged(back, backScallops.map(([x, top]) => [[900, 640], [x, top - 520, bz + 6]]), BACKF, T3500, [.08, .07, .24, .08, .26]);
    addMerged(back, backScallops.map(([x, top]) => [[1250, 2600], [x, top - 1500, bz + 6]]), BACKF, T3500, [.06, .05, .17, .05, .18]);
    // Right-wall scallops phased to the desk; the desk's own scallop stays up at night.
    const rightScallops = [DESK[1] - 3600, DESK[1] + 5400, DESK[1] + 7200, DESK[1] + 9000].filter(z => z > bz + 400 && z < GLASS_Z - 400 && (z < -1000 || z > 2700));
    addMerged(right, rightScallops.map(z => [[900, 640], [XR - 6, SOFFIT - 520, z]]), RIGHTF, T3500, [.08, .07, .24, .08, .26]);
    addMerged(right, rightScallops.map(z => [[1250, 2100], [XR - 6, SOFFIT - 1300, z]]), RIGHTF, T3500, [.06, .05, .17, .05, .18]);
    pools.add(right, [XR - 6, SOFFIT - 520, DESK[1]], [780, 600], T4000, [.05, .045, .14, .17, .13], 'right');
    pools.add(right, [XR - 6, SOFFIT - 1300, DESK[1]], [1300, 2100], T4000, [.025, .02, .07, .09, .07], 'right');
    // Tackboard: three scallops across the panel; cork is dark, so it takes more.
    addMerged(tack, [-350, 800, 1950].map(z => [[900, 620], [XR - 50, 3400 - 250, z]]), RIGHTF, T3500, [.06, .05, .16, .16, .18]);
    addMerged(tack, [-350, 800, 1950].map(z => [[1300, 2100], [XR - 50, 3400 - 1250, z]]), RIGHTF, T3500, [.04, .04, .12, .12, .13]);
    // Top grazer down the high right wall.
    // Clerestory grazers: one ramp per wall, brightest at the top lens (commons face x 4720, hall face x 2120).
    const grazeMap = rampMap(edges, [[0, .05], [.35, .18], [.65, .45], [.88, .85], [1, 1]]);
    rampPool(soffit, [SOFFIT_X - 86, 5700, (bz + STEP_Z) / 2], [STEP_Z - bz - 400, 3000], RIGHTF, '#fff2e4', [.08, .06, .32, .06, .28], grazeMap);
    rampPool(soffit, [CAFE_SOFFIT_X - 86, 5400, (STEP_Z + front) / 2], [front - STEP_Z - 400, 3600], RIGHTF, '#fff2e4', [.10, .08, .46, .06, .34], grazeMap);
    // The hall's bright upper zone: uplight from the aisle pendant on the lid, and the figure wall above the reveal.
    rampPool(lid, [(XL + CAFE_SOFFIT_X) / 2, H - 8, (STEP_Z + front) / 2], [CAFE_SOFFIT_X - XL, front - STEP_Z - 400], [Math.PI / 2, 0, 0], '#fff4ea', [.14, .10, .42, .05, .30],
        rampMap([[0, .4], [.25, .7], [.576, 1], [.85, .8], [1, .65]], [[0, 0], [.05, 1], [.95, 1], [1, 0]]));
    rampPool(left, [XL + 6, 5100, (MEZ[1] + front) / 2], [front - MEZ[1] - 400, 4200], LEFTF, '#fff4ea', [.06, .05, .18, .03, .12], rampMap(edges, [[0, .25], [.5, .45], [.85, .85], [1, 1]]));
    pools.add(frontWall, [-1400, 4200, front - 6], [5200, 5000], '#fff4ea', [.04, .04, .12, .02, .10], 'back');
    // Floor pools: frames by circuit, downlights, the desk, the collection.
    // Frame uplight lands on the ceiling: the bright lid of the reference photos.
    const lidPool = circuit => { const k = kit(); for (const f of frames.filter(f => f.circuit === circuit)) k.plane([f.size[0] + 4200, f.size[1] + 4200], [f.c[0], slopeY(f.c[1]) - 8, f.c[1]], { rot: [Math.PI / 2 - (f.c[1] < SLOPE_Z ? SLOPE : 0), 0, 0] }); return k.build(); };
    pools.add(lid, [0, 0, 0], [1, 1], T3500, [.06, .05, .13, .12, .15], [0, 0, 0], lidPool('A'));
    pools.add(lid, [0, 0, 0], [1, 1], T3500, [.06, .05, .13, 0, .15], [0, 0, 0], lidPool('B'));
    const frameFloor = circuit => frames.filter(f => f.circuit === circuit).map(f => [[f.size[0] + 1600, f.size[1] + 1600], [f.c[0], 3, f.c[1]]]);
    addMerged(root, frameFloor('A'), FLOOR, T3500, [.05, .05, .15, .13, .17]);
    addMerged(root, frameFloor('B'), FLOOR, T3500, [.05, .05, .15, 0, .17]);
    addMerged(root, cans.filter(([, , z]) => Math.abs(z - DESK[1]) > 700 && z < GLASS_Z).map(([x, , z]) => [[2200, 2200], [x, 3, z]]), FLOOR, T3500, [.04, .04, .11, .02, .1]);
    // Café cans sit near the hall glass, so their pools stay small enough to end at the floor edge.
    addMerged(root, cans.filter(([, , z]) => z > GLASS_Z && z < STEP_Z).map(([x, , z]) => [[1500, 1500], [x, 3, z]]), FLOOR, T3500, [.03, .03, .09, .015, .09]);
    // The café reads warmer than the study zone: a 3000 K can over each table, a cooler circulation row.
    addMerged(root, cans.filter(([x, , z]) => z > STEP_Z && x > 4000).map(([x, , z]) => [[1900, 1900], [x, 3, z]]), FLOOR, T3000, [.02, .02, .11, .015, .16]);
    addMerged(root, cans.filter(([x, , z]) => z > STEP_Z && x < 4000).map(([x, , z]) => [[1500, 1500], [x, 3, z]]), FLOOR, '#fff0de', [.02, .02, .07, .02, .06]);
    pools.add(root, [DESK[0] - 300, 3, DESK[1]], [2000, 1700], T3500, [.03, .03, .1, .13, .09]);
    pools.add(root, [2800, 3, -5000], [5200, 4200], '#e6edf0', [.16, .2, .04, 0, 0]);
    // A broad, restrained work pool follows the new collaborative zone.
    pools.add(root, [6000, 752, 1600], [3600, 2100], T4000, [.015, .10, .025, 0, .14]);
    pools.add(root, [-2150, 3, 5050], [2500, 2000], T3000, [.02, .035, .12, .015, .065]);
    pools.add(root, [8000, 3, -4000], [2400, 2000], '#e6edf0', [.12, .14, .03, 0, 0]);
    // Marine-layer daylight: one soft band along each run of glass.
    const glassBands = [[[2800, STEP_Z - GLASS_Z], [XR - 1400, 3, (GLASS_Z + STEP_Z) / 2]], [[2600, SOLID_Z - STEP_Z], [HALL_XR - 1300, 3, (STEP_Z + SOLID_Z) / 2]], [[4400, 2800], [(DOOR[0] + DOOR[1]) / 2, 3, front - 1400]]];
    addMerged(root, glassBands, FLOOR, '#e3ebf0', [.16, .20, 0, 0, 0]);
    // Blue hour: cool at the glass, warm inside.
    addMerged(root, glassBands, FLOOR, '#9fb2d4', [0, 0, .04, 0, .015]);
    // Sun through the junction and hall curtain walls once the marine layer
    // burns off: every pane between mullions, transoms and the sill heater is
    // projected along the room's own key-light direction (room-refinement
    // DAY_ANGLES, outward +x), so the patches agree with furniture shadows.
    // A short, high, near-white patch in the afternoon; at dusk faint, soft,
    // red-amber bars of the last sun that cross the café and reach the gallery wall.
    // Morning stays overcast. One floor and one wall overlay, redrawn per daypart.
    const SUN = { afternoon: { elevation: 1.45, sweep: .12, color: '#fff0d8', level: .22 }, evening: { elevation: .32, sweep: .48, color: '#ffb98a', level: .1 } };
    const sunRuns = [{ x: XR, z0: GLASS_Z, z1: STEP_Z, top: SOFFIT }, { x: HALL_XR, z0: STEP_Z + 600, z1: SOLID_Z, top: CAFE_SOFFIT }];
    const sunColumns = [[HALL_XR - 250, 12500, 250], [HALL_XR - 250, 18500, 250]];
    const SUN_F = { x0: XL, x1: XR, z0: GLASS_Z - 4200, z1: SOLID_Z + 600 }, SUN_W = { z0: GLASS_Z - 4200, z1: SOLID_Z + 600, y1: 3600 };
    const sunCanvas = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map; };
    const sunFloorMap = sunCanvas(768, 1024), sunWallMap = sunCanvas(1024, 256);
    const sunFloor = pools.add(root, [(SUN_F.x0 + SUN_F.x1) / 2, 4, (SUN_F.z0 + SUN_F.z1) / 2], [SUN_F.x1 - SUN_F.x0, SUN_F.z1 - SUN_F.z0], '#ffffff', [0, SUN.afternoon.level, SUN.evening.level, 0, 0], FLOOR);
    const sunWall = pools.add(root, [XL + 5, SUN_W.y1 / 2, (SUN_W.z0 + SUN_W.z1) / 2], [SUN_W.z1 - SUN_W.z0, SUN_W.y1], '#ffffff', [0, 0, SUN.evening.level * .8, 0, 0], LEFTF);
    for (const [o, map] of [[sunFloor, sunFloorMap], [sunWall, sunWallMap]]) { o.material.map = map; o.material.userData.sharedTextures = false; o.name = 'Sun through the curtain wall'; }
    let sunDrawn = null;
    const drawSun = modeId => {
        const sun = SUN[modeId]; if (!sun) return; sunFloor.userData.lightPool.color.set(sun.color); sunWall.userData.lightPool.color.set(sun.color);
        if (sunDrawn === modeId) return; sunDrawn = modeId;
        const hz = Math.hypot(1, sun.sweep), tanE = sun.elevation / hz, ca = 1 / hz, sa = sun.sweep / hz;
        // Floor hit of a glass point, and its hit on the gallery wall (x = XL).
        const onFloor = (x, y, z) => { const r = y / tanE; return [x - ca * r, z - sa * r]; };
        const onWall = (x, y, z) => { const r = (x - XL) / ca; return [z - sa * r, y - r * tanE]; };
        const fc = sunFloorMap.image.getContext('2d'), FW = fc.canvas.width, FH = fc.canvas.height;
        const wc = sunWallMap.image.getContext('2d'), WW = wc.canvas.width, WH = wc.canvas.height;
        const fp = ([x, z]) => [(x - SUN_F.x0) / (SUN_F.x1 - SUN_F.x0) * FW, (z - SUN_F.z0) / (SUN_F.z1 - SUN_F.z0) * FH];
        const wp = ([z, y]) => [(SUN_W.z1 - z) / (SUN_W.z1 - SUN_W.z0) * WW, (SUN_W.y1 - y) / SUN_W.y1 * WH];
        for (const [c, cw, chh] of [[fc, FW, FH], [wc, WW, WH]]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cw, chh); }
        const quad = (c, pts) => { c.beginPath(); pts.forEach(([u, v], i) => i ? c.lineTo(u, v) : c.moveTo(u, v)); c.closePath(); c.fill(); };
        // The building outline clips the floor (the hall glass steps in at STEP_Z).
        fc.save(); fc.beginPath(); [[XL, SUN_F.z0], [XR, SUN_F.z0], [XR, STEP_Z], [HALL_XR, STEP_Z], [HALL_XR, SUN_F.z1], [XL, SUN_F.z1]].map(fp).forEach(([u, v], i) => i ? fc.lineTo(u, v) : fc.moveTo(u, v)); fc.closePath(); fc.clip();
        fc.filter = `blur(${modeId === 'evening' ? 14 : 5}px)`; wc.filter = 'blur(4px)';
        fc.fillStyle = wc.fillStyle = '#ffffff';
        for (const run of sunRuns) {
            const zs = []; for (let z = run.z0; z <= run.z1 + 1; z += 1500) zs.push(Math.min(Math.max(z, run.z0 + 25), run.z1 - 25));
            if (zs.at(-1) < run.z1 - 30) zs.push(run.z1 - 25);
            const ys = [[372, 878], [922, 2278], [2322, run.top - 42]];
            for (let n = 0; n + 1 < zs.length; n++) for (const [y0, y1] of ys) {
                const za = zs[n] + 25, zb = zs[n + 1] - 25, corners = [[run.x, y0, za], [run.x, y0, zb], [run.x, y1, zb], [run.x, y1, za]];
                quad(fc, corners.map(p => fp(onFloor(...p))));
                if (run.x === HALL_XR) quad(wc, corners.map(p => wp(onWall(...p))));
            }
        }
        // Hall columns stand inside the glass: their shadows cut the bars.
        for (const c of [fc, wc]) c.globalCompositeOperation = 'destination-out';
        fc.fillStyle = wc.fillStyle = '#000';
        for (const [x, z, r] of sunColumns) {
            const far = 30000; quad(fc, [[x, z - r], [x, z + r], [x - ca * far, z + r - sa * far], [x - ca * far, z - r - sa * far]].map(fp));
            const shift = sa * (x - XL) / ca; quad(wc, [[z - r - shift, -100], [z + r - shift, -100], [z + r - shift, SUN_W.y1], [z - r - shift, SUN_W.y1]].map(wp));
        }
        for (const c of [fc, wc]) { c.globalCompositeOperation = 'source-over'; c.filter = 'none'; }
        fc.restore(); sunFloorMap.needsUpdate = sunWallMap.needsUpdate = true;
    };
    // The slot column sits under the soffit with no other light reaching it.
    pools.add(root, [8450, 3, -4450], [1400, 1400], T3500, [.04, .04, .11, .09, .1]);
    pools.add(canoe, [0, HULL_Y - 470, 0], [600, 2600], T3000, [.02, .02, .08, .07, .16]);
    pools.add(canoe, [0, 5, 0], [1700, 4200], T3000, [.03, .03, .1, .08, .24]);
    // Soft spill above and around each group (not a halo behind it); the beam spill lands in front of the plinth.
    addMerged(left, FIGURES.map(([z, along]) => [[along + 1100, 2400], [XL + 6, 2700, z]]), LEFTF, '#fff0de', [.03, .03, .07, .02, .10]);
    addMerged(root, FIGURES.map(([z, along]) => [[1300, along + 900], [-3150, 3, z]]), FLOOR, '#fff0de', [.025, .025, .06, .015, .08]);
    // Event: warm uplight grazes on the olive columns and pilasters.
    addMerged(right, [12500, 18500].map(z => [[700, 2800], [HALL_XR - 506, 1300, z]]), RIGHTF, '#ffc890', [0, 0, 0, 0, .22]);
    addMerged(left, [-1000, 3000].map(z => [[700, 2800], [XL + 306, 1300, z]]), LEFTF, '#ffc890', [0, 0, 0, 0, .22]);
    pools.add(frontWall, [EXIT[0], EXIT[1] - 180, front - 4], [600, 400], '#ff4a3a', [0, 0, .02, .04, .03], 'back');

    // ---------- Real lights: exactly five, no shadows ----------
    // Levels per daypart [morning, afternoon, evening, night, party]. The back row
    // relies on frame F2's pool, so its light serves the figure hall and café instead.
    const lights = [
        { at: [DESK[0] - 700, 2600, DESK[1]], power: 4.5, range: 3400, color: T4000, levels: [.45, .5, 1.05, .3, .8] },
        { at: [1000, 3250, -800], power: 11.8, range: 16000, color: T3500, levels: [.35, .4, .72, .1, .6] },
        { at: [-1400, 3400, 18500], power: 5, range: 9500, color: T3500, levels: [.3, .3, .85, .07, 1] },
        { at: [-2600, 3600, 9800], power: 4.5, range: 8000, color: T3000, levels: [.35, .4, .85, .06, 1.15] },
        { at: [5900, 2850, 1750], power: 5, range: 4900, color: T4000, levels: [.22, .95, .35, .08, 1.15] }
    ].map(spec => { const light = new THREE.PointLight('#ffe7cc', 0, spec.range * s, 2); light.position.set(...spec.at); light.castShadow = false; root.add(light); return { ...spec, light, power: spec.power * (s * 1000) ** 2 }; });

    // ---------- Props: lounge finishes, recycling blue, chair upholstery ----------
    room.propReplacements = { 'kenney-furniture-chair-modern-cushion': { id: 'ergoflex-designer-chair', scale: .82 } };
    // Edits saved against the earlier, wider commons: keep the replacement chair
    // scale, and bring anything that now lies beyond the new walls back inside
    // the floor (the hall narrows to x 6000 past the step).
    room.migrateSavedTransform = (obj, saved) => {
        if (!saved?.p || obj.parent !== root) return saved;
        if ((obj.userData.conferenceChair || obj.userData.humboldtChair || obj.userData.decorUpgrade === 'ergoflex-designer-chair') && saved.s && ['x', 'y', 'z'].every(a => Math.abs(saved.s[a] - 1) < .00001))
            saved = { ...saved, s: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z } };
        saved = migrateHumboldtGroupFurniture(obj, saved);
        const m = 350, z = THREE.MathUtils.clamp(saved.p.z, bz + m, front - m), right = z > STEP_Z - m ? HALL_XR : XR, x = THREE.MathUtils.clamp(saved.p.x, XL + m, right - m);
        return x === saved.p.x && z === saved.p.z ? saved : { ...saved, p: { ...saved.p, x, z } };
    };
    const weave = repeating(canvasMap((c, w, h) => {
        c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
            c.fillStyle = (x + y) % 8 ? '#9a9a9a' : '#656565'; c.fillRect(x, y, 3, 1); c.fillRect(x, y + 1, 1, 3);
        }
    }, 128, 128)); weave.repeat.set(5, 5);
    const cache = new Map();
    const ownCopy = (source, key, finish) => { const id = source.uuid + ':' + key; if (!cache.has(id)) { const m = source.clone(); finish(m); m.userData.roomPaletteLocked = true; own(m); cache.set(id, m); } return cache.get(id); };
    const recolour = (object, key, pick) => object.traverse(o => { if (!o.isMesh) return; const swap = m => { const f = m?.isMeshStandardMaterial && pick(m); return f ? ownCopy(m, key, f) : m; }; o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); });
    const tint = (color, roughness, metalness = 0, sheen) => m => { m.color.set(color); m.roughness = roughness; m.metalness = metalness; if (m.sheenColor) m.sheenColor.set(sheen || color); };
    room.decorateProp = (object, placement) => {
        if (placement.id === 'kenney-furniture-chair-modern-cushion') {
            studyChair(object, placement);
            life.decorateProp?.(object, placement);
            return;
        }
        life.decorateProp?.(object, placement);
        // Side chairs: honey-oak frame, dark aubergine-charcoal pads (photos).
        if (object.userData.conferenceChair) {
            const shared = placement.finish === 'group-forest';
            return recolour(object, shared ? 'group-forest' : 'reading', m => {
                const part = m.userData?.conferencePart;
                return part === 'shell' || part === 'upholstery' ? m => { tint(shared ? '#405a50' : '#3a3540', .9, 0, shared ? '#648473' : '#5a5262')(m); m.bumpMap = weave; m.bumpScale = .35; }
                    : part === 'frame' ? tint(shared ? '#827051' : '#9a6a3c', shared ? .36 : .5, shared ? .72 : 0) : null;
            });
        }
        if (placement.id === 'kenney-furniture-chair-modern-cushion') return recolour(object, 'reading', m => /carpet|leather|fabric|cushion/i.test(m.name) || m.map ? tint('#3a3540', .9) : tint('#9a6a3c', .5));
        if (placement.finish === 'raspberry' || placement.finish === 'charcoal') {
            const red = placement.finish === 'raspberry';
            return recolour(object, placement.finish, m => /velvet/i.test(m.name) ? tint(red ? '#a32f45' : '#353230', red ? .86 : .9, 0, red ? '#c25a6a' : '#4a4642')
                : /lumbar/i.test(m.name) ? tint(red ? '#a32f45' : '#6b6259', .88) : /welt/i.test(m.name) ? tint(red ? '#6f1f2e' : '#232120', .86) : /timber/i.test(m.name) ? tint(red ? '#2c2420' : '#2a221c', .5) : null);
        }
        if (placement.finish === 'recycle') return recolour(object, 'recycle', m => /metalDark/i.test(m.name) ? tint('#1d357a', .55) : /metal/i.test(m.name) ? tint('#2a4a9e', .55) : null);
    };

    // ---------- Daypart atmosphere ----------
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = HUMBOLDT_MODES[modeId] || HUMBOLDT_MODES.morning, night = modeId === 'night';
        viewMode = modeId; drawView(modeId); updateBulletin(modeId);
        life.apply(modeId, mode); readingDetails(modeId); frontGlass.color.set(modeId === 'evening' ? '#c8c8c8' : '#ffffff');
        campusLife.apply(modeId, accent);
        lensA.emissiveIntensity = (.06 + mode.wash * .35) * accent; lensB.emissiveIntensity = night ? .04 : lensA.emissiveIntensity;
        canLens.emissiveIntensity = (.25 + mode.wash * 1.1) * accent * (night ? .12 : 1); trackLens.emissiveIntensity = (.2 + mode.wash * 1.3) * accent * (night ? .08 : 1);
        grazerLens.emissiveIntensity = (.15 + mode.wash * .9) * accent * (night ? .5 : 1);
        drawSun(modeId); pools.apply(modeId, accent);
        const phase = Math.max(0, PHASE.indexOf(modeId));
        lights.forEach(spec => { spec.light.color.set(spec.color); spec.light.intensity = spec.power * spec.levels[phase] * accent; });
        // Five virtual spots from the aisle track, converted to world space (root carries the scale).
        root.updateWorldMatrix(true, false);
        accentSpots.forEach((sp, i) => { const p = root.localToWorld(new THREE.Vector3(...sp.at)), t = root.localToWorld(new THREE.Vector3(...sp.target)); accentU.efAccPos.value[i].copy(p); accentU.efAccAim.value[i].copy(t.sub(p).normalize()); });
        accentU.efAccGain.value = [.22, .18, .55, .06, .58][phase] * accent; accentU.efAccColor.value.set(modeId === 'party' ? T3000 : T3500);
        root.userData.humboldtPilotActivity = { phase: modeId, focus: bulletin.g.userData.dailyFocus, tilt: mode.tilt, height: mode.height };
        root.userData.atmosphere = modeId; root.userData.humboldtCircuits = { A: true, B: !night };
    };
    // VSM shadow maps also draw shadow *receivers*, so a non-casting fixture that
    // still receives (frames, soffits, glass, trim) would print onto the floor.
    // The floors keep receiving: they sit below everything.
    pools.group.children.forEach(o => { o.material.dithering = true; });
    root.traverse(o => { if (o.isMesh && !o.castShadow && !o.userData.humboldtFloor && !o.userData.lightPool) o.receiveShadow = false; });
    // The shell stays out of the shadow pass entirely: daylight reads as
    // entering through the glass bay and clerestory rather than the 7.2 m back
    // wall shading the whole commons. Furniture, plinths and the canoe still cast.
    for (const shell of [back, right, left, frontWall, soffit, lid]) shell.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    room.roomAtmosphere('morning');
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
    root.userData.humboldtCommons = { desk: DESK, deskTurn: layout.deskTurn, frames: frames.length, downlights: cans.length, lights: lights.length };
}
