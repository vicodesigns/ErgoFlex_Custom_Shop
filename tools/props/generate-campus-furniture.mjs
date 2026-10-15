#!/usr/bin/env node
// Generate standalone GLBs from the owner's Atelier generator. No studio rugs,
// lights or tables are exported. Rebuild: node tools/props/generate-campus-furniture.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {CAMPUS_PROFILES} from './campus/profiles.mjs';
const root=path.resolve(import.meta.dirname,'../..'),arg=process.argv.indexOf('--only'),only=arg<0?null:new Set(process.argv[arg+1].split(','));
const selected=CAMPUS_PROFILES.filter(p=>!only||only.has(p.id));
if(!selected.length)throw Error('No matching Atelier profiles');
const html=`<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {createCampusFurniture} from '/atelier-campus-generator.mjs';
window.generate=async config=>{const sofa=createCampusFurniture(config),b=new THREE.Box3().setFromObject(sofa);let tris=0;sofa.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});const binary=await new GLTFExporter().parseAsync(sofa,{binary:true,onlyVisible:true});const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([binary]));});const geometries=new Set(),materials=new Set();sofa.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);[].concat(o.material).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());return{data,tris,lightAnchor:sofa.userData.lightAnchor,size:b.getSize(new THREE.Vector3()).toArray().map(v=>Math.round(v*1e5)/100),min:b.min.toArray().map(v=>Math.round(v*1e5)/100),max:b.max.toArray().map(v=>Math.round(v*1e5)/100)};};window.ready=true;</script>`;
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
  const source='supplied/atelier-campus-studio.html';
  const spec={id:profile.id,name:profile.name,category:'furniture',collection:'Atelier Campus',scenes:profile.scenes,anchor:profile.component==='wall-board'?'wall':'floor',source,converter:'campus-generator',profile:profile.id,fit:{axis:'x',mm:result.size[0]},license:'unconfirmed',attribution:'Owner-supplied Atelier 3D office and academic furniture generator',sizeNote:'Generated to real-world dimensions in metres; height and depth are not stretched. No staging walls or rugs are included.',revision:'campus-furniture-20261014'};
  jobs.set(profile.id,spec);entries.set(profile.id,{...spec,source:'models/'+source,file,size:result.size,min:result.min,max:result.max,tris:result.tris,bytes:fs.statSync(out).size,campus:{family:profile.family,archetype:profile.archetype,component:profile.component||'complete',lightAnchor:result.lightAnchor}});
  console.log(profile.id,result.size.join(' × ')+' mm',result.tris+' triangles',Math.round(fs.statSync(out).size/1024)+' KB');
 }
 index.props=[...entries.values()];index.generated=new Date().toISOString();manifest.props=[...jobs.values()];fs.writeFileSync(indexFile,JSON.stringify(index,null,1)+'\n');fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,1)+'\n');
}finally{browser?.disconnect();browser?.process()?.kill('SIGKILL');server.closeAllConnections();server.close();}
