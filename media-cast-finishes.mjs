import * as THREE from 'three';
import { HAIR_ATLASES, HAIR_TILES } from './media-cast-hair-atlas.mjs';

// All OCC postures use the same MakeHuman UVs, including the animated models.
// Each hairstyle has one 512 px tile in a hair atlas (media-cast-hair-atlas.mjs: the original eight are atlas 0, the
// rest follow in hair-*-2.webp, hair-*-3.webp, hair-*-4.webp), baked from the MPFB hair assets by tools/people/bake-hair-maps.py.

// ---- the cast's finish maps, loaded once per page ------------------------------------------------------------------------
// Every room with people uses the same maps (hair fibres, flow and hairline atlases, skin relief, shared fabric weaves)
// and the same tile views of the hair atlases, so they are made by the first room that asks and kept for the page:
// a room's disposal never touches them (room.root.ownedTextures does not list them, and the person materials that use
// them carry userData.sharedTextures, which workspace-3d.mjs's disposeTree honours).
// `ready` resolves when every map has loaded or failed (never rejects). A failed map drops the cache, so the next room
// tries again, and castDetailCast() answers null for that attempt (people then keep their plain materials).
let castShared = null;
function castDetailShared() {
    if (castShared) return castShared;
    const loader = new THREE.TextureLoader(), loads = [], failed = [];
    const state = castShared = { cast: null, failed, done: false, ready: null };

    function loadMap(relPath, key, { repeat = null, linear = false } = {}) {
        const url = new URL(relPath, import.meta.url);
        let texture = null;
        loads.push(new Promise(resolve => {
            // (no document to decode into, as in a node test: the map counts as failed and nobody gets the detail)
            try { texture = loader.load(url.href, resolve, undefined, () => { failed.push(key); resolve(); }); } catch { failed.push(key); resolve(); }
        }));
        texture ||= new THREE.Texture();
        texture.flipY = false;
        texture.anisotropy = 4;
        if (linear) texture.colorSpace = THREE.NoColorSpace;
        if (repeat) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeat, repeat);
        }
        return texture;
    }

    const map = name => loadMap('./assets/rooms/media/' + name + '.webp', name);
    const fabricMap = (name, repeat) => loadMap('./assets/rooms/library/' + name + '.webp', name, { repeat, linear: true });

    // Each 512-pixel tile has a four-pixel guard band on every side.
    function tile(atlas, i, count) {
        const width = 512 * Math.min(4, count), height = 512 * Math.ceil(count / 4);
        const texture = atlas.clone();
        texture.repeat.set(504 / width, 504 / height);
        texture.offset.set(((i % 4) * 512 + 4) / width, (Math.floor(i / 4) * 512 + 4) / height);
        return texture;
    }

    const atlases = HAIR_ATLASES.map(suffix => ({ fibres: map('hair-fibres' + suffix), flow: map('hair-flow' + suffix), edges: map('hairline' + suffix) }));
    const counts = HAIR_ATLASES.map((_, k) => Object.values(HAIR_TILES).filter(([atlas]) => atlas === k).length);
    const hair = new Map(Object.entries(HAIR_TILES).map(([cut, [k, i]]) => ['Human.' + cut, {
        normal: tile(atlases[k].fibres, i, counts[k]), direction: tile(atlases[k].flow, i, counts[k]), edge: tile(atlases[k].edges, i, counts[k]),
    }]));
    const textiles = {
        stockinette: { normal: fabricMap('stockinette-normal', 5), orm: fabricMap('stockinette-orm', 5) },
        twill: { normal: fabricMap('twill-normal', 7), orm: fabricMap('twill-orm', 7) },
    };
    state.cast = { hair, skin: map('skin-relief'), textiles };
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

// `relief`: a chapter's skin relief strength (people.skinRelief in the film's data; 1 = default refined skin relief).
// Lowered from 0.55 to 0.30 so close-up pores stay fine rather than blotchy/scaly.
export const SKIN_RELIEF = .30;
export const reliefOf = v => Number.isFinite(v) && v >= 0 && v <= 2 ? v : 1;

const COILED_HAIR = /^Human\.(cropped_coil_hair|sculpted_coils_hair)$/;
const LEATHER_SHOE = /boot|flats|shoes01|shoes03|shoes04/i;

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

    const isEyeBall = source.name === 'Human.low-poly';
    const isCornea = source.name === 'Human.eyes_cornea';
    const isBody = source.name === 'Human.body';
    const isCloth = part === 'top' || part === 'bottom';
    const isShoe = part === 'shoes';
    if (part !== 'hair' && !isBody && !isEyeBall && !isCornea && !isCloth && !isShoe) return source.clone();

    const mat = source.isMeshPhysicalMaterial ? source.clone() : new THREE.MeshPhysicalMaterial();
    if (!source.isMeshPhysicalMaterial) {
        THREE.MeshStandardMaterial.prototype.copy.call(mat, source);
        mat.defines.PHYSICAL = '';
    }

    if (part === 'hair') {
        const coiled = COILED_HAIR.test(source.name);
        const hasOwnNormal = !!source.normalMap;
        if (coiled) {
            // Natural velvety 4C coil sheen without silvery linear plastic glare.
            mat.sheen = .08;
            mat.sheenColor.set('#3d2e26');
            mat.sheenRoughness = .78;
        } else {
            mat.sheen = .22;
            mat.sheenColor.set('#b8a9a1');
            mat.sheenRoughness = .52;
        }
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
            // GLB-embedded OpenGL tangent normal maps use +Y; baked flipY=false atlas tiles use -Y.
            mat.normalScale.set(.65, hasOwnNormal ? .65 : -.65);
            mat.anisotropy = coiled ? .08 : .53;
            mat.anisotropyMap = style.direction;
            // Coverage at the open scalp edges combines with each strand's
            // painted alpha in the person's original colour map.
            mat.alphaMap ||= style.edge;
        } else if (hasOwnNormal) {
            mat.normalScale.set(.65, .65);
        }
    } else if (isBody) {
        const hasOwnNormal = !!source.normalMap;
        mat.normalMap ||= cast.skin;
        mat.normalScale.set(SKIN_RELIEF * relief, (hasOwnNormal ? 1 : -1) * SKIN_RELIEF * relief);
        mat.roughness = .56;
        mat.clearcoat = .13;
        mat.clearcoatRoughness = .36;
        // Subtle warm velvet grazing scatter avoids cold grey shadows on skin.
        mat.sheen = .14;
        mat.sheenColor.set('#d99b82');
        mat.sheenRoughness = .68;
    } else if (isCornea) {
        // High-poly outer wet cornea shell: pure-black diffuse + ultra-low alpha avoids milky haze while clearcoat
        // delivers razor-sharp specular catchlights over the concave iris bowl (standard PBR eye technique).
        mat.color.setHex(0x000000);
        mat.transparent = true;
        mat.opacity = .02;
        mat.depthWrite = false;
        mat.roughness = .02;
        mat.metalness = 0;
        mat.clearcoat = 1;
        mat.clearcoatRoughness = .01;
        mat.ior = 1.376;
        mat.reflectivity = .95;
        mat.envMapIntensity = 1.8;
    } else if (isEyeBall) {
        // Living wet eye finish: crisp clearcoat catchlights and restrained socket fill without chalky sclera glow.
        mat.roughness = .14;
        mat.clearcoat = 1;
        mat.clearcoatRoughness = .03;
        mat.ior = 1.38;
        mat.emissiveMap = mat.map;
        mat.emissive.set(0xfff2e6);
        mat.emissiveIntensity = .09;
    } else if (isCloth) {
        const knit = /sweater|cardigan/i.test(source.name);
        const jersey = /t-shirt|jersey|polo/i.test(source.name);
        mat.sheen = knit ? .38 : jersey ? .28 : .22;
        mat.sheenColor.set('#dad4cd');
        mat.sheenRoughness = knit ? .84 : .76;
        mat.roughness = /wool|sweater/i.test(source.name) ? .92 : .84;
        if (cast.textiles && mat.map && !source.normalMap) {
            const fabric = (knit || jersey) ? cast.textiles.stockinette : cast.textiles.twill;
            mat.bumpMap = null;
            mat.normalMap = fabric.normal;
            mat.normalScale.setScalar(knit ? .38 : jersey ? .22 : .28);
            mat.roughnessMap ||= fabric.orm;
            if (!mat.aoMap) {
                mat.aoMap = fabric.orm;
                mat.aoMapIntensity = knit ? .46 : jersey ? .22 : .32;
            }
        }
    } else if (isShoe) {
        const leather = LEATHER_SHOE.test(source.name);
        mat.roughness = leather ? .44 : .72;
        mat.clearcoat = leather ? .18 : .04;
        mat.clearcoatRoughness = .36;
        if (mat.map && !mat.normalMap) {
            mat.bumpMap = mat.map;
            mat.bumpScale = .00028;
        }
    }
    return mat;
}

// ---- the other rooms' people -------------------------------------------------------------------------------------------
// People who are not given materials of their own share one finished copy of each material that the cast finishes
// touch (hair, skin, eyes, brows, lashes, clothing, shoes), made once per source material and kept for the page
// (the library's models and their materials are never disposed with a room).
// A hijab or a hat in a hair material slot (opaque: no strands) keeps its own look: only cut-out hair takes the sheen.
export function castDetailTouches(source, part) {
    if (/^Human\.(eyebrow|eyelash)/i.test(source.name)) return true;
    if (part === 'hair') return source.alphaTest > 0;
    if (part === 'top' || part === 'bottom' || part === 'shoes') return true;
    return source.name === 'Human.body' || source.name === 'Human.low-poly' || source.name === 'Human.eyes_cornea';
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
