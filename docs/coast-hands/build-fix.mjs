// The coast hands fix, as data: Ava's corrections made continuous across the two model switches the film makes while she
// stands up (see README.md). Reads the chapter's `people` (director-film/coast.json .people) and writes the fixed one.
//   node build-fix.mjs <coast.json (film shot) | people.json> <out people.json>
// Two edits to the cast entry ava-sits, nothing else:
//   1. postures['people-ava-sit-type-30'] = a copy of postures['people-ava-sit-type'] (the Director's own "copy to the
//      other desk height": scene-people-editor.mjs copyToModel, structuredClone of the record). The film draws the 30 in
//      seated model from 4.35 s (the desk passes 29 in) and it had no correction: the arms lost the seated correction
//      in one frame.
//   2. postures['people-ava-stand-low'].poseKeys: two keys added (the three that are there stay as they are):
//      at SWAP_UP (5.35 s, when the standing model takes over) the turns the record already gives every bone there (so
//      nothing before changes), and at LAST_LOW (6.333 s, the last frame the film draws the 35.5 in standing model) the
//      turns ava-stands' own stand-mid correction has on the first frame the film draws stand-mid (6.367 s). Every
//      bone either record names is keyed in both, so the hand-over to stand-mid is the same turn on both sides.
import fs from 'node:fs';
import { poseAt } from '../../people-pose-keys.mjs';
const [inF, outF] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(inF, 'utf8')), people = structuredClone(src.people || src);
const SWAP_UP = 5.35, LAST_LOW = 6.333, FIRST_MID = 6.367;
const sits = people.cast.find(c => c.key === 'ava-sits'), stands = people.cast.find(c => c.key === 'ava-stands');
if (!sits || !stands) throw new Error('no ava-sits / ava-stands in this cast');
const P = sits.postures;
if (P['people-ava-sit-type-30']) throw new Error('ava-sits already has a sit-type-30 record: look before changing it');
// 1
P['people-ava-sit-type-30'] = structuredClone(P['people-ava-sit-type']);
// 2
const low = P['people-ava-stand-low'], mid = stands.postures['people-ava-stand-mid'];
const r4 = q => q.map(v => Math.round(v * 10000) / 10000 + 0);
const bones = [...new Set([...low.poseKeys, ...mid.poseKeys].flatMap(k => Object.keys(k.pose)))];
const at = (rec, t) => { const p = poseAt(rec, t) || {}; return Object.fromEntries(bones.map(b => [b, r4(p[b] || [0, 0, 0, 1])])); };
const from = at(low, SWAP_UP), to = at(mid, FIRST_MID);
if (low.poseKeys.some(k => k.t <= LAST_LOW + 1e-9)) throw new Error('stand-low already has keys before ' + LAST_LOW);
low.poseKeys = [{ t: SWAP_UP, pose: from }, { t: LAST_LOW, pose: to }, ...low.poseKeys];
fs.writeFileSync(outF, JSON.stringify(people, null, 1) + '\n');
const keyCount = Object.fromEntries(people.cast.filter(c => c.postures).flatMap(c => Object.entries(c.postures).map(([id, r]) => [c.key + ':' + id, r.poseKeys?.length || 0])));
console.log('wrote', outF, 'bones keyed at the hand-over:', bones.length, 'pose keys per record:', JSON.stringify(keyCount));
