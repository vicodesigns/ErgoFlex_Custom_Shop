const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(process.env.ERGOFLEX_TEST_ROOT||path.join(__dirname,'..'));
const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/capture-test.html')return res.end('<!doctype html><html><body><main id="controls"></main><div id="dj"></div><script type="module">import {LedMusicMode} from "./led-music-mode.mjs";window.music=new LedMusicMode(Array(8).fill(32));music.mountControls(document.querySelector("main"),()=>window.started=(window.started||0)+1);music.mountDJControls(document.querySelector("#dj"));document.querySelector("details").open=true;const frame=Array.from({length:8},()=>new Uint8Array(128));function tick(){music.sample(frame);requestAnimationFrame(tick);}tick();window.ready=true;</script></body></html>');
    const file=path.join(root,decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.setHeader('Content-Type',path.extname(file)==='.mjs'?'text/javascript':path.extname(file)==='.mp3'?'audio/mpeg':'application/octet-stream');fs.createReadStream(file).pipe(res);});
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    try{
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/capture-test.html`);await page.waitForFunction(()=>window.ready);
        await page.evaluate(()=>{
            window.captures=[];window.permissionResult='ok';
            Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,writable:true,value:async options=>{
                window.shareOptions=options;window.shareGesture=navigator.userActivation.isActive;
                if(permissionResult==='denied')throw new DOMException('Denied','NotAllowedError');
                const context=new AudioContext(),oscillator=context.createOscillator(),destination=context.createMediaStreamDestination();
                oscillator.frequency.value=120;oscillator.connect(destination);oscillator.start();await context.resume();
                const canvas=document.createElement('canvas'),video=canvas.captureStream(1).getVideoTracks()[0];
                const stream=new MediaStream(permissionResult==='noaudio'?[video]:[...destination.stream.getAudioTracks(),video]);
                const capture={stream,context,oscillator};captures.push(capture);
                if(permissionResult==='pending')return new Promise(resolve=>window.finishShare=()=>resolve(stream));
                return stream;
            }});
        });
        const share=()=>page.click('[data-music-share]');
        await page.click('[data-music-play]');await page.waitForFunction(()=>music.active&&!music.audio.paused);
        await page.evaluate(()=>permissionResult='denied');await share();await page.waitForFunction(()=>!music.capturePending);
        assert.equal(await page.evaluate(()=>music.active&&!music.audio.paused),true,'First permission denial preserves file playback');
        await page.evaluate(()=>permissionResult='ok');
        await share();await page.waitForFunction(()=>music.computerAudio&&music.active);
        assert.equal(await page.evaluate(()=>shareGesture),true,'Capture request keeps the click gesture');
        assert.equal(await page.evaluate(()=>shareOptions.systemAudio),'include');
        assert.equal(await page.evaluate(()=>shareOptions.audio.suppressLocalAudioPlayback),false,'Original speakers stay enabled');
        await page.waitForFunction(()=>music.metrics.energy>.05&&music.frame.some(row=>row.some(v=>v>0)));
        assert.equal(await page.evaluate(()=>music.audio.paused),true,'File playback is stopped for capture');
        assert.equal(await page.evaluate(()=>music.gain.gain.value),0,'Captured audio is never replayed');
        assert.equal(await page.evaluate(()=>captures[0].stream.getVideoTracks()[0].enabled),false,'Video is unused and disabled');
        assert.equal(await page.$eval('[data-music-seek]',el=>el.closest('label').hidden),true,'Live audio has no seek control');
        await page.click('[data-dj-start]');await page.waitForFunction(()=>music.dj.enabled&&!music.paused);
        assert.ok(await page.evaluate(()=>music.playbackTime>0),'DJ uses the live clock');
        await page.click('[data-music-play]');const pausedTime=await page.evaluate(()=>music.playbackTime);
        await new Promise(r=>setTimeout(r,200));assert.equal(await page.evaluate(()=>music.playbackTime),pausedTime,'Pause holds live DJ clock');
        await page.click('[data-music-play]');await page.waitForFunction(t=>music.playbackTime>t,{},pausedTime);
        await page.click('[data-music-stop]');
        assert.equal(await page.evaluate(()=>music.computerAudio||music.active||music.dj.enabled),false);
        assert.ok(await page.evaluate(()=>captures[0].stream.getTracks().every(t=>t.readyState==='ended')),'Stop releases audio and video');
        assert.equal(await page.$eval('[data-music-seek]',el=>el.closest('label').hidden),false);
        // A denial or missing audio preserves the already playing local source.
        await page.click('[data-music-play]');await page.waitForFunction(()=>music.active&&!music.audio.paused);
        await page.evaluate(()=>permissionResult='denied');await share();await page.waitForFunction(()=>!music.capturePending);
        assert.equal(await page.evaluate(()=>music.active&&!music.audio.paused),true);
        assert.match(await page.evaluate(()=>music.error),/cancelled or not allowed/);
        await page.evaluate(()=>permissionResult='noaudio');await share();await page.waitForFunction(()=>!music.capturePending);
        assert.match(await page.evaluate(()=>music.error),/No audio was shared/);
        assert.ok(await page.evaluate(()=>captures.at(-1).stream.getTracks().every(t=>t.readyState==='ended')),'No-audio failure releases screen');
        // Stop while the browser picker is pending: a late grant must be discarded.
        await page.evaluate(()=>permissionResult='pending');await share();await page.waitForFunction(()=>typeof finishShare==='function');
        await page.click('[data-music-stop]');await page.evaluate(()=>finishShare());
        await page.waitForFunction(()=>captures.at(-1).stream.getTracks().every(t=>t.readyState==='ended'));
        assert.equal(await page.evaluate(()=>music.computerAudio||music.active),false);
        await page.evaluate(()=>permissionResult='ok');await share();await page.waitForFunction(()=>music.computerAudio);
        await page.evaluate(()=>{const track=music.captureStream.getAudioTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
        assert.equal(await page.evaluate(()=>music.computerAudio||music.active),false,'Browser Stop sharing cleans up');
        assert.ok(await page.evaluate(()=>captures.at(-1).stream.getTracks().every(t=>t.readyState==='ended')));
        await share();await page.waitForFunction(()=>music.computerAudio);await page.click('[data-music-demo]');
        assert.ok(await page.evaluate(()=>captures.at(-1).stream.getTracks().every(t=>t.readyState==='ended')),'Demo switching releases capture');
        await share();await page.waitForFunction(()=>music.computerAudio);await page.evaluate(()=>music.dispose());
        assert.ok(await page.evaluate(()=>captures.at(-1).stream.getTracks().every(t=>t.readyState==='ended')),'Disposal releases capture');
        const userAgent=await page.evaluate(()=>navigator.userAgent);
        await page.evaluate(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:'ChatGPT Electron/38'}));
        await share();assert.match(await page.evaluate(()=>music.error),/desktop Chrome/,'Embedded app receives guidance rather than opening its crashing picker');
        await page.evaluate(ua=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:ua}),userAgent);
        await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=undefined;music.useComputerAudio();});
        assert.match(await page.evaluate(()=>music.error),/unavailable here/);
        assert.deepEqual(errors,[]);await page.evaluate(()=>Promise.all(captures.map(c=>c.context.close())));
        console.log('Computer audio: real stream FFT, live DJ clock/pause, no speaker echo, permission denial/no-audio, late grants, browser stop, source switching and disposal pass. Native picker/system loopback availability is device-dependent.');
    }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
