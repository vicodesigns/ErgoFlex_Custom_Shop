const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(process.env.ERGOFLEX_TEST_ROOT||path.join(__dirname,'..'));
const server=http.createServer((req,res)=>{
 const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push(m.text());});
 await page.setViewport({width:1366,height:1100});await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html?v=tilt-reach-20261006`);
 await page.waitForFunction(()=>window.ErgoFlex?.ledPixelRenderer&&document.querySelector('#demo-remote #motion-dock'),{timeout:120000});
 await page.evaluate(()=>{const a=ErgoFlex;a.renderer.setPixelRatio(.6);a.renderer.shadowMap.enabled=false;a.setLedMotionEnabled(false);a.setLedEffect({mode:'solid'},false);a.setLedsEnabled(true);a.setLedColor('#ff0000',false);a.setHeight(43.5);});
 const results=[];
 for(const size of ['48x30','60x30']){
  await page.click(`[data-demo-size="${size}"]`);
  for(const tilt of [-5,0,5,15,65]){
   const state=await page.evaluate(async tilt=>{
    const THREE=await import('three'),a=ErgoFlex;a.setTilt('tilting',tilt);a.loadedModel.updateMatrixWorld(true);
    const fields=[];a.loadedModel.traverse(o=>{if(o.isMesh&&o.material.uniforms?.desktopDepthScale)fields.push(o);});
    const source=fields.find(o=>o.name===(a.currentConfig.size==='60x30'?'Extended desktop LED reflection':'Desktop_3 LED reflection'));
    const mat=source.material.clone();mat.uniforms.efPixelActive.value=0;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-178,50,-358,-138,50,-358,-178,50,-296,-138,50,-296],3));geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();
    const scene=new THREE.Scene();scene.background=new THREE.Color('#000');scene.add(new THREE.Mesh(geometry,mat));
    const camera=new THREE.OrthographicCamera(-20,20,31,-31,.1,150);camera.position.set(-158,100,-327);camera.up.set(0,0,-1);camera.lookAt(-158,50,-327);camera.updateMatrixWorld();
    const renderer=a.renderer,target=new THREE.WebGLRenderTarget(512,512),previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);
    const sample=(x,z=-327)=>{const v=new THREE.Vector3(x,50,z).project(camera),pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,Math.min(511,Math.max(0,Math.round((v.x+1)*255.5))),Math.min(511,Math.max(0,Math.round((v.y+1)*255.5))),1,1,pixel);return [...pixel];};
    const out={size:a.currentConfig.size,tilt:a.tiltConfigs.find(c=>c.name==='tilting').currentDeg,depthScale:mat.uniforms.desktopDepthScale.value,front:sample(a.currentConfig.size==='60x30'?-141:-145),middle:sample(-153),rear:sample(-174),fields:fields.map(o=>({name:o.name,scale:o.material.uniforms.desktopDepthScale.value,reach:o.material.uniforms.fadeReach.value,centers:o.material.uniforms.reflectionBandCenters.value.toArray()}))};
    renderer.setRenderTarget(previous);target.dispose();geometry.dispose();mat.dispose();return out;
   },tilt);
   assert.equal(state.tilt,tilt);assert.ok(state.fields.length>=10);assert.ok(state.fields.every(f=>f.scale===state.depthScale&&f.reach===14));
   assert.deepEqual(state.fields[0].centers,[-171,-164,-157]);results.push(state);
   if([-5,0,15].includes(tilt))await page.screenshot({path:`/tmp/led-tilt-${size}-${tilt}.png`});
  }
 }
 for(const size of ['48x30','60x30']){
  const rows=results.filter(r=>r.size===size),base=rows[0],level=rows[1],raised=rows[3];assert.equal(base.depthScale,1,'Authored -5° field remains unchanged');assert.equal(level.depthScale,1.25,'Level extends the footprint by 25%');
  assert.ok(level.front[0]>base.front[0]+5,'GPU shows reflection reaching the front at level');assert.ok(raised.front[0]>level.front[0]+15,'Positive tilt visibly lights the front');assert.equal(rows[4].depthScale,raised.depthScale,'High angles remain bounded');
  assert.ok(rows.every((r,i)=>i===0||r.front[0]>=rows[i-1].front[0]),'Front illumination grows without a step backwards');
 }
 const extra=await page.evaluate(()=>{const a=ErgoFlex;a.setTilt('tilting',0);a.setLedSurface('desktopReach',40,false);const reach=[];a.loadedModel.traverse(o=>{if(o.material?.uniforms?.desktopDepthScale)reach.push({reach:o.material.uniforms.fadeReach.value,scale:o.material.uniforms.desktopDepthScale.value});});a.setLedSurface('desktopReach',100,false);a.setLedsEnabled(false);const off=[];a.loadedModel.traverse(o=>{if(o.material?.uniforms?.desktopDepthScale)off.push(o.material.uniforms.strength.value);});return {reach,off};});
 assert.ok(extra.reach.every(r=>Math.abs(r.reach-6.2)<.001&&r.scale===1.25),'Manual reach still tunes the pose-dependent field');assert.ok(extra.off.every(v=>v===0),'Master off removes every desktop reflection');
 assert.deepEqual(errors,[],'No browser or shader errors');console.log(JSON.stringify(results.map(({size,tilt,depthScale,front})=>({size,tilt,depthScale,front})),null,2));console.log('PASS: rendered tilt-dependent front reach, -5° baseline, both sizes, matching power modules, high-angle bound, manual tuning and master off.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
