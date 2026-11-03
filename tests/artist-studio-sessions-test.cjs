// Isolated room audit: no user storage or saved Product recipes are touched.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out='/tmp/ergoflex-artist-studio-sessions-20261025';fs.mkdirSync(out,{recursive:true});
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:180000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs');
 const r=new WorkspaceRoom(new T.Scene(),.001),rows=[];
 for(const layout of ['apartment','house','spacious','premium','executive']){
  r.set('creative',{layout,scale:.001});await r.ready;
  const failures=[],check=(v,msg)=>{if(!v)failures.push(msg);},assets=r.assets(),l=r.roomLayout;
  const canvas=r.root.getObjectByName('Artist evolving still life'),brief=r.root.getObjectByName('Artist session brief'),setting=r.root.getObjectByName('Artist daily palette');
  check(!!canvas&&!!brief,'Missing evolving studio artwork');check(!r.missingProps.length,'Missing props');
  const bounds=(o,frame=r.root)=>{r.root.updateWorldMatrix(true,true);const b=new T.Box3(),inv=frame.matrixWorld.clone().invert();o.traverse(m=>{if(!m.isMesh)return;if(m.isInstancedMesh){m.computeBoundingBox();b.union(m.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));}else{m.geometry.computeBoundingBox();b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));}});return b;};
  const lights=[],maps=[];
  for(const [i,phase] of ['morning','afternoon','evening','night','party'].entries()){
   r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();
   check(canvas.material.map===canvas.ownedTextures[i],'Wrong study stage '+phase);check(brief.material.map===brief.ownedTextures[i],'Wrong studio notes '+phase);maps.push(canvas.material.map.uuid);
   if(setting){
    const active=setting.children.filter(o=>o.visible);check(active.length===1&&active[0].userData.artistSession===phase,'Mixed palette contents '+phase);
    const b=bounds(active[0],setting);check(b.min.x>=-235&&b.max.x<=235&&b.min.z>=-235&&b.max.z<=235&&b.min.y>=0,'Palette contents off taboret '+phase);
   }
   const lightState=()=>JSON.stringify(r.root.children.filter(o=>o.isPointLight).map(o=>[...o.color.toArray(),o.intensity]));lights.push(lightState());r.roomAtmosphere(phase);r.life.lightActivity();check(lightState()===lights.at(-1),'Lighting accumulates '+phase);
  }
  check(new Set(maps).size===5,'Duplicate study stages');check(new Set(lights).size===5,'Duplicate lighting states');
  if(setting){setting.visible=false;r.roomAtmosphere('party');check(!setting.visible,'Deleted daily palette reappeared');setting.visible=true;const before=bounds(setting);setting.parent.position.x+=57;const after=bounds(setting);check(Math.abs(after.min.x-before.min.x-57)<.1,'Palette detached from support');setting.parent.position.x-=57;}
  const easel=r.root.getObjectByName('Artist painting easel');
  if(easel){const art=easel.getObjectByName('Painting in progress'),a=bounds(art,easel),rest=bounds(easel.getObjectByName('Easel canvas rest'),easel),lip=bounds(easel.getObjectByName('Easel retaining lip'),easel),brush=assets.find(o=>o.userData.propId==='artist-brushes-easel');
   check(Math.abs(a.min.y-rest.max.y)<.1,'Canvas does not rest on easel');check(a.max.z<lip.min.z,'Canvas in front of retaining lip');check(!a.intersectsBox(bounds(easel.getObjectByName('Easel rear brace'),easel)),'Rear brace crosses artwork');if(brush)check(!a.intersectsBox(bounds(brush,easel)),'Brush holder intersects artwork');
  }
  for(const o of assets.filter(o=>o.parent===r.root)){
   const b=bounds(o);check(b.min.x>=-l.width/2-1&&b.max.x<=l.width/2+1&&b.min.z>=l.back-1&&b.max.z<=l.back+l.depth+1,'Furniture outside room '+o.name+' '+JSON.stringify({min:b.min.toArray(),max:b.max.toArray()}));
  }
  rows.push({id:'creative',layout,failures,variants:maps.length,props:assets.length});
 }
 r.set('product');return rows;
});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));if(!process.env.AUDIT_ONLY)for(const row of report)assert.deepEqual(row.failures,[],row.id+'/'+row.layout);assert.deepEqual(errors,[]);console.log(JSON.stringify(report.map(r=>({id:r.id,layout:r.layout,failures:r.failures})),null,2));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
