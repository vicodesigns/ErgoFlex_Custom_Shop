#!/usr/bin/env node
// polish1124 coast (Nov 25 2026): which typists in a cut have their typing switched off, or their hands frozen, by pose keys.
//
//   node tools/experience/drafts/polish1124-coast/typing-audit.mjs <cut dir> [--json]
//
// For every chapter (<cut>/director-film/*.json) and every cast entry's per-model pose keys (postures[<model>].poseKeys,
// or the entry's own poseKeys for its id) on a TYPING model (room-people-motion.mjs TYPES: sit-type, stand-type, stand-mid,
// stand-low, stand-type-low, wheel-type, power-type, sit-laptop, sit-coffee, stand-coffee), reports:
//   off      seconds of the chapter where the keyed pose switches the finger taps off on a hand (poseTapWeight < 0.5: a
//            finger bone keyed past 0.08 rad, or the upper arm turned past 0.8 rad). The engine's own poseAt is used.
//   frozen   keys that are all the same pose (zero spread): a constant offset on the arms. This alone does NOT stop the
//            typing (the keys turn the bones on top of the motion and the taps still run) but is reported.
// Pure: reads the cut only.
import fs from 'fs'; import path from 'path'; import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..', '..', '..');
const { poseAt } = await import(url.pathToFileURL(path.join(ROOT, 'people-pose-keys.mjs')));
const TYPES = new Set(['sit-type', 'stand-type', 'stand-mid', 'stand-low', 'stand-type-low', 'wheel-type', 'power-type', 'sit-laptop', 'sit-coffee', 'stand-coffee']);
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const ang = q => Array.isArray(q) && q.length === 4 ? 2 * Math.acos(Math.min(1, Math.abs(q[3]))) : 0;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// room-people-motion.mjs poseTapWeight (copied: that module needs three.js)
export function tapWeight(pose, s) {
    if (!pose) return 1;
    const armW = 1 - ss(.45, .80, ang(pose['upperarm_' + s])); let m = 0;
    for (const f of FINGERS) for (let j = 1; j <= 3; j++) m = Math.max(m, ang(pose[`${f}_0${j}_${s}`]));
    return armW * (1 - ss(.015, .08, m));
}
export const postureOf = id => String(id || '').replace(/^people-[a-z]+-/, '').replace(/-\d+$/, '');
export const isFinger = bone => FINGERS.includes(String(bone).split('_')[0]);

export function audit(cut) {
    const dir = path.join(cut, 'director-film'), out = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
        const shot = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), secs = Number(shot.seconds) || 0;
        for (const e of shot.people?.cast || []) {
            const sets = Object.entries(e.postures || {}).map(([id, p]) => [id, p]);
            if (e.poseKeys?.length) sets.push([e.id, { poseKeys: e.poseKeys, pose: e.pose }]);
            for (const [id, p] of sets) {
                if (!p?.poseKeys?.length || !TYPES.has(postureOf(id))) continue;
                const off = { l: [], r: [] };
                for (let i = 0; i <= Math.round(secs * 20); i++) {
                    const t = i / 20, pose = poseAt(p, t);
                    for (const s of 'lr') if (tapWeight(pose, s) < .5) off[s].push(t);
                }
                const spans = ts => { const r = []; for (const t of ts) { const last = r[r.length - 1]; if (last && t - last[1] < .051) last[1] = t; else r.push([t, t]); } return r.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]); };
                const canon = pose => JSON.stringify(Object.keys(pose).sort().map(b => [b, pose[b]]));
                const ks = p.poseKeys, frozen = ks.length > 1 && ks.every(k => canon(k.pose) === canon(ks[0].pose));
                const fingerKeys = ks.filter(k => Object.entries(k.pose).some(([b, q]) => isFinger(b) && ang(q) > .015)).map(k => k.t);
                if (off.l.length || off.r.length || frozen)
                    out.push({ chapter: shot.id || f.replace('.json', ''), key: e.key, model: id, keys: ks.length, span: [ks[0].t, ks[ks.length - 1].t],
                        offL: spans(off.l), offR: spans(off.r), frozen, fingerKeys });
            }
        }
    }
    return out;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    const cut = process.argv[2]; if (!cut) { console.error('usage: typing-audit.mjs <cut dir> [--json]'); process.exit(2); }
    const rows = audit(cut);
    if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
    else for (const r of rows) console.log(`${r.chapter.padEnd(10)} ${r.key.padEnd(22)} ${r.model.padEnd(28)} keys ${r.keys} (${r.span[0]}..${r.span[1]} s)` +
        `${r.frozen ? '  FROZEN (all keys equal: constant offset, taps still run)' : ''}` +
        `${r.offL.length || r.offR.length ? `  TAPS OFF  l ${JSON.stringify(r.offL)} r ${JSON.stringify(r.offR)}  finger keys at ${JSON.stringify(r.fingerKeys)}` : ''}`);
    if (!rows.length) console.log('no typist with keyed-off or frozen typing');
}
