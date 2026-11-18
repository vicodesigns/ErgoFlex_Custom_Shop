// Room looks in the Director (room-looks.mjs, 18 Nov 2026) end to end (real GPU Chrome): the Create chapter's Room inspector
// has a Room look selector (Studio refresh by default), its chapter card says the look, choosing Classic rebuilds the live
// room in the Classic look at once (the old floor, no ferns), ⇄ Other look flips back, Undo puts the last look back, and
// the cut's chapter keeps the field (Export cut sends it). Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-room-look-e2e.mjs
// 18 Nov 2026, second room: the Commons chapter (room 'library', layout 'humboldt') runs the same checks: Classic = the
// Commons before the Nov 17-18 passes (no potted ferns, solar shades or field guides; its framed landscape print back).
// ROOM_LOOK_CHAPTERS=create,commons (default both).
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,status,wait,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const {base,page,errors,close}=await openDirectorBrowser();
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=180000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const live=()=>page.evaluate(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));
// What each look builds, by names in the stage's room (refresh: the passes' pieces; classic: none of them, the old ones)
const ROOMS={
  create:{studio:'creative',names:['Oiled oak studio floor','Limewashed gallery brickwork','Potted fern'],
    refresh:n=>n['Oiled oak studio floor']&&n['Limewashed gallery brickwork']&&n['Potted fern']>0,classic:n=>!n['Oiled oak studio floor']&&!n['Limewashed gallery brickwork']&&!n['Potted fern'],
    say:{refresh:'oak floor, brick wall, ferns',classic:'no oak floor, brick or ferns'}},
  commons:{studio:'library',names:['Potted fern','Woven solar shades','North Coast field guides','Framed landscape print'],
    refresh:n=>n['Potted fern']>0&&n['Woven solar shades']&&n['North Coast field guides']&&!n['Framed landscape print'],classic:n=>!n['Potted fern']&&!n['Woven solar shades']&&!n['North Coast field guides']&&n['Framed landscape print'],
    say:{refresh:'potted ferns, solar shades, field guides',classic:'no ferns, shades or guides; the framed landscape print'}},
};
// the stage's room: its id, look and the counted names
const room=names=>page.evaluate(names=>{const e=document.getElementById('stage').contentWindow.ErgoFlex,r=e?.workspaceRoom;if(!r?.root)return null;const n={};r.root.traverse(o=>{if(names.includes(o.name))n[o.name]=(n[o.name]||0)+1;});
  return {id:r.id,layout:r.roomLayout?.id,look:r.look,n,studio:e.roomLook?.(r.id)};},names);
const select=()=>page.evaluate(()=>{const el=document.querySelector('#director-panel [data-inspector-page="chapter"] select[name="look"]');return el?{value:el.value,options:[...el.options].map(o=>o.value+':'+o.textContent)}:null;});
const card=()=>page.evaluate(()=>document.querySelector('.chapter-card.selected .chapter-look')?.textContent||'');
const choose=v=>page.evaluate(v=>{const el=document.querySelector('#director-panel [data-inspector-page="chapter"] select[name="look"]');el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},v);
// the saved draft of this chapter (the film draft store, else the library's active draft): what Export cut sends
const draftLook=id=>page.evaluate(`(()=>{const c=${FILM_DRAFT_READER};const d=c?.drafts?.[c.active]||c?.drafts?.film;const s=d?.shots?.find(s=>s.id===${JSON.stringify(id)});return s?(s.look??'(none)'):null;})()`);
const which=(process.env.ROOM_LOOK_CHAPTERS||'create,commons').split(',').filter(Boolean);
try{
  for(const id of which){
  const R=ROOMS[id];assert.ok(R,'no room-look checks for chapter '+id);
  const chapter=chapterList().find(c=>c.id===id);assert.ok(chapter,`the film has a ${id} chapter`);
  await openChapter(page,base,chapter);
  await page.click('#director-panel [data-inspector-tab="chapter"]');await wait(300);
  const first=await until(select,id+': the Room look selector');
  check(first.value==='refresh'&&first.options.join()==='refresh:Studio refresh,classic:Classic',id+': the Room inspector has the room\'s looks, Studio refresh selected: '+first.options.join(', '));
  const r0=await until(()=>room(R.names),id+': the stage room');
  check(r0.id===R.studio&&r0.look==='refresh'&&R.refresh(r0.n),`${id}: the live room is the refresh (${R.say.refresh}): ${JSON.stringify(r0)}`);
  check(/Studio refresh/i.test(await card()),id+': the chapter card says the look');
  // ---- Classic: the live room rebuilds at once
  const t0=Date.now();await choose('classic');
  const r1=await until(async()=>{const r=await room(R.names);return r?.look==='classic'&&await live()?r:null;},id+': the room rebuilds in Classic');
  check(R.classic(r1.n)&&r1.studio==='classic',`${id} Classic: the room as before the pass (${R.say.classic}), in ${((Date.now()-t0)/1000).toFixed(1)} s: ${JSON.stringify(r1)}`);
  check((await select()).value==='classic'&&/Classic/.test(await card()),id+': the selector and the card follow');
  // ---- the flip button and Undo
  // (a real pointer press: the button must be enabled and on top, not under the still strip, a hint or the panel's edge)
  const hit=await until(()=>page.evaluate(()=>{const b=document.querySelector('#director-panel [data-action="look-flip"]');if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
    return !b.disabled&&r.width>0&&(top===b||b.contains(top))?{x,y}:null;}),id+': the ⇄ Other look button enabled and on top',60000).catch(async e=>{
    const why=await page.evaluate(()=>{const b=document.querySelector('#director-panel [data-action="look-flip"]');if(!b)return 'no button';const r=b.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return `disabled=${b.disabled} rect=${[r.left,r.top,r.width,r.height].map(Math.round)} on top: ${top?.tagName}.${top?.className} ${top?.closest('[id]')?.id||''} · viewport ${innerWidth}x${innerHeight}`;});
    throw Error(e.message+' · '+why);});
  await page.mouse.click(hit.x,hit.y);
  await until(async()=>(await room(R.names))?.look==='refresh'&&await live(),id+': ⇄ flips back to the refresh (status after the press: '+await status(page)+')');
  check(R.refresh((await room(R.names)).n),id+': ⇄ Other look: back to the refresh');
  await until(live,id+': the refresh restage done');await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');
  await until(async()=>(await select())?.value==='classic',id+': Undo puts Classic back in the selector');
  check(true,id+': Undo puts the last look back');
  // ---- the cut keeps it (what Export cut sends)
  const kept=await until(async()=>(await draftLook(id))==='classic',id+': the draft keeps look: classic (it has '+await draftLook(id)+')',30000);
  check(kept,id+': the cut\'s chapter keeps look: classic');
  }
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log('PASS Director room looks: '+passed.join('; ')+'.');
}catch(error){console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));process.exitCode=1;}
finally{await close();}
