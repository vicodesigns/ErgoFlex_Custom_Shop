export function atelierSceneDecor(scene,placement,index){
 if(!['office','coworking','library','study','creative','music','gaming','lounge','bedroom','gallery'].includes(scene))return null;
 let id;
 if(placement.id==='kenney-furniture-books')id='atelier-decor-bookends-'+(['office','coworking','creative','bedroom','gallery'].includes(scene)?'nordic':'heritage');
 else if(placement.id==='globe'&&['library','study'].includes(scene))id='atelier-decor-orrery-heritage';
 else if(placement.id==='decor-plant1'&&['coworking','office'].includes(scene))id='atelier-decor-terrarium-matcha';
 if(!id)return null;const entry=index.props.find(p=>p.id===id),old=index.props.find(p=>p.id===placement.id);if(!entry?.size||!old?.size)return null;
 const fit=Math.min(1,old.size[0]/entry.size[0],old.size[2]/entry.size[2]);return fit>=.9?{id,entry,fit}:null;
}
export function bindDeskDecor(room,object,entry){
 if(!entry?.atelierDecor)return;const copies=new Map(),glows=[];
 object.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!m.userData.decorGlow)return m;if(!copies.has(m)){const c=m.clone();c.userData.sharedTextures=true;room.ownedMaterials.add(c);copies.set(m,c);}glows.push({object:o,material:copies.get(m),base:m.userData.decorGlow,flame:m.name==='Decor candle flame'});return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
 (room.atelierDecorGlows||=[]).push(...glows);object.userData.atelierDecor=entry.atelierDecor;applyDeskDecorLighting(room,...(room.atelierLampPhase||['afternoon',1]));
}
export function applyDeskDecorLighting(room,mode='afternoon',accent=1){
 const gain=({morning:.1,afternoon:.15,evening:.8,night:.5,party:1}[mode]??.15)*Math.max(0,accent),flameOn=['evening','night','party'].includes(mode)&&gain>0;
 for(const g of room.atelierDecorGlows||[]){g.material.emissiveIntensity=g.base*gain;if(g.flame)g.object.visible=flameOn;}
}
