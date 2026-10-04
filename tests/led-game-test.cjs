const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
    const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.stat(file,(error,stat)=>{
        if(error||!stat.isFile())return res.writeHead(404).end();
        res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
        const range=req.headers.range;
        if(range){const [start,last]=range.replace('bytes=','').split('-').map(Number);const end=last||stat.size-1;
            res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);
        }else{res.setHeader('Content-Length',stat.size);fs.createReadStream(file).pipe(res);}
    });
});
(async()=>{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--disable-accelerated-video-decode']});
    try{
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push(m.text());});
        await page.setViewport({width:1366,height:1100});
        if(process.argv.includes('--media-only')){
            await page.goto(`http://127.0.0.1:${server.address().port}/assets/led/game/neon-flight.mp4`);
            await page.evaluate(()=>document.querySelector('video').play());
            await page.waitForFunction(()=>document.querySelector('video').currentTime>.25);
            await page.evaluate(()=>{const v=document.querySelector('video');v.pause();v.currentTime=3;});
            await page.waitForFunction(()=>document.querySelector('video').readyState>=2&&!document.querySelector('video').seeking);
            console.log('Standalone media pause/seek',await page.evaluate(()=>({paused:document.querySelector('video').paused,time:document.querySelector('video').currentTime})));
            return;
        }
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(()=>window.ErgoFlex?.loadedModel&&document.querySelector('.demo-led-playback summary'),{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.45);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.setLedColor('#40eaff',false);ErgoFlex.setLedEffect({mode:'breathe',period:8},false);});
        await page.click('.demo-led-playback summary');
        const control=s=>'.demo-led-playback '+s;
        await page.click(control('[data-game-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledGameMode.bank&&!ErgoFlex.ledGameMode.video.paused&&ErgoFlex.ledGameMode.video.currentTime>.25,{timeout:30000}).catch(async e=>{console.log('Start diagnostic',await page.evaluate(()=>({active:ErgoFlex.ledGameMode.active,error:ErgoFlex.ledGameMode.error,time:ErgoFlex.ledGameMode.video.currentTime,paused:ErgoFlex.ledGameMode.video.paused,ready:ErgoFlex.ledGameMode.video.readyState})));throw e;});
        assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),true);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.muted),true,'No autoplay sound');
        await page.waitForFunction(()=>ErgoFlex.ledGameMode.monitor?.parent&&ErgoFlex.ledMotionState.source==='game');
        const allocations=await page.evaluate(()=>({texture:ErgoFlex.ledPixelRenderer.texture.uuid,monitor:ErgoFlex.ledGameMode.monitor.uuid,
            exportHasGame:ErgoFlex.workspaceAccessories.exportGroups().some(g=>{let found=false;g.traverse(o=>{if(o.userData.transientGameScreen)found=true;});return found;})}));
        assert.equal(allocations.exportHasGame,false,'Native export keeps the static desk fallback');
        await page.click(control('[data-game-play]')); // pause
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.paused),true);
        await page.$eval(control('[data-game-seek]'),el=>{el.value='3';el.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>Math.abs(ErgoFlex.ledGameMode.video.currentTime-3)<.05&&ErgoFlex.ledGameMode.video.readyState>=2).catch(async e=>{
            console.log('Seek diagnostic',await page.evaluate(()=>{const g=ErgoFlex.ledGameMode,v=g.video;return {time:v.currentTime,paused:v.paused,ready:v.readyState,seeking:v.seeking,duration:v.duration,error:g.error};}));throw e;
        });
        const paused=await page.evaluate(()=>({time:ErgoFlex.ledGameMode.video.currentTime,data:[...ErgoFlex.ledPixelRenderer.data]}));
        await new Promise(r=>setTimeout(r,300));
        assert.deepEqual(await page.evaluate(()=>[...ErgoFlex.ledPixelRenderer.data]),paused.data,'Paused video and LED frame stay synchronized');
        for(const preset of ['calm','normal','intense','full']){
            await page.select(control('[data-game-preset]'),preset);
            await page.waitForFunction(mode=>ErgoFlex.ledGameMode.mode===mode&&!!ErgoFlex.ledGameMode.bank,{},preset);
            assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.content),['intense','full'].includes(preset)?'music':'colours');
        }
        await page.select(control('[data-game-content]'),'colours');await page.waitForFunction(()=>!!ErgoFlex.ledGameMode.bank);
        await page.select(control('[data-game-content]'),'music');await page.waitForFunction(()=>!!ErgoFlex.ledGameMode.bank);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.muted),true);
        await page.click(control('[data-game-audio]'));assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.muted),false);
        await page.click(control('[data-game-audio]'));
        await page.click(control('[data-game-play]')); // resume timeline
        const beforeMotion=await page.evaluate(()=>ErgoFlex.ledGameMode.video.currentTime);
        // Actual jog movement, rather than a standalone effect-preview click.
        await page.$eval('#desk-height-slider',el=>{el.value=Number(el.max)*.7;el.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.owner?.fx===34,{timeout:15000});
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMotionState.source),'movement');
        await page.evaluate(()=>ErgoFlex.setLedColor('#497bff',false));
        await new Promise(r=>setTimeout(r,250));
        assert.ok(await page.evaluate(t=>ErgoFlex.ledGameMode.video.currentTime>t, beforeMotion),'Ambient media keeps advancing during movement');
        await page.$eval('#desk-height-slider',el=>{el.value='0';el.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='game');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMotionState.completionUntil),0,'Jog release does not fake target completion');
        const target=await page.evaluate(()=>ErgoFlex.heightInches+.5);
        await page.$eval('#desk-height-display',(el,target)=>{el.value=String(target);el.dispatchEvent(new Event('change'));},target);
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='completion',{timeout:15000});
        assert.ok(await page.evaluate(target=>Math.abs(ErgoFlex.heightInches-target)<.01,target),'Target cue follows actual preset arrival');
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='game',{timeout:10000});
        await page.$eval('#tilt-slider',el=>{el.value=-Number(el.max)*.7;el.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.owner?.fx===35);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMotionState.owner.ix),128,'Increasing displayed tilt is actuator retract');
        await page.evaluate(()=>ErgoFlex.haltAllMotion());
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='game');
        await page.focus('#glide-pad');await page.keyboard.down('ArrowRight');
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.owner?.fx===36);await page.keyboard.up('ArrowRight');
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='game');
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(false));assert.equal(await page.evaluate(()=>ErgoFlex.ledPixelRenderer.active),false);
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(true));await page.waitForFunction(()=>ErgoFlex.ledPixelRenderer.active);
        await page.select('#size-select','48x30');await page.select('#size-select','60x30');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledPixelRenderer.texture.uuid),allocations.texture);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.monitor.uuid),allocations.monitor,'One monitor/material allocation reused');
        await page.click(control('[data-game-play]')); // static screenshot
        await page.$eval(control('[data-game-seek]'),el=>{el.value='4';el.dispatchEvent(new Event('input'));});
        await new Promise(r=>setTimeout(r,300));await page.screenshot({path:'/tmp/ef-led-game-preview.png',fullPage:true});
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
        await page.click(control('[data-game-play]'));assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.paused),true);
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.video.paused),true);assert.equal(await page.evaluate(()=>ErgoFlex.ledSoundState.owner),null);
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
        await page.click(control('[data-game-stop]'));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.active),false);
        await page.waitForFunction(()=>!ErgoFlex.ledPixelRenderer.active);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledColor),'#497bff');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledEffect.mode),'breathe');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledGameMode.monitor.parent),null);
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        await page.click(control('[data-game-play]'));await page.waitForFunction(()=>!!ErgoFlex.ledGameMode.bank&&!ErgoFlex.ledGameMode.video.paused);
        await page.click(control('[data-game-repeat]'));
        await page.evaluate(()=>{ErgoFlex.ledGameMode.video.currentTime=11.8;});
        await page.waitForFunction(()=>!ErgoFlex.ledGameMode.active,{timeout:10000});
        // Floor directions stay fixed at both desk and camera orientations.
        const cameras=[];
        for(const yaw of [0,Math.PI/2]){
            await page.evaluate(yaw=>{
                const p=ErgoFlex.serializeProject();p.motion.yaw=yaw;p.motion.glide={x:0,z:0};ErgoFlex.applyProject(p);
                const select=document.querySelector('#camera-view');select.value=yaw?'side':'front';select.dispatchEvent(new Event('change'));
            },yaw);
            cameras.push(await page.evaluate(()=>ErgoFlex.cameraState.position));
            for(const [key,axis,sign]of [['ArrowDown','x',1],['ArrowUp','x',-1],['ArrowRight','z',-1],['ArrowLeft','z',1]]){
                await page.evaluate(()=>{ErgoFlex.stopGlide();ErgoFlex.haltAllMotion();});
                const at=await page.evaluate(()=>ErgoFlex.glidePosition);
                await page.focus('#glide-pad');await page.keyboard.down(key);
                await page.waitForFunction(({at,axis,sign})=>(ErgoFlex.glidePosition[axis]-at[axis])*sign>.01,{timeout:15000},{at,axis,sign});
                await page.keyboard.up(key);
                const end=await page.evaluate(()=>ErgoFlex.glidePosition);
                const other=axis==='x'?'z':'x';assert.ok(Math.abs(end[other]-at[other])<1e-8,'Orbit/yaw do not change the pad floor axes');
                await new Promise(r=>setTimeout(r,150));assert.deepEqual(await page.evaluate(()=>ErgoFlex.glidePosition),end,'Glide stops on release');
            }
        }
        assert.notDeepEqual(cameras[0],cameras[1],'Fixed directions checked from different camera angles');
        assert.deepEqual(errors,[]);
        console.log('Game Mode play/pause/seek/end, four presets, both content options, muted audio, actual lift/tilt/glide override, preset completion, current-time resume, LED off, size reuse, export fallback, fixed floor directions and background/reduced-motion cleanup passed.');
    }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
