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
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=home&view=room`);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; });
        await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.equal(await page.$eval('#home-office-controls [data-groove-start]',e=>e.disabled),false,'Current setting can start without a second time selection');
        await page.click('#home-office-controls [data-groove-start]');
        await page.waitForFunction(()=>['clearance','driving','posture'].includes(ErgoFlex.grooveState.status),{timeout:30000});
        await page.evaluate(()=>ErgoFlex.haltAllMotion());
        assert.equal(await page.$$eval('.measured-room-controls [title^="Prepare "]',buttons=>buttons.length),75,'Every room daily setting advertises its Groove');

        for (const id of ((process.argv.includes('--wide') || process.argv.includes('--tap')) ? [] : ['home','gaming','music','creative','study','office','gym','kitchen','lounge','workshop','bedroom','gallery','scifi','coworking','library'])) {
            const result = await page.evaluate(async id => {
                ErgoFlex.setRoomScene(id, false); await ErgoFlex.workspaceRoom.ready;
                const rows = [];
                for (const phase of ['morning','afternoon','evening','night','party']) {
                    await ErgoFlex.prepareGrooveMode(id, phase);
                    const data = ErgoFlex.grooveRouting, state = ErgoFlex.grooveState;
                    const {poseIsClear,segmentIsClear} = await import('./room-groove.mjs');
                    const colliders = data.obstacles.filter(o => !poseIsClear(data.start, {minX:-1e8,maxX:1e8,minZ:-1e8,maxZ:1e8}, [o], data.footprint));
                    rows.push({phase, ok:state.plan.ok, reason:state.message, colliders:colliders.map(o=>o.name), safe:state.plan.ok&&state.plan.route.slice(1).every((b,i)=>segmentIsClear(state.plan.route[i],b,data.bounds,data.obstacles,data.footprint)), footprint:data.footprint, start:data.start, visited:state.plan.visited});
                }
                return rows;
            }, id);
            for (const r of result) { assert.ok(r.ok && r.safe, id + '/' + r.phase + ': ' + r.reason); }
            console.log('Groove routes:', id, 'five daily setups');
        }

        if (!process.argv.includes('--wide') && !process.argv.includes('--tap')) {
        // Exercise the real render loop and shared motion rig, not a simulated
        // timer. Choosing a phase must leave the current physical pose alone.
        await page.evaluate(async () => {
            ErgoFlex.setRoomScene('kitchen', false); await ErgoFlex.workspaceRoom.ready;
            ErgoFlex.setHeight(28); ErgoFlex.setTilt('tilting',-5);
            window.beforeGroove={...ErgoFlex.glidePosition};
            document.querySelector('[data-kitchen-mode="evening"]').click();
        });
        await page.waitForFunction(()=>ErgoFlex.grooveState.status==='ready',{timeout:30000});
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.glidePosition),await page.evaluate(()=>window.beforeGroove),'Choosing time does not teleport or drive');
        const before = await page.evaluate(()=>({height:ErgoFlex.heightInches,tilt:ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg,wheels:ErgoFlex.wheelRigs.map(r=>r.spin)}));
        await page.click('#kitchen-room-controls [data-groove-start]');
        await page.waitForFunction(()=>ErgoFlex.grooveState.status==='driving',{timeout:40000});
        await new Promise(r=>setTimeout(r,800));
        await page.evaluate(()=>ErgoFlex.haltAllMotion());
        const stopped = await page.evaluate(()=>({...ErgoFlex.glidePosition}));
        await new Promise(r=>setTimeout(r,500));
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.glidePosition),stopped,'Stop leaves desk where it stopped');
        assert.equal(await page.evaluate(()=>ErgoFlex.startGroove()),true,'Resume replans from current position');
        await page.waitForFunction(()=>ErgoFlex.grooveState.status==='idle',{timeout:60000});
        const final=await page.evaluate(()=>({height:ErgoFlex.heightInches,tilt:ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg,wheels:ErgoFlex.wheelRigs.map(r=>r.spin),pose:ErgoFlex.glidePosition,
            kit:[...ErgoFlex.workspaceAccessories.mounts.values()].flatMap(m=>m.dress.children).find(o=>o.userData.dayKit).children.filter(o=>o.visible).map(o=>o.name)}));
        assert.ok(Math.abs(final.height-36)<.05,'Arrival lift follows the evening preset');
        assert.ok(Math.abs(final.tilt-0)<.1,'Arrival tilt follows the evening preset');
        assert.notEqual(final.tilt,before.tilt,'Tilt changes through the shared motion rig');
        assert.ok(final.wheels.some((v,i)=>Math.abs(v-before.wheels[i])>.1),'Wheels turn during translation');
        assert.notDeepEqual(final.pose,await page.evaluate(()=>window.beforeGroove),'Desk moves to a new location');
        assert.deepEqual(final.kit,['Evening reading'],'Tabletop kit changes at arrival');
        // Editing an object or changing room cancels an in-progress routine.
        await page.evaluate(async()=>{await ErgoFlex.prepareGrooveMode('kitchen','morning'); ErgoFlex.startGroove(); ErgoFlex.setRoomScene('library',false);await ErgoFlex.workspaceRoom.ready;});
        assert.equal(await page.evaluate(()=>ErgoFlex.grooveState.status),'idle','Scene switch cancels motion and clears route');
        console.log('Groove playback: preparation, lift, wheels, turn, tilt, Stop/resume and scene cancellation passed');

        }
        if (!process.argv.includes('--tap')) {
        const wide = await page.evaluate(async()=>{
            const {segmentIsClear,poseIsClear}=await import('./room-groove.mjs');
            const {roomLifeBaseTransform}=await import('./room-life.mjs');
            const baseOf=o=>roomLifeBaseTransform(o,{p:{...o.position},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{...o.scale}}).p;
            const size=document.getElementById('size-select'); size.value='60x30';size.dispatchEvent(new Event('change',{bubbles:true}));
            await ErgoFlex.workspaceRoom.ready;
            const results=[];
            for(const [id,method] of [['bedroom','setBedroomLayout'],['office','setOfficeLayout'],['library','setLibraryLayout']]) {
                for(const layout of ['apartment','house','spacious','premium','executive']) {
                    ErgoFlex[method](layout); await ErgoFlex.workspaceRoom.ready;
                    const objects=ErgoFlex.workspaceRoom.life.entries.flatMap(e=>e.objects).filter(o=>o.parent),before=objects.map(baseOf);
                    await ErgoFlex.prepareGrooveMode(id,'morning');
                    const baseDrift=Math.max(0,...objects.flatMap((o,i)=>Object.keys(before[i]).map(k=>Math.abs(baseOf(o)[k]-before[i][k]))));
                    const s=ErgoFlex.grooveState,d=ErgoFlex.grooveRouting;
                    results.push({id,layout,baseDrift,ok:s.plan.ok,safe:s.plan.ok&&s.plan.route.slice(1).every((p,i)=>segmentIsClear(s.plan.route[i],p,d.bounds,d.obstacles,d.footprint)),message:s.message,width:d.footprint.halfWidth*2,colliders:d.obstacles.filter(o=>!poseIsClear(d.start,{minX:-1e8,maxX:1e8,minZ:-1e8,maxZ:1e8},[o],d.footprint)).map(o=>o.name)});
                }
            }
            return results;
        });
        console.log('Wide-desk clearance:',JSON.stringify(wide.filter(r=>!r.ok)));
        for(const r of wide){assert.ok(r.baseDrift<1e-6,'Clearing furniture preserves the saved base layout');assert.ok(r.width>1500,'60-inch desktop footprint');assert.ok(r.ok&&r.safe,r.id+'/'+r.layout+': '+r.message);}
        console.log('60-inch desk: five sizes of Bedroom, Office and Library clear routes');
        }
        // Project a visible point of the actual CAD desk and send a normal
        // pointer click, ensuring the canvas flow is wired as well as Start.
        await page.evaluate(async()=>{
            ErgoFlex.setHomeLayout('spacious'); await ErgoFlex.workspaceRoom.ready;
            ErgoFlex.setHomeMode('afternoon',false);
            const entry=[...ErgoFlex.sceneAssetRegistry.values()].find(e=>e.obj.userData.propId==='steelcase-leap-v2');
            document.querySelector(`[title="${entry.editorId}"]`).click();
            if(!ErgoFlex.movingObjects.some(e=>e.obj===entry.obj))throw Error('Room chair was not selected');
            await ErgoFlex.prepareGrooveMode('home','evening');
            if(ErgoFlex.movingObjects.some(e=>e.obj.userData.sceneAsset))throw Error('Selected furniture remained in the edit proxy during staging');
            const v=document.getElementById('camera-view');v.value='room';v.dispatchEvent(new Event('change'));
            document.getElementById('viewer-shell').scrollIntoView({block:'start'});
            ErgoFlex.focusCameraShortcut('desktop');
            document.getElementById('motion-dock').style.visibility='hidden';
        });
        await new Promise(r=>setTimeout(r,900));
        const tap=await page.evaluate(async()=>{
            const THREE=await import('three'),cs=ErgoFlex.cameraState;
            const canvas=document.getElementById('model-canvas'),r=canvas.getBoundingClientRect();
            const camera=new THREE.PerspectiveCamera(35,r.width/r.height,.1,2000);
            camera.position.fromArray(cs.position);camera.lookAt(new THREE.Vector3().fromArray(cs.target));camera.updateMatrixWorld(true);
            const ray=new THREE.Raycaster(),visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
            for(let y=.7;y>=-.7;y-=.1)for(let x=-.7;x<=.7;x+=.1){
                ray.setFromCamera(new THREE.Vector2(x,y),camera);
                const hit=ray.intersectObject(ErgoFlex.loadedModel,true).find(h=>visible(h.object));
                const other=ray.intersectObject(ErgoFlex.workspaceRoom.root,true).find(h=>visible(h.object)&&!h.object.parent?.userData.grooveMarker);
                const px=r.left+(x+1)*r.width/2,py=r.top+(1-y)*r.height/2;
                if(hit&&(!other||hit.distance<other.distance)&&document.elementFromPoint(px,py)===canvas)return {x:px,y:py};
            }
            return {failed:true,cs,rect:{x:r.x,y:r.y,w:r.width,h:r.height},sample:[-.4,0,.4].map(y=>{ray.setFromCamera(new THREE.Vector2(0,y),camera);return {y,desk:ray.intersectObject(ErgoFlex.loadedModel,true).filter(h=>visible(h.object)).slice(0,2).map(h=>({name:h.object.name,d:h.distance})),room:ray.intersectObject(ErgoFlex.workspaceRoom.root,true).filter(h=>visible(h.object)).slice(0,3).map(h=>({name:h.object.name,parent:h.object.parent?.name,d:h.distance}))};})};
        });
        await page.screenshot({path:'/tmp/ef-groove-preview.png'});
        if(tap?.failed)console.log('Tap diagnostics',JSON.stringify(tap));
        assert.ok(tap&&!tap.failed,'An unobscured CAD point is visible and clickable');
        await page.mouse.click(tap.x,tap.y);
        await page.waitForFunction(()=>['clearance','driving','posture'].includes(ErgoFlex.grooveState.status),{timeout:5000});
        await page.evaluate(()=>ErgoFlex.haltAllMotion());
        console.log('Tap the desk starts Groove through the canvas pointer handler');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
