import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=asset-packs-20261001';

// Interior dimensions in millimetres. Room choice and desk size are independent.
const names = ['Apartment art nook', 'Home artist studio', 'Drawing & painting studio', 'Artist atelier & lounge', 'Fine art & making suite'];
export const ARTIST_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home, front = back + depth;
    const compact = index === 0, large = index >= 3;
    const desk = [compact ? -80 : -200, back + 850];
    const cabinet = [width / 2 - 310, back + 1430];
    const easel = [-width / 2 + 670, front - (large ? 2100 : 740)];
    const table = [-width / 2 + 770, front - 880];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: 'paper-bin', at: [width / 2 - 250, 0, back + 2360] },
        { id: 'kenney-furniture-potted-plant', at: [-width / 2 + 250, 0, back + 290] },
        { id: 'kenney-furniture-books', at: [width / 2 - 165, 1524, back + 1190], turn: -90 },
        { id: 'kenney-furniture-plant-small1', at: [width / 2 - 160, 1524, back + 1770] }
    ];
    if (!compact) props.push({ id: 'printer-3d', at: [cabinet[0], 900, cabinet[1] + 180], turn: -90 });
    if (index === 2) props.push(
        { id: 'armchair-poppi', at: [width / 2 - 650, 0, front - 590], turn: -15 },
        { id: 'coffee-table-2', at: [width / 2 - 650, 0, front - 1360] },
        { id: 'tea-cup', at: [width / 2 - 650, 700, front - 1360] }
    );
    if (large) props.push(
        { id: 'kenney-furniture-lounge-sofa', at: [650, 0, front - 490] },
        { id: 'coffee-table', at: [650, 0, front - 1490] },
        { id: 'sketchbook', at: [470, 391.2, front - 1510], turn: -8 },
        { id: 'antique-vase', at: [970, 391.2, front - 1480] },
        { id: 'papers', at: [table[0], 910, table[1] - 330], turn: 90 },
        { id: 'ruler-set-square', at: [table[0] + 160, 910, table[1] + 170], turn: 90 },
        { id: 'long-scissors', at: [table[0] - 150, 910, table[1] + 190], turn: 20 },
        { id: 'monstera', at: [width / 2 - 480, 0, back + 460] }
    );
    return [id, { id, name: names[index], width, depth, height, back, desk, cabinet, easel, table,
        compact, large, sculpture: index === 4, props, daylight: [-width / 2 + 100, 400] }];
}));
export const artistLayoutById = id => ARTIST_LAYOUTS[id] || ARTIST_LAYOUTS.apartment;
export const artistLayoutForSize = size => ARTIST_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

// North light atelier: cool, even daylight by day; picture lights, a paper
// lantern and a festoon string carry the evening, night and open-studio looks.
export const ARTIST_MODES = {
    morning: { label: 'Morning', description: 'Soft window light · standing sketch warm-up', key: '#fff0dd', fill: '#dce8f4', accent: '#efd6b4', power: 1.55, ambient: .5, bounce: .72, exposure: 1.05, sky: ['#9fc2da', '#f5e1c6'], practical: .14, wash: .1, colors: ['#f2d8b4', '#c9dbd4'], height: 43.5, tilt: 12, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Balanced daylight · seated drawing and color studies', key: '#fbf6ee', fill: '#dfe9f3', accent: '#e9d4b2', power: 1.3, ambient: .48, bounce: .7, exposure: 1.05, sky: ['#8fb6d5', '#e7eef1'], practical: .3, wash: .18, colors: ['#eed4b0', '#c3d4d2'], height: 28, tilt: 18, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden-hour painting · standing drawing angle', key: '#ffc994', fill: '#cdd7e8', accent: '#ffb27c', power: .9, ambient: .3, bounce: .44, exposure: 1.08, sky: ['#6c78a6', '#f2aa79'], practical: .8, wash: .5, colors: ['#ffc98f', '#c8b6cc'], height: 43.5, tilt: 30, offset: [0, 80], yaw: -4, leds: true, color: '#ffe1b0' },
    night: { label: 'Night', description: 'Quiet making · neutral task light with gentle accents', key: '#c4d1e6', fill: '#c2d0e5', accent: '#f3c995', power: .2, ambient: .19, bounce: .26, exposure: 1.08, sky: ['#0f1a2e', '#33435f'], practical: .9, wash: .26, colors: ['#f6d2a2', '#a3b7d2'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#fff1d5' },
    party: { label: 'Open studio', description: 'Share your work · standing desk turned toward visitors', key: '#f1dccb', fill: '#d8dce8', accent: '#ee9f7e', power: .5, ambient: .3, bounce: .42, exposure: 1.1, sky: ['#3f4567', '#bb8574'], practical: .7, wash: .95, colors: ['#ffbf8f', '#a3d4cd'], height: 43.5, tilt: 0, offset: [80, 230], yaw: -12, leds: true, color: '#ffcfac' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

// Seeded, so every rebuild paints the same studio.
const random = (seed = 1) => { let s = Math.abs(Math.floor(seed * 9973)) % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const byte = v => Math.max(0, Math.min(255, Math.round(v)));
const ellipse = (c, x, y, rx, ry, turn = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), turn, 0, Math.PI * 2); c.fill(); };

// Loose oil-paint dabs sampled from the underpainting read as brushwork
// rather than flat vector shapes, at no geometry cost.
function brushwork(c, x0, y0, w, h, rnd, count, size = 1) {
    const data = c.getImageData(x0, y0, w, h).data;
    for (let i = 0; i < count; i++) {
        const x = rnd() * w, y = rnd() * h, k = ((y | 0) * w + (x | 0)) * 4, shade = (rnd() - .5) * 36;
        c.fillStyle = `rgba(${byte(data[k] + shade)},${byte(data[k + 1] + shade)},${byte(data[k + 2] + shade * 1.1)},${.5 + rnd() * .4})`;
        ellipse(c, x0 + x, y0 + y, (4 + rnd() * 9) * size, (1.4 + rnd() * 2.4) * size, rnd() * Math.PI);
    }
}

// Original artworks drawn in a w×h box. Paintings get brushwork afterwards;
// paper studies stay crisp.
const ART = {
    landscape(c, w, h, rnd) {
        const sky = c.createLinearGradient(0, 0, 0, h * .62);
        sky.addColorStop(0, ['#9db4c6', '#c4b6a6', '#a4bdc1'][Math.floor(rnd() * 3)]); sky.addColorStop(1, '#f0e2c6');
        c.fillStyle = sky; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,250,240,.55)';
        for (let i = 0; i < 6; i++) ellipse(c, rnd() * w, h * (.08 + rnd() * .25), w * (.1 + rnd() * .16), h * (.018 + rnd() * .02));
        ['#93a3a4', '#6f8070', '#8c8657'].forEach((color, b) => {
            const base = h * (.5 + b * .12); c.fillStyle = color; c.beginPath(); c.moveTo(0, h); c.lineTo(0, base);
            for (let x = 0; x <= w + 1; x += w / 10) c.lineTo(x, base - Math.sin(x / w * 5 + b * 2.3 + rnd()) * h * .035 - rnd() * h * .02);
            c.lineTo(w, h); c.fill();
        });
        c.fillStyle = '#c69a58'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * .82); c.quadraticCurveTo(w * .5, h * .74, w, h * .86); c.lineTo(w, h); c.fill();
        c.fillStyle = '#3f5144';
        for (let i = 0; i < 4; i++) { const x = w * (.12 + rnd() * .76), y = h * (.6 + rnd() * .1); ellipse(c, x, y, w * .035, h * .06); c.fillRect(x - 1.5, y, 3, h * .07); }
    },
    still(c, w, h, rnd) {
        c.fillStyle = ['#4f4840', '#5b5a52', '#6a5547'][Math.floor(rnd() * 3)]; c.fillRect(0, 0, w, h);
        const g = c.createRadialGradient(w * .3, h * .3, 0, w * .3, h * .3, w * .8); g.addColorStop(0, 'rgba(255,230,190,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#7d5c3e'; c.fillRect(0, h * .64, w, h * .36);
        c.fillStyle = '#e8e0cf'; c.beginPath(); c.moveTo(w * .1, h * .64); c.lineTo(w * .7, h * .64); c.lineTo(w * .82, h); c.lineTo(w * .02, h); c.fill();
        c.fillStyle = '#c9c0ac'; ellipse(c, w * .42, h * .5, w * .15, h * .17); c.fillRect(w * .37, h * .26, w * .1, h * .16); ellipse(c, w * .42, h * .26, w * .07, h * .02);
        c.fillStyle = 'rgba(255,255,245,.6)'; ellipse(c, w * .37, h * .45, w * .025, h * .06);
        for (const [x, y, color] of [[.66, .66, '#e2b543'], [.75, .7, '#d9a93a'], [.22, .68, '#a8a75a'], [.58, .73, '#b8553f']]) {
            c.fillStyle = 'rgba(30,20,10,.35)'; ellipse(c, w * (x + .02), h * (y + .035), w * .07, h * .02);
            c.fillStyle = color; ellipse(c, w * x, h * y, w * .065, h * .05, rnd() - .5);
            c.fillStyle = 'rgba(255,250,230,.55)'; ellipse(c, w * (x - .02), h * (y - .02), w * .012, h * .008);
        }
    },
    field(c, w, h, rnd) {
        const sets = [['#a24f3c', '#d99a5c', '#3e3530'], ['#3d5566', '#9db0aa', '#d8c9a2'], ['#6b6f4c', '#c7a45c', '#2f3a3c']];
        const [base, top, low] = sets[Math.floor(rnd() * 3)];
        c.fillStyle = base; c.fillRect(0, 0, w, h);
        for (let l = 0; l < 7; l++) {
            c.fillStyle = l % 2 ? top : low; c.globalAlpha = .22;
            const y = l % 2 ? h * .08 : h * .58;
            c.fillRect(w * .08 + rnd() * 8, y + rnd() * 8, w * .84 - rnd() * 14, h * (l % 2 ? .4 : .32) - rnd() * 10);
        }
        c.globalAlpha = 1;
    },
    portrait(c, w, h, rnd) {
        c.fillStyle = ['#6f7f78', '#8a6d58', '#4e5a66'][Math.floor(rnd() * 3)]; c.fillRect(0, 0, w, h);
        c.fillStyle = '#2f2a28'; ellipse(c, w * .5, h * .95, w * .42, h * .28);
        c.fillStyle = '#c49276'; c.fillRect(w * .44, h * .5, w * .12, h * .18);
        ellipse(c, w * .5, h * .4, w * .17, h * .17);
        c.fillStyle = '#3a2a22'; ellipse(c, w * .5, h * .3, w * .2, h * .12); ellipse(c, w * .36, h * .4, w * .06, h * .13);
        c.fillStyle = 'rgba(255,225,200,.35)'; ellipse(c, w * .56, h * .4, w * .06, h * .1);
    },
    figure(c, w, h, rnd) {
        c.fillStyle = '#efe8da'; c.fillRect(0, 0, w, h);
        c.lineCap = 'round';
        for (let pass = 0; pass < 3; pass++) {
            c.strokeStyle = `rgba(38,34,30,${.25 + pass * .18})`; c.lineWidth = Math.max(1, w / 120) * (1 + pass * .4);
            const j = () => (rnd() - .5) * w * .03, cxp = w * (.45 + rnd() * .1);
            c.beginPath(); c.ellipse(cxp + j(), h * .16, w * .06, h * .055, 0, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(cxp, h * .22); c.bezierCurveTo(cxp + w * .12 + j(), h * .38, cxp - w * .1 + j(), h * .5, cxp + j(), h * .58); c.stroke();
            c.beginPath(); c.moveTo(cxp - w * .14, h * .27); c.quadraticCurveTo(cxp - w * .26 + j(), h * .42, cxp - w * .2, h * .54); c.moveTo(cxp + w * .12, h * .27); c.quadraticCurveTo(cxp + w * .2 + j(), h * .35, cxp + w * .3, h * .3); c.stroke();
            c.beginPath(); c.moveTo(cxp - w * .06, h * .58); c.lineTo(cxp - w * .16 + j(), h * .9); c.moveTo(cxp + w * .06, h * .58); c.quadraticCurveTo(cxp + w * .2, h * .74, cxp + w * .12 + j(), h * .92); c.stroke();
        }
        const g = c.createRadialGradient(w * .55, h * .5, 0, w * .55, h * .5, w * .5); g.addColorStop(0, 'rgba(60,55,50,.12)'); g.addColorStop(1, 'rgba(60,55,50,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    },
    botanical(c, w, h, rnd) {
        c.fillStyle = '#f1ebdd'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#4f5a3f'; c.lineWidth = Math.max(1, w / 160);
        c.beginPath(); c.moveTo(w * .5, h * .92); c.quadraticCurveTo(w * .46, h * .5, w * .55, h * .1); c.stroke();
        for (let i = 0; i < 7; i++) {
            const y = h * (.2 + i * .1), side = i % 2 ? 1 : -1, x = w * (.5 + side * .02);
            c.fillStyle = `rgba(${110 + rnd() * 40},${140 + rnd() * 30},90,.45)`;
            c.save(); c.translate(x, y); c.rotate(side * (.7 + rnd() * .3)); ellipse(c, 0, -h * .06, w * .07, h * .07); c.restore();
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * w * .15, y - h * .07); c.stroke();
        }
        c.fillStyle = '#b8574a'; ellipse(c, w * .55, h * .1, w * .05, h * .035);
    },
    swatch(c, w, h, rnd) {
        c.fillStyle = '#f2ede2'; c.fillRect(0, 0, w, h);
        const colors = ['#b6503d', '#d79a4b', '#e5c766', '#7f9a6b', '#4d7b7a', '#3d5577', '#6d4f6f', '#8b5e3c', '#d4cbb8', '#2f302f', '#c97e72', '#9db5b0'];
        colors.forEach((color, i) => {
            const x = w * (.1 + (i % 3) * .28), y = h * (.08 + Math.floor(i / 3) * .22);
            c.fillStyle = color; c.fillRect(x + rnd() * 3, y + rnd() * 3, w * .22, h * .14);
            c.fillStyle = 'rgba(60,55,50,.4)'; c.fillRect(x, y + h * .165, w * .16, 1.5);
        });
    },
    wheel(c, w, h) {
        c.fillStyle = '#f2ede2'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 12; i++) {
            c.fillStyle = `hsl(${i * 30},${48}%,${52}%)`; c.beginPath(); c.moveTo(w / 2, h / 2);
            c.arc(w / 2, h / 2, w * .4, i / 12 * Math.PI * 2, (i + 1) / 12 * Math.PI * 2); c.fill();
        }
        c.fillStyle = '#f2ede2'; ellipse(c, w / 2, h / 2, w * .15, w * .15);
    },
    unfinished(c, w, h, rnd) {
        // Burnt-sienna ground with charcoal drawing; the left of the canvas is
        // already blocked in.
        c.fillStyle = '#b77a55'; c.fillRect(0, 0, w, h);
        c.save(); c.beginPath(); c.rect(0, 0, w * .62, h); c.clip(); ART.still(c, w, h, rnd); c.restore();
        c.strokeStyle = 'rgba(40,30,25,.7)'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(w * .66, h * .66, w * .065, h * .05, 0, 0, Math.PI * 2); c.moveTo(w * .62, h * .64); c.lineTo(w * .82, h * .64); c.lineTo(w * .82, h); c.stroke();
        c.beginPath(); c.ellipse(w * .75, h * .7, w * .065, h * .05, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(255,240,220,.18)'; c.fillRect(w * .62, 0, 3, h);
    }
};
const PAINTED = new Set(['landscape', 'still', 'field', 'portrait', 'unfinished']);

// Original paintings, generated once per scene; no remote image requests.
function painting(seed = 0) {
    const kind = ['landscape', 'still', 'field', 'unfinished', 'portrait'][seed % 5];
    return texture((c, w, h) => {
        const rnd = random(seed + 3);
        ART[kind](c, w, h, rnd); brushwork(c, 0, 0, w, h, rnd, 2600, 1.2);
        // Subtle canvas weave, not a glossy screen.
        c.strokeStyle = '#4d433814'; c.lineWidth = .6;
        for (let i = 0; i < Math.max(w, h); i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    }, 512, 640);
}

// Sixteen small studies on one 1024 px sheet. Pinned sketches, leaning
// canvases and the picture ledge all sample it, so they share one material.
const ATLAS_KINDS = ['figure', 'landscape', 'botanical', 'still', 'portrait', 'swatch', 'wheel', 'figure', 'landscape', 'field', 'botanical', 'portrait', 'still', 'figure', 'field', 'landscape'];
function studies() {
    return texture((c, w) => {
        const cell = w / 4;
        ATLAS_KINDS.forEach((kind, i) => {
            const x = (i % 4) * cell, y = Math.floor(i / 4) * cell, rnd = random(i * 7 + 11);
            c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, cell, cell); c.clip();
            ART[kind](c, cell, cell, rnd); c.restore();
            if (PAINTED.has(kind)) brushwork(c, x, y, cell, cell, rnd, 420, .7);
        });
    }, 1024, 1024);
}

export function buildArtistRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, cabinet: [cx, cz] } = layout, front = bz + d;
    const oak = material('#b8996f', { roughness: .78 }), chalk = material('#ebe6da', { roughness: .95 });
    const clay = material('#b06d55', { roughness: .85 }), blue = material('#5f7b81', { roughness: .85 });
    const metal = material('#4a5150', { metalness: .45, roughness: .55 });
    const sage = material('#7e8c82', { roughness: .7 }), brass = material('#b8975c', { metalness: .75, roughness: .32 });
    const cast = material('#f2eee5', { roughness: .9 }), glass = material('#cdd8d5', { roughness: .1, metalness: .05 });
    const linen = material('#efe7d8', { roughness: 1, side: THREE.DoubleSide });
    // White bases for instanced batches; each instance carries its own colour.
    const tint = material('#ffffff', { roughness: .78 }), gloss = material('#ffffff', { roughness: .3 });
    const leafy = material('#ffffff', { roughness: .6, side: THREE.DoubleSide });
    const register = (group, id, name) => {
        group.userData.propId = id; group.userData.sceneAssetName = name;
        markSceneAsset(group, { key: `creative:${layout.id}:fixture:${id}` });
    };
    const group = (parent, name, at = [0, 0, 0], turn = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); return g; };
    const flat = obj => { obj.castShadow = false; return obj; };

    // Repeated dressing is instanced: one draw call per batch. The batch sits
    // at its instances' centroid so tools reading base geometry bounds still
    // see it in the right place.
    const unit = new THREE.BoxGeometry(1, 1, 1), tube = new THREE.CylinderGeometry(1, 1, 1, 12), ball = new THREE.SphereGeometry(1, 12, 8);
    const up = new THREE.Vector3(0, 1, 0), euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), matrix = new THREE.Matrix4();
    const at = new THREE.Vector3(), size = new THREE.Vector3(), colour = new THREE.Color();
    const instanced = (parent, geometry, mat, items, shadow = true) => {
        const obj = new THREE.InstancedMesh(geometry, mat, items.length);
        items.forEach(item => obj.position.add(at.set(...item.at))); obj.position.divideScalar(items.length);
        items.forEach((item, i) => {
            if (item.q) quat.copy(item.q); else quat.setFromEuler(euler.set(...(item.rot || [0, 0, 0])));
            matrix.compose(at.set(...item.at).sub(obj.position), quat, size.set(...(item.size || [1, 1, 1])));
            obj.setMatrixAt(i, matrix); obj.setColorAt(i, colour.set(item.color || '#ffffff'));
        });
        obj.instanceMatrix.needsUpdate = true; obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    // A cylinder instance spanning two points.
    const stick = (from, to, radius, color) => {
        const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a), length = delta.length();
        return { at: a.add(b).multiplyScalar(.5).toArray(), q: new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()), size: [radius, length, radius], color };
    };
    // Leaves are flattened ellipsoids pointing along their stem direction.
    const GREENS = ['#4f6f45', '#5e7f4f', '#3f5f3d', '#6e8b55', '#47663f'];
    const leaf = (items, base, dir, length, width, color) => {
        const n = new THREE.Vector3(...dir).normalize();
        items.push({ at: [base[0] + n.x * length / 2, base[1] + n.y * length / 2, base[2] + n.z * length / 2], q: new THREE.Quaternion().setFromUnitVectors(up, n), size: [width / 2, length / 2, 5], color });
    };
    // Flat artwork cards sampling the shared studies sheet, merged into a
    // single mesh. Each card is cropped to its own aspect ratio.
    const sheet = material('#ffffff', { map: studies(), roughness: .95 });
    const cards = (parent, items) => {
        const pos = [], nor = [], uv = [], index = [], n = new THREE.Vector3(), v = new THREE.Vector3(), cell = .25;
        items.forEach((item, k) => {
            matrix.compose(at.set(...item.at), quat.setFromEuler(euler.set(...(item.rot || [0, 0, 0]))), size.set(1, 1, 1));
            const [cw, ch] = item.size, su = (cw < ch ? cell * cw / ch : cell) - .006, sv = (ch < cw ? cell * ch / cw : cell) - .006;
            const u0 = (item.cell % 4) * cell + (cell - su) / 2, v0 = 1 - (Math.floor(item.cell / 4) + 1) * cell + (cell - sv) / 2;
            n.set(0, 0, 1).transformDirection(matrix);
            for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                v.set((sx - .5) * cw, (sy - .5) * ch, 0).applyMatrix4(matrix); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z);
                uv.push(u0 + sx * su, v0 + sy * sv);
            }
            const b = k * 4; index.push(b, b + 1, b + 2, b, b + 2, b + 3);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index);
        return flat(mesh(parent, geometry, sheet));
    };

    // Limewashed plaster: broad soft clouding plus a fine speckle.
    const plaster = texture((c, tw, th) => {
        const rnd = random(2); c.fillStyle = '#ede7db'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 24; i++) {
            const x = rnd() * tw, y = rnd() * th, r = 50 + rnd() * 90;
            for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) {
                const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
                g.addColorStop(0, i % 2 ? 'rgba(255,253,247,.07)' : 'rgba(170,150,120,.01)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
            }
        }
        for (let i = 0; i < 2000; i++) { c.fillStyle = i % 2 ? '#8f806609' : '#ffffff22'; c.fillRect(i * 73 % tw, i * 119 % th, 2, 2); }
    }); plaster.repeat.set(3, 2);
    const wallMat = material('#ffffff', { map: plaster, roughness: 1 });
    // Wide oak boards: staggered end joints, grain, the odd knot and a few
    // old paint spots from years of use.
    const floorMap = texture((c, tw, th) => {
        const rnd = random(7), pw = tw / 6;
        for (let i = 0; i < 6; i++) {
            const joint = (i * .37 + .11) % 1 * th, x = i * pw;
            c.fillStyle = ['#c9ae86', '#bea179', '#d1b78f', '#c4a77f', '#b99c74', '#cdb38b'][i]; c.fillRect(x, 0, pw, joint);
            c.fillStyle = ['#c2a57d', '#cbb088', '#c0a37b', '#d0b68e', '#c6a982', '#bb9e76'][i]; c.fillRect(x, joint, pw, th - joint);
            c.strokeStyle = '#6e4f3226'; c.lineWidth = .8;
            for (let j = 0; j < 16; j++) { const gx = x + 3 + j * (pw - 6) / 16 + rnd() * 2; c.beginPath(); c.moveTo(gx, 0); c.bezierCurveTo(gx + 5 * (rnd() - .5) * 2, th * .3, gx - 5 * (rnd() - .5) * 2, th * .65, gx, th); c.stroke(); }
            if (rnd() > .4) { const kx = x + pw * (.3 + rnd() * .4), ky = rnd() * th; c.fillStyle = '#7a593a55'; ellipse(c, kx, ky, 4, 9); c.strokeStyle = '#7a593a30'; for (let r = 1; r < 4; r++) { c.beginPath(); c.ellipse(kx, ky, 4 + r * 3, 9 + r * 6, 0, 0, Math.PI * 2); c.stroke(); } }
            c.fillStyle = '#5c432c66'; c.fillRect(x, 0, 2, th); c.fillRect(x, joint - 1, pw, 2);
        }
        for (let i = 0; i < 26; i++) { c.fillStyle = ['#b6503d88', '#3d557788', '#e5c76688', '#f4efe388'][i % 4]; ellipse(c, rnd() * tw, rnd() * th, 1 + rnd() * 3, 1 + rnd() * 3); }
    }, 512, 1024); floorMap.repeat.set(w / 1300, d / 2000);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .82 }));
    // Flat-woven wool rug: cream field, rust and indigo bands, diamond motifs.
    const rugMap = texture((c, tw, th) => {
        const rnd = random(11); c.fillStyle = '#e2d7c0'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 7000; i++) { c.fillStyle = rnd() > .5 ? 'rgba(120,100,70,.07)' : 'rgba(255,255,255,.09)'; c.fillRect(rnd() * tw, rnd() * th, 2, 1); }
        c.strokeStyle = '#a8674e'; c.lineWidth = 16; c.strokeRect(30, 30, tw - 60, th - 60);
        c.strokeStyle = '#3f5468'; c.lineWidth = 5; c.strokeRect(56, 56, tw - 112, th - 112);
        c.fillStyle = '#a8674e';
        for (let t = 70; t < tw - 70; t += 22) for (const [x, y, r] of [[t, 66, 0], [t, th - 66, Math.PI], [66, t, -Math.PI / 2], [tw - 66, t, Math.PI / 2]]) {
            c.save(); c.translate(x, y); c.rotate(r); c.beginPath(); c.moveTo(-6, 0); c.lineTo(0, 8); c.lineTo(6, 0); c.fill(); c.restore();
        }
        const motif = (x, y, s, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * .7, y); c.lineTo(x, y + s); c.lineTo(x - s * .7, y); c.closePath(); c.fill(); };
        for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
            const x = 150 + gx * 106, y = 150 + gy * 106, big = (gx + gy) % 2 === 0;
            motif(x, y, big ? 40 : 26, big ? '#b98a68' : '#7f948f'); motif(x, y, big ? 24 : 14, '#e6dcc6'); motif(x, y, big ? 9 : 6, '#3f5468');
        }
        c.globalCompositeOperation = 'multiply';
        const wear = c.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, tw * .7); wear.addColorStop(0, '#ffffff'); wear.addColorStop(1, '#e6dccb');
        c.fillStyle = wear; c.fillRect(0, 0, tw, th); c.globalCompositeOperation = 'source-over';
    });
    rugMap.wrapS = rugMap.wrapT = THREE.ClampToEdgeWrapping;
    flat(box(root, [layout.compact ? 2000 : 2300, 4, 1700], [layout.desk[0], 2, layout.desk[1] + 500], material('#ffffff', { map: rugMap, roughness: 1 }), 4));

    // Painted beadboard wainscot runs round the room at window-sill height.
    const dado = 760;
    const bead = texture((c, tw, th) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, tw, th);
        for (let x = 0; x < tw; x += 64) { c.fillStyle = 'rgba(40,50,42,.32)'; c.fillRect(x, 0, 3, th); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 3, 0, 2, th); }
        c.strokeStyle = 'rgba(70,80,70,.05)'; for (let i = 0; i < 60; i++) { const x = i * 37 % tw; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 2, th); c.stroke(); }
    }, 256, 128);
    const wainscot = length => { const map = bead.clone(); map.repeat.set(length / 480, 1); map.needsUpdate = true; return material('#98a596', { map, roughness: .62 }); };

    const back = new THREE.Group(); back.name = 'Artist gallery wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], wallMat);
    box(back, [w, 90, 20], [0, 45, bz + 10], chalk);
    box(back, [w, dado, 12], [0, dado / 2, bz + 6], wainscot(w));
    box(back, [w, 28, 30], [0, dado + 14, bz + 15], chalk, 3);
    // Gallery picture lights: a brass bar with a warm diffuser and a soft
    // additive wash across the canvas below it.
    const lampGlow = material('#fff1d8', { emissive: '#ffe1b4', emissiveIntensity: .3 });
    const washMap = texture((c, tw, th) => {
        const g = c.createRadialGradient(tw / 2, -th * .2, 0, tw / 2, -th * .2, th * 1.15);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, tw, th);
    }, 128, 256); washMap.wrapS = washMap.wrapT = THREE.ClampToEdgeWrapping;
    const wash = new THREE.MeshBasicMaterial({ map: washMap, color: '#ffdcae', transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false });
    const frame = (parent, width, height, at, seed, label, lit = false) => {
        const art = new THREE.Group(); art.name = label; art.position.set(...at); parent.add(art);
        box(art, [width, height, 32], [0, 0, 0], oak, 3);
        box(art, [width - 34, height - 34, 8], [0, 0, 20], material('#ffffff', { map: painting(seed), roughness: .9 }));
        if (lit) {
            rod(art, [0, height / 2 - 4, 6], [0, height / 2 + 64, 70], 7, brass);
            rod(art, [-width * .3, height / 2 + 66, 74], [width * .3, height / 2 + 66, 74], 17, brass).castShadow = false;
            flat(box(art, [width * .56, 5, 16], [0, height / 2 + 49, 78], lampGlow));
            flat(mesh(art, new THREE.PlaneGeometry(width - 30, height - 30), wash, [0, 0, 25]));
        }
        return art;
    };
    for (let i = 0; i < 3; i++) {
        const art = frame(back, layout.compact ? 450 : 550, 690, [layout.desk[0] + (i - 1) * (layout.compact ? 520 : 640), 2080, bz + 35], i, 'Original color study ' + (i + 1), true);
        register(art, 'artist-study-' + i, 'Framed color study ' + (i + 1));
    }
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const side = new THREE.Group(); side.name = 'Artist materials wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], wallMat);
    box(side, [20, 90, d], [w / 2 - 10, 45, bz + d / 2], chalk);
    box(side, [12, dado, d], [w / 2 - 6, dado / 2, bz + d / 2], wainscot(d));
    box(side, [30, 28, d], [w / 2 - 15, dado + 14, bz + d / 2], chalk, 3);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const entry = new THREE.Group(); entry.name = 'Artist daylight wall'; root.add(entry);
    const wz = 400, ww = layout.compact ? 1400 : 2000, low = 820, wh = 1530, a = wz - ww / 2, b = wz + ww / 2;
    box(entry, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], wallMat);
    box(entry, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], wallMat);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], wallMat);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], wallMat);
    const doorZ = front - 480;
    box(entry, [12, dado, doorZ - 410 - bz], [-w / 2 + 6, dado / 2, (bz + doorZ - 410) / 2], wainscot(doorZ - 410 - bz));
    box(entry, [30, 28, doorZ - 410 - bz], [-w / 2 + 15, dado + 14, (bz + doorZ - 410) / 2], chalk, 3);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]);
    pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(entry, [55, wh + 50, 24], [-w / 2 + 8, low + wh / 2, z], chalk);
    for (const y of [low, low + wh]) box(entry, [70, 28, ww + 50], [-w / 2 + 8, y, wz], chalk);
    // Divided lights: the glazing bars throw a soft grid across the floor.
    instanced(entry, unit, tint, [
        ...[(a + wz) / 2, (wz + b) / 2].map(z => ({ at: [-w / 2 + 8, low + wh / 2, z], size: [30, wh, 14], color: '#ebe6da' })),
        ...[low + wh * .36, low + wh * .7].map(y => ({ at: [-w / 2 + 8, y, wz], size: [30, 14, ww], color: '#ebe6da' }))
    ]);
    box(entry, [180, 30, ww + 80], [-w / 2 + 50, low - 15, wz], oak, 3);
    // Linen roman shade drawn up into the head of the window.
    box(entry, [18, 230, ww + 30], [-w / 2 + 46, low + wh - 125, wz], linen, 4);
    rod(entry, [-w / 2 + 52, low + wh - 238, a - 10], [-w / 2 + 52, low + wh - 238, b + 10], 9, oak);
    // Floor-length linen curtains stacked either side of the window.
    const pw = layout.compact ? 220 : 380, ph = h - 190, curtainX = -w / 2 + 168;
    const drapeGeo = new THREE.PlaneGeometry(pw, ph, 18, 1), drapePos = drapeGeo.attributes.position;
    for (let i = 0; i < drapePos.count; i++) drapePos.setZ(i, Math.sin((drapePos.getX(i) / pw + .5) * Math.PI * 7) * 22);
    drapeGeo.computeVertexNormals();
    for (const z of [a - pw / 2 + 50, b + pw / 2 - 50]) { const panel = mesh(entry, drapeGeo, linen, [curtainX, 30 + ph / 2, z]); panel.rotation.y = Math.PI / 2; }
    rod(entry, [curtainX, h - 140, a - pw + 20], [curtainX, h - 140, b + pw - 20], 11, brass);
    for (const z of [a - pw + 40, b + pw - 40]) rod(entry, [-w / 2, h - 140, z], [curtainX, h - 140, z], 6, brass);
    // Sill garden: terracotta pots of herbs and a jar of brushes.
    const sillLeaves = [], sillPots = [];
    [[wz - ww * .3, 1], [wz - ww * .14, 2]].forEach(([z, seed], p) => {
        sillPots.push({ at: [-w / 2 + 70, low + 55, z], size: [62 - p * 10, 110 - p * 14, 62 - p * 10], color: '#b8694b' });
        const rnd = random(seed + 30);
        for (let i = 0; i < 16; i++) { const az = i * 2.4, tilt = .2 + rnd() * .9; leaf(sillLeaves, [-w / 2 + 70, low + 100 - p * 14, z], [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)], 80 + rnd() * 70, 30 + rnd() * 16, GREENS[i % 5]); }
    });
    instanced(entry, new THREE.CylinderGeometry(1, .78, 1, 16), tint, sillPots);
    instanced(entry, ball, leafy, sillLeaves);
    const doorFrame = box(entry, [28, 2100, 800], [-w / 2 + 20, 1050, doorZ], oak, 4); doorFrame.name = 'Artist studio door frame';
    box(entry, [18, 1970, 720], [-w / 2 + 43, 985, doorZ], chalk, 4);
    rod(entry, [-w / 2 + 65, 1000, doorZ - 270], [-w / 2 + 65, 1000, doorZ - 180], 8, brass);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const brushCup = (parent, at, pot = blue) => {
        const cup = new THREE.Group(); cup.position.set(...at); parent.add(cup);
        mesh(cup, new THREE.CylinderGeometry(47, 38, 90, 20), pot, [0, 45, 0]);
        const handles = [], tips = [];
        for (let i = 0; i < 9; i++) {
            const x = (i % 3 - 1) * 18, z = (Math.floor(i / 3) - 1) * 19, top = 196 + (i * 5) % 4 * 15;
            const end = [x * 1.9 + (i % 2) * 6, top, z * 1.9], dir = new THREE.Vector3(end[0] - x, top - 60, end[2] - z).normalize();
            handles.push(stick([x, 60, z], end, 4.2 - (i % 3) * .7, ['#b8936a', '#2f3433', '#a3463a', '#d9c49b'][i % 4]));
            tips.push({ at: [end[0] + dir.x * 13, top + dir.y * 13, end[2] + dir.z * 13], q: new THREE.Quaternion().setFromUnitVectors(up, dir), size: [11 - i % 3 * 2, 26, 6], color: ['#c96a4c', '#e3c46a', '#5f8d8b', '#3b4552', '#ece3d0', '#2b2724'][i % 6] });
        }
        instanced(cup, tube, tint, handles); instanced(cup, unit, gloss, tips, false);
        return cup;
    };
    // A plaster cast of a classical head, built from simple solids.
    const bust = (parent, at, turn = 0, s = 1) => {
        const g = group(parent, 'Plaster cast bust', at, turn); g.scale.setScalar(s);
        mesh(g, new THREE.CylinderGeometry(70, 80, 40, 20), cast, [0, 20, 0]);
        sphere(g, [120, 80, 70], [0, 105, 0], cast);
        mesh(g, new THREE.CylinderGeometry(32, 40, 80, 14), cast, [0, 185, 0]);
        sphere(g, [60, 76, 66], [0, 262, 6], cast);
        sphere(g, [64, 46, 68], [0, 300, -8], cast);
        box(g, [14, 30, 20], [0, 256, 70], cast);
        return g;
    };

    const storage = new THREE.Group(); storage.name = 'Art materials cabinet'; root.add(storage);
    // Painted plan chest: wide shallow drawers with brass card frames and pulls.
    box(storage, [550, 780, 1100], [cx, 460, cz], sage, 6);
    box(storage, [570, 50, 1120], [cx, 875, cz], oak, 3); // top exactly 900 mm
    for (const z of [cz - 440, cz + 440]) for (const x of [cx - 200, cx + 200]) box(storage, [40, 70, 40], [x, 35, z], oak);
    const drawers = [], fittings = [];
    for (let i = 0; i < 5; i++) {
        const y = 145 + i * 148;
        drawers.push({ at: [cx - 280, y, cz], size: [10, 136, 1050], color: i % 2 ? '#86948a' : '#8a988e' });
        fittings.push({ at: [cx - 287, y + 30, cz], size: [4, 34, 90], color: '#c8a868' });
        for (const z of [cz - 330, cz + 330]) fittings.push({ at: [cx - 292, y - 12, z], size: [16, 16, 90], color: '#b8975c' });
    }
    instanced(storage, unit, tint, drawers);
    instanced(storage, unit, brass, fittings, false);
    instanced(storage, unit, tint, Array.from({ length: 5 }, (_, i) => ({ at: [cx - 290, 175 + i * 148, cz], size: [2, 22, 76], color: '#f3ecdc' })), false);
    box(side, [300, 24, 1080], [w / 2 - 165, 1512, cz], oak, 2);
    // Glass pigment jars along the shelf.
    const jars = [];
    ['#b6503d', '#e2b543', '#3d5577', '#4d7b7a', '#6d4f6f'].forEach((color, i) => {
        const z = cz - 40 + i * 62, x = w / 2 - 190;
        jars.push({ at: [x, 1524 + 42, z], size: [26, 84, 26], color: '#d8e2e0' });
        jars.push({ at: [x, 1524 + 28, z], size: [24, 54, 24], color });
        jars.push({ at: [x, 1524 + 90, z], size: [27, 12, 27], color: '#2f302f' });
    });
    instanced(side, tube, gloss, jars, false);
    // Pinned sketches and swatches face into the room above the cabinet.
    const board = new THREE.Group(); board.position.set(w / 2 - 40, 2010, cz); board.rotation.y = -Math.PI / 2; side.add(board);
    box(board, [1040, 720, 30], [0, 0, 0], oak, 3);
    const cork = texture((c, tw, th) => {
        const rnd = random(5); c.fillStyle = '#c2a37a'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 2600; i++) { c.fillStyle = rnd() > .5 ? 'rgba(90,60,30,.22)' : 'rgba(240,215,170,.25)'; c.fillRect(rnd() * tw, rnd() * th, 1 + rnd() * 2, 1 + rnd() * 2); }
    }, 256, 256); cork.repeat.set(2, 1.4);
    box(board, [1000, 680, 10], [0, 0, 22], material('#ffffff', { map: cork, roughness: 1 }));
    const pinned = [[-385, 135, 170, 230, 0], [-190, 160, 200, 150, 2], [10, 115, 160, 220, 5], [205, 150, 190, 140, 9], [385, 110, 150, 210, 12],
        [-310, -165, 190, 140, 6], [-85, -135, 170, 220, 3], [150, -170, 210, 150, 10], [370, -150, 150, 190, 13]];
    cards(board, pinned.map(([x, y, sw, sh, cell], k) => ({ at: [x, y, 29 + k * .7], size: [sw, sh], cell, rot: [0, 0, ((k * 5) % 7 - 3) * .018] })));
    instanced(board, ball, gloss, pinned.map(([x, y, , sh], k) => ({ at: [x, y + sh / 2 - 14, 38], size: [7, 7, 6], color: ['#c0473a', '#e2b543', '#3d5577'][k % 3] })), false);
    instanced(board, unit, tint, [{ at: [190, 222, 37], size: [70, 18, 1], rot: [0, 0, .5], color: '#e9b9a6' }, { at: [-60, -40, 37], size: [70, 18, 1], rot: [0, 0, -.4], color: '#b9d1c7' }], false);
    brushCup(storage, [cx, 900, cz - 350]);
    const paint = ['#b95d46', '#d9bb63', '#628b89', '#536780'];
    instanced(storage, tube, tint, paint.map((color, i) => ({ at: [cx + (i - 1.5) * 55, 932.5, cz - 100], size: [23, 65, 23], color })));
    instanced(storage, tube, gloss, paint.map((_, i) => ({ at: [cx + (i - 1.5) * 55, 968.5, cz - 100], size: [24, 7, 24], color: '#e9e4d8' })), false);
    if (layout.compact) {
        // The nook has no floor easel, so a cast and a table easel live on the chest.
        bust(storage, [cx + 20, 900, cz + 200], -Math.PI / 2 + .5, .85);
    }

    // Stretched canvases leaning on the wall: two show their stretcher
    // backs, one faces out. Under the picture ledge where there is room.
    const lounging = layout.props.some(p => p.id === 'armchair-poppi');
    const ledge = group(side, 'Artist picture ledge', [w / 2, 1400, front - 360], -Math.PI / 2);
    register(ledge, 'artist-picture-ledge', 'Picture ledge with small studies');
    box(ledge, [720, 20, 100], [0, 0, 50], oak, 2);
    box(ledge, [720, 36, 12], [0, 18, 100], oak, 2);
    const small = [[-220, 230, 300, 4, .05], [30, 290, 215, 1, .06], [250, 170, 235, 11, .07]];
    instanced(ledge, unit, tint, small.map(([x, fw, fh, , lean], k) => ({ at: [x, 10 + fh / 2, 28 + fh / 2 * Math.sin(lean)], size: [fw, fh, 22], rot: [-lean, 0, 0], color: ['#a88a62', '#2e2b28', '#ece7dc'][k] })));
    cards(ledge, small.map(([x, fw, fh, cell, lean]) => ({ at: [x, 10 + fh / 2, 28 + fh / 2 * Math.sin(lean) + 12], size: [fw - 44, fh - 44], cell, rot: [-lean, 0, 0] })));
    if (!lounging) {
        const stack = group(root, 'Artist canvas stack', [w / 2, 0, front - 360], -Math.PI / 2);
        register(stack, 'artist-canvas-stack', 'Stretched canvases');
        const raw = material('#dcd0b6', { roughness: 1 }), bars = [];
        const canvases = [{ x: 0, cw: 600, ch: 960, t: 24, lean: .1, z: 60, out: false }, { x: -40, cw: 520, ch: 720, t: 22, lean: .13, z: 130, out: true }, { x: 130, cw: 420, ch: 540, t: 20, lean: .16, z: 180, out: false }];
        const faces = [];
        for (const cv of canvases) {
            const y = cv.ch / 2 * Math.cos(cv.lean) + cv.t / 2 * Math.sin(cv.lean), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-cv.lean, 0, 0));
            box(stack, [cv.cw, cv.ch, cv.t], [cv.x, y, cv.z], raw).rotation.x = -cv.lean;
            const place = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(cv.x, y, cv.z)).toArray();
            if (cv.out) faces.push({ at: place(0, 0, cv.t / 2 + 1), size: [cv.cw - 6, cv.ch - 6], cell: 9, rot: [-cv.lean, 0, 0] });
            else {
                const zb = cv.t / 2 + 9;
                for (const s of [-1, 1]) {
                    bars.push({ at: place(0, s * (cv.ch / 2 - 22), zb), q, size: [cv.cw, 44, 18], color: '#c7a67a' });
                    bars.push({ at: place(s * (cv.cw / 2 - 22), 0, zb), q, size: [44, cv.ch - 88, 18], color: '#c09f73' });
                }
                bars.push({ at: place(0, 0, zb - 1), q, size: [36, cv.ch - 88, 14], color: '#b8976b' });
            }
        }
        instanced(stack, unit, tint, bars);
        cards(stack, faces);
    }

    // Back corner: a tall fiddle-leaf fig (larger suites already have a monstera).
    if (!layout.large) {
        const fig = group(root, 'Artist fiddle-leaf fig', [w / 2 - 300, 0, bz + 300]);
        register(fig, 'artist-fig', 'Fiddle-leaf fig in terracotta');
        mesh(fig, new THREE.CylinderGeometry(170, 130, 330, 24), clay, [0, 165, 0]);
        mesh(fig, new THREE.CylinderGeometry(160, 160, 8, 24), material('#3a3129', { roughness: 1 }), [0, 318, 0]);
        const rnd = random(41), figLeaves = [], stems = [stick([0, 320, 0], [-20, 1050, 10], 16, '#6b5440'), stick([-20, 1050, 10], [30, 1650, -20], 11, '#6b5440')];
        for (let i = 0; i < 38; i++) {
            const t = i / 38, y = 760 + t * 900, az = i * 2.4 + rnd() * .5, r = 30 + (1 - t) * 50;
            const base = [Math.cos(az) * r, y, Math.sin(az) * r];
            leaf(figLeaves, base, [Math.cos(az), .35 + rnd() * .6 + t * .3, Math.sin(az)], 230 + rnd() * 90 - t * 60, 150 + rnd() * 50 - t * 40, GREENS[(i * 3) % 5]);
        }
        instanced(fig, tube, tint, stems);
        instanced(fig, ball, leafy, figLeaves);
    }

    // Trailing pothos in a hanging planter high in the back corner.
    const hangX = -w / 2 + 300, hangZ = bz + 330, hangY = h - 720;
    const hanger = group(root, 'Artist hanging planter', [hangX, 0, hangZ]);
    mesh(hanger, new THREE.SphereGeometry(110, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clay, [0, hangY + 60, 0]);
    const cords = [0, 1, 2].map(i => stick([Math.cos(i * 2.094) * 100, hangY + 60, Math.sin(i * 2.094) * 100], [0, h, 0], 2, '#d8c9a8'));
    instanced(hanger, tube, tint, cords, false);
    const vines = [], vineRnd = random(17);
    for (let v = 0; v < 6; v++) {
        const az = v * 1.05 + .3;
        for (let j = 0; j < 6 - v % 2; j++) {
            const r = 95 + j * 9, sway = Math.sin(j * .9 + v) * 30;
            leaf(vines, [Math.cos(az) * r + sway, hangY + 70 - j * 88, Math.sin(az) * r], [Math.cos(az) + (vineRnd() - .5), -.2 - vineRnd() * .5, Math.sin(az) + (vineRnd() - .5)], 85 + vineRnd() * 30, 62, GREENS[(v + j) % 5]);
        }
    }
    instanced(hanger, ball, leafy, vines);

    // Paper lantern over the open floor (the worktable in the larger suites),
    // glowing from evening on. Hung clear of the camera's line to the desk.
    const paper = material('#f6ecd8', { emissive: '#ffd9a4', emissiveIntensity: .1, roughness: 1 });
    const lanternAt = layout.large ? [layout.table[0], h - 650, layout.table[1]] : [w / 2 - (layout.compact ? 700 : 900), h - 600, front - (layout.compact ? 700 : 900)];
    const lantern = group(root, 'Artist paper lantern', lanternAt);
    flat(sphere(lantern, [230, 205, 230], [0, 0, 0], paper));
    instanced(lantern, tube, tint, [-120, 0, 120].map(y => ({ at: [0, y, 0], size: [230 * Math.sqrt(1 - (y / 205) ** 2) + 2, 3, 230 * Math.sqrt(1 - (y / 205) ** 2) + 2], color: '#e6d8bc' })), false);
    rod(lantern, [0, 200, 0], [0, h - lanternAt[1], 0], 3, metal).castShadow = false;

    // Festoon string swagged along the materials wall for open-studio nights.
    const bulbs = material('#fff3dd', { emissive: '#ffcf8a', emissiveIntensity: .05 });
    {
        const top = h - 60, x = w / 2 - 70, z0 = bz + 220, z1 = front - 220, swags = 2, points = [], lamps = [];
        for (let s = 0; s < swags; s++) for (let i = 0; i <= 24; i++) {
            const t = i / 24, z = z0 + (z1 - z0) * (s + t) / swags, y = top - 120 * 4 * t * (1 - t);
            if (i || !s) points.push(new THREE.Vector3(x, y, z));
            if (i % 3 === 1) lamps.push({ at: [x, y - 34, z], size: [22, 30, 22] });
        }
        flat(mesh(side, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, 3, 5), metal));
        instanced(side, ball, bulbs, lamps, false);
    }

    if (!layout.compact) {
        const easel = new THREE.Group(); easel.name = 'Artist painting easel'; easel.position.set(layout.easel[0], 0, layout.easel[1]); easel.rotation.y = .22; root.add(easel);
        register(easel, 'artist-easel', 'Painting easel and canvas');
        for (const x of [-310, 310]) { box(easel, [65, 30, 650], [x, 15, 0], oak, 3); rod(easel, [x, 40, -170], [x * .85, 1830, -170], 23, oak); }
        box(easel, [740, 60, 90], [0, 770, -120], oak, 4);
        box(easel, [540, 40, 50], [0, 1770, -150], oak, 3);
        const art = frame(easel, 660, 850, [0, 1220, -140], 3, 'Painting in progress');
        art.rotation.x = -.025;
        rod(easel, [0, 1700, -170], [0, 40, 285], 21, oak);
        box(easel, [80, 30, 90], [0, 15, 285], oak, 3);
        brushCup(easel, [270, 800, -75]);
        // Clamp lamp on the mast, angled down onto the canvas.
        const clamp = group(easel, 'Easel clamp lamp', [200, 1800, -120]); clamp.rotation.x = .7;
        mesh(clamp, new THREE.CylinderGeometry(22, 50, 85, 18, 1, true), material('#b8975c', { metalness: .4, roughness: .45, side: THREE.DoubleSide }), [0, 0, 0]);
        flat(sphere(clamp, [20, 20, 20], [0, -22, 0], lampGlow));
        rod(easel, [200, 1800, -150], [0, 1770, -150], 6, metal);
        // Paint-spattered drop cloth under the easel.
        const clothMap = texture((c, tw, th) => {
            const rnd = random(23); c.fillStyle = '#e3dac8'; c.fillRect(0, 0, tw, th);
            for (let i = 0; i < 14; i++) { c.strokeStyle = 'rgba(120,100,70,.08)'; c.lineWidth = 6 + rnd() * 14; c.beginPath(); c.moveTo(rnd() * tw, 0); c.bezierCurveTo(rnd() * tw, th * .3, rnd() * tw, th * .7, rnd() * tw, th); c.stroke(); }
            const colors = ['#b6503d', '#e2b543', '#3d5577', '#4d7b7a', '#f4efe3', '#6d4f6f', '#2f302f'];
            for (let i = 0; i < 260; i++) {
                const r = Math.pow(rnd(), 1.6) * tw * .42, az = rnd() * 6.283, x = tw / 2 + Math.cos(az) * r, y = th * .45 + Math.sin(az) * r * .8;
                c.fillStyle = colors[i % colors.length] + 'cc'; ellipse(c, x, y, 1 + rnd() * 6, 1 + rnd() * 5, rnd() * 3);
            }
        });
        const cloth = flat(box(root, [1100, 3, 900], [layout.easel[0] + 60, 1.5, layout.easel[1] - 40], material('#ffffff', { map: clothMap, roughness: 1 })));
        cloth.rotation.y = .22; cloth.name = 'Artist drop cloth';

        // Taboret by the window: glass palette, paint tubes and brushes.
        const taboret = group(root, 'Artist paint taboret', [-w / 2 + 430, 0, layout.easel[1] - 700], .3);
        register(taboret, 'artist-taboret', 'Paint taboret and glass palette');
        for (const x of [-205, 205]) for (const z of [-205, 205]) box(taboret, [28, 720, 28], [x, 360, z], metal);
        box(taboret, [470, 30, 470], [0, 705, 0], oak, 4);
        box(taboret, [440, 18, 440], [0, 300, 0], oak, 2);
        box(taboret, [360, 8, 280], [-40, 724, -40], glass, 2);
        const pigments = ['#f4efe3', '#c99a4b', '#e5c24a', '#c0402f', '#8f2f3b', '#2f4f8f', '#2f6b55', '#5a3e2b'];
        instanced(taboret, ball, gloss, [
            ...pigments.map((color, i) => ({ at: [-195 + i * 44, 732, -158], size: [17, 8, 14], color })),
            ...[0, 1, 2, 3].map(i => ({ at: [-120 + i * 70, 729, 20 - i * 25], size: [40, 3, 26], rot: [0, i, 0], color: ['#b97a5a', '#7f9a7a', '#d1b36e', '#6f7f9a'][i] }))
        ], false);
        instanced(taboret, tube, gloss, pigments.map((color, i) => ({ at: [-150 + i * 40, 323, 60 - (i % 2) * 30], size: [13, 120, 13], rot: [Math.PI / 2, 0, 0], color })));
        brushCup(taboret, [165, 720, 160]);
        sphere(taboret, [70, 20, 55], [150, 734, -110], material('#d8cbb0', { roughness: 1 }));
        instanced(taboret, unit, tint, [0, 1, 2].map(i => ({ at: [-30, 318 + i * 18, -110], size: [300, 17, 200], rot: [0, i * .12, 0], color: ['#3e4f5c', '#a24f3c', '#d9cfb8'][i] })));

        // Cast-drawing still life: a draped plinth with a plaster head and solids,
        // tucked into the back corner beside the desk rather than in front of it.
        const still = group(root, 'Artist cast drawing stand', [-w / 2 + 330, 0, bz + 720], .9);
        register(still, 'artist-cast-stand', 'Plaster cast still life');
        box(still, [360, 800, 360], [0, 400, 0], chalk, 4);
        const drape = material('#a95f47', { roughness: 1, side: THREE.DoubleSide });
        box(still, [410, 10, 410], [0, 805, 0], drape, 3);
        const flapGeo = new THREE.PlaneGeometry(300, 320, 10, 1), flapPos = flapGeo.attributes.position;
        for (let i = 0; i < flapPos.count; i++) flapPos.setZ(i, Math.sin((flapPos.getX(i) / 300 + .5) * Math.PI * 4) * 12);
        flapGeo.computeVertexNormals(); mesh(still, flapGeo, drape, [20, 650, 210]);
        bust(still, [-30, 810, -40], 0, 1.1);
        box(still, [110, 110, 110], [115, 865, 105], cast).rotation.y = .5;
        sphere(still, [52, 52, 52], [-125, 862, 125], cast);
    }
    if (layout.large) {
        const table = new THREE.Group(); table.name = 'Artist materials worktable'; table.position.set(layout.table[0], 0, layout.table[1]); root.add(table);
        register(table, 'artist-worktable', 'Materials and paper worktable');
        box(table, [800, 45, 1500], [0, 887.5, 0], oak, 5);
        for (const x of [-315, 315]) for (const z of [-660, 660]) box(table, [50, 865, 50], [x, 432.5, z], blue, 2);
        box(table, [670, 22, 1330], [0, 310, 0], oak, 3);
        instanced(table, unit, tint, Array.from({ length: 4 }, (_, i) => ({ at: [0, 356 + i % 2 * 80, -460 + Math.floor(i / 2) * 860], size: [590, 70, 180], color: i % 2 ? '#c8b69c' : '#e4dfd1' })));
        brushCup(table, [-240, 910, -610]);
        const matMap = texture((c, tw, th) => {
            c.fillStyle = '#3f6b5a'; c.fillRect(0, 0, tw, th); c.strokeStyle = 'rgba(220,235,225,.45)'; c.lineWidth = 1;
            for (let i = 8; i < tw; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, th); c.moveTo(0, i); c.lineTo(tw, i); c.stroke(); }
            c.strokeStyle = 'rgba(240,210,120,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, th / 2); c.lineTo(tw, th / 2); c.stroke();
        }, 256, 256); matMap.wrapS = matMap.wrapT = THREE.ClampToEdgeWrapping;
        flat(box(table, [560, 3, 460], [30, 911.5, 120], material('#ffffff', { map: matMap, roughness: .7 })));
        flat(box(root, [2400, 4, 1950], [650, 2, front - 990], material('#d2c2ae', { map: rugMap, roughness: 1 }), 8));
        const art = frame(side, 1100, 850, [w / 2 - 30, 1850, front - 1400], 4, 'Original atelier painting'); art.rotation.y = -Math.PI / 2;
    }
    if (layout.sculpture) {
        const sculpture = new THREE.Group(); sculpture.name = 'Artist sculpture station'; sculpture.position.set(w / 2 - 680, 0, front - 2750); root.add(sculpture);
        register(sculpture, 'artist-sculpture', 'Sculpture study and plinth');
        box(sculpture, [620, 900, 620], [0, 450, 0], chalk, 4);
        const ceramic = material('#c09b80', { roughness: .75 });
        sphere(sculpture, [150, 90, 140], [0, 990, 0], ceramic);
        const loop = mesh(sculpture, new THREE.TorusGeometry(135, 45, 12, 36), ceramic, [0, 1200, 0]); loop.rotation.y = .35;
        sphere(sculpture, [65, 85, 65], [95, 1320, 0], ceramic);
        box(root, [1300, 5, 1300], [w / 2 - 680, 2.5, front - 2750], material('#bca185', { roughness: .95 }), 8);
    }

    const glow = [];
    const strip = (parent, size, at, channel = 0) => {
        const mat = material('#efd7b9', { emissive: '#efd7b9', emissiveIntensity: .4 });
        const obj = box(parent, size, at, mat, 2); obj.castShadow = false; glow.push({ mat, channel });
    };
    strip(back, [w - 200, 12, 20], [0, h - 180, bz + 20]);
    strip(side, [12, 8, 1000], [w / 2 - 308, 1494, cz], 1);
    const ceiling = new THREE.Group(); ceiling.name = 'Artist gallery lighting track'; root.add(ceiling); room.ceilingFixture = ceiling;
    box(ceiling, [w - 580, 25, 35], [0, h - 80, layout.desk[1] + 280], metal, 3);
    const lamp = material('#f2eee2', { emissive: '#f2eee2', emissiveIntensity: .4 });
    for (const x of [-w / 2 + 440, 0, w / 2 - 440]) {
        rod(ceiling, [x, h - 80, layout.desk[1] + 280], [x, h - 180, layout.desk[1] + 280], 8, metal);
        box(ceiling, [95, 85, 120], [x, h - 215, layout.desk[1] + 280], chalk, 6);
        box(ceiling, [70, 4, 95], [x, h - 260, layout.desk[1] + 280], lamp, 3);
    }
    const lights = [
        { at: [layout.desk[0], h - 320, layout.desk[1] + 260], power: 1.3, range: 3400, task: true },
        { at: [cx - 120, 1450, cz], power: 1.5, range: 2400, channel: 1 },
        { at: layout.compact ? [lanternAt[0], lanternAt[1] - 240, lanternAt[2]] : [layout.easel[0] + 150, 2200, layout.easel[1] + 150], power: 2.4, range: 3600, task: true },
        { at: [450, 2200, front - 1350], power: 2.6, range: 4600, channel: 0 }
    ].map(spec => {
        const light = new THREE.PointLight('#f1e7d8', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light);
        return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 };
    });
    // North-facing view over zinc roofs and chimney pots; stars and lit
    // windows after dark.
    const drawSky = (c, mode, modeId) => {
        const rnd = random(5), night = modeId === 'night', dusk = modeId === 'evening' || modeId === 'party';
        const gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        if (night) {
            for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,250,235,${.3 + rnd() * .6})`; c.fillRect(rnd() * 512, rnd() * 300, 1.6, 1.6); }
            const g = c.createRadialGradient(390, 110, 0, 390, 110, 90); g.addColorStop(0, 'rgba(240,235,215,.35)'); g.addColorStop(1, 'rgba(240,235,215,0)');
            c.fillStyle = g; c.fillRect(290, 10, 200, 200); c.fillStyle = '#f2eedf'; ellipse(c, 390, 110, 22, 22);
        } else {
            if (modeId === 'evening') { const g = c.createRadialGradient(90, 400, 0, 90, 400, 260); g.addColorStop(0, 'rgba(255,200,140,.7)'); g.addColorStop(1, 'rgba(255,200,140,0)'); c.fillStyle = g; c.fillRect(0, 140, 400, 372); }
            c.fillStyle = dusk ? 'rgba(255,205,175,.35)' : 'rgba(255,255,255,.45)';
            for (let i = 0; i < 9; i++) ellipse(c, rnd() * 512, 50 + rnd() * 200, 50 + rnd() * 70, 10 + rnd() * 10);
        }
        const far = night ? '#202a3d' : dusk ? '#6f6577' : '#a3b0b4', near = night ? '#141b29' : dusk ? '#4e4859' : '#7f8d91';
        c.fillStyle = far;
        for (let i = 0; i < 12; i++) { const x = i * 46 - 10, top = 360 + (i * 29 % 40); c.fillRect(x, top, 48, 160); }
        c.fillStyle = near;
        for (let i = 0; i < 8; i++) {
            const x = i * 70 - 20, top = 405 + (i * 37 % 45);
            c.beginPath(); c.moveTo(x, 512); c.lineTo(x, top + 20); c.lineTo(x + 36, top); c.lineTo(x + 72, top + 20); c.lineTo(x + 72, 512); c.fill();
            c.fillRect(x + 14, top - 22, 13, 30); c.fillStyle = '#9a5a44'; c.fillRect(x + 15, top - 30, 4, 9); c.fillRect(x + 21, top - 28, 4, 7); c.fillStyle = near;
        }
        if (!night && !dusk) { c.fillStyle = '#7f9478'; for (let i = 0; i < 7; i++) ellipse(c, 30 + i * 78, 470 - i % 3 * 8, 34, 26); }
        if (night || dusk) for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,214,150,${night ? .85 : .5})`; c.fillRect(rnd() * 500, 380 + rnd() * 120, 6, 8); }
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = ARTIST_MODES[modeId] || ARTIST_MODES.afternoon;
        drawSky(skyCanvas.getContext('2d'), mode, modeId); skyMap.needsUpdate = true;
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .08 + mode.wash * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#fff4e3' : mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        lamp.emissiveIntensity = .15 + mode.practical * .7;
        // Practicals: picture lights, clamp lamp, lantern and festoon.
        lampGlow.emissiveIntensity = (.15 + mode.practical * 1.5) * accent;
        wash.opacity = Math.min(.5, mode.practical * .42) * accent;
        paper.emissiveIntensity = (.04 + mode.practical * 1.2) * accent;
        bulbs.emissiveIntensity = ({ party: 2.4, evening: .9, night: .5 }[modeId] ?? .03) * accent;
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[oak, 'wood'], [wallMat, 'plaster'], [clay, 'plaster'], [cast, 'plaster'], [chalk, 'plaster'], [blue, 'powder'], [sage, 'powder'], [metal, 'metal'], [brass, 'metal'], [linen, 'fabric']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
