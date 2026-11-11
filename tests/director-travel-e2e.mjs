// Authored travel must survive room furniture contacts and out-of-order seeks.
import assert from 'node:assert/strict';
import {openDirectorBrowser,seek} from './director-e2e-harness.mjs';
const shot={id:'storage',room:'workshop',kind:'storage',preset:'library',size:'60x30',layout:'house',mode:'morning',seconds:22.5,
 motion:{version:2,initial:{height:43.5,tilt:0,x:55.118,z:25.591,yaw:0},clips:[
  {id:'fold',lane:'tilt',kind:'tilt',start:2.5,duration:10,target:65,easing:'linear'},
  {id:'left',lane:'wheels',kind:'travel',start:6.4,duration:8.8,value:65,direction:'left',easing:'linear'},
  {id:'turn',lane:'wheels',kind:'rotate',start:15.5,duration:3,value:90,direction:'right',easing:'linear'},
  {id:'park',lane:'wheels',kind:'travel',start:18.5,duration:3.2,value:52,direction:'left',easing:'linear'}]}};
const cut={schema:'ergoflex.client-cut',version:1,id:'travel-regression',name:'Travel regression',shots:[shot]};
const h=await openDirectorBrowser();
try{
 await h.page.goto(h.base+'/experience/#cut='+Buffer.from(JSON.stringify(cut)).toString('base64url')+'&director=1');
 await h.page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
 const stage=h.page.frames().find(f=>f.url().includes('presentation'));
 assert.ok(stage,'presentation frame loaded');
 // Explicit physical endpoints, also sampled backwards: no collision-history drift.
 for(const [t,x,z,yaw] of [[0,55.118,25.591,0],[10.8,22.618,25.591,0],[15.2,-9.882,25.591,0],[18.5,-9.882,25.591,90],[21.7,-9.882,77.591,90],[6.4,55.118,25.591,0],[21.7,-9.882,77.591,90]]){
  await seek(h.page,t);
  const p=await stage.evaluate(()=>window.ErgoPresentation.capturePose());
  for(const [field,value] of Object.entries({x,z,yaw}))assert.ok(Math.abs(p[field]-value)<.01,`${t}s ${field}: ${p[field]} vs ${value}`);
 }
 assert.deepEqual(h.errors,[]);
 console.log('Director travel: left strafe, turn, parking travel and reverse seeking passed.');
}finally{await h.close();}
