const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://local').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
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
        await p.goto(`http://127.0.0.1:${server.address().port}/?room=library&layout=humboldt&view=room&tour=0`, { timeout: 180000 });
        await p.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 240000 });
        const data = await p.evaluate(async () => {
            const e = ErgoFlex; e.renderer.setAnimationLoop(null); e.renderer.setPixelRatio(.3);
            if (e.measuredRoom.layout.id !== 'humboldt') e.setMeasuredRoomLayout('library', 'humboldt');
            await e.workspaceRoom.ready;
            const r = e.workspaceRoom, s = r.root.scale.x, frames = r.root.children.find(o => o.name === 'Ceiling light frames');
            const castingFixtures = []; frames.traverse(o => { if (o.isMesh && (o.castShadow || o.receiveShadow)) castingFixtures.push(o.name); });
            const shell = r.walls.map(w => { let n = 0; w.obj.traverse(o => { if (o.isMesh && (o.castShadow || o.receiveShadow)) n++; }); return n; });
            const phases = {};
            for (const phase of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                e.setMeasuredRoomMode('library', phase, false);
                await e.prepareGrooveMode('library', phase);
                phases[phase] = { atmosphere: r.root.userData.atmosphere, label: e.measuredRoom.modes[phase].label, groove: e.grooveState.status, circuitB: r.root.userData.humboldtCircuits.B };
            }
            e.setMeasuredRoomLayout('library', 'humboldt'); await e.workspaceRoom.ready;
            const deskLocal = { x: -e.glidePosition.z / s, z: e.glidePosition.x / s };
            return { layout: e.measuredRoom.layout.id, layouts: Object.keys(e.measuredRoom.layouts), dims: r.root.userData.dimensionsMm, missing: r.missingProps,
                lights: r.root.children.filter(o => o.isPointLight).map(l => l.castShadow), info: r.root.userData.humboldtCommons, castingFixtures, shell,
                walls: r.walls.map(w => w.axis), deskLocal, deskYaw: e.deskYaw, phases, text: r.root.getObjectByName('Library commons identity') ? 'sign' : null };
        });
        assert.equal(data.layout, 'humboldt');
        assert.deepEqual(data.layouts, ['apartment', 'house', 'spacious', 'premium', 'executive', 'humboldt'], 'Commons joins the end of the Library lineup');
        assert.deepEqual(data.dims, { width: 18000, depth: 21000, height: 7200 });
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
        assert.equal(data.phases.party.label, 'Commons event');
        assert.deepEqual(errors, []);
        console.log('PASS Humboldt commons: sixth Library layout, red-dot wall desk facing the wall, five lights, non-casting fixtures and shell, five dayparts with clear Groove poses.');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
