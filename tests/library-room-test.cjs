const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-library-review';
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
        const url = `http://127.0.0.1:${server.address().port}/?room=library&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'journal'), { timeout: 120000 });
        assert.equal(await page.$eval('#library-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.libraryMode), 'morning');
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
                atmosphere: room.root.userData.atmosphere, leds: ErgoFlex.ledsEnabled, caption: document.querySelector('#room-scene-caption').textContent };
        });
        const checkBounds = data => {
            for (const p of data.props) {
                const w = data.dimensions.width, end = data.back + data.dimensions.depth;
                assert.ok(p.min[0] >= -w / 2 - 1 && p.max[0] <= w / 2 + 1, `${data.id}: ${p.id} within side walls: ${p.min[0]}..${p.max[0]}`);
                assert.ok(p.min[2] >= data.back - 1 && p.max[2] <= end + 1, `${data.id}: ${p.id} within floor depth: ${p.min[2]}..${p.max[2]}`);
                assert.ok(p.min[1] >= -1 && p.max[1] <= data.dimensions.height + 1, `${p.id} between floor and ceiling`);
                if (p.at[1] === 0) assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
                assert.ok(p.key.startsWith(`library:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Library uses four practical lights without adding shadow maps');
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
        assert.deepEqual(initial.dimensions,{width:5400,depth:6600,height:3000});
        assert.ok(initial.props.some(p=>p.id==='pilot-information'));
        assert.ok(initial.props.some(p=>p.id==='rear-0'));
        assert.ok(initial.props.some(p=>p.id==='reading-table-0'));
        for(const p of initial.props.filter(p=>['kenney-furniture-laptop','kenney-furniture-books'].includes(p.id))) assert.ok(Math.abs(p.min[1]-740)<1,'Study props rest on the 740 mm tabletop');
        const shelfBatches = await page.evaluate(()=>{
            const shelf=ErgoFlex.workspaceRoom.assets().find(o=>o.userData.libraryStack);
            return {batches:shelf.children.filter(o=>o.isInstancedMesh).length,books:shelf.children.filter(o=>o.isInstancedMesh).reduce((n,o)=>n+o.count,0)};
        });
        assert.equal(shelfBatches.batches,6);assert.equal(shelfBatches.books,126,'Books are batched by material: packed runs, leaning books and lying stacks');
        await capture('apartment-morning');
        const lights=[];
        for (const [mode,h,t] of [['morning',43.5,-5],['afternoon',28,0],['evening',28,12],['night',28,0],['party',43.5,-5]]) {
            await page.click(`[data-library-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setLibraryMode(m), mode);
            await page.waitForFunction((h,t)=>Math.abs(ErgoFlex.heightInches-h)<.03 && Math.abs(ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg-t)<.03,{timeout:120000},h,t);
            const data=await measure(); checkBounds(data); assert.equal(data.atmosphere,mode);lights.push(data.lights);
            if(mode==='night')assert.equal(data.leds,true,'Late study has warm desk LEDs');
        }
        assert.equal(new Set(lights.map(l=>JSON.stringify(l))).size,5);
        const edited=await page.evaluate(()=>{
            const obj=ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='reading-table-0');obj.updateWorldMatrix(true,false);
            const before=obj.matrixWorld.clone();obj.position.z+=10;ErgoFlex.commitTransform([{obj,before}]);return obj.position.z;
        });
        const dims = [[7200,9000,3100],[10000,12000,3400],[13000,16000,3800],[18000,20000,4400]];
        for (const [n,id] of ['house','spacious','premium','executive'].entries()) {
            console.log('Checking library:',id);
            await page.select('#library-room-size',id);await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const data=await measure();checkBounds(data);assert.deepEqual(Object.values(data.dimensions),dims[n]);
            const stackCount=[4,7,13,22][n];
            assert.equal(data.props.filter(p=>p.id?.startsWith('rear-')||p.id?.startsWith('stack-')).length,stackCount);
            if(n>=1) assert.ok(data.props.some(p=>p.id==='carrel-0'));
            for(const p of data.props.filter(p=>['kenney-furniture-laptop','kenney-furniture-books','journal'].includes(p.id)&&p.at[1]===740))assert.ok(Math.abs(p.min[1]-740)<1,p.id+' rests on the study table');
            await page.click('[data-library-size="60x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const wide=await measure();checkBounds(wide);assert.deepEqual(wide.dimensions,data.dimensions);assert.equal(wide.id,id);
            assert.ok(Math.abs(data.props.find(p=>p.id==='steelcase-leap-v2').scale-wide.props.find(p=>p.id==='steelcase-leap-v2').scale)<1e-8,'Native props keep their physical size');
            await page.click('[data-library-size="48x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        }
        await page.select('#library-room-size','apartment');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='reading-table-0').position.z)-edited)<1e-6);
        await page.evaluate(async()=>{ErgoFlex.setCoworkingLayout('house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setCoworkingMode('night',false);});
        assert.equal(await page.evaluate(()=>ErgoFlex.libraryMode),'party');
        await page.evaluate(async()=>{ErgoFlex.setLibraryLayout('executive');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setLibraryMode('party',false);});
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());assert.equal(project.presentation.coworkingMode,'night');assert.equal(project.presentation.libraryLayout,'executive');assert.equal(project.presentation.libraryMode,'party');
        const restore=await page.evaluate(async p=>{ErgoFlex.setRoomScene('product',false);const r=ErgoFlex.applyProject(p);await ErgoFlex.workspaceRoom.ready;return {r,mode:ErgoFlex.libraryMode,layout:ErgoFlex.libraryLayout,height:ErgoFlex.heightInches};},project);
        assert.equal(restore.r.ok,true);assert.equal(restore.layout,'executive');assert.equal(restore.mode,'party');checkBounds(await measure());
        assert.ok(Math.abs(restore.height-project.motion.heightInches)<1e-6);
        // Keep this long layout/mode run at balanced software-rendering settings.
        // Full-quality visual review uses a fresh browser through scene-shots.mjs.
        await capture('executive-opening');
        await page.evaluate(async()=>{ErgoFlex.setLibraryLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setLibraryMode('night',false);});await capture('spacious-night');
        await page.evaluate(async()=>{ErgoFlex.setLibraryLayout('apartment');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setLibraryMode('morning',false);});await capture('apartment-final');
        await page.evaluate(async()=>{ErgoFlex.setLibraryLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setLibraryMode('afternoon',false);});await capture('spacious-afternoon');
        await page.setViewport({width:390,height:844});assert.equal(await page.$eval('#library-room-controls',p=>p.hidden),false);
        assert.ok(await page.$eval('#library-room-size',el=>el.getBoundingClientRect().width>0));assert.deepEqual(errors,[]);
        console.log('Library: five physical room sizes, both desk widths, five lighting and posture modes, book stack batching, study surface contacts and furniture bounds, editing and project restore passed.');
        console.log('Screenshots: '+out);
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
