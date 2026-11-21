// Builds the calm overhead-triceps-stretch pose keys (the by-key patch) for Maya, seated and standing.
//   node docs/rise-wellness/build-rise.mjs <rise-calm.json> <out patch.json> [seated|standing]
// rise-calm.json: { seated|standing: { base: "<cut / shot / export holding the keys to build on>", poses: {name: spec}, rest: <t of the base key that is
//   the typing correction>, keepBefore: <keep the base keys up to this t>, tail: [[t of a base key, new t], ...] (base keys put back after the stretch),
//   moves: [ {t0, t1, path: [pose names], lag?: {r|l: seconds}, fingers?: [u0, u1]} | {t, pose} (a held key, smooth ease) ] } }
// A pose spec is the Rise pull's ({p, stretch} the solved elbow pull, {direct} arm directions; rise-pull-poses.mjs), or "@rest" (the typing correction).
// A move is ONE continuous motion through its path poses: per bone a Catmull-Rom spline through the poses' turns (normalised), run on a
// minimum-jerk clock (zero speed and acceleration at both ends, one speed bell, no stop at the poses in between), written as keys every 1/15 s
// with ease 'linear'. The keys before / after a move ease 'smooth' (the holds: grip, deeper pull, slow release).
import fs from 'node:fs';
import { cleanPoseKeys } from '../../people-pose-keys.mjs';
import { loader, baseKeys, BONES, FINGERS } from './rise-pull-poses.mjs';
import { fkAt } from './rise-pull-lib.mjs';
const STEP = 1 / 15;
const minJerk = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 - 15 * x + 6 * x * x);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
const norm = q => { const n = Math.hypot(...q) || 1; return q.map(c => c / n); };
// Catmull-Rom through unit quaternions q[0..n] at u in [0, 1] (knots at `at`, default uniform), in R4 then normalised; signs made continuous first
function splineQ(qs, u, at) {
    const n = qs.length - 1; if (n === 0) return qs[0];
    const q = [qs[0]]; for (let i = 1; i <= n; i++) q.push(dot(q[i - 1], qs[i]) < 0 ? qs[i].map(c => -c) : qs[i]);
    const kn = at || q.map((_, i) => i / n);
    let i = 0; while (i < n - 1 && u > kn[i + 1]) i++;
    const h = kn[i + 1] - kn[i], x = Math.min(1, Math.max(0, (u - kn[i]) / h));
    const tan = j => j === 0 ? q[1].map((c, k) => (c - q[0][k]) / (kn[1] - kn[0])) : j === n ? q[n].map((c, k) => (c - q[n - 1][k]) / (kn[n] - kn[n - 1])) : q[j + 1].map((c, k) => (c - q[j - 1][k]) / (kn[j + 1] - kn[j - 1]));
    const m0 = tan(i), m1 = tan(i + 1), x2 = x * x, x3 = x2 * x;
    return norm(q[i].map((c, k) => (2 * x3 - 3 * x2 + 1) * c + (x3 - 2 * x2 + x) * h * m0[k] + (-2 * x3 + 3 * x2) * q[i + 1][k] + (x3 - x2) * h * m1[k]));
}
const slerpId = (a, b, k) => { const bb = dot(a, b) < 0 ? b.map(c => -c) : b; return norm(a.map((c, i) => c * (1 - k) + bb[i] * k)); };
export async function build(cfg, which) {
    const c = cfg[which], { POST, poseOf } = await loader(which), keys0 = baseKeys(c.base, POST);
    const keyAt = t => keys0.find(k => Math.abs(k.t - t) < 1e-6) || (() => { throw new Error('no base key at ' + t); })();
    const ID = [0, 0, 0, 1], allF = [...FINGERS('l'), ...FINGERS('r')];
    const full = p => { const o = {}; for (const b of BONES) o[b] = p[b] || ID; for (const b of allF) o[b] = p[b] || ID; return o; };
    const P = { '@rest': full(keyAt(c.rest).pose) };
    for (const [name, spec] of Object.entries(c.poses)) P[name] = typeof spec === 'string' && spec.startsWith('@key:') ? full(Object.fromEntries(Object.entries(keyAt(+spec.slice(5)).pose).filter(([b]) => BONES.includes(b)))) : full(poseOf(spec));
    const out = keys0.filter(k => k.t <= c.keepBefore + 1e-6).map(k => JSON.parse(JSON.stringify(k)));
    const side = b => b.slice(-1);
    for (const m of c.moves) {
        if (m.t !== undefined) { out.push({ t: m.t, pose: JSON.parse(JSON.stringify(P[m.pose])) }); continue; }
        const path = m.path.map(n => P[n] || (() => { throw new Error('no pose ' + n); })()), dur = m.t1 - m.t0, n = Math.round(dur / STEP), [f0, f1] = m.fingers || [0, 1];
        // knots by chord length (the turn of the upper arm + the forearm between consecutive path poses, the larger arm's), so the speed is one bell
        if (!m.at) {
            const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(dot(a, b)))), cum = [0];
            for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.max(1e-3, ...['l', 'r'].map(s => ang(path[k - 1]['upperarm_' + s], path[k]['upperarm_' + s]) + ang(path[k - 1]['lowerarm_' + s], path[k]['lowerarm_' + s]))));
            m.at = cum.map(v => v / cum[cum.length - 1]);
        }
        // per arm, its wrist's travel along the spline (FK; the elbow's at half weight):
        //   clock 'travel' (default: a raise, a lowering): the spline is run by distance travelled, so the wrist's speed is the clock's one bell
        //   clock 'knots' (the switch, where the hands open and close again and the path turns back on itself): the knots are placed by the
        //       travel between the poses and the spline is run by its own parameter, so it slows through the turn, as a hand does, instead
        //       of flipping its velocity at full speed (run by distance, the wrist reversed inside one frame)
        const N = 240, run = {};
        for (const s of ['l', 'r']) {
            let at = m.at.slice(), cum;
            for (let pass = 0; pass < (m.clock === 'knots' ? 2 : 1); pass++) {
                cum = [0]; let prev = null;
                for (let j = 0; j <= N; j++) { const pose = {}; for (const b of BONES) if (side(b) === s) pose[b] = splineQ(path.map(p => p[b]), j / N, at); const fk = fkAt(POST, pose, 'rest'), W = fk.P('hand_' + s), E = fk.P('lowerarm_' + s); if (prev) cum.push(cum[j - 1] + W.distanceTo(prev.W) + 0.5 * E.distanceTo(prev.E)); prev = { W, E }; }
                if (m.clock !== 'knots') break;
                const cumAt = u => { const x = Math.min(N - 1e-9, u * N), j = Math.floor(x); return cum[j] + (cum[j + 1] - cum[j]) * (x - j); };
                at = at.map(u => cumAt(u) / cum[N]); for (let k = 1; k < at.length; k++) at[k] = Math.max(at[k], at[k - 1] + 0.02); at = at.map(u => u / at[at.length - 1]);
            }
            const byTravel = x => { const want = x * cum[N]; let j = 0; while (j < N - 1 && cum[j + 1] < want) j++; return (j + (want - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j])) / N; };
            run[s] = { at, u: m.clock === 'knots' ? x => x : byTravel };
        }
        for (let i = 0; i <= n; i++) {
            const t = i === n ? m.t1 : m.t0 + i * STEP, pose = {};
            for (const b of BONES) {
                const lag = m.lag?.[side(b)] || 0, lead = m.lead?.[side(b)] || 0;   // (an arm that starts later / arrives earlier inside the move's window: its own minimum-jerk clock)
                pose[b] = splineQ(path.map(p => p[b]), run[side(b)].u(minJerk((t - m.t0 - lag) / (dur - lag - lead))), run[side(b)].at);
            }
            // fingers: from the first pose's to the last pose's over the part [f0, f1] of the move (smoothstep)
            const x = Math.min(1, Math.max(0, ((t - m.t0) / dur - f0) / (f1 - f0))), w = x * x * (3 - 2 * x);
            for (const b of allF) pose[b] = slerpId(path[0][b], path[path.length - 1][b], w);
            out.push({ t, pose, ...(i < n ? { ease: 'linear' } : {}) });
        }
    }
    for (const [t, tNew] of c.tail || []) out.push({ ...JSON.parse(JSON.stringify(keyAt(t))), t: tNew });
    // a key at the same time as the one before (a move starting where a hold ends): the later one wins, as cleanPoseKeys merges them
    return { POST, keys: cleanPoseKeys(out), P };
}
if ((process.argv[1] || '').endsWith('build-rise.mjs')) {
    const [cfgFile, outFile, only] = process.argv.slice(2), cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')), out = {};
    for (const which of ['seated', 'standing']) { if (!cfg[which] || (only && only !== which)) continue; const r = await build(cfg, which); out[r.POST] = r.keys; console.log(which, r.keys.length, 'keys', r.keys[0].t, '..', r.keys.at(-1).t); }
    fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
}
