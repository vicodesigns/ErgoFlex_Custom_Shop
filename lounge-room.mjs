import * as THREE from 'three';

const tiers = [
    ['apartment', 'Apartment living lounge', 3600, 4200, 2600],
    ['house', 'Home lounge & listening room', 4600, 5400, 2800],
    ['spacious', 'Media lounge & arcade corner', 5800, 6400, 3000],
    ['premium', 'Social lounge & games room', 7200, 8000, 3200],
    ['executive', 'Private entertainment suite', 9000, 9500, 3400]
];
export const LOUNGE_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1700, front = back + depth;
    const desk = [-width / 2 + (tier ? 1250 : 1100), back + 900];
    const loungeZ = front - (tier ? 1500 : 1200), sofaX = -width / 2 + (tier ? 540 : 460), tableX = -width / 2 + (tier ? 1630 : 1320);
    const props = [
        { id: 'kenney-furniture-chair-cushion', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: tier ? 'sofa-fabric' : 'sofa-leather-wood', at: [sofaX, 0, loungeZ], turn: 90 },
        { id: 'coffee-table', at: [tableX, 0, loungeZ], turn: 90 },
        { id: 'game-controller', at: [tableX + 60, 391.2, loungeZ - 230], turn: 90 },
        { id: 'journal', at: [tableX - 80, 391.2, loungeZ + 175], turn: 85 },
        { id: 'tea-cup', at: [tableX + 140, 391.2, loungeZ + 220] },
        { id: 'samsung-neo-tv', at: [width / 2 - 200, 650, loungeZ], turn: -90 },
        { id: 'arcade-orbit-runner', at: [width / 2 - 520, 0, back + 560], turn: -90 },
        { id: 'decor-plant2', at: [0, 0, front - 240] }
    ];
    if (tier) props.push({ id: 'jukebox', at: [width / 2 - 560, 0, back + (tier >= 2 ? 2700 : 1770)], turn: -90 });
    if (tier >= 2) props.push(
        { id: 'arcade-pixel-garden', at: [width / 2 - 520, 0, back + 1600], turn: -90 },
        { id: 'armchair-poppi', at: [width / 2 - 900, 0, front - 690], turn: -135 },
        { id: 'monstera', at: [width / 2 - 520, 0, loungeZ - 1450] }
    );
    if (tier >= 3) props.push(
        { id: 'foosball', at: [tier === 4 ? 2400 : 600, 0, front - (tier === 4 ? 2300 : 3700)] },
        { id: 'bar-stool-brass', at: [-width / 2 + 920, 0, back + 3200] },
        { id: 'bar-stool-brass', at: [-width / 2 + 920, 0, back + 3900] },
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [-width / 2 + 350, 930, back + 3380], turn: 90 }
    );
    if (tier === 4) props.push({ id: 'arcade-night-drive', at: [width / 2 - 560, 0, back + 3650], turn: -90 });
    return [id, { id, name, width, depth, height, back, desk, loungeZ, sofaX, tableX, tier, props,
        daylight: [-width / 2 + 100, back + 2400] }];
}));
export const loungeLayoutById = id => LOUNGE_LAYOUTS[id] || LOUNGE_LAYOUTS.apartment;
export const loungeLayoutForSize = size => LOUNGE_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// colors: [warm practicals, media bias, arcade neon]. sun/sunColor/sunLength drive the
// window's light pool on the floor, fire the hearth glow and neon the arcade cove.
export const LOUNGE_MODES = {
    morning: { label: 'Morning', description: 'Coffee & daylight · standing desk for a fresh start', key: '#fff0d6', fill: '#dceaf2', accent: '#d8d7b4', power: 1.6, ambient: .48, bounce: .65, exposure: 1.07, sky: ['#9cc2dc', '#f1e2c2'], practical: .25, wash: .18, colors: ['#efcd9c', '#b8d4c4', '#9fd3cc'], neon: .12, sun: .3, sunColor: '#fff0d4', sunLength: 1500, sunShift: -260, fire: 0, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Reading & conversation · relaxed seated desk', key: '#fff2dc', fill: '#e0e9f1', accent: '#e1d3b7', power: 1.25, ambient: .45, bounce: .6, exposure: 1.08, sky: ['#9fc0db', '#ebe6d6'], practical: .4, wash: .35, colors: ['#efd5ae', '#c9d6c6', '#a8d0c8'], neon: .18, sun: .2, sunColor: '#fff4e2', sunLength: 950, sunShift: 120, fire: .08, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden-hour listening · warm lamps and cabinet lights', key: '#ffbf7c', fill: '#c6cde0', accent: '#f4a764', power: 1.1, ambient: .27, bounce: .34, exposure: 1.1, sky: ['#7b6f9f', '#f6a35d'], practical: 1, wash: .75, colors: ['#ffc785', '#f0b98a', '#ff9f7a'], neon: .45, sun: .42, sunColor: '#ffad5c', sunLength: 2000, sunShift: 420, fire: .75, height: 28, tilt: 0, offset: [0, 70], yaw: 0, leds: true, color: '#ffd8a3' },
    night: { label: 'Movie night', description: 'Low-glare cinema · soft media bias lights', key: '#a9bde0', fill: '#b4c3dc', accent: '#8ea3dc', power: .14, ambient: .15, bounce: .18, exposure: 1.12, sky: ['#0d1a2e', '#2d4262'], practical: .5, wash: 1.15, colors: ['#f0be86', '#7f9fe0', '#8d8ff0'], neon: .5, sun: 0, sunColor: '#9fb6e6', sunLength: 900, sunShift: 0, fire: 1, height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#9bb8e8' },
    party: { label: 'Game night', description: 'Arcade & friends · desk turned toward the room', key: '#d9cbe6', fill: '#c2d2ea', accent: '#d59ade', power: .4, ambient: .25, bounce: .3, exposure: 1.12, sky: ['#2e3a62', '#8f6f9c'], practical: .85, wash: 1.2, colors: ['#ffc98f', '#c792ea', '#5fe0d6'], neon: 1.45, sun: 0, sunColor: '#d6b6f0', sunLength: 900, sunShift: 0, fire: .55, height: 43.5, tilt: -5, offset: [60, 260], yaw: -12, leds: true, color: '#d0a2ee' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
// Stable pseudo-random numbers keep textures and dressing identical across rebuilds.
const rand = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PRINT_ART = [
    (c, s) => { c.fillStyle = '#efe0c4'; c.fillRect(0, 0, s, s); ['#e98a52', '#d8664a', '#b44d4a', '#7c3f52'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, s * (.5 + i * .12), s, s * .12); }); c.fillStyle = '#f6c463'; c.beginPath(); c.arc(s / 2, s * .5, s * .22, Math.PI, 0); c.fill(); c.fillStyle = '#2f2a33'; c.font = `bold ${s * .07}px sans-serif`; c.fillText('SLOW SUNDAYS', s * .1, s * .16); },
    (c, s) => { c.fillStyle = '#efe8d8'; c.fillRect(0, 0, s, s); c.strokeStyle = '#4f6a58'; c.fillStyle = '#5f7d68'; c.lineWidth = s * .015; c.beginPath(); c.moveTo(s * .5, s * .95); c.quadraticCurveTo(s * .52, s * .6, s * .45, s * .3); c.stroke(); for (let i = 0; i < 7; i++) { const y = s * (.35 + i * .08), side = i % 2 ? 1 : -1; c.beginPath(); c.ellipse(s * (.5 + side * .16), y, s * .17 - i * 3, s * .06, side * .5, 0, Math.PI * 2); c.fill(); } },
    (c, s) => { c.fillStyle = '#1d2a44'; c.fillRect(0, 0, s, s); const px = s / 16, sprite = ['0011111100', '0111111110', '1101111011', '1111111111', '0110110110', '1100000011']; c.fillStyle = '#7ee0c9'; sprite.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') c.fillRect((x + 3) * px, (y + 4) * px, px - 1, px - 1); })); c.fillStyle = '#f2c46b'; c.font = `bold ${s * .1}px monospace`; c.fillText('HI-SCORE', s * .14, s * .85); c.fillStyle = '#ef7aa0'; c.fillText('99,990', s * .22, s * .95); },
    (c, s) => { c.fillStyle = '#eadcc5'; c.fillRect(0, 0, s, s); [['#c86d4a', .3], ['#7f9a86', .55], ['#e3b261', .8]].forEach(([col, x]) => { c.fillStyle = col; c.beginPath(); c.moveTo(s * (x - .14), s * .9); c.lineTo(s * (x - .14), s * .55); c.arc(s * x, s * .55, s * .14, Math.PI, 0); c.lineTo(s * (x + .14), s * .9); c.fill(); }); },
    (c, s) => { c.fillStyle = '#26323c'; c.fillRect(0, 0, s, s); for (let i = 9; i > 0; i--) { c.fillStyle = i % 2 ? '#e6a25b' : '#f1d8a8'; c.beginPath(); c.arc(s / 2, s / 2, s * .045 * i, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#26323c'; c.beginPath(); c.arc(s / 2, s / 2, s * .03, 0, Math.PI * 2); c.fill(); },
    (c, s) => { c.fillStyle = '#e2b54f'; c.fillRect(0, 0, s, s); c.fillStyle = '#3b2b25'; c.font = `bold ${s * .2}px serif`; c.fillText('GROOVE', s * .05, s * .45); c.font = `${s * .07}px serif`; c.fillText('live at the lounge', s * .08, s * .62); c.fillStyle = '#b24f3c'; c.fillRect(s * .08, s * .72, s * .84, s * .05); },
    (c, s) => { const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#f2a46b'); g.addColorStop(1, '#6f5a8f'); c.fillStyle = g; c.fillRect(0, 0, s, s); c.fillStyle = '#2b2b45'; const px = s / 20; for (let x = 0; x < 20; x++) { const top = 12 + Math.round(Math.sin(x * .7) * 2 + rand(x) * 3); c.fillRect(x * px, top * px, px, s); } c.fillStyle = '#ffe0a0'; c.fillRect(px * 13, px * 4, px * 3, px * 3); },
    (c, s) => { c.fillStyle = '#e6ebe6'; c.fillRect(0, 0, s, s); c.lineWidth = s * .035; ['#3f6d86', '#5f8fa2', '#93b6be'].forEach((col, i) => { c.strokeStyle = col; c.beginPath(); for (let x = 0; x <= s; x += 4) c.lineTo(x, s * (.35 + i * .17) + Math.sin(x * .03 + i) * s * .05); c.stroke(); }); }
];
export function buildLoungeRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, loungeZ } = layout, front = bz + d;
    const cream = material('#ffffff', { roughness: .92 }), sage = material('#5f776d', { roughness: .85 });
    const dark = material('#293b3d', { roughness: .7 }), brass = material('#b7975c', { metalness: .75, roughness: .32 });
    const trim = material('#ebe4d5', { roughness: .8 });
    // Repeated dressing (slats, records, books, leaves, fringe) is instanced:
    // one draw call per batch, with per-instance colour on a white base material.
    const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16), ball = new THREE.SphereGeometry(1, 12, 8);
    const euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), matrix = new THREE.Matrix4(), at = new THREE.Vector3(), size = new THREE.Vector3(), colour = new THREE.Color();
    const instanced = (parent, geometry, mat, items, shadow = false) => {
        const obj = new THREE.InstancedMesh(geometry, mat, items.length);
        items.forEach(item => obj.position.add(at.set(...item.at))); obj.position.divideScalar(items.length);
        items.forEach((item, i) => {
            euler.set(...(item.rot || [0, 0, 0])); matrix.compose(at.set(...item.at).sub(obj.position), quat.setFromEuler(euler), size.set(...(item.size || [1, 1, 1])));
            obj.setMatrixAt(i, matrix); if (item.color) obj.setColorAt(i, colour.set(item.color));
        });
        obj.instanceMatrix.needsUpdate = true; if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    // Flat cards (prints, sheers, light pools) share one geometry per batch;
    // uv picks a cell of an atlas texture.
    const quads = (parent, mat, items) => {
        const pos = [], uvs = [], normals = [], index = [], n = new THREE.Vector3();
        items.forEach((q, i) => {
            euler.set(...(q.rot || [0, 0, 0])); quat.setFromEuler(euler); matrix.compose(at.set(...q.at), quat, size.set(1, 1, 1)); n.set(0, 0, 1).applyQuaternion(quat);
            const [hw, hh] = [q.size[0] / 2, q.size[1] / 2], [u0, v0, u1, v1] = q.uv || [0, 0, 1, 1];
            for (const [x, y, u, v] of [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]]) {
                at.set(x, y, 0).applyMatrix4(matrix); pos.push(at.x, at.y, at.z); uvs.push(u, v); normals.push(n.x, n.y, n.z);
            }
            index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
        });
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(index);
        const obj = mesh(parent, geometry, mat); obj.castShadow = false; return obj;
    };
    // Leaves radiate (or trail) from a stem top as thin ellipsoids.
    const GREENS = ['#4f7a52', '#5f8b5b', '#3f6847', '#6d9a63', '#4a7356'];
    const foliage = (items, base, count, { length = 150, width = 45, droop = 0, seed = 0 } = {}) => {
        for (let i = 0; i < count; i++) {
            const az = i * 2.399 + seed, tilt = droop ? .9 + droop * (i / count) : .25 + .9 * i / count, l = length * (.75 + .45 * rand(seed + i)) / 2;
            items.push({ at: [base[0] + Math.sin(tilt) * Math.cos(az) * l, base[1] + Math.cos(tilt) * l, base[2] + Math.sin(tilt) * Math.sin(az) * l],
                rot: [0, -az, -tilt], size: [l, 5, width * (.8 + .4 * rand(seed + i + 9)) / 2], color: GREENS[(i + seed) % GREENS.length] });
        }
    };
    const along = (base, rot, dist) => { at.set(0, dist, 0).applyEuler(euler.set(...rot)); return [base[0] + at.x, base[1] + at.y, base[2] + at.z]; };
    const pampas = (parent, base, count, length, seed) => { const stems = []; for (let i = 0; i < count; i++) { const rot = [(rand(i + seed) - .5) * .6, 0, (rand(i + seed + 4) - .5) * .7]; stems.push({ rot, len: length * (.8 + rand(i * 3 + seed) * .3) }); }
        instanced(parent, cyl, tint, stems.map(({ rot, len }) => ({ at: along(base, rot, len / 2), size: [3, len, 3], rot, color: '#a58d66' })));
        instanced(parent, ball, tint, stems.map(({ rot, len }) => ({ at: along(base, rot, len + 30), size: [24, 80, 24], rot, color: '#eadfc6' }))); };
    const leafMat = material('#ffffff', { roughness: .62, side: THREE.DoubleSide }), tint = material('#ffffff', { roughness: .8 }), glaze = material('#ffffff', { roughness: .32 });
    const woodMap = texture((c, tw, th) => { c.fillStyle = '#836548'; c.fillRect(0, 0, tw, th); for (let i = 0; i < 6; i++) { c.fillStyle = ['#977658','#816346','#a1815f'][i%3];c.fillRect(i*tw/6,0,tw/6-2,th); c.strokeStyle = '#35251532'; for(let j=0;j<16;j++){const x=i*tw/6+j*5;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+5,th*.3,x-4,th*.7,x,th);c.stroke();} } },512,1024);
    const walnut = material('#ffffff', { map: woodMap, roughness: .62 }), slatWood = material('#ffffff', { map: woodMap, roughness: .66 });
    // Wide oak planks with staggered butt joints, knots and a satin finish.
    const plankMap = texture((c, tw, th) => {
        const cols = 8, bw = tw / cols, len = th / 2, tones = ['#93704f', '#8a684b', '#9b7855', '#8e6c4d', '#a07d5a', '#86654a'];
        c.fillStyle = '#4b3526'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < cols; i++) for (let k = -1; k < 3; k++) {
            const y0 = rand(i * 3.7) * len + k * len, x0 = i * bw, tone = tones[Math.floor(rand(i * 11 + k * 5) * tones.length)];
            const g = c.createLinearGradient(0, y0, 0, y0 + len); g.addColorStop(0, tone); g.addColorStop(.5 + rand(i + k) * .3, tones[(i + k + 2) % tones.length]); g.addColorStop(1, tone);
            c.fillStyle = g; c.fillRect(x0 + 1.5, y0 + 1.5, bw - 3, len - 3);
            for (let j = 0; j < 11; j++) {
                const x = x0 + 5 + j * (bw - 10) / 10 + rand(i * 31 + j + k) * 4; c.strokeStyle = `rgba(52,33,20,${.08 + rand(j * 7 + i + k) * .14})`; c.lineWidth = 1 + rand(j + k * 3) * 1.2;
                c.beginPath(); c.moveTo(x, y0); c.bezierCurveTo(x + 6 * Math.sin(j + k), y0 + len * .35, x - 5, y0 + len * .7, x + 2, y0 + len); c.stroke();
            }
            if (rand(i * 13 + k * 7) > .62) { c.fillStyle = 'rgba(60,38,24,.45)'; c.beginPath(); c.ellipse(x0 + bw * (.3 + rand(k + i) * .4), y0 + len * rand(i - k), 5, 11, 0, 0, Math.PI * 2); c.fill(); }
        }
    }, 1024, 1024);
    plankMap.wrapS = plankMap.wrapT = THREE.RepeatWrapping; plankMap.repeat.set(w / 1360, d / 2800);
    const floorMat = material('#ffffff', { map: plankMap, roughness: .58 });
    box(root,[w,30,d],[0,-15,bz+d/2],floorMat);
    // Hand-knotted wool rug: ivory field, terracotta and ochre borders, diamond lattice.
    const rugMap = texture((c, tw, th) => {
        c.fillStyle = '#e2d5bd'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 9000; i++) { c.fillStyle = rand(i) > .5 ? 'rgba(120,96,70,.09)' : 'rgba(255,255,255,.12)'; c.fillRect(rand(i * 3.1) * tw, rand(i * 5.7) * th, 3, 3); }
        const band = (inset, width, col) => { c.strokeStyle = col; c.lineWidth = width; c.strokeRect(inset, inset, tw - inset * 2, th - inset * 2); };
        band(30, 30, '#a55a3c'); band(66, 9, '#3f4b47'); band(90, 16, '#c79a57'); band(112, 5, '#3f4b47');
        c.save(); c.beginPath(); c.rect(122, 122, tw - 244, th - 244); c.clip();
        const step = 128; c.lineWidth = 6; c.strokeStyle = '#46504b';
        for (let n = -th; n < tw + th; n += step) { c.beginPath(); c.moveTo(n, 0); c.lineTo(n + th, th); c.stroke(); c.beginPath(); c.moveTo(n, th); c.lineTo(n + th, 0); c.stroke(); }
        for (let i = -10; i < 10; i++) for (let j = 0; j < 20; j++) {
            const x = (i + j + 1) * step / 2, y = (j - i) * step / 2, r = step * .17; if (x < 0 || x > tw || y < 0 || y > th) continue;
            c.fillStyle = (i + j) % 3 === 0 ? '#b7623f' : (i + j) % 3 === 1 ? '#7f9384' : '#d0a35e';
            c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill();
        }
        c.restore();
    }, 1024, 1024);
    const rugSize = tier ? 2700 : 2250, rugX = -w/2+(tier?1430:1190);
    box(root,[rugSize,5,rugSize],[rugX,2.5,loungeZ],material('#ffffff',{map:rugMap,roughness:1}),8);
    const fringe = [];
    for (const side of [-1, 1]) for (let x = rugX - rugSize / 2 + 30; x < rugX + rugSize / 2 - 20; x += 24) fringe.push({ at: [x, 1.5, loungeZ + side * (rugSize / 2 + 30)], size: [7, 3, 60 + rand(x) * 18], rot: [0, (rand(x * 3) - .5) * .25, 0], color: '#e8dcc6' });
    instanced(root, unit, tint, fringe);
    const group = (id,name,at=[0,0,0],turn=0,parent=root) => {const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`lounge:${layout.id}:fixture:${id}`});return g;};
    // Emissive channels: 0 warm practicals, 1 media bias, 2 arcade neon.
    const glowMats = [], glowMat = channel => glowMats[channel] ||= material('#efd0a3', { emissive: '#efd0a3', emissiveIntensity: .3 });
    const strip=(parent,size,at,channel=0)=>{const o=box(parent,size,at,glowMat(channel),2);o.castShadow=false;return o;};
    // Practical glass and shades glow with the mode's practical level.
    const practicals = [];
    const lit = (color, emissive, k, extra = {}) => { const mat = material(color, { emissive, emissiveIntensity: 0, roughness: .6, ...extra }); practicals.push({ mat, k }); return mat; };
    const opal = lit('#f4e8d2', '#ffd49a', 1.1), shadeMat = lit('#e2d4b6', '#ffcf8f', .55, { side: THREE.DoubleSide, roughness: .95 }), flame = lit('#ffd27a', '#ff9f3d', 2.4);
    // Additive light pools fake bounce from sconces, picture lights, the window and the fire.
    const washes = [];
    const additive = (map, kind, k) => { const mat = new THREE.MeshBasicMaterial({ map, color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); washes.push({ mat, kind, k }); return mat; };
    const radial = texture((c, tw, th) => { const g = c.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, tw / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, tw, th); }, 128, 128);
    const fade = texture((c, tw, th) => { const g = c.createLinearGradient(0, 0, 0, th); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, tw, th); const s = c.createLinearGradient(0, 0, tw, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(.2, 'rgba(0,0,0,0)'); s.addColorStop(.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = s; c.fillRect(0, 0, tw, th); }, 128, 128);
    const printMap = texture((c, tw, th) => { const s = tw / 4; PRINT_ART.forEach((draw, i) => { c.save(); c.translate((i % 4) * s, Math.floor(i / 4) * s); c.beginPath(); c.rect(0, 0, s, s); c.clip(); draw(c, s); c.restore(); }); }, 1024, 512);
    const printMat = material('#ffffff', { map: printMap, roughness: .85 });
    const cell = (i, inset = 0) => { const u = (i % 4) / 4, v = 1 - (Math.floor(i / 4) + 1) / 2; return [u + inset, v + inset, u + .25 - inset, v + .5 - inset]; };
    const back=new THREE.Group();back.name='Lounge walnut and sage feature wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],sage);box(back,[w,100,30],[0,50,bz+15],walnut);
    const slats=[];for(let x=-w/2+45;x<w/2;x+=85)slats.push({at:[x,h/2+20,bz+11],size:[28,h-150,22]});instanced(back,unit,slatWood,slats,true);
    strip(back,[w-100,12,12],[0,h-120,bz+35]);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const artW=tier?1600:1240,art=group('lounge-landscape','Original evening landscape',[tier>=2?0:layout.desk[0],h-540,bz+40],0,back);
    const artMap=texture((c,tw,th)=>{
        const sky=c.createLinearGradient(0,0,0,th*.7);sky.addColorStop(0,'#c9b7a8');sky.addColorStop(.6,'#ecc18b');sky.addColorStop(1,'#f3d5a2');c.fillStyle=sky;c.fillRect(0,0,tw,th);
        const sun=c.createRadialGradient(tw*.7,th*.36,0,tw*.7,th*.36,th*.55);sun.addColorStop(0,'rgba(255,236,190,.95)');sun.addColorStop(.2,'rgba(250,206,138,.55)');sun.addColorStop(1,'rgba(250,206,138,0)');c.fillStyle=sun;c.fillRect(0,0,tw,th);
        c.fillStyle='#f7e1a8';c.beginPath();c.arc(tw*.7,th*.36,th*.11,0,Math.PI*2);c.fill();
        ['#b5a596','#8d9a8a','#5f7c74','#3c5c5a','#2a4345'].forEach((col,i)=>{c.fillStyle=col;c.beginPath();c.moveTo(0,th);for(let x=0;x<=tw;x+=16)c.lineTo(x,th*(.42+i*.11)+Math.sin(x*.006+i*1.7)*th*(.05+i*.012)+Math.sin(x*.021+i)*th*.015);c.lineTo(tw,th);c.fill();});
        c.fillStyle='rgba(247,214,150,.5)';c.fillRect(tw*.6,th*.7,tw*.2,2);c.fillRect(tw*.63,th*.74,tw*.13,2);
        for(let i=0;i<5000;i++){c.fillStyle=`rgba(${rand(i)>.5?'255,255,255':'40,30,20'},.05)`;c.fillRect(rand(i*1.3)*tw,rand(i*2.9)*th,2,6);}
    },1024,512);
    box(art,[artW,620,28],[0,0,0],brass,3);box(art,[artW-60,580,6],[0,0,16],material('#f1e9d9',{roughness:.9}));box(art,[artW-150,500,4],[0,0,20],material('#ffffff',{map:artMap,roughness:.9}));
    // Brass picture light with a soft wash down the canvas.
    rod(art,[-artW*.15,345,8],[-artW*.15,395,110],7,brass);rod(art,[artW*.15,345,8],[artW*.15,395,110],7,brass);
    box(art,[artW*.5,32,58],[0,400,118],brass,6);strip(art,[artW*.46,6,26],[0,382,124]);
    quads(art,additive(fade,'practical',.4),[{at:[0,60,24],size:[artW-120,560]}]);
    const ledge = (parent, length, items) => {
        box(parent,[length,22,110],[0,0,55],walnut,3);box(parent,[length,36,14],[0,18,104],walnut,2);
        const frames = [], cards = [];
        const fit = []; let used = 0; for (const item of items) { if (used + item[0] + (fit.length ? 50 : 0) > length - 60) break; used += item[0] + (fit.length ? 50 : 0); fit.push(item); }
        let cursor = -used / 2; fit.forEach(([fw, fh, art, col]) => { const x = cursor + fw / 2; cursor += fw + 50;
            const tilt = -Math.atan2(52, fh), cy = 11 + Math.cos(tilt) * fh / 2, cz = 78 + Math.sin(tilt) * fh / 2;
            frames.push({ at: [x, cy, cz], size: [fw, fh, 18], rot: [tilt, 0, 0], color: col });
            cards.push({ at: [x, cy - Math.sin(tilt) * 10, cz + Math.cos(tilt) * 10], size: [fw - 46, fh - 46], rot: [tilt, 0, 0], uv: cell(art, .004) });
        });
        instanced(parent, unit, tint, frames); quads(parent, printMat, cards);
    };
    const arcadeX = w/2-520-436;
    // Gallery ledge beside the desk: up to the arcade in small rooms, up to the hearth in large ones.
    const x0=tier<2?layout.desk[0]+artW/2+180:layout.desk[0]+800,x1=tier<2?arcadeX-80:-1030,length=Math.min(1250,x1-x0);
    if(length>=500){
        const shelf=group('picture-ledge','Walnut picture ledge with prints',[(x0+x1)/2,1720,bz],0,back);
        ledge(shelf,length,[[280,380,2,'#2c2a29'],[220,290,6,'#b7975c'],[300,300,3,'#7a5a3e'],[180,240,7,'#e9e2d4']]);
    }
    if(tier>=2){
        const hearth=group('electric-hearth','Stone electric fireplace and hearth',[0,0,bz+160]);
        const stone=material('#b3a690',{roughness:.88});stone.userData.roomSurface='stone';
        box(hearth,[1760,70,450],[0,35,70],dark,4);box(hearth,[1600,750,300],[0,445,0],stone,5);box(hearth,[1400,360,12],[0,430,157],dark,5);
        const flameMap=texture((c,tw,th)=>{c.fillStyle='#120c0a';c.fillRect(0,0,tw,th);const ember=c.createLinearGradient(0,th*.55,0,th);ember.addColorStop(0,'rgba(0,0,0,0)');ember.addColorStop(1,'#ff7a2e');c.fillStyle=ember;c.fillRect(0,0,tw,th);for(let i=0;i<26;i++){c.fillStyle=['#f6c062','#e9813c','#ffdb8a'][i%3];c.beginPath();const x=i*tw/26;c.moveTo(x,th-30);c.quadraticCurveTo(x+50,th*.65,x+25,th*(.15+i%4*.12));c.quadraticCurveTo(x+10,th*.8,x-22,th-30);c.fill();}for(let i=0;i<9;i++){c.fillStyle='#3a2a22';c.beginPath();c.ellipse(60+i*tw/9,th-24,60,14,0,0,Math.PI*2);c.fill();}},1024,256);
        const fireMat=material('#ffffff',{map:flameMap,emissive:'#ffffff',emissiveMap:flameMap,emissiveIntensity:.3,roughness:.6});practicals.push({mat:fireMat,k:0,fire:true});
        box(hearth,[1340,305,4],[0,435,166],fireMat);
        // Walnut mantel, candles, vases and a leaning family photo.
        box(hearth,[1800,60,340],[0,850,30],walnut,4);
        const candles=[[-640,120],[-575,180],[-520,90]].map(([x,ch])=>({at:[x,880+ch/2,60],size:[26,ch,26],color:'#efe6d6'}));
        instanced(hearth,cyl,tint,candles);instanced(hearth,ball,flame,candles.map(c=>({at:[c.at[0],880+c.size[1]+16,60],size:[9,18,9]})));
        instanced(hearth,cyl,glaze,[{at:[460,1000,40],size:[60,240,60],color:'#3f5f5c'},{at:[560,950,70],size:[48,140,48],color:'#c8b79a'},{at:[640,975,30],size:[40,190,40],color:'#b86a48'}],true);
        pampas(hearth,[460,1110,40],7,260,11);
        ledge(group('mantel-photos','Mantel photos',[-120,880,bz+160+30],0,root),470,[[200,260,5,'#2c2a29'],[150,200,1,'#b7975c']]);
        quads(hearth,additive(radial,'fire',.9),[{at:[0,7,560],size:[1700,560],rot:[-Math.PI/2,0,0]},{at:[0,430,168],size:[1500,560]}]);
    }
    const right=new THREE.Group();right.name='Lounge media and arcade wall';root.add(right);
    // Warm limewash plaster with soft clouding.
    const plasterMap=texture((c,tw,th)=>{c.fillStyle='#ddd3c0';c.fillRect(0,0,tw,th);for(let i=0;i<70;i++){const g=c.createRadialGradient(0,0,0,0,0,60+rand(i)*120);g.addColorStop(0,rand(i*3)>.5?'rgba(244,236,222,.22)':'rgba(190,175,152,.12)');g.addColorStop(1,'rgba(0,0,0,0)');c.save();c.translate(rand(i*7)*tw,rand(i*11)*th);c.scale(1.6,1);c.fillStyle=g;c.fillRect(-200,-200,400,400);c.restore();}},512,512);
    cream.map=plasterMap;
    box(right,[80,h,d],[w/2+40,h/2,bz+d/2],cream);box(right,[20,100,d],[w/2-10,50,bz+d/2],walnut);
    box(right,[22,28,d],[w/2-11,2080,bz+d/2],walnut);box(right,[70,70,d],[w/2-35,h-35,bz+d/2],trim);
    room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    // Neon cove over the arcade corner.
    const neonEnd=bz+[1000,2150,3050,3050,4100][tier];strip(right,[12,10,neonEnd-bz-120],[w/2-12,h-150,(bz+neonEnd)/2],2);
    // Neon glow pools behind the arcade corner and around the sign.
    quads(right,additive(radial,'neon',.5),[{at:[w/2-14,1450,bz+700],size:[2200,2200],rot:[0,-Math.PI/2,0]},{at:[w/2-14,2250,bz+1100],size:[(tier?1800:1060)*1.5,700],rot:[0,-Math.PI/2,0]}]);
    quads(back,additive(radial,'neon',.45),[{at:[arcadeX+436,1380,bz+24],size:[1900,2300]}]);
    if(tier>=3){
        // Framed print gallery between the arcade lineup and the media wall.
        const gw=tier===4?1900:1500,gallery=group('print-gallery','Framed print gallery',[w/2-10,1150,bz+(tier===4?5100:3850)],-Math.PI/2,right),frames=[],cards=[];
        [[-gw*.34,560,420,560,0],[0,520,360,360,3],[gw*.34,580,420,560,6],[-gw*.34,0,420,420,4],[0,0,360,500,1],[gw*.34,40,420,420,7]].forEach(([x,y,fw,fh,art],i)=>{
            frames.push({at:[x,y,12],size:[fw,fh,24],color:['#2c2a29','#b7975c','#7a5a3e'][i%3]});cards.push({at:[x,y,25],size:[fw-60,fh-60],uv:cell(art,.004)});});
        instanced(gallery,unit,tint,frames,true);quads(gallery,printMat,cards);
    }
    const left=new THREE.Group();left.name='Lounge daylight and entry wall';root.add(left);
    const wz=bz+2300,ww=tier?1850:1350,low=800,wh=1450,a=wz-ww/2,b=wz+ww/2;
    box(left,[80,h,a-bz],[-w/2-40,h/2,(a+bz)/2],cream);box(left,[80,h,front-b],[-w/2-40,h/2,(front+b)/2],cream);box(left,[80,low,ww],[-w/2-40,low/2,wz],cream);box(left,[80,h-low-wh,ww],[-w/2-40,(h+low+wh)/2,wz],cream);
    box(left,[20,100,a-bz],[-w/2+10,50,(a+bz)/2],walnut);box(left,[20,100,front-b],[-w/2+10,50,(front+b)/2],walnut);box(left,[70,70,d],[-w/2+35,h-35,bz+d/2],trim);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(left,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[-w/2-52,low+wh/2,wz]);pane.rotation.y=Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(left,[65,wh+50,30],[-w/2+10,low+wh/2,z],walnut);for(const y of [low,low+wh])box(left,[65,30,ww+60],[-w/2+10,y,wz],walnut);box(left,[170,30,ww+80],[-w/2+50,low-15,wz],walnut,3);
    const curtains=[];for(const z of [a-75,b+75])for(let i=0;i<5;i++)curtains.push({at:[-w/2+60+(i%2)*14,1200,z-60+i*30],size:[24,2100,24],color:'#bdb39d'});
    instanced(left,new THREE.CylinderGeometry(1,1,1,10),material('#ffffff',{roughness:.95}),curtains,true);
    rod(left,[-w/2+75,2300,a-170],[-w/2+75,2300,b+170],10,brass);
    // Sheer linen panels and a pair of sill plants.
    const sheerMap=texture((c,tw,th)=>{c.fillStyle='#ffffff';c.fillRect(0,0,tw,th);for(let x=0;x<tw;x+=16){c.fillStyle=`rgba(190,180,160,${.15+.15*Math.sin(x*.4)})`;c.fillRect(x,0,8,th);}},128,64);
    const sheer=material('#f5efe3',{map:sheerMap,transparent:true,opacity:.5,side:THREE.DoubleSide,roughness:1});
    quads(left,sheer,[[a+ww*.11],[b-ww*.11]].map(([z])=>({at:[-w/2+92,(low+40+2290)/2,z],size:[ww*.22,2290-low-40],rot:[0,Math.PI/2,0]})));
    const sill=[[wz-ww*.17,'#b9673f'],[wz+ww*.14,'#e7e0d2']],sillLeaves=[];
    instanced(left,cyl,glaze,sill.map(([z,col])=>({at:[-w/2+62,low+60,z],size:[62,120,62],color:col})),true);
    sill.forEach(([z],i)=>foliage(sillLeaves,[-w/2+62,low+120,z],i?11:14,{length:i?260:190,width:i?60:40,droop:i?0:1.1,seed:i*5}));
    instanced(left,ball,leafMat,sillLeaves);
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    // A pool of window light on the floor; its length and tint follow the sun.
    const sunCanvas=document.createElement('canvas');sunCanvas.width=sunCanvas.height=256;const sunMap=new THREE.CanvasTexture(sunCanvas);sunMap.colorSpace=THREE.SRGBColorSpace;
    const sunMat=additive(sunMap,'sun',1),sunPool=mesh(root,new THREE.PlaneGeometry(1,1),sunMat,[0,7,wz]);sunPool.rotation.x=-Math.PI/2;sunPool.castShadow=sunPool.receiveShadow=false;sunPool.name='Lounge window light pool';
    const media=group('media-console','Walnut media console and bias lighting',[w/2-200,0,loungeZ],-Math.PI/2);
    box(media,[1650,500,340],[0,345,0],walnut,5);for(const x of [-700,700])for(const z of [-100,100])rod(media,[x,0,z],[x,95,z],12,brass);box(media,[1700,55,380],[0,622.5,0],walnut,4);
    for(const x of [-530,0,530])box(media,[490,430,12],[x,345,177],dark,3);strip(media,[1570,8,8],[0,130,191],1);strip(media,[1400,12,10],[0,1040,-75],1);
    instanced(media,cyl,brass,[-530,0,530].map(x=>({at:[x,470,190],size:[7,120,7],rot:[0,0,Math.PI/2]})));
    // Bookshelf speakers, soundbar and brass sconces with soft wall washes.
    instanced(media,unit,tint,[-735,735].map(x=>({at:[x,800,-10],size:[170,300,220],color:'#5a4130'})),true);
    instanced(media,unit,tint,[-735,735].map(x=>({at:[x,800,102],size:[150,270,6],color:'#2d2f30'})));
    instanced(media,cyl,brass,[-735,735].flatMap(x=>[[x,860],[x,745]].map(([sx,y])=>({at:[sx,y,106],size:y>800?[22,4,22]:[48,4,48],rot:[Math.PI/2,0,0]}))));
    box(media,[880,52,80],[0,676,142],material('#2a2c2e',{roughness:.5}),6);
    for(const x of [-735,735]){mesh(media,new THREE.CylinderGeometry(55,55,14,24),brass,[x,1480,-193]).rotation.x=Math.PI/2;rod(media,[x,1480,-190],[x,1500,-90],9,brass);sphere(media,[78,78,78],[x,1520,-80],opal).castShadow=false;}
    quads(media,additive(radial,'practical',.75),[-735,735].map(x=>({at:[x,1520,-186],size:[560,1150]})));
    quads(media,additive(radial,'bias',.55),[{at:[0,1030,-186],size:[2000,1000]}]);
    const filmMap=texture((c,tw,th)=>{const sky=c.createLinearGradient(0,0,0,th);sky.addColorStop(0,'#283c57');sky.addColorStop(1,'#e2ba82');c.fillStyle=sky;c.fillRect(0,0,tw,th);c.fillStyle='#f3d69e';c.beginPath();c.arc(tw*.7,th*.3,th*.13,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){c.fillStyle=['#748b87','#3c625f','#234647'][i];c.beginPath();c.moveTo(0,th);for(let x=0;x<=tw;x+=32)c.lineTo(x,th*(.48+i*.16)+Math.sin(x*.012+i)*35);c.lineTo(tw,th);c.fill();}c.fillStyle='#f5e3c9';c.font='28px serif';c.fillText('THE LONG WAY HOME',40,th-45);},1024,576);
    // Library props are shared clones, so their dressing uses untagged materials.
    const pillowGeo=new THREE.SphereGeometry(1,18,12),pp=pillowGeo.attributes.position;
    for(let i=0;i<pp.count;i++){const x=pp.getX(i),y=pp.getY(i),z=pp.getZ(i),sx=Math.sign(x)*Math.abs(x)**.35,sy=Math.sign(y)*Math.abs(y)**.35,edge=Math.max(Math.abs(sx),Math.abs(sy));pp.setXYZ(i,sx,sy,z*(1-.75*edge**6));}
    pillowGeo.computeVertexNormals();
    const pillow=material('#ffffff',{roughness:.95}),knitMap=texture((c,tw,th)=>{c.fillStyle='#c9ae86';c.fillRect(0,0,tw,th);for(let y=0;y<th;y+=16)for(let x=0;x<tw;x+=12){c.fillStyle=(y/16)%4<1?'#a85a3e':'rgba(90,66,44,.3)';c.beginPath();c.ellipse(x+6,y+8,4,7,(x/12)%2?.5:-.5,0,Math.PI*2);c.fill();}},128,128);
    knitMap.wrapS=knitMap.wrapT=THREE.RepeatWrapping;knitMap.repeat.set(2,2);const knit=material('#ffffff',{map:knitMap,roughness:1});
    // Measured seat height, back-cushion face and front edge of each sofa (metres).
    const SOFAS={'sofa-leather-wood':{seat:.26,back:-.04,front:.33,arm:.76},'sofa-fabric':{seat:.43,back:.14,front:.45,arm:.86}};
    room.decorateProp=(object,placement)=>{
        if(placement.id==='samsung-neo-tv'){const display=mesh(object,new THREE.PlaneGeometry(1.094,.615),new THREE.MeshBasicMaterial({map:filmMap,toneMapped:false}),[0,.3521,.0108]);display.name='Lounge cinema display';display.castShadow=display.receiveShadow=false;return;}
        const sofa=SOFAS[placement.id];if(!sofa)return;
        const {seat,back:bk,front:fr,arm}=sofa,pillows=[[-arm,'#b86a48',.25],[-arm+.3,'#d6a756',-.12],[arm-.04,'#6f8a7a',-.28]];
        const dressing=instanced(object,pillowGeo,pillow,pillows.map(([x,col,yaw])=>({at:[x,seat+.16,bk+.06],size:[.18,.17,.075],rot:[-.3,yaw,(x>0?-1:1)*.06],color:col})),true);dressing.name='Lounge throw pillows';
        const fold=box(object,[.4,.07,.3],[arm-.24,seat+.035,fr-.19],knit,.025);fold.rotation.y=.12;fold.name='Lounge knit throw';
    };
    const lamp=group('reading-lamp','Brass reading lamp',[layout.sofaX+140,0,loungeZ-(tier?1550:1270)]);
    mesh(lamp,new THREE.CylinderGeometry(110,125,20,24),brass,[0,10,0]);rod(lamp,[0,20,0],[0,1550,0],12,brass);
    mesh(lamp,new THREE.CylinderGeometry(130,200,250,24,1,true),shadeMat,[0,1580,0]);strip(lamp,[60,8,60],[0,1460,0]);
    mesh(lamp,new THREE.CylinderGeometry(132,132,6,24),brass,[0,1706,0]);
    // Round walnut side table with books, a succulent and a candle.
    const sideAt=tier?[layout.sofaX-120,0,loungeZ+1100+200]:[layout.sofaX-220,0,loungeZ-1200];
    const side=group('side-table','Walnut side table with books and candle',sideAt);
    mesh(side,new THREE.CylinderGeometry(185,185,28,32),walnut,[0,516,0]);mesh(side,new THREE.CylinderGeometry(150,165,14,28),brass,[0,7,0]);rod(side,[0,14,0],[0,502,0],20,brass);
    instanced(side,unit,tint,[[0,'#3f5f5c',210,150],[1,'#c4a46e',190,140],[2,'#9b4f3f',170,125]].map(([i,col,bw,bd])=>({at:[-40,530+20+i*32,-20],size:[bw,30,bd],rot:[0,.25-i*.3,0],color:col})),true);
    instanced(side,cyl,glaze,[{at:[72,575,66],size:[46,70,46],color:'#ece6da'},{at:[-45,642,-30],size:[34,50,34],color:'#efe5d2'}],true);
    const succulent=[];foliage(succulent,[72,612,66],12,{length:110,width:38,seed:3});instanced(side,ball,leafMat,succulent);
    sphere(side,[8,16,8],[-45,682,-30],flame).castShadow=false;
    // Listening station: record cabinet, turntable and album wall.
    const station=tier<2?group('listening-station','Walnut record cabinet and turntable',[w/2-230,0,tier?bz+2585:bz+1500],-Math.PI/2):group('listening-station','Walnut record cabinet and turntable',[(880+arcadeX)/2,0,bz+230]);
    instanced(station,unit,slatWood,[{at:[0,568,0],size:[920,24,410]},{at:[0,122,0],size:[900,24,400]},{at:[-440,345,0],size:[24,430,400]},{at:[440,345,0],size:[24,430,400]},{at:[0,345,0],size:[20,430,390]},{at:[0,345,-194],size:[880,430,12]}],true);
    instanced(station,cyl,brass,[-400,400].flatMap(x=>[-160,160].map(z=>({at:[x,55,z],size:[11,110,11]}))));
    const SLEEVES=['#2f2a29','#b86a48','#d6a756','#3f5f5c','#e9e2d4','#6f8a7a','#7c3f52','#26323c','#c8b79a','#9b4f3f'],records=[];
    for(const side of [-1,1])for(let i=0;i<34;i++){const x=side*(30+i*11.5)+(side<0?-8:8);if(Math.abs(x)>420)continue;records.push({at:[x,136+157,-10],size:[8,312,300],rot:[0,0,(rand(i+side*40)-.5)*.05],color:SLEEVES[Math.floor(rand(i*3+side*17)*SLEEVES.length)]});}
    instanced(station,unit,tint,records);
    box(station,[440,80,340],[-170,620,0],material('#4a3729',{roughness:.45}),8);
    mesh(station,new THREE.CylinderGeometry(150,150,16,40),material('#3a3d40',{metalness:.6,roughness:.35}),[-200,668,0]);
    mesh(station,new THREE.CylinderGeometry(146,146,3,40),material('#111214',{roughness:.25}),[-200,678,0]);mesh(station,new THREE.CylinderGeometry(44,44,2,24),material('#d6a756'),[-200,680.5,0]);
    mesh(station,new THREE.CylinderGeometry(20,24,30,16),brass,[-10,675,-110]);rod(station,[-10,690,-110],[-140,686,60],5,brass);
    instanced(station,cyl,glaze,[{at:[260,700,-20],size:[70,240,70],color:'#c8b79a'}],true);
    pampas(station,[260,810,-20],9,360,2);
    const covers=group('album-wall','Album wall above the record cabinet',[0,1220,-228],0,station);
    box(covers,[940,26,60],[0,0,30],walnut,2);box(covers,[940,30,10],[0,22,58],walnut,2);
    quads(covers,printMat,[[-310,0],[0,4],[310,5]].map(([x,i])=>({at:[x,13+150,30],size:[290,290],rot:[-.12,0,0],uv:cell(i)})));
    box(covers,[760,26,200],[0,520,100],walnut,3);
    instanced(covers,unit,tint,[...Array(16)].map((_,i)=>({at:[-340+i*24+(i>9?40:0),533+90+(rand(i)-.5)*30,100],size:[20,170+rand(i*5)*40,150+rand(i)*30],rot:[0,0,i===15?.32:0],color:SLEEVES[(i*3)%SLEEVES.length]})),true);
    instanced(covers,cyl,glaze,[{at:[230,533+55,100],size:[60,110,60],color:'#b86a48'}],true);
    const pothos=[];for(let i=0;i<24;i++){const vine=i%3,t=Math.floor(i/3)/8;pothos.push({at:[200+vine*40+Math.sin(i)*20,533+70-t*560,212+vine*8+Math.cos(i*1.3)*10],size:[30,4,22],rot:[.9,i*1.7,.4],color:GREENS[i%GREENS.length]});}
    foliage(pothos,[230,533+110,122],10,{length:130,width:50,seed:7});instanced(covers,ball,leafMat,pothos);
    const arcSign=group('arcade-sign','PLAY TOGETHER illuminated sign',[w/2-36,2250,bz+1100],-Math.PI/2,right);
    const signMap=texture((c,tw,th)=>{c.fillStyle='#1f2b33';c.fillRect(0,0,tw,th);c.strokeStyle='#6fd6cf';c.lineWidth=6;c.shadowColor='#6fd6cf';c.shadowBlur=16;c.strokeRect(22,22,tw-44,th-44);c.font='bold 64px sans-serif';c.textAlign='center';c.shadowColor='#ffcf8a';c.shadowBlur=22;c.fillStyle='#ffe2ad';c.fillText('PLAY TOGETHER',tw/2,102);},1024,160);
    const signMat=material('#ffffff',{map:signMap,emissive:'#ffffff',emissiveMap:signMap,emissiveIntensity:.4});
    box(arcSign,[tier?1800:1060,220,18],[0,0,0],brass,4);box(arcSign,[tier?1750:1010,175,4],[0,0,13],signMat);
    if(tier>=3){
        const bar=group('lounge-bar','Walnut refreshments bar and display',[ -w/2+350,0,bz+3550],Math.PI/2);
        box(bar,[1640,820,550],[0,440,0],walnut,4);box(bar,[1570,60,480],[0,30,0],dark);box(bar,[1740,50,650],[0,905,0],material('#ad9c81'),4);
        instanced(bar,unit,slatWood,[...Array(25)].map((_,i)=>({at:[-740+i*60,440,283],size:[22,760,15]})));
        box(bar,[1660,16,30],[0,935,320],brass,2);
        const bottles=[],caps=[],BOTTLES=['#65796a','#ac815c','#7c3f52','#c9a35b','#3f5f5c','#d9cbb0'];
        for(const [row,y] of [[0,1530],[1,1970]])for(let i=0;i<11;i++){const tall=170+rand(i+row*20)*90,r=26+rand(i*3+row)*16,x=-700+i*140+(row?40:0);bottles.push({at:[x,y+17.5+tall/2,-80],size:[r,tall,r],color:BOTTLES[(i+row*3)%BOTTLES.length]});caps.push({at:[x,y+17.5+tall+20,-80],size:[11,40,11]});}
        instanced(bar,cyl,material('#ffffff',{roughness:.22,metalness:.1}),bottles,true);instanced(bar,cyl,brass,caps);
        for(const y of [1530,1970]){box(bar,[1660,35,290],[0,y,-100],walnut,3);strip(bar,[1550,8,10],[0,y-24,45]);}
        instanced(bar,cyl,material('#e8eef0',{roughness:.12,metalness:.2}),[-420,-340,-260,380,450].map((x,i)=>({at:[x,930+(i<3?55:70),40+(i%2)*60],size:[i<3?36:30,i<3?110:140,i<3?36:30]})),true);
    }
    if(tier===4){
        const pool=group('billiard-table','Original billiard table and cue stand',[1100,0,bz+3600]);
        for(const x of [-850,850])for(const z of [-450,450])box(pool,[140,650,140],[x,325,z],walnut,5);
        box(pool,[2280,230,1300],[0,695,0],walnut,8);box(pool,[2070,18,1090],[0,819,0],material('#3e7e72',{roughness:1}),5);
        for(const z of [-610,610])box(pool,[2190,70,85],[0,820,z],dark,8);for(const x of [-1100,1100])box(pool,[85,70,1140],[x,820,0],dark,8);
        for(const x of [-1060,0,1060])for(const z of [-560,560])mesh(pool,new THREE.CylinderGeometry(60,60,18,20),dark,[x,852,z]);
        const colors=['#f3e6b9','#bd723e','#6596a1','#aa5364','#514f74','#c8b756'];instanced(pool,ball,glaze,[...colors.map((col,i)=>({at:[(i%3-1)*65,856,Math.floor(i/3)*70-35],size:[28,28,28],color:col})),{at:[-600,856,100],size:[28,28,28],color:'#f4efe4'}],true);
        rod(pool,[-930,890,460],[780,890,490],7,walnut);
    }
    const ceiling=new THREE.Group();ceiling.name='Lounge sculptural pendant';root.add(ceiling);room.ceilingFixture=ceiling;
    const center=[layout.tableX+150,loungeZ];mesh(ceiling,new THREE.CylinderGeometry(90,90,24,24),brass,[center[0],h-12,center[1]]);
    for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,x=center[0]+Math.cos(angle)*260,z=center[1]+Math.sin(angle)*260,y=h-500-i%2*100;rod(ceiling,[center[0],h,center[1]],[x,y,z],5,brass);sphere(ceiling,[95,95,95],[x,y-70,z],opal).castShadow=false;strip(ceiling,[40,8,40],[x,y-165,z]);}
    if(tier===4){
        // Billiard pendant: three green enamel shades on a brass bar.
        const [px,pz]=[1100,bz+3600];rod(ceiling,[px-600,h,pz],[px-600,h-1650,pz],4,brass);rod(ceiling,[px+600,h,pz],[px+600,h-1650,pz],4,brass);box(ceiling,[1500,24,24],[px,h-1650,pz],brass,3);
        for(const x of [-550,0,550]){mesh(ceiling,new THREE.CylinderGeometry(70,210,170,28,1,true),material('#2f5e4f',{side:THREE.DoubleSide,roughness:.45,metalness:.3}),[px+x,h-1750,pz]);sphere(ceiling,[60,40,60],[px+x,h-1810,pz],opal).castShadow=false;}
    }
    const lights=[{at:[layout.desk[0],1800,layout.desk[1]-130],power:2.9,task:true},{at:[w/2-480,1250,loungeZ],power:3,channel:1},{at:[lamp.position.x,1450,lamp.position.z],power:2.6,task:true},{at:[tier>=3?-w/2+700:layout.tableX,1800,tier>=3?bz+3500:loungeZ],power:3.4}].map(spec=>{const light=new THREE.PointLight('#f3cf9e',0,4500*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    const SKY={
        morning:{hills:['#a9bdb4','#86a497','#6e8f7d'],sun:[.22,.42,34,'#fff4d8'],city:'#9fb2b7',clouds:.35},
        afternoon:{hills:['#a7bcae','#829f8a','#647f6b'],sun:[.5,.08,30,'#fffbe8'],city:'#a3b4bb',clouds:.4},
        evening:{hills:['#b48f8e','#8a6f7c','#5a4d5f'],sun:[.66,.66,58,'#ffd38a'],city:'#6c5a6a',clouds:.25,windows:.4},
        night:{hills:['#22324a','#1a283b','#121c2b'],moon:[.72,.2],city:'#141f30',stars:1,windows:1},
        party:{hills:['#5b5679','#463f62','#2e2c48'],moon:[.25,.18],city:'#2a2944',stars:.6,windows:1}
    };
    const drawSky=(mode,id)=>{
        const c=skyCanvas.getContext('2d'),s=512,v=SKY[id]||SKY.afternoon,grad=c.createLinearGradient(0,0,0,s);grad.addColorStop(0,mode.sky[0]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,s,s);
        if(v.stars)for(let i=0;i<90;i++){c.fillStyle=`rgba(255,255,240,${(.3+rand(i)*.6)*v.stars})`;c.fillRect(rand(i*2.1)*s,rand(i*4.3)*s*.6,1.5,1.5);}
        if(v.sun){const [x,y,r,col]=v.sun,g=c.createRadialGradient(x*s,y*s,0,x*s,y*s,r*5);g.addColorStop(0,col);g.addColorStop(.25,col+'88');g.addColorStop(1,col+'00');c.fillStyle=g;c.fillRect(0,0,s,s);c.fillStyle=col;c.beginPath();c.arc(x*s,y*s,r,0,Math.PI*2);c.fill();}
        if(v.moon){const [x,y]=v.moon;c.fillStyle='#f3efd8';c.beginPath();c.arc(x*s,y*s,20,0,Math.PI*2);c.fill();c.fillStyle=mode.sky[0];c.beginPath();c.arc(x*s+9,y*s-5,18,0,Math.PI*2);c.fill();}
        if(v.clouds)for(let i=0;i<7;i++){c.fillStyle=`rgba(255,255,255,${v.clouds*(.5+rand(i)*.5)})`;c.beginPath();c.ellipse(rand(i*3.3)*s,s*(.12+rand(i*5.1)*.3),50+rand(i)*60,10+rand(i*2)*8,0,0,Math.PI*2);c.fill();}
        v.hills.slice(0,1).forEach(col=>{c.fillStyle=col;c.beginPath();c.moveTo(0,s);for(let x=0;x<=s;x+=8)c.lineTo(x,s*.62+Math.sin(x*.011)*22+Math.sin(x*.037)*8);c.lineTo(s,s);c.fill();});
        c.fillStyle=v.city;for(let i=0;i<16;i++){const bw=18+rand(i)*26,bh=40+rand(i*7)*110,x=i*34+rand(i*3)*10;c.fillRect(x,s*.78-bh,bw,bh+s*.3);if(v.windows)for(let wy=s*.78-bh+8;wy<s*.78;wy+=12)for(let wx=x+4;wx<x+bw-4;wx+=8)if(rand(wx*wy)>.55){c.fillStyle=`rgba(255,214,150,${v.windows*.9})`;c.fillRect(wx,wy,3,5);c.fillStyle=v.city;}}
        v.hills.slice(1).forEach((col,i)=>{c.fillStyle=col;c.beginPath();c.moveTo(0,s);for(let x=0;x<=s;x+=6)c.lineTo(x,s*(.8+i*.08)+Math.sin(x*.05+i)*10+(rand(Math.floor(x/18)+i*40)-.5)*16);c.lineTo(s,s);c.fill();});
        skyMap.needsUpdate=true;
        // Window light pool: two soft panes, skewed with the sun's sweep.
        const p=sunCanvas.getContext('2d');p.clearRect(0,0,256,256);p.filter='blur(7px)';const skew=mode.sunShift/(mode.sunLength||1)*.6,falloff=p.createLinearGradient(0,0,256,0);falloff.addColorStop(0,'#ffffff');falloff.addColorStop(.6,'rgba(255,255,255,.75)');falloff.addColorStop(1,'rgba(255,255,255,.1)');p.fillStyle=falloff;
        for(const [z0,z1] of [[.06,.47],[.53,.94]]){p.beginPath();p.moveTo(16,z0*256);p.lineTo(16,z1*256);p.lineTo(240,(z1+skew)*256);p.lineTo(240,(z0+skew)*256);p.fill();}
        p.filter='none';sunMap.needsUpdate=true;
        sunPool.scale.set(mode.sunLength,ww,1);sunPool.position.set(-w/2+180+mode.sunLength/2,7,wz+mode.sunShift*.25);sunPool.visible=mode.sun>0;
    };
    const tone={practical:()=>'#ffd29a',bias:m=>m.colors[1],neon:m=>m.colors[2],sun:m=>m.sunColor,fire:()=>'#ff9a4a'};
    room.roomAtmosphere=(id,accent=1)=>{const mode=LOUNGE_MODES[id]||LOUNGE_MODES.afternoon;drawSky(mode,id);
        glowMats.forEach((mat,channel)=>{if(!mat)return;const color=mode.colors[channel]||mode.colors[0];mat.color.set(color);mat.emissive.set(color);mat.emissiveIntensity=.1+(channel===2?mode.neon:mode.wash)*accent;});
        practicals.forEach(({mat,k,fire})=>{mat.emissiveIntensity=fire?.15+mode.fire*1.4*accent:.05+k*mode.practical*accent;});
        signMat.emissiveIntensity=.15+mode.neon*.9*accent;
        const level={practical:mode.practical,bias:mode.wash,neon:mode.neon,sun:mode.sun,fire:mode.fire};
        washes.forEach(({mat,kind,k})=>{mat.color.set(tone[kind](mode));mat.opacity=Math.min(1,k*level[kind]*accent);});
        lights.forEach(spec=>{spec.light.color.set(spec.task?'#ffe0b6':mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;};
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [trim, 'plaster'], [sage, 'powder'], [dark, 'powder'], [brass, 'metal'], [walnut, 'wood'], [floorMat, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
