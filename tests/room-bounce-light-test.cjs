const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{if(req.url==='/audit'){res.setHeader('content-type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/audit`);
  const result=await page.evaluate(async()=>{
   const T=await import('three'),{WorkspaceRoom,ROOM_SCENES}=await import('/workspace-3d.mjs');
   const room=new WorkspaceRoom(new T.Scene(),.001),fail=[];let checked=0;
   const key=new T.DirectionalLight('#fff1df',1.5),hemi=new T.HemisphereLight('#e7edfa','#89806a',.5);
   for(const {id} of ROOM_SCENES){
    if(id==='product')continue;room.set(id,{size:'60x30'});if(!room.bounce)continue;checked++;
    const l=room.roomLayout,b=room.bounce,lights={key,hemi};room.root.position.y=1.5;room.root.updateMatrixWorld(true);
    key.position.copy(room.root.localToWorld(new T.Vector3(-l.width,l.height*2,l.back+l.depth/2)));key.target.position.copy(room.root.localToWorld(new T.Vector3(0,0,l.back+l.depth/2)));
    key.updateMatrixWorld();key.target.updateMatrixWorld();
    const count=()=>{let n=0;room.root.traverse(o=>{if(o.isLight)n++;});return n;},before=count();
    for(const mode of ['morning','afternoon','evening','night','party']){
     room.roomAtmosphere?.(mode);b.configure(lights,{enabled:true,mode});
     const baseline=b.patches.map(p=>p.radiance.toArray());b.configure(lights,{enabled:true,mode});
     if(JSON.stringify(baseline)!==JSON.stringify(b.patches.map(p=>p.radiance.toArray())))fail.push(id+': repeated lighting accumulates energy');
     if(b.patches.some(p=>p.radiance.toArray().some(n=>!Number.isFinite(n)||n<0)))fail.push(id+': invalid bounce energy');
     if(b.patches[11].worldArea!==0)fail.push(id+': open front reflects light');
    }
    const source=room.root.localToWorld(new T.Vector3(-l.width/4,1500,l.back+l.depth/4));
    const u={efRoomStart:{value:Array.from({length:8},()=>source.clone())},efRoomEnd:{value:Array.from({length:8},()=>source.clone())},efRoomRange:{value:[2.1,0,0,0,0,0,0,0]},efRoomGain:{value:1},efRoomColour:{value:new T.Color('#ff0000')},efRoomCounts:{value:Array(8).fill(1)}};
    const pixels={active:true,width:1,data:new Uint8Array(32)};pixels.data.set([255,0,0,255]);b.updateLeds(pixels,u);const red=b.patches.map(p=>p.radiance.toArray());
    pixels.data.set([0,0,255,255]);b.updateLeds(pixels,u);const blue=b.patches.map(p=>p.radiance.toArray());
    if(JSON.stringify(red)===JSON.stringify(blue))fail.push(id+': LED bounce does not follow atlas colour');
    u.efRoomGain.value=0;b.updateLeds(pixels,u);
    if(b.patches.some(p=>p.radiance.x!==p.base.r||p.radiance.y!==p.base.g||p.radiance.z!==p.base.b))fail.push(id+': LED off leaves coloured bounce');
    b.configure(lights,{enabled:false});if(b.uniforms.efBounceGain.value!==0)fail.push(id+': disabled bounce remains active');
    if(count()!==before)fail.push(id+': added real lights');
   }
   room.set('product');return{checked,fail};
  });
  console.log(JSON.stringify(result,null,2));assert.equal(result.checked,27);assert.deepEqual(result.fail,[]);
  console.log('PASS 27 rooms × 5 dayparts: finite stable bounce, translated rooms, RGB atlas response, LED off, no extra lights.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
