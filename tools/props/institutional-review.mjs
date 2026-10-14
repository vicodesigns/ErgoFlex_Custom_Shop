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
//   --only a,b         room IDs (`all` = institutions; `remaining` = this polish pass)
//   --out DIR          output directory (default /tmp/ef-institutional-shots)
//   --tiers t1,t2      restrict tiers (default: every tier of each scene)
//   --phases p1,p2     restrict dayparts (default: all five)
//   --angles a1,a2     cameras: wide,hero,reverse,activity (default: wide,hero,reverse)
//   --reference r1,r2  reference rooms (default office,coworking,library; `none` skips)
//   --ratio 0.75       renderer pixel ratio (viewport is 1280x800)
//   --activity-details also capture house activity close-ups at afternoon/night
//   --resume           keep completed layout captures in the same output folder
//
// Memory: exactly one Chromium process exists at a time. It is relaunched per
// scene (software WebGL leaks between large rooms) and always closed on exit,
// so review jobs should run sequentially. Browser storage is isolated; user
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
const activityDetails = args.includes('--activity-details');
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
const previous = args.includes('--resume') && existsSync(join(outDir, 'report.json'))
    ? JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) : null;
const errors = previous?.errors || [], report = previous?.report || [];
function completed(id, tier) {
    if (!previous) return false;
    return PHASES.every(phase => report.some(r => r.id === id && r.tier === tier && r.phase === phase) &&
        ANGLES.every(angle => existsSync(join(outDir, `${id}-${tier}-${phase}-${angle}.png`))) &&
        (!activityDetails || tier !== 'house' || !['afternoon', 'night'].includes(phase) ||
            ['activity','desktop'].every(angle => existsSync(join(outDir, `${id}-${tier}-${phase}-${angle}.png`)))));
}
const launchOptions = { headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] };
async function registryOnly() {
    // Registry discovery needs modules, not a fully furnished Security room.
    // Keep the same origin/import map while avoiding an extra model load.
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    const imports = readFileSync(join(root, 'index.html'), 'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0];
    if (!imports) throw new Error('Review renderer needs the application import map');
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) request.respond({ status: 200, contentType: 'text/html', body: `<!doctype html>${imports}` });
        else request.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page.evaluate(async () => {
        const m = await import('./institutional-scenes.mjs?v=hbhs-classroom-20261013');
        const registry = Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.keys(m.INSTITUTIONAL_ROOMS[id].layouts)]));
        for (const id of ['home','office','library','coworking','music','gaming','creative','study','lounge','kitchen','gym','scifi','bedroom','workshop','gallery']) {
            const file = id === 'home' ? 'home-office' : id === 'creative' ? 'artist-room' : id + '-room';
            const mod = await import('./' + file + '.mjs');
            const layouts = Object.entries(mod).find(([key]) => /^[A-Z]+_LAYOUTS$/.test(key))?.[1];
            if (!layouts) throw new Error('Missing layout registry for ' + id);
            registry[id] = Object.keys(layouts);
        }
        return registry;
    });
}
async function openRoom(id, tier) {
    // Never more than one browser: close the previous one first.
    if (browser) { await browser.close(); browser = null; }
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage(); page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', e => { errors.push(`${id}: ${e.message}`); console.error('page error:', e.message); });
    page.on('console', m => { if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text())) { errors.push(`${id}: ${m.text()}`); console.error(m.text()); } });
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${url}?room=${id}${tier ? '&layout=' + tier : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ErgoFlex?.renderer);
    await page.evaluate(r => { ErgoFlex.renderer.setPixelRatio(r); ErgoFlex.renderer.setAnimationLoop(null); }, ratio);
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none');
    // Stop continuous full-resolution software rendering before station GLBs
    // finish loading. Capture only the requested frames; this also avoids
    // exhausting Chromium while reviewing the larger institutional layouts.
    await page.evaluate(async r => {
        ErgoFlex.renderer.setPixelRatio(r); ErgoFlex.renderer.setAnimationLoop(null);
        window.__three = await import('three'); await ErgoFlex.workspaceRoom.ready;
    }, ratio);
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
        // Transform-following overlays update in onBeforeRender. Initialise
        // them before fitting a camera, so their uninitialised millimetre
        // geometry cannot make the first overview shrink to a tiny room.
        ef.workspaceRoom.root.updateWorldMatrix(true, true);
        if (window.__reviewOverlayRoot !== ef.workspaceRoom.root) {
            ef.renderer.render(ef.roomInteractions.scene, ef.roomInteractions.camera);
            window.__reviewOverlayRoot = ef.workspaceRoom.root;
        }
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
        } else if (angle === 'activity') {
            const kit = room.life.activity;
            const box = new THREE.Box3().setFromObject(kit), center = box.getCenter(new THREE.Vector3());
            target = center; eye = center.clone().add(new THREE.Vector3(.3, .5, .42));
        } else if (angle === 'desktop') {
            const mount = ef.workspaceAccessories.mounts.get('desktop');
            const kit = mount.dress.children.find(o => o.userData.dayKit);
            const box = new THREE.Box3().setFromObject(kit), center = box.getCenter(new THREE.Vector3());
            target = center; eye = center.clone().add(new THREE.Vector3(.32, .42, .35));
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
            atmosphere: r.root.userData.institutionalAtmosphere, polish: r.root.userData.polish, story: r.root.userData.dailyStory, surfaceDetail: r.root.userData.surfaceDetail, pointLights: r.root.children.filter(o => o.isPointLight).length, drawCalls: ErgoFlex.renderer.info.render.calls, triangles: ErgoFlex.renderer.info.render.triangles };
    }, { id, tier, phase });
}

try {
    const registry = await registryOnly();
    let page;
    if (only.includes('all')) only = Object.keys(registry).filter(id => !['home','office','library','coworking','music','gaming','creative','study','lounge','kitchen','gym','scifi','bedroom','workshop','gallery'].includes(id));
    if (only.includes('remaining')) only = Object.keys(registry).filter(id => !['hospital','laboratory','mobileit'].includes(id));
    if (only.includes('catalog')) only = Object.keys(registry);
    const unknown = only.filter(id => !registry[id]); if (unknown.length) throw new Error('Unknown room(s): ' + unknown.join(', ') + '. Known: ' + Object.keys(registry).join(', '));
    for (const id of only) {
        const tiers = registry[id].filter(t => (!tierFilter || tierFilter.includes(t)) && !completed(id, t));
        if (!tiers.length) continue;
        page = await openRoom(id, tiers[0]);
        for (const tier of tiers) {
            // An interrupted layout is recaptured as a unit, without duplicate stats.
            for (let i = report.length - 1; i >= 0; i--) if (report[i].id === id && report[i].tier === tier) report.splice(i, 1);
            await selectLayout(page, id, tier);
            for (const phase of PHASES) {
                for (const angle of ANGLES) await shoot(page, id, tier, phase, angle, `${id}-${tier}-${phase}-${angle}.png`);
                if (activityDetails && tier === 'house' && ['afternoon', 'night'].includes(phase) && !ANGLES.includes('activity')) {
                    await shoot(page, id, tier, phase, 'activity', `${id}-${tier}-${phase}-activity.png`);
                    await shoot(page, id, tier, phase, 'desktop', `${id}-${tier}-${phase}-desktop.png`);
                }
                report.push(await stats(page, id, tier, phase));
            }
            writeFileSync(join(outDir, 'report.json'), JSON.stringify({ errors, report }, null, 2));
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
