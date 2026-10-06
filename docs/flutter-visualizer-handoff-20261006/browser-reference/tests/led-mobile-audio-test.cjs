const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(process.env.ERGOFLEX_TEST_ROOT||path.join(__dirname,'..'));
const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/mobile-audio-test.html')return res.end('<!doctype html><html><body><main></main><div id="dj"></div><script type="module">import {LedMusicMode} from "./led-music-mode.mjs";window.music=new LedMusicMode(Array(8).fill(14));music.mountControls(document.querySelector("main"));music.mountDJControls(document.querySelector("#dj"));document.querySelector("details").open=true;const frame=Array.from({length:8},()=>new Uint8Array(56));function tick(){music.sample(frame);requestAnimationFrame(tick);}tick();window.ready=true;</script></body></html>');
    const file=path.join(root,decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.setHeader('Content-Type',path.extname(file)==='.mjs'?'text/javascript':path.extname(file)==='.mp3'?'audio/mpeg':'application/octet-stream');fs.createReadStream(file).pipe(res);});
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    try{
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (Linux; Android 16; SM-F946U) Chrome/141 Mobile Safari/537.36'}));
        await page.goto(`http://127.0.0.1:${server.address().port}/mobile-audio-test.html`);await page.waitForFunction(()=>window.ready);
        await page.evaluate(()=>{
            window.permissionResult='ok';window.microphones=[];
            Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:undefined});
            Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
                window.micConstraints=constraints;window.micGesture=navigator.userActivation.isActive;
                if(permissionResult==='denied')throw new DOMException('Denied','NotAllowedError');
                const context=new AudioContext(),oscillator=context.createOscillator(),sink=context.createMediaStreamDestination();
                oscillator.frequency.value=120;oscillator.connect(sink);oscillator.start();await context.resume();
                const stream=sink.stream;microphones.push({stream,context});
                if(permissionResult==='pending')return new Promise(resolve=>window.finishMicrophone=()=>resolve(stream));
                return stream;
            }});music.syncUI();
        });
        assert.equal(await page.$eval('[data-music-share]',b=>b.hidden),true,'Unsupported screen-sharing button is hidden');
        assert.equal(await page.$eval('[data-music-desktop-help]',e=>e.hidden),true);
        assert.equal(await page.$eval('[data-music-mobile-help]',e=>e.hidden),false);
        assert.match(await page.$eval('[data-music-mobile-help]',e=>e.textContent),/cannot share audio from another app/);
        assert.equal(await page.$eval('[data-music-microphone]',b=>b.disabled),false);
        await page.click('[data-music-play]');await page.waitForFunction(()=>music.active&&!music.audio.paused);
        await page.evaluate(()=>permissionResult='denied');await page.click('[data-music-microphone]');await page.waitForFunction(()=>!music.capturePending);
        assert.equal(await page.evaluate(()=>music.active&&!music.audio.paused),true,'Permission denial preserves the playing song');
        assert.match(await page.evaluate(()=>music.error),/Microphone permission was not granted/);
        await page.evaluate(()=>permissionResult='ok');await page.click('[data-music-microphone]');await page.waitForFunction(()=>music.microphoneAudio&&music.active);
        assert.equal(await page.evaluate(()=>micGesture),true);assert.deepEqual(await page.evaluate(()=>micConstraints),{video:false,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        assert.equal(await page.evaluate(()=>music.computerAudio),false,'Microphone is not mislabeled as computer audio');
        assert.equal(await page.evaluate(()=>music.audio.paused&&music.gain.gain.value===0),true,'Microphone has no speaker echo');
        await page.waitForFunction(()=>music.metrics.energy>.05&&music.frame.some(row=>row.some(v=>v>0)));
        assert.match(await page.$eval('[data-music-status]',e=>e.textContent),/Microphone.*listening/);
        assert.equal(await page.$eval('[data-music-seek]',e=>e.closest('label').hidden),true);
        await page.click('[data-dj-start]');await page.waitForFunction(()=>music.dj.enabled&&!music.paused);
        await page.click('[data-music-play]');const paused=await page.evaluate(()=>music.playbackTime);
        await new Promise(resolve=>setTimeout(resolve,120));assert.equal(await page.evaluate(()=>music.playbackTime),paused);
        await page.click('[data-music-play]');await page.waitForFunction(t=>music.playbackTime>t,{},paused);
        await page.click('[data-music-microphone]');assert.equal(await page.evaluate(()=>music.liveAudio||music.active||music.dj.enabled),false);
        assert.equal(await page.evaluate(()=>microphones[0].stream.getTracks().every(t=>t.readyState==='ended')),true);
        await page.evaluate(()=>permissionResult='pending');await page.click('[data-music-microphone]');await page.waitForFunction(()=>typeof finishMicrophone==='function');
        await page.click('[data-music-stop]');await page.evaluate(()=>finishMicrophone());
        await page.waitForFunction(()=>microphones.at(-1).stream.getTracks().every(t=>t.readyState==='ended'));
        assert.equal(await page.evaluate(()=>music.liveAudio||music.active),false,'Late microphone grant cannot revive stopped playback');
        await page.evaluate(()=>permissionResult='ok');await page.click('[data-music-microphone]');await page.waitForFunction(()=>music.microphoneAudio);
        await page.evaluate(()=>{const track=music.captureStream.getAudioTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
        assert.equal(await page.evaluate(()=>music.liveAudio||music.active),false);
        await page.click('[data-music-microphone]');await page.waitForFunction(()=>music.microphoneAudio);
        await page.click('[data-music-demo]');assert.equal(await page.evaluate(()=>microphones.at(-1).stream.getTracks().every(t=>t.readyState==='ended')),true);
        await page.click('[data-music-play]');await page.waitForFunction(()=>music.active&&!music.audio.paused);
        await page.click('[data-music-microphone]');await page.waitForFunction(()=>music.microphoneAudio);
        await page.evaluate(()=>music.dispose());assert.equal(await page.evaluate(()=>microphones.at(-1).stream.getTracks().every(t=>t.readyState==='ended')),true);
        assert.deepEqual(errors,[]);await page.evaluate(()=>Promise.all(microphones.map(m=>m.context.close())));
        console.log('PASS: mobile capability guidance, microphone permission/FFT, no speaker echo, live DJ pause, stop, late grants, source switching and disposal.');
    }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
