// Coast (chapter 5), polish1124: Ava types while she stands. The 'Coast hands' keys of the 3rd cut curled every finger 4-10
// degrees from 6.33 s and held it to the end, which switches her finger taps off (room-people-motion.mjs poseTapWeight);
// tools/experience/drafts/polish1124-coast/build.py takes the finger channels out of those keys only.
//   node tests/coast-ava-typing-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {audit} from '../tools/experience/drafts/polish1124-coast/typing-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cut = path.join(root, 'exports/cinematic-intro-cut-vicos-3rd-cut');
const py = process.platform === 'win32' ? 'python' : 'python3';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coast-typing-'));
process.on('exit', () => fs.rmSync(tmp, {recursive: true, force: true}));

// the cut as it is: Ava's standing taps are off
const before = audit(cut).filter(r => r.chapter === 'coast' && (r.offL.length || r.offR.length));
assert.deepEqual(before.map(r => r.key).sort(), ['ava-sits', 'ava-stands'], 'the audit finds the bug in the cut as it is');

// the draft: the same chapter with the draft's people
execFileSync(py, [path.join(root, 'tools/experience/drafts/polish1124-coast/build.py'), cut, tmp], {stdio: 'pipe'});
const exp = JSON.parse(fs.readFileSync(path.join(tmp, 'Film-chapter-coast-polish1124-coast.json'), 'utf8'));
const shot = JSON.parse(fs.readFileSync(path.join(cut, 'director-film/coast.json'), 'utf8'));
const fixed = {...exp.shots[0].peopleEdits}; delete fixed.v;
const fake = path.join(tmp, 'cut'); fs.mkdirSync(path.join(fake, 'director-film'), {recursive: true});
fs.writeFileSync(path.join(fake, 'director-film/coast.json'), JSON.stringify({...shot, people: fixed}));
const after = audit(fake);
assert.deepEqual(after.filter(r => r.offL.length || r.offR.length), [], 'no typist in Coast has the taps switched off: ' + JSON.stringify(after));

// only finger channels went; every other bone of every key is Vico's, and nobody else changed
const fingers = b => /^(thumb|index|middle|ring|pinky)_/.test(b);
const by = c => Object.fromEntries(c.map(e => [e.key, e]));
const was = by(shot.people.cast), now = by(fixed.cast);
assert.deepEqual(Object.keys(now), Object.keys(was));
for (const [key, e] of Object.entries(was)) {
    if (!['ava-sits', 'ava-stands'].includes(key)) { assert.deepEqual(now[key], e, key + ' unchanged'); continue; }
    for (const [model, rec] of Object.entries(e.postures || {})) {
        const strip = (rec.poseKeys || []).map(k => ({...k, pose: Object.fromEntries(Object.entries(k.pose).filter(([b]) => !fingers(b)))})).filter(k => Object.keys(k.pose).length);
        assert.deepEqual(now[key].postures[model].poseKeys, strip, `${key} ${model}: only the finger channels are gone`);
    }
}
assert.deepEqual(exp.shots[0].camera, JSON.parse(fs.readFileSync(path.join(cut, 'director-import/ErgoFlex-film-ch05-coast-director.json'), 'utf8')).shots[0].camera, 'camera unchanged');
assert.equal(exp.shots[0].seconds, shot.seconds, 'length unchanged');
console.log(`coast-ava-typing-test: ok (before: taps off for ${before.map(r => r.key + ' ' + r.model).join(', ') || 'nobody'}; after: none)`);
