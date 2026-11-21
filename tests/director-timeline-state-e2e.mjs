// The timeline keeps its view through edits, zooms like Premiere, and Delete deletes (20 Nov 2026, Vico; real GPU Chrome,
// a chapter of the Cinematographer's cut, default "rise").
//   1. first load (no saved view): every lane group is folded
//   2. groups opened / left folded and the scroll (both axes) stay exactly as they are through: a click on a visible key,
//      Delete, Ctrl+Z, an inspector edit, the selection header's 🗑
//   3. Delete / Backspace deletes the selected camera key and desk move with the focus lost (the timeline re-rendered
//      after the click); never while typing in a field (Backspace edits the text)
//   4. the selection header's 🗑 (the "Inspector Delete") deletes a camera key and a desk move; undo brings them back
//   5. zoom: + / − / Fit, '=' and '-', Ctrl+wheel at the pointer (the time under it stays); at the most zoom a frame is
//      >= 30 px (a camera key's width), so keys a frame apart separate
//   6. reload: the folds, the zoom and the scroll come back for this chapter
//   node tests/director-timeline-state-e2e.mjs        (CUT=<cut dir>, CHAPTER=<id>, SHOTS=<dir>)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine',ID=process.env.CHAPTER||'rise';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id===ID):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`timeline state e2e: skipped (${CUT} has no ${ID} chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'timeline-state-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end){await pageState('timed out: '+what);throw Error('timed out: '+what+' · status: '+await statusOf(page));}await wait(150);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name)});
// the timeline as the test sees it
const view=()=>page.evaluate(()=>{const t=document.getElementById('director-timeline'),v=t.querySelector('.timeline-viewport'),groups={};
  for(const b of t.querySelectorAll('.lane-group-head [data-action="group-toggle"]'))groups[b.closest('[data-lane-group]').dataset.laneGroup]=b.getAttribute('aria-expanded')==='true';
  return {groups,left:v?.scrollLeft??-1,top:v?.scrollTop??-1,maxTop:v?v.scrollHeight-v.clientHeight:0,width:t.querySelector('.timeline-content')?.getBoundingClientRect().width||0,
    keys:t.querySelectorAll('.camera-key').length,clips:t.querySelectorAll('[data-desk-clip]').length,zoom:t.querySelector('[data-action="zoom-fit"]')?.textContent||''};});
const same=(a,b,what)=>check(JSON.stringify(a.groups)===JSON.stringify(b.groups)&&Math.abs(a.left-b.left)<=2&&Math.abs(a.top-b.top)<=2,`${what}: groups ${JSON.stringify(a.groups)} → ${JSON.stringify(b.groups)}, scroll ${a.left},${a.top} → ${b.left},${b.top}`);
const clickEl=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const toggle=g=>clickEl(`#director-timeline [data-lane-group="${g}"] [data-action="group-toggle"]`);
// a real click in the middle of a timeline element (pointer events: what the editors listen to)
// (an element the timeline's scroll hides is scrolled to first, and that is said: a click must not land on something else)
async function press(sel){const box=await page.evaluate(s=>{const el=document.querySelector(s);if(!el)return null;let r=el.getBoundingClientRect(),moved=false;const v=el.closest('.timeline-viewport');
  if(v){const b=v.getBoundingClientRect(),ruler=v.querySelector('.time-ruler-row')?.offsetHeight||0;if(r.top<b.top+ruler||r.bottom>b.bottom){el.scrollIntoView({block:'center'});r=el.getBoundingClientRect();moved=true;}}
  const at=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(r.height/2,12));return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,12),moved,hit:at===el||el.contains(at)};},sel);
  if(!box)throw Error('no '+sel);if(box.moved)console.log(`note ${sel} was out of the timeline's view: scrolled to it first`);if(!box.hit)console.log(`note the click on ${sel} lands on something on top of it`);
  await page.mouse.click(box.x,box.y);await wait(500);}
const blurAll=()=>page.evaluate(()=>{document.activeElement?.blur?.();});
// a recorder of what moves the timeline's vertical scroll (21 Nov 2026: Windows saw 54 -> 0 around an inspector edit):
// every scrollTop / scrollTo / scrollIntoView / focus that reaches the viewport, with the value asked for, the value that
// stuck and who asked; a FAIL prints the entries since the last mark
const watchScroll=()=>page.evaluate(()=>{
  if(window.__tlScroll)return;const log=window.__tlScroll={step:'',rows:[]};
  const vp=el=>el?.classList?.contains('timeline-viewport')&&el.closest('#director-timeline');
  const who=()=>(new Error().stack||'').split('\n').slice(3,8).map(l=>l.trim().replace(/^at /,'').replace(/\?v=[^:)]*/,'').replace(location.origin,'')).join(' < ');
  const d=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
  Object.defineProperty(Element.prototype,'scrollTop',{configurable:true,get(){return d.get.call(this);},set(v){const was=d.get.call(this);d.set.call(this,v);if(vp(this))log.rows.push({step:log.step,what:'scrollTop=',was,want:Math.round(v),got:d.get.call(this),fresh:!this.__seen,who:who()});this.__seen=true;}});
  for(const [proto,name] of [[Element.prototype,'scrollTo'],[Element.prototype,'scrollIntoView'],[HTMLElement.prototype,'focus']]){const f=proto[name];proto[name]=function(...a){const v=document.querySelector('#director-timeline .timeline-viewport'),was=v?.scrollTop;const r=f.apply(this,a);const got=v?.scrollTop;if(v&&(vp(this)||v.contains(this))&&was!==got)log.rows.push({step:log.step,what:name+(vp(this)?'':' (inside)'),was,got,arg:JSON.stringify(a[0]??null),who:who()});return r;};}
  addEventListener('scroll',e=>{const v=e.target;if(vp(v)&&v.__last!==v.scrollTop){log.rows.push({step:log.step,what:'scroll event',was:v.__last??null,got:v.scrollTop});v.__last=v.scrollTop;}},true);
  // each frame: which viewport element, its top, its size and whether it is shown (a reset with no event or write shows here)
  const ids=new WeakMap();let nextId=1;log.last='';
  const sample=()=>{const v=document.querySelector('#director-timeline .timeline-viewport');if(v&&!ids.has(v))ids.set(v,nextId++);
    const now=v?`#${ids.get(v)} top ${v.scrollTop} max ${v.scrollHeight-v.clientHeight} h ${v.clientHeight} ${v.getClientRects().length?'shown':'NOT SHOWN'}${v.isConnected?'':' detached'}`:'no viewport';
    if(now!==log.last){log.rows.push({step:log.step,what:'frame',was:log.last||'(step start)',got:now});log.last=now;}requestAnimationFrame(sample);};requestAnimationFrame(sample);
  // class / hidden / style changes on the viewport or anything around it (body, the timeline, the lane groups)
  new MutationObserver(list=>{const v=document.querySelector('#director-timeline .timeline-viewport');for(const m of list){const t=m.target;if(!(t===document.body||t===document.documentElement||(v&&t.contains?.(v))))continue;
    const name=t.id?'#'+t.id:t===document.body?'body':t===document.documentElement?'html':t.tagName.toLowerCase()+'.'+String(t.className).split(' ')[0];
    log.rows.push({step:log.step,what:'attr '+m.attributeName+' on '+name,was:String(m.oldValue??'').slice(0,90),got:String(t.getAttribute(m.attributeName)??'').slice(0,90)});}})
    .observe(document.documentElement,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','hidden','style']});
});
// the page as it is (on a FAIL or a timeout): the focus, open dialogs, the body's classes, and a screenshot
let failShots=0;
const pageState=async what=>{const st=await page.evaluate(()=>{const a=document.activeElement;return {focus:a?(a.tagName.toLowerCase()+(a.id?'#'+a.id:'')+(a.name?`[name=${a.name}]`:'')+(a.className&&typeof a.className==='string'?'.'+a.className.split(' ').slice(0,2).join('.'):'')):'none',
  dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id||d.className||'dialog'),body:document.body.className};}).catch(e=>({error:e.message}));
  const file=`fail-${String(++failShots).padStart(2,'0')}.png`;await shot(file).catch(()=>{});console.log(`     page: ${JSON.stringify(st)} · screenshot ${path.join(SHOTS,file)}${what?' · '+what:''}`);};
const mark=step=>page.evaluate(s=>{const l=window.__tlScroll;if(l){l.step=s;l.rows=l.rows.filter(r=>r.step===s);l.last='';}},step);   // (the next frame logs where the step starts)
const scrollLog=()=>page.evaluate(()=>window.__tlScroll?.rows||[]);
const sameLogged=async(a,b,what)=>{const ok=same(a,b,what);if(!ok){for(const r of await scrollLog())console.log('     scroll log ['+r.step+'] '+r.what+(r.want!=null?' want '+r.want:'')+(r.arg?' '+r.arg:'')+': '+r.was+' -> '+r.got+(r.fresh?' (new viewport)':'')+(r.who?'  · '+r.who:''));await pageState();}return ok;};
try{
  await openChapter(page,base,chapter);await watchScroll();
  // ---- 1
  const v0=await view();
  check(Object.keys(v0.groups).length>=2&&Object.values(v0.groups).every(o=>!o),'1. first load: every group folded: '+JSON.stringify(v0.groups));
  await shot('01-first-load.png');
  // ---- 2 open Motion and Lighting (People / Props when the chapter has them), leave the rest folded; scroll down a bit
  for(const g of ['motion','lighting','people'])if(g in v0.groups){await toggle(g);await wait(300);}
  await page.evaluate(()=>{const v=document.querySelector('#director-timeline .timeline-viewport');const cam=document.querySelector('#director-timeline .camera-lane-row');const ruler=document.querySelector('#director-timeline .time-ruler-row').offsetHeight;
    v.scrollTop=Math.max(0,Math.min(v.scrollHeight-v.clientHeight,cam.offsetTop-ruler-6));});
  await wait(500);
  const v1=await view();check(v1.keys>=2,`2. the chapter has ${v1.keys} camera keys, ${v1.clips} desk moves; scroll top ${v1.top} of ${v1.maxTop}`);
  // a click on a visible key: nothing moves
  await press('#director-timeline .camera-key:nth-of-type(2)');
  await press('#director-timeline .camera-key[aria-pressed="true"]');
  const v2=await view();same(v1,v2,'2. a click on a visible camera key leaves the timeline as it was');
  // ---- 3 Delete with the focus lost
  await blurAll();await page.keyboard.press('Delete');
  const v3=await until(async()=>{const v=await view();return v.keys===v2.keys-1?v:null;},'Delete removes the camera key').catch(e=>{check(false,'3. '+e.message);return null;});
  if(v3){check(true,`3. Delete removed the selected camera key (${v2.keys} → ${v3.keys})`);same(v2,v3,'3. after Delete');}
  await shot('02-after-delete.png');
  await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');
  const v4=await until(async()=>{const v=await view();return v.keys===v2.keys?v:null;},'Ctrl+Z brings it back').catch(e=>{check(false,'3. '+e.message);return null;});
  if(v4){check(true,'3. Ctrl+Z brought the key back');same(v2,v4,'3. after Ctrl+Z');}
  // Backspace while typing: the text, never the key; then a committed inspector edit and its undo. The scroll is
  // checked after every sub-step (each one rebuilds the timeline by a different path), with the scroll log on a FAIL.
  await mark('3. click a key');await press('#director-timeline .camera-key:nth-of-type(2)');await sameLogged(v2,await view(),'3. a click on a camera key after the undo');
  const label=await page.$('#director-panel [name="key-label"]');
  if(check(!!label,'3. the camera key\'s name field is in the inspector')){
    await mark('3. click the name field');await label.click({clickCount:1});await wait(300);await sameLogged(v2,await view(),'3. a click into the inspector\'s name field');
    await page.keyboard.press('End');const before=await page.$eval('#director-panel [name="key-label"]',e=>e.value);
    await mark('3. Backspace in the field');await page.keyboard.press('Backspace');await wait(400);
    const after=await page.$eval('#director-panel [name="key-label"]',e=>e.value).catch(()=>null),v5=await view();
    check(v5.keys===v2.keys&&after===before.slice(0,-1),`3. Backspace in the name field edits the text ("${before}" → "${after}"), the key stays (${v5.keys})`);
    await sameLogged(v2,v5,'2. after typing in the inspector (Backspace in the name field)');
    // Escape in the field leaves the field, never the Director (before: player.mjs closed the whole Director from here)
    await mark('3. Escape and blur');await page.keyboard.press('Escape');await wait(200);
    const esc=await page.evaluate(()=>({directing:document.body.classList.contains('directing'),inField:document.activeElement?.name==='key-label'}));
    check(esc.directing&&!esc.inField,`3. Escape in the name field leaves the field (${esc.inField?'still in it':'left'}) and the Director stays open (${esc.directing?'open':'CLOSED'})`);
    await blurAll();await wait(300);await sameLogged(v2,await view(),'2. after Escape and a blur');
    // an inspector edit that commits (the name field commits on input; change as well, as a real edit ends)
    await mark('2. inspector edit');
    await page.$eval('#director-panel [name="key-label"]',e=>{e.value='Timeline e2e';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}).catch(()=>{});await wait(500);
    check(await page.$eval('#director-timeline .camera-key[aria-pressed="true"]',b=>b.getAttribute('aria-label')).then(t=>t.includes('Timeline e2e')).catch(()=>false),'2. the inspector edit reached the key (its timeline label is "Timeline e2e")');
    await sameLogged(v2,await view(),'2. after an inspector edit');
    // (each one checked to have happened: the name on the key's timeline label)
    const named=()=>page.$$eval('#director-timeline .camera-key',bs=>bs.some(b=>b.getAttribute('aria-label').includes('Timeline e2e'))).catch(()=>null);
    await mark('2. undo');await blurAll();await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await wait(500);
    check(await named()===false,'2. Ctrl+Z undid the inspector edit');await sameLogged(v2,await view(),'2. after undoing it');
    await mark('2. redo');await page.keyboard.down('Control');await page.keyboard.press('KeyY');await page.keyboard.up('Control');await wait(500);
    check(await named()===true,'2. Ctrl+Y redid it');await sameLogged(v2,await view(),'2. after redoing it');
    await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await wait(300);
    check(await named()===false,'2. Ctrl+Z undid it again (the later steps start without the edit)');
  }
  // desk move: Backspace with the focus lost, then undo
  if(v2.clips){
    await press('#director-timeline [data-desk-clip]');await blurAll();const c0=(await view()).clips;await page.keyboard.press('Backspace');
    await until(async()=>(await view()).clips===c0-1,'Backspace removes the desk move').then(()=>check(true,'3. Backspace removed the selected desk move')).catch(e=>check(false,'3. '+e.message));
    await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await until(async()=>(await view()).clips===c0,'undo the move');
  }else console.log('note no desk move in this chapter: the desk move checks are skipped');
  // ---- 4 the selection header's 🗑
  const bin='#director-panel [data-action="sel-tool"][data-section="delete"]';
  await press('#director-timeline .camera-key:nth-of-type(2)');
  if(check(!!await page.$(bin),'4. the selection header has its 🗑 for a camera key')){
    const k0=(await view()).keys,b0=await view();await clickEl(bin);
    await until(async()=>(await view()).keys===k0-1,'🗑 removes the camera key').then(()=>check(true,'4. 🗑 deleted the camera key')).catch(e=>check(false,'4. '+e.message));
    same(b0,await view(),'4. after 🗑');
    await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await until(async()=>(await view()).keys===k0,'undo the 🗑');
  }
  if(v2.clips){
    await press('#director-timeline [data-desk-clip]');const c0=(await view()).clips;
    if(check(!!await page.$(bin),'4. the selection header has its 🗑 for a desk move')){
      await clickEl(bin);
      await until(async()=>(await view()).clips===c0-1,'🗑 removes the desk move').then(()=>check(true,'4. 🗑 deleted the desk move (before: nothing happened)')).catch(e=>check(false,'4. '+e.message));
      await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await until(async()=>(await view()).clips===c0,'undo the move');
    }
  }
  // ---- 5 zoom
  const z0=await view();
  for(let i=0;i<3;i++){await clickEl('#director-timeline [data-action="zoom-in"]');await wait(250);}
  const z1=await view();check(z1.width>z0.width*3,`5. + three times: the lanes ${Math.round(z0.width)} → ${Math.round(z1.width)} px (${z1.zoom})`);
  await blurAll();await page.keyboard.press('Equal');await wait(300);const z2=await view();check(z2.width>z1.width*1.2,`5. '=' zooms in (${z2.zoom})`);
  await page.keyboard.press('Minus');await wait(300);const z3=await view();check(z3.width<z2.width/1.2,`5. '-' zooms out (${z3.zoom})`);
  // Ctrl+wheel at a point: the time under the pointer stays, within a frame (the time = the ruler's fraction × the
  // chapter's seconds; the lanes' labels are not time, so the content's fraction was the wrong measure)
  const rulerAt=x=>page.evaluate(x=>{const r=document.querySelector('#director-timeline .time-ruler').getBoundingClientRect(),c=document.querySelector('#director-timeline .timeline-content').getBoundingClientRect(),s=Number(document.querySelector('#director-timeline [name="timeline-seconds"]').max);return {t:(x-r.left)/r.width*s,width:c.width};},x);
  const at=await page.evaluate(()=>{const v=document.querySelector('#director-timeline .timeline-viewport'),r=v.getBoundingClientRect();return {x:r.left+150+(r.width-150)*.6,y:r.top+40};});
  const before=await rulerAt(at.x);
  await page.mouse.move(at.x,at.y);await page.keyboard.down('Control');await page.mouse.wheel({deltaY:-240});await page.keyboard.up('Control');await wait(400);
  const after=await rulerAt(at.x);
  check(after.width>z3.width*1.3&&Math.abs(after.t-before.t)<1/30,`5. Ctrl+wheel zooms at the pointer (${Math.round(z3.width)} → ${Math.round(after.width)} px; the time under it ${before.t.toFixed(3)} → ${after.t.toFixed(3)} s, ${(Math.abs(after.t-before.t)*1000).toFixed(1)} ms)`);
  // the most zoom
  for(let i=0;i<30;i++){const off=await page.$eval('#director-timeline [data-action="zoom-in"]',b=>b.disabled);if(off)break;await clickEl('#director-timeline [data-action="zoom-in"]');await wait(150);}
  const zmax=await view(),seconds=await page.evaluate(()=>Number(document.querySelector('#director-timeline [name="timeline-seconds"]').max));
  check(zmax.width/seconds/30>=30,`5. the most zoom: ${(zmax.width/seconds/30).toFixed(1)} px a frame (a camera key is 30 px wide)`);
  await shot('03-most-zoom.png');
  // back to a middle zoom, a scroll position, then reload
  await clickEl('#director-timeline [data-action="zoom-fit"]');await wait(250);for(let i=0;i<4;i++){await clickEl('#director-timeline [data-action="zoom-in"]');await wait(200);}
  await page.evaluate(()=>{const v=document.querySelector('#director-timeline .timeline-viewport');v.scrollLeft=Math.round((v.scrollWidth-v.clientWidth)*.4);v.scrollTop=Math.round((v.scrollHeight-v.clientHeight)*.5);});
  await wait(900);const r0=await view();
  // ---- 6
  await page.reload();await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(2500);
  const r1=await view();
  check(JSON.stringify(r0.groups)===JSON.stringify(r1.groups),'6. reload: the same groups open / folded: '+JSON.stringify(r1.groups));
  check(r0.zoom===r1.zoom&&Math.abs(r0.width-r1.width)<2,`6. reload: the same zoom (${r0.zoom} → ${r1.zoom})`);
  check(Math.abs(r0.left-r1.left)<=2&&Math.abs(r0.top-r1.top)<=2,`6. reload: the same scroll (${r0.left},${r0.top} → ${r1.left},${r1.top})`);
  await shot('04-after-reload.png');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await shot('99-failed.png').catch(()=>{});check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL timeline state e2e: ${failures.length} (shots in ${SHOTS})`:`PASS timeline state e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
