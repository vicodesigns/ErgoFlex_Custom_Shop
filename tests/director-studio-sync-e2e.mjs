// Studio <-> Director sync end to end (docs/director-studio-sync-pr-draft.md, phase 1): a Studio tab and a Director tab
// of one browser against one studio server (--no-watch) with a temp copy of the state. Never :3000, never the
// checkout's studio-state.json, downloads denied.
//   props (chapter 4, Commons)
//     Studio moves a prop -> the Director shows "Studio changed: 1 edit · Refresh" -> Refresh puts it on the stage
//     with the chapter's edit and the undo history intact; the chapter also edits that prop, so the conflict is
//     listed: keep (nothing changes), then take Studio's (the edit is dropped, one Undo brings it back).
//   desks (chapter 6, Oilers)
//     a Director desk edit -> Make permanent in Studio… (blocked rows: the featured desk, the desk the film moves) ->
//     the state API has it, other rooms untouched, the chapter keeps its edit -> the Studio tab's badge, and the desk
//     in Studio after a reload; a Studio desk edit -> Refresh offers it -> take it -> the stage desk moves -> Undo.
//   No EventSource is opened by any of it.
// Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-studio-sync-e2e.mjs   (SHOTS=<dir> keeps screenshots)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,HQ,chapterList,wait} from './director-e2e-harness.mjs';
import {decodeStoredJSON} from '../browser-design-storage.mjs';

const commons=chapterList()?.find(c=>c.id==='commons'),oilers=chapterList()?.find(c=>c.id==='oilers');
if(!commons||!oilers||!fs.existsSync(path.join(root,commons.page))){console.log(`Studio sync e2e: skipped (${HQ} has no chapter pages in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'studio-sync-e2e-')),shots=process.env.SHOTS||path.join(tmp,'shots');fs.mkdirSync(shots,{recursive:true});
// The scratch state: the checkout's, without the autosave ring and the saved cuts (several MB of browser storage).
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root,'--no-watch'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'studio-sync-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const errors=[],eventSources=[];
async function tab(name){
  const page=await browser.newPage(),cdp=await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior',{behavior:'deny'}).catch(()=>{});
  page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
  page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(`${name}: ${t}`);if(process.env.LOG)console.log(`[${name}]`,t.slice(0,240));});
  page.on('request',r=>{if(/__studio\/events/.test(r.url()))eventSources.push(name);});
  // The chapter films carry Director edits of their own (Commons moves this very chair). This test is about one chapter
  // edit against one Studio change, so the Director is served the films without them (as tests/director-props-e2e.mjs).
  if(name==='director'){
    await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/director-film/*.json*'}]});
    cdp.on('Fetch.requestPaused',async e=>{
      try{const film=JSON.parse(fs.readFileSync(path.join(root,HQ,'director-film',e.request.url.match(/director-film\/([\w-]+\.json)/)[1]),'utf8'));film.sceneEdits=(film.sceneEdits||[]).filter(x=>!x.director);
        await cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'},{name:'cache-control',value:'no-store'}],body:Buffer.from(JSON.stringify(film)).toString('base64')});}
      catch{cdp.send('Fetch.continueRequest',{requestId:e.requestId}).catch(()=>{});}
    });
  }
  return page;
}
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok  '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const state=async()=>(await (await fetch(BASE+'/api/studio-state')).json()).values;
const ASSETS='ergoflex.sceneAssets.v1',DESKS='ergoflex.sceneDesksBySizeV2';
let director=null,studio=null;
try{
  director=await tab('director');studio=await tab('studio');
  const status=()=>director.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
  const refreshLabel=()=>director.$eval('[data-studio-refresh]',e=>e.textContent).catch(()=>'');
  const undoOn=()=>director.$eval('#director-panel [data-action=undo]',b=>!b.disabled);
  // A background tab gets no animation frames: whichever tab is being driven is in front, as it is for a person.
  async function openChapter(chapter){
    await director.bringToFront();await director.goto(BASE+chapter.page);
    await director.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
    await director.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1200);
  }
  await director.evaluateOnNewDocument(()=>{
    window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,api:w.ErgoFlex};};
    window.__find=test=>{let o=null;__t().t.scene.traverse(x=>{if(!o&&test(x))o=x;});return o;};
    window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height};};
    window.__shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    // Studio's own transform of a prop: local under its parent, without the room's daily staging (as the Props dialog writes it).
    window.__canon=o=>{const {T}=__t();o.updateWorldMatrix(true,false);o.parent.updateWorldMatrix(true,false);const M=new T.Matrix4().copy(o.parent.matrixWorld).invert().multiply(o.matrixWorld),d=o.userData.dailyDelta;if(d)M.premultiply(new T.Matrix4().fromArray(d).invert());
      const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();M.decompose(p,q,s);return {p:{x:p.x,y:p.y,z:p.z},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:s.x,y:s.y,z:s.z},world:o.getWorldPosition(new T.Vector3()).toArray(),scale:o.parent.getWorldScale(new T.Vector3()).x};};
    window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}};
    window.__rec=id=>{const r=__t().api.sceneDesks.records.get(id);return r?{size:r.state.size,x:r.group.position.x,z:r.group.position.z,yaw:r.group.rotation.y,name:r.state.name}:null;};
  });

  // ================================================================ props (Commons)
  await studio.bringToFront();await studio.goto(BASE+'/?view=product');   // any Studio page: it only has to be Studio's storage and Studio's sync client
  await studio.waitForFunction(()=>!!window.__studioState&&!!window.ErgoFlex?.wheelRigs,{timeout:180000});
  await openChapter(commons);
  check(/^Refresh from Studio$/.test(await refreshLabel()),'the Director has a Refresh from Studio button');
  const sources0=eventSources.length;
  const CHAIR='Prop:steelcase-leap-v2',CHAIR_ID='scene:library:humboldt:room:0:steelcase-leap-v2',SCENE='library:humboldt';
  const chair=()=>director.evaluate(n=>{const o=__find(x=>x.name===n);return {...__canon(o),shown:__shown(o)};},CHAIR);
  const c0=await chair();
  // The chapter's own edit of the chair (Delete hides it): an edit and an undo step to keep.
  const at=await director.evaluate(n=>__screen(__find(x=>x.name===n)),CHAIR);await director.mouse.click(at.x,at.y);await wait(900);
  await director.keyboard.press('Delete');await until(async()=>!(await chair()).shown,'the chair is hidden in this chapter');
  await wait(700);
  const edit0=await director.evaluate(()=>JSON.stringify(__draft().propEdits));
  check(/"hide":true/.test(edit0)&&await undoOn(),'the chapter hides the chair: one prop edit, one undo step');
  // Studio moves the chair 0.4 m (the storage write Studio's own save makes, through Studio's sync client).
  const studioMove=(dx)=>studio.evaluate(async(key,scene,id,base,dx)=>{
    const all=JSON.parse(localStorage.getItem(key)||'{}'),room=all[scene]||={removed:[],added:[],transforms:{}};room.transforms||={};
    const t=room.transforms[id]||{p:base.p,q:base.q,s:base.s};room.transforms[id]={...t,p:{...t.p,x:t.p.x+dx}};
    localStorage.setItem(key,JSON.stringify(all));await window.__studioState.flush();return room.transforms[id].p.x;
  },ASSETS,SCENE,CHAIR_ID,c0,dx);
  const x1=await studioMove(.4/c0.scale);
  check(Math.abs((JSON.parse((await state())[ASSETS])[SCENE].transforms[CHAIR_ID].p.x)-x1)<1e-6,'Studio saved the move to the shared state');
  await until(async()=>/^Studio changed: 1 edit · Refresh$/.test(await refreshLabel()),'the Director badge',15000);
  check(true,'the Director shows "Studio changed: 1 edit · Refresh" (the existing 5 s poll)');
  check((await chair()).world[0]===c0.world[0],'nothing moved on the stage before the click');
  await director.screenshot({path:path.join(shots,'sync-1-badge.png')});
  await director.click('[data-studio-refresh]');
  await until(async()=>/^Refreshed from Studio: 1 prop change/.test(await status()),'Refresh from Studio',120000);
  await director.waitForSelector('#studio-adopt[open]',{timeout:10000});
  const rows=await director.$$eval('#studio-adopt li',l=>l.map(li=>li.textContent.replace(/\s+/g,' ').trim()));
  check(rows.length===1&&/Steelcase leap v2 edited in both.*Studio moved it.*the chapter: hidden/.test(rows[0]),'the conflict is listed: '+rows[0].slice(0,110));
  await director.screenshot({path:path.join(shots,'sync-2-conflict.png')});
  await director.click('#studio-adopt [data-adopt-cancel]');await wait(600);
  check(await director.evaluate(()=>JSON.stringify(__draft().propEdits))===edit0&&!(await chair()).shown,'keeping the chapter\'s edit changes nothing: still hidden, the edit as it was');
  check(/^Refresh from Studio$/.test(await refreshLabel()),'the badge is gone after the Refresh');
  check(await undoOn(),'the undo history survived the Refresh');
  await director.click('#director-panel [data-action=undo]');await until(async()=>(await chair()).shown,'Undo shows the chair again');
  const c1=await chair();
  check(Math.abs(c1.p.x-x1)<2e-3/c0.scale&&Math.abs(c1.world[0]-c0.world[0])+Math.abs(c1.world[2]-c0.world[2])>.2,`Undo after a Refresh works, and the chair is where Studio moved it (${(Math.hypot(c1.world[0]-c0.world[0],c1.world[2]-c0.world[2])).toFixed(2)} m from before)`);
  await director.click('#director-panel [data-action=redo]');await until(async()=>!(await chair()).shown,'Redo hides it again');
  // Studio moves it again: this time take Studio's.
  const x2=await studioMove(.3/c0.scale);
  await until(async()=>/^Studio changed: 1 edit · Refresh$/.test(await refreshLabel()),'the second badge',15000);
  await director.click('[data-studio-refresh]');
  await director.waitForSelector('#studio-adopt[open]',{timeout:120000});
  await director.click('#studio-adopt input[value=take]');
  check(/^Apply \(1 from Studio\)$/.test(await director.$eval('#studio-adopt [data-adopt-go]',b=>b.textContent)),'choosing Studio\'s enables Apply');
  await director.click('#studio-adopt [data-adopt-go]');
  await until(async()=>(await chair()).shown,'the chair shows after taking Studio\'s');
  // The draft is written a moment after an edit, and the stage settles a frame or two after the film layers re-install.
  await until(async()=>!/steelcase/.test(await director.evaluate(()=>JSON.stringify(__draft().propEdits)))&&Math.abs((await chair()).p.x-x2)<2e-3/c0.scale,'the chair at Studio\'s place without the chapter\'s edit');
  check(true,'taking Studio\'s drops the chapter\'s edit: the chair is where Studio has it');
  await director.click('#director-panel [data-action=undo]');await until(async()=>!(await chair()).shown,'one Undo hides the chair again');
  await until(async()=>await director.evaluate(()=>JSON.stringify(__draft().propEdits))===edit0,'the draft has the chapter\'s edit again');
  check(true,'one Undo brings the chapter\'s edit back');
  await director.click('#director-panel [data-action=redo]');await wait(500);
  check(eventSources.length===sources0,'two Refreshes and an Adopt opened no EventSource');

  // ================================================================ desks (Oilers)
  await openChapter(oilers);
  const ID='station-student-standing',FILM_MOVED='station-project-review',OTHER='station-window-research',ROOM='highschool/house';
  const desks0=decodeStoredJSON((await state())[DESKS]),r0=await director.evaluate(id=>__rec(id),ID);
  await director.click('#director-panel [data-inspector-tab="desks"]');await wait(500);
  check(await director.$eval('#director-panel [data-action=dk-permanent]',b=>b.disabled),'no desk edits: Make permanent in Studio… is off');
  for(const id of [ID,FILM_MOVED]){
    await director.click(`#director-panel [data-desk-list] [data-section="${id}"]`);await wait(700);
    await director.click('#director-panel [data-action="dk-nudge"][data-section="x:12"]');await wait(700);
  }
  const r1=await until(async()=>{const r=await director.evaluate(id=>__rec(id),ID);return Math.abs(r.x-r0.x-12*25.4)<1?r:null;},'the desk moved 12 in on the stage');
  await director.click('#director-panel [data-action=dk-permanent]');await director.waitForSelector('#desk-permanent[open]');
  const plan=await director.$$eval('#desk-permanent li',l=>l.map(li=>[li.textContent.replace(/\s+/g,' ').trim(),li.querySelector('input').disabled]));
  check(plan.length===3&&!plan[0][1]&&plan[1][1]&&/film's own setup also moves this desk/.test(plan[1][0])&&plan[2][1]&&/featured desk is the chapter's hero desk/.test(plan[2][0]),'the dialog: one desk can be written; the desk the film moves and the featured desk are blocked, with the reason');
  await director.screenshot({path:path.join(shots,'sync-3-desks-confirm.png')});
  const studioRev=await studio.evaluate(()=>window.__studioState.rev);
  await director.click('#desk-permanent [data-permanent-go]');
  await until(async()=>/^Wrote 1 desk to Studio \(highschool\/house\)/.test(await status()),'Make permanent, desks',20000);
  const desks1=decodeStoredJSON((await state())[DESKS]),written=desks1.rooms[ROOM].desks[ID];
  check(written&&Math.abs(written.pose.x-r1.x)<1&&Math.abs(written.pose.z-r1.z)<1,'the shared state has the desk where the Director put it');
  check(!desks1.rooms[ROOM].desks[FILM_MOVED]||JSON.stringify(desks1.rooms[ROOM].desks[FILM_MOVED])===JSON.stringify(desks0.rooms?.[ROOM]?.desks?.[FILM_MOVED]),'the blocked desk was not written');
  const others=d=>JSON.stringify(Object.fromEntries(Object.entries(d.rooms||{}).filter(([k])=>k!==ROOM)));
  check(others(desks1)===others(desks0),'no other room changed in Studio');
  await wait(600);
  check((await director.evaluate(()=>__draft().deskEdits)).some(e=>e.desk===ID),'the chapter keeps its desk edit');
  const changes=await (await fetch(`${BASE}/api/studio-state/changes?since=${studioRev}&client=studio-tab`)).json();
  check(changes.keys.some(k=>k.key===DESKS&&k.by==='Director'),'Studio\'s poll sees the write (what its "shared edits · Reload to see" badge shows)');
  await studio.bringToFront();await studio.goto(BASE+'/?room=highschool&layout=house');
  await studio.waitForFunction(()=>window.ErgoFlex?.wheelRigs?.length===4&&getComputedStyle(document.querySelector('#loader')).display==='none'&&window.ErgoFlex.sceneDesks?.key==='highschool/house',{timeout:240000});
  const inStudio=await until(()=>studio.evaluate(id=>{const r=ErgoFlex.sceneDesks.records.get(id);return r?.group?{x:r.group.position.x,z:r.group.position.z}:null;},ID),'the desk in Studio');
  check(Math.abs(inStudio.x-r1.x)<1&&Math.abs(inStudio.z-r1.z)<1,'after a reload Studio shows the desk where the Director put it');
  await studio.screenshot({path:path.join(shots,'sync-4-studio-after.png')});
  await director.bringToFront();
  const sources1=eventSources.length;
  // Studio moves another desk: the Director offers it, and takes it only when asked.
  const o0=await director.evaluate(id=>__rec(id),OTHER);
  const studioDesk=await studio.evaluate(async(key,room,id)=>{
    const {decodeStoredJSON,encodeStoredJSON}=await import('/browser-design-storage.mjs');
    ErgoFlex.sceneDesks.persist();const all=decodeStoredJSON(localStorage.getItem(key)),d=all.rooms[room].desks[id];d.pose={...d.pose,x:d.pose.x+400};
    localStorage.setItem(key,encodeStoredJSON(all));await window.__studioState.flush();return d.pose;
  },DESKS,ROOM,OTHER);
  await until(async()=>/^Studio changed: \d+ edits? · Refresh$/.test(await refreshLabel()),'the Director badge for the desk',15000);
  await director.click('[data-studio-refresh]');
  await director.waitForSelector('#studio-adopt[open]',{timeout:120000});
  const offer=await director.$$eval('#studio-adopt li',l=>l.map(li=>li.textContent.replace(/\s+/g,' ').trim()));
  const mine=offer.findIndex(t=>t.startsWith(o0.name));
  check(mine>=0&&/Studio changed its .*place/.test(offer[mine])&&!/edited in both/.test(offer[mine]),'the Studio desk change is offered (not a conflict): '+offer[mine]?.slice(0,90));
  check(Math.abs((await director.evaluate(id=>__rec(id),OTHER)).x-o0.x)<1,'the stage desk has not moved: the film keeps its own desks until asked');
  check((await director.evaluate(()=>__draft().deskEdits)).some(e=>e.desk===ID),'the chapter\'s own desk edit is intact after the Refresh');
  await director.evaluate(i=>{document.querySelectorAll('#studio-adopt li')[i].querySelector('input[value=take]').click();},mine);
  await director.click('#studio-adopt [data-adopt-go]');
  const o1=await until(async()=>{const r=await director.evaluate(id=>__rec(id),OTHER);return Math.abs(r.x-studioDesk.x)<1?r:null;},'the stage desk goes to Studio\'s place',30000);
  await until(async()=>(await director.evaluate(()=>__draft().deskEdits)).some(e=>e.desk===OTHER&&Math.abs(e.pose.x-studioDesk.x)<1),'the chapter desk edit with Studio\'s place');
  check(!!o1,'taking Studio\'s desk makes it a chapter desk edit and moves the stage desk');
  await director.click('#director-panel [data-action=undo]');
  await until(async()=>Math.abs((await director.evaluate(id=>__rec(id),OTHER)).x-o0.x)<1,'Undo puts the film\'s desk back',30000);
  check(true,'one Undo puts the film\'s desk back');
  check(eventSources.length===sources1,'a desk Refresh and Adopt opened no EventSource');
  assert.deepEqual(errors,[],'no page errors');
  console.log(`\nStudio sync e2e: ${passed.length} checks passed.`);
}catch(error){
  console.error('FAILED:',error.message);if(director)console.error('status:',await director.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>''));console.error('errors:',errors.join(' | ').slice(0,600));
  if(director)await director.screenshot({path:path.join(shots,'sync-failure.png')}).catch(()=>{});console.error('screenshots:',shots);process.exitCode=1;
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});}
