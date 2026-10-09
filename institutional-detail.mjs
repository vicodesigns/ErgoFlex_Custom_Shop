import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared drawing and dressing helpers for every institutional group. Group
// modules (institutional-government/-education/-healthcare/-it.mjs) own their
// furnishings, displays, boards and decor and call these helpers. These are
// scene dressing, never live medical, police or security data.
export const rnd = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };
export function institutionalMap(draw, width = 768, height = 384) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
// style: 'carpet' (woven tiles), 'clinical' (terrazzo / sheet vinyl), 'oak' (boards).
export function institutionalFloor(style, w, d) {
    const carpet = style === 'carpet', clinical = style === 'clinical';
    const map = institutionalMap((c, W, H) => {
        c.fillStyle = carpet ? '#657078' : clinical ? '#bdceca' : '#c4a57c'; c.fillRect(0, 0, W, H);
        if (carpet) {
            for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
                c.fillStyle = ['#69777a', '#68767a', '#647277', '#6b787d'][row * 2 + col]; c.fillRect(col * 256, row * 256, 255, 255);
                c.strokeStyle = '#c1cbd21a'; c.lineWidth = 1;
                for (let n = 0; n < 85; n++) { c.beginPath(); const p = n * 3; if ((row + col) % 2) { c.moveTo(col * 256, row * 256 + p); c.lineTo(col * 256 + 254, row * 256 + p); } else { c.moveTo(col * 256 + p, row * 256); c.lineTo(col * 256 + p, row * 256 + 254); } c.stroke(); }
            }
        } else if (clinical) {
            for (let i = 0; i < 4000; i++) { c.fillStyle = i % 2 ? '#8aaca333' : '#f3f7ee66'; c.fillRect(rnd(i) * W, rnd(i + 4100) * H, 1 + rnd(i + 5) * 3, 1 + rnd(i + 9) * 3); }
            c.strokeStyle = '#8fa7a445'; c.strokeRect(.5, .5, W - 1, H - 1);
        } else {
            for (let row = 0; row < 8; row++) {
                c.fillStyle = ['#bba27e', '#c0a784', '#bda381', '#c3a987'][row % 4]; c.fillRect(0, row * 64, W, 63);
                for (let i = 0; i < 15; i++) { c.strokeStyle = i % 2 ? '#71563d1c' : '#f6dfba27'; c.beginPath(); c.moveTo(0, row * 64 + i * 4); c.bezierCurveTo(160, row * 64 + i * 4 + 3, 350, row * 64 + i * 4 - 3, W, row * 64 + i * 4); c.stroke(); }
                c.fillStyle = '#79634950'; c.fillRect(row % 2 * 256, row * 64, 1, 64);
            }
        }
    }, 512, 512);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(w / (carpet ? 1000 : 1800), d / (carpet ? 1000 : 1800)); map.anisotropy = 4;
    return { map, roughness: carpet ? .92 : clinical ? .43 : .6, surface: carpet ? 'fabric' : clinical ? 'stone' : 'wood' };
}
export function institutionalOak() {
    return institutionalMap((c, W, H) => {
        c.fillStyle = '#b99a72'; c.fillRect(0, 0, W, H);
        for (let n = 0; n < 200; n++) { const y = n / 200 * H; c.strokeStyle = n % 3 ? '#65492e22' : '#ead0a143'; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W * .3, y + Math.sin(n) * 5, W * .65, y - 4, W, y); c.stroke(); }
    }, 512, 256);
}

// ---- Planning boards. Groups compose: frame + body helpers. -------------
// Background, title (spec.boardTitle) and footer credit. Returns nothing.
export function boardFrame(c, W, H, spec, { dark = false, young = false } = {}) {
    c.fillStyle = dark ? '#17323c' : young ? '#eadfc8' : '#f1f0e7'; c.fillRect(0, 0, W, H);
    c.fillStyle = dark ? '#b6d7d6' : spec.accent; c.font = '600 28px sans-serif'; c.fillText(spec.boardTitle || spec.name.toUpperCase(), 28, 47, W - 56);
    c.fillStyle = dark ? '#92b2ba' : '#6e7b79'; c.font = '14px sans-serif'; c.fillText('ERGOFLEX  /  LEARNING & WORKSPACE CONCEPT', 30, H - 20);
}
// Three columns of task cards (plan / progress / complete style).
export function boardColumns(c, W, H, spec, headings, dark = false) {
    for (let col = 0; col < 3; col++) {
        const x = 30 + col * (W - 50) / 3;
        c.fillStyle = dark ? '#8ec3c5' : spec.accent; c.font = '600 18px sans-serif'; c.fillText(headings[col], x + 8, 94);
        for (let row = 0; row < 3; row++) { c.fillStyle = ['#cdded4', '#ddc8a5', '#becedb'][(row + col) % 3]; c.fillRect(x, 115 + row * 65, (W - 90) / 3, 50); c.fillStyle = '#536b70'; for (let line = 0; line < 2; line++) c.fillRect(x + 14, 130 + row * 65 + line * 13, 110 - line * 25, 3); }
    }
}
// Squared paper; leaves strokeStyle = accent, lineWidth = 4 for the diagram.
export function boardGrid(c, W, H, spec) {
    c.strokeStyle = '#d4ded6'; c.lineWidth = 1;
    for (let x = 32; x < W - 30; x += 26) { c.beginPath(); c.moveTo(x, 80); c.lineTo(x, H - 60); c.stroke(); }
    for (let y = 80; y < H - 50; y += 26) { c.beginPath(); c.moveTo(32, y); c.lineTo(W - 30, y); c.stroke(); }
    c.strokeStyle = spec.accent; c.lineWidth = 4;
}
// A plotted curve with a one-line caption, drawn over boardGrid.
export function boardCurve(c, W, H, spec, variant, caption) {
    c.beginPath(); for (let i = 0; i < 120; i++) c.lineTo(55 + i * 5.4, 210 - Math.sin(i * .065 + variant) * 75 * Math.sin(i * .016)); c.stroke();
    c.font = '24px serif'; c.fillStyle = spec.accent; c.fillText(caption, 70, 320, W - 120);
}

// ---- Monitor screens. Groups compose: header + body + footer. ------------
export function screenHeader(c, W, H, title) {
    c.fillStyle = '#10232d'; c.fillRect(0, 0, W, H); c.fillStyle = '#244654'; c.fillRect(0, 0, W, 42);
    c.fillStyle = '#cae5e7'; c.font = '600 18px sans-serif';
    c.fillText(title, 22, 28);
    c.fillStyle = '#7ec4ba'; c.beginPath(); c.arc(W - 30, 22, 5, 0, Math.PI * 2); c.fill();
}
// Generic presentation slide: board title and three numbered panels.
export function screenSlides(c, W, H, spec) {
    c.fillStyle = '#dae8e3'; c.font = '600 24px sans-serif'; c.fillText(spec.boardTitle || spec.name.toUpperCase(), 28, 92, W - 60);
    for (let n = 0; n < 3; n++) { c.fillStyle = ['#527c85', '#8e9d86', '#ac956d'][n]; c.fillRect(30 + n * (W - 45) / 3, 125, (W - 85) / 3, 170); c.fillStyle = '#d5e8de'; c.font = '56px sans-serif'; c.fillText(['01', '02', '03'][n], 58 + n * (W - 45) / 3, 220); }
    c.fillStyle = '#89acb5'; c.font = '16px sans-serif'; c.fillText('CONCEPT WORKSPACE  /  ILLUSTRATIVE CONTENT', 30, H - 30);
}
// Activity caption strip; every screen ends with this.
export function screenFooter(c, W, H, spec, phase) {
    c.fillStyle = '#18323c'; c.fillRect(0, H - 38, W, 38);
    c.fillStyle = '#b8d9d3'; c.font = '600 16px sans-serif'; c.textAlign = 'left';
    c.fillText((spec.modes[phase]?.label || spec.name).toUpperCase(), 22, H - 14, W - 145);
    c.fillStyle = '#91aaa9'; c.font = '12px monospace'; c.fillText('CONCEPT', W - 90, H - 14);
}
export function drawInstitutionalCampus(c, W, H, phase, sky, spec) {
    const night = phase === 'night', evening = phase === 'evening';
    const gradient = c.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, sky[0]); gradient.addColorStop(1, sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, W, H);
    if (night) { c.fillStyle = '#cadbe0'; for (let n = 0; n < 45; n++) c.fillRect(rnd(n + 200) * W, rnd(n + 600) * H * .6, 1.4, 1.4); }
    c.fillStyle = night ? '#dce6dd' : '#fff2d0'; c.beginPath(); c.arc(phase === 'afternoon' ? W * .78 : W * .2, evening ? H * .52 : H * .2, 19, 0, Math.PI * 2); c.fill();
    c.fillStyle = night ? '#243f46' : '#92ad9d'; c.fillRect(0, H * .72, W, H * .28);
    for (let n = 0; n < 5; n++) {
        const x = n * W * .24 - 20, top = H * (.46 + rnd(n + 39) * .16), bw = W * .2;
        c.fillStyle = night ? '#314752' : n % 2 ? '#c7c7b3' : '#aebcba'; c.fillRect(x, top, bw, H * .32);
        c.fillStyle = night ? '#e5c68a' : '#7695a0';
        for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) { if (!night || rnd(n * 30 + row * 5 + col) > .45) c.fillRect(x + 10 + col * bw / 4, top + 14 + row * 27, bw / 6, 16); }
    }
    c.fillStyle = night ? '#405959' : '#d9d5bd'; c.beginPath(); c.moveTo(W * .35, H); c.lineTo(W * .48, H * .76); c.lineTo(W * .56, H * .76); c.lineTo(W * .82, H); c.fill();
    for (let n = 0; n < 9; n++) {
        const x = n * W / 8 + rnd(n) * 20, y = H * (.76 + rnd(n + 80) * .13), radius = 24 + rnd(n + 90) * 16;
        c.fillStyle = night ? '#233d38' : '#617f64'; c.fillRect(x - 3, y - 20, 6, 65);
        c.beginPath(); c.ellipse(x, y - 20, radius, radius * 1.35, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = night ? '#314b40' : '#7a966b'; c.beginPath(); c.ellipse(x + 5, y - 30, radius * .7, radius, 0, 0, Math.PI * 2); c.fill();
    }
}

// ---- Batched dressing ---------------------------------------------------
// Batch the added small parts by furnishing, keeping both draw calls and
// collision bounds modest. Dressing inherits its furniture's saved transform.
// k.build(parent, kit.dress) merges every added part into one vertex-coloured mesh.
export function detailKit() {
    const parts = [];
    const api = {
        add(geometry, at, color, scale = [1, 1, 1], rot = [0, 0, 0]) {
            const g = geometry.toNonIndexed(); geometry.dispose();
            const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)); g.applyMatrix4(matrix);
            const rgb = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i + 1] = rgb.g; colors[i + 2] = rgb.b; }
            g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(g); return api;
        },
        box(size, at, color, rot) { return api.add(new THREE.BoxGeometry(...size), at, color, [1, 1, 1], rot); },
        cyl(r, r2, height, at, color) { return api.add(new THREE.CylinderGeometry(r, r2, height, 16), at, color); },
        ball(r, at, color, scale, rot) { return api.add(new THREE.SphereGeometry(r, 12, 8), at, color, scale, rot); },
        build(parent, material) { if (!parts.length) return; const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); const obj = new THREE.Mesh(g, material); obj.name = 'Furnishing detail'; obj.castShadow = obj.receiveShadow = true; parent.add(obj); return obj; }
    }; return api;
}
export const books = (k, x, y, z, count = 5) => { for (let i = 0; i < count; i++) { const h = 150 + rnd(i) * 55; k.box([24, h, 125], [x + i * 29, y + h / 2, z], ['#547b75', '#c0a473', '#8e6f65', '#6d8497'][i % 4]); k.box([18, 3, 2], [x + i * 29, y + h - 24, z + 63], '#e9ddbf'); } };
export const notebook = (k, x, y, z, color) => { k.box([210, 22, 155], [x, y + 11, z], color); k.box([198, 15, 150], [x + 4, y + 11, z + 2], '#ede8d8'); k.box([212, 2, 156], [x, y + 23, z], color); k.box([130, 3, 5], [x + 15, y + 27, z + 50], '#314b52', [0, .2, 0]); };
export const plant = (k, x, y, z, size = 1) => {
    k.cyl(95 * size, 75 * size, 170 * size, [x, y + 85 * size, z], '#b5aa93'); k.cyl(90 * size, 90 * size, 8 * size, [x, y + 168 * size, z], '#554b3b');
    for (let n = 0; n < 9; n++) { const a = n * 2.4, r = (90 + n % 3 * 25) * size; k.ball(75 * size, [x + Math.cos(a) * r, y + (210 + n * 30) * size, z + Math.sin(a) * r], n % 2 ? '#54795a' : '#365e4b', [.55, 1.5, .8], [0, a, .65]); }
};
// Storage-top books, plant and document tray used by non-clinical groups.
export function storageBooks(k, top) { books(k, -360, top, 20, 6); plant(k, 410, top, 0, .65); }
export function storageTray(k, top) { k.box([330, 32, 230], [80, top + 16, 0], '#6f8a8b'); k.box([300, 8, 215], [80, top + 36, 0], '#eee9d8'); }
// Desk-side workstation dressing (notebook, mouse, keyboard keys, modesty panel).
export function workstationDetail(k, top) {
    notebook(k, 560, top, 155, '#a0896e'); k.box([160, 3, 180], [410, top + 1.5, 120], '#52636a'); k.ball(28, [410, top + 17, 120], '#a7b3b4', [.8, .5, 1.3]);
    for (let n = 0; n < 42; n++) k.box([19, 2, 18], [-185 + n % 14 * 28, top + 23, 130 + Math.floor(n / 14) * 30], '#6a7a84');
    k.box([1300, 240, 25], [0, top - 170, -300], '#4d6469');
}
// Default activity-table materials (notebook and loose sheets).
export function activityNotebook(k, phase, y) {
    notebook(k, 340, y, -90, phase === 3 ? '#6c8680' : '#b79269');
    if (phase !== 3) for (let n = 0; n < 3; n++) k.box([70, 2, 65], [240 + n * 85, y + 1, 70], ['#ccb996', '#9bb9ac', '#a1b6c1'][n]);
}

// A framed illustration on the right (side) wall or the left (window) wall,
// in the solid bay beyond the daylight opening. `landscape` paints layered
// hills and trees; otherwise a node diagram (`squares` for rectangular nodes).
export function identityGallery(kit, { right, z, name, landscape, trees = 4, squares = false, background = '#ede7d6' }) {
    const { asset, layout, spec, mesh, box, material } = kit, { width: w, depth: d, back: bz } = layout;
    const gallery = asset('identity-gallery', name, [right ? w / 2 - 45 : -w / 2 + 45, 1650, bz + d * z], right ? kit.right : kit.left);
    gallery.rotation.y = right ? -Math.PI / 2 : Math.PI / 2;
    const artWidth = Math.min(1350, d * (right ? .12 : .17));
    box(gallery, [artWidth + 65, 965, 35], [0, 0, 0], kit.oak, 6);
    const art = institutionalMap((c, W, H) => {
        c.fillStyle = background; c.fillRect(0, 0, W, H);
        const palette = [spec.accent, '#91b4a5', '#dab77d', '#9aafbe', '#c79481'];
        if (landscape) {
            // Child-made garden shapes / calm landscape, with layered depth.
            c.fillStyle = '#e7d6a4'; c.beginPath(); c.arc(W * .76, H * .26, 42, 0, Math.PI * 2); c.fill();
            for (let n = 0; n < 3; n++) {
                c.fillStyle = palette[n]; c.beginPath(); c.moveTo(0, H);
                for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (.54 + n * .12) + Math.sin(x / W * 7 + n * 2) * H * .12);
                c.lineTo(W, H); c.fill();
            }
            for (let n = 0; n < trees; n++) {
                const x = 70 + n * W / (trees + 1), y = H * .58 + n % 2 * 40;
                c.fillStyle = '#547367'; c.fillRect(x - 3, y, 6, 85);
                c.fillStyle = palette[(n + 1) % 5]; c.beginPath(); c.ellipse(x, y, 24, 44, n * .3, 0, Math.PI * 2); c.fill();
            }
        } else {
            // Maps, molecular structures and research diagrams have a distinct
            // visual language, without real security or clinical information.
            c.strokeStyle = '#b8c8c2'; c.lineWidth = 1;
            for (let x = 20; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
            for (let y = 20; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            const nodes = Array.from({ length: 9 }, (_, n) => [W * (.12 + n % 3 * .36), H * (.2 + Math.floor(n / 3) * .3)]);
            c.strokeStyle = spec.accent; c.lineWidth = 5;
            nodes.forEach(([x, y], n) => {
                if (n) { c.beginPath(); c.moveTo(...nodes[Math.floor((n - 1) / 2)]); c.lineTo(x, y); c.stroke(); }
                c.fillStyle = palette[n % 5];
                if (squares) c.fillRect(x - 30, y - 23, 60, 46);
                else { c.beginPath(); c.arc(x, y, 20 + n % 3 * 7, 0, Math.PI * 2); c.fill(); }
            });
        }
    }, 768, 448);
    mesh(gallery, new THREE.PlaneGeometry(artWidth, 900), material('#ffffff', { map: art, roughness: .85 }), [0, 0, 20]);
    return gallery;
}

// Shared shell detail, per-furnishing dressing and decor. Group hooks:
//   group.dressProp(id, k, g, kit)  add batched detail to a furnishing
//   group.decorate(kit)             perimeter features (shelves, benches...)
// Returns the per-phase atmosphere function.
export function enrichInstitutionalRoom(kit) {
    const { room, root, layout, spec, h, group, options: o, asset, label } = kit, { box, mesh, material } = h;
    const wall = kit.back, { right, left, window } = kit;
    const { width: w, depth: d, back: bz, height: ceiling } = layout, front = bz + d;
    const dress = kit.dress = material('#ffffff', { vertexColors: true, roughness: .68 }); dress.userData.roomSurface = 'powder';
    // Baseboards, reveals and a continuous upper rail give the shell thickness.
    for (const [parent, alongX, length, at] of [[wall, true, w, [0, 0, bz + 20]], [right, false, d, [w / 2 - 20, 0, bz + d / 2]], [left, false, d, [-w / 2 + 20, 0, bz + d / 2]]]) {
        const k = detailKit(); for (const y of [65, ceiling - 95]) k.box(alongX ? [length, 100, 32] : [32, 100, length], [at[0], y, at[2]], o.trimColor); k.build(parent, dress);
    }
    const reveal = detailKit(); reveal.box([d * .48 + 150, 40, 210], [0, -880, 40], '#c7c7b9');
    for (let n = 0; n < 12; n++) reveal.box([d * .48, 13, 40], [0, 730 - n * 27, 70], '#d7d8cc'); reveal.build(window, dress);
    // Felt acoustic panels belong to the wall, so cutaway and rearranging agree.
    const acoustic = asset('acoustic-panels', o.acousticName, [w / 2 - 45, 1850, bz + d * .24], right); acoustic.rotation.y = -Math.PI / 2;
    const k = detailKit();
    for (let n = 0; n < 5; n++) {
        k.box([210, 1050, 45], [-560 + n * 280, 0, 0], n % 2 ? '#a7b2a7' : spec.accent);
        for (let line = 0; line < 9; line++) k.box([3, 980, 2], [-648 + n * 280 + line * 22, 0, 24], '#bdc4b6');
    } k.build(acoustic, dress);
    const clock = asset('wall-clock', 'Wall clock', [-w / 2 + 550, 2450, bz + 55], wall);
    const face = institutionalMap((c, W, H) => {
        c.fillStyle = '#e7e4d5'; c.fillRect(0, 0, W, H); c.strokeStyle = '#365159'; c.fillStyle = '#365159'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let n = 1; n <= 12; n++) { const a = n * Math.PI / 6 - Math.PI / 2; c.font = '22px sans-serif'; c.fillText(n, W / 2 + Math.cos(a) * W * .37, H / 2 + Math.sin(a) * H * .37); }
        c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W * .29, H * .48); c.moveTo(W / 2, H / 2); c.lineTo(W * .75, H * .35); c.stroke();
    }, 256, 256);
    mesh(clock, new THREE.CylinderGeometry(175, 175, 24, 48), kit.oak).rotation.x = Math.PI / 2;
    mesh(clock, new THREE.CircleGeometry(160, 48), material('#ffffff', { map: face, roughness: .75 }), [0, 0, 13]);
    // Thin room labels and practical signage live on architecture, not in aisles.
    label(right, o.signLabel, [1050, 150], [w / 2 - 40, 2450, front - 1600]).rotation.y = -Math.PI / 2;
    if (o.rugColor) {
        const rug = asset('desk-zone-rug', 'Mobile workspace floor rug', [layout.desk[0], 0, layout.desk[1] + 150]);
        const map = institutionalMap((c, W, H) => {
            c.fillStyle = o.rugColor; c.fillRect(0, 0, W, H);
            c.strokeStyle = '#dbd7bd'; c.lineWidth = 14; c.strokeRect(25, 25, W - 50, H - 50);
            c.lineWidth = 2; c.strokeRect(48, 48, W - 96, H - 96);
            for (let n = 0; n < 1800; n++) { c.fillStyle = n % 2 ? '#f0e9d515' : '#263b3315'; c.fillRect(rnd(n) * W, rnd(n + 1800) * H, 1, 4); }
        }, 512, 512);
        const m = material('#ffffff', { map, roughness: .95 }); m.userData.roomSurface = 'fabric';
        const p = mesh(rug, new THREE.BoxGeometry(2000, 6, 1900), m, [0, 3, 0]); p.castShadow = false;
    }
    // A biophilic corner stays away from the desk's left mobility lane.
    if (o.planter) {
        const greenery = asset('corner-planter', 'Floor planter', [w / 2 - 400, 0, front - 420]);
        const foliage = detailKit(); plant(foliage, 0, 0, 0, 1.3); foliage.build(greenery, dress);
    }
    if (o.boardOnSideWall) { kit.board.position.set(w / 2 - 45, 1900, bz + d * .52); kit.board.rotation.y = -Math.PI / 2; right.add(kit.board); }
    // All additions are attached to their support, including books and screens.
    root.traverse(g => {
        const id = g.userData.propId; if (!id) return; const k = detailKit();
        group.dressProp?.(id, k, g, kit);
        if (/chair|stool/.test(id)) {
            const adult = /operator|mobile-desk/.test(id), height = adult ? 450 : o.chairDetailHeight, wide = height < 400 ? 310 : 420;
            for (const x of [-wide * .37, wide * .37]) k.box([12, height * .64, 14], [x, height * 1.23, wide * .4], '#74838a');
            if (adult) { k.box([wide - 30, 14, wide * .82], [0, height + 25, 0], '#577675'); k.box([wide - 35, 32, 20], [0, height * 1.58, wide * .42], '#445b62'); }
        }
        k.build(g, dress);
    });
    // Differentiating features sit against the room perimeter, outside routes.
    group.decorate?.(kit);
    root.userData.detailLevel = 'institutional-atmosphere-v3';
    return finishInstitutionalAtmosphere(kit);
}

// Daypart dressing stays on its actual support: editing a table carries its
// lamp, stationery and project pieces with it. No new blockers in circulation.
// Group hooks:
//   group.finishDecor(kit)                 galleries, pegs, hygiene stations...
//   group.activityMaterials(k, phase, y, kit)  per-phase planning-table kit
//   group.extraLamps(kit)                  extra local lamps (kit.lamps, max 2 total)
//   group.atmosphere(phase, gain, kit)     per-phase changes owned by the group
function finishInstitutionalAtmosphere(kit) {
    const { root, spec, h, group, options: o, dress, byId } = kit, { box, material } = h;
    const phases = Object.keys(spec.modes), variants = [], lamps = kit.lamps = [];
    group.finishDecor?.(kit);
    const activity = byId('activity-table');
    if (activity) {
        const stand = detailKit(); stand.box([95, 130, 10], [-460, 805, -200], '#b7bba9'); stand.box([140, 12, 80], [-460, 746, -200], '#657d7c');
        stand.build(activity, dress);
        // Five compact project setups read as daily activity, not clutter.
        for (let phase = 0; phase < 5; phase++) {
            const g = new THREE.Group(); g.name = spec.modes[phases[phase]].label + ' materials'; activity.add(g); variants.push({ g, phase });
            const k = detailKit(), y = 740;
            if (group.activityMaterials) group.activityMaterials(k, phase, y, kit); else activityNotebook(k, phase, y);
            k.build(g, dress);
        }
    }
    // Two local light sources maximum, independent from the three general
    // pools. Lamps are children of furniture so saved rearrangements carry them.
    const taskLamp = kit.taskLamp = (support, height, x, z, clinicalLamp = false, color = '#ffe4bd') => {
        if (!support) return;
        const frame = detailKit(); frame.cyl(68, 75, 14, [x, height + 7, z], '#5e7479');
        frame.box([16, 310, 16], [x, height + 165, z], '#819494'); frame.box([200, 25, 100], [x + 65, height + 325, z], '#627d80'); frame.build(support, dress);
        const luminous = material('#f7f0db', { emissive: '#ffe8c4', emissiveIntensity: .5, roughness: .4 });
        box(support, [175, 5, 75], [x + 65, height + 310, z], luminous, 3);
        const light = new THREE.PointLight('#ffe8c4', 0, 1800 * root.scale.x, 2); light.position.set(x + 65, height + 285, z); support.add(light);
        lamps.push({ light, luminous, clinicalLamp, color });
    };
    taskLamp(activity, 740, -450, -170);
    const second = o.lampSupport;
    if (second) taskLamp(byId(second.id), second.height, -560, -210, !!second.clinical, second.color);
    group.extraLamps?.(kit);
    let previous;
    return (phase, gain) => {
        const i = Math.max(0, phases.indexOf(phase)), night = phase === 'night';
        variants.forEach(v => v.g.visible = v.phase === i);
        lamps.forEach(({ light, luminous, clinicalLamp, color = '#ffe4bd' }) => {
            const strength = [.12, .18, .7, .48, .55][i] * (clinicalLamp && night ? .65 : 1);
            light.color.set(color);
            light.intensity = (root.scale.x * 1000) ** 2 * strength * gain;
            luminous.emissive.copy(light.color); luminous.emissiveIntensity = .2 + strength * gain;
        });
        if (previous !== phase) {
            // Clock and planning display follow the selected time, not wall time.
            const clock = byId('wall-clock'); const face = clock?.children.find(m => m.geometry?.type === 'CircleGeometry')?.material.map;
            if (face) {
                const c = face.image.getContext('2d'), W = face.image.width, H = face.image.height;
                c.fillStyle = '#e7e4d5'; c.fillRect(0, 0, W, H); c.fillStyle = c.strokeStyle = '#365159'; c.textAlign = 'center'; c.textBaseline = 'middle';
                for (let n = 1; n <= 12; n++) { const a = n * Math.PI / 6 - Math.PI / 2; c.font = '22px sans-serif'; c.fillText(n, W / 2 + Math.cos(a) * W * .37, H / 2 + Math.sin(a) * H * .37); }
                const hours = [9, 14, 18, 22, 16][i]; c.lineWidth = 7; c.lineCap = 'round';
                for (const [angle, len] of [[hours % 12 * Math.PI / 6 - Math.PI / 2, W * .24], [-Math.PI / 2, W * .32]]) { c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(angle) * len, H / 2 + Math.sin(angle) * len); c.stroke(); }
                face.needsUpdate = true;
            }
            const board = byId('planning-board'); const map = board?.children.find(m => m.material?.map)?.material.map;
            if (map) { const c = map.image.getContext('2d'), W = map.image.width, H = map.image.height; kit.drawBoard(c, W, H, i); c.fillStyle = o.boardFooter; c.fillRect(0, H - 42, W, 42); c.fillStyle = spec.accent; c.textAlign = 'left'; c.font = '600 18px sans-serif'; c.fillText(spec.modes[phase].label.toUpperCase(), 28, H - 16, W - 56); map.needsUpdate = true; }
            previous = phase;
        }
        group.atmosphere?.(phase, gain, kit);
        root.userData.institutionalAtmosphere = { phase, localLights: lamps.length, activityVariants: 5, clockHour: [9, 14, 18, 22, 16][i], gallery: spec.kind };
    };
}
