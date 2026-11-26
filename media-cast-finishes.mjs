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
    // The cropped and the sculpted coils end in a cap's rim (their own maps are solid down to the last ring of the
    // crop); with the soft edges they taper out over the last centimetre or so instead (coilTaper below).
    for (const [name, taper] of Object.entries(COIL_TAPER)) { const style = hair.get(name); if (style) style.edge = coilTaper(taper); }
    const textiles = {
        stockinette: { normal: fabricMap('stockinette-normal', 5), orm: fabricMap('stockinette-orm', 5) },
        twill: { normal: fabricMap('twill-normal', 7), orm: fabricMap('twill-orm', 7) },
    };
    // The same two weaves at the size of cloth that is worn (FABRIC_SCALE): views of the maps above with their own repeat.
    for (const [name, [from, repeat]] of Object.entries(FABRIC_SCALE)) {
        const view = map => { const t = map.clone(); t.repeat.set(repeat, repeat); return t; };
        textiles[name] = { normal: view(textiles[from].normal), orm: view(textiles[from].orm) };
    }
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

// ---- soft hair edges ---------------------------------------------------------------------------------------------------
// A hair cut-out drawn with alpha to coverage has a one-pixel edge wherever its painted alpha crosses the cutoff: a
// hairline, a nape or a temple reads as the rim of a cap. The hair textures do carry a feathered fringe there (strand
// tips that thin out over a few millimetres), so the cast's hair is drawn with that fringe as coverage: none at the
// cutoff, full HAIR_FRINGE.width of alpha above it, in between as many of the pixel's samples as that share, the
// steps between sample counts broken up by a noise that is fixed to the hair itself (three's alpha-hash threshold
// on the model's own position: it does not swim when the camera or the person moves). Order-independent, depth-written,
// and still an ordinary solid draw. The shadow pass keeps its plain cutoff.
// The switch is a material that is alphaTest + alphaToCoverage + alphaHash, a combination nothing else in the app uses;
// it is read by the two shader chunks below, so a clone of the material (a person's own copy, a recoloured one) keeps
// it, which an onBeforeCompile would not. (Should such a material ever lose its alphaToCoverage, it is a plain cut-out
// again: the hashed discard of three's alphaHash is kept for materials without an alpha test only.)
export const HAIR_FRINGE = { width: .56, dither: .25, floor: .04 };
let fringeChunks = false;
export function softHairChunks(chunks = THREE.ShaderChunk) {
    if (fringeChunks || !chunks?.alphatest_fragment || !chunks.alphahash_fragment) return fringeChunks; fringeChunks = true;
    const soft = 'defined( USE_ALPHATEST ) && defined( ALPHA_TO_COVERAGE ) && defined( USE_ALPHAHASH )', f = v => v.toFixed(3);
    chunks.alphatest_fragment = `#if !( ${soft} )\n${chunks.alphatest_fragment}\n#endif\n`;
    chunks.alphahash_fragment = `#if ${soft}
	{
		// (media-cast-finishes.mjs, soft hair edges; the person's own opacity, a fade, stays a factor of the coverage)
		float efSolid = max( opacity, 0.0001 );
		float efAlpha = diffuseColor.a / efSolid;
		float efCover = clamp( ( efAlpha - alphaTest ) / max( ${f(HAIR_FRINGE.width)}, fwidth( efAlpha ) ), 0.0, 1.0 );
		if ( efCover <= 0.0 ) discard;
		if ( efCover < 1.0 ) efCover = clamp( efCover + ( getAlphaHashThreshold( vPosition ) - 0.5 ) * ${f(HAIR_FRINGE.dither)}, ${f(HAIR_FRINGE.floor)}, 1.0 );
		diffuseColor.a = efCover * min( efSolid, 1.0 );
	}
#elif !defined( USE_ALPHATEST )
${chunks.alphahash_fragment}
#endif
`;
    return true;
}
// A cut-out hair material's soft edge: on (the fringe as coverage) or off (the one-pixel edge it had).
export function softHairEdge(mat, on = true) {
    if (!(mat?.alphaTest > 0)) return mat;
    if (on) softHairChunks();
    mat.alphaToCoverage = true; mat.alphaHash = !!on;
    // The canvas has an alpha of its own: a part-covered pixel must not leave it below 1 where hair is over the room
    // (a film frame is the canvas drawn onto a dark one: such pixels went dark, most seen in fair hair). Colour is
    // written as it is; alpha is added to what is behind it.
    mat.blending = THREE.CustomBlending; mat.blendEquation = mat.blendEquationAlpha = THREE.AddEquation;
    mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.ZeroFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    mat.needsUpdate = true; return mat;
}

// ---- fabric at the size it is worn ---------------------------------------------------------------------------------------
// The two weave maps were laid over a garment five and seven times: on a T-shirt (its UVs span about 0.6 m) a knit
// stitch came out near 9 mm wide and a trouser weave 12 mm, so at film distance a jersey read as embossed chevrons
// and jeans as a rubber mat. Worn cloth takes the maps at these repeats instead: a jersey stitch of about 1.7 mm, a
// sweater's 4 mm, a woven trouser cloth near 2 mm. From a few metres they average out to plain matt cloth (their
// roughness and the sheen stay), close up they are the tooth of the fabric.
// [which map, repeats over the garment, normal strength, how much of the map's occlusion]
export const FABRIC_SCALE = { jersey: ['stockinette', 26], knit: ['stockinette', 11], woven: ['twill', 44] };
const FABRIC_DEPTH = { jersey: [.30, .16], knit: [.42, .40], woven: [.34, .22] };

// The coil crops (tools/people/groom.py cropped_coils, sculpted_afro_coils) are rings from the hairline (v = 1 in the
// model's UVs) up to the crown, and their maps are solid down to the rim. This alpha map thins them towards the hairline:
// nothing at `from` (a fraction of the way from hairline to crown; the cropped cut's first rings lie under the skin),
// everything by `to`, in between coil-sized flecks (a texel is about a millimetre) that the soft edge turns into a
// taper, the way such a cut is faded at the temples and the nape. The same flecks every time (a seeded generator).
export const COIL_TAPER = { 'Human.cropped_coil_hair': { from: .018, to: .10 }, 'Human.sculpted_coils_hair': { from: 0, to: .085 } };
export function coilTaper({ from, to }, width = 512, height = 256) {
    let seed = 0x9e3779b9 ^ Math.round(from * 1e4) ^ (Math.round(to * 1e4) << 12);
    const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // flecks at two sizes: single texels and clumps of about four, the clumps wrapping round the head
    const coarseW = width >> 2, coarseH = height >> 2, coarse = new Float32Array(coarseW * coarseH); for (let i = 0; i < coarse.length; i++) coarse[i] = random();
    const data = new Uint8Array(width * height * 4), lerp = (a, b, t) => a + (b - a) * t;
    for (let y = 0; y < height; y++) {
        const d = 1 - (y + .5) / height, r = Math.min(1, Math.max(0, (d - from) / (to - from))), ramp = r * r * (3 - 2 * r);
        for (let x = 0; x < width; x++) {
            const cx = x / 4, cy = y / 4, x0 = Math.floor(cx) % coarseW, x1 = (x0 + 1) % coarseW, y0 = Math.min(coarseH - 1, Math.floor(cy)), y1 = Math.min(coarseH - 1, y0 + 1);
            const clump = lerp(lerp(coarse[y0 * coarseW + x0], coarse[y0 * coarseW + x1], cx % 1), lerp(coarse[y1 * coarseW + x0], coarse[y1 * coarseW + x1], cx % 1), cy % 1);
            // (the soft edge draws nothing below an alpha of .18 and everything from .74: the ramp runs between them)
            const fleck = (clump - .5) * .46 + (random() - .5) * .30, value = ramp >= 1 ? 1 : d < from ? 0 : Math.min(1, Math.max(0, .14 + .64 * ramp + fleck * (1 - ramp * ramp)));
            const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = Math.round(value * 255); data[i + 3] = 255;
        }
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.flipY = false; texture.colorSpace = THREE.NoColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 4;
    texture.needsUpdate = true; return texture;
}

// ---- the brushed roots' rim --------------------------------------------------------------------------------------------
// The brushed roots (tools/people/groom.py brushed_roots: Ava's, Mia's and Yara's scalp under the ponytail, the braid and
// the long layers) are a solid shell that comes out of the skin along the hairline, so the hairline was the rim of a
// cap. Its rings are counted in from that rim once per model (rootsTaper, called where a people model is loaded) and
// kept as the alpha of a vertex colour: nothing on the rim, everything from the fourth ring; the roots' finish then
// draws it as a cut-out with the soft edge above, so the hair thins out over the last centimetre.
export const ROOTS_HAIR = /^Human\.brushed_roots_hair$/;
const ROOTS_RINGS = [0, .12, .5, .84];        // alpha on the rim and on the rings after it (1 beyond)
export function rootsTaper(geometry) {
    const position = geometry?.getAttribute?.('position'), index = geometry?.getIndex?.();
    if (!position || !index || geometry.getAttribute('color')) return false;
    // (vertices at one place count as one: a seam must not look like a rim)
    const place = new Map(), same = new Int32Array(position.count);
    for (let i = 0; i < position.count; i++) { const k = Math.round(position.getX(i) * 1e5) + ' ' + Math.round(position.getY(i) * 1e5) + ' ' + Math.round(position.getZ(i) * 1e5); if (!place.has(k)) place.set(k, i); same[i] = place.get(k); }
    const edges = new Map(), near = new Map(), link = (a, b) => { (near.get(a) || near.set(a, []).get(a)).push(b); };
    for (let i = 0; i < index.count; i += 3) for (let k = 0; k < 3; k++) {
        const a = same[index.getX(i + k)], b = same[index.getX(i + (k + 1) % 3)]; if (a === b) continue;
        const key = a < b ? a + ' ' + b : b + ' ' + a; edges.set(key, (edges.get(key) || 0) + 1); link(a, b); link(b, a);
    }
    // the rim: edges with a triangle on one side only; then ring by ring inwards
    const ring = new Map(); let front = [];
    for (const [key, n] of edges) if (n === 1) for (const v of key.split(' ')) { const i = +v; if (!ring.has(i)) { ring.set(i, 0); front.push(i); } }
    if (!front.length) return false;
    for (let r = 1; r < ROOTS_RINGS.length && front.length; r++) { const next = []; for (const i of front) for (const j of near.get(i) || []) if (!ring.has(j)) { ring.set(j, r); next.push(j); } front = next; }
    const color = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) { const r = ring.get(same[i]); color[i * 4] = color[i * 4 + 1] = color[i * 4 + 2] = 1; color[i * 4 + 3] = r === undefined ? 1 : ROOTS_RINGS[r]; }
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 4));
    return true;
}
// (every roots mesh under a loaded people model)
export function rootsTapers(root) { root?.traverse?.(o => { if (o.isMesh && [].concat(o.material).some(m => ROOTS_HAIR.test(m?.name || ''))) rootsTaper(o.geometry); }); }

// `relief`: a chapter's skin relief strength (people.skinRelief in the film's data; 1 = default refined skin relief).
// Lowered from 0.55 to 0.30 so close-up pores stay fine rather than blotchy/scaly.
export const SKIN_RELIEF = .30;
export const reliefOf = v => Number.isFinite(v) && v >= 0 && v <= 2 ? v : 1;

// ---- brown eyes that are brown ---------------------------------------------------------------------------------------
// The library's brown iris is a deep maroon: in a lit close-up the eyes read red. In the eyeball's own shader a texel
// that is far redder than it is green or blue (the iris and its rim; never the grey-white of the eye, its fine veins
// or a blue, green or grey iris) keeps its brightness and takes the hue of a brown eye. The same for the little light
// the eyeball gives off. The material's clone keeps the shader (three's own clone would drop it).
export const IRIS_TONE = { hue: [1.93, .79, .31], gain: 1.35, from: .38, to: .7 };
const IRIS_GLSL = `
vec3 efIrisTone( vec3 c ) {
	float red = ( c.r - max( c.g, c.b ) ) / max( c.r, 0.0001 );
	float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	return mix( c, lum * vec3( ${IRIS_TONE.hue.map(v => v.toFixed(3)).join(', ')} ) * ${IRIS_TONE.gain.toFixed(3)}, smoothstep( ${IRIS_TONE.from.toFixed(3)}, ${IRIS_TONE.to.toFixed(3)}, red ) );
}
`;
const irisShader = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>' + IRIS_GLSL)
        .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = efIrisTone( diffuseColor.rgb );')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance = efIrisTone( totalEmissiveRadiance );');
};
const irisKey = () => 'ef-iris-tone-1';
function irisClone() { const copy = THREE.Material.prototype.clone.call(this); copy.onBeforeCompile = this.onBeforeCompile; copy.customProgramCacheKey = this.customProgramCacheKey; copy.clone = this.clone; return copy; }
export function irisTone(mat) { mat.onBeforeCompile = irisShader; mat.customProgramCacheKey = irisKey; mat.clone = irisClone; mat.needsUpdate = true; return mat; }

export const HAIR_SHEEN = { strength: .13, color: '#a39080' };
export const SKIN_GLOSS = { roughness: .64, ior: 1.4, coat: .05, coatRoughness: .5 };
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
        // Lash and brow cards are near-black hairs on flat cards: at a glancing angle a card mirrored the room and the
        // key light, and the lashes turned pale grey-blue. They keep their own colour: no mirror of the room, matt.
        const lash = /^Human\.eyelash/i.test(source.name);
        mat.roughness = lash ? 1 : .9;
        mat.envMapIntensity = lash ? 0 : .35;
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
            // (a pale grey sheen at .22 lay over dark hair as a silvery film where a lock turned from the light, most on
            // the crown: less of it, and in a warm tone that sits in brown and black hair alike)
            mat.sheen = HAIR_SHEEN.strength;
            mat.sheenColor.set(HAIR_SHEEN.color);
            mat.sheenRoughness = .52;
        }
        if (ROOTS_HAIR.test(source.name) && !(mat.alphaTest > 0)) {
            // the roots' rim thins out (rootsTaper's vertex alpha) instead of ending as the edge of a shell
            mat.vertexColors = true;
            mat.alphaTest = .18;
            // (nearer the gloss of the locks that lie on it: under shinier hair the matt roots showed every lock that crossed them as a pale patch)
            mat.roughness = Math.min(mat.roughness, .72);
        }
        if (mat.alphaTest > 0) {
            mat.alphaTest = Math.min(.18, mat.alphaTest);
            delete mat.userData.hairEdgeFrom;
            softHairEdge(mat);
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
            // painted alpha in the person's original colour map. A model built with
            // its hair's own edges (glTF extras hairline: false, tools/people/cast.py
            // 'hairline') goes without: on braid01's thin sheets over the brow the
            // map cut salmon hatching, the forehead showing through (Priya, gym).
            if (source.userData?.hairline !== false) mat.alphaMap ||= style.edge;
        } else if (hasOwnNormal) {
            mat.normalScale.set(.65, .65);
        }
    } else if (isBody) {
        const hasOwnNormal = !!source.normalMap;
        mat.normalMap ||= cast.skin;
        mat.normalScale.set(SKIN_RELIEF * relief, (hasOwnNormal ? 1 : -1) * SKIN_RELIEF * relief);
        // Skin is not lacquered: the broad plastic shine on forearms, necks and foreheads under a room's key light came
        // from a glossy base under a tight clear coat. A rougher base at skin's own index of refraction, and only a
        // trace of a broad oily layer on top (SKIN_GLOSS).
        mat.roughness = SKIN_GLOSS.roughness;
        mat.ior = SKIN_GLOSS.ior;
        mat.clearcoat = SKIN_GLOSS.coat;
        mat.clearcoatRoughness = SKIN_GLOSS.coatRoughness;
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
        irisTone(mat);
    } else if (isCloth) {
        const knit = /sweater|cardigan/i.test(source.name);
        const jersey = /t-shirt|jersey|polo/i.test(source.name);
        mat.sheen = knit ? .38 : jersey ? .28 : .22;
        mat.sheenColor.set('#dad4cd');
        mat.sheenRoughness = knit ? .84 : .76;
        mat.roughness = /wool|sweater/i.test(source.name) ? .92 : .84;
        if (cast.textiles && mat.map && !source.normalMap) {
            const kind = knit ? 'knit' : jersey ? 'jersey' : 'woven';
            const fabric = cast.textiles[kind] || ((knit || jersey) ? cast.textiles.stockinette : cast.textiles.twill);
            const [depth, occlusion] = cast.textiles[kind] ? FABRIC_DEPTH[kind] : [knit ? .38 : jersey ? .22 : .28, knit ? .46 : jersey ? .22 : .32];
            mat.bumpMap = null;
            mat.normalMap = fabric.normal;
            mat.normalScale.setScalar(depth);
            mat.roughnessMap ||= fabric.orm;
            if (!mat.aoMap) {
                mat.aoMap = fabric.orm;
                mat.aoMapIntensity = occlusion;
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
    if (part === 'hair') return source.alphaTest > 0 || ROOTS_HAIR.test(source.name);
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
