// Director Props end to end (real GPU Chrome): click a prop in the view, gizmo move / rotate / scale (real drags on
// the gizmo's handles), the Prop inspector numbers, hide (Delete and the checkbox), undo / redo, the Props lane chips,
// Render still = live view for the edited props (and a before / after still pair), Export cut -> build-round8-director
// --import + pass -> review-cut sceneEdits (in a temp copy), Studio untouched by every Director edit, then "Make
// permanent in Studio" against this test's own scratch studio state, and the disabled case (the product stage).
// Serves this checkout on a free port with a temp copy of studio-state.json (never :3000's), downloads go to a temp
// folder (never ~/Downloads). Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-props-e2e.mjs
// SHOTS=<dir> keeps the screenshots and the before / after stills there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,HQ,chapterList,wait} from './director-e2e-harness.mjs';
import {filmPropEdits,propKey} from '../experience/prop-edits.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-props-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
// The scratch state: the checkout's, without the autosave ring and the saved cuts (several MB that leave no room in
// this browser's storage for the Director's draft, which the test reads).
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-props-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage(),cdp=await page.createCDPSession(),errors=[];
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
// Live reload off (this checkout may change under the test); the shared-state sync stays on, against the temp state.
await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/reload.js'}]});
cdp.on('Fetch.requestPaused',e=>cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{}));
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);if(process.env.LOG)console.log('[page]',t.slice(0,240));});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const studioAssets=async()=>(await (await fetch(BASE+'/api/studio-state')).json()).values['ergoflex.sceneAssets.v1'];
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
async function openChapter(id){
  const c=chapterList().find(x=>x.id===id);await page.goto(BASE+c.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1200);
}
// In the page: the stage, our gizmo, objects by name / Studio key, screen points.
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__find=(test,scene)=>{let o=null;(scene||__t().t.scene).traverse(x=>{if(!o&&test(x))o=x;});return o;};
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height};};
  window.__pose=o=>{const {T}=__t();o.updateWorldMatrix(true,false);return {p:o.getWorldPosition(new T.Vector3()).toArray(),q:o.getWorldQuaternion(new T.Quaternion()).toArray(),s:o.getWorldScale(new T.Vector3()).toArray(),visible:(()=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;})()};};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].propEdits||null;}catch{return null;}};
});
const draft=()=>page.evaluate(()=>__draft());
const CHAIR='Prop:steelcase-leap-v2',MONITOR='Prop:ergoflex-wide-monitor';
const pose=name=>page.evaluate(n=>__pose(__find(x=>x.name===n)),name);
const near=(a,b,eps=2e-3)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=eps);
// A real drag on the gizmo: find the handle (axis) by hovering, then drag it.
async function dragHandle(axes,dir){
  const c=await page.evaluate(()=>__screen(__gizmo().object));let best=null;
  for(let r=10;r<240;r+=6)for(let a=0;a<360;a+=10){
    const x=c.x+r*Math.cos(a*Math.PI/180),y=c.y+r*Math.sin(a*Math.PI/180);await page.mouse.move(x,y);
    const axis=await page.evaluate(()=>__gizmo()?.axis);if(axes.includes(axis)&&(!best||r>best.r))best={r,a,x,y,axis};
  }
  if(!best)throw Error('no gizmo handle '+axes.join('/'));
  // The handle's outer end (scale: away from the centre, where the pointer ratio is sane).
  const {a,axis}=best,x=c.x+(best.r-4)*Math.cos(a*Math.PI/180),y=c.y+(best.r-4)*Math.sin(a*Math.PI/180);
  const [dx,dy]=dir==='tangent'?[-Math.sin(a*Math.PI/180)*70,Math.cos(a*Math.PI/180)*70]:[Math.cos(a*Math.PI/180)*45,Math.sin(a*Math.PI/180)*45];
  await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=6;i++){await page.mouse.move(x+dx*i/6,y+dy*i/6);await wait(30);}await page.mouse.up();await wait(500);return axis;
}
async function setField(name,value){await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(900);}
async function stillOf(file){
  const before=await page.$$eval('.still-strip img, .still-view img, [data-still] img',l=>l.length).catch(()=>0);
  await page.keyboard.press('r');
  await until(async()=>/Still rendered/.test(await status()),'Render still',240000);
  const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);
  if(url&&file)fs.writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));
  await page.keyboard.press('Escape');await wait(400);return url;   // back to the live view
}
try{
  // ---- commons (library:humboldt): select
  await openChapter('commons');
  const studio0=await studioAssets();
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=lighting]').click());
  if(process.env.STILLS!=='0'){await stillOf(path.join(shots,'still-before.jpg'));check(fs.existsSync(path.join(shots,'still-before.jpg')),'before still rendered');}
  const at=await page.evaluate(n=>__screen(__find(x=>x.name===n)),CHAIR);await page.mouse.click(at.x,at.y);await wait(900);
  const sel=await page.evaluate(()=>({gizmo:__gizmo()?.object?.name,tab:document.querySelector('#director-panel [data-inspector-tab][aria-pressed=true]')?.dataset.inspectorTab,header:document.querySelector('[data-selected-header]')?.textContent,
    pulse:!!document.querySelector('[data-reveal=prop].reveal-pulse'),move:document.querySelector('.light-tools [data-vt=w]').getAttribute('aria-pressed'),rotate:!document.querySelector('.light-tools [data-vt=pe]').disabled,scale:!document.querySelector('.light-tools [data-vt=t]').disabled,name:document.querySelector('.prop-inspector h4')?.textContent}));
  check(sel.gizmo===CHAIR,'click selects the prop root (gizmo on '+CHAIR+')');check(sel.tab==='props'&&sel.pulse,'selecting reveals the Prop section in the Props tab (pulse)');
  check(/Prop · Steelcase leap v2/.test(sel.header),'Selected header names the prop');check(sel.move==='true'&&sel.rotate&&sel.scale,'frame tools: Move pressed, Rotate and Scale enabled');
  check(/^Steelcase leap v2 selected/.test(await status()),'status: "Steelcase leap v2 selected"');
  check(await page.evaluate(()=>!/Prop:/.test(document.querySelector('[data-selected-header]').textContent+document.querySelector('.prop-inspector h4').textContent)&&/Prop:steelcase-leap-v2/.test(document.querySelector('.prop-inspector .prop-name').textContent)),'one name everywhere; the raw id only in the inspector\'s grey line');
  await page.screenshot({path:path.join(shots,'props-selected.png')});
  // ---- gizmo: move, rotate, scale (real drags)
  const p0=await pose(CHAIR);
  await dragHandle(['X','Y','Z'],'radial');
  check(/^Moved Steelcase leap v2\./.test(await status()),'gizmo drag: "Moved Steelcase leap v2" (the friendly name)');
  await until(async()=>(await draft())?.[0]?.position,'draft position');
  let d=await draft();const p1=await until(async()=>{const p=await pose(CHAIR);return near(p.p,p0.p.map((v,i)=>v+d[0].position[i]))&&p;},'live chair follows the move');
  check(near(p1.p,p0.p.map((v,i)=>v+d[0].position[i])),'the film edit is the world offset of the drag');
  await page.keyboard.press('e');await wait(200);check(await page.evaluate(()=>__gizmo()?.mode==='rotate'),'E: rotate gizmo');
  await dragHandle(['Y'],'tangent');check(/^Rotated /.test(await status()),'gizmo rotate drag');
  d=await until(async()=>{const x=await draft();return x?.[0]?.rotation&&x;},'draft rotation');check(Math.abs(d[0].rotation[1])>.5&&Math.abs(d[0].rotation[0])<1&&Math.abs(d[0].rotation[2])<1,'a turn about y is stored as a turn about y: '+d[0].rotation.join(', ')+'°');
  await page.keyboard.press('t');await wait(200);check(await page.evaluate(()=>__gizmo()?.mode==='scale'),'T: scale gizmo (R stays Render still)');
  await dragHandle(['Y','X','Z'],'radial');check(/^Scaled /.test(await status()),'gizmo scale drag');
  d=await until(async()=>{const x=await draft();return x?.[0]?.scale&&x;},'draft scale');
  // ---- inspector numbers
  const x0=(await pose(CHAIR)).p[0];await setField('pp-px',(x0+.25).toFixed(3));
  await until(async()=>Math.abs((await pose(CHAIR)).p[0]-(x0+.25))<2e-3,'position x typed');check(true,'Position x typed moves it there');
  await setField('pp-ry',30);d=await draft();check(d[0].rotation[1]===30&&/^Rotated /.test(await status()),'Turn y typed: 30°');
  await setField('pp-s',1.25);d=await draft();check(near(d[0].scale,[1.25,1.25,1.25],1e-4),'uniform scale typed: ×1.25');
  await setField('pp-sy',1.4);d=await draft();check(near(d[0].scale,[1.25,1.4,1.25],1e-4),'per-axis scale typed: y ×1.4');
  const sNow=(await pose(CHAIR)).s,sBase=p0.s;check(near(sNow.map((v,i)=>v/sBase[i]),[1.25,1.4,1.25],3e-3),'live scale follows');
  // ---- undo / redo
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(800);
  check(/^Undone: Scaled Steelcase leap v2/.test(await status()),'Undo names the step: '+await status());d=await draft();check(near(d[0].scale,[1.25,1.25,1.25],1e-4),'undo restores the scale');
  await page.keyboard.down('Control');await page.keyboard.press('y');await page.keyboard.up('Control');await wait(800);d=await draft();check(near(d[0].scale,[1.25,1.4,1.25],1e-4),'redo');
  // ---- hide (Delete), undo, then the monitor (a desk accessory) hidden with the checkbox
  await page.mouse.move(5,5);await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.press('Delete');await wait(1000);
  check(/^Hid Steelcase leap v2 in this chapter/.test(await status()),'Delete hides it in this chapter');check(!(await pose(CHAIR)).visible,'hidden on the stage');
  check(await page.$eval('[data-props-lane] .prop-chip.prop-hidden',e=>/Steelcase/.test(e.textContent)).catch(()=>false),'hidden prop: struck-through chip');
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(1000);check((await pose(CHAIR)).visible,'undo shows it again');
  await page.keyboard.press('Escape');await wait(300);check(!(await page.evaluate(()=>__gizmo()?.object?.name)),'Esc deselects the prop');
  const mon=await page.evaluate(n=>__screen(__find(x=>x.name===n)),MONITOR);await page.mouse.click(mon.x,mon.y);await wait(900);
  check(await page.evaluate(()=>__gizmo()?.object?.name)==='Accessory:wide-monitor','a desk item selects its accessory (Accessory:wide-monitor)');
  await page.evaluate(()=>document.querySelector('#director-panel [name=pp-hide]').click());await wait(1000);
  check(/^Hid Wide monitor in this chapter/.test(await status())&&!(await pose('Accessory:wide-monitor')).visible,'Hide in this chapter (checkbox)');
  // ---- lane chips
  const chips=await page.$$eval('[data-props-lane] button',l=>l.map(b=>[b.textContent,b.className]));
  check(chips.length===3&&/Reset all props/.test(chips[2][0])&&/prop-hidden/.test(chips[1][1]),'Props lane: 2 chips (the hidden one struck through) + reset-all: '+chips.map(c=>c[0]).join(' | '));
  await page.click('[data-props-lane] .prop-chip:not(.prop-hidden)');await wait(700);
  check(await page.evaluate(()=>__gizmo()?.object?.name)==='Prop:steelcase-leap-v2'&&/Steelcase/.test(await page.$eval('[data-selected-header]',e=>e.textContent)),'clicking a chip selects its prop');
  check(/PROPS/i.test(await page.$eval('[data-lane-group=props]',e=>e.textContent)),'PROPS lane group');
  await page.screenshot({path:path.join(shots,'props-edited.png')});
  // ---- Studio untouched by any of it
  check(await studioAssets()===studio0,'Studio state (ergoflex.sceneAssets.v1) unchanged by Director prop edits');
  // ---- Render still = live
  if(process.env.STILLS!=='0'){
    await page.evaluate(()=>{const f=[...document.querySelectorAll('[data-action=sel-clear]')][0];f?.click();});
    await stillOf(path.join(shots,'still-after.jpg'));
    check(!fs.readFileSync(path.join(shots,'still-after.jpg')).equals(fs.readFileSync(path.join(shots,'still-before.jpg'))),'the after still differs from the before still');
    check(/after: Hid Wide monitor in this chapter/.test(await page.$eval('#film-still .still-caption',e=>e.textContent)),'its caption names the last edit ("after: Hid Wide monitor in this chapter")');
    const both=await page.evaluate(()=>{const still=[...document.querySelectorAll('iframe')].find(f=>f.title==='Film still renderer').contentWindow,sScene=(()=>{let s=still.ErgoFlex.loadedModel;while(s.parent)s=s.parent;return s;})();
      const live=__find(x=>x.name==='Prop:steelcase-leap-v2'),there=__find(x=>x.userData.sceneAssetKey===live.userData.sceneAssetKey,sScene),T=__t().T;
      const P=o=>{o.updateWorldMatrix(true,false);const v=new still.ErgoFlex.loadedModel.position.constructor();return {p:o.getWorldPosition(v.clone()).toArray(),s:o.getWorldScale(v.clone()).toArray()};};
      const mon=__find(x=>x.name==='Accessory:wide-monitor',sScene);let shown=true;for(let p=mon;p;p=p.parent)if(!p.visible)shown=false;
      return {live:P(live),still:P(there),monitorShown:shown,liveRot:live.rotation.toArray().slice(0,3),stillRot:there.rotation.toArray().slice(0,3)};});
    check(near(both.live.p,both.still.p)&&near(both.live.s,both.still.s)&&near(both.liveRot,both.stillRot,1e-4),'Render still places the edited prop exactly as the live view');
    check(!both.monitorShown,'Render still hides the hidden prop too');
  }
  // ---- Render still carries the film titles (Titles on), and none with Titles off
  if(process.env.STILLS!=='0'){
    await page.click('[data-title-clip]');await wait(400);await page.evaluate(()=>document.querySelector('[data-title-action=go]').click());await wait(900);
    const on=await stillOf(path.join(shots,'still-title-on.jpg')),noteOn=await page.$eval('#film-still .still-caption',e=>e.textContent);
    await page.evaluate(()=>document.querySelector('#director-timeline [data-action=titles]').click());await wait(400);
    const off=await stillOf(path.join(shots,'still-title-off.jpg'));
    await page.evaluate(()=>document.querySelector('#director-timeline [data-action=titles]').click());await wait(400);
    // Mean |difference| inside the title block (film grid x 128-1100, y 760-1000) and outside it.
    const diff=await page.evaluate(async(a,b)=>{const img=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});const [A,B]=await Promise.all([img(a),img(b)]);
      const px=I=>{const c=document.createElement('canvas');c.width=I.naturalWidth;c.height=I.naturalHeight;const g=c.getContext('2d');g.drawImage(I,0,0);return g.getImageData(0,0,c.width,c.height);};
      const da=px(A),db=px(B),W=da.width,H=da.height,k=W/1920;let ins=0,ni=0,out=0,no=0,bright=0;
      for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const i=(y*W+x)*4,d=(Math.abs(da.data[i]-db.data[i])+Math.abs(da.data[i+1]-db.data[i+1])+Math.abs(da.data[i+2]-db.data[i+2]))/3,inside=x>=128*k&&x<=1100*k&&y>=760*k&&y<=1000*k;
        if(inside){ins+=d;ni++;if(da.data[i]>235&&da.data[i+1]>235&&da.data[i+2]>235&&!(db.data[i]>235&&db.data[i+1]>235&&db.data[i+2]>235))bright++;}else{out+=d;no++;}}
      return {inside:ins/ni,outside:out/no,bright};},on,off);
    check(diff.inside>6&&diff.bright>40&&diff.outside<2.5,`Render still with Titles on carries the chapter title (title block Δ ${diff.inside.toFixed(1)}, ${diff.bright} new white text pixels; elsewhere Δ ${diff.outside.toFixed(2)})`);
    check(/title on/.test(noteOn),'its caption says the title is on: '+noteOn.replace(/Download JPG$/,''));
    check(fs.readFileSync(path.join(shots,'still-title-off.jpg')).length>0&&diff.inside>6,'with Titles off the still has no title (the 3D still alone)');
  }
  // ---- Export cut -> import -> review-cut sceneEdits (temp copy of the chapter)
  const mine=await draft();
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));check(JSON.stringify(exported.shots[0].propEdits)===JSON.stringify(mine),'Export cut carries the prop edits');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json'])fs.copyFileSync(path.join(root,HQ,f),path.join(H,f));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='commons')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const hand=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='commons').sceneEdits.filter(e=>!e.director);
  const ex=path.join(tmp,'Film-chapter-commons-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='commons');
  check(JSON.stringify(built.sceneEdits)===JSON.stringify([...hand,...mine.map(e=>({...e,director:true}))]),'review-cut sceneEdits: the hand-made edits, then his (director: true)');
  check(JSON.stringify(filmPropEdits(built))===JSON.stringify(mine),'reopened from the rebuilt film, the Director shows the same prop edits');
  // ---- Make permanent in Studio (scratch state): the chair can, the accessory can't
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(400);
  const why=await page.$eval('#director-panel [data-action=pp-permanent]',b=>[b.disabled,b.title]);check(!why[0],'Make permanent in Studio… enabled in a Studio layout room');
  await page.click('#director-panel [data-action=pp-permanent]');await wait(400);
  const rows=await page.$$eval('#prop-permanent li',l=>l.map(li=>[li.textContent.replace(/\s+/g,' ').trim(),li.querySelector('input').disabled]));
  check(rows.length===2&&!rows[0][1]&&/^Steelcase leap v2 · moved .* m.*turned .*scaled/.test(rows[0][0])&&!/Prop:/.test(rows.join()),'confirm panel lists the chair and exactly its change: '+rows[0][0]);
  check(rows[1][1]&&/desk accessory/.test(rows[1][0]),'the accessory is listed but blocked: '+rows[1][0]);
  await page.screenshot({path:path.join(shots,'props-permanent-confirm.png')});
  const chairBefore=await pose(CHAIR);
  await page.click('#prop-permanent [data-permanent-go]');
  await until(async()=>/^Made 1 prop permanent in Studio \(library:humboldt\): Steelcase leap v2\./.test(await status()),'make permanent',20000);await wait(2000);
  const studio1=JSON.parse(await studioAssets()),edited=studio1['library:humboldt'].transforms['scene:library:humboldt:room:0:steelcase-leap-v2'],old=JSON.parse(studio0)['library:humboldt'];
  check(!!edited&&JSON.stringify(edited)!==JSON.stringify(old.transforms['scene:library:humboldt:room:0:steelcase-leap-v2']),'Studio state: the chair\'s transform written through POST /api/studio-state');
  const changedKeys=Object.keys(studio1).filter(k=>JSON.stringify(studio1[k])!==JSON.stringify(JSON.parse(studio0)[k]));check(changedKeys.join()==='library:humboldt','only the library:humboldt room changed');
  check(JSON.stringify(Object.fromEntries(Object.entries(studio1['library:humboldt'].transforms).filter(([k])=>!/steelcase/.test(k))))===JSON.stringify(Object.fromEntries(Object.entries(old.transforms).filter(([k])=>!/steelcase/.test(k)))),'no other prop changed in Studio');
  d=await draft();check(d.length===1&&/wide-monitor/.test(d[0].match),'the chair\'s chapter edit is folded in; the accessory hide stays');
  const chairAfter=await pose(CHAIR);check(near(chairAfter.p,chairBefore.p)&&near(chairAfter.s,chairBefore.s),'the chair stays where he put it on the stage');
  // ---- disabled case: the product stage (chapter 1) has no Studio layout
  await openChapter('awaken');await page.evaluate(()=>document.querySelector('[data-inspector-tab=props]').click());await wait(500);
  const off=await page.$eval('#director-panel [data-action=pp-permanent]',b=>[b.disabled,b.title,document.querySelector('[data-permanent-why]')?.textContent]);
  check(off[0]&&off[2]==='This room is built by the app, not a saved Studio layout.','product stage: Make permanent disabled: "'+off[2]+'"');
  check(!errors.length,'no page errors or module "not exported" errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(passed.map(p=>'ok  '+p).join('\n'));
  console.log(`Director props e2e: ${passed.length} checks passed. Screens in ${shots}`);
}catch(error){
  console.log(passed.map(p=>'ok  '+p).join('\n'));await page.screenshot({path:path.join(shots,'props-failure.png')}).catch(()=>{});console.error('FAILED:',error.message,'\nstatus:',await status(),'\nerrors:',errors.join(' | '));process.exitCode=1;
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});if(!process.env.SHOTS)fs.rmSync(tmp,{recursive:true,force:true});else fs.rmSync(downloads,{recursive:true,force:true});}
