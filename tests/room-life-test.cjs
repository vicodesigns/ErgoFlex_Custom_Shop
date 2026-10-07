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
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=home&view=room`, { timeout: 120000 });
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; });
        for (const id of ['home','gaming','music','creative','study','office','gym','kitchen','lounge','workshop','bedroom','gallery','scifi','coworking','library']) {
            const result = await page.evaluate(async id => {
                const THREE = await import('three');
                const { WorkspaceRoom } = await import('./workspace-3d.mjs?v=room-life-20261002');
                const room = new WorkspaceRoom(new THREE.Scene(), .001), results = [];
                for (const layout of ['apartment','house','spacious','premium','executive']) {
                    room.set(id, { layout, scale: .001 });
                    // Exercise a mode change while asynchronous native props load.
                    room.life.apply('party'); await room.ready;
                    const life = room.life, before = life.entries.flatMap(e => e.objects.map(o => o.matrix.toArray())), signatures = [], outside = [], contact = [], meals = [];
                    for (const mode of ['morning','afternoon','evening','night','party']) {
                        life.apply(mode); room.root.updateMatrixWorld(true);
                        signatures.push(life.entries.flatMap(e => e.objects.map(o => o.matrix.toArray())));
                        const l = room.roomLayout;
                        for (const entry of life.entries) {
                            const box = entry.footprint.clone().applyMatrix4(entry.delta);
                            if (box.min.x < -l.width/2 - .01 || box.max.x > l.width/2 + .01 || box.min.z < l.back - .01 || box.max.z > l.back+l.depth + .01) outside.push({ role: entry.role, min: box.min.toArray(), max: box.max.toArray() });
                            // A single rigid transform preserves table/item contact.
                            if (entry.role === 'table') contact.push(entry.objects.every(o => JSON.stringify(o.userData.dailyDelta) === JSON.stringify(entry.delta.toArray())));
                        }
                        if (life.kits.filter(k => k.visible).length !== 1) throw new Error('Multiple activity phases visible');
                        if (id === 'kitchen' && layout !== 'apartment') meals.push(life.mealSettings.filter(o => o.visible).length);
                    }
                    let drift = 0;
                    for (let repeat = 0; repeat < 12; repeat++) for (const mode of ['morning','afternoon','evening','night','party']) life.apply(mode);
                    const after = life.entries.flatMap(e => e.objects.map(o => o.matrix.toArray()));
                    after.forEach((m,i) => m.forEach((v,j) => drift = Math.max(drift, Math.abs(v - before[i][j]))));
                    const activity = life.activity, box = new THREE.Box3().setFromObject(activity).applyMatrix4(room.root.matrixWorld.clone().invert());
                    results.push({ layout, movers: life.entries.length, signatures, outside, drift, contact, meals, finite: box.min.toArray().concat(box.max.toArray()).every(Number.isFinite), missing: room.missingProps, story: room.root.userData.dailyStory });
                }
                room.set('product'); return results;
            }, id);
            for (const r of result) {
                assert.deepEqual(r.missing, [], id + '/' + r.layout + ': native props loaded');
                assert.ok(r.movers >= 1, id + '/' + r.layout + ': furniture rearranges');
                assert.equal(new Set(r.signatures.map(s => JSON.stringify(s))).size, 5, id + '/' + r.layout + ': five distinct arrangements');
                assert.deepEqual(r.outside, [], id + '/' + r.layout + ': moved furniture remains inside physical room');
                assert.ok(r.contact.every(Boolean), id + '/' + r.layout + ': table contents share support transform');
                assert.ok(r.drift < 1e-7, id + '/' + r.layout + ': no accumulated staging drift');
                assert.ok(r.finite && r.story, id + '/' + r.layout + ': supported activity kit and story');
                if (r.meals.length) assert.deepEqual(r.meals.slice(0, 4), [3, 0, 6, 0], 'Breakfast, prep, two-person supper and cleared night settings');
            }
            console.log('Daily arrangements:', id, '5 sizes × 5 phases');
        }
        const editing = await page.evaluate(async () => {
            const THREE = await import('three');
            const { roomLifeBaseTransform } = await import('./room-life.mjs?v=room-life-20261002');
            ErgoFlex.setRoomScene('home', false); ErgoFlex.setHomeLayout('house'); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setHomeMode('afternoon', false);
            const entry = [...ErgoFlex.sceneAssetRegistry.values()].find(e => e.obj.userData.propId === 'steelcase-leap-v2'), obj = entry.obj;
            const before = obj.position.x; obj.position.x += 75; obj.updateMatrixWorld(true);
            // Serialize captures every registered canonical transform.
            ErgoFlex.serializeProject(); ErgoFlex.setHomeMode('night', false);
            const night = obj.position.toArray(); const project = ErgoFlex.serializeProject();
            ErgoFlex.setRoomScene('gaming', false); await ErgoFlex.workspaceRoom.ready;
            ErgoFlex.setRoomScene('home', false); await ErgoFlex.workspaceRoom.ready;
            const restored = ErgoFlex.sceneAssetRegistry.get(entry.editorId).obj;
            const restoredNight = restored.position.toArray();
            ErgoFlex.setHomeMode('afternoon', false); const edited = restored.position.x;
            // Direct edits still pass through inverse staging in project exports.
            const stored = ErgoFlex.serializeProject().presentation.sceneAssets['home:house'];
            const saved = stored.transforms[entry.editorId].p.x;
            const lights = () => ErgoFlex.workspaceRoom.root.children.filter(o => o.isPointLight).map(o => o.intensity);
            ErgoFlex.setHomeMode('night', false); const firstLights = lights(); ErgoFlex.setHomeMode('night', false); const secondLights = lights();
            ErgoFlex.applyProject(project); await ErgoFlex.workspaceRoom.ready;
            const imported = ErgoFlex.sceneAssetRegistry.get(entry.editorId).obj.position.toArray();
            document.querySelector(`[title="${entry.editorId}"]`).click(); ErgoFlex.deleteSelectedSceneAssets();
            ErgoFlex.setHomeMode('party', false); const remainsDeleted = !ErgoFlex.sceneAssetRegistry.has(entry.editorId);
            ErgoFlex.setRoomScene('product', false); ErgoFlex.setRoomScene('home', false); await ErgoFlex.workspaceRoom.ready;
            const deletedAfterReload = !ErgoFlex.sceneAssetRegistry.has(entry.editorId);
            return { before, edited, saved, night, restoredNight, imported, firstLights, secondLights, remainsDeleted, deletedAfterReload };
        });
        assert.ok(Math.abs(editing.edited - editing.before - 75) < 1e-6, 'Studio edits survive staging and room reload');
        assert.ok(Math.abs(editing.saved - editing.edited) < 1e-6, 'Saved transforms retain base arrangement');
        for (const key of ['restoredNight','imported']) editing[key].forEach((v,i) => assert.ok(Math.abs(v - editing.night[i]) < 1e-6, key + ': current phase restored exactly'));
        assert.deepEqual(editing.firstLights, editing.secondLights, 'Activity lighting does not compound');
        assert.ok(editing.remainsDeleted && editing.deletedAfterReload, 'Removed assets stay removed through mode and room changes');
        assert.deepEqual(errors, [], 'No browser errors');
        console.log('375 scene/size/phase combinations, Studio persistence, project round-trip, removals and stable lighting passed.');
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
