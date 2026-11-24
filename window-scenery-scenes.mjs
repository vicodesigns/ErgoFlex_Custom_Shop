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
import { basket, bicycle, neonMarquee, parasol, pitchedGlasshouse, redwoodRoots, roofDetail, shadeSail, steppingStone, sunflower } from './window-scenery-details.mjs';
import { BOX as BOX_UNIT, QUAD, colour, M, seen, rand, ground as groundPlane, ridge, crown, tree, conifer, redwood, fanPalm, featherPalm, shrub, hedge, flowers, grass, rock, house, building, streetLamp, car, bench, pathLight, utilityPole, wire, fence, masonry, pole, limb, spray } from './window-scenery-kit.mjs?v=polish-20261113b';

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
    // A run of irregular flagstones leads from the terrace toward a gate
    // set into the existing gap in the hedge.
    const gate=cx+5150;
    for(let i=0;i<13;i++){
        const t=i/12,x=cx+1400+(gate-cx-1400)*t+620*Math.sin(t*Math.PI*2);
        steppingStone(b,x+(i%2?95:-95),ground,-2960-t*11610,420+(i%3)*50,t*4,i%2?'#a49d8b':'#b7ad94');
    }
    for(const side of [-1,1])b.box([160,2250,160],[gate+side*780,ground+1125,fz+175],'#837461');
    for(let j=-3;j<=3;j++)b.box([180,1700,75],[gate+j*198,ground+860,fz+185],'#71816e');
    for(const h of [350,1450])b.box([1430,90,85],[gate,ground+h,fz+245],'#687664');
    limb(b,V(gate-650,ground+390,fz+250),V(gate+660,ground+1430,fz+250),46,'#687664');
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
        const px = cx + f * 3200, pz = -6500; b.box([4200, 40, 3600], [px, ground + 20, pz], '#bdb3a2'); b.box([1200,62,890],[px,ground+738,pz],'#a58c6a');
        for(const dx of [-485,485])for(const dz of [-330,330])pole(b,px+dx,ground,pz+dz,710,34,'#756851');
        for(const sign of [-1,1]){
            const cz=pz+sign*855;
            b.box([480,55,490],[px,ground+440,cz],'#8d8067');
            for(const dx of [-200,200])for(const dz of [-170,170])
                pole(b,px+dx,ground,cz+dz,sign*dz>0?830:425,22,'#6d685c');
            for(const h of [600,715,808])b.box([470,68,40],[px,ground+h,cz+sign*170],'#98896e');
        }
        parasol(b,px,ground,pz);

    }
    if (v === 'kitchen') {   // herb boxes on the sill outside, raised beds, bean poles, a greenhouse, a compost bin
        b.box([w + 200, 220, 260], [cx, sill - 130, -330], '#7a5c46');
        for (let x = cx - w / 2; x <= cx + w / 2; x += 170 + r() * 80) shrub(b, r, x, sill - 60, -330, 90 + r() * 60, pick(r, ['#6a8a52', '#5c7c4a', '#7f9a60']), { size: 30 });
        for (let i = 0; i < 6; i++) { const bx = cx - 5400 + (i % 3) * 3600 + jit(400), bz = -4200 - Math.floor(i / 3) * 3000;
            b.box([2800, 450, 1200], [bx, ground + 225, bz], '#8a6e54'); b.box([2700, 40, 1100], [bx, ground + 455, bz], soil);
            for(const side of [-1,1]){
                b.box([2870,65,92],[bx,ground+475,bz+side*600],'#b19671');
                for(const dx of [-1250,0,1250])b.box([64,455,70],[bx+dx,ground+228,bz+side*616],'#735e4c');
            }
            const crop = pick(r, ['#5f8a4c', '#7a9a52', '#4f7a48', '#8aa060']);
            for (let x = bx - 1150; x <= bx + 1150; x += 280) { if (i === 2) { limb(b, V(x, ground + 450, bz), V(x + 60, ground + 2300, bz), 12, '#8a7458'); crown(b, r, x + 30, ground + 1500, bz, 160, 700, 160, '#5f8a4c', { size: 70, core: 0 }); }
                else shrub(b, r, x, ground + 460, bz + jit(300), 150 + r() * 80, crop, { size: 45 }); } }
        pitchedGlasshouse(b,cx-f*7000,ground,-10500,3000,2200,1680);
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
        for(const dx of [-280,280])limb(b,V(hx-300+dx,ground,hz+1550),V(hx-300+dx,ground+2730,hz+1280),32,'#735e49');
        const bucket=V(cx+f*1300,ground+340,-3210);
        b.add(new THREE.CylinderGeometry(142,104,250,20,1,true),M(...bucket.toArray()),()=>colour('#62899a'),{two:true});
        const handle=new THREE.TorusGeometry(136,8,6,18,Math.PI);
        b.add(handle,M(bucket.x,bucket.y+107,bucket.z),()=>colour('#a3a6a0'));handle.dispose();
        for (let y = 300; y < 2700; y += 300) b.box([600, 40, 40], [hx - 300, ground + y, hz + 1550-270*y/2730], '#8a6a4c');
    }
    // A trained flowering climber on its own timber screen along the back fence.
    const trellisX = cx - f*2700, trellisZ = -12400;
    for (const dx of [-1200, 1200]) b.box([95, 2310, 95], [trellisX+dx, ground+1155, trellisZ], '#79654f');
    for (let j = 0; j < 5; j++) {
        const x = trellisX - 1160 + j*580;
        b.box([41, 1970, 50], [x, ground+1210, trellisZ+50], '#a79272');
        b.box([2420, 55, 50], [trellisX, ground+480+j*405, trellisZ+85], '#92795c');
    }
    const vine = rand(ctx.seed + 531);
    for (let j = 0; j < 13; j++) {
        const x = trellisX-1090 + (j%5)*480 + (vine()-.5)*185, y = ground+270+j*137;
        crown(b, vine, x, y, trellisZ+140, 365, 315, 120, '#527652', {size:90});
        if (j>4 && j%3) flowers(b, vine, x, y+50, trellisZ+230, 200, 11, ['#b68cba','#caadcb','#d9c9d8'], 35);
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
    const pathBrick = ['#a67861', '#916653', '#b08469', '#9e725a'];
    for (let row = 0; row < 57; row++) {
        const z = -1430 - row * 178, center = path(z);
        for (let col = 0; col < 3 + row % 2; col++) {
            const left = Math.max(0, col - (row % 2) * .5), right = Math.min(3, col + 1 - (row % 2) * .5);
            b.box([(right-left)*320-8, 32, 169], [center+(left+right-3)*160, ground+14, z],
                pathBrick[(row*7+col*5+Math.floor(row/4))%4]);
        }
    }
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
    const gx=cx+flip*6800,gz=-8200;
    pitchedGlasshouse(b,gx,ground,gz,2400,1800,1980);
    k.lights.quad(1900, 1200, [gx, ground + 1250, gz + 915], colour('#ffdcaa').multiplyScalar(.45)); b.light(gx, ground + 1200, gz + 1600, '#ffd6a0', 3000, .45);
    shrub(b, r, gx - 300, ground + 400, gz + 300, 380, '#6b8b57', { size: 70 });
    // a carved stone on a plinth, an easel on the grass
    const sx = path(-6000) + flip * 1300;
    b.box([500, 700, 500], [sx, ground + 350, -6000], '#c4bdb0'); rock(b, r, sx, ground + 1050, -6000, 420, '#b9b2a6'); rock(b, r, sx + 80, ground + 1450, -6000, 260, '#aaa396');
    const ex = cx - flip * 1700, ez = -3300;
    for (const [dx, dz] of [[-300, 120], [300, 120], [0, -350]]) limb(b, V(ex + dx, ground, ez + dz), V(ex, ground + 1750, ez), 25, '#8a6a4c');
    b.box([700, 900, 30], [ex, ground + 1200, ez + 90], '#efe9dc'); b.box([560, 500, 10], [ex, ground + 1250, ez + 110], '#8fa2a8');
    // A small plein-air study on the working easel, built inside the original
    // canvas border. The profile echoes the roof and trees beyond the gate.
    const sky=colour('#a9b9bd'),hills=colour('#84978e'),lower=colour('#667e70');
    b.quad(560,495,[ex,ground+1200,ez+119],sky);
    for(let i=0;i<16;i++){
        const x0=ex-280+i*35, x1=x0+35, bottom=ground+955;
        const ridge=(n,j)=>ground+1200+62*Math.sin(n*.34+j)+23*Math.sin(n*.71+j*2)-j*90;
        for(let j=0;j<2;j++){
            const zz=ez+122+j*2,ink=j?lower:hills;
            const a=V(x0,bottom,zz),c=V(x1,bottom,zz),d=V(x0,ridge(i,j),zz),e=V(x1,ridge(i+1,j),zz);
            b.tri(a,c,d,ink);b.tri(d,c,e,ink);
        }
    }
    b.box([820,45,135],[ex,ground+739,ez+130],'#987652');
    // Thin flowering stems rise out of the silvery lavender cushions.
    for(let i=0;i<12;i++){
        const z=-2820-i*445, x=path(z)-flip*1070;
        for(let j=0;j<5;j++){
            const a=j*2.4+i,h=560+(j%3)*70;
            const base=V(x+Math.cos(a)*95,ground+340,z+Math.sin(a)*95);
            const head=V(x+Math.cos(a)*260,ground+h,z+Math.sin(a)*210);
            limb(b,base,head,10,'#818f72');
            limb(b,head,head.clone().add(V(14*Math.cos(a),115,14*Math.sin(a))),22,j%2?'#8e81a9':'#a99cb5');
        }
    }
    // the garden wall, old brick with a coping, the arched gate where the path meets it
    masonry(b, r, -26000, gateX - 800, ground, wallZ, 2400, '#9e6e58'); masonry(b, r, gateX + 800, 26000, ground, wallZ, 2400, '#9e6e58');
    b.box([1700, 600, 380], [gateX, ground + 2700, wallZ], '#8e6a58'); b.box([1300, 2300, 60], [gateX, ground + 1150, wallZ + 20], '#4f5b4f');
    for (const s of [-1, 1]) b.box([300, 2900, 420], [gateX + s * 800, ground + 1450, wallZ], '#8e6a58');
    const arch = new THREE.RingGeometry(660, 824, 18, 1, 0, Math.PI);
    b.add(arch, M(gateX,ground+2260,wallZ+219), () => colour('#bc8c70'));
    arch.dispose();
    for (let j = 0; j < 9; j++) {
        const a = Math.PI*j/8;
        limb(b,V(gateX+666*Math.cos(a),ground+2260+666*Math.sin(a),wallZ+225),
            V(gateX+818*Math.cos(a),ground+2260+818*Math.sin(a),wallZ+225), 13, '#897165');
    }
    for (const h of [410,1750]) b.box([1280,96,58],[gateX,ground+h,wallZ+115],'#697362');
    for (let j = -3; j <= 3; j++) b.box([16,2210,32],[gateX+j*175,ground+1120,wallZ+70],'#394e42');
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
        // Near the glass the daylight shows through the gaps between the pinnae.
        // A narrower pair of facets per leaflet carries its central fold.
        const count = Math.abs(z) < 6500 ? 11 : 7;
        const onFrond = t => V(x, ground + len * ((rise + .82) * t - (rise + .3) * t*t), z).addScaledVector(out,len*t);
        let prev = onFrond(0);
        for (let i=1; i<=count; i++) {
            const t=i/count, p=onFrond(t), rachis=prev.clone().addScaledVector(side,len*.005);
            b.tri(prev,rachis,p,c);
            for(const sign of [-1,1]) {
                const start=prev.clone().lerp(p,.23);
                const wing=len*(.047+.093*Math.sin(Math.PI*t))*(1-.60*t);
                const tip=start.clone().addScaledVector(side,sign*wing).addScaledVector(out,wing*.34);
                tip.y+=wing*(.45-.73*t);
                const mid=start.clone().lerp(tip,.5); mid.y+=len*.01;
                const upper=mid.clone().addScaledVector(out,wing*.22);
                const lower=mid.clone().addScaledVector(out,-wing*.16);
                b.tri(start,upper,tip,c);
                b.tri(start,tip,lower,c.clone().multiplyScalar(.82));
            }
            prev=p;
        }
    }
}

// ---- the north coast campus under a marine layer (the Humboldt commons): pure coast redwoods on soft forest duff,
// no other scenery (no campus buildings, paths, street lamps, benches or clutter).
//   facing 0 (the back wall's tall glass): pure redwood grove on forest floor (subtle ground bollards only after dark).
//   facing 1 (the right glass seen in ch4 commons — slotPane & frontPane): one large redwood framing the slot window,
//     a mid-sized and a small redwood naturally spaced in the front window. No other scenery.
//   facing 2 (the hall end's vestibule): quiet pair of redwoods on forest floor.
function humboldt(k, ctx) {
    if (ctx.classic) return humboldtClassic(k, ctx);   // (the Commons' Classic look)
    const { land: b, r } = k, ground = ctx.ground - 120, L = ctx.left - 12000, R = ctx.right + 12000, cx = (ctx.left + ctx.right) / 2;
    // Two wooded slopes close the horizon beyond the individual trees. Keep their
    // random stream separate so the foreground trunks retain their film marks.
    const hills = rand(ctx.seed + 739);
    for (const [z, elevation, pigment] of [[-164000, 17500, '#657d74'], [-96000, 8900, '#485f53']]) {
        ridge(b, hills, z, ground - 3600, cx - 330000, cx + 330000, elevation, pigment, { step: 2200, rough: .18, bumps: .45 });
    }
    // The broken upper edge is made of separate redwood crowns on the nearer slope.
    for (let x = cx - 122000; x <= cx + 122000; x += 1300 + hills() * 2300) {
        const z = -86500 - hills() * 5800, height = 5900 + 2500 * Math.sin(x / 16900) + hills() * 4400;
        const width = 1000 + hills() * 1100, tint = colour(hills() < .5 ? '#405d50' : '#526d5b');
        const lean = (hills() - .5) * width * .8, levels = 16;
        let prev;
        for (let row = 0; row <= levels; row++) {
            const t = row / levels, y = ground + height*t, center = x + lean*t*t;
            const radius = width * Math.pow(1-t,.63) * (row % 2 ? .65 : 1);
            const branch = () => radius * (.75 + hills()*.45);
            const edge = [V(center - branch(), y - radius*hills()*.38, z),
                V(center, y, z + radius*.56), V(center + branch(), y - radius*hills()*.38, z)];
            if (prev) for (let side = 0; side < 2; side++) {
                b.tri(prev[side], prev[side+1], edge[side], tint);
                if (row < levels) b.tri(prev[side+1], edge[side+1], edge[side], tint);
            }
            prev = edge;
        }
    }
    const moss = colour('#667448'), duff = colour('#664833'), out = new THREE.Color();
    const forestFloor = (zNear, zMid, zFar) => land(b, ground, L, R, zNear, zMid, zFar, (x, z) => {
        const p = Math.sin(x / 1900) * Math.sin(z / 1500) * .5 + .5;
        return out.copy(duff).lerp(moss, p * (.52+.35*Math.sin(z/6900))).multiplyScalar(.82 + r() * .18);
    });
    if (ctx.facing === 0) {
        // Pure redwood grove outside the back glass (natural forest duff floor; no bench, nurse log or clutter).
        forestFloor(ctx.near - 60, -18000, -70000);
        // Subtle low ground bollards stay completely invisible by day (lamp = 0 in morning/afternoon) and give warm night depth.
        for (const x of [cx - 4200, cx + 4200]) pathLight(k, x, ground, -6500);
        // Near & mid redwoods plus a distant misty redwood stand so near/far parallax reads naturally.
        const nearTrunks = [
            [cx - 3200, -6800, 46000, 1.40, .055],
            [cx + 3600, -9800, 26000, .72, .075],
            [cx + 1200, -14500, 14500, .38, .065],
            [cx - 9500, -15500, 44000, 1.20, .08],
            [cx + 10200, -16500, 38000, 1.05, .09],
            [cx - 4800, -24000, 48000, 1.15, .14],
            [cx + 5800, -26000, 44000, 1.05, .15],
            [cx - 8200, -21000, 42000, 1.05, .12],
            [cx + 8800, -22000, 40000, 1.00, .12],
            [cx - 14000, -28000, 46000, 1.10, .14],
            [cx + 15000, -30000, 45000, 1.05, .15]
        ];
        for (const [x, z, h, g, start] of nearTrunks) redwood(b, r, x, ground, z, { height: h, girth: g, start });
        for (let x = L - 20000; x < R + 20000; x += 3800 + r() * 1800) redwood(b, r, x, ground, -42000 - r() * 14000, { height: 46000, girth: 1.1, start: .14, size: 2200 });
        for (const [x, z, , g] of nearTrunks.slice(0, 6)) redwoodRoots(b, x, ground, z, 650 * g);
        return;
    }
    if (ctx.facing === 2) {
        // Pure redwoods outside the entry vestibule (no concrete plaza, bike racks, shrubs or street lamps).
        forestFloor(ctx.near - 60, -14000, -60000);
        for (const [x, z, h, g] of [[cx - 5200, -10500, 44000, 1.25], [cx + 4600, -13500, 24000, .68]]) {
            redwood(b, r, x, ground, z, { height: h, girth: g, start: .08 });
            redwoodRoots(b, x, ground, z, 650 * g);
        }
        return;
    }
    // facing 1: the right-wall windows seen throughout Chapter 4 (commons) — slotPane and frontPane.
    // Pure redwoods on soft forest floor; no buildings, paths, shrubs, maples, lamps or other scenery.
    forestFloor(Math.max(...ctx.openings.map(o => o.z)) - 60, -16000, -70000);
    // Window 1 (slotPane): one large redwood framed cleanly in Yara's desk close-up (Shot 2) and room wide (Shot 3).
    // The two sight corridors are 8 m apart and non-overlapping, so each shot shows one majestic large redwood.
    for (const [x, z, h, g] of [
        [-7600, -7200, 48000, 1.40],
        [  250, -8500, 48000, 1.35]
    ]) {
        redwood(b, r, x, ground, z, { height: h, girth: g, start: .048 });
        redwoodRoots(b, x, ground, z, 650 * g);
    }
    // Window 2 (frontPane): one mid-sized and one small redwood, naturally spaced, visible behind Mia (Shot 5) and during the dolly (Shot 4b).
    for (const [x, z, h, g, start] of [
        [10750, -12500, 24000, .68, .075],
        [13750, -19500, 13000, .36, .065],
        [18800, -13500, 24000, .68, .075],
        [22200, -18000, 13000, .36, .065]
    ]) {
        redwood(b, r, x, ground, z, { height: h, girth: g, start });
        if (g >= .6) redwoodRoots(b, x, ground, z, 650 * g);
    }
}

// ---- a city street (the gym, the music room; the neon version for the gaming room). Our building's front: a planter
// and railings, the pavement with plane trees and street lamps, a road with a few parked cars, the far pavement, then
// what is across: a composition per room, so no two city rooms (and not the film's three city chapters in a row) see
// the same picture, and the sky has its share of the window:
//   'street' (default): a row of four- to seven-storey buildings with shops, a side street off to one side of the window
//   'corner': the side street at the window's edge, the row beside it taller
//   'low': a low row of one- and two-storey shops with a car park opposite the window; mid-rise blocks and towers beyond
//   'square': a square with plane trees and a kiosk across the street, its far side a row of blocks
//   'civic' / 'hospital': a plaza and, across it, a stone building with a portico / a medical block with a canopy
// From high up (storey 12 m and more) the room looks over a roofscape to towers far off and the sky (highCity).
// The storey (the room's floor above the street) decides how much of the street is seen. After dark: lamps and their
// pools, a few lit windows and shopfronts, the odd car's lights; neon: signs over the shops and on the towers.
const NEON = ['#ff4fa8', '#46d6ff', '#a066ff', '#ff9a4a', '#5cf0a8'];
const TOWER_WALLS = ['#8f979d', '#a3a6a8', '#5f6a74', '#a69f94', '#4f5a66', '#9a9488', '#3f4852', '#b8ad9c', '#6c7a86'];
// A block drawn plainly, its windows a grid in the shader (far rows, towers): a box, a parapet, things on its roof.
function plainBlock(k, r, x, ground, z, { width, depth, height, wall, roof = true, crown = false, terrace = false }) {
    const b = k.land; if (!seen(b, x, z, width / 2 + 3000)) return;
    const c = colour(wall).offsetHSL(0, 0, (r() - .5) * .06);
    b.box([width, height, depth], [x, ground + height / 2, z], c, 0, null, { facade: true });
    b.box([width + 200, 600, depth + 200], [x, ground + height + 300, z], c.clone().multiplyScalar(.9));
    if (crown) b.box([width * .6, height * .08, depth * .6], [x, ground + height * 1.04, z], c.clone().multiplyScalar(.85), 0, null, { facade: true });
    if (roof && !terrace && Math.abs(z) < 120000) {
        if (r() < .7) b.box([width * (.2 + r() * .2), 2200, depth * .25], [x + (r() - .5) * width * .4, ground + height + 1100, z + (r() - .5) * depth * .3], '#8f8b84');
        if (r() < .45) { const tx = x + (r() - .5) * width * .6, tz = z + (r() - .5) * depth * .4; b.add(TANK, M(tx, ground + height + 3000, tz, 1200, 2400, 1200), () => colour('#6f5f50')); b.box([1600, 1800, 1600], [tx, ground + height + 900, tz], '#4a4b4c'); }
        for (let i = 0, m = Math.floor(r() * 4); i < m; i++) b.box([1200, 900, 1000], [x + (r() - .5) * width * .7, ground + height + 450, z + (r() - .5) * depth * .6], '#a09f9b');
    }
    if (terrace) plantedRoof(k, r, x, ground + height + 600, z, width, depth);
    else if (roof && Math.abs(z)<68000) roofDetail(b,x,ground+height+600,z,width,depth);
    if (!roof && crown) {
        const top=ground+height;
        b.box([width*.39,height*.045,depth*.43],[x,top+height*.102,z],c.clone().multiplyScalar(.82));
        for(const sign of [-1,1])b.box([width*.045,height*.16,depth*.035],[x+sign*width*.27,top,z+depth*.30],c);
        if(height>90000)pole(b,x,top+height*.124,z,height*.085,200,'#747e86');
    }
    b.footing(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2, ground, 3000, .35, 3000);
}
const TANK = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
// towers far off, with wide gaps: the skyline
function skyline(k, r, cx, ground, { near = -300000, far = -1100000, min = 60000, max = 170000, every = [70000, 160000], neon = false } = {}) {
    for (let z = near; z > far; z -= 160000 + r() * 120000) {
        const span = 400000 + Math.abs(z) * 1.2;
        for (let x = cx - span + r() * every[1]; x < cx + span; x += every[0] + r() * (every[1] - every[0])) {
            if (r() < .35) continue;
            const width = 22000 + r() * 30000, height = min + r() * (max - min) * (Math.abs(z) > 600000 ? 1 : .8);
            plainBlock(k, r, x, ground, z - r() * 60000, { width, depth: width * (.7 + r() * .5), height, wall: pick(r, TOWER_WALLS), roof: false, crown: r() < .3 });
            if (neon && r() < .3) { const c = pick(r, NEON); k.lights.box([width * .6, 2200, 300], [x, ground + height - 4000, z + width * .5], c); }
        }
    }
}
// Occupied roofs across from the gym. The low planting and timber shade frame sit
// below the distant skyline, with an ornamental tree offset to one side.
function plantedRoof(k, r, x, top, z, width, depth) {
    const b = k.land, front = z + depth / 2, deck = '#aa8261', rail = '#496863';
    b.box([width - 200, 90, depth - 200], [x, top + 45, z], deck);
    for (let i = -4; i <= 4; i++)
        b.box([width - 300, 12, 28], [x, top + 94, z + depth * i / 10], '#705849');
    for (const side of [-1, 1]) {
        b.box([130, 930, depth], [x + side * (width / 2 - 65), top + 465, z], rail);
        b.box([width, 240, 170], [x, top + 120, z + side * (depth / 2 - 85)], '#aa6348');
        b.box([width, 65, 80], [x, top + 1050, z + side * (depth / 2 - 85)], rail);
        for (let j = -4; j <= 4; j++)
            b.box([45, 850, 45], [x + width * j / 8.2, top + 620, z + side * (depth / 2 - 85)], rail);
    }
    const px = x - width * .21, pz = z - depth * .15;
    for (const dx of [-2450, 2450]) for (const dz of [-1450, 1450])
        b.box([130, 2550, 130], [px + dx, top + 1365, pz + dz], rail);
    for (const dz of [-1450, 1450])
        b.box([5300, 200, 150], [px, top + 2620, pz + dz], '#986444');
    for (let j = -4; j <= 4; j++)
        b.box([240, 150, 3500], [px + j * 600, top + 2790, pz], '#c39765');
    bench(b, px, top + 90, pz);
    k.lights.box([3900, 50, 65], [px, top + 2520, pz + 1450], '#edc998');
    b.light(px, top + 1500, pz, '#e9bc87', 3300, .42);
    for (const side of [-1, 1]) {
        const bx = x + side * width * .26, bz = front - 1350;
        b.box([4300, 580, 1400], [bx, top + 380, bz], '#ae674b');
        b.box([4180, 40, 1280], [bx, top + 675, bz], '#534239');
        for (let i = -1; i <= 1; i++)
            shrub(b, r, bx + i * 1280, top + 700, bz, 650, i ? '#52774b' : '#879454');
    }
    const tx = x + width * .24, tz = z - depth * .17;
    b.box([2500, 720, 2500], [tx, top + 450, tz], '#687b75');
    tree(b, r, tx, top + 810, tz, { height: 3600, hex: '#708e52', shape: 'ornamental' });
    // A continuous band of recessed steel sash and a projecting sill under the parapet.
    b.box([width, 420, 200], [x, top - 1000, front], rail);
    const bay = (width - 1200) / 5;
    for (let i = -2; i <= 2; i++) {
        const sashX = x + i * bay;
        b.box([bay - 380, 1950, 100], [sashX, top - 2230, front + 65], '#45636b');
        b.box([75, 1950, 145], [sashX, top - 2230, front + 65], '#404c4f');
        b.box([bay - 250, 110, 260], [sashX, top - 3240, front + 60], '#b09d87');
    }
}

function highCity(k, ctx, opts, neon) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, eye = ctx.storey + 1600, out = new THREE.Color();
    const street = colour('#4a4b4e');
    k.hazeFar = 170000;
    groundPlane(b, ground, cx - 160000, cx + 160000, -130000, -9000, 6000, () => out.copy(street).multiplyScalar(.9 + r() * .15));
    groundPlane(b, ground - 30, cx - 900000, cx + 900000, -1400000, -130000, 45000, () => out.copy(street).multiplyScalar(1 + r() * .1));
    // the roofscape below: rows of blocks, most of them lower than the room, a few taller off to the sides
    const rows = [-15000, -36000, -62000, -95000, -138000, -195000, -265000];
    for (const z of rows) {
        const d = Math.abs(z), bw = 15000 + d * .1, gap = 7000 + d * .03, span = 30000 + d * 2.6;
        for (let x = cx - span + r() * bw; x < cx + span; x += bw * (.7 + r() * .6) + gap) {
            const tall = r() < .14 && Math.abs(x - cx) > ctx.width / 2 + bw, height = eye * (tall ? 1.05 + r() * .5 : .32 + r() * .5) + 3000;
            const terrace = opts.includes('square') && Math.abs(x - cx) < 36000 && ((z === rows[0] && x <= cx) || (z === rows[1] && x > cx));
            plainBlock(k, r, x, ground, z - r() * gap, { terrace, width: bw * (.7 + r() * .4), depth: 14000 + d * .08, height, wall: pick(r, ['#a49a8c', '#b5ab9c', '#8f8478', '#9c9a94', '#a8806c', '#7c7a78', '#94604e', '#c4b8a4', '#6e6a66']) });
            if (neon && r() < .25 && d < 100000) { const c = pick(r, NEON); k.lights.box([bw * .4, 1200, 200], [x, ground + height - 2500, z + 9000], c); k.halos.add(x, ground + height - 2500, z + 9500, bw * .3, c, .2); }
        }
        // the street in front of each row: its lamps after dark
        for (let x = cx - span; x < cx + span; x += 24000 + r() * 8000) if (seen(b, x, z, 2000)) { k.lights.box([500, 200, 500], [x, ground + 6500, z + 12000], '#ffd29a'); k.halos.add(x, ground + 6500, z + 12000, 2400, '#ffcf90', .3); }
    }
    skyline(k, r, cx, ground, { near: -340000, far: -1300000, min: eye * .8 + 30000, max: eye + 160000, neon });
}
function city(k, ctx, { neon = false } = {}) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, L = ctx.left - 30000, R = ctx.right + 30000;
    const kerb = -5200, far = -15400, across = -19000, asphalt = colour('#4a4c50'), paving = colour('#a29d94'), out = new THREE.Color();
    // variant: what stands nearest the glass ('balcony', 'ledge', 'glass' balustrade, 'planters' on a terrace, 'louvres',
    // 'flowerbox', 'bars', 'open', 'dock') and what is across (a composition, above), joined with '+'
    const opts = (ctx.variant || '').split('+'), civic = opts.includes('civic'), hospital = opts.includes('hospital'), plaza = civic || hospital;
    const comp = plaza ? 'plaza' : ['square', 'low', 'corner'].find(c => opts.includes(c)) || 'street', high = ctx.storey >= 12000 && !plaza;
    const side = r() < .5 ? -1 : 1, hasCross = comp === 'street' || comp === 'corner';
    const crossX = comp === 'corner' ? cx + side * (ctx.width / 2 + 6500) : cx + side * (ctx.width / 2 + 5000 + r() * 9000), crossW = hasCross ? 11000 : 0;
    const inCross = (x, pad = 0) => hasCross && Math.abs(x - crossX) < crossW / 2 + pad;
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
    if (opts.includes('ledge')) { b.box([span, 160, 420], [cx, ctx.bottom - 110, -300], '#b5ad9f'); b.box([span, 320, 120], [cx, ctx.bottom - 330, -150], '#a8a092'); }
    if (opts.includes('planters')) { b.box([span, 200, 2400], [cx, fy - 100, -1300], '#8f8a82');
        for (let x = cx - span / 2 + 600; x < cx + span / 2; x += 2200) { b.box([1600, 600, 700], [x, fy + 300, -2100], '#6e6a64'); shrub(b, r, x, fy + 600, -2100, 520, pick(r, ['#58744c', '#62804f']), { size: 80 }); } }
    if (high) return highCity(k, ctx, opts, neon);
    const fill = (x, z) => {
        if (comp === 'square' && z < far - 2600 && z > -58000) return out.copy(paving).multiplyScalar(((Math.floor(x / 1200) + Math.floor(z / 1200)) % 2 ? .9 : .97) * (.95 + r() * .06));
        if (comp === 'low' && z < far - 2600 && z > across - 12000 && Math.abs(x - cx) < 9000) { const bay = Math.abs(((x % 2600) + 2600) % 2600) < 90 && z > across - 9000; return bay ? out.set(.7, .69, .64) : out.copy(asphalt).multiplyScalar(.98 + r() * .1); }
        if (z < far - 2600 && inCross(x)) { const lane = Math.abs(x - crossX) < 70 && (z % 6000 + 6000) % 6000 < 3000; return lane ? out.set(.62, .6, .52) : Math.abs(x - crossX) > crossW / 2 - 2600 ? out.copy(paving).multiplyScalar(.95) : out.copy(asphalt).multiplyScalar(.92 + r() * .1); }
        if (z > kerb) return out.copy(paving).multiplyScalar((Math.floor(x / 900) + Math.floor(z / 900)) % 2 ? .94 : 1).multiplyScalar(.95 + r() * .05);
        if (z > kerb - 250 || (z < far && z > far - 250)) return out.copy(paving).multiplyScalar(.8);
        if (z > far) return out.copy(asphalt).multiplyScalar(.92 + r() * .1);
        return out.copy(paving).multiplyScalar(.92 + r() * .06); };
    land(b, ground, L, R, -60, -24000, -90000, fill, 600);
    const centreLine=(kerb+far)/2;
    for(let x=L+2000; x<R-2000; x+=6000) {
        if(!inCross(x,1800))paint(b,x,ground,centreLine,2800,110,'#c8bd91');
    }
    if(hasCross){
        for(let i=0;i<9;i++) paint(b,crossX-crossW*.57,ground,kerb-850-i*1040,2300,450,'#cabfa7');
    }
    for(let x=L+1300;x<R;x+=1440)paint(b,x,ground,(kerb-60)/2,14,-kerb-80,'#817f77');
    if(opts.includes('open'))bicycle(b,cx-span*.22,ground,-2440,.91,'#a86445');
    groundPlane(b, ground - 20, cx - 900000, cx + 900000, -1400000, -90000, 30000, () => out.copy(asphalt).multiplyScalar(1.05 + r() * .1));
    // our side: a planter and railings against the building (seen from the ground floor), then the pavement
    if (ctx.storey < 2500 && !opts.includes('open') && !opts.includes('dock')) {
        b.box([ctx.width + 6000, 450, 900], [cx, ground + 225, -700], '#8f8a82');
        for (let x = ctx.left - 3000; x < ctx.right + 3000; x += 420 + r() * 200) shrub(b, r, x, ground + 450, -700 + (r() - .5) * 300, 230 + r() * 120, pick(r, ['#58744c', '#4f6b47', '#62804f']), { size: 70 });
        for (let x = ctx.left - 3000; x <= ctx.right + 3000; x += 130) b.box([22, 1000, 22], [x, ground + 950, -1250], '#2e3134');
        b.box([ctx.width + 6000, 40, 50], [cx, ground + 1450, -1250], '#2e3134');
    }
    if (opts.includes('open')) { bench(b, cx + span * .25, ground, -1800, 0, '#4a4c4e'); for (let i = 0; i < 3; i++) { const x = cx - span * .3 + i * 900; limb(b, V(x, ground, -2600), V(x, ground + 800, -2600), 25, '#3a3d40'); limb(b, V(x, ground + 800, -2600), V(x + 600, ground + 800, -2600), 25, '#3a3d40'); limb(b, V(x + 600, ground + 800, -2600), V(x + 600, ground, -2600), 25, '#3a3d40'); }
        b.box([600, 900, 400], [cx - span * .05, ground + 450, -1500], '#2f3a36'); }
    if (opts.includes('dock')) { b.box([span + 6000, ctx.storey, 2600], [cx, ground + ctx.storey / 2, -1360], '#9d9a92'); b.box([span + 6000, 120, 160], [cx, ground + ctx.storey, -2560], '#c9a83a');
        for (let x = cx - span / 2 - 2000; x <= cx + span / 2 + 2000; x += 2400) b.box([220, 1000, 220], [x, ground + ctx.storey + 500, -2300], '#d8b43a'); }
    // the near pavement's trees and lamps, the far pavement's (never right in front of the window: the street is what
    // the room looks at)
    for (let x = L + 8000 + r() * 3000; x < R - 8000; x += 9000 + r() * 3000) {
        if (Math.abs(x - cx) < ctx.width / 2 + 2600) continue;
        tree(b, r, x, ground, kerb + 1200, { height: 9000 + r() * 2000, hex: pick(r, ['#647f4e', '#6c8754', '#5c7849']), bark: '#8b8170', shape: 'tall' });
        b.box([1200, 30, 1200], [x, ground + 15, kerb + 1200], '#5b5045');
    }
    for (let x = L + 4000 + r() * 6000; x < R; x += 16000) streetLamp(k, x, ground, kerb + 500, { height: 7000, reach: 1600, face: -1, hex: neon ? '#ffd2a8' : '#ffd29a' });
    for (let x = L + 12000 + r() * 6000; x < R; x += 16000) if (Math.abs(x - cx) > ctx.width / 2 + 1500) streetLamp(k, x, ground, far - 500, { height: 7000, reach: 1600, face: 1, hex: neon ? '#ffd2a8' : '#ffd29a' });
    if (comp !== 'square') for (let x = L + 6000 + r() * 4000; x < R - 8000; x += 10000 + r() * 4000) if (!inCross(x, 1500) && Math.abs(x - cx) > ctx.width / 2 + 3500) tree(b, r, x, ground, far - 1500, { height: 8500 + r() * 2000, hex: pick(r, ['#647f4e', '#5c7849']), bark: '#8b8170', shape: 'tall' });
    // a few parked cars, a little askew, none right in front of the window; one going each way (lamps on after dark)
    for (const [z, dir] of [[kerb - 1200, 1], [far + 1200, -1]]) for (let x = L + 5000 + r() * 4000; x < R - 5000; x += 6500 + r() * 5000) {
        if (r() < .45 || (z === kerb - 1200 && Math.abs(x - cx) < ctx.width / 2 + 3000)) continue;
        car(k, r, x, ground, z + (r() - .5) * 300, { turn: (dir < 0 ? Math.PI : 0) + (r() - .5) * .08 });
    }
    for (const [x, z, dir] of [[cx - 12000 + r() * 4000, kerb - 3700, 1], [cx + 9000 + r() * 5000, far + 3700, -1]]) {
        car(k, r, x, ground, z, { turn: dir < 0 ? Math.PI : 0 }); k.lights.box([60, 160, 1400], [x + dir * 2250, ground + 650, z], '#fff2dc'); k.lights.box([60, 140, 1400], [x - dir * 2250, ground + 700, z], '#d23a2a');
        k.halos.add(x + dir * 2400, ground + 650, z, 700, '#fff0d8', .3); b.light(x + dir * 5000, ground + 400, z, '#fff0d8', 3500, .25);
    }
    // what is across the street
    const walls = neon ? ['#8d8a86', '#7a7470', '#a09a92', '#6e6a68', '#9a8f84'] : ['#b9ab97', '#c9bfae', '#a8907a', '#bdb4a6', '#9d8270', '#cfc6b8'];
    const row = (x0, x1, fn) => { for (let x = x0; x < x1;) { const width = Math.min(x1 - x, 9000 + r() * 9000); if (width > 4000) fn(x, width); x += width; } };
    let marqueePlaced=false;
    const block = (floors, z = across - 7000) => (x, width) => { const f = typeof floors === 'function' ? floors() : floors;
        building(k, r, x + width / 2, ground, z, { width: width - 200, depth: 14000, floors: f, material: pick(r, neon ? ['brick', 'render', 'panel', 'stone'] : ['brick', 'brick', 'stone', 'render', 'panel']), litRate: neon ? .5 : .45, warm: neon ? .45 : .75, neon: neon ? NEON : null });
        if(neon && !marqueePlaced && x+width>cx-5400 && x<cx+14500){
            neonMarquee(k,x+width/2,ground,z+7250,width);
            marqueePlaced=true;
        }
        if (neon && r() < .5) { const c = pick(r, NEON), bx = x + width * (.15 + r() * .7); k.lights.box([380, 4200, 120], [bx, ground + 7500, z + 7400], c); k.halos.add(bx, ground + 7500, z + 7900, 2600, c, .25); b.light(bx, ground + 6000, z + 10000, c, 5000, .25); }
    };
    if (plaza) {   // a paved plaza (or forecourt) and, across it, the civic building or the medical block
        const bz = across - 26000 - (hospital ? 18000 : 0), flagX = cx + (r() - .5) * 6000, bw = 60000;
        if (civic) {
            building(k, r, cx, ground, bz - 9000, { width: bw, depth: 18000, floors: 4, storey: 4400, shops: false, material: 'stone', bays: 16, litRate: .3 });
            const face = bz;   // the portico: steps, columns, a pediment
            for (let i = 0; i < 4; i++) b.box([26000 - i * 600, 300, 1200], [cx, ground + 150 + i * 300, face + 4600 - i * 1100], '#cfc6b4');
            for (let i = 0; i < 8; i++) b.add(new THREE.CylinderGeometry(500, 560, 10500, 12, 1, true), M(cx - 10500 + i * 3000, ground + 1200 + 5250, face + 1800), () => colour('#ddd5c4'));
            b.box([25000, 1200, 3000], [cx, ground + 12300, face + 1500], '#d6cdbb');
            const ped = new THREE.Shape(); ped.moveTo(-12800, 0); ped.lineTo(0, 3200); ped.lineTo(12800, 0); ped.closePath(); const pg = new THREE.ExtrudeGeometry(ped, { depth: 2800, bevelEnabled: false });
            b.add(pg, M(cx, ground + 12900, face + 100), () => colour('#d2c9b6'), { facet: true }); pg.dispose();
            for (let i = 0; i < 3; i++) { const x = flagX - 4000 + i * 4000; pole(b, x, ground, -21000, 11000, 70, '#c9c9c4');
                const cloth = colour(['#5a718e', '#9b564a', '#d8d2c2'][i]);
                const hem = (t, dy) => V(x + t*1780, ground + 10650 + dy - 260*t*t,
                    -21000 + t*280*Math.sin(t*9+i));
                for (let j = 0; j < 9; j++) {
                    const u=j/9, v=(j+1)/9;
                    b.tri(hem(u,0), hem(u,-1050), hem(v,0), cloth);
                    b.tri(hem(v,0), hem(u,-1050), hem(v,-1050), cloth);
                } }
        } else {
            building(k, r, cx, ground, bz - 9000, { width: bw, depth: 18000, floors: 4, storey: 3800, shops: false, style: 'band', wall: '#d4d2cc', glass: '#4a5a66', litRate: .5, warm: .4, cornice: false, roof: '#cfcac0', bays: 14 });
            b.box([22000, 400, 7000], [cx, ground + 4200, bz + 3500], '#e3e1dc'); for (let x = cx - 10000; x <= cx + 10000; x += 5000) pole(b, x, ground, bz + 6700, 4000, 120, '#b9bcbe');
            for (let x = cx - 9000; x <= cx + 9000; x += 3000) { k.lights.box([600, 40, 600], [x, ground + 3980, bz + 3500], '#f2f4f0'); }
            b.light(cx, ground + 3500, bz + 4000, '#eef2f0', 7000, .4);
            b.box([5200, 2400, 2100], [cx + 6000, ground + 1690, bz + 9000], '#e8e6e0'); b.box([1600, 1900, 2000], [cx + 8600, ground + 1430, bz + 9000], '#e8e6e0'); b.quad(2000, 260, [cx + 6000, ground + 1500, bz + 10060], colour('#a8433a'));
            const vanX = cx + 6000, vanZ = bz + 9000;
            b.quad(1180, 720, [vanX+2580, ground+2050, vanZ+1015], '#405963');
            b.quad(1900, 560, [vanX-250, ground+2000, vanZ+1065], '#536770');
            const tyre = new THREE.CylinderGeometry(440, 440, 220, 18).rotateX(Math.PI/2);
            const hub = new THREE.CylinderGeometry(215, 215, 230, 14).rotateX(Math.PI/2);
            for (const dx of [-1700, 2530]) for (const sign of [-1, 1]) {
                b.add(tyre, M(vanX+dx,ground+445,vanZ+sign*1000), () => colour('#343b3c'));
                b.add(hub, M(vanX+dx,ground+445,vanZ+sign*1004), () => colour('#8f9895'));
            }
            tyre.dispose(); hub.dispose();
            for (let x = cx - 30000; x <= cx + 30000; x += 9000) if (Math.abs(x - cx) > 8000) tree(b, r, x, ground, bz + 14000, { height: 8000, hex: '#62804e', shape: 'round' });
        }
        for (let x = cx - 22000; x <= cx + 22000; x += 7300) { if (Math.abs(x - flagX) < 6000 && civic) continue; b.box([2200, 500, 2200], [x, ground + 250, -26000], '#a49d90'); tree(b, r, x, ground + 500, -26000, { height: 7000, hex: '#62804e', shape: 'round' }); }
        for (let x = cx - 24000; x <= cx + 24000; x += 2400) b.box([220, 900, 220], [x, ground + 450, far - 900], '#6a6c6e');
    } else if (comp === 'square') {   // a square: plane trees in rows, benches, a kiosk, a fountain; its far side a row of blocks
        for (let z = -24000; z > -54000; z -= 9000) for (let x = cx - 40000 + (z / 9000 % 2) * 4500; x < cx + 40000; x += 9000) {
            if (Math.abs(x - cx) < ctx.width / 2 + 3500 && z > -36000) continue;
            tree(b, r, x + (r() - .5) * 1500, ground, z + (r() - .5) * 1500, { height: 10000 + r() * 3000, hex: pick(r, ['#5f7a4b', '#68834f', '#57724a']), bark: '#8b8170', shape: 'round' }); }
        for (let x = cx - 30000; x < cx + 30000; x += 6000) if (r() < .6) bench(b, x, ground, -21500, 0, '#5d4f42');
        const kx = cx + side * 9000; b.box([4200, 3000, 3000], [kx, ground + 1500, -33000], '#3f4a44'); b.box([5200, 300, 4000], [kx, ground + 3150, -33000], '#2f3632');
        k.lights.quad(3600, 1300, [kx, ground + 1500, -31480], colour('#f0c898').multiplyScalar(.35)); b.light(kx, ground + 1500, -30000, '#ffd9a8', 4000, .3);
        b.add(new THREE.CylinderGeometry(3200, 3300, 500, 22, 1), M(cx - side * 4000, ground + 250, -40000), () => colour('#bdb5a6'));
        b.add(new THREE.CylinderGeometry(2900, 2900, 20, 22, 1), M(cx - side * 4000, ground + 490, -40000), () => colour('#5f7884'), { light: false });
        for (let x = cx - 40000; x < cx + 40000; x += 12000) pathLight(k, x, ground, -27000, '#ffdcae', .5);
        row(L - 20000, R + 20000, block(() => 3 + Math.floor(r() * 2), -65000));
    } else if (comp === 'low') {   // a low row of shops; a car park opposite the window, a billboard on it
        row(L, cx - 9000, block(() => 1 + Math.floor(r() * 2)));
        row(cx + 9000, R, block(() => 1 + Math.floor(r() * 2)));
        b.box([18000, 900, 300], [cx, ground + 450, far - 2400], '#8f8a82');
        for (let x = cx - 7800; x < cx + 7800; x += 2600) if (r() < .55) car(k, r, x + 1300, ground, across - 5000, { turn: Math.PI / 2 + (r() - .5) * .1 });
        const bx = cx + side * 10500; for (const s of [-1, 1]) pole(b, bx + s * 2500, ground, across - 11000, 7500, 160, '#5a5c5e');
        b.box([7000, 3200, 300], [bx, ground + 9000, across - 11000], '#4f5560'); b.quad(6600, 2800, [bx, ground + 9000, across - 10840], colour('#25606a'));
        // Screen-printed record sleeve on the billboard above the rehearsal-room street.
        const printZ = across - 10824, recordX = bx - 1490, recordY = ground + 9000;
        const disc = new THREE.CircleGeometry(1110, 40);
        b.add(disc, M(recordX, recordY, printZ), () => colour('#24363e')); disc.dispose();
        for (const radius of [355, 780, 905]) {
            const ring = new THREE.RingGeometry(radius-31, radius, 40);
            b.add(ring, M(recordX, recordY, printZ+4), () => colour('#d19b73')); ring.dispose();
        }
        for (let j = 0; j < 11; j++) {
            const h = 380 + 1430 * Math.sin((j+1)*Math.PI/12)**2;
            b.quad(146, h, [bx+180+j*242, recordY, printZ], j<7?'#d18b61':'#d9c393');
        }
        k.lights.box([7000, 120, 200], [bx, ground + 10700, across - 10800], '#f0e6d0'); b.light(bx, ground + 9000, across - 9000, '#f4ecd8', 3500, .2);
        for (let x = L - 20000; x < R + 20000;) { const width = 14000 + r() * 14000;
            plainBlock(k, r, x + width / 2, ground, -56000 - r() * 12000, { width, depth: 16000, height: (2 + Math.floor(r() * 3)) * 3300, wall: pick(r, walls) }); x += width + 3000 + r() * 9000; }
        for (let x = L - 60000; x < R + 60000;) { const width = 18000 + r() * 16000; if (r() < .6) plainBlock(k, r, x + width / 2, ground, -120000 - r() * 40000, { width, depth: 20000, height: (4 + Math.floor(r() * 5)) * 3300, wall: pick(r, walls) }); x += width + 6000 + r() * 14000; }
    } else {
        row(L, crossX - crossW / 2, block(() => (comp === 'corner' ? 4 : 3) + Math.floor(r() * 4))); row(crossX + crossW / 2, R, block(() => 3 + Math.floor(r() * 4)));
        // down the side street: its lamps, the sides of the blocks along it (windows on the street), a car going away
        for (const s of [-1, 1]) for (let z = across - 16000; z > -50000; z -= 14000 + r() * 4000) {
            const w = 12000, x = crossX + s * (crossW / 2 + w / 2), floors = 3 + Math.floor(r() * 5);
            building(k, r, x, ground, z, { width: w, depth: 13000, floors, material: pick(r, ['brick', 'stone', 'render']), litRate: neon ? .5 : .4, warm: .7, shops: false, side: -s, cornice: false });
        }
        for (let z = far - 6000; z > -52000; z -= 12000) for (const s of [-1, 1]) streetLamp(k, crossX + s * (crossW / 2 - 900), ground, z, { height: 6500, reach: 0, face: 1, hex: neon ? '#ffd2a8' : '#ffd29a', power: .8 });
        { const z = -30000 - r() * 8000, x = crossX + 1800; car(k, r, x, ground, z, { turn: Math.PI / 2 }); k.lights.box([1300, 140, 60], [x, ground + 700, z + 2250], '#d23a2a'); k.halos.add(x, ground + 700, z + 2400, 800, '#ff4030', .3); }
        for (let x = L - 20000; x < R + 20000;) { const width = 14000 + r() * 12000;
            plainBlock(k, r, x + width / 2, ground, -60000 - r() * 10000, { width, depth: 18000, height: (4 + Math.floor(r() * 5)) * 3300, wall: pick(r, walls) }); x += width + 4000 + r() * 10000; }
    }
    // far off: the towers
    skyline(k, r, cx, ground, { near: -260000, far: -1000000, min: 40000, max: 140000, neon });
}
const CITY_NIGHT = { morning: {haze:.17, air:'#99adbc', horizon:'#d6c8ae'}, afternoon:{haze:.13,air:'#8caac3'}, night: { horizon: '#3a3a4e', air: '#2a2c3a', stars: .25, tint: [.13, .14, .2] }, party: { horizon: '#36334a', air: '#26263a', stars: .15 } };
const NEON_NIGHT = { ...CITY_NIGHT, evening: { horizon: '#d98a70', zenith: '#4a4f82' }, night: { zenith: '#0e0f22', horizon: '#33304a', air: '#24223a', stars: .1, tint: [.12, .12, .19] }, party: { zenith: '#10112a', horizon: '#3a3150', air: '#282640', stars: .05 } };

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
    for (const x of [-3900, -900, 2100, 5100])
        paint(b, cx+x, ground, -2300, 21, 4310, '#888578');
    const drainX = cx + flip*1930;
    b.box([390, 24, 880], [drainX, ground+10, -1770], '#646860');
    for (let i = -5; i <= 5; i++)
        b.box([346, 9, 34], [drainX, ground+25, -1770+i*72], '#3f4845');
    const benchZ=-2590;
    for(const support of [-1,1]){
        const x=cx+support*990;
        for(const dx of [-1,1])for(const dz of [-1,1]){
            limb(b,V(x+dx*275,ground,benchZ+dz*465),V(x+dx*160,ground+745,benchZ+dz*285),36,'#967656');
        }
        b.box([440,80,790],[x,ground+760,benchZ],'#a48666');
        for(const side of [-1,1])b.box([440,65,48],[x,ground+255,benchZ+side*396],'#987757');
        b.shadow(x,ground,benchZ,630,600,.32,260);
    }
    for(let j=0;j<3;j++){
        const length=[2900,3080,2790][j];
        b.box([length,55,135],[cx+(j-1)*75,ground+827,benchZ+(j-1)*146],['#b79268','#c4a47b','#ae8c67'][j]);
    }
    for (let i = 0; i < 4; i++) b.box([1200, 90, 1000], [cx - flip * 2600, ground + 45 + i * 90, -3200], '#b5aea2', .04, r);
    // the lean-to with the lumber rack, the shed
    const lx = cx + flip * (w / 2 + 6000), lz = -7800;
    for (const dx of [-2400, 2400]) for (const dz of [-1200, 1200]) b.box([120, 2700, 120], [lx + dx, ground + 1350, lz + dz], '#7f6a55');
    b.box([5600, 80, 3000], [lx, ground + 2750, lz], '#8d9298');
    for (let i = -7; i <= 7; i++) b.box([55, 48, 2980], [lx+i*364, ground+2810, lz], '#a8adab');
    for (let level = 0; level < 4; level++) {
        const y = ground + 430 + level*340;
        for (const dx of [-1840, 1840]) b.box([100, 135, 2210], [lx+dx, y-112, lz], '#706450');
        const timber = pick(r, ['#bb956d', '#d1b18a', '#b48c67']);
        for (let j = 0; j < 5; j++) {
            const length = 4380 + 280*Math.sin(level*8 + j*3);
            b.box([length, 145, 335], [lx+80*Math.cos(j), y, lz+(j-2)*369], timber);
        }
    }
    const sx = cx - flip * 6500, sz = -12500;
    house(k, r, sx, ground, sz, { width: 4200, depth: 3200, eaves: 2400, ridge: 1100, wall: '#8c9a88', roof: '#5d5a56', lit: [], porch: false, storeys: 1 });
    // a work trailer and a pickup
    const tx=cx+flip*1800, tz=-9500;
    b.box([3630,120,1780],[tx,ground+640,tz],'#59625f');
    for(let i=0;i<7;i++)b.box([3540,68,238],[tx,ground+738,tz+(i-3)*252],i%2?'#947757':'#a18968');
    const tyre=new THREE.CylinderGeometry(355,355,214,20).rotateX(Math.PI/2);
    const rim=new THREE.CylinderGeometry(185,185,225,16).rotateX(Math.PI/2);
    for(const side of [-1,1]){
        const ax=tx-250, az=tz+side*975;
        b.add(tyre,M(ax,ground+355,az),()=>colour('#303436'));
        b.add(rim,M(ax,ground+355,az+side*9),()=>colour('#919896'));
        b.box([1020,68,292],[ax,ground+757,az],'#69777a');
        for(const dx of [-1690,0,1690])b.box([50,520,50],[tx+dx,ground+976,tz+side*865],'#566667');
        b.box([3460,62,50],[tx,ground+1240,tz+side*865],'#667577');
        limb(b,V(tx+1750,ground+620,tz+side*780),V(tx+3100,ground+490,tz),54,'#667072');
    }
    pole(b,tx+2570,ground,tz,550,52,'#757c7b');
    b.shadow(tx,ground,tz,2100,1100,.62,530);
    // Sheeted sliding door in the shed's original opening.
    const doorZ=sz+1640;
    b.box([1970,2130,70],[sx,ground+1065,doorZ],'#63756b');
    for(let j=-4;j<=4;j++)b.box([27,2080,22],[sx+j*213,ground+1065,doorZ+44],'#839388');
    b.box([2290,105,170],[sx,ground+2230,doorZ+65],'#525b54');
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
// The coast beyond: the land falls away past `edge` down a scrubby bluff (`drop` below) to a strip of the beach town
// (stucco blocks and houses under clay-tile roofs, palms), the coast road, a broad beach at `shore` with its wet edge
// and surf, and the Pacific out to the horizon (k.sea: drawn by its own shader, the sky in it, the sun's glitter low in
// the evening). Seen from a floor up on the bluff the sea is a band six to ten degrees deep, as in the photograph.
function coast(k, ctx, edge, drop, shore, townFrom, townTo, mediaLab = false) {
    const { land: b, r } = k, ground = ctx.ground, low = ground - drop, cx = (ctx.left + ctx.right) / 2, out = new THREE.Color();
    const scrub = colour('#7c8460'), dry = colour('#a39a78'), sand = colour('#d8ccae'), wet = colour('#a8a08a'), road = colour('#55575a');
    // Low drifts of coastal sage on the lip of the bluff, leaving sightlines
    // to the beach and pier between them.
    const planting = rand(ctx.seed + 61);
    for (let group = -2; group <= 2; group++) {
        const x = cx + group*7300 + 1400, z = edge + 1100 + planting()*760;
        for (let j = 0; j < 4; j++) {
            const px = x+j*620, pz = z+410*Math.sin(j+group);
            shrub(b, planting, px, ground, pz, 410+planting()*230, j%2?'#74845e':'#87967c', {size:145});
            if (j === 1) flowers(b, planting, px, ground+400, pz+190, 350, 15, ['#cb963e','#d7af68'], 53);
        }
    }
    const roadZ = townTo - 2500, sandZ = roadZ - 3500;
    groundPlane(b, low, cx - 260000, cx + 260000, sandZ, edge - 2000, 3000, (x, z) => z > roadZ + 2200 ? out.copy(dry).lerp(scrub, .5 + .5 * Math.sin(x / 7000 + z / 5000)).multiplyScalar(.85 + r() * .15) : z > roadZ - 2200 ? out.copy(road).multiplyScalar(.95 + r() * .08) : out.copy(sand).multiplyScalar(.9));
    groundPlane(b, low - 200, cx - 700000, cx + 700000, shore - 2000, sandZ, 8000, (x, z) => out.copy(z < shore + 9000 ? wet : sand).multiplyScalar(.93 + r() * .07 + .04 * Math.sin(x / 13000)));
    // the bluff's face: a steep slope of scrub between the school's ground and the town's
    { const geo = new THREE.PlaneGeometry(560000, Math.hypot(drop, 9000), 140, 4); geo.rotateX(-Math.PI / 2 - Math.atan2(drop, 9000)); b.add(geo, M(cx, ground - drop / 2, edge - 4500), (p) => out.copy(scrub).lerp(dry, .5 + .5 * Math.sin(p.x / 3000)).multiplyScalar(.75 + r() * .2)); geo.dispose(); }
    for (let x = cx - 70000; x < cx + 70000; x += 2500 + r() * 3000) shrub(b, r, x, ground - 1500 - r() * drop * .6, edge - 2000 - r() * 6000, 900 + r() * 700, pick(r, ['#62704c', '#6e7a52', '#58664a']), { size: 300 });
    // the town: blocks and houses under tile roofs, palms among them
    for (let z = townFrom; z > townTo; z -= 14300 + r() * 3000) for (let x = cx - 80000 - r() * 10000; x < cx + 80000; x += 17700 + r() * 5300) {
        if (r() < .2) { fanPalm(b, r, x, low, z, { height: 16000 + r() * 8000 }); continue; }
        const width = 9000 + r()*6000, depth = 8000 + r()*3000, eaves = r() < .5 ? 6000 : 3200;
        const wall = pick(r, ['#e4d3b7', '#c5cfc4', '#e5dbcb', '#c39579', '#ded0ae']);
        const roof = pick(r, ['#ae664d', '#91715d', '#ae7756', '#79665a']);
        house(k, r, x, low, z, { width, depth, eaves, ridge: 2200, storeys: eaves > 4000 ? 2 : 1, wall, roof, lit: r() < .5 ? [0, 3] : [2], porch: false });
        const face = z + depth/2;
        b.box([width+470, 175, 190], [x, low+eaves, face+310], '#a7947b');
        b.box([width+490, 190, 290], [x, low+eaves+2190, z], '#97715d');
        const porchX = x - width*.13;
        b.box([width*.51, 125, 1180], [porchX, low+2420, face+580], '#748a85');
        for (const side of [-1, 1]) pole(b, porchX+side*width*.23, low, face+1070, 2370, 74, '#eee0c6');
    }
    for (let x = cx - 90000; x < cx + 90000; x += 18000 + r() * 12000) streetLamp(k, x, low, roadZ + 2600, { height: 7000, reach: 1400, face: -1, power: .7 });
    for (let x = cx - 90000; x < cx + 90000; x += 9000 + r() * 16000) if (r() < .5) car(k, r, x, low, roadZ + (r() < .5 ? 1100 : -1100), { turn: (r() < .5 ? 0 : Math.PI) });
    for (let i = 0; i < 9; i++) { const x = cx + (r() - .5) * 160000; for (let j = 0; j < 2 + Math.floor(r() * 3); j++) fanPalm(b, r, x + (r() - .5) * 5000, low, sandZ + 2500 + r() * 2500, { height: 15000 + r() * 9000 }); }
    tidalBeach(k,cx,low,shore);
    if(mediaLab) mediaPier(b,cx,low,shore);
    else beachLookout(b,cx+12000,low,shore+11200);
    // A small sail outside the breakers gives a moving camera a scale cue
    // between the town and the horizon.
    const boat=V(cx+(mediaLab?82000:-52000),low-200,shore-75000);
    b.box([4400,560,1400],[boat.x,boat.y+270,boat.z],'#6e716d');
    const mast=boat.clone().add(V(0,7800,0));limb(b,boat,mast,65,'#827c6c');
    b.tri(mast,boat.clone().add(V(110,1100,0)),boat.clone().add(V(3050,1450,0)),colour('#e9e1cb'));
    b.tri(mast.clone().add(V(-80,-1000,0)),boat.clone().add(V(-160,1300,0)),boat.clone().add(V(-2080,940,80)),colour('#c99c78'));
    k.sea = { y: low - 300, x0: cx - 1000000, x1: cx + 1000000, z0: -1150000, z1: shore - 1500, color: mediaLab ? '#17647b' : '#266d80' };
}
// Tidal sand and three discontinuous breaker lines follow the same shoreline.
function tidalBeach(k, cx, sea, shore) {
    const b=k.land;
    const waterline=x=>shore-6500-3100*Math.sin(x/49000)-1350*Math.sin(x/16700);
    function ribbon(start,end,step,edges,color) {
        const points=[];
        for(let x=start;x<end;x+=step) {
            const nx=Math.min(x+step,end),[a,b]=edges(x),[c,d]=edges(nx);
            points.push(x,a[0],a[1], nx,c[0],c[1], x,b[0],b[1],
                x,b[0],b[1], nx,c[0],c[1], nx,d[0],d[1]);
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.computeVertexNormals();
        const pigment=typeof color==='string'?colour(color):null;
        b.add(g,M(cx,0,0),pigment?()=>pigment:color,{two:true});g.dispose();
    }
    ribbon(-350000,350000,4500,x=>[[sea+80,shore+12000],[sea-120,waterline(x)]],
        p=>colour('#d7bb92').multiplyScalar(.96+.04*Math.sin(p.x/8300)));
    ribbon(-350000,350000,3600,x=>[[sea-99,waterline(x)+4900],[sea-126,waterline(x)-1500]],'#ac9983');
    for(let line=0;line<3;line++){
        for(let x=-320000;x<320000;){
            const length=16000+k.r()*36000, gap=4000+k.r()*11000;
            ribbon(x,x+length,2400,u=>{
                const t=(u-x)/length, crest=waterline(u)-3200-line*6100+900*Math.sin(u/9200+line);
                return [[sea-140,crest],[sea-140,crest-(520+line*150)*Math.sin(Math.PI*t)]];
            },line===0?'#e8eee3':'#b5cfc9');
            x+=length+gap;
        }
    }
}
function beachLookout(b,x,y,z){
    const deck=y+2450;
    for(const dx of [-1500,1500]) for(const dz of [-1100,1100]) {
        b.box([170,2460,170],[x+dx,y+1230,z+dz],'#897861');
        limb(b,V(x-dx,y+250,z+dz),V(x+dx,deck-150,z+dz),65,'#86735a');
    }
    b.box([4600,200,3400],[x,deck,z],'#a89374');
    b.box([3000,2100,2000],[x,deck+1110,z-290],'#729da2');
    b.quad(2700,740,[x,deck+1510,z+725],'#344e57');
    b.box([3900,160,2800],[x,deck+2270,z-300],'#d1c7a7');
    for(const dx of [-1800,1800])pole(b,x+dx,deck,z+1460,930,30,'#bcb29e');
    limb(b,V(x-1800,deck+930,z+1460),V(x+1800,deck+930,z+1460),30,'#bcb29e');
    for(let i=0;i<9;i++)b.box([390,120,700],[x-2250-i*300,deck-i*270,z+520],'#a39885');
}
function mediaPier(b,cx,sea,shore){
    // A timber pier runs out diagonally from the berm. Piles, cross-bracing,
    // top rails and the shelter cast distinct silhouettes from the upstairs room.
    const foot=V(cx-18000,sea+4400,shore+5200), run=V(.32,0,-1).normalize(), side=V(-run.z,0,run.x);
    const at=(s,y,w)=>foot.clone().addScaledVector(run,s).addScaledVector(side,w).setY(y);
    const span=6800, bays=26, deck=foot.y, timber=colour('#8e7d67');
    for(let i=0;i<=bays;i++) {
        const s=i*span;
        for(const w of [-1800,1800]){
            const post=at(s,sea-500,w);pole(b,post.x,post.y,post.z,6200,166,'#655548');
            if(i===bays)continue;
            limb(b,at(s,deck+990,w),at(s+span,deck+990,w),78,'#b8aa93');
            limb(b,at(s,deck-420,w),at(s+span,sea+750,w),110,'#615246');
        }
        if(i===bays)break;
        b.add(BOX_UNIT,M(...at(s+span/2,deck,0).toArray(),4200,380,span+8,-Math.atan2(run.x,-run.z)),()=>timber);
    }
    const end=at(bays*span-3300,deck,0);
    for(const x of [-2100,2100])for(const z of [-2300,2300])pole(b,end.x+x,deck,end.z+z,3000,100,'#978572');
    b.box([6400,320,6400],[end.x,deck+3070,end.z],'#607d7b');
    // Low offshore hills in the marine layer. The open horizon continues on the right.
    const height=x=>Math.max(0, 23500*Math.exp(-(((x+195000)/95000)**2))
        + 14100*Math.exp(-(((x+97000)/46000)**2)) + 1600*Math.sin(x/16300));
    for(let x=-440000;x<45000;x+=6000){
        const profile=u=>{
            const h=height(u),z=-644000+5900*Math.sin(u/62000);
            return [V(cx+u,sea-600,z),V(cx+u,sea+h*.37,z-12000),V(cx+u,sea+h,z-27000)];
        };
        const a=profile(x),c=profile(x+6000);
        for(let j=0;j<2;j++){
            const ink=colour(j?'#596f7a':'#667f86');
            b.tri(a[j],c[j],c[j+1],ink,1);b.tri(a[j],c[j+1],a[j+1],ink,1);
        }
    }
}
function socal(k, ctx, kind) {
    const { land: b, r } = k, ground = ctx.ground, cx = (ctx.left + ctx.right) / 2, L = ctx.left - 30000, R = ctx.right + 30000;
    const lawnC = colour('#7d8a62'), dry = colour('#a39d7c'), conc = colour('#c3bcae'), track = colour('#9a5a48'), out = new THREE.Color();
    if (kind === 'campus') {
        // Orange Coast College from the media lab, upstairs at the mesa's edge: a planted strip and the walk below, the
        // quad with jacarandas and benches to either side, palms along the walk, a block across one side of the quad,
        // the car park on the other, and past the edge of the mesa the town, the beach and the sea.
        const walk = z => z > -4500 && z < -1800, quadEnd = -22000, edge = -36000;
        land(b, ground, L, R, -60, -30000, edge, (x, z) => {
            if (walk(z) || (Math.abs(x - cx - 4000) < 1500 && z > quadEnd + 6000)) return out.copy(conc).multiplyScalar((Math.floor(x / 1500) % 2 ? .95 : 1) * (.96 + r() * .05));
            if (z > -1800) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
            if (z > quadEnd) { const p = Math.sin(x / 2600) * Math.sin(z / 2100) * .5 + .5; return out.copy(lawnC).lerp(dry, p * .3).multiplyScalar(.93 + r() * .07); }
            if (z < quadEnd && z > edge + 2000 && x > cx + 9000) return out.copy(colour('#56585a')).multiplyScalar((Math.abs(((x % 2700) + 2700) % 2700) < 90) ? 1.5 : .95 + r() * .08);
            return out.copy(dry).multiplyScalar(.9 + r() * .1); }, 600);
        for (let x = ctx.left - 6000; x < ctx.right + 6000; x += 900 + r() * 700) { if (r() < .5) agave(b, r, x, ground, -900 - r() * 600, 450 + r() * 300, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a'])); else shrub(b, r, x, ground, -1000 - r() * 500, 450 + r() * 200, pick(r, ['#5f7a4c', '#6c8452']), { size: 120 }); }
        for (let x = ctx.left - 12000; x < ctx.right + 12000; x += 9000) { if (Math.abs(x - cx) > ctx.width / 2 + 3000) featherPalm(b, r, x + r() * 2000, ground, -6000 - r() * 1500, { height: 7000 + r() * 2500, fine: true }); pathLight(k, x + 4500, ground, -5000); }
        for (let x = ctx.left - 4000; x < ctx.right + 8000; x += 6000 + r() * 4000) bench(b, x, ground, -5200, 0, '#b8b2a6');
        // the quad's trees, kept to its sides (the view down the middle is the sea's): jacarandas, a coral tree
        for (const [x, z, h, j] of [[-13000, -12000, 8000, 1], [12500, -15000, 8500, 0], [-19000, -19000, 8000, 0], [21000, -18000, 9000, 1], [-27000, -14000, 8500, 0]]) {
            tree(b, r, cx + x, ground, z, { height: h, hex: j ? '#86849a' : '#6e8656', shape: 'spreading', bark: '#6f655c' }); }
        for (let x = L - 20000; x < R + 20000; x += 7000 + r() * 6000) if (Math.abs(x - cx) > 9000 || r() < .3) fanPalm(b, r, x, ground, quadEnd + 3000 + r() * 3000, { height: 14000 + r() * 9000 });
        campusBlock(k, r, cx-36000,ground,quadEnd-4000,{width:26000,floors:3});
        featherPalm(b,r,cx-6600,ground,-12200,{height:10500,fine:true});
        featherPalm(b,r,cx+9800,ground,-14600,{height:11900,fine:true});
        for (let x = cx + 11000; x < R + 20000; x += 5200 + r() * 1200) if (r() < .6) car(k, r, x, ground, quadEnd - 4000 - Math.floor(r() * 2) * 5000, { turn: Math.PI / 2 });
        floodlight(k, cx + 26000, ground, edge + 3000, 11000);
        coast(k, ctx, edge, 10000, -142000, -66000, -108000, true);
        return;
    }
    // Huntington Beach High from a classroom a floor up on the bluff: succulents and a walk below, the fence, the school's
    // lawn with palms in clumps, the track and bleachers off to the left with their floodlights, a pumpjack on the right;
    // past the lawn the bluff falls to the town, the coast road, the beach and the sea.
    const fenceZ = -5200, edge = -13000, trackX = cx - 16000;
    land(b, ground, L - 40000, R + 40000, -60, -8000, edge, (x, z) => {
        if (z > -3200) return out.copy(conc).multiplyScalar(.95 + r() * .05);
        if (z > fenceZ) return out.copy(colour('#7d6a56')).multiplyScalar(.9 + r() * .1);
        if (x < trackX && z < -6000 && z > -11000) { const lane = Math.abs(((z + 7000) % 1220 + 1220) % 1220) < 50; return lane ? out.set(.85, .82, .78) : out.copy(track).multiplyScalar(.92 + r() * .08); }
        if (false) { const yard = Math.abs(((x - trackX) % 4570 + 4570) % 4570) < 70; return yard ? out.set(.82, .82, .78) : out.copy(lawnC).multiplyScalar(((Math.floor((x - trackX) / 4570) % 2) ? .92 : 1.02) * (.96 + r() * .04)); }
        return out.copy(lawnC).lerp(dry, .45 + .2 * Math.sin(x / 4000)).multiplyScalar(.9 + r() * .1); }, 600);
    for (let x = ctx.left - 4000; x < ctx.right + 4000; x += 600 + r() * 500) agave(b, r, x, ground, -800 - r() * 700, 380 + r() * 260, pick(r, ['#7f9a84', '#8aa48a', '#6f8c7a', '#8e9a6a']));
    grass(b, r, ctx.left - 3000, ctx.right + 3000, -4700, -3400, ground, 300, '#7d8a5a', 260);
    fence(b, r, L, R, ground, fenceZ, { kind: 'chain', height: 2400 });
    bleachers(b, trackX - 30000, trackX - 6000, ground, -6500, 7);
    for (const x of [trackX - 34000, trackX - 2000]) floodlight(k, x, ground, -11500, 22000, 1);
    // palms in clumps of two to four, every one its own height and lean (not a fence of poles)
    for (const [x, z] of [[trackX + 3000, -10500], [cx + 12000, -10000], [cx + 26000, -9500]]) for (let j = 0, n = 2 + Math.floor(r() * 2); j < n; j++) fanPalm(b, r, x + (r() - .5) * 3000, ground, z + (r() - .5) * 1500, { height: 12000 + r() * 12000 });
    for (let x = ctx.left - 14000; x < ctx.right + 14000; x += 11000 + r() * 3000) if (Math.abs(x - cx) > ctx.width / 2 + 2000) tree(b, r, x, ground, -7000 - r() * 1500, { height: 6500, hex: '#6c8452', shape: 'round' });
    pumpjack(b, cx - 36000, ground - 20000, -40000, .6, 1);
    coast(k, ctx, edge, 20000, -145000, -55000, -84000);
}
const SOCAL = { morning: { zenith:'#6e98b9', horizon: '#c5d3d7', air: '#a5bac0', haze: .27 }, afternoon: { zenith: '#4b90bb', horizon: '#bfdbe0', air: '#adc5ca', haze: .25, tint: [1, .98, .93] }, evening: { sun: [32, 3, '#ffa060', 1.0] } };

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
    const b = k.land, front = z + depth / 2, entry = x + width * .05;
    b.box([5000,3680,200],[entry,ground+1840,front+135],'#ae9b82');
    b.quad(3420,3190,[entry,ground+1595,front+248],'#425554');
    for(const dx of [-1640,0,1640])b.box([92,3200,110],[entry+dx,ground+1600,front+300],'#766d5d');
    b.box([5440,250,1890],[entry,ground+3650,front+900],'#b6a489');
    for(const sign of [-1,1])pole(b,entry+sign*2370,ground,front+1690,3540,115,'#c8b99f');
    k.lights.box([1240,40,160],[entry,ground+3490,front+1300],'#ecd6ad');
    b.light(entry,ground+2560,front+2130,'#e5c39b',4100,.36);
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
        if (z < -30000 && z > -32500) return out.copy(path).multiplyScalar(.94 + r() * .06);
        const patch = Math.sin(x / 2700) * Math.sin(z / 2200) * .5 + .5; return out.copy(lawnC).lerp(dry, patch * .35).multiplyScalar(.93 + r() * .07); }, 500);
    // Follow the actual route with edged strips. Expansion joints stay square
    // to the walk even when seen at a grazing angle from the upper floor.
    for(const route of paths){
        const from=v==='court'?-8850:-160,to=-30800,half=920;
        const slab=(xa,za,xb,zb,wide,y,c)=>{
            const left=V(xa-wide,y,za),right=V(xa+wide,y,za),end=V(xb+wide,y,zb);
            b.tri(left,right,end,c);b.tri(left,end,V(xb-wide,y,zb),c);
        };
        slab(route(from),from,route(to),to,half+76,ground+12,colour('#90877a'));
        for(let z=from, i=0;z>to;z-=1840,i++){
            const last=Math.max(z-1825,to);
            const pigment=colour(i%4===0?'#c5b8a2':'#cdbfa9');
            slab(route(z),z,route(last),last,half,ground+17,pigment);
        }
    }
    // nearest the glass
    if (v === 'court') { const fx=cx+f*1500, fz=-5200;
        const rim=new THREE.RingGeometry(2300,2630,48).rotateX(-Math.PI/2);
        const outer=new THREE.CylinderGeometry(2630,2690,550,48,1,true);
        const inside=new THREE.CylinderGeometry(2300,2300,210,48,1,true);
        const water=new THREE.CircleGeometry(2300,48).rotateX(-Math.PI/2);
        b.add(outer,M(fx,ground+275,fz),()=>colour('#ad9f8b'));
        b.add(rim,M(fx,ground+550,fz),()=>colour('#d1c5ae'));
        b.add(inside,M(fx,ground+445,fz),()=>colour('#988e7d'));
        b.add(water,M(fx,ground+410,fz),()=>colour('#648887'));
        b.add(new THREE.CylinderGeometry(350,620,700,20),M(fx,ground+740,fz),()=>colour('#8d9b8e'));
        for(let n=0;n<6;n++){
            const a=n*Math.PI/3,jet=t=>V(fx+Math.cos(a)*(280+t*1190),ground+1060+650*Math.sin(Math.PI*t)-650*t,fz+Math.sin(a)*(280+t*1190));
            for(let i=0;i<7;i++)limb(b,jet(i/7),jet((i+1)/7),22,'#b8cecb');
            const end=jet(1), ripple=new THREE.RingGeometry(220,247,22).rotateX(-Math.PI/2);
            b.add(ripple,M(end.x,ground+416,end.z),()=>colour('#9bb7ae'));ripple.dispose();
        }
        rim.dispose();outer.dispose();inside.dispose();water.dispose();
        for (const s of [-1, 1]) bench(b, fx + s * 4200, ground, fz + 1200, s * .4, '#6a5a4a'); }
    else for (let x = ctx.left - 2500; x < ctx.right + 2500; x += 900 + r() * 500) shrub(b, r, x, ground, -1200 - r() * 500, 420 + r() * 160, pick(r, ['#567148', '#5f7a4c', '#4f6a44']), { size: 90 });
    // trees: oaks and maples, one or two turning
    const spots = v === 'quad' ? [[-9000, -11000], [8000, -13000], [-15000, -21000], [14000, -22000], [-3000, -24000]] : [[-7000, -9000], [11000, -12500], [-15000, -17000], [3000, -20000], [19000, -21000], [-23000, -24000]];
    for (const [x, z] of spots) { const turn = r() < .2; tree(b, r, cx + f * x + jit(2000), ground, z + jit(2000), { height: 8000 + r() * 4000, hex: turn ? pick(r, ['#a8743e', '#b5603c', '#9a8a44']) : pick(r, ['#5e7a4a', '#66804c', '#58744a']), shape: r() < .5 ? 'spreading' : 'round', bark: '#5a4d42' }); }
    for (let z = -6000; z > -30000; z -= 8000) { const x = paths[0](z); pathLight(k, x + 1300, ground, z, '#ffdcae', .6); if (r() < .6) bench(b, x - 1600, ground, z - 1500, f * Math.PI / 2, '#5d4f42'); }
    const border = rand(ctx.seed + 211);
    for (let i = 0; i < 13; i++) {
        const z = -10200-i*840, x = paths[0](z)+f*(2050+260*Math.cos(i*.62));
        if (Math.abs(x-paths[1](z))<2150) continue;
        shrub(b, border, x, ground, z, 375+i%3*44, i%3?'#6c835b':'#849269', {size:105});
        if (i%4 !== 0) flowers(b, border, x, ground+390, z, 310, 16, ['#aa805b','#bbbb83','#b88c9e'], 57);
    }
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
    // The secondary school has a full court. The younger classes share a
    // painted four-square and hopscotch strip beside the play structure.
    if (v === 'middle') {
        const bx=cx-f*1600, cz=-14700, ink='#ede8d7';
        paint(b,bx,ground,cz,25800,13600,'#496b76');
        for(const side of [-1,1]){
            paint(b,bx,ground+4,cz+side*6550,25200,85,ink);
            paint(b,bx+side*12550,ground+4,cz,85,13100,ink);
            const boardX=bx+side*12200;
            pole(b,bx+side*13700,ground,cz,3580,76,'#6e7b7b');
            limb(b,V(bx+side*13700,ground+3460,cz),V(boardX,ground+3450,cz),68,'#6e7b7b');
            b.box([60,1050,1800],[boardX,ground+3310,cz],'#d8dfd9');
            basket(b,boardX,ground,cz,-side,0);
            for(const sign of [-1,1])paint(b,bx+side*9720,ground+4,cz+sign*1980,5590,70,ink);
            paint(b,bx+side*6960,ground+4,cz,70,3960,ink);
        }
        for (const side of [-1, 1]) {
            // Free-throw semicircles at the key, marked on the actual playing surface.
            const arc = new THREE.RingGeometry(1905, 1980, 32, 1, -Math.PI/2, Math.PI);
            arc.rotateX(-Math.PI/2);
            b.add(arc, M(bx+side*6960, ground+12, cz, 1,1,1, side>0?Math.PI:0), () => colour(ink));
            arc.dispose();
        }
        paint(b,bx,ground+4,cz,80,13100,ink);
        const ring=new THREE.RingGeometry(1560,1635,44).rotateX(-Math.PI/2);
        b.add(ring,M(bx,ground+11,cz),()=>colour(ink));ring.dispose();
    } else {
        const hx = cx - f * 3500, hz = -6500;
        for (let i=0;i<8;i++) paint(b,hx+(i%3===1?0:(i%2?-350:350)),ground,hz-i*650,600,600,pick(r,['#d8c24a','#e8e4d8','#c8604a','#4a8ac8']));
        paint(b,cx+f*4000,ground,-9500,6000,6000,'#b45c48');
        paint(b,cx+f*4000,ground+4,-9500,5800,80,'#e8e4d8');
        paint(b,cx+f*4000,ground+4,-9500,80,5800,'#e8e4d8');
    }
    // the play structure: a deck on posts, a roof, a slide, a climbing wall; swings; a hoop; a shade sail
    if (v !== 'middle') {
        const px = cx + f * (w / 2 + 3500), pz = -13000, small = v === 'kinder' ? .7 : 1;
        const pad = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI/2);
        b.add(pad, M(px-f*1250,ground+5,pz,4300,1,2770), () => colour('#946f57'));
        b.add(pad, M(px-f*1250,ground+9,pz,4020,1,2510), () => colour('#b48f67'));
        pad.dispose();
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box([150, 3200 * small, 150], [px + dx * 1100, ground + 1600 * small, pz + dz * 1100], '#2f6a9a');
        b.box([2400, 120, 2400], [px, ground + 1500 * small, pz], '#d8a83a'); b.add(new THREE.ConeGeometry(1900, 1300 * small, 4, 1).rotateY(Math.PI / 4), M(px, ground + 3800 * small, pz), () => colour('#c8503a'), { facet: true });
        b.add(BOX_UNIT, new THREE.Matrix4().compose(V(px - f * 2600, ground + 800 * small, pz + 300), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), f * .5), V(3000, 60, 700)), () => colour('#e0b030'));
        b.box([60, 1500 * small, 2300], [px + f * 1250, ground + 750 * small, pz], '#3a8a6a'); for (let i = 0; i < 12; i++) b.box([120, 100, 140], [px + f * 1300, ground + 200 + r() * 1200 * small, pz + jit(2000)], pick(r, ['#d8503a', '#e8c040', '#4a8ac8']));
        const sx = cx - f * (w / 2 + 4500), sz = -16000; for (const s of [-1, 1]) { limb(b, V(sx + s * 1700, ground, sz - 900), V(sx + s * 1700, ground + 2400 * small, sz), 50, '#4a8a5a'); limb(b, V(sx + s * 1700, ground, sz + 900), V(sx + s * 1700, ground + 2400 * small, sz), 50, '#4a8a5a'); }
        b.box([3600, 90, 90], [sx, ground + 2400 * small, sz], '#4a8a5a'); for (const s of [-.5,.5]) {
            const x=sx+s*1700;
            for(const dx of [-205,205])limb(b,V(x+dx,ground+2370*small,sz),V(x+dx,ground+510,sz),9,'#535c60');
            b.box([500,40,220],[x,ground+480,sz],'#2a2c30');
        }
        if (v !== 'kinder') { const bx = cx + f * 9000; pole(b, bx, ground, -22000, 3000, 80, '#6a6c6e'); b.box([1800, 1050, 60], [bx, ground + 3300, -21800], '#e8e6e0'); basket(b,bx,ground,-21800,0,1); }
    }
    // Shade the spectator sideline in the middle school and the play seating
    // in the other two yards. Keep the poles off the playing surface.
    const shadeZ=v==='middle'?-5550:-16400, shadeX=cx+f*4300;
    const shade=[V(shadeX-3500,ground+3200,shadeZ),V(shadeX+3200,ground+3900,shadeZ-600),V(shadeX+650,ground+3050,shadeZ-2350)];
    shadeSail(b,shade);
    for(const p of shade)limb(b,V(p.x,ground,p.z),p,55,'#788480');
    bench(b,shadeX,ground,shadeZ-950,0,'#977658');
    // nearest the glass
    if (v === 'kinder') { b.box([2600, 300, 2600], [cx + f * 800, ground + 150, -3000], '#a07a56'); b.box([2400, 40, 2400], [cx + f * 800, ground + 290, -3000], '#e2d4a8');
        b.box([w + 1600, 500, 600], [cx, ground + 250, -1100], '#9a7a5a'); for (let x = cx - w / 2 - 600; x < cx + w / 2 + 600; x += 450) { sunflower(b,x,ground+500,-1100,830+r()*540,1+r()*3.3); } }
    if (v === 'elementary') for (let x = cx - 3000; x <= cx + 3000; x += 700) { limb(b, V(x, ground, -2600), V(x, ground + 800, -2600), 25, '#8d9296'); limb(b, V(x, ground + 800, -2600), V(x + 450, ground + 800, -2600), 25, '#8d9296'); limb(b, V(x + 450, ground + 800, -2600), V(x + 450, ground, -2600), 25, '#8d9296'); }
    if(v==='elementary'){
        bicycle(b,cx-1720,ground,-2700,.90,'#547e80');
        bicycle(b,cx+930,ground,-2620,1.05,'#a85c40');
    }
    // the low fence, trees, the school's wing across, houses beyond
    fence(b, r, cx - 30000, cx + 30000, ground, fenceZ, { kind: 'chain', height: 1200 });
    for (let x = cx - 26000; x <= cx + 26000; x += 7000 + r() * 4000) if (Math.abs(x - cx) > w / 2 + 3000 || r() < .3) tree(b, r, x, ground, fenceZ - 2500 - r() * 2000, { height: 7000 + r() * 3000, hex: pick(r, ['#62804e', '#6c8754', '#5c7849']), shape: 'round' });
    const wingX = cx-f*4000+jit(6000), wingFront = -37000;
    const wing = building(k, r, wingX, ground, -45000, { width: 50000, depth: 16000, floors: v === 'middle' ? 2 : 1, storey: 4200, shops: false, material: 'render', bays: 12, litRate: .3, cornice: false });
    if (wing) for (let i = 0; i < 8; i++) {
        const x = wingX - 21000 + i*6000, enamel = pick(r, ['#af6654','#548198','#be984e','#638d77']);
        b.box([3200, 170, 920], [x, ground+3510, wingFront+440], enamel);
        b.box([3200, 390, 90], [x, ground+3360, wingFront+870], enamel);
        for (const side of [-1, 1]) limb(b, V(x+side*1410,ground+2900,wingFront+50),
            V(x+side*1410,ground+3430,wingFront+795), 46, '#677673');
    }
    for (let x = cx - 60000; x <= cx + 60000; x += 13000 + r() * 6000) house(k, r, x, ground, -70000 - r() * 8000, { width: 9000, wall: pick(r, ['#d6cab5', '#cbbfae', '#c8c2b6']), roof: pick(r, ['#96705e', '#7c6a64']), lit: [0, 2] });
    for (let x = cx - 70000; x <= cx + 70000; x += 3000 + r() * 1000) crown(b, r, x, ground + 2400 + r() * 1200, -85000 - r() * 6000, 3500, 3200, 2400, '#5b735f', { size: 1500, lobes: .2 });
}

// The Commons' Classic look (room-looks.mjs, library-humboldt-commons-classic.mjs passes classic: true): the Humboldt
// scene and its ferns exactly as they were at 9644d030, before the Nov 17-18 passes. FROZEN: do not edit.
function fernClassic(b, r, x, ground, z, size = 700, hex = '#4f6e40') {
    const base = colour(hex), fronds = 9 + Math.floor(r() * 5);
    for (let k = 0; k < fronds; k++) {
        const a = r() * 6.28, rise = .5 + r() * .7, len = size * (.7 + r() * .5), out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a)), c = base.clone().offsetHSL(0, 0, (r() - .5) * .08);
        let prev = V(x, ground, z);
        for (let i = 1; i <= 5; i++) { const t = i / 5, p = V(x, ground, z).addScaledVector(out, len * t).add(V(0, len * (rise * t - (rise + .4) * t * t * .8) + len * .25 * t, 0)), leaf = len * .16 * (1 - t * .6);
            for (const s of [-1, 1]) b.tri(prev, p, p.clone().addScaledVector(side, s * leaf).add(V(0, -leaf * .3, 0)), c.clone().multiplyScalar(.82 + .18 * (i % 2)), .5);
            prev = p; }
    }
}
function humboldtClassic(k, ctx) {
    const { land: b, r } = k, ground = ctx.ground - 120, L = ctx.left - 12000, R = ctx.right + 12000, cx = (ctx.left + ctx.right) / 2;
    const lawnC = colour('#5f7650'), moss = colour('#6c7a52'), duff = colour('#5b4a3a'), conc = colour('#a9a69e'), out = new THREE.Color();
    const near = Math.min(0, ctx.near) - 200;
    if (ctx.facing === 0) {
        // the grove: forest floor of needles and duff, ferns, a path between the trunks
        const path = x => -9000 + Math.sin(x / 5200) * 2600;
        land(b, ground, L, R, ctx.near - 60, -18000, -70000, (x, z) => { const d = Math.abs(z - path(x));
            if (d < 900) return out.copy(colour('#8c7f6c')).multiplyScalar(.9 + r() * .15); const p = Math.sin(x / 1700) * Math.sin(z / 1300) * .5 + .5; return out.copy(duff).lerp(moss, p * .6).multiplyScalar(.85 + r() * .15); });
        for (let x = ctx.left - 3000; x < ctx.right + 3000; x += 500 + r() * 400) fernClassic(b, r, x, ground, near - 1300 - r() * 1400, 650 + r() * 350);
        for (let n = 0; n < 40; n++) { const x = L + r() * (R - L), z = -3000 - r() * 30000; if (Math.abs(z - path(x)) < 1300) continue; fernClassic(b, r, x, ground, z, 700 + r() * 400); }
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
        if (r() < .3) shrub(b, r, x, ground, z, 700 + r() * 300, pick(r, ['#3f5a3c', '#47603f']), { size: 110 }); else fernClassic(b, r, x, ground, z, 600 + r() * 300);
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

export const SCENES = {
    garden: { build: garden, storey: 0 },
    'back-garden': { build: backGarden, storey: 0 },
    campus: { build: campus, storey: 0, hazeFar: 90000 },
    schoolyard: { build: schoolyard, storey: 0, hazeFar: 80000 },
    'studio-garden': { build: studioGarden, storey: 0, hazeFar: 46000 },
    // the marine layer: a low grey sky that burns off by afternoon, the far trunks going pale with distance (thin enough
    // that the grove still reads as trees through the film's cameras, which see it from across the room)
    humboldt: { build: humboldt, storey: 0, hazeFar: 60000, lampLevel: .7, haloLevel: 1.2, hours: {
        morning: { tint: [.86, .88, .86], zenith: '#a3b0b8', horizon: '#d5d8d4', sun: [-50, 16, '#f2eee2', .22], clouds: .95, haze: .46, air: '#c9cfcd' },
        afternoon: { tint: [.94, .95, .92], zenith: '#588bae', horizon: '#c8d6d7', sun: [45, 42, '#fff6e6', .35], clouds: .57, haze: .33, air: '#bccbcf' },
        evening: { tint: [.62, .56, .55], zenith: '#56607c', horizon: '#b99a8a', sun: [36, 6, '#ffb07a', .6], clouds: .8, haze: .52, air: '#9a8c86' },
        night: { tint: [.09, .11, .15], zenith: '#0d1420', horizon: '#26303a', clouds: .9, haze: .6, air: '#1e2730', stars: .15 },
        party: { tint: [.12, .12, .2], zenith: '#151a32', horizon: '#33304e', clouds: .85, haze: .6, air: '#262640', stars: .1 } } },
    city: { build: (k, ctx) => city(k, ctx), storey: 3400, hazeFar: 110000, lampLevel: .78, hours: CITY_NIGHT },
    'city-neon': { build: (k, ctx) => city(k, ctx, { neon: true }), storey: 3400, hazeFar: 110000, lampLevel: .78, haloLevel: .8, hours: NEON_NIGHT },
    yard: { build: yard, storey: 0, hazeFar: 80000 },
    'socal-campus': { build: (k, ctx) => socal(k, ctx, 'campus'), storey: 4200, hazeFar: 255000, hours: {
        ...SOCAL,
        morning:{zenith:'#527fa6',horizon:'#b4cbd7',air:'#9aafbc',haze:.26,clouds:.27,light:[.64,.84],sun:[-48,16,'#ffe0af',.66]},
        afternoon:{zenith:'#387cae',horizon:'#a5c8d7',air:'#9db3bc',haze:.23,clouds:.21,light:[.61,.84]},
        evening:{zenith:'#53698d',horizon:'#d9a38d',air:'#b79389',haze:.34,sun:[32,4,'#ffa66d',.86]}
    } },
    'beach-school': { build: (k, ctx) => socal(k, ctx, 'field'), storey: 4000, hazeFar: 238000, haloLevel: .8, hours: SOCAL }
};
