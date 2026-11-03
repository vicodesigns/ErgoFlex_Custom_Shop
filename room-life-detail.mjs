import * as THREE from 'three';
import { detailKit } from './institutional-detail.mjs';

// Small, recognisable traces of use, placed ON an existing notebook or coaster.
// No new floor objects, support guesses, editor IDs, or external assets.
export const LIFE_DETAILS = {
    home: 'keys', bedroom: 'bookmark', study: 'reading', library: 'reading',
    office: 'review', coworking: 'review', government: 'review',
    gaming: 'cards', lounge: 'cards', music: 'picks', creative: 'swatches',
    gallery: 'swatches', kitchen: 'recipe', gym: 'timer', workshop: 'measure',
    scifi: 'circuit', mobileit: 'circuit', occmedialab: 'media',
    security: 'handover', police: 'handover', hospital: 'handover',
    laboratory: 'measure', kindergarten: 'colour', elementary: 'colour',
    middleschool: 'circuit', highschool: 'measure', college: 'review',
    university: 'reading'
};

export function enrichActivityKit(life, kit, phase) {
    const kind = LIFE_DETAILS[life.room.id];
    if (!kind) return;
    const books = [], cups = [];
    kit.traverse(o => {
        if (o.userData.activityBook) books.push(o);
        if (o.userData.activityCup) cups.push(o);
    });
    const material = life.detailMaterial ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
    const metal = life.detailMetal ||= new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .75, roughness: .31 });
    for (const [i, book] of books.entries()) {
        const b = book.userData.activityBook, k = detailKit(), hardware = detailKit();
        const g = new THREE.Group(); g.name = 'Personal work details'; book.add(g);
        // Each child stays inside the notebook footprint, even in compact rooms.
        // Parent night notebooks may be replaced by a supplied model later.
        const y = b.open ? 18 : 22, x = b.open ? 67 : 24, z = 16;
        if (phase === 3) {
            // A ribbon and elastic binding read as packed away, not active work.
            k.box([4, .5, 104], [24, y + .25, 0], '#596760');
        } else if (kind === 'keys') {
            hardware.add(new THREE.TorusGeometry(10, 1.3, 6, 20), [x, y + 2, z], '#acb5b5', [1, 1, 1], [Math.PI / 2, 0, 0]);
            hardware.box([5, 2, 27], [x + 5, y + 2, z + 20], '#b5baba', [0, -.3, 0]);
            hardware.box([5, 2, 6], [x + 9, y + 2, z + 28], '#b5baba');
            k.box([19, 4, 24], [x - 6, y + 3, z - 20], '#6d7760', [0, .2, 0]);
        } else if (['reading', 'bookmark', 'review', 'handover', 'recipe'].includes(kind)) {
            const colors = ['#e1bf74', '#87a7a0', '#ce967e'];
            for (let n = 0; n < (kind === 'review' ? 3 : 1); n++) {
                k.box([20, .6, 28], [x - n * 6, y + .4 + n * .7, z - n * 9], colors[n], [0, -.08 * n, 0]);
                for (let line = 0; line < 3; line++) k.box([12 - line * 2, .1, .55], [x - n * 6, y + .78 + n * .7, z - n * 9 - 7 + line * 4], '#53635e');
            }
            if (b.open) {
                k.box([3, 3, 80], [-73, y + 2, 0], '#536d72', [0, .12, 0]);
                hardware.box([3.5, 3.5, 9], [-77.2, y + 2, -35], '#b9c0bc', [0, .12, 0]);
            }
        } else if (['swatches', 'colour'].includes(kind)) {
            for (let n = 0; n < 4; n++) {
                k.box([22, .6, 52], [x - n * 8, y + 1 + n * .65, z - n * 3], ['#d6b267', '#a97359', '#6c8e85', '#7686a1'][n], [0, n * .17, 0]);
            }
            hardware.cyl(2, 2, 2, [x - 11, y + 5, z + 23], '#bbbba5');
        } else if (['circuit', 'media'].includes(kind)) {
            k.box([26, 2, 36], [x, y + 1.5, z], kind === 'media' ? '#313c46' : '#406d5c');
            k.box([11, 2, 14], [x, y + 3.5, z], '#252f32');
            for (let n = 0; n < 6; n++) hardware.box([2, .4, 6], [x - 10 + n * 4, y + 2.8, z + 14], '#b6a66b');
            for (let n = 0; n < 3; n++) k.box([3, 2, 4], [x - 9, y + 3.5, z - 9 + n * 7], '#b8b9ac');
        } else if (kind === 'measure') {
            hardware.box([18, 1, 82], [x, y + 1, z], '#c2c8c5', [0, .05, 0]);
            for (let n = 0; n < 13; n++) k.box([n % 5 ? 5 : 9, .2, .6], [x + 3, y + 1.65, z - 34 + n * 5.5], '#3f5052');
            hardware.box([30, 2, 6], [x - 6, y + 2.5, z - 23], '#a5afad');
        } else if (kind === 'picks') {
            for (let n = 0; n < 3; n++) k.add(new THREE.CylinderGeometry(10, 10, 1.5, 3), [x - n * 14, y + 1, z + n * 7], ['#b77c53', '#c8ba97', '#788b90'][n], [1, 1, 1.2], [0, .3 + n * .5, 0]);
        } else if (kind === 'cards') {
            for (let n = 0; n < (phase === 4 ? 3 : 1); n++) {
                k.box([28, .8, 42], [x - n * 10, y + .7 + n, z - n * 4], '#dedacb', [0, n * .1, 0]);
                k.ball(3, [x - n * 10, y + 1.2 + n, z - n * 4], '#9f6a5b', [1, .1, 1]);
            }
        } else if (kind === 'timer') {
            k.cyl(20, 20, 6, [x, y + 4, z], '#374b50');
            k.cyl(17, 17, .6, [x, y + 7.4, z], '#d4dcca');
            k.box([1, .4, 14], [x, y + 8, z - 5], '#3b4f52', [0, .35, 0]);
            hardware.cyl(3, 3, 4, [x, y + 3, z - 23], '#bbc6c0');
        }
        k.build(g, material); hardware.build(g, metal);
        g.userData.lifeDetail = { kind, phase, owner: 'book', index: i };
    }
    for (const cup of cups) {
        const k = detailKit();
        // A glazed lip and small meniscus catch real light; drink levels differ.
        k.add(new THREE.TorusGeometry(30, .7, 6, 32), [0, 58.2, 0], '#e4dfcf', [1, 1, 1], [Math.PI / 2, 0, 0]);
        // Tiny coffee bubbles only by day, inside the existing liquid surface.
        if (phase < 2) for (let n = 0; n < 9; n++) {
            const a = n * .22 + 1.3;
            k.ball(.8 + n % 3 * .3, [Math.cos(a) * 25, 52.7, Math.sin(a) * 25], '#98744f', [1, .35, 1]);
        }
        k.build(cup, material);
    }
    const remotes = kit.children.filter(o => o.userData.activityRemote);
    for (const remote of remotes) {
        const k = detailKit(), g = new THREE.Group(); g.name = 'Controller controls'; remote.add(g);
        for (const x of [-22, 22]) {
            k.cyl(9, 9, 2, [x, 9.5, 2], '#191f26');
            k.cyl(6, 7, 3, [x, 12, 2], '#6c7685');
        }
        for (const [x, z, c] of [[26, -14, '#98b6a6'], [33, -7, '#b18b88'], [19, -7, '#a7a2c2']]) k.cyl(2.6, 2.6, 1.8, [x, 10, z], c);
        k.box([10, 1, 3], [-28, 10, -13], '#88929b'); k.box([3, 1, 10], [-28, 10, -13], '#88929b');
        k.build(g, material);
    }
    if (life.room.id === 'creative' && phase < 3) {
        const k = detailKit(), g = new THREE.Group(); g.name = 'Paint in progress'; kit.add(g);
        k.box([32, 6, 12], [0, 11, 12], '#c3c6bb', [0, -.14, 0]);
        k.box([10, 6.4, 12.4], [-3, 11, 12], '#a66d50', [0, -.14, 0]);
        k.box([5, 5, 8], [18, 11, 14.5], '#3b4545', [0, -.14, 0]);
        for (let n = 0; n < 5; n++) k.box([.6, .3, 8], [-12 + n * 1.2, 14.2, 10], '#858e89', [0, -.14, 0]);
        k.build(g, material);
    }
    kit.userData.lifeDetail = { kind, phase, books: books.length, cups: cups.length, remotes: remotes.length };
}
