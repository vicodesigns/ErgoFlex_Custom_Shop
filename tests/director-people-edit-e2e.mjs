// S31 check (real Chrome, the harness's own scratch server): People-tab edits on the Cinematographer's cut lose nothing.
// 1. oilers: Noah (noah-steps) selected while he walks, moved 100 mm with the gizmo, Export cut, import + pass on a
//    scratch copy: review-cut.json differs ONLY in that entry's `at` (+ directorEdited {fields: ['people']}); the walk,
//    every other entry, except / when / chair are identical; scrubbing still shows Kai rolling and Noah walking.
// 2. The same chapter, fresh: a joint of someone standing still (noah-talks) turned in pose mode (auto-key off):
//    only that entry gets `pose`.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-people-edit-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',H0=path.join(root,CUT),shots=process.argv[2]||null;
const c=JSON.parse(fs.readFileSync(path.join(H0,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='oilers');
const src=fs.readFileSync(path.join(H0,'review-cut.json')),cut=JSON.parse(src),film=cut.shots.find(s=>s.id==='oilers');
const py=(...a)=>execFileSync('python3',a,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-people-edit-'));
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
function importExport(text,tag){
  const H=path.join(tmp,tag);fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
  const ex=path.join(tmp,`Film-chapter-oilers-${tag}.json`);fs.writeFileSync(ex,text);
  py(path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex);py(path.join(root,'tools/experience/build-round8-director.py'),H);
  return JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8'));
}
function onlyPeopleChanged(after,tag){
  for(const s of cut.shots){const a=after.shots.find(x=>x.id===s.id);if(s.id!=='oilers'){assert.deepEqual(a,s,`${tag}: ${s.id} unchanged`);continue;}
    const keys=[...new Set([...Object.keys(a),...Object.keys(s)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(s[k]));
    assert.deepEqual(keys.sort(),['directorEdited','people'],`${tag}: oilers changed only in people (+ marker): ${keys}`);
    assert.deepEqual(a.directorEdited.fields,['people']);}
  const p=after.shots.find(x=>x.id==='oilers').people,f=film.people;
  for(const k of new Set([...Object.keys(p),...Object.keys(f)]))if(k!=='cast')assert.deepEqual(p[k],f[k],`${tag}: people.${k} unchanged`);
  assert.equal(p.cast.length,f.cast.length);
  return p.cast.flatMap((e,i)=>JSON.stringify(e)===JSON.stringify(f.cast[i])?[]:[[f.cast[i],e]]);
}
const exportText=page=>page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="save-export"]').click();}));
const where=page=>page.evaluate(()=>Object.fromEntries((document.getElementById('stage').contentWindow.ErgoFlex?.workspaceRoom?.people?.list?.()||[]).filter(p=>p.visible).map(p=>[p.key,p.at])));
async function selectRow(page,key){
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await until(()=>page.$('[data-action="pe-row"]'),'the People list');
  const i=film.people.cast.findIndex(e=>e.key===key);await page.$eval(`[data-action="pe-row"][data-index="${i}"]`,e=>e.click());await wait(800);
}
let run=null;
try{
  // ---- 1. move the walker
  run=await openDirectorBrowser();let {base,page,errors}=run;
  await openChapter(page,base,c);
  await seek(page,4.6);await selectRow(page,'noah-steps');
  await until(()=>page.evaluate(()=>!!document.getElementById('stage').contentWindow.__directorPeopleGizmo?.object),'the gizmo on Noah');
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'s31-check-1-noah-selected.png')});}
  await page.evaluate(()=>{const g=document.getElementById('stage').contentWindow.__directorPeopleGizmo;g.dispatchEvent({type:'dragging-changed',value:true});g.object.position.x+=100;g.dispatchEvent({type:'objectChange'});g.dispatchEvent({type:'dragging-changed',value:false});});
  await wait(1500);
  const a=(await seek(page,1),await wait(1500),await where(page)),b=(await seek(page,4.8),await wait(1500),await where(page)),d=(await seek(page,6.5),await wait(1500),await where(page));
  assert.ok(a['kai-rolls']&&b['kai-rolls']&&Math.hypot(a['kai-rolls'][0]-b['kai-rolls'][0],a['kai-rolls'][1]-b['kai-rolls'][1])>300,'Kai still rolls');
  assert.ok(b['noah-steps'],'Noah walking at 4.8 s');
  const text=await exportText(page);
  const changed=onlyPeopleChanged(importExport(text,'move'),'move');
  assert.equal(changed.length,1,'one cast entry changed: '+JSON.stringify(changed.map(x=>x[1].key)));
  const [was,now]=changed[0];assert.equal(now.key,'noah-steps');
  const {at:at0,...r0}=was,{at:at1,...r1}=now;assert.deepEqual(r1,r0,'noah-steps: everything but at as it was (walk kept)');
  assert.deepEqual([at1[0]-at0[0],at1[1]-at0[1]],[100,0],'moved 100 mm along x');
  console.log(`1. noah-steps moved: at ${JSON.stringify(at0)} -> ${JSON.stringify(at1)}; walk, the other ${film.people.cast.length-1} entries, except/when/chair identical; Kai rolls, Noah walks (${JSON.stringify(b['noah-steps'])} at 4.8 s)`);
  assert.deepEqual(errors,[],'page errors');
  await run.close();run=null;
  // ---- 2. pose a standing person, fresh browser
  run=await openDirectorBrowser();({base,page,errors}=run);
  await openChapter(page,base,c);
  await seek(page,1);await selectRow(page,'noah-talks');
  await page.$eval('[data-action="pe-pose-enter"]',e=>e.click());
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)).catch(()=>false),'the skeleton',180000);
  const auto=await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'));assert.equal(auto,'false','auto-key starts off');
  const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
  await set('pe-joint','lowerarm_l');await wait(300);await set('pe-rx',30);await wait(800);
  if(shots)await page.screenshot({path:path.join(shots,'s31-check-2-pose.png')});
  const changed2=onlyPeopleChanged(importExport(await exportText(page),'pose'),'pose');
  assert.equal(changed2.length,1,'one cast entry changed: '+JSON.stringify(changed2.map(x=>x[1].key)));
  const [w2,n2]=changed2[0];assert.equal(n2.key,'noah-talks');const {postures,...rest}=n2,pose=postures[n2.id].pose;assert.deepEqual(rest,w2,'noah-talks: only posture store added');assert.ok(pose.lowerarm_l,'the elbow turned');
  console.log(`2. noah-talks posed: only pose added (${Object.keys(pose).join(', ')})`);
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS director people edit: gizmo move of a walker and a pose on a standing person change only that entry');
}finally{if(run)await run.close();fs.rmSync(tmp,{recursive:true,force:true});}
