import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A batched desk keeps the real CAD's motion. Cohorts are identified by their
// relative transforms at two probe poses, rather than guessed mesh names.
// Sampling is synchronous and restores the live rig before the next render.
export function buildSceneDeskRig({sample,height=28,tilt=0}) {
    const group=new THREE.Group(), bodies=[], artworkBodies=[], mounts={}, sources=[], initial=new Map();
    let disposed=false,bodyVisible=true;
    sample(height,tilt,({model,toRoom})=>{
        model.traverseVisible(source=>{
            if(!source.isMesh||!source.geometry||source.userData.surfaceArtwork)return;
            const mats=Array.isArray(source.material)?source.material:[source.material];
            if(mats.every(m=>!m||m.isShaderMaterial))return;
            sources.push(source);initial.set(source,toRoom.clone().multiply(source.matrixWorld));
        });
    });
    const signatures=new Map(sources.map(s=>[s,[]]));
    for(const [h,t] of [[Math.min(52.5,height+4),tilt],[Math.max(36,height),Math.min(65,tilt+8)]]){
        sample(h,t,({toRoom})=>{
            for(const s of sources){
                const delta=toRoom.clone().multiply(s.matrixWorld).multiply(initial.get(s).clone().invert());
                signatures.get(s).push(delta.elements.map(n=>Math.round(n*10000)).join(','));
            }
        });
    }
    const batches=new Map();
    for(const source of sources){
        const mats=Array.isArray(source.material)?source.material:[source.material];
        mats.forEach((mat,index)=>{
            if(!mat||mat.isShaderMaterial)return;
            let geo=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
            if(mats.length>1){
                const ranges=source.geometry.groups.filter(g=>g.materialIndex===index);
                if(!ranges.length){geo.dispose();return;}
                const selected=new THREE.BufferGeometry();
                for(const name of ['position','normal','uv']){
                    const a=geo.getAttribute(name);if(!a)continue;const values=[];
                    for(const r of ranges)for(let i=r.start;i<r.start+r.count;i++)
                        for(let j=0;j<a.itemSize;j++)values.push(a.array[i*a.itemSize+j]);
                    selected.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
                }
                geo.dispose();geo=selected;
            }
            for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
            if(!geo.attributes.normal)geo.computeVertexNormals();
            if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
            geo.clearGroups();geo.applyMatrix4(initial.get(source));
            const appearance=JSON.stringify(['type','roughness','metalness','opacity','transparent','alphaTest','side','depthTest','depthWrite','vertexColors','bumpScale','envMapIntensity','polygonOffset','polygonOffsetFactor','polygonOffsetUnits']
                .map(k=>mat[k]).concat([mat.color?.getHex(),mat.normalScale?.toArray()],
                    ['map','normalMap','bumpMap','roughnessMap','metalnessMap','alphaMap','aoMap'].map(k=>mat[k]?.uuid)));
            const key=appearance+'|'+signatures.get(source).join('|');
            if(!batches.has(key))batches.set(key,{source,material:mat,geometries:[]});
            batches.get(key).geometries.push(geo);
        });
    }
    for(const b of batches.values()){
        const geometry=mergeGeometries(b.geometries,false);b.geometries.forEach(g=>g.dispose());
        if(!geometry)throw new Error('Desk geometry could not be batched');
        const material=b.material.clone();material.userData={...material.userData,sharedTextures:true};
        const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
        mesh.matrixAutoUpdate=false;
        bodies.push({mesh,source:b.source,sourceMaterial:b.material,inverse:initial.get(b.source).clone().invert()});
    }
    group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3());
    const offset=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
    let anchorModel;
    sample(height,tilt,({model,toRoom,accessoryMounts})=>{
        // The anchor is fixed in the model: switching or changing posture cannot
        // drift a desk's position by recentering its changing desktop bounds.
        anchorModel=new THREE.Vector3(center.x,bounds.min.y,center.z).applyMatrix4(toRoom.clone().invert()).applyMatrix4(model.matrixWorld.clone().invert());
        for(const [role,m] of accessoryMounts){
            if(!m.dress||role==='floor')continue;
            const mount=new THREE.Group();mount.name='Desk dressing:'+role;mount.matrixAutoUpdate=false;
            mount.userData.surfaceSize={width:m.width,depth:m.depth};
            mount.matrix.copy(offset).multiply(toRoom).multiply(m.dress.matrixWorld);group.add(mount);mounts[role]=mount;
        }
    });
    const updatePose=(h,t)=>sample(h,t,({toRoom,accessoryMounts})=>{
        height=h;tilt=t;
        for(const b of [...bodies,...artworkBodies]){b.mesh.matrix.copy(offset).multiply(toRoom).multiply(b.source.matrixWorld).multiply(b.inverse);b.mesh.matrixWorldNeedsUpdate=true;}
        for(const [role,mount] of Object.entries(mounts)){
            const m=accessoryMounts.get(role);if(m?.dress){mount.matrix.copy(offset).multiply(toRoom).multiply(m.dress.matrixWorld);mount.matrixWorldNeedsUpdate=true;}
        }
        group.updateMatrixWorld(true);
    });
    updatePose(height,tilt);
    const disposeArtwork=mesh=>{mesh.removeFromParent();mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();};
    return {group,mounts,anchorModel,updatePose,restyle:()=>{for(const b of bodies){b.mesh.material.copy(b.sourceMaterial);b.mesh.material.userData={...b.sourceMaterial.userData,sharedTextures:true};}},
        addArtwork:layers=>{
            artworkBodies.splice(0).forEach(b=>disposeArtwork(b.mesh));
            for(const {source,mesh} of layers){
                if(disposed||!initial.has(source)){disposeArtwork(mesh);continue;}
                mesh.geometry.applyMatrix4(initial.get(source));mesh.matrixAutoUpdate=false;mesh.visible=bodyVisible;
                artworkBodies.push({source,mesh,inverse:initial.get(source).clone().invert()});group.add(mesh);
            }
            if(!disposed)updatePose(height,tilt);
        },
        setBodyVisible:visible=>{bodyVisible=visible;[...bodies,...artworkBodies].forEach(b=>b.mesh.visible=visible);},
        dispose:()=>{disposed=true;group.removeFromParent();for(const b of bodies){b.mesh.geometry.dispose();b.mesh.material.dispose();}artworkBodies.forEach(b=>disposeArtwork(b.mesh));group.clear();}};
}
