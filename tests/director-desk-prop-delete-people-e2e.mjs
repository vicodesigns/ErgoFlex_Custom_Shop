// Deleting a desk prop never changes a person (18 Nov 2026, real GPU Chrome, chapter oilers: the High school).
// Vico's case: he had touched the seated woman (Fern, cast key 'fern', at the project-review desk), then clicked an item
// on the desk's foot shelf and pressed Delete. The prop pick left Fern selected under it, Delete went to People first and
// removed her cast entry: she stood at the main desk. Now:
//   1. Vico's exact steps: Fern picked in the People tab, then the foot-shelf item clicked in the view (a real mouse
//      click on a point where the item is the first thing hit), then Delete: the item is the one selection (Fern is not
//      marked), the prop gets its hide edit, the chapter's people (cast and all) are byte-identical, and every person on
//      the stage is where and as they were (shown / hidden, place, turn, posture model).
//   2. Every item of the featured desk (the Layers tab's "Desk items" rows), one by one: selected, Delete, the people
//      unchanged, Undo.
// Self-contained (19 Nov 2026, the first Windows run found no foot-shelf items and no people in the default hq dir):
// it opens the Cinematographer's cut (CUT, default exports/cinematic-intro-cut-cine: oilers has its cast, Fern among
// them) with an unexported chapter draft it writes itself before the page loads (the Director's own film-draft store,
// experience/film-fresh.mjs, so it works on any checkout, before the fix too): the chapter's prop edits plus a backpack
// added on the featured desk's foot shelf (base shelf) and one on its desktop. The foot-shelf item clicked is an item the
// film puts there if there is one, else the backpack (else, with no base shelf on this desk, the desktop backpack).
// Before the fix step 1 fails at Delete (Fern's cast entry goes). Writes screenshots to SHOTS (default: a temp dir).
//   node tests/director-desk-prop-delete-people-e2e.mjs        (MAX=<n> items in step 2; BASE=… a running server)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';
import {filmPropEdits} from '../experience/prop-edits.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='oilers'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`desk prop delete e2e: skipped (${CUT} has no oilers chapter page here).`);process.exit(0);}
// the chapter's draft: the page's cut (its #cut= hash) with the two backpacks added to the shot's prop edits
const enc=/#cut=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(path.join(root,chapter.page),'utf8'))?.[1];
const project=JSON.parse(Buffer.from(enc.replaceAll('-','+').replaceAll('_','/'),'base64').toString('utf8'));
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
const ADDS=[{add:{asset:'backpack'},id:'dpfoot',match:'^Added prop:backpack#dpfoot$',label:'Backpack (foot shelf, test)',parent:'base-shelf',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},
  {add:{asset:'backpack'},id:'dptop',match:'^Added prop:backpack#dptop$',label:'Backpack (desktop, test)',parent:'desk',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}];
{const s=project.shots[0];s.propEdits=[...(Array.isArray(s.propEdits)?s.propEdits:filmPropEdits(film)),...ADDS];}
const DRAFT={[project.id]:{cut:project,at:new Date(Date.now()+864e5).toISOString(),base:''}};   // (newer than the film's: loaded at once)
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'desk-prop-delete-'));fs.mkdirSync(SHOTS,{recursive:true});
const MAX=Number(process.env.MAX||1e9),WOMAN=process.env.WOMAN||'fern';
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,api:w.ErgoFlex};};
  // every person the room builds: shown, where, turned, which posture model (world metres, rounded)
  window.__people=()=>{const {w,T,api}=__t(),list=api.workspaceRoom?.people?.people||[];
    const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    return list.map(o=>{const p=o.getWorldPosition(new T.Vector3()),q=o.getWorldQuaternion(new T.Quaternion()),e=new T.Euler().setFromQuaternion(q,'YXZ'),s=o.userData.person||{};
      return {id:s.id||o.name,key:s.key||'',station:s.station||'',shown:shown(o),amount:+(o.userData.personAmount??1).toFixed(2),x:+p.x.toFixed(3),y:+p.y.toFixed(3),z:+p.z.toFixed(3),yaw:+e.y.toFixed(3)};})
      .sort((a,b)=>(a.id+a.key).localeCompare(b.id+b.key)||a.x-b.x||a.z-b.z);};
  // a screen point (page px) where `o` is the first thing a click ray hits, or null
  window.__pointOn=o=>{const {t,T}=__t(),box=new T.Box3().setFromObject(o),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
    const ours=x=>{for(let p=x;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls)return true;return false;};
    const shown=x=>{for(let p=x;p;p=p.parent)if(!p.visible)return false;return true;};
    const inside=x=>{for(let p=x;p;p=p.parent)if(p===o)return true;return false;};
    const xs=[],ys=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).project(t.camera);xs.push(v.x);ys.push(v.y);}
    const x0=Math.max(-.97,Math.min(...xs)),x1=Math.min(.97,Math.max(...xs)),y0=Math.max(-.97,Math.min(...ys)),y1=Math.min(.97,Math.max(...ys));if(x0>=x1||y0>=y1)return null;
    for(let i=1;i<24;i++)for(let j=1;j<24;j++){const v={x:x0+(x1-x0)*i/24,y:y0+(y1-y0)*j/24};ray.setFromCamera(new T.Vector2(v.x,v.y),t.camera);
      const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!ours(h.object));
      if(hit&&inside(hit.object))return {x:f.left+c.left+(v.x+1)/2*c.width,y:f.top+c.top+(1-v.y)/2*c.height};}
    return null;};
  // the featured desk's foot-shelf (base shelf) items: children of its base-shelf mount
  window.__footShelf=()=>{const {api}=__t(),mounts=[api.sceneDesks?.active?.rig?.mounts?.['base-shelf'],api.workspaceAccessories?.mounts?.get?.('base-shelf')?.group].filter(Boolean);
    const out=[];for(const m of new Set(mounts))for(const o of m.children)if(o.visible&&!o.userData?.filmFx)out.push(o);
    // the film's own items first, then the test's backpack
    return out.sort((a,b)=>/#dpfoot$/.test(a.name)-/#dpfoot$/.test(b.name));};
  window.__deskTop=()=>{let o=null;__t().t.scene.traverse(x=>{if(!o&&/^Added prop:backpack#dptop$/.test(x.name)&&x.visible)o=x;});return o?[o]:[];};
  window.__frameOn=o=>{const {t,T}=__t(),b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());t.camera.position.set(c.x+.35,c.y+.55,c.z+1.15);t.controls.target.copy(c);t.camera.lookAt(c);t.controls.update();};
});
const people=()=>page.evaluate(()=>__people());
const draftPeople=()=>page.evaluate(()=>JSON.stringify(window.__directorShot?.()?.people??null));
const draftProps=()=>page.evaluate(()=>window.__directorShot?.()?.propEdits||[]);
// the same people: same set, each shown as before, within 2 cm and 0.02 rad of where they were
function samePeople(a,b){
  if(a.length!==b.length)return `${a.length} people before, ${b.length} after`;
  for(let i=0;i<a.length;i++){const x=a[i],y=b[i];
    if(x.id!==y.id||x.key!==y.key)return `person ${i}: ${x.id}/${x.key} became ${y.id}/${y.key}`;
    if(x.shown!==y.shown)return `${x.id}${x.key?' ('+x.key+')':''}: ${x.shown?'shown':'hidden'} became ${y.shown?'shown':'hidden'}`;
    if(x.shown&&(Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z)>.02||Math.abs(x.yaw-y.yaw)>.02))return `${x.id}${x.key?' ('+x.key+')':''} moved: ${JSON.stringify(x)} → ${JSON.stringify(y)}`;}
  return '';
}
// the stage settles after an edit (film-fx re-installs): two snapshots a second apart agree
async function settled(){await wait(2500);let last=await people();for(let i=0;i<20;i++){await wait(1000);const now=await people();if(!samePeople(last,now))return now;last=now;}return last;}
const marks=()=>page.evaluate(()=>[...document.querySelectorAll('.b2-selected')].map(e=>({prop:e.dataset.propKey||e.dataset.lyItem||'',person:e.dataset.personKey||e.dataset.personKeys||''})));
const tab=async t=>{await page.evaluate(t=>document.querySelector(`#director-panel [data-inspector-tab="${t}"]`)?.click(),t);await wait(600);};
const blur=()=>page.evaluate(()=>{document.activeElement?.blur?.();window.focus();});
const undo=async()=>{await blur();await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');};
try{
  // the draft, in the Director's own store, before the chapter page loads
  await page.goto(base+'/experience/experience.css');
  await page.evaluate(d=>{localStorage.setItem('ergoflex.director.filmDrafts.v1',JSON.stringify(d));},DRAFT);
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>(__t().api.workspaceRoom?.people?.people||[]).length>0&&__t().api.sceneDesks?.records?.size>1),'the High school\'s people and desks',180000);
  await until(()=>page.evaluate(()=>{let n=0;__t().t.scene.traverse(x=>{if(/^Added prop:backpack#dp(foot|top)$/.test(x.name))n++;});return n>0;}),'the test\'s backpacks on the stage',60000).catch(()=>null);
  check(await page.evaluate(()=>(window.__directorShot?.().propEdits||[]).some(e=>e.id==='dptop')),'the chapter opens with the test\'s draft (its backpacks in the prop edits)');
  await seek(page,Math.min(4,chapter.seconds/2));
  await until(()=>page.evaluate(w=>__people().some(p=>p.key===w||new RegExp('-'+w+'-').test(p.id)),WOMAN),`${WOMAN}'s stage object`,60000).catch(()=>null);
  const P0=await settled(),D0=await draftPeople();
  const woman=P0.find(p=>p.key===WOMAN)||P0.find(p=>new RegExp('-'+WOMAN+'-').test(p.id));
  check(!!woman,`${WOMAN} is on the stage (${woman?.id} at ${woman?.station||'?'}, ${woman?.shown?'shown':'not drawn at this time'})`);
  // ---- 1. Vico's steps
  await tab('people');
  await until(()=>page.$(`#director-panel .people-row[data-person-key="${WOMAN}"] .people-pick`),`${WOMAN} in the People list`);
  await page.evaluate(k=>document.querySelector(`#director-panel .people-row[data-person-key="${k}"] .people-pick`).click(),WOMAN);await wait(900);
  check((await marks()).some(m=>m.person.split(' ').includes(WOMAN)),`${WOMAN} is selected (marked) first`);
  // the item: on the foot shelf (the film's, else the test's backpack), else (no base shelf here) the desktop backpack
  const foot=await page.evaluate(()=>__footShelf().length),LIST=foot?'__footShelf':'__deskTop',n=foot||await page.evaluate(()=>__deskTop().length);
  check(n>0,foot?`the featured desk's foot shelf has items (${foot}: ${await page.evaluate(()=>__footShelf().map(o=>o.name).join(', '))})`:'no base shelf on this desk: the desktop backpack stands in for the foot-shelf item');
  if(!n)throw Error('nothing on the featured desk to click (the test\'s backpacks did not load)');
  const pick=(fn,i)=>page.evaluate((fn,i)=>{const o=window[fn]()[i];return o?__pointOn(o):null;},LIST,i);
  let pt=null,which=-1;
  for(let i=0;i<n&&!pt;i++){pt=await pick(LIST,i);which=i;}
  for(let i=0;i<n&&!pt;i++){await page.evaluate((fn,i)=>{const o=window[fn]()[i];if(o)__frameOn(o);},LIST,i);await wait(1200);pt=await pick(LIST,i);which=i;}
  const itemName=await page.evaluate((fn,i)=>window[fn]()[i]?.name||'',LIST,which),added=/^Added prop:/.test(itemName);
  check(!!pt,`a point on the screen where "${itemName}" is the first thing a click hits`);
  if(!pt)throw Error('no clickable foot-shelf item');
  const before=await draftProps(),count=()=>page.evaluate((fn,i)=>window[fn]().filter(o=>o.name===i).length,LIST,itemName),same0=await count();
  await page.mouse.click(pt.x,pt.y);await wait(1200);await shot('1-foot-shelf-picked');
  const m=await marks();
  check(m.some(x=>x.prop),`the click selects the foot-shelf item (a prop is marked: ${m.filter(x=>x.prop).map(x=>x.prop.slice(0,60)).join(' · ')})`);
  check(!m.some(x=>x.person.split(' ').includes(WOMAN)),`${WOMAN} is no longer selected once the item is (one selection)`);
  await blur();await page.keyboard.press('Delete');
  const P1=await settled(),D1=await draftPeople(),after=await draftProps();await shot('2-after-delete');
  check(D1===D0,`the chapter's people are byte-identical after Delete (${WOMAN}'s cast entry kept)`+(D1===D0?'':`: ${D0.length} → ${D1.length} chars`));
  const cast=s=>{try{return JSON.stringify((JSON.parse(s)?.cast||[]).find(c=>c.key===WOMAN)||null);}catch{return 'unreadable';}};
  check(cast(D1)===cast(D0),`${WOMAN}'s cast entry is byte-identical: ${cast(D1).slice(0,120)}`);
  const diff=samePeople(P0,P1);check(!diff,'every person on the stage is where and as they were'+(diff?': '+diff:''));
  if(added){const id=itemName.split('#')[1];check(before.some(e=>e.id===id)&&!after.some(e=>e.id===id)&&after.length===before.length-1,`Delete removed the added ${itemName} (its add entry gone, nothing else)`);}
  else{const hid=after.filter(e=>e.hide===true&&!before.some(b=>JSON.stringify(b)===JSON.stringify(e)));
    check(hid.length===1,`Delete hid the foot-shelf item (one new hide edit: ${hid.map(e=>e.label||e.match).join(', ')})`);}
  const left=await count();check(left===same0-1,`the item is off the stage ("${itemName}": ${same0} shown → ${left})`);
  await undo();await settled();
  check(JSON.stringify(await draftProps())===JSON.stringify(before),'Undo brings the item back (prop edits as before)');
  // ---- 2. every featured-desk item, one by one
  await tab('layers');
  const keys=await until(()=>page.$$eval('#director-panel [data-ly-group="desk"] [data-ly-item]',l=>l.map(r=>r.dataset.lyItem)).then(l=>l.length?l:null),'the Layers tab\'s desk items',30000).catch(()=>[]);
  check(keys.length>0,`the Layers tab lists the featured desk's items (${keys.length})`);
  let done=0;
  for(const key of keys.slice(0,MAX)){
    const ref=await settled(),dp=await draftPeople(),pe=JSON.stringify(await draftProps());
    // a person selected first, as Vico had, then the item from its row
    await tab('people');await page.evaluate(k=>document.querySelector(`#director-panel .people-row[data-person-key="${k}"] .people-pick`)?.click(),WOMAN);await wait(500);
    await tab('layers');
    const ok=await page.evaluate(k=>{const r=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);if(!r)return false;r.querySelector('.layer-name')?.click()||r.click();return true;},key);
    if(!ok){console.log('     (row gone: '+key.slice(0,80)+')');continue;}
    await wait(700);await blur();await page.keyboard.press('Delete');
    const now=await settled(),d=samePeople(ref,now),same=await draftPeople()===dp,name=JSON.parse(key)[0]?.replace(/^\^|\$$/g,'')||key;
    check(!d&&same,`hiding "${name.slice(0,60)}" changes no person`+(d?': '+d:'')+(same?'':' (the chapter\'s people changed)'));
    await undo();await wait(800);
    check(JSON.stringify(await draftProps())===pe,`Undo puts "${name.slice(0,60)}" back`);
    done++;
  }
  console.log(`     (${done} desk items hidden one by one)`);
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);await shot('fail');}
finally{console.log('screenshots in '+SHOTS+' · status: '+await statusOf(page).catch(()=>''));await close();}
check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('desk prop delete e2e: Delete on a desk prop hides the prop and leaves every person as they were.');
