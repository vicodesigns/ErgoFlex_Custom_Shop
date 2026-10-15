// Activity layouts are suggestions. Authored builds and recorded Grooves are
// never rewritten; the controller keeps a separate, width-specific return pose.
import { planGroove, poseIsClear, segmentIsClear, angleDelta } from './room-groove.mjs';

const monitored = new Set(['security','police','hospital','laboratory','mobileit','scifi']);
const collaborative = new Set(['office','coworking','library','highschool','middleschool','elementary','college','university','government','occmedialab','creative','workshop','music','gallery']);
export function roomDeskActivity(scene, phase, count = 1) {
    if (phase === 'night' && !monitored.has(scene)) return scene === 'occmedialab'
        ? { kind:'storage', title:'Screening · open floor', description:'Fold to 65° and park in clear wall bays for screening. Shelving keeps the work kit organized.' }
        : { kind:'storage', title:'65° Storage Mode · wall parking', description:'Stow supplies, fold and roll into clear wall bays. Make room for cleaning and overnight charging.' };
    if (count > 1 && collaborative.has(scene) && ['afternoon','party'].includes(phase)) {
        const triple = phase === 'party' && count >= 3;
        return {kind:triple?'triples':'pairs',title:triple?'Project groups · three desks':'Partner work · paired desks',description:triple
            ? 'Bring mobile desks into small project groups, with a clear approach between groups.'
            : 'Roll desks side by side for shared research, editing and team work.'};
    }
    if (phase === 'party' && !monitored.has(scene)) return {kind:'storage',title:'Make room · 65° Storage Mode',description:'Park the mobile workspace at the edge to open the room for guests, exercise or a showcase.'};
    return {kind:'work',title:'Individual work bays',description:'Return desks to their original work positions. Each desk keeps its own build, finishes and accessories.'};
}

export function obstacleForDesk(desk, pose = desk.pose) {
    const f=desk.footprint,c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
    const x=pose.x+c*(f.offsetX||0)+s*(f.offsetZ||0),z=pose.z-s*(f.offsetX||0)+c*(f.offsetZ||0);
    const ex=Math.abs(c)*f.halfWidth+Math.abs(s)*f.halfDepth+(f.margin||0),ez=Math.abs(s)*f.halfWidth+Math.abs(c)*f.halfDepth+(f.margin||0);
    return {id:desk.id,minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez};
}
export function wallParkingCandidates(bounds, footprint) {
    const poses=[],f=footprint,gap=100;
    // Face the work side into the room. Keep a 1.8 m central opening along
    // the presentation/entry edge, even in rooms drawn with a cutaway wall.
    for(const [side,yaw] of [['back',0],['left',Math.PI/2],['right',-Math.PI/2],['front',Math.PI]]) {
        const horizontal=side==='back'||side==='front';
        const extent=horizontal?f.halfWidth:f.halfWidth;
        const lo=(horizontal?bounds.minX:bounds.minZ)+extent+gap,hi=(horizontal?bounds.maxX:bounds.maxZ)-extent-gap;
        for(let v=lo;v<=hi+1;v+=220) {
            if(side==='front'&&Math.abs(v)<900+f.halfWidth)continue;
            const c=Math.cos(yaw),s=Math.sin(yaw),ox=c*(f.offsetX||0)+s*(f.offsetZ||0),oz=-s*(f.offsetX||0)+c*(f.offsetZ||0);
            const inset=f.halfDepth+(f.margin||0)+gap;
            poses.push({x:(horizontal?v:side==='left'?bounds.minX+inset:bounds.maxX-inset)-ox,
                z:(horizontal?side==='back'?bounds.minZ+inset:bounds.maxZ-inset:v)-oz,yaw});
        }
    }
    return poses;
}

function groupCandidates(desks,bounds,obstacles,kind) {
    if(desks.length<2)return [];
    const count=kind==='triples'?3:2,groups=[],reserved=[...obstacles];
    const maxW=Math.max(...desks.map(d=>(d.targetFootprint||d.footprint).halfWidth)),maxD=Math.max(...desks.map(d=>(d.targetFootprint||d.footprint).halfDepth));
    const pitch=2*maxW+160,depth=2*maxD+120;
    // Pair side by side; the third desk faces the pair across an approach gap.
    // Search real free floor area rather than choosing a room centre through a table.
    const anchors=desks.map(d=>({x:d.pose.x+pitch/2,z:d.pose.z}));
    for(let z=bounds.minZ+maxD+200;z<bounds.maxZ-maxD;z+=500)
        for(let x=bounds.minX+pitch;x<bounds.maxX-pitch/2;x+=500)anchors.push({x,z});
    const remaining=[...desks];
    while(remaining.length){
        const first=remaining.shift(),nearby=remaining.sort((a,b)=>Math.hypot(a.pose.x-first.pose.x,a.pose.z-first.pose.z)-Math.hypot(b.pose.x-first.pose.x,b.pose.z-first.pose.z));
        const members=[first,...nearby.splice(0,count-1)];let best=null;
        for(const a of anchors){
            const poses=members.length===1?[{...a,yaw:0}]:[{x:a.x-pitch/2,z:a.z,yaw:0},{x:a.x+pitch/2,z:a.z,yaw:0},...(members.length===3?[{x:a.x,z:a.z+depth+700,yaw:Math.PI}]:[])];
            const boxes=[];let valid=true;
            for(let n=0;n<members.length;n++){
                if(!poseIsClear(poses[n],bounds,[...reserved,...boxes],members[n].targetFootprint||members[n].footprint)){valid=false;break;}
                boxes.push(obstacleForDesk({...members[n],footprint:members[n].targetFootprint||members[n].footprint},poses[n]));
            }
            if(!valid)continue;
            const cost=members.reduce((v,d,n)=>v+Math.hypot(poses[n].x-d.pose.x,poses[n].z-d.pose.z),0);
            if(!best||cost<best.cost)best={cost,poses,boxes};
        }
        if(best){members.forEach((d,n)=>groups.push({id:d.id,pose:best.poses[n],group:first.id,groupSize:members.length}));reserved.push(...best.boxes);}
    }
    return groups;
}

// Plan one desk at a time. Every route sees the other desks in their actual
// start or completed positions, so crossings never rely on synchronized timing.
export function planRoomDeskActivity({desks,bounds,obstacles,kind,homes={},saved={},authoredReturns=[]}) {
    const current=new Map(desks.map(d=>[d.id,{...d,pose:{...d.pose}}])),moves=[],blocked=[];
    const eligible=desks.filter(d=>poseIsClear(d.pose,bounds,obstacles,d.footprint));
    const fixedBays=desks.filter(d=>!eligible.includes(d)).map(d=>obstacleForDesk(d));
    const targets=kind==='pairs'||kind==='triples'?groupCandidates(eligible,bounds,[...obstacles,...fixedBays],kind):[];
    const groupTargets=new Map(targets.map(t=>[t.id,t.pose]));
    const pending=desks.map(d=>({...d,pose:{...d.pose}}));if(kind==='work')pending.reverse();
    const attempt=d=>{
        const others=[...obstacles,...[...current.values()].filter(o=>o.id!==d.id).map(o=>obstacleForDesk(o))];
        const target=saved[d.id]?.pose||(kind==='work'?homes[d.id]?.pose:groupTargets.get(d.id));
        const authoredReturn=kind==='work'&&authoredReturns.includes(d.id);
        const atHome=target&&Math.hypot(target.x-d.pose.x,target.z-d.pose.z)<.01&&Math.abs(angleDelta(target.yaw,d.pose.yaw))<.0001;
        let candidates=target?[target]:kind==='storage'?wallParkingCandidates(bounds,d.footprint):[];
        const targetFootprint=kind==='storage'&&!saved[d.id]?d.footprint:d.targetFootprint||d.footprint;
        candidates=candidates.filter(p=>poseIsClear(p,bounds,authoredReturn?others.filter(o=>!obstacles.includes(o)):others,targetFootprint));
        candidates.sort((a,b)=>(Math.hypot(a.x-d.pose.x,a.z-d.pose.z)+Math.abs(angleDelta(d.pose.yaw,a.yaw))*650)-(Math.hypot(b.x-d.pose.x,b.z-d.pose.z)+Math.abs(angleDelta(d.pose.yaw,b.yaw))*650));
        // Direct paths are common in a bay; spend A* only on the closest few
        // alternatives so a crowded classroom cannot stall the UI for seconds.
        let plan=authoredReturn&&atHome&&candidates.length?{route:[d.pose,target]}:null;
        for(const desired of candidates)if(segmentIsClear(d.pose,desired,bounds,others,d.footprint)){plan={ok:true,route:[d.pose,desired]};break;}
        if(!plan)for(const desired of candidates.slice(0,3)){
            const p=planGroove({start:d.pose,desired,bounds,obstacles:others,footprint:d.footprint,exact:true,maxNodes:8000});
            if(p.ok){plan=p;break;}
        }
        let inPlace=false;
        if(!plan&&kind==='storage'&&!saved[d.id]){
            const box=obstacleForDesk(d),wallGap=Math.min(box.minX-bounds.minX,bounds.maxX-box.maxX,box.minZ-bounds.minZ,bounds.maxZ-box.maxZ);
            // An existing perimeter bay can already serve as Storage Mode
            // when a nearby fixed fixture prevents a closer approach.
            if(wallGap<=1200&&poseIsClear(d.pose,bounds,others,d.footprint)){plan={route:[d.pose,d.pose]};inPlace=true;}
        }
        if(!plan)return false;
        const pose=plan.route.at(-1),setting=saved[d.id]||(kind==='work'?homes[d.id]:null);
        moves.push({id:d.id,route:plan.route,pose,setting,footprint:d.footprint,inPlace,authoredReturn});Object.assign(current.get(d.id),{pose,footprint:targetFootprint});return true;
    };
    // A desk leaving its bay can unblock a later desk's path. Retry only after
    // actual progress; never teleport a blocked unit through fixed furniture.
    for(let pass=0;pending.length&&pass<desks.length;pass++){
        let progress=false;
        for(let i=0;i<pending.length;){if(attempt(pending[i])){pending.splice(i,1);progress=true;}else i++;}
        if(!progress)break;
    }
    // A group can exchange occupied bays. Use one genuinely free waiting bay
    // to break the cycle, then retry the remaining destinations in sequence.
    if(kind==='pairs'||kind==='triples')for(let stage=0;pending.length&&stage<2;stage++){
        let staged=false;
        for(const original of pending){
            if(!groupTargets.has(original.id))continue;
            const d=current.get(original.id),others=[...obstacles,...[...current.values()].filter(o=>o.id!==d.id).map(o=>obstacleForDesk(o))];
            const reserved=[...others,...desks.filter(o=>o.id!==d.id&&groupTargets.has(o.id)).map(o=>obstacleForDesk({...o,footprint:o.targetFootprint||o.footprint},groupTargets.get(o.id)))];
            const spots=[];for(let z=bounds.minZ+900;z<bounds.maxZ-900;z+=600)for(let x=bounds.minX+1000;x<bounds.maxX-1000;x+=600){
                const p={x,z,yaw:d.pose.yaw};if(poseIsClear(p,bounds,reserved,d.targetFootprint||d.footprint)&&Math.hypot(x-d.pose.x,z-d.pose.z)>400)spots.push(p);
            }
            spots.sort((a,b)=>Math.hypot(a.x-d.pose.x,a.z-d.pose.z)-Math.hypot(b.x-d.pose.x,b.z-d.pose.z));
            const to=spots.find(p=>segmentIsClear(d.pose,p,bounds,others,d.footprint));if(!to)continue;
            moves.push({id:d.id,route:[d.pose,to],pose:to,footprint:d.footprint,transit:true});d.pose=to;original.pose=to;staged=true;break;
        }
        if(!staged)break;
        for(let pass=0;pending.length&&pass<desks.length;pass++){
            let progress=false;for(let i=0;i<pending.length;){if(attempt(pending[i])){pending.splice(i,1);progress=true;}else i++;}if(!progress)break;
        }
    }
    blocked.push(...pending.map(d=>d.id));
    const arrived=new Set(moves.filter(m=>!m.transit).map(m=>m.id)),groups=new Map();
    for(const t of targets)if(arrived.has(t.id))groups.set(t.group,(groups.get(t.group)||0)+1);
    if(kind==='triples'&&!saved[desks[0]?.id]&&![...groups.values()].some(n=>n===3)){
        const fallback=planRoomDeskActivity({desks,bounds,obstacles,kind:'pairs',homes,saved});
        return {...fallback,fallback:'Pairs fit the available floor space better than triples.'};
    }
    if(kind==='pairs'&&desks.length>1&&![...groups.values()].some(n=>n>=2)){
        const fallback=planRoomDeskActivity({desks,bounds,obstacles,kind:'storage',homes,saved});
        return {...fallback,fallback:'Park the desks to open the existing meeting area; there is not enough clear floor for a desk pair.'};
    }
    return {moves,blocked,kind,groups:[...groups.values()].filter(n=>n>1)};
}
