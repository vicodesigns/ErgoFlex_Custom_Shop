#!/usr/bin/env node
// Institutional scene review renderer (one headless browser at a time).
//
//   node tools/props/institutional-review.mjs --only security,police --out /tmp/review-gov
//
// For every scene in --only and each of its layout tiers (Small/Medium/Large =
// apartment/house/spacious; Educational stages have one), renders all five
// dayparts (morning, afternoon, evening, night, party) from three cameras:
//   wide     high overview from the open front / window corner (auto-fitted)
//   hero     user-side, right of the main ErgoFlex desk, toward it and the back wall
//   reverse  from behind the back-right corner toward the window wall and front
// plus reference shots of existing rooms (default office, coworking, library:
// afternoon wide + hero, night wide) for side-by-side comparison.
//
// Output (PNG, --out dir, created if missing):
//   <scene>-<tier>-<phase>-<angle>.png   e.g. police-house-night-hero.png
//   ref-<room>-<tier>-<phase>-<angle>.png e.g. ref-office-house-afternoon-wide.png
//   report.json (missing props, stations, draw calls, triangles, page errors)
//
// Images are 1280x800 CSS px at --ratio (0.75 -> 960x600 PNG).
// Options:
//   --only a,b         institutional scene IDs (required; `all` = every one)
//   --out DIR          output directory (default /tmp/ef-institutional-shots)
//   --tiers t1,t2      restrict tiers (default: every tier of each scene)
//   --phases p1,p2     restrict dayparts (default: all five)
//   --angles a1,a2     restrict cameras (default: wide,hero,reverse)
//   --reference r1,r2  reference rooms (default office,coworking,library; `none` skips)
//   --ratio 0.75       renderer pixel ratio (viewport is 1280x800)
//
// Memory: exactly one Chromium process exists at a time. It is relaunched per
// scene (software WebGL leaks between large rooms) and always closed on exit,
// so two reviewers can run concurrently. Browser storage is isolated; user
// projects are not modified.
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const list = (n, d) => { const v = opt(n); return v ? v.split(',').map(s => s.trim()).filter(Boolean) : d; };
const outDir = resolve(opt('--out', '/tmp/ef-institutional-shots'));
const PHASES = list('--phases', ['morning', 'afternoon', 'evening', 'night', 'party']);
const ANGLES = list('--angles', ['wide', 'hero', 'reverse']);
const tierFilter = list('--tiers', null);
const refs = (opt('--reference') === 'none') ? [] : list('--reference', ['office', 'coworking', 'library']);
const ratio = Number(opt('--ratio', '0.75'));
let only = list('--only', null);
if (!only) { console.error('Usage: node tools/props/institutional-review.mjs --only security,police [--out DIR] (see header)'); process.exit(2); }
mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(root, name === '/' ? 'index.html' : name);
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

let browser = null;
const errors = [], report = [];
async function openRoom(id, tier) {
    // Never more than one browser: close the previous one first.
    if (browser) { await browser.close(); browser = null; }
    browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(); page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', e => { errors.push(`${id}: ${e.message}`); console.error('page error:', e.message); });
    page.on('console', m => { if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text())) { errors.push(`${id}: ${m.text()}`); console.error(m.text()); } });
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${url}?room=${id}&view=room${tier ? '&layout=' + tier : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none');
    await page.evaluate(async () => { window.__three = await import('three'); await ErgoFlex.workspaceRoom.ready; });
    await page.addStyleTag({ content: '#motion-dock{visibility:hidden!important}' });
    await page.evaluate(r => { ErgoFlex.setShellMode('studio'); ErgoFlex.renderer.setPixelRatio(r); ErgoFlex.renderer.setAnimationLoop(null); }, ratio);
    return page;
}
async function selectLayout(page, id, tier) {
    return page.evaluate(async ({ id, tier }) => {
        if (ErgoFlex.workspaceRoom.id !== id || ErgoFlex.measuredRoom?.layout.id !== tier) ErgoFlex.setMeasuredRoomLayout(id, tier);
        await ErgoFlex.workspaceRoom.ready; return ErgoFlex.measuredRoom.layout.id;
    }, { id, tier });
}
async function shoot(page, id, tier, phase, angle, file) {
    await page.evaluate(({ id, phase }) => {
        const THREE = window.__three, ef = ErgoFlex;
        ef.setMeasuredRoomMode(id, phase, false); const look = ef.measuredRoom.modes[phase];
        ef.setLedsEnabled(look.leds); if (look.color) ef.setLedColor(look.color, false);
        ef.setHeight(look.height); ef.setTilt('tilting', look.tilt);
        ef.workspaceAccessories.update();
        // The paused render loop would freeze the blue 'Lift up' motion pixels; show the authored colour.
        ef.setLedMotionEnabled?.(false); if (look.color) ef.setLedColor(look.color, false);
        ef.roomLedSpill.update(ef.workspaceRoom, ef.ledPixelRenderer, { enabled: look.leds, colour: new THREE.Color(look.color || ef.ledColor), gain: 1.8 });
    }, { id, phase });
    await page.evaluate(angle => {
        const THREE = window.__three, ef = ErgoFlex, room = ef.workspaceRoom, { camera, controls } = ef.roomInteractions, l = room.roomLayout;
        // Render the full 1280x800 frame, independent of the Studio panel layout.
        ef.renderer.setSize(1280, 800, false); camera.aspect = 1280 / 800; camera.updateProjectionMatrix();
        room.root.updateWorldMatrix(true, true);
        const world = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(room.root.matrixWorld);
        const { width: w, depth: d, back: bz, height: ceiling } = l, front = bz + d, [dx, dz] = l.desk;
        controls.enableDamping = false; controls.minDistance = 0.01; controls.maxDistance = 1000;
        let eye, target;
        if (angle === 'wide') {
            // Fit the whole room from the open front / window corner.
            const box = new THREE.Box3().setFromObject(room.root).expandByObject(ef.loadedModel), center = box.getCenter(new THREE.Vector3());
            const direction = new THREE.Vector3(5, 4, 5).normalize(), right = new THREE.Vector3().crossVectors(camera.up, direction).normalize(), up = new THREE.Vector3().crossVectors(direction, right).normalize();
            const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect; let distance = 0;
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                const point = new THREE.Vector3(x, y, z).sub(center), depth = point.dot(direction);
                distance = Math.max(distance, depth + Math.abs(point.dot(up)) / tanV, depth + Math.abs(point.dot(right)) / tanH);
            }
            target = center; eye = center.clone().addScaledVector(direction, distance * 1.05);
        } else if (angle === 'hero') {
            eye = world(dx + 2500, 1900, dz + 2300); target = world(dx, 800, dz - 300);
        } else {
            // reverse: outside the back-right corner (both walls cut away).
            eye = world(w / 2 + 900, Math.min(ceiling + 600, 3900), bz - 900); target = world(-w * .15, 900, bz + d * .6);
        }
        controls.target.copy(target); camera.position.copy(eye); camera.lookAt(target); controls.update(); room.update(camera);
    }, angle);
    await new Promise(r => setTimeout(r, 100));
    const png = await page.evaluate(() => {
        const ef = ErgoFlex; ef.renderer.render(ef.roomInteractions.scene, ef.roomInteractions.camera);
        const source = ef.renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
        const c = canvas.getContext('2d'), look = ef.workspaceRoom.root.userData.polish || { halo: '#e9ecef', edge: '#c9ced3' }, W = canvas.width, H = canvas.height;
        c.save(); c.translate(W * .48, H * .32); c.scale(W, H); const gradient = c.createRadialGradient(0, 0, 0, 0, 0, .7); gradient.addColorStop(0, look.halo); gradient.addColorStop(.9, look.edge); gradient.addColorStop(1, look.edge); c.fillStyle = gradient; c.fillRect(-1, -1, 2, 2); c.restore(); c.drawImage(source, 0, 0);
        return canvas.toDataURL('image/png').split(',')[1];
    });
    writeFileSync(join(outDir, file), Buffer.from(png, 'base64'));
}
async function stats(page, id, tier, phase) {
    return page.evaluate(({ id, tier, phase }) => {
        const r = ErgoFlex.workspaceRoom;
        return { id, tier, phase, missing: r.missingProps, stations: r.assets().filter(o => o.userData.officeStation).map(o => ({ key: o.userData.sceneAssetKey, size: o.userData.officeStation.size, turn: o.userData.officeStation.turn })),
            atmosphere: r.root.userData.institutionalAtmosphere, drawCalls: ErgoFlex.renderer.info.render.calls, triangles: ErgoFlex.renderer.info.render.triangles };
    }, { id, tier, phase });
}

try {
    let page = await openRoom('security', null);
    const registry = await page.evaluate(async () => { const m = await import('./institutional-scenes.mjs?v=institutional-sweep-20261009'); return Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.keys(m.INSTITUTIONAL_ROOMS[id].layouts)])); });
    if (only.includes('all')) only = Object.keys(registry);
    const unknown = only.filter(id => !registry[id]); if (unknown.length) throw new Error('Unknown institutional scene(s): ' + unknown.join(', ') + '. Known: ' + Object.keys(registry).join(', '));
    for (const id of only) {
        const tiers = registry[id].filter(t => !tierFilter || tierFilter.includes(t));
        for (const tier of tiers) {
            page = await openRoom(id, tier);
            await selectLayout(page, id, tier);
            for (const phase of PHASES) {
                for (const angle of ANGLES) await shoot(page, id, tier, phase, angle, `${id}-${tier}-${phase}-${angle}.png`);
                report.push(await stats(page, id, tier, phase));
            }
            console.log(`Reviewed ${id}/${tier}: ${PHASES.length} phases × ${ANGLES.length} angles`);
        }
    }
    for (const ref of refs) {
        page = await openRoom(ref, 'house');
        const tier = await selectLayout(page, ref, 'house');
        for (const [phase, angle] of [['afternoon', 'wide'], ['afternoon', 'hero'], ['night', 'wide']]) await shoot(page, ref, tier, phase, angle, `ref-${ref}-${tier}-${phase}-${angle}.png`);
        report.push({ ...(await stats(page, ref, tier, 'afternoon')), reference: true });
        console.log(`Reference ${ref}/${tier}`);
    }
    writeFileSync(join(outDir, 'report.json'), JSON.stringify({ errors, report }, null, 2));
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    console.log(`screenshots → ${outDir}`);
} finally { if (browser) await browser.close(); server.close(); }
