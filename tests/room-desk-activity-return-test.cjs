const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('console',m=>{if(m.text().startsWith('STOW OVERFLOW'))console.log(m.text())});p.on('pageerror',e=>errors.push(e.message));p.setDefaultNavigationTimeout(240000);await p.setViewport({width:1400,height:1000});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});await p.evaluate(async()=>{const e=ErgoFlex;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;});};
 await p.goto(`http://127.0.0.1:${server.address().port}/?${'room=occmedialab&view=room&layout=house'}`);await ready();



 for(const size of ['48x30','60x30']){
  await p.evaluate(size=>ErgoFlex.sceneDesks.setSize(size),size);await ready();
  const original=await p.evaluate(()=>{const e=ErgoFlex,m=e.sceneDesks;e.setMeasuredRoomMode('occmedialab','night',false);m.capture();const initial=m.serialize();m.activities.start();let n=0;while(m.activities.run&&n++<700)m.activities.update(2);m.persist();return {initial,status:m.activities.message,unfinished:!!m.activities.run,tilts:[...m.records.values()].map(r=>r.state.tilt)};});
  console.log(size,'storage',original.status);assert.equal(original.unfinished,false);assert.ok(original.tilts.every(t=>t===65));
  await p.reload();await ready();
  const result=await p.evaluate(()=>{const m=ErgoFlex.sceneDesks,signature=m.activities.clearanceSignature(),homes=structuredClone(m.roomData.activityHome),matched=Object.values(homes).map(s=>Object.values(s).some(v=>v.clearance===signature));const started=m.activities.start(true);let n=0;while(m.activities.run&&n++<700)m.activities.update(2);m.capture();return{started,matched,status:m.activities.message,unfinished:!!m.activities.run,state:m.serialize(),blocked:m.activities.lastPlan?.blocked,posture:m.activities.lastBlock};});
  console.log(size,'return',JSON.stringify({status:result.status,matched:result.matched,blocked:result.blocked,posture:result.posture}));assert.ok(result.started);assert.equal(result.unfinished,false);
  const simplify=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v,(_k,x)=>typeof x==='number'?Math.round(x*1e5)/1e5:x));
  const before=original.initial.rooms['occmedialab/house'].desks,after=result.state.rooms['occmedialab/house'].desks;
  for(const id of Object.keys(before))for(const field of ['pose','height','tilt','size','style','artwork','accessories','accessoryFinishes','objects','phases'])assert.deepEqual(simplify(after[id][field]),simplify(before[id][field]),size+' '+id+' '+field+' restores after reload');
 }
 assert.deepEqual(errors,[]);console.log('PASS: 48 and 60 Storage Mode, reload, exact original return poses and all build edits.');
}finally{browser?.disconnect();browser?.process()?.kill('SIGKILL');server.closeAllConnections();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
