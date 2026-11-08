// Director multi-select + Layers end to end (real GPU Chrome). In the gaming chapter (awaken): Shift+click the monitor and
// its arm (desk items), the Props tab says "2 selected", move +5 inches -> both moved by 5 inches, Ctrl+click the monitor
// removes it, Undo is one step for the group, Export cut carries both edits; then the Layers tab: make a "Monitors" layer from
// the selection, hide it (both hidden on the stage + hide edits exported, one Undo), show it, lock it (the view can't
// pick it), Select all in the layer, a screenshot of the Layers tab. Serves this checkout on a free port (temp state).
// Run: node tests/director-props-multiselect-e2e.mjs   (under the 2-slot gate; SHOTS=<dir> keeps the screenshots)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,chapterList,wait} from './director-e2e-harness.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-multiselect-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const h=await openDirectorBrowser(),{page,errors}=h;
const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok  ',what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__find=name=>{let o=null;__t().t.scene.traverse(x=>{if(!o&&x.name===name)o=x;});return o;};
  window.__pose=name=>{const {T}=__t(),o=__find(name);o.updateWorldMatrix(true,false);const v={p:o.getWorldPosition(new T.Vector3()).toArray(),visible:true};for(let p=o;p;p=p.parent)if(!p.visible)v.visible=false;return v;};
  // A screen point where a ray hits this object (not something in front of it).
  window.__clickPoint=name=>{const {t,T}=__t(),o=__find(name),f=document.getElementById('stage').getBoundingClientRect(),r=t.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
    const inside=x=>{for(let p=x;p;p=p.parent)if(p===o)return true;return false};
    let g=null;t.scene.traverse(x=>{if(x.isTransformControls&&x.object&&x.visible)g=x;});const gc=g?g.object.getWorldPosition(new T.Vector3()).project(t.camera):null;
    let best=null;
    for(let x=-.95;x<=.95;x+=.03)for(let y=-.95;y<=.95;y+=.03){
      const away=gc?Math.hypot((x-gc.x)*r.width/2,(y-gc.y)*r.height/2):1e4;if(away<45)continue;   // not on the gizmo's handles
      ray.setFromCamera(new T.Vector2(x,y),t.camera);
      const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&(()=>{for(let p=h.object;p;p=p.parent)if(!p.visible||p.isTransformControls||p.userData?.directorTools)return false;return true})());
      if(hit&&inside(hit.object)&&(!best||away>best.away)){const px=f.left+r.left+(x+1)/2*r.width,py=f.top+r.top+(1-y)/2*r.height;if(document.elementFromPoint(px,py)===document.getElementById('stage'))best={away,x:px,y:py};}}
    return best;};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}};
});
const draft=()=>page.evaluate(()=>__draft());
const pose=n=>page.evaluate(x=>__pose(x),n);
const ARM='Accessory:monitor-arm',MON='Accessory:wide-monitor';
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function clickOn(name,mod){
  const pt=await until(()=>page.evaluate(n=>__clickPoint(n),name),'a visible point on '+name);
  if(mod)await page.keyboard.down(mod);await page.mouse.click(pt.x,pt.y);if(mod)await page.keyboard.up(mod);await wait(700);
}
const click=sel=>page.evaluate(s=>document.querySelector(s).click(),sel);
const heading=()=>page.$eval('#director-panel [data-scene-props] h4',e=>e.textContent).catch(()=>'');
const setField=(name,v)=>page.evaluate((n,x)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(x);el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);
const failures=[];
try{
  const c=chapterList().find(x=>x.id==='awaken');await openChapter(page,h.base,c);
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(2500);
  const mm=await page.evaluate(()=>document.getElementById('stage').contentWindow.__filmEdits.mmScale()),inch5=5*25.4*mm;
  await click('#director-panel [data-inspector-tab=props]');await wait(300);

  // ---- multi-select on the stage
  const arm0=(await pose(ARM)).p,mon0=(await pose(MON)).p;
  // Undo re-applies the chapter's camera; put the test's view back so the monitor is on screen again.
  const cam0=await page.evaluate(()=>{const {t}=__t();return {p:t.camera.position.toArray(),q:t.camera.quaternion.toArray(),c:t.controls?.target?.toArray()};});
  const view=()=>page.evaluate(c=>{const {t}=__t();t.camera.position.fromArray(c.p);t.camera.quaternion.fromArray(c.q);if(c.c&&t.controls){t.controls.target.fromArray(c.c);t.controls.update?.();}t.camera.updateMatrixWorld(true);__t().w.ErgoPresentation?.wake?.();},cam0);
  await clickOn(ARM);check(/selected/.test(await status())&&/Single monitor arm|Monitor arm/i.test(await heading()),'click selects the monitor arm ('+await heading()+')');
  await clickOn(MON,'Shift');check(/^2 selected/.test(await heading()),'Shift+click adds the monitor: "'+await heading()+'"');
  check((await page.$$eval('#director-panel .prop-group-list li',l=>l.length))===2,'the Props tab lists both');
  // click empty space with Shift does not clear; the group stays
  await setField('pp-gmx',5);await wait(1500);
  const arm1=(await pose(ARM)).p,mon1=(await pose(MON)).p;
  check(Math.abs(dist(arm0,arm1)-inch5)<inch5*.03&&Math.abs(dist(mon0,mon1)-inch5)<inch5*.03,`both moved by 5″ (arm ${(dist(arm0,arm1)/25.4/mm).toFixed(2)}″, monitor ${(dist(mon0,mon1)/25.4/mm).toFixed(2)}″)`);
  check(Math.abs((arm1[0]-arm0[0])-(mon1[0]-mon0[0]))<1e-4,'their offset to each other is kept');
  let d=await draft();check(d.propEdits?.length===2&&d.propEdits.every(e=>e.position),'two prop edits written (one per item): '+JSON.stringify(d.propEdits?.map(e=>e.match)));
  // turn about the centre keeps the pair rigid
  await setField('pp-gry',90);await wait(1500);
  const arm2=(await pose(ARM)).p,mon2=(await pose(MON)).p;check(Math.abs(dist(arm1,mon1)-dist(arm2,mon2))<1e-3&&dist(arm1,arm2)>1e-3,'turning 90° about the centre keeps their distance');
  await click('#director-panel [data-action=undo]');await wait(3500);
  const arm3=(await pose(ARM)).p,mon3=(await pose(MON)).p;check(dist(arm3,arm1)<1e-3&&dist(mon3,mon1)<1e-3,'one Undo takes back the whole turn');
  await view();await wait(500);
  // Ctrl+click toggles
  await clickOn(MON,'Control');check(!/selected$/.test(await heading())&&/arm/i.test(await heading()),'Ctrl+click removes the monitor from the selection ("'+await heading()+'")');
  await clickOn(MON,'Control');check(/^2 selected/.test(await heading()),'Ctrl+click adds it back');
  await click('#director-panel [data-action=undo]');await wait(3500);
  const arm4=(await pose(ARM)).p,mon4=(await pose(MON)).p;check(dist(arm4,arm0)<1e-3&&dist(mon4,mon0)<1e-3,'Undo (one step) puts both back where they were');
  await click('#director-panel [data-action=redo]');await wait(1200);
  const arm5=(await pose(ARM)).p;check(dist(arm5,arm1)<1e-3,'Redo moves both again');
  // a real gizmo drag on the pair: the pivot sits at the centre; drag it a little and both follow
  await page.screenshot({path:path.join(shots,'multiselect-props.png')});

  // ---- Export cut carries both edits
  await click('#director-panel [data-action=save-export]');
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8')).shots[0];fs.renameSync(path.join(downloads,file),path.join(tmp,'export1.json'));
  check(exported.propEdits.length===2&&exported.propEdits.every(e=>e.position&&e.space==='local'||e.position),'Export cut carries both edits ('+exported.propEdits.map(e=>e.match).join(', ')+')');

  // ---- Layers
  await click('#director-panel [data-inspector-tab=layers]');await wait(800);
  await until(()=>page.$$eval('#director-panel .layer-item',l=>l.length>3),'the outliner lists the chapter',15000);
  const rows=await page.$$eval('#director-panel .layer-item .layer-name',l=>l.map(x=>x.textContent));
  check(rows.some(r=>/monitor arm/i.test(r))&&rows.some(r=>/monitor/i.test(r)),'the outliner lists the desk items ('+rows.slice(0,8).join(', ')+'…)');
  check((await page.$$eval('#director-panel .layer-group > summary',l=>l.map(x=>x.textContent))).some(t=>/Desk items/.test(t)),'desk items are grouped under the desk');
  // search
  await page.type('#director-panel [name=ly-search]','arm');await wait(300);
  check((await page.$$eval('#director-panel .layer-item',l=>l.length))<rows.length&&(await page.$$eval('#director-panel .layer-item .layer-name',l=>l.every(x=>/arm/i.test(x.textContent)))),'search narrows the list');
  await page.$eval('#director-panel [name=ly-search]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await wait(200);
  // the selection (arm + monitor) is highlighted in the list; make the layer
  check((await page.$$eval('#director-panel .layer-item.selected',l=>l.length))===2,'both selected items are highlighted in the list');
  await page.type('#director-panel [name=ly-name]','Monitors');await click('#director-panel [data-action=ly-create]');await wait(500);
  d=await draft();check(d.propLayers?.length===1&&d.propLayers[0].name==='Monitors'&&d.propLayers[0].items.length===2,'"Monitors" layer made from the selection (shot.propLayers)');
  // hide the layer: both hidden on the stage, hide edits, one Undo
  await click('#director-panel [data-action=ly-eye]');await wait(1500);
  check(!(await pose(ARM)).visible&&!(await pose(MON)).visible,'hiding the layer hides both on the stage');
  d=await draft();check(d.propLayers[0].hidden===true&&d.propEdits.filter(e=>e.hide===true).length===2,'hide edits written for both (the film matches)');
  await click('#director-panel [data-action=save-export]');
  const f2=await until(()=>fs.readdirSync(downloads).filter(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')).find(Boolean),'second export download');
  const ex2=JSON.parse(fs.readFileSync(path.join(downloads,f2),'utf8')).shots[0];
  check(ex2.propEdits.filter(e=>e.hide===true).length===2&&ex2.propLayers?.[0]?.hidden===true,'Export cut carries the hide edits and the layer');
  await page.screenshot({path:path.join(shots,'layers-tab-hidden.png')});
  await click('#director-panel [data-action=undo]');await wait(1500);
  check((await pose(ARM)).visible&&(await pose(MON)).visible,'one Undo shows the layer again');
  await click('#director-panel [data-action=redo]');await wait(1200);
  await click('#director-panel [data-action=ly-eye]');await wait(1500);
  check((await pose(ARM)).visible&&(await pose(MON)).visible,'the eye shows the layer again');
  // lock: the view can't pick it
  await click('#director-panel [data-action=ly-lock]');await wait(500);
  await click('#director-panel [data-action=pp-clear]');await wait(400);await view();await wait(500);
  await clickOn(MON);check(/locked/.test(await status())&&!/selected$/.test(await heading()),'a locked layer can\'t be picked in the view ('+(await status()).slice(0,80)+')');
  await click('#director-panel [data-action=ly-lock]');await wait(500);
  // select all in the layer
  await click('#director-panel [data-action=ly-select]');await wait(1000);
  check((await page.$$eval('#director-panel .layer-item.selected',l=>l.length))===2,'Select all in the layer selects both');
  await click('#director-panel [data-inspector-tab=props]');await wait(300);
  check(/^2 selected/.test(await heading()),'the Props tab shows "2 selected" for the layer');
  await click('#director-panel [data-inspector-tab=layers]');await wait(500);
  // Esc clears
  await page.evaluate(()=>document.getElementById('stage').contentWindow.focus());await page.keyboard.press('Escape');await wait(500);
  check((await page.$$eval('#director-panel .layer-item.selected',l=>l.length))===0,'Esc clears the selection');
  await page.screenshot({path:path.join(shots,'layers-tab.png')});
  check(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(error){failures.push(error.message);console.log('FAIL',error.stack);
  try{await page.screenshot({path:path.join(shots,'failure.png')});}catch{}}
finally{await h.close();if(!process.env.SHOTS)fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failures.length?`\nDirector multi-select e2e: ${failures.length} failure(s). Shots: ${shots}`:`\nDirector multi-select e2e: all ${passed.length} checks passed. Shots: ${shots}`);
process.exit(failures.length?1:0);
