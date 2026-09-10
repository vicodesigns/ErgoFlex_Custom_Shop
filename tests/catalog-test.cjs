// Pure-function tests. No browser: catalog.mjs has no DOM or Three.js dependency,
// so pricing and validation are exercised directly. The package is CommonJS, so
// the ES module is loaded with a dynamic import rather than require().
const assert = require('node:assert/strict');

(async () => {
  const { PRODUCT_CONFIG, money, configurationPrice, validConfig, cleanConfig } =
    await import('../catalog.mjs');

  const base = PRODUCT_CONFIG.basePrice;
  const defaultConfig = { size: '48x30', woodFinish: 'Natural Birch', baseFinish: 'White' };

  // --- configurationPrice ---
  assert.equal(configurationPrice(defaultConfig), base,
    'default configuration costs the base price');

  const walnutNavy = { size: '72x30', woodFinish: 'Walnut', baseFinish: 'Navy' };
  assert.equal(
    configurationPrice(walnutNavy),
    base + PRODUCT_CONFIG.sizes['72x30'].price
         + PRODUCT_CONFIG.woodFinishes.find(f => f.name === 'Walnut').price
         + PRODUCT_CONFIG.baseFinishes.find(f => f.name === 'Navy').price,
    'upgrades sum onto the base price');

  // Unknown names must degrade, not throw: a stale saved build should render a
  // low estimate rather than take the page down.
  assert.equal(configurationPrice({ size: 'nope', woodFinish: 'nope', baseFinish: 'nope' }), base,
    'unknown options contribute nothing');
  assert.equal(configurationPrice(null), base, 'a missing config falls back to base');
  assert.equal(configurationPrice(undefined), base, 'an absent config falls back to base');

  // Every catalog entry must price without throwing.
  for (const size of Object.keys(PRODUCT_CONFIG.sizes)) {
    for (const wood of PRODUCT_CONFIG.woodFinishes) {
      for (const frame of PRODUCT_CONFIG.baseFinishes) {
        const price = configurationPrice({ size, woodFinish: wood.name, baseFinish: frame.name });
        assert.ok(Number.isFinite(price) && price >= base, `priced ${size}/${wood.name}/${frame.name}`);
      }
    }
  }

  // --- validConfig: the share-link boundary ---
  assert.equal(validConfig(defaultConfig), true, 'a real configuration validates');
  assert.equal(validConfig(null), false, 'null is rejected');
  assert.equal(validConfig({}), false, 'an empty object is rejected');
  assert.equal(validConfig({ ...defaultConfig, size: '99x99' }), false, 'an unknown size is rejected');
  assert.equal(validConfig({ ...defaultConfig, woodFinish: 'Unobtanium' }), false, 'an unknown wood is rejected');
  assert.equal(validConfig({ ...defaultConfig, baseFinish: 'Chrome' }), false, 'an unknown frame is rejected');
  // Object.hasOwn, not `in`, so inherited keys must not satisfy the size check.
  assert.equal(validConfig({ ...defaultConfig, size: 'toString' }), false,
    'prototype keys do not count as sizes');

  // --- cleanConfig: the whitelist ---
  const dirty = { ...defaultConfig, evil: 'payload', __proto__: { polluted: true }, price: 0 };
  const clean = cleanConfig(dirty);
  assert.deepEqual(Object.keys(clean).sort(), ['accessories', 'baseFinish', 'size', 'woodFinish'],
    'only the known keys survive');
  assert.deepEqual(clean.accessories, [], 'a V1 payload normalises to an empty accessory list');
  assert.equal(clean.evil, undefined, 'unknown keys are dropped');
  assert.equal({}.polluted, undefined, 'no prototype pollution');

  // --- money ---
  assert.equal(money(1299), '$1,299', 'thousands separator');
  assert.equal(money(0), '$0', 'zero formats');
  assert.equal(money(1299999), '$1,299,999', 'large values format');

  // --- accessories, presets, and the breakdown ---
  const { ACCESSORIES, PRESETS, priceBreakdown, accessoryFits, incompatibleAccessories } =
    await import('../catalog.mjs');

  // The breakdown must always sum to the price. That is the whole contract.
  for (const preset of PRESETS) {
    const config = cleanConfig(preset);
    assert.equal(validConfig(config), true, `${preset.id} is a valid configuration`);
    const lines = priceBreakdown(config);
    assert.equal(lines.reduce((n, l) => n + l.price, 0), configurationPrice(config),
      `${preset.id}: the breakdown sums to the price`);
    assert.ok(lines.length > 1, `${preset.id} itemises more than the base desk`);
    // A preset must not ship an accessory its own size cannot take.
    assert.deepEqual(incompatibleAccessories(config), [], `${preset.id} has no incompatible accessories`);
  }

  // The base configuration is still exactly the base price.
  assert.equal(configurationPrice({ ...defaultConfig, accessories: [] }), base);

  // Accessories add their price.
  const withAccessory = { ...defaultConfig, accessories: ['cable-tray'] };
  assert.equal(configurationPrice(withAccessory), base + 89, 'an accessory adds its price');
  assert.ok(priceBreakdown(withAccessory).some(l => l.provisional),
    'provisional pricing is flagged all the way to the breakdown');

  // Compatibility is enforced, not advisory, at the validation boundary.
  assert.equal(accessoryFits('monitor-arm-2', '48x30'), false, 'the dual arm needs a wider top');
  assert.equal(accessoryFits('monitor-arm-2', '72x30'), true);
  assert.deepEqual(incompatibleAccessories({ size: '48x30', accessories: ['monitor-arm-2', 'cable-tray'] })
    .map(a => a.id), ['monitor-arm-2'], 'incompatible accessories are reported, not silently dropped');

  // Unknown accessory ids must not survive a share link.
  assert.equal(validConfig({ ...defaultConfig, accessories: ['not-a-thing'] }), false);
  assert.equal(validConfig({ ...defaultConfig, accessories: 'cable-tray' }), false, 'a string is not a list');
  assert.deepEqual(cleanConfig({ ...defaultConfig, accessories: ['cable-tray', 'cable-tray', 'nope'] }).accessories,
    ['cable-tray'], 'duplicates and unknowns are stripped');
  assert.deepEqual(cleanConfig({ ...defaultConfig, size: '72x30', accessories: ['monitor-arm', 'logitech-lift', 'monitor-arm-2'] }).accessories,
    ['logitech-lift', 'monitor-arm-2'], 'restored builds replace the old monitor mount while preserving other accessories');

  // Every accessory must price and fit at least one size.
  for (const item of ACCESSORIES) {
    assert.ok(Number.isFinite(item.price) && item.price > 0, `${item.id} has a price`);
    assert.ok(item.compatibleSizes.length > 0, `${item.id} fits at least one size`);
    assert.ok(item.compatibleSizes.every(size => Object.hasOwn(PRODUCT_CONFIG.sizes, size)),
      `${item.id} only lists real sizes`);
  }

  console.log('Catalog pricing, accessories, presets, validation, and formatting passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
