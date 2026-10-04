import * as THREE from 'three';

const tiers = [
    ['apartment', 'Apartment kitchen & breakfast nook', 3600, 4200, 2600],
    ['house', 'Home kitchen & coffee corner', 4400, 5200, 2800],
    ['spacious', 'Island kitchen & dining room', 5600, 6200, 3000],
    ['premium', 'Entertaining kitchen & dining', 6800, 7600, 3200],
    ['executive', 'Chef’s kitchen & gathering suite', 8200, 9000, 3400]
];
export const KITCHEN_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -2000, front = back + depth;
    const runStart = -width / 2 + 60, runWidth = width - 1150, bays = Math.max(4, Math.ceil(runWidth / 700)), bay = runWidth / bays;
    const desk = [tier >= 2 ? -width / 2 + 900 : tier ? -420 : 420, back + (tier ? 2200 : 1950)];
    const coffee = tier ? [width / 2 - 320, back + 1750] : [runStart + bay / 2, back + 330];
    const island = tier >= 2 ? [width / 2 - 1600, back + 2350] : null;
    const dining = [tier ? 0 : -width / 2 + 880, front - (tier >= 2 ? 1300 : tier ? 1050 : 850)];
    const tableWidth = tier >= 3 ? (tier === 4 ? 2800 : 2200) : 1800;
    const tableHeight = tier ? 750 : 730;
    const props = [
        { id: 'kenney-furniture-kitchen-fridge', at: [width / 2 - 510, 0, back + 355] },
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [coffee[0], 900, coffee[1]], turn: tier ? -90 : 0 },
        { id: 'kenney-furniture-toaster', at: [tier ? runStart + bay / 2 : runStart + runWidth - bay / 2 - 110, 900, back + 480] },
        { id: 'knife-set', at: [runStart + runWidth - bay / 2, 900, back + 210] },
        { id: 'kenney-furniture-plant-small2', at: [runStart + runWidth - bay / 2 + 180, 900, back + 370] },
        { id: 'decor-plant2', at: [width / 2 - 260, 0, front - 420] },
        { id: 'tea-cup', at: [dining[0] - 130, tableHeight, dining[1] + 60] },
        { id: 'fruitcake-tin', at: [dining[0] + 70, tableHeight, dining[1] - 20] }
    ];
    // Counter appliances keep their library scale and rest at the 900 mm worktop.
    if (!tier) props[1].at[2] = back + 190;
    if (tier) {
        props.push({ id: 'kenney-furniture-kitchen-blender', at: [runStart + bay / 2, 900, back + 200] });
        const seats = tier >= 2 ? (tier >= 3 ? 6 : 4) : 4;
        const xs = seats === 6 ? [-tableWidth / 2 + 400, 0, tableWidth / 2 - 400] : [-480, 480];
        for (const x of xs) for (const s of [-1, 1]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [dining[0] + x, 0, dining[1] + s * 750], turn: s < 0 ? 0 : 180 });
    } else props.push({ id: 'kenney-furniture-chair-rounded', at: [dining[0] + 670, 0, dining[1]], turn: -90 });
    if (island) {
        for (const x of [-480, 480]) props.push({ id: 'bar-stool-brass', at: [island[0] + x, 0, island[1] + 850], turn: 180 });
        props.push({ id: 'cutting-board', at: [island[0] - 430, 930, island[1]] }, { id: 'apple', at: [island[0] - 460, 984.8, island[1]] });
    }
    return [id, { id, name, width, depth, height, back, tier, desk, coffee, island, dining, tableWidth, tableHeight, runStart, runWidth, bay, bays, props,
        daylight: [-width / 2 + 100, back + 2250] }];
}));
export const kitchenLayoutById = id => KITCHEN_LAYOUTS[id] || KITCHEN_LAYOUTS.apartment;
export const kitchenLayoutForSize = size => KITCHEN_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const KITCHEN_MODES = {
    morning: { label: 'Morning', description: 'Breakfast & coffee · desk at prep height', key: '#fff1d7', fill: '#deedf2', accent: '#f3d1a4', power: 1.6, ambient: .5, bounce: .7, exposure: 1.05, sky: ['#9fc9db', '#f5e3b6'], practical: .25, wash: .2, colors: ['#ffdfac', '#afdbcc'], height: 36, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated recipes and planning', key: '#fff6e7', fill: '#dce9f0', accent: '#ead4af', power: 1.3, ambient: .48, bounce: .65, exposure: 1.06, sky: ['#9fc1d9', '#ecebd9'], practical: .4, wash: .35, colors: ['#f1d8b4', '#b6d6c7'], height: 28, tilt: 0, offset: [0, 40], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Dinner prep · warm pendants and counter lighting', key: '#f5d4b1', fill: '#ccdbe9', accent: '#f2c78d', power: .75, ambient: .35, bounce: .45, exposure: 1.12, sky: ['#9a8aa3', '#e2af8d'], practical: .85, wash: .7, colors: ['#ffd199', '#bdd9c7'], height: 36, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffdda3' },
    night: { label: 'Night', description: 'Quiet late-night tea · soft cabinet and shelf lights', key: '#c7d9ee', fill: '#c3d3e2', accent: '#f1bc88', power: .28, ambient: .27, bounce: .32, exposure: 1.16, sky: ['#24374f', '#4c657a'], practical: .55, wash: .8, colors: ['#ffce98', '#87bfb8'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe2b8' },
    party: { label: 'Dinner party', description: 'Gather & share · desk turned into a serving station', key: '#e9d8c4', fill: '#cedee9', accent: '#efbd83', power: .6, ambient: .38, bounce: .45, exposure: 1.12, sky: ['#53647e', '#af9893'], practical: 1, wash: 1, colors: ['#ffd6a3', '#a2d4c4'], height: 38, tilt: 0, offset: [60, 230], yaw: -12, leds: true, color: '#ffd5a1' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildKitchenRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, runStart, runWidth, bay, bays } = layout, front = bz + d;
    const cream = material('#e8e2d5', { roughness: .9 }), jade = material('#54766c', { roughness: .75 });
    const dark = material('#293f3d', { roughness: .7 }), brass = material('#b89958', { metalness: .72, roughness: .32 });
    const steel = material('#aebaba', { metalness: .7, roughness: .28 }), glass = material('#253638', { metalness: .4, roughness: .2 });
    const woodMap = texture((c, tw, th) => { c.fillStyle = '#ae916c'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#57412b32'; c.lineWidth = 1; for (let i = 0; i < 120; i++) { const x = i * 4.5; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 14, th * .3, x - 7, th * .6, x + 2, th); c.stroke(); } });
    const oak = material('#ffffff', { map: woodMap, roughness: .8 });
    const stoneMap = texture((c, tw, th) => { c.fillStyle = '#e1d7c3'; c.fillRect(0, 0, tw, th); for (let i = 0; i < 38; i++) { c.strokeStyle = i % 3 ? '#a3927520' : '#ffffff55'; c.lineWidth = 1 + i % 3; c.beginPath(); const y = i * 15; c.moveTo(0, y); c.bezierCurveTo(150, y + 25, 320, y - 20, tw, y + 15); c.stroke(); } });
    const stone = material('#ffffff', { map: stoneMap, roughness: .6 });
    const glow = [];
    const strip = (parent, size, at, channel = 0) => { const mat = material('#ffe0ac', { emissive: '#ffe0ac', emissiveIntensity: .3 }); const o = box(parent, size, at, mat, 2); o.castShadow = false; glow.push({ mat, channel }); return o; };
    const group = (id, name, at = [0, 0, 0], turn = 0, parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); g.userData.propId = id; g.userData.sceneAssetName = name; markSceneAsset(g, { key: `kitchen:${layout.id}:fixture:${id}` }); return g; };
    const tileMap = texture((c, tw, th) => { c.fillStyle = '#e4dfd2'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#aeac9a'; c.lineWidth = 2; c.strokeRect(1, 1, tw - 2, th - 2); for (let i = 0; i < 700; i++) { c.fillStyle = '#9a927c19'; c.fillRect(i * 53.33 % tw, i * 27.71 % th, 2, 2); } }); tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(w / 600, d / 600);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: tileMap, roughness: .85 }));
    const back = new THREE.Group(); back.name = 'Kitchen tiled cabinet wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], cream);
    const splashMap = texture((c, tw, th) => { c.fillStyle = '#9baea0'; c.fillRect(0, 0, tw, th); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = ['#b8c5b4', '#a6baad', '#cfdbca', '#92aaa0'][(x + y * 3) % 4]; c.fillRect(x * 64 + 2, y * 128 + 2, 60, 124); } }); splashMap.wrapS = splashMap.wrapT = THREE.RepeatWrapping; splashMap.repeat.set(runWidth / 800, 1.3);
    box(back, [runWidth, 850, 12], [runStart + runWidth / 2, 1325, bz + 6], material('#ffffff', { map: splashMap, roughness: .4 }));
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = 'Kitchen pantry and coffee wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream); box(right, [20, 90, d], [w / 2 - 10, 45, bz + d / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const left = new THREE.Group(); left.name = 'Kitchen daylight and breakfast wall'; root.add(left);
    const wz = bz + 2200, ww = tier ? 2000 : 1400, low = 1050, wh = 1250, a = wz - ww / 2, b = wz + ww / 2;
    box(left, [80, h, a - bz], [-w / 2 - 40, h / 2, (bz + a) / 2], cream); box(left, [80, h, front - b], [-w / 2 - 40, h / 2, (b + front) / 2], cream);
    box(left, [80, low, ww], [-w / 2 - 40, low / 2, wz], cream); box(left, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], cream);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512; const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(left, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 53, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(left, [65, wh + 45, 30], [-w / 2 + 10, low + wh / 2, z], oak);
    for (const y of [low, low + wh]) box(left, [65, 30, ww + 50], [-w / 2 + 10, y, wz], oak);
    box(left, [200, 30, ww + 80], [-w / 2 + 60, low - 15, wz], stone, 3);
    const doorZ = tier ? front - 500 : bz + 480;
    if (tier) { box(left, [25, 2100, 820], [-w / 2 + 15, 1050, doorZ], oak, 4); rod(left, [-w / 2 + 42, 1000, doorZ - 250], [-w / 2 + 42, 1000, doorZ - 160], 8, brass); }
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const handle = (g, x, y, z, horizontal = true) => rod(g, [x - (horizontal ? 65 : 0), y - (horizontal ? 0 : 60), z], [x + (horizontal ? 65 : 0), y + (horizontal ? 0 : 60), z], 5, brass);
    for (let i = 0; i < bays; i++) {
        const g = group('cabinet-' + i, i === 1 ? 'Sink cabinet and brass faucet' : i === 2 ? 'Induction range and oven' : 'Oak and jade storage cabinet', [runStart + bay * (i + .5), 0, bz + 320]);
        box(g, [bay - 10, 780, 580], [0, 490, 0], oak, 3);
        box(g, [bay - 50, 100, 500], [0, 50, 0], dark);
        box(g, [bay, 40, 640], [0, 880, 0], stone, 4);
        if (i === 2) {
            box(g, [bay - 50, 640, 18], [0, 510, 299], dark, 4); box(g, [bay - 120, 385, 8], [0, 450, 314], glass, 5); handle(g, 0, 735, 326);
            box(g, [Math.min(bay - 25, 580), 8, 460], [0, 904, 0], glass, 6);
            for (const x of [-145, 145]) for (const z of [-110, 110]) { const ring = mesh(g, new THREE.TorusGeometry(72, 2, 6, 24), steel, [x, 909, z]); ring.rotation.x = Math.PI / 2; }
            for (const x of [-120, -40, 40, 120]) sphere(g, [12, 12, 5], [x, 802, 316], steel);
            const hood = group('range-hood', 'Brass range hood', [0, 1770, -100], 0, g);
            box(hood, [Math.min(bay - 20, 720), 170, 430], [0, 0, 0], brass, 5); box(hood, [300, 500, 220], [0, 310, -100], brass, 4); strip(hood, [380, 6, 100], [0, -89, 100]);
        } else {
            for (const x of [-bay / 4, bay / 4]) { box(g, [bay / 2 - 20, 745, 16], [x, 490, 299], jade, 4); handle(g, x, 770, 315); }
            if (i === 1) {
                // Thin rim and inset basin preserve an actual-looking opening.
                box(g, [470, 8, 390], [0, 904, 0], steel, 5); box(g, [425, 5, 345], [0, 909, 0], dark, 10);
                box(g, [360, 2, 285], [0, 912, 0], material('#718580', { metalness: .6, roughness: .3 }), 8);
                rod(g, [0, 910, -210], [0, 1190, -210], 13, brass); rod(g, [0, 1190, -210], [0, 1190, -40], 13, brass); rod(g, [0, 1190, -40], [0, 1140, -40], 13, brass);
            }
            const upper = group('upper-cabinet-' + i, 'Jade upper cabinet', [0, 1810, -145], 0, g);
            box(upper, [bay - 12, 620, 300], [0, 0, 0], jade, 4);
            for (const x of [-bay / 4, bay / 4]) { box(upper, [bay / 2 - 20, 588, 10], [x, 0, 155], jade, 3); handle(upper, x + (x > 0 ? -bay / 5 : bay / 5), -210, 168, false); }
            strip(upper, [bay - 50, 8, 15], [0, -317, 130]);
        }
    }
    const pantry = group('pantry-surround', 'Oak refrigerator pantry surround', [w / 2 - 510, 0, bz + 350]);
    for (const x of [-465, 465]) box(pantry, [25, 2320, 680], [x, 1160, 0], oak);
    box(pantry, [955, 460, 680], [0, 2090, 0], oak, 3); box(pantry, [900, 400, 12], [0, 2090, 346], jade, 3); handle(pantry, 0, 1970, 358);

    const coffee = tier ? group('coffee-bar', 'Coffee bar and open oak shelves', [layout.coffee[0], 0, layout.coffee[1]], -Math.PI / 2) : null;
    if (coffee) {
        box(coffee, [1300, 760, 510], [0, 490, 0], jade, 4); box(coffee, [1210, 110, 460], [0, 55, 0], dark); box(coffee, [1340, 40, 590], [0, 880, 0], stone, 5);
        for (const x of [-320, 320]) { box(coffee, [625, 730, 15], [x, 490, 264], oak, 4); handle(coffee, x, 750, 279); }
        for (const y of [1470, 1870]) { box(coffee, [1320, 35, 275], [0, y, -100], oak, 3); strip(coffee, [1220, 7, 12], [0, y - 22, 31]); }
        for (let i = 0; i < 4; i++) { mesh(coffee, new THREE.CylinderGeometry(34, 36, 100 + i % 2 * 30, 16), cream, [-400 + i * 130, 1487.5 + (100 + i % 2 * 30) / 2, -80]); }
        const printMap = texture((c, tw, th) => { c.fillStyle = '#e7dcc5'; c.fillRect(0, 0, tw, th); c.fillStyle = '#3f6757'; c.font = 'bold 60px serif'; c.textAlign = 'center'; c.fillText('SLOW', tw / 2, 200); c.fillText('MORNINGS', tw / 2, 280); c.strokeStyle = '#b39059'; c.lineWidth = 12; c.strokeRect(40, 40, tw - 80, th - 80); });
        box(coffee, [410, 490, 20], [270, 2160, -158], oak, 3); box(coffee, [375, 455, 4], [270, 2160, -145], material('#ffffff', { map: printMap, roughness: .9 }));
    }
    if (layout.island) {
        const island = group('stone-island', 'Waterfall stone island with oak storage', [layout.island[0], 0, layout.island[1]]);
        box(island, [1680, 860, 800], [0, 430, -50], oak, 4);
        box(island, [1900, 50, 1000], [0, 905, 0], stone, 4);
        for (const x of [-925, 925]) box(island, [50, 880, 1000], [x, 440, 0], stone, 3);
        for (let x = -730; x <= 730; x += 55) box(island, [20, 760, 12], [x, 460, 357], oak, 2);
        strip(island, [1550, 8, 8], [0, 85, 365], 1);
        for (const x of [-480, 0, 480]) { box(island, [460, 355, 14], [x, 625, -457], jade, 3); handle(island, x, 740, -468); }
    }
    const dining = group('dining-table', tier ? 'Oak dining table and tableware' : 'Round breakfast table and banquette', [layout.dining[0], 0, layout.dining[1]]);
    if (tier) {
        box(dining, [layout.tableWidth, 50, 980], [0, 725, 0], oak, 10);
        for (const x of [-layout.tableWidth / 2 + 160, layout.tableWidth / 2 - 160]) for (const z of [-340, 340]) box(dining, [65, 700, 65], [x, 350, z], oak, 4);
        for (const x of tier >= 3 ? [-650, 0, 650] : [-480, 480]) for (const z of [-300, 300]) {
            for (const obj of [
                mesh(dining, new THREE.CylinderGeometry(112, 112, 9, 24), cream, [x, 754.5, z]),
                mesh(dining, new THREE.CylinderGeometry(85, 102, 7, 24), stone, [x, 762.5, z]),
                box(dining, [75, 5, 135], [x + 170, 752.5, z], jade, 3)
            ]) obj.userData.mealSetting = [x, z];
        }
        mesh(dining, new THREE.CylinderGeometry(75, 100, 240, 24), jade, [0, 870, 0]);
        for (let i = 0; i < 7; i++) { const angle = i * .9; rod(dining, [0, 990, 0], [Math.cos(angle) * 100, 1210 - i % 3 * 40, Math.sin(angle) * 70], 3, dark); sphere(dining, [40, 15, 65], [Math.cos(angle) * 100, 1210 - i % 3 * 40, Math.sin(angle) * 70], jade); }
    } else {
        mesh(dining, new THREE.CylinderGeometry(440, 440, 45, 40), stone, [0, 707.5, 0]);
        mesh(dining, new THREE.CylinderGeometry(130, 230, 685, 32), oak, [0, 342.5, 0]);
        const seat = group('breakfast-banquette', 'Upholstered oak breakfast bench', [-layout.width / 2 + 250, 0, front - 850], Math.PI / 2);
        box(seat, [1250, 390, 410], [0, 195, 0], oak, 4); box(seat, [1240, 65, 410], [0, 422.5, 0], jade, 20); box(seat, [1240, 390, 60], [0, 650, -195], jade, 15);
    }
    if (tier >= 3) {
        const wine = group('wine-alcove', 'Display pantry and bottle rack', [w / 2 - 275, 0, front - 2500], -Math.PI / 2);
        box(wine, [1460, 2200, 25], [0, 1100, -222.5], oak, 3);
        for (const x of [-717.5, 717.5]) box(wine, [25, 2200, 470], [x, 1100, 0], oak, 3);
        box(wine, [1410, 790, 430], [0, 395, 0], oak, 3);
        box(wine, [1400, 720, 16], [0, 430, 243], jade, 3); handle(wine, 0, 700, 258);
        for (const y of [850, 1230, 1630, 2110]) { box(wine, [1380, 25, 430], [0, y, 5], oak); strip(wine, [1320, 8, 8], [0, y - 20, 225]); }
        for (let i = 0; i < 10; i++) { const x = -590 + i * 130; const bottle = mesh(wine, new THREE.CylinderGeometry(36, 36, 240, 16), material(i % 2 ? '#405752' : '#8f7754', { roughness: .3 }), [x, 975, 20]); bottle.rotation.x = .15; mesh(wine, new THREE.CylinderGeometry(15, 15, 75, 12), brass, [x, 1130, 0]); }
        for (let i = 0; i < 6; i++) mesh(wine, new THREE.CylinderGeometry(48, 55, 90, 16), cream, [-480 + i * 185, 1687.5, 40]);
    }
    const ceiling = new THREE.Group(); ceiling.name = 'Kitchen brass and opal pendants'; root.add(ceiling); room.ceilingFixture = ceiling;
    const pendants = layout.island ? [[layout.island[0] - 510, layout.island[1]], [layout.island[0] + 510, layout.island[1]], [layout.dining[0], layout.dining[1]]] : [[layout.desk[0], layout.desk[1]], [layout.dining[0], layout.dining[1]]];
    pendants.forEach(([x, z]) => { rod(ceiling, [x, h, z], [x, h - 650, z], 5, brass); sphere(ceiling, [170, 115, 170], [x, h - 690, z], brass); const diffuser = mesh(ceiling, new THREE.CylinderGeometry(152, 152, 10, 32), cream, [x, h - 765, z]); diffuser.castShadow = false; strip(ceiling, [120, 5, 120], [x, h - 772, z]); });
    const lights = [
        { at: [runStart + runWidth / 2, 1570, bz + 450], power: 3.3, task: true },
        { at: [layout.desk[0], h - 500, layout.desk[1]], power: 3.5, task: true },
        { at: [layout.dining[0], h - 700, layout.dining[1]], power: 3.4 },
        { at: [w / 2 - 650, 1800, bz + d / 2], power: 3.1, channel: 1 }
    ].map(spec => { const light = new THREE.PointLight('#ffdeb0', 0, 4500 * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (id, accent = 1) => {
        const mode = KITCHEN_MODES[id] || KITCHEN_MODES.morning;
        const c = skyCanvas.getContext('2d'), grad = c.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, mode.sky[0]); grad.addColorStop(1, mode.sky[1]); c.fillStyle = grad; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#81977e'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(i * 48, 485, 48 + i % 3 * 12, 0, Math.PI * 2); c.fill(); } skyMap.needsUpdate = true;
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .12 + mode.wash * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#ffe0b7' : mode.colors[spec.channel || 0]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [jade, 'powder'], [dark, 'powder'], [brass, 'metal'], [steel, 'metal'], [oak, 'wood'], [stone, 'stone']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
