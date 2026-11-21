// The movie's clip track in a real Chrome (21 Nov 2026, Vico: edit the movie chapter's screen video like Premiere;
// ch 10 media only; docs/screen-edit-list/CONTRACT.md). Self-contained (any studio state, no earlier test), on Vico's
// 3rd cut:
//   1  ch 10 media, Graphics: the movie screen's row is the Movie track (1 clip), the Graphics tab has Movie edit
//                                                                               (screenshot movie-edit-1-before.png)
//   2  split at 6 s and 11.5 s (three clips, the source continuing); clip 2's source in 70 s; the + on the 6 s cut ->
//      Dissolve 1 s: a chip over 5-6 s; clip 3: Dip 0.8 s through black: a chip over 11.1-11.9 s
//                                                                               (screenshot movie-edit-2-after.png)
//      Delete on the dip chip takes the dip only (the clip stays); Ctrl+Z
//   3  ◀ Earlier on clip 3 (ripple: lengths kept), Ctrl+Z; Ctrl+drag clip 1 past clip 3 (ripple), Ctrl+Z
//   4  Export cut: the movie screen's entries as set (transitionIn on the incoming clips, no missing flag)
//   5  ch 9 music (the game montage): no Movie track, no Movie edit (Vico edits only the movie)
//   CHROME=... [STATE_FROM=...] node tests/movie-edit-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut',T=17;
const shots=process.argv[2]||path.join(os.tmpdir(),'movie-edit-shots');fs.mkdirSync(shots,{recursive:true});
const chapters=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters,chapter=id=>chapters.find(x=>x.id===id);
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='media');
const movie0=(film.screens||[]).filter(s=>s.target==='main-landscape');
assert.equal(movie0.length,1,'today: the movie is one clip on main-landscape');
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
  // ---- 5 the game montage: nothing of this
  await openChapter(page,base,chapter('music'));await graphicsOpen();
  assert.equal(await page.$('#director-timeline [data-movie-track]'),null,'ch 9 music: no Movie track');assert.equal(await page.$('#director-panel [data-movie-edit]'),null,'no Movie edit');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS movie-edit-e2e (screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'movie-edit-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
