import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
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
        // Library props are clones that share geometry and materials with the
        // cache in PROP_LIBRARY; only the procedural room geometry is owned here.
        if (obj.userData.sharedProp) return;
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

// Converted props from assets/props (see tools/convert-props.mjs). Each GLB is
// Y-up, in metres, with its origin on the anchor named in the index: floor
// props stand on y=0, ceiling props hang from y=0, wall props have their back
// on z=0 and face +z. Loaded GLBs are cached and cloned; the clones share
// geometry and materials, so they are never disposed with a room.
const PROP_BASE = './assets/props/';
export const PROP_LIBRARY = {
    loader: null, index: null, indexPromise: null, cache: new Map(), failures: new Map(),
    async loadIndex() {
        if (!this.indexPromise) {
            this.indexPromise = fetch(PROP_BASE + 'index.json').then(r => {
                if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
                return r.json();
            }).then(index => { this.index = index; return index; });
        }
        return this.indexPromise;
    },
    entry(id) { return this.index?.props.find(p => p.id === id) || null; },
    load(id) {
        if (!this.cache.has(id)) {
            if (!this.loader) { this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder); }
            const entry = this.entry(id);
            const url = entry ? './' + entry.file : `${PROP_BASE}${id}.glb`;
            this.cache.set(id, new Promise((resolve, reject) => this.loader.load(url, gltf => {
                gltf.scene.traverse(obj => {
                    if (!obj.isMesh) return;
                    obj.castShadow = true; obj.receiveShadow = true;
                    obj.userData.sharedProp = true;
                });
                resolve(gltf.scene);
            }, undefined, err => { this.cache.delete(id); this.failures.set(id, err); reject(err); })));
        }
        return this.cache.get(id);
    },
    // A fresh instance in millimetres, ready to be parented into a room.
    async instance(id) {
        const source = await this.load(id);
        const clone = source.clone(true);
        clone.name = `Prop:${id}`; clone.userData.sharedProp = true; clone.userData.propId = id;
        clone.traverse(obj => { obj.userData.sharedProp = true; });
        clone.scale.setScalar(1000);
        return clone;
    }
};

function markSceneAsset(object, { key, role = 'room', custom = false }) {
    object.userData.sceneAsset = true;
    object.userData.sceneAssetKey = key;
    object.userData.sceneAssetRole = role;
    object.userData.sceneAssetCustom = custom;
    return object;
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
        this.scene = scene; this.items = new Map(); this.mounts = new Map(); this.scale = millimetreScale; this.dressToken = 0;
        for (const [role, name] of [['desktop', 'Desktop_3'], ['shelf', 'Top_Shelf_4']]) {
            const anchor = [...registry.values()].find(e => e.name === name && !e.isClone)?.obj;
            if (!anchor) continue;
            const surface = workingSurface(anchor);
            const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal)
                .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
            const world = new THREE.Matrix4().compose(surface.center, rotation, new THREE.Vector3().setScalar(millimetreScale));
            const group = new THREE.Group(); group.name = `Accessory mount:${role}`; group.matrixAutoUpdate = false; scene.add(group);
            // Scene dressing rides the same surface but stays out of the cart
            // and out of the AR export, so it gets its own group.
            const dress = new THREE.Group(); dress.name = `Scene dressing:${role}`; dress.matrixAutoUpdate = false; scene.add(dress);
            this.mounts.set(role, { anchor, group, dress, relative: anchor.matrixWorld.clone().invert().multiply(world),
                depth: (surface.bounds.max.x - surface.bounds.min.x) / millimetreScale });
        }
        if (model) {
            model.updateWorldMatrix(true, false);
            const world = new THREE.Matrix4().compose(new THREE.Vector3(0, .005, 0),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3().setScalar(millimetreScale));
            const group = new THREE.Group(); group.name = 'Accessory mount:floor'; group.matrixAutoUpdate = false; scene.add(group);
            const dress = new THREE.Group(); dress.name = 'Scene dressing:floor'; dress.matrixAutoUpdate = false; scene.add(dress);
            this.mounts.set('floor', { anchor: model, group, dress, relative: model.matrixWorld.clone().invert().multiply(world) });
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
        for (const { anchor, group, dress, relative } of this.mounts.values()) {
            anchor.updateWorldMatrix(true, false);
            let visible = true;
            for (let p = anchor; p; p = p.parent) if (!p.visible) visible = false;
            for (const target of [group, dress]) {
                if (!target) continue;
                target.matrix.multiplyMatrices(anchor.matrixWorld, relative);
                target.visible = visible; target.updateMatrixWorld(true);
            }
        }
    }
    // Scene dressing on the desk itself: mugs, papers and the like, which
    // follow the desktop as it lifts and tilts. Never priced, never exported
    // to AR, and replaced wholesale when the room changes.
    async dress(sceneId) {
        const scene = ROOM_SCENES.find(s => s.id === sceneId);
        const token = ++this.dressToken;
        for (const mount of this.mounts.values()) {
            if (!mount.dress) continue;
            for (const child of [...mount.dress.children]) disposeTree(child);
        }
        if (!scene || (!scene.desk?.length && !scene.shelf?.length)) return;
        const wanted = [...(scene.desk || []).map(p => ({ ...p, role: 'desktop' })), ...(scene.shelf || []).map(p => ({ ...p, role: 'shelf' }))]
            .map((placement, index) => ({ ...placement, sceneAssetKey: `${scene.id}:${placement.role}:${index}:${placement.id}` }));
        await PROP_LIBRARY.loadIndex();
        const loaded = await Promise.all(wanted.map(async placement => {
            try { return { placement, object: await PROP_LIBRARY.instance(placement.id) }; }
            catch { return { placement, object: null }; }
        }));
        if (token !== this.dressToken) return;
        for (const { placement, object } of loaded) {
            const mount = this.mounts.get(placement.role);
            if (!object || !mount?.dress) continue;
            object.position.set(...placement.at);
            object.rotation.y = THREE.MathUtils.degToRad(placement.turn || 0);
            markSceneAsset(object, { key: placement.sceneAssetKey, role: placement.role });
            mount.dress.add(object);
        }
        this.update();
    }
    dressAssets() {
        return [...this.mounts.values()].flatMap(mount =>
            mount.dress ? mount.dress.children.filter(child => child.userData.sceneAsset) : []);
    }
    objects() { return [...this.items.values()]; }
    exportGroups() { this.update(); return [...this.mounts.values()].map(m => m.group.clone(true)); }
    dispose() {
        this.dressToken++;
        this.mounts.forEach(m => { disposeTree(m.group); if (m.dress) disposeTree(m.dress); });
        this.mounts.clear(); this.items.clear();
    }
}

// Room shells. Each scene picks a palette and one wall treatment; the props
// listed with it are real converted models from assets/props, placed in
// room-local millimetres. Placements describe furniture zones in the original
// shell; roomPosition moves whole zones together, preserving tabletop heights
// and wall attachments while leaving the desk at the origin and at real scale.
const SHELLS = {
    daylight: { wall: '#e0e6df', floor: '#bcb4a1', trim: '#eee9de', rug: '#99aaa1' },
    warm: { wall: '#ded7c8', floor: '#bcb4a1', trim: '#eee9de', rug: '#b6b9a2' },
    studio: { wall: '#363b48', floor: '#55515a', trim: '#252b35', rug: '#343745' },
    loft: { wall: '#e8e4da', floor: '#c2a880', trim: '#f3f0e7', rug: '#b9ab93' },
    lounge: { wall: '#d9cfc2', floor: '#a98f70', trim: '#f0e9dd', rug: '#8f7f6b' },
    kitchen: { wall: '#e9ece9', floor: '#d3cfc4', trim: '#f6f5f1', rug: '#c1c6c0' },
    gym: { wall: '#d6dade', floor: '#4e545a', trim: '#eef1f3', rug: '#3c4248' },
    hangar: { wall: '#2b3340', floor: '#323a47', trim: '#1c232f', rug: '#29303e' },
    bedroom: { wall: '#dcd6d2', floor: '#b39b7f', trim: '#f4f1ec', rug: '#a8a29c' },
    workshop: { wall: '#b9bcbd', floor: '#6f7377', trim: '#d6d9da', rug: '#5b6165' },
    study: { wall: '#c9c2b2', floor: '#8d6f50', trim: '#e7e0d0', rug: '#7d6a55' },
    gallery: { wall: '#eeece8', floor: '#dedbd6', trim: '#ffffff', rug: '#d6d3cd' }
};

// `at` is room-local [x, y, z] in millimetres, `turn` a Y rotation in degrees.
// Wall props hang on a wall face; ceiling props hang from y = 2600.
export const ROOM_SCENES = [
    { id: 'product', name: 'Product', caption: 'A clear view of every detail.', tone: 'slate' },
    { id: 'office', name: 'Office', caption: 'Space for your next big idea.', tone: 'gallery',
      desk: [
        { id: 'nasa-mug', at: [430, 0, 60] },
        { id: 'pen', at: [355, 0, -110], turn: 25 },
        { id: 'clipboard', at: [-430, 0, -120], turn: -14 },
        { id: 'glasses', at: [250, 0, -235], turn: 35 },
        { id: 'papers', at: [-300, 0, -255], turn: -8 },
        { id: 'paper-holder', at: [-480, 0, 120], turn: 8 }
      ],
      shell: 'daylight', feature: 'window', props: [
        { id: 'shelving', at: [1830, 0, -950], turn: -90 },
        { id: 'letter-tray', at: [480, 610, -1390] },
        { id: 'papers-envelopes', at: [1320, 612, -1330], turn: 12 },
        { id: 'office-phone', at: [1560, 610, -1400], turn: -24 },
        { id: 'paper-bin', at: [-1330, 0, 330] },
        { id: 'cardboard-boxes', at: [1560, 0, 1450], turn: -18 },
        { id: 'briefcase', at: [820, 0, 1320], turn: 28 },
        { id: 'water-bottle', at: [700, 610, -1420] },
        { id: 'led-ceiling-light', at: [0, 2600, -250], on: 'ceiling' },
        { id: 'picture-frame', at: [2072, 1500, -700], turn: -90, on: 'wall' }
      ] },
    { id: 'home', name: 'Home office', caption: 'Make yourself at work.', tone: 'warm',
      desk: [
        { id: 'painted-mug', at: [420, 0, 60] },
        { id: 'apple', at: [330, 0, -80] },
        { id: 'table-mirror', at: [-430, 0, 60], turn: -15 },
        { id: 'modern-lamp', at: [480, 0, -250] },
        { id: 'papers', at: [-300, 0, -250], turn: 6 }
      ],
      shelf: [ { id: 'picture-frame', at: [-400, 0, 0], turn: 15 } ],
      shell: 'warm', feature: 'window', slats: true, props: [
        { id: 'sofa', at: [-1560, 0, 1180], turn: 90 },
        { id: 'coffee-table', at: [-560, 0, 1400], turn: 90 },
        { id: 'cat', at: [-540, 391, 1400], turn: 150 },
        { id: 'takeout-boxes', at: [-620, 391, 1250], turn: -20 },
        { id: 'marble-table-lamp', at: [1720, 0, 620], turn: -30 },
        { id: 'backpack', at: [1500, 0, 1350], turn: 35 },
        { id: 'football', at: [-1750, 0, -320] },
        { id: 'picture-frame', at: [2072, 1450, 260], turn: -90, on: 'wall' },
        { id: 'hugo-mirror', at: [2072, 1500, -900], turn: -90, on: 'wall' },
        { id: 'chandelier', at: [-900, 2600, 900], on: 'ceiling' },
        { id: 'cat-sitting', at: [1180, 0, 1600], turn: -140 },
        { id: 'paper-bin', at: [-1250, 0, 260] }
      ] },
    { id: 'music', name: 'Music studio', caption: 'Find your creative frequency.', tone: 'slate',
      desk: [
        { id: 'insulated-mug', at: [430, 0, 40] },
        { id: 'earbuds', at: [330, 0, -70], turn: 20 },
        { id: 'tablet-folder', at: [-420, 0, -60], turn: -10 },
        { id: 'pen', at: [-300, 0, -215], turn: 40 }
      ],
      shell: 'studio', feature: 'panels', piano: true, glow: 'warm', props: [
        { id: 'lava-lamp', at: [-1700, 0, 780] },
        { id: 'wall-lamp', at: [2072, 1650, 500], turn: -90, on: 'wall' },
        { id: 'ottoman', at: [-1400, 0, 1500], turn: 20 },
        { id: 'insulated-mug', at: [-1400, 430, 1500] },
        { id: 'earbuds', at: [-1310, 430, 1580] },
        { id: 'led-wall', at: [-1980, 0, -800], turn: 90 },
        { id: 'skateboard', at: [1870, 0, 1500], turn: -75 }
      ] },
    { id: 'gaming', name: 'Gaming', caption: 'Settle into your next world.', tone: 'slate',
      desk: [
        { id: 'gaming-laptop', at: [-380, 0, 60], turn: 12 },
        { id: 'soda-can', at: [430, 0, 20] },
        { id: 'lego', at: [-300, 0, -250], turn: 25 },
        { id: 'mickey-ears', at: [-470, 0, -230], turn: -20 }
      ],
      shelf: [
        { id: 'sonic-statue', at: [-420, 0, 0], turn: 25 },
        { id: 'spiderman-lego', at: [420, 0, 0], turn: -20 }
      ],
      shell: 'studio', feature: 'panels', bars: true, glow: 'cool', props: [
        { id: 'gaming-pc', at: [1500, 0, -260], turn: -22 },
        { id: 'razer-keyboard', at: [-520, 391, 1420], turn: 90 },
        { id: 'sofa', at: [-1500, 0, 1250], turn: 90 },
        { id: 'coffee-table', at: [-520, 0, 1420], turn: 90 },
        { id: 'soda-can', at: [-470, 391, 1330], turn: 15 },
        { id: 'takeout-boxes', at: [-600, 391, 1480], turn: -35 },
        { id: 'sports-bottle', at: [-420, 391, 1520] },
        { id: 'lava-lamp', at: [1780, 0, 900] },
        { id: 'lego-bricks', at: [1720, 0, 260], turn: -60 },
        { id: 'football', at: [-1800, 0, -200] },
        { id: 'skateboard', at: [-1900, 0, 400], turn: 70 },
        { id: 'led-ceiling-light', at: [0, 2600, -200], on: 'ceiling' },
        { id: 'samsung-neo-tv', at: [-1560, 0, -420], turn: 90 }
      ] },
    { id: 'creative', name: 'Creative studio', caption: 'Room to make a mess of things.', tone: 'gallery',
      desk: [
        { id: 'drawing-tablet', at: [-360, 0, 40], turn: 8 },
        { id: 'apple-pencil', at: [-195, 0, -60], turn: 60 },
        { id: 'metal-ruler', at: [-430, 0, -240], turn: -6 },
        { id: 'painted-mug', at: [430, 0, 40] },
        { id: 'heart-glasses', at: [300, 0, -220], turn: 40 }
      ],
      shell: 'loft', feature: 'window', props: [
        { id: 'easel-bar', at: [-1700, 0, 900], turn: 18 },
        { id: 'canvas', at: [2072, 1350, 900], turn: -90, on: 'wall' },
        { id: 'canvas', at: [-1450, 0, 640], turn: 100 },
        { id: 'shelving', at: [1830, 0, -960], turn: -90 },
        { id: 'printer-3d', at: [1500, 0, 1350], turn: -25 },
        { id: 'ruler-set-square', at: [640, 612, -1400], turn: -15 },
        { id: 'long-scissors', at: [900, 612, -1330], turn: 40 },
        { id: 'paper-bin', at: [-1300, 0, 300] },
        { id: 'tea-cup', at: [400, 610, -1350] },
        { id: 'hanging-led-lamp', at: [-800, 2600, 700], on: 'ceiling' },
        { id: 'papers', at: [1000, 612, -1440], turn: -8 }
      ] },
    { id: 'lounge', name: 'Lounge', caption: 'Clock off without going far.', tone: 'warm',
      desk: [
        { id: 'beer-can', at: [430, 0, 40] },
        { id: 'glasses', at: [300, 0, -180], turn: 30 },
        { id: 'papers', at: [-330, 0, -230], turn: -12 }
      ],
      shell: 'lounge', feature: 'window', props: [
        { id: 'sofa', at: [-1500, 0, 1200], turn: 90 },
        { id: 'coffee-table', at: [-500, 0, 1400], turn: 90 },
        { id: 'glass-of-water', at: [-430, 391, 1320] },
        { id: 'tesla-tequila', at: [-560, 391, 1460], turn: -25 },
        { id: 'ottoman', at: [-1300, 0, -180], turn: 15 },
        { id: 'samsung-oled-tv', at: [1750, 0, 640], turn: -90 },
        { id: 'foosball', at: [1400, 0, 1550], turn: -12 },
        { id: 'table-lamps', at: [-1900, 0, 380], turn: 25 },
        { id: 'oval-mirror', at: [2072, 1400, -560], turn: -90, on: 'wall' },
        { id: 'chandelier', at: [-700, 2600, 950], on: 'ceiling' },
        { id: 'hand-fan', at: [2072, 1700, -1100], turn: -90, on: 'wall' },
        { id: 'coffee-cups', at: [-620, 391, 1240], turn: 40 }
      ] },
    { id: 'kitchen', name: 'Kitchen', caption: 'Work where the coffee lives.', tone: 'gallery',
      desk: [
        { id: 'coffee-cups', at: [400, 0, 40], turn: -20 },
        { id: 'apple', at: [300, 0, -90] },
        { id: 'glass-of-water', at: [-420, 0, 40] }
      ],
      shell: 'kitchen', feature: 'plain', props: [
        { id: 'fridge', at: [1600, 0, -1150], turn: -90 },
        { id: 'cutting-board', at: [-1600, 900, 500], turn: 20 },
        { id: 'knife-set', at: [-1750, 900, 120], turn: 35 },
        { id: 'kitchen-scissors', at: [-1520, 902, 260], turn: -50 },
        { id: 'coffee-cups', at: [-1600, 900, 860], turn: -15 },
        { id: 'takeout-boxes', at: [-1350, 900, 1150], turn: 25 },
        { id: 'apple', at: [-1780, 900, 760] },
        { id: 'orange', at: [-1690, 900, 980], turn: 40 },
        { id: 'soda-can', at: [-1450, 900, 640] },
        { id: 'glass-of-water', at: [-1450, 900, 380] },
        { id: 'led-ceiling-light', at: [-900, 2600, 500], on: 'ceiling' },
        { id: 'trash-basket', at: [1750, 0, 1450], turn: 20 },
        { id: 'water-bottle', at: [1700, 0, -150] }
      ], counter: true },
    { id: 'gym', name: 'Home gym', caption: 'Stand up. Then keep going.', tone: 'gallery',
      desk: [
        { id: 'sports-bottle', at: [430, 0, 40] },
        { id: 'water-bottle', at: [330, 0, -90] },
        { id: 'airtag', at: [-400, 0, -210] }
      ],
      shell: 'gym', feature: 'plain', props: [
        { id: 'full-length-mirror', at: [2072, 0, 400], turn: -90, on: 'wall' },
        { id: 'exercise-equipment', at: [-1500, 0, 1250], turn: 30 },
        { id: 'sports-bottle', at: [-1150, 0, 620] },
        { id: 'water-bottle', at: [-980, 0, 700] },
        { id: 'hemp-protein', at: [1700, 0, -1350] },
        { id: 'beef-protein', at: [1450, 0, -1380], turn: -20 },
        { id: 'football', at: [-1800, 0, -400] },
        { id: 'shelving', at: [1830, 0, -960], turn: -90 },
        { id: 'led-ceiling-light', at: [0, 2600, -200], on: 'ceiling' },
        { id: 'paper-bin', at: [-1250, 0, 200] }
      ] },
    { id: 'scifi', name: 'Sci-fi bay', caption: 'A desk at the edge of known space.', tone: 'slate',
      desk: [
        { id: 'mac-studio', at: [-400, 0, -120], turn: 15 },
        { id: 'magic-mouse', at: [430, 0, 60] },
        { id: 'airtag', at: [-250, 0, -255] }
      ],
      shelf: [ { id: 'curved-monitor', at: [0, 0, 120], turn: 0 } ],
      shell: 'hangar', feature: 'panels', bars: true, glow: 'cool', props: [
        { id: 'led-wall', at: [-1980, 0, -700], turn: 90 },
        { id: 'trash-can-futuristic', at: [1700, 0, 1350], turn: -25 },
        { id: 'recessed-light', at: [-700, 2600, 200], on: 'ceiling' },
        { id: 'recessed-light', at: [700, 2600, 200], on: 'ceiling' },
        { id: 'recessed-light', at: [0, 2600, 1000], on: 'ceiling' },
        { id: 'binoculars', at: [1620, 0, 480], turn: 35 },
        { id: 'lava-lamp', at: [1780, 0, 820] },
        { id: 'led-ceiling-light', at: [700, 2600, 1100], on: 'ceiling' }
      ] }
,
    { id: 'bedroom', name: 'Bedroom', caption: 'Work, then stop working.', tone: 'warm',
      desk: [
        { id: 'table-lamp-plain', at: [-450, 0, -230] },
        { id: 'journal', at: [400, 0, 40], turn: -18 },
        { id: 'wireless-charger', at: [-300, 0, 100], turn: 12 },
        { id: 'virtual-pet', at: [280, 0, -200], turn: 30 },
        { id: 'glasses-3', at: [-180, 0, -250], turn: -25 }
      ],
      shelf: [ { id: 'photo-frame', at: [-380, 0, 0], turn: 18 } ],
      shell: 'bedroom', feature: 'window', slats: true, props: [
        { id: 'bed', at: [-1450, 0, 900], turn: 90 },
        { id: 'dresser', at: [1700, 0, -900], turn: -90 },
        { id: 'table-mirror-2', at: [1700, 780, -900], turn: -90 },
        { id: 'hall-bench', at: [-400, 0, 1750], turn: 0 },
        { id: 'sneaker-1', at: [1500, 0, 1450], turn: 25 },
        { id: 'skate-shoes', at: [1180, 0, 1620], turn: -30 },
        { id: 'backpack-daypack', at: [1750, 0, 900], turn: 40 },
        { id: 'toy-train', at: [-1750, 0, -250], turn: 20 },
        { id: 'comics', at: [-1500, 0, 1750], turn: -15 },
        { id: 'modern-mirror-2', at: [2072, 0, 300], turn: -90, on: 'wall' },
        { id: 'chandelier-2', at: [-600, 2600, 700], on: 'ceiling' },
        { id: 'monstera', at: [1550, 0, 1750], turn: 15 }
      ] },
    { id: 'workshop', name: 'Workshop', caption: 'Somewhere to make the thing.', tone: 'gallery',
      desk: [
        { id: 'multi-tool', at: [400, 0, -60], turn: 20 },
        { id: 'caliper', at: [-380, 0, -180], turn: -35 },
        { id: 'painters-tape', at: [-430, 0, 80] },
        { id: 'walkie-talkie', at: [300, 0, 120], turn: 40 }
      ],
      shell: 'workshop', feature: 'plain', counter: true, props: [
        { id: 'tool-cart', at: [1700, 0, 600], turn: -60 },
        { id: 'toolbox-industrial', at: [1700, 0, 1450], turn: -35 },
        { id: 'shop-machine', at: [1550, 0, -1050], turn: -20 },
        { id: 'impact-wrench', at: [-1600, 900, 100], turn: -25 },
        { id: 'chop-saw', at: [-1550, 900, -600], turn: 75 },
        { id: 'hammer-drill', at: [-1520, 900, 400], turn: 20 },
        { id: 'rubber-mallet', at: [-1600, 900, 750], turn: -40 },
        { id: 'gas-can', at: [1150, 0, 1700], turn: 15 },
        { id: 'pallet', at: [700, 0, 1950], turn: 8 },
        { id: 'work-boot', at: [1200, 0, 1700], turn: -25 },
        { id: 'cork-board', at: [2072, 1500, -400], turn: -90, on: 'wall' },
        { id: 'led-ceiling-light', at: [0, 2600, -150], on: 'ceiling' },
        { id: 'oscilloscope', at: [-1600, 900, -1250], turn: 65 },
        { id: 'toolbox', at: [1450, 0, 1550], turn: 35 }
      ] },
    { id: 'study', name: 'Study', caption: 'Quiet, and full of books.', tone: 'warm',
      desk: [
        { id: 'ink-quill', at: [430, 0, -40] },
        { id: 'antique-book', at: [-400, 0, 20], turn: -12 },
        { id: 'journal', at: [-280, 0, -220], turn: 24 },
        { id: 'calculator', at: [300, 0, -230], turn: -30 },
        { id: 'glasses-3', at: [130, 0, -260], turn: 40 }
      ],
      shelf: [
        { id: 'globe', at: [-400, 0, 20], turn: 20 },
        { id: 'skull', at: [420, 0, 20], turn: -25 }
      ],
      shell: 'study', feature: 'window', props: [
        { id: 'books-cabinet', at: [1780, 0, -700], turn: -90 },
        { id: 'armchair-leather', at: [-1500, 0, 1200], turn: 65 },
        { id: 'bookwheel', at: [-1650, 0, -450], turn: 40 },
        { id: 'iron-safe', at: [1700, 0, 1500], turn: -35 },
        { id: 'carpet-runner', at: [0, 0, 1500], turn: 0 },
        { id: 'the-thinker', at: [1450, 0, 600], turn: -25 },
        { id: 'photo-frames', at: [2072, 1550, 200], turn: -90, on: 'wall' },
        { id: 'retro-light', at: [-1700, 0, 500], turn: 15 },
        { id: 'ficus', at: [-1800, 0, 1750], turn: 0 },
        { id: 'magazines', at: [-1250, 0, 1450], turn: -20 }
      ] },
    { id: 'gallery', name: 'Gallery', caption: 'Put the work on a wall.', tone: 'gallery',
      desk: [
        { id: 'journal', at: [400, 0, 20], turn: -10 },
        { id: 'pen', at: [300, 0, -150], turn: 30 },
        { id: 'glasses-2', at: [-400, 0, -60], turn: -20 },
        { id: 'gold-award', at: [430, 0, -120], turn: -15 }
      ],
      shell: 'gallery', feature: 'plain', props: [
        { id: 'aphrodite', at: [-1600, 0, -500], turn: 20 },
        { id: 'mercury-statue', at: [1650, 0, -600], turn: -30 },
        { id: 'the-thinker', at: [-1500, 0, 1400], turn: 45 },
        { id: 'antique-vase', at: [1700, 0, 1200], turn: 0 },
        { id: 'gallery-poster', at: [2072, 1500, -200], turn: -90, on: 'wall' },
        { id: 'mosaic-art', at: [2072, 1500, 1100], turn: -90, on: 'wall' },
        { id: 'carved-emblem', at: [2072, 1700, -1300], turn: -90, on: 'wall' },
        { id: 'lounge-chair-metal', at: [-300, 0, 1900], turn: 180 },
        { id: 'recessed-light', at: [-900, 2600, -300], on: 'ceiling' },
        { id: 'recessed-light', at: [900, 2600, -300], on: 'ceiling' },
        { id: 'recessed-light', at: [0, 2600, 900], on: 'ceiling' },
      ] }
];

export const ROOM_ATMOSPHERES = {
    product: { label: 'Softbox studio', space: [0, 0, 0], key: '#fff9f0', fill: '#e8f0ff', accent: '#ffffff', power: 1.5, ambient: .35, exposure: .95, bounce: 1.3 },
    office: { label: 'Fresh morning', space: [700, 650, 650], key: '#fff5df', fill: '#dceeff', accent: '#d3f1df', power: 1.8, ambient: .48, exposure: 1.02, bounce: .85 },
    home: { label: 'Late afternoon', space: [1000, 750, 1100], key: '#ffd4a0', fill: '#e4e9ff', accent: '#ffb96f', power: 1.5, ambient: .4, exposure: 1.05, bounce: .7 },
    music: { label: 'Amber sessions', space: [950, 800, 1000], key: '#ffce9c', fill: '#b3bdff', accent: '#ff9454', power: 1.5, ambient: .38, exposure: 1.1, bounce: .75 },
    gaming: { label: 'Violet after hours', space: [1100, 850, 1200], key: '#becaff', fill: '#cb92ff', accent: '#54dfff', power: 1.65, ambient: .36, exposure: 1.1, bounce: .75 },
    creative: { label: 'North light atelier', space: [1050, 900, 1100], key: '#eff6ff', fill: '#ffe0bd', accent: '#f6c99a', power: 1.7, ambient: .55, exposure: 1.08, bounce: .9 },
    lounge: { label: 'Golden hour', space: [1300, 850, 1450], key: '#ffc88e', fill: '#d5c9e7', accent: '#ffad60', power: 1.25, ambient: .32, exposure: 1, bounce: .6 },
    kitchen: { label: 'Bright breakfast', space: [850, 700, 900], key: '#fff6e5', fill: '#d4eff4', accent: '#f5deb5', power: 1.65, ambient: .55, exposure: 1.05, bounce: .9 },
    gym: { label: 'Cool & energized', space: [1350, 900, 1450], key: '#e6f4ff', fill: '#dcffed', accent: '#9cf0bd', power: 1.8, ambient: .45, exposure: 1, bounce: .75 },
    bedroom: { label: 'Soft evening', space: [1100, 800, 1200], key: '#ffd9b5', fill: '#d9dcff', accent: '#ffbe86', power: 1.35, ambient: .4, exposure: 1.04, bounce: .7 },
    workshop: { label: 'Shop fluorescent', space: [1250, 900, 1300], key: '#f2f7ff', fill: '#e8f2ef', accent: '#cfe0ff', power: 1.9, ambient: .5, exposure: 1, bounce: .8 },
    study: { label: 'Reading lamp', space: [1000, 800, 1050], key: '#ffdcae', fill: '#cfd8f0', accent: '#e8a866', power: 1.4, ambient: .38, exposure: 1.05, bounce: .7 },
    gallery: { label: 'Museum wash', space: [1400, 1000, 1500], key: '#fffaf2', fill: '#eef2ff', accent: '#ffffff', power: 1.85, ambient: .6, exposure: 1.02, bounce: 1.1 },
    scifi: { label: 'Orbital blue', space: [1250, 1100, 1250], key: '#c1e7ff', fill: '#7ba4ff', accent: '#60ffe4', power: 1.6, ambient: .35, exposure: 1.1, bounce: .7 }
};

function roomPosition(scene, placement) {
    const [wide, rear, front] = ROOM_ATMOSPHERES[scene.id].space;
    let [x, y, z] = placement.at;
    if (placement.on === 'ceiling') return [x, y + 400, z];
    if (y >= 600 && y < 700 && z < -1200) x = Math.min(x, 1420);
    else if (Math.abs(x) > 1250) x += Math.sign(x) * wide;
    else if (z > 1100) x += Math.sign(x) * wide;
    if (z < -1200 || (Math.abs(placement.at[0]) > 1800 && z < -600)) z -= rear;
    if (z > 1100) z += front;
    return [x, y, z];
}

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
    constructor(scene, millimetreScale) {
        this.scene = scene; this.scale = millimetreScale; this.id = 'product';
        this.root = null; this.walls = []; this.token = 0; this.ready = Promise.resolve();
        this.missingProps = [];
    }
    set(id) {
        if (!ROOM_SCENES.some(s => s.id === id)) id = 'product';
        // Any prop load still in flight belongs to the room being replaced.
        this.token++;
        if (this.root) disposeTree(this.root);
        this.id = id; this.root = null; this.walls = []; this.missingProps = [];
        if (id === 'product') { this.ready = Promise.resolve(); return; }
        const scene = ROOM_SCENES.find(s => s.id === id);
        const root = this.root = new THREE.Group(); root.name = `Room:${id}`;
        root.rotation.y = Math.PI / 2; root.scale.setScalar(this.scale); this.scene.add(root);
        this.buildShell(root, scene);
        this.ready = this.addProps(root, scene, this.token);
    }
    ensureAssetRoot() {
        if (this.root) return this.root;
        const root = this.root = new THREE.Group();
        root.name = `Scene assets:${this.id}`;
        root.rotation.y = Math.PI / 2;
        root.scale.setScalar(this.scale);
        this.scene.add(root);
        return root;
    }
    buildShell(root, scene) {
        const palette = SHELLS[scene.shell] || SHELLS.daylight;
        const atmosphere = ROOM_ATMOSPHERES[scene.id];
        const [wide, rear, front] = atmosphere.space;
        const width = 4200 + wide * 2, depth = 4000 + rear + front;
        const wall = material(palette.wall), floor = material(palette.floor), trim = material(palette.trim);
        box(root, [width, 24, depth], [0, -18, 200 + (front - rear) / 2], floor, 6);
        // Open-front room with walls that disappear when orbiting behind them.
        const back = new THREE.Group(); root.add(back);
        back.position.z = -rear;
        box(back, [width, 3000, 50], [0, 1500, -1650], wall);
        box(back, [width, 65, 22], [0, 32, -1617], trim);
        this.walls.push({ obj: back, axis: 'x', limit: (-1650 - rear) * this.scale });
        const side = new THREE.Group(); root.add(side);
        side.position.x = wide;
        box(side, [50, 3000, depth - 200], [2100, 1500, 200 + (front - rear) / 2], wall);
        this.walls.push({ obj: side, axis: 'z', limit: (-2100 - wide) * this.scale });
        box(root, [2600, 8, 2400], [0, -1, 150], material(palette.rug), 3);
        // Secondary zones give the larger footprint a purpose and a clear aisle.
        if (['home', 'gaming', 'lounge'].includes(scene.id)) {
            box(root, [2700, 7, 2100], [-950 - wide, -2, 1300 + front], material(palette.trim), 10);
        }
        if (scene.id === 'creative') {
            for (let i = 0; i < 4; i++) box(back, [35, 3000, 90], [-2500 + i * 1650, 1500, -1580], material('#8f8172'));
        }
        if (scene.id === 'office') {
            for (let i = 0; i < 4; i++) box(side, [22, 1100, 650], [2063, 1750, -1100 + i * 850], material('#b5c6be'), 6);
        }
        if (scene.id === 'home' || scene.id === 'lounge') {
            const timber = material(scene.id === 'home' ? '#b8a084' : '#79624d');
            box(side, [24, 800, depth - 200], [2062, 400, 200 + (front - rear) / 2], timber);
            box(side, [40, 35, depth - 200], [2050, 815, 200 + (front - rear) / 2], trim, 4);
        }
        if (scene.id === 'gym') {
            box(root, [2200, 10, 2500], [-1500 - wide, 0, 1250 + front], material('#293f3c'), 8);
            for (let i = 0; i < 3; i++) box(back, [width, 45, 14], [0, 900 + i * 160, -1615], material('#739b88'));
        }
        if (scene.id === 'kitchen') {
            for (let i = 0; i < 12; i++) box(back, [400, 360, 18], [-2400 + i * 430, 1350, -1615], material(i % 2 ? '#b0c7bf' : '#cedbd0'), 3);
        }
        if (scene.id === 'scifi') {
            const glow = material('#88e8e0', { emissive: '#49cdbd', emissiveIntensity: 1.5 });
            for (const x of [-1800, 1800]) {
                box(root, [18, 8, depth - 500], [x, 0, 200 + (front - rear) / 2], glow);
                box(back, [100, 2800, 180], [x, 1400, -1550], trim);
            }
        }
        if (scene.feature === 'window') {
            const glow = new THREE.MeshBasicMaterial({ color: atmosphere.key, toneMapped: false });
            box(back, [1350, 1150, 25], [-760, 1560, -1608], trim, 8);
            box(back, [1280, 1080, 15], [-760, 1560, -1588], glow);
            for (const x of [-1400, -760, -120]) box(back, [20, 1080, 28], [x, 1560, -1573], trim);
            box(back, [1300, 16, 25], [-760, 1560, -1570], trim);
            // A credenza, books and framed abstract print make the room read
            // as a workplace while leaving the desk silhouette clear.
            box(back, [1150, 560, 370], [980, 330, -1390], material(scene.shell === 'daylight' ? '#c7cfca' : '#98795d'), 8);
            for (const x of [460, 1500]) rod(back, [x, 0, -1280], [x, 80, -1280], 16, trim);
            for (let i = 0; i < 6; i++) box(back, [35, 140 + i % 3 * 25, 105], [550 + i * 45, 610 + (140 + i % 3 * 25) / 2, -1360], material(['#475a55', '#a88767', '#e0d5bd'][i % 3]), 1);
            box(back, [630, 730, 30], [1060, 1500, -1600], trim, 4);
            box(back, [574, 674, 10], [1060, 1500, -1578], material('#b88b6c'));
            sphere(back, [190, 230, 5], [1060, 1520, -1569], material('#d6c6a6'));
            plant(root, [-1400 - wide, 0, -700 - rear], scene.id === 'home' ? 1150 : 900);
            if (scene.slats) for (let i = 0; i < 12; i++) box(back, [40, 2100, 40], [-1600 + i * 28, 1370, -1540], material('#d2c5b0'), 10);
        } else if (scene.feature === 'panels') {
            for (let i = 0; i < 7; i++) {
                const x = -1170 + i * 390;
                box(back, [300, scene.id === 'gaming' ? 850 : 1250, 65], [x, scene.id === 'gaming' ? 1250 + (i % 2) * 300 : 1450, -1580], material(scene.id === 'music' ? (i % 2 ? '#49382f' : '#635046') : (i % 2 ? '#272c38' : '#414551')), 10);
                for (let j = 0; j < 4; j++) box(back, [5, 1130, 4], [x - 95 + j * 63, 1450, -1544], material('#4c505a'));
            }
            if (scene.id !== 'scifi') { speaker(root, -1500, -850); speaker(root, 1500, -850); }
            const cool = scene.glow === 'cool';
            const glow = material(cool ? '#92acef' : '#e8be83', { emissive: cool ? '#5d83ee' : '#d9954f', emissiveIntensity: 1.4 });
            box(back, [3150, 12, 14], [0, 420, -1608], glow, 3);
            if (scene.bars) for (let i = 0; i < 3; i++) {
                const bar = box(back, [20, 620, 20], [-700 + i * 600, 1770, -1532], glow, 5);
                bar.rotation.z = -.45;
            }
            if (scene.piano) {
                // Piano on its own stand: scene dressing, never a cart item.
                const keys = new THREE.Group(); keys.position.set(1270 + wide, 850, 730); keys.rotation.y = -.5; root.add(keys);
                box(keys, [890, 80, 280], [0, 0, 0], material('#252b30'), 12);
                for (let i = 0; i < 35; i++) box(keys, [23, 10, 150], [-420 + i * 24, 44, 40], material('#e3e2da'), 1);
                for (let i = 0; i < 34; i++) if (![2, 6].includes(i % 7)) box(keys, [12, 17, 92], [-408 + i * 24, 56, 11], material('#171d25'), 1);
                for (const x of [-320, 320]) rod(keys, [x, -810, 0], [-x, -45, 0], 14, material('#202731'));
            }
        }
        // A run of counter along the open left-hand side, for scenes whose props
        // belong at working height rather than on the floor.
        if (scene.counter) {
            const counter = new THREE.Group(); counter.position.x = -wide; root.add(counter);
            const carcass = material('#cfd3d0'), top = material('#8d9490', { roughness: .35 });
            box(counter, [700, 880, 2600], [-1650, 440, 380], carcass, 6);
            box(counter, [760, 40, 2700], [-1650, 900, 380], top, 4);
            for (const z of [-620, 200, 1020]) box(counter, [20, 700, 780], [-1298, 500, z], material('#b9beba'), 3);
        }
    }
    // Props load over the network, so a room can be replaced mid-flight: every
    // instance is checked against the token for the room that requested it.
    async addProps(root, scene, token) {
        if (!scene.props?.length) return;
        try { await PROP_LIBRARY.loadIndex(); }
        catch (error) { this.missingProps = scene.props.map(p => p.id); throw new Error(`prop index unavailable: ${error.message}`); }
        const placements = await Promise.all(scene.props.map(async (placement, index) => {
            try { return { placement, object: await PROP_LIBRARY.instance(placement.id) }; }
            catch { return { placement, object: null }; }
        }));
        if (token !== this.token) return;
        for (let index = 0; index < placements.length; index++) {
            const { placement, object } = placements[index];
            if (!object) { this.missingProps.push(placement.id); continue; }
            const position = roomPosition(scene, placement);
            // Countertop objects travel with the complete counter, not the lounge zone.
            if (scene.counter && placement.at[1] >= 900 && placement.on !== 'ceiling') position[2] = placement.at[2];
            object.position.set(...position);
            object.rotation.y = THREE.MathUtils.degToRad(placement.turn || 0);
            if (placement.scale) object.scale.multiplyScalar(placement.scale);
            markSceneAsset(object, { key: `${scene.id}:room:${index}:${placement.id}` });
            root.add(object);
        }
        if (this.missingProps.length) console.warn(`Room ${scene.id}: props unavailable: ${this.missingProps.join(', ')}`);
    }
    assets() {
        return this.root ? this.root.children.filter(child => child.userData.sceneAsset) : [];
    }
    async addAsset(propId, key, position = [0, 0, 800]) {
        const token = this.token;
        await PROP_LIBRARY.loadIndex();
        const object = await PROP_LIBRARY.instance(propId);
        if (token !== this.token) return null;
        object.position.set(...position);
        markSceneAsset(object, { key, custom: true });
        this.ensureAssetRoot().add(object);
        return object;
    }
    update(camera) { for (const wall of this.walls) wall.obj.visible = camera.position[wall.axis] > wall.limit + .05; }
}
