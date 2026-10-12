#!/usr/bin/env node
// Rebuild the user-supplied HTML display as a portable GLB source for convert-props.
import puppeteer from 'puppeteer';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const html=`<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';
import {createProVisionMonitor} from '/tools/props/provision-monitor-model.mjs';
import {createAetherMonitor} from '/tools/props/aether-monitor-model.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
window.exportModel=async(kind)=>{
 const model=kind==='curved'?createAetherMonitor():createProVisionMonitor({portrait:kind==='portrait'});
 model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),mount=model.getObjectByName('display-vesa-mount').getWorldPosition(new THREE.Vector3());
 return {bytes:Array.from(new Uint8Array(await new GLTFExporter().parseAsync(model,{binary:true}))),min:bounds.min.toArray(),max:bounds.max.toArray(),mount:mount.toArray()};
};
</script>`;
const server=createServer((req,res)=>{
 if(req.url==='/__model'){res.setHeader('Content-Type','text/html');return res.end(html);}
 try{const path=join(root,new URL(req.url,'http://local').pathname);if(!path.startsWith(root+'/'))return res.writeHead(403).end();res.setHeader('Content-Type',extname(path)==='.mjs'?'text/javascript':'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 page.on('pageerror',e=>console.error(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/__model`);await page.waitForFunction(()=>typeof window.exportModel==='function');
 for(const [kind,file] of [['flat','ProVisionUltra32'],['portrait','ProVisionUltra32Portrait'],['curved','Aether34UW']]) {
  const exported=await page.evaluate(kind=>window.exportModel(kind),kind),bytes=exported.bytes;mkdirSync(join(root,'models/ergoflex-supplied'),{recursive:true});writeFileSync(join(root,`models/ergoflex-supplied/${file}.glb`),Buffer.from(bytes));
  const manifestPath=join(root,'tools/props/manifest.json'),manifest=JSON.parse(readFileSync(manifestPath));
  const entry=manifest.props.find(p=>p.source===`ergoflex-supplied/${file}.glb`);
  if(entry){const axis={x:0,y:1,z:2}[entry.fit.axis],factor=entry.fit.mm/(exported.max[axis]-exported.min[axis]);
   entry.displayMountMm=exported.mount.map((v,i)=>(v-(i===1?exported.min[i]:(exported.min[i]+exported.max[i])/2))*factor);
   writeFileSync(manifestPath,JSON.stringify(manifest,null,1)+'\n');
  }
  console.log(`${file} source generated: ${bytes.length} bytes.`);
 }
}finally{await browser?.close();server.close();}
