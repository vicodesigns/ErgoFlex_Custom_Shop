// Frame by frame (30 fps): a point's position after vs before (cm), and the before's distance to its own low-pass (its shake).
//   node docs/rise-jitter-landing/dev-trace.mjs <before> <after> <point e.g. palm_l> <from> <to>
import { keysOf, pointsAt, range, THREE } from './kin-lib.mjs';
const [bf, af, p, a, b] = process.argv.slice(2), B = keysOf(bf), A = keysOf(af);
const ts = range(+a - 0.4, +b + 0.4, 30), pb = ts.map(t => pointsAt(B, t)[p]), pa = ts.map(t => pointsAt(A, t)[p]);
const lp = i => { const s = 3, v = new THREE.Vector3(); let sw = 0; for (let k = -9; k <= 9; k++) { const j = Math.min(ts.length - 1, Math.max(0, i + k)), w = Math.exp(-k * k / (2 * s * s)); v.addScaledVector(pb[j], w); sw += w; } return v.multiplyScalar(1 / sw); };
ts.forEach((t, i) => { if (t < +a - 1e-9 || t > +b + 1e-9) return; const d = pa[i].distanceTo(pb[i]) * 100, sh = pb[i].distanceTo(lp(i)) * 100; console.log(t.toFixed(3), 'after-before', d.toFixed(2).padStart(6), ' before-shake', sh.toFixed(2).padStart(6), ' after-vs-lp(before)', (pa[i].distanceTo(lp(i)) * 100).toFixed(2).padStart(6), '#'.repeat(Math.round(d * 10))); });
