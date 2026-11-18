// Room looks (room-looks.mjs, 18 Nov 2026): the Create room's Classic look is the artist room from before the Nov 17 pass
// (a59560ee), Studio refresh the room after it, and a chapter keeps its look through the Director's cut, autosave, the film
// field checks and the film import (build-round8-director.py, director-bridge.py).
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
for (const [room, list] of Object.entries(ROOM_LOOKS)) assert(list.every(l => /^[a-z0-9-]{1,40}$/.test(l.id) && l.name), room + ': look ids fit the film import (build-round8-director.py LOOK)');

// ---- 2. frozen copies
let git = null;
try { git = f => execFileSync('git', ['show', '9644d030:' + f], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }); git('artist-room.mjs'); } catch { git = null; }
if (git) {
  // (the frozen copies start with a comment header; the 9644d030 files start with their imports)
  const body = f => { const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n'); return lines.slice(lines.findIndex(l => !l.startsWith('//'))); };
  const roomOld = git('artist-room.mjs').split('\n'), room = body('artist-room-classic.mjs');
  assert.equal(room.length, roomOld.length, 'artist-room-classic.mjs: the 9644d030 file and its header');
  const diff = room.map((l, i) => l === roomOld[i] ? null : i).filter(i => i !== null);
  assert.deepEqual(diff, [4], 'artist-room-classic.mjs differs from 9644d030 only in its artist-studio-detail import');
  assert.equal(room[4], roomOld[4].replace("'./artist-studio-detail.mjs?v=artist-studio-20261025'", "'./artist-studio-detail-classic.mjs'"));
  assert.deepEqual(body('artist-studio-detail-classic.mjs'), git('artist-studio-detail.mjs').split('\n'), 'artist-studio-detail-classic.mjs is the 9644d030 file');
} else console.log('room-looks-test: (no git object 9644d030 here: the frozen-copy check skipped)');

// ---- 3. both looks build (no GPU: canvases are stubs, image and model loads never arrive)
const context = () => new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: s.length * 7 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get: (o, k) => k in o ? o[k] : () => {} });
const element = () => ({ width: 512, height: 512, style: {}, getContext: context, addEventListener() {}, removeEventListener() {}, setAttribute() {} });
globalThis.document = { createElement: element, createElementNS: element };
globalThis.fetch = async () => { throw Error('no network in this test'); };
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

// ---- the room code picks the look (workspace-3d.mjs needs a browser: its dispatch is read from the source)
const ws = fs.readFileSync(path.join(root, 'workspace-3d.mjs'), 'utf8');
assert.match(ws, /import \{ buildArtistRoom as buildArtistRoomClassic \} from '\.\/artist-room-classic\.mjs';/);
assert.match(ws, /this\.look = lookOf\(id, options\.look\)/);
assert.match(ws, /else if \(id === 'creative'\) \(this\.look === 'classic' \? buildArtistRoomClassic : buildArtistRoom\)\(this, root/);
assert.match(ws, /id === 'decor-bamboo' && lookOf\(roomId, look\) !== 'classic'/, 'Classic keeps the library bamboo');
const people = fs.readFileSync(path.join(root, 'room-people.mjs'), 'utf8');
assert.equal((people.match(/room\.id === 'creative'|this\.room\.id === 'creative'/g) || []).length, 0, 'room-people.mjs gates the pass\'s cast finishes on the look (refreshedCast), not on the room alone');
assert.match(fs.readFileSync(path.join(root, 'experience', 'stage.mjs'), 'utf8'), /api\.setRoomLook\?\.\(next\.room,next\.look\?\?null\);\s*\n\s*if\(next\.layout\)/, 'the stage sets the look before it loads the room');

// ---- 4. the shot field
const { cleanShot, cleanCut } = await import('../experience/cuts.mjs');
const base = { id: 'create', room: 'creative', layout: 'house', mode: 'afternoon', kind: 'room', seconds: 20, title: 'Create' };
assert.equal(cleanShot({ ...base, look: 'classic' }).look, 'classic');
assert.equal(cleanShot({ ...base, look: 'refresh' }).look, 'refresh', 'an explicit default is kept (it is part of the chapter key)');
assert.equal('look' in cleanShot(base), false, 'absent stays absent: no existing chapter key changes');
assert.equal('look' in cleanShot({ ...base, look: 'bogus' }), false);
assert.equal('look' in cleanShot({ ...base, room: 'home', layout: 'house', look: 'classic' }), false);
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
  assert.match(src, /if isinstance\(shot\.get\('look'\), str\) and LOOK\.fullmatch\(shot\['look'\]\): dc\['look'\] = shot\['look'\]\n\s*elif 'look' in before: dc\['look'\] = before\['look'\]/);
  const probe = path.join(tmp, 'probe.py');
  fs.writeFileSync(probe, `import sys, json, types, re\nsrc = open(sys.argv[1]).read()\nstart = src.index("LOOK = re.compile"); end = src.index("_fin = lambda")\nns = {'re': re, 'os': __import__('os'), 'json': json, 'H': sys.argv[2], 'CUT': sys.argv[2] + '/review-cut.json'}\nns['load'] = lambda p: json.load(open(p))\ndef dump(p, d, indent=1):\n    if ns['load'](p) == d: return False\n    json.dump(d, open(p, 'w')); return True\nns['dump'] = dump\nexec(src[start:end], ns)\nprint(json.dumps(ns['apply_look']('create', None, 'classic')))\nprint(json.dumps(ns['apply_look']('create', None, 'classic')))\n`);
  const out = execFileSync(PY, [probe, path.join(root, 'tools/experience/build-round8-director.py'), tmp], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(out.map(l => JSON.parse(l)), [['review-cut.json'], []], 'the pass writes the look once, then leaves the cut alone');
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'review-cut.json'), 'utf8')).shots[0].look, 'classic');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log('room-looks-test: ok (look list, frozen Classic = 9644d030, both looks build, shot field round trip, film import and pass)');
