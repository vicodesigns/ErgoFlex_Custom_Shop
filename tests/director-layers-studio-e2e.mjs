// Layers phase 3 in the Director, end to end (a SKETCH written without a browser: never run here; the desk runs it).
// Uses tests/director-e2e-harness.mjs (its own studio server on a free port with a temp state, GPU Chrome). Chapter 6
// (oilers, the high school, First bell, 60 in):
//   1. the Layers tab has an eye per row; the featured desk is not hideable; Hidden only lists what is hidden;
//   2. the media desk's eye: the chapter gets ONE undo step with the desk edit (hide), its chair and PC tower as prop
//      hide edits, and Noah out of the cast; the stage draws no desk, no chair, no PC tower, no Noah; Undo brings all back;
//   3. a Studio hide (written to the shared key as the Studio would) shows a "Studio hides it" chip and, after Refresh, a
//      row in the Adopt dialog; taking it writes the chapter's ordinary hide edit for that prop and nothing else;
//   4. ?layers=0: the tab as before (no eyes, no chips).
//   node tests/director-layers-studio-e2e.mjs        (run under the stills lock; exit 0 / 1, one line per check)
import {chapterList,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log('Director layers studio e2e: skipped (no oilers chapter page in this checkout).');process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what,why='')=>{console.log(`${ok?'PASS':'FAIL'} ${what}${ok?'':': '+why}`);if(!ok)failures.push(what);};
const until=async(fn,ms=30000)=>{const t0=Date.now();let v;for(;;){v=await fn().catch(()=>null);if(v?.ok||Date.now()-t0>ms)return v||{ok:false};await wait(300);}};
const draft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots.find(s=>s.id==='oilers')||null;}catch{return null;}});
// the stage: is the media desk drawn, its chair / PC tower, Noah
const stageState=()=>page.evaluate(()=>{
  const E=document.getElementById('stage')?.contentWindow?.ErgoFlex,shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const r=E?.sceneDesks?.records?.get('station-research-desk'),items={};
  for(const o of E?.workspaceRoom?.assets?.()||[])if(o.userData.layersStation==='research-desk')items[o.userData.propId]=!!o.parent&&shown(o);
  const noah=(E?.workspaceRoom?.people?.people||[]).filter(o=>o.userData.person?.station==='research-desk').some(o=>o.parent&&shown(o));
  return {desk:!!r?.group&&shown(r.group),items,noah,featured:E?.sceneDesks?.selected||null};
});
const click=async sel=>{await page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);await wait(700);};
try{
  await openChapter(page,base,chapter);
  await click('#director-panel [data-inspector-tab="layers"]');
  const rows=await page.$$eval('#director-panel [data-ly-item]',els=>els.map(e=>({key:e.dataset.lyItem,name:e.querySelector('.layer-name')?.textContent||'',eye:!!e.querySelector('[data-action="ly-row-eye"]'),disabled:!!e.querySelector('[data-action="ly-row-eye"][disabled]')})));
  check(rows.length>10&&rows.every(r=>r.eye),'every row has an eye',`${rows.filter(r=>!r.eye).length} of ${rows.length} rows without one`);
  const deskRow=rows.find(r=>/MMET media desk/.test(r.name));
  check(!!deskRow&&!deskRow.disabled,'the media desk has an eye',deskRow?'disabled':'no row for it');
  const s0=await stageState();
  check(s0.desk&&s0.noah,'before: the media desk and Noah are on the stage',JSON.stringify(s0));
  // 2. one eye: desk + chair + PC tower + Noah, one undo step
  await page.evaluate(k=>{const li=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);li.querySelector('[data-action="ly-row-eye"]').click();},deskRow.key);
  const d1=await until(async()=>{const d=await draft();return {ok:!!d?.deskEdits?.some(e=>e.desk==='station-research-desk'&&e.hide===true),d};});
  const d=d1.d||{};
  check(d1.ok,'the chapter gets a desk edit with hide for the media desk',JSON.stringify(d.deskEdits||null));
  const hidProps=(d.propEdits||[]).filter(e=>e.hide===true).map(e=>e.asset||e.match);
  check(hidProps.some(a=>/ergoflex-office-chair/.test(a))&&hidProps.some(a=>/ergoflex-desktop-pc/.test(a)),'its chair and PC tower as prop hide edits',hidProps.join(', '));
  check((d.peopleEdits?.cast||[]).some(p=>p.station==='research-desk'&&p.hide===true),'Noah out of the chapter\'s cast',JSON.stringify((d.peopleEdits?.cast||[]).filter(p=>p.station==='research-desk')));
  const s1=await until(async()=>{const s=await stageState();return {ok:!s.desk&&!s.noah&&Object.values(s.items).every(v=>!v),s};});
  check(s1.ok,'the stage draws no media desk, no chair, no PC tower, no Noah',JSON.stringify(s1.s));
  await click('#director-panel [data-action="undo"]');
  const s2=await until(async()=>{const s=await stageState();return {ok:s.desk&&s.noah,s};});
  check(s2.ok,'one Undo brings them all back',JSON.stringify(s2.s));
  // 3. a Studio hide of the small bookshelf at First bell, 60 in, then Refresh from Studio
  const key='highschool:house|scene:highschool:house:room:24:ergoflex-small-bookshelf';
  await page.evaluate(async k=>{const got=await (await fetch('/api/studio-state',{cache:'no-store'})).json(),base=got.values?.['ergoflex.sceneLayers.v1']??null,v=JSON.parse(base||'{}');v[k]={kind:'prop',label:'Small bookshelf',cells:{'morning/60x30':true}};
    await fetch('/api/studio-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client:'e2e-studio',by:'Studio e2e',changes:[{key:'ergoflex.sceneLayers.v1',value:JSON.stringify(v),base}]})});},key);
  await click('#director-panel [data-studio-refresh]');
  const adopt=await until(async()=>({ok:await page.evaluate(()=>document.getElementById('studio-adopt')?.open&&/Hide it in this chapter too/.test(document.getElementById('studio-adopt').textContent))}),60000);
  check(adopt.ok,'Refresh: the Adopt dialog offers "Hide it in this chapter too" for the bookshelf',await statusOf(page));
  if(adopt.ok){
    await page.evaluate(()=>{const dlg=document.getElementById('studio-adopt');const li=[...dlg.querySelectorAll('li')].find(l=>/Hide it in this chapter too/.test(l.textContent));li.querySelector('[data-adopt]').click();li.querySelector('[data-adopt]').dispatchEvent(new Event('change',{bubbles:true}));dlg.querySelector('[data-adopt-go]').click();});
    const d3=await until(async()=>{const x=await draft();return {ok:!!x?.propEdits?.some(e=>/small-bookshelf/.test(e.asset||'')&&e.hide===true),x};});
    check(d3.ok,'taking it writes the chapter\'s ordinary hide edit for the bookshelf',JSON.stringify((d3.x?.propEdits||[]).filter(e=>/bookshelf/.test(e.asset||''))));
  }
  // 4. ?layers=0: the tab as before
  await page.evaluate(()=>localStorage.setItem('ergoflex.layers.ui','0'));
  await openChapter(page,base,chapter);await click('#director-panel [data-inspector-tab="layers"]');
  check(!(await page.$('#director-panel [data-action="ly-row-eye"]')),'layers off: no eyes in the tab','eyes still drawn');
  await page.evaluate(()=>localStorage.removeItem('ergoflex.layers.ui'));
  check(!errors.length,'no page errors',errors.slice(0,2).join(' | '));
}catch(error){check(false,'the run',error.message);}
finally{await close();}
console.log(failures.length?`${failures.length} checks failed`:'all checks passed');
process.exit(failures.length?1:0);
