// S33 (A2) People keyframe sheet (real Chrome, the harness's own scratch server) on the Cinematographer's cut.
//   oilers  M-a: a row per character (collapsed: small diamonds at every key time + the on-screen bar); twirled open:
//           On screen / Path / Actions / Pose with the keys people-track.mjs sheet() derives; the big diamonds and the
//           Pose keys row are gone.
//           M-b: click selects, Shift+click adds, a marquee on empty row space selects; the Inspector shows the key;
//           J / K and ◀ ▶ jump the playhead; Esc clears.
//           M-c: drag moves (Alt: free), several keys move together (an action's bar keeps its length), the Inspector's
//           Time, ◆ adds a waypoint at the playhead and Delete takes it out; each one undo step; Export: only what moved.
//   media   (Omar, pose keys written in pose mode with auto-key) M-c: copy / paste at the playhead, Delete, undo; joint
//           rows; Inspector Bend; M-d: shapes = interpolation, right-click menu, Inspector Interpolation; time keys:
//           menu disabled with the reason.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-people-sheet-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
import {sheet,turnAngles} from '../experience/people-track.mjs';
const CUT='exports/cinematic-intro-cut-cine',shots=process.argv[2]||null;
const chapter=id=>JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id===id);
const filmShot=id=>JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id===id);
const {base,page,errors,close}=await openDirectorBrowser();
const shoot=async(name,row)=>{if(!shots)return;fs.mkdirSync(shots,{recursive:true});if(row)await page.evaluate(r=>{const e=document.querySelector(`[data-ps-row="${r}"]`),v=e?.closest('.timeline-viewport');if(e&&v)v.scrollTop+=e.getBoundingClientRect().top-v.getBoundingClientRect().top-30;},row);await wait(300);await page.screenshot({path:path.join(shots,name)});};
const twirl=async id=>{await page.$eval(`[data-ps-twirl="${id}"]`,e=>e.click());await wait(300);};
let omarModel=null;
const modernId=id=>omarModel?id.replace(/^pose\|omar\|/,'pose|omar|'+omarModel+'|'):id;
const legacyId=id=>id.replace(/^pose\|omar\|people-[^|]+\|/,'pose|omar|');
const rowKeys=async(row,prop)=>[...new Set((await page.$$eval(`[data-ps-of="${row}"][data-ps-prop="${prop}"] [data-sk]`,l=>l.map(e=>e.dataset.sk))).map(legacyId))];
const selected=async()=>[...new Set((await page.$$eval('.ps-row .sk.selected',l=>l.map(e=>e.dataset.sk))).map(legacyId))].sort();
const playhead=()=>page.$eval('#director-timeline [name="timeline-seconds"]',e=>Number(e.value));
const inspector=()=>page.$eval('[data-ps-inspector]',e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'');
const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
const keyTime=async id=>Number((await page.$eval(`[data-sk="${id}"]`,e=>e.getAttribute('aria-label'))).match(/at ([\d.]+) s/)[1]);
async function at(id){id=modernId(id);await page.$eval(`[data-sk="${id}"]`,e=>e.scrollIntoView({block:'center'}));await wait(150);return page.$eval(`[data-sk="${id}"]`,e=>{const r=e.getBoundingClientRect(),l=e.parentElement.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,left:l.x,width:l.width};});}
async function click(id,{shift=false,button='left'}={}){const p=await at(id);if(shift)await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y,{button});if(shift)await page.keyboard.up('Shift');await wait(400);}
async function drag(id,seconds,T,{alt=true}={}){
  const p=await at(id),x=p.left+p.width*seconds/T;if(alt)await page.keyboard.down('Alt');
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+6,p.y,{steps:2});await page.mouse.move(x,p.y,{steps:8});await page.mouse.up();if(alt)await page.keyboard.up('Alt');await wait(700);
}
const key=async combo=>{const [m,k]=combo.includes('+')?combo.split('+'):[null,combo];if(m)await page.keyboard.down(m);await page.keyboard.press(k);if(m)await page.keyboard.up(m);await wait(600);};
const exportCut=()=>page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
try{
  await page.evaluateOnNewDocument(()=>localStorage.removeItem('ergoflex.director.peopleSheet'));
  // ======== oilers
  const c=chapter('oilers'),film=filmShot('oilers'),T=film.seconds;
  await openChapter(page,base,c);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await wait(1200);
  const want=sheet(film.people,T);
  // ---- M-a: rows, summary, twirl-down, keys
  assert.deepEqual(await page.$$eval('.ps-char .desk-lane-label b',l=>l.map(e=>e.textContent)),want.map(r=>r.label),'a row per character');
  assert.equal(await page.$$eval('[data-pt-index],[data-pose-keys-lane]',l=>l.length),0,'the big diamonds and the Pose keys row are gone');
  for(const r of want)assert.equal(await page.$$eval(`[data-ps-row="${r.row}"] .ps-dot`,l=>l.length),r.summary.length,`${r.label}: a summary diamond per key time`);
  assert.equal(await page.$$eval('[data-ps-row="kai"] .ps-onscreen',l=>l.length),2,'Kai: two placements on screen');
  await twirl('kai');await twirl('noah');
  for(const r of want.filter(r=>r.row==='kai'||r.row==='noah'))for(const prop of ['screen','path','actions','pose'])
    assert.deepEqual(await rowKeys(r.row,prop),r.props[prop].map(k=>k.id),`${r.label} ${prop}`);
  assert.equal(await page.$$eval('[data-ps-of="kai"][data-ps-prop="screen"] .ps-place',l=>l.length),2,'a bar per placement');
  await shoot('s33-ma-sheet.png','kai');
  await twirl('kai');assert.equal(await page.$$eval('[data-ps-of="kai"]',l=>l.length),0,'folded again');
  console.log('M-a ok');
  // ---- M-b: click, Shift+click, marquee, Inspector, J / K, ◀ ▶, Esc
  const TAP='act|noah-taps|0',PULL='act|noah-pulls|0',PULLEND='act-end|noah-pulls|0';
  await click(TAP);assert.deepEqual(await selected(),[TAP],'click selects');
  let ins=await inspector();assert.ok(/KEY · ACTIONS/.test(ins)&&/Noah/.test(ins)&&/action/.test(ins),'Inspector: '+ins);
  assert.equal(await page.$eval('#director-panel [name="pe-sk-t"]',e=>Number(e.value)),8.2,'Inspector Time');
  assert.ok(await page.$eval('#director-panel [name="pe-sk-ease"]',e=>e.disabled),'no interpolation for a time key');
  await click(PULL,{shift:true});assert.deepEqual(await selected(),[PULL,TAP].sort(),'Shift+click adds');
  assert.ok(/2 keys selected/.test(await inspector()));
  await click(PULL,{shift:true});assert.deepEqual(await selected(),[TAP],'Shift+click on a selected key takes it out');
  // marquee over Noah's Actions row from 5 s to 7 s: the pull and its end
  {await page.$eval('[data-ps-of="noah"][data-ps-prop="actions"]',e=>e.scrollIntoView({block:'center'}));await wait(300);
   const lane=await page.$eval('[data-ps-of="noah"][data-ps-prop="actions"] .ps-lane',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
   const y=lane.y+lane.h/2,x0=lane.x+lane.w*5/T,x1=lane.x+lane.w*7/T;
   await page.mouse.move(x0,y-8);await page.mouse.down();await page.mouse.move(x0+20,y,{steps:3});await page.mouse.move(x1,y+8,{steps:6});await page.mouse.up();await wait(500);}
  assert.deepEqual(await selected(),[PULLEND,PULL].sort(),'marquee selects the keys inside it');
  await shoot('s33-mb-marquee.png','noah');
  await page.keyboard.press('Escape');await wait(400);assert.deepEqual(await selected(),[],'Esc clears');
  await seek(page,0);await page.$eval('[data-ps-of="noah"][data-ps-prop="actions"] [data-ps-nav="1"]',e=>e.click());await wait(500);
  assert.ok(Math.abs(await playhead()-5.4)<.02,'▶ goes to the next key of the row');assert.deepEqual(await selected(),[PULL]);
  await page.$eval('[data-ps-of="noah"][data-ps-prop="actions"] [data-ps-nav="1"]',e=>e.click());await wait(500);assert.ok(Math.abs(await playhead()-6.5)<.02);
  await page.$eval('[data-ps-of="noah"][data-ps-prop="actions"] [data-ps-nav="-1"]',e=>e.click());await wait(500);assert.ok(Math.abs(await playhead()-5.4)<.02,'◀');
  await page.$eval('[data-action="pe-sk-next"]',e=>e.click());await wait(500);assert.ok(Math.abs(await playhead()-6.5)<.02,'Inspector Next');assert.deepEqual(await selected(),[PULLEND]);
  const times=[...new Set(['kai','noah'].length&&[...(await page.$$eval('.ps-row [data-sk]',l=>l.map(e=>Number(e.getAttribute('aria-label').match(/at ([\d.]+) s/)[1]))))])].sort((a,b)=>a-b);
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());
  await page.keyboard.press('k');await wait(500);const k1=await playhead();assert.ok(Math.abs(k1-times.find(t=>t>6.5+1e-3))<.02,`K: next key of the sheet (${k1})`);
  await page.keyboard.press('j');await wait(500);assert.ok(Math.abs(await playhead()-6.5)<.02,'J: previous key');
  console.log('M-b ok');
  // ---- M-c: drag (Alt: free), multi-drag, Inspector Time, ◆ waypoint + Delete, undo
  await page.keyboard.press('Escape');await wait(300);
  await drag(TAP,8.6,T);assert.ok(Math.abs(await keyTime(TAP)-8.6)<.03,'dragged to 8.6: '+await keyTime(TAP));
  await key('Control+z');assert.equal(await keyTime(TAP),8.2,'one undo step');await key('Control+y');assert.ok(Math.abs(await keyTime(TAP)-8.6)<.03,'redo');
  // the screen pull: both keys selected, drag the pull 0.5 s earlier: the end comes along (length kept)
  await click(PULL);await click(PULLEND,{shift:true});await drag(PULL,4.9,T);
  assert.ok(Math.abs(await keyTime(PULL)-4.9)<.03&&Math.abs(await keyTime(PULLEND)-6)<.03,`both moved: ${await keyTime(PULL)} ${await keyTime(PULLEND)}`);
  await key('Control+z');assert.deepEqual([await keyTime(PULL),await keyTime(PULLEND)],[5.4,6.5],'one undo step for the multi move');
  // snapped (no Alt): the timeline's Snap step
  const step=Number(await page.$eval('[name="timeline-snap"]',e=>e.value));
  if(step>0){await drag(TAP,9.03,T,{alt:false});const t=await keyTime(TAP);assert.ok(Math.abs(t/step-Math.round(t/step))<1e-3||Math.abs(t-await playhead())<1e-3,`snapped to ${step}: ${t}`);await key('Control+z');}
  // Inspector Time
  await click(TAP);await set('pe-sk-t',8.8);await wait(600);assert.equal(await keyTime(TAP),8.8,'Inspector Time');await key('Control+z');assert.ok(Math.abs(await keyTime(TAP)-8.6)<.03);
  // ◆ on Noah's Path at mid-walk: a waypoint; selected; Delete takes it out; undo brings it back; undo again: none
  const walk=want.find(r=>r.row==='noah').props.path,mid=Math.round((walk[0].t+walk.at(-1).t)/2*100)/100;
  await seek(page,mid);await page.$eval('[data-ps-of="noah"][data-ps-prop="path"] [data-ps-nav="0"]',e=>e.click());await wait(700);
  assert.equal((await rowKeys('noah','path')).length,walk.length+1,'◆ added a waypoint');
  assert.deepEqual(await selected(),['walk-point|noah-steps|1']);
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await key('Delete');assert.equal((await rowKeys('noah','path')).length,walk.length,'Delete took it out');
  await key('Control+z');assert.equal((await rowKeys('noah','path')).length,walk.length+1,'undo brings it back');
  await key('Control+z');assert.equal((await rowKeys('noah','path')).length,walk.length,'undo the add');
  // Delete on a time key: kept, with the reason
  await click(TAP);await key('Delete');assert.ok(await page.$(`[data-sk="${TAP}"]`),'a time key is not deleted');assert.ok(/drag/.test(await status(page)),'says why');
  // right-click a time key: the menu's interpolations are disabled with the reason (M-d)
  await click(TAP,{button:'right'});assert.ok(await page.$eval('.ps-menu',m=>!m.hidden&&[...m.querySelectorAll('button')].every(b=>b.disabled)&&/only pose keys/.test(m.textContent)),'time key: no interpolation, and why');
  await page.keyboard.press('Escape');await wait(200);
  await shoot('s33-mc-moved.png','noah');
  const pe=JSON.parse(await exportCut()).shots[0].peopleEdits;assert.equal(pe.v,2);
  const exp=structuredClone(film.people);exp.cast.find(e=>e.key==='noah-taps').act.at=pe.cast.find(e=>e.key==='noah-taps').act.at;
  assert.ok(Math.abs(exp.cast.find(e=>e.key==='noah-taps').act.at-8.6)<.03);const {v,...rest}=pe;assert.deepEqual(rest,exp,'oilers export: only the tap moved');
  console.log('M-c (oilers) ok');
  // ======== media: Omar's pose keys
  const m=chapter('media'),mfilm=filmShot('media'),MT=mfilm.seconds;
  await openChapter(page,base,m);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await until(()=>page.$('[data-action="pe-row"]'),'the People list');
  await page.$eval('[data-action="pe-row"][data-index="0"]',e=>e.click());await wait(800);
  await seek(page,3.2);omarModel=await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom.people.byKey('omar').userData.person.id);await page.$eval('[data-action="pe-pose-enter"]',e=>e.click());
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)).catch(()=>false),'the skeleton',120000);
  if(await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'))!=='true')await page.$eval('[data-action="pe-key-auto"]',e=>e.click());
  await set('pe-joint','lowerarm_l');await wait(300);await set('pe-rx',35);await wait(600);
  await seek(page,6);await set('pe-rx',-10);await wait(600);
  await set('pe-joint','head');await wait(300);await set('pe-ry',20);await wait(600);
  await page.$eval('[data-action="pe-pose-done"]',e=>e.click());await wait(600);
  await twirl('omar');assert.deepEqual(await rowKeys('omar','pose'),['pose|omar|3.2','pose|omar|6']);
  await twirl('omar|pose');await twirl('omar|pose|'+omarModel);assert.deepEqual(await page.$$eval('[data-ps-of="omar"][data-ps-prop="joint"]',l=>l.map(e=>e.dataset.psBone)),['head','lowerarm_l'],'a row per keyed joint');
  assert.deepEqual(await rowKeys('omar','joint'),['pose|omar|6|head','pose|omar|3.2|lowerarm_l','pose|omar|6|lowerarm_l']);
  assert.equal(await page.$eval(`[data-sk="${modernId('pose|omar|3.2')}"]`,e=>e.classList.contains('sk-circle')),true,'smooth = circle');
  // copy 3.2, paste at 11, Delete, undo
  await click('pose|omar|3.2');ins=await inspector();assert.ok(/KEY · POSE/.test(ins),ins);
  await key('Control+c');await seek(page,11);await key('Control+v');
  assert.deepEqual(await rowKeys('omar','pose'),['pose|omar|3.2','pose|omar|6','pose|omar|11'],'pasted at the playhead');assert.deepEqual(await selected(),['pose|omar|11']);
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await key('Delete');assert.deepEqual(await rowKeys('omar','pose'),['pose|omar|3.2','pose|omar|6'],'Delete');
  await key('Control+z');assert.equal((await rowKeys('omar','pose')).length,3,'undo brings it back');
  // a joint key dragged: only that joint moves (6 -> 8 for the head)
  await drag('pose|omar|6|head',8,MT);{const j=await rowKeys('omar','joint');assert.equal(j.length,4);assert.ok(/^pose\|omar\|(7\.9\d*|8(\.0\d*)?)\|head$/.test(j[0])&&j.slice(1).join()==='pose|omar|3.2|lowerarm_l,pose|omar|6|lowerarm_l,pose|omar|11|lowerarm_l','the head key alone moved (Alt: free, about 8 s): '+j);}
  // M-d: right-click 6: Hold -> square; Inspector Interpolation: Linear -> diamond (one undo step each)
  await click('pose|omar|6',{button:'right'});await page.$eval('.ps-menu [data-ps-ease="hold"]',e=>e.click());await wait(600);
  assert.ok(await page.$eval(`[data-sk="${modernId('pose|omar|6')}"]`,e=>e.classList.contains('sk-square')),'hold = square');
  await click('pose|omar|6');await set('pe-sk-ease','linear');await wait(600);assert.ok(await page.$eval(`[data-sk="${modernId('pose|omar|6')}"]`,e=>e.classList.contains('sk-diamond')),'linear = diamond');
  await key('Control+z');assert.ok(await page.$eval(`[data-sk="${modernId('pose|omar|6')}"]`,e=>e.classList.contains('sk-square')),'undo: hold again');
  // Inspector: the elbow's Bend at 3.2 typed
  await click('pose|omar|3.2');await set('pe-sk-joint','lowerarm_l');await wait(300);
  assert.ok(Math.abs(await page.$eval('#director-panel [name="pe-sk-rx"]',e=>Number(e.value))-35)<.6,'Bend shows the key\'s 35°');
  await set('pe-sk-rx',50);await wait(600);
  await shoot('s33-md-pose-keys.png','omar');
  const mp=JSON.parse(await exportCut()).shots[0].peopleEdits,rawOm=mp.cast.find(e=>e.key==='omar'),om={...rawOm,...rawOm.postures[omarModel]};
  assert.deepEqual(om.poseKeys.map(k=>[Math.round(k.t*10)/10,Object.keys(k.pose).sort().join(),k.ease||'smooth']),[[3.2,'lowerarm_l','smooth'],[6,'lowerarm_l','hold'],[8,'head','smooth'],[11,'lowerarm_l','smooth']]);
  assert.ok(Math.abs(turnAngles(om.poseKeys[0].pose.lowerarm_l)[0]-50)<.6,'Bend 50 written');
  for(const e of mfilm.people.cast){const {poseKeys,postures,...r}=mp.cast.find(x=>x.key===e.key);assert.deepEqual(r,e,`${e.key}: everything else as the film has it`);}
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS people sheet: M-a rows / twirl, M-b select / marquee / Inspector / J K / ◀ ▶, M-c move / multi / snap / Time / ◆ / Delete / copy-paste / undo, M-d shapes / right-click / Interpolation; exports change only what was edited');
}finally{await close();}
