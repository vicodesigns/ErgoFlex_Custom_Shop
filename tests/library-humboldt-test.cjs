const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://local').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream'); res.end(data);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await puppeteer.launch({headless:true, protocolTimeout:300000, args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try {
        const p = await browser.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.setViewport({width:1000,height:700});
        await p.goto(`http://127.0.0.1:${server.address().port}/?room=library&view=room&ceiling=on`,{timeout:180000});
        await p.waitForFunction(() => window.ErgoFlex?.sceneDesks && getComputedStyle(document.querySelector('#loader')).display === 'none', {timeout:180000});
        await p.evaluate(async () => { const e=ErgoFlex; e.renderer.setAnimationLoop(null); e.renderer.setPixelRatio(.3); e.renderer.shadowMap.enabled=false; await e.workspaceRoom.ready; await e.sceneDesks.objects.ready; });
        for (const layout of ['apartment','house','spacious','premium','executive']) {
            await p.evaluate(async id => { ErgoFlex.setLibraryLayout(id); await ErgoFlex.workspaceRoom.ready; await ErgoFlex.sceneDesks.objects.ready; }, layout);
            for (const size of ['48x30','60x30']) {
                const result = await p.evaluate(async size => {
                    const e=ErgoFlex,T=await import('three'),{segmentIsClear}=await import('/room-groove.mjs?v=library-humboldt-20261013');
                    e.sceneDesks.setSize(size); await e.sceneDesks.objects.ready;
                    const room=e.workspaceRoom, r=e.sceneDesks.active, phone=r.objects.get('default-library-iphone');
                    if(!phone?.obj.visible) throw Error('iPhone missing on '+size);
                    const actual=phone.obj.position.clone();
                    const expected=e.withNeutralPose(() => {
                        e.loadedModel.updateMatrixWorld(true); e.workspaceAccessories.update();
                        const charger=[...e.partRegistry.values()].find(o=>o.name==='Power_7').obj,mount=e.workspaceAccessories.mounts.get('desktop').dress;
                        mount.updateWorldMatrix(true);charger.geometry.computeBoundingBox();
                        const b=charger.geometry.boundingBox.clone().applyMatrix4(mount.matrixWorld.clone().invert().multiply(charger.matrixWorld)),c=b.getCenter(new T.Vector3()); c.y=b.max.y+.5; return c;
                    });
                    if(actual.distanceTo(expected)>.01) throw Error(size+' phone not contacting the charging insert: '+actual.toArray()+' vs '+expected.toArray());
                    const phases=[], maps=[], routes=[];
                    const board=room.assets().find(o=>o.userData.propId==='student-board');
                    const map=board.children.find(o=>o.material?.map?.name==='Library daily routine notice').material.map;
                    for(const mode of ['morning','afternoon','evening','night','party']) {
                        await e.prepareGrooveMode('library',mode);
                        const campus=room.root.userData.libraryCampus;
                        if(campus.routine!==mode) throw Error('Daily routine did not update');
                        for(const table of room.assets().filter(o=>o.userData.propId?.startsWith('reading-table-'))) {
                            const active=table.children.filter(o=>o.name.startsWith('Study materials ·')&&o.visible);
                            if(active.length!==1||active[0].name!=='Study materials · '+mode) throw Error('Study materials overlap across dayparts');
                        }
                        const state=e.grooveState,data=e.grooveRouting;
                        if(!state.plan?.ok) throw Error(room.roomLayout.id+'/'+size+'/'+mode+' blocked routine: '+state.message);
                        for(let i=1;i<state.plan.route.length;i++) if(!segmentIsClear(state.plan.route[i-1],state.plan.route[i],data.bounds,data.obstacles,data.footprint)) throw Error('Routine crosses a furnishing');
                        phases.push(campus.focus);maps.push(map.image.toDataURL());routes.push(state.plan.route.length);
                    }
                    if(new Set(maps).size!==5) throw Error('Daily notice board did not change');
                    const lamps=room.root.children.filter(o=>o.isPointLight);if(lamps.length>5||lamps.some(o=>!Number.isFinite(o.intensity)))throw Error('Practical light budget exceeded');
                    if(!room.root.userData.libraryOperations.collaborationBoard&&room.roomLayout.index>0)throw Error('Movable whiteboard missing');
                    const service=room.assets().find(o=>o.userData.propId==='research-help-counter');
                    if(service) {
                        const l=room.roomLayout,old={p:{x:-l.width/2+2600,y:0,z:l.back+4400},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}},custom=structuredClone(old);custom.p.x+=125;
                        if(room.migrateSavedTransform(service,old).p.x!==l.service[0]||room.migrateSavedTransform(service,custom)!==custom)throw Error('Counter migration overwrites custom placement');
                    }
                    return {layout:room.roomLayout.id,size,phone:actual.toArray(),phases,routes,carrels:room.roomLayout.carrels.length};
                },size);
                console.log(JSON.stringify(result));
            }
        }
        const edits = await p.evaluate(async () => {
            const e=ErgoFlex,m=e.sceneDesks;m.objects.select('default-library-iphone');m.objects.change({x:333});m.setSize('48x30');await m.objects.ready;
            if(m.active.objects.get('default-library-iphone').obj.position.x===333)throw Error('Phone edit leaked across widths');
            m.setSize('60x30');await m.objects.ready;if(m.active.objects.get('default-library-iphone').obj.position.x!==333)throw Error('Phone edit lost');
            m.objects.select('default-library-iphone');m.objects.remove();m.persist();return {size:m.active.state.size};
        });
        await p.reload({timeout:180000});await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});
        await p.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;});
        assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.objects['default-library-iphone'].removed),true,'Removed default phone stays removed after reload');
        assert.deepEqual(errors,[]);
        console.log('PASS Humboldt Library: 50 layout/width/daypart routines with swept clearance, five daily notice boards and material kits, iPhone charger contact, independent edits, removal/reload, and custom furniture preservation.');
    } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
