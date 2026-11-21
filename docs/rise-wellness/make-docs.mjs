// Writes the export docs the Director importer reads (tools/experience/build-round8-director.py <cut> --import <doc>) for the Nov 21 fixes:
// the cut's latest export doc of the chapter as the base, only the changed parts replaced (taken from the cut's chapter as this branch has it).
//   node docs/rise-wellness/make-docs.mjs <outdir>
//   rise (both cuts):     seconds 28.5 (name too), camera key times (fractions of the new length; positions, aims, lenses, labels as they were),
//                         motion clips (standing: the lift-down and its tilt 5 s later), peopleEdits = the chapter's people (pose keys; standing: when)
//   wellness (both cuts): peopleEdits.when.maya-break and peopleEdits.chair. Seated base: Vico's export 4a6490412a50. The standing cut has no
//                         wellness export: its base is the Director form of its chapter (director-bridge.py link --json) + its people.
// What the docs do NOT carry (the Director has no field for it; docs/rise-wellness/apply-rise.py <cut> B|A <patch> --only-extras sets it after the
// importer's pass): rise screens[phone].brightness, timeOfDay, ledNeutral.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [outDir] = process.argv.slice(2), rd = f => JSON.parse(fs.readFileSync(f, 'utf8')), E = 'exports/cinematic-intro-cut-vicos-3rd-cut';
const camKeys = (shot, old) => shot.cameraPlan.keys.map((k, i) => {
    const o = old?.find(x => (k.label || '').startsWith(x.label || '\u0000') && JSON.stringify(x.view.position) === JSON.stringify(k.position));
    return { id: o?.id || 'plan-' + String(i).padStart(2, '0'), time: Math.round(k.at / shot.seconds * 1e6) / 1e6, label: (k.label || '').slice(0, 60), easing: o?.easing || (i === 0 || i === shot.cameraPlan.keys.length - 1 ? 'smooth' : 'linear'), view: o?.view ? { ...o.view, position: k.position, target: k.target, fov: k.fov } : { position: k.position, target: k.target, fov: k.fov, aspect: 16 / 9 } };
});
const people = (dir, id) => { const p = rd(dir + '/director-camera-' + id + '.json').people; return p.v ? p : { v: 2, ...p }; };
function rise(dir, baseDoc, name) {
    const doc = rd(baseDoc), s = doc.shots[0], film = rd(dir + '/director-film/rise.json');
    s.seconds = film.seconds; doc.name = `Film chapter: rise (${film.seconds} s)`; doc.updated = '2026-11-21T12:00:00.000Z';
    s.camera = { ...s.camera, keys: camKeys(film, s.camera.keys) }; s.motion = { ...s.motion, clips: film.motion.clips }; s.peopleEdits = people(dir, 'rise');
    fs.writeFileSync(`${outDir}/${name}`, JSON.stringify(doc, null, 2));
}
function wellness(dir, baseDoc, name, meta) {
    let doc;
    if (baseDoc) doc = rd(baseDoc);
    else { const tmp = outDir + '/_link.json'; execFileSync('C:/Python312/python', ['tools/experience/director-bridge.py', 'link', dir + '/director-film/wellness.json', '--json', tmp], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }); doc = rd(tmp); fs.unlinkSync(tmp); Object.assign(doc, meta); }
    const s = doc.shots[0], p = people(dir, 'wellness'); doc.updated = '2026-11-21T12:00:00.000Z';
    if (s.peopleEdits) { s.peopleEdits.when = p.when; s.peopleEdits.chair = p.chair; } else s.peopleEdits = p;
    fs.writeFileSync(`${outDir}/${name}`, JSON.stringify(doc, null, 2));
}
rise(E, E + '/director-exports/export-c347a593f167-Film-chapter-rise-pull-merged.json', 'rise2-seated-export.json');
rise(E + '-standing', E + '-standing/director-exports/export-f76aa5dde536-Film-chapter-rise-pull.json', 'rise2-standing-export.json');
wellness(E, E + '/director-exports/export-4a6490412a50-Film-chapter-wellness-19-5-s-.json', 'wellness2-seated-export.json');
wellness(E + '-standing', null, 'wellness2-standing-export.json', { id: 'film-vicos-3rd-cut-standing-wellness', client: 'Vicos 3rd cut, standing stretch', volume: 0.32 });
console.log('ok');
