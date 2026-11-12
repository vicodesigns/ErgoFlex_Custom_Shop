// Director, the finale (a chapter rendered as sub-shots, one desk each): every desk's items are bars on the Props
// lane under its stretch of the chapter; a bar's ends set when the prop appears and leaves (with fades); an edit belongs
// to the desk it was made on, so the same-named item on another desk is untouched.
//   node tests/director-finale-props-e2e.mjs      (needs the film's screen videos under exports/**/screens)
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,seek,wait,status} from './director-e2e-harness.mjs';
const {base,page,close}=await openDirectorBrowser(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok  '+what);};
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__find=n=>{let o=null;__t().t.scene.traverse(x=>{if(!o&&x.name===n)o=x;});return o;};
  window.__shown=n=>{const o=__find(n);if(!o)return null;for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height};};
  window.__props=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1')),c=v.drafts?.[v.active]||v.cuts.find(c=>c.id===v.active);return (c.shots.find(s=>s.id==='hero')||c.shots[0]).propEdits||null;}catch{return null;}};
});
const bars=()=>page.$$eval('[data-props-lane] .prop-bar',l=>l.map(b=>({text:b.textContent,cls:b.className,left:parseFloat(b.style.left),width:parseFloat(b.style.width)})));
const props=()=>page.evaluate(()=>__props());
const shown=n=>page.evaluate(n=>__shown(n),n);
const go=async(s,ms=2200)=>{await seek(page,s);await wait(ms);};
const waitDesk=async name=>{await page.waitForFunction(n=>new RegExp(n).test(document.querySelector('.desk-version-badge')?.textContent||''),{timeout:30000},name);await wait(1800);};
const barOf=async(text,lo,hi)=>page.evaluateHandle((text,lo,hi)=>[...document.querySelectorAll('[data-props-lane] .prop-bar')].find(b=>b.textContent.replace(/^\+/,'')===text&&parseFloat(b.style.left)>=lo&&parseFloat(b.style.left)<hi)||null,text,lo,hi);
const setField=async(name,value)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(1300);};
const press=async action=>{await page.evaluate(a=>document.querySelector(`#director-panel [data-action="${a}"]`).click(),action);await wait(1300);};
try{
  const ch=chapterList().find(c=>c.id==='hero');await openChapter(page,base,ch);
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(3000);
  const T=Number(await page.$eval('#director-timeline [name="timeline-seconds"]',e=>e.max));
  // ---- the lane: the desk on stage has its items, the others are one click away
  let list=await bars();
  check(list.some(b=>b.text==='Wide monitor'&&/film/.test(b.cls)&&b.left===0)&&list.filter(b=>/ghost/.test(b.cls)).length===5,'Props lane at the start: Desk A\'s items as bars ("as the film has it"), the five other desks one click away: '+list.length+' bars');
  await go(15);await waitDesk('Office');
  list=await bars();const office=list.filter(b=>b.left>20&&b.left<35&&!/ghost/.test(b.cls));
  check(office.length>=6&&office.some(b=>b.text==='Wide monitor')&&office.some(b=>b.text==='Portrait monitor')&&list.filter(b=>/ghost/.test(b.cls)).length===4,'with the Office desk on stage its items are bars under its stretch: '+office.map(b=>b.text).join(', '));
  check(list.some(b=>b.text==='Wide monitor'&&b.left===0),'Desk A keeps its bars');
  // ---- a bar selects its prop; its inspector says whose it is
  let bar=await barOf('Wide monitor',20,35);await bar.evaluate(b=>b.scrollIntoView({block:'nearest'}));await wait(200);
  let bb=await bar.boundingBox();await page.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await wait(1500);
  check(/Wide monitor selected/.test(await status(page))&&await page.evaluate(()=>__gizmo()?.object?.name)==='Accessory:wide-monitor','clicking the bar selects the Office desk\'s wide monitor (gizmo on it)');
  const timing=await page.$eval('[data-prop-timing]',e=>e.innerText.replace(/\s+/g,' '));
  check(/Belongs to Desk C · Office/.test(timing)&&/the whole time its desk is on screen/i.test(timing),'the inspector\'s On screen section: '+timing.slice(0,90));
  // ---- drag the bar's right end 3 s earlier
  bar=await page.evaluateHandle(()=>document.querySelector('[data-props-lane] .prop-bar.selected'));await bar.evaluate(b=>b.scrollIntoView({block:'nearest'}));await wait(200);
  bb=await bar.boundingBox();const lane=await (await page.$('[data-props-lane]')).boundingBox(),px=lane.width/T,y=bb.y+bb.height/2;
  await page.mouse.move(bb.x+bb.width-2,y);await page.mouse.down();await page.mouse.move(bb.x+bb.width-2-px*3,y,{steps:8});await page.mouse.up();await wait(1500);
  let e=(await props())?.[0];
  check(e&&e.desk==='office'&&e.match==='^Accessory:wide-monitor$'&&e.show?.from===0&&Math.abs(e.show.to-6.1)<.25&&!e.position,'the drag wrote a time on screen for the Office desk\'s monitor only: '+JSON.stringify(e));
  check(/Wide monitor: on screen 12\.[0-9]–18\.[0-9] s/.test(await status(page)),'and says so: '+(await status(page)).slice(0,60));
  const leaves=12.5+e.show.to;
  check((await bars()).some(b=>b.text==='Wide monitor'&&/timed/.test(b.cls)&&/prop-chip/.test(b.cls)&&/selected/.test(b.cls)),'its bar is now a timed, edited bar');
  await go(leaves-1);check(await shown('Accessory:wide-monitor')===true,'on stage one second before it leaves');
  await go(leaves+.6);check(await shown('Accessory:wide-monitor')===false&&await shown('Accessory:portrait-monitor')===true,'gone after it leaves, the rest of the desk stays');
  // ---- the same-named item on another desk is not this prop
  await go(2);await waitDesk('Gaming');
  check(await shown('Accessory:wide-monitor')===true,'the Gaming desk\'s wide monitor is untouched');
  check(await page.evaluate(()=>!__gizmo()),'the selected Office monitor has no gizmo while Gaming is on stage');
  check(/belongs to another desk/.test(await page.$eval('.prop-inspector',e=>e.innerText)),'and the inspector says it belongs to another desk');
  // ---- a fade out, typed
  await setField('pp-t-fout',1);e=(await props())[0];check(e.show.fadeOut===1&&e.desk==='office','Fade out 1 s typed while another desk shows: '+JSON.stringify(e.show));
  await go(leaves-.5);await waitDesk('Office');
  const fade=await page.evaluate(()=>{const o=__find('Accessory:wide-monitor');let m=null;o.traverse(x=>{if(!m&&x.isMesh)m=[].concat(x.material)[0];});return {transparent:m.transparent,opacity:m.opacity,copy:!!m.userData.filmFxCopy};});
  check(fade.copy&&fade.transparent&&fade.opacity>.2&&fade.opacity<.8,'half a second before it leaves it is half faded: '+JSON.stringify(fade));
  // ---- Whole time clears it; Undo brings it back
  await press('pp-t-all');check(((await props())||[]).length===0,'Whole time: the edit is gone');
  await go(leaves+.6,1500);check(await shown('Accessory:wide-monitor')===true,'and the monitor stays on');
  await page.evaluate(()=>[...document.querySelectorAll('#director-panel button')].find(b=>/^Undo/.test(b.textContent.trim())).click());await wait(1500);
  check((await props())?.[0]?.show?.fadeOut===1,'Undo brings the timing back');
  // ---- an edit made in the view belongs to the desk on stage
  await go(2);await waitDesk('Gaming');
  const at=await page.evaluate(()=>__screen(__find('Accessory:wide-monitor')));await page.mouse.click(at.x,at.y);await wait(1300);
  check(/Wide monitor selected/.test(await status(page)),'clicking the Gaming desk\'s monitor in the view selects it');
  await page.evaluate(()=>{const el=document.querySelector('#director-panel [name="pp-hide"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(1500);
  const two=await props();check(two.length===2&&two.some(x=>x.desk==='gaming'&&x.hide===true)&&two.some(x=>x.desk==='office'&&x.show),'hiding it is the Gaming desk\'s own edit: '+JSON.stringify(two.map(x=>[x.desk,Object.keys(x).filter(k=>!['match','label','desk'].includes(k))])));
  check(await shown('Accessory:wide-monitor')===false,'hidden on the Gaming desk');
  await go(14);await waitDesk('Office');check(await shown('Accessory:wide-monitor')===true,'still on the Office desk');
  // ---- + Add prop in the finale: the Office desk's own, from the playhead; then onto the top shelf
  await go(16);await wait(800);
  await page.click('#director-panel [data-action=pp-add]');await page.waitForFunction(()=>document.querySelectorAll('#prop-library .pl-card').length>100,{timeout:40000});
  await page.evaluate(()=>{const el=document.querySelector('#prop-library [name=pl-search]');el.value='phone';el.dispatchEvent(new Event('input',{bubbles:true}));});await wait(700);
  await page.evaluate(()=>[...document.querySelectorAll('#prop-library .pl-card')].find(c=>/Smartphone/.test(c.title)||/Smartphone/.test(c.textContent)).click());await wait(400);
  if(await page.evaluate(()=>!!document.getElementById('prop-library')?.open))await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(__props()||[]).some(e=>e.add),{timeout:30000});await wait(2500);
  let added=(await props()).find(x=>x.add);
  check(added.desk==='office'&&added.parent==='desk'&&added.show&&Math.abs(added.show.from-3.5)<.3&&added.show.to===100000,'+ Add prop at 16 s: the Office desk\'s own, on the desktop, from the playhead to the end of its desk: '+JSON.stringify({desk:added.desk,parent:added.parent,show:added.show}));
  check((await bars()).some(b=>b.text==='+Smartphone'&&/prop-added/.test(b.cls)&&/timed/.test(b.cls)&&b.left>30),'its bar starts at the playhead');
  const name=await page.evaluate(()=>{let n=null;__t().t.scene.traverse(o=>{if(!n&&/^Added prop:/.test(o.name))n=o.name;});return n;});
  const put=await page.$$eval('#director-panel .prop-put button',l=>l.map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')));
  check(put.includes('Desktop*')&&put.includes('Top shelf'),'the inspector offers the desk\'s surfaces: '+put.join(', '));
  await press('pp-put-shelf');added=(await props()).find(x=>x.add);
  const onShelf=await page.evaluate(n=>{const o=__find(n);return {parent:o?.parent?.name,y:o?o.getWorldPosition(new (__t().T.Vector3)()).y:null};},name);
  check(added.parent==='shelf'&&/^(Accessory mount|Scene dressing|Desk dressing):shelf$/.test(onShelf.parent)&&/top shelf/.test(await status(page)),'Put it on · Top shelf: it rides the shelf now: '+JSON.stringify(onShelf));
  await go(4);await waitDesk('Gaming');check(await page.evaluate(n=>!__find(n),name),'the added prop is not on the Gaming desk');
  check(!errors.length,'no page errors: '+errors.join(' | ').slice(0,300));
  console.log(`\nDirector finale props e2e: ${passed.length} checks passed.`);
}finally{await close();}
