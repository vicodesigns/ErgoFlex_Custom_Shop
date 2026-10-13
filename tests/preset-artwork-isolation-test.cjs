const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 await p.goto(`http://127.0.0.1:${server.address().port}/?view=product`);await ready();await p.evaluate(()=>ErgoFlex.applyPreset({id:'occ'},{size:'60x30'}));await ready();const wide=await art();
 await p.click('[data-size-choice="48x30"]');await ready();
 await p.evaluate(()=>{const a=ErgoFlex.surfaceArtwork;a.surface='desktop';a.kind='logo';a.selectedLayer='logo';a.root.open=true;a.syncUI();for(const [key,value] of Object.entries({x:19,y:68,scale:42,rotation:17,opacity:80})){const el=a.root.querySelector('[data-art-field="'+key+'"]');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('[data-size-choice="60x30"]').click()});await ready();assert.deepEqual(await art(),wide,'60 inch artwork is unchanged by the immediate 48 inch UI edit');
 await p.click('[data-size-choice="48x30"]');await ready();assert.equal((await art()).surfaces.desktop.logo.x,19,'48 inch UI artwork edit is kept without an explicit save');
 // A newly selected accessory can still be loading when artwork is edited.
 await p.evaluate(()=>{ErgoFlex.toggleAccessory('obsbot-tiny-2');const a=ErgoFlex.surfaceArtwork;const el=a.root.querySelector('[data-art-field="x"]');el.value='27';el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-size-choice="60x30"]').click()});await ready();assert.deepEqual(await art(),wide,'60 inch stays independent while an accessory is loading');
 await p.click('[data-size-choice="48x30"]');await ready();assert.equal((await art()).surfaces.desktop.logo.x,27,'48 inch artwork is flushed even while the accessory load prevents a full preset save');
 await p.evaluate(async()=>{const a=ErgoFlex.surfaceArtwork;await a.refresh();});
 const rendered=await p.evaluate(()=>JSON.parse(ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo').signature));
 assert.equal(rendered.x,27);assert.equal(rendered.y,68);assert.equal(rendered.scale,42);assert.equal(rendered.rotation,17);assert.equal(rendered.opacity,80);
 await p.select('[data-art-image]','logo-2');await p.click('[data-art-remove]');
 await p.evaluate(()=>document.querySelector('[data-size-choice="60x30"]').click());await ready();assert.deepEqual(await art(),wide,'removing a 48 inch layer does not remove its 60 inch counterpart');
 await p.click('[data-size-choice="48x30"]');await ready();assert.ok(!(await art()).surfaces.desktop['logo-2'],'48 inch removal stays with its own setup');
 await p.reload();await ready();assert.equal((await art()).surfaces.desktop.logo.x,27,'narrow placement survives reload');assert.ok(!(await art()).surfaces.desktop['logo-2']);
 await p.click('[data-size-choice="60x30"]');await ready();assert.deepEqual(await art(),wide,'wide placement and layers survive reload');
 console.log('Immediate artwork edits stay with their own width, including an accessory-loading switch.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
