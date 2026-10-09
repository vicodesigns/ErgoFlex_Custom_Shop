import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministic, locally generated materials and illustrative displays. These
// are scene dressing, never live medical, police or security data.
const rnd = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };
export function institutionalMap(draw, width = 768, height = 384) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
export function institutionalFloor(spec, w, d) {
    const carpet = ['operations', 'police', 'government', 'it'].includes(spec.kind), clinical = ['lab', 'hospital'].includes(spec.kind);
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
const boardTitles = { security: 'OPERATIONS / OVERVIEW', police: 'SHIFT BRIEFING', government: 'PUBLIC SERVICE / TODAY', kindergarten: 'LITTLE DISCOVERIES', elementary: 'READ / EXPLORE / CREATE', middleschool: 'DESIGN A BETTER CITY', highschool: 'ENERGY / SYSTEMS / CHANGE', college: 'IDEAS INTO PRACTICE', university: 'RESEARCH / SHARED DISCOVERY', laboratory: 'OBSERVE / MEASURE / UNDERSTAND', hospital: 'CARE TEAM / HANDOVER', mobileit: 'DEPLOY / DIAGNOSE / CONNECT' };
export function drawInstitutionalBoard(c, W, H, spec, variant = 0) {
    const dark = ['operations', 'it'].includes(spec.kind), young = ['early', 'primary'].includes(spec.kind);
    c.fillStyle = dark ? '#17323c' : young ? '#eadfc8' : '#f1f0e7'; c.fillRect(0, 0, W, H);
    c.fillStyle = dark ? '#b6d7d6' : spec.accent; c.font = '600 28px sans-serif'; c.fillText(boardTitles[spec.id], 28, 47, W - 56);
    c.fillStyle = dark ? '#92b2ba' : '#6e7b79'; c.font = '14px sans-serif'; c.fillText('ERGOFLEX  /  LEARNING & WORKSPACE CONCEPT', 30, H - 20);
    if (young) {
        for (let n = 0; n < 5; n++) {
            const x = 30 + n * (W - 45) / 5, y = 80 + n % 2 * 12, width = (W - 90) / 5;
            c.fillStyle = '#fffaf0'; c.save(); c.translate(x, y); c.rotate((n - 2) * .025); c.fillRect(0, 0, width, H - 140);
            c.fillStyle = ['#d19267', '#84a99a', '#88a9bf', '#d6b86c', '#ae8eab'][n];
            c.beginPath(); c.arc(width / 2, 66, 30, 0, Math.PI * 2); c.fill();
            c.fillRect(18, 113, width - 36, 12); c.fillRect(26, 137, width - 52, 8);
            c.fillStyle = '#566b65'; c.font = '19px sans-serif'; c.textAlign = 'center'; c.fillText(['Aa', 'Bb', 'Cc', '123', '★'][n], width / 2, 200); c.restore();
        }
    } else if (['secondary', 'college', 'university', 'lab'].includes(spec.kind)) {
        c.strokeStyle = '#d4ded6'; c.lineWidth = 1;
        for (let x = 32; x < W - 30; x += 26) { c.beginPath(); c.moveTo(x, 80); c.lineTo(x, H - 60); c.stroke(); }
        for (let y = 80; y < H - 50; y += 26) { c.beginPath(); c.moveTo(32, y); c.lineTo(W - 30, y); c.stroke(); }
        c.strokeStyle = spec.accent; c.lineWidth = 4;
        if (spec.id === 'middleschool') {
            for (let n = 0; n < 6; n++) { const x = 65 + n * 103, y = 270 - n % 3 * 45; c.strokeRect(x, y - 90, 70, 90); c.fillStyle = '#bdd3c7'; c.fillRect(x + 12, y - 76, 15, 18); c.fillRect(x + 42, y - 76, 15, 18); }
        } else {
            c.beginPath(); for (let i = 0; i < 120; i++) c.lineTo(55 + i * 5.4, 210 - Math.sin(i * .065 + variant) * 75 * Math.sin(i * .016)); c.stroke();
            c.font = '24px serif'; c.fillStyle = spec.accent; c.fillText(spec.id === 'highschool' ? 'E = P × t' : spec.kind === 'lab' ? 'Question → Experiment → Evidence' : 'Hypothesis → Exploration → Discovery', 70, 320, W - 120);
        }
    } else {
        const headings = spec.kind === 'hospital' ? ['ROUNDS', 'COORDINATION', 'HANDOVER'] : spec.kind === 'police' ? ['BRIEF', 'REVIEW', 'RESPOND'] : ['PLAN', 'IN PROGRESS', 'COMPLETE'];
        for (let col = 0; col < 3; col++) {
            const x = 30 + col * (W - 50) / 3;
            c.fillStyle = dark ? '#8ec3c5' : spec.accent; c.font = '600 18px sans-serif'; c.fillText(headings[col], x + 8, 94);
            for (let row = 0; row < 3; row++) { c.fillStyle = ['#cdded4', '#ddc8a5', '#becedb'][(row + col) % 3]; c.fillRect(x, 115 + row * 65, (W - 90) / 3, 50); c.fillStyle = '#536b70'; for (let line = 0; line < 2; line++) c.fillRect(x + 14, 130 + row * 65 + line * 13, 110 - line * 25, 3); }
        }
    }
}
export function drawInstitutionalScreen(c, W, H, spec, variant = 0, phase = 'morning') {
    c.fillStyle = '#10232d'; c.fillRect(0, 0, W, H); c.fillStyle = '#244654'; c.fillRect(0, 0, W, 42);
    c.fillStyle = '#cae5e7'; c.font = '600 18px sans-serif';
    c.fillText(({ operations: 'SITE OVERVIEW', police: 'BRIEFING / REVIEW', government: 'SERVICE DESK', hospital: 'OBSERVATION / DEMO', lab: 'INSTRUMENT / DEMO', it: 'NETWORK / DIAGNOSTICS' })[spec.kind] || 'LEARNING / PRESENTATION', 22, 28);
    c.fillStyle = '#7ec4ba'; c.beginPath(); c.arc(W - 30, 22, 5, 0, Math.PI * 2); c.fill();
    if (spec.kind === 'operations') {
        // Architectural camera concepts with different views, no real footage.
        for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
            const x = 16 + col * W / 2, y = 56 + row * (H - 65) / 2, pw = W / 2 - 28, ph = (H - 90) / 2;
            c.fillStyle = '#536c76'; c.fillRect(x, y, pw, ph); c.fillStyle = '#304b57'; c.beginPath(); c.moveTo(x, y + ph); c.lineTo(x + pw * .47, y + 22); c.lineTo(x + pw, y + ph); c.fill();
            c.strokeStyle = '#94aeb5'; for (let n = 0; n < 4; n++) { c.strokeRect(x + n * pw / 4, y + 20, pw / 7, ph * .55); }
            c.strokeStyle = '#65cdbb'; c.strokeRect(x + pw * (.3 + variant % 3 * .1), y + ph * .4, 40, 60); c.fillStyle = '#e3ece7'; c.font = '13px monospace'; c.fillText(`ZONE ${1 + col + row * 2 + variant * 4} / DEMO`, x + 8, y + ph - 8);
        }
    } else if (spec.kind === 'hospital' || spec.kind === 'lab') {
        c.strokeStyle = '#294450'; c.lineWidth = 1;
        for (let x = 20; x < W; x += 24) { c.beginPath(); c.moveTo(x, 55); c.lineTo(x, H - 20); c.stroke(); }
        for (let y = 60; y < H; y += 24) { c.beginPath(); c.moveTo(20, y); c.lineTo(W - 20, y); c.stroke(); }
        for (let row = 0; row < 3; row++) {
            c.strokeStyle = ['#76d6a3', '#e4c07b', '#7cbedd'][row]; c.lineWidth = 2.5; c.beginPath();
            for (let j = 0; j < 160; j++) { const pulse = j % 30; c.lineTo(22 + j * (W - 160) / 160, 110 + row * 94 + (spec.kind === 'hospital' ? pulse === 10 ? -38 : pulse === 12 ? 20 : Math.sin(j * .4) * 3 : Math.sin(j * .1 + row) * 25)); } c.stroke();
            c.fillStyle = c.strokeStyle; c.font = '600 30px monospace'; c.fillText(['— —', '— —', '— —'][row], W - 112, 120 + row * 94);
        }
    } else if (spec.kind === 'it') {
        c.strokeStyle = '#65bbb6'; c.lineWidth = 3; const nodes = [[W / 2, 105], [W / 4, 210], [W * .75, 210], [W * .15, 320], [W * .4, 320], [W * .65, 320], [W * .87, 320]];
        nodes.slice(1).forEach(([x, y], i) => { const p = nodes[i < 2 ? 0 : i < 4 ? 1 : 2]; c.beginPath(); c.moveTo(...p); c.lineTo(x, y); c.stroke(); });
        nodes.forEach(([x, y], i) => { c.fillStyle = '#254b5b'; c.fillRect(x - 38, y - 20, 76, 40); c.fillStyle = '#cbebdf'; c.font = '14px monospace'; c.fillText(i ? 'NODE 0' + i : 'CORE', x - 28, y + 5); });
    } else {
        c.fillStyle = '#dae8e3'; c.font = '600 24px sans-serif'; c.fillText(boardTitles[spec.id], 28, 92, W - 60);
        for (let n = 0; n < 3; n++) { c.fillStyle = ['#527c85', '#8e9d86', '#ac956d'][n]; c.fillRect(30 + n * (W - 45) / 3, 125, (W - 85) / 3, 170); c.fillStyle = '#d5e8de'; c.font = '56px sans-serif'; c.fillText(['01', '02', '03'][n], 58 + n * (W - 45) / 3, 220); }
        c.fillStyle = '#89acb5'; c.font = '16px sans-serif'; c.fillText('CONCEPT WORKSPACE  /  ILLUSTRATIVE CONTENT', 30, H - 30);
    }
    c.fillStyle = '#18323c'; c.fillRect(0,H-38,W,38);
    c.fillStyle = '#b8d9d3'; c.font = '600 16px sans-serif'; c.textAlign = 'left';
    c.fillText((spec.modes[phase]?.label || spec.name).toUpperCase(),22,H-14,W-145);
    c.fillStyle = '#91aaa9'; c.font = '12px monospace'; c.fillText('CONCEPT',W-90,H-14);

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
// Batch the added small parts by furnishing, keeping both draw calls and
// collision bounds modest. Dressing inherits its furniture's saved transform.
function detailKit() {
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
const books = (k, x, y, z, count = 5) => { for (let i = 0; i < count; i++) { const h = 150 + rnd(i) * 55; k.box([24, h, 125], [x + i * 29, y + h / 2, z], ['#547b75', '#c0a473', '#8e6f65', '#6d8497'][i % 4]); k.box([18, 3, 2], [x + i * 29, y + h - 24, z + 63], '#e9ddbf'); } };
const notebook = (k, x, y, z, color) => { k.box([210, 22, 155], [x, y + 11, z], color); k.box([198, 15, 150], [x + 4, y + 11, z + 2], '#ede8d8'); k.box([212, 2, 156], [x, y + 23, z], color); k.box([130, 3, 5], [x + 15, y + 27, z + 50], '#314b52', [0, .2, 0]); };
const plant = (k, x, y, z, size = 1) => {
    k.cyl(95 * size, 75 * size, 170 * size, [x, y + 85 * size, z], '#b5aa93'); k.cyl(90 * size, 90 * size, 8 * size, [x, y + 168 * size, z], '#554b3b');
    for (let n = 0; n < 9; n++) { const a = n * 2.4, r = (90 + n % 3 * 25) * size; k.ball(75 * size, [x + Math.cos(a) * r, y + (210 + n * 30) * size, z + Math.sin(a) * r], n % 2 ? '#54795a' : '#365e4b', [.55, 1.5, .8], [0, a, .65]); }
};
export function enrichInstitutionalRoom(room, root, layout, spec, h, ctx) {
    const { asset, wall, right, left, window, cabinet, label, board, table, chair } = ctx, { box, mesh, rod, material } = h;
    const { width: w, depth: d, back: bz, height: ceiling } = layout, front = bz + d;
    const dress = material('#ffffff', { vertexColors: true, roughness: .68 }); dress.userData.roomSurface = 'powder';
    const young = ['early', 'primary'].includes(spec.kind), clinical = ['lab', 'hospital'].includes(spec.kind);
    // Baseboards, reveals and a continuous upper rail give the shell thickness.
    for (const [parent, alongX, length, at] of [[wall, true, w, [0, 0, bz + 20]], [right, false, d, [w / 2 - 20, 0, bz + d / 2]], [left, false, d, [-w / 2 + 20, 0, bz + d / 2]]]) {
        const k = detailKit(); for (const y of [65, ceiling - 95]) k.box(alongX ? [length, 100, 32] : [32, 100, length], [at[0], y, at[2]], clinical ? '#97aca8' : '#c4c2b6'); k.build(parent, dress);
    }
    const reveal = detailKit(); reveal.box([d * .48 + 150, 40, 210], [0, -880, 40], '#c7c7b9');
    for (let n = 0; n < 12; n++) reveal.box([d * .48, 13, 40], [0, 730 - n * 27, 70], '#d7d8cc'); reveal.build(window, dress);
    // Felt acoustic panels belong to the wall, so cutaway and rearranging agree.
    const acoustic = asset('acoustic-panels', young ? 'Wall discovery gallery' : clinical ? 'Wall information gallery' : 'Wall acoustic panels', [w / 2 - 45, 1850, bz + d * .24], right); acoustic.rotation.y = -Math.PI / 2;
    const k = detailKit();
    for (let n = 0; n < 5; n++) {
        k.box([210, 1050, 45], [-560 + n * 280, 0, 0], n % 2 ? '#a7b2a7' : spec.accent);
        for (let line = 0; line < 9; line++) k.box([3, 980, 2], [-648 + n * 280 + line * 22, 0, 24], '#bdc4b6');
    } k.build(acoustic, dress);
    const clock=asset('wall-clock','Wall clock',[-w/2+550,2450,bz+55],wall);
    const face=institutionalMap((c,W,H)=>{
        c.fillStyle='#e7e4d5';c.fillRect(0,0,W,H);c.strokeStyle='#365159';c.fillStyle='#365159';c.textAlign='center';c.textBaseline='middle';
        for(let n=1;n<=12;n++){const a=n*Math.PI/6-Math.PI/2;c.font='22px sans-serif';c.fillText(n, W/2+Math.cos(a)*W*.37,H/2+Math.sin(a)*H*.37);}
        c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(W/2,H/2);c.lineTo(W*.29,H*.48);c.moveTo(W/2,H/2);c.lineTo(W*.75,H*.35);c.stroke();
    },256,256);
    mesh(clock,new THREE.CylinderGeometry(175,175,24,48),ctx.oak).rotation.x=Math.PI/2;
    mesh(clock,new THREE.CircleGeometry(160,48),material('#ffffff',{map:face,roughness:.75}),[0,0,13]);
    // Thin room labels and practical signage live on architecture, not in aisles.
    label(right, clinical ? 'CARE & SCIENCE' : young ? 'A PLACE TO GROW' : 'CONNECTED WORKSPACE', [1050, 150], [w / 2 - 40, 2450, front - 1600]).rotation.y = -Math.PI / 2;
    if (!clinical) {
        const rug = asset('desk-zone-rug', 'Mobile workspace floor rug', [layout.desk[0], 0, layout.desk[1] + 150]);
        const map = institutionalMap((c, W, H) => {
            c.fillStyle = ['operations','it','police'].includes(spec.kind) ? '#58727a' : '#889b85'; c.fillRect(0,0,W,H);
            c.strokeStyle = '#dbd7bd'; c.lineWidth = 14; c.strokeRect(25,25,W-50,H-50);
            c.lineWidth = 2; c.strokeRect(48,48,W-96,H-96);
            for(let n=0;n<1800;n++){c.fillStyle=n%2?'#f0e9d515':'#263b3315';c.fillRect(rnd(n)*W,rnd(n+1800)*H,1,4);}
        },512,512);
        const m=material('#ffffff',{map,roughness:.95});m.userData.roomSurface='fabric';
        const p=mesh(rug,new THREE.BoxGeometry(2000,6,1900),m,[0,3,0]);p.castShadow=false;
    }
    // A biophilic corner stays away from the desk's left mobility lane.
    if (!clinical) {
        const greenery = asset('corner-planter', 'Floor planter', [w / 2 - 400, 0, front - 420]);
        const foliage = detailKit(); plant(foliage, 0, 0, 0, 1.3); foliage.build(greenery, dress);
    }
    if (['lab', 'it'].includes(spec.kind)) { board.position.set(w / 2 - 45, 1900, bz + d * .52); board.rotation.y = -Math.PI / 2; right.add(board); }
    // All additions are attached to their support, including books and screens.
    root.traverse(g => {
        const id = g.userData.propId; if (!id) return; const k = detailKit();
        if (id === 'storage') {
            const top = spec.kind === 'early' ? 940 : 1200;
            if (clinical) {
                for (let n = 0; n < 3; n++) {
                    k.box([230, 105, 220], [-350 + n * 330, top + 52.5, 0], '#c8d9d4');
                    k.box([180, 26, 3], [-350 + n * 330, top + 66, 112], '#f2f4eb');
                }
            } else { books(k, -360, top, 20, 6); plant(k, 410, top, 0, .65); }
            if (young) { for (let n = 0; n < 4; n++) { k.cyl(45, 45, 14, [-420 + n * 100, 160, 160], '#d2ac6c'); } }
            else { k.box([330, 32, 230], [80, top + 16, 0], '#6f8a8b'); k.box([300, 8, 215], [80, top + 36, 0], '#eee9d8'); }
        }
        if (/student-table/.test(id)) {
            const top = spec.kind === 'early' ? 520 : spec.kind === 'primary' ? 620 : 740;
            notebook(k, -390, top, 100, spec.accent); notebook(k, 380, top, 100, '#bf946c');
            if (spec.id === 'middleschool') { k.box([240, 10, 160], [0, top + 5, 0], '#8a9e89'); for (let n = 0; n < 3; n++) { k.box([40, 35 + n * 25, 40], [-75 + n * 75, top + 24 + n * 12.5, 0], '#d2b581'); } }
            if (spec.id === 'highschool') { k.cyl(30, 30, 110, [170, top + 55, -120], '#799a9e'); k.ball(45, [170, top + 150, -120], '#b6b79a'); }
            if (spec.kind === 'college' || spec.kind === 'university') { for (let n = 0; n < 10; n++) k.box([22, 1, 12], [-120 + n % 5 * 48, top + 13, 20 + Math.floor(n / 5) * 28], '#70818a'); }
            // Cross rails and feet make table frames feel built rather than boxed.
            k.box([1120, 45, 22], [0, top - 80, -240], '#72818a');
        }
        if (/workstation|service-bench/.test(id)) {
            const top = id === 'service-bench' ? 900 : 740;
            notebook(k, 560, top, 155, '#a0896e'); k.box([160, 3, 180], [410, top + 1.5, 120], '#52636a'); k.ball(28, [410, top + 17, 120], '#a7b3b4', [.8, .5, 1.3]);
            for (let n = 0; n < 42; n++) k.box([19, 2, 18], [-185 + n % 14 * 28, top + 23, 130 + Math.floor(n / 14) * 30], '#6a7a84');
            k.box([1300, 240, 25], [0, top - 170, -300], '#4d6469');
        }
        if (/student-chair/.test(id) && !young) {
            // Alternating satchels give the seating rhythm without changing its
            // circulation footprint or creating loose obstacles on the floor.
            const n = Number(id.split('-')[2]) || 0;
            if (n % 2 === 0) { k.box([200,250,90],[0,370,200], '#8d9c90'); k.box([145,85,12],[0,285,250],'#b8b39b'); }
        }
        if (/workstation/.test(id) && spec.kind === 'operations') {
            for (const x of [-70,70]) k.ball(28,[x,775,-10],'#293e48',[.5,1,1]);
            k.box([130,12,12],[0,795,-10],'#738c94');
        }
        if (/care-bed/.test(id)) {
            // Personal bedside storage and a folded towel stay on the bed base.
            k.box([280,65,190],[-280,745,650],'#e9e8da');
            k.box([240,12,170],[-280,783,650],'#c5d5cd');
        }
        if (/chair|stool/.test(id)) {
            const adult = /operator|mobile-desk/.test(id), height = adult ? 450 : spec.kind === 'lab' ? 610 : spec.kind === 'early' ? 260 : spec.kind === 'primary' ? 360 : 480, wide = height < 400 ? 310 : 420;
            for (const x of [-wide * .37, wide * .37]) k.box([12, height * .64, 14], [x, height * 1.23, wide * .4], '#74838a');
            if (adult) { k.box([wide - 30, 14, wide * .82], [0, height + 25, 0], '#577675'); k.box([wide - 35, 32, 20], [0, height * 1.58, wide * .42], '#445b62'); }
        }
        if (/care-bed/.test(id)) {
            k.box([920, 40, 1080], [0, 690, 280], '#d3dfd8'); for (let n = 0; n < 9; n++) k.box([920, 3, 9], [0, 711, -170 + n * 110], '#a6bbb4');
            for (const dx of [-510, 510]) for (const z of [-600, 0, 600]) k.box([22, 210, 22], [dx, 685, z], '#91a5ac');
            k.box([440, 220, 12], [0, 755, 1098], '#e1e8e2'); k.box([120, 24, 15], [0, 790, 1108], '#7a969c');
        }
        if (/privacy-screen/.test(id)) {
            for (let n = 0; n < 29; n++) { const wave = Math.sin(n * Math.PI / 2) * 12; k.cyl(12, 12, 1460, [wave, 1170, -700 + n * 50], n % 2 ? '#9bb6b1' : '#bfd1c8'); }
            k.box([32, 25, 1550], [0, 1930, 0], '#90a6ad');
        }
        if (/lab-bench/.test(id)) {
            k.box([1680, 35, 18], [0, 935, -410], '#e0e5dc');
            for (let n = 0; n < 5; n++) { k.cyl(18, 18, 110, [-120 + n * 48, 980, -130], '#b3cdd0'); k.cyl(20, 20, 12, [-120 + n * 48, 1040, -130], spec.accent); }
            k.box([290, 18, 100], [0, 918, -130], '#b7bdaf'); notebook(k, 0, 900, 240, '#78948c');
        }
        if (/server-rack/.test(id)) {
            k.box([25, 1850, 35], [-380, 1010, 486], '#202e3a'); k.box([25, 1850, 35], [380, 1010, 486], '#202e3a');
            for (let row = 0; row < 10; row++) {
                for (let n = 0; n < 14; n++) k.box([13, 9, 3], [-290 + n * 32, 230 + row * 170, 482], '#253e48');
                for (let n = 0; n < 4; n++) { k.box([20, 20, 10], [-270 + n * 68, 260 + row * 170, 489], '#adbabd'); k.box([5, 65, 8], [-260 + n * 68, 298 + row * 170, 495], n % 2 ? '#79aaa0' : '#b19c65'); }
            }
        }
        k.build(g, dress);
    });
    // Differentiating features sit against the room perimeter, outside routes.
    if (young) {
        const shelf = cabinet('reading-shelf', [-250, 0, bz + 360], 1350, 850, true);
        const k = detailKit(); books(k, -480, 850, 0, 14); k.build(shelf, dress);
        const art = asset('learning-gallery', 'Wall learning gallery', [-w * .26, 1660, bz + 55], wall);
        const m = material('#ffffff', { map: institutionalMap((c, W, H) => drawInstitutionalBoard(c, W, H, spec), 768, 384), roughness: .9 });
        box(art, [1900, 930, 35], [0, 0, 0], ctx.oak, 8); mesh(art, new THREE.PlaneGeometry(1830, 860), m, [0, 0, 20]);
    } else if (['secondary', 'college', 'university'].includes(spec.kind)) {
        const research = cabinet('resource-shelf', [-300, 0, bz + 340], 1550, 1050, true); const k = detailKit(); books(k, -620, 1050, 0, 18); k.build(research, dress);
        const pin = asset('research-gallery', 'Wall project gallery', [-w * .27, 1660, bz + 55], wall);
        const m = material('#ffffff', { map: institutionalMap((c, W, H) => drawInstitutionalBoard(c, W, H, spec, 2)), roughness: .9 }); box(pin, [1900, 900, 35], [0, 0, 0], ctx.oak, 6); mesh(pin, new THREE.PlaneGeometry(1830, 830), m, [0, 0, 20]);
    } else if (spec.kind === 'operations' || spec.kind === 'police') {
        const briefing = table('briefing-table', 'Team briefing table', [0, 0, front - 1600], 1550, 700, 740);
        for(const [n,x] of [-450,450].entries()) chair(`briefing-chair-${n}`,[x,0,front-950],450);
        const k = detailKit(); notebook(k, -470, 740, 0, '#98aaa0'); notebook(k, 440, 740, 0, '#b59e7c');
        k.box([420, 4, 280], [0, 742, 0], '#d5ded2'); for (let n = 0; n < 6; n++) k.box([300 - n * 30, 2, 5], [-20, 745, -85 + n * 30], '#819b99'); k.build(briefing, dress);
    } else if (spec.kind === 'lab') {
        const station=asset('wash-station','Laboratory wash station',[w/2-420,0,bz+d*.60]);station.rotation.y=-Math.PI/2;
        const k=detailKit();k.box([1250,850,600],[0,425,0],'#b7c9c3');k.box([1320,45,670],[0,872.5,0],'#344f55');
        k.box([420,12,340],[-260,899,0],'#98afb0');k.box([320,10,240],[-260,907,0],'#4a6972');
        k.cyl(16,16,200,[-260,1000,-240],'#a8b9b7');k.box([130,28,28],[-215,1100,-240],'#a8b9b7');
        for(const x of [-425,0,425]){k.box([390,730,20],[x,450,312],'#dee6dc');k.box([90,14,30],[x,730,335],'#7c9395');}k.build(station,dress);
    } else if (spec.kind === 'it') {
        // Keep the entry clear in the smallest layout; the back-wall bay has
        // room beside the racks without covering the teaching display.
        const tool=asset('diagnostic-wall','Wall service tools',[-w/2+1300,1850,bz+55],wall);
        const k=detailKit();k.box([1300,800,30],[0,0,0],'#687d81');
        for(let row=0;row<5;row++)for(let col=0;col<10;col++)k.cyl(4,4,8,[-570+col*125,-300+row*145,20],'#2c454c');
        for(let n=0;n<6;n++){k.box([22,190,24],[-480+n*180,45,40],n%2?'#c8a573':'#94b6b1');k.box([45,55,28],[-480+n*180,-70,40],'#344b53');}k.build(tool,dress);
    } else if (spec.kind === 'hospital') {
        const services = asset('care-services', 'Wall bedside services', [0, 1500, bz + 50], wall); const k = detailKit(); k.box([1600, 220, 60], [0, 0, 0], '#c5d2cd');
        for (let n = 0; n < 6; n++) { k.cyl(22, 22, 10, [-650 + n * 240, 0, 36], n % 2 ? '#c1ab78' : '#7ca19c'); k.box([65, 65, 10], [-650 + n * 240, 0, 38], '#e4e8dc'); } k.build(services, dress);
    } else if (spec.kind === 'government') {
        const welcome = asset('welcome-bench', 'Visitor bench', [-100, 0, front - 650]); const k = detailKit(); k.box([1550, 100, 510], [0, 440, 0], spec.accent); k.box([1550, 320, 75], [0, 640, 220], '#768e83'); for (const x of [-650, 650]) k.box([50, 400, 390], [x, 200, 0], '#9e8b71'); k.build(welcome, dress);
    }
    root.userData.detailLevel = 'institutional-atmosphere-v3';
    return finishInstitutionalAtmosphere(room, root, layout, spec, h, ctx, dress);

}

// Daypart dressing stays on its actual support: editing a table carries its
// lamp, stationery and project pieces with it. No new blockers in circulation.
function finishInstitutionalAtmosphere(room, root, layout, spec, h, ctx, dress) {
    const { asset, wall, left, label } = ctx, { mesh, box, rod, material } = h;
    const { width: w, depth: d, back: bz } = layout;
    const phases = Object.keys(spec.modes), variants = [], lamps = [];
    const clinical = ['hospital', 'lab'].includes(spec.kind), young = ['early', 'primary'].includes(spec.kind);
    const byId = id => { let found; root.traverse(g => { if (g.userData.propId === id) found = g; }); return found; };
    // Large framed illustrations break up the solid shell. This is the solid
    // wall bay beyond the daylight opening, never a panel over the window.
    const rightGallery = !young && !['lab','it'].includes(spec.kind);
    const gallery = asset('identity-gallery', clinical ? 'Wall calming landscape / science gallery' : 'Wall community and project gallery',
        [rightGallery ? w / 2 - 45 : -w / 2 + 45, 1650, bz + d * (rightGallery ? spec.category === 'Educational' ? .405 : .48 : .87)], rightGallery ? ctx.right : left);
    gallery.rotation.y = rightGallery ? -Math.PI / 2 : Math.PI / 2;
    const artWidth = Math.min(1350, d * (rightGallery ? .12 : .17));
    box(gallery, [artWidth + 65, 965, 35], [0, 0, 0], ctx.oak, 6);
    const art = institutionalMap((c, W, H) => {
        c.fillStyle = clinical ? '#e4ede5' : '#ede7d6'; c.fillRect(0, 0, W, H);
        const palette = [spec.accent, '#91b4a5', '#dab77d', '#9aafbe', '#c79481'];
        if (young || spec.kind === 'hospital' || spec.kind === 'government') {
            // Child-made garden shapes / calm landscape, with layered depth.
            c.fillStyle = '#e7d6a4'; c.beginPath(); c.arc(W * .76, H * .26, 42, 0, Math.PI * 2); c.fill();
            for (let n = 0; n < 3; n++) {
                c.fillStyle = palette[n]; c.beginPath(); c.moveTo(0, H);
                for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (.54 + n * .12) + Math.sin(x / W * 7 + n * 2) * H * .12);
                c.lineTo(W, H); c.fill();
            }
            for (let n = 0; n < (young ? 7 : 4); n++) {
                const x = 70 + n * W / (young ? 8 : 5), y = H * .58 + n % 2 * 40;
                c.fillStyle = '#547367'; c.fillRect(x - 3, y, 6, 85);
                c.fillStyle = palette[(n + 1) % 5]; c.beginPath(); c.ellipse(x, y, 24, 44, n * .3, 0, Math.PI * 2); c.fill();
            }
        } else {
            // Maps, molecular structures and research diagrams have a distinct
            // visual language, without real security or clinical information.
            c.strokeStyle = '#b8c8c2'; c.lineWidth = 1;
            for (let x = 20; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
            for (let y = 20; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            const nodes = Array.from({length: 9}, (_, n) => [W * (.12 + n % 3 * .36), H * (.2 + Math.floor(n / 3) * .3)]);
            c.strokeStyle = spec.accent; c.lineWidth = 5;
            nodes.forEach(([x,y], n) => {
                if (n) { c.beginPath(); c.moveTo(...nodes[Math.floor((n - 1) / 2)]); c.lineTo(x,y); c.stroke(); }
                c.fillStyle = palette[n % 5];
                if (['operations','police','secondary'].includes(spec.kind)) c.fillRect(x - 30, y - 23, 60, 46);
                else { c.beginPath(); c.arc(x,y,20 + n % 3 * 7,0,Math.PI * 2); c.fill(); }
            });
        }
    }, 768, 448);
    mesh(gallery, new THREE.PlaneGeometry(artWidth, 900), material('#ffffff', {map: art, roughness: .85}), [0,0,20]);

    // A wall-mounted organisation strip gives the youngest rooms child-scale
    // storage. Older stages show models, diagrams and presentation materials.
    if (young) {
        const pegs = asset('learning-pegs', 'Wall coats and learning bags', [-w * .31, 880, bz + 95], wall);
        const k = detailKit(); k.box([1500, 95, 40], [0, 0, 0], '#c6aa85');
        for (let n = 0; n < 5; n++) {
            const x = -600 + n * 300; k.cyl(18,18,80,[x, 10, 55],'#8a9795');
            k.box([155, 230, 90], [x, -180, 65], ['#bc8f6f','#839f91','#95aaba'][n % 3]);
            k.box([110, 75, 8], [x, -245, 114], '#d4c3a0');
        } k.build(pegs, dress);
    }
    if (clinical) {
        const hygiene = asset('hygiene-station', 'Wall hand hygiene and supplies', [w * .34, 1300, bz + 80], wall);
        const k = detailKit(); k.box([280, 390, 65], [0,0,0], '#e4ebe5'); k.box([160,150,90],[0,-35,70],'#bacfc9');
        k.box([110,22,30],[0,-118,125],'#708e92');
        for (let n=0;n<2;n++) { k.box([180,105,105],[290,70-n*140,35],'#a9c0bd'); k.box([120,30,10],[290,70-n*140,94],'#f1f1e7'); }
        k.build(hygiene,dress);
    }
    const activity = byId('activity-table');
    if (activity) {
        const stand = detailKit(); stand.box([95, 130, 10], [-460, 805, -200], '#b7bba9'); stand.box([140, 12, 80], [-460,746,-200], '#657d7c');
        stand.build(activity,dress);
        // Five compact project setups read as daily activity, not clutter.
        for (let phase = 0; phase < 5; phase++) {
            const g = new THREE.Group(); g.name = spec.modes[phases[phase]].label + ' materials'; activity.add(g); variants.push({g,phase});
            const k = detailKit(), y = 740;
            if (clinical) {
                k.box([230,14,180],[340,y+7,-70],'#acbfb8');
                for (let n=0;n<(phase===3?1:3);n++) k.box([48,70,48],[270+n*65,y+49,-70], '#e1e9e1');
            } else if (spec.kind === 'it') {
                k.box([180,40,120],[320,y+20,-60],'#344a57');
                for(let n=0;n<4;n++) k.box([18,8,16],[270+n*32,y+44,-55],'#baa472');
            } else if (young) {
                for(let n=0;n<(phase===3?2:6);n++) k.box([45,38,45],[260+n%3*58,y+19+Math.floor(n/3)*38,-100], ['#d2ad75','#82a69b','#8ba7b8'][n%3]);
            } else {
                notebook(k,340,y,-90,phase===3?'#6c8680':'#b79269');
                if (phase!==3) for(let n=0;n<3;n++) k.box([70,2,65],[240+n*85,y+1,70],['#ccb996','#9bb9ac','#a1b6c1'][n]);
            }
            k.build(g,dress);
        }
    }
    // Two local light sources maximum, independent from the three general
    // pools. Lamps are children of furniture so saved rearrangements carry them.
    const taskLamp = (support, height, x, z, clinicalLamp = false) => {
        if (!support) return;
        const frame = detailKit(); frame.cyl(68,75,14,[x,height+7,z],'#5e7479');
        frame.box([16,310,16],[x,height+165,z],'#819494'); frame.box([200,25,100],[x+65,height+325,z],'#627d80'); frame.build(support,dress);
        const luminous = material('#f7f0db',{emissive:'#ffe8c4',emissiveIntensity:.5,roughness:.4});
        box(support,[175,5,75],[x+65,height+310,z],luminous,3);
        const light = new THREE.PointLight('#ffe8c4',0,1800*root.scale.x,2); light.position.set(x+65,height+285,z); support.add(light);
        lamps.push({light,luminous,clinicalLamp});
    };
    taskLamp(activity,740,-450,-170);
    taskLamp(byId(spec.kind==='lab'?'lab-bench-0':spec.kind==='it'?'service-bench':'workstation-0'),spec.kind==='lab'||spec.kind==='it'?900:740,-560,-210,clinical);
    if (spec.kind === 'hospital') {
        const bed = byId('care-bed-0');
        if (bed) {
            const k=detailKit(); k.box([330,80,45],[-320,1000,-1060],'#c5d6cf'); k.build(bed,dress);
            const m=material('#fff1db',{emissive:'#ffdeb0',emissiveIntensity:.4}); box(bed,[280,12,30],[-320,955,-1060],m,2);
            const light=new THREE.PointLight('#ffe4bf',0,1700*root.scale.x,2); light.position.set(-320,930,-870); bed.add(light); lamps.push({light,luminous:m,clinicalLamp:true});
        }
    }
    let previous;
    return (phase,gain) => {
        const i=Math.max(0,phases.indexOf(phase)), night=phase==='night';
        variants.forEach(v=>v.g.visible=v.phase===i);
        lamps.forEach(({light,luminous,clinicalLamp})=>{
            const strength=[.12,.18,.7,.48,.55][i]*(clinicalLamp&&night?.65:1);
            light.color.set(clinicalLamp&&spec.kind==='lab'?'#eaf3ed':'#ffe4bd');
            light.intensity=(root.scale.x*1000)**2*strength*gain;
            luminous.emissive.copy(light.color); luminous.emissiveIntensity=.2+strength*gain;
        });
        if(previous!==phase) {
            // Clock and planning display follow the selected time, not wall time.
            const clock=byId('wall-clock'); const face=clock?.children.find(m=>m.geometry?.type==='CircleGeometry')?.material.map;
            if(face) {
                const c=face.image.getContext('2d'),W=face.image.width,H=face.image.height;
                c.fillStyle='#e7e4d5';c.fillRect(0,0,W,H);c.fillStyle=c.strokeStyle='#365159';c.textAlign='center';c.textBaseline='middle';
                for(let n=1;n<=12;n++){const a=n*Math.PI/6-Math.PI/2;c.font='22px sans-serif';c.fillText(n,W/2+Math.cos(a)*W*.37,H/2+Math.sin(a)*H*.37);}
                const hours=[9,14,18,22,16][i];c.lineWidth=7;c.lineCap='round';
                for(const [angle,len] of [[hours%12*Math.PI/6-Math.PI/2,W*.24],[-Math.PI/2,W*.32]]){c.beginPath();c.moveTo(W/2,H/2);c.lineTo(W/2+Math.cos(angle)*len,H/2+Math.sin(angle)*len);c.stroke();}
                face.needsUpdate=true;
            }
            const board=byId('planning-board');const map=board?.children.find(m=>m.material?.map)?.material.map;
            if(map){const c=map.image.getContext('2d'),W=map.image.width,H=map.image.height;drawInstitutionalBoard(c,W,H,spec,i);c.fillStyle=['operations','it'].includes(spec.kind)?'#17323c':'#f1f0e7';c.fillRect(0,H-42,W,42);c.fillStyle=spec.accent;c.textAlign='left';c.font='600 18px sans-serif';c.fillText(spec.modes[phase].label.toUpperCase(),28,H-16,W-56);map.needsUpdate=true;}
            previous=phase;
        }
        root.userData.institutionalAtmosphere={phase,localLights:lamps.length,activityVariants:5,clockHour:[9,14,18,22,16][i],gallery:spec.kind};
    };
}
