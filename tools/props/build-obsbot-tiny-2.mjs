#!/usr/bin/env node
// Export the adapted local OBSBOT HTML reference using the studio's Three.js version.
import puppeteer from 'puppeteer';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join,extname} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const html=`<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';
import {createObsbotTiny2} from '/tools/props/obsbot-tiny-2-model.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
window.exportModel=async()=>{
 const model=createObsbotTiny2();model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);let tris=0;
 model.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 return {bytes:Array.from(new Uint8Array(await new GLTFExporter().parseAsync(model,{binary:true}))),min:bounds.min.toArray().map(v=>v*1000),max:bounds.max.toArray().map(v=>v*1000),tris};
};</script>`;
const server=createServer((req,res)=>{
 if(req.url==='/__model'){res.setHeader('Content-Type','text/html');return res.end(html);}
 try{const path=join(root,new URL(req.url,'http://local').pathname);if(!path.startsWith(root+'/'))return res.writeHead(403).end();res.setHeader('Content-Type',extname(path)==='.mjs'?'text/javascript':'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 page.on('pageerror',e=>console.error(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/__model`);await page.waitForFunction(()=>typeof window.exportModel==='function');
 const {bytes,min,max,tris}=await page.evaluate(()=>window.exportModel());
 const id='obsbot-tiny-2',file=`assets/props/${id}.glb`;
 mkdirSync(join(root,'models/ergoflex-supplied'),{recursive:true});
 const source=join(root,'models/ergoflex-supplied/ObsbotTiny2.glb');writeFileSync(source,Buffer.from(bytes));
 const optimized=spawnSync(join(root,'node_modules/.bin/gltf-transform'),['optimize',source,join(root,file),'--compress','meshopt','--texture-compress','webp','--texture-size','512','--simplify','false'],{encoding:'utf8'});
 if(optimized.status!==0)throw new Error(optimized.stderr||'OBSBOT optimization failed');
 const path=join(root,'assets/props/index.json'),index=JSON.parse(readFileSync(path));
 const entry={id,name:'OBSBOT Tiny 2 webcam / mic',category:'electronics',scenes:['office','home','gaming','music','coworking','educational'],file,anchor:'floor',size:max.map((v,i)=>v-min[i]),min,max,tris,bytes:statSync(join(root,file)).size,source:'models/ergoflex-supplied/ObsbotTiny2.glb',license:'unconfirmed',attribution:'Adapted from local obsbot-refined.html supplied reference',collection:'ErgoFlex Collection',revision:'obsbot-tiny-2-20261012'};
 index.props=index.props.filter(p=>p.id!==id);index.props.push(entry);writeFileSync(path,JSON.stringify(index,null,1)+'\n');
 console.log(`${id}: ${bytes.length} bytes, ${tris} triangles, ${entry.size.map(v=>v.toFixed(2)).join(' × ')} mm`);
}finally{await browser?.close();server.close();}
