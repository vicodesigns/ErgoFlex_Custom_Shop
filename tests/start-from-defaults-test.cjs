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
    const organizer=w.items.get('shelf-organizer'),wood=organizer?.getObjectByName('Organizer desk finish')?.material,desktop=[].concat(w.mounts.get('desktop').anchor.material).find(m=>m.isMeshPhysicalMaterial),clear=[];
    organizer?.traverse(o=>{if(o.name==='Organizer clear acrylic dividers')clear.push(o.material.transmission)});
    return {config:ef.currentConfig,expected:expected.config,height:actual.height,tilt:actual.tilt,label:+document.querySelector('#tilt-value').value,objects:Object.fromEntries(Object.entries(actual.objects).map(([k,v])=>[k,v.transform])),expectedObjects:Object.fromEntries(Object.entries(expected.room.desks.main.objects).map(([k,v])=>[k,v.transform])),mounts,painting:!!w.items.get('artist-easel')?.getObjectByName('Artist painting')?.material.map,flat:!!w.items.get('flat-monitor')?.userData.loaded,organizer:wood?{color:wood.color.equals(desktop.color),map:wood.map===desktop.map,dividers:clear}:null};
   },id);
   assert.deepEqual(state.config,state.expected,id+' shared finish/accessory defaults');assert.equal(state.label,Math.round(state.tilt*10)/10,id+' controller angle matches actual tilt');
   for(const [key,t] of Object.entries(state.expectedObjects))for(const a of ['x','y','z'])assert.ok(Math.abs(state.objects[key].p[a]-t.p[a])<.001,id+' preserves '+key+' placement '+a);
   for(const m of state.mounts){assert.ok(m.gap<1e-6,id+' head contacts rear mount');assert.ok(m.front<.15,id+' head stays behind panel: '+m.front)}
   if(id==='artist'){assert.equal(state.tilt,65);assert.ok(state.painting);assert.ok(state.organizer.color&&state.organizer.map,'organizer follows desktop finish');assert.equal(state.organizer.dividers.length,2,'both long and short divider meshes are separated');assert.ok(state.organizer.dividers.every(t=>t>.9),'all dividers use clear acrylic')}
   console.log(id+' defaults / controls / mounts passed');
  }
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'artist'}));await ready();
  const rigid=await page.evaluate(async()=>{
   const T=await import('three'),w=ErgoFlex.workspaceAccessories,arm=w.items.get('monitor-arm'),display=w.items.get('flat-monitor');
   const point=display.userData.displayMount.clone();point.z-=4;
   const oldPosition=point.clone().applyQuaternion(display.quaternion).add(display.position);
   const geometry=arm.armGeometry.map(g=>Array.from(g.object.geometry.attributes.position.array));
   const before=Object.fromEntries(['clamp','lower','upper'].map(k=>[k,arm.singleArmRig.groups[k].matrix.toArray()]));
   display.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);
   display.position.copy(oldPosition).sub(point.clone().applyQuaternion(display.quaternion));w.update();
   const after=Object.fromEntries(['clamp','lower','upper'].map(k=>[k,arm.singleArmRig.groups[k].matrix.toArray()]));
   const c=arm.userData.armConnections[0];
   const result={geometry:arm.armGeometry.every((g,j)=>Array.from(g.object.geometry.attributes.position.array).every((v,i)=>v===geometry[j][i])),matrixError:Math.max(...Object.keys(before).flatMap(k=>after[k].map((v,i)=>Math.abs(v-before[k][i])))),gap:c.start.distanceTo(c.end),scale:Object.values(arm.singleArmRig.groups).every(g=>g.scale.equals(new T.Vector3(1,1,1)))};
   display.quaternion.identity();display.position.copy(oldPosition).sub(point);w.update();return result;
  });
  assert.ok(rigid.geometry,'90-degree display roll never rewrites single-arm vertices');assert.ok(rigid.matrixError<1e-8,'screen roll rotates only the mounting head');assert.ok(rigid.gap<1e-6,'rigid single head retains VESA contact');assert.ok(rigid.scale,'single-arm links retain their original dimensions');
  await page.click('#artist-show-painting');await page.evaluate(()=>ErgoFlex.saveBuildPreset());
  await page.reload();await ready();
  const primed=await page.evaluate(()=>{const canvas=ErgoFlex.workspaceAccessories.items.get('artist-easel').getObjectByName('Artist painting');return{checked:document.querySelector('#artist-show-painting').checked,map:!!canvas.material.map,color:'#'+canvas.material.color.getHexString(),saved:ErgoFlex.sceneDesks.serialize().rooms['product/default'].desks.main.objects['accessory-artist-easel'].artworkVisible}});
  assert.deepEqual(primed,{checked:false,map:false,color:'#a4a7a8',saved:false},'painting toggle restores grey primed canvas after reload');
  await page.click('#artist-show-painting');await page.evaluate(()=>ErgoFlex.saveBuildPreset());assert.equal(await page.evaluate(()=>!!ErgoFlex.workspaceAccessories.items.get('artist-easel').getObjectByName('Artist painting').material.map),true,'painting can be shown again');
  const migrated=await page.evaluate(async()=>{
   const {cleanBuildPresets}=await import('/build-presets.mjs'),{SHARED_BUILD_PRESETS}=await import('/preset-defaults.mjs');
   const old=structuredClone(SHARED_BUILD_PRESETS.artist);delete old.singleArm;
   old.config.accessories=old.config.accessories.map(id=>id==='flat-monitor'?'portrait-monitor':id);
   const objects=old.room.desks.main.objects;objects['accessory-portrait-monitor']=objects['accessory-flat-monitor'];delete objects['accessory-flat-monitor'];
   objects['accessory-portrait-monitor'].transform={p:{x:353.030401,y:120,z:264.15232},q:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},s:{x:1,y:1,z:1}};
   objects['accessory-artist-easel'].transform.p.x=29.5;
   const next=cleanBuildPresets({active:'artist',entries:{artist:old}}).entries.artist;
   next.room.desks.main.objects['accessory-monitor-arm'].transform.p.x=27;
   return {next,again:cleanBuildPresets({entries:{artist:next}}).entries.artist};
  });
  assert.ok(migrated.next.config.accessories.includes('flat-monitor'));assert.ok(!migrated.next.config.accessories.includes('portrait-monitor'));
  assert.equal(migrated.next.room.desks.main.objects['accessory-artist-easel'].transform.p.x,29.5,'Artist migration preserves other local edits');
  assert.equal(migrated.again.room.desks.main.objects['accessory-monitor-arm'].transform.p.x,27,'arm reset runs once; later edits persist');
  assert.ok(Math.abs(migrated.next.room.desks.main.objects['accessory-flat-monitor'].transform.p.x-3.030401)<.00001,'landscape replacement preserves screen centre');
  console.log('Single-arm rigid roll and saved Artist migration passed');
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
