// Camera transitions in the Director (20 Nov 2026; real GPU Chrome, the Cinematographer's cut, default the "create" chapter,
// whose film plan has a cut).
//   1. the film plan's cut shows: a ✂ on the camera lane, "Cut" in the key's Inspector row
//   2. Inspector: Dissolve on another key -> a band on the lane, the Length field, the "still frame" and "renders as a cut"
//      notes; Ctrl+Z takes it away, Ctrl+Shift+Z brings it back
//   3. dragging the band's end edge changes the length (one undo step)
//   4. preview: inside the dissolve the stage shows the other view's still frame (opacity between 0 and 1); a dip to black
//      is a black layer, full at the key
//   5. Export cut carries the key's transition; Delete on the band takes it back to a move
//   2b/6 (20 Nov 2026): the key before shows the same segment as "To the next view", the lane segment is labelled, no Move
//      style in a film chapter; a cut into a copy of the view warns "This cut jumps to the same view" (Inspector and lane)
//   node tests/director-camera-transitions-e2e.mjs        (CUT=<cut dir>, CHAPTER=<id>, SHOTS=<dir>)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine',ID=process.env.CHAPTER||'create';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id===ID):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`camera transitions e2e: skipped (${CUT} has no ${ID} chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'camera-transitions-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(150);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name)});
const keysNow=()=>page.evaluate(()=>[...document.querySelectorAll('#director-timeline .camera-key')].map(b=>b.dataset.key));
const pick=id=>page.evaluate(id=>{const s=document.querySelector('#director-panel [name="camera-key"]');s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));},id);
const setSel=(name,v)=>page.evaluate((n,v)=>{const s=document.querySelector(`#director-panel [name="${n}"]`);if(!s)throw Error('no '+n);s.value=String(v);s.dispatchEvent(new Event('change',{bubbles:true}));},name,v);
const overlay=()=>page.evaluate(()=>{const d=document.getElementById('stage').contentDocument,l=d.querySelector('[data-camera-transition]'),c=d.querySelector('[data-camera-transition-frame]');
  return {layer:l?{shown:l.style.display!=='none',opacity:Number(l.style.opacity),bg:l.style.background}:null,frame:c?{shown:c.style.display!=='none',opacity:Number(c.style.opacity),w:c.width}:null};});
const keyChord=async(...k)=>{for(const x of k.slice(0,-1))await page.keyboard.down(x);await page.keyboard.press(k.at(-1));for(const x of k.slice(0,-1).reverse())await page.keyboard.up(x);await wait(500);};
try{
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(t));return make.call(this,b);};});
  await openChapter(page,base,chapter);
  // open the Motion group if it is folded (the camera lane lives there)
  await page.evaluate(()=>{const b=document.querySelector('#director-timeline [data-lane-group="motion"] [data-action="group-toggle"]');if(b?.getAttribute('aria-expanded')==='false')b.click();});await wait(400);
  const ids=await keysNow();check(ids.length>=3,`the chapter has ${ids.length} camera keys`);
  // ---- 1
  const cuts=await page.$$eval('#director-timeline .cam-cut',l=>l.length);check(cuts>=1,`1. the film plan's cut shows on the lane (${cuts} ✂)`);
  let cutKey=null;for(const id of ids.slice(1)){await pick(id);await wait(250);if(await page.$eval('#director-panel [name="key-transition"]',s=>s.value).catch(()=>null)==='cut'){cutKey=id;break;}}
  check(!!cutKey,'1. its key\'s Inspector row says Cut ('+cutKey+')');
  // ---- 2 a dissolve on a key with room (the middle of the chapter, not the cut key)
  // the key with the most room either side (create's 2.35 s key sits 0.05 s before the 2.4 s cut: only 0.1 s fits there,
  // so its dissolve was clamped to 0.1 s and the edge could not grow it; Windows, 20 Nov 2026)
  const target=await page.evaluate(cut=>{const k=[...document.querySelectorAll('#director-timeline .camera-key')].map(b=>({id:b.dataset.key,x:parseFloat(b.style.left)}));
    let best=null,room=-1;for(let i=1;i<k.length-1;i++){if(k[i].id===cut||k[i+1].id===cut)continue;const r=Math.min(k[i].x-k[i-1].x,k[i+1].x-k[i].x);if(r>room){room=r;best=k[i].id;}}return best;},cutKey);
  check(!!target,'2. a key with room for a dissolve: '+target);await pick(target);await wait(300);
  await setSel('key-transition','dissolve');
  const band=await until(()=>page.$(`#director-timeline [data-cam-transition="${target}"]`),'the dissolve band');
  const dur0=Number(await page.$eval('#director-panel [name="key-transition-dur"]',e=>e.value));
  const notes=await page.$eval('#director-panel [data-camera-transition]',e=>e.parentElement.textContent);
  check(!!band&&dur0>0,`2. Dissolve: a band on the lane, Length ${dur0} s`);
  check(/frozen here/.test(notes)&&/plain cut until the render side/.test(notes),'2. the notes: a still frame in the preview, a plain cut in the film for now');
  await shot('01-dissolve-band.png');
  // 2b. (20 Nov 2026) one control per segment: the key before shows the same dissolve as "To the next view"; the lane
  // segment says so; a film chapter has no Move style / Camera route (the film's spline) and says why
  {const prev=ids[ids.indexOf(target)-1];await pick(prev);await wait(300);
    check(await page.$eval('#director-panel [name="key-transition-next"]',s=>s.value).catch(()=>null)==='dissolve','2b. the key before shows it as "To the next view: Dissolve"');
    check(!await page.$('#director-panel [name="key-easing"]')&&!await page.$('#director-panel [name="key-path"]')&&!!await page.$('#director-panel [data-film-spline]'),'2b. film chapter: no Move style or Camera route, and the reason');
    const seg=await page.$eval(`#director-timeline [data-camera-segment-lane="${ids.indexOf(target)-1}"] i`,e=>e.textContent).catch(()=>'');check(/^Dissolve /.test(seg),'2b. the lane segment reads "'+seg+'"');
    await pick(target);await wait(300);}
  await page.evaluate(()=>document.activeElement?.blur?.());await keyChord('Control','KeyZ');
  check(!await page.$(`#director-timeline [data-cam-transition="${target}"]`),'2. Ctrl+Z takes the dissolve away');
  await keyChord('Control','Shift','KeyZ');check(!!await page.$(`#director-timeline [data-cam-transition="${target}"]`),'2. Ctrl+Shift+Z brings it back');
  // ---- 3 drag the end edge out
  const edge=await page.$eval(`#director-timeline [data-cam-transition="${target}"] [data-ct-edge="end"]`,e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.move(edge.x,edge.y);await page.mouse.down();await page.mouse.move(edge.x+25,edge.y,{steps:5});await page.keyboard.down('Alt');await page.mouse.move(edge.x+30,edge.y,{steps:2});await page.mouse.up();await page.keyboard.up('Alt');await wait(500);
  await pick(target);await wait(300);const dur1=Number(await page.$eval('#director-panel [name="key-transition-dur"]',e=>e.value));
  check(dur1>dur0,`3. dragging the end edge: ${dur0} → ${dur1} s`);
  if(dur1>dur0){   // (only undo what the drag did: with no commit, Ctrl+Z would take the dissolve itself away)
    await page.evaluate(()=>document.activeElement?.blur?.());await keyChord('Control','KeyZ');await pick(target);await wait(300);
    check(Math.abs(Number(await page.$eval('#director-panel [name="key-transition-dur"]',e=>e.value).catch(()=>NaN))-dur0)<1e-6,'3. one undo step puts the length back');
  }
  // ---- 4 preview
  const t=await page.evaluate(id=>{const sel=document.querySelector('#director-panel [name="key-time"]');return Number(sel.value);},target);
  await seek(page,t-dur0/4);const o1=await overlay();
  check(o1.frame?.shown&&o1.frame.opacity>0&&o1.frame.opacity<1&&o1.frame.w>0,`4. inside the dissolve: the other view's still frame over the stage (opacity ${o1.frame?.opacity})`);
  await shot('02-dissolve-preview.png');
  await seek(page,t-dur0);const o0=await overlay();check(!o0.frame?.shown&&!o0.layer?.shown,'4. outside it: nothing over the stage');
  await setSel('key-transition','dip-black');await wait(500);await seek(page,t);const o2=await overlay();
  check(o2.layer?.shown&&o2.layer.opacity>.95&&/0, 0, 0|#000/.test(o2.layer.bg),`4. a dip to black: a black layer, full at the key (${o2.layer?.opacity})`);
  await shot('03-dip-black.png');
  // ---- 5 export, then Delete on the band
  await page.evaluate(()=>{const b=document.querySelector('#director-appbar [data-action="save-export"]')||document.querySelector('[data-action="export"]');b?.click();});
  const sent=await until(()=>page.evaluate(()=>window.__exports.at(-1)||null),'the export',20000).catch(()=>null);
  const k=sent?JSON.parse(sent).shots[0].camera?.keys?.find(x=>x.id===target):null;
  check(k?.transition?.type==='dip-black'&&k.transition.dur>0,'5. Export cut carries the key\'s transition: '+JSON.stringify(k?.transition));
  await page.focus(`#director-timeline [data-cam-transition="${target}"]`);await page.keyboard.press('Delete');await wait(500);
  check(!await page.$(`#director-timeline [data-cam-transition="${target}"]`),'5. Delete on the band: back to a move');
  // ---- 6 a cut to the same view warns: Duplicate a key (same view, half way to the next), cut into the copy
  {await pick(target);await wait(300);await page.evaluate(()=>document.activeElement?.blur?.());await keyChord('Control','KeyD');   // (the roomy key: create's 2.35 s key would put its copy 0.025 s from the cut)
    const now=await keysNow(),copyId=now.find(id=>!ids.includes(id));
    if(check(!!copyId,'6. Ctrl+D made a copy of the view')){await pick(copyId);await wait(300);await setSel('key-transition','cut');
      const warn=await page.$eval('#director-panel [data-transition-warn]',e=>e.textContent).catch(()=>'');
      const mark=await page.$(`#director-timeline [data-camera-segment-lane="${(await keysNow()).indexOf(copyId)-1}"] .seg-warn-mark`);
      check(/This cut jumps to the same view/.test(warn)&&!!mark,'6. "This cut jumps to the same view" in the Inspector and a ⚠ on the lane');
      await page.evaluate(()=>document.activeElement?.blur?.());await keyChord('Control','KeyZ');await keyChord('Control','KeyZ');}}
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await shot('99-failed.png').catch(()=>{});check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL camera transitions e2e: ${failures.length} (shots in ${SHOTS})`:`PASS camera transitions e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
