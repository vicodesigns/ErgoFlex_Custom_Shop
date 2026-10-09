const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'scene-shots/controller-20261008');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text()))errors.push(m.text());});
        await page.setViewport({ width: 1500, height: 1200 });

        await page.evaluateOnNewDocument(()=>{localStorage.setItem('ergoflex.dockSizeV1',JSON.stringify({v:1,w:674,h:810}));localStorage.setItem('ergoflex.motionDockCollapsed','false');});
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=product`);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length===4&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        await page.evaluate(async()=>{ErgoFlex.renderer.setPixelRatio(.6);ErgoFlex.renderer.shadowMap.enabled=false;});

        if(process.env.GENERATE_REMOTE_THUMB){
            const thumb=await page.evaluate(async()=>{
                const THREE=await import('three'),renderer=ErgoFlex.renderer;
                const scene=new THREE.Scene(),model=ErgoFlex.loadedModel.clone(true);
                scene.environment=ErgoFlex.arContext?.scene?.environment||null;scene.add(model);scene.add(new THREE.HemisphereLight(0xffffff,0x8090a0,3));
                const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(2,3,4);scene.add(light);
                const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
                const camera=new THREE.PerspectiveCamera(35,128/160,.001,100);
                camera.position.copy(center).add(new THREE.Vector3(1.6,1.1,2.1).normalize().multiplyScalar(size.y*2.1));camera.lookAt(center);
                const oldSize=renderer.getSize(new THREE.Vector2()),oldRatio=renderer.getPixelRatio(),oldClear=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
                renderer.setPixelRatio(1);renderer.setSize(128,160,false);renderer.setClearColor(0,0);renderer.render(scene,camera);
                const result=renderer.domElement.toDataURL('image/png');
                renderer.setClearColor(oldClear,oldAlpha);renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);
                return result.split(',')[1];
            });
            fs.writeFileSync(path.join(root,'assets/app-icons/controller-desk.png'),Buffer.from(thumb,'base64'));
            await page.$eval('.hub-desk',async e=>{e.innerHTML='<img src="./assets/app-icons/controller-desk.png?rendered" alt="Your ErgoFlex desk">';await e.firstChild.decode();});
        }
        if(await page.$eval('#motion-dock',e=>e.classList.contains('collapsed')))await page.click('#motion-dock-toggle');
        const layout=()=>page.evaluate(()=>{
            const dock=document.querySelector('#motion-dock'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
            return {size:ErgoFlex.remoteSize,shape:ErgoFlex.remoteShape,mode:dock.dataset.mode,scale:ErgoFlex.remoteScale,zoom:getComputedStyle(dock).zoom,cssScale:getComputedStyle(dock).scale,grips:dock.querySelectorAll('.remote-resize').length,dock:rect(dock),
                cards:[...dock.querySelectorAll('.remote-card')].map(rect),body:rect(dock.querySelector('.motion-dock-body')),
                viewport:{w:innerWidth,h:innerHeight},bodyScroll:dock.querySelector('.motion-dock-body').scrollHeight,bodyClient:dock.querySelector('.motion-dock-body').clientHeight,
                buttons:[...dock.querySelectorAll('.remote-header button,.remote-chip,.remote-form,.hub-led,.hub-groove')].map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim(),rect:rect(e)}))};
        });
        let l=await layout();assert.deepEqual(l.size,{w:720,h:298});assert.equal(l.grips,0);assert.equal(l.shape,'compact');
        assert.equal(l.bodyScroll,l.bodyClient,'No clipped controls or internal scroll');
        assert.deepEqual(await page.$$eval('.remote-form',els=>els.map(e=>e.textContent)),['Sitting','Stool','Standing']);
        await page.evaluate(()=>{ErgoFlex.setHeight(43.4);ErgoFlex.setTilt('tilting',-4);});
        await page.waitForFunction(()=>document.querySelector('#desk-height-display').value==='43.4'&&document.querySelector('#tilt-value').value==='-4');

        await page.screenshot({path:path.join(out,'desktop.png')});
        await page.$eval('#motion-dock',e=>e.scrollIntoView({block:'center'}));
        await (await page.$('#motion-dock')).screenshot({path:path.join(out,'controller.png')});
        await page.evaluate(()=>ErgoFlex.setRemoteSize(890,882));assert.deepEqual((await layout()).size,{w:720,h:298});
        await page.click('#motion-dock-toggle');assert.ok((await layout()).dock.h<90);
        await page.click('#motion-dock-toggle');await page.click('.remote-extras summary');
        assert.ok(await page.$eval('#remote-alert-sound',e=>e.getBoundingClientRect().height>0));
        await page.click('.remote-theme');assert.equal(await page.$eval('#motion-dock',e=>e.dataset.theme),'light');
        await page.click('.remote-theme');await page.click('.remote-extras summary');
        // The four visible dish arrows must steer, while the grooved ring turns.
        const pad=await page.$eval('#glide-pad',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
        for(const [x,y] of [[.5,.29],[.5,.71],[.29,.5],[.71,.5]]){
            await page.mouse.move(pad.x+pad.w*x,pad.y+pad.h*y);await page.mouse.down();
            assert.ok(await page.evaluate(()=>Math.hypot(ErgoFlex.glideInput.x,ErgoFlex.glideInput.y)>.1),'Dish arrow steers');
            assert.equal(await page.evaluate(()=>ErgoFlex.yawCommand),0);await page.mouse.up();
        }
        await page.mouse.move(pad.x+pad.w*.93,pad.y+pad.h*.5);await page.mouse.down();
        await page.mouse.move(pad.x+pad.w*.9,pad.y+pad.h*.65);
        assert.notEqual(await page.evaluate(()=>ErgoFlex.yawCommand),0,'Outer ring turns');await page.mouse.up();
        const arc=await page.$eval('.remote-arc',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
        for(const [y,sign] of [[.19,1],[.81,-1]]){
            await page.mouse.move(arc.x+arc.w*.4,arc.y+arc.h*y);await page.mouse.down();
            assert.equal(Math.sign(await page.$eval('#tilt-slider',e=>Number(e.value))),sign,'Visible tilt endpoint jogs correctly');
            await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('#tilt-slider').value)===0,{timeout:10000});
            assert.equal(await page.$eval('#tilt-slider',e=>Number(e.value)),0,'Tilt springs back');
        }
        await page.focus('#glide-pad');await page.keyboard.down('ArrowRight');await new Promise(r=>setTimeout(r,500));await page.keyboard.up('ArrowRight');
        const stopped=await page.evaluate(()=>{document.querySelector('#remote-stop').click();return ErgoFlex.glidePosition;});
        await new Promise(r=>setTimeout(r,200));assert.deepEqual(await page.evaluate(()=>ErgoFlex.glidePosition),stopped,'STOP holds desk');
        await page.evaluate(()=>ErgoFlex.renderer.setAnimationLoop(null));
        for(const viewport of [{width:810,height:674},{width:674,height:810},{width:344,height:882}]){
            await page.setViewport(viewport);await page.waitForFunction(()=>document.querySelector('#motion-dock').dataset.mode==='docked'||innerWidth>760);await page.waitForFunction(()=>{const d=document.querySelector('#motion-dock'),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;},{timeout:15000});
            l=await layout();assert.equal(l.bodyScroll,l.bodyClient,'No internal clipping at '+viewport.width);
            assert.ok(l.cards[0].x<l.cards[1].x&&l.cards[1].x<l.cards[2].x,'Same wide layout');
            assert.ok(l.dock.x>=-1&&l.dock.right<=viewport.width+1,'Panel stays inside screen '+viewport.width+' '+JSON.stringify(l));
            await page.$eval('#motion-dock',e=>e.scrollIntoView({block:'center'}));
            const hit=await page.$eval('#remote-stop',e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;});assert.ok(hit,'STOP clickable at '+viewport.width);
            await page.screenshot({path:path.join(out,'fold-'+viewport.width+'.png')});
        }
        assert.deepEqual(errors,[]);console.log('Compact controller: legacy size migration, clipping, extras, collapse, theme, keyboard/STOP, and Fold widths passed.');
    }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
