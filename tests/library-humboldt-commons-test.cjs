const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://local').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
        // Test-only diagnostics for motion after repeated layout/width changes.
        // The application module on disk is not modified by this instrumentation.
        if (file.endsWith('/studio.js')) data = Buffer.from(data.toString().replace('function animate(time, frame) {', 'function animate(time, frame) { window.__commonsFrames=(window.__commonsFrames||0)+1;') + '\nwindow.__commonsMotionProbe=()=>({paused:motionPaused,frames:window.__commonsFrames,clock:clock.elapsedTime,run:roomGroove?.run,sceneNodes:scene.children.length});');
        res.end(data);
    });
});
// Humboldt-inspired commons: the sixth Library layout. Checks the shell, the
// wall-facing desk at the owner's marked spot, the five-light budget, the
// non-casting fixtures, every daypart and a clear Groove pose for each.
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const p = await browser.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.setViewport({ width: 1000, height: 700 });
        await p.evaluateOnNewDocument(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => .35 }));
        await p.goto(`http://127.0.0.1:${server.address().port}/?room=library&layout=humboldt&view=room&tour=0`, { timeout: 180000 });
        await p.waitForFunction(() => window.ErgoFlex?.renderer, { timeout: 180000 });
        await p.evaluate(() => { ErgoFlex.renderer.render = () => {}; });
        await p.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 240000 });
        const data = await p.evaluate(async () => {
            const e = ErgoFlex; e.renderer.setPixelRatio(.2); e.renderer.shadowMap.enabled = false; e.renderPacing.fps = 60;
            // Geometry/routes and live motion are checked here; the visual review
            // renders the actual materials separately. Keep simulation running.
            e.renderer.render = () => {};
            if (e.measuredRoom.layout.id !== 'humboldt') e.setMeasuredRoomLayout('library', 'humboldt');
            await e.workspaceRoom.ready;
            let r = e.workspaceRoom; const s = r.root.scale.x, frames = r.root.children.find(o => o.name === 'Ceiling light frames');
            const castingFixtures = []; frames.traverse(o => { if (o.isMesh && (o.castShadow || o.receiveShadow)) castingFixtures.push(o.name); });
            const shell = r.walls.map(w => { let n = 0; w.obj.traverse(o => { if (o.isMesh && (o.castShadow || o.receiveShadow)) n++; }); return n; });
            const phases = {}, widthChecks = [];
            const { segmentIsClear, planGroove, grooveDestination } = await import('./room-groove.mjs');
            for (const size of ['48x30', '60x30']) {
                e.sceneDesks.setSize(size); await e.sceneDesks.objects.ready; await e.workspaceRoom.ready;
                const maps = [], poses = [];
                for (const phase of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                    await e.prepareGrooveMode('library', phase);
                    const state = e.grooveState, data = e.grooveRouting, room = e.workspaceRoom;
                    if (!state.plan?.ok) throw Error(size + '/' + phase + ': ' + state.message);
                    if (!state.plan.route.slice(1).every((b, i) => segmentIsClear(state.plan.route[i], b, data.bounds, data.obstacles, data.footprint))) throw Error('Swept route is blocked');
                    const board = room.assets().find(o => o.userData.propId === 'humboldt-pilot-notice');
                    maps.push(board.children.find(o => o.geometry?.type === 'PlaneGeometry' && o.material?.map).material.map.image.toDataURL());
                    for (const kit of room.assets().filter(o => o.userData.propId?.startsWith('humboldt-study-kit-'))) {
                        const active = kit.children.filter(o => o.name.startsWith('Commons table activity ·') && o.visible);
                        if (active.length !== 1 || active[0].name !== 'Commons table activity · ' + phase) throw Error('Mixed daily study materials');
                    }
                    if (room.root.userData.dailyStory !== e.measuredRoom.layout.stories[['morning', 'afternoon', 'evening', 'night', 'party'].indexOf(phase)]) throw Error('Generic story in bespoke commons');
                    const desired = grooveDestination('library', room.roomLayout, phase);
                    poses.push(desired);
                    // Every time-of-day pose must be reachable from every other
                    // authored pose as well as the startup bay, on both widths.
                    for (const from of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                        const start = grooveDestination('library', room.roomLayout, from);
                        const plan = planGroove({ ...data, start, desired, exact: true });
                        if (!plan.ok) throw Error(size + ': ' + from + ' → ' + phase + ' blocked: ' + plan.reason + JSON.stringify({start,desired,footprint:data.footprint,obstacles:data.obstacles.filter(o=>Math.abs((o.minX+o.maxX)/2-start.x)<2000&&Math.abs((o.minZ+o.maxZ)/2-start.z)<2200)}));
                    }
                }
                widthChecks.push({size, boards: new Set(maps).size, poses: new Set(poses.map(p => JSON.stringify(p))).size});
            }
            e.setMeasuredRoomLayout('library', 'humboldt'); await e.workspaceRoom.ready; r = e.workspaceRoom;
            for (const phase of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                e.setMeasuredRoomMode('library', phase, false);
                await e.prepareGrooveMode('library', phase);
                phases[phase] = { atmosphere: r.root.userData.atmosphere, label: e.measuredRoom.modes[phase].label, groove: e.grooveState.status, circuitB: r.root.userData.humboldtCircuits.B };
            }
            e.setMeasuredRoomLayout('library', 'humboldt'); await e.workspaceRoom.ready;
            const deskLocal = { x: -e.glidePosition.z / s, z: e.glidePosition.x / s };
            return { layout: e.measuredRoom.layout.id, layouts: Object.keys(e.measuredRoom.layouts), dims: r.root.userData.dimensionsMm, missing: r.missingProps,
                lights: r.root.children.filter(o => o.isPointLight).map(l => l.castShadow), info: r.root.userData.humboldtCommons, castingFixtures, shell,
                walls: r.walls.map(w => w.axis), deskLocal, deskYaw: e.deskYaw, phases, widthChecks, pilot: e.workspaceRoom.assets().filter(o => o.userData.propId?.startsWith('humboldt-pilot-')).map(o => o.userData.propId), text: r.root.getObjectByName('Library commons identity') ? 'sign' : null };
        });
        assert.equal(data.layout, 'humboldt');
        assert.deepEqual(data.layouts, ['apartment', 'house', 'spacious', 'premium', 'executive', 'humboldt'], 'Commons joins the end of the Library lineup');
        assert.deepEqual(data.dims, { width: 13400, depth: 35000, height: 7200 }, 'Narrow, long commons and figure hall');
        assert.deepEqual(data.missing, [], 'Every commons prop loads');
        assert.equal(data.lights.length, 5, 'Five-light room budget'); assert.ok(data.lights.every(c => !c), 'No point-light shadows');
        assert.deepEqual(data.castingFixtures, [], 'Suspended frames stay out of the VSM shadow pass');
        assert.ok(data.shell.every(n => n === 0), 'Shell walls and soffits stay out of the shadow pass');
        assert.deepEqual(data.walls, ['x', 'z', 'z', 'x', 'y'], 'Back, right, left, front cutaways plus the soffit band');
        assert.equal(data.text, null, 'No Library name sign in the commons');
        // The desk stands at the marked spot, long side along the right wall, user facing the wall.
        assert.ok(Math.abs(data.deskLocal.x - 8240) < 120 && Math.abs(data.deskLocal.z + 1850) < 120, `Desk at the red-dot bay: ${JSON.stringify(data.deskLocal)}`);
        assert.ok(Math.abs(data.deskYaw + Math.PI / 2) < 1e-6, `Desk faces the wall: ${data.deskYaw}`);
        for (const [phase, v] of Object.entries(data.phases)) {
            assert.equal(v.atmosphere, phase); assert.equal(v.groove, 'ready', `${phase} Groove has a clear pose`);
            assert.equal(v.circuitB, phase !== 'night', `${phase}: second frame circuit`);
        }
        assert.equal(data.phases.party.label, 'Project / together');
        // Research and project work deliberately share the inclusive table bay.
        assert.deepEqual(data.widthChecks, [{size:'48x30',boards:5,poses:4},{size:'60x30',boards:5,poses:4}]);
        assert.deepEqual(data.pilot.sort(), ['humboldt-pilot-bay','humboldt-pilot-header','humboldt-pilot-notice']);
        console.log('PASS both widths: 10 daily setups, 50 ordered pose-to-pose routes, 5 distinct bulletin boards, 7 synchronized study kits.');
        await p.evaluate(async () => { await ErgoFlex.prepareGrooveMode('library','night'); if(!ErgoFlex.startGroove()) throw Error('Closing Groove did not start'); });
        try {
            // Motion deliberately clamps large time steps. Software rendering
            // and GC after many room rebuilds need a longer wall-clock budget.
            await p.waitForFunction(() => ErgoFlex.grooveState.status === 'idle', {timeout:180000});
        } catch (error) {
            console.error('Page errors', errors); console.error('Closing motion diagnostic', await p.evaluate(() => ({debug:window.__commonsMotionProbe(),state:ErgoFlex.grooveState,collision:ErgoFlex.collisionState,height:ErgoFlex.heightInches,tilt:ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg})));
            throw error;
        }
        const closing = await p.evaluate(() => ({tilt:ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg, height:ErgoFlex.heightInches, message:ErgoFlex.grooveState.message}));
        assert.ok(Math.abs(closing.tilt-65)<.1, JSON.stringify(closing));
        console.log('PASS real motion: closing routine levels, drives, and folds to 65° Storage Mode.');
        await p.evaluate(() => ErgoFlex.renderer.setAnimationLoop(null));
        assert.deepEqual(errors, []);
        console.log('PASS Humboldt commons: sixth Library layout, red-dot wall desk facing the wall, five lights, non-casting fixtures and shell, five dayparts with clear Groove poses.');
    } finally {
        // Software WebGL can leave Chromium waiting on a discarded context.
        // Bound cleanup to this disposable browser process only.
        const watchdog = setTimeout(() => browser.process()?.kill('SIGKILL'), 10000);
        try { await browser.close(); } finally { clearTimeout(watchdog); server.closeAllConnections(); server.close(); }
    }
})().catch(error => { console.error(error); process.exit(1); });
