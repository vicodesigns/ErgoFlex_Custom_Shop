// Separate material roles in the supplied, already fitted mouse. Geometry and
// its authored transforms stay unchanged; connected wheel parts get real metal.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),file=resolve(root,'assets/props/ergoflex-mx-master-mouse.glb');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(file);
if (!doc.getRoot().listMaterials().some(m=>m.getName()==='MX roller steel')) {
 const source=doc.getRoot().listMaterials()[0];
 const materials={shell:source.clone().setName('MX shell graphite').setRoughnessFactor(.48),
  grip:source.clone().setName('MX rubber grip').setRoughnessFactor(.85),
  trim:source.clone().setName('MX graphite trim').setBaseColorFactor([.025,.032,.04,1]).setRoughnessFactor(.48),
  steel:source.clone().setName('MX roller steel').setBaseColorFactor([.42,.46,.5,1]).setMetallicFactor(.95).setRoughnessFactor(.27)};
 for(const node of doc.getRoot().listNodes()) {
  const mesh=node.getMesh();if(!mesh)continue;
  for(const primitive of mesh.listPrimitives()) {
   const a=primitive.getAttribute('POSITION'),indices=primitive.getIndices().getArray(),parent=Array.from({length:a.getCount()},(_,i)=>i);
   const find=x=>parent[x]===x?x:parent[x]=find(parent[x]),join=(x,y)=>{parent[find(x)]=find(y)};
   const points=new Map();
   for(let i=0;i<a.getCount();i++){const key=a.getElement(i,[]).join(',');if(points.has(key))join(i,points.get(key));else points.set(key,i)}
   for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2])}
   const components=new Map(),matrix=node.getWorldMatrix();
   for(let i=0;i<a.getCount();i++){
    const key=find(i),c=components.get(key)||{lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]},p=a.getElement(i,[]);
    for(let k=0;k<3;k++){const v=(matrix[k]*p[0]+matrix[k+4]*p[1]+matrix[k+8]*p[2]+matrix[k+12])*1000;c.lo[k]=Math.min(c.lo[k],v);c.hi[k]=Math.max(c.hi[k],v)}components.set(key,c);
   }
   const roles=new Map();
   for(const [id,{lo,hi}] of components){
    const wheel=lo[0]>-12&&hi[0]<-2&&lo[1]>14&&hi[1]<38&&lo[2]>22&&hi[2]<46;
    const thumb=lo[0]>17&&hi[0]<25&&lo[1]>30&&lo[2]>-27&&hi[2]<-7;
    roles.set(id,wheel||thumb?'steel':hi[1]<17||hi[0]-lo[0]<12?'trim':hi[2]-lo[2]>110&&hi[1]<46?'grip':'shell');
   }
   const buckets={shell:[],grip:[],trim:[],steel:[]};
   for(let i=0;i<indices.length;i+=3)buckets[roles.get(find(indices[i]))].push(indices[i],indices[i+1],indices[i+2]);
   for(const [role,values] of Object.entries(buckets)){if(!values.length)continue;const next=doc.createPrimitive().setMaterial(materials[role]);for(const semantic of primitive.listSemantics())next.setAttribute(semantic,primitive.getAttribute(semantic));next.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(values)).setBuffer(a.getBuffer()));mesh.addPrimitive(next)}
   mesh.removePrimitive(primitive);primitive.dispose();
  }
 }
 // Preserve quantization, but write portable uncompressed buffers.
 doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
 await io.write(file,doc);
}
const indexPath=resolve(root,'assets/props/index.json'),index=JSON.parse(readFileSync(indexPath));
Object.assign(index.props.find(p=>p.id==='ergoflex-mx-master-mouse'),{bytes:readFileSync(file).length,revision:'mx-material-roles-20261012'});
writeFileSync(indexPath,JSON.stringify(index,null,1)+'\n');
console.log('MX Master shell, rubber grip, trim and steel rollers exported.');
