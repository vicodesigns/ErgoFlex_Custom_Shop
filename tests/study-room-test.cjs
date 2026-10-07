const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-study-review';
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
        page.on('error', e => console.error('Browser page:', e.message));
        browser.process().once('exit', (code, signal) => { if (code) console.error('Browser exit:', code, signal); });
        await page.setViewport({ width: 1500, height: 1200 });
        const url = `http://127.0.0.1:${server.address().port}/?room=study&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'kenney-furniture-laptop'), { timeout: 120000 });
        assert.equal(await page.$eval('#study-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.studyMode), 'afternoon');
        const measure = () => page.evaluate(async () => {
            const THREE = await import('three'), room = ErgoFlex.workspaceRoom;
            room.root.updateMatrixWorld(true);
            const inverse = room.root.matrixWorld.clone().invert();
            const props = room.assets().map(obj => {
                const b = new THREE.Box3();
                obj.traverse(mesh => { if (mesh.isMesh) {
                    mesh.geometry.computeBoundingBox();
                    if (mesh.isInstancedMesh) mesh.computeBoundingBox();
                    b.union((mesh.isInstancedMesh ? mesh.boundingBox : mesh.geometry.boundingBox).clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
                } });
                return { id: obj.userData.propId, key: obj.userData.sceneAssetKey, at: obj.position.toArray(), min: b.min.toArray(), max: b.max.toArray(), scale: obj.scale.x };
            });
            const instruments = ['Study reading lamp', 'Study chess table'].map(name => {
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
                if (p.at[1] === 0) assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
                assert.ok(p.key.startsWith(`study:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Study uses four practical lights without adding shadow maps');
            assert.ok(data.glide.maxX - data.glide.minX > 1 && data.glide.maxZ > data.glide.minZ, 'Full-room Glide uses physical boundaries');
            assert.ok(Math.abs(data.ref.widthUnits / data.scale - data.ref.nominalWidth * 25.4) < .01, 'Desk and room use the same physical units');
        };
        const capture = async name => {
            await page.select('#camera-view', 'room');
            await new Promise(r => setTimeout(r, 900));
            await page.screenshot({ path: path.join(out, name + '.png') });
        };
        const initial = await measure(); checkBounds(initial);
        assert.equal(initial.id, 'apartment');
        assert.equal(initial.instruments.length, 1, 'Small study has a reading lamp');
        assert.ok(initial.props.some(p => p.id === 'study-bookcase-0'));
        await capture('apartment-afternoon');
        const lights = [];
        for (const [mode, h, t] of [['morning',43.5,-5], ['afternoon',28,0], ['evening',28,12], ['night',28,0], ['party',43.5,0]]) {
            await page.click(`[data-study-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setStudyMode(m), mode);
            await page.waitForFunction((h, t) => Math.abs(ErgoFlex.heightInches - h) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg - t) < .03, { timeout: 120000 }, h, t);
            const data = await measure(); assert.equal(data.atmosphere, mode); lights.push(data.lights);
            assert.equal(await page.$eval(`[data-study-mode="${mode}"]`, b => b.getAttribute('aria-pressed')), 'true');
            assert.equal(await page.evaluate(() => ErgoFlex.ledsEnabled), ['evening','night','party'].includes(mode));
            if (mode === 'night') await capture('apartment-night');
        }
        assert.equal(new Set(lights.map(v => JSON.stringify(v))).size, 5, 'Five distinct lighting modes');
        const edited = await page.evaluate(() => {
            const art = ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'study-landscape');
            const sketch = ErgoFlex.workspaceAccessories.dressAssets().find(o => o.userData.propId === 'journal');
            art.position.y -= 30; sketch.position.x += 20;
            return { art: art.position.y, sketch: sketch.position.x };
        });
        const readEdits = () => page.evaluate(() => ({
            art: ErgoFlex.workspaceRoom.assets().find(o => o.userData.propId === 'study-landscape').position.y,
            sketch: ErgoFlex.workspaceAccessories.dressAssets().find(o => o.userData.propId === 'journal').position.x
        }));
        const verifyEdits = async () => { for (const [key, value] of Object.entries(await readEdits())) assert.ok(Math.abs(value - edited[key]) < 1e-6, 'Artwork and desk edits restored'); };
        for (const id of ['house', 'spacious', 'premium', 'executive']) {
            console.log('Checking Study room:', id);
            await page.select('#study-room-size', id); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const data = await measure(); checkBounds(data);
            assert.equal(data.instruments.some(i => i.name === 'Study chess table'), id === 'executive');
            const globe = data.props.find(p => p.id === 'globe'); assert.ok(Math.abs(globe.min[1] - 740) < .01, 'Globe rests on its cabinet');
            const library = await page.evaluate(() => {
                const bays = ErgoFlex.workspaceRoom.assets().filter(o => o.userData.propId?.startsWith('study-bookcase-'));
                return { bays: bays.length, books: bays.map(o => o.children.filter(c => c.isInstancedMesh).reduce((n, c) => n + c.count, 0)) };
            });
            assert.equal(library.bays, { house:2, spacious:2, premium:3, executive:4 }[id]);
            assert.ok(library.books.every(n => n > 100), 'Instanced books fill each library bay');
            await page.click('[data-study-size="60x30"]'); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            const wide = await measure(); checkBounds(wide); assert.equal(wide.id, id);
            assert.ok(Math.abs(data.props.find(p => p.id === 'steelcase-leap-v2').scale - wide.props.find(p => p.id === 'steelcase-leap-v2').scale) < 1e-8, 'Furniture keeps its true size');
            await page.click('[data-study-size="48x30"]'); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            if (id === 'house') await capture('house-conversation');
        }
        await page.select('#study-room-size', 'apartment'); await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; }); await verifyEdits();
        await page.evaluate(async () => { ErgoFlex.setMusicLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setMusicMode('night', false); });
        assert.equal(await page.evaluate(() => ErgoFlex.studyMode), 'party');
        assert.equal(await page.$eval('#study-room-controls', p => p.hidden), true);
        await page.evaluate(async () => { ErgoFlex.setStudyLayout('executive'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setStudyMode('afternoon'); });
        const project = await page.evaluate(() => ErgoFlex.serializeProject());
        assert.equal(project.presentation.studyLayout, 'executive'); assert.equal(project.presentation.studyMode, 'afternoon');
        assert.equal(project.presentation.musicMode, 'night'); assert.equal(project.presentation.musicLayout, 'house');
        assert.ok(project.presentation.sceneAssets['study:apartment']);
        const restored = await page.evaluate(async p => { ErgoFlex.setRoomScene('product', false); const result = ErgoFlex.applyProject(p); await ErgoFlex.workspaceRoom.ready; return { result, mode: ErgoFlex.studyMode, layout: ErgoFlex.studyLayout, position: ErgoFlex.glidePosition }; }, project);
        assert.equal(restored.result.ok, true); assert.equal(restored.mode, 'afternoon'); assert.equal(restored.layout, 'executive');
        for (const [key, value] of Object.entries(restored.position)) assert.ok(Math.abs(value - project.motion.glide[key]) < 1e-6, 'Desk placement restored');
        await page.evaluate(async () => { ErgoFlex.setStudyLayout('apartment'); await ErgoFlex.workspaceRoom.ready; }); await verifyEdits();
        await page.evaluate(async () => { ErgoFlex.setStudyLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setStudyMode('afternoon'); });
        await page.waitForFunction(() => Math.abs(ErgoFlex.heightInches - 28) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg) < .03, { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await capture('house-afternoon');
        await page.select('#camera-view', 'hero'); await new Promise(r => setTimeout(r, 900));
        await page.screenshot({ path: path.join(out, 'house-writing-desk.png') });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; ErgoFlex.setStudyLayout('executive'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setStudyMode('party'); });
        await page.waitForFunction(() => Math.abs(ErgoFlex.heightInches - 43.5) < .03 && Math.abs(ErgoFlex.tiltConfigs.find(c => c.name === 'tilting').currentDeg) < .03, { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
        await capture('executive-conversation');
        await page.setViewport({ width: 390, height: 844 });
        assert.equal(await page.$eval('#study-room-controls', p => p.hidden), false);
        assert.ok(await page.$eval('#study-room-size', el => el.getBoundingClientRect().width > 0));
        assert.deepEqual(errors, []);
        console.log('Study: five measured rooms, both desktops, five lighting/posture modes, physical prop bounds, nested artwork edits and instanced library bounds, independent scene settings and project restore passed.');
        console.log('Review screenshots: ' + out);
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
