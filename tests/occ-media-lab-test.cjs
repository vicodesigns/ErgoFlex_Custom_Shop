const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 const out=path.join(root,'scene-shots/occ-media-lab');fs.mkdirSync(out,{recursive:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setViewport({width:1800,height:1300});await p.goto(`http://127.0.0.1:${server.address().port}/?room=occmedialab&view=room&ceiling=on`);await ready();await p.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(1);document.querySelector('#motion-dock').classList.add('collapsed')});
 assert.equal(await p.$eval('#room-scene-select',el=>el.value),'occmedialab');assert.equal(await p.$$eval('#occmedialab-room-size option',es=>es.length),5);
 const report=[];
 for(const [i,tier] of ['apartment','house','spacious','premium','executive'].entries()){
  await p.select('#occmedialab-room-size',tier);await ready();await p.evaluate(async()=>{await ErgoFlex.workspaceRoom.mediaArtReady});
  const row=await p.evaluate(async({tier,i})=>{
   const T=await import('three'),ef=ErgoFlex,room=ef.workspaceRoom,m=ef.sceneDesks,l=room.roomLayout,inv=room.root.matrixWorld.clone().invert();room.root.updateMatrixWorld(true);
   const box=o=>{const b=new T.Box3();o.traverse(c=>{if(!c.isMesh)return;for(let a=c;a&&a!==room.root;a=a.parent)if(!a.visible)return;c.geometry.computeBoundingBox();b.union(c.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(c.matrixWorld)));});return b;};
   const overlaps=(a,b)=>a.min.x<b.max.x-30&&b.min.x<a.max.x-30&&a.min.z<b.max.z-30&&b.min.z<a.max.z-30;
   const failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg)};check(m.records.size===[4,6,8,10,12][i],'Desk count');check(room.missingProps.length===0,'Missing props');
   const fixtures=room.assets().filter(o=>!o.userData.sceneDeskId);
   for(const id of ['capture-stage','reel-screen','print-scan','storage','occ-circle','occ-pirate','occ-wordmark','student-work-gallery','voice-foley-booth']){if(['student-work-gallery','voice-foley-booth'].includes(id)&&!i)continue;check(fixtures.some(o=>o.userData.propId===id),'Missing '+id);}
   const floor=ef.roomInteractions.entries.filter(e=>e.surface==='floor'&&e.collider&&!e.obj.userData.sceneDeskId),boxes=floor.map(e=>({name:e.name,b:box(e.obj),owner:e.obj.userData.propId==='steelcase-leap-v2'?[...m.records.values()].find(r=>Math.hypot(e.obj.position.x-r.state.pose.x-Math.sin(r.state.pose.yaw)*1050,e.obj.position.z-r.state.pose.z-Math.cos(r.state.pose.yaw)*1050)<100)?.state.name:null}));
   for(const f of boxes){check(f.b.min.x>=-l.width/2-5&&f.b.max.x<=l.width/2+5,'Side wall: '+f.name);check(f.b.min.z>=l.back-5&&f.b.max.z<=l.back+l.depth+5,'Floor depth: '+f.name);}
   const deskBoxes=[...m.records.values()].map(r=>({name:r.state.name,b:box(r.group)}));
   for(const desk of deskBoxes){for(const f of boxes)if(f.owner!==desk.name)check(!overlaps(desk.b,f.b),desk.name+' overlaps '+f.name+' owner '+f.owner+' desk '+[desk.b.min.x,desk.b.min.z,desk.b.max.x,desk.b.max.z].map(Math.round)+' fixture '+[f.b.min.x,f.b.min.z,f.b.max.x,f.b.max.z].map(Math.round));for(const other of deskBoxes)if(other!==desk)check(!overlaps(desk.b,other.b),desk.name+' overlaps '+other.name);}
   const entry=new T.Box3(new T.Vector3(l.width/2-1100,0,l.back+l.depth-2200),new T.Vector3(l.width/2,3000,l.back+l.depth-1000));
   for(const f of [...boxes,...deskBoxes])check(!overlaps(f.b,entry),'Entry blocked by '+f.name);
   let maps=0;for(const r of m.records.values()){r.peripherals.update();if(/sound/.test(r.spec?.role||''))check(r.group.getObjectByName('Nearfield studio speakers')?.visible===true,'Audio speakers hidden');for(const root of r.peripherals.items.values())if(root.getObjectByName('monitor-screen')?.material.map)maps++;}
   check(maps>=m.records.size,'Media screen content');check(room.assets().filter(o=>/OCC/.test(o.name)).every(o=>!o.children.some(c=>c.material?.map&&!c.material.map.image)),'OCC artwork failed to load');
   return {tier,desks:m.records.size,dimensions:[l.width,l.depth],floorFixtures:boxes.length,screenMaps:maps,failures};
  },{tier,i});report.push(row);console.log(JSON.stringify(row));assert.deepEqual(row.failures,[]);
  for(const phase of ['morning','afternoon','evening','night','party']){
   await p.evaluate(phase=>{ErgoFlex.setMeasuredRoomMode('occmedialab',phase,false);ErgoFlex.sceneDesks.update(0)},phase);
   assert.equal(await p.evaluate(()=>ErgoFlex.workspaceRoom.root.userData.mediaLab.phase),phase);
   assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.ctx.phase()),phase);
  }
  await p.select('#camera-view','room');await p.click('#lab-preview-toggle');await new Promise(r=>setTimeout(r,750));await p.evaluate(()=>{const e=ErgoFlex;e.workspaceRoom.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera)});await p.screenshot({path:path.join(out,tier+'-critique.png')});await p.click('#lab-preview-toggle');
 }
 // Night screening and a closer interior view make the lighting and lab equipment reviewable.
 await p.select('#occmedialab-room-size','house');await ready();await p.evaluate(()=>ErgoFlex.setMeasuredRoomMode('occmedialab','night',false));await p.select('#camera-view','inside');await p.click('#lab-preview-toggle');await new Promise(r=>setTimeout(r,750));await p.evaluate(()=>{const e=ErgoFlex;e.workspaceRoom.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera)});await p.screenshot({path:path.join(out,'teaching-lab-screening-inside.png')});
 fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log('PASS five OCC media layouts, lab fixtures and artwork, floor bounds, entry routes, workstation spacing, simulated displays and all five activity modes.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
