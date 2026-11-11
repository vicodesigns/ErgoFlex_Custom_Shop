// Director, people at the room's other desks (real GPU Chrome): someone working at a room desk follows that desk. Raise
// the desk in the Desks tab and they stand, lower it and they sit, move it and they move with it; choosing the standing
// posture for them while their desk is down no longer makes them vanish.
//   flock /tmp/claude-1000/hq12-stills.lock node tests/director-people-desk-follow-e2e.mjs      (SHOTS=dir keeps screenshots)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director people desk-follow e2e: skipped (${HQ} has no oilers chapter page in this checkout).`);process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-follow-e2e-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const DESK='station-window-research';
try{
  await openChapter(page,base,chapter);
  const until=async(fn,what,ms=40000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(200);}};
  const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
  const setField=(name,value)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
  // Mia as the stage has her now: the model that is showing, where she is, and her desk
  const mia=()=>page.evaluate(D=>{const w=document.getElementById('stage').contentWindow,E=w.ErgoFlex,p=E.workspaceRoom?.people,r=E.sceneDesks?.records.get(D);if(!p||!r?.group)return null;
    const all=p.people.filter(o=>/people-mia-/.test(o.userData.person.id)&&o.userData.person.station==='window-research'&&p.allowed(o.userData.person)),o=all.find(x=>x.visible);
    return {models:all.length,chosen:all.find(x=>!x.userData.person.variant)?.userData.person.id||null,showing:o?o.userData.person.id:null,at:o?[Math.round(o.position.x),Math.round(o.position.z)]:null,desk:{x:Math.round(r.group.position.x),z:Math.round(r.group.position.z),height:r.state.height}};},DESK);
  const frame=()=>page.evaluate(D=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three(),r=w.ErgoFlex.sceneDesks.records.get(D),T=w.__directorThree.THREE,b=new T.Box3().setFromObject(r.group),c=b.getCenter(new T.Vector3());const look=c.clone().add(new T.Vector3(.7,.2,0));t.camera.position.set(c.x+3.4,c.y+1.3,c.z+2.2);t.controls.target.copy(look);t.camera.lookAt(look);t.controls.update();},DESK);   // from inside the room, past her shoulder (room z is world x)
  await click('#director-panel [data-inspector-tab="people"]');
  if(await page.$('#director-panel [data-action="pe-room"]'))await click('#director-panel [data-action="pe-room"]');
  await until(async()=>(await page.$$eval('#director-panel .people-row strong',l=>l.map(e=>e.textContent))).includes('Mia'),'Mia is in the chapter\'s cast');
  const m0=await until(async()=>{const m=await mia();return m?.showing?m:null;},'Mia shows at her desk');
  check(m0.showing==='people-mia-sit-type'&&m0.desk.height===28,`Mia sits at the Coastal research nook while it is at ${m0.desk.height} in`);
  check(Math.abs(Math.hypot(m0.at[0]-m0.desk.x,m0.at[1]-m0.desk.z)-945)<6,'945 mm in front of that desk: '+JSON.stringify(m0));

  // ---- the standing posture while her desk is down: she stays (she used to vanish)
  const idx=await page.$$eval('#director-panel .people-row',l=>l.findIndex(r=>r.querySelector('strong')?.textContent==='Mia'));
  await click(`#director-panel .people-row:nth-child(${idx+1}) .people-pick`);
  await until(()=>page.$('#director-panel [name="pe-pose"]'),'Mia\'s posture menu');
  await setField('pe-pose','stand-type');
  const m1=await until(async()=>{const m=await mia();return m&&m.models>=3&&m.chosen==='people-mia-stand-type'&&m.showing?m:null;},'the stage has the standing posture as her chosen one and she is still there');
  check(m1.showing==='people-mia-sit-type','with the standing posture chosen and the desk at 28 in she is there, seated: '+m1.showing);
  check(!/Not showing now/.test(await page.$eval('#director-panel [data-scene-people]',e=>e.textContent)),'the panel does not say she is not showing');

  // ---- raise her desk in the Desks tab: she stands; move it: she moves with it; lower it: she sits
  await click('#director-panel [data-inspector-tab="desks"]');await wait(500);
  await click(`#director-panel .desk-row[data-section="${DESK}"]`);
  await until(()=>page.$('#director-panel [data-action="dk-preset"][data-section="standing"]'),'the desk\'s panel');
  await click('#director-panel [data-action="dk-preset"][data-section="standing"]');
  const m2=await until(async()=>{const m=await mia();return m&&m.desk.height===43.5&&m.showing==='people-mia-stand-type'?m:null;},'Mia stands when her desk is at standing height');
  check(true,'the desk goes to 43.5 in and Mia stands at it');
  await click('#director-panel [data-action="dk-nudge"][data-section="x:12"]');
  const m3=await until(async()=>{const m=await mia();return m&&Math.abs(m.desk.x-m2.desk.x-304.8)<2&&m.at&&Math.abs(m.at[0]-m2.at[0]-305)<3?m:null;},'Mia moves with the desk');
  check(true,`the desk moves 12 in along X and she moves with it: x ${m2.at[0]} -> ${m3.at[0]} mm`);
  await frame();await wait(900);await page.screenshot({path:path.join(shots,'follow-standing.png')});
  await click('#director-panel [data-action="dk-preset"][data-section="sitting"]');
  const m4=await until(async()=>{const m=await mia();return m&&m.desk.height===28&&Math.abs(m.desk.x-m3.desk.x)<2&&m.showing==='people-mia-sit-type'?m:null;},'Mia sits when her desk is back at sitting height');   // (the stage puts the desk back as the film has it for a moment before it applies the edit again)
  check(Math.abs(m4.at[0]-m3.at[0])<3&&Math.abs(m4.at[0]-m4.desk.x)<3,'lowered again, she sits at the desk where it now stands: '+JSON.stringify(m4));
  await frame();await wait(900);await page.screenshot({path:path.join(shots,'follow-seated.png')});
}catch(e){failures.push(e.message);console.log('FAIL',e.message);}
finally{if(errors.length){failures.push('page errors');console.log('page errors:',errors.slice(0,5));}await close();}
console.log(failures.length?`\n${failures.length} failed`:'\nall passed','· screenshots in',shots);process.exit(failures.length?1:0);
