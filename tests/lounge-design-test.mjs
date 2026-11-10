import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {LOUNGE_LAYOUTS,LOUNGE_MODES,loungeLayoutIdForStyle,loungeLayoutsForStyle,buildLoungeRoom} from '../lounge-room.mjs';
import {LOUNGE_DESIGNS,loungeDeskTheme,upgradeLoungeDesk} from '../lounge-design.mjs';
import {cleanDeskStyle} from '../room-desk-styles.mjs';
import {cleanSceneDeskVariant,seedSceneDeskSize} from '../scene-desk-data.mjs';
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:512,height:512,getContext:context})};
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra});
const mesh=(p,g,m,at=[0,0,0])=>{const o=new THREE.Mesh(g,m);o.position.set(...at);p.add(o);return o;};
const box=(p,size,at,m,r=0)=>mesh(p,r?new RoundedBoxGeometry(...size,2,r):new THREE.BoxGeometry(...size),m,at);
const sphere=(p,size,at,m)=>{const o=mesh(p,new THREE.SphereGeometry(1,16,12),m,at);o.scale.set(...size);return o;};
const rod=(p,a,b,r,m)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),o=mesh(p,new THREE.CylinderGeometry(r,r,delta.length(),12),m);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
const helpers={material,mesh,box,sphere,rod,markSceneAsset:(o,{key})=>o.userData.sceneAssetKey=key};
for(const style of ['earthy','contemporary'])assert.equal(Object.keys(loungeLayoutsForStyle(style)).length,5);
assert.equal(loungeLayoutIdForStyle('premium','contemporary'),'premiumcontemporary');
assert.equal(loungeLayoutIdForStyle('premiumcontemporary','earthy'),'premium');
assert.notEqual(LOUNGE_LAYOUTS.premium.props,LOUNGE_LAYOUTS.premiumcontemporary.props,'Style placements have independent ownership');
for(const l of Object.values(LOUNGE_LAYOUTS)){
 assert(cleanDeskStyle(loungeDeskTheme(l)));const root=new THREE.Group();root.scale.setScalar(.001);const room={root,id:'lounge',roomLayout:l,walls:[],ownedMaterials:new Set()};buildLoungeRoom(room,root,l,helpers);root.updateMatrixWorld(true);
 const find=id=>{let out;root.traverse(o=>{if(o.userData.propId===id)out=o;});return out;};
 for(const id of (l.style==='contemporary'?['modern-desk-feature','modern-wide-art','modern-media-wall','modern-sculpture','modern-sofa-gallery','modern-window-textiles','modern-reading-table',...(l.tier>=2?['modern-wall-relief','modern-curated-credenza','modern-library-wall','modern-desk-side-art']:l.tier===1?['modern-desk-side-art']:[]),...(l.tier>=3?['modern-social-table']:[])]:['lounge-media-panel','lounge-collected-art','reading-lamp','side-table','listening-station'])){const obj=find(id),b=new THREE.Box3().setFromObject(obj);assert(b.min.x>=-l.width/2000-.001&&b.max.x<=l.width/2000+.001,id+' room width');assert(b.min.z>=l.back/1000-.001&&b.max.z<=(l.back+l.depth)/1000+.001,id+' room depth');assert(b.min.y>=-.001&&b.max.y<=l.height/1000+.001,id+' room height');}
 root.traverse(object=>{if(!object.userData.stagedSupportUuid)return;const support=root.getObjectByProperty('uuid',object.userData.stagedSupportUuid);assert(support,'Every staged book has a real shelf');const bookBox=new THREE.Box3().setFromObject(object),shelfBox=new THREE.Box3().setFromObject(support);assert(Math.abs(bookBox.min.y-shelfBox.max.y)<.0001,'Books rest on shelf tops rather than floating or intersecting');});
 const separated=(a,b)=>{a=new THREE.Box3().setFromObject(find(a));b=new THREE.Box3().setFromObject(find(b));return a.max.x<b.min.x||a.min.x>b.max.x||a.max.z<b.min.z||a.min.z>b.max.z;};
 if(l.style==='earthy')assert(separated('reading-lamp','side-table'),'Reading lamp and side table have separate footprints');if(l.style==='earthy'&&l.tier===1)assert(separated('listening-station','media-console'),'Home record cabinet clears the media console');
 const top=new THREE.Group();top.scale.setScalar(1000);const oldGeometry=new THREE.BoxGeometry(1,1,1),old=mesh(top,oldGeometry,material('#ffffff'));old.userData.sharedProp=true;root.add(top);room.decorateProp(top,{id:'coffee-table'});root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(top);assert(Math.abs(b.max.y-.3912)<1e-6,'Activity surface stays at 391.2 mm');assert(Math.abs(b.min.y)<1e-6,'New table rests on floor');assert(b.max.x-b.min.x<=1.201&&b.max.z-b.min.z<=.707,'Replacement respects original footprint');assert.equal(top.userData.loungeTable,l.style==='contemporary'?'contemporary-stone-v2':'honed-stone-v1');assert.equal(old.geometry,oldGeometry,'Source library geometry stays untouched');
 for(const phase of Object.keys(LOUNGE_MODES)){room.roomAtmosphere(phase);assert.equal(root.userData.loungeDesign.phase,phase);assert.equal(root.userData.atmosphere,phase);assert.equal(root.children.filter(o=>o.isPointLight).length,l.style==='contemporary'?(l.tier>=2?8:6):4,'Practical lights match visible fixtures');assert.equal(root.children.filter(o=>o.isLight&&o.castShadow).length,0,'Practical lights add no shadow maps');}
 const state={pose:{x:5,z:10,yaw:.2},height:28,tilt:0,size:'48x30',style:{woodFinish:'Walnut',baseFinish:'Sand',trimColor:'#f19c00',sheen:'satin'},objects:{},phases:{}};assert(upgradeLoungeDesk(state,l));assert.equal(state.style.woodFinish,LOUNGE_DESIGNS[l.id].desk.woodFinish);assert.deepEqual(state.pose,{x:5,z:10,yaw:.2},'Finish upgrade leaves owner positioning');state.style={woodFinish:'Bordeaux',baseFinish:'White',trimColor:'#f5f5f2',sheen:'matte'};assert(!upgradeLoungeDesk(state,l));assert.equal(state.style.woodFinish,'Bordeaux','Later owner finishes survive');assert.equal(cleanSceneDeskVariant(state).loungeDesignRevision,2);assert.equal(seedSceneDeskSize(state,'60x30').loungeDesignRevision,2);
 if(l.style==='earthy'){const tablePlacement=l.props.find(p=>p.id==='coffee-table');top.userData.propId='coffee-table';top.position.fromArray(tablePlacement.at);top.rotation.y=Math.PI/2;const legacyTransform={p:{x:-l.width/2+(l.tier?1630:1320),y:0,z:l.loungeZ},q:{x:top.quaternion.x,y:top.quaternion.y,z:top.quaternion.z,w:top.quaternion.w},s:{x:1000,y:1000,z:1000}};assert.equal(room.migrateSavedTransform(top,legacyTransform).p.x,tablePlacement.at[0],'Untouched old table follows the new arrangement');const edited=structuredClone(legacyTransform);edited.p.x+=25;assert.equal(room.migrateSavedTransform(top,edited),edited,'Owner furniture moves survive');const scaled=structuredClone(legacyTransform);scaled.s.x=900;assert.equal(room.migrateSavedTransform(top,scaled),scaled,'Owner scaled furniture stays placed');}
 const custom={style:{woodFinish:'Bordeaux',baseFinish:'Black',trimColor:'#85888c'}};assert(!upgradeLoungeDesk(custom,l));assert.equal(custom.style.woodFinish,'Bordeaux');
 assert.equal(l.desk[0],0,'Desk is centered on the rear feature wall');if(l.tier>=3){const bar=find(l.style==='contemporary'?'modern-refreshments':'lounge-bar'),bb=new THREE.Box3().setFromObject(bar);assert(bb.min.z*1000-(l.back+3225)>=200,'The entire refreshments unit clears the window by 200 mm');}
 console.log(l.id+': measured decoration, table supports, five light states and finish ownership pass');
}
// Lighting binds shader-owned material copies before deferred art can arrive.
// The real rendered face and its retained source must both receive the image.
const queuedArt=[],textureLoad=THREE.TextureLoader.prototype.load;
document.createElementNS=()=>({});
THREE.TextureLoader.prototype.load=function(url,onLoad){queuedArt.push(onLoad);return new THREE.Texture();};
try{
 const l=LOUNGE_LAYOUTS.premiumcontemporary,root=new THREE.Group();root.scale.setScalar(.001);
 const room={root,id:'lounge',roomLayout:l,walls:[],ownedMaterials:new Set()};buildLoungeRoom(room,root,l,helpers);
 let painting;root.traverse(o=>{if(o.userData.propId==='modern-sofa-gallery')o.traverse(c=>{if(c.geometry?.type==='PlaneGeometry')painting=c;});});
 const original=painting.material,fallback=original.map,rendered=original.clone();painting.material=rendered;
 const imageTexture=new THREE.Texture({width:1536,height:1024});queuedArt.shift()(imageTexture);
 assert.equal(await room.loungeArtReady,true);assert.equal(painting.material,rendered,'Light-bound material identity survives image arrival');
 assert.notEqual(rendered.map,fallback,'The visible frame replaces its fallback artwork');assert.equal(rendered.map,original.map,'Live and retained materials use the same painted texture');
 assert.equal(root.userData.loungeArt.status,'ready');
 console.log('Deferred painted artwork updates the rendered light-bound material.');
}finally{THREE.TextureLoader.prototype.load=textureLoad;delete document.createElementNS;}
