#!/usr/bin/env node
// Close-up stills of people models wearing the cast finishes (media-cast-finishes.mjs), without a room: one model, one
// small page, software GL. For judging hair edges, fabric, skin and eyes before asking for a film still.
//   node tools/people/finish-preview.mjs --ids people-maya-sit-type,people-andre-stand-wait --out sheet.png
//        [--before <folder with another media-cast-finishes.mjs (and optionally the modules it imports)>]
//        [--shots face,nape,torso,body] [--size 640] [--relief 1] [--colors top=#2d7d8a,bottom=#1f2228]
// Each row is one shot of one model: (before |) after. Shots: face (three-quarter close-up), front, nape (from behind the
// ear), side, torso, hips, hands, body. The light is a warm key from the upper left, a cool fill and the neutral room
// environment the Studio uses, tone-mapped as the Studio does (Neutral, 1.02): not a film frame, the same for both sides.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const ids = (opt('--ids') || '').split(',').filter(Boolean), out = opt('--out'), before = opt('--before'), size = +opt('--size', 640), relief = +opt('--relief', 1);
const shots = opt('--shots', 'face,nape,torso').split(','), colors = opt('--colors', '');
if (!ids.length || !out) { console.error('usage: finish-preview.mjs --ids a,b --out sheet.png [--before dir] [--shots face,nape,torso,body] [--size 640]'); process.exit(2); }
const puppeteer = createRequire(join(ROOT, 'package.json'))('puppeteer');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const page_html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#000}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<canvas id=c></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const NOT_WORN = /^(body|low-poly|teeth|tongue|eyebrow|eyelashes|eyes)/i, PARTS = { glasses: /glasses/i, shoes: /shoe|flats|boot|sneaker/i, bottom: /pants|skirt|jeans|shorts|trousers/i, hair: /hair|ponytail|afro|bob|braid|bun|^short\\d|^long\\d|mohawk|pigtail/i };
const partOf = name => { if (!/^Human\\./.test(name || '')) return null; const n = name.slice(6); if (NOT_WORN.test(n)) return null; for (const [part, re] of Object.entries(PARTS)) if (re.test(n)) return part; return 'top'; };
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.02; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
const scene = new THREE.Scene(); scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55; scene.background = new THREE.Color('#9aa3ad');
const camera = new THREE.PerspectiveCamera(20, 1, .05, 100);
const key = new THREE.DirectionalLight('#ffe9cf', 2.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 3; key.shadow.bias = -.0004;
Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 2.2, bottom: -.4, near: .5, far: 12 }); key.shadow.camera.updateProjectionMatrix();
const fill = new THREE.DirectionalLight('#c9dcff', .55), rim = new THREE.DirectionalLight('#ffffff', .9);
scene.add(key, key.target, fill, rim, new THREE.AmbientLight('#fff', .18));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: .9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const finishes = {}, models = new Map();
const tintOf = text => Object.fromEntries((text || '').split(',').filter(Boolean).map(s => s.split('=')));
async function person(side, id, relief, tint) {
    const k = side + '|' + id; if (models.has(k)) return models.get(k);
    const F = finishes[side] ||= await import('/' + side + '/media-cast-finishes.mjs'); const cast = await F.castDetailEnsure(); if (!cast) throw new Error('finish maps failed');
    const g = await loader.loadAsync('/root/assets/props/' + id + '.glb'), object = g.scene, done = new Map();
    F.rootsTapers?.(object);      // (as workspace-3d.mjs does where it loads a people model)
    object.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
        const swap = m => { if (!done.has(m)) { const part = partOf(m.name), v = F.castDetailTouches(m, part) ? F.mediaPersonMaterial(m, cast, part, relief) : m;
            const hex = tint[part]; if (hex && v.color) { v.color.set(hex).multiplyScalar(1.6); }   // (a plain multiply: enough to judge a dark or a bright garment)
            done.set(m, v); } return done.get(m); };
        o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); });
    models.set(k, object); return object;
}
let shown = null;
window.renderPerson = async (side, id, shot, w, h, relief, tintText) => {
    const object = await person(side, id, relief, tintOf(tintText));
    if (shown !== object) { if (shown) scene.remove(shown); scene.add(shown = object); object.updateMatrixWorld(true); }
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const bone = n => { const b = object.getObjectByName(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
    const box = new THREE.Box3().setFromObject(object), head = bone('head') || new THREE.Vector3(0, box.max.y - .12, 0), neck = bone('neck_01') || head, chest = bone('spine_03') || head.clone().setY(head.y - .3), pelvis = bone('pelvis') || chest.clone().setY(chest.y - .4), hand = bone('hand_r') || chest;
    // the way the head faces: the model's own +z turned by the head bone
    const hb = object.getObjectByName('head'), facing = new THREE.Vector3(0, 0, 1); if (hb) { const q = hb.getWorldQuaternion(new THREE.Quaternion()), rest = new THREE.Vector3(0, 1, 0).applyQuaternion(q); facing.set(0, 0, 1); void rest; }
    const body = Math.atan2(facing.x, facing.z);
    const S = { face: [head.clone().add(new THREE.Vector3(0, .07, 0)), 32, 0, .40], front: [head.clone().add(new THREE.Vector3(0, .07, 0)), 0, 2, .40], side: [head.clone().add(new THREE.Vector3(0, .06, 0)), 88, 2, .46],
        nape: [neck.clone().add(new THREE.Vector3(0, .07, 0)), 148, 6, .44], torso: [chest.clone().add(new THREE.Vector3(0, -.04, 0)), 28, 4, .80], back: [chest.clone().add(new THREE.Vector3(0, -.04, 0)), 160, 6, .86],
        hips: [pelvis.clone().add(new THREE.Vector3(0, -.12, 0)), 140, 4, .86], hands: [hand, 30, 30, .34], body: [box.getCenter(new THREE.Vector3()), 30, 6, Math.max(1.95, box.max.y + .12)] }[shot];
    const [at, yaw, pitch, tall] = S, dist = tall / 2 / Math.tan(THREE.MathUtils.degToRad(10)), a = body + yaw * Math.PI / 180, p = pitch * Math.PI / 180;
    camera.position.set(at.x + Math.sin(a) * Math.cos(p) * dist, at.y + Math.sin(p) * dist, at.z + Math.cos(a) * Math.cos(p) * dist); camera.lookAt(at); camera.updateProjectionMatrix();
    // key from the camera's upper left, fill from its right, rim from behind
    const L = (light, yawOff, up, d) => { const b = a + yawOff * Math.PI / 180; light.position.set(at.x + Math.sin(b) * d, at.y + up, at.z + Math.cos(b) * d); if (light.target) { light.target.position.copy(at); light.target.updateMatrixWorld(); } };
    L(key, -42, 2.2, 4); L(fill, 55, .4, 4); L(rim, 165, 1.6, 4);
    renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r)); renderer.render(scene, camera);
    // as a film frame is taken (the canvas drawn onto a 2D one, then encoded): where the canvas's alpha is below 1 it goes dark
    const flat = document.createElement('canvas'); flat.width = w; flat.height = h; const g = flat.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.drawImage(renderer.domElement, 0, 0);
    return flat.toDataURL('image/png');
};
window.ready = true;
</script>`;
let sheet_html = '';
const serve = (res, file) => { if (!existsSync(file) || !statSync(file).isFile()) { if (!/favicon/.test(file)) console.error('404 ' + file); res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(readFileSync(file)); };
const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/__p.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
    if (url === '/__sheet.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(sheet_html); }
    if (url.startsWith('/three/')) return serve(res, join(ROOT, 'node_modules', 'three', url.slice(7)));
    if (url.startsWith('/root/')) return serve(res, join(ROOT, url.slice(6)));
    // /after/<file>: this checkout; /before/<file>: the other folder's file if it has one, else this checkout's
    if (url.startsWith('/after/')) return serve(res, join(ROOT, url.slice(7)));
    if (url.startsWith('/before/')) { const own = before && join(before, url.slice(8)); return serve(res, own && existsSync(own) ? own : join(ROOT, url.slice(8))); }
    if (url !== '/favicon.ico') console.error('404 ' + url); res.writeHead(404); res.end();
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
    const page = await browser.newPage(); page.on('pageerror', e => console.error('page error:', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
    await page.goto(`http://127.0.0.1:${port}/__p.html`, { waitUntil: 'networkidle0' }); await page.waitForFunction('window.ready === true', { timeout: 60000 });
    const rows = [], sides = before ? ['before', 'after'] : ['after'];
    for (const id of ids) for (const shot of shots) {
        const cells = [];
        for (const side of sides) {
            try { cells.push({ side, png: await page.evaluate((s, i, sh, w, h, r, c) => window.renderPerson(s, i, sh, w, h, r, c), side, id, shot, size, size, relief, colors) }); }
            catch (e) { cells.push({ side, png: '' }); console.error('x ' + side + ' ' + id + ' ' + shot + ': ' + e.message); }
        }
        rows.push({ id, shot, cells });
    }
    sheet_html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff;font:13px system-ui}.r{display:flex}.c{position:relative}.c span{position:absolute;left:4px;top:3px;background:#fffc;padding:0 4px}img{display:block}</style>` +
        rows.map(r => `<div class=r>${r.cells.map(c => `<div class=c><span>${r.id.replace('people-', '')} · ${r.shot} · ${c.side}</span><img src="${c.png}" width=${size} height=${size}></div>`).join('')}</div>`).join('');
    await page.setViewport({ width: sides.length * size, height: rows.length * size }); await page.goto(`http://127.0.0.1:${port}/__sheet.html`, { waitUntil: 'load' }); await page.screenshot({ path: out, fullPage: true });
    console.log('sheet -> ' + out + ' (' + rows.length + ' rows)');
} finally { await browser.close(); server.close(); }
