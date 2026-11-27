// Director: desk versions and finish fades in the group selection, and the blank Pearl White opener (real GPU Chrome; run on the render PC,
// under flock /tmp/claude-1000/hq12-stills.lock). Vico, 27 Nov 2026: "select all the desk versions at once, drag, and move them right";
// then a blank Pearl White desk in the Artist's place for the first second and a half.
//   1. drag a box across the Desk versions lane (starting in the Finish lane's empty part): all desks + the finish fade are picked
//   2. drag one picked desk 1.5 s right: they all go, the chapter grows by 1.5 s (shot.seconds, shot.deskVersions, shot.finishFades)
//   3. the Desk version tab's "+ Pearl White opener" fills the gap: a new first desk, look 'blank-pearl', shows 0 - 1.5 s
//   4. the stage names it ("Desk I · Pearl White") at 0.5 s, and the Look select can turn it off and on
//   5. Undo walks it back
//   HQ=exports/cinematic-intro-cut-vicos-3rd-cut node tests/director-group-versions-e2e.mjs      (BASE=http://127.0.0.1:3109 for a running server)
import fs from 'node:fs';
import path from 'node:path';
import {chapterList,root,HQ,wait,openDirectorBrowser,openChapter,seek,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
const subFile=path.join(root,HQ,'director-film','hero-subshots.json');
if(!chapter||!fs.existsSync(subFile)||!/finishFade/.test(fs.readFileSync(subFile,'utf8'))){console.log(`Director group versions e2e: skipped (${HQ} has no hero finish fade)`);process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const draft=()=>page.evaluate(`(()=>{const c=${FILM_DRAFT_READER};const d=c?.drafts?.[c.active]||c?.drafts?.film;const s=d?.shots?.find(s=>s.id==='hero');return s?JSON.parse(JSON.stringify({seconds:s.seconds,versions:s.deskVersions||null,fades:s.finishFades||null})):null;})()`);
const rect=sel=>page.$eval(sel,e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const count=sel=>page.$$eval(sel,e=>e.length);
const undo=async()=>{await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await wait(600);};
try{
  await openChapter(page,base,chapter);
  const T=await page.evaluate(()=>Number(document.querySelector('#director-timeline [data-chapter-seconds]')?.dataset.chapterSeconds)||0).catch(()=>0);
  const lane=await rect('#director-timeline .desk-versions-lane'),fin=await rect('#director-timeline .finish-lane');
  const total=(await draft())?.seconds||T||25.95;
  // 1. a box from the empty start of the Finish lane up across the Desk versions lane, to the end of the chapter
  await page.mouse.move(lane.x+6,fin.y+fin.h/2);await page.mouse.down();
  await page.mouse.move(lane.x+lane.w*.5,lane.y+lane.h/2,{steps:8});await page.mouse.move(lane.x+lane.w-4,lane.y+lane.h/2,{steps:8});await page.mouse.up();await wait(400);
  const picked=await count('#director-timeline .desk-version.grouped'),fades=await count('#director-timeline .finish-ramp.grouped');
  check(picked===4,`the box picks all four desks (${picked})`);
  check(fades===1,`and the finish fade (${fades})`);
  // 2. slide them 1.5 s right
  const b=await rect('#director-timeline .desk-version[data-desk-version="B"]');
  const px=1.5/total*lane.w;
  await page.mouse.move(b.x+b.w/2,b.y+b.h/2);await page.mouse.down();await page.mouse.move(b.x+b.w/2+px/2,b.y+b.h/2,{steps:6});await page.mouse.move(b.x+b.w/2+px,b.y+b.h/2,{steps:6});await page.mouse.up();await wait(700);
  let d=await draft();
  check(d&&d.seconds>total+1.3&&d.seconds<total+1.8,`the chapter grew by about 1.5 s (${total} -> ${d?.seconds})`);
  check(d?.versions&&d.versions[0].n==='B'&&d.versions[0].start>1.2&&d.versions[0].start<1.8,`the first desk starts about 1.5 s in (${d?.versions?.[0]?.start})`);
  check(d?.versions&&d.versions.at(-1).end>=d.seconds-.05,'the last desk runs to the new end');
  check(d?.fades?.H&&d.fades.H.at[0]>20.3,`the finish fade moved with them (${JSON.stringify(d?.fades?.H?.at)})`);
  // 3. the opener
  await page.click('#director-timeline .desk-version[data-desk-version="B"]');await wait(500);
  await page.click('#director-panel [data-dv-opener]');await wait(900);
  d=await draft();
  const first=d?.versions?.[0];
  check(first&&first.look==='blank-pearl'&&first.start===0,`a blank Pearl White desk is first (${JSON.stringify(first)})`);
  check(d?.versions?.length===5&&Math.abs((d.versions[1].start+first.end)/2-1.5)<.06,'the change to the Artist is at about 1.5 s');
  // 4. the stage names it; the Look select
  await seek(page,.5/ (d?.seconds||27.45));await wait(2500);
  const badge=await page.$eval('.desk-version-badge',e=>e.textContent).catch(()=>'');
  check(/Pearl White/.test(badge),`the frame badge reads "${badge}" at 0.5 s`);
  await page.$eval('#director-panel [name="dv-look"]',e=>{e.value='';e.dispatchEvent(new Event('change',{bubbles:true}));});await wait(500);
  d=await draft();check(!d?.versions?.[0]?.look,'Look: the model\'s own turns the blank off');
  await undo();d=await draft();check(d?.versions?.[0]?.look==='blank-pearl','Undo brings the blank look back');
  // 5. undo the opener, then the slide
  await undo();d=await draft();check(d?.versions?.length===4&&d.versions[0].n==='B','Undo takes the opener away');
  await undo();d=await draft();check(!d?.versions||d.versions[0].start<.1,'Undo takes the slide back');
  if(errors.length)for(const e of errors)check(false,'page error: '+e);
}catch(e){check(false,'e2e threw: '+(e.stack||e));}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} FAILED`);process.exit(1);}
console.log('\nDirector group versions e2e passed');
