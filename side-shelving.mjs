import * as THREE from 'three';
// The owner's side shelving (assets/props/ergoflex-side-*.glb, tools/props/import-side-shelving.mjs): its wood plate
// follows the desk's own wood, the cups are clear acrylic, the cubby is 3D-printed plastic in the desk's trim colour.
export const isSideShelving=id=>/^ergoflex-side-/.test(id||'');
// A fresh instance's materials: owned copies (shared GLB materials must not be written), flagged for the desk sync.
// The wood plate carries the same flag the painter's shelf uses (artistShelfWood): every desk update already fills it
// from the live desktop finish (workspace-3d.mjs update, createSceneAccessorySet, film-fx), so it matches any desk.
export function styleSideShelving(root){
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.material=Array.isArray(obj.material)?obj.material.map(m=>own(obj,m)):own(obj,obj.material);
  });
  return root;
}
function own(obj,m){
  if(m.name==='Side shelf wood'){const o=new THREE.MeshPhysicalMaterial({color:m.color,roughness:m.roughness});o.userData.sharedTextures=true;obj.ownedMaterials||=[];obj.ownedMaterials.push(o);obj.userData.artistShelfWood=true;return o;}
  if(m.name==='Side shelf acrylic'){const o=new THREE.MeshPhysicalMaterial({color:'#eef6f8',roughness:.06,metalness:0,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});o.userData.sharedTextures=true;obj.ownedMaterials||=[];obj.ownedMaterials.push(o);return o;}
  if(m.name==='Side shelf print'){const o=new THREE.MeshPhysicalMaterial({color:m.color,roughness:.48,metalness:0,clearcoat:.08});o.userData.sharedTextures=true;obj.ownedMaterials||=[];obj.ownedMaterials.push(o);obj.userData.deskTrimPlastic=true;return o;}
  return m;
}
// One desk's finish onto every flagged mesh under root: {wood: the desktop's material, trim: '#rrggbb'}. Cheap when
// nothing changed (a signature per mesh).
export function syncDeskMatch(root,{wood,trim}={}){
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    if(wood&&obj.userData.artistShelfWood&&obj.material?.isMeshPhysicalMaterial){
      const sig=wood.uuid+':'+wood.version+':'+wood.color.getHex()+':'+wood.map?.uuid;
      if(obj.deskMatchSignature!==sig){obj.material.copy(wood);obj.material.name='Side shelf wood';obj.material.userData.sharedTextures=true;obj.material.needsUpdate=true;obj.deskMatchSignature=sig;}
    }
    if(trim&&obj.userData.deskTrimPlastic&&obj.deskTrimColor!==trim){obj.material.color.set(trim);obj.deskTrimColor=trim;}
  });
}
