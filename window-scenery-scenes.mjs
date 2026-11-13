// The places outside the Studio's windows (window-scenery.mjs), one per kind of place, each built in a window's frame
// (millimetres; the wall at z = 0, the room on +z, outside on -z, x to the right of someone looking out, y up) from the
// parts in window-scenery-kit.mjs.
//
// build(k, ctx): k.land (the land's geometry), k.lights (what glows after dark), k.halos (soft glows round lamps),
// k.r (this world's random numbers: the seed picks the arrangement). ctx: the openings, ctx.ground (the ground
// outside, below the window's centre: the room's floor less the storey), ctx.left/right/bottom/top (the openings'
// extent), ctx.variant (a room's own version of the place).
// storey: how far a room is above the ground outside, unless the room says. hours: the place's own light per hour,
// laid over HOURS. hazeFar: the distance at which the air has its full say.
import * as THREE from 'three';
import { colour, M, ground as groundPlane, ridge, crown, tree, conifer, redwood, fanPalm, featherPalm, shrub, hedge, flowers, grass, rock, house, building, streetLamp, car, bench, pathLight, utilityPole, wire, fence, masonry, pole, limb, spray } from './window-scenery-kit.mjs?v=polish-20261113a';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pick = (r, list) => list[Math.floor(r() * list.length)];
// Ground in two parts: fine near the window (where paths and lawn edges are seen), coarse beyond `split`.
const land = (b, y, x0, x1, near, split, far, fill, step = 500) => { groundPlane(b, y, x0, x1, split, near, step, fill); groundPlane(b, y, x0 - 40000, x1 + 40000, far, split, step * 6, fill); };

// ---- a garden behind a house (the home room). Planting in a timber planter just above the sill, a stone terrace, a
// lawn with trees and a bench, a flower border, a board fence with a hedge at 15 m, the neighbours' houses and their
// trees beyond, a low wood at the horizon. After dark: terrace lights, the neighbours' windows and porch lights.
function garden(k, ctx) {
    const { land: b, r } = k, cx = (ctx.left + ctx.right) / 2, width = ctx.width, ground = ctx.ground - 220, sill = ctx.bottom;
    const grassC = colour('#72865e'), dry = colour('#889869'), out = new THREE.Color();
    const lawnAt = (x, z) => { const stripe = Math.sin(x / 620) * .5 + .5, patch = Math.sin(x / 3100 + 1.3) * Math.sin(z / 2700) * .5 + .5;
        return out.copy(grassC).lerp(dry, stripe * .16 + patch * .34).multiplyScalar(.93 + r() * .07); };
    groundPlane(b, ground, -26000, 26000, -16000, -60, 500, lawnAt); groundPlane(b, ground, -50000, 50000, -56000, -16000, 2500, lawnAt);
    // terrace by the house: stone slabs
    for (let i = -9; i <= 9; i++) for (let j = 0; j < 3; j++) b.box([880, 40, 880], [cx + i * 900, ground + 20, -520 - j * 900], '#b8b0a2', .05, r);
    // planting under the window: a timber planter, shrubs just above the sill, flowers
    const span = width / 2 + 700;
    b.box([span * 2 + 300, 520, 520], [cx, sill - 560, -520], '#7b5d47'); b.box([span * 2 + 240, 60, 460], [cx, sill - 290, -520], '#4a3a2e');
    for (let x = cx - span; x <= cx + span; x += 300 + r() * 160) {
        const top = sill - 120 + r() * 330, radius = 200 + r() * 100, z = -520 + (r() - .5) * 160;
        shrub(k.land, r, x, top - radius * 1.25, z, radius, r() < .3 ? '#5d7d52' : '#6f8f5a', { size: 70 });
        if (r() < .75) flowers(b, r, x, top - radius * .2, z, radius * .8, 16);
    }
    // tall grasses and a shrub at each end of the terrace
    for (const side of [-1, 1]) for (let j = 0; j < 4; j++) shrub(b, r, cx + side * (span + 900 + j * 520), ground, -1500 - r() * 900, 520 + r() * 220, j % 2 ? '#627f55' : '#75925e');
    grass(b, r, cx - span - 2500, cx + span + 2500, -3300, -1500, ground, 900, '#6e8558', 300);
    // the lawn's trees: one near on the right, an ornamental one further left, a bench under the near one
    tree(b, r, cx + width * .5 + 2700, ground, -6000, { height: 5600, hex: '#688856' });
    tree(b, r, cx - width * .5 - 2300, ground, -8200, { height: 4300, hex: '#84996a', shape: 'ornamental' });
    tree(b, r, cx - width * .5 - 5200, ground, -12800, { height: 5000, hex: '#5f7d53' });
    bench(b, cx + width * .5 + 2300, ground, -4700);
    // flower border along the left
    for (let j = 0; j < 14; j++) { const z = -2600 - j * 640, x = cx - width * .5 - 3300 + Math.sin(j * 1.7) * 260;
        shrub(b, r, x, ground, z, 330 + r() * 120, '#6b8a58'); flowers(b, r, x, ground + 420, z, 300, 12, undefined, 30); }
    // the boundary: a board fence with a hedge grown along it
    const fz = -15200;
    fence(b, r, -24000, 24000, ground, fz);
    hedge(b, r, -24000, cx + 2600, ground, fz + 650, 2300, 1200, '#516f4d'); hedge(b, r, cx + 7800, 24000, ground, fz + 650, 2300, 1200, '#516f4d');
    // garden lights along the terrace (after dark)
    for (const x of [cx - span - 500, cx, cx + span + 500]) { b.box([36, 520, 36], [x, ground + 260, -2100], '#3b3b3d'); k.lights.box([90, 90, 90], [x, ground + 560, -2100], '#ffd9a2');
        k.halos.add(x, ground + 570, -2050, 420, '#ffcf96', .5); b.light(x, ground + 450, -2300, '#ffcf96', 2200, .4); }
    // beyond the fence: the neighbours, their trees, a street lamp between them, the far wood
    // (kept low and apart: from inside the room the window shows only the first fifteen degrees above the horizon,
    // and the sky has to have its share of them)
    house(k, r, -10500, ground, -31000, { lit: [0, 3, 5] });
    house(k, r, 12500, ground, -34000, { width: 10500, eaves: 5200, ridge: 3000, wall: '#cbbfae', roof: '#7c6a64', lit: [2, 4] });
    streetLamp(k, 1500, ground, -26500, { height: 5600, face: 1, power: .8 });
    for (const [x, z, h] of [[-17500, -24000, 7200], [4200, -25500, 6400], [19000, -25000, 7400], [-3800, -27500, 5600]]) tree(b, r, x, ground, z, { height: h, hex: '#58754f' });
    for (const [x, z, h] of [[6500, -24500, 6800], [-15000, -33000, 8200], [20500, -36000, 8000]]) conifer(b, r, x, ground, z, { height: h });
    for (let x = -42000; x <= 42000; x += 2600 + r() * 900) crown(b, r, x, ground + 1600 + r() * 900, -47000 - r() * 4000, 3000 + r() * 1100, 2600 + r() * 900, 2400, '#557260', { size: 1300, lobes: .2 });
}

// ---- an artist's studio garden (the creative room). A walled garden kept for working in: terracotta pots of herbs
// and geraniums on a gravel strip under the sill, a brick path running out to an arched gate in an old garden wall,
// a lawn, a vine-covered pergola with string lights, a lavender bed, an old fruit tree and a birch, a small glasshouse,
// a carved stone on a plinth and an easel left out on the grass; beyond the wall, trees and a neighbour's roof.
function pot(b, r, x, ground, z, radius, plant) {
    const clay = colour(pick(r, ['#b0674a', '#a85f45', '#b8785a', '#9c5a44'])), rim = clay.clone().multiplyScalar(1.08);
    b.add(new THREE.CylinderGeometry(radius, radius * .72, radius * 1.5, 10, 1), M(x, ground + radius * .75, z), () => clay, { ambient: .55 });
    b.add(new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, radius * .25, 10, 1), M(x, ground + radius * 1.45, z), () => rim, { ambient: .55 });
    if (plant) plant(ground + radius * 1.45);
}
function studioGarden(k, ctx) {
    const { land: b, r } = k, cx = (ctx.left + ctx.right) / 2, w = ctx.width, ground = ctx.ground - 150, sill = ctx.bottom, flip = r() < .5 ? 1 : -1;
    const lawn = colour('#6f855a'), moss = colour('#7f8f5e'), gravel = colour('#b5aa98'), brick = colour('#94705f'), out = new THREE.Color();
    // the gate's line: the path runs from near the window out to the gate in the wall
    const wallZ = -11500, gateX = cx + flip * 2600, path = z => cx + flip * 300 + (gateX - cx - flip * 300) * Math.min(1, -z / -wallZ) ** 1.4;
    groundPlane(b, ground, cx - 16000, cx + 16000, wallZ - 200, -60, 300, (x, z) => {
        if (z > -1400) return out.copy(gravel).multiplyScalar(.9 + r() * .12);
        const d = Math.abs(x - path(z)); if (d < 520) return out.copy(brick).multiplyScalar(.82 + r() * .22).lerp(moss, d > 400 ? .4 : 0);
        const patch = Math.sin(x / 1900 + 2) * Math.sin(z / 1500) * .5 + .5; return out.copy(lawn).lerp(moss, patch * .45).multiplyScalar(.92 + r() * .08);
    });
    groundPlane(b, ground - 30, -70000, 70000, -80000, wallZ - 150, 2500, () => out.copy(colour('#6c7f58')).multiplyScalar(.95 + r() * .05));
    // pots on the gravel strip under the sill: herbs, geraniums, a clipped box ball
    for (let x = cx - w / 2 - 500; x <= cx + w / 2 + 500; x += 420 + r() * 260) {
        const rad = 140 + r() * 120, z = -650 - r() * 350, kind = r();
        pot(b, r, x, ground, z, rad, top => {
            if (kind < .4) { shrub(b, r, x, top - rad * .3, z, rad * 1.2, '#6d8c5a', { size: 55 }); flowers(b, r, x, top + rad * .7, z, rad * 1.1, 14, ['#c9473e', '#d8594a', '#e07a6a', '#efe8d8'], 30); }
            else if (kind < .7) shrub(b, r, x, top - rad * .2, z, rad * 1.05, '#5f7d55', { size: 50, lobes: .1 });
            else { for (let j = 0; j < 9; j++) { const a = r() * 6.28; limb(b, V(x, top, z), V(x + Math.cos(a) * rad * .8, top + rad * (2 + r() * 1.6), z + Math.sin(a) * rad * .8), 14, '#7c9a62'); }
                flowers(b, r, x, top + rad * 2.6, z, rad * .8, 10, ['#9d8fc4', '#b7a6d8'], 22); }
        });
    }
    grass(b, r, cx - w, cx + w, -2800, -1450, ground, 700, '#6f8858', 240);
    // the lavender bed along the path, the cosmos behind it
    for (let z = -2600; z > -8200; z -= 380 + r() * 120) { const x = path(z) - flip * (950 + r() * 250);
        shrub(b, r, x, ground, z, 300 + r() * 80, '#7d8b6a', { size: 60 }); flowers(b, r, x, ground + 480, z, 320, 22, ['#8c7fc0', '#9a8cc9', '#7f73b2'], 26); }
    for (let z = -3000; z > -8800; z -= 700) { const x = path(z) - flip * (1900 + r() * 400); shrub(b, r, x, ground, z, 420 + r() * 140, '#6f8c58'); flowers(b, r, x, ground + 800, z, 420, 16, ['#e3a1b8', '#f1e7ea', '#c96a8a'], 34); }
    // the pergola on the far side of the path: posts, beams, a vine grown over it, string lights under the beams
    const px0 = cx - flip * 4200, pz0 = -3600, pz1 = -9000, wood = '#8a7058';
    for (const z of [pz0, (pz0 + pz1) / 2, pz1]) for (const dx of [-1100, 1100]) b.box([140, 2500, 140], [px0 + dx, ground + 1250, z], wood);
    for (const dx of [-1100, 1100]) b.box([160, 220, pz0 - pz1 + 600], [px0 + dx, ground + 2560, (pz0 + pz1) / 2], wood);
    for (let z = pz0 + 200; z > pz1 - 200; z -= 600) b.box([2700, 120, 90], [px0, ground + 2700, z], wood);
    for (let z = pz0; z > pz1; z -= 900 + r() * 300) crown(b, r, px0 + (r() - .5) * 1600, ground + 2850, z, 900 + r() * 300, 360, 600, '#62804c', { size: spray(z) * .8, under: .2 });
    for (const dx of [-1100, 1100]) crown(b, r, px0 + dx, ground + 1300, pz0 - 300, 260, 1200, 260, '#5f7f4a', { size: 90 });
    for (let z = pz0; z > pz1; z -= 260) { const sag = Math.sin((pz0 - z) / (pz0 - pz1) * Math.PI * 3) ** 2 * 260, y = ground + 2450 - sag;
        k.lights.box([45, 60, 45], [px0, y, z], '#ffd59a'); if (Math.round(z / 260) % 3 === 0) k.halos.add(px0, y - 20, z, 240, '#ffcf8e', .35); }
    b.light(px0, ground + 2200, (pz0 + pz1) / 2, '#ffcf8e', 4200, .8);
    // a table and two chairs under it
    b.box([1400, 40, 800], [px0, ground + 740, (pz0 + pz1) / 2], '#9a8268'); for (const s of [-1, 1]) b.box([60, 720, 60], [px0 + s * 600, ground + 360, (pz0 + pz1) / 2], '#5a4a40');
    // the old fruit tree near the window, a birch further out on the path's side, a little glasshouse
    tree(b, r, cx + flip * (w / 2 + 2200), ground, -4300, { height: 5200, hex: '#6c8a54', shape: 'spreading', bark: '#5a4a3e' });
    tree(b, r, path(-7500) + flip * 2200, ground, -7800, { height: 7200, hex: '#8aa06a', shape: 'tall', bark: '#d8d2c6' });
    const gx = cx + flip * 6800, gz = -8200, glassC = colour('#b7c6c6').multiplyScalar(.75);
    b.box([2400, 400, 1800], [gx, ground + 200, gz], '#a8705a');
    for (const s of [-1, 0, 1]) b.box([50, 2200, 50], [gx + s * 1150, ground + 1100, gz + 900], '#e2ddd2');
    b.quad(2300, 1800, [gx, ground + 1300, gz + 905], glassC); b.box([2500, 50, 1900], [gx, ground + 2220, gz], '#e2ddd2');
    k.lights.quad(1900, 1200, [gx, ground + 1250, gz + 915], colour('#ffdcaa').multiplyScalar(.45)); b.light(gx, ground + 1200, gz + 1600, '#ffd6a0', 3000, .45);
    shrub(b, r, gx - 300, ground + 400, gz + 300, 380, '#6b8b57', { size: 70 });
    // a carved stone on a plinth, an easel on the grass
    const sx = path(-6000) + flip * 1300;
    b.box([500, 700, 500], [sx, ground + 350, -6000], '#c4bdb0'); rock(b, r, sx, ground + 1050, -6000, 420, '#b9b2a6'); rock(b, r, sx + 80, ground + 1450, -6000, 260, '#aaa396');
    const ex = cx - flip * 1700, ez = -3300;
    for (const [dx, dz] of [[-300, 120], [300, 120], [0, -350]]) limb(b, V(ex + dx, ground, ez + dz), V(ex, ground + 1750, ez), 25, '#8a6a4c');
    b.box([700, 900, 30], [ex, ground + 1200, ez + 90], '#efe9dc'); b.box([560, 500, 10], [ex, ground + 1250, ez + 110], '#8fa2a8');
    // the garden wall, old brick with a coping, the arched gate where the path meets it
    masonry(b, r, -26000, gateX - 800, ground, wallZ, 2400, '#9e6e58'); masonry(b, r, gateX + 800, 26000, ground, wallZ, 2400, '#9e6e58');
    b.box([1700, 600, 380], [gateX, ground + 2700, wallZ], '#8e6a58'); b.box([1300, 2300, 60], [gateX, ground + 1150, wallZ + 20], '#4f5b4f');
    for (const s of [-1, 1]) b.box([300, 2900, 420], [gateX + s * 800, ground + 1450, wallZ], '#8e6a58');
    k.lights.box([120, 180, 120], [gateX + 1050, ground + 2200, wallZ + 300], '#ffcf8e'); k.halos.add(gateX + 1050, ground + 2200, wallZ + 400, 600, '#ffc985', .45); b.light(gateX + 1050, ground + 2000, wallZ + 1200, '#ffc985', 2800, .38);
    // climbers on the wall, shrubs along it
    for (let x = -24000; x < 24000; x += 1500 + r() * 1300) { if (Math.abs(x - gateX) < 1300) continue; shrub(b, r, x, ground, wallZ + 700, 700 + r() * 400, pick(r, ['#5d7b4e', '#6a8656', '#55724a']));
        if (r() < .4) crown(b, r, x + 500, ground + 1900, wallZ + 220, 900, 700, 250, '#5b7a4a', { size: 160 }); }
    // beyond the wall: trees, a neighbour's roof, the far wood
    house(k, r, cx - flip * 9000, ground, -26000, { width: 9000, wall: '#cfc3b0', roof: '#7d5f52', lit: [0, 4] });
    for (const [x, z, h] of [[-13000, -16000, 9000], [6000, -15500, 8000], [15500, -19000, 10000], [-3000, -20000, 7500], [22000, -14500, 8500]]) tree(b, r, cx + x * flip, ground, z, { height: h, hex: pick(r, ['#5a774d', '#617f51', '#526f48']) });
    for (const [x, z, h] of [[1500, -17500, 11000], [-20000, -22000, 12000]]) conifer(b, r, cx + x * flip, ground, z, { height: h });
    for (let x = -50000; x <= 50000; x += 2800 + r() * 900) crown(b, r, x, ground + 2000 + r() * 1200, -42000 - r() * 5000, 3200 + r() * 1100, 2900 + r() * 900, 2400, '#587361', { size: 1300, lobes: .2 });
}

// A sword fern: fronds of leaflets arching out of a clump (the north coast's forest floor).
function fern(b, r, x, ground, z, size = 700, hex = '#4f6e40') {
    const base = colour(hex), fronds = 9 + Math.floor(r() * 5);
    for (let k = 0; k < fronds; k++) {
        const a = r() * 6.28, rise = .5 + r() * .7, len = size * (.7 + r() * .5), out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a)), c = base.clone().offsetHSL(0, 0, (r() - .5) * .08);
        let prev = V(x, ground, z);
        for (let i = 1; i <= 5; i++) { const t = i / 5, p = V(x, ground, z).addScaledVector(out, len * t).add(V(0, len * (rise * t - (rise + .4) * t * t * .8) + len * .25 * t, 0)), leaf = len * .16 * (1 - t * .6);
            for (const s of [-1, 1]) b.tri(prev, p, p.clone().addScaledVector(side, s * leaf).add(V(0, -leaf * .3, 0)), c.clone().multiplyScalar(.82 + .18 * (i % 2)), .5);
            prev = p; }
    }
}

// ---- the north coast campus under a marine layer (the Humboldt commons): redwoods, ferns and rhododendrons, a damp
// lawn and concrete paths with path lights, a campus building of concrete and timber across the lawn, forested ridges
// fading into the fog. The commons has glass on three sides; each looks out on its own part of the campus.
//   facing 0 (the back wall's tall glass): the grove behind the commons, trunks near and far in the fog.
//   facing 1 (the long glass along the right: the slot, the junction and the hall): the lawn, the path, the building.
//   facing 2 (the hall end's vestibule): the entry plaza.
function humboldt(k, ctx) {
    const { land: b, r } = k, ground = ctx.ground - 120, L = ctx.left - 12000, R = ctx.right + 12000, cx = (ctx.left + ctx.right) / 2;
    const lawnC = colour('#5f7650'), moss = colour('#6c7a52'), duff = colour('#5b4a3a'), conc = colour('#a9a69e'), out = new THREE.Color();
    const near = Math.min(0, ctx.near) - 200;
    if (ctx.facing === 0) {
        // the grove: forest floor of needles and duff, ferns, a path between the trunks
        const path = x => -9000 + Math.sin(x / 5200) * 2600;
        land(b, ground, L, R, ctx.near - 60, -18000, -70000, (x, z) => { const d = Math.abs(z - path(x));
            if (d < 900) return out.copy(colour('#8c7f6c')).multiplyScalar(.9 + r() * .15); const p = Math.sin(x / 1700) * Math.sin(z / 1300) * .5 + .5; return out.copy(duff).lerp(moss, p * .6).multiplyScalar(.85 + r() * .15); });
        for (let x = ctx.left - 3000; x < ctx.right + 3000; x += 500 + r() * 400) fern(b, r, x, ground, near - 1300 - r() * 1400, 650 + r() * 350);
        for (let n = 0; n < 40; n++) { const x = L + r() * (R - L), z = -3000 - r() * 30000; if (Math.abs(z - path(x)) < 1300) continue; fern(b, r, x, ground, z, 700 + r() * 400); }
        for (let x = L; x < R; x += 9000 + r() * 4000) pathLight(k, x, ground, path(x) + 1200);
        bench(b, cx + 3800, ground, path(cx + 3800) + 1300);
        // trunks: a near pair, a middle rank, the far ones going pale in the fog; young redwoods with branches lower down
        const trunks = [[cx - 5200, -6200, 1.5], [cx + 4300, -7600, 1.25], [cx - 1200, -15500, 1.1], [cx + 9800, -13000, 1.35], [cx - 11500, -12500, 1.2],
            [cx + 2800, -23000, 1.0], [cx - 7400, -24500, 1.15], [cx + 15500, -21500, 1.0], [cx - 17500, -19500, 1.1], [cx + 7600, -32000, .95], [cx - 2500, -36000, 1.0], [cx - 14000, -34000, .9], [cx + 20000, -33000, .9]];
        for (const [x, z, g] of trunks) redwood(b, r, x, ground, z, { height: 42000 + r() * 22000, girth: g });
        for (const [x, z] of [[cx + 1200, -9500], [cx - 8500, -17500], [cx + 12500, -26500], [cx - 3800, -28500]]) redwood(b, r, x, ground, z, { height: 14000 + r() * 5000, girth: .4, start: .1 });
        for (let x = L - 20000; x < R + 20000; x += 4500 + r() * 2500) redwood(b, r, x, ground, -48000 - r() * 12000, { height: 45000, girth: 1.1, start: .18, size: 2300 });
        return;
    }
    if (ctx.facing === 2) {
        // the entry plaza: concrete paving, bike racks, bollard lights, a pair of redwoods, the campus path beyond
        land(b, ground, L, R, ctx.near - 60, -14000, -60000, (x, z) => z > -9000 ? out.copy(conc).multiplyScalar((Math.floor(x / 1500) + Math.floor(z / 1500)) % 2 ? .92 : 1) : out.copy(lawnC).multiplyScalar(.9 + r() * .1));
        for (let x = cx - 3000; x <= cx + 3000; x += 750) { limb(b, V(x, ground, -4200), V(x, ground + 800, -4200), 25, '#8d9296'); limb(b, V(x, ground + 800, -4200), V(x + 500, ground + 800, -4200), 25, '#8d9296'); limb(b, V(x + 500, ground + 800, -4200), V(x + 500, ground, -4200), 25, '#8d9296'); }
        for (const x of [cx - 6000, cx + 6000]) pathLight(k, x, ground, -6000);
        for (const x of [cx - 9000, cx + 8000]) redwood(b, r, x, ground, -11000, { height: 48000, girth: 1.2 });
        for (let x = L; x < R; x += 1600 + r() * 900) shrub(b, r, x, ground, -9600 - r() * 600, 800 + r() * 300, pick(r, ['#4e6a44', '#5a7449', '#46613f']));
        for (const x of [cx - 4500, cx + 4500]) streetLamp(k, x, ground, -10500, { height: 4500, reach: 300 });
        for (let x = L - 20000; x < R + 20000; x += 5000 + r() * 3000) redwood(b, r, x, ground, -30000 - r() * 15000, { height: 45000, girth: 1, start: .2, size: 2000 });
        return;
    }
    // facing 1: along the long glass. Planting right outside, a concrete path, the lawn, the building across, the trees.
    land(b, ground, L, R, Math.max(...ctx.openings.map(o => o.z)) - 60, -16000, -80000, (x, z) => {
        if (z > near - 1800) return out.copy(duff).lerp(moss, .4).multiplyScalar(.9 + r() * .12);
        if (z > near - 4200) return out.copy(conc).multiplyScalar(Math.abs((x % 1800 + 1800) % 1800) < 40 ? .7 : .95 + r() * .06);
        const p = Math.sin(x / 2300) * Math.sin(z / 1900) * .5 + .5; return out.copy(lawnC).lerp(moss, p * .4).multiplyScalar(.9 + r() * .1); });
    for (let x = ctx.left - 1500; x < ctx.right + 1500; x += 700 + r() * 700) { const z = near - 1500 - r() * 700;
        if (r() < .3) shrub(b, r, x, ground, z, 700 + r() * 300, pick(r, ['#3f5a3c', '#47603f']), { size: 110 }); else fern(b, r, x, ground, z, 600 + r() * 300);
        if (r() < .12) flowers(b, r, x, ground + 1000, z, 650, 40, ['#b86a7e', '#c98a9a', '#a85a6e'], 32); }
    for (let x = ctx.left; x < ctx.right; x += 12000) pathLight(k, x + 3000, ground, near - 4600);
    // the lawn's trees: young redwoods and a big-leaf maple or two
    for (let x = ctx.left - 4000; x < ctx.right + 4000; x += 11000 + r() * 5000) {
        if (r() < .6) redwood(b, r, x, ground, -14000 - r() * 6000, { height: 26000 + r() * 12000, girth: .7, start: .12 });
        else tree(b, r, x, ground, -12000 - r() * 5000, { height: 11000, hex: '#5f7a48', shape: 'round' });
    }
    // the building across the lawn: concrete frame, timber infill, lit after dark
    const by = -36000;
    for (let x = ctx.left - 6000; x < ctx.right + 6000; x += 30000) {
        building(k, r, x + 12000, ground, by, { width: 26000, depth: 16000, floors: 3, storey: 3800, wall: '#a9a59c', glass: '#36424a', frame: '#9b9890', shops: false, litRate: .3, warm: .6, cornice: false, bays: 8, style: 'band', fins: '#7a5e48', roof: '#5f5b55' });
        b.box([26000, 400, 1600], [x + 12000, ground + 11500, by + 8600], '#8d8a83');
    }
    for (let x = ctx.left - 8000; x < ctx.right + 8000; x += 9000) streetLamp(k, x, ground, -26000, { height: 4500, reach: 300, power: .8 });
    for (let x = L - 30000; x < R + 30000; x += 6000 + r() * 4000) redwood(b, r, x, ground, -48000 - r() * 14000, { height: 50000, girth: 1.1, start: .15, size: 2300 });
    ridge(b, r, -76000, ground, L - 40000, R + 40000, 14000, '#4a5d52', { step: 2500 });
}

// ---- Southern California, near the coast: palms, stucco and concrete, bright hazy air.
// An agave or aloe: a rosette of stiff pointed leaves.
function agave(b, r, x, ground, z, size = 500, hex = '#7f9a84') {
    const c = colour(hex);
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28 + r() * .3, up = .3 + r() * .9, len = size * (.7 + r() * .5), d = V(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up)), side = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(size * .09);
        const o = V(x, ground + 40, z), tip = o.clone().addScaledVector(d, len); b.tri(o.clone().add(side), o.clone().sub(side), tip, c.clone().multiplyScalar(.85 + r() * .25), .5); }
}
// A stadium light standard: a tall pole and a bank of lamps that floods the field after dark.
function floodlight(k, x, ground, z, height = 21000, aim = 1) {
    const { land: b, lights, halos } = k; pole(b, x, ground, z, height, 240, '#8e9296');
    b.box([3200, 2200, 300], [x, ground + height + 900, z], '#6b7074');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) lights.box([560, 420, 40], [x - 1200 + j * 800, ground + height + 300 + i * 650, z + aim * 170], '#f4f1e8');
    halos.add(x, ground + height + 900, z + aim * 600, 4200, '#efeee6', .4);
    b.light(x, ground + 600, z + aim * 22000, '#e8ece8', 32000, .55);
}
// An oil pumpjack (Huntington Beach: the Oilers): a base, a samson post, the walking beam and its horse head.
function pumpjack(b, x, ground, z, turn = 0, s = 1) {
    const R = new THREE.Matrix4().makeRotationY(turn), put = (size, p, hex, rz = 0) => { const c = colour(hex); b.add(new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4().makeTranslation(x, ground, z).multiply(R).multiply(new THREE.Matrix4().compose(V(p[0] * s, p[1] * s, p[2] * s), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rz), V(size[0] * s, size[1] * s, size[2] * s))), () => c, { ambient: .5 }); };
    put([6000, 400, 1600], [0, 200, 0], '#6e6a62');
    put([300, 4200, 300], [0, 2300, 500], '#4f5a5e', .12); put([300, 4200, 300], [0, 2300, -500], '#4f5a5e', .12); put([300, 4200, 300], [700, 2300, 0], '#4f5a5e', -.25);
    put([6400, 450, 380], [-300, 4500, 0], '#3c4448', .08); put([900, 1900, 450], [-3500, 4000, 0], '#3c4448', .2);
    put([1600, 1600, 900], [2400, 1200, 0], '#7d3f34'); limb(b, V(x - 3800 * s * Math.cos(turn), ground + 3200 * s, z + 3800 * s * Math.sin(turn)), V(x - 3800 * s * Math.cos(turn), ground + 400 * s, z + 3800 * s * Math.sin(turn)), 25 * s, '#2d2d2d', {});
}
// A bank of aluminium bleachers, rising away from the field.
function bleachers(b, x0, x1, ground, z, rows = 12) {
    for (let i = 0; i < rows; i++) { b.box([x1 - x0, 80, 380], [(x0 + x1) / 2, ground + 450 + i * 420, z - i * 760], '#b9bcbd'); b.box([x1 - x0, 420, 30], [(x0 + x1) / 2, ground + 240 + i * 420, z - i * 760 + 200], '#7f8487'); }
    for (let x = x0; x <= x1; x += 4000) limb(b, V(x, ground, z), V(x, ground + rows * 420 + 200, z - rows * 760), 60, '#8e9296', {});
    b.box([x1 - x0, 1100, 40], [(x0 + x1) / 2, ground + rows * 420 + 900, z - rows * 760 - 200], '#8e9296');
}
// A mid-century campus block: concrete frame, ribbon windows behind sunshade fins, a covered walk along its foot.
function campusBlock(k, r, x, ground, z, { width = 36000, floors = 3, wall = '#ddd6c8', fins = '#c9c1b2', lit = .4 } = {}) {
    const b = k.land, h = building(k, r, x, ground, z, { width, depth: 18000, floors, storey: 4000, wall, glass: '#3d4a52', frame: '#bfb8aa', shops: false, style: 'band', bays: Math.round(width / 3600), litRate: lit, cornice: false, roof: '#cfc8ba' });
    const face = z + 9000;
    for (let f = 0; f < floors; f++) b.box([width, 140, 900], [x, ground + 4000 * f + 3600, face + 450], fins);
    for (let i = 0; i <= width / 1800; i++) b.box([120, h - 400, 600], [x - width / 2 + i * 1800, ground + (h - 400) / 2, face + 300], fins);
    b.box([width, 220, 3200], [x, ground + 3000, face + 1600], '#d4cec2'); for (let i = 0; i <= width / 4500; i++) pole(b, x - width / 2 + i * 4500, ground, face + 3000, 3000, 90, '#9a948a');
    for (let i = 0; i < width / 4500; i++) { const lx = x - width / 2 + (i + .5) * 4500; k.lights.box([300, 30, 300], [lx, ground + 2870, face + 1600], '#fff0d6'); k.land.light(lx, ground + 2600, face + 1600, '#ffe8c8', 3200, .45); }
}
function socal(k, ctx, kind) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, w = ctx.width, L = ctx.left - 30000, R = ctx.right + 30000;
    const lawnC = colour('#7d8a62'), dry = colour('#a39d7c'), conc = colour('#c3bcae'), track = colour('#9a5a48'), out = new THREE.Color();
    if (kind === 'campus') {
        // Orange Coast College from the media lab, a floor up: a planted strip and the walk below, the quad with its
        // jacarandas and benches, palms along the walk, the block across the quad, a car park beyond, the hills in the haze.
        const walk = z => z > -4500 && z < -1800, quadEnd = -42000;
        land(b, ground, L, R, -60, -30000, -100000, (x, z) => {
            if (walk(z) || (Math.abs(x - cx - 4000) < 1500 && z > quadEnd + 9000)) return out.copy(conc).multiplyScalar((Math.floor(x / 1500) % 2 ? .95 : 1) * (.96 + r() * .05));
            if (z > -1800) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
            if (z > quadEnd) { const p = Math.sin(x / 2600) * Math.sin(z / 2100) * .5 + .5; return out.copy(lawnC).lerp(dry, p * .3).multiplyScalar(.93 + r() * .07); }
            if (z > quadEnd - 30000) return out.copy(colour('#56585a')).multiplyScalar((Math.abs(((x % 2700) + 2700) % 2700) < 90) ? 1.7 : .95 + r() * .08);
            return out.copy(dry).multiplyScalar(.9 + r() * .1); }, 600);
        for (let x = ctx.left - 6000; x < ctx.right + 6000; x += 900 + r() * 700) { if (r() < .5) agave(b, r, x, ground, -900 - r() * 600, 450 + r() * 300, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a'])); else shrub(b, r, x, ground, -1000 - r() * 500, 450 + r() * 200, pick(r, ['#5f7a4c', '#6c8452']), { size: 120 }); }
        for (let x = ctx.left - 12000; x < ctx.right + 12000; x += 9000) { featherPalm(b, r, x + r() * 2000, ground, -6000 - r() * 1500, { height: 7000 + r() * 2500 }); pathLight(k, x + 4500, ground, -5000); }
        for (let x = ctx.left - 4000; x < ctx.right + 8000; x += 6000 + r() * 4000) bench(b, x, ground, -5200, 0, '#b8b2a6');
        // the quad's trees: jacarandas (lilac in flower, green otherwise) and a coral tree, tall fan palms along the far walk
        for (const [x, z, h] of [[-9000, -15000, 8000], [7000, -18000, 9000], [-2000, -26000, 8500], [15000, -27000, 9500], [-17000, -24000, 8000], [24000, -16000, 8500]]) {
            tree(b, r, cx + x, ground, z, { height: h, hex: r() < .55 ? '#8f86b0' : '#6e8656', shape: 'spreading', bark: '#6f655c' }); }
        for (let x = L; x < R; x += 7000 + r() * 2000) fanPalm(b, r, x, ground, quadEnd + 6000 + r() * 1500, { height: 17000 + r() * 6000 });
        campusBlock(k, r, cx - 6000, ground, quadEnd - 9000, { width: 52000, floors: 3 });
        for (let x = L - 20000; x < R + 20000; x += 5200 + r() * 1200) if (r() < .7) car(k, r, x, ground, quadEnd - 24000 - Math.floor(r() * 3) * 6000);
        for (let x = L - 20000; x < R + 20000; x += 30000) floodlight(k, x, ground, quadEnd - 27000, 11000);
        for (let x = L - 60000; x < R + 60000; x += 5000 + r() * 5000) fanPalm(b, r, x, ground, -80000 - r() * 20000, { height: 20000 + r() * 6000 });
        ridge(b, r, -160000, ground, L - 120000, R + 120000, 16000, '#9a8f84', { step: 4000, rough: .5, bumps: 5 });
        return;
    }
    // Huntington Beach High from a ground-floor classroom: succulents and a walk outside, the fence, the track and the
    // field with its goalposts, bleachers across, the floodlights, palms in rows behind, the town's low roofs, a pumpjack.
    const fenceZ = -5200, trackZ = -9000, fieldZ0 = -16000, fieldZ1 = -64000, fieldX = cx + 6000;
    land(b, ground, L, R, -60, -30000, -110000, (x, z) => {
        if (z > -3200) return out.copy(conc).multiplyScalar(.95 + r() * .05);
        if (z > fenceZ) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
        const dz = Math.max(fieldZ1 - z, z - fieldZ0, 0), inside = Math.abs(x - fieldX) < 34000 && z < fieldZ0 && z > fieldZ1;
        if (z < trackZ && z > fieldZ1 - 7000 && Math.abs(x - fieldX) < 40000 && !inside) { const lane = Math.abs(((z - trackZ) % 1220 + 1220) % 1220) < 50; return lane ? out.set(.85, .82, .78) : out.copy(track).multiplyScalar(.92 + r() * .08); }
        if (inside) { const yard = Math.abs(((x - fieldX) % 4570 + 4570) % 4570) < 70 || Math.abs(z - fieldZ0) < 90 || Math.abs(z - fieldZ1) < 90;
            return yard ? out.set(.82, .82, .78) : out.copy(lawnC).multiplyScalar(((Math.floor((x - fieldX) / 4570) % 2) ? .92 : 1.02) * (.96 + r() * .04)); }
        void dz; return out.copy(lawnC).lerp(dry, .4).multiplyScalar(.9 + r() * .1); }, 600);
    for (let x = ctx.left - 4000; x < ctx.right + 4000; x += 600 + r() * 500) agave(b, r, x, ground, -800 - r() * 700, 380 + r() * 260, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a', '#8e9a6a']));
    grass(b, r, ctx.left - 3000, ctx.right + 3000, -4700, -3400, ground, 300, '#7d8a5a', 260);
    fence(b, r, L, R, ground, fenceZ, { kind: 'chain', height: 2400 });
    for (const x of [fieldX - 50000, fieldX + 50000]) { limb(b, V(x, ground, fieldZ0 - 24000), V(x, ground + 3000, fieldZ0 - 24000), 90, '#d8c24a'); b.box([5600, 120, 120], [x, ground + 3000, fieldZ0 - 24000], '#d8c24a'); for (const s of [-1, 1]) pole(b, x + s * 2800, ground + 3000, fieldZ0 - 24000, 6000, 50, '#d8c24a'); }
    bleachers(b, fieldX - 30000, fieldX + 30000, ground, fieldZ1 - 9000, 14);
    b.box([12000, 3200, 3000], [fieldX, ground + 1600 + 14 * 420, fieldZ1 - 9000 - 14 * 760 - 1500], '#c9c2b4');
    for (const x of [fieldX - 38000, fieldX + 38000]) for (const z of [fieldZ0 + 2000, fieldZ1 - 4000]) floodlight(k, x, ground, z, 22000, z > -30000 ? -1 : 1);
    for (let x = L - 30000; x < R + 30000; x += 6000 + r() * 2500) fanPalm(b, r, x, ground, fieldZ1 - 22000 - r() * 5000, { height: 18000 + r() * 6000 });
    for (let x = ctx.left - 14000; x < ctx.right + 14000; x += 11000 + r() * 3000) tree(b, r, x, ground, -7000 - r() * 1500, { height: 6500, hex: '#6c8452', shape: 'round' });
    for (let x = L - 40000; x < R + 40000; x += 12000 + r() * 6000) house(k, r, x, ground, -112000 - r() * 8000, { width: 9000, eaves: 3000, ridge: 1800, wall: pick(r, ['#e6dcc8', '#d9cdb5', '#efe6d4', '#cfc6b4']), roof: pick(r, ['#a8644a', '#9c5e48', '#8a7a6a']), lit: [0, 2], storeys: 1, porch: false });
    pumpjack(b, cx - 34000, ground, -40000, .6, 1.1);
    for (let x = L - 80000; x < R + 80000; x += 6000 + r() * 6000) fanPalm(b, r, x, ground, -135000 - r() * 20000, { height: 22000 });
}
const SOCAL = { morning: { horizon: '#ebdcc6', air: '#e6dccb', haze: .5 }, afternoon: { horizon: '#e4e4da', air: '#dfe0d8', haze: .45, tint: [1, .98, .93] } };

export const SCENES = {
    garden: { build: garden, storey: 0 },
    'studio-garden': { build: studioGarden, storey: 0, hazeFar: 46000 },
    // the marine layer: a low grey sky that burns off by afternoon, the air thick with it, the trunks going pale with distance
    humboldt: { build: humboldt, storey: 0, hazeFar: 34000, lampLevel: .7, haloLevel: 1.2, hours: {
        morning: { tint: [.86, .88, .86], zenith: '#a3b0b8', horizon: '#d5d8d4', sun: [-50, 16, '#f2eee2', .22], clouds: .95, haze: .62, air: '#c9cfcd' },
        afternoon: { tint: [.94, .95, .92], zenith: '#8aa5bb', horizon: '#d6dcdc', sun: [45, 42, '#fff6e6', .35], clouds: .7, haze: .52, air: '#cdd4d4' },
        evening: { tint: [.62, .56, .55], zenith: '#56607c', horizon: '#b99a8a', sun: [36, 6, '#ffb07a', .6], clouds: .8, haze: .66, air: '#9a8c86' },
        night: { tint: [.09, .11, .15], zenith: '#0d1420', horizon: '#26303a', clouds: .9, haze: .6, air: '#1e2730', stars: .15 },
        party: { tint: [.12, .12, .2], zenith: '#151a32', horizon: '#33304e', clouds: .85, haze: .6, air: '#262640', stars: .1 } } },
    'socal-campus': { build: (k, ctx) => socal(k, ctx, 'campus'), storey: 4200, hazeFar: 110000, hours: SOCAL }
};
