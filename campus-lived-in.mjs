import * as THREE from 'three';
import { detailKit } from './institutional-detail.mjs?v=scene-desk-styling-20261010';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';

// Furniture-local dressing. Nothing is mounted to a tilting ErgoFlex desktop:
// its saved Product layout and automatic stow system continue to own those items.
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const PAPER = '#eeeade', INK = '#27343c', SILVER = '#aeb8be';
const TITLES = {
    library: ['FIELD NOTES', 'RESEARCH TOGETHER', 'READ / REFLECT', 'RETURNS / TOMORROW', 'WATERSHED WORKSHOP'],
    occmedialab: ['CALL SHEET / 07', 'PICTURE EDIT / V03', 'SOUND / COLOUR', 'SCREENING NOTES', 'PORTFOLIO CRITIQUE'],
    highschool: ['FIRST BELL / SCIENCE 214', 'WAVE LAB / OBSERVATIONS', 'AFTER SCHOOL / STUDY', 'NEXT LESSON / PREP', 'OILER SHOWCASE']
};
const CAPTIONS = {
    library: ['North coast / field journal', 'Compare sources / share evidence', 'Mark a passage / add a question', 'Returned / checked / ready to shelve', 'Map the catchment / compare samples'],
    occmedialab: ['Coast stories / camera + sound', 'Select / trim / review / export', 'Room tone / dialogue / mix notes', 'What worked? What would you change?', 'Work in progress / peer feedback'],
    highschool: ['Prediction / question / sketch', 'Measure / repeat / compare', 'Work it out / explain your method', 'Feedback / next steps / materials', 'Our question / our evidence / our result']
};
const rand = n => { const x = Math.sin(n * 31.7 + 91.3) * 43173; return x - Math.floor(x); };

// One sheet atlas per room, with five genuinely different documents. Printed
// matter is matte; only actual lamp diffusers emit light.
function documentAtlas(kind, accent) {
    const canvas = document.createElement('canvas'); canvas.width = 1152; canvas.height = 960;
    const c = canvas.getContext('2d'), W = 384, H = 480;
    for (let phase = 0; phase < 5; phase++) {
        c.save(); c.translate((phase % 3) * W, Math.floor(phase / 3) * H);
        c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
        for (let n = 0; n < 1800; n++) { c.fillStyle = n % 2 ? '#ffffff12' : '#584c3c08'; c.fillRect(rand(n) * W, rand(n + 9) * H, 1, 2); }
        c.fillStyle = accent; c.fillRect(24, 24, 38, 6);
        c.font = 'bold 17px sans-serif'; c.fillText(TITLES[kind][phase], 24, 56, W - 48);
        c.font = '11px sans-serif'; c.fillStyle = '#637373'; c.fillText(CAPTIONS[kind][phase], 24, 76, W - 48);
        c.strokeStyle = '#a2aaa140'; c.lineWidth = 1;
        for (let x = 24; x < W - 20; x += 20) { c.beginPath(); c.moveTo(x, 96); c.lineTo(x, 330); c.stroke(); }
        for (let y = 96; y < 335; y += 20) { c.beginPath(); c.moveTo(24, y); c.lineTo(W - 24, y); c.stroke(); }
        c.strokeStyle = accent; c.lineWidth = 2.4;
        if (kind === 'occmedialab' && phase < 2) {
            for (let n = 0; n < 6; n++) {
                const x = 30 + (n % 2) * 166, y = 106 + Math.floor(n / 2) * 70;
                c.fillStyle = ['#acc1c1', '#bcc4bb', '#d0b58e'][n % 3]; c.fillRect(x, y, 150, 58);
                c.fillStyle = '#47777d'; c.beginPath(); c.moveTo(x, y + 48); c.quadraticCurveTo(x + 75, y + 15 + n * 3, x + 150, y + 43); c.lineTo(x + 150, y + 58); c.lineTo(x, y + 58); c.fill();
                c.fillStyle = INK; c.font = '10px monospace'; c.fillText(phase ? `00:${12 + n * 7}:04  /  take ${n % 3 + 1}` : `SHOT 0${n + 1}  /  ${n % 2 ? 'DETAIL' : 'WIDE'}`, x + 4, y + 12);
            }
        } else if ((kind === 'highschool' && phase === 1) || (kind === 'occmedialab' && phase === 2)) {
            for (let r = 0; r < 3; r++) { c.beginPath(); for (let n = 0; n <= 140; n++) { const x = 28 + n * 2.3, y = 138 + r * 75 + Math.sin(n * (.12 + r * .06)) * (13 + r * 7); if (n) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
            c.fillStyle = INK; c.font = '11px monospace'; c.fillText(kind === 'highschool' ? 'f / Hz        amplitude / mm' : 'DX -12 dB     ROOM -24 dB', 36, 325);
        } else if (kind === 'library' && [0, 4].includes(phase)) {
            for (let r = 0; r < 9; r++) { c.strokeStyle = ['#758c70', '#a0ac87', '#5a8a9b'][r % 3]; c.beginPath(); for (let n = 0; n <= 60; n++) { const x = 28 + n * 5.3, y = 110 + r * 22 + Math.sin(n * .12 + r) * 18; if (n) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
            c.fillStyle = accent; for (const [x, y] of [[70, 155], [170, 213], [287, 265]]) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
        } else {
            ['OBSERVATION', 'QUESTION', 'NEXT STEP'].forEach((s, i) => {
                const y = 118 + i * 72; c.fillStyle = accent; c.font = 'bold 12px sans-serif'; c.fillText(s, 32, y);
                c.strokeStyle = '#677679'; c.lineWidth = 1;
                for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(32, y + 13 + r * 11); for (let n = 1; n < 32 - r * 4; n++) c.lineTo(32 + n * 9, y + 13 + r * 11 + Math.sin(n * 2.2 + i) * 1.4); c.stroke(); }
            });
        }
        c.fillStyle = '#d4b45d66'; c.fillRect(25, 353, 220, 16);
        c.fillStyle = INK; c.font = 'italic 14px serif'; c.fillText(['Bring one question.', 'Compare with the first attempt.', 'Save this for the group.', 'Ready for the next session.', 'Try the suggestion in the next version.'][phase], 28, 366, 320);
        c.font = '10px monospace'; c.fillStyle = '#6b736d'; c.fillText('WORKING COPY     /     ' + String(phase + 1).padStart(2, '0'), 26, 450);
        c.restore();
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function addCampusLife({ room, root, layout, asset, byId, kind = room.id }) {
    if (!TITLES[kind]) return { apply() {} };
    const accent = { library: '#365e4c', occmedialab: '#174e76', highschool: '#bf642b' }[kind];
    const own = m => { room.ownedMaterials?.add(m); m.userData.roomPaletteLocked = true; m.userData.roomFinishLocked = true; return m; };
    const matte = own(new THREE.MeshStandardMaterial({ name: 'Campus paper, rubber & painted detail', vertexColors: true, roughness: .79, dithering: true }));
    const metal = own(new THREE.MeshStandardMaterial({ name: 'Campus brushed aluminium', vertexColors: true, roughness: .42, metalness: .72, dithering: true }));
    const printed = own(new THREE.MeshStandardMaterial({ name: 'Annotated activity papers', map: documentAtlas(kind, accent), roughness: .96, side: THREE.DoubleSide }));
    const pools = createPoolLayer(root, 'Campus task light pools');
    const variants = [], lamps = [], sheets = [];
    const piece = (parent, name, at, draw, finish = matte) => {
        const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g);
        const k = detailKit(); draw(k); k.build(g, finish); return g;
    };
    const sheet = (parent, phase, at, width = 210, yaw = 0) => {
        const geo = new THREE.PlaneGeometry(width, width * 1.25), uv = geo.attributes.uv;
        for (let n = 0; n < uv.count; n++) uv.setXY(n, (phase % 3 + .004 + uv.getX(n) * .992) / 3, 1 - (Math.floor(phase / 3) + .004 + (1 - uv.getY(n)) * .992) / 2);
        const o = new THREE.Mesh(geo, printed); o.name = TITLES[kind][phase]; o.position.set(...at); o.rotation.set(-Math.PI / 2, 0, yaw); o.receiveShadow = true; parent.add(o); sheets.push(o); return o;
    };
    const pen = (k, x, z, color = INK) => { k.box([7, 7, 142], [x, 5, z], color, [0, .14, 0]); k.box([8, 8, 22], [x + 8, 5, z + 57], SILVER, [0, .14, 0]); };
    const notebook = (k, x, z, stacked = 0) => {
        k.box([205, 17, 260], [x, stacked + 8.5, z], accent, undefined, 'fabric'); k.box([196, 12, 250], [x + 3, stacked + 9, z], PAPER, undefined, 'paper');
        k.box([205, 2, 260], [x, stacked + 18, z], accent, undefined, 'fabric'); k.box([10, 2, 262], [x + 65, stacked + 19.5, z], '#bd9660');
    };
    const bottle = (k, x, z) => { k.cyl(30, 33, 190, [x, 95, z], '#79948d'); k.cyl(27, 27, 26, [x, 203, z], INK, 'rubber'); k.box([18, 7, 22], [x, 219, z], SILVER, undefined, 'metal'); };
    const headphone = (k, x, z) => {
        k.add(new THREE.TorusGeometry(65, 9, 6, 20, Math.PI), [x, 19, z], INK, [1, 1, 1], [Math.PI / 2, 0, 0]);
        for (const s of [-1, 1]) { k.cyl(30, 30, 25, [x + s * 65, 14, z], INK, 'rubber'); k.cyl(22, 22, 27, [x + s * 65, 14, z], '#536976'); }
    };
    const daily = (support, id, name, at, draw) => {
        const g = asset(`campus-life-${id}`, name, at, support); g.userData.campusLife = { kind, support: support.userData.propId };
        const states = PHASES.map((phase, p) => { const child = new THREE.Group(); child.name = `${name} · ${phase}`; child.userData.campusPhase = phase; g.add(child); draw(child, p); return child; });
        variants.push(states); return g;
    };
    function taskLight(support, id, at, actual = false) {
        const g = asset(`campus-light-${id}`, 'Bronze reading light · adjustable task bar', at, support);
        piece(g, 'Brushed frame and clamp', [0, 0, 0], k => {
            k.box([68, 12, 68], [0, 6, 0], '#7f725c'); k.cyl(8, 8, 355, [0, 185, 0], '#8c7a58');
            k.box([285, 22, 55], [110, 365, 0], '#635a49'); k.cyl(17, 17, 24, [0, 355, 0], '#a99571');
        }, metal);
        const diffuser = own(new THREE.MeshStandardMaterial({ name: 'Reading light opal diffuser', color: '#f3eddf', emissive: '#ffe1b5', emissiveIntensity: .3, roughness: .48 }));
        const face = new THREE.Mesh(new THREE.BoxGeometry(260, 4, 38), diffuser); face.position.set(110, 352, 0); g.add(face);
        const levels = [.12, .08, .75, .3, .5]; // left on at night: the commons' night circuit
        pools.add(g, [105, 1.4, 45], [650, 520], '#ffe1b5', levels.map(x => x * .28));
        let light;
        if (actual) { light = new THREE.PointLight('#ffe1b5', 0, root.scale.x * 1100, 2); light.position.set(110, 315, 0); g.add(light); }
        lamps.push({ g, diffuser, light, levels });
    }

    if (kind === 'highschool') {
        for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
            const id = `student-table-${r}-${col}`, support = byId(id); if (!support) continue;
            daily(support, id, 'Student investigation & work in progress', [0, 742, 0], (g, p) => {
                const k = detailKit(), active = p !== 3 && (p !== 2 || (r + col) % 2 === 0);
                if (active) for (const side of [-1, 1]) {
                    if (id === 'student-table-2-2' && side > 0) continue; // the owner's violin
                    // Each place is its own: some are empty (nobody sits there this
                    // period), the rest differ in what came out of the bag. Stable per seat.
                    const x = side * 310, seat = (r * 3 + col) * 2 + (side > 0), v = rand(seat * 7.3 + p * 1.7), skew = (rand(seat * 2.9 + p) - .5) * .5;
                    if (p < 2 && rand(seat * 3.1 + 4) < .22) continue;
                    sheet(g, p, [x + skew * 60, 2.4, 95 - skew * 30], 195, side * .03 + skew * .6); pen(k, x + 130 + skew * 40, 105 - (v > .5 ? 60 : 0), p === 1 ? '#ba6536' : INK);
                    if (p === 0 && v < .55) notebook(k, x - 30, -95);
                    // Calculators and phones are library props (HS_SEAT_PROPS in institutional-education.mjs).
                    if (p === 2 && side < 0) bottle(k, x - 155, -145);
                    if (p === 4) { k.box([90, 55, 38], [x + 155, 28, -110], '#d6a057'); k.box([20, 80, 20], [x + 155, 67, -110], INK); k.ball(24, [x + 155, 115, -110], '#c9a06b'); }
                }
                if (p === 1) {
                    // A compact spring-wave experiment, clipped ruler and stopwatch.
                    k.box([560, 8, 105], [0, 4, -192], '#c9bb9e');
                    const points = Array.from({ length: 161 }, (_, n) => new THREE.Vector3(-230 + n * 2.85, 29 + Math.sin(n * Math.PI / 4) * 18, -192 + Math.cos(n * Math.PI / 4) * 18));
                    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 1.8, 5, false), [0, 0, 0], SILVER);
                    for (const x of [-250, 250]) { k.box([15, 62, 60], [x, 31, -192], accent); k.box([24, 8, 110], [x, 4, -192], INK); }
                    for (let n = 0; n < 28; n++) k.box([1.5, 1, n % 5 ? 8 : 18], [-260 + n * 19, 9, -151], INK);
                }
                if (p === 3 && r === 0 && col === 0) { notebook(k, 0, -80); notebook(k, 7, -76, 20); }
                if (p === 4) {
                    // Showcase: a tri-fold project board on the edge of the table
                    // away from the visitors (side tables stand against the walls,
                    // the middle row is turned to face the room).
                    const B = new THREE.Group(); B.position.set(col === 0 ? -470 : col === 2 ? 470 : 0, 0, col === 1 ? 230 : 0); B.rotation.y = col === 0 ? Math.PI / 2 : col === 2 ? -Math.PI / 2 : Math.PI; g.add(B);
                    const b = detailKit(), tone = ['#e8702a', '#2e6f8e', '#1d1d1f', '#9cc3b6'][(r * 3 + col) % 4];
                    b.box([560, 760, 8], [0, 382, 0], '#f4f2ea', null, 'paper');
                    for (const s of [-1, 1]) b.box([280, 760, 8], [s * (280 + 280 * Math.cos(.7)) / 2 + s * 2, 382, 140 * Math.sin(.7) / 1.05], '#f4f2ea', [0, -s * .7, 0], 'paper');
                    b.box([520, 90, 3], [0, 700, 6], tone, null, 'paper');
                    for (let n = 0; n < 4; n++) b.box([230, 170, 2], [-125 + (n % 2) * 250, 520 - Math.floor(n / 2) * 210, 6], ['#ffffff', '#e9e3d2', '#dfe9ee', '#ffffff'][n], null, 'paper');
                    b.box([380, 70, 2], [0, 120, 6], tone, null, 'paper');
                    b.build(B, matte);
                }
                k.build(g, matte);
            });
        }
    } else if (kind === 'occmedialab') {
        const table = byId('activity-table');
        if (table?.children[0]?.isMesh) {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
            const c = canvas.getContext('2d'); c.fillStyle = '#b5a387'; c.fillRect(0, 0, 512, 128);
            for (let n = 0; n < 160; n++) {
                c.strokeStyle = n % 3 ? '#66534018' : '#fff2d42a'; c.lineWidth = .6; c.beginPath();
                c.moveTo(0, n * .8); c.bezierCurveTo(160, n * .8 + Math.sin(n) * 2, 350, n * .8 - 2, 512, n * .8); c.stroke();
            }
            const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
            const top = own(new THREE.MeshStandardMaterial({ name: 'OCC pale ash review surface', map, roughness: .62, dithering: true }));
            table.children[0].material = top;
        }
        if (table) daily(table, 'critique', 'Production notes, review tools & student work', [0, 742, 0], (g, p) => {
            const k = detailKit();
            const count = [3, 2, 1, 4, 4][p];
            for (let n = 0; n < count; n++) sheet(g, p, [-210 + n * 180, 2 + n * .6, 75 + (n % 2) * 22], 154, (n - 1) * .04);
            if (p === 0) { notebook(k, 360, -110); k.box([200, 112, 14], [-170, 60, -130], INK, undefined, 'metal'); k.box([210, 22, 18], [-170, 128, -130], PAPER, undefined, 'paper'); for (let n = 0; n < 5; n++) k.box([18, 23, 19], [-250 + n * 40, 128, -130], INK, [0, 0, .4], 'metal'); }
            if (p === 1) { k.box([100, 17, 64], [290, 8.5, -145], SILVER, undefined, 'metal'); k.box([80, 2, 40], [290, 18, -145], INK, undefined, 'rubber'); headphone(k, -180, -130); pen(k, 100, -115); }
            if (p === 2) { headphone(k, 110, -90); k.box([180, 40, 105], [400, 20, -130], INK, undefined, 'metal'); for (let n = 0; n < 4; n++) k.cyl(8, 8, 7, [340 + n * 40, 44, -130], n ? SILVER : '#d98a3e', 'metal'); for (let n = 0; n < 8; n++) k.box([17, 2, 45], [-180 + n * 25, 2, -120], ['#ddddce', '#a6aaa6', '#708c94', '#314654'][n % 4], undefined, 'paper'); }
            if (p === 3) { for (let n = 0; n < 4; n++) pen(k, -190 + n * 180, -125); }
            if (p === 4) {
                // Wrap food (takeout boxes, coffee cups, soda) is library props: see institutional-media.mjs.
            }
            if (p === 4) { for (let n = 0; n < 4; n++) { k.box([55, 1, 60], [-100 + n * 85, 2, -150], ['#d8bc68', '#95b7ba', '#b8c9a4'][n % 3], undefined, 'paper'); pen(k, 490, 90); } }
            k.build(g, matte);
        });
        const printer = byId('print-scan');
        if (printer) daily(printer, 'proofs', 'Print proofs & paper offcuts', [0, 900, 0], (g, p) => {
            // Front edge of the print counter, clear of the printer footprint.
            sheet(g, p, [-480, 8, 130], 100, -.025);
            piece(g, 'Paper stock and binding clips', [-480, 0, 130], k => { k.box([110, 6, 140], [0, 3, 0], PAPER, undefined, 'paper'); k.box([21, 15, 14], [-38, 13, 53], INK, undefined, 'metal'); });
        });
    } else {
        for (const [id, at, real] of [
            ['humboldt-table-b1', [-1020, 751, -330], true],
            ['humboldt-table-b3', [-720, 751, -330], false],
            ['humboldt-table-l1', [-1010, 751, -560], true]
        ]) { const support = byId(id); if (support) taskLight(support, id, at, real); }
        // An editorial display on the otherwise quiet far-end café table.
        // The centre stays clear for its stoneware vase. This kit occupies a
        // separate quadrant, with every paper corner inside the 520 mm top.
        const cafe = byId('humboldt-cafe-7');
        if (cafe) daily(cafe, 'field-reading', 'North coast field reading & workshop notes', [180, 750, 120], (g, p) => {
            const k = detailKit();
            if (p === 3) notebook(k, 0, 0);
            else { sheet(g, p, [0, 2, 0], 220, -.08); pen(k, 150, 15); k.box([65, 1, 65], [110, 3, -100], '#c8b77e'); }
            k.build(g, matte);
        });
    }
    const apply = (phase, gain = 1) => {
        const p = Math.max(0, PHASES.indexOf(phase));
        variants.forEach(states => states.forEach((g, i) => { g.visible = i === p; }));
        for (const lamp of lamps) {
            lamp.diffuser.emissiveIntensity = .035 + lamp.levels[p] * gain;
            lamp.diffuser.emissive.set(p === 4 ? '#f2e6cf' : '#ffe1b5');
            if (lamp.light) { lamp.light.color.copy(lamp.diffuser.emissive); lamp.light.intensity = (root.scale.x * 1000) ** 2 * lamp.levels[p] * .42 * gain; }
        }
        pools.apply(p, gain);
        root.userData.campusLife = { version: 1, kind, phase: PHASES[p], activity: TITLES[kind][p], supports: variants.length, lamps: lamps.length, paperCount: sheets.length };
    };
    apply('morning');
    return { apply };
}
