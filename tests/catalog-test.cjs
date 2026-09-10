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
  assert.deepEqual(Object.keys(clean).sort(), ['baseFinish', 'size', 'woodFinish'],
    'only the three known keys survive');
  assert.equal(clean.evil, undefined, 'unknown keys are dropped');
  assert.equal({}.polluted, undefined, 'no prototype pollution');

  // --- money ---
  assert.equal(money(1299), '$1,299', 'thousands separator');
  assert.equal(money(0), '$0', 'zero formats');
  assert.equal(money(1299999), '$1,299,999', 'large values format');

  console.log('Catalog pricing, validation, and formatting passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
