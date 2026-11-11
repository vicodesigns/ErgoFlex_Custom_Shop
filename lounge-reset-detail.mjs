import * as THREE from 'three';
import {loungeDesign} from './lounge-design.mjs';

// Measured additions retain the existing furniture/editor identities. Tables
// keep their original top elevation so activity dressing still has support.
export function buildLoungeDetails({room,root,layout:l,helpers:h,materials:m,groups}){
 const p=loungeDesign(l),{box,mesh,material,markSceneAsset}=h,front=l.back+l.depth,phaseObjects=[];
 const mat=(color,extra={})=>{const a=material(color,{roughness:.86,metalness:0,...extra});a.userData.roomFinishLocked=true;return a;};
 const texture=(draw,w=512,hh=512)=>{const c=document.createElement('canvas');c.width=w;c.height=hh;draw(c.getContext('2d'),w,hh);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;(root.ownedTextures||=[]).push(t);return t;};
 const stoneMap=texture((c,w,hh)=>{c.fillStyle='#ddd9ce';c.fillRect(0,0,w,hh);for(let i=0;i<2800;i++){const x=(Math.sin(i*27.17)*.5+.5)*w,y=(Math.sin(i*41.31+4)*.5+.5)*hh;c.fillStyle=i%2?'#fffdf51a':'#74695716';c.fillRect(x,y,1+i%2,1);}c.strokeStyle='#afa69630';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(-20,i*140);c.bezierCurveTo(w*.2,i*140-30,w*.7,i*140+90,w+20,i*140+50);c.stroke();}});
 const stone=mat('#f2efe7',{map:stoneMap,roughness:.78});stone.userData.roomSurface='stone';
 const feature=mat(p.feature,{roughness:.98}),paper=mat('#eae4d7',{roughness:.98});
 const fixture=(parent,id,name,at,turn=0)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;g.userData={propId:id,sceneAssetName:name,wallDecoration:true,dropSurface:false};parent.add(g);markSceneAsset(g,{key:`lounge:${l.id}:fixture:${id}`});return g;};
 // A quiet framed textile-like composition above the seating corner. Warm
 // paper, matte pigment and generous margins separate art from the game wall.
 const art=fixture(groups.left,'lounge-collected-art','Framed study in colour and shape',[-l.width/2+20,1820,front-650],Math.PI/2);
 const artMap=texture((c,w,hh)=>{c.fillStyle='#eee9de';c.fillRect(0,0,w,hh);c.fillStyle=p.accent;c.beginPath();c.ellipse(w*.4,hh*.47,w*.21,hh*.3,-.25,0,Math.PI*2);c.fill();c.fillStyle=p.dark;c.globalAlpha=.62;c.fillRect(w*.49,hh*.28,w*.22,hh*.48);c.globalAlpha=1;c.strokeStyle=p.metal;c.lineWidth=3;c.beginPath();c.moveTo(w*.14,hh*.76);c.bezierCurveTo(w*.65,hh*.35,w*.32,hh*.9,w*.86,hh*.6);c.stroke();},640,800);
 box(art,[660,800,24],[0,0,0],m.walnut,5);box(art,[615,755,2],[0,0,13],paper,2);const image=mesh(art,new THREE.PlaneGeometry(550,680),mat('#ffffff',{map:artMap}),[0,0,14.2]);image.castShadow=false;
 // Acoustic felt panels group the display and sconces into one media bay.
 const mediaPanel=fixture(groups.right,'lounge-media-panel','Felt-lined media wall',[l.width/2-4,1260,l.loungeZ],-Math.PI/2);
 box(mediaPanel,[1900,1580,5],[0,0,0],feature,18);for(const x of [-975,975])box(mediaPanel,[8,1490,8],[x,0,4],m.brass,2);
 if(l.tier>=3){
  const runner=new THREE.Group();runner.name='Woven refreshments runner';runner.userData.presentationOnly=true;root.add(runner);box(runner,[650,4,1800],[-l.width/2+1160,2,l.barZ],mat(p.rug,{roughness:1}),9);
 }
 const ceramic=mat(p.accent,{roughness:.42}),metal=mat(p.metal,{roughness:.34,metalness:.88});
 // Candle flames remain off in daylight. Only source-authored flame meshes
 // are collected, so art and screen pixels cannot be mistaken for lights.
 root.traverse(o=>{if(o.isMesh&&o.material===m.flame)phaseObjects.push(o);});
 const copies=new Map();
 const finishProp=(object,id)=>{
  object.traverse(o=>{if(!o.isMesh)return;const finish=source=>{if(!source?.isMeshStandardMaterial||!id.startsWith('arcade-'))return source;if(copies.has(source))return copies.get(source);const c=source.clone();c.userData.sharedTextures=true;c.userData.roomPaletteLocked=true;room.ownedMaterials.add(c);if(source.name==='Original colored side panels'){c.color.set(p.dark);c.roughness=.72;}if(source.name==='Accent trim'){c.color.set(p.accent);c.roughness=.55;}copies.set(source,c);return c;};o.material=Array.isArray(o.material)?o.material.map(finish):finish(o.material);});
 };
 const decorate=(object,placement)=>{
  finishProp(object,placement.id);
  if(placement.id!=='coffee-table')return;
  // Native library roots use metres at 1000x. Replacing only the contents
  // retains saved root transforms, tabletop anchors and original prop keys.
  for(const child of [...object.children])object.remove(child);
  object.name='Honed limestone & timber coffee table';object.userData.sceneAssetName=object.name;object.userData.loungeTable='honed-stone-v1';object.userData.roomSupportHeights=[.3912];
  box(object,[1.2,.035,.7061],[0,.3737,0],stone,.09);
  for(const x of [-.37,.37])box(object,[.13,.33,.47],[x,.165,0],m.walnut,.035);
  box(object,[.91,.024,.44],[0,.065,0],m.walnut,.035);
  // A closed design journal on the lower shelf keeps the top available for
  // the existing tea, controller and daily-life trays.
  box(object,[.22,.018,.16],[.18,.086,0],ceramic,.004);box(object,[.205,.012,.15],[.18,.101,0],paper,.002);box(object,[.22,.003,.16],[.18,.1085,0],ceramic,.002);
  box(object,[.07,.001,.12],[.18,.1105,0],metal,.001);
 };
 root.userData.loungeDesign={revision:2,style:l.style,window:{start:l.back+2300-(l.tier?1850:1350)/2,end:l.back+2300+(l.tier?1850:1350)/2,clearance:200},deskFeature:{x:0,z:l.desk[1]},barZ:l.tier>=3?l.barZ:null,palette:p.name,desk:{...p.desk},zones:['work','listening','conversation','media',...(l.tier>=3?['refreshments','table games']:[])],tableTopMm:391.2,phase:'afternoon'};
 return {decorate,update(phase){const candle=['evening','night','party'].includes(phase);phaseObjects.forEach(o=>o.visible=candle);root.userData.loungeDesign.phase=phase;}};
}
