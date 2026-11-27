// Director "Finish" lane, end to end (real GPU Chrome; run on the render PC, under flock /tmp/claude-1000/hq12-stills.lock).
// The hero's last desk (H · Gaming) turns Pearl White before the logo (shot.finishFade on the sub-shot, 19.2-20.45 s in the 3rd cut).
// The Director shows it as a block in the Finish lane under Desk versions: its start, how long it takes, and the finish it ends in; both
// edges and the body drag; the Desk version tab has the numbers and the finishes; Add and Remove work; Undo brings a removed one back;
// edits land in the cut's shot.finishFades (what the importer writes onto the sub-shot).
//
//   HQ=exports/cinematic-intro-cut-vicos-3rd-cut node tests/director-finish-lane-e2e.mjs      (BASE=http://127.0.0.1:3109 for a running server)
import fs from 'node:fs';
import path from 'node:path';
import {chapterList,root,HQ,wait,openDirectorBrowser,openChapter,seek,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
const subFile=path.join(root,HQ,'director-film','hero-subshots.json');
if(!chapter||!fs.existsSync(subFile)||!/finishFade/.test(fs.readFileSync(subFile,'utf8'))){console.log(`Director finish lane e2e: skipped (${HQ} has no hero finish fade: run it with HQ=exports/cinematic-intro-cut-vicos-3rd-cut)`);process.exit(0);}
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const draftFades=()=>page.evaluate(`(()=>{const c=${FILM_DRAFT_READER};const d=c?.drafts?.[c.active]||c?.drafts?.film;const s=d?.shots?.find(s=>s.id==='hero');return s&&s.finishFades?JSON.parse(JSON.stringify(s.finishFades)):null;})()`);
const ramps=()=>page.$$eval('#director-timeline .finish-ramp',b=>b.map(x=>({n:x.dataset.ff,left:parseFloat(x.style.left),width:parseFloat(x.style.width)})));
const held=()=>page.$$eval('#director-timeline .finish-held strong',b=>b.map(x=>x.textContent));
const setField=async(name,value)=>{await page.$eval(`#director-panel [name="${name}"]`,(el,v)=>{el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},value);await wait(400);};
const secs=pct=>pct/100*25.95;
try{
  await openChapter(page,base,chapter);
  let r=await ramps();
  check(r.length===1&&r[0].n==='H',`the Finish lane shows one fade, on desk H (${JSON.stringify(r)})`);
  check(Math.abs(secs(r[0].left)-19.2)<.05&&Math.abs(secs(r[0].left+r[0].width)-20.45)<.05,`it runs 19.2-20.45 s (${secs(r[0].left).toFixed(2)}-${secs(r[0].left+r[0].width).toFixed(2)})`);
  check((await held()).join()==='Pearl White',`the held block reads "${(await held()).join()}"`);
  check(await draftFades()===null,'nothing is written to the cut until it is edited');
  // click: the Desk version tab opens on the fade and the playhead goes to its start
  await page.click('#director-timeline .finish-ramp');await wait(500);
  check(await page.$('#director-panel [name="ff-start"]')!==null,'a click opens the Finish fade numbers in the Desk version tab');
  // numbers
  await setField('ff-start',18);
  let f=await draftFades();check(f?.H&&Math.abs(f.H.at[0]-18)<.01&&Math.abs(f.H.at[1]-20.45)<.01,`Starts 18 -> at ${JSON.stringify(f?.H?.at)}`);
  await setField('ff-len',2.5);
  f=await draftFades();check(f?.H&&Math.abs(f.H.at[1]-20.5)<.01,`Takes 2.5 s -> at ${JSON.stringify(f?.H?.at)}`);
  await setField('ff-wood','Warm Ivory');
  f=await draftFades();check(f?.H?.set?.deskFinish?.wood==='Warm Ivory','Top finish Warm Ivory is in the look');
  check(f?.H?.set?.lights?.length>0,'the look keeps its lights');
  // drag the end handle left by 5 % of the lane
  const box=await page.$eval('#director-timeline .finish-ramp .finish-h.end',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const lane=await page.$eval('#director-timeline .finish-lane',e=>e.getBoundingClientRect().width);
  await page.mouse.move(box.x,box.y);await page.mouse.down();await page.mouse.move(box.x-lane*.03,box.y,{steps:6});await page.mouse.up();await wait(500);
  const f2=await draftFades();check(f2?.H&&f2.H.at[1]<f.H.at[1]-.5,`dragging the end handle left shortens the fade (${f.H.at[1]} -> ${f2?.H?.at[1]})`);
  // remove, then undo
  await page.click('#director-panel [data-ff-remove]');await wait(500);
  check((await ramps()).length===0,'Remove takes the block off the lane');
  check(JSON.stringify(await draftFades())==='{}','the cut keeps an empty list (so the importer takes the film fade away)');
  await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');await wait(600);
  check((await ramps()).length===1,'Undo brings the fade back');
  // add on desk C (Office) at 13 s
  await page.$eval('#director-panel [data-ff-reset]',e=>e.click());await wait(500);
  check((await draftFades())===null,'Reset to the film drops the cut\'s own list');
  await seek(page,12.5);
  await page.click('#director-timeline [data-ff-add]');await wait(600);
  f=await draftFades();check(f&&f.D&&f.H&&Math.abs(f.D.at[0]-12.5)<.06,`+ on Desk D at 12.5 s adds a fade there (${JSON.stringify(f&&Object.keys(f))}, D at ${JSON.stringify(f?.D?.at)})`);
  // live preview: inside the held part of H the stage has the white look
  await seek(page,23);await wait(1500);
  const wood=await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex?.currentConfig?.woodFinish);
  console.log('info  stage desk top at 23 s:',wood);
  if(errors.length)for(const e of errors)check(false,'page error: '+e);
}catch(e){check(false,'e2e threw: '+(e.stack||e));}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} FAILED`);process.exit(1);}
console.log('\nDirector finish lane e2e passed');
