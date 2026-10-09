const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-institutional-review';
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream'); res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    let browser;
    const errors = [];
    async function freshPage() {
        // Release software-renderer resources between rooms and project restores.
        if (browser) await browser.close();
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
        page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(120000);
        await page.setViewport({ width: 1500, height: 1100 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=security&view=room`);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none');
        await page.evaluate(async () => { ErgoFlex.renderer.setAnimationLoop(null); ErgoFlex.renderer.setPixelRatio(.4); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        return page;
    }
    try {
        let page = await freshPage();
        const registry = await page.evaluate(async () => { const m = await import('./institutional-scenes.mjs?v=institutional-atmosphere-20261008'); return { ids: m.INSTITUTIONAL_IDS, education: Object.keys(m.EDUCATIONAL_LEVELS), groups: m.INSTITUTIONAL_GROUPS, tiers: Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.keys(m.INSTITUTIONAL_ROOMS[id].layouts)])) }; });
        const ids = registry.ids;
        assert.equal(await page.$$eval('button[data-room-scene=educational]', es => es.length), 1);
        assert.equal(await page.$$eval('button[data-room-scene=kindergarten]', es => es.length), 0);
        for (const [groupId, group] of Object.entries(registry.groups)) {
            assert.equal(await page.$$eval(`button[data-room-scene=${groupId}]`, es => es.length), 1);
            for (const setting of group.settings) assert.equal(await page.$$eval(`button[data-room-scene=${setting}]`, es => es.length), 0);
        }
        assert.equal(ids.length, 12);
        assert.equal(await page.$$eval('#room-scene-select optgroup', es => es.length), 4);
        const review = [], quick = process.argv.includes('--quick');
        for (const id of ids.filter(id => !process.argv.find(a=>a.startsWith('--only=')) || process.argv.find(a=>a.startsWith('--only=')).slice(7).split(',').includes(id))) {
            if (review.length) page = await freshPage();
            const groupId = Object.keys(registry.groups).find(group => registry.groups[group].settings.includes(id));
            if (groupId) {
                await page.select('#room-scene-select', groupId);
                await page.select('.measured-room-controls:not([hidden]) [data-institutional-setting]', id);
            } else await page.select('#room-scene-select', id);
            await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; });
            for (const tier of quick ? registry.tiers[id].slice(0,1) : registry.tiers[id]) {
                await page.evaluate(async ({id,tier}) => { ErgoFlex.setMeasuredRoomLayout(id, tier); await ErgoFlex.workspaceRoom.ready; }, {id,tier});
                const data = await page.evaluate(async () => {
                    const THREE = await import('three'), r = ErgoFlex.workspaceRoom, l = r.roomLayout;
                    r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert();
                    const assets = r.assets().map(o => {
                        const b = new THREE.Box3(); o.traverse(m => { if (m.isMesh && !m.isInstancedMesh) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld))); } });
                        return {name:o.name,key:o.userData.sceneAssetKey,min:b.min.toArray(),max:b.max.toArray()};
                    });
                    return {scene:r.id,layout:l,assets,size:ErgoFlex.currentConfig.size,missing:r.missingProps,
                        panel:!document.getElementById(`${r.id}-room-controls`).hidden,
                        interactions:ErgoFlex.roomInteractions.entries.map(e => ({name:e.name,surface:e.surface,pushable:e.pushable}))};
                });
                assert.equal(data.scene,id); assert.equal(data.layout.id,tier); assert.ok(data.panel);
                assert.equal(data.size,tier==='apartment'?'48x30':'60x30'); assert.deepEqual(data.missing,[]);
                if (groupId) {
                    assert.equal(await page.$eval('#room-scene-select', e => e.value), groupId);
                    assert.equal(await page.$eval(`#${id}-room-controls [data-institutional-setting]`, e => e.value), id);
                    assert.equal(await page.$eval(`#${id}-room-size`, e => e.hidden), groupId === 'educational');
                }
                if (registry.education.includes(id)) {
                    assert.equal(await page.$eval('#room-scene-select', e => e.value), 'educational');
                    assert.equal(await page.$eval(`#${id}-room-size`, e => e.hidden), true);
                    assert.equal(await page.$eval(`#${id}-room-controls [data-educational-level]`, e => e.value), id);
                }
                assert.ok(data.assets.some(a=>a.name==='Daily planning table'));
                const purpose={security:'Security console table',police:'Case review workstation',government:'Public service workstation',kindergarten:'Shared learning table',elementary:'Shared learning table',middleschool:'Student work table',highschool:'Student work table',college:'Student work table',university:'Seminar table',laboratory:'Laboratory bench',hospital:'Hospital care bed',mobileit:'IT equipment rack'};
                assert.ok(data.assets.some(a=>a.name===purpose[id]),`${id}: characteristic furnishings`); assert.ok(data.interactions.some(e=>e.surface==='wall'));
                assert.ok(data.interactions.some(e=>e.pushable));
                for(const a of data.assets) {
                    assert.ok(a.key.startsWith(`${id}:${tier}:`),`${id}/${tier}: stable asset ${a.name}`);
                    assert.ok(a.min[0]>=-data.layout.width/2-100 && a.max[0]<=data.layout.width/2+100,`${id}/${tier}: width ${a.name} ${a.min} ${a.max}`);
                    assert.ok(a.min[2]>=data.layout.back-100 && a.max[2]<=data.layout.back+data.layout.depth+100,`${id}/${tier}: depth ${a.name}`);
                    assert.ok(a.min[1]>=-5 && a.max[1]<=data.layout.height,`${id}/${tier}: height ${a.name}`);
                }
                // Every scene/layout has five usable, collision-aware Groove plans.
                const modes=[];
                for (const phase of quick ? ['afternoon','night','party'] : ['morning','afternoon','evening','night','party']) {
                    const state=await page.evaluate(async({id,phase})=>{
                        await ErgoFlex.prepareGrooveMode(id,phase);
                        return {state:ErgoFlex.grooveState,mode:ErgoFlex.measuredRoom.mode,atmosphere:ErgoFlex.workspaceRoom.root.userData.atmosphere,
                            atmosphereDetail:ErgoFlex.workspaceRoom.root.userData.institutionalAtmosphere,polish:ErgoFlex.workspaceRoom.root.userData.polish,practicals:ErgoFlex.workspaceRoom.root.children.filter(o=>o.isPointLight).map(o=>o.intensity)};
                    },{id,phase});
                    assert.equal(state.mode,phase); assert.equal(state.atmosphere,phase);
                    assert.equal(state.state.status,'ready',`${id}/${tier}/${phase}: ${state.state.message}`);
                    assert.equal(state.polish.mode,phase);
                    assert.equal(state.atmosphereDetail.phase,phase,'Daypart dressing follows the selected activity');
                    assert.ok(state.atmosphereDetail.localLights >= 1 && state.atmosphereDetail.localLights <= 2);
                    modes.push(state.practicals);
                }
                assert.equal(new Set(modes.map(m=>JSON.stringify(m))).size,quick?3:5);
                review.push({id,tier,assets:data.assets.length});
            }
            await page.evaluate(async id=>{ErgoFlex.setMeasuredRoomLayout(id,'house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setMeasuredRoomMode(id,'afternoon',false);document.querySelector('#camera-view').value='room';document.querySelector('#camera-view').dispatchEvent(new Event('change'));},id);
            await page.evaluate(()=>ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera));
            await page.screenshot({path:path.join(out,`${id}.png`)});
            if (groupId) {
                // Returning to a group recalls its actual setting rather than its default.
                await page.select('#room-scene-select','product');
                await page.select('#room-scene-select',groupId);
                await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
                assert.equal(await page.evaluate(()=>ErgoFlex.workspaceRoom.id),id,'Group remembers selected setting');
                const savedSetting = await page.evaluate(()=>ErgoFlex.serializeProject());
                await page.select('#room-scene-select','product');
                await page.evaluate(async project=>{const result=ErgoFlex.applyProject(project);if(!result.ok)throw new Error(JSON.stringify(result));await ErgoFlex.workspaceRoom.ready;},savedSetting);
                assert.equal(await page.evaluate(()=>ErgoFlex.workspaceRoom.id),id,'Project restores actual grouped scene');
                assert.equal(await page.$eval('#room-scene-select',e=>e.value),groupId,'Project restores group picker');
                await page.setViewport({width:412,height:915});
                const fit=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,
                    selectors:Array.from(document.querySelectorAll('.measured-room-controls:not([hidden]) select:not([hidden])')).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));
                assert.ok(fit.width<=fit.viewport+2,'Grouped controls do not overflow mobile page');
                assert.ok(fit.selectors.every(e=>e.width>80&&e.left>=0&&e.right<=fit.viewport+2),'Grouped selectors fit mobile viewport');
                await page.setViewport({width:1500,height:1100});
            }
            console.log('PASS', id, `${quick?1:registry.tiers[id].length} layouts × ${quick?3:5} phases; bounds, sizes, interaction and Groove`);
        }
        // Subset runs exercise the same project round-trip from a known room.
        page = await freshPage();
        await page.evaluate(async()=>{if(ErgoFlex.workspaceRoom.id!=='mobileit'){ErgoFlex.setMeasuredRoomLayout('mobileit','house');await ErgoFlex.workspaceRoom.ready;ErgoFlex.setMeasuredRoomMode('mobileit','afternoon',false);}});
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());
        assert.equal(Object.keys(project.presentation.institutionalRooms).length,12);
        assert.equal(project.presentation.institutionalRooms.mobileit.layout,'house');
        assert.equal(project.presentation.institutionalRooms.mobileit.mode,'afternoon');
        await page.evaluate(async project => {
            ErgoFlex.setMeasuredRoomMode('mobileit','night',false);
            ErgoFlex.setMeasuredRoomLayout('mobileit','spacious'); await ErgoFlex.workspaceRoom.ready;
            const result = ErgoFlex.applyProject(project); if (!result.ok) throw new Error(JSON.stringify(result));
            await ErgoFlex.workspaceRoom.ready;
        }, project);
        assert.equal(await page.evaluate(()=>ErgoFlex.measuredRoom.layout.id),'house','Project restores selected room size');
        assert.equal(await page.evaluate(()=>ErgoFlex.measuredRoom.mode),'afternoon','Project restores selected activity');
        await page.reload();
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none');
        await page.evaluate(async()=>{ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.4);ErgoFlex.renderer.shadowMap.enabled=false;await ErgoFlex.workspaceRoom.ready;});
        // Explicit room query initially selects security; each environment's settings survive a reload.
        await page.select('#room-scene-select','mobileit'); await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.equal(await page.evaluate(()=>ErgoFlex.measuredRoom.layout.id),'house','Reload preserves the restored room size');
        assert.equal(await page.evaluate(()=>ErgoFlex.measuredRoom.mode),'afternoon','Reload preserves the restored activity');
        await page.setViewport({width:412,height:915});
        const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,picker:document.getElementById('room-scene-select').getBoundingClientRect().toJSON()}));
        assert.ok(mobile.width<=mobile.viewport+2,'No horizontal mobile overflow');
        assert.ok(mobile.picker.width>100); await page.screenshot({path:path.join(out,'mobile.png')});
        assert.deepEqual(errors,[]); fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(review,null,2));
        console.log(`PASS institutional environments: ${new Set(review.map(r=>r.id)).size} scenes, ${review.length} layouts, ${review.length*(quick?3:5)} lighting/Groove settings; project restore and mobile layout`);
    } finally { await browser?.close(); server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
