// Director Desks, the view tools end to end (real GPU Chrome): a click on a desk in the view selects it and leaves the
// camera alone afterwards (the click's pointerup used to be kept from the orbit controls, which then turned the camera
// with every move of the mouse); the gumball's arrows slide the desk along the room's X and Z, the ring's knob turns it
// (Shift: 15° steps), each says what it does under the pointer, and every drag is one desk edit in the chapter.
//   flock /tmp/claude-1000/hq12-stills.lock node tests/director-desk-gumball-e2e.mjs      (SHOTS=dir keeps screenshots; LOCK_ONLY=1 stops after the camera check)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director desk gumball e2e: skipped (${HQ} has no oilers chapter page in this checkout).`);process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-gumball-e2e-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const ID='station-student-standing',IN=25.4;
try{
  await page.evaluateOnNewDocument(()=>{
    window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree?.THREE,desks:w.ErgoFlex.sceneDesks};};
    window.__rec=id=>{const r=__t().desks.records.get(id);return r?{x:r.group.position.x,z:r.group.position.z,yaw:r.group.rotation.y}:null;};
    window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].deskEdits||null;}catch{return null;}};
    window.__cam=()=>{const {t}=__t();return [...t.camera.position.toArray(),...t.controls.target.toArray()].map(v=>Math.round(v*1e4)/1e4).join(',');};
    window.__screen=v=>{const {t}=__t(),p=v.clone().project(t.camera),f=document.getElementById('stage').getBoundingClientRect(),c=t.renderer.domElement.getBoundingClientRect();return {x:f.left+c.left+(p.x+1)/2*c.width,y:f.top+c.top+(1-p.y)/2*c.height};};
    window.__frame=id=>{const {t,T,desks}=__t(),r=desks.records.get(id),b=new T.Box3().setFromObject(r.group),c=b.getCenter(new T.Vector3());const look=c.clone().setY(c.y+.9);t.camera.position.set(c.x+.6,c.y+3.6,c.z+4.2);t.controls.target.copy(look);t.camera.lookAt(look);t.controls.update();};   // the desk low in the frame: the gumball over it stays clear of the stage's toolbar
    // a screen point on the desk's bare body
    window.__deskPoint=id=>{const {t,T,desks}=__t(),r=desks.records.get(id),box=new T.Box3().setFromObject(r.group),ray=new T.Raycaster();
      const ours=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls)return true;return false;};
      const item=o=>{for(let p=o;p&&p!==r.group;p=p.parent)if(p.userData?.directorAdd||p.userData?.sceneAsset||p.userData?.dayKit||/^Accessory:|^(Scene dressing|Accessory mount|Desk dressing):|:(desktop|shelf|lower-shelf|base-shelf)$/.test(p.name||''))return true;return false;};
      const xs=[],ys=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).project(t.camera);xs.push(v.x);ys.push(v.y);}
      const x0=Math.max(-.95,Math.min(...xs)),x1=Math.min(.95,Math.max(...xs)),y0=Math.max(-.95,Math.min(...ys)),y1=Math.min(.95,Math.max(...ys));
      for(let i=0;i<=40;i++)for(let j=0;j<=40;j++){const v={x:x0+(x1-x0)*i/40,y:y0+(y1-y0)*j/40};ray.setFromCamera(new T.Vector2(v.x,v.y),t.camera);
        const hit=ray.intersectObject(t.scene,true).find(h=>h.object.isMesh&&!ours(h.object)&&h.object.visible);if(!hit)continue;
        let q=hit.object,own=false;for(;q;q=q.parent)if(q===r.group){own=true;break;}
        if(own&&!item(hit.object))return __screen(hit.point);}
      return null;};
    // the gumball: its TransformControls (the only one without a Y arrow) and a point on one of its arrows
    window.__gum=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.showY===false&&o.userData.directorTools)g=o;});return g;};
    window.__arrow=axis=>{const {t,T}=__t(),g=__gum();if(!g?.object||!g.visible)return null;const at=g.object.getWorldPosition(new T.Vector3());
      const factor=at.distanceTo(t.camera.position)*Math.min(1.9*Math.tan(Math.PI*t.camera.fov/360)/t.camera.zoom,7)*g.size/4;
      const dir=new T.Vector3(axis==='X'?1:0,0,axis==='Z'?1:0).transformDirection(g.object.matrixWorld);return __screen(at.clone().addScaledVector(dir,.42*factor));};
    window.__knob=()=>{const {t,T}=__t();let g=null;t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});if(!g?.visible)return null;const turn=g.children.filter(o=>o.isGroup)[1];return __screen(turn.children[2].getWorldPosition(new T.Vector3()));};
    window.__tip=()=>{const d=[...document.getElementById('stage').contentDocument.body.children].find(e=>e.style?.pointerEvents==='none'&&e.style.position==='fixed'&&e.style.borderColor);return d&&d.style.display!=='none'?d.textContent:'';};
  });
  await openChapter(page,base,chapter);
  const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
  const rec=()=>page.evaluate(i=>__rec(i),ID),draft=()=>page.evaluate(()=>__draft());
  const header=()=>page.$eval('#director-panel [data-selected-header]',e=>e.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
  await until(()=>page.evaluate(()=>__t().desks.records.size>1),'the room\'s desks on the stage',90000);await wait(2500);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=desks]').click());await wait(700);
  await until(()=>page.evaluate(()=>{let g=null;__t().t.scene.traverse(o=>{if(o.name==='Director desk tools')g=o;});return !!g;}),'the desk tools start with the tab');
  await page.evaluate(i=>__frame(i),ID);await wait(700);

  // ---- a click on a desk in the view selects it and the camera stays put when the mouse moves on
  const pt=await page.evaluate(i=>__deskPoint(i),ID);check(!!pt,'a bare point on the desk to click');
  await page.mouse.move(pt.x,pt.y);await page.mouse.down();await wait(60);await page.mouse.up();await wait(900);
  check(/Desk · /.test(await header()),'the click selects the desk: '+await header());
  const stage=await page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
  const before=await page.evaluate(()=>__cam());
  for(let i=0;i<14;i++){await page.mouse.move(stage.x+stage.w*(.25+.04*i),stage.y+stage.h*(.3+.03*i));await wait(50);}await wait(400);
  check(before===await page.evaluate(()=>__cam()),'moving the mouse after the click leaves the camera where it was');
  await page.screenshot({path:path.join(shots,'gumball-selected.png')});
  if(process.env.LOCK_ONLY)throw Object.assign(Error('lock only'),{done:true});

  // ---- the gumball: X arrow, Z arrow, each one desk edit; the tooltip names what is under the pointer
  const drag=async(from,dx,dy,{shift=false}={})=>{await page.mouse.move(from.x,from.y);await wait(250);if(shift)await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(from.x+dx/2,from.y+dy/2,{steps:6});await page.mouse.move(from.x+dx,from.y+dy,{steps:6});await wait(150);const tip=await page.evaluate(()=>__tip());await page.mouse.up();if(shift)await page.keyboard.up('Shift');await wait(900);return tip;};
  const a0=await rec(),ax=await page.evaluate(()=>__arrow('X'));check(!!ax,'the gumball shows on the selected desk');
  await page.mouse.move(ax.x,ax.y);await wait(350);
  check(await page.evaluate(()=>__gum().axis)==='X'&&/Slide along X/.test(await page.evaluate(()=>__tip())),'over the X arrow the tooltip says: '+await page.evaluate(()=>__tip()));
  const o=await page.evaluate(()=>{const g=__gum(),{T}=__t();return __screen(g.object.getWorldPosition(new T.Vector3()));});
  const ux={x:(ax.x-o.x),y:(ax.y-o.y)},len=Math.hypot(ux.x,ux.y);
  const tipX=await drag(ax,ux.x/len*70,ux.y/len*70);
  const a1=await rec();
  check(Math.abs(a1.x-a0.x)>40&&Math.abs(a1.z-a0.z)<1,`the X arrow slides the desk along X only: x ${(a0.x/IN).toFixed(1)}″ -> ${(a1.x/IN).toFixed(1)}″, z ${(a0.z/IN).toFixed(1)}″ -> ${(a1.z/IN).toFixed(1)}″`);
  check(/x .*″ · z .*″/.test(tipX),'while dragging the tooltip shows the position: '+tipX);
  const e1=(await draft())?.find(e=>e.desk===ID);check(!!e1&&Math.abs(e1.pose.x-a1.x)<.2,'the move is one desk edit in the chapter');
  const az=await page.evaluate(()=>__arrow('Z')),o2=await page.evaluate(()=>{const g=__gum(),{T}=__t();return __screen(g.object.getWorldPosition(new T.Vector3()));});
  const uz={x:az.x-o2.x,y:az.y-o2.y},lz=Math.hypot(uz.x,uz.y);
  await drag(az,uz.x/lz*60,uz.y/lz*60);const a2=await rec();
  check(Math.abs(a2.z-a1.z)>30&&Math.abs(a2.x-a1.x)<1,`the Z arrow slides it along Z only: z ${(a1.z/IN).toFixed(1)}″ -> ${(a2.z/IN).toFixed(1)}″`);

  // ---- the ring's knob turns the desk; Shift lands on 15° steps
  const k=await page.evaluate(()=>__knob());check(!!k,'the turn knob shows');
  await page.mouse.move(k.x,k.y);await wait(350);check(/Turn the desk/.test(await page.evaluate(()=>__tip())),'over the knob the tooltip says: '+await page.evaluate(()=>__tip()));
  const tipT=await drag(k,55,18);const a3=await rec(),deg=r=>r*180/Math.PI;
  check(Math.abs(deg(a3.yaw-a2.yaw))>4&&Math.abs(a3.x-a2.x)<.2&&Math.abs(a3.z-a2.z)<.2,`the knob turns the desk in place: ${deg(a2.yaw).toFixed(1)}° -> ${deg(a3.yaw).toFixed(1)}° (${tipT})`);
  const k2=await page.evaluate(()=>__knob());await drag(k2,-60,-25,{shift:true});const a4=await rec(),m=((deg(a4.yaw)%15)+15)%15;
  check(Math.min(m,15-m)<.05&&Math.abs(deg(a4.yaw-a3.yaw))>1,`with Shift it lands on a 15° step: ${deg(a4.yaw).toFixed(2)}°`);
  const e2=(await draft())?.find(e=>e.desk===ID);check(!!e2&&Math.abs(e2.pose.yaw-a4.yaw)<1e-3&&Math.abs(e2.pose.z-a4.z)<.2,'the chapter keeps place and turn: '+JSON.stringify(e2?.pose));
  await page.screenshot({path:path.join(shots,'gumball-moved.png')});
  // ---- the camera is still free: an orbit drag on empty floor turns it, and it rests afterwards
  const c0=await page.evaluate(()=>__cam());await page.mouse.move(stage.x+stage.w*.12,stage.y+stage.h*.9);await page.mouse.down();await page.mouse.move(stage.x+stage.w*.2,stage.y+stage.h*.9,{steps:6});await page.mouse.up();
  let c1=await page.evaluate(()=>__cam());for(let i=0;i<40;i++){await wait(250);const now=await page.evaluate(()=>__cam());if(now===c1)break;c1=now;}   // the orbit's damping runs out
  for(let i=0;i<8;i++){await page.mouse.move(stage.x+stage.w*(.3+.04*i),stage.y+stage.h*.5);await wait(50);}await wait(400);
  const c2=await page.evaluate(()=>__cam()),still=(a,b)=>a.split(',').every((v,i)=>Math.abs(v-b.split(',')[i])<.01);   // a stuck orbit turns it by tenths; the last of the damping by less than a thousandth
  check(c0!==c1&&still(c1,c2),'an orbit drag still turns the camera and it rests when the button is up'+(c0===c1?' (did not turn)':!still(c1,c2)?` (kept moving: ${c1} -> ${c2})`:''));
  // ---- Esc in the middle of an arrow drag: the drag ends there, the camera and the tools are free (TransformControls would
  // otherwise never hear the release and leave the orbit controls switched off)
  const ax2=await page.evaluate(()=>__arrow('X'));await page.mouse.move(ax2.x,ax2.y);await wait(300);await page.mouse.down();await page.mouse.move(ax2.x+25,ax2.y+6,{steps:5});await wait(150);
  await page.keyboard.press('Escape');await wait(400);await page.mouse.up();await wait(600);
  const free=await page.evaluate(()=>{const {w,t}=__t();return {dragging:!!w.__directorDragging,controls:t.controls.enabled,gum:!!__gum()?.visible,gumDragging:!!__gum()?.dragging};});
  check(!free.dragging&&free.controls&&!free.gum&&!free.gumDragging,'Esc during an arrow drag ends it and frees the camera: '+JSON.stringify(free));
  const d0=await page.evaluate(()=>__cam());await page.mouse.move(stage.x+stage.w*.12,stage.y+stage.h*.9);await page.mouse.down();await page.mouse.move(stage.x+stage.w*.22,stage.y+stage.h*.9,{steps:6});await page.mouse.up();await wait(600);
  check(d0!==await page.evaluate(()=>__cam()),'and the camera orbits again afterwards');
}catch(e){if(!e.done){failures.push(e.message);console.log('FAIL',e.message);}}
finally{if(errors.length){failures.push('page errors');console.log('page errors:',errors.slice(0,5));}await close();}
console.log(failures.length?`\n${failures.length} failed`:'\nall passed','· screenshots in',shots);process.exit(failures.length?1:0);
