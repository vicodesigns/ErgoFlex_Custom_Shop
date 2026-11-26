// The media lab's cast finishes and motion in every room with people (media-cast-finishes.mjs, room-people.mjs classicRig
// and ownMaterials / shareCastDetail, room-people-motion.mjs's rig.castDetail): which rooms and looks get them, that the
// maps (hair atlases, three images each, and the skin relief) load once for the page and are shared, that a person without a style or with a hijab degrades to the plain
// material, that a room's disposal never takes the shared maps, and that the media lab's own cast is what it was.
//   node tests/room-people-cast-detail-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canvas = () => ({ width: 8, height: 8, style: {}, getContext: () => new Proxy({}, { get: () => () => ({}) }), addEventListener() {}, removeEventListener() {}, setAttribute() {} });
// An image that loads (or fails) a few ms after its src is set; which of the maps fail is the test's to say.
let failing = new Set(), latency = 5, requests = [];
class FakeImage {
    constructor() { this.listeners = {}; this.width = this.height = 8; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    set src(url) { this._src = url; requests.push(url); const name = /([a-z0-9-]+)\.webp$/.exec(url)?.[1], type = failing.has(name) ? 'error' : 'load'; setTimeout(() => { for (const fn of [...(this.listeners[type] || [])]) fn.call(this, { type }); }, latency); }
    get src() { return this._src; }
}
globalThis.document = { createElement: canvas, createElementNS: (ns, tag) => tag === 'img' ? new FakeImage() : canvas() };
globalThis.window = globalThis;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { RoomPeople, ROOM_PEOPLE, partOf, classicRig, castDetailRoom } = await import('../room-people.mjs');
const { PersonRig } = await import('../room-people-motion.mjs');
const { castDetailCast, castDetailEnsure, prepareMediaCast, mediaPersonMaterial, castDetailTouches, castDetailVariant, softHairChunks, softHairEdge, coilTaper, rootsTaper, COIL_TAPER, FABRIC_SCALE, HAIR_FRINGE, HAIR_SHEEN, SKIN_GLOSS, ROOTS_HAIR, IRIS_TONE } = await import('../media-cast-finishes.mjs');
const { disposeWorkspaceObject } = await import('../workspace-3d.mjs');
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8'));
const entries = new Map(index.props.map(p => [p.id, p]));

// A person as the library builds one: its materials are the library's, shared by every instance of that model.
const HAIRS = ['short01', 'afro01', 'cortu_short_messy_hair', 'headscarf_hair', null, 'ponytail01', 'culturalibre_hair_05', 'toigo_inverted_bob', 'faydaen_hair_1', 'elvs_reverse_french_braid_bun', null];
const made = new Map();
const parts = id => {
    if (made.has(id)) return made.get(id);
    const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0), hair = HAIRS[n % HAIRS.length], set = new Map();
    const std = (name, extra = {}) => { const m = new THREE.MeshStandardMaterial({ name: 'Human.' + name, color: 0xc89878, ...extra }); m.map = new THREE.Texture(); set.set(name, m); return m; };
    std('body'); std('low-poly'); std('teeth_base'); std('eyebrow001', { alphaTest: .4 }); std('eyelashes01', { alphaTest: .4 });
    std('toigo_wool_pants'); std('namuhekam_male_polo_shirt'); std('shoes05');
    if (hair) std(hair, hair === 'headscarf_hair' ? {} : { alphaTest: .4 });
    made.set(id, set); return set;
};
const library = {
    loadIndex: async () => index, entry: id => entries.get(id) || null,
    instance: async id => { const g = new THREE.Group(); for (const m of parts(id).values()) g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), m)); g.scale.setScalar(1000); g.userData.propId = id; return g; }
};
const roomOf = (id, layout, look) => {
    const r = new THREE.Group(), chair = new THREE.Group(); chair.add(new THREE.Mesh(new THREE.BoxGeometry(600, 900, 600))); chair.userData.propId = 'steelcase-leap-v2'; r.add(chair);
    return { id, look, root: r, token: 1, ready: Promise.resolve(), roomLayout: layout, missingProps: [], windowViewReady: Promise.resolve(), assets: () => r.children.filter(o => o.userData.propId && !o.name.startsWith('Person')), peopleState: null };
};
const meshesOf = people => people.people.flatMap(p => { const out = []; p.traverse(o => { if (o.isMesh) out.push(o); }); return out; });
const bySource = (o) => o.material.name.replace('Human.', '');
const layouts = {};
{
    const { GYM_LAYOUTS } = await import('../gym-room.mjs'), { LIBRARY_LAYOUTS } = await import('../library-room.mjs'), { LOUNGE_LAYOUTS } = await import('../lounge-room.mjs'), { institutionalLayout } = await import('../institutional-scenes.mjs');
    Object.assign(layouts, { gym: GYM_LAYOUTS.house, humboldt: LIBRARY_LAYOUTS.humboldt, reading: Object.values(LIBRARY_LAYOUTS).find(l => !l.humboldt), lounge: Object.values(LOUNGE_LAYOUTS)[1], home: { id: 'house' }, creative: { id: 'house' }, highschool: institutionalLayout('highschool', 'house'), kindergarten: institutionalLayout('kindergarten', 'house'), hospital: institutionalLayout('hospital', 'house'), occmedialab: institutionalLayout('occmedialab', 'house') });
}
const cast = async (room, filter) => { const p = new RoomPeople(room, library); if (filter) p.setFilter(filter); await p.setEnabled(true); return p; };
const SKINS = new Set(), seen = { hijab: 0, styled: 0, unstyled: 0, bald: 0 };

// ---- 1. before the maps have loaded, and when one fails: nothing blocks, nobody gets half the detail
failing = new Set(['hairline-3']); latency = 3;   // (a map of the third hair atlas: the whole cast degrades, not just the cuts on it)
{
    const room = roomOf('gym', layouts.gym), people = await cast(room);
    assert.ok(people.people.length > 3, 'the gym is cast though a map did not arrive');
    for (const o of meshesOf(people)) {
        const person = people.people.find(p => p.getObjectById(o.id)), source = parts(person.userData.person.id).get(bySource(o));
        assert.ok(!o.material.userData.castDetail && !o.material.normalMap && !o.material.isMeshPhysicalMaterial, 'a failed map: ' + o.material.name + ' has no half the detail');
        if (!person.userData.personMaterials) assert.equal(o.material, source, 'a failed map: a shared person keeps the library\'s own materials');
    }
    assert.equal(castDetailCast(), null, 'no cast while a map is missing');
    assert.equal(await castDetailEnsure(), null);
}
failing = new Set(); requests = []; made.clear();

// ---- 2. the maps load once for the page; rooms that ask while they load wait for the same loads
latency = 30;
const first = roomOf('highschool', layouts.highschool), pending = cast(first);
assert.equal(castDetailCast(), null, 'not loaded yet');
await new Promise(r => setTimeout(r, 4));
assert.equal(first.root.children.filter(o => o.name.startsWith('Person')).length, 0, 'nobody is shown with half-loaded hair: people wait for the maps');
const highschool = await pending;
assert.ok(castDetailCast(), 'loaded');
const { HAIR_ATLASES, HAIR_TILES } = await import('../media-cast-hair-atlas.mjs'), MAPS = HAIR_ATLASES.length * 3 + 5;
assert.equal(MAPS, 17);
assert.equal(requests.length, MAPS, 'one image request per map for the page (hair fibres, flow and hairline per atlas, skin relief, shared textiles)');
const shared = castDetailCast();
latency = 5;
const gym = await cast(roomOf('gym', layouts.gym)), home = await cast(roomOf('home', layouts.home));
assert.equal(requests.length, MAPS, 'later rooms reuse them: still the same requests');
assert.equal(await castDetailEnsure(), shared, 'one cast object for the page');

// ---- 3. rooms and looks
const sharedSkin = shared.skin, hairKey = n => shared.hair.get('Human.' + n);
{   // rooms whose people have no materials of their own: they share finished copies of hair, skin, eyes, brows and lashes
    for (const [name, people] of [['highschool', highschool], ['gym', gym], ['home', home]]) {
        const own = people.people.filter(p => p.userData.personMaterials), loose = people.people.filter(p => !p.userData.personMaterials);
        for (const person of loose) {
            const set = parts(person.userData.person.id), mats = {}; person.traverse(o => { if (o.isMesh) mats[bySource(o)] = o.material; });
            assert.ok(mats.body.isMeshPhysicalMaterial && mats.body.normalMap === sharedSkin, name + ': skin relief on the body');
            SKINS.add(mats.body.normalMap);
            assert.ok(mats['low-poly'].isMeshPhysicalMaterial && mats['low-poly'].emissiveMap === set.get('low-poly').map, name + ': eyes');
            assert.ok(mats.eyebrow001.transparent && mats.eyelashes01.transparent, name + ': brows and lashes are cards');
            assert.equal(mats.teeth_base, set.get('teeth_base'), name + ': teeth_base stays the library\'s');
            for (const key of ['toigo_wool_pants', 'namuhekam_male_polo_shirt']) {
                assert.ok(mats[key].isMeshPhysicalMaterial && mats[key].sheen > 0 && mats[key].normalMap, name + ': ' + key + ' gets shared cloth sheen & weave');
            }
            assert.ok(mats.shoes05.isMeshPhysicalMaterial && mats.shoes05.clearcoat > 0, name + ': shoes05 gets physical shoe finish');
            const hair = Object.keys(mats).find(k => partOf('Human.' + k) === 'hair');
            seen[!hair ? 'bald' : hair === 'headscarf_hair' ? 'hijab' : hairKey(hair) ? 'styled' : 'unstyled']++;
            if (hair === 'headscarf_hair') assert.equal(mats[hair], set.get(hair), name + ': a hijab (opaque) keeps its own material');
            else if (hair) {
                assert.ok(mats[hair].isMeshPhysicalMaterial && mats[hair].sheen > 0, name + ': hair has sheen');
                const style = hairKey(hair); if (style) { assert.equal(mats[hair].normalMap, style.normal); assert.equal(mats[hair].anisotropyMap, style.direction); assert.equal(mats[hair].alphaMap, style.edge); }
                else assert.ok(!mats[hair].anisotropyMap && !mats[hair].alphaMap, name + ': a cut without a style has sheen only');
            }
        }
    }
    assert.equal(new Set(SKINS).size, 1, 'one skin relief texture object across rooms');
}
assert.ok(seen.hijab && seen.styled && seen.unstyled && seen.bald, 'the rooms\' cast covered a hijab, a styled cut, an unstyled cut and no hair: ' + JSON.stringify(seen));
{   // a person model used in two rooms has one finished body, one hair
    const bodies = [], seen = new Map();
    for (const people of [highschool, gym, home]) for (const p of people.people.filter(q => !q.userData.personMaterials)) p.traverse(o => { if (o.isMesh && o.material.name === 'Human.body') { const id = p.userData.person.id; if (seen.has(id)) assert.equal(seen.get(id), o.material, id + ': one finished body for the page'); seen.set(id, o.material); bodies.push(o.material); } });
}
{   // the desk user and recolored people own their materials: cast detail through mediaPersonMaterial, never twice
    const deskUsers = [highschool, gym, home].flatMap(p => p.people.filter(o => o.userData.personMaterials));
    for (const person of deskUsers) {
        const body = person.userData.personMaterials.find(m => m.name === 'Human.body');
        assert.ok(body.isMeshPhysicalMaterial && body.normalMap === sharedSkin && body.userData.sharedTextures, 'an own body copy carries the shared skin');
        const hair = person.userData.personMaterials.find(m => partOf(m.name) === 'hair' && m.alphaTest > 0); if (hair) assert.ok(hair.sheen > 0, 'an own hair copy has its sheen (once: a recolored person\'s copy of a finished material stays as it is)');
    }
}
{   // the refreshed Create room and Commons take the detail on top of their finishes; the media lab keeps its root's cast
    for (const [id, layout, look] of [['creative', layouts.creative, null], ['library', layouts.humboldt, null]]) {
        const people = await cast(roomOf(id, layout, look));
        assert.ok(people.people.length > 3 && people.people.every(p => p.userData.personMaterials), id + ': own materials as before');
        for (const p of people.people) assert.equal(p.userData.personMaterials.find(m => m.name === 'Human.body').normalMap, sharedSkin, id + ': skin relief');
        assert.equal(people.people[0].userData.personMaterials.length, parts(people.people[0].userData.person.id).size, 'one own copy per library material');
        // hijab: the own copy of an opaque hair slot is a plain clone in these rooms (no sheen)
        for (const p of people.people) for (const m of p.userData.personMaterials) if (m.name === 'Human.headscarf_hair') assert.ok(!m.isMeshPhysicalMaterial, id + ': hijab stays plain');
    }
}
{   // the frozen Classic casts: no cast detail at all (their old cast, so Vico can compare with the past)
    for (const [id, layout] of [['creative', layouts.creative], ['library', layouts.humboldt]]) {
        const room = roomOf(id, layout, 'classic'), people = await cast(room);
        assert.ok(people.people.length > 3);
        for (const o of meshesOf(people)) {
            assert.ok(!o.material.isMeshPhysicalMaterial && !o.material.userData.castDetail && !o.material.normalMap, id + ' Classic: ' + o.material.name + ' is a plain material');
        }
        const rig = (await import('../room-people-motion.mjs')).PersonRig; assert.ok(rig);
        assert.equal(room.root.mediaCast, undefined);
    }
}
// ---- 4. the media lab: its root has the cast from the build, readiness includes the maps, identical materials as before
{
    const room = roomOf('occmedialab', layouts.occmedialab), r = room.root;
    prepareMediaCast(room, r);
    assert.equal(r.mediaCast, shared, 'the media lab uses the page\'s cast');
    assert.ok(r.mediaCast.hair.has('Human.ponytail01') && r.mediaCast.hair.has('Human.long01'));
    await room.windowViewReady;
    assert.deepEqual(room.missingProps, []);
    assert.equal(r.ownedTextures, undefined, 'the room does not own the shared maps: its disposal cannot take them');
    for (const look of [null, 'classic']) {
        const lab = roomOf('occmedialab', layouts.occmedialab, look); prepareMediaCast(lab, lab.root);
        const people = await cast(lab);
        assert.ok(people.people.length > 3 && people.people.every(p => p.userData.personMaterials), 'media lab ' + (look || 'refresh') + ': every person owns materials, as before');
        for (const p of people.people) for (const m of p.userData.personMaterials) {
            const source = parts(p.userData.person.id).get(m.name.replace('Human.', ''));
            // identical to what mediaPersonMaterial made before this change, for the lab's own cast
            if (partOf(m.name) === 'hair' || /^Human\.(body|low-poly|eyebrow|eyelash)/.test(m.name)) {
                const was = mediaPersonMaterial(source, shared, partOf(m.name));
                for (const k of ['sheen', 'clearcoat', 'transparent', 'alphaTest', 'alphaToCoverage', 'anisotropy', 'emissiveIntensity']) assert.equal(m[k], was[k], m.name + ' ' + k);
                assert.equal(m.anisotropyMap, was.anisotropyMap); assert.equal(m.alphaMap, was.alphaMap);
                if (partOf(m.name) !== 'hair' || look === 'classic') assert.equal(m.normalMap, was.normalMap);
            }
        }
    }
}

{   // Character realism v2 shading invariants (approved 2026-11-23):
    // 1. Eyes (low-poly inner + eyes_cornea outer) have crisp wet clearcoat and restrained emissive.
    // 2. GLB-embedded OpenGL hair normal maps keep positive +Y normalScale, while baked atlas maps keep -Y.
    // 3. Coiled 4C hair uses velvety dark sheen & low anisotropy; skin has subtle warm sheen & refined relief.
    // 4. Clothing receives shared fabric weave + sheen across all non-Classic rooms.
    const ownNrm = new THREE.Texture();
    const coilsSrc = new THREE.MeshStandardMaterial({ name: 'Human.sculpted_coils_hair', alphaTest: .28 });
    coilsSrc.map = new THREE.Texture(); coilsSrc.normalMap = ownNrm;
    const coilsMat = mediaPersonMaterial(coilsSrc, shared, 'hair');
    assert.equal(coilsMat.normalMap, ownNrm, 'GLB-embedded hair normal map is preserved');
    assert.ok(coilsMat.normalScale.y > 0, 'GLB-embedded OpenGL hair normal map uses +Y normalScale');
    assert.ok(coilsMat.anisotropy < .2 && coilsMat.sheen < .15, 'coiled 4C hair stays velvety with low linear anisotropy');

    const atlasHairSrc = new THREE.MeshStandardMaterial({ name: 'Human.ponytail01', alphaTest: .4 });
    atlasHairSrc.map = new THREE.Texture();
    const atlasHairMat = mediaPersonMaterial(atlasHairSrc, shared, 'hair');
    assert.ok(atlasHairMat.normalScale.y < 0, 'baked flipY=false atlas hair normal map uses -Y normalScale');

    const corneaSrc = new THREE.MeshStandardMaterial({ name: 'Human.eyes_cornea' });
    const corneaMat = mediaPersonMaterial(corneaSrc, shared, null);
    assert.ok(corneaMat.isMeshPhysicalMaterial && corneaMat.transparent && corneaMat.clearcoat === 1 && corneaMat.roughness <= .05, 'cornea shell is crystal-clear wet glass');

    const eyeSrc = new THREE.MeshStandardMaterial({ name: 'Human.low-poly' }); eyeSrc.map = new THREE.Texture();
    const eyeMat = mediaPersonMaterial(eyeSrc, shared, null);
    assert.ok(eyeMat.clearcoat === 1 && eyeMat.clearcoatRoughness <= .05 && eyeMat.emissiveIntensity <= .12, 'inner eyeball has crisp catchlights and restrained socket fill');

    const skinSrc = new THREE.MeshStandardMaterial({ name: 'Human.body' }); skinSrc.map = new THREE.Texture();
    const skinMat = mediaPersonMaterial(skinSrc, shared, null);
    assert.ok(skinMat.sheen > 0 && skinMat.normalScale.x <= .35, 'skin carries warm grazing sheen and refined pore relief');
}

// ---- 4b. the hair atlases: every hairstyle in the manifest has its own tile, the files are the format the tiles assume, and
// the cuts without a bake (a solid-colour cap, a tiled-UV cut, a hijab) still get sheen only
{
    const webpSize = file => {   // [width, height] from the RIFF header (lossless VP8L, lossy VP8, extended VP8X)
        const b = fs.readFileSync(file), kind = b.toString('latin1', 12, 16);
        if (kind === 'VP8L') return [1 + (b.readUInt16LE(21) & 0x3fff), 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff)];
        if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
        return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    };
    assert.deepEqual(HAIR_ATLASES, ['', '-2', '-3', '-4']);
    assert.deepEqual(HAIR_TILES.cropped_coil_hair, [3, 0]);
    assert.deepEqual(HAIR_TILES.layered_long_hair, [3, 1]);
    assert.deepEqual(HAIR_TILES.sculpted_coils_hair, [3, 2]);
    const dimensions = [[2048, 1024], [2048, 1024], [2048, 1024], [1536, 512]];
    for (const [k, suffix] of HAIR_ATLASES.entries()) for (const name of ['hair-fibres', 'hair-flow', 'hairline']) assert.deepEqual(webpSize(path.join(root, 'assets/rooms/media', name + suffix + '.webp')), dimensions[k], name + suffix + ' atlas dimensions');
    const taken = new Set();
    for (const [cut, [k, i]] of Object.entries(HAIR_TILES)) {
        const key = k + ':' + i; assert.ok(!taken.has(key), cut + ' has a tile of its own'); taken.add(key);
        assert.ok(k < HAIR_ATLASES.length && i >= 0 && i < 8, cut + ' tile in range');
        const style = hairKey(cut); assert.ok(style, cut + ' has a style');
        const [width, height] = dimensions[k];
        // (the two coil crops' edge map is their own tapered hairline, not a tile of the atlas: section 4c)
        for (const t of COIL_TAPER['Human.' + cut] ? [style.normal, style.direction] : [style.normal, style.direction, style.edge]) {
            assert.ok(Math.abs(t.repeat.x - 504 / width) < 1e-9 && Math.abs(t.repeat.y - 504 / height) < 1e-9, cut + ' tile size');
            assert.ok(Math.abs(t.offset.x - ((i % 4) * 512 + 4) / width) < 1e-9 && Math.abs(t.offset.y - (Math.floor(i / 4) * 512 + 4) / height) < 1e-9, cut + ' tile offset');
        }
    }
    assert.equal(shared.hair.size, Object.keys(HAIR_TILES).length);
    assert.deepEqual(Object.keys(HAIR_TILES).slice(0, 8), ['ponytail01', 'afro01', 'short01', 'short04', 'braid01', 'short02', 'bob01', 'long01'], 'the first eight keep their tiles in atlas 0');
    // atlas k's three tiles share one image per map: one decode per atlas, not per cut
    const sources = new Map(); for (const [cut, [k]] of Object.entries(HAIR_TILES)) { const st = hairKey(cut); (sources.get(k) || sources.set(k, new Set()).get(k)).add(st.normal.source); }
    for (const set of sources.values()) assert.equal(set.size, 1, 'the cuts of one atlas share its normal image');
    for (const none of ['culturalibre_hair_05', 'faydaen_hair_1', 'headscarf_hair']) assert.equal(hairKey(none), undefined, none + ' has no strand maps');
    // how much of the library's cut-out hair is covered (the people GLBs' material names, read from their JSON chunks)
    const props = path.join(root, 'assets/props'); let slots = 0, covered = 0; const styled = {}, counts = {};
    for (const f of fs.readdirSync(props)) {
        if (!/^people-.*\.glb$/.test(f)) continue;
        const fd = fs.openSync(path.join(props, f), 'r'), head = Buffer.alloc(20); fs.readSync(fd, head, 0, 20, 0);
        const json = Buffer.alloc(head.readUInt32LE(12)); fs.readSync(fd, json, 0, json.length, 20); fs.closeSync(fd);
        for (const m of JSON.parse(json.toString()).materials || []) if (partOf(m.name) === 'hair' && m.alphaMode === 'MASK') { slots++; counts[m.name] = (counts[m.name] || 0) + 1; if (shared.hair.has(m.name)) covered++; }
    }
    assert.ok(slots > 1400, 'the library has cut-out hair: ' + slots);
    assert.ok(covered / slots > .93, 'at least 93% of the library\'s cut-out hair has strand maps: ' + covered + ' of ' + slots);
    for (const [name, n] of Object.entries(counts)) if (!shared.hair.has(name) && n > 20) assert.ok(['Human.culturalibre_hair_05'].includes(name), name + ' (' + n + ' models) has no strand maps and is not a known gap');
}

// ---- 4c. the people pass of 25 Nov 2026: soft hair edges, tapered coil and roots hairlines, cloth at the size it is worn,
// skin without the lacquer, matt lashes
{
    // soft hair edges: a cut-out hair material is alphaTest + alphaToCoverage + alphaHash, keeps the canvas opaque, and a clone keeps all of it
    const src = new THREE.MeshStandardMaterial({ name: 'Human.ponytail01', alphaTest: .4 }); src.map = new THREE.Texture();
    const hair = mediaPersonMaterial(src, shared, 'hair');
    assert.ok(hair.alphaTest > 0 && hair.alphaTest <= .18 && hair.alphaToCoverage && hair.alphaHash && !hair.transparent, 'cut-out hair: the soft edge switch, still a solid draw');
    assert.ok(hair.blending === THREE.CustomBlending && hair.blendSrc === THREE.OneFactor && hair.blendDst === THREE.ZeroFactor && hair.blendSrcAlpha === THREE.OneFactor && hair.blendDstAlpha === THREE.OneMinusSrcAlphaFactor, 'part-covered hair pixels leave the canvas opaque');
    const copy = hair.clone(); assert.ok(copy.alphaHash && copy.alphaToCoverage && copy.alphaTest === hair.alphaTest && copy.blending === THREE.CustomBlending, 'a person\'s own copy keeps the soft edge');
    assert.equal(hair.sheen, HAIR_SHEEN.strength); assert.ok(hair.sheen < .2, 'no silvery film on dark hair');
    // the chunks: only the three-way combination takes the soft path; everything else compiles what three ships
    const chunks = { alphatest_fragment: 'TEST', alphahash_fragment: 'HASH' };
    softHairChunks(chunks);      // (the real chunks were patched when the first hair was finished: this call is the once-only guard)
    assert.deepEqual(chunks, { alphatest_fragment: 'TEST', alphahash_fragment: 'HASH' }, 'the chunks are patched once');
    const test = THREE.ShaderChunk.alphatest_fragment, hash = THREE.ShaderChunk.alphahash_fragment, combo = 'defined( USE_ALPHATEST ) && defined( ALPHA_TO_COVERAGE ) && defined( USE_ALPHAHASH )';
    assert.ok(test.startsWith('#if !( ' + combo + ' )') && test.includes('if ( diffuseColor.a < alphaTest ) discard;') && test.includes('smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a )'), 'alpha test: three\'s own code but for the soft combination');
    assert.ok(hash.startsWith('#if ' + combo) && hash.includes('#elif !defined( USE_ALPHATEST )') && hash.includes('if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;'), 'alpha hash: three\'s own code for a material without an alpha test; a cut-out that lost its coverage is a plain cut-out, never hashed');
    assert.ok(hash.includes(HAIR_FRINGE.width.toFixed(3)) && hash.includes('getAlphaHashThreshold( vPosition )') && hash.includes('efCover * min( efSolid, 1.0 )'), 'the fringe is coverage, broken up on the hair itself, and fades with the person');
    const plain = softHairEdge(new THREE.MeshStandardMaterial({ name: 'Human.shirt' })); assert.ok(!plain.alphaHash && !plain.alphaToCoverage, 'a material that is not a cut-out is left alone');

    // the coil crops taper to their hairline: nothing on the rim, everything beyond `to`, the same every time
    for (const [name, taper] of Object.entries(COIL_TAPER)) {
        const style = shared.hair.get(name), t = style.edge, d = t.image.data, w = t.image.width, h = t.image.height, row = y => { let s = 0; for (let x = 0; x < w; x++) s += d[(y * w + x) * 4 + 1]; return s / w / 255; };
        assert.ok(t.isDataTexture && t.flipY === false && t.wrapS === THREE.RepeatWrapping && t.repeat.x === 1, name + ': a taper map of its own');
        assert.ok(row(h - 1) < .3 && row(Math.round(h * (1 - taper.to)) - 2) === 1 && row(0) === 1, name + ': thin at the hairline (v = 1), solid from `to` up to the crown');
        const mid = row(Math.round(h * (1 - (taper.from + taper.to) / 2))); assert.ok(mid > .35 && mid < .75, name + ': half way through the taper about half is there (' + mid.toFixed(2) + ')');
        assert.deepEqual([...coilTaper(taper).image.data.slice(0, 4096)], [...coilTaper(taper).image.data.slice(0, 4096)], name + ': the same flecks every time');
        const coil = mediaPersonMaterial(Object.assign(new THREE.MeshStandardMaterial({ name, alphaTest: .3 }), { map: new THREE.Texture() }), shared, 'hair');
        assert.equal(coil.alphaMap, t, name + ': the taper is the finished material\'s alpha map'); assert.ok(coil.alphaHash, name + ': with the soft edge');
    }

    // the brushed roots: the rings in from the rim become vertex alpha; the roots' finish is a soft cut-out; a hijab is still left alone
    const cap = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);      // a dome: pole on top, an open rim at the equator
    assert.equal(rootsTaper(cap), true); const alpha = cap.getAttribute('color'), pos = cap.getAttribute('position');
    assert.equal(alpha.itemSize, 4);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), a = alpha.getW(i); assert.ok(alpha.getX(i) === 1 && alpha.getY(i) === 1 && alpha.getZ(i) === 1); if (y < 1e-6) assert.equal(a, 0, 'nothing on the rim'); else if (y > .75) assert.equal(a, 1, 'everything near the crown'); else assert.ok(a > 0 && a <= 1); }
    assert.equal(rootsTaper(cap), false, 'counted once per geometry');
    assert.equal(rootsTaper(new THREE.SphereGeometry(1, 8, 6)), false, 'a closed shell has no rim: left as it is');
    const rootsSrc = new THREE.MeshStandardMaterial({ name: 'Human.brushed_roots_hair', roughness: .82 }); rootsSrc.map = new THREE.Texture();
    assert.ok(ROOTS_HAIR.test(rootsSrc.name) && castDetailTouches(rootsSrc, 'hair'), 'the roots take a finish');
    const roots = castDetailVariant(rootsSrc, shared, 'hair');
    assert.ok(roots !== rootsSrc && roots.vertexColors && roots.alphaTest === .18 && roots.alphaHash && roots.alphaToCoverage && !roots.transparent, 'the roots\' rim is a soft cut-out');
    assert.ok(!rootsSrc.vertexColors && rootsSrc.alphaTest === 0, 'the library\'s own roots material is untouched (the Classic casts keep the solid shell)');
    const scarf = new THREE.MeshStandardMaterial({ name: 'Human.headscarf_hair' }); assert.equal(castDetailTouches(scarf, 'hair'), false, 'a hijab keeps its own material');

    // cloth at the size it is worn: views of the two weave maps with their own repeat, the old ones untouched
    assert.deepEqual([shared.textiles.stockinette.normal.repeat.x, shared.textiles.twill.normal.repeat.x], [5, 7], 'the room textiles\' repeats are as they were');
    for (const [kind, [from, repeat]] of Object.entries(FABRIC_SCALE)) {
        const f = shared.textiles[kind]; assert.ok(repeat >= 10, kind + ': a stitch of millimetres, not a centimetre');
        assert.ok(f.normal !== shared.textiles[from].normal && f.normal.source === shared.textiles[from].normal.source && f.orm.source === shared.textiles[from].orm.source, kind + ': a view of the ' + from + ' maps (no second image)');
        assert.ok(f.normal.repeat.x === repeat && f.normal.repeat.y === repeat && f.orm.repeat.x === repeat && f.normal.wrapS === THREE.RepeatWrapping, kind + ': repeat ' + repeat);
    }
    const cloth = (name, part) => mediaPersonMaterial(Object.assign(new THREE.MeshStandardMaterial({ name }), { map: new THREE.Texture() }), shared, part);
    assert.equal(cloth('Human.joepal_crude_t-shirt_female', 'top').normalMap, shared.textiles.jersey.normal, 'a T-shirt is jersey');
    assert.equal(cloth('Human.namuhekam_male_polo_shirt', 'top').normalMap, shared.textiles.jersey.normal, 'a polo is jersey');
    assert.equal(cloth('Human.toigo_fisherman_sweater', 'top').normalMap, shared.textiles.knit.normal, 'a sweater is a heavier knit');
    assert.equal(cloth('Human.toigo_wool_pants', 'bottom').normalMap, shared.textiles.woven.normal, 'trousers are woven');
    assert.equal(cloth('Human.toigo_wool_pants', 'bottom').roughnessMap, shared.textiles.woven.orm);
    const ownNormal = new THREE.Texture(), cargo = mediaPersonMaterial(Object.assign(new THREE.MeshStandardMaterial({ name: 'Human.cortu_cargo_pants' }), { map: new THREE.Texture(), normalMap: ownNormal }), shared, 'bottom');
    assert.equal(cargo.normalMap, ownNormal, 'a garment with folds of its own keeps them');

    // skin and lashes
    const skin = mediaPersonMaterial(Object.assign(new THREE.MeshStandardMaterial({ name: 'Human.body' }), { map: new THREE.Texture() }), shared, null);
    assert.ok(skin.roughness === SKIN_GLOSS.roughness && skin.roughness >= .6 && skin.clearcoat === SKIN_GLOSS.coat && skin.clearcoat <= .06 && skin.ior === 1.4 && skin.sheen > 0, 'skin: no lacquer, the warm grazing sheen stays');
    const lash = mediaPersonMaterial(new THREE.MeshStandardMaterial({ name: 'Human.eyelashes02', alphaTest: .4, roughness: .5 }), shared, null), brow = mediaPersonMaterial(new THREE.MeshStandardMaterial({ name: 'Human.eyebrow001', alphaTest: .2, roughness: .5 }), shared, null);
    assert.ok(lash.roughness === 1 && lash.envMapIntensity === 0 && lash.transparent && !lash.depthWrite, 'lashes: matt, no mirror of the room, still blended cards');
    assert.ok(brow.roughness === .9 && brow.envMapIntensity < .5 && brow.transparent, 'brows: nearly matt');

    // brown eyes: the eyeball's shader turns the maroon iris brown (and nothing else), and a clone keeps the shader
    const eye = mediaPersonMaterial(Object.assign(new THREE.MeshStandardMaterial({ name: 'Human.low-poly' }), { map: new THREE.Texture() }), shared, null);
    const shader = { fragmentShader: 'A\n#include <common>\nB\n#include <map_fragment>\nC\n#include <emissivemap_fragment>\nD' }; eye.onBeforeCompile(shader);
    assert.ok(shader.fragmentShader.includes('vec3 efIrisTone( vec3 c )') && shader.fragmentShader.includes('#include <map_fragment>\n\tdiffuseColor.rgb = efIrisTone( diffuseColor.rgb );') && shader.fragmentShader.includes('#include <emissivemap_fragment>\n\ttotalEmissiveRadiance = efIrisTone( totalEmissiveRadiance );'), 'the iris tone is in the eyeball\'s shader, for what it reflects and what it gives off');
    const eyeCopy = eye.clone(), again = eyeCopy.clone();
    assert.ok(eyeCopy.onBeforeCompile === eye.onBeforeCompile && again.onBeforeCompile === eye.onBeforeCompile && eyeCopy.customProgramCacheKey() === eye.customProgramCacheKey() && eyeCopy.clearcoat === 1 && eyeCopy.emissiveMap === eye.map, 'a person\'s own copy of the eyeball keeps the shader');
    assert.notEqual(eye.customProgramCacheKey(), new THREE.MeshPhysicalMaterial().customProgramCacheKey(), 'and compiles a program of its own');
    // the same arithmetic as the shader: maroon turns brown at the same brightness x gain; the white of the eye, a blue iris and the pupil stay
    const tone = c => { const red = (c[0] - Math.max(c[1], c[2])) / Math.max(c[0], 1e-4), lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2], t = Math.min(1, Math.max(0, (red - IRIS_TONE.from) / (IRIS_TONE.to - IRIS_TONE.from))), w = t * t * (3 - 2 * t); return c.map((v, i) => v + (lum * IRIS_TONE.hue[i] * IRIS_TONE.gain - v) * w); };
    const maroon = tone([.102, .013, .010]); assert.ok(maroon[1] / maroon[0] > .35 && maroon[1] / maroon[0] < .5 && maroon[2] < maroon[1], 'the maroon iris is a brown one: ' + maroon.map(v => v.toFixed(3)));
    for (const keep of [[.209, .191, .175], [.05, .12, .3], [0, 0, 0], [.6, .45, .4]]) assert.deepEqual(tone(keep).map(v => +v.toFixed(6)), keep, 'left as it is: ' + keep);
    assert.ok(Math.abs(.2126 * IRIS_TONE.hue[0] + .7152 * IRIS_TONE.hue[1] + .0722 * IRIS_TONE.hue[2] - 1) < .01, 'the brown hue has a brightness of one: the gain is the only change of brightness');
}

// ---- 5. disposal: a room going away never takes the shared maps
{
    const before = [sharedSkin, shared.textiles.stockinette.normal, shared.textiles.stockinette.orm, shared.textiles.twill.normal, shared.textiles.twill.orm, ...[...shared.hair.values()].flatMap(s => [s.normal, s.direction, s.edge])];
    let disposed = 0; for (const t of before) t.addEventListener('dispose', () => disposed++);
    const room = roomOf('home', layouts.home), people = await cast(room);
    room.people = people; disposeWorkspaceObject([room.root]); people.dispose();
    for (const p of [highschool, gym]) assert.ok(p.people.length >= 0);
    assert.equal(disposed, 0, 'no shared map was disposed with a room');
    // and the other rooms still render with them
    assert.equal(castDetailCast(), shared);
}

// ---- 6. which rooms and looks get the detail (the rig flags classicRig sets: finger, gaze and audience motion)
{
    const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/people-rigs/ava.json'), 'utf8')), table = {};
    const flagsOf = (id, layout, look) => { const rig = classicRig(new PersonRig(data), roomOf(id, layout, look)); return { detail: rig.castDetail, editor: rig.editorCast, fader: rig.mediaLab, classic: rig.classicMotion }; };
    const looks = { creative: [null, 'classic'], library: [null, 'classic'], occmedialab: [null, 'classic'] };
    for (const id of Object.keys(ROOM_PEOPLE)) for (const look of looks[id] || [null]) {
        const layout = id === 'library' ? layouts.humboldt : layouts[id] || { id: 'house' }, f = flagsOf(id, layout, look), frozen = look === 'classic' && id !== 'occmedialab';
        table[id + (look ? ':' + look : '')] = frozen ? 'frozen Classic' : 'detail';
        assert.equal(f.detail, !frozen, `${id} ${look || 'default'}: cast detail motion ${frozen ? 'off (frozen Classic cast)' : 'on'}`);
        assert.equal(f.classic, frozen, `${id} ${look || 'default'}: classicMotion is the frozen casts'`);
        assert.equal(f.editor, id === 'occmedialab', `${id} ${look || 'default'}: the timeline-scanning editor is the media lab's`);
        assert.equal(f.fader, id === 'occmedialab' && look !== 'classic', `${id} ${look || 'default'}: the fader hand is the media lab refresh's`);
        assert.equal(castDetailRoom(roomOf(id, layout, look)), !frozen);
    }
    assert.equal(flagsOf('library', layouts.reading, 'classic').detail, true, 'another library layout has no Classic cast to keep');
    assert.equal(Object.values(table).filter(v => v === 'frozen Classic').length, 2, 'only Create\'s and the Commons\' Classic looks are frozen');
    assert.equal(classicRig(new PersonRig(data), null).castDetail, false, 'no room: the old motion');
}
console.log('PASS room people cast detail: shared maps load once, no half-loaded hair, failure degrades to plain, hijab and unstyled cuts degrade, Classic casts of Create and the Commons stay as they were, the media lab\'s cast is as before, disposal leaves the shared maps.');
