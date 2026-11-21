// Compares a chapter as the Director importer left it in a scratch copy of a cut with the same chapter in this checkout's cut.
//   node docs/rise-wellness/compare-import.mjs <scratch cut dir> <checkout cut dir> <chapter id> [more ids]
// Looks at review-cut.json's shot, director-film/<id>.json and director-camera-<id>.json; directorEdited (the importer's stamp) and
// director-camera's `source` (the path of the imported doc) are left out. Prints every differing path, or "equal".
import fs from 'node:fs';
const [a, b, ...ids] = process.argv.slice(2), rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
function walk(x, y, p, out) {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < 1e-9) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p + '/' + k, out); }
    else out.push(p + ': ' + String(JSON.stringify(x)).slice(0, 70) + ' | ' + String(JSON.stringify(y)).slice(0, 70));
}
let bad = 0;
for (const id of ids) {
    const pairs = [['review-cut.json shot', d => rd(d + '/review-cut.json').shots.find(s => s.id === id)], ['director-film/' + id + '.json', d => rd(d + '/director-film/' + id + '.json')], ['director-camera-' + id + '.json', d => rd(d + '/director-camera-' + id + '.json')]];
    for (const [name, get] of pairs) {
        const x = get(a), y = get(b); for (const o of [x, y]) { delete o.directorEdited; delete o.source; }
        const out = []; walk(x, y, '', out); bad += out.length;
        console.log(id + ' ' + name + ': ' + (out.length ? out.length + ' difference(s)\n  ' + out.slice(0, 12).join('\n  ') : 'equal'));
    }
}
process.exit(bad ? 1 : 0);
