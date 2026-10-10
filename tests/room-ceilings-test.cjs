const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),imports=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const server=http.createServer((req,res)=>{if(req.url==='/audit'){res.setHeader('content-type','text/html');return res.end('<!doctype html>'+imports);}const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});try{const page=await b.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(`http://127.0.0.1:${server.address().port}/audit`);const result=await page.evaluate(async()=>{
 const T=await import('three'),{WorkspaceRoom,ROOM_SCENES}=await import('/workspace-3d.mjs?v=scene-desk-styling-20261010');
 const room=new WorkspaceRoom(new T.Scene(),.001),camera=new T.PerspectiveCamera(),fail=[];let checked=0,fixtureRooms=0;
 for(const {id} of ROOM_SCENES){if(id==='product')continue;room.set(id,{size:'60x30'});const l=room.roomLayout;if(!l)continue;checked++;
  room.root.updateMatrixWorld(true);const inverse=room.root.matrixWorld.clone().invert();const groups=room.root.children.filter(g=>g===room.ceilingFixture||/^Ceiling /i.test(g.name));if(groups.length)fixtureRooms++;
  for(const group of groups)group.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(box.min.x<-l.width/2-5||box.max.x>l.width/2+5||box.min.z<l.back-5||box.max.z>l.back+l.depth+5||box.max.y>l.height+5)fail.push(id+': fixture exceeds room shell');});
  // Cutaways must use room height even when the room root has been moved.
  room.root.position.y=2.5;room.root.updateMatrixWorld(true);
  camera.position.copy(room.root.localToWorld(new T.Vector3(0,l.height+50,l.back+l.depth/2)));room.update(camera);if(groups.some(g=>g.visible))fail.push(id+': overhead camera still draws suspended fixtures');
  camera.position.copy(room.root.localToWorld(new T.Vector3(0,l.height-700,l.back+l.depth/2)));room.update(camera);if(groups.some(g=>!g.visible))fail.push(id+': interior camera loses fixtures');
 }
 room.set('product');return{checked,fixtureRooms,fail};
 });console.log(JSON.stringify(result,null,2));assert.equal(result.checked,27);assert.deepEqual(result.fail,[]);assert.deepEqual(errors,[]);console.log('PASS fixture bounds and camera cutaway at real ceiling height in all 27 rooms.');}finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
