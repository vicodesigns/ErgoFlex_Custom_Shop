// Isolated room audit: no user storage or saved Product recipes are touched.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-home-sessions-20261022';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs');
 const {HOME_LAYOUTS}=await import('./home-office.mjs');const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 const intersects=(a,b,gap=0)=>a.min.x<b.max.x+gap&&a.max.x>b.min.x-gap&&a.min.z<b.max.z+gap&&a.max.z>b.min.z-gap;
 for(const layout of Object.keys(HOME_LAYOUTS)){
  r.set('home',{layout,scale:.001});await r.ready;const failures=[],check=(v,msg)=>{if(!v)failures.push(msg);},l=r.roomLayout;
  const bounds=o=>{r.root.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o).applyMatrix4(r.root.matrixWorld.clone().invert());};
  const assets=r.assets(),snapshots=[];
  const readingLamp=assets.find(o=>o.userData.homeReadingLamp),lounge=assets.find(o=>o.name==='Lounge daily setting');
  check(!!readingLamp,'Missing linen reading lamp');
  if(readingLamp){const b=bounds(readingLamp);check(b.max.y<1720&&b.max.y>1700&&Math.abs(b.min.y)<.1,'Reading lamp scale/contact');}
  check(!!lounge===['premium','executive'].includes(layout),'Wrong lounge layout');
  const kit=assets.find(o=>o.name==='Home coffee & reset tray'),variants=kit?.children.filter(o=>o.userData.homeSession)||[];check(variants.length===5,'Missing daily reset details');
  const board=r.root.getObjectByName('Cork pinboard').children.find(o=>o.material?.map?.image?.getContext)?.material.map,signatures=[];
  for(const phase of ['morning','afternoon','evening','night','party']){
   r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();
   if(lounge){const active=lounge.children.filter(o=>o.visible);check(active.length===1&&active[0].userData.homeLoungePhase===phase,'Lounge contents mix activities '+phase);const b=new T.Box3().setFromObject(active[0]).applyMatrix4(lounge.matrixWorld.clone().invert());check(b.min.y>=-.1&&b.max.x<=525&&b.min.x>=-525&&b.min.z>=-260&&b.max.z<=260,'Lounge items do not fit tabletop '+phase);}
   check(variants.filter(o=>o.visible).length===1&&variants.find(o=>o.visible)?.userData.homeSession===phase,'Wrong reset tray activity '+phase);
   signatures.push(board.image.toDataURL());
   const entryZ=l.entryZ??l.back+l.depth-650,entry=new T.Box3(new T.Vector3(-l.width/2,0,entryZ-440),new T.Vector3(-l.width/2+700,2100,entryZ+440));
   for(const o of assets.filter(o=>o.parent===r.root&&o.position.y===0)){
    const b=bounds(o);check(b.min.x>=-l.width/2-1&&b.max.x<=l.width/2+1&&b.min.z>=l.back-1&&b.max.z<=l.back+l.depth+1,'Furniture outside room '+o.name+'/'+phase);
    check(!intersects(b,entry),'Entry blocked '+o.name+'/'+phase);
   }
   const state=()=>JSON.stringify(r.root.children.filter(o=>o.isPointLight).map(o=>[...o.color.toArray(),o.intensity]));const light=state();r.roomAtmosphere(phase);r.life.lightActivity();check(state()===light,'Accumulating light '+phase);snapshots.push(light);
   check((r.root.userData.seatingClearance||[]).every(o=>o.resolved),'Unresolved seating clearance '+phase);
  }
  check(new Set(snapshots).size===5,'Lighting not distinct');check(!r.missingProps.length,'Missing props');
  check(new Set(signatures).size===5,'Pinboard unchanged');kit.visible=false;r.roomAtmosphere('morning');check(!kit.visible,'Hidden reset tray reappears');kit.visible=true;
  const b0=bounds(kit);kit.parent.position.x+=70;const b1=bounds(kit);check(Math.abs(b1.min.x-b0.min.x-70)<.1,'Tray does not follow cabinet');kit.parent.position.x-=70;
  if(lounge){lounge.visible=false;r.roomAtmosphere('evening');check(!lounge.visible,'Hidden lounge setting reappears');lounge.visible=true;const before=bounds(lounge);lounge.parent.position.x+=80;const after=bounds(lounge);check(Math.abs(after.min.x-before.min.x-80)<.1,'Lounge setting detached from table');lounge.parent.position.x-=80;}
  if(layout!=='apartment'){const guitar=assets.find(o=>o.userData.propId==='quaternius-guitar'),saved={p:{x:-l.width/2+85,y:650,z:150},q:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},s:{x:1000,y:1000,z:1000}};check(r.migrateSavedTransform(guitar,saved).p.z===l.back+l.depth-350,'Legacy guitar not moved with hanger');const moved={...saved,p:{...saved.p,z:200}},scaled={...saved,s:{...saved.s,x:900}};check([moved,scaled].every(v=>r.migrateSavedTransform(guitar,v)===v),'Custom guitar edits overwritten');}
  const rugs=r.root.userData.homeRugs;if(rugs)for(let i=0;i<rugs.length;i++)for(let j=i+1;j<rugs.length;j++)check(Math.abs(rugs[i].x-rugs[j].x)>=(rugs[i].width+rugs[j].width)/2+59||Math.abs(rugs[i].z-rugs[j].z)>=(rugs[i].depth+rugs[j].depth)/2+59,'Rugs overlap');
  for(const rug of r.root.children.filter(o=>o.userData.homeRug)){
   const old=rug.userData.homeRug==='desk'?[l.desk[0],2.5,layout==='apartment'?480:270]:rug.userData.homeRug==='reading'?[-970,2.5,1910]:[550,2.5,(layout==='executive'?3190:2510)+390];
   const saved={p:{x:old[0],y:old[1],z:old[2]},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}},restored=r.migrateSavedTransform(rug,saved);
   check(['x','y','z'].every(k=>restored.p[k]===rug.position[k]),'Legacy rug restores overlapping position');
   const moved={...saved,p:{...saved.p,z:saved.p.z+100}};check(r.migrateSavedTransform(rug,moved)===moved,'Custom rug placement replaced');
  }
  if(layout==='apartment')for(const [id,p]of [['modern-lamp',[990,741,-850]],['kenney-furniture-books',[915,1384,l.back+110]],['kenney-furniture-plant-small1',[1035,1784,l.back+110]]]){
   const obj=assets.find(o=>o.userData.propId===id),saved={p:{x:p[0],y:p[1],z:p[2]},q:{x:0,y:0,z:0,w:1},s:{x:1000,y:1000,z:1000}},placement=l.props.find(o=>o.id===id);
   check(r.migrateSavedTransform(obj,saved).p.x===placement.at[0],'Cabinet furnishing not migrated');
   const moved={...saved,p:{...saved.p,x:p[0]+20}},scaled={...saved,s:{...saved.s,x:900}};check([moved,scaled].every(s=>r.migrateSavedTransform(obj,s)===s),'Custom cabinet furnishing edit lost');
  }
  rows.push({layout,failures,props:assets.filter(o=>o.parent===r.root&&o.position.y===0).map(o=>({name:o.name,min:bounds(o).min.toArray(),max:bounds(o).max.toArray()}))});
 }
 r.set('product');return rows;
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));if(!process.env.AUDIT_ONLY)for(const row of report)assert.deepEqual(row.failures,[],row.layout);assert.deepEqual(errors,[]);console.log(JSON.stringify(report.map(r=>({layout:r.layout,failures:r.failures})),null,2));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
