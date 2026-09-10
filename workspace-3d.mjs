import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ACCESSORIES } from './catalog.mjs';

// Original geometry in millimetres: X is user-right, Z is toward the user.
// The CAD desk uses X for depth and Z for width. Only the mounting layer maps
// between these conventions; accessories never inherit a guessed CAD scale.
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, ...extra });
function mesh(parent, geometry, mat, position = [0, 0, 0]) {
    const obj = new THREE.Mesh(geometry, mat);
    obj.position.set(...position); obj.castShadow = true; obj.receiveShadow = true;
    parent.add(obj); return obj;
}
function box(parent, size, position, mat, radius = 0) {
    return mesh(parent, radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size), mat, position);
}
function sphere(parent, size, position, mat) {
    const obj = mesh(parent, new THREE.SphereGeometry(1, 20, 12), mat, position);
    obj.scale.set(...size); return obj;
}
function rod(parent, from, to, radius, mat) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const obj = mesh(parent, new THREE.CylinderGeometry(radius, radius, delta.length(), 12), mat);
    obj.position.copy(a).add(b).multiplyScalar(.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return obj;
}
function disposeTree(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(obj => {
        if (obj.geometry) geometries.add(obj.geometry);
        for (const m of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
            if (!m) continue;
            materials.add(m);
            if (m.map) textures.add(m.map);
        }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    root.removeFromParent();
}

function screenTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 576;
    const c = canvas.getContext('2d');
    const gradient = c.createLinearGradient(0, 0, 1024, 576);
    gradient.addColorStop(0, '#102f39'); gradient.addColorStop(.55, '#416e65'); gradient.addColorStop(1, '#c4d2aa');
    c.fillStyle = gradient; c.fillRect(0, 0, 1024, 576);
    for (let i = 0; i < 5; i++) {
        c.beginPath(); c.ellipse(800, 610, 690 - i * 90, 470 - i * 60, -.45, Math.PI, Math.PI * 2);
        c.strokeStyle = `rgba(226,240,217,${.1 + i * .03})`; c.lineWidth = 35; c.stroke();
    }
    c.fillStyle = '#f5f7ef'; c.font = '26px sans-serif'; c.fillText('A little space to think.', 64, 94);
    c.fillStyle = '#ffffff38'; c.fillRect(375, 535, 274, 22);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function createAccessory(item) {
    const root = new THREE.Group(); root.name = `Accessory:${item.id}`;
    root.userData.accessoryId = item.id;
    const dark = material('#262e33'), soft = material('#555b5d'), silver = material('#bbc1c1', { metalness: .7, roughness: .32 });
    const type = item.visual;
    if (type === 'monitor') {
        const stand = new THREE.Group(); stand.name = 'monitor-stand'; root.add(stand);
        box(stand, [235, 8, 192.28], [0, 4, 0], silver, 3);
        box(stand, [42, 230, 32], [0, 119, -35], silver, 5);
        const panel = new THREE.Group(); panel.name = 'monitor-panel'; root.add(panel);
        // 612.24 × 352.51 × 50.12 mm enclosure; 450 mm chosen within the
        // manufacturer's 385.58–535.58 mm stand height adjustment range.
        box(panel, [612.24, 352.51, 50.12], [0, 273.745, -25.06], silver, 5);
        box(panel, [608, 349, 5], [0, 273.745, 2], dark, 2);
        const display = new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false });
        mesh(panel, new THREE.PlaneGeometry(596.74, 335.66), display, [0, 276, 4.6]);
        box(panel, [15, 2, 1], [0, 103, 5], silver);
        sphere(panel, [1.5, 1.5, 1], [291, 103, 5], material('#d5efdf', { emissive: '#bce2d2', emissiveIntensity: .5 }));
    } else if (type === 'keyboard') {
        box(root, [456, 17, 233], [0, 8.5, 0], dark, 8);
        box(root, [445, 22, 79], [0, 21, 75], soft, 10);
        for (const side of [-1, 1]) {
            const half = new THREE.Group(); half.position.set(side * 85 - 38, 21, -39);
            half.rotation.y = side * -.14; half.rotation.z = side * -.085; root.add(half);
            box(half, [167, 8, 132], [0, 0, 0], soft, 3);
            for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
                box(half, [18, 5, 18], [-65 + col * 21, 7, -49 + row * 24], dark, 1.8);
            }
            box(half, [72, 5, 15], [0, 7, 65], dark, 2);
        }
        for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++)
            box(root, [18, 5, 18], [164 + col * 21, 23, -90 + row * 24], dark, 1.5);
    } else if (type === 'mouse') {
        sphere(root, [35, 8, 54], [0, 8, 0], soft);
        const body = sphere(root, [25, 34, 46], [7, 37, -2], dark); body.rotation.z = -.24;
        sphere(root, [19, 5, 34], [-15, 12, 4], soft);
        for (let i = 0; i < 7; i++) {
            const line = sphere(root, [1, 1, 26 - i], [-18 + i * 3, 19 + i * 4, 8], soft);
            line.rotation.x = -.08;
        }
        box(root, [2, 2, 32], [11, 69, -12], silver, .8);
        const wheel = mesh(root, new THREE.CylinderGeometry(5, 5, 4, 16), silver, [11, 65, -21]);
        wheel.rotation.z = Math.PI / 2;
    } else if (type === 'mat') {
        box(root, [720, 3, 330], [0, 1.5, 0], material('#717e75'), 1.4);
    } else if (type === 'lamp') {
        mesh(root, new THREE.CylinderGeometry(63, 70, 10, 32), dark, [0, 5, 0]);
        rod(root, [0, 10, 0], [0, 240, -45], 9, dark);
        rod(root, [0, 240, -45], [0, 395, 100], 8, dark);
        sphere(root, [15, 15, 15], [0, 240, -45], silver);
        box(root, [170, 13, 48], [0, 391, 100], dark, 6);
        box(root, [153, 2, 32], [0, 383, 100], material('#fff5cf', { emissive: '#ffdb94', emissiveIntensity: 1 }));
    } else if (type === 'arm' || type === 'dual-arm') {
        box(root, [80, 8, 60], [0, 4, 0], dark, 3);
        box(root, [68, 45, 8], [0, -16, -26], dark, 2);
        box(root, [55, 6, 45], [0, -38, -7], dark, 2);
        rod(root, [0, 5, 0], [0, 260, 0], 14, silver);
        for (const end of (type === 'dual-arm' ? [-1, 1] : [0])) {
            const x = end * 270;
            rod(root, [0, 235, 0], [x || 70, 310, 180], 15, dark);
            rod(root, [x || 70, 310, 180], [x, 280, 400], 13, silver);
            box(root, [100, 100, 8], [x, 280, 405], dark, 3);
        }
    } else if (type === 'tray') {
        box(root, [500, 4, 120], [0, -70, 0], dark, 1);
        for (const z of [-58, 58]) box(root, [500, 48, 4], [0, -46, z], dark, 1);
        for (const x of [-210, 210]) box(root, [16, 65, 5], [x, -32, -57], silver, 1);
        for (let i = 0; i < 4; i++) box(root, [350, 5, 5], [0, -64 + i * 5, -20 + i * 14], soft, 2);
    } else if (type === 'holder') {
        for (const x of [-110, 110]) box(root, [10, 340, 210], [x, -185, 0], dark, 3);
        box(root, [230, 10, 210], [0, -350, 0], dark, 3);
        box(root, [240, 8, 80], [0, -10, 0], silver, 2);
        for (const z of [-60, 60]) box(root, [220, 4, 22], [0, -342, z], soft, 1);
    } else if (type === 'footrest') {
        for (const x of [-185, 185]) {
            box(root, [35, 40, 300], [x, 20, 0], dark, 8);
            rod(root, [x, 25, -60], [x, 100, 0], 12, silver);
        }
        const platform = new THREE.Group(); platform.position.y = 95; platform.rotation.x = .16; root.add(platform);
        box(platform, [460, 25, 330], [0, 0, 0], soft, 10);
        for (let i = 0; i < 9; i++) box(platform, [415, 3, 5], [0, 14, -125 + i * 30], dark, 1);
    }
    if (item.dimensionsMm && type !== 'monitor') {
        const form = new THREE.Group();
        for (const child of [...root.children]) form.add(child);
        const bounds = new THREE.Box3().setFromObject(form), size = bounds.getSize(new THREE.Vector3());
        form.scale.set(item.dimensionsMm.width / size.x, item.dimensionsMm.height / size.y, item.dimensionsMm.depth / size.z);
        form.position.set(-(bounds.min.x + bounds.max.x) / 2 * form.scale.x, -bounds.min.y * form.scale.y, -(bounds.min.z + bounds.max.z) / 2 * form.scale.z);
        root.add(form);
    }
    // Unused palette materials have no GPU allocation; everything actually
    // assigned to a mesh is disposed with its owning product.
    return root;
}

// Locate the largest upward-facing triangle. Its plane is the working face,
// whereas the bounding-box maximum can be a lip several inches above it.
function workingSurface(obj) {
    obj.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(obj), center = bounds.getCenter(new THREE.Vector3());
    const p = obj.geometry.attributes.position, idx = obj.geometry.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    let area = 0, planePoint = new THREE.Vector3(center.x, bounds.max.y, center.z), normal = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < (idx ? idx.count : p.count); i += 3) {
        a.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(obj.matrixWorld);
        b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(obj.matrixWorld);
        c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(obj.matrixWorld);
        n.crossVectors(b.sub(a), c.sub(a));
        const magnitude = n.length();
        if (magnitude > area && n.y / magnitude > .8) { area = magnitude; normal.copy(n).normalize(); planePoint.copy(a); }
    }
    center.y = planePoint.y - (normal.x * (center.x - planePoint.x) + normal.z * (center.z - planePoint.z)) / normal.y;
    return { center, normal, bounds };
}

export class WorkspaceAccessories {
    constructor(scene, registry, millimetreScale, model) {
        this.scene = scene; this.items = new Map(); this.mounts = new Map(); this.scale = millimetreScale;
        for (const [role, name] of [['desktop', 'Desktop_3'], ['shelf', 'Top_Shelf_4']]) {
            const anchor = [...registry.values()].find(e => e.name === name && !e.isClone)?.obj;
            if (!anchor) continue;
            const surface = workingSurface(anchor);
            const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal)
                .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
            const world = new THREE.Matrix4().compose(surface.center, rotation, new THREE.Vector3().setScalar(millimetreScale));
            const group = new THREE.Group(); group.name = `Accessory mount:${role}`; group.matrixAutoUpdate = false; scene.add(group);
            this.mounts.set(role, { anchor, group, relative: anchor.matrixWorld.clone().invert().multiply(world),
                depth: (surface.bounds.max.x - surface.bounds.min.x) / millimetreScale });
        }
        if (model) {
            model.updateWorldMatrix(true, false);
            const world = new THREE.Matrix4().compose(new THREE.Vector3(0, .005, 0),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3().setScalar(millimetreScale));
            const group = new THREE.Group(); group.name = 'Accessory mount:floor'; group.matrixAutoUpdate = false; scene.add(group);
            this.mounts.set('floor', { anchor: model, group, relative: model.matrixWorld.clone().invert().multiply(world) });
        }
    }
    sync(config) {
        const selected = new Set(config.accessories);
        for (const [id, obj] of this.items) if (!selected.has(id)) { disposeTree(obj); this.items.delete(id); }
        for (const item of ACCESSORIES) {
            if (!selected.has(item.id) || !item.visual || this.items.has(item.id)) continue;
            const role = item.visual === 'footrest' ? 'floor' : ['monitor', 'arm', 'dual-arm'].includes(item.visual) ? 'shelf' : 'desktop';
            const mount = this.mounts.get(role);
            if (!mount) continue;
            const obj = createAccessory(item); mount.group.add(obj); this.items.set(item.id, obj);
        }
        const front = (this.mounts.get('desktop')?.depth || 800) / 2;
        const mat = selected.has('desk-mat') ? 3 : 0;
        const place = (id, x, y, z) => this.items.get(id)?.position.set(x, y, z);
        place('desk-mat', 0, 0, front - 220);
        place('logitech-k860', -64, mat, front - 215);
        place('logitech-lift', 240, mat, front - 190);
        place('task-light', -435, 0, front - 350);
        place('cable-tray', 0, -22, -80);
        place('cpu-holder', 370, -24, 40);
        place('foot-rest', 0, 0, 680);
        const back = -(this.mounts.get('shelf')?.depth || 480) / 2;
        place('monitor-arm', 0, 0, back + 28);
        place('monitor-arm-2', 0, 0, back + 28);
        const monitor = this.items.get('dell-u2724d');
        if (monitor) {
            const dual = selected.has('monitor-arm-2'), mounted = dual || selected.has('monitor-arm');
            // The purchase is ONE display even on a dual arm. Leave the second
            // VESA head empty instead of inventing a second billed product.
            monitor.position.set(dual ? -270 : 0, mounted ? 6.255 : 0, mounted ? back + 467 : 0);
            monitor.getObjectByName('monitor-stand').visible = !mounted;
        }
        this.update();
    }
    update() {
        for (const { anchor, group, relative } of this.mounts.values()) {
            anchor.updateWorldMatrix(true, false);
            group.matrix.multiplyMatrices(anchor.matrixWorld, relative);
            let visible = true;
            for (let p = anchor; p; p = p.parent) if (!p.visible) visible = false;
            group.visible = visible; group.updateMatrixWorld(true);
        }
    }
    objects() { return [...this.items.values()]; }
    exportGroups() { this.update(); return [...this.mounts.values()].map(m => m.group.clone(true)); }
    dispose() { this.mounts.forEach(m => disposeTree(m.group)); this.mounts.clear(); this.items.clear(); }
}

export const ROOM_SCENES = [
    { id: 'product', name: 'Product', caption: 'A clear view of every detail.', tone: 'slate' },
    { id: 'office', name: 'Office', caption: 'Space for your next big idea.', tone: 'gallery' },
    { id: 'home', name: 'Home office', caption: 'Make yourself at work.', tone: 'warm' },
    { id: 'music', name: 'Music studio', caption: 'Find your creative frequency.', tone: 'slate' },
    { id: 'gaming', name: 'Gaming', caption: 'Settle into your next world.', tone: 'slate' }
];

function plant(parent, position, height = 700) {
    const root = new THREE.Group(); root.position.set(...position); parent.add(root);
    const pot = material('#c3b5a1'), green = material('#496b51'), stem = material('#53694b');
    mesh(root, new THREE.CylinderGeometry(110, 75, 210, 24), pot, [0, 105, 0]);
    for (let i = 0; i < 9; i++) {
        const angle = i * 2.4, y = 270 + i * (height - 300) / 9;
        const end = [Math.cos(angle) * 120, y, Math.sin(angle) * 120];
        rod(root, [0, 175, 0], end, 4, stem);
        const leaf = sphere(root, [60, 120, 19], end, green); leaf.rotation.set(.5, angle, .55);
    }
}
function speaker(parent, x, z) {
    const black = material('#25282d');
    box(parent, [330, 40, 310], [x, 20, z], black, 10);
    rod(parent, [x, 25, z], [x, 925, z], 24, black);
    box(parent, [240, 370, 240], [x, 1065, z], black, 14);
    for (const [dy, radius] of [[-65, 82], [82, 33]]) {
        const driver = mesh(parent, new THREE.CylinderGeometry(radius, radius, 10, 32), material(dy < 0 ? '#b5ac89' : '#11151a'), [x, 1065 + dy, z + 121]);
        driver.rotation.x = Math.PI / 2;
        sphere(parent, [radius * .38, radius * .38, 9], [x, 1065 + dy, z + 127], black);
    }
}

export class WorkspaceRoom {
    constructor(scene, millimetreScale) { this.scene = scene; this.scale = millimetreScale; this.id = 'product'; this.root = null; this.walls = []; }
    set(id) {
        if (!ROOM_SCENES.some(s => s.id === id)) id = 'product';
        if (this.root) disposeTree(this.root);
        this.id = id; this.root = null; this.walls = [];
        if (id === 'product') return;
        const root = this.root = new THREE.Group(); root.name = `Room:${id}`;
        root.rotation.y = Math.PI / 2; root.scale.setScalar(this.scale); this.scene.add(root);
        const dark = id === 'music' || id === 'gaming';
        const wall = material(dark ? '#363b48' : id === 'home' ? '#ded7c8' : '#e0e6df');
        const floor = material(dark ? '#55515a' : '#bcb4a1'), trim = material(dark ? '#252b35' : '#eee9de');
        box(root, [4200, 24, 4000], [0, -18, 200], floor, 6);
        // Open-front room with walls that disappear when orbiting behind them.
        const back = new THREE.Group(); root.add(back);
        box(back, [4200, 2600, 50], [0, 1300, -1650], wall);
        box(back, [4200, 65, 22], [0, 32, -1617], trim);
        this.walls.push({ obj: back, axis: 'x', limit: -1650 * this.scale });
        const side = new THREE.Group(); root.add(side);
        box(side, [50, 2600, 3600], [2100, 1300, 125], wall);
        this.walls.push({ obj: side, axis: 'z', limit: -2100 * this.scale });
        box(root, [2050, 8, 1700], [0, -1, 200], material(dark ? '#343745' : id === 'home' ? '#b6b9a2' : '#99aaa1'), 3);
        if (id === 'office' || id === 'home') {
            const glow = new THREE.MeshBasicMaterial({ color: '#dfede9', toneMapped: false });
            box(back, [1350, 1150, 25], [-760, 1560, -1608], trim, 8);
            box(back, [1280, 1080, 15], [-760, 1560, -1588], glow);
            for (const x of [-1400, -760, -120]) box(back, [20, 1080, 28], [x, 1560, -1573], trim);
            box(back, [1300, 16, 25], [-760, 1560, -1570], trim);
            // A credenza, books and framed abstract print make the room read
            // as a workplace while leaving the desk silhouette clear.
            box(back, [1150, 560, 370], [980, 330, -1390], material(id === 'home' ? '#98795d' : '#c7cfca'), 8);
            for (const x of [460, 1500]) rod(back, [x, 0, -1280], [x, 80, -1280], 16, trim);
            for (let i = 0; i < 6; i++) box(back, [35, 140 + i % 3 * 25, 105], [550 + i * 45, 610 + (140 + i % 3 * 25) / 2, -1360], material(['#475a55', '#a88767', '#e0d5bd'][i % 3]), 1);
            box(back, [630, 730, 30], [1060, 1500, -1600], trim, 4);
            box(back, [574, 674, 10], [1060, 1500, -1578], material('#b88b6c'));
            sphere(back, [190, 230, 5], [1060, 1520, -1569], material('#d6c6a6'));
            plant(root, [-1400, 0, -700], id === 'home' ? 1150 : 900);
            if (id === 'home') {
                for (let i = 0; i < 12; i++) box(back, [40, 2100, 40], [-1600 + i * 28, 1370, -1540], material('#d2c5b0'), 10);
            }
        } else {
            for (let i = 0; i < 7; i++) {
                const x = -1170 + i * 390;
                box(back, [300, 1250, 65], [x, 1450, -1580], material(i % 2 ? '#272c38' : '#414551'), 10);
                for (let j = 0; j < 4; j++) box(back, [5, 1130, 4], [x - 95 + j * 63, 1450, -1544], material('#4c505a'));
            }
            speaker(root, -1090, -500); speaker(root, 1090, -500);
            const glow = material(id === 'gaming' ? '#92acef' : '#e8be83', { emissive: id === 'gaming' ? '#5d83ee' : '#d9954f', emissiveIntensity: 1.4 });
            box(back, [3150, 12, 14], [0, 420, -1608], glow, 3);
            if (id === 'gaming') {
                for (let i = 0; i < 3; i++) {
                    const bar = box(back, [20, 620, 20], [-700 + i * 600, 1770, -1532], glow, 5);
                    bar.rotation.z = -.45;
                }
            } else {
                // Piano on its own stand: scene dressing, never a cart item.
                const keys = new THREE.Group(); keys.position.set(1270, 850, 730); keys.rotation.y = -.5; root.add(keys);
                box(keys, [890, 80, 280], [0, 0, 0], material('#252b30'), 12);
                for (let i = 0; i < 35; i++) box(keys, [23, 10, 150], [-420 + i * 24, 44, 40], material('#e3e2da'), 1);
                for (let i = 0; i < 34; i++) if (![2, 6].includes(i % 7)) box(keys, [12, 17, 92], [-408 + i * 24, 56, 11], material('#171d25'), 1);
                for (const x of [-320, 320]) rod(keys, [x, -810, 0], [-x, -45, 0], 14, material('#202731'));
            }
        }
    }
    update(camera) { for (const wall of this.walls) wall.obj.visible = camera.position[wall.axis] > wall.limit + .05; }
}
