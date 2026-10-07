const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const out = '/tmp/ef-home-office-review'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { timeout: 120000 });
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 120000 });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).display === 'none');
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.setRoomScene('home'); await ErgoFlex.workspaceRoom.ready; });
        const capture = async name => {
            await new Promise(r => setTimeout(r, 900));
            await page.screenshot({ path: path.join(out, name + '.png') });
        };
        const measure = () => page.evaluate(async () => {
            const THREE = await import('three'), room = ErgoFlex.workspaceRoom, ref = ErgoFlex.arSize;
            room.root.updateMatrixWorld(true);
            const inverse = room.root.matrixWorld.clone().invert();
            const props = room.assets().map(obj => {
                const bounds = new THREE.Box3();
                obj.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.computeBoundingBox(); bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld))); } });
                return { id: obj.userData.propId, at: obj.position.toArray(), min: bounds.min.toArray(), max: bounds.max.toArray(), scale: obj.scale.x };
            });
            return { id: room.homeLayout.id, dimensions: room.root.userData.dimensionsMm, scale: room.root.scale.x, ref, props, missing: room.missingProps, caption: document.querySelector('#room-scene-caption').textContent };
        });
        const compact = await measure();
        assert.equal(compact.id, 'apartment');
        assert.deepEqual(compact.dimensions, { width: 2800, depth: 3200, height: 2600 });
        assert.ok(Math.abs(compact.ref.widthUnits / compact.scale - 48 * 25.4) < .001, '48-inch desktop and architectural millimetres share physical units');
        assert.deepEqual(compact.missing, []);
        const checkBounds = (data, back) => {
            for (const p of data.props) {
                assert.ok(p.min[0] >= -data.dimensions.width / 2 - 1 && p.max[0] <= data.dimensions.width / 2 + 1, `${data.id}: ${p.id} fits between side walls: ${p.min[0]}..${p.max[0]}`);
                assert.ok(p.min[2] >= back - 1 && p.max[2] <= back + data.dimensions.depth + 1, `${data.id}: ${p.id} fits within floor depth: ${p.min[2]}..${p.max[2]}`);
                if (p.at[1] === 0) assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
            }
        };
        checkBounds(compact, -1050);
        await page.select('#camera-view', 'room');
        await capture('apartment-afternoon');
        for (const [mode, expectedHeight, expectedTilt] of [['morning', 43.5, -5], ['evening', 28, 12], ['night', 28, 0], ['party', 43.5, 0]]) {
            await page.click(`[data-home-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setHomeMode(m), mode);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .02 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .02, { timeout: 120000 }, expectedHeight, expectedTilt);
            assert.equal(await page.$eval(`[data-home-mode="${mode}"]`, b => b.getAttribute('aria-pressed')), 'true');
            if (mode === 'night') await capture('apartment-night');
        }
        console.log('Apartment dimensions, furniture bounds, and all five lighting/posture modes passed.');
        // A room edit is restored only in its own physical layout.
        const edit = await page.evaluate(() => {
            const obj = ErgoFlex.workspaceRoom.assets().find(p => p.userData.propId === 'steelcase-leap-v2');
            obj.position.x += 80; obj.updateMatrixWorld(true);
            return { key: obj.userData.sceneAssetKey, x: obj.position.x };
        });
        await page.click('[data-home-size="60x30"]');
        await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
        assert.equal((await measure()).id, 'apartment', 'Changing desktop size preserves the selected room');
        await page.select('#home-room-size', 'house');
        await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
        const large = await measure();
        assert.equal(large.id, 'house');
        assert.deepEqual(large.dimensions, { width: 3600, depth: 4200, height: 2700 });
        assert.ok(Math.abs(large.ref.widthUnits / large.scale - 60 * 25.4) < .001, '60-inch desktop is physically sized');
        assert.deepEqual(large.missing, []); checkBounds(large, -1450);
        assert.ok(Math.abs(compact.props.find(p => p.id === 'armchair-poppi').scale - large.props.find(p => p.id === 'armchair-poppi').scale) < 1e-9, 'Furniture remains the same physical size');
        await page.click('[data-home-mode="afternoon"]');
        await page.select('#camera-view', 'room');
        await capture('house-afternoon');
        await page.click('[data-home-mode="party"]'); await page.evaluate(() => ErgoFlex.setHomeMode('party'));
        await page.waitForFunction(() => Math.abs(ErgoFlex.heightInches - 43.5) < .02, { timeout: 120000 });
        await capture('house-party');
        await page.click('[data-home-size="48x30"]');
        assert.equal((await measure()).id, 'house', 'Room choice remains independent of desktop width');
        await page.select('#home-room-size', 'apartment');
        await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
        assert.ok(Math.abs(await page.evaluate(key => ErgoFlex.workspaceRoom.assets().find(p => p.userData.sceneAssetKey === key).position.x, edit.key) - edit.x) < 1e-6, 'Apartment edits survive a desktop size round trip');
        for (const [id, width, depth, height, back] of [['spacious',4200,4800,2800,-1600],['premium',5200,5800,3000,-1850],['executive',6500,7000,3200,-2200]]) {
            await page.select('#home-room-size', id);
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const data = await measure();
            assert.deepEqual(data.dimensions, {width,depth,height}); assert.deepEqual(data.missing, []); checkBounds(data, back);
            await page.select('#camera-view', 'room'); await capture(id+'-afternoon');
            await page.click('[data-home-size="60x30"]');
            assert.equal((await measure()).id,id); await page.click('[data-home-size="48x30"]');
        }
        const project = await page.evaluate(() => ErgoFlex.serializeProject());
        assert.equal(project.presentation.homeMode, 'party');
        assert.equal(project.presentation.homeLayout, 'executive');
        assert.ok(project.presentation.sceneAssets['home:apartment']);
        assert.ok(project.presentation.sceneAssets['home:house']);
        await page.evaluate(async project => { ErgoFlex.setRoomScene('product', false); ErgoFlex.applyProject(project); await ErgoFlex.workspaceRoom.ready; }, project);
        assert.equal(await page.evaluate(() => ErgoFlex.homeMode), 'party');
        assert.equal(await page.evaluate(() => ErgoFlex.homeLayout), 'executive');
        assert.deepEqual(await page.evaluate(() => ErgoFlex.glidePosition), project.motion.glide, 'Import preserves saved desk placement');
        assert.ok(Math.abs(await page.evaluate(() => ErgoFlex.deskYaw) - project.motion.yaw) < 1e-6, 'Import preserves the desk rotation');
        await page.evaluate(async () => { ErgoFlex.setRoomScene('product', false); await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.$eval('#home-office-controls', el => el.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.workspaceRoom.root), null);
        assert.deepEqual(errors, []);
        console.log('Home layout switch, physical scale, editing, project round trip, and Product scene passed.');
        console.log('Review images: ' + out);
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
