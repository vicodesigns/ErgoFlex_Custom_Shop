// The movie's clip track in a real Chrome (21 Nov 2026, Vico: edit the movie chapter's screen video like Premiere;
// ch 10 media only; docs/screen-edit-list/CONTRACT.md). Self-contained (any studio state, no earlier test), on Vico's
// 3rd cut:
//   1  ch 10 media, Graphics: the movie screen's row is the Movie track (1 clip), the Graphics tab has Movie edit
//                                                                               (screenshot movie-edit-1-before.png)
//   2  split at 6 s and 11.5 s (three clips, the source continuing); clip 2's source in 70 s; the + on the 6 s cut ->
//      Dissolve 1 s: a chip over 5-6 s; clip 3: Dip 0.8 s through black: a chip over 11.1-11.9 s
//                                                                               (screenshot movie-edit-2-after.png)
//      Render still at 5.5 s: composed on this machine (POST /api/screen-edit), said on the still (movie-edit-still-dissolve.jpg)
//      Delete on the dip chip takes the dip only (the clip stays); Ctrl+Z
//   3  ◀ Earlier on clip 3 (ripple: lengths kept), Ctrl+Z; Ctrl+drag clip 1 past clip 3 (ripple), Ctrl+Z
//   4  Export cut: the movie screen's entries as set (transitionIn on the incoming clips, no missing flag)
//   4b the source bin and monitor: clip 3 shortened to 14 s, a promo source marked 1-3 s and added at the end;
//      Mark in on clip 1's own source                                              (screenshot movie-edit-3-bin.png)
//   5  ch 9 music (the game montage): no Movie track, no Movie edit (Vico edits only the movie)
//   CHROME=... [STATE_FROM=...] node tests/movie-edit-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut',T=17;
const shots=process.argv[2]||path.join(os.tmpdir(),'movie-edit-shots');fs.mkdirSync(shots,{recursive:true});
const chapters=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters,chapter=id=>chapters.find(x=>x.id===id);
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='media');
const movie0=(film.screens||[]).filter(s=>s.target==='main-landscape');
assert.equal(movie0.length,1,'today: the movie is one clip on main-landscape');
// the source bin is generated per machine (untracked, like the cut's other files): made here when this checkout has none
{const f=path.join(root,CUT,'director-film','screen-bin.json');if(!fs.existsSync(f)){const r=spawnSync(process.execPath,['tools/experience/compose-screen-edit.mjs','--bin',CUT],{cwd:root,encoding:'utf8'});console.log('made the source bin:',r.status,(r.stderr||'').trim().slice(-200));}
 assert.ok(fs.existsSync(f),'the source bin '+f);}
const binDoc=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-film','screen-bin.json'),'utf8')),promo=binDoc.sources.find(x=>x.group==='promo'&&x.seconds>=4)||binDoc.sources.find(x=>x.seconds>=4&&x.group!=='movie');
assert.ok(promo,'the bin has a source of 4 s or more besides the movie');
const {base,page,errors,close}=await openDirectorBrowser();
const log=(...a)=>console.log(...a);
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const shoot=async name=>{await wait(300);const f=path.join(shots,name);await page.screenshot({path:f});log('screenshot',f);};
const change=async(name,value)=>{await page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [data-movie-fields] [name="${n}"]`);if(!e)throw Error('no field '+n);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(700);};
const act=async(sel)=>{await page.$eval(sel,e=>e.click());await wait(700);};
const key=async combo=>{const [m,k]=combo.split('+');await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await page.keyboard.down(m);await page.keyboard.press(k);await page.keyboard.up(m);await wait(800);};
// the movie clips as the Movie edit list shows them: [{i, text}], and as the timeline draws them: [{i, from, to}] seconds
const listed=()=>page.$$eval('#director-panel [data-movie-edit] .movie-clips [data-graphic-index]',l=>l.map(b=>({i:Number(b.dataset.graphicIndex),text:b.textContent.replace(/\s+/g,' ').trim()})));
const span=(sel)=>page.$$eval(sel,(l,T)=>l.map(e=>{const lane=e.closest('[data-graphic-lane]').getBoundingClientRect(),r=e.getBoundingClientRect();return {i:Number(e.dataset.clipTransition??e.dataset.clipSeam??e.dataset.graphicClip),from:+((r.left-lane.left)/lane.width*T).toFixed(2),to:+((r.right-lane.left)/lane.width*T).toFixed(2)};}),T);
// a point of the timeline that really reaches the element (scrolled into the lane area first)
async function reach(selector){
  const p=await page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return {why:'no '+sel};el.scrollIntoView({block:'center',inline:'center'});
    const r=el.getBoundingClientRect(),x=r.left+Math.min(r.width/2,40),y=r.top+r.height/2,top=document.elementFromPoint(x,y);
    if(!top||!(top===el||el.contains(top)))return {why:`${sel} covered by ${top?top.tagName+'.'+[...top.classList].join('.'):'nothing'}`};const lane=el.closest('[data-graphic-lane]')?.getBoundingClientRect();return {x,y,left:lane?.left,width:lane?.width};},selector);
  if(p.why)throw Error(p.why);return p;
}
const exportCut=()=>page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
async function graphicsOpen(){
  await page.$eval('[data-inspector-tab="graphics"]',e=>e.click());await wait(600);
  const t='#director-timeline [data-lane-group="graphics"] [data-action="group-toggle"]';
  if(await page.$(t)&&await page.$eval(t,e=>e.getAttribute('aria-expanded'))!=='true'){await page.$eval(t,e=>e.click());await wait(600);}
}
try{
  // ---- 1 the Movie track
  await openChapter(page,base,chapter('media'));await graphicsOpen();
  await until(()=>page.$('#director-timeline [data-movie-track]'),'the Movie track on the Graphics lane');
  assert.match(await page.$eval('#director-timeline [data-movie-track] .desk-lane-label',e=>e.textContent),/Movie\s*1 clip/);
  assert.ok(await page.$('#director-panel [data-movie-edit]'),'Graphics tab: Movie edit');
  assert.equal((await listed()).length,1);
  await shoot('movie-edit-1-before.png');log('1 ok: the Movie track and Movie edit');
  // ---- 2 split twice, transitions
  const clip0=(await listed())[0].i;
  await act(`#director-panel [data-movie-edit] [data-graphic-index="${clip0}"]`);
  await seek(page,6);await act(`#director-panel [data-movie-fields] [data-graphic-action="split"]`);
  await until(async()=>(await listed()).length===2,'two clips after the split at 6 s');
  {const l=await listed();await act(`#director-panel [data-movie-edit] [data-graphic-index="${l[1].i}"]`);}
  await seek(page,11.5);await act(`#director-panel [data-movie-fields] [data-graphic-action="split"]`);
  await until(async()=>(await listed()).length===3,'three clips after the split at 11.5 s');
  let l=await listed();log('clips',JSON.stringify(l.map(x=>x.text)));
  assert.match(l[1].text,/6–11\.5 s · source 46–51\.5 s/,'the source continues across the split');
  await act(`#director-panel [data-movie-edit] [data-graphic-index="${l[1].i}"]`);await change('me-in',70);
  l=await listed();assert.match(l[1].text,/source 70–75\.5 s/);
  // the + on the 6 s cut, then Dissolve 1 s
  {const seams=await span('#director-timeline [data-movie-track] [data-clip-seam]');assert.equal(seams.length,2,'a + on each cut: '+JSON.stringify(seams));
   const p=await reach(`#director-timeline [data-movie-track] [data-clip-seam="${l[1].i}"]`);await page.mouse.click(p.x,p.y);await wait(700);}
  assert.equal(await page.$eval('#director-panel [data-movie-fields]',e=>Number(e.dataset.movieFields)),l[1].i,'the + selects the incoming clip');
  await change('me-type','dissolve');await change('me-dur',1);
  await act(`#director-panel [data-movie-edit] [data-graphic-index="${l[2].i}"]`);await change('me-type','dip');await change('me-dur',.8);
  const chips=await span('#director-timeline [data-movie-track] [data-clip-transition]');log('chips',JSON.stringify(chips));
  assert.equal(chips.length,2);
  assert.ok(Math.abs(chips[0].from-5)<.08&&Math.abs(chips[0].to-6)<.08,'dissolve chip over 5-6 s');
  assert.ok(Math.abs(chips[1].from-11.1)<.08&&Math.abs(chips[1].to-11.9)<.08,'dip chip over 11.1-11.9 s');
  await shoot('movie-edit-2-after.png');log('2 ok: split, source in, dissolve and dip chips');
  // Render still inside the dissolve (5.5 s): the movie edit composed on this machine (POST /api/screen-edit), said on the still.
  // (the visible Render still button, nothing focused; the status logged every 5 s and every /api/screen-edit answer printed:
  // 21 Nov 2026, Windows: Shift+R after the + click did nothing, the + had focused the Transition select)
  {const answers=[];const onResponse=async r=>{if(!r.url().includes('/api/screen-edit'))return;let body='';try{body=(await r.text()).slice(0,400);}catch{}answers.push(r.status());log('POST /api/screen-edit ->',r.status(),body);};page.on('response',onResponse);
   await seek(page,5.5);await page.evaluate(()=>document.activeElement?.blur?.());
   assert.equal(await page.evaluate(()=>!!document.activeElement?.closest?.('input,select,textarea')),false,'no field has focus after the seam click (the Director\'s keys work)');
   await act('.render-still[data-action="render-still"]');
   let seen='',last=0;
   await until(async()=>{const s=await status(page);if(s!==seen||Date.now()-last>5000){log('status:',s.slice(0,160));seen=s;last=Date.now();}return /Still rendered|Render still failed/.test(s);},'Render still with the movie edit',600000);
   page.off('response',onResponse);
   assert.match(await status(page),/Still rendered/,'the still rendered');assert.ok(answers.length,'the still asked for the movie edit (POST /api/screen-edit)');
   const note=await page.$eval('#film-still',e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'');log('still note:',note.slice(0,300));
   assert.match(note,/movie edit (composed|\(composed before\))/,'the still was rendered with the composed movie edit');
   const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);if(url?.startsWith('data:'))fs.writeFileSync(path.join(shots,'movie-edit-still-dissolve.jpg'),Buffer.from(url.split(',')[1],'base64'));
   await page.keyboard.press('Escape');await wait(500);}
  // Delete on a picked chip takes the transition, not the clip (the timeline's Delete: graphics.remove)
  {const p=await reach(`#director-timeline [data-movie-track] [data-clip-transition="${l[2].i}"]`);await page.mouse.click(p.x,p.y);await wait(600);}
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await page.keyboard.press('Delete');await wait(800);
  assert.equal((await listed()).length,3,'Delete on the dip chip: the clip stays');assert.equal((await span('#director-timeline [data-movie-track] [data-clip-transition]')).length,1,'the dip is gone');
  await key('Control+z');assert.equal((await span('#director-timeline [data-movie-track] [data-clip-transition]')).length,2,'undo brings the dip back');
  // ---- 3 ripple: ◀ Earlier and Ctrl+drag, each one undo step
  const order=async()=>(await listed()).map(x=>x.text.match(/source ([\d.]+)–/)[1]);
  const before=await order();assert.deepEqual(before,['40','70','51.5'],'sources in: 40, 70 (set), 51.5 (the split\'s third piece)');
  await act('#director-panel [data-movie-fields] [data-graphic-action="earlier"]');
  {const o=await order();assert.deepEqual(o,[before[0],before[2],before[1]],'clip 3 before clip 2: '+o);}
  await key('Control+z');assert.deepEqual(await order(),before,'undo');
  {l=await listed();const p=await reach(`#director-timeline [data-movie-track] [data-graphic-clip="${l[0].i}"]`),to=p.left+p.width*16.5/T;
   await page.keyboard.down('Control');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+8,p.y,{steps:2});await page.mouse.move(to,p.y,{steps:10});await page.mouse.up();await page.keyboard.up('Control');await wait(800);}
  {const o=await order();assert.deepEqual(o,[before[1],before[2],before[0]],'Ctrl+drag: clip 1 to the end: '+o);}
  await key('Control+z');assert.deepEqual(await order(),before,'undo the ripple');
  log('3 ok: ripple by button and by Ctrl+drag, one undo each');
  // ---- 4 Export cut
  const exp=JSON.parse(await exportCut()),sh=(exp.shots||[]).find(s=>s.id==='media')||exp.shots?.[0];
  const mv=(sh.screens||[]).filter(s=>s.target==='main-landscape').sort((a,b)=>a.start-b.start);
  assert.deepEqual(mv.map(s=>[s.start,s.end,s.offset,s.transitionIn??null]),[[0,6,40,null],[6,11.5,70,{type:'dissolve',dur:1}],[11.5,17,before[2]*1,{type:'dip',dur:.8,color:'#000000'}]],'exported: '+JSON.stringify(mv));
  assert.ok(mv.every(s=>s.missing===undefined),'no missing flag');
  log('4 ok: Export cut carries the edit list');
  // ---- 4b the source bin and the monitor: clip 3 ends at 14 s (Source out), a promo source marked 1-3 s, + Add at the end
  {const l3=(await listed())[2];await act(`#director-panel [data-movie-edit] [data-graphic-index="${l3.i}"]`);await change('me-out',Number(before[2])+2.5);}
  assert.match((await listed())[2].text,/11\.5–14 s/,'clip 3 ends at 14 s');
  await until(()=>page.$(`#director-panel [data-movie-bin="${promo.src}"]`),'the source bin in the Graphics tab');
  await page.$eval(`#director-panel [data-movie-bin="${promo.src}"]`,e=>{e.closest('details.movie-bin-group').open=true;e.click();});await wait(700);
  assert.equal(await page.$eval('#director-panel [data-source-monitor-box]',e=>e.dataset.mode),'bin','the monitor shows the bin source');
  await until(()=>page.$eval('#director-panel [data-source-monitor]',v=>v.readyState>=1),'the monitor\'s video loads',30000);
  const markAt=async(t,which)=>{await page.$eval('#director-panel [data-source-monitor]',(v,t)=>new Promise(r=>{v.addEventListener('seeked',()=>r(),{once:true});v.currentTime=t;}),t);await act(`#director-panel [data-graphic-action="mark-${which}"]`);};
  await markAt(1,'in');await until(()=>page.$eval('#director-panel [data-source-monitor]',v=>v.readyState>=1),'the monitor after the re-render',30000);await markAt(3,'out');
  assert.match(await page.$eval('#director-panel .monitor-marks',e=>e.textContent),/In 1 s · Out 3 s/);
  await act('#director-panel [data-graphic-action="bin-add"][data-section="end"]');
  {const l=await listed();assert.equal(l.length,4,'a fourth clip');assert.match(l[3].text,/14–16 s · source 1–3 s/,'at the end, its marks: '+l[3].text);assert.ok(l[3].text.includes(promo.src.split('/').pop()));}
  await shoot('movie-edit-3-bin.png');
  // the selected clip's own source in the monitor: Mark in sets its Source in
  {const l=await listed();await act(`#director-panel [data-movie-edit] [data-graphic-index="${l[0].i}"]`);}
  assert.equal(await page.$eval('#director-panel [data-source-monitor-box]',e=>e.dataset.mode),'clip');
  await until(()=>page.$eval('#director-panel [data-source-monitor]',v=>v.readyState>=1),'the clip source loads',30000);await markAt(42,'in');
  assert.match((await listed())[0].text,/source 42–48 s/,'Mark in: the clip\'s Source in');
  log('4b ok: the source bin, the monitor\'s marks, + Add at the end, Mark in on a clip');
  // ---- 5 the game montage: nothing of this
  await openChapter(page,base,chapter('music'));await graphicsOpen();
  assert.equal(await page.$('#director-timeline [data-movie-track]'),null,'ch 9 music: no Movie track');assert.equal(await page.$('#director-panel [data-movie-edit]'),null,'no Movie edit');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS movie-edit-e2e (screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'movie-edit-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
