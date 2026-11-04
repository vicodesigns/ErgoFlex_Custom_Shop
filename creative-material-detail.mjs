import * as THREE from 'three';

// Millimetres, shared only within one room rebuild. Finish grain follows a
// second UV set so original artwork, floorboards and labels retain their UVs.
const FINISHES = {
    oak: { period: 240, relief: .16, roughness: .8, metalness: 0 },
    walnut: { period: 220, relief: .1, roughness: .74, metalness: 0 },
    paintedWood: { period: 180, relief: .025, roughness: .73, metalness: 0 },
    textile: { period: 14, relief: .12, roughness: .98, metalness: 0 },
    powder: { period: 55, relief: .025, roughness: .68, metalness: 0 },
    plastic: { period: 45, relief: .012, roughness: .6, metalness: 0 },
    ceramic: { period: 55, relief: .008, roughness: .32, metalness: 0 },
    terracotta: { period: 75, relief: .065, roughness: .88, metalness: 0 },
    plaster: { period: 100, relief: .14, roughness: .97, metalness: 0 },
    limestone: { period: 140, relief: .045, roughness: .75, metalness: 0 },
    marble: { period: 160, relief: .012, roughness: .39, metalness: 0 },
    leather: { period: 30, relief: .055, roughness: .66, metalness: 0 },
    rubber: { period: 45, relief: .035, roughness: .92, metalness: 0 },
    brushed: { period: 95, relief: .01, roughness: .39, metalness: .92 }
};
const noise = (x, y) => {
    let n = Math.imul(x + 41, 374761393) ^ Math.imul(y + 73, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0) / 4294967295;
};

function maps(kind, spec) {
    const size = 128, heights = new Float32Array(size * size);
    const normal = new Uint8Array(size * size * 4), roughness = normal.slice(), color = normal.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const a = x / size * Math.PI * 2, b = y / size * Math.PI * 2, n = noise(x, y);
        let h = .5 + (n - .5) * .24;
        if (['oak', 'walnut', 'paintedWood'].includes(kind)) h = .5 + .2 * Math.sin(a * 17 + .65 * Math.sin(b * 2)) + .07 * Math.sin(a * 47 + Math.sin(b)) + (n - .5) * .08;
        if (kind === 'textile') h = .5 + .17 * Math.cos(a * 16) + .17 * Math.cos(b * 16) + (n - .5) * .1;
        if (kind === 'leather') h = .5 + (n - .5) * .28 + .08 * Math.sin(a * 8 + Math.sin(b * 11));
        if (kind === 'brushed') h = .5 + .13 * Math.sin(a * 49) + (n - .5) * .06;
        heights[y * size + x] = h;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const index = y * size + x, at = index * 4, h = heights[index], step = spec.period / size;
        const dx = (heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size]) * spec.relief / (2 * step);
        const dy = (heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]) * spec.relief / (2 * step);
        const n = new THREE.Vector3(-dx, -dy, 1).normalize();
        normal[at] = Math.round((n.x * .5 + .5) * 255); normal[at + 1] = Math.round((n.y * .5 + .5) * 255); normal[at + 2] = Math.round((n.z * .5 + .5) * 255); normal[at + 3] = 255;
        roughness[at] = roughness[at + 1] = roughness[at + 2] = Math.round(228 + h * 27); roughness[at + 3] = 255;
        color[at] = color[at + 1] = color[at + 2] = Math.round(225 + h * 30); color[at + 3] = 255;
    }
    const map = (data, srgb = false) => {
        const t = new THREE.DataTexture(data, size, size); t.channel = 1;
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
    };
    return { normal: map(normal), roughness: map(roughness), color: ['oak', 'walnut'].includes(kind) ? map(color, true) : null };
}

export function creativeMaterialDetail(root, entries) {
    const mapped = new Map(), specs = new Map();
    for (const [mat, kind] of entries) {
        if (!mat) continue;
        const spec = FINISHES[kind]; if (!spec) continue;
        if (!mapped.has(kind)) {
            const detail = maps(kind, spec); mapped.set(kind, detail);
            root.ownedTextures ||= []; root.ownedTextures.push(...Object.values(detail).filter(Boolean));
        }
        const detail = mapped.get(kind);
        mat.normalMap = detail.normal; mat.roughnessMap = detail.roughness;
        if (!mat.map && detail.color) mat.map = detail.color;
        mat.roughness = spec.roughness; mat.metalness = spec.metalness;
        mat.userData.roomFinishLocked = true; mat.userData.roomDetailAuthored = true;
        mat.userData.authoredFinish = kind; mat.needsUpdate = true; specs.set(mat, spec);
    }
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), p = new THREE.Vector3(), n = new THREE.Vector3();
    root.traverse(obj => {
        const spec = specs.get(obj.material);
        if (!obj.isMesh || !spec) return;
        if (obj.isInstancedMesh) {
            // One instanced primitive cannot hold world UVs for every copy.
            // Keep its material values while the individual pieces stay flat.
            const original = obj.material, copy = original.clone();
            copy.normalMap = null; copy.roughnessMap = null;
            if (copy.map?.channel === 1) copy.map = null;
            obj.material = copy; return;
        }
        const g = obj.geometry, pos = g.attributes.position, nor = g.attributes.normal;
        if (!pos || !nor) return;
        const transform = inverse.clone().multiply(obj.matrixWorld), normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i).applyMatrix4(transform); n.fromBufferAttribute(nor, i).applyMatrix3(normalTransform);
            const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
            const pair = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y];
            uv[i * 2] = pair[0] / spec.period; uv[i * 2 + 1] = pair[1] / spec.period;
        }
        g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    });
    root.userData.authoredCreativeFinishes = [...mapped.keys()];
}
