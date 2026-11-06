// Director: selecting anything opens its home in the inspector (director.mjs HOMES / reveal), one name per scene
// light everywhere, and "Reset all lights to the film" (one undo step). Real GPU Chrome on chapter 2 (rise):
// camera key, lift clip, time-of-day key, Room line, Desk white key, Desk status block, a light marker clicked in the
// view, a lamp chip; each must switch the inspector to its tab, open its section, scroll it into view and pulse it,
// without moving focus; nothing switches while a text field in the inspector has focus.
//   node tests/director-inspector-reveal-e2e.mjs        (BASE=… CHAPTER=rise; under the stills lock)
import assert from 'node:assert/strict';
import {HQ,chapterList,wait,openDirectorBrowser,openChapter,seek} from './director-e2e-harness.mjs';

const all=chapterList();
if(!all){console.log(`Director inspector reveal e2e: skipped (${HQ}/director-chapters.json is not in this checkout).`);process.exit(0);}
const chapter=all.find(c=>c.id===(process.env.CHAPTER||'rise'));
const {base,page,errors,close}=await openDirectorBrowser();
const done=[];
try{
  await openChapter(page,base,chapter);
  const tab=()=>page.$eval('#director-panel [data-inspector-tab][aria-pressed=true]',b=>b.dataset.inspectorTab);
  const goTab=async t=>{await page.click(`#director-panel [data-inspector-tab="${t}"]`);await wait(200);};
  // Where the inspector is: tab, the target's section open, the target inside the panel's view, the pulse on it.
  const where=sel=>page.evaluate(sel=>{
    const p=document.getElementById('director-panel'),el=p.querySelector(sel);if(!el)return {missing:sel};
    const r=el.getBoundingClientRect(),pr=p.getBoundingClientRect(),sec=el.closest('[data-light-section]');
    return {visible:!el.closest('[hidden]')&&r.top>=pr.top-2&&r.top<pr.bottom-20,open:sec?sec.open:true,pulse:el.classList.contains('reveal-pulse')||!!el.querySelector('.reveal-pulse')||!!el.closest('.reveal-pulse'),active:document.activeElement?.tagName};
  },sel);
  async function expectHome(name,act,wantTab,sel){
    await goTab(wantTab==='project'?'chapter':'project');
    // Shut the target's lighting section first, so opening it is part of the check.
    await page.evaluate(sel=>{const m=sel.match(/data-light-section="([a-z]+)"/);if(m){const d=document.querySelector(`#director-panel [data-light-section="${m[1]}"]`);if(d)d.open=false;}},sel);
    await act();await wait(900);
    const t=await tab(),w=await where(sel);
    assert.equal(t,wantTab,`${name}: opens the ${wantTab} tab (got ${t})`);
    assert.ok(!w.missing,`${name}: ${sel} is in the inspector`);
    assert.ok(w.open,`${name}: its section opens`);assert.ok(w.visible,`${name}: scrolled into view`);assert.ok(w.pulse,`${name}: highlighted`);
    assert.notEqual(w.active,'INPUT',`${name}: no field took focus`);
    done.push(name);
  }
  const click=sel=>async()=>{const el=await page.$(sel);assert.ok(el,'timeline has '+sel);await el.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'center'}));await el.click();};
  await expectHome('camera key',click('#director-timeline [data-key]:nth-of-type(2)'),'camera','[data-reveal="camera-key"]');
  await expectHome('lift clip',click('#director-timeline [data-desk-clip]'),'groove','[data-inspector-page="groove"] .movement-inspector');
  await expectHome('time-of-day key',click('#director-timeline [data-tod-key]'),'lighting','[data-light-section="tod"] .movement-inspector');
  await expectHome('Room line',async()=>{const b=await page.$eval('#director-timeline [data-room-line="exposureScale"]',e=>{const r=e.getBoundingClientRect();return [r.left+r.width*.3,r.top+r.height/2];});await page.mouse.click(...b);},'lighting','[data-light-section="room"]');
  await expectHome('Desk white key',click('#director-timeline [data-light-key]'),'lighting','[data-light-section="white"] .light-inspector');
  await expectHome('Desk status block',click('#director-timeline [data-light-clip]'),'lighting','[data-light-section="status"] .light-inspector');
  // A light marker in the view: Lights on, click the marker of a room light where the camera sees it.
  await page.evaluate(()=>document.querySelector('.light-tools [data-vt=l]').click());
  await seek(page,8.5);await wait(1500);   // the wide resting view
  const markers=()=>page.evaluate(()=>{
    const f=document.getElementById('stage'),{camera,renderer}=f.contentWindow.ErgoPresentation.three();let group=null;
    f.contentWindow.ErgoPresentation.three().scene.traverse(o=>{if(o.name==='Director light markers')group=o;});
    const fr=f.getBoundingClientRect(),cr=renderer.domElement.getBoundingClientRect();
    const hits=(group?.children||[]).map(m=>{const v=m.position.clone().project(camera);return {path:m.userData.path,x:fr.left+cr.left+(v.x+1)/2*cr.width,y:fr.top+cr.top+(1-v.y)/2*cr.height,ok:Math.abs(v.x)<.85&&Math.abs(v.y)<.85&&v.z<1};}).filter(h=>h.ok);
    return hits.filter(h=>/^Room/.test(h.path)).concat(hits.filter(h=>!/^Room/.test(h.path)));
  });
  const inView=await markers();assert.ok(inView.length,'a light marker is in view');
  await expectHome('light marker in the view',()=>page.mouse.click(inView[0].x,inView[0].y),'lighting','[data-light-section="lamps"] .scene-light-inspector');
  // For the name check, prefer a lamp named by its height (Ceiling / Room light), the names a move used to flip.
  const pick=await page.evaluate(()=>{const o=[...document.querySelectorAll('#director-panel select[name=sl-select] optgroup[label=Room] option')];return (o.find(x=>/Ceiling light|Room light/.test(x.textContent))||o[0])?.value;});
  assert.ok(pick,'the chapter has a room lamp');
  await page.evaluate(v=>{const el=document.querySelector('#director-panel select[name=sl-select]');el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},pick);await wait(900);
  // One name everywhere: Selected header, light inspector, picker, mixer row, lane chip (once edited), before and after a move.
  const names=()=>page.evaluate(()=>{
    const p=document.getElementById('director-panel'),opt=p.querySelector('select[name=sl-select] option:checked'),sel=opt?.value;
    const row=sel&&[...p.querySelectorAll('[data-mixer]')].find(r=>r.dataset.mixer===sel);
    return {header:p.querySelector('[data-selected-header] .sel-name b')?.textContent.replace(/^Scene light · /,''),inspector:p.querySelector('.scene-light-inspector h4')?.textContent,
      picker:opt?.textContent.replace(/ · (edited|off)/g,''),mixer:row?.querySelector('[aria-label$=" on"]')?.getAttribute('aria-label').replace(/ on$/,''),
      chip:document.querySelector('#director-timeline .lamp-chip.selected')?.textContent.trim()||null,y:Number(p.querySelector('[name=sl-py]')?.value)};
  });
  const n0=await names();
  for(const k of ['inspector','picker','mixer'])assert.equal(n0[k],n0.header,`light name: ${k} "${n0[k]}" = header "${n0.header}"`);
  const setField=async(name,value)=>{await page.evaluate((name,value)=>{const el=document.querySelector(`#director-panel [name="${name}"]`);el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(700);};
  await setField('sl-py',n0.y>2.2?1.6:2.6);   // across the ceiling / room height line
  const n1=await names();
  for(const k of ['header','inspector','picker','mixer','chip'])assert.equal(n1[k],n0.header,`light name after a move: ${k} "${n1[k]}" stays "${n0.header}"`);
  done.push(`one light name ("${n0.header}") in header, inspector, picker, mixer and lane chip, before and after a move`);
  await expectHome('lamp chip',async()=>{await page.evaluate(()=>{document.getElementById('director-panel').scrollTop=0;});await click('#director-timeline .lamp-chip[data-action="lamp-pick"]')();},'lighting','[data-light-section="lamps"] .scene-light-inspector');
  // Typing in an inspector field: a selection does not switch the tab, scroll or take focus.
  await goTab('chapter');await page.focus('#director-panel [data-inspector-page="chapter"] [name="title"], #director-panel [data-inspector-page="chapter"] [name="ft-title"]');   // ft-title: the film title (title-editor.mjs) when titles-src.json is beside the chapter list
  await page.evaluate(()=>document.querySelector('#director-timeline .lamp-chip[data-action="lamp-pick"]').click());await wait(900);
  assert.equal(await tab(),'chapter','typing: the tab stays');assert.ok(['title','ft-title'].includes(await page.evaluate(()=>document.activeElement?.name)),'typing: focus stays in the Headline');
  done.push('no tab switch or focus change while typing');
  await page.evaluate(()=>document.activeElement.blur());
  // Reset all lights to the film: one step, Undo brings the edits back.
  const count=()=>page.$$eval('#director-timeline .lamp-chip[data-action="lamp-pick"]',e=>e.length);
  const before=await count();assert.ok(before>0,'an edited light shows in the lane');
  await page.click('#director-timeline [data-action="sl-reset-all"]');await wait(800);
  assert.equal(await count(),0,'Reset all: no edited lights left');
  assert.equal(await page.$('#director-timeline [data-action="sl-reset-all"]'),null,'Reset all: its chip goes with the edits');
  assert.ok(await page.$eval('#director-panel [data-action="sl-reset-all"]',b=>b.disabled),'Reset all: the inspector button is disabled with nothing to reset');
  await page.click('#director-panel [data-action="undo"]');await wait(800);
  assert.equal(await count(),before,'Undo brings every light edit back in one step');
  done.push('Reset all lights to the film: one undo step');
}finally{await close();}
assert.deepEqual(errors,[],'page / module errors');
console.log('Director inspector reveal: '+done.join('; ')+'.');
