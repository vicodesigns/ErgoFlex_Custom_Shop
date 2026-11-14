import assert from 'node:assert/strict';
import * as THREE from 'three';
import {updateSkinnedBounds} from '../skinned-bounds.mjs';
const root=new THREE.Group(),g=new THREE.BoxGeometry(1,2,.5),n=g.attributes.position.count;
const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
for(let i=0;i<n;i++){indices[i*4+1]=1;const high=g.attributes.position.getY(i)>0;weights[i*4]=high?.25:1;weights[i*4+1]=high?.75:0;}
g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial()),a=new THREE.Bone(),b=new THREE.Bone();b.position.y=1;a.add(b);mesh.add(a);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([a,b]));
for(const turn of [0,.7,1.5,-1.2])for(const height of [0,.8,-.4]){
 b.rotation.z=turn;b.position.y=1+height;root.position.set(4,-2,7);root.scale.set(2,3,2);updateSkinnedBounds(root);
 assert.ok(mesh.frustumCulled,'animated mesh supports frustum culling');
 for(let i=0;i<n;i++){const p=mesh.getVertexPosition(i,new THREE.Vector3());assert.ok(mesh.boundingSphere.containsPoint(p),'animated vertex stays inside sphere');}
}
const invalid=mesh.clone();invalid.geometry=g.clone();invalid.geometry.attributes.skinWeight.setX(0,5);const other=new THREE.Group();other.add(invalid);updateSkinnedBounds(other);assert.equal(invalid.frustumCulled,false,'unusual skinning falls back safely');
console.log('PASS animated bounds contain all vertices through joint rotation, translation and root scaling; unsupported weights fall back safely.');
