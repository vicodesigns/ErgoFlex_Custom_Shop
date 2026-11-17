// Vico's room-desk workflow, end to end (Nov 15: "I have a bunch of desks I want to move around and some hide or remove from
// that scene. When I moved them a bunch of glitching happened."). Real Chrome on the harness's scratch server, a film chapter
// of a cut (default: a scratch copy of "Vicos 2nd cut", the high school chapter, with Vico's own unexported draft seeded from
// a COPY of the studio state). One PASS / FAIL line per check, with the reason, and the per-frame sampler's findings.
//  1. move 8+ room desks in a row: round handle, gumball arrow, turn ring (cycled), the desks that were moved as props first
//  2. hide 4 desks, show 2 again, hide the one with a sitter, hide while people move (playback running)
//  3. Undo / Redo after each move and each hide / show
//  4. Desks -> Props -> People -> Desks between edits
//  5. play the chapter from 0 and scrub, desks hidden and moved
//  6. reload the chapter: the edits come back, nothing jumps or reappears
//  7. Export cut (no download) + a dry-run import into a scratch copy of the cut dir: hides and poses in review-cut.json,
//     the people cast intact
//  8. a sampler in the stage records every room desk group (x, z, yaw, drawn, group uuid) and every person (where, shown,
//     posture) EVERY animation frame of every step. Per step it flags: a desk drawn at the room's own place while its edit
//     has it elsewhere; a hidden desk drawn; a desk that moves / shows / hides / is rebuilt when the step did not touch it;
//     a person who pops (shown <-> hidden), jumps (> 150 mm in one frame) or changes posture (stands up) when nothing about
//     them changed. After each step the stage must match the chapter's desk edits (2 mm, 0.2 deg).
// Run (Windows, from the worktree; the scratch cut is made by tools/experience/film-cuts.py duplicate, or by hand):
//   CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" STATE_FROM=C:/work/studio-state-rev3478.json \
//   DRAFT_FROM=C:/work/desk-proof-data/studio-state-live-copy.json CHAPTER=oilers node tests/director-desk-workflow-e2e.mjs [shots dir]
//   CHAPTER=wellness (or commons): the same steps on that room (no draft of Vico's: the film's own desks).
//   CUT=exports/<cut dir> (default exports/cinematic-intro-cut-vicos-2nd-cut, else exports/cinematic-intro-cut-cine).
// The GPU lock is only for queue render jobs; this test runs without it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,wait,openDirectorBrowser,openChapter} from './director-e2e-harness.mjs';

const CHAPTER=process.env.CHAPTER||'oilers',shots=process.argv[2]||null;
const CUT=process.env.CUT||(fs.existsSync(path.join(root,'exports/cinematic-intro-cut-vicos-2nd-cut/director-chapters.json'))?'exports/cinematic-intro-cut-vicos-2nd-cut':'exports/cinematic-intro-cut-cine');
const H0=path.join(root,CUT),chapter=JSON.parse(fs.readFileSync(path.join(H0,'director-chapters.json'),'utf8')).chapters.find(c=>c.id===CHAPTER);
if(!chapter)throw Error(`${CUT} has no chapter ${CHAPTER}`);
const html0=fs.readFileSync(path.join(root,chapter.page.replace(/^\//,'')),'utf8'),b64=html0.match(/#cut=([A-Za-z0-9_-]+)/)[1],pageCut=JSON.parse(Buffer.from(b64,'base64url').toString());
const PROJECT=pageCut.id,SECONDS=Number(pageCut.shots[0].seconds)||12;
// Vico's unexported draft of this chapter (read from a COPY of the studio state; never his files)
let DRAFT=null;
if(process.env.DRAFT_FROM){try{const s=JSON.parse(fs.readFileSync(process.env.DRAFT_FROM,'utf8')),v=s.keys?.['ergoflex.director.filmDrafts.v1']?.value,all=v?JSON.parse(v):{};DRAFT=all[PROJECT]||null;}catch(e){console.log('draft not read:',e.message);}}

const results=[],fails=[],findings=[];
const check=(ok,what)=>{const line=`${ok?'PASS':'FAIL'} ${what}`;console.log(line);results.push(line);if(!ok)fails.push(what);return ok;};
const note=t=>{console.log('     '+t);results.push('     '+t);};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};

const {base,page,errors,close}=await openDirectorBrowser();
let tmpCut=null;
try{
  await page.evaluateOnNewDocument((draft,project)=>{
    if(window!==window.top)return;
    // Vico's draft goes in once (the first load); a reload keeps whatever the Director wrote since
    if(draft&&!localStorage.getItem('deskproof.seeded')){const k='ergoflex.director.filmDrafts.v1';let all={};try{all=JSON.parse(localStorage.getItem(k)||'{}')||{};}catch{}all[project]=draft;localStorage.setItem(k,JSON.stringify(all));localStorage.setItem('deskproof.seeded','1');}
    const W=()=>document.getElementById('stage').contentWindow;
    window.__t=()=>{const w=W(),t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,desks:w.ErgoFlex.sceneDesks};};
    window.__drawn=g=>{if(!g)return false;for(let p=g;p;p=p.parent)if(!p.visible)return false;return true;};
    window.__all=()=>{const {desks,w}=__t(),out={desks:{},people:{}};for(const [id,r] of desks.records){const g=r.group;out.desks[id]={x:g?Math.round(g.position.x*10)/10:null,z:g?Math.round(g.position.z*10)/10:null,yaw:g?Math.round(g.rotation.y*180/Math.PI*100)/100:null,vis:__drawn(g),uuid:g?.uuid,size:r.state.size,name:r.state.name,featured:id===desks.selected,pose:r.state.pose&&{...r.state.pose},was:r.deskEditWas?.state?.pose?{...r.deskEditWas.state.pose}:null};}
      for(const p of w.ErgoFlex?.workspaceRoom?.people?.list?.()||[]){const o=out.people[p.key];if(!o||(!o.visible&&p.visible))out.people[p.key]={...p};}return out;};
    window.__draftShot=()=>{try{const all=JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}');return all[project]?.cut?.shots?.[0]||null;}catch{return null;}};
    window.__screen=v=>{const {t}=__t(),p=v.clone().project(t.camera),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect();return {x:f.left+c.left+(p.x+1)/2*c.width,y:f.top+c.top+(1-p.y)/2*c.height,z:p.z};};
    window.__frame=id=>{const {t,T,desks}=__t(),r=desks.records.get(id),b=new T.Box3().setFromObject(r.group),c=b.getCenter(new T.Vector3());const look=c.clone().setY(c.y+.9);t.camera.position.set(c.x+.6,c.y+3.6,c.z+4.2);t.controls.target.copy(look);t.camera.lookAt(look);t.controls.update();};
    window.__tools=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});return g;};
    window.__handle=()=>{const {T}=__t(),g=__tools();if(!g?.visible)return null;let d=null;g.traverse(o=>{if(!d&&o.isMesh&&o.geometry?.type==='CircleGeometry'&&Math.abs((o.geometry.parameters?.radius||0)-.16)<1e-6)d=o;});return d?__screen(d.getWorldPosition(new T.Vector3())):null;};
    window.__knob=()=>{const {T}=__t(),g=__tools();if(!g?.visible)return null;const turn=g.children.filter(o=>o.isGroup)[1];return __screen(turn.children[2].getWorldPosition(new T.Vector3()));};
    window.__gum=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.showY===false&&o.userData.directorTools)g=o;});return g;};
    window.__arrow=axis=>{const {t,T}=__t(),g=__gum();if(!g?.object||!g.visible)return null;const at=g.object.getWorldPosition(new T.Vector3());
      const factor=at.distanceTo(t.camera.position)*Math.min(1.9*Math.tan(Math.PI*t.camera.fov/360)/t.camera.zoom,7)*g.size/4;
      const dir=new T.Vector3(axis==='X'?1:0,0,axis==='Z'?1:0).transformDirection(g.object.matrixWorld);return {o:__screen(at),a:__screen(at.clone().addScaledVector(dir,.42*factor))};};
    // the per-frame sampler (stage window): every room desk and every person, sampled AS EACH FRAME IS DRAWN (the stage
    // renderer's render() of the room's scene is wrapped: one sample per drawn frame, so a held frame is not a sample and a
    // state that is never drawn is never flagged). dp.mark names the phase of the step (act / settle).
    window.__sampler=()=>{const w=W(),t=w.ErgoPresentation?.three?.(),R=t?.renderer;if(window.__HOMES)w.__homes=window.__HOMES;if(!R||R.__dp)return;const dp=w.__dp={frames:[],mark:''};R.__dp=true;
      const orig=R.render;let last=-1;
      const capture=()=>{const d=w.ErgoFlex?.sceneDesks;if(!d)return;const f={n:R.info?.render?.frame??-1,m:dp.mark,d:{},p:{}};
        for(const [id,r] of d.records){const g=r.group;if(g)g.updateMatrixWorld?.();f.d[id]=g?[Math.round(g.position.x),Math.round(g.position.z),Math.round(g.rotation.y*1800/Math.PI)/10,__drawn(g)?1:0,g.uuid.slice(0,8),r.state.size]:null;}
        for(const p of w.ErgoFlex?.workspaceRoom?.people?.list?.()||[]){if(!p.visible&&f.p[p.key])continue;f.p[p.key]=[p.at[0],p.at[1],p.y,p.visible?1:0,p.variant||p.id];}
        if(dp.frames.length<20000)dp.frames.push(f);};
      // who puts a desk back at its home while it stands elsewhere (w.__homes: set by the test): the stack, for the report
      const d0=w.ErgoFlex?.sceneDesks;dp.places=[];if(d0&&!d0.__dpPlace){d0.__dpPlace=true;const place=d0.place.bind(d0);d0.place=function(r){try{const h=w.__homes?.[r?.id],g=r?.group;if(h&&g&&Math.hypot(r.state.pose.x-h.x,r.state.pose.z-h.z)<100&&Math.hypot(g.position.x-h.x,g.position.z-h.z)>100)dp.places.push(`${r.id} (${dp.mark}) from ${Math.round(g.position.x)},${Math.round(g.position.z)}: ${new Error().stack.split('\n').slice(2,8).map(x=>x.trim().replace(/https?:\/\/[^/]+/,'').replace(/\?v=[^:]*/,'')).join(' < ')}`);}catch{}return place(r);};}
      // (playback can draw through another path: while the mark is 'playing', every animation frame is a sample too)
      const raf=()=>{try{if(/playing/.test(dp.mark)&&w.performance.now()-last>12){last=w.performance.now();capture();}}catch{}w.requestAnimationFrame(raf);};w.requestAnimationFrame(raf);
      R.render=function(scene,camera){try{const now=w.performance.now();if(scene===w.ErgoPresentation.three().scene&&now-last>4){last=now;capture();}}catch{}return orig.call(this,scene,camera);};};
    window.__mark=m=>{const w=W();if(w.__dp)w.__dp.mark=m;};
    window.__take=()=>{const w=W();const f=w.__dp?.frames||[];if(w.__dp)w.__dp.frames=[];return f;};
    window.__places=()=>{const w=W();const p=w.__dp?.places||[];if(w.__dp)w.__dp.places=[];return p;};
  },DRAFT,PROJECT);

  const panelClick=sel=>page.evaluate(s=>{const b=document.querySelector(s);if(!b||b.disabled)return false;b.click();return true;},sel);
  // the chapter transport (Play chapter / Space): playing while its button shows the pause glyph
  const playing=()=>page.evaluate(()=>/❚❚|Pause/i.test(document.querySelector('#director-timeline [data-action="chapter-toggle"]')?.textContent||''));
  const seek=async s=>{await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},s);await wait(700);};
  // the film layers applied again at the same chapter time (a seek away and back: nothing in the film itself moves between them)
  const settle=async()=>{await wait(500);await seek(1.05);await wait(700);await seek(1);await wait(1100);};
  const all=()=>page.evaluate(()=>__all());
  const tab=async t=>{await panelClick(`#director-panel [data-inspector-tab=${t}]`);await wait(700);};
  const selectDesk=async id=>{await tab('desks');await page.evaluate(id=>document.querySelector(`#director-panel [data-action="dk-select"][data-section="${id}"]`)?.click(),id);await wait(700);};
  const drag=async(from,dx,dy)=>{await page.mouse.move(from.x,from.y);await wait(200);await page.mouse.down();await page.mouse.move(from.x+dx/2,from.y+dy/2,{steps:6});await page.mouse.move(from.x+dx,from.y+dy,{steps:6});await wait(150);await page.mouse.up();await wait(800);};
  const undo=async()=>{await panelClick('#director-appbar [data-action="undo"]');await wait(1500);};
  const redo=async()=>{await panelClick('#director-appbar [data-action="redo"]');await wait(1500);};
  const editsNow=async()=>(await page.evaluate(()=>__draftShot()?.deskEdits))||[];
  let HOME={},CAST0=null;

  // ---- the per-frame findings of one step (frames taken from the sampler). ctx: {touched:Set, hiddenBefore, hiddenAfter,
  // edits (the desk edits during the step), movers:Set (people allowed to move: playback), users:Set (people a hide may take)}
  function analyse(label,frames,ctx){
    const out=[],drawn=frames,ref=frames[0];if(!ref)return [`${label}: no frames sampled`];
    const editOf=id=>ctx.edits.find(e=>e.desk===id);
    for(const id of Object.keys(ref.d)){
      const h=HOME[id];if(!h)continue;
      let homeDrawn=0,hidDrawn=0,moved=0,vis=0,rebuilt=0,first=null,left=false;const touched=ctx.touched.has(id);
      for(let i=0;i<drawn.length;i++){const s=drawn[i].d[id],r=ref.d[id];if(!s||!r)continue;
        const e=editOf(id),away=e?.pose&&Math.hypot(e.pose.x-h.x,e.pose.z-h.z)>150;
        // (a desk moved or Redone off its home starts the step there: only a return to it after it has left is a glitch)
        const atHome=Math.hypot(s[0]-h.x,s[1]-h.z)<100;if(!atHome)left=true;
        if(away&&s[3]&&atHome&&(left||!touched)&&!ctx.allowHome?.has(id)){homeDrawn++;first??=`frame ${drawn[i].n} (${drawn[i].m}) at ${s[0]},${s[1]}`;}
        if(ctx.hiddenBefore.has(id)&&ctx.hiddenAfter.has(id)&&s[3]){hidDrawn++;first??=`frame ${drawn[i].n} (${drawn[i].m}) drawn`;}
        if(!touched){if(Math.abs(s[0]-r[0])>3||Math.abs(s[1]-r[1])>3||Math.abs(s[2]-r[2])>.3){moved++;first??=`frame ${drawn[i].n} (${drawn[i].m}) at ${s[0]},${s[1]} ${s[2]}deg, was ${r[0]},${r[1]} ${r[2]}deg`;}if(s[3]!==r[3]){vis++;first??=`frame ${drawn[i].n} (${drawn[i].m}) ${s[3]?'drawn':'not drawn'}`;}if(s[4]!==r[4])rebuilt++;}
        else if(s[4]!==r[4]&&s[5]===r[5])rebuilt++;
      }
      if(homeDrawn)out.push(`${id} DRAWN AT THE ROOM'S OWN PLACE in ${homeDrawn} frames (${first})`);
      if(hidDrawn)out.push(`${id} hidden but DRAWN in ${hidDrawn} frames (${first})`);
      if(moved)out.push(`${id} MOVED in ${moved} frames though not touched`);
      if(vis)out.push(`${id} SHOWN/HIDDEN in ${vis} frames though not touched`);
      if(rebuilt)out.push(`${id} REBUILT (new group)${touched?' with no size change':' though not touched'}`);
    }
    for(const key of Object.keys(ref.p)){
      if(ctx.movers?.has(key)||ctx.users?.has(key))continue;
      let pop=0,jump=0,pose=0,ex='';
      for(let i=1;i<drawn.length;i++){const a=drawn[i-1].p[key],b=drawn[i].p[key];if(!a||!b){if(!!a!==!!b){pop++;ex||=`frame ${drawn[i].n} (${drawn[i].m}) ${a?'gone':'back'}`;}continue;}
        if(a[3]!==b[3]){pop++;ex||=`frame ${drawn[i].n} (${drawn[i].m}) ${b[3]?'shown':'hidden'}`;}
        if(a[3]&&b[3]&&Math.hypot(a[0]-b[0],a[1]-b[1])>150){jump++;ex||=`frame ${drawn[i].n} (${drawn[i].m}) jumped ${Math.round(Math.hypot(a[0]-b[0],a[1]-b[1]))} mm from ${a[0]},${a[1]} to ${b[0]},${b[1]}`;}
        if(a[3]&&b[3]&&a[4]!==b[4]){pose++;ex||=`frame ${drawn[i].n} (${drawn[i].m}) posture ${a[4]} -> ${b[4]}`;}
      }
      if(pop||jump||pose)out.push(`person ${key}: ${pop} pops, ${jump} jumps, ${pose} posture changes (${ex})`);
    }
    return out;
  }
  // the stage against the chapter's desk edits (after a step has settled)
  function matchesCut(state,edits){
    const out=[];
    for(const [id,d] of Object.entries(state.desks)){
      if(d.featured)continue;const e=edits.find(x=>x.desk===id),h=HOME[id];
      if(e?.hide){if(d.vis)out.push(`${id} should be hidden, is drawn`);continue;}
      if(!d.vis&&h?.vis)out.push(`${id} should be drawn, is hidden`);
      const want=e?.pose||h;if(!want||d.x==null)continue;
      const wy=e?.pose?e.pose.yaw*180/Math.PI:h.yaw,dy=((d.yaw-wy+540)%360)-180;
      if(Math.abs(d.x-want.x)>2||Math.abs(d.z-want.z)>2||Math.abs(dy)>.2)out.push(`${id} at ${d.x},${d.z} ${d.yaw}deg, the cut says ${Math.round(want.x)},${Math.round(want.z)} ${wy.toFixed(1)}deg`);
    }
    return out;
  }
  const hidden=edits=>new Set(edits.filter(e=>e.hide).map(e=>e.desk));
  // one step: act, sample every frame through it and its settle, then check
  async function step(label,act,{touched=[],movers=[],users=[],allowHome=[],settleAfter=true,cut=true}={}){
    const e0=await editsNow();await page.evaluate(()=>{__sampler();__take();__mark('act');});
    await act();await page.evaluate(()=>__mark('settle'));if(settleAfter)await settle();else await wait(400);
    const frames=await page.evaluate(()=>__take()),e1=await editsNow(),state=await all();
    // the people at a touched desk go where it goes
    const followers=Object.values(state.people).filter(p=>p.station&&touched.includes('station-'+String(p.station).replace(/^station-/,''))).map(p=>p.key);
    const f=analyse(label,frames,{touched:new Set(touched),hiddenBefore:hidden(e0),hiddenAfter:hidden(e1),edits:e1,movers:new Set(movers),users:new Set([...users,...followers]),allowHome:new Set(allowHome)});
    // (who placed a desk at its home: reported with a finding that a desk was drawn there; an Undo puts a desk home on purpose)
    const pl=await page.evaluate(()=>__places());if(pl.length&&f.some(x=>/ROOM'S OWN/.test(x)))f.push(`placed at home: ${pl.slice(0,3).join(' || ')}`);
    for(const x of f)findings.push(`${label}: ${x}`);
    check(!f.length,`${label}: sampler, ${frames.length} frames${f.length?': '+f.join('; '):' clean'}`);
    if(cut){const m=matchesCut(state,e1);check(!m.length,`${label}: the stage matches the chapter's desk edits${m.length?': '+m.join('; '):''}`);}
    return {e0,e1,state,frames};
  }

  // ---- open the chapter (with Vico's draft: "Keep my unexported changes", as he would)
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the room desks',90000);await wait(2000);
  if(DRAFT){
    const kept=await page.evaluate(()=>{const b=document.querySelector('[data-action="film-keep-draft"]');if(!b)return 'no offer';if(b.getAttribute('aria-pressed')==='true')return 'already';b.click();return 'clicked';});
    await wait(4000);note(`Vico's draft (${DRAFT.cut.shots[0].deskEdits?.length||0} desk edits, ${DRAFT.cut.shots[0].propEdits?.length||0} prop edits): Keep my unexported changes: ${kept}; status: ${(await page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'')).slice(0,220)}`);
  }
  // (the fold of room-desk prop moves lands a moment after the film is applied)
  await until(async()=>!((await page.evaluate(()=>__draftShot()?.propEdits))||[]).some(e=>/ErgoFlex desk/.test(e.match||'')),'the fold',30000).catch(()=>null);
  await seek(1);await wait(2500);
  await page.evaluate(()=>__sampler());
  const s0=await all();
  // the room's own place of every desk: where the film puts it before any desk edit (deskEditWas), else where it stands
  for(const [id,d] of Object.entries(s0.desks))HOME[id]=d.was?{x:d.was.x,z:d.was.z,yaw:d.was.yaw*180/Math.PI,vis:true}:{x:d.x,z:d.z,yaw:d.yaw,vis:d.vis};
  await page.evaluate(h=>{window.__HOMES=h;document.getElementById('stage').contentWindow.__homes=h;},HOME);
  const e00=await editsNow();
  const roomDesks=Object.entries(s0.desks).filter(([,d])=>!d.featured).map(([id])=>id);
  note(`${CHAPTER}: ${roomDesks.length} room desks (${roomDesks.join(', ')}); desk edits at open: ${JSON.stringify(e00.map(e=>[e.desk,e.hide?'hide':e.pose?[Math.round(e.pose.x),Math.round(e.pose.z)]:'-']))}`);
  const people0=Object.values(s0.people).filter(p=>p.visible);
  note(`people on the stage: ${people0.map(p=>`${p.key}${p.station?'@'+p.station:''}`).join(' ')}`);
  CAST0=people0.map(p=>p.key);
  check(roomDesks.length>=5,`0. ${roomDesks.length} room desks in ${CHAPTER} (enough for the workflow)`);
  {const m=matchesCut(s0,e00);check(!m.length,`0. on open the stage matches the chapter's desk edits${m.length?': '+m.join('; '):''}`);}
  {const st=await page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');const sp=(await page.evaluate(()=>__draftShot()?.propEdits))||[];
   const deskProps=sp.filter(e=>/ErgoFlex desk/.test(e.match||''));check(!deskProps.length,`0. no prop edit moves a room desk after the fold (${deskProps.length} left)${/Desks tab/.test(st)?'; status: '+st.slice(0,160):''}`);}
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,`${CHAPTER}-0-open.png`)});}

  // ---- 1 + 3 + 4: move 8+ desks in a row (handle, gumball, ring), Undo / Redo after each, tabs between
  const hiddenAtOpen=hidden(e00),movable=roomDesks.filter(id=>!hiddenAtOpen.has(id));
  const propMoved=new Set((DRAFT?.cut?.shots?.[0]?.propEdits||[]).filter(e=>/ErgoFlex desk/.test(e.match||'')).map(e=>Object.keys(s0.desks).find(id=>e.match==='^'+s0.desks[id].name.replace(/[.*+?^${}()|[\]\\/]/g,m=>'\\'+m)+' · ErgoFlex desk$'||e.match.includes(s0.desks[id].name))).filter(Boolean));
  // every visible room desk (the ones moved as props first), round again (another tool each time) until 8 or more moves
  const once=[...movable.filter(id=>propMoved.has(id)),...movable.filter(id=>!propMoved.has(id))].slice(0,10),order=[];
  while(once.length&&order.length<8)order.push(...once);
  note(`${order.length} moves over ${once.length} different visible desks (moved as props before: ${[...propMoved].join(', ')||'none'})`);
  const tools=['handle','gumball','ring'];let moved=0;
  for(let i=0;i<order.length;i++){
    const id=order[i],how=tools[i%3],L=`1.${i+1} ${how} ${id}`;
    await selectDesk(id);await page.evaluate(i=>__frame(i),id);await wait(900);
    const ok=await until(()=>page.evaluate(()=>!!__handle()),'the round handle',15000).catch(()=>false);
    if(!check(!!ok,`${L}: the desk tools are on the desk`))continue;
    const before=(await all()).desks[id];
    const r=await step(L,async()=>{
      if(how==='handle')await drag(await page.evaluate(()=>__handle()),70,-30);
      else if(how==='gumball'){const g=await page.evaluate(()=>__arrow(Math.random()<.5?'X':'Z'));const u={x:g.a.x-g.o.x,y:g.a.y-g.o.y},l=Math.hypot(u.x,u.y)||1;await drag(g.a,u.x/l*70,u.y/l*70);}
      else await drag(await page.evaluate(()=>__knob()),55,18);
    },{touched:[id]});
    const a=r.state.desks[id],dist=Math.hypot(a.x-before.x,a.z-before.z),turn=Math.abs(((a.yaw-before.yaw+540)%360)-180);
    if(check(dist>20||turn>1,`${L}: the desk moved (${dist.toFixed(0)} mm, ${turn.toFixed(1)} deg)`))moved++;
    // 3: Undo puts it back, Redo brings the move back (each sampled)
    await step(`3.${i+1}a Undo ${id}`,undo,{touched:[id]}).then(u=>{const b=u.state.desks[id];check(Math.abs(b.x-before.x)<=2&&Math.abs(b.z-before.z)<=2&&Math.abs(((b.yaw-before.yaw+540)%360)-180)<.2,`3.${i+1}a Undo: ${id} back where it stood (${(b.x-before.x).toFixed(1)}, ${(b.z-before.z).toFixed(1)} mm)`);});
    await step(`3.${i+1}b Redo ${id}`,redo,{touched:[id]}).then(u=>{const b=u.state.desks[id];check(Math.abs(b.x-a.x)<=2&&Math.abs(b.z-a.z)<=2,`3.${i+1}b Redo: ${id} where it was dropped (${(b.x-a.x).toFixed(1)}, ${(b.z-a.z).toFixed(1)} mm)`);});
    // 4: Desks -> Props -> People -> Desks: nothing moves
    await step(`4.${i+1} tabs Props / People / Desks`,async()=>{await tab('props');await wait(400);await tab('people');await wait(400);await tab('desks');},{touched:[]});
  }
  check(moved>=8,`1. ${moved} moves in a row (8 or more) over ${once.length} different desks`);
  if(shots)await page.screenshot({path:path.join(shots,`${CHAPTER}-1-moved.png`)});

  // ---- 2 (+3): hides
  const stUsers=async()=>{const s=await all(),m={};for(const p of Object.values(s.people))if(p.visible&&p.station)(m['station-'+p.station.replace(/^station-/,'')]??=[]).push(p.key);return m;};
  const users=await stUsers();note(`desk users: ${JSON.stringify(users)}`);
  const movers=new Set(Object.keys(s0.people).filter(k=>/^(kai|noah)/.test(k)));
  const isStation=id=>id.startsWith('station-');
  const hideable=roomDesks.filter(id=>isStation(id)&&!hiddenAtOpen.has(id));
  const free=hideable.filter(id=>!(users[id]||[]).length),sat=hideable.filter(id=>(users[id]||[]).some(k=>!movers.has(k)));
  // up to 4 desks, the free ones first, never the one kept for the sitter case (oilers has only 4 visible room desks)
  const toHide=[...free,...hideable.filter(id=>!free.includes(id))].filter(id=>id!==sat[0]).slice(0,4);
  note(`hide: ${toHide.join(', ')}; with a sitter: ${sat[0]||'none'} (${(users[sat[0]]||[]).join(',')})`);
  const vis=async(label,id,wantShown,extra={})=>{
    await selectDesk(id);
    const r=await step(label,async()=>{await panelClick('#director-panel [data-action="dk-visibility"]');await wait(1200);},{touched:[id],users:users[id]||[],...extra});
    check(r.state.desks[id].vis===wantShown,`${label}: ${id} is ${wantShown?'shown':'hidden'} (${r.state.desks[id].vis?'drawn':'not drawn'})`);
    return r;
  };
  for(const [i,id] of toHide.entries()){
    await vis(`2.${i+1} Hide ${id}`,id,false);
    await step(`3.h${i+1}a Undo the hide of ${id}`,undo,{touched:[id],users:users[id]||[]}).then(u=>check(u.state.desks[id].vis,`3.h${i+1}a Undo: ${id} is back`));
    await step(`3.h${i+1}b Redo the hide of ${id}`,redo,{touched:[id],users:users[id]||[]}).then(u=>check(!u.state.desks[id].vis,`3.h${i+1}b Redo: ${id} hidden again`));
    await step(`4.h${i+1} tabs`,async()=>{await tab('people');await tab('props');await tab('desks');});
  }
  for(const [i,id] of toHide.slice(0,2).entries()){
    await vis(`2.${5+i} Show ${id} again`,id,true);
    await step(`3.s${i+1}a Undo the show of ${id}`,undo,{touched:[id],users:users[id]||[]}).then(u=>check(!u.state.desks[id].vis,`3.s${i+1}a Undo: ${id} hidden again`));
    await step(`3.s${i+1}b Redo the show of ${id}`,redo,{touched:[id],users:users[id]||[]}).then(u=>check(u.state.desks[id].vis,`3.s${i+1}b Redo: ${id} shown`));
  }
  if(sat[0]){
    const id=sat[0],who=users[id];
    const r=await vis(`2.7 Hide ${id} with its sitter ${who.join(',')}`,id,false);
    const gone=who.filter(k=>!r.state.people[k]?.visible);check(gone.length===who.length,`2.7 the sitter goes with the desk (${gone.join(',')||'none'} of ${who.join(',')})`);
    const others=CAST0.filter(k=>!who.includes(k)&&!Object.values(users).flat().includes(k)||movers.has(k)).filter(k=>!r.state.people[k]?.visible);
    check(!others.length,`2.7 nobody else leaves${others.length?': '+others.join(', '):''}`);
    await step(`3.7a Undo`,undo,{touched:[id],users:who}).then(u=>check(u.state.desks[id].vis&&who.every(k=>u.state.people[k]?.visible),`3.7a Undo: ${id} and ${who.join(',')} back`));
    await step(`3.7b Redo`,redo,{touched:[id],users:who});
  }else check(false,'2.7 no desk with a seated user to hide in this chapter');
  // hide while people move: playback runs, Kai rolls, Noah walks; the hide is clicked mid-play
  {
    const id=hideable.find(x=>!toHide.includes(x)&&x!==sat[0]&&!(users[x]||[]).some(k=>movers.has(k)))||toHide.slice(0,2).find(x=>!(users[x]||[]).some(k=>movers.has(k)))||toHide[0];
    await selectDesk(id);await seek(0);
    
    const r=await step(`2.8 Hide ${id} while playing`,async()=>{
      await panelClick('#director-timeline [data-action="chapter-toggle"]');const t0=Date.now();await until(()=>playing(),'playback',90000);note(`2.8 playback started after ${((Date.now()-t0)/1000).toFixed(1)} s`);
      await page.evaluate(()=>{__sampler();__mark('playing');});await wait(Math.min(4000,SECONDS*300));
      const p0=await all();await panelClick('#director-panel [data-action="dk-visibility"]');await wait(2500);const p1=await all();
      const roll=[...movers].map(k=>`${k} ${p0.people[k]&&p1.people[k]?Math.round(Math.hypot(p1.people[k].at[0]-p0.people[k].at[0],p1.people[k].at[1]-p0.people[k].at[1])):'?'} mm`);
      note(`2.8 while playing: ${roll.join(', ')} in 2.5 s; still playing: ${await playing()}`);
      await wait(1500);if(await playing())await panelClick('#director-timeline [data-action="chapter-toggle"]');await wait(800);await page.evaluate(()=>__mark('act'));
    },{touched:[id],movers:[...movers],users:users[id]||[]});
    check(!r.state.desks[id].vis,`2.8 ${id} hidden while playing`);
    const lost=[...movers].filter(k=>s0.people[k]?.visible&&!r.state.people[k]?.visible);check(!lost.length,`2.8 Kai / Noah still in the scene${lost.length?' (gone: '+lost.join(',')+')':''}`);
    await step(`3.8a Undo`,undo,{touched:[id],users:users[id]||[]});await step(`3.8b Redo`,redo,{touched:[id],users:users[id]||[]});
  }
  if(shots)await page.screenshot({path:path.join(shots,`${CHAPTER}-2-hidden.png`)});

  // ---- 5: play from 0 and scrub
  {
    const e=await editsNow();await seek(0);await page.evaluate(()=>{__sampler();__take();__mark('play');});
    await panelClick('#director-timeline [data-action="chapter-toggle"]');await until(()=>playing(),'playback',90000);await page.evaluate(()=>{__sampler();__mark('playing');});await wait((SECONDS+1.5)*1000);
    if(await playing())await panelClick('#director-timeline [data-action="chapter-toggle"]');
    await wait(600);const frames=await page.evaluate(()=>{__mark('');return __take();});
    const f=analyse('5.1 play',frames,{touched:new Set(),hiddenBefore:hidden(e),hiddenAfter:hidden(e),edits:e,movers:new Set(Object.keys(s0.people)),users:new Set()}).filter(x=>!/MOVED|SHOWN\/HIDDEN|REBUILT/.test(x)||/hidden but|ROOM'S OWN/.test(x));
    // during play the film's own desk moves may run: only the hidden / room's-own-place / rebuilt findings count
    const f2=analyse('5.1 play',frames,{touched:new Set(),hiddenBefore:hidden(e),hiddenAfter:hidden(e),edits:e,movers:new Set(Object.keys(s0.people)),users:new Set()});
    for(const x of f2)findings.push('5.1 play: '+x);
    const bad=f2.filter(x=>/hidden but|ROOM'S OWN|REBUILT/.test(x));
    check(frames.length>SECONDS*10&&!bad.length,`5.1 play from 0 (${frames.length} frames): no hidden desk drawn, none at the room's own place, none rebuilt${bad.length?': '+bad.join('; '):''}${f2.length>bad.length?' [info: '+f2.filter(x=>!bad.includes(x)).join('; ')+']':''}`);
    const times=[0,SECONDS*.25,SECONDS*.5,SECONDS*.75,SECONDS-.2,SECONDS*.4,1];const bads=[];
    for(const t of times){await seek(t);await wait(600);const s=await all(),m=matchesCut(s,e).filter(x=>/hidden|drawn/.test(x));if(m.length)bads.push(`${t.toFixed(1)} s: ${m.join(', ')}`);}
    const sf=await page.evaluate(()=>__take()),fs2=analyse('5.2 scrub',sf,{touched:new Set(),hiddenBefore:hidden(e),hiddenAfter:hidden(e),edits:e,movers:new Set(Object.keys(s0.people)),users:new Set()}).filter(x=>/hidden but|ROOM'S OWN|REBUILT/.test(x));
    check(!bads.length&&!fs2.length,`5.2 scrub ${times.map(t=>t.toFixed(1)).join(', ')} s: hides hold, nothing at the room's own place${[...bads,...fs2].length?': '+[...bads,...fs2].join('; '):''}`);
    await settle();const m=matchesCut(await all(),e);check(!m.length,`5.3 after play + scrub the stage matches the edits${m.length?': '+m.join('; '):''}`);
  }

  // ---- 6: reload: the draft comes back (no seeding: the flag is set), nothing jumps or reappears
  {
    const pre=await all(),ePre=await editsNow();
    await page.reload();await until(()=>page.evaluate(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||'')),'the chapter after the reload',300000);
    await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the desks after the reload',90000);await wait(2500);
    const offer=await page.evaluate(()=>{const b=document.querySelector('[data-action="film-keep-draft"]');return b?b.getAttribute('aria-pressed'):'none';});
    if(offer==='false'){await panelClick('[data-action="film-keep-draft"]');await wait(4000);}
    note(`6 after the reload: the draft offer: ${offer==='none'?'none (loaded)':offer==='true'?'loaded':'had to click Keep my unexported changes'}`);
    await page.evaluate(()=>__sampler());await seek(1);await wait(1500);
    const post=await all(),ePost=await editsNow();
    check(JSON.stringify(ePre)===JSON.stringify(ePost),`6.1 the chapter's desk edits come back as they were (${ePost.length} edits)${JSON.stringify(ePre)===JSON.stringify(ePost)?'':': before '+JSON.stringify(ePre).slice(0,300)+' after '+JSON.stringify(ePost).slice(0,300)}`);
    const d=Object.keys(pre.desks).flatMap(id=>{const a=pre.desks[id],b=post.desks[id];if(!b)return [`${id} gone`];const o=[];if(Math.abs(a.x-b.x)>2||Math.abs(a.z-b.z)>2||Math.abs(a.yaw-b.yaw)>.2)o.push(`${id} ${a.x},${a.z} -> ${b.x},${b.z}`);if(a.vis!==b.vis)o.push(`${id} ${b.vis?'REAPPEARED':'vanished'}`);return o;});
    check(!d.length,`6.2 after the reload every desk stands as before, hidden ones stay hidden${d.length?': '+d.join('; '):''}`);
    const pp=k=>Object.values(k.people).filter(p=>p.visible).map(p=>p.key).sort().join(' ');check(pp(pre)===pp(post),`6.3 the same people after the reload${pp(pre)===pp(post)?'':': before ['+pp(pre)+'] after ['+pp(post)+']'}`);
    await step('6.4 settle after the reload',async()=>{},{});
    // one more move after the reload
    const id=order[0];await selectDesk(id);await page.evaluate(i=>__frame(i),id);await wait(900);
    if(await until(()=>page.evaluate(()=>!!__handle()),'the handle after the reload',15000).catch(()=>false))await step(`6.5 handle drag ${id} after the reload`,async()=>drag(await page.evaluate(()=>__handle()),60,-25),{touched:[id]});
  }

  // ---- 7: Export cut (caught, no download) + dry-run import into a scratch copy of the cut dir
  {
    const eNow=await editsNow();
    const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="export"]').click();setTimeout(()=>r(null),20000);}));
    if(!check(!!text,'7.1 Export cut gives the chapter\'s cut'))throw Error('no export');
    const cut=JSON.parse(text),sh=cut.shots[0],ex=sh.deskEdits||sh.sceneDeskEdits||[];
    const want=eNow.map(e=>e.desk+(e.hide?':hide':'')+(e.pose?`:${Math.round(e.pose.x)},${Math.round(e.pose.z)}`:'')).sort().join(' '),got=ex.map(e=>e.desk+(e.hide?':hide':'')+(e.pose?`:${Math.round(e.pose.x)},${Math.round(e.pose.z)}`:'')).sort().join(' ');
    check(want===got,`7.2 the export carries every hide and pose (${ex.length} desk edits)${want===got?'':': want ['+want+'] got ['+got+']'}`);
    tmpCut=fs.mkdtempSync(path.join(root,'exports','tmp-desk-proof-'));
    for(const f of ['review-cut.json','edl.json','titles-src.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(tmpCut,f));
    fs.cpSync(path.join(H0,'shots'),path.join(tmpCut,'shots'),{recursive:true});
    const exportFile=path.join(tmpCut,`export-${CHAPTER}.json`);fs.writeFileSync(exportFile,text);
    const py=process.env.PYTHON||'python',env={...process.env,PYTHONUTF8:'1'};
    let out='';try{out=execFileSync(py,[path.join(root,'tools/experience/build-round8-director.py'),path.relative(root,tmpCut),'--import',exportFile],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
      out+=execFileSync(py,[path.join(root,'tools/experience/build-round8-director.py'),path.relative(root,tmpCut)],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
    catch(e){out='ERROR '+(e.stderr||e.message).toString().split('\n').filter(Boolean).slice(-4).join(' | ');}
    note('7 import: '+out.trim().split('\n').slice(-3).join(' | ').slice(0,400));
    const rc=JSON.parse(fs.readFileSync(path.join(tmpCut,'review-cut.json'),'utf8')),ch=(rc.shots||rc.chapters||[]).find(s=>s.id===CHAPTER);
    const rd=ch?.sceneDeskEdits||[],rgot=rd.map(e=>e.desk+(e.hide?':hide':'')+(e.pose?`:${Math.round(e.pose.x)},${Math.round(e.pose.z)}`:'')).sort().join(' ');
    check(!!ch&&rgot===want,`7.3 review-cut.json (scratch copy) ${CHAPTER}: sceneDeskEdits ${rgot===want?'= the Director\'s':'differ: ['+rgot+'] vs ['+want+']'}`);
    const cast=ch?.people?.cast||[],keys=new Set(cast.map(c=>c.key||c.id)),missing=CAST0.filter(k=>!keys.has(k)&&(pageCut.shots[0].people?.cast||[]).some(c=>(c.key||c.id)===k));
    const pc=(ch?.people?.cast||[]).length,fc=(pageCut.shots[0].people?.cast||[]).length;
    check(!!ch&&(pc>=fc||!fc)&&!missing.length,`7.4 review-cut.json people cast intact (${pc} entries, the film had ${fc}${missing.length?'; missing '+missing.join(','):''}; except ${JSON.stringify(ch?.people?.except||null)})`);
  }
}catch(e){fails.push(e.message);console.log('FAIL',e.stack||e.message);}
finally{if(errors.length){fails.push('page errors');console.log('page errors:',errors.slice(0,5));}await close();if(tmpCut)fs.rmSync(tmpCut,{recursive:true,force:true});}
console.log(fails.length?`\n${fails.length} failed`:'\nall passed');process.exit(fails.length?1:0);
