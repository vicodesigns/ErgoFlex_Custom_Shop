#!/usr/bin/env node
// Review stills of Studio rooms: every room x layout x daypart you name, from fixed review cameras, with or without people.
//
//   node tools/rooms/room-stills.cjs <out dir> <room:layout:daypart[:size]> [...] --port 3123
//        [--views asloaded,overview,eyeL,eyeR,desk,reverse,top] [--people] [--mode-height] [--eval file.js] [--w 1280 --h 720]
//
// Needs a server of this checkout on --port (node tools/studio-server.mjs --port 3123 --host 127.0.0.1 --no-watch
// --state /tmp/some-state.json) and Chrome at /usr/bin/google-chrome with the GPU (run under the stills lock).
// Views: `asloaded` (first in the list) is the camera the Studio itself opens the room with; overview, eyeL, eyeR, desk,
// reverse and top are review cameras, not product views; `cam=x,y,z/x,y,z/fov` is an eye / look-at in room millimetres
// (separate views with ';' when one of them is a cam=).
// --people switches the room's people on. --mode-height puts the featured desk where the daypart puts it in the Studio
// (the room's mode height and tilt); without it the desk stays at the 30 in the presentation loader sets, which is what
// the film's chapters without a lift use. One run loads the Studio once and takes about 6 s per spec.
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const puppeteer = require(fs.existsSync(path.join(ROOT, 'node_modules/puppeteer')) ? path.join(ROOT, 'node_modules/puppeteer') : '/home/ergo/ErgoFlex_Custom_Shop/node_modules/puppeteer');
const args = process.argv.slice(2), flag = n => { const i = args.indexOf('--' + n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }, bool = n => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const port = flag('port') || 3123, evalFile = flag('eval'), W = +(flag('w') || 1280), H = +(flag('h') || 720), people = bool('people'), modeHeight = bool('mode-height');
const views = (flag('views') || 'overview,eyeL,eyeR,desk').split(';').flatMap(v => v.startsWith('cam=') ? [v] : v.split(','));
const out = args.shift(), specs = args;
if (!out || !specs.length) { console.error('usage: room-stills.cjs <out dir> <room:layout:daypart[:size]> ... --port N'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
(async () => {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', defaultViewport: { width: W, height: H },
        args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] });
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // The Studio's stage only starts inside a frame.
    await page.evaluate((W, H) => { document.documentElement.innerHTML = `<body style="margin:0;background:#000"><iframe id="s" style="width:${W}px;height:${H}px;border:0" src="/?room=home&view=room&layout=house&presentation=1&tour=1"></iframe></body>`; }, W, H);
    const frame = await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction('window.ErgoPresentation&&window.ErgoFlex', { timeout: 180000 });
    await frame.addScriptTag({ type: 'module', url: '/tools/environment-review-session.mjs' });
    await frame.waitForFunction('window.EnvironmentReview', { timeout: 60000 });
    await frame.addScriptTag({ type: 'module', content: `import * as THREE from 'three';window.__T=THREE;` });
    await frame.waitForFunction('window.__T', { timeout: 60000 });
    for (const spec of specs) {
        const [room, layout, phase, size] = spec.split(':'), t0 = Date.now();
        const report = await frame.evaluate(async (room, layout, phase, size) => { const r = await EnvironmentReview.load(room, phase || 'afternoon', size || '60x30', layout || null); return { mode: r.actualMode, layout: r.layout, size: r.actualDeskSize }; }, room, layout, phase, size);
        if (modeHeight) report.desk = await frame.evaluate(async phase => {
            const E = window.ErgoFlex, P = window.ErgoPresentation, m = E.measuredRoom?.modes?.[phase]; if (!m || !(m.height > 0)) return null;
            E.setHeight(m.height); if (m.tilt !== undefined && E.setTilt) E.setTilt('tilting', m.tilt); const t0 = performance.now();
            while (performance.now() - t0 < 14000) { P.wake?.(600); await new Promise(r => setTimeout(r, 400)); if (Math.abs((E.heightInches ?? m.height) - m.height) < .05 && performance.now() - t0 > 1500) break; }
            return { height: m.height, tilt: m.tilt ?? null };
        }, phase);
        if (people) report.people = await frame.evaluate(async () => { const E = window.ErgoFlex; await E.setRoomPeople(true); const p = E.workspaceRoom.people; if (p?.built) await p.built; await new Promise(r => setTimeout(r, 1200)); return p ? p.people.filter(o => o.visible).map(o => o.userData.person.id.replace(/^people-/, '')) : []; });
        if (evalFile) await frame.evaluate(fs.readFileSync(evalFile, 'utf8'));
        await new Promise(r => setTimeout(r, 2200));
        for (const view of views) {
            await frame.evaluate(async view => {
                const T = window.__T, E = window.ErgoFlex, r = E.workspaceRoom, l = r.roomLayout, c = E.sceneDesks.ctx.camera, o = E.sceneDesks.ctx.controls;
                r.root.updateWorldMatrix(true, true); const M = r.root.matrixWorld, inv = M.clone().invert();
                const set = (p, t, fov) => { c.position.copy(new T.Vector3(...p).applyMatrix4(M)); o.target.copy(new T.Vector3(...t).applyMatrix4(M)); c.fov = fov; c.near = .01; c.updateProjectionMatrix(); o.maxDistance = 1e5; o.minDistance = 0; o.update(); };
                let desk = new T.Vector3(0, 750, l.back + l.depth * .45);
                try { const b = new T.Box3().setFromObject(E.loadedModel); if (!b.isEmpty()) desk = b.getCenter(new T.Vector3()).applyMatrix4(inv); } catch { /* no desk: the room's middle */ }
                const w = l.width, d = l.depth, z0 = l.back, h = l.height;
                if (view === 'overview') EnvironmentReview.frameRoom();
                else if (view === 'eyeL') set([-w * .36, 1450, z0 + d * .97], [w * .12, 950, z0 + d * .3], 52);
                else if (view === 'eyeR') set([w * .36, 1450, z0 + d * .97], [-w * .12, 950, z0 + d * .3], 52);
                else if (view === 'reverse') set([w * .3, 1500, z0 + d * .08], [-w * .1, 1000, z0 + d * .8], 58);
                else if (view === 'desk') set([desk.x - 1500, 1350, desk.z + 2100], [desk.x, desk.y + 50, desk.z], 40);
                else if (view === 'top') set([0, h * 3.2, z0 + d * .5 + 1], [0, 0, z0 + d * .5], 50);
                else if (view.startsWith('cam=')) { const [p, t, f] = view.slice(4).split('/'); set(p.split(',').map(Number), t.split(',').map(Number), Number(f || 50)); }
                // any other name (asloaded): the camera stays where the Studio put it
                await EnvironmentReview.settleView(); await new Promise(r => setTimeout(r, 400));
            }, view);
            const data = await frame.evaluate(W => EnvironmentReview.capture(W), W);
            fs.writeFileSync(path.join(out, `${room}-${layout}-${phase}-${view.startsWith('cam=') ? 'cam' + views.indexOf(view) : view}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
        }
        console.log(spec, JSON.stringify(report), ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
