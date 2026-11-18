// Room looks in the Director (room-looks.mjs, 18 Nov 2026) end to end (real GPU Chrome): the Create chapter's Room inspector
// has a Room look selector (Studio refresh by default), its chapter card says the look, choosing Classic rebuilds the live
// room in the Classic look at once (the old floor, no ferns), ⇄ Other look flips back, Undo puts the last look back, and
// the cut's chapter keeps the field (Export cut sends it). Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-room-look-e2e.mjs
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,status,wait,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const {base,page,errors,close}=await openDirectorBrowser();
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=180000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const live=()=>page.evaluate(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));
// the stage's room: its look and which of the two floors it built
const room=()=>page.evaluate(()=>{const e=document.getElementById('stage').contentWindow.ErgoFlex,r=e?.workspaceRoom;if(!r?.root)return null;let ferns=0;r.root.traverse(o=>{if(o.name==='Potted fern')ferns++;});
  return {id:r.id,look:r.look,oak:!!r.root.getObjectByName('Oiled oak studio floor'),brick:!!r.root.getObjectByName('Limewashed gallery brickwork'),ferns,studio:e.roomLook?.('creative')};});
const select=()=>page.evaluate(()=>{const el=document.querySelector('#director-panel [data-inspector-page="chapter"] select[name="look"]');return el?{value:el.value,options:[...el.options].map(o=>o.value+':'+o.textContent)}:null;});
const card=()=>page.evaluate(()=>document.querySelector('.chapter-card.selected .chapter-look')?.textContent||'');
const choose=v=>page.evaluate(v=>{const el=document.querySelector('#director-panel [data-inspector-page="chapter"] select[name="look"]');el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},v);
// the saved draft of this chapter (the film draft store, else the library's active draft): what Export cut sends
const draftLook=()=>page.evaluate(`(()=>{const c=${FILM_DRAFT_READER};const d=c?.drafts?.[c.active]||c?.drafts?.film;const s=d?.shots?.find(s=>s.id==='create');return s?(s.look??'(none)'):null;})()`);
try{
  const create=chapterList().find(c=>c.id==='create');assert.ok(create,'the film has a Create chapter');
  await openChapter(page,base,create);
  await page.click('#director-panel [data-inspector-tab="chapter"]');await wait(300);
  const first=await until(select,'the Room look selector');
  check(first.value==='refresh'&&first.options.join()==='refresh:Studio refresh,classic:Classic','the Room inspector has the room\'s looks, Studio refresh selected: '+first.options.join(', '));
  const r0=await until(room,'the stage room');
  check(r0.id==='creative'&&r0.look==='refresh'&&r0.oak&&r0.brick&&r0.ferns>0,'the live room is the refresh: oak floor, brick wall, ferns');
  check(/Studio refresh/i.test(await card()),'the chapter card says the look');
  // ---- Classic: the live room rebuilds at once
  const t0=Date.now();await choose('classic');
  const r1=await until(async()=>{const r=await room();return r?.look==='classic'&&await live()?r:null;},'the room rebuilds in Classic');
  check(!r1.oak&&!r1.brick&&r1.ferns===0&&r1.studio==='classic','Classic: the room as before the pass (no oak floor, brick or ferns), in '+((Date.now()-t0)/1000).toFixed(1)+' s');
  check((await select()).value==='classic'&&/Classic/.test(await card()),'the selector and the card follow');
  // ---- the flip button and Undo
  // (a real pointer press: the button must be enabled and on top, not under the still strip, a hint or the panel's edge)
  const hit=await until(()=>page.evaluate(()=>{const b=document.querySelector('#director-panel [data-action="look-flip"]');if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
    return !b.disabled&&r.width>0&&(top===b||b.contains(top))?{x,y}:null;}),'the ⇄ Other look button enabled and on top',60000).catch(async e=>{
    const why=await page.evaluate(()=>{const b=document.querySelector('#director-panel [data-action="look-flip"]');if(!b)return 'no button';const r=b.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return `disabled=${b.disabled} rect=${[r.left,r.top,r.width,r.height].map(Math.round)} on top: ${top?.tagName}.${top?.className} ${top?.closest('[id]')?.id||''} · viewport ${innerWidth}x${innerHeight}`;});
    throw Error(e.message+' · '+why);});
  await page.mouse.click(hit.x,hit.y);
  await until(async()=>(await room())?.look==='refresh'&&await live(),'⇄ flips back to the refresh (status after the press: '+await status(page)+')');
  check((await room()).oak,'⇄ Other look: back to the refresh');
  await until(live,'the refresh restage done');await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');
  await until(async()=>(await select())?.value==='classic','Undo puts Classic back in the selector');
  check(true,'Undo puts the last look back');
  // ---- the cut keeps it (what Export cut sends)
  const kept=await until(async()=>(await draftLook())==='classic','the draft keeps look: classic (it has '+await draftLook()+')',30000);
  check(kept,'the cut\'s chapter keeps look: classic');
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log('PASS Director room looks: '+passed.join('; ')+'.');
}catch(error){console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));process.exitCode=1;}
finally{await close();}
