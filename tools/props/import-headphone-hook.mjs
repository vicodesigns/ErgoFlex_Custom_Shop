// Import the owner's matching STEP tessellation and Rhino plug. No source files are edited.
import fs from 'node:fs';
import {Document,NodeIO,getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {unpartition} from '@gltf-transform/functions';
import draco from 'draco3dgltf';import {MeshoptDecoder} from 'meshoptimizer';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule(),'meshopt.decoder':MeshoptDecoder});
const dir='models/supplied/headphone-hook/',doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Headphone hook assembly'),root=doc.createNode('Plug face · outward +X').setExtras({headphoneHook:true});scene.addChild(root);
const black=doc.createMaterial('Hook · charcoal PETG').setBaseColorFactor([.045,.052,.058,1]).setRoughnessFactor(.48);
const aluminum=doc.createMaterial('Plug · polished aluminum').setBaseColorFactor([1,1,1,1]).setMetallicFactor(1).setRoughnessFactor(.14);
const stl=fs.readFileSync(dir+'HeadphoneHook_print.stl'),count=stl.readUInt32LE(80),positions=[],normals=[];
for(let i=0;i<count;i++){const off=84+i*50,n=[0,1,2].map(k=>stl.readFloatLE(off+k*4));for(let v=0;v<3;v++){const p=[0,1,2].map(k=>stl.readFloatLE(off+12+v*12+k*4));positions.push(p[1]/1000,p[2]/1000,p[0]/1000);normals.push(n[1],n[2],n[0]);}}
function primitive(pos,norm,mat){return doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(norm)).setBuffer(buffer)).setMaterial(mat);}
root.addChild(doc.createNode('HeadphoneHook · original CAD tessellation').setMesh(doc.createMesh().addPrimitive(primitive(positions,normals,black))));
const plug=await io.read(dir+'Plug_nonThreaded.glb'),mesh=doc.createMesh('Plug_nonThreaded');
for(const p of plug.getRoot().listMeshes()[0].listPrimitives()){
 const a=p.getAttribute('POSITION'),n=p.getAttribute('NORMAL'),v=[],ns=[],q=[],r=[];
 const index=p.getIndices();for(let i=0;i<(index?.getCount()||a.getCount());i++){const k=index?index.getScalar(i):i;a.getElement(k,q);n.getElement(k,r);
 // Rhino inches, Y-up GLB. Hook seats at shaft end; flange stays behind the panel.
 v.push(-(q[2]-144.4449)*.0254,(q[1]-56.3854)*.0254,(q[0]-1992.0343)*.0254);ns.push(-r[2],r[1],r[0]);}
 mesh.addPrimitive(primitive(v,ns,aluminum));
}
root.addChild(doc.createNode('Plug · shaft and inner retaining flange').setMesh(mesh));
await doc.transform(unpartition());await io.write('assets/props/ergoflex-headphone-hook.glb',doc);
for(const id of ['ergoflex-headphone-hook']){
 const d=await io.read('assets/props/'+id+'.glb'),b=getBounds(d.getRoot().listScenes()[0]);
 const f='assets/props/index.json',index=JSON.parse(fs.readFileSync(f));index.props=index.props.filter(p=>p.id!==id);index.props.push({id,name:id.endsWith('hanging-headphones')?'Headphones on plug-mounted hook':'ErgoFlex plug-mounted headphone hook',category:'desk',collection:'ErgoFlex Hardware',scenes:['office','home','gaming','music','occmedialab','highschool','library'],file:'assets/props/'+id+'.glb',anchor:'socket',size:b.max.map((v,i)=>(v-b.min[i])*1000),min:b.min.map(v=>v*1000),max:b.max.map(v=>v*1000),license:'user-provided',revision:'headphone-aluminum-20261103',headphoneHook:true});fs.writeFileSync(f,JSON.stringify(index,null,1)+'\n');console.log(id,b);
}
