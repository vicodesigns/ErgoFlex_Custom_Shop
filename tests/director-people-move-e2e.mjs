// The Move tool for people (19 Nov 2026, real GPU Chrome, the coast chapter: the OCC media lab). Vico: "I can select a
// character, but I don't have the tools I need … When I click on them I should see the gumball right away with a move,
// and I can double click and it reveals all the points for the pose mode." Before: a person of the room's own cast (at
// a room desk, on a seat) had no Gumball, only Fine-tune pose.
//   1. a click in the view on a person who is not the film desk's user selects them and shows the Gumball at once
//   2. dragging its arrow moves them: the edit puts them at a spot of their own in this chapter (the room's placement
//      of them left out with except), the stage draws them there, their pose corrections kept
//   3. a double-click on them opens pose mode (the joint dots), Done leaves it
//   4. Undo puts them back where the room has them
//   node tests/director-people-move-e2e.mjs        (CUT=<cut dir>, default the Cinematographer's; SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='coast'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`people move e2e: skipped (${CUT} has no coast chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'people-move-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok   '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const live=()=>page.evaluate(()=>{const p=document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom?.people;return p?p.list():[];});
const edits=()=>page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};const c=v.drafts[v.active]||v.cuts.find(c=>c.id===v.active);return c.shots[0].peopleEdits||null;}catch{return null;}})()`);
// a point of the view on a person: their middle (up from the feet by `up` metres), in page pixels; null when off screen
const pointOn=(key,up=.9)=>page.evaluate((key,up)=>{
  const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),o=w.ErgoFlex.workspaceRoom.people.byKey(key);if(!o||!o.visible)return null;
  const c=o.getWorldPosition(new o.position.constructor());c.y+=up;c.project(t.camera);const r=f.getBoundingClientRect();
  return Math.abs(c.x)<.85&&Math.abs(c.y)<.85&&c.z<1?{x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height}:null;},key,up);
const gizmo=()=>page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,g=w.__directorPeopleGizmo;return g?{shown:!!(g.visible&&g.enabled&&g.object),axis:g.axis||null,dragging:!!g.dragging,mode:g.mode}:null;});
const selectedKey=()=>page.$eval('#director-panel .people-row.selected',e=>e.dataset.personKey).catch(()=>null);
try{
  await openChapter(page,base,chapter);
  await click('#director-panel [data-inspector-tab="people"]');
  await until(()=>page.$('#director-panel [data-scene-people]'),'the People tab');
  // 1. someone of the room who is not the film desk's user, in the picture, clicked in the view
  let pick=null;
  for(const t of [1,3,6,9,12]){
    await seek(page,t);
    for(const p of (await live()).filter(p=>p.visible&&p.allowed&&!p.missing&&!p.variant&&!(p.desk&&!p.station))){
      const at=await pointOn(p.key);if(!at)continue;
      await page.mouse.click(at.x,at.y);await wait(700);
      const head=await page.$eval('#director-panel [data-selected-header]',e=>e.textContent).catch(()=>'');
      if(/Person ·/.test(head)&&await selectedKey()){pick={...p,listKey:p.key,t,at,key:await selectedKey(),head};break;}
      await page.keyboard.press('Escape');await wait(300);
    }
    if(pick)break;
  }
  check(!!pick,`a click in the view selects someone who is not the film desk's user${pick?`: ${pick.head.trim()} (${pick.id}${pick.station?' at '+pick.station:''}, ${pick.t} s)`:''}`);
  const g0=await until(async()=>{const g=await gizmo();return g?.shown?g:null;},'the Gumball shows at once',5000).catch(()=>null);
  check(!!g0&&g0.mode==='translate','the Gumball shows at once, in Move');
  await shot('01-selected');
  // 2. drag an arrow of the Gumball (hover it first: TransformControls reads its axis on pointermove)
  const from=(await live()).find(p=>p.key===pick.listKey&&p.visible)||(await live()).find(p=>p.visible&&p.id===pick.id);
  const dirs=await page.evaluate(()=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),g=w.__directorPeopleGizmo,V=g.object.position.constructor,r=f.getBoundingClientRect();
    const o=g.object.getWorldPosition(new V()),px=v=>{const c=v.clone().project(t.camera);return {x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height};},s=o.distanceTo(t.camera.getWorldPosition(new V()))*.1;
    return {o:px(o),X:px(o.clone().add(new V(s,0,0))),Z:px(o.clone().add(new V(0,0,s)))};});
  let grab=null;
  for(const ax of ['X','Z']){const d=dirs[ax],dx=d.x-dirs.o.x,dy=d.y-dirs.o.y,len=Math.hypot(dx,dy)||1;
    for(let k=12;k<=260&&!grab;k+=6){const x=dirs.o.x+dx/len*k,y=dirs.o.y+dy/len*k;await page.mouse.move(x,y);await wait(30);if((await gizmo())?.axis===ax)grab={ax,x,y,ux:dx/len,uy:dy/len};}
    if(grab)break;}
  check(!!grab,`an arrow of the Gumball under the pointer${grab?' ('+grab.ax+')':''}`);
  await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(grab.x+grab.ux*9*i,grab.y+grab.uy*9*i);await wait(25);}await page.mouse.up();
  const after=await until(async()=>{const e=await edits(),x=e?.cast?.find(c=>c.key===pick.key);return x&&Array.isArray(x.at)?{e,x}:null;},'the move is an edit');
  check(!after.x.station&&!after.x.desk&&!after.x.poseSource,`they are at a spot of their own now: at ${after.x.at.join(', ')} mm, turn ${after.x.turn}°`);
  if(!pick.extra)check([].concat(after.e.except||[]).length>0,'the room\'s placement of them is left out of the chapter (except: '+[].concat(after.e.except||[]).join(', ')+')');
  const moved=await until(async()=>{const p=(await live()).find(p=>p.key===pick.key&&p.visible);return p&&from&&Math.hypot(p.at[0]-from.at[0],p.at[1]-from.at[1])>80?p:null;},'the stage draws them where they were dragged');
  check(!!moved,`the stage draws them ${Math.round(Math.hypot(moved.at[0]-from.at[0],moved.at[1]-from.at[1]))} mm from where they were`);
  await shot('02-moved');
  // 3. double-click: pose mode
  const at2=await until(()=>pointOn(pick.key),'them in the picture after the move');
  await page.mouse.click(at2.x,at2.y,{clickCount:2,count:2,delay:40});
  await until(()=>page.$('#director-panel .people-pose-bar'),'pose mode opens on a double-click');
  check(/Pose mode/.test(await page.$eval('#director-panel .people-pose-bar',e=>e.textContent)),'a double-click opens pose mode');
  await shot('03-pose');
  await click('#director-panel [data-action="pe-pose-done"]');await wait(400);
  // 4. Undo: back where the room has them
  for(let i=0;i<4;i++){const e=await edits(),x=e?.cast?.find(c=>c.key===pick.key);if(!x||!Array.isArray(x.at)||x.poseSource||x.station)break;await click('#director-appbar [data-action="undo"]');await wait(700);}
  const e3=await edits(),x3=e3?.cast?.find(c=>c.key===pick.key);
  check(!x3||!Array.isArray(x3.at)||!!x3.poseSource||!!x3.station,'Undo takes the move back');
  const back=await until(async()=>{const l=await live();return l.find(p=>p.visible&&p.id===pick.id&&from&&Math.hypot(p.at[0]-from.at[0],p.at[1]-from.at[1])<60)||null;},'the stage draws them where they were');
  check(!!back,'the stage draws them where the room has them again');
  await shot('04-undone');
  check(!errors.length,'no module errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(`PASS people move e2e (${passed.length} checks; shots in ${SHOTS})`);
}catch(error){await shot('99-failed');console.log('FAIL '+error.message);process.exitCode=1;}
finally{await close();}
