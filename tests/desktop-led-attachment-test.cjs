const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1500,height:1000});
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.75)})};
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();
  const check=async label=>{
   const state=await page.evaluate(async()=>{
    const T=await import('three'),a=ErgoFlex,desktop=a.partRegistry.get('Desktop_3_6').obj,led=a.loadedModel.getObjectByName('Desktop LEDs'),screen=a.loadedModel.getObjectByName('Animated touchscreen');
    const results=[];
    for(const tilt of [-5,0,25,65]){
     a.setHeight(52.5);a.setTilt('tilting',tilt);a.loadedModel.updateMatrixWorld(true);
     const relative=desktop.matrixWorld.clone().invert().multiply(led.matrixWorld);
     results.push({tilt,parent:led.parent.name,relative:relative.toArray(),screen:screen.parent.name,groups:led.children.filter(o=>/desktop underside LEDs/.test(o.name)).map(g=>({name:g.name,parent:g.parent.name,strips:g.children.length}))});
    }
    return results;
   });
   for(const s of state){assert.equal(s.parent,'tiltWrapper_tilting',label+' desktop LEDs belong to the tilt rig');assert.equal(s.screen,'tiltWrapper_tilting',label+' touchscreen also stays attached');for(let i=0;i<16;i++)assert.ok(Math.abs(s.relative[i]-state[0].relative[i])<1e-8,label+' strip-to-desktop transform stays fixed at '+s.tilt);assert.ok(s.groups.every(g=>g.parent==='Desktop LEDs'&&g.strips===3),label+' both strip sets remain complete');}
  };
  await check('fresh load');
  const restored=await page.evaluate(()=>{const a=ErgoFlex,project=a.serializeProject();return a.applyProject(project)});assert.equal(restored.ok,true,'project round trip succeeds');await ready();await check('project restored');
  for(const id of ['office','gaming','library','compact','artist','occ']){await page.evaluate(id=>ErgoFlex.applyPreset({id}),id);await ready();await check(id)}
  await page.reload();await ready();await check('saved rig reload');
  assert.deepEqual(errors,[]);console.log('Desktop strips and touchscreen stay attached through project restore, saved rigs, preset switches, both sizes and -5° to 65° tilt.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
