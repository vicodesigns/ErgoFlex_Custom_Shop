// Hide, then bring back, measured in the Director's Render still (real GPU Chrome, 18 Nov 2026): under film quality the
// still stage's ambient occlusion echoed a hidden thing's "hidden" back as its own state, so after Undo / Show it stayed
// missing from Render still and Film look (film-desk-edits.mjs hideDesk, film-edits.mjs hide edits; node proof:
// tests/film-hide-gtao-echo-test.mjs). Vico's two examples, in the Layers tab of the Create chapter:
//   prop  hide the potted fern (else the first room prop the still shows) with its eye; Show it again; Render still = before
//   desk  hide a room desk with its eye (one in the still's view), Render still: it is gone; Undo; Render still = before
//         (Create has none to hide: the first other chapter with one, DESK_CHAPTERS=<ids> to choose)
// "= before": exactly the same pixels as the still before the hide (Render still is deterministic: two stills of one frame
// are checked identical first). On 713d22ff the stool case left 0.032 % of the frame off: this fails there.
// CHAPTER=create (default). Writes the stills and hide-stills.json to OUT (default: a temp dir).
//   flock /tmp/claude-1000/hq12-stills.lock node tests/director-hide-render-still-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {chapterList,HQ,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id===(process.env.CHAPTER||'create'));
if(!chapter){console.log(`Director hide Render still e2e: skipped (${HQ}/director-chapters.json has no ${process.env.CHAPTER||'create'} chapter here).`);process.exit(0);}
const OUT=process.env.OUT||fs.mkdtempSync(path.join(os.tmpdir(),'hide-stills-'));fs.mkdirSync(OUT,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],report={chapter:chapter.id},check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=180000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(250);}};
let n=0;
// the Director's Render still (Shift+R) at the playhead (done when the cleared status lines say "Still rendered" again)
async function still(name){
  const said=()=>page.evaluate(()=>['#director-panel [data-status]','#director-timeline [data-timeline-status]'].map(q=>document.querySelector(q)?.textContent||'').join(' | '));
  await page.evaluate(()=>{document.activeElement?.blur();for(const q of ['#director-panel [data-status]','#director-timeline [data-timeline-status]']){const s=document.querySelector(q);if(s)s.textContent='(e2e: waiting for the still)';}});
  await page.keyboard.down('Shift');await page.keyboard.press('KeyR');await page.keyboard.up('Shift');
  await until(async()=>/Still rendered/.test(await said()),'Render still',300000);
  const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);assert.ok(url,'a still image');
  fs.writeFileSync(path.join(OUT,String(++n).padStart(2,'0')+'-'+name+'.png'),Buffer.from(url.split(',')[1],'base64'));
  await page.evaluate(()=>{for(const b of document.querySelectorAll('#film-still .still-close'))b.click();});await wait(200);
  return url;
}
// the share of pixels that differ by more than 8 (of 255) in any channel, and the mean difference
const diff=(a,b)=>page.evaluate(async(a,b)=>{
  const load=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,c.width,c.height);};
  const [A,B]=await Promise.all([load(a),load(b)]);let off=0,sum=0;const N=A.width*A.height;
  for(let i=0;i<A.data.length;i+=4){const d=Math.max(Math.abs(A.data[i]-B.data[i]),Math.abs(A.data[i+1]-B.data[i+1]),Math.abs(A.data[i+2]-B.data[i+2]));sum+=d;if(d>8)off++;}
  return {off:+(off/N).toFixed(5),mean:+(sum/N).toFixed(3)};},a,b);
// the Layers tab's rows: name, key, hidden, whether its eye can act, and whether it is a room desk
const rows=()=>page.evaluate(()=>[...document.querySelectorAll('#director-panel li[data-ly-item]')].map(li=>{const eye=li.querySelector('.layer-eye');
  // (desk: the eye hides a room desk: layers-panel.mjs marks it data-ly-desk with its station)
  return {key:li.dataset.lyItem,name:li.querySelector('.layer-name')?.textContent||'',hidden:li.classList.contains('is-hidden'),can:!!eye&&!eye.disabled,desk:!!eye?.dataset.lyDesk};}));
const eye=key=>page.evaluate(key=>{const b=[...document.querySelectorAll('#director-panel li[data-ly-item] .layer-eye')].find(b=>b.dataset.section===key);if(!b)throw Error('no eye for '+key);b.click();},key);
const rowOf=async key=>(await rows()).find(r=>r.key===key);
const layersTab=async()=>{await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="layers"]')?.click());await wait(500);};
const undo=async()=>{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');};
try{
  await openChapter(page,base,chapter);
  await layersTab();
  const list=await until(async()=>{const r=await rows();return r.length?r:null;},'the Layers rows');
  check(list.some(r=>r.can),`the Layers tab lists ${list.length} items with an eye`);
  // ---- the reference and the noise of two stills of the same frame
  let A=await still('before'),A2=await still('before-again'),noise=await diff(A,A2);report.noise=noise;
  // Render still is deterministic: two stills of one frame are the same pixels, and a thing brought back must leave none
  // off (the old code left 0.032 % of the frame, mean 0.018, after the Artist stool came back: the bar is exact)
  check(noise.off===0&&noise.mean===0,`two stills of the same frame are identical (${JSON.stringify(noise)})`);
  const same=d=>d.off===0&&d.mean===0,gone=d=>d.off>=.001;
  // one case: hide the row, the still changes; bring it back (Undo or the eye again), the still is the reference again
  async function hideAndBack(kind,cands,back){
    for(const r of cands){
      await layersTab();await eye(r.key);
      await until(async()=>(await rowOf(r.key))?.hidden,`${kind}: ${r.name} hidden`,30000).catch(()=>null);
      const H=await still(kind+'-hidden'),dH=await diff(A,H);
      if(!gone(dH)){console.log(`     (${kind}: ${r.name} is not in the still's view: ${JSON.stringify(dH)}; next)`);await layersTab();await back(r);await until(async()=>!(await rowOf(r.key))?.hidden,`${kind}: ${r.name} back`,30000);await still(kind+'-skip-back');continue;}
      check(true,`${kind}: hiding ${r.name} takes it out of Render still (${(dH.off*100).toFixed(2)} % of pixels)`);
      await layersTab();await back(r);
      await until(async()=>!(await rowOf(r.key))?.hidden,`${kind}: ${r.name} shown again in the Layers tab`,30000);
      const C=await still(kind+'-back'),dC=await diff(A,C);report[kind]={name:r.name,key:r.key,hidden:dH,back:dC};
      check(same(dC),`${kind}: after bringing ${r.name} back, Render still is the frame before the hide (${(dC.off*100).toFixed(3)} % off, mean ${dC.mean}; noise ${(noise.off*100).toFixed(3)} %, ${noise.mean})`);
      return;
    }
    check(false,`${kind}: none of ${cands.map(r=>r.name).join(', ')||'(no candidates)'} shows in the still's view`);
  }
  const now=await rows();
  const props=now.filter(r=>!r.desk&&r.can&&!r.hidden),fern=props.filter(r=>/^Potted fern/i.test(r.name));
  await hideAndBack('prop',[...fern,...props.filter(r=>!fern.includes(r))].slice(0,6),async r=>{await eye(r.key);});
  // the desk: this chapter's room desks, else the first of the other chapters (DESK_CHAPTERS, default all) that has one
  let desks=now.filter(r=>r.desk&&r.can&&!r.hidden);report.deskChapter=chapter.id;
  if(!desks.length){
    const others=(process.env.DESK_CHAPTERS?process.env.DESK_CHAPTERS.split(','):chapterList().map(c=>c.id)).filter(id=>id!==chapter.id);
    for(const id of others){const c=chapterList().find(c=>c.id===id);if(!c)continue;
      await openChapter(page,base,c);await layersTab();
      desks=(await until(async()=>{const r=await rows();return r.length?r:null;},id+': the Layers rows')).filter(r=>r.desk&&r.can&&!r.hidden);
      console.log(`     (desk: ${chapter.id} has no room desk to hide; ${id}: ${desks.length})`);
      if(desks.length){report.deskChapter=id;A=await still('desk-before');A2=await still('desk-before-again');noise=await diff(A,A2);report.deskNoise=noise;
        check(noise.off===0&&noise.mean===0,`${id}: two stills of the same frame are identical (${JSON.stringify(noise)})`);break;}
    }
  }
  await hideAndBack('desk',desks.slice(0,4),async()=>{await undo();});
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);}
finally{
  report.status=await statusOf(page).catch(()=>'');fs.writeFileSync(path.join(OUT,'hide-stills.json'),JSON.stringify(report,null,1));console.log('stills and hide-stills.json in '+OUT);
  await close();
}
check(!errors.length,'no page / module ("not exported") errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('Director hide Render still: a hidden desk (Undo) and a hidden prop (Show) come back in Render still.');
