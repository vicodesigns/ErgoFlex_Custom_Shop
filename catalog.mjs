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

// Per-species grain description. Real tileable photography is the right answer
// and is still a content dependency; until it exists these drive a procedural
// generator, which at least gives each species its own ring spacing, contrast
// and colour rather than tinting one birch photograph eight ways.
//
// `repeatsPerInch` is the point of the whole table: grain scale is physical, so
// the number of texture repeats has to be derived from the surface's size in
// inches. A fixed repeat makes the grain grow with the desk.
export const WOOD_SPECIES = {
    'Natural Birch': { photo: './bir.jpg', repeatsPerInch: 1 / 32, ringSpacing: 26, contrast: 0.10, warm: '#e8d9bd', dark: '#cbb894', figure: 0.35 },
    'White Oak':     { repeatsPerInch: 1 / 30, ringSpacing: 20, contrast: 0.20, warm: '#d8c49c', dark: '#a98f63', figure: 0.85 },
    'Walnut':        { repeatsPerInch: 1 / 34, ringSpacing: 30, contrast: 0.26, warm: '#7a5334', dark: '#4a3220', figure: 0.55 },
    'Black Ash':     { repeatsPerInch: 1 / 28, ringSpacing: 18, contrast: 0.30, warm: '#4a4441', dark: '#241f1d', figure: 0.75 },
    'Cherry':        { repeatsPerInch: 1 / 36, ringSpacing: 34, contrast: 0.14, warm: '#b16a45', dark: '#8a4c2e', figure: 0.30 },
    'Maple':         { repeatsPerInch: 1 / 38, ringSpacing: 40, contrast: 0.08, warm: '#e6d3ae', dark: '#cdb68d', figure: 0.20 },
    'Mahogany':      { repeatsPerInch: 1 / 34, ringSpacing: 28, contrast: 0.18, warm: '#7d3f2c', dark: '#57271a', figure: 0.45 },
    'Bamboo':        { repeatsPerInch: 1 / 20, ringSpacing: 12, contrast: 0.16, warm: '#d9c391', dark: '#b39b66', figure: 0.05 }
};

export function woodSpecies(name) {
    return WOOD_SPECIES[name] || WOOD_SPECIES['Natural Birch'];
}

// Surface treatments, by material role rather than one set for everything.
// applySurfaceFinish used to apply a single roughness/clearcoat pair to wood and
// silently overwrite the constructor's values; these are the values it applies
// per role, so the constructor and the runtime cannot drift apart.
export const SURFACE_TREATMENTS = {
    wood:      { matte: { roughness: 0.68, clearcoat: 0.08 }, satin: { roughness: 0.40, clearcoat: 0.25 }, gloss: { roughness: 0.20, clearcoat: 0.65 } },
    // Powder coat is a baked polymer: no clearcoat, and it stays fairly matte
    // even in the "gloss" option.
    powder:    { matte: { roughness: 0.72, clearcoat: 0.0 },  satin: { roughness: 0.55, clearcoat: 0.05 }, gloss: { roughness: 0.38, clearcoat: 0.15 } },
    // Brushed aluminium: fully metallic, and the brushing direction is what
    // makes it read as brushed rather than polished.
    aluminium: { matte: { roughness: 0.46, clearcoat: 0.0 },  satin: { roughness: 0.30, clearcoat: 0.0 },  gloss: { roughness: 0.14, clearcoat: 0.0 } },
    plastic:   { matte: { roughness: 0.62, clearcoat: 0.0 },  satin: { roughness: 0.45, clearcoat: 0.0 },  gloss: { roughness: 0.28, clearcoat: 0.2 } }
};

// Accessories.
//
// These prices are PROVISIONAL. They are marked as such and shown as
// "indicative" in the UI, because this is a design prototype and no accessory
// pricing has been confirmed by the manufacturer. Do not silently drop the flag
// to make the estimate look firmer than it is.
//
// `node` names a mesh family in the GLB. Where none exists the accessory is a
// priced line item and the UI says it is not shown in 3D, rather than pretending.
export const ACCESSORIES = [
    { id: 'cable-tray',    name: 'Under-desk cable tray',   price: 89,  provisional: true, compatibleSizes: ['48x30', '60x30', '72x30'], node: null },
    { id: 'monitor-arm',   name: 'Single monitor arm',      price: 179, provisional: true, compatibleSizes: ['48x30', '60x30', '72x30'], node: null },
    { id: 'monitor-arm-2', name: 'Dual monitor arm',        price: 289, provisional: true, compatibleSizes: ['60x30', '72x30'], node: null,
      note: 'Needs a 60in or wider top for the mounting spread.' },
    { id: 'cpu-holder',    name: 'CPU holder',              price: 129, provisional: true, compatibleSizes: ['48x30', '60x30', '72x30'], node: null },
    { id: 'led-strip',     name: 'Under-surface LED strip', price: 69,  provisional: true, compatibleSizes: ['48x30', '60x30', '72x30'], node: 'Leds' },
    { id: 'foot-rest',     name: 'Adjustable foot rest',    price: 99,  provisional: true, compatibleSizes: ['48x30', '60x30', '72x30'], node: 'Foot_Rest' }
];

export function accessory(id) { return ACCESSORIES.find(a => a.id === id) || null; }

export function accessoryFits(id, size) {
    const item = accessory(id);
    return Boolean(item && item.compatibleSizes.includes(size));
}

// Curated starting points. Each is a complete configuration, so applying one
// leaves nothing half-set.
export const PRESETS = [
    { id: 'compact', name: 'Compact workspace',
      blurb: 'The smallest top, a light frame, and just the cable management.',
      size: '48x30', woodFinish: 'Maple', baseFinish: 'White',
      accessories: ['cable-tray'], cameraPreset: 'hero' },
    { id: 'creative', name: 'Creative studio',
      blurb: 'A wide walnut surface with dual monitors and task lighting.',
      size: '72x30', woodFinish: 'Walnut', baseFinish: 'Space Gray',
      accessories: ['monitor-arm-2', 'led-strip', 'cable-tray'], cameraPreset: 'hero' },
    { id: 'standing', name: 'Standing workstation',
      blurb: 'Mid-width oak set up for a full day on your feet.',
      size: '60x30', woodFinish: 'White Oak', baseFinish: 'Navy',
      accessories: ['monitor-arm', 'foot-rest', 'cable-tray'], cameraPreset: 'front' }
];

export const money = value => '$' + value.toLocaleString('en-US');

// Every price in the app comes from here. Callers must pass a config explicitly;
// there is deliberately no default, because the "current" configuration is
// mutable state owned by studio.js and a default would smuggle it in here.
// Unknown finish or size names contribute nothing rather than throwing, so a
// stale saved build degrades to a low estimate instead of a blank page.
export function configurationPrice(config) {
    return priceBreakdown(config).reduce((total, line) => total + line.price, 0);
}

// Itemised, so the headline price, the cart row, and the estimate can all show
// the same lines rather than three views of one opaque number.
export function priceBreakdown(config) {
    const lines = [{ label: 'ErgoFlex desk', price: PRODUCT_CONFIG.basePrice }];
    if (!config) return lines;

    const size = PRODUCT_CONFIG.sizes[config.size];
    if (size && size.price) lines.push({ label: size.name, price: size.price });

    const wood = PRODUCT_CONFIG.woodFinishes.find(f => f.name === config.woodFinish);
    if (wood && wood.price) lines.push({ label: wood.name + ' desktop', price: wood.price });

    const base = PRODUCT_CONFIG.baseFinishes.find(f => f.name === config.baseFinish);
    if (base && base.price) lines.push({ label: base.name + ' frame', price: base.price });

    for (const id of config.accessories || []) {
        const item = accessory(id);
        if (item) lines.push({ label: item.name, price: item.price, provisional: item.provisional });
    }
    return lines;
}

// The validation boundary for share links and restored local storage. Keep it
// strict: it is the only thing standing between a URL and the rendered config.
export function validConfig(value) {
    if (!value || !Object.hasOwn(PRODUCT_CONFIG.sizes, value.size)) return false;
    if (!PRODUCT_CONFIG.woodFinishes.some(f => f.name === value.woodFinish)) return false;
    if (!PRODUCT_CONFIG.baseFinishes.some(f => f.name === value.baseFinish)) return false;
    // Accessories are optional, but if present must be an array of known ids.
    // A V1 payload has no accessories key at all and is still valid.
    if (value.accessories !== undefined) {
        if (!Array.isArray(value.accessories)) return false;
        if (!value.accessories.every(id => typeof id === 'string' && accessory(id))) return false;
    }
    return true;
}

// The whitelist, and the only place a stored or shared configuration is
// normalised. A V1 payload becomes a valid V2 with an empty accessory list.
export function cleanConfig(value) {
    const accessories = Array.isArray(value.accessories)
        ? [...new Set(value.accessories.filter(id => accessory(id)))]
        : [];
    return { size: value.size, woodFinish: value.woodFinish, baseFinish: value.baseFinish, accessories };
}

// Accessories that no longer fit the chosen size. Returned rather than silently
// dropped, so the UI can say what it removed and why.
export function incompatibleAccessories(config) {
    return (config.accessories || [])
        .filter(id => !accessoryFits(id, config.size))
        .map(id => accessory(id))
        .filter(Boolean);
}
