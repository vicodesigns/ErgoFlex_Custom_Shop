import * as THREE from 'three';
import { activityPageMaterial } from './room-activity-print.mjs?v=environment-detail-scale-20261013';
import { ROOM_DETAIL_PALETTES } from './room-finish-palettes.mjs?v=environment-detail-scale-20261013';
import { INSTITUTIONAL_ROOMS, institutionalModule } from './institutional-scenes.mjs?v=occ-media-lab-20261013';

export const DAY_PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const TIERS = ['apartment', 'house', 'spacious', 'premium', 'executive'];
// Authored activities, rather than the same dinner party in every environment.
export const ROOM_STORIES = {
    ...Object.fromEntries(Object.entries(INSTITUTIONAL_ROOMS).map(([id, p]) => [id, p.stories])),
    home: ['Coffee & daily planning', 'Notes open, chair at the desk', 'Reading nook & tea', 'Quiet work, lounge put away', 'Drinks & conversation'],
    gaming: ['Coffee & a fresh start', 'Practice session & strategy notes', 'Console night with friends', 'Solo play, controller charging', 'Tournament & shared snacks'],
    music: ['Lyrics & vocal warm-up', 'Recording session & score study', 'Listening lounge & tea', 'Headphone mixing, stage cleared', 'Live set & guest seating'],
    creative: ['Colour studies & a fresh palette', 'Brushes out, work in progress', 'Sketchbook & tea break', 'Materials capped, quiet drawing', 'Open studio & portfolio viewing'],
    study: ['Reading list & morning coffee', 'Open research & annotations', 'Tea & a chapter by lamplight', 'One book, quiet late study', 'Books & conversation'],
    office: ['Coffee & project planning', 'Reviews & working notes', 'Team debrief & relaxed seating', 'Focused work, shared areas tidied', 'Team social & refreshments'],
    gym: ['Mobility mat & fresh towels', 'Circuit gear & workout log', 'Stretching & recovery', 'Gear parked, recovery time', 'Power circuit & hydration'],
    kitchen: ['Breakfast & fresh fruit', 'Recipe notes & lunch preparation', 'Two-person supper', 'Table cleared, a cup of tea', 'Dinner party & serving dishes'],
    lounge: ['Coffee & a magazine', 'Reading & a relaxed seat', 'Movie night & shared snacks', 'Quiet sofa corner, table tidied', 'Games, drinks & conversation'],
    workshop: ['Plans & measurement check', 'Tools out, prototype in progress', 'Assembly notes & cleanup', 'Tools stowed, design review', 'Project showcase & maker meetup'],
    bedroom: ['Coffee & the morning journal', 'Window reading & light work', 'Tea & wind-down reading', 'Book closed, lights softened', 'Weekend breakfast & unhurried reading'],
    gallery: ['Curator notes & exhibition walk', 'Catalogue study & sketching', 'Salon conversation & tea', 'Collections quiet, reading corner', 'Opening night & shared catalogues'],
    scifi: ['Mission briefing & equipment check', 'Research samples & analysis', 'Navigation watch & mission notes', 'Robot parked, quiet watch', 'Transit briefing & crew gathering'],
    coworking: ['Coffee & shared planning', 'Collaboration & working notes', 'Community conversation', 'Quiet focus, meeting area tidied', 'Community meetup & refreshments'],
    library: ['Book returns & a fresh reading list', 'North Coast research & shared annotations', 'Reading by lamplight & reflection', 'Quiet focus & a tidy table', 'Shared evidence & whiteboard discussion']
};

const plain = matrix => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    matrix.decompose(p, q, s); return { p: { x: p.x, y: p.y, z: p.z }, q: { x: q.x, y: q.y, z: q.z, w: q.w }, s: { x: s.x, y: s.y, z: s.z } };
};
const matrixOf = t => new THREE.Matrix4().compose(new THREE.Vector3(t.p.x, t.p.y, t.p.z), new THREE.Quaternion(t.q.x, t.q.y, t.q.z, t.q.w), new THREE.Vector3(t.s.x, t.s.y, t.s.z));
// Saved Studio transforms describe the user's base arrangement. Daily staging
// is reversible, so saving at night cannot freeze a chair in its night pose.
export function roomLifeBaseTransform(obj, transform) {
    const delta = obj.userData?.dailyDelta;
    return delta && transform ? plain(new THREE.Matrix4().fromArray(delta).invert().multiply(matrixOf(transform))) : transform;
}
export function roomLifeDisplayTransform(obj, transform) {
    const delta = obj.userData?.dailyDelta;
    return delta && transform ? plain(new THREE.Matrix4().fromArray(delta).multiply(matrixOf(transform))) : transform;
}

function activityAnchor(id, l) {
    // Institutional groups may move their kit with stageAnchor(layout) in their module.
    if (INSTITUTIONAL_ROOMS[id]) return institutionalModule(id)?.stageAnchor?.(l) || { at: l.activity, y: 740, offset: [0, 0], support: 'activity-table', small: true };
    const front = l.back + l.depth, tier = TIERS.indexOf(l.id), w = l.width;
    // A named real support and its contact height, in millimetres. The small
    // offset leaves room for the existing books, cups, vases and equipment.
    switch (id) {
        case 'home': return { at: [...(l.table || (tier ? [-475, 2100] : [80, 1870]))], y: 450, offset: [110, -60], support: 'Reading side table', small: true };
        case 'gaming': return tier ? { at: [-w / 2 + 1370, l.loungeZ], y: 391.2, offset: [0, 0], support: 'coffee-table' } : { at: [800, l.loungeZ + 100], y: 460, offset: [-170, 0], support: 'kenney-furniture-lounge-sofa-ottoman' };
        case 'music': return l.large ? { at: [-400, front - 1600], y: 391.2, offset: [180, 120], support: 'coffee-table' } : { at: l.rack, y: 800, offset: [-230, 180], small: true };
        case 'creative': return l.large ? { at: l.table, y: 910, offset: [120, -100], support: 'artist-worktable' } : { at: l.cabinet, y: 900, offset: [0, 445], small: true };
        case 'study': return { at: l.table, y: 700, offset: [80, -90], support: 'coffee-table-2', small: true };
        case 'office': return tier ? { at: [-w / 2 + 1650, front - 1500], y: 391.2, offset: [0, 0], support: 'coffee-table' } : { at: [0, front - 420], y: 700, offset: [100, -65], support: 'coffee-table-2', small: true };
        case 'gym': return { at: l.hydration, y: 960, offset: [0, -120], small: true };
        case 'kitchen': return { at: l.dining, y: l.tableHeight, offset: tier ? [-l.tableWidth / 2 + 220, 0] : [-140, -190], support: 'dining-table', small: !tier };
        case 'lounge': return { at: [l.tableX, l.loungeZ], y: 391.2, offset: [0, 0], support: 'coffee-table' };
        case 'workshop': return { at: [0, l.back + 350], y: 900, offset: [0, 0] };
        case 'bedroom': return tier ? { at: [l.reading[0] + 850, front - 480], y: 700, offset: [115, 40], support: 'coffee-table-2', small: true } : { at: l.bedside[0], y: 550, offset: [-90, 80], small: true };
        case 'gallery': return tier ? { at: [w / 2 - 1600, front - 650], y: 700, offset: [0, 0], support: 'coffee-table-2', small: true } : { at: [250, l.back + 3000], y: 505, offset: [-360, 0], support: 'gallery-bench', small: true };
        case 'scifi': return { at: l.service, y: 900, offset: [70, 0], small: true };
        case 'coworking': return { at: l.meeting, y: 740, offset: tier ? [-650, 270] : [0, 0], support: 'meeting-table' };
        case 'library': return { at: l.reading[0], y: 740, offset: [tier ? 150 : 0, -240], support: 'reading-table-0' };
    }
}

export class RoomLife {
    constructor(room, helpers) {
        this.room = room; this.h = helpers; this.entries = []; this.mode = null; this.bound = false;
        this.tier = TIERS.indexOf(room.roomLayout.id); this.factor = [.6, .8, 1, 1.2, 1.4][this.tier];
        this.anchor = activityAnchor(room.id, room.roomLayout);
        this.kits = []; this.printedPages = new Map(); this.buildActivities();
    }
    buildActivities() {
        const { room, anchor: a, h } = this, l = room.roomLayout;
        if (!a?.at?.every(Number.isFinite)) throw new Error(`Missing daily activity support: ${room.id}/${l.id}`);
        const group = new THREE.Group(); group.name = ROOM_STORIES[room.id][0].split(' & ')[0] + ' · daily activity';
        group.position.set(a.at[0] + a.offset[0], a.y + 1, a.at[1] + a.offset[1]); room.root.add(group);
        group.userData.propId = `${room.id}-daily-activity`; group.userData.sceneAssetName = 'Daily activity · ' + l.name;
        h.markSceneAsset(group, { key: `${room.id}:${l.id}:life:activity` }); this.activity = group;
        const mat = (c, kind, extra = {}) => { const m = h.material(c, extra); if (kind) m.userData.roomSurface = kind; return m; };
        const [textile, accent, paper, ceramic] = ROOM_DETAIL_PALETTES[room.id];
        this.mats = { paper: mat(paper, null, { roughness: .96 }), ink: mat('#34434a'), clay: mat(accent), linen: mat(textile, 'fabric'), wood: mat('#997653', 'wood'), cream: mat(ceramic, null, { roughness: .28 }), brass: mat('#ac9270', 'metal', { metalness: .8 }), green: mat(textile), liquid: mat('#442d1d', null, { roughness: .18 }), ferrule: mat('#b4bcc0', 'metal', { metalness: .9, roughness: .26 }) };
        room.root.userData.decorationFinish = { palette: [...ROOM_DETAIL_PALETTES[room.id]], phases: 5, version: 1 };
        for (let phase = 0; phase < DAY_PHASES.length; phase++) {
            const variant = new THREE.Group(); variant.name = ROOM_STORIES[room.id][phase]; group.add(variant); this.kits.push(variant);
            this.kitPhase = phase; this.makeKit(variant, phase, a.small);
        }
        // Larger settings gain a second lived-in spot, not oversized decor.
        if (this.tier >= 2 && ['library', 'coworking', 'office', 'kitchen'].includes(room.id)) {
            const extra = new THREE.Group(); extra.name = 'Shared daily materials'; room.root.add(extra);
            extra.position.copy(group.position); extra.position.x += room.id === 'kitchen' ? 380 : 420;
            h.markSceneAsset(extra, { key: `${room.id}:${l.id}:life:shared` }); this.shared = extra;
            this.book(extra, [-60, 0, 0], '#897760', false); this.cup(extra, [85, 0, 45], false);
        }
    }
    book(parent, at, color = '#61796c', open = false) {
        const { h, mats: m } = this, g = new THREE.Group(); g.position.set(...at); parent.add(g);
        g.userData.activityBook = { open, width: open ? 210 : 100, depth: 142, color };
        const cover = h.material(color, { roughness: .88 });
        h.box(g, [open ? 210 : 100, 5, 142], [0, 2.5, 0], cover, 2);
        h.box(g, [open ? 202 : 94, 12, 134], [0, 11, 0], m.paper, 1);
        // Fine page edges and a cloth spine sit inside the original book bounds.
        for (const height of [7, 10, 13, 16]) h.box(g, [open ? 200 : 92, .35, .5], [0, height, 67.15], m.linen);
        if (open) {
            h.box(g, [3, 14, 132], [0, 12, 0], cover, 1);
            const phase = this.kitPhase ?? 0;
            if (!this.printedPages.has(phase)) this.printedPages.set(phase, activityPageMaterial(this.room.id, phase));
            const page = h.mesh(g, new THREE.PlaneGeometry(198, 130), this.printedPages.get(phase), [0, 17.35, 0]);
            page.rotation.x = -Math.PI / 2; page.castShadow = false;
            page.userData.presentationOnly = true;
            // A bookmark adds depth while remaining inside the book footprint.
            h.box(g, [5, .8, 58], [24, 17.8, 36], m.clay);
        } else {
            h.box(g, [100, 4, 142], [0, 19, 0], cover, 2);
            const phase = this.kitPhase ?? 0, key = `${phase}:${color}`;
            if (!this.printedPages.has(key)) this.printedPages.set(key, activityPageMaterial(this.room.id, phase, color));
            const label = h.mesh(g, new THREE.PlaneGeometry(94, 136), this.printedPages.get(key), [0, 21.05, 0]);
            label.rotation.x = -Math.PI / 2; label.castShadow = false; label.userData.presentationOnly = true;
        }
        return g;
    }
    cup(parent, at, tea = true) {
        const { h, mats: m } = this, g = new THREE.Group(); g.position.set(...at); parent.add(g);
        g.userData.activityCup = true;
        h.mesh(g, new THREE.LatheGeometry([[0,2],[26,2],[28,5],[33,56],[32,59],[29,59],[27,8],[0,8]].map(([x,y])=>new THREE.Vector2(x,y)), 32), m.cream);
        h.mesh(g, new THREE.CylinderGeometry(28.3, 28.3, 1, 32), m.liquid, [0, 52, 0]);
        h.mesh(g, new THREE.CylinderGeometry(39, 39, 2, 32), m.wood, [0, 1, 0]);
        if (tea) {
            h.rod(g, [12, 53, 0], [33, 55, 8], .35, m.paper);
            h.rod(g, [33, 55, 8], [35, 38, 10], .35, m.paper);
            h.box(g, [8, 11, 1], [35, 33, 10], m.clay, 1);
        }
        const handle = h.mesh(g, new THREE.TorusGeometry(16, 4, 6, 12), m.cream, [36, 32, 0]); handle.rotation.y = Math.PI / 2;
        return g;
    }
    async decorate(library, current = () => true) {
        // New models are children of the existing activity assets. Their owner,
        // saved transforms, supports and per-time visibility stay the same.
        const ids = ['ergoflex-notebook'];
        const personal = ['home','office','coworking','library','study','bedroom','creative','music','gaming','lounge','occmedialab'].includes(this.room.id);
        if (personal) ids.push('ergoflex-glasses','ergoflex-thermal-cup');
        const pencilCup=!this.anchor.small && ['office','coworking','library','creative','workshop'].includes(this.room.id);
        if (pencilCup) ids.push('ergoflex-pencil-cup');
        const feature={occmedialab:'ergoflex-camera',scifi:'ergoflex-camera',gaming:'ergoflex-handheld-game',music:'ergoflex-earbuds',gym:'ergoflex-watch',office:'ergoflex-phone'}[this.room.id];
        if (feature) ids.push(feature);
        const loaded = new Map(await Promise.all(ids.map(async id => [id, await library.load(id).catch(()=>null)])));
        if (!current()) return;
        let count = 0;
        const model = (id, parent, at, width, depth) => {
            const source = loaded.get(id), entry = library.entry(id), g = source.clone(true);
            const fit = Math.min(1, width / entry.size[0], depth / entry.size[2]);
            g.name = entry.name + ' · daily detail'; g.userData.sharedProp = true;
            g.scale.setScalar(1000 * fit); g.position.copy(at); parent.add(g);
            g.traverse(o => {
                o.userData.sharedProp = true;
                if (!o.isMesh) return;
                if (id === 'ergoflex-notebook') {
                    o.material = [].concat(o.material).map(m => {
                        if (!/cover/i.test(m.name)) return m;
                        const own=m.clone(); own.color.set(ROOM_DETAIL_PALETTES[this.room.id][1]); own.userData.sharedTextures=true;
                        o.ownedMaterials ||= []; o.ownedMaterials.push(own); return own;
                    });
                    if (o.material.length===1) o.material=o.material[0];
                }
            });
            count++; return g;
        };
        for (const [phase, kit] of this.kits.entries()) {
            const books=[], cups=[];
            kit.traverse(o=>{ if(o.userData.activityBook)books.push(o); if(o.userData.activityCup)cups.push(o); });
            if (phase===3) for (const book of books) {
                if (!loaded.get('ergoflex-notebook')) continue;
                const b=book.userData.activityBook;
                model('ergoflex-notebook',book.parent,book.position,b.width,b.depth).rotation.copy(book.rotation);
                book.visible=false;
            }
            if (personal && phase===2 && books[0] && loaded.get('ergoflex-glasses')) {
                const book=books[0]; model('ergoflex-glasses',book,new THREE.Vector3(0,23,0),90,120).rotation.y=.24;
            }
            if (personal && phase===0 && cups[0] && loaded.get('ergoflex-thermal-cup')) {
                const cup=cups[0]; model('ergoflex-thermal-cup',cup.parent,cup.position,78,78); cup.visible=false;
            }
            if (pencilCup && phase===1 && loaded.get('ergoflex-pencil-cup')) model('ergoflex-pencil-cup',kit,new THREE.Vector3(175,0,108),93,123);
            if (feature && loaded.get(feature)) {
                if (this.room.id==='occmedialab' && phase===0 && books[0]) {
                    const book=books[0];model(feature,book.parent,book.position,100,142);book.visible=false;
                } else if (this.room.id==='scifi' && phase===1) {
                    model(feature,kit,new THREE.Vector3(),130,150);
                    kit.children.filter(o=>o.userData.activityTablet).forEach(o=>o.visible=false);
                } else if (this.room.id==='gaming' && phase===2) {
                    const remote=kit.children.find(o=>o.userData.activityRemote);
                    if(remote){model(feature,remote.parent,new THREE.Vector3(remote.position.x,4,remote.position.z),174,120);remote.visible=false;kit.children.filter(o=>o.userData.activityRemoteControl).forEach(o=>o.visible=false);}
                } else if (this.room.id==='music' && phase===3) model(feature,kit,new THREE.Vector3(0,23,0),60,60);
                else if(this.room.id==='gym' && phase===3) model(feature,kit,new THREE.Vector3(0,73,0),90,90);
                else if(this.room.id==='office' && phase===4 && books[0]) model(feature,books[0],new THREE.Vector3(0,23,0),78,140);
            }
        }
        this.room.root.userData.decorationFinish.suppliedActivityModels=count;
    }
    makeKit(g, phase, small) {
        const { h, mats: m, room } = this, id = room.id;
        const social = phase === 4, active = phase === 1, quiet = phase === 3;
        // Trays, notebooks and textiles have real contact heights. No giant
        // image planes or lights are added to the renderer for these details.
        const tray = !['creative', 'workshop', 'library', 'coworking', 'scifi'].includes(id);
        if (tray) h.box(g, [small ? 110 : 290, 4, small ? 105 : 195], [0, 2, 0], m.wood, 7);
        const y = tray ? 4 : 0;
        if (INSTITUTIONAL_ROOMS[id]) {
            const spec = INSTITUTIONAL_ROOMS[id];
            this.book(g, [0, y, 0], spec.accent, active || social);
            // Each institutional group stages its own materials (stageKit in its module).
            institutionalModule(id)?.stageKit?.({ life: this, h, m, g, y, phase, active, social, quiet, small, spec, THREE });
        } else if (id === 'music') {
            this.book(g, [small ? 0 : -55, y, 0], '#715746', !quiet && !small);
            if (!small && !quiet) {
                // Pencil and a stopped metronome; no implied live audio source.
                h.rod(g, [90, y + 4, 60], [182, y + 4, 73], 2, m.ink);
                h.rod(g, [176, y + 4, 72], [185, y + 4, 73], 2.2, m.brass);
                h.box(g, [45, 65, 35], [115, y + 32.5, -55], m.wood, 3);
                h.rod(g, [115, y + 15, -36], [126, y + 57, -36], 1.8, m.brass);
                for (let n = 0; n < 4; n++) h.box(g, [5, .6, 1], [104, y + 14 + n * 12, -36], m.paper);
            }
        } else if (id === 'office') {
            this.book(g, [small ? 0 : -50, y, 0], '#3d6864', !quiet && !small);
            if (!small && !quiet) {
                for (let n = 0; n < (social ? 4 : 2); n++) h.box(g, [44, 1, 38], [85 + n % 2 * 52, y + 1, -50 + Math.floor(n / 2) * 48], n % 2 ? m.linen : m.green, 1);
                h.rod(g, [65, y + 4, 72], [155, y + 4, 72], 2, m.ink);
            }
        } else if (id === 'gym') {
            for (let i = 0; i < (quiet ? 3 : 1); i++) h.box(g, [140, 22, 100], [0, y + 11 + i * 23, 0], m.linen, 5);
            for (const x of [-57, 57]) h.box(g, [2, .6, 86], [x, y + (quiet ? 68 : 22.3), 0], m.paper);
            if (!quiet) this.book(g, [0, y + 22, 0], '#61796c', active || social);
        } else if (id === 'creative') {
            if (quiet || social) this.book(g, [0, 0, 0], '#89705c', social);
            else {
                const palette = h.mesh(g, new THREE.CylinderGeometry(73, 73, 7, 24), m.wood, [0, 3.5, 0]); palette.scale.z = .72;
                for (let i = 0; i < 5; i++) h.sphere(g, [9, 2, 9], [-45 + i * 22, 8, -22 + i % 2 * 12], h.material(['#b45b48', '#d2b662', '#638786', '#566986', '#e7dcc3'][i]));
                h.rod(g, [-60, 12, 35], [60, 12, 35], 3, m.ink);
                h.rod(g, [35, 12, 35], [49, 12, 35], 3.6, m.ferrule);
                h.rod(g, [49, 12, 35], [65, 12, 35], 3, m.wood);
                for (let n = 0; n < 4; n++) h.rod(g, [51, 12, 33 + n], [65, 12, 33 + n], .3, m.ink);
            }
            if (phase === 2) this.cup(g, [0, 0, 80]);
        } else if (id === 'workshop') {
            this.book(g, [-60, 0, 0], '#496c70', active || phase === 0 || social);
            if (active || social) {
                h.box(g, [100, 34, 65], [125, 17, 0], m.wood, 3);
                h.rod(g, [105, 36, -22], [140, 36, 22], 5, m.brass);
                h.box(g, [190, 3, 20], [0, 2, 120], m.brass, 1);
                for (let n = 0; n < 12; n++) h.box(g, [1, 1, 8], [-80 + n * 14, 4, 120], m.ink);
            } else if (phase === 2) this.cup(g, [85, 0, 0]);
        } else if (id === 'scifi') {
            const screen = h.material('#72ccd5', { emissive: '#63c4d0', emissiveIntensity: quiet ? .15 : .45 });
            h.box(g, [130, 12, 150], [0, 6, 0], m.ink, 8).userData.activityTablet=true;
            h.box(g, [110, 2, 125], [0, 13, 0], screen, 3).userData.activityTablet=true;
            for (let n = 0; n < (active ? 3 : 1); n++) h.mesh(g, new THREE.CylinderGeometry(14, 14, 60, 12), m.brass, [n * 38 - 38, 30, 100]);
        } else if (['library', 'coworking'].includes(id)) {
            this.book(g, [-25, 0, 0], '#536f65', !quiet);
            if (social || active) {
                for (let i = 0; i < (social ? 5 : 2); i++) { const sheet = h.box(g, [45, 1, 45], [120 + i % 2 * 58, 1, -60 + Math.floor(i / 2) * 54], i % 2 ? m.clay : m.linen, 1); sheet.rotation.y = (i - 2) * .12; }
                h.rod(g, [95, 3, 75], [195, 3, 75], 3, m.ink);
            } else if (quiet) this.book(g, [90, 0, 15], '#a78367');
        } else if (['gaming', 'lounge'].includes(id) && (active || social || phase === 2)) {
            const remote = h.box(g, [86, 17, 55], [-65, y + 8.5, 0], m.ink, 7); remote.rotation.y = -.2; remote.userData.activityRemote=true;
            for (const x of [-87, -48]) h.sphere(g, [6, 4, 6], [x, y + 19, 0], m.brass).userData.activityRemoteControl=true;
            this.snacks(g, [70, y, 0], social ? 7 : 4);
        } else if (id === 'kitchen' && !quiet) {
            this.snacks(g, [0, y, 0], social ? 7 : 3, phase === 0);
            if (!small) { this.cup(g, [-100, y, 0]); if (social || phase === 2) this.cup(g, [100, y, 0]); }
        } else if (social && !small) {
            this.cup(g, [-85, y, -10]); this.cup(g, [85, y, 0]); this.snacks(g, [0, y, 25], 4);
        } else {
            if (small) {
                if (phase === 0 || phase === 2) this.cup(g, [0, y, 0]);
                else this.book(g, [0, y, 0], '#61796c');
            } else {
                this.book(g, [-65, y, 0], '#61796c', active || phase === 2);
                if (!quiet) this.cup(g, [105, y, 25], phase !== 0);
            }
        }
        g.rotation.y = [0, -.12, .1, .04, -.08][phase];
    }
    snacks(parent, at, count, fruit = false) {
        const { h, mats: m } = this, g = new THREE.Group(); g.position.set(...at); parent.add(g);
        h.mesh(g, new THREE.LatheGeometry([[0,0],[31,0],[34,3],[48,19],[47,22],[44,22],[32,6],[0,6]].map(([x,y])=>new THREE.Vector2(x,y)), 32), m.cream);
        for (let i = 0; i < count; i++) { const angle = i * 2.4; h.sphere(g, fruit ? [15, 15, 15] : [10, 6, 10], [Math.cos(angle) * (i % 2 ? 24 : 10), 23 + i % 3 * 8, Math.sin(angle) * 22], fruit ? (i % 2 ? m.clay : m.green) : m.paper); }
    }
    bind() {
        const { room, anchor } = this, root = room.root;
        root.updateWorldMatrix(true, true);
        const children = [...root.children], claimed = new Set();
        const bounds = obj => new THREE.Box3().setFromObject(obj).applyMatrix4(root.matrixWorld.clone().invert());
        const claim = (objects, role, pivot) => {
            objects = [...new Set(objects)].filter(o => o && !claimed.has(o)); if (!objects.length) return;
            const footprint = new THREE.Box3(); objects.forEach(o => { claimed.add(o); footprint.union(bounds(o)); });
            pivot ||= footprint.getCenter(new THREE.Vector3());
            this.entries.push({ objects, role, pivot, footprint, delta: new THREE.Matrix4() });
        };
        // Move table and everything resting on it by one root-space transform.
        // Their original parents and editor IDs remain intact.
        const tables = children.filter(o => /^(coffee-table(-2)?|artist-worktable|music-stage-piano|dining-table|meeting-table|reading-table-\d+|kenney-furniture-lounge-sofa-ottoman)$/.test(o.userData.propId || '') || ['Reading side table', 'Lounge coffee table'].includes(o.name));
        for (const table of tables) {
            if (!table.userData.sceneAsset) this.h.markSceneAsset(table, { key: `${room.id}:${room.roomLayout.id}:life:table:${table.name}` });
            const b = bounds(table), center = b.getCenter(new THREE.Vector3());
            const contents = children.filter(o => o !== table && o.position.y > 250 && o.position.y <= b.max.y + 50 && b.containsPoint(new THREE.Vector3(o.position.x, Math.min(o.position.y, b.max.y), o.position.z)));
            const activityOnTable = anchor.support && (table.userData.propId === anchor.support || table.name === anchor.support);
            claim([table, ...contents, ...(activityOnTable ? [this.activity, this.shared] : [])], table.userData.propId === 'music-stage-piano' ? 'piano' : 'table', center);
        }
        // The kitchen's existing place settings also follow the meal, rather
        // than leaving six dinner plates out during a midnight cup of tea.
        this.mealSettings = [];
        const dining = children.find(o => o.userData.propId === 'dining-table');
        dining?.traverse(o => {
            if (o.userData.mealSetting) this.mealSettings.push(o);
        });
        let mainChair = 0;
        for (const obj of children) {
            const id = obj.userData.propId || '';
            if (id === 'steelcase-leap-v2') claim([obj], mainChair++ ? 'work-chair' : 'main-chair', obj.position.clone());
            else if (/armchair|lounge-chair|chair-cushion|chair-modern|chair-dining|stool-bar|bar-stool|bench-cushion-low/.test(id)) claim([obj], /chair-modern|chair-dining/.test(id) ? 'meeting-chair' : 'reading-chair', obj.position.clone());
            else if (/^(artist-easel|music-vocal-mic|robot-dog|training-zone|weight-bench|tool-cart)$/.test(id) || /tool.*cart/.test(id)) {
                const linked = id === 'training-zone' ? children.filter(o => o.userData.propId === 'gym-props-3') : [];
                claim([obj, ...linked], id === 'training-zone' ? 'training' : 'portable', obj.position.clone());
            }
        }
        this.bound = true; const requested = this.mode || 'morning'; this.mode = null; this.apply(requested);
    }
    pose(entry, phase) {
        const f = this.factor, scene = this.room.id, p = entry.pivot;
        if(institutionalModule(scene)?.stableWorkstations&&['main-chair','work-chair'].includes(entry.role))return new THREE.Matrix4();
        const side = p.x > 0 ? -1 : 1;
        // Each role has a use: pulled-out work seat, a turned reading seat,
        // tucked meeting seats, or portable equipment brought into activity.
        const poses = {
            'main-chair': [[side * 170, 300, side * .18], [0, 0, 0], [side * 130, 200, side * .14], [side * 100, 80, 0], [side * 330, 370, side * .38]],
            'work-chair': [[0, -80, 0], [0, 120, .08 * side], [side * 90, 150, side * .15], [0, -130, 0], [side * 160, 220, side * .25]],
            'reading-chair': [[side * 70, -40, side * .18], [0, 0, 0], [side * 140, -90, -side * .15], [0, 90, side * .06], [side * 180, -180, -side * .3]],
            'meeting-chair': [[0, -60 * Math.sign(p.z - (this.room.roomLayout.meeting?.[1] || this.room.roomLayout.dining?.[1] || this.room.roomLayout.reading?.[0]?.[1] || p.z)), 0], [side * 50, 50, side * .05], [side * 100, 80, side * .14], [0, -100, 0], [side * 140, 150, side * .25]],
            table: [[side * 45, -30, .025 * side], [0, 0, 0], [side * 90, -70, -.025 * side], [0, 30, 0], [side * 130, -120, .05 * side]],
            piano: [[0, 0, .015], [0, 0, 0], [60, 0, -.02], [0, 35, 0], [100, -100, .06]],
            training: [[-90, -150, -.04], [90, 0, .035], [0, 90, -.06], [150, 180, .03], [-100, -120, .06]],
            portable: [[side * 70, -90, .08 * side], [side * 130, 40, -.1 * side], [side * 50, 150, .14 * side], [0, 80, 0], [side * 220, -200, -.2 * side]]
        };
        let [x, z, angle] = poses[entry.role][phase];
        if (scene === 'library') {
            // Fixed library tables stay in their floorplan zones. Seat motions
            // are measured from each seat's own table or window carrel, and
            // don't grow with room size or shove rear seats into the tabletop.
            if (entry.role === 'table') return new THREE.Matrix4();
            if (entry.role === 'meeting-chair') {
                const l = this.room.roomLayout;
                const supports = [...l.reading, ...l.carrels.map(c => c.at), ...(l.research ? [l.research] : [])];
                const nearest = supports.reduce((a, b) => Math.hypot(p.x-b[0], p.z-b[1]) < Math.hypot(p.x-a[0], p.z-a[1]) ? b : a);
                const ox = p.x - nearest[0], oz = p.z - nearest[1], pull = [20, 0, 35, -50, 65][phase];
                x = Math.abs(ox) > Math.abs(oz) ? Math.sign(ox) * pull / f : 0;
                z = Math.abs(oz) >= Math.abs(ox) ? Math.sign(oz) * pull / f : 0;
                angle = [0, .015, .025, 0, .04][phase] * side / f;
            }
        }
        // Scene-specific circulation: a microphone comes forward for a live
        // set, an easel turns for visitors, and the robot patrols the bay.
        if (entry.role === 'portable' && phase === 4) {
            if (scene === 'music') { x *= 1.6; z *= 1.5; }
            if (scene === 'creative') { angle = -.32 * side; x *= 1.2; }
            if (scene === 'workshop') { x *= 1.4; z *= 1.4; }
        }
        if (entry.role === 'table' && ['kitchen', 'coworking', 'library'].includes(scene)) { x *= .45; z *= .45; angle *= .4; }
        // More floor area permits larger adjustments; compact rooms keep
        // their clear perimeter. Never rescale furniture to fit a layout.
        let dx = x * f, dz = z * f;
        if (scene === 'scifi' && entry.role === 'portable') { dx *= 1.6; dz *= 1.6; }
        const delta = new THREE.Matrix4().makeTranslation(p.x, 0, p.z).multiply(new THREE.Matrix4().makeRotationY(angle * f)).multiply(new THREE.Matrix4().makeTranslation(-p.x, 0, -p.z));
        const b = entry.footprint.clone().applyMatrix4(delta), l = this.room.roomLayout;
        dx = THREE.MathUtils.clamp(dx, -l.width / 2 + 20 - b.min.x, l.width / 2 - 20 - b.max.x);
        dz = THREE.MathUtils.clamp(dz, l.back + 20 - b.min.z, l.back + l.depth - 20 - b.max.z);
        return new THREE.Matrix4().makeTranslation(dx, 0, dz).multiply(delta);
    }
    apply(mode) {
        const phase = Math.max(0, DAY_PHASES.indexOf(mode));
        this.kits.forEach((g, i) => g.visible = i === phase);
        if (this.shared) this.shared.visible = phase === 1 || phase === 4;
        this.mealSettings?.forEach(o => {
            const [x, z] = o.userData.mealSetting;
            o.visible = phase === 4 || (phase === 2 && x < 0) || (phase === 0 && x < 0 && z > 0);
        });
        this.room.root.userData.dailyStory = ROOM_STORIES[this.room.id][phase];
        if (this.mode === mode) return;
        this.mode = mode;
        if (this.bound) for (const entry of this.entries) {
            const next = this.pose(entry, phase), change = next.clone().multiply(entry.delta.clone().invert());
            for (const obj of entry.objects) {
                obj.updateMatrix(); const result = change.clone().multiply(obj.matrix);
                result.decompose(obj.position, obj.quaternion, obj.scale);
                obj.userData.dailyDelta = next.toArray(); obj.updateMatrixWorld(true);
            }
            entry.delta.copy(next);
        }
        this.room.root.userData.dailyArrangement = { mode, movers: this.entries.length, tier: this.room.roomLayout.id };
    }
    lightActivity() {
        // Atmosphere assigns base powers before this pass, preventing multiplier
        // drift when an exposure or accent slider is moved repeatedly.
        const lamps = this.room.root.children.filter(o => o.isPointLight), l = this.room.roomLayout;
        const communal = ['kitchen', 'lounge', 'coworking', 'library', 'gallery'].includes(this.room.id);
        for (const lamp of lamps) {
            const task = Math.hypot(lamp.position.x - l.desk[0], lamp.position.z - l.desk[1]) < 1400;
            const social = this.mode === 'party';
            const factor = this.mode === 'night' ? (task ? 1.18 : .72) : social ? (task ? .88 : communal ? 1.16 : 1.06) : this.mode === 'evening' ? (task ? .98 : 1.06) : 1;
            lamp.intensity *= factor;
        }
    }
}
