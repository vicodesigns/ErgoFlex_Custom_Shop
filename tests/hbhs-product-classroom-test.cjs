const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),out=path.join(root,'scene-shots/hbhs-product-classroom');fs.mkdirSync(out,{recursive:true});
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/highschool-legacy-layout.json')));
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,protocolTimeout:300000,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultNavigationTimeout(180000);await p.setViewport({width:1600,height:1100});
 const ready=async()=>{await p.waitForFunction(()=>window.ErgoFlex?.sceneDesks&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:180000});await p.evaluate(async()=>{const e=ErgoFlex;await e.presetReady;await e.workspaceRoom.ready;await e.workspaceAccessories.ready;await e.sceneDesks.objects.ready;e.renderer.setAnimationLoop(null);e.renderer.setPixelRatio(.5);e.renderer.shadowMap.enabled=false;await e.surfaceArtwork.refresh();});};
 await p.goto(`http://127.0.0.1:${server.address().port}/?room=product&view=product`);await ready();
 await p.evaluate(()=>ErgoFlex.applyPreset({id:'hbhs'},{size:'60x30'}));await ready();
 const snapshot=()=>p.evaluate(()=>{const e=ErgoFlex;e.saveBuildPreset();return{config:structuredClone(e.currentConfig),objects:structuredClone(e.sceneDesks.active.state.objects)}});
 const black=await snapshot();assert.equal(black.config.woodFinish,'Black Birch');assert.equal(black.config.baseFinish,'Black');assert.equal(black.config.trimColor,'#e8702a');assert.equal(Object.keys(black.config.artwork.surfaces).length,4);assert.equal(black.config.artwork.surfaces['right-panel'].logo.backing,'white-disc');
 const toggle=async tone=>{await p.click(`[data-hbhs-tone="${tone}"]`);await p.waitForFunction(()=>!document.querySelector('[data-hbhs-tone="white"]').disabled);await ready();};
 await toggle('white');const white=await snapshot();assert.equal(white.config.woodFinish,'White Birch');assert.equal(white.config.baseFinish,'White');assert.deepEqual(white.objects,black.objects,'toggle preserves all positions');assert.deepEqual(white.config.artwork,black.config.artwork);assert.equal(white.config.accessoryFinishes['logitech-mx-master'],'white');
 await toggle('black');assert.deepEqual((await snapshot()).objects,black.objects);await toggle('white');
 await p.click('[data-size-choice="48x30"]');await ready();assert.equal((await snapshot()).config.woodFinish,'Black Birch');await toggle('white');await toggle('black');const narrow=await snapshot();
 await p.click('[data-size-choice="60x30"]');await ready();assert.deepEqual((await snapshot()).config,white.config,'60-inch white setup is independent from 48-inch black');await p.reload();await ready();assert.equal((await snapshot()).config.woodFinish,'White Birch');
 await p.click('[data-size-choice="48x30"]');await ready();assert.deepEqual((await snapshot()).config,narrow.config,'48-inch setup survives reload');console.log('HBHS Product: both palettes, graphics, accessory finishes, unchanged placements, independent widths and reload passed.');
 await p.evaluate(async legacy=>{const e=ErgoFlex,project=e.serializeProject();project.presentation.sceneDesks.rooms['highschool/house']=legacy.room;project.presentation.sceneAssets['highschool:house']=legacy.assets;project.presentation.institutionalRooms.highschool={layout:'house',mode:'morning'};project.presentation.buildPresets.active=null;await e.applyProject(project);e.setRoomScene('highschool',false);},legacy);await ready();
 const classroom=await p.evaluate(async()=>{
  const e=ErgoFlex,T=await import('three'),rows=[...e.sceneDesks.records.values()];
  if(rows.length!==7)throw Error('Missing ErgoFlex stations: '+rows.length);
  const colors={};for(const r of rows){await r.rig.artworkReady;if(Object.keys(r.state.artwork.surfaces).length!==4)throw Error(r.id+' school graphics missing');if(r.state.style.trimColor!=='#e8702a')throw Error(r.id+' trim wrong');colors[r.state.style.woodFinish]=(colors[r.state.style.woodFinish]||0)+1;}
  for(const color of ['Black Birch','White Birch'])if(!colors[color])throw Error('Missing mixed palette '+color);
  const teacher=e.sceneDesks.records.get('main'),frame=[...teacher.objects.values()].find(o=>o.obj.userData.propId==='ergoflex-picture-frame');
  if(!frame||Math.abs(frame.obj.scale.x-1000)>1)throw Error('New teacher frame inherited procedural scale');
  const review=e.sceneDesks.records.get('station-project-review'),easel=[...review.objects.values()].find(o=>o.obj.userData.propId==='ergoflex-art-easel');
  if(!easel||Math.abs(easel.obj.position.x)>2)throw Error('APA easel inherited old ruler position');
  const media=e.sceneDesks.records.get('station-research-desk'),tablet=[...media.objects.values()].find(o=>o.obj.userData.propId==='ergoflex-drawing-tablet');
  if(!tablet||Math.abs(tablet.obj.scale.x-1000)>1||!tablet.obj.visible)throw Error('MMET tablet inherited journal scale');
  const demo=e.sceneDesks.records.get('station-demonstration-desk'),wave=[...demo.objects.values()].find(o=>o.saved.role==='shelf'&&/role detail/.test(o.obj.name));
  if(!wave||!wave.obj.visible||wave.obj.children.length<3)throw Error('Wave tank/pumpjack missing');
  const assets=e.workspaceRoom.assets(),byId=id=>assets.find(o=>o.userData.propId===id);
  for(const id of ['wall-bench','lockers','resource-shelf','research-gallery','bell-tower-print','goggles-rack','poster-gallery'])if(!byId(id))throw Error('Missing fixture '+id);
  if(Math.abs(byId('resource-shelf').position.x+2200)>1)throw Error('Old resource shelf blocks new printer');
  if(Math.abs(byId('research-gallery').position.y-1900)>1)throw Error('Periodic table kept obsolete position');
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){const t=byId('student-table-'+row+'-'+col);if(!t||Math.abs(t.position.x-[-2075,75,2225][col])>1||Math.abs(t.position.z-[500,2500,4500][row])>1)throw Error('Study table retained old row placement '+row+' '+col);}
  if(e.workspaceRoom.missingProps.length)throw Error('Missing models: '+e.workspaceRoom.missingProps.join(','));
  return {stations:rows.length,colors,assets:assets.length,wave:true,frame:true,easel:true,tablet:true};
 });console.log('Restored legacy classroom '+JSON.stringify(classroom));
 // Check all five activity/time settings and both main desktop widths.
 for(const mode of ['morning','afternoon','evening','night','party']){
  await p.evaluate(mode=>ErgoFlex.setMeasuredRoomMode('highschool',mode),mode);await ready();
  for(const size of ['48x30','60x30']){await p.evaluate(size=>ErgoFlex.sceneDesks.setSize(size),size);await ready();assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.style.trimColor),'#e8702a');assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.records.size),7);}
 }
 console.log('Classroom: all five activities and 48/60 widths retain seven stations and school colors.');
 // A subsequent authored room finish stays editable after migration.
 await p.evaluate(()=>{const r=ErgoFlex.sceneDesks.active;r.state.style.trimColor='#d45620';ErgoFlex.sceneDesks.ctx.writeLive(r);ErgoFlex.sceneDesks.persist();ErgoFlex.setRoomScene('highschool',false,{preserveDesk:true});});await ready();assert.equal(await p.evaluate(()=>ErgoFlex.sceneDesks.active.state.style.trimColor),'#d45620');
 assert.deepEqual(errors,[]);console.log('PASS HBHS Product and restored classroom; later owner edits preserved.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
