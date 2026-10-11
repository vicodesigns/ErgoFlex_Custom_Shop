const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-ceiling-preview';
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async()=>{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try{
        const page=await browser.newPage(),errors=[];
        page.setDefaultNavigationTimeout(120000);
        page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error' && /Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text()))errors.push(m.text());});
        await page.setViewport({width:1600,height:1100});
        for(const id of ['library','coworking','lounge','music']){
            await page.goto(`http://127.0.0.1:${server.address().port}/?room=${id}&view=room&layout=house`);
            await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
            await page.evaluate(()=>ErgoFlex.renderer.setAnimationLoop(null));
            await page.waitForFunction(()=>getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
            await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setPixelRatio(.75);});
            await page.select('#camera-view','inside');
            await new Promise(r=>setTimeout(r,800));
            const snapshot=()=>page.evaluate(()=>{
                const ef=ErgoFlex,room=ef.workspaceRoom;
                room.update(ef.roomInteractions.camera);
                ef.renderer.render(ef.roomInteractions.scene,ef.roomInteractions.camera);
                let lights=0;room.root.traverse(o=>{if(o.isLight)lights++;});
                return {visible:room.ceilingSurface.visible,enabled:room.ceilingEnabled,lights,
                    movable:room.assets().includes(room.ceilingSurface),
                    bounce:room.root.userData.bouncedLighting,
                    shader:room.ceilingSurface.children[0].material.customProgramCacheKey(),
                    dark:room.ceilingSurface.children[0].material.color.getHexString()};
            });
            await page.$eval('#room-ceiling-toggle',e=>{e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});
            const off=await snapshot();assert.equal(off.visible,false);
            if(id==='library')await page.screenshot({path:path.join(out,'library-inside-off.png')});
            await page.click('#room-ceiling-toggle');
            const on=await snapshot();assert.equal(on.visible,true);assert.equal(on.enabled,true);assert.equal(on.movable,false);assert.equal(on.lights,off.lights);
            assert.match(on.shader,/room-led-spill/);
            assert.equal(on.bounce.enabled,true);assert.ok(on.bounce.energy>0);
            await page.screenshot({path:path.join(out,id+'-inside-on.png')});
            await page.click('#room-bounce-toggle');
            const flat=await snapshot();assert.equal(flat.bounce.enabled,false);assert.equal(flat.visible,true);
            await page.screenshot({path:path.join(out,id+'-bounce-off.png')});
            await page.click('#room-bounce-toggle');
            const restored=await snapshot();assert.equal(restored.bounce.enabled,true);assert.equal(restored.bounce.energy,on.bounce.energy,'Toggle must not accumulate brightness');
            const energies=[];
            for(const mode of ['morning','afternoon','evening','night','party']){
                await page.evaluate((mode)=>ErgoFlex.setMeasuredRoomMode(ErgoFlex.workspaceRoom.id,mode,false),mode);
                const state=await snapshot();assert.equal(state.bounce.enabled,true);assert.ok(Number.isFinite(state.bounce.energy)&&state.bounce.energy>0);
                assert.equal(state.lights,on.lights);energies.push(state.bounce.energy);
                if(mode==='evening'||mode==='night')await page.screenshot({path:path.join(out,id+'-'+mode+'-bounce.png')});
            }
            assert.ok(new Set(energies).size>=4,id+': bounce follows daypart lighting');
            await page.select('#camera-view','room');await new Promise(r=>setTimeout(r,800));
            const above=await snapshot();assert.equal(above.visible,false);
            await page.screenshot({path:path.join(out,id+'-cutaway.png')});
            console.log(id+': ceiling/cutaway and bounce toggle pass; all five dayparts render without extra lights.');
        }
        assert.deepEqual(errors,[]);console.log('Ceiling preview integration passed.');
    }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
