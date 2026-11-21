// After the importer round trip on scratch copies: the rise shot's people-maya-sit-type poseKeys in review-cut.json and
// director-film/rise.json of A (Vico's raw export imported) and B (the exit-fix doc imported):
//   B == the doc's keys exactly; A == Vico's keys exactly; A and B identical up to and including S; the rest of the rise shot equal.
//   node verify-import.mjs <scratch A cut> <scratch B cut> <vico export> <fix doc> [S=21.133]
import fs from 'node:fs';
import { keysOf } from './kin-lib.mjs';
const [A, B, vf, df, Sa] = process.argv.slice(2), S = +(Sa ?? 21.133);
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const canon = ks => ks.map(k => JSON.stringify({ t: k.t, ease: k.ease || 'smooth', pose: Object.fromEntries(Object.entries(k.pose).sort()) }));
const shotOf = (dir, f) => { const d = J(dir + '/' + f); return d.shots ? d.shots.find(s => s.id === 'rise') : d; };
const keysIn = sh => sh.people.cast.find(c => c.key === 'maya-stand').postures['people-maya-sit-type'].poseKeys;
const V = canon(keysOf(vf)), F = canon(keysOf(df)); let ok = true;
for (const f of ['review-cut.json', 'director-film/rise.json']) {
    const a = shotOf(A, f), b = shotOf(B, f), ka = canon(keysIn(a)), kb = canon(keysIn(b));
    const eqA = JSON.stringify(ka) === JSON.stringify(V), eqB = JSON.stringify(kb) === JSON.stringify(F);
    const nPre = keysIn(a).filter(k => k.t <= S + 1e-6).length, preEq = JSON.stringify(ka.slice(0, nPre)) === JSON.stringify(kb.slice(0, nPre)) && keysIn(b).filter(k => k.t <= S + 1e-6).length === nPre;
    const strip = s => { const c = JSON.parse(JSON.stringify(s)); delete c.directorEdited; keysIn(c).length = 0; return JSON.stringify(c); };
    const restEq = strip(a) === strip(b);
    console.log(`${f}: A keys ${ka.length} == Vico's export: ${eqA}; B keys ${kb.length} == fix doc: ${eqB}; first ${nPre} keys (t <= ${S}) identical: ${preEq}; rest of the rise shot identical (directorEdited aside): ${restEq}`);
    const tb = keysIn(b); console.log(`   B: keys after ${S}: ${tb.filter(k => k.t > S + 1e-6).length} (${tb.find(k => k.t > S + 1e-6)?.t} .. ${tb[tb.length - 1].t}); A: keys after ${S}: ${keysIn(a).filter(k => k.t > S + 1e-6).length}`);
    ok = ok && eqA && eqB && preEq && restEq;
}
console.log(ok ? 'OK' : 'MISMATCH'); process.exit(ok ? 0 : 1);
