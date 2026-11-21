// The importer round trip, on scratch copies outside the repo (docs/wellness-order/imp.sh): <base> = a copy of the cut with only
// the pass run, <after> = the same copy with the export doc imported and the pass run. Lists every file that differs, every
// review-cut.json shot that differs (only wellness may), and for wellness every changed path outside the re-baked camera.
//   node docs/wellness-order/roundtrip-check.mjs <base cut dir> <after cut dir>
import fs from 'node:fs';
import path from 'node:path';
const [A, B] = process.argv.slice(2), rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const files = d => { const out = []; (function walk(p) { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); e.isDirectory() ? walk(q) : out.push(path.relative(d, q)); } })(d); return out.sort(); };
const fa = files(A), fb = files(B), all = [...new Set([...fa, ...fb])].sort();
const diff = all.filter(f => !fa.includes(f) || !fb.includes(f) || !fs.readFileSync(path.join(A, f)).equals(fs.readFileSync(path.join(B, f))));
console.log('files that differ:', diff.length ? diff.join(', ') : 'none');
const ca = rd(path.join(A, 'review-cut.json')), cb = rd(path.join(B, 'review-cut.json'));
console.log('review-cut.json top level other than shots equal:', JSON.stringify({ ...ca, shots: 0 }) === JSON.stringify({ ...cb, shots: 0 }));
console.log('shots that differ:', ca.shots.filter((s, i) => JSON.stringify(s) !== JSON.stringify(cb.shots[i])).map(s => s.id).join(', ') || 'none', '(of', ca.shots.length + ')');
const out = [];
function walk(x, y, p) {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y) && !(Array.isArray(x) && x.length !== y.length && x.every(v => typeof v !== 'object'))) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p + '/' + k); }
    else out.push(p + ': ' + String(JSON.stringify(x)).slice(0, 110) + '  ->  ' + String(JSON.stringify(y)).slice(0, 110));
}
const wa = ca.shots.find(s => s.id === 'wellness'), wb = cb.shots.find(s => s.id === 'wellness');
walk({ ...wa, camera: null, directorEdited: null }, { ...wb, camera: null, directorEdited: null }, '');
console.log(`wellness review-cut shot: ${out.length} changed path(s) besides the re-baked camera (${wa.camera.keys.length} -> ${wb.camera.keys.length} baked keys) and the importer stamp:`);
for (const l of out) console.log('  ' + l);
