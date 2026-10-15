// Scene-specific finishes for the owner's parametric Milano couch.
export const MILANO_FAMILIES={
 alabaster:{name:'Alabaster bouclé',scenes:['lounge'],textile:'boucle',fabricColor:'#ded4c2',accentColor:'#9b6248',woodColor:'#493021',metalColor:'#b79a60',depth:.88},
 moss:{name:'Humboldt moss velvet',scenes:['library'],textile:'velvet',fabricColor:'#355347',accentColor:'#c7a15e',woodColor:'#402d21',metalColor:'#b69b60',depth:.88},
 graphite:{name:'Office graphite weave',scenes:['office'],textile:'boucle',fabricColor:'#465052',accentColor:'#879b91',woodColor:'#4a3428',metalColor:'#939b9e',depth:.78},
 teal:{name:'Co-working petrol weave',scenes:['coworking'],textile:'boucle',fabricColor:'#385d61',accentColor:'#ba795b',woodColor:'#6c4c32',metalColor:'#bba574',depth:.78},
 cognac:{name:'Studio cognac leather',scenes:['music','study'],textile:'leather',fabricColor:'#965631',accentColor:'#53615b',woodColor:'#34251c',metalColor:'#b3985d',depth:.78},
 clay:{name:'Atelier clay velvet',scenes:['creative'],textile:'velvet',fabricColor:'#ad6f59',accentColor:'#cfc2a2',woodColor:'#6c4d35',metalColor:'#ac9061',depth:.78},
 chalk:{name:'Gallery chalk bouclé',scenes:['gallery'],textile:'boucle',fabricColor:'#dcd9cd',accentColor:'#67796d',woodColor:'#8a6c4e',metalColor:'#a8a59d',depth:.88},
 oat:{name:'Bedroom oat linen',scenes:['bedroom'],textile:'boucle',fabricColor:'#c7bda8',accentColor:'#88978c',woodColor:'#8c7153',metalColor:'#b5a380',depth:.88,seats:[2]},
 midnight:{name:'Gaming midnight velvet',scenes:['gaming'],textile:'velvet',fabricColor:'#333e58',accentColor:'#9c859f',woodColor:'#342e2c',metalColor:'#959da5',depth:.78},
 coast:{name:'OCC navy & orange',scenes:['occmedialab'],textile:'boucle',fabricColor:'#173758',accentColor:'#e58d36',woodColor:'#624733',metalColor:'#a3a8af',depth:.88}
};
export const MILANO_PROFILES=Object.entries(MILANO_FAMILIES).flatMap(([family,p])=>(p.seats||[2,3]).map(seatCount=>({
 ...p,id:`milano-${family}-${seatCount}`,name:`Milano sofa · ${p.name} · ${seatCount} seats`,family,seatCount,seatWidth:seatCount===3?.60:.65,
 chaise:family==='coast'&&seatCount===3?'right':'none'
})));
MILANO_PROFILES.push({...MILANO_FAMILIES.cognac,id:'milano-cognac-compact-2',name:'Milano sofa · compact cognac leather · 2 seats',family:'cognac-compact',depth:.68,seatCount:2,seatWidth:.65,chaise:'none'});
MILANO_PROFILES.push({id:'milano-original-3',name:'Milano sofa · original architectural lounge · 3 seats',family:'original',scenes:['lounge','music','office'],seatCount:3,seatWidth:.72,depth:.98,textile:'boucle',fabricColor:'#2b3438',accentColor:'#c2744b',woodColor:'#3d2415',metalColor:'#d4af37',chaise:'none'});
