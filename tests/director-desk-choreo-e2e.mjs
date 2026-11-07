// Director "Desk" menu: every room desk has its own Lift / Tilt timeline (experience/desk-choreo.mjs), end to end
// (real GPU Chrome; not one of the quick tests/cinematic-* checks). Chapter 5 (coast, five other desks in the room):
//   - the Desk menu lists the room's desks; a room desk shows only Lift and Tilt lanes, the featured desk all three;
//   - lift and tilt moves are added to two desks and timed like the featured desk's (form, drag), undo is one step;
//   - "Other desks" rows show every other desk's moves; deselecting (Featured desk) shows the featured lanes again;
//   - the live stage poses each desk from its own start at the playhead (each held to its size's lift / tilt limits);
//   - Export cut carries shot.deskEdits[].clips (the featured desk's motion is untouched); a reload keeps them;
//   - clearing a desk's moves puts the desk back and drops its entry.
//
//   node tests/director-desk-choreo-e2e.mjs      (BASE=http://127.0.0.1:3122 to use a running server; SHOTS=<dir> keeps screenshots)
// Run it under the browser-test slot gate (scratchpad slot.sh).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';
import {maximumTiltForHeight} from '../motion-limits.mjs';

const chapter=chapterList()?.find(c=>c.id==='coast');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director desk choreo e2e: skipped (${HQ} has no coast chapter page in this checkout).`);process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-choreo-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const near=(a,b,eps=.06)=>Math.abs(a-b)<=eps;
const A='station-film-edit-01',B='station-accessible-edit-04';
try{
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(JSON.parse(t)));return make.call(this,b);};});
  await openChapter(page,base,chapter);
  const status=()=>statusOf(page);
  const readDraft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
  // The draft is written a moment after an edit.
  const draftShot=async()=>{await wait(1100);for(let i=0;i<20;i++){const v=await readDraft();if(v)return v;await wait(250);}return null;};
  const stageDesk=id=>page.evaluate(id=>{const r=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.records.get(id);return r?{h:r.state.height,t:r.state.tilt}:null;},id);
  const roster=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoPresentation.roomDesks());
  const pick=async id=>{await page.evaluate(id=>{const s=document.querySelector('#director-timeline [name=choreo-desk]');s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));},id);await wait(900);};
  const lanes=()=>page.$$eval('#director-timeline .desk-lanes [data-desk-lane]',l=>l.map(e=>e.dataset.deskLane));
  const rows=()=>page.$$eval('#director-timeline [data-choreo-row]',r=>r.map(e=>({id:e.dataset.choreoRow,label:e.querySelector('b')?.textContent,clips:e.querySelectorAll('[data-choreo-clip]').length})));
  const clipCount=()=>page.$$eval('#director-timeline [data-desk-clip]',c=>c.length);
  const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(700);};
  const addClip=async(lane,at)=>{await seek(page,at);await click(`#director-timeline .track-palette [data-desk-action=add-${lane}]`);};
  const editClip=async(values)=>{
    await page.evaluate(values=>{const names=Object.keys(values);for(const n of names){const el=document.querySelector(`#director-panel [name="desk-clip-${n}"]`);if(!el)throw Error('no field '+n);el.value=String(values[n]);el.dispatchEvent(new Event('input',{bubbles:true}));}
      document.querySelector(`#director-panel [name="desk-clip-${names.at(-1)}"]`).dispatchEvent(new Event('change',{bubbles:true}));},values);await wait(800);};
  const shot=async name=>{await page.screenshot({path:path.join(shots,name+'.png')});};
  const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};

  // ---- the Desk menu
  const S=Number(await page.$eval('#director-timeline .time-ruler','e=>e.getAttribute("aria-valuemax")'));
  const r0=await roster();
  check(r0.length>=3&&r0.some(r=>r.id===A)&&r0.some(r=>r.id===B),`the room has ${r0.length} desks (${r0.map(r=>r.name).join(', ')})`);
  const hA=r0.find(r=>r.id===A).height,hB=r0.find(r=>r.id===B).height,tB=r0.find(r=>r.id===B).tilt;
  check(r0.find(r=>r.id===B).size==='48x30','the open-access desk is a 48″ desk, the others 60″');
  const options=await page.$$eval('#director-timeline [name=choreo-desk] option',o=>o.map(e=>[e.value,e.textContent.trim(),e.selected]));
  check(options.length===r0.length&&options[0][0]===''&&options[0][1]==='Featured desk'&&options[0][2],'Desk menu: Featured desk first and selected, then each room desk: '+options.map(o=>o[1]).join(' · '));
  check((await lanes()).join()==='lift,tilt,wheels','the featured desk shows Lift, Tilt and Wheels');
  const featured0=await clipCount();
  let featuredMotion=null;

  // ---- desk A: Lift 1-3 s to 50", Tilt 4-6 s to 30°
  await pick(A);
  check((await lanes()).join()==='lift,tilt','a room desk shows only Lift and Tilt lanes');
  check(!(await page.$('#director-timeline .track-palette [data-desk-kind=rotate]')),'no Turn / Travel / Hold buttons for a room desk');
  check(/Film editing 1/.test(await page.$eval('#director-panel [data-inspector-page=groove]',e=>e.textContent)),'the Groove inspector names the open desk');
  check(await clipCount()===0,'desk A starts with an empty timeline');
  await addClip('lift',1);
  let d=await draftShot();
  check(d.deskEdits?.length===1&&d.deskEdits[0].desk===A&&d.deskEdits[0].clips.length===1&&d.deskEdits[0].clips[0].lane==='lift','Add Lift writes shot.deskEdits[{desk: A, clips:[lift]}]');
  featuredMotion=JSON.stringify(d.motion||null);check(!d.motion||d.motion.clips.every(c=>c.lane!==undefined),'the featured desk\'s motion is not touched (it stays '+(d.motion?'its clips':'the film\'s built-in animation')+')');
  await editClip({start:1,duration:2,target:50});
  d=await draftShot();let la=d.deskEdits[0].clips[0];
  check(la.start===1&&la.duration===2&&la.target===50,`lift clip timed 1–3 s to 50″ (${JSON.stringify([la.start,la.duration,la.target])})`);
  await addClip('tilt',4);
  await editClip({start:4,duration:2,target:30});
  d=await draftShot();
  check(d.deskEdits[0].clips.length===2&&d.deskEdits[0].clips.some(c=>c.lane==='tilt'&&c.start===4&&c.target===30),'tilt clip 4–6 s to 30° on the same desk');
  await shot('01-desk-a-lanes');

  // ---- desk B (48″): Lift 0.5-2 s to 40″, Tilt 2-4 s to 65° (held to this desk's clearance)
  await pick(B);
  check(await clipCount()===0,'desk B has its own, empty, timeline');
  const others=await rows();
  check(others.some(r=>r.id===A&&r.clips===2),'Other desks rows list desk A\'s two moves'+(others.some(r=>r.id==='')?' (and the featured desk\'s)':'')+': '+JSON.stringify(others));
  await addClip('lift',.5);await editClip({start:.5,duration:1.5,target:40});
  await addClip('tilt',2);await editClip({start:2,duration:2,target:65});
  d=await draftShot();
  const eb=d.deskEdits.find(e=>e.desk===B);
  check(d.deskEdits.length===2&&eb.clips.length===2&&eb.size==='48x30'&&/Open access/.test(eb.name),`two desks edited; B is ${eb.size} (${eb.name})`);

  // dragging a block times it like the featured desk's
  const before=eb.clips.find(c=>c.lane==='lift').start;
  const box=await (await page.$('#director-timeline [data-desk-lane=lift] [data-desk-clip]')).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2,{steps:6});await page.mouse.up();await wait(900);
  d=await draftShot();const moved=d.deskEdits.find(e=>e.desk===B).clips.find(c=>c.lane==='lift');
  check(moved.start>before+.05&&near(moved.duration,1.5,.01),`dragging the lift block moved it ${before} → ${moved.start} s (same length)`);
  await editClip({start:.5});
  await shot('02-desk-b-with-others');

  // ---- Featured desk again: its lanes, and Other desks rows for A and B
  await pick('');
  check((await lanes()).join()==='lift,tilt,wheels'&&await clipCount()===featured0,`Featured desk: the three lanes and its own ${featured0} clips again`);
  const all=await rows();
  check(all.length===2&&all.every(r=>r.clips===2)&&all.map(r=>r.id).sort().join()===[A,B].sort().join(),'Other desks rows: '+JSON.stringify(all));
  await shot('03-featured-with-others');

  // ---- the stage at the playhead: each desk from its own start, held to its size's limits
  const h50=hA;
  await seek(page,0);
  let a=await stageDesk(A),b=await stageDesk(B);
  check(near(a.h,hA)&&near(b.h,hB),`t=0: A ${a.h.toFixed(1)}″ and B ${b.h.toFixed(1)}″ at their own starts (${hA}, ${hB})`);
  await seek(page,2);a=await stageDesk(A);b=await stageDesk(B);
  check(near(a.h,hA+(50-hA)/2,.1),`t=2: A half way up (${a.h.toFixed(2)}″, expected ${(hA+(50-hA)/2).toFixed(2)})`);
  check(near(b.h,40),`t=2: B already at 40″ (${b.h.toFixed(2)}″)`);
  await seek(page,3);a=await stageDesk(A);b=await stageDesk(B);
  check(near(a.h,50)&&near(b.h,40)&&Math.abs(a.h-b.h)>5,`t=3: two desks at different heights, A ${a.h.toFixed(1)}″ and B ${b.h.toFixed(1)}″`);
  await seek(page,4);b=await stageDesk(B);const limit=maximumTiltForHeight(40,'48x30');
  check(near(b.t,limit,.1)&&b.t<65,`t=4: B asked for 65° at 40″ and holds the 48″ desk's clearance ${limit.toFixed(1)}° (${b.t.toFixed(2)}°)`);
  await seek(page,6);a=await stageDesk(A);check(near(a.t,30),`t=6: A tilted to 30° (${a.t.toFixed(2)}°)`);
  const main=await page.evaluate(()=>{const w=document.getElementById('stage').contentWindow;const P=w.ErgoPresentation.snapshot();return P.height;});
  check(Number.isFinite(main),'the featured desk still follows its own motion ('+main.toFixed(1)+'″)');
  await seek(page,Math.max(0,S-.1));
  // playback uses the same path as scrubbing
  await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoPresentation.tick(2/Math.max(2,1)));
  await seek(page,0);a=await stageDesk(A);check(near(a.h,hA),'back at t=0: A returns to its start (scrubbing is reversible)');

  // ---- a reload keeps them (an unexported draft comes back)
  await page.reload();await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(1200);
  d=await draftShot();
  check(d.deskEdits?.length===2,'after a reload the draft still has both desks\' clips');
  await pick(A);check(await clipCount()===2,'reloaded: desk A shows its two clips');
  await seek(page,3);a=await stageDesk(A);b=await stageDesk(B);
  check(near(a.h,50)&&near(b.h,40),`reloaded stage at t=3: A ${a.h.toFixed(1)}″, B ${b.h.toFixed(1)}″`);

  // ---- Export cut carries the clips
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const exported=await until(()=>page.evaluate(()=>window.__exports.at(-1)),'export');
  const es=exported.shots[0],ea=es.deskEdits?.find(e=>e.desk===A),eb2=es.deskEdits?.find(e=>e.desk===B);
  check(es.deskEdits?.length===2&&ea?.clips.length===2&&eb2?.clips.length===2,'Export cut: shot.deskEdits has both desks, two clips each');
  check(ea.clips.find(c=>c.lane==='lift').target===50&&eb2.clips.find(c=>c.lane==='tilt').target===65,'exported targets as typed (the limit is applied at playback, not stored)');
  check(JSON.stringify(es.motion||null)===featuredMotion,'exported featured motion unchanged');

  // ---- undo is one step; clearing a desk puts it back and drops its entry
  await addClip('lift',8);
  d=await draftShot();check(d.deskEdits.find(e=>e.desk===A).clips.length===3,'a third move on desk A (a lift at 8 s)');
  await click('#director-panel [data-action=undo]');
  d=await draftShot();
  check(d.deskEdits.find(e=>e.desk===A).clips.length===2,'one Undo takes back that move');
  await click('#director-panel [data-action=redo]');
  d=await draftShot();check(d.deskEdits.find(e=>e.desk===A).clips.length===3,'Redo puts it back');
  await click('#director-panel [data-desk-action=clear]');
  d=await draftShot();
  check(!d.deskEdits?.some(e=>e.desk===A)&&d.deskEdits?.length===1,'Clear this desk\'s movements drops desk A\'s entry, B stays');
  await seek(page,3);a=await stageDesk(A);
  check(near(a.h,hA),`desk A is back at its own ${hA}″ (${a.h.toFixed(2)}″)`);
  await pick('');
  check((await lanes()).join()==='lift,tilt,wheels','Featured desk again after the edits');
  check(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
  console.log('screenshots:',shots);
}catch(error){failures.push(error.message);console.log('FAIL',error.stack);try{await page.screenshot({path:path.join(shots,'failure.png')});}catch{}}
finally{await close();}
console.log(failures.length?`\nDirector desk choreo e2e: ${failures.length} failure(s).`:'\nDirector desk choreo e2e: all checks passed.');
process.exit(failures.length?1:0);
