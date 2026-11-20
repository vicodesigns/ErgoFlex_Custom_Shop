import {sampleClipMotion} from './desk-clips.mjs';
import {sampleDeskTracks,tracksFromPoses} from './desk-track.mjs';
import {sampleCamera,resolveCameraKeys} from './camera-track.mjs';
import * as THREE from 'three';
import { MediaScreen } from '../app-reference/assets/desk_viewer/env/media-screen.mjs';
import { ease } from './score.mjs';
import { accessory } from '../catalog.mjs';
import { SHARED_BUILD_PRESETS } from '../preset-defaults.mjs';
import { OPENING_VIEWS } from './opening.mjs';
import {cleanPose,cleanCamera,defaultPreset} from './cuts.mjs';
import {cameraFollows,poseOf,putPose} from './editing-camera.mjs';
import {createDeskChoreo,roomDesks} from './desk-choreo.mjs';
import {touchscreenAt} from './touchscreen-track.mjs';
import {cleanSonar,pingRows,fullSec,meshesFor} from './sonar.mjs';

// This adapter exists only in a disposable, memory-backed preview iframe.
export async function mountStage(ctx) {
  // hold(): keep showing the last drawn frame (no render loop) while the Director re-applies film layers, so the
  // view never shows a half-dressed room. Pause requests made meanwhile are kept and applied on release.
  const rawPause=ctx.pause.bind(ctx);let held=0,wantPause=false,sleeping=false,sleepTimer=0;
  ctx.pause=on=>{wantPause=!!on;if(!held&&!(sleeping&&!on))rawPause(on);if(!on)wake();};
  const hold=on=>{if(on){if(!held++)rawPause(true);}else if(held&&!--held)rawPause(wantPause||sleeping);};
  // Render on demand while editing: after 800 ms with no input, seek, edit or film-fx change the loop stops
  // (the last frame stays); wake() restarts it. Playback, bakes and preparing never sleep.
  function wake(ms=800){
    if(sleeping){sleeping=false;if(!held&&!wantPause)rawPause(false);}
    clearTimeout(sleepTimer);sleepTimer=setTimeout(()=>{if(editorMode&&paused&&!held&&!preparing&&!window.__ERGO_BAKING__&&!wantPause){sleeping=true;rawPause(true);}},ms);
  }
  for(const type of ['pointerdown','pointermove','wheel','keydown'])addEventListener(type,()=>wake(),{capture:true,passive:true});
  if (!window.__ERGO_PRESENTATION__) return;
  const api = window.ErgoFlex;
  // Every room desk's own lift / tilt clips (shot.deskEdits, desk-choreo.mjs), sampled with the chapter clock.
  const deskChoreo = createDeskChoreo(api);
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wait = async predicate => {
    const deadline = performance.now() + 120000;
    while (!predicate()) { if(performance.now() > deadline) throw new Error('The 3D desk could not finish loading.'); await new Promise(r=>setTimeout(r,100)); }
  };
  await wait(()=>ctx.loadedModel && api.sceneTour && ctx.camera && api.workspaceRoom && api.workspaceAccessories && api.sceneDesks?.active);
  await api.presetReady;
  api.sceneTour.setFull(true,false);
  const style=document.createElement('style');
  // The viewer fills this frame exactly. Under 1050 px wide (Director Mode's 16:9 frame on most screens) the shop's
  // narrow-layout rule (portal-ui.css: #viewer-shell 780 px tall, 12 px down) outranks scene-tour's full screen, so
  // the canvas was taller than the frame and the frame showed only its top: never the film's framing.
  style.textContent='html[data-portal-page=shop] body>header.portal-header,#scene-tour,#motion-dock,.scene-tour-full button,.scene-tour-full [role="status"]{display:none!important}html[data-portal-page=shop] body #viewer-shell.scene-tour-full{top:0!important}'
    +'html[data-portal-page=shop] body.shell-layout #viewer-shell.scene-tour-full{top:0!important;margin:0!important;height:100vh!important;height:100dvh!important;min-height:0!important}body{background:#050a10!important}';
  document.head.append(style);
  ctx.controls.enabled=false;
  ctx.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  function previewQuality(low){ctx.renderer.setPixelRatio(low ? Math.min(devicePixelRatio,0.5) : Math.min(devicePixelRatio,1.5));wake();}
  const extras = new THREE.Group(); extras.name='Cinematic effects'; ctx.scene.add(extras);
  const ringAt = new THREE.Vector3();
  // Where the shelf centre is now: its place in the desk's frame, carried by the desk's current transform (roll and turn).
  const ringCentre=()=>{ctx.loadedModel.updateWorldMatrix(true,false);ringAt.copy(ringHome.local).applyMatrix4(ctx.loadedModel.matrixWorld);return sonarCfg&&(sonarCfg.x||sonarCfg.z)?ringAt.add(sonarShift()):ringAt;};
  // The Director's sonar (sonar.mjs; absent: none of this runs): its centre's offset from the desk's, in inches on the stage's
  // axes as they were at the start, turned with the desk since (ringHome.q); and its preview at full (the Director's, never in a shot).
  let sonarCfg=null,previewFull=false;const shiftAt=new THREE.Vector3(),qRel=new THREE.Quaternion();
  const unitsPerInch=()=>{const m=api.arSize?.metersPerUnit;return m>0?.0254/m:(reach?.userData.w||1)/(Number(String(shot?.size||'60x30').split('x')[0])||60);};
  const turnOf=()=>{ctx.loadedModel.updateWorldMatrix(true,false);return qRel.copy(ctx.loadedModel.getWorldQuaternion(new THREE.Quaternion())).multiply(ringHome.q.clone().invert());};
  const sonarShift=()=>{const u=unitsPerInch();return shiftAt.set((sonarCfg.x||0)*u,0,(sonarCfg.z||0)*u).applyQuaternion(turnOf()).setY(0);};
  let shot=null, start=null, media=null, video=null, hidden=[], grid=null, pylons=[], sweep=null, light=null, pulse=null, floorCenter=null, trace=null, ringHome=null, reach=null, sonar=null, sonarTries=0, pings=[], obstacles=[], pingStop=0, echo=null, pingBase=null;
  let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused=false, sounds=false, mirror=null, sequence=-1, session=null, preparing=false,lastProgress=0;
  let readProgress=()=>0,deskSpan=1,lastMediaColour=0;
  let editorMode=false,authoredCamera=null,defaultCameraKeys=[],activeCameraKeys=[],cameraBake=null;
  // Film chapters (player.mjs filmCameraBake): the stage plays the film's own camera, the Director keys baked through the
  // film's cameraPlan (holds, spline, timing) exactly as the still renderer and the 4K get them. cameraKeys() stays the
  // editable keys.
  function resolveActive(){
    const keys=resolveCameraKeys(shot?.camera,defaultCameraKeys);activeCameraKeys=keys;
    if(cameraBake&&keys.length)try{activeCameraKeys=cameraBake(keys,shot.seconds);}catch(error){console.warn('[stage] film camera',error.message);}
  }
  const cameraPosition=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),cameraEndPosition=new THREE.Vector3(),cameraEndTarget=new THREE.Vector3();
  const focus=new THREE.Vector3(),offset=new THREE.Vector3();
  const intervals=[];let lastRendered=0;
  const shownInScene=obj=>{for(let p=obj;p;p=p.parent){if(!p.visible)return false;if(p===ctx.scene)return true;}return false;};
  const box=()=>new THREE.Box3().setFromObject(ctx.loadedModel);
  function clear() {
    api.haltAllMotion(); api.ledMusicMode?.stop();
    if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
    for(const [o,visible,mask] of hidden){o.visible=visible;o.layers.mask=mask;} hidden=[];
    extras.traverse(o=>{o.geometry?.dispose(); if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});
    extras.clear(); media=null;grid=null;pylons=[];sweep=null;light=null;pulse=null;trace=null;reach=null;sonar=null;sonarTries=0;pings=[];obstacles=[];pingStop=0;echo=null;pingBase=null;previewFull=false;sonarCfg=null;
  }
  function frame(targetBox, wide=false) {
    const center=targetBox.getCenter(new THREE.Vector3()), size=targetBox.getSize(new THREE.Vector3());
    const span=Math.max(size.x,size.z,size.y*1.1);
    const vertical=ctx.camera.fov*Math.PI/180;
    const distance=span / (2*Math.tan(vertical/2)) / Math.min(1,ctx.camera.aspect) * (wide? 1.06:1.12);
    return {center, distance, aspect:ctx.camera.aspect, angle:wide?.66:.85, height:wide?.85:.42};
  }
  // The Director's Editing camera (editing-camera.mjs): the camera stays where the user put it; a bake still films the keys.
  function cam(t) {
    if(!start||editorMode||!cameraFollows({held:cameraHeld,baking:!!bakeSession}))return;
    if((shot?.camera||cameraBake)&&authoredCamera){
      const view=sampleCamera(activeCameraKeys,t);if(!view)return;
      cameraPosition.fromArray(view.position);cameraTarget.fromArray(view.target);
      cameraPosition.sub(cameraTarget).multiplyScalar(Math.min(1,view.aspect)/Math.min(1,ctx.camera.aspect)).add(cameraTarget);
      ctx.camera.position.copy(cameraPosition);ctx.controls.target.copy(cameraTarget);ctx.camera.lookAt(cameraTarget);
      ctx.camera.fov=view.fov;ctx.camera.updateProjectionMatrix();return;
    }
    const angle=start.angle+(reduced?0:(ease(t)-.5)*.20);
    focus.copy(start.center);let height=start.height,distance=start.distance*Math.min(1,start.aspect)/Math.min(1,ctx.camera.aspect);
    if(shot?.kind==='glide'&&!reduced&&floorCenter){const v=ease(t/.6);focus.lerp(floorCenter,1-v);height=.12+v*.3;distance*=.52+.48*v;}
    ctx.camera.position.copy(focus).add(offset.set(Math.cos(angle),height,Math.sin(angle)).normalize().multiplyScalar(distance));
    ctx.camera.lookAt(focus);ctx.controls.target.copy(focus);
  }
  // The stage's floor rings (pulse, sweep, reach) are drawn after the film's floor overlays: the product rig's contact
  // shadow (renderOrder 2), the LED floor tint (a multiply, 2.5) and the LED floor bounce / foot glow / floor light (3).
  // Drawn before them (renderOrder 0, as until 2026-11-14) a ring was darkened under the desk and took the LED's hue
  // (yellow, red, near black) wherever the floor pool lay: an uneven ring under a flat fill. The LED light is unchanged.
  const RING_ORDER=4;
  const ringMesh=(geometry,color,opacity,y)=>{const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=y;m.renderOrder=RING_ORDER;extras.add(m);return m;};
  // The centre the rings start from is the centre of the desk's bottom shelf: the base shelf that carries the floor
  // light, the whole shelf (Vico, 2026-11-14). It was the centre of the model's whole box, which also holds the film's
  // LED helper planes and the desktop's overhang, so the rings sat about 24 cm in front of the shelf's centre. The shelf
  // is the base panel with the largest footprint (the side and back panels are thin slabs); a desk without one falls
  // back to the box centre.
  function deskCentre(fallback) {
    const model=ctx.loadedModel,one=new THREE.Box3();let best=null,area=0;model.updateWorldMatrix(true,true);
    model.traverse(o=>{
      if(!o.isMesh||!o.geometry||!/^Base_Panels(_\d+)?$/.test(o.name||''))return;
      one.setFromObject(o);if(one.isEmpty())return;
      const a=(one.max.x-one.min.x)*(one.max.z-one.min.z);if(a>area){area=a;best=one.clone();}
    });
    return best?new THREE.Vector3((best.min.x+best.max.x)/2,fallback.y,(best.min.z+best.max.z)/2):fallback;
  }
  // One thin ring at radius r (the band keeps its width at any radius: a scaled ring would thicken as it grows).
  const setRing=(m,r,band)=>{const p=m.geometry.attributes.position,n=p.count/2,a=Math.max(0,r-band/2),b=r+band/2;for(let i=0;i<n;i++){const t=i/(n-1)*Math.PI*2,cs=Math.cos(t),sn=Math.sin(t);p.setXY(i,a*cs,a*sn);p.setXY(i+n,b*cs,b*sn);}p.needsUpdate=true;};
  function stageFloor() {
    const b=box(),sz=b.getSize(new THREE.Vector3()),w=Math.max(sz.x,sz.z),c=deskCentre(b.getCenter(new THREE.Vector3()));
    grid=new THREE.GridHelper(w*7,48,0x1c9cdf,0x173648);grid.position.set(c.x,b.min.y-.002,c.z);extras.add(grid);
    floorCenter=new THREE.Vector3(c.x,b.min.y+sz.y*.12,c.z);
    // One pulse ring per stage. The proximity chapter builds its floor a second time (prepare's product floor, then
    // proximity()): the first pulse was left behind as a second ring that neither moved nor followed the desk, so it
    // lay on the moving pulse (a doubled ring) and stayed where the desk started once it rolled (an off-centre ring).
    if(pulse){pulse.removeFromParent();pulse.geometry.dispose();pulse.material.dispose();}
    pulse=ringMesh(new THREE.RingGeometry(w*.5,w*.51,96),0x27c6ff,.8,b.min.y+.003);pulse.position.x=c.x;pulse.position.z=c.z;
    // The rings are the desk's: they stay centred under it when it rolls (ringHome: the centre and the desk's place at the start).
    // The shelf centre is kept in the desk's own frame (local), so it follows a roll AND a turn: the rings were moved by the
    // desk origin's displacement alone, which is the shelf centre's only when the desk is not turned; turning 100 degrees
    // (the awaken chapter, 25.6 s) swung the circle to another part of the floor (Vico, Nov 16: "travels to some random location").
    ctx.loadedModel.updateWorldMatrix(true,false);
    ringHome={c:c.clone(),p:ctx.loadedModel.getWorldPosition(new THREE.Vector3()),local:ctx.loadedModel.worldToLocal(c.clone()),q:ctx.loadedModel.getWorldQuaternion(new THREE.Quaternion())};
    light=new THREE.PointLight(0x46ceff,w*2,w*5,2);light.position.set(c.x+w,b.min.y+w,c.z+w);extras.add(light);
    ctx.scene.background=new THREE.Color('#050a10');
    return {b,w,c};
  }
  // The sonar's reach is the distance from the desk's centre to the nearest obstacle's near edge once the desk has come
  // to rest (measured with the desk put at the shot's last pose; the caller places it for the frame afterwards). So the
  // outer ring touches the obstacle exactly when the desk stops, wherever the obstacle or the desk's path was moved to,
  // and the pulses run from the desk's footprint out to it. No film obstacle (the showcase's own pylons): the fixed rings.
  function sonarReach() {
    let scene=ctx.loadedModel;while(scene.parent)scene=scene.parent;const found=[];scene.traverse(o=>{if(o.name==='Film obstacle')found.push(o);});
    if(!found.length||!ringHome)return null;
    if(shot.motion?.clips)ctx.placeDirector(sampleClipMotion(shot.motion,shot.seconds));
    scene.updateMatrixWorld(true);
    const at=ringCentre(),cx=at.x,cz=at.z,b=new THREE.Box3();let best=Infinity;
    obstacles=[];
    for(const o of found){b.setFromObject(o);if(b.isEmpty())continue;obstacles.push(b.clone());best=Math.min(best,Math.hypot(Math.max(b.min.x-cx,0,cx-b.max.x),Math.max(b.min.z-cz,0,cz-b.max.z)));}
    return Number.isFinite(best)&&best>0?best:null;
  }
  // One ping mesh (the film's seven; more when the Director asks for more rings than the film's three: sonar.mjs meshesFor).
  const makePing=i=>{const {w,y,c}=pingBase,m=ringMesh(new THREE.RingGeometry(w*.5,w*.51,128),0x45d2ff,0,y+.006+i*.0005);m.position.x=c.x;m.position.z=c.z;m.frustumCulled=false;m.visible=false;m.name='Stage sonar ping';return m;};
  function proximity() {
    const {b,w,c}=stageFloor();
    for(const [x,z] of [[-1.2,.45],[.95,-.7],[.5,1.15]]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(w*.055,w*.065,w*.64,16),new THREE.MeshStandardMaterial({color:0x163344,metalness:.6,roughness:.3,emissive:0x0873a4,emissiveIntensity:.6}));
      p.position.set(c.x+x*w,b.min.y+w*.32,c.z+z*w);p.userData.y=p.position.y;extras.add(p);pylons.push(p);
    }
    // The sweep is an arc of the reach ring itself: the same band (radii and width) on the same scale, so it brightens
    // the ring as it turns. It was a wider band (w*.8-.82, scaled by sonar/(w*.81)) over the reach (w*.8-.812, scaled by
    // sonar/(w*.806)), which drew two rings a band-width apart wherever the arc passed.
    sweep=ringMesh(new THREE.RingGeometry(w*.8,w*.812,96,1,0,Math.PI*.65),0x62dbff,.65,b.min.y+.01);sweep.position.x=c.x;sweep.position.z=c.z;
    // The sonar's reach: a whole circle under the sweep, shown once the reach is known (sonarReach).
    reach=ringMesh(new THREE.RingGeometry(w*.8,w*.812,128),0x62dbff,.42,b.min.y+.008);reach.position.x=c.x;reach.position.z=c.z;reach.visible=false;reach.userData.w=w;
    // The film's sonar (a film obstacle on the stage): three pings alive at once, each a thin ring that leaves the desk's
    // centre and runs out to the obstacle's near edge as it is in that frame, like a submarine's sonar: one wide, one
    // halfway, one just leaving. They replace the standing outer ring and its turning arc, which never pulsed (Vico,
    // 2026-11-14). A ping arrives at the obstacle exactly when the desk stops (pingStop: the end of the last roll).
    pingBase={w,y:b.min.y,c:c.clone()};sonarCfg=shot?.sonar?cleanSonar(shot.sonar):null;
    pings=Array.from({length:meshesFor(sonarCfg)},(_,i)=>makePing(i));
    echo=ringMesh(new THREE.RingGeometry(w*.5,w*.51,128),0x7fe3ff,0,b.min.y+.0085);echo.position.x=c.x;echo.position.z=c.z;echo.frustumCulled=false;echo.visible=false;echo.name='Stage sonar echo';
    pingStop=Math.max(0,...(shot?.motion?.clips||[]).filter(k=>k.lane==='wheels').map(k=>k.start+k.duration));
    start=frame(b,false);start.distance=w*3.8/Math.min(1,ctx.camera.aspect);start.center.copy(c);start.height=.9;
  }
  async function mediaScreen() {
    // Reuse the polished app's actual curved screen and centred-fill video renderer.
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    const candidates=[];ctx.scene.updateMatrixWorld(true);ctx.scene.traverse(o=>{if(accessory(o.userData.accessoryId)?.visual==='monitor'&&visible(o))candidates.push(o);});
    const b=box(),sz=b.getSize(new THREE.Vector3()),w=Math.max(sz.x,sz.z);
    const primary=candidates.find(o=>o.userData.accessoryId==='wide-monitor')||candidates[0];
    const displayBox=primary?new THREE.Box3().setFromObject(primary):b;
    const center=displayBox.getCenter(new THREE.Vector3()),extent=displayBox.getSize(new THREE.Vector3());
    media=new MediaScreen({x:0,y:0,z:0},{curved:true});
    const scale=primary?Math.max(extent.x,extent.z)/media.size.w:w/60;
    media.group.scale.setScalar(scale);media.group.rotation.y=Math.PI/2;
    media.group.position.set(center.x,center.y-media.centreY*scale,center.z);
    extras.add(media.group);
    ctx.scene.traverse(o=>{if(o.userData.accessoryId?.startsWith('monitor-arm')&&visible(o))candidates.push(o);});
    for(const o of candidates)o.traverse(child=>{hidden.push([child,child.visible,child.layers.mask]);child.layers.disableAll();});
    video=document.createElement('video');video.src='../app-reference/assets/desk_viewer/media/ambient-clip.mp4';video.loop=true;video.muted=true;video.playsInline=true;video.preload='auto';
    await video.play();media.show(video);media.update(performance.now());
    start=frame(b);start.angle=.3;start.height=.25;start.distance*=.9;
  }
  async function prepare(next) {
    // Scene construction and shader compilation happen behind the outgoing
    // frame. No render loop competes with them while the room is rebuilt.
    ctx.pause(true);
    editorMode=false;ctx.editCamera(false);authoredCamera=null;activeCameraKeys=[];defaultCameraKeys=[];ctx.camera.fov=35;ctx.camera.updateProjectionMatrix();
    clear();shot={...next,camera:null};mirror=null;sequence=-1;session=null;ctx.scene.background=null;
    if(!ctx.catalog().some(r=>r.id===next.room))throw Error('This environment is unavailable. Choose another scene.');
    const preset=next.preset||({create:'artist',commons:'library',storage:'library',coast:'occ',oilers:'hbhs',music:'gaming',rise:'office',awaken:'gaming',hero:'gaming',media:'office',awareness:'gaming',wellness:'office'}[next.id])||defaultPreset(next.room,next.kind);
    if(preset)await api.applyPreset({id:preset},next.size?{size:next.size}:{});
    // The opening wheel demonstration uses the ergonomic input setup. Keep
    // this override inside the isolated presentation, leaving Gaming saved builds intact.
    if(next.room==='product'&&next.kind==='glide'&&api.currentConfig.accessories.includes('mechanical-keyboard')){
      api.toggleAccessory('ergo-keyboard');
      await api.workspaceAccessories.ready;await api.sceneDesks.objects.ready;
      api.sceneDesks.objects.syncAccessories();
      const objects=api.sceneDesks.active.objects,tray=objects.get('accessory-keyboard-tray');
      const reference=SHARED_BUILD_PRESETS.office.room.desks.main.objects;
      const matrix=t=>new THREE.Matrix4().compose(new THREE.Vector3(t.p.x,t.p.y,t.p.z),new THREE.Quaternion(t.q.x,t.q.y,t.q.z,t.q.w),new THREE.Vector3(t.s.x,t.s.y,t.s.z));
      const placement=matrix(reference['accessory-ergo-keyboard'].transform);
      if(tray){
        tray.obj.updateMatrix();
        placement.premultiply(matrix(reference['accessory-keyboard-tray'].transform).invert()).premultiply(tray.obj.matrix);
      }
      const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
      placement.decompose(position,rotation,scale);const angles=new THREE.Euler().setFromQuaternion(rotation);
      api.sceneDesks.objects.select('accessory-ergo-keyboard');
      api.sceneDesks.objects.change({x:position.x,y:position.y,z:position.z,rotation:THREE.MathUtils.radToDeg(angles.y),tilt:THREE.MathUtils.radToDeg(angles.x),roll:THREE.MathUtils.radToDeg(angles.z),scale:scale.x*100});
      api.sceneDesks.objects.select(null);
    }
    // Chapter 1 (awaken): the OBSBOT Tiny 2 webcam on top of the monitor, centred (Vico, Nov 16). Same pattern as the
    // keyboard above: a presentation-only override that leaves the Gaming preset and its saved builds alone. The camera
    // starts on the top shelf like the monitor (both are shelf accessories), so it is moved by the monitor's own top: the
    // monitor's highest vertices (its panel, not its foot) give the centre; the camera's bottom-centre goes there.
    if(next.id==='awaken'&&next.room==='product'&&api.currentConfig.accessories.includes('wide-monitor')&&!api.currentConfig.accessories.includes('obsbot-tiny-2')){
      try{
      api.toggleAccessory('obsbot-tiny-2');
      await api.workspaceAccessories.ready;await api.sceneDesks.objects.ready;
      api.sceneDesks.objects.syncAccessories();
      const objects=api.sceneDesks.active.objects,mon=objects.get('accessory-wide-monitor')?.obj,cam=objects.get('accessory-obsbot-tiny-2')?.obj;
      if(mon&&cam&&cam.parent){
        ctx.scene.updateMatrixWorld(true);
        const whole=new THREE.Box3().setFromObject(mon),top=new THREE.Box3(),v=new THREE.Vector3(),cut=whole.max.y-(whole.max.y-whole.min.y)*.04;
        mon.traverse(o=>{const p=o.isMesh&&o.geometry?.attributes?.position;if(!p)return;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>=cut)top.expandByPoint(v);}});
        const cb=new THREE.Box3().setFromObject(cam);
        if(!whole.isEmpty()&&!top.isEmpty()&&!cb.isEmpty()){
          const target=new THREE.Vector3((top.min.x+top.max.x)/2,whole.max.y,(top.min.z+top.max.z)/2),foot=new THREE.Vector3((cb.min.x+cb.max.x)/2,cb.min.y,(cb.min.z+cb.max.z)/2);
          const at=cam.getWorldPosition(new THREE.Vector3()),local=cam.parent.worldToLocal(at.clone().add(target).sub(foot));
          api.sceneDesks.objects.select('accessory-obsbot-tiny-2');
          api.sceneDesks.objects.change({x:local.x,y:local.y,z:local.z});
          api.sceneDesks.objects.select(null);
        }
      }
      }catch(error){console.warn('[stage] webcam on the monitor skipped:',error?.message||error);}
    }
    const recipe=ctx.captureRecipe();
    api.setTilt('tilting',0);api.setHeight(next.kind==='tilt'?43.5:30);
    // The chapter's room look (room-looks.mjs; absent = the room's default), for the room load just below.
    api.setRoomLook?.(next.room,next.look??null);
    if(next.layout){ctx.clearRoomRecipe(next.room,next.layout);api.setMeasuredRoomLayout(next.room,next.layout,{defaultDesktop:false});}
    else await api.setRoomScene(next.room,false,{preserveDesk:true});
    await api.workspaceRoom?.ready;
    await api.presetReady;await api.workspaceAccessories?.ready;await api.sceneDesks?.objects?.ready;await nextFrame();await nextFrame();
    if(next.preset||['lift','tilt','wellness','music','media'].includes(next.kind))await ctx.installRecipe(recipe,next.size);
    ctx.pose(next.kind==='tilt'?43.5:30,0);
    // (a desk version, a sub-shot of the film or the Director's: every desk at the product origin, so a swap keeps the place)
    if(next.room==='product')ctx.resetProductOrigin(preset+':'+(next.size||'60x30'),typeof next.subshot==='string'?{x:0,z:0,yaw:0}:null);
    api.workspaceRoom?.setCeilingEnabled(false);
    // People in the room (room-people.mjs): shot.people is true, or { only: [ids], except: [ids] }. Off unless the shot asks.
    await api.setRoomPeople?.(!!next.people,next.people&&typeof next.people==='object'?next.people:null);
    if(next.mode)api.setMeasuredRoomMode(next.room,next.mode,false);
    if(['music','media'].includes(next.kind))api.setMeasuredRoomMode(next.room,'night',false);
    ctx.controls.enabled=false;api.haltAllMotion();
    let target=box();
    const root=api.workspaceRoom?.root;
    if(next.room!=='product' && root && ['group','room','storage'].includes(next.kind))target=new THREE.Box3().setFromObject(root);
    start=frame(target,['group','room','storage'].includes(next.kind));
    if(next.room==='product')stageFloor();
    api.setLedsEnabled(true);api.setLedColor('#47cfff',false);api.setLedGlow(api.ledFullBrightness*.35,false);
    api.setLedEffect({mode:next.kind==='music'?'spectrum':'solid',period:6},false);
    if(next.kind==='proximity')proximity();
    if(next.kind==='lift'||next.kind==='tilt'){
      const b=box(),s=b.getSize(new THREE.Vector3()),w=Math.max(s.x,s.z),points=[];
      for(let i=0;i<50;i++)points.push(new THREE.Vector3(b.max.x+w*.05,b.min.y+s.y*(.3+i/100),b.max.z));
      trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x71e2ff,transparent:true,opacity:.5}));extras.add(trace);
    }
    if(next.kind==='media')await mediaScreen();
    if(next.kind==='music' && sounds){api.ledMusicMode.setSound(true);await api.ledMusicMode.start();}
    if(next.kind==='group')await ctx.prepareRoute('party');
    if(next.kind==='storage'){api.setHeight(43.5);await ctx.prepareRoute('night');}
    deskSpan=box().getSize(new THREE.Vector3()).z;
    ctx.markAnchor();
    if(next.motion&&!next.camera&&(next.room==='product'||!['group','room','storage'].includes(next.kind))){
      const tracks=next.motion.tracks||tracksFromPoses(next.motion.from,next.motion.to),envelope=box();
      for(let i=0;i<=12;i++){const p=next.motion.clips?sampleClipMotion(next.motion,next.seconds*i/12):sampleDeskTracks(tracks,i/12);ctx.pose(p.height,p.tilt);ctx.placeDirector(p);envelope.union(box());}
      const p=next.motion.clips?sampleClipMotion(next.motion,0):sampleDeskTracks(tracks,0);ctx.pose(p.height,p.tilt);ctx.placeDirector(p);start=frame(envelope,false);
    }
    defaultCameraKeys=(next.kind==='glide'?[0,.3,.6,1]:[0,1]).map((time,i)=>{cam(time);return{id:'auto-camera-'+i,time,label:time===0?'Start view':time===1?'End view':'Movement view '+i,easing:'smooth',view:captureCamera()};});
    cam(0);authoredCamera=captureCamera();shot={...next,motion:next.motion?(next.motion.clips?next.motion:{tracks:next.motion.tracks||tracksFromPoses(next.motion.from,next.motion.to)}):undefined};resolveActive();cam(0);
    deskChoreo.restore();deskChoreo.set(next.deskEdits);
    // The onboard touchscreen posed from the chapter's clock (shot.touchscreen); a chapter without it hands the screen back.
    api.setFilmTouchscreen?.(touchscreenAt(next.touchscreen,0));
    await ctx.warm();await nextFrame();
    lastRendered=0;intervals.length=0;
    return {id:next.id,room:api.roomScene};
  }
  // The desk's height and tilt over the whole chapter, for the person at the desk (room-people-motion.mjs): they get
  // up, wait and sit down by where the desk is going, the same at every second however the film is scrubbed. One
  // object per track: a new one whenever the chapter, its length or its desk movement changes.
  let peopleTrack=null;
  function deskAt(seconds){
    const t=shot.seconds>0?Math.min(1,Math.max(0,seconds/shot.seconds)):0,u=ease(t),kind=shot.kind;
    if(shot.motion)return shot.motion.clips?sampleClipMotion(shot.motion,t*shot.seconds):sampleDeskTracks(shot.motion.tracks,t);
    if(kind==='lift')return{height:28+15.5*u,tilt:0};
    if(kind==='tilt')return{height:43.5,tilt:65*u};
    if(kind==='storage')return{height:43.5,tilt:65*ease(t/.4)};
    if(kind==='wellness')return{height:28+15.5*ease((t-.25)/.45),tilt:0};
    const now=ctx.readDirector();return{height:now.height,tilt:now.tilt};
  }
  function deskTrack(){
    let sign=shot.seconds+'';for(let i=0;i<=8;i++){const p=deskAt(shot.seconds*i/8);sign+='|'+(+p.height).toFixed(2)+','+(+p.tilt||0).toFixed(1);}
    if(!peopleTrack||peopleTrack.shot!==shot||peopleTrack.motion!==shot.motion||peopleTrack.sign!==sign)
      peopleTrack={shot,motion:shot.motion,sign,seconds:shot.seconds,heightAt:s=>deskAt(s).height,tiltAt:s=>deskAt(s).tilt||0};
    return peopleTrack;
  }
  function tick(t) {
    if(paused||!shot)return;
    lastProgress=t;
    if(reduced)t=1;
    const u=reduced?1:ease(t),kind=shot.kind;
    if(kind==='proximity'&&reach&&!sonar&&sonarTries++<240)sonar=sonarReach();
    if(pulse&&sonar&&pings.length){pulse.material.opacity=0;                 // the film's sonar: the pings below, once the desk is placed
    } else if(pulse&&sonar){
      // a pulse every 1.6 s from the desk's footprint out to the reach, fading in over its first .13 s (no ring popping
      // up at the footprint) and out as it goes
      const w=reach.userData.w,phase=(t*shot.seconds/1.6)%1,from=Math.min(w*.5,sonar*.6);
      pulse.scale.setScalar((from+(sonar-from)*phase)/(w*.5));pulse.material.opacity=reduced?0:.8*Math.min(1,phase/.08)*(1-phase)*(1-phase*.4);
    } else if(pulse){pulse.scale.setScalar(1+t*5);pulse.material.opacity=reduced?0:Math.max(0,.85-t);}
    if(trace)trace.geometry.setDrawRange(0,Math.max(2,Math.round(50*u)));
    if(!shot.motion){
      if(kind==='lift')ctx.pose(28+15.5*u,0);
      if(kind==='tilt')ctx.pose(43.5,65*u);
      if(kind==='storage'){ctx.pose(43.5,65*ease(t/.4));ctx.route(ease((t-.35)/.65));}
      if(kind==='group')ctx.route(u);
      if(kind==='glide')ctx.demoMove(Math.sin(t*Math.PI)*deskSpan*.18,0,(u-.5)*.16);
    }
    if(kind==='proximity'){
      for(const p of pylons){p.scale.y=Math.max(.001,ease(t/.2));p.position.y=p.userData.y-(1-p.scale.y)*p.geometry.parameters.height/2;}
      sweep.rotation.z=t*Math.PI*8;
      if(sonar&&pings.length){sweep.visible=false;reach.visible=false;}
      else if(sonar){const w=reach.userData.w,k=sonar/(w*.806);sweep.scale.setScalar(k);reach.scale.setScalar(k);reach.visible=true;}
      if(t>.55&&!shot.motion)ctx.demoMove(ease((t-.55)/.2)*deskSpan*.16,0,0);
    }
    if(kind==='wellness'&&!shot.motion)ctx.pose(28+15.5*ease((t-.25)/.45),0);
    if(shot.motion){const p=shot.motion.clips?sampleClipMotion(shot.motion,t*shot.seconds):sampleDeskTracks(shot.motion.tracks,t);ctx.pose(p.height,p.tilt);ctx.placeDirector(p);}
    if(ringHome&&(pulse||sweep)){const d=ringCentre();for(const ring of [pulse,sweep,reach,echo,...pings])if(ring){ring.position.x=d.x;ring.position.z=d.z;}
      if(sonar&&pings.length){
        // the reach in this frame: from the desk's centre where it is now to the nearest obstacle's near edge
        const cx=d.x,cz=d.z;let far=Infinity;
        for(const o of obstacles)far=Math.min(far,Math.hypot(Math.max(o.min.x-cx,0,cx-o.max.x),Math.max(o.min.z-cz,0,cz-o.max.z)));
        if(!Number.isFinite(far)||far<=0)far=sonar;
        // A slow sonar: a ping leaves the centre every 2.4 s and runs outward at one steady speed (the speed that takes
        // 7.2 s to the obstacle where the desk comes to rest), and is gone the moment it reaches the obstacle's near edge
        // as it is in this frame. A ring's radius depends only on its age, so NO RING EVER SHRINKS while the desk rolls
        // toward the obstacle (they used to be drawn as a fraction of the shrinking distance, and the echo ring sat on
        // that distance all the time: "a fourth that starts big and gets a little small", Vico). One ping arrives
        // exactly as the desk stops (pingStop).
        // (sonar.mjs pingRows: the same loop as numbers, a ping's radius and opacity from its age. The Director's sonar, when
        // the chapter has one: its size is the reach and the rings run to it whatever the obstacle's place; rings per pulse
        // sets the gap, 7.2 s / rings; off hides them; Preview at full holds the moment all the rings are out.)
        const S=sonarCfg?.radius?sonarCfg.radius*unitsPerInch():sonar,hold=previewFull;
        if(sonarCfg?.radius||hold)far=S;
        const w=reach.userData.w,sec=hold?fullSec(pingStop,sonarCfg):t*shot.seconds,band=w*.007,off=sonarCfg?.enabled===false;
        const {rows,echoAge:arrived}=pingRows({sec,pingStop,S,far,count:pings.length,cfg:sonarCfg});let echoAge=hold?0:arrived;
        if(off)echoAge=Infinity;
        for(const row of rows){
          const ring=pings[row.i];
          if(off||!row.alive){ring.visible=false;ring.material.opacity=0;continue;}
          setRing(ring,row.r,band);ring.visible=!reduced;
          ring.material.opacity=reduced?0:row.a;                                            // in at the centre, still bright as it arrives
        }
        // The echo: a ping that reaches the obstacle lights a ring at the obstacle's edge for .7 s, then it is gone until
        // the next arrival, so the obstacle stands on the widest circle each time a ping lands and nothing lingers to shrink.
        if(echo){const k=echoAge<.7?Math.pow(1-echoAge/.7,1.6):0;setRing(echo,far,band*1.25);echo.visible=!reduced&&k>0;echo.material.opacity=reduced?0:.85*k;}
      }
    }
    if(deskChoreo.count())deskChoreo.apply(t*shot.seconds);
    if(shot.touchscreen)api.setFilmTouchscreen?.(touchscreenAt(shot.touchscreen,t*shot.seconds));
    if(shot.people)api.setRoomPeopleTime?.(t*shot.seconds,deskTrack());
    if(kind==='media'&&media){const now=performance.now(),updated=media.update(now);if(updated&&now-lastMediaColour>=100){lastMediaColour=now;try{const p=media.ctx2d.getImageData(Math.floor(media.canvas.width/2),Math.floor(media.canvas.height/2),1,1).data;api.setLedColor('#'+[p[0],p[1],p[2]].map(v=>Math.max(25,v).toString(16).padStart(2,'0')).join(''),false);}catch{}}}
    cam(t);
  }
  async function sound(on){sounds=on;if(shot?.kind==='music'){api.ledMusicMode.setSound(on);if(on)await api.ledMusicMode.start();else api.ledMusicMode.stop();}}
  function pause(on){paused=on;if(preparing)return;ctx.pause(on&&(!editorMode||document.hidden));if(video){if(on)video.pause();else video.play().catch(()=>{});}if(on)api.ledMusicMode?.pause();else if(shot?.kind==='music'&&sounds)api.ledMusicMode?.start();}
  function captureCamera(){return cleanCamera({position:ctx.camera.position.toArray(),target:ctx.controls.target.toArray(),fov:ctx.camera.fov,aspect:ctx.camera.aspect});}
  // Director orbit: none of the Studio's orbit limits (2 m minimum distance, camera above the target), or every frame's
  // controls.update() would pull a closer or lower film camera off its keys and the live view would not be the film's.
  function edit(on){wake();editorMode=!!on;if(!on)previewFull=false;   // (Preview at full is the editor's: playing or closing it ends it)
ctx.editCamera(editorMode||cameraHeld);if(editorMode){Object.assign(ctx.controls,{minDistance:.01,maxDistance:Infinity,minPolarAngle:0,maxPolarAngle:Math.PI});paused=true;ctx.pause(false);}else ctx.pause(paused);}
  // Run fn (a seek that re-poses the scene) without it moving the editor's camera.
  function keepView(fn){
    if(!editorMode)return fn();
    const c=ctx.camera,pos=c.position.clone(),target=ctx.controls.target.clone(),fov=c.fov,up=c.up.clone();
    try{return fn();}finally{c.position.copy(pos);c.up.copy(up);ctx.controls.target.copy(target);c.lookAt(target);c.fov=fov;c.updateProjectionMatrix();ctx.controls.update?.();}
  }
  function seek(t){wake();const was=paused,editing=editorMode;paused=false;editorMode=false;tick(Math.max(0,Math.min(1,t)));editorMode=editing;paused=was;if(!editing)ctx.pause(paused);}
  let bakeSession=null,cameraHeld=false,heldBeforeBake=null;
  // Editing camera on: playing, seeking and preparing leave the view alone, and orbit / pan / zoom work while playing too.
  // Off: the camera goes back on the keys at once, at the current time (a snap: the playhead's own view).
  function holdCamera(on){
    wake();const was=cameraHeld;cameraHeld=!!on;if(!bakeSession)ctx.editCamera(editorMode||cameraHeld);
    if(was&&!cameraHeld&&shot){const p=paused,e=editorMode;paused=false;editorMode=false;cam(lastProgress);editorMode=e;paused=p;}
    return cameraHeld;
  }
  function beginBake(width,height){
    if(bakeSession)throw Error('A bake is already running.');
    heldBeforeBake=cameraHeld?poseOf(ctx.camera,ctx.controls):null;bakeSession={paused,editorMode,videoTime:video?.currentTime||0};window.__ERGO_BAKING__=true;
    ctx.pause(true);editorMode=false;paused=true;ctx.editCamera(false);ctx.beginBake(width,height);if(video)video.pause();
  }
  async function bakeFrame(t,canvas,seconds){
    if(!bakeSession)throw Error('Start the bake before drawing frames.');
    if(video&&Number.isFinite(video.duration)&&video.duration>0){
      const target=seconds%video.duration;
      if(Math.abs(video.currentTime-target)>.001)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('The media texture could not seek for this frame.'));},8000),cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);},done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('The media texture could not load.'));};video.addEventListener('seeked',done,{once:true});video.addEventListener('error',fail,{once:true});video.currentTime=target;});
      const d=media.pictureRect([]),r=media.sourceRect([]);media.ctx2d.fillStyle='#000';media.ctx2d.fillRect(0,0,media.canvas.width,media.canvas.height);media.ctx2d.drawImage(video,...r,...d);media.texture.needsUpdate=true;
      const pixel=media.ctx2d.getImageData(Math.floor(media.canvas.width/2),Math.floor(media.canvas.height/2),1,1).data;api.setLedColor('#'+[pixel[0],pixel[1],pixel[2]].map(v=>Math.max(25,v).toString(16).padStart(2,'0')).join(''),false);
    }
    paused=false;try{tick(t);}finally{paused=true;}
    ctx.bakeDraw(canvas,seconds);
  }
  function endBake(){
    if(!bakeSession)return;const saved=bakeSession;bakeSession=null;ctx.endBake();window.__ERGO_BAKING__=false;paused=saved.paused;editorMode=saved.editorMode;ctx.editCamera(editorMode||cameraHeld);if(heldBeforeBake){putPose(ctx.camera,ctx.controls,heldBeforeBake);heldBeforeBake=null;}if(video)video.currentTime=saved.videoTime;
  }
  function receive(message) {
    if(message?.schemaVersion!==2)return;
    if(message.type==='desk.pose' && Number.isFinite(message.heightInches)&&Number.isFinite(message.tiltDegrees)){
      if(typeof message.sessionId!=='string'||!Number.isInteger(message.sequence))return;
      if(session!==message.sessionId){session=message.sessionId;sequence=-1;}
      if(message.sequence<=sequence)return;sequence=message.sequence;
      ctx.pose(message.heightInches,message.tiltDegrees);
      if([message.x,message.z,message.yaw].every(Number.isFinite)&&Math.abs(message.x)<=10&&Math.abs(message.z)<=10){
        const unit=api.arSize.metersPerUnit;ctx.demoMove(message.z/unit,-message.x/unit,message.yaw*Math.PI/180);
      }
      mirror=message;cam(.5);
    }
    if(message.type==='viewer.resetView')cam(.5);
  }
  ctx.onFrame(now=>{
    if(paused||preparing||!shot)return;
    if(lastRendered&&now-lastRendered<250){intervals.push(now-lastRendered);if(intervals.length>180)intervals.shift();}
    lastRendered=now;tick(readProgress());
  });
  // Same-origin parent owns this preview; no arbitrary postMessage action dispatcher.
  window.ErgoPresentation={prepare:async next=>{preparing=true;const held=cameraHeld?poseOf(ctx.camera,ctx.controls):null;cameraHeld=false;try{return await prepare(next);}finally{preparing=false;if(held){cameraHeld=true;putPose(ctx.camera,ctx.controls,held);ctx.editCamera(editorMode||cameraHeld);}}},tick,   // (a re-prepared chapter keeps an Editing camera's view)
    holdCamera,cameraHeld:()=>cameraHeld,sound,pause,receive,
    // Refresh from Studio (studio-sync.mjs): the app reads Studio's props and desks again from this frame's storage; the next prepare builds the room from them.
    reloadStudio:()=>ctx.reloadStudioState?.(),
    catalog:()=>ctx.catalog(),edit,seek,captureCamera,beginBake,bakeFrame,endBake,previewQuality,
    // Director scene-light tools (markers, gizmo) work on the live scene, camera and orbit controls.
    three:()=>({scene:ctx.scene,camera:ctx.camera,renderer:ctx.renderer,controls:ctx.controls}),hold,wake:ms=>wake(ms),sleeping:()=>sleeping,
    motionDefaults:()=>{
      const result={lift:[],tilt:[],wheels:[]},savedReduced=reduced;
      // Sample the real staged performance, including room routes, in its
      // desk-local frame. This is preview data until the first movement edit.
      // Reduced motion affects playback, not the editable source performance.
      try{
        reduced=false;
        for(let i=0;i<=128;i++){
          const time=i/128;seek(time);const p=ctx.readDirector();
          for(const [lane,fields] of Object.entries({lift:['height'],tilt:['tilt'],wheels:['x','z','yaw']}))result[lane].push({id:'auto-'+lane+'-'+i,time,easing:'linear',pose:Object.fromEntries(fields.map(f=>[f,p[f]]))});
        }
      }finally{reduced=savedReduced;seek(0);}
      return result;
    },
    cameraKeys:()=>structuredClone(resolveCameraKeys(shot?.camera,defaultCameraKeys)),
    frameSubject:subject=>{
      const bounds=subject==='room'&&api.workspaceRoom?.root?new THREE.Box3().setFromObject(api.workspaceRoom.root):box();
      if(subject!=='room')for(const {obj,saved} of api.sceneDesks.active.objects.values())if(shownInScene(obj)&&!saved.removed)bounds.union(new THREE.Box3().setFromObject(obj));
      const view=frame(bounds,subject==='room'),direction=ctx.camera.position.clone().sub(ctx.controls.target).normalize();
      ctx.controls.target.copy(view.center);ctx.camera.position.copy(view.center).add(direction.multiplyScalar(view.distance*1.15));ctx.camera.lookAt(view.center);edit(true);
    },
    cinematicSubject:()=>{
      const position=lastProgress;
      try{seek(1);const bounds=box();for(const {obj,saved} of api.sceneDesks.active.objects.values())if(shownInScene(obj)&&!saved.removed)bounds.union(new THREE.Box3().setFromObject(obj));
        return {floor:bounds.min.y,height:bounds.max.y-bounds.min.y,center:bounds.getCenter(new THREE.Vector3()).toArray()};
      }finally{seek(position);}
    },
    showcaseCameraKeys:specs=>{
      const keys=[],baseAngle=start.angle;
      try{
        // Union the whole performance so lifts and tilted surfaces stay in frame.
        const deskBounds=new THREE.Box3();
        for(const t of [0,.25,.5,.75,1]){seek(t);deskBounds.union(box());for(const {obj,saved} of api.sceneDesks.active.objects.values())if(shownInScene(obj)&&!saved.removed)deskBounds.union(new THREE.Box3().setFromObject(obj));}
        const roomBounds=api.workspaceRoom?.root?new THREE.Box3().setFromObject(api.workspaceRoom.root):deskBounds;
        for(const [i,spec] of specs.entries()){
          const bounds=spec.scope==='room'&&shot.room!=='product'?roomBounds:deskBounds;
          const framed=frame(bounds,spec.scope==='room'),angle=baseAngle+spec.angle;
          const target=framed.center.clone();
          if(spec.focus!==undefined)target.y=bounds.min.y+(bounds.max.y-bounds.min.y)*spec.focus;
          const elevation=spec.elevation===undefined?Math.atan(spec.scope==='room'?.85:.48):spec.elevation*Math.PI/180;
          const position=target.clone().add(new THREE.Vector3(Math.cos(angle)*Math.cos(elevation),Math.sin(elevation),Math.sin(angle)*Math.cos(elevation)).multiplyScalar(framed.distance*spec.distance*(spec.scope==='zone'?1.8:spec.scope==='room'?1:1.35)));
          position.y=Math.max(bounds.min.y+(bounds.max.y-bounds.min.y)*.08,position.y);
          keys.push({id:'showcase-view-'+i,time:spec.time,label:spec.label,path:'orbit',easing:'smooth',view:cleanCamera({position:position.toArray(),target:target.toArray(),fov:spec.fov||35,aspect:ctx.camera.aspect})});
        }
      }finally{seek(0);}
      return keys;
    },
    openingCameraKeys:()=>{
      const keys=[];
      try{
        for(const [i,spec] of OPENING_VIEWS.entries()){
          seek(spec.time);const bounds=box(),objects=api.sceneDesks.active.objects;
          for(const {obj,saved} of objects.values())if(shownInScene(obj)&&!saved.removed)bounds.union(new THREE.Box3().setFromObject(obj));
          const size=bounds.getSize(new THREE.Vector3()),view=frame(bounds);
          const input=objects.get('accessory-ergo-keyboard')?.obj||objects.get('accessory-keyboard-tray')?.obj,monitor=objects.get('accessory-wide-monitor')?.obj;
          const front=input&&monitor?new THREE.Box3().setFromObject(input).getCenter(new THREE.Vector3()).sub(new THREE.Box3().setFromObject(monitor).getCenter(new THREE.Vector3())):new THREE.Vector3(-1,0,-1);
          const angle=Math.atan2(front.z,front.x)+spec.angle;
          const target=bounds.getCenter(new THREE.Vector3());target.y=bounds.min.y+size.y*spec.focus;
          const position=target.clone().add(new THREE.Vector3(Math.cos(angle),spec.height,Math.sin(angle)).normalize().multiplyScalar(view.distance*spec.distance*(i===0?1:1.3)));
          keys.push({id:'intro-camera-'+i,time:spec.time,label:spec.label,easing:i===4?'hold':'smooth',view:cleanCamera({position:position.toArray(),target:target.toArray(),fov:35,aspect:ctx.camera.aspect})});
        }
      }finally{seek(0);}
      return keys;
    },
    cameraTrack:(camera,id)=>{if(shot?.id!==id)return;shot.camera=camera;resolveActive();},
    // Set before prepare (player.mjs prepareStage); null for chapters without a film shot.
    filmCamera:bake=>{cameraBake=typeof bake==='function'?bake:null;},
    // Director: a new chapter length without re-preparing (the desk motion samples by chapter seconds).
    secondsTrack:(seconds,id)=>{if(shot?.id===id&&Number.isFinite(seconds)){shot.seconds=seconds;resolveActive();}},
    // Director: the chapter's per-desk clips changed (desk-choreo.mjs); the desks are re-posed at the current time.
    // seek() re-poses the desks at the current time but also puts the camera back on the film's camera; while the
    // Director is open the view is the user's (they orbited somewhere handy to move things), so it is put back as it was.
    deskEditsTrack:(edits,id)=>{if(shot?.id!==id)return;shot.deskEdits=edits;deskChoreo.set(edits);keepView(()=>seek(lastProgress));},
    roomDesks:()=>roomDesks(api,deskChoreo),deskBase:id=>deskChoreo.baseOf(id),
    // The Director's People tab: the chapter's cast changed (room-people.mjs filter; true = the room's own people).
    peopleTrack:(people,id)=>{if(shot?.id!==id)return null;if(people)shot.people=people;else delete shot.people;return api.setRoomPeople?.(!!people,people&&typeof people==='object'?people:null);},
    // The Director's Sonar section (sonar.mjs): the chapter's sonar changed (null: the film's own); the reach is measured again
    // from the new centre. Preview at full holds the rings all out (never part of a shot); sonarSpace maps the centre tool's
    // offset (inches, the desk's turn since the start) to the stage and back; sonarInfo is what the panel shows.
    sonarTrack:(value,id)=>{if(shot?.id!==id)return;const c=value?cleanSonar(value):null;if(c)shot.sonar=c;else delete shot.sonar;sonarCfg=c;
      if(pingBase)while(pings.length<meshesFor(c))pings.push(makePing(pings.length));
      sonar=null;sonarTries=0;keepView(()=>seek(lastProgress));},
    sonarPreview:(on,id)=>{if(shot?.id!==id)return false;previewFull=!!on;keepView(()=>seek(lastProgress));return previewFull;},
    sonarSpace:()=>{if(!ringHome||!pingBase)return null;
      const u=unitsPerInch(),q=turnOf().clone(),raw=ringHome.local.clone().applyMatrix4(ctx.loadedModel.matrixWorld);
      return {u,y:pingBase.y,raw:{x:raw.x,z:raw.z},
        toWorld:(dx,dz)=>{const v=new THREE.Vector3(dx*u,0,dz*u).applyQuaternion(q);return {x:raw.x+v.x,z:raw.z+v.z};},
        fromWorld:(x,z)=>{const v=new THREE.Vector3(x-raw.x,0,z-raw.z).applyQuaternion(q.clone().invert());return {x:v.x/u,z:v.z/u};}};},
    sonarInfo:()=>{if(shot?.kind!=='proximity'||!ringHome)return null;const u=unitsPerInch();
      return {found:!!sonar,filmRadius:sonar?sonar/u:null,radius:sonar?(sonarCfg?.radius||sonar/u):null,rings:sonarCfg?.rings||3,enabled:sonarCfg?.enabled!==false,preview:previewFull,pings:pings.length,cfg:sonarCfg?structuredClone(sonarCfg):null};},
    motionTrack:(motion,id)=>{if(shot?.id===id)shot.motion=motion?(motion.clips?motion:{tracks:motion.tracks||tracksFromPoses(motion.from,motion.to)}):undefined;},
    previewPose:value=>{const p=cleanPose(value);ctx.pose(p.height,p.tilt);ctx.placeDirector(p);return ctx.readDirector();},capturePose:()=>ctx.readDirector(),
    clock:callback=>{readProgress=callback;},capture:canvas=>ctx.capture(canvas),
    performance:()=>{const sorted=[...intervals].sort((a,b)=>a-b),mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;return{fps:mean?Math.round(1000/mean):0,p95:sorted[Math.floor(sorted.length*.95)]||0};},
    reduced: value=>{reduced=!!value;},snapshot:()=>({shot:shot?.id,paused,mirror:mirror?.type,height:api.heightInches,tilt:api.tiltConfigs.find(c=>c.name==='tilting')?.currentDeg,room:api.roomScene})};
  addEventListener('resize',()=>requestAnimationFrame(()=>{cam(lastProgress);if(paused){api.workspaceRoom?.update(ctx.camera);ctx.renderer.render(ctx.scene,ctx.camera);}}));
  parent.postMessage({ergoPresentation:'ready'},location.origin);
}
