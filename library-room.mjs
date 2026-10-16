import * as THREE from 'three';
import { roomLifeBaseTransform } from './room-life.mjs?v=humboldt-commons-20261015';
import { buildLibraryCampusDetails } from './library-campus-details.mjs?v=library-floorplan-20261013';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';
import { makeHumboldtLayout, buildHumboldtCommons } from './library-humboldt-commons.mjs?v=humboldt-commons-20261015';

// Campus-library concepts, not a survey of the Humboldt pilot site.
// Architecture and furniture coordinates are millimetres.
const sizes = [
    ['apartment', 'Student pilot study nook', 5400, 6600, 3000],
    ['house', 'Campus reading room', 7200, 9000, 3100],
    ['spacious', 'Learning commons', 10000, 12000, 3400],
    ['premium', 'University study hall', 13000, 16000, 3800],
    ['executive', 'Flagship library commons', 18000, 20000, 4400]
];
function makeLibraryLayout([id, name, width, depth, height], index, legacy = false) {
    const back = -depth / 3, front = back + depth, desk = [-width / 2 + 1100, back + 1600];
    let reading = index === 0 ? [[width / 2 - 1300, front - 2200]] : index < 3 ? [[width / 2 - 1600, front - 2300]] : [[0, front - 2400], [width / 2 - 1800, front - 2400]];
    // Keep existing tables first so saved fixtures retain their identities.
    if (index === 2) reading.push([0, front - 2300]);
    if (index === 3) reading.push([width / 2 - 1800, front - 5500]);
    if (index === 4) reading.push([0, front - 5600], [width / 2 - 1800, front - 5600]);
    if (!legacy) {
        // Reserve a chair pull-back zone around each table, then an open aisle.
        // Rugs are smaller than the occupied seating zone and never share edges.
        if (index === 0) reading.splice(0, reading.length, [width / 2 - 1300, front - 2400]);
        if (index === 1) reading.splice(0, reading.length, [width / 2 - 1700, front - 3100]);
        if (index === 2) reading.splice(0, reading.length, [width / 2 - 1600, front - 2200], [-300, front - 2200]);
        if (index === 3) reading.splice(0, reading.length, [0, front - 2000], [width / 2 - 1800, front - 2000], [width / 2 - 1800, front - 5500]);
        if (index === 4) reading.splice(0, reading.length, [0, front - 2000], [width / 2 - 1800, front - 2000], [0, front - 5500], [width / 2 - 1800, front - 5500]);
    }
    const stacks = [];
    // Rear stacks and freestanding double-sided shelves with clear aisles.
    const rearCount = index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : index === 3 ? 4 : 6;
    for (let i = 0; i < rearCount; i++) stacks.push({ id: `rear-${i}`, at: [(i - (rearCount - 1) / 2) * 2000, back + 330], double: false });
    let columns = index === 1 ? [width / 2 - 2000] : index === 2 ? [0, 3000] : index === 3 ? [-1000, 2000, 5000] : [-2000, 1100, 4200, 7300];
    // Abutting sections form real ranges (1860 mm pitch includes the end panels).
    if (!legacy) columns = index === 3 ? [0, 1860, 3720] : index === 4 ? [-1700, 160, 4100, 5960] : columns;
    let rows = index === 1 ? [2800, 4500] : index === 2 ? [3000, 5400] : index === 3 ? [3000, 5400, 7800] : [3200, 5600, 8000, 10400];
    if (!legacy) rows = index === 1 ? [3000] : index === 2 ? [4800, 7000] : index === 3 ? [4600, 6250, 7900] : [4800, 7000, 9200, 11400];
    if (index) for (const [ci, x] of columns.entries()) for (const [ri, z] of rows.entries()) stacks.push({ id: `stack-${ci}-${ri}`, at: [x, back + z], double: true });
    const lounge = [-width / 2 + (index ? 1450 : 700), front - (index ? 650 : 900)];
    let carrels = index >= 1 ? Array.from({ length: [0, 2, 2, 4, 6][index] }, (_, i) => front - 4000 - i * 1800).map((z, i) => ({ id: `carrel-${i}`, at: [-width / 2 + 420, z] })) : [];
    let research = index >= 2 ? [-width / 2 + 2600, front - 4600] : null;
    if (!legacy) {
        carrels = index ? Array.from({ length: [0, 1, 2, 4, 6][index] }, (_, i) => ({ id: `carrel-${i}`, at: [-width / 2 + 420, back + (index === 1 ? 5000 : 4800 + i * 1800)] })) : [];
        // Research terminals occupy the rear service bay, not the reading aisle.
        research = index >= 2 ? [index === 2 ? -1100 : -width / 2 + 4000, back + 2300] : null;
    }
    // Put circulation beside the catalog/returns zone, leaving the window
    // study edge and the route out of the pilot desk bay unobstructed.
    const service = index >= 2 ? [width / 2 - 1700, back + 1700] : null;
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1050], turn: 180 }, { id: 'monstera', at: [-width / 2 + 450, 0, back + 430] }];
    for (const [i, at] of reading.slice(0, index >= 3 ? 2 : 1).entries()) {
        const seats = index === 0 ? [-500, 500] : [-650, 650];
        for (const x of seats) for (const z of [legacy ? -850 : -1000, legacy ? 850 : 1000]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [at[0] + x, 0, at[1] + z], turn: z > 0 ? 180 : 0 });
        props.push({ id: 'kenney-furniture-laptop', at: [at[0] - 430, 740, at[1] - 260] }, { id: 'journal', at: [at[0] + 480, 740, at[1] + 260], turn: 12 },
            { id: 'kenney-furniture-books', at: [at[0] + 30, 740, at[1] + 250] });
    }
    // Leather reading seats suit the panelled room better than bright fabric.
    if (index === 0) props.push({ id: 'armchair-leather', at: [lounge[0], 0, lounge[1]] });
    else props.push({ id: 'sofa-leather-couch', at: [lounge[0], 0, lounge[1]] }, { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 980] },
        { id: 'journal', at: [lounge[0] - 180, 391.2, lounge[1] - 980] });
    for (const carrel of (index >= 2 ? carrels.slice(0, 2) : [])) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [carrel.at[0] + 800, 0, carrel.at[1]], turn: legacy ? 90 : -90 },
        { id: 'journal', at: [carrel.at[0] + 60, 740, carrel.at[1]], turn: 90 });
    props.push({ id: 'monstera', at: [width / 2 - (!legacy && index >= 2 ? 230 : 480), 0, legacy ? front - 550 : index >= 2 ? front - 1100 : back + 2300] });
    // A globe on the lounge side table; the table carries it when moved.
    const sideTable = [lounge[0] + (index ? 1460 : legacy ? 880 : 1050), lounge[1] + (index ? -120 : 60)];
    props.push({ id: 'globe', at: [sideTable[0], 560, sideTable[1]], turn: 25 });
    // Append new native props after the original list. The loader keys include
    // the placement index, so inserting them earlier would lose saved edits.
    for (const at of reading.slice(index >= 3 ? 2 : 1)) {
        for (const x of [-650, 650]) for (const z of [legacy ? -850 : -1000, legacy ? 850 : 1000]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [at[0] + x, 0, at[1] + z], turn: z > 0 ? 180 : 0 });
        props.push({ id: 'kenney-furniture-laptop', at: [at[0] - 430, 740, at[1] - 260] }, { id: 'journal', at: [at[0] + 480, 740, at[1] + 260], turn: 12 }, { id: 'kenney-furniture-books', at: [at[0] + 30, 740, at[1] + 250] });
    }
    if (research) for (const dx of [-450, 450]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [research[0] + dx, 0, research[1] + (legacy ? 850 : 1000)], turn: 180 });
    for (const carrel of carrels.slice(2)) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [carrel.at[0] + 800, 0, carrel.at[1]], turn: legacy ? 90 : -90 }, { id: 'journal', at: [carrel.at[0] + 60, 740, carrel.at[1]], turn: 90 });
    if (index === 1) for (const carrel of carrels) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [carrel.at[0] + 800, 0, carrel.at[1]], turn: legacy ? 90 : -90 }, { id: 'journal', at: [carrel.at[0] + 60, 740, carrel.at[1]], turn: 90 });
    if (!legacy && index === 4) {
        // New books and browsing: low shelving that keeps sightlines open, with
        // two reading chairs turned to the room and a plant at the run end.
        for (const x of [-5600, -4500, -3400]) props.push({ id: 'ergoflex-small-bookshelf', at: [x, 0, front - 3800] });
        for (const x of [-5300, -3900]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, front - 2300] });
        props.push({ id: 'ergoflex-plant-2', at: [-6450, 0, front - 3800] });
    }
    if (!legacy && research) {
        // A bin beside the research table, clear of its light supports.
        props.push({ id: 'ergoflex-trash-can', at: [research[0] + 1300, 0, research[1] + 150], scale: .8 });
    }
    if (!legacy && service) props.push({ id: 'ergoflex-calendar', at: [service[0] + 250, 740, service[1] - 230], turn: -15 });
    return [id, { id, name, width, depth, height, back, index, desk, reading, stacks, lounge, carrels, research, service, props, sideTable, daylight: [-width / 2 + 100, back + depth * .4] }];
}
// The Humboldt-inspired commons is a bespoke sixth layout with its own builder and dayparts.
export const LIBRARY_LAYOUTS = Object.fromEntries([...sizes.map((s, i) => makeLibraryLayout(s, i)), makeHumboldtLayout()]);
const previousLayouts = Object.fromEntries(sizes.map((s, i) => makeLibraryLayout(s, i, true)));
export const libraryLayoutById = id => LIBRARY_LAYOUTS[id] || LIBRARY_LAYOUTS.apartment;
export const libraryLayoutForSize = size => LIBRARY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const LIBRARY_MODES = {
    morning: { label: 'Morning', description: 'Opening the reading room · daylight and book returns', key: '#ffe8c6', fill: '#d6e8f0', accent: '#c4dcc6', power: 1.55, ambient: .37, bounce: .6, exposure: 1.06, sky: ['#7fb3d1', '#f4e6c8'], practical: .2, wash: .16, colors: ['#f2e6d2', '#c5d3c7'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Reference research · catalog search and individual study', key: '#fff5e6', fill: '#dbe9ee', accent: '#b9d1c4', power: 1.3, ambient: .41, bounce: .66, exposure: 1.06, sky: ['#9cc6dc', '#eef0e4'], practical: .3, wash: .28, colors: ['#f5ebdb', '#cad7cd'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Evening reading · warm task lights and research notes', key: '#f3b07a', fill: '#b3bfd8', accent: '#e0b07c', power: .46, ambient: .24, bounce: .36, exposure: 1.04, sky: ['#5d76a0', '#f2a565'], practical: 1.15, wash: .45, colors: ['#f4d8b1', '#ccc5b6'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#4a3f30' },
    night: { label: 'Late study', description: 'Quiet late study · self service and focused task lighting', key: '#9db4d8', fill: '#93a8c8', accent: '#e8b77e', power: .14, ambient: .16, bounce: .22, exposure: 1.04, sky: ['#0f1f35', '#34506a'], practical: 1.3, wash: .12, colors: ['#f5ddbb', '#c0ccd3'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#2f2c26' },
    party: { label: 'Study group', description: 'Collaborative study · shared sources and discussion notes', key: '#f2dcc0', fill: '#c8dae2', accent: '#b8d4ae', power: .9, ambient: .34, bounce: .52, exposure: 1.04, sky: ['#93a9c8', '#f3cfa6'], practical: .75, wash: .85, colors: ['#f1e2ca', '#c5d3c7'], height: 43.5, tilt: -5, offset: [120, 250], yaw: -12, leds: true, color: '#375642' }
};
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
// Stable pseudo-random variation: a rebuilt room is identical every time.
const CHAIR_SCALE = .82;
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// Bakes many small parts into one geometry, so a shelf's dressing, a lamp's
// brass or a table's apron costs one draw call. Optional per-part colour is
// written as vertex colour for materials created with vertexColors.
function kit() {
    const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const api = {
        add(geometry, at, { rot = [0, 0, 0], scale = [1, 1, 1], color = null } = {}) {
            const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
            g.applyMatrix4(m.compose(p.set(...at), q.setFromEuler(e.set(...rot)), s.set(...scale)));
            parts.push({ g, color: color && new THREE.Color(color) }); return api;
        },
        box: (size, at, o) => api.add(new THREE.BoxGeometry(...size), at, o),
        cyl: (top, bottom, height, at, o = {}) => api.add(new THREE.CylinderGeometry(top, bottom, height, o.seg || 16, 1, !!o.open, o.start || 0, o.arc || Math.PI * 2), at, o),
        ball: (radius, at, o = {}) => api.add(new THREE.SphereGeometry(radius, o.seg || 14, o.rings || 9), at, o),
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
// Small library objects, all baked into a vertex-coloured dressing kit.
function vase(k, [x, y, z], color, tall = 1) {
    k.cyl(34, 46, 120 * tall, [x, y + 60 * tall, z], { color }); k.cyl(46, 30, 30, [x, y + 120 * tall + 15, z], { color }); k.cyl(18, 26, 34, [x, y + 120 * tall + 47, z], { color });
}
function pottedPlant(k, [x, y, z], seed, trail = 0, trailZ = z + 70) {
    k.cyl(56, 42, 100, [x, y + 50, z], { color: '#b26c4c' }); k.cyl(58, 58, 10, [x, y + 100, z], { color: '#9c5c40' });
    for (let i = 0; i < 6; i++) {
        const a = i * 1.1 + seed, r = 26 + rnd(seed + i) * 20;
        k.ball(36 + rnd(seed + i * 3) * 22, [x + Math.cos(a) * r, y + 140 + rnd(seed + i * 5) * 70, z + Math.sin(a) * r], { color: i % 2 ? '#4e7c4c' : '#3f6b42', scale: [1, .8, 1] });
    }
    // Trailing ivy spills over the shelf edge toward the aisle.
    for (let i = 0; i < trail; i++) k.ball(24, [x - 30 + i * 18, y + 60 - i * 70, trailZ + i * 6], { color: i % 2 ? '#56864f' : '#46743f', scale: [1, 2.1, .8] });
}
function standingFrame(k, [x, y, z], side, color) {
    k.box([150, 200, 14], [x, y + 98, z], { rot: [-.13 * side, 0, 0], color: '#3c2f25' });
    k.box([118, 160, 4], [x, y + 98, z + 7 * side], { rot: [-.13 * side, 0, 0], color });
}
function smallGlobe(k, [x, y, z], seed) {
    k.cyl(46, 56, 16, [x, y + 8, z], { color: '#6b4b30' }); k.cyl(5, 5, 50, [x, y + 40, z], { color: '#a68a52' });
    k.ball(70, [x, y + 140, z], { color: rnd(seed) > .5 ? '#56808a' : '#6e8a6a', rot: [.4, seed, 0], seg: 18, rings: 12 });
    k.add(new THREE.TorusGeometry(80, 4, 6, 24, Math.PI * 1.2), [x, y + 140, z], { rot: [0, 1.57, .4], color: '#a68a52' });
}
function bookend(k, [x, y, z], depth) {
    k.box([10, 150, depth * .55], [x, y + 75, z], { color: '#4a3a2c' }); k.box([90, 6, depth * .55], [x - 40, y + 3, z], { color: '#4a3a2c' });
}
// A turned plaster urn on a dark plinth, lathe-profiled.
function plasterUrn(k, [x, y, z]) {
    const profile = [[0, 0], [62, 0], [62, 24], [40, 34], [44, 52], [78, 120], [88, 175], [66, 228], [50, 246], [64, 262], [0, 262]].map(([r, v]) => new THREE.Vector2(r, v));
    k.box([190, 60, 170], [x, y + 30, z], { color: '#4c3a2c' }).add(new THREE.LatheGeometry(profile, 18), [x, y + 60, z], { color: '#e9e3d4' });
}
export function buildLibraryRoom(room, root, layout, helpers) {
    if (layout.humboldt) return buildHumboldtCommons(room, root, layout, helpers);
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index } = layout, front = bz + d;
    const modern = index >= 2, carpeted = modern;
    const previous = previousLayouts[layout.id];
    // The conference-chair upgrade retains the legacy editable root scale.
    // This fallback also keeps older offline catalogs usable.
    room.propReplacements = { 'kenney-furniture-chair-modern-cushion': { id: 'ergoflex-designer-chair', scale: CHAIR_SCALE } };
    room.migrateSavedTransform = (obj, saved) => {
        if (!saved) return saved;
        if ((obj.userData.conferenceChair || obj.userData.decorUpgrade === 'ergoflex-designer-chair') && saved.s && ['x', 'y', 'z'].every(a => Math.abs(saved.s[a] - 1) < .00001))
            saved = { ...saved, s: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z } };
        const id = obj.userData.propId, old = previous;
        let at, turn = 0;
        if (id?.startsWith('reading-table-')) at = old.reading[Number(id.split('-').at(-1))];
        else if (id?.startsWith('carrel-')) { at = old.carrels.find(c => c.id === id)?.at; turn = Math.PI / 2; }
        else if (id?.startsWith('stack-')) at = old.stacks.find(c => c.id === id)?.at;
        else if (id === 'lounge-side-table') at = old.sideTable;
        else if (id === 'digital-research-table') at = old.research;
        else if (id === 'research-help-counter') at = old.service;
        else if (id === 'collaboration-whiteboard') { at = [index === 1 ? -200 : -w / 2 + (index === 2 ? 2800 : 3450), front - (index === 1 ? 2600 : 2450)]; turn = -.14; }
        else if (id === 'reading-room-recycling') at = [-w / 2 + (index >= 2 ? 4300 : 3100), front - 330];
        else {
            const match = obj.userData.sceneAssetKey?.match(/:room:(\d+):/);
            const placement = match && old.props[Number(match[1])];
            if (placement && placement.id === id) { at = placement.at; turn = THREE.MathUtils.degToRad(placement.turn || 0); }
        }
        const poses = [];
        if (at) {
            let position = at.length === 2 ? [at[0], 0, at[1]] : at;
            if (id === 'research-help-counter' && Math.abs(saved.p.x - (-w / 2 + 2600)) < .01 && Math.abs(saved.p.z - (bz + 4400)) < .01) position = [-w / 2 + 2600, 0, bz + 4400];
            poses.push([position, turn]);
        }
        // Earlier revisions of the current plan: carrel chairs faced the room
        // and the study hall stacks had 990 mm aisles.
        const current = obj.userData.sceneAssetKey?.match(/:room:(\d+):/), placement = current && layout.props[Number(current[1])];
        if (id && placement?.id === id && placement.turn === -90) poses.push([placement.at, Math.PI / 2]);
        const stack = index === 3 && id?.match(/^stack-(\d+)-(\d+)$/);
        const range = index >= 3 && id?.match(/^stack-(\d+)-(\d+)$/);
        if (range) {
            const column = (index === 3 ? [-1000, 2000, 5000] : [-2000, 1100, 4200, 7300])[Number(range[1])], current = layout.stacks.find(s => s.id === id);
            if (column !== undefined) poses.push([[column, 0, current.at[1]], 0]);
            if (stack) poses.push([[column ?? current.at[0], 0, bz + [4800, 6350, 7900][Number(stack[2])]], 0]);
        }
        // Autosave captured untouched authored poses too. Upgrade those only;
        // any translated, rotated or scaled furnishing keeps the owner's edit.
        const untouched = ([position, angle]) => {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            return position.every((n, i) => Math.abs(saved.p[['x','y','z'][i]] - n) < .01)
                && ['x','y','z','w'].every(a => Math.abs(saved.q[a] - q[a]) <= .00001)
                && ['x','y','z'].every(a => Math.abs(saved.s[a] - obj.scale[a]) <= .00001);
        };
        if (!poses.some(untouched)) return saved;
        return { ...saved, ...roomLifeBaseTransform(obj, { p: { x: obj.position.x, y: obj.position.y, z: obj.position.z }, q: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w }, s: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z } }) };
    };
    room.decorateProp = (object, placement) => {
        if(object.userData.conferenceChair)return;
        const restyle = finish => { const copies = new Map(); object.traverse(o => { if (!o.isMesh) return; const swap = source => { if (!source?.isMeshStandardMaterial) return source; if (!copies.has(source)) { const mat = source.clone(); finish(mat, source); mat.userData.roomPaletteLocked = true; room.ownedMaterials.add(mat); copies.set(source, mat); } return copies.get(source); }; o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); }); };
        // Pastel book blocks take the shelf spine palette; the lounge table is oak.
        if (placement.id === 'kenney-furniture-books') { let n = 0; restyle(mat => { mat.color.set(['#55806a', '#bd9a58', '#6c8798', '#a65846'][n++ % 4]); mat.roughness = .82; mat.metalness = 0; }); return; }
        if (placement.id === 'coffee-table') { restyle(mat => { mat.map = oakMap; mat.color.set('#e3c9a0'); mat.roughness = .55; mat.metalness = 0; }); return; }
        if (placement.id !== 'kenney-furniture-chair-modern-cushion') return;
        const copies = new Map();
        object.traverse(o => {
            if (!o.isMesh) return;
            const finish = source => {
                if (!source?.isMeshStandardMaterial || source.map) return source;
                if (!copies.has(source)) {
                    const mat = source.clone(), fabric = /carpet|leather/i.test(source.name);
                    const table = layout.reading.findIndex(at => Math.abs(at[1] - placement.at[2]) <= 900 && Math.abs(at[0] - placement.at[0]) < 1000);
                    // Traditional rooms: green leather on dark bronze. Modern rooms:
                    // each table group keeps its own woven upholstery colour.
                    mat.color.set(fabric ? modern ? ['#718575', '#657f8b', '#ad7c62', '#859077'][Math.max(0, table) % 4] : '#3f5e4e' : modern ? '#364447' : '#3b362d');
                    mat.roughness = fabric ? modern ? .95 : .55 : .4; mat.metalness = fabric ? 0 : .6;
                    mat.userData.roomPaletteLocked = true;
                    room.ownedMaterials.add(mat); copies.set(source, mat);
                }
                return copies.get(source);
            };
            o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
        });
    };
    const plasterMap = canvasMap((c, S) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S);
        // Each blob is drawn at its wrap offsets so the texture tiles seamlessly.
        for (let n = 0; n < 140; n++) {
            const x0 = rnd(n * 3.3) * S, y0 = rnd(n * 7.7) * S, r = 60 + rnd(n * 1.9) * 120;
            for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const x = x0 + ox, y = y0 + oy, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, n % 2 ? '#00000003' : '#ffffff05'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
        }
    });
    plasterMap.wrapS = plasterMap.wrapT = THREE.RepeatWrapping;
    // Only the two long wall faces carry the mottled plaster; their UVs span
    // the whole wall, so each gets a repeat matching its own length.
    const plaster = length => { const map = plasterMap.clone(); map.repeat.set(length / 4000, h / 4000); const mat = material(modern ? '#ecebe2' : '#e8e2d2', { roughness: .94, map }); mat.userData.roomSurface = 'plaster'; return mat; };
    const chalk = material(modern ? '#ecebe2' : '#e8e2d2', { roughness: .94 }), green = material(['#436c58', '#436c58', '#596f65', '#506b70', '#596b62'][index], { roughness: .86 }), dark = material(modern ? '#354548' : '#344941'), brass = material(modern ? '#b5bbba' : '#b5a06b', { metalness: .72, roughness: .4 });
    const trim = material('#f1ecdf', { roughness: .8 }), dress = material('#ffffff', { vertexColors: true, roughness: .78 });
    const oakMap = canvasMap(c => { c.fillStyle = modern ? '#c1ad8b' : '#ac8960'; c.fillRect(0, 0, 512, 512); for (let x = 0; x < 512; x += 5) { c.strokeStyle = x % 3 ? '#684a2b25' : '#e2c48b35'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 8, 150, x - 12, 350, x + 2, 512); c.stroke(); } });
    const oak = material('#ffffff', { map: oakMap, roughness: .7 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `library:${layout.id}:fixture:${id}` }); };
    const group = (id, name, at = [0, 0, 0], parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g); register(g, id, name); return g; };
    const baked = (parent, k, mat, shadow = true) => { const obj = mesh(parent, k.build(), mat); obj.castShadow = shadow; return obj; };
    // Honey-oak herringbone. Plank colour follows the pattern's lattice, so
    // the 1024 px tile repeats seamlessly every 680 mm.
    const floorMap = canvasMap((c, S) => {
        if (carpeted) {
            for (let col = 0; col < 2; col++) for (let row = 0; row < 2; row++) {
                const x = col * S / 2, y = row * S / 2;
                c.fillStyle = index === 3 ? '#75838a' : '#86907e'; c.fillRect(x, y, S / 2, S / 2);
                c.strokeStyle = '#40504408'; c.lineWidth = 1;
                for (let n = 0; n < S / 2; n += 4) { c.beginPath(); c.moveTo(x + (row ? n : 0), y + (row ? 0 : n)); c.lineTo(x + (row ? n : S / 2), y + (row ? S / 2 : n)); c.stroke(); }
                c.strokeStyle = '#4553460a'; c.lineWidth = 3; c.strokeRect(x, y, S / 2, S / 2);
            }
            for (let n = 0; n < 18000; n++) { c.fillStyle = n % 2 ? '#ffffff15' : '#34483c12'; c.fillRect(rnd(n) * S, rnd(n + 13) * S, 2, 4); }
            return;
        }
        const W = S / 8, L = W * 4, tones = ['#b58c60', '#a87f55', '#bd966a', '#a07a51', '#b88f63', '#ad865b', '#c39c6e', '#a57d54'];
        c.fillStyle = '#7d5f40'; c.fillRect(0, 0, S, S);
        for (let k = -10; k <= 18; k++) for (let n = -3; n <= 3; n++) for (const tall of [0, 1]) {
            const x = k * W + n * L, y = k * W - n * L + tall * W, pw = tall ? W : L, ph = tall ? L : W;
            if (x > S || y > S || x + pw < 0 || y + ph < 0) continue;
            const id = ((k - 4 * n) % 8 + 8) % 8 + tall * 8;
            c.save(); c.beginPath(); c.rect(x + 1.5, y + 1.5, pw - 3, ph - 3); c.clip();
            const g = tall ? c.createLinearGradient(x, y, x + pw, y) : c.createLinearGradient(x, y, x, y + ph);
            g.addColorStop(0, tones[id % 8]); g.addColorStop(1, tones[(id + 3) % 8]); c.fillStyle = g; c.fillRect(x, y, pw, ph);
            for (let i = 0; i < 11; i++) {
                const t = (i + .5) / 11 + (rnd(id * 7 + i) - .5) * .05, wave = 4 + rnd(id + i) * 6;
                c.strokeStyle = i % 3 ? '#5c3d2124' : '#f0d2a226'; c.lineWidth = .8 + rnd(id * 13 + i) * 1.6; c.beginPath();
                if (tall) { c.moveTo(x + t * pw, y); c.bezierCurveTo(x + t * pw + wave, y + ph * .3, x + t * pw - wave, y + ph * .7, x + t * pw, y + ph); }
                else { c.moveTo(x, y + t * ph); c.bezierCurveTo(x + pw * .3, y + t * ph + wave, x + pw * .7, y + t * ph - wave, x + pw, y + t * ph); }
                c.stroke();
            }
            c.restore();
        }
    }, 1024, 1024);
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / (carpeted ? 1200 : 680), d / (carpeted ? 1200 : 680)); floorMap.anisotropy = 8;
    const floor = material('#ffffff', { map: floorMap, roughness: carpeted ? .98 : .62 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    // Wool rugs: woven border bands and a quiet field pattern.
    const rug = (field, band, line, motif) => material('#ffffff', { roughness: 1, map: canvasMap((c, S) => {
        c.fillStyle = field; c.fillRect(0, 0, S, S);
        for (let i = 0; i < 2600; i++) { c.fillStyle = rnd(i) > .5 ? '#ffffff0d' : '#0000000d'; c.fillRect(rnd(i * 3) * S, rnd(i * 5) * S, 2, 2); }
        c.strokeStyle = motif; c.lineWidth = 3;
        for (let x = 64; x < S - 40; x += 64) for (let y = 64; y < S - 40; y += 64) { c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 18, y); c.lineTo(x, y + 18); c.lineTo(x - 18, y); c.closePath(); c.stroke(); }
        c.strokeStyle = band; c.lineWidth = 34; c.strokeRect(17, 17, S - 34, S - 34);
        c.strokeStyle = line; c.lineWidth = 5; c.strokeRect(44, 44, S - 88, S - 88); c.lineWidth = 3; c.strokeRect(9, 9, S - 18, S - 18);
    }) });
    const floorRug = (id, size, at, mat, radius) => { const o = box(root, size, at, mat, radius); o.userData.libraryRug = id; return o; };
    floorRug('desk', [1900, 4, 2300], [layout.desk[0], 2, layout.desk[1] + 450], rug('#c7cbb5', '#6f8a74', '#efe8d2', '#b4bba2'), 8);
    const back = new THREE.Group(); back.name = 'Library commons wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], plaster(w)); box(back, [w, 100, 25], [0, 50, bz + 12.5], oak);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = 'Library study wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], plaster(d)); box(right, [25, 100, d], [w / 2 - 12.5, 50, bz + d / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    // Painted panelled wainscot to sill height, an oak chair rail and a
    // plaster cornice: the reading-room shell around the stacks.
    const low = 820, panelMap = canvasMap((c, W, H) => {
        if (modern) {
            c.drawImage(oakMap.image, 0, 0, W, H);
            for (let x = 0; x < W; x += 24) { c.fillStyle = '#4d3b272d'; c.fillRect(x, 0, 3, H); c.fillStyle = '#ffffff20'; c.fillRect(x + 3, 0, 2, H); }
            return;
        }
        c.fillStyle = '#486a59'; c.fillRect(0, 0, W, H);
        for (const x0 of [16, W / 2 + 16]) {
            const pw = W / 2 - 32, top = 26, ph = H - 60;
            c.fillStyle = '#3d5d4d'; c.fillRect(x0, top, pw, ph); c.fillStyle = '#4c6f5e'; c.fillRect(x0 + 14, top + 14, pw - 28, ph - 28);
            c.strokeStyle = '#6c8d7b'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, top + ph); c.lineTo(x0, top); c.lineTo(x0 + pw, top); c.stroke();
            c.strokeStyle = '#2c4639'; c.beginPath(); c.moveTo(x0 + pw, top); c.lineTo(x0 + pw, top + ph); c.lineTo(x0, top + ph); c.stroke();
        }
    }, 512, 256);
    const wainscot = length => { const map = panelMap.clone(); map.wrapS = THREE.RepeatWrapping; map.repeat.set(length / 1300, 1); return material('#ffffff', { map, roughness: .72 }); };
    box(back, [w, low, 18], [0, low / 2, bz + 9], wainscot(w)); box(right, [18, low, d], [w / 2 - 9, low / 2, bz + d / 2], wainscot(d));
    const rails = kit(); rails.box([w, 40, 34], [0, low, bz + 17]); baked(back, rails, oak, false);
    rails.box([34, 40, d], [w / 2 - 17, low, bz + d / 2]); baked(right, rails, oak, false);
    if (index >= 3) {
        const frieze = kit(); frieze.box([w, 60, 6], [0, 2410, bz + 3]); baked(back, frieze, green, false); frieze.box([6, 60, d], [w / 2 - 3, 2410, bz + d / 2]); baked(right, frieze, green, false);
        const picture = kit(); picture.box([w, 24, 28], [0, 2452, bz + 14]); baked(back, picture, oak, false); picture.box([28, 24, d], [w / 2 - 14, 2452, bz + d / 2]); baked(right, picture, oak, false);
    }
    const cornice = kit(); cornice.box([w, 70, 60], [0, h - 35, bz + 30]).box([w, 30, 90], [0, h - 85, bz + 45]); baked(back, cornice, trim, false);
    cornice.box([60, 70, d], [w / 2 - 30, h - 35, bz + d / 2]).box([90, 30, d], [w / 2 - 45, h - 85, bz + d / 2]); baked(right, cornice, trim, false);
    const sign = group('commons-sign', 'Library commons identity', [0, 2560 + (h - 3000) * .5, bz + 35], back);
    const signMap = canvasMap(c => { c.fillStyle = '#31574b'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#d7b566'; c.fillRect(0, 0, 12, 256); c.fillStyle = '#efe8d2'; c.font = 'bold 66px sans-serif'; c.fillText('HUMBOLDT / LIBRARY', 38, 114); c.font = '25px sans-serif'; c.fillText(['A QUIET PLACE TO BEGIN', 'READING ROOM · WINDOW STUDY', 'LEARNING COMMONS · RESEARCH & IDEAS', 'STUDY HALL · COLLECTIONS & COLLABORATION', 'SCHOLARS COMMONS · DISCOVER & CREATE'][index], 40, 190); }, 1024, 256);
    box(sign, [index ? 3100 : 2600, 500, 30], [0, 0, 0], material('#ffffff', { map: signMap }), 7);
    const window = new THREE.Group(); window.name = 'Library daylight and campus view'; root.add(window);
    const ww = Math.min(6500, d * .6), wz = bz + d * .4, wh = Math.min(2400, h - 1100), a = wz - ww / 2, b = wz + ww / 2;
    for (const [length, z] of [[a - bz, (a + bz) / 2], [front - b, (front + b) / 2]]) box(window, [80, h, length], [-w / 2 - 40, h / 2, z], chalk);
    box(window, [80, low, ww], [-w / 2 - 40, low / 2, wz], chalk); box(window, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], chalk);
    const skyMap = canvasMap(() => {}, 2048, Math.round(2048 * wh / ww)), sky = skyMap.image;
    const campusImage = new Image(); let windowMode = 'morning';
    const drawWindow = modeId => {
        const c = sky.getContext('2d'), mode = LIBRARY_MODES[modeId] || LIBRARY_MODES.morning;
        if (campusImage.naturalWidth) drawCampusImage(c, campusImage, modeId);
        else { c.save(); c.scale(sky.width / 1024, sky.height / 512); drawCampus(c, modeId, mode); c.restore(); }
        skyMap.needsUpdate = true;
        root.userData.libraryWindow = { source: campusImage.naturalWidth ? 'assets/rooms/library/campus-window.png' : 'procedural-fallback', mode: modeId, croppedCurtains: true };
    };
    room.windowViewReady = new Promise(resolve => {
        campusImage.onload = () => { if (room.root === root) drawWindow(windowMode); resolve(); };
        campusImage.onerror = () => resolve(); // Keep the existing campus fallback if the asset is unavailable.
        campusImage.src = new URL('./assets/rooms/library/campus-window.png', import.meta.url).href;
    });
    const pane = mesh(window, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    const frame = kit();
    // The supplied picture includes its glazing bars. Keep only the physical
    // perimeter so a second, differently spaced grid does not cross the view.
    for (const z of [a, b]) frame.box([60, wh + 35, 32], [-w / 2 + 16, low + wh / 2, z]);
    for (const y of [low, low + wh]) frame.box([60, 35, ww + 40], [-w / 2 + 16, y, wz]);
    baked(window, frame, dark);
    const sill = kit(); sill.box([160, 30, ww + 70], [-w / 2 + 40, low - 15, wz]).box([25, 100, d], [-w / 2 + 12.5, 50, bz + d / 2]).box([34, 40, a - bz], [-w / 2 + 17, low, (a + bz) / 2]).box([34, 40, front - b], [-w / 2 + 17, low, (front + b) / 2]);
    baked(window, sill, oak);
    box(window, [18, low - 30, d], [-w / 2 + 9, (low - 30) / 2, bz + d / 2], wainscot(d));
    const windowTrim = kit(); windowTrim.box([60, 70, d], [-w / 2 + 30, h - 35, bz + d / 2]).box([90, 30, d], [-w / 2 + 45, h - 85, bz + d / 2]); baked(window, windowTrim, trim, false);
    // Linen drapes on a brass rod frame the daylight without covering it.
    const drapeGeo = (width, height) => { const g = new THREE.PlaneGeometry(width, height, 18, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / width * Math.PI * 9) * 20); g.computeVertexNormals(); return g; };
    const linen = material('#e6dcc6', { roughness: 1, side: THREE.DoubleSide }), drapeTop = Math.min(h - 140, low + wh + 220);
    for (const z of [a - 140, b + 140]) { const drape = mesh(window, drapeGeo(460, drapeTop - 30), linen, [-w / 2 + 68, (drapeTop + 30) / 2, z]); drape.rotation.y = Math.PI / 2; drape.castShadow = false; }
    const rail = kit(); rail.cyl(11, 11, ww + 900, [-w / 2 + 75, drapeTop + 20, wz], { rot: [Math.PI / 2, 0, 0] });
    for (const z of [a - 420, b + 420]) rail.ball(24, [-w / 2 + 75, drapeTop + 20, z]).box([75, 14, 14], [-w / 2 + 37, drapeTop + 20, z]);
    baked(window, rail, brass, false);
    room.walls.push({ obj: window, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    // Books: four colour batches per shelf would read as a pattern, so spines
    // get printed head/tail bands and each instance gets its own tint.
    const spine = style => canvasMap((c, W, H) => {
        const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#b0b0b0'); g.addColorStop(.25, '#e4e4e4'); g.addColorStop(.7, '#d6d6d6'); g.addColorStop(1, '#a6a6a6');
        c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = '#fff4d0';
        const bands = [[18, 30, H - 34, H - 22], [24, H - 28], [12, 20, 92, 100, H - 26], [30, 60, H - 60, H - 30], [16, H - 20], [40, H - 44]][style];
        for (const y of bands) c.fillRect(0, y, W, style === 4 ? 7 : 4);
        const label = [[56, 46], null, [38, 40], [96, 60], [70, 26], [150, 54]][style];
        if (label) { c.fillStyle = style === 5 ? '#f3ead2' : '#4e4e4e'; c.fillRect(8, label[0], W - 16, label[1]); c.fillStyle = style === 5 ? '#6a6a6a' : '#f2e6c4'; c.fillRect(14, label[0] + 10, W - 28, 4); c.fillRect(14, label[0] + 22, W - 34, 3); }
        else { c.fillStyle = '#f2e6c4'; for (let i = 0; i < 5; i++) c.fillRect(W / 2 - 3, 70 + i * 16, 6, 9); }
    }, 64, 256);
    const bookMats = ['#55806a', '#bd9a58', '#6c8798', '#a65846', '#ddcb9e', '#45505e'].map((color, i) => material(color, { map: spine(i), roughness: .82 }));
    const bookGeo = new THREE.BoxGeometry(1, 1, 1), temp = new THREE.Object3D(), tint = new THREE.Color();
    const levels = [320, 710, 1100, 1490], frames = {};
    const shelfFrame = double => {
        if (frames[double]) return frames[double];
        const dep = double ? 560 : 500, k = kit();
        for (const x of [-875, 875]) k.box([50, 1950, dep], [x, 975, 0]);
        k.box([1750, 80, dep - 60], [0, 40, double ? 0 : -30]).box([1860, 50, dep + 40], [0, 1975, double ? 0 : 20]).box([1800, 26, dep + 16], [0, 1937, double ? 0 : 8]);
        for (const y of [...levels, 1880]) k.box([1750, 22, dep], [0, y - 11, 0]);
        k.box([24, 1800, dep - 8], [0, 980, 0]);
        return frames[double] = k.build();
    };
    const rearStacks = layout.stacks.filter(s => !s.double), ladderStack = rearStacks[rearStacks.length - 1];
    for (const [si, spec] of layout.stacks.entries()) {
        const shelf = group(spec.id, spec.double ? 'Double-sided library book stack' : 'Library wall bookshelf', [spec.at[0], 0, spec.at[1]]);
        shelf.userData.libraryStack = { double: spec.double, width: 1800, depth: 560, height: 2000 };
        const dep = spec.double ? 560 : 500, sides = spec.double ? [-1, 1] : [1], bookDepth = spec.double ? 240 : 270;
        mesh(shelf, shelfFrame(spec.double), oak);
        const joined = side => layout.stacks.some(o => o !== spec && o.double && Math.abs(o.at[1] - spec.at[1]) < 1 && Math.abs(o.at[0] - spec.at[0] - side * 1860) < 5);
        shelf.userData.libraryStack.joined = [joined(-1), joined(1)];
        if (spec.double) for (const x of [-915, 915]) { if (joined(Math.sign(x))) continue; box(shelf, [30, 1950, 560], [x, 975, 0], oak); box(shelf, [4, 1500, 420], [x * 1.0175, 1050, 0], green); }
        box(shelf, [1750, 1920, 18], [0, 1000, spec.double ? 0 : -dep / 2 + 9], green);
        const matrices = bookMats.map(() => []), tints = bookMats.map(() => []), k = kit();
        const put = (seed, at, size, rot = [0, 0, 0], own = seed) => {
            const mi = Math.floor(rnd(seed) * bookMats.length);
            temp.position.set(...at); temp.rotation.set(...rot); temp.scale.set(...size); temp.updateMatrix();
            matrices[mi].push(temp.matrix.clone()); tints[mi].push(.74 + rnd(seed * 1.7) * .34 + (rnd(own * 2.3) - .5) * .12);
        };
        for (const [li, y0] of levels.entries()) for (const bay of [0, 1]) for (const side of sides) {
            const seed = si * 977 + li * 131 + bay * 17 + (side > 0 ? 5 : 0), roll = rnd(seed);
            const feature = spec.double ? roll < .14 ? 'stack' : roll < .24 ? 'lean' : 'full' : roll < .26 ? 'stack' : roll < .5 ? 'decor' : roll < .68 ? 'lean' : 'full';
            const x0 = bay ? 14 : -848, x1 = bay ? 848 : -14, limit = x1 - (feature === 'stack' ? 290 : feature === 'decor' ? 210 : feature === 'lean' ? 130 : 4);
            const z = side * (spec.double ? dep / 2 - 14 - bookDepth / 2 : dep / 2 - 18 - bookDepth / 2), run = 2 + Math.floor(rnd(seed + 2) * 3);
            let x = x0 + 3, n = 0, tallest = 0;
            // Runs of a series share colour and height, as real collections do.
            while (true) {
                const series = seed * 31 + Math.floor(n / run), bw = 26 + rnd(seed + n * 3.1) * 30, bh = Math.min(345, 205 + rnd(series * 1.3) * 90 + rnd(seed + n) * 40);
                if (x + bw > limit) break;
                put(series, [x + bw / 2, y0 + bh / 2, z - side * rnd(seed + n * 9) * 10], [bw, bh, bookDepth - rnd(series) * 40], [0, 0, 0], seed * 53 + n);
                x += bw + (rnd(seed + n * 5) < .1 ? 3 : .6); n++; tallest = Math.max(tallest, bh);
            }
            if (feature === 'lean') {
                const t = .16 + rnd(seed + 4) * .14, bw = 34, bh = 250 + rnd(seed + 6) * 50, xl = x + bh * Math.sin(t) + 2;
                put(seed + 99, [xl + bw / 2 * Math.cos(t) - bh / 2 * Math.sin(t), y0 + bw / 2 * Math.sin(t) + bh / 2 * Math.cos(t), z], [bw, bh, bookDepth - 20], [0, 0, t]);
            } else if (feature === 'stack') {
                let y = y0;
                for (let i = 0; i < 2 + Math.floor(rnd(seed + 7) * 3); i++) { const t = 30 + rnd(seed + i) * 22; put(seed + i * 11, [x1 - 150, y + t / 2, z], [235 - i * 12, t, bookDepth - 30 - i * 10], [0, (rnd(seed + i * 2) - .5) * .14, 0]); y += t; }
                if (rnd(seed + 8) > .5) bookend(k, [x + 8, y0, z], bookDepth);
            } else if (feature === 'decor') {
                const cx = x1 - 105, pick = Math.floor(rnd(seed + 3) * 5), at = [cx, y0, z];
                if (pick === 0) vase(k, at, ['#d9cfb8', '#4f7f78', '#b36a4f', '#2f4a5c'][si % 4]);
                else if (pick === 1) pottedPlant(k, at, seed, li === 3 ? 3 : 0, side * (dep / 2 + 24));
                else if (pick === 2) standingFrame(k, [cx, y0, z - side * 40], side, ['#c9b48b', '#7e9c8e', '#c68f6e'][si % 3]);
                else if (pick === 3 && li < 3) smallGlobe(k, at, seed);
                else bookend(k, [x + 8, y0, z], bookDepth);
            }
        }
        // Bottom cubbies hold archive boxes and oversized folios.
        for (const side of sides) for (const bay of [0, 1]) {
            const cx = bay ? 430 : -430, z = side * (spec.double ? dep / 4 : 30);
            if (rnd(si * 3 + bay + side) > .45) for (let i = 0; i < 2; i++) { k.box([330, 205, spec.double ? 230 : 380], [cx - 175 + i * 350, 80 + 103, z], { color: '#b1916a' }); k.box([110, 50, 2], [cx - 175 + i * 350, 80 + 150, z + side * ((spec.double ? 115 : 190) + 1)], { color: '#efe7d4' }); }
            else for (let i = 0; i < 4; i++) k.box([520 - i * 30, 34, spec.double ? 220 : 340], [cx + (rnd(i + si) - .5) * 40, 80 + 17 + i * 35, z], { color: ['#3f5a4c', '#7a4a3c', '#2f3f52', '#8c7a55'][(i + si) % 4], rot: [0, (rnd(i * 3 + si) - .5) * .12, 0] });
        }
        if (!spec.double) {
            // Wall stacks carry a few objects on the cornice, clear of the sign.
            const top = 2000, rs = rearStacks.indexOf(spec);
            if (rs % 2 === 0) plasterUrn(k, [-620, top, 20]); else smallGlobe(k, [-620, top, 20], si);
            pottedPlant(k, [640, top, 40], si * 5, 0, dep / 2 + 60);
            for (let i = 0; i < 3; i++) k.box([360 - i * 26, 42, 270 - i * 14], [-120 + rnd(si + i) * 30, top + 21 + i * 42, 30], { color: ['#5a3f33', '#2f4a40', '#8a6a44'][i], rot: [0, (rnd(i + si * 7) - .5) * .2, 0] });
        }
        if (spec === ladderStack) {
            // The ladder is a separate movable floor fixture. Baking its deep
            // feet into the entire bookcase made the empty space in front of
            // every shelf bay appear occupied to the wider desk's route.
            const zf = dep / 2, foot = 420, top = 1870;
            k.cyl(12, 12, 1760, [0, top, zf + 45], { rot: [0, 0, Math.PI / 2], color: '#b9a46c' });
            for (const x of [-820, 0, 820]) k.box([24, 24, 50], [x, top, zf + 22], { color: '#b9a46c' });
            const ladder = group('rolling-stack-ladder', 'Rolling library stack ladder', [spec.at[0], 0, spec.at[1]]), ladderKit = kit();
            const tilt = Math.atan2(foot - 45, top), len = Math.hypot(foot - 45, top);
            for (const x of [330, 690]) {
                ladderKit.box([34, len - 90, 62], [x, top / 2, zf + 45 + (foot - 45) / 2], { rot: [-tilt, 0, 0], color: '#8c6a47' });
                ladderKit.cyl(28, 28, 22, [x, 28, zf + foot], { rot: [0, 0, Math.PI / 2], color: '#2f2a26' });
            }
            for (let i = 1; i <= 7; i++) { const t = i / 8; ladderKit.box([360, 26, 90], [510, top * t, zf + foot - (foot - 45) * t], { color: '#9a774f' }); }
            baked(ladder, ladderKit, dress);
        }
        const dressing = baked(shelf, k, dress); dressing.name = 'Shelf dressing';
        matrices.forEach((items, i) => {
            const books = new THREE.InstancedMesh(bookGeo, bookMats[i], items.length);
            items.forEach((m, j) => { books.setMatrixAt(j, m); books.setColorAt(j, tint.setScalar(tints[i][j])); });
            books.castShadow = books.receiveShadow = true; books.computeBoundingBox(); shelf.add(books);
        });
        const labelMap = canvasMap(c => { c.fillStyle = '#2f4c3f'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#c9b27a'; c.lineWidth = 4; c.strokeRect(8, 8, 496, 112); c.fillStyle = '#ece4cc'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText(['ART / DESIGN', 'SCIENCE / NATURE', 'LITERATURE', 'HISTORY / CULTURE', 'TECHNOLOGY', 'REFERENCE'][si % 6], 256, 78); }, 512, 128);
        const label = material('#ffffff', { map: labelMap }); for (const side of sides) box(shelf, [900, 76, 12], [0, 1885, side * (dep / 2 + 8)], label);
    }
    // Shared reading tables: green leather writing pads let into the oak top,
    // and a pair of banker's lamps on the power rail.
    const shades = [], glow = [];
    // Visible lamp light: additive pools whose strength follows the mode's
    // practical level (the same term that drives the task point lights).
    const pools = createPoolLayer(root, 'Library lamp light pools');
    let poolMode = LIBRARY_MODES.morning, poolAccent = 1;
    const lampLevel = (k = 1, quiet = 1) => i => Math.min(.55, poolMode.practical * .38 * poolAccent) * k * (i === 3 ? quiet : 1);
    const WARM = modern ? '#ffe2bd' : '#ffd29c';
    const shadeMat = () => { const mat = material('#24583d', { emissive: '#2f7a50', emissiveIntensity: .1, roughness: .18, metalness: .15, side: THREE.DoubleSide }); shades.push(mat); return mat; };
    const glowMat = (extra = {}) => { const mat = material('#f2d6a8', { emissive: '#f2d6a8', emissiveIntensity: .3, ...extra }); glow.push(mat); return mat; };
    const bankers = (parent, at, brassKit, glassKit, glowKit) => {
        const [x, y, z] = at;
        if (modern) {
            brassKit.box([180, 10, 110], [x, y + 5, z]).cyl(8, 8, 265, [x, y + 142, z]);
            glassKit.box([370, 32, 70], [x, y + 287, z]);
            glowKit.box([350, 3, 54], [x, y + 270, z]);
            return;
        }
        brassKit.cyl(58, 66, 18, [x, y + 9, z]).cyl(7, 7, 250, [x, y + 140, z]).box([260, 10, 10], [x, y + 262, z]).cyl(10, 10, 40, [x - 105, y + 250, z]).cyl(10, 10, 40, [x + 105, y + 250, z]);
        brassKit.cyl(4, 4, 90, [x + 60, y + 190, z + 40]);
        glassKit.cyl(72, 72, 300, [x, y + 268, z], { open: true, arc: Math.PI, rot: [0, 0, Math.PI / 2], seg: 18 });
        for (const end of [-1, 1]) glassKit.cyl(72, 72, 4, [x + end * 150, y + 268, z], { arc: Math.PI, rot: [0, 0, Math.PI / 2], seg: 18 });
        glowKit.box([280, 3, 120], [x, y + 270, z]);
    };
    // Polygon offset keeps the inset pads clean on the tabletop at any zoom.
    const leather = material('#ffffff', { roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: canvasMap((c, W, H) => {
        c.fillStyle = '#2f5a45'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 1400; i++) { c.fillStyle = rnd(i) > .5 ? '#ffffff0b' : '#00000012'; c.fillRect(rnd(i * 3) * W, rnd(i * 7) * H, 3, 3); }
        c.strokeStyle = '#c8ad6c'; c.lineWidth = 3; c.strokeRect(14, 12, W - 28, H - 24); c.lineWidth = 1; c.strokeRect(22, 19, W - 44, H - 38);
    }, 512, 128) });
    for (const [i, at] of layout.reading.entries()) {
        const table = group(`reading-table-${i}`, 'Shared student study table', [at[0], 0, at[1]]), length = index ? 2400 : 1800;
        table.userData.roomSupportHeights = [740];
        box(table, [length, 40, 950], [0, 720, 0], oak, 12);
        const pads = kit(); for (const z of [-260, 260]) pads.add(new THREE.PlaneGeometry(length - 260, 330), [0, 740.4, z], { rot: [-Math.PI / 2, 0, 0] });
        baked(table, pads, leather, false);
        const apron = kit(); apron.box([length - 200, 70, 24], [0, 665, 360]).box([length - 200, 70, 24], [0, 665, -360]);
        baked(table, apron, oak);
        const legs = kit(), feet = kit(), rail = kit();
        for (const x of [-length / 2 + 220, length / 2 - 220]) {
            for (const z of [-250, 250]) { legs.box([70, 690, 70], [x, 355, z]); feet.box([90, 30, 90], [x, 15, z]); }
            legs.box([40, 60, 500], [x, 120, 0]);
        }
        rail.box([length - 260, 90, 80], [0, 785, 0]); baked(table, legs, oak); baked(table, feet, brass); baked(table, rail, dark);
        const outlets = kit(), plates = kit();
        for (const x of [-120, 120]) { outlets.box([200, 5, 80], [x, 832.5, 0]); for (const dx of [-40, 40]) plates.box([10, 2, 22], [x + dx, 836, 0]); }
        baked(table, outlets, dark, false); baked(table, plates, material('#c4c7b7'), false);
        const lampBrass = kit(), glass = kit(), light = kit();
        for (const x of [-length / 2 + 330, length / 2 - 330]) { bankers(table, [x, 830, 0], lampBrass, glass, light); pools.add(table, [x, 742, 0], [1050, 800], WARM, lampLevel(1, i ? .28 : 1)); }
        baked(table, lampBrass, brass); baked(table, glass, modern ? dark : shadeMat());
        const diffuser = glowMat(); diffuser.userData.libraryTable = i; baked(table, light, diffuser, false);
        table.userData.libraryZone = 'collaborative';
        const items = kit();
        // A returned-book pile, pencil cup and reading glasses at the table ends.
        for (let n = 0; n < 3; n++) items.box([230 - n * 14, 34, 160 - n * 8], [-length / 2 + 210, 740 + 17 + n * 34, 300], { color: ['#7a4a3c', '#3f5a4c', '#c0a466'][n], rot: [0, .15 * n - .1, 0] });
        items.cyl(32, 30, 95, [length / 2 - 190, 787.5, -300], { color: '#6a8a7d' });
        for (let n = 0; n < 4; n++) items.cyl(4, 4, 160, [length / 2 - 190 + (n % 2 - .5) * 22, 860, -300 + (n > 1 ? 12 : -12)], { color: ['#d9b440', '#2f4a40', '#b5705a', '#d9b440'][n], rot: [(n - 1.5) * .12, 0, (n % 2 - .5) * .2] });
        baked(table, items, dress);
    }
    for (const carrel of layout.carrels) {
        const g = group(carrel.id, 'Quiet window study carrel', [carrel.at[0], 0, carrel.at[1]]); g.rotation.y = Math.PI / 2;
        g.userData.libraryZone = 'quiet'; g.userData.editableRoomItem = true; g.userData.roomSupportHeights = [740];
        box(g, [1200, 35, 650], [0, 722.5, 0], oak, 8);
        for (const x of [-575, 575]) { box(g, [25, 1250, 650], [x, 625, 0], oak, 4); box(g, [6, 1250, 8], [x, 625, 326], brass); }
        box(g, [1100, 400, 22], [0, 950, -315], material('#a3ac98', { roughness: 1 }), 4);
        const k = kit();
        for (let n = 0, x = -530; n < 7; n++) { const bw = 30 + rnd(n + carrel.at[1]) * 22, bh = 200 + rnd(n * 3) * 45; k.box([bw, bh, 170], [x + bw / 2, 740 + bh / 2, -210], { color: ['#5e8670', '#c0a466', '#7690a0', '#b5705a', '#59656f'][n % 5] }); x += bw + 1; }
        for (let n = 0; n < 4; n++) k.box([150, 110, 2], [-120 + n * 170, 960 + (n % 2) * 60, -303], { color: ['#f2e6a0', '#f4f1e8', '#cfe3d6', '#f0c9b8'][n], rot: [0, 0, (rnd(n) - .5) * .2] });
        baked(g, k, dress); const strip = kit(); strip.box([1000, 6, 40], [0, 1144, -285]); baked(g, strip, glowMat(), false);
        pools.add(g, [0, 742, -100], [1050, 480], WARM, lampLevel(.9)); pools.add(g, [0, 1000, -306], [1000, 420], WARM, lampLevel(.45), 'back');
        const power = kit(); power.box([110, 45, 4], [430, 802, -302], { color: '#364447' });
        for (const dx of [-24, 24]) for (const dz of [-7, 7]) power.box([4, 9, 2], [430 + dx + dz / 3, 802, -299], { color: '#d2d6ce' });
        power.box([18, 6, 2], [430, 818, -299], { color: '#d2d6ce' }); baked(g, power, dress, false);
    }
    if (index) floorRug('lounge', [2700, 4, 1900], [layout.lounge[0], 2, layout.lounge[1] - 400], rug('#8c4d3e', '#e3d6b4', '#2f4a40', '#a8604d'), 12);
    // A deep-green reading rug grounds the study tables.
    for (const [i, at] of layout.reading.entries()) {
        const rw = index ? 3200 : 2700, rd = index ? 2700 : 2500, x0 = Math.max(-w / 2 + 120, at[0] - rw / 2), x1 = Math.min(w / 2 - 120, at[0] + rw / 2);
        floorRug('reading-' + i, [x1 - x0, 5, rd], [(x0 + x1) / 2, 2.5, at[1]], rug('#3f5e4e', '#d8c9a0', '#9a6a45', '#4c6c5b'), 12);
    }
    const pilot = group('pilot-information', 'ErgoFlex student pilot information', [layout.desk[0], 6, layout.desk[1] + 1800]);
    const pilotMap = canvasMap(c => { c.fillStyle = '#304f45'; c.fillRect(0, 0, 1024, 256); c.strokeStyle = '#c9b27a'; c.lineWidth = 6; c.strokeRect(12, 12, 1000, 232); c.fillStyle = '#eee7d0'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.fillText('ERGOFLEX / STUDENT PILOT', 512, 100); c.font = '28px sans-serif'; c.fillText('Choose your height • Find your angle • Make yourself at work', 512, 170); }, 1024, 256);
    const plaque = mesh(pilot, new THREE.PlaneGeometry(1500, 280), material('#ffffff', { map: pilotMap, roughness: 1 }), [0, 0, 0]); plaque.rotation.x = -Math.PI / 2; plaque.castShadow = false;
    const board = group('student-board', 'Student study and community board', [w / 2 - 35, 1760, bz + 1000], right); board.rotation.y = -Math.PI / 2;
    box(board, [1550, 1050, 30], [0, 0, 0], oak, 6); box(board, [1490, 990, 12], [0, 0, 22], material('#aeaa8d'));
    const infoMap = canvasMap(c => { c.fillStyle = '#eae6d5'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#436c58'; c.font = 'bold 40px sans-serif'; c.fillText('MAKE ROOM', 40, 90); c.font = '24px sans-serif'; ['FOR YOUR IDEAS', 'Quiet study', 'Shared learning', 'A desk that moves with you'].forEach((s, i) => c.fillText(s, 40, 150 + i * 75)); });
    box(board, [960, 840, 4], [0, 0, 31], material('#ffffff', { map: infoMap }));
    const notes = kit();
    for (let n = 0; n < 7; n++) notes.box([150 + rnd(n) * 60, 110 + rnd(n * 2) * 70, 2], [n < 4 ? -612 : 612, -330 + (n % 4) * 210, 30], { color: ['#f2e6a0', '#f4f1e8', '#cfe3d6', '#f0c9b8', '#d6e0ec'][n % 5], rot: [0, 0, (rnd(n * 5) - .5) * .25] });
    baked(board, notes, dress, false);
    // Framed prints, a reading-room clock and brass sconces dress the walls.
    const artMap = canvasMap((c, W, H) => {
        const panel = (x, draw) => { c.save(); c.translate(x, 0); c.fillStyle = '#f1eadb'; c.fillRect(0, 0, W / 4, H); c.beginPath(); c.rect(22, 22, W / 4 - 44, H - 44); c.clip(); draw(W / 4 - 44, H - 44); c.restore(); };
        panel(0, (pw, ph) => { c.fillStyle = '#dfe2cf'; c.fillRect(22, 22, pw, ph); c.strokeStyle = '#7f9a86'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(22, 40 + i * 50); c.bezierCurveTo(80, 20 + i * 52, 150, 70 + i * 48, 22 + pw, 30 + i * 50); c.stroke(); } c.fillStyle = '#b5705a'; for (const [x, y] of [[70, 120], [150, 260], [110, 380]]) c.fillRect(x, y, 30, 22); c.fillStyle = '#436c58'; c.font = 'bold 22px serif'; c.fillText('CAMPUS', 40, ph - 6); });
        panel(W / 4, (pw, ph) => { c.fillStyle = '#efe6cf'; c.fillRect(22, 22, pw, ph); c.strokeStyle = '#4c6c4f'; c.lineWidth = 4; c.beginPath(); c.moveTo(22 + pw / 2, ph); c.bezierCurveTo(22 + pw / 2 - 20, ph * .6, 22 + pw / 2 + 25, ph * .4, 22 + pw / 2, 60); c.stroke(); c.fillStyle = '#5f8a5e'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(22 + pw / 2 + (i % 2 ? 26 : -26), 90 + i * 42, 33, 6, (i % 2 ? -.6 : .6), 0, Math.PI * 2); c.fill(); } c.fillStyle = '#7d6a4a'; c.font = 'italic 18px serif'; c.fillText('COAST REDWOOD', 40, ph); });
        panel(W / 2, (pw, ph) => { c.fillStyle = '#2f4a40'; c.fillRect(22, 22, pw, ph); c.fillStyle = '#e8d9b0'; c.font = 'bold 34px serif'; c.fillText('QUIET', 50, 140); c.fillText('STUDY', 50, 185); c.font = '18px sans-serif'; c.fillText('Window seats · Reading room', 50, 230); c.strokeStyle = '#c9b27a'; c.lineWidth = 3; c.strokeRect(40, 90, pw - 36, 170); });
        panel(W * .75, (pw, ph) => { const g = c.createLinearGradient(0, 22, 0, ph); g.addColorStop(0, '#c9d6d8'); g.addColorStop(1, '#e9dcc0'); c.fillStyle = g; c.fillRect(22, 22, pw, ph); c.fillStyle = '#a5715a'; c.fillRect(50, ph * .45, pw - 56, ph * .5); c.fillStyle = '#7d4f3f'; c.beginPath(); c.moveTo(40, ph * .46); c.lineTo(22 + pw / 2, ph * .26); c.lineTo(pw + 12, ph * .46); c.fill(); c.fillRect(22 + pw / 2 - 18, ph * .12, 36, ph * .2); c.fillStyle = '#efe0b8'; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) c.fillRect(66 + i * 34, ph * .52 + j * 46, 16, 28); c.fillStyle = '#3f5e4e'; c.font = 'bold 18px serif'; c.fillText('EST. 1913', 60, ph); });
    }, 1024, 512);
    const art = (parent, slot, size, at, rotY = 0) => {
        const map = artMap.clone(); map.repeat.set(.25, 1); map.offset.set(slot * .25, 0);
        const g = new THREE.Group(); g.name = 'Framed library print'; g.position.set(...at); g.rotation.y = rotY; parent.add(g);
        const k = kit(); k.box([size[0] + 70, size[1] + 70, 30], [0, 0, 15], { color: '#3b2d22' }); baked(g, k, dress, false);
        mesh(g, new THREE.PlaneGeometry(...size), material('#ffffff', { map, roughness: .9 }), [0, 0, 31]).castShadow = false;
        register(g, `print-${slot}-${parent === back ? 'rear' : 'side'}`, 'Framed library print'); return g;
    };
    const sconce = (parent, at, rotY, brassKit, glowKit) => {
        const s = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)), [x, y, z] = at, p = d => [x + s.x * d, y, z + s.z * d];
        brassKit.box([120, 200, 14], p(7), { rot: [0, rotY, 0] }).cyl(8, 8, 120, p(70), { rot: rotY ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] }).cyl(30, 40, 26, [x + s.x * 130, y - 10, z + s.z * 130]);
        glowKit.cyl(70, 95, 150, [x + s.x * 130, y + 85, z + s.z * 130], { open: true });
        pools.add(parent, [x + s.x * 4, y + 140, z + s.z * 4], [520, 1150], WARM, lampLevel(.62), rotY ? 'right' : 'back');
    };
    const rearEdge = Math.max(...layout.stacks.filter(s => !s.double).map(s => s.at[0] + 925)), bay = (rearEdge + w / 2) / 2;
    const backBrass = kit(), backGlow = kit(), sideBrass = kit(), sideGlow = kit();
    art(back, 0, [760, 560], [bay, 1700, bz]);
    sconce(back, [bay - 680, 1850, bz], 0, backBrass, backGlow); sconce(back, [bay + 680, 1850, bz], 0, backBrass, backGlow);
    const clock = group('reading-room-clock', 'Reading room wall clock', [bay, h - 640, bz + 4], back);
    const clockMap = canvasMap((c, S) => {
        c.fillStyle = '#f3ecd9'; c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2b2b26'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 34px serif';
        ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, i) => { const an = i / 12 * Math.PI * 2; c.fillText(t, S / 2 + Math.sin(an) * S * .38, S / 2 - Math.cos(an) * S * .38); });
        for (let i = 0; i < 60; i++) { const an = i / 60 * Math.PI * 2; c.fillRect(S / 2 + Math.sin(an) * S * .46 - 1.5, S / 2 - Math.cos(an) * S * .46 - 1.5, 3, i % 5 ? 3 : 8); }
        c.font = '15px serif'; c.fillText('UNIVERSITY LIBRARY', S / 2, S * .66);
    }, 256, 256);
    const face = mesh(clock, new THREE.CircleGeometry(200, 40), material('#ffffff', { map: clockMap, roughness: .5 }), [0, 0, 36]); face.castShadow = false;
    const clockKit = kit(); clockKit.add(new THREE.TorusGeometry(212, 22, 10, 40), [0, 0, 30]).cyl(214, 214, 30, [0, 0, 15], { rot: [Math.PI / 2, 0, 0], seg: 40 });
    baked(clock, clockKit, brass, false);
    const hourHand = new THREE.Group(), minuteHand = new THREE.Group(); clock.add(hourHand, minuteHand);
    box(hourHand, [12, 120, 4], [0, 50, 40], dark).castShadow = false;
    box(minuteHand, [8, 175, 4], [0, 76, 42], dark).castShadow = false;
    const hub = kit(); hub.cyl(12, 12, 10, [0, 0, 44], { rot: [Math.PI / 2, 0, 0] }); baked(clock, hub, brass, false);
    // Study wall: prints and sconces continue the line of the notice board.
    for (const [n, slot] of [2, 1, 3].entries()) {
        const z = bz + 2350 + n * 1000;
        if (z > front - 900) break;
        art(right, slot, [520, 700], [w / 2, 1650, z], -Math.PI / 2);
        if (n < 2 && z + 500 < front - 900) sconce(right, [w / 2, 1850, z + 500], -Math.PI / 2, sideBrass, sideGlow);
    }
    sconce(right, [w / 2, 1850, bz + 1950], -Math.PI / 2, sideBrass, sideGlow);
    baked(back, backBrass, brass, false); baked(back, backGlow, glowMat({ side: THREE.DoubleSide }), false); baked(right, sideBrass, brass, false); baked(right, sideGlow, glowMat({ side: THREE.DoubleSide }), false);
    // Card catalogue under the notice board and a returns cart in the wall bay.
    const catalog = group('card-catalog', 'Library card catalogue cabinet', [w / 2 - 245, 0, bz + 1100]); catalog.rotation.y = -Math.PI / 2;
    const drawerMap = canvasMap((c, W, H) => {
        c.drawImage(oakMap.image, 0, 0, W, H);
        for (let col = 0; col < 4; col++) for (let row = 0; row < 6; row++) {
            const x = 14 + col * (W - 28) / 4, y = 14 + row * (H - 28) / 6, dw = (W - 28) / 4 - 8, dh = (H - 28) / 6 - 8;
            c.fillStyle = '#00000026'; c.fillRect(x, y, dw, dh); c.fillStyle = '#b48e62'; c.fillRect(x + 3, y + 3, dw - 6, dh - 6);
            c.fillStyle = '#c9b06b'; c.fillRect(x + dw / 2 - 26, y + 14, 52, 22); c.fillStyle = '#f4ecd6'; c.fillRect(x + dw / 2 - 21, y + 18, 42, 14);
            c.fillStyle = '#8a7340'; c.beginPath(); c.arc(x + dw / 2, y + dh - 22, 9, 0, Math.PI * 2); c.fill();
        }
    }, 512, 512);
    box(catalog, [1100, 880, 420], [0, 540, 0], oak); mesh(catalog, new THREE.PlaneGeometry(1090, 870), material('#ffffff', { map: drawerMap, roughness: .65 }), [0, 540, 211]).castShadow = false;
    const catKit = kit(); catKit.box([1150, 36, 450], [0, 998, 0]).box([1060, 100, 380], [0, 50, -10]);
    baked(catalog, catKit, oak);
    const catTop = kit(); vase(catTop, [-380, 1016, 0], '#4f7f78'); for (let n = 0; n < 3; n++) catTop.box([260 - n * 20, 38, 190], [250, 1035 + n * 38, 20], { color: ['#7a4a3c', '#2f4a40', '#c0a466'][n], rot: [0, (n - 1) * .12, 0] });
    catTop.box([260, 8, 180], [-40, 1020, 40], { color: '#f4efe2', rot: [0, .2, 0] });
    baked(catalog, catTop, dress);
    const cartAt = [Math.min(bay, w / 2 - 1000), 0, bz + 330];
    const cart = group('book-return-cart', 'Library book return cart', cartAt);
    const cartFrame = kit(), cartBooks = kit();
    for (const x of [-430, 430]) cartFrame.box([30, 900, 380], [x, 480, 0]);
    for (const [y, tilt] of [[230, 0], [560, .22], [880, .22]]) { cartFrame.box([860, 18, 175], [0, y, -95], { rot: [tilt, 0, 0] }).box([860, 18, 175], [0, y, 95], { rot: [-tilt, 0, 0] }); }
    for (const x of [-400, 400]) for (const z of [-160, 160]) cartBooks.cyl(30, 30, 24, [x, 30, z], { rot: [0, 0, Math.PI / 2], color: '#2a2724' });
    for (const [y, tilt] of [[560, .22], [880, .22], [230, 0]]) for (const side of [-1, 1]) {
        let x = -405;
        for (let n = 0; x < 380; n++) { const bw = 28 + rnd(n + y + side) * 30, bh = 200 + rnd(n * 3 + y) * 80; cartBooks.box([bw, bh, 150], [x + bw / 2, y + 9 + bh / 2 * Math.cos(tilt) - 20 * (y > 300), side * (95 + bh / 2 * Math.sin(tilt) * (y > 300 ? 1 : 0))], { rot: [-side * tilt, 0, 0], color: ['#5e8670', '#c0a466', '#7690a0', '#b5705a', '#e3d2a6', '#59656f', '#7a4a3c'][Math.floor(rnd(n * 7 + y + side) * 7)] }); x += bw + 1; }
    }
    baked(cart, cartFrame, oak); baked(cart, cartBooks, dress);
    // Lounge side table carries the globe prop when moved.
    const nook = group('lounge-side-table', 'Lounge side table', [layout.sideTable[0], 0, layout.sideTable[1]]);
    const sideKit = kit(); sideKit.cyl(240, 240, 34, [0, 543, 0], { seg: 32 }).cyl(28, 34, 500, [0, 280, 0]).cyl(170, 190, 30, [0, 15, 0], { seg: 28 });
    baked(nook, sideKit, oak);
    room.propSupports.push({ obj: nook, id: 'globe', at: [layout.sideTable[0], 560, layout.sideTable[1]] });
    const ceiling = new THREE.Group(); ceiling.name = 'Library suspended task lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const at of [layout.desk, ...layout.reading]) {
        for (const dx of [-480, 480]) rod(ceiling, [at[0] + dx, h, at[1]], [at[0] + dx, h - 420, at[1]], 3, brass);
        box(ceiling, [1400, 70, 130], [at[0], h - 450, at[1]], green, 5);
        box(ceiling, [1340, 8, 95], [at[0], h - 490, at[1]], glowMat(), 3).castShadow = false;
    }
    for (const spec of layout.stacks.filter(s => s.double)) {
        // Canopy light on the stack cornice washes both faces and moves with it.
        const shelf = room.assets().find(o => o.userData.propId === spec.id), k = kit(), strip = kit();
        for (const side of [-1, 1]) { k.box([1700, 30, 50], [0, 2015, side * 300]); strip.box([1660, 6, 34], [0, 1997, side * 300]); }
        baked(shelf, k, dark, false); baked(shelf, strip, glowMat(), false);
        for (const side of [-1, 1]) pools.add(shelf, [0, 3, side * 740], [1750, 820], '#ffe8c8', lampLevel(.3, .35));
    }
    // A genuine floor reading lamp keeps its base on the floor and its glowing
    // shade visible in the camera cutaway.
    const lamp = group('reading-lamp', 'Warm lounge reading lamp', [-w / 2 + 280, 0, front - 1950]);
    mesh(lamp, new THREE.CylinderGeometry(180, 180, 24, 24), brass, [0, 12, 0]); rod(lamp, [0, 20, 0], [0, 1750, 0], 14, brass);
    const pleats = canvasMap((c, W, H) => { c.fillStyle = '#e4d3aa'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 8) { c.fillStyle = (x / 8) % 2 ? '#cdb98c' : '#f0e2c0'; c.fillRect(x, 0, 4, H); } c.fillStyle = '#9a7f52'; c.fillRect(0, 0, W, 6); c.fillRect(0, H - 6, W, 6); }, 256, 64);
    const lampShade = material('#ffffff', { map: pleats, side: THREE.DoubleSide, emissive: '#7a5a2c', emissiveMap: pleats }); mesh(lamp, new THREE.CylinderGeometry(170, 230, 330, 28, 1, true), lampShade, [0, 1580, 0]);
    mesh(lamp, new THREE.CylinderGeometry(222, 222, 8, 28), glowMat(), [0, 1420, 0]).castShadow = false;
    pools.add(lamp, [80, 3, 0], [1800, 1800], WARM, lampLevel(.75)); pools.add(lamp, [-272, 1650, 0], [1100, 1500], WARM, lampLevel(.55), 'left');
    const opsHelpers = { material, mesh, box, group, baked, kit, canvasMap, oak, green, dark, brass, dress, back, right, catalog, cart, ceiling, glowMat, infoMap };
    const operations = buildLibraryOperations(room, layout, opsHelpers);
    const discussion = room.assets().find(o => o.userData.propId === 'collaboration-whiteboard');
    if (discussion) pools.add(discussion, [0, 470, 30], [1900, 1300], '#ffe6c4', [0, 0, 0, 0, .32], 'back');
    const campus = buildLibraryCampusDetails(room, layout, opsHelpers);
    const lights = [
        { at: [layout.desk[0], 1650, layout.desk[1] + 450], task: true, power: 4, range: 3200 },
        { at: [layout.reading[0][0], 1650, layout.reading[0][1]], task: true, power: 5, range: 3600 },
        { at: [index >= 2 ? layout.service[0] / 2 : 0, Math.min(2800, h - 350), bz + d * .43], task: false, power: 6 + index * 1.2, range: d * .8 },
        { at: layout.research ? [layout.research[0], 1950, layout.research[1] + 350] : [-w / 2 + 550, 1600, front - 1850], task: !!layout.research, power: layout.research ? 5 : 3, range: layout.research ? 6200 : 3700 },
        ...(layout.reading.length > 1 ? [{ at: [layout.reading[1][0], 1650, layout.reading[1][1]], task: true, secondary: true, power: 5, range: 3600 }] : [])
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = LIBRARY_MODES[modeId] || LIBRARY_MODES.morning;
        windowMode = modeId; drawWindow(modeId);
        const time = { morning: [9, 15], afternoon: [14, 20], evening: [18, 30], night: [22, 10], party: [16, 0] }[modeId] || [9, 15];
        hourHand.rotation.z = -(time[0] % 12 + time[1] / 60) / 12 * Math.PI * 2; minuteHand.rotation.z = -time[1] / 60 * Math.PI * 2;
        clock.userData.libraryTime = time; operations.setMode(modeId); campus.setMode(modeId);
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); const quiet = modeId === 'night' && mat.userData.libraryTable > 0 ? .28 : 1; mat.emissiveIntensity = .1 + mode.practical * accent * quiet; });
        poolMode = mode; poolAccent = accent; pools.apply(modeId);
        shades.forEach(mat => { mat.emissiveIntensity = .04 + mode.practical ** 2 * .7 * accent; }); lampShade.emissiveIntensity = .1 + mode.practical * .9 * accent;
        lights.forEach(spec => { spec.light.color.set(spec.task ? mode.colors[0] : mode.colors[1]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent * (modeId === 'night' && spec.secondary ? .28 : 1); }); root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[chalk, 'plaster'], [trim, 'plaster'], [green, 'powder'], [dark, 'powder'], [brass, 'metal'], [oak, 'wood'], [floor, carpeted ? 'fabric' : 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
// Library operations share the room's millimetre coordinates and stable asset
// identities. Small fittings are baked; screens redraw only when the daypart
// changes. Equipment stays with its real supporting cabinet/table when edited.
function buildLibraryOperations(room, layout, h) {
    const { material, mesh, box, group, baked, kit, canvasMap, oak, green, dark, brass, dress, back, right, catalog, cart, ceiling, glowMat } = h;
    const { width: w, depth: d, height: height, back: bz, index } = layout, front = bz + d;
    const modes = ['morning', 'afternoon', 'evening', 'night', 'party'], screens = [], variants = [];
    const paper = material('#eee9da', { roughness: .94 }), steel = material('#47524f', { metalness: .45, roughness: .42 });
    paper.userData.roomSurface = 'paper'; steel.userData.roomSurface = 'metal';
    const notice = (parent, text, detail, at, size = [620, 220], rotation = 0) => {
        const map = canvasMap((c, W, H) => {
            c.fillStyle = '#26463e'; c.fillRect(0, 0, W, H); c.fillStyle = '#c4ab76'; c.fillRect(0, 0, 12, H);
            c.fillStyle = '#f5f0e3'; c.font = 'bold 38px sans-serif'; c.fillText(text, 32, 70);
            c.fillStyle = '#d6dbce'; c.font = '24px sans-serif'; c.fillText(detail, 32, 118);
        }, 768, 160);
        const p = mesh(parent, new THREE.PlaneGeometry(...size), material('#ffffff', { map, roughness: .85 }), at);
        p.rotation.y = rotation; p.castShadow = false; return p;
    };
    const screen = (parent, at, kind, width = 400) => {
        const screenHeight = width * .625, k = kit(), [x, y, z] = at;
        k.box([width * .55, 9, 140], [x, y + 4.5, z + 5]).box([32, 115, 30], [x, y + 64, z]);
        k.box([width + 24, screenHeight + 24, 22], [x, y + 120 + screenHeight / 2, z]); baked(parent, k, steel);
        const map = canvasMap(() => {}, 768, 480), mat = material('#ffffff', { map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .18, roughness: .65 });
        const p = mesh(parent, new THREE.PlaneGeometry(width, screenHeight), mat, [x, y + 120 + screenHeight / 2, z + 12]); p.castShadow = false;
        screens.push({ map, mat, kind }); return p;
    };
    const printedPage = (parent, at, title, open = false) => {
        const k = kit(), [x, y, z] = at;
        k.box([open ? 320 : 180, 8, 230], [x, y + 4, z], { color: '#456554' });
        k.box([open ? 310 : 168, 20, 222], [x, y + 18, z], { color: '#e6dfcb' }); baked(parent, k, dress);
        const map = canvasMap((c, W, H) => {
            c.fillStyle = '#eee8d8'; c.fillRect(0, 0, W, H); c.fillStyle = '#33473e'; c.font = 'bold 22px serif'; c.fillText(title, 22, 42);
            for (let col = 0; col < (open ? 2 : 1); col++) {
                c.fillStyle = '#818678'; for (let n = 0; n < 11; n++) c.fillRect(22 + col * W / 2, 67 + n * 15, (open ? W / 2 : W) - 52 - (n % 4) * 8, 2);
            }
            if (open) { c.fillStyle = '#d3cab8'; c.fillRect(W / 2 - 2, 0, 4, H); }
        }, 512, 256);
        const page = mesh(parent, new THREE.PlaneGeometry(open ? 306 : 164, 218), material('#ffffff', { map, roughness: 1 }), [x, y + 28.2, z]); page.rotation.x = -Math.PI / 2; page.castShadow = false;
    };
    // A compact catalog terminal belongs in every size, even the pilot nook.
    // Preserve the archival drawer cabinet and its previously saved identity.
    screen(catalog, [-80, 1016, -20], 'catalog', 360);
    notice(catalog, 'CATALOG', 'Find a book · Ask for help', [-80, 1110, 180], [350, 72]);
    notice(cart, 'RETURNS', 'For staff to reshelve', [0, 475, 211], [650, 130]);
    const rackZ = index >= 2 ? bz + d * .26 : bz + d * .5;
    const periodicals = group('current-periodicals', 'Current journals and periodicals rack', [w / 2 - 170, 0, rackZ]); periodicals.rotation.y = -Math.PI / 2;
    const rack = kit(); rack.box([1040, 1240, 28], [0, 650, -100]).box([1100, 70, 300], [0, 35, 0]);
    for (const y of [370, 820]) rack.box([1030, 22, 240], [0, y, 0]).box([1030, 90, 18], [0, y + 35, 116]); baked(periodicals, rack, oak);
    const coverMap = canvasMap((c, W, H) => {
        const titles = [['FIELD', 'NOTES', 'ECOLOGY'], ['DESIGN', 'REVIEW', 'MATERIALS'], ['PUBLIC', 'HISTORY', 'ARCHIVES']];
        for (let i = 0; i < 3; i++) {
            const x = i * W / 3, cw = W / 3; c.fillStyle = ['#43685d', '#9a6955', '#52697a'][i]; c.fillRect(x, 0, cw, H);
            c.fillStyle = '#eae3ce'; c.font = 'bold 37px serif'; c.fillText(titles[i][0], x + 24, 70); c.fillText(titles[i][1], x + 24, 112);
            c.strokeStyle = '#d7c392'; c.lineWidth = 2; for (let n = 0; n < 9; n++) { c.beginPath(); c.ellipse(x + cw / 2, H * .52, 35 + n * 7, 64 + n * 6, n * .22, 0, Math.PI * 2); c.stroke(); }
            c.font = '18px sans-serif'; c.fillText(titles[i][2], x + 24, H - 55); c.fillText('CURRENT ISSUE', x + 24, H - 28);
        }
    }, 768, 512);
    for (let i = 0; i < 3; i++) {
        const map = coverMap.clone(); map.repeat.x = 1 / 3; map.offset.x = i / 3;
        const covers = kit(); for (const y of [530, 980]) covers.box([235, 310, 16], [(i - 1) * 315, y, -25], { rot: [-.13, 0, 0] });
        baked(periodicals, covers, material('#ffffff', { map, roughness: .87 }));
    }
    notice(periodicals, 'CURRENT JOURNALS', 'Read here · Leave for reshelving', [0, 1190, 20], [940, 155]);
    // Physical end labels let patrons find a subject from either aisle. Broad
    // LC class letters are illustrative, not records of a real collection.
    for (const [i, spec] of layout.stacks.entries()) {
        const shelf = room.assets().find(o => o.userData.propId === spec.id);
        const classification = ['N · ART', 'Q · SCIENCE', 'P · LITERATURE', 'D · HISTORY', 'T · TECHNOLOGY', 'A · REFERENCE'][i % 6];
        const map = canvasMap((c, W, H) => {
            c.fillStyle = '#ede8da'; c.fillRect(0, 0, W, H); c.fillStyle = '#315047'; c.fillRect(0, 0, W, 78);
            c.fillStyle = '#f3eddc'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.fillText('COLLECTIONS', W / 2, 48);
            c.fillStyle = '#315047'; c.font = 'bold 26px sans-serif'; c.fillText(classification, W / 2, 137);
            c.font = '20px sans-serif'; c.fillText('Browse both sides', W / 2, 193); c.fillText('Ask us for help', W / 2, 226);
            c.strokeStyle = '#bcaa7b'; c.lineWidth = 3; c.strokeRect(12, 12, W - 24, H - 24);
        }, 320, 280);
        for (const side of [-1, 1]) {
            if (shelf.userData.libraryStack.joined?.[side > 0 ? 1 : 0]) continue;
            const at = shelf.userData.libraryStack.double ? 937 : 931;
            if (at > 931) box(shelf, [6, 300, 340], [side * 934, 1390, 0], brass);
            const p = mesh(shelf, new THREE.PlaneGeometry(310, 270), material('#ffffff', { map, roughness: .88 }), [side * at, 1390, 0]); p.rotation.y = side * Math.PI / 2; p.castShadow = false;
        }
    }
    const services = [];
    if (layout.service) {
        const service = group('research-help-counter', 'Research help and self checkout counter', [layout.service[0], 0, layout.service[1]]); services.push(service);
        const body = kit(); body.box([1550, 680, 560], [0, 370, -40]).box([1600, 60, 600], [0, 30, -40]); baked(service, body, green);
        const top = kit(); top.box([1800, 40, 760], [0, 720, 0]); baked(service, top, oak);
        const lip = kit(); lip.box([1650, 4, 18], [0, 742, 345]); baked(service, lip, brass, false);
        // Low counter, open knees at the side, a visible book-reading pad and
        // receipt outlet distinguish circulation from a private office desk.
        box(service, [250, 14, 300], [540, 747, 140], dark, 8);
        box(service, [110, 44, 110], [540, 762, -100], steel, 4);
        box(service, [82, 2, 10], [540, 785, -76], dark);
        screen(service, [-460, 740, -120], 'help', 380);
        notice(service, 'RESEARCH HELP', 'Ask · Borrow · Return', [0, 545, 247], [1250, 240]);
        for (const [phase, mode] of modes.entries()) {
            const v = new THREE.Group(); v.name = 'Library service activity · ' + mode; service.add(v); variants.push({ obj: v, mode });
            if (phase === 0) {
                const books = kit(); for (let n = 0; n < 3; n++) books.box([230, 28, 170], [70, 754 + n * 28, 120], { color: ['#86624d', '#496756', '#c6ad76'][n], rot: [0, .06 * n, 0] }); baked(v, books, dress);
            } else printedPage(v, [65, 740, 100], phase === 4 ? 'Shared sources' : phase === 3 ? 'Reserved reading' : 'Research notes', phase !== 3);
            const slip = kit(); slip.box([95, 1, 145], [340, 741, 180], { color: '#eee8d8', rot: [0, .16, 0] }); baked(v, slip, dress, false);
        }
    }
    if (layout.research) {
        const table = group('digital-research-table', 'Digital research and accessible technology table', [layout.research[0], 0, layout.research[1]]); services.push(table); table.userData.roomSupportHeights = [740];
        box(table, [1800, 40, 750], [0, 720, 0], oak, 8);
        const legs = kit(); for (const x of [-770, 770]) { legs.box([60, 700, 600], [x, 350, 0]); legs.box([440, 28, 680], [x, 14, 0]); } baked(table, legs, steel);
        const cable = kit(); cable.box([1580, 80, 85], [0, 615, -240]).box([1600, 50, 55], [0, 765, -330]); baked(table, cable, green);
        for (const x of [-450, 450]) {
            screen(table, [x, 740, -235], 'research', 440);
            const keyboard = kit(); keyboard.box([345, 12, 105], [x, 746, 65], { color: '#394841' }).box([48, 22, 76], [x + 227, 751, 65], { color: '#394841' });
            for (let row = 0; row < 4; row++) for (let n = 0; n < 13; n++) keyboard.box([19, 2, 16], [x - 145 + n * 24, 753, 30 + row * 23], { color: '#bdc4bd' });
            baked(table, keyboard, dress);
        }
        notice(table, 'DIGITAL RESEARCH', 'Databases · Citation tools · Assistive technology', [0, 622, 301], [1500, 155]);
        const light = kit(); light.box([1700, 7, 50], [0, 1710, -285]); baked(table, light, glowMat(), false);
        const supports = kit(); for (const x of [-1000, 1000]) supports.box([22, 970, 22], [x, 1225, -290]); baked(table, supports, steel);
        const print = group('print-scan-cabinet', 'Print and scan equipment cabinet', [w / 2 - 350, 0, front - 4100]); print.rotation.y = -Math.PI / 2;
        const cabinet = kit(); cabinet.box([1000, 760, 580], [0, 410, 0]).box([1050, 60, 600], [0, 30, 0]).box([1040, 35, 610], [0, 807.5, 0]); baked(print, cabinet, oak);
        const machine = kit(); machine.box([660, 270, 470], [0, 960, 0], { color: '#d1d5cf' }).box([630, 28, 450], [0, 1109, -10], { color: '#414e49' });
        machine.box([510, 24, 100], [0, 1140, -145], { color: '#47524f' }).box([380, 55, 90], [0, 846, 252], { color: '#3c4844' });
        machine.box([330, 10, 230], [0, 882, 197], { color: '#eee9da' }); baked(print, machine, dress);
        notice(print, 'PRINT / SCAN', 'Collect pages · Recycle drafts', [0, 510, 292], [780, 170]);
        const display = screen(print, [390, 825, 160], 'print', 135); display.userData.presentationOnly = true;
    }
    // Fabric acoustic panels belong to the architecture. Posters and notice
    // boards are still editable along the wall, but absorbers cannot turn into
    // floor obstacles or be mistaken for furniture by the interaction binder.
    const fabricMap = canvasMap((c, W, H) => {
        c.fillStyle = '#7f8f78'; c.fillRect(0, 0, W, H);
        for (let n = 0; n < 2800; n++) { c.fillStyle = n % 2 ? '#ffffff18' : '#00000020'; c.fillRect(rnd(n) * W, rnd(n + 9) * H, 2, 5); }
    }, 256, 256);
    const acousticMat = material('#ffffff', { map: fabricMap, roughness: 1 }); acousticMat.userData.roomSurface = 'fabric';
    for (let z = bz + 6100; z < front - 3000; z += 2200) {
        const panel = group('acoustic-' + Math.round(z - bz), 'Library wall acoustic treatment', [w / 2 - 35, 1960, z], right); panel.rotation.y = -Math.PI / 2; panel.userData.presentationOnly = true;
        box(panel, [1320, 800, 40], [0, 0, 0], acousticMat, 10);
        for (const x of [-520, -260, 0, 260, 520]) box(panel, [14, 730, 6], [x, 0, 23], oak);
    }
    const guide = group('library-wayfinding', 'Library services and quiet study guide', [w / 2 - 32, 2350, bz + (index ? 4600 : 3000)], right); guide.rotation.y = -Math.PI / 2;
    notice(guide, 'QUIET STUDY', index >= 2 ? '← Window carrels    Research help →' : 'Reading seats    Catalog →', [0, 0, 0], [1400, 290]);
    // The discussion board is kept in the shared zone; it is not a loud display
    // over the quiet carrels. Its frame follows the existing floor editing API.
    let discussionMap = null;
    if (index >= 1) {
        const board = group('collaboration-whiteboard', 'Wall mounted shared research whiteboard', [w / 2 - 32, 900, front - 800], right); board.rotation.y = -Math.PI / 2;
        board.userData.libraryZone = 'collaborative'; board.userData.propAnchor = 'wall';
        const frame = kit();
        for (const x of [-670, 670]) frame.box([28, 900, 32], [x, 470, 0]);
        for (const y of [20, 920]) frame.box([1390, 28, 32], [0, y, 0]);
        frame.box([1260, 25, 65], [0, 8, 25]); baked(board, frame, steel);
        box(board, [1310, 870, 24], [0, 470, 0], paper, 6);
        discussionMap = canvasMap(() => {}, 1024, 640);
        mesh(board, new THREE.PlaneGeometry(1285, 845), material('#ffffff', { map: discussionMap, roughness: .9 }), [0, 470, 13]).castShadow = false;
    }
    // Supplemental fixtures are attached to the existing ceiling cutaway root,
    // never floating mid-room or obscuring a bird's-eye view.
    for (const at of [layout.service, layout.research].filter(Boolean)) {
        const k = kit(); k.box([1600, 45, 90], [at[0], height - 250, at[1]]);
        for (const x of [-650, 650]) k.cyl(2, 2, 227.5, [at[0] + x, height - 113.75, at[1]]); baked(ceiling, k, steel, false);
        box(ceiling, [1530, 5, 70], [at[0], height - 275, at[1]], glowMat(), 2).castShadow = false;
    }
    let previous = null;
    return { setMode(mode) {
        if (mode === previous) return; previous = mode;
        variants.forEach(v => { v.obj.visible = v.mode === mode; });
        const quiet = mode === 'night', groupStudy = mode === 'party';
        for (const entry of screens) {
            const c = entry.map.image.getContext('2d'), W = entry.map.image.width, H = entry.map.image.height;
            c.fillStyle = quiet ? '#182d29' : '#edece1'; c.fillRect(0, 0, W, H);
            c.fillStyle = '#285247'; c.fillRect(0, 0, W, 74); c.fillStyle = '#f4f0df'; c.font = 'bold 28px sans-serif';
            c.fillText(entry.kind === 'print' ? 'READY TO SCAN' : entry.kind === 'help' ? quiet ? 'SELF SERVICE' : 'RESEARCH HELP' : entry.kind === 'research' ? ({morning:'READING & COLLECTIONS',afternoon:'GIS / FIELD RESEARCH',evening:'CITATION / ANNOTATION',night:'FOCUS / READING LIST',party:'SHARED EVIDENCE'})[mode] : 'LIBRARY SEARCH', 28, 48);
            c.fillStyle = quiet ? '#dce3d4' : '#36574b'; c.font = '23px sans-serif';
            c.fillText(entry.kind === 'help' ? quiet ? 'Staff desk closed · Quiet study' : 'Ask us about books and research' : groupStudy ? 'Shared sources for your project' : 'Search books, articles and databases', 28, 122);
            c.fillStyle = quiet ? '#30473c' : '#ffffff'; c.fillRect(28, 153, W - 56, 55);
            c.fillStyle = quiet ? '#c4d4bf' : '#73857a'; c.font = '22px sans-serif'; c.fillText(entry.kind === 'print' ? 'Place original on glass' : 'Title, author or subject…', 46, 189);
            const researchRows = {morning:['Course reading · Collect sources','North Coast authors · Browse','Field ecology · Explore'],afternoon:['GIS layers · Coast and watershed','Digital herbarium · Specimens','Primary sources · Archives'],evening:['Reading notes · Review','Citation manager · References','Research journal · Reflect'],night:['One chapter · Focus','Saved reading list · Tomorrow','Quiet study · Headphones'],party:['Shared question · Compare sources','Evidence map · Work together','Discussion notes · Cite and share']};
            const rows = entry.kind === 'research' ? researchRows[mode] : entry.kind === 'help' ? ['Borrow / renew', 'Course reserves', 'Research appointment'] : entry.kind === 'print' ? ['Scan to your device', 'Collect your print job', 'Recycle extra pages'] : ['Forest ecology · Books', 'Methods of research · Articles', 'Design and society · Databases'];
            for (const [i, title] of rows.entries()) {
                c.fillStyle = quiet ? '#3c594b' : '#cddace'; c.fillRect(28, 233 + i * 65, 34, 44); c.fillStyle = quiet ? '#dee7d9' : '#35544b'; c.fillText(title, 83, 259 + i * 65);
            }
            c.font = '18px sans-serif'; c.fillStyle = quiet ? '#aabcb1' : '#728678'; c.fillText('Campus library · Preview display', 28, H - 22);
            entry.map.needsUpdate = true; entry.mat.emissiveIntensity = quiet ? .11 : .22;
        }
        if (discussionMap) {
            const c = discussionMap.image.getContext('2d'); c.fillStyle = '#edece3'; c.fillRect(0, 0, 1024, 640); c.fillStyle = '#31544b'; c.font = 'bold 48px sans-serif';
            c.fillText(groupStudy ? 'RESEARCH TOGETHER' : quiet ? 'NEXT STUDY SESSION' : 'RESEARCH WORKSHOP', 65, 95);
            c.font = '28px sans-serif'; ['Question → Find sources', 'Compare evidence → Share ideas', 'Cite sources → Review together'].forEach((line, i) => c.fillText(line, 70, 195 + i * 110));
            c.strokeStyle = '#8a9a81'; c.lineWidth = 3; c.strokeRect(45, 135, 930, 390); c.fillStyle = '#c8a269';
            for (let i = 0; i < (groupStudy ? 5 : 2); i++) { c.fillRect(710 + i % 2 * 112, 200 + Math.floor(i / 2) * 100, 85, 68); }
            discussionMap.needsUpdate = true;
        }
        room.root.userData.libraryOperations = { mode, service: quiet ? 'self-service' : 'research-help', catalog: true, periodicals: true, researchSeats: layout.research ? 2 : 0, quietCarrels: layout.carrels.length, collaborationBoard: index >= 1 };
    } };
}

// Crop the photographed curtains in the canvas, keeping the source file intact.
// The room already has pleated linen drapes. Fit without stretching the campus
// and keep the building centred across the five differently sized openings.
function drawCampusImage(c, image, modeId) {
    const W = c.canvas.width, H = c.canvas.height;
    let x = image.naturalWidth * .058, y = 0;
    let width = image.naturalWidth * .864, height = image.naturalHeight;
    const aspect = W / H;
    if (width / height > aspect) { const crop = height * aspect; x += (width - crop) / 2; width = crop; }
    else { const crop = width / aspect; y = (height - crop) / 2; height = crop; }
    const filters = { morning: 'brightness(0.96) saturate(0.94)', afternoon: 'none', evening: 'brightness(0.86) saturate(0.80)', night: 'brightness(0.60) saturate(0.60)', party: 'brightness(0.88) saturate(0.90)' };
    c.save(); c.filter = filters[modeId] || filters.morning;
    c.drawImage(image, x, y, width, height, 0, 0, W, H); c.filter = 'none';
    c.restore(); c.save();
    if (modeId === 'evening') {
        // Dusk: a cooling sky over a warm horizon, then a low amber glaze.
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3b4f7f'); g.addColorStop(.65, '#e08a50'); g.addColorStop(1, '#8a6a58');
        c.globalCompositeOperation = 'multiply'; c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'soft-light'; c.globalAlpha = .25; c.fillStyle = '#ff9a5a'; c.fillRect(0, 0, W, H);
    } else if (modeId === 'night') {
        c.globalCompositeOperation = 'multiply'; c.fillStyle = '#1d2c48'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = '#17305240'; c.fillRect(0, 0, W, H);
    }
    c.restore();
}

// Fallback window view: a campus quad with a brick hall, clock tower, oaks and
// redwoods. Sun, cloud and lit windows follow the time of day.
function drawCampus(c, modeId, mode) {
    const W = 1024, H = 512, night = modeId === 'night', dusk = modeId === 'evening', group = modeId === 'party';
    const sky = c.createLinearGradient(0, 0, 0, H * .72); sky.addColorStop(0, mode.sky[0]); sky.addColorStop(1, mode.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sun = { morning: [170, 250, '#fff4d8'], afternoon: [760, 70, '#fffdf0'], evening: [300, 292, '#ffc27a'], night: [820, 90, '#eef0e4'], party: [880, 190, '#fff2dc'] }[modeId] || [500, 100, '#fff'];
    const halo = c.createRadialGradient(sun[0], sun[1], 4, sun[0], sun[1], night ? 90 : 260); halo.addColorStop(0, sun[2] + (night ? '90' : 'e0')); halo.addColorStop(1, sun[2] + '00'); c.fillStyle = halo; c.fillRect(0, 0, W, H);
    c.fillStyle = sun[2]; c.beginPath(); c.arc(sun[0], sun[1], night ? 20 : 30, 0, Math.PI * 2); c.fill();
    if (night) { c.fillStyle = '#ffffffb0'; for (let i = 0; i < 110; i++) c.fillRect(rnd(i) * W, rnd(i * 3) * H * .55, 1.5 + rnd(i * 7) * 1.5, 1.5 + rnd(i * 7) * 1.5); }
    else for (let i = 0; i < 7; i++) {
        const x = rnd(i * 5 + 2) * W, y = 40 + rnd(i * 9) * 150, s = 40 + rnd(i * 4) * 50;
        c.fillStyle = dusk ? '#f6c9a8a0' : group ? '#f4ece0a0' : '#ffffffb0';
        for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + (j - 2) * s * .55, y + Math.abs(j - 2) * 6, s * .6, s * .32, 0, 0, Math.PI * 2); c.fill(); }
    }
    // Distant hills and redwoods.
    c.fillStyle = night ? '#1c2f33' : dusk ? '#5b6b62' : '#7f9f88'; c.beginPath(); c.moveTo(0, 330); c.bezierCurveTo(250, 270, 520, 320, 1024, 280); c.lineTo(1024, 512); c.lineTo(0, 512); c.fill();
    const tree = night ? '#16292a' : dusk ? '#33493f' : '#3f6b56';
    c.fillStyle = tree;
    for (let i = 0; i < 9; i++) { const x = i * 46 + 10, y = 170 + (i * 29) % 110; c.fillRect(x - 3, y, 6, 352); for (let j = 0; j < 6; j++) { const top = y + j * 34, size = 18 + j * 7; c.beginPath(); c.moveTo(x, top); c.lineTo(x - size, top + 64); c.lineTo(x + size, top + 64); c.fill(); } }
    // Brick hall with a clock tower.
    const brick = night ? '#3b2a2a' : dusk ? '#8a5a48' : '#a8705a', roof = night ? '#1f2629' : '#4f5a5e', lit = night || dusk;
    c.fillStyle = brick; c.fillRect(430, 250, 520, 160); c.fillRect(640, 130, 90, 130);
    c.fillStyle = roof; c.beginPath(); c.moveTo(420, 252); c.lineTo(690, 205); c.lineTo(960, 252); c.fill(); c.beginPath(); c.moveTo(630, 132); c.lineTo(685, 60); c.lineTo(740, 132); c.fill();
    // Fine masonry, recessed openings and a shaded entrance give the campus
    // view depth without loading photographs or adding exterior scene lights.
    c.save(); c.beginPath(); c.rect(430, 255, 520, 151); c.clip();
    const facade = c.createLinearGradient(430, 255, 950, 406); facade.addColorStop(0, '#fff0cf14'); facade.addColorStop(1, '#171e2935'); c.fillStyle = facade; c.fillRect(430, 255, 520, 151);
    c.strokeStyle = night ? '#93806512' : '#dbb18f45'; c.lineWidth = .65;
    for (let y = 257; y < 408; y += 9) { c.beginPath(); c.moveTo(430, y); c.lineTo(950, y); c.stroke(); for (let x = 430 + ((y - 257) / 9 % 2) * 14; x < 950; x += 28) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 9); c.stroke(); } }
    c.restore();
    c.fillStyle = night ? '#212829' : '#765c4c'; c.fillRect(430, 401, 520, 9);
    c.fillStyle = night ? '#d6b278' : '#626b62'; c.fillRect(662, 369, 46, 40); c.fillStyle = roof; c.fillRect(654, 359, 63, 7);
    c.fillStyle = night ? '#e9d79c' : '#efe6cf'; c.beginPath(); c.arc(685, 172, 22, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) {
        const on = lit && rnd(i * 3 + j) > (night ? .35 : .55);
        c.fillStyle = on ? '#ffd88a' : night ? '#29343c' : dusk ? '#c9a58e' : '#bcd0d8'; c.fillRect(452 + i * 41, 272 + j * 44, 20, 30);
    }
    // Lawn, path and campus oaks.
    c.fillStyle = night ? '#1f3a2c' : dusk ? '#5d7449' : '#7fa35e'; c.fillRect(0, 404, W, 108);
    c.fillStyle = night ? '#4a4c46' : '#d8cdb2'; c.beginPath(); c.moveTo(560, 512); c.lineTo(660, 404); c.lineTo(700, 404); c.lineTo(760, 512); c.fill();
    for (const [x, s] of [[470, 1], [900, 1.2], [1000, .9]]) {
        c.fillStyle = night ? '#2a2420' : '#5a4632'; c.fillRect(x - 6, 340, 12, 80);
        c.fillStyle = night ? '#18302a' : dusk ? '#3e5a40' : '#55804c';
        for (let j = 0; j < 7; j++) { c.beginPath(); c.arc(x + Math.cos(j * 1.3) * 34 * s, 320 + Math.sin(j * 1.9) * 22 * s - 20, 34 * s, 0, Math.PI * 2); c.fill(); }
    }
    // Outdoor seats, bicycle hoops and small pedestrian silhouettes make a
    // functioning campus quad; the late-study window remains still and quiet.
    for (const x of [485, 880]) {
        c.fillStyle = night ? '#30322d' : '#967e59'; c.fillRect(x, 430, 52, 6); c.fillRect(x + 3, 416, 46, 8);
        c.fillStyle = '#35443b'; c.fillRect(x + 7, 436, 3, 14); c.fillRect(x + 43, 436, 3, 14);
    }
    c.strokeStyle = night ? '#526260' : '#6e8178'; c.lineWidth = 2;
    for (let x = 770; x < 824; x += 14) { c.beginPath(); c.moveTo(x, 430); c.lineTo(x, 414); c.quadraticCurveTo(x + 6, 405, x + 12, 414); c.lineTo(x + 12, 430); c.stroke(); }
    if (!night) for (const [x, y, color] of [[652, 434, '#5a6f78'], [687, 453, '#9a7256']]) {
        c.fillStyle = '#816959'; c.beginPath(); c.arc(x, y - 26, 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = color; c.fillRect(x - 3, y - 22, 6, 13); c.strokeStyle = '#374b44'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x - 3, y); c.moveTo(x, y - 10); c.lineTo(x + 4, y - 1); c.stroke();
    }
    if (lit) for (const x of [600, 820]) {
        c.fillStyle = '#2a2a2a'; c.fillRect(x - 2, 360, 4, 60);
        const g = c.createRadialGradient(x, 358, 1, x, 358, 26); g.addColorStop(0, '#fff2c0'); g.addColorStop(1, '#fff2c000'); c.fillStyle = g; c.fillRect(x - 30, 330, 60, 60);
    }
}
