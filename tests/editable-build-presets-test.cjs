const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)});page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1600,height:1100});
  const url=`http://127.0.0.1:${server.address().port}/?view=product`;
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:180000});await page.waitForFunction(()=>getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.75)});};
  await page.goto(url);await ready();await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));

  const alignment = async label => {
   const parts=await page.evaluate(()=>['Desktop_3','Desktop_1_4','Desktop_2_5','Trim_03','Trim_04','Trim_Desktop_Standard','Variant_Desktop_Extended','Trim_Desktop_Extended'].map(id=>{const o=ErgoFlex.partRegistry.get(id).obj;return{id,parent:o.parent.name,p:o.position.toArray(),q:o.quaternion.toArray()}}));
   for(const part of parts){assert.equal(part.parent,'tiltWrapper_tilting',label+': '+part.id);for(let i=0;i<3;i++)assert.ok(Math.abs(part.p[i]-parts[0].p[i])<1e-6,label+': aligned '+part.id);assert.deepEqual(part.q,parts[0].q,label+': rotation '+part.id)}
  };
  await alignment('initial');
  const pair=await page.evaluate(()=>{const w=ErgoFlex.workspaceAccessories;return {right:w.items.get('wide-monitor').position.x,left:w.items.get('portrait-monitor').position.x,steps:['x','y','z','rotation','tilt','roll'].map(f=>document.querySelector('[data-object-'+f+']').step)}});
  assert.ok(pair.right>0&&pair.left<0,'curved right and portrait left');assert.deepEqual(pair.steps,['0.5','0.5','0.5','0.1','0.1','0.1']);

  const renderRear=async name=>{await page.evaluate(async()=>{const ef=ErgoFlex,T=await import('three'),w=ef.workspaceAccessories,g=w.items.get('monitor-arm-2'),camera=ef.roomInteractions.camera,controls=ef.roomInteractions.controls;camera.position.copy(g.localToWorld(new T.Vector3(180,600,-1450)));controls.target.copy(g.localToWorld(new T.Vector3(0,220,220)));controls.update();ef.renderer.render(ef.roomInteractions.scene,camera)});await page.screenshot({path:path.join(root,'scene-shots/editable-presets',name+'.png')});};
  fs.mkdirSync(path.join(root,'scene-shots/editable-presets'),{recursive:true});await renderRear('arms-fixed');
  const material=await page.evaluate(()=>{
   const w=ErgoFlex.workspaceAccessories,materials=id=>{const list=[];w.items.get(id).traverse(o=>{if(o.isMesh)list.push(...(Array.isArray(o.material)?o.material:[o.material]))});return list};
   const mouse=w.items.get('logitech-mx-master'),a=w.items.get('monitor-arm-2').getObjectByName('Prop:ergoflex-dual-monitor-arm-compact');let draws=0;
   a.traverse(o=>{if(o.isMesh){if(Array.isArray(o.material)&&!o.geometry.groups.length)throw Error('Arm has no drawable material groups');o.onBeforeRender=()=>draws++}});
   ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera);
   const keyboard=materials('ergo-keyboard')[0],mx=materials('logitech-mx-master')[0];
   return {prop:mouse.children[0].userData.propId,color:mx.color.toArray(),keyboard:keyboard.color.toArray(),roughness:mx.roughness,keyboardRoughness:keyboard.roughness,metal:mx.metalness,keyboardMetal:keyboard.metalness,draws};
  });
  assert.equal(material.prop,'ergoflex-mx-master-mouse');assert.deepEqual(material.color,material.keyboard);assert.equal(material.roughness,material.keyboardRoughness);assert.equal(material.metal,material.keyboardMetal);assert.ok(material.draws>0,'CAD arm assembly is rendered, not just its adapters');
  const apple=await page.evaluate(async()=>{
   const ef=ErgoFlex,e=ef.sceneDesks.objects;e.select('accessory-wide-monitor');e.change({x:-355.5,z:100.5,rotation:-5.1,tilt:1.2,roll:-.3});e.select('accessory-ergo-keyboard');e.change({x:-100,z:320});
   const id=await e.add('apple','desktop');e.change({x:170,z:65,rotation:20,scale:80});
   document.querySelector('[data-trim-color="#dc0909"]').click();ef.setLedColor('#33aa66');ef.setLedGlow(80);ef.setHeight(40);ef.setTilt('tilting',7);
   return id;
  });
  const fitted=await page.evaluate(()=>{
   const w=ErgoFlex.workspaceAccessories;w.update();const arm=w.items.get('monitor-arm-2');
   return {dark:['wide-monitor','portrait-monitor'].every(id=>{const m=w.items.get(id).getObjectByName('monitor-screen').material;return !m.map&&!m.emissiveMap&&m.emissiveIntensity<=1&&m.emissive.getHex()===0}),adapters:arm.armAdapterGroup.children.length,
    gaps:arm.userData.armConnections.map(c=>{const display=w.items.get(c.displayId),p=display.userData.displayMount.clone();p.add(display.getObjectByName('Prop:'+(c.displayId==='wide-monitor'?'ergoflex-wide-monitor':'ergoflex-portrait-monitor')).position);return arm.localToWorld(c.end.clone()).distanceTo(display.localToWorld(p));})};
  });
  assert.equal(fitted.dark,true,'both screens start dark');assert.equal(fitted.adapters,0,'only supplied CAD brackets remain');
  assert.equal(fitted.gaps.length,2);assert.ok(fitted.gaps.every(v=>v<1e-6),'extended arms stay attached after editing screen position and rotation');
  await page.waitForFunction(id=>{const saved=JSON.parse(localStorage.getItem('ergoflex.buildPresetsV1')||'{}');return saved.entries?.office?.room?.desks.main.objects[id]?.transform.p.x===170;},{timeout:10000},apple);
  const office=await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.buildPresetsV1')).entries.office);
  assert.equal(office.config.trimColor,'#dc0909');assert.equal(office.room.desks.main.objects['accessory-wide-monitor'].transform.p.x,-355.5);assert.equal(office.room.desks.main.lights.color,'#33aa66');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));
  assert.equal(await page.evaluate(id=>ErgoFlex.sceneDesks.active.objects.has(id),apple),false,'Office decorations cannot leak into Artist');
  await page.evaluate(()=>{ErgoFlex.toggleAccessory('painter-shelf');document.querySelector('[data-trim-color="#286344"]').click()});
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));
  assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('wide-monitor').position.x),-355.5);assert.equal(await page.evaluate(id=>ErgoFlex.sceneDesks.active.objects.get(id)?.obj.position.x,apple),170);
  assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.trimColor),'#dc0909');
  await alignment('before export'); const proj=await page.evaluate(()=>ErgoFlex.serializeProject());await alignment('after export');assert.ok(proj.presentation.buildPresets.entries.artist);assert.ok(proj.presentation.buildPresets.entries.office);
  await page.reload();await ready();await alignment('reload');
  const angles=await page.evaluate(()=>{const o=ErgoFlex.workspaceAccessories.items.get('wide-monitor');return [o.rotation.x,o.rotation.y,o.rotation.z].map(v=>v*180/Math.PI)});[1.2,-5.1,-.3].forEach((v,i)=>assert.ok(Math.abs(angles[i]-v)<1e-6));
  assert.equal(await page.evaluate(()=>ErgoFlex.activeBuildPreset),'office');assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.trimColor),'#dc0909');assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('wide-monitor').position.x),-355.5);assert.equal(await page.evaluate(id=>ErgoFlex.sceneDesks.active.objects.get(id)?.obj.position.x,apple),170);
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.trimColor),'#286344');assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.accessories.includes('painter-shelf')),false);
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));
  await page.evaluate(()=>{const ef=ErgoFlex;ef.focusCameraShortcut('desktop');ef.renderer.render(ef.roomInteractions.scene,ef.roomInteractions.camera)});await page.screenshot({path:path.join(root,'scene-shots/editable-presets/office-materials.png')});
  // Upgrade an existing Office build without resetting the user's edited positions.
  await page.evaluateOnNewDocument(draft=>{
   localStorage.removeItem('ergoflex.buildPresetsV1');
   localStorage.setItem('ergoflexSavedBuildV2',JSON.stringify({...draft.config,accessories:draft.config.accessories.map(id=>id==='logitech-mx-master'?'logitech-lift':id)}));
   localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({v:1,rooms:{'product/default':draft.room},productAccessories:draft.config.accessories}));
  },office);
  await page.reload();await ready();
  assert.equal(await page.evaluate(()=>ErgoFlex.activeBuildPreset),'office');
  assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('logitech-mx-master').children[0].userData.propId),'ergoflex-mx-master-mouse');
  assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('wide-monitor').position.x),-355.5);
  assert.equal(await page.evaluate(id=>ErgoFlex.sceneDesks.active.objects.get(id)?.obj.position.x,apple),170);
  console.log('Editable presets passed: isolated poses/objects, auto-save, switch, reload, project export, existing Office migration, supplied mouse materials, native monitor arms, dark screens, fine transforms and trim alignment across animated load/reload.');
  assert.equal(errors.length,0);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
