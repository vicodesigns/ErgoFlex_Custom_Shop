const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();await p.evaluate(()=>ErgoFlex.applyPreset({id:'occ'},{size:'60x30'}));await ready();
 const fixture=await p.evaluate(()=>{const project=ErgoFlex.serializeProject();return {project,presets:project.presentation.buildPresets}});
 const ring=Array.from({length:5},(_,i)=>({savedAt:'2026-10-12T00:00:00Z',label:'Recovery '+i,project:fixture.project}));
 while(JSON.stringify(ring).length+JSON.stringify(fixture.presets).length>4*1024*1024)ring.pop();
 assert.ok(ring.length>=2,'fixture contains multiple existing recovery states');
 const quota=await p.evaluate(({ring,presets})=>{
  localStorage.clear();localStorage.setItem('ergoflex.buildPresetsV1',JSON.stringify(presets));localStorage.setItem('ergoflexProjectAutosaveV1',JSON.stringify(ring));
  // Fill the origin until even a small legacy preset growth fails.
  let filler='';for(const chunk of [65536,4096,256]){while(true){try{localStorage.setItem('test-quota-filler',filler+'x'.repeat(chunk));filler+='x'.repeat(chunk)}catch{break}}}
  try{localStorage.setItem('ergoflex.buildPresetsV1',JSON.stringify({...presets,testGrowth:'x'.repeat(8192)}));return false}catch(e){return e.name==='QuotaExceededError'}
 },{ring,presets:fixture.presets});
 assert.equal(quota,true,'reproduces a real full-browser-storage failure');
 await p.reload();await ready();
 const migration=await p.evaluate(async()=>{const {decodeStoredJSON}=await import('/browser-design-storage.mjs');const raw=localStorage.getItem('ergoflexProjectAutosaveV1');return {ring:decodeStoredJSON(raw),packed:JSON.parse(raw).format,presets:decodeStoredJSON(localStorage.getItem('ergoflex.buildPresetsV1'))}});
 assert.deepEqual(migration.ring,ring,'startup preserves every pre-existing recovery state');
 assert.equal(migration.packed,'ergoflex-image-pool-v1');
 assert.deepEqual(migration.presets,fixture.presets,'all preset designs and revision numbers survive migration');
 const wide=await art();await p.click('[data-size-choice="48x30"]');await ready();
 await p.evaluate(()=>{const a=ErgoFlex.surfaceArtwork;a.surface='desktop';a.kind='logo';a.selectedLayer='logo';a.root.open=true;a.syncUI();const el=a.root.querySelector('[data-art-field="x"]');el.value='23';el.dispatchEvent(new Event('input',{bubbles:true}));ErgoFlex.saveBuildPreset()});
 assert.match(await p.$eval('#preset-save-status',e=>e.textContent),/48.*setup saved/);
 await p.reload();await ready();assert.equal((await art()).surfaces.desktop.logo.x,23,'new narrow edits survive reload after quota recovery');
 await p.click('[data-size-choice="60x30"]');await ready();assert.deepEqual(await art(),wide,'wide artwork remains independent after storage migration');
 const exported=await p.evaluate(()=>ErgoFlex.serializeProject());assert.ok(exported.customerConfig.artwork.surfaces.desktop.logo.image.startsWith('data:image/'),'project exports remain self-contained ordinary JSON');
 const stillKept=await p.evaluate(async()=>{const {decodeStoredJSON}=await import('/browser-design-storage.mjs');return decodeStoredJSON(localStorage.getItem('ergoflexProjectAutosaveV1'))});assert.deepEqual(stillKept,ring,'preset edits do not discard recovery backups');
 console.log('Full browser quota recovered: legacy designs and backups preserved, new size-specific artwork saved across reload.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
