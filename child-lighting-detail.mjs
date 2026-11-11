import * as THREE from 'three';

// Growing child room · lighting & atmosphere (pass 2026-11-05).
// Each life stage has its own light character, not a re-tinted copy:
//  early    nursery pastels, a star projector and amber crescent at bedtime
//  primary  bright school days, a rocket plug-in light and the hall door left ajar
//  preteen  rose / lilac dusk and warm fairy lights over the bed
//  teen     a cove LED strip (violet evening, amber sleep mode) and a neon sign
//  college  2700 K swing-arm lamp, cooler monitor-era daylight and a city window
// Round 2: the old moon disc is hidden from elementary up and its (tested)
// bedtime point light moves into each stage's own practical; mornings get a
// raking warm sun shaft and long floor patch, afternoons a higher, whiter,
// half-blinded light; the bed wall is lit as the night hero per stage.
// Cost: no new Three lights and no shadow casters. Practicals are emissive
// meshes; their landing light is additive decals (the same technique as
// room-light-pools.mjs) parented to the wall/floor they land on, so cutaway
// walls hide their light with them.

const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const lin = (a, b, t) => a + (b - a) * t;

export { CHILD_STAGE_LIGHT, childStageLight } from './child-lighting-profiles.mjs';

// Practical channels per stage: [morning, afternoon, evening, night, party].
// 'reading' / 'moon' / 'cabinet' scale the existing point lights (night
// reading stays 0 because the authored cue is 0); the rest drive emissives and
// decals in this file.
const STAGE = {
    early: { warm: '#ffc48a', moonTint: '#ffc27e', reading: [1, 1, 1, 1, 1], moon: [1, 1, .55, .3, 1], cabinet: [1, 1, 1, 1, 1], stars: [0, 0, .12, 1, 0], window: [.26, .17, .07, .012, .18] },
    primary: { warm: '#ffcb8f', moonTint: '#ffb870', reading: [1, 1, 1.05, 1, 1], moon: [1, 1, .9, 1.1, 1], cabinet: [1, 1, 1, 1, 1], rocket: [0, 0, .45, 1, 0], hall: [0, 0, 0, 1, 0], sky: [0, 0, .25, 1, 0], window: [.27, .18, .07, .012, .18] },
    preteen: { warm: '#ffc08e', moonTint: '#ffbf96', reading: [1, 1, .85, 1, 1], moon: [1, 1, .9, 1.1, 1], cabinet: [1, 1, .7, 1, 1], fairy: [0, .05, 1, .45, .8], lilac: [0, 0, .5, 1, .3], window: [.24, .17, .07, .012, .18] },
    teen: { warm: '#ffc38c', moonTint: '#ff9a52', reading: [1, 1, .7, 1, 1], moon: [1, 1, .8, 1.3, 1], cabinet: [1, 1, .55, 1, 1], strip: [0, 0, 1, .6, .45], neon: [0, 0, 1, 0, .5], street: [0, 0, 0, 1, 0], window: [.22, .16, .06, .012, .17] },
    college: { warm: '#ffd09a', moonTint: '#ffcf96', reading: [1, 1, .75, 1, 1], moon: [1, 1, .9, 1.2, 1], cabinet: [1, 1, .5, 1, 1], swing: [0, 0, 1, .4, .4], city: [0, 0, .5, 1, 0], window: [.22, .16, .06, .014, .17] }
};
// LED strip colour by phase (sleep mode is amber, never blue, at bedtime).
const STRIP = { evening: '#b54dff', night: '#ff8a3a', party: '#3fd2ff' };

function canvasMap(draw, w = 256, h = 256) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    try { draw(canvas.getContext('2d'), w, h); } catch { /* headless test stubs have no 2D canvas */ }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const radial = (c, x, y, r, stops) => { const g = c.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const softDisc = (c, x, y, r, col, alpha = 1) => { c.globalAlpha = alpha; c.fillStyle = radial(c, x, y, r, [[0, col], [.35, col + 'aa'], [1, col + '00']]); c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; };
const jitter = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function enhanceChildLighting({ root, layout: l, helpers: h, groups, skyMat }) {
    const age = l.ageStage || 'early', S = STAGE[age] || STAGE.early, young = age === 'early';
    const { width: w, depth: d, height: H, back, bed } = l, front = back + d, { rear, right } = groups;
    const { mesh, rod, material, markSceneAsset } = h;
    root.ownedTextures ||= []; const own = t => (root.ownedTextures.push(t), t);
    const fixture = (parent, id, name, at, turn = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); g.userData.propId = id; g.userData.sceneAssetName = name; g.userData.wallDecoration = true; g.userData.dropSurface = false; g.userData.childLightingDetail = age; markSceneAsset(g, { key: `childroom:${l.id}:fixture:${id}` }); return g; };
    const solid = (color, extra = {}) => { const m = material(color, { roughness: .6, metalness: 0, ...extra }); m.userData.roomFinishLocked = true; return m; };
    const quiet = o => { o.castShadow = false; o.receiveShadow = false; return o; };
    // Additive light decals: no collider, no Groove obstacle, no ray hits.
    const decals = [], emissives = [];
    const decal = (parent, at, [sx, sy], map, color, levels, rot = [0, 0, 0]) => {
        const m = new THREE.MeshBasicMaterial({ map, color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const o = quiet(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m)); o.name = 'Child light decal'; o.scale.set(sx, sy, 1); o.position.set(...at); o.rotation.set(...rot);
        o.renderOrder = 2; o.raycast = () => {}; o.userData.presentationOnly = true; o.userData.grooveMarker = true; o.userData.childLightDecal = true;
        parent.add(o); decals.push({ o, color: new THREE.Color(color), levels }); return o;
    };
    const glowing = (mat, peak, levels) => { emissives.push({ mat, peak, levels }); return mat; };
    const FLOOR = [-Math.PI / 2, 0, 0], RIGHT = [0, -Math.PI / 2, 0];
    const pool = own(canvasMap((c, s) => { c.fillStyle = radial(c, s / 2, s / 2, s / 2, [[0, '#ffffff'], [.3, '#ffffffbb'], [.6, '#ffffff4a'], [.85, '#ffffff12'], [1, '#ffffff00']]); c.fillRect(0, 0, s, s); }, 128, 128));
    // Wall wash rising from a source at the bottom edge (LED strip / lamp scallop).
    const wash = own(canvasMap((c, tw, th) => { const g = c.createLinearGradient(0, th, 0, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(.18, '#ffffffaa'); g.addColorStop(.55, '#ffffff33'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, tw, th); const e = c.createLinearGradient(0, 0, tw, 0); e.addColorStop(0, '#000000'); e.addColorStop(.08, '#00000000'); e.addColorStop(.92, '#00000000'); e.addColorStop(1, '#000000'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; for (let x = 0; x < tw; x++) { const t = Math.min(x, tw - 1 - x) / (tw * .08); if (t < 1) { c.globalAlpha = 1 - t; c.fillRect(x, 0, 1, th); } } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }, 256, 128));
    // Window sun/moon patch: two panes split by the mullion, soft edges.
    const panes = own(canvasMap((c, tw, th) => { c.filter = 'blur(6px)'; c.fillStyle = '#ffffff'; c.fillRect(tw * .07, th * .1, tw * .4, th * .8); c.fillRect(tw * .53, th * .1, tw * .4, th * .8); c.filter = 'none'; }, 256, 128));
    // Lamp scallop: a soft parabola rising from a shade (bright at the bottom edge).
    const scallop = own(canvasMap((c, tw, th) => { c.save(); c.translate(tw / 2, th); c.scale(1, 2.1); const g = c.createRadialGradient(0, 0, 0, 0, 0, tw / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, '#ffffffa0'); g.addColorStop(.65, '#ffffff30'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, tw / 2, Math.PI, 0); c.fill(); c.restore(); }, 256, 256));

    // Wall light sits proud of flat wall decor (posters <= 35 mm) so it lights
    // them instead of cutting hard rectangles around them.
    const RW = back + 55, XR = w / 2 - 40;
    // Keep a rear-wall glow on the wall: clamp its span so no light hangs past the corner.
    const onRear = (cx, sx) => { const a = Math.max(-w / 2 + 30, cx - sx / 2), b = Math.min(w / 2 - 30, cx + sx / 2); return [(a + b) / 2, b - a]; };
    // Thin soft slats: daylight through a nearly closed blind / streetlight bars.
    const slats = own(canvasMap((c, tw, th) => { c.filter = 'blur(5px)'; c.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) c.fillRect(tw * .05, th * (.1 + k * .22), tw * .9, th * .08); c.filter = 'none'; }, 256, 256));
    // A sun shaft through dusty air, fading toward the floor, with a few motes.
    const shaftMap = own(canvasMap((c, tw, th) => { const g = c.createLinearGradient(0, 0, 0, th); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#ffffff66'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, tw, th); c.globalCompositeOperation = 'destination-out'; for (let x = 0; x < tw; x++) { const t = Math.min(x, tw - 1 - x) / (tw * .18); if (t < 1) { c.globalAlpha = 1 - t; c.fillRect(x, 0, 1, th); } } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; for (let i = 0; i < 40; i++) softDisc(c, (.15 + jitter(i + 70) * .7) * tw, jitter(i + 90) * th * .8, 3 + jitter(i) * 3, '#ffffff', .6); }, 128, 256));

    // ---- Daylight: morning and afternoon are different times of day ----
    // Morning: the real key light already rakes in at a low angle; add the warm
    // shaft through the air and a long gold patch reaching across the floor.
    const windowZ = back + 1500;
    const floorHit = (y, z) => [w / 2 - y / .62, z + .36 * y / .62];
    {
        const yMid = 1500, [fx0, fz0] = floorHit(yMid, windowZ - 650), [fx1, fz1] = floorHit(yMid, windowZ + 650);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([w / 2 - 60, yMid, windowZ - 650, w / 2 - 60, yMid, windowZ + 650, fx0, 12, fz0, fx1, 12, fz1], 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2)); geo.setIndex([0, 2, 1, 1, 2, 3]);
        const shaft = decal(root, [0, 0, 0], [1, 1], shaftMap, '#ffd9a6', [.07, 0, 0, 0, 0]); shaft.geometry.dispose(); shaft.geometry = geo; shaft.name = 'Morning sun shaft';
        const [px, pz] = floorHit(1150, windowZ), morning = decal(root, [px, 10.5, pz], [1350, 2600], panes, '#ffcf8f', [.17, 0, 0, 0, 0], FLOOR); morning.rotation.z = Math.atan2(1, -.36);
    }
    // Afternoon: high, whiter sun pools close under the half-lowered blind.
    const noon = decal(root, [w / 2 - 520, 10.5, windowZ + 120], [1300, 760], panes, '#fff8ec', [0, .1, 0, 0, .04], FLOOR); noon.rotation.z = -Math.PI / 2;
    const dusk = decal(root, [w / 2 - 1500, 10.5, windowZ - 350], [2400, 1100], panes, '#ffae6a', [0, 0, .2, 0, 0], FLOOR);
    dusk.rotation.z = .42;
    const moonlit = decal(root, [w / 2 - 900, 10.5, windowZ + 200], [1800, 700], slats, age === 'teen' ? '#9fc0ff' : '#7d9ad0', [0, 0, 0, age === 'teen' ? .45 : age === 'college' ? .16 : .1, 0], FLOOR);
    moonlit.rotation.z = -Math.PI / 2 - .25;
    // The reading sconce on the (cutaway) left wall still lands on the nook.
    decal(root, [l.reading[0] - 150, 160, l.reading[1] - 40], [1500, 1150], pool, S.warm, [0, .02, .32, 0, .12], FLOOR);
    // The personal cabinet lamp throws a scallop up the right wall (only where that lamp exists).
    const cabinetLamp = root.getObjectByName('Child room · personal cabinet lamp');
    if (cabinetLamp) { root.updateMatrixWorld(true); const at = root.worldToLocal(cabinetLamp.getWorldPosition(new THREE.Vector3())); decal(right, [XR, at.y + 450, at.z], [760, 900], scallop, '#ffcf98', [0, 0, .065, .015, .04], RIGHT); }

    // ---- Stage practicals and the bed wall as the night hero ----
    const bedX = bed[0], bayL = Math.max(-w / 2 + 60, bedX - 650), bayR = bedX + 650;
    let strip = null, moonAnchor = null;
    const anchor = (parent, at) => { const o = new THREE.Object3D(); o.name = 'Child light anchor'; o.position.set(...at); parent.add(o); return o; };
    if (age === 'early') {
        // Plug-in star projector beside the bed: stars and a crescent drift over the bed wall and round the corner.
        const p = fixture(rear, 'light-star-projector-early', 'Plug-in star projector night-light', [Math.min(bayR + 120, w / 2 - 300), 330, back + 14]);
        quiet(mesh(p, new THREE.BoxGeometry(110, 150, 16), solid('#f2ede2', { roughness: .45 }), [0, 0, 8]));
        const dome = glowing(solid('#e9f0ff', { roughness: .3, emissive: '#bcd2ff', emissiveIntensity: 0 }), 1.6, S.stars);
        const d0 = quiet(mesh(p, new THREE.SphereGeometry(52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome, [0, 20, 16])); d0.rotation.x = Math.PI / 2;
        const star = (c, x, y, r, col, a) => { c.globalAlpha = a; softDisc(c, x, y, r * 2.4, col, .35); c.globalAlpha = a; c.fillStyle = col; c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * .42 : r, t = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } c.closePath(); c.fill(); c.globalAlpha = 1; };
        const starMap = own(canvasMap((c, tw, th) => {
            for (let i = 0; i < 18; i++) softDisc(c, jitter(i + 3) * tw, jitter(i + 51) * th, 26 + jitter(i + 9) * 46, i % 3 ? '#ffe2b0' : '#bcd4ff', .16);
            for (let i = 0; i < 70; i++) star(c, jitter(i + 200) * tw, jitter(i + 400) * th, 4 + jitter(i + 600) * 9, i % 4 ? '#fff1cf' : '#d8e6ff', .95);
            for (let i = 0; i < 80; i++) softDisc(c, jitter(i + 800) * tw, jitter(i + 900) * th, 3 + jitter(i + 950) * 3, '#fff6e0', .8);
            c.fillStyle = '#fff3d8'; c.beginPath(); c.arc(tw * .3, th * .26, 40, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(tw * .3 + 18, th * .26 - 9, 35, 0, 7); c.fill();
            const g = c.createRadialGradient(tw * .55, th * .55, 0, tw * .55, th * .55, tw * .6); g.addColorStop(0, '#00000000'); g.addColorStop(.8, '#00000000'); g.addColorStop(1, '#000000ff'); c.fillStyle = g; c.fillRect(0, 0, tw, th); c.globalCompositeOperation = 'source-over';
        }, 1024, 768));
        // Rear wall: the whole bed side down to bed height; right wall: the stars carry round the corner.
        const sx = Math.min(3400, w - 300), cx = Math.max(-w / 2 + sx / 2 + 40, bedX + 700);
        decal(rear, [cx, 1700, RW], [sx, 1900], starMap, '#ffffff', S.stars);
        const side = decal(right, [XR, 1750, back + 900], [1500, 1300], starMap, '#ffffff', S.stars.map(v => v * .7), RIGHT); side.material.map = side.material.map.clone(); side.material.map.repeat.set(.5, .7); side.material.map.offset.set(.5, .15); side.material.map.needsUpdate = true; own(side.material.map);
        decal(rear, [p.position.x, 330, back + 28], [520, 520], pool, '#cfdcff', S.stars.map(v => v * .35));
        // The crescent keeps its light but no longer scorches the wall: a soft halo instead.
        decal(rear, [bedX, 1040, RW], [760, 760], pool, '#ffbf7a', [0, 0, .03, .045, 0]); // round 3: a nightlight, not a fire
    } else if (age === 'primary') {
        // Rocket night-light on the wall over the bedside table is now the bedtime light.
        const r = fixture(rear, 'light-rocket-nightlight-primary', 'Rocket night-light', [Math.min(bayR + 170, w / 2 - 300), 690, back + 14]);
        quiet(mesh(r, new THREE.BoxGeometry(90, 130, 14), solid('#f1ece0', { roughness: .5 }), [0, 0, 7]));
        const body = glowing(solid('#fff1d2', { roughness: .35, emissive: '#ffbf6e', emissiveIntensity: 0 }), 1.05, S.rocket);
        quiet(mesh(r, new THREE.CapsuleGeometry(26, 90, 6, 16), body, [0, 20, 40]));
        quiet(mesh(r, new THREE.ConeGeometry(26, 40, 16), solid('#c4573f', { roughness: .6 }), [0, 104, 40]));
        for (const sgn of [-1, 1]) { const fin = quiet(mesh(r, new THREE.BoxGeometry(22, 40, 6), solid('#3f7fa8', { roughness: .6 }), [sgn * 30, -32, 40])); fin.rotation.z = sgn * .4; }
        moonAnchor = anchor(rear, [r.position.x, 760, back + 380]);
        decal(rear, [r.position.x, 1000, RW], [760, 900], scallop, '#ffc580', S.rocket.map(v => v * .2));
        decal(rear, [r.position.x, 700, RW], [520, 480], pool, '#ffc580', S.rocket.map(v => v * .35));
        // Night sky over the bed wall: a deep blue wash from the ceiling that lets the glow planets sing.
        { const [cx, sx] = onRear(bedX + 700, 3200); decal(rear, [cx, H - 520, RW], [sx, 1100], wash, '#5b78d6', S.sky.map(v => v * .13), [0, 0, Math.PI]); }
    } else if (age === 'preteen') {
        // Warm fairy lights swag across the sleeping bay, with clipped photos; a lilac strip glows behind the headboard.
        const f = fixture(rear, 'light-fairy-swag-preteen', 'Warm fairy lights & clipped photos', [0, 0, back + 26]);
        const anchors = [bayL + 40, lin(bayL, bayR, .34), lin(bayL, bayR, .67), bayR - 40], y0 = 1540, sag = 150, pts = [], bulbs = [];
        for (let k = 0; k < 3; k++) for (let i = 0; i <= 24; i++) { const t = i / 24, x = lin(anchors[k], anchors[k + 1], t); pts.push(new THREE.Vector3(x, y0 - sag * 4 * t * (1 - t), 0)); }
        quiet(mesh(f, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 2.2, 5, false), solid('#3d4a3c', { roughness: .7 })));
        for (let i = 1; i < pts.length - 1; i += 3) bulbs.push(pts[i]);
        const bulb = glowing(solid('#fff3d8', { roughness: .3, emissive: '#ffc77e', emissiveIntensity: 0 }), 2.2, S.fairy);
        const inst = quiet(new THREE.InstancedMesh(new THREE.SphereGeometry(9, 10, 8), bulb, bulbs.length)), mx = new THREE.Matrix4();
        bulbs.forEach((p, i) => inst.setMatrixAt(i, mx.makeTranslation(p.x, p.y - 10, 8))); inst.name = 'Fairy light bulbs'; f.add(inst);
        // Clipped photos: three instanced meshes (paper, print, peg) rather than fifteen draw calls.
        const tints = ['#c98f7b', '#7f9db5', '#d0b06a', '#8eaa8a', '#b48aa8'], parts = [[new THREE.BoxGeometry(92, 110, 2), solid('#f4efe4', { roughness: .9 }), [0, -60, 0]], [new THREE.BoxGeometry(76, 72, 1), solid('#ffffff', { roughness: .8 }), [0, -52, 1.6]], [new THREE.BoxGeometry(14, 22, 6), solid('#b98a5a'), [0, -4, 2]]];
        const ims = parts.map(([geo, mat]) => { const im = quiet(new THREE.InstancedMesh(geo, mat, 5)); im.name = 'Clipped photos'; f.add(im); return im; }), dummy = new THREE.Object3D(), part = new THREE.Object3D(); dummy.add(part);
        for (let k = 0; k < 5; k++) { const t = (k + .5) / 5, x = lin(anchors[0], anchors[3], t), seg = Math.min(2, Math.floor(t * 3)), u = t * 3 - seg, y = y0 - sag * 4 * u * (1 - u);
            dummy.position.set(x, y - 12, 4); dummy.rotation.z = (jitter(k + 7) - .5) * .28;
            parts.forEach(([, , at], j) => { part.position.set(...at); dummy.updateMatrixWorld(true); ims[j].setMatrixAt(k, part.matrixWorld); });
            ims[1].setColorAt(k, new THREE.Color(tints[k])); }
        moonAnchor = anchor(rear, [bedX, 1380, back + 420]);
        { const [cx, sx] = onRear(bedX, Math.min(1900, bayR - bayL + 500)); decal(rear, [cx, 1300, RW], [sx, 760], wash, '#ffb877', S.fairy.map(v => v * .26)); }
        decal(rear, [bedX, 1460, RW + 1], [1500, 480], pool, '#ffc98f', S.fairy.map(v => v * .22));
        // Lilac LED behind the headboard: the rose/lilac dream colour washes up the bed wall.
        decal(rear, [bedX, 1350, RW + 2], [1500, 1000], wash, '#a98cff', S.lilac.map(v => v * .42));
        { const [cx, sx] = onRear(bedX + 300, 2600); decal(rear, [cx, H - 650, RW + 3], [sx, 1100], wash, '#b48cff', S.lilac.map(v => v * .16), [0, 0, Math.PI]); }
    } else if (age === 'teen') {
        // Cove LED strips along both visible walls and a glow behind the headboard; a big neon over the bed.
        const s = fixture(rear, 'light-led-cove-teen', 'LED strip along the ceiling line', [0, H - 30, back + 14]);
        const stripMat = solid('#ffffff', { roughness: .4, emissive: '#ffffff', emissiveIntensity: 0 }), channel = solid('#d8d8d6', { roughness: .5 });
        quiet(mesh(s, new THREE.BoxGeometry(w - 120, 12, 14), channel, [0, 0, 0]));
        quiet(mesh(s, new THREE.BoxGeometry(w - 140, 5, 3), stripMat, [0, -7, 6]));
        const sr = fixture(right, 'light-led-cove-right-teen', 'LED strip along the window-wall ceiling line', [w / 2 - 14, H - 30, back + d / 2], -Math.PI / 2);
        quiet(mesh(sr, new THREE.BoxGeometry(d - 160, 12, 14), channel, [0, 0, 0])); quiet(mesh(sr, new THREE.BoxGeometry(d - 180, 5, 3), stripMat, [0, -7, 6]));
        strip = { mat: stripMat, washes: [
            decal(rear, [0, H - 470, RW], [w - 80, 900], wash, '#ffffff', S.strip, [0, 0, Math.PI]),
            decal(right, [XR, H - 760, back + d / 2], [d - 120, 1500], wash, '#ffffff', S.strip.map(v => v * .9), [0, -Math.PI / 2, Math.PI]),
            decal(rear, [bedX, 1180, RW + 1], [1500, 700], wash, '#ffffff', S.strip.map(v => v * .7))] };
        const nx = bedX, ny = 1240;
        const n = fixture(rear, 'light-neon-sign-teen', 'Original neon wave sign', [nx, ny, back + 20]);
        quiet(mesh(n, new THREE.BoxGeometry(920, 440, 6), solid('#dfe6ea', { roughness: .4, transparent: true, opacity: .05, depthWrite: false }), [0, 0, 18]));
        for (const x of [-430, 430]) for (const y of [-190, 190]) quiet(mesh(n, new THREE.CylinderGeometry(6, 6, 18, 8), solid('#b8b8b8', { metalness: .6, roughness: .3 }), [x, y, 9])).rotation.x = Math.PI / 2;
        const tube = own(canvasMap((c, tw, th) => {
            const path = () => { c.beginPath(); for (let i = 0; i <= 120; i++) { const x = tw * (.12 + .62 * i / 120), env = Math.sin(Math.PI * i / 120); c.lineTo(x, th * .55 + Math.sin(i / 120 * Math.PI * 5) * th * .26 * env); } c.stroke(); c.beginPath(); c.arc(tw * .84, th * .4, th * .13, 0, 7); c.stroke(); };
            c.lineCap = c.lineJoin = 'round'; c.strokeStyle = '#ff4fa0'; c.shadowColor = '#ff4fa0'; c.shadowBlur = 40; c.lineWidth = 14; path(); c.shadowBlur = 16; path(); c.shadowBlur = 0; c.strokeStyle = '#ffd6ea'; c.lineWidth = 5; path();
        }, 512, 256));
        decal(n, [0, 0, 24], [900, 450], tube, '#ffffff', S.neon);
        decal(rear, [nx, ny, RW + 2], [2000, 1300], pool, '#ff5fa8', S.neon.map(v => v * .22));
        moonAnchor = anchor(rear, [bedX, H - 380, back + 500]);
        // Streetlight leaking round the blind lifts the dark window wall without killing the mood.
        decal(right, [XR, 1500, windowZ], [2800, 2000], pool, '#86a2dc', S.street.map(v => v * .16), RIGHT);
    } else if (age === 'college') {
        // A brass swing-arm reading lamp over the bed is the bedtime light (the moon disc is gone).
        const lx = bayL + 240, s = fixture(rear, 'light-swing-arm-college', 'Brass swing-arm wall lamp', [lx, 1300, back + 12]);
        const brass = solid('#b08a4e', { roughness: .35, metalness: .75 });
        quiet(mesh(s, new THREE.CylinderGeometry(42, 42, 22, 24), brass, [0, 0, 11])).rotation.x = Math.PI / 2;
        rod(s, [0, 0, 20], [0, 0, 300], 8, brass); rod(s, [0, 0, 300], [120, -40, 330], 8, brass);
        const linenShade = glowing(solid('#eadfca', { roughness: .9, side: THREE.DoubleSide, emissive: '#ffc988', emissiveIntensity: 0 }), .6, S.swing);
        quiet(mesh(s, new THREE.CylinderGeometry(60, 100, 140, 24, 1, true), linenShade, [150, -115, 335]));
        const lampGlow = glowing(solid('#fff1d6', { roughness: .4, emissive: '#ffcc8a', emissiveIntensity: 0 }), 2.6, S.swing);
        quiet(mesh(s, new THREE.CircleGeometry(92, 24), lampGlow, [150, -183, 335])).rotation.x = Math.PI / 2;
        moonAnchor = anchor(rear, [lx + 150, 1080, back + 380]);
        decal(rear, [lx + 150, 640, RW], [900, 1000], scallop, '#ffc98a', S.swing.map(v => v * .75), [0, 0, Math.PI]);
        decal(rear, [lx + 150, 1500, RW], [520, 600], scallop, '#ffc98a', S.swing.map(v => v * .3));
        decal(root, [lx + 260, 480, back + 760], [1200, 950], pool, '#ffcf96', S.swing.map(v => v * .4), FLOOR);
        // Gallery wall over the bed: a warm grazing wash from the string lights along the top.
        { const [cx, sx] = onRear(bedX + 900, 3000); decal(rear, [cx, H - 560, RW + 1], [sx, 1000], wash, '#ffc98a', [0, 0, .14, .1, .06], [0, 0, Math.PI]); }
        // City glow under the blind at night.
        decal(right, [XR, 950, windowZ], [1500, 360], wash, '#ffb874', S.city.map(v => v * .12), RIGHT);
    }

    // Elementary hall door: built by the walls layer; the wedge enters through it.
    const info = {};
    let hallDone = age !== 'primary';
    const hallLight = () => {
        // Only the door the walls layer publishes (root.userData.childWallLife.door); no door, no hall light.
        hallDone = true; const door = root.userData.childWallLife?.door;
        if (!door || door.wall !== 'right') return;
        // The door is closed: hall light spills in under it as a short bright fan on the floor.
        const width = door.width || 860;
        const fan = decal(root, [w / 2 - 300, 10.5, door.u], [width * 1.25, 600], wash, '#ffcf8e', S.hall.map(v => v * .55), FLOOR); fan.rotation.z = Math.PI / 2;
        decal(root, [w / 2 - 70, 10.6, door.u], [width * 1.05, 140], pool, '#ffe0b0', S.hall.map(v => v * .5), [-Math.PI / 2, 0, Math.PI / 2]);
        info.hallDoor = door.wall;
    };

    // A reading floor lamp brought by the lived-in layer (college nook) becomes the real reading light.
    let nookDone = false;
    const adoptNookLamp = () => {
        nookDone = true; let nook = null; root.traverse(x => { if (x.userData.propId === `lived-nook-${age}`) nook = x; }); if (!nook) return;
        // The dresser tags its lamp shade explicitly (userData.lampShade on the baked shade mesh).
        let shade = null; nook.traverse(x => { if (x.isMesh && x.userData.lampShade) shade = x; }); if (!shade) return;
        const reading = root.getObjectByName('Child room · reading'); if (!reading) return;
        shade.material = glowing(shade.material.clone(), 1.05, [0, 0, 1, 0, .4]); shade.material.emissive.set('#ffcf96'); shade.material.emissiveIntensity = 0; shade.material.side = THREE.DoubleSide;
        // A baked shade sits at its group origin: hang the light at the shade's own centre.
        shade.geometry.computeBoundingBox(); const c = shade.geometry.boundingBox.getCenter(new THREE.Vector3());
        shade.add(reading); reading.position.set(c.x, c.y - 60, c.z);
        root.updateMatrixWorld(true); const at = root.worldToLocal(shade.localToWorld(c.clone()));
        decal(root, [at.x, 10.5, at.z], [1500, 1500], pool, '#ffc98a', [0, 0, .14, 0, .06], FLOOR);
        info.readingLamp = 'nook side-table lamp';
    };

    let moonDone = false;
    const placeMoon = () => {
        moonDone = true; const light = root.getObjectByName('Child room · moon'); if (!light) return;
        if (!moonAnchor) { light.position.z += 250; return; } // early: same crescent, light pulled off the wall
        moonAnchor.add(light); light.position.set(0, 0, 0);
        root.traverse(o => { if (o.userData.propId === 'moon-light') o.children.forEach(ch => { if (ch.isMesh) ch.visible = false; }); });
    };

    const apply = (phase, accent = 1) => {
        if (!moonDone) placeMoon();
        if (!hallDone) hallLight();
        if (!nookDone) adoptNookLamp();
        const i = Math.max(0, PHASES.indexOf(phase));
        for (const { o, color, levels } of decals) { const v = levels[i] * accent; o.material.color.copy(color).multiplyScalar(v); o.visible = v > .003; }
        for (const { mat, peak, levels } of emissives) mat.emissiveIntensity = peak * levels[i];
        if (strip) { const c = STRIP[phase] || '#ffffff'; strip.mat.emissive.set(c); strip.mat.emissiveIntensity = 2.2 * S.strip[i]; for (const o of strip.washes) { const base = decals.find(x => x.o === o); const v = base.levels[i] * .55 * accent; o.material.color.set(c).multiplyScalar(v); o.visible = v > .003; } }
        // Existing point lights get the stage's colour temperature and balance.
        root.traverse(o => {
            if (!o.isPointLight) return;
            const ch = o.name === 'Child room · reading' ? 'reading' : o.name === 'Child room · moon' ? 'moon' : o.name === 'Child room · personal cabinet lamp' ? 'cabinet' : null;
            if (!ch) return; o.intensity *= S[ch][i];
            // The adopted side-table lamp hangs ~0.8 m over the floor in the foreground (the sconce was 1.15 m up a wall): half power.
            if (ch === 'reading' && info.readingLamp) o.intensity *= .45;
            o.color.set(ch === 'moon' ? S.moonTint : phase === 'afternoon' || phase === 'morning' ? '#f3e4cb' : S.warm);
        });
        if (skyMat) skyMat.emissiveIntensity = S.window[i];
        root.userData.childLighting = { ...(root.userData.childLighting || {}), stage: age, practicals: Object.keys(S).filter(k => Array.isArray(S[k]) && !['reading', 'moon', 'cabinet', 'window'].includes(k) && S[k][i] > 0), decals: decals.filter(x => x.o.visible).length, moonDisc: age === 'early', ...info };
    };

    // ---- Window views: each stage looks out on a different world ----
    const paintSky = (c, tw, th, id, m) => { try { return paintView(c, tw, th, id, m); } catch { return false; } };
    const paintView = (c, tw, th, id, m) => {
        const night = id === 'night', evening = id === 'evening', g = c.createLinearGradient(0, 0, 0, th);
        g.addColorStop(0, m.sky[0]); if (evening) g.addColorStop(.55, new THREE.Color(m.sky[0]).lerp(new THREE.Color(m.sky[1]), .55).getStyle()); g.addColorStop(1, m.sky[1]);
        c.fillStyle = g; c.fillRect(0, 0, tw, th);
        const sunAt = id === 'morning' ? [.74, .3] : evening ? [.18, .7] : night ? [.7, .2] : [.36, .2];
        if (night) { for (let i = 0; i < 60; i++) { c.fillStyle = i % 5 ? '#d9dcea' : '#ffe9c0'; c.globalAlpha = .4 + jitter(i) * .6; c.beginPath(); c.arc(jitter(i + 40) * tw, jitter(i + 90) * th * .6, .8 + (i % 3) * .6, 0, 7); c.fill(); } c.globalAlpha = 1; softDisc(c, tw * sunAt[0], th * sunAt[1], 70, '#cfd8f0', .35); c.fillStyle = '#f0e6c8'; c.beginPath(); c.arc(tw * sunAt[0], th * sunAt[1], 20, 0, 7); c.fill(); if (age !== 'college') { c.fillStyle = m.sky[0]; c.beginPath(); c.arc(tw * sunAt[0] + 10, th * sunAt[1] - 5, 18, 0, 7); c.fill(); } }
        else { softDisc(c, tw * sunAt[0], th * sunAt[1], evening ? 150 : 110, evening ? '#ffc184' : '#fff2cf', evening ? .8 : .6); c.fillStyle = evening ? '#ffd9a0' : '#fff6de'; c.beginPath(); c.arc(tw * sunAt[0], th * sunAt[1], evening ? 30 : 26, 0, 7); c.fill(); }
        if (!night) for (let k = 0; k < 4; k++) { c.fillStyle = evening ? '#f6c3a2' : '#ffffff'; c.globalAlpha = evening ? .35 : .55; const cx = jitter(k + 11) * tw, cy = th * (.12 + jitter(k + 21) * .3); for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(cx + j * 26, cy + (j % 2) * 6, 40, 14, 0, 0, 7); c.fill(); } } c.globalAlpha = 1;
        const tone = (dayA, eveA, nightA) => night ? nightA : evening ? eveA : dayA;
        if (age === 'early' || age === 'primary') {
            for (let row = 0; row < 2; row++) { c.fillStyle = tone(['#a0b8a2', '#789a81'][row], ['#8a8f86', '#6a7570'][row], ['#24384a', '#1b2d3b'][row]); for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(i * 90, th + 45 + row * 45 - jitter(i + row) * 65, 100, 0, 7); c.fill(); } }
            c.fillStyle = tone('#5f8467', '#56605a', '#17262f'); for (const [x, s] of [[.16, 1], [.62, .8], [.86, 1.15]]) { c.beginPath(); c.arc(tw * x, th * .74, 46 * s, 0, 7); c.arc(tw * x + 28 * s, th * .7, 38 * s, 0, 7); c.fill(); c.fillRect(tw * x - 4, th * .74, 9, 70); }
            if (age === 'primary') { c.strokeStyle = tone('#f2ece0', '#d9b9a0', '#3b4f63'); c.lineWidth = 4; c.beginPath(); c.moveTo(0, th * .9); c.lineTo(tw, th * .88); c.moveTo(0, th * .95); c.lineTo(tw, th * .93); c.stroke(); for (let x = 10; x < tw; x += 40) { c.beginPath(); c.moveTo(x, th * .86); c.lineTo(x, th); c.stroke(); }
                if (id === 'afternoon' || id === 'party') { c.fillStyle = '#d9604a'; c.beginPath(); c.moveTo(tw * .7, th * .2); c.lineTo(tw * .76, th * .27); c.lineTo(tw * .7, th * .36); c.lineTo(tw * .64, th * .27); c.fill(); c.strokeStyle = '#6d6d6d'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tw * .7, th * .36); c.quadraticCurveTo(tw * .6, th * .6, tw * .52, th); c.stroke(); } }
        } else if (age === 'preteen' || age === 'teen') {
            // Suburban rooftops; lit windows come on at dusk.
            c.fillStyle = tone('#93a7a0', '#6d6c78', '#1a2433'); for (let i = 0; i < 7; i++) { const x = i * tw / 6 - 30, hh = th * (.2 + jitter(i + 5) * .1), ww = tw / 6 + 10; c.beginPath(); c.moveTo(x, th); c.lineTo(x, th - hh); c.lineTo(x + ww / 2, th - hh - 50); c.lineTo(x + ww, th - hh); c.lineTo(x + ww, th); c.fill();
                if (evening || night) { c.fillStyle = night ? '#ffcf7a' : '#ffd69a'; if (jitter(i + 30) > .3) c.fillRect(x + ww * .3, th - hh * .6, 22, 26); if (jitter(i + 60) > .55) c.fillRect(x + ww * .62, th - hh * .6, 22, 26); c.fillStyle = tone('#93a7a0', '#6d6c78', '#1a2433'); } }
            c.fillStyle = tone('#5f7a68', '#4d5050', '#111a24'); c.beginPath(); c.arc(tw * .1, th * .62, 70, 0, 7); c.arc(tw * .2, th * .7, 60, 0, 7); c.fill();
            if (age === 'teen') { c.strokeStyle = tone('#5c6268', '#3d3a40', '#0d121a'); c.lineWidth = 6; c.beginPath(); c.moveTo(tw * .78, th); c.lineTo(tw * .78, th * .52); c.lineTo(tw * .7, th * .5); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, th * .34); c.quadraticCurveTo(tw * .5, th * .44, tw, th * .32); c.stroke();
                if (evening || night) softDisc(c, tw * .7, th * .52, 60, '#ffc76e', night ? .9 : .5); }
        } else {
            // College: a city skyline across the street; soft facades and sparse, chunky lit windows (no fine dot grid to alias).
            const lit = id === 'night' ? .45 : evening ? .32 : 0;
            for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 8; i++) {
                const ww = 70 + jitter(i + layer * 20) * 60, x = (i / 8) * tw + (layer ? 34 : 0) - 24, hh = th * (layer ? .22 + jitter(i + 7) * .18 : .3 + jitter(i + 3) * .2);
                const top = layer ? tone('#8d9ca6', '#5d5b6c', '#141c2c') : tone('#a9b5bd', '#7c7488', '#1d2738'), g2 = c.createLinearGradient(0, th - hh, 0, th); g2.addColorStop(0, top); g2.addColorStop(1, new THREE.Color(top).multiplyScalar(.82).getStyle()); c.fillStyle = g2; c.fillRect(x, th - hh, ww, hh);
                if (lit) for (let y = th - hh + 14; y < th - 10; y += 24) for (let xx = x + 10; xx < x + ww - 14; xx += 22) if (jitter(xx * .37 + y * .11 + layer) < lit) { c.fillStyle = jitter(xx + y) > .8 ? '#cfe0ff' : '#ffd38f'; c.fillRect(xx, y, 11, 13); }
            }
            if (night || evening) { const gg = c.createLinearGradient(0, th * .55, 0, th); gg.addColorStop(0, '#ffb26b00'); gg.addColorStop(1, night ? '#ff9f5a55' : '#ffb26b33'); c.fillStyle = gg; c.fillRect(0, 0, tw, th); }
        }
        return true;
    };
    root.userData.childLighting = { ...(root.userData.childLighting || {}), stage: age };
    return { update: apply, paintSky };
}
