// The Director's view navigation and Ava's pose hints, end to end (19 Nov 2026, real GPU Chrome, the coast chapter of
// the Cinematographer's cut: Ava at the film desk at 0 s, the camera on her "at the free suite").
// Setup this test does itself (what Windows could not find from a script):
//   - the chapter page opens the Director (&director=1), and view navigation (view-nav.mjs) is active exactly while the
//     Director is open (director.mjs setOpen -> nav.setActive). Its trace is window.__directorNavTrace of the DIRECTOR
//     page (the parent), not the stage iframe; it fills as the stage canvas sees presses.
//   - people: the chapter's film cast is on the stage; if the Director left them off (Windows saw that on this chapter),
//     ensureLivePeople prints the stage's state and the page's warnings, then turns them on the way the player does.
// Checks:
//   (i)   a double-click on Ava opens pose mode with "The film draws this model (…) at 0–4.35 s", a line for each model
//         the film draws without a correction (30 in seated, then standing), and, once her 28 in model has a correction
//         (a joint turned here), "Copy this correction to the 30 in model (shown 4.35–5.35 s)"; the copy is one edit,
//         Undo takes it back. Screenshots.
//   (ii)  a click of the wheel on a desk item, on a person (selected) and on the room: the camera glides there and the
//         point is in the middle of the view, the ease taking about 250 ms (__directorNavTrace: centre, then ease-done)
//   (iii) right-drag after a centre orbits around what was centred: the pivot stays, the distance stays, it stays in
//         the middle of the view, the camera moves
//   node tests/director-nav-and-pose-e2e.mjs        (CUT=<cut dir> with a coast chapter that casts Ava; SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf,FILM_DRAFT_READER,watchStage,ensureLivePeople,pickInView} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='coast'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`nav and pose e2e: skipped (${CUT} has no coast chapter page here).`);process.exit(0);}
const film=JSON.parse(fs.readFileSync(path.join(root,chapter.shot.replace(/^\//,'')),'utf8'));
const AVA=film.people?.cast?.find(c=>c.id==='people-ava-sit-type'&&c.desk&&!c.station);
if(!AVA){console.log(`nav and pose e2e: skipped (${CUT}'s coast chapter does not cast Ava at the film desk).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'nav-and-pose-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser(),warnings=watchStage(page);
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const setField=(name,value)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const panelText=()=>page.$eval('#director-panel',e=>e.innerText);
const live=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom?.people?.list()||[]);
const edits=()=>page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};const c=v.drafts[v.active]||v.cuts.find(c=>c.id===v.active);return c.shots[0].peopleEdits||null;}catch{return null;}})()`);
// the view: where the orbit pivot is on screen (NDC), the camera's distance to it, the pivot and the camera
const view=()=>page.evaluate(()=>{const t=document.getElementById('stage').contentWindow.ErgoPresentation.three(),c=t.controls,cam=t.camera;cam.updateMatrixWorld(true);
  const p=c.target.clone().project(cam);return {ndc:[p.x,p.y],dist:cam.position.distanceTo(c.target),target:c.target.toArray(),cam:cam.position.toArray()};});
const trace=()=>page.evaluate(()=>structuredClone(window.__directorNavTrace||[]));
const middleClick=async(x,y)=>{await page.mouse.move(x,y);await wait(60);await page.mouse.down({button:'middle'});await wait(40);await page.mouse.up({button:'middle'});};
// After a wheel click: the centre step and the ease that followed, and the view once it has landed.
async function centred(what,before){
  await wait(700);
  const tr=(await trace()).filter(s=>s.t>=before),c=tr.findLast(s=>s.kind==='centre'),done=c&&tr.find(s=>s.t>=c.t&&/^ease-/.test(s.kind));
  const v=await view();
  check(!!c&&c.result!=='nothing'&&c.result!=='no-stage',`${what}: the wheel click centres (${c?.result||'no centre step in __directorNavTrace: '+JSON.stringify(tr.map(s=>s.kind))})`);
  check(done?.kind==='ease-done',`${what}: the ease ends by itself (${done?.kind||'none'})`);
  if(done)check(done.t-c.t>=150&&done.t-c.t<=550,`${what}: in about 250 ms (${Math.round(done.t-c.t)} ms)`);
  check(Math.hypot(v.ndc[0],v.ndc[1])<.03,`${what}: the point is in the middle of the view (ndc ${v.ndc.map(n=>n.toFixed(3)).join(', ')})`);
  return {c,v};
}
try{
  await openChapter(page,base,chapter);
  await seek(page,0);
  check(await page.evaluate(()=>document.body.classList.contains('directing')),'the Director is open (view navigation is active while it is)');
  await click('#director-panel [data-inspector-tab="people"]');
  await until(()=>page.$('#director-panel [data-scene-people]'),'the People tab');
  const {forced}=await ensureLivePeople(page,{id:'coast',filmPeople:film.people,warnings});
  if(forced)console.log('NOTE (product, to look into) the Director left the chapter\'s people off; this run turned them on');
  await wait(1500);

  // ---- (i) Ava's pose hints
  const ava=await until(async()=>(await live()).find(p=>p.key===AVA.key&&p.visible&&p.id==='people-ava-sit-type'),'Ava seated at the desk at 0 s');
  const at=await until(async()=>{const v=await pickInView(page,'person');return v.found?.find(p=>p.key===ava.key&&p.id==='people-ava-sit-type')||null;},'Ava in the picture at 0 s (a ray that meets her)');
  await page.mouse.click(at.x,at.y,{clickCount:2,count:2,delay:40});
  await until(()=>page.$('#director-panel .people-pose-bar'),'pose mode on a double-click on Ava');
  check(/^Pose mode · sit-type$/.test((await page.$eval('#director-panel .people-pose-bar strong',e=>e.textContent)).trim()),'a double-click on Ava opens pose mode on her 28 in seated model');
  const notes=await until(async()=>{const t=await panelText();return /The film draws this model/.test(t)?t:null;},'the pose mode names the models the film draws',15000).catch(()=>panelText());
  check(/The film draws this model \(typing at the desk, seated \(desk at 28 in\)\) at 0–4\.35 s\./.test(notes),'"The film draws this model (… desk at 28 in) at 0–4.35 s."');
  check(/From 4\.35 s to 5\.35 s the film shows Ava typing at the desk, seated \(desk at 30 in\): it has no correction\./.test(notes),'"From 4.35 s to 5.35 s the film shows Ava … (desk at 30 in): it has no correction."');
  check(/the film shows Ava typing standing at a mid-height desk \(desk at 39 in\): it has no correction\./.test(notes),'a line for her mid-height standing model');
  await shot('01-pose-hints');
  // a correction on her 28 in model: the left shoulder turned 12 degrees
  await setField('pe-joint','upperarm_l');await until(()=>page.$('#director-panel [name="pe-rx"]'),'the joint\'s fields');
  await setField('pe-rx',12);
  await until(async()=>{const x=(await edits())?.cast?.find(c=>c.key===AVA.key)?.postures?.['people-ava-sit-type'];return x&&(x.pose||x.poseKeys?.length);},'her 28 in model has a correction');
  const btn=await until(()=>page.$eval('#director-panel [data-action="pe-pose-copy-model"]',e=>e.textContent).catch(()=>null),'the copy button');
  check(/^Copy this correction to the 30 in model \(shown 4\.35–5\.35 s\)$/.test(btn.trim()),`the button: "${btn.trim()}"`);
  await shot('02-copy-button');
  await click('#director-panel [data-action="pe-pose-copy-model"]');
  const copied=await until(async()=>{const p=(await edits())?.cast?.find(c=>c.key===AVA.key)?.postures;return p?.['people-ava-sit-type-30']?p:null;},'the copy is in the cut');
  check(JSON.stringify(copied['people-ava-sit-type-30'])===JSON.stringify(copied['people-ava-sit-type']),'the 30 in model has the same correction');
  check(!/From 4\.35 s to 5\.35 s[^\n]*desk at 30 in\): it has no correction/.test(await panelText()),'and its "no correction" line is gone');
  await shot('03-copied');
  await click('#director-appbar [data-action="undo"]');
  await until(async()=>!(await edits())?.cast?.find(c=>c.key===AVA.key)?.postures?.['people-ava-sit-type-30'],'Undo takes the copy back');
  check(true,'Undo takes the copy back (one edit)');
  await click('#director-panel [data-action="pe-pose-done"]');await wait(400);
  await page.keyboard.press('Escape');await wait(400);

  // ---- (ii) the wheel click: a desk item, a person, the room
  const box=await page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};});
  // a desk item: a thing on one of the desks' mounts that a ray of the stage camera meets first (pickInView; Windows,
  // 19 Nov 2026: the film desk's accessories at 0 s were not found by their boxes' middles)
  const items=await until(async()=>{const v=await pickInView(page,'item');return v.why?null:v;},'rays through the view',20000);
  const item=items.found[0]?{...items.found[0]}:{why:'no ray met a thing on a desk mount (rays met: '+JSON.stringify(items.kinds)+')'};
  if(check(!item.why,`a desk item in the picture${item.why?': '+item.why:': '+item.name}`)){
    const t0=(await page.evaluate(()=>performance.now()));await middleClick(item.x,item.y);
    const {v}=await centred('desk item',t0);
    const onIt=await page.evaluate((x,y,piv)=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),T=w.__directorThree.THREE;   // (the item under the clicked point, its box now)
      const r=f.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(((x-r.left)/r.width)*2-1,-((y-r.top)/r.height)*2+1),t.camera);
      const shown=o=>{for(let a=o;a;a=a.parent)if(!a.visible||a.userData?.directorTools||a.isTransformControls)return false;return true;};
      const hit=ray.intersectObjects(t.scene.children,true).find(h=>h.object.isMesh&&shown(h.object));let it=hit?.object;while(it?.parent&&!/^(Accessory mount|Desk dressing):/.test(it.parent.name||''))it=it.parent;
      if(!it?.parent)return null;const b=new T.Box3().setFromObject(it).expandByScalar(.03);return b.containsPoint(new T.Vector3(...piv));},item.x,item.y,v.target);
    check(onIt!==false,'desk item: the pivot is on the item'+(onIt===null?' (the item has moved out from under the point: not checked)':''));
    await shot('04-centre-item');
  }
  // a person, selected: the wheel click centres the selection
  const met=(await pickInView(page,'person')).found||[],someone=met.find(p=>!p.featured)||met[0]||null,sp=someone&&{x:someone.x,y:someone.y};
  let personCentred=null;
  if(check(!!sp,`a person in the picture to centre on${someone?': '+someone.id:''}`)){
    await page.mouse.click(sp.x,sp.y);await until(async()=>/Person ·/.test(await page.$eval('#director-panel [data-selected-header]',e=>e.textContent).catch(()=>'')),'the person is selected');
    const t1=await page.evaluate(()=>performance.now());await middleClick(sp.x,sp.y);
    const {c,v}=await centred('person',t1);check(c?.result==='selection','person: centred on the selection, not the surface');personCentred=v;
    await shot('05-centre-person');
  }
  // (iii) orbit around what was centred
  if(personCentred){
    const t2=await page.evaluate(()=>performance.now()),cx=box.l+box.w*.5,cy=box.t+box.h*.5;
    await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});for(let i=1;i<=10;i++){await page.mouse.move(cx+i*14,cy-i*2);await wait(25);}await page.mouse.up({button:'right'});await wait(400);
    const v=await view(),moved=Math.hypot(...v.cam.map((x,i)=>x-personCentred.cam[i]));
    check(moved>.05,`right-drag orbits: the camera moved ${moved.toFixed(2)} m`);
    check(Math.hypot(...v.target.map((x,i)=>x-personCentred.target[i]))<1e-4,'around the centred person: the pivot stayed');
    check(Math.abs(v.dist-personCentred.dist)/personCentred.dist<.01,`at the same distance (${personCentred.dist.toFixed(2)} → ${v.dist.toFixed(2)} m)`);
    check(Math.hypot(v.ndc[0],v.ndc[1])<.03,'they stay in the middle of the view');
    check((await trace()).some(s=>s.t>=t2&&s.kind==='down'&&s.button===2),'(the trace has the right-button press)');
    await shot('06-orbit');
  }
  // the room: nothing selected, a wall or the floor
  await page.keyboard.press('Escape');await wait(400);await page.keyboard.press('Escape');await wait(400);
  const t3=await page.evaluate(()=>performance.now());await middleClick(box.l+box.w*.2,box.t+box.h*.3);
  const {c:cr}=await centred('the room',t3);check(cr?.result==='surface','the room: centred on the surface under the pointer');
  await shot('07-centre-room');
  check(!errors.length,'no module errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await shot('99-failed');check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL nav and pose e2e: ${failures.length} of the checks (shots in ${SHOTS})`:`PASS nav and pose e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
