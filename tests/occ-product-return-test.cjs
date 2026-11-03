const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultNavigationTimeout(180000);await p.setViewport({width:1400,height:1000});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{const e=ErgoFlex;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;await e.surfaceArtwork.refresh();});};
 await p.goto(`http://127.0.0.1:${server.address().port}/?view=product&tour=0`);await ready();
 const recovery=JSON.parse(fs.readFileSync(path.join(root,'assets/artwork/saved-college-graphics-20261014.json')));
 await p.evaluate(async recovery=>{
  const e=ErgoFlex,project=e.serializeProject(),entries=project.presentation.buildPresets.entries;
  for(const id of ['library','occ'])for(const d of [entries[id],...Object.values(entries[id].sizeSetups)]){
   d.config.artwork=recovery.entries[id][d.config.size].artwork;
   if(d.room?.desks.main)d.room.desks.main.artwork=d.config.artwork;
   if(id==='occ'){d.config.woodFinish='Black Birch';d.collegeArtwork='occ-v2';}
  }
  await e.applyProject(project);
 },recovery);await ready();
 for(const size of ['60x30','48x30']){
  await p.evaluate(size=>ErgoFlex.applyPreset({id:'occ'},{size}),size);await ready();
  const expected=await p.evaluate(()=>{ErgoFlex.saveBuildPreset();return structuredClone(ErgoFlex.currentConfig)});
  await p.evaluate(()=>ErgoFlex.setRoomScene('library',false));await ready();
  assert.notDeepEqual(await p.evaluate(()=>ErgoFlex.currentConfig.artwork),expected.artwork,'Library has its own graphics');
  await p.click('[data-room-scene="product"]');await ready();
  assert.equal(await p.evaluate(()=>ErgoFlex.activeBuildPreset),'occ');
  assert.deepEqual(await p.evaluate(()=>structuredClone(ErgoFlex.currentConfig)),expected,'Product return restores OCC '+size+' exactly');
  await p.evaluate(()=>ErgoFlex.saveBuildPreset());
  const saved=await p.evaluate(size=>{const e=ErgoFlex.serializeProject().presentation.buildPresets.entries.occ;return e.config.size===size?e.config:e.sizeSetups[size].config},size);
  assert.deepEqual(saved,expected,'Room artwork cannot autosave over OCC '+size);
 }
 // Repair the reported previously contaminated recipe, touching artwork only.
 await p.evaluate(async recovery=>{
  const e=ErgoFlex,project=e.serializeProject(),entry=project.presentation.buildPresets.entries.occ;
  for(const d of [entry,...Object.values(entry.sizeSetups)]){d.config.artwork=recovery.entries.library[d.config.size].artwork;if(d.room?.desks.main)d.room.desks.main.artwork=d.config.artwork;}
  await e.applyProject(project);
 },recovery);await ready();
 const before=await p.evaluate(()=>structuredClone(ErgoFlex.serializeProject().presentation.buildPresets));
 await p.evaluate(()=>document.querySelector('#occ-artwork-recover').click());
 await p.waitForFunction(()=>!document.querySelector('#occ-artwork-recover').disabled);await ready();
 const repaired=await p.evaluate(()=>structuredClone(ErgoFlex.serializeProject().presentation.buildPresets));
 for(const id of Object.keys(before.entries))if(id!=='occ')assert.deepEqual(repaired.entries[id],before.entries[id],'Other recipe preserved: '+id);
 for(const d of [repaired.entries.occ,...Object.values(repaired.entries.occ.sizeSetups)]){
  const old=before.entries.occ.config.size===d.config.size?before.entries.occ:before.entries.occ.sizeSetups[d.config.size];
  assert.deepEqual(d.config.artwork,recovery.entries.occ[d.config.size].artwork,'Original width-specific OCC graphics restored');
  const {artwork,...config}=d.config,{artwork:oldArt,...oldConfig}=old.config;assert.deepEqual(config,oldConfig,'Finishes and purchases preserved');
  assert.deepEqual(d.room.desks.main.objects,old.room.desks.main.objects,'Placements preserved');assert.deepEqual(d.initialView,old.initialView,'Camera preserved');
 }
 await p.reload();await ready();assert.deepEqual(await p.evaluate(()=>ErgoFlex.currentConfig.artwork),recovery.entries.occ[await p.evaluate(()=>ErgoFlex.currentConfig.size)].artwork,'Recovery survives reload');
 assert.deepEqual(errors,[]);console.log('PASS OCC Product return from Library at both widths, exact build isolation, OCC-only graphic recovery, other presets/finishes/accessories/placements/cameras retained, and reload.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
