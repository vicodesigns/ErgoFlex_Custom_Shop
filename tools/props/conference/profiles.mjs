export const CONFERENCE_FINISHES={
 forest:{name:'Humboldt forest & bronze',frame:'#393d33',shell:'#3c5144',fabric:'#3f604f',roughness:.66,scenes:['library']},
 sage:{name:'Sage weave & graphite',frame:'#364447',shell:'#889287',fabric:'#728675',roughness:.9,scenes:['library','coworking']},
 slate:{name:'Slate blue & silver',frame:'#929d9e',shell:'#5d7079',fabric:'#657f8b',roughness:.9,scenes:['library','office']},
 clay:{name:'Clay weave & bronze',frame:'#796b55',shell:'#9b7e65',fabric:'#ad7c62',roughness:.9,scenes:['library','creative']},
 graphite:{name:'Graphite & brushed steel',frame:'#909a9d',shell:'#303c43',fabric:'#43545b',roughness:.88,scenes:['office','government']},
 teal:{name:'Teal & charcoal',frame:'#343d3e',shell:'#596f6b',fabric:'#497775',roughness:.9,scenes:['coworking','occmedialab']},
 terracotta:{name:'Terracotta & warm oak',frame:'#50483f',shell:'#b99c73',fabric:'#ac7055',roughness:.86,scenes:['kitchen']},
 ivory:{name:'Ivory weave & oak',frame:'#6a6257',shell:'#c1a67c',fabric:'#dbd3bd',roughness:.92,scenes:['kitchen','lounge','gallery']}
};
export const CONFERENCE_PROFILES=Object.entries(CONFERENCE_FINISHES).map(([family,finish])=>({...finish,family,id:'atelier-sidechair-'+family,name:'Atelier conference side chair · '+finish.name}));
