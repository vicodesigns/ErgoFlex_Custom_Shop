import { INSTITUTIONAL_ROOMS, INSTITUTIONAL_IDS, institutionalLayout, institutionalModule } from './institutional-scenes.mjs?v=scene-desk-styling-20261010';
import { buildInstitutionalRoom } from './institutional-room.mjs?v=scene-desk-styling-20261010';
import { refineRoomSurfaces } from './room-refinement.mjs?v=scene-desk-styling-20261010';
import { polishRoomProp } from './room-polish.mjs?v=scene-desk-styling-20261010';
import { RoomLife } from './room-life.mjs?v=scene-desk-styling-20261010';
import { createDailyDeskKit, createDeskNotebook, placeDailyDeskKit } from './room-desk-details.mjs?v=scene-desk-styling-20261010';
import { buildLibraryRoom, libraryLayoutForSize, libraryLayoutById } from './library-room.mjs?v=library-window-20261011';
import { buildCoworkingRoom, coworkingLayoutForSize, coworkingLayoutById } from './coworking-room.mjs?v=groove-routines-20261002';
import { buildScifiRoom, scifiLayoutForSize, scifiLayoutById } from './scifi-room.mjs?v=groove-routines-20261002';
import { buildGalleryRoom, galleryLayoutForSize, galleryLayoutById } from './gallery-room.mjs?v=groove-routines-20261002';
import { buildBedroomRoom, bedroomLayoutForSize, bedroomLayoutById } from './bedroom-room.mjs?v=groove-routines-20261002';
import { buildWorkshopRoom, workshopLayoutForSize, workshopLayoutById } from './workshop-room.mjs?v=groove-routines-20261002';
import * as THREE from 'three';
import { RoomBounceLight } from './room-bounce-light.mjs?v=ceiling-bounce-20261011';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ACCESSORIES, accessory } from './catalog.mjs?v=preset-size-setups-20261012';
import { buildHomeOffice, homeLayoutForSize, homeLayoutById, HOME_MODES } from './home-office.mjs?v=scene-desk-styling-20261010';
import { buildGamingRoom, gamingLayoutForSize, gamingLayoutById } from './gaming-room.mjs?v=curved-pair-20261012';
import { buildMusicRoom, musicLayoutForSize, musicLayoutById, createMusicKeyboard } from './music-room.mjs?v=curved-pair-20261012';
import { buildArtistRoom, artistLayoutForSize, artistLayoutById } from './artist-room.mjs?v=curved-pair-20261012';
import { buildStudyRoom, studyLayoutForSize, studyLayoutById } from './study-room.mjs?v=scene-desk-styling-20261010';

import { buildOfficeRoom, officeLayoutForSize, officeLayoutById } from './office-room.mjs?v=curved-pair-20261012';
import { buildGymRoom, gymLayoutForSize, gymLayoutById } from './gym-room.mjs?v=groove-routines-20261002';
import { buildKitchenRoom, kitchenLayoutForSize, kitchenLayoutById } from './kitchen-room.mjs?v=groove-routines-20261002';
import { buildLoungeRoom, loungeLayoutForSize, loungeLayoutById } from './lounge-room.mjs?v=groove-routines-20261002';

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
        obj.ownedTextures?.forEach(t=>textures.add(t));
        // Library props are clones that share geometry and materials with the
        // cache in PROP_LIBRARY; only the procedural room geometry is owned here.
        if (obj.userData.sharedProp) { obj.ownedMaterials?.forEach(m => materials.add(m)); return; }
        if (obj.isInstancedMesh) obj.dispose();
        if (obj.geometry) geometries.add(obj.geometry);
        for (const m of [...(Array.isArray(obj.material) ? obj.material : [obj.material]), ...(obj.replacedMaterials || [])]) {
            if (!m) continue;
            materials.add(m);
            if (!m.userData.sharedTextures) for (const value of Object.values(m)) {
                if (value?.isTexture) textures.add(value);
            }
        }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    root.removeFromParent();
}
export const disposeWorkspaceObject = disposeTree;

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
            this.indexPromise = fetch(PROP_BASE + 'index.json?v=obsbot-tiny-2-20261012').then(r => {
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
            const url = entry ? './' + entry.file + (entry.revision ? '?v=' + encodeURIComponent(entry.revision) : '') : `${PROP_BASE}${id}.glb`;
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
        if (id === 'ergoflex-painter-shelf') clone.traverse(obj => {
            if (!obj.isMesh) return;
            const materials = [].concat(obj.material).map(m => {
                if (m.name !== 'Artist shelf wood' && m.name !== 'Artist clear acrylic') return m;
                const owned = m.name === 'Artist shelf wood' ? new THREE.MeshPhysicalMaterial({ color: m.color, roughness: m.roughness }) : m.clone(); owned.userData.sharedTextures = true;
                obj.ownedMaterials ||= []; obj.ownedMaterials.push(owned);
                if (m.name === 'Artist shelf wood') obj.userData.artistShelfWood = true;
                else { owned.thickness = .0025; owned.ior = 1.49; owned.depthWrite = false; owned.side = THREE.DoubleSide; }
                return owned;
            });
            obj.material = Array.isArray(obj.material) ? materials : materials[0];
        });
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

function screenTexture({ border = false } = {}) {
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
    if (border) { c.strokeStyle = '#10171c'; c.lineWidth = 28; c.strokeRect(0, 0, 1024, 576); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

// Compact cloth pad rides with its mouse, including saved tray placements.
function addMousePad(root) {
    if (root.getObjectByName('Mouse pad')) return;
    for (const child of root.children) child.position.y += 3;
    const pad = new THREE.Group(); pad.name = 'Mouse pad';
    pad.rotation.y = Math.PI / 2;
    root.add(pad);
    box(pad, [140, .6, 180], [0, .3, 0], material('#171a1d', { roughness: .95 }), .28);
    box(pad, [138, 2.4, 178], [0, 1.8, 0], material('#20252a', { roughness: 1 }), 1.15);
    // A fine stitched edge keeps the pad legible against the graphite tray.
    const edge = new THREE.Shape();
    edge.moveTo(-60, -82); edge.lineTo(60, -82);
    edge.quadraticCurveTo(66, -82, 66, -76); edge.lineTo(66, 76);
    edge.quadraticCurveTo(66, 82, 60, 82); edge.lineTo(-60, 82);
    edge.quadraticCurveTo(-66, 82, -66, 76); edge.lineTo(-66, -76);
    edge.quadraticCurveTo(-66, -82, -60, -82);
    const points = edge.getPoints(64).map(p => new THREE.Vector3(p.x, 3.02, p.y));
    const stitches = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: '#454c53', dashSize: 2, gapSize: 2, transparent: true, opacity: .6 }));
    stitches.computeLineDistances(); pad.add(stitches);
}

export function createAccessory(item) {
    const root = new THREE.Group(); root.name = `Accessory:${item.id}`;
    root.userData.accessoryId = item.id;
    if (item.propId) return root; // The supplied GLB is populated asynchronously.
    const dark = material('#262e33'), soft = material('#555b5d'), silver = material('#bbc1c1', { metalness: .7, roughness: .32 });
    const type = item.visual;
    if (type === 'drafting-kit') {
        const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f2eee3'; ctx.fillRect(0, 0, 1600, 1000);
        ctx.strokeStyle = '#d6d9d4'; ctx.lineWidth = 1;
        for (let x = 40; x < 1600; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 960); ctx.stroke(); }
        for (let y = 40; y < 1000; y += 40) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(1560, y); ctx.stroke(); }
        ctx.strokeStyle = '#355b68'; ctx.lineWidth = 8; ctx.strokeRect(220, 200, 1040, 540);
        ctx.lineWidth = 5;
        for (const [x,y,w,h] of [[230,210,390,250],[230,480,390,250],[640,210,610,250],[640,480,290,250],[950,480,300,250]]) ctx.strokeRect(x,y,w,h);
        ctx.lineWidth = 2; ctx.strokeRect(180,160,1120,620);
        ctx.font = '24px sans-serif'; ctx.fillStyle = '#355b68';
        for (const [text,x,y] of [['STUDIO',360,335],['LIBRARY',360,615],['MEETING / PROJECT SPACE',760,335],['ENTRY',1000,615],['SERVICES',680,615]]) ctx.fillText(text,x,y);
        ctx.beginPath(); ctx.arc(640,480,80,-Math.PI/2,0); ctx.stroke();
        ctx.font = '22px monospace'; ctx.fillText('N ↑',1390,160); ctx.fillText('WORKSPACE STUDY  /  FLOOR PLAN',110,875); ctx.fillText('A-101   ·   1:100   ·   CONCEPT DESIGN',110,925);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        box(root, [920, 10, 600], [0, 5, 0], material('#d4c6b0'), 5);
        const sheet = mesh(root, new THREE.PlaneGeometry(850, 531.25), material('#ffffff', { map: texture, roughness: .9 }), [0, 10.2, 0]); sheet.rotation.x = -Math.PI / 2; sheet.name = 'Architect floor plan';
        box(root, [920, 12, 10], [0, 11, 296], material('#bcae94'), 2);
        box(root, [910, 5, 30], [0, 15, 235], silver, 2);
        for (let i = 0; i < 44; i++) box(root, [1, .3, i % 5 ? 7 : 14], [-430 + i * 20, 17.7, 230], dark);
        const triangle = new THREE.Shape(); triangle.moveTo(0,0); triangle.lineTo(140,0); triangle.lineTo(0,140); triangle.closePath();
        const square = mesh(root, new THREE.ShapeGeometry(triangle), new THREE.MeshPhysicalMaterial({ color: '#bcd4d4', transparent: true, opacity: .45, transmission: .5, roughness: .15, side: THREE.DoubleSide }), [225, 12, 80]); square.rotation.x = -Math.PI/2;
        for (let i = 0; i < 3; i++) { const pen = rod(root, [-380+i*22,14,-120],[-380+i*22,14,45], 3, material(i===2?'#b5996d':'#36454c')); pen.name = 'Drafting pencil'; }
    } else if (type === 'monitor') {
        const stand = new THREE.Group(); stand.name = 'monitor-stand'; root.add(stand);
        box(stand, [235, 8, 192.28], [0, 4, 0], silver, 3);
        box(stand, [42, 230, 32], [0, 119, -35], silver, 5);
        const panel = new THREE.Group(); panel.name = 'monitor-panel'; root.add(panel);
        // Slim enclosure with a shallow central electronics housing.
        box(panel, [612.24, 352.51, 16], [0, 273.745, -8], dark, 3);
        box(panel, [210, 150, 8], [0, 273.745, -20], dark, 3);
        root.userData.displayMount = new THREE.Vector3(0, 273.745, -24);
        box(panel, [608, 349, 5], [0, 273.745, 2], dark, 2);
        const display = material('#060709', { roughness: .2 });
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
    } else if (type === 'mx-master') {
        // Original reference geometry, based on Logitech's 84.3 × 124.9 × 51 mm
        // envelope. X is user-right; the buttons and USB port face negative Z.
        const rubber = material('#343638', { roughness: .88 });
        const shell = material('#414345', { roughness: .54 });
        const seam = material('#191b1c');
        sphere(root, [42.15, 3, 62.45], [0, 3, 0], seam);
        sphere(root, [19, 5, 39], [-23, 7, 13], rubber);
        const hump = mesh(root, new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), rubber, [7, 6, 0]);
        hump.scale.set(35, 45, 62.45);
        for (const [x, y] of [[-7, 41], [20, 38]]) {
            const button = box(root, [25, 5, 43], [x, y, -32], shell, 2);
            button.rotation.x = .27;
        }
        const wheel = mesh(root, new THREE.CylinderGeometry(8, 8, 9, 32), silver, [6, 43, -32]);
        wheel.rotation.z = Math.PI / 2;
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8;
            const ridge = box(root, [9.5, .7, .7], [6, 43 + Math.cos(a) * 8, -32 + Math.sin(a) * 8], soft, .2);
            ridge.rotation.x = -a;
        }
        box(root, [8, 2, 10], [6, 49, -11], shell, 2);
        const thumbWheel = mesh(root, new THREE.CylinderGeometry(5, 5, 17, 24), silver, [-27, 27, -19]);
        thumbWheel.rotation.x = Math.PI / 2;
        for (const z of [2, 18]) box(root, [3, 4, 12], [-30, 18, z], shell, 1);
        box(root, [7, 3, 1], [6, 8, -62], seam, 1);
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
        // Padded C-clamp grips the rear edge instead of a loose weighted base.
        const clamp = new THREE.Group(); clamp.name = 'Padded desktop edge clamp'; root.add(clamp);
        const steel = material('#454b51', { metalness: .8, roughness: .36 });
        const rubber = material('#1c2023', { roughness: .98 });
        box(clamp, [62, 4, 48], [0, 3, 19], steel, 1.8);
        box(clamp, [62, 2, 40], [0, 0, 21], rubber, .9);
        box(clamp, [62, 44, 10], [0, -17, -9], steel, 3);
        box(clamp, [62, 5, 48], [0, -39, 10], steel, 2);
        rod(clamp, [0, -46, 23], [0, -21, 23], 4, silver);
        mesh(clamp, new THREE.CylinderGeometry(17, 17, 3, 24), rubber, [0, -20, 23]);
        box(clamp, [36, 8, 14], [0, -47, 23], dark, 3);
        mesh(clamp, new THREE.CylinderGeometry(16, 19, 12, 24), steel, [0, 11, 14]);
        rod(root, [0, 15, 14], [0, 240, -45], 9, dark);
        rod(root, [0, 240, -45], [0, 395, 100], 8, dark);
        sphere(root, [15, 15, 15], [0, 240, -45], silver);
        box(root, [170, 13, 48], [0, 391, 100], dark, 6);
        const diffuser = box(root, [153, 2, 32], [0, 383, 100],
            material('#fff5df', { emissive: '#fff0ce', emissiveIntensity: 3, toneMapped: false }));
        diffuser.name = 'Clamp light luminous diffuser';
        // A local halo follows the lamp through tilt and object edits. It adds
        // no scene lights, keeping multi-desk rooms within the lighting budget.
        const haloSheet = document.createElement('canvas'); haloSheet.width = haloSheet.height = 128;
        const c = haloSheet.getContext('2d'), gradient = c.createRadialGradient(64,64,8,64,64,64);
        gradient.addColorStop(0,'rgba(255,245,218,.65)');
        gradient.addColorStop(.45,'rgba(255,237,194,.25)');
        gradient.addColorStop(1,'rgba(255,237,194,0)');
        c.fillStyle=gradient;c.fillRect(0,0,128,128);
        const haloMap=new THREE.CanvasTexture(haloSheet);haloMap.colorSpace=THREE.SRGBColorSpace;
        const halo=mesh(root,new THREE.PlaneGeometry(235,86),new THREE.MeshBasicMaterial({
            map:haloMap,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,
            depthWrite:false,toneMapped:false,side:THREE.DoubleSide
        }),[0,381.8,100]);
        halo.name='Clamp light soft glow';halo.rotation.x=-Math.PI/2;
        halo.castShadow=false;halo.receiveShadow=false;halo.ownedTextures=[haloMap];
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
    if (item.exclusiveGroup === 'mouse') addMousePad(root);
    // Unused palette materials have no GPU allocation; everything actually
    // assigned to a mesh is disposed with its owning product.
    return root;
}

function prepareArtistPainting(root) {
    const canvas = root.getObjectByName('Mesh_5');
    if (!canvas?.isMesh) return;
    root.updateWorldMatrix(true, true);
    const backing=root.getObjectByName('Mesh_0'), lip=root.getObjectByName('Mesh_1'), rail=root.getObjectByName('Mesh_2');
    if (backing?.isMesh && lip?.isMesh && rail?.isMesh) {
        const inverse=root.matrixWorld.clone().invert();
        const boundsInRoot=obj=>{
            obj.geometry.computeBoundingBox();
            return obj.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
        };
        const board=boundsInRoot(backing), ledge=boundsInRoot(lip), bar=boundsInRoot(rail);
        // The supplied board height already fits beneath the retaining flange,
        // but its lower edge was too far forward. Tuck that edge against the
        // bar face, behind the beige lip. Only internal parts move; saved
        // accessory poses and scales stay valid.
        const delta=new THREE.Vector3(
            (ledge.min.x+ledge.max.x-board.min.x-board.max.x)/2,
            0,
            bar.max.z-board.min.z
        );
        for (const part of [backing,canvas]) {
            const toParent=part.parent.matrixWorld.clone().invert().multiply(root.matrixWorld);
            part.position.add(delta.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(toParent)));
        }
        root.updateWorldMatrix(true,true);
    }
    const toRoot = root.matrixWorld.clone().invert().multiply(canvas.matrixWorld);
    const geometry = canvas.geometry.clone(), position = geometry.attributes.position;
    geometry.computeBoundingBox(); const bounds = geometry.boundingBox.clone().applyMatrix4(toRoot);
    const uv = new Float32Array(position.count * 2), point = new THREE.Vector3();
    for (let i=0;i<position.count;i++) {
        point.fromBufferAttribute(position,i).applyMatrix4(toRoot);
        uv[i*2]=(point.x-bounds.min.x)/(bounds.max.x-bounds.min.x);
        uv[i*2+1]=(point.z-bounds.min.z)/(bounds.max.z-bounds.min.z);
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2)); canvas.geometry=geometry; canvas.userData.sharedProp=false;
    const sheet=document.createElement('canvas'); sheet.width=1600;sheet.height=Math.round(1600*(bounds.max.z-bounds.min.z)/(bounds.max.x-bounds.min.x));
    const ctx=sheet.getContext('2d');ctx.fillStyle='#f6f3eb';ctx.fillRect(0,0,sheet.width,sheet.height);
    const texture=new THREE.CanvasTexture(sheet);texture.colorSpace=THREE.SRGBColorSpace;
    new THREE.TextureLoader().load('assets/artwork/artist-painting.jpg',source=>{
        const image=source.image,scale=Math.max(sheet.width/image.width,sheet.height/image.height);
        ctx.drawImage(image,(sheet.width-image.width*scale)/2,(sheet.height-image.height*scale)/2,image.width*scale,image.height*scale);texture.needsUpdate=true;source.dispose();
    });
    canvas.material=material('#ffffff',{map:texture,roughness:.88}); canvas.name='Artist painting';
    canvas.paintingTexture=texture;canvas.ownedTextures=[texture];
}

function prepareShelfOrganizer(root) {
    root.updateWorldMatrix(true,true);
    const inverse=root.matrixWorld.clone().invert(), bounds=new THREE.Box3();
    const meshes=[];
    root.traverse(obj=>{if(obj.isMesh){meshes.push(obj);obj.geometry.computeBoundingBox();bounds.union(obj.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(obj.matrixWorld)));}});
    for(const obj of meshes){
        const geometry=obj.geometry,positions=geometry.attributes.position,index=geometry.index;
        const transform=inverse.clone().multiply(obj.matrixWorld),shell=[],dividers=[];
        const black=[].concat(obj.material).every(m=>Math.max(m.color.r,m.color.g,m.color.b)<.01);
        const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
        const count=index?index.count:positions.count;
        for(let i=0;i<count;i+=3){
            const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
            a.fromBufferAttribute(positions,ids[0]).applyMatrix4(transform);b.fromBufferAttribute(positions,ids[1]).applyMatrix4(transform);c.fromBufferAttribute(positions,ids[2]).applyMatrix4(transform);
            const zs=[a.z,b.z,c.z],ys=[a.y,b.y,c.y];
            // The three long dividers share the box material in the joined
            // CAD export. Separate their thin interior plates, retaining the
            // outer walls, compartment floors and mounting hooks as wood.
            const internal=Math.max(...zs)-Math.min(...zs)<10 && Math.min(...zs)>bounds.min.z+85 && Math.max(...zs)<bounds.max.z-30 && Math.min(...ys)>bounds.min.y+10;
            (black||internal?dividers:shell).push(...ids);
        }
        const make=(indices,acrylic)=>{
            if(!indices.length)return;
            const mesh=obj.clone(false);mesh.geometry=geometry.clone();mesh.geometry.setIndex(indices);mesh.userData={sharedProp:false};
            if(acrylic){mesh.name='Organizer clear acrylic dividers';mesh.material=new THREE.MeshPhysicalMaterial({color:'#f0f8ff',roughness:.08,transmission:.94,thickness:.005,ior:1.49,depthWrite:false,side:THREE.DoubleSide});mesh.castShadow=false;}
            else{
                mesh.name='Organizer desk finish';mesh.material=new THREE.MeshPhysicalMaterial({color:'#f4ead8',roughness:.5});mesh.userData.artistShelfWood=true;
                const uv=new Float32Array(positions.count*2);
                for(let i=0;i<positions.count;i++){a.fromBufferAttribute(positions,i).applyMatrix4(transform);uv[i*2]=a.x/500;uv[i*2+1]=a.z/500;}
                mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
            }
            obj.parent.add(mesh);
        };
        make(shell,false);make(dividers,true);obj.removeFromParent();
    }
}

function prepareSuppliedDisplay(root, id) {
    const panel = root.getObjectByName(`Prop:${id}`);
    if (!panel) return;
    // Displays start with dark glass; shared media temporarily overlays them.
    const screen = panel.getObjectByName('monitor-screen');
    if (screen) {
        screen.material = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: .2, metalness: .1 });
        screen.userData.sharedProp = false;
    }
    const texture = screenTexture({ border: true });
    panel.traverse(object => {
        if (!object.isMesh || ![].concat(object.material).some(m => m.name === 'Material_003_#1')) return;
        const geometry = object.geometry.clone(); geometry.computeBoundingBox();
        const bounds = geometry.boundingBox, position = geometry.attributes.position;
        const uv = new Float32Array(position.count * 2);
        for (let i = 0; i < position.count; i++) {
            uv[i * 2] = (position.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x);
            uv[i * 2 + 1] = (position.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y);
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        // Some CAD primitives combine the screen and its back into one
        // material. Texture the user-facing triangles only, not the enclosure.
        geometry.clearGroups();
        const index = geometry.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
        const count = index ? index.count : position.count;
        const frontFaces = [], backFaces = [];
        for (let i = 0; i < count; i += 3) {
            a.fromBufferAttribute(position, index ? index.getX(i) : i);
            b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
            c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
            normal.crossVectors(b.sub(a), c.sub(a)).normalize();
            const faces = normal.z > .5 ? frontFaces : backFaces;
            faces.push(index ? index.getX(i) : i, index ? index.getX(i + 1) : i + 1, index ? index.getX(i + 2) : i + 2);
        }
        geometry.setIndex(frontFaces.concat(backFaces));
        if (frontFaces.length) geometry.addGroup(0, frontFaces.length, 0);
        if (backFaces.length) geometry.addGroup(frontFaces.length, backFaces.length, 1);
        object.geometry = geometry; object.material = [new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), material('#222b33', { roughness: .5 })];
        object.userData.sharedProp = false;
    });
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), bounds = new THREE.Box3();
    panel.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        bounds.union(object.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)));
    });
    // Conversion bakes and joins mesh transforms, so a named VESA mesh's
    // node origin is not its mounting point. Use its authored normalized point.
    const authoredMount=PROP_LIBRARY.entry(id)?.displayMountMm;
    root.userData.displayMount=authoredMount?new THREE.Vector3(...authoredMount):bounds.getCenter(new THREE.Vector3());
    if(!authoredMount)root.userData.displayMount.z=bounds.min.z;
    const stand = new THREE.Group(); stand.name = 'monitor-stand'; root.add(stand);
    const silver = material('#535d65', { metalness: .65, roughness: .35 });
    box(stand, [220, 8, 170], [0, 4, -12], silver, 4);
    box(stand, [38, 135, 30], [0, 71, -48], silver, 3);
}

function prepareSuppliedArm(root, id) {
    const model = root.getObjectByName(`Prop:${id}`);
    if (!model) return;
    // Measured on the normalized CAD exports. The clamp, rather than the
    // overall bounds center, belongs on the shelf's rear edge. Both exports
    // originally face away from the user or sideways.
    const dual = id === 'ergoflex-dual-monitor-arm-compact';
    const base = new THREE.Vector3(...(dual ? [-.9, 0, 188] : [-149, 0, -24.5]));
    const ends = dual ? [[315, 270, -211], [-315, 270, -211]] : [[173, 266.1, 119.9]];
    model.rotation.y = dual ? Math.PI : -Math.atan2(322, 144.4);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y);
    model.position.copy(base.clone().applyQuaternion(rotation).negate());
    root.userData.armHeads = ends.map(p => new THREE.Vector3(...p).sub(base).applyQuaternion(rotation));
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    root.armGeometry = [];
    model.traverse(object => {
        if (!object.isMesh) return;
        object.geometry = object.geometry.clone();
        const source = object.geometry.attributes.position;
        const values = new Float32Array(source.count * 3);
        for (let i = 0; i < source.count; i++) { values[i * 3] = source.getX(i); values[i * 3 + 1] = source.getY(i); values[i * 3 + 2] = source.getZ(i); }
        object.geometry.setAttribute('position', new THREE.BufferAttribute(values.slice(), 3));
        const transform = inverse.clone().multiply(object.matrixWorld);
        object.userData.sharedProp = false;
        // Own the geometry and materials so disposing this fitted accessory
        // cannot invalidate the shared library cache.
        object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
        root.armGeometry.push({ object, values, transform, inverse: transform.clone().invert() });
    });
    // Measure each native head's front face, rather than treating the middle
    // of the bracket as the mounting face. The single arm has an angled head.
    root.userData.armHeadFaces = root.userData.armHeads.map(head => {
        const clusters = new Map(), a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3(), n=new THREE.Vector3();
        for (const {object,values,transform} of root.armGeometry) {
            const index=object.geometry.index, count=index?index.count:values.length/3;
            for(let i=0;i<count;i+=3){
                a.fromArray(values,(index?index.getX(i):i)*3).applyMatrix4(transform);
                b.fromArray(values,(index?index.getX(i+1):i+1)*3).applyMatrix4(transform);
                c.fromArray(values,(index?index.getX(i+2):i+2)*3).applyMatrix4(transform);
                if(a.clone().add(b).add(c).multiplyScalar(1/3).distanceTo(head)>85)continue;
                n.crossVectors(b.clone().sub(a),c.clone().sub(a));const area=n.length();if(!area)continue;n.normalize();
                if(Math.abs(n.y)>.3||Math.abs(n.z)<.3)continue;if(n.z<0)n.negate();
                const key=n.toArray().map(v=>Math.round(v*10)).join(',');const face=clusters.get(key)||{area:0,normal:new THREE.Vector3()};face.area+=area;face.normal.addScaledVector(n,area);clusters.set(key,face);
            }
        }
        const normal=[...clusters.values()].sort((a,b)=>b.area-a.area)[0]?.normal.normalize()||new THREE.Vector3(0,0,1);
        let extent=0;
        for(const {values,transform} of root.armGeometry)for(let i=0;i<values.length;i+=3){a.fromArray(values,i).applyMatrix4(transform);if(a.distanceTo(head)<110)extent=Math.max(extent,a.sub(head).dot(normal));}
        return {normal,extent};
    });
    if (!dual) {
        // Each supplied CAD part remains rigid. Only the two link pivots and
        // the VESA head rotate; a display's roll must never twist the links.
        const groups = Object.fromEntries(['clamp', 'lower', 'upper', 'head'].map(part => {
            const group = new THREE.Group(); group.name = `Single arm ${part}`; root.add(group); return [part, group];
        }));
        for (const g of root.armGeometry) {
            const part = g.object.name.match(/^single-arm-(clamp|lower|upper|head)-/)?.[1] || 'clamp';
            g.object.geometry.applyMatrix4(g.transform);
            g.values = g.object.geometry.attributes.position.array.slice();
            groups[part].add(g.object); g.object.position.set(0,0,0); g.object.quaternion.identity(); g.object.scale.setScalar(1);
            g.transform.identity(); g.inverse.identity(); g.part = part;
        }
        root.singleArmRig = {
            groups, base: new THREE.Vector3(2.469258,8.835796,6.621386),
            elbow: new THREE.Vector3(185.569247,278.204815,102.961439), tip: root.userData.armHeads[0].clone()
        };
    }
    const bridges = new THREE.Group(); bridges.name = 'Display mounting adapters'; root.add(bridges);
    root.armAdapterGroup = bridges;
}

function fitRigidSingleArm(arm, fitting) {
    const rig = arm.singleArmRig;
    const identity = new THREE.Quaternion();
    const pose = (part, pivot, at, rotation) => {
        const group = rig.groups[part];
        group.quaternion.copy(rotation);
        group.position.copy(at).sub(pivot.clone().applyQuaternion(rotation));
        group.updateMatrix();
        for (const g of arm.armGeometry) if (g.part === part) g.transform.copy(group.matrix);
    };
    if (!fitting) {
        for (const part of Object.keys(rig.groups)) pose(part, rig.base, rig.base, identity);
        return;
    }
    const lower = rig.elbow.clone().sub(rig.base), upper = rig.tip.clone().sub(rig.elbow);
    const l1 = lower.length(), l2 = upper.length();
    const direction = fitting.head.clone().sub(rig.base), requested = direction.length();
    direction.normalize();
    // A rigid arm has finite reach. Leave the clamp and CAD lengths intact.
    const distance = THREE.MathUtils.clamp(requested, Math.abs(l1-l2)+.001, l1+l2-.001);
    const tip = rig.base.clone().addScaledVector(direction, distance);
    const along = (l1*l1-l2*l2+distance*distance)/(2*distance);
    const sideways = lower.clone().addScaledVector(direction, -lower.dot(direction));
    if (sideways.lengthSq() < 1e-8) sideways.set(1,0,0).addScaledVector(direction,-direction.x);
    sideways.normalize();
    const elbow = rig.base.clone().addScaledVector(direction,along).addScaledVector(sideways,Math.sqrt(Math.max(0,l1*l1-along*along)));
    pose('clamp',rig.base,rig.base,identity);
    pose('lower',rig.base,rig.base,new THREE.Quaternion().setFromUnitVectors(lower.normalize(),elbow.clone().sub(rig.base).normalize()));
    pose('upper',rig.elbow,elbow,new THREE.Quaternion().setFromUnitVectors(upper.normalize(),tip.clone().sub(elbow).normalize()));
    pose('head',rig.tip,tip,fitting.headRotation);
    const face = arm.userData.armHeadFaces[0];
    const contact = tip.clone().addScaledVector(fitting.normal,face.extent);
    arm.userData.armConnections.push({displayId:fitting.display.userData.accessoryId,start:contact,end:fitting.end.clone(),headCenter:tip,normal:fitting.normal.clone()});
    arm.updateWorldMatrix(true,true);
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

// Find the thin keyboard plate in mount-local millimetres. The rails and
// the plate have different elevations; total model height is not a rest point.
function prepareSuppliedTray(root) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(); let plate = null, area = 0;
    root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.geometry.computeBoundingBox();
        const bounds = obj.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
        const size = bounds.getSize(new THREE.Vector3());
        if (size.y < 15 && size.x * size.z > area) { plate = bounds; area = size.x * size.z; }
    });
    if (plate) root.userData.traySurface = { center: plate.getCenter(new THREE.Vector3()), top: plate.max.y, width: plate.max.x - plate.min.x };
}

export class WorkspaceAccessories {
    constructor(scene, registry, millimetreScale, model) {
        this.scene = scene; this.items = new Map(); this.mounts = new Map(); this.scale = millimetreScale; this.dressToken = 0;
        this.pending = new Map(); this.ready = Promise.resolve(); this.config = { accessories: [] };
        for (const [role, name] of [['desktop', 'Desktop_3'], ['shelf', 'Top_Shelf_4'], ['lower-shelf', 'Top_Shelf_3'], ['base-shelf', 'Base_Panels_3']]) {
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
                depth: (surface.bounds.max.x - surface.bounds.min.x) / millimetreScale,
                width: (surface.bounds.max.z - surface.bounds.min.z) / millimetreScale });
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
        this.config = { ...config, accessories: [...config.accessories] };
        const selected = new Set(config.accessories);
        for (const [id, obj] of this.items) if (!selected.has(id)) { disposeTree(obj); this.items.delete(id); }
        for (const item of ACCESSORIES) {
            if (!selected.has(item.id) || !item.visual || this.items.has(item.id)) continue;
            const role = item.mount || (item.visual === 'footrest' ? 'floor' : ['monitor', 'arm', 'dual-arm'].includes(item.visual) ? 'shelf' : 'desktop');
            const mount = this.mounts.get(role);
            if (!mount) continue;
            const obj = createAccessory(item); mount.group.add(obj); this.items.set(item.id, obj);
            if (item.propId) {
                const pending = PROP_LIBRARY.loadIndex().then(() => PROP_LIBRARY.instance(item.propId)).then(model => {
                    // Removal, size changes and rapid preset switches must not
                    // let a late loader attach to a disposed accessory mount.
                    if (this.items.get(item.id) !== obj) return;
                    obj.add(model); obj.userData.loaded = true;
                    if (item.exclusiveGroup === 'mouse') addMousePad(obj);
                    if (item.id === 'keyboard-tray') prepareSuppliedTray(obj);
                    if (item.id === 'artist-easel') prepareArtistPainting(obj);
                    if (item.id === 'shelf-organizer') prepareShelfOrganizer(obj);
                    if (['wide-monitor', 'portrait-monitor', 'flat-monitor'].includes(item.id)) prepareSuppliedDisplay(obj, item.propId);
                    if (item.id === 'monitor-arm' || item.id === 'monitor-arm-2') prepareSuppliedArm(obj, item.propId);
                    this.layout();
                }).catch(error => { obj.userData.loadError = true; console.error('[ErgoFlex] Accessory model failed:', item.id, error); })
                  .finally(() => { if (this.pending.get(item.id) === pending) this.pending.delete(item.id); });
                this.pending.set(item.id, pending);
            }
        }
        this.layout();
        this.ready = Promise.all([...this.pending.values()]);
    }
    applyAccessoryFinishes() {
        for (const [id,root] of this.items) {
            const item=accessory(id);if(!item.finishes||!root.userData.loaded)continue;
            const finish=this.config.accessoryFinishes?.[id]||'black';
            if(root.userData.accessoryFinish===finish)continue;
            if(!root.finishMaterials){
                root.finishMaterials=[];
                root.getObjectByName(`Prop:${item.propId}`)?.traverse(obj=>{
                    if(!obj.isMesh)return;
                    const mats=[].concat(obj.material).map(source=>{
                        const mat=source.clone();mat.userData.sharedTextures=true;
                        obj.ownedMaterials||=[];obj.ownedMaterials.push(mat);
                        root.finishMaterials.push({mat,color:source.color.clone(),metalness:source.metalness,roughness:source.roughness,roughnessMap:source.roughnessMap,role:source.name});return mat;
                    });obj.material=Array.isArray(obj.material)?mats:mats[0];
                });
            }
            if(finish==='steel'&&id==='keyboard-tray'&&!root.brushedSteelMap){
                const data=new Uint8Array(256*64*4);
                for(let y=0;y<64;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,value=160+Math.round(55*((y*37%64)/63))+Math.round(8*Math.sin(x*.15+y));data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
                const map=new THREE.DataTexture(data,256,64);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(5,3);map.needsUpdate=true;root.brushedSteelMap=map;root.ownedTextures||=[];root.ownedTextures.push(map);
            }
            for(const {mat,color,metalness,roughness,roughnessMap,role} of root.finishMaterials){
                const mouse=id==='logitech-mx-master',steel=finish==='steel'&&id==='keyboard-tray';
                const tint=finish==='white'?(mouse&&role==='MX roller steel'?color:mouse&&role==='MX graphite trim'?new THREE.Color('#727b82'):mouse&&role==='MX rubber grip'?new THREE.Color('#c6c8c4'):new THREE.Color('#ebede9')):steel?new THREE.Color('#9ca5ae'):color;
                mat.color.copy(tint);
                mat.metalness=steel ? .9 : finish==='white'&&id==='keyboard-tray' ? .15 : metalness;
                mat.roughness=steel ? .5 : finish==='white'&&id==='keyboard-tray' ? .42 : roughness;
                const nextMap=steel?root.brushedSteelMap:roughnessMap;
                if(mat.roughnessMap!==nextMap){mat.roughnessMap=nextMap;mat.needsUpdate=true;}
            }
            root.userData.accessoryFinish=finish;
        }
    }
    layout() {
        this.applyAccessoryFinishes();
        const selected = new Set(this.config.accessories);
        for (const obj of this.items.values()) { obj.rotation.set(0, 0, 0); obj.scale.setScalar(1); }
        const front = (this.mounts.get('desktop')?.depth || 800) / 2;
        const mat = selected.has('desk-mat') ? 3 : 0;
        const place = (id, x, y, z) => this.items.get(id)?.position.set(x, y, z);
        place('desk-mat', 0, 0, front - 220);
        place('logitech-k860', -64, mat, front - 215);
        place('logitech-lift', 240, mat, front - 190);
        place('task-light', -435, 0, -(this.mounts.get('desktop')?.depth || 800) / 2);
        place('cable-tray', 0, -22, -80);
        place('cpu-holder', 370, -24, 40);
        place('foot-rest', 0, 0, 680);
        const tray = selected.has('keyboard-tray');
        place('keyboard-tray', 0, -28, front - 100);
        const surface = this.items.get('keyboard-tray')?.userData.traySurface;
        const inputY = tray ? -28 + (surface?.top ?? -20) : mat;
        const inputZ = tray ? front - 100 + (surface?.center.z ?? 210) : front - 215;
        const inputX = tray ? (surface?.center.x ?? -37) : 0;
        for (const id of ['logitech-k860', 'ergo-keyboard', 'apple-keyboard', 'mechanical-keyboard']) place(id, inputX - (tray ? 30 : 64), inputY, inputZ);
        for (const id of ['logitech-lift', 'logitech-mx-master', 'magic-mouse']) place(id, tray ? inputX + (surface?.width ?? 506) / 2 - 42 : 240, inputY, inputZ + (tray ? 95 : 25));
        place('artist-easel', 0, 0, 0);
        place('drafting-kit', 0, 0, 0);
        place('painter-shelf', 0, -80, 0);
        place('easel-rail', 0, 0, selected.has('drafting-kit') ? 300 : -190);
        place('drawing-tablet', -210, 0, 35);
        place('shelf-organizer', 0, 0, 0);
        const back = -(this.mounts.get('shelf')?.depth || 480) / 2;
        place('obsbot-tiny-2', -(this.mounts.get('shelf')?.width || 1100) / 2 + 75, 0, -back - 40);
        place('monitor-arm', 0, 0, back + 28);
        place('monitor-arm-2', 0, 0, back + 28);
        const pair = selected.has('portrait-monitor') && (selected.has('wide-monitor') || selected.has('flat-monitor') || selected.has('dell-u2724d'));
        const mounted = selected.has('monitor-arm-2') || selected.has('monitor-arm');
        const portraitMounted = selected.has('monitor-arm-2') || (selected.has('monitor-arm') && !selected.has('wide-monitor') && !selected.has('flat-monitor') && !selected.has('dell-u2724d'));
        place('wide-monitor', pair ? 280 : 0, mounted ? 70 : 0, mounted ? back + 320 : 0);
        place('flat-monitor', pair ? 280 : 0, mounted ? 70 : 0, mounted ? back + 320 : 0);
        place('portrait-monitor', pair ? -360 : 0, portraitMounted ? -30 : 0, portraitMounted ? back + 320 : 0);
        for (const id of ['wide-monitor', 'portrait-monitor', 'flat-monitor']) {
            const display = this.items.get(id);
            if (!display?.userData.loaded) continue;
            const onArm = id === 'portrait-monitor' ? portraitMounted : mounted;
            display.getObjectByName('monitor-stand').visible = !onArm;
            display.getObjectByName(`Prop:${accessory(id).propId}`).position.y = onArm ? 0 : 125;
        }
        const monitor = this.items.get('dell-u2724d');
        if (monitor) {
            const dual = selected.has('monitor-arm-2'), mounted = dual || selected.has('monitor-arm');
            // The purchase is ONE display even on a dual arm. Leave the second
            // VESA head empty instead of inventing a second billed product.
            monitor.position.set(dual ? -270 : 0, mounted ? 6.255 : 0, mounted ? back + 467 : 0);
            monitor.getObjectByName('monitor-stand').visible = !mounted;
        }
        // Size the full-width Artist inserts inside their editable root. The
        // owner's position, rotation and scale stay independent of desktop size.
        const ratio = this.config.size === '48x30' ? .8 : 1;
        for (const id of ['artist-easel', 'easel-rail']) {
            const prop = this.items.get(id)?.getObjectByName(`Prop:${accessory(id).propId}`);
            if (!prop) continue;
            prop.sizeReferenceScale ||= prop.scale.clone();
            prop.scale.copy(prop.sizeReferenceScale);
            if (id === 'artist-easel') prop.scale.multiplyScalar(ratio);
            else prop.scale.x *= ratio;
        }
        this.onLayout?.();
        this.update();
    }
    fitMonitorArms() {
        for (const id of ['monitor-arm', 'monitor-arm-2']) {
            const arm = this.items.get(id), adapters = arm?.armAdapterGroup;
            if (!adapters) continue;
            arm.updateWorldMatrix(true, true);
            const displays = [this.items.get('wide-monitor') || this.items.get('flat-monitor') || this.items.get('dell-u2724d'), this.items.get('portrait-monitor')].filter(Boolean);
            const availableHeads = [...arm.userData.armHeads];
            const matches = displays.slice(0, arm.userData.armHeads.length).map(display => {
                display.updateWorldMatrix(true, true);
                const point = (display.userData.displayMount || new THREE.Vector3(0, 273.745, -50.12)).clone();
                // Stand-free panels start on the root floor. Their height offset
                // must be included when a display returns to its own stand.
                const panel = display.getObjectByName(`Prop:${accessory(display.userData.accessoryId)?.propId}`);
                if (panel) point.add(panel.position);
                // Authored mounts are VESA boss centers. Connect to the rear
                // of that boss, with a small separation for the mating faces.
                point.z -= 4;
                const end = arm.worldToLocal(display.localToWorld(point));
                const relative = arm.matrixWorld.clone().invert().multiply(display.matrixWorld);
                const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
                relative.decompose(position, rotation, scale);
                // Assign left/right heads to the display on that side. A new
                // pair arrangement must not make the supplied arms cross over.
                const index=availableHeads.reduce((best,head,i)=>Math.abs(head.x-end.x)<Math.abs(availableHeads[best].x-end.x)?i:best,0);
                const [start]=availableHeads.splice(index,1);
                const face=arm.userData.armHeadFaces[arm.userData.armHeads.indexOf(start)];
                const normal=new THREE.Vector3(0,0,1).applyQuaternion(rotation);
                const headRotation=rotation.clone().multiply(new THREE.Quaternion().setFromUnitVectors(face.normal,new THREE.Vector3(0,0,1)));
                return { display, start, end, rotation, normal, headRotation, head:end.clone().addScaledVector(normal,-face.extent) };
            });
            const signature = JSON.stringify(matches.map(m => [m.display.uuid, m.display.visible, ...m.end.toArray().map(v => Math.round(v * 100) / 100), ...m.rotation.toArray().map(v => Math.round(v * 1e6) / 1e6)]));
            if (signature === arm.userData.armFitSignature) continue;
            arm.userData.armFitSignature = signature;
            for (const child of [...adapters.children]) disposeTree(child);
            arm.userData.armConnections = [];
            const fittings = matches;
            if (arm.singleArmRig) {
                fitRigidSingleArm(arm, matches.find(m => m.display.visible));
                continue;
            }
            for (const fitting of fittings) fitting.delta = fitting.head.clone().sub(fitting.start);
            // Keep the clamp and shared mast fixed, while the outer arm runs
            // adapt to the screen positions. Work on owned vertex copies only;
            // the library's source geometry and saved object poses stay intact.
            const point = new THREE.Vector3();
            for (const { object, values, transform, inverse } of arm.armGeometry) {
                const positions = object.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    point.fromArray(values, i * 3).applyMatrix4(transform);
                    const fitting = fittings.find(m => arm.userData.armHeads.length === 1 || Math.sign(m.start.x) === Math.sign(point.x));
                    if (fitting && point.y > 90) {
                        const distance=point.distanceTo(fitting.start);
                        const reach = arm.userData.armHeads.length === 1 ? point.z : Math.abs(point.x);
                        const terminal = arm.userData.armHeads.length === 1 ? fitting.start.z : Math.abs(fitting.start.x);
                        const headWeight=1-THREE.MathUtils.smoothstep(distance,110,170);
                        const weight = Math.max(headWeight,THREE.MathUtils.clamp((reach - 70) / Math.max(1, terminal - 120), 0, 1));
                        const offset=point.clone().sub(fitting.start);
                        point.addScaledVector(offset.clone().applyQuaternion(fitting.headRotation).sub(offset),headWeight);
                        point.addScaledVector(fitting.delta, weight);
                        // Keep the terminal housing behind the mounting plane,
                        // including while the display is tilted or rolled.
                        if(distance<170){const intrusion=point.clone().sub(fitting.end).dot(fitting.normal);if(intrusion>0)point.addScaledVector(fitting.normal,-intrusion);}
                    }
                    point.applyMatrix4(inverse); positions.setXYZ(i, point.x, point.y, point.z);
                }
                positions.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
            }
            for (const { display, head, end, normal } of fittings) {
                if (!display.visible) continue;
                // Use the supplied CAD head itself; do not stack a second
                // bracket or adapter plate between it and the display.
                arm.userData.armConnections.push({ displayId: display.userData.accessoryId, start: end.clone(), end: end.clone(), headCenter: head.clone(), normal:normal.clone() });
            }
            adapters.updateMatrixWorld(true);
        }
    }
    setDayDress(mode) {
        const phase = ['morning', 'afternoon', 'evening', 'night', 'party'].indexOf(mode);
        for (const mount of this.mounts.values()) for (const child of mount.dress?.children || []) {
            if (child.userData.dayKit) child.children.forEach((variant, i) => variant.visible = i === phase);
            else if (child.userData.dressPhases) child.visible = child.userData.dressPhases.includes(mode);
            else if (child.userData.dailyInput) child.visible = phase !== 2 && phase !== 4;
        }
    }
    update() {
        // Use the actual desktop material, including stain, wraps and finish.
        const desktop = this.mounts.get('desktop')?.anchor;
        const finish = desktop && [].concat(desktop.material).find(m => m?.isMeshPhysicalMaterial);
        if (finish) for (const root of this.items.values()) root.traverse(obj => {
            if (!obj.userData.artistShelfWood || obj.artistFinishVersion === finish.version) return;
            const m = obj.material;
            m.copy(finish); m.name = 'Artist shelf wood'; m.userData.sharedTextures = true;
            m.needsUpdate = true; obj.artistFinishVersion = finish.version;
        });
        for (const { anchor, group, dress, relative } of this.mounts.values()) {
            anchor.updateWorldMatrix(true, false);
            let visible = true;
            for (let p = anchor; p; p = p.parent) if (!p.visible && !p.userData.sizeVariant) visible = false;
            for (const target of [group, dress]) {
                if (!target) continue;
                target.matrix.multiplyMatrices(anchor.matrixWorld, relative);
                target.visible = visible && (target !== dress || this.activeDeskDress !== false)
                    && (target !== group || !this.sceneAccessoryOverride); target.updateMatrixWorld(true);
            }
        }
        if(!this.sceneAccessoryOverride)this.fitMonitorArms();
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
            try { return { placement, object: placement.procedural === 'midi' ? createMusicKeyboard()
                : placement.id === 'journal' ? createDeskNotebook(sceneId, { box, mesh, material }) : await PROP_LIBRARY.instance(placement.id) }; }
            catch { return { placement, object: null }; }
        }));
        if (token !== this.dressToken) return;
        for (const { placement, object } of loaded) {
            const mount = this.mounts.get(placement.role);
            if (!object || !mount?.dress) continue;
            object.position.set(...placement.at);
            object.rotation.y = THREE.MathUtils.degToRad(placement.turn || 0);
            markSceneAsset(object, { key: placement.sceneAssetKey, role: placement.role });
            object.userData.dailyInput = placement.role === 'desktop' && /keyboard|mouse|laptop|tablet/.test(placement.id) && sceneId !== 'music';
            // Optional daypart filter, e.g. phases: ['evening', 'night'].
            if (placement.phases) object.userData.dressPhases = placement.phases;
            mount.dress.add(object);
        }
        // Institutional groups may add procedural main-desk detail:
        // mainDeskDetail({ sceneId, role, THREE, add(object, phases?) }).
        const detailHook = INSTITUTIONAL_ROOMS[sceneId] && institutionalModule(sceneId)?.mainDeskDetail;
        if (detailHook) for (const [role, mount] of this.mounts) {
            if (!mount.dress || role === 'floor') continue;
            detailHook({ sceneId, role, THREE, add: (object, phases) => { if (phases) object.userData.dressPhases = phases; mount.dress.add(object); return object; } });
        }
        const desktop = this.mounts.get('desktop');
        if (desktop && sceneId !== 'product') {
            const kit = createDailyDeskKit(sceneId, { box, mesh, rod, material });
            placeDailyDeskKit(kit, desktop.dress.children);
            markSceneAsset(kit, { key: `${sceneId}:desktop:daily-kit`, role: 'desktop' });
            desktop.dress.add(kit);
        }
        this.update();
    }
    dressAssets() {
        return [...this.mounts.values()].flatMap(mount =>
            mount.dress ? mount.dress.children.filter(child => child.userData.sceneAsset) : []);
    }
    objects() { return [...this.items.values()]; }
    exportGroups() {
        this.update(); return [...this.mounts.values()].map(m => {
            const clone=m.group.clone(true), transient=[];
            clone.traverse(obj=>{if(obj.userData.transientGameScreen)transient.push(obj);});
            transient.forEach(obj=>obj.removeFromParent());return clone;
        });
    }
    dispose() {
        this.dressToken++;
        this.mounts.forEach(m => { disposeTree(m.group); if (m.dress) disposeTree(m.dress); });
        this.mounts.clear(); this.items.clear();
    }
}

// A room desk uses the same accessory geometry, finishing and arm fitting as
// Product view, attached to its own animated surface mounts in millimetres.
export function createSceneAccessorySet(mounts,config,finishMaterial) {
    const set=new WorkspaceAccessories(null,new Map(),1,null);
    set.mounts=new Map(Object.entries(mounts).map(([role,group])=>[role,{
        group,depth:group.userData.surfaceSize?.depth||800,width:group.userData.surfaceSize?.width||1100
    }]));
    set.update=()=>{
        const finish=finishMaterial?.();
        if(finish)for(const root of set.items.values())root.traverse(obj=>{
            if(!obj.userData.artistShelfWood)return;
            const signature=finish.uuid+':'+finish.version+':'+finish.color.getHex()+':'+finish.map?.uuid;
            if(obj.sceneFinishSignature===signature)return;
            obj.material.copy(finish);obj.material.name='Artist shelf wood';obj.material.userData.sharedTextures=true;
            obj.material.needsUpdate=true;obj.sceneFinishSignature=signature;
        });
        set.fitMonitorArms();
    };
    set.dispose=()=>{for(const obj of set.items.values())disposeTree(obj);set.items.clear();set.mounts.clear();};
    // Caller installs its placement callback before loading, because every
    // completed model reapplies the width-specific default layout.
    set.initialConfig=config;
    return set;
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
    { id: 'office', name: 'Office', caption: 'Different talents. One shared workspace.', tone: 'gallery',
      desk: [
        { id: 'office-keyboard', at: [-60, 0, 90] },
        { id: 'ergoflex-mx-master-mouse', at: [285, 0, 90] },
        { id: 'journal', at: [-420, 0, -140], turn: -10 },
        { id: 'painted-mug', at: [435, 0, -155] }
      ],
      shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }],
      shell: 'daylight', feature: 'window', props: officeLayoutForSize('48x30').props },
    { id: 'library', name: 'Library', caption: 'Make room for discovery.', tone: 'warm',
      desk: [{ id: 'kenney-furniture-laptop', at: [-180, 0, 20] }, { id: 'journal', at: [320, 0, 80], turn: -8 }, { id: 'apple-pencil', at: [440, 0, 100], turn: 80 }],
      shelf: [{ id: 'kenney-furniture-books', at: [-310, 0, 0] }, { id: 'paper-holder', at: [300, 0, 0] }],
      shell: 'daylight', feature: 'window', props: libraryLayoutForSize('48x30').props },
    { id: 'coworking', name: 'Co-working', caption: 'Find your people. Make room for your ideas.', tone: 'warm',
      desk: [{ id: 'office-keyboard', at: [-80, 0, 90] }, { id: 'magic-mouse', at: [295, 0, 80], turn: 90 }, { id: 'journal', at: [-420, 0, -130], turn: -8 }],
      shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }],
      shell: 'daylight', feature: 'window', props: coworkingLayoutForSize('48x30').props },
    { id: 'home', name: 'Home office', caption: 'Make yourself at work.', tone: 'warm',
      desk: [
        { id: 'office-keyboard', at: [-70, 0, 80] },
        { id: 'ergoflex-mx-master-mouse', at: [270, 0, 80] },
        { id: 'painted-mug', at: [440, 0, -30] },
        { id: 'journal', at: [-420, 0, -80], turn: -8 }
      ],
      shelf: [ { id: 'curved-monitor', at: [0, 0, 0] } ],
      shell: 'warm', feature: 'window', props: homeLayoutForSize('48x30').props },
    { id: 'music', name: 'Music studio', caption: 'Find your creative frequency.', tone: 'slate',
      desk: [
        { id: 'music-midi-keyboard', procedural: 'midi', at: [-70, 0, 105] },
        { id: 'magic-mouse', at: [465, 0, 85], turn: 90 },
        { id: 'mac-studio', at: [-455, 0, -250] },
        { id: 'ergoflex-headphones-2', at: [410, 0, -240], turn: 18 }
      ],
      shelf: [ { id: 'curved-monitor', at: [0, 0, 0] } ],
      shell: 'studio', feature: 'panels', props: musicLayoutForSize('48x30').props },
    { id: 'gaming', name: 'Gaming', caption: 'Settle into your next world.', tone: 'slate',
      desk: [
        { id: 'ergoflex-mechanical-keyboard', at: [-100, 0, 30] },
        { id: 'ergoflex-mouse-2', at: [300, 0, 30] },
        { id: 'game-controller', at: [-420, 0, -240], turn: 15 },
        { id: 'ergoflex-headphones-2', at: [435, 0, -230], turn: -20 }
      ],
      shelf: [ { id: 'curved-monitor', at: [0, 0, 0] } ],
      shell: 'studio', feature: 'panels', props: gamingLayoutForSize('48x30').props },
    { id: 'creative', name: 'Artist studio', caption: 'A space for your next creation.', tone: 'gallery',
      desk: [
        { id: 'ergoflex-drawing-tablet', at: [-285, 0, 40], turn: 8 },
        { id: 'apple-pencil', at: [-115, 0, 50], turn: 65 },
        { id: 'sketchbook', at: [110, 0, -105], turn: -8 },
        { id: 'metal-ruler', at: [-425, 0, -195], turn: 90 },
        { id: 'painted-mug', at: [410, 0, -180] }
      ],
      shell: 'loft', feature: 'window', props: artistLayoutForSize('48x30').props },
    { id: 'lounge', name: 'Lounge', caption: 'Good company. A little play. Your kind of evening.', tone: 'warm',
      desk: [
        { id: 'tablet-pc', at: [-210, 0, 20] },
        { id: 'game-controller', at: [210, 0, 90], turn: -15 },
        { id: 'tea-cup', at: [430, 0, -140] }
      ],
      shelf: [{ id: 'kenney-furniture-plant-small2', at: [350, 0, 60] }],
      shell: 'lounge', feature: 'window', props: loungeLayoutForSize('48x30').props },
    { id: 'kitchen', name: 'Kitchen', caption: 'Gather here. Make something good.', tone: 'warm',
      desk: [
        { id: 'cutting-board', at: [-90, 0, 100] },
        { id: 'apple', at: [290, 0, 60] },
        { id: 'orange', at: [380, 0, -70] },
        { id: 'tablet-pc', at: [-380, 0, -90] }
      ],
      shelf: [{ id: 'kenney-furniture-plant-small1', at: [350, 0, 70] }],
      shell: 'kitchen', feature: 'window', props: kitchenLayoutForSize('48x30').props },
    { id: 'gym', name: 'Home gym', caption: 'Your daily momentum. Built here.', tone: 'slate',
      desk: [
        { id: 'sports-bottle', at: [430, 0, 40] },
        { id: 'tablet-pc', at: [-170, 0, 40] },
        { id: 'journal', at: [190, 0, -90] }
      ],
      shelf: [{ id: 'curved-monitor', at: [0, 0, 90] }],
      shell: 'gym', feature: 'window', props: gymLayoutForSize('48x30').props },
    { id: 'scifi', name: 'Sci-fi bay', caption: 'A desk at the edge of known space.', tone: 'slate',
      desk: [
        { id: 'mac-studio', at: [-400, 0, -120], turn: 15 },
        { id: 'magic-mouse', at: [430, 0, 60] },
        { id: 'airtag', at: [-250, 0, -255] }
      ],
      shelf: [ { id: 'curved-monitor', at: [0, 0, 120], turn: 0 } ],
      shell: 'hangar', feature: 'panels', props: scifiLayoutForSize('48x30').props }
,
    { id: 'bedroom', name: 'Bedroom', caption: 'Room to begin. Room to unwind.', tone: 'warm',
      desk: [
        { id: 'table-lamp-plain', at: [-450, 0, -230] },
        { id: 'journal', at: [400, 0, 40], turn: -18 },
        { id: 'wireless-charger', at: [-300, 0, 100], turn: 12 },
        { id: 'virtual-pet', at: [280, 0, -200], turn: 30 },
        { id: 'glasses-3', at: [-180, 0, -250], turn: -25 }
      ],
      shelf: [ { id: 'photo-frame', at: [-380, 0, 0], turn: 18 } ],
      shell: 'bedroom', feature: 'window', props: bedroomLayoutForSize('48x30').props },
    { id: 'workshop', name: 'Workshop', caption: 'Make it. Mend it. Make it yours.', tone: 'warm',
      desk: [
        { id: 'multi-tool', at: [400, 0, -60], turn: 20 },
        { id: 'caliper', at: [-380, 0, -180], turn: -35 },
        { id: 'painters-tape', at: [-430, 0, 80] },
        { id: 'walkie-talkie', at: [300, 0, 120], turn: 40 }
      ],
      shell: 'workshop', feature: 'window', props: workshopLayoutForSize('48x30').props },
    { id: 'study', name: 'Study', caption: 'Make time for a quieter kind of work.', tone: 'warm',
      desk: [
        { id: 'kenney-furniture-laptop', at: [-220, 0, 10] },
        { id: 'journal', at: [170, 0, 70], turn: -8 },
        { id: 'pen', at: [355, 0, 160], turn: -12 },
        { id: 'glasses-3', at: [180, 0, -225], turn: 15 },
        { id: 'modern-lamp', at: [425, 0, -190] }
      ],
      shelf: [{ id: 'kenney-furniture-books', at: [-240, 0, 0] }, { id: 'tin-cat', at: [320, 0, 0] }],
      shell: 'study', feature: 'window', props: studyLayoutForSize('48x30').props },
    { id: 'gallery', name: 'Gallery', caption: 'A collection with room to inspire.', tone: 'gallery',
      desk: [
        { id: 'journal', at: [120, 0, 80], turn: -10 },
        { id: 'pen', at: [300, 0, -150], turn: 30 },
        { id: 'glasses-2', at: [-400, 0, -60], turn: -20 },
        { id: 'gold-award', at: [430, 0, -120], turn: -15 }
      ],
      shell: 'gallery', feature: 'window', props: galleryLayoutForSize('48x30').props },
    // Main-desk dressing: per-scene `desk`/`shelf` from the group module's
    // sceneOverrides (placements may list `phases`), else this generic set.
    ...INSTITUTIONAL_IDS.map(id => { const p = INSTITUTIONAL_ROOMS[id]; return { id, name: p.name, caption: p.caption, category: p.category, tone: 'gallery', desk: p.desk || [{ id: 'journal', at: [160, 0, 70] }, { id: 'kenney-furniture-laptop', at: [-230, 0, 10] }], shelf: p.shelf || [{ id: 'paper-holder', at: [300, 0, 0] }], props: [] }; })
];

export const ROOM_ATMOSPHERES = {
    ...Object.fromEntries(INSTITUTIONAL_IDS.map(id => [id, { ...INSTITUTIONAL_ROOMS[id].modes.morning, space: [1000, 1000, 1400] }])),
    product: { label: 'Softbox studio', space: [0, 0, 0], key: '#fff9f0', fill: '#e8f0ff', accent: '#ffffff', power: 1.5, ambient: .35, exposure: .95, bounce: 1.3 },
    office: { label: 'Fresh morning', space: [700, 650, 650], key: '#fff5df', fill: '#dceeff', accent: '#d3f1df', power: 1.8, ambient: .48, exposure: 1.02, bounce: .85 },
    library: { label: 'Campus daylight', space: [1000, 1000, 1400], key: '#fff0d7', fill: '#dcecf0', accent: '#c0d7be', power: 1.45, ambient: .46, exposure: 1.07, bounce: .65 },
    coworking: { label: 'Shared daylight', space: [1100, 950, 1300], key: '#fff0d8', fill: '#d8e9ee', accent: '#c0d6c5', power: 1.5, ambient: .46, exposure: 1.08, bounce: .66 },
    home: { ...HOME_MODES.afternoon, space: [-700, -600, -200] }, // compact default; WorkspaceRoom supplies both measured layouts
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
        this.ceilingEnabled = false; this.ceilingSurface = null;
        this.ownedMaterials = new Set();
    }
    set(id, options = {}) {
        if (!ROOM_SCENES.some(s => s.id === id)) id = 'product';
        // Any prop load still in flight belongs to the room being replaced.
        this.token++;
        this.grounding?.dispose(); this.grounding = null;
        this.ownedMaterials.forEach(mat => mat.dispose()); this.ownedMaterials.clear();
        if (this.root) disposeTree(this.root);
        this.id = id; this.root = null; this.walls = []; this.missingProps = [];
        this.decorateStation = null;
        this.homeAtmosphere = null; this.roomAtmosphere = null; this.decorateProp = null;
        this.propSupports = [];
        this.homeLayout = null; this.roomLayout = null; this.ceilingFixture = null; this.ceilingSurface = null; this.bounce = null; this.life = null; this.windowViewReady = Promise.resolve();
        if (id === 'product') { this.ready = Promise.resolve(); return; }
        let scene = ROOM_SCENES.find(s => s.id === id);
        if (INSTITUTIONAL_ROOMS[id]) {
            this.roomLayout = institutionalLayout(id, options.layout, options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'home') {
            this.homeLayout = options.layout ? homeLayoutById(options.layout) : homeLayoutForSize(options.size);
            this.roomLayout = this.homeLayout;
            scene = { ...scene, props: this.homeLayout.props, physical: true };
        } else if (id === 'gaming') {
            this.roomLayout = options.layout ? gamingLayoutById(options.layout) : gamingLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'music') {
            this.roomLayout = options.layout ? musicLayoutById(options.layout) : musicLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'creative') {
            this.roomLayout = options.layout ? artistLayoutById(options.layout) : artistLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'library') {
            this.roomLayout = options.layout ? libraryLayoutById(options.layout) : libraryLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'coworking') {
            this.roomLayout = options.layout ? coworkingLayoutById(options.layout) : coworkingLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'office') {
            this.roomLayout = options.layout ? officeLayoutById(options.layout) : officeLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'bedroom') {
            this.roomLayout = options.layout ? bedroomLayoutById(options.layout) : bedroomLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'gallery') {
            this.roomLayout = options.layout ? galleryLayoutById(options.layout) : galleryLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'scifi') {
            this.roomLayout = options.layout ? scifiLayoutById(options.layout) : scifiLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'workshop') {
            this.roomLayout = options.layout ? workshopLayoutById(options.layout) : workshopLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'lounge') {
            this.roomLayout = options.layout ? loungeLayoutById(options.layout) : loungeLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'kitchen') {
            this.roomLayout = options.layout ? kitchenLayoutById(options.layout) : kitchenLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'gym') {
            this.roomLayout = options.layout ? gymLayoutById(options.layout) : gymLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        } else if (id === 'study') {
            this.roomLayout = options.layout ? studyLayoutById(options.layout) : studyLayoutForSize(options.size);
            scene = { ...scene, props: this.roomLayout.props, physical: true };
        }
        const root = this.root = new THREE.Group(); root.name = `Room:${id}`;
        root.rotation.y = Math.PI / 2;
        // Use the measured nominal desktop width for measured rooms' metre
        // conversion. Other scenes retain their existing authored scale.
        root.scale.setScalar(this.roomLayout ? options.scale || this.scale : this.scale); this.scene.add(root);
        if (id === 'home') {
            buildHomeOffice(this, root, this.homeLayout, { material, mesh, box, rod, sphere });
            this.roomAtmosphere = this.homeAtmosphere;
        }
        else if (id === 'gaming') buildGamingRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere });
        else if (id === 'music') buildMusicRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'creative') buildArtistRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'study') buildStudyRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'bedroom') buildBedroomRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'gallery') buildGalleryRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'scifi') buildScifiRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'workshop') buildWorkshopRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'lounge') buildLoungeRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'kitchen') buildKitchenRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'gym') buildGymRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'library') buildLibraryRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'coworking') buildCoworkingRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (id === 'office') buildOfficeRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else if (INSTITUTIONAL_ROOMS[id]) buildInstitutionalRoom(this, root, this.roomLayout, { material, mesh, box, rod, sphere, markSceneAsset });
        else this.buildShell(root, scene);
        if (this.roomLayout) {
            this.buildCeiling();
            this.life = new RoomLife(this, { material, mesh, box, rod, sphere, markSceneAsset });
            refineRoomSurfaces(this);
        }
        const token = this.token;
        this.ready = Promise.all([this.windowViewReady, this.addProps(root, scene, this.token),
            this.roomLayout?.stations?.length ? this.addOfficeStations(root, options.createStation, this.token) : Promise.resolve()]).then(() => {
            if (token === this.token) this.life?.bind();
        });
    }
    // Extra ErgoFlex desks (office, coworking and institutional layouts).
    // Station spec: { id, name, at: [x, z], size?: '48x30'|'60x30', turn?: degrees,
    // height, tilt, desktop?, shelf?, plan? }. createStation (studio.js) returns
    // a batched snapshot of the live desk at that size and pose. Keys are
    // `${scene}:${layout}:station:${id}`; RoomInteractions.bind registers the
    // groups as floor colliders like any other root-level furnishing.
    async addOfficeStations(root, createStation, token) {
        if (!createStation) return;
        await PROP_LIBRARY.loadIndex();
        if (token !== this.token) return;
        const snapshots = this.roomLayout.stations.map(spec => ({ spec, ...createStation(spec) }));
        for (const { spec, group } of snapshots) {
            group.name = `ErgoFlex ${this.id}: ${spec.name}`;
            group.userData.propId = `${this.id}-station-${spec.id}`;
            group.userData.sceneAssetName = spec.name + ' · ErgoFlex desk';
            markSceneAsset(group, { key: `${this.id}:${this.roomLayout.id}:station:${spec.id}` });
            group.position.set(spec.at[0], 0, spec.at[1]); group.rotation.y = THREE.MathUtils.degToRad(spec.turn || 0); root.add(group);
        }
        for (const { spec, group, mounts } of snapshots) {
            for (const role of ['desktop', 'shelf']) {
                const mount = new THREE.Group(); mount.name = spec.name + ':' + role;
                if (!mounts[role]) continue;
                mount.matrixAutoUpdate = false; mount.matrix.copy(mounts[role]); group.add(mount);
                for (const placement of spec[role] || []) {
                    try {
                        const object = placement.id === 'journal' ? createDeskNotebook(this.id, { box, mesh, material }) : await PROP_LIBRARY.instance(placement.id);
                        if (token !== this.token) { disposeTree(group); return; }
                        object.position.set(...placement.at); object.rotation.y = THREE.MathUtils.degToRad(placement.turn || 0);
                        mount.add(object);
                    } catch { if (token === this.token) this.missingProps.push(placement.id); }
                }
                if (role === 'desktop' && spec.plan) this.decorateStation?.(mount, spec);
                // Institutional groups attach procedural role detail (scanners,
                // lightboxes, pools...) here; it moves and is disposed with the station.
                if (INSTITUTIONAL_ROOMS[this.id]) institutionalModule(this.id)?.stationDetail?.(spec, mount, THREE, { role, layout: this.roomLayout, sceneId: this.id });
            }
        }
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
    // Usable floor rectangle in scene coordinates, inside the physical walls.
    get floorBounds() {
        if (!this.root || this.id === 'product') return null;
        let left, right, back, front;
        if (this.roomLayout) {
            left = -this.roomLayout.width / 2; right = -left;
            back = this.roomLayout.back; front = back + this.roomLayout.depth;
        } else {
            const [wide, rear, ahead] = ROOM_ATMOSPHERES[this.id].space;
            left = -2100 - wide; right = 2075 + wide;
            back = -1625 - rear; front = 2200 + ahead;
        }
        this.root.updateWorldMatrix(true, false);
        const bounds = new THREE.Box3();
        for (const x of [left, right]) for (const z of [back, front])
            bounds.expandByPoint(new THREE.Vector3(x, 0, z).applyMatrix4(this.root.matrixWorld));
        return bounds;
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
            this.decorateProp?.(object, placement);
            polishRoomProp(this, object, placement);
            const position = scene.physical ? [...placement.at] : roomPosition(scene, placement);
            // Countertop objects travel with the complete counter, not the lounge zone.
            if (scene.counter && placement.at[1] >= 900 && placement.on !== 'ceiling') position[2] = placement.at[2];
            object.position.set(...position);
            object.userData.propAnchor = placement.on || PROP_LIBRARY.entry(placement.id)?.anchor;
            object.rotation.y = THREE.MathUtils.degToRad(placement.turn || 0);
            if (placement.scale) object.scale.multiplyScalar(placement.scale);
            markSceneAsset(object, { key: `${scene.id}:${scene.physical ? this.roomLayout.id + ':' : ''}room:${index}:${placement.id}` });
            root.add(object);
            // Upgrade a procedural fixture without changing its saved editor key.
            // Shared GLB resources stay owned by PROP_LIBRARY, as for other props.
            const fixture = placement.replaceFixture && this.assets().find(o => o.userData.propId === placement.replaceFixture);
            if (fixture) {
                const retired = new Set();
                fixture.traverse(o => { if (o.isMesh && !o.userData.sharedProp) { o.geometry.dispose(); for (const m of (Array.isArray(o.material) ? o.material : [o.material])) retired.add(m); } });
                fixture.replacedMaterials = [...retired];
                fixture.clear(); root.updateMatrixWorld(true); fixture.attach(object);
                object.userData.sceneAsset = false; fixture.userData.propId = placement.id;
            }
            const support=this.propSupports.find(s=>s.id===placement.id&&s.at.every((v,i)=>Math.abs(v-position[i])<1));
            if(support){root.updateMatrixWorld(true);support.obj.attach(object);}
        }
        if (this.missingProps.length) console.warn(`Room ${scene.id}: props unavailable: ${this.missingProps.join(', ')}`);
    }
    assets() {
        const assets = [];
        // Framed art may belong to a cutaway wall group. Include explicitly
        // registered descendants so wall attachment keeps its editor identity.
        this.root?.traverse(child => { if (child.userData.sceneAsset) assets.push(child); });
        return assets;
    }
    registerInteractionAsset(object, key) {
        if(!object.userData.sceneAsset)markSceneAsset(object,{key});
    }
    async addAsset(propId, key, position = [0, 0, 800]) {
        const token = this.token;
        await PROP_LIBRARY.loadIndex();
        const object = await PROP_LIBRARY.instance(propId);
        if (token !== this.token) return null;
        object.position.set(...position);
        object.userData.propAnchor = PROP_LIBRARY.entry(propId)?.anchor;
        markSceneAsset(object, { key, custom: true });
        this.ensureAssetRoot().add(object);
        return object;
    }
    buildCeiling() {
        const { width, depth, height, back } = this.roomLayout;
        const group = this.ceilingSurface = new THREE.Group();
        group.name = 'Ceiling surface · cutaway preview';
        group.userData.presentationOnly = true;
        const dark = ['music', 'gaming', 'scifi'].includes(this.id);
        const plaster = material(dark ? '#343a40' : '#e8e5dd', { roughness: .94, metalness: 0 });
        plaster.userData.roomSurface = 'plaster';
        const plane = mesh(group, new THREE.PlaneGeometry(width, depth), plaster, [0, height, back + depth / 2]);
        plane.rotation.x = Math.PI / 2; // The finished face points into the room.
        plane.castShadow = false; plane.receiveShadow = true;
        plane.userData.presentationOnly = true;
        group.visible = false; this.root.add(group);
        this.bounce = new RoomBounceLight(this);
    }
    setCeilingEnabled(enabled) { this.ceilingEnabled = !!enabled; }
    update(camera) {
        this.grounding?.update();
        for (const wall of this.walls) wall.obj.visible = (wall.sign || 1) * (camera.position[wall.axis] - wall.limit) > .05;
        if (this.root && this.roomLayout) {
            // Both lighting and suspended decoration use the same room-local
            // ceiling plane, including translated/scaled room roots.
            const eye = this.root.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
            const below = eye.y < this.roomLayout.height;
            for (const group of this.root.children)
                if (group === this.ceilingSurface) group.visible = this.ceilingEnabled && below;
                else if (group === this.ceilingFixture || /^Ceiling /i.test(group.name)) group.visible = below;
        }
    }
}
