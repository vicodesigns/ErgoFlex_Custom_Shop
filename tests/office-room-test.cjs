const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-office-review';
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
        page.on('error', e => console.error('Browser page:', e.message));
        browser.process().once('exit', (code, signal) => { if (code) console.error('Browser exit:', code, signal); });
        await page.setViewport({ width: 1500, height: 1200 });
        const url = `http://127.0.0.1:${server.address().port}/?room=office&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'office-keyboard'), { timeout: 30000 });
        assert.equal(await page.$eval('#office-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.officeMode), 'afternoon');
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
            const instruments = [];
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
                assert.ok(p.key.startsWith(`office:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Office uses four practical lights without adding shadow maps');
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
        assert.equal(initial.props.filter(p => p.id.startsWith('office-station-')).length, 1);
        const snapshot = () => page.evaluate(() => ErgoFlex.workspaceRoom.assets().filter(o => o.userData.officeStation).map(o => ({
            key:o.userData.sceneAssetKey, pose:o.userData.officeStation, position:o.position.toArray(),
            geometry:o.children.filter(m => m.isMesh).map(m => m.geometry.uuid),
            surfaces:o.children.filter(m => m.isMesh).length,
            grain:o.children.some(m => m.isMesh && m.material.map),
            matrix:o.children.filter(m => m.isMesh).map(m => m.matrixWorld.toArray())
        })));
        await capture('apartment-initial');
        const before = await snapshot(), lights = [];
        console.log('Office station batches:', before[0].surfaces, 'from', before[0].pose.sourceMeshCount, 'CAD meshes');
        assert.ok(before[0].surfaces < before[0].pose.sourceMeshCount / 4, 'Secondary CAD meshes are batched by material');
        assert.ok(before[0].grain, 'Material textures survive snapshots');
        assert.equal(before[0].pose.height, 43.5); assert.equal(before[0].pose.tilt, 39);
        for (const [mode, h, t] of [['morning',43.5,-5], ['afternoon',28,0], ['evening',43.5,18], ['night',28,0], ['party',43.5,-5]]) {
            await page.click(`[data-office-mode="${mode}"]`);
            await page.waitForFunction((h,t) => Math.abs(ErgoFlex.heightInches-h)<.03 && Math.abs(ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg-t)<.03, {timeout:120000}, h,t);
            const data = await measure(); checkBounds(data); assert.equal(data.atmosphere, mode); lights.push(data.lights);
            assert.deepEqual(await snapshot(), before, 'Main lift, tilt and mode placement leave secondary desks fixed');
        }
        assert.equal(new Set(lights.map(l=>JSON.stringify(l))).size, 5, 'Distinct practical lighting in all five modes');
        await page.evaluate(() => { ErgoFlex.setGlidePosition(0, .3); });
        await new Promise(r => setTimeout(r, 700));
        assert.deepEqual(await snapshot(), before, 'Glide affects only the main desk');
        const edited = await page.evaluate(() => {
            const station = ErgoFlex.workspaceRoom.assets().find(o=>o.userData.officeStation);
            station.updateWorldMatrix(true,false);const before=station.matrixWorld.clone();
            station.position.x -= 50; ErgoFlex.commitTransform([{obj:station,before}]);
            return station.position.x;
        });
        for (const [id,count] of [['house',3],['spacious',4],['premium',5],['executive',6]]) {
            console.log('Checking Office room:',id);
            await page.select('#office-room-size',id); await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const data=await measure();checkBounds(data);
            assert.equal(data.props.filter(p=>p.id.startsWith('office-station-')).length,count-1);
            assert.equal(data.props.filter(p=>p.id==='steelcase-leap-v2').length,count);
            const narrow=await snapshot(); assert.ok(narrow.every(s=>s.pose.widthMm===48*25.4));
            await page.click('[data-office-size="60x30"]'); await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const wide=await measure();checkBounds(wide);assert.equal(wide.id,id);
            assert.ok((await snapshot()).every(s=>s.pose.widthMm===60*25.4));
            assert.ok(Math.abs(data.props.find(p=>p.id==='steelcase-leap-v2').scale-wide.props.find(p=>p.id==='steelcase-leap-v2').scale)<1e-8, 'Chairs retain physical scale');
            await page.click('[data-office-size="48x30"]'); await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        }
        await page.select('#office-room-size','apartment'); await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.workspaceRoom.assets().find(o=>o.userData.officeStation).position.x)-edited)<1e-6,'Station edits restore after room switches');
        await page.evaluate(async()=>{ErgoFlex.setStudyLayout('house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setStudyMode('night',false);});
        assert.equal(await page.evaluate(()=>ErgoFlex.officeMode),'party');
        await page.evaluate(async()=>{ErgoFlex.setOfficeLayout('executive');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setOfficeMode('afternoon');});
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());
        assert.equal(project.presentation.officeLayout,'executive');assert.equal(project.presentation.officeMode,'afternoon');assert.equal(project.presentation.studyMode,'night');
        const restore=await page.evaluate(async p=>{ErgoFlex.setRoomScene('product',false);const r=ErgoFlex.applyProject(p);await ErgoFlex.workspaceRoom.ready;return {r,mode:ErgoFlex.officeMode,layout:ErgoFlex.officeLayout,height:ErgoFlex.heightInches};},project);
        assert.equal(restore.r.ok,true);assert.equal(restore.layout,'executive');assert.equal(restore.mode,'afternoon');
        checkBounds(await measure());
        assert.ok(Math.abs(restore.height-project.motion.heightInches)<1e-6,'Project restores the captured physical pose');
        await page.evaluate(()=>ErgoFlex.setOfficeMode('afternoon'));
        await page.waitForFunction(()=>Math.abs(ErgoFlex.heightInches-28)<.03,{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(1);ErgoFlex.renderer.shadowMap.enabled=true;});
        await capture('executive-afternoon');
        await page.evaluate(async()=>{ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.setOfficeLayout('apartment');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setOfficeMode('morning');});
        await page.waitForFunction(()=>Math.abs(ErgoFlex.heightInches-43.5)<.03,{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(1);ErgoFlex.renderer.shadowMap.enabled=true;});
        await capture('apartment-morning');
        await page.select('#camera-view','hero');await new Promise(r=>setTimeout(r,900));await page.screenshot({path:path.join(out,'main-desk.png')});
        await page.setViewport({width:390,height:844});
        assert.equal(await page.$eval('#office-room-controls',p=>p.hidden),false);
        assert.ok(await page.$eval('#office-room-size',el=>el.getBoundingClientRect().width>0));
        assert.deepEqual(errors,[]);
        console.log('Office: five measured rooms, 2–6 actual ErgoFlex units, batched textured secondary desks, independent main motion, both widths, five modes, physical bounds, station edits and project restore passed.');
        console.log('Review screenshots: '+out);
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
