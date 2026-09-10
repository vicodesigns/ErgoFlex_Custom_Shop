const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
       '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
       '.glb': 'model/gltf-binary' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
    await page.setViewport({ width: 1440, height: 1000 });
    const url = `http://127.0.0.1:${server.address().port}/`;
    // Modules are refused unless the server sends a JavaScript MIME type, and the
    // failure is a silent blank viewer rather than an assertion, so check it first.
    for (const module of ['studio.js', 'catalog.mjs']) {
      const type = await new Promise((resolve, reject) => require('node:http')
        .get(url + module, r => resolve(`${r.statusCode} ${r.headers['content-type']}`)).on('error', reject));
      assert.equal(type, '200 text/javascript', `${module} is served as JavaScript`);
    }
    await page.goto(url + '?setup');
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).display === 'none');
    assert.equal(await page.evaluate(() => ErgoFlex.actuatorRigs.length), 2);
    console.log('Loaded model and rigs.');
    await page.screenshot({ path: '/tmp/ergoflex-studio.png' });
    // Exercise mechanics cheaply under software WebGL after the full-quality visual check.
    await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(0.6); ErgoFlex.renderer.shadowMap.enabled = false; });
    const liftCount = await page.evaluate(() => ErgoFlex.liftObjects.length);
    assert.ok(liftCount > 0, 'Production lift membership survives cleared selection');
    await page.evaluate(() => { ErgoFlex.selectByNames([ErgoFlex.liftObjects[0].obj.name]); document.getElementById('clear-parts-btn').click(); ErgoFlex.setHeight(40); });
    assert.equal(await page.evaluate(() => ErgoFlex.liftObjects.length), liftCount);
    assert.ok(await page.evaluate(() => ErgoFlex.liftObjects.every(item => Math.abs(item.obj.position.y - item.baseY - (ErgoFlex.liftObjects[0].obj.position.y - ErgoFlex.liftObjects[0].baseY)) < 0.001)), 'All unrigged lift parts track height after deselection');
    await page.evaluate(() => ErgoFlex.setHeight(28));
    await page.evaluate(() => ErgoFlex.selectByNames([ErgoFlex.liftObjects[0].obj.name]));
    await page.click('#isolate-parts');
    assert.ok(await page.evaluate(() => [...ErgoFlex.partRegistry.values()].some(({obj}) => !obj.visible)), 'Isolation hides other parts');
    await page.click('#show-all-parts');
    await page.select('#transform-space', 'local');
    await page.click('#transform-snap');
    assert.equal(await page.evaluate(() => ErgoFlex.transformControl.space), 'local');
    assert.equal(await page.evaluate(() => ErgoFlex.transformControl.translationSnap), 0.05);
    await page.evaluate(() => { document.getElementById('clear-parts-btn').click(); document.querySelector('[name=transform_mode][value=none]').click(); });
    await page.click('#selection-mode-toggle');
    const canvasBox = await page.$eval('#model-canvas', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await page.keyboard.down('Shift');
    await page.mouse.move(canvasBox.x + 15, canvasBox.y + 15);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 95, canvasBox.y + 95);
    const marquee = await page.$eval('#marquee-box', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; });
    assert.ok(Math.abs(marquee.x - canvasBox.x - 15) < 2 && Math.abs(marquee.y - canvasBox.y - 15) < 2, 'Box-selection overlay follows the inset canvas');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#marquee-box', el => el.classList.contains('hidden')), true, 'Escape cancels the active drag before pointer release');
    await page.mouse.up();
    await page.keyboard.up('Shift');
    assert.equal(await page.$eval('#marquee-box', el => el.classList.contains('hidden')), true);
    await page.click('#selection-mode-toggle');
    await page.evaluate(() => ErgoFlex.selectByNames([ErgoFlex.liftObjects[0].obj.name]));
    const cloneState = await page.evaluate(() => ({ size: ErgoFlex.partRegistry.size, selected: ErgoFlex.movingObjects.length }));
    await page.$eval('#clone-parts-btn', el => el.click());
    assert.equal(await page.evaluate(() => ErgoFlex.partRegistry.size), cloneState.size + cloneState.selected);
    await page.evaluate(() => ErgoFlex.undo());
    assert.equal(await page.evaluate(() => ErgoFlex.partRegistry.size), cloneState.size);
    await page.evaluate(() => document.getElementById('clear-parts-btn').click());
    console.log('Editor selection, lift independence, isolation, snapping, box selection, and clone undo passed.');
    if (process.argv.includes('--editor-only')) { assert.deepEqual(errors, []); return; }
    await page.click('[data-motion-tab="glide"]');
    const before = await page.evaluate(() => ErgoFlex.wheelRigs.map(r => r.spin));
    await page.evaluate(() => ErgoFlex.setGlidePosition(0.15, 0.15));
    await page.waitForFunction(() => ErgoFlex.glidePosition.x > .14 && ErgoFlex.glidePosition.z > .14);
    const after = await page.evaluate(() => ErgoFlex.wheelRigs.map(r => r.spin));
    assert.notEqual(after[0], before[0]);
    assert.ok(Math.abs(after[1] - before[1]) < .001, 'Diagonal wheel pairing');
    console.log('Diagonal motion passed.');
    await page.click('#glide-home');
    await page.waitForFunction(() => Math.abs(ErgoFlex.glidePosition.x) < .005 && Math.abs(ErgoFlex.glidePosition.z) < .005);
    await page.focus('#glide-pad');
    await page.keyboard.down('ArrowRight');
    await new Promise(resolve => setTimeout(resolve, 700));
    await page.keyboard.up('ArrowRight');
    const released = await page.evaluate(() => ErgoFlex.glidePosition);
    assert.ok(Math.hypot(released.x, released.z) > .02, 'Keyboard moves the desk');
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.deepEqual(await page.evaluate(() => ErgoFlex.glidePosition), released, 'Release stops motion');
    console.log('Keyboard release passed.');
    await page.evaluate(() => ErgoFlex.setGlidePosition(20, -20));
    await page.evaluate(() => document.querySelector('#glide-speed').value = '0.85');
    await page.evaluate(() => document.querySelector('#glide-speed').dispatchEvent(new Event('change')));
    await page.waitForFunction(() => ErgoFlex.glidePosition.x > .99 && ErgoFlex.glidePosition.z < -.99, { timeout: 45000 });
    assert.ok(await page.evaluate(() => ErgoFlex.glidePosition.x <= 1 && ErgoFlex.glidePosition.z >= -1));
    await page.evaluate(() => ErgoFlex.stopGlide());
    await page.click('#glide-demo');
    await page.waitForFunction(() => ErgoFlex.glideActive);
    await page.click('#glide-demo');
    assert.equal(await page.evaluate(() => ErgoFlex.glideActive), false);
    await page.evaluate(() => { ErgoFlex.setHeight(48); ErgoFlex.setTilt(ErgoFlex.tiltConfigs[0].name, -10); });
    assert.equal(await page.$eval('#desk-height-slider', el => el.value), '48');
    assert.equal(await page.evaluate(() => ErgoFlex.tiltConfigs[0].currentDeg), -10);
    await page.screenshot({ path: '/tmp/ergoflex-glide.png' });
    console.log('Movement tests passed.');
    await page.click('[data-sidebar-tab="finishes"]');
    await page.click('[data-look="Walnut|Forest"]');
    assert.equal(await page.evaluate(() => ErgoFlex.currentConfig.woodFinish), 'Walnut');
    assert.equal(await page.$eval('#total-price', el => el.textContent), '$1,449');
    await page.select('#size-select', '60x30');
    assert.equal(await page.$eval('#total-price', el => el.textContent), '$1,649');
    await page.click('#save-build');
    await page.click('#add-to-cart');
    assert.equal(await page.$eval('#cart-count', el => el.textContent), '1');
    await page.$eval('.cart-row input', el => { el.value = '2'; el.dispatchEvent(new Event('change')); });
    assert.equal(await page.$eval('#cart-count', el => el.textContent), '2');
    assert.match(await page.$eval('.cart-total', el => el.textContent), /3,298/);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#cart-modal', el => el.classList.contains('hidden')), true);
    await page.click('#setup-exit-btn');
    assert.equal(await page.evaluate(() => document.body.classList.contains('setup-layout')), false);
    await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(1); ErgoFlex.renderer.shadowMap.enabled = true; });
    await page.screenshot({ path: '/tmp/ergoflex-store.png', fullPage: true });
    console.log('Store pricing and build list passed.');
    await page.goto(url);
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    assert.equal(await page.evaluate(() => ErgoFlex.currentConfig.woodFinish), 'Walnut');
    assert.equal(await page.$eval('#cart-count', el => el.textContent), '2');
    console.log('Persistence passed.');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url + '?setup');
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    await page.click('[data-motion-tab="glide"]');
    await page.screenshot({ path: '/tmp/ergoflex-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile horizontal overflow');
    assert.deepEqual(errors, [], 'No uncaught browser exceptions');
    console.log('PASS: rigs, glide, wheel pairing, bounds, keyboard stop, demo, lift, tilt, finishes, pricing, cart, persistence, mobile layout.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
