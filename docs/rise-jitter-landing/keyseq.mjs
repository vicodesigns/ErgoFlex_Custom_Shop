// A bone's own key sequence over a span: time, ease, angle to the previous key of that bone, angle to the span's mean, the
// key's euler-ish rotation vector (deg).   node docs/rise-jitter-landing/keyseq.mjs <keys file> <bone> <from> <to>
import { keysOf, THREE, angDeg, R2D } from './kin-lib.mjs';
const [file, bone, a, b] = process.argv.slice(2), keys = keysOf(file);
const ks = keys.filter(k => k.pose[bone] && k.t >= +a && k.t <= +b);
const qs = ks.map(k => new THREE.Quaternion().fromArray(k.pose[bone]).normalize());
const m = new THREE.Quaternion(0, 0, 0, 0); for (const q of qs) { const s = q.dot(qs[0]) < 0 ? -1 : 1; m.x += s * q.x; m.y += s * q.y; m.z += s * q.z; m.w += s * q.w; } m.normalize();
ks.forEach((k, i) => {
    const q = qs[i], d = m.clone().invert().multiply(q); if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
    const s = Math.hypot(d.x, d.y, d.z), ang = 2 * Math.atan2(s, d.w), rv = s > 1e-9 ? [d.x, d.y, d.z].map(c => c / s * ang * R2D) : [0, 0, 0];
    console.log(k.t.toFixed(3), (k.ease || 'smooth').padEnd(6), 'dPrev', (i ? angDeg(qs[i - 1], q) : 0).toFixed(1).padStart(6), 'dMean', angDeg(m, q).toFixed(1).padStart(6), 'rv', rv.map(x => x.toFixed(1).padStart(7)).join(''), Object.keys(k.pose).length);
});
