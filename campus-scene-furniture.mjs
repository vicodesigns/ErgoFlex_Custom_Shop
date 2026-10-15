import * as THREE from 'three';

// Measure in an editable furnishing's local coordinates. Rotation and saved
// root scale never inflate the dimensional fit of its replacement model.
export function campusBounds(object){
 object.updateWorldMatrix(true,true);const inv=object.matrixWorld.clone().invert(),box=new THREE.Box3();
 object.traverse(o=>{if(!o.geometry)return;if(o.isInstancedMesh){o.computeBoundingBox();box.union(o.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));}else{o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));}});return box;
}
export function campusFixtureSpec(room,object){
 const id=object.userData.propId;
 if(room.id==='coworking'&&id==='call-booth')return {id:'campus-pod-nordic',capacity:[1560,room.roomLayout.height-100,1600]};
 if(room.id==='coworking'&&id==='mobile-whiteboard')return {id:'campus-board-compact-nordic',capacity:[1120,1750,480]};
 if(room.id==='college'&&/^team-whiteboard-/.test(id))return {id:'campus-board-compact-terracotta',capacity:[1220,1820,460]};
 if(room.id==='library'&&id==='collaboration-whiteboard')return {id:'campus-wall-board-moss',capacity:[1390,960,100],offset:[0,470,0],content:true};
 if(['highschool','middleschool'].includes(room.id)&&id==='lockers')return {id:'campus-lockers-compact-'+(room.id==='highschool'?'hbhs':'middle'),capacity:[830,1880,320],keep:'graphics'};
 if(room.id==='office'&&id==='office-credenza')return {id:'campus-storage-low-walnut',capacity:[campusBounds(object).getSize(new THREE.Vector3()).x,624,420],keep:'countertop',fullScale:true};
 return null;
}
export function bindCampusFurniture(room,object,entry){
 if(!entry?.campus)return;
 const copies=new Map(),glows=[];
 object.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!m.userData.campusGlow&&!m.userData.sceneDisplay)return m;if(!copies.has(m)){const c=m.clone();c.userData.sharedTextures=true;room.ownedMaterials.add(c);copies.set(m,c);if(m.userData.campusGlow)glows.push({mat:c,base:m.userData.campusGlow});}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
 let light=null;if(entry.campus.archetype==='pod'){
  const units=(room.root?.scale.x||room.scale)*1000;light=new THREE.PointLight('#ffe1b6',0,2.1*units,2);light.position.fromArray(entry.campus.lightAnchor);light.userData.presentationOnly=true;light.name='Acoustic pod practical';object.add(light);
 }
 object.userData.campusFurniture=entry.campus;
 (room.campusFixtures||=[]).push({object,glows,light,power:.65*((room.root?.scale.x||room.scale)*1000)**2});
 applyCampusLighting(room,...(room.atelierLampPhase||['afternoon',1]));
}
export function applyCampusLighting(room,mode='afternoon',accent=1){
 const gain=({morning:.35,afternoon:.45,evening:.85,night:.35,party:.65}[mode]??.45)*Math.max(0,accent);
 for(const fixture of room.campusFixtures||[]){for(const g of fixture.glows)g.mat.emissiveIntensity=g.base*gain;if(fixture.light)fixture.light.intensity=fixture.power*gain;}
}
export async function upgradeCampusFurniture(room,library,token){
 const targets=room.assets().map(object=>({object,spec:campusFixtureSpec(room,object)})).filter(p=>p.spec);
 if(!targets.length)return;
 await library.loadIndex();
 for(const {object,spec} of targets){
  if(token!==room.token)return;const entry=library.entry(spec.id);if(!entry)continue;
  const fit=Math.min(1,...spec.capacity.map((v,i)=>v/entry.size[i]));if(fit<.9||spec.fullScale&&fit<.999)continue;
  let model;try{model=await library.instance(spec.id);}catch(e){console.warn('Campus furnishing unavailable',spec.id,e);continue;}
  if(token!==room.token)return;
  // Keep the original editable object itself, including its key, parent,
  // position, rotation and deletion identity. Retire native geometry until
  // room teardown: its materials may still be shared by the live room.
  const content=spec.content?object.children.find(c=>c.geometry?.type==='PlaneGeometry'&&c.material?.map)?.material.map:null;
  const retired=new THREE.Group();retired.name='Retired '+object.name;
  for(const child of [...object.children]){
   const keepGraphic=spec.keep==='graphics'&&child.geometry?.type==='PlaneGeometry'&&child.material?.map;
   let keepCounter=false;if(spec.keep==='countertop'){
    object.updateWorldMatrix(true,true);child.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(child).applyMatrix4(object.matrixWorld.clone().invert());keepCounter=child.name==='Credenza table lamp'||b.min.y>=623;
   }
   if(!keepGraphic&&!keepCounter)retired.add(child);
  }
  (room.campusRetired||=[]).push(retired);
  model.name=entry.name;model.scale.setScalar(1000*fit);if(spec.offset)model.position.set(...spec.offset);object.add(model);
  if(content)model.traverse(o=>{if(o.material?.name==='Campus writing surface'){const m=o.material.clone();m.map=content;m.userData.sharedTextures=true;room.ownedMaterials.add(m);o.material=m;}});
  object.userData.campusUpgrade={id:spec.id,fit,capacity:spec.capacity};object.userData.sceneAssetName=entry.name;
  bindCampusFurniture(room,model,entry);
 }
}
