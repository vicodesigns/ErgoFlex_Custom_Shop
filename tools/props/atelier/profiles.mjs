// Real furniture dimensions; decorative lounge seating, never a task chair swap.
export const ATELIER_PALETTES={
 cognac:{name:'Cognac & walnut',textile:'leather',fabricColor:'#965631',accentColor:'#49544c',woodColor:'#422c1c',metalColor:'#b69a5e',scenes:['study','music','lounge']},
 ivory:{name:'Ivory bouclé',textile:'boucle',fabricColor:'#e2d8c5',accentColor:'#aa7456',woodColor:'#705239',metalColor:'#b5b3a8',scenes:['lounge','bedroom','gallery']},
 obsidian:{name:'Obsidian leather',textile:'leather',fabricColor:'#292e34',accentColor:'#aa6b47',woodColor:'#38291f',metalColor:'#a5adb1',scenes:['office','gaming']},
 moss:{name:'Humboldt moss velvet',textile:'velvet',fabricColor:'#355347',accentColor:'#c7a15e',woodColor:'#402d21',metalColor:'#b69b60',scenes:['library','coworking']}
};
const styles={molded:'Molded swivel',timber:'Danish timber',cantilever:'Cantilever club'};
export const ATELIER_PROFILES=Object.entries(styles).flatMap(([archetype,label])=>Object.entries(ATELIER_PALETTES).map(([family,p])=>({...p,archetype,family,component:'chair',seatWidth:archetype==='molded'?.64:.66,backHeight:.56,reclineDeg:16,id:`atelier-${archetype}-${family}`,name:`Atelier chair · ${label} · ${p.name}`})));
ATELIER_PROFILES.push({...ATELIER_PALETTES.ivory,archetype:'timber',family:'clay',component:'chair',seatWidth:.66,backHeight:.56,reclineDeg:16,textile:'velvet',fabricColor:'#ad6f59',accentColor:'#d6c6a3',scenes:['creative'],id:'atelier-timber-clay',name:'Atelier chair · Danish timber · Clay velvet'});
ATELIER_PROFILES.push({...ATELIER_PALETTES.obsidian,archetype:'cantilever',family:'coast',component:'chair',seatWidth:.66,backHeight:.56,reclineDeg:16,textile:'boucle',fabricColor:'#173758',accentColor:'#e58d36',scenes:['occmedialab'],id:'atelier-cantilever-coast',name:'Atelier chair · Cantilever club · OCC navy & orange'});
for(const [archetype,family] of [['molded','cognac'],['timber','ivory'],['timber','moss'],['cantilever','obsidian']]){
 const chair=ATELIER_PROFILES.find(p=>p.archetype===archetype&&p.family===family);
 ATELIER_PROFILES.push({...chair,component:'ottoman',id:`atelier-ottoman-${archetype}-${family}`,name:`Atelier ottoman · ${styles[archetype]} · ${chair.name.split(' · ').at(-1)}`});
}
