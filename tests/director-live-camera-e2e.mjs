// Director live view = film frame, end to end (real GPU Chrome; not one of the quick tests/cinematic-* checks).
// For every film chapter page (<hq>/director-chapters.json) at 2-3 playhead times: the live stage camera's world
// matrix and projection against the film still renderer's (experience/film-render.mjs createStillRenderer, the
// renderer the 4K comes from) at the same time, plus a coarse image diff of the visible 16:9 frame against the still.
//
//   node tests/director-live-camera-e2e.mjs
//   HQ=exports/cinematic-intro-20261104-hq14 CHAPTERS=rise,2,hero OUT=/tmp/x BASE=http://127.0.0.1:3101 node tests/…
// Without BASE it serves this checkout itself (tools/studio-server.mjs on a free port, studio state in a temp copy).
// The browser never loads the studio sync / live-reload scripts. Needs the chapter pages and director-film/ of HQ
// (exports/ is untracked: skipped when they are missing). Run it under flock /tmp/claude-1000/hq12-stills.lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';

const OUT=process.env.OUT||path.join(os.tmpdir(),'director-live-camera');
const [W,H]=(process.env.SIZE||'1600x1000').split('x').map(Number);
const all=chapterList();
if(!all){console.log(`Director live camera e2e: skipped (${HQ}/director-chapters.json is not in this checkout).`);process.exit(0);}
fs.mkdirSync(OUT,{recursive:true});
const want=(process.env.CHAPTERS||'').split(',').filter(Boolean);
const chapters=all.filter(c=>!want.length||want.includes(c.id)||want.includes(String(c.n)));
// Tolerances: the live frame is the CSS 16:9 box rounded to whole pixels, so its aspect (projection [0]) may differ
// by a fraction of a percent; everything else must match the film.
const TOL={world:2e-3,fov:1e-3,proj5:1e-4,proj0:6e-3,corr:.6,shift:1};

// Playhead times: inside the longest move between story keys, inside a hold (else late in the chapter), and on a key.
function times(shot){
  const T=shot.seconds,k=[...shot.cameraPlan.keys].sort((a,b)=>a.at-b.at),out=[];
  const gap=k.map((x,i)=>i?[x.at-k[i-1].at,i]:[0,0]).sort((a,b)=>b[0]-a[0])[0][1];
  if(gap)out.push((k[gap-1].at+k[gap].at)/2+.123);
  const hold=k.find(x=>x.hold>.3&&x.at+x.hold<T);out.push(hold?hold.at+hold.hold*.6:T*.8+.071);
  const key=k.filter(x=>x.at>.5&&x.at<T-.5).sort((a,b)=>Math.abs(a.at-T*.4)-Math.abs(b.at-T*.4))[0];if(key)out.push(key.at);
  return [...new Set(out.map(t=>Math.round(Math.min(T-.05,Math.max(.05,t))*100)/100))].slice(0,3);
}

const {base,page,errors,close}=await openDirectorBrowser({width:W,height:H}),results=[];
try{
  const status=()=>statusOf(page);
  const camera=which=>page.evaluate(which=>{
    const f=which==='live'?document.getElementById('stage'):document.querySelector('iframe[title="Film still renderer"]');
    const {camera}=f.contentWindow.ErgoPresentation.three();camera.updateMatrixWorld(true);
    return {world:[...camera.matrixWorld.elements],proj:[...camera.projectionMatrix.elements],fov:camera.fov,aspect:camera.aspect,position:camera.position.toArray()};
  },which);
  // The visible live frame (the stage iframe's box) as Vico sees it, without the page's overlays on it (the frame's
  // buttons, the chapter's demo card, captions, the shade gradient): only the render is compared.
  async function liveShot(){
    await page.addStyleTag({content:'body.directing .film-tools,body.directing .light-tools,body.directing .title-overlay,body.directing .still-opener,body.directing #demo,body.directing main,body.directing footer,body.directing .shade{visibility:hidden!important}'}).then(h=>page.evaluate(()=>document.head.lastElementChild.id='e2e-hide'));
    const r=await page.$eval('#stage',e=>{const b=e.getBoundingClientRect();return {x:b.left,y:b.top,width:b.width,height:b.height};});
    const png=await page.screenshot({clip:r,encoding:'base64'});await page.evaluate(()=>document.getElementById('e2e-hide')?.remove());return 'data:image/png;base64,'+png;
  }
  // Coarse image diff at 128x72: mean |Δ| of the luminance (0-255; the live view has no film grade or quality, so
  // this stays well above 0), and the correlation of the edge images (gradient magnitude, insensitive to grading),
  // at zero shift and the shift (±8 px) where it peaks. Same framing: the peak sits at 0,0.
  const compare=(a,b)=>page.evaluate(async(a,b)=>{
    const W=128,H=72,lum=async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.drawImage(img,0,0,W,H);const d=g.getImageData(0,0,W,H).data,o=new Float64Array(W*H);for(let i=0;i<o.length;i++)o[i]=.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2];return o;};
    const edges=l=>{const o=new Float64Array(W*H);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)o[y*W+x]=Math.hypot(l[y*W+x+1]-l[y*W+x-1],l[(y+1)*W+x]-l[(y-1)*W+x]);return o;};
    const x=await lum(a),y=await lum(b),A=edges(x),B=edges(y);let mad=0;for(let i=0;i<x.length;i++)mad+=Math.abs(x[i]-y[i]);
    const corr=(dx,dy)=>{let n=0,sa=0,sb=0;const pts=[];for(let j=Math.max(0,dy);j<H+Math.min(0,dy);j++)for(let i=Math.max(0,dx);i<W+Math.min(0,dx);i++){const p=A[j*W+i],q=B[(j-dy)*W+i-dx];pts.push(p,q);sa+=p;sb+=q;n++;}
      const ma=sa/n,mb=sb/n;let xy=0,xx=0,yy=0;for(let k=0;k<pts.length;k+=2){const p=pts[k]-ma,q=pts[k+1]-mb;xy+=p*q;xx+=p*p;yy+=q*q;}return xy/Math.sqrt(xx*yy||1);};
    let best={corr:-2,dx:0,dy:0};for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){const c=corr(dx,dy);if(c>best.corr)best={corr:c,dx,dy};}
    return {mad:mad/x.length,corr:corr(0,0),shift:[best.dx,best.dy]};
  },a,b);
  for(const c of chapters){
    const film=JSON.parse(fs.readFileSync(path.join(root,c.shot.replace(/^\//,'')),'utf8'));
    await openChapter(page,base,c);
    for(const t of times(film)){
      await seek(page,t);await wait(1000);
      const live=await camera('live'),liveImg=await liveShot();
      const count=await page.$$eval('#film-still [data-still-index]',e=>e.length);
      await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
      await page.waitForFunction(n=>document.querySelectorAll('#film-still [data-still-index]').length>n||/Render still failed/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000},Math.min(count,11));
      const st=await status();assert.match(st,/Still rendered/,`${c.id} ${t}s: ${st}`);
      const still=await camera('still'),stillImg=await page.$eval('#film-still img.still-main',i=>i.src);
      await page.evaluate(()=>document.querySelector('#film-still [data-still-close]')?.click());
      const world=Math.max(...live.world.map((v,i)=>Math.abs(v-still.world[i]))),move=Math.hypot(...live.position.map((v,i)=>v-still.position[i]));
      const r={chapter:c.n,id:c.id,t,world,move,fov:Math.abs(live.fov-still.fov),proj5:Math.abs(live.proj[5]-still.proj[5]),proj0:Math.abs(live.proj[0]/still.proj[0]-1),aspect:[live.aspect,still.aspect],...await compare(liveImg,stillImg)};
      const tag=`ch${String(c.n).padStart(2,'0')}-${c.id}-${t.toFixed(2)}`;
      fs.writeFileSync(path.join(OUT,tag+'-live.png'),Buffer.from(liveImg.split(',')[1],'base64'));fs.writeFileSync(path.join(OUT,tag+'-still.jpg'),Buffer.from(stillImg.split(',')[1],'base64'));
      r.ok=r.world<TOL.world&&r.fov<TOL.fov&&r.proj5<TOL.proj5&&r.proj0<TOL.proj0&&r.corr>TOL.corr&&Math.max(...r.shift.map(Math.abs))<=TOL.shift;results.push(r);
      console.log(`${r.ok?'ok  ':'FAIL'} ch${c.n} ${c.id} ${t.toFixed(2)} s  world Δ ${r.world.toExponential(1)}  position Δ ${(r.move*1000).toFixed(2)} mm  fov Δ ${r.fov.toExponential(1)}  proj[5] Δ ${r.proj5.toExponential(1)}  aspect ${live.aspect.toFixed(4)}/${still.aspect.toFixed(4)}  image |Δ| ${r.mad.toFixed(1)}, edges corr ${r.corr.toFixed(3)} peak at ${r.shift.join(',')} px`);
    }
  }
}finally{await close();}
fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,1));
assert.deepEqual(errors,[],'module / page errors');
const bad=results.filter(r=>!r.ok);
assert.equal(bad.length,0,`live view differs from the film at ${bad.map(r=>`${r.id} ${r.t}s`).join(', ')}`);
console.log(`Director live camera: ${results.length} playhead times over ${chapters.length} chapters match the film renderer (camera matrices, projection, image). Frames in ${OUT}.`);
