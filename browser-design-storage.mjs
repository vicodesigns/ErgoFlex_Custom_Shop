// Store each embedded image once per record. Exported project files remain
// ordinary, self-contained JSON; this encoding is only for browser storage.
const FORMAT = 'ergoflex-image-pool-v1';
const DESIGN_KEYS = ['ergoflex.buildPresetsV1', 'ergoflexProjectAutosaveV1', 'ergoflexSavedBuildV2', 'ergoflexCartV2'];

export function encodeStoredJSON(value) {
    const plain = JSON.stringify(value);
    const data = JSON.parse(plain), images = [], references = [], indices = new Map();
    const visit = (node, path) => {
        for (const key of Object.keys(node)) {
            const item = node[key], at = [...path, key];
            if (typeof item === 'string' && item.length > 256 && item.startsWith('data:image/')) {
                let index = indices.get(item);
                if (index === undefined) {
                    index = images.length; indices.set(item, index); images.push(item); references.push([]);
                }
                references[index].push(at); node[key] = '';
            } else if (item && typeof item === 'object') visit(item, at);
        }
    };
    if (data && typeof data === 'object') visit(data, []);
    if (!images.length) return plain;
    const packed = JSON.stringify({ format: FORMAT, data, images, references });
    return packed.length < plain.length ? packed : plain;
}

export function decodeStoredJSON(raw) {
    const record = JSON.parse(raw);
    if (record?.format !== FORMAT) return record;
    const {data, images, references} = record;
    if (!data || typeof data !== 'object' || !Array.isArray(images) || !Array.isArray(references) || images.length !== references.length) throw new Error('Invalid image pool');
    images.forEach((image, index) => {
        if (typeof image !== 'string' || !image.startsWith('data:image/') || !Array.isArray(references[index])) throw new Error('Invalid stored image');
        for (const path of references[index]) {
            if (!Array.isArray(path) || !path.length) throw new Error('Invalid image location');
            let node = data;
            path.forEach((key, offset) => {
                if (typeof key !== 'string' || !node || typeof node !== 'object' || !Object.hasOwn(node, key)) throw new Error('Missing image location');
                if (offset === path.length - 1) {
                    if (node[key] !== '') throw new Error('Invalid image placeholder');
                    // Define an own property even for a JSON key named __proto__.
                    Object.defineProperty(node, key, {value:image, writable:true, enumerable:true, configurable:true});
                } else node = node[key];
            });
        }
    });
    return data;
}

// Replace only with a smaller, losslessly decoded equivalent. setItem is atomic:
// a denied write leaves the previous recovery record intact.
export function compactStoredDesigns(storage) {
    const result = {records:0, freed:0, errors:0};
    for (const key of DESIGN_KEYS) {
        try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            const packed = encodeStoredJSON(decodeStoredJSON(raw));
            if (packed.length >= raw.length) continue;
            storage.setItem(key, packed);
            result.records++; result.freed += raw.length - packed.length;
        } catch { result.errors++; }
    }
    return result;
}
