// Gym colourway in the full studio: the toggle, desk finish, LED colour,
// persistence across reloads, layout/mode changes and project round trips.
// Uses its own browser profile, so no saved user designs are read or changed.
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
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [], base = `http://127.0.0.1:${server.address().port}/`;
        page.setDefaultNavigationTimeout(180000);
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1200, height: 900 });
        const boot = async query => {
            await page.goto(base + query, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.ErgoFlex?.renderer && ErgoFlex.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 180000 });
            await page.evaluate(async () => { ErgoFlex.renderer.setPixelRatio(.35); ErgoFlex.renderer.shadowMap.enabled = false; await ErgoFlex.workspaceRoom.ready; });
        };
        const state = () => page.evaluate(() => {
            const c = ErgoFlex.currentConfig, room = ErgoFlex.workspaceRoom;
            return { theme: ErgoFlex.gymTheme, stored: localStorage.getItem('ergoflex.gymTheme'), desk: [c.woodFinish, c.baseFinish, c.trimColor], led: ErgoFlex.ledColor,
                layout: room.roomLayout?.id, layoutTheme: room.roomLayout?.theme || 'green', polish: room.root.userData.polish?.finish, mode: ErgoFlex.gymMode,
                pressed: [...document.querySelectorAll('[data-gym-theme]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.gymTheme) };
        });
        const GREEN = ['Modern Grey', 'Black', '#286344'], RED = ['Black Birch', 'Black', '#dc0909'];
        // Studio-level look outside the room fingerprint: exposure and the desk screen.
        const look = () => page.evaluate(() => { const c = ErgoFlex.sceneScreens?.ctx.context(); return { exposure: ErgoFlex.renderer.toneMappingExposure, accent: c?.accent ?? null, mono: c?.mono ?? null, layout: ErgoFlex.workspaceRoom.roomLayout?.id, mode: ErgoFlex.gymMode }; });

        await boot('?room=gym&view=room');
        const look0 = await look();
        let s = await state();
        assert.equal(s.theme, 'green'); assert.equal(s.stored, null); assert.deepEqual(s.desk, GREEN); assert.equal(s.layoutTheme, 'green');
        assert.equal(s.polish, 'Rubber & brushed steel'); assert.deepEqual(s.pressed, ['green'], 'Toggle shows green');
        assert.equal(await page.$$eval('#gym-room-controls [data-gym-theme]', b => b.length), 2, 'Toggle lives in the gym panel');
        // Power circuit in green, saved with the scene desk: its LED colour is the authored lime.
        await page.evaluate(async () => { ErgoFlex.setGymMode('party'); ErgoFlex.sceneDesks.persist(); });
        assert.equal((await state()).led, '#b6f348');
        await page.evaluate(async () => { ErgoFlex.setGymLayout('house'); await ErgoFlex.workspaceRoom.ready; });

        // The toggle: desk, LEDs, room finish and button state follow; the layout and mode stay.
        await page.click('[data-gym-theme="blackred"]'); await page.evaluate(async () => ErgoFlex.workspaceRoom.ready);
        s = await state();
        assert.equal(s.theme, 'blackred'); assert.equal(s.stored, 'blackred'); assert.deepEqual(s.desk, RED); assert.equal(s.led, '#ff0a1e');
        assert.equal(s.layout, 'house'); assert.equal(s.mode, 'party'); assert.equal(s.layoutTheme, 'blackred');
        assert.equal(s.polish, 'Matte black & signal red'); assert.deepEqual(s.pressed, ['blackred']);
        // The apartment's saved scene desk still holds the lime LED: it is remapped on the way back.
        await page.evaluate(async () => { ErgoFlex.setGymLayout('apartment'); await ErgoFlex.workspaceRoom.ready; });
        s = await state();
        assert.equal(s.layout, 'apartment'); assert.equal(s.layoutTheme, 'blackred'); assert.deepEqual(s.desk, RED); assert.equal(s.led, '#ff0a1e', 'Saved lime LED remapped');
        await page.evaluate(() => ErgoFlex.setGymMode('night'));
        assert.equal((await state()).led, '#c4101e'); assert.equal((await state()).theme, 'blackred');
        const screen = await page.evaluate(() => ErgoFlex.sceneScreens?.ctx.context().accent);
        assert.equal(screen, '#ff3b3b', 'Desk screen accent follows the colourway');

        // A visitor's own desk finish survives both directions; "Use scene palette" restores the themed desk.
        await page.evaluate(() => document.querySelector('#wood-finishes [data-finish="Walnut"]').click());
        await page.evaluate(async () => { ErgoFlex.setGymTheme('green'); await ErgoFlex.workspaceRoom.ready; });
        s = await state(); assert.equal(s.desk[0], 'Walnut', 'Custom finish kept'); assert.equal(s.layoutTheme, 'green'); assert.equal(s.led, '#aaa487');
        await page.evaluate(async () => { ErgoFlex.setGymTheme('blackred'); await ErgoFlex.workspaceRoom.ready; });
        assert.equal((await state()).desk[0], 'Walnut');
        await page.evaluate(async () => { ErgoFlex.resetSceneDeskStyle(); await ErgoFlex.workspaceRoom.ready; });
        assert.deepEqual((await state()).desk, RED, 'Scene palette is the black & red desk');

        // Projects: the field round-trips; a project saved before the toggle reopens green.
        const project = await page.evaluate(() => ErgoFlex.serializeProject());
        assert.equal(project.presentation.gymTheme, 'blackred');
        const restore = async p => page.evaluate(async p => { ErgoFlex.setRoomScene('product', false); const r = ErgoFlex.applyProject(p); await ErgoFlex.workspaceRoom.ready; return r.ok; }, p);
        await page.evaluate(async () => { ErgoFlex.setGymTheme('green'); await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await restore(project), true);
        s = await state(); assert.equal(s.theme, 'blackred'); assert.equal(s.layoutTheme, 'blackred'); assert.deepEqual(s.desk, RED);
        const legacy = JSON.parse(JSON.stringify(project)); delete legacy.presentation.gymTheme;
        assert.equal(await restore(legacy), true);
        s = await state(); assert.equal(s.theme, 'green', 'Old project opens green'); assert.equal(s.layoutTheme, 'green'); assert.equal(s.polish, 'Rubber & brushed steel');
        // The project's own desk (here the catalog Gaming finish) is authoritative: green never swaps it on load.
        assert.deepEqual(s.desk, RED, 'Old project keeps its own black & red desk in green');
        // The same project from before scene desks existed: no saved desk record re-applies the finish,
        // so this exercises the room's own desk styling on load.
        const bare = JSON.parse(JSON.stringify(legacy)); bare.presentation.sceneDesks = {};
        assert.equal(await restore(bare), true);
        s = await state(); assert.equal(s.theme, 'green'); assert.deepEqual(s.desk, RED, 'Project without scene desks keeps its desk in green');
        // Green after black & red: the studio-level look is the fresh green one.
        await page.evaluate(async l => { ErgoFlex.setGymLayout(l.layout); await ErgoFlex.workspaceRoom.ready; ErgoFlex.setGymMode(l.mode); }, look0);
        assert.deepEqual(await look(), look0, 'Green look after the toggle back');

        // A green visitor's own Gaming desk survives a reload, and a shared Gaming build opens as shared.
        await page.evaluate(async () => { ErgoFlex.resetSceneDeskStyle(); await ErgoFlex.workspaceRoom.ready; });
        assert.deepEqual((await state()).desk, GREEN, 'Scene palette before the visitor picks a finish');
        await page.evaluate(() => { for (const q of ['#wood-finishes [data-finish="Black Birch"]', '#base-finishes [data-finish="Black"]', '[data-trim-color="#dc0909"]']) document.querySelector(q).click(); ErgoFlex.sceneDesks?.persist(); });
        assert.deepEqual((await state()).desk, RED);
        await boot('?room=gym');
        s = await state(); assert.equal(s.theme, 'green'); assert.deepEqual(s.desk, RED, 'Own Gaming desk kept after reload in green');
        const shared = await page.evaluate(() => ({ ...ErgoFlex.currentConfig, woodFinish: 'Black Birch', baseFinish: 'Black', trimColor: '#dc0909' }));
        await page.evaluate(() => localStorage.clear());
        await boot('?room=gym&build=' + encodeURIComponent(JSON.stringify(shared)));
        s = await state(); assert.equal(s.theme, 'green'); assert.deepEqual(s.desk, RED, 'Shared Gaming build opens with its desk in green');

        // Reloads: localStorage persists the choice; ?gymTheme= overrides it for the visit only.
        await page.evaluate(async () => { ErgoFlex.setGymTheme('blackred'); await ErgoFlex.workspaceRoom.ready; });
        await boot('?room=gym');
        s = await state(); assert.equal(s.theme, 'blackred'); assert.equal(s.layoutTheme, 'blackred'); assert.deepEqual(s.pressed, ['blackred']);
        await page.evaluate(async () => { ErgoFlex.setGymTheme('green'); await ErgoFlex.workspaceRoom.ready; });
        await boot('?room=gym&gymTheme=blackred');
        s = await state(); assert.equal(s.theme, 'blackred'); assert.equal(s.stored, 'green'); assert.equal(s.layoutTheme, 'blackred');
        await page.evaluate(() => localStorage.setItem('ergoflex.gymTheme', '__proto__'));
        await boot('?room=gym&gymTheme=teal');
        s = await state(); assert.equal(s.theme, 'green', 'Unknown ids fall back to green'); assert.equal(s.layoutTheme, 'green');
        // Other rooms ignore the colourway.
        await page.evaluate(async () => { ErgoFlex.setGymTheme('blackred'); ErgoFlex.setRoomScene('office', false); await ErgoFlex.workspaceRoom.ready; });
        assert.equal(await page.evaluate(() => ErgoFlex.currentConfig.woodFinish), 'Modern Grey', 'Office keeps its own desk');
        assert.equal(await page.evaluate(() => ErgoFlex.workspaceRoom.root.userData.polish?.finish), 'Teal & bronze');
        assert.deepEqual(errors, []);
        console.log('PASS: gym colourway toggle, desk and LED follow, custom finish kept, layout/mode switches, project round trip, legacy green, reload and URL override.');
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
