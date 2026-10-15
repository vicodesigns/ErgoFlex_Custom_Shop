// Keep the original editor roots/keys. Fitted models live beneath those roots,
// so restoring an edited room scale cannot remove their dimensional fit.
export function atelierSceneGaming(scene,layout,placement,index){
 let id,capacity,turn=0,offset=[0,0,0];
 if(placement.id==='game-controller'&&['gaming','lounge'].includes(scene)){
  id='atelier-gaming-controller-'+(scene==='lounge'?'arctic':'cyber');
  capacity=index.props.find(p=>p.id===placement.id)?.size;
 }else if(scene==='gaming'&&placement.id==='handheld-console'){
  // Both the ottoman and coffee table have room for a full-size modern handheld.
  id='atelier-gaming-handheld-cyber';capacity=[280,150,100];
 }else if(scene==='gaming'&&placement.id==='ergoflex-desktop-pc'&&!layout?.large){
  // Narrow SFF chassis leaves the left/front area free for headphones and macros.
  id='atelier-gaming-pc-cyber';capacity=[220,450,400];offset=[.025,0,0];
 }
 if(!id||!capacity)return null;
 const entry=index.props.find(p=>p.id===id);if(!entry?.size)return null;
 const fit=Math.min(1,capacity[0]/entry.size[0],capacity[1]/entry.size[1],capacity[2]/entry.size[2]);
 return fit>=.9?{id,entry,fit,turn,offset,capacity}:null;
}
export function bindGamingGear(room,object,entry){
 if(!entry?.atelierGaming)return;
 const copies=new Map(),glows=[];
 object.traverse(o=>{if(!o.isMesh)return;const owned=m=>{
  if(!m.userData.gamerGlow&&!m.userData.sceneDisplay)return m;
  if(!copies.has(m)){const c=m.clone();c.userData.sharedTextures=true;room.ownedMaterials.add(c);copies.set(m,c);if(m.userData.gamerGlow)glows.push({material:c,base:m.userData.gamerGlow});}
  return copies.get(m);
 };o.material=Array.isArray(o.material)?o.material.map(owned):owned(o.material);});
 (room.atelierGamingGlows||=[]).push(...glows);object.userData.atelierGaming=entry.atelierGaming;
 applyGamingGearLighting(room,...(room.atelierLampPhase||['afternoon',1]));
}
export function applyGamingGearLighting(room,mode='afternoon',accent=1){
 const gain=({morning:.12,afternoon:.22,evening:.7,night:.45,party:1}[mode]??.22)*Math.max(0,accent);
 for(const {material,base} of room.atelierGamingGlows||[])material.emissiveIntensity=base*gain;
}
