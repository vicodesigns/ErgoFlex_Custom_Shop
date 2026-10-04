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
    const { normalizeLedEffect, sampleLedEffect } = await import('../led-effects.mjs');
    const effect = normalizeLedEffect({mode:'breathe',period:8});
    assert.equal(sampleLedEffect(effect,0).gain,1);
    assert.equal(sampleLedEffect(effect,4).gain,.25);
    assert.equal(sampleLedEffect(effect,8).gain,1);
    assert.equal(sampleLedEffect(effect,3,false).gain,0);
    assert.deepEqual(sampleLedEffect({mode:'spectrum',period:8},3,true,true),{gain:1,hue:null});
    assert.deepEqual(normalizeLedEffect(null),{mode:'solid',period:8});
    assert.deepEqual(normalizeLedEffect({mode:'unknown',period:0}),{mode:'solid',period:4});
    for (let i=0;i<1000;i++) assert.ok(sampleLedEffect(effect,i/30).gain<=1);
    await new Promise(r => server.listen(0,'127.0.0.1',r));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try {
        const page=await browser.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.setViewport({width:1366,height:1000});
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`);
        await page.waitForFunction(()=>window.ErgoFlex?.ledCount===43 && document.querySelector('.demo-led-effects select'),{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.setLedsEnabled(true);});
        await page.select('.demo-led-effects select','breathe');
        const snap=()=>page.evaluate(()=>{
            const materials=new Map();
            ErgoFlex.loadedModel.traverse(o=>{if(o.isMesh && /^Desktop LEDs 1$/.test(o.parent?.name)) materials.set(o.material.uuid,o.material);});
            const material=[...materials.values()][0];
            let spill;
            ErgoFlex.loadedModel.traverse(o=>{if(o.name==='Foot LED floor glow') spill=o.material;});
            return {intensity:material.emissiveIntensity,color:material.emissive.toArray(),spill:spill.uniforms.strength.value,
                spillColor:spill.uniforms.ledColor.value.toArray(),base:ErgoFlex.ledColor,glow:ErgoFlex.ledGlow,effect:ErgoFlex.ledEffect};
        });
        const before=await snap();
        await new Promise(r=>setTimeout(r,2000));
        const after=await snap();
        assert.ok(Math.abs(after.intensity-before.intensity)>.1,'strip emission animates');
        assert.ok(Math.abs(after.spill-before.spill)>.01,'floor spill animates with strip');
        assert.equal(after.base,before.base,'animated frame does not overwrite selected color');
        assert.equal(after.glow,before.glow,'animated frame does not overwrite brightness');
        const saved=await page.evaluate(()=>ErgoFlex.serializeProject().presentation.ledEffect);
        assert.deepEqual(saved,{mode:'breathe',period:8},'project retains parameters');
        await page.select('.demo-led-effects select','spectrum');
        await new Promise(r=>setTimeout(r,900));
        const cycle=await snap();
        assert.deepEqual(cycle.color,cycle.spillColor,'strip and spill use the same animated color');
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
        await new Promise(r=>setTimeout(r,300));
        const reduced=await snap();
        assert.equal(reduced.intensity,3.6*reduced.glow/100,'reduced motion holds full selected brightness');
        assert.deepEqual(reduced.color,before.color,'reduced motion restores the chosen base color');
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(false));
        const off=await snap();
        assert.equal(off.intensity,0);assert.equal(off.spill,0);
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        await page.select('.demo-led-effects select','solid');
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(true));
        const solid=await snap();
        assert.equal(solid.intensity,3.6*solid.glow/100);
        assert.deepEqual(errors,[],'no browser exceptions');
        await page.screenshot({path:'/tmp/ef-led-effects-preview.png'});
        console.log('LED effects passed: shared strip/spill animation, base setting preservation, saved parameters, reduced motion, master off and solid restoration.');
    } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
