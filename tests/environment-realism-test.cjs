// Every measured environment and layout: physical dressing and daypart regression.
// Uses an isolated document so no saved user designs are read or changed.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-environment-realism-20261019';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report=[],errors=[];
try{browser=await puppeteer.launch({headless:true,protocolTimeout:600000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
let page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const ids=await page.evaluate(async()=>{const {ROOM_SCENES}=await import('./workspace-3d.mjs?v=environment-realism-20261019');return ROOM_SCENES.filter(s=>s.id!=='product').map(s=>s.id);});
for(const id of ids.filter(id=>!process.env.REALISM_SCENES||process.env.REALISM_SCENES.split(',').includes(id))){console.log('Checking',id);const rows=await page.evaluate(async id=>{
 const T=await import('three'),{WorkspaceRoom,PROP_LIBRARY,disposeWorkspaceObject}=await import('./workspace-3d.mjs?v=environment-realism-20261019'),{INSTITUTIONAL_ROOMS}=await import('./institutional-scenes.mjs?v=environment-expert-20261014');
 const {LIFE_DETAILS}=await import('./room-life-detail.mjs?v=environment-realism-20261019');
 const {roomViewBounds}=await import('./room-view-bounds.mjs?v=activity-composition-20261020');
 const {STUDY_TOPICS}=await import('./room-study-graphics.mjs?v=activity-composition-20261020');
 const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 const layouts=INSTITUTIONAL_ROOMS[id]?Object.keys(INSTITUTIONAL_ROOMS[id].layouts):['apartment','house','spacious','premium','executive',...(id==='library'?['humboldt']:[])];
 for(const layout of layouts){r.set(id,{layout,scale:.001});await r.ready;const failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg);};
 check(!r.missingProps.length,'Missing props '+r.missingProps);check(r.life.kits.length===5,'Missing activities');
 check(r.life.kits.every(k=>k.userData.lifeDetail?.kind===LIFE_DETAILS[id]),'Room-specific dressing missing');
 check(r.root.userData.surfaceDetail?.materials>0,'Surface refinement absent');
 check(STUDY_TOPICS[id]?.length===5,'Contextual work notes missing');
 check(r.root.userData.activitySupports?.every(s=>s.resolved),'Activity has no measured supporting surface');
 if(id==='home'&&layout==='apartment')for(const [prop,x,z,turn] of [['steelcase-leap-v2',0,680,180],['armchair-poppi',690,1450,-140]]){
  const o=r.assets().find(o=>o.userData.propId===prop),a=turn*Math.PI/360;
  const saved={p:{x,y:0,z},q:{x:0,y:Math.sin(a),z:0,w:Math.cos(a)},s:{x:1000,y:1000,z:1000}};
  const migrated=r.migrateSavedTransform(o,saved),placement=r.roomLayout.props.find(p=>p.id===prop);
  check(migrated.p.x===placement.at[0]&&migrated.p.z===placement.at[2],'Untouched home default not migrated');
  const edited={...saved,p:{...saved.p,x:x+15}},scaled={...saved,s:{...saved.s,x:900}};
  check(r.migrateSavedTransform(o,edited)===edited&&r.migrateSavedTransform(o,scaled)===scaled,'User furniture edit overwritten by migration');
 }
 for(const material of r.life.printedPages.values())check(['paper-fibre','woven-bookcloth'].includes(material.userData.activityFinish)&&material.bumpMap&&material.bumpScale<.001,'Missing/substantially oversized notebook surface relief');
 const supportMeshes=[];
 r.root.traverse(o=>{if(!o.isMesh||o.userData.presentationOnly)return;for(let p=o;p;p=p.parent)if(p===r.life.activity||p===r.life.shared)return;supportMeshes.push(o);});

 // Camera framing ignores huge hidden variants / overlays but includes a
 // real furnishing the user has deliberately moved outside the shell.
 const frame=roomViewBounds(r),probe=new T.Mesh(new T.BoxGeometry(100,100,100),new T.MeshBasicMaterial());
 probe.userData.sceneAsset=true;probe.position.set(r.roomLayout.width*5,100,0);probe.visible=false;r.root.add(probe);
 check(roomViewBounds(r).equals(frame),'Hidden asset changes whole-room framing');
 probe.visible=true;probe.userData.presentationOnly=true;
 check(roomViewBounds(r).equals(frame),'Lighting overlay changes whole-room framing');
 delete probe.userData.presentationOnly;
 check(!roomViewBounds(r).equals(frame),'Moved visible furnishing excluded from frame');
 probe.removeFromParent();probe.geometry.dispose();probe.material.dispose();
 // Fitted replacement foliage must retain the old footprint and saved scale.
 r.root.updateWorldMatrix(true,true);
 r.root.traverse(o=>{if(!o.userData.botanicalFit)return;
  const box=new T.Box3(),inverse=o.matrixWorld.clone().invert();
  o.traverse(mesh=>{if(!mesh.geometry)return;mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));});
  const actual=box.getSize(new T.Vector3()).multiply(o.scale).toArray(),old=PROP_LIBRARY.entry(o.userData.propId).size;
  check(actual.every((v,i)=>Number.isFinite(v)&&v<=old[i]+1),'Replacement plant exceeds original dimensions');
  check(o.scale.x===1000,'Plant fit overwrites editable saved scale');
 });
 // An instance finish must never leak into cached GLBs / other environments.
 if(id==='office'&&layout==='apartment')for(const variant of ['ergoflex-triangle-table','ergoflex-triangle-table-acrylic']){
  const table=await PROP_LIBRARY.instance(variant),source=await PROP_LIBRARY.load(variant),copy=await PROP_LIBRARY.instance(variant);
  const meshes=[],copies=[],sourceMeshes=[];table.traverse(o=>{if(o.isMesh)meshes.push(o);});copy.traverse(o=>{if(o.isMesh)copies.push(o);});source.traverse(o=>{if(o.isMesh)sourceMeshes.push(o);});
  const size=new T.Box3().setFromObject(table).getSize(new T.Vector3()).toArray();
  check(size.every((v,i)=>Math.abs(v-PROP_LIBRARY.entry(variant).size[i])<2),'Triangle table dimensions changed');
  check(meshes.every((m,i)=>m.geometry!==sourceMeshes[i].geometry&&m.material!==copies[i].material&&!m.userData.sharedProp&&m.geometry.attributes.uv.array.every(Number.isFinite)),'Triangle finish ownership or UVs invalid');
  check(meshes.some(m=>m.material.metalness>.9&&m.material.roughnessMap),'Triangle steel brushing missing');
  check(variant.endsWith('acrylic')?meshes.some(m=>m.material.transmission>.8&&m.material.ior===1.49):meshes.some(m=>m.material.map?.colorSpace===T.SRGBColorSpace),'Triangle top finish missing');
  const resources=new Set();meshes.forEach(m=>{resources.add(m.geometry);resources.add(m.material);for(const value of Object.values(m.material))if(value?.isTexture)resources.add(value);});
  let disposed=0,sourceDisposed=0;resources.forEach(o=>o.addEventListener('dispose',()=>disposed++));sourceMeshes.forEach(o=>o.geometry.addEventListener('dispose',()=>sourceDisposed++));
  disposeWorkspaceObject(table);check(disposed===resources.size&&!sourceDisposed,'Triangle disposal leaks or damages cached geometry');disposeWorkspaceObject(copy);
 }
 for(const pending of PROP_LIBRARY.cache.values()){
  const source=await pending;source.traverse(o=>{for(const mat of [].concat(o.material||[]))check(!mat.userData.roomPropFinish,'Room finish leaked into cached model');});
 }
 const positions=r.life.entries.flatMap(e=>e.objects);r.life.apply('morning');const before=positions.map(o=>o.matrix.clone());
 const signatures=[];
 for(const phase of ['afternoon','evening','night','party','morning']){r.roomAtmosphere?.(phase,1);r.life.apply(phase);r.life.lightActivity();
  check(r.life.kits.filter(g=>g.visible).length===1,'Overlapping daypart kits');r.root.updateWorldMatrix(true,true);
  check(r.root.userData.seatingClearance?.every(s=>s.resolved),'Unresolved lounge seating clearance '+phase);
  for(const chair of r.life.entries.filter(e=>e.role==='reading-chair'))for(const table of r.life.entries.filter(e=>e.role==='table'||id==='home'&&layout==='apartment'&&e.role==='main-chair')){
   const a=chair.footprint.clone().applyMatrix4(chair.delta),b=table.footprint.clone().applyMatrix4(table.delta);
   const dx=Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x),dz=Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z);
   check(dx<=1||dz<=1,'Lounge chair overlaps furniture '+phase+' / '+chair.objects[0].name+' / '+table.objects[0].name);
  }
  for(const group of [r.life.activity,r.life.shared].filter(o=>o?.visible)){
   const p=group.position.clone(),ray=new T.Raycaster(r.root.localToWorld(new T.Vector3(p.x,p.y+12,p.z)),new T.Vector3(0,-1,0),0,.3);
   const hit=ray.intersectObjects(supportMeshes.filter(o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}),false).find(h=>h.face?.normal.clone().transformDirection(h.object.matrixWorld).y>.95);
   const gap=hit?p.y-r.root.worldToLocal(hit.point.clone()).y:Infinity;
   check(Math.abs(gap-1)<3,'Activity surface contact mismatch '+phase+' / '+group.name+' / '+gap);
  }

  for(const o of positions)check(o.matrix.elements.every(Number.isFinite)&&o.matrixWorld.elements.every(Number.isFinite),'Non-finite furniture transform: '+o.name+' / '+phase);
  let signature=0;r.life.activity.traverseVisible(o=>{if(o.isMesh){signature+=o.geometry.attributes.position.count;check(o.geometry.attributes.position.array.every(Number.isFinite),'Non-finite detail geometry');}});signatures.push(signature);
 }
 const drift=positions.map((o,i)=>({name:o.name,delta:Math.max(...o.matrix.elements.map((v,j)=>Math.abs(v-before[i].elements[j])))})).filter(d=>d.delta>1e-5);check(!drift.length,'Daypart cycle drifts furniture '+JSON.stringify(drift));
 // New dressing cannot enlarge the selected book into a walkway or adjacent seat.
 r.root.traverse(book=>{if(!book.userData.activityBook)return;const detail=book.children.find(c=>c.name==='Personal work details');if(!detail)return;
 const box=new T.Box3();detail.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix));});
 check(box.isEmpty()||box.min.x>=-book.userData.activityBook.width/2-2&&box.max.x<=book.userData.activityBook.width/2+2&&box.min.z>=-73&&box.max.z<=73,'Detail exceeds notebook footprint');
 });
 // Hidden parent remains hidden across activities, preserving delete/undo state.
 r.life.activity.visible=false;r.life.apply('afternoon');check(!r.life.activity.visible,'Hidden asset restored by activity');
 rows.push({id,layout:r.roomLayout.id,phases:5,details:LIFE_DETAILS[id],easedEdges:r.root.userData.surfaceDetail.easedFurnitureEdges,signatures,failures});
 }r.set('product');return rows;
},id);report.push(...rows);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));for(const row of rows)assert.deepEqual(row.failures,[],id+'/'+row.layout);console.log('PASS',id,rows.length+' layouts');
}
assert.deepEqual(errors,[]);console.log('PASS',new Set(report.map(r=>r.id)).size,'environments,',report.length,'layouts,',report.length*5,'activity checks');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
