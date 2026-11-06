// Director "Reset camera to the film", end to end (real GPU Chrome; not one of the quick tests/cinematic-* checks).
// Chapter 2 (rise): orbiting, panning and zooming the live view with no key selected never changes a camera key or
// adds an undo step; Esc in the 3D view keeps the full-frame camera; then add a key, orbit again and press Reset camera
// to the film while the orbit is still coasting: the keys are the film's again, and at 3 playhead times the live camera
// matrices equal the film's (the view the chapter opened with) and Render still's (experience/film-render.mjs).
// One Ctrl+Z brings back the keys from before the reset.
//
//   node tests/director-camera-reset-e2e.mjs        (BASE=http://127.0.0.1:3150 to use a running server)
// Needs <hq>/director-chapters.json, the chapter pages and director-film/ (exports/ is untracked: skipped when they are
// missing). Run it under flock /tmp/claude-1000/hq12-stills.lock.
import assert from 'node:assert/strict';
import {chapterList,HQ,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter){console.log(`Director camera reset e2e: skipped (${HQ}/director-chapters.json has no rise chapter in this checkout).`);process.exit(0);}
// Inside the rise from the desk to the wide, inside the standing hold, and in the settle as the desk lowers.
const TIMES=[3.13,8.6,11.2],TOL={world:2e-3,fov:1e-3,proj5:1e-4,proj0:6e-3};
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  const status=()=>statusOf(page);
  const camera=(which='live')=>page.evaluate(which=>{
    const f=which==='live'?document.getElementById('stage'):document.querySelector('iframe[title="Film still renderer"]');
    const {camera}=f.contentWindow.ErgoPresentation.three();camera.updateMatrixWorld(true);
    return {world:[...camera.matrixWorld.elements],proj:[...camera.projectionMatrix.elements],fov:camera.fov,aspect:camera.aspect};
  },which);
  const state=()=>page.evaluate(()=>{
    let draft=null;try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));draft=JSON.stringify(((v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].camera)??null);}catch{}
    return {keys:JSON.stringify(document.getElementById('stage').contentWindow.ErgoPresentation.cameraKeys()),draft,undo:!document.querySelector('#director-panel [data-action=undo]').disabled};
  });
  const diff=(a,b)=>({world:Math.max(...a.world.map((v,i)=>Math.abs(v-b.world[i]))),fov:Math.abs(a.fov-b.fov),proj5:Math.abs(a.proj[5]-b.proj[5]),proj0:Math.abs(a.proj[0]/b.proj[0]-1)});
  const close_=(d,t=TOL)=>d.world<t.world&&d.fov<t.fov&&d.proj5<t.proj5&&d.proj0<t.proj0;
  const fmt=d=>`world Δ ${d.world.toExponential(1)}, fov Δ ${d.fov.toExponential(1)}, proj[5] Δ ${d.proj5.toExponential(1)}`;
  const box=await (async()=>{await openChapter(page,base,chapter);return page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.55};});})();
  async function drag(dx,dy,button='left'){await page.mouse.move(box.x,box.y);await page.mouse.down({button});for(let i=1;i<=8;i++){await page.mouse.move(box.x+dx*i/8,box.y+dy*i/8);await wait(25);}await page.mouse.up({button});}

  // The film's camera: the live view at the 3 times as the chapter opened (= the film's frame: director-live-camera-e2e).
  const film=[];for(const t of TIMES){await seek(page,t);await wait(600);film.push(await camera());}
  await seek(page,5);await wait(600);const opened=await state(),at5=await camera();
  check(!opened.undo,'the chapter opens with nothing to undo');

  // ---- orbit, pan and zoom with no key selected: keys and undo untouched; Esc in the 3D view keeps the framing
  const aspect=(await camera()).aspect;
  await drag(150,-30);await wait(300);await drag(-90,40,'right');await wait(300);
  await page.mouse.move(box.x,box.y);await page.mouse.wheel({deltaY:-240});await wait(1500);
  check(diff(await camera(),at5).world>.01,'the live view moved');
  const orbited=await state();
  check(orbited.keys===opened.keys,'orbit / pan / zoom: the stage camera keys are unchanged');
  check(orbited.draft===opened.draft,'orbit / pan / zoom: the cut\'s camera (draft) is unchanged');
  check(!orbited.undo,'orbit / pan / zoom: no undo step');
  await page.keyboard.press('Escape');await wait(600);
  check(Math.abs((await camera()).aspect-aspect)<1e-6,`Esc in the 3D view keeps the full-frame camera (aspect ${aspect.toFixed(3)})`);

  // ---- an edit to reset: a key from the orbited view
  await page.evaluate(()=>document.querySelector('[data-action=key-add]').click());await wait(900);
  const edited=await state();check(edited.keys!==opened.keys&&edited.undo,'+ Add camera keyframe changed the keys (one undo step)');
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=camera]').click());await wait(300);
  const label=await page.$eval('#director-panel [data-action=camera-clear]',b=>b.textContent.trim());
  check(label==='Reset camera to the film',`film chapter button reads "${label}"`);

  // ---- orbit again and reset while the orbit is still coasting (OrbitControls damping)
  await drag(-160,25);
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=camera-clear]').click());await wait(1200);
  check((await status())==='Camera reset to the film.','status: '+await status());
  const reset=await state();
  check(reset.keys===opened.keys,'the stage camera keys are the film\'s again');
  await wait(400);check((await state()).draft===opened.draft||opened.draft===null,'the cut\'s camera (draft) is the film\'s again');
  // Right after the reset, without a seek: the view is the film's at the playhead (no orbit left).
  await wait(1500);const now=diff(await camera(),at5);
  check(close_(now,{world:1e-5,fov:1e-6,proj5:1e-6,proj0:1e-6}),`right after the reset (no seek) the view is the film's at the playhead, 5 s (${fmt(now)})`);
  for(const [i,t] of TIMES.entries()){
    await seek(page,t);await wait(800);
    const live=await camera(),dFilm=diff(live,film[i]);
    check(close_(dFilm,{world:1e-5,fov:1e-6,proj5:1e-6,proj0:1e-6}),`${t} s: live camera = the film's (${fmt(dFilm)})`);
    const count=await page.$$eval('#film-still [data-still-index]',e=>e.length);
    await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
    await page.waitForFunction(n=>document.querySelectorAll('#film-still [data-still-index]').length>n||/Render still failed/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000},Math.min(count,11));
    const st=await status();check(/Still rendered/.test(st),`${t} s: ${st}`);
    const dStill=diff(live,await camera('still'));
    await page.evaluate(()=>document.querySelector('#film-still [data-still-close]')?.click());await wait(300);
    check(close_(dStill),`${t} s: live camera = Render still's (${fmt(dStill)})`);
  }

  // ---- one Ctrl+Z: the keys from before the reset
  await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(1200);
  check(/^Undone: Camera reset to the film/.test(await status()),'one undo step: '+await status());
  const undone=await state();
  check(undone.keys===edited.keys,'Ctrl+Z brings back the keys from before the reset');
  check(undone.draft===edited.draft,'Ctrl+Z brings back the cut\'s camera (draft) from before the reset');
}finally{await close();}
check(!errors.length,'no page / module ("not exported") errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log(`Director camera reset: orbit leaves the keys alone, Reset camera to the film = the film and Render still at ${TIMES.join(', ')} s, one undo brings the edit back.`);
