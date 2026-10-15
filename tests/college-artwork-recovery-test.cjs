const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultNavigationTimeout(180000);await p.setViewport({width:1400,height:1000});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{const e=ErgoFlex;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;await e.surfaceArtwork.refresh();});};
 await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();
 const expected=await p.evaluate(async()=>{
  const e=ErgoFlex,project=e.serializeProject(),entries=project.presentation.buildPresets.entries,{defaultArtworkLayer}=await import('/artwork-config.mjs');
  for(const id of ['library','occ'])for(const d of [entries[id],...Object.values(entries[id].sizeSetups)]){
   const c=document.createElement('canvas');c.width=384;c.height=100;const t=c.getContext('2d');t.fillStyle='#fff';t.font='bold 40px sans-serif';t.fillText(id+' '+d.config.size,10,70);
   d.revision=41;d.config.artwork={version:1,surfaces:{desktop:{logo:{...defaultArtworkLayer('logo'),name:id+' '+d.config.size,image:c.toDataURL('image/png'),x:d.config.size==='48x30'?28:58,scale:55}}}};
  }
  entries.library.config.baseFinish='White';project.presentation.buildPresets.active=null;
  await e.applyProject(project);
  return Object.fromEntries(['library','occ'].map(id=>[id,Object.fromEntries([entries[id],...Object.values(entries[id].sizeSetups)].map(d=>[d.config.size,d.config]))]));
 });await ready();
 // Exercise the reported transition: a room palette must not replace either
 // saved Product recipe, including a different-width recipe.
 for(const id of ['library','occ'])for(const size of ['60x30','48x30']){
  await p.evaluate(()=>ErgoFlex.setRoomScene('highschool',false));await ready();
  await p.evaluate(({id,size})=>ErgoFlex.applyPreset({id},{size}),{id,size});await ready();
  const actual=await p.evaluate(()=>{ErgoFlex.saveBuildPreset();return structuredClone(ErgoFlex.currentConfig)});
  assert.deepEqual(actual,expected[id][size],`${id} ${size} restores its exact palette, accessories and graphics from High school`);
  console.log(id+' '+size+': room-to-Product palette and graphics preserved');
 }
 await p.evaluate(()=>ErgoFlex.setRoomScene('occmedialab',false));await ready();
 const lab=await p.evaluate(async expected=>{
  const e=ErgoFlex,m=e.sceneDesks;for(const r of m.records.values())await r.rig.artworkReady;
  for(const r of m.records.values()){
   if(JSON.stringify(r.state.artwork)!==JSON.stringify(expected[r.state.size].artwork))throw Error(r.id+' college artwork missing');
   if(!r.rig.group.children.some(o=>o.userData.surfaceArtwork))throw Error(r.id+' artwork mesh missing');
  }
  m.setSize('60x30');await m.objects.ready;await e.surfaceArtwork.refresh();
  const main=m.active,accessories=JSON.stringify(main.state.accessories);
  e.surfaceArtwork.state.surfaces.desktop.logo.x=65;e.surfaceArtwork.commit();const edited=structuredClone(main.state.artwork);
  m.setSize('48x30');await m.objects.ready;await m.active.rig.artworkReady;
  if(JSON.stringify(m.active.state.artwork)!==JSON.stringify(expected['48x30'].artwork))throw Error('48 inch graphics did not use saved OCC placement');
  m.setSize('60x30');await m.objects.ready;
  if(JSON.stringify(m.active.state.artwork)!==JSON.stringify(edited))throw Error('60 inch room graphics edit lost');
  if(JSON.stringify(m.active.state.accessories)!==accessories)throw Error('college artwork replaced station equipment');
  return {stations:m.records.size,widths:true,roomEdits:true};
 },expected.occ);console.log('OCC lab '+JSON.stringify(lab));
 await p.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await ready();
 for(const id of ['hbhs-seal','hbhs-oilers-orange','hbhs-oilers-white']){
  assert.equal(await p.$eval('[data-art-sample="'+id+'"] img',async image=>{await image.decode();return image.naturalWidth>0}),true,'sample thumbnail '+id);
  assert.equal(await p.evaluate(id=>ErgoFlex.surfaceArtwork.applySample(id),id),true,'sample can be placed '+id);
 }
 await ready();const placed=await p.evaluate(()=>Object.values(ErgoFlex.currentConfig.artwork.surfaces.desktop).filter(l=>/HBHS|Huntington/.test(l.name)).map(l=>({name:l.name,image:l.image.slice(0,22)})));
 assert.equal(placed.length,3);assert.ok(placed.every(l=>l.image.startsWith('data:image/webp')));
 await p.reload();await ready();assert.equal(await p.evaluate(()=>Object.values(ErgoFlex.currentConfig.artwork.surfaces.desktop).filter(l=>/HBHS|Huntington/.test(l.name)).length),3,'HBHS decals survive reload');
 // The recovery action modifies only the two college builds.
 const officeBefore=await p.evaluate(()=>structuredClone(ErgoFlex.serializeProject().presentation.buildPresets.entries.office));
 await p.click('[data-portal-mode="studio"]');await p.click('[data-sidebar-tab="editor"]');
 await p.click('#college-artwork-recover');
 await p.waitForFunction(()=>document.querySelector('#college-artwork-recover').disabled===false);
 const recovered=await p.evaluate(()=>ErgoFlex.serializeProject().presentation.buildPresets);
 assert.deepEqual(recovered.entries.office,officeBefore,'recovery preserves current Office build, including HBHS decals');
 const original=JSON.parse(fs.readFileSync(path.join(root,'assets/artwork/saved-college-graphics-20261014.json')));
 for(const id of ['library','occ'])for(const d of [recovered.entries[id],...Object.values(recovered.entries[id].sizeSetups)])assert.deepEqual(d.config.artwork,original.entries[id][d.config.size].artwork,'exact recovered '+id+' '+d.config.size);
 assert.deepEqual(errors,[]);console.log('PASS saved Library/OCC room transition, both widths, OCC lab artwork, editable HBHS samples, reload and scoped recovery.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
