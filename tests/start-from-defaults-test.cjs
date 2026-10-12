const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1600,height:1100});
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`);
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.75);ErgoFlex.workspaceAccessories.update()})};await ready();
  const ids=['office','artist','gaming','music','library','compact','creative','architect'];
  for(const id of ids){
   await page.evaluate(id=>ErgoFlex.applyPreset({id}),id);await ready();
   const state=await page.evaluate(async id=>{
    const ef=ErgoFlex,T=await import('three'),defs=(await import('/preset-defaults.mjs')).SHARED_BUILD_PRESETS,expected=defs[id],actual=ef.sceneDesks.serialize().rooms['product/default'].desks.main;
    const w=ef.workspaceAccessories;w.update();const mounts=[];
    for(const arm of w.items.values()){
     if(!arm.armGeometry)continue;
     for(const connection of arm.userData.armConnections){
      const display=w.items.get(connection.displayId),point=display.userData.displayMount.clone();point.z-=4;point.add(display.getObjectByName('Prop:'+((await import('/catalog.mjs')).accessory(connection.displayId).propId))?.position||new T.Vector3());
      const gap=arm.localToWorld(connection.end.clone()).distanceTo(display.localToWorld(point));
      let front=-Infinity;
      for(const g of arm.armGeometry){const p=g.object.geometry.attributes.position;for(let i=0;i<p.count;i++){
       const current=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(g.transform);
       if(current.distanceTo(connection.headCenter)<110)front=Math.max(front,current.sub(connection.end).dot(connection.normal));
      }}mounts.push({gap,front});
     }
    }
    return {config:ef.currentConfig,expected:expected.config,height:actual.height,tilt:actual.tilt,label:+document.querySelector('#tilt-value').value,objects:Object.fromEntries(Object.entries(actual.objects).map(([k,v])=>[k,v.transform])),expectedObjects:Object.fromEntries(Object.entries(expected.room.desks.main.objects).map(([k,v])=>[k,v.transform])),mounts,painting:!!w.items.get('artist-easel')?.getObjectByName('Artist painting')?.material.map,flat:!!w.items.get('flat-monitor')?.userData.loaded};
   },id);
   assert.deepEqual(state.config,state.expected,id+' shared finish/accessory defaults');assert.equal(state.label,Math.round(state.tilt*10)/10,id+' controller angle matches actual tilt');
   for(const [key,t] of Object.entries(state.expectedObjects))for(const a of ['x','y','z'])assert.ok(Math.abs(state.objects[key].p[a]-t.p[a])<.001,id+' preserves '+key+' placement '+a);
   for(const m of state.mounts){assert.ok(m.gap<1e-6,id+' head contacts rear mount');assert.ok(m.front<.15,id+' head stays behind panel: '+m.front)}
   if(id==='artist'){assert.equal(state.tilt,65);assert.ok(state.painting)}
   console.log(id+' defaults / controls / mounts passed');
  }
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await page.evaluate(()=>{const e=ErgoFlex.sceneDesks.objects;e.select('accessory-wide-monitor');e.change({x:380.5,y:30.5,z:285.5,rotation:15.2,tilt:9.1,roll:3.5});ErgoFlex.saveBuildPreset()});
  const rotatedHead=await page.evaluate(async()=>{const T=await import('three'),w=ErgoFlex.workspaceAccessories;w.update();const arm=w.items.get('monitor-arm-2'),display=w.items.get('wide-monitor'),c=arm.userData.armConnections.find(c=>c.displayId==='wide-monitor');const normal=new T.Vector3(0,0,1).applyQuaternion(display.getWorldQuaternion(new T.Quaternion())).applyQuaternion(arm.getWorldQuaternion(new T.Quaternion()).invert());return{error:normal.distanceTo(c.normal),contact:c.start.distanceTo(c.end)}});
  assert.ok(rotatedHead.error<1e-6,'head follows edited yaw, pitch and roll');assert.ok(rotatedHead.contact<1e-6,'edited monitor keeps rear contact');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));await page.reload();await ready();assert.equal(await page.$eval('#tilt-value',el=>el.value),'65','Artist reload readout');assert.equal(await page.evaluate(()=>ErgoFlex.tiltConfigs.find(c=>c.name==='tilting').currentDeg),65,'Artist reload actual posture');
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('wide-monitor').position.x),380.5,'later local edits override shared defaults');
  await page.evaluate(()=>{ErgoFlex.toggleAccessory('wide-monitor');ErgoFlex.toggleAccessory('flat-monitor')});await ready();assert.equal(await page.evaluate(()=>ErgoFlex.workspaceAccessories.items.get('flat-monitor').userData.loaded),true,'landscape monitor loads through store');
  fs.mkdirSync(path.join(root,'scene-shots/preset-review'),{recursive:true});
  for(const id of ['artist','architect','gaming','compact','office']){await page.evaluate(id=>ErgoFlex.applyPreset({id}),id);await ready();await page.evaluate(()=>{ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera)});await page.screenshot({path:path.join(root,'scene-shots/preset-review',id+'.png')})}
  assert.deepEqual(errors,[]);console.log('Preset defaults, native mounts, Artist reload and landscape display passed.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
