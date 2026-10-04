const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const bytes=fs.readFileSync(path.join(root,'assets/trim/desktopLwTrimV2.glb'));
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const positions=gltf.meshes[0].primitives.map(p=>gltf.accessors[p.attributes.POSITION]);
const expected={count:positions.reduce((n,p)=>n+p.count,0),min:[0,1,2].map(a=>Math.min(...positions.map(p=>p.min[a]))),max:[0,1,2].map(a=>Math.max(...positions.map(p=>p.max[a])))};
expected.min[0]-=100;expected.max[0]-=100;
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://x').pathname);fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1400,height:1100});
 await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
 await page.waitForFunction(()=>ErgoFlex?.partRegistry.has('Trim_Desktop_Extended')&&ErgoFlex.wheelRigs.length===4,{timeout:120000});
 const actual=await page.evaluate(()=>{const trim=ErgoFlex.partRegistry.get('Trim_Desktop_Extended').obj;trim.geometry.computeBoundingBox();return{count:trim.geometry.attributes.position.count,min:trim.geometry.boundingBox.min.toArray(),max:trim.geometry.boundingBox.max.toArray()};});
 assert.equal(actual.count,expected.count,'Runtime uses every primitive of the replacement trim');
 for(const k of ['min','max'])for(let a=0;a<3;a++)assert.ok(Math.abs(actual[k][a]-expected[k][a])<.00003,'Replacement uses the matching CAD coordinate transform');
 for(const angle of [-5,39,65]){await page.evaluate(angle=>{ErgoFlex.setHeight(43.5);ErgoFlex.setTilt('tilting',angle);},angle);
 const alignment=await page.evaluate(async()=>{const THREE=await import('three'),top=ErgoFlex.partRegistry.get('Variant_Desktop_Extended').obj,trim=ErgoFlex.partRegistry.get('Trim_Desktop_Extended').obj;ErgoFlex.loadedModel.updateMatrixWorld(true);return{parent:top.parent===trim.parent,relative:top.matrixWorld.clone().invert().multiply(trim.matrixWorld).elements,visible:trim.visible};});
 assert.ok(alignment.parent);assert.ok(alignment.visible);const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];assert.ok(alignment.relative.every((n,i)=>Math.abs(n-identity[i])<.00001),'Surface and trim remain aligned throughout tilt');}
 await page.evaluate(()=>{ErgoFlex.setTilt('tilting',-5);ErgoFlex.renderer.setPixelRatio(1);});
 await page.select('#camera-view','side');
 await new Promise(r=>setTimeout(r,700));await page.screenshot({path:'/tmp/ef-desktop-trim-v2.png'});assert.deepEqual(errors,[]);console.log(`Corrected trim: ${actual.count} vertices, CAD alignment and all tilt poses passed.`);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
