// Real browser exports, plus launch/fallback checks. This cannot emulate the
// Quick Look behavior engine: the resulting asset still needs an iPhone test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    fs.readFile(path.join(root, pathname), (error, bytes) => {
        if (error) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', mime[path.extname(pathname)] || 'application/octet-stream');
        res.end(bytes);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 180000,
        args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage();
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => requests.push(request.url()));
        page.on('console', message => { if (message.text().includes('[ErgoFlex] Apple')) console.log(message.text()); });
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(() => !!window.ErgoFlex?.loadedModel && document.querySelector('[data-ar-launch]')?.disabled === false,
            { timeout: 90000 });
        assert.equal(requests.some(url => url.includes('apple-ar-interactions')), false,
            'Normal viewer does not load the Apple exporter');
        await page.evaluate(() => {
            ErgoFlex.setHeight(43.5); ErgoFlex.setTilt('tilting', -5);
            ErgoFlex.setLedsEnabled(true); ErgoFlex.setLedColor('#22ccff');
            Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
            const supports = DOMTokenList.prototype.supports;
            DOMTokenList.prototype.supports = function(token) { return token === 'ar' || supports.call(this, token); };
            // This test samples poses synchronously through the public API.
            // Stop software-rendered preview frames while transferring 42MB
            // through CDP; those frames otherwise dominate headless execution.
            ErgoFlex.renderer.setAnimationLoop(null);
        });
        console.log('Preparing Apple tap preview through the real launch button');
        await page.click('[data-ar-launch]');
        await page.waitForSelector('#ar-place-button', { timeout: 180000 });
        assert.equal(await page.$eval('#ar-place-button', el => el.textContent), 'Try iPhone tap controls');
        assert.match(await page.$eval('#ar-help-message', el => el.textContent), /iPhone test/);
        assert.ok(await page.$('#ar-static-button'));
        const state = await page.evaluate(() => ({ height: ErgoFlex.heightInches,
            tilt: ErgoFlex.tiltConfigs[0].currentDeg, leds: ErgoFlex.ledsEnabled, color: ErgoFlex.ledColor }));
        assert.deepEqual(state, { height: 43.5, tilt: -5, leds: true, color: '#22ccff' },
            'Sampling leaves the configured desk untouched');

        await page.exposeFunction('saveAppleChunk', (name, data, first) => {
            const file = `/tmp/ef-apple-taps-${name}.usdz`;
            if (first) fs.writeFileSync(file, '');
            fs.appendFileSync(file, Buffer.from(data, 'base64'));
        });
        const saveAsset = async (url, name) => page.evaluate(async (url, name) => {
            const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
            for (let offset = 0; offset < bytes.length; offset += 4194304) {
                const chunk = bytes.subarray(offset, offset + 4194304);
                let binary = '';
                for (let i = 0; i < chunk.length; i += 8192) binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
                await window.saveAppleChunk(name, btoa(binary), offset === 0);
            }
            return bytes.length;
        }, url, name);
        const iosSrc = await page.$eval('#ar-model-viewer', el => el.getAttribute('ios-src'));
        assert.match(iosSrc, /^blob:/);
        console.log('Standing asset bytes:', await saveAsset(iosSrc, 'standing'));
        await page.evaluate(() => {
            const mv = document.querySelector('#ar-model-viewer');
            Object.defineProperty(mv, 'canActivateAR', { configurable: true, value: true });
            mv.activateAR = async () => { window.appleTestLaunch = { gesture: navigator.userActivation.isActive, iosSrc: mv.getAttribute('ios-src') }; };
        });
        await page.click('#ar-place-button');
        assert.deepEqual(await page.evaluate(() => ({ gesture: appleTestLaunch.gesture, interactive: !!appleTestLaunch.iosSrc })),
            { gesture: true, interactive: true });
        assert.equal(await page.$('#ar-help-modal'), null);

        console.log('Exporting from Sitting and checking clearance/pose graph');
        const sitting = await page.evaluate(async () => {
            ErgoFlex.setTilt('tilting', 0); ErgoFlex.setHeight(28);
            const asset = await ErgoFlex.prepareARModel();
            window.sittingAppleAsset = asset;
            return { height: ErgoFlex.heightInches, tilt: ErgoFlex.tiltConfigs[0].currentDeg,
                url: asset.appleAsset?.url, stats: asset.appleAsset, error: asset.appleError };
        });
        assert.equal(sitting.error, null);
        assert.equal(sitting.height, 28); assert.equal(sitting.tilt, 0);
        const states = sitting.stats.states;
        assert.deepEqual(states[0], { height: 28, tilt: 0, leg: 1, wing: 2 });
        assert.equal(states[states[0].leg].height, 43.5);
        assert.equal(states[states[0].leg].tilt, -5);
        const low39 = states[states[0].wing];
        assert.equal(low39.height, 28); assert.equal(low39.tilt, 39);
        const raised65 = states[low39.wing];
        assert.equal(raised65.height, 42.5); assert.equal(raised65.tilt, 65);
        assert.ok(sitting.stats.groups < 80, 'Shared motion groups avoid per-mesh action graphs');
        console.log('Sitting asset bytes:', await saveAsset(sitting.url, 'sitting'), 'stats:', sitting.stats);
        fs.writeFileSync('/tmp/ef-apple-taps-manifest.json', JSON.stringify(sitting.stats, null, 2));

        // A new preparation must replace/revoke the preceding interactive URL.
        const oldRevoked = await page.evaluate(async url => { try { await fetch(url); return false; } catch { return true; } }, iosSrc);
        assert.equal(oldRevoked, true);
        await page.click('[data-ar-launch]');
        await page.waitForSelector('#ar-static-button', { timeout: 180000 });
        await page.click('#ar-static-button');
        assert.equal(await page.evaluate(() => appleTestLaunch.iosSrc), null, 'Fallback uses model-viewer’s existing static export');
        assert.equal(await page.evaluate(() => appleTestLaunch.gesture), true);
        assert.deepEqual(errors, []);
        console.log('Apple export, launch gesture, preserved configuration, clearance and fallback passed. iPhone runtime remains unverified.');
    } finally {
        await browser.close(); server.close();
    }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
