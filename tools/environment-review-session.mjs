import * as THREE from 'three';
import {surfaceSupportsFootprint} from '../desk-shelf-space.mjs';
const E=window.ErgoFlex,P=window.ErgoPresentation;
const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
function loungeAudit(){
 const room=E.workspaceRoom;if(room.id!=='lounge')return undefined;
 const root=room.root,l=room.roomLayout;root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();
 const props=room.assets().filter(o=>!o.userData.sceneDeskManaged).map(o=>{
  const b=new THREE.Box3();o.traverse(c=>{if(!c.isMesh||!c.geometry)return;let bounds;if(c.isInstancedMesh){c.computeBoundingBox();bounds=c.boundingBox;}else{c.geometry.computeBoundingBox();bounds=c.geometry.boundingBox;}b.union(bounds.clone().applyMatrix4(inverse.clone().multiply(c.matrixWorld)));});
  return {id:o.userData.propId,name:o.name,min:b.min.toArray(),max:b.max.toArray(),floor:o.parent===root&&b.min.y<5&&b.max.y>120&&!o.userData.wallDecoration};
 });
 const outside=props.filter(p=>p.min[0]<-l.width/2-2||p.max[0]>l.width/2+2||p.min[2]<l.back-2||p.max[2]>l.back+l.depth+2||p.min[1]<-2||p.max[1]>l.height+2).map(p=>p.id),floor=props.filter(p=>p.floor),overlaps=[];
 for(let i=0;i<floor.length;i++)for(let j=i+1;j<floor.length;j++){const a=floor[i],b=floor[j],dx=Math.min(a.max[0],b.max[0])-Math.max(a.min[0],b.min[0]),dz=Math.min(a.max[2],b.max[2])-Math.max(a.min[2],b.min[2]);if(dx>15&&dz>15)overlaps.push({a:a.id,b:b.id,dx:Math.round(dx),dz:Math.round(dz)});}
 const bar=props.find(p=>['lounge-bar','modern-refreshments'].includes(p.id)),windowEnd=l.back+2300+(l.tier?1850:1350)/2;const barWindowClearance=bar?bar.min[2]-windowEnd:null;
 return {outside,overlaps,props,barWindowClearance,missing:room.missingProps,deskStyle:{woodFinish:E.currentConfig.woodFinish,baseFinish:E.currentConfig.baseFinish,trimColor:E.currentConfig.trimColor}};
}
window.EnvironmentReview={
 async load(room,phase='afternoon',size='48x30',overrideLayout=null){
  const layout=overrideLayout||(room==='library'?'humboldt':room==='occmedialab'?'spacious':room==='kindergarten'?'apartment':'house');
  await P.prepare({id:'environment-review',room,layout,mode:phase,size,seconds:10,kind:'still'});
  await E.sceneDesks.objects.ready;await E.workspaceAccessories.ready;P.edit(true);E.workspaceRoom.setCeilingEnabled(true);await E.workspaceRoom.loungeArtReady;
  if(room==='childroom'){E.setMeasuredRoomMode(room,phase,true);E.setLedsEnabled(false);E.setHeight(E.measuredRoom.modes[phase].height);E.setTilt('tilting',E.measuredRoom.modes[phase].tilt);}
  if(room==='lounge'){E.setLoungeMode(phase,true);const mode=E.measuredRoom.modes[phase];E.setLedsEnabled(mode.leds);E.setHeight(mode.height);E.setTilt('tilting',mode.tilt);}
  await new Promise(r=>setTimeout(r,800));await frames();
  return this.report(room,phase,size);
 },
 report(room,phase,size){
  const mount=E.workspaceAccessories.mounts.get('desktop');
  const kits=[...mount.dress.children].filter(c=>c.userData.dayKit).map(c=>{
   const local=c.clone(true);local.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(local);
   return {visible:c.visible,position:c.position.toArray(),overlap:c.userData.authoredDesktopOverlap,supported:surfaceSupportsFootprint(mount.supportSpace,bounds),measured:!!mount.supportSpace};
  });
  return {room,phase,loungeAudit:loungeAudit(),actualMode:E.measuredRoom?.mode,layout:E.measuredRoom?.layout?.id,actualDeskSize:E.currentConfig.size,deskFinish:E.currentConfig.woodFinish,deskPose:E.sceneDesks.ctx.readLive(E.sceneDesks.active).pose,ageStage:E.childAgeStage,stageKey:E.sceneDesks.key,accessories:E.currentConfig.accessories,childGrowth:E.workspaceRoom.root?.userData.childGrowth,childPersonality:E.workspaceRoom.root?.userData.childPersonality,earlyYearsLife:E.workspaceRoom.root?.userData.earlyYearsLife,earlyYearsWalls:E.workspaceRoom.root?.userData.earlyYearsWalls,loungeDesign:E.workspaceRoom.root?.userData.loungeDesign,loungeDetails:E.workspaceRoom.root?.userData.loungeDesignDetails,loungeArt:E.workspaceRoom.root?.userData.loungeArt,ceilingEnabled:E.workspaceRoom.ceilingEnabled,childLighting:E.workspaceRoom.root?.userData.childLighting,childActivity:E.workspaceRoom.root?.userData.childActivity,size,desks:E.sceneDesks.records.size,kits};
 },
 frameRoom(){const r=E.workspaceRoom,l=r.roomLayout,camera=E.sceneDesks.ctx.camera,controls=E.sceneDesks.ctx.controls;r.root.updateWorldMatrix(true,true);const target=new THREE.Vector3(0,l.height*.3,l.back+l.depth*.43).applyMatrix4(r.root.matrixWorld),position=new THREE.Vector3(-l.width*.78,l.height*1.18,l.back+l.depth*1.32).applyMatrix4(r.root.matrixWorld);camera.position.copy(position);camera.fov=42;camera.near=.01;camera.updateProjectionMatrix();controls.target.copy(target);controls.maxDistance=100;controls.update();},
 frameWindow(){const r=E.workspaceRoom,l=r.roomLayout,c=E.sceneDesks.ctx.camera,o=E.sceneDesks.ctx.controls;r.root.updateWorldMatrix(true,true);c.position.copy(new THREE.Vector3(l.width*.3,1750,l.back+l.depth-700).applyMatrix4(r.root.matrixWorld));o.target.copy(new THREE.Vector3(-l.width/2+200,1400,l.back+3000).applyMatrix4(r.root.matrixWorld));c.fov=62;c.updateProjectionMatrix();o.update();},
 frameMedia(){const r=E.workspaceRoom,l=r.roomLayout,c=E.sceneDesks.ctx.camera,o=E.sceneDesks.ctx.controls;r.root.updateWorldMatrix(true,true);c.position.copy(new THREE.Vector3(-l.width*.27,1650,l.back+l.depth-850).applyMatrix4(r.root.matrixWorld));o.target.copy(new THREE.Vector3(l.width/2-200,1250,l.back+l.depth*.43).applyMatrix4(r.root.matrixWorld));c.fov=62;c.updateProjectionMatrix();o.update();},
 frameConversation(){const r=E.workspaceRoom,l=r.roomLayout,c=E.sceneDesks.ctx.camera,o=E.sceneDesks.ctx.controls;r.root.updateWorldMatrix(true,true);c.position.copy(new THREE.Vector3(250,1600,l.back+l.depth-350).applyMatrix4(r.root.matrixWorld));o.target.copy(new THREE.Vector3(l.sofaX+950,950,l.loungeZ-100).applyMatrix4(r.root.matrixWorld));c.fov=68;c.updateProjectionMatrix();o.update();},
 async settleView(){await frames();await frames();},
 async tilt(){E.setHeight(52.5);E.setTilt('tilting',45);await frames();},
 capture(width=640,height=360){const canvas=document.createElement('canvas');P.capture(canvas);const small=document.createElement('canvas');small.width=width;small.height=Math.round(width*canvas.height/canvas.width);small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);return small.toDataURL('image/jpeg',.94);}
};
