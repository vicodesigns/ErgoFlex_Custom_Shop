const assert = require('node:assert/strict');

module.exports = async function checkWorkspace(page, url) {
  await page.evaluate(() => {
    document.getElementById('reset-build').click();
    ErgoFlex.setHeight(28); ErgoFlex.setTilt('tilting', 0); ErgoFlex.setGlidePosition(0, 0);
    for (const id of ['dell-u2724d', 'logitech-k860', 'logitech-lift', 'desk-mat', 'task-light', 'foot-rest', 'cable-tray', 'cpu-holder']) ErgoFlex.toggleAccessory(id);
  });
  const placement = await page.evaluate(async () => {
    const T = await import('three');
    const w = ErgoFlex.workspaceAccessories; w.update();
    const keyboard = w.items.get('logitech-k860'), mouse = w.items.get('logitech-lift');
    const mount = w.mounts.get('desktop');
    const up = new T.Vector3(0, 1, 0).transformDirection(mount.group.matrixWorld);
    const origin = keyboard.getWorldPosition(new T.Vector3());
    const ray = new T.Raycaster(origin.clone().addScaledVector(up, .1), up.clone().negate());
    const hit = ray.intersectObject(mount.anchor, false)[0];
    // Local bounds in millimetres, unaffected by the user's camera or CAD units.
    const dimensions = obj => {
      const clone = obj.clone(true); clone.position.set(0, 0, 0);
      return new T.Box3().setFromObject(clone).getSize(new T.Vector3()).toArray();
    };
    const relative = obj => obj.matrixWorld.clone().premultiply(mount.anchor.matrixWorld.clone().invert()).toArray();
    const before = relative(keyboard);
    const floorY = w.items.get('foot-rest').getWorldPosition(new T.Vector3()).y;
    ErgoFlex.setHeight(46); ErgoFlex.setTilt('tilting', -22); ErgoFlex.setGlidePosition(.3, -.2); w.update();
    const after = relative(keyboard);
    const raisedFloorY = w.items.get('foot-rest').getWorldPosition(new T.Vector3()).y;
    const floorPosition = w.items.get('foot-rest').getWorldPosition(new T.Vector3()).toArray();
    ErgoFlex.setHeight(28); ErgoFlex.setTilt('tilting', 0); ErgoFlex.setGlidePosition(0, 0); w.update();
    return { count: w.items.size, gapMm: hit ? origin.distanceTo(hit.point) / w.scale : null,
      keyboard: dimensions(keyboard), mouse: dimensions(mouse), before, after, floorY, raisedFloorY, floorPosition,
      deskPlaneY: new T.Vector3().setFromMatrixPosition(mount.group.matrixWorld).y };
  });
  assert.equal(placement.count, 8, 'each selected generated accessory appears');
  assert.ok(placement.gapMm !== null && Math.abs(placement.gapMm - 3) < .25,
    `keyboard rests on the 3 mm mat above the measured desk face (gap ${placement.gapMm})`);
  for (const [actual, expected] of [[placement.keyboard, [456, 48, 233]], [placement.mouse, [70, 71, 108]]])
    expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) < .1, 'branded model uses published envelope dimensions'));
  placement.before.forEach((value, i) => assert.ok(Math.abs(value - placement.after[i]) < 1e-7, 'accessory keeps its transform relative to the desktop through lift, tilt and glide'));
  assert.ok(Math.abs(placement.floorY - placement.raisedFloorY) < 1e-7, 'footrest stays on the floor while desk rises');

  const mounting = await page.evaluate(() => {
    const w = ErgoFlex.workspaceAccessories;
    ErgoFlex.toggleAccessory('monitor-arm');
    const mounted = !w.items.get('dell-u2724d').getObjectByName('monitor-stand').visible;
    const size = document.getElementById('size-select'); size.value = '72x30'; size.dispatchEvent(new Event('change'));
    ErgoFlex.toggleAccessory('monitor-arm-2');
    const replaced = !w.items.has('monitor-arm') && w.items.has('monitor-arm-2');
    size.value = '48x30'; size.dispatchEvent(new Event('change'));
    const restored = w.items.get('dell-u2724d').getObjectByName('monitor-stand').visible && !w.items.has('monitor-arm-2');
    ErgoFlex.toggleAccessory('logitech-lift');
    const removed = !w.items.has('logitech-lift');
    ErgoFlex.toggleAccessory('logitech-lift');
    return { mounted, replaced, restored, removed, monitors: w.objects().filter(o => o.userData.accessoryId === 'dell-u2724d').length };
  });
  assert.deepEqual(mounting, { mounted: true, replaced: true, restored: true, removed: true, monitors: 1 });

  const sceneState = await page.evaluate(() => {
    const before = JSON.stringify(ErgoFlex.currentConfig), price = document.getElementById('total-price').textContent;
    const scenes = [];
    for (const id of ['office', 'home', 'music', 'gaming', 'product', 'home']) {
      document.querySelector(`[data-room-scene="${id}"]`).click();
      scenes.push({ id: ErgoFlex.roomScene, geometry: ErgoFlex.workspaceRoom.root?.children.length || 0,
        active: document.querySelector(`[data-room-scene="${id}"]`).getAttribute('aria-pressed') });
    }
    return { before, after: JSON.stringify(ErgoFlex.currentConfig), price, afterPrice: document.getElementById('total-price').textContent,
      scenes, serialized: ErgoFlex.serializeProject().presentation.roomScene,
      roomCount: ErgoFlex.loadedModel.parent.children.filter(o => o.name.startsWith('Room:')).length };
  });
  assert.equal(sceneState.before, sceneState.after, 'scene furnishings never modify purchased accessories');
  assert.equal(sceneState.price, sceneState.afterPrice, 'scene selection has no price');
  assert.equal(sceneState.roomCount, 1, 'switching scenes removes the previous room');
  assert.equal(sceneState.serialized, 'home', 'projects preserve the room scene');
  for (const s of sceneState.scenes) {
    assert.equal(s.active, 'true');
    assert.ok(s.id === 'product' ? s.geometry === 0 : s.geometry > 3, `${s.id} builds an actual room`);
  }

  const estimate = await page.evaluate(async () => {
    const original = URL.createObjectURL;
    let text;
    URL.createObjectURL = blob => { text = blob.text(); return original(blob); };
    try { document.getElementById('download-quote').click(); return await text; }
    finally { URL.createObjectURL = original; }
  });
  assert.ok(estimate.includes('Logitech Lift*') && estimate.includes('Dell UltraSharp 27*'), 'downloaded estimate lists selected products and flags provisional prices');

  await page.evaluate(() => { document.getElementById('save-build').click(); document.getElementById('add-to-cart').click(); });
  const cart = await page.$eval('.cart-row:last-of-type', row => row.textContent);
  assert.ok(cart.includes('Logitech Lift') && cart.includes('Dell UltraSharp 27'), 'cart itemises the selected products');
  await page.evaluate(() => {
    document.getElementById('continue-shopping').click(); document.getElementById('reset-build').click();
    document.getElementById('cart-btn').click(); document.querySelector('.cart-row:last-of-type .cart-preview').click();
    document.getElementById('save-build').click();
  });
  assert.equal(await page.evaluate(() => ErgoFlex.workspaceAccessories.items.has('logitech-lift')), true, 'cart preview restores its accessories');
  await page.reload();
  await page.waitForFunction(() => window.ErgoFlex?.workspaceAccessories?.items.has('logitech-lift'), { timeout: 90000 });
  assert.equal(await page.evaluate(() => ErgoFlex.roomScene), 'home', 'room survives reload');
  assert.equal(await page.evaluate(() => ErgoFlex.workspaceAccessories.items.size), 8, 'saved accessories appear after model loads');
  await page.setViewport({ width: 390, height: 844 });
  await page.click('[data-room-scene="gaming"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'scene controls fit mobile');
  const overlap = await page.evaluate(() => {
    const controls = document.querySelector('.viewer-controls').getBoundingClientRect();
    const canvas = document.querySelector('#model-canvas').getBoundingClientRect();
    return controls.bottom > canvas.top;
  });
  assert.equal(overlap, false, 'scene controls do not cover the canvas');
  console.log('Workspace accessories, physical placement, mounting, scenes, cart preview and reload passed.');
};
