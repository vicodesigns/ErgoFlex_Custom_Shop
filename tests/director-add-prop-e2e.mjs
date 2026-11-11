// Director "+ Add prop" end to end (real GPU Chrome): the library browser (Props tab "+ Add prop", timeline "+ Prop":
// search, category chips, keyboard: type, arrows, Enter), adding the Smartphone (ergoflex-phone) on chapter 2's desk
// under the screen centre, selected with the gizmo, moved (a real gizmo drag and a typed number), riding the lift
// (3 s and 8 s, live and Render still), undo / redo, Delete removes it, recently used on top, a floor prop added in
// front of the camera and made permanent in Studio (this test's scratch state; the desk one is blocked with a reason),
// then Export cut -> build-round8-director --import + pass -> review-cut sceneEdits (a scratch copy of the hq dir).
// Serves this checkout on a free port with a temp copy of studio-state.json, downloads to a temp folder (never
// ~/Downloads). Run in a browser-test slot. SHOTS=<dir> keeps the screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,HQ,chapterList,wait} from './director-e2e-harness.mjs';
import {filmPropEdits} from '../experience/prop-edits.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-add-prop-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-add-prop-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage(),cdp=await page.createCDPSession(),errors=[];
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/reload.js'}]});
cdp.on('Fetch.requestPaused',e=>cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{}));
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError|sceneEdits\[\d+\] add/.test(t))errors.push(t);if(process.env.LOG)console.log('[page]',t.slice(0,240));});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const studioAssets=async()=>JSON.parse((await (await fetch(BASE+'/api/studio-state')).json()).values['ergoflex.sceneAssets.v1']||'{}');
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__still=()=>{const w=[...document.querySelectorAll('iframe')].find(f=>f.title==='Film still renderer')?.contentWindow;let s=w?.ErgoFlex?.loadedModel;while(s?.parent)s=s.parent;return s;};
  window.__added=(re,where)=>{const sc=where==='still'?__still():__t().t.scene;let o=null;sc?.traverse(x=>{if(!o&&new RegExp(re).test(x.name))o=x;});if(!o)return null;
    const path=[];for(let p=o;p&&p!==sc;p=p.parent)path.unshift(p.name||p.type);o.updateWorldMatrix(true,false);const v=o.getWorldPosition(o.position.clone()),pw=o.parent.getWorldPosition(o.position.clone());
    return {name:o.name,path:path.join(' > '),w:v.toArray(),parentW:pw.toArray(),s:o.getWorldScale(o.position.clone()).toArray()};};
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height,ndc:[c.x,c.y,c.z]};};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].propEdits||null;}catch{return null;}};
});
const draft=()=>page.evaluate(()=>__draft());
const addsOf=async asset=>((await draft())||[]).filter(e=>e.add?.asset===asset);
const PHONE='^Added prop:ergoflex-phone#',FICUS='^Added prop:ficus#';
const added=(re,where='live')=>page.evaluate((r,w)=>__added(r,w),re,where);
const near=(a,b,eps=2e-3)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=eps);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const key=async(k,mod)=>{if(mod)await page.keyboard.down(mod);await page.keyboard.press(k);if(mod)await page.keyboard.up(mod);await wait(900);};
async function openChapter(id){
  const c=chapterList().find(x=>x.id===id);await page.goto(BASE+c.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1200);
}
const seekTo=async sec=>{await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},sec);await wait(900);};
async function setField(name,value){await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(1200);}
async function dragHandle(axes,dir){
  const c=await page.evaluate(()=>__screen(__gizmo().object));let best=null;
  for(let r=10;r<240;r+=6)for(let a=0;a<360;a+=10){
    const x=c.x+r*Math.cos(a*Math.PI/180),y=c.y+r*Math.sin(a*Math.PI/180);await page.mouse.move(x,y);
    const axis=await page.evaluate(()=>__gizmo()?.axis);if(axes.includes(axis)&&(!best||r>best.r))best={r,a,x,y,axis};
  }
  if(!best)throw Error('no gizmo handle '+axes.join('/'));
  const {a}=best,x=c.x+(best.r-4)*Math.cos(a*Math.PI/180),y=c.y+(best.r-4)*Math.sin(a*Math.PI/180),[dx,dy]=dir==='tangent'?[-Math.sin(a*Math.PI/180)*70,Math.cos(a*Math.PI/180)*70]:[Math.cos(a*Math.PI/180)*45,Math.sin(a*Math.PI/180)*45];
  await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=6;i++){await page.mouse.move(x+dx*i/6,y+dy*i/6);await wait(30);}await page.mouse.up();await wait(900);return best.axis;
}
async function stillAt(sec,file){
  await seekTo(sec);await page.keyboard.press('r');
  await until(async()=>/Still rendered/.test(await status()),'Render still',240000);
  const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);if(url&&file)fs.writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));
  const out={still:await added(PHONE,'still'),live:null};await page.keyboard.press('Escape');await wait(500);out.live=await added(PHONE);return out;
}
const libOpen=()=>page.evaluate(()=>!!document.getElementById('prop-library')?.open);
try{
  await openChapter('rise');await seekTo(3);
  // ---- the library: Props tab "+ Add prop"
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(400);
  check(await page.$eval('#director-panel [data-action=pp-add]',b=>b.textContent==='+ Add prop'),'Props tab: "+ Add prop"');
  check(await page.$eval('#director-timeline [data-action=pp-add]',b=>b.textContent==='+ Prop'),'timeline toolbar: "+ Prop"');
  await page.click('#director-panel [data-action=pp-add]');await until(libOpen,'library opens');
  await until(()=>page.evaluate(()=>document.querySelectorAll('#prop-library .pl-card').length>500),'the library grid fills',30000);
  const lib0=await page.evaluate(()=>({focus:document.activeElement?.name,count:document.querySelector('[data-pl-count]').textContent,chips:[...document.querySelectorAll('#prop-library [data-pl-category]')].map(b=>b.textContent.trim()),title:document.getElementById('prop-library-title').textContent,
    thumb:document.querySelector('#prop-library .pl-card img').getAttribute('src'),fits:document.querySelector('#prop-library [name=pl-fits]').closest('label').textContent}));
  const total=Number(/of (\d+) models/.exec(lib0.count)?.[1]);
  check(lib0.title==='Prop library'&&lib0.focus==='pl-search'&&total>900,`the library browser: "${lib0.title}", search focused, ${lib0.count}`);
  check(lib0.chips[0].startsWith('All')&&lib0.chips.some(c=>/^Desk \d+/.test(c))&&lib0.chips.some(c=>/^Electronics \d+/.test(c)),'category chips: '+lib0.chips.slice(0,6).join(', ')+'…');
  check(/^\/assets\/props\/thumbs\/[^/]+\.png/.test(lib0.thumb),'Studio\'s thumbnails ('+lib0.thumb+')');check(/Fits this room \(home\)/.test(lib0.fits),'"Fits this room (home)" filter');
  // category chip + fits filter narrow it
  await page.click('#prop-library [data-pl-category=electronics]');await wait(300);
  const elec=await page.$$eval('#prop-library .pl-card small',l=>l.every(s=>/electronics/.test(s.textContent))&&l.length);check(elec>5,`Electronics chip: ${elec} models, all electronics`);
  await page.click('#prop-library [data-pl-category=all]');await wait(200);
  await page.click('#prop-library [name=pl-fits]');await wait(300);const fitN=Number(/^(\d+) of/.exec(await page.$eval('[data-pl-count]',e=>e.textContent))[1]);
  check(fitN>0&&fitN<total,`Fits this room: ${fitN} of ${total}`);await page.click('#prop-library [name=pl-fits]');await wait(300);
  // type to search (focus back in the search box after the clicks), arrows, Enter
  await page.keyboard.type('phone');await wait(500);
  const cards=await page.$$eval('#prop-library .pl-card',l=>l.map(c=>c.title));
  check(cards.some(t=>/ergoflex-phone/.test(t))&&cards.length<20&&cards.every(t=>/phone/i.test(t)),`search "phone": ${cards.length} models, the Smartphone among them`);
  await page.screenshot({path:path.join(shots,'add-prop-library.png')});
  await page.keyboard.press('ArrowDown');const down=await page.$eval('#prop-library .pl-card[aria-selected=true]',e=>Number(e.dataset.plIndex));await page.keyboard.press('ArrowUp');
  check(down>1&&await page.$eval('#prop-library .pl-card[aria-selected=true]',e=>e.dataset.plIndex)==='0','ArrowDown moves a row (to card '+down+'), ArrowUp back');
  const idx=cards.findIndex(t=>/ergoflex-phone/.test(t));for(let i=0;i<idx;i++)await page.keyboard.press('ArrowRight');
  check(/ergoflex-phone/.test(await page.$eval('#prop-library .pl-card[aria-selected=true]',e=>e.title)),'arrows move to the Smartphone');
  await page.keyboard.press('Enter');
  const ph=await until(()=>added(PHONE),'the phone on the stage',30000);
  check(!(await libOpen()),'Enter adds it and closes the library');
  check(/^Added Smartphone on the desk/.test(await status()),'status: '+await status());
  check(/Cinematic demonstration desk · ErgoFlex desk > Desk dressing:desktop > Added prop:ergoflex-phone#/.test(ph.path),'it goes on the featured desk\'s desktop (rides lift and tilt): '+ph.path);
  check(await until(()=>page.evaluate(()=>/^Added prop:ergoflex-phone#/.test(__gizmo()?.object?.name||'')),'gizmo'),'the new prop is selected with the gizmo');
  const center=await page.evaluate(()=>{const {t}=__t();let o=null;t.scene.traverse(x=>{if(/^Added prop:ergoflex-phone/.test(x.name))o=x;});return __screen(o).ndc;});
  check(Math.abs(center[0])<.6&&Math.abs(center[1])<.6,'placed under the screen centre (NDC '+center.slice(0,2).map(v=>v.toFixed(2)).join(', ')+')');
  check(Math.abs(ph.w[1]-ph.parentW[1])<2e-3,'on the desktop surface (height of the desk top)');
  let a0=(await addsOf('ergoflex-phone'))[0];check(a0&&a0.parent==='desk'&&a0.label==='Smartphone'&&/^\^Added prop:ergoflex-phone#[a-z0-9]+\$$/.test(a0.match),'the chapter edit: '+JSON.stringify(a0));
  const lane0=await page.$$eval('[data-props-lane] .prop-added',l=>l.map(b=>b.textContent));check(lane0.includes('+Smartphone'),'Props lane: "+Smartphone" chip (the + mark)');
  check(/Prop · Smartphone/.test(await page.$eval('[data-selected-header]',e=>e.textContent))&&await page.$eval('.prop-inspector h4',e=>e.textContent)==='Smartphone','Selected header and inspector: Smartphone');
  check(/rides lift and tilt/.test(await page.$eval('.prop-inspector .prop-name',e=>e.textContent))&&/travels with the desk/.test(await page.$eval('[data-studio-note]',e=>e.textContent)),'inspector: on the desk, Make permanent blocked with the reason');
  await page.screenshot({path:path.join(shots,'add-prop-on-desk.png')});
  // ---- move it: a real gizmo drag, then a typed number
  const p0=(await added(PHONE)).w;await dragHandle(['X','Z'],'radial');
  check(/^Moved Smartphone\./.test(await status()),'gizmo drag: "Moved Smartphone."');
  const a1=await until(async()=>{const x=(await addsOf('ergoflex-phone'))[0];return x&&!near(x.position,a0.position,1e-4)&&x;},'drag stored');
  const p1=await until(async()=>{const p=(await added(PHONE)).w;return dist(p,p0)>.01&&p;},'the phone moved on the stage');
  check(Math.abs(p1[1]-p0[1])<2e-3,'dragged along the desktop, still on it');
  await setField('pp-px',(p1[0]+.05).toFixed(3));
  const p2=await until(async()=>{const p=(await added(PHONE)).w;return Math.abs(p[0]-(p1[0]+.05))<2e-3&&p;},'typed x');check(true,'Position x typed moves it there');
  const a2=(await addsOf('ergoflex-phone'))[0];check(a2.parent==='desk'&&!near(a2.position,a1.position,1e-4),'the add entry holds the new place (desk frame)');
  // ---- rides the lift: 3 s and 8 s, live and Render still
  const live3=(await added(PHONE)).w;await seekTo(8);const live8=(await added(PHONE)).w;
  check(live8[1]-live3[1]>.05,`the phone rides the lift (y ${live3[1].toFixed(3)} -> ${live8[1].toFixed(3)})`);
  const s3=await stillAt(3,path.join(shots,'add-prop-still-3s.jpg')),s8=await stillAt(8,path.join(shots,'add-prop-still-8s.jpg'));
  check(s3.still&&s8.still,'Render still has the added phone');
  check(dist(s3.still.w,s3.live.w)<1e-3&&dist(s8.still.w,s8.live.w)<1e-3,`Render still = live view at 3 s and 8 s (Δ ${dist(s3.still.w,s3.live.w).toExponential(1)}, ${dist(s8.still.w,s8.live.w).toExponential(1)})`);
  check(Math.abs(s3.still.w[1]-s3.still.parentW[1])<2e-3&&Math.abs(s8.still.w[1]-s8.still.parentW[1])<2e-3,'Render still: on the desktop at both heights');
  await seekTo(3);
  // ---- undo / redo: typed x, drag, add
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());
  await key('z','Control');check(/^Undone: Moved Smartphone/.test(await status()),'Undo names the step: '+await status());
  check(near((await addsOf('ergoflex-phone'))[0].position,a1.position,1e-4),'undo: back to the dragged place');
  await key('z','Control');await key('z','Control');
  check(!(await addsOf('ergoflex-phone')).length,'undo the add: no add entry');await until(async()=>!(await added(PHONE)),'phone gone from the stage');check(true,'undo the add: gone from the stage');
  for(let i=0;i<3;i++)await key('y','Control');
  check(near((await addsOf('ergoflex-phone'))[0].position,a2.position,1e-4),'redo ×3: added and moved again');await until(()=>added(PHONE),'phone back');check(true,'redo: back on the stage');
  // ---- Delete removes it (select from the lane chip), undo brings it back
  await page.click('[data-props-lane] .prop-added');await wait(800);
  check(/^Added prop:ergoflex-phone#/.test(await page.evaluate(()=>__gizmo()?.object?.name||'')),'clicking its chip selects it');
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());await key('Delete');
  check(/^Removed Smartphone \(added in this chapter\)/.test(await status()),'Delete: "'+await status()+'"');
  await until(async()=>!(await added(PHONE)),'deleted');check(!(await addsOf('ergoflex-phone')).length,'Delete removes the add entry and the prop');
  await key('z','Control');await until(()=>added(PHONE),'undo delete');check((await addsOf('ergoflex-phone')).length===1,'undo brings it back');
  // ---- click-to-place: "Place on a surface…", then a free spot on the desktop
  await page.click('[data-props-lane] .prop-added');await wait(800);
  const spot=await page.evaluate(()=>{const {w,t,T}=__t(),top=w.ErgoFlex.sceneDesks.active.rig.mounts.desktop,rc=new T.Raycaster(),f=document.getElementById('stage'),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();
    const ours=o=>{for(let q=o;q;q=q.parent)if(q.userData?.directorTools||q.isTransformControls||q.userData?.directorAdd)return true;return false;},shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
    top.updateWorldMatrix(true,false);
    for(const [x,z] of [[-200,150],[200,150],[-250,-100],[250,-100],[0,250],[-350,250],[350,250],[0,-200]]){const p=top.localToWorld(new T.Vector3(x,0,z)),c=p.clone().project(t.camera);if(Math.abs(c.x)>.9||Math.abs(c.y)>.9)continue;
      rc.setFromCamera(new T.Vector2(c.x,c.y),t.camera);const h=rc.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!ours(h.object));
      if(h&&h.point.distanceTo(p)<.02)return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height,w:h.point.toArray()};}
    return null;});
  check(!!spot,'a free spot on the desktop in view');
  await page.click('#director-panel [data-action=pp-place]');await wait(300);check(/^Click a surface in the view to put Smartphone there/.test(await status()),'"Place on a surface…": '+await status());
  await page.mouse.click(spot.x,spot.y);await wait(1200);
  check(/^Placed Smartphone on the desk/.test(await status()),'status: '+await status());
  const placed=await until(async()=>{const p=await added(PHONE);return p&&Math.hypot(p.w[0]-spot.w[0],p.w[2]-spot.w[2])<.01&&p;},'placed at the click');
  check(/Desk dressing:desktop > Added prop/.test(placed.path)&&Math.abs(placed.w[1]-placed.parentW[1])<2e-3,'click-to-place: on the desktop where he clicked, still riding the desk');
  // ---- recently used on top (timeline "+ Prop"); Esc closes
  await page.click('#director-timeline [data-action=pp-add]');await until(libOpen,'library reopens');
  const recent=await page.evaluate(()=>{const h=[...document.querySelectorAll('#prop-library .pl-scroll h3')].map(x=>x.textContent),first=document.querySelector('#prop-library .pl-grid .pl-card');return {h,first:first?.title,active:document.querySelector('#prop-library .pl-card[aria-selected=true]')?.title};});
  check(recent.h[0]==='Recently used'&&/ergoflex-phone/.test(recent.first),'"Recently used" on top: '+recent.first);
  await page.keyboard.press('Escape');await wait(400);check(!(await libOpen()),'Esc closes the library');
  // ---- a floor prop in front of the camera, made permanent in Studio
  await page.click('#director-timeline [data-action=pp-add]');await until(libOpen,'library for the ficus');
  await page.keyboard.type('ficus');await wait(400);const first=await page.$eval('#prop-library .pl-card[aria-selected=true]',e=>e.title);
  check(/· ficus/.test(first),'search "ficus": the first card is active ('+first+')');await page.keyboard.press('Enter');
  const fi=await until(()=>added(FICUS),'the ficus on the stage',30000);
  check(/^Room:home > Added prop:ficus#/.test(fi.path)&&/on the floor in front of the camera/.test(await status()),'a floor prop goes in the room, in front of the camera: '+fi.path);
  check(Math.abs(fi.w[1]-fi.parentW[1])<2e-3,'on the floor');
  const studio0=await studioAssets();
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(400);
  await page.click('#director-panel [data-action=pp-permanent]');await wait(500);
  const rows=await page.$$eval('#prop-permanent li',l=>l.map(li=>({t:li.textContent.replace(/\s+/g,' ').trim(),off:li.querySelector('input').disabled})));
  const fRow=rows.findIndex(r=>/^Ficus/i.test(r.t)),pRow=rows.findIndex(r=>/^Smartphone/.test(r.t));
  check(fRow>=0&&!rows[fRow].off&&/added to the room → a new item in the room in Studio/.test(rows[fRow].t),'confirm panel: the ficus can be added to Studio: '+rows[fRow]?.t);
  check(pRow>=0&&rows[pRow].off&&/travels with the desk/.test(rows[pRow].t),'the desk-attached phone is blocked with the reason: '+rows[pRow]?.t);
  await page.screenshot({path:path.join(shots,'add-prop-permanent.png')});
  await page.$$eval('#prop-permanent [data-permanent]',(l,keep)=>{for(const el of l)if(Number(el.dataset.permanent)!==keep&&el.checked){el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));}},fRow);
  await page.click('#prop-permanent [data-permanent-go]');
  await until(async()=>/^Made 1 prop permanent in Studio/.test(await status()),'make permanent',20000);await wait(2500);
  const studio1=await studioAssets(),roomKey=Object.keys(studio1).find(k=>JSON.stringify(studio1[k])!==JSON.stringify(studio0[k]));
  const item=studio1[roomKey]?.added?.find(a=>a.propId==='ficus'&&!(studio0[roomKey]?.added||[]).some(b=>b.editorId===a.editorId));
  check(!!item&&studio1[roomKey].transforms[item.editorId],`Studio state: a new ficus item in ${roomKey} (added + transform) through POST /api/studio-state`);
  check(Object.keys(studio1).filter(k=>JSON.stringify(studio1[k])!==JSON.stringify(studio0[k])).length===1,'only that room changed in Studio');
  check(!(await addsOf('ficus')).length&&(await addsOf('ergoflex-phone')).length===1,'the ficus\'s chapter edit is folded in; the phone stays a chapter edit');
  const copy=await until(()=>page.evaluate(k=>{let o=null;__t().t.scene.traverse(x=>{if(x.userData.sceneAssetKey===k)o=x;});if(!o)return null;o.updateWorldMatrix(true,false);return o.getWorldPosition(o.position.clone()).toArray();},item.editorId.slice(6)),'Studio copy on the stage');
  check(dist(copy,fi.w)<2e-3,'Studio\'s ficus stands where he put it on the stage');
  // ---- Export cut -> import -> pass -> review-cut (a scratch copy of the hq dir)
  const mine=await draft();
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));check(JSON.stringify(exported.shots[0].propEdits)===JSON.stringify(mine),'Export cut carries the added phone');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='rise')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const ex=path.join(tmp,'Film-chapter-rise-add-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='rise'),phoneEdit=mine.find(e=>e.add?.asset==='ergoflex-phone');
  check(JSON.stringify((built.sceneEdits||[]).find(e=>e.add?.asset==='ergoflex-phone'))===JSON.stringify({...phoneEdit,director:true}),'review-cut: rise\'s sceneEdits carry the added phone (director: true)');
  check(JSON.stringify(filmPropEdits(built))===JSON.stringify(mine),'reopened from the rebuilt film, the Director shows the same edits, the added phone with them');
  // ---- Reset all props to the film removes the added one
  await page.click('#director-panel [data-action=pp-reset-all]');await wait(1200);
  check(/added prop removed/.test(await status()),'Reset all: "'+await status()+'"');await until(async()=>!(await added(PHONE)),'reset removes');check(true,'Reset to the film removes the added phone');
  check(!errors.length,'no page errors, module "not exported" errors or add warnings'+(errors.length?': '+errors.join(' | '):''));
  console.log(passed.map(p=>'ok  '+p).join('\n'));
  console.log(`Director add prop e2e: ${passed.length} checks passed. Screens in ${shots}`);
}catch(error){
  console.log(passed.map(p=>'ok  '+p).join('\n'));await page.screenshot({path:path.join(shots,'add-prop-failure.png')}).catch(()=>{});console.error('FAILED:',error.message,'\nstatus:',await status(),'\nerrors:',errors.join(' | '));process.exitCode=1;
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});if(!process.env.SHOTS)fs.rmSync(tmp,{recursive:true,force:true});else fs.rmSync(downloads,{recursive:true,force:true});}
