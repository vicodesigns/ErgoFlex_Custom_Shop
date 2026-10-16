import * as THREE from 'three';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';

// A sixth Library layout inspired by the ground-floor commons of Cal Poly
// Humboldt Library: a double-height reading commons on charcoal carpet tile,
// a beige gallery band with a carved redwood canoe and white figures, a glass
// bay, a long tackboard wall and black suspended light frames. The owner's
// ErgoFlex desk stands against the right wall just left of the tackboard.
// It is inspired by the space, not a survey: depth is compressed (~0.7) so it
// fits the app's largest room class; furniture keeps real sizes. No names,
// logos or signage. Specs: docs/library-humboldt-commons.md.
//
// Millimetres, room-local: x across (left -), z depth (back wall at -7000,
// open front at +14000), y up. Prop turn θ faces (sin θ, 0, cos θ).
const W = 18000, D = 21000, H = 7200, BACK = -D / 3, FRONT = BACK + D;
const SOFFIT = 3600, CAFE_SOFFIT = 3000, SOFFIT_X = 4800, CAFE_Z = 11600, BAND_Z = 5000;
const DESK = [8240, -1850];
// The high ceiling slopes from 4800 at the back wall to 7200 at z 5000, then runs flat.
const SLOPE_Z = 5000, slopeY = z => z < SLOPE_Z ? 4800 + (z - BACK) / (SLOPE_Z - BACK) * 2400 : H, SLOPE = Math.atan2(2400, SLOPE_Z - BACK);
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function makeHumboldtLayout() {
    const chair = (x, z, turn) => ({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, z], turn });
    const props = [
        // Task chair on the room side of the wall desk, facing the wall.
        { id: 'steelcase-leap-v2', at: [DESK[0] - 1050, 0, DESK[1]], turn: 90 },
        // Lounge along the tackboard, the red armchair moved from the desk bay.
        { id: 'atelier-timber-obsidian', at: [7900, 0, 100], turn: -90, finish: 'charcoal' },
        { id: 'atelier-timber-clay', at: [7900, 0, 1750], turn: -90, finish: 'raspberry' },
        { id: 'monstera', at: [8600, 0, 3000] },
        { id: 'atelier-timber-obsidian', at: [-8350, 0, 3600], turn: 90, finish: 'charcoal' },
        { id: 'campus-board-compact-nordic', at: [-8600, 0, -400], turn: 90 },
        { id: 'campus-board-compact-nordic', at: [-8600, 0, 900], turn: 90 },
        { id: 'kenney-furniture-trashcan', at: [-8750, 0, 4700], turn: 90, finish: 'recycle' },
        { id: 'kenney-furniture-trashcan', at: [-8750, 0, 5180], turn: 90 },
        { id: 'ficus', at: [3800, 0, -6650] }
    ];
    // Study tables: back row in front of the glass bay, the long group run,
    // a square four-top in the open commons. Chairs tuck 750 from centre.
    for (const x of [-6800, -6000, -5200]) props.push(chair(x, -5950, 0), chair(x, -4450, 180));
    for (const x of [-2250, -1350]) props.push(chair(x, -5950, 0), chair(x, -4450, 180));
    for (const x of [2350, 3250]) props.push(chair(x, -5950, 0), chair(x, -4450, 180));
    for (const z of [-350, 550, 1450, 2350]) props.push(chair(-6350, z, 90), chair(-4850, z, -90));
    for (const z of [-2400, -1600, -800]) props.push(chair(-2750, z, 90), chair(-1250, z, -90));
    props.push(chair(2600, -2300, 0), chair(2600, -500, 180), chair(1700, -1400, 90), chair(3500, -1400, -90));
    // Café: one round table in the notch, five along the curtain wall.
    props.push(chair(6450, 5000, 90), chair(7425, 5563, -150), chair(7425, 4437, -30));
    for (const x of [-7000, -4200, 1800, 4600, 7400]) props.push(chair(x, 13450, 180), chair(x + 563, 12475, -60), chair(x - 563, 12475, 60));
    const tables = [
        { id: 'humboldt-table-b1', at: [-6000, -5200], size: [2400, 900] },
        { id: 'humboldt-table-b2', at: [-1800, -5200], size: [1800, 900] },
        { id: 'humboldt-table-b3', at: [2800, -5200], size: [1800, 900] },
        { id: 'humboldt-table-g1', at: [-5600, 1000], size: [900, 3600] },
        { id: 'humboldt-table-g2', at: [-2000, -1600], size: [900, 2400] },
        { id: 'humboldt-table-s1', at: [2600, -1400], size: [1200, 1200] },
        { id: 'humboldt-table-l1', at: [2600, 2000], size: [1800, 900], light: true }
    ];
    const cafe = [[7100, 5000], ...[-7000, -4200, 1800, 4600, 7400].map(x => [x, 12800])];
    return ['humboldt', {
        id: 'humboldt', name: 'Humboldt-inspired commons', width: W, depth: D, height: H, back: BACK,
        // Shared Library systems treat this as the largest tier.
        index: 4, tier: 'executive', humboldt: true, desktopSize: '60x30',
        desk: DESK, deskTurn: -90, reading: [...tables.map(t => t.at), ...cafe], stacks: [], carrels: [], research: null, service: null, lounge: null, sideTable: [8150, 1000],
        tables, cafe, props, daylight: null,
        finish: { partyDay: false, name: 'Commons white & charcoal', ground: '#5e5f5c', wood: .51, metal: .30, stone: .67, night: .96 },
        // Groove poses relative to the wall desk: always step back into the room (-x).
        groovePoses: {
            morning: { dx: -150, dz: 0, yaw: -Math.PI / 2 },
            afternoon: { dx: -300, dz: 300, yaw: -Math.PI / 2 + .08 },
            evening: { dx: -600, dz: 400, yaw: -Math.PI / 2 + .18 },
            night: { dx: -100, dz: 100, yaw: -Math.PI / 2 },
            party: { dx: -1300, dz: -200, yaw: -Math.PI / 2 + .3 }
        },
        modes: HUMBOLDT_MODES
    }];
}

// North Coast overcast by day, the reference photo's warm-neutral 3500 K
// commons at dusk, half the frames at late study, and a lit collection for an
// evening event. Same fields and ranges as LIBRARY_MODES; the desk keeps its
// wall-facing turn (layout.deskTurn) in every daypart.
export const HUMBOLDT_MODES = {
    morning: { label: 'Morning', description: 'Marine-layer daylight · opening the commons', key: '#eef1f1', fill: '#dde6ec', accent: '#efe3d1', power: 1.05, ambient: .5, bounce: .58, exposure: 1.08, sky: ['#b7c4cb', '#e2e6e3'], practical: .45, wash: .35, colors: ['#fff0de', '#f6efe4'], height: 43.5, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Bright overcast · individual study and research', key: '#f8f5ef', fill: '#e0e8ec', accent: '#eadccb', power: 1.2, ambient: .55, bounce: .62, exposure: 1.1, sky: ['#c3d0d7', '#eef0ec'], practical: .5, wash: .4, colors: ['#fff0de', '#f6efe4'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Dusk study · frames, washers and warm tables', key: '#e3a77e', fill: '#b9bcc4', accent: '#f0caa2', power: .38, ambient: .34, bounce: .46, exposure: 1.22, sky: ['#4a5a7e', '#d49a7a'], practical: 1.05, wash: .8, colors: ['#ffecd6', '#ece4d6'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: true, color: '#4f4232' },
    night: { label: 'Late study', description: 'Late study · half the frames on, focused desk light', key: '#d6d0c6', fill: '#9eaac0', accent: '#efc79a', power: .12, ambient: .13, bounce: .2, exposure: 1, sky: ['#06090f', '#111824'], practical: 1.25, wash: .26, colors: ['#ffe9d0', '#ece4d6'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: true, color: '#3a3226' },
    party: { label: 'Commons event', description: 'Evening event · full frames, lit sculptures and canoe', key: '#f0d4b4', fill: '#b6bed4', accent: '#f5c58e', power: .3, ambient: .32, bounce: .5, exposure: 1.15, sky: ['#141d30', '#3e3d55'], practical: .8, wash: .95, colors: ['#ffe6c8', '#ffdcb4'], height: 43.5, tilt: 0, offset: [0, 0], yaw: 0, leds: true, color: '#5c4a2c' }
};
const PHASE = ['morning', 'afternoon', 'evening', 'night', 'party'];
const T3500 = '#ffe7cc', T4000 = '#fff0de', T3000 = '#ffdcb4';

function canvasMap(draw, w = 512, h = 512) {
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
function kit() {
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
        // Marine-layer sky over three depth bands of conifer spires and a low grass verge.
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, mode.sky[0]); g.addColorStop(1, mode.sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (const [band, color, top, count] of [[0, '#56665a', .18, 26], [1, '#3a4a3e', .3, 20], [2, '#2c3a30', .45, 14]]) {
            c.fillStyle = color;
            for (let i = 0; i < count; i++) {
                const x = (i + rnd(band * 31 + i) * .8) / count * w * 1.1 - w * .05, half = w * (.02 + rnd(band * 7 + i) * .015), y = h * (top + rnd(band * 13 + i) * .12);
                c.beginPath(); c.moveTo(x, y); c.lineTo(x + half, h * .86); c.lineTo(x - half, h * .86); c.closePath(); c.fill();
            }
        }
        c.fillStyle = '#5b6a4f'; c.fillRect(0, h * .84, w, h * .16);
    }
    if (modeId === 'morning' || modeId === 'afternoon') { c.globalCompositeOperation = 'screen'; c.fillStyle = modeId === 'morning' ? '#dfe6ea2e' : '#e9eef01f'; c.fillRect(0, 0, w, h); }
    if (modeId === 'evening') {
        c.globalCompositeOperation = 'multiply'; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2f3c5c'); g.addColorStop(.6, '#9a7a74'); g.addColorStop(1, '#3a3a40'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'soft-light'; c.fillStyle = '#e39a6e26'; c.fillRect(0, 0, w, h);
    }
    if (modeId === 'night' || modeId === 'party') {
        c.globalCompositeOperation = 'multiply'; c.fillStyle = modeId === 'night' ? '#0d1420' : '#1a2238'; c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'source-over';
        // Faint reflections of the frames and soffit, and a mullion glint.
        for (const [y, a] of [[.22, modeId === 'night' ? .07 : .12], [.36, .06], [.58, .05]]) { c.fillStyle = `rgba(255,231,204,${a})`; c.fillRect(0, h * y, w, h * .012); }
        c.fillStyle = 'rgba(255,255,255,.05)'; for (let x = w * .17; x < w; x += w / 3) c.fillRect(x, 0, 2, h);
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
    const plasterMap = repeating(canvasMap((c, S) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S); mottle(c, S, S, 120, 3, '#ffffff06', '#00000005', 50, 160); }));
    const paint = (color, length, height = h) => { const map = plasterMap.clone(); map.repeat.set(length / 4000, height / 4000); return tag(own(material(color, { roughness: .92, map, dithering: true })), 'plaster'); };
    const whiteFlat = tag(own(material('#ebeae5', { roughness: .92, dithering: true })), 'plaster');
    const olive = tag(own(material('#7d7e68', { roughness: .92, dithering: true })), 'plaster');
    const rubber = own(material('#26272a', { roughness: .7 }));
    const bronze = tag(own(material('#2e2b27', { roughness: .5, metalness: .55 })), 'powder');
    const frameBlack = own(material('#1e1e1f', { roughness: .55, metalness: .2 }));
    const plinthWhite = own(material('#ebe9e3', { roughness: .8 }));
    const sculptureWhite = own(material('#e4e1da', { roughness: .9 }));
    const plank = { mm: 2000, courses: 8, per: 2 };
    const carpetMap = repeating(canvasMap((c, S) => {
        const ph = S / plank.courses, pw = S / plank.per;
        const tones = ['#56575a', '#525356', '#5a5b5d', '#4f5053', '#5c5d5f', '#545558'], flecks = ['#8f969e30', '#2a2e3438', '#8a847a22', '#9a948a1c'];
        const draw = (x, y, id, flip) => {
            c.save(); c.beginPath(); c.rect(x, y, pw, ph); c.clip();
            c.fillStyle = tones[Math.floor(rnd(id * 3.1) * tones.length)]; c.fillRect(x, y, pw, ph);
            c.fillStyle = flip ? '#ffffff04' : '#00000005'; c.fillRect(x, y, pw, ph);
            for (let n = 0; n < 1400; n++) { const k = id * 5003 + n; c.fillStyle = flecks[n % 4]; c.fillRect(x + rnd(k) * pw, y + rnd(k + .37) * ph, 2 + rnd(k + .71) * 3, 1); }
            if (rnd(id * 7.3) < .45) for (let b = 0, bands = 2 + Math.floor(rnd(id * 1.7) * 3); b < bands; b++) {
                const by = Math.round(y + 10 + rnd(id * 11 + b) * (ph - 20)); c.fillStyle = `rgba(170,176,180,${(.12 + rnd(id + b) * .08).toFixed(2)})`;
                for (let dx = rnd(id + b * 3) * 8; dx < pw;) { const len = 6 + rnd(id * 13 + dx) * 8; c.fillRect(x + dx, by, len, 2); dx += len + 3 + rnd(id * 17 + dx) * 3; }
            }
            c.fillStyle = '#14181d1a'; c.fillRect(x, y + ph - 1, pw, 1); c.fillRect(x + pw - 1, y, 1, ph); c.fillStyle = '#ffffff0a'; c.fillRect(x, y, pw, 1);
            c.restore();
        };
        for (let r = 0; r < plank.courses; r++) for (let k = 0; k < plank.per; k++) {
            const x = (r % 2) * pw / 2 + k * pw, id = r * plank.per + k + 1, flip = (r + k) % 2;
            draw(x, r * ph, id, flip); if (x + pw > S) draw(x - S, r * ph, id, flip);
        }
    }, 1024, 1024), 8);
    const broadloomMap = repeating(canvasMap((c, S) => {
        c.fillStyle = '#a99c8b'; c.fillRect(0, 0, S, S); mottle(c, S, S, 40, 51, '#ffffff04', '#00000004', 40, 130);
        for (let y = 0; y < S; y += 4) for (let x = (y / 4 % 2) * 2; x < S; x += 4) { const v = rnd(x * 1.3 + y * 7.9); c.fillStyle = v > .66 ? '#ffffff10' : v > .33 ? '#0000000b' : '#00000004'; c.fillRect(x, y, 3, 3); }
        const yarn = ['#cdbfae33', '#6e60522e', '#8b8a8526', '#b9a48a24'];
        for (let n = 0; n < 9000; n++) { c.fillStyle = yarn[n % 4]; const ww = 1 + (n % 3 === 0); tile(S, S, rnd(n * 1.1) * S, rnd(n * 3.7) * S, 3, (x, y) => c.fillRect(x, y, ww, 2)); }
    }), 8);
    const tackMap = repeating(canvasMap((c, S) => {
        c.fillStyle = '#b39270'; c.fillRect(0, 0, S, S); mottle(c, S, S, 30, 77, '#ffffff0c', '#0000000c', 30, 110);
        const grain = ['#7a5d3c20', '#c09a6c1c', '#5e452c18', '#b58f6218'];
        for (let n = 0; n < 7000; n++) { const r = .6 + rnd(n * 2.9) ** 2 * 1.4, a = rnd(n * 4.3) * Math.PI; c.fillStyle = grain[n % 4]; tile(S, S, rnd(n * 1.7) * S, rnd(n * 6.1) * S, r * 1.5, (x, y) => { c.beginPath(); c.ellipse(x, y, r * 1.4, r, a, 0, Math.PI * 2); c.fill(); }); }
    }));
    const oakGrain = (base, dark, light, strength = 1) => repeating(canvasMap((c, Wc, Hc) => {
        c.fillStyle = base; c.fillRect(0, 0, Wc, Hc);
        for (let i = 0; i < 140; i++) {
            const y0 = rnd(i * 3.7) * Hc, k1 = 1 + i % 3, k2 = 3 + i % 5, a1 = 2 + rnd(i) * 6, a2 = .5 + rnd(i * 2) * 1.5, p1 = rnd(i * 5) * 6.2832, p2 = rnd(i * 7) * 6.2832;
            c.strokeStyle = i % 3 ? dark : light; c.globalAlpha = (.1 + rnd(i * 9) * .14) * strength; c.lineWidth = .6 + rnd(i * 11) * 1.8;
            for (const oy of [-Hc, 0, Hc]) { c.beginPath(); for (let x = 0; x <= Wc; x += 8) { const y = y0 + oy + a1 * Math.sin(6.2832 * k1 * x / Wc + p1) + a2 * Math.sin(6.2832 * k2 * x / Wc + p2); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
        }
        c.globalAlpha = .18 * strength; c.fillStyle = dark;
        for (let n = 0; n < 2000; n++) { const len = 2 + rnd(n) * 3; tile(Wc, Hc, rnd(n * 1.3) * Wc, rnd(n * 2.1) * Hc, len, (x, y) => c.fillRect(x, y, len, 1)); }
        c.globalAlpha = 1;
    }, 1024, 256));
    const honeyOakMap = oakGrain('#b38a5a', '#5e3f22', '#e6c996'), mapleMap = oakGrain('#e3dacb', '#9c8466', '#f6efe2', .5);
    const honeyOak = tag(own(material('#ffffff', { map: honeyOakMap, roughness: .51 })), 'wood');
    const cafeOak = tag(own(material('#f2e6d6', { map: honeyOakMap, roughness: .51 })), 'wood');
    const mapleTop = own(material('#ffffff', { map: mapleMap, roughness: .45 }));
    const laminate = own(material('#e9e4d8', { roughness: .5 })), steelGrey = own(material('#8a8d90', { roughness: .45, metalness: .6 }));
    const ceilingMap = repeating(canvasMap((c, Wc, Hc) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, Wc, Hc);
        for (let n = 0; n < 220; n++) { let x = 8 + rnd(n * 1.7) * (Wc - 16), y = 8 + rnd(n * 2.3) * (Hc - 16); c.strokeStyle = '#00000016'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd(n * 9 + k) - .5) * 6; y += (rnd(n * 13 + k) - .5) * 6; c.lineTo(x, y); } c.stroke(); }
        c.fillStyle = '#fbfaf7'; c.fillRect(0, 0, Wc, 3); c.fillRect(0, 0, 3, Hc); c.fillRect(0, Hc - 2, Wc, 2); c.fillRect(Wc - 2, 0, 2, Hc);
        c.fillStyle = '#0000001c'; c.fillRect(3, 3, Wc - 5, 1); c.fillRect(3, 3, 1, Hc - 5);
    }, 512, 256));
    const ceilingTile = (wx, dz) => { const map = ceilingMap.clone(); map.repeat.set(wx / 1200, dz / 600); return tag(own(material('#eceae5', { map, roughness: .92, dithering: true })), 'plaster'); };
    // Fixture lenses follow the architectural (wash) layer; desk task light follows practical.
    const lens = (color = '#fff6ea', emissive = T3500) => own(material(color, { emissive, emissiveIntensity: .4, roughness: .4 }));
    const lensA = lens(), lensB = lens(), canLens = lens('#fffaf2', '#fff0dc'), trackLens = lens('#fff3e2', T3000), grazerLens = lens();

    // ---------- Floors: charcoal tile commons, beige broadloom band ----------
    const floorBox = (mapSrc, x0, x1, z0, z1, rough, offset) => {
        const map = mapSrc.clone(); map.repeat.set((x1 - x0) / (mapSrc === carpetMap ? 2000 : 512), (z1 - z0) / (mapSrc === carpetMap ? 2000 : 512)); map.offset.set(...offset);
        const mat = tag(own(material('#ffffff', { map, roughness: rough, dithering: true })), 'fabric');
        const o = box(root, [x1 - x0, 30, z1 - z0], [(x0 + x1) / 2, -15, (z0 + z1) / 2], mat); o.castShadow = false; o.userData.humboldtFloor = mapSrc === carpetMap ? 'tile' : 'broadloom'; return o;
    };
    floorBox(carpetMap, -w / 2, w / 2, bz, 4000, .96, [0, 0]);
    floorBox(carpetMap, -w / 2, 5800, 4000, BAND_Z, .96, [0, .5]);
    floorBox(broadloomMap, -w / 2, w / 2, BAND_Z, front, .96, [.37, .61]);
    floorBox(broadloomMap, 5800, w / 2, 4000, BAND_Z, .96, [.11, .23]);
    const strip = kit(); strip.box([5800 + w / 2, 3, 22], [(5800 - w / 2) / 2, 1.5, BAND_Z]).box([22, 3, 1000], [5800, 1.5, 4500]).box([w / 2 - 5800, 3, 22], [(5800 + w / 2) / 2, 1.5, 4000]);
    baked(root, strip, own(material('#3d3b38', { roughness: .7 })), false);

    // ---------- Walls ----------
    const base = (parent, k) => baked(parent, k, rubber, false);
    // Back wall: white, glass bay with two grey columns, three wall washers.
    const back = new THREE.Group(); back.name = 'Humboldt commons back wall'; root.add(back);
    const backSeg = (x0, x1, y0 = 0, y1 = h) => box(back, [x1 - x0, y1 - y0, 80], [(x0 + x1) / 2, (y0 + y1) / 2, bz - 40], paint('#ebeae5', x1 - x0, y1 - y0));
    backSeg(-w / 2, 750); backSeg(750, 4850, 4600, h); backSeg(4850, w / 2);
    const columns = kit(); for (const x of [1000, 4600]) columns.box([500, h, 500], [x, h / 2, bz + 250]);
    baked(back, columns, own(tag(material('#6b6c63', { roughness: .9 }), 'plaster')));
    const glassBack = { x0: 1250, x1: 4350, y1: 4600 };
    const backBase = kit(); backBase.box([750 + w / 2 - 250, 100, 12], [(-w / 2 + 750 - 250) / 2, 50, bz + 6]).box([w / 2 - 4850 - 250, 100, 12], [(w / 2 + 4850 + 250) / 2, 50, bz + 6]); base(back, backBase);
    room.walls.push({ obj: back, axis: 'x', limit: bz * s });
    // Right wall: glass slot with olive column, the desk bay, the tackboard, an olive pilaster.
    const right = new THREE.Group(); right.name = 'Humboldt commons tackboard wall'; root.add(right);
    const rightSeg = (z0, z1, y0 = 0, y1 = h) => box(right, [80, y1 - y0, z1 - z0], [w / 2 + 40, (y0 + y1) / 2, (z0 + z1) / 2], paint('#ebeae5', z1 - z0, y1 - y0));
    rightSeg(bz, -4800); rightSeg(-4800, -3200, SOFFIT, h); rightSeg(-3200, front);
    box(right, [500, SOFFIT, 500], [w / 2 - 300, SOFFIT / 2, -4450], olive);
    box(right, [450, SOFFIT, 600], [w / 2 - 225, SOFFIT / 2, 3700], olive);
    const tack = group('humboldt-tackboard', 'Tackboard wall', [0, 0, 0], right);
    for (let i = 0; i < 4; i++) {
        const z0 = -1000 + i * 900, map = tackMap.clone(); map.repeat.set(900 / 300, 2950 / 300); map.offset.set(rnd(i), rnd(i + 3));
        const panel = box(tack, [25, 2950, 897], [w / 2 - 32.5, 1925, z0 + 450], own(material('#ffffff', { map, roughness: .92 }))); panel.castShadow = false;
    }
    const tackTrim = kit(); tackTrim.box([30, 40, 3640], [w / 2 - 35, 450, 800]).box([30, 40, 3640], [w / 2 - 35, 3400, 800]).box([30, 2990, 40], [w / 2 - 35, 1925, -1020]).box([30, 2990, 40], [w / 2 - 35, 1925, 2620]);
    baked(tack, tackTrim, honeyOak, false);
    const rightBase = kit(); rightBase.box([12, 100, -4800 - bz], [w / 2 - 6, 50, (bz - 4800) / 2]).box([12, 100, front - -3200], [w / 2 - 6, 50, (front - 3200) / 2]); base(right, rightBase);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * s });
    // Left wall: plain wall, the mezzanine balcony with its guard, and the olive gallery wall with art.
    const left = new THREE.Group(); left.name = 'Humboldt mezzanine and gallery wall'; root.add(left);
    const leftSeg = (z0, z1, y0, y1, mat) => box(left, [80, y1 - y0, z1 - z0], [-w / 2 - 40, (y0 + y1) / 2, (z0 + z1) / 2], mat || paint('#ebeae5', z1 - z0, y1 - y0));
    leftSeg(bz, -1000, 0, h); leftSeg(-1000, 8400, 0, 3800); leftSeg(8400, CAFE_Z, 0, 3800, olive); leftSeg(CAFE_Z, front, 0, CAFE_SOFFIT, olive); leftSeg(CAFE_Z, front, CAFE_SOFFIT, h);
    leftSeg(-1000, CAFE_Z, 3800, 4200);
    // Mezzanine just outside the rectangle: floor slab, olive back wall, side walls and a ceiling.
    const mez = kit(); mez.box([3000, 400, CAFE_Z + 1000], [-w / 2 - 1500, 4000, (CAFE_Z - 1000) / 2]);
    baked(left, mez, whiteFlat);
    const mezFloor = broadloomMap.clone(); mezFloor.repeat.set(3000 / 512, (CAFE_Z + 1000) / 512);
    box(left, [3000, 6, CAFE_Z + 1000], [-w / 2 - 1500, 4203, (CAFE_Z - 1000) / 2], tag(own(material('#ffffff', { map: mezFloor, roughness: .96 })), 'fabric')).castShadow = false;
    box(left, [80, h - 4200, CAFE_Z + 1000], [-w / 2 - 3040, (h + 4200) / 2, (CAFE_Z - 1000) / 2], olive);
    for (const z of [-1000, CAFE_Z]) box(left, [3000, h - 4200, 80], [-w / 2 - 1500, (h + 4200) / 2, z + (z < 0 ? -40 : 40)], whiteFlat);
    box(left, [3080, 80, CAFE_Z + 1160], [-w / 2 - 1540, h + 40, (CAFE_Z - 1000) / 2], whiteFlat).castShadow = false;
    const guard = kit(), guardCap = kit();
    for (let z = -950; z <= CAFE_Z - 50; z += 1500) guard.box([50, 1070, 50], [-w / 2 + 50, 4200 + 535, z]);
    for (const y of [4250, 5200]) guard.box([10, 40, CAFE_Z + 1000 - 100], [-w / 2 + 50, y, (CAFE_Z - 1000) / 2]);
    for (let z = -900; z < CAFE_Z - 40; z += 100) guard.box([12, 950, 12], [-w / 2 + 50, 4725, z]);
    guardCap.box([80, 50, CAFE_Z + 1000 - 60], [-w / 2 + 50, 5245, (CAFE_Z - 1000) / 2]);
    baked(left, guard, bronze, false); baked(left, guardCap, honeyOak, false);
    // Generic framed landscape prints and a blank placard on the olive wall.
    const print = (seed, Wp, Hp) => canvasMap((c, cw, ch) => {
        const g = c.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, ['#c9d4d6', '#d8cfbd'][seed % 2]); g.addColorStop(1, '#f1ece0'); c.fillStyle = g; c.fillRect(0, 0, cw, ch);
        for (let band = 0; band < 4; band++) { c.fillStyle = ['#5f735e', '#3f5547', '#8a8f6b', '#2f4038'][(band + seed) % 4]; c.beginPath(); c.moveTo(0, ch); for (let x = 0; x <= cw; x += cw / 16) c.lineTo(x, ch * (.42 + band * .13) + Math.sin(x / cw * 6 + seed + band) * ch * .05); c.lineTo(cw, ch); c.fill(); }
    }, Wp, Hp);
    const art = (id, z, size, seed) => {
        const g = group(id, 'Framed landscape print', [-w / 2 + 20, 1600, z], left);
        box(g, [30, size[1] + 60, size[0] + 60], [0, 0, 0], own(material('#2b2622', { roughness: .6 })));
        box(g, [4, size[1], size[0]], [17, 0, 0], own(material('#ffffff', { map: print(seed, 512, Math.round(512 * size[1] / size[0])), roughness: .8 }))).castShadow = false;
    };
    art('humboldt-art-0', 9300, [900, 700], 1); art('humboldt-art-1', 10700, [600, 800], 2);
    box(left, [12, 150, 400], [-w / 2 + 6, 1250, 9950], own(material('#211a13', { roughness: .55, metalness: .3 }))).castShadow = false;
    // Gallery track under the balcony fascia, heads aimed at the white figures.
    const track = kit(), trackHeads = kit();
    track.box([35, 35, 3400], [-w / 2 + 60, 3780, 7000]);
    for (const z of [5900, 6450, 7000, 8100]) { track.cyl(8, 8, 90, [-w / 2 + 60, 3720, z], { seg: 6 }); trackHeads.cyl(45, 45, 150, [-w / 2 + 110, 3640, z], { rot: [0, 0, .9], seg: 14 }); }
    baked(left, track, frameBlack, false); baked(left, trackHeads, frameBlack, false);
    const trackLensKit = kit(); for (const z of [5900, 6450, 7000, 8100]) trackLensKit.cyl(38, 38, 4, [-w / 2 + 170, 3595, z], { rot: [0, 0, .9], seg: 14 });
    baked(left, trackLensKit, trackLens, false);
    const leftBase = kit(); leftBase.box([12, 100, front - bz], [-w / 2 + 6, 50, (bz + front) / 2]); base(left, leftBase);
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * s, sign: -1 });

    // ---------- Front: café soffit, curtain wall, upper fascia (cut away from outside) ----------
    const frontWall = new THREE.Group(); frontWall.name = 'Humboldt café curtain wall'; root.add(frontWall);
    box(frontWall, [w, 600, front - CAFE_Z], [0, CAFE_SOFFIT + 300, (CAFE_Z + front) / 2], whiteFlat).castShadow = false;
    const cafeCeiling = box(frontWall, [w, 4, front - CAFE_Z], [0, CAFE_SOFFIT - 2, (CAFE_Z + front) / 2], ceilingTile(w, front - CAFE_Z)); cafeCeiling.castShadow = false;
    box(frontWall, [w, h - CAFE_SOFFIT - 600, 80], [0, (h + CAFE_SOFFIT + 600) / 2, CAFE_Z - 40], paint('#ebeae5', w, h - CAFE_SOFFIT - 600)).castShadow = false;
    const mullions = kit(); for (let x = -w / 2 + 1500; x < w / 2; x += 1500) mullions.box([50, CAFE_SOFFIT, 150], [x, CAFE_SOFFIT / 2, front - 75]);
    mullions.box([w, 60, 150], [0, 2400, front - 75]).box([w, 40, 150], [0, CAFE_SOFFIT - 20, front - 75]);
    baked(frontWall, mullions, bronze, false);
    box(frontWall, [w, 300, 150], [0, 150, front - 200], plinthWhite).castShadow = false;
    room.walls.push({ obj: frontWall, axis: 'x', limit: front * s, sign: -1 });

    // ---------- Right soffit band and clerestory wall (hidden when the camera rises above it) ----------
    const soffit = new THREE.Group(); soffit.name = 'Humboldt soffit band'; root.add(soffit);
    box(soffit, [w / 2 - SOFFIT_X, 600, CAFE_Z - bz], [(w / 2 + SOFFIT_X) / 2, SOFFIT + 300, (bz + CAFE_Z) / 2], whiteFlat).castShadow = false;
    box(soffit, [w / 2 - SOFFIT_X, 4, CAFE_Z - bz], [(w / 2 + SOFFIT_X) / 2, SOFFIT - 2, (bz + CAFE_Z) / 2], ceilingTile(w / 2 - SOFFIT_X, CAFE_Z - bz)).castShadow = false;
    box(soffit, [80, h - SOFFIT - 600, CAFE_Z - bz], [SOFFIT_X - 40, (h + SOFFIT + 600) / 2, (bz + CAFE_Z) / 2], paint('#ebeae5', CAFE_Z - bz, h - SOFFIT - 600)).castShadow = false;
    const grilles = kit(); for (const z of [-3000, 2000, 7000]) grilles.box([10, 400, 600], [SOFFIT_X - 85, 5600, z]);
    baked(soffit, grilles, own(material('#d8d8d4', { roughness: .7 })), false);
    room.walls.push({ obj: soffit, axis: 'y', limit: (SOFFIT - 50) * s, sign: -1 });

    // ---------- Glazing with graded campus views ----------
    const view = canvasMap(() => {}, 1536, 1024), viewCanvas = view.image, campus = new Image(); let viewMode = 'morning';
    const drawView = modeId => { gradeWindow(viewCanvas.getContext('2d'), campus, modeId, HUMBOLDT_MODES[modeId] || HUMBOLDT_MODES.morning); view.needsUpdate = true; root.userData.humboldtWindow = { mode: modeId, source: 'procedural-north-coast' }; };
    room.windowViewReady = Promise.resolve();
    const glass = new THREE.MeshBasicMaterial({ map: view }); own(glass);
    // Each pane samples the view at its own aspect, so the tall slot and the long curtain wall are not stretched.
    view.wrapS = THREE.RepeatWrapping;
    const pane = (parent, size, at, rotY) => {
        const g = new THREE.PlaneGeometry(...size), uv = g.attributes.uv, span = size[0] / size[1] / (viewCanvas.width / viewCanvas.height);
        for (let i = 0; i < uv.count; i++) uv.setX(i, .5 + (uv.getX(i) - .5) * span);
        const p = mesh(parent, g, glass, at); p.rotation.y = rotY; p.castShadow = p.receiveShadow = false; return p;
    };
    pane(back, [glassBack.x1 - glassBack.x0, glassBack.y1], [(glassBack.x0 + glassBack.x1) / 2, glassBack.y1 / 2, bz - 30], 0);
    const bayFrame = kit(); for (const x of [glassBack.x0, 2280, 3320, glassBack.x1]) bayFrame.box([60, glassBack.y1, 150], [x, glassBack.y1 / 2, bz + 20]);
    for (const y of [40, 2400, glassBack.y1 - 30]) bayFrame.box([glassBack.x1 - glassBack.x0, 60, 150], [(glassBack.x0 + glassBack.x1) / 2, y, bz + 20]);
    baked(back, bayFrame, bronze, false);
    pane(right, [1600, SOFFIT], [w / 2 + 30, SOFFIT / 2, -4000], -Math.PI / 2);
    const slotFrame = kit(); for (const z of [-4800, -4000, -3200]) slotFrame.box([150, SOFFIT, 60], [w / 2 - 20, SOFFIT / 2, z]); slotFrame.box([150, 60, 1600], [w / 2 - 20, 30, -4000]);
    baked(right, slotFrame, bronze, false);
    // The long curtain wall reads as dusk glass, not a billboard, after dark.
    const frontGlass = own(glass.clone()); const frontPane = pane(frontWall, [w, CAFE_SOFFIT], [0, CAFE_SOFFIT / 2, front + 30], Math.PI); frontPane.material = frontGlass;

    // ---------- Suspended black light frames (two switching circuits) ----------
    const ceiling = new THREE.Group(); ceiling.name = 'Ceiling light frames'; root.add(ceiling); room.ceilingFixture = ceiling;
    const frameBody = kit(), lensKitA = kit(), lensKitB = kit(), bottom = 4200, barY = bottom + 150;
    const frames = [
        { id: 'F1', c: [1000, -800], size: [4800, 4800], grid: 2, circuit: 'A' },
        { id: 'F2', c: [-4800, -5000], size: [4800, 1800], grid: 1, circuit: 'B' },
        { id: 'F3', c: [-4000, 5800], size: [4800, 1800], grid: 1, circuit: 'B' }
    ];
    for (const f of frames) {
        const [cx, cz] = f.c, [sx, sz] = f.size, lk = f.circuit === 'A' ? lensKitA : lensKitB;
        const xs = f.grid === 2 ? [cx - sx / 2, cx, cx + sx / 2] : [cx - sx / 2, cx + sx / 2], zs = f.grid === 2 ? [cz - sz / 2, cz, cz + sz / 2] : [cz - sz / 2, cz + sz / 2];
        for (const z of zs) { frameBody.box([sx + 150, 300, 150], [cx, barY, z]); lk.box([sx, 4, 50], [cx, bottom - 2, z]); }
        for (const x of xs) { frameBody.box([150, 300, sz], [x, barY, cz]); lk.box([50, 4, sz], [x, bottom - 2, cz]); }
        for (const x of [cx - sx / 2, cx + sx / 2]) for (const z of [cz - sz / 2, cz + sz / 2]) { const top = slopeY(z); frameBody.cyl(3, 3, top - bottom - 300, [x, (top + bottom + 300) / 2, z], { seg: 5 }); }
    }
    baked(ceiling, frameBody, frameBlack, false); baked(ceiling, lensKitA, lensA, false); baked(ceiling, lensKitB, lensB, false);
    // Bright sloped plaster ceiling over the commons (hidden, like every 'Ceiling …' group, when the camera rises above it).
    const lid = new THREE.Group(); lid.name = 'Ceiling Humboldt sloped ceiling'; root.add(lid);
    const lidPaint = paint('#efeee9', SOFFIT_X + w / 2, 12000);
    const slopeLength = Math.hypot(SLOPE_Z - BACK, 2400), sloped = mesh(lid, new THREE.PlaneGeometry(SOFFIT_X + w / 2, slopeLength), lidPaint, [(SOFFIT_X - w / 2) / 2, (4800 + H) / 2, (BACK + SLOPE_Z) / 2]);
    sloped.rotation.x = Math.PI / 2 - SLOPE;
    const flat = mesh(lid, new THREE.PlaneGeometry(SOFFIT_X + w / 2, CAFE_Z - SLOPE_Z), lidPaint, [(SOFFIT_X - w / 2) / 2, H, (SLOPE_Z + CAFE_Z) / 2]); flat.rotation.x = Math.PI / 2;
    // Close the triangle between the slope and the mezzanine ceiling above the balcony opening.
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, slopeY(-1000), -1000, -w / 2, H, SLOPE_Z, -w / 2, H, -1000], 3)); tri.computeVertexNormals();
    mesh(lid, tri, own(material('#ebeae5', { roughness: .92, side: THREE.DoubleSide })));

    // ---------- Recessed downlights (one instanced draw per ceiling band) ----------
    const cans = [];
    for (const x of [5900, 7700]) for (const z of [-6200, -4400, -2600, -800, 1000, 2800, 4600, 6400, 8200, 10000]) cans.push([x, SOFFIT - 3, z, soffit]);
    cans.push([7700, SOFFIT - 3, -1700, soffit]);
    for (const z of [12200, 13400]) for (let x = -8100; x <= 8100; x += 1800) cans.push([x, CAFE_SOFFIT - 3, z, frontWall]);
    for (const parent of [soffit, frontWall]) {
        const list = cans.filter(c => c[3] === parent), inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(75, 75, 6, 20), canLens, list.length), t = new THREE.Object3D();
        list.forEach(([x, y, z], i) => { t.position.set(x, y, z); t.updateMatrix(); inst.setMatrixAt(i, t.matrix); });
        inst.castShadow = inst.receiveShadow = false; inst.name = 'Recessed downlights'; parent.add(inst);
    }
    // Linear grazer along the top of the high clerestory wall that faces the commons.
    const grazer = kit(); grazer.box([40, 30, CAFE_Z - bz - 400], [SOFFIT_X - 100, h - 60, (bz + CAFE_Z) / 2]); baked(soffit, grazer, grazerLens, false);

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
        k.cyl(450, 450, 30, [0, 735, 0], { seg: 32 }).cyl(70, 70, 40, [0, 705, 0]);
        for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2 + Math.PI / 4; k.box([45, 730, 45], [Math.cos(a) * 230, 360, Math.sin(a) * 230], { rot: [Math.sin(a) * .12, 0, -Math.cos(a) * .12] }); }
        k.add(new THREE.TorusGeometry(230, 12, 8, 32), [0, 260, 0], { rot: [Math.PI / 2, 0, 0] });
        baked(g, k, cafeOak); g.userData.roomSupportHeights = [750];
    }
    const side = group('humboldt-side-table', 'Round oak side table', [layout.sideTable[0], 0, layout.sideTable[1]]), sk = kit();
    sk.cyl(250, 250, 30, [0, 535, 0], { seg: 28 }).cyl(28, 34, 500, [0, 270, 0]).cyl(170, 190, 25, [0, 12, 0], { seg: 24 }); baked(side, sk, cafeOak);

    // ---------- Gallery: carved redwood canoe on a plinth, white figures ----------
    const canoeMap = canvasMap((c, Wc, Hc) => {
        c.fillStyle = '#8f5a38'; c.fillRect(0, 0, Wc, Hc);
        for (let row = 0; row < 12; row++) for (let i = 0; i < 26; i++) {
            const fw = 40 + rnd(row * 31 + i) * 30, fh = 14 + rnd(row * 17 + i) * 8, x = i * (Wc / 24) + (row % 2) * 20 + (rnd(row + i * 3) - .5) * 10, y = row * (Hc / 12) + fh / 2;
            const g = c.createLinearGradient(x - fw / 2, y, x + fw / 2, y); g.addColorStop(0, '#c08a5a30'); g.addColorStop(.55, '#00000000'); g.addColorStop(1, '#2a160c38');
            c.fillStyle = g; c.beginPath(); c.ellipse(x, y, fw / 2, fh / 2, (rnd(row * i) - .5) * .3, 0, Math.PI * 2); c.fill();
        }
        for (let i = 0; i < 60; i++) { c.strokeStyle = i % 2 ? '#3a1f1022' : '#d09a6a18'; const y = rnd(i * 4.1) * Hc; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(Wc * .3, y + 6, Wc * .7, y - 6, Wc, y); c.stroke(); }
        mottle(c, Wc, Hc, 14, 9, '#9a918838', '#00000000', 30, 90);
    }, 1024, 256);
    // Cylinder u runs around the girth; turn the map so grain and adze facets run along the hull.
    canoeMap.anisotropy = 4; canoeMap.center.set(.5, .5); canoeMap.rotation = Math.PI / 2;
    const canoe = group('humboldt-canoe', 'Carved redwood canoe on display', [-5000, 0, 8000], root, THREE.MathUtils.degToRad(6));
    canoe.userData.noSurfaceDrop = true;
    box(canoe, [1300, 450, 5600], [0, 225, 0], plinthWhite, 6);
        // A plain hand-hewn dugout: half-round shell, lofted toward raised, tapered ends.
    const taper = along => Math.max(.32, Math.cos(along * Math.PI / 2) ** .35), sheer = along => along * along * 220, HULL_Y = 1030;
    const hull = (radius, inset) => {
        const g = new THREE.CylinderGeometry(radius, radius, 5000, 28, 40, true, Math.PI / 2, Math.PI), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const along = p.getY(i) / 2500, t = taper(along);
            p.setXYZ(i, p.getX(i) * t, p.getZ(i) * t * 1.1 + sheer(along) + inset, p.getY(i));
        }
        g.computeVertexNormals(); return g;
    };
    // Two cradles whose tops meet the hull's keel line, so it rests rather than floats.
    const cradles = kit(); for (const z of [-1300, 1300]) { const a = z / 2500, top = HULL_Y - 450 * taper(a) * 1.1 + sheer(a); cradles.box([560, top - 450, 160], [0, (top + 450) / 2, z]); }
    baked(canoe, cradles, own(material('#3a2a20', { roughness: .6 })));
    // Swapping the cylinder's axes mirrors its winding, so both shells render double-sided.
    mesh(canoe, hull(450, 0), own(material('#ffffff', { map: canoeMap, roughness: .86, side: THREE.DoubleSide })), [0, HULL_Y, 0]);
    mesh(canoe, hull(415, -12), own(material('#5a3826', { map: canoeMap, roughness: .86, side: THREE.DoubleSide })), [0, HULL_Y, 0]);
    // Solid bow and stern blocks close the shell's ends; one plain seat block near the stern. No carving.
    const solid = own(material('#7a4a2d', { roughness: .86 })), ends = kit();
    // Rounded bow and stern: a lower half-ellipsoid closes each open end of the shell.
    for (const sign of [-1, 1]) { const t = taper(sign), half = 450 * t, depth = 450 * t * 1.1; ends.add(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, HULL_Y + sheer(1), sign * 2500], { scale: [half, depth, 260] }); }
    ends.box([520, 150, 240], [0, HULL_Y - 330, -1700]); baked(canoe, ends, solid);
    for (const [i, [z, ph, seated]] of [[5900, 1000, false], [7000, 450, true], [8100, 900, false]].entries()) {
        const g = group(`humboldt-sculpture-${i}`, 'White figure sculpture on plinth', [-w / 2 + 550, 0, z], root, Math.PI / 2), k = kit();
        box(g, [600, ph, 600], [0, ph / 2, 0], plinthWhite, 4);
        const head = (y, lean = 0) => k.add(new THREE.BoxGeometry(170, 230, 190, 2, 2, 2), [0, y, 10], { rot: [lean, 0, 0], scale: [1, 1, 1] });
        if (seated) {
            // Seat, thighs forward, upright torso and a tall straight back slab.
            k.box([420, 420, 420], [0, ph + 210, -40]).box([300, 140, 380], [0, ph + 490, 110]).box([340, 600, 220], [0, ph + 720, -60], { rot: [-.05, 0, 0] }).box([420, 1000, 80], [0, ph + 920, -230]);
            head(ph + 1150, -.06);
        } else {
            // Two leg slabs, a slightly turned torso and a squared head.
            for (const x of [-85, 85]) k.box([140, 700, 120], [x, ph + 350, 0]);
            k.box([340, 560, 200], [0, ph + 980, 0], { rot: [.06, .07, 0] }); head(ph + 1400, .04);
        }
        baked(g, k, sculptureWhite);
    }

    // ---------- Exit sign ----------
    const exitMap = canvasMap((c, cw, ch) => { c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#ff3b2f'; c.font = 'bold 74px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT', cw / 2, ch / 2 + 4); }, 256, 128);
    const exit = box(frontWall, [300, 160, 40], [-7600, CAFE_SOFFIT - 120, CAFE_Z + 60], own(new THREE.MeshStandardMaterial({ color: '#ffffff', map: exitMap, emissive: '#ff2a1f', emissiveMap: exitMap, emissiveIntensity: 1.2, toneMapped: false })));
    exit.castShadow = false;

    // ---------- Light pools: scallops, floor pools, cork and desk accents ----------
    const pools = createPoolLayer(root, 'Humboldt architectural light');
    const merged = (quads, face) => { const k = kit(); for (const [size, at] of quads) k.plane(size, at, { rot: face }); return k.build(); };
    const FLOOR = [-Math.PI / 2, 0, 0], BACKF = [0, 0, 0], RIGHTF = [0, -Math.PI / 2, 0], LEFTF = [0, Math.PI / 2, 0];
    const addMerged = (parent, quads, face, color, levels) => pools.add(parent, [0, 0, 0], [1, 1], color, levels, [0, 0, 0], merged(quads, face));
    // Back-wall washer scallops (apex + long tail), avoiding the glass bay.
    const backScallops = [[-6600, 4800], [-3400, 4800], [-200, 4800], [7000, SOFFIT]];
    addMerged(back, backScallops.map(([x, top]) => [[900, 640], [x, top - 520, bz + 6]]), BACKF, T3500, [.08, .07, .24, .2, .26]);
    addMerged(back, backScallops.map(([x, top]) => [[1250, 2600], [x, top - 1500, bz + 6]]), BACKF, T3500, [.06, .05, .17, .14, .18]);
    // Right-wall scallops phased to the desk; the desk's own scallop stays up at night.
    const rightScallops = [DESK[1] - 3600, DESK[1] + 5400, DESK[1] + 7200, DESK[1] + 9000].filter(z => z > bz + 400 && z < CAFE_Z - 400 && (z < -1000 || z > 2700));
    addMerged(right, rightScallops.map(z => [[900, 640], [w / 2 - 6, SOFFIT - 520, z]]), RIGHTF, T3500, [.08, .07, .24, .2, .26]);
    addMerged(right, rightScallops.map(z => [[1250, 2100], [w / 2 - 6, SOFFIT - 1300, z]]), RIGHTF, T3500, [.06, .05, .17, .14, .18]);
    pools.add(right, [w / 2 - 6, SOFFIT - 520, DESK[1]], [780, 600], T4000, [.05, .045, .14, .17, .13], 'right');
    pools.add(right, [w / 2 - 6, SOFFIT - 1300, DESK[1]], [1300, 2100], T4000, [.025, .02, .07, .09, .07], 'right');
    // Tackboard: three scallops across the panel; cork is dark, so it takes more.
    addMerged(tack, [-350, 800, 1950].map(z => [[900, 620], [w / 2 - 50, 3400 - 250, z]]), RIGHTF, T3500, [.06, .05, .16, .16, .18]);
    addMerged(tack, [-350, 800, 1950].map(z => [[1300, 2100], [w / 2 - 50, 3400 - 1250, z]]), RIGHTF, T3500, [.04, .04, .12, .12, .13]);
    // Top grazer down the high right wall.
    const grazeQuads = []; for (let z = bz + 1200; z < CAFE_Z - 800; z += 1600) grazeQuads.push([[2600, 1500], [SOFFIT_X - 86, h - 650, z]]);
    addMerged(soffit, grazeQuads, RIGHTF, T3500, [.08, .06, .24, .12, .26]);
    // Floor pools: frames by circuit, downlights, the desk, the collection.
    // Frame uplight lands on the ceiling: the bright lid of the reference photos.
    const lidPool = circuit => { const k = kit(); for (const f of frames.filter(f => f.circuit === circuit)) k.plane([f.size[0] + 2600, f.size[1] + 2600], [f.c[0], slopeY(f.c[1]) - 8, f.c[1]], { rot: [Math.PI / 2 - (f.c[1] < SLOPE_Z ? SLOPE : 0), 0, 0] }); return k.build(); };
    pools.add(lid, [0, 0, 0], [1, 1], T3500, [.08, .07, .22, .18, .24], [0, 0, 0], lidPool('A'));
    pools.add(lid, [0, 0, 0], [1, 1], T3500, [.08, .07, .22, .02, .24], [0, 0, 0], lidPool('B'));
    const frameFloor = circuit => frames.filter(f => f.circuit === circuit).map(f => [[f.size[0] + 1600, f.size[1] + 1600], [f.c[0], 3, f.c[1]]]);
    addMerged(root, frameFloor('A'), FLOOR, T3500, [.05, .05, .15, .13, .17]);
    addMerged(root, frameFloor('B'), FLOOR, T3500, [.05, .05, .15, 0, .17]);
    // Café cans sit near the glass, so their pools stay small enough to end at the floor edge.
    addMerged(root, cans.filter(([x, , z]) => Math.abs(x - w / 2) > 1000 && Math.abs(z - DESK[1]) > 700 && z < CAFE_Z).map(([x, , z]) => [[2200, 2200], [x, 3, z]]), FLOOR, T3500, [.04, .04, .11, .09, .1]);
    addMerged(root, cans.filter(([, , z]) => z > CAFE_Z).map(([x, , z]) => [[1400, 1400], [x, 3, z]]), FLOOR, T3500, [.03, .03, .08, .07, .08]);
    pools.add(root, [DESK[0] - 300, 3, DESK[1]], [2000, 1700], T3500, [.03, .03, .1, .13, .09]);
    pools.add(root, [2800, 3, -5000], [5200, 4200], '#e6edf0', [.16, .2, .04, 0, 0]);
    pools.add(root, [8000, 3, -4000], [2400, 2000], '#e6edf0', [.12, .14, .03, 0, 0]);
    pools.add(root, [0, 3, 12600], [18000, 2600], '#e6edf0', [.1, .12, .02, 0, 0]);
    // The slot column sits under the soffit with no other light reaching it.
    pools.add(root, [8450, 3, -4450], [1400, 1400], T3500, [.04, .04, .11, .09, .1]);
    pools.add(canoe, [0, HULL_Y - 470, 0], [600, 2600], T3000, [.02, .02, .08, .07, .16]);
    pools.add(canoe, [0, 5, 0], [1700, 4200], T3000, [.03, .03, .1, .08, .24]);
    addMerged(left, [5900, 7000, 8100].map(z => [[700, 1500], [-w / 2 + 6, 1900, z]]), LEFTF, T3000, [.04, .04, .14, .1, .32]);
    addMerged(root, [5900, 7000, 8100].map(z => [[1300, 1300], [-w / 2 + 550, 3, z]]), FLOOR, T3000, [.03, .03, .08, .06, .12]);
    pools.add(frontWall, [-7600, CAFE_SOFFIT - 300, CAFE_Z + 4], [600, 400], '#ff4a3a', [0, 0, .02, .04, .03], 'back');

    // ---------- Real lights: exactly five, no shadows ----------
    const lights = [
        { at: [DESK[0] - 700, 2600, DESK[1]], task: true, power: 4.5, range: 3400 },
        { at: [1000, 3250, -800], task: false, power: 11.8, range: d * .8 },
        { at: [-3900, 2400, -5200], task: true, power: 5, range: 4200 },
        { at: [-6300, 3000, 7400], task: false, power: 3, range: 5000, color: T3000 },
        { at: [-5600, 2400, 1000], task: true, secondary: true, power: 5, range: 3600 }
    ].map(spec => { const light = new THREE.PointLight('#ffe7cc', 0, spec.range * s, 2); light.position.set(...spec.at); light.castShadow = false; root.add(light); return { ...spec, light, power: spec.power * (s * 1000) ** 2 }; });

    // ---------- Props: lounge finishes, recycling blue, chair upholstery ----------
    room.propReplacements = { 'kenney-furniture-chair-modern-cushion': { id: 'ergoflex-designer-chair', scale: .82 } };
    const cache = new Map();
    const ownCopy = (source, key, finish) => { const id = source.uuid + ':' + key; if (!cache.has(id)) { const m = source.clone(); finish(m); m.userData.roomPaletteLocked = true; own(m); cache.set(id, m); } return cache.get(id); };
    const recolour = (object, key, pick) => object.traverse(o => { if (!o.isMesh) return; const swap = m => { const f = m?.isMeshStandardMaterial && pick(m); return f ? ownCopy(m, key, f) : m; }; o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); });
    const tint = (color, roughness, metalness = 0, sheen) => m => { m.color.set(color); m.roughness = roughness; m.metalness = metalness; if (m.sheenColor) m.sheenColor.set(sheen || color); };
    room.decorateProp = (object, placement) => {
        // Side chairs: honey-oak frame, dark aubergine-charcoal pads (photos).
        if (object.userData.conferenceChair) return recolour(object, 'reading', m => {
            const part = m.userData?.conferencePart; return part === 'shell' || part === 'upholstery' ? tint('#3a3540', .9, 0, '#5a5262') : part === 'frame' ? tint('#9a6a3c', .5) : null;
        });
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
        viewMode = modeId; drawView(modeId); frontGlass.color.set(modeId === 'evening' ? '#5a5a5a' : '#ffffff');
        lensA.emissiveIntensity = (.06 + mode.wash * .35) * accent; lensB.emissiveIntensity = night ? .04 : lensA.emissiveIntensity;
        canLens.emissiveIntensity = (.25 + mode.wash * 1.1) * accent; trackLens.emissiveIntensity = (.2 + mode.wash * 1.3) * accent;
        grazerLens.emissiveIntensity = (.15 + mode.wash * .9) * accent * (night ? .5 : 1);
        pools.apply(modeId, accent);
        lights.forEach(spec => {
            spec.light.color.set(spec.color || (spec.task ? mode.colors[0] : mode.colors[1]));
            spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent * (night && spec.secondary ? .28 : 1);
        });
        root.userData.atmosphere = modeId; root.userData.humboldtCircuits = { A: true, B: !night };
    };
    // VSM shadow maps also draw shadow *receivers*, so a non-casting fixture that
    // still receives (frames, soffits, glass, trim) would print onto the floor.
    // The floors keep receiving: they sit below everything.
    root.traverse(o => { if (o.isMesh && !o.castShadow && !o.userData.humboldtFloor && !o.userData.lightPool) o.receiveShadow = false; });
    // The shell stays out of the shadow pass entirely: daylight reads as
    // entering through the glass bay and clerestory rather than the 7.2 m back
    // wall shading the whole commons. Furniture, plinths and the canoe still cast.
    for (const shell of [back, right, left, frontWall, soffit, lid]) shell.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    room.roomAtmosphere('morning');
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
    root.userData.humboldtCommons = { desk: DESK, deskTurn: layout.deskTurn, frames: frames.length, downlights: cans.length, lights: lights.length };
}
