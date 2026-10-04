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
    const {LED_STRIPS,createLedFrame,sampleLedDiagnostic,validateStripMap}=await import('../led-strip-map.mjs');
    assert.equal(LED_STRIPS.reduce((n,s)=>n+s.count,0),106);
    const frame=createLedFrame();
    sampleLedDiagnostic(frame,LED_STRIPS,{strip:2,pixel:14});
    assert.equal(frame.flatMap(r=>[...r]).filter(v=>v>0).length,3,'exactly one RGB address on');
    assert.equal(frame[2][14*4],255);
    sampleLedDiagnostic(frame,LED_STRIPS,{strip:null,pixel:null});
    assert.ok(frame.every(row=>row.every(v=>v===0)));
    assert.throws(()=>validateStripMap(LED_STRIPS.map((s,i)=>({...s,id:i===1?0:s.id}))),/strip ID/);
    assert.throws(()=>validateStripMap(LED_STRIPS.map(s=>({...s,visibleAddresses:[s.count]}))),/address map/);
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
    try {
        const page=await browser.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        page.on('console',message=>{if(message.type()==='error' && !message.text().startsWith('Failed to load resource:'))errors.push(message.text());});
        page.on('response',response=>{if(response.status()>=400 && !response.url().endsWith('/favicon.ico'))errors.push(response.url()+': '+response.status());});
        await page.setViewport({width:1366,height:1139});
        await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html?ledDiagnostics=1`);
        await page.waitForFunction(()=>ErgoFlex?.ledPixelRenderer && document.querySelector('.demo-led-mapping select'),{timeout:120000});
        await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.6);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.setLedsEnabled(true);});
        await page.focus('.hub-led');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');
        await page.click('.demo-led-mapping summary');
        const result=await page.evaluate(()=>{
            const renderer=ErgoFlex.ledPixelRenderer;
            const allocated=renderer.texture.uuid,diagnostics=[];let checked=0;
            for(const spec of renderer.strips)for(let pixel=0;pixel<spec.count;pixel++){
                if(!ErgoFlex.setLedDiagnostic({strip:spec.id,pixel}))throw new Error('Address refused');
                let lit=0;for(let i=0;i<renderer.data.length;i+=4)if(renderer.data[i]||renderer.data[i+1]||renderer.data[i+2])lit++;
                if(lit!==1)throw new Error('Address did not light exactly one cluster');checked++;
            }
            for(let id=0;id<8;id++){
                ErgoFlex.setLedDiagnostic({strip:id,pixel:0});
                const row=renderer.strips.findIndex(s=>s.id===id);
                let lit=0;for(let i=0;i<renderer.data.length;i+=4)if(renderer.data[i]||renderer.data[i+1]||renderer.data[i+2])lit++;
                const slot=renderer.strips[row].reverse ? renderer.addressMaps[row].length-1 : 0;
                const offset=(row*renderer.width+slot)*4;
                diagnostics.push({id,lit,first:[...renderer.data.slice(offset,offset+4)]});
            }
            const ids=[...new Set(renderer.bindings.map(b=>b.stripId))].sort();
            const tagged=[];ErgoFlex.loadedModel.traverse(o=>{if(o.isMesh&&o.name.includes('reflection'))tagged.push(o.material.uniforms.efPixelActive===renderer.uniforms.efPixelActive);});
            return {diagnostics,checked,ids,tagged,allocated,now:renderer.texture.uuid,valid:ErgoFlex.setLedDiagnostic({strip:2,pixel:15}),project:ErgoFlex.serializeProject().presentation};
        });
        assert.deepEqual(result.ids,[0,1,2,3,4,5,6,7]);
        assert.equal(result.checked,106);
        assert.ok(result.diagnostics.every(d=>d.lit===1 && d.first.join(',')==='255,255,255,255'));
        assert.equal(result.allocated,result.now,'diagnostic changes reuse atlas');
        assert.equal(result.valid,false,'invalid address refused');
        assert.ok(result.tagged.length>10 && result.tagged.every(Boolean),'all reflection fields share pixel controls');
        assert.ok(!('ledDiagnostic' in result.project),'diagnostics are ephemeral');
        await page.evaluate(()=>{ErgoFlex.setLedDiagnostic({strip:3,pixel:6});ErgoFlex.setLedColor('#497bff',false);ErgoFlex.setLedEffect({mode:'breathe',period:8},false);});
        await new Promise(r=>setTimeout(r,600));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledPixelRenderer.active),true);
        await page.screenshot({path:'/tmp/ef-led-pixels-standard.png'});
        await page.select('#size-select','48x30');
        await page.evaluate(()=>document.querySelector('#size-select').dispatchEvent(new Event('change',{bubbles:true})));
        await new Promise(r=>setTimeout(r,300));
        await page.select('#size-select','60x30');
        await page.evaluate(()=>document.querySelector('#size-select').dispatchEvent(new Event('change',{bubbles:true})));
        await new Promise(r=>setTimeout(r,300));
        const wide=await page.evaluate(()=>{
            const r=ErgoFlex.ledPixelRenderer;
            return r.bindings.filter(b=>b.part.name.startsWith('Extended desktop')).map(b=>b.stripId).sort();
        });
        assert.deepEqual(wide,[4,5,6]);
        await page.evaluate(()=>ErgoFlex.setLedsEnabled(false));
        assert.equal(await page.evaluate(()=>ErgoFlex.ledPixelRenderer.active),false);
        await page.evaluate(()=>{ErgoFlex.setLedsEnabled(true);ErgoFlex.setLedDiagnostic();});
        const restored=await page.evaluate(()=>({active:ErgoFlex.ledPixelRenderer.active,color:ErgoFlex.ledColor,effect:ErgoFlex.ledEffect.mode}));
        assert.deepEqual(restored,{active:false,color:'#497bff',effect:'breathe'});
        // Exercise custom count, reverse, RGBW white mixing and sacrificial masking.
        const custom=await page.evaluate(async()=>{
            const {LedPixelRenderer}=await import('./led-pixel-renderer.mjs');
            const {LED_STRIPS,createLedFrame}=await import('./led-strip-map.mjs');
            const map=LED_STRIPS.map(s=>({...s,count:4,visibleAddresses:[1,2],reverse:s.id===0}));
            const frame=createLedFrame(map);frame[0].set([10,20,30,40],4);frame[0].set([80,90,100,0],8);
            const r=new LedPixelRenderer(map);r.upload(frame);const pixels=[...r.data.slice(0,8)];r.dispose();return pixels;
        });
        assert.deepEqual(custom,[80,90,100,255,50,60,70,255]);
        await new Promise(r=>setTimeout(r,200));
        assert.deepEqual(errors.filter(e=>!e.includes('favicon')),[],'no JS/shader/browser errors');
        console.log('Pixel renderer passed: eight strip IDs, all 106 addresses, per-address texture, localized spill bindings, Standard/Wide reuse, RGBW mixing, masks/reversal, master off and base restoration.');
    }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
