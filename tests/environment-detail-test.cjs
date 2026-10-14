const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out=path.join(root,'scene-shots/environment-detail');fs.mkdirSync(out,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(root,'assets/props/index.json'))),newProps=index.props.filter(p=>p.revision==='environment-detail-scale-20261013'||p.id==='ergoflex-laptop');
assert.equal(newProps.length,33);
for(const p of newProps){assert.ok(p.size.every(n=>Number.isFinite(n)&&n>0&&n<3000),p.id+' scale');assert.ok(fs.existsSync(path.join(root,p.file)));assert.ok(fs.existsSync(path.join(root,'assets/props/thumbs',p.id+'.png')));}
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,p;const errors=[],report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(path.join(out,'review.json'))).filter(r=>!r.failures.length):[];
const fresh=async()=>{await browser?.close();browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});p=await browser.newPage();await p.setViewport({width:1400,height:1000});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/Shader Error|WebGLProgram/.test(m.text()))errors.push(m.text())});await p.goto(`http://127.0.0.1:${server.address().port}/?room=office&view=room&ceiling=on`,{timeout:180000});await p.waitForFunction(()=>window.ErgoFlex?.sceneScreens&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{const e=ErgoFlex;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;});};
try{await fresh();const selected=process.argv.find(a=>a.startsWith('--scenes='))?.slice(9).split(',');const scenes=(await p.evaluate(()=>ErgoFlex.roomScenes.filter(s=>s.id!=='product').map(s=>s.id))).filter(s=>(!selected||selected.includes(s))&&!report.some(r=>r.scene===s));let count=0;
for(const scene of scenes){if(count++&&count%4===0)await fresh();console.log('Review '+scene);
 await p.evaluate(async scene=>{const e=ErgoFlex;e.setRoomScene(scene,false);await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);},scene);
 const layouts=await p.evaluate(scene=>[...document.querySelectorAll('#'+(scene==='creative'?'artist':scene)+'-room-size option')].map(o=>o.value),scene);
 for(const layout of (process.argv.includes('--all-layouts')?layouts:[process.argv.find(a=>a.startsWith('--layout='))?.slice(9)||layouts[0]])){const row=await p.evaluate(async({scene,layout})=>{
  const T=await import('three'),e=ErgoFlex;e.setMeasuredRoomLayout(scene,layout);await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;const r=e.workspaceRoom,failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg)};
  check(!r.missingProps.length,'Missing props '+r.missingProps.join(','));check(r.root.userData.surfaceDetail?.textureSize===256,'Surface pass absent');check(r.root.userData.decorationFinish?.suppliedActivityModels>0,'New daily models absent');
  const group=r.life.activity,base=o=>{o.updateMatrix();return new T.Matrix4().fromArray(o.userData.dailyDelta||new T.Matrix4().elements).invert().multiply(o.matrix);},originalBase=base(group),sources=new Set(),bad=[];
  r.root.traverse(o=>{if(!o.isMesh)return;for(const mat of [].concat(o.material)){
   if(mat.userData.roomSurface&&mat.bumpMap){check(!!o.geometry.attributes.uv1,o.name+' missing physical UV');check(Number.isFinite(mat.roughness)&&mat.roughness>=0&&mat.roughness<=1,'Invalid roughness');}
   for(const attr of (o.userData.sharedProp?[]:Object.values(o.geometry.attributes)))if(attr.array.some(n=>!Number.isFinite(n)))bad.push(o.name);
  }});check(!bad.length,'Invalid geometry '+bad.join(','));
  let first,phaseScreens=[];
  for(const phase of ['afternoon','morning','evening','night','party','afternoon']){
   e.setMeasuredRoomMode(scene,phase,false);e.sceneDesks.update(0);e.sceneScreens.update(true);r.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera);
   check(e.roomLightingState.shadowLights===1,'Extra shadow maps');check(r.root.userData.polish.mode===phase,'Wrong light phase');
   check(base(group).elements.every((n,i)=>Math.abs(n-originalBase.elements[i])<.00001),'Daily details changed saved owner pose');check(r.life.kits.filter(g=>g.visible).length===1,'Mixed activity kits');
   const visible=r.life.kits.find(g=>g.visible);visible.traverse(o=>{if(o.userData.sharedProp&&o.name.includes('daily detail')){sources.add(o.name);o.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(o).applyMatrix4(r.root.matrixWorld.clone().invert());check(b.getSize(new T.Vector3()).length()<600,'Oversized daily prop '+o.name);}});
   phaseScreens.push(e.sceneScreens.entries.filter(s=>s.obj.userData.sceneScreenStatus?.on).length);
   const powers=[...e.roomInteractions.scene.children.filter(o=>o.isLight),...r.root.children.filter(o=>o.isLight)].map(o=>o.intensity);
   if(phase==='afternoon'){if(first)check(JSON.stringify(first)===JSON.stringify(powers),'Light powers drifted');else first=powers;}
  }
  // Both desk widths must restore their own build after the visual pass.
  e.sceneDesks.select('main');const configs={};
  for(const size of ['48x30','60x30']){e.sceneDesks.setSize(size);await e.sceneDesks.objects.ready;const s=e.sceneDesks.active.state;configs[size]=JSON.stringify([s.style,s.accessories,s.artwork]);}
  for(const size of ['48x30','60x30']){e.sceneDesks.setSize(size);await e.sceneDesks.objects.ready;const s=e.sceneDesks.active.state;check(configs[size]===JSON.stringify([s.style,s.accessories,s.artwork]),size+' build did not restore');check(e.sceneDesks.active.peripherals.items.size>0,size+' missing peripherals');}
  return {scene,layout,materials:r.root.userData.surfaceDetail.materials,detailModels:[...sources],phases:5,desks:e.sceneDesks.records.size,screens:phaseScreens,drawCalls:e.renderer.info.render.calls,failures};
 },{scene,layout});report.push(row);console.log(JSON.stringify(row));fs.writeFileSync(path.join(out,selected?'focused-review.json':'review.json'),JSON.stringify(report,null,2));assert.deepEqual(row.failures,[],scene+'/'+layout);
 }
 if(['library','creative','occmedialab','hospital','gaming','music','lounge','kitchen'].includes(scene)){
  await p.select('#camera-view','room');await new Promise(r=>setTimeout(r,550));await p.evaluate(async()=>{const e=ErgoFlex;document.querySelector('.viewer-controls').hidden=true;document.querySelector('#motion-dock').classList.add('collapsed');e.renderer.setPixelRatio(1);e.renderer.shadowMap.enabled=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));e.workspaceRoom.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera)});await p.screenshot({path:path.join(out,scene+'-day.png')});
  await p.evaluate(scene=>{const e=ErgoFlex;e.setMeasuredRoomMode(scene,'night',false);e.sceneScreens.update(true);e.workspaceRoom.update(e.roomInteractions.camera);e.renderer.render(e.roomInteractions.scene,e.roomInteractions.camera)},scene);await p.screenshot({path:path.join(out,scene+'-night.png')});
 }
}
// A supplied laptop added to a desk must join the same screen controls as
// room laptops, without applying its generated image to the cached GLB.
const laptop=await p.evaluate(async()=>{
 const e=ErgoFlex,{PROP_LIBRARY}=await import('/workspace-3d.mjs?v=environment-detail-scale-20261013');
 e.setRoomScene('product',false);await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;
 const id=await e.sceneDesks.objects.add('ergoflex-laptop','desktop'),root=e.sceneDesks.active.objects.get(id).obj,glass=root.getObjectByName('monitor-screen');
 e.sceneScreens.allOn();e.sceneScreens.update(true);const entry=e.sceneScreens.entries.find(s=>s.obj===glass);
 if(!entry||!glass.material.map)throw Error('Added desk laptop screen unavailable');
 e.sceneScreens.setScreen(entry.key,false);if(glass.material.map||glass.material.emissiveIntensity)throw Error('Laptop power off failed');
 e.sceneScreens.setScreen(entry.key,true);const source=await PROP_LIBRARY.load('ergoflex-laptop');let clean=true;
 source.traverse(o=>{if(o.material?.name==='Decor screen glass')clean&&=!o.material.map&&o.material!==glass.material});
 return {screen:!!glass.material.map,cacheUnchanged:clean};
});assert.ok(laptop.screen&&laptop.cacheUnchanged);
// A cached raw export may contain millimetre/inch coordinates. Repair the
// source below the editable instance root, so saved 150% sizing stays 150%.
const units=await p.evaluate(async()=>{
 const T=await import('three'),{PROP_LIBRARY:L}=await import('/workspace-3d.mjs?v=environment-detail-scale-20261013');
 const loader=L.loader,rows=[];
 try{for(const [id,dimensions] of [['unit-mm',[300,30,200]],['unit-inch',[300/25.4,30/25.4,200/25.4]]]){
  const entry={id,file:'test-only.glb',size:[300,30,200]};L.index.props.push(entry);
  L.loader={load(url,ok){const source=new T.Group();source.add(new T.Mesh(new T.BoxGeometry(...dimensions),new T.MeshStandardMaterial()));ok({scene:source});}};
  const obj=await L.instance(id);obj.position.set(17,0,23);obj.scale.setScalar(1500);
  const copy=obj.clone(true);copy.position.set(0,0,0);const size=new T.Box3().setFromObject(copy).getSize(new T.Vector3()).toArray();
  if(size.some((n,i)=>Math.abs(n-[450,45,300][i])>.001))throw Error(id+' saved scale undid normalization');
  rows.push({id,size,position:obj.position.toArray()});L.index.props.pop();L.cache.delete(id);
 }}finally{L.loader=loader;}return rows;
});console.log('Saved instance scale after mixed-unit repair: '+JSON.stringify(units));
assert.deepEqual(errors,[]);console.log('PASS '+new Set(report.map(r=>r.scene)).size+' environments, '+report.length+' layouts, '+report.length*5+' time settings, both widths and 33 library models; added laptop screen and source material isolation.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
