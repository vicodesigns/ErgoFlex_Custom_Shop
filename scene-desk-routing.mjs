import * as THREE from 'three';
import { planGroove, poseIsClear, angleDelta } from './room-groove.mjs';
import { grooveObstacles } from './room-groove-runtime.mjs?v=scene-desk-editor-20261010';

export function deskFootprint(record){
    const g=record.group;g.updateWorldMatrix(true,true);
    const inverse=g.matrixWorld.clone().invert(),box=new THREE.Box3();
    for(const child of g.children){
        if(!child.isMesh||!child.geometry||child.material?.isShaderMaterial)continue;
        child.geometry.computeBoundingBox();box.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
    }
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    return {halfWidth:size.x/2,halfDepth:size.z/2,offsetX:center.x,offsetZ:center.z,margin:15};
}
export function deskRoomBounds(room){const l=room.roomLayout;return{minX:-l.width/2+20,maxX:l.width/2-20,minZ:l.back+20,maxZ:l.back+l.depth-20};}
export function deskObstacle(record){
    const f=deskFootprint(record),p=record.state.pose,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
    const x=p.x+c*f.offsetX+s*f.offsetZ,z=p.z-s*f.offsetX+c*f.offsetZ;
    const ex=Math.abs(c)*f.halfWidth+Math.abs(s)*f.halfDepth,ez=Math.abs(s)*f.halfWidth+Math.abs(c)*f.halfDepth;
    return{id:record.group.uuid,name:record.state.name,minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez};
}
export function deskObstacles(room,record){
    const obstacles=grooveObstacles(room).filter(o=>o.id!==record.group?.uuid);
    for(const r of room.sceneDeskRecords?.values()||[])if(r.id!==record.id&&r.group?.userData.sceneDeskActive)obstacles.push(deskObstacle(r));
    return obstacles;
}
export function planDeskPath(room,record,setting){
    const start=record.state,footprint=deskFootprint(record),bounds=deskRoomBounds(room),obstacles=deskObstacles(room,record);
    if(Math.hypot(start.pose.x-setting.pose.x,start.pose.z-setting.pose.z)<1&&Math.abs(angleDelta(start.pose.yaw,setting.pose.yaw))<.001)
        return{route:[start.pose,setting.pose],start:structuredClone(start),end:setting,duration:.5,lengths:[0]};
    const plan=planGroove({start:start.pose,desired:setting.pose,bounds,obstacles,footprint,exact:true});
    if(!plan.ok)return null;
    const lengths=[];let duration=0;
    for(let i=1;i<plan.route.length;i++){
        const a=plan.route[i-1],b=plan.route[i];const t=Math.max(Math.hypot(b.x-a.x,b.z-a.z)/420,Math.abs(angleDelta(a.yaw,b.yaw))/.4,.05);
        lengths.push(t);duration+=t;
    }
    duration=Math.max(duration,Math.abs(setting.height-start.height)/2,Math.abs(setting.tilt-start.tilt)/10,.5);
    return{route:plan.route,start:structuredClone(start),end:setting,lengths,duration};
}
export function sampleDeskPath(path,time){
    let remaining=Math.max(0,time),a=path.route[0],b=a,u=0;
    for(let i=1;i<path.route.length;i++){
        a=path.route[i-1];b=path.route[i];const t=path.lengths[i-1]||path.duration;
        if(remaining<=t){u=remaining/t;break;}remaining-=t;u=1;
    }
    const posture=Math.min(1,Math.max(0,time/path.duration));
    return{pose:{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,yaw:a.yaw+angleDelta(a.yaw,b.yaw)*u},
        height:path.start.height+(path.end.height-path.start.height)*posture,
        tilt:path.start.tilt+(path.end.tilt-path.start.tilt)*posture};
}
export function deskPoseClear(room,record,pose){return poseIsClear(pose,deskRoomBounds(room),deskObstacles(room,record),deskFootprint(record));}
export function freeDeskPosition(room,records,size){
    const footprint={halfWidth:(size==='60x30'?1524:1219.2)/2+30,halfDepth:620,margin:35},bounds=deskRoomBounds(room);
    const obstacles=grooveObstacles(room);
    // The active desk's snapshot is intentionally excluded by the ordinary
    // Groove scanner; put its footprint back for placement of a new desk.
    for(const r of records.values())if(r.group?.userData.sceneDeskActive){
        const f=deskFootprint(r),p=r.state.pose,c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=p.x+c*f.offsetX+s*f.offsetZ,z=p.z-s*f.offsetX+c*f.offsetZ;
        const ex=Math.abs(c)*f.halfWidth+Math.abs(s)*f.halfDepth,ez=Math.abs(s)*f.halfWidth+Math.abs(c)*f.halfDepth;
        obstacles.push({minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez});
    }
    for(let z=bounds.minZ+800;z<bounds.maxZ-750;z+=300)for(let x=bounds.minX+900;x<bounds.maxX-900;x+=300){const p={x,z,yaw:0};if(poseIsClear(p,bounds,obstacles,footprint))return p;}
    return null;
}
