// Pure catalog and pricing data. No DOM, no Three.js, no module-level mutable
// state — so the same source is imported by studio.js in the browser and by the
// test suite in Node. Anything that touches the scene or the page belongs in
// studio.js instead.

export const PRODUCT_CONFIG = {
    basePrice: 1299,
    modelUrl: 'https://ergoflexdesk.com/Store/model/full.glb',
    sizes: {
        '48x30': { price: 0, name: '48" × 30"' },
        '60x30': { price: 200, name: '60" × 30"' },
        '72x30': { price: 400, name: '72" × 30"' }
    },
    woodFinishes: [
        { name: "Natural Birch", color: "#e6c998", price: 0, isDefault: true },
        { name: "White Oak", color: "#e0d6c8", price: 50 },
        { name: "Walnut", color: "#5c4033", price: 100 },
        { name: "Black Ash", color: "#2a2a2a", price: 75 },
        { name: "Cherry", color: "#a45a31", price: 125 },
        { name: "Maple", color: "#e8cda1", price: 75 },
        { name: "Mahogany", color: "#8b3a20", price: 150 },
        { name: "Bamboo", color: "#d2b875", price: 100 }
    ],
    baseFinishes: [
        { name: "White", color: "#f8f8f8", price: 0, isDefault: true },
        { name: "Black", color: "#1C1C1E", price: 0 },
        { name: "Silver", color: "#a0a0a5", price: 25 },
        { name: "Space Gray", color: "#5c5c60", price: 25 },
        { name: "Forest", color: "#344b40", price: 50 },
        { name: "Sand", color: "#c5b59c", price: 50 },
        { name: "Navy", color: "#273c55", price: 50 },
        { name: "Terracotta", color: "#a45c47", price: 50 }
    ]
};

export const money = value => '$' + value.toLocaleString('en-US');

// Every price in the app comes from here. Callers must pass a config explicitly;
// there is deliberately no default, because the "current" configuration is
// mutable state owned by studio.js and a default would smuggle it in here.
// Unknown finish or size names contribute nothing rather than throwing, so a
// stale saved build degrades to a low estimate instead of a blank page.
export function configurationPrice(config) {
    if (!config) return PRODUCT_CONFIG.basePrice;
    const size = PRODUCT_CONFIG.sizes[config.size];
    const wood = PRODUCT_CONFIG.woodFinishes.find(f => f.name === config.woodFinish);
    const base = PRODUCT_CONFIG.baseFinishes.find(f => f.name === config.baseFinish);
    return PRODUCT_CONFIG.basePrice + (size ? size.price : 0) + (wood ? wood.price : 0) + (base ? base.price : 0);
}

// The validation boundary for share links and restored local storage. Keep it
// strict: it is the only thing standing between a URL and the rendered config.
export function validConfig(value) {
    return Boolean(value && Object.hasOwn(PRODUCT_CONFIG.sizes, value.size)
        && PRODUCT_CONFIG.woodFinishes.some(f => f.name === value.woodFinish)
        && PRODUCT_CONFIG.baseFinishes.some(f => f.name === value.baseFinish));
}

export function cleanConfig(value) {
    return { size: value.size, woodFinish: value.woodFinish, baseFinish: value.baseFinish };
}
