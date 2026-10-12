const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try {
        const page = await browser.newPage(), errors = [];
        page.setDefaultNavigationTimeout(120000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if(m.type()==='error' && /Accessory model failed|Shader Error|WebGLProgram/.test(m.text())) { errors.push(m.text());console.error(m.text()); } });
        await page.setViewport({width:1600,height:1100});
        const url = `http://127.0.0.1:${server.address().port}/?view=product`;
        const ready = async () => {
            await page.waitForFunction(() => window.ErgoFlex?.renderer, {timeout:120000});
            await page.evaluate(() => ErgoFlex.renderer.setAnimationLoop(null));
            await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).display==='none', {timeout:120000});
            await page.evaluate(async () => { await ErgoFlex.workspaceAccessories.ready; ErgoFlex.renderer.setPixelRatio(.75); });
        };
        await page.goto(url); await ready();
        const library = await page.evaluate(async () => {
            const {PROP_LIBRARY} = await import('/workspace-3d.mjs?v=ergoflex-collection-20261011');
            const THREE = await import('three');
            await PROP_LIBRARY.loadIndex();
            const results = [];
            for (const entry of PROP_LIBRARY.index.props.filter(p => p.collection==='ErgoFlex Collection')) {
                const model = await PROP_LIBRARY.instance(entry.id);
                const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();
                entry.size.forEach((v,i) => { if(Math.abs(v-size[i])>2) throw Error(entry.id+' bounds mismatch: '+size+' vs '+entry.size); });
                results.push(entry.id);
            }
            return results;
        });
        assert.equal(library.length,29,'all supplied models load at their indexed dimensions');
        fs.mkdirSync(path.join(root,'scene-shots/ergoflex-collection'),{recursive:true});
        for (const id of ['office','artist','gaming','music','library']) {
            await page.evaluate(id => document.querySelector(`[data-preset="${id}"]`).click(), id);
            const state = await page.evaluate(async () => {
                await ErgoFlex.workspaceAccessories.ready;
                const workspace = ErgoFlex.workspaceAccessories;
                const props = workspace.objects().filter(o => o.userData.propId || o.children.some(c=>c.userData.propId));
                let meshes=0; workspace.exportGroups().forEach(g=>g.traverse(o=>{if(o.isMesh)meshes++;}));
                workspace.update();
                ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene, ErgoFlex.roomInteractions.camera);
                return {selected:ErgoFlex.currentConfig.accessories.length,roots:workspace.items.size,
                    errors:props.filter(o=>o.userData.loadError).length, loaded:props.every(o=>o.children.length>0),meshes,
                    quote:document.querySelector('#total-price').textContent, accessoryNames:[...workspace.items.keys()]};
            });
            assert.equal(state.errors,0);assert.equal(state.loaded,true);assert.ok(state.meshes>10);
            assert.match(state.quote,/quote/);assert.ok(state.roots>1);
            await page.screenshot({path:path.join(root,'scene-shots/ergoflex-collection',id+'.png')});
            console.log(id+': supplied accessories load and export; quote pricing is explicit.');
        }
        await page.evaluate(async () => {
            document.querySelector('[data-preset="office"]').click();
            ErgoFlex.toggleAccessory('wide-monitor'); ErgoFlex.toggleAccessory('wide-monitor');
            await ErgoFlex.workspaceAccessories.ready;
        });
        assert.equal(await page.evaluate(() => ErgoFlex.workspaceAccessories.items.get('wide-monitor').children.filter(o=>o.userData.propId).length),1,'rapid remove/re-add attaches exactly one model');
        const mounts = await page.evaluate(async () => {
            const w = ErgoFlex.workspaceAccessories, T = await import('three');
            const check = () => {
                w.update(); const arm=w.items.get('monitor-arm-2');
                return arm.userData.armConnections.map(c=>{
                    const display=w.items.get(c.displayId),p=display.userData.displayMount.clone();
                    p.add(display.getObjectByName('Prop:'+ (c.displayId==='wide-monitor'?'ergoflex-wide-monitor':'ergoflex-portrait-monitor')).position);
                    return arm.localToWorld(c.end.clone()).distanceTo(display.localToWorld(p));
                });
            };
            const mouse=w.items.get('logitech-mx-master');
            const initial=check();
            ErgoFlex.sceneDesks.objects.select('accessory-portrait-monitor');
            ErgoFlex.sceneDesks.objects.change({x:400,y:30,z:120,rotation:12});
            const moved=check(); const signature=w.items.get('monitor-arm-2').userData.armFitSignature;
            w.update(); const stable=signature===w.items.get('monitor-arm-2').userData.armFitSignature;
            return { initial,moved,stable,mouse:mouse.children.some(c=>c.userData.propId==='ergoflex-mx-master-mouse'),
                preserved:w.items.get('portrait-monitor').position.x===400,
                heads:w.items.get('monitor-arm-2').userData.armHeads.length };
        });
        assert.equal(mounts.mouse,true,'Office uses the actual supplied MX Master GLB');
        assert.equal(mounts.heads,2);assert.equal(mounts.initial.length,2);
        assert.ok([...mounts.initial,...mounts.moved].every(v=>v<1e-6),'CAD arms attach to both display backs before and after edits');
        assert.equal(mounts.preserved,true,'Arm fitting must preserve user screen positions');
        assert.equal(mounts.stable,true,'Unchanged mounts do not allocate fresh geometry every frame');
        const exported = await page.evaluate(async () => {
            const {GLTFExporter} = await import('three/addons/exporters/GLTFExporter.js');
            const w=ErgoFlex.workspaceAccessories;
            const binary=await new GLTFExporter().parseAsync(w.exportGroups(),{binary:true});
            ErgoFlex.toggleAccessory('monitor-arm-2');ErgoFlex.toggleAccessory('monitor-arm');await w.ready;w.update();
            const single=w.items.get('monitor-arm'), result={bytes:binary.byteLength,single:single.userData.armConnections.length,
                secondStand:w.items.get('portrait-monitor').getObjectByName('monitor-stand').visible};
            ErgoFlex.toggleAccessory('monitor-arm');ErgoFlex.toggleAccessory('monitor-arm-2');await w.ready;
            return result;
        });
        assert.ok(exported.bytes>100000&&exported.bytes<10000000,'mounted accessories export to a reasonably sized GLB');
        assert.equal(exported.single,1,'one single-arm mounting head');
        assert.equal(exported.secondStand,true,'a second display keeps its stand when the first uses the single arm');
        await page.evaluate(async()=>{
            const T=await import('three'),ctx=ErgoFlex.sceneDesks.ctx,w=ErgoFlex.workspaceAccessories,m=w.mounts.get('shelf').group;
            ctx.controls.target.copy(m.localToWorld(new T.Vector3(0,180,0)));
            ctx.camera.position.copy(m.localToWorld(new T.Vector3(850,650,-1600)));
            ctx.controls.update();w.update();ErgoFlex.renderer.render(ctx.scene,ctx.camera);
        });
        await page.screenshot({path:path.join(root,'scene-shots/ergoflex-collection','office-arm-fit.png')});
        const moved = await page.evaluate(() => {
            const w=ErgoFlex.workspaceAccessories, tray=w.items.get('keyboard-tray');
            w.update(); const before=tray.matrixWorld.elements.slice();
            ErgoFlex.setHeight(43); ErgoFlex.setTilt('tilting',10); w.update();
            return {before,after:tray.matrixWorld.elements.slice(),local:tray.position.toArray()};
        });
        assert.notDeepEqual(moved.before,moved.after,'tray follows desk lift and tilt');
        const selected = await page.evaluate(() => { document.querySelector('#save-build').click(); return ErgoFlex.currentConfig.accessories; });
        await page.goto(url); await ready();
        assert.deepEqual(await page.evaluate(() => ErgoFlex.currentConfig.accessories),selected,'saved build restores every new accessory');
        const decoration = await page.evaluate(async () => {
            ErgoFlex.setRoomScene('creative');
            await ErgoFlex.workspaceRoom.ready; await ErgoFlex.sceneDesks.objects.ready;
            await ErgoFlex.addSceneAsset('ergoflex-artist-stool');
            const id = await ErgoFlex.sceneDesks.objects.add('ergoflex-painter-shelf','shelf');
            const item = ErgoFlex.sceneDesks.active.objects.get(id);
            return { floor: ErgoFlex.workspaceRoom.assets().some(o=>o.userData.propId==='ergoflex-artist-stool'),
                desk: item.saved.propId, part: item.saved.role };
        });
        assert.equal(decoration.floor,true,'supplied furniture can be added to a room');
        assert.equal(decoration.desk,'ergoflex-painter-shelf');assert.equal(decoration.part,'shelf','supplied props can be added to a selected desk surface');
        for (const [scene,layout,setter,wanted] of [
            ['office','apartment','setOfficeLayout',['ergoflex-triangle-table']],
            ['music','premium','setMusicLayout',['ergoflex-slim-speaker','ergoflex-coffee-table']],
            ['creative','premium','setArtistLayout',['ergoflex-coffee-table']],
            ['gaming','premium','setGamingLayout',['ergoflex-desktop-pc','ergoflex-vision-pro','ergoflex-game-table']]
        ]) {
            const result=await page.evaluate(async ({scene,layout,setter})=>{
                ErgoFlex.setRoomScene(scene);await ErgoFlex.workspaceRoom.ready;
                ErgoFlex[setter](layout);await ErgoFlex.workspaceRoom.ready;
                const T=await import('three'),r=ErgoFlex.workspaceRoom,l=r.roomLayout;
                r.root.updateMatrixWorld(true);const inverse=r.root.matrixWorld.clone().invert();
                const props=r.assets().filter(o=>o.userData.propId?.startsWith('ergoflex-')).map(o=>{
                    const b=new T.Box3();o.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();b.union(m.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));}});
                    return {id:o.userData.propId,min:b.min.toArray(),max:b.max.toArray()};
                });
                const ctx=ErgoFlex.sceneDesks.ctx;
                ctx.controls.target.copy(r.root.localToWorld(new T.Vector3(0,l.height*.3,l.back+l.depth*.5)));
                ctx.camera.position.copy(r.root.localToWorld(new T.Vector3(l.width*.9,l.height*1.8,l.back+l.depth*1.65)));
                ctx.controls.update();r.update(ctx.camera);ErgoFlex.renderer.render(ctx.scene,ctx.camera);
                return {props,width:l.width,depth:l.depth,back:l.back,height:l.height,missing:r.missingProps};
            },{scene,layout,setter});
            assert.deepEqual(result.missing,[]);
            for(const id of wanted)assert.ok(result.props.some(p=>p.id===id),scene+' is dressed with '+id);
            for(const prop of result.props){
                assert.ok(prop.min[0]>=-result.width/2-1&&prop.max[0]<=result.width/2+1,prop.id+' fits the room width');
                assert.ok(prop.min[2]>=result.back-1&&prop.max[2]<=result.back+result.depth+1,prop.id+' fits the floor depth');
                assert.ok(prop.min[1]>=-1&&prop.max[1]<=result.height+1,prop.id+' fits below the ceiling');
            }
            await page.screenshot({path:path.join(root,'scene-shots/ergoflex-collection',scene+'-room.png')});
        }
        assert.deepEqual(errors,[]);
        console.log('ErgoFlex collection integration passed: all 29 assets, presets, loading race, motion, export and saved build.');
    } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
