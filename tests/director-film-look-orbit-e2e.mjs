// Director Film look follows an orbit, end to end (real GPU Chrome; not one of the quick tests/cinematic-* checks).
// Chapter 3 (create), a camera key selected, Film look on: orbiting the live view no longer snaps back to the saved
// key. The still is rendered from the live camera (the still renderer's camera = the live one) and the badge says
// "your view (not saved)", with the hint "Update selected view keeps this camera."; after Update selected view the
// badge is the normal one again.
//
//   node tests/director-film-look-orbit-e2e.mjs        (BASE=http://127.0.0.1:3102 to use a running server)
// Needs <hq>/director-chapters.json and the chapter pages (exports/ is untracked: skipped when they are missing).
import assert from 'node:assert/strict';
import {chapterList,HQ,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='create');
if(!chapter){console.log(`Director Film look orbit e2e: skipped (${HQ}/director-chapters.json has no create chapter in this checkout).`);process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  const camera=(which='live')=>page.evaluate(which=>{
    const f=which==='live'?document.getElementById('stage'):document.querySelector('iframe[title="Film still renderer"]');
    const {camera}=f.contentWindow.ErgoPresentation.three();camera.updateMatrixWorld(true);return [...camera.matrixWorld.elements];
  },which);
  const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  const badge=()=>page.$eval('.film-look-badge',e=>e.textContent);
  // The film look shown for the current view (a fresh still: the badge's shown state follows the latest poke).
  async function shown(){
    for(const until=Date.now()+300000;Date.now()<until;await wait(500)){
      const [on,st]=await page.evaluate(()=>[!!document.querySelector('.film-box.film-look')?.classList.contains('shown'),document.querySelector('#director-panel [data-status]')?.textContent||'']);
      if(on){await wait(200);return;}if(/^Film look: (?!pause)/.test(st))throw Error(st);
    }
    throw Error('Film look still not shown after 300 s: '+await statusOf(page));
  }
  await openChapter(page,base,chapter);
  const box=await page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.55};});
  async function drag(dx,dy){await page.mouse.move(box.x,box.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(box.x+dx*i/8,box.y+dy*i/8);await wait(25);}await page.mouse.up();}

  // Select the camera key nearest 2.4 s (its diamond seeks there) and turn Film look on.
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=camera]').click());await wait(300);
  const key=await page.evaluate(()=>{const s=document.querySelector('#director-panel [name=camera-key]');if(!s)return null;
    const o=[...s.options].filter(o=>o.value).map(o=>({v:o.value,t:parseFloat(o.textContent.split('·').pop())})).sort((a,b)=>Math.abs(a.t-2.4)-Math.abs(b.t-2.4))[0];
    s.value=o.v;s.dispatchEvent(new Event('change',{bubbles:true}));return o;});
  check(!!key,`camera key selected (${key?.t} s)`);await wait(800);
  await page.evaluate(()=>{const b=document.querySelector('.film-tools [data-film-mode]');while(b.textContent!=='Film look')b.click();});
  await shown();
  const saved=await badge();
  check(/^FILM LOOK · \d+\.\d\d s · [\d.]+ s$/.test(saved),`at the key: the normal badge ("${saved}")`);
  const savedCam=await camera();

  // ---- orbit: the film look renders the live camera, the badge says so, the hint names Update selected view
  await drag(160,-30);await wait(100);await page.mouse.move(box.x,box.y);await page.mouse.wheel({deltaY:-200});
  await shown();
  const orbited=await badge(),live=await camera(),still=await camera('still');
  check(delta(live,savedCam)>.01,'the live view moved');
  check(/^FILM LOOK · \d+\.\d\d s · your view \(not saved\) · [\d.]+ s$/.test(orbited),`after the orbit: "${orbited}"`);
  check(delta(still,live)<2e-3,`the film look still uses the live camera (Δ ${delta(still,live).toExponential(1)})`);
  check(delta(await camera(),live)<1e-9,'the live view stays where the orbit left it (no snap back)');
  const hint=await statusOf(page);check(hint==='Update selected view keeps this camera.',`status hint: "${hint}"`);

  // ---- Update selected view: the keys hold this camera, the badge is the normal one again
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=key-update]').click());
  await wait(100);await shown();
  const updated=await badge();
  check(/^FILM LOOK · \d+\.\d\d s · [\d.]+ s$/.test(updated),`after Update selected view: the normal badge ("${updated}")`);
  // The normal still is the saved camera: the view the keys give at the playhead (Go to view seeks there).
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=key-go]').click());await wait(800);
  const keyed=await camera(),dSaved=delta(await camera('still'),keyed);
  check(dSaved<2e-3,`the still after Update selected view uses the saved camera (Δ ${dSaved.toExponential(1)})`);
}finally{await close();}
check(!errors.length,'no page / module ("not exported") errors'+(errors.length?': '+errors.join(' | '):''));
assert.equal(failures.length,0,failures.join('; '));
console.log('Director Film look orbit: the film look renders the live camera after an orbit ("your view (not saved)"), the saved one after Update selected view.');
