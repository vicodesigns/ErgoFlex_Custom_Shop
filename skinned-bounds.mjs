import * as THREE from 'three';

// Each skinned vertex is a convex combination of bone-transformed positions. A union of
// per-bone boxes therefore conservatively bounds the animated mesh without re-skinning
// every vertex on the CPU each frame. Keep the original mesh for picking and editing.
const caches=new WeakMap();
const point=new THREE.Vector3(),matrix=new THREE.Matrix4(),transformed=new THREE.Box3();
function build(mesh){
    const g=mesh.geometry,p=g.attributes.position,indices=g.attributes.skinIndex,weights=g.attributes.skinWeight;
    if(!p||!indices||!weights||g.morphAttributes.position?.length)return null;
    const boxes=mesh.skeleton.bones.map(()=>new THREE.Box3());
    for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix);
        let total=0;
        for(let j=0;j<4;j++){
            const weight=weights.getComponent(i,j),bone=indices.getComponent(i,j);
            if(weight<0||!Number.isFinite(weight))return null;
            total+=weight;
            if(weight){if(!boxes[bone])return null;boxes[bone].expandByPoint(point);}
        }
        if(Math.abs(total-1)>1e-4)return null;
    }
    return {geometry:g,boxes:boxes.map((box,i)=>({box,i})).filter(e=>!e.box.isEmpty()),merged:new THREE.Box3()};
}
export function updateSkinnedBounds(root){
    root.updateWorldMatrix(true,false);
    root.updateMatrixWorld(true);
    root.traverse(mesh=>{
        if(!mesh.isSkinnedMesh)return;
        let cache=caches.get(mesh);
        if(!caches.has(mesh)||(cache&&cache.geometry!==mesh.geometry)){cache=build(mesh);caches.set(mesh,cache);}
        if(!cache){mesh.frustumCulled=false;return;}
        const out=cache.merged.makeEmpty();
        for(const {box,i} of cache.boxes){
            matrix.multiplyMatrices(mesh.bindMatrixInverse,mesh.skeleton.bones[i].matrixWorld).multiply(mesh.skeleton.boneInverses[i]);
            out.union(transformed.copy(box).applyMatrix4(matrix));
        }
        // Cover floating-point skin weights and transformed bound edges.
        const epsilon=Math.max(1e-7,out.getSize(point).length()*1e-4);
        out.expandByScalar(epsilon);
        out.getBoundingSphere(mesh.boundingSphere ||= new THREE.Sphere());
        mesh.frustumCulled=true;
    });
}
