import * as THREE from 'three';

// All architecture and original equipment below is authored in millimetres.
const tiers = [
    ['apartment', 'Apartment training nook', 3200, 4200, 2600],
    ['house', 'Dedicated home gym', 4200, 5400, 2800],
    ['spacious', 'Strength & cardio studio', 5200, 6400, 3000],
    ['premium', 'Performance gym & recovery', 6400, 7800, 3200],
    ['executive', 'Private wellness suite', 8000, 9000, 3400]
];
export const GYM_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1700, front = back + depth, desk = [tier ? -420 : -250, back + 880];
    const recovery = [-width / 2 + 350, front - 600];
    const training = [tier >= 3 ? 100 : 180, front - (tier >= 3 ? 2600 : 1200)];
    const hydration = [-width / 2 + 350, back + 400];
    const props = [
        { id: 'kenney-furniture-bench-cushion-low', at: [recovery[0], 0, recovery[1]], turn: 90 },
        { id: 'decor-plant2', at: [-width / 2 + 240, 0, front - 1330] },
        { id: 'party-speaker', at: [width / 2 - 220, 0, back + 2000], turn: -15 },
        { id: 'hemp-protein', at: [hydration[0] - 130, 960, hydration[1]] },
        { id: 'water-bottle', at: [hydration[0] + 125, 960, hydration[1] + 75] },
        { id: 'gym-props-3', at: [training[0], 8, training[1]] }
    ];
    if (tier >= 2) props.push({ id: 'gym-props', at: [width / 2 - 530, 0, front - 2300], turn: 90 });
    if (tier >= 3) props.push({ id: 'basketball', at: [-width / 2 + 330, 0, front - 190] });
    return [id, { id, name, width, depth, height, back, desk, recovery, training, hydration, tier, props,
        daylight: [-width / 2 + 100, back + 2100] }];
}));
export const gymLayoutById = id => GYM_LAYOUTS[id] || GYM_LAYOUTS.apartment;
export const gymLayoutForSize = size => GYM_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const GYM_MODES = {
    morning: { label: 'Morning', description: 'Sunrise mobility · standing coach station', key: '#fff0d5', fill: '#d8eaf4', accent: '#bded66', power: 1.7, ambient: .46, bounce: .65, exposure: 1.07, sky: ['#87bed5', '#f9dfac'], practical: .3, wash: .24, colors: ['#c8ef73', '#6ae3e0'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Daylight strength · workout tracking at standing height', key: '#edf7ff', fill: '#d9e7ef', accent: '#c1ed69', power: 1.35, ambient: .43, bounce: .6, exposure: 1.1, sky: ['#79b7d6', '#dbece8'], practical: .45, wash: .4, colors: ['#c5ed6f', '#56d8e0'], height: 43.5, tilt: -5, offset: [0, 70], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Recovery & stretching · lowered desk for session notes', key: '#f2ccb2', fill: '#cadcea', accent: '#75e0ce', power: .75, ambient: .3, bounce: .4, exposure: 1.16, sky: ['#837eaa', '#e5a984'], practical: .75, wash: .65, colors: ['#a6ec99', '#6dd9d9'], height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#69dec9' },
    night: { label: 'Night', description: 'After-hours training · cyan light lanes and lime accents', key: '#b7d3ef', fill: '#c0d4e8', accent: '#55dbe1', power: .3, ambient: .25, bounce: .3, exposure: 1.2, sky: ['#132b48', '#3c5b75'], practical: .85, wash: .95, colors: ['#b4f25e', '#47dbe5'], height: 43.5, tilt: -5, offset: [50, 180], yaw: -8, leds: true, color: '#38d7ed' },
    party: { label: 'Power session', description: 'High-energy circuit · desk turned toward the training zone', key: '#dce6fc', fill: '#d4dfee', accent: '#c3f343', power: .6, ambient: .31, bounce: .4, exposure: 1.14, sky: ['#3c4b70', '#8b85a1'], practical: 1, wash: 1.25, colors: ['#c6ff43', '#a478ff'], height: 43.5, tilt: 12, offset: [50, 260], yaw: -14, leds: true, color: '#b6f348' }
};

function texture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildGymRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    const graphite = material('#242d32', { roughness: .85 }), steel = material('#414e54', { metalness: .7, roughness: .35 });
    const rubber = material('#111c23', { roughness: .92 }), lime = material('#c0ea50', { roughness: .55 });
    const silver = material('#becbd0', { metalness: .8, roughness: .28 }), oak = material('#a58560', { roughness: .8 });
    const glow = [];
    const strip = (parent, size, at, channel = 0) => {
        const mat = material('#b9ec62', { emissive: '#b9ec62', emissiveIntensity: .3 });
        const o = box(parent, size, at, mat, 2); o.castShadow = false; glow.push({ mat, channel }); return o;
    };
    const group = (id, name, at = [0, 0, 0], turn = 0, parent = root) => {
        const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g);
        g.userData.propId = id; g.userData.sceneAssetName = name;
        markSceneAsset(g, { key: `gym:${layout.id}:fixture:${id}` }); return g;
    };
    const label = (parent, text, size, at, color = '#d9f3a5', background = '#1d292f') => {
        const map = texture((c, tw, th) => { c.fillStyle = background; c.fillRect(0, 0, tw, th); c.fillStyle = color; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, tw / 2, th / 2); }, 1024, 128);
        return box(parent, [size[0], size[1], 4], at, material('#ffffff', { map, roughness: .85 }));
    };
    const floorMap = texture((c, tw, th) => {
        c.fillStyle = '#2a3439'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 2600; i++) { const x = (i * 73.71) % tw, y = (i * 29.37) % th; c.fillStyle = ['#9aa79b55', '#a2b6bf40', '#111b2290'][i % 3]; c.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1); }
        c.strokeStyle = '#131d24'; c.lineWidth = 2; c.strokeRect(1, 1, tw - 2, th - 2);
    }); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 900, d / 900);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .96 }));
    const wall = new THREE.Group(); wall.name = 'Gym performance wall'; root.add(wall);
    box(wall, [w, h, 80], [0, h / 2, bz - 40], graphite);
    for (let x = -w / 2 + 55; x < w / 2; x += 100) box(wall, [22, h - 100, 18], [x, h / 2, bz + 9], rubber);
    box(wall, [w, 85, 30], [0, 42.5, bz + 15], steel);
    strip(wall, [w - 80, 12, 12], [0, h - 110, bz + 34], 0);
    const art = group('performance-sign', 'MOVE / BUILD / REPEAT training wall', [layout.desk[0], h - 360, bz + 30], 0, wall);
    const signMap = texture((c, tw, th) => {
        c.fillStyle = '#14242d'; c.fillRect(0, 0, tw, th);
        c.fillStyle = '#c2f250'; c.beginPath(); c.moveTo(0, th); c.lineTo(105, 0); c.lineTo(220, 0); c.lineTo(115, th); c.fill();
        c.fillStyle = '#e5eddf'; c.font = 'italic 900 112px sans-serif'; c.fillText('MOVE.', 255, 137);
        c.fillStyle = '#c2f250'; c.font = 'bold 24px sans-serif'; c.fillText('BUILD STRENGTH. KEEP MOVING.', 262, 192);
        c.fillStyle = '#679098'; c.font = '16px sans-serif'; c.fillText('ERGOFLEX   /   YOUR DAILY MOMENTUM', 262, 229);
    }, 1024, 256);
    box(art, [1520, 380, 25], [0, 0, 0], rubber, 4);
    box(art, [1480, 350, 4], [0, 0, 16], material('#ffffff', { map: signMap, roughness: .85 }));
    room.walls.push({ obj: wall, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = 'Gym reflective strength wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], graphite);
    box(right, [24, 90, d], [w / 2 - 12, 45, bz + d / 2], rubber);
    // Metallic environmental reflections avoid rendering the CAD desk a second time.
    for (let i = 0; i < Math.min(5, tier + 2); i++) {
        const z = bz + 700 + i * 1020;
        box(right, [15, 1780, 950], [w / 2 - 10, 1350, z], steel, 2);
        box(right, [6, 1720, 900], [w / 2 - 22, 1350, z], material('#839ca4', { metalness: .95, roughness: .12 }));
        strip(right, [8, 1780, 10], [w / 2 - 32, 1350, z - 475], 1);
    }
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const left = new THREE.Group(); left.name = 'Gym daylight and entry wall'; root.add(left);
    const wz = bz + 2150, ww = tier ? 1850 : 1350, low = 1000, wh = 1250, a = wz - ww / 2, b = wz + ww / 2;
    box(left, [80, h, a - bz], [-w / 2 - 40, h / 2, (bz + a) / 2], graphite);
    box(left, [80, h, front - b], [-w / 2 - 40, h / 2, (b + front) / 2], graphite);
    box(left, [80, low, ww], [-w / 2 - 40, low / 2, wz], graphite);
    box(left, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], graphite);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const sky = new THREE.CanvasTexture(skyCanvas); sky.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(left, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: sky }), [-w / 2 - 51, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(left, [65, wh + 40, 30], [-w / 2 + 10, low + wh / 2, z], steel);
    for (const y of [low, low + wh]) box(left, [65, 30, ww + 40], [-w / 2 + 10, y, wz], steel);
    box(left, [180, 30, ww + 70], [-w / 2 + 50, low - 15, wz], oak, 3);
    const door = front - 470;
    box(left, [25, 2100, 800], [-w / 2 + 18, 1050, door], steel, 3);
    box(left, [12, 1950, 720], [-w / 2 + 38, 975, door], oak, 3);
    rod(left, [-w / 2 + 55, 980, door - 260], [-w / 2 + 55, 1110, door - 260], 10, silver);
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const [tx, tz] = layout.training;
    const mat = group('training-zone', 'Mobility mat and circuit markings', [tx, 0, tz]);
    box(mat, [1400, 8, 2200], [0, 4, 0], rubber, 14);
    for (const x of [-710, 710]) box(mat, [14, 2, 2250], [x, 1, 0], lime);
    for (let i = 0; i < 5; i++) box(mat, [240, 2, 18], [0, 10, -930 + i * 410], steel);
    // The floor plaque reads from the room camera, rather than becoming a wall sign.
    const lane = label(mat, '01 / MOBILITY', [1000, 125], [0, 12, 990]); lane.rotation.x = -Math.PI / 2;
    const coach = group('coach-zone', 'ErgoFlex coaching station floor', [layout.desk[0], 0, layout.desk[1]]);
    box(coach, [tier ? 2000 : 1850, 3, 1250], [0, 1.5, 100], material('#34444a', { roughness: 1 }), 10);
    for (const x of [-850, 850]) box(coach, [12, 2, 1170], [x, 4, 100], lime);

    const hydrate = group('hydration-station', 'Timber hydration cabinet', [layout.hydration[0], 0, layout.hydration[1]]);
    box(hydrate, [570, 850, 450], [0, 475, 0], oak, 4);
    for (const x of [-230, 230]) for (const z of [-165, 165]) box(hydrate, [35, 50, 35], [x, 25, z], rubber);
    box(hydrate, [600, 60, 480], [0, 930, 0], steel, 5);
    for (const x of [-135, 135]) { box(hydrate, [255, 750, 14], [x, 475, 233], graphite, 3); rod(hydrate, [x, 510, 246], [x, 610, 246], 5, silver); }
    label(hydrate, 'REFUEL', [510, 70], [0, 830, 245]);
    strip(hydrate, [530, 8, 10], [0, 910, 244]);

    const weights = group('dumbbell-rack', 'Two-tier free weight rack', [w / 2 - 320, 0, bz + 900], -Math.PI / 2);
    for (const x of [-580, 580]) {
        box(weights, [70, 70, 530], [x, 35, 0], rubber, 3);
        rod(weights, [x, 70, -160], [x, 870, 0], 24, steel);
    }
    for (let row = 0; row < 2; row++) {
        const y = 440 + row * 370;
        for (const z of [-105, 105]) rod(weights, [-620, y, z], [620, y, z], 17, steel);
        for (let i = 0; i < 5; i++) {
            const x = -470 + i * 235, rad = 46 + i * 7;
            rod(weights, [x, y + rad + 15, -135], [x, y + rad + 15, 135], 12, silver);
            for (const z of [-110, 110]) { const head = mesh(weights, new THREE.CylinderGeometry(rad, rad, 70, 6), rubber, [x, y + rad + 15, z]); head.rotation.x = Math.PI / 2; }
        }
    }
    label(weights, '02 / STRENGTH', [1140, 95], [0, 1010, 190]);

    const bench = (at, turn = 0) => {
        const g = group('weight-bench', 'Incline strength bench', at, turn);
        for (const z of [-480, 480]) { box(g, [650, 65, 80], [0, 32.5, z], rubber, 4); rod(g, [0, 65, z], [0, 410, z], 26, steel); }
        rod(g, [0, 345, -530], [0, 345, 550], 35, steel);
        box(g, [330, 85, 380], [0, 450, 410], rubber, 20);
        const pad = box(g, [330, 85, 900], [0, 570, -240], rubber, 20); pad.rotation.x = -.28;
        for (const x of [-145, 145]) rod(g, [x, 420, 500], [x, 695, -665], 6, lime);
    };
    if (tier) bench([w / 2 - 600, 0, bz + 2720]);

    if (tier) {
        const bike = group('spin-bike', 'Indoor training bike', [-w / 2 + 570, 0, bz + 2700]);
        for (const z of [-560, 560]) box(bike, [580, 75, 90], [0, 37.5, z], rubber, 6);
        rod(bike, [0, 110, -540], [0, 110, 540], 36, steel);
        const wheel = mesh(bike, new THREE.CylinderGeometry(240, 240, 100, 32), graphite, [0, 400, -330]); wheel.rotation.z = Math.PI / 2;
        const ring = mesh(bike, new THREE.TorusGeometry(210, 8, 8, 32), lime, [57, 400, -330]); ring.rotation.y = Math.PI / 2;
        rod(bike, [0, 110, -540], [0, 740, 280], 40, steel);
        rod(bike, [0, 110, 530], [0, 480, -180], 40, steel);
        rod(bike, [0, 480, 200], [0, 920, 270], 24, silver);
        box(bike, [280, 55, 260], [0, 940, 290], rubber, 20);
        rod(bike, [0, 480, -330], [0, 1130, -440], 24, steel);
        rod(bike, [-270, 1110, -420], [270, 1110, -420], 18, rubber);
        rod(bike, [-260, 1110, -420], [-260, 1180, -570], 18, rubber); rod(bike, [260, 1110, -420], [260, 1180, -570], 18, rubber);
        box(bike, [230, 125, 18], [0, 1160, -450], graphite, 8);
        label(bike, '24:08', [195, 85], [0, 1160, -437], '#c4f45b');
        rod(bike, [-170, 370, 70], [170, 370, 70], 13, silver);
        for (const s of [-1, 1]) box(bike, [100, 35, 160], [s * 200, 370 + s * 100, 70], rubber, 5);
    }
    if (tier >= 2) {
        const rack = group('power-rack', 'Squat rack and Olympic bar', [w / 2 - 1020, 0, front - 1220]);
        for (const x of [-620, 620]) {
            box(rack, [100, 70, 1250], [x, 35, 0], rubber, 3);
            for (const z of [-470, 470]) {
                box(rack, [70, 2250, 70], [x, 1125, z], steel, 3);
                for (let y = 470; y < 1960; y += 140) sphere(rack, [7, 7, 4], [x, y, z + 37], rubber);
            }
            box(rack, [70, 70, 1080], [x, 2200, 0], steel);
            rod(rack, [x, 750, -430], [x, 750, 490], 18, lime);
        }
        rod(rack, [-620, 2190, 460], [620, 2190, 460], 20, rubber);
        rod(rack, [-950, 1330, -390], [950, 1330, -390], 15, silver);
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const plate = mesh(rack, new THREE.CylinderGeometry(210 - i * 35, 210 - i * 35, 36, 24), i === 2 ? lime : rubber, [s * (760 + i * 40), 1330, -390]); plate.rotation.z = Math.PI / 2; }
        label(rack, 'ERGO / STRONG', [1060, 105], [0, 2140, -426]);
        // A low stored box stays out of the lifter's bay.
        box(rack, [500, 360, 500], [0, 180, -390], oak, 8);
    }
    if (tier >= 3) {
        const run = group('treadmill', 'Incline cardio treadmill', [-w / 2 + 710, 0, front - 2500]);
        box(run, [850, 170, 1920], [0, 85, 0], steel, 24);
        box(run, [650, 14, 1680], [0, 177, 50], rubber, 8);
        for (let z = -710; z < 780; z += 140) box(run, [610, 2, 4], [0, 186, z], graphite);
        for (const x of [-385, 385]) { rod(run, [x, 170, -700], [x, 1220, -540], 27, steel); rod(run, [x, 950, -510], [x, 950, 60], 18, rubber); strip(run, [10, 12, 1580], [x, 179, 65], 1); }
        box(run, [790, 210, 110], [0, 1240, -530], graphite, 18);
        label(run, '06:42  /  8.0', [650, 100], [0, 1250, -470], '#65e3df');
    }
    if (tier === 4) {
        const bag = group('boxing-station', 'Freestanding boxing station', [1000, 0, front - 850]);
        mesh(bag, new THREE.CylinderGeometry(330, 370, 200, 32), rubber, [0, 100, 0]);
        rod(bag, [0, 200, 0], [0, 850, 0], 55, steel);
        mesh(bag, new THREE.CylinderGeometry(190, 190, 1050, 32), graphite, [0, 1400, 0]);
        for (const y of [960, 1840]) mesh(bag, new THREE.CylinderGeometry(194, 194, 35, 32), lime, [0, y, 0]);
        label(bag, 'MOVE', [250, 90], [0, 1450, 193], '#c0ed57');
    }

    // Recovery corner: tactile timber, rolled towels, and a warmer light.
    const recover = group('recovery-wall', 'Recovery slats and towel rail', [-w / 2 + 30, 900, layout.recovery[1]], Math.PI / 2, left);
    for (let x = -520; x <= 520; x += 65) box(recover, [25, 1180, 35], [x, 0, 0], oak, 2);
    label(recover, 'BREATHE / RESET', [960, 100], [0, 410, 25], '#e9deca', '#5c675f');
    const towels = group('towel-storage', 'Towel rail and recovery foam rollers', [w / 2 - 250, 0, front - 270]);
    box(towels, [350, 40, 500], [0, 20, 0], oak, 5);
    for (let i = 0; i < 3; i++) mesh(towels, new THREE.CylinderGeometry(52, 52, 480, 16), i === 1 ? lime : rubber, [(i - 1) * 110, 280, 0]);
    const ceiling = new THREE.Group(); ceiling.name = 'Gym suspended light lanes'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const x of [-w * .28, w * .28]) {
        box(ceiling, [65, 70, d - 500], [x, h - 160, bz + d / 2], steel, 5);
        strip(ceiling, [35, 8, d - 560], [x, h - 199, bz + d / 2], x < 0 ? 0 : 1);
        for (const z of [bz + 430, front - 430]) rod(ceiling, [x, h, z], [x, h - 125, z], 5, steel);
    }
    for (const x of [-w / 2 + 75, w / 2 - 75]) strip(root, [12, 8, d - 160], [x, 45, bz + d / 2], x < 0 ? 0 : 1);
    const specs = [
        { at: [layout.desk[0], h - 380, bz + 1100], power: 3.2, channel: 0 },
        { at: [w / 2 - 750, 1800, front - 1700], power: 3.8, channel: 1 },
        { at: [-w / 2 + 750, 1700, front - 800], power: 2.5, channel: 0, warm: true },
        { at: [tx, h - 420, tz], power: 4.2, channel: 1 }
    ].map(spec => { const light = new THREE.PointLight('#d2ef9d', 0, 4500 * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (id, accent = 1) => {
        const mode = GYM_MODES[id] || GYM_MODES.morning;
        const c = skyCanvas.getContext('2d'), grad = c.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, mode.sky[0]); grad.addColorStop(1, mode.sky[1]); c.fillStyle = grad; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#455f6380'; for (let i = 0; i < 14; i++) c.fillRect(i * 40, 380 + i % 3 * 20, 30, 132); sky.needsUpdate = true;
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .12 + mode.wash * accent; });
        specs.forEach(spec => { spec.light.color.set(spec.warm ? '#ffdbab' : mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.warm ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[graphite, 'powder'], [steel, 'metal'], [rubber, 'rubber'], [silver, 'metal'], [oak, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
