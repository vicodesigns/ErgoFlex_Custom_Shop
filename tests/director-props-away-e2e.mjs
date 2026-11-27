// (28 Nov 2026: the hero's Office desk now keeps its items on the desk, shot.keepDeskItems: NO put-away stretches there; the lane still draws them for a desk without the flag.)
// Director Props lane: a loose item of the desktop that the desk puts away on its shelf while it is tilted is drawn with a hatched
// "put away" stretch (prop-stow-window.mjs awayStretches), so what comes onto the desktop later is seen coming. The hero's Office desk
// (D) opens tilted 30 deg and is level by 12.4 s (c-tilt 10.1 s + 2.3 s): its desktop items are on the shelf until about 11.5 s, the keyboard
// and mouse until about 11.6 s.
//   HQ=exports/cinematic-intro-cut-vicos-3rd-cut node tests/director-props-away-e2e.mjs   (run on the render PC, under flock /tmp/claude-1000/hq12-stills.lock)
import {chapterList,wait,openDirectorBrowser,openChapter,seek} from './director-e2e-harness.mjs';
const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter){console.log('Director props away e2e: skipped (no hero chapter in this cut)');process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  await openChapter(page,base,chapter);
  await seek(page,10.5);await wait(2500);                 // the Office desk is on the stage: its items are learned
  await page.click('[data-action="pp-add"]').catch(()=>{});await wait(200);await page.keyboard.press('Escape');
  await seek(page,10.6);await wait(2500);
  const bars=await page.$$eval('#director-timeline .prop-bar',b=>b.map(x=>({name:x.textContent.trim(),title:x.title,left:parseFloat(x.style.left),width:parseFloat(x.style.width),away:[...x.querySelectorAll('.prop-away')].map(a=>({left:parseFloat(a.style.left),width:parseFloat(a.style.width)}))})));
  const T=25.95,withAway=bars.filter(b=>b.away.length);
  console.log(`info  ${bars.length} bars, ${withAway.length} with a put-away stretch: ${withAway.slice(0,8).map(b=>b.name).join(' | ')}`);
  check(withAway.length===0,'the Office desk keeps its items on the desk: no put-away stretch in any bar');
  check(bars.length>20,`the Props lane lists the desk's items (${bars.length} bars)`);
  const laneH=await page.$eval('[data-props-lane]',e=>e.getBoundingClientRect().height);
  check(laneH>9*17+10,`the Props lane is taller than nine rows (${Math.round(laneH)} px)`);
  if(errors.length)for(const e of errors)check(false,'page error: '+e);
}catch(e){check(false,'e2e threw: '+(e.stack||e));}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} FAILED`);process.exit(1);}
console.log('\nDirector props away e2e passed');
