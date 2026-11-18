// Prop fades drawn end to end (18 Nov 2026, Vico: "the prop fades integrated correctly in the UI end to end"): a Props bar's
// fade (Cut / Linear / Smooth, Fast 0.2 / Medium 0.5 / Slow 1 s) set in the Director's inspector fades the object
//   1. on the live stage (its materials' opacity, as film-edits.mjs showFactor says),
//   2. in the Director's Render still (the real button: Shift+R; film quality on),
//   3. in render-still.cjs, the film renderer's still path (render-cut.cjs's grab: film-fx frame -> film-edits apply),
//      given the exact shots the Director's still rendered,
// measured in pixels: the same moment rendered with the prop whole (F), gone (G) and mid-fade (A); how much of it is
// left = 1 - |A-F| / |G-F| over the pixels where G and F differ, inside the prop's box on screen (linear light).
// The create chapter of the Cinematographer's cut: a film item the stage has once, in view at some moment t*.
//   CHROME=".../chrome.exe" SHOTS=<dir> node tests/director-prop-fades-render-e2e.mjs        (run under the GPU lock)
//   SEED=<storage seed json> also passes --storage to render-still (absent: none; the measure is relative, so either works)
//   FADE_KINDS=room,desk (default room): the kinds of prop timed, each its own item and moment: room = a prop of the room
//   (a film item or a room asset on the Props lane the whole chapter), desk = one on the featured desk (it rides the desk:
//   Desk dressing / Accessory mount). Every check is reported (one run reports every path); a still that does not fade is
//   diagnosed: what the prop's meshes wear when the still is drawn, and the same shots with film quality on and off.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';

const CUT='exports/cinematic-intro-cut-cine';
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(c=>c.id==='create');
const T=chapter.seconds;
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'prop-fades-render-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser({width:1600,height:1000});
// (every check is reported and the run goes on to the next path; the run fails at the end if any did. need: a precondition)
const passed=[],failed=[],check=(ok,what)=>{(ok?passed:failed).push(what);console.log((ok?'  ok: ':'  FAIL: ')+what);},need=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('  ok: '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(200);}};
// what film-edits.mjs showFactor gives (the e2e's own copy of the rule: linear, or smoothstep for ease 'smooth')
const factor=(show,t)=>{if(!show)return 1;if(t<show.from-1e-6||t>show.to+1e-6)return 0;let f=1;if(show.fadeIn>0)f=Math.min(f,(t-show.from)/show.fadeIn);if(show.fadeOut>0)f=Math.min(f,(show.to-t)/show.fadeOut);f=Math.max(0,Math.min(1,f));return show.ease==='smooth'?f*f*(3-2*f):f;};

// ---- page helpers (the Props editor's draft, its bars, the stage object)
// (by the bar's prop key, prop-edits.mjs propKey: [match, asset, path, near, desk?]: a film item can share its match with others)
const edit=key=>page.evaluate(key=>{const want=JSON.parse(key),same=e=>JSON.stringify([e.match||'',e.asset||'',e.path||'',e.near||null])===JSON.stringify(want.slice(0,4));const cuts=[];try{for(const d of Object.values(JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}')))if(d?.cut)cuts.push(d.cut);}catch{}try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1')||'null');if(v)cuts.push(v.drafts?.[v.active]||v.cuts.find(c=>c.id===v.active));}catch{}
  // (the exact key, else the one edit of that match: in case the Director writes it without the film's path)
  for(const cut of cuts)for(const s of cut?.shots||[]){const list=s.propEdits||[],hit=list.find(same)||(list.filter(e=>e.match===want[0]).length===1?list.find(e=>e.match===want[0]):null);if(hit)return hit;}return null;},key);
const clickBar=key=>page.evaluate(k=>{const b=[...document.querySelectorAll('#director-timeline .prop-bar')].find(b=>b.dataset.propKey===k);if(!b)return false;b.scrollIntoView({block:'nearest'});b.click();return true;},key);
const setField=(n,v)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)return false;el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));return true;},n,v);
const press=a=>page.evaluate(a=>{const b=document.querySelector(`#director-panel [data-action="${a}"]`);if(!b||b.disabled)return false;b.click();return true;},a);
const specOf=key=>{const k=JSON.parse(key);return {match:k[0],...(k[1]?{asset:k[1]}:{}),...(k[2]?{path:k[2]}:{}),...(k[3]?{near:k[3]}:{})};};
const opacity=key=>page.evaluate(spec=>{const w=document.getElementById('stage').contentWindow,E=w.__filmEdits;let list=[];try{list=E?.editTargets?E.editTargets(spec):[];}catch{}
  // (v: the faintest of its meshes' materials, hi: the brightest, the film's own screen picture under a monitor included)
  const o=list[0];if(!o)return null;let v=1,hi=0,vis=true;for(let p=o;p;p=p.parent)if(!p.visible)vis=false;o.traverse(m=>{for(const mat of [].concat(m.material||[])){v=Math.min(v,mat.opacity);hi=Math.max(hi,mat.opacity);}});return {v,hi,vis};},specOf(key));
// every whole-chapter film item the stage has exactly once, and its box on a 16:9 frame of the stage camera now
const inView=()=>page.evaluate(async()=>{const w=document.getElementById('stage').contentWindow,E=w.__filmEdits,{camera}=w.ErgoPresentation.three(),THREE=await w.eval('import("three")');
  const cam=camera.clone();cam.aspect=16/9;cam.updateProjectionMatrix();cam.updateMatrixWorld(true);const out=[];
  for(const b of document.querySelectorAll('#director-timeline .prop-bar')){let k;try{k=JSON.parse(b.dataset.propKey);}catch{continue;}
    if(parseFloat(b.style.left)>.5||parseFloat(b.style.width)<99||!k[0])continue;const spec={match:k[0],...(k[1]?{asset:k[1]}:{}),...(k[2]?{path:k[2]}:{}),...(k[3]?{near:k[3]}:{})};
    let n=[];try{n=E.editTargets(spec);}catch{}if(n.length!==1)continue;
    let vis=true;for(let p=n[0];p;p=p.parent)if(!p.visible)vis=false;if(!vis)continue;
    const box=new THREE.Box3().setFromObject(n[0]);if(box.isEmpty())continue;let x0=1,y0=1,x1=-1,y1=-1,behind=false;
    for(const c of [0,1,2,3,4,5,6,7]){const v=new THREE.Vector3(c&1?box.max.x:box.min.x,c&2?box.max.y:box.min.y,c&4?box.max.z:box.min.z).project(cam);if(v.z>1||v.z<-1)behind=true;x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
    if(behind)continue;const cx0=Math.max(-1,x0),cx1=Math.min(1,x1),cy0=Math.max(-1,y0),cy1=Math.min(1,y1);if(cx1<=cx0||cy1<=cy0)continue;
    const area=(cx1-cx0)*(cy1-cy0)/4,whole=(x1-x0)*(y1-y0)/4;
    const DESK=/(^|> )(Desk dressing|Accessory mount|Accessory:)/;let desk=DESK.test(k[2]||'');for(let p=n[0];p;p=p.parent)if(DESK.test(p.name||''))desk=true;
    out.push({key:b.dataset.propKey,match:k[0],name:b.textContent.trim(),kind:desk?'desk':'room',propId:n[0].userData.propId||n[0].userData.decorUpgrade||'',area,inside:area/whole,box:{x0:(cx0+1)/2,x1:(cx1+1)/2,y0:(1-cy1)/2,y1:(1-cy0)/2}});}
  return out;});
// how much of the prop is left in A, from F (whole) and G (gone): linear light, the pixels of its box where F and G differ
const measure=(A,F,G,box)=>page.evaluate(async(A,F,G,box)=>{
  const load=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,c.width,c.height);};
  const [a,f,g]=await Promise.all([A,F,G].map(load)),W=f.width,H=f.height,lin=new Float32Array(256).map((_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  const pad=.02,X0=Math.max(0,Math.floor((box.x0-pad)*W)),X1=Math.min(W,Math.ceil((box.x1+pad)*W)),Y0=Math.max(0,Math.floor((box.y0-pad)*H)),Y1=Math.min(H,Math.ceil((box.y1+pad)*H));
  let num=0,den=0,n=0,peak=0;const d=[];
  for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){const i=(y*W+x)*4;let dg=0,da=0;for(let c=0;c<3;c++){dg+=Math.abs(lin[g.data[i+c]]-lin[f.data[i+c]]);da+=Math.abs(lin[a.data[i+c]]-lin[f.data[i+c]]);}d.push([dg,da]);if(dg>peak)peak=dg;}
  const thr=Math.max(.03,peak*.2);for(const [dg,da] of d)if(dg>thr){num+=da;den+=dg;n++;}
  return {left:den?1-num/den:NaN,px:n,size:[W,H]};
},A,F,G,box);
// the Director's Render still (Shift+R) at the playhead: its image. (The status line is cleared first and the still is
// done when it says "Still rendered" again: two stills of the same pixels, e.g. a cut before it leaves and the whole time,
// are the same data URL, and the strip keeps 12 thumbnails captioned to the minute, so neither tells a new still.)
async function still(){
  // (the panel's and the timeline's status lines both carry it; a panel re-render shows its default hint, never "Still rendered")
  const said=()=>page.evaluate(()=>['#director-panel [data-status]','#director-timeline [data-timeline-status]'].map(q=>document.querySelector(q)?.textContent||'').join(' | '));
  await page.evaluate(()=>{document.activeElement?.blur();for(const q of ['#director-panel [data-status]','#director-timeline [data-timeline-status]']){const s=document.querySelector(q);if(s)s.textContent='(e2e: waiting for the still)';}});
  await page.keyboard.down('Shift');await page.keyboard.press('KeyR');await page.keyboard.up('Shift');
  await until(async()=>/Still rendered/.test(await said()),'Render still',300000);
  return page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);
}
const SPEED={fast:.2,medium:.5,slow:1},report={};
async function runItem(best){
  const ts=best.t,M=best.key,K=best.kind,rows={},jobs=[];
  await page.evaluate(spec=>{const w=[...document.querySelectorAll('iframe')].find(x=>x.title==='Film still renderer').contentWindow;w.__probeSpec=spec;},specOf(M));
  await until(()=>clickBar(best.key),'its bar');await until(()=>page.$('#director-panel [name="pp-t-to"]'),'the inspector\'s On screen fields');
  // the variants: F whole, G gone, then the fades (to: where it leaves; ts is the moment measured)
  const V=[
    {id:'G',label:'gone (left at ts-1, a cut)',to:ts-1},
    {id:'F',label:'whole (the whole time)',whole:true},
    {id:'cut',label:'Cut, leaves 0.3 s after',to:ts+.3,curve:'cut'},
    {id:'lin-med',label:'Linear Medium, at its midpoint',to:ts+.25,curve:'linear',speed:'medium'},
    {id:'lin-slow',label:'Linear Slow, a quarter in',to:ts+.75,curve:'linear',speed:'slow'},
    {id:'smooth-slow',label:'Smooth Slow, a quarter in',to:ts+.75,curve:'smooth',speed:'slow'},
    {id:'smooth-fast',label:'Smooth Fast, a quarter in',to:ts+.15,curve:'smooth',speed:'fast'},
  ];
  for(const v of V){
    // back to the whole time, then its leaving time, curve and speed through the inspector
    await clickBar(best.key);await until(()=>page.$('#director-panel [name="pp-t-to"]'),'the inspector');
    if((await edit(M))?.show){await until(()=>press('pp-t-all'),'Whole time');await until(async()=>!(await edit(M))?.show,'the whole time again');}
    if(!v.whole){
      await setField('pp-t-to',Math.round(v.to*100)/100);await until(async()=>Math.abs(((await edit(M))?.show?.to??-9)-v.to)<.011,'leaves at '+v.to);
      if(v.curve&&v.curve!=='cut'){await setField('pp-t-curve',v.curve);await until(async()=>{const s=(await edit(M))?.show;return s&&(v.curve==='smooth'?s.ease==='smooth':!s.ease&&s.fadeOut>0);},'curve '+v.curve);}
      if(v.speed){await press('pp-t-'+v.speed);await until(async()=>(await edit(M))?.show?.fadeOut===SPEED[v.speed],'speed '+v.speed);}
    }
    const show=(await edit(M))?.show||null,want=factor(show,ts);
    if(v.curve)check(v.curve==='cut'?!show.fadeOut:show.fadeOut===SPEED[v.speed]&&(v.curve==='smooth')===(show.ease==='smooth'),`${K}: ${v.label}: written ${JSON.stringify(show)}`);
    // (1) the live stage
    await page.evaluate(()=>document.querySelector('#director-panel [data-action="pp-clear"]')?.click());
    await seek(page,ts);await wait(900);const live=await until(()=>opacity(M),'it on the stage');
    // (2) the Director's still, and the exact shot it rendered (kept from its film-fx install / update)
    await page.evaluate(()=>{window.__stillJob=null;});const url=await still();
    const job=await page.evaluate(()=>window.__stillJob||null);assert.ok(job,`${K} ${v.id}: the still renderer took the new shot`);
    const probe=await page.evaluate(()=>{const w=[...document.querySelectorAll('iframe')].find(x=>x.title==='Film still renderer').contentWindow,l=w.__probeLog;w.__probeLog=null;return l;});
    jobs.push({id:v.id,job:JSON.parse(job)});rows[v.id]={...v,show,want,live,url,probe};
    fs.writeFileSync(path.join(shots,`${K}-still-${v.id}.jpg`),Buffer.from(url.split(',')[1],'base64'));
    console.log(`  ${K} ${v.id}: wants ${want.toFixed(3)} at ${ts} s · live opacity ${live.v.toFixed(3)} ${live.vis?'drawn':'not drawn'} · in the still's draw: ${JSON.stringify(probe)}`);
  }
  // (1) live: the materials' opacity is the rule's (as a share of its whole opacity: some materials are see-through as built; 0 = not drawn)
  // (every mesh: the faintest and the brightest both follow the rule, so a part the fade skips, e.g. a screen picture, shows)
  for(const r of Object.values(rows)){const v=r.live.v/rows.F.live.v,hi=r.live.hi/rows.F.live.hi;check(r.want===0?!r.live.vis:r.live.vis&&Math.abs(v-r.want)<.02&&Math.abs(hi-r.want)<.02,`${K}: live stage, ${r.label}: opacity ${r.live.vis?`${v.toFixed(3)} (faintest) / ${hi.toFixed(3)} (brightest)`:'not drawn'} of its own (rule ${r.want.toFixed(3)})`);}
  // (2) the Director's stills, in pixels
  const left={};
  for(const r of Object.values(rows)){if(r.id==='F'||r.id==='G')continue;const m=await measure(r.url,rows.F.url,rows.G.url,best.box);left[r.id]={still:m.left,px:m.px};}
  for(const [id,m] of Object.entries(left))check(m.px>150&&Math.abs(m.still-rows[id].want)<.12,`${K}: Director still, ${rows[id].label}: ${(m.still*100).toFixed(0)} % of it left over ${m.px} px (rule ${(rows[id].want*100).toFixed(0)} %)`);
  check(left['lin-med'].still<left['lin-slow'].still&&left['lin-slow'].still<left['smooth-slow'].still+.03,`${K}: the stills order like the curves: linear midpoint < linear quarter <= smooth quarter`);
  // (2b) diagnosis: the same shots through a still renderer of the test's own (film-render.mjs, the button's code), with
  // film quality on (as the button) and off (quality:null): which one fades
  try{const byId=Object.fromEntries(jobs.map(j=>[j.id,j.job])),at=ts/byId.F.seconds;
    const urls=await page.evaluate(async(byId,at)=>{const {createStillRenderer}=await import('/experience/film-render.mjs'),r=createStillRenderer(),out={};
      try{for(const q of ['on','off'])for(const id of ['F','G','lin-med','smooth-slow']){const j=structuredClone(byId[id]);if(q==='off')j.quality=null;out[q+':'+id]=await r.render(j,at);}}finally{r.dispose();}return out;},byId,at);
    for(const q of ['on','off'])for(const id of ['lin-med','smooth-slow']){const m=await measure(urls[q+':'+id],urls[q+':F'],urls[q+':G'],best.box);left[id]['quality '+q]=m.left;
      fs.writeFileSync(path.join(shots,`${K}-own-${q}-${id}.jpg`),Buffer.from(urls[q+':'+id].split(',')[1],'base64'));
      console.log(`  ${K} diagnosis: film quality ${q}, ${rows[id].label}: ${(m.left*100).toFixed(0)} % left over ${m.px} px (rule ${(rows[id].want*100).toFixed(0)} %)`);}}
  catch(error){console.log(`  ${K} diagnosis could not run: ${error.message}`);}
  const save=()=>{report[K]={item:best.name,match:M,t:ts,box:best.box,rows:Object.fromEntries(Object.entries(rows).map(([k,r])=>[k,{show:r.show,want:r.want,live:r.live,left:left[k],probe:r.probe}]))};fs.writeFileSync(path.join(shots,'fades.json'),JSON.stringify(report,null,1));};
  save();
  // (3) render-still.cjs on the stills' own shots, same moment, 1280x720
  const cutFile=path.join(shots,K+'-fades-cut.json'),out=path.join(shots,K+'-render-still');fs.mkdirSync(out,{recursive:true});
  const order=jobs.map(j=>j.id);fs.writeFileSync(cutFile,JSON.stringify({schema:'ergoflex.client-cut',version:1,id:'prop-fades-render',name:'prop fades',shots:jobs.map(j=>j.job)}));
  const at=String(ts/jobs[0].job.seconds);
  const args=[path.join(root,'tools/experience/render-still.cjs'),'--cut',cutFile,'--shots','all','--at',at,'--size','1280x720','--ss','1','--out',out,'--server',base,...(process.env.SEED?['--storage',process.env.SEED]:[])];
  console.log(`  ${K} render-still: ${order.join(', ')} at ${ts} s`);
  try{execFileSync(process.execPath,args,{stdio:'inherit',env:{...process.env,CHROME_PATH:process.env.CHROME_PATH||process.env.CHROME||''},timeout:1800000});}
  catch(error){check(false,`${K}: render-still.cjs ran (${String(error.message).split('\n')[0]})`);}
  const png=i=>{const f=fs.readdirSync(out).find(n=>n.startsWith(String(i+1).padStart(2,'0')+'-still-1280x720-'));return f?'data:image/png;base64,'+fs.readFileSync(path.join(out,f)).toString('base64'):null;};
  const R=Object.fromEntries(order.map((id,i)=>[id,png(i)]));
  if(order.some(id=>!R[id])){check(false,`${K}: render-still wrote every shot (missing: ${order.filter(id=>!R[id]).join(', ')})`);save();}
  else for(const id of order){if(id==='F'||id==='G')continue;const m=await measure(R[id],R.F,R.G,best.box);left[id].film=m.left;
    check(m.px>150&&Math.abs(m.left-rows[id].want)<.12&&Math.abs(m.left-left[id].still)<.06,`${K}: render-still, ${rows[id].label}: ${(m.left*100).toFixed(0)} % left over ${m.px} px (rule ${(rows[id].want*100).toFixed(0)} %, Director still ${(left[id].still*100).toFixed(0)} %)`);}
  save();
  // leave it as the film had it
  await clickBar(best.key);if((await edit(M))?.show){await press('pp-t-all');await until(async()=>!(await edit(M))?.show,'the whole time again');}
}

try{
  await openChapter(page,base,chapter);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab="props"]')?.click());
  await page.evaluate(()=>{for(const b of document.querySelectorAll('#director-timeline [data-action="titles"][aria-pressed="true"]'))b.click();});   // (film titles off: the stills are the 3D frame)
  // ---- per kind: whole-chapter film items of that kind in view (each at the moment it is biggest), biggest first
  const kinds=(process.env.FADE_KINDS||'room').split(',').map(k=>k.trim()).filter(Boolean),cands={};
  for(let t=2;t<=T-2;t+=2){await seek(page,t);await wait(900);for(const c of await inView()){if(!kinds.includes(c.kind)||!(c.inside>.8&&c.area>(c.kind==='desk'?.001:.004)&&c.area<.5))continue;
    const list=cands[c.kind]||=[],had=list.find(x=>x.key===c.key);if(!had)list.push({...c,t});else if(c.area>had.area)Object.assign(had,{...c,t});}}
  for(const k of kinds){(cands[k]||[]).sort((a,b)=>b.area-a.area);cands[k]=(cands[k]||[]).slice(0,6);need(cands[k].length>0,`${k}: whole-chapter film items in view: ${cands[k].map(c=>`${c.name} [${c.propId}] at ${c.t} s (${(c.area*100).toFixed(2)} %)`).join('; ')}`);}
  // the first still boots the still stage; from then on every still's shot is kept
  await seek(page,cands[kinds[0]][0].t);await wait(600);await still();
  await page.evaluate(async()=>{const f=[...document.querySelectorAll('iframe')].find(x=>x.title==='Film still renderer'),w=f.contentWindow,m=w.__filmFx;
    const keep=fn=>async s=>{window.__stillJob=JSON.stringify(s);return fn(s);};w.__filmFx={...m,install:keep(m.install),update:keep(m.update)};
    // the probe: what the timed prop's meshes wear at the moment the still is drawn (the canvas render, not a pass into a target)
    const E=await w.eval("import('/tools/experience/film-edits.mjs')"),r=w.ErgoFlex.renderer,prev=r.render;
    r.render=function(sc,cam){if(w.__probeSpec&&this.getRenderTarget()===null){try{const list=E.editTargets(w.__probeSpec),o=list[0],out={targets:list.length,chain:true,meshes:0,copies:0,minOpacity:1,opaque:0,hidden:0,kinds:{}};
      if(o){for(let p=o;p;p=p.parent)if(!p.visible)out.chain=false;o.traverse(x=>{if(!x.isMesh)return;out.meshes++;if(!x.visible)out.hidden++;for(const mm of [].concat(x.material||[])){if(mm.userData?.filmFxCopy)out.copies++;out.minOpacity=Math.min(out.minOpacity,mm.opacity);if(!mm.transparent)out.opaque++;out.kinds[mm.type]=(out.kinds[mm.type]||0)+1;}});}
      w.__probeLog=out;}catch(e){w.__probeLog={error:String(e)};}}return prev.call(this,sc,cam);};});
  // the item the still stage really draws: the first candidate whose meshes are all shown in the still's own draw
  // (a still / live disagreement on one is reported, not timed: e.g. a room chair the people code puts away in one stage only)
  const best={};report.mismatches=[];
  for(const k of kinds)for(const c of cands[k]){
    await seek(page,c.t);await wait(700);const live=await opacity(c.key);
    await page.evaluate(spec=>{const w=[...document.querySelectorAll('iframe')].find(x=>x.title==='Film still renderer').contentWindow;w.__probeSpec=spec;w.__probeLog=null;},specOf(c.key));
    await still();const probe=await page.evaluate(()=>{const w=[...document.querySelectorAll('iframe')].find(x=>x.title==='Film still renderer').contentWindow,l=w.__probeLog;w.__probeLog=null;return l;});
    if(probe?.targets===1&&probe.chain&&probe.meshes>0&&!probe.hidden){best[k]=c;console.log(`  ${k}: timing ${c.name} [${c.propId}] at ${c.t} s (drawn in the still: ${JSON.stringify(probe)})`);break;}
    const note={kind:k,name:c.name,propId:c.propId,key:c.key,t:c.t,live,still:probe};report.mismatches.push(note);fs.writeFileSync(path.join(shots,'fades.json'),JSON.stringify(report,null,1));
    console.log(`  ${k}: NOT timed: ${c.name} [${c.propId}] at ${c.t} s is ${live?.vis?'drawn':'not drawn'} live but in the still's draw ${JSON.stringify(probe)}`);
  }
  for(const k of kinds)need(!!best[k],`${k}: an item the still stage draws (${report.mismatches.filter(m=>m.kind===k).length} skipped: see fades.json mismatches)`);
  for(const m of report.mismatches)if(m.live?.vis)console.log(`  NOTE still vs live: ${m.name} [${m.propId}] at ${m.t} s is drawn live and hidden in the Director's still`);
  for(const k of kinds)await runItem(best[k]);
  check(!errors.length,'no page errors: '+errors.join(' | '));
  if(failed.length)throw Error(`${failed.length} check(s) failed:\n  - `+failed.join('\n  - '));
  console.log(`PASS director prop fades rendered (${passed.length} checks, ${kinds.join(' + ')}) · stills and numbers: ${shots}`);
}catch(error){console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));process.exitCode=1;}
finally{await close();}
