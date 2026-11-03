// Every measured environment and layout: physical dressing and daypart regression.
// Uses an isolated document so no saved user designs are read or changed.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-gym-sessions-20261022';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs?v=gym-sessions-20261022');
 const {GYM_LAYOUTS,GYM_MODES}=await import('./gym-room.mjs?v=gym-sessions-20261022');
 const {migrateGymSavedFurniture}=await import('./gym-session-detail.mjs?v=gym-sessions-20261022');
 const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 const intersects=(a,b)=>a.min.x<b.max.x-1&&a.max.x>b.min.x+1&&a.min.z<b.max.z-1&&a.max.z>b.min.z+1;
 for(const layout of Object.keys(GYM_LAYOUTS)){
  r.set('gym',{layout,scale:.001});await r.ready;const failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg);};
  const l=r.roomLayout,front=l.back+l.depth,assets=r.assets(),find=id=>assets.find(o=>o.userData.propId===id);
  const bounds=o=>{r.root.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o).applyMatrix4(r.root.matrixWorld.clone().invert());};
  const exercise=bounds(find('training-zone')),entry=new T.Box3(new T.Vector3(-l.width/2,0,front-870),new T.Vector3(-l.width/2+950,2300,front-70));
  const fixtures=['dumbbell-rack','weight-bench','spin-bike','power-rack','treadmill','boxing-station','conditioning-shelf','kenney-furniture-bench-cushion-low','decor-plant2','basketball'];
  for(const id of fixtures){const o=find(id);if(!o)continue;check(!intersects(exercise,bounds(o)),'Training bay intersects '+id);check(!intersects(entry,bounds(o)),'Door approach blocked by '+id);}
  if(l.tier===3)check(!intersects(bounds(find('conditioning-shelf')),bounds(find('treadmill'))),'Conditioning shelf intersects treadmill');
  check(!r.missingProps.length,'Missing props');
  const kit=assets.find(o=>o.name.startsWith('Session equipment')),rig=find('gym-props-3');
  const variants=kit.children,board=find('training-board'),maps=new Set();board.traverse(o=>{if(o.material?.map)maps.add(o.material.map);});
  const boardMap=[...maps].find(m=>m.image.width===768&&m.image.height===720),timerMap=[...maps].find(m=>m.image.width===512&&m.image.height===176);
  const signature=map=>{const bytes=map.image.getContext('2d').getImageData(0,0,map.image.width,map.image.height).data;let hash=0;for(let i=0;i<bytes.length;i+=64)hash=(Math.imul(hash,31)+bytes[i])|0;return hash;};
  const signatures=[],lightSignatures=[],start=r.life.entries.flatMap(e=>e.objects).map(o=>({o,p:o.position.clone()}));
  for(const phase of ['morning','afternoon','evening','night','party']){
   r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();
   check(variants.filter(o=>o.visible).length===1&&variants.find(o=>o.visible).userData.gymSession===phase,'Wrong activity kit '+phase);
   check(rig.children.some(o=>o.visible)===['afternoon','party'].includes(phase),'Training rig visibility '+phase);
   check(r.root.userData.gymSession.floorClear===(phase==='night'),'Night floor state '+phase);
   signatures.push([signature(boardMap),signature(timerMap)]);
   const lights=()=>r.root.children.filter(o=>o.isPointLight).map(o=>[...o.color.toArray(),o.intensity]);const before=JSON.stringify(lights());
   r.roomAtmosphere(phase);r.life.lightActivity();check(JSON.stringify(lights())===before,'Lighting accumulates '+phase);lightSignatures.push(before);
  }
  check(new Set(signatures.map(s=>s[0])).size===5&&new Set(signatures.map(s=>s[1])).size===5,'Static board or timer');
  check(new Set(lightSignatures).size===5,'Lighting states not distinct');
  check(GYM_MODES.night.tilt===65&&GYM_MODES.night.height>=42.5,'Storage clearance for both widths');
  r.life.apply('morning');check(start.every(({o,p})=>p.distanceTo(o.position)<.001),'Equipment shifts after phase round trip');
  kit.visible=false;r.roomAtmosphere('afternoon');check(!kit.visible,'Hidden parent restored by activity');kit.visible=true;
  const bench=find('kenney-furniture-bench-cushion-low'),a=Math.PI/2;
  const saved={p:{x:-l.width/2+350,y:0,z:front-600},q:{x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)},s:{x:1000,y:1000,z:1000}};
  const migrated=migrateGymSavedFurniture(bench,saved,l),edited={...saved,p:{...saved.p,x:saved.p.x+25}};
  check(migrated.p.x===l.recovery[0]&&migrated.p.z===l.recovery[1],'Default bench migration');check(migrateGymSavedFurniture(bench,edited,l)===edited,'Custom move overwritten');
  rows.push({layout,phases:5,boardAndTimer:signatures,entryClear:!failures.some(f=>f.startsWith('Door')),failures});
 }
 r.set('product');return rows;
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));for(const r of report)assert.deepEqual(r.failures,[],r.layout);assert.deepEqual(errors,[]);console.log('PASS: 5 gym layouts × 5 activities; entry and equipment clearance, dynamic displays, stable lighting, hidden items and saved-edit migration.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
