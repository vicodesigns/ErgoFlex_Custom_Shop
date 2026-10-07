const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-music-review';
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
        page.setDefaultNavigationTimeout(120000); // software WebGL loads slowly under load
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        const url = `http://127.0.0.1:${server.address().port}/?room=music&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'curved-monitor'), { timeout: 120000 });
        assert.equal(await page.$eval('#music-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.musicMode), 'afternoon');
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
                return { id: obj.userData.propId || obj.name, anchor: obj.userData.propAnchor, key: obj.userData.sceneAssetKey, at: obj.position.toArray(), min: b.min.toArray(), max: b.max.toArray(), scale: obj.scale.x };
            });
            const instruments = ['Keyboard composing area', 'Vocal recording microphone', 'Acoustic drum kit'].map(name => {
                const obj = room.root.getObjectByName(name); if (!obj) return null;
                const b = new THREE.Box3(); obj.traverse(m => { if (m.isMesh) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld))); } });
                return { name, min: b.min.toArray(), max: b.max.toArray() };
            }).filter(Boolean);
            return { instruments, id: room.roomLayout.id, dimensions: room.root.userData.dimensionsMm, back: room.roomLayout.back, props,
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
                if (p.at[1] === 0 && p.anchor !== 'wall') assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
                assert.ok(p.key.startsWith(`music:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Music uses four practical lights without adding shadow maps');
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
        const midi = await page.evaluate(() => { const o = ErgoFlex.workspaceAccessories.dressAssets().find(o => o.userData.propId === 'music-midi-keyboard'); return { name: o?.name, width: o?.userData.dimensionsMm.width, keys: o?.children.length }; });
        assert.equal(midi.width, 860); assert.ok(midi.keys > 50, 'MIDI controller is authored at real size');
        assert.equal(await page.evaluate(() => Boolean(ErgoFlex.workspaceRoom.root.getObjectByName('Keyboard composing area'))), false, 'Compact nook uses the desk MIDI keyboard without crowding in a second instrument');
        await capture('apartment-afternoon');
        const lighting = [];
        for (const [mode, h, t] of [['morning',43.5,-5], ['afternoon',28,0], ['evening',28,10], ['night',28,0], ['party',43.5,-5]]) {
            await page.click(`[data-music-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setMusicMode(m), mode);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .03, { timeout: 120000 }, h, t);
            const data = await measure(); assert.equal(data.atmosphere, mode); lighting.push(data.lights);
            assert.equal(await page.$eval(`[data-music-mode="${mode}"]`, b => b.getAttribute('aria-pressed')), 'true');
            assert.equal(await page.evaluate(() => ErgoFlex.ledsEnabled), ['evening','night','party'].includes(mode));
            if (mode === 'morning' || mode === 'night') await capture('apartment-' + mode);
        }
        assert.equal(new Set(lighting.map(v => JSON.stringify(v))).size, 5, 'Every mode changes practical lighting');
        const chairEdit = await page.evaluate(() => {
            const chair = ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'steelcase-leap-v2');
            chair.position.x += 60; return { key: chair.userData.sceneAssetKey, x: chair.position.x };
        });
        const originalEdits = await page.evaluate(() => {
            const mic = ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'music-vocal-mic');
            const midi = ErgoFlex.workspaceAccessories.dressAssets().find(o => o.userData.propId === 'music-midi-keyboard');
            mic.position.z -= 50; midi.position.x += 20;
            return { mic: mic.position.z, midi: midi.position.x };
        });
        for (const id of ['house', 'spacious', 'premium', 'executive']) {
            await page.select('#music-room-size', id);
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const data = await measure(); checkBounds(data);
            assert.equal(data.instruments.some(i => i.name === 'Acoustic drum kit'), id === 'executive', 'Drums appear only where there is space');
            assert.equal(await page.evaluate(() => Boolean(ErgoFlex.workspaceRoom.root.getObjectByName('Keyboard composing area'))), true, 'Larger studios gain a stage piano');
            await page.click('[data-music-size="60x30"]');
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const wide = await measure(); checkBounds(wide); assert.equal(wide.id, id);
            assert.ok(Math.abs(data.props.find(p => p.id === 'steelcase-leap-v2').scale - wide.props.find(p => p.id === 'steelcase-leap-v2').scale) < 1e-8, 'Furniture is not resized with the desk');
            await page.click('[data-music-size="48x30"]');
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            if (id === 'house' || id === 'premium') await capture(id + '-party');
        }
        await page.select('#music-room-size', 'apartment'); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.evaluate(key => ErgoFlex.workspaceRoom.assets().find(o => o.userData.sceneAssetKey === key).position.x, chairEdit.key), chairEdit.x, 'Music edits survive layout and desktop switches');
        const readOriginalEdits = () => page.evaluate(() => ({
            mic: ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'music-vocal-mic').position.z,
            midi: ErgoFlex.workspaceAccessories.dressAssets().find(o => o.userData.propId === 'music-midi-keyboard').position.x
        }));
        for (const [key, value] of Object.entries(await readOriginalEdits())) assert.ok(Math.abs(value - originalEdits[key]) < 1e-6, 'Original instrument and MIDI edits survive room changes');
        await page.evaluate(async () => { ErgoFlex.setGamingLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setGamingMode('night'); });
        assert.equal(await page.evaluate(() => ErgoFlex.musicMode), 'party');
        await page.evaluate(async () => { ErgoFlex.setRoomScene('home'); await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#music-room-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.homeMode), 'afternoon', 'Home Office retains its own mode');
        const homeLighting = [];
        for (const [mode, h, t] of [['morning',43.5,-5], ['evening',28,12], ['night',28,0], ['party',43.5,0], ['afternoon',28,0]]) {
            await page.click(`[data-home-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setHomeMode(m), mode);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .03, { timeout: 120000 }, h, t);
            assert.equal(await page.evaluate(() => ErgoFlex.homeMode), mode);
            homeLighting.push(await page.evaluate(() => ErgoFlex.workspaceRoom.root.children.filter(o => o.isPointLight).map(l => l.intensity)));
        }
        assert.equal(new Set(homeLighting.map(v => JSON.stringify(v))).size, 5, 'Home practical lights still follow all five modes');
        await page.evaluate(async () => { ErgoFlex.setMusicLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setMusicMode('night'); });
        const project = await page.evaluate(() => ErgoFlex.serializeProject());
        assert.equal(project.presentation.gamingMode, 'night'); assert.equal(project.presentation.gamingLayout, 'house');
        assert.equal(project.presentation.musicLayout, 'house'); assert.equal(project.presentation.musicMode, 'night');
        assert.ok(project.presentation.sceneAssets['music:apartment']);
        const restored = await page.evaluate(async p => { ErgoFlex.setRoomScene('product', false); const result = ErgoFlex.applyProject(p); await ErgoFlex.workspaceRoom.ready; return { result, mode: ErgoFlex.musicMode, layout: ErgoFlex.musicLayout, position: ErgoFlex.glidePosition }; }, project);
        assert.equal(restored.result.ok, true); assert.equal(restored.mode, 'night'); assert.equal(restored.layout, 'house');
        assert.deepEqual(restored.position, project.motion.glide, 'Project restore preserves room placement');
        await page.evaluate(async () => { ErgoFlex.setMusicLayout('apartment'); await ErgoFlex.workspaceRoom.ready; });
        for (const [key, value] of Object.entries(await readOriginalEdits())) assert.ok(Math.abs(value - originalEdits[key]) < 1e-6, 'Project restore includes original instrument and MIDI edits');
        await page.evaluate(async () => { ErgoFlex.setMusicLayout('house'); await ErgoFlex.workspaceRoom.ready; });
        await page.evaluate(async () => { ErgoFlex.setMusicMode('evening'); await ErgoFlex.workspaceRoom.ready; });
        // Capture the final scene with the normal renderer quality and shadows.
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await capture('house-evening');
        await page.select('#camera-view', 'hero');
        await new Promise(r => setTimeout(r, 900));
        await page.screenshot({ path: path.join(out, 'house-evening-desk.png') });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; ErgoFlex.setMusicLayout('executive'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setMusicMode('party'); });
        await page.waitForFunction(() => Math.abs(ErgoFlex.heightInches - 43.5) < .03, { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await capture('executive-performance');
        assert.deepEqual(errors, []);
        console.log('Music: five physical rooms, both desktops, all five lighting/posture modes, prop bounds, independent edits, and project restore passed.');
        console.log('Review screenshots: ' + out);
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
