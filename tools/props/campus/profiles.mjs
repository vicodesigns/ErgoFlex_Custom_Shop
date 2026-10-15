export const CAMPUS_PALETTES={
 nordic:{name:'Oak, moss & clay',woodColor:'#b18d60',frameColor:'#293b3a',seatColor:'#b87a5d',feltColor:'#536b5b',scenes:['coworking','library','office']},
 walnut:{name:'Walnut executive',woodColor:'#543c29',frameColor:'#30383b',seatColor:'#7d887e',feltColor:'#455756',scenes:['office','coworking']},
 terracotta:{name:'Campus terracotta',woodColor:'#bd9b70',frameColor:'#334955',seatColor:'#ad6d52',feltColor:'#637e87',scenes:['college','university','coworking']},
 slate:{name:'Slate & silver',woodColor:'#614b37',frameColor:'#aab2b5',seatColor:'#9c7252',feltColor:'#414b57',scenes:['office','college','university']},
 moss:{name:'Humboldt forest & gold',woodColor:'#7d6544',frameColor:'#425348',seatColor:'#b6a16d',feltColor:'#355347',scenes:['library']},
 coast:{name:'OCC navy & orange',woodColor:'#927149',frameColor:'#1e3d5b',seatColor:'#e58d36',feltColor:'#315974',scenes:['occmedialab']}
};
const types={
 pod:{name:'Acoustic call pod',width:1.45,depth:1.30,height:2.18,articulation:.08},
 bleacher:{name:'Tiered collaboration seating',width:2.25,depth:1.85,height:1.52,articulation:.18},
 lockers:{name:'Locker bank & bench alcove',width:1.85,depth:.58,height:1.88,articulation:.10},
 whiteboard:{name:'Rolling board & poufs',width:1.55,depth:.72,height:1.86,articulation:.38},
 pouf:{name:'Upholstered pouf stool',width:.75,depth:.58,height:.5,articulation:0}
};
export const CAMPUS_PROFILES=Object.entries(CAMPUS_PALETTES).filter(([f])=>['nordic','walnut','terracotta','slate'].includes(f)).flatMap(([family,p])=>Object.entries(types).map(([archetype,t])=>({...p,...t,archetype,family,id:`campus-${archetype}-${family}`,name:`Atelier campus · ${t.name} · ${p.name}`})));
for(const family of ['nordic','terracotta','coast'])CAMPUS_PROFILES.push({...CAMPUS_PALETTES[family],archetype:'whiteboard',family,width:1.18,depth:.6,height:1.85,baseSpread:.44,articulation:.38,includeSeating:false,id:`campus-board-compact-${family}`,name:`Atelier campus · Compact rolling board · ${CAMPUS_PALETTES[family].name}`});
CAMPUS_PROFILES.push({...CAMPUS_PALETTES.moss,archetype:'whiteboard',family:'moss',component:'wall-board',width:1.53,depth:.6,height:1.35,includeSeating:false,articulation:.38,id:'campus-wall-board-moss',name:'Atelier campus · Humboldt shared research board'});
for(const [family,p] of Object.entries({hbhs:{name:'HBHS black & orange',woodColor:'#e2692a',frameColor:'#24272b',seatColor:'#e2692a',feltColor:'#303439',scenes:['highschool']},middle:{name:'Blue campus steel',woodColor:'#6a9baa',frameColor:'#3f5967',seatColor:'#728d8f',feltColor:'#35556b',scenes:['middleschool']}}))CAMPUS_PROFILES.push({...p,archetype:'lockers',family,width:.81,depth:.28,height:1.86,articulation:0,includeSeating:false,includePlanter:false,id:`campus-lockers-compact-${family}`,name:`Atelier campus · Compact lockers · ${p.name}`});
for(const family of ['walnut','slate'])CAMPUS_PROFILES.push({...CAMPUS_PALETTES[family],archetype:'lockers',family,width:1.3,depth:.38,height:.624,lockerRows:2,articulation:0,includeSeating:false,includePlanter:false,id:`campus-storage-low-${family}`,name:`Atelier campus · Low modular storage · ${CAMPUS_PALETTES[family].name}`});
CAMPUS_PROFILES.push({...CAMPUS_PALETTES.coast,...types.pod,archetype:'pod',family:'coast',id:'campus-pod-coast',name:'Atelier campus · Acoustic media pod · OCC navy & orange'});
