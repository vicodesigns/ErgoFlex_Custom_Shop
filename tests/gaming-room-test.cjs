const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-gaming-review';
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
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
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        const url = `http://127.0.0.1:${server.address().port}/?room=gaming&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'curved-monitor'), { timeout: 30000 });
        assert.equal(await page.$eval('#gaming-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.gamingMode), 'evening');
        const measure = () => page.evaluate(async () => {
            const THREE = await import('three'), room = ErgoFlex.workspaceRoom;
            room.root.updateMatrixWorld(true);
            const inverse = room.root.matrixWorld.clone().invert();
            const props = room.assets().map(obj => {
                const b = new THREE.Box3();
                obj.traverse(mesh => { if (mesh.isMesh) {
                    mesh.geometry.computeBoundingBox();
                    b.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
                } });
                return { id: obj.userData.propId, key: obj.userData.sceneAssetKey, at: obj.position.toArray(), min: b.min.toArray(), max: b.max.toArray(), scale: obj.scale.x };
            });
            return { id: room.roomLayout.id, dimensions: room.root.userData.dimensionsMm, back: room.roomLayout.back, props,
                missing: room.missingProps, scale: room.root.scale.x, ref: ErgoFlex.arSize, glide: ErgoFlex.glideBounds,
                lights: room.root.children.filter(o => o.isPointLight).map(l => l.intensity),
                atmosphere: room.root.userData.atmosphere, caption: document.querySelector('#room-scene-caption').textContent };
        });
        const checkBounds = data => {
            for (const p of data.props) {
                const w = data.dimensions.width, end = data.back + data.dimensions.depth;
                assert.ok(p.min[0] >= -w / 2 - 1 && p.max[0] <= w / 2 + 1, `${data.id}: ${p.id} within side walls: ${p.min[0]}..${p.max[0]}`);
                assert.ok(p.min[2] >= data.back - 1 && p.max[2] <= end + 1, `${data.id}: ${p.id} within floor depth: ${p.min[2]}..${p.max[2]}`);
                assert.ok(p.min[1] >= -1 && p.max[1] <= data.dimensions.height + 1, `${p.id} between floor and ceiling`);
                if (p.at[1] === 0) assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
                assert.ok(p.key.startsWith(`gaming:${data.id}:`), 'Room assets have independent layout identities');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'RGB uses four practical lights without adding shadow maps');
            assert.ok(data.glide.maxX - data.glide.minX > 1 && data.glide.maxZ > data.glide.minZ, 'Full-room Glide uses physical boundaries');
            assert.ok(Math.abs(data.ref.widthUnits / data.scale - data.ref.nominalWidth * 25.4) < .01, 'Desk and room use the same physical units');
        };
        const capture = async name => {
            await page.select('#camera-view', 'room');
            await new Promise(r => setTimeout(r, 900));
            await page.screenshot({ path: path.join(out, name + '.png') });
        };
        const compact = await measure(); checkBounds(compact);
        assert.equal(compact.id, 'apartment');
        assert.equal(compact.props.some(p => p.id === 'samsung-neo-tv'), false, 'Compact gaming nook avoids a crowded TV lounge');
        await capture('apartment-evening');
        const lighting = [];
        for (const [mode, h, t] of [['morning',43.5,-5], ['afternoon',28,0], ['evening',28,0], ['night',28,0], ['party',43.5,-5]]) {
            await page.click(`[data-gaming-mode="${mode}"]`);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .03, { timeout: 120000 }, h, t);
            const data = await measure(); assert.equal(data.atmosphere, mode); lighting.push(data.lights);
            assert.equal(await page.$eval(`[data-gaming-mode="${mode}"]`, b => b.getAttribute('aria-pressed')), 'true');
            assert.equal(await page.evaluate(() => ErgoFlex.ledsEnabled), ['evening','night','party'].includes(mode));
            if (mode === 'morning' || mode === 'night') await capture('apartment-' + mode);
        }
        assert.equal(new Set(lighting.map(v => JSON.stringify(v))).size, 5, 'Every mode changes practical lighting');
        const chairEdit = await page.evaluate(() => {
            const chair = ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'steelcase-leap-v2');
            chair.position.x += 60; return { key: chair.userData.sceneAssetKey, x: chair.position.x };
        });
        for (const id of ['house', 'spacious', 'premium', 'executive']) {
            await page.select('#gaming-room-size', id);
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const data = await measure(); checkBounds(data);
            assert.ok(data.props.some(p => p.id === 'samsung-neo-tv'), 'Larger rooms gain a console lounge');
            assert.equal(await page.evaluate(() => Boolean(ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'samsung-neo-tv').getObjectByName('Gaming TV display')?.material.map)), true, 'Console TV has its own display artwork');
            await page.click('[data-gaming-size="60x30"]');
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const wide = await measure(); checkBounds(wide); assert.equal(wide.id, id);
            assert.ok(Math.abs(data.props.find(p => p.id === 'steelcase-leap-v2').scale - wide.props.find(p => p.id === 'steelcase-leap-v2').scale) < 1e-8, 'Furniture is not resized with the desk');
            await page.click('[data-gaming-size="48x30"]');
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            if (id === 'house' || id === 'premium') await capture(id + '-party');
        }
        await page.select('#gaming-room-size', 'apartment'); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.evaluate(key => ErgoFlex.workspaceRoom.assets().find(o => o.userData.sceneAssetKey === key).position.x, chairEdit.key), chairEdit.x, 'Gaming edits survive layout and desktop switches');
        await page.evaluate(async () => { ErgoFlex.setRoomScene('home'); await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#gaming-room-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.homeMode), 'afternoon', 'Home Office retains its own mode');
        const homeLighting = [];
        for (const [mode, h, t] of [['morning',43.5,-5], ['evening',28,12], ['night',28,0], ['party',43.5,0], ['afternoon',28,0]]) {
            await page.click(`[data-home-mode="${mode}"]`);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .03, { timeout: 120000 }, h, t);
            assert.equal(await page.evaluate(() => ErgoFlex.homeMode), mode);
            homeLighting.push(await page.evaluate(() => ErgoFlex.workspaceRoom.root.children.filter(o => o.isPointLight).map(l => l.intensity)));
        }
        assert.equal(new Set(homeLighting.map(v => JSON.stringify(v))).size, 5, 'Home practical lights still follow all five modes');
        await page.evaluate(async () => { ErgoFlex.setGamingLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setGamingMode('night'); });
        const project = await page.evaluate(() => ErgoFlex.serializeProject());
        assert.equal(project.presentation.gamingLayout, 'house'); assert.equal(project.presentation.gamingMode, 'night');
        assert.ok(project.presentation.sceneAssets['gaming:apartment']);
        const restored = await page.evaluate(async p => { ErgoFlex.setRoomScene('product', false); const result = ErgoFlex.applyProject(p); await ErgoFlex.workspaceRoom.ready; return { result, mode: ErgoFlex.gamingMode, layout: ErgoFlex.gamingLayout, position: ErgoFlex.glidePosition }; }, project);
        assert.equal(restored.result.ok, true); assert.equal(restored.mode, 'night'); assert.equal(restored.layout, 'house');
        assert.deepEqual(restored.position, project.motion.glide, 'Project restore preserves room placement');
        await page.evaluate(async () => { ErgoFlex.setGamingMode('evening'); await ErgoFlex.workspaceRoom.ready; });
        // Capture the final scene with the normal renderer quality and shadows.
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await capture('house-evening');
        await page.select('#camera-view', 'hero');
        await new Promise(r => setTimeout(r, 900));
        await page.screenshot({ path: path.join(out, 'house-evening-desk.png') });
        assert.deepEqual(errors, []);
        console.log('Gaming: five physical rooms, both desktops, all five lighting/posture modes, prop bounds, independent edits, and project restore passed.');
        console.log('Review screenshots: ' + out);
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
