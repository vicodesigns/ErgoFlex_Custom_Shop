#!/usr/bin/env node
// DRAFT (Vico's review of chapter 4, Commons, 26 Nov 2026): Mia while the desk drives to her.
//   1 phone   her phone was upside down to her (camera at the bottom): turned 180 degrees about its own screen normal, on the
//             charger (the prop's rotation) and in both grips (grip.q, grip2.q x Ry180). The same turn in both leaves every
//             hand position of the set-down exactly as it was (hand = prop x grip^-1); the screen still faces the same way.
//   2 glances cast 'mia-waits' .glances: she looks up from the phone at the desk (head, neck, eyes, a small smile);
//             keys are [leave the phone, on the desk, leave the desk, back] in chapter seconds (room-people.mjs `glances`).
//   3 ease    the wheels clip's last stretch: the same path, braking longer (speed falls as 1 - smoothstep over EASE s).
// Dry run by default:  node draft.cjs <cut.json> [--apply] [--out <file>]. Idempotent. Never point it at the live cut.
const fs = require('fs');
const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('usage: draft.cjs <cut.json> [--apply] [--out file]'); process.exit(2); }
const apply = rest.includes('--apply'), out = rest.includes('--out') ? rest[rest.indexOf('--out') + 1] : file;
if (apply && /^f:/i.test(require('path').resolve(out))) throw Error('Refusing to write under F:');
const cut = JSON.parse(fs.readFileSync(file, 'utf8')), shot = cut.shots.find(s => s.id === 'commons');
const EASE = 1.2, ARRIVE0 = 13.4;      // braking time of the new last stretch (s); the wheels clip's old end
const GLANCES = { at: 'desk', height: 1080, head: 1, smile: .34, keys: [[8.7, 9.15, 9.95, 10.4], [10.95, 11.35, 11.95, 12.3], [12.62, 13.05, 13.62, 14.1]] };
let changes = 0;
const note = (what, before, after) => { const a = JSON.stringify(before), b = JSON.stringify(after); if (a === b) return console.log(`= ${what}: already ${b}`); changes++; console.log(`~ ${what}\n    before ${a}\n    after  ${b}`); };

// 1 phone
const prop = shot.sceneEdits.find(e => e.id === 'mph01');
const waits = shot.people.cast.find(e => e.key === 'mia-waits');
if (!prop || !waits?.act?.grip || !waits.act.grip2) throw Error('Mia / her phone not found in the commons shot');
if (prop.rotation[0] || prop.rotation[2] || ![0, 180].includes(prop.rotation[1])) throw Error('the phone was turned by hand since: ' + JSON.stringify(prop.rotation));
const flipped = prop.rotation[1] === 180, r5 = v => Math.round(v * 1e5) / 1e5 + 0;
const ry180 = ([x, y, z, w]) => [-z, w, x, -y].map(r5);
const grips = ['grip', 'grip2'].map(k => [k, waits.act[k].q, flipped ? waits.act[k].q : ry180(waits.act[k].q)]);
note('sceneEdits mph01 rotation (the phone on the charger)', prop.rotation, [0, 180, 0]); prop.rotation = [0, 180, 0];
for (const [k, was, now] of grips) { note(`mia-waits act.${k}.q`, was, now); waits.act[k].q = now; }

// 2 glances
note('mia-waits glances', waits.glances ?? null, GLANCES); waits.glances = structuredClone(GLANCES);

// 3 ease
const wheels = shot.motion.clips.find(c => c.lane === 'wheels' && c.path?.length > 2);
const end0 = wheels.start + wheels.duration;
if (Math.abs(end0 - ARRIVE0) > 1e-6) console.log(`= wheels: arrival already ${end0.toFixed(3)} s (not ${ARRIVE0}): left alone`);
else {
  const P = wheels.path, T = P.map(p => wheels.start + p.time * wheels.duration), S = [0];
  for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i].pose.x - P[i - 1].pose.x, P[i].pose.z - P[i - 1].pose.z));
  const lerpIn = (X, Y, x) => { if (x <= X[0]) return Y[0]; let i = 1; while (i < X.length - 1 && X[i] < x) i++; const k = X[i] > X[i - 1] ? Math.min(1, (x - X[i - 1]) / (X[i] - X[i - 1])) : 1; return Y[i - 1] + (Y[i] - Y[i - 1]) * k; };
  const total = S.at(-1), v0 = (lerpIn(T, S, 12.2) - lerpIn(T, S, 11.2)), D = v0 * EASE / 2, s0 = total - D, Ts = lerpIn(S, T, s0), Te = Ts + EASE;
  const sNew = t => { const u = Math.min(1, Math.max(0, (t - Ts) / EASE)); return s0 + v0 * EASE * (u - u * u * u + u * u * u * u / 2); };
  const poseAtS = s => { let i = 1; while (i < S.length - 1 && S[i] < s) i++; const a = P[i - 1].pose, b = P[i].pose, k = S[i] > S[i - 1] ? Math.min(1, Math.max(0, (s - S[i - 1]) / (S[i] - S[i - 1]))) : 1;
    return Object.fromEntries(Object.keys(b).map(q => [q, Math.round((a[q] + (b[q] - a[q]) * k) * 1e4) / 1e4])); };
  const duration = Math.round((Te - wheels.start) * 1000) / 1000;
  const head = P.map((p, i) => ({ t: T[i], pose: p.pose })).filter(p => p.t < Ts - .01);
  const n = Math.min(40, 201 - head.length - 1), tail = Array.from({ length: n + 1 }, (_, i) => { const t = Ts + EASE * i / n; return { t, pose: i === n ? P.at(-1).pose : poseAtS(sNew(t)) }; });
  const path = [...head, ...tail].map((p, i, a) => ({ time: i === a.length - 1 ? 1 : Math.round((p.t - wheels.start) / duration * 1e6) / 1e6, pose: p.pose }));
  console.log(`  braking: steady ${v0.toFixed(2)} in/s, new stretch from ${Ts.toFixed(3)} s over the last ${D.toFixed(1)} in; path points ${P.length} -> ${path.length}, unchanged before ${Ts.toFixed(2)} s`);
  for (const t of [12.4, 12.6, 12.8, 13, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8]) {
    const o = x => lerpIn(T, S, x), m = x => x < Ts ? lerpIn(T, S, x) : sNew(x), v = f => ((f(t + .03) - f(t - .03)) / .06).toFixed(1);
    console.log(`    ${t.toFixed(2)} s  to go ${(total - o(t)).toFixed(1)} -> ${(total - m(t)).toFixed(1)} in   speed ${v(o)} -> ${v(m)} in/s`);
  }
  note('motion wheels duration (arrival = 7.2 + duration)', wheels.duration, duration);
  wheels.duration = duration; wheels.path = path;
  console.log(`  arrival ${end0.toFixed(2)} s -> ${(wheels.start + duration).toFixed(2)} s (+${(wheels.start + duration - end0).toFixed(2)} s); chapter ${shot.seconds} s unchanged`);
}
console.log(`${changes} change(s)`);
if (apply) { fs.writeFileSync(out, JSON.stringify(cut)); console.log('written ' + out); } else console.log('dry run: nothing written (--apply to write)');
