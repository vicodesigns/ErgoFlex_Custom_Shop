// Gym colourways: the green room must stay byte-identical, and the black/red
// room must build every layout and mode. Isolated document (WorkspaceRoom
// only), so no saved user designs are read or changed.
//   node tests/gym-theme-room-test.cjs                 compare green with the fixture
//   node tests/gym-theme-room-test.cjs --write-fixture  re-capture it (only on a known-good tree)
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),fixture=path.join(__dirname,'fixtures/gym-green-fingerprint.json'),write=process.argv.includes('--write-fixture');
const imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/review.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await puppeteer.launch({headless:true,protocolTimeout:600000,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
const report=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom}=await import('./workspace-3d.mjs?v=gym-sessions-20261022');
 const {GYM_LAYOUTS}=await import('./gym-room.mjs?v=gym-sessions-20261022');
 let theme=null;try{theme=await import('./gym-theme.mjs');}catch{}
 const r=new WorkspaceRoom(new T.Scene(),.001),phases=['morning','afternoon','evening','night','party'];
 // FNV-1a over strings and byte arrays; canvases are hashed once per image.
 const fnv=(h,s)=>{for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
 const fnvBytes=(h,b)=>{for(let i=0;i<b.length;i++)h=Math.imul(h^b[i],16777619)>>>0;return h;};
 const hex=h=>h.toString(16).padStart(8,'0');
 const pixels=new Map();
 const image=img=>{
  if(!img)return '-';
  if(img.getContext){const d=img.getContext('2d').getImageData(0,0,img.width,img.height).data;return img.width+'x'+img.height+':'+hex(fnvBytes(2166136261,d));}
  return (img.width||0)+'x'+(img.height||0)+':'+(img.currentSrc||img.src||'bitmap').split('/').pop();
 };
 const tex=t=>t?image(t.image)+'@'+t.repeat.toArray().map(v=>+v.toFixed(5))+'/'+t.offset.toArray().map(v=>+v.toFixed(5)):'-';
 const colour=c=>c?c.getHexString()+(c.r>1||c.g>1||c.b>1?'*'+[c.r,c.g,c.b].map(v=>v.toFixed(4)):''):'-';
 const num=v=>v===undefined?'-':+(+v).toFixed(5);
 const describe=m=>[m.type,colour(m.color),colour(m.emissive),num(m.emissiveIntensity),num(m.roughness),num(m.metalness),num(m.opacity),m.transparent,m.blending,m.visible,
  ...['map','emissiveMap','roughnessMap','metalnessMap','normalMap','bumpMap','aoMap','alphaMap'].map(k=>tex(m[k]))].join('|');
 const fingerprint=()=>{
  let materials=2166136261,instances=2166136261,lights=2166136261,count=0;
  r.root.updateMatrixWorld(true);
  r.root.traverse(o=>{
   if(o.isMesh){count++;for(const m of [].concat(o.material))materials=fnv(materials,o.visible+'~'+describe(m)+';');
    if(o.isInstancedMesh&&o.instanceColor)instances=fnvBytes(instances,new Uint8Array(o.instanceColor.array.buffer,o.instanceColor.array.byteOffset,o.instanceColor.array.byteLength));}
   if(o.isLight)lights=fnv(lights,o.type+colour(o.color)+num(o.intensity)+(o.groundColor?colour(o.groundColor):'')+';');
  });
  return {meshes:count,materials:hex(materials),instances:hex(instances),lights:hex(lights)};
 };
 const out={};
 for(const layout of Object.keys(GYM_LAYOUTS)){
  r.set('gym',{layout,scale:.001});await r.ready;out[layout]={};
  const rig=r.assets().find(o=>o.userData.propId==='gym-props-3');let rigMeshes=0;rig?.traverse(o=>{if(o.isMesh)rigMeshes++;});
  if(r.missingProps.length||!rigMeshes)throw new Error(layout+': imported props did not load '+r.missingProps);
  for(const phase of phases){r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();out[layout][phase]=fingerprint();}
  if(theme){
   // The explicit green id must build the very same room.
   r.set('gym',{layout,scale:.001,gymTheme:'green'});await r.ready;out[layout].explicitGreen={};
   for(const phase of phases){r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();out[layout].explicitGreen[phase]=fingerprint();}
  }
 }
 // Black & red: every layout and mode builds with the same assets, inside the
 // room, with the themed finish and no lime-green surface left.
 const blackred={};
 if(theme){
  const hue=hex=>{const [r_,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),mx=Math.max(r_,g,b),mn=Math.min(r_,g,b),d=mx-mn,l=(mx+mn)/2;
   if(!d)return [0,0];const h=mx===r_?60*(((g-b)/d)%6):mx===g?60*((b-r_)/d+2):60*((r_-g)/d+4);return [(h+360)%360,d/(1-Math.abs(2*l-1))];};
  const plants=new Set(theme.GYM_THEMES.blackred.instances.plants.map(c=>c.slice(1)));
  const green=hex=>{const [h,sat]=hue(hex);return h>=70&&h<=170&&sat>=.2&&!plants.has(hex);};
  for(const layout of Object.keys(GYM_LAYOUTS)){
   r.set('gym',{layout,scale:.001});await r.ready;const keys=r.assets().map(o=>o.userData.sceneAssetKey).sort().join();
   r.set('gym',{layout,scale:.001,gymTheme:'blackred'});await r.ready;
   const l=r.roomLayout,failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg);};
   check(l.theme==='blackred'&&l.finish?.name==='Matte black & signal red','Themed layout');
   check(!r.missingProps.length,'Missing props '+r.missingProps);
   check(r.assets().map(o=>o.userData.sceneAssetKey).sort().join()===keys,'Same assets and keys as green');
   check(JSON.stringify(r.root.userData.decorationFinish?.palette)===JSON.stringify(theme.GYM_THEMES.blackred.detailPalette),'Detail palette');
   r.root.updateMatrixWorld(true);const inverse=r.root.matrixWorld.clone().invert();
   for(const o of r.assets()){const b=new T.Box3().setFromObject(o).applyMatrix4(inverse);
    check(b.min.x>=-l.width/2-1&&b.max.x<=l.width/2+1&&b.min.z>=l.back-1&&b.max.z<=l.back+l.depth+1&&b.min.y>=-1&&b.max.y<=l.height+1,'Out of room: '+o.userData.propId);}
   const leaks=new Set();
   r.root.traverse(o=>{if(!o.isMesh)return;
    for(const m of [].concat(o.material)){if(/leaf|plant|foliage/i.test(m.name+' '+o.name))continue;if(m.color&&!m.map&&green(m.color.getHexString()))leaks.add((m.name||o.name||o.parent?.name)+' #'+m.color.getHexString());
     if(m.emissive&&m.emissiveIntensity>0&&green(m.emissive.getHexString()))leaks.add('emissive '+(o.name||o.parent?.name)+' #'+m.emissive.getHexString());}
    if(o.isInstancedMesh&&o.instanceColor)for(let i=0;i<o.count;i++){const c=new T.Color().fromArray(o.instanceColor.array,i*3).getHexString();if(green(c))leaks.add('instance '+(o.parent?.name)+' #'+c);}
   });
   blackred[layout]={};
   for(const phase of phases){r.roomAtmosphere(phase);r.life.apply(phase);r.life.lightActivity();
    const f=fingerprint();blackred[layout][phase]=f;check(f.materials!==out[layout][phase].materials,'Black & red looks like green: '+phase);
    check(r.root.userData.gymSession.accent===theme.GYM_THEMES.blackred.sessions.accents[phase],'Session accent '+phase);
    r.root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(m.emissive&&m.emissiveIntensity>0&&green(m.emissive.getHexString()))leaks.add(phase+' emissive '+(o.name||o.parent?.name)+' #'+m.emissive.getHexString());});
   }
   if(leaks.size)failures.push('Lime left: '+[...leaks].slice(0,12).join(', '));
   blackred[layout].failures=failures;
  }
 }
 r.set('product');return {fingerprint:out,themed:!!theme,blackred};
});
const green=Object.fromEntries(Object.entries(report.fingerprint).map(([l,v])=>[l,Object.fromEntries(Object.entries(v).filter(([k])=>k!=='explicitGreen'))]));
if(write){fs.mkdirSync(path.dirname(fixture),{recursive:true});fs.writeFileSync(fixture,JSON.stringify(green,null,1)+'\n');console.log('Wrote '+fixture);}
else{
 const expected=JSON.parse(fs.readFileSync(fixture,'utf8'));
 assert.deepEqual(green,expected,'Green gym fingerprint changed: the default room is no longer byte-identical');
 if(report.themed)for(const [l,v] of Object.entries(report.fingerprint))assert.deepEqual(v.explicitGreen,expected[l],l+': gymTheme green differs from the default room');
 console.log('PASS: green gym fingerprint matches for 5 layouts × 5 modes'+(report.themed?' (default and explicit green)':'')+'.');
 if(report.themed){for(const [l,v] of Object.entries(report.blackred))assert.deepEqual(v.failures,[],'black & red '+l);console.log('PASS: black & red builds 5 layouts × 5 modes: same assets, in bounds, themed finish and accents, no lime surfaces.');}
}
assert.deepEqual(errors,[]);
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
