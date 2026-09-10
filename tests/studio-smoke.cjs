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

    // --- presentation --------------------------------------------------------
    // Collapsing the dock must return its height to the canvas, since
    // syncViewerSize derives the bottom inset from the dock's offsetHeight.
    const dock = await page.evaluate(async () => {
      const canvas = document.getElementById('model-canvas');
      const settle = () => new Promise(r => setTimeout(r, 450));
      const before = canvas.getBoundingClientRect().height;
      document.getElementById('motion-dock-toggle').click();
      await settle();
      const collapsed = canvas.getBoundingClientRect().height;
      const persisted = localStorage.getItem('ergoflex.motionDockCollapsed');
      document.getElementById('motion-dock-toggle').click();
      await settle();
      return { before, collapsed, restored: canvas.getBoundingClientRect().height, persisted };
    });
    assert.ok(dock.collapsed > dock.before + 20, 'collapsing the movement dock gives the canvas its height back');
    assert.equal(dock.persisted, 'true', 'the collapse state is remembered');
    assert.ok(Math.abs(dock.restored - dock.before) < 2, 'expanding restores the original canvas height');

    // Each camera shortcut must frame its own assembly, and close-ups need the
    // orbit floor lowered or minDistance 2 clamps them to a mid shot.
    const shortcuts = {};
    for (const key of ['desktop', 'wheels', 'actuators', 'columns']) {
      shortcuts[key] = await page.evaluate(async k => {
        ErgoFlex.focusCameraShortcut(k);
        await new Promise(r => setTimeout(r, 600));
        const s = ErgoFlex.cameraState;
        const d = Math.hypot(s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]);
        return { target: s.target, distance: d, minDistance: s.minDistance };
      }, key);
    }
    assert.ok(shortcuts.wheels.minDistance < 1, 'a close-up lowers the orbit floor');
    assert.ok(shortcuts.wheels.distance < shortcuts.desktop.distance,
      'the wheels frame closer than the desktop');
    assert.ok(shortcuts.desktop.target[1] > shortcuts.wheels.target[1] + 0.2,
      'the desktop shortcut looks higher up than the wheels shortcut');
    const reset = await page.evaluate(async () => {
      document.getElementById('reset-view').click();
      await new Promise(r => setTimeout(r, 200));
      return ErgoFlex.cameraState.minDistance;
    });
    assert.equal(reset, 2, 'reset restores the default orbit floor');

    // Each shortcut must frame its OWN assembly. Found in the browser: all four
    // reported the same distance because the tween never advanced.
    assert.ok(shortcuts.wheels.target[1] < 0.4, 'the wheels shortcut looks at floor level');
    assert.ok(new Set(Object.values(shortcuts).map(s => s.distance.toFixed(2))).size >= 3,
      'the shortcuts frame at genuinely different distances');


    // --- materials -----------------------------------------------------------
    // Each wood surface gets its own material, so the desktop and the plywood
    // edge can differ. They used to share one instance.
    const roles = await page.evaluate(() => Object.keys(ErgoFlex.woodMaterials));
    assert.ok(roles.includes('desktop') && roles.includes('edge'),
      'the desktop and the plywood edge have separate materials');

    // Switching species must swap the map, not just the tint.
    const species = await page.evaluate(async () => {
      const pick = name => document.querySelector(`#wood-finishes [data-finish="${name}"]`).click();
      pick('Natural Birch');
      const birch = ErgoFlex.woodMaterials.desktop;
      pick('Walnut');
      const walnut = ErgoFlex.woodMaterials.desktop;
      pick('Bamboo');
      const bamboo = ErgoFlex.woodMaterials.desktop;
      return { birch, walnut, bamboo };
    });
    assert.ok(species.birch.mapId && species.walnut.mapId, 'both species have a texture');
    assert.notEqual(species.birch.mapId, species.walnut.mapId, 'walnut is a different map, not a tinted birch');
    assert.notEqual(species.walnut.mapId, species.bamboo.mapId, 'each species has its own map');
    // Bamboo's grain is much finer than walnut's, so it repeats more over the
    // same surface. That is the physical-scale table doing its job.
    assert.ok(species.bamboo.repeat[0] > species.walnut.repeat[0],
      'grain repeats are derived per species from repeats-per-inch');

    // Each material role gets its own treatment; they used to share one pair.
    const treatments = await page.evaluate(() => {
      ErgoFlex.setSurfaceFinish('gloss');
      return { wood: ErgoFlex.woodMaterials.desktop, frame: ErgoFlex.frameMaterial,
               metal: ErgoFlex.metalMaterial, plastic: ErgoFlex.plasticMaterial };
    });
    assert.ok(treatments.frame, 'the frame material exists');
    assert.notEqual(treatments.wood.roughness, treatments.frame.roughness,
      'powder coat does not take the wood roughness');
    assert.equal(treatments.metal.metalness, 1, 'brushed aluminium is fully metallic');
    assert.equal(treatments.plastic.clearcoat > 0 && treatments.plastic.roughness > treatments.metal.roughness, true,
      'plastic is rougher than the machined metal');
    await page.evaluate(() => { ErgoFlex.setSurfaceFinish('satin'); document.querySelector('#wood-finishes [data-finish="Natural Birch"]').click(); });


    // --- precision editing ---------------------------------------------------
    // A typed value and a gizmo drag must produce the same kind of undo entry
    // and the same bookkeeping, because they go through one commit path.
    const numeric = await page.evaluate(() => {
      document.getElementById('clear-parts-btn').click();
      ErgoFlex.selectByNames([ErgoFlex.liftObjects[0].obj.name]);
      ErgoFlex.refreshTransformInspector();
      // Ask the app which part the fields describe rather than assuming: a name
      // can match more than one mesh, and the inspector follows the last selected.
      const obj = ErgoFlex.inspectedPart;
      window.__inspected = obj.userData.editorId;
      const field = document.querySelector('#transform-inspector input[data-field="position"][data-axis="y"]');
      const shown = Number(field.value);
      const actual = ErgoFlex.canonicalTransform(obj).p.y;
      const undosBefore = ErgoFlex.undoCount;
      field.value = (shown + 0.2).toFixed(4);
      field.dispatchEvent(new Event('change'));
      return { shown, actual, undosBefore, undosAfter: ErgoFlex.undoCount,
               moved: ErgoFlex.canonicalTransform(obj).p.y - actual };
    });
    assert.ok(Math.abs(numeric.shown - numeric.actual) < 1e-3, 'the field shows the canonical value');
    assert.equal(numeric.undosAfter, numeric.undosBefore + 1, 'a typed edit pushes exactly one undo entry');
    assert.ok(Math.abs(numeric.moved - 0.2) < 1e-3, 'the typed value is applied');

    // That typed edit must survive a height change, like a gizmo edit does.
    const typedSurvives = await page.evaluate(() => {
      const obj = ErgoFlex.partRegistry.get(window.__inspected).obj;
      const before = ErgoFlex.canonicalTransform(obj).p.y;
      ErgoFlex.setHeight(46); ErgoFlex.setHeight(28);
      return ErgoFlex.canonicalTransform(obj).p.y - before;
    });
    assert.ok(Math.abs(typedSurvives) < 1e-6, 'a typed edit updates the lift baseline too');

    // Redo.
    const redo = await page.evaluate(() => {
      const obj = ErgoFlex.partRegistry.get(window.__inspected).obj;
      const edited = ErgoFlex.canonicalTransform(obj).p.y;
      ErgoFlex.undo();
      const undone = ErgoFlex.canonicalTransform(obj).p.y;
      const redoAvailable = ErgoFlex.redoCount;
      ErgoFlex.redo();
      const redone = ErgoFlex.canonicalTransform(obj).p.y;
      ErgoFlex.setHeight(46); ErgoFlex.setHeight(28);
      return { edited, undone, redoAvailable, redone, settled: ErgoFlex.canonicalTransform(obj).p.y };
    });
    assert.ok(Math.abs(redo.undone - redo.edited) > 0.1, 'undo moved it back');
    assert.equal(redo.redoAvailable, 1, 'undo makes a redo available');
    assert.ok(Math.abs(redo.redone - redo.edited) < 1e-6, 'redo restores the edit');
    assert.ok(Math.abs(redo.settled - redo.redone) < 1e-6, 'redo restores the lift baseline too');

    // A new edit must discard the redo branch.
    const branch = await page.evaluate(() => {
      ErgoFlex.undo();
      const before = ErgoFlex.redoCount;
      const obj = ErgoFlex.liftObjects[1].obj;
      obj.updateWorldMatrix(true, false);
      const snap = [{ obj, before: obj.matrixWorld.clone() }];
      obj.position.x += 0.05; obj.updateMatrixWorld(true);
      ErgoFlex.commitTransform(snap);
      return { before, after: ErgoFlex.redoCount };
    });
    assert.equal(branch.before, 1);
    assert.equal(branch.after, 0, 'a new edit clears the redo branch');

    // Alignment: one undo entry for the whole action.
    const align = await page.evaluate(() => {
      document.getElementById('clear-parts-btn').click();
      const names = ErgoFlex.liftObjects.slice(0, 3).map(i => i.obj.name);
      ErgoFlex.selectByNames(names);
      const undosBefore = ErgoFlex.undoCount;
      const selected = ErgoFlex.movingObjects.length;
      // Highest world-space corner of each part: that is what align-max equalises.
      // Computed here from the geometry bounds and the world matrix, rather than
      // widening the app's test surface just to read a bounding box.
      const topY = obj => {
        obj.updateWorldMatrix(true, false);
        obj.geometry.computeBoundingBox();
        const b = obj.geometry.boundingBox, m = obj.matrixWorld.elements;
        let max = -Infinity;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          max = Math.max(max, m[1] * x + m[5] * y + m[9] * z + m[13]);
        }
        return max;
      };
      const tops = () => ErgoFlex.movingObjects.map(i => topY(i.obj));
      const before = tops();
      ErgoFlex.alignSelection('y', 'max');
      const after = tops();
      return { undosBefore, undosAfter: ErgoFlex.undoCount, selected,
               spreadBefore: Math.max(...before) - Math.min(...before),
               spreadAfter: Math.max(...after) - Math.min(...after) };
    });
    assert.ok(align.selected >= 2, 'several parts were selected');
    assert.equal(align.undosAfter, align.undosBefore + 1, 'aligning many parts is one undo step');
    assert.ok(align.spreadAfter < 1e-6, 'align-max puts every top face on the same plane');
    assert.ok(align.spreadBefore > align.spreadAfter, 'and they were not already aligned');

    // Locking must block selection at the choke point, not just grey a button.
    const locking = await page.evaluate(() => {
      document.getElementById('clear-parts-btn').click();
      const name = ErgoFlex.liftObjects[0].obj.name;
      // Lock the whole selection, which is what the Lock button does. A model
      // name can cover more than one mesh, so locking a single object would
      // leave its namesakes selectable and prove nothing.
      ErgoFlex.selectByNames([name]);
      const parts = ErgoFlex.movingObjects.map(i => i.obj);
      parts.forEach(o => ErgoFlex.setLocked(o, true));
      document.getElementById('clear-parts-btn').click();
      ErgoFlex.selectByNames([name]);
      const selectedWhileLocked = ErgoFlex.movingObjects.length;
      parts.forEach(o => ErgoFlex.setLocked(o, false));
      ErgoFlex.selectByNames([name]);
      const selectedAfterUnlock = ErgoFlex.movingObjects.length;
      document.getElementById('clear-parts-btn').click();
      return { selectedWhileLocked, selectedAfterUnlock };
    });
    assert.equal(locking.selectedWhileLocked, 0, 'a locked part cannot be selected');
    assert.ok(locking.selectedAfterUnlock > 0, 'unlocking restores selection');

    // Locks travel with the project.
    const lockRoundTrip = await page.evaluate(() => {
      const obj = ErgoFlex.liftObjects[2].obj;
      ErgoFlex.setLocked(obj, true);
      const saved = ErgoFlex.lockedParts.length;
      const project = ErgoFlex.serializeProject();
      ErgoFlex.setLocked(obj, false);
      const clearedBefore = ErgoFlex.lockedParts.length;
      ErgoFlex.applyProject(project);
      return { saved, clearedBefore, restored: ErgoFlex.lockedParts.length };
    });
    assert.equal(lockRoundTrip.saved, 1, 'the lock is saved');
    assert.equal(lockRoundTrip.clearedBefore, 0, 'and was genuinely cleared before the import');
    assert.equal(lockRoundTrip.restored, 1, 'and comes back with the project');

    await page.evaluate(() => { document.getElementById('clear-parts-btn').click(); ErgoFlex.setHeight(28); });
    console.log('Editor selection, lift independence, isolation, snapping, box selection, clone undo, baseY, neutral pose, project round trip, presentation, materials, and precision editing passed.');
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

    // --- guided configurations ----------------------------------------------
    // Drive these through the real UI: a customer clicks preset cards and
    // accessory checkboxes, so that is what the test does.
    const preset = await page.evaluate(async () => {
      document.querySelector('[data-preset="creative"]').click();
      await new Promise(r => setTimeout(r, 50));
      return {
        size: document.getElementById('size-select').value,
        wood: ErgoFlex.currentConfig.woodFinish,
        accessories: ErgoFlex.currentConfig.accessories,
        headline: document.getElementById('total-price').textContent,
        lines: ErgoFlex.priceLines
      };
    });
    assert.equal(preset.size, '72x30', 'the preset set the size');
    assert.equal(preset.wood, 'Walnut', 'and the finish');
    assert.ok(preset.accessories.length >= 2, 'and the accessories');
    const sum = preset.lines.reduce((n, l) => n + l.price, 0);
    assert.equal(preset.headline, '$' + sum.toLocaleString('en-US'),
      'the headline price equals the sum of the breakdown lines');

    // The breakdown must be on screen, not just in memory.
    const rows = await page.$$eval('#price-breakdown .breakdown-row', els => els.map(e => e.textContent));
    assert.ok(rows.length === preset.lines.length + 1, 'every line is rendered, plus a total');
    assert.ok(rows[rows.length - 1].includes('Estimate'), 'the last row is the estimate');

    // Narrowing the desk must remove an accessory that no longer fits, and say so.
    const shrunk = await page.evaluate(async () => {
      const select = document.getElementById('size-select');
      select.value = '48x30';
      select.dispatchEvent(new Event('change'));
      return { accessories: ErgoFlex.currentConfig.accessories,
               toast: document.getElementById('studio-toast').textContent,
               disabled: [...document.querySelectorAll('#accessory-list input')].filter(i => i.disabled).length };
    });
    assert.ok(!shrunk.accessories.includes('monitor-arm-2'),
      'the dual monitor arm is dropped when the top is too narrow');
    assert.ok(/removed/i.test(shrunk.toast), 'and the removal is reported rather than silent');
    assert.ok(shrunk.disabled > 0, 'incompatible accessories are disabled in the list');

    // Hiding the options column must actually widen the viewer. Found in the
    // browser: the first version toggled a Tailwind class the CDN JIT never
    // generated, because lg:col-span-4 appears nowhere in the markup.
    const optionsCollapse = await page.evaluate(async () => {
      const w = () => parseFloat(document.getElementById('model-canvas').style.width);
      const before = w();
      document.getElementById('config-collapse').click();
      await new Promise(r => setTimeout(r, 300));
      const collapsed = w();
      const label = document.getElementById('config-collapse').textContent;
      document.getElementById('config-collapse').click();
      await new Promise(r => setTimeout(r, 300));
      return { before, collapsed, restored: w(), label };
    });
    assert.ok(optionsCollapse.collapsed > optionsCollapse.before + 100,
      'hiding the options column gives the viewer its width');
    assert.equal(optionsCollapse.label, 'Show options', 'and the button says how to get it back');
    assert.ok(Math.abs(optionsCollapse.restored - optionsCollapse.before) < 2, 'showing them restores the layout');

    // Accessories survive a share link, and unknown ids do not.
    const shareRoundTrip = await page.evaluate(() => {
      const good = JSON.stringify(ErgoFlex.currentConfig);
      return { valid: ErgoFlex.validConfigForTest(JSON.parse(good)),
               rejected: ErgoFlex.validConfigForTest({ ...JSON.parse(good), accessories: ['evil'] }) };
    });
    assert.equal(shareRoundTrip.valid, true, 'the current configuration is shareable');
    assert.equal(shareRoundTrip.rejected, false, 'an unknown accessory id is refused at the boundary');

    // A V1 cart must migrate rather than be discarded.
    const migrated = await page.evaluate(() => {
      localStorage.removeItem('ergoflexCartV2');
      localStorage.setItem('ergoflexCartV1', JSON.stringify([
        { size: '48x30', woodFinish: 'Walnut', baseFinish: 'White', quantity: 2 }
      ]));
      return true;
    });
    assert.equal(migrated, true);
    await page.reload();
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    const afterMigration = await page.evaluate(() => document.getElementById('cart-count').textContent);
    assert.equal(afterMigration, '2', 'a V1 cart is read once and its quantities survive');


    // --- build checks --------------------------------------------------------
    const validation = await page.evaluate(() => {
      const findings = ErgoFlex.runValidation();
      const panel = document.getElementById('validation-panel');
      return {
        findings: findings.map(f => ({ code: f.code, severity: f.severity, blocking: f.blocking })),
        rendered: panel ? panel.querySelectorAll('.validation-row').length : -1,
        summary: panel ? panel.querySelector('.validation-summary')?.textContent : null,
        addToCartDisabled: document.getElementById('add-to-cart').disabled
      };
    });
    assert.ok(validation.rendered >= 0, 'the build-checks panel exists');
    assert.equal(validation.findings.length, validation.rendered, 'every finding is rendered');
    // The property that matters: advisory until a real product spec arrives.
    assert.ok(validation.findings.every(f => f.blocking === false), 'no rule is promoted to blocking');
    assert.equal(validation.addToCartDisabled, false, 'so ordering is never blocked by an unconfirmed limit');

    // Actuator travel has to be sampled across lift AND tilt: the solver moves
    // both endpoints with the lift, so a lift-only sample measures nothing.
    const travel = await page.evaluate(() => {
      const info = ErgoFlex.runValidation().find(f => f.code === 'actuator-stroke-unknown');
      return info ? info.message : null;
    });
    assert.ok(travel && /needs [\d.]+ units of travel/.test(travel), 'actuator travel is measured');
    assert.ok(!/needs 0\.000 units/.test(travel),
      'and the lift x tilt grid finds real travel, unlike a lift-only sample');

    // Sampling must leave the desk exactly where it was.
    const undisturbed = await page.evaluate(() => {
      ErgoFlex.setHeight(41); ErgoFlex.setTilt('tilting', -12);
      const before = { h: ErgoFlex.deskHeight, t: ErgoFlex.tiltConfigs[0].currentDeg };
      ErgoFlex.runValidation();
      return { before, after: { h: ErgoFlex.deskHeight, t: ErgoFlex.tiltConfigs[0].currentDeg } };
    });
    assert.ok(Math.abs(undisturbed.after.h - undisturbed.before.h) < 0.01, 'sampling restores the height');
    assert.equal(undisturbed.after.t, undisturbed.before.t, 'and the tilt');

    // A known-bad combination is caught through the real UI.
    const badCombo = await page.evaluate(async () => {
      document.querySelector('[data-preset="creative"]').click();   // 72in + dual arm
      const select = document.getElementById('size-select');
      select.value = '48x30';
      select.dispatchEvent(new Event('change'));
      return ErgoFlex.runValidation().map(f => f.code);
    });
    // Narrowing already strips the accessory, so the incompatibility is resolved
    // rather than reported — which is the better outcome, and worth asserting.
    assert.ok(!badCombo.includes('accessory-size'),
      'narrowing removes the accessory rather than leaving an unbuildable estimate');

    // Cache: an edit must invalidate it, or stale results are served against
    // geometry that has changed.
    const cache = await page.evaluate(() => {
      const first = ErgoFlex.runValidation();
      const revBefore = ErgoFlex.editRevision;
      ErgoFlex.reportSceneWarning('test-warning', 'A synthetic problem for the cache test.');
      const after = ErgoFlex.runValidation();
      return { firstLength: first.length, revBefore, afterCodes: after.map(f => f.code) };
    });
    assert.ok(cache.afterCodes.includes('test-warning'),
      'a newly reported scene problem reaches the panel instead of the console alone');

    console.log('Store pricing, presets, accessories, V1 to V2 migration, and build checks passed.');
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
