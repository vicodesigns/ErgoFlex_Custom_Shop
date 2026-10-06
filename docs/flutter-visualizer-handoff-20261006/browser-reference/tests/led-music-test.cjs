const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
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
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--disable-accelerated-video-decode']});
    try{
        const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.setViewport({width:1366,height:1100});
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(()=>window.ErgoFlex?.ledMusicMode&&window.ErgoFlex?.ledCount===43&&document.querySelector('.demo-led-playback .led-music-playback'),{timeout:120000});
        await page.evaluate(()=>{
            ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;
            const panel=document.querySelector('.demo-led-playback .led-music-playback');
            panel.id='music-test';panel.open=true;
        });
        const powerBefore=await page.evaluate(()=>ErgoFlex.ledsEnabled);
        await page.click('.hub-led');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),!powerBefore,'Tap toggles LED power');
        assert.equal(await page.$eval('#led-command-center',el=>el.hidden),true,'Tap leaves Command Center closed');
        const bulbBox=await (await page.$('.hub-led')).boundingBox();
        await page.mouse.move(bulbBox.x+bulbBox.width/2,bulbBox.y+bulbBox.height/2);await page.mouse.down();
        await page.waitForFunction(()=>!document.querySelector('#led-command-center').hidden,{timeout:3000});await page.mouse.up();
        assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),!powerBefore,'Hold opens settings without toggling power');
        assert.ok(await page.evaluate(()=>{const canvas=document.querySelector('#model-canvas').getBoundingClientRect();return document.elementFromPoint(canvas.x+canvas.width/2,canvas.y+canvas.height/2).id==='model-canvas';}),'Desk remains interactive while settings are open');
        await page.click('[data-ledcc-tab="music"]');
        assert.equal(await page.$eval('#led-command-center',el=>el.hidden),false);
        const control=selector=>'#music-test '+selector;
        assert.equal(await page.$$eval(control('[data-music-effect] option'),options=>options.length),10);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.soundOn),false);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledMusicMode.audio.paused,{timeout:15000});
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.frame.some(row=>row.some(value=>value>0)),{timeout:15000});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='music');
        const beforeMotion=await page.evaluate(()=>ErgoFlex.ledMusicMode.audio.currentTime);
        await page.$eval('#desk-height-slider',element=>{element.value=Number(element.max)*.7;element.dispatchEvent(new Event('input'));});
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='movement');
        assert.ok(await page.evaluate(time=>ErgoFlex.ledMusicMode.audio.currentTime>time,beforeMotion),'Music clock advances during motion');
        await page.evaluate(()=>ErgoFlex.haltAllMotion());
        await page.waitForFunction(()=>ErgoFlex.ledMotionState.source==='music');
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.gain.gain.value),0,'Silent analysis works without audible playback');
        for(const fx of [28,29,30,31,32,33,37,38,39,40]){
            await page.select(control('[data-music-effect]'),String(fx));
            assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.fx),fx);
        }
        await page.click(control('[data-music-sound]'));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.soundOn),true,'Sound toggle enables audible music');
        await page.waitForFunction(()=>Math.abs(ErgoFlex.ledMusicMode.gain.gain.value-.5)<.001,{timeout:3000});
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.gain.gain.value),.5);
        await page.$eval(control('[data-music-volume]'),element=>{element.value='1';element.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.gain.gain.value===1);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.gain.gain.value),1);
        await page.select(control('[data-music-effect]'),'33');
        await page.screenshot({path:'/tmp/ef-led-music-preview.png',fullPage:true});
        await page.click(control('[data-music-play]'));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.audio.paused),true);
        await page.$eval(control('[data-music-seek]'),element=>{element.value='3';element.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.ledMusicMode.audio.currentTime)-3)<.2);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>!ErgoFlex.ledMusicMode.audio.paused);
        await page.evaluate(()=>{
            const button=document.querySelector('.demo-led-playback [data-game-play]');
            button.closest('details').open=true;button.click();
        });
        await page.waitForFunction(()=>ErgoFlex.ledGameMode.active&&!ErgoFlex.ledMusicMode.active);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledGameMode.active);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.useFile({size:200*1024*1024,type:'audio/wav'})),false);
        assert.equal(await page.evaluate(()=>{
            const rate=24000, samples=rate, bytes=new Uint8Array(44+samples*2),view=new DataView(bytes.buffer);
            const text=(offset,value)=>[...value].forEach((character,index)=>view.setUint8(offset+index,character.charCodeAt(0)));
            text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
            view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
            text(36,'data');view.setUint32(40,samples*2,true);
            for(let sample=0;sample<samples;sample++)view.setInt16(44+sample*2,Math.round(Math.sin(sample/rate*2*Math.PI*440)*12000),true);
            return ErgoFlex.ledMusicMode.useFile(new File([bytes],'local-preview.wav',{type:'audio/wav'}));
        }),true);
        const localUrl=await page.evaluate(()=>ErgoFlex.ledMusicMode.objectUrl);
        assert.ok(localUrl.startsWith('blob:'),'Local song uses a private object URL');
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledMusicMode.audio.paused);
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.metrics.volume>.05);
        await page.$eval(control('[data-music-demo]'),button=>button.click());
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.objectUrl),null);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&!ErgoFlex.ledMusicMode.audio.paused);
        await page.$eval(control('[data-music-stop]'),button=>button.click());
        await page.waitForFunction(()=>!ErgoFlex.ledMusicMode.active);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.active),false);
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(false));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledPixelRenderer.active),false);
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(true));
        await page.evaluate(()=>ErgoFlex.setLedEffect({mode:'fx-33',period:8},false));
        const validEffect=await page.evaluate(()=>ErgoFlex.ledEffect.mode);
        assert.equal(validEffect,'solid','Music IDs are not decorative saved looks');
        await page.evaluate(()=>ErgoFlex.setLedEffect({mode:'fx-4',period:8},false));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledEffect.mode),'fx-4');
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.active&&ErgoFlex.ledMusicMode.audio.paused);
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.frame.some(row=>row.some(value=>value>0)));
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        await page.click(control('[data-music-play]'));
        await page.waitForFunction(()=>!ErgoFlex.ledMusicMode.audio.paused);
        await page.click('[data-ledcc-music="dj"]');
        await page.select('[data-dj-program]','custom');
        for(const fx of [28,29,30,31,32,33,37,38,39,40])await page.select(`[data-dj-weight="${fx}"]`,fx===33?'4':'0');
        await page.click('button[data-dj-comfort="minimal"]');
        await page.click('[data-dj-save]');
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.browserAutoDJ.v1')).weights[33]),4);
        await page.click('[data-dj-start]');
        await page.waitForFunction(()=>ErgoFlex.ledMusicMode.dj.enabled&&!ErgoFlex.ledMusicMode.audio.paused);
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.fx),33);
        await page.evaluate(()=>ErgoFlex.ledMusicMode.pause());
        const djTime=await page.evaluate(()=>ErgoFlex.ledMusicMode.dj.time);
        await new Promise(resolve=>setTimeout(resolve,250));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.dj.time),djTime,'Paused Auto DJ holds its conductor');
        await page.click('[data-dj-stop]');assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.dj.enabled),false);
        // One UI on both screen sizes; every dial stays inside its card.
        await page.click('[data-ledcc-close]');
        assert.equal(await page.$('.demo-top [data-led-toggle]'),null,'Lighting is integrated into the app');
        for(const width of [390,674,1366]){
            await page.setViewport({width,height:1100});
            await page.waitForFunction(()=>{const slot=document.querySelector('#demo-remote'),dock=document.querySelector('#motion-dock');const scale=slot.clientWidth<760?slot.clientWidth/760:1;return Math.abs(Number(dock.style.getPropertyValue('--demo-app-scale'))-scale)<.001&&document.querySelector('#glide-pad').getBoundingClientRect().right<=innerWidth;});
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            const inside=await page.evaluate(()=>[...document.querySelectorAll('.remote-grid>[data-motion-panel]')].every(card=>{
                const a=card.getBoundingClientRect(),b=card.querySelector('.remote-compass,.remote-vslider,.remote-arc').getBoundingClientRect();return b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1;
            }));assert.ok(inside,`Controls stay inside cards at ${width}px`);
            await page.focus('.hub-led');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');
            assert.ok(await page.$eval('.ledcc-sheet',el=>{const box=el.getBoundingClientRect(),app=document.querySelector('#demo-remote').getBoundingClientRect();return box.right<=innerWidth+.5&&box.top>=app.top-.5&&box.bottom<=app.bottom+.5;}),'Command Center stays over app, clear of desk');
            await page.screenshot({path:`/tmp/ef-command-center-${width}.png`});
            await page.click('[data-ledcc-close]');
        }
        await page.focus('.hub-led');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');await page.click('[data-ledcc-tab="music"]');
        await page.click('[data-music-play]');
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
        assert.equal(await page.evaluate(()=>ErgoFlex.ledMusicMode.audio.paused),true);
        assert.deepEqual(errors,[]);
        console.log('Ten Music Mode effects, real muted analysis, private local song/demo switching, gain/volume, movement override, pause/seek, Game Mode exclusion, stop, validation, decorative selection, reduced motion and background cleanup passed.');
    }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
