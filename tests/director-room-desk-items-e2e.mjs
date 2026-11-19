// The items on the room's other desks are selectable (18 Nov 2026, real GPU Chrome, chapter oilers: the High school).
// Vico could not select anything sitting on the High school's other desks: a click on one always meant the whole desk.
// Now (scene-prop-editor.mjs enterDesk, Illustrator's isolation mode / Figma's double-click into a group):
//   1. one click on an item of a room desk selects the desk (Desks tab), as before, and no prop
//   2. a double-click on it enters the desk (the chip names it) and selects that item
//   3. inside, a click selects each item of the desk one by one (every item that a click can reach from one of four
//      camera angles around the desk; the others are listed), a click on another desk does nothing
//   4. Delete hides the item (a hide edit, the people unchanged), Undo brings it back
//   5. Esc leaves the desk and selects the desk; a double-click on empty space leaves it too
//   6. Layers: every room desk has its items under it ("<desk> · on this desk"), one row per item of the desk; a row
//      selects that item and enters its desk
// Every room desk of the chapter, every item. Before the fix 1-3 and 6 fail (no rows, the desk is all a click gets).
//   node tests/director-room-desk-items-e2e.mjs        (DESKS=station-a,station-b to limit; SHOTS=<dir>; CUT=<cut dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';

// the Cinematographer's cut (CUT): oilers as the film has it, every room desk in place
const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='oilers'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`room desk items e2e: skipped (${CUT} has no oilers chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'room-desk-items-'));fs.mkdirSync(SHOTS,{recursive:true});
const ONLY=process.env.DESKS?new Set(process.env.DESKS.split(',')):null;
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],notes=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,api:w.ErgoFlex};};
  const MOUNT=/^Desk dressing:|:(desktop|shelf|lower-shelf|base-shelf)$/;
  // a room desk's items: the children of its mounts (what Vico sees sitting on it), shown
  window.__items=id=>{const {api}=__t(),r=api.sceneDesks.records.get(id),out=[];if(!r?.group)return out;
    const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    r.group.traverse(m=>{if(m!==r.group&&MOUNT.test(m.name||''))for(const c of m.children)if(shown(c)&&!c.userData?.filmFx&&!c.userData?.directorTools){let mesh=false;c.traverse(x=>{if(x.isMesh)mesh=true;});if(mesh)out.push(c);}});
    return out;};
  window.__item=(id,i)=>__items(id)[i];
  // every item on the desk's mounts, shown or not (a Layers row also stands for one the film hides at this time)
  window.__allItems=id=>{const {api}=__t(),r=api.sceneDesks.records.get(id),out=[];if(!r?.group)return out;r.group.traverse(m=>{if(m!==r.group&&MOUNT.test(m.name||''))for(const c of m.children)if(!c.userData?.filmFx&&!c.userData?.directorTools)out.push(c);});return out;};
  window.__pointOn=o=>{const {t,T}=__t(),box=new T.Box3().setFromObject(o),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
    const ours=x=>{for(let p=x;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls)return true;return false;};
    const shown=x=>{for(let p=x;p;p=p.parent)if(!p.visible)return false;return true;};
    const inside=x=>{for(let p=x;p;p=p.parent)if(p===o)return true;return false;};
    const xs=[],ys=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).project(t.camera);xs.push(v.x);ys.push(v.y);}
    const x0=Math.max(-.97,Math.min(...xs)),x1=Math.min(.97,Math.max(...xs)),y0=Math.max(-.97,Math.min(...ys)),y1=Math.min(.97,Math.max(...ys));if(x0>=x1||y0>=y1)return null;
    // solid: the item is also in front 2 px to each side (19 Nov 2026, Windows: the first grid point can be a sliver of an
    // item under another one, the auto-stowed parts of one desk item overlap, and the real click, in whole device pixels at
    // the PC's display scale, lands beside it). A sliver only when that is all there is: {solid:false}
    const on=(x,y)=>{ray.setFromCamera(new T.Vector2(x,y),t.camera);const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!ours(h.object));return !!hit&&inside(hit.object);};
    const ex=4/c.width,ey=4/c.height,at=v=>({x:f.left+c.left+(v.x+1)/2*c.width,y:f.top+c.top+(1-v.y)/2*c.height});let sliver=null;
    for(let i=1;i<20;i++)for(let j=1;j<20;j++){const v={x:x0+(x1-x0)*i/20,y:y0+(y1-y0)*j/20};if(!on(v.x,v.y))continue;
      if(on(v.x+ex,v.y)&&on(v.x-ex,v.y)&&on(v.x,v.y+ey)&&on(v.x,v.y-ey))return {...at(v),solid:true};sliver||={...at(v),solid:false};}
    return sliver;};
  // the desk's items under a page point, front to back (a failed pick says what the click had to choose from)
  window.__under=(id,x,y)=>{const {t,T}=__t(),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster(),items=__allItems(id);
    ray.setFromCamera(new T.Vector2((x-f.left-c.left)/c.width*2-1,1-(y-f.top-c.top)/c.height*2),t.camera);
    const of=o=>{for(let p=o;p;p=p.parent){const it=items.find(i=>i===p);if(it)return it.name;}return null;};
    const tool=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.isTransformControls)return true;return false;};
    return [...new Set(ray.intersectObject(t.scene,true).filter(h=>h.object.isMesh).map(h=>tool(h.object)?'(the Director\'s gizmo or tools: '+(h.object.name||'unnamed')+')':of(h.object)||'(not on this desk: '+h.object.name+')'))].slice(0,6);};
  // the camera around a desk: angle a (0..3: front high, right, left, front low for the foot shelf)
  window.__frame=(id,a=0)=>{const {t,T,api}=__t(),g=api.sceneDesks.records.get(id).group,b=new T.Box3().setFromObject(g),c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3()),R=Math.max(s.x,s.z)*1.35+.6;
    const yaw=g.rotation.y+[0,Math.PI/2.4,-Math.PI/2.4,0][a],h=[.9,.6,.6,.12][a]*Math.max(1,s.y),f=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const eye=c.clone().addScaledVector(f,R).setY(b.min.y+h+(a===3?.15:.5));t.camera.position.copy(eye);t.controls.target.copy(c);t.camera.lookAt(c);t.controls.update();};
  window.__people=()=>{const {T,api}=__t();return (api.workspaceRoom?.people?.people||[]).map(o=>{const p=o.getWorldPosition(new T.Vector3());let s=true;for(let q=o;q;q=q.parent)if(!q.visible)s=false;return [o.userData.person?.id||o.name,s,+p.x.toFixed(2),+p.z.toFixed(2)].join('|');}).sort().join('\n');};
});
// The point on item i of desk id with the camera at angle a, framed right before the click: the test sets the camera
// by hand, and a selection that re-renders the stage can put the Director's own view back (the film camera), so a point
// worked out before a click is stale after it.
const pointAt=async(id,i,a)=>{await page.evaluate((id,a)=>__frame(id,a),id,a);await wait(350);return page.evaluate((id,i)=>{const o=__item(id,i);return o?__pointOn(o):null;},id,i);};
const props=()=>page.evaluate(()=>{const d=window.__directorProps?.();return d?{keys:d.keys,inside:d.inside?.id||null,desk:d.desk,objName:d.object?.name||null}:null;});
const isItem=(id,i)=>page.evaluate((id,i)=>window.__directorProps?.().object===__item(id,i),id,i);
const chip=()=>page.evaluate(()=>{const c=document.querySelector('.desk-isolate-chip');return c&&!c.hidden?c.textContent:'';});
const blur=()=>page.evaluate(()=>{document.activeElement?.blur?.();window.focus();});
const tab=async t=>{await page.evaluate(t=>document.querySelector(`#director-panel [data-inspector-tab="${t}"]`)?.click(),t);await wait(500);};
const dbl=async p=>{await page.mouse.click(p.x,p.y,{count:2,clickCount:2,delay:40});await wait(900);};
// (Esc with nothing selected closes the whole Director, player.mjs: only pressed while something is selected)
const esc=async()=>{const d=await page.evaluate(()=>{const p=window.__directorProps?.();return !!p&&(!!p.inside||!!p.desk||p.keys.length>0||!!p.person);});if(!d)return;await blur();await page.keyboard.press('Escape');await wait(700);};
try{
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>__t().api.sceneDesks?.records?.size>1),'the High school\'s desks',120000);
  await seek(page,Math.min(4,chapter.seconds/2));await wait(2500);
  const desks=await page.evaluate(()=>{const sd=__t().api.sceneDesks;return [...sd.records.values()].filter(r=>r.id!==sd.selected&&r.group&&r.group.visible).map(r=>({id:r.id,name:r.state?.name||r.id}));});
  const list=desks.filter(d=>!ONLY||ONLY.has(d.id));
  check(list.length>0,`the High school has room desks (${desks.map(d=>d.id).join(', ')})`);
  let total=0,reached=0,altPicked=0,viaFallback=0,lockerLogged=false;
  for(const d of list){
    const n=await page.evaluate(id=>__items(id).length,d.id);total+=n;
    console.log(`\n${d.name} (${d.id}): ${n} items`);if(!n){notes.push(`${d.id}: nothing on it`);continue;}
    // ---- 1 + 2: from outside, a click selects the desk, a double-click enters it with the item
    let first=-1,pt=null,a0=0;
    for(let a=0;a<4&&!pt;a++){await page.evaluate((id,a)=>__frame(id,a),d.id,a);await wait(700);for(let i=0;i<n&&!pt;i++){pt=await page.evaluate((id,i)=>__pointOn(__item(id,i)),d.id,i);first=i;a0=a;}}
    if(!pt){check(false,`${d.id}: no item can be clicked from any angle`);continue;}
    await page.mouse.click(pt.x,pt.y);await wait(1000);
    let p=await props();
    check(p.desk===d.id&&!p.keys.length,`${d.id}: one click on an item selects the desk (desk ${p.desk}, props ${p.keys.length})`);
    pt=await pointAt(d.id,first,a0)||pt;
    await dbl(pt);p=await props();
    check(p.inside===d.id&&await isItem(d.id,first),`${d.id}: a double-click enters the desk and selects that item (${p.objName}; inside ${p.inside})`);
    check((await chip()).includes(d.name),`${d.id}: the chip names the desk: "${await chip()}"`);
    await shot(`${d.id}-1-entered`);
    // ---- 3: inside, every item a click can reach
    // Every angle is tried before an item fails: a miss is only noted (missed: the angle and point of its last miss at a
    // solid point; stacked: an auto-stow part whose click landed on a sibling part at some angle). After the four angles,
    // for an item no click picked: stacked -> out of reach (Layers); else missed -> the trace, the Esc and double-click
    // fallback, and a FAIL if that misses too; else (no point, or only a sliver, from any angle) -> out of reach (Layers).
    const got=new Set([first]),unreached=[],missed=new Map(),stacked=new Map(),failed=new Set();
    const nameOf=i=>page.evaluate((id,i)=>__item(id,i).name,d.id,i);
    // The parts of one auto-stowed desk item ("<item> · stored supply N", desk-auto-stow.mjs: tilting the desk splits it,
    // and the parts that stay put sit on top of each other): a click on one that lands on a sibling part is a known limit,
    // not a failure (19 Nov 2026, Windows: the APA desk's supply 8 lands on 7 or 1, gizmo or Alt; at another angle a click
    // there lands on the shelf organizer). Out of reach of a click like a sliver; its Layers row (checked below) selects it.
    const STOW=/ · stored supply \d+$/,sibling=(want,gotName)=>STOW.test(want)&&STOW.test(gotName)&&want.replace(STOW,'')===gotName.replace(STOW,'');
    for(let a=0;a<4;a++){
      for(let i=0;i<n;i++){if(got.has(i))continue;const q=await pointAt(d.id,i,a);if(!q)continue;
        await page.mouse.click(q.x,q.y);await wait(450);
        if(await isItem(d.id,i)){got.add(i);continue;}
        // the click picked what is in front (or the gizmo's item): Alt+click goes through the stack under the pointer
        let viaAlt=0;for(let k=1;k<=6&&!viaAlt;k++){const r=await pointAt(d.id,i,a)||q;await page.keyboard.down('Alt');await page.mouse.click(r.x,r.y);await page.keyboard.up('Alt');await wait(400);if(await isItem(d.id,i))viaAlt=k;}
        if(viaAlt){altPicked++;console.log(`     item ${i} (${await nameOf(i)}): a click picks what is in front, Alt+click ×${viaAlt} reaches it`);got.add(i);continue;}
        // only a sliver of it shows from here: no click can be sure of it (another angle may do; else Layers, below)
        if(!q.solid){console.log(`     item ${i} (${await nameOf(i)}): only a sliver shows from angle ${a}`);continue;}
        const want=await nameOf(i),gotName=(await props())?.objName||'';
        if(sibling(want,gotName)){stacked.set(i,gotName);console.log(`     item ${i} (${want}): a click lands on its sibling part ${gotName.replace(/^.* · /,'')} from angle ${a} (stacked auto-stow parts: Layers)`);continue;}
        missed.set(i,{a,q,gotName});console.log(`     item ${i} (${want}): a click from angle ${a} lands on ${gotName||'nothing'}; the other angles first`);
      }
    }
    for(let i=0;i<n;i++){if(got.has(i))continue;
      if(stacked.has(i)){console.log(`     item ${i} (${await nameOf(i)}): a stacked auto-stow part (a click landed on ${stacked.get(i).replace(/^.* · /,'')}): out of reach of a click, Layers below`);continue;}
      const m=missed.get(i);if(!m)continue;   // (no clickable point from any angle, or only a sliver: out of reach, Layers below)
      const under=await page.evaluate((id,x,y)=>__under(id,x,y),d.id,m.q.x,m.q.y);
      // what the Director did with those clicks, step by step (scene-prop-editor.mjs trace)
      const steps=await page.evaluate(()=>JSON.stringify((document.getElementById('stage').contentWindow.__directorClickTrace||[]).slice(-8)));
      console.log(`     item ${i}: the click trace ${steps}`);
      // A known limit (19 Nov 2026): the previous pick's gizmo covers the item. Deselect (Esc leaves the desk) and
      // double-click the item itself, the way back in that selects what is clicked.
      {await esc();const r=await pointAt(d.id,i,m.a);if(r){await dbl(r);if(await isItem(d.id,i)){viaFallback++;console.log(`     item ${i} (${await nameOf(i)}): covered by the last pick's gizmo; Esc and a double-click on it reach it`);got.add(i);continue;}}}
      const s=await props();check(false,`${d.id}: a click (or Alt+clicks) on item ${i} (${await nameOf(i)}) selects it from one of four angles (angle ${m.a}: got ${s.objName}, inside ${s.inside}; under the pointer now: ${under.join(' > ')})`);got.add(i);failed.add(i);
      // (the fallback may have left the desk: back in with the first item, for the checks that follow)
      if((await props()).inside!==d.id){const r=await pointAt(d.id,first,a0);if(r)await dbl(r);}
    }
    for(let i=0;i<n;i++)if(!got.has(i))unreached.push(await nameOf(i));
    reached+=got.size;
    check((await props()).inside===d.id,`${d.id}: still inside after ${got.size} picks`);
    console.log(`     ${got.size}/${n} picked by a click inside${unreached.length?' (no clickable point, only a sliver, or a stacked auto-stow part under its siblings, from four angles: '+unreached.join(', ')+'; Layers below)':''}`);
    if(unreached.length)notes.push(`${d.id}: ${unreached.length} items out of reach of a click (${unreached.join(', ')})`);
    const other=list.find(x=>x.id!==d.id);   // (a click on its items does nothing while inside, below)
    // ---- 4: Delete hides the selected item; the people stay; Undo
    {const i=[...got].filter(x=>!failed.has(x)).at(-1);let q=null;for(let a=0;a<4&&!q;a++)q=await pointAt(d.id,i,a);if(q){await page.mouse.click(q.x,q.y);await wait(450);if(!await isItem(d.id,i))for(let k=0;k<6&&!await isItem(d.id,i);k++){await page.keyboard.down('Alt');await page.mouse.click(q.x,q.y);await page.keyboard.up('Alt');await wait(400);}}
      const ok=await isItem(d.id,i),before=JSON.stringify(await page.evaluate(()=>__directorPropEdits())),ppl=await page.evaluate(()=>__people()),cast=await page.evaluate(()=>JSON.stringify(__directorShot().people??null));
      check(ok,`${d.id}: item ${i} selected for the Delete`);
      if(ok){
        await blur();await page.keyboard.press('Delete');await wait(3500);
        // one entry new or changed (the item may already have an edit of the film's or the Director's), a hide; nothing else lost.
        // The Director's edits, not the shot's own list: before the chapter's first edit the shot has none and the film's
        // director:true entries (an earlier Export cut: the oil room's lockers and wall in the cine cut) are its edits; the
        // first edit copies them into the shot as they are (prop-edits.mjs effectivePropEdits; the merge marks them
        // director:true again), and comparing with the shot's [] counted them as changed (19 Nov 2026, Windows)
        const after=await page.evaluate(()=>__directorPropEdits()),B=JSON.parse(before),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
        const changed=after.filter(e=>!B.some(b=>same(b,e))),lost=B.filter(b=>!after.some(e=>same(e,b)));
        if(!lockerLogged){lockerLogged=true;const one=x=>JSON.stringify(x.find(e=>/#oilm1\$$/.test(e.match||'')&&!e.add)||null);console.log(`  one of the film's Director entries, before / after the Delete: ${one(B)} / ${one(after)}`);}
        const off=await page.evaluate(()=>{const o=window.__directorProps?.().object;if(!o)return null;for(let p=o;p;p=p.parent)if(!p.visible)return true;return false;});
        check(changed.length===1&&changed[0].hide===true&&lost.length<=1&&(!lost.length||lost[0].match===changed[0].match)&&off!==false,`${d.id}: Delete gives the item a hide edit and nothing else (${changed.map(e=>(e.label||e.match)+(e.hide?' hidden':'')).join(', ')}${lost.length?'; replaced '+lost.length:''}; off the stage ${off})`);
        check(await page.evaluate(()=>JSON.stringify(__directorShot().people??null))===cast&&await page.evaluate(()=>__people())===ppl,`${d.id}: no person changed`);
        await blur();await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(2500);
        check(JSON.stringify(await page.evaluate(()=>__directorPropEdits()))===before,`${d.id}: Undo brings it back`);
      }
    }
    // ---- 5: Esc leaves and selects the desk
    await esc();p=await props();
    check(!p.inside&&p.desk===d.id&&!(await chip()),`${d.id}: Esc leaves the desk and selects it (inside ${p.inside}, desk ${p.desk})`);
    await esc();
    if(other){const q=await pointAt(d.id,first,a0);if(q){await dbl(q);
      const op=await page.evaluate(id=>{const items=__items(id);for(const o of items){const p=__pointOn(o);if(p)return p;}return null;},other.id);
      if(op){await page.mouse.click(op.x,op.y);await wait(600);p=await props();check(p.inside===d.id&&await isItem(d.id,first),`${d.id}: inside, a click on ${other.id}'s item does nothing`);}
      // empty space: a double-click on the sky / floor far off leaves
      await page.evaluate(()=>{const {t}=__t();t.camera.lookAt(t.camera.position.x,t.camera.position.y+50,t.camera.position.z+1);});await wait(400);
      const box=await page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+8};});
      await dbl(box);p=await props();check(!p.inside,`${d.id}: a double-click on empty space leaves the desk (inside ${p.inside})`);await esc();}}
  }
  // ---- 6: the Layers tree
  for(const d of list){
    await tab('layers');   // (leaving a desk used to switch to the Desks tab; open Layers for every desk anyway)
    const n=await page.evaluate(id=>__items(id).length,d.id);if(!n)continue;
    const rows=await until(()=>page.$$eval(`#director-panel [data-ly-group="room-desk:${d.id}"] [data-ly-item]`,l=>l.map(r=>r.dataset.lyItem)).then(l=>l.length?l:null),`${d.id}'s Layers rows`,20000).catch(()=>[]);
    const want=await page.evaluate(id=>new Set(__items(id).map(o=>o.name)).size,d.id);
    check(rows.length>=want,`Layers: ${d.name} lists its items under the desk (${rows.length} rows for ${n} items, ${want} names)`);
    let ok=0;
    for(const key of rows){
      await page.evaluate(k=>{const r=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);(r?.querySelector('.layer-name')||r)?.click();},key);await wait(350);
      const p=await props(),mine=await page.evaluate(id=>{const o=window.__directorProps?.().object;if(!o)return false;const all=__allItems(id);for(let q=o;q;q=q.parent)if(all.includes(q))return true;return false;},d.id);
      if(p.keys.includes(key)&&p.inside===d.id&&mine)ok++;else check(false,`Layers: the row ${key.slice(0,90)} selects its item inside ${d.id} (keys ${p.keys.length}, inside ${p.inside}, on the desk ${mine})`);
    }
    check(ok===rows.length,`Layers: all ${rows.length} of ${d.name}'s rows select their item and enter the desk`);
    await esc();await esc();
  }
  console.log(`\n${reached}/${total} items picked by a click inside their desk (${altPicked} of them by Alt+click through the ones in front, ${viaFallback} by Esc and a double-click: the last pick's gizmo covered them); every row in Layers.`);
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);await shot('fail');}
finally{if(notes.length)console.log('notes:\n  '+notes.join('\n  '));console.log('screenshots in '+SHOTS+' · status: '+await statusOf(page).catch(()=>''));await close();}
check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('room desk items e2e: every High school room desk\'s items are selectable by a double-click into the desk and by Layers.');
