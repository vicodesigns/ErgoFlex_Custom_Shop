// Isolated room audit: no user storage or saved Product recipes are touched.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-gallery-bedroom-sessions-20261025';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs');
 const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 for(const id of ['gallery','bedroom'])for(const layout of ['apartment','house','spacious','premium','executive']){
  r.set(id,{layout,scale:.001});await r.ready;
  const failures=[],check=(v,msg)=>{if(!v)failures.push(msg);},assets=r.assets(),l=r.roomLayout;
  const setting=assets.find(o=>o.name===(id==='gallery'?'Curator daily setting':'Bedroom daily setting'));
  check(!!setting,'Missing daily setting');check(!r.missingProps.length,'Missing props');
  const lights=[],contents=[],card=r.root.getObjectByName('Gallery daily programme'),blinds=[];
  const bounds=o=>{r.root.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o).applyMatrix4(r.root.matrixWorld.clone().invert());};
  for(const phase of ['morning','afternoon','evening','night','party']){
   r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();r.applyAtelierLighting(phase,1);
   const active=setting.children.filter(o=>o.visible);check(active.length===1,'Mixed daily contents '+phase);
   check(active[0]?.userData[id+'Session']===phase,'Incorrect daily setting '+phase);
   contents.push(active[0]?.uuid);if(card)check(card.material.map===card.ownedTextures[['morning','afternoon','evening','night','party'].indexOf(phase)],'Daily programme not changing '+phase);
   bounds(setting); const support=setting.parent.children.find(o=>o.isMesh&&Math.abs(o.position.y-(id==='gallery'?782:442.5))<.01);support.geometry.computeBoundingBox();const halfWidth=support.geometry.boundingBox.max.x;
   // Transform actual visible vertices into the supporting furniture frame.
   const local=new T.Box3();active[0]?.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();local.union(o.geometry.boundingBox.clone().applyMatrix4(setting.matrixWorld.clone().invert().multiply(o.matrixWorld)));}});
   check(local.min.x>=-halfWidth&&local.max.x<=halfWidth,'Contents extend past support sides '+phase);
   check(local.min.y >= (id==='gallery'?-.1:-240),'Contents below support/fold envelope '+phase);
   check(local.max.z <= (id==='gallery'?130:231)&&local.min.z>= (id==='gallery'?-130:-220),'Contents extend beyond usable surface '+phase);
   const lightState=()=>JSON.stringify(r.root.children.filter(o=>o.isPointLight).map(o=>[...o.color.toArray(),o.intensity]));
   lights.push(lightState());r.roomAtmosphere(phase);r.life.lightActivity();check(lightState()===lights.at(-1),'Lighting accumulates '+phase);
   const blind=r.root.getObjectByName(id==='gallery'?'Gallery daylight blind':'Window roman shade');blinds.push(blind.scale.y);
   for(const o of assets.filter(o=>o.parent===r.root&&o.position.y===0)){
    const f=bounds(o);check(f.min.x>=-l.width/2-1&&f.max.x<=l.width/2+1&&f.min.z>=l.back-1&&f.max.z<=l.back+l.depth+1,'Furniture outside room '+o.name+'/'+phase);
   }
  }
  check(new Set(lights).size===5,'Light states not distinct');check(new Set(contents).size===5,'Activity contents not distinct');check(new Set(blinds).size===5,'Blinds unchanged');
  if(id==='gallery')check(card.ownedTextures.length===5,'Missing daily programme print');
  setting.visible=false;r.roomAtmosphere('party');check(!setting.visible,'Deleted detail reappeared');setting.visible=true;
  const before=bounds(setting);setting.parent.position.x+=57;const after=bounds(setting);check(Math.abs(after.min.x-before.min.x-57)<.1,'Contents detached from support');setting.parent.position.x-=57;
  if(id==='bedroom'&&l.tier>=3){const photo=assets.find(o=>o.userData.propId==='photo-frame');check(Math.abs(bounds(photo).min.y-800)<.2,'Photo frame height '+bounds(photo).min.y+' root '+photo.position.y);}
  const bed=assets.find(o=>o.userData.atelierBed);if(id==='bedroom')check(!!bed,'Missing fitted bed');
  rows.push({id,layout,failures,lightStates:lights.length,variants:contents.length,props:assets.length});
 }
 r.set('product');return rows;
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));if(!process.env.AUDIT_ONLY)for(const row of report)assert.deepEqual(row.failures,[],row.id+'/'+row.layout);assert.deepEqual(errors,[]);console.log(JSON.stringify(report.map(r=>({id:r.id,layout:r.layout,failures:r.failures})),null,2));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
