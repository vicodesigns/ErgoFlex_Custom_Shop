export const ARTIST_PALETTES={
 oak:{name:'Oak & warm brass',woodColor:'#b9956b',metalColor:'#b99c64',canvasColor:'#f1eadd',leatherColor:'#795c46',clayColor:'#ac7e60'},
 chalk:{name:'Pale ash & brushed silver',woodColor:'#c9c0a8',metalColor:'#b5bfc3',canvasColor:'#e5e1d7',leatherColor:'#78858a',clayColor:'#c5bbab'},
 sage:{name:'Walnut & sage',woodColor:'#624730',metalColor:'#bca77a',canvasColor:'#f0eadb',leatherColor:'#687d69',clayColor:'#aa7860'}
};
const types={tablet:'Pen display studio',easel:'Tabletop painting studio',sculpture:'Clay sculpture studio',ipad:'Digital illustration studio'};
export const ARTIST_PROFILES=Object.entries(ARTIST_PALETTES).flatMap(([family,p])=>Object.entries(types).map(([archetype,label])=>({...p,archetype,articulation:archetype==='sculpture'?.025:.32,family,scenes:['creative','gallery','occmedialab','college'],spread:.92,depth:.52,id:`atelier-artist-set-${archetype}-${family}`,name:`Atelier artist · ${label} · ${p.name}`})));
const parts={'pen-display':['tablet','Pen display & express dial'],'table-easel':['easel','Table easel & painted canvas'],sculpture:['sculpture','Clay study & modeling stand'],slate:['ipad','Illustration tablet & stylus'],brushes:['tablet','Ceramic brush pot'],palette:['tablet','Paint palette & knife'],stylus:['tablet','Professional stylus']};
for(const [component,[archetype,label]] of Object.entries(parts))for(const family of ['oak','chalk'])ARTIST_PROFILES.push({...ARTIST_PALETTES[family],archetype,articulation:archetype==='sculpture'?.025:.32,component,family,scenes:['creative','gallery','occmedialab','college'],spread:.92,depth:.52,includeDeskMat:false,id:`atelier-artist-${component}-${family}`,name:`Atelier artist · ${label} · ${ARTIST_PALETTES[family].name}`});
