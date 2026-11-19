// "Add to desks" end to end (18 Nov 2026, real GPU Chrome, chapter oilers of the Cinematographer's cut: the High school).
// Vico: add a prop and choose which desks it belongs to, and where on each desk: Foot shelf, Desktop, Tilt, Desktop shelf.
//   1. Props tab "+ Add prop" -> "Put it: On desks…": one row per desk (the featured desk and every room desk), each
//      with a mount menu in Vico's words that lists exactly the mounts that desk's rig has (Desktop: where it has a base
//      shelf for the lift frame), each option with a tooltip
//   2. the featured desk on Tilt, room desks on Foot shelf / Desktop / Desktop shelf; Enter adds: one add entry per
//      desk (on: the room desk, parent: the mount), each object on that desk's own mount (Desktop: the level lift frame
//      on its base shelf, at its desktop's height), all selected together; Undo takes all of them away in one step,
//      Redo brings them back
//   3. an item on a room desk hidden (inside the desk, Delete)
//   4. Render still: the still renderer's stage has every added prop on the same desk and mount, and the hidden item
//      is not drawn
//   5. the render path: a fresh stage booted as render-still.cjs boots it (prepare, film-fx install) with the chapter's
//      film shot and the Director's edits: the same
//   node tests/director-add-to-desks-e2e.mjs        (CUT=<cut dir>; SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';
import {mergePropEdits} from '../experience/prop-edits.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='oilers'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`add to desks e2e: skipped (${CUT} has no oilers chapter page here).`);process.exit(0);}
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
const AT=Math.min(4,chapter.seconds/2);   // the playhead (s)
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'add-to-desks-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,browser,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const VICO={'base-shelf':'Foot shelf',lift:'Desktop',desk:'Tilt',shelf:'Desktop shelf','lower-shelf':'Desktop shelf (lower)'};
// (in any stage window: where an added prop is, by name, and whether a path's object is drawn)
const PROBE=`
  window.__root=w=>{let s=w.ErgoFlex.loadedModel;while(s?.parent)s=s.parent;return s;};
  window.__pathOf=(o,root)=>{const out=[];for(let p=o;p&&p!==root;p=p.parent)out.unshift(p.name||p.type);return out.join(' > ');};
  window.__where=(w,name)=>{const root=__root(w);let o=null;root.traverse(x=>{if(!o&&x.name===name)o=x;});if(!o)return null;
    let desk=null;for(let p=o;p;p=p.parent)if(p.userData?.sceneDeskId&&p.userData?.sceneDeskManaged){desk=p.userData.sceneDeskId;break;}
    let shown=true;for(let p=o;p;p=p.parent)if(!p.visible)shown=false;const v=o.getWorldPosition(o.position.clone());
    return {parent:o.parent?.name||'',grand:o.parent?.parent?.name||'',desk,shown,y:v.y,path:__pathOf(o,root)};};
  window.__drawn=(w,path)=>{const root=__root(w);let hit=null;root.traverse(x=>{if(!hit&&__pathOf(x,root)===path)hit=x;});if(!hit)return 'absent';for(let p=hit;p;p=p.parent)if(!p.visible)return 'hidden';return 'drawn';};`;
await page.evaluateOnNewDocument(new Function(`
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,api:w.ErgoFlex};};
  window.__still=()=>[...document.querySelectorAll('iframe')].find(f=>f.title==='Film still renderer')?.contentWindow||null;
  ${PROBE}
  // the mounts a desk really has (what the menu must list): its rig's, the featured desk's accessory mounts
  window.__mounts=id=>{const {w,api}=__t(),E=w.__filmEdits,has=k=>!!E.addParent(k==='lift'?'base-shelf':k,id||null);return ['base-shelf','lift','desk','shelf','lower-shelf'].filter(has);};
  window.__desktopY=id=>{const {w}=__t(),m=w.__filmEdits.addParent('desk',id||null);m.updateWorldMatrix(true,false);return m.getWorldPosition(m.position.clone()).y;};
`));
const draftProps=()=>page.evaluate(()=>window.__directorShot?.()?.propEdits||[]);
const blur=()=>page.evaluate(()=>{document.activeElement?.blur?.();window.focus();});
const key=async(k,mod)=>{await blur();if(mod)await page.keyboard.down(mod);await page.keyboard.press(k);if(mod)await page.keyboard.up(mod);await wait(1200);};
try{
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>__t().api.sceneDesks?.records?.size>1&&!!__t().w.__filmEdits),'the High school\'s desks and the film edits layer',120000).catch(async()=>{
    // (the edits layer loads with the Props editor: open the tab once)
    await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="props"]')?.click());
    await until(()=>page.evaluate(()=>!!__t().w.__filmEdits),'the film edits layer',60000);});
  await seek(page,AT);await wait(1500);
  // ---- 1. the library's On desks…
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="props"]')?.click());await wait(600);
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=pp-add]').click());
  await until(()=>page.evaluate(()=>document.querySelectorAll('#prop-library .pl-card').length>100),'the library grid',60000);
  await page.evaluate(()=>{const r=document.querySelector('#prop-library [name=pl-where][value=desks]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));});await wait(300);
  const rows=await page.$$eval('#prop-library [data-pl-desk]',l=>l.map(r=>({desk:r.dataset.plDesk,name:r.querySelector('label').textContent.trim(),ticked:r.querySelector('[name=pl-desk]').checked,
    options:[...r.querySelectorAll('option')].map(o=>({kind:o.value,label:o.textContent,tip:o.title}))})));
  const desks=await page.evaluate(()=>{const sd=__t().api.sceneDesks;return [...sd.records.values()].filter(r=>r.id!==sd.selected&&r.group&&!r.layersHidden).map(r=>r.id);});
  check(rows.length===desks.length+1&&rows[0].desk===''&&rows[0].ticked,`one row per desk: the featured desk (ticked) and the ${desks.length} room desks (${rows.map(r=>r.name).join(' · ')})`);
  for(const r of rows){
    const want=await page.evaluate(id=>__mounts(id),r.desk||null),got=r.options.map(o=>o.kind);
    check(JSON.stringify(got)===JSON.stringify(want)&&r.options.every(o=>o.label===VICO[o.kind]&&o.tip.length>20),`${r.name}: the menu lists exactly its mounts, in Vico's words with tooltips (${r.options.map(o=>o.label).join(' / ')})`);
  }
  // the featured desk on Tilt; room desks on Foot shelf, Desktop, Desktop shelf (each the first desk that has it)
  const plan=[{desk:'',kind:'desk'}],used=new Set();
  for(const kind of ['base-shelf','lift','shelf']){const r=rows.find(r=>r.desk&&!used.has(r.desk)&&r.options.some(o=>o.kind===kind));if(r){used.add(r.desk);plan.push({desk:r.desk,kind});}}
  check(plan.length>=3,`a plan over ${plan.length} desks: ${plan.map(p=>(p.desk||'featured')+' · '+VICO[p.kind]).join(', ')}`);
  await page.evaluate(plan=>{for(const p of plan){const row=document.querySelector(`#prop-library [data-pl-desk="${p.desk}"]`),box=row.querySelector('[name=pl-desk]'),sel=row.querySelector('[name=pl-mount]');
    if(!box.checked){box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));}sel.value=p.kind;sel.dispatchEvent(new Event('change',{bubbles:true}));}},plan);
  await page.focus('#prop-library [name=pl-search]');await page.keyboard.type('backpack');await wait(500);
  const first=await page.$eval('#prop-library .pl-card[aria-selected=true]',e=>e.title);check(/backpack/i.test(first),'the search finds the backpack: '+first);
  const before=await draftProps();await shot('1-on-desks');
  await page.keyboard.press('Enter');
  // ---- 2. one entry per desk, each on its own desk's mount
  const adds=await until(async()=>{const a=(await draftProps()).filter(e=>e.add&&!before.some(b=>b.id===e.id));return a.length>=plan.length&&a;},'the add entries',20000);
  for(const p of plan){const e=adds.find(x=>(x.on||'')===p.desk);check(!!e&&e.parent===p.kind,`${p.desk||'featured desk'}: an add entry on ${VICO[p.kind]} (${e?JSON.stringify({on:e.on,parent:e.parent}):'none'})`);}
  await until(()=>page.evaluate(ids=>ids.every(id=>{let f=false;__t().t.scene.traverse(x=>{if(x.name.endsWith('#'+id))f=true;});return f;}),adds.map(a=>a.id)),'the backpacks on the stage',30000);
  const live={};
  for(const e of adds){
    const w=await page.evaluate(n=>__where(__t().w,n),`Added prop:${e.add.asset}#${e.id}`);live[e.id]=w;
    const mount=e.parent==='lift'?w?.grand:w?.parent,role=e.parent==='lift'||e.parent==='base-shelf'?'base-shelf':e.parent==='desk'?'desktop':e.parent;
    check(!!w&&(e.on?w.desk===e.on:!w.desk||w.desk==='main'),`${e.on||'featured'}: the object is on that desk (${w?.desk||'featured'})`);
    check(!!w&&new RegExp(`(Desk dressing|Accessory mount|Scene dressing):${role}$`).test(mount)&&(e.parent!=='lift'||w.parent==='Desk lift frame (film)'),`${e.on||'featured'}: on its ${VICO[e.parent]} mount (${w?.path?.split(' > ').slice(-3).join(' > ')})`);
    if(e.parent==='lift'){const y=await page.evaluate(id=>__desktopY(id),e.on||null);check(Math.abs(w.y-y)<.03,`${e.on}: Desktop is at the desktop's height (prop ${w.y.toFixed(3)}, desktop ${y.toFixed(3)})`);}
  }
  const sel=await page.evaluate(()=>window.__directorProps?.().keys.length||0);check(sel===adds.length,`all ${adds.length} selected together (${sel})`);
  await shot('2-added');
  await key('z','Control');
  check((await draftProps()).filter(e=>adds.some(a=>a.id===e.id)).length===0,'one Undo takes all of them away');
  await key('y','Control');
  check((await draftProps()).filter(e=>adds.some(a=>a.id===e.id)).length===adds.length,'Redo brings them all back');
  await until(()=>page.evaluate(ids=>ids.every(id=>{let f=false;__t().t.scene.traverse(x=>{if(x.name.endsWith('#'+id))f=true;});return f;}),adds.map(a=>a.id)),'the backpacks back on the stage',30000);
  // ---- 3. an item on a room desk hidden: Layers row (enters the desk), Delete
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="layers"]')?.click());
  const row=await until(()=>page.evaluate(()=>{const r=[...document.querySelectorAll('#director-panel [data-ly-group^="room-desk:"] [data-ly-item]')].find(r=>!/Added prop:/.test(r.dataset.lyItem)&&!r.classList.contains('is-hidden'));return r?r.dataset.lyItem:null;}),'a room desk item row',30000);
  await page.evaluate(k=>{const r=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);(r.querySelector('.layer-name')||r).click();},row);await wait(800);
  const hiddenPath=await page.evaluate(()=>{const o=window.__directorProps().object;return o?__pathOf(o,__root(__t().w)):null;});
  check(!!hiddenPath&&(await page.evaluate(()=>window.__directorProps().inside))?.id,`the row selects the item inside its desk (${hiddenPath?.split(' > ').slice(-2).join(' > ')})`);
  await key('Delete');await wait(2000);
  check(await page.evaluate(p=>__drawn(__t().w,p),hiddenPath)==='hidden','Delete hides it on the live stage');
  await key('Escape');await key('Escape');
  // ---- 4. Render still
  await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
  await until(async()=>/Still rendered/.test(await statusOf(page)),'Render still',300000);await wait(500);await shot('3-still');
  for(const e of adds){const w=await page.evaluate(n=>{const s=__still();return s?__where(s,n):null;},`Added prop:${e.add.asset}#${e.id}`);
    check(!!w&&w.path===live[e.id].path&&w.shown,`Render still: ${e.on||'featured'}'s backpack on the same desk and mount (${w?w.path.split(' > ').slice(-3).join(' > '):'missing'})`);}
  check(await page.evaluate(p=>{const s=__still();return s?__drawn(s,p):'no still';},hiddenPath)!=='drawn','Render still: the hidden item is not drawn');
  // ---- 5. the render path: a fresh stage as render-still.cjs boots it, with the Director's edits
  const shotNow=await page.evaluate(()=>window.__directorShot());
  const filmShot={...film,...mergePropEdits(film,shotNow),...(shotNow.deskEdits?{sceneDeskEdits:shotNow.deskEdits}:{})};
  const p2=await browser.newPage();await p2.evaluateOnNewDocument(new Function(PROBE));
  await p2.goto(base+'/experience/experience.css');
  await p2.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
  const fr=await (await p2.waitForSelector('#s')).contentFrame();
  await fr.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
  await fr.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});
  await fr.evaluate(async s=>{window.__filmFx?.clear();window.__filmFx?.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx?.unhookPreset();}},filmShot);
  await fr.evaluate(s=>window.__filmFx.install(s),filmShot);
  // the frame at the Director's playhead, as render-still.cjs renders a still (the props added there show from it on)
  await fr.evaluate(async(t,T)=>{await window.__filmFx.frame(t,T);},AT,filmShot.seconds);await wait(1500);
  for(const e of adds){const w=await p2.evaluate(n=>__where(document.getElementById('s').contentWindow,n),`Added prop:${e.add.asset}#${e.id}`);
    check(!!w&&w.path===live[e.id].path&&w.shown,`render path: ${e.on||'featured'}'s backpack on the same desk and mount (${w?w.path.split(' > ').slice(-3).join(' > '):'missing'})`);}
  check(await p2.evaluate(p=>__drawn(document.getElementById('s').contentWindow,p),hiddenPath)!=='drawn','render path: the hidden item is not drawn');
  await p2.close();
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);await shot('fail');}
finally{console.log('screenshots in '+SHOTS+' · status: '+await statusOf(page).catch(()=>''));await close();}
check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('add to desks e2e: a prop added to several desks sits on each desk\'s chosen mount, live, in Render still and on the render path.');
