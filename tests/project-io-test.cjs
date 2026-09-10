// Validation is a pure function over a parsed file plus a description of the
// scene, so it is tested directly rather than through a browser.
const assert = require('node:assert/strict');

(async () => {
  const { validateProjectFile, hardProblems, softProblems, PROJECT_FORMAT_VERSION } =
    await import('../project-io.mjs');

  const MODEL = 'https://example.test/full.glb';
  const scene = {
    assetIds: new Set(['Desktop_0', 'Desktop_1', 'Leg_2']),
    modelUrl: MODEL,
    modelFingerprint: 'abc123'
  };
  const trs = { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 }, s: { x: 1, y: 1, z: 1 } };
  const base = (over = {}) => ({
    formatVersion: PROJECT_FORMAT_VERSION,
    model: { url: MODEL, contentFingerprint: 'abc123' },
    parts: { clones: [], transforms: [], liftMembers: [], locked: [], labels: [], groups: {} },
    rigs: { tilt: [], actuator: [] },
    ...over
  });
  const codes = result => result.problems.map(p => p.code);

  // --- hard aborts ---
  for (const [label, file] of [
    ['not an object', 'nonsense'],
    ['null', null],
    ['unknown version', base({ formatVersion: 99 })],
    ['no model', base({ model: {} })],
    ['different model', base({ model: { url: 'https://other.test/x.glb' } })]
  ]) {
    const result = validateProjectFile(file, scene);
    assert.equal(result.ok, false, `${label} is refused`);
    assert.ok(hardProblems(result.problems).length > 0, `${label} reports a hard problem`);
  }

  // --- the staged registry ---
  const withClone = base({
    parts: { ...base().parts, clones: [{ editorId: 'Desktop_0_clone_9', sourceEditorId: 'Desktop_0', parentEditorId: 'model', transform: trs }] }
  });
  let result = validateProjectFile(withClone, scene);
  assert.equal(result.ok, true, 'a project may reference its own not-yet-created clones');
  assert.ok(result.stagedIds.has('Desktop_0_clone_9'), 'the clone is staged');
  assert.equal(result.cloneOrder.length, 1);

  // Groups and rigs may point at those clones.
  const cloneReferences = base({
    parts: {
      ...withClone.parts,
      groups: { Mine: ['Desktop_0', 'Desktop_0_clone_9'] },
      liftMembers: ['Desktop_0_clone_9']
    },
    rigs: { tilt: [{ groupEditorIds: ['Desktop_0_clone_9'] }], actuator: [] }
  });
  result = validateProjectFile(cloneReferences, scene);
  assert.equal(result.ok, true, 'groups and rigs may reference the project’s own clones');
  assert.deepEqual(softProblems(result.problems), [], 'and that is not even a warning');

  // Re-importing the same file must not collide with itself. The live registry
  // holds the previous import's clones, but staging uses asset parts only.
  const afterFirstImport = { ...scene, assetIds: new Set(scene.assetIds) };
  result = validateProjectFile(withClone, afterFirstImport);
  assert.equal(result.ok, true, 'the same project imports twice');

  // A clone id that shadows a real model part is a genuine collision.
  result = validateProjectFile(base({
    parts: { ...base().parts, clones: [{ editorId: 'Leg_2', sourceEditorId: 'Desktop_0' }] }
  }), scene);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('clone-shadows-asset'));

  // Duplicates within the file.
  result = validateProjectFile(base({
    parts: { ...base().parts, clones: [
      { editorId: 'c1', sourceEditorId: 'Desktop_0' },
      { editorId: 'c1', sourceEditorId: 'Desktop_1' }
    ] }
  }), scene);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('duplicate-clone'));

  // A source that does not exist anywhere.
  result = validateProjectFile(base({
    parts: { ...base().parts, clones: [{ editorId: 'c1', sourceEditorId: 'ghost' }] }
  }), scene);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('clone-source'));

  // --- clone graphs ---
  // A clone of a clone is legal and must be ordered.
  result = validateProjectFile(base({
    parts: { ...base().parts, clones: [
      { editorId: 'c2', sourceEditorId: 'c1' },
      { editorId: 'c1', sourceEditorId: 'Desktop_0' }
    ] }
  }), scene);
  assert.equal(result.ok, true, 'a clone of a clone is allowed');
  assert.deepEqual(result.cloneOrder.map(c => c.editorId), ['c1', 'c2'], 'and is ordered source-first');

  // A cycle is not.
  result = validateProjectFile(base({
    parts: { ...base().parts, clones: [
      { editorId: 'c1', sourceEditorId: 'c2' },
      { editorId: 'c2', sourceEditorId: 'c1' }
    ] }
  }), scene);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('clone-cycle'));

  // --- soft problems: valid, but say what will be lost ---
  result = validateProjectFile(base({
    parts: { ...base().parts, liftMembers: ['Desktop_0', 'vanished_1', 'vanished_2'] }
  }), scene);
  assert.equal(result.ok, true, 'missing parts do not abort the import');
  assert.ok(codes(result).includes('unresolved-parts'));
  assert.ok(/2 referenced parts/.test(result.problems.find(p => p.code === 'unresolved-parts').message),
    'the count is reported so the user knows the scale');

  result = validateProjectFile(base({ model: { url: MODEL, contentFingerprint: 'changed' } }), scene);
  assert.equal(result.ok, true, 'a changed model is a warning, not an abort');
  assert.ok(codes(result).includes('fingerprint'));

  result = validateProjectFile(base(), { ...scene, modelFingerprint: null });
  assert.equal(result.ok, true);
  assert.ok(codes(result).includes('fingerprint-unavailable'), 'an unverifiable model is disclosed');

  // --- malformed numbers must not slip through ---
  result = validateProjectFile(base({
    parts: { ...base().parts, transforms: [{ editorId: 'Desktop_0', delta: { p: { x: NaN, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 }, s: { x: 1, y: 1, z: 1 } } }] }
  }), scene);
  assert.equal(result.ok, false, 'NaN in a transform is refused');
  assert.ok(codes(result).includes('transform-shape'));

  // --- a clean file is clean ---
  result = validateProjectFile(base(), scene);
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, [], 'a matching project reports nothing at all');

  console.log('Project file validation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
