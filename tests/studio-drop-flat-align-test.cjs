const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1000,height:750});await p.goto(`http://127.0.0.1:${server.address().port}/?room=library&view=room`,{timeout:180000});await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});
  const ready=()=>p.evaluate(async()=>{const e=ErgoFlex;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.25);e.renderer.shadowMap.enabled=false;await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;});await ready();
  const shortcut=async redo=>{await p.keyboard.down('Control');if(redo)await p.keyboard.down('Shift');await p.keyboard.press('z');if(redo)await p.keyboard.up('Shift');await p.keyboard.up('Control');await ready();};

  await p.evaluate(async()=>{const e=ErgoFlex;e.setRoomScene('library',false);await e.workspaceRoom.ready;e.setLibraryLayout('spacious');await e.workspaceRoom.ready;await e.sceneDesks.objects.ready;document.querySelector('#room-rearrange-toggle').checked||document.querySelector('#room-rearrange-toggle').click();});await ready();
  const prep=()=>p.evaluate(()=>{
   const e=ErgoFlex,r=e.roomInteractions,c=r.entries.find(x=>x.obj.userData.propId==='carrel-0');
   const book=c.objects.find(o=>o.userData.propId==='journal'),entry=r.entries.find(x=>x.obj===book);
   document.activeElement.blur();r.select(entry);window.theBook=book;window.level=book.position.y;
   r.moveObject(book,0,0,e.workspaceRoom.root.scale.x*400);book.rotation.z=.35;book.updateMatrixWorld(true);r.rebindSelected();
   return{level:book.position.y};
  });
  const state=()=>p.evaluate(async()=>{const T=await import('three'),e=ErgoFlex,b=theBook,c=e.workspaceRoom.assets().find(o=>o.userData.propId==='carrel-0'),top=c.localToWorld(new T.Vector3(0,740,0)).y,up=new T.Vector3(0,1,0).applyQuaternion(b.getWorldQuaternion(new T.Quaternion()));return{bottom:new T.Box3().setFromObject(b).min.y,top,tilt:Math.acos(Math.min(1,up.y))*180/Math.PI,y:b.position.y,status:document.querySelector('[data-room-object-name]')?.textContent||''};});
  assert.equal(await p.evaluate(()=>!!document.querySelector('[data-room-object-drop-flat]')&&!!document.querySelector('[data-room-object-drop-align]')),true,'Drop flat and Align to surface buttons exist');
  const start=await prep();let s=await state();assert.ok(s.tilt>15,'the book starts tilted ('+s.tilt.toFixed(1)+' deg)');assert.ok(s.bottom>s.top+.1,'and raised above the table');
  // Shift+Down Arrow: level, then drop
  await p.keyboard.down('Shift');await p.keyboard.press('ArrowDown');await p.keyboard.up('Shift');s=await state();
  assert.ok(s.tilt<.3,'Shift+Down levels it ('+s.tilt.toFixed(2)+' deg)');assert.ok(Math.abs(s.bottom-s.top)<2e-3,'and rests on the tabletop (off by '+((s.bottom-s.top)*1000).toFixed(2)+' mm)');
  await shortcut(false);s=await state();assert.ok(s.tilt>15&&s.bottom>s.top+.1,'one Ctrl+Z puts it back, tilted and raised');
  // Alt+Down Arrow and the buttons
  await p.keyboard.down('Alt');await p.keyboard.press('ArrowDown');await p.keyboard.up('Alt');s=await state();
  assert.ok(s.tilt<.3&&Math.abs(s.bottom-s.top)<2e-3,'Alt+Down aligns to the (flat) tabletop and rests on it');
  await shortcut(false);await p.evaluate(()=>document.querySelector('[data-room-object-drop-flat]').click());await ready();s=await state();
  assert.ok(s.tilt<.3&&Math.abs(s.bottom-s.top)<2e-3,'the Drop flat button does the same');
  await shortcut(false);await p.evaluate(()=>document.querySelector('[data-room-object-drop]').click());await ready();s=await state();
  assert.ok(Math.abs(s.bottom-s.top)<2e-3&&s.tilt>15,'the plain Drop button still keeps the tilt (it rests on its lowest corner)');
  assert.deepEqual(errors,[]);console.log('PASS Studio drop: Shift+Down / Drop flat levels and rests, Alt+Down / Align to surface, plain Drop unchanged, each one Ctrl+Z.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
