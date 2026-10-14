const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const reviewArg=process.argv.indexOf('--review-out');
const reviewOut=reviewArg<0?null:path.resolve(process.argv[reviewArg+1]);
const onlyArg=process.argv.indexOf('--only');
const only=onlyArg<0?null:process.argv[onlyArg+1].split(',');
if(reviewOut)fs.mkdirSync(reviewOut,{recursive:true});
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        if(reviewOut) await page.exposeFunction('saveDeskStyleView',({id,phase,png})=>
            fs.writeFileSync(path.join(reviewOut,`${id}-${phase}-desktop.png`),Buffer.from(png,'base64')));
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({width:1280,height:900});
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=product`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.35);});
        await page.waitForFunction(()=>ErgoFlex.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        const result = await page.evaluate(async only => {
            const {ROOM_DESK_STYLES,cleanDeskStyle} = await import('./room-desk-styles.mjs?v=hbhs-classroom-20261013');
            const THREE=await import('three');
            const ef=ErgoFlex, failures=[], phases=['morning','afternoon','evening','night','party'];
            const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
            const ctx=canvas.getContext('2d');ctx.fillStyle='#cc8945';ctx.fillRect(0,0,8,8);
            ef.surfaceArtwork.setState({version:1,surfaces:{desktop:{logo:{name:'Test graphic',image:canvas.toDataURL('image/png')}}}});
            ef.surfaceArtwork.commit();
            const original=JSON.stringify(ef.currentConfig), artwork=JSON.stringify(ef.currentConfig.artwork);
            for (const [id,style] of Object.entries(ROOM_DESK_STYLES)) {
                if(only && !only.includes(id))continue;
                if (!cleanDeskStyle(style)) failures.push(id+': catalog palette invalid');
                ef.setRoomScene(id,false);await ef.workspaceRoom.ready;
                for(const key of ['woodFinish','baseFinish','trimColor']) if(ef.currentConfig[key]!==style[key]) failures.push(id+': wrong '+key);
                if(JSON.stringify(ef.currentConfig.artwork)!==artwork) failures.push(id+': artwork overwritten');
                const kit=ef.workspaceAccessories.dressAssets().find(o=>o.userData.dayKit);
                if (!kit || kit.children.length!==5) {failures.push(id+': missing activity kit');continue;}
                if(kit.userData.authoredDesktopOverlap>0) failures.push(id+': daily kit overlaps desk tools ('+kit.userData.authoredDesktopOverlap+')');
                const notebooks=ef.workspaceAccessories.dressAssets().filter(o=>o.userData.propId==='journal');
                if(notebooks.some(o=>!o.userData.authoredDeskNotebook)) failures.push(id+': ornate stock journal retained');
                const pose=kit.matrix.toArray().join(',');
                for(const [n,phase] of phases.entries()) {
                    ef.setMeasuredRoomMode(id,phase,false);
                    if(kit.children.filter(o=>o.visible).length!==1 || !kit.children[n].visible) failures.push(id+': wrong activity '+phase);
                    if(ef.currentConfig.woodFinish!==style.woodFinish) failures.push(id+': time repaints finish');
                    ef.workspaceAccessories.update();
                    if(kit.matrix.toArray().join(',')!==pose) failures.push(id+': time moves daily-kit mount');
                    if(window.saveDeskStyleView && [1,3].includes(n)) {
                        ef.setLedMotionEnabled(false);
                        const {camera,controls,scene}=ef.roomInteractions;
                        ef.renderer.render(scene,camera); // Initialise transform-following overlays.
                        const center=new THREE.Box3().setFromObject(kit).getCenter(new THREE.Vector3());
                        camera.position.copy(center).add(new THREE.Vector3(.32,.42,.35));
                        camera.lookAt(center);controls.target.copy(center);
                        ef.workspaceRoom.update(camera);ef.renderer.render(scene,camera);
                        await window.saveDeskStyleView({id,phase,png:ef.renderer.domElement.toDataURL('image/png').split(',')[1]});
                    }
                }
                const stationStyles=ef.workspaceRoom.assets().filter(o=>o.userData.officeStation).map(o=>o.userData.deskStyle);
                if(stationStyles.some(s=>!cleanDeskStyle(s))) failures.push(id+': invalid support station style');
            }
            ef.setRoomScene('product',false);await ef.workspaceRoom.ready;
            // Sizes use room defaults; the product finish remains the saved product design.
            for(const key of ['woodFinish','baseFinish','trimColor']) if(ef.currentConfig[key]!==JSON.parse(original)[key]) failures.push('product '+key+' changed');
            ef.setRoomScene('university',false);await ef.workspaceRoom.ready;
            document.querySelector('#wood-finishes [data-finish="Bordeaux"]').click();
            document.querySelector('[data-trim-color="#f5f5f2"]').click();
            const custom=JSON.stringify(cleanDeskStyle({...ef.currentConfig,sheen:'satin'}));
            ef.setRoomScene('hospital',false);await ef.workspaceRoom.ready;
            ef.setRoomScene('university',false);await ef.workspaceRoom.ready;
            if(JSON.stringify(cleanDeskStyle({...ef.currentConfig,sheen:'satin'}))!==custom) failures.push('custom finish lost on room switch');
            const project=ef.serializeProject();
            const paletteButton=document.querySelector('#room-desk-palette');
            if(paletteButton.hidden || paletteButton.textContent!=='Use scene palette') failures.push('custom palette reset control missing');
            paletteButton.click();await ef.workspaceRoom.ready;
            const imported=ef.applyProject(project);await ef.workspaceRoom.ready;
            if(!imported.ok || JSON.stringify(cleanDeskStyle({...ef.currentConfig,sheen:'satin'}))!==custom) failures.push('project finish lost');
            delete project.presentation.sceneDeskStyles;
            ef.resetSceneDeskStyle();await ef.workspaceRoom.ready;
            const legacy=ef.applyProject(project);await ef.workspaceRoom.ready;
            if(!legacy.ok || ef.currentConfig.woodFinish!=='Bordeaux') failures.push('older project finish overwritten');
            ef.resetSceneDeskStyle();await ef.workspaceRoom.ready;
            if(ef.currentConfig.woodFinish!=='Earthy Forest Green') failures.push('scene palette reset failed');
            return {count:Object.keys(ROOM_DESK_STYLES).filter(id=>!only || only.includes(id)).length,failures};
        },only);
        await page.evaluate(async()=>{
            document.querySelector('#wood-finishes [data-finish="Bordeaux"]').click();
            ErgoFlex.setRoomScene('university',true);await ErgoFlex.workspaceRoom.ready;
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=university`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.35);});
        await page.waitForFunction(()=>ErgoFlex.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        await page.evaluate(async()=>await ErgoFlex.workspaceRoom.ready);
        assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.woodFinish),'Bordeaux','Browser reload keeps the custom room finish');
        // An explicit shared build must beat this browser's older room override.
        const shared=await page.evaluate(()=>({...ErgoFlex.currentConfig,woodFinish:'Warm Ivory',baseFinish:'White',trimColor:'#f5f5f2'}));
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=university&build=${encodeURIComponent(JSON.stringify(shared))}`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setAnimationLoop(null);ErgoFlex.renderer.setPixelRatio(.35);});
        await page.waitForFunction(()=>ErgoFlex.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        await page.evaluate(async()=>await ErgoFlex.workspaceRoom.ready);
        assert.deepEqual(await page.evaluate(()=>['woodFinish','baseFinish','trimColor'].map(k=>ErgoFlex.currentConfig[k])),
            ['Warm Ivory','White','#f5f5f2'],'Shared build takes precedence over the older room palette');
        assert.deepEqual(errors,[],'No page errors');
        assert.deepEqual(result.failures,[],'Scene finishes, activities and persistence');
        console.log(`${result.count} catalog palettes × five activities, station styles, uploaded artwork preservation, room switch, product return, project restoration, reset, reload and shared-build precedence passed.`);
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
