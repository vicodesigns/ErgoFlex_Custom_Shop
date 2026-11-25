// Chapter 12 hero desk props (polish1124 Stream D): the library entries, their GLBs, and (when a draft is given) that every
// add edit carries its desk and that desk's show window.   node tests/hero-desk-props-test.mjs [draft.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')).props;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/props/manifest.json'), 'utf8')).props;
const items = index.filter(p => p.converter === 'hero-desk-props');
assert.equal(items.length, 22, 'the 22 approved props (no headset, no alternatives)');
assert.ok(!items.some(p => /headset/.test(p.id)), 'the headset was dropped (Vico, Nov 24)');
const glb = file => { const b = fs.readFileSync(path.join(root, file)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };
for (const p of items) {
  assert.ok(manifest.some(m => m.id === p.id), p.id + ' in the manifest');
  assert.ok(fs.existsSync(path.join(root, p.file)), p.id + ' file');
  assert.ok(p.bytes < 200000, p.id + ' small payload');
  assert.ok(['artist', 'architect', 'office'].includes(p.heroDesk?.desk), p.id + ' desk');
  assert.ok(p.size.every(v => v > 5 && v < 700), p.id + ' real-world size ' + p.size);
  const j = glb(p.file);
  assert.ok(j.extensionsUsed?.includes('EXT_meshopt_compression'), p.id + ' meshopt');
  if (p.id !== 'ergoflex-mic-boom-arm') { assert.ok(Math.abs(p.min[1]) < 8, p.id + ' floor anchored (leaning items dip a few mm)'); assert.equal(j.meshes.length, 1, p.id + ' one mesh (draw calls)'); }
}
const mic = items.find(p => p.id === 'ergoflex-mic-boom-arm'), mj = glb(mic.file);
assert.equal(mic.heroDesk.desk, 'office');
for (const k of ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']) assert.ok(mj.nodes.some(n => (n.name || '').startsWith(k + ' ')), 'mic joint ' + k);
assert.ok(mj.materials.some(m => m.name === 'Plug · polished aluminum'), 'the hook plug material');
// the photo and the painting carry real pictures
for (const id of ['herodesk-office-photo-frame', 'herodesk-art-canvas']) assert.ok((glb(index.find(p => p.id === id).file).images || []).length >= 1, id + ' image');
// film-fx: screens on added props install after the edits (opt-in afterEdits)
const fx = fs.readFileSync(path.join(root, 'tools/experience/film-fx.mjs'), 'utf8');
assert.match(fx, /if \(!!spec\.afterEdits !== late\) continue;/); assert.match(fx, /installLateScreens\(shot\)/);
// a draft: every add of ours carries its desk and the desk's show window
const SHOW = {artist: {from: 0, to: 5.13, fadeOut: 0.3}, architect: {from: 0.3, to: 5.15, fadeIn: 0.25, fadeOut: 0.3}, office: {from: 0.3, to: 6.33, fadeIn: 0.25, fadeOut: 0.3}};
const draftFile = process.argv[2];
if (draftFile) {
  const d = JSON.parse(fs.readFileSync(draftFile, 'utf8')), edits = (d.shots?.[0]?.propEdits || d.sceneEdits || []).filter(e => e.add && items.some(p => p.id === e.add.asset));
  assert.equal(edits.length, 22, 'all 22 placed');
  for (const e of edits) { const want = items.find(p => p.id === e.add.asset).heroDesk.desk; assert.equal(e.desk, want, e.id); assert.deepEqual(e.show, SHOW[want], e.id + ' show window'); }
}
console.log('PASS: hero desk props (' + items.length + ')' + (draftFile ? ' and the draft\'s desks and show windows' : ''));
