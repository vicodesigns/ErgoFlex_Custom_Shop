// Measures the loaded GLB and prints a JSON report: overall dimensions in
// inches, per-family mesh counts, desktop and shelf extents, vertex counts, and
// how each assembly is spread along X and Z.
//
// Written for the sizing feasibility gate, and kept because every later question
// about "how big is this actually" should be answered by measuring rather than
// assuming. Run it with:  node tools/measure-asset.cjs
//
// It boots its own static server and loads the live remote model, so it needs
// network access. Findings are recorded in docs/sizing-gate.md.
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg' })[path.extname(file)] || 'application/octet-stream');
    res.end(d);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/?setup`);
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    const report = await page.evaluate(() => {
      const T = window.THREE_FOR_MEASURE;
      const model = ErgoFlex.loadedModel;
      model.updateMatrixWorld(true);
      // inches per world unit, from the lift calibration the app already trusts
      const inPerWorld = (52.5 - 28.0) / ((6.53 - (-19.25)) * model.scale.x);
      const box = o => { const b = new (o.geometry.boundingBox.constructor)(); return b; };
      const groups = {};
      const meshes = [];
      ErgoFlex.partRegistry.forEach(e => {
        const o = e.obj;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        // world-space bbox
        const min = bb.min.clone().applyMatrix4(o.matrixWorld);
        const max = bb.max.clone().applyMatrix4(o.matrixWorld);
        const lo = { x: Math.min(min.x,max.x), y: Math.min(min.y,max.y), z: Math.min(min.z,max.z) };
        const hi = { x: Math.max(min.x,max.x), y: Math.max(min.y,max.y), z: Math.max(min.z,max.z) };
        const family = e.name.replace(/_\d+$/, '');
        meshes.push({ name: e.name, family, verts: o.geometry.attributes.position.count,
          lo, hi, cx: (lo.x+hi.x)/2, cz: (lo.z+hi.z)/2 });
        groups[family] = (groups[family] || 0) + 1;
      });
      const modelBox = { x0: Math.min(...meshes.map(m=>m.lo.x)), x1: Math.max(...meshes.map(m=>m.hi.x)),
                         y0: Math.min(...meshes.map(m=>m.lo.y)), y1: Math.max(...meshes.map(m=>m.hi.y)),
                         z0: Math.min(...meshes.map(m=>m.lo.z)), z1: Math.max(...meshes.map(m=>m.hi.z)) };
      const desktops = meshes.filter(m => /^Desktop/.test(m.name));
      const shelves  = meshes.filter(m => /^Top_Shelf/.test(m.name));
      const wheels   = meshes.filter(m => /^Wheel_/.test(m.name));
      const columns  = meshes.filter(m => /^Lift_Column/.test(m.name));
      const actuators= meshes.filter(m => /^Linear_Actuators/.test(m.name));
      const hardware = meshes.filter(m => /^(Plates_Hardware|Screws|Joinery)/.test(m.name));
      const cxCentre = (modelBox.x0 + modelBox.x1) / 2;
      const czCentre = (modelBox.z0 + modelBox.z1) / 2;
      const hist = arr => { const h = {}; arr.forEach(m => { const k = Math.round((m.cx - cxCentre) * inPerWorld / 3) * 3; h[k] = (h[k]||0)+1; }); return h; };
      return {
        inPerWorld,
        totalMeshes: meshes.length,
        overallInches: { w: (modelBox.x1-modelBox.x0)*inPerWorld, d: (modelBox.z1-modelBox.z0)*inPerWorld, h: (modelBox.y1-modelBox.y0)*inPerWorld },
        families: Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,14),
        desktop: { count: desktops.length, verts: desktops.map(d=>d.verts),
                   inches: desktops.map(d => ({ name: d.name, w: (d.hi.x-d.lo.x)*inPerWorld, d: (d.hi.z-d.lo.z)*inPerWorld, t: (d.hi.y-d.lo.y)*inPerWorld })) },
        shelf: { count: shelves.length, inches: shelves.map(d => ({ name:d.name, w: (d.hi.x-d.lo.x)*inPerWorld, d: (d.hi.z-d.lo.z)*inPerWorld })) },
        wheelsX: wheels.map(w => +((w.cx - cxCentre)*inPerWorld).toFixed(1)),
        wheelsZ: wheels.map(w => +((w.cz - czCentre)*inPerWorld).toFixed(1)),
        columnsX: [...new Set(columns.map(c => +((c.cx - cxCentre)*inPerWorld).toFixed(1)))].sort((a,b)=>a-b),
        actuatorsX: [...new Set(actuators.map(c => +((c.cx - cxCentre)*inPerWorld).toFixed(1)))].sort((a,b)=>a-b),
        hardwareHistogramX: hist(hardware),
        spreadZ: {
          columns: [Math.min(...columns.map(c=>(c.cz-czCentre)*inPerWorld)), Math.max(...columns.map(c=>(c.cz-czCentre)*inPerWorld))].map(v=>+v.toFixed(1)),
          actuators: [Math.min(...actuators.map(c=>(c.cz-czCentre)*inPerWorld)), Math.max(...actuators.map(c=>(c.cz-czCentre)*inPerWorld))].map(v=>+v.toFixed(1)),
          wheels: [Math.min(...wheels.map(c=>(c.cz-czCentre)*inPerWorld)), Math.max(...wheels.map(c=>(c.cz-czCentre)*inPerWorld))].map(v=>+v.toFixed(1)),
          hardware: [Math.min(...hardware.map(c=>(c.cz-czCentre)*inPerWorld)), Math.max(...hardware.map(c=>(c.cz-czCentre)*inPerWorld))].map(v=>+v.toFixed(1))
        },
        spreadX: {
          columns: [Math.min(...columns.map(c=>(c.cx-cxCentre)*inPerWorld)), Math.max(...columns.map(c=>(c.cx-cxCentre)*inPerWorld))].map(v=>+v.toFixed(1)),
          wheels: [Math.min(...wheels.map(c=>(c.cx-cxCentre)*inPerWorld)), Math.max(...wheels.map(c=>(c.cx-cxCentre)*inPerWorld))].map(v=>+v.toFixed(1))
        },
        wheelClustersZ: [...new Set(wheels.map(w => Math.round((w.cz-czCentre)*inPerWorld/5)*5))].sort((a,b)=>a-b),
        hardwareCentreBand: hardware.filter(m => Math.abs((m.cx-cxCentre)*inPerWorld) < 3).length,
        hardwareTotal: hardware.length
      };
    });
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
