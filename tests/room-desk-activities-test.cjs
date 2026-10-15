const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('console',m=>{if(m.text().startsWith('STOW OVERFLOW'))console.log(m.text())});p.on('pageerror',e=>errors.push(e.message));p.setDefaultNavigationTimeout(240000);await p.setViewport({width:1400,height:1000});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks?.active&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:240000});await p.evaluate(async()=>{const e=ErgoFlex;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.4);e.renderer.shadowMap.enabled=false;});};
 await p.goto(`http://127.0.0.1:${server.address().port}/?${'room='+(process.env.ACTIVITY_SCENES?.split(',')[0]||'highschool')+'&view=room&layout=house'}`);await ready();


 const results=[];
 for(const scene of (process.env.ACTIVITY_SCENES||'highschool,occmedialab,office,coworking,library,home').split(',')){
  await p.evaluate(scene=>{if(ErgoFlex.workspaceRoom.id!==scene)ErgoFlex.setRoomScene(scene,false);},scene);await ready();
  for(const phase of (process.env.ACTIVITY_PHASES||'night,afternoon,party').split(',')){
   const result=await p.evaluate(async ({scene,phase})=>{
    const e=ErgoFlex,m=e.sceneDesks;
    if(m.activities.hasHome){m.activities.start(true);for(let n=0;n<600&&m.activities.run;n++)m.activities.update(2);}
    e.setMeasuredRoomMode(scene,phase,false);m.capture();const original=structuredClone(m.serialize());
    const strip=data=>Object.fromEntries(Object.entries(data.rooms[m.key].desks).map(([id,s])=>{const {pose,height,tilt,lights,...rest}=s;return [id,rest];}));
    const before=strip(original);const started=m.activities.start();
    if(!started)return{scene,phase,started,message:m.activities.message};
    let steps=0,plans;while(m.activities.run&&steps++<600){m.activities.update(2);if(m.activities.run?.moves&&!plans)plans=m.activities.run.moves.map(v=>({id:v.id,transit:v.transit,end:v.pose}));}
    m.capture();const after=strip(m.serialize());
    const status=m.activities.message,buildsIntact=JSON.stringify(before)===JSON.stringify(after);
    const result={scene,phase,started,steps,status,buildsIntact,remaining:!!m.activities.run,groups:m.activities.lastPlan?.groups,kind:m.activities.lastPlan?.kind,block:m.activities.lastBlock,moves:plans,tilts:[...m.records.values()].map(r=>({id:r.id,tilt:r.state.tilt}))};
    if(m.activities.run)m.stop();return result;
   },{scene,phase});
   results.push(result);console.log(JSON.stringify(result));assert.equal(result.remaining||false,false,'routine completes');if(result.started)assert.ok(result.buildsIntact,'source builds unchanged');
  }
 }
 assert.deepEqual(errors,[]);for(const r of results)if(['occmedialab','office','coworking'].includes(r.scene)&&['afternoon','party'].includes(r.phase))assert.ok(r.groups?.length||(r.kind==='storage'&&r.status.startsWith('Meeting area')&&r.tilts.every(d=>d.tilt===65)), r.scene+' '+r.phase+' forms a group or clears the meeting area');assert.ok(results.every(r=>!r.status?.includes('stopped because')), 'unchanged furniture must not interrupt a planned route');console.log('PASS room activities',results.length);
}finally{browser?.disconnect();browser?.process()?.kill('SIGKILL');server.closeAllConnections();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
