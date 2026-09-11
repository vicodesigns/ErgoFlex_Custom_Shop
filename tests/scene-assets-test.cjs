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
    res.setHeader('Content-Type', ({
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
      '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary'
    })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?setup`);
    await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4, { timeout: 90000 });
    // Derived from the generated index rather than written out, so converting
    // more props is a pipeline run and not also a test edit.
    const catalogSize = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')).props.length;
    await page.waitForFunction(count => document.querySelectorAll('.scene-library-card').length === count, { timeout: 90000 }, catalogSize);

    await page.evaluate(async () => { ErgoFlex.setRoomScene('office', false); await ErgoFlex.workspaceRoom.ready; });
    const original = await page.evaluate(() => ({
      count: ErgoFlex.sceneAssetRegistry.size,
      library: document.querySelectorAll('.scene-library-card').length,
      list: document.querySelectorAll('.scene-current-item').length
    }));
    assert.ok(original.count > 10, 'room and desk-dressing props are editable');
    assert.deepEqual(original.library, catalogSize, 'the complete prop catalog appears in the library');
    assert.equal(original.list, original.count, 'every placed prop appears in the scene list');

    const edited = await page.evaluate(() => {
      document.querySelector('.scene-current-item').click();
      const obj = ErgoFlex.movingObjects.at(-1).obj;
      const id = obj.userData.editorId;
      const before = obj.matrixWorld.clone();
      obj.position.x += 137;
      obj.updateMatrixWorld(true);
      ErgoFlex.commitTransform([{ obj, before }]);
      document.getElementById('selected-part-label').value = 'Reception shelf';
      document.getElementById('selected-part-rename-btn').click();
      return { id, x: ErgoFlex.canonicalTransform(obj).p.x, project: ErgoFlex.serializeProject() };
    });
    assert.equal(edited.project.presentation.sceneAssetLabels.some(([id, label]) => id === edited.id && label === 'Reception shelf'), true);
    assert.equal(edited.project.parts.labels.some(([id]) => id === edited.id), false, 'scene labels stay out of desk-part validation');

    await page.evaluate(async () => {
      ErgoFlex.setRoomScene('home', false); await ErgoFlex.workspaceRoom.ready;
      ErgoFlex.setRoomScene('office', false); await ErgoFlex.workspaceRoom.ready;
    });
    const restored = await page.evaluate(id => {
      const entry = ErgoFlex.sceneAssetRegistry.get(id);
      return { x: ErgoFlex.canonicalTransform(entry.obj).p.x, label: document.querySelector(`[title="${id}"]`)?.textContent };
    }, edited.id);
    assert.ok(Math.abs(restored.x - edited.x) < 1e-6, 'scene transform survives scene switches');
    assert.equal(restored.label, 'Reception shelf', 'scene rename survives scene switches');

    const lifecycle = await page.evaluate(async () => {
      const before = ErgoFlex.sceneAssetRegistry.size;
      await ErgoFlex.addSceneAsset('airtag');
      const added = ErgoFlex.movingObjects.at(-1).obj.userData.editorId;
      const afterAdd = ErgoFlex.sceneAssetRegistry.size;
      ErgoFlex.deleteSelectedSceneAssets();
      const afterDelete = ErgoFlex.sceneAssetRegistry.size;
      ErgoFlex.undo();
      const afterUndo = ErgoFlex.sceneAssetRegistry.size;
      ErgoFlex.redo();
      const afterRedo = ErgoFlex.sceneAssetRegistry.size;
      return { before, added, afterAdd, afterDelete, afterUndo, afterRedo };
    });
    assert.equal(lifecycle.afterAdd, lifecycle.before + 1);
    assert.equal(lifecycle.afterDelete, lifecycle.before);
    assert.equal(lifecycle.afterUndo, lifecycle.before + 1);
    assert.equal(lifecycle.afterRedo, lifecycle.before);

    const projectRoundTrip = await page.evaluate(async id => {
      const project = ErgoFlex.serializeProject();
      document.getElementById('clear-parts-btn').click();
      document.querySelector(`[title="${id}"]`).click();
      ErgoFlex.deleteSelectedSceneAssets();
      const removed = !ErgoFlex.sceneAssetRegistry.has(id);
      const outcome = ErgoFlex.applyProject(project);
      await ErgoFlex.workspaceRoom.ready;
      const restoredEntry = ErgoFlex.sceneAssetRegistry.get(id);
      return {
        removed,
        ok: outcome.ok,
        problems: outcome.problems.map(problem => problem.code),
        restored: Boolean(restoredEntry),
        x: restoredEntry ? ErgoFlex.canonicalTransform(restoredEntry.obj).p.x : null
      };
    }, edited.id);
    assert.equal(projectRoundTrip.removed, true);
    assert.deepEqual(projectRoundTrip.problems, [], 'scene state does not create unresolved desk-part references');
    assert.equal(projectRoundTrip.ok, true);
    assert.equal(projectRoundTrip.restored, true);
    assert.ok(Math.abs(projectRoundTrip.x - edited.x) < 1e-6, 'project import restores the scene layout');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('Scene asset library, selection, transform, rename, persistence, delete, undo, redo, and project restore passed.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
