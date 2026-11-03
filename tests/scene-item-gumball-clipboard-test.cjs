const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,protocolTimeout:600000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1200,height:850,hasTouch:true});await p.evaluateOnNewDocument(()=>Object.defineProperty(window,'devicePixelRatio',{get:()=>.25}));
  const url=`http://127.0.0.1:${server.address().port}/?room=library&layout=apartment&view=room&tour=1`;
  const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});await p.evaluate(async()=>{const e=ErgoFlex;e.renderer.setAnimationLoop(null);e.renderer.shadowMap.enabled=false;await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;e.sceneTour.setFull(true,false);});};
  const key=async k=>{await p.keyboard.down('Control');if(k==='Z')await p.keyboard.down('Shift');await p.keyboard.press(k.toLowerCase());if(k==='Z')await p.keyboard.up('Shift');await p.keyboard.up('Control');await p.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.sceneDesks.objects.ready;});};
  await p.goto(url,{timeout:180000});await ready();
  await p.evaluate(()=>{document.querySelector('#config-collapse').click();document.querySelector('#room-rearrange-toggle').checked||document.querySelector('#room-rearrange-toggle').click();document.querySelector('#lab-preview-toggle').click();document.activeElement.blur();});
  await new Promise(r=>setTimeout(r,850));
  const point=await p.evaluate(async()=>{
   const e=ErgoFlex,T=await import('three'),r=e.roomInteractions;window.originalTable=r.entries.find(e=>e.obj.userData.propId==='reading-table-0');
   if(!originalTable)throw Error('Missing reading table');
   const center=new T.Box3().setFromObject(originalTable.obj).getCenter(new T.Vector3()),s=e.workspaceRoom.root.scale.x;
   r.camera.position.copy(center).add(new T.Vector3(700,2200,1200).multiplyScalar(s));r.controls.target.copy(center);r.camera.lookAt(center);r.camera.updateMatrixWorld(true);e.renderer.render(r.scene,r.camera);
   const rect=r.canvas.getBoundingClientRect(),v=center.clone().project(r.camera);return{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
  });
  await p.mouse.click(point.x,point.y);await p.mouse.click(point.x,point.y);
  const opened=await p.evaluate(()=>({selected:ErgoFlex.roomInteractions.selected?.name,desk:ErgoFlex.sceneDesks.objects.selected,tap:ErgoFlex.roomInteractions.taps.last,active:ErgoFlex.itemGizmo.active?.kind,count:ErgoFlex.itemGizmo.objects.length,mode:ErgoFlex.itemGizmo.control.mode,sidebar:document.body.classList.contains('sidebar-collapsed')}));
  assert.equal(opened.active,'room');assert.ok(opened.count>1,'Table includes its books/equipment');assert.equal(opened.mode,'unified');assert.equal(opened.sidebar,true);
  const edited=await p.evaluate(()=>{
   const e=ErgoFlex,g=e.itemGizmo;window.beforeTable=originalTable.obj.matrixWorld.clone();const parents=g.objects.map(o=>o.parent);
   g.control.dispatchEvent({type:'dragging-changed',value:true});g.proxy.position.x+=.12;g.proxy.rotation.y+=.25;g.proxy.scale.setScalar(1.12);g.control.dispatchEvent({type:'objectChange'});g.control.dispatchEvent({type:'dragging-changed',value:false});
   return{active:!!g.active,changed:!originalTable.obj.matrixWorld.equals(beforeTable),parents:g.objects.every((o,i)=>o.parent===parents[i]),undo:e.undoCount2};
  });assert.ok(edited.active&&edited.changed&&edited.parents,'Transform stays active and retains original parents');
  await key('z');assert.equal(await p.evaluate(()=>originalTable.obj.matrixWorld.equals(beforeTable)),true,'Undo restores the room transform');await key('Z');
  await p.evaluate(()=>{ErgoFlex.roomInteractions.select(originalTable);document.activeElement.blur();});await key('c');await key('v');
  await p.waitForFunction(()=>!document.querySelector('#room-save-status')?.textContent.includes('Saving'),{timeout:10000});
  const pasted=await p.evaluate(async()=>{
   const e=ErgoFlex,T=await import('three');window.copyTable=e.roomInteractions.selected.obj;window.copyId=copyTable.userData.editorId;
   return{recipe:!!copyTable.userData.sceneCopyRecipe,children:copyTable.children.length,name:copyTable.name,original:originalTable.obj.parent!==null,size:new T.Box3().setFromObject(copyTable).getSize(new T.Vector3()).toArray(),undo:e.undoCount2};
  });assert.ok(pasted.recipe&&pasted.children>1&&pasted.original,'Copy includes linked table contents');
  await key('z');assert.equal(await p.evaluate(()=>!!copyTable.parent),false);await key('Z');assert.equal(await p.evaluate(()=>!!copyTable.parent),true);
  await key('v');assert.equal(await p.evaluate(()=>ErgoFlex.workspaceRoom.assets().filter(o=>o.userData.sceneCopyRecipe).length),2,'Repeated paste creates distinct copies');
  await p.evaluate(()=>{ErgoFlex.roomInteractions.select(originalTable);document.activeElement.blur();});await p.keyboard.press('Delete');
  // A copied catalog desk item survives deletion of its source object.
  const notebook=await p.evaluate(async()=>{const e=ErgoFlex,m=e.sceneDesks;await m.objects.add('ergoflex-notebook','desktop');m.objects.change({x:170,z:80,rotation:24});document.activeElement.blur();const g=e.itemGizmo;m.ctx.objectDoubleSelected(m.objects.current);const previous=JSON.stringify(m.objects.current.saved.transform),undo=e.undoCount2;g.control.dispatchEvent({type:'dragging-changed',value:true});g.proxy.rotation.y=.2;g.proxy.scale.setScalar(1.1);g.control.dispatchEvent({type:'objectChange'});g.control.dispatchEvent({type:'dragging-changed',value:false});if(previous===JSON.stringify(m.objects.current.saved.transform)||e.undoCount2!==undo+1)throw Error('Desk gumball did not save an undoable transform');g.close();return m.objects.selected;});
  await key('c');await key('v');const deskCopy=await p.evaluate(()=>({id:ErgoFlex.sceneDesks.objects.selected,saved:structuredClone(ErgoFlex.sceneDesks.objects.current.saved)}));assert.ok(deskCopy.saved.copySource&&deskCopy.saved.added);
  await p.evaluate(id=>{ErgoFlex.sceneDesks.objects.select(id);document.activeElement.blur();},notebook);await p.keyboard.press('Delete');
  await p.evaluate(()=>{const m=ErgoFlex.sceneDesks;m.objects.select('accessory-ergo-keyboard');if(!m.objects.current)throw Error('No purchased keyboard to copy');document.activeElement.blur();});
  await key('c');await key('v');const keyboardCopy=await p.evaluate(()=>ErgoFlex.sceneDesks.objects.selected);
  await p.evaluate(()=>{ErgoFlex.sceneDesks.objects.select('accessory-ergo-keyboard');document.activeElement.blur();});await p.keyboard.press('Delete');
  await p.reload({timeout:180000});await ready();
  const reload=await p.evaluate(id=>({copies:ErgoFlex.workspaceRoom.assets().filter(o=>o.userData.sceneCopyRecipe).length,sourceTable:ErgoFlex.workspaceRoom.assets().some(o=>o.userData.propId==='reading-table-0'),notebook:!!ErgoFlex.sceneDesks.active.objects.get(id),nodes:ErgoFlex.sceneDesks.active.objects.get(id)?.obj.children.length}),deskCopy.id);
  assert.equal(reload.copies,2);assert.equal(reload.sourceTable,false);assert.equal(reload.notebook,true);assert.ok(reload.nodes>0);
  assert.ok(await p.evaluate(id=>ErgoFlex.sceneDesks.active.objects.get(id)?.obj.children.length>0,keyboardCopy),'Purchased keyboard copy survives removal of its source accessory and reload');
  // Real touch input uses the same double-tap path, with no editor/sidebar switch.
  const touchPoint=await p.evaluate(async()=>{const e=ErgoFlex,T=await import('three'),r=e.roomInteractions;document.querySelector('#room-rearrange-toggle').checked||document.querySelector('#room-rearrange-toggle').click();if(document.querySelector('#lab-preview-toggle').getAttribute('aria-expanded')==='true')document.querySelector('#lab-preview-toggle').click();await new Promise(r=>setTimeout(r,850));window.touchItem=r.entries.find(e=>e.obj.userData.propId==='kenney-furniture-chair-modern-cushion');
   if(!touchItem)touchItem=r.entries.find(e=>/chair/i.test(e.name));const c=new T.Box3().setFromObject(touchItem.obj).getCenter(new T.Vector3()),s=e.workspaceRoom.root.scale.x;r.camera.position.copy(c).add(new T.Vector3(900,1800,1000).multiplyScalar(s));r.controls.target.copy(c);r.camera.lookAt(c);r.camera.updateMatrixWorld(true);e.renderer.render(r.scene,r.camera);const v=c.project(r.camera),rect=r.canvas.getBoundingClientRect(),cx=rect.left+(v.x+1)*rect.width/2,cy=rect.top+(1-v.y)*rect.height/2;document.activeElement.blur();for(const dx of [0,-20,20,-40,40,-60,60])for(const dy of [0,-20,20,-40,40,-60,60]){const point={clientX:cx+dx,clientY:cy+dy};r.point(point);const h=r.ray.intersectObject(r.root,true).find(h=>r.entryForHit(h.object));if(document.elementFromPoint(point.clientX,point.clientY)===r.canvas&&h&&r.entryForHit(h.object)===touchItem)return{x:point.clientX,y:point.clientY};}throw Error(JSON.stringify({why:'No visible chair point for touch input',name:touchItem.name,cx,cy,rect:rect.toJSON(),shell:document.querySelector('#viewer-shell').getBoundingClientRect().toJSON(),full:e.sceneTour.full,target:document.elementFromPoint(cx,cy)?.outerHTML.slice(0,160)}));});
  await p.touchscreen.tap(touchPoint.x,touchPoint.y);await p.touchscreen.tap(touchPoint.x,touchPoint.y);assert.equal(await p.evaluate(()=>ErgoFlex.itemGizmo.active?.kind),'room','Touch double tap opens gumball');
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>!!ErgoFlex.itemGizmo.active),false);
  assert.deepEqual(errors,[]);console.log('PASS full-screen mouse/touch gumball, move/rotate/scale, original parents, transform undo/redo, linked furniture copies, repeated paste, source deletion and persisted room/desk/accessory copies.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
