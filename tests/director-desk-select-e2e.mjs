// Director "Desks" (experience/scene-desk-editor.mjs, desk-edits.mjs) end to end (real GPU Chrome; not one of the quick
// tests/cinematic-* checks). Chapter 6 (oilers) has six ErgoFlex desks besides the featured one. Select a desk in the
// Desks list and by clicking it in the view (and the featured desk goes to the Groove tab, Esc / an empty click go back);
// Size (48 / 60), Position X / Z with nudges, Rotate, the round drag handle, Starting height / tilt (clamped to the
// desk), Reset desk; each applies live on the stage; Export cut carries shot.deskEdits; reload keeps it; the importer
// (build-round8-director --import + the pass, in a temp copy of the hq dir) writes sceneDeskEdits into review-cut.json
// and the film layer (film-fx / film-desk-edits.mjs) puts a fresh stage in the same state.
//
//   node tests/director-desk-select-e2e.mjs        (BASE=http://127.0.0.1:3121 to use a running server)
// SHOTS=<dir> keeps the screenshots. Downloads go to a temp folder (never ~/Downloads).
// Run it under the browser-test gate (scratchpad slot.sh).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director desks e2e: skipped (${HQ} has no oilers chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const near=(a,b,eps=.06)=>Math.abs(a-b)<=eps;
const IN=25.4,ID='station-student-standing',FEATURED_NAME='Cinematic demonstration desk';
try{
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await page.evaluateOnNewDocument(()=>{
    window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,desks:w.ErgoFlex.sceneDesks};};
    window.__rec=id=>{const {desks}=__t(),r=desks.records.get(id);return r?{size:r.state.size,x:r.group.position.x,z:r.group.position.z,yaw:r.group.rotation.y,height:r.state.height,tilt:r.state.tilt,poseAt:r.poseAt}:null;};
    window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].deskEdits||null;}catch{return null;}};
    // The screen point of a desk's bare body (not a prop riding on it): scan the desk's box for a ray that hits it.
    window.__deskPoint=id=>{const {w,t,T,desks}=__t(),r=desks.records.get(id),box=new T.Box3().setFromObject(r.group),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
      const ours=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx)return true;return false;};
      const item=o=>{for(let p=o;p&&p!==r.group;p=p.parent)if(p.userData?.directorAdd||p.userData?.sceneAsset||p.userData?.dayKit||/^Accessory:|^(Scene dressing|Accessory mount|Desk dressing):|:(desktop|shelf|lower-shelf|base-shelf)$/.test(p.name||''))return true;return false;};
      let best=null;const xs=[],ys=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).project(t.camera);xs.push(v.x);ys.push(v.y);}
      const x0=Math.max(-.95,Math.min(...xs)),x1=Math.min(.95,Math.max(...xs)),y0=Math.max(-.95,Math.min(...ys)),y1=Math.min(.95,Math.max(...ys));
      for(let i=0;i<=40&&!best;i++)for(let j=0;j<=40&&!best;j++){
        const v={x:x0+(x1-x0)*i/40,y:y0+(y1-y0)*j/40};
        ray.setFromCamera(new T.Vector2(v.x,v.y),t.camera);
        const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&!ours(h.object)&&h.object.visible);
        if(!hit)continue;let q=hit.object,own=false;for(;q;q=q.parent)if(q===r.group){own=true;break;}
        if(own&&!item(hit.object))best={x:f.left+c.left+(v.x+1)/2*c.width,y:f.top+c.top+(1-v.y)/2*c.height,mesh:hit.object.name};
      }
      return best;};
    window.__frame=id=>{const {t,T,desks}=__t(),r=desks.records.get(id),b=new T.Box3().setFromObject(r.group),c=b.getCenter(new T.Vector3());t.camera.position.set(c.x+.2,c.y+1.6,c.z+2.6);t.controls.target.copy(c);t.camera.lookAt(c);t.controls.update();};
    window.__handle=()=>{const {t,T}=__t();let g=null;t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});if(!g||!g.visible)return null;
      const h=g.children.find(o=>o.isGroup),p=h.getWorldPosition(new T.Vector3()).project(t.camera),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect();
      return {x:f.left+c.left+(p.x+1)/2*c.width,y:f.top+c.top+(1-p.y)/2*c.height};};
    window.__toolsVisible=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});return !!g?.visible;};
  });
  await openChapter(page,base,chapter);
  const status=()=>statusOf(page);
  const click=async(sel,ms=700)=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(ms);};
  const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
  const rec=id=>page.evaluate(i=>__rec(i),id);
  const draft=()=>page.evaluate(()=>__draft());
  const header=()=>page.$eval('#director-panel [data-selected-header]',e=>e.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
  const setField=async(name,value)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(900);};
  const tab=()=>page.$eval('#director-panel [data-inspector-tab][aria-pressed=true]',b=>b.dataset.inspectorTab);
  const rows=()=>page.$$eval('#director-panel [data-desk-list] .desk-row',l=>l.map(b=>({id:b.dataset.section,text:b.textContent.replace(/\s+/g,' ').trim(),featured:b.classList.contains('is-featured'),on:b.getAttribute('aria-pressed')==='true'})));
  const live=async(fn,what,ms=30000)=>until(fn,what,ms);   // the stage re-applies a moment after the edit
  await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the room\'s desks on the stage',90000);await wait(2500);

  // ---- the Desks list: every desk record of the room, the featured one marked, named by state.name
  await click('#director-panel [data-inspector-tab=desks]');
  const ids=await page.evaluate(()=>[...__t().desks.records.keys()]);
  const list=await rows();
  check(ids.length>=5&&list.length===ids.length&&list.every((r,i)=>r.id===ids[i]),`the list has every record of the room (${list.length}): ${list.map(r=>r.id).join(', ')}`);
  check(list.filter(r=>r.featured).length===1&&list.find(r=>r.featured).id==='main'&&list.find(r=>r.featured).text.includes(FEATURED_NAME)&&/featured/.test(list.find(r=>r.featured).text),'the featured desk is marked and named by state.name: '+list.find(r=>r.featured).text);
  check(list.some(r=>r.id===ID&&/Surf forecast standing desk/.test(r.text)&&/48″/.test(r.text)),'a room desk is named by its state.name with its size: '+list.find(r=>r.id===ID)?.text);
  check(await draft()===null||(await draft()).length===0,'no desk edits yet');
  const orig=await rec(ID);

  // ---- select via the list
  await click(`#director-panel [data-desk-list] [data-section="${ID}"]`);
  check(/Desk · Surf forecast standing desk/.test(await header()),'selected from the list: header "'+await header()+'"');
  check((await rows()).find(r=>r.id===ID).on,'the list row shows it selected');
  check(await until(()=>page.evaluate(()=>__toolsVisible()),'selection box',10000).catch(()=>false),'the stage outlines the selected desk (box, footprint, handle)');
  check(await page.$eval('#director-panel .desk-size [aria-pressed=true]',b=>b.textContent.trim())==='48″','the panel shows its 48″ size');
  await page.evaluate(()=>__frame('station-student-standing'));await wait(500);
  await page.screenshot({path:path.join(shots,'desk-selected-list.png')});

  // ---- Size: 60″ through the record's own size switch (the right model shows)
  await click('#director-panel [data-action=dk-size][data-section="60x30"]');
  await live(async()=>(await rec(ID))?.size==='60x30','the record switches to 60x30');
  const sized=await rec(ID);
  check(sized.size==='60x30'&&near(sized.x,orig.x,1)&&near(sized.z,orig.z,1),'size: the desk is 60″ on the stage, in the same place');
  let d=await draft();check(d?.length===1&&d[0].desk===ID&&d[0].size==='60x30'&&d[0].name==='Surf forecast standing desk','draft deskEdits: '+JSON.stringify(d));
  const width=await page.evaluate(id=>{const {T,desks}=__t();const b=new T.Box3().setFromObject(desks.records.get(id).group);return Math.max(b.max.x-b.min.x,b.max.z-b.min.z);},ID);
  check(width>1.3,'the 60″ model is on the stage (footprint '+width.toFixed(2)+' m)');
  await page.screenshot({path:path.join(shots,'desk-size-60.png')});

  // ---- Position X / Z (inches) and Rotate (degrees), numbers and nudges
  await setField('dk-x',100);
  await live(async()=>near((await rec(ID)).x,100*IN,1),'x = 100″');
  check(true,'Position X 100″ moves the desk (x '+((await rec(ID)).x/IN).toFixed(1)+'″)');
  await click('#director-panel [data-action=dk-nudge][data-section="x:12"]');
  await live(async()=>near((await rec(ID)).x,112*IN,1),'x nudge +12″');
  check(true,'+12″ nudge: x '+((await rec(ID)).x/IN).toFixed(1)+'″');
  await setField('dk-z',60);await click('#director-panel [data-action=dk-nudge][data-section="z:-1"]');
  await live(async()=>near((await rec(ID)).z,59*IN,1),'z 60 then -1');
  check(true,'Position Z 60″ then −1″: z '+((await rec(ID)).z/IN).toFixed(1)+'″');
  await setField('dk-yaw',90);
  await live(async()=>near((await rec(ID)).yaw,Math.PI/2,.01),'yaw 90°');
  await click('#director-panel [data-action=dk-nudge][data-section="yaw:-15"]');
  await live(async()=>near((await rec(ID)).yaw,Math.PI/2-15*Math.PI/180,.01),'yaw nudge');
  check(true,'Rotate 90° then −15°: yaw '+((await rec(ID)).yaw*180/Math.PI).toFixed(1)+'°');
  const fields=await page.evaluate(()=>Object.fromEntries(['dk-x','dk-z','dk-yaw'].map(n=>[n,Number(document.querySelector(`#director-panel [name="${n}"]`).value)])));
  check(near(fields['dk-x'],112,.1)&&near(fields['dk-z'],59,.1)&&near(fields['dk-yaw'],75,.1),'the number fields read 112″ / 59″ / 75°: '+JSON.stringify(fields));

  // ---- Starting height / tilt, clamped to the desk (60″: full 65° needs 42.5″)
  await setField('dk-height-n',36);await setField('dk-tilt-n',20);
  await live(async()=>{const r=await rec(ID);return near(r.height,36,.1)&&near(r.tilt,20,.1);},'starts at 36 / 20');
  check(true,'Starting height 36″ / tilt 20° on the stage');
  await setField('dk-tilt-n',65);
  await live(async()=>near((await rec(ID)).tilt,65,.1),'tilt 65 raises the desk');
  const full=await rec(ID);check(near(full.tilt,65,.1)&&full.height>=42.4,`tilt 65° raises the desk for clearance: ${full.height}″ / ${full.tilt}°`);
  await setField('dk-height-n',28);
  const low=await live(async()=>{const r=await rec(ID);return near(r.height,28,.1)?r:null;},'height 28');
  check(low.tilt<65&&low.tilt>0,`height 28″ lowers the tilt to what the desk can hold: ${low.tilt}°`);
  await setField('dk-height-n',38);await setField('dk-tilt-n',25);
  await live(async()=>{const r=await rec(ID);return near(r.height,38,.1)&&near(r.tilt,25,.1);},'start 38 / 25');
  await page.evaluate(()=>document.querySelector('#director-panel .desk-inspector').scrollIntoView({block:'start'}));await wait(400);
  await page.screenshot({path:path.join(shots,'desk-panel.png')});
  const e1=(await draft())[0];
  check(e1.size==='60x30'&&near(e1.pose.x,112*IN,1)&&near(e1.pose.z,59*IN,1)&&near(e1.pose.yaw,75*Math.PI/180,.01)&&near(e1.initial.height,38)&&near(e1.initial.tilt,25),'the edit holds size, pose and initial: '+JSON.stringify(e1));

  // ---- the drag-on-floor handle
  await page.evaluate(()=>__frame('station-student-standing'));await wait(600);
  const h=await page.evaluate(()=>__handle());
  check(!!h,'the move handle is on the stage');
  const before=await rec(ID);
  await page.mouse.move(h.x,h.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(h.x+i*14,h.y+i*4);await wait(40);}await page.mouse.up();await wait(900);
  const after=await live(async()=>{const r=await rec(ID);return Math.hypot(r.x-before.x,r.z-before.z)>150?r:null;},'handle drag moved the desk');
  check(!!after,`dragging the handle moves the desk by ${(Math.hypot(after.x-before.x,after.z-before.z)/IN).toFixed(0)}″`);
  const e2=(await draft())[0];
  check(near(e2.pose.x,after.x,2)&&near(e2.pose.z,after.z,2),'and the edit follows it');
  check(near(Number(await page.$eval('#director-panel [name=dk-x]',e=>e.value)),after.x/IN,.2),'the X field follows the drag');
  check(/^Desk · Surf forecast standing desk/.test((await header()).replace(/^[^D]*/,''))||/Desk ·/.test(await header()),'still selected after the drag');

  // ---- Esc returns to the featured desk; a click on the desk in the view selects it
  await page.keyboard.press('Escape');await wait(500);
  check((await header())==='','Esc deselects (back to the featured desk)');
  check(!(await page.evaluate(()=>__toolsVisible())),'the outline is gone');
  // The camera is the film's here, so seek until a desk shows its bare body (not a monitor or a plant on it).
  let pt=null,clickId=null;
  for(const t of [7,9,12,4,1]){
    await seek(page,t);
    for(const id of ids.filter(i=>i!=='main')){pt=await page.evaluate(i=>__deskPoint(i),id);if(pt){clickId=id;break;}}
    if(pt)break;
  }
  check(!!pt,'found a bare desk point to click ('+clickId+': '+pt?.mesh+')');
  const clickName=await page.evaluate(i=>__t().desks.records.get(i).state.name,clickId);
  await page.screenshot({path:path.join(shots,'desk-before-click.png')});
  await page.mouse.click(pt.x,pt.y);await wait(900);
  check((await header()).includes('Desk · '+clickName),'a click on the desk in the view selects it: '+await header());
  check(await tab()==='desks','the Desks tab opens');
  await page.screenshot({path:path.join(shots,'desk-selected-click.png')});
  // click empty space: back to the featured desk
  await page.mouse.click(pt.x,pt.y);await wait(700);
  check((await header()).includes('Desk · '+clickName),'clicking the selected desk again keeps it selected');
  await page.keyboard.press('Escape');await wait(400);
  check((await header())==='','Esc after a click selection returns to the featured desk');
  // the featured desk goes to the Groove tab
  await click(`#director-panel [data-inspector-tab=desks]`);
  await click(`#director-panel [data-desk-list] [data-section="${ID}"]`);
  await click('#director-panel [data-desk-list] .is-featured');
  check(await tab()==='groove'&&(await header())==='','selecting the featured desk goes to the Groove tab');
  // list row for another desk (no edit) and back
  await click('#director-panel [data-inspector-tab=desks]');
  await click('#director-panel [data-desk-list] [data-section="station-window-research"]');
  check(/Desk · Coastal research nook/.test(await header()),'another desk selects from the list');
  const untouched=await rec('station-window-research');
  await setField('dk-x',untouched.x/IN+30);
  await live(async()=>near((await rec('station-window-research')).x,untouched.x+30*IN,1),'second desk moved');
  check((await draft()).length===2,'two desks edited: '+(await draft()).map(e=>e.desk).join(', '));
  // undo is one step per edit
  await click('#director-panel [data-action=undo]');
  await live(async()=>near((await rec('station-window-research')).x,untouched.x,1),'undo');
  check((await draft()).length===1,'Undo takes the second desk\'s edit back');
  await click('#director-panel [data-action=redo]');await live(async()=>(await draft())?.length===2,'redo');
  await page.keyboard.press('Escape');await wait(300);

  const mine=await draft();
  // ---- reload keeps it (the unexported draft in this browser), and the stage re-applies it
  await page.goto('about:blank');await openChapter(page,base,chapter);await wait(2500);
  const kept=await draft();check(JSON.stringify(kept)===JSON.stringify(mine),'reload keeps the desk edits in the draft');
  const re=await live(async()=>{const r=await rec(ID);return r?.size==='60x30'?r:null;},'the stage re-applies after reload').catch(async e=>{console.log('reload state',JSON.stringify(await rec(ID)),await status());throw e;});
  check(re.size==='60x30'&&near(re.x,mine.find(e=>e.desk===ID).pose.x,2)&&near(re.height,38,.1)&&near(re.tilt,25,.1),`after reload the desk is 60″ at its place and start (${re.height}″ / ${re.tilt}°)`);
  await click('#director-panel [data-inspector-tab=desks]');
  check((await rows()).filter(r=>/edited/.test(r.text)).length===2,'the list marks the two edited desks');

  // ---- Export cut carries deskEdits; the importer writes sceneDeskEdits into the film
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));
  check(JSON.stringify(exported.shots[0].deskEdits)===JSON.stringify(mine),'Export cut carries shot.deskEdits ('+mine.length+' desks)');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='oilers')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const ex=path.join(tmp,'Film-chapter-oilers-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  const py=path.join(root,'tools/experience/build-round8-director.py');
  execFileSync('python3',[py,H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[py,H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
  const strip=l=>l.map(({name,...e})=>e);
  check(JSON.stringify(strip(built.sceneDeskEdits))===JSON.stringify(strip(mine)),'review-cut.json oilers sceneDeskEdits = the export\'s deskEdits');
  const dc=JSON.parse(fs.readFileSync(path.join(H,'director-camera-oilers.json'),'utf8'));
  check(Array.isArray(dc.desks)&&dc.desks.length===2,'director-camera-oilers.json keeps them as "desks"');
  // a later export without the field keeps the earlier import's (like props)
  const bare=JSON.parse(fs.readFileSync(ex,'utf8'));delete bare.shots[0].deskEdits;const ex2=path.join(tmp,'Film-chapter-oilers-e2e2.json');fs.writeFileSync(ex2,JSON.stringify(bare));
  execFileSync('python3',[py,H,'--import',ex2],{stdio:'ignore'});
  check(JSON.parse(fs.readFileSync(path.join(H,'director-camera-oilers.json'),'utf8')).desks?.length===2,'an export without deskEdits keeps the earlier import\'s');
  // ...and an empty list clears them
  const empty=JSON.parse(fs.readFileSync(ex,'utf8'));empty.shots[0].deskEdits=[];const ex3=path.join(tmp,'Film-chapter-oilers-e2e3.json');fs.writeFileSync(ex3,JSON.stringify(empty));
  execFileSync('python3',[py,H,'--import',ex3],{stdio:'ignore'});execFileSync('python3',[py,H],{stdio:'ignore'});
  check(JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers').sceneDeskEdits===undefined,'deskEdits: [] (Reset all) clears sceneDeskEdits in the film');

  // ---- Reset desk / Reset all
  await click(`#director-panel [data-desk-list] [data-section="${ID}"]`);
  await click('#director-panel [data-action=dk-reset]');
  const back=await live(async()=>{const r=await rec(ID);return r?.size==='48x30'?r:null;},'reset desk');
  check(near(back.x,orig.x,1)&&near(back.z,orig.z,1)&&near(back.yaw,orig.yaw,.01)&&near(back.height,orig.height,.1)&&near(back.tilt,orig.tilt,.1),'Reset desk: back to the film\'s 48″, place and start');
  check((await draft()).length===1,'its edit is gone, the other stays');
  await click('#director-panel [data-action=dk-reset-all]');
  await live(async()=>near((await rec('station-window-research')).x,untouched.x,1),'reset all');
  check((await draft()).length===0,'Reset all desks to the film clears every edit');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(error){console.log('FAIL',error.stack||error.message);failures.push(error.message);}
finally{await close();if(!process.env.SHOTS)fs.rmSync(tmp,{recursive:true,force:true});}
if(failures.length){console.log(`\n${failures.length} FAILED`);process.exit(1);}
console.log('\nDirector desks e2e: all ok');
