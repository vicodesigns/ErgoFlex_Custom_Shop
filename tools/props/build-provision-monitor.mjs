#!/usr/bin/env node
// Rebuild the user-supplied HTML display as a portable GLB source for convert-props.
import puppeteer from 'puppeteer';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const html=`<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/"}}</script><script type="module">
import {createProVisionMonitor} from '/tools/props/provision-monitor-model.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
window.exportModel=async()=>Array.from(new Uint8Array(await new GLTFExporter().parseAsync(createProVisionMonitor(),{binary:true})));
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
 const bytes=await page.evaluate(()=>window.exportModel());mkdirSync(join(root,'models/ergoflex-supplied'),{recursive:true});writeFileSync(join(root,'models/ergoflex-supplied/ProVisionUltra32.glb'),Buffer.from(bytes));
 console.log(`ProVision Ultra source generated: ${bytes.length} bytes.`);
}finally{await browser?.close();server.close();}
