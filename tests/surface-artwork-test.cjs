const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    const temp = fs.mkdtempSync(require('node:os').tmpdir() + '/ergoflex-artwork-');
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1450, height: 1100 });
        const url = `http://127.0.0.1:${server.address().port}/?view=product`;
        const ready = async () => {
            await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && ErgoFlex.surfaceArtwork?.bindings.size === 21 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
            await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.6); ErgoFlex.renderer.shadowMap.enabled = false; });
        };
        await page.goto(url, { timeout: 120000 }); await ready();
        console.log('Artwork browser: model and 21 printable surfaces ready');
        const fixtures = await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 512; c.height = 256;
            const x = c.getContext('2d'); x.fillStyle = '#f19c00'; x.beginPath(); x.roundRect(24, 24, 464, 208, 34); x.fill();
            x.fillStyle = '#004c46'; x.font = 'bold 125px sans-serif'; x.textAlign = 'center'; x.fillText('EF', 256, 174);
            const logo = c.toDataURL(); x.clearRect(0, 0, 512, 256); x.fillStyle = '#c7d7de'; x.fillRect(0, 0, 512, 256);
            x.fillStyle = '#52717e'; x.fillRect(0, 0, 256, 128); x.fillRect(256, 128, 256, 128);
            return { logo, texture: c.toDataURL() };
        });
        for (const [kind, data] of Object.entries(fixtures)) fs.writeFileSync(path.join(temp, kind + '.png'), Buffer.from(data.split(',')[1], 'base64'));
        const upload = async (surface, kind) => {
            await page.evaluate((surface, kind) => {
                const root = document.querySelector('#premium-artwork'); root.open = true;
                const select = root.querySelector('[data-art-surface]'); select.value = surface; select.dispatchEvent(new Event('change'));
                root.querySelector(`[data-art-layer="${kind}"]`).click();
            }, surface, kind);
            const input = await page.$('[data-art-upload]'); await input.uploadFile(path.join(temp, kind + '.png'));
            await page.waitForFunction((surface, kind) => !!ErgoFlex.surfaceArtwork.bindings.get(surface).layers.get(kind)?.mesh.visible, {}, surface, kind);
        };
        await upload('desktop', 'logo'); await upload('desktop', 'texture');
        assert.ok(await page.evaluate(() => {
            const content = document.querySelector('#desktop-content');
            return content.scrollHeight <= content.clientHeight + 2;
        }), 'expanded finish section exposes the entire artwork editor');
        const first = await page.evaluate(() => {
            const a = ErgoFlex.surfaceArtwork, b = a.bindings.get('desktop'), logo = b.layers.get('logo');
            const pixels = logo.canvas.getContext('2d');
            return { surfaces: [...a.bindings.entries()].map(([id, b]) => ({ id, count: b.face.index.count, full: b.full.getAttribute('position').count })),
                alpha: pixels.getImageData(0, 0, 1, 1).data[3], centerAlpha: pixels.getImageData(logo.canvas.width/2, logo.canvas.height/2, 1, 1).data[3],
                color: logo.material.color.getHexString(), logoFace: logo.mesh.geometry === b.face, wrapFull: b.layers.get('texture').mesh.geometry === b.full,
                quotes: ErgoFlex.priceLines.filter(l => l.label.startsWith('Premium artwork')) };
        });
        assert.ok(first.surfaces.every(s => s.count > 0 && s.count < s.full), JSON.stringify(first.surfaces));
        assert.equal(first.alpha, 0); assert.equal(first.centerAlpha, 255); assert.equal(first.color, 'ffffff');
        assert.ok(first.logoFace && first.wrapFull); assert.equal(first.quotes.length, 1); assert.equal(first.quotes[0].quoted, true);
        await page.evaluate(() => {
            const r = document.querySelector('#premium-artwork'); r.querySelector('[data-art-layer="logo"]').click();
            for (const [key, value] of [['scale', 42], ['x', 64], ['y', 65], ['rotation', 25], ['repeat', 'offset']]) {
                const input = r.querySelector(`[data-art-field="${key}"]`); input.value = value; input.dispatchEvent(new Event('input'));
            }
        });
        const preview = await page.$('[data-art-preview]'); await preview.scrollIntoView();
        const bounds = await preview.boundingBox();
        await page.mouse.move(bounds.x + bounds.width/2, bounds.y + bounds.height/2); await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width*.6, bounds.y + bounds.height*.6, { steps: 3 }); await page.mouse.up();
        const moved = await page.evaluate(() => ErgoFlex.currentConfig.artwork.surfaces.desktop.logo);
        assert.ok(moved.x > 70 && moved.y > 70, 'preview drag updates selected layer'); assert.equal(moved.rotation, 25); assert.equal(moved.repeat, 'offset');
        for (const surface of await page.$$eval('[data-art-surface] option', options => options.map(o => o.value).filter(id => id !== 'desktop'))) await upload(surface, 'logo');
        await upload('footrest-panel', 'texture');
        assert.ok(await page.evaluate(() => {
            const b = ErgoFlex.surfaceArtwork.bindings.get('footrest-panel');
            return b.layers.get('texture').mesh.geometry === b.full && b.layers.get('logo').mesh.geometry === b.face;
        }), 'footrest supports a full wrap and outward decal together');
        const saved = await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork));
        await page.waitForFunction(() => document.querySelector('[data-art-status]').textContent.includes('saved in this browser'));
        await page.reload({ timeout: 120000 }); await ready();
        await page.waitForFunction(() => ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo')?.mesh.visible);
        assert.equal(await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork)), saved, 'automatic browser draft restores without Save build');
        console.log('Artwork browser: uploads, placement and automatic restore passed');
        const rigged = await page.evaluate(async () => {
            ErgoFlex.setHeight(43); ErgoFlex.setTilt('tilting', 12);
            const a = ErgoFlex.surfaceArtwork;
            return [...a.bindings.entries()].every(([id,b]) => b.layers.get('logo').mesh.parent === b.obj);
        });
        assert.ok(rigged, 'every artwork overlay belongs to its moving surface');
        await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '60x30')); s.value = '60x30'; s.dispatchEvent(new Event('change')); });
        await page.waitForFunction(() => ErgoFlex.surfaceArtwork.bindings.get('desktop')?.obj.name === 'Extended desktop' && ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo')?.mesh.visible);
        assert.equal(await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork)), saved, 'desktop size preserves recipe');
        const project = await page.evaluate(() => ErgoFlex.serializeProject()); assert.equal(JSON.stringify(project.customerConfig.artwork), saved);
        await page.evaluate(() => document.querySelector('#save-build').click());
        await page.waitForFunction(() => document.querySelector('[data-art-status]').textContent.includes('saved in this browser'));
        await page.reload({ timeout: 120000 }); await ready();
        await page.waitForFunction(() => ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo')?.mesh.visible);
        assert.equal(await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork)), saved, 'saved build restores images and edits');
        await page.evaluate(() => {
            const root = document.querySelector('#premium-artwork'), surface = root.querySelector('[data-art-surface]');
            surface.value = 'desktop'; surface.dispatchEvent(new Event('change')); root.querySelector('[data-art-layer="logo"]').click();
            const x = root.querySelector('[data-art-field="x"]'); x.value = '17'; x.dispatchEvent(new Event('input'));
        });
        await page.waitForFunction(() => document.querySelector('[data-art-status]').textContent.includes('saved in this browser'));
        await page.reload({ timeout: 120000 }); await ready();
        await page.waitForFunction(() => ErgoFlex.currentConfig.artwork?.surfaces.desktop.logo.x === 17);
        console.log('Artwork browser: latest draft survives an older saved build');
        await page.evaluate(() => { document.querySelector('#reset-build').click(); });
        await page.waitForFunction(() => !ErgoFlex.currentConfig.artwork);
        const restore = await page.evaluate(project => ErgoFlex.applyProject(project), project); assert.ok(restore.ok, JSON.stringify(restore));
        await page.waitForFunction(() => ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo')?.mesh.visible);
        assert.equal(await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork)), saved, 'project restore retains artwork');
        // A portable artwork file replaces the editor state without losing images.
        const artFile = path.join(temp, 'artwork.json'); fs.writeFileSync(artFile, JSON.stringify({ format: 'ergoflex-artwork', artwork: JSON.parse(saved) }));
        await page.evaluate(() => { ErgoFlex.surfaceArtwork.setState(null); delete ErgoFlex.currentConfig.artwork; });
        await (await page.$('[data-art-import]')).uploadFile(artFile);
        await page.waitForFunction(() => !!ErgoFlex.currentConfig.artwork?.surfaces.desktop);
        assert.equal(await page.evaluate(() => JSON.stringify(ErgoFlex.currentConfig.artwork)), saved, 'portable artwork import restores every surface');
        await page.evaluate(() => { ErgoFlex.setLedsEnabled(true); document.querySelector('#premium-artwork').open = true; });
        await page.$eval('#premium-artwork', el => el.scrollIntoView({ block: 'start' }));
        fs.mkdirSync(path.join(root, 'scene-shots', 'artwork-20261008'), { recursive: true });
        await (await page.$('#premium-artwork')).screenshot({ path: path.join(root, 'scene-shots', 'artwork-20261008', 'editor.png') });
        await page.screenshot({ path: path.join(root, 'scene-shots', 'artwork-20261008', 'desktop.png') });
        await page.$eval('[data-art-field="coverage"]', el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(root, 'scene-shots', 'artwork-20261008', 'editor-controls.png') });
        await page.setViewport({ width: 390, height: 844 });
        await page.$eval('#premium-artwork', el => el.scrollIntoView({ block: 'start' }));
        assert.ok(await page.evaluate(() => document.querySelector('#premium-artwork').scrollWidth <= document.querySelector('#premium-artwork').clientWidth + 2), 'mobile editor fits its column');
        assert.ok(await page.evaluate(() => { const el = document.querySelector('#desktop-content'); return el.scrollHeight <= el.clientHeight + 2; }), 'mobile finish section does not clip artwork controls');
        await (await page.$('#premium-artwork')).screenshot({ path: path.join(root, 'scene-shots', 'artwork-20261008', 'mobile-editor.png') });
        assert.deepEqual(errors, []);
        console.log('PASS: 21 printable surfaces, crossbar/footrest/leg/column/foot decals, full wraps, moving-surface parenting, size changes, saved builds, project restore and mobile editor.');
    } finally { await browser.close(); server.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
