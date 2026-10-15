import * as THREE from 'three';

const SCREENS=new Set(['wide-monitor','portrait-monitor','flat-monitor','dell-u2724d','monitor-arm','monitor-arm-2','obsbot-tiny-2']);
export const shelfStationCount = count => count>3?Math.max(1,Math.round(count/3)):0;
const eligibleScore=r=>{
    const id=(r.spec?.id||r.id)+' '+(r.state.name||'');
    return (/draft|paint|easel|project|maker|practical|collaborat|reading|sketch|review|demonstration|discovery/.test(id)?100:0)
        +(/illustrat|animation/.test(id)?40:0)
        -(/edit|colour|color-grading|diagnostic|dispatch|security|monitor|research/.test(id)?200:0)
        -(/accessible|open access/.test(id)?1000:0)-(/audio|sound/.test(id)?80:0)-(r.primary?2000:0);
};
export function seedShelfStation(state){
    if(state.shelfStation==='shelf-first-v1')return false;
    state.shelfStation='shelf-first-v1';
    state.accessories=(state.accessories||[]).filter(id=>!SCREENS.has(id));
    if(!state.accessories.includes('shelf-organizer'))state.accessories.push('shelf-organizer');
    for(const [id,o] of Object.entries(state.objects||{}))if(!id.startsWith('accessory-')&&/monitor|display|screen|laptop|imac/i.test(`${o.propId||''} ${o.label}`))o.removed=true;
    for(const v of Object.values(state.sizeSetups||{}))seedShelfStation(v);
    return true;
}
export function chooseShelfStations(records){
    const rows=[...records],target=shelfStationCount(rows.length),existing=rows.filter(r=>r.state.shelfStation==='shelf-first-v1').length;
    return rows.filter(r=>!r.state.shelfStation).sort((a,b)=>eligibleScore(b)-eligibleScore(a)||a.id.localeCompare(b.id)).slice(0,Math.max(0,target-existing));
}

// Small, separately editable supplies leave most of the shelf free for auto
// storage. No invisible monitor arms remain on the analogue workstations.
export function createShelfStationSupplies(state){
    const accent=state.style?.trimColor||'#a4b5a7',dark='#35474c',paper='#eee9de',items=[];
    const group=(id,label,role,at)=>{const g=new THREE.Group();g.name=label;g.userData.shelfStationSupply=true;g.position.set(...at);items.push({id,role,obj:g});return g;};
    const box=(g,size,at,color,metalness=0,roughness=.7)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,metalness,roughness}));mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;};
    const width=state.size==='48x30'?1100:1400;
    const files=group('default-shelf-files','Shelf · project reference books','shelf',[-width/2+140,0,0]);
    for(let i=0;i<4;i++){const x=i*27-40,h=150+i%2*18,color=[dark,accent,'#ad9171','#718786'][i];box(files,[22,h,130],[x,h/2,0],color);box(files,[17,h-12,126],[x+1,h/2,2],paper);box(files,[18,3,2],[x,h-24,67],paper);}
    const tray=group('default-shelf-paper-tray','Shelf · handout and sketch paper tray','lower-shelf',[width/2-160,0,0]);
    box(tray,[255,5,175],[0,2.5,0],'#8d999f',.75,.35);box(tray,[5,32,175],[-125,16,0],accent,.15);box(tray,[5,32,175],[125,16,0],accent,.15);box(tray,[250,32,5],[0,16,-85],accent,.15);
    box(tray,[225,15,153],[0,13,0],paper);for(let i=0;i<3;i++)box(tray,[225,.7,153],[0,7+i*4,0],'#d4cec1');
    const cup=group('default-shelf-tool-cup','Shelf · pencils and precision tools','shelf',[width/2-100,0,0]);
    const vessel=new THREE.Mesh(new THREE.CylinderGeometry(29,26,65,24,1,true),new THREE.MeshPhysicalMaterial({color:'#d9e5e8',roughness:.2,metalness:.05,transparent:true,opacity:.55,side:THREE.DoubleSide}));vessel.position.y=33;cup.add(vessel);box(cup,[50,3,50],[0,1.5,0],dark);
    for(let i=0;i<5;i++){const pencil=box(cup,[5,118+i%3*10,5],[-18+i*9,62,0],i%2?accent:dark);pencil.rotation.z=(i-2)*.08;}
    return items;
}
