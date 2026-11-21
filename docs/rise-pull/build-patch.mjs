// Builds the by-key patch (docs/rise-pull/rise-pull-patch.json) from the solved pull poses.
//   node docs/rise-pull/build-patch.mjs <poses.json> <out.json>
// poses.json: { seated|standing: { base: "<export doc / cut holding the keys to build on>", poses: {name: spec}, timeline: [{keep: t} | {t, pose}] } }
// (a "keep" entry copies the key at that time from base; the other entries set the key's six arm bones from the named pose)
import fs from 'node:fs';
import { cleanPoseKeys } from '../../people-pose-keys.mjs';
import { loader, baseKeys } from './rise-pull-poses.mjs';
const [posesFile, outFile] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(posesFile, 'utf8')), out = {};
for (const which of ['seated', 'standing']) {
    const c = cfg[which]; if (!c) continue;
    const { POST, poseOf, identityFingers } = await loader(which), keys0 = baseKeys(c.base, POST);
    const P = {}; for (const [name, spec] of Object.entries(c.poses)) P[name] = poseOf(spec);
    const keys = c.timeline.map(e => e.keep !== undefined ? (k => { if (e.fingers === 'identity') identityFingers(k.pose); return k; })(JSON.parse(JSON.stringify(keys0.find(k => Math.abs(k.t - e.keep) < 1e-6)))) : { t: e.t, pose: JSON.parse(JSON.stringify(P[e.pose])) });
    out[POST] = cleanPoseKeys(keys);
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => k + ': ' + v.map(x => x.t).join(' ')).join('\n'));
