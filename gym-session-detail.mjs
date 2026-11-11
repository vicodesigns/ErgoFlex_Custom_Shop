import * as THREE from 'three';
import { interiorCraftFinishes } from './interior-craft-detail.mjs?v=natural-finishes-20261104';
import { gymTheme } from './gym-theme.mjs?v=people-gym-20261110';

// Fictional session dressing, not a prescribed exercise programme.
export const GYM_SESSIONS = {
    morning: { title: 'MOBILITY', subtitle: 'A quiet start / space to move', timer: '08:00', status: 'READY', accent: '#aac68a', rows: ['01   Unroll the mat', '02   Mobility & balance', '03   Water / session notes'], footer: 'MORNING LIGHT / OPEN FLOOR', gear: 'mat, cork blocks & strap' },
    afternoon: { title: 'STRENGTH', subtitle: 'Focused practice / track the session', timer: '00:45', status: 'WORK', accent: '#b9d476', rows: ['01   Free-weight station', '02   Strength practice', '03   Log / re-rack / reset'], footer: 'DAYLIGHT / COACH STATION', gear: 'training rig & paired dumbbells' },
    evening: { title: 'RECOVERY', subtitle: 'Slow the room down', timer: '05:00', status: 'EASE', accent: '#a4c9bb', rows: ['01   Mat & foam roller', '02   Quiet recovery corner', '03   Notes / fresh towel'], footer: 'WARM LAMPS / SOFT ACCENTS', gear: 'mat, roller & recovery balls' },
    night: { title: 'RESET', subtitle: 'Ready for tomorrow', timer: '21:30', status: 'REST', accent: '#d2b896', rows: ['01   Gear returned to storage', '02   Clear the training floor', '03   Wipe down / recharge'], footer: 'CLOSED SESSION / CLEAR FLOOR', gear: 'equipment stowed' },
    party: { title: 'CIRCUIT', subtitle: 'A change of pace / shared energy', timer: '00:30', status: 'ROUND', accent: '#aecd81', rows: ['01   Agility / balance', '02   Free-weight station', '03   Hydrate / regroup'], footer: 'POWER SESSION / TRAINING LANES', gear: 'circuit cones, rig & free weights' }
};

export function migrateGymSavedFurniture(obj, saved, l) {
    if (!saved?.p || !saved.q || !saved.s) return saved;
    const left = -l.width / 2, front = l.back + l.depth;
    const old = {
        'kenney-furniture-bench-cushion-low': [left + 350, 0, front - 600, 90, 1000],
        'decor-plant2': [left + 240, 0, front - 1330, 0, 1000],
        basketball: [left + 330, 0, front - 190, 0, 1000],
        'recovery-wall': [left + 30, 900, front - 600, 90, 1],
        ...(l.tier === 0 ? {
            'hydration-station': [left+350,0,l.back+400,0,1],
            'hemp-protein': [left+220,960,l.back+400,0,1000],
            'water-bottle': [left+475,960,l.back+475,0,1000]
        } : {}),
        ...(l.tier === 2 ? { 'training-zone': [180, 0, front - 1200, 0, 1], 'gym-props-3': [180, 8, front - 1200, 0, 1000] } : {}),
        ...(l.tier === 3 ? { 'conditioning-shelf': [left + 250, 0, 2120, 0, 1], 'accessory-rail': [left, 1460, 2120, 90, 1] } : {})
    }[obj.userData.propId];
    if (!old) return saved;
    const [x, y, z, turn, scale] = old, a = turn * Math.PI / 360, q = saved.q;
    if (Math.abs(saved.p.x-x) > .1 || Math.abs(saved.p.y-y) > .1 || Math.abs(saved.p.z-z) > .1 ||
        Object.values(saved.s).some(v => Math.abs(v-scale) > .001) || Math.abs(q.x) > .00001 || Math.abs(q.z) > .00001 ||
        Math.abs(Math.abs(q.y*Math.sin(a)+q.w*Math.cos(a))-1) > .00001) return saved;
    const placement = {
        'recovery-wall': {at:[left+30,680,front-1400],turn:90},
        'hydration-station': {at:[l.hydration[0],0,l.hydration[1]],turn:0},
        'training-zone': {at:[l.training[0],0,l.training[1]],turn:0},
        'conditioning-shelf': {at:[l.width/2-250,0,2600],turn:0},
        'accessory-rail': {at:[l.width/2,1460,2600],turn:-90}
    }[obj.userData.propId] || l.props.find(p => p.id === obj.userData.propId);
    if (!placement) return saved;
    const b = (placement.turn || 0)*Math.PI/360;
    return {...saved,p:{x:placement.at[0],y:placement.at[1],z:placement.at[2]},q:{x:0,y:Math.sin(b),z:0,w:Math.cos(b)}};
}

export function gymProgramMaps(T = gymTheme()) {
    const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; return map; };
    const board = make(768, 720), timer = make(512, 176);
    const update = phase => {
        const s = GYM_SESSIONS[phase] || GYM_SESSIONS.morning, c = board.image.getContext('2d');
        const { board: B, timer: D } = T.sessions, accent = T.sessions.accents[GYM_SESSIONS[phase] ? phase : 'morning'];
        c.fillStyle = B.background; c.fillRect(0, 0, 768, 720);
        // Faint erased chalk marks leave evidence of previous use.
        for (let i = 0; i < 40; i++) { c.fillStyle = B.erased; c.fillRect(i * 137 % 700, 120 + i * 53 % 510, 130, 8); }
        c.fillStyle = accent; c.font = '600 22px sans-serif'; c.fillText('TODAY / YOUR DAILY MOMENTUM', 46, 61);
        c.fillStyle = B.title; c.font = 'bold 69px sans-serif'; c.fillText(s.title, 43, 143);
        c.fillStyle = B.subtitle; c.font = '25px sans-serif'; c.fillText(s.subtitle, 47, 192);
        c.fillStyle = accent; c.fillRect(46, 220, 676, 3);
        s.rows.forEach((line, i) => { c.fillStyle = B.rows; c.font = '31px sans-serif'; c.fillText(line, 50, 300 + i * 82); });
        c.strokeStyle = B.frame; c.lineWidth = 2; c.strokeRect(46, 540, 676, 114);
        c.fillStyle = accent; c.font = '600 22px sans-serif'; c.fillText(s.footer, 65, 582);
        c.fillStyle = B.note; c.font = '22px sans-serif'; c.fillText('WATER  /  TOWEL  /  ROOM TO MOVE', 65, 623); board.needsUpdate = true;
        const t = timer.image.getContext('2d'); t.fillStyle = D.background; t.fillRect(0, 0, 512, 176);
        t.fillStyle = D.ghost; t.font = 'bold 108px monospace'; t.fillText('88:88', 20, 126);
        t.fillStyle = accent; t.fillText(s.timer, 20, 126); t.font = 'bold 23px sans-serif'; t.fillText(s.status, 376, 76);
        t.fillStyle = D.status; t.font = '17px sans-serif'; t.fillText(phase === 'night' ? 'STANDBY' : 'SESSION', 376, 110); timer.needsUpdate = true;
        return s;
    };
    update('morning'); return { board, timer, update };
}

export function buildGymSessionDetail(room, layout, h, anchors, T = gymTheme()) {
    const { group, box, mesh, rod, material, label } = h;
    const { mat, weights, hydrate } = anchors, root = room.root;
    const S = T.sessions, SM = S.materials;
    const rubber = material(...SM.rubber), cork = material(...SM.cork);
    const linen = material(...SM.linen), trim = material(...SM.trim);
    const steel = material(...SM.steel), dark = material(...SM.dark);
    for (const [m, kind] of [[rubber, 'rubber'], [cork, 'wood'], [linen, 'fabric'], [steel, 'metal'], [dark, 'powder']]) m.userData.roomSurface = kind;
    const own = new THREE.Group(); own.name = 'Session equipment · follows the training bay'; mat.add(own);
    h.markSceneAsset(own, { key: `gym:${layout.id}:fixture:session-equipment` });
    const variants = [];
    const towel = (parent, at, width = 300, fabric = linen) => {
        const g = new THREE.Group(); g.position.set(...at); parent.add(g);
        box(g, [width, 22, 180], [0, 11, 0], fabric, 7);
        box(g, [width - 6, 18, 172], [3, 29, 0], fabric, 7);
        for (const x of [-width / 2 + 22, width / 2 - 22]) box(g, [3, .8, 163], [x, 38.4, 0], trim);
        return g;
    };
    const roller = (parent, at) => {
        const g = new THREE.Group(); g.position.set(...at); parent.add(g);
        const body = mesh(g, new THREE.CylinderGeometry(70, 70, 440, 24), rubber, [0, 70, 0]); body.rotation.z = Math.PI / 2;
        for (let x = -180; x <= 180; x += 40) { const ring = mesh(g, new THREE.TorusGeometry(70, 2, 5, 24), trim, [x, 70, 0]); ring.rotation.y = Math.PI / 2; }
        for (const x of [-221, 221]) { const end = mesh(g, new THREE.CylinderGeometry(28, 28, 2, 20), dark, [x, 70, 0]); end.rotation.z = Math.PI / 2; }
    };
    const dumbbell = (parent, at, turn = 0) => {
        const g = new THREE.Group(); g.position.set(...at); g.rotation.y = turn; parent.add(g);
        rod(g, [-145, 64, 0], [145, 64, 0], 13, steel);
        for (const x of [-110, 110]) { const head = mesh(g, new THREE.CylinderGeometry(64, 64, 66, 6), rubber, [x, 64, 0]); head.rotation.z = Math.PI / 2; }
        for (let x = -50; x <= 50; x += 8) { const grip = mesh(g, new THREE.TorusGeometry(13.3, .8, 4, 12), dark, [x, 64, 0]); grip.rotation.y = Math.PI / 2; }
    };
    for (const [phase, s] of Object.entries(GYM_SESSIONS)) {
        const g = new THREE.Group(); g.name = s.title + ' · ' + s.gear; g.userData.gymSession = phase; own.add(g); variants.push(g);
        if (phase === 'morning' || phase === 'evening') {
            box(g, [680, 6, 1780], [0, 11, -30], rubber, 12);
            for (const x of [-330, 330]) box(g, [2, .5, 1710], [x, 14.3, -30], trim);
            if (phase === 'morning') {
                for (const x of [-225, 225]) { box(g, [150, 90, 230], [x, 59, -610], cork, 8); box(g, [142, 2, 220], [x, 105, -610], trim, 1); }
                const loop = mesh(g, new THREE.TorusGeometry(62, 5, 7, 24), trim, [230, 20, 580]); loop.rotation.x = Math.PI / 2;
            } else {
                // The 2 mm raised ribs are the roller's actual contact points.
                roller(g, [0, 16, -580]);
                for (const x of [-220, 220]) mesh(g, new THREE.SphereGeometry(34, 16, 12), trim, [x, 48, 340]);
            }
            towel(g, [-125, 14, 710]);
        } else if (phase !== 'night') {
            dumbbell(g, [-420, 9, -785], .13); dumbbell(g, [420, 9, -785], -.12);
            if (phase === 'party') for (const x of [-550, 550]) for (const z of [-370, 220, 790]) {
                mesh(g, new THREE.ConeGeometry(45, 105, 18), trim, [x, 61, z]);
                box(g, [110, 9, 110], [x, 12.5, z], rubber, 12);
            }
        }
    }
    // Rack labels and end caps make the repeated free weights read as usable kit.
    for (let i = 0; i < 5; i++) label(weights, String(8 + i * 4).padStart(2, '0') + ' KG', [160, 44], [-470 + i * 235, 350, 155], ...S.rackLabel);
    const tray = group('gym-cleaning-tray', 'Wipe-down supplies on the hydration counter', [0, 960, 105], 0, hydrate);
    box(tray, [170, 8, 115], [0, 4, 0], dark, 8);
    // Spray bottle and cloth, sized to leave the existing bottle and journal clear.
    mesh(tray, new THREE.CylinderGeometry(25, 28, 120, 18), linen, [-44, 68, 0]);
    box(tray, [54, 22, 22], [-33, 139, 0], dark, 5); rod(tray, [-19, 139, 0], [-8, 120, 0], 4, dark);
    towel(tray, [38, 8, 0], 55).scale.set(.85, .4, .45);

    // A narrow ventilated cubby fits under the counter's central front bay.
    label(hydrate, 'WIPE / RETURN / RESET', [layout.tier ? 410 : 350, 35], [0, 130, 246], ...S.wipeLabel);
    const stored = group('gym-recovery-kit', 'Stored recovery kit', [layout.width / 2 - 250, 40, layout.back + layout.depth - 270]);
    // One folded towel on the existing roller plinth, clear of all three rollers.
    towel(stored, [0, 0, 160], 220);
    // A framed movement study fills the larger coach wall without floor clutter.
    if (layout.tier >= 2) {
        const poster = group('gym-movement-study', 'Movement study / room zones', [-layout.width / 2 + (layout.tier === 2 ? 850 : 1300), 1560, layout.back + 46]);
        if (layout.tier === 2) poster.scale.setScalar(.8);
        box(poster, [690, 1010, 30], [0, 0, 0], cork, 5);
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 768;
        const c = canvas.getContext('2d'); c.fillStyle = S.poster.paper; c.fillRect(0, 0, 512, 768);
        c.fillStyle = S.poster.ink; c.font = 'bold 44px sans-serif'; c.fillText('MOVE WELL', 42, 74); c.font = '18px sans-serif'; c.fillText('SPACE / RHYTHM / RECOVERY', 44, 111);
        for (let i = 0; i < 3; i++) {
            const y = 220 + i * 168; c.strokeStyle = S.poster.strokes[i]; c.lineWidth = 8; c.lineCap = 'round';
            c.beginPath(); c.arc(130, y - 25, 18, 0, 7); c.stroke();
            c.beginPath(); c.moveTo(130, y); c.lineTo(130, y + 42); c.lineTo(90, y + 85); c.moveTo(130, y + 42); c.lineTo(180, y + 78); c.moveTo(70, y + 15); c.lineTo(130, y + 7); c.lineTo(180, y + (i - 1) * 32); c.stroke();
            c.fillStyle = S.poster.ink; c.font = 'bold 25px sans-serif'; c.fillText(['MOBILITY', 'STRENGTH', 'RECOVERY'][i], 235, y + 18);
            c.font = '18px sans-serif'; c.fillText(['Start with space', 'Make it your session', 'Leave time to reset'][i], 235, y + 51);
        }
        const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
        box(poster, [654, 972, 3], [0, 0, 17], material('#ffffff', { map, roughness: .88 }));
    }
    const equipment = [], originalVisible = new WeakMap();
    room.decorateProp = (object, placement) => {
        if (placement.id === 'gym-props-3') { equipment.push(object); object.children.forEach(o => originalVisible.set(o, o.visible)); }
        if (placement.id === 'kenney-furniture-bench-cushion-low') {
            const dressing = new THREE.Group(); dressing.name = 'Recovery bench folded towel'; object.add(dressing);
            // Imported furniture arrives after the first surface-detail pass.
            // Its new towel needs an untextured material so the second pass
            // can assign physical fabric UVs at this smaller parent scale.
            const fabric = material(...SM.linen); fabric.userData.roomSurface = 'fabric';
            dressing.scale.setScalar(.001); towel(dressing, [-230, 400, 0], 250, fabric);
        }
        // Black & red recolours the imported kit by material name, on
        // instance-owned copies so the cached GLB materials stay untouched.
        const tint = T.props?.[placement.id], copies = new Map();
        const recolour = m => {
            if (!tint?.[m?.name]) return m;
            if (!copies.has(m)) {
                const own = m.clone(); own.color.set(tint[m.name]); if (m.emissiveMap) own.emissive.set(tint[m.name]);
                own.userData.sharedTextures = true; room.ownedMaterials.add(own); copies.set(m, own);
            }
            return copies.get(m);
        };
        if (tint) object.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(recolour) : recolour(o.material); });
        apply(current);
    };
    let current = 'morning';
    function apply(phase) {
        current = phase;
        variants.forEach(g => { g.visible = g.userData.gymSession === phase; });
        for (const o of equipment) for (const child of o.children) child.visible = originalVisible.get(child) && ['afternoon', 'party'].includes(phase);
        root.userData.gymSession = { phase, ...GYM_SESSIONS[phase], accent: S.accents[phase], floorClear: phase === 'night' };
    }
    interiorCraftFinishes(room,{linen:[linen],metal:[steel],rubber:[rubber]});
    apply(current); return { apply, equipment, variants };
}
