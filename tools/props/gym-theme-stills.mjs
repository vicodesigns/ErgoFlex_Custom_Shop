#!/usr/bin/env node
// Stills of every gym layout in each colourway, from one browser session.
//   node tools/props/gym-theme-stills.mjs [--out dir] [--themes green,blackred]
//        [--modes afternoon,party,night] [--layouts apartment,house] [--views room,hero]
//        [--width 1500 --height 1000]
// Writes <out>/gym-<theme>-<layout>-<mode>-<view>.png. A tree without
// setGymTheme can only shoot green (used for the pre-change baseline).
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const outDir = resolve(opt('--out', join(root, 'exports/gym-theme-stills')));
const themes = opt('--themes', 'green,blackred').split(','), modes = opt('--modes', 'afternoon,party,night').split(',');
const layouts = opt('--layouts', 'apartment,house,spacious,premium,executive').split(','), views = opt('--views', 'room').split(',');
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
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.setViewport({ width: +opt('--width', 1500), height: +opt('--height', 1000) });
    await page.goto(`http://127.0.0.1:${server.address().port}/?room=gym&view=room`);
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 180000 });
    await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(1); await ErgoFlex.workspaceRoom.ready; });
    // Give the viewer the whole window: collapse the product column and the scene controls.
    await page.evaluate(() => { document.getElementById('config-collapse')?.click(); const t = document.getElementById('lab-preview-toggle'); if (t && !document.getElementById('scene-controls')?.hidden) t.click(); });
    // Hide every HTML overlay (remote, toolbars, captions) so only the WebGL frame shows.
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #model-canvas { visibility: visible !important; }' });
    await new Promise(r => setTimeout(r, 1500));
    for (const theme of themes) {
        const ok = await page.evaluate(t => { if (ErgoFlex.setGymTheme) { ErgoFlex.setGymTheme(t); return true; } return t === 'green'; }, theme);
        if (!ok) { console.error(`no setGymTheme: skipping ${theme}`); continue; }
        for (const layout of layouts) {
            await page.evaluate(async l => { ErgoFlex.setGymLayout(l); await ErgoFlex.workspaceRoom.ready; }, layout);
            for (const mode of modes) {
                await page.evaluate(m => ErgoFlex.setGymMode(m), mode);
                // Wait for the desk to reach the mode's posture so stills are comparable.
                await page.waitForFunction(m => { const p = ErgoFlex.workspaceRoom.roomLayout && { afternoon: [43.5, -5], party: [43.5, 12], night: [43.5, 65], morning: [43.5, -5], evening: [28, 0] }[m];
                    return p && Math.abs(ErgoFlex.heightInches - p[0]) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - p[1]) < .03; }, { timeout: 180000 }, mode);
                for (const view of views) {
                    await page.select('#camera-view', view);
                    await page.evaluate(() => { const c = document.getElementById('scene-controls'); if (c && !c.hidden) document.getElementById('lab-preview-toggle')?.click(); window.dispatchEvent(new Event('resize')); });
                    await new Promise(r => setTimeout(r, 2500));
                    const file = join(outDir, `gym-${theme}-${layout}-${mode}-${view}.png`);
                    await page.screenshot({ path: file, clip: await page.$eval('#model-canvas', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
                    console.log(file);
                }
            }
        }
    }
} finally { await browser.close(); server.close(); }
