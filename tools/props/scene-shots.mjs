#!/usr/bin/env node
// Screenshot every room scene in the studio, for reviewing prop placement.
//   node tools/props/scene-shots.mjs [--out dir] [--only id,id] [--views hero,front,top]
//   --gaming-layout house --gaming-mode evening --home-layout apartment
//   --music-layout executive --music-mode party
//   --artist-layout premium --artist-mode afternoon
//   --office-layout spacious --office-mode afternoon
// Starts its own static server and loads the real app, so it needs network
// access for Three.js and the desk model, like the smoke test.
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const outDir = resolve(opt('--out', join(root, 'scene-shots')));
const only = opt('--only')?.split(',');
const views = opt('--views', 'hero,front').split(',');
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

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.setViewport({ width: 1500, height: 1200 });
await page.goto(url + (args.includes('--setup') ? '?setup' : ''));
await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 120000 });
await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).display === 'none');
await page.evaluate(() => ErgoFlex.renderer.setPixelRatio(1));

const scenes = (await page.evaluate(() => ErgoFlex.roomScenes.map(s => s.id))).filter(id => !only || only.includes(id));
for (const id of scenes) {
    await page.evaluate(async (sceneId) => {
        ErgoFlex.setRoomScene(sceneId);
        await ErgoFlex.workspaceRoom.ready.catch(() => {});
        await new Promise(r => setTimeout(r, 400));
    }, id);
    if (id === 'home' && opt('--home-layout')) {
        await page.evaluate(async layout => {
            ErgoFlex.setHomeLayout(layout);
            await ErgoFlex.workspaceRoom.ready;
        }, opt('--home-layout'));
    }
    if (id === 'gaming') {
        if (opt('--gaming-layout')) await page.evaluate(async layout => {
            ErgoFlex.setGamingLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--gaming-layout'));
        if (opt('--gaming-mode')) await page.evaluate(mode => ErgoFlex.setGamingMode(mode), opt('--gaming-mode'));
    }
    if (id === 'music') {
        if (opt('--music-layout')) await page.evaluate(async layout => {
            ErgoFlex.setMusicLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--music-layout'));
        if (opt('--music-mode')) await page.evaluate(mode => ErgoFlex.setMusicMode(mode), opt('--music-mode'));
    }
    if (id === 'creative') {
        if (opt('--artist-layout')) await page.evaluate(async layout => {
            ErgoFlex.setArtistLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--artist-layout'));
        if (opt('--artist-mode')) await page.evaluate(mode => ErgoFlex.setArtistMode(mode), opt('--artist-mode'));
    }
    if (id === 'study') {
        if (opt('--study-layout')) await page.evaluate(async layout => {
            ErgoFlex.setStudyLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--study-layout'));
        if (opt('--study-mode')) await page.evaluate(mode => ErgoFlex.setStudyMode(mode), opt('--study-mode'));
    }
    if (id === 'library') {
        if (opt('--library-layout')) await page.evaluate(async layout => {
            ErgoFlex.setLibraryLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--library-layout'));
        if (opt('--library-mode')) await page.evaluate(mode => ErgoFlex.setLibraryMode(mode), opt('--library-mode'));
    }
    if (id === 'coworking') {
        if (opt('--coworking-layout')) await page.evaluate(async layout => {
            ErgoFlex.setCoworkingLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--coworking-layout'));
        if (opt('--coworking-mode')) await page.evaluate(mode => ErgoFlex.setCoworkingMode(mode), opt('--coworking-mode'));
    }
    if (id === 'office') {
        if (opt('--office-layout')) await page.evaluate(async layout => {
            ErgoFlex.setOfficeLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--office-layout'));
        if (opt('--office-mode')) await page.evaluate(mode => ErgoFlex.setOfficeMode(mode), opt('--office-mode'));
    }
    if (id === 'gym') {
        if (opt('--gym-layout')) await page.evaluate(async layout => {
            ErgoFlex.setGymLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--gym-layout'));
        if (opt('--gym-mode')) await page.evaluate(mode => ErgoFlex.setGymMode(mode), opt('--gym-mode'));
    }
    if (id === 'kitchen') {
        if (opt('--kitchen-layout')) await page.evaluate(async layout => {
            ErgoFlex.setKitchenLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--kitchen-layout'));
        if (opt('--kitchen-mode')) await page.evaluate(mode => ErgoFlex.setKitchenMode(mode), opt('--kitchen-mode'));
    }
    if (id === 'scifi') {
        if (opt('--scifi-layout')) await page.evaluate(async layout => {
            ErgoFlex.setScifiLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--scifi-layout'));
        if (opt('--scifi-mode')) await page.evaluate(mode => ErgoFlex.setScifiMode(mode), opt('--scifi-mode'));
    }
    if (id === 'gallery') {
        if (opt('--gallery-layout')) await page.evaluate(async layout => {
            ErgoFlex.setGalleryLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--gallery-layout'));
        if (opt('--gallery-mode')) await page.evaluate(mode => ErgoFlex.setGalleryMode(mode), opt('--gallery-mode'));
    }
    if (id === 'bedroom') {
        if (opt('--bedroom-layout')) await page.evaluate(async layout => {
            ErgoFlex.setBedroomLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--bedroom-layout'));
        if (opt('--bedroom-mode')) await page.evaluate(mode => ErgoFlex.setBedroomMode(mode), opt('--bedroom-mode'));
    }
    if (id === 'workshop') {
        if (opt('--workshop-layout')) await page.evaluate(async layout => {
            ErgoFlex.setWorkshopLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--workshop-layout'));
        if (opt('--workshop-mode')) await page.evaluate(mode => ErgoFlex.setWorkshopMode(mode), opt('--workshop-mode'));
    }
    if (id === 'lounge') {
        if (opt('--lounge-layout')) await page.evaluate(async layout => {
            ErgoFlex.setLoungeLayout(layout); await ErgoFlex.workspaceRoom.ready;
        }, opt('--lounge-layout'));
        if (opt('--lounge-mode')) await page.evaluate(mode => ErgoFlex.setLoungeMode(mode), opt('--lounge-mode'));
    }
    for (const view of views) {
        await page.select('#camera-view', view);
        await new Promise(r => setTimeout(r, 900));
        await page.screenshot({ path: join(outDir, `${id}-${view}.png`), clip: await page.$eval('#model-canvas', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
    }
    const missing = await page.evaluate(() => ErgoFlex.workspaceRoom.missingProps);
    console.log(`${id}${missing.length ? '  MISSING: ' + missing.join(', ') : ''}`);
}
await browser.close(); server.close();
console.log(`screenshots → ${outDir}`);
