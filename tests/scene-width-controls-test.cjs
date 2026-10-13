const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const p=await browser.newPage();p.setDefaultNavigationTimeout(180000);
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.renderer&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{await ErgoFlex.presetReady;await ErgoFlex.workspaceRoom.ready;await ErgoFlex.workspaceAccessories.ready;await ErgoFlex.sceneDesks.objects.ready;ErgoFlex.renderer.setAnimationLoop(null)})};
 const art=()=>p.evaluate(()=>structuredClone(ErgoFlex.currentConfig.artwork));
 await p.setViewport({width:1600,height:1100});await p.goto(`http://127.0.0.1:${server.address().port}/?room=office&view=room`);await ready();
 const width=async size=>{await p.click('[data-office-size="'+size+'"]');await ready();assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.size),size);assert.equal(await p.$eval('[data-office-size="'+size+'"]',el=>el.getAttribute('aria-pressed')),'true');};
 const light=async color=>p.evaluate(color=>{const m=ErgoFlex.sceneDesks,s=structuredClone(m.active.state);s.lights.color=color;s.lights.enabled=true;s.lights.glow=18;m.ctx.activate({...m.active,state:s});m.persist()},color);
 await width('60x30');await light('#123456');
 await p.select('#accessory-finish-ergo-keyboard','white');
 await p.evaluate(()=>{const m=ErgoFlex.sceneDesks;m.objects.select('accessory-logitech-mx-master');m.objects.remove()});await ready();
 assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.accessories.includes('logitech-mx-master')),false);
 await width('48x30');await light('#654321');await p.select('#accessory-finish-ergo-keyboard','black');
 if(await p.$eval('#accessory-logitech-mx-master',el=>el.checked)){await p.click('#accessory-logitech-mx-master');await ready();}
 await p.click('#accessory-logitech-mx-master');await ready();
 await width('60x30');assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.lights.color),'#123456');
 assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.accessoryFinishes['ergo-keyboard']),'white');
 assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.accessories.includes('logitech-mx-master')),false);
 await width('48x30');assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.lights.color),'#654321');
 assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.accessoryFinishes['ergo-keyboard']||'black'),'black');
 assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.accessories.includes('logitech-mx-master')),true);
 await p.reload();await ready();assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.lights.color),'#654321');
 await width('60x30');assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.lights.color),'#123456');
 // Existing V1 projects migrate once; a stale tab writing V1 cannot replace V2.
 const legacy=await p.evaluate(()=>{const s=ErgoFlex.sceneDesks.serialize();s.rooms[ErgoFlex.sceneDesks.key].desks.main.name='Legacy saved desk';return s});
 const legacySeed=await p.evaluateOnNewDocument(s=>{localStorage.removeItem('ergoflex.sceneDesksBySizeV2');localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({...s,v:1}))},legacy);
 await p.reload();await ready();await p.removeScriptToEvaluateOnNewDocument(legacySeed.identifier);assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.name),'Legacy saved desk');assert.equal(await p.$eval('[data-office-size="60x30"]',el=>el.getAttribute('aria-pressed')),'true','Room width highlight restores on load');
 await p.evaluate(()=>{const m=ErgoFlex.sceneDesks;m.active.state.name='Current saved desk';m.persist();const old=structuredClone(m.serialize());old.rooms[m.key].desks.main.name='Stale tab desk';localStorage.setItem('ergoflex.sceneDesksV1',JSON.stringify({...old,v:1}))});
 await p.reload();await ready();assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.name),'Current saved desk');
 const saveFailed=await p.evaluate(()=>{const m=ErgoFlex.sceneDesks,original=m.ctx.writeStore;m.ctx.writeStore=()=>false;const saved=m.saveSetting();m.ctx.writeStore=original;return saved});assert.equal(saveFailed,false);
 console.log('PASS public width controls; independently saved lights, peripheral finishes, accessory removals/additions and reload; V1 migration and stale-tab isolation; truthful failed-save status.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
