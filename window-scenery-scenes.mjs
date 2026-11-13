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

export const SCENES = {
    garden: { build: garden, storey: 0 }
};
