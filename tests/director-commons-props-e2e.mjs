// Director Props in the Humboldt library (film chapter 4, commons: room library, group kind, 60x30), end to end in real
// GPU Chrome. Studio's own room editing (studio.js RoomInteractions: click-drag a furnishing, Delete) used to take the
// click first in this room and move the prop where nothing records it, so his commons prop moves never reached the
// cut. Now: real clicks select library furnishings (an oak study chair, the reading lamp on the study table, the ficus),
// a gizmo drag moves the chair, the inspector turns the lamp, Delete hides the ficus; the draft and Export cut
// carry the three edits; Render still places them like the live view; a reload re-applies them; Export ->
// build-round8-director --import + pass (temp copy) gives the film's sceneEdits; an item the film can't keep says so.
// Serves this checkout on a free port with a temp studio state; downloads go to a temp folder (never ~/Downloads).
// Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-commons-props-e2e.mjs   (STILLS=0 skips the still)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,HQ,chapterList,wait} from './director-e2e-harness.mjs';
import {filmPropEdits} from '../experience/prop-edits.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-commons-props-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-commons-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage(),cdp=await page.createCDPSession(),errors=[];
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/reload.js'}]});
cdp.on('Fetch.requestPaused',e=>cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{}));
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
async function openChapter(id){
  const c=chapterList().find(x=>x.id===id);await page.goto(BASE+c.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1500);
}
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__find=(test,scene)=>{let o=null;(scene||__t().t.scene).traverse(x=>{if(!o&&test(x))o=x;});return o;};
  window.__byKey=(key,scene)=>__find(x=>x.userData.sceneAssetKey===key,scene);
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height,on:Math.abs(c.x)<.95&&Math.abs(c.y)<.95&&c.z<1};};
  window.__pose=o=>{const {T}=__t();o.updateWorldMatrix(true,false);return {p:o.getWorldPosition(new T.Vector3()).toArray(),r:o.rotation.toArray().slice(0,3),visible:(()=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;})()};};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].propEdits||null;}catch{return null;}};
  // A screen point where a click's first hit lies inside o (the camera can see it there).
  window.__clickPoint=o=>{const {t,T}=__t(),f=document.getElementById('stage'),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect(),rc=new T.Raycaster(),box=new T.Box3().setFromObject(o);
    const inside=x=>{for(let p=x;p;p=p.parent)if(p===o)return true;return false;},shown=x=>{for(let p=x;p;p=p.parent)if(!p.visible)return false;return true;};
    const ours=x=>{for(let p=x;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls||/^Cinematic effects$|^Film lights$/.test(p.name))return true;return false;};
    for(let i=0;i<400;i++){const u=i/400,pt=new T.Vector3(box.min.x+(box.max.x-box.min.x)*((i*.618)%1),box.min.y+(box.max.y-box.min.y)*((i*.382)%1),box.min.z+(box.max.z-box.min.z)*u).project(t.camera);
      if(Math.abs(pt.x)>.92||Math.abs(pt.y)>.92)continue;rc.setFromCamera(new T.Vector2(pt.x,pt.y),t.camera);const h=rc.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!ours(h.object));
      if(h&&inside(h.object))return {x:fr.left+r.left+(pt.x+1)/2*r.width,y:fr.top+r.top+(1-pt.y)/2*r.height};}
    return null;};
});
const draft=()=>page.evaluate(()=>__draft());
const near=(a,b,eps=2e-3)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=eps);
async function clickOn(key){const at=await page.evaluate(k=>__clickPoint(__byKey(k)),key);if(!at)throw Error('no visible point on '+key);await page.mouse.click(at.x,at.y);await wait(900);}
async function setField(name,value){await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(900);}
// Library props of three kinds: a floor chair, an item on the study table, a decor plant (Studio scene asset keys).
const pickKey=async(test,what)=>until(()=>page.evaluate(src=>{const t=new Function('o','return '+src);let best=null;__t().t.scene.traverse(o=>{if(!best&&o.userData.sceneAssetKey&&t(o)&&__clickPoint(o))best=o.userData.sceneAssetKey;});return best;},test),what,15000);
try{
  await openChapter('commons');
  const studio0=(await (await fetch(BASE+'/api/studio-state')).json()).values['ergoflex.sceneAssets.v1'];
  check(await page.evaluate(()=>{const api=document.getElementById('stage').contentWindow.ErgoFlex;return api.roomInteractions?.enabled()===false&&api.sceneDesks?.ctx.objectsEditable()===false;}),'Studio\'s own room / desk-item editing is off in the Director stage');
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(500);
  const CHAIR=await pickKey("/^Oak study chair/.test(o.name)",'a visible oak study chair'),LAMP=await pickKey("/^Commons reading lamp$/.test(o.name)",'a visible reading lamp'),PLANT=await pickKey("/^Prop:ficus$/.test(o.name)",'a visible ficus');
  // ---- chair: real click, gizmo drag
  await clickOn(CHAIR);
  check(await page.evaluate(k=>__gizmo()?.object?.userData.sceneAssetKey===k,CHAIR)&&/^Oak study chair · \w+ selected/.test(await status()),'a click selects the library chair (gizmo on it): '+await status());
  const c0=await page.evaluate(k=>__pose(__byKey(k)),CHAIR);
  // The drag itself as the gizmo reports it (real handle drags: director-props-e2e); the click above is the real one.
  await page.evaluate(()=>{const g=__gizmo(),o=g.object,{T}=__t(),k=o.parent.getWorldScale(new T.Vector3()).x;g.dispatchEvent({type:'dragging-changed',value:true});o.position.x+=.3/k;o.position.z-=.2/k;o.updateMatrixWorld(true);g.dispatchEvent({type:'objectChange'});g.dispatchEvent({type:'dragging-changed',value:false});});await wait(700);
  check(/^Moved Oak study chair/.test(await status()),'gizmo drag: "Moved Oak study chair…"');
  let d=await until(async()=>(await draft())?.length===1&&await draft(),'draft: 1 edit');
  check(d[0].asset===CHAIR&&d[0].position&&Math.hypot(...d[0].position)>.01,'the chair\'s edit is keyed to its Studio item: '+JSON.stringify(d[0]));
  const c1=await until(async()=>{const p=await page.evaluate(k=>__pose(__byKey(k)),CHAIR);return near(p.p,c0.p.map((v,i)=>v+d[0].position[i]))&&p;},'live chair follows the move');
  // ---- lamp on the study table: inspector turn
  await clickOn(LAMP);check(/^Commons reading lamp selected/.test(await status()),'a click selects the reading lamp on the table');
  await setField('pp-ry',25);d=await until(async()=>{const x=await draft();return x?.length===2&&x;},'draft: 2 edits').catch(()=>null)||await draft();check(d.length===2&&d[1].asset===LAMP&&d[1].rotation?.[1]===25,'Turn y typed: the lamp turns 25° in the cut');
  // ---- ficus: Delete hides it
  await clickOn(PLANT);check(/^Ficus selected/.test(await status()),'a click selects the ficus');
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Delete');await wait(1000);
  d=await until(async()=>{const x=await draft();return x?.length===3&&x;},'draft: 3 edits').catch(()=>null)||await draft();const plantGone=await until(async()=>!(await page.evaluate(k=>__pose(__byKey(k)),PLANT)).visible,'ficus hidden on the stage').catch(()=>false);
  check(d.length===3&&d[2].asset===PLANT&&d[2].hide===true&&plantGone,'Delete hides the ficus in this chapter');
  check((await (await fetch(BASE+'/api/studio-state')).json()).values['ergoflex.sceneAssets.v1']===studio0,'Studio\'s room state is unchanged');
  const lamp1=await page.evaluate(k=>__pose(__byKey(k)),LAMP);
  // ---- an item the film can't keep apart (an identical twin at the same spot): the status says so on select and on move
  await page.evaluate(k=>{const o=__byKey(k),twin=o.clone();twin.userData={...o.userData};o.parent.add(twin);},CHAIR);await wait(300);
  await page.keyboard.press('Escape');await clickOn(CHAIR);
  check(/^This item can't be saved in the film yet: the film can't tell it apart from other items with the same name\. Moving Oak study chair · \w+ here won't be kept\.$/.test(await status()),'an item the film can\'t tell apart says so when selected: '+await status());
  const before=await draft(),cA=await page.evaluate(k=>__pose(__byKey(k)),CHAIR);
  const mid=await page.evaluate(()=>{const g=__gizmo(),o=g.object;g.dispatchEvent({type:'dragging-changed',value:true});o.position.x+=50;o.updateMatrixWorld(true);g.dispatchEvent({type:'objectChange'});return document.querySelector('#director-panel [data-status]').textContent;});
  check(/^This item can't be saved in the film yet: .* It goes back when you let go\.$/.test(mid),'…and at the moment it is moved: '+mid);
  await page.evaluate(()=>__gizmo().dispatchEvent({type:'dragging-changed',value:false}));await wait(600);
  check(/^This item can't be saved in the film yet: .* It is back where the film puts it\.$/.test(await status())&&JSON.stringify(await draft())===JSON.stringify(before)&&near((await page.evaluate(k=>__pose(__byKey(k)),CHAIR)).p,cA.p),'on release it goes back and the cut is unchanged: '+await status());
  await page.evaluate(k=>{const all=[];__t().t.scene.traverse(o=>{if(o.userData.sceneAssetKey===k)all.push(o);});all.at(-1).removeFromParent();},CHAIR);
  // Studio still moving something (the Director stage's guard) is reported at once too.
  await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.roomInteractions.onEditEnd([]));
  check(/^This item can't be saved in the film yet: Studio's room editing moved it/.test(await status()),'a Studio-side move says it can\'t be saved in the film');
  // ---- Render still = live
  if(process.env.STILLS!=='0'){
    await page.keyboard.press('Escape');await page.keyboard.press('r');await until(async()=>/Still rendered/.test(await status()),'Render still',240000);
    const both=await page.evaluate((ck,lk,pk)=>{const still=[...document.querySelectorAll('iframe')].find(f=>f.title==='Film still renderer').contentWindow,s=(()=>{let x=still.ErgoFlex.loadedModel;while(x.parent)x=x.parent;return x;})();
      const P=o=>{o.updateWorldMatrix(true,false);const v=new still.ErgoFlex.loadedModel.position.constructor();let shown=true;for(let p=o;p;p=p.parent)if(!p.visible)shown=false;return {p:o.getWorldPosition(v).toArray(),r:o.rotation.toArray().slice(0,3),shown};};
      return {chair:P(__byKey(ck,s)),lamp:P(__byKey(lk,s)),plant:P(__byKey(pk,s))};},CHAIR,LAMP,PLANT);
    check(near(both.chair.p,c1.p)&&near(both.lamp.r,lamp1.r,1e-4)&&!both.plant.shown,'Render still: the chair moved, the lamp turned, the ficus hidden, as in the live view');
    await page.keyboard.press('Escape');await wait(400);
  }
  const mine=await draft();
  // ---- reload before exporting: his unexported changes come back (the Keep-my-changes choice) and film-fx re-applies them
  await openChapter('commons');
  if(await page.$('[data-action=film-keep-draft][aria-pressed=false]')){await page.click('[data-action=film-keep-draft]');await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(1500);}
  const back=await until(()=>page.evaluate((ck,lk,pk)=>{const c=__byKey(ck),l=__byKey(lk),p=__byKey(pk);if(!c||!l||!p)return null;return {chair:__pose(c),lamp:__pose(l),plant:__pose(p),draft:__draft()};},CHAIR,LAMP,PLANT),'chapter after reload');
  check(JSON.stringify(back.draft)===JSON.stringify(mine),'after a reload the cut still has the 3 edits');
  const ok=v=>near(v.chair.p,c1.p)&&near(v.lamp.r,lamp1.r,1e-4)&&!v.plant.visible;
  const shown=await until(async()=>{const v=await page.evaluate((ck,lk,pk)=>({chair:__pose(__byKey(ck)),lamp:__pose(__byKey(lk)),plant:__pose(__byKey(pk))}),CHAIR,LAMP,PLANT);return ok(v)&&v;},'edits on the stage after reload').catch(async()=>{console.log('after reload',JSON.stringify(await page.evaluate((ck,lk,pk)=>({chair:__pose(__byKey(ck)),lamp:__pose(__byKey(lk)),plant:__pose(__byKey(pk))}),CHAIR,LAMP,PLANT)),'expected',JSON.stringify({c1,lamp1}));return null;});
  check(!!shown,'after a reload the stage shows them (chair moved, lamp turned, ficus hidden)');
  // ---- Export cut
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));
  check(exported.shots[0].id==='commons'&&JSON.stringify(exported.shots[0].propEdits)===JSON.stringify(mine)&&mine.length===3,'Export cut carries the 3 commons prop edits');
  // ---- Export -> build-round8-director --import + pass on a temp copy: the film's sceneEdits
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='commons')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const hand=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='commons').sceneEdits.filter(e=>!e.director);
  const ex=path.join(tmp,'Film-chapter-commons-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='commons');
  check(JSON.stringify(built.sceneEdits)===JSON.stringify([...hand,...mine.map(e=>({...e,director:true}))])&&JSON.stringify(filmPropEdits(built))===JSON.stringify(mine),'the film\'s commons sceneEdits carry them (director: true)');
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log(passed.map(p=>'ok - '+p).join('\n'));console.log(`director-commons-props-e2e: ${passed.length} checks passed`);
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});}
