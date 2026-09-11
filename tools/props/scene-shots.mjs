#!/usr/bin/env node
// Screenshot every room scene in the studio, for reviewing prop placement.
//   node tools/props/scene-shots.mjs [--out dir] [--only id,id] [--views hero,front,top]
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
