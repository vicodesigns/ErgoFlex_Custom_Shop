// Writes the Wellness (ch 7) export doc for the Director importer (tools/experience/build-round8-director.py <cut> --import <doc>):
// Vico's 3rd cut, the new order (Nov 21 2026): sit, the desk rises and she stands, types standing, NOTICES the reminder,
// does the Desk Squats, the desk lowers, the chair comes back, she sits and types, the routine highlighted on the screens.
//   node docs/wellness-order/make-doc.mjs <timeline.json> <out doc.json>
// Base: the cut's latest imported Wellness export, director-exports/export-b180692918b0-Film-chapter-wellness2-seated.json
// (= Vico's raw export 4a6490412a50 + agent A's peopleEdits, the chapter as the cut has it now). Replaced in it:
//   seconds (and the doc's name), motion.clips (the rise re-timed, the lowering added: same 13 in / 5 s smooth as Vico's rise),
//   camera keys (re-timed; positions / aims / lenses as they were, one label), peopleEdits (when, act, chair kept, the
//   break's finger keys moved with its window, the desk user's noticing keys), ledStatus (lift-up + lift-down).
//   The screens are not in the doc: the film keeps its two clips (same files), re-captured for this timing
//   (tools/experience/screens/clips.mjs cine3b-wellness-*, scenes/cine-wellness.js opts.notice).
// Nothing else of the base is touched.
import fs from 'node:fs';
const [tlFile, out] = process.argv.slice(2), rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const E = 'exports/cinematic-intro-cut-vicos-3rd-cut', BASE = E + '/director-exports/export-b180692918b0-Film-chapter-wellness2-seated.json';
const TL = rd(tlFile), doc = rd(BASE), s = doc.shots[0], r3 = x => Math.round(x * 1000) / 1000;
const T = TL.seconds;
doc.name = `Film chapter: wellness (${T} s)`; doc.updated = '2026-11-21T18:00:00.000Z';
s.seconds = T;
// the desk: the rise re-timed, the lowering after the squats (Vico's own clip and speed: 13 in over 5 s, smooth)
const rise = s.motion.clips.find(c => c.id === 'stand-break');
s.motion = { ...s.motion, clips: [{ ...rise, start: TL.rise }, { id: 'sit-back', lane: 'lift', kind: 'lift', start: TL.lower, duration: rise.duration, easing: rise.easing, label: 'Back to sitting', target: s.motion.initial.height }] };
// camera: Vico's keys, each at its new time (TL.camera: [old time -> new time]; a key may be held twice, `hold`)
const keys = s.camera.keys, byOld = new Map(keys.map(k => [Math.round(k.time * 19.5 * 1000) / 1000, k]));
s.camera = { ...s.camera, keys: TL.camera.map(([old, at, label], i) => { const k = byOld.get(old); if (!k) throw Error('no camera key at ' + old); return { ...k, id: i < keys.length && TL.camera.filter(c => c[0] === old).length === 1 ? k.id : k.id + '-' + i, time: r3(at / T) === 1 ? 1 : Math.round(at / T * 1e6) / 1e6, ...(label ? { label } : {}) }; }) };
// people
const P = structuredClone(s.peopleEdits), brk = P.cast.find(c => c.key === 'maya-break'), desk = P.cast.find(c => c.key === 'maya-stand');
const shift = TL.when[0] - P.when['maya-break'][0][0];
P.when['maya-break'] = [[TL.when[0], TL.when[1], ...P.when['maya-break'][0].slice(2)]];
brk.act = { ...brk.act, at: TL.act.at, dur: TL.act.dur, reps: TL.act.reps };
for (const k of brk.postures['people-maya-stand-type'].poseKeys) k.t = r3(k.t + shift);   // (the finger keys of the step out, with it)
if (TL.notice) desk.postures = { ...(desk.postures || {}), 'people-maya-stand-type-41': { poseKeys: TL.notice } };
if (TL.chair) P.chair = TL.chair;
s.peopleEdits = P;
// the status light: Vico's lift-up re-timed, a lift-down for the lowering
s.ledStatus = [{ at: TL.rise, dur: rise.duration, kind: 'lift-up', fade: 1 }, { at: TL.lower, dur: rise.duration, kind: 'lift-down', fade: 1 }];
// (screens: not in the doc: the film keeps its two clips, the same files, re-captured for this timing)
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('wrote', out, T, 's; clips', JSON.stringify(s.motion.clips.map(c => [c.id, c.start, c.duration, c.target])), 'when', JSON.stringify(P.when), 'act', JSON.stringify(brk.act), 'finger keys shifted', r3(shift));
