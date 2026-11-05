import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {CHILD_LAYOUTS,CHILD_ALL_LAYOUTS,CHILD_MODES,buildChildRoom,createChildDeskKit,migrateChildRack} from '../child-room.mjs';
import {grooveDestination,poseIsClear,segmentIsClear} from '../room-groove.mjs';
import {CHILD_AGE_STAGES,upgradeChildDesk} from '../child-growth-profiles.mjs';
import {PRODUCT_CONFIG,woodSpecies} from '../catalog.mjs';
import {cleanSceneDeskData} from '../scene-desk-data.mjs';
import {roomSurfaceFinish} from '../room-polish.mjs';
import {earlyYearsProfile,EARLY_YEARS_PROFILES} from '../early-years-profiles.mjs';
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),measureText:s=>({width:s.length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:512,height:512,getContext:context})};
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra});
const mesh=(p,g,m,at=[0,0,0])=>{const o=new THREE.Mesh(g,m);o.position.set(...at);p.add(o);return o;};
const box=(p,size,at,m,r=0)=>mesh(p,r?new RoundedBoxGeometry(...size,2,r):new THREE.BoxGeometry(...size),m,at);
const sphere=(p,size,at,m)=>{const o=mesh(p,new THREE.SphereGeometry(1,16,12),m,at);o.scale.set(...size);return o;};
const rod=(p,a,b,r,m)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),o=mesh(p,new THREE.CylinderGeometry(r,r,delta.length(),12),m);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
const helpers={material,mesh,box,sphere,rod,markSceneAsset:(o,{key})=>o.userData.sceneAssetKey=key};
assert.equal(PRODUCT_CONFIG.woodFinishes.find(f=>f.name==='Pearl White').surface,'opaque');
assert.equal(woodSpecies('Pearl White').surface,'opaque','Pearl white has no wood grain');
assert.equal(new Set(Object.values(EARLY_YEARS_PROFILES).map(p=>p.motif)).size,5,'Five different child-interest portraits');
assert.equal(new Set(Object.values(EARLY_YEARS_PROFILES).map(p=>p.palette.dado)).size,5,'Interests read at room scale through different paint');
for(const l of Object.values(CHILD_ALL_LAYOUTS)){
 assert.equal(l.desktopSize,CHILD_AGE_STAGES[l.ageStage].deskSize);const root=new THREE.Group();root.scale.setScalar(.001);const room={root,id:'childroom',roomLayout:l,walls:[],propSupports:[]};buildChildRoom(room,root,l,helpers);root.updateMatrixWorld(true);
 const get=id=>root.getObjectByProperty('name',id)||(()=>{let found;root.traverse(o=>{if(o.userData.propId===id)found=o;});return found;})();
 for(const id of ['house-bed','desk-stool'])assert(Math.abs(new THREE.Box3().setFromObject(get(id)).min.y)<.00001,id+' contacts floor');
 const rack=get('story-rack'),old={p:{x:-l.width/2+260,y:0,z:l.back+l.depth-1150},q:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},s:{x:1,y:1,z:1}};assert.equal(migrateChildRack(rack,old,l).p.x,rack.position.x);const edited=structuredClone(old);edited.p.x+=25;assert.equal(migrateChildRack(rack,edited,l),edited,'Retain a deliberately moved rack');
 const second=structuredClone(old);second.p={x:-l.width/2+700,y:0,z:l.back+l.depth-1150};second.q={x:0,y:0,z:0,w:1};assert.equal(migrateChildRack(rack,second,l).p.z,l.storage[1]);
 const placements=root.userData.childRoom.furnitureBounds;
 if(l.ageStage==='early'){
  const design=earlyYearsProfile(l).design;
  assert.equal(root.userData.earlyYearsWalls.murals,2);assert.equal(root.userData.earlyYearsWalls.detailedMurals,1);assert.equal(root.userData.earlyYearsWalls.displayClusters,1);assert.equal(root.userData.earlyYearsWalls.paintings,design.paintings+(l.tier>=2?1:0));assert.equal(root.userData.earlyYearsWalls.bunting,design.flags);
  assert.equal(rack.userData.displayedBooks,design.booksPerRow*2);
  for(const id of ['rainbow-print','forest-print','drawing-gallery','early-project-gallery','personality-right-gallery'])assert(!get(id),'No duplicate early-years wall display: '+id);
  for(const id of ['early-rear-mural','early-right-mural','early-fabric-bunting','early-collected-paintings','early-bedtime-stars']){
   const b=new THREE.Box3().setFromObject(get(id));assert(b.min.x>=-l.width/2000-.00001&&b.max.x<=l.width/2000+.00001,id+' wall width');assert(b.min.z>=l.back/1000-.00001&&b.max.z<=(l.back+l.depth)/1000+.00001,id+' wall depth');assert(b.min.y>0&&b.max.y<l.height/1000,id+' wall height');
  }
  assert(new THREE.Box3().setFromObject(get('early-right-mural')).min.z>=(l.back+2700)/1000-.00001,'Mural clears glazing and curtains');
  const pocketBox=new THREE.Box3().setFromObject(get('wall-pocket'));
  for(const page of get('early-collected-paintings').children){const b=new THREE.Box3().setFromObject(page);assert(b.max.y<pocketBox.min.y||b.min.y>pocketBox.max.y||b.max.z<pocketBox.min.z||b.min.z>pocketBox.max.z,'Low paintings clear the wall pocket and its books');}
  const profile=earlyYearsProfile(l);assert.equal(root.userData.earlyYearsLife.profile,profile.id);assert.equal(root.userData.childPersonality.profile,profile.id);assert.equal(root.userData.earlyYearsLife.residentChildren,1);
  assert.equal(root.userData.childPersonality.palette.dado,profile.palette.dado);assert(root.getObjectByName('Woven interest mat · '+profile.motif));
  const guestStools=placements.filter(f=>f.id.startsWith('early-guest-stool-'));assert.equal(guestStools.length,Math.max(0,profile.partyParticipants-2),'Visiting places have actual seats');
  if(l.tier>=2){const table=get('little-craft-table'),shared=table.children.find(o=>o.userData.sharedPlaces);assert.equal(shared.userData.sharedPlaces,profile.partyParticipants);}
  assert(root.userData.earlyYearsLife.zones.length>=4);assert.equal(!!get('early-play-kitchen'),l.tier>=2);assert.equal(!!get('early-small-world'),l.tier>=3);assert.equal(!!get('early-music-nature'),l.tier>=4);
  for(const id of root.userData.earlyYearsLife.floorIds){
   const o=get(id),b=new THREE.Box3().setFromObject(o),f=placements.find(p=>p.id===id);assert(f);assert(Math.abs(b.min.y)<.00001,id+' grounded');
   assert(b.min.x>=-l.width/2000-.00001&&b.max.x<=l.width/2000+.00001,id+' inside width');assert(b.min.z>=l.back/1000-.00001&&b.max.z<=(l.back+l.depth)/1000+.00001,id+' inside depth');
   assert(b.min.x>=(f.x-f.halfWidth)/1000-.00001&&b.max.x<=(f.x+f.halfWidth)/1000+.00001,id+' footprint encloses width');assert(b.min.z>=(f.z-f.halfDepth)/1000-.00001&&b.max.z<=(f.z+f.halfDepth)/1000+.00001,id+' footprint encloses depth');
  }
 }
 assert.equal(root.userData.childPersonality.age,l.ageStage);assert.equal(root.userData.childPersonality.posters,l.ageStage==='early'?1:5);assert(get('personality-mirror'));assert(get('personality-bag'));
 for(const id of ['personality-rear-gallery',...(l.ageStage==='early'?[]:['personality-right-gallery']),'personality-mirror','personality-hooks','personality-bedding','personality-cabinet',...(l.tier>=2?['personal-wardrobe']:[])]){
  const b=new THREE.Box3().setFromObject(get(id));assert(b.min.x>=-l.width/2000-.00001&&b.max.x<=l.width/2000+.00001,id+' within room width');assert(b.min.z>=l.back/1000-.00001&&b.max.z<=(l.back+l.depth)/1000+.00001,id+' within room depth');assert(b.min.y>=0&&b.max.y<=l.height/1000,id+' within room height');
 }
 if(l.tier>=2)assert(Math.abs(new THREE.Box3().setFromObject(get('personal-wardrobe')).min.y)<.00001,'Wardrobe grounded');
 const legacyDesk={pose:{x:l.width/2-(l.desktopSize==='60x30'?1050:900),z:l.back+920,yaw:0},style:{...CHILD_AGE_STAGES[l.ageStage].style,woodFinish:'White Oak'},phases:{}};
 upgradeChildDesk(legacyDesk,l);assert.equal(legacyDesk.style.woodFinish,'Pearl White');assert.deepEqual([legacyDesk.pose.x,legacyDesk.pose.z],l.desk);
 legacyDesk.style.woodFinish='Walnut';assert.equal(upgradeChildDesk(legacyDesk,l),false);assert.equal(legacyDesk.style.woodFinish,'Walnut','Later owner finish edits remain editable');
 const ownerDesk={pose:{x:37,z:1200,yaw:.2},phases:{}};upgradeChildDesk(ownerDesk,l);assert.deepEqual(ownerDesk.pose,{x:37,z:1200,yaw:.2},'Owner positioning is preserved');
 const chair=get('desk-stool'),oldChair={p:{x:l.width/2-(l.desktopSize==='60x30'?1050:900),y:0,z:l.back+920+(l.ageStage==='early'?800:950)},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}};
 assert.deepEqual(migrateChildRack(chair,oldChair,l).p,{x:chair.position.x,y:0,z:chair.position.z});oldChair.p.x+=20;assert.equal(migrateChildRack(chair,oldChair,l),oldChair,'Owner chair placements stay put');
 for(const a of placements){assert(a.x-a.halfWidth>=-l.width/2&&a.x+a.halfWidth<=l.width/2);assert(a.z-a.halfDepth>=l.back&&a.z+a.halfDepth<=l.back+l.depth);for(const b of placements){if(a===b)continue;assert(Math.abs(a.x-b.x)>=a.halfWidth+b.halfWidth||Math.abs(a.z-b.z)>=a.halfDepth+b.halfDepth,`${a.id} overlaps ${b.id}`);}}
 const rackBounds=new THREE.Box3().setFromObject(rack),nookBounds=new THREE.Box3().setFromObject(get('reading-nook'));assert(nookBounds.min.z-rackBounds.max.z>=.39,'Picture-book browsing approach');
 const obstacles=placements.map(a=>({minX:a.x-a.halfWidth,maxX:a.x+a.halfWidth,minZ:a.z-a.halfDepth,maxZ:a.z+a.halfDepth}));
 const roomBounds={minX:-l.width/2,maxX:l.width/2,minZ:l.back,maxZ:l.back+l.depth},foot={halfWidth:l.desktopSize==='60x30'?762:610,halfDepth:381,margin:45},poses=[{x:l.desk[0],z:l.desk[1],yaw:0},...Object.keys(CHILD_MODES).map(phase=>grooveDestination('childroom',l,phase))];
 for(const from of poses)for(const to of poses)assert(segmentIsClear(from,to,roomBounds,obstacles,foot),'Activity routes clear authored furniture');
 for(const [i,phase] of Object.keys(CHILD_MODES).entries()){
  room.roomAtmosphere(phase);root.updateMatrixWorld(true);for(let n=0;n<5;n++)assert.equal(get('play-'+n).visible,i===n);
  const destination=grooveDestination('childroom',l,phase);assert(poseIsClear(destination,{minX:-l.width/2,maxX:l.width/2,minZ:l.back,maxZ:l.back+l.depth},obstacles,{halfWidth:l.desktopSize==='60x30'?762:610,halfDepth:381,margin:45}),'48-inch desk target stays in its work bay');
  if(phase==='night'){assert.equal(root.getObjectByName('Child room · reading').intensity,0,'Reading light off at bedtime');assert(root.getObjectByName('Child room · moon').intensity>0);assert.equal(get('play-3').children.length,0,'Bedtime floor is clear');assert(root.userData.childLighting.blind>.8);}
  if(l.ageStage==='early'){
   assert.equal(root.userData.earlyYearsWalls.phase,phase);
   assert.equal(root.userData.earlyYearsLife.phase,phase);assert.equal(root.userData.earlyYearsLife.tidy,['evening','night'].includes(phase));
   assert.equal(root.userData.childActivity.participants,phase==='party'?earlyYearsProfile(l).partyParticipants:1);assert.equal(root.userData.earlyYearsLife.activeChildren,root.userData.childActivity.participants);
   if(l.tier>=2){const light=root.getObjectByName('Early years · making pendant');assert(light);if(phase==='night')assert.equal(light.intensity,0,'Making-zone lamp off for sleep');}
   if(l.tier>=2&&phase!=='party'){const kitchen=get('early-play-kitchen'),kits=kitchen.children.filter(o=>o.userData.earlyPhase);assert.equal(kits.filter(o=>o.visible).length,1);assert(kits.find(o=>o.visible).userData.earlyPhase==='put-away','Secondary pretend play is packed outside a shared session');}
   if(l.tier>=3&&earlyYearsProfile(l).motif!=='stories'&&phase!=='party')assert(get('early-small-world').children.some(o=>o.userData.earlyPhase==='resting'&&o.visible),'Secondary story house stays quiet');
  }
  else assert.equal(earlyYearsProfile(l),null,'Older rooms retain their separate age-specific design');
  if(phase==='evening'){assert.equal(get('play-2').children.length,0,'Storytime moves off the play mat');assert(get('reading-nook').children.some(o=>o.userData.childActivity==='evening'&&o.visible));}
  if(phase==='afternoon'&&l.ageStage==='early'&&l.tier<2)assert(root.getObjectByName('Portable floor drawing tray').visible,'Small rooms have a low drawing surface');
 }

 const wheels=[];get('play-4').traverse(o=>{if(o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===24)wheels.push(o);});assert.equal(wheels.length,l.ageStage==='early'?12:0);for(const wheel of wheels)assert(Math.abs(new THREE.Box3().setFromObject(wheel).min.y-.021)<.00001,'Train wheels meet track top');
 const floor=get('floor').children.find(o=>o.isInstancedMesh);assert(floor.material.map,'Floor clone receives wood grain');assert(root.ownedTextures.includes(floor.material.map));
 root.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
 const kit=createChildDeskKit({...helpers,ageStage:l.ageStage});assert.equal(kit.children.length,5);let nightCrayons=0;kit.children[3].traverse(o=>{if(o.geometry?.type==='CylinderGeometry')nightCrayons++;});assert.equal(nightCrayons,0,'Bedtime desk supplies put away');
 const m=material('#ffffff',{roughness:.31});m.userData.roomFinishLocked=true;roomSurfaceFinish(room,m,'powder');assert.equal(m.roughness,.31,'Authored glaze must survive shared finishing');
 const persisted=cleanSceneDeskData({rooms:{['childroom/'+l.id]:{desks:{},deleted:[]}}});assert(persisted.rooms['childroom/'+l.id],'Stage layout persists under its own key');
 console.log(l.id+': five activities, '+l.desktopSize+' desk, contacts, clearances, stage persistence and finish locks pass');
}
