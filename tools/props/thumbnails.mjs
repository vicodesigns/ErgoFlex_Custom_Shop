#!/usr/bin/env node
// Render a thumbnail of every prop in assets/props/index.json with the same
// Three.js build the studio uses, via Puppeteer.
//   node tools/props/thumbnails.mjs [--only id,id] [--size 256] [--sheet out.png]
// Writes assets/props/thumbs/<id>.png. --sheet also writes a labelled contact
// sheet, which is the quickest way to review scale and orientation decisions.
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : def; };
const only = opt('--only')?.split(',');
const size = Number(opt('--size', 256));
const sheet = opt('--sheet');
const index = JSON.parse(readFileSync(join(root, 'assets/props/index.json'), 'utf8'));
const props = index.props.filter(p => !only || only.includes(p.id));
mkdirSync(join(root, 'assets/props/thumbs'), { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const page_html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script>
<canvas id=c width=${size} height=${size}></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.background = new THREE.Color('#f3f1ec');
const camera = new THREE.PerspectiveCamera(30, 1, .01, 1000);
const key = new THREE.DirectionalLight('#fff', 2.2); key.position.set(3, 6, 4); scene.add(key, new THREE.AmbientLight('#fff', .4));
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let current = null;
window.renderProp = (url) => new Promise((ok, fail) => loader.load(url, (g) => {
    if (current) scene.remove(current);
    current = g.scene; scene.add(current);
    const box = new THREE.Box3().setFromObject(current), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const radius = Math.max(s.x, s.y, s.z) * .5 || 1;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.1;
    camera.position.set(c.x + dist * .62, c.y + dist * .45, c.z + dist * .64); camera.lookAt(c);
    camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    let tris = 0; current.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    ok({ size: s.toArray().map(v => Math.round(v * 1000)), tris: Math.round(tris), png: renderer.domElement.toDataURL('image/png') });
}, undefined, (e) => fail(new Error(String(e?.message || e)))));
window.ready = true;
</script>`;

let sheet_html = '';
const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/__thumb.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
    if (url === '/__sheet.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(sheet_html); }
    const file = join(root, url);
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${port}/__thumb.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });
const rendered = [];
for (const prop of props) {
    try {
        const r = await page.evaluate((url) => window.renderProp(url), '/' + prop.file);
        const file = join(root, 'assets/props/thumbs', `${prop.id}.png`);
        writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
        rendered.push({ ...prop, thumb: file, viewerSize: r.size, viewerTris: r.tris });
        console.log(`✓ ${prop.id.padEnd(22)} ${r.size.join(' × ')} mm  ${r.tris} tris`);
    } catch (e) { console.error(`✗ ${prop.id}: ${e.message}`); }
}
if (sheet) {
    const cols = 8, cell = size, label = 28;
    const rows = Math.ceil(rendered.length / cols);
    sheet_html = `<!doctype html><style>body{margin:0;background:#fff;font:12px system-ui}.g{display:grid;grid-template-columns:repeat(${cols},${cell}px)}.c{width:${cell}px;height:${cell + label}px;border:1px solid #ddd;box-sizing:border-box;text-align:center;overflow:hidden}img{width:${cell}px;height:${cell}px;display:block}</style><div class=g>${rendered.map(r => `<div class=c><img src="/assets/props/thumbs/${r.id}.png"><b>${r.id}</b> ${r.viewerSize.join('×')} · ${r.viewerTris}t</div>`).join('')}</div>`;
    await page.setViewport({ width: cols * cell + 2, height: rows * (cell + label) + 2 });
    await page.goto(`http://127.0.0.1:${port}/__sheet.html`, { waitUntil: 'load' });
    await page.screenshot({ path: sheet, fullPage: true });
    console.log(`contact sheet → ${sheet}`);
}
await browser.close(); server.close();
