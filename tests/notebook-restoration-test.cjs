const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-notebook-restoration';
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
    const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try {
        const page=await browser.newPage(),errors=[];
        page.setDefaultNavigationTimeout(120000);
        page.on('pageerror',e=>errors.push(e.message));
        await page.setViewport({width:1400,height:1100});
        const ready=async()=>{
            await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
            await page.evaluate(()=>ErgoFlex.renderer.setAnimationLoop(null));
            await page.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active?.objects?.size && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
            await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;});
        };
        for(const id of ['library','coworking']){
            const url=`http://127.0.0.1:${server.address().port}/?room=${id}&view=room&layout=house`;
            await page.goto(url);await ready();
            // Seed the exact two old persistence paths; retain edited position,
            // rotation and 150% size, then run real startup hydration again.
            const saved=await page.evaluate(()=>{
                const ef=ErgoFlex,project=ef.serializeProject(),p=project.presentation;
                const roomNotebook=ef.workspaceAccessories.dressAssets().find(o=>o.userData.authoredDeskNotebook);
                const key='scene:'+roomNotebook.userData.sceneAssetKey;
                const state=p.sceneAssets[ef.workspaceRoom.id+':'+ef.workspaceRoom.roomLayout.id];
                state.transforms[key] ||= {p:{x:roomNotebook.position.x,y:roomNotebook.position.y,z:roomNotebook.position.z},q:{x:roomNotebook.quaternion.x,y:roomNotebook.quaternion.y,z:roomNotebook.quaternion.z,w:roomNotebook.quaternion.w},s:{x:1,y:1,z:1}};
                state.transforms[key].p.x+=25;
                state.transforms[key].s={x:1500,y:1500,z:1500};
                const desk=ef.sceneDesks.active;
                const item=[...desk.objects.values()].find(o=>o.obj.userData.authoredDeskNotebook);
                const stored=p.sceneDesks.rooms[ef.sceneDesks.key].desks[desk.id].objects[item.id];
                stored.transform.p.x+=35;stored.transform.s={x:1250,y:1250,z:1250};
                localStorage.setItem('ergoflex.sceneAssets.v1',JSON.stringify(p.sceneAssets));
                localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({...p.sceneDesks,v:1}));
                return {key,roomX:state.transforms[key].p.x,deskId:item.id,deskX:stored.transform.p.x,assets:p.sceneAssets,desks:p.sceneDesks};
            });
            const seed=await page.evaluateOnNewDocument(saved=>{localStorage.setItem('ergoflex.sceneAssets.v1',JSON.stringify(saved.assets));localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({...saved.desks,v:1}));},saved);
            await page.reload();await ready();await page.removeScriptToEvaluateOnNewDocument(seed.identifier);
            const measure=()=>page.evaluate(async(saved)=>{
                const THREE=await import('three'),ef=ErgoFlex;
                const a=ef.workspaceAccessories.dressAssets().find(o=>'scene:'+o.userData.sceneAssetKey===saved.key);
                const b=ef.sceneDesks.active.objects.get(saved.deskId).obj;
                // Local geometry sizes keep the assertion independent of world
                // CAD calibration, camera direction and desktop tilt.
                const size=o=>new THREE.Box3().setFromObject(o.clone(true)).getSize(new THREE.Vector3()).toArray();
                return {a:{s:a.scale.toArray(),x:a.position.x,size:size(a)},b:{s:b.scale.toArray(),x:b.position.x,size:size(b)},room:ef.workspaceRoom.roomLayout.id,camera:ef.cameraState};
            },saved);
            const actual=await measure();
            assert.deepEqual(actual.a.s,[1.5,1.5,1.5],id+' scene notebook restored at 150%');
            assert.deepEqual(actual.b.s,[1.25,1.25,1.25],id+' desk notebook restored at 125%');
            assert.equal(actual.a.x,saved.roomX);assert.equal(actual.b.x,saved.deskX);
            assert.ok(Math.max(...actual.a.size)<500 && Math.max(...actual.b.size)<500,'Notebook stays under half a metre');
            await page.select('#camera-view','room');
            await new Promise(r=>setTimeout(r,800));
            await page.evaluate(()=>{const ef=ErgoFlex;ef.workspaceRoom.update(ef.roomInteractions.camera);ef.renderer.render(ef.roomInteractions.scene,ef.roomInteractions.camera);});
            await page.screenshot({path:path.join(out,id+'-restored.png')});
            // Serialize corrected placements and reload to prove no repeated
            // conversion or regression once the autosave has migrated.
            await page.evaluate(()=>{
                const p=ErgoFlex.serializeProject().presentation;
                localStorage.setItem('ergoflex.sceneAssets.v1',JSON.stringify(p.sceneAssets));
                localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({...p.sceneDesks,v:1}));
            });
            await page.reload();await ready();
            const again=await measure();assert.deepEqual(again.a.s,actual.a.s);assert.deepEqual(again.b.s,actual.b.s);
            console.log(id+': old desk placements repaired, scene source bounded, edits preserved, second reload stable.');
        }
        assert.deepEqual(errors,[]);console.log('Notebook restoration regression passed.');
    } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
