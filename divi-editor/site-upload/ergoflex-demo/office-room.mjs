import * as THREE from 'three';

// Shared offices are intentionally larger than home rooms: each station has a
// real ErgoFlex desk, a chair, and an aisle. Architecture is in millimetres.
const sizes = [
    ['apartment', 'Two-person office', 4200, 4800, 2800, 2],
    ['house', 'Small team studio', 5800, 6000, 2900, 3],
    ['spacious', 'Design team office', 7000, 7200, 3000, 4],
    ['premium', 'Collaborative office', 8600, 8800, 3200, 5],
    ['executive', 'Flagship design studio', 10500, 10000, 3400, 6]
];
const roles = {
    drafter: { id: 'drafter', name: 'Drafting', height: 43.5, tilt: 39, plan: true,
        desktop: [{ id: 'metal-ruler', at: [-390, 1, 80], turn: 90 }, { id: 'ruler-set-square', at: [285, 1, 55] }, { id: 'apple-pencil', at: [100, 1, 240], turn: 80 }],
        shelf: [{ id: 'sketchbook', at: [-320, 0, 0] }, { id: 'paper-stand', at: [300, 0, 0] }] },
    designer: { id: 'designer', name: 'Digital design', height: 28, tilt: 0,
        desktop: [{ id: 'drawing-tablet', at: [-260, 0, 90] }, { id: 'apple-pencil', at: [-75, 0, 90], turn: 15 }, { id: 'office-keyboard', at: [190, 0, -170] }, { id: 'painted-mug', at: [440, 0, 160] }],
        shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] },
    prototype: { id: 'prototype', name: 'Prototyping', height: 43.5, tilt: -5,
        desktop: [{ id: 'printer-3d', at: [-190, 0, -30] }, { id: 'sketchbook', at: [265, 0, 100], turn: -12 }],
        shelf: [{ id: 'kenney-furniture-books', at: [-290, 0, 0] }, { id: 'paper-holder', at: [260, 0, 0] }] },
    architect: { id: 'architect', name: 'Architecture', height: 43.5, tilt: 25, plan: true,
        desktop: [{ id: 'clipboard', at: [-330, 1, 65], turn: 12 }, { id: 'metal-ruler', at: [370, 1, -50], turn: 5 }],
        shelf: [{ id: 'paper-stand', at: [-300, 0, 0] }, { id: 'kenney-furniture-books', at: [280, 0, 0] }] },
    analyst: { id: 'analyst', name: 'Planning & research', height: 28, tilt: 0,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-140, 0, -30] }, { id: 'papers', at: [320, 0, 100], turn: -12 }, { id: 'glasses', at: [305, 0, -170] }],
        shelf: [{ id: 'paper-holder', at: [-325, 0, 0] }, { id: 'office-phone', at: [300, 0, 0] }] }
};
export const OFFICE_LAYOUTS = Object.fromEntries(sizes.map(([id, name, width, depth, height, count], index) => {
    const back = -depth / 3, front = back + depth;
    const spread = index === 0 ? 1050 : index === 1 ? 1650 : index === 2 ? 1900 : index === 3 ? 2300 : 2700;
    const desk = [-spread, back + (index === 0 ? 1160 : 1000)];
    const positions = index === 4
        ? [[0, back + 1000], [spread, back + 1000], [-spread, back + 4000], [0, back + 4000], [spread, back + 4000]]
        : [[spread, back + (index === 0 ? 1160 : 1000)], [spread, back + 3800], [-spread, back + 3800], [spread, back + 6500]];
    const stations = Object.values(roles).slice(0, count - 1).map((role, i) => ({ ...role, at: positions[i] }));
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1030], turn: 180 }];
    for (const station of stations) props.push({ id: 'steelcase-leap-v2', at: [station.at[0], 0, station.at[1] + 1050], turn: 180 });
    props.push({ id: 'monstera', at: [width / 2 - 510, 0, front - 550] });
    const lounge = index > 0 ? [-width / 2 + 1650, front - 550] : [0, front - 500];
    if (index === 0) {
        props.push({ id: 'armchair-leather', at: [-700, 0, front - 650], turn: 15 }, { id: 'coffee-table-2', at: [0, 0, front - 420] }, { id: 'journal', at: [-45, 700, front - 420] });
    } else {
        props.push({ id: 'kenney-furniture-lounge-sofa', at: [lounge[0], 0, lounge[1]] },
            { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 950] }, { id: 'journal', at: [lounge[0] - 270, 391.2, lounge[1] - 980] },
            { id: 'tea-cup', at: [lounge[0] + 290, 391.2, lounge[1] - 920] });
    }
    if (index === 4) for (const x of [900, 1800, 2700]) {
        props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, front - 2700], turn: 180 },
            { id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, front - 900] });
    }
    props.push({ id: 'kenney-furniture-kitchen-coffee-machine', at: [0, 900, back + 250] });
    return [id, { id, name, width, depth, height, back, desk, stations, props, index, daylight: [-width / 2 + 100, back + depth * .45] }];
}));
export const officeLayoutById = id => OFFICE_LAYOUTS[id] || OFFICE_LAYOUTS.apartment;
export const officeLayoutForSize = size => OFFICE_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const OFFICE_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing focus', key: '#ffeed5', fill: '#dceaf2', accent: '#b4cebc', power: 1.6, ambient: .47, bounce: .65, exposure: 1.08, sky: ['#9dc7dc', '#f0edda'], practical: .25, wash: .2, colors: ['#e9d8b7', '#91beb1'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Teamwork in daylight · seated work', key: '#fff3e2', fill: '#d7e7ed', accent: '#b6d7cb', power: 1.3, ambient: .46, bounce: .62, exposure: 1.08, sky: ['#acd2e0', '#edf0de'], practical: .4, wash: .35, colors: ['#efdbba', '#9bbfb2'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm task lights · review and sketching', key: '#f3d1ad', fill: '#becfe3', accent: '#cfb088', power: .7, ambient: .33, bounce: .43, exposure: 1.13, sky: ['#8f9eb7', '#d5b195'], practical: .9, wash: .8, colors: ['#efcda3', '#9bc4b7'], height: 43.5, tilt: 18, offset: [0, 100], yaw: 0, leds: true, color: '#ffdfa6' },
    night: { label: 'Night', description: 'Quiet focus · low ambient and task lighting', key: '#bdcfe4', fill: '#aebdd2', accent: '#e7c193', power: .25, ambient: .25, bounce: .32, exposure: 1.16, sky: ['#20374c', '#48627a'], practical: 1, wash: .75, colors: ['#ebc89b', '#94bcb5'], height: 28, tilt: 0, offset: [0, 120], yaw: 0, leds: true, color: '#ffe4b2' },
    party: { label: 'Team social', description: 'After hours · turn the main desk toward the team', key: '#ded4c8', fill: '#b9cfdf', accent: '#71c6b5', power: .5, ambient: .34, bounce: .45, exposure: 1.12, sky: ['#4d718a', '#b2a39c'], practical: .65, wash: 1, colors: ['#8dd5bc', '#a6b9e1'], height: 43.5, tilt: -5, offset: [120, 300], yaw: -12, leds: true, color: '#42d89c' }
};
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
export function buildOfficeRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index } = layout, front = bz + d;
    const plaster = material('#deded3', { roughness: .94 }), teal = material('#496c68', { roughness: .86 });
    const oak = material('#a18763', { roughness: .76 }), dark = material('#283e40'), bronze = material('#9c9b7a', { metalness: .55 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `office:${layout.id}:fixture:${id}` }); };
    const floorMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#c5bea9'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 6; i++) {
            c.fillStyle = ['#cfc5ad', '#c1b99f', '#d0c9b8'][i % 3]; c.fillRect(i * tw / 6, 0, tw / 6 - 1, th);
            c.strokeStyle = '#87795635'; c.lineWidth = .7;
            for (let j = 0; j < 16; j++) { const x = i * tw / 6 + j * 5; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 7, 190, x - 5, 350, x, th); c.stroke(); }
            c.fillStyle = '#87795630'; c.fillRect(i * tw / 6, (i % 3 + 1) * th / 4, tw / 6, 1);
        }
    }); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 1500, d / 2000);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .82 }));
    const carpet = material('#a3aaa1', { roughness: 1 });
    for (const [i, at] of [layout.desk, ...layout.stations.map(s => s.at)].entries()) {
        box(root, [1800, 4, 1850], [at[0], 2, at[1] + 430], i === 0 ? material('#7d9a92', { roughness: 1 }) : carpet, 6);
        const labelMap = canvasMap(c => {
            c.fillStyle = i === 0 ? '#244942' : '#eef0e6'; c.fillRect(0, 0, 512, 128);
            c.fillStyle = i === 0 ? '#ffffff' : '#344c49'; c.font = 'bold 25px sans-serif'; c.textAlign = 'center';
            c.fillText(i === 0 ? 'MAIN · YOUR ERGOFLEX' : layout.stations[i - 1].name.toUpperCase(), 256, 78);
        }, 512, 128);
        const plaque = mesh(root, new THREE.PlaneGeometry(650, 160), material('#ffffff', { map: labelMap, roughness: 1 }), [at[0], 5, at[1] + 1340]); plaque.rotation.x = -Math.PI / 2; plaque.castShadow = false;
    }
    const back = new THREE.Group(); back.name = 'Office presentation wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], plaster);
    box(back, [w, 1120, 34], [0, 560, bz + 17], teal);
    for (let x = -w / 2 + 60; x < w / 2; x += 120) box(back, [22, 1100, 12], [x, 550, bz + 40], oak, 2);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const brandMap = canvasMap(c => {
        c.fillStyle = '#496c68'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#f3f0e4'; c.font = 'bold 88px sans-serif'; c.fillText('MAKE / TOGETHER', 65, 124);
        c.font = '24px sans-serif'; c.fillText('DESIGN   ·   DRAFT   ·   BUILD   ·   CONNECT', 70, 189);
    }, 1024, 256);
    const brand = new THREE.Group(); brand.name = 'Office studio wall sign'; brand.position.set(0, 2250, bz + 42); back.add(brand);
    box(brand, [index === 0 ? 2200 : 2800, 660, 30], [0, 0, 0], oak, 5);
    box(brand, [index === 0 ? 2140 : 2740, 600, 8], [0, 0, 20], material('#ffffff', { map: brandMap })); register(brand, 'office-sign', 'Make Together wall sign');
    const side = new THREE.Group(); side.name = 'Office ideas wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], plaster); box(side, [22, 90, d], [w / 2 - 11, 45, bz + d / 2], oak);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const board = new THREE.Group(); board.name = 'Office project pinboard'; board.position.set(w / 2 - 32, 1760, bz + d * .52); board.rotation.y = -Math.PI / 2; side.add(board);
    box(board, [1900, 1080, 35], [0, 0, 0], oak, 4); box(board, [1840, 1020, 15], [0, 0, 24], material('#999e87'));
    for (let i = 0; i < 6; i++) {
        const sheet = canvasMap(c => {
            c.fillStyle = '#f2ead7'; c.fillRect(0, 0, 512, 512); c.strokeStyle = ['#477b72', '#b79261', '#627e97'][i % 3]; c.lineWidth = 6;
            for (let k = 0; k < 4; k++) { c.strokeRect(55 + k * 80, 70 + k % 2 * 60, 65, 190 + k * 15); }
            c.fillStyle = '#385753'; c.font = 'bold 23px sans-serif'; c.fillText(['CONCEPT', 'MATERIALS', 'PLAN', 'DETAIL', 'STUDY', 'NEXT'][i], 55, 410);
        });
        box(board, [420, 360, 3], [-620 + i % 3 * 615, 240 - Math.floor(i / 3) * 475, 35], material('#ffffff', { map: sheet }));
    }
    register(board, 'office-pinboard', 'Team project pinboard');
    const windowWall = new THREE.Group(); windowWall.name = 'Office daylight wall'; root.add(windowWall);
    const wz = bz + d * .45, ww = index === 0 ? 2200 : Math.min(4200, d * .56), low = 850, wh = 1600, a = wz - ww / 2, b = wz + ww / 2;
    box(windowWall, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], plaster);
    box(windowWall, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], plaster);
    box(windowWall, [80, low, ww], [-w / 2 - 40, low / 2, wz], plaster);
    box(windowWall, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], plaster);
    const skyMap = canvasMap(() => {}); const skyCanvas = skyMap.image;
    const pane = mesh(windowWall, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (let z = a; z <= b + 1; z += ww / 3) box(windowWall, [60, wh + 35, 30], [-w / 2 + 15, low + wh / 2, z], dark);
    for (const y of [low, low + wh]) box(windowWall, [60, 35, ww + 45], [-w / 2 + 15, y, wz], dark);
    box(windowWall, [140, 32, ww + 90], [-w / 2 + 45, low - 16, wz], oak, 3);
    room.walls.push({ obj: windowWall, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const coffee = new THREE.Group(); coffee.name = 'Office coffee cabinet'; root.add(coffee); register(coffee, 'office-coffee-bar', 'Shared coffee cabinet');
    box(coffee, [1000, 865, 500], [0, 432.5, bz + 250], teal, 5); box(coffee, [1050, 35, 530], [0, 882.5, bz + 265], oak, 5);
    for (const x of [-245, 245]) { box(coffee, [460, 775, 18], [x, 440, bz + 510], dark, 3); rod(coffee, [x, 710, bz + 528], [x, 760, bz + 528], 7, bronze); }
    if (index >= 2) {
        const divider = new THREE.Group(); divider.name = 'Office acoustic planter divider'; divider.position.set(0, 0, bz + 2600); root.add(divider); register(divider, 'office-divider', 'Acoustic divider & planter');
        for (const x of [-600, 600]) { box(divider, [220, 30, 440], [x, 15, 0], dark, 3); box(divider, [35, 60, 35], [x, 30, 0], dark, 2); }
        box(divider, [1480, 1050, 70], [0, 585, 0], material('#89978c', { roughness: 1 }), 8);
        box(divider, [1550, 200, 260], [0, 1190, 0], oak, 6); box(divider, [1470, 8, 210], [0, 1294, 0], material('#423c32'));
        for (let x = -630; x <= 630; x += 105) for (let j = 0; j < 3; j++) {
            rod(divider, [x, 1298, 0], [x + (j - 1) * 22, 1450 + j * 38, 0], 3, teal);
            const leaf = mesh(divider, new THREE.SphereGeometry(1, 8, 6), material('#55765b'), [x + (j - 1) * 25, 1440 + j * 38, j % 2 * 15]); leaf.scale.set(28, 70, 10); leaf.rotation.z = (j - 1) * .5;
        }
    }
    if (index === 4) {
        const meeting = new THREE.Group(); meeting.name = 'Office team review table'; meeting.position.set(1800, 0, front - 1800); root.add(meeting); register(meeting, 'office-review-table', 'Six-person team review table');
        box(meeting, [2600, 40, 1100], [0, 720, 0], oak, 12);
        for (const x of [-1000, 1000]) { box(meeting, [80, 700, 650], [x, 350, 0], dark, 4); box(meeting, [650, 35, 780], [x, 17.5, 0], dark, 4); }
        box(meeting, [1800, 3, 360], [0, 741.5, 0], material('#e7e5d8'), 2);
        for (const x of [-660, 0, 660]) box(meeting, [240, 4, 170], [x, 745, 0], teal, 2);
    }
    const glow = [], ceiling = new THREE.Group(); ceiling.name = 'Office linear pendant lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const at of [layout.desk, ...layout.stations.map(s => s.at)]) {
        const [x, z] = at;
        for (const xx of [x - 440, x + 440]) rod(ceiling, [xx, h, z], [xx, h - 420, z], 3, bronze);
        box(ceiling, [1300, 70, 135], [x, h - 440, z], dark, 5);
        const mat = material('#f1dfbc', { emissive: '#f1dfbc', emissiveIntensity: .3 }); glow.push(mat);
        box(ceiling, [1240, 8, 100], [x, h - 480, z], mat, 3).castShadow = false;
    }
    const lights = [
        { at: [layout.desk[0], 2050, layout.desk[1] + 180], task: true, power: 4, range: 3800 },
        { at: [layout.stations[0].at[0], 2050, layout.stations[0].at[1] + 180], task: true, power: 4, range: 3800 },
        { at: [0, 2200, bz + d * .56], task: false, power: 5.5, range: d * .85 },
        { at: [-w / 4, 1950, front - 1450], task: false, power: 4, range: 4200 }
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.decorateStation = (mount, spec) => {
        const plan = canvasMap(c => {
            c.fillStyle = '#eee9d6'; c.fillRect(0, 0, 1024, 640); c.strokeStyle = '#839c9a'; c.lineWidth = .6;
            for (let x = 0; x < 1024; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 640); c.stroke(); }
            for (let y = 0; y < 640; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(1024, y); c.stroke(); }
            c.strokeStyle = '#315e69'; c.lineWidth = 5;
            c.strokeRect(170, 110, 620, 365); c.strokeRect(190, 130, 200, 175); c.strokeRect(410, 130, 360, 175); c.strokeRect(190, 330, 580, 125);
            c.lineWidth = 2; c.strokeRect(130, 70, 700, 450);
            c.fillStyle = '#315e69'; c.font = 'bold 28px sans-serif'; c.fillText(spec.id === 'drafter' ? '01 / WORKSPACE PLAN' : '02 / ARCHITECTURAL STUDY', 150, 580);
        }, 1024, 640);
        const sheet = mesh(mount, new THREE.PlaneGeometry(600, 375), material('#ffffff', { map: plan, roughness: 1, side: THREE.DoubleSide }), [0, 1, 40]); sheet.rotation.x = -Math.PI / 2; sheet.castShadow = false;
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = OFFICE_MODES[modeId] || OFFICE_MODES.afternoon;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#91aaa0'; for (let i = 0; i < 14; i++) c.fillRect(i * 40, 435 - (i * 23) % 80, 29, 100); skyMap.needsUpdate = true;
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .15 + mode.practical * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#efd8b5' : mode.colors[1]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[plaster, 'plaster'], [teal, 'powder'], [oak, 'wood'], [dark, 'powder'], [bronze, 'metal'], [carpet, 'fabric']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
