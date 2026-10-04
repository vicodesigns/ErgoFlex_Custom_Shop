const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const root=path.resolve(__dirname,'..');
const layoutOnly=process.argv.includes('--layout-only');
const server=http.createServer((req,res)=>{const urlPath=new URL(req.url,'http://localhost').pathname;const file=urlPath.startsWith('/wp-content/uploads/2026/promo/ergoflex-demo/')?path.join(root,'divi-editor/site-upload/ergoflex-demo',urlPath.slice('/wp-content/uploads/2026/promo/ergoflex-demo/'.length)):path.join(root,urlPath);fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1200,height:960});
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/product-demo.html');
  await page.waitForFunction(()=>document.querySelector('#demo-remote #motion-dock')?.dataset.sized==='true' && document.querySelector('#loader') && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:90000});
  await page.screenshot({path:'/tmp/ef-product-loaded.png'});
  console.log(await page.evaluate(()=>({shell:document.querySelector('#viewer-shell').getBoundingClientRect().toJSON(),remote:document.querySelector('#motion-dock').getBoundingClientRect().toJSON(),shape:document.querySelector('#motion-dock').dataset.shape,collapsed:document.querySelector('#motion-dock').classList.contains('collapsed')})));
  assert.equal(await page.evaluate(()=>ErgoFlex.roomScene),'product');
  if(!layoutOnly){
  await page.select('#demo-backdrop','led');
  assert.equal(await page.$eval('#viewer-shell',el=>el.dataset.environment),'led');
  assert.ok(await page.evaluate(()=>ErgoFlex.loadedModel.parent.environmentIntensity < .5));
  await page.select('#demo-backdrop','slate');
  assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.size),'60x30');
  assert.equal(await page.$eval('[data-demo-size="60x30"]',el=>el.getAttribute('aria-pressed')),'true');
  assert.equal(await page.evaluate(()=>ErgoFlex.tiltConfigs.find(c=>c.name==='tilting')?.groupEditorIds.length),37);
  assert.deepEqual(await page.evaluate(()=>{
    const rig=ErgoFlex.tiltConfigs.find(c=>c.name==='tilting');
    return rig.groupEditorIds.filter(id=>ErgoFlex.partRegistry.get(id)?.obj.parent!==rig.wrapperGroup);
  }),[]);
  assert.equal(await page.$eval('#motion-dock',el=>el.classList.contains('collapsed')),false);
  assert.equal(await page.$eval('#motion-dock',el=>el.dataset.shape),'landscape');
  assert.equal(await page.$eval('.demo-led-glow',el=>el.textContent.trim()),'Brightness 75%');
  assert.equal(await page.$eval('[data-led-glow]',el=>el.value),'75');
  assert.equal(await page.evaluate(()=>ErgoFlex.ledGlow),92.4375);
  assert.equal(await page.evaluate(()=>ErgoFlex.ledsEnabled),false);
  await page.click('[data-led-toggle]');
  assert.deepEqual(await page.evaluate(()=>[ErgoFlex.ledsEnabled,ErgoFlex.ledGlow]),[true,92.4375]);
  assert.deepEqual(await page.evaluate(()=>ErgoFlex.ledSurfaces),{
    desktopStrength:157,desktopReach:100,desktopWidth:5,desktopCone:100,desktopEdgeFade:46,desktopSharpness:62,shelfStrength:176,shelfReach:98,
    baseStrength:54,baseReach:20,topStrength:143,topReach:77,
    floorStrength:156,floorReach:4,floorWidth:50,floorSharpness:73,leftWingStrength:111,leftWingReach:85,
    rightWingStrength:110,rightWingReach:87
  });
  assert.equal(await page.evaluate(()=>{
    let count=0;ErgoFlex.loadedModel.traverse(object=>{if(object.isRectAreaLight)count++;});
    return count;
  }),0,'LED panel fields must not acquire area lights that create view-dependent seams');
  assert.equal(await page.evaluate(()=>{
    let count=0;ErgoFlex.loadedModel.traverse(object=>{
      if(object.name.endsWith(' LED upright reflection') && object.material.uniforms.strength.value>0)count++;
    });return count;
  }),15,'shelf back, side, and column faces catch the nearby LED strips');
  assert.equal(await page.evaluate(()=>ErgoFlex.ledColor),'#f10404');
  assert.equal(await page.$$('.demo-led-color-stack .led-preset').then(items=>items.length),8);
  await page.click('.demo-led-color-stack [data-led-preset="#ffffff"]');
  assert.equal(await page.evaluate(()=>ErgoFlex.ledColor),'#ffffff');
  await page.click('.demo-led-color-stack [data-led-preset="#fff1d6"]');
  assert.deepEqual(await page.evaluate(()=>[
    ErgoFlex.ledColor,document.querySelector('[data-led-color]').value,
    document.querySelector('.demo-led-color-stack [aria-pressed="true"]')?.dataset.ledPreset
  ]),['#fff1d6','#fff1d6','#fff1d6']);
  await page.click('.demo-led-color-stack [data-led-preset="#f10404"]');
  assert.deepEqual(await page.evaluate(()=>{
    const slider=document.querySelector('[data-led-glow]');
    slider.value='50';slider.dispatchEvent(new Event('input',{bubbles:true}));
    return [ErgoFlex.ledGlow,document.querySelector('[data-led-brightness-value]').value];
  }),[61.625,'50%']);
  await page.click('[data-led-toggle]');
  await page.click('[data-led-toggle]');
  assert.deepEqual(await page.evaluate(()=>[ErgoFlex.ledsEnabled,ErgoFlex.ledGlow]),[true,61.625]);
  await page.$eval('[data-led-glow]',slider=>{slider.value='100';slider.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.ok(await page.evaluate(()=>{
    const viewer=document.querySelector('#viewer-shell').getBoundingClientRect();
    const remote=document.querySelector('#motion-dock').getBoundingClientRect();
    return remote.top>=viewer.bottom && Math.abs(remote.width-viewer.width)<2;
  }));
  assert.equal(await page.$eval('#glide-speed',el=>el.value),'0.204');
  await page.select('#glide-speed','0.034');
  assert.equal(await page.evaluate(()=>ErgoFlex.glideSpeed),0.034);
  await page.select('#glide-speed','0.136');
  assert.equal(await page.evaluate(()=>ErgoFlex.glideSpeed),0.136);
  await page.select('#glide-speed','0.204');
  assert.equal(await page.evaluate(()=>ErgoFlex.glideSpeed),0.204);
  assert.equal(await page.$eval('#lift-speed',el=>el.value),'fast');
  assert.equal(await page.$eval('#tilt-speed',el=>el.value),'fast');
  assert.ok(await page.$eval('#glide-pad',el=>el.getBoundingClientRect().width>50));
  assert.ok(await page.$eval('#desk-height-slider',el=>el.getBoundingClientRect().height>20));
  assert.ok(await page.$eval('#tilt-slider',el=>el.getBoundingClientRect().height>20));
  await page.evaluate(()=>ErgoFlex.setHeight(42));
  assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.heightInches)-42)<.01);
  await page.evaluate(()=>ErgoFlex.setTilt(ErgoFlex.tiltConfigs[0].name,-5));
  assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.tiltConfigs[0].currentDeg)+5)<.01);
  await page.select('#demo-backdrop','warm');
  assert.equal(await page.$eval('#studio-environment',el=>el.value),'warm');
  await page.click('#glide-demo');
  assert.equal(await page.$eval('#glide-demo',el=>el.disabled),false);
  await page.click('#remote-stop');
  }
  assert.ok(await page.evaluate(()=>{
    const dock=document.querySelector('#motion-dock').getBoundingClientRect();
    const stop=document.querySelector('#remote-stop').getBoundingClientRect();
    return stop.left>=dock.left && stop.right<=dock.right && document.querySelector('#demo-remote').scrollLeft===0;
  }));
  await page.screenshot({path:'/tmp/ef-product-desktop.png'});
  console.log('Desktop viewer and app meet directly; controls stay inside the panel.');
  await page.setViewport({width:390,height:740});
  await page.waitForFunction(()=>document.querySelector('#motion-dock')?.dataset.shape==='landscape');
  await new Promise(r=>setTimeout(r,2500));
  await page.screenshot({path:'/tmp/ef-product-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.querySelector('#motion-dock').getBoundingClientRect().top>=document.querySelector('#viewer-shell').getBoundingClientRect().bottom));
  assert.ok(await page.evaluate(()=>{
    const scroller=document.querySelector('#demo-remote');
    const dock=document.querySelector('#motion-dock').getBoundingClientRect();
    const tilt=document.querySelector('[data-motion-panel="tilt"]').getBoundingClientRect();
    const slot=scroller.getBoundingClientRect();
    return document.querySelector('#motion-dock').offsetWidth===760 && dock.left>=slot.left && dock.right<=slot.right+1 && tilt.right<=slot.right+1 && !document.querySelector('#demo-control-size');
  }));
  assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('#demo-remote').getBoundingClientRect().top-document.querySelector('#viewer-shell').getBoundingClientRect().bottom)<.01));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('390px phone layout fits the complete app without the old toolbar.');
  await page.setViewport({width:320,height:740});
  await page.waitForFunction(()=>document.querySelector('#motion-dock')?.dataset.shape==='landscape');
  await new Promise(r=>setTimeout(r,2500));
  await page.screenshot({path:'/tmp/ef-product-320.png',fullPage:true});
  assert.ok(await page.evaluate(()=>{
    const slot=document.querySelector('#demo-remote').getBoundingClientRect();
    const dock=document.querySelector('#motion-dock').getBoundingClientRect();
    return dock.width<=slot.width+1 && dock.right<=slot.right+1 && document.documentElement.scrollWidth<=innerWidth;
  }));
  assert.deepEqual(errors,[]);
  console.log('320px layout fits without horizontal overflow.');
  await page.goto(base+'/divi-editor/ergoflex-demos.html');
  assert.equal(await page.$eval('.ef-product-frame',el=>el.hasAttribute('src')),false);
  await page.click('.ef-load-demo');
  assert.equal(await page.$eval('.ef-product-frame',el=>el.src),base+'/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html?v=apple-taps-handoff-fix-20260930');
  assert.equal(await page.$eval('.ef-product-frame',el=>el.hidden),false);
  await page.waitForFunction(()=>document.querySelector('.ef-product-frame')?.contentDocument?.querySelector('#demo-remote #motion-dock')?.dataset.sized==='true',{timeout:90000});
  assert.ok(await page.$eval('.ef-product-frame',el=>el.getBoundingClientRect().height>=el.contentDocument.querySelector('#event-demo').getBoundingClientRect().height));
  const missing=[];
  page.on('response',res=>{if(res.url().startsWith(base+'/divi-editor/site-upload/ergoflex-demo/') && res.status()>=400)missing.push(`${res.status()} ${res.url()}`);});
  await page.goto(base+'/divi-editor/site-upload/ergoflex-demo/product-demo.html');
  await page.waitForFunction(()=>document.querySelector('#demo-remote #motion-dock')?.dataset.sized==='true',{timeout:90000});
  assert.deepEqual(missing,[]);
  console.log('Product model, ErgoFlex app remote, lift, tilt, glide, backdrop, and mobile layout passed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
