import * as THREE from 'three';

const cache=new WeakMap();
// The institutional detail builder batches loose notes/tools into one mesh.
// Reconstruct its connected pieces only for temporary storage, keeping the
// original geometry and every saved transform untouched.
function components(geometry){
    if(cache.has(geometry))return cache.get(geometry);
    const p=geometry.attributes.position,index=geometry.index,count=(index?.count||p.count)/3,parent=Array.from({length:count},(_,i)=>i),vertices=new Map();
    const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    for(let t=0;t<count;t++)for(let k=0;k<3;k++){
        const i=index?index.getX(t*3+k):t*3+k,key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
        if(vertices.has(key))parent[find(t)]=find(vertices.get(key));else vertices.set(key,t);
    }
    const sets=new Map();for(let t=0;t<count;t++){const key=find(t);if(!sets.has(key))sets.set(key,[]);sets.get(key).push(t);}
    // Very detailed geometry is a real model, rather than a little batched kit.
    if(sets.size<2||sets.size>100){cache.set(geometry,null);return null;}
    const parts=[...sets.values()].map(triangles=>{
        const part=new THREE.BufferGeometry();for(const [name,a] of Object.entries(geometry.attributes)){
            const values=[];for(const t of triangles)for(let k=0;k<3;k++){const i=index?index.getX(t*3+k):t*3+k;for(let j=0;j<a.itemSize;j++)values.push(a.array[i*a.itemSize+j]);}
            part.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(values),a.itemSize,a.normalized));
        }
        part.computeBoundingBox();return part;
    });cache.set(geometry,parts);
    geometry.addEventListener('dispose',()=>{cache.get(geometry)?.forEach(part=>part.dispose());cache.delete(geometry);});
    return parts;
}
export function compactStowParts(item){
    const root=item.obj;if(root.userData.propId||root.userData.accessoryId||root.userData.dayKit)return null;
    root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),sources=[];
    root.traverseVisible(o=>{if(o.isMesh&&!o.material?.isShaderMaterial&&o.material?.blending!==THREE.AdditiveBlending&&o.name!=='Light pool')sources.push(o);});
    if(!sources.length||sources.length>100||!sources.some(o=>o.name==='Furnishing detail'&&o.geometry.attributes.color))return null;
    const pieces=[];
    for(const mesh of sources){const geometries=mesh.name==='Furnishing detail'&&mesh.geometry.attributes.color?components(mesh.geometry)||[mesh.geometry]:[mesh.geometry];
        const relative=inverse.clone().multiply(mesh.matrixWorld);
        for(const geometry of geometries){
            if(!geometry.boundingBox)geometry.computeBoundingBox();
            const bounds=geometry.boundingBox.clone().applyMatrix4(relative),size=bounds.getSize(new THREE.Vector3());
            if(size.y<=8&&Math.max(size.x,size.z)>700){
                // Flexible ESD mats and broad paper sheets roll for storage;
                // tools resting on them must remain separate physical objects.
                const radius=Math.max(12,Math.sqrt(Math.max(size.x,size.z)*Math.max(1,size.y)/Math.PI));
                const roll=new THREE.CylinderGeometry(radius,radius,Math.max(10,Math.min(size.x,size.z)),24).rotateZ(Math.PI/2);roll.computeBoundingBox();
                const color=geometry.attributes.color,mat=new THREE.MeshStandardMaterial({color:color?new THREE.Color().fromBufferAttribute(color,0):mesh.material.color,roughness:.8});
                pieces.push({geometry:roll,material:mat,relative:new THREE.Matrix4(),bounds:roll.boundingBox.clone(),rolled:true});
            }else pieces.push({geometry,material:mesh.material,relative,bounds});
        }
    }
    // Keep touching covers/pages, screen bezels/glass and tool handles together.
    const parent=pieces.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    const gap=3/Math.max(...root.scale.toArray());
    for(let i=0;i<pieces.length;i++)for(let j=0;j<i;j++)if(!pieces[i].rolled&&!pieces[j].rolled){
        const a=pieces[i].bounds.clone().expandByScalar(gap),b=pieces[j].bounds;
        if(!a.intersectsBox(b))continue;
        const union=a.clone().union(b).getSize(new THREE.Vector3());
        // A long connecting cable must not join several separate laptops into
        // one desk-wide object. Nested covers/glass and small tool parts do join.
        if(a.containsBox(b)||b.clone().expandByScalar(gap).containsBox(pieces[i].bounds)||Math.max(...union.toArray())<300)parent[find(i)]=find(j);
    }
    const groups=new Map();
    pieces.forEach((part,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,new THREE.Group());const g=groups.get(key),m=new THREE.Mesh(part.geometry,part.material);m.matrixAutoUpdate=false;m.matrix.copy(part.relative);m.castShadow=m.receiveShadow=true;g.add(m);if(part.rolled){g.stowOwnedResources||=[];g.stowOwnedResources.push(part.geometry,part.material);}});
    for(const g of groups.values()){
        const b=new THREE.Box3();g.children.forEach(m=>b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix)));
        const size=b.getSize(new THREE.Vector3());
        // A transaction counter and its support legs are permanently attached
        // behind the worktop. They are not a loose pile of office supplies.
        if((size.x>700&&(b.min.z< -390||(size.z<150&&b.min.z< -250)))||(size.x<80&&size.y>250&&size.z<150&&b.min.z< -250))g.userData.deskStowFixed=true;
    }
    return groups.size>1||[...groups.values()].some(g=>g.userData.deskStowFixed||g.stowOwnedResources)?[...groups.values()]:null;
}
