#!/usr/bin/env node
// Render every environment at each authored time, plus a JSON lighting report.
// node tools/props/daypart-review.mjs --out scene-shots/review [--only home,music]
// Uses an isolated local server and browser; no user project data is changed.
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const outDir = resolve(opt('--out', join(root, 'scene-shots')));
const only = opt('--only')?.split(',');
mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(root, name === '/' ? 'index.html' : name);
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const launch = () => puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
let browser = await launch();
const errors=[];
try {
const newPage = async () => {
    const p = await browser.newPage(); p.setDefaultNavigationTimeout(120000);
    p.on('pageerror', e => {errors.push(e.message);console.error('page error:',e.message);});
    p.on('console', m => { if(m.type()==='error' && /Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text())) {errors.push(m.text());console.error(m.text());} });
    return p;
};
let page = await newPage();
await page.setViewport({ width: 1500, height: 1100 });
await page.goto(url + '?room=product&view=product',{waitUntil:'domcontentloaded'});
await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 120000 });
await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).display === 'none');
await page.evaluate(() => { ErgoFlex.setShellMode('studio'); ErgoFlex.renderer.setPixelRatio(1); });
await page.addStyleTag({content:'#motion-dock{visibility:hidden!important}'});
await page.evaluate(() => ErgoFlex.renderer.setAnimationLoop(null));
await new Promise(resolve=>setTimeout(resolve,150));

const names = await page.evaluate(() => Object.fromEntries(ErgoFlex.roomScenes.filter(s => s.id !== 'product').map(s => [s.id, s.name])));
const reportFile=join(outDir,'report.json');
const report=only&&existsSync(reportFile)?JSON.parse(readFileSync(reportFile,'utf8')).filter(r=>!only.includes(r.id)):[];
for(const [id,name] of (only ? only.map(id=>[id,names[id]]).filter(([,name])=>name) : Object.entries(names))) {
    if(only&&!only.includes(id))continue;
    // A fresh process releases software-renderer memory between large scenes.
    // The query selects the layout without cancelling an initial prop load.
    await browser.close(); browser = await launch(); page = await newPage();
    await page.setViewport({width:1500,height:1100});
    console.log('Rendering',id);
    await page.goto(url+'?room='+id+'&view=room&layout=house',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ErgoFlex?.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
    await page.evaluate(()=>{window.__reviewReady=false;window.__reviewPromise=ErgoFlex.workspaceRoom.ready.then(()=>import('three')).then(THREE=>{window.__reviewThree=THREE;window.__reviewReady=true;});});
    await page.waitForFunction(()=>window.__reviewReady,{timeout:120000});
    await page.evaluate(()=>{ErgoFlex.setShellMode('studio');ErgoFlex.renderer.setPixelRatio(1);ErgoFlex.renderer.setAnimationLoop(null);});
    await page.addStyleTag({content:'#motion-dock{visibility:hidden!important}'});
    await new Promise(resolve=>setTimeout(resolve,150));
    await page.evaluate(()=>{
        const THREE=window.__reviewThree,ef=ErgoFlex,room=ef.workspaceRoom,{camera,controls}=ef.roomInteractions;
        room.root.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(room.root).expandByObject(ef.loadedModel),center=box.getCenter(new THREE.Vector3());
        const direction=new THREE.Vector3(5,4,5).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
        const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;let distance=controls.minDistance;
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
            const point=new THREE.Vector3(x,y,z).sub(center),depth=point.dot(direction);
            distance=Math.max(distance,depth+Math.abs(point.dot(up))/tanV,depth+Math.abs(point.dot(right))/tanH);
        }
        controls.maxDistance=Math.max(30,distance*1.12);controls.enableDamping=false;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance*1.12);controls.update();room.update(camera);
    });
    for(const mode of ['morning','afternoon','evening','night','party']) {
        await page.evaluate((id,name,mode)=>{
            const THREE=window.__reviewThree,ef=ErgoFlex;
            ef.setMeasuredRoomMode(id,mode,false);const look=ef.measuredRoom.modes[mode];ef.setLedsEnabled(look.leds);if(look.color)ef.setLedColor(look.color,false);
            ef.setHeight(look.height);ef.setTilt('tilting',look.tilt);
            ef.workspaceRoom.update(ef.roomInteractions.camera);ef.workspaceAccessories.update();
            ef.roomLedSpill.update(ef.workspaceRoom,ef.ledPixelRenderer,{enabled:look.leds,colour:new THREE.Color(look.color||ef.ledColor),gain:1.8});
            ef.renderer.render(ef.roomInteractions.scene,ef.roomInteractions.camera);
        },id,name,mode);

        // Read the actual WebGL canvas immediately after drawing. This also
        // avoids compositor screenshot stalls in software-rendered CI browsers.
        await new Promise(resolve=>setTimeout(resolve,150));
        const png=await page.evaluate(()=>{
            ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera);
            const source=ErgoFlex.renderer.domElement,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
            const c=canvas.getContext('2d'),look=ErgoFlex.workspaceRoom.root.userData.polish,W=canvas.width,H=canvas.height;
            c.save();c.translate(W*.48,H*.32);c.scale(W,H);const gradient=c.createRadialGradient(0,0,0,0,0,.7);gradient.addColorStop(0,look.halo);gradient.addColorStop(.9,look.edge);gradient.addColorStop(1,look.edge);c.fillStyle=gradient;c.fillRect(-1,-1,2,2);c.restore();c.drawImage(source,0,0);
            return canvas.toDataURL('image/png').split(',')[1];
        });
        writeFileSync(join(outDir,`${id}-${mode}.png`),Buffer.from(png,'base64'));
        report.push(await page.evaluate((id,mode)=>({id,mode,missing:ErgoFlex.workspaceRoom.missingProps,lighting:ErgoFlex.roomLightingState,polish:ErgoFlex.workspaceRoom.root.userData.polish,details:ErgoFlex.workspaceRoom.root.userData.detailLevel,atmosphere:ErgoFlex.workspaceRoom.root.userData.institutionalAtmosphere,drawCalls:ErgoFlex.renderer.info.render.calls,triangles:ErgoFlex.renderer.info.render.triangles}),id,mode));
    }
    (await import('node:fs')).writeFileSync(reportFile,JSON.stringify(report,null,2));
    console.log('Reviewed',id);
}
(await import('node:fs')).writeFileSync(join(outDir,'report.json'),JSON.stringify(report,null,2));
if(errors.length)throw new Error(errors.join('\n'));
console.log(`screenshots → ${outDir}`);
} finally {await browser.close();server.close();}
