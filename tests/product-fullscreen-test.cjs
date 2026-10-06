const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(process.env.ERGOFLEX_TEST_ROOT||path.join(__dirname,'..'));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg'};
const server=http.createServer((request,response)=>{
    const file=path.join(root,decodeURIComponent(new URL(request.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep))return response.writeHead(403).end();
    fs.stat(file,(error,stat)=>{
        if(error||!stat.isFile())return response.writeHead(404).end();
        response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');response.setHeader('Accept-Ranges','bytes');
        if(request.headers.range){const [first,last]=request.headers.range.replace('bytes=','').split('-').map(Number);const end=last||stat.size-1;
            response.writeHead(206,{'Content-Range':`bytes ${first}-${end}/${stat.size}`,'Content-Length':end-first+1});fs.createReadStream(file,{start:first,end}).pipe(response);
        }else{response.setHeader('Content-Length',stat.size);fs.createReadStream(file).pipe(response);}
    });
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try{
        const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.setViewport({width:1366,height:1100});
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(()=>window.ErgoFlex?.ledMusicMode&&document.querySelector('#demo-remote #motion-dock'),{timeout:120000});
        await page.evaluate(()=>{
            ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;
            window.originalCanvas=document.querySelector('#model-canvas');
            window.originalDock=document.querySelector('#motion-dock');
            window.originalMusic=ErgoFlex.ledMusicMode;
            ErgoFlex.prepareLedCommandCenter().open();
            ErgoFlex.prepareLedCommandCenter().select('tab','music');
            Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{
                const context=window.testAudio=new AudioContext(),osc=context.createOscillator(),sink=context.createMediaStreamDestination();
                osc.connect(sink);osc.start();await context.resume();
                window.testStream=sink.stream;return sink.stream;
            }});
        });
        await page.click('#led-command-center [data-music-share]');
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.computerAudio&&ErgoFlex.ledMusicMode.active);
        const state=()=>page.evaluate(()=>({same:originalCanvas===document.querySelector('#model-canvas')&&originalDock===document.querySelector('#motion-dock')&&originalMusic===ErgoFlex.ledMusicMode,playing:ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledMusicMode.paused,tracks:testStream.getTracks().every(t=>t.readyState==='live')}));
        await page.click('button[aria-controls="demo-stage"]');
        await page.waitForFunction(()=>document.fullscreenElement?.id==='demo-stage');
        const layout=()=>page.evaluate(()=>{
            const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom};};
            return {stage:rect('demo-stage'),viewer:rect('demo-viewer'),slot:rect('demo-remote'),dock:rect('motion-dock'),cc:rect('led-command-center'),parent:document.getElementById('led-command-center').parentElement.id,toolbar:getComputedStyle(document.querySelector('.demo-top')).display,exit:getComputedStyle(document.querySelector('.demo-fullscreen-exit')).display,width:innerWidth,height:innerHeight};
        });
        const check=async()=>{
            await page.waitForFunction(()=>{const slot=document.getElementById('demo-remote').getBoundingClientRect(),cc=document.getElementById('led-command-center').getBoundingClientRect();return Math.abs(slot.y-cc.y)<1&&Math.abs(slot.height-cc.height)<1;});
            const l=await layout();
            assert.equal(l.parent,'demo-stage');assert.equal(l.toolbar,'none');assert.notEqual(l.exit,'none');
            assert.ok(Math.abs(l.stage.w-l.width)<1&&Math.abs(l.stage.h-l.height)<1,'Stage fills screen');
            assert.ok(l.viewer.h>=l.height*.59,'Model retains at least 60% of screen');
            assert.ok(Math.abs(l.viewer.b-l.slot.y)<1&&Math.abs(l.slot.b-l.height)<1,'Controls sit directly under viewer');
            assert.ok(Math.abs(l.dock.w-l.slot.w)<1&&Math.abs(l.dock.h-l.slot.h)<1,'Scaled app fits controls footprint');
            assert.ok(Math.abs(l.cc.y-l.slot.y)<1&&Math.abs(l.cc.b-l.slot.b)<1,'LED settings cover controls only');
            assert.deepEqual(await state(),{same:true,playing:true,tracks:true});
        };
        await check();
        await page.evaluate(()=>document.exitFullscreen());
        await page.waitForFunction(()=>!document.querySelector('#demo-stage').classList.contains('demo-fullscreen'));
        assert.equal(await page.$eval('#led-command-center',e=>e.parentElement.tagName),'BODY');
        assert.deepEqual(await state(),{same:true,playing:true,tracks:true});
        // Embedded browser denial: fill the preview without recreating media or model.
        await page.evaluate(()=>document.getElementById('demo-stage').requestFullscreen=async()=>{throw new DOMException('Not allowed','NotAllowedError');});
        for(const [width,height] of [[1366,768],[760,500],[390,844]]){
            await page.setViewport({width,height});
            await page.click('button[aria-controls="demo-stage"]');
            await page.waitForFunction(()=>document.querySelector('#demo-stage').classList.contains('demo-fullscreen'));
            await check();
            await page.click('.demo-fullscreen-exit');
            await page.waitForFunction(()=>!document.querySelector('#demo-stage').classList.contains('demo-fullscreen'));
        }
        await page.click('button[aria-controls="demo-stage"]');
        await page.waitForFunction(()=>document.querySelector('#demo-stage').classList.contains('demo-fullscreen'));
        await page.evaluate(()=>ErgoFlex.prepareLedCommandCenter().close());
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('#demo-stage').classList.contains('demo-fullscreen'));
        assert.deepEqual(await state(),{same:true,playing:true,tracks:true});
        assert.deepEqual(errors,[]);
        console.log('PASS: native fullscreen, preview fallback, responsive controls, LED sheet placement, exit/Escape, and uninterrupted live audio');
    }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
