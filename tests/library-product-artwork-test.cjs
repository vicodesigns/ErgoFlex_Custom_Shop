const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out=path.join(root,'scene-shots/library-product-artwork');fs.mkdirSync(out,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(root,'assets/props/index.json'))),newProps=index.props.filter(p=>p.revision==='environment-detail-scale-20261013');
assert.equal(newProps.length,33);
for(const p of newProps){assert.ok(p.size.every(n=>Number.isFinite(n)&&n>0&&n<3000),p.id+' scale');assert.ok(fs.existsSync(path.join(root,p.file)));assert.ok(fs.existsSync(path.join(root,'assets/props/thumbs',p.id+'.png')));}
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1400,height:1000});
 await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`,{timeout:180000});await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});return p.evaluate(async()=>{const e=ErgoFlex;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;await e.surfaceArtwork.refresh();});};await ready();
 const expected=await p.evaluate(async()=>{
  const e=ErgoFlex,project=e.serializeProject(),entry=project.presentation.buildPresets.entries.library,{defaultArtworkLayer,cleanArtwork}=await import('/artwork-config.mjs');
  for(const draft of [entry,...Object.values(entry.sizeSetups)]){
   const size=draft.config.size,c=document.createElement('canvas');c.width=384;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle=size==='48x30'?'#ffffff':'#efbb53';ctx.fillRect(0,0,384,160);ctx.fillStyle='#194c37';ctx.font='bold 34px sans-serif';ctx.fillText('LIBRARY '+size.slice(0,2),25,96);
   const layer={...defaultArtworkLayer('logo'),image:c.toDataURL('image/png'),name:'Owner '+size,enabled:true,scale:60,x:size==='48x30'?44:54,y:50};
   draft.revision=31;draft.config.artwork={version:1,surfaces:Object.fromEntries(['desktop','right-panel','footrest-panel'].map(id=>[id,{logo:{...layer}}]))};
  }
  await e.applyProject(project);e.setRoomScene('library',false);await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;
  return Object.fromEntries([entry,...Object.values(entry.sizeSetups)].map(d=>[d.config.size,{artwork:cleanArtwork(d.config.artwork),style:d.config,objects:d.room.desks.main.objects}]));
 });await ready();
 for(const layout of ['apartment','house','spacious','premium','executive']){
  await p.evaluate(async layout=>{ErgoFlex.setMeasuredRoomLayout('library',layout);await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;},layout);
  for(const size of ['48x30','60x30']){
   const result=await p.evaluate(async({size,expected})=>{
    const e=ErgoFlex,m=e.sceneDesks;m.setSize(size);await m.objects.ready;await e.surfaceArtwork.refresh();
    const r=m.active,art=r.rig.group.children.filter(o=>o.userData.surfaceArtwork),visible=[...e.surfaceArtwork.bindings.values()].flatMap(b=>[...b.layers.values()]).filter(l=>l.mesh.visible);
    for(const [id,want] of Object.entries(expected.objects)){
     const obj=r.objects.get(id)?.obj;if(!obj)throw Error(id+' missing');for(const axis of ['x','y','z'])if(Math.abs(obj.position[axis]-want.transform.p[axis])>1e-5)throw Error(size+' '+id+' position '+axis);
    }
    if(JSON.stringify(r.state.artwork)!==JSON.stringify(expected.artwork))throw Error(size+' artwork state mismatch '+JSON.stringify({actual:r.state.artwork,expected:expected.artwork},(k,v)=>k==='image'?v.slice(0,40):v));
    if(r.state.style.woodFinish!==expected.style.woodFinish||r.state.style.trimColor!==expected.style.trimColor)throw Error(size+' finish mismatch');
    if(art.length!==3||visible.length!==3)throw Error(size+' rendered artwork missing');
    if(art.some(o=>o.visible))throw Error('Inactive duplicate over active desk');
    return {size,graphics:visible.length,batchedGraphics:art.length,layout:m.key};
   },{size,expected:expected[size]});console.log(JSON.stringify(result));
  }
 }
 const extra=await p.evaluate(async()=>{
  const e=ErgoFlex,m=e.sceneDesks,added=m.add('48x30');if(!added)throw Error('Could not add Library desk');await m.objects.ready;m.select('main');await e.surfaceArtwork.refresh();
  const r=m.records.get(added),art=r.rig.group.children.filter(o=>o.userData.surfaceArtwork);
  if(art.length!==3||art.some(o=>!o.visible))throw Error('Additional desk decals not visible');
  r.rig.updatePose(46,35);const bodies=r.rig.group.children.filter(o=>o.isMesh&&!o.userData.surfaceArtwork);
  for(const graphic of art)if(!bodies.some(o=>o.matrix.elements.every((v,i)=>Math.abs(v-graphic.matrix.elements[i])<1e-5)))throw Error('Decal does not follow desktop tilt');
  const source=e.serializeProject().presentation.buildPresets.entries.library;
  e.surfaceArtwork.state.surfaces.desktop.logo.x=61;e.surfaceArtwork.commit();await m.active.rig.artworkReady;
  if(JSON.stringify(e.serializeProject().presentation.buildPresets.entries.library)!==JSON.stringify(source))throw Error('Room edit overwrote Product build');
  const wide=JSON.stringify(m.active.state.artwork);m.setSize('48x30');await m.objects.ready;const narrow=JSON.stringify(m.active.state.artwork);m.setSize('60x30');await m.objects.ready;
  if(JSON.stringify(m.active.state.artwork)!==wide||narrow===wide)throw Error('Width artwork not isolated');
  m.persist();return {extraDesk:added,graphics:art.length,tiltFollows:true,widthIsolation:true};
 });console.log(JSON.stringify(extra));
 await p.select('#camera-view','room');await p.evaluate(async()=>{const e=ErgoFlex;document.querySelector('.viewer-controls').hidden=true;e.renderer.setPixelRatio(1);e.renderer.shadowMap.enabled=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));e.workspaceRoom.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera)});await p.screenshot({path:path.join(out,'library-decals.png')});
 await p.goto(`http://127.0.0.1:${server.address().port}/?room=library&view=room&layout=executive`);await ready();const restored=await p.evaluate(()=>ErgoFlex.sceneDesks.active.state);assert.equal(restored.productBuild.id,'library');assert.equal(restored.artwork.surfaces.desktop.logo.x,61);assert.deepEqual(errors,[]);
 console.log('PASS Library Product build: five layouts, both widths, three rendered decal surfaces, additional desk, tilt, independent editing and reload.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
