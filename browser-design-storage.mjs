// Store each embedded image once per record. Exported project files remain
// ordinary, self-contained JSON; this encoding is only for browser storage.
const FORMAT = 'ergoflex-image-pool-v1';
const OBJECT_FORMAT = 'ergoflex-object-pool-v1';
const DESIGN_KEYS = ['ergoflex.buildPresetsV1', 'ergoflexProjectAutosaveV1', 'ergoflexSavedBuildV2', 'ergoflexCartV2', 'ergoflex.sceneDesksV1', 'ergoflex.sceneDesksBySizeV2'];

function encodeImagePool(value) {
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

export function encodeStoredJSON(value) {
    const plain=JSON.stringify(value),data=JSON.parse(plain),counts=new Map(),signatures=new WeakMap();
    const count=node=>{
        if(!node||typeof node!=='object')return;
        const signature=JSON.stringify(node);
        if(signature.length>=256){signatures.set(node,signature);counts.set(signature,(counts.get(signature)||0)+1);}
        Object.values(node).forEach(count);
    };
    count(data);
    const objects=[],references=[],indices=new Map();
    const visit=(node,path)=>{
        for(const key of Object.keys(node)){
            const child=node[key];if(!child||typeof child!=='object')continue;
            const signature=signatures.get(child),at=[...path,key];
            if(signature&&counts.get(signature)>1){
                let index=indices.get(signature);
                if(index===undefined){index=objects.length;indices.set(signature,index);objects.push(child);references.push([]);}
                references[index].push(at);node[key]=null;
            }else visit(child,at);
        }
    };
    if(data&&typeof data==='object')visit(data,[]);
    const imagesOnly=encodeImagePool(value);
    if(!objects.length)return imagesOnly;
    const pooled=encodeImagePool({format:OBJECT_FORMAT,data,objects,references});
    return pooled.length<imagesOnly.length?pooled:imagesOnly;
}

export function decodeStoredJSON(raw) {
    let record = JSON.parse(raw);
    if(record?.format===FORMAT)record=decodeImagePool(record);
    if(record?.format!==OBJECT_FORMAT)return record;
    const {data,objects,references}=record;
    if(!data||typeof data!=='object'||!Array.isArray(objects)||!Array.isArray(references)||objects.length!==references.length)throw new Error('Invalid object pool');
    objects.forEach((object,index)=>{
        if(!object||typeof object!=='object'||!Array.isArray(references[index]))throw new Error('Invalid stored object');
        for(const path of references[index]){
            if(!Array.isArray(path)||!path.length)throw new Error('Invalid object location');
            let node=data;
            path.forEach((key,offset)=>{
                if(typeof key!=='string'||!node||typeof node!=='object'||!Object.hasOwn(node,key))throw new Error('Missing object location');
                if(offset===path.length-1){
                    if(node[key]!==null)throw new Error('Invalid object placeholder');
                    Object.defineProperty(node,key,{value:JSON.parse(JSON.stringify(object)),writable:true,enumerable:true,configurable:true});
                }else node=node[key];
            });
        }
    });
    return data;
}
function decodeImagePool(record) {
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
