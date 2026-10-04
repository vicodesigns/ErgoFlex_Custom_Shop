const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        const url = `http://127.0.0.1:${server.address().port}/?room=home&view=room`;
        await page.goto(url);
        const ready = async () => {
            await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
            await page.evaluate(async () => {
                // Movement assertions need actual frames, including on a
                // machine using the software GPU for this furnished scene.
                ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false;
                await ErgoFlex.workspaceRoom.ready;
            });
        };
        await ready();
        assert.equal(await page.evaluate(() => ErgoFlex.glideSpeed), .306);
        assert.equal(await page.$eval('#glide-speed', s => s.selectedOptions[0].textContent), 'Slow');

        // Reproduce a saved device size and a collapsed body on initial load.
        await page.evaluate(() => {
            ErgoFlex.setRemoteSize(882, 344);
            if (!document.querySelector('#motion-dock').classList.contains('collapsed')) document.querySelector('#motion-dock-toggle').click();
        });
        const panel = () => page.evaluate(() => {
            const dock = document.querySelector('#motion-dock');
            return { height: dock.offsetHeight, header: dock.querySelector('.remote-header').offsetHeight,
                hidden: getComputedStyle(document.querySelector('#motion-dock-content')).display === 'none' };
        });
        let p = await panel();
        assert.ok(p.hidden && p.height <= p.header + 8, 'Collapsed resized panel occupies only its header');
        await page.reload(); await ready();
        p = await panel();
        assert.ok(p.hidden && p.height <= p.header + 8, 'Reload keeps the compact collapsed header');
        await page.click('#motion-dock-toggle');
        p = await panel(); assert.ok(!p.hidden && p.height > p.header + 150, 'One click restores the full controls');
        await page.evaluate(() => ErgoFlex.rebuildMotionRemote());
        assert.equal((await panel()).hidden, false, 'Rebuilding retains expanded controls');
        await page.setViewport({ width: 1100, height: 900 });
        assert.equal((await panel()).hidden, false, 'Window resize retains expanded controls');
        console.log('Resized controller collapse, reload, expand, rebuild, and viewport resize passed.');

        // All five physical layouts and both desktops share one floor clamp.
        for (const size of ['48x30', '60x30']) {
            await page.click(`[data-home-size="${size}"]`);
            for (const layout of ['apartment', 'house', 'spacious', 'premium', 'executive']) {
                await page.evaluate(async id => { ErgoFlex.setHomeLayout(id); await ErgoFlex.workspaceRoom.ready; }, layout);
                const b = await page.evaluate(() => ErgoFlex.glideBounds);
                assert.ok(b.maxX - b.minX > 1 && b.maxZ > b.minZ, `${size}/${layout}: usable full-room travel`);
                for (const [x, z] of [[1e4, 1e4], [-1e4, 1e4], [1e4, -1e4], [-1e4, -1e4]]) {
                    const target = await page.evaluate(([x, z]) => { ErgoFlex.setGlidePosition(x, z); return ErgoFlex.glideTarget; }, [x, z]);
                    assert.ok(Math.abs(target.x - (x > 0 ? b.maxX : b.minX)) < 1e-6);
                    assert.ok(Math.abs(target.z - (z > 0 ? b.maxZ : b.minZ)) < 1e-6);
                }
                await page.evaluate(() => ErgoFlex.haltAllMotion());
            }
        }
        const project = await page.evaluate(() => {
            const p = ErgoFlex.serializeProject(), b = ErgoFlex.glideBounds;
            p.motion.glide = { x: b.maxX - .1, z: (b.minZ + b.maxZ) / 2 };
            return p;
        });
        assert.ok(project.motion.glide.x > 1, 'Large rooms support positions beyond the old fixed limit');
        const restored = await page.evaluate(p => {
            const result = ErgoFlex.applyProject(p);
            return { result, position: ErgoFlex.glidePosition };
        }, project);
        assert.equal(restored.result.ok, true);
        assert.ok(Math.abs(restored.position.x - project.motion.glide.x) < .001, 'Project import restores distant room position');

        // Check actual rendered desk geometry at the corner, including yaw.
        const cornerProject = await page.evaluate(() => {
            const p = ErgoFlex.serializeProject(); p.motion.yaw = Math.PI / 2;
            p.motion.glide = { x: 1e4, z: -1e4 }; return p;
        });
        await page.evaluate(p => ErgoFlex.applyProject(p), cornerProject);
        const clearance = await page.evaluate(async () => {
            const THREE = await import('three'), bounds = new THREE.Box3();
            ErgoFlex.loadedModel.updateMatrixWorld(true);
            ErgoFlex.loadedModel.traverseVisible(obj => {
                if (!obj.isMesh || obj.material?.isShaderMaterial) return;
                obj.geometry.computeBoundingBox(); bounds.union(obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld));
            });
            const floor = ErgoFlex.workspaceRoom.floorBounds;
            return [bounds.min.x - floor.min.x, floor.max.x - bounds.max.x, bounds.min.z - floor.min.z, floor.max.z - bounds.max.z];
        });
        assert.ok(clearance.every(v => v >= -1e-5), 'Rotated desk remains inside the physical floor at a far corner');

        // Real keyboard movement crosses the former boundary and stops on release.
        const moving = await page.evaluate(() => {
            const p = ErgoFlex.serializeProject(); p.motion.yaw = 0; p.motion.glide = { x: 1.05, z: 0 };
            ErgoFlex.applyProject(p);
            const speed = document.querySelector('#glide-speed'); speed.value = '0.85'; speed.dispatchEvent(new Event('change'));
            if (document.querySelector('#motion-dock').classList.contains('collapsed')) document.querySelector('#motion-dock-toggle').click();
            return ErgoFlex.glidePosition;
        });
        await page.focus('#glide-pad'); await page.keyboard.down('ArrowRight');
        const driveState = await page.evaluate(() => ({ focus: document.activeElement.id,
            status: document.querySelector('#glide-status').textContent,
            transform: ErgoFlex.transformControl?.object?.name,
            visible: document.querySelector('#glide-pad').getBoundingClientRect().toJSON(),
            bounds: ErgoFlex.glideBounds, speed: ErgoFlex.glideSpeed, input: ErgoFlex.glideInput,
            handler: Boolean(document.querySelector('#glide-pad').onkeydown),
            toast: document.querySelector('#studio-toast').textContent,
            frame: ErgoFlex.renderer.info.render.frame }));
        await page.waitForFunction(start => {
            const at = ErgoFlex.glidePosition;
            return Math.hypot(at.x - start.x, at.z - start.z) > .02;
        }, { timeout: 30000 }, moving);
        await page.keyboard.up('ArrowRight');
        const driven = await page.evaluate(() => ErgoFlex.glidePosition);
        driveState.after = await page.evaluate(() => ({ input: ErgoFlex.glideInput, frame: ErgoFlex.renderer.info.render.frame }));
        assert.ok(Math.hypot(driven.x - moving.x, driven.z - moving.z) > .02, `Keyboard drives beyond the old boundary: ${JSON.stringify({ moving, driven, driveState, errors })}`);
        await new Promise(r => setTimeout(r, 150));
        assert.deepEqual(await page.evaluate(() => ErgoFlex.glidePosition), driven, 'Release stops movement');
        await page.evaluate(() => { ErgoFlex.setRoomScene('product', false); ErgoFlex.setGlidePosition(20, -20); });
        assert.deepEqual(await page.evaluate(() => ErgoFlex.glideTarget), { x: 1, z: -1 }, 'Product preview keeps its existing travel range');
        await page.evaluate(() => ErgoFlex.setGlidePosition(0, 0));
        assert.deepEqual(await page.evaluate(() => ErgoFlex.glideTarget), { x: 0, z: 0 }, 'Recenter remains available');
        assert.deepEqual(errors, []);
        console.log('All room sizes/desktops, far corners, rotated footprint, project restore, keyboard movement, product bounds, and Recenter passed.');
        await page.evaluate(async () => { ErgoFlex.setHomeLayout('house'); await ErgoFlex.workspaceRoom.ready; });
        await page.select('#camera-view', 'room');
        await page.setViewport({ width: 1500, height: 1200 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await new Promise(r => setTimeout(r, 600));
        await page.screenshot({ path: '/tmp/ef-room-glide-controls.png' });
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
