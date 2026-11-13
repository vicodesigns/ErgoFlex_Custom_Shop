// Window scenery in the real rooms (a browser): every room with modelled scenery is built in scenery mode, and
//   - each wall with windows has its world ('Window scenery land' per facing) and its panes carry the sky,
//   - every shader the renderer compiled for it compiled (renderer.info.programs, no failed diagnostics),
//   - a room whose party hour is daytime (the child's room, the bedroom) has daylight outside at its party,
//   - after dark the window is not the bright thing: its mean luminance against the whole frame's, from a camera at
//     eye level facing the biggest pane, stays under a bound (printed per room),
//   - the photograph path still builds without any scenery (window view 'photo').
//
//   node tools/studio-server.mjs --port 3123 --host 127.0.0.1 --no-watch --state /tmp/some-state.json   (this checkout)
//   flock /tmp/claude-1000/hq12-stills.lock node tests/window-scenery-rooms-test.cjs [--port 3123] [room:layout ...]
const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const args = process.argv.slice(2), at = args.indexOf('--port'), port = at >= 0 ? args.splice(at, 2)[1] : 3123;
const ROOMS = args.length ? args : ['home:house', 'creative:premium', 'library:humboldt', 'occmedialab:house', 'highschool:house', 'gym:house', 'gaming:house', 'music:house', 'workshop:house',
    'bedroom:house', 'kitchen:house', 'childroom:house', 'office:house', 'coworking:house', 'gallery:house', 'lounge:house', 'lounge:housecontemporary', 'library:house', 'study:house',
    'college:house', 'university:house', 'kindergarten:apartment', 'elementary:house', 'middleschool:house', 'hospital:house', 'laboratory:house', 'mobileit:house', 'government:house', 'police:house', 'security:house'];
const DAYTIME_PARTY = new Set(['childroom', 'bedroom']);
const NIGHT_BOUND = 1.6;   // window mean / frame mean after dark (a dim room with a lit street beyond it would be 2-4)

// in the page: the scenery's state, the compiled programs, and the window's luminance against the frame's
const PROBE = async () => {
    const T = window.__T, E = window.ErgoFlex, R = E.renderer, room = E.workspaceRoom, l = room.roomLayout, cam = E.sceneDesks.ctx.camera, o = E.sceneDesks.ctx.controls;
    let scene = E.loadedModel; while (scene.parent) scene = scene.parent;
    room.root.updateWorldMatrix(true, true);
    const panes = [], lands = [], vistas = [];
    room.root.traverse(m => { if (!m.isMesh) return; if (typeof m.userData.windowScenery === 'string') panes.push(m); if (m.userData.windowScenery === true && m.name === 'Window scenery land') lands.push(m); if (typeof m.userData.windowVista === 'string') vistas.push(m); });
    const facings = new Set(panes.map(p => { const q = new T.Quaternion(); p.getWorldQuaternion(q); const v = new T.Vector3(0, 0, -1).applyQuaternion(q); return v.toArray().map(x => Math.round(x * 10)).join(','); }));
    const lamp = lands[0]?.material.uniforms.lamp.value ?? null;
    let ratio = null;
    if (panes.length) {
        const area = m => { m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new T.Vector3()); const w = new T.Vector3(); m.getWorldScale(w); return s.x * w.x * s.y * w.y; };
        panes.sort((a, b) => area(b) - area(a));
        const M = room.root.matrixWorld, inv = M.clone().invert(), pane = panes[0], q = new T.Quaternion(); pane.getWorldQuaternion(q);
        const c = pane.getWorldPosition(new T.Vector3()).applyMatrix4(inv), n = new T.Vector3(0, 0, 1).applyQuaternion(q).transformDirection(inv); n.y = 0; n.normalize();
        const d = Math.min(4000, (Math.abs(n.x) > .7 ? l.width : l.depth) * .62), eye = c.clone().addScaledVector(n, d); eye.y = 1600; const look = c.clone(); look.y = Math.max(1300, Math.min(c.y, 1700));
        cam.position.copy(eye.applyMatrix4(M)); o.target.copy(look.applyMatrix4(M)); cam.fov = 55; cam.updateProjectionMatrix(); o.update();
        for (const p of [pane]) for (let a = p; a; a = a.parent) a.visible = true;   // (the cutaway may have taken the wall)
        await EnvironmentReview.settleView();
        const W = 320, H = 180, rt = new T.WebGLRenderTarget(W, H), px = new Uint8Array(W * H * 4), aspect = cam.aspect; cam.aspect = W / H; cam.updateProjectionMatrix();
        R.setRenderTarget(rt); R.render(scene, cam); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null); rt.dispose(); cam.aspect = aspect; cam.updateProjectionMatrix();
        // the pane's rectangle on screen
        pane.geometry.computeBoundingBox(); const b = pane.geometry.boundingBox, corners = [];
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) corners.push(new T.Vector3(x, y, 0).applyMatrix4(pane.matrixWorld).project(cam));
        const x0 = Math.max(-1, Math.min(...corners.map(p => p.x))), x1 = Math.min(1, Math.max(...corners.map(p => p.x))), y0 = Math.max(-1, Math.min(...corners.map(p => p.y))), y1 = Math.min(1, Math.max(...corners.map(p => p.y)));
        let all = 0, inside = 0, nIn = 0;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4, L = .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; all += L;
            const sx = i / W * 2 - 1, sy = j / H * 2 - 1; if (sx > x0 && sx < x1 && sy > y0 && sy < y1) { inside += L; nIn++; } }
        ratio = nIn > 50 ? +((inside / nIn) / (all / (W * H))).toFixed(2) : null;
    }
    const failed = (R.info.programs || []).filter(p => p.diagnostics && !p.diagnostics.runnable).map(p => p.name);
    return { panes: panes.length, facings: facings.size, lands: lands.length, vistas: vistas.length, lamp, ratio, failed };
};

(async () => {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', defaultViewport: { width: 960, height: 540 },
        args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && /shader|program|GLSL|scenery/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => localStorage.setItem('ergoflex.windowView', 'scenery'));
    await page.evaluate(() => { document.documentElement.innerHTML = '<body style="margin:0;background:#000"><iframe id="s" style="width:960px;height:540px;border:0" src="/?room=home&view=room&layout=house&presentation=1&tour=1"></iframe></body>'; });
    const frame = await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction('window.ErgoPresentation&&window.ErgoFlex', { timeout: 180000 });
    await frame.addScriptTag({ type: 'module', url: '/tools/environment-review-session.mjs' });
    await frame.waitForFunction('window.EnvironmentReview', { timeout: 60000 });
    await frame.addScriptTag({ type: 'module', content: "import * as THREE from 'three';window.__T=THREE;" });
    await frame.waitForFunction('window.__T', { timeout: 60000 });
    const load = (room, layout, phase) => frame.evaluate(async (room, layout, phase) => { await EnvironmentReview.load(room, phase, '60x30', layout); await new Promise(r => setTimeout(r, 1500)); }, room, layout, phase);
    const probe = () => frame.evaluate(`(${PROBE})()`);
    const rows = [], fail = [];
    for (const spec of ROOMS) {
        const [room, layout] = spec.split(':');
        try {
            await load(room, layout, 'night'); const night = await probe();
            const row = { room: spec, panes: night.panes, facings: night.facings, lands: night.lands, nightRatio: night.ratio };
            if (!night.panes || night.lands < night.facings) fail.push(`${spec}: ${night.panes} panes, ${night.lands} worlds for ${night.facings} facings`);
            if (night.failed.length) fail.push(`${spec}: shaders failed ${night.failed.join(', ')}`);
            if (night.ratio !== null && night.ratio > NIGHT_BOUND) fail.push(`${spec}: the window is ${night.ratio}x the frame's mean after dark`);
            if (DAYTIME_PARTY.has(room)) { await load(room, layout, 'party'); const party = await probe(); row.partyLamp = party.lamp; if (party.lamp !== 0) fail.push(`${spec}: night outside its daytime party (lamp ${party.lamp})`); }
            rows.push(row);
        } catch (e) { fail.push(`${spec}: ${e.message.slice(0, 200)}`); }
    }
    // the photograph path: no scenery at all
    await frame.evaluate(() => { window.__efWindowView = 'photo'; }); await load('home', 'house', 'afternoon'); const photo = await probe();
    if (photo.lands || photo.panes) fail.push(`photo mode: ${photo.lands} scenery worlds, ${photo.panes} sky panes`);
    if (!photo.vistas) fail.push('photo mode: no photograph on the home window');
    console.table(rows);
    if (errors.length) fail.push(...errors.map(e => 'page: ' + e));
    await browser.close();
    assert.deepEqual(fail, [], fail.join('\n'));
    console.log(`PASS window scenery in ${rows.length} rooms: a world per wall, shaders compiled, daytime parties have daylight, the window under ${NIGHT_BOUND}x the frame after dark, photograph mode without scenery`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
