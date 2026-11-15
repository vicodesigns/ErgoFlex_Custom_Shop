// Director People path editing smoke (S31 M3; real Chrome on the harness's own scratch server): the storage chapter of
// the Cinematographer's cut, Andre's walk. Select him: his path is drawn on the floor with a handle per point. Drag a
// point: the cast entry's walk.path changes and the stage re-solves (his place at the playhead moves). Add a point (the
// + on a leg), delete it (Delete), undo; a field of the path section (pace) writes walk.pace.
//   CHROME=".../chrome.exe" SHOTS=<dir> node tests/director-people-path-e2e.mjs       (run under the GPU lock)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',KEY='andre-steps-back',T=6.0;
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(c=>c.id==='storage');
chapter.page=chapter.page.replace(/\\/g,'/');
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-film/storage.json'),'utf8'));
const castOf=o=>{if(o&&typeof o==='object'){if(Array.isArray(o.cast)&&o.cast.some(e=>e?.key))return o.cast;for(const v of Object.values(o)){const c=castOf(v);if(c)return c;}}return null;};
const filmCast=castOf(film),row=filmCast.findIndex(e=>e.key===KEY),path0=filmCast[row].walk.path;
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'people-path-shots-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser({width:1600,height:1000});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('  ok: '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const snap=(name,el)=>(el||page).screenshot({path:path.join(shots,name+'.png')});
const live=()=>page.evaluate(k=>{const x=document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom?.people?.list().find(x=>x.key===k);return x?{at:x.at,visible:x.visible}:null;},KEY);
// Andre's entry in the chapter's peopleEdits, as the Director's draft has it
const mine=()=>page.evaluate(k=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));const cut=v.drafts?.[v.active]||v.cuts.find(c=>c.id===v.active);for(const s of cut.shots){const e=s.peopleEdits?.cast?.find(e=>e.key===k);if(e)return e;}}catch{}return null;},KEY);
// path points (room mm) on the page, in pixels
const screen=pts=>page.evaluate(pts=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),root=w.ErgoFlex.workspaceRoom.root,V=root.position.constructor,r=f.getBoundingClientRect();root.updateWorldMatrix(true,false);
  return pts.map(p=>{const q=new V(p[0],0,p[1]).applyMatrix4(root.matrixWorld).project(t.camera);return {x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height,on:Math.abs(q.x)<.85&&Math.abs(q.y)<.85&&q.z<1};});},pts);
const drawn=()=>page.evaluate(()=>{const g=document.getElementById('stage').contentWindow.ErgoPresentation.three().scene.getObjectByName('Director path tools');return g?{visible:g.visible,handles:g.children.filter(c=>c.isMesh&&c.geometry?.type==='SphereGeometry').length}:null;});
const pointsInPanel=()=>page.$$eval('#director-panel .people-path-point',l=>l.length);
const dragFrom=async(a,b,steps=12,shot=null)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps);await wait(30);}if(shot){await wait(700);await snap(shot);}await page.mouse.up();await wait(400);};
try{
  await openChapter(page,base,chapter);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="people"]').click());
  await seek(page,T);await wait(1200);
  await until(()=>page.$(`#director-panel .people-row:nth-child(${row+1}) .people-pick`),'the cast is listed');
  await page.evaluate(i=>document.querySelector(`#director-panel .people-row:nth-child(${i+1}) .people-pick`).click(),row);
  await until(async()=>(await drawn())?.visible,'the path is drawn on the floor');
  const d0=await drawn();check(d0.handles>=path0.length,`Andre's path is drawn with a handle per point (${path0.length} points, ${d0.handles} handles incl. the + on each leg)`);
  check(await pointsInPanel()===path0.length,'the People tab has the path section with every point');
  const before=await live();check(before?.visible,'Andre is on the stage, walking, at '+T+' s');
  await snap('01-path-handles');
  // drag the point at the start of the leg he is on now (or its end): his place at the playhead must move
  const legs=path0.slice(0,-1).map((p,i)=>{const q=path0[i+1],dx=q[0]-p[0],dz=q[1]-p[1],l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((before.at[0]-p[0])*dx+(before.at[1]-p[1])*dz)/l2));return {i,d:Math.hypot(before.at[0]-p[0]-dx*t,before.at[1]-p[1]-dz*t)};}).sort((a,b)=>a.d-b.d);
  const px=await screen(path0);let idx=[legs[0].i,legs[0].i+1].find(i=>i>0&&px[i].on);if(idx===undefined)idx=px.findIndex((p,i)=>i>0&&p.on);
  check(idx>0,`point ${idx} (next to where he is at ${T} s) is on the screen`);
  await dragFrom(px[idx],{x:px[idx].x+70,y:px[idx].y+45},14,'02-dragging-handle');
  const e1=await until(async()=>{const e=await mine();return e&&JSON.stringify(e.walk?.path)!==JSON.stringify(path0)?e:null;},'the cast entry takes the dragged point');
  check(e1.walk.path.length===path0.length&&e1.walk.path.some((p,i)=>i===idx&&Math.hypot(p[0]-path0[i][0],p[1]-path0[i][1])>40)&&e1.walk.path.every((p,i)=>i===idx||(p[0]===path0[i][0]&&p[1]===path0[i][1])),`walk.path[${idx}] moved ${Math.round(Math.hypot(e1.walk.path[idx][0]-path0[idx][0],e1.walk.path[idx][1]-path0[idx][1]))} mm, the rest as it was`);
  check(e1.walk.pace===filmCast[row].walk.pace&&e1.walk.then===filmCast[row].walk.then&&e1.walk.start===filmCast[row].walk.start,'the walk keeps its other fields');
  const after=await until(async()=>{const x=await live();return x&&Math.hypot(x.at[0]-before.at[0],x.at[1]-before.at[1])>20?x:null;},'the stage re-solves the walk');
  check(true,`the stage re-solved: Andre at ${T} s moved ${Math.round(Math.hypot(after.at[0]-before.at[0],after.at[1]-before.at[1]))} mm`);
  // add a point: the + in the middle of a leg on the screen
  const p1=e1.walk.path,mids=p1.slice(0,-1).map((p,i)=>[(p[0]+p1[i+1][0])/2,(p[1]+p1[i+1][1])/2]),ms=await screen(mids),ends=await screen(p1),leg=ms.map((m,i)=>[i,m.on?Math.hypot(ends[i].x-ends[i+1].x,ends[i].y-ends[i+1].y):0]).sort((a,b)=>b[1]-a[1])[0][0];
  await page.mouse.click(ms[leg].x,ms[leg].y);await wait(300);console.log('  status: '+await page.$eval('#director-panel [data-status]',e=>e.textContent));
  const e2=await until(async()=>{const e=await mine();return e?.walk?.path?.length===p1.length+1?e:null;},'a point is added');
  check(Math.hypot(e2.walk.path[leg+1][0]-mids[leg][0],e2.walk.path[leg+1][1]-mids[leg][1])<30,`a point added in the middle of leg ${leg} (${e2.walk.path.length} points)`);
  await until(async()=>await pointsInPanel()===p1.length+1,'the panel lists it');
  // delete it: it is the selected handle; Delete
  await page.keyboard.press('Delete');
  const e3=await until(async()=>{const e=await mine();return e?.walk?.path?.length===p1.length?e:null;},'the point is deleted');
  check(JSON.stringify(e3.walk.path)===JSON.stringify(p1)&&!!(await live()),'Delete removes the selected point (Andre stays in the chapter)');
  // undo: the point is back
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');
  await until(async()=>(await mine())?.walk?.path?.length===p1.length+1,'undo brings the point back');
  check(true,'Ctrl+Z undoes the delete');
  // the inspector: pace
  await page.evaluate(()=>{const el=document.querySelector('#director-panel [name="pe-path-pace"]');el.value='2.6';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await until(async()=>(await mine())?.walk?.pace===2.6,'pace written');check(true,'the Pace field writes walk.pace');
  const sec=await page.evaluateHandle(()=>{const h=[...document.querySelectorAll('#director-panel h4')].find(h=>/path/i.test(h.textContent));h.scrollIntoView({block:'start'});return h.parentElement;});
  await wait(300);await snap('03-inspector');void sec;
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS director people path (${passed.length} checks) · shots: ${shots}`);
}finally{await close();}
