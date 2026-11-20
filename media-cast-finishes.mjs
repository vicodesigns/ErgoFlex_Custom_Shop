import * as THREE from 'three';
import { HAIR_ATLASES, HAIR_TILES } from './media-cast-hair-atlas.mjs';

// All OCC postures use the same MakeHuman UVs, including the animated models.
// Each hairstyle has one 512 px tile in a hair atlas (media-cast-hair-atlas.mjs: the original eight are atlas 0, the
// rest follow in hair-*-2.webp, hair-*-3.webp), baked from the MPFB hair assets by tools/people/bake-hair-maps.py.

// ---- the cast's finish maps, loaded once per page ------------------------------------------------------------------------
// Every room with people uses the same maps (hair fibres, flow and hairline atlases, skin relief) and the same tile
// views of the hair atlases, so they are made by the first room that asks and kept for the page: a room's
// disposal never touches them (room.root.ownedTextures does not list them, and the person materials that use them
// carry userData.sharedTextures, which workspace-3d.mjs's disposeTree honours).
// `ready` resolves when every map has loaded or failed (never rejects). A failed map drops the cache, so the next room
// tries again, and castDetailCast() answers null for that attempt (people then keep their plain materials).
let castShared = null;
function castDetailShared() {
    if (castShared) return castShared;
    const loader = new THREE.TextureLoader(), loads = [], failed = [];
    const state = castShared = { cast: null, failed, done: false, ready: null };

    function map(name) {
        const url = new URL('./assets/rooms/media/' + name + '.webp', import.meta.url);
        let texture = null;
        loads.push(new Promise(resolve => {
            // (no document to decode into, as in a node test: the map counts as failed and nobody gets the detail)
            try { texture = loader.load(url.href, resolve, undefined, () => { failed.push(name); resolve(); }); } catch { failed.push(name); resolve(); }
        }));
        texture ||= new THREE.Texture();
        texture.flipY = false;
        texture.anisotropy = 4;
        return texture;
    }

    // Each 512-pixel tile has a four-pixel guard band on every side.
    function tile(atlas, i) {
        const texture = atlas.clone();
        texture.repeat.set(504 / 2048, 504 / 1024);
        texture.offset.set(((i % 4) * 512 + 4) / 2048, (Math.floor(i / 4) * 512 + 4) / 1024);
        return texture;
    }

    const atlases = HAIR_ATLASES.map(suffix => ({ fibres: map('hair-fibres' + suffix), flow: map('hair-flow' + suffix), edges: map('hairline' + suffix) }));
    const hair = new Map(Object.entries(HAIR_TILES).map(([cut, [k, i]]) => ['Human.' + cut, {
        normal: tile(atlases[k].fibres, i), direction: tile(atlases[k].flow, i), edge: tile(atlases[k].edges, i),
    }]));
    state.cast = { hair, skin: map('skin-relief') };
    state.ready = Promise.all(loads).then(() => { state.done = true; if (failed.length && castShared === state) castShared = null; });
    return state;
}
// Starts the loads (once) and answers with the finish maps when they are all in, else null.
export async function castDetailEnsure() {
    const state = castDetailShared();
    await state.ready;
    return state.failed.length ? null : state.cast;
}
// The finish maps if they have loaded (null before that, after a failure, and before anyone asked).
export function castDetailCast() {
    return castShared?.done && !castShared.failed.length ? castShared.cast : null;
}

// The OCC media lab: its root keeps the cast (root.mediaCast) from the moment it is built, and its readiness
// (room.windowViewReady, which the film waits for) includes the maps.
export function prepareMediaCast(room, root) {
    const state = castDetailShared();
    root.mediaCast = state.cast;
    const mine = state.failed;
    room.windowViewReady = Promise.all([room.windowViewReady, state.ready.then(() => {
        if (room.root === root) for (const name of mine) room.missingProps.push(name);
    })]);
}

// `relief`: a chapter's skin relief strength (people.skinRelief in the film's data; 1 = the cast detail as it has always been). The skin's
// normal map (assets/rooms/media/skin-relief.webp) at normalScale .55 is what reads as pores, blotches and a scaly look at close framings.
export const SKIN_RELIEF = .55;
export const reliefOf = v => Number.isFinite(v) && v >= 0 && v <= 2 ? v : 1;
export function mediaPersonMaterial(source, cast, part, relief = 1) {
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
        mat.normalScale.set(SKIN_RELIEF * relief, -SKIN_RELIEF * relief);
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

// ---- the other rooms' people -------------------------------------------------------------------------------------------
// People who are not given materials of their own share one finished copy of each material that the cast finishes
// touch (hair, skin, eyes, brows, lashes), made once per source material and kept for the page (the library's models
// and their materials are never disposed with a room). Clothes, shoes, held things and the rest are the library's own.
// A hijab or a hat in a hair material slot (opaque: no strands) keeps its own look: only cut-out hair takes the sheen.
export function castDetailTouches(source, part) {
    if (/^Human\.(eyebrow|eyelash)/i.test(source.name)) return true;
    if (part === 'hair') return source.alphaTest > 0;
    return source.name === 'Human.body' || source.name === 'Human.low-poly';
}
const castVariants = new WeakMap();
export function castDetailVariant(source, cast, part) {
    if (source.userData?.castDetail || !castDetailTouches(source, part)) return source;
    let variant = castVariants.get(source);
    if (!variant) {
        variant = mediaPersonMaterial(source, cast, part);
        variant.userData.sharedTextures = true;
        variant.userData.castDetail = true;
        castVariants.set(source, variant);
    }
    return variant;
}
