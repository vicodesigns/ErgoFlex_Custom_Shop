const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(180000);await page.setViewport({width:1600,height:1100});
  const ready=async()=>{await page.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await page.evaluate(async()=>{await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.75);ErgoFlex.workspaceAccessories.update()})};
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();
  await page.evaluate(()=>ErgoFlex.applyPreset({id:'office'}));await ready();
  await page.click('#accessory-obsbot-tiny-2');await ready();
  const webcam=()=>page.evaluate(()=>{const o=ErgoFlex.workspaceAccessories.items.get('obsbot-tiny-2');return {loaded:o?.userData.loaded,pose:o?.position.toArray(),rotation:o?.rotation.toArray(),role:ErgoFlex.sceneDesks.active.objects.get('accessory-obsbot-tiny-2')?.saved.role}});
  assert.equal((await webcam()).loaded,true);assert.equal((await webcam()).role,'shelf');
  const bounds=await page.evaluate(async()=>{const T=await import('three'),o=ErgoFlex.workspaceAccessories.items.get('obsbot-tiny-2').getObjectByName('Prop:obsbot-tiny-2');const b=new T.Box3().setFromObject(o),s=b.getSize(new T.Vector3());let lights=0;o.traverse(c=>{if(c.isLight)lights++});return {size:s.toArray().map(n=>n/ErgoFlex.workspaceAccessories.scale),lights}});
  assert.ok(bounds.size.every(n=>n>0&&n<80),'webcam is desk sized');assert.equal(bounds.lights,0,'status strip does not spend the room light budget');
  await page.click('.scene-desk-panel > summary');await page.select('[data-object-select]','accessory-obsbot-tiny-2');
  const field=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},String(value))};
  await field('[data-object-x]',-350);await field('[data-object-y]',12.5);await field('[data-object-rotation]',15);
  await page.evaluate(()=>ErgoFlex.saveBuildPreset());await page.reload();await ready();
  const saved=await webcam();assert.equal(saved.loaded,true);assert.equal(saved.pose[0],-350);assert.equal(saved.pose[1],12.5);assert.ok(Math.abs(saved.rotation[1]-Math.PI/12)<1e-7,'rotation survives reload');
  await page.click('.scene-desk-panel > summary');await page.click('.desk-object-library > summary');await field('[data-object-search]','obsbot');
  // Search listens to input rather than change.
  await page.$eval('[data-object-search]',e=>e.dispatchEvent(new Event('input',{bubbles:true})));
  assert.equal(await page.$$eval('.desk-object-card',es=>es.length),1,'webcam is in the desk object library');
  await page.click('.desk-object-card');await page.evaluate(async()=>await ErgoFlex.sceneDesks.objects.ready);await page.waitForFunction(()=>!ErgoFlex.sceneDesks.objects.loading);
  assert.equal(await page.evaluate(()=>ErgoFlex.sceneDesks.objects.current.saved.propId),'obsbot-tiny-2');
  await page.click('[data-object-remove]');await page.select('[data-object-select]','accessory-obsbot-tiny-2');await page.click('[data-object-remove]');
  assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.accessories.includes('obsbot-tiny-2')),false,'removing webcam updates the build');
  assert.deepEqual(errors,[]);console.log('OBSBOT store selection, loading, editable placement, reload persistence, library addition and removal passed.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
