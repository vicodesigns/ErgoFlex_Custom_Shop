// Every measured environment and layout: physical dressing and daypart regression.
// Uses an isolated document so no saved user designs are read or changed.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-gaming-sessions-20261022';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs?v=gaming-sessions-20261022');
 const {GAMING_LAYOUTS,GAMING_MODES}=await import('./gaming-room.mjs?v=gaming-sessions-20261022');
 const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 const intersects=(a,b,gap=0)=>a.min.x<b.max.x+gap&&a.max.x>b.min.x-gap&&a.min.z<b.max.z+gap&&a.max.z>b.min.z-gap;
 for(const layout of Object.keys(GAMING_LAYOUTS)){
  r.set('gaming',{layout,scale:.001});await r.ready;const failures=[],check=(v,msg)=>{if(!v)failures.push(msg);};
  const l=r.roomLayout,front=l.back+l.depth,assets=r.assets();
  const bounds=o=>{r.root.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o).applyMatrix4(r.root.matrixWorld.clone().invert());};
  const kit=assets.find(o=>o.name==='Player valet · activity details');check(!!kit,'Missing player valet');
  const variants=kit?.children.filter(o=>o.userData.gamingSession)||[];check(variants.length===5,'Missing activity variants');
  const maps=new Set();r.root.traverse(o=>{const map=o.material?.map;if(map?.image?.getContext&&[[768,768],[512,160]].some(([w,h])=>map.image.width===w&&map.image.height===h))maps.add(map);});
  const signature=map=>{const bytes=map.image.getContext('2d').getImageData(0,0,map.image.width,map.image.height).data;let hash=0;for(let i=0;i<bytes.length;i+=64)hash=(Math.imul(hash,31)+bytes[i])|0;return hash;};
  const signatures=[],lights=[];
  const rugs=r.root.userData.gamingRugs;check(rugs.length===(l.compact?1:2),'Missing rugs');if(rugs.length===2)check(rugs[0].z+rugs[0].depth/2+79<=rugs[1].z-rugs[1].depth/2,'Rugs overlap');
  for(const rug of r.root.children.filter(o=>o.userData.gamingRug)){
   const old=rug.userData.gamingRug==='desk'?[l.desk[0],4,l.desk[1]+650]:[-l.width/2+1400,4,l.loungeZ];
   const saved={p:{x:old[0],y:old[1],z:old[2]},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}},restored=r.migrateSavedTransform(rug,saved);
   check(['x','y','z'].every(k=>restored.p[k]===rug.position[k]),'Legacy rug restores overlapping position');
   const moved={...saved,p:{...saved.p,z:saved.p.z+100}};check(r.migrateSavedTransform(rug,moved)===moved,'Custom rug placement replaced');
  }
  for(const phase of ['morning','afternoon','evening','night','party']){
   r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();
   check(variants.filter(o=>o.visible).length===1&&variants.find(o=>o.visible)?.userData.gamingSession===phase,'Wrong activity '+phase);
   check(r.root.userData.gamingSession.phase===phase,'Missing session state');signatures.push([...maps].map(signature).join(','));
   const lightState=()=>JSON.stringify(r.root.children.filter(o=>o.isPointLight).map(o=>[...o.color.toArray(),o.intensity]));const before=lightState();r.roomAtmosphere(phase);r.life.lightActivity();check(before===lightState(),'Accumulating light '+phase);lights.push(before);
   const entry=l.compact?new T.Box3(new T.Vector3(-l.width/2,0,front-945),new T.Vector3(-l.width/2+650,2300,front-95)):new T.Box3(new T.Vector3(-200,0,front-380),new T.Vector3(700,2300,front));
   for(const o of assets.filter(o=>o.parent===r.root&&o.position.y===0)){
    const b=bounds(o);check(b.min.x>=-l.width/2-1&&b.max.x<=l.width/2+1&&b.min.z>=l.back-1&&b.max.z<=front+1,'Furniture outside room '+o.name+'/'+phase);
    check(!intersects(b,entry),'Entrance obstructed by '+o.name+'/'+phase);
   }
   if(l.large){const table=assets.find(o=>o.userData.propId==='ergoflex-game-table');for(const stool of assets.filter(o=>o.userData.propId?.startsWith('gaming-stool'))){check(!intersects(bounds(stool),bounds(table),35),'Stool collides with game table');for(const other of assets.filter(o=>o!==stool&&o!==table&&o.parent===r.root&&o.position.y===0))check(!intersects(bounds(stool),bounds(other),10),'Stool collides with '+other.name+'/'+phase);}}
  }
  check(new Set(signatures).size===5,'Wall graphics unchanged');check(new Set(lights).size===5,'Lighting states not distinct');
  check(GAMING_MODES.night.rgb<GAMING_MODES.evening.rgb&&GAMING_MODES.night.stream<.1,'Night glare not reduced');
  kit.visible=false;r.roomAtmosphere('morning');check(!kit.visible,'User-hidden kit restored');kit.visible=true;
  // Local decor follows its supporting table when that table is moved.
  const b0=bounds(kit);kit.parent.position.x+=70;const b1=bounds(kit);check(Math.abs(b1.min.x-b0.min.x-70)<.1,'Valet detached from support');kit.parent.position.x-=70;
  const changed=l.compact?['kenney-furniture-lamp-square-floor',-l.width/2+160,0,front-280,0]:l.large?['ergoflex-game-table',400,0,front-950,0]:null;
  if(changed){const [id,x,y,z,turn]=changed,o=assets.find(o=>o.userData.propId===id),a=turn*Math.PI/360;
   const saved={p:{x,y,z},q:{x:0,y:Math.sin(a),z:0,w:Math.cos(a)},s:{x:1000,y:1000,z:1000}},placement=l.props.find(p=>p.id===id);
   const restored=r.migrateSavedTransform(o,saved);check(restored.p.x===placement.at[0]&&restored.p.z===placement.at[2],'Untouched legacy placement not migrated');
   const moved={...saved,p:{...saved.p,x:x+35}},scaled={...saved,s:{...saved.s,x:990}},rotated={...saved,q:{x:0,y:Math.sin(.1),z:0,w:Math.cos(.1)}};
   check([moved,scaled,rotated].every(edit=>r.migrateSavedTransform(o,edit)===edit),'Custom furnishing edit overwritten');
  }
  check(!r.missingProps.length,'Missing props');rows.push({layout,phases:5,signatures,failures});
  const key=`gaming:${layout}:placement:100:0:Abstract gaming artwork`,oldKey=`scene:gaming:${layout}:placement:90:0:Abstract gaming artwork`,transform={p:{x:12,y:34,z:56}};
  const state={transforms:new Map([[oldKey,transform]]),removed:new Set([oldKey])};
  r.migrateSavedAssets([{userData:{sceneAssetKey:key}}],state);check(state.transforms.get('scene:'+key)===transform&&state.removed.has('scene:'+key),'Legacy fixture edit/deletion orphaned');
  const independent={transforms:new Map([[oldKey,transform],['scene:'+key,{p:{x:999}}]]),removed:new Set()};r.migrateSavedAssets([{userData:{sceneAssetKey:key}}],independent);check(independent.transforms.get('scene:'+key).p.x===999,'Current fixture edit replaced');
  const unrelated={transforms:new Map([[oldKey.replace(`gaming:${layout}`,`gaming:another-layout`),transform]]),removed:new Set()};r.migrateSavedAssets([{userData:{sceneAssetKey:key}}],unrelated);check(!unrelated.transforms.has('scene:'+key),'Other layout edit copied');
  if(!l.compact){const art={name:'Abstract gaming artwork',userData:{}},saved={p:{x:l.width/2-24,y:1750,z:350},q:{x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2},s:{x:1,y:1,z:1}};check(r.migrateSavedTransform(art,saved).p.y===l.height-400,'Legacy poster not raised');const moved={...saved,p:{...saved.p,y:1800}};check(r.migrateSavedTransform(art,moved)===moved,'Custom poster move overwritten');}
 }
 r.set('product');return rows;
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));for(const row of report)assert.deepEqual(row.failures,[],row.layout);assert.deepEqual(errors,[]);console.log('PASS: 25 Gaming room/activity states; entry clearance, game seating, changing graphics, stable lighting, hidden items and attached decor.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
