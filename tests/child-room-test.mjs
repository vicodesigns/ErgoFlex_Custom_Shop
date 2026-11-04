import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHILD_LAYOUTS,CHILD_MODES,buildChildRoom,createChildDeskKit,migrateChildRack} from '../child-room.mjs';
import {grooveDestination,poseIsClear} from '../room-groove.mjs';
import {roomSurfaceFinish} from '../room-polish.mjs';
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),measureText:s=>({width:s.length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:512,height:512,getContext:context})};
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra});
const mesh=(p,g,m,at=[0,0,0])=>{const o=new THREE.Mesh(g,m);o.position.set(...at);p.add(o);return o;};
const box=(p,size,at,m)=>mesh(p,new THREE.BoxGeometry(...size),m,at);
const sphere=(p,size,at,m)=>{const o=mesh(p,new THREE.SphereGeometry(1,16,12),m,at);o.scale.set(...size);return o;};
const rod=(p,a,b,r,m)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),o=mesh(p,new THREE.CylinderGeometry(r,r,delta.length(),12),m);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
const helpers={material,mesh,box,sphere,rod,markSceneAsset:(o,{key})=>o.userData.sceneAssetKey=key};
for(const l of Object.values(CHILD_LAYOUTS)){
 assert.equal(l.desktopSize,'48x30');const root=new THREE.Group();root.scale.setScalar(.001);const room={root,id:'childroom',roomLayout:l,walls:[],propSupports:[]};buildChildRoom(room,root,l,helpers);root.updateMatrixWorld(true);
 const get=id=>root.getObjectByProperty('name',id)||(()=>{let found;root.traverse(o=>{if(o.userData.propId===id)found=o;});return found;})();
 for(const id of ['house-bed','desk-stool'])assert(Math.abs(new THREE.Box3().setFromObject(get(id)).min.y)<.00001,id+' contacts floor');
 const rack=get('story-rack'),old={p:{x:-l.width/2+260,y:0,z:l.back+l.depth-1150},q:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},s:{x:1,y:1,z:1}};assert.equal(migrateChildRack(rack,old,l).p.x,rack.position.x);const edited=structuredClone(old);edited.p.x+=25;assert.equal(migrateChildRack(rack,edited,l),edited,'Retain a deliberately moved rack');
 const second=structuredClone(old);second.p={x:-l.width/2+700,y:0,z:l.back+l.depth-1150};second.q={x:0,y:0,z:0,w:1};assert.equal(migrateChildRack(rack,second,l).p.z,l.storage[1]);
 const placements=root.userData.childRoom.furnitureBounds;
 for(const a of placements){assert(a.x-a.halfWidth>=-l.width/2&&a.x+a.halfWidth<=l.width/2);assert(a.z-a.halfDepth>=l.back&&a.z+a.halfDepth<=l.back+l.depth);for(const b of placements){if(a===b)continue;assert(Math.abs(a.x-b.x)>=a.halfWidth+b.halfWidth||Math.abs(a.z-b.z)>=a.halfDepth+b.halfDepth,`${a.id} overlaps ${b.id}`);}}
 const rackBounds=new THREE.Box3().setFromObject(rack),nookBounds=new THREE.Box3().setFromObject(get('reading-nook'));assert(nookBounds.min.z-rackBounds.max.z>=.39,'Picture-book browsing approach');
 const obstacles=placements.map(a=>({minX:a.x-a.halfWidth,maxX:a.x+a.halfWidth,minZ:a.z-a.halfDepth,maxZ:a.z+a.halfDepth}));
 for(const [i,phase] of Object.keys(CHILD_MODES).entries()){
  room.roomAtmosphere(phase);root.updateMatrixWorld(true);for(let n=0;n<5;n++)assert.equal(get('play-'+n).visible,i===n);
  const destination=grooveDestination('childroom',l,phase);assert(poseIsClear(destination,{minX:-l.width/2,maxX:l.width/2,minZ:l.back,maxZ:l.back+l.depth},obstacles,{halfWidth:610,halfDepth:381,margin:45}),'48-inch desk target stays in its work bay');
  if(phase==='night'){assert.equal(root.getObjectByName('Child room · reading').intensity,0,'Reading light off at bedtime');assert(root.getObjectByName('Child room · moon').intensity>0);assert.equal(get('play-3').children.length,0,'Bedtime floor is clear');assert(root.userData.childLighting.blind>.8);}
  if(phase==='evening'){assert.equal(get('play-2').children.length,0,'Storytime moves off the play mat');assert(get('reading-nook').children.some(o=>o.userData.childActivity==='evening'&&o.visible));}
  if(phase==='afternoon'&&l.tier<2)assert(root.getObjectByName('Portable floor drawing tray').visible,'Small rooms have a low drawing surface');
 }

 const wheels=[];get('play-4').traverse(o=>{if(o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===24)wheels.push(o);});assert.equal(wheels.length,12);for(const wheel of wheels)assert(Math.abs(new THREE.Box3().setFromObject(wheel).min.y-.021)<.00001,'Train wheels meet track top');
 const floor=get('floor').children.find(o=>o.isInstancedMesh);assert(floor.material.map,'Floor clone receives wood grain');assert(root.ownedTextures.includes(floor.material.map));
 root.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
 const kit=createChildDeskKit(helpers);assert.equal(kit.children.length,5);let nightCrayons=0;kit.children[3].traverse(o=>{if(o.geometry?.type==='CylinderGeometry')nightCrayons++;});assert.equal(nightCrayons,0,'Bedtime desk supplies put away');
 const m=material('#ffffff',{roughness:.31});m.userData.roomFinishLocked=true;roomSurfaceFinish(room,m,'powder');assert.equal(m.roughness,.31,'Authored glaze must survive shared finishing');
 console.log(l.id+': five activities, fixed48 desk, grounded furniture/train, bounds, clearances, owned floor texture and finish locks pass');
}
