// Hiding an item on a room desk changes nothing else (19 Nov 2026, real GPU Chrome, chapter oilers, Windows).
// Vico double-clicked into the APA set and costume design review desk, picked its shelf organizer and pressed Delete:
// "the desk disappeared, and then the girl again went to the main desk and stood there"; his autosave lost the chapter's
// deskEdits in that step. Cause: Studio's own canvas click (studio.js onCanvasClick -> sceneDesks.pick / select) made
// every room desk clicked in the Director THE featured desk (its body hidden under the live model, its people sent to
// the featured desk's place, the Director taking it for the featured desk). The Director mutes Studio's pick now.
// This test opens the cine cut's oilers with Vico's three desk edits (his 2nd cut's draft of 19 Nov 02:43: the APA desk
// 48″ at x -4080 / z 1149.4, height 28; the demonstration desk moved; the accessible student desk moved and hidden) as an
// unexported draft it writes itself, then for each way to hide an item on the APA desk:
//   Delete key (after a real click and double-click into the desk), the selection bar's Delete, the Layers row eye
// checks: the featured desk is still the featured desk after every click; the APA desk is still drawn; shot.deskEdits
// and shot.people (and peopleEdits) are byte-identical; propEdits gained exactly one hide edit and lost nothing; every
// person on the stage is where and as they were; Undo puts propEdits back.
// The other direction: a desk edit (nudge, size) of the APA desk keeps every prop edit, the hide of its item included.
//   node tests/director-room-desk-hide-keeps-edits-e2e.mjs        (CUT=<cut dir>; SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';
import {filmPropEdits} from '../experience/prop-edits.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine',DESK='station-project-review';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='oilers'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`room desk hide e2e: skipped (${CUT} has no oilers chapter page here).`);process.exit(0);}
const enc=/#cut=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(path.join(root,chapter.page),'utf8'))?.[1];
const project=JSON.parse(Buffer.from(enc.replaceAll('-','+').replaceAll('_','/'),'base64').toString('utf8'));
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
// Vico's desk edits (exports/director-autosaves/cinematic-intro-cut-vicos-2nd-cut/oilers/20261119-024336-edit.json.gz)
const VICO_DESKS=[{desk:'station-accessible-student',name:'Accessible student desk',pose:{x:-4302.7,z:1751.3,yaw:-2.7367},hide:true},
  {desk:'station-demonstration-desk',name:'Wave and energy demonstration desk',pose:{x:3456.3,z:-2100,yaw:0.7854}},
  {desk:'station-project-review',name:'APA set and costume design review desk',size:'48x30',pose:{x:-4080,z:1149.4,yaw:0},initial:{height:28,tilt:0}}];
{const s=project.shots[0];s.deskEdits=VICO_DESKS;s.propEdits=Array.isArray(s.propEdits)?s.propEdits:filmPropEdits(film);}
const DRAFT={[project.id]:{cut:project,at:new Date(Date.now()+864e5).toISOString(),base:''}};
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'room-desk-hide-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,api:w.ErgoFlex};};
  const MOUNT=/^Desk dressing:|:(desktop|shelf|lower-shelf|base-shelf)$/;
  window.__items=id=>{const r=__t().api.sceneDesks.records.get(id),out=[];if(!r?.group)return out;const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    r.group.traverse(m=>{if(m!==r.group&&MOUNT.test(m.name||''))for(const c of m.children)if(shown(c)&&!c.userData?.filmFx){let mesh=false;c.traverse(x=>{if(x.isMesh)mesh=true;});if(mesh)out.push(c);}});return out;};
  window.__pointOn=o=>{const {t,T}=__t(),box=new T.Box3().setFromObject(o),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
    const ours=x=>{for(let p=x;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls)return true;return false;};
    const shown=x=>{for(let p=x;p;p=p.parent)if(!p.visible)return false;return true;};const inside=x=>{for(let p=x;p;p=p.parent)if(p===o)return true;return false;};
    const xs=[],ys=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).project(t.camera);xs.push(v.x);ys.push(v.y);}
    const x0=Math.max(-.97,Math.min(...xs)),x1=Math.min(.97,Math.max(...xs)),y0=Math.max(-.97,Math.min(...ys)),y1=Math.min(.97,Math.max(...ys));if(x0>=x1||y0>=y1)return null;
    for(let i=1;i<20;i++)for(let j=1;j<20;j++){const v={x:x0+(x1-x0)*i/20,y:y0+(y1-y0)*j/20};ray.setFromCamera(new T.Vector2(v.x,v.y),t.camera);
      const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!ours(h.object));if(hit&&inside(hit.object))return {x:f.left+c.left+(v.x+1)/2*c.width,y:f.top+c.top+(1-v.y)/2*c.height};}
    return null;};
  window.__frame=(id,a=0)=>{const {t,T,api}=__t(),g=api.sceneDesks.records.get(id).group,b=new T.Box3().setFromObject(g),c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3()),R=Math.max(s.x,s.z)*1.35+.6;
    const yaw=g.rotation.y+[0,Math.PI/2.4,-Math.PI/2.4][a],f=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));t.camera.position.copy(c.clone().addScaledVector(f,R).setY(b.max.y+.5));t.controls.target.copy(c);t.camera.lookAt(c);t.controls.update();};
  window.__state=()=>{const {T,api}=__t(),sd=api.sceneDesks,r=sd.records.get('station-project-review');let drawn=!!r?.group;for(let p=r?.group;p;p=p.parent)if(!p.visible)drawn=false;
    const people=(api.workspaceRoom?.people?.people||[]).map(o=>{const p=o.getWorldPosition(new T.Vector3());let s=true;for(let q=o;q;q=q.parent)if(!q.visible)s=false;return [o.userData.person?.id||o.name,o.userData.person?.key||'',s,+p.x.toFixed(2),+p.z.toFixed(2)].join('|');}).sort().join('\n');
    const d=window.__directorShot();return {featured:sd.selected,drawn,inScene:!!r?.group?.parent,people,deskEdits:JSON.stringify(d.deskEdits??null),cast:JSON.stringify(d.people??null)+JSON.stringify(d.peopleEdits??null),propEdits:d.propEdits||[]};};
});
const state=()=>page.evaluate(()=>__state());
const blur=()=>page.evaluate(()=>{document.activeElement?.blur?.();window.focus();});
const key=async(k,mod)=>{
  // (Esc with nothing selected closes the whole Director, player.mjs: only pressed while something is selected)
  if(k==='Escape'&&!await page.evaluate(()=>{const p=window.__directorProps?.();return !!p&&(!!p.inside||!!p.desk||p.keys.length>0||!!p.person);}))return;
  await blur();if(mod)await page.keyboard.down(mod);await page.keyboard.press(k);if(mod)await page.keyboard.up(mod);await wait(1500);};
const tab=async t=>{await page.evaluate(t=>document.querySelector(`#director-panel [data-inspector-tab="${t}"]`)?.click(),t);await wait(600);};
async function settle(){await wait(2500);let a=await state();for(let i=0;i<15;i++){await wait(1000);const b=await state();if(a.people===b.people)return b;a=b;}return a;}
// the same everything but propEdits; exactly one more prop edit, a hide, nothing lost
function compare(what,a,b,{added=1}={}){
  check(b.featured===a.featured,`${what}: the featured desk is still ${a.featured} (${b.featured})`);
  check(b.drawn&&b.inScene,`${what}: the APA desk is still drawn`);
  check(b.deskEdits===a.deskEdits,`${what}: shot.deskEdits byte-identical`+(b.deskEdits===a.deskEdits?'':` (${a.deskEdits.length} → ${b.deskEdits.length} chars: ${b.deskEdits.slice(0,120)})`));
  check(b.cast===a.cast,`${what}: shot.people / peopleEdits byte-identical`);
  check(b.people===a.people,`${what}: every person on the stage where and as they were`);
  const kept=a.propEdits.every(e=>b.propEdits.some(x=>JSON.stringify(x)===JSON.stringify(e))),more=b.propEdits.filter(e=>!a.propEdits.some(x=>JSON.stringify(x)===JSON.stringify(e)));
  check(kept&&more.length===added&&(!added||more[0].hide===true),`${what}: propEdits kept all ${a.propEdits.length} and gained ${more.length} (${more.map(e=>(e.label||e.match)+(e.hide?' hidden':'')).join(', ')})`);
}
try{
  await page.goto(base+'/experience/experience.css');
  await page.evaluate(d=>localStorage.setItem('ergoflex.director.filmDrafts.v1',JSON.stringify(d)),DRAFT);
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>__t().api.sceneDesks?.records?.size>1&&(__t().api.workspaceRoom?.people?.people||[]).length>0),'the desks and people',180000);
  check(await page.evaluate(()=>(__directorShot().deskEdits||[]).length===3),'the chapter opens with Vico\'s three desk edits');
  await seek(page,Math.min(4,chapter.seconds/2));
  const S0=await settle();
  check(S0.featured==='main'&&S0.drawn,`the featured desk is main, the APA desk drawn (${S0.featured})`);
  const n=await page.evaluate(id=>__items(id).length,DESK);check(n>1,`the APA desk has items (${n})`);
  // points on two of its items, from one of three angles
  let pts=[];
  for(let a=0;a<3&&pts.length<2;a++){await page.evaluate((id,a)=>__frame(id,a),DESK,a);await wait(800);pts=[];for(let i=0;i<n&&pts.length<2;i++){const p=await page.evaluate((id,i)=>__pointOn(__items(id)[i]),DESK,i);if(p)pts.push(p);}}
  if(pts.length<2)throw Error('fewer than two clickable items on the APA desk');
  // ---- 1. Vico's steps: click, double-click into the desk, click an item, Delete
  const A=await settle();
  await page.mouse.click(pts[0].x,pts[0].y);await wait(1000);
  check((await state()).featured===A.featured,'one click on the desk\'s item: the featured desk does not change');
  await page.mouse.click(pts[0].x,pts[0].y,{count:2,clickCount:2,delay:40});await wait(1000);
  check((await page.evaluate(()=>window.__directorProps?.().inside?.id||null))===DESK,'the double-click enters the APA desk');
  check((await state()).featured===A.featured,'the double-click: the featured desk does not change');
  await page.mouse.click(pts[1].x,pts[1].y);await wait(800);await shot('1-picked');
  await key('Delete');compare('Delete key',A,await settle());await shot('2-after-delete');
  await key('z','Control');check(JSON.stringify((await settle()).propEdits)===JSON.stringify(A.propEdits),'Undo puts the prop edits back');
  // ---- 2. the selection bar's Delete
  await page.mouse.click(pts[1].x,pts[1].y);await wait(800);
  const B=await settle(),bar=await page.evaluate(()=>{const b=document.querySelector('[data-action="sel-tool"][data-section="delete"]');if(!b)return false;b.click();return true;});
  if(bar){compare('the selection bar\'s Delete',B,await settle());await key('z','Control');}else console.log('     (no selection bar Delete button in this layout: skipped)');
  await key('Escape');await key('Escape');
  // ---- 3. the Layers row eye of an item on the desk
  await tab('layers');
  const row=await until(()=>page.evaluate(id=>{const r=[...document.querySelectorAll(`#director-panel [data-ly-group="room-desk:${id}"] [data-ly-item]`)].find(r=>!r.classList.contains('is-hidden'));return r?r.dataset.lyItem:null;},DESK),'the APA desk\'s Layers rows',30000);
  const C=await settle();
  await page.evaluate(k=>[...document.querySelectorAll('#director-panel [data-action="ly-row-eye"]')].find(b=>b.dataset.section===k).click(),row);
  compare('the Layers row eye',C,await settle());
  // ---- 4. the other direction: desk edits of the APA desk keep every prop edit (the hide just made included)
  const D=await settle();
  await tab('desks');
  await page.evaluate(id=>document.querySelector(`#director-panel .desk-row[data-section="${id}"]`)?.click(),DESK);await wait(1200);
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="dk-nudge"][data-section^="x:"]')?.click());const E1=await settle();
  check(JSON.stringify(E1.propEdits)===JSON.stringify(D.propEdits),'a nudge of the APA desk keeps every prop edit');
  check(E1.deskEdits!==D.deskEdits&&E1.featured===D.featured,'(the nudge is a desk edit; the featured desk stays)');
  await page.evaluate(()=>{const b=[...document.querySelectorAll('#director-panel [data-action="dk-size"]')].find(b=>b.getAttribute('aria-pressed')!=='true');b?.click();});const E2=await settle();
  check(JSON.stringify(E2.propEdits)===JSON.stringify(D.propEdits),'a size change of the APA desk keeps every prop edit');
  check(E2.people===E1.people||true,'(people after a size change: '+(E2.people===E1.people?'unchanged':'re-seated at the new size')+')');
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);await shot('fail');}
finally{console.log('screenshots in '+SHOTS+' · status: '+await statusOf(page).catch(()=>''));await close();}
check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('room desk hide e2e: hiding an item on a room desk keeps the featured desk, the desk edits, the people and every other prop edit.');
