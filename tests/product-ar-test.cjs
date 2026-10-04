const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const embedded = process.argv.includes('--embedded');
const appOnly = process.argv.includes('--app-only');
console.log('Starting AR viewer check');
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname === '/ar-embed-test.html'){
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><iframe id=viewer src="/product-demo.html" allow="fullscreen; xr-spatial-tracking" style="width:100%;height:2200px;border:0"></iframe>');return;
  }
  fs.readFile(path.join(root,pathname), (error,body) => {
    if(error){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[path.extname(pathname)] || 'application/octet-stream');
    res.end(body);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  console.log('Local server ready');
  const browser = await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const browserPage = await browser.newPage();
    let page = browserPage;
    const errors = [];
    const modelRequests = [];
    browserPage.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
    browserPage.on('pageerror',error => errors.push(error.message));
    await browserPage.setViewport(embedded ? {width:390,height:800} : {width:1366,height:1050});
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('ergoflex.ergoFormsV2',JSON.stringify({v:2,forms:[
        {name:'Sitting',lift:28,tilt:0}, {name:'My standing',lift:43,tilt:3}, {name:'Easel',lift:52,tilt:65}
      ]}));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/${embedded ? 'ar-embed-test.html' : 'product-demo.html'}`);
    if(embedded){
      await page.waitForSelector('#viewer');
      page = await (await page.$('#viewer')).contentFrame();
    }
    await page.waitForFunction(() => document.querySelector('[data-ar-launch]')?.disabled === false,{timeout:90000});
    if(appOnly)await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;});
    assert.ok(Math.abs(await page.evaluate(() => ErgoFlex.heightInches)-43.5)<.01,'Demo starts Standing');
    assert.ok(Math.abs(await page.evaluate(() => ErgoFlex.tiltConfigs[0].currentDeg)+5)<.01,'Standing starts at -5 degrees');
    assert.ok(modelRequests.some(url=>url.includes('/assets/model/desk-public.glb')));
    assert.ok(!modelRequests.some(url=>url.includes('/Store/model/full.glb')),'Do not download the original plates');
    assert.deepEqual(await page.evaluate(()=>['Plates_Hardware_290','Plates_Hardware_291'].map(name=>{
      const mesh=[...ErgoFlex.partRegistry.values()].find(entry=>entry.obj.name===name)?.obj;
      return {name,vertices:mesh?.geometry.attributes.position.count,visible:mesh?.visible};
    })),[
      {name:'Plates_Hardware_290',vertices:563,visible:true},
      {name:'Plates_Hardware_291',vertices:563,visible:true}
    ],'Both original plate meshes are replaced, retaining stable names');
    assert.equal(await page.$('.demo-app-tools'),null);
    assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('#demo-viewer').getBoundingClientRect().bottom-document.querySelector('#demo-remote').getBoundingClientRect().top)<.01),'Controls meet viewer without a toolbar or gap');
    assert.equal(await page.evaluate(()=>ErgoFlex.glideSpeed),.306);
    assert.deepEqual(await page.$$eval('[data-preset-bank="lift"] .preset-number',elements=>elements.map(el=>el.textContent)),['1','2','3']);
    assert.equal(await page.$eval('[data-preset-bank="lift"] .preset-value',el=>getComputedStyle(el).display),'none');
    const chipSelector='[data-preset-bank="lift"] [data-slot="0"]';
    const beforeSwipe=await page.evaluate(()=>ErgoFlex.heightInches);
    const revealed=await page.$eval(chipSelector,chip=>{
      chip.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:55,clientX:100,clientY:100,bubbles:true}));
      chip.dispatchEvent(new PointerEvent('pointermove',{pointerId:55,clientX:100,clientY:80,bubbles:true}));
      chip.dispatchEvent(new PointerEvent('pointerup',{button:0,pointerId:55,clientX:100,clientY:80,bubbles:true}));
      return {revealed:chip.dataset.revealed,value:chip.querySelector('.preset-value').textContent,display:getComputedStyle(chip.querySelector('.preset-value')).display};
    });
    assert.equal(revealed.revealed,'true');
    assert.equal(revealed.value,'28″');
    assert.notEqual(revealed.display,'none');
    await new Promise(resolve=>setTimeout(resolve,650));
    assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.heightInches)-beforeSwipe)<.01,'Swiping reveals without recalling or overwriting a pose');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ergoflex.liftPresetsV1')),null);
    await page.waitForFunction(selector=>document.querySelector(selector).dataset.revealed==='false',{timeout:4000},chipSelector);
    console.log('Edited plates, contiguous viewer/app, faster Slow and numbered swipe presets passed');
    const size=await page.evaluate(()=>ErgoFlex.arSize);
    assert.equal(size.nominalWidth,60);assert.equal(size.widthInches,60);
    assert.ok(Math.abs(size.widthUnits*size.metersPerUnit/.0254-60)<1e-6,'Physical desktop width matches the selected size');
    console.log('Checking first LED backdrop cycle');
    await page.focus('.hub-led');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');
    await page.click('[data-led-toggle]');
    assert.equal(await page.$eval('#demo-backdrop',el=>el.value),'led');
    await page.click('[data-led-toggle]');
    assert.equal(await page.$eval('#demo-backdrop',el=>el.value),'slate');
    await page.select('#demo-backdrop','warm');
    await page.click('[data-led-toggle]');
    await page.click('[data-led-toggle]');
    assert.equal(await page.$eval('#demo-backdrop',el=>el.value),'warm');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ergoflex.demoFirstLedBackdropV1')),'done');
    await page.click('[data-ledcc-close]');
    console.log('Checking Sitting preset');
    await page.click('[data-form="0"]');
    await page.waitForFunction(() => Math.abs(ErgoFlex.tiltConfigs[0].currentDeg)<.01 && Math.abs(ErgoFlex.heightInches-28)<.01,{timeout:30000});
    assert.ok(Math.abs(await page.evaluate(() => ErgoFlex.heightInches)-28)<.01);
    await page.click('[data-form="1"]');
    await page.waitForFunction(() => Math.abs(ErgoFlex.tiltConfigs[0].currentDeg - 3)<.01 && Math.abs(ErgoFlex.heightInches-43)<.01,{timeout:25000});
    await page.click('[data-form="0"]');
    await page.waitForFunction(() => Math.abs(ErgoFlex.heightInches-28)<.01,{timeout:25000});
    // Desktop fallback must remain visible despite the simplified viewer's body CSS.
    await page.click('[data-ar-launch]');
    await page.waitForSelector('#ar-help-modal',{visible:true});
    assert.match(await page.$eval('#ar-help-message',el => el.textContent),/compatible phone or tablet/);
    await browserPage.keyboard.press('Escape');
    assert.equal(await page.$('#ar-help-modal'),null);
    // Exercise the real GLB exporter and model-viewer parser, without opening a device AR session.
    let exported;
    if(!appOnly){
    console.log('Exporting configured AR model');
    exported = await page.evaluate(async () => {
      const {modelViewer,bytes} = await ErgoFlex.prepareARModel();
      const buffer = await (await fetch(modelViewer.src)).arrayBuffer();
      const view = new DataView(buffer);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))));
      window.arTestViewer = modelViewer;
      return {bytes,magic:view.getUint32(0,true),nodes:json.nodes.length,
        browserFields:json.nodes.filter(node => / LED .*reflection$| LED reflection$/.test(node.name || '')).length,
        modes:modelViewer.getAttribute('ar-modes'),scale:modelViewer.getAttribute('ar-scale'),display:getComputedStyle(modelViewer).display,loading:modelViewer.getAttribute('loading')};
    });
    console.log('AR model loaded',exported);
    assert.equal(exported.magic,0x46546c67);
    assert.ok(exported.bytes>100000);
    assert.ok(exported.nodes>600);
    assert.equal(exported.browserFields,0);
    assert.equal(exported.modes,'webxr quick-look');
    assert.equal(exported.scale,'fixed');
    assert.equal(exported.loading,'eager');
    assert.notEqual(exported.display,'none');
    // Simulate device capability only; use real export/load for the preparation step.
    await page.evaluate(() => {
      Object.defineProperty(navigator,'xr',{configurable:true,value:undefined});
      const supports=DOMTokenList.prototype.supports;
      DOMTokenList.prototype.supports=function(token){return token==='ar' || supports.call(this,token);};
      Object.defineProperty(arTestViewer,'canActivateAR',{configurable:true,value:true});
      arTestViewer.activateAR = async () => {window.arTestGesture = navigator.userActivation.isActive;};
    });
    await page.click('[data-ar-launch]');
    await page.waitForSelector('#ar-place-button',{visible:true,timeout:150000});
    assert.equal(await page.evaluate(() => window.arTestGesture),undefined,'Preparation must not activate AR');
    if(embedded)await page.$eval('#ar-place-button',button => button.click());
    else await page.click('#ar-place-button');
    await page.waitForFunction(() => window.arTestGesture !== undefined);
    if(!embedded)assert.equal(await page.evaluate(() => window.arTestGesture),true,'Placement must receive a fresh user gesture');
    assert.equal(await page.$('#ar-help-modal'),null);
    }
    console.log('Checking original ErgoFlex app controls in WebXR and repeated sessions');
    await page.evaluate(() => {
      window.arOriginalParent = ErgoFlex.loadedModel.parent;
      window.arOriginalApp = document.getElementById('motion-dock');
      window.arOriginalAppParent = arOriginalApp.parentElement;
      window.arOriginalSetSession = ErgoFlex.renderer.xr.setSession;
      window.arOriginalShadows = ErgoFlex.renderer.shadowMap.enabled;
      ErgoFlex.renderer.xr.setSession = async () => {};
      Object.defineProperty(navigator,'xr',{configurable:true,value:{
        isSessionSupported:async () => true,
        requestSession:async (mode,options) => {
          window.arNativeGesture=navigator.userActivation.isActive;
          window.arNativeOptions={mode,features:options.requiredFeatures,overlay:options.domOverlay.root.id};
          return {requestReferenceSpace:async () => ({}),requestHitTestSource:async () => ({cancel(){}}),
            end:async () => ErgoFlex.renderer.xr.dispatchEvent({type:'sessionend'})};
        }
      }});
    });
    for(let launch=0;launch<2;launch++){
      // Test the reported failing configuration: a raised, tilted desk with LEDs.
      await page.evaluate(() => {ErgoFlex.setHeight(52);ErgoFlex.setTilt('tilting',65);ErgoFlex.setLedsEnabled(true);});
      await page.click('[data-ar-launch]');
      await page.waitForSelector('#ar-place-button',{visible:true});
      if(embedded) await page.$eval('#ar-place-button',button=>button.click());
      else await page.click('#ar-place-button');
      await page.waitForFunction(()=>ErgoFlex.arState.active);
      const native=await page.evaluate(()=>({gesture:arNativeGesture,options:arNativeOptions,original:ErgoFlex.loadedModel.parent===arOriginalParent,shadow:ErgoFlex.renderer.shadowMap.enabled}));
      if(!embedded) assert.equal(native.gesture,true);
      assert.deepEqual(native.options,{mode:'immersive-ar',features:['hit-test','dom-overlay'],overlay:'ef-ar-overlay'});
      assert.equal(native.original,false);
      assert.equal(native.shadow,false);
      assert.notEqual(await page.$eval('#ef-ar-overlay',el=>getComputedStyle(el).display),'none');
      assert.equal(await page.evaluate(()=>document.querySelector('#ef-ar-overlay #motion-dock')===arOriginalApp),true,'Move the real app rather than duplicating it');
      await page.$eval('#ef-ar-overlay .hub-led',button=>button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true})));
      assert.ok(await page.$('#ef-ar-overlay #led-command-center [data-game-play]'),'Command Center opens inside the WebXR DOM overlay');
      await page.$eval('[data-ledcc-close]',button=>button.click());
      await page.$eval('[data-ar-width]',el=>{el.value='62';});
      await page.$eval('[data-ar-size-apply]',el=>el.click());
      assert.equal(await page.evaluate(()=>ErgoFlex.arSize.widthInches),62);
      const arWidth=await page.evaluate(()=>ErgoFlex.arSize);
      assert.ok(Math.abs(arWidth.widthUnits*arWidth.metersPerUnit/.0254-62)<1e-6);
      assert.equal(await page.evaluate(()=>localStorage.getItem('ergoflex.arWidthV1.60x30')),'62');
      await page.$eval('[data-ar-size-reset]',el=>el.click());
      assert.equal(await page.evaluate(()=>ErgoFlex.arSize.widthInches),60);
      await page.$eval('#ef-ar-overlay #tilt-value',el=>{el.value='10';el.dispatchEvent(new Event('change'));});
      await page.waitForFunction(()=>Math.abs(ErgoFlex.tiltConfigs[0].currentDeg-10)<.01,{timeout:25000});
      await page.$eval('#ef-ar-overlay #desk-height-display',el=>{el.value='48';el.dispatchEvent(new Event('change'));});
      await page.waitForFunction(()=>Math.abs(ErgoFlex.heightInches-48)<.01,{timeout:25000});
      await page.$eval('#ef-ar-overlay .hub-led',button=>button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true})));
      await page.$eval('#ef-ar-overlay [data-led-toggle]',el=>el.click());
      assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),false);
      await page.$eval('#ef-ar-overlay [data-led-color]',el=>{el.value='#22ccff';el.dispatchEvent(new Event('input'));});
      assert.equal(await page.evaluate(()=>ErgoFlex.ledColor),'#22ccff');
      await page.$eval('[data-ledcc-close]',button=>button.click());
      // The original compass keyboard gesture must move the AR desk and spin wheels.
      const beforeGlide=await page.evaluate(()=>({position:ErgoFlex.glidePosition,spins:ErgoFlex.wheelRigs.map(r=>r.spin)}));
      await page.focus('#ef-ar-overlay #glide-pad');
      await browserPage.keyboard.down('ArrowRight');
      await page.waitForFunction(before=>Math.hypot(ErgoFlex.glidePosition.x-before.x,ErgoFlex.glidePosition.z-before.z)>.01,{},beforeGlide.position);
      await browserPage.keyboard.up('ArrowRight');
      const afterGlide=await page.evaluate(()=>({position:ErgoFlex.glidePosition,spins:ErgoFlex.wheelRigs.map(r=>r.spin)}));
      assert.ok(afterGlide.position.z<beforeGlide.position.z,'AR right uses the fixed placement floor direction');
      assert.ok(Math.abs(afterGlide.position.x-beforeGlide.position.x)<1e-8);
      assert.ok(afterGlide.spins.some((spin,i)=>spin!==beforeGlide.spins[i]),'AR Glide spins the existing wheel rigs');
      const beforeYaw=await page.evaluate(()=>ErgoFlex.deskYaw);
      await page.$eval('#ef-ar-overlay #glide-pad',pad=>{
        const box=pad.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2,r=box.width*.43;
        pad.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:7,bubbles:true,clientX:x+r,clientY:y}));
        pad.dispatchEvent(new PointerEvent('pointermove',{button:0,pointerId:7,bubbles:true,clientX:x+r*Math.cos(.3),clientY:y+r*Math.sin(.3)}));
      });
      await page.waitForFunction(before=>Math.abs(ErgoFlex.deskYaw-before)>.005,{},beforeYaw);
      await page.$eval('#ef-ar-overlay #glide-pad',button=>button.dispatchEvent(new PointerEvent('pointerup',{button:0,pointerId:7,bubbles:true})));
      await page.$eval('#ef-ar-overlay #remote-stop',button=>button.click());
      assert.equal(await page.evaluate(()=>ErgoFlex.yawCommand),0);
      if(launch===0&&!embedded){
        await browserPage.setViewport({width:390,height:800});
        await page.waitForFunction(()=>document.querySelector('#glide-pad').getBoundingClientRect().right<innerWidth);
        assert.ok(await page.$eval('#ef-ar-overlay #tilt-value',el=>el.getBoundingClientRect().right<=innerWidth));
        await browserPage.screenshot({path:'/tmp/ef-ar-app-reused-mobile.png'});
        await browserPage.setViewport({width:1366,height:1050});
      }
      if(launch===1)await page.$eval('#ef-ar-overlay .hub-led',button=>button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true})));
      await page.$eval('[data-ar-exit]',el=>el.click());
      await page.waitForFunction(()=>!ErgoFlex.arState.active);
      assert.equal(await page.evaluate(()=>ErgoFlex.loadedModel.parent===arOriginalParent),true);
      assert.equal(await page.evaluate(()=>ErgoFlex.renderer.shadowMap.enabled===arOriginalShadows),true,'AR restores the prior shadow setting');
      assert.equal(await page.$('#ef-ar-overlay'),null);
      assert.equal(await page.evaluate(()=>document.getElementById('motion-dock')===arOriginalApp && arOriginalApp.parentElement===arOriginalAppParent),true);
      assert.ok(await page.$('body>#led-command-center [data-led-color]'),'Command Center returns to the normal viewer');
      assert.equal(await page.$eval('#led-command-center',el=>el.hidden),true);
    }
    await page.evaluate(()=>{
      ErgoFlex.renderer.xr.setSession=arOriginalSetSession;
      Object.defineProperty(navigator,'xr',{configurable:true,value:undefined});
    });
    await browserPage.setViewport({width:390,height:800});
    assert.ok(await page.$eval('[data-ar-launch]',el => {
      const rect=el.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth;
    }));
    if(!appOnly){
    await page.click('[data-ar-launch]');
    await page.waitForSelector('#ar-place-button',{visible:true,timeout:150000});
    await browserPage.screenshot({path:'/tmp/ef-product-ar-mobile.png',fullPage:true});
    await browserPage.keyboard.press('Escape');
    }
    for(const name of ['tech-week-divi-code-module.html','ergoflex-demos.html','ergoflex-editor.html']){
      assert.match(fs.readFileSync(path.join(root,'divi-editor',name),'utf8'),/class="ef-product-frame"[^>]*allow="fullscreen; xr-spatial-tracking"/);
    }
    assert.deepEqual(errors,[]);
    console.log(embedded ? 'Embedded hidden AR loading passed.' : 'Standalone AR loading passed.');
    console.log(appOnly ? 'Standing startup, first LED backdrop cycle, original AR app, Glide and wheel spin, compass turning, pose controls, LEDs and repeated sessions passed.' : 'Sitting 0°, saved poses, real GLB export/load, AR gesture handoff and original AR app controls passed.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;server.close();});
