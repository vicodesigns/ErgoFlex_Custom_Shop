#!/usr/bin/env node
// A filmstrip of the person at the featured desk while the desk moves: frames at a fixed interval from one camera.
//
//   node tools/people/motion-strip.cjs <out dir> <room:layout:daypart> --port 3124 --from 28 --to 43.5
//        [--frames 16] [--every 700 (ms)] [--cam "x,y,z/x,y,z/fov" (room mm; default: beside the desk user)] [--w 960 --h 540]
//
// Loads the room with people on, puts the desk at --from, waits for the person to settle, sends the desk to --to and
// saves frame-NN.jpg every --every ms. Needs a server of this checkout on --port and GPU Chrome (run under the stills lock).
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const puppeteer = require(fs.existsSync(path.join(ROOT, 'node_modules/puppeteer')) ? path.join(ROOT, 'node_modules/puppeteer') : '/home/ergo/ErgoFlex_Custom_Shop/node_modules/puppeteer');
const args = process.argv.slice(2), flag = (n, d = null) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = flag('port', 3124), from = Number(flag('from', 28)), to = Number(flag('to', 43.5)), frames = Number(flag('frames', 16)), every = Number(flag('every', 700)), cam = flag('cam'), W = Number(flag('w', 960)), H = Number(flag('h', 540));
const out = args.shift(), [room, layout, phase] = (args.shift() || '').split(':');
if (!out || !room) { console.error('usage: motion-strip.cjs <out dir> <room:layout:daypart> --port N --from 28 --to 43.5'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
(async () => {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', defaultViewport: { width: W, height: H },
        args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] });
    const page = await browser.newPage(); page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate((W, H) => { document.documentElement.innerHTML = `<body style="margin:0;background:#000"><iframe id="s" style="width:${W}px;height:${H}px;border:0" src="/?room=home&view=room&layout=house&presentation=1&tour=1"></iframe></body>`; }, W, H);
    const frame = await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction('window.ErgoPresentation&&window.ErgoFlex', { timeout: 180000 });
    await frame.addScriptTag({ type: 'module', url: '/tools/environment-review-session.mjs' }); await frame.waitForFunction('window.EnvironmentReview', { timeout: 60000 });
    await frame.addScriptTag({ type: 'module', content: `import * as THREE from 'three';window.__T=THREE;` }); await frame.waitForFunction('window.__T', { timeout: 60000 });
    const info = await frame.evaluate(async (room, layout, phase, from, cam) => {
        const T = window.__T, E = window.ErgoFlex, P = window.ErgoPresentation, wait = ms => new Promise(r => setTimeout(r, ms));
        await EnvironmentReview.load(room, phase || 'morning', '60x30', layout || null); E.setTilt?.('tilting', 0);
        const move = async h => { E.setHeight(h); const t0 = performance.now(); while (performance.now() - t0 < 16000) { P.wake?.(600); await wait(300); if (Math.abs((E.heightInches ?? h) - h) < .05 && performance.now() - t0 > 1200) break; } };
        await move(from); await E.setRoomPeople(true); const p = E.workspaceRoom.people; if (p?.built) await p.built;
        for (let i = 0; i < 12; i++) { P.wake?.(600); await wait(400); }   // settled at the starting height
        const r = E.workspaceRoom, c = E.sceneDesks.ctx.camera, o = E.sceneDesks.ctx.controls; r.root.updateWorldMatrix(true, true); const M = r.root.matrixWorld;
        const who = p.people.find(x => x.visible && x.userData.person.desk && !x.userData.person.station);
        let eye, look, fov = 38;
        if (cam) { const [a, b, f] = cam.split('/'); eye = a.split(',').map(Number); look = b.split(',').map(Number); fov = Number(f || 38); }
        else { const q = who ? who.position : new T.Vector3(0, 0, 0), yaw = who ? who.rotation.y : Math.PI; const side = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), back = new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            eye = [q.x + side.x * 2300 + back.x * 900, 1250, q.z + side.z * 2300 + back.z * 900]; look = [q.x - back.x * 250, 900, q.z - back.z * 250]; }
        c.position.copy(new T.Vector3(...eye).applyMatrix4(M)); o.target.copy(new T.Vector3(...look).applyMatrix4(M)); c.fov = fov; c.near = .01; c.updateProjectionMatrix(); o.maxDistance = 1e5; o.minDistance = 0; o.update();
        await EnvironmentReview.settleView();
        return { who: who?.userData.person.id || null, actors: p.actors?.length ?? null, eye, look };
    }, room, layout, phase, from, cam);
    console.log(JSON.stringify(info));
    await frame.evaluate(to => { const E = window.ErgoFlex; (E.goToHeight || E.setHeight)(to); }, to);   // on its motor, as a customer's preset sends it
    for (let i = 0; i < frames; i++) {
        const t0 = Date.now();
        const shot = await frame.evaluate(async W => { const E = window.ErgoFlex, P = window.ErgoPresentation, p = E.workspaceRoom.people; P.wake?.(900); const data = EnvironmentReview.capture(W);
            return { data, height: Math.round((E.heightInches ?? 0) * 10) / 10, showing: p.people.filter(x => x.visible && x.userData.person.desk && !x.userData.person.station).map(x => x.userData.person.id.replace(/^people-/, '')) }; }, W);
        fs.writeFileSync(path.join(out, `frame-${String(i).padStart(2, '0')}.jpg`), Buffer.from(shot.data.split(',')[1], 'base64'));
        console.log(i, shot.height + ' in', shot.showing.join(','));
        const left = every - (Date.now() - t0); if (left > 0) await new Promise(r => setTimeout(r, left));
    }
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
