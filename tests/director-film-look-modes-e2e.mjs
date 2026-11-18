// Director Live / Film look / Split, measured in pixels (real GPU Chrome, 18 Nov 2026: Vico saw the same picture in all
// three). Create chapter, the frame as the page draws it (screenshots of the 16:9 frame: the stage plus the overlay):
//   Live         the fast preview; the reference (two shots a second apart give the live noise floor)
//   Film look    the badge says it is working within a second of the press; once shown the frame differs from Live
//   Split        no new render (the same film still); left of the wipe = Live, right of it = Film look; LIVE / FILM tags
//   Live again   the overlay gone at once: the frame is Live's
//   Busy rest    Film look pressed while a Render still is running: it waits for it ("waits for the Render still"), then shows
// Prints the film side's own account (state, why, pokes, renders, ms) on a failure. Writes the frames to OUT (default:
// a temp dir) for a look.
//   flock /tmp/claude-1000/hq12-stills.lock node tests/director-film-look-modes-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {chapterList,HQ,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='create');
if(!chapter){console.log(`Director Film look modes e2e: skipped (${HQ}/director-chapters.json has no create chapter in this checkout).`);process.exit(0);}
const OUT=process.env.OUT||fs.mkdtempSync(path.join(os.tmpdir(),'film-look-modes-'));fs.mkdirSync(OUT,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],notes={},check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const film=()=>page.evaluate(()=>{const b=document.querySelector('.film-box.film-look');return {...(b?.filmLook?.()||{}),shown:!!b?.classList.contains('shown'),badge:b?.querySelector('.film-look-badge')?.textContent||'',
  badgeOn:b?Number(getComputedStyle(b.querySelector('.film-look-badge')).opacity)>.5:false,liveTag:b?getComputedStyle(b.querySelector('.film-live-tag')).display!=='none':false,
  button:document.querySelector('.film-tools [data-film-mode]')?.textContent||''};});
const press=()=>page.evaluate(()=>document.querySelector('.film-tools [data-film-mode]').click());
async function modeTo(label){for(let i=0;i<3;i++){if((await film()).button===label)return;await press();await wait(60);}throw Error('the mode button never said '+label);}
// The 16:9 frame as the page draws it (stage + overlay), as a data URL
async function frame(name){
  const r=await page.$eval('#stage',e=>{const b=e.getBoundingClientRect();return {x:b.left,y:b.top,width:b.width,height:b.height};});
  const png=await page.screenshot({clip:r,type:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),png);return 'data:image/png;base64,'+png.toString('base64');
}
// mean absolute RGB difference (0..255) and the share of pixels off by more than 24, over [x0,x1) of the width
const diff=(a,b,x0=0,x1=1)=>page.evaluate(async(a,b,x0,x1)=>{
  const load=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,c.width,c.height);};
  const A=await load(a),B=await load(b),w=Math.min(A.width,B.width),h=Math.min(A.height,B.height);
  let sum=0,off=0,n=0;const from=Math.floor(w*x0),to=Math.floor(w*x1);
  for(let y=0;y<h;y+=2)for(let x=from;x<to;x+=2){const i=(y*A.width+x)*4,j=(y*B.width+x)*4;const d=(Math.abs(A.data[i]-B.data[j])+Math.abs(A.data[i+1]-B.data[j+1])+Math.abs(A.data[i+2]-B.data[j+2]))/3;sum+=d;if(d>24)off++;n++;}
  return {mean:+(sum/n).toFixed(2),off:+(off/n).toFixed(4)};
},a,b,x0,x1);
async function shown(what,ms=300000){
  const t0=Date.now();
  for(;Date.now()-t0<ms;await wait(250)){const f=await film();if(f.shown){await wait(250);return Date.now()-t0;}if(f.state==='error')throw Error(what+': '+f.badge);}
  throw Error(`${what}: the film look not shown after ${ms/1000} s · ${JSON.stringify(await film())} · status: ${await statusOf(page)}`);
}
try{
  await openChapter(page,base,chapter);
  // ---- Live: the reference and its noise floor
  await modeTo('Live');await wait(1500);
  const L1=await frame('1-live'),noise=await (async()=>{await wait(1000);return diff(L1,await frame('1-live-b'));})();
  notes.noise=noise;
  // ---- Film look: says it is working at once, then shows a frame that is not Live's
  const t0=Date.now();await modeTo('Film look');await wait(800);
  const early=await film();
  check(early.badgeOn&&/^FILM LOOK · (rendering…|waits for)/.test(early.badge)||early.shown,`within a second of the press the badge says it is working: "${early.badge}" (${early.state})`);
  await shown('Film look');notes.filmMs=Date.now()-t0;console.log(`     (Film look shown ${(notes.filmMs/1000).toFixed(1)} s after the press)`);
  const F=await frame('2-film'),fl=await film(),dFL=await diff(F,L1);notes.film=fl;notes.filmVsLive=dFL;
  check(/^FILM LOOK · \d+\.\d\d s · [\d.]+ s$/.test(fl.badge),`shown, badge "${fl.badge}"`);
  check(dFL.mean>Math.max(2,noise.mean*4)&&dFL.off>Math.max(.02,noise.off*4),`Film look draws a different frame from Live: mean ${dFL.mean} / ${(dFL.off*100).toFixed(1)} % of pixels off (live noise ${noise.mean} / ${(noise.off*100).toFixed(1)} %)`);
  // ---- Split: the same still, live left, film right
  const renders=fl.renders;await modeTo('Split');await wait(600);
  const sp=await film();check(sp.shown&&sp.renders===renders,`Split keeps the film still it has (shown ${sp.shown}, renders ${renders} → ${sp.renders})`);
  check(sp.liveTag,'Split shows the LIVE tag on the live side');
  const S=await frame('3-split'),w=sp.wipe??.5;
  const left=await diff(S,L1,0,w-.04),right=await diff(S,F,w+.04,1),leftFilm=await diff(S,F,0,w-.04);
  notes.split={left,right,leftFilm};
  check(left.mean<=Math.max(2,noise.mean*2+1),`Split, left of the wipe = Live (mean ${left.mean})`);
  check(right.mean<=2,`Split, right of the wipe = Film look (mean ${right.mean})`);
  check(leftFilm.mean>Math.max(2,noise.mean*4),`Split's left half is not the film's (mean ${leftFilm.mean}): the two sides really differ`);
  // ---- Live again: the overlay off at once
  await modeTo('Live');await wait(300);
  const L3=await frame('4-live-again'),dL=await diff(L3,L1),lv=await film();
  check(!lv.shown&&!lv.badgeOn,'Live: no film overlay, no badge');
  check(dL.mean<=Math.max(2,noise.mean*2+1),`Live again draws Live's frame (mean ${dL.mean})`);
  // ---- a rest while busy: Film look pressed during a Render still waits for it, then shows (it used to give up)
  await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());await wait(150);
  await modeTo('Film look');await wait(900);
  const busy=await film();notes.busy=busy;
  check(busy.shown||/waits for|rendering/.test(busy.badge),`during a Render still the badge says what it waits for: "${busy.badge}"`);
  const after=await shown('Film look after a Render still');check(true,`then shows (${(after/1000).toFixed(1)} s)`);
  await page.evaluate(()=>{for(const b of document.querySelectorAll('.still-view .still-close'))b.click();});
  // ---- no poke storm while resting: the shown still stays
  const p0=(await film()).pokes;await wait(3000);const p1=await film();
  check(p1.shown&&p1.pokes-p0<=1,`resting 3 s: the film still stays (pokes ${p0} → ${p1.pokes})`);
}catch(error){failures.push(error.message);console.error('FAIL '+error.message);}
finally{
  notes.final=await film().catch(()=>null);notes.status=await statusOf(page).catch(()=>'');
  fs.writeFileSync(path.join(OUT,'modes.json'),JSON.stringify(notes,null,1));console.log('frames and modes.json in '+OUT);
  await close();
}
check(!errors.length,'no page / module ("not exported") errors'+(errors.length?': '+errors.join(' | '):''));
if(failures.length)console.error(JSON.stringify(notes,null,1));
assert.equal(failures.length,0,failures.join('; '));
console.log('Director Film look modes: Live, Film look and Split draw different frames (film '+notes.filmVsLive?.mean+' mean off Live), the badge says when it renders or waits.');
