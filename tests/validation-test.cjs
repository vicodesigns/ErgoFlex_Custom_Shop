const assert = require('node:assert/strict');

(async () => {
  const { validateBuild, blockingFindings, validationCacheKey, LIMITS, INTENDED_CONTACT } =
    await import('../validation.mjs');

  const config = { size: '72x30', woodFinish: 'Walnut', baseFinish: 'Navy', accessories: ['monitor-arm-2'] };
  const codes = f => f.map(x => x.code);

  // --- advisory by default -------------------------------------------------
  // This is the property that matters most: until a limit comes from a real
  // product spec, nothing may block an order.
  const everything = validateBuild(
    { size: '48x30', woodFinish: 'Walnut', baseFinish: 'Navy', accessories: ['monitor-arm-2'] },
    { overlaps: [{ a: 'Desktop_3', b: 'Wheel_F_L', aRole: 'desktop', bRole: 'wheel', amount: 0.4 }] });
  assert.ok(everything.length > 0, 'problems are reported');
  assert.deepEqual(blockingFindings(everything), [],
    'but nothing blocks while every limit is unconfirmed');
  assert.ok(everything.every(f => f.blocking === false), 'no finding is marked blocking');

  // --- actuator travel -----------------------------------------------------
  // Sampling the lift alone is nearly useless because both endpoints move with
  // it. A near-constant series must not read as a travel problem.
  const flat = validateBuild(config, { actuators: [{ name: 'actuator_rear', lengths: [1.0, 1.0001, 1.0] }] });
  assert.ok(codes(flat).includes('actuator-stroke-unknown'),
    'travel is measured and reported, with the missing limit disclosed');
  assert.ok(/0\.000/.test(flat.find(f => f.code === 'actuator-stroke-unknown').message),
    'a lift-only sample shows almost no travel, which is exactly the trap');

  // With a real limit set, a genuine overrun is caught.
  LIMITS.actuatorStroke.max = 0.5;
  const overrun = validateBuild(config, { actuators: [{ name: 'actuator_rear', lengths: [1.0, 1.9] }] });
  assert.ok(codes(overrun).includes('actuator-stroke'), 'travel beyond the stroke is flagged');
  const within = validateBuild(config, { actuators: [{ name: 'actuator_rear', lengths: [1.0, 1.2] }] });
  assert.ok(!codes(within).includes('actuator-stroke'), 'travel within the stroke is not');
  LIMITS.actuatorStroke.max = null;

  // --- collisions are candidates, and intended contact is excluded ---------
  const intended = validateBuild(config, { overlaps: [
    { a: 'Screws_24', b: 'Lift_Column_Top', aRole: 'hardware', bRole: 'column', amount: 0.01 },
    { a: 'Lift_Column_Center', b: 'Lift_Column_Top', aRole: 'column', bRole: 'column', amount: 0.5 }
  ] });
  assert.ok(!codes(intended).includes('collision-candidate'),
    'a fastener in its hole and a column inside a column are not collisions');

  const unexpected = validateBuild(config, { overlaps: [
    { a: 'Desktop_3', b: 'Wheel_F_L', aRole: 'desktop', bRole: 'wheel', amount: 0.4 }
  ] });
  const candidate = unexpected.find(f => f.code === 'collision-candidate');
  assert.ok(candidate, 'an unexpected overlap is reported');
  assert.equal(candidate.severity, 'warning', 'as a candidate for review, not a verdict');
  assert.ok(/worth checking/i.test(candidate.message), 'and the wording says so');
  assert.ok(INTENDED_CONTACT.length > 5, 'the exclusion list is substantial, as it must be');

  // --- declarative incompatibilities ---------------------------------------
  const narrow = validateBuild({ size: '48x30', woodFinish: 'Walnut', baseFinish: 'Navy', accessories: ['monitor-arm-2'] });
  assert.ok(codes(narrow).includes('incompatible'), 'a known-bad combination is caught');
  assert.equal(narrow[0].severity, 'error', 'and sorts first');
  const wide = validateBuild(config);
  assert.ok(!codes(wide).includes('incompatible'), 'the same accessory on a wider top is fine');

  // --- cache key -----------------------------------------------------------
  // The failure this guards against: moving a part changes the geometry the
  // rules run against while size, rigs and accessories all stay the same.
  const base = { fingerprint: 'abc', size: '72x30', editRevision: 1, rigSignature: 'r1', accessories: ['cable-tray'] };
  assert.equal(validationCacheKey(base), validationCacheKey({ ...base }), 'the key is stable');
  assert.notEqual(validationCacheKey(base), validationCacheKey({ ...base, editRevision: 2 }),
    'an edit invalidates the cache');
  assert.notEqual(validationCacheKey(base), validationCacheKey({ ...base, rigSignature: 'r2' }),
    'a rig change invalidates the cache');
  assert.notEqual(validationCacheKey(base), validationCacheKey({ ...base, accessories: [] }),
    'an accessory change invalidates the cache');
  assert.notEqual(validationCacheKey(base), validationCacheKey({ ...base, fingerprint: 'xyz' }),
    'a different model invalidates the cache');
  assert.notEqual(validationCacheKey(base), validationCacheKey({ ...base, warningRevision: 1 }),
    'a newly detected scene problem invalidates the cache');
  assert.equal(validationCacheKey({ ...base, accessories: ['a', 'b'] }),
               validationCacheKey({ ...base, accessories: ['b', 'a'] }),
    'accessory order does not');

  // --- console warnings become findings ------------------------------------
  const surfaced = validateBuild(config, { warnings: [{ code: 'rig-parts-missing', message: 'Rig X is missing 2 parts.' }] });
  assert.ok(codes(surfaced).includes('rig-parts-missing'),
    'problems the app already detects reach the user instead of only the console');

  // --- a clean build is clean ----------------------------------------------
  const clean = validateBuild({ size: '60x30', woodFinish: 'Maple', baseFinish: 'White', accessories: ['cable-tray'] });
  assert.deepEqual(clean, [], 'a sound configuration reports nothing');

  console.log('Build validation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
