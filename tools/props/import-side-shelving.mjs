#!/usr/bin/env node
// The owner's side shelving for the desk's side slots (Manifest-Share/ErgoFlex/Shelving, supplied Nov 16 2026), as props.
// Rebuild: node tools/props/import-side-shelving.mjs   (reads models/ergoflex-supplied/shelving/*.glb)
// The CAD files are Draco-compressed, in inches, far from the origin, Y up, one primitive per face. Each is flattened
// (node transforms baked in), merged by ROLE and moved to a floor origin in metres (the library instances in mm):
//   'Side shelf wood'    the milled plate with its rounded edge: the desk's own wood (workspace-3d.mjs instance() flags it
//                        userData.artistShelfWood, which every desk update already fills from the live desktop finish)
//   'Side shelf acrylic' the cup holder and the cups: clear acrylic
//   'Side shelf print'   the cubby container: 3D-printed plastic in the desk's trim colour (userData.deskTrimPlastic)
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO,Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const root=path.resolve(import.meta.dirname,'../..'),SRC=path.join(root,'models/ergoflex-supplied/shelving'),INCH=.0254;
const SCENES=['office','home','creative','gaming','music','coworking','educational','library','highschool'];
// Role of a source material: by colour (the CAD files colour the parts: black plate, teal cubby, yellow cups).
const roleOf=(file,c)=>{
  if(/^Cup_Holder/.test(file))return 'acrylic';
  if(/Cup_Container/.test(file)){const [r,g,b]=c;return r+g+b<.1?'wood':b>.4&&r<.3?'print':'acrylic';}
  return 'wood';
};
const JOBS=[
  ['Large_Side_Shelve.glb','ergoflex-side-shelf-large','Side shelf · large'],
  ['Small_Side_Shelve.glb','ergoflex-side-shelf-small','Side shelf · small'],
  ['Double_Large_Side_Shelve.glb','ergoflex-side-shelf-large-pair','Side shelves · large pair'],
  ['Double_Small_Side_Shelve.glb','ergoflex-side-shelf-small-pair','Side shelves · small pair'],
  ['Cup_Holder.glb','ergoflex-side-cup-holder','Side cup holder · acrylic'],
  ['Large_Side_Shelve_Cup_Container.glb','ergoflex-side-shelf-large-cubby','Side shelf · large, cubby and cups'],
  ['Small_Side_Shelve_Cup_Container.glb','ergoflex-side-shelf-small-cubby','Side shelf · small, cubby and cups']];
const MAT={wood:{name:'Side shelf wood',color:[.78,.62,.42,1],rough:.5,metal:0},acrylic:{name:'Side shelf acrylic',color:[.93,.96,.97,1],rough:.08,metal:0},print:{name:'Side shelf print',color:[.08,.47,.54,1],rough:.5,metal:0}};
const only=process.argv.indexOf('--only')<0?null:new Set(process.argv[process.argv.indexOf('--only')+1].split(','));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()}).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule()});
const indexFile=path.join(root,'assets/props/index.json'),manifestFile=path.join(root,'tools/props/manifest.json');
const index=JSON.parse(fs.readFileSync(indexFile)),manifest=JSON.parse(fs.readFileSync(manifestFile));
const entries=new Map(index.props.map(p=>[p.id,p])),jobs=new Map(manifest.props.map(p=>[p.id,p]));
const mul=(m,v)=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
const mulN=(m,v)=>{const x=m[0]*v[0]+m[4]*v[1]+m[8]*v[2],y=m[1]*v[0]+m[5]*v[1]+m[9]*v[2],z=m[2]*v[0]+m[6]*v[1]+m[10]*v[2],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
for(const [file,id,name] of JOBS){
  if(only&&!only.has(id))continue;
  const doc=await io.read(path.join(SRC,file)),parts={wood:[],acrylic:[],print:[]};
  for(const node of doc.getRoot().listNodes()){
    const mesh=node.getMesh();if(!mesh)continue;const m=node.getWorldMatrix();
    for(const prim of mesh.listPrimitives()){
      const pos=prim.getAttribute('POSITION'),nor=prim.getAttribute('NORMAL'),idx=prim.getIndices(),c=prim.getMaterial()?.getBaseColorFactor()||[1,1,1,1];
      const role=roleOf(file,c),n=pos.getCount(),P=[],N=[],I=[];
      for(let i=0;i<n;i++){const v=mul(m,pos.getElement(i,[])),w=nor?mulN(m,nor.getElement(i,[])):[0,1,0];P.push(v);N.push(w);}
      const count=idx?idx.getCount():n;for(let i=0;i<count;i++)I.push(idx?idx.getScalar(i):i);
      parts[role].push({P,N,I});
    }
  }
  // bounds in inches over everything, then floor origin: centred in x/z, bottom on y=0
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const r of Object.values(parts))for(const p of r)for(const v of p.P)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}
  const origin=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];
  const out=new Document(),buffer=out.createBuffer(),scene=out.createScene(id);let tris=0;
  const group=out.createNode(name);scene.addChild(group);
  for(const [role,list] of Object.entries(parts)){
    if(!list.length)continue;const pos=[],nor=[],uv=[],ind=[];let base=0;
    for(const p of list){for(let i=0;i<p.P.length;i++){
      const x=(p.P[i][0]-origin[0])*INCH,y=(p.P[i][1]-origin[1])*INCH,z=(p.P[i][2]-origin[2])*INCH;pos.push(x,y,z);nor.push(...p.N[i]);
      // box-projected UVs (metres) so the desk's wood grain has coordinates to map onto: along the face's dominant axis
      const [nx,ny,nz]=p.N[i].map(Math.abs);uv.push(...(ny>=nx&&ny>=nz?[x,z]:nx>=nz?[z,y]:[x,y]));}
      for(const i of p.I)ind.push(base+i);base+=p.P.length;}
    const cfg=MAT[role],mat=out.createMaterial(cfg.name).setBaseColorFactor(cfg.color).setRoughnessFactor(cfg.rough).setMetallicFactor(cfg.metal);
    if(role==='acrylic')mat.setAlphaMode('BLEND').setBaseColorFactor([.93,.96,.97,.34]);
    const prim=out.createPrimitive().setMaterial(mat).setIndices(out.createAccessor().setArray(base>65535?new Uint32Array(ind):new Uint16Array(ind)).setBuffer(buffer))
      .setAttribute('POSITION',out.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer)).setAttribute('NORMAL',out.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer)).setAttribute('TEXCOORD_0',out.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer));
    group.addChild(out.createNode(cfg.name).setMesh(out.createMesh(cfg.name).addPrimitive(prim)));tris+=ind.length/3;
  }
  const fileOut=`assets/props/${id}.glb`,full=path.join(root,fileOut);await io.write(full,out);
  const size=[0,1,2].map(k=>Math.round((hi[k]-lo[k])*INCH*1e5)/100),min=[-size[0]/2,0,-size[2]/2],max=[size[0]/2,size[1],size[2]/2];
  const spec={id,name,category:'shelving',collection:'ErgoFlex Collection',scenes:SCENES,anchor:'floor',source:'ergoflex-supplied/shelving/'+file,converter:'side-shelving-import',license:'user-provided',attribution:'Owner-supplied side shelving CAD (Nov 16 2026)',sizeNote:'CAD coordinates treated as inches; dimensions are visualization estimates, not verified mounting specifications.',deskMatch:true};
  jobs.set(id,spec);entries.set(id,{...spec,source:'models/ergoflex-supplied/shelving/'+file,file:fileOut,size,min,max,tris,bytes:fs.statSync(full).size});
  console.log(id,size.join(' × ')+' mm',tris+' triangles',Math.round(fs.statSync(full).size/1024)+' KB',Object.entries(parts).filter(([,l])=>l.length).map(([r,l])=>r+':'+l.length).join(' '));
}
index.props=[...entries.values()];index.generated=new Date().toISOString();manifest.props=[...jobs.values()];
fs.writeFileSync(indexFile,JSON.stringify(index,null,1).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n');   // (the index keeps its \\uXXXX escapes)fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,1)+'\n');
