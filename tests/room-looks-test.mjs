// Room looks (room-looks.mjs, 18 Nov 2026): the Create room's Classic look is the artist room from before the Nov 17 pass
// (a59560ee), Studio refresh the room after it, and a chapter keeps its look through the Director's cut, autosave, the film
// field checks and the film import (build-round8-director.py, director-bridge.py). The Commons (room 'library', layout
// 'humboldt': a layout's own looks) has the same pair: Classic = the Commons before a59560ee and 713d22ff.
//   1. the look list and its cleaning
//   2. the frozen Classic modules are the 9644d030 files (only the header and one import line differ)
//   3. both looks build: Classic has the old floor, wall, plants and painting cards, Refresh the pass's
//   4. the shot field: cleanShot / cleanCut, the Director's film checks, autosave's change names, the render-still shot
//   5. the film import keeps it (director-camera-<id>.json 'look') and the pass writes it onto the film shot
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {ROOM_LOOKS,looksOf,defaultLook,cleanLook,lookOf,lookName} from '../room-looks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PY = process.env.PYTHON || 'python3';

// ---- 1. the list
assert.deepEqual(looksOf('creative').map(l => l.id), ['refresh', 'classic']);
assert.equal(defaultLook('creative'), 'refresh', 'absent = what Create built before looks existed (main at a59560ee)');
assert.equal(cleanLook('creative', 'classic'), 'classic');
assert.equal(cleanLook('creative', 'nope'), null);
assert.equal(cleanLook('home', 'classic'), null, 'a look of another room is dropped');
assert.equal(lookOf('creative', null), 'refresh');
assert.equal(lookOf('home', 'classic'), null, 'a room without looks has none');
assert.equal(lookName('creative', 'classic'), 'Classic');
// the OCC media lab (room 'occmedialab'): Classic = the room before the Nov 18 pass (cf9c9cc8's institutional-media.mjs)
assert.deepEqual(looksOf('occmedialab').map(l => l.id), ['refresh', 'classic']);
assert.equal(defaultLook('occmedialab'), 'refresh', 'absent = what the media lab builds today');
assert.equal(cleanLook('occmedialab', 'classic', 'house'), 'classic');
assert.equal(lookOf('occmedialab', null, 'house'), 'refresh');
// the Commons: one layout of the library has looks, the library's other layouts none
assert.deepEqual(looksOf('library', 'humboldt').map(l => l.id), ['refresh', 'classic']);
assert.deepEqual(looksOf('library', 'reading-room'), [], 'another library layout has no looks');
assert.deepEqual(looksOf('library'), [], 'no layout given: no Look selector for the library as a whole');
assert.equal(defaultLook('library', 'humboldt'), 'refresh', 'absent = what the Commons builds today (713d22ff)');
assert.equal(cleanLook('library', 'classic', 'humboldt'), 'classic');
assert.equal(cleanLook('library', 'classic', 'reading-room'), null, 'a look the layout does not have is dropped');
assert.equal(cleanLook('library', 'classic'), 'classic', 'no layout (the Studio\'s setRoomLook): kept when one of the room\'s layouts has it');
assert.equal(cleanLook('library', 'bogus'), null);
assert.equal(lookOf('library', null, 'humboldt'), 'refresh');
assert.equal(lookOf('library', 'classic', 'reading-room'), null);
assert.equal(lookOf('creative', 'classic', 'house'), 'classic', 'a room\'s own looks hold for every layout of it');
assert.equal(lookName('library', 'classic', 'humboldt'), 'Classic');
for (const [room, list] of Object.entries(ROOM_LOOKS)) assert(list.every(l => /^[a-z0-9-]{1,40}$/.test(l.id) && l.name), room + ': look ids fit the film import (build-round8-director.py LOOK)');

// ---- 2. frozen copies
let git = null;
// (line ends dropped on both sides: a Windows checkout with core.autocrlf has CRLF files, git show gives the LF blob)
try { git = f => execFileSync('git', ['show', '9644d030:' + f], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r/g, ''); git('artist-room.mjs'); } catch { git = null; }
if (git) {
  // (the frozen copies start with a comment header; the 9644d030 files start with their imports)
  const body = f => { const lines = fs.readFileSync(path.join(root, f), 'utf8').replace(/\r/g, '').split('\n'); return lines.slice(lines.findIndex(l => !l.startsWith('//'))); };
  const roomOld = git('artist-room.mjs').split('\n'), room = body('artist-room-classic.mjs');
  assert.equal(room.length, roomOld.length, 'artist-room-classic.mjs: the 9644d030 file and its header');
  const diff = room.map((l, i) => l === roomOld[i] ? null : i).filter(i => i !== null);
  assert.deepEqual(diff, [4], 'artist-room-classic.mjs differs from 9644d030 only in its artist-studio-detail import');
  assert.equal(room[4], roomOld[4].replace("'./artist-studio-detail.mjs?v=artist-studio-20261025'", "'./artist-studio-detail-classic.mjs'"));
  assert.deepEqual(body('artist-studio-detail-classic.mjs'), git('artist-studio-detail.mjs').split('\n'), 'artist-studio-detail-classic.mjs is the 9644d030 file');
  // the Commons: the builder differs only in its two imports and its window scenery's classic: true
  const comOld = git('library-humboldt-commons.mjs').split('\n'), com = body('library-humboldt-commons-classic.mjs');
  assert.equal(com.length, comOld.length, 'library-humboldt-commons-classic.mjs: the 9644d030 file and its header');
  const comDiff = com.map((l, i) => l === comOld[i] ? null : i).filter(i => i !== null);
  assert.equal(comDiff.length, 3, 'library-humboldt-commons-classic.mjs differs from 9644d030 in three lines only: ' + comDiff.map(i => com[i]).join(' | '));
  assert.deepEqual(comDiff.map(i => com[i]), comDiff.map(i => comOld[i]
    .replace("'./library-humboldt-life.mjs?v=polish-20261111f'", "'./library-humboldt-life-classic.mjs'")
    .replace("'./humboldt-commons-detail.mjs?v=commons-home-comfort-20261024'", "'./humboldt-commons-detail-classic.mjs'")
    .replace("{ floor: -glassBack.y1 / 2, seed: 7130 }", "{ floor: -glassBack.y1 / 2, seed: 7130, classic: true }")));
  for (const f of ['library-humboldt-life', 'humboldt-commons-detail']) assert.deepEqual(body(f + '-classic.mjs'), git(f + '.mjs').split('\n'), f + '-classic.mjs is the 9644d030 file');
  // the window scenery's classic Humboldt scene and ferns are the 9644d030 functions, renamed
  const fn = (src, name) => { const a = src.indexOf('\nfunction ' + name + '('); assert(a >= 0, name); return src.slice(a + 1, src.indexOf('\n}\n', a) + 2); };
  const wssOld = git('window-scenery-scenes.mjs'), wss = fs.readFileSync(path.join(root, 'window-scenery-scenes.mjs'), 'utf8').replace(/\r/g, '');
  assert.equal(fn(wss, 'fernClassic'), fn(wssOld, 'fern').replace('function fern(', 'function fernClassic('), 'fernClassic is 9644d030\'s fern');
  assert.equal(fn(wss, 'humboldtClassic'), fn(wssOld, 'humboldt').replace('function humboldt(', 'function humboldtClassic(').replace(/(?<![A-Za-z_.])fern\(/g, 'fernClassic('), 'humboldtClassic is 9644d030\'s humboldt (with its ferns)');
  assert.match(wss, /function humboldt\(k, ctx\) \{\n    if \(ctx\.classic\) return humboldtClassic\(k, ctx\);/);
} else console.log('room-looks-test: (no git object 9644d030 here: the frozen-copy check skipped)');
// the media lab's frozen Classic module is cf9c9cc8's institutional-media.mjs, byte for byte
try {
  const was = execFileSync('git', ['show', 'cf9c9cc8:institutional-media.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r/g, '');
  assert.equal(fs.readFileSync(path.join(root, 'institutional-media-classic.mjs'), 'utf8').replace(/\r/g, ''), was, 'institutional-media-classic.mjs is the cf9c9cc8 file');
} catch (e) { if (e.code === 'ERR_ASSERTION') throw e; console.log('room-looks-test: (no git object cf9c9cc8 here: the media lab frozen-copy check skipped)'); }

// ---- 3. both looks build (no GPU: canvases are stubs, image and model loads never arrive)
const context = () => new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: s.length * 7 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) }, { get: (o, k) => k in o ? o[k] : () => {} });
const element = () => ({ width: 512, height: 512, style: {}, getContext: context, addEventListener() {}, removeEventListener() {}, setAttribute() {} });
globalThis.document = { createElement: element, createElementNS: element };
globalThis.fetch = async () => { throw Error('no network in this test'); };
globalThis.Image = class { addEventListener() {} set src(v) {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });
const mesh = (p, g, m, at = [0, 0, 0]) => { const o = new THREE.Mesh(g, m); o.position.set(...at); p.add(o); return o; };
const box = (p, size, at, m, r = 0) => mesh(p, r ? new RoundedBoxGeometry(...size, 2, r) : new THREE.BoxGeometry(...size), m, at);
const sphere = (p, size, at, m) => { const o = mesh(p, new THREE.SphereGeometry(1, 16, 12), m, at); o.scale.set(...size); return o; };
const rod = (p, a, b, r, m) => { const s = new THREE.Vector3(...a), e = new THREE.Vector3(...b), d = e.clone().sub(s), o = mesh(p, new THREE.CylinderGeometry(r, r, d.length(), 12), m); o.position.copy(s).add(e).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; };
const helpers = { material, mesh, box, sphere, rod, markSceneAsset: (o, { key } = {}) => { o.userData.sceneAssetKey = key; } };
const { ARTIST_LAYOUTS, buildArtistRoom } = await import('../artist-room.mjs');
const { ARTIST_LAYOUTS: CLASSIC_LAYOUTS, buildArtistRoom: buildClassic } = await import('../artist-room-classic.mjs');
assert.deepEqual(JSON.parse(JSON.stringify(CLASSIC_LAYOUTS)), JSON.parse(JSON.stringify(ARTIST_LAYOUTS)), 'both looks read the same layouts (the Studio reads artist-room.mjs\'s)');
const build = (fn, layout) => {
  const r = new THREE.Group(); r.scale.setScalar(.001);
  const room = { id: 'creative', root: r, roomLayout: layout, walls: [], propSupports: [], missingProps: [], windowViewReady: Promise.resolve(), token: 0 };
  fn(room, r, layout, helpers); return { room, names: new Set((() => { const n = []; r.traverse(o => n.push(o.name)); return n; })()) };
};
const REFRESH_ONLY = ['Oiled oak studio floor', 'Limewashed gallery brickwork', 'Window arch stones', 'Potted fern'];
for (const layout of Object.values(ARTIST_LAYOUTS)) {
  const fresh = build(buildArtistRoom, layout), classic = build(buildClassic, layout);
  for (const n of REFRESH_ONLY) {
    assert(fresh.names.has(n), `${layout.id} Studio refresh: ${n}`);
    assert(!classic.names.has(n), `${layout.id} Classic has no ${n}`);
  }
  assert(fresh.room.propReplacements?.monstera, `${layout.id} Studio refresh swaps the room's plants`);
  assert(!classic.room.propReplacements, `${layout.id} Classic keeps the room's own plants`);
  assert(fresh.room.root.artistHair && !classic.room.root.artistHair, `${layout.id}: Lin's bob map is the refresh's only`);
  for (const n of ['Artist gallery wall', 'Artist materials wall', 'Artist paper lantern', 'Artist hanging planter']) assert(classic.names.has(n) && fresh.names.has(n), `${layout.id}: both looks have ${n}`);
}

// the Commons, both looks (library-room.mjs picks the builder on room.look)
{
  const { LIBRARY_LAYOUTS, buildLibraryRoom } = await import('../library-room.mjs');
  const layout = LIBRARY_LAYOUTS.humboldt, names = look => { const r = new THREE.Group(); r.scale.setScalar(.001);
    const room = { id: 'library', look, root: r, roomLayout: layout, walls: [], propSupports: [], missingProps: [], windowViewReady: Promise.resolve(), token: 0 };
    buildLibraryRoom(room, r, layout, helpers); const n = new Set(); r.traverse(o => n.add(o.name)); return { room, n }; };
  const fresh = names(null), classic = names('classic');
  for (const n of ['Potted fern', 'Pressed fern study', 'Woven solar shades', 'North Coast field guides', 'Redwoods in coastal fog']) {
    assert(fresh.n.has(n), `Commons Studio refresh: ${n}`); assert(!classic.n.has(n), `Commons Classic has no ${n}`);
  }
  assert(classic.n.has('Framed landscape print') && !fresh.n.has('Framed landscape print'), 'Commons Classic keeps its framed landscape print');
  assert(fresh.room.root.commonsTextiles && !classic.room.root.commonsTextiles, 'the knit / twill cloth maps are the refresh\'s only');
  let cut = false; classic.room.root.traverse(o => { if (o.userData.cutawayHeightMm != null || o.material?.map?.userData?.staticArtwork) cut = true; });
  assert(!cut, 'Commons Classic sets no ceiling cutaway heights and flags no static artwork (workspace-3d / film-tod act as before)');
  for (const n of ['Ceiling gallery tracks', 'Ceiling light frames', 'Ceiling Humboldt sloped ceiling']) assert(classic.n.has(n) && fresh.n.has(n), `Commons: both looks have ${n}`);
}

// the OCC media lab, both looks (institutional-room.mjs picks the module, the window view, the sheets on room.look)
{
  const { buildInstitutionalRoom } = await import('../institutional-room.mjs');
  const { institutionalLayout, institutionalModes, institutionalModule, INSTITUTIONAL_ROOMS } = await import('../institutional-scenes.mjs');
  const layout = institutionalLayout('occmedialab', 'house');
  const built = look => { const r = new THREE.Group(); r.scale.setScalar(.001);
    const room = { id: 'occmedialab', look, root: r, roomLayout: layout, walls: [], propSupports: [], missingProps: [], windowViewReady: Promise.resolve(), token: 0, ownedMaterials: new Set() };
    buildInstitutionalRoom(room, r, layout, helpers); const n = new Set(); r.traverse(o => n.add(o.name)); return { room, n }; };
  const fresh = built(null), classic = built('classic');
  assert(fresh.room.root.mediaTextiles && !classic.room.root.mediaTextiles, 'the knit / twill cloth maps are the media lab refresh\'s only');
  const { windowView } = await import('../window-scenery.mjs');
  for (const lab of [fresh, classic]) {
    assert.equal(windowView('occmedialab', lab === classic), 'scenery');
    for (const poster of ['Story / Screen', 'Light / Colour', 'Sound / Silence']) assert(lab.n.has(poster), poster);
    assert(lab.room.root.mediaCast.hair.has('Human.ponytail01'), 'Ava has her fibre maps in either look');
  }
  assert.equal(fresh.room.root.mediaCast, classic.room.root.mediaCast, 'both looks (and every other room with people) share one cast of finish maps');
  assert(!fresh.room.root.ownedTextures?.includes(fresh.room.root.mediaCast.skin), 'the room does not own the shared maps');
  assert(fresh.n.has('LATE EDIT / CONFORM') && !fresh.n.has('PORTFOLIO CRITIQUE'), 'Studio refresh has the pass\'s sheets');
  assert(classic.n.has('PORTFOLIO CRITIQUE') && !classic.n.has('LATE EDIT / CONFORM'), 'Classic keeps its old sheets');
  assert.notEqual(institutionalModule('occmedialab'), institutionalModule('occmedialab', 'classic'), 'the Classic look builds the frozen module');
  assert.equal(institutionalModule('highschool', 'classic'), institutionalModule('highschool'), 'no other room has a Classic module');
  assert.equal(institutionalModes('occmedialab', 'classic').morning.ambient, .32, 'Classic keeps its old morning light');
  assert.equal(institutionalModes('occmedialab', null).morning.ambient, INSTITUTIONAL_ROOMS.occmedialab.modes.morning.ambient);
  assert.notEqual(institutionalModes('occmedialab', null).morning.ambient, .32, 'Studio refresh lights the morning as the pass did');
  assert.deepEqual(institutionalModes('highschool', 'classic'), INSTITUTIONAL_ROOMS.highschool.modes, 'other rooms keep their modes');
  const { drawSceneScreen, SCREEN_THEMES } = await import('../scene-screens.mjs');
  const titles = look => { const out = []; const c = context(); c.fillText = (t) => out.push(t); drawSceneScreen(c, 960, 540, { scene: 'occmedialab', phase: 'night', look }); return out; };
  assert(titles('classic').includes('Student reel screening') && !titles(null).includes('Student reel screening'), 'Classic keeps its screens\' task titles');
  assert(SCREEN_THEMES.occmedialab.tasks[3] === 'Late edit', 'Studio refresh screens carry the pass\'s titles');
}

// ---- the room code picks the look (workspace-3d.mjs needs a browser: its dispatch is read from the source)
const ws = fs.readFileSync(path.join(root, 'workspace-3d.mjs'), 'utf8');
assert.match(ws, /import \{ buildArtistRoom as buildArtistRoomClassic \} from '\.\/artist-room-classic\.mjs';/);
assert.match(ws, /this\.look = lookOf\(id, options\.look\)/);
assert.match(ws, /else if \(id === 'creative'\) \(this\.look === 'classic' \? buildArtistRoomClassic : buildArtistRoom\)\(this, root/);
assert.match(ws, /id === 'decor-bamboo' && lookOf\(roomId, look\) !== 'classic'/, 'Classic keeps the library bamboo');
assert.match(ws, /\(id === 'ergoflex-plant-1' \|\| id === 'ficus'\) && lookOf\(roomId, look, layoutId\) !== 'classic'\)/, 'Commons Classic keeps the library plant and ficus (no bay planter)');
assert.match(ws, /if \(this\.roomLayout\?\.id\) this\.look = lookOf\(id, options\.look, this\.roomLayout\.id\);/, 'the room\'s look is checked against its layout');
assert.match(fs.readFileSync(path.join(root, 'library-room.mjs'), 'utf8'), /if \(layout\.humboldt\) return \(room\.look === 'classic' \? buildHumboldtCommonsClassic : buildHumboldtCommons\)\(room, root, layout, helpers\);/);
const people = fs.readFileSync(path.join(root, 'room-people.mjs'), 'utf8');
assert.equal((people.match(/room\.id === 'creative'|this\.room\.id === 'creative'/g) || []).length, 0, 'room-people.mjs gates the pass\'s cast finishes on the look (refreshedCast), not on the room alone');
assert.match(people, /const refreshedCast = room => \(room\?\.id === 'occmedialab' && !classicMedia\(room\)\) \|\| \(room\?\.id === 'creative' && !classicCreate\(room\)\) \|\| \(!!room\?\.roomLayout\?\.humboldt && !classicCommons\(room\)\);/);
assert.match(people, /const classicMedia = room => room\?\.id === 'occmedialab' && room\.look === 'classic';/);
assert.match(people, /rig\.mediaLab = room\?\.id === 'occmedialab' && !classicMedia\(room\);/, 'the editor\'s fader hand is the refresh\'s only');
assert.match(people, /rig\.classicMotion = classicCreate\(room\) \|\| classicCommons\(room\)/, 'the Commons\' Classic cast moves as before too');
assert.match(people, /const castDetailRoom = room => !!room && !classicCreate\(room\) && !classicCommons\(room\);/, 'cast detail (hair, skin, finger and audience motion) is every look\'s but Create\'s and the Commons\' frozen Classic casts');
assert.match(people, /rig\.castDetail = castDetailRoom\(room\); rig\.editorCast = room\?\.id === 'occmedialab';/, 'the editor\'s timeline scan is the media lab\'s only');
assert.equal((people + fs.readFileSync(path.join(root, 'room-people-motion.mjs'), 'utf8')).includes('coastCast'), false, 'the one media-lab flag was split into castDetail / editorCast / mediaLab');

assert.match(fs.readFileSync(path.join(root, 'experience', 'stage.mjs'), 'utf8'), /api\.setRoomLook\?\.\(next\.room,next\.look\?\?null\);\s*\n\s*if\(next\.layout\)/, 'the stage sets the look before it loads the room');

// ---- 4. the shot field
const { cleanShot, cleanCut } = await import('../experience/cuts.mjs');
const base = { id: 'create', room: 'creative', layout: 'house', mode: 'afternoon', kind: 'room', seconds: 20, title: 'Create' };
assert.equal(cleanShot({ ...base, look: 'classic' }).look, 'classic');
assert.equal(cleanShot({ ...base, look: 'refresh' }).look, 'refresh', 'an explicit default is kept (it is part of the chapter key)');
assert.equal('look' in cleanShot(base), false, 'absent stays absent: no existing chapter key changes');
assert.equal('look' in cleanShot({ ...base, look: 'bogus' }), false);
assert.equal('look' in cleanShot({ ...base, room: 'home', layout: 'house', look: 'classic' }), false);
const commons = { ...base, id: 'commons', room: 'library', layout: 'humboldt' };
assert.equal(cleanShot({ ...commons, look: 'classic' }).look, 'classic', 'the Commons keeps its look');
assert.equal('look' in cleanShot({ ...commons, layout: 'reading-room', look: 'classic' }), false, 'another library layout drops it');
assert.equal('look' in cleanShot(commons), false);
const cut = cleanCut({ schema: 'ergoflex.client-cut', version: 1, id: 'c', name: 'n', shots: [{ ...base, look: 'classic' }] });
assert.equal(cleanCut(JSON.parse(JSON.stringify(cut))).shots[0].look, 'classic', 'a cut round trip keeps it');
const { CHAPTER_FIELDS, fieldChanged, filmValue } = await import('../experience/film-changes.mjs');
assert(CHAPTER_FIELDS.includes('look'));
const film = { id: 'create', room: 'creative', layout: 'house' };
assert.equal(filmValue(film, 'look'), 'refresh', 'a film shot without a look shows the default');
assert.equal(fieldChanged({ ...base }, film, 'look'), false);
assert.equal(fieldChanged({ ...base, look: 'refresh' }, film, 'look'), false);
assert.equal(fieldChanged({ ...base, look: 'classic' }, film, 'look'), true, 'the ↺ by Room look when it is not the film\'s');
assert.equal(fieldChanged({ ...base, look: 'classic' }, { ...film, look: 'classic' }, 'look'), false);
assert.equal(fieldChanged({ id: 'x', room: 'home' }, { id: 'x', room: 'home' }, 'look'), false);
const comFilm = { id: 'commons', room: 'library', layout: 'humboldt' };
assert.equal(filmValue(comFilm, 'look'), 'refresh');
assert.equal(fieldChanged({ ...commons, look: 'classic' }, comFilm, 'look'), true);
assert.equal(fieldChanged({ ...commons }, comFilm, 'look'), false);
const { changesSince } = await import('../experience/director-autosave.mjs');
assert.deepEqual(changesSince({ shots: [base] }, { shots: [{ ...base, look: 'classic' }] }), ['room look']);
const { filmRenderShot } = await import('../experience/film-render.mjs');
assert.equal(filmRenderShot({ ...film, cameraPlan: { keys: [] } }, { ...base, look: 'classic' }, null).look, 'classic', 'Render still renders the chapter\'s look');

// ---- 5. the film import and pass
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'room-looks-'));
try {
  const plan = { keys: [{ at: 0, position: [1, 1, 1], target: [0, 0, 0], fov: 35 }, { at: 20, position: [2, 1, 1], target: [0, 0, 0], fov: 35 }] };
  const shot = { ...base, preset: 'gaming', transition: .8, size: '60x30', cameraPlan: plan, camera: { keys: [] } };
  fs.writeFileSync(path.join(tmp, 'review-cut.json'), JSON.stringify({ shots: [shot] }));
  // the bridge's chapter page carries the film's look into the Director
  const link = path.join(tmp, 'link.json');
  execFileSync(PY, [path.join(root, 'tools/experience/director-bridge.py'), 'link', path.join(tmp, 'review-cut.json'), '--shot', 'create', '--json', link], { stdio: 'pipe' });
  assert.equal('look' in JSON.parse(fs.readFileSync(link, 'utf8')).shots[0], false, 'no look on the film: none on the page');
  const looked = path.join(tmp, 'looked.json'); fs.writeFileSync(looked, JSON.stringify({ shots: [{ ...shot, look: 'classic' }] }));
  execFileSync(PY, [path.join(root, 'tools/experience/director-bridge.py'), 'link', looked, '--shot', 'create', '--json', link], { stdio: 'pipe' });
  assert.equal(JSON.parse(fs.readFileSync(link, 'utf8')).shots[0].look, 'classic', 'the chapter page carries the film\'s look');
  // build-round8-director.py: its import keeps the export's look, its pass writes it onto the film shot
  const src = fs.readFileSync(path.join(root, 'tools/experience/build-round8-director.py'), 'utf8');
  assert.match(src, /if isinstance\(shot\.get\('look'\), str\) and LOOK\.fullmatch\(shot\['look'\]\): dc\['look'\] = shot\['look'\]\r?\n\s*elif 'look' in before: dc\['look'\] = before\['look'\]/);
  const probe = path.join(tmp, 'probe.py');
  fs.writeFileSync(probe, `import sys, json, types, re\nsrc = open(sys.argv[1]).read()\nstart = src.index("LOOK = re.compile"); end = src.index("_fin = lambda")\nns = {'re': re, 'os': __import__('os'), 'json': json, 'H': sys.argv[2], 'CUT': sys.argv[2] + '/review-cut.json'}\nns['load'] = lambda p: json.load(open(p))\ndef dump(p, d, indent=1):\n    if ns['load'](p) == d: return False\n    json.dump(d, open(p, 'w')); return True\nns['dump'] = dump\nexec(src[start:end], ns)\nprint(json.dumps(ns['apply_look']('create', None, 'classic')))\nprint(json.dumps(ns['apply_look']('create', None, 'classic')))\n`);
  const out = execFileSync(PY, [probe, path.join(root, 'tools/experience/build-round8-director.py'), tmp], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(out.map(l => JSON.parse(l)), [['review-cut.json'], []], 'the pass writes the look once, then leaves the cut alone');
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'review-cut.json'), 'utf8')).shots[0].look, 'classic');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log('room-looks-test: ok (look list, Create and Commons: frozen Classic = 9644d030, both looks build, shot field round trip, film import and pass)');
