// Prop fades in the Director (S33 B1; real Chrome on the harness's own scratch server): the create chapter of the
// Cinematographer's cut, where the film fades the oak pen display out itself (keyed opacity 1 -> 0 over 7.0–7.4 s).
//  - its Props bar is that window (0–7.4 s) with the fade drawn (not the whole chapter);
//  - dragging the bar's end to ~5.5 s keeps the 0.4 s fade out (before: show:{to} with no fade: cut off);
//  - the inspector: Curve Smooth writes show.ease 'smooth', Slow 1 s sets the fades; a fade handle on the bar drags its
//    length; undo;
//  - the stage draws it: at the fade's midpoint its materials are at half opacity, a quarter in at 0.84 (smooth).
//   CHROME=".../chrome.exe" SHOTS=<dir> node tests/director-prop-fades-e2e.mjs        (run under the GPU lock)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',MATCH='^Prop:atelier-artist-pen-display-oak$',NAME='Prop:atelier-artist-pen-display-oak',KEY=/pen-display-oak/i;
const F0={from:0,to:7.4,fadeIn:0,fadeOut:.4},RT=5.5;   // the film's own window for it, and where the test drags its end
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(c=>c.id==='create');
const T=chapter.seconds;
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'prop-fades-shots-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser({width:1600,height:1000});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('  ok: '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const snap=name=>page.screenshot({path:path.join(shots,name+'.png')});
// the item's edit in the Director's draft (a film chapter's drafts: ergoflex.director.filmDrafts.v1; else the cut library)
const edit=(match=MATCH)=>page.evaluate(m=>{const cuts=[];try{for(const d of Object.values(JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}')))if(d?.cut)cuts.push(d.cut);}catch{}try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1')||'null');if(v)cuts.push(v.drafts?.[v.active]||v.cuts.find(c=>c.id===v.active));}catch{}
  for(const cut of cuts)for(const s of cut?.shots||[])for(const e of s.propEdits||[])if(e.match===m)return e;return null;},match);
const bar=(key=KEY)=>page.evaluate(src=>{const re=new RegExp(src,'i'),b=[...document.querySelectorAll('#director-timeline .prop-bar')].find(b=>re.test(b.dataset.propKey||''));if(!b)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),lane=b.parentElement.getBoundingClientRect();
  return {x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,lane:{x:lane.left,w:lane.width},left:parseFloat(b.style.left),width:parseFloat(b.style.width),fin:parseFloat(b.style.getPropertyValue('--fade-in')),fout:parseFloat(b.style.getPropertyValue('--fade-out')),ramps:b.querySelectorAll('.prop-ramp').length,handles:[...b.querySelectorAll('.prop-fade-h')].map(h=>{const q=h.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2,fade:h.dataset.fade};}),smooth:!!b.querySelector('.prop-ramp.smooth')};},key.source);
const clickBar=(key=KEY)=>page.evaluate(src=>{const re=new RegExp(src,'i');[...document.querySelectorAll('#director-timeline .prop-bar')].find(b=>re.test(b.dataset.propKey||''))?.click();},key.source);
// its material opacity on the stage now (the lowest of its meshes: a fade copy runs on all of them), and whether it is drawn
// (the object film-edits applies the edit to: its own editTargets, as the Props editor finds it)
const opacity=(match=MATCH)=>page.evaluate(N=>{const w=document.getElementById('stage').contentWindow,E=w.__filmEdits;let list=[];try{list=E?.editTargets?E.editTargets({match:N}):[];}catch{}
  if(!list.length){const re=new RegExp(N),s=w.ErgoPresentation.three().scene;s.traverse(x=>{if(re.test(x.name))list.push(x);});}
  const o=list[0];if(!o)return {v:NaN,vis:false,names:[]};let v=1,vis=true;for(let p=o;p;p=p.parent)if(!p.visible)vis=false;o.traverse(m=>{for(const mat of [].concat(m.material||[]))v=Math.min(v,mat.opacity);});return {v,vis,count:list.length,name:o.name};},match);
try{
  await openChapter(page,base,chapter);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="props"]')?.click());
  await seek(page,3);await wait(800);
  const b0=await until(bar,'the pen display bar in the Props lane',40000),L0=F0.to-F0.from;
  check(Math.abs(b0.left-F0.from/T*100)<.3&&Math.abs(b0.left+b0.width-F0.to/T*100)<.3,`its bar is the film's own window ${F0.from}–${F0.to} s (drawn ${(b0.left/100*T).toFixed(2)}–${((b0.left+b0.width)/100*T).toFixed(2)} s), not the whole chapter`);
  check(Math.abs(b0.fout-F0.fadeOut/L0*100)<.5&&b0.ramps===2&&b0.handles.length===2,`the film's ${F0.fadeOut} s fade out is drawn on it, with a handle for each fade`);
  await snap('01-film-fade-bar');
  // retime: drag its end to RT s
  const xt=b0.lane.x+RT/T*b0.lane.w,y=b0.y+b0.h*.7;
  await page.mouse.move(b0.right-2,y);await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(b0.right-2+(xt-b0.right+2)*i/12,y);await wait(25);}await page.mouse.up();
  console.log('  (grabbed: '+await page.evaluate((x,y)=>{const el=document.elementFromPoint(x,y);return el?(el.className+' '+(el.closest('.prop-bar')?.dataset.propKey||'').slice(0,50)):'none';},b0.right-2,y)+' · status: '+await page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'?')+')');
  const e1=await until(async()=>{const e=await edit();return e?.show?e:null;},'the retime is written');
  check(Math.abs(e1.show.to-RT)<.15&&e1.show.fadeOut===F0.fadeOut&&!e1.show.fadeIn,`retimed to end at ${e1.show.to} s: show ${JSON.stringify(e1.show)} keeps the ${F0.fadeOut} s fade out`);
  const b1=await until(async()=>{const b=await bar();return b&&Math.abs(b.left+b.width-e1.show.to/T*100)<.3?b:null;},'the bar follows');
  check(Math.abs(b1.fout-F0.fadeOut/(e1.show.to-F0.from)*100)<.6,'the bar keeps its fade-out ramp');
  // (this Windows stage does not build the pen display itself, so what the stage draws is measured on a prop it has)
  // the inspector on the easel (the film fades it in from 17.5 s): it leaves at 22 s, Curve Smooth, then Slow 1 s
  // (a film item of the lane the stage has exactly once and shows the whole chapter: what the stage draws is measured on it)
  await seek(page,8);await wait(800);
  const pick=await page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,E=w.__filmEdits;for(const b of document.querySelectorAll('#director-timeline .prop-bar.film')){let k;try{k=JSON.parse(b.dataset.propKey);}catch{continue;}
    if(parseFloat(b.style.left)>.5||parseFloat(b.style.width)<99||!k[0]||k[2])continue;let n=[];try{n=E.editTargets({match:k[0]});}catch{}if(n.length===1&&n[0].visible)return {match:k[0],key:b.dataset.propKey,name:b.textContent.trim()};}return null;});
  check(!!pick,'a whole-chapter film item to time: '+pick?.name);
  const TAB=pick.match,TK=new RegExp(pick.key.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')),onStage=()=>until(()=>opacity(TAB).then(o=>o&&!o.names?o:null),'it on the stage',15000);
  await until(()=>bar(TK),'its bar');await clickBar(TK);
  await until(()=>page.$('#director-panel [name="pp-t-to"]'),'the inspector\'s On screen fields');
  const setField=(n,v)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},n,v);
  await setField('pp-t-to',10);
  const t1=await until(async()=>{const e=await edit(TAB);return e?.show?.to===10?e:null;},'Leaves at 10 s');
  check(!t1.show.fadeOut&&!t1.show.fadeIn,'Leaves at (s) 10: a cut ('+JSON.stringify(t1.show)+')');
  await setField('pp-t-curve','smooth');
  const e2=await until(async()=>{const e=await edit(TAB);return e?.show?.ease==='smooth'?e:null;},'Curve Smooth');
  check(e2.show.fadeOut===.5&&e2.show.to===10,'Curve: Smooth on a cut gives it Medium 0.5 s fades, eased: '+JSON.stringify(e2.show));
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="pp-t-slow"]').click());
  const e3=await until(async()=>{const e=await edit(TAB);return e?.show?.fadeOut===1?e:null;},'Slow 1 s');
  check(e3.show.ease==='smooth'&&e3.show.fadeOut===1,'Slow 1 s: the fades are 1 s, still smooth: '+JSON.stringify(e3.show));
  // the stage draws it smooth: before the fade whole, at its midpoint half, a quarter in 0.84 (linear: 0.75), after it gone
  const to=e3.show.to;
  // (measured with nothing selected, as it plays)
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="pp-clear"]')?.click());await wait(300);
  await seek(page,to-1.3);await wait(700);const s0=await onStage();
  await seek(page,to-.5);await wait(700);const s1=await onStage();
  await seek(page,to-.75);await wait(700);const s2=await onStage();
  await seek(page,to+.2);await wait(600);const s3=await opacity(TAB);
  // (S33c: this needs the film's screen clips, exports/cinematic-intro-cut-cine/screens/*.mp4, which git ignores: without
  // them film-fx install throws "Could not load …mp4" and player.mjs prepareStage clears the whole film layer, so no
  // sceneEdits, and no fade, reach the live stage. In a scratch worktree link screens/ to the render checkout's.)
  check(s0.vis&&s0.v===1&&Math.abs(s1.v-.5)<.06&&Math.abs(s2.v-.84375)<.05&&s3&&!s3.vis,`a smooth 1 s fade on the stage: ${s0.v.toFixed(2)} before, ${s1.v.toFixed(3)} at its midpoint, ${s2.v.toFixed(3)} a quarter in (linear would be 0.75), gone after${s1.v===1?' (1.0 at the midpoint: is screens/ missing? see above)':''}`);
  await seek(page,to-.5);await wait(600);await page.evaluate(()=>document.querySelector('#director-panel [data-prop-timing]')?.scrollIntoView({block:'center'}));await wait(300);
  await snap('02-inspector-curve');
  await seek(page,8);await wait(500);const b2=await bar(TK);check(b2.smooth,'the ramps on the bar are drawn eased');
  // a fade handle: drag the fade out longer by 0.6 s
  const h=b2.handles.find(x=>x.fade==='out'),dx=-.6/T*b2.lane.w;
  await page.mouse.move(h.x,h.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(h.x+dx*i/8,h.y);await wait(30);}
  await snap('03-dragging-fade-handle');await page.mouse.up();
  const e4=await until(async()=>{const e=await edit(TAB);return e?.show&&e.show.fadeOut>1.3?e:null;},'the handle sets the fade');
  check(Math.abs(e4.show.fadeOut-1.6)<.15&&Math.abs(e4.show.to-to)<1e-6,`dragging the fade-out handle: fade out ${e4.show.fadeOut} s, the end stays at ${e4.show.to} s`);
  await page.evaluate(()=>document.querySelector('#director-appbar [data-action="undo"]').click());
  await until(async()=>(await edit(TAB))?.show?.fadeOut===1,'undo the handle');check(true,'Undo puts the fade back');
  // ---- the Props lane in a chapter with desk versions (hero) and in oilers: no two bars overlap in a row
  for(const id of ['hero','oilers']){
    const ch=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(c=>c.id===id);if(!ch){console.log('  (no chapter '+id+')');continue;}
    await openChapter(page,base,ch);
    let worst=null,bars=0;
    for(const f of [.05,.2,.35,.5,.65,.8,.95]){
      await seek(page,f*ch.seconds);await wait(900);
      const r=await page.evaluate(()=>{const bs=[...document.querySelectorAll('#director-timeline .prop-bar')].map(b=>({top:b.style.top,l:parseFloat(b.style.left),r:parseFloat(b.style.left)+parseFloat(b.style.width),n:b.textContent.trim().slice(0,40)}));const over=[];
        for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];if(a.top===c.top&&Math.min(a.r,c.r)-Math.max(a.l,c.l)>.05)over.push(a.n+' / '+c.n+' @'+a.top);}return {n:bs.length,over};});
      bars=Math.max(bars,r.n);if(r.over.length&&!worst)worst={t:f*ch.seconds,over:r.over};
    }
    check(!worst,`${id}: the Props lane's ${bars} bars never overlap in a row`+(worst?` (at ${worst.t.toFixed(1)} s: ${worst.over.slice(0,3).join('; ')})`:''));
    if(id==='hero')await snap('04-hero-props-lane');
  }
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS director prop fades (${passed.length} checks) · shots: ${shots}`);
}finally{await close();}
