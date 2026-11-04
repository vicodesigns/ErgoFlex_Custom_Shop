import * as THREE from 'three';
import { interiorCraftFinishes } from './interior-craft-detail.mjs?v=natural-finishes-20261104';
import { activityPageMaterial } from './room-activity-print.mjs?v=table-clearance-20261021';

const phases = ['morning', 'afternoon', 'evening', 'night', 'party'];
function canvasMap(draw, w = 512, h = 256) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    return map;
}
function detailKit(room, h) {
    const { material, box, mesh, rod } = h;
    const ink = material('#34423e', { roughness: .74 });
    const paper = material('#eee7d8', { roughness: .96 });
    const bronze = material('#9c805c', { metalness: .72, roughness: .4 });
    const ceramic = material('#d4c7b1', { roughness: .34 });
    const weave = canvasMap((c, w, h) => {
        c.fillStyle = '#e3dfd6'; c.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 4) for (let y = 0; y < h; y += 4) {
            c.fillStyle = (x + y) % 8 ? '#bab7af' : '#f6f1e7';
            c.fillRect(x, y, 3, 1); c.fillRect(x, y + 1, 1, 3);
        }
    }, 128, 128);
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(6, 6);
    const textile = color => {
        const m = material(color, { map: weave, roughness: .96 }); m.userData.roomSurface = 'fabric'; return m;
    };
    const reading = room.id === 'bedroom' ? material('#ffffff', { roughness: .94, map: canvasMap((c,w,h) => {
        c.fillStyle='#efe7d8';c.fillRect(0,0,w,h);c.fillStyle='#9aaf9d';c.fillRect(28,30,250,240);
        c.fillStyle='#e4c9a6';c.beginPath();c.arc(175,115,57,0,Math.PI*2);c.fill();
        c.fillStyle='#617c70';c.beginPath();c.moveTo(28,270);c.quadraticCurveTo(110,130,278,225);c.lineTo(278,270);c.fill();
        c.fillStyle='#42564a';c.font='22px Georgia';c.fillText('A quiet chapter',340,64);
        c.font='13px Georgia';['The room settles into evening.','A little light, an open page,','and time enough to linger.','','Beyond the window, the day','makes way for softer colours.','','Leave a ribbon at this page.','There is more for tomorrow.'].forEach((s,i)=>c.fillText(s,340,101+i*26));
        c.fillStyle='#9d8067';c.fillRect(310,20,2,h-40);c.font='12px sans-serif';c.fillText('18',28,h-20);c.fillText('19',w-45,h-20);
    },640,400) }) : null;
    const book = (parent, at, index, open = false, color = '#506d62', width = 210, print = null) => {
        const g = new THREE.Group(); parent.add(g); g.position.set(...at);
        const depth = 148, cover = material(color, { roughness: .9 });
        box(g, [width, 3, depth], [0, 1.5, 0], cover, 1);
        box(g, [width - 4, 14, depth - 4], [0, 10, 0], paper, 1);
        for (const y of [6, 9, 12, 15]) box(g, [width - 5, .4, .4], [0, y, depth / 2 - 1], ceramic);
        const mat = print || (open && reading) || activityPageMaterial(room.id, index, open ? null : color);
        const face = mesh(g, new THREE.PlaneGeometry(width, depth), mat, [0, 17.2, 0]);
        face.rotation.x = -Math.PI / 2; face.castShadow = false;
        if (open) box(g, [5, 1, 75], [30, 18, 36], bronze, .5);
        return g;
    };
    const pencil = (g, at, turn = 0) => {
        const p = new THREE.Group(); p.position.set(...at); p.rotation.y = turn; g.add(p);
        rod(p, [-68, 3, 0], [65, 3, 0], 2.8, bronze); rod(p, [65, 3, 0], [74, 3, 0], 1.2, ink);
    };
    const bowl = (g, at) => mesh(g, new THREE.LatheGeometry([[0,0],[30,0],[45,5],[65,28],[65,32],[60,32],[42,9],[0,9]].map(p => new THREE.Vector2(...p)), 28), ceramic, at);
    return { ink, paper, bronze, ceramic, weave, textile, book, pencil, bowl };
}

// A wall-mounted station leaves the sculpture walk and desk routes open.
// Contents are children of the editable ledge, so moving/deleting it carries them.
export function gallerySessionDetails(room, layout, h, group, oak, back) {
    const { box, mesh, rod, markSceneAsset, material } = h, k = detailKit(room, h);
    const x = -layout.width / 2 + (layout.tier ? 1700 : 1450), z = layout.back + 150;
    const width = layout.tier ? 1200 : 900;
    const ledge = group('curator-ledge', 'Oak curator ledge · catalogues and visitor guides', [x, 0, z], 0, back);
    box(ledge, [width, 36, 260], [0, 782, 0], oak, 6);
    box(ledge, [width - 40, 95, 18], [0, 724, -111], k.ink, 3);
    for (const sx of [-width * .36, width * .36]) {
        box(ledge, [16, 180, 16], [sx, 690, -112], k.bronze, 2);
        rod(ledge, [sx, 620, -110], [sx, 763, 95], 5, k.bronze);
    }
    const setting = new THREE.Group(); setting.name = 'Curator daily setting'; setting.position.y = 800; ledge.add(setting);
    markSceneAsset(setting, { key: `gallery:${layout.id}:fixture:curator-setting` });
    // A permanent brochure rack uses the outer 88 mm of the ledge. Even the
    // opening-night pencil bowl ends 15 mm before the rack's left edge.
    const brochures = new THREE.Group(); brochures.name = 'Collection guides in a bronze rack';
    brochures.position.set(width / 2 - 56, 800, -24); ledge.add(brochures);
    box(brochures, [88, 4, 140], [0, 2, 0], k.bronze, 2);
    box(brochures, [88, 104, 5], [0, 56, -66], k.bronze, 2);
    for (const x of [-42, 42]) box(brochures, [4, 36, 136], [x, 22, 0], k.bronze, 1);
    for (let i = 0; i < 3; i++) box(brochures, [70, 96, 2], [0, 52, -61 + i * 3], k.paper, 1);
    rod(brochures, [-42, 26, 58], [42, 26, 58], 2.5, k.bronze);
    const guide = canvasMap((c, w, h) => {
        c.fillStyle = '#ede6d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#506d62';
        c.fillRect(12, 14, w - 24, h * .43); c.fillStyle = '#d3b78b';
        c.beginPath(); c.arc(w / 2, h * .25, w * .2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#34483d'; c.font = '24px Georgia'; c.fillText('Forms in', 14, h * .64);
        c.fillText('Motion', 14, h * .75); c.font = '13px sans-serif'; c.fillText('COLLECTION GUIDE', 14, h * .9, w - 28);
    }, 192, 256);
    const guideFace = mesh(brochures, new THREE.PlaneGeometry(68, 92), material('#ffffff', { map: guide, roughness: .96 }), [0, 52, -53.8]);
    guideFace.castShadow = false;
    const variants = [], states = [
        ['BEFORE THE DOORS OPEN', 'Condition notes / check the hang'],
        ['LOOK A LITTLE LONGER', 'Collection guide / works on paper'],
        ['DRAW FROM THE COLLECTION', 'An unhurried hour of looking'],
        ['THE COLLECTION AT REST', 'Guides returned / lights lowered'],
        ['OPENING NIGHT', 'Meet, look, talk / leave a note']
    ];
    const cardMaps = states.map(([title, subtitle], i) => canvasMap((c, w, h) => {
        c.fillStyle = '#eee8dc'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#9a7753'; c.fillRect(28, 30, 5, h - 60);
        c.fillStyle = '#33483f'; c.font = '600 25px sans-serif'; c.fillText(title, 48, 68, w - 75);
        c.font = '20px Georgia'; c.fillText(subtitle, 48, 108, w - 75);
        c.font = '13px sans-serif'; c.fillStyle = '#777365'; c.fillText('FORMS IN MOTION / ' + String(i + 1).padStart(2, '0'), 48, 150);
    }, 768, 192));
    const cardMat = material('#ffffff', { map: cardMaps[0], roughness: .9 });
    const card = box(ledge, [width - 80, 190, 7], [0, 1150, -126], cardMat, 2);
    card.name = 'Gallery daily programme'; card.ownedTextures = cardMaps;
    const guestPrint=material('#ffffff',{roughness:.94,map:canvasMap((c,w,h)=>{
        c.fillStyle='#eee7d8';c.fillRect(0,0,w,h);c.fillStyle='#496859';c.font='28px Georgia';c.fillText('A note from your visit',28,55);
        c.font='13px sans-serif';c.fillText('FORMS IN MOTION / GUEST BOOK',28,84);
        c.strokeStyle='#b3af9b';for(let y=120;y<h-20;y+=36){c.beginPath();c.moveTo(28,y);c.lineTo(w-28,y);c.stroke();}
        c.strokeStyle='#8b7b62';c.beginPath();c.moveTo(w/2,105);c.lineTo(w/2,h-20);c.stroke();
        c.fillStyle='#597362';c.font='italic 18px Georgia';c.fillText('The light changes everything.',40,146);c.fillText('Wonderful forms and textures.',w/2+20,218);
    },640,400)});
    const invitation=material('#ffffff',{roughness:.95,map:canvasMap((c,w,h)=>{
        c.fillStyle='#eee7d8';c.fillRect(0,0,w,h);c.fillStyle='#5c7869';c.fillRect(20,20,w-40,160);
        c.fillStyle='#d2b18a';c.beginPath();c.arc(w/2,100,55,0,Math.PI*2);c.fill();c.fillStyle='#34473e';
        c.font='24px Georgia';c.fillText('Forms in Motion',22,220);c.font='13px sans-serif';c.fillText('OPENING NIGHT',22,255);c.fillText('PAINTING / SCULPTURE / DESIGN',22,283,210);
    },256,320)});
    for (const [i, phase] of phases.entries()) {
        const g = new THREE.Group(); g.name = states[i][0]; g.userData.gallerySession = phase; setting.add(g); variants.push(g);
        k.book(g, [-170, 0, 0], i, i !== 3, '#506d62', i === 3 ? 140 : 230, phase==='party'?guestPrint:null);
        if (phase === 'morning') {
            box(g, [160, 4, 100], [115, 2, 8], k.paper, 1);
            const colors = ['#ccb391', '#a4af9b', '#7c9693', '#af7861'];
            colors.forEach((color, j) => box(g, [32, .7, 35], [60 + j * 36, 4.4, -10], material(color), .5));
            k.pencil(g, [120, 0, 94], .12);
        } else if (phase === 'afternoon') {
            const audio = box(g, [58, 16, 118], [145, 8, 0], k.ink, 9); audio.name = 'Collection audio guide';
            box(g, [42, 1, 44], [145, 16.5, -19], k.paper, 2);
            for (const sx of [-12, 12]) mesh(g, new THREE.CylinderGeometry(4, 4, 1, 12), k.bronze, [145 + sx, 17, 27]);
            rod(g, [145, 6, 62], [182, 6, 90], 2, k.ink);
        } else if (phase === 'evening') {
            box(g, [150, 12, 96], [135, 6, 0], k.textile('#b29b7e'), 8);
            for (let j = 0; j < 3; j++) k.pencil(g, [135, 12, -20 + j * 19], .05);
        } else if (phase === 'night') {
            box(g, [190, 65, 160], [135, 32.5, 0], k.paper, 4);
            box(g, [198, 10, 166], [135, 70, 0], k.ink, 3);
            box(g, [70, 24, 1], [135, 40, 80.6], k.bronze, 1);
        } else {
            k.pencil(g, [-170, 18, 38], -.2);
            for (let j = 0; j < 4; j++) box(g, [110, 2, 150], [95 + j * 2, 1 + j * 2, 0], k.paper, 1).rotation.y = .1;
            const invite=mesh(g,new THREE.PlaneGeometry(110,150),invitation,[101,8.1,0]);invite.rotation.set(-Math.PI/2,0,.1);invite.castShadow=false;
            k.bowl(g, [270, 0, 12]);
            for (let j = 0; j < 3; j++) rod(g, [230, 16 + j * 4, 6 + j * 8], [310, 30 + j * 4, 6 + j * 8], 2.5, k.bronze);
        }
    }
    room.root.userData.gallerySessionDetail = { width, variants: 5 };
    return { update(phase) {
        const i = Math.max(0, phases.indexOf(phase));
        variants.forEach((g, n) => g.visible = i === n); card.material.map = cardMaps[i];
        room.root.userData.gallerySessionDetail.phase = phases[i];
    } };
}

// Detail at the foot of the bed stays on the existing editable bench.
export function bedroomSessionDetails(room, layout, h, bench) {
    const { box, mesh, material, markSceneAsset } = h, k = detailKit(room, h);
    const clay = k.textile('#b99581'), sage = k.textile('#849283');
    interiorCraftFinishes(room,{ceramic:[k.ceramic],linen:[clay,sage],metal:[k.bronze]});
    const setting = new THREE.Group(); setting.name = 'Bedroom daily setting'; setting.position.y = 490; bench.add(setting);
    markSceneAsset(setting, { key: `bedroom:${layout.id}:fixture:bedtime-setting` });
    const variants = [];
    // Slightly irregular linen folds, including a draped front edge, replace
    // rigid blocks. Vertices remain above the upholstered bench surface.
    function throwCloth(parent, drape, folded) {
        const g = new THREE.PlaneGeometry(390, drape ? 640 : 400, 24, 32), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = -p.getY(i) + (drape ? 120 : 0), edge = Math.max(0, z - 200);
            const turn = Math.min(Math.PI / 2, edge / 30);
            const drop = drape ? 30 * (1 - Math.cos(turn)) + Math.max(0, edge - 30 * Math.PI / 2) : 0;
            p.setXYZ(i, x, 5 + Math.sin(x * .035 + z * .009) * 2 + Math.sin(z * .03) * 1.3 - drop,
                drape && z > 200 ? 200 + 30 * Math.sin(turn) : z);
        }
        g.computeVertexNormals(); const fabric = folded ? sage : clay;
        fabric.side = THREE.DoubleSide;
        const cloth = mesh(parent, g, fabric, [320, folded ? 29 : 1, 0]); cloth.name = drape ? 'Draped linen throw' : 'Folded linen throw';
        if (folded) box(parent, [390, 24, 396], [320, 12, 0], clay, 9);
    }
    for (const [i, phase] of phases.entries()) {
        const g = new THREE.Group(); g.userData.bedroomSession = phase;
        g.name = ['Morning dressing', 'An afternoon chapter', 'Reading before bed', 'Ready for sleep', 'Slow weekend'][i];
        setting.add(g); variants.push(g);
        throwCloth(g, ['morning', 'evening', 'party'].includes(phase), ['afternoon', 'night'].includes(phase));
        k.book(g, [-335, 0, -18], i, ['afternoon', 'evening'].includes(phase), '#5d7568', 215);
        if (phase === 'morning') {
            box(g, [132, 55, 102], [-65, 27.5, 0], sage, 16).name = 'Canvas wash bag';
            box(g, [105, 2, 2], [-65, 55, 0], k.bronze, 1);
        } else if (phase === 'night') {
            box(g, [150, 18, 78], [-70, 9, 0], clay, 14).name = 'Soft sleep mask';
            const strap = mesh(g, new THREE.TorusGeometry(44, 2, 6, 24), sage, [-70, 4, 0]); strap.rotation.x = Math.PI / 2;
        } else if (phase === 'party') {
            k.bowl(g, [-55, 0, 0]);
            box(g, [48, 8, 32], [-55, 13, 0], k.bronze, 6).name = 'Personal jewellery tray';
        } else k.pencil(g, [-75, 0, 0], -.12);
    }
    room.root.userData.bedroomSessionDetail = { variants: 5, textile: ['oat', 'sage', 'ivory', 'walnut', 'graphite'][layout.tier] };
    const bedColors = ['#e1d3b9', '#b9c3b0', '#e6dfd1', '#b1b8a7', '#a1acaf'];
    return {
        decorate(object, placement) {
            if (!['bed', 'bed-2'].includes(placement.id)) return;
            const copies = new Map();
            object.traverse(o => {
                if (!o.isMesh) return;
                const clone = m => {
                    if (!/^Atelier bed (duvet|throw|pillows)$/.test(m.name)) return m;
                    if (!copies.has(m)) {
                        const own = m.clone(); own.roughness = .96; own.metalness = 0;
                        if (m.name.endsWith('duvet')) own.color.set(bedColors[layout.tier]);
                        if (m.name.endsWith('throw')) own.color.set(layout.tier % 2 ? '#aa846a' : '#789080');
                        own.userData.sharedTextures = true; own.userData.roomPaletteLocked = true;
                        copies.set(m, own); room.ownedMaterials.add(own);
                    }
                    return copies.get(m);
                };
                o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
            });
        },
        update(phase) {
            const i = Math.max(0, phases.indexOf(phase)); variants.forEach((g, n) => g.visible = i === n);
            room.root.userData.bedroomSessionDetail.phase = phases[i];
        }
    };
}
