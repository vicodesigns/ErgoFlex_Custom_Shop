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
import {CHILD_MATERIAL_STORIES} from '../child-material-detail.mjs';
for(const part of ['floor','rug','quilt','curtain','wood'])assert.equal(new Set(Object.values(CHILD_MATERIAL_STORIES).map(s=>s[part])).size,5,'Each life stage has its own '+part);
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
 {// the study chair faces the desk: its backrest (the highest part) is on the room side of the seat, and it says which way it faces
  const stool=get('desk-stool'),inv=stool.matrixWorld.clone().invert();stool.updateWorldMatrix(true,true);inv.copy(stool.matrixWorld).invert();
  if(l.ageStage!=='early'){let top=null;stool.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o).applyMatrix4(inv);if(!top||b.max.y>top.max.y)top=b;});
   assert(top.getCenter(new THREE.Vector3()).z>100,l.id+': the study chair has its back to the room, not to the desk');assert(stool.position.z>l.desk[1],l.id+': the chair is on the room side of the desk');}
  assert.equal(stool.userData.seatFront,'-z');}
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
  // Lighting pass: stage light character without new lights or shadow casters; practicals stay on the walls.
  {const cl=root.userData.childLighting,points=[];root.traverse(o=>{if(o.isLight)points.push(o);});assert.equal(cl.stage,l.ageStage);assert(points.every(p=>p.isPointLight&&!p.castShadow&&/^(Child room|Early years) · /.test(p.name)),'No extra or shadow-casting lights');
   root.traverse(o=>{if(o.userData.childLightDecal)assert(!o.castShadow&&o.userData.presentationOnly&&o.material.depthWrite===false,'Light decals are overlay only');if(o.userData.childLightingDetail){const b=new THREE.Box3().setFromObject(o);assert(b.min.x>=-l.width/2000-.00001&&b.max.x<=l.width/2000+.00001&&b.min.z>=l.back/1000-.00001&&b.min.y>.1&&b.max.y<l.height/1000,o.userData.propId+' stays on its wall');}});
   if(phase==='night')assert(cl.practicals.length>0||l.ageStage==='early'&&cl.moon>0,'A low warm practical at bedtime');if(phase==='night'&&l.ageStage==='teen')assert.equal(cl.practicals.includes('neon'),false,'Neon off for sleep');
   // Round 2: the old moon disc is the toddler's only; older stages carry the bedtime light in their own practical.
   if(l.ageStage!=='early'){let disc=false;get('moon-light').traverse(o=>{if(o.isMesh&&o.visible)disc=true;});assert(!disc,'Moon disc only in the early-years room');let host=root.getObjectByName('Child room · moon').parent;assert(host?.name==='Child light anchor','Bedtime light moved into the stage practical');}
   if(l.ageStage==='primary'&&root.userData.childWallLife?.rects?.right?.some(r=>r.id==='wall-primary-door'))assert.equal(cl.hallDoor,'right','Hall light enters under the real door');}
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
 // Materials pass: stage story, patina on the floor, wear on cutaway walls, a grounded curled rug.
 const mats=root.userData.childMaterials;assert.equal(mats?.stage,l.ageStage);assert.equal(mats.floor,CHILD_MATERIAL_STORIES[l.ageStage].floor);assert(mats.decals>=4);assert.equal(root.getObjectByName('Floor patina · a year of use').parent,get('floor'));
 for(const wall of ['rear','right']){const o=root.getObjectByName('Wall wear · '+wall);assert(room.walls.some(w=>w.obj===o.parent),'Wear decals ride on their cutaway wall');const b=new THREE.Box3().setFromObject(o);assert(b.min.y>0&&b.max.y<l.height/1000&&b.min.x>=-l.width/2000-.00001&&b.max.x<=l.width/2000+.00001&&b.min.z>=l.back/1000-.00001&&b.max.z<=(l.back+l.depth)/1000+.00001,'Wear decals stay on the wall faces');}
 const rugBody=root.getObjectByName('Play rug · '+mats.rug),rugBox=new THREE.Box3().setFromObject(rugBody);assert(Math.abs(rugBox.min.y)<.00001&&rugBox.max.y<.04,'Curled rug corner stays grounded and low');
 const sw=new THREE.Box3().setFromObject(root.getObjectByName('Light switch · fingerprinted plate'));assert(sw.max.x<=l.width/2000+.00001&&sw.max.z<=(l.back+l.depth)/1000,'Switch plate on the wall face');
 assert(new THREE.Box3().setFromObject(root.getObjectByName('Wall wear · rear')).max.y<=.4,'Rear wall above shoe height belongs to the wall-art layer');
 assert(mats.paint?.wall&&mats.paint.trim,'Paint base published for the wall layer');assert(root.getObjectByName('Quilt corner turned back'),'Worn, turned-back quilt corner');
 // Walls pass: lived-in wall clusters stay on their wall, clear of the glazing, of other wall decor and of each other; merged and cheap.
 {const wl=root.userData.childWallLife,inv=root.matrixWorld.clone().invert(),mmBox=o=>new THREE.Box3().setFromObject(o).applyMatrix4(inv),W=l.width/2,front=l.back+l.depth,wz=l.back+1500;
  assert.equal(wl.stage,l.ageStage);assert(wl.clusters>=(l.ageStage==='early'?5:7),'Each stage dresses its walls: '+wl.fixtures);
  const surfaces=new Set(['floor','play-rug','early-rear-mural','early-right-mural','personality-bed-paint','sleeping-arch','light-neon-sign-teen']),mine=wl.fixtures.map(id=>[id,get(id),mmBox(get(id))]),others=[];let meshes=0;
  const shown=o=>{for(let a=o;a&&a!==root;a=a.parent)if(!a.visible)return false;return true;};
  root.traverse(o=>{if(o.userData.childWallLife&&o.isMesh)meshes++;const id=o.userData.propId;if(id&&!surfaces.has(id)&&!o.userData.childWallLife&&shown(o)&&!wl.fixtures.includes(id))others.push([id,mmBox(o)]);});
  assert(meshes<=wl.clusters*3,'Wall clusters are merged: '+meshes+' meshes');
  const hits=(a,b,t=2)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>t&&Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y)>t&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>t;
  for(const [id,o,b] of mine){assert(o.userData.wallDecoration&&o.userData.dropSurface===false,id+' is wall decor');
   assert(b.min.x>=-W-1&&b.max.x<=W+70&&b.min.z>=l.back-1&&b.max.z<=front+1&&b.min.y>=-1&&b.max.y<=l.height-20,id+' inside the room shell');
   o.traverse(m=>{if(m.isMesh&&m.material.map)assert(!m.castShadow,id+' paper casts no shadow');});
   if(/window-sill|window-stickers/.test(id)){assert(b.min.z>=wz-750&&b.max.z<=wz+750&&b.min.y>=849,id+' stays in the window opening');continue;}
   if(/curtain-pole/.test(id)){assert(b.min.y>=850+1450,id+' above the glazing');continue;}
   if(/skirting/.test(id)){assert(b.max.y<=101,id+' is skirting height');if(wl.door)o.traverse(m=>{if(m.isMesh){const p=m.geometry.attributes.position,v=new THREE.Vector3(),toRoot=inv.clone().multiply(m.matrixWorld);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(toRoot);assert(Math.abs(v.z-wl.door.u)>=wl.door.width/2+80-1,'Skirting stops at the door casing');}}});continue;}
   if(b.max.x>W-200&&b.max.y>740)assert(b.max.z<wz-1020||b.min.z>wz+1020,id+' clear of the window and curtains');
   if(o.userData.wallPaint){assert(b.min.z>=l.back-1&&b.max.z<=l.back+31,id+' is a paint layer on the wall face');continue;}
   if(/string-lights/.test(id)||o.userData.wallComposite){const v=new THREE.Vector3();o.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,toRoot=inv.clone().multiply(m.matrixWorld);for(let i=0;i<p.count;i+=7){v.fromBufferAttribute(p,i).applyMatrix4(toRoot);for(const [other,q] of [...others,...mine.filter(([i2,o2])=>i2!==id&&!o2.userData.wallPaint&&!o2.userData.wallComposite&&!/string-lights|skirting/.test(i2)).map(([i2,,q2])=>[i2,q2])])assert(!q.clone().expandByScalar(-2).containsPoint(v),id+' drapes through '+other);}});continue;}
   for(const [other,q] of others)assert(!hits(b,q),id+' overlaps '+other);
   for(const [id2,o2,q] of mine)if(id2!==id&&!o2.userData.wallPaint&&!o2.userData.wallComposite&&!/curtain-pole|window-|skirting|string-lights/.test(id2))assert(!hits(b,q),id+' overlaps '+id2);}
  const glow=n=>{let mat=null;root.traverse(o=>{if(o.userData.childWallLife&&o.isMesh&&o.name===n)mat=o.material;});return mat;};
  room.roomAtmosphere('night');const phosphor=glow('Glow-in-the-dark stickers'),bulbs=glow('Warm fairy lights · emissive only');
  if(phosphor)assert(phosphor.emissiveIntensity>0,'Glow stickers glow at bedtime');if(bulbs)assert(bulbs.emissiveIntensity<=.3,'String lights at most a low glow for sleep');
  room.roomAtmosphere('morning');if(phosphor)assert.equal(phosphor.emissiveIntensity,0);}
 // Lived-in pass: measured floor clusters register footprints that enclose them (so the overlap and desk-route
 // checks above include them), loose belongings are put away at bedtime, and each phase draws few merged meshes.
 {const li=root.userData.childLivedIn,inv=root.matrixWorld.clone().invert();assert.equal(li.age,l.ageStage);
  if(/^house/.test(l.id))assert(li.floorIds.length>=2,'House rooms gain lived-in floor clusters: '+li.floorIds);
  for(const id of li.floorIds){const o=get(id),b=new THREE.Box3().setFromObject(o).applyMatrix4(inv),f=placements.find(p=>p.id===id);assert(f,id+' registers a footprint');assert(Math.abs(b.min.y)<1,id+' grounded');
   assert(b.min.x>=f.x-f.halfWidth-.5&&b.max.x<=f.x+f.halfWidth+.5&&b.min.z>=f.z-f.halfDepth-.5&&b.max.z<=f.z+f.halfDepth+.5,id+' footprint encloses it');}
  const shown=o=>{for(let a=o;a&&a!==root;a=a.parent)if(!a.visible)return false;return true;};
  for(const phase of Object.keys(CHILD_MODES)){room.roomAtmosphere(phase);root.updateMatrixWorld(true);let drawn=0;root.traverse(o=>{if(o.isMesh&&shown(o)){let lived=false;for(let a=o;a&&a!==root;a=a.parent)if(a.userData.childLivedIn)lived=true;if(lived)drawn++;}});
   assert(drawn<=70,'Lived-in belongings stay batched: '+drawn+' meshes in '+phase);if(phase==='night')assert.equal(li.looseOut,0,'Loose belongings put away at bedtime');}
  room.roomAtmosphere('morning');}
 // Round-3 finisher: no coplanar shell under the window-wall skin, cabinet tops low enough for the wall
 // art above them, the giant bear put away at bedtime, and the college lamp found by its tag, not its size.
 {const inv=root.matrixWorld.clone().invert(),mm=o=>new THREE.Box3().setFromObject(o).applyMatrix4(inv),wl=root.userData.childWallLife;
  let skin=null;root.traverse(o=>{if(o.name==='Window wall plaster skin')skin=o;});assert(skin,'Window-wall plaster skin');
  for(const o of skin.parent.children)if(o.isMesh&&o.geometry?.parameters?.width===80)assert(mm(o).min.x>=l.width/2+5-.01,'Window-wall shell sits 5 mm+ behind the skin (no z-fighting)');
  for(const id of ['personality-cabinet','growth-cabinet-top-'+l.ageStage]){const o=get(id);if(o)assert(mm(o).max.y<=906,id+' stays under the wall art above the cabinet');}
  if(['teen','college'].includes(l.ageStage)&&/^house/.test(l.id))assert(wl.fixtures.includes('wall-'+l.ageStage+'-guitar'),'The guitar keeps its wall');
  if(l.ageStage==='early'){const bear=get('lived-nook-early'),shown=o=>{for(let a=o;a&&a!==root;a=a.parent)if(!a.visible)return false;return true;};let onChest=null;root.traverse(o=>{if(o.name==='Giant bear put away on the toy chest')onChest=o;});
   room.roomAtmosphere('night');if(bear)bear.traverse(o=>{if(o.isMesh)assert(!shown(o),'Giant bear off the floor cushion at bedtime');});if(onChest)assert(shown(onChest),'Giant bear sat on the toy chest at bedtime');room.roomAtmosphere('morning');}
  if(get('lived-nook-college')){let shade=null;get('lived-nook-college').traverse(o=>{if(o.userData.lampShade)shade=o;});assert(shade,'College lamp shade is tagged');assert.equal(root.userData.childLighting.readingLamp,'nook side-table lamp','Reading light lives in the tagged shade');assert(mm(shade).max.y<1000,'The reading lamp is a low corner lamp, not a pole');}}
 root.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
 const kit=createChildDeskKit({...helpers,ageStage:l.ageStage});assert.equal(kit.children.length,5);let nightCrayons=0;kit.children[3].traverse(o=>{if(o.geometry?.type==='CylinderGeometry')nightCrayons++;});assert.equal(nightCrayons,0,'Bedtime desk supplies put away');
 const m=material('#ffffff',{roughness:.31});m.userData.roomFinishLocked=true;roomSurfaceFinish(room,m,'powder');assert.equal(m.roughness,.31,'Authored glaze must survive shared finishing');
 const persisted=cleanSceneDeskData({rooms:{['childroom/'+l.id]:{desks:{},deleted:[]}}});assert(persisted.rooms['childroom/'+l.id],'Stage layout persists under its own key');
 console.log(l.id+': five activities, '+l.desktopSize+' desk, contacts, clearances, stage persistence and finish locks pass');
}
