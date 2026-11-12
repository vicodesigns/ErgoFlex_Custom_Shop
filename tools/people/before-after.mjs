#!/usr/bin/env node
// Before / after contact sheet of people models, same camera, same posture, old next to new (three.js, as the Studio draws them):
//   node tools/people/before-after.mjs --before <root with the old assets/props> --after <worktree> --ids a,b --out sheet.png [--cols 2] [--w 180] [--h 340] [--shots quarter:0,front:4.4,quarter:4.4]
// Per id: each shot old | new. A shot is view:zoom (zoom 0 = the whole person at room distance, else a close-up on the head).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const before = opt('--before'), after = opt('--after'), ids = opt('--ids').split(','), out = opt('--out'), W = +opt('--w', 180), H = +opt('--h', 340), per = +opt('--cols', 2);
const shots = (opt('--shots', 'quarter:0,front:4.4,quarter:4.4')).split(',').map(s => { const [view, zoom] = s.split(':'); return { view, zoom: +zoom }; });
const puppeteer = createRequire(join(after, 'package.json'))('puppeteer');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png' };
const page_html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script>
<canvas id=c></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.background = new THREE.Color('#dfe3e8');
const camera = new THREE.PerspectiveCamera(24, 1, .05, 100);
const key = new THREE.DirectionalLight('#fff', 2.0); key.position.set(2, 5, 4); scene.add(key, new THREE.AmbientLight('#fff', .35));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: '#b9bec6' })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); let current = null, url0 = null;
window.renderPerson = (url, view, zoom, w, h) => new Promise((ok, fail) => {
    const draw = () => {
        renderer.setSize(w, h, false); camera.aspect = w / h;
        const box = new THREE.Box3().setFromObject(current), c = box.getCenter(new THREE.Vector3()), tall = Math.max(1.9, box.max.y + .1) / (zoom || 1);
        const dist = tall / 2 / Math.tan(THREE.MathUtils.degToRad(12)) * 1.02, a = { front: 0, quarter: 38, side: 90, back: 180, backq: 142 }[view] * Math.PI / 180;
        // close up: on the head, wherever the posture has it, from a little below (people standing by look down)
        let cx = c.x, cz = c.z, cy = tall / 2 - .03;
        if (zoom) { const head = current.getObjectByName('head'); const p = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(c.x, box.max.y - .12, c.z); cx = p.x; cz = p.z; cy = p.y + .06; }
        camera.position.set(cx + Math.sin(a) * dist, cy + dist * (zoom ? -.12 : .12), Math.cos(a) * dist + cz); camera.lookAt(cx, cy, cz); camera.updateProjectionMatrix();
        renderer.render(scene, camera); ok(renderer.domElement.toDataURL('image/png'));
    };
    if (url === url0) return draw();
    loader.load(url, g => {
        if (current) { scene.remove(current); current.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); } } }); }
        current = g.scene; url0 = url; scene.add(current); current.updateMatrixWorld(true); draw();
    }, undefined, e => fail(new Error(String(e?.message || e))));
});
window.ready = true;
</script>`;
let sheet_html = '';
const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/__p.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
    if (url === '/__sheet.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(sheet_html); }
    const root = url.startsWith('/b/') ? before : after, file = join(root, url.slice(2)); if (!existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage(); page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${port}/__p.html`, { waitUntil: 'networkidle0' }); await page.waitForFunction('window.ready === true', { timeout: 60000 });
const groups = [];
for (const id of ids) {
    const cells = [];
    for (const shot of shots) for (const [tag, base] of [['before', '/b'], ['after', '/a']]) {
        if (tag === 'before' && !before) continue;
        const w = shot.zoom ? Math.round(H * .62) : W;
        try { cells.push({ tag, w, png: await page.evaluate((u, v, z, w, h) => window.renderPerson(u, v, z, w, h), `${base}/assets/props/${id}.glb`, shot.view, shot.zoom, w, H) }); }
        catch (e) { cells.push({ tag, w, png: '' }); console.error('x ' + tag + ' ' + id + ': ' + e.message); }
    }
    groups.push({ id, cells });
}
const gw = groups[0].cells.reduce((s, c) => s + c.w, 0) + 8;
sheet_html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff;font:12px system-ui}.g{display:grid;grid-template-columns:repeat(${per},${gw}px)}.p{width:${gw}px;box-sizing:border-box;border:1px solid #bbb;padding:3px}.r{display:flex}.c{position:relative}.c span{position:absolute;left:3px;top:2px;background:#fffc;padding:0 3px;font-size:10px}img{display:block}</style><div class=g>` +
    groups.map(g => `<div class=p><b>${g.id.replace('people-', '')}</b><div class=r>${g.cells.map(c => `<div class=c><span>${c.tag}</span><img src="${c.png}" width=${c.w} height=${H}></div>`).join('')}</div></div>`).join('') + '</div>';
await page.setViewport({ width: per * gw + 2, height: Math.ceil(groups.length / per) * (H + 26) + 2 }); await page.goto(`http://127.0.0.1:${port}/__sheet.html`, { waitUntil: 'load' }); await page.screenshot({ path: out, fullPage: true });
console.log('sheet -> ' + out + ' (' + groups.length + ' people)'); await browser.close(); server.close();
