// Director "Floor reflections" end to end (real GPU Chrome, chapter 2 rise): Lighting > Room > Floor reflections,
// the outlines in the view, clicking a pool selects its source (and reveals the section), dragging it moves it on the
// floor, the slider sets its spread, undo / redo with named status lines, Reset all, and live view = the film's
// layer (the pools film-fx reports follow the cut). No page errors, no module "not exported" errors.
//   node tests/director-floor-reflections-e2e.mjs        (BASE=… CHAPTER=rise; under the stills lock)
import assert from 'node:assert/strict';
import {HQ,chapterList,wait,openDirectorBrowser,openChapter,seek,status} from './director-e2e-harness.mjs';

const all=chapterList();
if(!all){console.log(`Director floor reflections e2e: skipped (${HQ}/director-chapters.json is not in this checkout).`);process.exit(0);}
const chapter=all.find(c=>c.id===(process.env.CHAPTER||'rise'));
const {base,page,errors,close}=await openDirectorBrowser();
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
try{
  await openChapter(page,base,chapter);await seek(page,12);
  await page.evaluate(()=>{window.__fr={
    w:()=>document.getElementById('stage').contentWindow,
    pools:()=>window.__fr.w().__filmFx.floorPools().map(p=>({key:p.key,on:p.on,c:p.centre.toArray(),hl:p.halfLength,hw:p.halfWidth})),
    // A world point on the stage canvas, in page pixels.
    screen:(xyz)=>{const w=window.__fr.w(),t=w.ErgoPresentation.three(),v=new t.camera.position.constructor(...xyz).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),f=document.getElementById('stage').getBoundingClientRect();return {x:f.left+r.left+(v.x+1)/2*r.width,y:f.top+r.top+(1-v.y)/2*r.height};},
    group:()=>{let g=null;window.__fr.w().ErgoPresentation.three().scene.traverse(o=>{if(o.name==='Director floor reflections')g=o;});return g&&{visible:g.visible,lines:g.children.filter(c=>c.isLine&&c.visible&&/^pool:/.test(c.name)).length,strips:g.children.filter(c=>c.isLine&&c.visible&&/^strip:/.test(c.name)).length};},
    draft:()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].sceneGlobals?.ledFloorSources??null;}catch{return 'none';}},
  };});
  const pools=()=>page.evaluate(()=>__fr.pools()),group=()=>page.evaluate(()=>__fr.group()),draft=()=>page.evaluate(()=>__fr.draft());
  // The sub-section: in Lighting > Room, under LED glow on the floor.
  await page.click('#director-panel [data-inspector-tab="lighting"]');await wait(300);
  await page.evaluate(()=>{const r=document.querySelector('#director-panel [data-light-section="room"]');r.open=true;});await wait(200);
  const order=await page.$eval('#director-panel [data-light-section="room"]',e=>{const t=e.innerText;return [t.indexOf('LED glow on the floor'),t.indexOf('Floor reflections')];});
  check(order[0]>=0&&order[1]>order[0],'Floor reflections sits under LED glow on the floor');
  await page.evaluate(()=>{document.querySelector('#director-panel [data-floor-section]').open=true;});
  const g=await until(async()=>{const x=await group();return x?.visible&&x.lines===4&&x;},'outlines on the floor');
  check(g.lines===4&&g.strips===4,'four pool outlines and their strips on the floor while the section is open');
  const before=await pools();check(before.map(p=>p.key).sort().join()==='center,foot,left,right','pools: foot, center, left, right');
  // Click the left pool's middle: selects the left side strip and reveals its home.
  const L=before.find(p=>p.key==='left'),at=await page.evaluate(c=>__fr.screen(c),L.c);
  await page.mouse.click(at.x,at.y);await wait(600);
  check(/Left side strip.*selected/.test(await status(page)),'clicking a pool selects its source ('+(await status(page)).slice(0,80)+')');
  check(await page.$eval('#director-panel [data-action="fr-pick"][data-section="left"]',b=>b.getAttribute('aria-pressed')==='true'),'the source picker follows');
  // Drag the pool: it moves on the floor, one undo step, a named status line.
  await page.mouse.move(at.x,at.y);await page.mouse.down();for(let i=1;i<=10;i++){await page.mouse.move(at.x+i*8,at.y+i*3);await wait(30);}await page.mouse.up();await wait(900);
  const moved=await until(async()=>{const d=await draft();return d?.left&&(d.left.x||d.left.z)&&d;},'the drag in the cut');
  {const st=await status(page);check(/Moved the left side strip's floor reflection/.test(st),'the drag is named in the status line: '+st.slice(0,120));}
  const after=await until(async()=>{const p=(await pools()).find(p=>p.key==='left');return Math.hypot(p.c[0]-L.c[0],p.c[2]-L.c[2])>1e-3&&p;},'live pool moved');
  check(!!after,`the live pool moved (${JSON.stringify(moved.left)})`);
  await page.click('#director-panel [data-action="undo"]');await wait(900);
  check(!(await draft())?.left,'undo puts it back');
  const back=(await pools()).find(p=>p.key==='left');check(Math.hypot(back.c[0]-L.c[0],back.c[2]-L.c[2])<1e-3,'and the live pool with it');
  await page.click('#director-panel [data-action="redo"]');await wait(900);
  check(JSON.stringify((await draft())?.left)===JSON.stringify(moved.left),'redo moves it again');
  // The spread slider (live, one step), then its number.
  await page.evaluate(()=>{const el=document.querySelector('#director-panel [name="fr-spread"]');el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(900);
  check((await draft())?.left?.spread===2,'spread ×2 in the cut');
  const wide=await until(async()=>{const p=(await pools()).find(p=>p.key==='left');return p.hw>after.hw*1.3&&p;},'live pool wider');
  check(wide.hw>after.hw*1.3,`the live pool is wider (${after.hw.toFixed(3)} -> ${wide.hw.toFixed(3)})`);
  // The end dot sets the length (a real drag on the handle, half way in toward the middle), on a source whose dot is in view.
  const inFrame=async pt=>pt&&page.evaluate(pt=>{const c=document.getElementById('stage').contentWindow.ErgoPresentation.three().renderer.domElement.getBoundingClientRect(),f=document.getElementById('stage').getBoundingClientRect();return pt.x>f.left+c.left+10&&pt.x<f.left+c.right-10&&pt.y>f.top+c.top+10&&pt.y<f.top+c.bottom-10;},pt);
  const dotOf=()=>page.evaluate(()=>{let h=null;__fr.w().ErgoPresentation.three().scene.traverse(o=>{if(o.name==='handle:length'&&o.visible)h=o.position.toArray();});return h&&__fr.screen(h);});
  let lenKey=null,handle=null;
  for(const k of ['foot','center','left','right']){await page.evaluate(k=>document.querySelector(`#director-panel [data-action="fr-pick"][data-section="${k}"]`).click(),k);await wait(400);const h=await dotOf();if(await inFrame(h)){lenKey=k;handle=h;break;}}
  check(!!handle,'a selected pool shows its length dot in view ('+lenKey+')');
  const P0=(await pools()).find(p=>p.key===lenKey);
  {const a=await page.evaluate(c=>__fr.screen(c),P0.c),dx=handle.x-a.x,dy=handle.y-a.y;
   await page.mouse.move(handle.x,handle.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(handle.x-dx*i/16,handle.y-dy*i/16);await wait(30);}await page.mouse.up();await wait(900);}
  const len=(await draft())?.[lenKey]?.length;check(len>0&&len<1,'dragging the end dot in shortens the pool (length ×'+len+')');
  check(/length ×/.test(await status(page)),'and names it: '+(await status(page)).slice(0,90));
  await page.evaluate(()=>document.querySelector('#director-panel [data-action="fr-pick"][data-section="left"]').click());await wait(300);
  // Selecting a pool from another tab brings the inspector home (Lighting > Room > Floor reflections, outlined).
  await page.click('#director-panel [data-inspector-tab="chapter"]');await wait(300);
  await page.click('#director-panel [data-inspector-tab="lighting"]');await wait(200);
  await page.evaluate(()=>{document.querySelector('#director-panel [data-light-section="room"]').open=true;document.querySelector('#director-panel [data-floor-section]').open=true;});await wait(400);
  await page.evaluate(()=>{const p=document.getElementById('director-panel');p.scrollTop=0;});
  const R=(await pools()).find(p=>p.key==='right'),rat=await page.evaluate(c=>__fr.screen(c),R.c);
  await page.mouse.click(rat.x,rat.y);await wait(900);
  const home=await page.evaluate(()=>{const p=document.getElementById('director-panel'),el=p.querySelector('[data-reveal="floor"]'),r=el.getBoundingClientRect(),pr=p.getBoundingClientRect();return {tab:p.querySelector('[data-inspector-tab][aria-pressed=true]').dataset.inspectorTab,open:el.closest('details').open,inView:r.top<pr.bottom-20&&r.bottom>pr.top,pulse:el.classList.contains('reveal-pulse')};});
  check(home.tab==='lighting'&&home.open&&home.inView,'clicking a pool reveals its section '+JSON.stringify(home));
  check(await page.$eval('#director-panel [data-action="fr-pick"][data-section="right"]',b=>b.getAttribute('aria-pressed')==='true'),'right side strip picked from the view');
  await page.evaluate(()=>{const p=document.querySelector('#director-panel [data-action="fr-pick"][data-section="left"]');p.click();});await wait(300);
  // Off, from the checkbox.
  await page.evaluate(()=>{const el=document.querySelector('#director-panel [name="fr-on"]');el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(700);
  check((await draft())?.left?.on===false&&/floor reflection off/.test(await status(page)),'On off');
  if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+'/director-floor-reflections.png'});
  // Reset all: back to the film in one step.
  await page.click('#director-panel [data-action="fr-reset-all"]');await wait(900);
  check((await draft())===null,'Reset all floor reflections');
  check(/All floor reflections back to the film/.test(await status(page)),'Reset all is named');
  // Closed (and Lights off): no outlines.
  await page.evaluate(()=>{document.querySelector('#director-panel [data-floor-section]').open=false;});await wait(500);
  check(!(await group()).visible,'outlines hide with the section');
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log(`Director floor reflections e2e: ${passed.length} checks passed\n  `+passed.join('\n  '));
}finally{await close();}
