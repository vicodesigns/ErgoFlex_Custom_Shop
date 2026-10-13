const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 await p.setViewport({width:1600,height:1100});await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();await p.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.3);document.querySelector('#motion-dock').classList.add('collapsed')});
 const scenes=await p.evaluate(()=>ErgoFlex.roomScenes.filter(s=>s.id!=='product').map(s=>s.id));const report=[];fs.mkdirSync(path.join(root,'scene-shots/scene-size-audit'),{recursive:true});
 for(const scene of scenes){
  await p.evaluate(async scene=>{ErgoFlex.setRoomScene(scene,false);await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)},scene);
  const result=await p.evaluate(async scene=>{
   const ef=ErgoFlex,m=ef.sceneDesks,T=await import('three'),{peripheralReference}=await import('/scene-peripheral-layouts.mjs');const failures=[];const check=(value,message)=>{if(!value)failures.push(message)};
   check(!!m.active&&!m.active.product,'Scene has no editable room desk');
   for(const r of m.records.values()){
    const ref=peripheralReference(r.state.peripheralRecipe,r.state.size);check(!!r.peripherals,r.id+' has no accessory controller');
    for(const [id,obj] of r.peripherals?.items||[]){const wanted=ref.objects['accessory-'+id];if(wanted&&!r.state.objects['accessory-'+id]?.removed)check(Math.abs(obj.position.x-wanted.transform.p.x)<1e-5&&Math.abs(obj.position.z-wanted.transform.p.z)<1e-5,r.id+' '+id+' is not in the Product reference position');}
    for(const id of ['monitor-arm','monitor-arm-2'])for(const link of r.peripherals?.items.get(id)?.userData.armConnections||[])check(link.start.distanceTo(link.end)<2,r.id+' '+id+' does not meet '+link.displayId);
   }
   m.select('main');m.setSize('60x30');await m.objects.ready;const objectId=[...m.active.objects].find(([id,v])=>id.startsWith('accessory-')&&!v.saved.removed)?.[0];check(!!objectId,'No editable accessory');
   document.querySelector('[data-trim-color="#dc0909"]').click();m.objects.select(objectId);m.objects.change({x:111});m.saveSetting();const wide=structuredClone(m.active.state);
   m.setSize('48x30');await m.objects.ready;document.querySelector('[data-trim-color="#286344"]').click();m.objects.select(objectId);m.objects.change({x:-123});m.saveSetting();const narrow=structuredClone(m.active.state);
   m.setSize('60x30');await m.objects.ready;check(m.active.state.style.trimColor===wide.style.trimColor,'60 inch trim lost');check(Math.abs(m.active.objects.get(objectId).obj.position.x-111)<1e-6,'60 inch object edit lost');check(JSON.stringify(m.active.state.accessories)===JSON.stringify(wide.accessories),'60 inch accessories lost');
   m.setSize('48x30');await m.objects.ready;check(m.active.state.style.trimColor===narrow.style.trimColor,'48 inch trim lost');check(Math.abs(m.active.objects.get(objectId).obj.position.x+123)<1e-6,'48 inch object edit lost');check(JSON.stringify(m.active.state.accessories)===JSON.stringify(narrow.accessories),'48 inch accessories lost');
   const modes=['morning','afternoon','evening','night','party'];
   for(const mode of modes){ef.setMeasuredRoomMode(scene,mode,false);check(m.ctx.phase()===mode,'Time '+mode+' did not load');await m.objects.ready;m.update(0);check(m.active.state.style.trimColor===narrow.style.trimColor,'Time '+mode+' changed the 48 inch finish');check(Math.abs(m.active.objects.get(objectId).obj.position.x+123)<1e-6,'Time '+mode+' moved the edited object');}
   m.persist();return {scene,key:m.key,desks:m.records.size,objectId,phases:modes.length,failures};
  },scene);
  report.push(result);console.log(JSON.stringify(result));fs.writeFileSync(path.join(root,'scene-shots/scene-size-audit/report.json'),JSON.stringify(report,null,2));assert.deepEqual(result.failures,[],scene);
 }
 await p.reload();await ready();const restored=await p.evaluate(()=>ErgoFlex.sceneDesks.serialize());for(const row of report){const desk=restored.rooms[row.key].desks.main;assert.equal(desk.size,'48x30');assert.equal(desk.style.trimColor,'#286344');assert.equal(desk.objects[row.objectId].transform.p.x,-123);assert.equal(desk.sizeSetups['60x30'].style.trimColor,'#dc0909');assert.equal(desk.sizeSetups['60x30'].objects[row.objectId].transform.p.x,111);}
 console.log('All '+report.length+' environments preserve independent width builds, owner peripheral placements, arm connections, time scenes and reload.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
