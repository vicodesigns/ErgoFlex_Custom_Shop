const roomBeds={apartment:'atelier-bed-tatami-compact',house:'atelier-bed-platform-queen',spacious:'atelier-bed-wingback-ivory',premium:'atelier-bed-canopy-walnut',executive:'atelier-bed-platform-graphite'};
export function atelierSceneBed(scene,layout,placement,index){
 if(scene!=='bedroom'||!['bed','bed-2'].includes(placement.id))return null;
 const id=roomBeds[layout?.id];if(!id)return null;
 const entry=index.props.find(p=>p.id===id),old=index.props.find(p=>p.id===placement.id);if(!entry?.size||!old?.size)return null;
 // The bedroom has a small reserve around its legacy bed footprint. Use
 // that measured bay to retain an adult-length mattress, with 10 mm at the
 // rear wall, at least 25 mm beside nightstands and 100+ mm before the bench.
 const nightstand=layout.bedside?.[0],sideGap=nightstand?2*(Math.abs(nightstand[0]-placement.at[0])-205-25):old.size[0];
 const capacity={width:Math.min(old.size[0]+(placement.id==='bed'?80:0),sideGap),depth:Math.min(2100,2*(placement.at[2]-layout.back-10))};
 const fit=Math.min(1,capacity.width/entry.size[0],capacity.depth/entry.size[2]);
 if(fit<.94)return null;
 // Original bed-2 faces the opposite way; keep its saved root orientation.
 return {id,entry,fit,capacity,flip:placement.id==='bed-2'};
}
export function bindAtelierBed(room,object,entry){
 if(!entry?.atelierBed)return;
 const copies=new Map(),glows=[];
 object.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!m.userData.atelierBedGlow)return m;if(!copies.has(m)){const copy=m.clone();room.ownedMaterials.add(copy);copies.set(m,copy);glows.push({material:copy,base:m.userData.atelierBedGlow});}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
 (room.atelierBedGlows||=[]).push(...glows);applyAtelierBedLighting(room,...(room.atelierLampPhase||['afternoon',1]));
}
export function applyAtelierBedLighting(room,mode='afternoon',accent=1){
 const level=({morning:.04,afternoon:.08,evening:.55,night:.16,party:.35}[mode]??.08)*Math.max(0,accent);
 for(const g of room.atelierBedGlows||[])g.material.emissiveIntensity=g.base*level;
}
