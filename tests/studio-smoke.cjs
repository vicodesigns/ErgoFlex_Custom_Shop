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

    // baseY regression. updateMovingObjectsPosition writes position.y = baseY +
    // liftOffset, and the drag commit used to leave baseY at its load-time value,
    // so a vertical edit to a lift member was silently overwritten by the next
    // height change. Edit, change height, and check the offset survived.
    const liftEdit = await page.evaluate(() => {
      ErgoFlex.setHeight(28);
      const obj = ErgoFlex.liftObjects[0].obj;
      obj.updateWorldMatrix(true, false);
      const before = [{ obj, before: obj.matrixWorld.clone() }];
      const baseline = ErgoFlex.canonicalTransform(obj).p.y;
      obj.position.y += 0.25;
      obj.updateMatrixWorld(true);
      ErgoFlex.commitTransform(before);
      const afterEdit = ErgoFlex.canonicalTransform(obj).p.y;
      ErgoFlex.setHeight(46);
      const raised = ErgoFlex.canonicalTransform(obj).p.y;
      ErgoFlex.setHeight(28);
      const lowered = ErgoFlex.canonicalTransform(obj).p.y;
      return { baseline, afterEdit, raised, lowered };
    });
    assert.ok(Math.abs(liftEdit.afterEdit - liftEdit.baseline - 0.25) < 1e-6, 'the edit applied');
    assert.ok(Math.abs(liftEdit.lowered - liftEdit.afterEdit) < 1e-6,
      'a vertical edit to a lift member survives a height round trip');
    assert.ok(liftEdit.raised > liftEdit.afterEdit + 0.1, 'the part still rides the lift after the edit');

    // Undo has to restore the canonical state, not just the world matrix, or the
    // stale baseY reappears one step into the past.
    const undone = await page.evaluate(() => {
      ErgoFlex.undo();
      const restored = ErgoFlex.canonicalTransform(ErgoFlex.liftObjects[0].obj).p.y;
      ErgoFlex.setHeight(46);
      ErgoFlex.setHeight(28);
      return { restored, settled: ErgoFlex.canonicalTransform(ErgoFlex.liftObjects[0].obj).p.y };
    });
    assert.ok(Math.abs(undone.restored - liftEdit.baseline) < 1e-6, 'undo restores the original position');
    assert.ok(Math.abs(undone.settled - undone.restored) < 1e-6, 'undo also restores the lift baseline');

    // withNeutralPose must put every motion source back, including on a throw.
    const neutral = await page.evaluate(() => {
      ErgoFlex.setHeight(44);
      ErgoFlex.setTilt('tilting', -20);
      ErgoFlex.setGlidePosition(0.3, -0.2);
      const before = { height: ErgoFlex.deskHeight, tilt: ErgoFlex.tiltConfigs[0].currentDeg, glide: ErgoFlex.glidePosition };
      let insideHeight = null, insideTilt = null;
      ErgoFlex.withNeutralPose(() => {
        insideHeight = ErgoFlex.deskHeight;
        insideTilt = ErgoFlex.tiltConfigs[0].currentDeg;
      });
      let threw = false;
      try { ErgoFlex.withNeutralPose(() => { throw new Error('boom'); }); } catch { threw = true; }
      return { before, insideHeight, insideTilt, threw,
               after: { height: ErgoFlex.deskHeight, tilt: ErgoFlex.tiltConfigs[0].currentDeg, glide: ErgoFlex.glidePosition } };
    });
    assert.ok(Math.abs(neutral.insideHeight - 28) < 0.01, 'neutral pose drops the lift to the 28in reference');
    assert.equal(neutral.insideTilt, 0, 'neutral pose zeroes tilt');
    assert.ok(Math.abs(neutral.after.height - neutral.before.height) < 0.01, 'height restored');
    assert.equal(neutral.after.tilt, neutral.before.tilt, 'tilt restored');
    assert.ok(Math.abs(neutral.after.glide.x - neutral.before.glide.x) < 1e-6
           && Math.abs(neutral.after.glide.z - neutral.before.glide.z) < 1e-6, 'glide restored');
    assert.equal(neutral.threw, true, 'the throw propagated');
    await page.evaluate(() => { ErgoFlex.setGlidePosition(0, 0); ErgoFlex.setTilt('tilting', 0); ErgoFlex.setHeight(28); });

    // --- project save / restore ---------------------------------------------
    assert.ok(await page.evaluate(() => typeof ErgoFlex.modelFingerprint === 'string' && ErgoFlex.modelFingerprint.length === 64),
      'the GLB was fetched and hashed, so projects can record which asset they were built against');

    // Edit, clone, assign to lift, then round trip through a saved project.
    const roundTrip = await page.evaluate(() => {
      ErgoFlex.setHeight(28);
      const obj = ErgoFlex.liftObjects[0].obj;
      obj.updateWorldMatrix(true, false);
      const snapshot = [{ obj, before: obj.matrixWorld.clone() }];
      obj.position.y += 0.3;
      obj.position.x += 0.15;
      obj.updateMatrixWorld(true);
      ErgoFlex.commitTransform(snapshot);

      ErgoFlex.selectByNames([obj.name]);
      document.getElementById('clone-parts-btn').click();
      document.getElementById('clear-parts-btn').click();

      // Save at a deliberately non-neutral pose: raised, tilted, and glided.
      ErgoFlex.setHeight(45);
      ErgoFlex.setTilt('tilting', -18);
      ErgoFlex.setGlidePosition(0.2, 0.1);
      const project = ErgoFlex.serializeProject();
      return {
        project,
        edited: ErgoFlex.canonicalTransform(obj).p,
        editorId: obj.userData.editorId,
        cloneCount: [...ErgoFlex.partRegistry.values()].filter(e => e.isClone).length,
        liftCount: ErgoFlex.liftObjects.length,
        savedHeight: project.motion.heightInches
      };
    });
    assert.equal(roundTrip.project.formatVersion, 1);
    assert.equal(roundTrip.cloneCount, 1, 'the clone exists before saving');
    assert.ok(roundTrip.project.parts.transforms.some(t => t.editorId === roundTrip.editorId),
      'the edit was recorded as a delta');
    assert.ok(Math.abs(roundTrip.savedHeight - 45) < 0.2, 'motion records the pose at save time');

    // The transform delta must be captured at the neutral pose, not at the
    // raised/tilted pose the desk happened to be in.
    const delta = roundTrip.project.parts.transforms.find(t => t.editorId === roundTrip.editorId).delta;
    assert.ok(Math.abs(delta.p.y - 0.3) < 1e-6 && Math.abs(delta.p.x - 0.15) < 1e-6,
      'the saved delta is the edit itself, with lift and tilt removed');

    // Now discard everything and import it back.
    const restored = await page.evaluate(project => {
      ErgoFlex.setHeight(28); ErgoFlex.setTilt('tilting', 0); ErgoFlex.setGlidePosition(0, 0);
      const outcome = ErgoFlex.applyProject(project);
      const entry = ErgoFlex.partRegistry.get(project.parts.transforms[0].editorId);
      return {
        outcome: { ok: outcome.ok, problems: outcome.problems.map(p => p.code) },
        position: ErgoFlex.canonicalTransform(entry.obj).p,
        cloneCount: [...ErgoFlex.partRegistry.values()].filter(e => e.isClone).length,
        liftCount: ErgoFlex.liftObjects.length,
        height: ErgoFlex.deskHeight,
        tilt: ErgoFlex.tiltConfigs[0].currentDeg,
        glide: ErgoFlex.glidePosition
      };
    }, roundTrip.project);
    assert.deepEqual(restored.outcome, { ok: true, problems: [] }, 'a project of the current model imports cleanly');
    assert.equal(restored.cloneCount, 1, 'the clone came back');
    assert.equal(restored.liftCount, roundTrip.liftCount, 'lift membership came back');
    assert.ok(Math.abs(restored.height - 45) < 0.2, 'motion is applied after the neutral-pose scope, not swallowed by it');
    assert.equal(restored.tilt, -18, 'tilt came back');
    assert.ok(Math.abs(restored.glide.x - 0.2) < 1e-6, 'glide came back');

    // Importing the same project again must not collide with its own clones.
    const twice = await page.evaluate(project => {
      const outcome = ErgoFlex.applyProject(project);
      return { ok: outcome.ok, codes: outcome.problems.map(p => p.code),
               cloneCount: [...ErgoFlex.partRegistry.values()].filter(e => e.isClone).length };
    }, roundTrip.project);
    assert.equal(twice.ok, true, 'the same project imports twice');
    assert.deepEqual(twice.codes, [], 'and reports nothing');
    assert.equal(twice.cloneCount, 1, 'without accumulating duplicate clones');

    // Failed imports must leave the scene exactly as it was.
    const failures = await page.evaluate(() => {
      const before = {
        clones: [...ErgoFlex.partRegistry.values()].filter(e => e.isClone).length,
        lift: ErgoFlex.liftObjects.length,
        tilts: ErgoFlex.tiltConfigs.length
      };
      const results = {};
      for (const [label, file] of [
        ['garbage', { nope: true }],
        ['version', { formatVersion: 99, model: { url: 'x' } }],
        ['model', { formatVersion: 1, model: { url: 'https://elsewhere.test/other.glb' }, parts: {} }]
      ]) {
        results[label] = ErgoFlex.applyProject(file).ok;
      }
      return { before, results, after: {
        clones: [...ErgoFlex.partRegistry.values()].filter(e => e.isClone).length,
        lift: ErgoFlex.liftObjects.length,
        tilts: ErgoFlex.tiltConfigs.length
      } };
    });
    assert.deepEqual(failures.results, { garbage: false, version: false, model: false }, 'bad files are refused');
    assert.deepEqual(failures.after, failures.before, 'a refused import changes nothing');

    // A deleted rig must stay deleted across a save and reload.
    const deletion = await page.evaluate(() => {
      const name = ErgoFlex.tiltConfigs[0].name;
      ErgoFlex.removeTiltConfig(0);
      const project = ErgoFlex.serializeProject();
      return { name, tombstones: project.deletedBaked.tilt, rigsAfter: ErgoFlex.tiltConfigs.length, project };
    });
    assert.equal(deletion.rigsAfter, 0, 'the rig was deleted');
    assert.ok(deletion.tombstones.includes(deletion.name), 'the deletion is recorded so a baked default cannot resurrect');
    const undeleted = await page.evaluate(() => { ErgoFlex.undo(); return ErgoFlex.tiltConfigs.length; });
    assert.equal(undeleted, 1, 'rig deletion is undoable');

    // Autosave must not claim a save that did not happen.
    const storage = await page.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('quota'); };
      const wrote = ErgoFlex.writeAutosave('test');
      Storage.prototype.setItem = real;
      return wrote;
    });
    assert.equal(storage, false, 'a failed storage write reports failure rather than success');

    await page.evaluate(() => { ErgoFlex.setGlidePosition(0, 0); ErgoFlex.setTilt('tilting', 0); ErgoFlex.setHeight(28); });
    console.log('Editor selection, lift independence, isolation, snapping, box selection, clone undo, baseY, neutral pose, and project round trip passed.');
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
