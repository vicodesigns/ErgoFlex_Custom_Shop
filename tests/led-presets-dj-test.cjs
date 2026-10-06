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
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.setViewport({width:1366,height:1100});await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(()=>window.ErgoFlex?.applyCustomLedLook&&document.querySelector('#demo-remote #motion-dock')&&document.querySelector('.demo-note')?.textContent.startsWith('Drag the desk'),{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.prepareLedCommandCenter().open();});
        const fixture={name:'Imported RGBW test',payload:{bri:153,seg:Array.from({length:8},(_,id)=>({id,fx:0,pal:0,col:[[id*20,40,60,id*3]],bri:255}))}};
        const file='/tmp/ergoflex-test-preset.json';fs.writeFileSync(file,JSON.stringify({presets:[fixture]}));
        await (await page.$('[data-ledcc-import]')).uploadFile(file);
        await page.waitForFunction(()=>document.querySelector('[data-ledcc-look="Imported RGBW test"]'));
        await page.click('[data-ledcc-look="Imported RGBW test"]');
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='preset');
        assert.equal(await page.evaluate(()=>ErgoFlex.customLedLook.name),fixture.name);
        assert.equal(await page.evaluate(()=>Math.round(ErgoFlex.ledGlow/ErgoFlex.ledFullBrightness*100)),60);
        const actual=await page.evaluate(()=>ErgoFlex.ledPreviewFrame.map(row=>Array.from(row.slice(0,4))));
        assert.deepEqual(actual,fixture.payload.seg.map(s=>s.col[0]),'Imported colours render in all eight physical IDs');
        await page.$eval('#desk-height-slider',input=>{input.value=Number(input.max)*.5;input.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='movement');await page.evaluate(()=>ErgoFlex.haltAllMotion());
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='preset').catch(async error=>{console.log('restoration state',await page.evaluate(()=>({look:ErgoFlex.customLedLook?.name,motion:ErgoFlex.ledMotionState,slider:document.querySelector('#desk-height-slider').value,hidden:document.hidden})));throw error;});
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.ledPreviewFrame.map(row=>Array.from(row.slice(0,4)))),actual,'Movement restores the saved look');
        await page.evaluate(()=>{ErgoFlex.setLedColor('#ffffff');ErgoFlex.prepareLedCommandCenter().select('tab','music');ErgoFlex.prepareLedCommandCenter().select('music','dj');});
        await page.select('[data-dj-program]','custom');
        assert.equal(await page.$('[data-dj-bars]'),null,'Bars selector is removed');
        assert.equal(await page.$$eval('[data-dj-look-weight]',cards=>cards.length),24,'DJ contains only music-capable saved looks');
        assert.equal(await page.$('[data-dj-look-weight="Daytime"]'),null);
        assert.equal(await page.$$eval('[data-dj-option]',controls=>controls.length),7,'All remix and beat controls are present');
        assert.equal(await page.$eval('[data-dj-option="beatAlign"]',input=>input.checked),true);
        for(const key of ['remixPresets','remixSliders','remixPhysics','burstsOn','randomizeOn','remixBursts']){
            assert.equal(await page.$eval(`[data-dj-option="${key}"]`,input=>input.checked),true,'DJ extras default on');
            await page.$eval(`[data-dj-option="${key}"]`,input=>{input.checked=false;input.dispatchEvent(new Event('change'));});
        }
        await page.click('[data-dj-dynamics="off"]');

        for(const select of await page.$$('[data-dj-look-weight]'))await select.evaluate(e=>{e.value='0';e.dispatchEvent(new Event('change'));});
        for(const fx of [28,29,30,31,32,33,37,38,39,40])await page.select(`[data-dj-weight="${fx}"]`,[28,29,33].includes(fx)?'4':'0');
        await page.evaluate(()=>{
            window.testContext=new AudioContext();const oscillator=testContext.createOscillator(),sink=testContext.createMediaStreamDestination();oscillator.connect(sink);oscillator.start();
            window.testShareRequests=0;Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{testShareRequests++;await testContext.resume();return sink.stream;}});
        });
        await page.$eval('[data-music-share]',button=>button.click());await page.waitForFunction(()=>ErgoFlex.ledMusicMode.computerAudio&&ErgoFlex.ledMusicMode.active);
        await page.evaluate(()=>{window.presetSession={stream:ErgoFlex.ledMusicMode.captureStream,token:ErgoFlex.ledMusicMode.token,request:ErgoFlex.ledMusicMode.captureRequest,time:ErgoFlex.ledMusicMode.playbackTime};ErgoFlex.prepareLedCommandCenter().select('tab','light');ErgoFlex.prepareLedCommandCenter().select('light','moods');});
        assert.equal(await page.$$eval('[data-ledcc-look][data-ledcc-music="true"]',buttons=>buttons.length),24,'22 saved Music Mode looks plus 2 mixed music-effect recipes are marked');
        for(const name of ['Daytime','Reggae (Static)','Mexi','Mexic','Master REGGAE','Rojo']){
            await page.click(`[data-ledcc-look="${name}"]`);
            const state=await page.evaluate(()=>({active:ErgoFlex.ledMusicMode.active,paused:ErgoFlex.ledMusicMode.paused,sameStream:ErgoFlex.ledMusicMode.captureStream===presetSession.stream,sameToken:ErgoFlex.ledMusicMode.token===presetSession.token,sameRequest:ErgoFlex.ledMusicMode.captureRequest===presetSession.request,live:ErgoFlex.ledMusicMode.captureStream?.getAudioTracks().every(track=>track.readyState==='live'),requests:testShareRequests,time:ErgoFlex.ledMusicMode.playbackTime}));
            assert.equal(state.active,true,name+' keeps Music Mode on');assert.equal(state.paused,false);assert.equal(state.sameStream,true);assert.equal(state.sameToken,true,'Preset does not restart audio');assert.equal(state.sameRequest,true);assert.equal(state.live,true);assert.equal(state.requests,1,'No new sharing prompt');assert.ok(state.time>=await page.evaluate(()=>presetSession.time));
        }
        await page.evaluate(()=>ErgoFlex.ledMusicMode.setEffect(33));await page.click('[data-ledcc-mood="Ocean"]');
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='music');
        assert.equal(await page.evaluate(()=>{const frame=ErgoFlex.ledMusicMode.frame,pixels=ErgoFlex.ledPreviewFrame;return pixels.every((row,strip)=>Array.from({length:row.length/4},(_,p)=>{const gain=Math.max(...frame[strip].slice(p*4,p*4+3))/255;return [64,234,255,0].every((v,c)=>row[p*4+c]===Math.round(v*gain));}).every(Boolean));}),true,'Quick mood changes colour without replacing the music animation');
        await page.evaluate(()=>{ErgoFlex.ledMusicMode.pause();window.pausedPresetTime=ErgoFlex.ledMusicMode.playbackTime;});
        await page.click('[data-ledcc-look="Master REGGAE"]');await page.click('[data-ledcc-look="Daytime"]');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.active&&ErgoFlex.ledMusicMode.paused&&ErgoFlex.ledMusicMode.playbackTime===pausedPresetTime),true,'Preset changes retain an explicit pause');
        await page.evaluate(()=>{ErgoFlex.setLedColor('#ffffff');ErgoFlex.prepareLedCommandCenter().select('tab','music');ErgoFlex.prepareLedCommandCenter().select('music','dj');});
        await page.$eval('[data-dj-start]',button=>button.click());
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.dj.enabled&&new Set(ErgoFlex.ledMusicMode.stripEffects).size>1);
        assert.ok(await page.evaluate(()=>ErgoFlex.ledMusicMode.stripEffects.every(fx=>[28,29,33].includes(fx))),'Every strip obeys Off ratings');
        const displayed=await page.$eval('[data-dj-strip-mix]',e=>e.textContent);assert.match(displayed,/Top Shelf Top:/);assert.match(displayed,/Foot Rest:/);
        await page.click('[data-dj-mix]');await page.waitForFunction(()=>new Set(ErgoFlex.ledMusicMode.stripEffects).size===1);
        await page.$eval('[data-dj-save]',button=>button.click());assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.browserAutoDJ.v1')).mixStrips),false);
        await page.click('[data-dj-mix]');await page.waitForFunction(()=>new Set(ErgoFlex.ledMusicMode.stripEffects).size>1);
        const tuningBefore=await page.evaluate(()=>({stream:ErgoFlex.ledMusicMode.captureStream===presetSession.stream,token:ErgoFlex.ledMusicMode.token}));
        for(const key of ['remixSliders','remixPhysics','randomizeOn','burstsOn','remixBursts'])await page.click(`[data-dj-option="${key}"]`);
        await page.click('[data-dj-dynamics="wide"]');await page.$eval('[data-dj-save]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.djOverlay.configs?.some(strip=>strip.sx!==128));
        assert.equal(await page.evaluate(token=>ErgoFlex.ledMusicMode.captureStream===presetSession.stream&&ErgoFlex.ledMusicMode.token===token&&testShareRequests===1,tuningBefore.token),true,'Changing remix options does not ask for another audio grant');
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.browserAutoDJ.v1')).dynamicsMode),'wide');
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.browserAutoDJ.v1')).remixPhysics),true);
        for(const key of ['remixSliders','remixPhysics','randomizeOn','burstsOn','remixBursts'])await page.click(`[data-dj-option="${key}"]`);
        await page.click('[data-dj-dynamics="off"]');

        await page.click('button[aria-controls="demo-stage"]');await page.waitForFunction(()=>document.fullscreenElement?.id==='demo-stage');
        await page.waitForFunction(()=>document.querySelector('#led-command-center').parentElement.id==='demo-stage');
        assert.equal(await page.$eval('#led-command-center',e=>e.parentElement.id),'demo-stage');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.computerAudio&&!ErgoFlex.ledMusicMode.paused),true);
        const wings=await page.evaluate(()=>{const rows=[];ErgoFlex.loadedModel.traverse(mesh=>{if(mesh.name.includes('LED wing '))rows.push({name:mesh.name,sign:mesh.material.uniforms.faceSign.value,gain:mesh.material.uniforms.bounceGain.value,sources:mesh.material.userData.ledSpillSources});});return rows;});
        console.log('Wing face mapping',wings);
        assert.equal(wings.length,4);for(const inner of wings.filter(w=>w.name.includes('inner'))){assert.equal(inner.gain,.18);assert.deepEqual(inner.sources,[4]);const outer=wings.find(w=>w.name.split(' LED ')[0]===inner.name.split(' LED ')[0]&&w.name.includes('outer'));assert.equal(inner.sign,-outer.sign);assert.equal(outer.gain,1);}
        for(const select of await page.$$('[data-dj-weight]'))await select.evaluate(e=>{e.value='0';e.dispatchEvent(new Event('change'));});
        await page.select('[data-dj-look-weight="Master REGGAE"]','4');
        await page.$eval('[data-dj-start]',button=>button.click());
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.dj.currentLook?.name==='Master REGGAE');
        assert.deepEqual(await page.evaluate(()=>ErgoFlex.ledMusicMode.dj.stripEffects()),[30,31,33,28,31,38,38,30]);
        const before=await page.evaluate(()=>({stream:ErgoFlex.ledMusicMode.computerAudio,time:ErgoFlex.ledMusicMode.playbackTime}));
        await page.evaluate(()=>{ErgoFlex.prepareLedCommandCenter().select('tab','light');ErgoFlex.prepareLedCommandCenter().select('light','palettes');});
        await page.click('[data-ledcc-palette="Bliz"]');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.computerAudio),before.stream);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.dj.enabled),true);
        await page.evaluate(()=>{ErgoFlex.prepareLedCommandCenter().select('tab','music');ErgoFlex.prepareLedCommandCenter().select('music','dj');});
        await page.select('[data-dj-palette-weight="Mexi"]','4');await page.$eval('[data-dj-save]',e=>e.click());
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.browserAutoDJ.v1')).paletteWeights.Mexi),4);
        await page.screenshot({path:'/tmp/ergoflex-strip-dj-preview.png'});
        await page.evaluate(()=>{ErgoFlex.applyCustomLedLook({name:'Wing source check',bri:255,strips:Array.from({length:8},(_,id)=>({id,fx:0,pal:0,col:[[id===4?0:255,0,id===4?255:0,0]],on:[4,5,6].includes(id)}))});ErgoFlex.renderer.setPixelRatio(1);});
        await page.screenshot({path:'/tmp/ergoflex-wing-lighting-preview.png'});
        await page.evaluate(()=>{ErgoFlex.ledMusicMode.stop();ErgoFlex.prepareLedCommandCenter().select('tab','light');ErgoFlex.prepareLedCommandCenter().select('light','moods');});
        await page.click('[data-ledcc-look="Master REGGAE"]');
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledMusicMode.paused);
        const fileState=await page.evaluate(()=>{ErgoFlex.ledMusicMode.pause();window.songPresetTime=ErgoFlex.ledMusicMode.audio.currentTime;return {token:ErgoFlex.ledMusicMode.token,src:ErgoFlex.ledMusicMode.audio.src};});
        await page.click('[data-ledcc-look="Rojo"]');await page.click('[data-ledcc-look="Evening"]');
        assert.deepEqual(await page.evaluate(()=>({token:ErgoFlex.ledMusicMode.token,src:ErgoFlex.ledMusicMode.audio.src})),fileState,'File source is retained without restarting');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.paused&&ErgoFlex.ledMusicMode.audio.currentTime===songPresetTime),true,'Song position and pause survive music/static preset changes');
        await page.evaluate(()=>document.exitFullscreen());
        await page.reload();await page.waitForFunction(()=>document.querySelector('[data-ledcc-look]'),{timeout:120000});
        assert.equal(await page.$eval('[data-ledcc-look="Imported RGBW test"]',e=>e.dataset.ledccLook),fixture.name,'Imported looks persist after reload');
        assert.deepEqual(errors,[]);
        console.log('PASS: music preset detection, shared/file source retention, no repeat permission prompt, paused position, quick mood music rendering, preset import/persistence, movement restoration and strip DJ');
    }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
