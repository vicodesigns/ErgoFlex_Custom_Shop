// Key-by-key diff of two exports' people-maya-sit-type pose keys (angle per bone, degrees).
//   node diff-keys.mjs <A doc> <B doc>
import { keysOf, THREE, angDeg } from './kin-lib.mjs';
const [af, bf] = process.argv.slice(2), A = keysOf(af), B = keysOf(bf);
const q = a => new THREE.Quaternion().fromArray(a);
const times = [...new Set([...A, ...B].map(k => k.t))].sort((x, y) => x - y);
for (const t of times) {
    const a = A.find(k => Math.abs(k.t - t) < 1e-6), b = B.find(k => Math.abs(k.t - t) < 1e-6);
    if (!a || !b) { console.log(t.toFixed(3), a ? 'only A' : 'only B', Object.keys((a || b).pose).length, 'bones', (a || b).ease || 'smooth'); continue; }
    const bones = [...new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])];
    const d = bones.map(n => [n, a.pose[n] && b.pose[n] ? angDeg(q(a.pose[n]), q(b.pose[n])) : -1]).filter(([, x]) => x !== 0);
    if (d.length || (a.ease || '') !== (b.ease || '')) console.log(t.toFixed(3), 'ease', a.ease || 'smooth', b.ease || 'smooth', d.map(([n, x]) => `${n}:${x < 0 ? 'missing' : x.toFixed(1)}`).join(' '));
}
