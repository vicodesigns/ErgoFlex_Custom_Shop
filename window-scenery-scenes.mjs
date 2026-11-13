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

export const SCENES = {
    garden: { build: garden, storey: 0 },
    'studio-garden': { build: studioGarden, storey: 0, hazeFar: 46000 }
};
