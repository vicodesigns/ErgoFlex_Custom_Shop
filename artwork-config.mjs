// Portable artwork recipes. Images are embedded raster assets, never remote URLs.
export const ARTWORK_SURFACES = [
    { id: 'desktop', label: 'Desktop' },
    { id: 'left-panel', label: 'Left side panel' },
    { id: 'right-panel', label: 'Right side panel' },
    { id: 'upper-shelf', label: 'Top shelf' },
    { id: 'lower-shelf', label: 'Lower shelf' },
    { id: 'base-shelf', label: 'Bottom shelf' },
    { id: 'desktop-crossbar', label: 'Desktop front crossbar', group: 'Crossbars & footrest' },
    { id: 'footrest-panel', label: 'Footrest / footer crossbar', group: 'Crossbars & footrest' },
    { id: 'shelf-back', label: 'Shelf back panel · outside', group: 'Shelf panels' },
    { id: 'shelf-left-panel', label: 'Left shelf side panel · outside', group: 'Shelf panels' },
    { id: 'shelf-right-panel', label: 'Right shelf side panel · outside', group: 'Shelf panels' },
    { id: 'left-leg-panel', label: 'Left leg panel · outside', group: 'Leg panels & feet' },
    { id: 'right-leg-panel', label: 'Right leg panel · outside', group: 'Leg panels & feet' },
    { id: 'left-foot', label: 'Left foot · top', group: 'Leg panels & feet' },
    { id: 'right-foot', label: 'Right foot · top', group: 'Leg panels & feet' },
    { id: 'left-column-upper', label: 'Left lift column · upper outside', group: 'Lift columns' },
    { id: 'right-column-upper', label: 'Right lift column · upper outside', group: 'Lift columns' },
    { id: 'left-column-center', label: 'Left lift column · middle outside', group: 'Lift columns' },
    { id: 'right-column-center', label: 'Right lift column · middle outside', group: 'Lift columns' },
    { id: 'left-column-lower', label: 'Left lift column · lower outside', group: 'Lift columns' },
    { id: 'right-column-lower', label: 'Right lift column · lower outside', group: 'Lift columns' }
];
export const ARTWORK_MAX_IMAGE_CHARS = 700000;
export const ARTWORK_MAX_TOTAL_CHARS = 3600000;
export const ARTWORK_MAX_LAYERS_PER_KIND = 8;
// Keep the original logo/texture keys so saved single-image builds still load.
export const artworkLayerKind = key => /^(logo|texture)(?:-[2-8])?$/.exec(key)?.[1];
export function artworkLayers(surface = {}, kind) {
    return Object.entries(surface).filter(([key]) => artworkLayerKind(key) && (!kind || artworkLayerKind(key) === kind))
        .sort(([a], [b]) => (artworkLayerKind(a) === 'texture' ? 0 : 100) + Number(a.split('-')[1] || 1)
            - (artworkLayerKind(b) === 'texture' ? 0 : 100) - Number(b.split('-')[1] || 1));
}
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const imageData = value => typeof value === 'string' && value.length <= ARTWORK_MAX_IMAGE_CHARS
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);
const number = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function defaultArtworkLayer(kind) {
    return { name: '', image: '', enabled: true, coverage: kind === 'texture' ? 'wrap' : 'decal',
        repeat: kind === 'texture' ? 'grid' : 'single', scale: kind === 'texture' ? 50 : 30,
        x: 50, y: 50, rotation: 0, spacing: kind === 'texture' ? 0 : 20, opacity: 100 };
}

export function validArtwork(value) {
    if (!plain(value) || value.version !== 1 || !plain(value.surfaces)) return false;
    let total = 0;
    for (const [id, surface] of Object.entries(value.surfaces)) {
        if (!ARTWORK_SURFACES.some(s => s.id === id) || !plain(surface)) return false;
        for (const [key, layer] of Object.entries(surface)) {
            if (!artworkLayerKind(key) || !plain(layer) || !imageData(layer.image)) return false;
            total += layer.image.length;
            if (typeof layer.name !== 'string' || layer.name.length > 160) return false;
            if (layer.coverage !== undefined && !['wrap', 'decal'].includes(layer.coverage)) return false;
            if (layer.repeat !== undefined && !['single', 'grid', 'offset', 'cover'].includes(layer.repeat)) return false;
            if (layer.enabled !== undefined && typeof layer.enabled !== 'boolean') return false;
            for (const key of ['scale', 'x', 'y', 'rotation', 'spacing', 'opacity'])
                if (layer[key] !== undefined && !Number.isFinite(layer[key])) return false;
        }
    }
    return total <= ARTWORK_MAX_TOTAL_CHARS;
}

export function cleanArtwork(value) {
    const out = { version: 1, surfaces: {} };
    if (!validArtwork(value)) return out;
    for (const { id } of ARTWORK_SURFACES) {
        const surface = value.surfaces[id];
        if (!surface) continue;
        const layers = {};
        for (const [key, layer] of artworkLayers(surface)) {
            const kind = artworkLayerKind(key);
            layers[key] = { ...defaultArtworkLayer(kind), name: layer.name, image: layer.image,
                enabled: layer.enabled !== false, coverage: layer.coverage || defaultArtworkLayer(kind).coverage,
                repeat: layer.repeat || defaultArtworkLayer(kind).repeat,
                scale: number(layer.scale, kind === 'texture' ? 50 : 30, 5, 300),
                x: number(layer.x, 50, -100, 200), y: number(layer.y, 50, -100, 200),
                rotation: number(layer.rotation, 0, -180, 180), spacing: number(layer.spacing, kind === 'texture' ? 0 : 20, 0, 150),
                opacity: number(layer.opacity, 100, 0, 100) };
        }
        if (Object.keys(layers).length) out.surfaces[id] = layers;
    }
    return out;
}

export function artworkSummary(value) {
    const artwork = cleanArtwork(value);
    return ARTWORK_SURFACES.flatMap(({ id, label }) => {
        const layers = artworkLayers(artwork.surfaces[id]).filter(([, l]) => l.enabled);
        return layers.length ? [`${label}: ${layers.map(([key, l]) => `${artworkLayerKind(key) === 'logo' ? 'Graphic' : 'Texture'} · ${l.coverage === 'wrap' ? 'full wrap' : 'removable decal'}`).join(' + ')}`] : [];
    });
}
