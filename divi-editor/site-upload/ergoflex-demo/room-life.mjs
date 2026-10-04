import * as THREE from 'three';

export const DAY_PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const TIERS = ['apartment', 'house', 'spacious', 'premium', 'executive'];
// Authored activities, rather than the same dinner party in every environment.
export const ROOM_STORIES = {
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
    library: ['Reading list & returned books', 'Research & shared annotations', 'Quiet reading & study notes', 'Late study, books neatly stacked', 'Study group & shared problem solving']
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
        this.kits = []; this.buildActivities();
    }
    buildActivities() {
        const { room, anchor: a, h } = this, l = room.roomLayout;
        if (!a?.at?.every(Number.isFinite)) throw new Error(`Missing daily activity support: ${room.id}/${l.id}`);
        const group = new THREE.Group(); group.name = ROOM_STORIES[room.id][0].split(' & ')[0] + ' · daily activity';
        group.position.set(a.at[0] + a.offset[0], a.y + 1, a.at[1] + a.offset[1]); room.root.add(group);
        group.userData.propId = `${room.id}-daily-activity`; group.userData.sceneAssetName = 'Daily activity · ' + l.name;
        h.markSceneAsset(group, { key: `${room.id}:${l.id}:life:activity` }); this.activity = group;
        const mat = (c, kind, extra = {}) => { const m = h.material(c, extra); if (kind) m.userData.roomSurface = kind; return m; };
        this.mats = { paper: mat('#e9dfc6'), ink: mat('#344c50'), clay: mat('#b98062'), linen: mat('#c8b694', 'fabric'), wood: mat('#997653', 'wood'), cream: mat('#e9dcc8'), brass: mat('#ac9270', 'metal', { metalness: .55 }), green: mat('#61796c') };
        for (let phase = 0; phase < DAY_PHASES.length; phase++) {
            const variant = new THREE.Group(); variant.name = ROOM_STORIES[room.id][phase]; group.add(variant); this.kits.push(variant);
            this.makeKit(variant, phase, a.small);
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
        const cover = h.material(color, { roughness: .88 });
        h.box(g, [open ? 210 : 100, 5, 142], [0, 2.5, 0], cover, 2);
        h.box(g, [open ? 202 : 94, 12, 134], [0, 11, 0], m.paper, 1);
        if (open) {
            h.box(g, [3, 14, 132], [0, 12, 0], cover, 1);
            for (const x of [-50, 50]) for (let n = 0; n < 5; n++) h.box(g, [65, .5, 1.5], [x, 17.3, -35 + n * 13], m.ink);
            h.box(g, [22, .6, 24], [50, 17.5, 42], m.clay);
        } else h.box(g, [100, 4, 142], [0, 19, 0], cover, 2);
        return g;
    }
    cup(parent, at, tea = true) {
        const { h, mats: m } = this, g = new THREE.Group(); g.position.set(...at); parent.add(g);
        h.mesh(g, new THREE.CylinderGeometry(33, 28, 58, 16), m.cream, [0, 30, 0]);
        h.mesh(g, new THREE.CylinderGeometry(29, 29, 2, 16), tea ? m.wood : m.ink, [0, 59, 0]);
        const handle = h.mesh(g, new THREE.TorusGeometry(16, 4, 6, 12), m.cream, [36, 32, 0]); handle.rotation.y = Math.PI / 2;
        return g;
    }
    makeKit(g, phase, small) {
        const { h, mats: m, room } = this, id = room.id;
        const social = phase === 4, active = phase === 1, quiet = phase === 3;
        // Trays, notebooks and textiles have real contact heights. No giant
        // image planes or lights are added to the renderer for these details.
        const tray = !['creative', 'workshop', 'library', 'coworking', 'scifi'].includes(id);
        if (tray) h.box(g, [small ? 110 : 290, 4, small ? 105 : 195], [0, 2, 0], m.wood, 7);
        const y = tray ? 4 : 0;
        if (id === 'gym') {
            for (let i = 0; i < (quiet ? 3 : 1); i++) h.box(g, [140, 22, 100], [0, y + 11 + i * 23, 0], m.linen, 5);
            if (!quiet) this.book(g, [0, y + 22, 0], '#61796c');
        } else if (id === 'creative') {
            if (quiet || social) this.book(g, [0, 0, 0], '#89705c', social);
            else {
                const palette = h.mesh(g, new THREE.CylinderGeometry(73, 73, 7, 24), m.wood, [0, 3.5, 0]); palette.scale.z = .72;
                for (let i = 0; i < 5; i++) h.sphere(g, [9, 2, 9], [-45 + i * 22, 8, -22 + i % 2 * 12], h.material(['#b45b48', '#d2b662', '#638786', '#566986', '#e7dcc3'][i]));
                h.rod(g, [-60, 12, 35], [60, 12, 35], 3, m.ink);
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
            h.box(g, [130, 12, 150], [0, 6, 0], m.ink, 8);
            h.box(g, [110, 2, 125], [0, 13, 0], screen, 3);
            for (let n = 0; n < (active ? 3 : 1); n++) h.mesh(g, new THREE.CylinderGeometry(14, 14, 60, 12), m.brass, [n * 38 - 38, 30, 100]);
        } else if (['library', 'coworking'].includes(id)) {
            this.book(g, [-25, 0, 0], '#536f65', !quiet);
            if (social || active) {
                for (let i = 0; i < (social ? 5 : 2); i++) { const sheet = h.box(g, [45, 1, 45], [120 + i % 2 * 58, 1, -60 + Math.floor(i / 2) * 54], i % 2 ? m.clay : m.linen, 1); sheet.rotation.y = (i - 2) * .12; }
                h.rod(g, [95, 3, 75], [195, 3, 75], 3, m.ink);
            } else if (quiet) this.book(g, [90, 0, 15], '#a78367');
        } else if (['gaming', 'lounge'].includes(id) && (active || social || phase === 2)) {
            const remote = h.box(g, [86, 17, 55], [-65, y + 8.5, 0], m.ink, 7); remote.rotation.y = -.2;
            for (const x of [-87, -48]) h.sphere(g, [6, 4, 6], [x, y + 19, 0], m.brass);
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
        h.mesh(g, new THREE.CylinderGeometry(48, 34, 20, 16), m.cream, [0, 10, 0]);
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
            const factor = this.mode === 'night' ? (task ? 1.15 : .58) : social ? (task ? .8 : communal ? 1.2 : 1.08) : this.mode === 'evening' ? (task ? .85 : 1.08) : 1;
            lamp.intensity *= factor;
        }
    }
}
