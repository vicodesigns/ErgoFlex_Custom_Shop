const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/test')return res.setHeader('Content-Type','text/html').end(`<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js"}}</script><div id="controls"></div><script type="module">import {LedGameMode} from '/led-game-mode.mjs';window.game=new LedGameMode([14,14,15,14,14,11,11,13]);game.mountControls(document.querySelector('#controls'),{motionEnabled:()=>true,setMotionEnabled:()=>{},sounds:{setEnabled(){},setVolume(){}},startLights:()=>window.started=(window.started||0)+1});document.querySelector('details').open=true;</script>`);
 const file=path.join(root,url.pathname==='/'?'/index.html':url.pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,protocolTimeout:240000,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/test`);await page.waitForFunction(()=>window.game);
 await page.evaluate(()=>{
  window.prepare=async(audio=false)=>{
   const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d');window.paint=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,160,90);};paint('#ff0000');
   const stream=c.captureStream(15);window.testStream=stream;window.testCanvas=c;
   if(audio){window.testAudio=new AudioContext();await testAudio.resume();const dest=testAudio.createMediaStreamDestination(),osc=testAudio.createOscillator();osc.connect(dest);osc.start();stream.addTrack(dest.stream.getAudioTracks()[0]);}
   navigator.mediaDevices.getDisplayMedia=options=>{window.options=options;window.gesture=navigator.userActivation.isActive;return Promise.resolve(stream);};
  };return prepare();
 });
 await page.click('[data-game-share]');await page.waitForFunction(()=>game.active&&game.video.readyState>=2);
 assert.ok(await page.evaluate(()=>gesture),'Picker called from user gesture');
 assert.equal(await page.evaluate(()=>options.selfBrowserSurface),'exclude');
 assert.equal(await page.evaluate(()=>game.video.muted),true);
 const sample=()=>page.evaluate(()=>{const f=game.counts.map(n=>new Uint8Array(n*4));game.sample(f);game.syncUI();return f.map(r=>[...r]);});
 const red=await sample();assert.ok(red[4][0]>100&&red[4][2]<5,'Live video drives LEDs');
 assert.match(await page.$eval('[data-game-status]',e=>e.textContent),/browser lighting approximation/);
 await page.evaluate(()=>{const t=testStream.getVideoTracks()[0];Object.defineProperty(t,'muted',{configurable:true,value:true});t.dispatchEvent(new Event('mute'));});assert.match(await page.$eval('[data-game-status]',e=>e.textContent),/source unavailable/);assert.deepEqual(await sample(),red);await page.evaluate(()=>{const t=testStream.getVideoTracks()[0];Object.defineProperty(t,'muted',{configurable:true,value:false});t.dispatchEvent(new Event('unmute'));});
 await page.select('[data-game-content]','music');await sample();assert.match(await page.$eval('[data-game-status]',e=>e.textContent),/no shared audio/);
 await page.click('[data-game-play]');await page.evaluate(()=>paint('#0000ff'));await new Promise(r=>setTimeout(r,300));assert.deepEqual(await sample(),red,'Pause holds LED frame');
 await page.click('[data-game-play]');await page.evaluate(()=>{paint('#0000ff');testStream.getVideoTracks()[0].requestFrame();});await new Promise(r=>setTimeout(r,500));await sample();await new Promise(r=>setTimeout(r,300));const blue=await sample();assert.ok(blue[4][2]>blue[4][0],'Changed captured picture changes LEDs: '+blue[4].slice(0,4));
 await page.evaluate(()=>{game.maxBrightness=.25;game.video.pause();});const dim=await sample();assert.equal(dim[4][2],Math.round(blue[4][2]*.25));
 await page.click('[data-game-stop]');assert.ok(await page.evaluate(()=>testStream.getTracks().every(t=>t.readyState==='ended')&&!game.captureStream&&!game.video.srcObject));
 await page.evaluate(()=>prepare(true));await page.click('[data-game-share]');await page.waitForFunction(()=>game.active&&game.analyser);await sample();
 assert.match(await page.$eval('[data-game-status]',e=>e.textContent),/shared audio reactive/);
 await page.evaluate(()=>{const t=testStream.getVideoTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));});
 assert.ok(await page.evaluate(()=>!game.active&&testStream.getTracks().every(t=>t.readyState==='ended')&&game.audioContext===null));
 await page.evaluate(()=>testAudio.close());
 // Cancellation leaves the running source intact.
 await page.evaluate(()=>prepare());await page.click('[data-game-share]');await page.waitForFunction(()=>game.active);
 await page.evaluate(()=>{window.prior=game.captureStream;navigator.mediaDevices.getDisplayMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
 await page.click('[data-game-share]');await page.waitForFunction(()=>!game.capturePending);assert.ok(await page.evaluate(()=>game.active&&game.captureStream===prior&&prior.getVideoTracks()[0].readyState==='live'));
 // Stop while the picker is open: late-granted tracks are closed, never activated.
 await page.evaluate(()=>{game.stop();return prepare();});await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=()=>new Promise(r=>window.accept=r);});await page.click('[data-game-share]');
 await page.click('[data-game-stop]');await page.evaluate(()=>accept(testStream));await new Promise(r=>setTimeout(r,100));assert.ok(await page.evaluate(()=>!game.active&&testStream.getTracks().every(t=>t.readyState==='ended')));
 // Reduced motion takes a single picture and holds it, and demo switching releases capture.
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluate(()=>prepare());await page.click('[data-game-share]');await page.waitForFunction(()=>game.active&&game.video.readyState>=2);const held=await sample();
 assert.ok(await page.evaluate(()=>game.video.paused));await page.evaluate(()=>paint('#00ff00'));await new Promise(r=>setTimeout(r,150));assert.deepEqual(await sample(),held);
 assert.ok(await page.evaluate(async()=>{const T=await import('three'),mount=new T.Group(),obj=new T.Group();obj.name='Office monitor';mount.add(obj);const item={obj,saved:{removed:false}};game.syncMonitor({mounts:new Map([['shelf',{group:mount}]]),items:new Map()},[item]);const hidden=!obj.visible&&!!game.monitor.parent;item.saved.removed=true;game.restoreMonitor();return hidden&&!obj.visible&&!game.monitor.parent;}),'Transient monitor cleanup respects deleted desk props');
 await page.click('[data-game-demo]');await page.waitForFunction(()=>game.source==='demo'&&game.bank);assert.ok(await page.evaluate(()=>testStream.getTracks().every(t=>t.readyState==='ended')));
 await page.evaluate(()=>game.dispose());
 if(!process.argv.includes('--capture-only')){
 // Check the real viewer path: ownership, monitor, reflected pixel upload and saved source consent.
 const viewer=await browser.newPage();viewer.on('pageerror',e=>errors.push(e.message));await viewer.setViewport({width:1440,height:1100});
 console.log('Checking full hospital viewer…');await viewer.goto(`http://127.0.0.1:${server.address().port}/?room=hospital&view=room`,{waitUntil:'domcontentloaded'});
 await viewer.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});
 await viewer.evaluate(async()=>{
  await ErgoFlex.workspaceRoom.ready;ErgoFlex.renderer.setPixelRatio(.4);ErgoFlex.renderer.shadowMap.enabled=false;
  const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,160,90);
  window.sharedCanvas=c;window.shared=c.captureStream(15);window.requests=0;window.painter=setInterval(()=>{ctx.fillStyle='#00ff00';ctx.fillRect(0,0,160,90);},70);
  navigator.mediaDevices.getDisplayMedia=()=>{requests++;return Promise.resolve(shared);};
  ErgoFlex.ledMusicMode.active=true;
 });
 await viewer.evaluate(()=>ErgoFlex.prepareLedCommandCenter().open());await viewer.click('[data-ledcc-tab="game"]');
 await viewer.click('.ledcc-game [data-game-share]');
 await viewer.waitForFunction(()=>ErgoFlex.ledGameMode.active&&ErgoFlex.ledGameMode.hasLiveFrame&&ErgoFlex.ledGameMode.monitor?.parent&&ErgoFlex.ledMotionState.source==='game');
 assert.ok(await viewer.evaluate(()=>!ErgoFlex.ledMusicMode.active&&ErgoFlex.ledsEnabled&&ErgoFlex.ledPixelRenderer.active),'Shared screen owns rendered LEDs');
 assert.ok(await viewer.evaluate(()=>{const d=ErgoFlex.ledPixelRenderer.data;return d[1]>d[0]&&d[1]>d[2];}),'Screen colours reached the actual renderer');
 assert.equal(await viewer.evaluate(()=>ErgoFlex.saveCurrentGroovePosition()),true);
 assert.equal(await viewer.evaluate(()=>ErgoFlex.sceneDesks.active.state.phases.morning.lights.game.source),'screen');
 await viewer.screenshot({path:'/tmp/ef-live-screen-preview.png'});console.log('Full viewer capture, monitor and saved settings passed.');
 await viewer.evaluate(()=>{const m=ErgoFlex.sceneDesks,id=m.selected,other=[...m.records.keys()].find(k=>k!==id);m.select(other);m.select(id);});
 assert.ok(await viewer.evaluate(()=>requests===1&&!ErgoFlex.ledGameMode.active&&!ErgoFlex.ledGameMode.captureStream),'Restoring saved screen lights requires fresh permission');
 await viewer.evaluate(()=>{const c=sharedCanvas;window.shared=c.captureStream(15);});await viewer.click('.ledcc-game [data-game-share]');await viewer.waitForFunction(()=>ErgoFlex.ledGameMode.active).catch(async e=>{console.log('Reconnect diagnostic',await viewer.evaluate(()=>({requests,error:ErgoFlex.ledGameMode.error,pending:ErgoFlex.ledGameMode.capturePending,ready:ErgoFlex.ledGameMode.video.readyState,stream:!!ErgoFlex.ledGameMode.captureStream})));throw e;});
 await viewer.evaluate(()=>{clearInterval(painter);window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
 assert.ok(await viewer.evaluate(()=>!ErgoFlex.ledGameMode.active&&shared.getTracks().every(t=>t.readyState==='ended')),'Pagehide releases capture');
 }
 assert.deepEqual(errors,[]);console.log('Screen capture user gesture, video sampling, optional audio/no audio, pause, cap, cancellation, ended cleanup, pending cancellation, reduced motion and demo switch passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
