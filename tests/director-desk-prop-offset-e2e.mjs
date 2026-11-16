// S32 (Vico, Nov 15, the high school chapter: a room desk moved in the Desks tab "reloads", ghosts somewhere else and lands
// away from where it was dropped; hiding one makes another pop). Real Chrome on the harness's scratch server, the
// Cinematographer's cut's oilers chapter. Every step records EVERY room desk's group (x, z mm, yaw, visible) and the
// people on the stage before and after, so a ghost or a pop shows as a diff.
//  0. the film's own prop offsets on room desks (the review desk -2.275 m along x on top of its desk pose, the
//     demonstration desk -1.141 m along z, the accessible desk turned): the case Vico hit
//  1. Desks tab on the review desk: the round handle, the gumball's X arrow, the turn ring's knob: after each release AND
//     after the film layers are applied again the desk stands where it was dropped (2 mm / 0.1 deg), nothing else moved;
//     three handle drags in a row do not drift
//  2. a click on the handle without moving: nothing moves; Esc in the middle of a handle drag: back where it stood
//  3. Reset desk: the film's own place plus the prop offset
//  4. Hide desk / Show desk on a desk with a user and a chair (project review: Fern): no 'Preparing' (no re-install), no
//     other desk moves or changes visibility, one Undo each
//  5. after a reload of the chapter (the draft comes back): the desks stand as before the reload; one more handle drag
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-desk-prop-offset-e2e.mjs [shots dir]
// GPU lock behind the protocol.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',H0=path.join(root,CUT),shots=process.argv[2]||null;
const chapter=JSON.parse(fs.readFileSync(path.join(H0,'director-chapters.json'),'utf8')).chapters.find(c=>c.id==='oilers');
const REVIEW='station-project-review',DEMO='station-demonstration-desk';
const failures=[],log=[],check=(ok,what)=>{const line=`${ok?'ok  ':'FAIL'} ${what}`;console.log(line);log.push(line);if(!ok)failures.push(what);};
const {base,page,errors,close}=await openDirectorBrowser();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-offset-')),TEST_PAGE=path.join(H0,'director-ch06-oilers-s32-desk-test.html');
const deg=r=>r*180/Math.PI,until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
const statuses=[];
try{
  await page.evaluateOnNewDocument(()=>{
    window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,desks:w.ErgoFlex.sceneDesks};};
    window.__all=()=>{const {desks,w}=__t(),out={};for(const [id,r] of desks.records)out[id]={x:Math.round(r.group.position.x*10)/10,z:Math.round(r.group.position.z*10)/10,yaw:Math.round(r.group.rotation.y*180/Math.PI*100)/100,vis:r.group.visible,name:r.group.name,uuid:r.group.uuid,size:r.state.size};
      const people=w.ErgoFlex?.workspaceRoom?.people?.list?.()||[];out.__people=people.filter(p=>p.visible).map(p=>p.key+'@'+p.at.join(',')).sort().join(' ');return out;};
    window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));const c=v.drafts?.[v.active]||v.cuts.find(c=>c.id===v.active);return c.shots[0];}catch{return null;}};
    window.__screen=v=>{const {t}=__t(),p=v.clone().project(t.camera),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect();return {x:f.left+c.left+(p.x+1)/2*c.width,y:f.top+c.top+(1-p.y)/2*c.height};};
    window.__frame=id=>{const {t,T,desks}=__t(),r=desks.records.get(id),b=new T.Box3().setFromObject(r.group),c=b.getCenter(new T.Vector3());const look=c.clone().setY(c.y+.9);t.camera.position.set(c.x+.6,c.y+3.6,c.z+4.2);t.controls.target.copy(look);t.camera.lookAt(look);t.controls.update();};
    window.__tools=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});return g;};
    window.__handle=()=>{const {T}=__t(),g=__tools();if(!g?.visible)return null;let d=null;g.traverse(o=>{if(!d&&o.isMesh&&o.geometry?.type==='CircleGeometry'&&Math.abs((o.geometry.parameters?.radius||0)-.16)<1e-6)d=o;});return d?__screen(d.getWorldPosition(new T.Vector3())):null;};
    window.__knob=()=>{const {T}=__t(),g=__tools();if(!g?.visible)return null;const turn=g.children.filter(o=>o.isGroup)[1];return __screen(turn.children[2].getWorldPosition(new T.Vector3()));};
    window.__gum=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.showY===false&&o.userData.directorTools)g=o;});return g;};
    window.__arrow=axis=>{const {t,T}=__t(),g=__gum();if(!g?.object||!g.visible)return null;const at=g.object.getWorldPosition(new T.Vector3());
      const factor=at.distanceTo(t.camera.position)*Math.min(1.9*Math.tan(Math.PI*t.camera.fov/360)/t.camera.zoom,7)*g.size/4;
      const dir=new T.Vector3(axis==='X'?1:0,0,axis==='Z'?1:0).transformDirection(g.object.matrixWorld);return {o:__screen(at),a:__screen(at.clone().addScaledVector(dir,.42*factor))};};
  });
  page.on('console',m=>{const t=m.text();if(/Preparing/i.test(t))statuses.push(t);});
  // 0. the chapter with the Props-tab moves (Import cut: the page's own cut + propEdits)
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the room desks',90000);await wait(2500);
  // 0. a chapter whose cut moves room desks as props (Vico's earlier Props-tab moves: the review desk -2.275 m world x, the
  // demonstration desk -1.141 m world z, the accessible desk turned -156.8 deg), brought in with Import cut. Opening it folds
  // them into those desks' desk edits: every desk stands where pose + prop offset put it; no prop edit moves a desk.
  await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(2500);
  const s0=await page.evaluate(()=>__all());
  const ACC='station-accessible-student',OFF={[REVIEW]:{position:[-2.275,0,0],rotation:[0.6,0,0]},[DEMO]:{position:[0,0,-1.141]},[ACC]:{position:[0.002,0,0.004],rotation:[0,-156.8,0]}};
  // where each should end up: its place now plus the world offset in the room's frame, turned by the rotation's y
  const want=await page.evaluate((OFF)=>{const {desks,T}=__t(),out={};for(const [id,e] of Object.entries(OFF)){const r=desks.records.get(id),g=r.group,p=g.parent;p.updateWorldMatrix(true,false);const V=g.position.constructor,w0=g.getWorldPosition(new V()),w1=w0.clone().add(new V(...e.position)),a=p.worldToLocal(w0.clone()),b=p.worldToLocal(w1.clone());out[id]={x:g.position.x+b.x-a.x,z:g.position.z+b.z-a.z,yaw:(g.rotation.y*180/Math.PI)+(e.rotation?.[1]||0)};}return out;},OFF);
  const html=fs.readFileSync(path.join(root,chapter.page.replace(/^\//,'')),'utf8'),b64=html.match(/#cut=([A-Za-z0-9_-]+)/)[1],cut=JSON.parse(Buffer.from(b64,'base64url').toString());
  const esc=v=>v.replace(/[.*+?^${}()|[\]\\/]/g,m=>'\\'+m);
  cut.shots[0].propEdits=Object.entries(OFF).map(([id,e])=>({match:'^'+esc(s0[id].name)+'$',asset:'highschool:house:station:'+id.slice(8),label:s0[id].name,...e}));
  // the chapter page with that cut (same project id, so its draft comes back on a reload: step 5); a scratch page, removed after
  const enc=Buffer.from(JSON.stringify(cut)).toString('base64url');
  fs.writeFileSync(TEST_PAGE,html.replace(b64,enc));
  await openChapter(page,base,{...chapter,page:'/'+path.relative(root,TEST_PAGE).split(path.sep).join('/')});
  await until(()=>page.evaluate(()=>/Room desks are edited in the Desks tab/.test(document.querySelector('#director-panel [data-status]')?.textContent||'')),'the fold status line',60000).catch(()=>null);
  const st0=await page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');check(/Room desks are edited in the Desks tab/.test(st0),'0. the fold says so: '+st0.slice(0,200));
  await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(2500);
  const s1=await page.evaluate(()=>__all());
  for(const id of Object.keys(OFF)){const w=want[id],q=s1[id],dy=((q.yaw-w.yaw+540)%360)-180;check(Math.abs(q.x-w.x)<3&&Math.abs(q.z-w.z)<3&&Math.abs(dy)<.15,`0. ${id} stands where pose + prop offset put it: ${(q.x-w.x).toFixed(1)}, ${(q.z-w.z).toFixed(1)} mm, ${dy.toFixed(2)} deg off`);}
  const exp0=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="export"]').click();}));
  const sh0=JSON.parse(exp0).shots[0],deskProps=(sh0.propEdits||[]).filter(e=>/ErgoFlex desk/.test(e.match||''));
  check(Array.isArray(sh0.propEdits)&&!deskProps.length,`0. no prop edit moves a room desk any more (${deskProps.length}); desk edits: ${JSON.stringify((sh0.deskEdits||[]).map(e=>[e.desk,e.pose&&[e.pose.x,e.pose.z,Math.round(e.pose.yaw*573)/10]]))}`);
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="undo"]').click());await wait(2500);
  await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(2500);
  const u0=await page.evaluate(()=>__all());const du=Object.keys(OFF).filter(id=>Math.abs(u0[id].x-s1[id].x)>3||Math.abs(u0[id].z-s1[id].z)>3).map(id=>`${id} ${(u0[id].x-s1[id].x).toFixed(0)},${(u0[id].z-s1[id].z).toFixed(0)} mm`);
  check(!du.length,`0. Undo of the fold: the prop edits are back and the desks still stand there${du.length?' (moved: '+du.join(', ')+')':''}`);
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="redo"]').click());await wait(2500);
  // the Props tab hands a room desk to the Desks tab
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=props]').click());await wait(1000);
  const lane=await page.evaluate(()=>{const b=[...document.querySelectorAll('[data-action="pp-lane"]')].find(e=>/review desk/i.test(e.textContent+e.title));b?.click();return !!b;});
  await wait(1200);
  const tab=await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab][aria-pressed="true"]')?.dataset.inspectorTab);
  check(!lane||tab==='desks',`0. selecting the review desk in the Props tab opens it in the Desks tab (${lane?'lane row found':'no props lane row for it any more'}; tab ${tab})`);
  // helpers
  const diff=(a,b,skip=[])=>Object.keys(b).filter(k=>!k.startsWith('__')&&!skip.includes(k)).flatMap(k=>{const p=a[k],q=b[k];if(!p||!q)return [`${k}: ${p?'gone':'new'}`];const out=[];if(Math.abs(p.x-q.x)>2||Math.abs(p.z-q.z)>2)out.push(`${k} moved ${(q.x-p.x).toFixed(1)},${(q.z-p.z).toFixed(1)} mm`);if(Math.abs(p.yaw-q.yaw)>.1)out.push(`${k} turned ${(q.yaw-p.yaw).toFixed(2)} deg`);if(p.vis!==q.vis)out.push(`${k} ${q.vis?'shown':'hidden'}`);return out;});
  const settle=async()=>{await wait(600);await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='6';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(1800);await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(1800);};
  const drag=async(from,dx,dy,{esc=false}={})=>{await page.mouse.move(from.x,from.y);await wait(250);await page.mouse.down();await page.mouse.move(from.x+dx/2,from.y+dy/2,{steps:6});await page.mouse.move(from.x+dx,from.y+dy,{steps:6});await wait(200);if(esc){await page.keyboard.press('Escape');await wait(300);}await page.mouse.up();await wait(700);};
  async function step(label,act,{expect=null,others=true}={}){
    const before=await page.evaluate(()=>__all());await act();const now=await page.evaluate(()=>__all());await settle();const after=await page.evaluate(()=>__all());
    const want=expect?expect(before,now):now[REVIEW];
    if(!expect)check(Math.hypot(now[REVIEW].x-before[REVIEW].x,now[REVIEW].z-before[REVIEW].z)>20||Math.abs(now[REVIEW].yaw-before[REVIEW].yaw)>1,`${label}: the drag moved the desk (${(now[REVIEW].x-before[REVIEW].x).toFixed(1)}, ${(now[REVIEW].z-before[REVIEW].z).toFixed(1)} mm, ${(now[REVIEW].yaw-before[REVIEW].yaw).toFixed(2)} deg)`);
    const off=r=>`${(r.x-want.x).toFixed(1)},${(r.z-want.z).toFixed(1)} mm ${(r.yaw-want.yaw).toFixed(2)} deg`;
    const at=r=>Math.abs(r.x-want.x)<=2&&Math.abs(r.z-want.z)<=2&&Math.abs(r.yaw-want.yaw)<=.1;
    check(at(now[REVIEW])&&at(after[REVIEW]),`${label}: the review desk at release ${off(now[REVIEW])} / after the film layers ${off(after[REVIEW])} from where it should be`);
    if(others){const d=diff(before,after,[REVIEW]);check(!d.length,`${label}: nothing else moved${d.length?': '+d.join('; '):''}`);const pp=x=>x.__people.split(' ').filter(p=>!/^fern@/.test(p)).join(' ');check(pp(before)===pp(after),`${label}: the other people stay${pp(before)===pp(after)?'':' (people changed)'}`);}
    return {before,now,after};
  }
  // 1. the Desks tab
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=desks]').click());await wait(800);
  await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`).click(),REVIEW);await wait(800);
  await page.evaluate(i=>__frame(i),REVIEW);await wait(900);
  await until(()=>page.evaluate(()=>!!__handle()),'the round handle');
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'s32-desk-1-selected.png')});}
  {const r=await step('1.1 round handle drag 1/3',async()=>drag(await page.evaluate(()=>__handle()),65,-25));
   // the stage leaves the dropped desk alone: 30 s later the same group (no rebuild) at the same place
   await wait(30000);const later=await page.evaluate(()=>__all());
   check(later[REVIEW].uuid===r.after[REVIEW].uuid&&Math.abs(later[REVIEW].x-r.now[REVIEW].x)<2&&Math.abs(later[REVIEW].z-r.now[REVIEW].z)<2,`1.1 30 s after the drop: the same desk group (${later[REVIEW].uuid===r.after[REVIEW].uuid?'not rebuilt':'REBUILT'}) at ${later[REVIEW].x}, ${later[REVIEW].z}`);
   const d=diff(r.after,later);check(!d.length,`1.1 30 s after the drop nothing else changed${d.length?': '+d.join('; '):''}`);}
  await page.evaluate(i=>__frame(i),REVIEW);await wait(900);
  for(let i=2;i<=3;i++){await page.evaluate(i=>__frame(i),REVIEW);await wait(700);await step(`1.${i} round handle drag ${i}/3`,async()=>drag(await page.evaluate(()=>__handle()),60+i*5,-25));}
  await page.evaluate(i=>__frame(i),REVIEW);await wait(700);
  await step('1.4 gumball X arrow',async()=>{const g=await page.evaluate(()=>__arrow('X'));const u={x:g.a.x-g.o.x,y:g.a.y-g.o.y},l=Math.hypot(u.x,u.y);await drag(g.a,u.x/l*70,u.y/l*70);});
  await page.evaluate(i=>__frame(i),REVIEW);await wait(700);
  await step('1.5 turn ring knob',async()=>drag(await page.evaluate(()=>__knob()),55,18));
  if(shots)await page.screenshot({path:path.join(shots,'s32-desk-2-dragged.png')});
  // 2. click without a move; Esc mid-drag
  await step('2.1 click on the handle, no move',async()=>{const h=await page.evaluate(()=>__handle());await page.mouse.move(h.x,h.y);await wait(200);await page.mouse.down();await wait(80);await page.mouse.up();await wait(700);},{expect:b=>b[REVIEW]});
  await step('2.2 Esc in the middle of a handle drag',async()=>drag(await page.evaluate(()=>__handle()),80,-30,{esc:true}),{expect:b=>b[REVIEW]});
  // 3. Reset desk
  await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`)?.click(),REVIEW);await wait(700);
  // (Reset desk: the film's own place; the prop offset the chapter had was the Director's own edit, folded into the desk edit)
  await step('3 Reset desk',async()=>{await page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-reset"]').click());await wait(1200);},{expect:()=>s0[REVIEW]});
  // 4. Hide / Show a desk with a user and a chair; one Undo each
  const undo=async()=>{await page.evaluate(()=>document.querySelector('#director-panel [data-action="undo"]').click());await wait(1500);};
  const hideStep=async(label,act,wantVis)=>{
    statuses.length=0;const before=await page.evaluate(()=>__all());await act();await wait(1200);
    const sawPreparing=await page.evaluate(()=>/Preparing/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));await settle();const after=await page.evaluate(()=>__all());
    check(after[REVIEW].vis===wantVis,`${label}: the review desk is ${wantVis?'shown':'hidden'}`);
    const d=diff(before,after,[REVIEW]);check(!d.length,`${label}: no other desk moves or changes visibility${d.length?': '+d.join('; '):''}`);
    check(!sawPreparing&&!statuses.length,`${label}: no 'Preparing' (no re-install)`);
    const gone=before.__people.split(' ').filter(p=>!after.__people.includes(p)),came=after.__people.split(' ').filter(p=>p&&!before.__people.includes(p));
    console.log(`     people: gone [${gone.join(' ')}] came [${came.join(' ')}]`);
    return {before,after,gone,came};
  };
  await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`)?.click(),REVIEW);await wait(600);
  const h1=await hideStep('4.1 Hide desk',()=>page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-visibility"]').click()),false);
  {await wait(20000);const later=await page.evaluate(()=>__all()),d=diff(h1.after,later);check(!d.length&&Object.keys(later).filter(k=>!k.startsWith('__')).every(k=>later[k].uuid===h1.after[k].uuid),`4.1 20 s after the hide no desk is rebuilt, moved or shown/hidden${d.length?': '+d.join('; '):''}`);}
  check(h1.came.length===0,`4.1 Hide desk: nobody else pops in${h1.came.length?': '+h1.came.join(' '):''}`);
  if(shots)await page.screenshot({path:path.join(shots,'s32-desk-3-hidden.png')});
  const h2=await hideStep('4.2 Undo the hide',undo,true);
  check(h2.after.__people===h1.before.__people,'4.2 Undo: the people as before the hide');
  await hideStep('4.3 Hide desk again',()=>page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-visibility"]').click()),false);
  const h4=await hideStep('4.4 Show desk',()=>page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-visibility"]').click()),true);
  check(h4.after.__people===h1.before.__people,'4.4 Show desk: the people as before the hide');
  // 6. the fallback (a size or a clip change: restore + re-install): the stage holds its frame, so NO frame shows the desk at
  //    the room's own place. The review desk is first nudged 36 in along x (away from its own place), then 60 -> 48 -> 60
  //    and a Lift clip added, sampling its group every animation frame of the stage.
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=desks]').click());await wait(600);
  await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`)?.click(),REVIEW);await wait(700);
  const home=(await page.evaluate(()=>__all()))[REVIEW];
  for(let i=0;i<3;i++){await page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-nudge"][data-section="x:12"]').click());await wait(900);}
  await settle();const moved=(await page.evaluate(()=>__all()))[REVIEW];
  check(Math.hypot(moved.x-home.x,moved.z-home.z)>600,`6.0 nudged 36 in: ${(moved.x-home.x).toFixed(0)}, ${(moved.z-home.z).toFixed(0)} mm from its place`);
  await page.evaluate(id=>{const W=document.getElementById('stage').contentWindow;W.__samples=[];const f=()=>{const r=W.ErgoFlex.sceneDesks.records.get(id);const fr=W.ErgoPresentation.three().renderer.info.render.frame;if(r?.group)W.__samples.push([Math.round(r.group.position.x),Math.round(r.group.position.z),r.state.size,r.group.visible,fr]);else W.__samples.push(null);if(W.__samples.length<3000&&!W.__stopSamples)W.requestAnimationFrame(f);};W.__stopSamples=false;W.requestAnimationFrame(f);},REVIEW);
  const size=async v=>{await page.evaluate(v=>document.querySelector(`#director-panel [data-action="dk-size"][data-section="${v}"]`)?.click(),v);await wait(7000);};
  const own=(await page.evaluate(()=>__all()))[REVIEW];
  await size(own.size==='48x30'?'60x30':'48x30');await size(own.size==='48x30'?'48x30':'60x30');
  const add=await page.evaluate(()=>{const b=document.querySelector('#director-timeline [data-desk-add="lift"]');b?.click();return !!b;});await wait(7000);
  const samples=await page.evaluate(()=>{const W=document.getElementById('stage').contentWindow;W.__stopSamples=true;return W.__samples;});
  // a frame DRAWN with the desk at home: the renderer's frame count moved on from the sample before (the stage holds its last
  // frame while the film layers are re-installed: then the count stands still and nothing is drawn)
  const atHome=samples.filter((x,i)=>x&&Math.hypot(x[0]-home.x,x[1]-home.z)<100&&x[3]&&samples[i+1]&&samples[i+1][4]!==x[4]),missing=samples.filter(x=>!x).length,held=samples.filter(x=>x&&Math.hypot(x[0]-home.x,x[1]-home.z)<100).length;
  check(samples.length>30&&!atHome.length,`6.1 ${samples.length} stage frames through 60/48 size changes${add?' and a Lift clip':' (no Lift button for a room desk)'}: ${atHome.length} DRAWN at the room's own place (${held} frames held there, not drawn), ${missing} without a desk group`);
  const end=(await page.evaluate(()=>__all()))[REVIEW];check(Math.hypot(end.x-moved.x,end.z-moved.z)<3,`6.2 after the changes the desk stands where it was nudged to (${(end.x-moved.x).toFixed(1)}, ${(end.z-moved.z).toFixed(1)} mm)`);
  // 5. reload: the draft comes back, the desks stand as before
  const pre=await page.evaluate(()=>__all());const dr={};
  await page.reload();await until(()=>page.evaluate(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||'')).catch(()=>false),'the chapter after the reload',300000);
  await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the desks after the reload',90000);await wait(3000);
  await page.evaluate(()=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(2500);
  const post=await page.evaluate(()=>__all()),d5=diff(pre,post);
  check(!d5.length,`5.0 after the reload every desk stands as before${d5.length?': '+d5.join('; '):''} `);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=desks]').click());await wait(800);
  await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`).click(),REVIEW);await wait(800);
  await page.evaluate(i=>__frame(i),REVIEW);await wait(900);await until(()=>page.evaluate(()=>!!__handle()),'the round handle after the reload');
  await step('5.1 round handle drag after the reload',async()=>drag(await page.evaluate(()=>__handle()),70,-20));
}catch(e){failures.push(e.message);console.log('FAIL',e.message);}
finally{if(errors.length){failures.push('page errors');console.log('page errors:',errors.slice(0,5));}await close();fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(TEST_PAGE,{force:true});}
console.log(failures.length?`\n${failures.length} failed`:'\nall passed');process.exit(failures.length?1:0);
