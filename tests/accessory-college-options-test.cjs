const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1600,height:1100});
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.75);ErgoFlex.workspaceAccessories.update()})};
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await ready();
  const ids=['ergo-keyboard','logitech-mx-master','keyboard-tray'];
  const poses=await page.evaluate(ids=>ids.map(id=>ErgoFlex.workspaceAccessories.items.get(id).position.toArray()),ids);
  await page.click('[data-accessory-category="Selected"]');
  for(const id of ids)await page.select('#accessory-finish-'+id,'white');
  const state=await page.evaluate(ids=>{
   const w=ErgoFlex.workspaceAccessories,pad=w.items.get('logitech-mx-master').getObjectByName('Mouse pad');
   return {finishes:ErgoFlex.currentConfig.accessoryFinishes,poses:ids.map(id=>w.items.get(id).position.toArray()),colors:ids.map(id=>w.items.get(id).finishMaterials.map(m=>m.mat.color.getHexString())),pad:{rotation:pad.rotation.y,color:pad.children[1].material.color.getHexString()}};
  },ids);
  assert.deepEqual(state.poses,poses,'finish edits preserve owner accessory placements');for(const id of ids)assert.equal(state.finishes[id],'white');assert.ok([state.colors[0],state.colors[2]].flat().every(c=>c==='ebede9'),'keyboard and tray get white finishes');
  const mouse=await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('logitech-mx-master').finishMaterials.map(({mat,role})=>({role,color:mat.color.getHexString(),metal:mat.metalness})));
  assert.ok(mouse.some(m=>m.role==='MX shell graphite'&&m.color==='ebede9'));assert.ok(mouse.some(m=>m.role==='MX roller steel'&&m.metal>.9&&m.color!=='ebede9'),'roller stays metal on the white mouse');assert.ok(mouse.some(m=>m.role==='MX graphite trim'&&m.color==='727b82'),'white shell retains contrasting trim');assert.equal(state.pad.rotation,Math.PI/2);assert.equal(state.pad.color,'20252a');
  await page.select('#accessory-finish-ergo-keyboard','black');assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('ergo-keyboard').finishMaterials[0].mat.color.getHexString()),'161616','black restores original graphite material');assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.accessoryFinishes['logitech-mx-master']),'white','accessory colors are independent');
  await page.select('#accessory-finish-ergo-keyboard','white');await page.evaluate(()=>ErgoFlex.saveBuildPreset());await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await page.reload();await ready();
  assert.deepEqual(await page.evaluate(()=>ErgoFlex.currentConfig.accessoryFinishes),Object.fromEntries(ids.map(id=>[id,'white'])),'white options persist through preset changes and reload');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'occ'}));await ready();
  const occ=await page.evaluate(()=>{const c=ErgoFlex.currentConfig;return {wood:c.woodFinish,base:c.baseFinish,trim:c.trimColor,finishes:c.accessoryFinishes,logos:Object.entries(c.artwork.surfaces).map(([id,s])=>({id,name:s.logo.name,image:s.logo.image.startsWith('data:image/')})),size:c.size}});
  assert.equal(occ.wood,'Coast Navy');assert.equal(occ.base,'White');assert.equal(occ.trim,'#f99239');assert.equal(occ.size,'60x30');assert.deepEqual(occ.finishes,{...state.finishes,'keyboard-tray':'steel'});
  const steel=await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('keyboard-tray').finishMaterials.map(({mat})=>({color:mat.color.getHexString(),metal:mat.metalness,brushed:!!mat.roughnessMap})));assert.ok(steel.every(m=>m.color==='9ca5ae'&&m.metal===.9&&m.brushed),'OCC tray has brushed steel reflectance');assert.deepEqual(occ.logos.map(l=>l.id).sort(),['desktop','left-panel','right-panel']);assert.ok(occ.logos.every(l=>l.image&&l.name==='Orange Coast College white logo'),'official OCC art is embedded into editable layers');
  await page.reload();await ready();assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.artwork.surfaces.desktop.logo.name),'Orange Coast College white logo','college artwork survives reload');
  const cameraState=()=>page.evaluate(()=>({position:ErgoFlex.roomInteractions.camera.position.toArray(),target:ErgoFlex.roomInteractions.controls.target.toArray(),fov:ErgoFlex.roomInteractions.camera.fov}));
  await page.select('#camera-view','side');await new Promise(r=>setTimeout(r,800));const occCamera=await cameraState();await page.click('#save-preset-view');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await page.select('#camera-view','top');await new Promise(r=>setTimeout(r,800));const officeCamera=await cameraState();await page.click('#save-preset-view');assert.notDeepEqual(occCamera.position,officeCamera.position,'presets can save different framing');
  const exactView=(actual,expected)=>{for(const key of ['position','target'])actual[key].forEach((n,i)=>assert.ok(Math.abs(n-expected[key][i])<1e-7,key+' restored exactly'));assert.equal(actual.fov,expected.fov)};
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'occ'}));exactView(await cameraState(),occCamera);
  await page.select('#camera-view','front');await new Promise(r=>setTimeout(r,800));await page.evaluate(()=>ErgoFlex.saveBuildPreset());
  await page.reload();await ready();exactView(await cameraState(),occCamera);assert.ok((await page.$eval('#preset-view-status',e=>e.textContent)).includes('Starting view saved'),'saved view is visible after reload');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));exactView(await cameraState(),officeCamera);
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'occ'}));exactView(await cameraState(),occCamera);
  fs.mkdirSync(path.join(root,'scene-shots/preset-review'),{recursive:true});
  await page.evaluate(()=>ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera));await page.screenshot({path:path.join(root,'scene-shots/preset-review/orange-coast-college.png')});
  await page.evaluate(async()=>{const T=await import('three'),e=ErgoFlex,w=e.workspaceAccessories,m=w.items.get('logitech-mx-master'),c=e.roomInteractions.camera,o=e.roomInteractions.controls;o.minDistance=.01;c.position.copy(m.localToWorld(new T.Vector3(180,180,240)));o.target.copy(m.localToWorld(new T.Vector3(0,25,0)));o.update();e.renderer.render(e.roomInteractions.scene,c)});
  await page.screenshot({path:path.join(root,'scene-shots/preset-review/mx-white-metal.png')});
  await page.evaluate(()=>{ErgoFlex.surfaceArtwork.state.surfaces.desktop.logo.x=43;ErgoFlex.surfaceArtwork.commit();ErgoFlex.saveBuildPreset()});
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await page.evaluate(()=>ErgoFlex.applyPreset({id:'occ'}));assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.artwork.surfaces.desktop.logo.x),43,'owner college logo edits survive preset switching');
  await page.evaluate(()=>{ErgoFlex.surfaceArtwork.setState({v:1,surfaces:{}});ErgoFlex.surfaceArtwork.commit();ErgoFlex.saveBuildPreset()});
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));await page.evaluate(()=>ErgoFlex.applyPreset({id:'occ'}));assert.equal(await page.evaluate(()=>!!ErgoFlex.currentConfig.artwork),false,'removed college artwork is not regenerated');
  assert.deepEqual(errors,[]);console.log('Independent accessory finishes, steel OCC tray, realistic MX rollers, per-preset starting camera and reload persistence passed.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
