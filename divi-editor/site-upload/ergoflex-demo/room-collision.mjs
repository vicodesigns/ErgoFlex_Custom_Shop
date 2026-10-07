// Floor-plane contact solver. Units come from the scene, not pixels. Furniture
// boxes include their height so a tabletop accessory never blocks the floor.
export const translateBox = (b, x, z) => ({ ...b, minX:b.minX+x, maxX:b.maxX+x, minZ:b.minZ+z, maxZ:b.maxZ+z });
export function overlapArea(a, b) {
    if (a.maxY <= b.minY || b.maxY <= a.minY) return 0;
    return Math.max(0, Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)) * Math.max(0,Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ));
}
const inside = (b, f) => !f || (b.minX>=f.minX-1e-8 && b.maxX<=f.maxX+1e-8 && b.minZ>=f.minZ-1e-8 && b.maxZ<=f.maxZ+1e-8);
// Existing authored overlaps may separate. New or deeper contacts must resolve.
const entering = (before, after, other) => overlapArea(after,other)>Math.max(1e-10,overlapArea(before,other)+1e-10);
export function solveFloorMove(body, delta, obstacles, floor, { step=.025, gap=.001 }={}) {
    const count=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/step));
    const dx=delta.x/count,dz=delta.z/count,length=Math.hypot(dx,dz),ux=length?dx/length:0,uz=length?dz/length:0;
    let current={...body}, state=obstacles.map(o=>({...o,box:{...o.box},dx:0,dz:0})), blocked=false;
    const push=(index, obstacleState, from, to, chain=new Set())=>{
        const o=obstacleState[index];
        if(!o.movable || chain.has(index) || !length)return false;
        chain=new Set(chain);chain.add(index);
        const exits=[];
        if(ux>0)exits.push((to.maxX+gap-o.box.minX)/ux);
        if(ux<0)exits.push((to.minX-gap-o.box.maxX)/ux);
        if(uz>0)exits.push((to.maxZ+gap-o.box.minZ)/uz);
        if(uz<0)exits.push((to.minZ-gap-o.box.maxZ)/uz);
        const amount=Math.min(...exits.filter(t=>t>=0)),mx=ux*amount,mz=uz*amount;
        if(!Number.isFinite(amount))return false;
        const before=o.box,next=translateBox(before,mx,mz);
        if(!inside(next,floor))return false;
        for(let j=0;j<obstacleState.length;j++){
            if(j===index||!entering(before,next,obstacleState[j].box))continue;
            if(!push(j,obstacleState,before,next,chain))return false;
        }
        o.box=next;o.dx+=mx;o.dz+=mz;return true;
    };
    for(let i=0;i<count;i++){
        const next=translateBox(current,dx,dz), trial=state.map(o=>({...o,box:{...o.box}}));
        if(!inside(next,floor)){blocked=true;break;}
        let accepted=true;
        for(let j=0;j<trial.length;j++){
            if(!entering(current,next,trial[j].box))continue;
            if(!push(j,trial,current,next)){accepted=false;break;}
        }
        if(!accepted){blocked=true;break;}
        current=next;state=trial;
    }
    return {x:current.minX-body.minX,z:current.minZ-body.minZ,blocked,
        pushes:state.filter(o=>Math.abs(o.dx)+Math.abs(o.dz)>1e-10).map(o=>({id:o.id,x:o.dx,z:o.dz}))};
}
