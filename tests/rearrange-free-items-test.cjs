const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const html=`<!doctype html><style>body{margin:0}canvas{width:800px;height:600px}</style><input id=editing type=checkbox checked><canvas id=c></canvas>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type=module>
import * as T from 'three';import {RoomInteractions} from '/room-interactions.mjs';
const canvas=document.querySelector('canvas'),scene=new T.Scene(),root=new T.Group();scene.add(root);
const camera=new T.OrthographicCamera(-3000,3000,2250,-2250,1,10000);camera.position.set(0,5000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const item=new T.Mesh(new T.BoxGeometry(100,100,100),new T.MeshBasicMaterial());item.position.set(-500,50,0);root.add(item);
const blocker=new T.Mesh(new T.BoxGeometry(200,200,200),new T.MeshBasicMaterial());blocker.position.set(0,100,0);root.add(blocker);root.updateMatrixWorld(true);
const room={root,floorBounds:new T.Box3(new T.Vector3(-1500,0,-1500),new T.Vector3(1500,3000,1500))};
let edits=0;const r=new RoomInteractions({canvas,camera,controls:{enabled:true},scene,room:()=>room,deskBox:()=>new T.Box3(new T.Vector3(-180,0,-180),new T.Vector3(180,500,180)),enabled:()=>document.querySelector('#editing').checked,onEditEnd:()=>edits++});
r.root=root;r.entries=[{id:'item',obj:item,objects:[item],name:'Chair',surface:'floor',collider:true,movable:true,pushable:true},{id:'blocker',obj:blocker,objects:[blocker],name:'Cabinet',surface:'floor',collider:true,movable:true,pushable:false}];
window.fixture={r,item,blocker,T,edits:()=>edits,point:x=>{const p=new T.Vector3(x,100,0).project(camera),b=canvas.getBoundingClientRect();return{x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2}}};
</script>`;
const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const file=path.join(root,new URL(req.url,'http://local').pathname);fs.readFile(file,(err,body)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type','text/javascript');res.end(body)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const p=await browser.newPage();p.on('pageerror',e=>console.error(e));await p.setViewport({width:900,height:700});await p.goto(`http://127.0.0.1:${server.address().port}/fixture`);await p.waitForFunction(()=>window.fixture);
 const drag=async(x)=>{const start=await p.evaluate(()=>fixture.point(fixture.item.position.x)),end=await p.evaluate(x=>fixture.point(x),x);await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(end.x,end.y,{steps:20});await p.mouse.up();};
 await drag(500);let result=await p.evaluate(()=>({x:fixture.item.position.x,blocker:fixture.blocker.position.x,edits:fixture.edits()}));console.log('Drag result',result);assert.ok(Math.abs(result.x-500)<10,'Item crosses cabinet and desk');assert.equal(result.blocker,0,'Blocker is not pushed');assert.equal(result.edits,1,'Whole drag creates one edit');
 const rotation=await p.evaluate(()=>{const {r,item}=fixture;r.moveObject(item,-500,0);r.select(r.entries[0]);return r.rotateSelected(45)});assert.equal(rotation,true,'Item rotates while overlapping cabinet/desk');
 await p.evaluate(()=>fixture.r.moveObject(fixture.item,500,0));await drag(2500);result=await p.evaluate(()=>{const {T,item}=fixture;return new T.Box3().setFromObject(item).max.x});assert.ok(result<=1500.000001,'Room boundary still limits item placement');
 const collision=await p.evaluate(()=>{const {T,r}=fixture;return r.moveDesk(new T.Box3(new T.Vector3(-300,0,-50),new T.Vector3(-200,100,50)),{x:500,z:0}).blocked});assert.equal(collision,true,'Desk motion collision still works');
 await p.click('#editing');const before=await p.evaluate(()=>fixture.item.position.x);await drag(500);assert.equal(await p.evaluate(()=>fixture.item.position.x),before,'Editing off ignores item drags');
 console.log('PASS free item rearranging: through furniture and desk, overlapping rotation, no pushing, one undo edit, room boundary, and normal desk collisions.');
}finally{await browser?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
