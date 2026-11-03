const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://local').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try {
  let p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.setViewport({width:1000,height:700});
  await p.evaluateOnNewDocument(()=>Object.defineProperty(window,'devicePixelRatio',{get:()=>.3}));
  const url=`http://127.0.0.1:${server.address().port}/?room=library&view=room&layout=humboldt&tour=0`;
  const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});await p.evaluate(async()=>{const e=ErgoFlex;e.renderer.setAnimationLoop(null);e.renderer.shadowMap.enabled=false;await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;await e.surfaceArtwork.refresh();});};
  await p.goto(url,{timeout:180000});await ready();
  const baseline=await p.evaluate(()=>({surfaces:Object.keys(ErgoFlex.sceneDesks.active.state.artwork.surfaces),marker:ErgoFlex.sceneDesks.active.state.productBuild.artworkRepair}));
  assert.deepEqual(baseline.surfaces,['desktop','right-panel','footrest-panel']);assert.equal(baseline.marker,'humboldt-product-decals-v1');
  // The saved Product version wins over recovery and propagates its exact
  // per-width artwork placements into the new commons.
  await p.evaluate(async()=>{const e=ErgoFlex,project=e.serializeProject(),entry=project.presentation.buildPresets.entries.library,art=structuredClone(e.sceneDesks.active.state.artwork);
   for(const d of [entry,...Object.values(entry.sizeSetups)]){d.revision=70;d.config.artwork=structuredClone(art);d.config.artwork.surfaces.desktop.logo.x=d.config.size==='48x30'?31:67;}
   await e.applyProject(project);e.setRoomScene('library',false);e.setLibraryLayout('humboldt');await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;
  });await ready();
  for(const size of ['48x30','60x30']){
   const result=await p.evaluate(async size=>{
    const e=ErgoFlex,m=e.sceneDesks,S=await import('./desk-auto-stow.mjs');m.setSize(size);await m.objects.ready;await e.surfaceArtwork.refresh();
    const r=m.active,fail=[],check=(v,msg)=>{if(!v)fail.push(msg)},round=v=>JSON.stringify(v,(_k,x)=>typeof x==='number'?Math.round(x*1e6)/1e6:x);
    check(r.state.artwork.surfaces.desktop.logo.x===(size==='48x30'?31:67),'Product decal position lost');
    const decals=[...e.surfaceArtwork.bindings.values()].flatMap(b=>[...b.layers.values()]).filter(x=>x.mesh.visible);check(decals.length===3,'active desk decal meshes missing');
    m.objects.setEditing(true);m.objects.select(null);e.setHeight(50);e.setTilt('tilting',9);m.update(.02);m.capture();
    const authored=round(r.state.objects);check(![...r.objects.values()].some(i=>i.autoStow),'stows at 9 degrees');
    const stowed=[];
    for(const phase of ['morning','evening'])for(const angle of [9.1,24.1,65]){
     e.setLibraryMode(phase,false);e.setTilt('tilting',angle);m.update(.02);m.update(.02);m.update(.02);
     const loose=[...r.objects.values()].filter(i=>!i.saved.removed&&(i.obj.visible||i.autoStow)&&S.deskItemDisposition(i,angle,r.state.peripheralRecipe)==='stow');
     check(loose.every(i=>i.autoStow),'loose desktop item remains at '+phase+' '+angle);
     check(r.stowStatus?.count>0,'nothing visibly stored at '+phase+' '+angle);check(!r.stowStatus?.overflow,'overflow '+JSON.stringify([...r.objects.values()].filter(i=>i.autoStow?.hidden||i.autoStow?.unpacked).map(i=>({id:i.id,unpacked:i.autoStow.unpacked}))));
     const placements=loose.flatMap(i=>[i.obj,...(i.autoStow?.parts||[])]).filter(o=>o.stowPlacement);
     check(placements.every(o=>['shelf','lower-shelf'].includes(o.stowPlacement.role)),'items left the upper shelving unit '+JSON.stringify(placements.filter(o=>!['shelf','lower-shelf'].includes(o.stowPlacement.role)).map(o=>({name:o.name,role:o.stowPlacement.role,bounds:{min:o.stowPlacement.bounds.min.toArray(),max:o.stowPlacement.bounds.max.toArray()}}))));
     m.capture();check(round(r.state.objects)===authored,'stow saved the temporary placement');stowed.push({phase,angle,...r.stowStatus});
     e.setTilt('tilting',9);m.update(.02);m.capture();check(![...r.objects.values()].some(i=>i.autoStow),'does not restore below threshold');check(round(r.state.objects)===authored,'lowering changed authored placements');
    }
    return{size,decals:decals.length,stowed,fail};
   },size);
   console.log(JSON.stringify(result));assert.deepEqual(result.fail,[]);
  }
  await p.evaluate(async()=>{const e=ErgoFlex,m=e.sceneDesks,S=await import('./desk-auto-stow.mjs');m.objects.stow=new S.DeskAutoStow(m.objects);e.setHeight(50);e.setTilt('tilting',9);m.update(.02);m.objects.setEditing(true);const item=[...m.active.objects.values()].find(i=>i.obj.visible&&!i.saved.removed&&S.deskItemDisposition(i,24.1)==='stow');m.objects.select(item.id);e.setTilt('tilting',24.1);m.update(.02);if(m.objects.editing||!item.autoStow)throw Error('Tilting did not finish the selected object edit and stow it');m.persist();});
  const restored=await p.evaluate(async()=>{const e=ErgoFlex,m=e.sceneDesks,{decodeStoredJSON}=await import('./browser-design-storage.mjs'),{cleanSceneDeskData,SCENE_DESKS_KEY}=await import('./scene-desk-data.mjs');const saved=cleanSceneDeskData(decodeStoredJSON(localStorage.getItem(SCENE_DESKS_KEY))).rooms[m.key].desks.main;return{artwork:saved.artwork.surfaces.desktop.logo.x,tilt:saved.tilt,repair:saved.productBuild.artworkRepair,objects:saved.objects};});
  assert.equal(restored.artwork,67);assert.equal(restored.tilt,24.1);assert.equal(restored.repair,'humboldt-product-decals-v1');assert.deepEqual(errors,[]);
  console.log('PASS Humboldt commons: exact Product decals, both widths, upper-shelf storage above 9°, Rearrange enabled, repeated frames, daily kits, restored layouts, selected-item tilt and persisted tilted state.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
