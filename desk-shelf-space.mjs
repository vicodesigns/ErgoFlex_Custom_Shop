import * as THREE from 'three';

// Measure the actual supporting face in mount-local millimetres. Outer mesh
// bounds can include raised lips, rounded corners, and the side panels.
export function shelfStorageSpace(anchor,mountWorld,hardware=[]){
    anchor.updateWorldMatrix(true,false);
    const transform=mountWorld.clone().invert().multiply(anchor.matrixWorld),p=anchor.geometry?.attributes.position,index=anchor.geometry?.index;
    if(!p)return null;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),bounds=new THREE.Box3(),triangles=[];
    for(let i=0;i<(index?.count||p.count);i+=3){
        a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(transform);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(transform);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(transform);
        n.crossVectors(b.clone().sub(a),c.clone().sub(a));
        if(n.y<=0||n.y/n.length()<.85||Math.max(Math.abs(a.y),Math.abs(b.y),Math.abs(c.y))>1.5)continue;
        bounds.expandByPoint(a);bounds.expandByPoint(b);bounds.expandByPoint(c);triangles.push([a.x,a.z,b.x,b.z,c.x,c.z]);
    }
    if(bounds.isEmpty())return null;
    const obstacles=[];
    for(const obj of hardware){
        if(obj===anchor||!obj.geometry)continue;
        obj.updateWorldMatrix(true,false);if(!obj.geometry.boundingBox)obj.geometry.computeBoundingBox();
        const box=obj.geometry.boundingBox.clone().applyMatrix4(mountWorld.clone().invert().multiply(obj.matrixWorld));
        if(box.max.y>1&&box.max.x>bounds.min.x-30&&box.min.x<bounds.max.x+30&&box.max.z>bounds.min.z-30&&box.min.z<bounds.max.z+30)obstacles.push({min:box.min.toArray(),max:box.max.toArray()});
    }
    return {minX:bounds.min.x+24,maxX:bounds.max.x-24,minZ:bounds.min.z+24,maxZ:bounds.max.z-24,triangles,obstacles};
}
function triangleContains(x,z,[ax,az,bx,bz,cx,cz]){
    const s=(x-bx)*(az-bz)-(ax-bx)*(z-bz),t=(x-cx)*(bz-cz)-(bx-cx)*(z-cz),u=(x-ax)*(cz-az)-(cx-ax)*(z-az),epsilon=.01;
    return !((s< -epsilon||t< -epsilon||u< -epsilon)&&(s>epsilon||t>epsilon||u>epsilon));
}
export function shelfSupportsBox(space,box){
    if(!space?.triangles?.length)return true;
    // All corners must sit on the measured face. The inset bounds protect
    // the outer perimeter; a rigid keyboard or mouse pad can bridge an
    // internal cable hole without being pushed out onto a raised edge.
    const {min,max}=box;
    for(const [x,z] of [[min.x,min.z],[min.x,max.z],[max.x,min.z],[max.x,max.z]])if(!space.triangles.some(triangle=>triangleContains(x,z,triangle)))return false;
    return true;
}
// Dense samples also catch the desktop's concave front cutout. Merely testing
// the corners of a wide notebook can bridge that opening in empty space.
export function surfaceSupportsFootprint(space,box,margin=8){
    if(!space?.triangles?.length)return true;
    const minX=box.min.x-margin,maxX=box.max.x+margin,minZ=box.min.z-margin,maxZ=box.max.z+margin;
    if(minX<space.minX||maxX>space.maxX||minZ<space.minZ||maxZ>space.maxZ)return false;
    const nx=Math.max(1,Math.ceil((maxX-minX)/25)),nz=Math.max(1,Math.ceil((maxZ-minZ)/25));
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
        const x=minX+(maxX-minX)*ix/nx,z=minZ+(maxZ-minZ)*iz/nz;
        if(!space.triangles.some(t=>triangleContains(x,z,t)))return false;
    }
    return true;
}
export function inputStowKind(item){
    const data=item.obj.userData,id=`${data.accessoryId||''} ${data.propId||''} ${item.saved.propId||''} ${item.saved.label||''} ${item.obj.name}`.toLowerCase();
    if(/keyboard-tray|keyboard tray/.test(id))return null;
    if(/keyboard|k860/.test(id))return 'keyboard';
    if(/mouse|mx-master|logitech-lift|trackpad/.test(id))return 'mouse';
    return null;
}
