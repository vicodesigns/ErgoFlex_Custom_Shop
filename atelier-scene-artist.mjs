import * as THREE from 'three';

export function artistSceneProp(scene,placement,index){
 if(scene!=='creative'||placement.id!=='papers')return null;
 const entry=index.props.find(p=>p.id==='atelier-artist-slate-chalk'),old=index.props.find(p=>p.id===placement.id);if(!entry||!old)return null;
 const fit=Math.min(1,old.size[0]/entry.size[0],old.size[2]/entry.size[2]);return fit>=.9?{id:entry.id,entry,fit}:null;
}
export function bindArtistGear(room,object,entry){
 if(!entry?.atelierArtist)return;
 const copies=new Map();object.traverse(o=>{if(!o.isMesh)return;const own=m=>{
  if(!m.userData.sceneDisplay)return m;
  if(!copies.has(m)){const c=m.clone();c.userData.sharedTextures=true;room.ownedMaterials.add(c);copies.set(m,c);}return copies.get(m);
 };o.material=Array.isArray(o.material)?o.material.map(own):own(o.material);});object.userData.atelierArtist=entry.atelierArtist;
}
export function artistFixtureSpec(room,object){
 if(room.id!=='creative')return null;
 if(object.userData.propId?.startsWith('artist-brushes-'))return {id:'atelier-artist-brushes-oak',capacity:[125,295,125],offset:[0,0,0]};
 if(object.userData.propId==='artist-sculpture')return {id:'atelier-artist-sculpture-oak',capacity:[580,480,580],offset:[0,900,0],keepPlinth:true};
 return null;
}
export async function upgradeArtistFixtures(room,library,token){
 const targets=room.assets().map(object=>({object,spec:artistFixtureSpec(room,object)})).filter(p=>p.spec);if(!targets.length)return;
 await library.loadIndex();
 for(const {object,spec} of targets){
  if(token!==room.token)return;const entry=library.entry(spec.id);if(!entry)continue;
  const fit=Math.min(1,...spec.capacity.map((n,i)=>n/entry.size[i]));if(fit<.9)continue;
  let model;try{model=await library.instance(spec.id);}catch(error){console.warn('Artist item unavailable',spec.id,error);continue;}if(token!==room.token)return;
  // Keep the editable fixture, its parent and all saved transforms. Retired
  // geometry stays alive until room teardown because its materials are shared.
  const retired=new THREE.Group();object.updateWorldMatrix(true,true);
  for(const child of [...object.children]){
   const b=new THREE.Box3().setFromObject(child,true).applyMatrix4(object.matrixWorld.clone().invert());
   if(!spec.keepPlinth||b.min.y>=899)retired.add(child);
  }
  (room.campusRetired||=[]).push(retired);
  model.name=entry.name;model.scale.setScalar(1000*fit);model.position.set(...spec.offset);object.add(model);bindArtistGear(room,model,entry);
  object.userData.artistUpgrade={id:spec.id,fit,capacity:spec.capacity};object.userData.sceneAssetName=entry.name;
 }
}
