// Electrical counts are verified for Desk 02, not universal desktop-size counts.
// Geometry assignments/endpoints remain provisional until the diagnostic is checked.
export const LED_STRIP_MAP_VERSION = 'desk02-recorded-endpoints-20261003';
export const LED_STRIPS = Object.freeze([
    { id: 0, name: 'Top Shelf Top', count: 14, layer: 0, mesh: 40, axis: 'z', rig: 'lift' },
    { id: 1, name: 'Top Shelf Bottom Back', count: 14, layer: 1, mesh: 41, axis: 'z', rig: 'lift' },
    { id: 2, name: 'Top Shelf Bottom Front', count: 15, layer: 1, mesh: 42, axis: 'z', rig: 'lift' },
    { id: 3, name: 'Second Shelf', count: 14, layer: 2, mesh: 39, axis: 'z', rig: 'lift' },
    { id: 4, name: 'Desk Top Center', count: 14, layer: 3, mesh: 2, axis: 'z', rig: 'tilt' },
    { id: 5, name: 'Desktop Left', count: 11, layer: 3, mesh: 1, axis: 'x', rig: 'tilt' },
    { id: 6, name: 'Desktop Right', count: 11, layer: 3, mesh: 0, axis: 'x', rig: 'tilt' },
    { id: 7, name: 'Foot Rest', count: 13, layer: 4, mesh: 38, axis: 'z', rig: 'base' }
].map(strip => Object.freeze({ ...strip, reverse: [0,1,2,3,7].includes(strip.id), visibleAddresses: null, verified: false,
    endpointSource: 'operator calibration 2026-10-01T22:51:29',
    zeroEndpoint: strip.axis === 'x' ? 'back / X minimum' : strip.id === 4 ? 'left / Z minimum' : 'right / Z maximum' })));

export function validateStripMap(strips) {
    if (!Array.isArray(strips) || strips.length !== 8) throw new Error('Expected eight physical strips.');
    const ids = new Set();
    for (const strip of strips) {
        if (!Number.isInteger(strip.id) || strip.id < 0 || strip.id > 7 || ids.has(strip.id)) throw new Error('Invalid strip ID.');
        ids.add(strip.id);
        if (!Number.isInteger(strip.count) || strip.count < 1 || strip.count > 256) throw new Error('Invalid strip count (1–256).');
        if (strip.visibleAddresses !== null && (!Array.isArray(strip.visibleAddresses) || !strip.visibleAddresses.length ||
            strip.visibleAddresses.some(p => !Number.isInteger(p) || p < 0 || p >= strip.count) ||
            new Set(strip.visibleAddresses).size !== strip.visibleAddresses.length)) throw new Error('Invalid visible address map.');
        if (!['x', 'z'].includes(strip.axis)) throw new Error('Invalid strip path axis.');
    }
    return strips;
}

export function visibleAddresses(strip) {
    return strip.visibleAddresses ?? Array.from({ length: strip.count }, (_, i) => i);
}

export function createLedFrame(strips = LED_STRIPS) {
    validateStripMap(strips);
    return strips.map(strip => new Uint8Array(strip.count * 4));
}

export function sampleLedDiagnostic(frame, strips, state) {
    frame.forEach(row => row.fill(0));
    if (!state || state.strip === null) return;
    const index = strips.findIndex(strip => strip.id === state.strip);
    if (index < 0) return;
    const row = frame[index], count = strips[index].count;
    if (state.pixel !== null && (!Number.isInteger(state.pixel) || state.pixel < 0 || state.pixel >= count)) return;
    const first = state.pixel ?? 0, last = state.pixel === null ? count : first + 1;
    for (let p = first; p < last; p++) row.set([255, 255, 255, 0], p * 4);
}
