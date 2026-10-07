import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=asset-packs-20261001';

const names = ['Apartment writing nook', 'Home study & reading room', 'Writer’s study & library', 'Private library & lounge', 'Library & conversation suite'];
export const STUDY_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home, front = back + depth;
    const compact = index === 0, large = index >= 3;
    const desk = [compact ? -240 : -200, back + 850];
    const reading = [large ? -width / 2 + 680 : width / 2 - 700, front - 600];
    const table = [reading[0] + (large ? 820 : -830), front - 310];
    const console = [-width / 2 + 340, back + 650];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 960], turn: 180 },
        { id: 'armchair-leather', at: [reading[0], 0, reading[1]], turn: large ? 10 : -10 },
        { id: 'coffee-table-2', at: [table[0], 0, table[1]] },
        { id: 'journal', at: [table[0] - 70, 700, table[1]], turn: -12 },
        { id: 'tea-cup', at: [table[0] + 115, 700, table[1] + 35] }
    ];
    if (!compact) props.push(
        { id: 'globe', at: [console[0], 740, console[1]] },
        { id: 'ink-quill', at: [console[0], 740, console[1] + 250] }
    );
    // A leather footstool faces the reading chair where the room allows it.
    if (index === 1) props.push({ id: 'leather-pouffe', at: [reading[0] - 830, 0, reading[1] - 240], turn: 20 });
    if (index === 2) props.push({ id: 'ficus', at: [-width / 2 + 290, 0, front - 450] });
    if (large) props.push(
        { id: 'sofa-leather-wood', at: [650, 0, front - 550] },
        { id: 'coffee-table', at: [650, 0, front - 1510] },
        { id: 'gramophone', at: [900, 391.2, front - 1510], turn: -12 },
        { id: 'journal', at: [290, 391.2, front - 1540] },
        { id: 'monstera', at: [width / 2 - 490, 0, front - 620] }
    );
    if (index === 4) props.push({ id: 'bookwheel', at: [-width / 2 + 950, 0, back + 2130], turn: 90 });
    return [id, { id, name: names[index], width, depth, height, back, desk, reading, table, console,
        compact, large, chess: index === 4, bays: compact ? 1 : large ? index : 2, props, daylight: [-width / 2 + 100, 450],
        // Small studies hang a salon wall over the reading chair; larger ones
        // build a fireplace between the library bays and the reading corner.
        fireplace: index >= 2, index }];
}));
export const studyLayoutById = id => STUDY_LAYOUTS[id] || STUDY_LAYOUTS.apartment;
export const studyLayoutForSize = size => STUDY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const STUDY_MODES = {
    morning: { label: 'Morning', description: 'Fresh window light · standing planning and notes', key: '#fff0d8', fill: '#d3e3ee', accent: '#dcc39c', power: 1.6, ambient: .44, bounce: .6, exposure: 1.06, sky: ['#86b2d2', '#f3e7cc'], practical: .12, wash: .1, colors: ['#ebc895', '#bdd1c5'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated writing and research', key: '#fff0dc', fill: '#e1e7e8', accent: '#eac497', power: 1.3, ambient: .42, bounce: .58, exposure: 1.07, sky: ['#98bdd6', '#f0e6d2'], practical: .3, wash: .24, colors: ['#e8c397', '#bbcdbf'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm lamps · desk angled for reading', key: '#ffb47c', fill: '#b9c3d6', accent: '#f4b77c', power: .6, ambient: .26, bounce: .34, exposure: 1.12, sky: ['#4c5c86', '#f2a468'], practical: 1, wash: .7, colors: ['#f6c38a', '#c2cbbb'], height: 28, tilt: 12, offset: [0, 65], yaw: 0, leds: true, color: '#ffdea6' },
    night: { label: 'Night', description: 'Quiet late reading · warm desk and shelf lights', key: '#90a6cc', fill: '#8fa2c0', accent: '#e8b07a', power: .12, ambient: .1, bounce: .14, exposure: 1.1, sky: ['#0b1526', '#25374f'], practical: 1.15, wash: .22, colors: ['#f2bd82', '#9fafab'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe6b9' },
    party: { label: 'Conversation', description: 'Books and conversation · desk turned toward the room', key: '#e9d3b8', fill: '#c4d2de', accent: '#e9b583', power: .45, ambient: .3, bounce: .38, exposure: 1.12, sky: ['#3b4a66', '#a7867a'], practical: .85, wash: .9, colors: ['#f1cda1', '#b9cbbf'], height: 43.5, tilt: 0, offset: [60, 250], yaw: -12, leds: true, color: '#f5d8ac' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height); const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}
// Stable pseudo-random variation: a rebuilt study is identical every time.
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// Bakes many small parts into one geometry so a shelf's keepsakes, a lamp's
// brass or a frame cluster costs one draw call. Optional per-part colour is
// written as vertex colour; `uv` remaps a part onto a region of an atlas.
function kit() {
    const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const api = {
        add(geometry, at, { rot = [0, 0, 0], scale = [1, 1, 1], color = null, uv = null } = {}) {
            const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
            g.applyMatrix4(m.compose(p.set(...at), q.setFromEuler(e.set(...rot)), s.set(...scale)));
            if (uv && g.attributes.uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); }
            parts.push({ g, color: color && new THREE.Color(color) }); return api;
        },
        box: (size, at, o) => api.add(new THREE.BoxGeometry(...size), at, o),
        cyl: (top, bottom, height, at, o = {}) => api.add(new THREE.CylinderGeometry(top, bottom, height, o.seg || 16, 1, !!o.open), at, o),
        ball: (radius, at, o = {}) => api.add(new THREE.SphereGeometry(radius, o.seg || 12, o.rings || 8), at, o),
        lathe: (profile, at, o = {}) => api.add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), o.seg || 18), at, o),
        rod(from, to, radius, o = {}) {
            const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), dir = b.clone().sub(a), g = new THREE.CylinderGeometry(o.end ?? radius, radius, dir.length(), o.seg || 8);
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
            return api.add(g, a.add(b).multiplyScalar(.5).toArray(), o);
        },
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

// Wide, staggered oak boards with knots and grain; the tile repeats every 1200 mm.
function drawFloor(c, S) {
    const cols = 8, pw = S / cols, tones = ['#9b7550', '#8d6945', '#a67e57', '#93704c', '#86613e', '#a07a52', '#ad865d', '#97724d'];
    c.fillStyle = '#3e2b1c'; c.fillRect(0, 0, S, S);
    const plank = (x, y, len, seed) => {
        for (const oy of [0, -S]) {
            c.save(); c.beginPath(); c.rect(x + 1.5, y + oy + 1.5, pw - 3, len - 3); c.clip();
            c.fillStyle = tones[Math.floor(rnd(seed) * tones.length)]; c.fillRect(x, y + oy, pw, len);
            const shade = c.createLinearGradient(x, 0, x + pw, 0); shade.addColorStop(0, '#00000014'); shade.addColorStop(.5, '#ffffff08'); shade.addColorStop(1, '#00000018');
            c.fillStyle = shade; c.fillRect(x, y + oy, pw, len);
            for (let g = 0; g < 22; g++) {
                const gx = x + 4 + rnd(seed + g * 1.7) * (pw - 8), wave = 3 + rnd(seed + g) * 6;
                c.strokeStyle = rnd(seed + g * 3.1) > .35 ? `rgba(70,45,25,${.08 + rnd(seed + g * 5) * .14})` : `rgba(235,200,150,${.06 + rnd(seed + g) * .08})`;
                c.lineWidth = .6 + rnd(seed + g * 7) * 1.4; c.beginPath(); c.moveTo(gx, y + oy);
                c.bezierCurveTo(gx + wave, y + oy + len * .33, gx - wave, y + oy + len * .66, gx + wave * .4, y + oy + len); c.stroke();
            }
            if (rnd(seed * 3.3) > .62) {
                const kx = x + pw * (.3 + rnd(seed * 5) * .4), ky = y + oy + len * (.2 + rnd(seed * 7) * .6);
                for (let r = 0; r < 4; r++) { c.strokeStyle = `rgba(60,38,20,${.35 - r * .07})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(kx, ky, 4 + r * 4, 9 + r * 9, 0, 0, Math.PI * 2); c.stroke(); }
                c.fillStyle = '#4a3020aa'; c.beginPath(); c.ellipse(kx, ky, 4, 8, 0, 0, Math.PI * 2); c.fill();
            }
            c.restore();
        }
    };
    for (let i = 0; i < cols; i++) {
        let y = rnd(i * 7.3) * S, covered = 0, n = 0;
        while (covered < S) { const len = Math.min(S - covered, S * (.38 + rnd(i * 11 + n * 3.7) * .5)); plank(i * pw, (y + covered) % S, len, i * 31 + n * 7); covered += len; n++; }
    }
}
// A faded Oushak-style wool rug: indigo borders, a brick field with a sage
// and ivory medallion, spandrels, abrash banding and a fine weave.
function drawRug(c, S) {
    const ivory = '#d6c6a2', indigo = '#3a4258', brick = '#9a5843', gold = '#b8955e', sage = '#7d8a73', rose = '#b88068';
    c.fillStyle = indigo; c.fillRect(0, 0, S, S);
    const frame = (inset, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.strokeRect(inset, inset, S - inset * 2, S - inset * 2); };
    frame(14, 8, ivory); frame(30, 5, gold);
    const rosette = (x, y, r, petal, core) => {
        c.fillStyle = petal; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .45, r * .2, a, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = core; c.beginPath(); c.arc(x, y, r * .3, 0, Math.PI * 2); c.fill();
    };
    // Main border: a gold vine with alternating rosettes.
    const b0 = 44, b1 = 132, mid = (b0 + b1) / 2;
    c.strokeStyle = gold; c.lineWidth = 3;
    for (const side of [0, 1, 2, 3]) {
        c.save(); c.translate(S / 2, S / 2); c.rotate(side * Math.PI / 2); c.translate(-S / 2, -S / 2);
        c.beginPath(); for (let x = b0; x <= S - b0; x += 4) { const y = mid + Math.sin(x * .07) * 16; if (x === b0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
        for (let x = b1 + 10, k = 0; x < S - b1; x += 58, k++) rosette(x, mid, 22, k % 2 ? ivory : rose, k % 2 ? brick : indigo);
        c.restore();
    }
    for (const corner of [[mid, mid], [S - mid, mid], [mid, S - mid], [S - mid, S - mid]]) rosette(...corner, 26, ivory, brick);
    frame(b1 + 4, 6, ivory); frame(b1 + 14, 6, gold);
    const f0 = b1 + 18, fs = S - f0 * 2;
    c.fillStyle = brick; c.fillRect(f0, f0, fs, fs);
    // Field lattice of small motifs.
    for (let y = f0 + 30, row = 0; y < S - f0; y += 58, row++) for (let x = f0 + 30 + (row % 2) * 29; x < S - f0; x += 58) {
        c.fillStyle = (x + y) % 3 ? '#a8634a' : '#8a4c39'; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 9, y); c.lineTo(x, y + 12); c.lineTo(x - 9, y); c.fill();
        c.fillStyle = row % 2 ? gold + '88' : ivory + '66'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    }
    // Corner spandrels.
    for (const [cx, cy, a] of [[f0, f0, 0], [S - f0, f0, Math.PI / 2], [S - f0, S - f0, Math.PI], [f0, S - f0, -Math.PI / 2]]) {
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.fillStyle = indigo; c.beginPath(); c.moveTo(0, 0); c.lineTo(190, 0); c.quadraticCurveTo(150, 150, 0, 190); c.fill();
        c.fillStyle = sage; c.beginPath(); c.moveTo(0, 0); c.lineTo(140, 0); c.quadraticCurveTo(110, 110, 0, 140); c.fill();
        rosette(52, 52, 30, ivory, brick); c.restore();
    }
    // Central medallion with pendants.
    c.save(); c.translate(S / 2, S / 2);
    const lozenge = (rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(0, -ry); c.quadraticCurveTo(rx * .45, -ry * .45, rx, 0); c.quadraticCurveTo(rx * .45, ry * .45, 0, ry); c.quadraticCurveTo(-rx * .45, ry * .45, -rx, 0); c.quadraticCurveTo(-rx * .45, -ry * .45, 0, -ry); c.fill(); };
    lozenge(250, 300, ivory); lozenge(232, 280, indigo); lozenge(200, 240, sage); lozenge(150, 180, ivory);
    for (const s of [-1, 1]) { c.fillStyle = indigo; c.beginPath(); c.moveTo(-34, s * 296); c.lineTo(0, s * 360); c.lineTo(34, s * 296); c.fill(); rosette(0, s * 330, 18, ivory, brick); }
    c.fillStyle = gold; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; c.beginPath(); c.ellipse(Math.cos(a) * 70, Math.sin(a) * 84, 28, 10, a, 0, Math.PI * 2); c.fill(); }
    rosette(0, 0, 58, brick, indigo); rosette(0, 0, 22, ivory, gold);
    c.restore();
    // Abrash (dye variation), wear and the weave.
    for (let y = 0; y < S; y += 6) { c.fillStyle = `rgba(${rnd(y) > .5 ? '255,235,200' : '40,20,10'},${rnd(y * 3) * .05})`; c.fillRect(0, y, S, 6); }
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${rnd(i) > .5 ? '255,240,215' : '30,15,10'},${.05 + rnd(i * 7) * .07})`; c.fillRect(rnd(i * 3) * S, rnd(i * 5) * S, 2, 2); }
    c.strokeStyle = '#00000012'; c.lineWidth = 1; for (let y = 0; y < S; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); }
    // Sun-faded: pull the dyes toward a warm grey.
    c.fillStyle = 'rgba(128,108,88,.16)'; c.fillRect(0, 0, S, S);
}
// Deep sage wallpaper with a trailing willow-leaf motif, tiling every 600 mm.
function drawPaper(c, S) {
    c.fillStyle = '#58695d'; c.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 4) { c.fillStyle = `rgba(255,255,240,${rnd(x) * .025})`; c.fillRect(x, 0, 2, S); }
    const motif = (ox, oy) => {
        c.strokeStyle = '#64766a'; c.lineWidth = 3; c.beginPath(); c.moveTo(ox, oy); c.bezierCurveTo(ox + 60, oy + 70, ox - 50, oy + 150, ox + 20, oy + 256); c.stroke();
        for (let t = 0; t < 9; t++) {
            const y = oy + 16 + t * 27, x = ox + Math.sin(t * .9) * 26, side = t % 2 ? 1 : -1;
            c.fillStyle = t % 3 ? '#627467' : '#6a7d6c'; c.beginPath(); c.ellipse(x + side * 20, y, 22, 7, side * .6, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#a3976a66'; for (let t = 0; t < 3; t++) { c.beginPath(); c.arc(ox + 60 - t * 12, oy + 60 + t * 70, 4, 0, Math.PI * 2); c.fill(); }
    };
    for (const [x, y] of [[80, 0], [336, 128]]) for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) motif(x + dx, y + dy);
}
// Fine walnut grain for the joinery.
function drawGrain(c, S) {
    c.fillStyle = '#6f5038'; c.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 3) {
        c.strokeStyle = rnd(x) > .55 ? `rgba(40,25,15,${.1 + rnd(x * 3) * .18})` : `rgba(190,150,105,${.05 + rnd(x * 5) * .1})`;
        c.lineWidth = .7 + rnd(x * 7) * 1.5; const w = 4 + rnd(x * 11) * 8;
        c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + w, S * .3, x - w, S * .7, x, S); c.stroke();
    }
}
// Cloth and leather spines: lighter title label, head and tail bands and a
// rounded-spine shade. Instance colour tints the whole spine.
function drawSpine(c, w, h) {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#8e8e8e'); g.addColorStop(.25, '#d6d6d6'); g.addColorStop(.6, '#dedede'); g.addColorStop(1, '#949494');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a5a5a'; for (const y of [.06, .085, .91, .935]) c.fillRect(0, h * y, w, h * .012);
    c.fillStyle = '#f6f6f6'; c.fillRect(w * .18, h * .2, w * .64, h * .16);
    c.fillStyle = '#7a7a7a'; for (let i = 0; i < 4; i++) c.fillRect(w * .28, h * (.23 + i * .03), w * (.44 - (i % 2) * .16), h * .008);
    c.fillStyle = '#bdbdbd'; c.fillRect(w * .3, h * .76, w * .4, h * .03);
}
// Twelve personal pictures in one atlas: photographs, prints and drawings.
const pictures = [
    (c) => { mount(c, '#efe7d6', 34); const g = c.createRadialGradient(128, 120, 10, 128, 128, 110); g.addColorStop(0, '#d2b58a'); g.addColorStop(1, '#7c5c3b'); c.save(); c.beginPath(); c.ellipse(128, 128, 76, 94, 0, 0, Math.PI * 2); c.clip(); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.fillStyle = '#4e3824'; c.beginPath(); c.ellipse(128, 112, 27, 34, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(128, 214, 70, 62, 0, 0, Math.PI * 2); c.fill(); c.restore(); },
    (c) => { mount(c, '#ede6d4', 30); c.fillStyle = '#e8dfc6'; c.fillRect(30, 30, 196, 196); c.strokeStyle = '#526b45'; c.lineWidth = 3; c.beginPath(); c.moveTo(130, 212); c.bezierCurveTo(140, 150, 112, 100, 124, 44); c.stroke(); c.fillStyle = '#5d7a4e'; for (let t = 0; t < 14; t++) { const y = 200 - t * 11, x = 132 - t * .6, len = 40 - t * 2.2; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * len * .55, y, len * .55, 5, s * -.35, 0, Math.PI * 2); c.fill(); } } c.fillStyle = '#6f6656'; c.fillRect(92, 218, 72, 2); },
    (c) => { c.fillStyle = '#e1cd9c'; c.fillRect(0, 0, 256, 256); const g = c.createRadialGradient(128, 128, 40, 128, 128, 180); g.addColorStop(0, '#00000000'); g.addColorStop(1, '#6b4a2244'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.fillStyle = '#a8bcae'; c.beginPath(); c.moveTo(0, 0); c.lineTo(110, 0); for (let y = 0; y <= 256; y += 16) c.lineTo(90 + Math.sin(y * .09) * 26 + rnd(y) * 18, y); c.lineTo(0, 256); c.fill(); c.strokeStyle = '#6b5a3f'; c.lineWidth = 2; c.stroke(); c.strokeStyle = '#8a774f40'; c.lineWidth = 1; for (let i = 32; i < 256; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); } c.fillStyle = '#7a4d33'; c.save(); c.translate(196, 196); for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 6); c.lineTo(0, k % 2 ? 22 : 36); c.lineTo(-5, 6); c.fill(); } c.restore(); c.strokeStyle = '#5e4630'; c.lineWidth = 6; c.strokeRect(3, 3, 250, 250); },
    (c) => { let g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#b9cfd8'); g.addColorStop(1, '#f0e2c4'); c.fillStyle = g; c.fillRect(0, 0, 256, 150); g = c.createLinearGradient(0, 140, 0, 210); g.addColorStop(0, '#5e8a93'); g.addColorStop(1, '#3d6570'); c.fillStyle = g; c.fillRect(0, 140, 256, 72); c.fillStyle = '#d8c49a'; c.beginPath(); c.moveTo(0, 256); c.lineTo(0, 205); c.quadraticCurveTo(140, 190, 256, 214); c.lineTo(256, 256); c.fill(); c.strokeStyle = '#f4efe2aa'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(rnd(i) * 230, 158 + i * 6); c.lineTo(rnd(i) * 230 + 30, 158 + i * 6); c.stroke(); } c.fillStyle = '#2c2a28'; c.fillRect(150, 136, 34, 6); c.fillStyle = '#f6f1e4'; c.beginPath(); c.moveTo(164, 134); c.lineTo(166, 92); c.lineTo(186, 134); c.fill(); c.fillStyle = '#ffffff55'; c.beginPath(); c.ellipse(70, 60, 50, 14, 0, 0, Math.PI * 2); c.fill(); },
    (c) => { mount(c, '#f4f0e6', 26); c.strokeStyle = '#55524c'; c.lineWidth = 1.5; c.strokeRect(74, 122, 108, 78); c.beginPath(); c.moveTo(62, 124); c.lineTo(128, 76); c.lineTo(194, 124); c.moveTo(150, 92); c.lineTo(150, 70); c.lineTo(164, 70); c.lineTo(164, 102); c.stroke(); c.strokeRect(118, 158, 22, 42); c.strokeRect(86, 140, 22, 20); c.strokeRect(150, 140, 22, 20); for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(80 + i * 8, 116); c.lineTo(96 + i * 8, 100 - Math.abs(6 - i) * 2); c.stroke(); } c.beginPath(); c.moveTo(36, 200); c.lineTo(222, 200); c.stroke(); for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(206 + Math.sin(i) * 10, 130 + Math.cos(i * 1.7) * 18, 7, 0, Math.PI * 2); c.stroke(); } },
    (c) => { mount(c, '#f1ede4', 22); const g = c.createLinearGradient(0, 22, 0, 150); g.addColorStop(0, '#d9d9d5'); g.addColorStop(1, '#b6b7b3'); c.fillStyle = g; c.fillRect(22, 22, 212, 212); for (const [color, base, amp, f] of [['#8d8f8c', 120, 40, .04], ['#6c6f6d', 140, 34, .06], ['#4a4d4c', 168, 22, .09]]) { c.fillStyle = color; c.beginPath(); c.moveTo(22, 234); for (let x = 22; x <= 234; x += 6) c.lineTo(x, base - Math.abs(Math.sin(x * f + base)) * amp); c.lineTo(234, 234); c.fill(); } c.fillStyle = '#a9acaa'; c.fillRect(22, 196, 212, 38); },
    (c) => { c.fillStyle = '#ece2c6'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#3d3a5a'; c.lineWidth = 1.2; for (let y = 38; y < 214; y += 17) { c.beginPath(); c.moveTo(26, y); for (let x = 26; x < 226 - (y % 3) * 20; x += 3) c.lineTo(x, y + Math.sin(x * .5 + y) * 3 - (x % 11 < 2 ? 4 : 0)); c.stroke(); } c.beginPath(); c.moveTo(140, 232); c.bezierCurveTo(160, 210, 175, 250, 210, 226); c.stroke(); },
    (c) => { mount(c, '#f4efe3', 30); c.fillStyle = '#e9dcc0'; c.fillRect(30, 30, 196, 196); c.fillStyle = '#c99a3c'; c.beginPath(); c.arc(100, 104, 52, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2f3e5c'; c.beginPath(); c.arc(170, 226, 66, Math.PI, 0); c.fill(); c.fillStyle = '#7e9479'; c.fillRect(60, 150, 70, 76); c.strokeStyle = '#1f1f1f'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, 140); c.lineTo(216, 70); c.stroke(); },
    (c) => { mount(c, '#efe7d4', 28); c.strokeStyle = '#6a4e36'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, 180); c.quadraticCurveTo(120, 150, 226, 170); c.stroke(); c.fillStyle = '#6f8a58'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(50 + i * 30, 168 - (i % 2) * 14, 14, 6, .5, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#5c4a3a'; c.beginPath(); c.ellipse(130, 132, 38, 22, -.25, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(98, 112, 15, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(160, 140); c.lineTo(200, 150); c.lineTo(166, 126); c.fill(); c.fillStyle = '#b06a3a'; c.beginPath(); c.ellipse(116, 140, 18, 12, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d9a441'; c.beginPath(); c.moveTo(84, 110); c.lineTo(70, 114); c.lineTo(84, 116); c.fill(); },
    (c) => { mount(c, '#f0ebe0', 24); const g = c.createLinearGradient(0, 24, 0, 232); g.addColorStop(0, '#bdbab4'); g.addColorStop(1, '#8a8782'); c.fillStyle = g; c.fillRect(24, 24, 208, 208); for (const [x, hgt, tone] of [[66, 110, '#4d4b47'], [104, 132, '#3c3a37'], [146, 122, '#55524e'], [186, 86, '#47453f']]) { c.fillStyle = tone; c.beginPath(); c.arc(x, 232 - hgt - 14, 14, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x, 232 - hgt / 2 + 6, 22, hgt / 2, 0, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#6d6a65'; c.fillRect(24, 214, 208, 18); },
    (c) => { let g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#e8d2a2'); g.addColorStop(1, '#cfd4c4'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.fillStyle = '#7b8f6c'; c.beginPath(); c.moveTo(0, 120); c.quadraticCurveTo(90, 80, 256, 112); c.lineTo(256, 256); c.lineTo(0, 256); c.fill(); for (const [y, color] of [[132, '#c2a052'], [162, '#8c9c55'], [196, '#a8743f'], [228, '#b99147']]) { c.fillStyle = color; c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(128, y - 18, 256, y + 6); c.lineTo(256, y + 40); c.lineTo(0, y + 40); c.fill(); } c.fillStyle = '#3f5233'; for (const [x, y, r] of [[60, 112, 18], [74, 104, 14], [196, 116, 16]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${rnd(i) > .5 ? '255,250,230' : '40,30,20'},.12)`; c.fillRect(rnd(i * 3) * 256, rnd(i * 5) * 256, 6, 2); } },
    (c) => { mount(c, '#f2ecdf', 30); c.strokeStyle = '#5d7349'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(128, 222); c.bezierCurveTo(120, 170, 136, 140, 126, 112); c.moveTo(126, 180); c.quadraticCurveTo(160, 160, 170, 134); c.stroke(); c.fillStyle = '#b8382c'; for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; c.beginPath(); c.ellipse(126 + Math.cos(a) * 26, 86 + Math.sin(a) * 22, 30, 22, a, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#2a2420'; c.beginPath(); c.arc(126, 86, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7d8f5e'; c.beginPath(); c.ellipse(172, 128, 7, 12, .4, 0, Math.PI * 2); c.fill(); }
];
// Draws an ivory passe-partout, then clips and scales the cell to its window.
function mount(c, color, m) { c.fillStyle = color; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#00000022'; c.lineWidth = 2; c.strokeRect(m - 2, m - 2, 256 - m * 2 + 4, 256 - m * 2 + 4); c.beginPath(); c.rect(m, m, 256 - m * 2, 256 - m * 2); c.clip(); c.translate(128, 128); c.scale((256 - m * 2) / 256, (256 - m * 2) / 256); c.translate(-128, -128); }
function drawPictures(c) {
    pictures.forEach((draw, i) => {
        c.save(); c.translate((i % 4) * 256, Math.floor(i / 4) * 256); c.beginPath(); c.rect(0, 0, 256, 256); c.clip();
        draw(c); c.restore();
    });
}
// Frame colours: walnut, black lacquer, gilt and painted ivory.
const FRAMES = { walnut: '#4c3524', black: '#1f1d1b', gilt: '#a8844a', ivory: '#d9cfb9' };

export function buildStudyRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz } = layout, front = bz + d;
    const grain = texture(drawGrain, 512, 512);
    const oak = material('#ffffff', { map: grain, roughness: .62 }), sage = material('#7d8c81', { roughness: .9 });
    const cream = material('#e4d8c2', { roughness: .95 }), dark = material('#2f3a3a', { roughness: .6 });
    const brass = material('#b89b64', { metalness: .7, roughness: .32 });
    const paperMap = texture(drawPaper, 512, 512); paperMap.repeat.set(w / 460, h / 460);
    const paper = material('#ffffff', { map: paperMap, roughness: .92 });
    const dress = material('#ffffff', { vertexColors: true, roughness: .72 });
    const linen = material('#cdc2a8', { roughness: .97 }), slate = material('#3a3d3c', { roughness: .55 });
    const atlas = texture(drawPictures, 1024, 768); atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
    const prints = material('#ffffff', { map: atlas, roughness: .8 });
    // Practical glows are scaled by the mode in roomAtmosphere.
    const shadeMat = material('#e9dcc0', { emissive: '#ffcf8f', emissiveIntensity: .1, roughness: .9, side: THREE.DoubleSide });
    const bulbMat = material('#f2d3a2', { emissive: '#f2d3a2', emissiveIntensity: .4 });
    const flameMat = material('#ffd38a', { emissive: '#ffae48', emissiveIntensity: 2.2, roughness: 1 });
    const pictureGlow = material('#fff0d0', { emissive: '#ffdca6', emissiveIntensity: .2 });
    const stripMat = material('#e8ca9e', { emissive: '#e8ca9e', emissiveIntensity: .3 });
    const fireMat = material('#ff8a36', { emissive: '#ff6418', emissiveIntensity: 1.3, roughness: 1 });
    const emberMat = material('#a8341a', { emissive: '#ff4a12', emissiveIntensity: .8, roughness: 1 });
    const flames = [], fires = [];
    const register = (object, id, name) => {
        object.userData.propId = id; object.userData.sceneAssetName = name;
        markSceneAsset(object, { key: `study:${layout.id}:fixture:${id}` });
    };
    const group = (parent, name, at, turn = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); return g; };
    const baked = (parent, k, mat, shadow = true) => { const obj = mesh(parent, k.build(), mat); obj.castShadow = shadow; return obj; };
    const candle = (dk, bk, fk, [x, y, z], tall = 150) => {
        bk.cyl(34, 44, 12, [x, y + 6, z]).cyl(9, 12, 60, [x, y + 42, z]).cyl(20, 14, 16, [x, y + 80, z]);
        dk.cyl(13, 14, tall, [x, y + 88 + tall / 2, z], { color: '#efe6d0' });
        fk.ball(9, [x, y + 106 + tall, z], { scale: [1, 2.2, 1] });
    };
    // A framed picture: moulding baked into `fk`, the print baked into `pk`.
    const frame = (fk, pk, [x, y, z], [fw, fh], cell, color, mould = 28) => {
        const depth = 26 + mould * .2, col = FRAMES[color];
        fk.box([fw, mould, depth], [x, y + fh / 2 - mould / 2, z + depth / 2], { color: col }).box([fw, mould, depth], [x, y - fh / 2 + mould / 2, z + depth / 2], { color: col });
        fk.box([mould, fh - mould * 2, depth], [x - fw / 2 + mould / 2, y, z + depth / 2], { color: col }).box([mould, fh - mould * 2, depth], [x + fw / 2 - mould / 2, y, z + depth / 2], { color: col });
        const u = (cell % 4) / 4, v = 1 - (Math.floor(cell / 4) + 1) / 3;
        pk.add(new THREE.PlaneGeometry(fw - mould * 2 + 2, fh - mould * 2 + 2), [x, y, z + depth * .45], { uv: [u + .004, v + .005, u + .246, v + .328] });
    };

    const woodMap = texture(drawFloor, 1024, 1024); woodMap.repeat.set(w / 1200, d / 1200);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: woodMap, roughness: .58 }));
    const rugMap = texture(drawRug, 1024, 1024);
    const rugMat = material('#ffffff', { map: rugMap, roughness: 1 });
    // Wool fringe stays a child of the rug, so moving the rug carries it.
    const fringe = (rug, [rw, rd]) => {
        const k = kit(); for (const s of [-1, 1]) for (let z = -rd / 2 + 30; z < rd / 2 - 20; z += 22) k.box([46, 2, 7], [s * (rw / 2 + 21), -1, z], { rot: [0, (rnd(z) - .5) * .3, 0], color: '#e3d6ba' });
        baked(rug, k, dress, false).receiveShadow = true;
    };
    const rugSize = [layout.compact ? 1950 : 2250, 1750];
    fringe(box(root, [rugSize[0], 4, rugSize[1]], [layout.desk[0], 2, layout.desk[1] + 540], rugMat, 4), rugSize);

    // Back wall: willow-leaf paper over a panelled walnut dado and skirting.
    const back = new THREE.Group(); back.name = 'Study paneled writing wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], paper);
    box(back, [w, 740, 35], [0, 370, bz + 18], oak);
    box(back, [w, 35, 55], [0, 760, bz + 28], oak, 3);
    const dado = kit(), panels = Math.max(2, Math.round((w - 100) / 560)), pw = (w - 100) / panels;
    dado.box([w, 130, 22], [0, 65, bz + 46]).box([w, 18, 30], [0, 136, bz + 50]);
    for (let i = 0; i < panels; i++) {
        const x = -w / 2 + 50 + pw * (i + .5), pwid = pw - 80, ph = 470, y = 445;
        dado.box([pwid, 26, 14], [x, y + ph / 2, bz + 42]).box([pwid, 26, 14], [x, y - ph / 2, bz + 42]);
        dado.box([26, ph - 26, 14], [x - pwid / 2 + 13, y, bz + 42]).box([26, ph - 26, 14], [x + pwid / 2 - 13, y, bz + 42]);
        dado.box([pwid - 110, ph - 110, 8], [x, y, bz + 39]);
    }
    baked(back, dado, oak, false);
    const cornice = kit(); cornice.box([w, 60, 34], [0, h - 30, bz + 17]).box([w, 26, 60], [0, h - 72, bz + 30]).box([w, 14, 20], [0, h - 98, bz + 10]);
    baked(back, cornice, oak, false);
    const map = texture((c, tw, th) => {
        c.fillStyle = '#ded2b4'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#94734f'; c.lineWidth = 2;
        for (let i = 0; i < 18; i++) { c.beginPath(); for (let x = 0; x <= tw; x += 8) { const y = 50 + i * 25 + Math.sin(x * .025 + i * .35) * 19 + Math.sin(x * .011) * 22; if (!x) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
        c.strokeStyle = '#677d76'; c.lineWidth = 6; c.beginPath(); c.moveTo(410, 20); c.bezierCurveTo(250, 160, 370, 290, 110, 490); c.stroke();
        c.fillStyle = '#655b44'; c.font = '18px serif'; c.fillText('THE QUIET LANDSCAPE', 34, 475);
    });
    const artW = layout.compact ? 1070 : 1420;
    const art = new THREE.Group(); art.name = 'Original contour landscape'; art.position.set(layout.desk[0], 2070, bz + 36); back.add(art);
    box(art, [artW, 620, 35], [0, 0, 0], oak, 3);
    box(art, [artW - 40, 580, 6], [0, 0, 23], material('#ffffff', { map, roughness: .95 }));
    // A brass picture light washes the landscape once the lamps come on.
    const hood = kit(), lightLen = artW * .5;
    hood.box([80, 70, 12], [0, 355, -30]).rod([0, 355, -24], [0, 385, 120], 9).cyl(30, 30, lightLen, [0, 390, 140], { rot: [0, 0, Math.PI / 2], seg: 14 })
        .ball(32, [-lightLen / 2, 390, 140], { scale: [.3, 1, 1] }).ball(32, [lightLen / 2, 390, 140], { scale: [.3, 1, 1] });
    baked(art, hood, brass, false);
    box(art, [lightLen - 20, 6, 30], [0, 357, 140], pictureGlow).castShadow = false;
    register(art, 'study-landscape', 'Framed contour landscape');
    // Keepsakes hang between the landscape and the library corner.
    const artRight = layout.desk[0] + artW / 2, keepX = (artRight + w / 2 - 380) / 2;
    if (w / 2 - 380 - artRight > 320) {
        const keep = group(back, 'Study keepsake frames', [keepX, 1950, bz]);
        const fk = kit(), pk = kit();
        frame(fk, pk, [0, 175, 0], [240, 300], 7, 'black', 22);
        frame(fk, pk, [-72, -112, 0], [150, 190], 9, 'walnut', 24);
        frame(fk, pk, [84, -100, 0], [140, 140], 11, 'gilt', 26);
        baked(keep, fk, dress, false); baked(keep, pk, prints, false);
        register(keep, 'study-keepsakes', 'Keepsake photographs');
    }
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Study library wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream);
    const skirt = kit(); skirt.box([24, 130, d], [w / 2 - 12, 65, bz + d / 2]).box([32, 18, d], [w / 2 - 16, 136, bz + d / 2])
        .box([34, 60, d], [w / 2 - 17, h - 30, bz + d / 2]).box([60, 26, d], [w / 2 - 30, h - 72, bz + d / 2]).box([20, 14, d], [w / 2 - 10, h - 98, bz + d / 2]);
    baked(side, skirt, oak, false);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const bayEnd = bz + 640 + (layout.bays - 1) * 1100 + 470;
    // The salon wall: mixed frames hung as one movable arrangement, above the
    // reading chair in small studies and over the mantel in larger ones.
    const fireZ = layout.large ? (bayEnd + front - 990) / 2 : (bayEnd + layout.reading[1] - 575) / 2;
    const salonZ = layout.fireplace ? fireZ : Math.min(Math.max(layout.reading[1] - 50, bayEnd + 700), front - 750);
    const salon = group(side, 'Study salon wall', [w / 2, layout.fireplace ? 1960 : 1720, salonZ], -Math.PI / 2);
    {
        const fk = kit(), pk = kit();
        frame(fk, pk, [-470, 80, 0], [340, 440], 2, 'gilt', 34);
        frame(fk, pk, [-110, 230, 0], [280, 220], 3, 'walnut', 26);
        frame(fk, pk, [-110, -60, 0], [220, 280], 0, 'black', 22);
        frame(fk, pk, [220, 120, 0], [300, 380], 1, 'ivory', 24);
        frame(fk, pk, [500, 260, 0], [180, 180], 4, 'walnut', 22);
        frame(fk, pk, [500, 0, 0], [180, 240], 5, 'black', 20);
        frame(fk, pk, [-470, -255, 0], [260, 150], 6, 'gilt', 22);
        if (!layout.fireplace) frame(fk, pk, [230, -230, 0], [240, 180], 10, 'walnut', 26);
        baked(salon, fk, dress, false); baked(salon, pk, prints, false);
        register(salon, 'study-salon', 'Salon picture wall');
    }

    const entry = new THREE.Group(); entry.name = 'Study window and entry wall'; root.add(entry);
    const wz = 450, ww = layout.compact ? 1250 : 1750, low = 850, wh = 1400, a = wz - ww / 2, b = wz + ww / 2;
    box(entry, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], cream);
    box(entry, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], cream);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], cream);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], cream);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    // Six-light casement: frame, glazing bars and sill baked as one walnut piece.
    const casement = kit();
    for (const z of [a, wz, b]) casement.box([65, wh + 45, 28], [-w / 2 + 8, low + wh / 2, z]);
    for (const y of [low, low + wh]) casement.box([65, 28, ww + 50], [-w / 2 + 8, y, wz]);
    casement.box([55, 22, ww], [-w / 2 + 4, low + wh * .62, wz]);
    for (const z of [(a + wz) / 2, (wz + b) / 2]) casement.box([40, wh, 16], [-w / 2 - 2, low + wh / 2, z]);
    casement.box([180, 30, ww + 80], [-w / 2 + 50, low - 15, wz]).box([30, 40, ww + 40], [-w / 2 + 125, low - 50, wz]);
    casement.box([60, 34, a - bz], [-w / 2 + 17, h - 30, (a + bz) / 2]).box([60, 34, front - b], [-w / 2 + 17, h - 30, (front + b) / 2]).box([60, 34, ww], [-w / 2 + 17, h - 30, wz]);
    baked(entry, casement, oak, false);
    // Pleated linen drapes on a brass pole with finials.
    const drapes = kit();
    for (const [z0, dir] of [[a - 100, -1], [b + 100, 1]]) for (let i = 0; i < 7; i++) {
        const z = z0 - dir * 60 + dir * i * 30, r = 19 + rnd(i + z0) * 5;
        drapes.cyl(r, r + 9, 2070, [-w / 2 + 72 + (i % 2) * 14, 1225, z], { seg: 10 });
    }
    drapes.box([30, 60, 240], [-w / 2 + 72, 2240, a - 100]).box([30, 60, 240], [-w / 2 + 72, 2240, b + 100]);
    baked(entry, drapes, linen).castShadow = false;
    const pole = kit(); pole.rod([-w / 2 + 90, 2290, a - 230], [-w / 2 + 90, 2290, b + 230], 13)
        .ball(26, [-w / 2 + 90, 2290, a - 250]).ball(26, [-w / 2 + 90, 2290, b + 250]).rod([-w / 2, 2290, a - 170], [-w / 2 + 90, 2290, a - 170], 8).rod([-w / 2, 2290, b + 170], [-w / 2 + 90, 2290, b + 170], 8);
    baked(entry, pole, brass, false);
    // Sill dressing: a trailing pothos, a pair of books and a candle.
    {
        const dk = kit(), bk = kit(), fk = kit(), sx = -w / 2 + 70, sy = low;
        dk.cyl(62, 48, 110, [sx, sy + 55, b - 160], { color: '#b46a49' }).cyl(64, 64, 10, [sx, sy + 110, b - 160], { color: '#9c5b3f' });
        for (let i = 0; i < 9; i++) dk.ball(30 + rnd(i) * 14, [sx + Math.cos(i * 1.9) * 40, sy + 150 + rnd(i * 3) * 60, b - 160 + Math.sin(i * 1.9) * 40], { color: i % 2 ? '#4f7d4a' : '#3e6a3e', scale: [1, .7, 1] });
        for (let i = 0; i < 6; i++) dk.ball(20, [sx + 50 + i * 6, sy + 70 - i * 60, b - 140 + i * 12], { color: i % 2 ? '#558650' : '#467443', scale: [1, 1.8, .8] });
        dk.box([150, 34, 220], [sx, sy + 17, a + 260], { color: '#6b3b2f', rot: [0, .12, 0] }).box([140, 30, 200], [sx, sy + 49, a + 255], { color: '#33495a', rot: [0, -.05, 0] });
        candle(dk, bk, fk, [sx, sy + 64, a + 250], 90);
        baked(entry, dk, dress, false); baked(entry, bk, brass, false); flames.push(baked(entry, fk, flameMat, false));
    }
    const doorZ = front - 470;
    box(entry, [25, 2100, 800], [-w / 2 + 20, 1050, doorZ], oak, 4);
    box(entry, [18, 1950, 710], [-w / 2 + 43, 975, doorZ], sage, 3);
    const door = kit();
    for (const [y, ph] of [[1400, 820], [480, 620]]) for (const z of [-170, 170]) {
        door.box([10, ph, 24], [-w / 2 + 55, y, doorZ + z - 120]).box([10, ph, 24], [-w / 2 + 55, y, doorZ + z + 120]);
        door.box([10, 24, 264], [-w / 2 + 55, y - ph / 2 + 12, doorZ + z]).box([10, 24, 264], [-w / 2 + 55, y + ph / 2 - 12, doorZ + z]);
    }
    baked(entry, door, sage, false);
    const knob = kit(); knob.cyl(32, 32, 10, [-w / 2 + 55, 890, doorZ - 225], { rot: [0, 0, Math.PI / 2] }).rod([-w / 2 + 55, 890, doorZ - 225], [-w / 2 + 95, 890, doorZ - 225], 8).ball(26, [-w / 2 + 102, 890, doorZ - 225]);
    baked(entry, knob, brass, false);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const glow = [stripMat];
    // Each library bay remains an editable group. Carcass, doors and brass are
    // baked; books are one instanced batch with printed spines and per-book
    // colour, so a large library does not add hundreds of draw calls.
    const spineMap = texture(drawSpine, 64, 256);
    const bookMat = material('#ffffff', { map: spineMap, roughness: .78 });
    const bookColors = ['#5b2f2a', '#7a3b2e', '#2f4a3f', '#3c5a52', '#24344a', '#425a74', '#8a6a3c', '#a8885a', '#cdb88e', '#e3d7bb', '#6b4f6a', '#9c4a32', '#34302c', '#7d7b55', '#b5643f', '#55705f'];
    const leather = new Set([0, 1, 2, 4, 6, 10, 12]);
    const bookGeometry = () => {
        const g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) if (Math.floor(i / 4) !== 4) uv.setXY(i, .5, .55);
        return g;
    };
    const vignette = (dk, bk, fk, books, type, [x0, x1], y, seed) => {
        const cx = (x0 + x1) / 2;
        if (type === 'photo') {
            dk.box([150, 200, 14], [cx - 30, y + 100, 120], { rot: [-.12, .2, 0], color: '#3b2a1f' }).box([118, 166, 4], [cx - 29, y + 100, 128], { rot: [-.12, .2, 0], color: '#ece3cf' }).box([92, 128, 3], [cx - 28, y + 100, 131], { rot: [-.12, .2, 0], color: rnd(seed) > .5 ? '#7d8a91' : '#9a8668' });
            dk.lathe([[0, 0], [30, 0], [38, 40], [26, 95], [14, 120], [18, 130], [0, 130]], [cx + 70, y, 90], { color: '#6f8f86' });
        } else if (type === 'clock') {
            bk.box([120, 150, 80], [cx, y + 75, 90]).box([132, 14, 92], [cx, y + 7, 90]).box([132, 12, 92], [cx, y + 154, 90]).add(new THREE.TorusGeometry(34, 4, 6, 16, Math.PI), [cx, y + 160, 90]);
            dk.cyl(40, 40, 4, [cx, y + 88, 131], { rot: [Math.PI / 2, 0, 0], color: '#f1ead8' }).box([3, 30, 2], [cx, y + 98, 134], { color: '#222' }).box([22, 3, 2], [cx + 9, y + 88, 134], { color: '#222' });
        } else if (type === 'plant') {
            dk.cyl(58, 44, 100, [cx, y + 50, 70], { color: '#b8a58a' }).cyl(60, 60, 8, [cx, y + 100, 70], { color: '#a8957a' });
            for (let i = 0; i < 8; i++) dk.ball(28 + rnd(seed + i) * 12, [cx + Math.cos(i * 1.7) * 36, y + 135 + rnd(seed + i * 3) * 50, 70 + Math.sin(i * 1.7) * 36], { color: i % 2 ? '#4f7d4a' : '#3e6a3e', scale: [1, .7, 1] });
            for (let i = 0; i < 5; i++) dk.ball(18, [cx + 40 - i * 4, y + 80 - i * 55, 150 + i * 6], { color: i % 2 ? '#558650' : '#467443', scale: [1, 1.8, .8] });
        } else if (type === 'jar') {
            dk.lathe([[0, 0], [40, 0], [62, 60], [60, 110], [36, 150], [30, 162], [0, 162]], [cx - 20, y, 80], { color: '#d9dfe3' });
            dk.cyl(61, 61, 22, [cx - 20, y + 75, 80], { color: '#3a5378', seg: 18 }).cyl(36, 30, 26, [cx - 20, y + 172, 80], { color: '#3a5378' });
            dk.box([90, 60, 120], [cx + 70, y + 30, 80], { color: '#5a3d2b' });
        } else if (type === 'stack') {
            // Three folios laid flat under a brass hourglass (clear of the shelf above).
            for (let i = 0; i < 3; i++) books.push({ size: [230 - i * 14, 34 + rnd(seed + i) * 10, 168 - i * 6], at: [cx, y + 21 + i * 42, 75], rot: (rnd(seed + i * 5) - .5) * .3, color: (seed + i * 5) % bookColors.length, flat: true });
            const hy = y + 132;
            bk.cyl(44, 44, 8, [cx + 20, hy + 4, 75]).cyl(44, 44, 8, [cx + 20, hy + 136, 75]);
            for (let k = 0; k < 3; k++) bk.rod([cx + 20 + Math.cos(k * 2.1) * 36, hy + 8, 75 + Math.sin(k * 2.1) * 36], [cx + 20 + Math.cos(k * 2.1) * 36, hy + 132, 75 + Math.sin(k * 2.1) * 36], 3);
            dk.cyl(4, 28, 62, [cx + 20, hy + 39, 75], { color: '#d6e0dc' }).cyl(28, 4, 62, [cx + 20, hy + 101, 75], { color: '#d6e0dc' }).cyl(3, 20, 22, [cx + 20, hy + 19, 75], { color: '#c9a86a' });
        } else if (type === 'bowl') {
            dk.lathe([[0, 0], [30, 0], [70, 30], [86, 62], [80, 64], [64, 34], [0, 12]], [cx, y, 80], { color: '#8d4f3a' });
            dk.ball(22, [cx - 20, y + 40, 80], { color: '#6b6f5a' }).ball(18, [cx + 22, y + 38, 70], { color: '#b6a47a' });
        }
    };
    const VIGNETTES = ['photo', 'clock', 'plant', 'jar', 'stack', 'bowl'], WIDE = { photo: 250, clock: 170, plant: 190, jar: 230, stack: 260, bowl: 190 };
    for (let bay = 0; bay < layout.bays; bay++) {
        const cabinet = new THREE.Group(); cabinet.name = 'Study bookcase bay ' + (bay + 1); cabinet.position.set(w / 2 - 195, 0, bz + 640 + bay * 1100); cabinet.rotation.y = -Math.PI / 2; root.add(cabinet);
        register(cabinet, 'study-bookcase-' + bay, 'Oak library bay ' + (bay + 1));
        const carcass = kit(), doors = kit(), knobs = kit(), strips = kit(), dk = kit(), bk = kit(), fk = kit();
        carcass.box([940, 2270, 24], [0, 1135, -157]);
        for (const x of [-458, 458]) carcass.box([24, 2300, 350], [x, 1150, 0]);
        carcass.box([940, 24, 350], [0, 2288, 0]).box([960, 30, 372], [0, 2315, 10]).box([968, 22, 384], [0, 2341, 14]).box([900, 70, 330], [0, 35, -5]);
        carcass.box([900, 280, 340], [0, 210, 0]);
        for (const x of [-215, 215]) {
            doors.box([414, 270, 14], [x, 200, 176]);
            doors.box([330, 14, 8], [x, 290, 186]).box([330, 14, 8], [x, 110, 186]).box([14, 166, 8], [x - 158, 200, 186]).box([14, 166, 8], [x + 158, 200, 186]);
            knobs.ball(11, [x + (x < 0 ? 170 : -170), 220, 194]).cyl(14, 14, 4, [x + (x < 0 ? 170 : -170), 220, 184], { rot: [Math.PI / 2, 0, 0] });
        }
        const books = [];
        for (let shelf = 0; shelf < 6; shelf++) {
            const y = 380 + shelf * 320, top = y + 10, seed = bay * 17 + shelf * 5;
            carcass.box([900, 20, 350], [0, y, 0]).box([900, 26, 12], [0, y - 3, 172]);
            strips.box([850, 7, 8], [0, y + 304, 160]);
            // Most shelves keep a keepsake at one end; the rest is books.
            const type = shelf === 0 ? null : VIGNETTES[(bay * 3 + shelf * 2) % VIGNETTES.length], left = (shelf + bay) % 2 === 0;
            let x0 = -434, x1 = 434;
            if (type && (shelf + bay) % 4 !== 3) { const span = WIDE[type]; vignette(dk, bk, fk, books, type, left ? [x0, x0 + span] : [x1 - span, x1], top, seed); if (left) x0 += span + 10; else x1 -= span + 10; }
            let x = x0, run = 0, color = 0, tall = 0, wide = 0, n = 0;
            while (x < x1) {
                if (run <= 0) { run = 1 + Math.floor(rnd(seed + n * 3.1) * 4); color = Math.floor(rnd(seed * 2 + n * 1.3) * bookColors.length); tall = 205 + rnd(seed + n * 7) * 82; wide = 20 + rnd(seed + n * 11) * 18; }
                const width = wide + (rnd(seed + n) - .5) * 5, height = Math.min(292, tall + (rnd(seed + n * 2) - .5) * 8), depth = 175 + rnd(seed + n * 9) * 22;
                if (x + width > x1) {
                    // A leaning book closes a run that does not fill the shelf.
                    const lw = 26, lh = 230, tilt = .24;
                    if (x1 - x > lw * Math.cos(tilt) + lh * Math.sin(tilt) + 4 && n) books.push({ size: [lw, lh, 185], at: [x + 2 + lw / 2 * Math.cos(tilt) + lh / 2 * Math.sin(tilt), top + lh / 2 * Math.cos(tilt) + lw / 2 * Math.sin(tilt), 165 - 92], tilt, color: (color + 5) % bookColors.length });
                    break;
                }
                books.push({ size: [width, height, depth], at: [x + width / 2, top + height / 2, 165 + rnd(seed + n * 13) * 6 - depth / 2], color, banded: leather.has(color) });
                x += width + 1.5; run--; n++;
            }
        }
        // Things kept on top: a trailing pothos or archive boxes and folios.
        if (bay % 2 === 0) {
            // Kept under 2560 mm so the apartment's 2600 mm ceiling clears it.
            dk.cyl(80, 64, 110, [-300, 2407, 60], { color: '#8a9a8c' }).cyl(82, 82, 12, [-300, 2462, 60], { color: '#788a7b' });
            for (let i = 0; i < 10; i++) dk.ball(30 + rnd(bay + i) * 12, [-300 + Math.cos(i * 1.7) * 50, 2482 + rnd(i * 3) * 36, 60 + Math.sin(i * 1.7) * 50], { color: i % 2 ? '#4f7d4a' : '#3e6a3e', scale: [1, .7, 1] });
            for (let i = 0; i < 6; i++) dk.ball(20 + rnd(i) * 8, [-360 + (rnd(i * 3) - .5) * 50, 2440 - i * 62, 196 + i * 3], { color: i % 2 ? '#558650' : '#467443', scale: [1.2, 1.1, .7] });
            dk.box([300, 130, 260], [180, 2417, 30], { color: '#7c6a52' }).box([310, 18, 270], [180, 2490, 30], { color: '#6b5a44' });
        } else {
            dk.box([320, 150, 280], [-200, 2427, 20], { color: '#536255' }).box([320, 120, 280], [170, 2412, 20], { color: '#7c6a52' });
            dk.box([360, 36, 300], [170, 2490, 20], { color: '#3f2f26', rot: [0, .1, 0] });
        }
        baked(cabinet, carcass, oak); baked(cabinet, doors, dark); baked(cabinet, knobs, brass, false);
        const stripMesh = baked(cabinet, strips, stripMat, false); stripMesh.receiveShadow = false;
        baked(cabinet, dk, dress, false); if (bk.count) baked(cabinet, bk, brass, false); if (fk.count) flames.push(baked(cabinet, fk, flameMat, false));
        const obj = new THREE.InstancedMesh(bookGeometry(), bookMat, books.length); obj.castShadow = obj.receiveShadow = true;
        const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), tint = new THREE.Color();
        books.forEach((bk, n) => {
            e.set(0, bk.rot || 0, bk.tilt || 0); matrix.compose(p.set(...bk.at), q.setFromEuler(e), s.set(...bk.size)); obj.setMatrixAt(n, matrix);
            tint.set(bookColors[bk.color]).multiplyScalar(1.12 + (rnd(n + bay * 31) - .5) * .22); obj.setColorAt(n, tint);
        });
        obj.instanceMatrix.needsUpdate = true; obj.instanceColor.needsUpdate = true; obj.computeBoundingBox(); cabinet.add(obj);
        const banded = books.filter(b => b.banded);
        const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brass, banded.length * 2);
        banded.forEach((b, n) => { for (let k = 0; k < 2; k++) { matrix.makeScale(b.size[0] - 4, 3, 2); matrix.setPosition(b.at[0], b.at[1] + (k ? 1 : -1) * (b.size[1] / 2 - 26), b.at[2] + b.size[2] / 2 + 1); bands.setMatrixAt(n * 2 + k, matrix); } }); bands.instanceMatrix.needsUpdate = true; bands.computeBoundingBox(); cabinet.add(bands);
    }
    if (!layout.compact) {
        // The writing cabinet: drawers, brass pulls and a pleated table lamp.
        // It carries the globe and inkwell when moved.
        const [x, z] = layout.console;
        const cabinet = group(root, 'Study writing cabinet', [x, 0, z + 110]);
        register(cabinet, 'study-writing-cabinet', 'Walnut writing cabinet');
        const body = kit(), pulls = kit();
        body.box([620, 650, 740], [0, 385, 0]).box([650, 30, 760], [0, 725, 0]).box([630, 14, 750], [0, 703, 0]);
        for (const [y, hgt] of [[200, 200], [415, 200], [610, 160]]) {
            body.box([10, hgt - 16, 680], [315, y, 0]);
            pulls.rod([336, y, -70], [336, y, 70], 7).rod([320, y, -70], [336, y, -70], 5).rod([320, y, 70], [336, y, 70], 5);
        }
        for (const sx of [-240, 240]) for (const sz of [-330, 330]) body.cyl(20, 14, 60, [sx, 30, sz]);
        baked(cabinet, body, oak);
        const lampFoot = [-90, 740, 250];
        pulls.cyl(66, 74, 26, [lampFoot[0], 753, lampFoot[2]]).rod([lampFoot[0], 766, lampFoot[2]], [lampFoot[0], 1090, lampFoot[2]], 9).ball(16, [lampFoot[0], 900, lampFoot[2]], { scale: [1, 1.5, 1] });
        baked(cabinet, pulls, brass, false);
        const shade = mesh(cabinet, new THREE.CylinderGeometry(92, 150, 190, 28, 1, true), shadeMat, [lampFoot[0], 1060, lampFoot[2]]); shade.castShadow = false;
        sphere(cabinet, [26, 30, 26], [lampFoot[0], 1010, lampFoot[2]], bulbMat).castShadow = false;
        const dk = kit(); dk.box([170, 36, 230], [140, 758, 250], { color: '#33495a', rot: [0, .08, 0] }).box([160, 30, 215], [140, 791, 248], { color: '#7a3b2e', rot: [0, -.06, 0] });
        baked(cabinet, dk, dress, false);
        room.propSupports.push({ obj: cabinet, id: 'globe', at: [x, 740, z] }, { obj: cabinet, id: 'ink-quill', at: [x, 740, z + 250] });
    }
    // A brass reading lamp with a pleated linen shade: beside the chair arm in
    // the small studies, in front of the chair where the room is larger.
    const besideChair = !layout.large && !layout.fireplace;
    const lampAt = besideChair ? [layout.reading[0] + 100, layout.reading[1] - 760] : [layout.reading[0] + (layout.large ? -420 : -680), layout.reading[1] - (layout.large ? 760 : 130)];
    const lampGroup = new THREE.Group(); lampGroup.name = 'Study reading lamp'; lampGroup.position.set(lampAt[0], 0, lampAt[1]); root.add(lampGroup);
    register(lampGroup, 'study-reading-lamp', 'Brass reading lamp');
    {
        const lk = kit();
        lk.cyl(120, 130, 22, [0, 11, 0], { seg: 24 }).cyl(70, 110, 16, [0, 30, 0], { seg: 24 }).rod([0, 38, 0], [0, 1300, 0], 12).ball(20, [0, 640, 0], { scale: [1, 1.6, 1] })
            .rod([0, 1300, 0], [0, 1330, 0], 18).rod([0, 1330, 0], [0, 1530, 0], 4);
        baked(lampGroup, lk, brass);
        const shade = mesh(lampGroup, new THREE.CylinderGeometry(118, 175, 230, 32, 1, true), shadeMat, [0, 1420, 0]); shade.castShadow = false;
        const pleats = kit(); for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2; pleats.rod([Math.cos(t) * 121, 1534, Math.sin(t) * 121], [Math.cos(t) * 178, 1306, Math.sin(t) * 178], 3, { seg: 4 }); }
        pleats.add(new THREE.TorusGeometry(119, 4, 6, 32), [0, 1535, 0], { rot: [Math.PI / 2, 0, 0] }).add(new THREE.TorusGeometry(176, 4, 6, 32), [0, 1305, 0], { rot: [Math.PI / 2, 0, 0] });
        baked(lampGroup, pleats, shadeMat, false);
        sphere(lampGroup, [32, 36, 32], [0, 1380, 0], bulbMat).castShadow = false;
    }
    // A potted fiddle-leaf fig fills the corner between the library and chair.
    if (besideChair) {
        const fig = group(root, 'Study potted fig', [w / 2 - 225, 0, bayEnd + 230]);
        register(fig, 'study-fig', 'Potted fiddle-leaf fig');
        const k = kit(), stem = '#6d5640';
        k.lathe([[0, 0], [130, 0], [150, 30], [172, 330], [180, 360], [168, 370], [0, 370]], [0, 0, 0], { color: '#a8664a', seg: 24 }).cyl(160, 160, 6, [0, 358, 0], { color: '#3a2a1e', seg: 20 });
        // Three stems; broad leaves cluster on their upper halves, angled up and out.
        const stems = [[[0, 360, 0], [-15, 1560, -10], 17], [[0, 700, 0], [60, 1300, 30], 10], [[0, 640, 0], [-55, 1180, -40], 9]];
        stems.forEach(([from, to, r], si) => {
            k.rod(from, to, r * .6, { end: r, color: stem });
            for (let i = 0; i < (si ? 9 : 16); i++) {
                const t = .35 + .65 * (i + .5) / (si ? 9 : 16), seed = si * 40 + i, ang = seed * 2.4 + rnd(seed) * .8;
                const at = from.map((v, n) => v + (to[n] - v) * t), out = 15 + rnd(seed * 3) * 30, len = 72 + rnd(seed * 5) * 20;
                k.ball(1, [at[0] + Math.cos(ang) * (out + len * .6), at[1] + 20, at[2] + Math.sin(ang) * (out + len * .6)], { scale: [len, 7, len * .66], rot: [(rnd(seed * 7) - .5) * .9, -ang, .2 + rnd(seed * 9) * .5], color: ['#3d6a3a', '#4a7a42', '#365e33', '#58864c', '#43723e'][seed % 5], seg: 14, rings: 8 });
            }
        });
        baked(fig, k, dress);
    }
    if (layout.fireplace) {
        // Walnut chimneypiece with slate slips and hearth; the fire and mantel
        // candles are lit with the lamps.
        const place = group(root, 'Study fireplace', [w / 2, 0, fireZ], -Math.PI / 2);
        register(place, 'study-fireplace', 'Walnut fireplace and mantel');
        const wood = kit(), stone = kit(), soot = kit(), dk = kit(), bk = kit(), fk = kit(), fire = kit(), embers = kit();
        stone.box([1300, 30, 460], [0, 15, 230]);
        for (const s of [-1, 1]) wood.box([180, 1070, 180], [s * 510, 565, 90]).box([210, 60, 200], [s * 510, 60, 100]).box([206, 36, 196], [s * 510, 780, 98]);
        wood.box([1200, 300, 180], [0, 950, 90]).box([1220, 30, 196], [0, 815, 98]).box([1320, 50, 250], [0, 1125, 125]).box([1260, 24, 220], [0, 1090, 112]);
        stone.box([90, 770, 16], [-375, 415, 186]).box([90, 770, 16], [375, 415, 186]).box([840, 100, 16], [0, 750, 186]);
        soot.box([660, 670, 20], [0, 365, 10]).box([20, 670, 180], [-330, 365, 100]).box([20, 670, 180], [330, 365, 100]).box([660, 20, 180], [0, 690, 100]);
        soot.box([480, 16, 150], [0, 70, 130]); for (const x of [-200, -100, 0, 100, 200]) soot.box([12, 70, 12], [x, 95, 205]);
        for (const [x, y, z, yaw] of [[-30, 120, 110, .1], [40, 118, 175, -.12], [0, 170, 140, .25]]) dk.cyl(42, 46, 440, [x, y, z], { rot: [0, yaw, Math.PI / 2], color: '#5d4330', seg: 10 });
        embers.box([440, 14, 140], [0, 86, 140]);
        for (const [x, hgt, r, lean] of [[-110, 230, 50, .12], [0, 300, 62, -.05], [100, 210, 46, -.14], [-50, 170, 36, .2], [60, 160, 34, -.22]]) { fire.add(new THREE.ConeGeometry(r, hgt, 10), [x, 150 + hgt / 2, 140], { rot: [0, 0, lean] }); fk.add(new THREE.ConeGeometry(r * .5, hgt * .55, 8), [x, 135 + hgt * .28, 148], { rot: [0, 0, lean] }); }
        // Mantel: candlesticks, a clock, a vase of dried grasses and books.
        for (const x of [-540, 540]) candle(dk, bk, fk, [x, 1150, 120], 170);
        dk.box([230, 210, 110], [0, 1255, 110], { color: '#4a3526' }).cyl(115, 115, 110, [0, 1360, 110], { rot: [Math.PI / 2, 0, 0], color: '#4a3526', seg: 20 }).cyl(70, 70, 6, [0, 1300, 168], { rot: [Math.PI / 2, 0, 0], color: '#efe6d2' });
        dk.box([4, 50, 3], [0, 1318, 172], { color: '#222' }).box([36, 4, 3], [16, 1300, 172], { color: '#222' });
        dk.lathe([[0, 0], [44, 0], [62, 70], [40, 170], [30, 210], [38, 222], [0, 222]], [-300, 1150, 110], { color: '#9a7f5e' });
        for (let i = 0; i < 9; i++) dk.rod([-300, 1340, 110], [-300 + (rnd(i) - .5) * 260, 1560 + rnd(i * 3) * 160, 110 + (rnd(i * 5) - .5) * 80], 3, { color: '#c8b48a', seg: 4 });
        for (let i = 0; i < 9; i++) dk.ball(14, [-300 + (rnd(i) - .5) * 250, 1555 + rnd(i * 3) * 160, 110 + (rnd(i * 5) - .5) * 76], { color: '#d8c49a', scale: [1, 2.4, 1] });
        for (let i = 0; i < 3; i++) dk.box([220 - i * 16, 40, 170 - i * 8], [300, 1170 + i * 40, 115], { rot: [0, (rnd(i) - .5) * .3, 0], color: ['#2f4a3f', '#7a3b2e', '#cdb88e'][i] });
        baked(place, wood, oak); baked(place, stone, slate); baked(place, soot, material('#1d1a18', { roughness: .95 }), false);
        baked(place, dk, dress); baked(place, bk, brass, false); flames.push(baked(place, fk, flameMat, false));
        fires.push(baked(place, fire, fireMat, false), baked(place, embers, emberMat, false));
        // Firelight pools on the boards and warms the firebox; additive and unlit, no extra light.
        const glowMap = texture((c, s) => { const g = c.createRadialGradient(s / 2, 0, 4, s / 2, 0, s * .9); g.addColorStop(0, '#ffffffff'); g.addColorStop(.4, '#ffffff55'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, s, s); }, 256, 256);
        glowMap.wrapS = glowMap.wrapT = THREE.ClampToEdgeWrapping;
        const pool = mesh(side, new THREE.PlaneGeometry(1500, 1400), new THREE.MeshBasicMaterial({ map: glowMap, color: '#ff9a4a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), [w / 2 - 460 - 700, 1.5, fireZ]);
        pool.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); pool.castShadow = pool.receiveShadow = false; pool.renderOrder = 2; fires.push(pool);
        const backGlow = mesh(place, new THREE.PlaneGeometry(640, 560), pool.material.clone(), [0, 300, 22]); backGlow.rotation.z = Math.PI; backGlow.castShadow = backGlow.receiveShadow = false; fires.push(backGlow);
    }
    if (layout.large) fringe(box(root, [2700, 4, 2060], [650, 2, front - 1050], rugMat, 6), [2700, 2060]);
    if (layout.chess) {
        const chess = new THREE.Group(); chess.name = 'Study chess table'; chess.position.set(350, 0, front - 2580); root.add(chess); register(chess, 'study-chess', 'Chess table and stools');
        box(chess, [1050, 40, 900], [0, 730, 0], oak, 5);
        for (const x of [-410, 410]) for (const z of [-340, 340]) box(chess, [55, 710, 55], [x, 355, z], oak, 3);
        const board = texture((c, tw, th) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { c.fillStyle = (x + y) % 2 ? '#596861' : '#d5c5a2'; c.fillRect(x * tw / 8, y * th / 8, tw / 8, th / 8); } });
        box(chess, [540, 12, 540], [0, 756, 0], material('#ffffff', { map: board, roughness: .75 }));
        // Pieces are baked per side: two draw calls for all thirty-two.
        for (const team of [-1, 1]) {
            const k = kit();
            for (let row = 0; row < 2; row++) for (let col = 0; col < 8; col++) {
                const x = (col - 3.5) * 67.5, z = team * (3.5 - row) * 67.5, height = row ? 27 : 40 + (col === 3 || col === 4 ? 14 : 0);
                k.cyl(16, 21, 11, [x, 767.5, z]).cyl(8, 14, height, [x, 773 + height / 2, z], { seg: 12 }).ball(1, [x, 773 + height, z], { scale: [12, 13, 12] });
            }
            baked(chess, k, team < 0 ? cream : dark);
        }
        for (const sign of [-1, 1]) {
            box(chess, [470, 60, 400], [0, 430, sign * 840], dark, 12);
            for (const x of [-175, 175]) for (const z of [-135, 135]) box(chess, [35, 400, 35], [x, 200, sign * 840 + z], oak, 2);
        }
    }
    const ceiling = new THREE.Group(); ceiling.name = 'Study suspended reading light'; root.add(ceiling); room.ceilingFixture = ceiling;
    rod(ceiling, [layout.desk[0], h, layout.desk[1] + 300], [layout.desk[0], h - 340, layout.desk[1] + 300], 5, brass);
    mesh(ceiling, new THREE.CylinderGeometry(190, 270, 140, 32, 1, true), shadeMat, [layout.desk[0], h - 400, layout.desk[1] + 300]).castShadow = false;
    const diffuser = mesh(ceiling, new THREE.CylinderGeometry(255, 255, 3, 24), bulbMat, [layout.desk[0], h - 461, layout.desk[1] + 300]); diffuser.castShadow = false;
    const lights = [
        { at: [layout.desk[0] + 360, 1350, layout.desk[1] - 160], power: 2.7, range: 3000, task: true },
        { at: [w / 2 - 500, 1900, bz + 1180], power: 2.8, range: 3500 },
        { at: [lampGroup.position.x, 1340, lampGroup.position.z], power: 2, range: 3000, task: true },
        { at: [650, 1900, front - 1250], power: 3.1, range: 4500 }
    ].map(spec => { const light = new THREE.PointLight('#f2d4ad', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    // The window looks onto a private garden: rooftops, a garden wall and an
    // old pear tree. Sun, clouds, moon and lit neighbouring windows follow the mode.
    const paintView = (c, mode, modeId) => {
        const S = 512, night = modeId === 'night', dusk = modeId === 'evening' || modeId === 'party';
        const sky = c.createLinearGradient(0, 0, 0, S * .75); sky.addColorStop(0, mode.sky[0]); sky.addColorStop(1, mode.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, S, S);
        if (night) {
            for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,250,235,${.3 + rnd(i) * .6})`; c.fillRect(rnd(i * 3) * S, rnd(i * 5) * S * .5, 1.5, 1.5); }
            const moon = c.createRadialGradient(370, 90, 6, 370, 90, 70); moon.addColorStop(0, '#fff8e0'); moon.addColorStop(.3, '#f4ecd255'); moon.addColorStop(1, '#f4ecd200'); c.fillStyle = moon; c.fillRect(290, 10, 160, 160);
            c.fillStyle = '#fbf3da'; c.beginPath(); c.arc(370, 90, 20, 0, Math.PI * 2); c.fill();
        } else {
            const [sx, sy, r] = dusk ? [130, 300, 170] : modeId === 'morning' ? [90, 120, 150] : [400, 70, 130];
            const sun = c.createRadialGradient(sx, sy, 4, sx, sy, r); sun.addColorStop(0, dusk ? '#ffe0a0' : '#fffbea'); sun.addColorStop(1, '#ffffff00'); c.fillStyle = sun; c.fillRect(0, 0, S, S);
            for (let i = 0; i < 6; i++) { c.fillStyle = dusk ? '#f6c2a266' : '#ffffff77'; c.beginPath(); c.ellipse(rnd(i * 7) * S, 40 + rnd(i * 3) * 160, 60 + rnd(i) * 50, 12 + rnd(i * 5) * 8, 0, 0, Math.PI * 2); c.fill(); }
        }
        const tone = (day, eve, dark) => night ? dark : dusk ? eve : day;
        c.fillStyle = tone('#8d99a3', '#5d5566', '#18212e');
        c.beginPath(); c.moveTo(0, 330);
        for (const [x, y] of [[40, 300], [110, 300], [150, 270], [210, 270], [250, 310], [330, 310], [360, 285], [430, 285], [470, 315], [512, 315]]) c.lineTo(x, y);
        c.lineTo(512, 512); c.lineTo(0, 512); c.fill();
        for (const x of [80, 190, 395]) c.fillRect(x, 248 + (x % 3) * 12, 18, 40);
        if (night || dusk) for (const [x, y] of [[60, 318], [175, 296], [372, 304], [440, 312]]) { c.fillStyle = night ? '#ffcf7a' : '#ffd99a88'; c.fillRect(x, y, 14, 18); }
        c.fillStyle = tone('#a46e52', '#6e4a3e', '#20191a'); c.fillRect(0, 410, S, 102);
        c.strokeStyle = tone('#8a5a42', '#5a3c32', '#151112'); c.lineWidth = 2;
        for (let y = 418; y < 512; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); for (let x = (y / 14 % 2) * 20; x < S; x += 40) { c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x, y); c.stroke(); } }
        c.fillStyle = tone('#5d4a3a', '#3a2e27', '#0e0d0c'); c.fillRect(300, 200, 22, 230);
        for (let i = 0; i < 14; i++) { c.fillStyle = tone(i % 2 ? '#5f7d4e' : '#4d6a40', i % 2 ? '#3f4a38' : '#343e30', '#101614'); c.beginPath(); c.arc(260 + rnd(i) * 140, 150 + rnd(i * 3) * 110, 40 + rnd(i * 5) * 26, 0, Math.PI * 2); c.fill(); }
        if (!night) for (let i = 0; i < 8; i++) { c.fillStyle = dusk ? '#e9b86a' : '#d8c560'; c.beginPath(); c.arc(270 + rnd(i * 9) * 120, 170 + rnd(i * 11) * 90, 6, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = tone('#56704a', '#3a4636', '#0f1512'); for (let x = 0; x < S; x += 26) { c.beginPath(); c.arc(x, 420, 30 + rnd(x) * 12, 0, Math.PI * 2); c.fill(); }
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = STUDY_MODES[modeId] || STUDY_MODES.afternoon;
        paintView(skyCanvas.getContext('2d'), mode, modeId); skyMap.needsUpdate = true;
        // Shelf strips stay on for late reading even when the room wash is low.
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .08 + Math.max(mode.wash, mode.practical * .7) * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#f8dbac' : mode.colors[0]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        bulbMat.emissiveIntensity = .15 + mode.practical * .7;
        // Shades glow from inside once the lamps are doing real work.
        shadeMat.emissiveIntensity = .04 + Math.max(0, mode.practical - .1) * .55 * accent;
        pictureGlow.emissiveIntensity = mode.practical > .5 ? .6 + mode.practical * .9 : .08;
        const lit = mode.practical > .6;
        flames.forEach(obj => { obj.visible = lit; }); fires.forEach(obj => { obj.visible = lit; if (obj.material.isMeshBasicMaterial) obj.material.opacity = (obj.parent === side ? .42 : .9) * mode.practical * accent; });
        flameMat.emissiveIntensity = 1.6 + mode.practical * .8;
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[oak, 'wood'], [sage, 'plaster'], [paper, 'plaster'], [cream, 'plaster'], [dark, 'powder'], [brass, 'metal'], [linen, 'fabric'], [slate, 'stone']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
