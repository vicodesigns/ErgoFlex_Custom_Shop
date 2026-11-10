const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const fixture=`<!doctype html><script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js"}}</script><script type=module>
import * as T from 'three';import {surfaceDrop} from '/item-surface-drop.mjs';
const mat=new T.MeshStandardMaterial();
const box=(scene,size,at)=>{const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...at);scene.add(m);return m;};
const base=()=>{const scene=new T.Scene();box(scene,[5000,20,5000],[0,-10,0]);return scene;};
const result={};
{
 const scene=base(),table=box(scene,[400,20,300],[0,730,0]),item=box(scene,[100,20,100],[0,900,0]);
 const decoy=box(scene,[200,20,200],[0,800,0]);decoy.material=new T.ShaderMaterial();
 const hidden=box(scene,[200,20,200],[0,820,0]);hidden.visible=false;
 result.table=surfaceDrop([item],scene);
 item.position.y+=result.table.delta;result.repeat=surfaceDrop([item],scene);
}
{
 const scene=base(),frame=new T.Group();scene.add(frame);
 for(const x of [-180,180])box(frame,[40,20,400],[x,730,0]);
 for(const z of [-180,180])box(frame,[320,20,40],[0,730,z]);
 const item=box(scene,[100,20,100],[0,900,0]);result.hole=surfaceDrop([item],scene);
}
{
 const scene=base(),slope=new T.Mesh(new T.PlaneGeometry(400,400),mat);slope.rotation.x=-Math.PI/3;slope.position.y=500;scene.add(slope);
 const item=box(scene,[100,20,100],[0,900,0]);result.slope=surfaceDrop([item],scene);
}
{
 const scene=base(),instances=new T.InstancedMesh(new T.BoxGeometry(400,20,300),mat,1);instances.setMatrixAt(0,new T.Matrix4().makeTranslation(0,730,0));scene.add(instances);
 const item=box(scene,[100,20,100],[0,900,0]);result.instance=surfaceDrop([item],scene);
}
{
 const scene=base(),underside=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({side:T.DoubleSide}));underside.rotation.x=Math.PI/2;underside.position.y=740;scene.add(underside);
 const item=box(scene,[100,20,100],[0,900,0]);result.underside=surfaceDrop([item],scene);
}
{
 const scene=base(),item=box(scene,[400,20,300],[0,730,0]),linked=box(scene,[400,20,300],[0,700,0]);result.linked=surfaceDrop([item,linked],scene);
}
{
 const scene=base(),decal=box(scene,[300,5,300],[0,2.5,0]);const item=box(scene,[100,20,100],[0,900,0]);result.decal=surfaceDrop([item],scene);
 const thick=base();box(thick,[300,40,300],[0,20,0]);const item2=box(thick,[100,20,100],[0,900,0]);result.thick=surfaceDrop([item2],thick);
 const glass=base();box(glass,[300,8,300],[0,734,0]);const item3=box(glass,[100,20,100],[0,900,0]);result.glass=surfaceDrop([item3],glass);
}
window.results=result;
</script>`;
const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture);}const file=path.join(root,new URL(req.url,'http://local').pathname);fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type','text/javascript');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const p=await browser.newPage();await p.goto(`http://127.0.0.1:${server.address().port}/fixture`);await p.waitForFunction(()=>window.results);const r=await p.evaluate(()=>results);
 assert.equal(r.table.height,740);assert.equal(r.table.delta,-150);assert.equal(r.repeat.delta,0);
 assert.equal(r.hole.height,0,'Raycasts pass through a real shelf opening');assert.equal(r.instance.height,740);
 assert.ok(Math.abs(r.slope.height-(500+50/Math.sqrt(3)))<1e-4,'Sloping tops use actual geometry');assert.equal(r.underside.height,0,'Downward-facing surfaces do not catch an item');assert.equal(r.linked.height,0,'Linked selected contents are excluded');
 assert.equal(r.decal.height,0,'A 5 mm floor decal is not a surface: it rests on the floor under it');assert.equal(r.thick.height,40,'A 40 mm rug is a surface');assert.equal(r.glass.height,738,'A thin glass shelf with nothing under it still counts');
 console.log('PASS surface drop: tabletop, floor, shelf opening, sloped surface, instanced geometry, hidden/shader/underside rejection, linked selection and repeat placement.');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
