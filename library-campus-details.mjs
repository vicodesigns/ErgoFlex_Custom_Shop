import * as THREE from 'three';

// Humboldt-inspired activities. These are staging scenarios, not advertised
// opening hours or a measured reconstruction of the university's building.
export const LIBRARY_ROUTINES = {
    morning: { title: 'A FRESH CHAPTER', task: 'Return books · Plan your reading', zone: 'Window study', notes: ['Returns ready for reshelving', 'Course reading and field notes', 'Daylight at the window seats'], color: '#547e69' },
    afternoon: { title: 'FOLLOW THE QUESTION', task: 'Research · Map · Annotate', zone: 'Research & discovery', notes: ['Find books, articles and archives', 'Explore GIS and digital collections', 'Ask for help with your sources'], color: '#587c90' },
    evening: { title: 'READ BY LAMPLIGHT', task: 'Read · Reflect · Reference', zone: 'Reading room', notes: ['Warm pools of light at the tables', 'Open books and quiet annotation', 'Take a pause in the reading nook'], color: '#ad7757' },
    night: { title: 'ONE THING AT A TIME', task: 'Focus · Review · Reset', zone: 'Quiet study', notes: ['Task lights on, shared tables tidied', 'A reading list for the next session', 'Self-service catalog and scanning'], color: '#466476' },
    party: { title: 'IDEAS ARE BETTER SHARED', task: 'Compare · Discuss · Create', zone: 'Shared research', notes: ['Gather around the powered tables', 'Map evidence on the whiteboard', 'Share a source and a new question'], color: '#67825c' }
};

export function buildLibraryCampusDetails(room, layout, h) {
    const { material, mesh, box, group, baked, kit, canvasMap, dark, dress, catalog, infoMap } = h;
    const { width: w, depth: d, back, index } = layout, front = back + d;
    const variants = [], publications = [];
    infoMap.name = 'Library daily routine notice';
    const aluminium = material('#aeb8b6', { metalness: .82, roughness: .38 }); aluminium.userData.roomSurface = 'metal';
    // Loan materials are kept on the catalog cabinet, so edits move the
    // whole service together. Open shelves remain for actual books.
    const caddy = kit(); caddy.box([200, 10, 125], [350, 1021, 10], { color: '#48675c' });
    caddy.box([200, 75, 8], [350, 1063, -48], { color: '#48675c' });
    for (const x of [254, 446]) caddy.box([8, 75, 120], [x, 1063, 10], { color: '#48675c' });
    for (let i = 0; i < 4; i++) caddy.box([160, 7, 92], [350, 1030 + i * 8, 10], { color: ['#d1dbcb', '#ece4cc'][i % 2] });
    baked(catalog, caddy, dress);
    const caddyMap = canvasMap((c, W, H) => { c.fillStyle = '#f2eddf'; c.fillRect(0, 0, W, H); c.fillStyle = '#345347'; c.font = 'bold 29px sans-serif'; c.textAlign = 'center'; c.fillText('BORROW A MARKER', W / 2, 42); c.font = '22px sans-serif'; c.fillText('Whiteboards · Erasers · Earplugs', W / 2, 82); }, 512, 110);
    mesh(catalog, new THREE.PlaneGeometry(270, 58), material('#ffffff', { map: caddyMap, roughness: .9 }), [350, 1114, 12]).castShadow = false;
    // Visible disposal openings, liner rims and separate labels make the
    // bins read as equipment rather than featureless cubes.
    const station = group('reading-room-recycling', 'Paper recycling and waste station', [-w / 2 + (index >= 2 ? 4300 : 3100), 0, front - 330]);
    for (const [i, name] of ['PAPER', 'RECYCLING', 'WASTE'].entries()) {
        const bin = kit(), x = (i - 1) * 225;
        bin.box([204, 600, 260], [x, 300, 0]).box([214, 40, 270], [x, 620, 0]); baked(station, bin, dark);
        box(station, [150, 3, 180], [x, 641, 0], aluminium, 9);
        box(station, [120, 4, name === 'PAPER' ? 20 : 98], [x, 644, 0], material('#19292b'), 6);
        const map = canvasMap((c, W, H) => { c.fillStyle = ['#456b7c', '#4f7661', '#5d6261'][i]; c.fillRect(0, 0, W, H); c.fillStyle = '#f7f3e6'; c.font = 'bold 36px sans-serif'; c.textAlign = 'center'; c.fillText(name, W / 2, 65); }, 320, 100);
        mesh(station, new THREE.PlaneGeometry(175, 56), material('#ffffff', { map, roughness: .9 }), [x, 460, 131]).castShadow = false;
    }
    // Realistic material detail without hundreds of extra draw calls: pages,
    // tabs, pencils and spectacles are baked into each day's table kit.
    for (const [i, at] of layout.reading.entries()) {
        const table = room.assets().find(o => o.userData.propId === `reading-table-${i}`);
        for (const mode of Object.keys(LIBRARY_ROUTINES)) {
            const v = new THREE.Group(); v.name = `Study materials · ${mode}`; table.add(v); variants.push({ obj: v, mode });
            v.position.set(index ? -430 : -330, 740.6, 245);
            const k = kit(), quiet = mode === 'night', spread = mode === 'party';
            k.box([quiet ? 220 : 310, 5, 210], [0, 2.5, 0], { color: LIBRARY_ROUTINES[mode].color });
            k.box([quiet ? 208 : 298, 17, 198], [0, 13.5, 0], { color: '#e9e3d4' });
            for (const y of [7, 11, 15, 19]) k.box([quiet ? 206 : 296, .6, 198.5], [0, y, 0], { color: '#b9b6a6' });
            if (quiet) k.box([220, 3, 210], [0, 23.5, 0], { color: '#466476' });
            else {
                const map = canvasMap(() => {}, 640, 420), mat = material('#ffffff', { map, roughness: 1 }); publications.push({ map, mode });
                const page = mesh(v, new THREE.PlaneGeometry(295, 195), mat, [0, 22.3, 0]); page.rotation.x = -Math.PI / 2; page.castShadow = false;
                k.box([6, .9, 66], [93, 23, 75], { color: '#b26f50' });
            }
            k.cyl(3, 3, 164, [178, 3.5, 0], { rot: [Math.PI / 2, 0, .12], color: '#b68d4a' });
            if (spread) for (let n = 0; n < 3; n++) k.box([52, 1, 42], [-115 + n * 67, 24, 48], { color: ['#d9c16c', '#94b8b3', '#ce9680'][n], rot: [0, (n - 1) * .07, 0] });
            if (mode === 'evening' || quiet) {
                for (const x of [-30, 30]) k.add(new THREE.TorusGeometry(25, 1.8, 5, 20), [x, 27, 0], { rot: [Math.PI / 2, 0, 0], color: '#555c56' });
                k.box([12, 2, 2], [0, 27, 0], { color: '#555c56' });
                for (const x of [-53, 53]) k.box([2, 2, 87], [x, 27, -36], { color: '#555c56' });
            }
            baked(v, k, dress, false);
        }
        // USB-C ports, socket pairs and a discrete cable tray follow the table.
        const power = kit(); power.box([180, 38, 8], [400, 792, 64], { color: '#364447' });
        for (const x of [350, 395]) for (const dx of [-7, 7]) power.box([4, 10, 2], [x + dx, 793, 69], { color: '#d4d9d1' });
        power.box([15, 5, 2], [452, 793, 69], { color: '#d4d9d1' }); baked(table, power, dress, false);
        box(table, [900, 60, 100], [0, 600, 0], dark, 7);
    }
    // Authors Hall is a real Humboldt idea. The illustrated covers describe
    // fields of scholarship; they do not impersonate real book titles.
    const authorsMap = canvasMap((c, W, H) => {
        c.fillStyle = '#efe9dc'; c.fillRect(0, 0, W, H); c.fillStyle = '#31594b'; c.fillRect(0, 0, W, 132);
        c.fillStyle = '#faf4e4'; c.font = 'bold 54px sans-serif'; c.fillText('AUTHORS HALL', 45, 87);
        ['FIELD ECOLOGY', 'PUBLIC HISTORY', 'CREATIVE VOICES'].forEach((t, i) => {
            const x = 55 + i * 196; c.fillStyle = ['#47745b', '#668391', '#b27a5d'][i]; c.fillRect(x, 195, 156, 248);
            c.fillStyle = '#f0e5c8'; c.font = 'bold 17px sans-serif'; c.fillText(t.split(' ')[0], x + 14, 231); c.fillText(t.split(' ').slice(1).join(' '), x + 14, 259);
            c.strokeStyle = '#e7d6ae'; c.lineWidth = 2; for (let n = 0; n < 5; n++) { c.beginPath(); c.arc(x + 77, 343, 17 + n * 13, 0, Math.PI * 2); c.stroke(); }
        }); c.fillStyle = '#426254'; c.font = '25px sans-serif'; c.fillText('Scholarship from our campus community', 45, 515);
    }, 768, 576);
    const art = room.assets().find(o => o.userData.propId === 'print-0-rear');
    if (art) { const p = art.children.find(o => o.geometry?.type === 'PlaneGeometry'); if (p) { p.material.map?.dispose(); p.material.map = authorsMap; p.material.needsUpdate = true; } art.userData.sceneAssetName = 'Authors Hall · campus scholarship display'; }
    // A regional specimen poster beside the research station adds local
    // identity while leaving quiet window glass and aisle space clear.
    const board = room.assets().find(o => o.userData.propId === 'collaboration-whiteboard');
    if (board) {
        const marker = kit(); for (const [i, color] of ['#365248', '#587c90', '#9d5b49'].entries()) marker.cyl(5, 5, 120, [-480 + i * 44, 946, 46], { rot: [0, 0, Math.PI / 2], color });
        marker.box([105, 25, 44], [-260, 951, 45], { color: '#54665d' }); baked(board, marker, dress, false);
    }
    let last = null;
    return { setMode(mode) {
        if (last === mode) return; last = mode; const r = LIBRARY_ROUTINES[mode] || LIBRARY_ROUTINES.morning;
        variants.forEach(v => { v.obj.visible = v.mode === mode; });
        const c = infoMap.image.getContext('2d'), W = infoMap.image.width, H = infoMap.image.height;
        c.fillStyle = '#eee9db'; c.fillRect(0, 0, W, H); c.fillStyle = r.color; c.fillRect(0, 0, W, 150);
        c.fillStyle = '#fff9e7'; c.font = 'bold 28px sans-serif'; c.fillText('HUMBOLDT / LIBRARY', 28, 53); c.font = 'bold 23px sans-serif'; c.fillText(r.title, 28, 112);
        c.fillStyle = '#365347'; c.font = 'bold 24px sans-serif'; c.fillText(r.task, 28, 213);
        c.font = '20px sans-serif'; r.notes.forEach((line, i) => c.fillText(line, 28, 283 + i * 57));
        c.fillStyle = '#819182'; c.font = '17px sans-serif'; c.fillText('QUIET WINDOWS   /   SHARED IDEAS', 28, H - 30); infoMap.needsUpdate = true;
        for (const p of publications) {
            const pc = p.map.image.getContext('2d'); pc.fillStyle = '#f1ecdf'; pc.fillRect(0, 0, 640, 420);
            pc.fillStyle = LIBRARY_ROUTINES[p.mode].color; pc.font = 'bold 28px serif'; pc.fillText(p.mode === 'afternoon' ? 'NORTH COAST / FIELD RESEARCH' : p.mode === 'party' ? 'SHARED SOURCE / EVIDENCE MAP' : 'READING NOTES / A NEW CHAPTER', 24, 42);
            pc.strokeStyle = '#627c68'; pc.lineWidth = 3;
            if (p.mode === 'afternoon') for (let n = 0; n < 10; n++) { pc.beginPath(); pc.moveTo(34, 88 + n * 28); pc.bezierCurveTo(150, 40 + n * 29, 320, 170 + n * 20, 380, 105 + n * 25); pc.stroke(); }
            else { for (let n = 0; n < 13; n++) { pc.fillStyle = '#839084'; pc.fillRect(30, 86 + n * 22, 310 - n % 4 * 32, 3); } }
            pc.strokeStyle = '#cfc5b2'; pc.strokeRect(416, 76, 193, 305); pc.fillStyle = '#677e6b'; pc.font = '20px sans-serif'; pc.fillText('Observe', 439, 109); pc.fillText('Question', 439, 153); pc.fillText('Connect', 439, 197); p.map.needsUpdate = true;
        }
        room.root.userData.libraryCampus = { inspiration: 'Cal Poly Humboldt', routine: mode, focus: r.zone, carrels: layout.carrels.length, palette: index >= 2 ? 'oak / sage / mineral / clay' : 'oak / forest / brass', version: 1 };
    } };
}
