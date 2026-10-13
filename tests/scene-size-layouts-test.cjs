const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 await p.setViewport({width:1600,height:1100});await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();await p.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.25);document.querySelector('#motion-dock').classList.add('collapsed')});
 const selected=process.argv.find(a=>a.startsWith('--scenes='))?.slice(9).split(',');const scenes=(await p.evaluate(()=>ErgoFlex.roomScenes.filter(s=>s.id!=='product').map(s=>s.id))).filter(id=>!selected||selected.includes(id));const report=[];fs.mkdirSync(path.join(root,'scene-shots/scene-size-audit'),{recursive:true});
 for(const scene of scenes){
  await p.evaluate(async scene=>{ErgoFlex.setRoomScene(scene,false);await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)},scene);
  const layouts=await p.evaluate(scene=>{const prefix=scene==='creative'?'artist':scene;return [...document.querySelectorAll('#'+(scene==='home'?'home-room-size':prefix+'-room-size')+' option')].map(e=>e.value)},scene);
  assert.ok(layouts.length,'Layout selector for '+scene);
  for(const layout of layouts){
   await p.evaluate(async({scene,layout})=>{ErgoFlex.setMeasuredRoomLayout(scene,layout);await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)},{scene,layout});
   const result=await p.evaluate(async({scene,layout})=>{
    const ef=ErgoFlex,m=ef.sceneDesks,{peripheralReference}=await import('/scene-peripheral-layouts.mjs');const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg)};const ids=[...m.records.keys()];
    for(const id of ids){
     m.select(id);
     const keep={};
     for(const size of ['48x30','60x30']){
      m.setSize(size);await m.objects.ready;m.update(0);const r=m.active,ref=peripheralReference(r.state.peripheralRecipe,size);for(const [accessory,obj] of r.peripherals.items){let meshes=0;obj.traverse(o=>{if(o.isMesh)meshes++});check(meshes>0,id+' '+size+' '+accessory+' failed to render');}
      check(JSON.stringify(r.state.accessories)===JSON.stringify(ref.config.accessories),id+' '+size+' accessory selection differs from reference');
      for(const [key,obj] of Object.entries(ref.objects)){const live=r.objects.get(key);if(!live||live.saved.removed)continue;check(Math.abs(live.obj.position.x-obj.transform.p.x)<1e-5&&Math.abs(live.obj.position.y-obj.transform.p.y)<1e-5&&Math.abs(live.obj.position.z-obj.transform.p.z)<1e-5,id+' '+size+' '+key+' placement');}
      for(const arm of ['monitor-arm','monitor-arm-2'])for(const link of r.peripherals.items.get(arm)?.userData.armConnections||[])check(link.start.distanceTo(link.end)<2,id+' '+size+' '+arm+' mounting gap');
      const key=[...r.objects].find(([key,obj])=>key.startsWith('accessory-')&&!obj.saved.removed)?.[0];check(!!key,id+' '+size+' missing peripherals');
      m.objects.select(key);m.objects.change({x:size==='48x30'?24:60});m.saveSetting();m.persist();keep[size]={key,accessories:structuredClone(r.state.accessories),style:structuredClone(r.state.style)};
     }
     for(const size of ['48x30','60x30']){m.setSize(size);await m.objects.ready;check(m.active.objects.get(keep[size].key).obj.position.x===(size==='48x30'?24:60),id+' '+size+' edit did not restore');check(JSON.stringify(m.active.state.style)===JSON.stringify(keep[size].style),id+' '+size+' finish did not restore');check(JSON.stringify(m.active.state.accessories)===JSON.stringify(keep[size].accessories),id+' '+size+' accessory list did not restore');}
    }
    m.select('main');m.setSize('48x30');await m.objects.ready;
    for(const mode of ['morning','afternoon','evening','night','party']){ef.setMeasuredRoomMode(scene,mode,false);m.update(0);check(m.ctx.phase()===mode,'Missing '+mode+' time scene');check(m.active.state.size==='48x30','Time changed width');}
    m.persist();return {scene,layout,key:m.key,desks:ids.length,failures};
   },{scene,layout});
   report.push(result);console.log(JSON.stringify(result));fs.writeFileSync(path.join(root,'scene-shots/scene-size-audit/'+(selected?'focused-layouts.json':'all-layouts.json')),JSON.stringify(report,null,2));assert.deepEqual(result.failures,[],scene+'/'+layout);
  }
 }
 await p.reload();await ready();const restored=await p.evaluate(()=>ErgoFlex.sceneDesks.serialize());for(const row of report)for(const [id,desk] of Object.entries(restored.rooms[row.key].desks)){assert.equal(desk.size,id==='main'?'48x30':'60x30');assert.ok(desk.sizeSetups[id==='main'?'60x30':'48x30']);}
 console.log('Exhaustive audit passed '+report.length+' layouts, '+report.reduce((n,r)=>n+r.desks,0)+' desks, both widths and all five time scenes.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
