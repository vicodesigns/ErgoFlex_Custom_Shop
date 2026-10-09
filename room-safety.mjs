import { overlapArea } from './room-collision.mjs?v=room-regressions-20261007';

export const expandFloorBox = (b, margin) => ({...b,minX:b.minX-margin,maxX:b.maxX+margin,minZ:b.minZ-margin,maxZ:b.maxZ+margin});
export const floorGap = (a,b) => Math.hypot(Math.max(0,b.minX-a.maxX,a.minX-b.maxX),Math.max(0,b.minZ-a.maxZ,a.minZ-b.maxZ));

// Continuous swept AABB: even a slow frame cannot jump through an obstacle.
// Authored overlaps can retreat; padding is a preview clearance, not sensor data.
export function firstDeskContact(body, delta, obstacles, margin=0) {
    if(Math.hypot(delta.x,delta.z)<1e-12)return null;
    let best=null;
    for(const obstacle of obstacles){
        const b=expandFloorBox(obstacle.box,margin);
        if(body.maxY<=b.minY||body.minY>=b.maxY)continue;
        const moved={...body,minX:body.minX+delta.x,maxX:body.maxX+delta.x,minZ:body.minZ+delta.z,maxZ:body.maxZ+delta.z};
        if(overlapArea(body,b)>0){
            if(overlapArea(moved,b)<=overlapArea(body,b)+1e-10)continue;
            if(!best||best.fraction>0)best={...obstacle,fraction:0,distance:floorGap(body,obstacle.box)};
            continue;
        }
        let enter=-Infinity,exit=Infinity,miss=false;
        for(const [axis,d] of [['X',delta.x],['Z',delta.z]]){
            if(Math.abs(d)<1e-12){if(body['max'+axis]<=b['min'+axis]||body['min'+axis]>=b['max'+axis])miss=true;continue;}
            const t1=(b['min'+axis]-body['max'+axis])/d,t2=(b['max'+axis]-body['min'+axis])/d;
            enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
        }
        if(!miss&&enter<=exit&&exit>0&&enter>=-1e-10&&enter<=1&&(!best||enter<best.fraction))
            best={...obstacle,fraction:Math.max(0,enter),distance:floorGap(body,obstacle.box)};
    }
    return best;
}

export class RoomSafety {
    constructor(){this.guard=false;this.alert=null;this.acknowledged=new Set();}
    reset(){this.alert=null;this.acknowledged.clear();}
    clear(){if(this.alert?.kind==='contact'&&this.alert.pushable)this.acknowledged.add(this.alert.id);this.alert=null;}
    contact(hit,body,scale){
        this.alert={id:hit.id,name:hit.name||'Room furnishing',pushable:!!hit.pushable,kind:this.guard?'ahead':'contact',distanceMm:floorGap(body,hit.box)/scale,at:performance.now()};
        return this.alert;
    }
    check(body,delta,obstacles,scale){
        if(this.alert)return {x:0,z:0,blocked:true};
        for(const id of this.acknowledged){const o=obstacles.find(o=>o.id===id);if(!o||floorGap(body,o.box)>scale*60)this.acknowledged.delete(id);}
        const margin=scale*(this.guard?150:3);
        const hit=firstDeskContact(body,delta,obstacles.filter(o=>this.guard||!this.acknowledged.has(o.id)),margin);
        if(!hit)return null;
        this.alert={id:hit.id,name:hit.name||'Room furnishing',pushable:!!hit.pushable,kind:this.guard?'ahead':'contact',
            distanceMm:hit.distance/scale,clearanceMm:this.guard?150:3,at:performance.now()};
        const fraction=Math.max(0,hit.fraction-1e-5);
        return {x:delta.x*fraction,z:delta.z*fraction,blocked:true,event:this.alert,pushes:[]};
    }
    turn(before,after,obstacles,scale){
        if(this.alert)return {blocked:true};
        const margin=scale*(this.guard?150:3);
        const hit=obstacles.find(o=>overlapArea(after,expandFloorBox(o.box,margin))>Math.max(1e-10,overlapArea(before,expandFloorBox(o.box,margin))+1e-10));
        if(!hit)return null;
        this.alert={id:hit.id,name:hit.name||'Room furnishing',pushable:!!hit.pushable,kind:this.guard?'ahead':'contact',distanceMm:floorGap(before,hit.box)/scale,at:performance.now()};
        return {blocked:true,event:this.alert};
    }
}
