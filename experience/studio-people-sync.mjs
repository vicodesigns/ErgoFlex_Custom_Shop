import {cleanPeople,cleanPerson} from './people-edits.mjs';

// Studio stores room-local millimetres, quaternions and model scales (1000 = life size).
// Director stores free placements in millimetres, a heading in degrees and a size factor.
const identity=id=>/^scene:([^:]+):([^:]+):person:([^:]+):(people-[a-z0-9._-]+)$/i.exec(id);
const placement=p=>JSON.stringify(p&&{id:p.id,key:p.key,at:p.at,y:p.y||0,turn:p.turn||0,scale:p.scale||1,desk:p.desk,station:p.station,beside:p.beside,hide:!!p.hide});

export function studioPeopleChanges(raw,sceneIds,cast=[]){
    let all;try{all=JSON.parse(raw||'{}');}catch{return [];}
    const out=new Map();
    for(const sceneId of sceneIds){
        const state=all?.[sceneId];if(!state)continue;
        const removed=new Set(state.removed||[]);
        for(const editorId of new Set([...Object.keys(state.transforms||{}),...removed])){
            const match=identity(editorId);if(!match||`${match[1]}:${match[2]}`!==sceneId)continue;
            const key=match[3],id=match[4];
            const exact=cast.find(p=>p.key===key),sameModel=cast.filter(p=>p.id===id);
            const current=exact||(sameModel.length===1?sameModel[0]:null);
            if(removed.has(editorId)){
                if(current&&!current.hide)out.set(current.key,{key:current.key,id,placement:{...current,hide:true},removed:true});
                continue;
            }
            const t=state.transforms?.[editorId];
            if(!t||![t.p?.x,t.p?.y,t.p?.z,t.q?.x,t.q?.y,t.q?.z,t.q?.w,t.s?.x,t.s?.y,t.s?.z].every(Number.isFinite))continue;
            const scale=(t.s.x+t.s.y+t.s.z)/3000;if(scale<.2||scale>3)continue;
            const q=t.q,n=Math.hypot(q.x,q.y,q.z,q.w);if(n<1e-6)continue;
            const x=q.x/n,y=q.y/n,z=q.z/n,w=q.w/n;
            const next={...current,key:current?.key||key,id:current?.id||id,at:[t.p.x,t.p.z],y:t.p.y,
                turn:Math.atan2(2*(y*w-x*z),1-2*(x*x+y*y))*180/Math.PI,scale};
            // Moving a desk user to a chosen spot is an explicit free placement, as in Director's People tab.
            for(const field of ['desk','station','reach','beside','hide'])delete next[field];
            const clean=cleanPerson(next);if(!clean||placement(clean)===placement(current))continue;
            out.set(clean.key,{key:clean.key,id:clean.id,placement:clean});
        }
    }
    return [...out.values()];
}

export function peopleEditsFromStudio(seed,changes){
    const next=structuredClone(cleanPeople(seed)||{cast:[]});
    for(const change of changes){
        const i=next.cast.findIndex(p=>p.key===change.key);
        if(i<0)next.cast.push(change.placement);else next.cast[i]=change.placement;
    }
    return cleanPeople(next);
}
