const assert=require('node:assert/strict'),p=require('puppeteer'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await p.launch({headless:true,protocolTimeout:600000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.setViewport({width:1440,height:1000});
await page.goto(`http://127.0.0.1:${server.address().port}/?room=hospital&view=room`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});
await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.5);});
const result=await page.evaluate(async()=>{
 const ef=ErgoFlex,m=ef.sceneDesks,fail=[],check=(v,msg)=>{if(!v)fail.push(msg);};
 const T=await import('three');const initial=m.serialize();
 check(m.records.size>1,'No support stations');check(m.selected==='main','Main not selected');
 const main=m.records.get('main'),mainStart=structuredClone(main.state),secondary=[...m.records.values()].find(r=>!r.primary);
 check(m.select(secondary.id),'Cannot select secondary');check(ef.currentConfig.size===secondary.state.size,'Wrong selected size');
 const state=structuredClone(secondary.state);state.pose.x+=90;state.height=37;state.tilt=5;
 m.ctx.writeLive({...secondary,state});m.update(.05);m.persist();
 check(Math.abs(secondary.state.pose.x-state.pose.x)<.1,'Selected desk anchor drift');check(Math.abs(ef.heightInches-37)<.1,'Selected desk height not applied');
 check(JSON.stringify(main.state.pose)===JSON.stringify(mainStart.pose),'Main moved with secondary');
 const savedSecondary=structuredClone(secondary.state);m.select('main');m.select(secondary.id);m.update(.05);
 check(Math.abs(secondary.state.pose.x-savedSecondary.pose.x)<.1,'Switching selection drifts');
 m.setSize('48x30');check(ef.currentConfig.size==='48x30','Selected size not applied');check(main.state.size===mainStart.size,'Main resized with secondary');
 m.saveSetting();const phase=m.ctx.phase();check(secondary.state.phases[phase]?.height===37,'Per-desk setting missing');
 ef.setMeasuredRoomMode('hospital','night',false);m.saveSetting(true);check([...m.records.values()].every(r=>r.state.phases.night),'Save all missed desk');
 m.record();for(let i=0;i<24;i++){const s=m.ctx.readLive(secondary);s.height=37+i*.01;m.ctx.writeLive({...secondary,state:s});m.update(.05);}m.stopRecording();
 check(secondary.state.phases.night.recording.length>=10,'Recording missing frames');
 check(m.play(),'Saved desk Groove will not start');for(let i=0;i<80&&m.playing;i++)m.update(.05);check(!m.playing,'Playback did not finish');
 const project=ef.serializeProject();check(!!project.presentation.sceneDesks?.rooms[m.key]?.desks[secondary.id].phases.night.recording.length,'Project loses recordings');
 const add=m.add('48x30');check(!!add,'Cannot add desk');if(add){check(m.selected===add,'Added desk not selected');m.remove();check(!m.records.has(add),'Added desk removal failed');}
 m.select(secondary.id);m.remove();check(!m.records.has(secondary.id),'Authored station deletion failed');
 ef.setRoomScene('hospital',false,{preserveDesk:true,defaultDesktop:false});await ef.workspaceRoom.ready;
 check(!m.records.has(secondary.id),'Deleted station returned after rebuild');
 m.restore(initial);ef.setRoomScene('hospital',false,{preserveDesk:true,defaultDesktop:false});await ef.workspaceRoom.ready;
 check(m.records.has(secondary.id),'Restore does not recreate station');
 
 // The new state is applied through the actual project importer, not only read
 // from the serializer; restored supporting rigs must retain their posture.
 const imported=ef.applyProject(project,{confirmSoft:()=>true});check(imported.ok,'Project import rejected desk project');await ef.workspaceRoom.ready;
 check(m.active?.id===secondary.id,'Project lost selected desk');check(m.active.state.phases.night.recording.length>=10,'Import lost recording');
 const restored=m.active;check(restored.state.size==='48x30','Project lost station size');
 m.select('main');m.saveSetting();m.select(restored.id);m.saveSetting();
 check(m.play(true),'Group Groove could not start');for(let i=0;i<160&&m.playing;i++)m.update(.05);
 check(!m.playing,'Group playback did not complete');check(!ef.collisionState.alert,'Stationary group playback raised false contact');
 // A rigid object moved into the planned recording stops it with CLEAR.
 const target=m.active;const obstacle=new T.Mesh(new T.BoxGeometry(900,900,900),new T.MeshBasicMaterial());obstacle.name='Recording test obstacle';obstacle.position.set(target.state.pose.x,450,target.state.pose.z);ef.workspaceRoom.root.add(obstacle);
 check(m.play(),'Recording start disappeared');m.update(.05);check(!m.playing&&!!ef.collisionState.alert,'Dynamic blocker did not stop group and raise CLEAR');obstacle.removeFromParent();obstacle.geometry.dispose();obstacle.material.dispose();ef.clearCollisionAlert();
 m.select('main');m.remove();check(!m.records.has('main'),'Main desk cannot be removed');ef.undo();await ef.workspaceRoom.ready;check(m.records.has('main'),'Undo did not restore main desk');ef.redo();await ef.workspaceRoom.ready;check(!m.records.has('main'),'Redo did not remove main desk');
 while(m.active)m.remove();check(m.records.size===0,'Last desk cannot be deleted');check(!m.ctx.liveObject().visible,'Removed final desk is still drawn');
 check(!!m.add('48x30'),'Cannot add after deleting every desk');
 m.restore(initial);ef.setRoomScene('hospital',false,{preserveDesk:true,defaultDesktop:false});await ef.workspaceRoom.ready;

 return{fail,desks:m.records.size,key:m.key};
});console.log(JSON.stringify(result,null,2));assert.deepEqual(result.fail,[]);
// Exercise the public UI and actual pointer path; direct API calls alone do
// not catch the window capture handler or an overlay blocking the canvas.
await page.setViewport({width:1600,height:1400});
await page.evaluate(()=>{ErgoFlex.renderer.setSize(ErgoFlex.renderer.domElement.clientWidth,ErgoFlex.renderer.domElement.clientHeight,false);});
if(await page.$eval('#room-rearrange-toggle',e=>e.checked))await page.click('#room-rearrange-toggle');
const pointForDesk=async()=>page.evaluate(async()=>{
 const ef=ErgoFlex,m=ef.sceneDesks,T=await import('three'),r=[...m.records.values()].find(r=>!r.primary);
 const center=new T.Box3().setFromObject(r.group).getCenter(new T.Vector3());m.ctx.controls.target.copy(center);m.ctx.camera.position.copy(center).add(new T.Vector3(3,3,4));m.ctx.controls.update();ef.workspaceRoom.update(m.ctx.camera);ef.renderer.render(m.ctx.scene,m.ctx.camera);
 const rect=m.ctx.canvas.getBoundingClientRect(),p=center.project(m.ctx.camera),x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2;
 for(let dy=-90;dy<=90;dy+=10)for(let dx=-90;dx<=90;dx+=10){const clientX=x+dx,clientY=y+dy;if(document.elementFromPoint(clientX,clientY)===m.ctx.canvas&&m.pick({clientX,clientY})?.id===r.id)return{x:clientX,y:clientY,id:r.id};}
 return null;
});
let point=await pointForDesk();assert.ok(point,'No unobscured supporting desk point');await page.mouse.click(point.x,point.y);
assert.equal(await page.evaluate(()=>ErgoFlex.sceneDesks.selected),point.id,'Canvas click did not select desk');
await page.click('#room-rearrange-toggle');point=await pointForDesk();assert.ok(point);
const dragBefore=await page.evaluate(()=>({active:structuredClone(ErgoFlex.sceneDesks.active.state.pose),main:structuredClone(ErgoFlex.sceneDesks.records.get('main').state.pose)}));
await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+14,point.y+4,{steps:4});await page.mouse.up();
const dragAfter=await page.evaluate(()=>({active:ErgoFlex.sceneDesks.active.state.pose,main:ErgoFlex.sceneDesks.records.get('main').state.pose,alert:ErgoFlex.collisionState.alert}));
assert.ok(Math.hypot(dragAfter.active.x-dragBefore.active.x,dragAfter.active.z-dragBefore.active.z)>1,'Pointer drag did not move supporting desk');assert.deepEqual(dragAfter.main,dragBefore.main,'Pointer drag also moved main desk');assert.equal(dragAfter.alert,null,'Small clear drag raised contact');
await page.click('.scene-desk-panel > summary');await page.select('[data-desk-select]','main');assert.equal(await page.evaluate(()=>ErgoFlex.sceneDesks.selected),'main');
await page.select('[data-portal-appearance]','light');assert.equal(await page.$eval('.scene-desk-panel',e=>getComputedStyle(e).color),'rgb(32, 51, 46)');
await page.select('[data-portal-appearance]','dark');assert.equal(await page.$eval('.scene-desk-panel',e=>getComputedStyle(e).color),'rgb(236, 244, 241)');
await page.evaluate(()=>{ErgoFlex.sceneDesks.persist();ErgoFlex.workspaceRoom.update(ErgoFlex.sceneDesks.ctx.camera);ErgoFlex.renderer.render(ErgoFlex.sceneDesks.ctx.scene,ErgoFlex.sceneDesks.ctx.camera);});
await page.screenshot({path:'/tmp/ef-scene-desks.png'});
const beforeReload=await page.evaluate(()=>ErgoFlex.sceneDesks.serialize());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;ErgoFlex.renderer.setAnimationLoop(null);});
const afterReload=await page.evaluate(()=>ErgoFlex.sceneDesks.serialize());assert.deepEqual(afterReload.rooms[result.key].desks,beforeReload.rooms[result.key].desks,'Reload drifted independent desk state');assert.deepEqual(errors,[]);
console.log('PASS controls, anchors, size, settings, recordings, project import, group playback, collision CLEAR, add/delete, undo/redo, pointer selection/dragging, themes and reload.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
