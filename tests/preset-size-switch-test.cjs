const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1500,height:1000});
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.5)})};
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();
  const presets=await page.$$eval('[data-preset]',es=>es.map(e=>e.dataset.preset));
  presets.sort((a,b)=>(a==='occ'?-1:b==='occ'?1:0));
  const snapshot=()=>page.evaluate(()=>{
   const ef=ErgoFlex;ef.saveBuildPreset();
   const live=[...ef.workspaceAccessories.items].map(([id,o])=>{let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;return {id,visible,failed:!!o.userData.loadError}});
   return {config:structuredClone(ef.currentConfig),objects:structuredClone(ef.sceneDesks.active.state.objects),live,lights:structuredClone(ef.sceneDesks.active.state.lights),selected:ef.sceneDesks.objects.selected};
  });
  const sameView=(actual,expected,label)=>{for(const key of ['p','t'])actual[key].forEach((v,i)=>assert.ok(Math.abs(v-expected[key][i])<1e-7,label));};
  const check=(actual,expected,label)=>{
   assert.deepEqual(actual.config,expected.config,label+' full configuration is restored');
   assert.deepEqual(actual.objects,expected.objects,label+' object additions, removals and all transforms are restored');
   assert.ok(actual.live.every(o=>o.visible&&!o.failed),label+' accessories remain visible');
   assert.deepEqual(actual.lights,expected.lights,label+' lighting is restored');
  };
  for(const id of presets){
   await page.evaluate(id=>ErgoFlex.applyPreset({id},{size:'60x30'}),id);await ready();
   const accessory=await page.evaluate(()=>[...ErgoFlex.workspaceAccessories.items.keys()].find(id=>id==='wide-monitor')||[...ErgoFlex.workspaceAccessories.items.keys()][0]);
   await page.evaluate(accessory=>{
    const ef=ErgoFlex,e=ef.sceneDesks.objects;
    if(accessory){e.select('accessory-'+accessory);e.change({x:37.5,y:14,z:68,rotation:3.2,scale:93});}
    ef.setLedColor('#336699');ef.setLedGlow(40);ef.saveBuildPreset();
   },accessory);
   const wide=await snapshot();
   await page.select('#size-select','48x30');await ready();
   const seed=await snapshot();
   assert.equal(seed.config.size,'48x30');assert.deepEqual(seed.config.accessories,wide.config.accessories,id+' first narrow recipe keeps selected accessories');
   assert.ok(seed.live.every(o=>o.visible&&!o.failed),id+' seeded accessories are visible');
   if(id==='architect')assert.ok(seed.config.accessories.includes('easel-rail'),'Architect support rail survives in the narrow setup');
   if(id==='artist')assert.equal(await page.evaluate(()=>{const p=ErgoFlex.workspaceAccessories.items.get('artist-easel').getObjectByName('Prop:ergoflex-art-easel');return p.scale.x/p.sizeReferenceScale.x}),.8,'Artist insert fits the narrow width without changing its editable root');
   await page.evaluate(accessory=>{
    const ef=ErgoFlex,e=ef.sceneDesks.objects;
    if(accessory){e.select('accessory-'+accessory);e.change({x:-42.5,y:25,z:96,rotation:-8,scale:107});}
    document.querySelector('[data-material="wood"][data-finish="White Birch"]').click();
    ef.setLedColor('#aa6633');ef.setLedGlow(25);
    if(ef.currentConfig.artwork?.surfaces.desktop?.logo){ef.surfaceArtwork.state.surfaces.desktop.logo.x=19;ef.surfaceArtwork.commit();}
    ef.saveBuildPreset();
   },accessory);
   if(id==='occ')await page.evaluate(async()=>{const e=ErgoFlex.sceneDesks.objects;const added=await e.add('apple','desktop');e.change({x:115,z:45});e.select('accessory-wide-monitor');e.remove();ErgoFlex.saveBuildPreset();return added});
   const narrow=await snapshot();
   await page.select('#size-select','60x30');await ready();check(await snapshot(),wide,id+' 60 inch');
   await page.select('#size-select','48x30');await ready();check(await snapshot(),narrow,id+' 48 inch');
   await page.reload();await ready();assert.equal(await page.evaluate(()=>ErgoFlex.activeBuildPreset),id);check(await snapshot(),narrow,id+' 48 inch reload');
   await page.select('#size-select','60x30');await ready();check(await snapshot(),wide,id+' 60 inch after reload');
   if(id==='occ'){
    const saveView=async mode=>{await page.select('#camera-view',mode);await new Promise(r=>setTimeout(r,800));await page.evaluate(()=>ErgoFlex.savePresetStartingView());return page.evaluate(()=>({p:ErgoFlex.roomInteractions.camera.position.toArray(),t:ErgoFlex.roomInteractions.controls.target.toArray()}))};
    const view60=await saveView('side');await page.select('#size-select','48x30');await ready();const view48=await saveView('top');assert.notDeepEqual(view48,view60);
    await page.select('#size-select','60x30');await ready();sameView(await page.evaluate(()=>({p:ErgoFlex.roomInteractions.camera.position.toArray(),t:ErgoFlex.roomInteractions.controls.target.toArray()})),view60,'OCC 60 inch camera stays independent');
    await page.select('#size-select','48x30');await ready();sameView(await page.evaluate(()=>({p:ErgoFlex.roomInteractions.camera.position.toArray(),t:ErgoFlex.roomInteractions.controls.target.toArray()})),view48,'OCC 48 inch camera stays independent');
   }
   console.log(id+': separate 48 / 60 placements, accessories, colors, artwork, lighting and reload passed');
  }
  // Fresh preview screenshots show the seeded layouts, separate from the
  // deliberate removal and transform experiments above.
  const context=await browser.createBrowserContext(),proof=await context.newPage();
  await proof.setViewport({width:1500,height:1000});proof.setDefaultNavigationTimeout(180000);
  await proof.goto(`http://127.0.0.1:${server.address().port}/?view=product`);
  await proof.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});
  await proof.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(1)});
  fs.mkdirSync(path.join(root,'scene-shots/preset-review'),{recursive:true});
  for(const size of ['60x30','48x30']){
   await proof.evaluate(async size=>{await ErgoFlex.applyPreset({id:'occ'},{size})},size);
   await proof.click('#fit-view');
   await new Promise(r=>setTimeout(r,900));
   await proof.evaluate(()=>ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera));
   await proof.screenshot({path:path.join(root,'scene-shots/preset-review/occ-'+size+'-setup.png')});
  }
  await context.close();
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
