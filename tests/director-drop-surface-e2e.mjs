// Director "Drop to surface" end to end (real GPU Chrome): select a prop, raise it 10" (typed Position y), Drop to
// surface (the button and the End key) -> its box bottom is back on the surface within 1 mm; tilt it 20" -> Drop flat
// -> upright and resting; Align to surface; nothing below (moved far out of the room) -> no move and a message; the
// drop is one undo step; Export cut carries the edit like a manual move. Both a room prop (the chair, on the floor)
// and a desk item (the wide monitor, rides the desk).
// Serves this checkout on a free port with a temp copy of studio-state.json, downloads to a temp folder (never
// ~/Downloads). Run in a browser-test slot. SHOTS=<dir> keeps the screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,chapterList,wait} from './director-e2e-harness.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-drop-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-drop-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage(),cdp=await page.createCDPSession(),errors=[];
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/reload.js'}]});
cdp.on('Fetch.requestPaused',e=>cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{}));
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);if(process.env.LOG)console.log('[page]',t.slice(0,240));});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__find=test=>{let o=null;__t().t.scene.traverse(x=>{if(!o&&test(x))o=x;});return o;};
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height};};
  // The prop's box bottom (m), its local up in the world (tilt = angle from vertical, deg) and its position.
  window.__body=name=>{const {T}=__t(),o=__find(x=>name[0]==='^'?new RegExp(name).test(x.name):x.name===name);o.updateWorldMatrix(true,true);const up=new T.Vector3(0,1,0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion()));
    return {minY:new T.Box3().setFromObject(o).min.y,tilt:Math.acos(Math.min(1,up.y))*180/Math.PI,p:o.getWorldPosition(new T.Vector3()).toArray(),q:o.getWorldQuaternion(new T.Quaternion()).toArray()};};
  // The surface under the prop's box centre, found independently: the first visible mesh hit below its bottom + 5 cm.
  window.__surfaceY=name=>{const {t,T}=__t(),o=__find(x=>new RegExp(name).test(x.name)),b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3()),within=m=>{for(let p=m;p;p=p.parent)if(p===o)return true;return false;},shown=m=>{for(let p=m;p;p=p.parent)if(!p.visible)return false;return true;};
    const rc=new T.Raycaster(new T.Vector3(c.x,b.max.y+.001,c.z),new T.Vector3(0,-1,0));const h=rc.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!within(h.object)&&!h.object.userData?.directorTools&&!(h.object.parent?.isTransformControls)&&h.point.y<=b.min.y+.05);return h?h.point.y:null;};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].propEdits||null;}catch{return null;}};
});
const draft=()=>page.evaluate(()=>__draft());
const body=name=>page.evaluate(n=>__body(n),name);
async function setField(name,value){const n0=(await draft())?.length;await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(1800);if(process.env.LOG)console.log('field',name,value,JSON.stringify((await draft()).filter(e=>/steelcase|monitor/.test(e.match||''))));}
const click=async sel=>{await page.click(sel);await wait(1000);};
const undo=async()=>{await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(900);};
async function openChapter(id){
  const c=chapterList().find(x=>x.id===id);await page.goto(BASE+c.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1200);
}
async function pickByName(name){
  const at=await page.evaluate(n=>__screen(__find(x=>x.name===n)),name);if(process.env.LOG)console.log('click',name,JSON.stringify(at),await page.evaluate(()=>[document.body.className,document.querySelector('#director-panel')?.getBoundingClientRect().width]));await page.mouse.click(at.x,at.y);await wait(1000);
  return page.evaluate(()=>__gizmo()?.object?.name);
}
const INCH=.0254;
// Edits keep positions to the millimetre, so "on the surface" is within 1 mm and the drop adds 0.5 mm.
const rests=(minY,surfaceY,slack=1e-3)=>minY-surfaceY<=slack*1.05&&minY-surfaceY>=-slack*1.05;   // desk items keep their place in the desk's units: 2 mm there
try{
  await openChapter('commons');
  await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},1);await wait(900);
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(400);
  // ---- a room prop: the chair on the floor
  const CHAIR='Prop:steelcase-leap-v2';
  {const g=await pickByName(CHAIR);check(g===CHAIR,'the chair is selected (got '+g+'; '+await status()+')');}
  const btns=await page.$$eval('#director-panel .prop-drop button',l=>l.map(b=>b.textContent));
  check(btns.join('|')==='Drop to surface|Drop flat|Align to surface','Props panel buttons: '+btns.join(' | '));
  await page.screenshot({path:path.join(shots,'drop-buttons.png')});
  const c0=await body(CHAIR);
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());
  await click('#director-panel [data-action=pp-drop]');
  check(/already rests/.test(await status()),'resting prop: "'+await status()+'"');
  await setField('pp-py',c0.p[1]+10*INCH);
  const t0=Date.now(),up=await until(async()=>{const b=await body(CHAIR);return Math.abs(b.minY-c0.minY-10*INCH)<2e-3&&b;},'live chair follows the typed height',15000).catch(async()=>body(CHAIR));console.log('live update took',Date.now()-t0,'ms');check(Math.abs(up.minY-c0.minY-10*INCH)<2e-3,'raised 10 inches above the floor ('+JSON.stringify([c0,up,await status()])+')');
  await click('#director-panel [data-action=pp-drop]');
  const c1=await body(CHAIR);check(rests(c1.minY,c0.minY),`Drop to surface: box bottom within 1 mm of the floor (off by ${((c1.minY-c0.minY)*1000).toFixed(2)} mm)`);
  check(/^Dropped 10\.0″ onto /.test(await status()),'status: "'+await status()+'"');
  let d=(await draft()).filter(e=>/steelcase/.test(e.match));check(d.length===1&&Math.abs(d[0].position[1])<=1.1e-3,'the edit holds the drop (y back to ~0): '+JSON.stringify(d[0]?.position));
  // one undo step puts it back to the raised state; a second the original
  await undo();const u1=await body(CHAIR);check(Math.abs(u1.minY-c0.minY-10*INCH)<2e-3,'one Undo undoes the whole drop (back 10" up)');
  await page.keyboard.down('Control');await page.keyboard.press('y');await page.keyboard.up('Control');await wait(900);
  check(rests((await body(CHAIR)).minY,c0.minY),'Redo drops it again');
  // End key, from raised again
  await setField('pp-py',c0.p[1]+6*INCH);await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.press('End');await wait(1000);
  check(rests((await body(CHAIR)).minY,c0.minY)&&/^Dropped 6\.0″/.test(await status()),'End key drops it: '+await status());
  // tilt 20 degrees, raise, Drop flat
  await setField('pp-rx',20);await setField('pp-py',c0.p[1]+8*INCH);
  const tilted=await body(CHAIR);check(tilted.tilt>15,`tilted ${tilted.tilt.toFixed(1)}°`);
  await click('#director-panel [data-action=pp-drop-flat]');
  const flat=await body(CHAIR);check(flat.tilt<.3,`Drop flat: tilt ${flat.tilt.toFixed(2)}°`);check(rests(flat.minY,c0.minY),`Drop flat: resting on the floor (off by ${((flat.minY-c0.minY)*1000).toFixed(2)} mm)`);
  check(/^(Dropped|Raised) [\d.]+″ onto .*upright/.test(await status()),'status: '+await status());
  d=(await draft()).filter(e=>/steelcase/.test(e.match));check(Math.abs(d[0].rotation?.[0]||0)<.2&&Math.abs(d[0].rotation?.[2]||0)<.2,'the edit\'s turn is yaw only: '+JSON.stringify(d[0].rotation));
  // Align to surface on the flat floor: stays upright
  await setField('pp-py',c0.p[1]+4*INCH);await click('#director-panel [data-action=pp-drop-align]');
  const al=await body(CHAIR);check(al.tilt<.3&&rests(al.minY,c0.minY),'Align to surface on the floor: upright, resting');
  // nothing below: far out of the room
  const before=await body(CHAIR);await setField('pp-px',900);const far=await body(CHAIR);
  await click('#director-panel [data-action=pp-drop]');
  const after=await body(CHAIR);
  check(Math.hypot(after.p[0]-far.p[0],after.p[1]-far.p[1],after.p[2]-far.p[2])<1e-6,'nothing below: it does not move');
  check(/Nothing below/.test(await status()),'message: "'+await status()+'"');
  await setField('pp-px',before.p[0]);
  // ---- a desk item: the library Smartphone added on chapter 2's desk (rides the lift)
  const chairEdit=(await draft()).filter(e=>/steelcase/.test(e.match));
  await openChapter('rise');
  await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},3);await wait(900);
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(400);
  await page.click('#director-panel [data-action=pp-add]');await until(()=>page.evaluate(()=>!!document.getElementById('prop-library')?.open),'library opens');
  await until(()=>page.evaluate(()=>document.querySelectorAll('#prop-library .pl-card').length>500),'the library grid fills',30000);
  await page.keyboard.type('phone');await wait(500);
  const cards=await page.$$eval('#prop-library .pl-card',l=>l.map(c=>c.title)),idx=cards.findIndex(t=>/ergoflex-phone/.test(t));for(let i=0;i<idx;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const PH='^Added prop:ergoflex-phone#';
  await until(()=>page.evaluate(()=>/^Added prop:ergoflex-phone#/.test(__gizmo()?.object?.name||'')),'the phone is selected',30000);await wait(800);
  const m0=await body(PH);
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());
  await setField('pp-py',m0.p[1]+10*INCH);
  const mUp=await until(async()=>{const b=await body(PH);return Math.abs(b.minY-m0.minY-10*INCH)<2e-3&&b;},'phone follows the typed height',15000).catch(()=>null);
  check(!!mUp,'phone (desk item) raised 10 inches');
  await click('#director-panel [data-action=pp-drop]');
  const m1=await body(PH),surf=await page.evaluate(n=>__surfaceY(n),PH);
  check(surf!==null&&rests(m1.minY,surf,2e-3),`phone: box bottom within 2 mm of the surface under it (off by ${((m1.minY-surf)*1000).toFixed(2)} mm; ${await status()})`);
  check(/^(Dropped|Raised) [\d.]+\u2033 onto /.test(await status()),'phone status: '+await status());
  await setField('pp-rx',20);await setField('pp-py',m0.p[1]+5*INCH);
  await click('#director-panel [data-action=pp-drop-flat]');
  const m2=await body(PH),surf2=await page.evaluate(n=>__surfaceY(n),PH);check(m2.tilt<.3&&surf2!==null&&rests(m2.minY,surf2,2e-3),`phone Drop flat: upright (${m2.tilt.toFixed(2)}\u00b0) and resting on the surface (${((m2.minY-surf2)*1000).toFixed(2)} mm)`);
  await page.screenshot({path:path.join(shots,'drop-phone.png')});
  // ---- export carries it
  const mine=await draft();
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8')),ph=mine.find(e=>e.add?.asset==='ergoflex-phone');
  check(ph&&ph.parent==='desk'&&JSON.stringify(exported.shots[0].propEdits)===JSON.stringify(mine),'Export cut carries the dropped phone as an ordinary add edit: '+JSON.stringify([ph?.position,ph?.rotation]));
  check(chairEdit.length===1&&Math.abs(chairEdit[0].position[1])<=1.1e-3,'(the chair\'s drop was an ordinary prop edit in the draft: '+JSON.stringify(chairEdit[0].position)+')');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(passed.map(p=>'ok  '+p).join('\n'));console.log(`\n${passed.length} checks passed. Screenshots: ${shots}`);
}catch(error){
  console.log(passed.map(p=>'ok  '+p).join('\n'));console.error('\nFAILED:',error.message);await page.screenshot({path:path.join(shots,'failure.png')}).catch(()=>{});process.exitCode=1;
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});}
