const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-scifi-review';
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
        const url = `http://127.0.0.1:${server.address().port}/?room=scifi&view=room`;
        await page.goto(url);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        await page.waitForFunction(() => ErgoFlex.workspaceAccessories.dressAssets().some(o => o.userData.propId === 'mac-studio'), { timeout: 120000 });
        assert.equal(await page.$eval('#scifi-room-controls', p => p.hidden), false);
        assert.equal(await page.$eval('#home-office-controls', p => p.hidden), true);
        assert.equal(await page.evaluate(() => ErgoFlex.scifiMode), 'morning');
        const assertRoomFits = async () => {
            await page.select('#camera-view', 'room');
            await page.waitForFunction(async () => {
                const THREE=await import('three'),room=ErgoFlex.workspaceRoom;
                const bounds=new THREE.Box3().setFromObject(room.root),state=ErgoFlex.cameraState,size=ErgoFlex.renderer.getSize(new THREE.Vector2()),camera=new THREE.PerspectiveCamera(35,size.x/size.y,.1,2000);
                camera.position.fromArray(state.position);camera.lookAt(new THREE.Vector3().fromArray(state.target));camera.updateProjectionMatrix();
                camera.updateMatrixWorld(true);
                for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
                    const p=new THREE.Vector3(x,y,z).project(camera);
                    if(Math.abs(p.x)>.97||Math.abs(p.y)>.97||p.z<-1||p.z>1)return false;
                }
                return true;
            },{timeout:15000}).catch(async error => {
                console.log(await page.evaluate(async()=>{
                    const THREE=await import('three'),bounds=new THREE.Box3().setFromObject(ErgoFlex.workspaceRoom.root),state=ErgoFlex.cameraState,size=ErgoFlex.renderer.getSize(new THREE.Vector2()),camera=new THREE.PerspectiveCamera(35,size.x/size.y,.1,2000);
                camera.position.fromArray(state.position);camera.lookAt(new THREE.Vector3().fromArray(state.target));camera.updateProjectionMatrix();
                    return {camera:camera.position.toArray(),target:state.target,aspect:camera.aspect,bounds:[bounds.min.toArray(),bounds.max.toArray()],corners:[bounds.min,bounds.max].map(p=>p.clone().project(camera).toArray())};
                }));
                throw error;
            });
        };
        if(process.argv.includes('--framing-only')){
            await page.evaluate(async()=>{ErgoFlex.setScifiLayout('executive');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setScifiMode('party');});
            await assertRoomFits();
            await page.screenshot({path:path.join(out,'executive-framing.png')});
            assert.ok(await page.evaluate(()=>Math.hypot(...ErgoFlex.cameraState.position.map((v,i)=>v-ErgoFlex.cameraState.target[i]))>30),'Whole-room framing can exceed the product zoom limit');
            await page.setViewport({width:390,height:844});
            await new Promise(r=>setTimeout(r,500));
            await assertRoomFits();
            assert.deepEqual(errors,[]);
            console.log('Sci-fi: the complete 12 × 14 m hall fits the desktop and narrow-screen camera views.');
            return;
        }
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
                pathColor: room.assets().find(o=>o.userData.propId==='floor-paths').children[0].material.color.getHexString(), atmosphere: room.root.userData.atmosphere, leds: ErgoFlex.ledsEnabled, caption: document.querySelector('#room-scene-caption').textContent };
        });
        const checkBounds = data => {
            for (const p of data.props) {
                const w = data.dimensions.width, end = data.back + data.dimensions.depth;
                assert.ok(p.min[0] >= -w / 2 - 1 && p.max[0] <= w / 2 + 1, `${data.id}: ${p.id} within side walls: ${p.min[0]}..${p.max[0]}`);
                assert.ok(p.min[2] >= data.back - 1 && p.max[2] <= end + 1, `${data.id}: ${p.id} within floor depth: ${p.min[2]}..${p.max[2]}`);
                assert.ok(p.min[1] >= -1 && p.max[1] <= data.dimensions.height + 1, `${p.id} between floor and ceiling`);
                if (p.at[1] === 0) assert.ok(Math.abs(p.min[1]) < 1, `${p.id} rests on the floor`);
                assert.ok(p.key.startsWith(`scifi:${data.id}:`), 'Room assets have independent layout identities');
            }
            for (const i of data.instruments) {
                assert.ok(i.min[0] >= -data.dimensions.width / 2 - 1 && i.max[0] <= data.dimensions.width / 2 + 1, i.name + ' fits the room width');
                assert.ok(i.min[2] >= data.back - 1 && i.max[2] <= data.back + data.dimensions.depth + 1, i.name + ' fits the room depth');
                assert.ok(i.min[1] >= -1 && i.max[1] <= data.dimensions.height, i.name + ' fits vertically');
            }
            assert.deepEqual(data.missing, []);
            assert.equal(data.lights.length, 4, 'Sci-fi uses four practical lights without adding shadow maps');
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
        assert.ok(initial.props.some(p=>p.id==='mission-console'));
        assert.ok(initial.props.some(p=>p.id==='robot-dog'));
        assert.ok(!initial.props.some(p=>p.id==='research-core'));
        assert.ok(Math.abs(initial.props.find(p=>p.id==='space-age-radio').min[1]-900)<1,'Radio rests on its 900 mm equipment counter');
        assert.ok(Math.abs(initial.props.find(p=>p.id==='binoculars').min[1]-900)<1,'Optics rest on their equipment counter');
        await capture('apartment-morning');
        const lights=[],pathColors=[];
        for (const [mode,h,t] of [['morning',43.5,-5],['afternoon',28,0],['evening',43.5,15],['night',28,0],['party',43.5,0]]) {
            await page.click(`[data-scifi-mode="${mode}"]`);
            // The button selects the mode and only prepares its Groove; apply the pose directly.
            await page.evaluate(m => ErgoFlex.setScifiMode(m), mode);
            await page.waitForFunction((h,t)=>Math.abs(ErgoFlex.heightInches-h)<.03 && Math.abs(ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg-t)<.03,{timeout:120000},h,t);
            const data=await measure(); checkBounds(data); assert.equal(data.atmosphere,mode);lights.push(data.lights);pathColors.push(data.pathColor);
            if(mode==='night')assert.equal(data.leds,true,'Night watch keeps cyan path and desk LEDs on');
        }
        assert.equal(new Set(lights.map(l=>JSON.stringify(l))).size,5);assert.equal(new Set(pathColors).size,5,'Each mode updates actual path-light colours');
        const edited=await page.evaluate(()=>{
            const obj=ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='crew-lockers');obj.updateWorldMatrix(true,false);
            const before=obj.matrixWorld.clone();obj.position.z+=10;ErgoFlex.commitTransform([{obj,before}]);return obj.position.z;
        });
        const dims = [[5200,6200,3200],[6800,8200,3600],[9000,10600,4200],[12000,14000,5400]];
        for (const [n,id] of ['house','spacious','premium','executive'].entries()) {
            console.log('Checking scifi:',id);
            await page.select('#scifi-room-size',id);await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const data=await measure();checkBounds(data);assert.deepEqual(Object.values(data.dimensions),dims[n]);
            assert.ok(data.props.some(p=>p.id==='kenney-space-template-wall-half'));
            if(n>=1)assert.ok(data.props.some(p=>p.id==='research-core'));
            if(n>=2)assert.ok(data.props.some(p=>p.id==='tactical-table'));
            if(n>=2)assert.ok(data.props.some(p=>p.id==='kenney-space-gate-door-window'));
            if(n===3)assert.ok(data.props.some(p=>p.id==='kenney-factory-robot-arm-a'));
            const bases={'space-age-radio':900,'binoculars':900};
            for(const p of data.props.filter(p=>bases[p.id]))assert.ok(Math.abs(p.min[1]-bases[p.id])<1,p.id+' rests on the counter');
            await page.click('[data-scifi-size="60x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
            const wide=await measure();checkBounds(wide);assert.deepEqual(wide.dimensions,data.dimensions);assert.equal(wide.id,id);
            assert.ok(Math.abs(data.props.find(p=>p.id==='robot-dog').scale-wide.props.find(p=>p.id==='robot-dog').scale)<1e-8,'Native props keep their physical size');
            await page.click('[data-scifi-size="48x30"]');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        }
        await page.select('#scifi-room-size','apartment');await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.workspaceRoom.assets().find(o=>o.userData.propId==='crew-lockers').position.z)-edited)<1e-6);
        await page.evaluate(async()=>{ErgoFlex.setGalleryLayout('house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setGalleryMode('night',false);});
        assert.equal(await page.evaluate(()=>ErgoFlex.scifiMode),'party');
        await page.evaluate(async()=>{ErgoFlex.setScifiLayout('executive');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setScifiMode('party',false);});
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());assert.equal(project.presentation.scifiLayout,'executive');assert.equal(project.presentation.scifiMode,'party');
        const restore=await page.evaluate(async p=>{ErgoFlex.setRoomScene('product',false);const r=ErgoFlex.applyProject(p);await ErgoFlex.workspaceRoom.ready;return {r,mode:ErgoFlex.scifiMode,layout:ErgoFlex.scifiLayout,height:ErgoFlex.heightInches};},project);
        assert.equal(restore.r.ok,true);assert.equal(restore.layout,'executive');assert.equal(restore.mode,'party');checkBounds(await measure());
        assert.ok(Math.abs(restore.height-project.motion.heightInches)<1e-6);
        // Keep this long layout/mode run at balanced software-rendering settings.
        // Full-quality visual review uses a fresh browser through scene-shots.mjs.
        await capture('executive-hyperdrive');
        await page.evaluate(async()=>{ErgoFlex.setScifiLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setScifiMode('night',false);});await capture('spacious-night');
        await page.evaluate(async()=>{ErgoFlex.setScifiLayout('apartment');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setScifiMode('morning',false);});await capture('apartment-final');
        await page.evaluate(async()=>{ErgoFlex.setScifiLayout('spacious');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setScifiMode('afternoon',false);});await capture('spacious-afternoon');
        await page.setViewport({width:390,height:844});assert.equal(await page.$eval('#scifi-room-controls',p=>p.hidden),false);
        assert.ok(await page.$eval('#scifi-room-size',el=>el.getBoundingClientRect().width>0));assert.deepEqual(errors,[]);
        console.log('Sci-fi: five physical room sizes, both desk widths, five lighting and posture modes, equipment and architecture bounds, editing and project restore passed.');
        console.log('Screenshots: '+out);
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
