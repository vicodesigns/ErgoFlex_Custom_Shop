// Director Tray mode end to end (real Chrome): the tray MOVES. Regression for 24 Nov 2026 ("the tray would not move at all"): the rig
// install called api.loadProp, which window.ErgoFlex does not have, so the jointed tray never loaded although the panel said "slide 40 %".
// Types Slide / Tilt / Swing in the Tray tab of chapter 1 and checks the rig's pivots move on the live stage, and that a limit is SAID.
// Run: CHROME=<chrome.exe> HQ=exports/<a cut with director-chapters.json> node tests/director-tray-e2e.mjs   (a chapter whose desk has the tray: awaken)
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,wait,status} from './director-e2e-harness.mjs';
const {base,page,errors,close}=await openDirectorBrowser();
const set=async(name,v)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`[name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);await wait(1500);};
const pivots=()=>page.evaluate(()=>{const it=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active.objects.get('accessory-keyboard-tray'),o={};it.obj.traverse(n=>{if(/^Tray_(Slide|Swing|Tilt|BaseTilt|SurfaceTilt)$/.test(n.name))o[n.name]=[...n.position.toArray(),...n.quaternion.toArray()];});return o;});
try{
  await openChapter(page,base,chapterList().find(c=>c.id==='awaken'));
  await page.evaluate(()=>document.querySelector('[data-inspector-tab="tray"]')?.click());await wait(400);
  await page.evaluate(()=>document.querySelector('[data-action="tr-enter"]')?.click());await wait(600);
  await set('tr-slide-n',1);const a=await pivots();assert.ok(a.Tray_Slide,'the jointed tray is loaded (Tray_Slide exists): '+await status(page)+' '+errors.join('|'));
  await set('tr-slide-n',40);const b=await pivots();assert.notDeepEqual(b.Tray_Slide,a.Tray_Slide,'slide moves the carriage');
  await set('tr-tilt-n',10);const c=await pivots();assert.notDeepEqual(c.Tray_SurfaceTilt,b.Tray_SurfaceTilt,'surface tilt turns the plate (on the arm front bolt)');
  await set('tr-swing-n',15);const d=await pivots();assert.notDeepEqual(d.Tray_Swing,c.Tray_Swing,'swing turns the plate');
  await set('tr-slide-n',90);
  const msg=await page.evaluate(()=>document.querySelector('[data-tray-joint="slide"]')?.innerText||'');
  assert.match(msg,/keyed 90 %/);assert.match(msg,/does not fit under the desk|held to/,'a limit is said in words: '+msg);
  assert.match(await status(page),/held at 45 %/,'the status line names the limit too: '+await status(page));
  // jog (the Key buttons and K) and the saved poses
  const seek=async t=>{await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},t);await wait(700);};
  const click=async sel=>{await page.evaluate(q=>document.querySelector(q)?.click(),sel);await wait(700);};
  const at=()=>page.evaluate(()=>Number(document.querySelector('[data-tray-at]')?.textContent));
  const keys=()=>page.evaluate(()=>document.querySelectorAll('[data-tray-key-row] [data-tray-key]').length);
  await click('[data-action="tr-reset"]');await click('[data-action="tr-auto"]');
  await seek(1);await set('tr-tilt-n',5);await seek(3);await set('tr-tilt-n',-5);await seek(0);
  assert.equal(await keys(),2);
  await click('[data-action="tr-key-next"]');assert.equal(await at(),1,'Key > jumps to the first key');
  await click('[data-action="tr-key-next"]');assert.equal(await at(),3,'Key > jumps to the next key');
  await click('[data-action="tr-key-prev"]');assert.equal(await at(),1,'< Key jumps back');
  await seek(2);await page.evaluate(()=>document.activeElement?.blur?.());await page.keyboard.press('k');await wait(700);
  assert.equal(await keys(),3,'K keys every joint at the playhead');
  await page.evaluate(()=>{const e=document.querySelector('[name="tr-pose-name"]');e.value='Typing';e.dispatchEvent(new Event('change',{bubbles:true}));});await click('[data-action="tr-save"]');
  assert.match(await page.evaluate(()=>document.querySelector('.tray-saved')?.innerText||''),/Typing/);
  await set('tr-tilt-n',9);await click('[data-action="tr-apply"]');
  const tilt=await page.evaluate(()=>document.querySelector('[name="tr-tilt-n"]').value);assert.equal(Number(tilt),0,'applying the saved pose sets its tilt back (the pose was keyed at tilt 0 ... K keyed the tray as it was at 2 s)');
  await click('[data-action="tr-forget"]');assert.equal(await page.evaluate(()=>document.querySelectorAll('.tray-saved li').length),0,'forgotten');
  // K3 (25 Nov 2026): with the desk tilted past 9 deg (chapter 1 from about 20.4 s) the keyboard is UP on the desk's shelf: the tray takes a full
  // slide with no limit and no warning, and the keyboard STAYS on the shelf while the tray moves (it used to reappear on the plate).
  const kb=()=>page.evaluate(()=>{const d=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active,it=[...d.objects].find(([id])=>/keyboard/.test(id)&&!/tray/.test(id))?.[1];if(!it)return null;it.obj.updateWorldMatrix(true,false);const e=it.obj.matrixWorld.elements;return {parent:it.obj.parent?.name,stow:it.autoStow?.role||null,p:[e[12],e[13],e[14]]};});
  const plateY=()=>page.evaluate(()=>{const o=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active.objects.get('accessory-keyboard-tray').obj.getObjectByName('Tray_Plate');o.updateWorldMatrix(true,false);return o.matrixWorld.elements[13];});
  if(await page.evaluate(()=>document.querySelector('[data-action="tr-auto"]')?.getAttribute('aria-pressed'))!=='true')await click('[data-action="tr-auto"]');
  await seek(23);await set('tr-slide-n',100);
  const up=await page.evaluate(()=>document.querySelector('[data-tray-joint="slide"]')?.innerText||'');
  assert.ok(!/held|does not fit/.test(up),'riders on the shelf: the tray takes 100 % with no limit: '+up);assert.ok(!/held at/.test(await status(page)),'no "held" in the status: '+await status(page));
  assert.match(await page.evaluate(()=>document.querySelector('[data-tray-riders]')?.innerText||''),/on the desk.s shelf here/,'the panel says why');
  for(const t of [23,24,25,26]){await seek(t);const k=await kb();assert.equal(k.stow,'lower-shelf',`the keyboard is stowed at ${t}`);assert.ok(k.p[1]>await plateY()+0.25,`and it stays UP on the shelf at ${t} s, not on the tray: keyboard y ${k.p[1].toFixed(3)}, plate y ${(await plateY()).toFixed(3)}`);}
  // K4: the hand-off is a carry, not a pop: between 20.4 and 20.8 s the keyboard is part way, and above the desk
  const t0=await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.riderHandoff.timeline()?.events?.[0]?.t);assert.ok(t0>20&&t0<21,'the desk sends them up at about 20.4 s: '+t0);
  await seek(t0-0.05);const k0=(await kb()).p;await seek(t0+0.6);const k1=(await kb()).p;await seek(t0+0.2);const mid=(await kb()).p;
  const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]),whole=dist(k0,k1);
  assert.ok(whole>0.3,'it goes somewhere: '+whole.toFixed(3));assert.ok(dist(k0,mid)>0.15*whole&&dist(mid,k1)>0.15*whole,`half way through the carry it is between the tray and the shelf (${dist(k0,mid).toFixed(3)} / ${dist(mid,k1).toFixed(3)} of ${whole.toFixed(3)})`);
  // K1: Base tilt and Level the platform on the real rig: the arm turns on the rear bolt, the button levels the platform again
  // the platform's angle against the swing frame (the track's axes after the swing): at rest that is the plate node's own local rotation = level
  const plateQ=()=>page.evaluate(()=>{const it=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active.objects.get('accessory-keyboard-tray').obj,pl=it.getObjectByName('Tray_Plate'),sw=it.getObjectByName('Tray_Swing'),q=pl.getWorldQuaternion(pl.quaternion.clone()),t=sw.getWorldQuaternion(pl.quaternion.clone());return t.invert().multiply(q).toArray();});
  const levelQ=await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active.objects.get('accessory-keyboard-tray').obj.getObjectByName('Tray_Plate').quaternion.toArray());
  const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3])))*180/Math.PI;
  await seek(8);const q0=await plateQ();const base0=(await pivots()).Tray_BaseTilt;assert.ok(base0,'the runtime base-tilt pivot exists');
  await set('tr-baseTilt-n',-20);const q1=await plateQ();assert.ok(angle(q0,q1)>5&&angle(q0,q1)<15.5,'base tilt -20 tilts the platform with the arm (the platform is held within 15 deg of level): '+angle(q0,q1).toFixed(1));
  await click('[data-action="tr-level"]');const q2=await plateQ();assert.ok(angle(levelQ,q2)<0.5,'Level the platform: level ('+angle(levelQ,q2).toFixed(2)+' deg off)');
  assert.match(await status(page),/platform levelled/);assert.match(await page.evaluate(()=>document.querySelector('[data-tray-joint="tilt"] [name="tr-tilt-n"]')?.value||''),/^20$/);
  console.log('PASS Director Tray: slide, tilt and swing move the jointed tray on the live stage; a limit is named under the slider; with the desk tilted the keyboard stays on the shelf and the tray is free; the hand-off is a carry; Base tilt turns the arm and Level the platform levels it.');
}catch(e){console.error('FAIL',e.message);process.exitCode=1;}finally{await close();}
