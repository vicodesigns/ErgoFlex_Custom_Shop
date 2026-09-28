const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const root=path.resolve(__dirname,'..');
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
  assert.equal(await page.evaluate(()=>ErgoFlex.tiltConfigs.find(c=>c.name==='tilting')?.groupEditorIds.length),32);
  assert.deepEqual(await page.evaluate(()=>{
    const rig=ErgoFlex.tiltConfigs.find(c=>c.name==='tilting');
    return rig.groupEditorIds.filter(id=>ErgoFlex.partRegistry.get(id)?.obj.parent!==rig.wrapperGroup);
  }),[]);
  assert.equal(await page.$eval('#motion-dock',el=>el.classList.contains('collapsed')),false);
  assert.equal(await page.$eval('#motion-dock',el=>el.dataset.shape),'landscape');
  assert.ok(await page.evaluate(()=>{
    const viewer=document.querySelector('#viewer-shell').getBoundingClientRect();
    const remote=document.querySelector('#motion-dock').getBoundingClientRect();
    return remote.top>=viewer.bottom && Math.abs(remote.width-viewer.width)<2;
  }));
  assert.equal(await page.$eval('#lift-speed',el=>el.value),'fast');
  assert.equal(await page.$eval('#tilt-speed',el=>el.value),'fast');
  assert.ok(await page.$eval('#glide-pad',el=>el.getBoundingClientRect().width>50));
  assert.ok(await page.$eval('#desk-height-slider',el=>el.getBoundingClientRect().height>20));
  assert.ok(await page.$eval('#tilt-slider',el=>el.getBoundingClientRect().height>20));
  await page.evaluate(()=>ErgoFlex.setHeight(42));
  assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.heightInches)-42)<.01);
  await page.evaluate(()=>ErgoFlex.setTilt(ErgoFlex.tiltConfigs[0].name,-10));
  assert.ok(Math.abs(await page.evaluate(()=>ErgoFlex.tiltConfigs[0].currentDeg+10)<.01));
  await page.select('#demo-backdrop','warm');
  assert.equal(await page.$eval('#studio-environment',el=>el.value),'warm');
  await page.click('#glide-demo');
  assert.equal(await page.$eval('#glide-demo',el=>el.disabled),false);
  await page.click('#remote-stop');
  assert.ok(await page.evaluate(()=>{
    const dock=document.querySelector('#motion-dock').getBoundingClientRect();
    const stop=document.querySelector('#remote-stop').getBoundingClientRect();
    return stop.left>=dock.left && stop.right<=dock.right && document.querySelector('#demo-remote').scrollLeft===0;
  }));
  await page.screenshot({path:'/tmp/ef-product-desktop.png'});
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
    return document.querySelector('#motion-dock').offsetWidth===760 && dock.left>=slot.left && dock.right<=slot.right+1 && tilt.right<=slot.right+1 && document.querySelector('#demo-control-size').textContent==='View larger';
  }));
  await page.click('#demo-control-size');
  assert.ok(await page.evaluate(()=>{
    const slot=document.querySelector('#demo-remote');
    return slot.scrollWidth>slot.clientWidth && document.querySelector('#motion-dock').dataset.shape==='landscape';
  }));
  await page.$eval('#demo-remote',el=>{el.scrollLeft=el.scrollWidth;});
  assert.ok(await page.evaluate(()=>{
    const scroller=document.querySelector('#demo-remote').getBoundingClientRect();
    const tilt=document.querySelector('[data-motion-panel="tilt"]').getBoundingClientRect();
    return tilt.left>=scroller.left && tilt.right<=scroller.right+1;
  }));
  await page.screenshot({path:'/tmp/ef-product-mobile-scrolled.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.querySelector('#demo-remote').scrollLeft>0));
  await page.click('#demo-control-size');
  assert.ok(await page.evaluate(()=>document.querySelector('#motion-dock').getBoundingClientRect().right<=document.querySelector('#demo-remote').getBoundingClientRect().right+1));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
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
  await page.goto(base+'/divi-editor/ergoflex-demos.html');
  assert.equal(await page.$eval('.ef-product-frame',el=>el.hasAttribute('src')),false);
  await page.click('.ef-load-demo');
  assert.equal(await page.$eval('.ef-product-frame',el=>el.src),base+'/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html');
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
