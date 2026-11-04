import * as THREE from 'three';
import {surfaceSupportsFootprint} from '../desk-shelf-space.mjs';
const E=window.ErgoFlex,P=window.ErgoPresentation;
const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
window.EnvironmentReview={
 async load(room,phase='afternoon',size='48x30',overrideLayout=null){
  const layout=overrideLayout||(room==='library'?'humboldt':room==='occmedialab'?'spacious':room==='kindergarten'?'apartment':'house');
  await P.prepare({id:'environment-review',room,layout,mode:phase,size,seconds:10,kind:'still'});
  await E.sceneDesks.objects.ready;await E.workspaceAccessories.ready;P.edit(true);
  if(room==='childroom'){E.setLedsEnabled(false);E.setHeight(28);E.setTilt('tilting',phase==='afternoon'?8:0);}
  await new Promise(r=>setTimeout(r,800));await frames();
  return this.report(room,phase,size);
 },
 report(room,phase,size){
  const mount=E.workspaceAccessories.mounts.get('desktop');
  const kits=[...mount.dress.children].filter(c=>c.userData.dayKit).map(c=>{
   const local=c.clone(true);local.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(local);
   return {visible:c.visible,position:c.position.toArray(),overlap:c.userData.authoredDesktopOverlap,supported:surfaceSupportsFootprint(mount.supportSpace,bounds),measured:!!mount.supportSpace};
  });
  return {room,phase,actualMode:E.measuredRoom?.mode,layout:E.measuredRoom?.layout?.id,childLighting:E.workspaceRoom.root?.userData.childLighting,childActivity:E.workspaceRoom.root?.userData.childActivity,size,desks:E.sceneDesks.records.size,kits};
 },
 frameRoom(){const r=E.workspaceRoom,l=r.roomLayout,camera=E.sceneDesks.ctx.camera,controls=E.sceneDesks.ctx.controls;r.root.updateWorldMatrix(true,true);const target=new THREE.Vector3(0,l.height*.3,l.back+l.depth*.43).applyMatrix4(r.root.matrixWorld),position=new THREE.Vector3(-l.width*.95,l.height*1.1,l.back+l.depth*1.55).applyMatrix4(r.root.matrixWorld);camera.position.copy(position);camera.fov=42;camera.near=.01;camera.updateProjectionMatrix();controls.target.copy(target);controls.maxDistance=100;controls.update();},
 async tilt(){E.setHeight(52.5);E.setTilt('tilting',45);await frames();},
 capture(){const canvas=document.createElement('canvas');P.capture(canvas);const small=document.createElement('canvas');small.width=640;small.height=360;small.getContext('2d').drawImage(canvas,0,0,640,360);return small.toDataURL('image/jpeg',.85);}
};
