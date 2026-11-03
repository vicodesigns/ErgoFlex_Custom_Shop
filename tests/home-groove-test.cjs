// Isolated browser: validate authored home movement without changing saved user scenes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ergoflex-home-routes-20261022';
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
    const browser = await puppeteer.launch({headless:true, protocolTimeout:180000, args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
    try {
        const page=await browser.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.evaluateOnNewDocument(()=>Object.defineProperty(window,'devicePixelRatio',{get:()=>.4}));
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=home&view=room`,{waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForFunction(()=>window.ErgoFlex?.renderer,{timeout:120000});
        await page.evaluate(()=>ErgoFlex.renderer.setAnimationLoop(null));
        await page.waitForFunction(()=>ErgoFlex.wheelRigs.length===4&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        const report=[];
        for(const layout of ['apartment','house','spacious','premium','executive']) {
            const rows=await page.evaluate(async layout=>{
                const {segmentIsClear,poseIsClear}=await import('./room-groove.mjs');
                ErgoFlex.setHomeLayout(layout);await ErgoFlex.workspaceRoom.ready;
                const rows=[];
                for(const size of ['48x30','60x30']) {
                    const select=document.querySelector('#size-select');
                    select.value=size;select.dispatchEvent(new Event('change',{bubbles:true}));await ErgoFlex.workspaceRoom.ready;
                    for(const phase of ['morning','afternoon','evening','night','party']) {
                        await ErgoFlex.prepareGrooveMode('home',phase);
                        const s=ErgoFlex.grooveState,d=ErgoFlex.grooveRouting;
                        rows.push({layout,size,phase,ok:s.plan?.ok,safe:s.plan?.ok&&s.plan.route.slice(1).every((p,i)=>segmentIsClear(s.plan.route[i],p,d.bounds,d.obstacles,d.footprint)),message:s.message,start:d.start,desired:d.desired,footprint:d.footprint,colliders:d.obstacles.filter(o=>!poseIsClear(d.start,{minX:-1e8,maxX:1e8,minZ:-1e8,maxZ:1e8},[o],d.footprint)).map(o=>({name:o.name,...o}))});
                    }
                }
                return rows;
            },layout);
            report.push(...rows);console.log(layout,JSON.stringify(rows.filter(r=>!r.ok||!r.safe)));
        }
        fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));
        for(const r of report) assert.ok(r.ok&&r.safe,`${r.layout}/${r.size}/${r.phase}: ${r.message}`);
        assert.deepEqual(errors,[]);console.log('PASS: 50 Home Groove routes across five layouts, both widths and all activities.');
    } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
