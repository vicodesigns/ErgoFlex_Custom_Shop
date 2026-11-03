const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://local').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
        if (err) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream'); res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1100, height: 750 });
        await page.evaluateOnNewDocument(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => .25 }));
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=library&layout=humboldt&view=room&tour=0`, { timeout: 180000 });
        await page.waitForFunction(() => window.ErgoFlex?.sceneDesks?.active && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 240000 });
        await page.evaluate(async () => { await ErgoFlex.workspaceRoom.ready; await ErgoFlex.sceneDesks.objects.ready; ErgoFlex.renderer.setPixelRatio(.2); ErgoFlex.renderer.shadowMap.enabled = false; ErgoFlex.renderer.setAnimationLoop(null); });
        for (const size of ['48x30', '60x30']) {
            const result = await page.evaluate(async size => {
                const e = ErgoFlex, T = await import('three'), G = await import('./room-groove.mjs'), S = await import('./room-groove-runtime.mjs');
                e.sceneDesks.setSize(size); await e.sceneDesks.objects.ready;
                const room = e.workspaceRoom, l = room.roomLayout, phases = ['morning', 'afternoon', 'evening', 'night', 'party'];
                const checks = [], fail = [], check = (v, msg) => { if (!v) fail.push(msg); };
                check(room.missingProps.length === 0, 'Missing props: ' + room.missingProps.join(','));
                check(Object.keys(e.sceneDesks.active.state.artwork.surfaces).length === 3, 'Humboldt decals lost');
                const boards = new Set(), activity = new Set(), lightLevels = new Set();
                for (const phase of phases) {
                    await e.prepareGrooveMode('library', phase);
                    const data = e.grooveRouting, state = e.grooveState;
                    const exact = G.planGroove({ ...data, exact: true });
                    check(exact.ok, phase + ' exact route: ' + exact.reason);
                    if (exact.ok) check(exact.route.slice(1).every((b, i) => G.segmentIsClear(exact.route[i], b, data.bounds, data.obstacles, data.footprint)), phase + ' swept route blocked');
                    const desired = G.grooveDestination('library', l, phase);
                    // Check return paths under each day's furniture staging too.
                    for (const from of phases) {
                        const start = G.grooveDestination('library', l, from);
                        const route = G.planGroove({ ...data, start, desired, exact: true });
                        check(route.ok, from + ' → ' + phase + ': ' + route.reason);
                    }
                    const table = room.assets().find(o => o.userData.humboldtTable === l.groupStudy.table);
                    const tableKit = table.children.find(o => o.userData.propId === 'humboldt-study-kit-6');
                    const active = tableKit.children.filter(o => o.visible && o.name.startsWith('Commons table activity'));
                    check(active.length === 1 && active[0].name.endsWith(phase), phase + ' mixed group table contents');
                    activity.add(active[0].children[0].geometry.attributes.position.count);
                    const board = room.assets().find(o => o.userData.propId === 'humboldt-pilot-notice');
                    boards.add(board.children.find(o => o.geometry?.type === 'PlaneGeometry').material.map.image.toDataURL());
                    lightLevels.add(room.root.children.filter(o => o.isPointLight).map(o => o.intensity.toFixed(3)).join(','));
                    const wheelchair = room.assets().find(o => o.userData.propId === 'electric-wheelchair');
                    const group = l.groupStudy.phases.includes(phase);
                    check(wheelchair.position.distanceTo(new T.Vector3(...(group ? [7600, 0, 2950] : [8500, 0, -5500]))) < 1, phase + ' mobility seat not in its bay');
                    if (group) {
                        check(l.modes[phase].tilt === 0 && Math.abs(l.modes[phase].height * 25.4 - 750) < 1, 'Work surface not level with peers');
                        const edge = table.position.x + l.tables[6].size[0] / 2;
                        const gap = desired.x - data.footprint.halfWidth + data.footprint.offsetX - edge;
                        check(gap > 20 && gap < 400, 'Desk does not join the shared table: ' + gap);
                        const bay = l.groupStudy.turningBay, radius = bay.diameter / 2;
                        const blocked = data.obstacles.filter(o => {
                            const dx = Math.max(o.minX - bay.x, 0, bay.x - o.maxX), dz = Math.max(o.minZ - bay.z, 0, bay.z - o.maxZ);
                            return dx * dx + dz * dz < radius * radius;
                        });
                        const userRoute = G.planGroove({ start: { x: bay.x, z: bay.z, yaw: 0 }, desired: { x: 7600, z: 2950, yaw: 0 }, bounds: data.bounds, obstacles: data.obstacles.filter(o => o.id !== wheelchair.uuid), footprint: { halfWidth: 360, halfDepth: 550, margin: 25 }, exact: true });
                        check(userRoute.ok, 'Mobility-seat approach blocked: ' + userRoute.reason);
                        check(!blocked.length, 'Turning bay obstructed: ' + JSON.stringify(blocked));
                    }
                    checks.push({ phase, exact: exact.ok, route: exact.route?.length, group, activeVertices: active[0].children[0].geometry.attributes.position.count, desired, adjusted: state.plan?.adjusted });
                }
                check(boards.size === 5 && lightLevels.size === 5 && activity.size === 5, 'Daily settings insufficiently distinct');
                // Daily transforms must be reversible, even after repeated mode cycles.
                const chair = room.assets().find(o => o.userData.propId === 'steelcase-leap-v2');
                e.setLibraryMode('morning', false); const base = chair.position.clone();
                for (let i = 0; i < 3; i++) { e.setLibraryMode('party', false); e.setLibraryMode('morning', false); }
                check(base.distanceTo(chair.position) < .001, 'Chair staging drifts');
                return { size, checks, fail };
            }, size);
            console.log(JSON.stringify(result)); assert.deepEqual(result.fail, []);
        }
        assert.deepEqual(errors, []);
        console.log('PASS: both widths, all five daily dressings and light states, exact routes between every activity, level group surfaces, decals, mobility seat, turning bay and reversible chair staging.');
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
