import * as THREE from 'three';
import { institutionalFloor, institutionalOak, drawInstitutionalBoard, drawInstitutionalScreen, drawInstitutionalCampus, enrichInstitutionalRoom } from './institutional-detail.mjs?v=institutional-atmosphere-20261008';
import { INSTITUTIONAL_ROOMS } from './institutional-scenes.mjs?v=institutional-atmosphere-20261008';

// A common architectural kit, with purpose-built furniture for each setting.
// Floor furnishings are separate stable assets so rearranging and collision
// detection use the same objects that the visitor sees.
export function buildInstitutionalRoom(room, root, layout, h) {
    const spec = INSTITUTIONAL_ROOMS[room.id], { box, mesh, rod, sphere, material, markSceneAsset } = h;
    const { width: w, depth: d, height: ceiling, back: bz, index } = layout, front = bz + d;
    const mat = (color, surface, extra = {}) => { const m = material(color, extra); if (surface) m.userData.roomSurface = surface; return m; };
    const wall = mat(spec.wall, 'plaster'), trim = mat('#f3f1e9', 'powder'), accent = mat(spec.accent, 'powder');
    const metal = mat('#74808a', 'metal', { metalness: .65, roughness: .32 }), ink = mat('#25333d', 'powder');
    const oak = mat('#ffffff', 'wood', { map: institutionalOak(), roughness: .55 }), paper = mat('#eeeadc', 'plaster'), seat = mat(spec.accent, 'fabric');
    const floorFinish = institutionalFloor(spec, w, d);
    const floor = mat('#ffffff', floorFinish.surface, { map: floorFinish.map, roughness: floorFinish.roughness });
    const glow = material('#ecf6ff', { emissive: '#d9efff', emissiveIntensity: .6, roughness: .5 });
    const taskSeat = mat('#384c57', 'fabric');
    const screenMats = [];
    let screenPhase;
    const asset = (id, name, at = [0, 0, 0], parent = root) => {
        const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g);
        g.userData.propId = id; g.userData.sceneAssetName = name;
        markSceneAsset(g, { key: `${room.id}:${layout.id}:fixture:${id}` }); return g;
    };
    const canvasMat = (draw, width = 768, height = 384) => {
        const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
        const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
        return material('#ffffff', { map, roughness: .85 });
    };
    const label = (parent, text, size, at, background = spec.accent) => {
        const m = canvasMat((c, W, H) => { c.fillStyle = background; c.fillRect(0, 0, W, H); c.fillStyle = '#f3f5f0'; c.font = '600 42px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2, W - 50); }, 1024, 160);
        const p = mesh(parent, new THREE.PlaneGeometry(...size), m, at); p.castShadow = false; return p;
    };
    const chair = (id, at, height = 450, turn = 0) => {
        const g = asset(id, height < 400 ? 'Classroom child chair' : 'Task chair', at); g.rotation.y = turn;
        const wide = height < 400 ? 310 : 420, deep = wide * .9;
        const upholstery = /operator|mobile-desk/.test(id) ? taskSeat : seat;
        box(g, [wide, 60, deep], [0, height, 0], upholstery, 22);
        box(g, [wide, height * .55, 36], [0, height * 1.37, deep * .46], upholstery, 18);
        if (/operator|mobile-desk/.test(id)) {
            rod(g, [0, 90, 0], [0, height - 25, 0], 30, metal);
            for (let n = 0; n < 5; n++) {
                const a = n * Math.PI * 2 / 5, x = Math.cos(a) * 245, z = Math.sin(a) * 245;
                rod(g, [0, 105, 0], [x, 65, z], 18, metal);
                const wheel = mesh(g, new THREE.CylinderGeometry(34, 34, 25, 12), ink, [x, 34, z]); wheel.rotation.z = Math.PI / 2;
            }
            for (const x of [-wide / 2 - 20, wide / 2 + 20]) { rod(g, [x, height, 70], [x, height + 180, 70], 14, metal); box(g, [55, 30, 240], [x, height + 180, 0], ink, 12); }
        } else for (const x of [-wide * .39, wide * .39]) for (const z of [-deep * .37, deep * .37]) rod(g, [x, 0, z], [x, height - 20, z], 15, metal);
        return g;
    };
    const table = (id, name, at, width = 1200, depth = 680, height = 740, top = oak) => {
        const g = asset(id, name, at);
        box(g, [width, 35, depth], [0, height - 17.5, 0], top, 12);
        for (const x of [-width / 2 + 65, width / 2 - 65]) for (const z of [-depth / 2 + 65, depth / 2 - 65]) box(g, [35, height - 35, 35], [x, (height - 35) / 2, z], metal, 5);
        return g;
    };
    const monitor = (parent, at, width = 540, variant = 0, mounted = false) => {
        const m = canvasMat((c, W, H) => drawInstitutionalScreen(c, W, H, spec, variant));
        m.emissive.set('#b2d9df'); m.emissiveMap = m.map; m.emissiveIntensity = .18; m.userData.screenVariant = variant; screenMats.push(m);
        const g = new THREE.Group(); g.position.set(...at); parent.add(g);
        box(g, [width, width * .6, 28], [0, 200, 0], ink, 8);
        mesh(g, new THREE.PlaneGeometry(width - 25, width * .6 - 24), m, [0, 200, 15]);
        if (!mounted) { box(g, [28, 110, 28], [0, 65, -10], metal, 3); box(g, [200, 14, 140], [0, 7, 0], metal, 6); }
        else box(g, [100, 80, 25], [0, 200, -25], metal, 4);
        return g;
    };
    const cabinet = (id, at, width = 1100, height = 1000, open = false) => {
        const g = asset(id, open ? 'Learning cubby shelving' : 'Storage cabinet', at), depth = 420;
        box(g, [width, 45, depth], [0, 22.5, 0], oak, 5); box(g, [width, 30, depth], [0, height - 15, 0], oak, 5);
        for (const x of [-width / 2 + 15, width / 2 - 15]) box(g, [30, height, depth], [x, height / 2, 0], oak);
        box(g, [width, height - 40, 18], [0, height / 2, -depth / 2 + 9], accent);
        if (open) for (let row = 0; row < 3; row++) {
            box(g, [width - 60, 22, depth - 20], [0, 80 + row * 275, 0], oak);
            for (let col = 0; col < 3; col++) {
                box(g, [22, height - 40, depth - 20], [-width / 2 + (col + 1) * width / 3, height / 2, 0], oak);
                if (col < 2 || row < 2) box(g, [width / 3 - 80, 170, 260], [-width / 3 + col * width / 3, 178 + row * 275, 10], mat(['#b68c66', '#6e9c96', '#cebb74'][(row + col) % 3], 'fabric'), 8);
            }
        } else for (const side of [-1, 1]) {
            box(g, [width / 2 - 30, height - 90, 22], [side * width / 4, height / 2, depth / 2], trim, 4);
            box(g, [12, 110, 25], [side * 35, height / 2, depth / 2 + 20], metal, 4);
        }
        return g;
    };
    const cart = (id, at, type = 'it') => {
        const g = asset(id, type === 'hospital' ? 'Mobile clinical tool-cart' : 'Mobile IT tool-cart', at);
        for (const x of [-260, 260]) for (const z of [-180, 180]) {
            const wheel = mesh(g, new THREE.CylinderGeometry(46, 46, 28, 12), ink, [x, 46, z]); wheel.rotation.z = Math.PI / 2;
            rod(g, [x, 72, z], [x, 910, z], 16, metal);
        }
        for (const y of [145, 510, 900]) box(g, [620, 26, 460], [0, y, 0], trim, 12);
        rod(g, [-290, 980, -210], [290, 980, -210], 15, metal);
        if (type === 'it') {
            monitor(g, [0, 913, -100], 420, 2); box(g, [360, 110, 250], [0, 580, 0], ink, 7);
            for (let i = 0; i < 4; i++) box(g, [100, 20, 260], [-190 + i * 125, 172, 0], accent, 4);
        } else {
            for (let i = 0; i < 3; i++) box(g, [140, 90, 260], [-175 + i * 175, 570, 0], accent, 6);
            box(g, [330, 30, 230], [0, 930, 0], paper, 8);
        }
        return g;
    };

    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    const back = new THREE.Group(); back.name = `${spec.name} back wall`; root.add(back);
    box(back, [w, ceiling, 80], [0, ceiling / 2, bz - 40], wall);
    box(back, [w, 650, 18], [0, 325, bz + 9], accent);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = `${spec.name} side wall`; root.add(right);
    box(right, [80, ceiling, d], [w / 2 + 40, ceiling / 2, bz + d / 2], wall);
    box(right, [18, 110, d], [w / 2 - 9, 55, bz + d / 2], metal);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    // Left-side daylight is a framed opening; the front stays open for access.
    const left = new THREE.Group(); left.name = `${spec.name} window wall`; root.add(left);
    const windowCenter = bz + d * .54, opening = d * .48;
    box(left, [80, 800, d], [-w / 2 - 40, 400, bz + d / 2], wall);
    box(left, [80, ceiling - 2600, d], [-w / 2 - 40, (ceiling + 2600) / 2, bz + d / 2], wall);
    const rearEnd = windowCenter - opening / 2, frontStart = windowCenter + opening / 2;
    box(left, [80, 1800, rearEnd - bz], [-w / 2 - 40, 1700, (bz + rearEnd) / 2], wall);
    box(left, [80, 1800, front - frontStart], [-w / 2 - 40, 1700, (front + frontStart) / 2], wall);
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const window = new THREE.Group(); window.name = 'Daylight window'; window.position.set(-w / 2 + 15, 1700, bz + d * .54); window.rotation.y = Math.PI / 2; left.add(window);
    const sky = canvasMat(() => {}, 512, 512);
    mesh(window, new THREE.PlaneGeometry(d * .48, 1750), sky);
    for (const x of [-d * .24, 0, d * .24]) box(window, [45, 1840, 80], [x, 0, 5], trim, 3);
    for (const y of [-900, 900]) box(window, [d * .48 + 80, 50, 140], [0, y, 10], trim, 3);
    const door = new THREE.Group(); door.name = 'Room entry door'; right.add(door); door.position.set(w / 2 - 18, 0, front - 1600); door.rotation.y = -Math.PI / 2;
    box(door, [1020, 2240, 35], [0, 1120, 0], metal, 5);
    box(door, [930, 2150, 38], [0, 1075, 22], oak, 5);
    box(door, [200, 780, 10], [0, 1560, 47], mat('#9eb9bd', 'powder'), 5);
    rod(door, [310, 1040, 55], [310, 1190, 55], 12, metal);
    const sign = asset('room-sign', 'Wall room identity', [0, 2520, bz + 50], back);
    label(sign, spec.name.toUpperCase(), [Math.min(w - 500, 2700), 340], [0, 0, 0]);
    const board = asset('planning-board', spec.kind === 'operations' ? 'Wall operations overview' : 'Wall teaching and planning board', [w * .17, 1640, bz + 65], back);
    box(board, [2200, 1000, 40], [0, 0, 0], metal, 8);
    const boardMap = canvasMat((c, W, H) => drawInstitutionalBoard(c, W, H, spec));
    mesh(board, new THREE.PlaneGeometry(2140, 940), boardMap, [0, 0, 22]);
    // A real low support anchors all five daily activity kits.
    table('activity-table', 'Daily planning table', [layout.activity[0], 0, layout.activity[1]], 1300, 650, 740);
    cabinet('storage', [w / 2 - 760, 0, bz + 430], 1250, spec.kind === 'early' ? 940 : 1200, ['early', 'primary'].includes(spec.kind));
    chair('mobile-desk-chair', [layout.desk[0], 0, layout.desk[1] + 1050], 450, Math.PI / 5);

    if (spec.category === 'Educational') {
        const young = spec.kind === 'early' || spec.kind === 'primary';
        const topHeight = spec.kind === 'early' ? 520 : spec.kind === 'primary' ? 620 : 740;
        const rows = layout.schoolRows || 2 + index, columns = index > 0 ? 2 : 1;
        for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
            const x = columns === 1 ? w * .2 : -150 + col * 1850, z = bz + 2300 + row * 1450;
            const g = table(`student-table-${row}-${col}`, young ? 'Shared learning table' : spec.kind === 'university' ? 'Seminar table' : 'Student work table', [x, 0, z], 1250, 620, topHeight, young ? paper : oak);
            for (const dx of [-340, 340]) chair(`student-chair-${row}-${col}-${dx}`, [x + dx, 0, z + 570], topHeight - 260, 0);
            if (young) for (let n = 0; n < 3; n++) box(g, [70, 65 + n * 12, 70], [-240 + n * 160, topHeight + 34 + n * 6, 0], mat(['#ce805c', '#70a696', '#d4b864'][n], 'powder'), 7);
            else if (spec.kind === 'college' || spec.kind === 'university') {
                box(g, [300, 12, 210], [0, topHeight + 6, 0], ink, 5);
                box(g, [280, 170, 12], [0, topHeight + 92, -80], accent, 4);
            } else box(g, [220, 20, 170], [0, topHeight + 10, 0], accent, 3);
        }
        if (young) {
            const rug = asset('circle-rug', 'Learning circle floor rug', [-w / 2 + 1400, 0, front - 1500]);
            mesh(rug, new THREE.CylinderGeometry(950, 950, 5, 48), mat('#a9c5bc', 'fabric'), [0, 2.5, 0]);
            for (let n = 0; n < 7; n++) { const a = n / 7 * Math.PI * 2; mesh(rug, new THREE.CylinderGeometry(145, 145, 6, 20), mat(['#dcaa73', '#6f9fb1', '#b48d99'][n % 3], 'fabric'), [Math.cos(a) * 680, 7, Math.sin(a) * 680]); }
            const art = asset('student-art', 'Wall student artwork', [w / 2 - 45, 1900, bz + d * .52], right); art.rotation.y = -Math.PI / 2;
            label(art, 'OUR IDEAS GROW HERE', [1900, 360], [0, 0, 0], '#7c9b7e');
        } else {
            const display = asset('presentation-display', 'Wall presentation display', [w / 2 - 30, 1350, bz + d * .57], right); display.rotation.y = -Math.PI / 2;
            monitor(display, [0, 0, 0], 1500, 1, true);
        }
    } else if (spec.kind === 'operations' || spec.kind === 'police' || spec.kind === 'government') {
        const operations = spec.kind === 'operations';
        const rows = 2 + index;
        for (let n = 0; n < rows; n++) {
            const z = bz + 2200 + n * 1450, x = w * .22;
            const g = table(`workstation-${n}`, operations ? 'Security console table' : spec.kind === 'police' ? 'Case review workstation' : 'Public service workstation', [x, 0, z], 1500, 750);
            monitor(g, [operations ? -350 : 0, 740, -190], 560, n);
            if (operations) monitor(g, [350, 740, -190], 560, n + 1);
            box(g, [420, 18, 145], [0, 752, 160], ink, 5);
            chair(`operator-chair-${n}`, [x, 0, z + 680]);
        }
        if (operations) {
            // A six-screen overview is recognisable without using real footage.
            board.visible = false;
            const overview = asset('overview', 'Wall security display array', [0, 1520, bz + 70], back);
            for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) monitor(overview, [-850 + col * 850, row * 500 - 350, 0], 800, row * 3 + col, true);
        }
        if (spec.kind === 'police') {
            const lockers = cabinet('equipment-lockers', [w / 2 - 450, 0, bz + d * .72], 1600, 1900); lockers.rotation.y = -Math.PI / 2;
            label(lockers, 'EQUIPMENT', [1250, 180], [0, 1680, 235]);
        }
        if (spec.kind === 'government') {
            const counter = table('service-counter', 'Public reception counter', [w / 2 - 1050, 0, front - 2000], 1700, 700, 1000, paper);
            label(counter, 'WELCOME', [900, 160], [0, 810, 365]);
        }
    } else if (spec.kind === 'lab') {
        for (let n = 0; n < 2 + index; n++) {
            const x = w * .2, z = bz + 2300 + n * 1500;
            const g = table(`lab-bench-${n}`, 'Laboratory bench', [x, 0, z], 1800, 850, 900, ink);
            for (const dx of [-500, 500]) {
                box(g, [180, 32, 230], [dx, 916, 0], trim, 7);
                rod(g, [dx, 930, -50], [dx + 50, 1110, -40], 23, metal);
                rod(g, [dx + 50, 1110, -40], [dx, 1200, -20], 24, ink);
                box(g, [120, 14, 100], [dx, 1000, 15], metal, 2);
                mesh(g, new THREE.CylinderGeometry(25, 32, 85, 16), mat('#80b1b0', 'powder'), [dx + 220, 944, 80]);
            }
            chair(`lab-stool-${n}`, [x, 0, z + 680], 610);
        }
        cart('sample-cart', [w / 2 - 700, 0, front - 2300], 'hospital');
        const hood = asset('fume-hood', 'Laboratory extraction hood', [0, 0, bz + 450]);
        box(hood, [1700, 850, 650], [0, 425, 0], trim, 12);
        for(const x of [-420,420]) { box(hood,[810,740,25],[x,450,340],accent,6);box(hood,[140,16,30],[x,720,360],metal,4); }
        box(hood,[1670,60,690],[0,910,0],ink,6);
        box(hood,[1550,1000,35],[0,1450,-300],ink,4);
        for(const x of [-800,800]) box(hood,[100,1050,650],[x,1475,0],trim,6);
        box(hood,[1700,200,650],[0,2000,0],trim,10);
        box(hood,[700,80,500],[0,2140,-50],metal,6);
        box(hood,[1460,650,14],[0,1580,335],mat('#94c1c9','powder',{transparent:true,opacity:.22,depthWrite:false}),4);
        rod(hood,[-730,1250,350],[730,1250,350],14,metal);
        label(hood,'EXTRACTION / ANALYSIS',[1150,95],[0,2000,332]);
    } else if (spec.kind === 'hospital') {
        const beds = 1 + index;
        for (let n = 0; n < beds; n++) {
            const x = w * .22, z = bz + 2600 + n * 2500;
            const bed = asset(`care-bed-${n}`, 'Hospital care bed', [x, 0, z]);
            for (const dx of [-420, 420]) for (const dz of [-850, 850]) {
                const wheel = mesh(bed, new THREE.CylinderGeometry(55, 55, 34, 14), ink, [dx, 55, dz]); wheel.rotation.z = Math.PI / 2;
                box(bed, [40, 430, 40], [dx, 290, dz], metal, 7);
            }
            box(bed, [1000, 80, 2100], [0, 500, 0], trim, 25);
            box(bed, [940, 130, 1950], [0, 605, 0], mat('#b5cdd0', 'fabric'), 35);
            box(bed, [700, 95, 370], [0, 715, -680], paper, 40);
            for (const dz of [-1060, 1060]) box(bed, [1030, 460, 65], [0, 700, dz], accent, 24);
            for (const dx of [-510, 510]) rod(bed, [dx, 790, -650], [dx, 790, 650], 20, metal);
            const obs = asset(`patient-monitor-${n}`, 'Observation monitor stand', [x + 950, 0, z - 600]);
            box(obs, [450, 30, 450], [0, 15, 0], metal, 15); rod(obs, [0, 20, 0], [0, 1150, 0], 25, metal); monitor(obs, [0, 1150, 0], 480, n);
            // Curtain stays attached to its floor stand, and moves as one item.
            const curtain = asset(`privacy-screen-${n}`, 'Mobile privacy screen', [x + 1450, 0, z + 180]);
            for (const dz of [-750, 750]) { box(curtain, [420, 35, 80], [0, 17.5, dz], metal, 7); rod(curtain, [0, 35, dz], [0, 1950, dz], 15, metal); }
            box(curtain, [22, 1500, 1450], [0, 1170, 0], mat('#adc7c2', 'fabric'), 8);
        }
        cart('clinical-cart', [w / 2 - 650, 0, front - 1850], 'hospital');
    } else if (spec.kind === 'it') {
        for (let n = 0; n < 2 + index; n++) {
            const rack = asset(`server-rack-${n}`, 'IT equipment rack', [-50 + n * 1050, 0, bz + 650]);
            box(rack, [800, 2000, 900], [0, 1000, 0], ink, 12);
            for (let unit = 0; unit < 10; unit++) {
                box(rack, [730, 125, 25], [0, 220 + unit * 170, 465], metal, 5);
                for (let lamp = 0; lamp < 3; lamp++) sphere(rack, [7, 7, 4], [240 + lamp * 28, 220 + unit * 170, 480], glow);
                for (let slot = 0; slot < 4; slot++) box(rack, [300, 4, 3], [-130, 195 + unit * 170 + slot * 14, 481], ink);
            }
        }
        for (let n = 0; n < 2 + index; n++) cart(`diagnostic-cart-${n}`, [w * .2, 0, bz + 2700 + n * 1450]);
        const bench = table('service-bench', 'IT service workbench', [w / 2 - 650, 0, front - 2400], 1400, 700, 900); bench.rotation.y = -Math.PI / 2;
        monitor(bench, [0, 900, -130], 600, 2);
    }
    const dressAtmosphere = enrichInstitutionalRoom(room, root, layout, spec, h, { asset, wall: back, right, left, window, cabinet, label, board, table, chair, oak });
    // Slim linear ceiling fixtures disappear with the camera cutaway.
    const ceilingGroup = new THREE.Group(); ceilingGroup.name = 'Ceiling lighting'; root.add(ceilingGroup); room.ceilingFixture = ceilingGroup;
    for (let n = 0; n < 3; n++) {
        const z = bz + d * (.2 + n * .29);
        box(ceilingGroup, [w * .68, 50, 150], [0, ceiling - 100, z], metal, 10);
        box(ceilingGroup, [w * .66, 8, 115], [0, ceiling - 129, z], glow, 6);
    }
    const lights = [[layout.desk[0], 2100, layout.desk[1]], [w * .2, 2200, bz + d * .46], [0, 2300, front - 1300]].map(at => {
        const light = new THREE.PointLight('#e7f3ff', 0, 5500 * root.scale.x, 2); light.position.set(...at); root.add(light); return light;
    });
    room.roomAtmosphere = (phase, gain = 1) => {
        const mode = spec.modes[phase] || spec.modes.morning;
        drawInstitutionalCampus(sky.map.image.getContext('2d'), 512, 512, phase, mode.sky, spec); sky.map.needsUpdate = true;
        glow.emissiveIntensity = .15 + mode.practical * gain;
        screenMats.forEach(m => {
            // Screens stay readable without lighting the whole watch room.
            m.emissiveIntensity = phase === 'night' ? .19 : .14;
            if (screenPhase !== phase) {
                drawInstitutionalScreen(m.map.image.getContext('2d'), m.map.image.width, m.map.image.height, spec, m.userData.screenVariant, phase);
                m.map.needsUpdate = true;
            }
        });
        screenPhase = phase;
        lights.forEach((l, n) => {
            l.color.set(n === 2 ? mode.colors[1] : mode.colors[0]);
            const night = phase === 'night';
            const background = night ? (spec.kind === 'hospital' ? .28 : spec.kind === 'operations' ? .35 : .55) : 1;
            const power = n === 0 ? 4 * mode.practical : (n === 1 ? 5 * mode.practical : 2 * mode.practical + 2 * mode.wash) * background;
            l.intensity = (root.scale.x * 1000) ** 2 * power * gain;
        });
        dressAtmosphere(phase, gain);
        root.userData.atmosphere = phase;
    };
    root.userData.dimensionsMm = { width: w, depth: d, height: ceiling };
    root.userData.environmentCategory = spec.category;
    room.roomAtmosphere('morning');
}
