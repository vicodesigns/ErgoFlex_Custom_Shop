export const DECOR_PALETTES={
 heritage:{name:'Heritage walnut & brass',woodColor:'#543c29',metalColor:'#b69a5e',stoneColor:'#dcd1b9',leatherColor:'#935b39',scenes:['study','office','library','lounge']},
 nordic:{name:'Oak & travertine',woodColor:'#b59568',metalColor:'#aeb7b9',stoneColor:'#e5decf',leatherColor:'#697873',scenes:['office','coworking','bedroom','gallery']},
 obsidian:{name:'Obsidian & copper',woodColor:'#30383b',metalColor:'#bb8055',stoneColor:'#4a535a',leatherColor:'#303d45',scenes:['gaming','music','office']},
 matcha:{name:'Kyoto moss & stone',woodColor:'#9c7e54',metalColor:'#b7a16b',stoneColor:'#d6d3bd',leatherColor:'#46634f',scenes:['library','creative','coworking','study']}
};
const types={stationery:'Writing & fountain pen set',curiosities:'Bookends & armillary collection',mechanical:'Mechanical keyboard & tube audio',botanical:'Bonsai, zen garden & pour-over'};
export const DECOR_PROFILES=Object.entries(DECOR_PALETTES).flatMap(([family,p])=>Object.entries(types).map(([archetype,label])=>({...p,archetype,family,spread:.78,depth:.42,id:`atelier-decor-${archetype}-${family}`,name:`Atelier decor · ${label} · ${p.name}`})));
const components={valet:'stationery',journal:'stationery',clock:'stationery',bookends:'curiosities',orrery:'curiosities',terrarium:'botanical',zen:'botanical',dac:'mechanical'};
for(const [component,archetype] of Object.entries(components))for(const family of ['heritage',['terrarium','zen'].includes(component)?'matcha':'nordic'])DECOR_PROFILES.push({...DECOR_PALETTES[family],archetype,component,family,spread:.78,depth:.42,includeDeskMat:false,id:`atelier-decor-${component}-${family}`,name:`Atelier decor · ${component==='orrery'?'Armillary sculpture':component==='dac'?'Tube audio amplifier':component==='journal'?'Open journal & fountain pen':component[0].toUpperCase()+component.slice(1)} · ${DECOR_PALETTES[family].name}`});
