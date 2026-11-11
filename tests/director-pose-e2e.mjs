// Director pose mode end to end (real GPU Chrome): double-click a person, their skeleton comes in without changing
// how they look, a joint turns from the fields, a hand dragged with the gizmo bends the arm (two-bone IK), fingers,
// mirror, reset, undo; the cut keeps cast[i].pose, the live stage follows, and Export cut -> import puts it in the film.
// Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-pose-e2e.mjs      SHOTS=<dir> keeps screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,chapterList,status,wait,seek,root,HQ} from './director-e2e-harness.mjs';
import {peopleFilter,cleanPose} from '../experience/people-edits.mjs';

const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-pose-shots-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-pose-e2e-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
await (await page.createCDPSession()).send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(200);}};
const snap=name=>page.screenshot({path:path.join(shots,name+'.png')});
const edits=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].peopleEdits||null;}catch{return null;}});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const setField=(name,value)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
// The stage's person under a key: bounds (room mm), whether skinned, a bone's world position and turn from rest.
const person=(key,bone)=>page.evaluate((key,bone)=>{
  const w=document.getElementById('stage').contentWindow,o=w.ErgoFlex.workspaceRoom.people.byKey(key);if(!o)return null;
  const T=w.__directorThree?.THREE;if(!T)return {rigged:!!o.userData.personRig};
  o.updateWorldMatrix(true,true);const box=new T.Box3();o.traverse(m=>{if(!m.isMesh)return;if(m.isSkinnedMesh){m.skeleton.update();m.computeBoundingBox();box.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld));}else{m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}});
  const rig=o.userData.personRig,b=bone&&rig?.bones.get(bone),out={rigged:!!rig,visible:o.visible,min:box.min.toArray(),max:box.max.toArray(),bones:rig?rig.bones.size:0};
  if(b){out.at=b.getWorldPosition(new T.Vector3()).toArray();const d=rig.rest.get(bone).clone().invert().multiply(b.quaternion);out.turn=2*Math.acos(Math.min(1,Math.abs(d.w)))*180/Math.PI;}
  return out;},key,bone);
const near=(a,b,eps)=>a.every((v,i)=>Math.abs(v-b[i])<=eps);
try{
  const chapter=chapterList().find(c=>c.id==='rise');
  await openChapter(page,base,chapter);
  await click('#director-panel [data-inspector-tab="people"]');
  if(await page.$('#director-panel [data-action="pe-room"]'))await click('#director-panel [data-action="pe-room"]');
  await until(async()=>(await page.$$('#director-panel .people-row')).length>=2,'the room\'s people are listed');
  await seek(page,8.5);     // Maya stands at the raised desk
  const spot=await until(()=>page.evaluate(()=>{
    const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three();
    const o=w.ErgoFlex.workspaceRoom.people.list().find(p=>p.visible&&p.desk),obj=o&&w.ErgoFlex.workspaceRoom.people.byKey(o.key);if(!obj||!w.__directorThree)return null;
    const c=obj.getWorldPosition(new obj.position.constructor());c.y+=1.2;c.project(t.camera);const r=f.getBoundingClientRect();
    return Math.abs(c.x)<.9&&Math.abs(c.y)<.9?{x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height,key:o.key}:null;}),'a person in the view');
  const key=spot.key,before=await person(key);
  check(before&&before.rigged,'the person at the desk is drawn with their skeleton before pose mode too (they move with the desk)');
  await snap('01-before');
  // ---- double-click: pose mode, the skeleton comes in and nothing moves
  await page.mouse.click(spot.x,spot.y,{clickCount:2,delay:40});
  await until(()=>page.$('#director-panel .people-pose'),'the double-click opens pose mode');
  const rigged=await until(async()=>{const p=await person(key);return p?.rigged&&p.visible?p:null;},'the skeleton is in');
  check(rigged.bones>=50,'double-click on a person opens pose mode with their skeleton ('+rigged.bones+' bones)');
  // (a frame or two after the swap: the skinned bounds follow the skeleton's first update)
  const same=await until(async()=>{const p=await person(key);return p?.rigged&&near(p.min,before.min,.004)&&near(p.max,before.max,.004)?p:null;},'with the skeleton in, the person fills the same space as before ('+JSON.stringify(before.min.map(v=>+v.toFixed(3)))+')',8000);
  check(same,'with the skeleton in, the person fills the same space: '+JSON.stringify([before.min.map(v=>+v.toFixed(3)),same.min.map(v=>+v.toFixed(3))]));
  check(!(await edits())?.cast.some(e=>e.pose),'entering pose mode changes nothing in the cut');
  await wait(400);await snap('02-pose-mode');
  // ---- a joint from the fields
  await setField('pe-joint','lowerarm_l');
  await until(()=>page.$('#director-panel [name="pe-rx"]'),'the joint\'s angle fields');
  await setField('pe-rx',24);
  const e1=await until(async()=>{const e=await edits();const p=e?.cast.find(c=>c.key===key)?.pose;return p?.lowerarm_l?p:null;},'the elbow\'s turn is in the cut');
  check(Object.keys(e1).length===1&&JSON.stringify(cleanPose(e1))===JSON.stringify(e1),'a joint turned from the fields is kept in the cut: '+JSON.stringify(e1));
  const elbow=await until(async()=>{const p=await person(key,'lowerarm_l');return p?.turn>23&&p.turn<25?p:null;},'the stage shows the elbow turned');
  check(elbow,'the live stage turns the elbow by '+elbow.turn.toFixed(1)+'°');
  // ---- a click on a dot selects that joint; dragging a hand bends the arm
  const dot=await page.evaluate(()=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),g=t.scene.children.find(c=>c.name==='Director pose tools'),m=g?.children.find(c=>c.userData.joint==='hand_r');if(!m)return null;
    const p=m.getWorldPosition(new m.position.constructor()).project(t.camera),r=f.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};});
  check(dot,'the joints have dots in the view');
  await page.mouse.click(dot.x,dot.y);
  await until(async()=>(await page.$eval('#director-panel [name="pe-joint"]',e=>e.value))==='hand_r','a click on the hand\'s dot selects it');
  passed.push('a click on a dot selects that joint');
  check(await page.$eval('#director-panel [data-action="pe-pose-move"]',e=>e.getAttribute('aria-pressed')==='true'),'a hand starts in Move limb');
  await wait(500);
  const hand0=await person(key,'hand_r');
  const grab=await page.evaluate(()=>{const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three(),T=w.__directorThree.THREE;
    const gz=t.scene.children.filter(c=>c.isTransformControls).find(c=>c.visible&&c.mode==='translate'&&c.object&&!c.object.userData.person);if(!gz)return null;
    const pick=gz._gizmo.picker.translate.children.find(c=>c.name==='Y'&&c.isMesh);if(!pick)return null;
    gz.updateMatrixWorld(true);pick.geometry.computeBoundingBox();const o=gz.object.getWorldPosition(new T.Vector3()),s=pick.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(pick.matrixWorld);
    const r=f.getBoundingClientRect(),px=v=>{const p=v.clone().project(t.camera);return [r.left+(p.x+1)/2*r.width,r.top+(1-p.y)/2*r.height];};return {from:px(s),origin:px(o)};});
  check(grab,'the move gizmo is on the hand');
  const dir=[grab.from[0]-grab.origin[0],grab.from[1]-grab.origin[1]],len=Math.hypot(...dir)||1;
  await page.mouse.move(grab.from[0],grab.from[1]);await wait(120);await page.mouse.down();
  for(let i=1;i<=8;i++){await page.mouse.move(grab.from[0]+dir[0]/len*i*9,grab.from[1]+dir[1]/len*i*9);await wait(30);}
  await page.mouse.up();
  const e2=await until(async()=>{const p=(await edits())?.cast.find(c=>c.key===key)?.pose;return p?.upperarm_r&&p.lowerarm_r?p:null;},'the dragged hand bends the arm in the cut');
  const hand1=await person(key,'hand_r'),moved=Math.hypot(...hand1.at.map((v,i)=>v-hand0.at[i]));
  check(moved>.05,'dragging the hand moves it ('+moved.toFixed(2)+' stage units) and the shoulder and elbow follow: '+Object.keys(e2).join(', '));
  await snap('03-hand-dragged');
  // ---- fingers, mirror, reset joint, undo
  await setField('pe-grip-r',100);
  await until(async()=>(await edits())?.cast.find(c=>c.key===key)?.pose?.index_02_r,'the right hand closes');
  const fist=await until(async()=>{const v=Number(await page.$eval('#director-panel [name="pe-grip-r"]',e=>e.value));return v>=85?v:null;},'the slider stands at the fist');
  const curl=await person(key,'index_02_r');
  check(curl.turn>55,'the fingers slider closes the hand to a fist (index middle joint turned '+curl.turn.toFixed(0)+'°, slider at '+fist+')');
  fs.writeFileSync(path.join(shots,'fist-pose.json'),JSON.stringify((await edits()).cast.find(c=>c.key===key).pose));
  await setField('pe-grip-r',0);
  await until(async()=>!(await edits())?.cast.find(c=>c.key===key)?.pose?.index_02_r,'the slider at 0 is the hand as built');
  passed.push('the slider back at 0 is the hand as built');
  await setField('pe-joint','lowerarm_l');await until(()=>page.$('#director-panel [data-action="pe-pose-mirror"]'),'mirror button');
  await click('#director-panel [data-action="pe-pose-mirror"]');
  const e3=await until(async()=>{const p=(await edits())?.cast.find(c=>c.key===key)?.pose;return p&&Math.abs(p.lowerarm_r[0]-p.lowerarm_l[0])<1e-3&&Math.abs(p.lowerarm_r[1]+p.lowerarm_l[1])<1e-3?p:null;},'the left arm\'s adjustment is mirrored to the right');
  check(e3,'Copy to the other side mirrors the arm');
  await click('#director-panel [data-action="pe-pose-reset-joint"]');
  await until(async()=>!(await edits())?.cast.find(c=>c.key===key)?.pose?.lowerarm_l,'Reset joint takes the elbow back');
  passed.push('Reset joint takes one joint back to the posture as built');
  await click('[data-action="undo"]');
  await until(async()=>(await edits())?.cast.find(c=>c.key===key)?.pose?.lowerarm_l,'undo brings the elbow back');
  await until(async()=>{const p=await person(key,'lowerarm_l');return p?.turn>23;},'the stage follows the undo');
  passed.push('undo steps back one adjustment, on the stage too');
  // ---- save the pose under a name: a second save of the same name does not replace the first
  const saved=()=>page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('ergoflex.peoplePoses.v1')).poses;}catch{return [];}});
  const saveAs=async name=>{await page.evaluate(n=>{document.querySelector('#director-panel [name="pe-pose-name"]').value=n;},name);await click('#director-panel [data-action="pe-pose-save"]');};
  await saveAs('Leaning in');await until(async()=>(await saved()).length===1,'the pose is saved');
  await setField('pe-joint','head');await setField('pe-ry',18);
  await until(async()=>(await edits())?.cast.find(c=>c.key===key)?.pose?.head,'the head is turned');
  await saveAs('Leaning in');
  const two=await until(async()=>{const l=await saved();return l.length===2?l:null;},'a second pose is saved');
  check(two[0].name==='Leaning in'&&two[1].name==='Leaning in 2'&&!two[0].joints.head&&two[1].joints.head&&/^stand-/.test(two[0].posture),'Save pose keeps each pose under its own name and never replaces one: '+two.map(p=>p.name).join(', '));
  // ---- Done keeps the pose; the model stays as posed
  await click('#director-panel [data-action="pe-pose-done"]');
  await until(async()=>!(await page.$('#director-panel .people-pose')),'Done leaves pose mode');
  check(await page.$eval('#director-panel .people-tuned',e=>/joints adjusted/.test(e.textContent)),'the People tab says the pose is adjusted');
  // ---- a saved pose is a starting point: applied from the People tab it puts the joints back as saved
  await page.evaluate(()=>[...document.querySelectorAll('#director-panel [data-action="pe-pose-apply"]')].find(b=>b.textContent==='Leaning in').click());
  await until(async()=>{const p=(await edits())?.cast.find(c=>c.key===key)?.pose;return p&&!p.head&&p.lowerarm_l?p:null;},'the first saved pose is applied');
  passed.push('a saved pose is applied from the People tab as a starting point');
  await page.evaluate(()=>[...document.querySelectorAll('#director-panel .pose-saved-item')].find(b=>/Leaning in 2/.test(b.textContent)).querySelector('.pose-saved-x').click());
  await until(async()=>(await saved()).length===1,'a saved pose can be deleted');
  check((await edits()).cast.find(c=>c.key===key).pose.lowerarm_l,'deleting a saved pose leaves the people who have it alone');
  await wait(300);await snap('04-done');
  // ---- Export cut -> import -> the film chapter's people carry the pose
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const mine=await edits();
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='rise')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const ex=path.join(tmp,'Film-chapter-rise-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='rise');
  check(JSON.stringify(built.people)===JSON.stringify(peopleFilter(mine))&&built.people.cast.find(c=>c.key===key).pose.lowerarm_l,'the film chapter\'s people carry the pose');
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log('PASS Director pose mode: '+passed.join('; ')+'.');console.log('screenshots: '+shots);
}catch(error){await snap('fail').catch(()=>{});console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));console.error('screenshots: '+shots);process.exitCode=1;}
finally{await close();}
