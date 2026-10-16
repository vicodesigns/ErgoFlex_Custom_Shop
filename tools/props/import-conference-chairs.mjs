#!/usr/bin/env node
// Generate standalone GLBs from the owner's Atelier generator. No studio rugs,
// lights or tables are exported. Rebuild: node tools/props/import-conference-chairs.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {CONFERENCE_PROFILES} from './conference/profiles.mjs';
const root=path.resolve(import.meta.dirname,'../..'),arg=process.argv.indexOf('--only'),only=arg<0?null:new Set(process.argv[arg+1].split(','));
const selected=CONFERENCE_PROFILES.filter(p=>!only||only.has(p.id));
if(!selected.length)throw Error('No matching Atelier profiles');
const html=`<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const source=await(await fetch('/models/supplied/atelier-conference-chair-sidechair.glb')).arrayBuffer(),view=new DataView(source),json=JSON.parse(new TextDecoder().decode(new Uint8Array(source,20,view.getUint32(12,true))));
function normalTexture(texture){
 const image=texture.image,w=image.width,h=image.height,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,w,h).data,out=ctx.createImageData(w,h),sample=(x,y)=>data[(((y+h)%h)*w+(x+w)%w)*4]/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=new THREE.Vector3((sample(x-1,y)-sample(x+1,y))*1.5,(sample(x,y-1)-sample(x,y+1))*1.5,1).normalize(),i=(y*w+x)*4;out.data[i]=(n.x*.5+.5)*255;out.data[i+1]=(n.y*.5+.5)*255;out.data[i+2]=(n.z*.5+.5)*255;out.data[i+3]=255;}ctx.putImageData(out,0,0);return new THREE.CanvasTexture(canvas);
}
window.generate=async config=>{
 const gltf=await new GLTFLoader().parseAsync(source.slice(0),'/models/supplied/'),finished=[];
 for(let i=0;i<json.materials.length;i++){
  const m=await gltf.parser.getDependency('material',i);finished.push(m);m.name=['Conference brushed frame','Conference non-marking feet','Conference molded shell','Conference upholstery'][i];
  m.userData={roomPaletteLocked:true,conferencePart:['frame','feet','shell','upholstery'][i]};
  m.color.set([config.frame,'#252b2b',config.shell,config.fabric][i]);m.metalness=[.83,0,.04,0][i];m.roughness=[.36,.92,.5,config.roughness][i];if(i===2){m.clearcoat=.24;m.clearcoatRoughness=.35;}if(i===3){m.sheen=.55;m.sheenColor?.set(config.fabric);m.sheenRoughness=.9;}
  const bump=json.materials[i].extensions?.EXT_materials_bump;
  if(bump){const height=await gltf.parser.getDependency('texture',bump.bumpTexture.index),normal=normalTexture(height),repeat=bump.bumpTexture.extensions?.KHR_texture_transform?.scale||[1,1];normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.fromArray(repeat);m.normalMap=normal;m.normalScale.setScalar(i===3?.19:.1);}
 }
 gltf.scene.traverse(o=>{if(!o.isMesh)return;const materialIndex=gltf.parser.associations.get(o.material)?.materials;if(materialIndex===undefined)throw Error('Source chair material association missing');o.material=finished[materialIndex];});
 const model=gltf.scene,group=new THREE.Group();model.scale.setScalar(.94);group.add(model);group.name=config.name;
 let bounds=new THREE.Box3().setFromObject(group,true),center=bounds.getCenter(new THREE.Vector3());group.position.set(-center.x,-bounds.min.y,-center.z);group.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(group,true);
 group.userData={conferenceChair:true,family:config.family};let tris=0;group.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 const binary=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true}),data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([binary]));});
 return {data,tris,size:bounds.getSize(new THREE.Vector3()).toArray().map(v=>Math.round(v*1e5)/100),min:bounds.min.toArray().map(v=>Math.round(v*1e5)/100),max:bounds.max.toArray().map(v=>Math.round(v*1e5)/100)};
};window.ready=true;</script>`;
const mime={'.mjs':'text/javascript','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json'};
const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/__atelier.html'){res.setHeader('content-type','text/html');return res.end(html);}const file=path.join(root,decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/__atelier.html`);await page.waitForFunction(()=>window.ready,{timeout:60000});
 const indexFile=path.join(root,'assets/props/index.json'),manifestFile=path.join(root,'tools/props/manifest.json'),index=JSON.parse(fs.readFileSync(indexFile)),manifest=JSON.parse(fs.readFileSync(manifestFile));
 const entries=new Map(index.props.map(p=>[p.id,p])),jobs=new Map(manifest.props.map(p=>[p.id,p]));
 for(const profile of selected){
  const result=await page.evaluate(p=>window.generate(p),profile),raw=path.join('/tmp',profile.id+'-raw.glb'),file=`assets/props/${profile.id}.glb`,out=path.join(root,file);
  fs.writeFileSync(raw,Buffer.from(result.data,'base64'));
  const optimize=spawnSync(path.join(root,'node_modules/.bin/gltf-transform'),['optimize',raw,out,'--compress','meshopt','--texture-compress','webp','--texture-size','512','--simplify','false','--instance','false','--join','false','--palette','false'],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(optimize.status!==0)throw Error(profile.id+': '+optimize.stderr);fs.unlinkSync(raw);
  const source='supplied/atelier-conference-chair-sidechair.glb';
  const spec={id:profile.id,name:profile.name,category:'furniture',collection:'Atelier Conference Chairs',scenes:profile.scenes,anchor:'floor',source,converter:'conference-chair-import',profile:profile.id,fit:{axis:'x',mm:result.size[0]},license:'user-provided',attribution:'Owner-supplied Atelier conference side chair model',sizeNote:'Generated to real-world dimensions in metres; height and depth are not stretched. Frame, molded shell and upholstery are finished separately. Shared room chair footprints are tested at both desk widths.',revision:'conference-chairs-20261015'};
  jobs.set(profile.id,spec);entries.set(profile.id,{...spec,source:'models/'+source,file,size:result.size,min:result.min,max:result.max,tris:result.tris,bytes:fs.statSync(out).size,conferenceChair:{family:profile.family,scale:.94}});
  console.log(profile.id,result.size.join(' × ')+' mm',result.tris+' triangles',Math.round(fs.statSync(out).size/1024)+' KB');
 }
 index.props=[...entries.values()];index.generated=new Date().toISOString();manifest.props=[...jobs.values()];fs.writeFileSync(indexFile,JSON.stringify(index,null,1)+'\n');fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,1)+'\n');
}finally{browser?.disconnect();browser?.process()?.kill('SIGKILL');server.closeAllConnections();server.close();}
