// A person of the room's own cast, after "Bring in the room's people", dragged with the Gumball (19 Nov 2026, Vico, the
// gym chapter: Priya snapped straight back after each drag, her entry's `at` growing to 12.9 m while she stayed drawn at the
// film's own spot). Bringing the room's people in keeps their poseSource AND gives them an `at`; the film's people config can
// carry a `place` for them ("put somewhere by hand": wellness puts Priya at 1250,-1000). The drag must take them in properly
// (takeIn: poseSource gone, the room's placement left out, `place` cleared) and put them where the Gumball dropped them.
//   1. Bring in the room's people; pick one of them that is in the picture with a poseSource (env WHO=<id> picks one)
//   2. drag an arrow of the Gumball: the entry has no poseSource, no `place` of theirs, an `at` equal to where they are drawn
//   3. they stay where they were dropped after the stage rebuilds (a seek away and back), and a second drag moves them
//      from where they are drawn (the entry's `at` follows the drawn place, no drift)
//   node tests/director-room-people-move-e2e.mjs        (CHAPTER=wellness|commons|coast, CUT=<cut dir>, WHO=<person id>, SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf,FILM_DRAFT_READER,watchStage,ensureLivePeople,aimAt} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine',CH=process.env.CHAPTER||'wellness';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id===CH):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`room people move e2e: skipped (${CUT} has no ${CH} chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'room-people-move-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser(),warnings=watchStage(page);
const filmPeople=JSON.parse(fs.readFileSync(path.join(root,chapter.shot.replace(/^\//,'')),'utf8')).people;
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok   '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const live=()=>page.evaluate(()=>{const p=document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom?.people;return p?p.list():[];});
const edits=()=>page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};const c=v.drafts[v.active]||v.cuts.find(c=>c.id===v.active);return c.shots[0].peopleEdits||null;}catch{return null;}})()`);
const gizmo=()=>page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,g=w.__directorPeopleGizmo;return g?{shown:!!(g.visible&&g.enabled&&g.object),axis:g.axis||null,dragging:!!g.dragging,mode:g.mode}:null;});
let WHO=null;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// drag an arrow of the Gumball by ~108 px (hover it first: TransformControls reads its axis on pointermove)
async function dragArrow(aimedAlready=false){
  const dirs=await page.evaluate(()=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),g=w.__directorPeopleGizmo,V=g.object.position.constructor,r=f.getBoundingClientRect();
    const o=g.object.getWorldPosition(new V()),px=v=>{const c=v.clone().project(t.camera);return {x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height};},s=o.distanceTo(t.camera.getWorldPosition(new V()))*.1;
    return {o:px(o),X:px(o.clone().add(new V(s,0,0))),Z:px(o.clone().add(new V(0,0,s)))};});
  let grab=null;
  for(const ax of ['X','Z']){const d=dirs[ax],dx=d.x-dirs.o.x,dy=d.y-dirs.o.y,len=Math.hypot(dx,dy)||1;
    for(let k=12;k<=260&&!grab;k+=6){const x=dirs.o.x+dx/len*k,y=dirs.o.y+dy/len*k;await page.mouse.move(x,y);await wait(30);if((await gizmo())?.axis===ax)grab={ax,x,y,ux:dx/len,uy:dy/len};}
    if(grab)break;}
  if(!grab){const who=(await live()).find(p=>p.id===WHO&&p.visible);   // not in reach of the film's camera: aim the free view at them (once)
    if(!who||aimedAlready)throw Error('no arrow of the Gumball under the pointer');
    await aimAt(page,who.key);await wait(900);return dragArrow(true);}
  await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(grab.x+grab.ux*9*i,grab.y+grab.uy*9*i);await wait(25);}await page.mouse.up();
  return grab.ax;
}
try{
  await openChapter(page,base,chapter);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="people"]')?.click());
  await until(()=>page.$('#director-panel [data-scene-people]'),'the People tab');
  await ensureLivePeople(page,{id:CH,filmPeople,warnings});
  // 1. the room's own people are listed as pose-only entries (poseSource, a key of the form room-<name>-<id>) while the
  //    chapter's own cast is the film's: select the one asked for (WHO=<model id>, default Priya in the gym)
  await seek(page,1);await wait(1000);
  WHO=process.env.WHO||(CH==='wellness'?'people-priya-stretch':null);   // (other rooms: the first room person that is drawn)
  const drawnIds=(await live()).filter(p=>p.visible).map(p=>p.id);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('#director-panel .people-row')].map(r=>r.dataset.personKey));
  console.log('rows: '+rows.join(', '));
  let key=null;
  for(const k of rows.filter(k=>/^room-/.test(k))){
    await click('#director-panel .people-row[data-person-key="'+k+'"] .people-pick');await wait(600);
    const id=await page.evaluate(()=>{const g=document.getElementById('stage').contentWindow.__directorPeopleGizmo;return g?.object?.userData?.person?.id||null;});
    if(id&&(WHO?id===WHO:drawnIds.includes(id))){key=k;WHO=id;break;}
  }
  check(!!key,'the room entry for '+WHO+' is in the People list as a room entry (room-...): '+(key||'rows: '+rows.join(', ')));
  await until(async()=>{const g=await gizmo();return g?.shown?g:null;},'the Gumball shows',8000);
  const rk=WHO,L0=await live(),here=L0.find(p=>p.id===WHO&&p.visible);
  check(!!here,'they are drawn in the picture, at '+(here&&here.at.map(Math.round)));
  console.log('target '+key+' ('+WHO+'), film place for it: '+JSON.stringify((filmPeople.place||{})[rk]||null));
  await shot('01-selected');
  // 2. the first drag
  const drawn0=(await live()).find(p=>p.id===WHO&&p.visible).at.slice();
  const ax=await dragArrow();
  const e1=await until(async()=>{const e=await edits(),x=e?.cast?.find(c=>c.key===key);return x&&!x.poseSource?{e,x}:null;},'the drag takes them in (the entry loses its poseSource)');
  check(true,`the drag (arrow ${ax}) took them in: no poseSource, at ${e1.x.at.join(', ')} mm`);
  check(!(e1.e.place&&e1.e.place[rk]),`no place of theirs is left in the saved peopleEdits (${JSON.stringify(e1.e.place||null)})`);
  check([].concat(e1.e.except||[]).includes(rk)&&![].concat(e1.e.only||[]).includes(rk),'the room\'s own placement of them is left out of the chapter (except, not in only)');
  const d1=await until(async()=>{const p=(await live()).find(p=>p.id===WHO&&p.visible);return p&&dist(p.at,e1.x.at)<60?p:null;},`the stage draws them at the entry's spot ${e1.x.at}`);
  check(dist(d1.at,drawn0)>80,`they moved ${Math.round(dist(d1.at,drawn0))} mm from where they were drawn (${drawn0.map(Math.round)} to ${d1.at.map(Math.round)}), where the entry says`);
  await shot('02-dropped');
  // 3. they stay after the stage rebuilds
  await seek(page,Math.min(8,chapter.seconds-1));await wait(1500);await seek(page,1);await wait(1500);
  const d2=await until(async()=>{const p=(await live()).find(p=>p.id===WHO&&p.visible);return p||null;},'them drawn again after the seek');
  check(dist(d2.at,e1.x.at)<60,`after a seek away and back they are still where they were dropped (drawn ${d2.at.map(Math.round)}, entry ${e1.x.at})`);
  // and a second drag moves them from where they are drawn: the entry follows the drawn place
  await click(`#director-panel .people-row[data-person-key="${key}"]`);await until(async()=>{const g=await gizmo();return g?.shown?g:null;},'the Gumball shows again',8000);
  const ax2=await dragArrow();
  const e2=await until(async()=>{const e=await edits(),x=e?.cast?.find(c=>c.key===key);return x&&dist(x.at,e1.x.at)>80?{e,x}:null;},'the second drag is an edit');
  const d3=await until(async()=>{const p=(await live()).find(p=>p.id===WHO&&p.visible);return p&&dist(p.at,e2.x.at)<60?p:null;},`the stage draws them at the second entry spot ${e2.x.at}`);
  check(true,`a second drag (arrow ${ax2}) moved them to ${e2.x.at.join(', ')} and they are drawn there (${d3.at.map(Math.round)})`);
  check(!(e2.e.place&&e2.e.place[rk]),'still no place of theirs in the saved peopleEdits');
  await shot('03-second');
  check(!errors.length,'no module errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(`PASS room people move e2e (${passed.length} checks; shots in ${SHOTS})`);
}catch(error){console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await statusOf(page));console.error('errors: '+errors.join(' | '));process.exitCode=1;}
finally{await close();}
