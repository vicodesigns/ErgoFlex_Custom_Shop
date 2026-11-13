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
import { BOX as BOX_UNIT, QUAD, colour, M, ground as groundPlane, ridge, crown, tree, conifer, redwood, fanPalm, featherPalm, shrub, hedge, flowers, grass, rock, house, building, streetLamp, car, bench, pathLight, utilityPole, wire, fence, masonry, pole, limb, spray } from './window-scenery-kit.mjs?v=polish-20261113a';

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

// ---- other back gardens (the bedroom, the kitchen, the child's room): the same kind of place as the home room's,
// laid out by the seed (mirrored, trees and sheds moved) and with what stands nearest the glass its own:
//   'bedroom': upstairs; a porch roof of tiles under the sill, the garden seen from above, a patio with a parasol.
//   'kitchen': herb boxes on the sill, raised vegetable beds, a greenhouse, a compost bin, bean poles.
//   'kids': a swing set, a trampoline, a sandpit, a tree with a tree house.
function backGarden(k, ctx) {
    const { land: b, r } = k, cx = (ctx.left + ctx.right) / 2, w = ctx.width, ground = ctx.ground - 200, sill = ctx.bottom, f = r() < .5 ? 1 : -1, jit = s => (r() - .5) * s, v = ctx.variant;
    const grassC = colour('#71855d'), dry = colour('#8a9a6a'), gravel = colour('#b3a998'), soil = colour('#5e4a3a'), out = new THREE.Color();
    const lawnAt = (x, z) => { const patch = Math.sin(x / 2900 + r() * .2) * Math.sin(z / 2300) * .5 + .5; return out.copy(grassC).lerp(dry, patch * .4).multiplyScalar(.92 + r() * .08); };
    land(b, ground, cx - 26000, cx + 26000, -60, -16000, -56000, (x, z) => z > -2600 ? out.copy(gravel).multiplyScalar(.92 + r() * .1) : lawnAt(x, z), 500);
    if (v === 'bedroom') {   // the porch roof under the window: clay tiles sloping away, a gutter
        const eave = sill - 1500, geo = new THREE.PlaneGeometry(w + 4000, 1300, 8, 6).rotateX(-Math.PI / 2 + .5), tile = colour('#5d5f62');
        b.add(geo, M(cx, eave + 280, -700), p => tile.clone().multiplyScalar(.85 + .15 * Math.sin(p.z / 90) * Math.sin(p.x / 140)), { ambient: .6 }); geo.dispose();
        b.box([w + 4000, 110, 130], [cx, eave - 30, -1300], '#4f4d4b');
        const px = cx + f * 3200, pz = -6500; b.box([4200, 40, 3600], [px, ground + 20, pz], '#bdb3a2'); b.box([1100, 720, 1100], [px, ground + 360, pz], '#e2ddd2');
        pole(b, px, ground, pz, 2300, 30, '#d8d2c4'); b.add(new THREE.ConeGeometry(1500, 500, 10, 1, true), M(px, ground + 2450, pz), () => colour('#9c8c74'), { ambient: .6 });
    }
    if (v === 'kitchen') {   // herb boxes on the sill outside, raised beds, bean poles, a greenhouse, a compost bin
        b.box([w + 200, 220, 260], [cx, sill - 130, -330], '#7a5c46');
        for (let x = cx - w / 2; x <= cx + w / 2; x += 170 + r() * 80) shrub(b, r, x, sill - 60, -330, 90 + r() * 60, pick(r, ['#6a8a52', '#5c7c4a', '#7f9a60']), { size: 30 });
        for (let i = 0; i < 6; i++) { const bx = cx - 5400 + (i % 3) * 3600 + jit(400), bz = -4200 - Math.floor(i / 3) * 3000;
            b.box([2800, 450, 1200], [bx, ground + 225, bz], '#8a6e54'); b.box([2700, 40, 1100], [bx, ground + 455, bz], soil);
            const crop = pick(r, ['#5f8a4c', '#7a9a52', '#4f7a48', '#8aa060']);
            for (let x = bx - 1150; x <= bx + 1150; x += 280) { if (i === 2) { limb(b, V(x, ground + 450, bz), V(x + 60, ground + 2300, bz), 12, '#8a7458'); crown(b, r, x + 30, ground + 1500, bz, 160, 700, 160, '#5f8a4c', { size: 70, core: 0 }); }
                else shrub(b, r, x, ground + 460, bz + jit(300), 150 + r() * 80, crop, { size: 45 }); } }
        const gx = cx - f * 7000, gz = -10500; b.box([3000, 300, 2200], [gx, ground + 150, gz], '#9e6e58');
        for (const s of [-1, 0, 1]) b.box([40, 2300, 40], [gx + s * 1450, ground + 1150, gz + 1100], '#e2ddd2');
        b.quad(2900, 2000, [gx, ground + 1300, gz + 1110], colour('#b9c8c6').multiplyScalar(.72)); b.box([3100, 40, 2300], [gx, ground + 2320, gz], '#e2ddd2');
        b.box([900, 1000, 900], [cx + f * 5500, ground + 500, -8800], '#3f4a3c');
    }
    if (v === 'kids') {   // a swing set, a trampoline, a sandpit, a tree house
        const sx = cx + f * 2600, sz = -5200;
        for (const s of [-1, 1]) { limb(b, V(sx + s * 1500, ground, sz - 900), V(sx + s * 1500, ground + 2300, sz), 45, '#c24f3e'); limb(b, V(sx + s * 1500, ground, sz + 900), V(sx + s * 1500, ground + 2300, sz), 45, '#c24f3e'); }
        b.box([3200, 90, 90], [sx, ground + 2300, sz], '#c24f3e');
        for (const s of [-.5, .5]) { for (const d of [-200, 200]) limb(b, V(sx + s * 1500 + d, ground + 2280, sz), V(sx + s * 1500 + d, ground + 500, sz), 8, '#4a4a4a'); b.box([500, 40, 220], [sx + s * 1500, ground + 480, sz], '#2f5d8a'); }
        const tx = cx - f * 3300, tz = -7600; b.add(new THREE.CylinderGeometry(1700, 1700, 120, 18, 1), M(tx, ground + 750, tz), () => colour('#2a2c30'), { ambient: .6 });
        b.add(new THREE.CylinderGeometry(1800, 1800, 160, 18, 1, true), M(tx, ground + 760, tz), () => colour('#3a6a9a'), { ambient: .6 });
        for (let a = 0; a < 6.28; a += 1.05) limb(b, V(tx + Math.cos(a) * 1750, ground, tz + Math.sin(a) * 1750), V(tx + Math.cos(a) * 1750, ground + 760, tz + Math.sin(a) * 1750), 25, '#6d7074');
        b.box([2000, 200, 2000], [cx + f * 600, ground + 100, -3600], '#a67e5a'); b.box([1800, 40, 1800], [cx + f * 600, ground + 190, -3600], '#e0d2a8');
        const hx = cx + f * 7600, hz = -10500; tree(b, r, hx, ground, hz, { height: 7500, hex: '#617f4f', shape: 'spreading' });
        b.box([1800, 1300, 1600], [hx, ground + 3300, hz + 400], '#9a7a5a'); b.box([2100, 120, 1900], [hx, ground + 4000, hz + 400], '#6a4e3c'); b.quad(500, 500, [hx, ground + 3400, hz + 1210], colour('#2a2a2a'));
        for (let y = 300; y < 2700; y += 300) b.box([600, 40, 40], [hx - 300, ground + y, hz + 1300], '#8a6a4c');
    }
    // trees, a shed, a flower bed, the fence and hedge at the end, lights after dark
    for (const [x, z, h, shape] of [[w * .5 + 3200 + jit(1500), -6500 + jit(1500), 5800, 'round'], [-w * .5 - 4600 + jit(1500), -9500 + jit(2000), 4800, 'ornamental'], [jit(9000), -13200 + jit(1200), 6200, 'round']])
        tree(b, r, cx + f * x, ground, z, { height: h + jit(1200), hex: pick(r, ['#688856', '#5f7d53', '#7f9566', '#5a7a50']), shape });
    house(k, r, cx - f * (8000 + jit(3000)), ground, -12500, { width: 3600, depth: 2600, eaves: 2200, ridge: 900, wall: pick(r, ['#7f8e7c', '#8e7a68', '#6f7f8c']), roof: '#4f4c4a', lit: [], porch: false, storeys: 1 });
    for (let j = 0; j < 12; j++) { const z = -3000 - j * 700, x = cx + f * (w * .5 + 1800 + Math.sin(j * 1.3) * 300); shrub(b, r, x, ground, z, 320 + r() * 140, '#6b8a58'); if (r() < .6) flowers(b, r, x, ground + 420, z, 300, 10, undefined, 30); }
    const fz = -15000 + jit(1500);
    fence(b, r, cx - 26000, cx + 26000, ground, fz, { hex: pick(r, ['#9a7d62', '#8a7f72', '#a08670']) }); hedge(b, r, cx - 26000, cx + 26000, ground, fz + 700, 2000 + r() * 600, 1100, '#53704d');
    for (const x of [cx - f * 3500, cx + f * 4500]) pathLight(k, x, ground, -2900, '#ffd9a8', .45);
    house(k, r, cx + f * (-9000 + jit(4000)), ground, -30000 + jit(4000), { lit: [0, 2, 4], wall: pick(r, ['#d6cab5', '#cbbfae', '#c8c2b6', '#d9cfbd']), roof: pick(r, ['#96705e', '#7c6a64', '#6e6058']) });
    house(k, r, cx + f * (12000 + jit(4000)), ground, -33000 + jit(3000), { width: 10000, eaves: 5200, ridge: 2800, wall: pick(r, ['#cbbfae', '#bdb5a5']), roof: '#7c6a64', lit: [1, 3] });
    streetLamp(k, cx + f * 2000 + jit(4000), ground, -26000, { height: 5600, face: 1, power: .8 });
    for (let i = 0; i < 6; i++) { const x = cx + jit(44000), z = -22000 - r() * 10000; if (r() < .7) tree(b, r, x, ground, z, { height: 6000 + r() * 2500, hex: '#58754f' }); else conifer(b, r, x, ground, z, { height: 7000 + r() * 2000 }); }
    for (let x = cx - 44000; x <= cx + 44000; x += 2600 + r() * 900) crown(b, r, x, ground + 1700 + r() * 900, -47000 - r() * 4000, 3000 + r() * 1100, 2600 + r() * 900, 2400, '#557260', { size: 1300, lobes: .2 });
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

// ---- a city street (the gym, the music room; the neon version for the gaming room). Our building's front: a planter
// and railings, the pavement with plane trees and street lamps, a road with parked cars, the far pavement, a row of
// four- to seven-storey buildings with shops at street level, taller blocks behind them, towers far off in the haze.
// The storey (the room's floor above the street) decides how much of the street is seen. After dark: lamps and their
// pools, lit windows and shopfronts, the odd car's lights; neon: signs over the shops and on the towers, a violet glow.
const QUAD_FLAG = new THREE.PlaneGeometry(1, 1);
const NEON = ['#ff4fa8', '#46d6ff', '#a066ff', '#ff9a4a', '#5cf0a8'];
function city(k, ctx, { neon = false } = {}) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, L = ctx.left - 30000, R = ctx.right + 30000;
    const kerb = -5200, far = -15400, across = -19000, asphalt = colour('#4a4c50'), paving = colour('#a29d94'), out = new THREE.Color();
    // a side street runs away from the window's line across the road: a view between the blocks to the towers
    // variant: what stands nearest the glass ('balcony', 'ledge', 'glass' balustrade, 'planters' on a terrace) and what
    // is across the street ('civic': a plaza with flagpoles before a stone building with a portico; 'hospital': a
    // forecourt with a drop-off canopy before a white medical block), joined with '+'
    const opts = (ctx.variant || '').split('+'), civic = opts.includes('civic'), hospital = opts.includes('hospital'), plaza = civic || hospital;
    const crossX = cx + (r() - .5) * 5000, crossW = plaza ? 0 : 11000, inCross = (x, pad = 0) => !plaza && Math.abs(x - crossX) < crossW / 2 + pad;
    const fill = (x, z) => {
        if (z < far - 2600 && inCross(x)) { const lane = Math.abs(x - crossX) < 70 && (z % 6000 + 6000) % 6000 < 3000; return lane ? out.set(.62, .6, .52) : Math.abs(x - crossX) > crossW / 2 - 2600 ? out.copy(paving).multiplyScalar(.95) : out.copy(asphalt).multiplyScalar(.92 + r() * .1); }
        if (z > kerb) return out.copy(paving).multiplyScalar((Math.floor(x / 900) + Math.floor(z / 900)) % 2 ? .94 : 1).multiplyScalar(.95 + r() * .05);
        if (z > kerb - 250 || (z < far && z > far - 250)) return out.copy(paving).multiplyScalar(1.08);
        if (z > far) { const lane = Math.abs(z - (kerb + far) / 2) < 70 && (x % 6000 + 6000) % 6000 < 3000; return lane ? out.set(.62, .6, .52) : out.copy(asphalt).multiplyScalar(.92 + r() * .1); }
        return out.copy(paving).multiplyScalar(.92 + r() * .06); };
    land(b, ground, L, R, -60, -24000, -90000, fill, 600);
    // our side: a planter and railings against the building (seen from the ground floor), then the pavement
    if (ctx.storey < 2500 && !opts.includes('open') && !opts.includes('dock')) {
        b.box([ctx.width + 6000, 450, 900], [cx, ground + 225, -700], '#8f8a82');
        for (let x = ctx.left - 3000; x < ctx.right + 3000; x += 420 + r() * 200) shrub(b, r, x, ground + 450, -700 + (r() - .5) * 300, 230 + r() * 120, pick(r, ['#58744c', '#4f6b47', '#62804f']), { size: 70 });
        for (let x = ctx.left - 3000; x <= ctx.right + 3000; x += 130) b.box([22, 1000, 22], [x, ground + 950, -1250], '#2e3134');
        b.box([ctx.width + 6000, 40, 50], [cx, ground + 1450, -1250], '#2e3134');
    }
    // right outside the glass, on the room's own floor
    const fy = ctx.floor, span = ctx.width + 3000, metal = '#3a3d40';
    if (opts.includes('balcony') || opts.includes('glass')) {
        b.box([span, 220, 1600], [cx, fy - 110, -880], '#a9a59d');
        if (opts.includes('glass')) { for (let x = cx - span / 2; x <= cx + span / 2; x += 1500) b.box([50, 1050, 50], [x, fy + 525, -1640], '#9aa0a4'); b.box([span, 50, 70], [cx, fy + 1060, -1640], '#9aa0a4'); }
        else { for (let x = cx - span / 2; x <= cx + span / 2; x += 120) b.box([18, 1000, 18], [x, fy + 500, -1640], metal); b.box([span, 40, 60], [cx, fy + 1020, -1640], metal);
            b.box([500, 450, 500], [cx + span * .3, fy + 225, -1100], '#7d5f4a'); shrub(b, r, cx + span * .3, fy + 450, -1100, 320, '#5f7d4c', { size: 60 });
            b.box([480, 40, 480], [cx - span * .28, fy + 440, -1000], '#4a4c4e'); b.box([480, 480, 40], [cx - span * .28, fy + 680, -1230], '#4a4c4e'); }
    }
    if (opts.includes('louvres')) for (let x = ctx.left - 1500; x <= ctx.right + 1500; x += 900) b.box([55, ctx.height + 1600, 380], [x, (ctx.top + ctx.bottom) / 2, -450], '#8f8d88');
    if (opts.includes('flowerbox')) { b.box([ctx.width + 300, 320, 380], [cx, ctx.bottom - 170, -300], '#6e5a48');
        for (let x = ctx.left; x <= ctx.right; x += 220) { shrub(b, r, x, ctx.bottom - 40, -300, 120, '#5f7d4c', { size: 40 }); flowers(b, r, x, ctx.bottom + 120, -300, 110, 5, ['#c8504a', '#e8e0d0', '#d88a9a'], 26); } }
    if (opts.includes('bars')) { for (let x = ctx.left - 100; x <= ctx.right + 100; x += 160) b.box([24, ctx.height + 200, 24], [x, (ctx.top + ctx.bottom) / 2, -260], '#2c2e30');
        for (const y of [ctx.bottom - 60, ctx.top + 60]) b.box([ctx.width + 300, 50, 40], [cx, y, -260], '#2c2e30'); }
    if (opts.includes('open')) { bench(b, cx + span * .25, ground, -1800, 0, '#4a4c4e'); for (let i = 0; i < 3; i++) { const x = cx - span * .3 + i * 900; limb(b, V(x, ground, -2600), V(x, ground + 800, -2600), 25, '#3a3d40'); limb(b, V(x, ground + 800, -2600), V(x + 600, ground + 800, -2600), 25, '#3a3d40'); limb(b, V(x + 600, ground + 800, -2600), V(x + 600, ground, -2600), 25, '#3a3d40'); }
        b.box([600, 900, 400], [cx - span * .05, ground + 450, -1500], '#2f3a36'); }
    if (opts.includes('dock')) { b.box([span + 6000, ctx.storey, 2600], [cx, ground + ctx.storey / 2, -1360], '#9d9a92'); b.box([span + 6000, 120, 160], [cx, ground + ctx.storey, -2560], '#c9a83a');
        for (let x = cx - span / 2 - 2000; x <= cx + span / 2 + 2000; x += 2400) b.box([220, 1000, 220], [x, ground + ctx.storey + 500, -2300], '#d8b43a'); }
    if (opts.includes('ledge')) { b.box([span, 160, 420], [cx, ctx.bottom - 110, -300], '#b5ad9f'); b.box([span, 320, 120], [cx, ctx.bottom - 330, -150], '#a8a092'); }
    if (opts.includes('planters')) { b.box([span, 200, 2400], [cx, fy - 100, -1300], '#8f8a82');
        for (let x = cx - span / 2 + 600; x < cx + span / 2; x += 2200) { b.box([1600, 600, 700], [x, fy + 300, -2100], '#6e6a64'); shrub(b, r, x, fy + 600, -2100, 520, pick(r, ['#58744c', '#62804f']), { size: 80 }); } }
    // the near pavement's trees and lamps, the far pavement's
    // (never right in front of the window: the street is what the room looks at)
    for (let x = L + 8000 + r() * 3000; x < R - 8000; x += 9000 + r() * 3000) {
        if (Math.abs(x - cx) < ctx.width / 2 + 2600) continue;
        tree(b, r, x, ground, kerb + 1200, { height: 9000 + r() * 2000, hex: pick(r, ['#647f4e', '#6c8754', '#5c7849']), bark: '#8b8170', shape: 'tall' });
        b.box([1200, 30, 1200], [x, ground + 15, kerb + 1200], '#5b5045');
    }
    for (let x = L + 4000; x < R; x += 16000) streetLamp(k, x, ground, kerb + 500, { height: 7000, reach: 1600, face: -1, hex: neon ? '#ffd2a8' : '#ffd29a' });
    for (let x = L + 12000; x < R; x += 16000) streetLamp(k, x, ground, far - 500, { height: 7000, reach: 1600, face: 1, hex: neon ? '#ffd2a8' : '#ffd29a' });
    for (let x = L + 6000 + r() * 4000; x < R - 8000; x += 10000 + r() * 4000) if (!inCross(x, 1500)) tree(b, r, x, ground, far - 1500, { height: 8500 + r() * 2000, hex: pick(r, ['#647f4e', '#5c7849']), bark: '#8b8170', shape: 'tall' });
    // parked cars both sides, a couple moving (their lamps on after dark)
    for (let x = L + 5000; x < R - 5000; x += 5600 + r() * 2500) if (r() < .75) car(k, r, x, ground, kerb - 1200);
    for (let x = L + 5000; x < R - 5000; x += 5600 + r() * 2500) if (r() < .75) car(k, r, x, ground, far + 1200);
    for (const [x, z, dir] of [[cx - 9000 + r() * 4000, kerb - 3700, 1], [cx + 6000 + r() * 5000, far + 3700, -1]]) {
        car(k, r, x, ground, z); k.lights.box([60, 160, 1400], [x + dir * 2250, ground + 650, z], '#fff2dc'); k.lights.box([60, 140, 1400], [x - dir * 2250, ground + 700, z], '#d23a2a');
        k.halos.add(x + dir * 2400, ground + 650, z, 700, '#fff0d8', .35); b.light(x + dir * 5000, ground + 400, z, '#fff0d8', 4500, .35);
    }
    // the row across the street: varied widths and heights, shops at street level
    const walls = neon ? ['#8d8a86', '#7a7470', '#a09a92', '#6e6a68', '#9a8f84'] : ['#b9ab97', '#c9bfae', '#a8907a', '#bdb4a6', '#9d8270', '#cfc6b8'];
    const row = (x0, x1, depth, fn) => { for (let x = x0; x < x1;) { const width = Math.min(x1 - x, 9000 + r() * 9000); if (width > 4000) fn(x, width, depth); x += width; } };
    const block = (x, width) => { const floors = 3 + Math.floor(r() * 4);
        building(k, r, x + width / 2, ground, across - 7000, { width: width - 200, depth: 14000, floors, material: pick(r, neon ? ['brick', 'render', 'panel', 'stone'] : ['brick', 'brick', 'stone', 'render', 'panel']), litRate: neon ? .5 : .45, warm: neon ? .45 : .75, neon: neon ? NEON : null });
        if (neon && r() < .5) { const c = pick(r, NEON), bx = x + width * (.15 + r() * .7); k.lights.box([380, 4200, 120], [bx, ground + 7500, across + 400], c); k.halos.add(bx, ground + 7500, across + 900, 2600, c, .3); b.light(bx, ground + 6000, across + 3000, c, 7000, .4); }
    };
    if (plaza) {   // a paved plaza (or forecourt) and, across it, the civic building or the medical block
        const bz = across - 26000, flagX = cx + (r() - .5) * 6000, bw = 60000;
        if (civic) {
            building(k, r, cx, ground, bz - 9000, { width: bw, depth: 18000, floors: 4, storey: 4400, shops: false, material: 'stone', bays: 16, litRate: .3 });
            const face = bz;   // the portico: steps, columns, a pediment
            for (let i = 0; i < 4; i++) b.box([26000 - i * 600, 300, 1200], [cx, ground + 150 + i * 300, face + 4600 - i * 1100], '#cfc6b4');
            for (let i = 0; i < 8; i++) b.add(new THREE.CylinderGeometry(500, 560, 10500, 12, 1, true), M(cx - 10500 + i * 3000, ground + 1200 + 5250, face + 1800), () => colour('#ddd5c4'), { ambient: .55 });
            b.box([25000, 1200, 3000], [cx, ground + 12300, face + 1500], '#d6cdbb');
            const ped = new THREE.Shape(); ped.moveTo(-12800, 0); ped.lineTo(0, 3200); ped.lineTo(12800, 0); ped.closePath(); const pg = new THREE.ExtrudeGeometry(ped, { depth: 2800, bevelEnabled: false });
            b.add(pg, M(cx, ground + 12900, face + 100), () => colour('#d2c9b6'), { facet: true }); pg.dispose();
            for (let i = 0; i < 3; i++) { const x = flagX - 4000 + i * 4000; pole(b, x, ground, -21000, 11000, 70, '#c9c9c4');
                b.add(QUAD_FLAG, M(x + 900, ground + 10200, -21000, 1800, 1100, 1), () => colour(['#5a6e8c', '#8c4b45', '#d8d2c2'][i]), { light: false }); }
        } else {
            building(k, r, cx, ground, bz - 9000, { width: bw, depth: 18000, floors: 6, storey: 3800, shops: false, style: 'band', wall: '#dcdad4', glass: '#4a5a66', litRate: .5, warm: .4, cornice: false, roof: '#cfcac0', bays: 14 });
            b.box([22000, 400, 7000], [cx, ground + 4200, bz + 3500], '#e3e1dc'); for (let x = cx - 10000; x <= cx + 10000; x += 5000) pole(b, x, ground, bz + 6700, 4000, 120, '#b9bcbe');
            for (let x = cx - 9000; x <= cx + 9000; x += 3000) { k.lights.box([600, 40, 600], [x, ground + 3980, bz + 3500], '#f2f4f0'); }
            b.light(cx, ground + 3500, bz + 4000, '#eef2f0', 9000, .6);
            b.box([5200, 2400, 2100], [cx + 6000, ground + 1300, bz + 9000], '#e8e6e0'); b.box([1600, 1900, 2000], [cx + 8600, ground + 950, bz + 9000], '#e8e6e0'); b.quad(2000, 260, [cx + 6000, ground + 1500, bz + 10060], colour('#a8433a'));
        }
        for (let x = cx - 22000; x <= cx + 22000; x += 7300) { if (Math.abs(x - flagX) < 6000 && civic) continue; b.box([2200, 500, 2200], [x, ground + 250, -26000], '#a49d90'); tree(b, r, x, ground + 500, -26000, { height: 7000, hex: '#62804e', shape: 'round' }); }
        for (let x = cx - 24000; x <= cx + 24000; x += 2400) b.box([220, 900, 220], [x, ground + 450, far - 900], '#6a6c6e');
    } else { row(L, crossX - crossW / 2, 0, block); row(crossX + crossW / 2, R, 0, block); }
    // down the side street: its lamps, the sides of the blocks along it (windows on the street), a car going away
    if (!plaza) for (const side of [-1, 1]) for (let z = across - 16000; z > -50000; z -= 14000 + r() * 4000) {
        const w = 12000, x = crossX + side * (crossW / 2 + w / 2), floors = 3 + Math.floor(r() * 5);
        building(k, r, x, ground, z, { width: w, depth: 13000, floors, material: pick(r, ['brick', 'stone', 'render']), litRate: neon ? .5 : .4, warm: .7, shops: false, side: -side, cornice: false });
    }
    if (!plaza) for (let z = far - 6000; z > -52000; z -= 12000) for (const side of [-1, 1]) streetLamp(k, crossX + side * (crossW / 2 - 900), ground, z, { height: 6500, reach: 0, face: 1, hex: neon ? '#ffd2a8' : '#ffd29a', power: .8 });
    if (!plaza) { const z = -30000 - r() * 8000, x = crossX + 1800; car(k, r, x, ground, z, { turn: Math.PI / 2 }); k.lights.box([1300, 140, 60], [x, ground + 700, z + 2250], '#d23a2a'); k.halos.add(x, ground + 700, z + 2400, 800, '#ff4030', .3); }
    // behind: taller blocks; far off: the towers
    // (from high up the blocks behind are lower and further apart, so the room sees over them to the towers and the sky)
    const high = ctx.storey > 18000;
    for (let x = L - 20000; x < R + 20000;) { const width = 14000 + r() * 12000;
        if (high && r() < .45) { x += width; continue; }
        building(k, r, x + width / 2, ground, -52000 - r() * 10000, { width, depth: 18000, floors: high ? 4 + Math.floor(r() * 5) : 9 + Math.floor(r() * 9), wall: pick(r, walls), style: r() < .4 ? 'band' : 'punched', bays: 5, shops: false, litRate: neon ? .5 : .32, warm: .6, cornice: r() < .5 });
        x += width + 2000 + r() * 6000; }
    for (let x = L - 60000; x < R + 60000;) { const width = 16000 + r() * 16000, floors = 18 + Math.floor(r() * 30);
        building(k, r, x + width / 2, ground, -105000 - r() * 30000, { width, depth: 20000, floors, storey: 3600, wall: pick(r, ['#9aa3aa', '#a9adb0', '#8a949c', '#b2aa9e']), glass: '#56646f', style: 'band', bays: 6, shops: false, litRate: neon ? .55 : .3, warm: .5, cornice: false });
        if (neon && r() < .6) { const c = pick(r, NEON), h = floors * 3600; k.lights.box([width * .7, 1600, 200], [x + width / 2, ground + h - 2500, -105000 + 10000 + 300], c); k.halos.add(x + width / 2, ground + h - 2500, -94000, width * .5, c, .25); }
        x += width + 4000 + r() * 12000; }
}
const CITY_NIGHT = { night: { horizon: '#3a3a4e', air: '#2a2c3a', stars: .25, tint: [.13, .14, .2] }, party: { horizon: '#47385e', air: '#2e2844', stars: .15 } };
const NEON_NIGHT = { evening: { horizon: '#d98a70', zenith: '#4a4f82' }, night: { zenith: '#120f2a', horizon: '#4d3466', air: '#2c2342', stars: .1, tint: [.13, .12, .2] }, party: { zenith: '#16102e', horizon: '#5a3270', air: '#33264a', stars: .05 } };

// ---- a yard behind a garage workshop: a concrete apron and gravel, a lumber rack under a lean-to, a shed, a work
// trailer, a chain-link and board fence, fruit trees, a utility pole with its wires, the neighbours' roofs; a yard light
// over the door after dark.
function yard(k, ctx) {
    const { land: b, r } = k, ground = ctx.ground - 150, cx = (ctx.left + ctx.right) / 2, w = ctx.width, flip = r() < .5 ? 1 : -1;
    const conc = colour('#a9a59d'), gravel = colour('#9a8f80'), dirt = colour('#8a7a64'), grassC = colour('#75835a'), out = new THREE.Color();
    land(b, ground, cx - 26000, cx + 26000, -60, -20000, -80000, (x, z) => {
        if (z > -4500) return out.copy(conc).multiplyScalar(((Math.floor(x / 3000) + Math.floor(z / 3000)) % 2 ? .95 : 1) * (.96 + r() * .05));
        const d = Math.sin(x / 2100 + 1) * Math.sin(z / 1700) * .5 + .5;
        if (z > -14000) return out.copy(gravel).lerp(dirt, d * .5).multiplyScalar(.9 + r() * .12);
        return out.copy(grassC).lerp(dirt, d * .3).multiplyScalar(.9 + r() * .1); }, 450);
    // near the wall: a workbench outside, sawhorses, a stack of pavers, weeds along the wall's foot
    grass(b, r, ctx.left - 2000, ctx.right + 2000, -900, -300, ground, 260, '#748a58', 300);
    for (const s of [-1, 1]) { const x = cx + s * 900; for (const [dx, dz] of [[-350, 0], [350, 0]]) limb(b, V(x + dx, ground, -2400 + dz - 200), V(x + dx * .4, ground + 750, -2400), 30, '#a08060'); b.box([1100, 90, 120], [x, ground + 760, -2400], '#a88a68'); }
    for (let i = 0; i < 4; i++) b.box([1200, 90, 1000], [cx - flip * 2600, ground + 45 + i * 90, -3200], '#b5aea2', .04, r);
    // the lean-to with the lumber rack, the shed
    const lx = cx + flip * (w / 2 + 2500), lz = -6800;
    for (const dx of [-2400, 2400]) for (const dz of [-1200, 1200]) b.box([120, 2700, 120], [lx + dx, ground + 1350, lz + dz], '#7f6a55');
    b.box([5600, 80, 3000], [lx, ground + 2750, lz], '#8d9298');
    for (let i = 0; i < 7; i++) b.box([4600, 90 + r() * 60, 2000], [lx, ground + 350 + i * 260, lz], pick(r, ['#c9a77a', '#bf9b6c', '#d1b083', '#b48e62']), .05, r);
    const sx = cx - flip * 6500, sz = -12500;
    house(k, r, sx, ground, sz, { width: 4200, depth: 3200, eaves: 2400, ridge: 1100, wall: '#8c9a88', roof: '#5d5a56', lit: [], porch: false, storeys: 1 });
    // a work trailer and a pickup
    b.box([3600, 120, 1900], [cx + flip * 1800, ground + 600, -9500], '#5d6266'); for (const s of [-1, 1]) b.box([560, 560, 200], [cx + flip * 1800, ground + 300, -9500 + s * 900], '#1c1c1e');
    b.box([3400, 500, 60], [cx + flip * 1800, ground + 900, -8580], '#6a7074');
    car(k, r, cx + flip * 7200, ground, -10500, { hex: '#6b7a86', turn: .2 });
    // the fence, the fruit trees, the pole and its wires
    fence(b, r, -30000, 30000, ground, -17500, { kind: 'chain', height: 1800 });
    fence(b, r, cx - flip * 26000, cx - flip * 9000, ground, -17800, { height: 1800, hex: '#8f7a64' });
    for (const [x, z, h] of [[-8000, -15500, 5200], [4500, -16000, 4800], [12500, -15200, 5600], [-15000, -16500, 4600], [20000, -16200, 5000]]) tree(b, r, cx + x * flip, ground, z, { height: h, hex: pick(r, ['#5f7a4b', '#68834f', '#57724a']), shape: 'spreading' });
    const p1 = V(cx - flip * 3500, ground, -15000), p2 = V(cx + flip * 26000, ground, -18500);
    utilityPole(k, p1.x, ground, p1.z); utilityPole(k, p2.x, ground, p2.z);
    for (const s of [-900, 0, 900]) { wire(b, V(p1.x + s, ground + 9950, p1.z), V(p2.x + s, ground + 9950, p2.z), 900); wire(b, V(p1.x + s, ground + 9950, p1.z), V(p1.x - flip * 30000 + s, ground + 9950, p1.z + 1500), 1100); }
    wire(b, V(p1.x, ground + 9200, p1.z), V(cx, ground + 3800, -200), 600);
    // the neighbours, their trees; the yard light over the workshop's door
    house(k, r, cx - flip * 12000, ground, -30000, { width: 10000, wall: '#c8bba6', roof: '#6e5e55', lit: [1, 3] });
    house(k, r, cx + flip * 9000, ground, -33000, { width: 9000, eaves: 3000, wall: '#b9b8ae', roof: '#5f6266', lit: [0], storeys: 1 });
    for (let x = -50000; x <= 50000; x += 4000 + r() * 4000) tree(b, r, cx + x, ground, -40000 - r() * 8000, { height: 8000 + r() * 4000, hex: '#587253', size: 900 });
    for (let x = -60000; x <= 60000; x += 3000 + r() * 1000) crown(b, r, x, ground + 2400 + r() * 1200, -60000 - r() * 5000, 3500, 3200, 2400, '#5b735f', { size: 1500, lobes: .2 });
    k.lights.box([300, 160, 200], [cx + flip * (w / 2 + 700), ctx.top + 300, -150], '#ffe2b0'); k.halos.add(cx + flip * (w / 2 + 700), ctx.top + 200, -350, 900, '#ffd9a0', .5);
    b.light(cx + flip * (w / 2 + 700), ctx.top, -1500, '#ffd9a0', 8000, .55);
    pathLight(k, sx + 2600, ground, sz + 2200, '#ffd9a8', .5);
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
// The coast beyond: the land falls away past `edge` (a bluff, `drop` below) to a low town of stucco roofs and palms,
// a beach at `shore`, and the Pacific out to the horizon (k.sea: drawn by its own shader, the sky in it, the sun's
// glitter low in the evening).
function coast(k, ctx, edge, drop, shore) {
    const { land: b, r } = k, ground = ctx.ground, low = ground - drop, cx = (ctx.left + ctx.right) / 2, out = new THREE.Color(), dry = colour('#a8a07e'), sand = colour('#d6ccb2');
    groundPlane(b, low, cx - 600000, cx + 600000, shore, edge + 2000, 8000, (x, z) => out.copy(dry).lerp(colour('#b9ae96'), .5 + .5 * Math.sin(x / 9000 + z / 7000)).multiplyScalar(.9 + r() * .1), .8);
    groundPlane(b, low - 300, cx - 600000, cx + 600000, shore - 50000, shore, 10000, () => out.copy(sand).multiplyScalar(.95 + r() * .06), .85);
    for (let i = 0; i < 36; i++) { const z = edge - 12000 - r() * ((edge - 12000) - (shore + 30000)), x = cx + (r() - .5) * 1.4 * Math.abs(z);
        if (r() < .65) house(k, r, x, low, z, { width: 9000 + r() * 4000, eaves: 3000, ridge: 1800, wall: pick(r, ['#e6dcc8', '#d9cdb5', '#efe6d4', '#cfc6b4']), roof: pick(r, ['#a8644a', '#9c5e48', '#8a7a6a']), lit: [0, 2], storeys: 1, porch: false });
        else fanPalm(b, r, x, low, z, { height: 20000 + r() * 6000 }); }
    k.sea = { y: low - 500, x0: cx - 1000000, x1: cx + 1000000, z0: -1150000, z1: shore - 50000, color: '#3a5f75' };
}
function socal(k, ctx, kind) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, L = ctx.left - 30000, R = ctx.right + 30000;
    const lawnC = colour('#7d8a62'), dry = colour('#a39d7c'), conc = colour('#c3bcae'), track = colour('#9a5a48'), out = new THREE.Color();
    if (kind === 'campus') {
        // Orange Coast College from the media lab, a floor up: a planted strip and the walk below, the quad with its
        // jacarandas and benches, palms along the walk, a block across one side of the quad, the car park on the other,
        // and past the edge of the mesa the low town, the beach and the sea.
        const walk = z => z > -4500 && z < -1800, quadEnd = -42000, edge = -90000;
        land(b, ground, L, R, -60, -30000, edge, (x, z) => {
            if (walk(z) || (Math.abs(x - cx - 4000) < 1500 && z > quadEnd + 9000)) return out.copy(conc).multiplyScalar((Math.floor(x / 1500) % 2 ? .95 : 1) * (.96 + r() * .05));
            if (z > -1800) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
            if (z > quadEnd) { const p = Math.sin(x / 2600) * Math.sin(z / 2100) * .5 + .5; return out.copy(lawnC).lerp(dry, p * .3).multiplyScalar(.93 + r() * .07); }
            if (z > quadEnd - 34000 && x > cx - 4000) return out.copy(colour('#56585a')).multiplyScalar((Math.abs(((x % 2700) + 2700) % 2700) < 90) ? 1.7 : .95 + r() * .08);
            return out.copy(dry).multiplyScalar(.9 + r() * .1); }, 600);
        for (let x = ctx.left - 6000; x < ctx.right + 6000; x += 900 + r() * 700) { if (r() < .5) agave(b, r, x, ground, -900 - r() * 600, 450 + r() * 300, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a'])); else shrub(b, r, x, ground, -1000 - r() * 500, 450 + r() * 200, pick(r, ['#5f7a4c', '#6c8452']), { size: 120 }); }
        for (let x = ctx.left - 12000; x < ctx.right + 12000; x += 9000) { if (Math.abs(x - cx) > ctx.width / 2 + 1500) featherPalm(b, r, x + r() * 2000, ground, -6000 - r() * 1500, { height: 7000 + r() * 2500 }); pathLight(k, x + 4500, ground, -5000); }
        for (let x = ctx.left - 4000; x < ctx.right + 8000; x += 6000 + r() * 4000) bench(b, x, ground, -5200, 0, '#b8b2a6');
        // the quad's trees: jacarandas (lilac in flower, green otherwise) and a coral tree, tall fan palms along the far walk
        for (const [x, z, h] of [[-9000, -15000, 8000], [7000, -18000, 9000], [-2000, -26000, 8500], [15000, -27000, 9500], [-17000, -24000, 8000], [24000, -16000, 8500]]) {
            tree(b, r, cx + x, ground, z, { height: h, hex: r() < .55 ? '#8f86b0' : '#6e8656', shape: 'spreading', bark: '#6f655c' }); }
        for (let x = L; x < R; x += 7000 + r() * 2000) fanPalm(b, r, x, ground, quadEnd + 6000 + r() * 1500, { height: 17000 + r() * 6000 });
        campusBlock(k, r, cx - 24000, ground, quadEnd - 9000, { width: 34000, floors: 3 });
        for (let x = cx; x < R + 20000; x += 5200 + r() * 1200) if (r() < .7) car(k, r, x, ground, quadEnd - 24000 - Math.floor(r() * 3) * 6000);
        for (let x = cx + 6000; x < R + 20000; x += 30000) floodlight(k, x, ground, quadEnd - 27000, 11000);
        for (let x = L - 40000; x < R + 40000; x += 9000 + r() * 6000) fanPalm(b, r, x, ground, edge + 3000 + r() * 2000, { height: 18000 + r() * 6000 });
        coast(k, ctx, edge, 25000, -460000);
        return;
    }
    // Huntington Beach High from a classroom a floor up: succulents and a walk below, the fence, the track and the
    // field with its goalposts, bleachers across one side, the floodlights, palms in a row behind, a pumpjack; past the
    // field the land falls to the low town, the beach and the sea.
    const fenceZ = -5200, trackZ = -9000, fieldZ0 = -16000, fieldZ1 = -64000, fieldX = cx + 6000, edge = -94000;
    land(b, ground, L, R, -60, -30000, edge, (x, z) => {
        if (z > -3200) return out.copy(conc).multiplyScalar(.95 + r() * .05);
        if (z > fenceZ) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
        const inside = Math.abs(x - fieldX) < 34000 && z < fieldZ0 && z > fieldZ1;
        if (z < trackZ && z > fieldZ1 - 7000 && Math.abs(x - fieldX) < 40000 && !inside) { const lane = Math.abs(((z - trackZ) % 1220 + 1220) % 1220) < 50; return lane ? out.set(.85, .82, .78) : out.copy(track).multiplyScalar(.92 + r() * .08); }
        if (inside) { const yard = Math.abs(((x - fieldX) % 4570 + 4570) % 4570) < 70 || Math.abs(z - fieldZ0) < 90 || Math.abs(z - fieldZ1) < 90;
            return yard ? out.set(.82, .82, .78) : out.copy(lawnC).multiplyScalar(((Math.floor((x - fieldX) / 4570) % 2) ? .92 : 1.02) * (.96 + r() * .04)); }
        return out.copy(lawnC).lerp(dry, .4).multiplyScalar(.9 + r() * .1); }, 600);
    for (let x = ctx.left - 4000; x < ctx.right + 4000; x += 600 + r() * 500) agave(b, r, x, ground, -800 - r() * 700, 380 + r() * 260, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a', '#8e9a6a']));
    grass(b, r, ctx.left - 3000, ctx.right + 3000, -4700, -3400, ground, 300, '#7d8a5a', 260);
    fence(b, r, L, R, ground, fenceZ, { kind: 'chain', height: 2400 });
    for (const x of [fieldX - 50000, fieldX + 50000]) { limb(b, V(x, ground, fieldZ0 - 24000), V(x, ground + 3000, fieldZ0 - 24000), 90, '#d8c24a'); b.box([5600, 120, 120], [x, ground + 3000, fieldZ0 - 24000], '#d8c24a'); for (const s of [-1, 1]) pole(b, x + s * 2800, ground + 3000, fieldZ0 - 24000, 6000, 50, '#d8c24a'); }
    bleachers(b, fieldX - 36000, fieldX - 6000, ground, fieldZ1 - 9000, 12);
    b.box([10000, 3000, 3000], [fieldX - 21000, ground + 1500 + 12 * 420, fieldZ1 - 9000 - 12 * 760 - 1500], '#c9c2b4');
    for (const x of [fieldX - 38000, fieldX + 38000]) for (const z of [fieldZ0 + 2000, fieldZ1 - 4000]) floodlight(k, x, ground, z, 22000, z > -30000 ? -1 : 1);
    for (let x = L - 30000; x < R + 30000; x += 7000 + r() * 3000) fanPalm(b, r, x, ground, edge + 4000 - r() * 2000, { height: 18000 + r() * 6000 });
    for (let x = ctx.left - 14000; x < ctx.right + 14000; x += 11000 + r() * 3000) if (Math.abs(x - cx) > ctx.width / 2 + 2000) tree(b, r, x, ground, -7000 - r() * 1500, { height: 6500, hex: '#6c8452', shape: 'round' });
    pumpjack(b, cx - 34000, ground, -40000, .6, 1.1);
    coast(k, ctx, edge, 12000, -420000);
}
const SOCAL = { morning: { horizon: '#ebdcc6', air: '#e6dccb', haze: .5 }, afternoon: { horizon: '#e4e4da', air: '#dfe0d8', haze: .45, tint: [1, .98, .93] }, evening: { sun: [32, 3, '#ffa060', 1.1] } };

// ---- a college campus (the library room, the study, the college and university classrooms): lawns crossed by
// paths, oaks and maples (a few turning), benches and lamps, a brick wing with stone trim and a slate roof across the
// lawn, another building beyond, a clock tower on some. variant: 'quad' (a lawn enclosed by wings), 'green' (open
// lawn, a long wing), 'court' (a paved court with a fountain nearest the glass).
const pitchedRoof = (b, x, y, z, width, depth, rise, hex) => { const sh = new THREE.Shape(); sh.moveTo(-depth / 2 - 300, 0); sh.lineTo(0, rise); sh.lineTo(depth / 2 + 300, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: width + 400, bevelEnabled: false }); b.add(g, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x - width / 2 - 200, y, z), () => colour(hex), { facet: true }); g.dispose(); };
function collegeWing(k, r, x, ground, z, { width = 40000, floors = 3, tower = false, depth = 14000 } = {}) {
    const h = building(k, r, x, ground, z, { width, depth, floors, storey: 3900, shops: false, material: r() < .7 ? 'brick' : 'stone', bays: Math.round(width / 3600), litRate: .4, cornice: true });
    if (!h) return; pitchedRoof(k.land, x, ground + h, z, width, depth, 5200, pick(r, ['#555a60', '#4f5458', '#5d5650']));
    for (let i = 0; i < Math.round(width / 9000); i++) k.land.box([1800, 1600, 1400], [x - width / 2 + 4500 + i * 9000, ground + h + 1200, z + depth / 2 - 600], '#c9bfae');
    if (tower) { const tx = x + (r() - .5) * width * .4, th = h + 14000; k.land.box([5200, th, 5200], [tx, ground + th / 2, z + depth / 2 - 2000], '#9b6d5a');
        k.land.box([5600, 600, 5600], [tx, ground + th - 4000, z + depth / 2 - 2000], '#d2c8b4'); k.land.add(new THREE.CylinderGeometry(1200, 1200, 80, 18).rotateX(Math.PI / 2), M(tx, ground + th - 2400, z + depth / 2 + 650), () => colour('#e8e2d2'));
        k.land.add(new THREE.ConeGeometry(4000, 6000, 4, 1).rotateY(Math.PI / 4), M(tx, ground + th + 3000, z + depth / 2 - 2000), () => colour('#56605c'), { facet: true }); }
}
function campus(k, ctx) {
    const { land: b, r } = k, ground = ctx.ground - 150, cx = (ctx.left + ctx.right) / 2, w = ctx.width, v = ctx.variant || 'green', f = r() < .5 ? 1 : -1, jit = s => (r() - .5) * s;
    const lawnC = colour('#6f855a'), dry = colour('#879668'), path = colour('#bdb3a2'), out = new THREE.Color();
    const paths = [z => cx + f * 2500 + z * .35 * f, z => cx - f * 9000 - z * .5 * f];
    land(b, ground, cx - 30000, cx + 30000, -60, -24000, -90000, (x, z) => {
        if (v === 'court' && z > -9000) return out.copy(path).multiplyScalar((Math.floor(x / 1200) + Math.floor(z / 1200)) % 2 ? .93 : 1);
        if (paths.some(p => Math.abs(x - p(z)) < 900) || (z < -30000 && z > -32500)) return out.copy(path).multiplyScalar(.94 + r() * .06);
        const patch = Math.sin(x / 2700) * Math.sin(z / 2200) * .5 + .5; return out.copy(lawnC).lerp(dry, patch * .35).multiplyScalar(.93 + r() * .07); }, 500);
    // nearest the glass
    if (v === 'court') { const fx = cx + f * 1500, fz = -5200; b.add(new THREE.CylinderGeometry(2600, 2700, 600, 20, 1), M(fx, ground + 300, fz), () => colour('#bfb6a6'));
        b.add(new THREE.CylinderGeometry(2350, 2350, 20, 20, 1), M(fx, ground + 590, fz), () => colour('#5f7884'), { light: false }); b.add(new THREE.CylinderGeometry(500, 700, 1600, 12, 1), M(fx, ground + 900, fz), () => colour('#c9c0b0'));
        for (const s of [-1, 1]) bench(b, fx + s * 4200, ground, fz + 1200, s * .4, '#6a5a4a'); }
    else for (let x = ctx.left - 2500; x < ctx.right + 2500; x += 900 + r() * 500) shrub(b, r, x, ground, -1200 - r() * 500, 420 + r() * 160, pick(r, ['#567148', '#5f7a4c', '#4f6a44']), { size: 90 });
    // trees: oaks and maples, one or two turning
    const spots = v === 'quad' ? [[-9000, -11000], [8000, -13000], [-15000, -21000], [14000, -22000], [-3000, -24000]] : [[-7000, -9000], [11000, -12500], [-15000, -17000], [3000, -20000], [19000, -21000], [-23000, -24000]];
    for (const [x, z] of spots) { const turn = r() < .2; tree(b, r, cx + f * x + jit(2000), ground, z + jit(2000), { height: 8000 + r() * 4000, hex: turn ? pick(r, ['#a8743e', '#b5603c', '#9a8a44']) : pick(r, ['#5e7a4a', '#66804c', '#58744a']), shape: r() < .5 ? 'spreading' : 'round', bark: '#5a4d42' }); }
    for (let z = -6000; z > -30000; z -= 8000) { const x = paths[0](z); pathLight(k, x + 1300, ground, z, '#ffdcae', .6); if (r() < .6) bench(b, x - 1600, ground, z - 1500, f * Math.PI / 2, '#5d4f42'); }
    // the buildings
    if (v === 'quad') { collegeWing(k, r, cx, ground, -40000, { width: 52000, floors: 3, tower: r() < .6 }); for (const s of [-1, 1]) collegeWing(k, r, cx + s * 30000, ground, -25000, { width: 26000, floors: 3 }); }
    else collegeWing(k, r, cx + f * 6000 + jit(6000), ground, -38000 + jit(4000), { width: 46000 + jit(10000), floors: 2 + Math.floor(r() * 2), tower: v === 'green' && r() < .5 });
    collegeWing(k, r, cx - f * 28000, ground, -60000, { width: 30000, floors: 4 });
    for (let x = cx - 60000; x <= cx + 60000; x += 3800 + r() * 2200) tree(b, r, x, ground, -70000 - r() * 12000, { height: 11000 + r() * 4000, hex: '#587353', size: 1200 });
    ridge(b, r, -140000, ground, cx - 160000, cx + 160000, 9000, '#64786a', { step: 4000 });
}

// ---- a schoolyard (kindergarten, elementary, middle school): an asphalt yard with painted games (hopscotch, four
// square, a running loop), a play structure with a slide and a climbing wall, swings, a basketball hoop, a shade sail,
// a low fence, trees, the school's one-storey wing across with coloured panels, houses beyond. variant: 'kinder'
// (sandpit and a planter of sunflowers nearest the glass, small equipment), 'elementary' (bike racks nearest),
// 'middle' (from a floor up: a ball court with lines and a running track).
function paint(b, x, y, z, w, d, hex, turn = 0) { b.add(QUAD, new THREE.Matrix4().compose(V(x, y + 6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, turn, 'YXZ')), V(w, d, 1)), () => colour(hex), { light: false }); }
function schoolyard(k, ctx) {
    const { land: b, r } = k, ground = ctx.ground - 150, cx = (ctx.left + ctx.right) / 2, w = ctx.width, v = ctx.variant || 'elementary', f = r() < .5 ? 1 : -1, jit = s => (r() - .5) * s;
    const asphalt = colour('#5d5f60'), lawnC = colour('#728858'), out = new THREE.Color(), fenceZ = -26000;
    land(b, ground, cx - 30000, cx + 30000, -60, -24000, -90000, (x, z) => z > fenceZ + 1500 && Math.abs(x - cx) < 24000 ? out.copy(asphalt).multiplyScalar(.92 + r() * .1) : out.copy(lawnC).multiplyScalar(.9 + r() * .1), 500);
    // painted games
    const hx = cx - f * 3500, hz = -6500; for (let i = 0; i < 8; i++) paint(b, hx + (i % 3 === 1 ? 0 : (i % 2 ? -350 : 350)) * (i % 3 === 1 ? 0 : 1), ground, hz - i * 650, 600, 600, pick(r, ['#d8c24a', '#e8e4d8', '#c8604a', '#4a8ac8']));
    paint(b, cx + f * 4000, ground, -9500, 6000, 6000, '#c8604a'); paint(b, cx + f * 4000, ground + 2, -9500, 5800, 80, '#e8e4d8'); paint(b, cx + f * 4000, ground + 2, -9500, 80, 5800, '#e8e4d8');
    if (v !== 'kinder') { paint(b, cx, ground, -17000, 30000, 300, '#e8e4d8'); paint(b, cx, ground, -20000, 30000, 300, '#e8e4d8'); }
    if (v === 'middle') { const bx = cx - f * 6000; paint(b, bx, ground, -15000, 14000, 26000, '#4a6a8a', Math.PI / 2); paint(b, bx, ground + 2, -15000, 14000, 120, '#e8e4d8', Math.PI / 2);
        for (const s of [-1, 1]) { pole(b, bx + s * 12500, ground, -15000, 3000, 70, '#7a7c7e'); b.box([60, 1050, 1800], [bx + s * 12200, ground + 3300, -15000], '#e8e6e0'); } }
    // the play structure: a deck on posts, a roof, a slide, a climbing wall; swings; a hoop; a shade sail
    const px = cx + f * (w / 2 + 3500), pz = -13000, small = v === 'kinder' ? .7 : 1;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box([150, 3200 * small, 150], [px + dx * 1100, ground + 1600 * small, pz + dz * 1100], '#2f6a9a');
    b.box([2400, 120, 2400], [px, ground + 1500 * small, pz], '#d8a83a'); b.add(new THREE.ConeGeometry(1900, 1300 * small, 4, 1).rotateY(Math.PI / 4), M(px, ground + 3800 * small, pz), () => colour('#c8503a'), { facet: true });
    b.add(BOX_UNIT, new THREE.Matrix4().compose(V(px - f * 2600, ground + 800 * small, pz + 300), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), f * .5), V(3000, 60, 700)), () => colour('#e0b030'));
    b.box([60, 1500 * small, 2300], [px + f * 1250, ground + 750 * small, pz], '#3a8a6a'); for (let i = 0; i < 12; i++) b.box([120, 100, 140], [px + f * 1300, ground + 200 + r() * 1200 * small, pz + jit(2000)], pick(r, ['#d8503a', '#e8c040', '#4a8ac8']));
    const sx = cx - f * (w / 2 + 4500), sz = -16000; for (const s of [-1, 1]) { limb(b, V(sx + s * 1700, ground, sz - 900), V(sx + s * 1700, ground + 2400 * small, sz), 50, '#4a8a5a'); limb(b, V(sx + s * 1700, ground, sz + 900), V(sx + s * 1700, ground + 2400 * small, sz), 50, '#4a8a5a'); }
    b.box([3600, 90, 90], [sx, ground + 2400 * small, sz], '#4a8a5a'); for (const s of [-.5, .5]) b.box([500, 40, 220], [sx + s * 1700, ground + 500, sz], '#2a2c30');
    if (v !== 'kinder') { const bx = cx + f * 9000; pole(b, bx, ground, -22000, 3000, 80, '#6a6c6e'); b.box([1800, 1050, 60], [bx, ground + 3300, -21800], '#e8e6e0'); }
    const shade = [V(cx - 6000, ground + 3600, -9000), V(cx + 6000, ground + 3200, -10000), V(cx - 1000, ground + 3900, -15000)]; b.tri(shade[0], shade[1], shade[2], colour('#e6dcc4'), .75); for (const p of shade) limb(b, V(p.x, ground, p.z), p, 70, '#8a8c8e');
    // nearest the glass
    if (v === 'kinder') { b.box([2600, 300, 2600], [cx + f * 800, ground + 150, -3000], '#a07a56'); b.box([2400, 40, 2400], [cx + f * 800, ground + 290, -3000], '#e2d4a8');
        b.box([w + 1600, 500, 600], [cx, ground + 250, -1100], '#9a7a5a'); for (let x = cx - w / 2 - 600; x < cx + w / 2 + 600; x += 450) { limb(b, V(x, ground + 500, -1100), V(x + jit(100), ground + 1500 + r() * 600, -1100), 14, '#6a8a4a'); flowers(b, r, x, ground + 1700 + r() * 500, -1100, 120, 6, ['#e8b830', '#d8a020'], 60); } }
    if (v === 'elementary') for (let x = cx - 3000; x <= cx + 3000; x += 700) { limb(b, V(x, ground, -2600), V(x, ground + 800, -2600), 25, '#8d9296'); limb(b, V(x, ground + 800, -2600), V(x + 450, ground + 800, -2600), 25, '#8d9296'); limb(b, V(x + 450, ground + 800, -2600), V(x + 450, ground, -2600), 25, '#8d9296'); }
    // the low fence, trees, the school's wing across, houses beyond
    fence(b, r, cx - 30000, cx + 30000, ground, fenceZ, { kind: 'chain', height: 1200 });
    for (let x = cx - 26000; x <= cx + 26000; x += 7000 + r() * 4000) if (Math.abs(x - cx) > w / 2 + 3000 || r() < .3) tree(b, r, x, ground, fenceZ - 2500 - r() * 2000, { height: 7000 + r() * 3000, hex: pick(r, ['#62804e', '#6c8754', '#5c7849']), shape: 'round' });
    const wing = building(k, r, cx - f * 4000 + jit(6000), ground, -45000, { width: 50000, depth: 16000, floors: v === 'middle' ? 2 : 1, storey: 4200, shops: false, material: 'render', bays: 12, litRate: .3, cornice: false });
    if (wing) for (let i = 0; i < 8; i++) b.box([3000, 1200, 100], [cx - f * 4000 - 21000 + i * 6000, ground + 3300, -36950], pick(r, ['#c8604a', '#4a8ac8', '#e0b030', '#4a9a6a']));
    for (let x = cx - 60000; x <= cx + 60000; x += 13000 + r() * 6000) house(k, r, x, ground, -70000 - r() * 8000, { width: 9000, wall: pick(r, ['#d6cab5', '#cbbfae', '#c8c2b6']), roof: pick(r, ['#96705e', '#7c6a64']), lit: [0, 2] });
    for (let x = cx - 70000; x <= cx + 70000; x += 3000 + r() * 1000) crown(b, r, x, ground + 2400 + r() * 1200, -85000 - r() * 6000, 3500, 3200, 2400, '#5b735f', { size: 1500, lobes: .2 });
}

export const SCENES = {
    garden: { build: garden, storey: 0 },
    'back-garden': { build: backGarden, storey: 0 },
    campus: { build: campus, storey: 0, hazeFar: 90000 },
    schoolyard: { build: schoolyard, storey: 0, hazeFar: 80000 },
    'studio-garden': { build: studioGarden, storey: 0, hazeFar: 46000 },
    // the marine layer: a low grey sky that burns off by afternoon, the air thick with it, the trunks going pale with distance
    humboldt: { build: humboldt, storey: 0, hazeFar: 34000, lampLevel: .7, haloLevel: 1.2, hours: {
        morning: { tint: [.86, .88, .86], zenith: '#a3b0b8', horizon: '#d5d8d4', sun: [-50, 16, '#f2eee2', .22], clouds: .95, haze: .62, air: '#c9cfcd' },
        afternoon: { tint: [.94, .95, .92], zenith: '#8aa5bb', horizon: '#d6dcdc', sun: [45, 42, '#fff6e6', .35], clouds: .7, haze: .52, air: '#cdd4d4' },
        evening: { tint: [.62, .56, .55], zenith: '#56607c', horizon: '#b99a8a', sun: [36, 6, '#ffb07a', .6], clouds: .8, haze: .66, air: '#9a8c86' },
        night: { tint: [.09, .11, .15], zenith: '#0d1420', horizon: '#26303a', clouds: .9, haze: .6, air: '#1e2730', stars: .15 },
        party: { tint: [.12, .12, .2], zenith: '#151a32', horizon: '#33304e', clouds: .85, haze: .6, air: '#262640', stars: .1 } } },
    city: { build: (k, ctx) => city(k, ctx), storey: 3400, hazeFar: 90000, lampLevel: .78, hours: CITY_NIGHT },
    'city-neon': { build: (k, ctx) => city(k, ctx, { neon: true }), storey: 3400, hazeFar: 90000, lampLevel: .78, haloLevel: .8, hours: NEON_NIGHT },
    yard: { build: yard, storey: 0, hazeFar: 80000 },
    'socal-campus': { build: (k, ctx) => socal(k, ctx, 'campus'), storey: 4200, hazeFar: 140000, hours: SOCAL },
    'beach-school': { build: (k, ctx) => socal(k, ctx, 'field'), storey: 4000, hazeFar: 140000, haloLevel: .8, hours: SOCAL }
};
