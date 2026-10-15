// Keep original placement IDs: room edits, rotations and deletions continue to
// address the same furnishing after its model is upgraded.
export const MILANO_SCENE_FAMILIES={lounge:'alabaster',library:'moss',office:'graphite',coworking:'teal',music:'cognac',study:'cognac-compact',creative:'clay',gallery:'chalk',bedroom:'oat',gaming:'midnight',occmedialab:'coast'};
const sofas=new Set(['sofa','sofa-fabric','sofa-leather-couch','sofa-leather-wood','sofa-plain','kenney-furniture-lounge-sofa','kenney-furniture-lounge-design-sofa','ergoflex-couch']);
export function milanoSceneSofa(scene,layout,placement,index){
    if(!sofas.has(placement.id)||!MILANO_SCENE_FAMILIES[scene])return null;
    const old=index.props.find(p=>p.id===placement.id);if(!old?.size)return null;
    const family=placement.id==='sofa-leather-wood'?'cognac-compact':MILANO_SCENE_FAMILIES[scene];
    const candidates=index.props.filter(p=>p.milano?.family===family).map(entry=>({entry,fit:Math.min(1,old.size[0]/entry.size[0],old.size[2]/entry.size[2])}));
    // Prefer three proper seat modules when they fit. Smaller rooms get a
    // genuine two-seat model; no axis stretching or miniature seating.
    candidates.sort((a,b)=>b.entry.milano.seats-a.entry.milano.seats);
    const selected=candidates.find(p=>p.fit>=.9);if(!selected)return null;
    const tables=(layout?.props||[]).filter(p=>/coffee-table/.test(p.id));
    tables.sort((a,b)=>Math.hypot(a.at[0]-placement.at[0],a.at[2]-placement.at[2])-Math.hypot(b.at[0]-placement.at[0],b.at[2]-placement.at[2]));
    const target=scene==='occmedialab'&&layout?.media?.lounge?.display?layout.media.lounge.display:tables[0]?[tables[0].at[0],tables[0].at[2]]:null;
    const yaw=(placement.turn||0)*Math.PI/180;
    const flip=target?Math.sin(yaw)*(target[0]-placement.at[0])+Math.cos(yaw)*(target[1]-placement.at[2])<0:['office','coworking','music','creative','library','study'].includes(scene);
    return {id:selected.entry.id,entry:selected.entry,fit:selected.fit,flip};
}
