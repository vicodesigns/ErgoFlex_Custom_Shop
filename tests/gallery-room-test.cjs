const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-gallery-review';
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
        const url = `http://127.0.0.1:${server.address().port}/?room=gallery&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'journal'), { timeout: 30000 });
        assert.equal(await page.$eval('#gallery-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.galleryMode), 'morning');
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
                assert.ok(p.key.startsWith(`gallery:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Gallery uses four practical lights without adding shadow maps');
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
        assert.ok(initial.props.some(p=>p.id==='thinker-plinth'));
        assert.ok(initial.props.some(p=>p.id==='the-thinker'));
        assert.ok(!initial.props.some(p=>p.id==='collection-case'));
        assert.ok(Math.abs(initial.props.find(p=>p.id==='the-thinker').min[1]-850)<1,'The Thinker rests on its 850 mm display plinth');
        assert.ok(Math.abs(initial.props.find(p=>p.id==='antique-vase').min[1]-1000)<1,'Vase rests on its 1 m plinth');
        await capture('apartment-morning');
        const lights=[];
        for (const [mode,h,t] of [['morning',43.5,-5],['afternoon',28,0],['evening',28,39],['night',28,0],['party',43.5,0]]) {
            await page.click(`[data-gallery-mode="${mode}"]`);
            await page.waitForFunction((h,t)=>Math.abs(ErgoFlex.heightInches-h)<.03 && Math.abs(ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg-t)<.03,{timeout:120000},h,t);
            const data=await measure(); checkBounds(data); assert.equal(data.atmosphere,mode);lights.push(data.lights);
            if(mode==='night')assert.equal(data.leds,false,'Night mode turns desk LEDs off');
        }
        assert.equal(new Set(lights.map(l=>JSON.stringify(l))).size,5);
        const edited=await page.evaluate(()=>{
            const obj=ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='gallery-bench');obj.updateWorldMatrix(true,false);
            const before=obj.matrixWorld.clone();obj.position.z+=10;ErgoFlex.commitTransform([{obj,before}]);return obj.position.z;
        });
        const dims = [[4800,5800,3000],[6200,7200,3200],[8000,9200,3500],[10000,11800,4000]];
        for (const [n,id] of ['house','spacious','premium','executive'].entries()) {
            console.log('Checking gallery:',id);
            await page.select('#gallery-room-size',id);await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const data=await measure();checkBounds(data);assert.deepEqual(Object.values(data.dimensions),dims[n]);
            assert.ok(data.props.some(p=>p.id==='aphrodite'));
            if(n<2)assert.ok(data.props.some(p=>p.id==='armchair-poppi'));
            if(n>=1)assert.ok(data.props.some(p=>p.id==='mercury-statue'));
            if(n>=2)assert.ok(data.props.some(p=>p.id==='collection-case'));
            if(n===3)assert.ok(data.props.some(p=>p.id==='ribbon-sculpture'));
            const bases={'the-thinker':850,'antique-vase':1000,'aphrodite':120,'mercury-statue':120,'gold-award':850};
            for(const p of data.props.filter(p=>bases[p.id]))assert.ok(Math.abs(p.min[1]-bases[p.id])<1,p.id+' rests on the display surface');
            await page.click('[data-gallery-size="60x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const wide=await measure();checkBounds(wide);assert.deepEqual(wide.dimensions,data.dimensions);assert.equal(wide.id,id);
            assert.ok(Math.abs(data.props.find(p=>p.id==='the-thinker').scale-wide.props.find(p=>p.id==='the-thinker').scale)<1e-8,'Native props keep their physical size');
            await page.click('[data-gallery-size="48x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        }
        await page.select('#gallery-room-size','apartment');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='gallery-bench').position.z)-edited)<1e-6);
        await page.evaluate(async()=>{ErgoFlex.setBedroomLayout('house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setBedroomMode('night',false);});
        assert.equal(await page.evaluate(()=>ErgoFlex.galleryMode),'party');
        await page.evaluate(async()=>{ErgoFlex.setGalleryLayout('executive');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setGalleryMode('party',false);});
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());assert.equal(project.presentation.galleryLayout,'executive');assert.equal(project.presentation.galleryMode,'party');
        const restore=await page.evaluate(async p=>{ErgoFlex.setRoomScene('product',false);const r=ErgoFlex.applyProject(p);await ErgoFlex.workspaceRoom.ready;return {r,mode:ErgoFlex.galleryMode,layout:ErgoFlex.galleryLayout,height:ErgoFlex.heightInches};},project);
        assert.equal(restore.r.ok,true);assert.equal(restore.layout,'executive');assert.equal(restore.mode,'party');checkBounds(await measure());
        assert.ok(Math.abs(restore.height-project.motion.heightInches)<1e-6);
        // Keep this long layout/mode run at balanced software-rendering settings.
        // Full-quality visual review uses a fresh browser through scene-shots.mjs.
        await capture('executive-opening');
        await page.evaluate(async()=>{ErgoFlex.setGalleryLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setGalleryMode('night',false);});await capture('spacious-night');
        await page.evaluate(async()=>{ErgoFlex.setGalleryLayout('apartment');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setGalleryMode('morning',false);});await capture('apartment-final');
        await page.evaluate(async()=>{ErgoFlex.setGalleryLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setGalleryMode('afternoon',false);});await capture('spacious-afternoon');
        await page.setViewport({width:390,height:844});assert.equal(await page.$eval('#gallery-room-controls',p=>p.hidden),false);
        assert.ok(await page.$eval('#gallery-room-size',el=>el.getBoundingClientRect().width>0));assert.deepEqual(errors,[]);
        console.log('Gallery: five physical room sizes, both desk widths, five lighting and posture modes, sculpture/display bounds, editing and project restore passed.');
        console.log('Screenshots: '+out);
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
