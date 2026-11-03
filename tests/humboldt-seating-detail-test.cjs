// Isolated room audit; never reads or writes the owner's saved browser scenes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-humboldt-seating-20261023';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs');const r=new WorkspaceRoom(new T.Scene(),.001);r.set('library',{layout:'humboldt',scale:.001});await r.ready;
 const chairs=r.assets().filter(o=>o.userData.humboldtChair),lamps=r.assets().filter(o=>o.userData.humboldtReadingLamp),checks=[],failures=[],check=(v,msg)=>{if(!v)failures.push(msg);};
 check(chairs.length===r.roomLayout.props.filter(p=>p.id==='kenney-furniture-chair-modern-cushion').length,'A general chair still uses the old model');check(chairs.length>50,'Missing seating');check(lamps.length===12,'Reading lamps missing');
 const geometry=new Set(),finishes=new Set(),rootInv=()=>r.root.matrixWorld.clone().invert();
 for(const chair of chairs){const model=chair.getObjectByName('Humboldt oak study chair');check(!!model,'Missing chair geometry');model.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});finishes.add(chair.userData.humboldtChair.finish);const b=new T.Box3().setFromObject(model).applyMatrix4(rootInv()),d=b.getSize(new T.Vector3());check(d.y>780&&d.y<830,'Chair height distorted');check(Math.abs(b.min.y)<.1,'Chair off floor');}
 check(geometry.size===4,'Chair geometry duplicated');check(finishes.size===4,'Missing coordinated finishes');
 // Oriented chair rectangles, not axis-aligned bounds of the rotated chairs.
 const rectangle=o=>{const model=o.getObjectByName('Humboldt oak study chair'),b=new T.Box3();model.children.filter(o=>o.isMesh).forEach(o=>{o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox);});return [[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z]].map(([x,z])=>new T.Vector3(x,0,z).applyMatrix4(model.matrixWorld).applyMatrix4(rootInv()));};
 const overlap=(a,b,gap=15)=>{for(const p of [a,b])for(let i=0;i<4;i++){const d=p[(i+1)%4].clone().sub(p[i]),n=new T.Vector3(-d.z,0,d.x).normalize(),aa=a.map(v=>v.dot(n)),bb=b.map(v=>v.dot(n));if(Math.max(...aa)+gap<=Math.min(...bb)||Math.max(...bb)+gap<=Math.min(...aa))return false;}return true;};
 const signatures=[];
 for(const phase of ['morning','afternoon','evening','night','party']){
  r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();r.root.updateWorldMatrix(true,true);
  const shapes=chairs.map(rectangle),collisions=[];
  for(let i=0;i<chairs.length;i++)for(let j=i+1;j<chairs.length;j++)if(overlap(shapes[i],shapes[j]))collisions.push({a:chairs[i].userData.sceneAssetKey,b:chairs[j].userData.sceneAssetKey,at:chairs[i].position.toArray(),bt:chairs[j].position.toArray()});
  check(!collisions.length,'Chair collision in '+phase);
  for(let i=0;i<shapes.length;i++)for(const p of shapes[i])check(p.x>=-4400&&p.x<=(p.z>9000?6000:9000)&&p.z>=-7000&&p.z<=28000,'Chair outside room in '+phase);
  const light=()=>r.root.children.filter(o=>o.isPointLight).map(o=>o.intensity).concat(r.root.userData.humboldtReadingDetail.power);
  const before=JSON.stringify(light());r.roomAtmosphere(phase);r.life.lightActivity();check(before===JSON.stringify(light()),'Lighting accumulates '+phase);signatures.push(before);
  checks.push({phase,collisions,lights:light(),readingDetail:r.root.userData.humboldtReadingDetail});
 }
 check(new Set(signatures).size===5,'Activity lighting not distinct');check(r.root.children.filter(o=>o.isPointLight).length===5,'Extra real-time lights');
 // New children follow their existing editable support, and hidden lamps stay hidden.
 const lamp=lamps[0],p0=lamp.getWorldPosition(new T.Vector3());lamp.parent.position.x+=100;r.root.updateWorldMatrix(true,true);const p1=lamp.getWorldPosition(new T.Vector3());check(Math.abs(p1.distanceTo(p0)-.1)<1e-5,'Lamp detached from table');lamp.parent.position.x-=100;
 lamp.visible=false;r.roomAtmosphere('evening');check(!lamp.visible,'Deleted/hidden lamp reappears');
 r.life.apply('morning');const chair=chairs[0];chair.position.x+=33;const p=chair.position.clone();for(let i=0;i<3;i++){r.life.apply('party');r.life.apply('night');r.life.apply('morning');}check(chair.position.distanceTo(p)<.001,'Chair activity cycle loses user edit');
 let retired=0;geometry.forEach(g=>g.addEventListener('dispose',()=>retired++));r.set('product');check(retired===4,'Chair geometry not disposed');
 return {checks,failures,chairs:chairs.length,finishes:[...finishes],geometries:geometry.size};
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify(report,null,2));if(!process.env.AUDIT_ONLY)assert.deepEqual(report.failures,[]);assert.deepEqual(errors,[]);
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
