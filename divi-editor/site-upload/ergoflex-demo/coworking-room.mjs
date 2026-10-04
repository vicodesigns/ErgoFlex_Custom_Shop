import * as THREE from 'three';

// Measured shared spaces. Millimetres throughout, with usable aisles and
// native-size library furniture. The active ErgoFlex is the rear-left station.
const sizes = [
    ['apartment', 'Neighbourhood work lounge', 5400, 6800, 3000, 2],
    ['house', 'Community workspace', 7200, 8200, 3100, 3],
    ['spacious', 'Co-working hub', 9000, 10000, 3300, 4],
    ['premium', 'Members club workspace', 11000, 12000, 3600, 5],
    ['executive', 'Flagship co-working floor', 14000, 15000, 4200, 6]
];
const roles = [
    { id: 'digital', name: 'Digital creator', height: 28, tilt: 0,
        desktop: [{ id: 'drawing-tablet', at: [-240, 0, 90] }, { id: 'apple-pencil', at: [-40, 0, 90], turn: 15 }, { id: 'office-keyboard', at: [240, 0, -155] }], shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] },
    { id: 'remote', name: 'Remote collaborator', height: 43.5, tilt: -5,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-150, 0, 0] }, { id: 'glasses', at: [260, 0, 110] }], shelf: [{ id: 'kenney-furniture-books', at: [-300, 0, 0] }] },
    { id: 'illustrator', name: 'Illustrator', height: 43.5, tilt: 25, plan: true,
        desktop: [{ id: 'metal-ruler', at: [-350, 1, 70], turn: 90 }, { id: 'apple-pencil', at: [280, 1, 140], turn: 70 }], shelf: [{ id: 'paper-stand', at: [300, 0, 0] }] },
    { id: 'research', name: 'Research & writing', height: 28, tilt: 0,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-120, 0, 0] }, { id: 'journal', at: [300, 0, 150] }], shelf: [{ id: 'paper-holder', at: [-300, 0, 0] }] },
    { id: 'founder', name: 'Founder', height: 43.5, tilt: -5,
        desktop: [{ id: 'office-keyboard', at: [-100, 0, 90] }, { id: 'magic-mouse', at: [340, 0, 80] }], shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] }
];
export const COWORKING_LAYOUTS = Object.fromEntries(sizes.map(([id, name, width, depth, height, count], index) => {
    const back = -depth / 3, front = back + depth, left = -width / 2 + 1200, right = -left;
    const desk = [left, back + 1100];
    const positions = [[right, back + 1100], [left, back + 3900], [right, back + 3900], [0, back + 1100], [0, back + 3900]];
    const stations = roles.slice(0, count - 1).map((role, i) => ({ ...role, at: positions[i] }));
    const lounge = [-width / 2 + (index === 0 ? 700 : 1450), front - (index === 0 ? 850 : 650)];
    const meeting = index > 0 ? [width / 2 - 2000, front - 2300] : [width / 2 - 950, front - 1200];
    const cafe = [width / 2 - 350, back + (index > 1 ? 6600 : 3450)];
    const focus = index >= 2 ? [-width / 2 + 850, front - 3300] : null;
    const call = index >= 3 ? [width / 2 - 800, front - 5100] : null;
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1050], turn: 180 }];
    for (const s of stations) props.push({ id: 'steelcase-leap-v2', at: [s.at[0], 0, s.at[1] + 1050], turn: 180 });
    if (index === 0) props.push({ id: 'kenney-furniture-lounge-chair', at: [lounge[0], 0, lounge[1]] });
    else props.push({ id: 'kenney-furniture-lounge-sofa', at: [lounge[0], 0, lounge[1]] },
        { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 980] },
        { id: 'journal', at: [lounge[0] - 270, 391.2, lounge[1] - 1000] }, { id: 'tea-cup', at: [lounge[0] + 290, 391.2, lounge[1] - 950] });
    if (index === 0) for (const dx of [-600, 600]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [meeting[0] + dx, 0, meeting[1]], turn: dx < 0 ? 90 : -90 });
    else for (const dx of [-650, 650]) for (const dz of [-900, 900]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [meeting[0] + dx, 0, meeting[1] + dz], turn: dz > 0 ? 180 : 0 });
    props.push({ id: 'kenney-furniture-kitchen-coffee-machine', at: [cafe[0], 900, cafe[1] - 550], turn: -90 },
        { id: 'tea-cup', at: [cafe[0] - 60, 900, cafe[1] + 50] }, { id: 'decor-plant1', at: [cafe[0], 900, cafe[1] + 750] },
        { id: 'monstera', at: [width / 2 - 530, 0, front - 550] });
    if (focus) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [focus[0], 0, focus[1] + 280], turn: 180 },
        { id: 'kenney-furniture-laptop', at: [focus[0], 740, focus[1] - 480] });
    return [id, { id, name, width, depth, height, back, index, desk, stations, lounge, meeting, cafe, focus, call, props, daylight: [-width / 2 + 100, back + depth * .4] }];
}));
export const coworkingLayoutById = id => COWORKING_LAYOUTS[id] || COWORKING_LAYOUTS.apartment;
export const coworkingLayoutForSize = size => COWORKING_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const COWORKING_MODES = {
    morning: { label: 'Morning', description: 'Arrive & focus · daylight and standing work', key: '#fff0d8', fill: '#d8e9ee', accent: '#c0d6c5', power: 1.5, ambient: .46, bounce: .66, exposure: 1.08, sky: ['#8abed6', '#f5e6cb'], practical: .25, wash: .22, colors: ['#ffe4b5', '#96c7b5'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Shared ideas · seated work and collaboration', key: '#fff4e2', fill: '#dceaf0', accent: '#c6dccc', power: 1.2, ambient: .47, bounce: .65, exposure: 1.08, sky: ['#acd0df', '#f0edde'], practical: .38, wash: .32, colors: ['#f5e2bc', '#aecac4'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden hour · warm pendants and creative work', key: '#f8d0a5', fill: '#bdcddd', accent: '#d8b48b', power: .68, ambient: .34, bounce: .45, exposure: 1.12, sky: ['#809ab4', '#dfa978'], practical: .85, wash: .65, colors: ['#ffcc92', '#a3c5ba'], height: 43.5, tilt: 18, offset: [0, 100], yaw: 0, leds: true, color: '#ffdfa6' },
    night: { label: 'Night', description: 'Quiet hours · task lighting and low ambient', key: '#bacdde', fill: '#a5b5ca', accent: '#e2b78b', power: .24, ambient: .22, bounce: .3, exposure: 1.15, sky: ['#172d44', '#526b83'], practical: 1, wash: .45, colors: ['#eebf8e', '#a6b7c4'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe2b0' },
    party: { label: 'Community social', description: 'Meet & connect · café lighting and an open desk', key: '#edd6bc', fill: '#b4cbdc', accent: '#be8983', power: .45, ambient: .32, bounce: .42, exposure: 1.12, sky: ['#516c8a', '#bda190'], practical: .6, wash: .95, colors: ['#ffc18f', '#da9b9f'], height: 43.5, tilt: -5, offset: [150, 320], yaw: -14, leds: true, color: '#ffab74' }
};
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
export function buildCoworkingRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index, cafe, meeting, lounge, focus, call } = layout, front = bz + d;
    const chalk = material('#e4e0d5', { roughness: .92 }), sage = material('#6d8781', { roughness: .9 }), ink = material('#263d46');
    const oak = material('#b49166', { roughness: .76 }), clay = material('#b87962', { roughness: .88 }), brass = material('#ae9871', { metalness: .6, roughness: .36 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `coworking:${layout.id}:fixture:${id}` }); };
    const group = (id, name, at = [0, 0, 0], parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g); register(g, id, name); return g; };
    const floorMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#c7c5bc'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 900; i++) { c.fillStyle = ['#eeede33c', '#696f6224', '#b995761c'][i % 3]; c.fillRect(i * 83 % tw, i * 137 % th, 1 + i % 3, 1 + i % 2); }
        c.strokeStyle = '#858a7928'; c.strokeRect(0, 0, tw, th);
    }); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 1200, d / 1200);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .94 }));
    const rugMap = canvasMap(c => { c.fillStyle = '#738b86'; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#d9dfd328'; c.lineWidth = 1; for (let y = 0; y < 512; y += 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); } });
    const rug = material('#ffffff', { map: rugMap, roughness: 1 });
    for (const [i, at] of [layout.desk, ...layout.stations.map(s => s.at)].entries()) {
        box(root, [1850, 4, 2000], [at[0], 2, at[1] + 450], i ? material('#90918a', { roughness: 1 }) : rug, 8);
    }
    const back = new THREE.Group(); back.name = 'Co-working community wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], chalk); box(back, [w, 1050, 40], [0, 525, bz + 20], sage);
    for (let x = -w / 2 + 90; x < w / 2; x += 180) box(back, [32, 1020, 18], [x, 510, bz + 48], oak, 2);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const brand = group('community-sign', 'COMMON / GROUND community sign', [0, 2300, bz + 60], back);
    const brandMap = canvasMap(c => { c.fillStyle = '#e8e3d5'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#304f52'; c.font = 'bold 76px sans-serif'; c.fillText('COMMON / GROUND', 40, 115); c.fillStyle = '#986a54'; c.font = '24px sans-serif'; c.fillText('WORK   •   SHARE   •   MAKE   •   BELONG', 48, 180); }, 1024, 256);
    box(brand, [index ? 2900 : 2200, 600, 35], [0, 0, 0], oak, 8); box(brand, [index ? 2840 : 2140, 540, 8], [0, 0, 23], material('#ffffff', { map: brandMap }));
    const right = new THREE.Group(); right.name = 'Co-working café wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], chalk); box(right, [20, 85, d], [w / 2 - 10, 42.5, bz + d / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const window = new THREE.Group(); window.name = 'Co-working city windows'; root.add(window);
    const ww = Math.min(5600, d * .58), wz = bz + d * .4, low = 780, wh = Math.min(2150, h - 1050), a = wz - ww / 2, b = wz + ww / 2;
    for (const [length, z] of [[a - bz, (a + bz) / 2], [front - b, (front + b) / 2]]) box(window, [80, h, length], [-w / 2 - 40, h / 2, z], chalk);
    box(window, [80, low, ww], [-w / 2 - 40, low / 2, wz], chalk); box(window, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], chalk);
    const skyMap = canvasMap(() => {}), sky = skyMap.image;
    const pane = mesh(window, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (let z = a; z <= b + 1; z += ww / 4) box(window, [55, wh + 35, 32], [-w / 2 + 16, low + wh / 2, z], ink);
    for (const y of [low, low + wh]) box(window, [55, 35, ww + 40], [-w / 2 + 16, y, wz], ink);
    room.walls.push({ obj: window, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const coffee = group('cafe-counter', 'Community café counter', [cafe[0], 0, cafe[1]]); coffee.rotation.y = -Math.PI / 2;
    box(coffee, [2200, 865, 580], [0, 432.5, 0], clay, 8); box(coffee, [2250, 35, 640], [0, 882.5, 0], oak, 7);
    for (const x of [-720, 0, 720]) { box(coffee, [660, 740, 20], [x, 440, 299], ink, 3); rod(coffee, [x, 660, 315], [x + 150, 660, 315], 6, brass); }
    const menu = group('cafe-menu', 'Coffee & community menu', [w / 2 - 30, 1880, cafe[1]], right); menu.rotation.y = -Math.PI / 2;
    const menuMap = canvasMap(c => { c.fillStyle = '#31474c'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#eee6d2'; c.font = 'bold 42px sans-serif'; c.fillText('TAKE A BREAK', 42, 80); c.font = '26px sans-serif'; ['COFFEE / TEA', 'GOOD CONVERSATION', 'NEW IDEAS WELCOME'].forEach((s, i) => c.fillText(s, 42, 190 + i * 80)); c.strokeStyle = '#b99570'; c.strokeRect(20, 20, 472, 472); });
    box(menu, [950, 1000, 25], [0, 0, 0], material('#ffffff', { map: menuMap }));
    const notice = group('community-board', 'Community events & ideas board', [w / 2 - 40, 1700, bz + 1100], right); notice.rotation.y = -Math.PI / 2;
    box(notice, [1700, 1050, 35], [0, 0, 0], oak, 8); box(notice, [1640, 990, 12], [0, 0, 24], material('#9b8a6d'));
    for (let i = 0; i < 6; i++) {
        const posterMap = canvasMap(c => { c.fillStyle = ['#ead8b4', '#bad0c5', '#ddb09c'][i % 3]; c.fillRect(0, 0, 256, 320); c.fillStyle = '#355253'; c.font = 'bold 23px sans-serif'; c.fillText(['IDEA LAB', 'LUNCH CLUB', 'DEMO DAY', 'DESIGN TALK', 'FOCUS HOUR', 'SAY HELLO'][i], 20, 60); c.beginPath(); c.arc(128, 165, 60, 0, Math.PI * 2); c.lineWidth = 8; c.strokeStyle = '#ffffff88'; c.stroke(); }, 256, 320);
        box(notice, [420, 370, 3], [-520 + i % 3 * 520, 245 - Math.floor(i / 3) * 470, 34], material('#ffffff', { map: posterMap }));
    }
    const meet = group('meeting-table', index ? 'Four-person collaboration table' : 'Two-person conversation table', [meeting[0], 0, meeting[1]]);
    if (index) {
        box(meet, [2200, 40, 1000], [0, 720, 0], oak, 18);
        for (const x of [-780, 780]) { box(meet, [70, 700, 550], [x, 350, 0], ink, 4); box(meet, [650, 30, 700], [x, 15, 0], ink, 4); }
        box(meet, [1300, 4, 250], [0, 742, 0], sage, 4);
    } else {
        mesh(meet, new THREE.CylinderGeometry(400, 400, 35, 32), oak, [0, 722.5, 0]);
        mesh(meet, new THREE.CylinderGeometry(70, 100, 700, 24), ink, [0, 350, 0]); mesh(meet, new THREE.CylinderGeometry(260, 260, 30, 24), ink, [0, 15, 0]);
    }
    if (index) box(root, [2900, 4, 2300], [lounge[0], 2, lounge[1] - 650], material('#bfad94', { roughness: 1 }), 15);
    const makeBooth = (at, id, label, enclosed) => {
        const booth = group(id, label, [at[0], 0, at[1]]);
        box(booth, [1560, 4, 1600], [0, 2, 0], material('#858b83', { roughness: 1 }), 8);
        box(booth, [1560, 2120, 60], [0, 1060, -770], sage, 9);
        for (const x of [-750, 750]) box(booth, [60, 2120, 1540], [x, 1060, 0], oak, 8);
        box(booth, [1420, 1500, 20], [0, 1200, -728], material('#8f9a91', { roughness: 1 }), 5);
        for (let x = -670; x < 690; x += 70) box(booth, [20, 1500, 8], [x, 1200, -713], sage, 2);
        box(booth, [1350, 35, 520], [0, 722.5, -485], oak, 9);
        if (enclosed) {
            box(booth, [1560, 60, 1600], [0, 2150, 0], ink, 8);
            box(booth, [35, 2100, 35], [0, 1050, 780], ink, 3);
            const glass = material('#bcd9d6', { transparent: true, opacity: .18, roughness: .15, depthWrite: false });
            box(booth, [690, 2000, 8], [-360, 1080, 785], glass); box(booth, [690, 2000, 8], [360, 1080, 785], glass);
            rod(booth, [120, 920, 800], [120, 1230, 800], 9, brass);
        }
        const labelMap = canvasMap(c => { c.fillStyle = '#304c50'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#e8e3cf'; c.font = 'bold 38px sans-serif'; c.textAlign = 'center'; c.fillText(label.toUpperCase(), 256, 80); }, 512, 128);
        box(booth, [1000, 200, 20], [0, 1940, -700], material('#ffffff', { map: labelMap }));
        return booth;
    };
    if (focus) makeBooth(focus, 'quiet-booth', 'Quiet focus', false);
    if (call) makeBooth(call, 'call-booth', 'Private calls', true);
    const planter = (at, id, length) => {
        const p = group(id, 'Acoustic planter divider', [at[0], 0, at[1]]);
        box(p, [length, 580, 300], [0, 290, 0], clay, 8); box(p, [length - 60, 8, 250], [0, 584, 0], material('#463f36'));
        for (let x = -length / 2 + 110; x < length / 2 - 70; x += 170) for (let j = 0; j < 3; j++) {
            rod(p, [x, 588, 0], [x + (j - 1) * 35, 950 + j * 55, 0], 4, sage);
            const leaf = mesh(p, new THREE.SphereGeometry(1, 8, 6), material('#4f7761'), [x + (j - 1) * 40, 930 + j * 55, 20]); leaf.scale.set(45, 120, 13); leaf.rotation.z = (j - 1) * .5;
        }
    };
    if (index >= 1) planter([0, bz + (index > 1 ? 5500 : 3200)], 'living-divider', index > 1 ? 2200 : 1400);
    const glow = [], ceiling = new THREE.Group(); ceiling.name = 'Co-working suspended lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const at of [layout.desk, ...layout.stations.map(s => s.at)]) {
        const [x, z] = at; for (const dx of [-450, 450]) rod(ceiling, [x + dx, h, z], [x + dx, h - 420, z], 3, brass);
        box(ceiling, [1300, 70, 140], [x, h - 440, z], ink, 5);
        const mat = material('#ffdfb0', { emissive: '#ffdfb0', emissiveIntensity: .3 }); glow.push(mat); box(ceiling, [1250, 8, 100], [x, h - 480, z], mat, 3).castShadow = false;
    }
    for (const [x, z] of [[meeting[0], meeting[1]], [cafe[0] - 250, cafe[1]]]) {
        rod(ceiling, [x, h, z], [x, h - 700, z], 4, brass);
        mesh(ceiling, new THREE.ConeGeometry(260, 260, 32, 1, true), clay, [x, h - 830, z]);
        const mat = material('#ffdfb0', { emissive: '#ffdfb0', emissiveIntensity: .3 }); glow.push(mat); mesh(ceiling, new THREE.CylinderGeometry(235, 235, 10, 32), mat, [x, h - 960, z]).castShadow = false;
    }
    const lights = [
        { at: [layout.desk[0], 2100, layout.desk[1]], task: true, power: 4, range: 4400 },
        { at: [0, 2400, bz + d * .4], task: true, power: 5, range: d * .7 },
        { at: [cafe[0] - 600, 2000, cafe[1]], task: false, power: 4.5, range: 4300 },
        { at: [meeting[0], 2200, meeting[1]], task: false, power: 4, range: 4800 }
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.decorateStation = mount => {
        const map = canvasMap(c => { c.fillStyle = '#ede3ca'; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#567875'; c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.strokeRect(65 + i * 50, 65 + i * 30, 245, 180); } c.fillStyle = '#486b68'; c.font = 'bold 25px sans-serif'; c.fillText('SHARE / YOUR IDEAS', 80, 425); });
        const sheet = mesh(mount, new THREE.PlaneGeometry(520, 380), material('#ffffff', { map, side: THREE.DoubleSide, roughness: 1 }), [0, 1, 40]); sheet.rotation.x = -Math.PI / 2; sheet.castShadow = false;
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = COWORKING_MODES[modeId] || COWORKING_MODES.morning, c = sky.getContext('2d');
        const gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 18; i++) { const x = i * 31, y = 320 - i * 37 % 140; c.fillStyle = modeId === 'night' ? '#334b60' : '#99a9a6'; c.fillRect(x, y, 24, 512 - y); for (let j = 0; j < 5; j++) { c.fillStyle = modeId === 'night' ? '#e6c48a' : '#c8d1c8'; c.fillRect(x + 6, y + 15 + j * 25, 4, 7); } }
        skyMap.needsUpdate = true;
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .12 + mode.practical * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? mode.colors[0] : mode.colors[1]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[chalk, 'plaster'], [sage, 'powder'], [ink, 'powder'], [oak, 'wood'], [clay, 'plaster'], [brass, 'metal'], [rug, 'fabric']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
