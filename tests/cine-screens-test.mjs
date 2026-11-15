// The cine cut's screens (stream S6, Nov 14 2026), without a browser:
//   - every cine clip in tools/experience/screens/clips.mjs has a scene that is defined and loaded by page.html, a shot
//     that is a chapter of the working cut, and goes to exports/cinematic-intro-cut-cine/screens/;
//   - build-screens.py names only clips of the manifest, writes ONLY the screens fields (review-cut.json and the finale's
//     versions), carries brightness over, uses offset 0 / loop false (the office version keeps its offset), keeps the
//     targets it does not own, holds coast back unless named, and is idempotent;
//   - the earlier scenes keep their defaults (the clips of the other cuts re-capture the same);
//   - every clip the cut names after build-screens is listed for the render PC (freeze-lists/win-exports.txt).
//   node tests/cine-screens-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCR = path.join(ROOT, 'tools/experience/screens'), CUTDIR = path.join(ROOT, 'exports/cinematic-intro-cut-cine');
const {CLIPS, CREATE_ACTS, COAST_PERSON, WELLNESS_BEATS, OILERS_BEATS} = await import(pathToFileURL(path.join(SCR, 'clips.mjs')).href);
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const page = read(path.join(SCR, 'page.html'));
const loaded = [...page.matchAll(/src="(scenes\/[^"]+)"/g)].map(m => m[1]);
const defined = new Map();
for (const f of loaded) for (const m of read(path.join(SCR, f)).matchAll(/SCENES\.(\w+) = \{/g)) defined.set(m[1], f);
const cut = JSON.parse(read(path.join(CUTDIR, 'review-cut.json'))), ids = new Set(cut.shots.map(s => s.id));

// 1. the manifest
const cine = CLIPS.filter(c => c.shot);
assert.equal(cine.length, 30, 'the cine clips are in the manifest (29 + the rise phone)');
assert(cine.some(c => c.id === 'cine-rise-phone' && c.target === 'phone' && c.opts.name === 'Maya'), 'the rise phone is a cine clip');
assert.equal(new Set(CLIPS.map(c => c.id)).size, CLIPS.length, 'clip ids are unique');
for (const c of cine) {
  assert(/^cine-/.test(c.id), c.id + ': cine- prefix');
  assert(defined.has(c.scene), `${c.id}: scene ${c.scene} defined in a page.html scene file`);
  assert(ids.has(c.shot), `${c.id}: shot ${c.shot} is a chapter of the cut`);
  assert.equal(c.out, 'exports/cinematic-intro-cut-cine/screens', c.id + ': written beside the cut');
  assert(c.w > 0 && c.h > 0 && Number.isInteger(c.w) && Number.isInteger(c.h), c.id + ': size');
}
assert(CREATE_ACTS.A > 0 && CREATE_ACTS.B > CREATE_ACTS.A, 'create acts in order');
assert(typeof COAST_PERSON === 'string' && COAST_PERSON, 'the coast person is named');
// wellness (S16's stretch): the beats in order inside the chapter, the stretch after the desk has started up
{
  const wel = cut.shots.find(x => x.id === 'wellness'), lift = wel.motion.clips.find(c => c.lane === 'lift'), B = WELLNESS_BEATS;
  assert(B.nudge < lift.start && lift.start < B.stretch && B.stretch < B.stretchEnd && B.stretchEnd <= B.breatheEnd && B.breatheEnd <= B.reset && B.reset + 1 <= wel.seconds, 'wellness beats in order, inside the chapter');
  for (const id of ['cine-wellness-main', 'cine-wellness-tablet']) assert.equal(cine.find(c => c.id === id).opts.stretch, B.stretch, id + ' gets the beats');
}
// oilers (S9's 15 s chapter): the beats sit where the story puts them, against the cut's own lift and Kai's typing
{
  const oil = cut.shots.find(x => x.id === 'oilers'), lift = oil.motion.clips.find(c => c.lane === 'lift'), landed = lift.start + lift.duration;
  const typing = (oil.people.when.kai || [[99]])[0][0];
  const B = OILERS_BEATS;
  assert(B.dock >= landed && B.tap >= typing && B.reveal > B.tap && B.dash > B.reveal && B.dash + .8 <= oil.seconds, 'oilers beats in order, inside the chapter');
  assert(B.reveal >= landed + 1, 'the reveal comes at least 1 s after the desk lands at 31 in');
  for (const id of ['cine-oilers-portrait', 'cine-oilers-laptop']) assert.deepEqual(Object.fromEntries(Object.keys(B).map(k => [k, cine.find(c => c.id === id).opts[k]])), B, id + ' gets the beats');
}
const kai = cine.find(c => c.id === 'cine-music-tv');
assert(!JSON.stringify(kai.opts).match(/kai/i) || kai.opts.rename?.nova_kai, 'the gaming room names no Kai (neutral handle, nova_kai renamed)');
assert(!/kai/i.test(kai.opts.handle), 'the stream handle is neutral');

// 2. build-screens on copies
const PY0 = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-screens-')), CUT = path.join(tmp, 'cut.json'), SUB = path.join(tmp, 'sub.json');
fs.writeFileSync(CUT, read(path.join(CUTDIR, 'review-cut.json'))); fs.writeFileSync(SUB, read(path.join(CUTDIR, 'shots/13-subshots.json')));
const run = (...a) => execFileSync(PY0, [path.join(CUTDIR, 'build-screens.py'), ...a], {env: {...process.env, SCREENS_CUT: CUT, SCREENS_SUB: SUB}, encoding: 'utf8'});
const before = JSON.parse(fs.readFileSync(CUT, 'utf8')), subBefore = JSON.parse(fs.readFileSync(SUB, 'utf8'));
// opt-in: a run without --only writes S6's own and the landed chapters only (OWNED_LANDED), nothing else
run();
const OWNED = new Set(['storage', 'hero', 'coast']);
for (const s0 of before.shots) if (!OWNED.has(s0.id)) assert.deepEqual(JSON.parse(fs.readFileSync(CUT, 'utf8')).shots.find(x => x.id === s0.id), s0, s0.id + ': not written without --only');
const ALL = 'awaken,rise,create,commons,coast,oilers,wellness,awareness,music,storage,hero';
run('--only', ALL);
const once = fs.readFileSync(CUT, 'utf8'), subOnce = fs.readFileSync(SUB, 'utf8');
const PY = PY0;
assert(!once.includes(String.fromCharCode(13)) && !once.endsWith(String.fromCharCode(10)), 'LF, no final newline');
assert.equal(execFileSync(PY, ['-c', 'import json,sys;d=open(sys.argv[1],"rb").read();print(json.dumps(json.loads(d),indent=1).encode()==d)', CUT], {encoding: 'utf8'}).trim(), 'True',
  'review-cut.json round-trips byte for byte through json.dumps(indent=1) (the working-cut rule)');
const after = JSON.parse(once), sub = JSON.parse(subOnce);
const byId = (c, id) => c.shots.find(s => s.id === id);
for (const s of before.shots) {
  const a = byId(after, s.id), {screens: _a, ...restA} = a, {screens: _b, ...restB} = s;
  assert.deepEqual(restA, restB, s.id + ': only screens changes');
}
assert.deepEqual(byId(after, 'media').screens, byId(before, 'media').screens, 'media keeps its film');
const manifest = new Set(cine.map(c => c.id));
const named = [];
for (const s of [...after.shots, ...sub.shots.map(v => ({...v, version: true}))]) for (const sc of s.screens || []) {
  const m = sc.src.match(/^exports\/cinematic-intro-cut-cine\/screens\/(cine-[\w-]+)\.(mp4|png)$/); if (!m) continue;
  assert(manifest.has(m[1]), `${s.id}: ${m[1]} is a manifest clip`); named.push(sc.src);
  if (m[2] === 'mp4') { assert.equal(sc.loop, false, sc.src + ' loop false'); const keep = s.version && (s.preset === 'office' || (s.preset === 'hbhs' && sc.target === 'main-portrait'));
    assert(keep ? sc.offset < 0 : sc.offset === 0, sc.src + ' offset'); }
}
const music = byId(after, 'music').screens, main = music.find(x => x.target === 'main-landscape');
assert(/09-game-montage\.mp4$/.test(main.src) && main.brightness === .55, 'music keeps the game montage on the main monitor');
assert.equal(music.find(x => x.target === 'arcade').brightness, .55, 'brightness carries over');
assert(/cine-rise-phone\.mp4$/.test(byId(after, 'rise').screens.find(x => x.target === 'phone').src), 'rise: the phone on the charger plays its cine clip');
const tex = [...byId(after, 'create').screens, ...byId(after, 'storage').screens].filter(x => x.target === 'texture');
assert.equal(tex.length, 2, 'the drafting paper and the phone in hand are texture targets');
assert(tex.some(x => x.mesh === '^Architect floor plan$') && tex.some(x => x.person === 'andre' && x.material === '^Held\\.phone screen'));
run('--only', ALL); assert.equal(fs.readFileSync(CUT, 'utf8'), once, 'idempotent'); assert.equal(fs.readFileSync(SUB, 'utf8'), subOnce, 'idempotent (versions)');
const subKeys = s => s.shots.map(({screens, ...r}) => r);
assert.deepEqual(subKeys(sub), subKeys(subBefore), 'the finale versions: only screens changes');
run('--only', 'coast');
{ // the hbhs version's portrait plays oilers' own quiz: its window maps into the votes (clip 1.0-7.4 s), offset kept by build-screens
  const v = sub.shots.find(v => v.preset === 'hbhs'), q = v.screens.find(x => x.target === 'main-portrait' && /cine-oilers-portrait/.test(x.src));
  assert(q && q.offset + v.renderRange[0] >= 1.0 - 1e-6 && q.offset + v.renderRange[1] <= 7.4 + 1e-6, 'hbhs version plays oilers own quiz at its offset'); }
assert(byId(after, 'create').screens.some(x => x.target === 'texture' && x.within === 'desk'), 'the drafting sheet is scoped to the featured desk');
const coast = byId(JSON.parse(fs.readFileSync(CUT, 'utf8')), 'coast').screens;
assert.equal(coast.filter(x => /cine-coast-/.test(x.src)).length, 4, 'coast lands when named');
for (const sc of coast) if (/cine-coast-/.test(sc.src)) named.push(sc.src);
assert.equal(coast.find(x => x.target === 'occ-display').brightness, .6, 'the wall keeps its brightness');

// 3. the earlier scenes keep their defaults
const ch02 = read(path.join(SCR, 'scenes/ch02.js')), ch12 = read(path.join(SCR, 'scenes/ch12.js'));
assert.match(ch02, /NAME = O\.name \|\| 'Alex', INITIALS = O\.initials \|\| 'AK'/);
assert.match(ch02, /O\.ck \|\| \[\[0, 480\], \[4, 512\], \[8, 655\], \[12, 840\], \[15, 1040\], \[17, 1080\]\]/);
assert.match(ch12, /const name = o\.name \?\? 'Alex';/);
assert.match(read(path.join(SCR, 'scenes/ch09.js')), /: 115\.2\)/, 'ch09 falls back to 115.2 BPM');
assert.match(read(path.join(SCR, 'scenes/ch09.js')), /TM\?\.first \?\? \.75/, 'and its first beat at 0.75 s');

// 4. the render PC gets every clip
const listed = new Set(read(path.join(ROOT, 'tools/experience/freeze-lists/win-exports.txt')).split('\n').map(l => l.trim()));
for (const src of new Set(named)) assert(listed.has(src), src + ' is in freeze-lists/win-exports.txt');
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`cine screens: ${cine.length} clips, build-screens opt-in per chapter, writes only screens (idempotent), defaults kept, freeze list complete: OK`);
