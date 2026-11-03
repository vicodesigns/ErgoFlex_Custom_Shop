// Offline geometry regression, including the actual CAD shelf faces. No browser
// state, saved Product builds, or renderer is needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),context=vm.createContext({console,structuredClone,setTimeout,clearTimeout,URL,TextDecoder,TextEncoder});
const modules=new Map();
async function module(file){
    const key=file==='three'?path.join(root,'app-reference/assets/desk_viewer/three/three.module.min.js'):file.split('?')[0];
    if(modules.has(key))return modules.get(key);
    const m=new vm.SourceTextModule(fs.readFileSync(key,'utf8'),{context,identifier:key});modules.set(key,m);
    await m.link((specifier,from)=>module(specifier==='three'?'three':path.resolve(path.dirname(from.identifier),specifier)));
    return m;
}
const stowModule=await module(path.join(root,'desk-auto-stow.mjs'));await stowModule.evaluate();
const T=modules.get(path.join(root,'app-reference/assets/desk_viewer/three/three.module.min.js')).namespace;
const S=stowModule.namespace,H=modules.get(path.join(root,'desk-shelf-space.mjs')).namespace;
const binary=fs.readFileSync(path.join(root,'assets/model/desk-public.glb')),jsonSize=binary.readUInt32LE(12),gltf=JSON.parse(binary.subarray(20,20+jsonSize).toString()),bin=binary.subarray(28+jsonSize);
function attribute(id){const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView],count=a.count*({SCALAR:1,VEC3:3}[a.type]),offset=(view.byteOffset||0)+(a.byteOffset||0),kind=({5126:Float32Array,5123:Uint16Array,5125:Uint32Array})[a.componentType];return new kind(bin.buffer.slice(bin.byteOffset+offset,bin.byteOffset+offset+count*kind.BYTES_PER_ELEMENT));}
const boards=gltf.nodes.filter(n=>n.name==='Top_Shelf').map((n,i)=>{const p=gltf.meshes[n.mesh].primitives[0],geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(attribute(p.attributes.POSITION),3));if(p.indices!==undefined)geo.setIndex(new T.BufferAttribute(attribute(p.indices),1));geo.computeBoundingBox();const mesh=new T.Mesh(geo,new T.MeshBasicMaterial());mesh.scale.setScalar(25.4);mesh.name='Top_Shelf'+(i?'_'+i:'');mesh.updateMatrixWorld(true);return mesh;});
function surfaceMount(mesh){
    const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();let largest=0,top=0;
    for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i)).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,idx.getX(i+1)).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,idx.getX(i+2)).applyMatrix4(mesh.matrixWorld);normal.crossVectors(b.clone().sub(a),c.clone().sub(a));if(normal.y/normal.length()>.8&&normal.length()>largest){largest=normal.length();top=a.y;}}
    const bounds=new T.Box3().setFromObject(mesh),center=bounds.getCenter(new T.Vector3());center.y=top;
    const m=new T.Group();m.position.copy(center);m.rotation.y=Math.PI/2;m.updateMatrixWorld(true);m.userData.surfaceSize={width:bounds.max.z-bounds.min.z,depth:bounds.max.x-bounds.min.x};m.userData.storageSpace=H.shelfStorageSpace(mesh,m.matrixWorld,boards);assert.ok(m.userData.storageSpace);return m;
}
for(const width of ['48x30','60x30'])for(const product of [false,true])for(const yaw of [0,Math.PI/2]){
    const top=surfaceMount(boards[4]),middle=surfaceMount(boards[3]),desktop=new T.Group();desktop.position.copy(middle.position).add(new T.Vector3(0,-200,500));desktop.updateMatrixWorld(true);
    const purchaseTop=top.clone(false),purchaseMiddle=middle.clone(false);purchaseTop.children=[];purchaseMiddle.children=[];
    // Exercise different equivalent mount frames rather than relying on dress
    // and purchase mounts having numerically identical matrices.
    purchaseMiddle.position.x+=11;purchaseMiddle.updateMatrixWorld(true);
    const mounts={desktop,shelf:top,'lower-shelf':middle},r={id:'main',state:{size:width,tilt:9},product,rig:{mounts},objects:new Map()},editor={editing:false,manager:{selected:'main',ctx:{phase:()=> 'morning'}},purchaseMount:role=>role==='lower-shelf'?purchaseMiddle:purchaseTop},stow=new S.DeskAutoStow(editor);
    function item(id,size,role='desktop',manual=false){const obj=new T.Group();obj.name=id;obj.userData.accessoryId=id;const mesh=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial());mesh.position.y=size[1]/2;obj.add(mesh);mounts[role].add(obj);obj.position.set(50,0,20);obj.rotation.y=yaw;if(manual){obj.updateMatrix();obj.matrixAutoUpdate=false;}const saved={role,label:id},value={id,obj,saved};r.objects.set(id,value);return value;}
    const keyboard=item('ergo-keyboard',[480,70,270],'desktop',true),mouse=item('logitech-mx-master',[180,55,140]),book=item('notebook',[220,20,150]),cup=item('thermo-cup',[80,115,80]);
    const arm=item('monitor-arm',[120,360,110],'shelf');arm.obj.position.set(0,0,-180);
    const authored=new Map([...r.objects].map(([id,i])=>[id,JSON.stringify(S.deskTransform(i.obj))]));stow.update(r);assert.equal(keyboard.autoStow,undefined);
    r.state.tilt=35;stow.update(r);
    assert.equal(keyboard.autoStow?.role,'lower-shelf',width+' keyboard middle');assert.equal(mouse.autoStow?.role,'lower-shelf',width+' mouse middle');assert.equal(book.autoStow?.role,'shelf');assert.equal(cup.autoStow?.role,'shelf');
    const boxes=[];
    for(const i of [keyboard,mouse,book,cup]){
        assert.ok(!i.autoStow.hidden);const mount=mounts[i.autoStow.role],space=mount.userData.storageSpace;
        const actual=S.visibleDeskBounds(i.obj,mount.matrixWorld.clone().invert().multiply(i.obj.matrixWorld)),planned=i.autoStow.bounds;
        for(const f of ['x','y','z']){assert.ok(Math.abs(actual.min[f]-planned.min[f])<.001);assert.ok(Math.abs(actual.max[f]-planned.max[f])<.001);}
        assert.ok(actual.min.x>=space.minX-.001&&actual.max.x<=space.maxX+.001&&actual.min.z>=space.minZ-.001&&actual.max.z<=space.maxZ+.001);assert.ok(H.shelfSupportsBox(space,actual));
        for(const obstacle of space.obstacles){const b=new T.Box3(new T.Vector3().fromArray(obstacle.min),new T.Vector3().fromArray(obstacle.max));assert.ok(!actual.clone().expandByScalar(-.1).intersectsBox(b),i.id+' hits CAD shelf hardware');}
        for(const old of boxes)if(old.role===i.autoStow.role)assert.ok(!actual.clone().expandByScalar(-.1).intersectsBox(old.box));boxes.push({role:i.autoStow.role,box:actual});
        assert.equal(JSON.stringify(stow.authored(i)),authored.get(i.id));
    }
    const signature=r.stowSignature;r.state.tilt=36;stow.update(r);assert.equal(r.stowSignature,signature,'repacking each animation frame');assert.equal(r.stowStatus.angle,36);
    r.state.tilt=65;stow.update(r);assert.equal(keyboard.autoStow.role,'lower-shelf');
    r.state.tilt=9;stow.update(r);for(const i of [keyboard,mouse,book,cup]){assert.equal(i.autoStow,undefined);assert.equal(JSON.stringify(S.deskTransform(i.obj)),authored.get(i.id));}assert.equal(keyboard.obj.matrixAutoUpdate,false);
}
console.log('Shelf stow: actual CAD support faces and lips, 48/60-inch desks, active Product and scene mount frames, both input headings, middle-shelf keyboards/mice, top-shelf props, physical bounds/hardware, no item overlaps, manual-matrix restoration, unchanged authored transforms and stable animation packing verified.');
