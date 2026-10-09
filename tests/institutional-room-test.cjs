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
        const registry = await page.evaluate(async () => { const m = await import('./institutional-scenes.mjs?v=institutional-sweep-20261009'); return { ids: m.INSTITUTIONAL_IDS, education: Object.keys(m.EDUCATIONAL_LEVELS), groups: m.INSTITUTIONAL_GROUPS, tiers: Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.keys(m.INSTITUTIONAL_ROOMS[id].layouts)])),
            stations: Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.fromEntries(Object.entries(m.INSTITUTIONAL_ROOMS[id].layouts).map(([tier, l]) => [tier, l.stations]))])),
            modules: Object.fromEntries(m.INSTITUTIONAL_IDS.map(id => [id, Object.keys(m.INSTITUTIONAL_MODULES).find(g => m.INSTITUTIONAL_MODULES[g] === m.institutionalModule(id))])) }; });
        const ids = registry.ids;
        // Every scene belongs to exactly one group builder module; every layout
        // declares a mixed-size set of extra ErgoFlex desks (main + >= 2).
        for (const id of ids) {
            assert.ok(registry.modules[id], `${id}: owned by a group module`);
            for (const [tier, stations] of Object.entries(registry.stations[id])) {
                assert.ok(stations.length >= 2, `${id}/${tier}: at least 3 ErgoFlex desks (main + ${stations.length})`);
                assert.ok(stations.some(s => s.size === '48x30') && stations.some(s => s.size === '60x30'), `${id}/${tier}: 48x30 and 60x30 stations`);
                assert.equal(new Set(stations.map(s => s.id)).size, stations.length, `${id}/${tier}: unique station ids`);
            }
        }
        // Educational stages grow from 3 to 7 ErgoFlex desks; from elementary up
        // each stage keeps an accessible desk at 28 in (wheelchair knee clearance).
        const eduDesks = registry.education.map(id => 1 + Object.values(registry.stations[id])[0].length);
        assert.ok(eduDesks[0] >= 3 && Math.max(...eduDesks) >= 7 && eduDesks.every((n, i) => !i || n >= eduDesks[0]), `educational desk progression ${eduDesks}`);
        for (const id of registry.education.slice(1)) assert.ok(Object.values(registry.stations[id])[0].some(s => /^accessible/.test(s.id) && s.height === 28), `${id}: accessible 28 in desk`);
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
                // Extra ErgoFlex desks: rendered at their own size, registered
                // as floor colliders and clear of other floor furniture.
                const specs = registry.stations[id][tier];
                await page.waitForFunction(n => ErgoFlex.roomInteractions.entries.filter(e => e.obj.userData.officeStation).length === n, {}, specs.length);
                const st = await page.evaluate(async () => {
                    const THREE = await import('three'), r = ErgoFlex.workspaceRoom;
                    r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert();
                    const plan = o => { const b = new THREE.Box3(); o.traverse(m => { if (m.isMesh && m.visible) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld))); } }); return [b.min.x, b.min.z, b.max.x, b.max.z]; };
                    // Desk width in the station's own (unrotated) frame, batched desk meshes only.
                    const own = o => { const b = new THREE.Box3(), gi = o.matrixWorld.clone().invert(); o.children.filter(c => c.isMesh).forEach(m => { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox.clone().applyMatrix4(gi.clone().multiply(m.matrixWorld))); }); return b.max.x - b.min.x; };
                    const stations = r.assets().filter(o => o.userData.officeStation);
                    return { main: { size: ErgoFlex.currentConfig.size, plan: plan(ErgoFlex.loadedModel) },
                        stations: stations.map(o => ({ key: o.userData.sceneAssetKey, size: o.userData.officeStation.size, width: own(o), plan: plan(o), collider: ErgoFlex.roomInteractions.entries.some(e => e.obj === o && e.collider && e.surface === 'floor') })),
                        floor: ErgoFlex.roomInteractions.entries.filter(e => e.surface === 'floor' && e.collider && !e.obj.userData.officeStation).map(e => ({ name: e.name, plan: plan(e.obj) })) };
                });
                assert.equal(1 + st.stations.length, 1 + specs.length); assert.ok(1 + st.stations.length >= 3, `${id}/${tier}: >= 3 ErgoFlex desks rendered`);
                const overlap = (a, b, gap = 20) => a[0] < b[2] - gap && b[0] < a[2] - gap && a[1] < b[3] - gap && b[1] < a[3] - gap;
                for (const spec of specs) {
                    const s = st.stations.find(s => s.key === `${id}:${tier}:station:${spec.id}`);
                    assert.ok(s, `${id}/${tier}: station ${spec.id} rendered with stable key`);
                    assert.equal(s.size, spec.size, `${id}/${tier}/${spec.id}: captured at requested size`);
                    const inches = s.width / 25.4, nominal = Number(spec.size.split('x')[0]);
                    assert.ok(Math.abs(inches - nominal) < 3, `${id}/${tier}/${spec.id}: desktop ${inches.toFixed(1)}in, expected ~${nominal}in`);
                    assert.ok(s.collider, `${id}/${tier}/${spec.id}: registered as floor collider`);
                    for (const f of st.floor) assert.ok(!overlap(s.plan, f.plan), `${id}/${tier}/${spec.id}: overlaps ${f.name} ${s.plan.map(Math.round)} / ${f.plan.map(Math.round)}`);
                    assert.ok(!overlap(s.plan, st.main.plan), `${id}/${tier}/${spec.id}: overlaps the main desk`);
                    for (const o of st.stations) if (o !== s) assert.ok(!overlap(s.plan, o.plan), `${id}/${tier}/${spec.id}: overlaps ${o.key}`);
                }
                const widths = Object.fromEntries(st.stations.map(s => [s.size, s.width]));
                assert.ok(widths['60x30'] - widths['48x30'] > 250, `${id}/${tier}: 60x30 station is ~12in wider than 48x30`);
                assert.equal(st.main.size, data.size, 'Station capture restores the main desk size');
                if (id === 'mobileit') {
                    // Depot invariants: the rack cold aisle and the door path stay clear of desks and floor furniture.
                    const aisle = data.assets.find(a => a.name === 'Cold aisle floor marking'); assert.ok(aisle, `${id}/${tier}: cold aisle marked`);
                    const L = data.layout, zones = { 'cold aisle': [aisle.min[0], aisle.min[2], aisle.max[0], aisle.max[2]], 'door path': [L.width / 2 - 1100, L.back + L.depth - 2200, L.width / 2, L.back + L.depth - 1000] };
                    assert.ok(zones['cold aisle'][3] - zones['cold aisle'][1] >= 1150, `${id}/${tier}: cold aisle ~1.2 m deep`);
                    for (const o of [...st.stations, ...st.floor]) for (const [zone, r] of Object.entries(zones)) assert.ok(!overlap(o.plan, r), `${id}/${tier}: ${o.key || o.name} blocks the ${zone} ${o.plan.map(Math.round)} / ${r.map(Math.round)}`);
                    assert.equal(data.assets.filter(a => a.name === 'IT equipment rack').length, 2 + ['apartment', 'house', 'spacious'].indexOf(tier), `${id}/${tier}: bayed rack row`);
                }
                if (id === 'hospital' || id === 'laboratory') {
                    // Healthcare invariants: one bed (with its own services headwall) or
                    // island bench per size step; lab safety equipment; door path clear.
                    const n = 1 + ['apartment', 'house', 'spacious'].indexOf(tier), count = name => data.assets.filter(a => a.name === name).length, L = data.layout;
                    if (id === 'hospital') { assert.equal(count('Hospital care bed'), n, `${id}/${tier}: care beds`); assert.equal(count('Wall bed headwall services'), n, `${id}/${tier}: a headwall per bed`); }
                    else { assert.equal(count('Laboratory bench'), n, `${id}/${tier}: island benches`); for (const name of ['Laboratory extraction hood', 'Laboratory wash, eyewash and safety shower', 'Flammables safety cabinet', 'Wall PPE station']) assert.equal(count(name), 1, `${id}/${tier}: ${name}`); }
                    const door = [L.width / 2 - 1100, L.back + L.depth - 2200, L.width / 2, L.back + L.depth - 1000];
                    for (const o of [...st.stations, ...st.floor]) assert.ok(!overlap(o.plan, door), `${id}/${tier}: ${o.key || o.name} blocks the door path ${o.plan.map(Math.round)}`);
                }
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
