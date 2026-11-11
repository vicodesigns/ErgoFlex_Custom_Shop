import * as THREE from 'three';

// Student life in the Humboldt-inspired commons: the traces people leave when
// they study here. Open laptops, bags, coats, cups, notes, written-up boards,
// a crowded tackboard, a returns cart that fills through the day, and an open
// house at the event daypart. No figures: only what students leave behind.
//
// Everything shares ONE material (`lifeAtlas`): a canvas atlas whose bottom
// strip is a colour palette. Solid parts point every UV at one swatch, and
// printed parts (screens, pages, labels) map onto tiles. Roughness and
// metalness come from a matching ORM canvas, and only the screen tiles glow.
// So every table, café table, chair dressing or floor group is one draw per
// daypart. Dressings are children of their table / chair / side table, so
// owner moves (and room-life chair pulls) carry them along.
//
// Spec: scratchpad experts/student-life.md. Seat states feed the chair
// messiness branch in room-life.mjs through root.userData.humboldtSeats.

const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const CHAIR = 'kenney-furniture-chair-modern-cushion';
const AT = 1024;

// ---------- Palette swatches: [name, colour, roughness, metalness] ----------
const SWATCHES = [
    ['white', '#ffffff', .9, 0], ['paper', '#f4f1e8', .92, 0], ['laptopSilver', '#c4c7ca', .35, .6], ['laptopGrey', '#5b5e63', .38, .55],
    ['laptopBlack', '#1c1d1f', .45, .2], ['keyDeck', '#2a2b2e', .6, 0], ['phone', '#151617', .3, .2], ['caseSage', '#9fb39a', .7, 0],
    ['caseCoral', '#e07a5f', .7, 0], ['bottleNavy', '#2d3f63', .5, .15], ['bottleSage', '#8fa58c', .5, .15], ['bottleWhite', '#e9e8e3', .45, .1],
    ['bottleLilac', '#a99cc6', .5, .15], ['steel', '#9a9da0', .3, .8], ['kraft', '#c2a27a', .85, 0], ['lidWhite', '#f2f1ec', .5, 0],
    ['cupTeal', '#2f6f73', .5, 0], ['cupTerra', '#b5674a', .6, 0], ['packNavy', '#2b3a55', .85, 0], ['packBlack', '#222326', .8, 0],
    ['packForest', '#3c5a3e', .85, 0], ['packMaroon', '#6b2a2f', .85, 0], ['packMustard', '#c08f2e', .85, 0], ['packHeather', '#7b7f84', .9, 0],
    ['packTeal', '#2f6f73', .85, 0], ['denim', '#4a6386', .9, 0], ['parka', '#5d6142', .85, 0], ['flannel', '#8e2f2b', .92, 0],
    ['tan', '#a88a64', .9, 0], ['rain', '#2d7f86', .45, 0], ['rubber', '#1f2022', .7, 0], ['brass', '#a58a5c', .35, .8],
    ['oak', '#b38a5a', .5, 0], ['cobalt', '#2f4f8f', .75, 0], ['crimson', '#8b2e2e', .75, 0], ['forest', '#2e5a46', .75, 0],
    ['ochre', '#c48a2c', .75, 0], ['charcoal', '#33363a', .75, 0], ['hiYellow', '#f2e33a', .5, 0], ['hiPink', '#f064a5', .5, 0],
    ['hiGreen', '#7ed957', .5, 0], ['stYellow', '#f4e06d', .9, 0], ['stPink', '#f29bb0', .9, 0], ['stBlue', '#8ecae6', .9, 0],
    ['stGreen', '#a7d98a', .9, 0], ['binGrey', '#4a4d50', .6, 0], ['binBlue', '#2a5ea8', .55, 0], ['binGreen', '#3f7d3a', .55, 0],
    ['caution', '#f2c230', .5, 0], ['pilot', '#154c3d', .9, 0], ['coffee', '#3a2a1e', .2, 0], ['ceramic', '#c7d2c6', .3, 0],
    ['apple', '#b8352f', .5, 0], ['wrapper', '#d8442f', .4, .3], ['dispenser', '#dfe6e6', .15, 0], ['calcLcd', '#9aa58e', .4, 0],
    ['cream', '#e7e1d6', .6, 0], ['cotton', '#d9cfbc', .92, 0], ['pinRed', '#c8372d', .4, 0], ['pinBlue', '#2f5fb3', .4, 0]
];
const SWI = new Map(SWATCHES.map((s, i) => [s[0], i]));
const textile = name => /^(pack|denim$|parka$|flannel$|tan$|rain$|cotton$)/.test(name);
const sw = name => {
    const i = SWI.get(name), x = (i % 32) * 32, y = 960 + Math.floor(i / 32) * 32;
    // Textiles sample the whole woven tile instead of a single flat colour.
    return textile(name) ? [(x + 2) / AT, 1 - (y + 30) / AT, (x + 30) / AT, 1 - (y + 2) / AT] : [(x + 16) / AT, 1 - (y + 16) / AT];
};
// Printed tiles (px in the 1024 atlas; canvas y runs down, so v = 1 - y).
const TILES = {
    code: [0, 0, 256, 160], doc: [256, 0, 256, 160], slides: [512, 0, 256, 160], sheet: [768, 0, 256, 160],
    course: [0, 160, 256, 160], map: [256, 160, 256, 160], search: [512, 160, 256, 160], lock: [768, 160, 256, 160],
    nbLined: [0, 320, 256, 176], nbGraph: [256, 320, 256, 176], nbCornell: [512, 320, 256, 176], nbDiagram: [768, 320, 256, 176],
    bkText: [0, 496, 256, 176], bkChem: [256, 496, 256, 176], bkMap: [512, 496, 256, 176], poster: [768, 496, 256, 352],
    spines: [0, 672, 256, 128], mags: [256, 672, 256, 128], news: [512, 672, 128, 128], nameTag: [640, 672, 128, 128],
    tentQuiet: [0, 800, 256, 96], tentGroup: [256, 800, 256, 96], pizza: [512, 800, 96, 96], mindmap: [608, 800, 160, 96],
    banner: [0, 896, 512, 64], bins: [512, 896, 384, 64], wet: [896, 896, 128, 64]
};
const tileUV = name => { const [x, y, w, h] = TILES[name]; return [(x + 1.5) / AT, 1 - (y + h - 1.5) / AT, (x + w - 1.5) / AT, 1 - (y + 1.5) / AT]; };
const halfUV = (r, right) => right ? [(r[0] + r[2]) / 2, r[1], r[2], r[3]] : [r[0], r[1], (r[0] + r[2]) / 2, r[3]];
const SCREENS = ['code', 'doc', 'slides', 'sheet', 'course', 'map', 'search'];
const NOTEBOOKS = ['nbLined', 'nbGraph', 'nbCornell', 'nbDiagram'];
const BOOKS = ['bkText', 'bkChem', 'bkMap'];
const COVERS = ['cobalt', 'crimson', 'forest', 'ochre', 'charcoal', 'packTeal'];
const PACKS = ['packNavy', 'packBlack', 'packForest', 'packMaroon', 'packMustard', 'packHeather', 'packTeal'];
const JACKETS = ['denim', 'parka', 'flannel', 'tan', 'rain', 'packBlack'];
const BOTTLES = ['bottleNavy', 'bottleSage', 'bottleWhite', 'bottleLilac'];
const STICKY = ['stYellow', 'stPink', 'stBlue', 'stGreen'];
const HIGHLIGHT = ['hiYellow', 'hiPink', 'hiGreen'];
const LAPTOPS = ['laptopSilver', 'laptopGrey', 'laptopBlack', 'laptopSilver'];
const pick = (list, n) => list[Math.floor(rnd(n) * list.length) % list.length];

// ---------- A small baker: parts in a parent frame, UVs on swatches/tiles ----------
const ZERO = [0, 0, 0];
function baker() {
    const parts = [], local = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const api = {
        add(geo, M, at, rot, uv) {
            const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
            local.compose(p.set(...at), q.setFromEuler(e.set(...(rot || ZERO))), one).premultiply(M);
            g.applyMatrix4(local);
            const a = g.attributes.uv;
            if (uv && a) for (let i = 0; i < a.count; i++) a.setXY(i, uv.length === 2 ? uv[0] : uv[0] + a.getX(i) * (uv[2] - uv[0]), uv.length === 2 ? uv[1] : uv[1] + a.getY(i) * (uv[3] - uv[1]));
            parts.push(g); return api;
        },
        box: (M, size, at, rot, uv) => api.add(new THREE.BoxGeometry(...size), M, at, rot, uv),
        cyl: (M, top, bottom, height, at, rot, uv, seg = 10) => api.add(new THREE.CylinderGeometry(top, bottom, height, seg), M, at, rot, uv),
        plane: (M, size, at, rot, uv) => api.add(new THREE.PlaneGeometry(...size), M, at, rot, uv),
        ball: (M, r, at, uv) => api.add(new THREE.SphereGeometry(r, 8, 6), M, at, ZERO, uv),
        // A thin cable / rod between two points lying in the frame.
        seg(M, a, b, w, uv) {
            const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
            if (len < 1) return api;
            const geo = new THREE.BoxGeometry(w, w, len), dir = new THREE.Vector3(dx, dy, dz).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            geo.applyQuaternion(quat); return api.add(geo, M, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], ZERO, uv);
        },
        get count() { return parts.length; },
        build() {
            if (!parts.length) return null;
            let n = 0; for (const g of parts) n += g.attributes.position.count;
            const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
            for (const g of parts) {
                const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
                if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
                o += c; g.dispose();
            }
            const out = new THREE.BufferGeometry();
            out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            out.computeBoundingBox(); out.computeBoundingSphere(); parts.length = 0; return out;
        }
    };
    return api;
}
// Child frame: translate then turn about y (and optionally tilt).
const F = (M, x, y, z, ry = 0, rx = 0, rz = 0) => M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
const FLAT = [-Math.PI / 2, 0, 0];

// ---------- Item recipes (mm, item origin at its base centre, +z toward the user) ----------
const items = {
    laptop(b, M, { body = 'laptopSilver', screen = 'code', closed = false } = {}) {
        if (closed) return b.box(M, [310, 17, 215], [0, 8.5, 0], ZERO, sw(body));
        b.box(M, [310, 14, 215], [0, 7, 0], ZERO, sw(body)).box(M, [280, 1, 110], [0, 14.5, -25], ZERO, sw('keyDeck')).box(M, [100, 1, 65], [0, 14.5, 62], ZERO, sw(body));
        // Lid opened to 105°: hinge at z -107, leaning back 15°.
        b.box(M, [310, 7, 205], [0, 113, -133.5], [1.309, 0, 0], sw(body));
        b.plane(M, [286, 180], [0, 114.2, -129.2], [-.262, 0, 0], tileUV(screen));
    },
    phone: (b, M, skin = 'phone') => b.box(M, [72, 8, 150], [0, 4, 0], ZERO, sw(skin)),
    bottle(b, M, col) {
        b.cyl(M, 37, 37, 220, [0, 110, 0], ZERO, sw(col), 12).cyl(M, 30, 37, 18, [0, 229, 0], ZERO, sw(col), 12)
            .cyl(M, 30, 30, 30, [0, 253, 0], ZERO, sw(col === 'bottleWhite' ? 'charcoal' : 'steel'), 12).box(M, [40, 8, 6], [0, 272, 0], ZERO, sw('charcoal'));
    },
    cup(b, M, col = 'kraft') {
        b.cyl(M, 42, 32, 150, [0, 75, 0], ZERO, sw(col === 'kraft' ? 'lidWhite' : col), 12).cyl(M, 43.5, 40, 50, [0, 80, 0], ZERO, sw('kraft'), 12)
            .cyl(M, 44, 44, 14, [0, 157, 0], ZERO, sw(col === 'kraft' ? 'lidWhite' : 'charcoal'), 12).box(M, [16, 6, 10], [0, 166, 30], ZERO, sw('lidWhite'));
    },
    mug(b, M) { b.cyl(M, 40, 36, 95, [0, 47.5, 0], ZERO, sw('ceramic'), 12).cyl(M, 36, 36, 2, [0, 94, 0], ZERO, sw('coffee'), 12).box(M, [12, 55, 30], [46, 50, 0], ZERO, sw('ceramic')); },
    openBook(b, M, { cover = 'cobalt', page = 'bkText', w = 440, d = 265 } = {}) {
        const half = w / 2 - 6, uv = tileUV(page);
        b.box(M, [w, 4, d + 5], [0, 2, 0], ZERO, sw(cover));
        for (const s of [-1, 1]) {
            b.box(M, [half, 16, d - 10], [s * (half / 2 + 2), 12, 0], [0, 0, -s * .04], sw('paper'));
            b.plane(M, [half, d - 10], [s * (half / 2 + 2), 20.4 + 0, 0], [-Math.PI / 2, 0, -s * .04], halfUV(uv, s > 0));
        }
    },
    closedBook(b, M, cover, [w, h, d] = [205, 38, 260]) { b.box(M, [w, h, d], [0, h / 2, 0], ZERO, sw(cover)).box(M, [w - 7, h - 6, d - 8], [4, h / 2, 0], ZERO, sw('paper')); },
    notebook(b, M, { page = 'nbLined', cover = 'packTeal' } = {}) {
        b.box(M, [305, 2, 222], [0, 1, 0], ZERO, sw(cover)).box(M, [300, 5, 215], [0, 4.5, 0], ZERO, sw('paper'))
            .plane(M, [300, 215], [0, 7.1, 0], FLAT, tileUV(page)).box(M, [8, 9, 215], [0, 7, 0], ZERO, sw('steel'));
    },
    composition: (b, M) => b.box(M, [190, 10, 245], [0, 5, 0], ZERO, sw('charcoal')).box(M, [90, .6, 50], [0, 10.3, -40], ZERO, sw('paper')),
    sticky: (b, M, col) => b.box(M, [76, 1.2, 76], [0, .6, 0], ZERO, sw(col)),
    highlighter(b, M, col) {
        // A six-sided barrel rests on its flat side, whose height is r cos30°.
        const flat = Math.cos(Math.PI / 6);
        b.cyl(M, 8, 8, 118, [0, 8 * flat, 0], [0, 0, Math.PI / 2], sw(col), 6).cyl(M, 9, 9, 38, [72, 9 * flat, 0], [0, 0, Math.PI / 2], sw(col), 6);
    },
    pen: (b, M) => b.cyl(M, 4, 4, 140, [0, 4 * Math.cos(Math.PI / 6), 0], [0, 0, Math.PI / 2], sw('packNavy'), 6),
    calculator: (b, M) => b.box(M, [85, 15, 165], [0, 7.5, 0], ZERO, sw('rubber')).box(M, [65, 1, 24], [0, 15.5, -50], ZERO, sw('calcLcd')),
    headphones(b, M) {
        for (const s of [-1, 1]) b.cyl(M, 45, 45, 35, [s * 80, 17.5, 0], ZERO, sw('charcoal'), 12);
        b.box(M, [70, 10, 40], [0, 30, -70], ZERO, sw('charcoal')).box(M, [60, 10, 40], [-62, 30, -45], [0, -.6, 0], sw('charcoal')).box(M, [60, 10, 40], [62, 30, -45], [0, .6, 0], sw('charcoal'));
    },
    snack(b, M) { b.box(M, [150, 230, 90], [0, 115, 0], ZERO, sw('kraft')).box(M, [110, 10, 35], [150, 5, 40], [0, .4, 0], sw('wrapper')).ball(M, 38, [-130, 38, 60], sw('apple')); },
    poster(b, M, [w, d] = [600, 450]) { b.box(M, [w, 1, d], [0, .5, 0], ZERO, sw('paper')).plane(M, [w, d], [0, 1.1, 0], FLAT, tileUV('mindmap')); },
    pizza(b, M) { b.box(M, [400, 45, 400], [0, 22.5, 0], ZERO, sw('kraft')).box(M, [400, 45, 400], [10, 67.5, 8], [0, .2, 0], sw('kraft')).plane(M, [400, 400], [10, 90.2, 8], [-Math.PI / 2, 0, .2], tileUV('pizza')); },
    tent(b, M, tile) { for (const s of [-1, 1]) b.box(M, [140, 100, 1.5], [0, 48, s * 15], [s * .3, 0, 0], tileUV(tile)); },
    module(b, M) { b.box(M, [240, 32, 80], [0, 16, 0], ZERO, sw('rubber')); for (const s of [-1, 1]) b.box(M, [34, 1, 44], [s * 55, 32.5, 0], ZERO, sw('charcoal')); },
    // Backpack standing (on the floor or a seat): straps at -z, front pocket at +z.
    backpack(b, M, col) {
        b.box(M, [300, 360, 170], [0, 205, 0], ZERO, sw(col)).cyl(M, 85, 85, 300, [0, 385, 0], [0, 0, Math.PI / 2], sw(col), 12).box(M, [306, 22, 176], [0, 11, 0], ZERO, sw('rubber'))
            .box(M, [240, 190, 45], [0, 150, 103], ZERO, sw(col)).box(M, [35, 140, 130], [-165, 100, 0], ZERO, sw(col)).box(M, [180, 6, 50], [0, 268, 103], ZERO, sw('rubber'));
        for (const s of [-1, 1]) b.box(M, [50, 360, 14], [s * 80, 230, -92], ZERO, sw('rubber'));
    },
    tote(b, M) { b.box(M, [380, 340, 90], [0, 170, 0], ZERO, sw('cotton')); for (const s of [-1, 1]) b.box(M, [20, 150, 8], [s * 70, 400, 0], [0, 0, s * .35], sw('cotton')); b.box(M, [180, 120, 1], [0, 180, 46], ZERO, sw('forest')); },
    // A coat folded and dropped flat (event coat pile).
    foldedCoat: (b, M, col) => b.box(M, [440, 55, 360], [0, 27.5, 0], ZERO, sw(col)).box(M, [120, 30, 340], [-200, 60, 0], [0, 0, .25], sw(col)),
    umbrella(b, M) { b.cyl(M, 6, 30, 640, [0, 320, 0], ZERO, sw('packNavy'), 8).cyl(M, 6, 6, 220, [0, 750, 0], ZERO, sw('charcoal'), 6).box(M, [12, 12, 70], [0, 860, 30], ZERO, sw('charcoal')); },
    newspaper: (b, M) => b.box(M, [300, 6, 380], [0, 3, 0], ZERO, sw('paper')).plane(M, [300, 380], [0, 6.1, 0], FLAT, tileUV('news'))
};

// ---------- Atlas drawing ----------
const HAND = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Neue","Comic Sans MS",sans-serif';
function scribble(c, x, y, w, color, seed, lw = 1.4) {
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(x, y);
    for (let i = 1; i <= Math.max(3, w / 5); i++) c.lineTo(x + i * 5, y + (rnd(seed + i) - .5) * 4 - (i % 3 === 0 ? 2 : 0));
    c.stroke();
}
function fitText(c, text, x, y, maxW, size, weight = '') { let f = size; do { c.font = `${weight} ${f}px sans-serif`; f -= 1; } while (c.measureText(text).width > maxW && f > 8); c.fillText(text, x, y); }
function textLines(c, x, y, w, rows, gap, color, seed, h = 3) { c.fillStyle = color; for (let r = 0; r < rows; r++) c.fillRect(x, y + r * gap, w * (.55 + rnd(seed + r) * .45), h); }
function drawAtlas(c) {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, AT, AT);
    const T = name => TILES[name];
    // Screens (each with a slim browser/app chrome bar).
    const chrome = ([x, y, w], dark) => { c.fillStyle = dark ? '#2b2f38' : '#e4e6ea'; c.fillRect(x, y, w, 12); for (let i = 0; i < 3; i++) { c.fillStyle = ['#e06c5f', '#e3b341', '#5fb26a'][i]; c.beginPath(); c.arc(x + 8 + i * 9, y + 6, 2.6, 0, 7); c.fill(); } };
    { const [x, y, w, h] = T('code'); c.fillStyle = '#1e2430'; c.fillRect(x, y, w, h); c.fillStyle = '#262d3b'; c.fillRect(x, y + 12, 26, h - 12); chrome(T('code'), true);
        const cols = ['#7fb4ff', '#c792ea', '#9ece6a', '#e0af68', '#a9b1d6', '#7dcfff'];
        for (let r = 0; r < 16; r++) { const ind = [0, 1, 1, 2, 2, 1, 0, 1, 2, 3, 2, 1, 0, 0, 1, 1][r] * 12; let cx = x + 34 + ind; c.fillStyle = '#4b5263'; c.fillRect(x + 6, y + 18 + r * 8.6, 12, 3); for (let k = 0; k < 1 + (r * 7) % 4; k++) { const ww = 12 + rnd(r * 9 + k) * 40; c.fillStyle = cols[(r + k * 2) % cols.length]; c.fillRect(cx, y + 18 + r * 8.6, ww, 3.6); cx += ww + 6; } } }
    { const [x, y, w, h] = T('doc'); c.fillStyle = '#d9dce1'; c.fillRect(x, y, w, h); chrome(T('doc')); c.fillStyle = '#ffffff'; c.fillRect(x + 48, y + 18, w - 96, h - 18); c.fillStyle = '#2a2d33'; c.fillRect(x + 62, y + 28, 90, 7); textLines(c, x + 62, y + 44, w - 124, 12, 8.6, '#7a7f88', 11); }
    { const [x, y, w, h] = T('slides'); c.fillStyle = '#1f4e5a'; c.fillRect(x, y, w, h); chrome(T('slides')); c.fillStyle = '#f4f1e8'; c.fillRect(x + 22, y + 46, 120, 12); c.fillRect(x + 22, y + 64, 80, 7); c.fillStyle = '#e3b341'; c.fillRect(x + 22, y + 84, 40, 4); c.fillStyle = '#5f9a7a'; c.fillRect(x + 160, y + 34, 76, 96); c.fillStyle = '#2e6b4f'; c.beginPath(); c.moveTo(x + 160, y + 130); c.lineTo(x + 190, y + 80); c.lineTo(x + 214, y + 112); c.lineTo(x + 236, y + 90); c.lineTo(x + 236, y + 130); c.fill(); }
    { const [x, y, w, h] = T('sheet'); c.fillStyle = '#ffffff'; c.fillRect(x, y, w, h); chrome(T('sheet')); c.fillStyle = '#1e7145'; c.fillRect(x, y + 12, w, 10); c.strokeStyle = '#d5d9de'; c.lineWidth = 1;
        for (let gx = x; gx <= x + w; gx += 32) { c.beginPath(); c.moveTo(gx + .5, y + 22); c.lineTo(gx + .5, y + h); c.stroke(); } for (let gy = y + 22; gy <= y + h; gy += 9) { c.beginPath(); c.moveTo(x, gy + .5); c.lineTo(x + w, gy + .5); c.stroke(); }
        for (let r = 0; r < 14; r++) for (let k = 0; k < 7; k++) { c.fillStyle = k === 0 ? '#3a3f46' : '#6b7079'; c.fillRect(x + 4 + k * 32, y + 25 + r * 9, 10 + rnd(r * 7 + k) * 16, 3); } c.fillStyle = '#b7e1c8'; c.fillRect(x + 96, y + 76, 32, 9); }
    { const [x, y, w, h] = T('course'); c.fillStyle = '#f3f4f6'; c.fillRect(x, y, w, h); chrome(T('course')); c.fillStyle = '#2a3f5f'; c.fillRect(x, y + 12, 44, h - 12); for (let i = 0; i < 7; i++) { c.fillStyle = '#8fa3c0'; c.fillRect(x + 8, y + 24 + i * 14, 28, 4); }
        for (let i = 0; i < 4; i++) { const cx = x + 54 + (i % 2) * 98, cy = y + 24 + Math.floor(i / 2) * 64; c.fillStyle = '#ffffff'; c.fillRect(cx, cy, 90, 56); c.fillStyle = ['#c25a3a', '#2f6f73', '#c08f2e', '#4a6386'][i]; c.fillRect(cx, cy, 90, 18); textLines(c, cx + 6, cy + 26, 70, 3, 8, '#8b9099', i * 13); } }
    { const [x, y, w, h] = T('map'); c.fillStyle = '#7fa9c9'; c.fillRect(x, y, w, h); c.fillStyle = '#a9c79a'; c.beginPath(); c.moveTo(x + 90, y + 12); for (let i = 0; i <= 12; i++) c.lineTo(x + 80 + rnd(i * 3) * 40 + i * 2, y + 12 + i * 12.4); c.lineTo(x + w, y + h); c.lineTo(x + w, y + 12); c.fill();
        c.strokeStyle = '#6f8f5f'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(x + 180, y + 80, 18 + k * 9, 12 + k * 7, .4, 0, 7); c.stroke(); } c.fillStyle = '#d9c39a'; c.fillRect(x + 128, y + 104, 26, 18); chrome(T('map')); c.fillStyle = '#c8372d'; c.beginPath(); c.arc(x + 150, y + 60, 4, 0, 7); c.fill(); }
    { const [x, y, w, h] = T('search'); c.fillStyle = '#ffffff'; c.fillRect(x, y, w, h); chrome(T('search')); c.strokeStyle = '#9aa3ad'; c.strokeRect(x + 16.5, y + 18.5, w - 60, 12); c.fillStyle = '#1f4e8a'; c.fillRect(x + w - 40, y + 18, 26, 13);
        for (let i = 0; i < 5; i++) { c.fillStyle = '#2a5db0'; c.fillRect(x + 16, y + 42 + i * 23, 120 + rnd(i) * 80, 5); textLines(c, x + 16, y + 51 + i * 23, 200, 2, 6, '#9399a2', i * 5, 2.4); } }
    { const [x, y, w, h] = T('lock'); const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#26304a'); g.addColorStop(1, '#4a3a5a'); c.fillStyle = g; c.fillRect(x, y, w, h); c.fillStyle = '#ffffff'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.fillText('9:41', x + w / 2, y + 90); c.font = '16px sans-serif'; c.fillText('Thursday', x + w / 2, y + 114); }
    // Notebook spreads (two pages each).
    const spread = ([x, y, w, h], ruled, seed) => { c.fillStyle = '#f8f6ef'; c.fillRect(x, y, w, h); c.fillStyle = '#d8d4c8'; c.fillRect(x + w / 2 - 1, y, 2, h); if (ruled) { c.fillStyle = '#b8cde0'; for (let ly = y + 16; ly < y + h - 4; ly += 9) c.fillRect(x + 4, ly, w - 8, 1); c.fillStyle = '#e4a5a5'; c.fillRect(x + 18, y, 1, h); c.fillRect(x + w / 2 + 18, y, 1, h); } };
    { const r = T('nbLined'), [x, y, w] = r; spread(r, true, 1); for (let row = 0; row < 15; row++) for (const p of [0, 1]) if (rnd(row * 3 + p) > .12) scribble(c, x + 22 + p * w / 2, y + 14 + row * 9, 60 + rnd(row + p * 7) * 40, '#2a3a7a', row * 11 + p * 97); c.fillStyle = '#f2e33a66'; c.fillRect(x + 150, y + 50, 70, 7); }
    { const r = T('nbGraph'), [x, y, w, h] = r; spread(r, false, 2); c.strokeStyle = '#bcd6e6'; c.lineWidth = .8; for (let gx = x; gx < x + w; gx += 8) { c.beginPath(); c.moveTo(gx + .5, y); c.lineTo(gx + .5, y + h); c.stroke(); } for (let gy = y; gy < y + h; gy += 8) { c.beginPath(); c.moveTo(x, gy + .5); c.lineTo(x + w, gy + .5); c.stroke(); }
        c.strokeStyle = '#222'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 14, y + 140); c.lineTo(x + 118, y + 140); c.moveTo(x + 24, y + 160); c.lineTo(x + 24, y + 16); c.stroke(); c.strokeStyle = '#2a3a7a'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40; c.lineTo(x + 24 + t * 92, y + 140 - Math.exp(t * 2.2) * 12); } c.stroke();
        for (let row = 0; row < 10; row++) scribble(c, x + w / 2 + 12, y + 18 + row * 14, 50 + rnd(row) * 50, '#2a3a7a', row * 31); }
    { const r = T('nbCornell'), [x, y, w, h] = r; spread(r, true, 3); c.fillStyle = '#c94a4a'; c.fillRect(x + 40, y + 10, 1.5, h - 40); c.fillRect(x + 6, y + h - 30, w / 2 - 12, 1.5); for (let row = 0; row < 11; row++) { scribble(c, x + 46, y + 16 + row * 9, 60 + rnd(row) * 20, '#2a3a7a', row * 5); if (row % 3 === 0) scribble(c, x + 8, y + 16 + row * 9, 26, '#c94a4a', row * 7); } for (let row = 0; row < 15; row++) scribble(c, x + w / 2 + 22, y + 14 + row * 9, 50 + rnd(row * 9) * 50, '#1d1d1d', row * 13); }
    { const r = T('nbDiagram'), [x, y, w, h] = r; spread(r, false, 4); c.strokeStyle = '#2a3a7a'; c.lineWidth = 1.6; const nodes = [[64, 40], [30, 110], [100, 120], [64, 80]]; for (const [nx, ny] of nodes) { c.beginPath(); c.ellipse(x + nx, y + ny, 20, 12, 0, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(x + 64, y + 52); c.lineTo(x + 64, y + 68); c.moveTo(x + 55, y + 90); c.lineTo(x + 36, y + 99); c.moveTo(x + 73, y + 90); c.lineTo(x + 94, y + 109); c.stroke();
        c.strokeStyle = '#2e7d4f'; c.beginPath(); c.arc(x + w * .75, y + h / 2, 48, 0, 7); c.stroke(); c.beginPath(); c.arc(x + w * .75, y + h / 2, 16, 0, 7); c.stroke(); for (let row = 0; row < 4; row++) scribble(c, x + w / 2 + 14, y + 140 + row * 8, 80, '#2a3a7a', row * 3); }
    // Textbook spreads.
    const bookPage = ([x, y, w, h], seed) => { c.fillStyle = '#f3efe4'; c.fillRect(x, y, w, h); c.fillStyle = '#c9c2b0'; c.fillRect(x + w / 2 - 1, y, 2, h); for (const p of [0, 1]) { c.fillStyle = '#2b2b2b'; c.fillRect(x + 12 + p * w / 2, y + 10, 50, 5); for (const col of [0, 1]) textLines(c, x + 12 + p * w / 2 + col * 54, y + 22, 46, 18, 8, '#7a756b', seed + p * 9 + col * 50, 2.2); } };
    { const r = T('bkText'), [x, y] = r; bookPage(r, 10); c.fillStyle = '#e7dfcc'; c.fillRect(x + 140, y + 60, 100, 60); c.fillStyle = '#4a7a8c'; c.fillRect(x + 150, y + 70, 30, 40); c.fillStyle = '#c48a2c'; c.fillRect(x + 186, y + 84, 22, 26); c.fillStyle = '#8b2e2e'; c.fillRect(x + 212, y + 76, 18, 34); }
    { const r = T('bkChem'), [x, y] = r; bookPage(r, 20); c.fillStyle = '#f3efe4'; c.fillRect(x + 10, y + 70, 108, 70); c.strokeStyle = '#222'; c.lineWidth = 1.3; for (const [hx, hy] of [[40, 100], [76, 100], [58, 130]]) { c.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; c.lineTo(x + hx + Math.cos(a) * 16, y + hy + Math.sin(a) * 16); } c.stroke(); } }
    { const r = T('bkMap'), [x, y] = r; bookPage(r, 30); c.fillStyle = '#9fc0d4'; c.fillRect(x + 136, y + 30, 108, 90); c.fillStyle = '#b8cfa2'; c.beginPath(); c.moveTo(x + 170, y + 30); c.bezierCurveTo(x + 150, y + 70, x + 190, y + 90, x + 165, y + 120); c.lineTo(x + 244, y + 120); c.lineTo(x + 244, y + 30); c.fill(); }
    // Spines, magazine covers, newsprint, name tag.
    { const [x, y, w, h] = T('spines'); let sx = x; let i = 0; const cols = ['#2f4f8f', '#8b2e2e', '#2e5a46', '#c48a2c', '#33363a', '#6b4f8a', '#b5674a', '#e6e1d6', '#4a6386', '#7d7e68'];
        while (sx < x + w) { const bw = 7 + rnd(i) * 12; c.fillStyle = cols[i % cols.length]; c.fillRect(sx, y + rnd(i * 3) * 18, bw, h); c.fillStyle = '#ffffff55'; c.fillRect(sx + 1, y + 30 + rnd(i * 5) * 30, bw - 2, 3); c.fillStyle = '#00000040'; c.fillRect(sx + bw - 1, y, 1, h); sx += bw; i++; } }
    { const [x, y, w, h] = T('mags'), cw = w / 3; for (let k = 0; k < 3; k++) { const cx = x + k * cw; c.fillStyle = ['#c25a3a', '#2f6f73', '#2a2d33'][k]; c.fillRect(cx + 2, y, cw - 4, h); c.fillStyle = '#ffffff'; c.fillRect(cx + 8, y + 8, cw - 16, 14); c.fillStyle = ['#e3b341', '#d9cfbc', '#8fa58c'][k]; c.fillRect(cx + 10, y + 32, cw - 20, 60); textLines(c, cx + 10, y + 100, cw - 20, 3, 7, '#ffffffaa', k * 7, 3); } }
    { const [x, y, w, h] = T('news'); c.fillStyle = '#e8e4da'; c.fillRect(x, y, w, h); c.fillStyle = '#1d1d1d'; c.fillRect(x + 8, y + 6, w - 16, 12); c.fillRect(x + 8, y + 24, w * .7, 6); c.fillStyle = '#9a958a'; c.fillRect(x + 8, y + 36, 50, 34); for (let col = 0; col < 3; col++) textLines(c, x + 8 + col * 38, y + 76 + (col === 0 ? 0 : -40), 34, col === 0 ? 6 : 11, 7, '#6a665e', col * 40, 2); }
    { const [x, y, w, h] = T('nameTag'); c.fillStyle = '#ffffff'; c.fillRect(x, y, w, h); c.fillStyle = '#c8372d'; c.fillRect(x, y, w, 40); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = 'bold 24px sans-serif'; c.fillText('HELLO', x + w / 2, y + 27); c.font = '10px sans-serif'; c.fillText('my name is', x + w / 2, y + 37); c.fillStyle = '#c8372d'; c.fillRect(x, y + h - 10, w, 10); }
    // Table tents, pizza lid, mind map, banner, bin labels, wet-floor sign.
    const tent = (r, a, b2) => { const [x, y, w, h] = r; c.fillStyle = '#f7f5ee'; c.fillRect(x, y, w, h); c.fillStyle = '#154c3d'; c.fillRect(x, y, w, 18); c.fillStyle = '#bca56d'; c.fillRect(x, y + 18, w, 3); c.fillStyle = '#154c3d'; c.textAlign = 'center'; c.font = 'bold 30px sans-serif'; c.fillText(a, x + w / 2, y + 56); c.font = '15px sans-serif'; c.fillStyle = '#3a3f46'; c.fillText(b2, x + w / 2, y + 80); };
    tent(T('tentQuiet'), 'QUIET STUDY', 'please keep voices low'); tent(T('tentGroup'), 'GROUP STUDY', 'conversation welcome');
    { const [x, y, w, h] = T('pizza'); c.fillStyle = '#cfae7d'; c.fillRect(x, y, w, h); c.strokeStyle = '#b8352f'; c.lineWidth = 3; c.beginPath(); c.arc(x + w / 2, y + h / 2, 26, 0, 7); c.stroke(); c.fillStyle = '#b8352f'; c.textAlign = 'center'; c.font = 'bold 13px sans-serif'; c.fillText('HOT', x + w / 2, y + h / 2 + 5); }
    { const [x, y, w, h] = T('mindmap'); c.fillStyle = '#fbfaf6'; c.fillRect(x, y, w, h); c.strokeStyle = '#1f4fa3'; c.lineWidth = 2; const cx = x + w / 2, cy = y + h / 2; c.beginPath(); c.ellipse(cx, cy, 30, 14, 0, 0, 7); c.stroke();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + .3, ex = cx + Math.cos(a) * 60, ey = cy + Math.sin(a) * 34; c.strokeStyle = ['#1f4fa3', '#b8322a', '#2e7d4f'][k % 3]; c.beginPath(); c.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 14); c.lineTo(ex, ey); c.stroke(); scribble(c, ex - 12, ey, 24, c.strokeStyle, k * 17, 1.6); } c.fillStyle = '#1b1d22'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('WATERSHED', cx, cy + 3); }
    { const [x, y, w, h] = T('banner'); c.fillStyle = '#154c3d'; c.fillRect(x, y, w, h); c.fillStyle = '#bca56d'; c.fillRect(x, y + 4, w, 2); c.fillRect(x, y + h - 6, w, 2); c.fillStyle = '#f4ecd8'; c.textAlign = 'center'; fitText(c, 'COMMONS PROJECT NIGHT · ALL WELCOME', x + w / 2, y + 43, w - 30, 30, 'bold'); }
    { const [x, y, w, h] = T('bins'), cw = w / 3; [['#4a4d50', 'LANDFILL'], ['#2a5ea8', 'RECYCLE'], ['#3f7d3a', 'COMPOST']].forEach(([col, label], k) => { c.fillStyle = col; c.fillRect(x + k * cw, y, cw, h); c.fillStyle = '#ffffff'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(label, x + k * cw + cw / 2, y + 40); c.fillRect(x + k * cw + 20, y + 50, cw - 40, 2); }); }
    { const [x, y, w, h] = T('wet'); c.fillStyle = '#f2c230'; c.fillRect(x, y, w, h); c.fillStyle = '#1d1d1d'; c.beginPath(); c.moveTo(x + 22, y + 8); c.lineTo(x + 38, y + 36); c.lineTo(x + 6, y + 36); c.fill(); c.fillStyle = '#f2c230'; c.fillRect(x + 21, y + 16, 2.5, 11); c.fillRect(x + 21, y + 30, 2.5, 3); c.fillStyle = '#1d1d1d'; c.textAlign = 'left'; c.font = 'bold 14px sans-serif'; c.fillText('CAUTION', x + 44, y + 24); c.font = 'bold 11px sans-serif'; c.fillText('WET FLOOR', x + 44, y + 40); }
    { const [x, y, w, h] = T('poster'); c.fillStyle = '#fbfaf6'; c.fillRect(x, y, w, h); c.fillStyle = '#154c3d'; c.fillRect(x, y, w, 92); c.fillStyle = '#bca56d'; c.fillRect(x, y + 92, w, 4); c.fillStyle = '#f4ecd8'; c.textAlign = 'center'; c.font = 'bold 30px sans-serif'; c.fillText('COMMONS', x + w / 2, y + 40); c.fillText('PROJECT NIGHT', x + w / 2, y + 76);
        c.fillStyle = '#1d1d1d'; c.textAlign = 'left'; c.font = 'bold 19px sans-serif'; [['5:00', 'Share field notes'], ['5:30', 'Maps & methods'], ['6:00', 'Review together']].forEach(([t, l], i) => { c.fillStyle = '#154c3d'; c.fillText(t, x + 16, y + 138 + i * 56); c.fillStyle = '#1d1d1d'; c.font = '17px sans-serif'; c.fillText(l, x + 16, y + 160 + i * 56); c.font = 'bold 19px sans-serif'; });
        c.fillStyle = '#bca56d'; c.fillRect(x + 16, y + h - 42, w - 32, 2); c.fillStyle = '#154c3d'; c.textAlign = 'center'; c.font = 'bold 18px sans-serif'; c.fillText('All welcome', x + w / 2, y + h - 16); }
    // Palette strip.
    SWATCHES.forEach(([name, col], i) => {
        const x = (i % 32) * 32, y = 960 + Math.floor(i / 32) * 32; c.fillStyle = col; c.fillRect(x, y, 32, 32);
        if (textile(name)) for (let n = 2; n < 31; n += 4) { c.fillStyle = '#ffffff12'; c.fillRect(x + n, y + 2, 1, 28); c.fillStyle = '#00000014'; c.fillRect(x + 2, y + n, 28, 1); }
    });
    c.textAlign = 'left';
}
// Roughness (G) / metalness (B) at the same layout, quarter resolution.
function drawORM(c, S) {
    const k = S / AT; c.fillStyle = 'rgb(0,232,0)'; c.fillRect(0, 0, S, S);
    c.fillStyle = 'rgb(0,60,0)'; c.fillRect(0, 0, S, 320 * k); // glass screens
    SWATCHES.forEach(([, , r, m], i) => { c.fillStyle = `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`; c.fillRect((i % 32) * 32 * k, (960 + Math.floor(i / 32) * 32) * k, 32 * k, 32 * k); });
}

// ---------- Whiteboard writing and the tackboard flyers ----------
const BOARD_TEXT = {
    A: {
        morning: [['Reserved: Calc study group 3–5 PM', '#1f4fa3'], ['Good morning!', '#2e7d4f']],
        afternoon: [['∫₀^∞ e^(−x²) dx = √π / 2', '#1b1d22'], ['dy/dt = k·y  →  y = y₀·e^(kt)', '#1f4fa3'], ['MIDTERM THU — Ch. 4–6!!', '#b8322a']],
        evening: [['dy/dt = k·y  →  y = …', '#1b1d22'], ['PLEASE DO NOT ERASE', '#b8322a'], ['— study group, back tomorrow', '#1f4fa3']],
        night: [['Have a good night!  — Commons staff', '#2e7d4f']],
        party: [['COMMONS PROJECT NIGHT', '#154c3d'], ['Bring your ideas to the table', '#154c3d'], ['5:00 Share field notes', '#1b1d22'], ['5:30 Maps, methods & evidence', '#1b1d22'], ['6:00 Review together', '#b8322a']]
    },
    B: {
        morning: [['Bio 101 review → Thursday', '#1b1d22'], ['Bring flashcards!', '#2e7d4f']],
        afternoon: [['GROUP PROJECT: Watershed field study', '#1b1d22']],
        evening: [['Thesis: coastal fog & forest growth', '#1b1d22']],
        night: [],
        party: [['Watershed mapping workshop', '#1f4fa3'], ['Everyone brings a perspective', '#b8322a']]
    }
};
function drawBoard(c, W, H, which, phase) {
    c.fillStyle = '#f6f7f5'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ffffff00'); g.addColorStop(.5, '#ffffff55'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // Ghosting from earlier sessions.
    c.strokeStyle = 'rgba(120,130,140,.09)'; c.lineWidth = 18; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(W * (.2 + rnd(k + (which === 'A' ? 3 : 9)) * .6), H * (.25 + rnd(k * 5) * .5), W * .16, H * .07, rnd(k) * 3, 0, 5); c.stroke(); }
    const S = W / 1024, lines = BOARD_TEXT[which][phase] || [];
    const write = (text, x, y, size, color, seed) => { c.save(); c.translate(x, y); c.rotate((rnd(seed) - .5) * .05); c.fillStyle = color; let f = size * S; do { c.font = `600 ${f}px ${HAND}`; f -= 2 * S; } while (c.measureText(text).width > W - x - 50 * S && f > 14 * S); c.fillText(text, 0, 0); c.restore(); };
    c.textAlign = 'left';
    lines.forEach(([t, col], i) => write(t, 60 * S, (110 + i * 120) * S, phase === 'party' && which === 'A' && i < 2 ? 70 : 54, col, i * 7 + phase.length));
    const pen = (col, w = 5) => { c.strokeStyle = col; c.lineWidth = w * S; c.lineCap = 'round'; };
    if (which === 'A' && phase === 'afternoon') {
        // Free-body diagram: a block on an incline.
        const ox = 620 * S, oy = H - 140 * S; pen('#1b1d22'); c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + 330 * S, oy); c.lineTo(ox, oy - 190 * S); c.closePath(); c.stroke();
        c.save(); c.translate(ox + 120 * S, oy - 118 * S); c.rotate(Math.atan2(190, 330)); c.strokeRect(-40 * S, -60 * S, 80 * S, 60 * S); c.restore();
        const arrow = (x1, y1, x2, y2, col, label) => { pen(col); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); const a = Math.atan2(y2 - y1, x2 - x1); c.lineTo(x2 - Math.cos(a - .4) * 18 * S, y2 - Math.sin(a - .4) * 18 * S); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a + .4) * 18 * S, y2 - Math.sin(a + .4) * 18 * S); c.stroke(); write(label, x2 + 8 * S, y2, 40, col, x1); };
        const bx = ox + 130 * S, by = oy - 150 * S; arrow(bx, by, bx, by + 150 * S, '#b8322a', 'mg'); arrow(bx, by, bx + 80 * S, by - 130 * S, '#1f4fa3', 'N'); arrow(bx, by, bx - 140 * S, by + 80 * S, '#2e7d4f', 'f');
        pen('#b8322a', 4); c.strokeRect(45 * S, 296 * S, 640 * S, 76 * S);
    }
    if (which === 'A' && phase === 'evening') { c.fillStyle = 'rgba(160,170,180,.25)'; c.fillRect(40 * S, 60 * S, 760 * S, 70 * S); pen('#b8322a', 4); c.strokeRect(45 * S, 176 * S, 640 * S, 76 * S); }
    if (which === 'B' && phase === 'afternoon') {
        pen('#1b1d22', 4); const top = 170 * S; ['TO DO', 'DOING', 'DONE'].forEach((h, k) => { const x = (60 + k * 310) * S; write(h, x + 20 * S, top + 50 * S, 44, '#1f4fa3', k); c.beginPath(); c.moveTo(x, top); c.lineTo(x, H - 60 * S); c.stroke(); });
        const notes = [['#f4e06d', 0, 0], ['#f29bb0', 0, 1], ['#f4e06d', 0, 2], ['#8ecae6', 1, 0], ['#f4e06d', 1, 1], ['#a7d98a', 2, 0], ['#a7d98a', 2, 1], ['#f29bb0', 2, 2]];
        for (const [col, k, r] of notes) { const x = (90 + k * 310 + rnd(k * 5 + r) * 60) * S, y = top + (90 + r * 150) * S; c.save(); c.translate(x, y); c.rotate((rnd(k + r * 3) - .5) * .2); c.fillStyle = '#00000018'; c.fillRect(4 * S, 4 * S, 120 * S, 120 * S); c.fillStyle = col; c.fillRect(0, 0, 120 * S, 120 * S); for (let l = 0; l < 3; l++) scribble(c, 12 * S, (30 + l * 28) * S, 90 * S, '#1b1d22', k * 9 + r * 3 + l, 3 * S); c.restore(); }
        write('Meet Fri 2 PM · draft due Mon', 60 * S, H - 25 * S, 40, '#b8322a', 4); write('12 sources ✓', 700 * S, H - 90 * S, 36, '#2e7d4f', 5);
    }
    if (which === 'B' && phase === 'evening') {
        const cx = W / 2, cy = H / 2 + 40 * S; pen('#1f4fa3', 5); c.beginPath(); c.ellipse(cx, cy, 170 * S, 70 * S, 0, 0, 7); c.stroke(); write('fog + forests', cx - 120 * S, cy + 14 * S, 42, '#1f4fa3', 1);
        [['data', -.6, '#2e7d4f'], ['methods', .6, '#b8322a'], ['maps', 2.5, '#1b1d22'], ['ask librarian?', 3.7, '#2e7d4f']].forEach(([t, a, col], k) => { const ex = cx + Math.cos(a) * 340 * S, ey = cy + Math.sin(a) * 210 * S; pen(col, 4); c.beginPath(); c.moveTo(cx + Math.cos(a) * 170 * S, cy + Math.sin(a) * 70 * S); c.lineTo(ex, ey); c.stroke(); write(t, ex - 60 * S, ey + (Math.sin(a) > 0 ? 40 : -12) * S, 40, col, k + 20); });
    }
    if (which === 'B' && phase === 'party') {
        const words = ['field notes', 'fog patterns', 'soil samples', 'methods', 'rainfall', 'canopy', 'watershed', 'mapping', 'evidence', 'citations', 'review', 'next steps'];
        words.forEach((t, k) => { const x = (70 + (k % 4) * 230 + rnd(k) * 40) * S, y = (260 + Math.floor(k / 4) * 190 + rnd(k * 3) * 30) * S; c.save(); c.translate(x, y); c.rotate((rnd(k * 7) - .5) * .25); c.fillStyle = ['#f4e06d', '#f29bb0', '#8ecae6', '#a7d98a'][k % 4]; c.fillRect(0, 0, 170 * S, 140 * S); c.fillStyle = '#1b1d22'; c.font = `600 ${30 * S}px ${HAND}`; c.fillText(t, 10 * S, 70 * S); c.restore(); });
    }
    if (which === 'A' && phase === 'party') { pen('#bca56d', 6); c.beginPath(); c.moveTo(60 * S, 260 * S); c.lineTo(W - 60 * S, 260 * S); c.stroke(); }
}
const FLYERS = [
    { head: 'CHESS CLUB', lines: ['Thursdays 6 PM', 'all levels welcome'], bg: '#ffffff', ink: '#1d1d1d', size: 'letter', icon: 'board' },
    { head: 'PEER TUTORING', lines: ['Math & Stats', 'Mon–Thu 3–7 PM', 'free drop-in'], bg: '#86c5da', ink: '#14324a', size: 'letter', icon: 'sum' },
    { head: 'WRITING CENTER', lines: ['Feedback on any draft', 'book a 30-min session'], bg: '#f4f1e8', ink: '#154c3d', size: 'letter', icon: 'lines' },
    { head: 'LOST:', lines: ['blue water bottle', 'with stickers', 'ask at front desk'], bg: '#ffffff', ink: '#1d1d1d', size: 'half', icon: 'bottle' },
    { head: 'ROOM FOR RENT', lines: ['2 bd near campus', 'quiet, bikes OK'], bg: '#ffffff', ink: '#1d1d1d', size: 'letter', icon: 'tabs' },
    { head: 'FALL FILM NIGHT', lines: ['Friday 7 PM', 'free popcorn'], bg: '#2a2d33', ink: '#f2c14e', size: 'tabloid', icon: 'film' },
    { head: 'RIDESHARE BOARD', lines: ['weekend trips south', 'leave a note'], bg: '#c7e07a', ink: '#24391a', size: 'half', icon: 'arrow' },
    { head: 'BEACH CLEANUP', lines: ['Saturday 9 AM', 'gloves provided'], bg: '#f4a38c', ink: '#3a1a12', size: 'letter', icon: 'wave' },
    { head: 'FINALS WEEK', lines: ['extended hours', 'free coffee 8–10 PM'], bg: '#f2c14e', ink: '#2a1d05', size: 'letter', icon: 'cup' },
    { head: 'BIKE CO-OP', lines: ['free tune-ups', 'Wednesdays'], bg: '#ffffff', ink: '#2f5fb3', size: 'half', icon: 'wheel' },
    { head: 'OPEN MIC', lines: ['poetry & music', 'Sunday 4 PM'], bg: '#c8b6e2', ink: '#2c1f45', size: 'tabloid', icon: 'star' },
    { head: 'ZINE NIGHT', lines: ['collage & printing', 'supplies provided'], bg: '#ffffff', ink: '#c8372d', size: 'letter', icon: 'cut' },
    { head: 'STUDY ABROAD INFO', lines: ['Tuesday noon', 'commons lounge'], bg: '#86c5da', ink: '#14324a', size: 'letter', icon: 'globe' },
    { head: 'OPEN HOUSE TODAY', lines: ['tours · demo · snacks', '5–7 PM'], bg: '#f2c14e', ink: '#154c3d', size: 'tabloid', icon: 'star', party: true }
];
const FLYER_MM = { letter: [216, 279], tabloid: [279, 432], half: [140, 216] };
const flyerCell = i => [(i % 4) * 256, Math.floor(i / 4) * 256];
const flyerRect = (i, size) => { const [mw, mh] = FLYER_MM[size], w = Math.round(256 * mw / mh), [cx, cy] = flyerCell(i); return [cx + (256 - w) / 2, cy, w, 256]; };
function drawFlyers(c) {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1024, 1024);
    FLYERS.forEach((f, i) => {
        const [x, y, w, h] = flyerRect(i, f.size); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
        c.fillStyle = f.bg; c.fillRect(x, y, w, h); c.fillStyle = f.ink; c.textAlign = 'center';
        const words = f.head.split(' '), fs = Math.min(34, w / Math.max(...words.map(s => s.length)) * 1.55);
        c.font = `bold ${fs}px sans-serif`; words.forEach((wd, k) => c.fillText(wd, x + w / 2, y + 40 + k * (fs + 4)));
        const iy = y + 50 + words.length * (fs + 4); c.strokeStyle = f.ink; c.lineWidth = 3;
        const ic = { board: () => { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2) c.fillRect(x + w / 2 - 32 + a * 16, iy + b * 12, 16, 12); },
            sum: () => { c.font = 'bold 40px serif'; c.fillText('Σ ∫', x + w / 2, iy + 40); }, lines: () => { for (let k = 0; k < 4; k++) c.fillRect(x + 24, iy + k * 10, w - 48 - k * 12, 3); },
            bottle: () => c.fillRect(x + w / 2 - 10, iy, 20, 46), tabs: () => {}, film: () => { c.strokeRect(x + w / 2 - 40, iy, 80, 46); for (let k = 0; k < 5; k++) c.fillRect(x + w / 2 - 36 + k * 16, iy + 4, 8, 6); },
            arrow: () => { c.beginPath(); c.moveTo(x + 20, iy + 20); c.lineTo(x + w - 30, iy + 20); c.lineTo(x + w - 44, iy + 8); c.moveTo(x + w - 30, iy + 20); c.lineTo(x + w - 44, iy + 32); c.stroke(); },
            wave: () => { c.beginPath(); for (let k = 0; k <= 40; k++) c.lineTo(x + 20 + k * (w - 40) / 40, iy + 20 + Math.sin(k / 3) * 10); c.stroke(); }, cup: () => { c.strokeRect(x + w / 2 - 18, iy, 36, 40); c.beginPath(); c.arc(x + w / 2 + 24, iy + 18, 9, -1.4, 1.4); c.stroke(); },
            wheel: () => { for (const s of [-1, 1]) { c.beginPath(); c.arc(x + w / 2 + s * 28, iy + 22, 20, 0, 7); c.stroke(); } }, star: () => { c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 11 : 26, a = k * Math.PI / 5 - Math.PI / 2; c.lineTo(x + w / 2 + Math.cos(a) * r, iy + 24 + Math.sin(a) * r); } c.fill(); },
            cut: () => { c.beginPath(); c.arc(x + w / 2 - 14, iy + 34, 9, 0, 7); c.arc(x + w / 2 + 14, iy + 34, 9, 0, 7); c.moveTo(x + w / 2 - 8, iy + 28); c.lineTo(x + w / 2 + 20, iy); c.moveTo(x + w / 2 + 8, iy + 28); c.lineTo(x + w / 2 - 20, iy); c.stroke(); },
            globe: () => { c.beginPath(); c.arc(x + w / 2, iy + 24, 24, 0, 7); c.moveTo(x + w / 2 - 24, iy + 24); c.lineTo(x + w / 2 + 24, iy + 24); c.ellipse(x + w / 2, iy + 24, 10, 24, 0, 0, 7); c.stroke(); } };
        ic[f.icon]?.(); c.font = `${Math.min(18, w / 10)}px sans-serif`; f.lines.forEach((l, k) => c.fillText(l, x + w / 2, iy + 76 + k * 22));
        if (f.icon === 'tabs') { c.strokeStyle = f.ink; c.lineWidth = 1; const n = 8, tw = w / n; for (let k = 0; k < n; k++) { if (k === 2 || k === 5) { c.clearRect(x + k * tw, y + h - 60, tw, 60); c.fillStyle = '#ffffff'; c.fillRect(x + k * tw, y + h - 60, tw, 60); continue; } c.beginPath(); c.moveTo(x + k * tw + .5, y + h - 60); c.lineTo(x + k * tw + .5, y + h); c.stroke(); c.save(); c.translate(x + k * tw + tw / 2 + 3, y + h - 4); c.rotate(-Math.PI / 2); c.fillStyle = f.ink; c.font = '8px sans-serif'; c.textAlign = 'left'; c.fillText('555-0142', 0, 0); c.restore(); } c.beginPath(); c.setLineDash([3, 3]); c.moveTo(x, y + h - 60.5); c.lineTo(x + w, y + h - 60.5); c.stroke(); c.setLineDash([]); }
        c.restore();
    });
    // Pin colours in the last cell.
    ['#c8372d', '#2f5fb3', '#e3b341'].forEach((col, k) => { c.fillStyle = col; c.fillRect(768 + k * 85, 768 + 160, 85, 96); });
}
const PIN_UV = k => [(768 + k * 85 + 42) / 1024, 1 - (768 + 208) / 1024];

// ---------- Plans ----------
// Per table id: who sits where per daypart. L laptop, R reader, S book stack,
// A stepped away (bag + coat on the chair), G group member. Extras sit at
// table level. Unknown tables fall back to a generic plan by size.
const PLANS = {
    'humboldt-table-b1': { tent: 'tentGroup', morning: ['L'], afternoon: ['L', 'R', 'A', 'L'], evening: ['R', 'L'], extras: { party: ['flyers'] } },
    'humboldt-table-b2': { afternoon: ['L', 'L'], extras: { night: ['bottle'], party: ['coats'] } },
    'humboldt-table-b3': { morning: ['L'], afternoon: ['S', 'R', 'A'], evening: ['A'], extras: { party: ['cups'] } },
    'humboldt-table-g1': { tent: 'tentQuiet', morning: ['R'], afternoon: ['L', 'R', 'L', 'A', 'R', 'L'], evening: ['R', 'L'], extras: { afternoon: ['umbrella'], evening: ['umbrella'], party: ['coats'] } },
    'humboldt-table-g2': { afternoon: ['L', 'S', 'R'], evening: ['L'], extras: { night: ['bottle'], party: ['cups'] } },
    'humboldt-table-s1': { fixedOrder: true, afternoon: ['L', 'L', 'G', 'G'], evening: ['A'], extras: { afternoon: ['group'], party: ['pizza'] } },
    'humboldt-table-l1': { fixedOrder: true, tent: 'tentGroup', morning: ['A'], afternoon: ['L', 'G', 'R', 'G'], evening: ['R'], party: ['G', 'L', 'G', 'R'], extras: { afternoon: ['group'], party: ['fieldkit'] } }
};
const genericPlan = t => ({ afternoon: ['L', 'R'], evening: t.size[0] * t.size[1] > 2e6 ? ['R'] : [] });
const CAFE_PLANS = [
    { morning: 'news', afternoon: 'laptop', party: 'cups' }, { afternoon: 'read', evening: 'mugbook' }, { morning: 'cupphone', afternoon: 'tote', party: 'cups' },
    { afternoon: 'laptop', evening: 'mugbook' }, { afternoon: 'read', party: 'cups' }, { morning: 'cupphone' }, { afternoon: 'cupphone', evening: 'laptop' }, {}
];
const SCREEN_GLOW = { morning: .55, afternoon: .6, evening: .95, night: 0, party: .7 };

export function buildHumboldtLife(ctx) {
    const { room, root, layout, helpers, group, own, canvasMap, PHASE } = ctx;
    const XL = layout.left ?? -layout.width / 2, XR = XL + layout.width;

    // ---------- Shared atlas material ----------
    const map = canvasMap(drawAtlas, AT, AT); map.anisotropy = 4;
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 512;
    { const g = glowCanvas.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.drawImage(map.image, 0, 0, AT, 320, 0, 0, 512, 160); }
    const glow = new THREE.CanvasTexture(glowCanvas); glow.colorSpace = THREE.SRGBColorSpace;
    const ormCanvas = document.createElement('canvas'); ormCanvas.width = ormCanvas.height = 256; drawORM(ormCanvas.getContext('2d'), 256);
    const orm = new THREE.CanvasTexture(ormCanvas);
    const lifeMat = own(new THREE.MeshStandardMaterial({ name: 'Humboldt student life atlas', color: '#ffffff', map, emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: .6, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 }));
    lifeMat.userData.roomPaletteLocked = true; lifeMat.userData.roomFinishLocked = true;
    const textures = [map, glow, orm];
    const bake = (parent, b, name, cast = true) => {
        const geo = b.build(); if (!geo) return null;
        const m = new THREE.Mesh(geo, lifeMat); m.name = name; m.castShadow = cast; m.receiveShadow = cast; parent.add(m); return m;
    };
    const phaseGroups = (parent, label) => PHASE.map(phase => { const g = new THREE.Group(); g.name = `${label} · ${phase}`; parent.add(g); return g; });

    // ---------- Seats: chairs from layout.props bound to their table ----------
    const chairs = layout.props.filter(p => p.id === CHAIR);
    const rectDist = (t, x, z) => Math.hypot(Math.max(Math.abs(x - t.at[0]) - t.size[0] / 2, 0), Math.max(Math.abs(z - t.at[1]) - t.size[1] / 2, 0));
    const seatsOf = new Map(layout.tables.map(t => [t.id, []])), cafeSeats = layout.cafe.map(() => []);
    for (const c of chairs) {
        const [x, , z] = c.at; let best = null, bd = 1100;
        for (const t of layout.tables) { const d = rectDist(t, x, z); if (d < bd) { bd = d; best = t; } }
        if (best) { seatsOf.get(best.id).push(c); continue; }
        let ci = -1, cd = 1300; layout.cafe.forEach(([cx, cz], i) => { const d = Math.hypot(x - cx, z - cz); if (d < cd) { cd = d; ci = i; } });
        if (ci >= 0) cafeSeats[ci].push(c);
    }
    // seatInfo: chair key -> { normal, states[5], dress[5] } for room-life and decorateProp.
    const seatInfo = new Map(), key = (x, z) => `${Math.round(x)}|${Math.round(z)}`;
    const states = (x, z) => PHASE.map((phase, p) => phase === 'night' ? 'tucked' : phase === 'morning' ? (rnd(x * .013 + z * .007) < .25 ? 'free' : 'tucked') : phase === 'evening' ? 'loose' : 'free');
    const eventSpot = [];

    // Table-local seat frames: origin on the table edge in front of the chair, +z toward the chair.
    const seatFrames = t => {
        const [sx, sz] = t.size, list = seatsOf.get(t.id).map(c => {
            const lx = c.at[0] - t.at[0], lz = c.at[2] - t.at[1], ox = Math.abs(lx) - sx / 2, oz = Math.abs(lz) - sz / 2;
            const xSide = ox > oz, n = xSide ? [Math.sign(lx), 0] : [0, Math.sign(lz)];
            const edge = xSide ? [n[0] * sx / 2, THREE.MathUtils.clamp(lz, -sz / 2 + 260, sz / 2 - 260)] : [THREE.MathUtils.clamp(lx, -sx / 2 + 260, sx / 2 - 260), n[1] * sz / 2];
            return { chair: c, n, edge, along: xSide ? edge[1] : edge[0], side: xSide ? `x${n[0]}` : `z${n[1]}` };
        });
        // Tables without chairs (the standing project table) get virtual places.
        if (!list.length) {
            const longX = sx >= sz, L = longX ? sx : sz, D = longX ? sz : sx;
            for (const u of [L / 4, -L / 4]) for (const s of [1, -1]) list.push({ chair: null, n: longX ? [0, s] : [s, 0], edge: longX ? [u, s * D / 2] : [s * D / 2, u], along: u, side: longX ? `z${s}` : `x${s}` });
        }
        for (const s of list) {
            const same = list.filter(o => o !== s && o.side === s.side), lo = same.some(o => o.along < s.along), hi = same.some(o => o.along > s.along);
            s.end = !lo ? -1 : !hi ? 1 : 0; s.yaw = Math.atan2(s.n[0], s.n[1]);
            s.tangent = [s.n[1], -s.n[0]]; // seat frame +x in table coordinates
        }
        return list;
    };

    // ---------- Settings (in a seat frame) ----------
    const setting = (b, M, kind, seed, ctxT) => {
        const j = k => (rnd(seed * 3.7 + k) - .5);
        if (kind === 'L') {
            items.laptop(b, F(M, j(1) * 40, 0, -200, j(2) * .25), { body: pick(LAPTOPS, seed), screen: pick(SCREENS, seed + 1) });
            items.phone(b, F(M, 230, 0, -110 + j(3) * 40, .2 + j(4) * .4), rnd(seed + 5) < .5 ? 'phone' : pick(['caseSage', 'caseCoral'], seed));
            if (rnd(seed + 8) < .5) items.notebook(b, F(M, -310, 0, -150, .25 + j(9) * .2), { page: pick(NOTEBOOKS, seed), cover: pick(COVERS, seed + 2) });
            if (rnd(seed + 6) < .55) items.cup(b, F(M, -300, 0, -355), rnd(seed + 7) < .6 ? 'kraft' : pick(['cupTeal', 'cupTerra'], seed)); else items.bottle(b, F(M, -300, 0, -365), pick(BOTTLES, seed));
            if (rnd(seed + 12) < .3) items.headphones(b, F(M, 230, 0, -330, 1.2)); else if (rnd(seed + 10) < .7) items.sticky(b, F(M, 200, 0, -280, j(11)), pick(STICKY, seed));
            ctxT.cables.push(M);
        } else if (kind === 'R') {
            items.openBook(b, F(M, -90, 0, -195, .06 + j(1) * .1), { cover: pick(COVERS, seed), page: pick(BOOKS, seed) });
            items.notebook(b, F(M, 270, 0, -165, -.18 + j(2) * .1), { page: pick(NOTEBOOKS, seed + 1), cover: pick(COVERS, seed + 4) });
            items.highlighter(b, F(M, 110, 0, -40, 1.2), pick(HIGHLIGHT, seed)); items.highlighter(b, F(M, 150, 0, -30, 1.45), pick(HIGHLIGHT, seed + 1));
            items.bottle(b, F(M, -340, 0, -380), pick(BOTTLES, seed + 3));
        } else if (kind === 'A') {
            items.laptop(b, F(M, 0, 0, -210, j(1) * .3), { closed: true, body: pick(LAPTOPS, seed) });
            items.phone(b, F(M, 30, 17, -200, .3), 'phone');
            items.cup(b, F(M, 240, 0, -260), rnd(seed) < .5 ? 'kraft' : 'cupTeal');
        } else if (kind === 'S') {
            let y = 0; for (let k = 0; k < 3; k++) { const h = 30 + rnd(seed + k) * 16; items.closedBook(b, F(M, -170, y, -220, j(k + 1) * .25), pick(COVERS, seed + k), [200 - k * 8, h, 255 - k * 6]); y += h; }
            items.composition(b, F(M, 130, 0, -170, .2)); items.pen(b, F(M, 200, 10, -70, 1.1));
            items.sticky(b, F(M, -10, 0, -340, .2), pick(STICKY, seed)); items.sticky(b, F(M, 70, 0, -360, -.3), pick(STICKY, seed + 1));
        } else if (kind === 'G') {
            items.notebook(b, F(M, 0, 0, -165, j(1) * .2), { page: pick(NOTEBOOKS, seed), cover: pick(COVERS, seed) });
            items.highlighter(b, F(M, 190, 0, -60, 1.3), pick(HIGHLIGHT, seed)); items.bottle(b, F(M, -230, 0, -120), pick(BOTTLES, seed));
        }
    };

    // ---------- Study tables ----------
    const studyKits = [], seatLog = [];
    const anchor = layout.tables[0] ? [layout.tables[0].at[0] + 150, layout.tables[0].at[1] - 240] : null; // room-life daily activity
    for (const [i, t] of layout.tables.entries()) {
        const table = root.children.find(o => o.userData.humboldtTable === t.id);
        const g = group(`humboldt-study-kit-${i}`, 'Commons study materials', [0, 750, 0], table || root);
        if (!table) g.position.set(t.at[0], 750, t.at[1]);
        const plan = PLANS[t.id] || genericPlan(t), [sx, sz] = t.size, longX = sx >= sz, L = longX ? sx : sz;
        let seats = seatFrames(t);
        if (i === 0 && anchor) seats = seats.filter(s => Math.hypot(t.at[0] + s.edge[0] - anchor[0], t.at[1] + s.edge[1] - anchor[1]) > 520);
        const order = plan.fixedOrder ? [...seats].sort((a, b) => a.side.localeCompare(b.side) || b.along - a.along) : [...seats].sort((a, b) => rnd(hash(t.id) + seats.indexOf(a) * 1.7) - rnd(hash(t.id) + seats.indexOf(b) * 1.7));
        // Power modules along the centre line (not on the small square table).
        const modules = L >= 1500 ? (L >= 2400 ? [-L / 4, L / 4] : [0]).map(u => longX ? [u, 0] : [0, u]) : [];
        // Per-seat states for chair messiness and chair dressings.
        for (const s of seats) if (s.chair) seatInfo.set(key(s.chair.at[0], s.chair.at[2]), { x: s.chair.at[0], z: s.chair.at[2], n: s.n, states: states(s.chair.at[0], s.chair.at[2]), dress: PHASE.map(() => null) });
        const phases = PHASE.map((phase, p) => {
            const item = new THREE.Group(); item.name = `Commons table activity · ${phase}`; g.add(item);
            const b = baker(), I = new THREE.Matrix4(), ctxT = { cables: [] };
            for (const [mx, mz] of modules) items.module(b, F(I, mx, 0, mz, longX ? 0 : Math.PI / 2));
            if (plan.tent) items.tent(b, F(I, modules.length === 1 ? (longX ? 260 : 0) : 0, 0, modules.length === 1 ? (longX ? 0 : 260) : 0, longX ? 0 : Math.PI / 2), plan.tent);
            const list = plan[phase] || [], offset = phase === 'evening' ? 2 : 0;
            list.forEach((kind, k) => {
                const s = order[(k + offset) % order.length]; if (!s || k >= order.length) return;
                const M = F(I, s.edge[0], 0, s.edge[1], s.yaw), seed = hash(t.id) + k * 13 + p * 101;
                setting(b, M, kind, seed, ctxT);
                if (!s.chair) return;
                const info = seatInfo.get(key(s.chair.at[0], s.chair.at[2]));
                info.states[p] = kind === 'A' ? 'away' : 'used';
                if (kind === 'A') info.dress[p] = { pack: pick(PACKS, seed), jacket: pick(JACKETS, seed + 1) };
                else if (rnd(seed + 40) < .35) info.dress[p] = { jacket: pick(JACKETS, seed + 2) };
                // A bag on the floor at the outer end of an end seat.
                if (s.end && t.id !== 'humboldt-table-l1' && rnd(seed + 41) < .75) {
                    const dir = s.end, av = s.side[0] === 'x' ? [0, 1] : [1, 0], fx = s.edge[0] + av[0] * dir * 430 + s.n[0] * 190, fz = s.edge[1] + av[1] * dir * 430 + s.n[1] * 190;
                    items.backpack(b, F(I, fx, -750 + 153 * Math.sin(.12), fz, s.yaw + Math.PI / 2 + (rnd(seed + 42) - .5) * .5, 0, -.12), pick(PACKS, seed + 3));
                }
            });
            // Cables from each open laptop to the nearest power module.
            for (const M of ctxT.cables) {
                if (!modules.length) break;
                const a = new THREE.Vector3(-150, 2, -300).applyMatrix4(M), m = modules.reduce((x, y) => Math.hypot(y[0] - a.x, y[1] - a.z) < Math.hypot(x[0] - a.x, x[1] - a.z) ? y : x);
                const end = longX ? [m[0] + THREE.MathUtils.clamp(a.x - m[0], -90, 90), 2, m[1] + Math.sign(a.z - m[1] || 1) * 42] : [m[0] + Math.sign(a.x - m[0] || 1) * 42, 2, m[1] + THREE.MathUtils.clamp(a.z - m[1], -90, 90)];
                const mid = [(a.x + end[0]) / 2 + 40, 2, (a.z + end[2]) / 2 - 30];
                b.seg(I, [a.x, 2, a.z], mid, 4, sw('lidWhite')).seg(I, mid, end, 4, sw('lidWhite'));
                b.box(I, [56, 28, 56], longX ? [end[0], 46, m[1]] : [m[0], 46, end[2]], ZERO, sw('lidWhite'));
            }
            const seed = hash(t.id) + p * 7;
            for (const extra of plan.extras?.[phase] || []) {
                const endU = L / 2 - 280, at = u => longX ? [u, 0] : [0, u];
                if (extra === 'group') {
                    const P = F(I, 0, 0, 0, longX ? 0 : Math.PI / 2); items.poster(b, P, [500, 360]);
                    for (let k = 0; k < 6; k++) items.sticky(b, F(P, -170 + (k % 3) * 150 + rnd(seed + k) * 30, 1, -90 + Math.floor(k / 3) * 160, rnd(seed + k * 3) - .5), pick(STICKY, seed + k));
                    items.highlighter(b, F(P, 60, 1, 30, .4), 'hiPink'); items.highlighter(b, F(P, -80, 1, 60, 2.2), 'hiGreen'); items.calculator(b, F(P, 200, 1, 90, .3));
                } else if (extra === 'fieldkit') {
                    const P = F(I, 0, 0, 0);
                    b.box(P, [660, 2, 430], [0, 1, 0], ZERO, sw('paper'))
                        .plane(P, [660, 430], [0, 2.2, 0], FLAT, tileUV('bkMap'));
                    for (const x of [-110, 110]) b.box(P, [1, .8, 430], [x, 2.8, 0], ZERO, sw('cotton'));
                    // A specimen/sample tray is kept on the centre line, not the aisle.
                    const Q = F(I, -830, 0, 0, .04);
                    b.box(Q, [250, 14, 210], [0, 7, 0], ZERO, sw('oak'));
                    for (const x of [-118, 118]) b.box(Q, [14, 32, 210], [x, 28, 0], ZERO, sw('oak'));
                    for (const z of [-98, 98]) b.box(Q, [250, 32, 14], [0, 28, z], ZERO, sw('oak'));
                    for (let k = 0; k < 3; k++) b.ball(Q, 23 + k * 3, [-65 + k * 65, 38, 0], sw(['charcoal', 'oak', 'cream'][k]));
                    b.box(I, [300, 3, 32], [690, 1.5, 65], [0, .14, 0], sw('steel'));
                    for (let k = 0; k < 3; k++) items.sticky(b, F(I, 600 + k * 88, 0, -80, .04 * k), pick(STICKY, seed + k));
                    items.highlighter(b, F(I, 660, 0, 150, .18), 'hiGreen');
                } else if (extra === 'project') {
                    const [u, v] = at(-L / 2 + 380), P = F(I, u, 0, v, longX ? 0 : Math.PI / 2); items.poster(b, P);
                    for (let k = 0; k < 5; k++) items.sticky(b, F(P, -200 + k * 95, 1, -120 + rnd(seed + k) * 220, rnd(seed + k * 3) - .5), pick(STICKY, seed + k));
                    items.highlighter(b, F(P, 330, 0, 120, .4), 'hiYellow'); items.snack(b, F(P, 420, 0, -230, .3));
                } else if (extra === 'coats') {
                    const [u, v] = at(endU), P = F(I, u, 0, v, longX ? 0 : Math.PI / 2); let y = 0;
                    for (let k = 0; k < 3; k++) { items.foldedCoat(b, F(P, (rnd(seed + k) - .5) * 60, y, (rnd(seed + k * 2) - .5) * 60, (rnd(seed + k * 5) - .5) * .7 + Math.PI / 2), pick(JACKETS, seed + k)); y += 62; }
                    items.tote(b, F(P, 0, -750, 0, .3, 0, 0));
                } else if (extra === 'cups' || extra === 'pizza') {
                    if (extra === 'pizza') { const [u, v] = at(-180); items.pizza(b, F(I, u, 0, v, .1)); }
                    for (let k = 0; k < 6; k++) { const u = (rnd(seed + k) - .5) * (L - 400), v = (rnd(seed + k * 7) - .5) * ((longX ? sz : sx) - 300); const [x, z] = longX ? [u, v] : [v, u]; if (modules.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 220) || (extra === 'pizza' && Math.abs(u + 180) < 300)) continue; items.cup(b, F(I, x, 0, z), k % 3 ? 'kraft' : 'cupTeal'); }
                } else if (extra === 'flyers') {
                    const [u, v] = at(-L / 4); ['stYellow', 'stBlue', 'paper'].forEach((col, k) => b.box(F(I, u, 0, v, longX ? 0 : Math.PI / 2), [215, 18, 280], [k * 240 - 240, 9, 0], [0, (rnd(seed + k) - .5) * .2, 0], sw(col)));
                } else if (extra === 'bottle') {
                    const s = order[1] || order[0]; if (s) items.bottle(b, F(I, s.edge[0], 0, s.edge[1], s.yaw).multiply(new THREE.Matrix4().makeTranslation(-120, 0, -240)), 'bottleLilac');
                } else if (extra === 'umbrella') {
                    const [u, v] = at(L / 2 + 200), dirx = longX ? -1 : 0, dirz = longX ? 0 : -1;
                    items.umbrella(b, F(I, u, -750 + 30 * Math.sin(.21), v, 0, dirz * .21, -dirx * .21));
                }
            }
            bake(item, b, `Student life · ${t.id} · ${phase}`);
            return item;
        });
        studyKits.push(phases);
        // Party: two chairs per used table turn toward the open house.
        for (const s of seats) if (s.chair && (plan.extras?.party?.length) && rnd(s.chair.at[0] * .031 + s.chair.at[2] * .017) > .5) seatInfo.get(key(s.chair.at[0], s.chair.at[2])).states[4] = 'turned';
        seatLog.push({ table: t.id, seats: seats.length });
    }
    // Coats hang on two chairs at a coat-pile table during the event.
    for (const t of layout.tables) if (PLANS[t.id]?.extras?.party?.includes('coats')) seatFrames(t).filter(s => s.chair).slice(0, 2).forEach((s, k) => { const info = seatInfo.get(key(s.chair.at[0], s.chair.at[2])); if (info) info.dress[4] = { jacket: pick(JACKETS, hash(t.id) + k * 5) }; });

    // ---------- Café tables ----------
    for (const [i, [cx, cz]] of layout.cafe.entries()) {
        const table = root.children.find(o => o.userData.propId === `humboldt-cafe-${i}`);
        const g = group(`humboldt-cafe-kit-${i}`, 'Café reading place', [0, 750, 0], table || root);
        if (!table) g.position.set(cx, 750, cz);
        const plan = CAFE_PLANS[i % CAFE_PLANS.length], seats = cafeSeats[i].map(c => {
            const dx = c.at[0] - cx, dz = c.at[2] - cz, d = Math.hypot(dx, dz) || 1, n = [dx / d, dz / d];
            seatInfo.set(key(c.at[0], c.at[2]), { x: c.at[0], z: c.at[2], n, states: states(c.at[0], c.at[2]), dress: PHASE.map(() => null), cafe: true });
            return { chair: c, n, yaw: Math.atan2(n[0], n[1]) };
        }).sort((a, b) => a.chair.at[0] - b.chair.at[0]);
        const variants = PHASE.map((phase, p) => {
            const item = new THREE.Group(); item.name = `Café activity · ${phase}`; g.add(item);
            const kind = plan[phase], seed = i * 31 + p * 7, b = baker(), I = new THREE.Matrix4();
            if (kind && seats.length) {
                const s0 = seats[0], s1 = seats[1] || seats[0], M0 = F(I, s0.n[0] * 450, 0, s0.n[1] * 450, s0.yaw), M1 = F(I, s1.n[0] * 450, 0, s1.n[1] * 450, s1.yaw);
                const use = s => { const info = seatInfo.get(key(s.chair.at[0], s.chair.at[2])); info.states[p] = 'used'; return info; };
                if (kind === 'laptop') { items.laptop(b, F(M0, 0, 0, -190), { body: pick(LAPTOPS, seed), screen: pick(SCREENS, seed + 2) }); items.phone(b, F(M0, 190, 0, -90, .4)); items.cup(b, F(M0, -200, 0, -150)); use(s0); if (rnd(seed) < .6) { items.cup(b, F(M1, 0, 0, -140), 'cupTerra'); use(s1); } }
                else if (kind === 'read') { items.openBook(b, F(M0, 0, 0, -170, .1), { cover: pick(COVERS, seed), page: pick(BOOKS, seed), w: 300, d: 200 }); items.mug(b, F(M0, 190, 0, -150)); use(s0); }
                else if (kind === 'mugbook') { items.mug(b, F(M0, 150, 0, -140)); items.openBook(b, F(M0, -60, 0, -170, -.15), { cover: 'forest', page: 'bkText', w: 280, d: 190 }); use(s0); }
                else if (kind === 'news') { items.newspaper(b, F(M0, -40, 0, -230, .25)); items.cup(b, F(M0, 180, 0, -130)); use(s0); }
                else if (kind === 'cupphone') { items.cup(b, F(M0, -80, 0, -140), 'cupTeal'); items.phone(b, F(M0, 80, 0, -120, -.3), 'caseCoral'); use(s0); }
                else if (kind === 'tote') { items.cup(b, F(M0, -60, 0, -150)); items.snack(b, F(M0, 120, 0, -200, .5)); const info = use(s0); info.states[p] = 'away'; info.dress[p] = { tote: true }; }
                else if (kind === 'cups') seats.forEach((s, k) => { items.cup(b, F(I, s.n[0] * 260, 0, s.n[1] * 260), k % 2 ? 'kraft' : 'cupTeal'); });
            }
            bake(item, b, `Café life · ${i} · ${phase}`);
            return item;
        });
        studyKits.push(variants);
    }

    // Draw budget: every dressed chair is one draw, so beyond the stepped-away
    // seats (bag + coat) and the event coats, keep at most two coats per daypart.
    PHASE.forEach((phase, p) => {
        if (phase === 'party') return;
        [...seatInfo.values()].filter(s => s.dress[p] && !s.dress[p].pack && !s.dress[p].tote).sort((a, b) => rnd(a.x * .01 + a.z * .03 + p) - rnd(b.x * .01 + b.z * .03 + p)).slice(2).forEach(s => { s.dress[p] = null; });
    });

    // ---------- Free-floor dressing near walls ----------
    const plinths = [[-4150, -2750, 5600, 11600]];
    const clear = (x, z, hx, hz) => layout.tables.every(t => Math.abs(x - t.at[0]) > hx + t.size[0] / 2 + 900 || Math.abs(z - t.at[1]) > hz + t.size[1] / 2 + 900)
        && layout.cafe.every(([cx, cz]) => Math.hypot(Math.max(Math.abs(x - cx) - hx, 0), Math.max(Math.abs(z - cz) - hz, 0)) > 1150)
        && layout.props.every(p => Math.hypot(Math.max(Math.abs(x - p.at[0]) - hx, 0), Math.max(Math.abs(z - p.at[2]) - hz, 0)) > 450)
        && plinths.every(([x0, x1, z0, z1]) => x + hx < x0 - 600 || x - hx > x1 + 600 || z + hz < z0 - 600 || z - hz > z1 + 600);
    const spot = (cands, hx, hz) => cands.find(([x, z, turn]) => { const swap = Math.abs(Math.sin(turn * Math.PI / 180)) > .5; return clear(x, z, swap ? hz : hx, swap ? hx : hz); }) || cands[0];
    const back = layout.back;
    const floorGroup = (id, name, [x, z, turn]) => group(id, name, [x, 0, z], root, turn * Math.PI / 180);

    // Returns cart: fills through the day, full at closing.
    const tablesBack = layout.tables.filter(t => t.at[1] - t.size[1] / 2 < back + 2500).sort((a, b) => a.at[0] - b.at[0]);
    const cartCands = [];
    for (let k = 0; k + 1 < tablesBack.length; k++) { const a = tablesBack[k], c = tablesBack[k + 1]; cartCands.push([(a.at[0] + a.size[0] / 2 + c.at[0] - c.size[0] / 2) / 2, back + 420, 0]); }
    cartCands.push([XL + 1500, back + 420, 0], [XL + 250, back + 3200, 90]);
    const cartAt = spot(cartCands, 470, 240), cart = floorGroup('humboldt-returns-cart', 'Book returns cart', cartAt);
    phaseGroups(cart, 'Returns cart').forEach((pg, p) => {
        const b = baker(), I = new THREE.Matrix4(), shelves = [230, 520, 810];
        for (const s of [-1, 1]) { b.box(I, [20, 900, 450], [s * 440, 470, 0], ZERO, sw('oak')); b.box(I, [20, 60, 20], [s * 440, 950, -200], ZERO, sw('steel')); }
        shelves.forEach((y, k) => b.box(I, [860, 18, 320], [0, y, 0], [(k % 2 ? -1 : 1) * .14, 0, 0], sw('oak')));
        for (const x of [-400, 400]) for (const z of [-180, 180]) b.cyl(I, 38, 38, 30, [x, 38, z], [0, 0, Math.PI / 2], sw('rubber'), 10);
        b.cyl(I, 14, 14, 900, [0, 975, -200], [0, 0, Math.PI / 2], sw('steel'), 8);
        const fill = [1, 2, 2, 3, 1][p];
        for (let k = 0; k < fill; k++) { const len = p === 0 && k === 0 ? 420 : 820; b.box(I, [len, 210, 200], [-(820 - len) / 2, shelves[2 - k] + 115, 0], [((2 - k) % 2 ? -1 : 1) * .14, 0, 0], tileUV('spines')); }
        bake(pg, b, `Returns cart · ${PHASE[p]}`);
    });

    // Junction information point: three-stream recycling + magazine rack against the solid
    // return wall where the hall narrows (z 9000), facing back into the junction.
    const infoAt = spot([[7500, 8790, 180], [XL + 200, -600, 90]], 1100, 200), info = floorGroup('humboldt-info-point', 'Recycling station and magazine rack', infoAt);
    {
        const b = baker(), I = new THREE.Matrix4();
        [['binGrey', -1000], ['binBlue', -600], ['binGreen', -200]].forEach(([col, x]) => { b.box(I, [380, 950, 380], [x, 475, 0], ZERO, sw(col)).box(I, [390, 30, 390], [x, 965, 0], ZERO, sw('charcoal')).box(I, [200, 8, 50], [x, 984, 60], ZERO, sw('rubber')); });
        b.plane(I, [1150, 110], [-600, 820, 191], ZERO, tileUV('bins'));
        b.box(I, [900, 1250, 18], [580, 625, -165], ZERO, sw('oak'));
        for (const s of [-1, 1]) b.box(I, [18, 1250, 180], [580 + s * 450, 625, -85], ZERO, sw('oak'));
        [[250, 'news'], [600, 'mags'], [950, 'mags']].forEach(([y, t]) => {
            b.box(I, [880, 15, 120], [580, y, -100], ZERO, sw('oak')).box(I, [880, 45, 12], [580, y + 22, -45], ZERO, sw('oak'));
            b.plane(I, [860, 300], [580, y + 160, -100], [-.26, 0, 0], tileUV(t));
        });
        bake(info, b, 'Recycling station and magazine rack');
    }

    // Commons open house: welcome table with banner, and a poster easel (party only).
    const welcomeAt = spot([[2800, 6600, 0], [1500, 6400, 0], [4200, 6300, 0], [800, 7400, 0]], 2400, 500), welcome = floorGroup('humboldt-welcome-table', 'Open house welcome table', welcomeAt);
    eventSpot.push(welcomeAt[0], welcomeAt[1]);
    const welcomePhases = phaseGroups(welcome, 'Open house');
    {
        const b = baker(), I = new THREE.Matrix4();
        b.box(I, [1840, 735, 790], [0, 375, 0], ZERO, sw('pilot')).box(I, [1840, 10, 790], [0, 747, 0], ZERO, sw('pilot'));
        b.plane(I, [1500, 190], [0, 560, 396], ZERO, tileUV('banner'));
        b.box(I, [250, 20, 180], [-520, 762, 120], ZERO, sw('lidWhite')).plane(I, [120, 120], [-520, 772.5, 120], FLAT, tileUV('nameTag'));
        ['stYellow', 'stBlue', 'paper'].forEach((col, k) => b.box(I, [215, 20, 280], [-180 + k * 235, 762, -60], [0, (k - 1) * .08, 0], sw(col)));
        b.cyl(I, 110, 110, 350, [650, 927, -170], ZERO, sw('dispenser'), 14).box(I, [30, 30, 40], [650, 800, -50], ZERO, sw('rubber'));
        b.cyl(I, 40, 36, 180, [470, 842, 150], ZERO, sw('lidWhite'), 10).cyl(I, 40, 36, 180, [380, 842, 160], ZERO, sw('kraft'), 10);
        b.cyl(I, 170, 170, 12, [-170, 758, 200], ZERO, sw('white'), 18); for (let k = 0; k < 5; k++) b.cyl(I, 30, 30, 10, [-170 + Math.cos(k * 1.26) * 90, 769, 200 + Math.sin(k * 1.26) * 90], ZERO, sw('kraft'), 8);
        // Poster easel, angled toward visitors arriving from the hall.
        const E = F(I, 1350, 0, 120, -.35);
        for (const s of [-1, 1]) b.box(E, [25, 1650, 25], [s * 250, 820, 80], [-.1, 0, s * .12], sw('oak'));
        b.box(E, [25, 1600, 25], [0, 780, -250], [.33, 0, 0], sw('oak')).box(E, [650, 20, 60], [0, 900, 150], ZERO, sw('oak'));
        b.box(E, [610, 915, 8], [0, 1362, 110], [-.1, 0, 0], sw('white')).plane(E, [600, 905], [0, 1362.5, 115], [-.1, 0, 0], tileUV('poster'));
        bake(welcomePhases[4], b, 'Open house welcome table and easel');
    }

    // Closing: a wet-floor sign by the café while the floor is mopped.
    const hallCafe = layout.cafe.filter(([, z]) => z > 11000).sort((a, b) => a[1] - b[1]);
    const wetBase = hallCafe[1] || hallCafe[0] || layout.cafe[0];
    if (wetBase) {
        const wet = floorGroup('humboldt-wet-floor-sign', 'Wet floor sign', [wetBase[0] - 1450, wetBase[1] + 900, -60]);
        const b = baker(), I = new THREE.Matrix4();
        for (const s of [-1, 1]) b.box(I, [300, 620, 8], [0, 305, s * 62], [-s * .2, 0, 0], sw('caution'));
        b.box(I, [300, 20, 40], [0, 615, 0], ZERO, sw('caution')).plane(I, [250, 125], [0, 380, 81], [-.2, 0, 0], tileUV('wet'));
        // The custodian's cart parked behind the sign: chassis, caddy, a lined
        // bin hoop and a mop bucket with its wringer and handle.
        const C = F(I, 0, 0, -820, Math.PI / 2);
        b.box(C, [920, 40, 480], [0, 170, 0], ZERO, sw('binGrey'));
        for (const x of [-400, 400]) for (const z of [-190, 190]) b.cyl(C, 45, 45, 30, [x, 45, z], [Math.PI / 2, 0, 0], sw('rubber')).box(C, [24, 110, 24], [x, 115, z], ZERO, sw('steel'));
        b.box(C, [380, 880, 460], [-260, 630, 0], ZERO, sw('binGrey')).box(C, [400, 30, 480], [-260, 1085, 0], ZERO, sw('binGrey'));
        b.box(C, [340, 6, 400], [-260, 500, 232], ZERO, sw('caution'));
        b.cyl(C, 205, 195, 740, [190, 560, 0], ZERO, sw('packBlack'), 14).cyl(C, 215, 215, 20, [190, 935, 0], ZERO, sw('binGrey'), 14);
        for (const [x, z, s] of [[-360, -120, 'binBlue'], [-290, -120, 'caution'], [-200, -130, 'bottleWhite']]) b.cyl(C, 32, 32, 210, [x, 1205, z], ZERO, sw(s)).box(C, [26, 50, 36], [x, 1330, z], ZERO, sw(s));
        b.box(C, [240, 180, 200], [-240, 1190, 110], ZERO, sw('binBlue'));
        const P = F(I, 520, 0, -420, .4);
        b.cyl(P, 200, 165, 330, [0, 165, 0], ZERO, sw('caution'), 16).box(P, [300, 170, 150], [0, 410, -60], ZERO, sw('binGrey'));
        b.seg(P, [60, 280, 40], [-80, 1500, -200], 26, sw('steel')).cyl(P, 70, 120, 140, [60, 260, 40], ZERO, sw('cotton'), 10);
        for (const [x, z] of [[-170, -120], [170, -120], [-170, 120], [170, 120]]) b.cyl(P, 26, 26, 20, [x, 10, z], [Math.PI / 2, 0, 0], sw('rubber'));
        bake(phaseGroups(wet, 'Wet floor')[3], b, 'Wet floor sign and custodian cart');
    }

    // Lounge side table: phone, cup and a paperback left face-down.
    const side = root.children.find(o => o.userData.propId === 'humboldt-side-table');
    if (side) phaseGroups(side, 'Lounge side table').forEach((pg, p) => {
        const b = baker(), I = new THREE.Matrix4(), top = 550;
        if (p === 1 || p === 2) { for (const s of [-1, 1]) b.box(I, [110, 8, 175], [s * 48 - 40, top + 22, 20], [0, 0, s * .38], sw(p === 1 ? 'crimson' : 'forest')); }
        if (p === 1) { items.phone(b, F(I, 110, top, -90, .5), 'caseSage'); items.cup(b, F(I, 100, top, 110)); }
        if (p === 2) items.mug(b, F(I, 120, top, 60));
        if (p === 4) { items.cup(b, F(I, -90, top, 80)); items.cup(b, F(I, 90, top, -60), 'cupTeal'); }
        bake(pg, b, `Lounge side table · ${PHASE[p]}`);
    });
    const sideGroups = side ? side.children.filter(o => o.isGroup && o.name.startsWith('Lounge side table ·')) : [];

    // ---------- Tackboard flyers ----------
    const tack = root.getObjectByProperty?.('name', 'Tackboard wall') || (() => { let f = null; root.traverse(o => { if (!f && o.userData.propId === 'humboldt-tackboard') f = o; }); return f; })();
    const flyerPhase = [];
    let flyerMat = null, flyerMap = null;
    if (tack) {
        root.updateWorldMatrix(true, true);
        const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(tack.matrixWorld), toTack = toRoot.clone().invert();
        const panel = new THREE.Box3(), notices = [];
        for (const o of tack.children) {
            const box = new THREE.Box3().setFromObject(o).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
            if (o.isMesh && o.material?.map) panel.union(box); else if (!o.isMesh) notices.push(box);
        }
        if (!panel.isEmpty()) {
            flyerMap = canvasMap(drawFlyers, 1024, 1024); flyerMap.anisotropy = 4;
            flyerMat = own(new THREE.MeshStandardMaterial({ name: 'Humboldt tackboard flyers', map: flyerMap, roughness: .9 })); flyerMat.userData.roomPaletteLocked = true; textures.push(flyerMap);
            const faceX = panel.min.x - 1.5, placed = [], pad = 40;
            const hit = (z0, z1, y0, y1) => placed.some(r => z0 < r[1] + 25 && z1 > r[0] - 25 && y0 < r[3] + 25 && y1 > r[2] - 25) || notices.some(n => z0 < n.max.z + pad && z1 > n.min.z - pad && y0 < n.max.y + pad && y1 > n.min.y - pad);
            const zMin = panel.min.z + 70, zMax = panel.max.z - 70, yMin = Math.max(panel.min.y + 300, 900), yMax = Math.min(panel.max.y - 250, 2700);
            const regular = baker(), partyB = baker(), T = new THREE.Matrix4().copy(toTack);
            FLYERS.forEach((f, i) => {
                const [w, h] = FLYER_MM[f.size];
                for (let tries = 0; tries < 400; tries++) {
                    const zc = zMin + w / 2 + rnd(i * 97 + tries * 3.1) * (zMax - zMin - w), yc = yMin + h / 2 + rnd(i * 53 + tries * 7.3) * (yMax - yMin - h);
                    if (hit(zc - w / 2, zc + w / 2, yc - h / 2, yc + h / 2)) continue;
                    placed.push([zc - w / 2, zc + w / 2, yc - h / 2, yc + h / 2]);
                    const [x, y, cw, ch] = flyerRect(i, f.size), uv = [(x + 1) / 1024, 1 - (y + ch - 1) / 1024, (x + cw - 1) / 1024, 1 - (y + 1) / 1024];
                    const tilt = (rnd(i * 11) - .5) * .09, B = f.party ? partyB : regular, Mf = F(T, faceX - (i % 3) * .4, yc, zc, -Math.PI / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(tilt));
                    B.plane(Mf, [w, h], [0, 0, 0], ZERO, uv);
                    B.cyl(Mf, 5, 5, 8, [0, h / 2 - 14, 4], [Math.PI / 2, 0, 0], PIN_UV(i % 3), 8);
                    if (f.size === 'tabloid' || i % 4 === 0) B.cyl(Mf, 5, 5, 8, [0, -h / 2 + 14, 4], [Math.PI / 2, 0, 0], PIN_UV((i + 1) % 3), 8);
                    break;
                }
            });
            const mk = (b, name) => { const geo = b.build(); if (!geo) return null; const m = new THREE.Mesh(geo, flyerMat); m.name = name; m.castShadow = m.receiveShadow = false; tack.add(m); return m; };
            mk(regular, 'Tackboard flyers'); const pm = mk(partyB, 'Open house flyer'); if (pm) flyerPhase.push(pm);
        }
    }

    // ---------- Whiteboards: per-daypart writing on the existing surface ----------
    const boards = layout.props.filter(p => /^campus-board/.test(p.id)).sort((a, b) => a.at[2] - b.at[2]);
    const boardFaces = [];
    const dressBoard = (object, placement) => {
        const which = boards.findIndex(p => p.at[0] === placement.at[0] && p.at[2] === placement.at[2]) === 1 ? 'B' : 'A';
        object.updateMatrixWorld(true);
        object.traverse(o => {
            if (!o.isMesh || (Array.isArray(o.material) ? o.material[0] : o.material)?.name) return;
            const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
            if (Math.max(s.x, s.y, s.z) < 130 && b.getCenter(new THREE.Vector3()).y > 800) o.visible = false;
        });
        object.traverse(o => {
            if (!o.isMesh) return; const m = Array.isArray(o.material) ? o.material[0] : o.material;
            if (!/writing surface/i.test(m?.name || '')) return;
            o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.getSize(new THREE.Vector3()), aspect = (s.y || 1) / (s.x || 1);
            const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.max(256, Math.round(1024 * aspect));
            const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
            const mat = m.clone(); mat.map = tex; mat.userData.roomPaletteLocked = true; own(mat); o.material = mat;
            boardFaces.push({ canvas, tex, which }); textures.push(tex);
            drawBoard(canvas.getContext('2d'), canvas.width, canvas.height, which, current);
            tex.needsUpdate = true;
        });
    };

    // ---------- Chair dressings: jackets on backs, bags on seats ----------
    const dressChair = (object, info) => {
        object.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(object.matrixWorld).invert(), v = new THREE.Vector3(), pts = [];
        // Sample the chair's geometry in its own (unscaled) frame, in mm.
        object.traverse(o => { if (!o.isMesh || !o.geometry?.attributes.position) return; const a = o.geometry.attributes.position, M = new THREE.Matrix4().copy(inv).multiply(o.matrixWorld).premultiply(object.matrix); const step = Math.max(1, Math.floor(a.count / 1500)); for (let i = 0; i < a.count; i += step) pts.push(v.fromBufferAttribute(a, i).applyMatrix4(M).toArray()); });
        if (!pts.length) return;
        const maxY = Math.max(...pts.map(p => p[1])), top = pts.filter(p => p[1] > maxY * .82);
        const zB = Math.min(...top.map(p => p[2])), zF = Math.max(...top.map(p => p[2])), wB = Math.max(...top.map(p => p[0])) - Math.min(...top.map(p => p[0]));
        const front = pts.filter(p => p[2] > zF + 60 && p[1] < maxY * .7), seatY = front.length ? Math.max(...front.map(p => p[1])) : 450;
        const holder = new THREE.Group(); holder.name = 'Chair dressing'; holder.scale.set(1 / object.scale.x, 1 / object.scale.y, 1 / object.scale.z); object.add(holder);
        const groups = phaseGroups(holder, 'Chair dressing');
        info.dress.forEach((d, p) => {
            if (!d) return; const b = baker(), I = new THREE.Matrix4(), seed = hash(`${info.x}|${info.z}`) + p;
            if (d.jacket) {
                const c = d.jacket, w = Math.max(320, Math.min(wB, 520));
                b.box(I, [w * .96, 40, zF - zB + 50], [0, maxY + 8, (zB + zF) / 2], ZERO, sw(c));
                b.box(I, [w * .9, 430, 24], [0, maxY - 205, zB - 16], [-.05, 0, 0], sw(c));
                b.box(I, [w * .84, 120, 18], [0, maxY - 55, zF + 12], ZERO, sw(c));
                for (const s of [-1, 1]) b.cyl(I, 42, 36, 430, [s * (w * .45 + 8), maxY - 230, zB - 30], [0, 0, s * .07], sw(c), 8);
                b.box(I, [200, 34, 60], [0, maxY + 30, zB - 6], [-.2, 0, 0], sw(c === 'flannel' ? 'charcoal' : c));
            }
            if (d.pack) items.backpack(b, F(I, (rnd(seed) - .5) * 60, seatY, zF + 130, (rnd(seed + 1) - .5) * .4, -.2), d.pack);
            if (d.tote) items.tote(b, F(I, 0, seatY, zF + 110, .3, -.25));
            bake(groups[p], b, `Chair dressing · ${PHASE[p]}`);
        });
        chairGroups.push(groups);
    };
    const chairGroups = [];

    // Publish seat states for room-life's chair messiness pass.
    root.userData.humboldtSeats = { seats: [...seatInfo.values()].map(({ x, z, n, states: s, cafe }) => ({ x, z, n, states: s, cafe: !!cafe })), event: eventSpot.length ? eventSpot : null };
    root.userData.humboldtLife = { tables: seatLog, textures: textures.length, groupTable: layout.groupStudy?.table };

    let current = 'morning';
    const phaseLists = [cart.children.filter(o => o.isGroup), welcomePhases, sideGroups];
    const wetGroups = []; root.traverse(o => { if (o.isGroup && o.name.startsWith('Wet floor ·')) wetGroups.push(o); });
    phaseLists.push(wetGroups);

    const apply = modeId => {
        current = PHASE.includes(modeId) ? modeId : 'morning';
        const p = PHASE.indexOf(current);
        studyKits.forEach(variants => variants.forEach((o, i) => { o.visible = i === p; }));
        for (const list of phaseLists) list.forEach((o, i) => { o.visible = i === p; });
        for (const list of chairGroups) list.forEach((o, i) => { o.visible = i === p; });
        flyerPhase.forEach(o => { o.visible = current === 'party'; });
        lifeMat.emissiveIntensity = SCREEN_GLOW[current];
        root.userData.humboldtLife.phase = current;
        root.userData.humboldtLife.groupActive = layout.groupStudy?.phases.includes(current) || false;
        root.userData.humboldtLife.activity = ({ morning: 'Coffee, planning and returns', afternoon: 'Shared research and annotations', evening: 'Quiet reading by task light', night: 'Collections tidied and floor cleared', party: 'Field maps, samples and project review' })[current];
        for (const f of boardFaces) { drawBoard(f.canvas.getContext('2d'), f.canvas.width, f.canvas.height, f.which, current); f.tex.needsUpdate = true; }
    };
    apply('morning');

    return {
        studyKits,
        apply,
        decorateProp(object, placement) {
            if (/^campus-board/.test(placement.id)) return dressBoard(object, placement);
            if (placement.id !== CHAIR) return;
            const info = seatInfo.get(key(placement.at[0], placement.at[2]));
            if (!info || !info.dress.some(Boolean)) return;
            dressChair(object, info);
            const p = PHASE.indexOf(current); chairGroups[chairGroups.length - 1]?.forEach((o, i) => { o.visible = i === p; });
        }
    };
}
