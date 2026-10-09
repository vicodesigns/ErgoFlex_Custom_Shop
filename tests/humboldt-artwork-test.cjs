const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
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
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    const temp = fs.mkdtempSync(require('node:os').tmpdir() + '/ergoflex-artwork-');
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: 1450, height: 1100 });
        const url = `http://127.0.0.1:${server.address().port}/?view=product`;
        const ready = async () => {
            await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && ErgoFlex.surfaceArtwork?.bindings.size === 21 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
            await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.6); ErgoFlex.renderer.shadowMap.enabled = false; });
        };
        await page.goto(url, { timeout: 120000 }); await ready();

        await page.evaluate(()=>{ErgoFlex.renderer.setAnimationLoop(null);document.querySelector('#premium-artwork').open=true;});
        assert.equal(await page.$$eval('[data-art-sample]',els=>els.length),3);
        await page.$eval('[data-art-sample="humboldt-wordmark-green"]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.currentConfig.artwork?.surfaces.desktop?.logo?.name==='Cal Poly Humboldt wordmark · green');
        await page.select('[data-art-surface]','upper-shelf');
        await page.$eval('[data-art-sample="humboldt-wordmark"]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.currentConfig.artwork?.surfaces['upper-shelf']?.logo?.name==='Cal Poly Humboldt wordmark');
        await page.select('[data-art-surface]','right-panel');
        await page.$eval('[data-art-sample="humboldt-seal"]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.currentConfig.artwork?.surfaces['right-panel']?.logo?.name==='Cal Poly Humboldt seal');
        await page.$eval('[data-art-sample-look]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.currentConfig.artwork?.surfaces.desktop?.logo?.name==='Cal Poly Humboldt wordmark');
        const state=await page.evaluate(()=>({config:ErgoFlex.currentConfig,trim:ErgoFlex.currentConfig.trimColor,art:ErgoFlex.currentConfig.artwork}));
        assert.equal(state.config.woodFinish,'Forest Green');assert.equal(state.config.baseFinish,'Black');
        assert.equal(state.trim,'#f19c00');
        assert.ok(state.art.surfaces['upper-shelf'].logo,'Other surface is retained');
        for(const id of ['left-panel','right-panel'])assert.equal(state.art.surfaces[id].logo.name,'Cal Poly Humboldt seal');
        assert.ok(state.art.surfaces.desktop.logo.image.startsWith('data:image/webp;'));
        await page.waitForFunction(()=>['desktop','left-panel','right-panel','upper-shelf'].every(id=>ErgoFlex.surfaceArtwork.bindings.get(id)?.layers.get('logo')?.mesh.visible));
        // Add a seal beside the wordmark on the large desktop, without replacing it.
        await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '60x30')); s.value = '60x30'; s.dispatchEvent(new Event('change')); });
        await page.waitForFunction(()=>ErgoFlex.surfaceArtwork.bindings.get('desktop')?.obj.name==='Extended desktop');
        await page.$eval('[data-art-sample="humboldt-seal"]',e=>e.click());
        await page.waitForFunction(()=>ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo-2')?.mesh.visible);
        assert.equal(await page.$eval('[data-art-image]',e=>e.value),'logo-2');
        await page.evaluate(()=>{
            for(const [key,value] of [['x',23],['y',48],['scale',20]]){
                const e=document.querySelector(`[data-art-field="${key}"]`);e.value=value;e.dispatchEvent(new Event('input'));
            }
        });
        await page.select('[data-art-image]','logo');
        await page.evaluate(()=>{
            for(const [key,value] of [['x',68],['y',55],['scale',50]]){
                const e=document.querySelector(`[data-art-field="${key}"]`);e.value=value;e.dispatchEvent(new Event('input'));
            }
        });
        const project=await page.evaluate(()=>ErgoFlex.serializeProject());
        assert.equal(project.customerConfig.artwork.surfaces.desktop['logo-2'].name,'Cal Poly Humboldt seal');
        assert.equal(project.customerConfig.artwork.surfaces.desktop['logo-2'].x,23,'editing wordmark preserves seal placement');
        assert.equal(project.customerConfig.artwork.surfaces.desktop.logo.x,68);
        await page.waitForFunction(()=>document.querySelector('[data-art-status]').textContent.includes('saved in this browser'));
        await page.reload({timeout:120000});await ready();
        await page.waitForFunction(()=>ErgoFlex.currentConfig.artwork?.surfaces.desktop.logo.x===68 && ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo-2')?.mesh.visible);
        assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.artwork.surfaces.desktop['logo-2'].x),23,'additional image survives automatic restore');
        // Removing and restoring an extra graphic does not remove the first graphic.
        await page.select('[data-art-image]','logo-2');
        await page.$eval('[data-art-remove]',e=>e.click());
        await page.waitForFunction(()=>!ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.has('logo-2'));
        assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.artwork.surfaces.desktop.logo.x),68);
        const restored=await page.evaluate(project=>ErgoFlex.applyProject(project),project);assert.ok(restored.ok);
        await page.waitForFunction(()=>ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo-2')?.mesh.visible);
        // Batch upload adds two independent graphics instead of overwriting the selection.
        await (await page.$('[data-art-upload]')).uploadFile(path.join(root,'assets/artwork/cal-poly-humboldt-wordmark.png'),path.join(root,'assets/artwork/cal-poly-humboldt-wordmark-green.png'));
        await page.waitForFunction(()=>ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.get('logo-4')?.mesh.visible);
        assert.equal(await page.evaluate(()=>Object.keys(ErgoFlex.currentConfig.artwork.surfaces.desktop).length),4);
        // Return to the two-image composition for review.
        await page.evaluate(project=>ErgoFlex.applyProject(project),project);
        await page.waitForFunction(()=>!ErgoFlex.surfaceArtwork.bindings.get('desktop').layers.has('logo-4'));
        await page.evaluate(()=>{ErgoFlex.renderer.setAnimationLoop(null);document.querySelector('#premium-artwork').open=true;});
        const out=path.join(root,'scene-shots/humboldt-artwork-20261008');fs.mkdirSync(out,{recursive:true});
        await page.$eval('#premium-artwork',e=>e.scrollIntoView({block:'start'}));
        await (await page.$('.artwork-samples')).screenshot({path:path.join(out,'samples.png')});
        await page.setViewport({width:390,height:844});
        await page.$eval('#premium-artwork',e=>e.scrollIntoView({block:'start'}));
        assert.ok(await page.$eval('.artwork-samples',e=>e.scrollWidth<=e.clientWidth+1));
        await page.screenshot({path:path.join(out,'mobile.png')});
        await page.evaluate(()=>{const dock=document.querySelector('#motion-dock');if(!dock.classList.contains('collapsed'))document.querySelector('#motion-dock-toggle').click();});
        assert.ok(await page.$eval('#motion-dock-toggle',e=>getComputedStyle(e,'::after').content.includes('Expand controls')));
        await page.$eval('#motion-dock-toggle',e=>e.click());
        assert.ok(await page.$eval('#motion-dock',e=>!e.classList.contains('collapsed')));
        assert.deepEqual(errors,[]);
        console.log('PASS: white/green samples, large desktop wordmark + seal, independent placement/removal, multiple-file upload, project restore, autosave/reload and mobile editor.');
    } finally { await browser.close(); server.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
