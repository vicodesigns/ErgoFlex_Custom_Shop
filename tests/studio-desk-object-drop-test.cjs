// Studio desk objects (a scene desk's dressing, e.g. the hospital room's desk items): Shift+Down levels then drops,
// Alt+Down tilts to the surface then drops, plain Down keeps the tilt; each is one Ctrl+Z. Real Chrome (swiftshader).
const assert=require('node:assert/strict'),puppeteer=require('puppeteer'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.writeHead(200,{'content-type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream'}).end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,protocolTimeout:600000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.setViewport({width:1440,height:1000});
 await page.goto(`http://127.0.0.1:${server.address().port}/?room=hospital&view=room`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});
 await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.5);});
 const prep=()=>page.evaluate(async()=>{
  const ef=ErgoFlex,m=ef.sceneDesks,ed=m.objects,T=await import('three');document.activeElement.blur();
  const item=[...m.active.objects.values()].find(i=>i.obj.visible&&!i.obj.userData.accessoryId);
  ed.select(item.id);ed.setEditing(true);window.itemId=item.id;window.T=T;
  // settle it on the surface first, then lift and tilt it
  ed.dropToSurface();const o=item.obj;window.restY=new T.Box3().setFromObject(o).min.y;
  ed.change({y:o.position.y+150,roll:20});return {id:item.id,label:item.saved.label};
 });
 const state=()=>page.evaluate(()=>{const o=ErgoFlex.sceneDesks.active.objects.get(itemId).obj,b=new T.Box3().setFromObject(o),up=new T.Vector3(0,1,0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion()));return{bottom:b.min.y,rest:restY,tilt:Math.acos(Math.min(1,up.y))*180/Math.PI};});
 const key=async mod=>{if(mod)await page.keyboard.down(mod);await page.keyboard.press('ArrowDown');if(mod)await page.keyboard.up(mod);await new Promise(r=>setTimeout(r,300));};
 const undo=async()=>{await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await new Promise(r=>setTimeout(r,400));await page.evaluate(()=>{const ed=ErgoFlex.sceneDesks.objects;ed.select(itemId);ed.setEditing(true);});};   // undo rebuilds the desk objects and drops the selection
 const what=await prep();let s=await state();assert.ok(s.tilt>15&&s.bottom>s.rest+.05,`starts tilted and raised (${what.label}: ${s.tilt.toFixed(1)} deg)`);
 await key('Shift');s=await state();assert.ok(s.tilt<.3,'Shift+Down levels it ('+s.tilt.toFixed(2)+' deg)');assert.ok(Math.abs(s.bottom-s.rest)<3,'and it rests where it did ('+(s.bottom-s.rest).toFixed(2)+')');
 await undo();s=await state();assert.ok(s.tilt>15&&s.bottom>s.rest+.05,'one Ctrl+Z puts it back, tilted and raised '+JSON.stringify(s));
 await key('Alt');s=await state();assert.ok(s.tilt<.3&&Math.abs(s.bottom-s.rest)<3,'Alt+Down aligns to the flat surface and rests on it '+JSON.stringify(s));
 await undo();await key();s=await state();assert.ok(s.tilt>15&&Math.abs(s.bottom-s.rest)<3,'plain Down still keeps the tilt and rests on its lowest corner');
 assert.deepEqual(errors,[]);console.log('PASS Studio desk object: Shift+Down levels, Alt+Down aligns, plain Down unchanged, each one Ctrl+Z.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
