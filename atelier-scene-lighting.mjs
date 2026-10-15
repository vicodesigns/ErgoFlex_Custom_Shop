import * as THREE from 'three';
const scenes=new Set(['music','bedroom','study','library','office','creative','coworking','gallery','lounge']);
export function atelierSceneLamp(scene,placement,index){
 if(!scenes.has(scene))return null;
 const floor=placement.id==='kenney-furniture-lamp-round-floor',table=placement.id==='kenney-furniture-lamp-round-table';
 if(!floor&&!table)return null;
 const id=`atelier-lamp-${floor?'tripod':'mushroom'}-${['bedroom','gallery'].includes(scene)?'stone':'warm'}`;
 const entry=index.props.find(p=>p.id===id),old=index.props.find(p=>p.id===placement.id);if(!entry?.size||!old?.size)return null;
 const fit=Math.min(1,old.size[0]/entry.size[0],old.size[2]/entry.size[2]);return fit>=.9?{id,entry,fit}:null;
}
export function bindAtelierLamp(room,object,entry,fit=1){
 if(!entry?.atelierLamp)return;
 const owned=new Map(),glows=[];
 object.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!m.userData.atelierGlow)return m;if(!owned.has(m)){const copy=m.clone();room.ownedMaterials.add(copy);owned.set(m,copy);glows.push({material:copy,base:m.userData.atelierGlow});}return owned.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
 const units=(room.root?.scale.x||room.scale)*1000;
 const light=new THREE.PointLight('#ffd6a1',0,2.5*units,2);light.name='Atelier practical glow';
 light.position.fromArray(entry.atelierLamp.lightAnchor).multiplyScalar(fit);light.userData.presentationOnly=true;object.add(light);
 const fixture={object,glows,light,power:.6*units**2};(room.atelierLamps||=[]).push(fixture);
 object.userData.atelierLamp={...entry.atelierLamp,fit};applyAtelierLighting(room,...(room.atelierLampPhase||['afternoon',1]));
}
export function applyAtelierLighting(room,mode='afternoon',accent=1){
 room.atelierLampPhase=[mode,accent];const level=({morning:.16,afternoon:.3,evening:.85,night:.65,party:1}[mode]??.3)*Math.max(0,accent);
 for(const f of room.atelierLamps||[]){f.light.intensity=f.power*level;for(const g of f.glows)g.material.emissiveIntensity=g.base*level;}
}
