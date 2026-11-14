// Layers phase 3 in the Director, end to end. Uses tests/director-e2e-harness.mjs (its own studio server on a free port
// with a temp state, GPU Chrome). Chapter 6 (oilers, the high school, First bell, 60 in). Four parts, each with its own
// lines: a failure in one part does not stop the next (they are independent).
//   1. the Layers tab has an eye per row;
//   2. a room desk's eye: ONE undo step with the desk edit (hide), its chair and props as prop hide edits, and whoever
//      sits at it in this chapter out of the cast (nobody there: no peopleEdits written); the stage draws none of them;
//      one Undo brings them back. The desk is one that HAS a person at it in this chapter, read from the stage first (the
//      people cut casts Noah away from the media desk); if no room desk has anyone, the test says so and uses the media
//      desk for the desk / chair / prop checks;
//   3. a Studio hide in the page's copy of the shared key: the "Studio hides it" chip and "Hide here too", which writes
//      the chapter's hide edit (the harness blocks the shared state, so Refresh / Adopt cannot run here);
//   4. layers off (localStorage 'ergoflex.layers.ui' = '0'): the tab as before (no eyes).
//   With --shared-state (or SHARED_STATE=1), against the harness' OWN scratch server (empty scratch state; see the
//   harness header for the exposure), also:
//   5. Refresh from Studio: a Studio hide of the designer chair written to the server's ergoflex.sceneLayers.v1 at the
//      chapter's cell (as the Studio writes it); Refresh draws the Adopt row named from the stage; taking it writes the
//      chapter's hide edit;
//   6. Make permanent: with that chapter hide and the media desk hidden (with its chair and PC tower), the server's
//      ergoflex.sceneLayers.v1 gets the chair at the chapter's cell and ONE desk entry (no chair / PC entries of their
//      own), NOTHING is written to `removed` (ergoflex.sceneAssets.v1), and the chapter keeps its own hide edits.
//   node tests/director-layers-studio-e2e.mjs [--cut exports/<cut dir>] [--shared-state]
//   The cut: --cut, else HQ, else the alternate cut (it casts the room's people at their desks). The first line says which.
//   (run under the stills lock; exit 0 / 1, one line per check: PASS / FAIL / SKIP)
import fs from 'node:fs';
import path from 'node:path';
import {e2eOptions,cutLine,peopleCheck} from './director-e2e-options.mjs';
const opt=e2eOptions(process.argv.slice(2),process.env);
process.env.HQ=opt.cut;   // the harness reads HQ when it is imported
console.log(cutLine(opt));
const {chapterList,wait,openDirectorBrowser,openChapter,status:statusOf,root}=await import('./director-e2e-harness.mjs');

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director layers studio e2e: skipped (no oilers chapter page in ${opt.cut}).`);process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser({shared:opt.shared});
const failures=[],check=(ok,what,why='')=>{console.log(`${ok?'PASS':'FAIL'} ${what}${ok?'':': '+why}`);if(!ok)failures.push(what);};
// The scratch server's API from node: every failure names the method and the URL.
async function api(method,p,body){
  const url=new URL(p,base).href;let res;
  try{res=await fetch(url,{method,cache:'no-store',...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});}
  catch(error){throw Error(`${method} ${url}: ${error.message}${error.cause?.code?' ('+error.cause.code+')':''}`);}
  if(!res.ok)throw Error(`${method} ${url}: HTTP ${res.status}`);
  return res.json();
}
const LAYERS='ergoflex.sceneLayers.v1',ASSETS='ergoflex.sceneAssets.v1',ROOM='highschool:house';
const part=async(name,fn)=>{try{await fn();}catch(error){check(false,name,error.message);}};
const until=async(fn,ms=30000)=>{const t0=Date.now();let v;for(;;){v=await fn().catch(e=>({ok:false,error:e.message}));if(v?.ok||Date.now()-t0>ms)return v||{ok:false};await wait(300);}};
const draft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots.find(s=>s.id==='oilers')||null;}catch{return null;}});
// the stage at one room desk: drawn?, what belongs to it, who sits at it (shown)
const stageAt=station=>page.evaluate(st=>{
  const E=document.getElementById('stage')?.contentWindow?.ErgoFlex,shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const r=E?.sceneDesks?.records?.get('station-'+st),items={};
  for(const o of E?.workspaceRoom?.assets?.()||[])if(o.userData.layersStation===st)items[o.userData.propId]=!!o.parent&&shown(o);
  const users=[...new Set((E?.workspaceRoom?.people?.people||[]).filter(o=>o.userData.person?.station===st&&o.parent&&shown(o)).map(o=>{const s=o.userData.person;return s.key||s.variant||s.id;}))];
  return {desk:!!r?.group&&shown(r.group),items,users,featured:E?.sceneDesks?.selected||null};
},station);
const click=async sel=>{await page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no element '+s);el.click();},sel);await wait(700);};
try{
  await openChapter(page,base,chapter);
  await click('#director-panel [data-inspector-tab="layers"]');
  // ---- 1
  let rows=[];
  await part('part 1',async()=>{
    rows=await page.$$eval('#director-panel [data-ly-item]',els=>els.map(e=>({key:e.dataset.lyItem,name:e.querySelector('.layer-name')?.textContent||'',eye:!!e.querySelector('[data-action="ly-row-eye"]'),disabled:!!e.querySelector('[data-action="ly-row-eye"][disabled]')})));
    check(rows.length>10&&rows.every(r=>r.eye),'every row has an eye',`${rows.filter(r=>!r.eye).length} of ${rows.length} rows without one`);
  });
  // ---- 2: a room desk with a person at it in this chapter (read from the stage)
  await part('part 2',async()=>{
    const stations=await page.evaluate(()=>{const E=document.getElementById('stage')?.contentWindow?.ErgoFlex;return [...(E?.sceneDesks?.records?.keys()||[])].filter(id=>id.startsWith('station-')&&id!==E.sceneDesks.selected).map(id=>id.slice(8));});
    const seen={};for(const st of stations)seen[st]=await stageAt(st);
    const withUser=stations.filter(st=>seen[st].desk&&seen[st].users.length);
    const station=withUser.includes('research-desk')?'research-desk':withUser[0]||'research-desk';
    const pc=peopleCheck(withUser.length,opt),who=stations.map(st=>st+': '+(seen[st].users.join('+')||'-')).join(', ');
    if(pc.result==='SKIP')console.log(`SKIP a room desk has a person at it in this chapter: ${pc.why} (${who}); the checks below use the media desk and expect no cast change`);
    else check(pc.result==='PASS','a room desk has a person at it in this chapter',`${pc.why} (${who})`);
    const s0=seen[station]||await stageAt(station),users0=s0.users,own=Object.keys(s0.items);
    console.log(`  desk under test: station-${station}; at it: ${users0.join(', ')||'nobody'}; its own things: ${own.join(', ')||'none'}`);
    const deskRow=rows.find(r=>r.eye&&!r.disabled&&r.key.includes(`:station:${station}"`));
    check(!!deskRow,`the desk under test (station-${station}) has an eye`,'no Layers row with its Studio key');
    if(!deskRow)return;
    check(s0.desk,'before: the desk is on the stage',JSON.stringify(s0));
    const before=await draft(),peopleBefore=JSON.stringify(before?.peopleEdits??null);
    await page.evaluate(k=>{const li=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);li.querySelector('[data-action="ly-row-eye"]').click();},deskRow.key);
    const d1=await until(async()=>{const d=await draft();return {ok:!!d?.deskEdits?.some(e=>e.desk==='station-'+station&&e.hide===true),d};});
    const d=d1.d||{};
    check(d1.ok,'the chapter gets a desk edit with hide',JSON.stringify(d.deskEdits||null));
    const hidProps=(d.propEdits||[]).filter(e=>e.hide===true).map(e=>e.asset||e.match);
    check(own.every(id=>hidProps.some(a=>a.includes(id))),'its own chair and props as prop hide edits',`expected ${own.join(', ')||'none'}; hidden: ${hidProps.join(', ')||'none'}`);
    if(users0.length){
      const out=(d.peopleEdits?.cast||[]).filter(p=>p.station===station);
      check(out.length&&out.every(p=>p.hide===true),`${users0.join(', ')} out of the chapter's cast`,JSON.stringify(out));
    }else check(JSON.stringify(d.peopleEdits??null)===peopleBefore,'nobody at that desk: no peopleEdits written',`before ${peopleBefore.slice(0,80)}, after ${JSON.stringify(d.peopleEdits??null).slice(0,80)}`);
    const s1=await until(async()=>{const s=await stageAt(station);return {ok:!s.desk&&!s.users.length&&Object.values(s.items).every(v=>!v),s};});
    check(s1.ok,'the stage draws neither the desk nor its things nor its person',JSON.stringify(s1.s));
    await click('#director-panel [data-action="undo"]');
    const s2=await until(async()=>{const s=await stageAt(station);return {ok:s.desk&&users0.every(u=>s.users.includes(u))&&own.every(id=>s.items[id]===s0.items[id]),s};});
    check(s2.ok,'one Undo brings them all back',`expected the desk, ${users0.join('+')||'nobody'} and ${own.join(', ')||'nothing'} as before; now ${JSON.stringify(s2.s)}`);
  });
  // ---- 3: a Studio hide, as the page holds it. The harness blocks every page request to /api/studio-state and stubs
  // /__studio/sync.js (director-e2e-harness.mjs: Fetch.failRequest BlockedByClient), so the Director here has no shared
  // state and no Refresh button: the first run's "Failed to fetch" was the page's own fetch of /api/studio-state. The
  // Studio's hide is therefore put in this page's copy of the key (where sync.js would put it); Refresh / Adopt are
  // covered by the node tests (director-layers-exchange-test.mjs) and by hand on the desk.
  if(!opt.shared)await part('part 3',async()=>{
    const id='scene:highschool:house:room:13:ergoflex-designer-chair',key='highschool:house|'+id;   // shown in oilers (moved, not hidden)
    await page.evaluate(k=>{const v=JSON.parse(localStorage.getItem('ergoflex.sceneLayers.v1')||'{}');v[k]={kind:'prop',label:'Designer chair',cells:{'morning/60x30':true}};localStorage.setItem('ergoflex.sceneLayers.v1',JSON.stringify(v));},key);
    await click('#director-panel [data-inspector-tab="layers"]');
    const row=await until(async()=>{const r=await page.evaluate(a=>{const li=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem.includes(`"${a}"`));return li?{chip:!!li.querySelector('.layer-flag.studio'),take:!!li.querySelector('[data-action="ly-studio-take"]'),key:li.dataset.lyItem}:null;},id.slice(6));return {ok:!!r?.chip&&!!r?.take,r};});
    check(row.ok,'the designer chair shows "Studio hides it" with "Hide here too"',JSON.stringify(row.r||'no row for '+id));
    if(!row.ok)return;
    await page.evaluate(k=>{const li=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);li.querySelector('[data-action="ly-studio-take"]').click();},row.r.key);
    const d3=await until(async()=>{const x=await draft();return {ok:!!x?.propEdits?.some(e=>(e.asset||'').endsWith('room:13:ergoflex-designer-chair')&&e.hide===true),x};});
    check(d3.ok,'"Hide here too" writes the chapter\'s hide edit for it',JSON.stringify((d3.x?.propEdits||[]).filter(e=>/designer-chair/.test(e.asset||''))));
    check(!(await page.$('#director-panel [data-studio-refresh]')),'(no Refresh button in this harness: the shared state is blocked)','a Refresh button is drawn: the harness no longer blocks the shared state, extend part 3 to Refresh / Adopt');
  });
  // ---- 5 (shared state): Refresh from Studio / Adopt, with a Studio hide written to the scratch server
  const cellOf=async()=>{const d=await draft();return d?.mode&&d?.size?`${d.mode}/${d.size}`:'morning/60x30';};
  const CHAIR13='scene:highschool:house:room:13:ergoflex-designer-chair';
  if(opt.shared)await part('part 5',async()=>{
    const cell=await cellOf(),got=await api('GET','/api/studio-state'),baseRaw=got.values?.[LAYERS]??null,v=JSON.parse(baseRaw||'{}');
    console.log(`  the chapter's cell: ${cell}`);
    v[ROOM+'|'+CHAIR13]={kind:'prop',label:'Designer chair',cells:{[cell]:true},by:'Studio e2e'};
    const posted=await api('POST','/api/studio-state',{client:'e2e-studio',by:'Studio e2e',changes:[{key:LAYERS,value:JSON.stringify(v),base:baseRaw}]});
    check(posted.results?.[0]&&!posted.results[0].skipped&&!posted.results[0].error,'the Studio hide is on the scratch server (POST /api/studio-state)',JSON.stringify(posted.results));
    const btn=await until(async()=>({ok:await page.evaluate(()=>!!document.querySelector('#director-panel [data-studio-refresh]'))}),30000);
    check(btn.ok,'Refresh from Studio is drawn (the shared state is reachable)','no [data-studio-refresh] button');
    if(!btn.ok)return;
    await click('#director-panel [data-studio-refresh]');
    const adopt=await until(async()=>{const t=await page.evaluate(()=>{const d=document.getElementById('studio-adopt');return d?.open?d.textContent:'';});return {ok:/Hide it in this chapter too/.test(t),t};},60000);
    check(adopt.ok,'Refresh: the Adopt dialog offers "Hide it in this chapter too"',(adopt.t||'').slice(0,200)||await statusOf(page));
    if(!adopt.ok)return;
    check(/designer chair/i.test(adopt.t),'the Adopt row names the stage\'s object (the designer chair)',adopt.t.replace(/\s+/g,' ').slice(0,200));
    await page.evaluate(()=>{const dlg=document.getElementById('studio-adopt');const li=[...dlg.querySelectorAll('li')].find(l=>/Hide it in this chapter too/.test(l.textContent)&&/designer chair/i.test(l.textContent));const r=li.querySelector('[data-adopt]');r.click();r.dispatchEvent(new Event('change',{bubbles:true}));dlg.querySelector('[data-adopt-go]').click();});
    const d=await until(async()=>{const x=await draft();return {ok:!!x?.propEdits?.some(e=>(e.asset||'').endsWith('room:13:ergoflex-designer-chair')&&e.hide===true),x};});
    check(d.ok,'taking it writes the chapter\'s hide edit for the designer chair',JSON.stringify((d.x?.propEdits||[]).filter(e=>/designer-chair/.test(e.asset||''))));
  });
  // ---- 6 (shared state): Make permanent -> the layers key at the chapter's cell, one desk entry, nothing in `removed`
  if(opt.shared)await part('part 6',async()=>{
    const cell=await cellOf();
    // the media desk hidden in this chapter (with its chair and PC tower), through its eye
    await click('#director-panel [data-inspector-tab="layers"]');
    const key=await page.evaluate(()=>[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem.includes(':station:research-desk"'))?.dataset.lyItem||null);
    check(!!key,'the media desk row is there','no Layers row for station-research-desk');
    if(!key)return;
    const before0=await draft();
    if(!before0?.deskEdits?.some(e=>e.desk==='station-research-desk'&&e.hide===true)){
      await page.evaluate(k=>{const li=[...document.querySelectorAll('#director-panel [data-ly-item]')].find(e=>e.dataset.lyItem===k);li.querySelector('[data-action="ly-row-eye"]').click();},key);
      const h=await until(async()=>{const x=await draft();return {ok:!!x?.deskEdits?.some(e=>e.desk==='station-research-desk'&&e.hide===true)};});
      check(h.ok,'the media desk is hidden in this chapter (its eye)','no desk edit with hide');
    }
    const s0=await api('GET','/api/studio-state'),removed0=JSON.stringify(JSON.parse(s0.values?.[ASSETS]||'{}')?.[ROOM]?.removed??null);
    await click('#director-panel [data-inspector-tab="props"]');
    await click('#director-panel [data-action="pp-permanent"]');
    const dlg=await until(async()=>({ok:await page.evaluate(()=>!!document.getElementById('prop-permanent')?.open)}),15000);
    check(dlg.ok,'Make permanent opens its dialog',await statusOf(page));
    if(!dlg.ok)return;
    // only the hides (moves stay out of this check: they write transforms, as before)
    const picked=await page.evaluate(()=>{const d=document.getElementById('prop-permanent'),out=[];for(const li of d.querySelectorAll('.prop-permanent-list li')){const c=li.querySelector('[data-permanent]');if(!c||c.disabled)continue;const on=/hidden in Studio/.test(li.textContent);c.checked=on;if(on)out.push(li.querySelector('b')?.title||'');}d.querySelector('[data-permanent]')?.dispatchEvent(new Event('change',{bubbles:true}));return out;});
    console.log(`  written as hides: ${picked.join(', ')||'none'}`);
    check(picked.some(t=>/designer-chair/.test(t))&&picked.some(t=>/office-chair/.test(t))&&picked.some(t=>/desktop-pc/.test(t)),'the dialog offers the designer chair and the media desk\'s chair and PC tower as Studio hides',picked.join(', '));
    const cellSel=await page.evaluate(()=>document.querySelector('#prop-permanent [data-permanent-cell]')?.value||null);
    check(cellSel===cell,'the dialog writes them at the chapter\'s time and size by default',`select ${cellSel}, chapter ${cell}`);
    await page.evaluate(()=>document.querySelector('#prop-permanent [data-permanent-go]').click());
    const done=await until(async()=>({ok:await page.evaluate(()=>!document.getElementById('prop-permanent')?.open)}),30000);
    check(done.ok,'Make permanent finished',await page.evaluate(()=>document.querySelector('#prop-permanent [data-permanent-status]')?.textContent||''));
    const s1=await api('GET','/api/studio-state'),L=JSON.parse(s1.values?.[LAYERS]||'{}'),removed1=JSON.stringify(JSON.parse(s1.values?.[ASSETS]||'{}')?.[ROOM]?.removed??null);
    const e13=L[ROOM+'|'+CHAIR13],desk=L[ROOM+'|desk:station-research-desk'];
    check(e13?.cells?.[cell]===true,'the designer chair: a Studio hide at the chapter\'s cell',JSON.stringify(e13||null));
    check(desk?.kind==='desk'&&desk?.cells?.[cell]===true,'the media desk: ONE desk entry at the chapter\'s cell',JSON.stringify(desk||null));
    const own=Object.keys(L).filter(k=>/room:(2|20):ergoflex-(office-chair|desktop-pc)$/.test(k));
    check(!own.length,'its chair and PC tower have no entries of their own (folded into the desk)',own.join(', '));
    check(removed1===removed0,'nothing written to `removed` (ergoflex.sceneAssets.v1)',`before ${removed0}, after ${removed1}`);
    const d=await draft();
    check(d?.propEdits?.some(e=>(e.asset||'').endsWith('room:13:ergoflex-designer-chair')&&e.hide===true)&&d?.deskEdits?.some(e=>e.desk==='station-research-desk'&&e.hide===true),'the chapter keeps its own hide edits (the film never reads the Studio hides)',JSON.stringify({props:(d?.propEdits||[]).filter(e=>e.hide===true).map(e=>e.asset),desks:d?.deskEdits}));
  });
  // ---- 4: layers off: the tab as before
  await part('part 4',async()=>{
    await page.evaluate(()=>localStorage.setItem('ergoflex.layers.ui','0'));
    await openChapter(page,base,chapter);await click('#director-panel [data-inspector-tab="layers"]');
    check(!(await page.$('#director-panel [data-action="ly-row-eye"]')),'layers off: no eyes in the tab','eyes still drawn');
    await page.evaluate(()=>localStorage.removeItem('ergoflex.layers.ui'));
  });
  check(!errors.length,'no page errors',errors.slice(0,2).join(' | '));
}catch(error){check(false,'the run',error.message);}
finally{await close();}
console.log(failures.length?`${failures.length} checks failed`:'all checks passed');
process.exit(failures.length?1:0);
