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
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1500, height: 1200 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=home&layout=spacious&view=room`);
        const ready = async () => {
            await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
            await page.evaluate(async()=>{ErgoFlex.renderer.setPixelRatio(.4);ErgoFlex.renderer.shadowMap.enabled=false;await ErgoFlex.workspaceRoom.ready;});
        };
        await ready();
        await page.evaluate(async()=>{ErgoFlex.setHomeLayout('spacious');await ErgoFlex.workspaceRoom.ready;});
        await page.evaluate(()=>{
            ErgoFlex.haltAllMotion();ErgoFlex.setHomeMode('morning',false);
            ErgoFlex.setHeight(38);ErgoFlex.setTilt('tilting',7);
            ErgoFlex.setLedsEnabled(true);ErgoFlex.setLedColor('#3491c7');ErgoFlex.setLedGlow(53);
            ErgoFlex.setLedEffect({mode:'breathe',period:12});
            ErgoFlex.setLedSurface('desktopReach',74);ErgoFlex.setLedMotionEnabled(false);
            ErgoFlex.ledMusicMode.setEffect(33);ErgoFlex.ledMusicMode.sensitivity=1.25;
        });
        await page.evaluate(()=>ErgoFlex.jogYaw(1));
        await page.waitForFunction(()=>Math.abs(ErgoFlex.deskYaw)>.01 || !!ErgoFlex.collisionState.alert,{timeout:10000});
        await page.evaluate(()=>ErgoFlex.jogYaw(0));
        await page.click('#home-office-controls [data-groove-save]');
        const stored = await page.evaluate(()=>ErgoFlex.savedGroovePositions);
        const key = Object.keys(stored)[0], saved=stored[key];
        assert.ok(key.endsWith('/morning'));assert.ok(Math.abs(saved.pose.yaw)>.01,'Current rotation captured');
        assert.equal(saved.height,38);assert.equal(saved.tilt,7);assert.equal(saved.lights.color,'#3491c7');
        assert.equal(saved.lights.effect.mode,'breathe');assert.equal(saved.lights.surfaces.desktopReach,74);
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.serializeProject().presentation.groovePositions),stored,'Project export contains saves');
        await page.evaluate(async()=>{await ErgoFlex.prepareGrooveMode('home','evening');});
        assert.equal(await page.$eval('#home-office-controls [data-groove-reset]',e=>e.disabled),true,'Other time is independent');
        await page.evaluate(async()=>{await ErgoFlex.prepareGrooveMode('home','morning');});
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.grooveRouting.desired),saved.pose);
        await page.reload();await ready();
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.savedGroovePositions),stored,'Reload preserves saved recipe');
        await page.evaluate(async()=>{
            ErgoFlex.setHomeMode('morning',false);ErgoFlex.setHeight(36);ErgoFlex.setTilt('tilting',0);
            ErgoFlex.setLedColor('#f00baa');ErgoFlex.setLedGlow(20);ErgoFlex.setLedSurface('desktopReach',20);
            await ErgoFlex.prepareGrooveMode('home','morning');
        });
        assert.equal(await page.evaluate(()=>ErgoFlex.grooveState.plan.ok),true,'Saved rotated destination is reachable');
        await page.click('#home-office-controls [data-groove-start]');
        assert.equal(await page.$eval('#home-office-controls [data-groove-save]',e=>e.disabled),true,'Cannot overwrite mid-routine');
        await page.waitForFunction(()=>ErgoFlex.grooveState.status==='idle',{timeout:60000});
        const final=await page.evaluate(()=>({height:ErgoFlex.heightInches,tilt:ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg,
            color:ErgoFlex.ledColor,glow:ErgoFlex.ledGlow,effect:ErgoFlex.ledEffect,surfaces:ErgoFlex.ledSurfaces,
            motion:ErgoFlex.ledMotionState.enabled,fx:ErgoFlex.ledMusicMode.fx,sensitivity:ErgoFlex.ledMusicMode.sensitivity,
            position:ErgoFlex.glidePosition,yaw:ErgoFlex.deskYaw,scale:ErgoFlex.workspaceRoom.root.scale.x}));
        assert.ok(Math.abs(final.height-saved.height)<.05);assert.ok(Math.abs(final.tilt-saved.tilt)<.1);
        assert.ok(Math.abs(-final.position.z/final.scale-saved.pose.x)<1e-5);
        assert.ok(Math.abs(final.position.x/final.scale-saved.pose.z)<1e-5);
        assert.ok(Math.abs(final.yaw-saved.pose.yaw)<1e-5);
        assert.equal(final.color,saved.lights.color);assert.equal(final.glow,saved.lights.glow);
        assert.deepEqual(final.effect,saved.lights.effect);assert.equal(final.surfaces.desktopReach,74);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),true);assert.equal(final.motion,false);assert.equal(final.fx,33);assert.equal(final.sensitivity,1.25);
        await page.evaluate(async()=>{
            ErgoFlex.applyCustomLedLook({name:'Saved strip look',bri:110,on:true,strips:Array.from({length:8},(_,id)=>({id,fx:0,pal:0,col:[[id*20,70,100,0]]}))});
            ErgoFlex.saveCurrentGroovePosition();
            ErgoFlex.setLedColor('#ff0000');
            await ErgoFlex.prepareGrooveMode('home','morning');ErgoFlex.startGroove();
        });
        await page.waitForFunction(()=>ErgoFlex.grooveState.status==='idle',{timeout:60000});
        assert.equal(await page.evaluate(()=>ErgoFlex.customLedLook?.name),'Saved strip look','Custom per-strip recipe restored');
        await page.evaluate(()=>ErgoFlex.setHomeLayout('house'));
        await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        assert.equal(await page.$eval('#home-office-controls [data-groove-reset]',e=>e.disabled),true,'Different room size has its own saves');
        await page.evaluate(()=>ErgoFlex.setHomeLayout('spacious'));
        await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;});
        await page.click('#home-office-controls [data-groove-reset]');
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.savedGroovePositions),{});
        await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>ErgoFlex.savedGroovePositions),{},'Reset survives reload');
        assert.deepEqual(errors,[]);
        console.log('Groove save: actual pose, lighting recipe, reload, exact playback, per-setting/size isolation, project export and reset passed.');
    } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
