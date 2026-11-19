import * as THREE from 'three';

// All OCC postures use the same MakeHuman UVs, including the animated models.
// The eight tiles follow the order used to bake the original MPFB hairstyles.
const cuts = ['ponytail01', 'afro01', 'short01', 'short04', 'braid01', 'short02', 'bob01', 'long01'];

export function prepareMediaCast(room, root) {
    const loader = new THREE.TextureLoader();
    const loads = [];
    const owned = root.ownedTextures ??= [];

    function map(name) {
        const url = new URL('./assets/rooms/media/' + name + '.webp', import.meta.url);
        let texture;
        loads.push(new Promise(resolve => {
            texture = loader.load(url.href, resolve, undefined, () => {
                if (room.root === root) room.missingProps.push(name);
                resolve();
            });
        }));
        texture.flipY = false;
        texture.anisotropy = 4;
        owned.push(texture);
        return texture;
    }

    // Each 512-pixel tile has a four-pixel guard band on every side.
    function tile(atlas, i) {
        const texture = atlas.clone();
        texture.repeat.set(504 / 2048, 504 / 1024);
        texture.offset.set(((i % 4) * 512 + 4) / 2048, (Math.floor(i / 4) * 512 + 4) / 1024);
        owned.push(texture);
        return texture;
    }

    const fibres = map('hair-fibres'), flow = map('hair-flow'), edges = map('hairline');
    const hair = new Map(cuts.map((cut, i) => ['Human.' + cut, {
        normal: tile(fibres, i), direction: tile(flow, i), edge: tile(edges, i),
    }]));
    root.mediaCast = { hair, skin: map('skin-relief') };
    room.windowViewReady = Promise.all([room.windowViewReady, ...loads]);
}

export function mediaPersonMaterial(source, cast, part) {
    if (/^Human\.(eyebrow|eyelash)/i.test(source.name)) {
        const mat = source.clone();
        // Preserve partial strand coverage when several source hairs project
        // into one pixel. These cards lie immediately above the skin.
        mat.transparent = true;
        mat.depthWrite = false;
        mat.alphaTest = .012;
        mat.alphaToCoverage = false;
        mat.blending = THREE.NormalBlending;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = mat.polygonOffsetUnits = -1;
        delete mat.userData.hairEdgeFrom;
        return mat;
    }

    if (part !== 'hair' && source.name !== 'Human.body' && source.name !== 'Human.low-poly') return source.clone();

    const mat = source.isMeshPhysicalMaterial ? source.clone() : new THREE.MeshPhysicalMaterial();
    if (!source.isMeshPhysicalMaterial) {
        THREE.MeshStandardMaterial.prototype.copy.call(mat, source);
        mat.defines.PHYSICAL = '';
    }
    if (part === 'hair') {
        mat.sheen = .22;
        mat.sheenColor.set('#b8a9a1');
        mat.sheenRoughness = .52;
        if (mat.alphaTest > 0) {
            mat.alphaTest = Math.min(.18, mat.alphaTest);
            mat.alphaToCoverage = true;
            mat.blending = THREE.NormalBlending;
            delete mat.userData.hairEdgeFrom;
        }
        const style = cast.hair.get(source.name);
        if (style) {
            mat.normalMap ||= style.normal;
            mat.bumpMap = null;
            mat.normalScale.set(.65, -.65);
            mat.anisotropy = .53;
            mat.anisotropyMap = style.direction;
            // Coverage at the open scalp edges combines with each strand's
            // painted alpha in the person's original colour map.
            mat.alphaMap ||= style.edge;
        }
    } else if (source.name === 'Human.body') {
        mat.normalMap ||= cast.skin;
        mat.normalScale.set(.55, -.55);
        mat.roughness = .64;
        mat.clearcoat = .09;
        mat.clearcoatRoughness = .48;
    } else {
        mat.roughness = .3;
        mat.clearcoat = .65;
        mat.clearcoatRoughness = .14;
        // Indirect fill through the eye socket keeps the iris and sclera
        // distinct in the deeper editing bays.
        mat.emissiveMap = mat.map;
        mat.emissive.set(0xfff2e6);
        mat.emissiveIntensity = .19;
    }
    return mat;
}
