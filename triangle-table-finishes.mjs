import * as THREE from 'three';

export const TRIANGLE_TABLES = {
    'ergoflex-triangle-table': 'wood-steel',
    'ergoflex-triangle-table-acrylic': 'acrylic'
};

function surfaceTexture(kind) {
    const size = 256, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const noise = ((x * 73 + y * 151 + x * y * 17) % 41) / 41 - .5;
        const wave = Math.sin(y * .19 + Math.sin(x * .024) * 1.8 + Math.sin(y * .049));
        const fibre = Math.sin(y * 1.9 + Math.sin(x * .018) * 2);
        const i = (y * size + x) * 4;
        if (kind === 'oak') {
            const grain = wave * 9 + fibre * 3 + noise * 4;
            data[i] = 176 + grain; data[i + 1] = 140 + grain; data[i + 2] = 98 + grain * .75;
        } else {
            const brushed = 185 + Math.sin(y * 2.1) * 14 + noise * 8;
            data[i] = data[i + 1] = data[i + 2] = brushed;
        }
        data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
    if (kind === 'oak') texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// This supplied model has no UVs. Project each face in its dominant plane so
// the top gets continuous grain and the vertical frame gets fine brushing.
function texturedGeometry(source) {
    const geometry = source.clone(), p = geometry.attributes.position, n = geometry.attributes.normal;
    geometry.computeBoundingBox(); const b = geometry.boundingBox, size = b.getSize(new THREE.Vector3());
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        const point = [p.getX(i), p.getY(i), p.getZ(i)];
        const a = nx > ny && nx > nz ? 2 : 0, c = ny >= nx && ny >= nz ? 2 : 1;
        uv[i * 2] = (point[a] - b.min.getComponent(a)) / Math.max(size.getComponent(a), .001);
        uv[i * 2 + 1] = (point[c] - b.min.getComponent(c)) / Math.max(size.getComponent(c), .001);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
}

// Applied to every fresh instance, including user-added library items. Nothing
// is written into the cached GLB, and the original editor identity stays valid.
export function finishTriangleTable(object, id) {
    const variant = TRIANGLE_TABLES[id]; if (!variant) return;
    const wood = variant === 'wood-steel' ? surfaceTexture('oak') : null;
    const brush = surfaceTexture('steel');
    const steel = new THREE.MeshStandardMaterial({ name: 'Triangle brushed steel', color: '#c4cdd2', metalness: .92, roughness: .43, roughnessMap: brush, side: THREE.DoubleSide });
    const top = variant === 'wood-steel'
        ? new THREE.MeshPhysicalMaterial({ name: 'Triangle natural oak', color: '#ffffff', map: wood, roughness: .44, clearcoat: .18, clearcoatRoughness: .4, side: THREE.DoubleSide })
        : new THREE.MeshPhysicalMaterial({ name: 'Triangle clear acrylic', color: '#e1f0f1', transmission: .86, roughness: .12, ior: 1.49, thickness: .012, attenuationColor: '#d3e9e7', attenuationDistance: .7, clearcoat: 1, clearcoatRoughness: .08, side: THREE.DoubleSide });
    const frame = variant === 'wood-steel' ? steel : top.clone();
    if (variant === 'acrylic') { frame.name = 'Triangle acrylic frame'; frame.thickness = .016; frame.roughness = .16; }
    object.traverse(mesh => {
        if (!mesh.isMesh) return;
        const material = mesh.material?.name === 'Material_0' ? top : mesh.material?.name === 'Material_14' ? frame : steel;
        mesh.geometry = texturedGeometry(mesh.geometry); mesh.material = material;
        // These meshes now own their copies; standard room disposal releases
        // their materials, maps and geometry exactly once.
        mesh.userData.sharedProp = false; mesh.castShadow = !material.transmission;
        material.userData.roomPropFinish = true;
    });
    object.userData.triangleFinish = variant;
}
