#!/usr/bin/env node
// Render seed from studio-state.json (localStorage key -> string), optionally copying one
// desk's object transforms between room layouts, so a film chapter shot in one layout
// shows the arrangement the owner made in another.
//   node tools/studio-state/derive-seed.mjs studio-state.json out.json \
//     [--copy-desk occmedialab/premium:occmedialab/house:main] [--set key=value]
//     [--zero-preset-poses]   every saved preset's desk pose to the origin (x 0, z 0, yaw 0), so
//                             a film can change presets on one spot without the desk jumping
import fs from 'node:fs';
import { decodeStoredJSON, encodeStoredJSON } from '../../browser-design-storage.mjs';
import { load, values } from './file.mjs';

const [src, out, ...rest] = process.argv.slice(2);
const seed = values(load(src));
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === '--zero-preset-poses') {
    const key = 'ergoflex.buildPresetsV1', all = decodeStoredJSON(seed[key]), entries = all.entries || all;
    const zero = (o, path) => { if (!o || typeof o !== 'object') return; if (o.pose && 'yaw' in o.pose) { if (o.pose.x || o.pose.z || o.pose.yaw) console.log(`${path}: pose ${JSON.stringify(o.pose)} -> origin`); o.pose = { ...o.pose, x: 0, z: 0, yaw: 0 }; } for (const [k, v] of Object.entries(o)) zero(v, path + '.' + k); };
    for (const [id, e] of Object.entries(entries)) zero(e, id);
    seed[key] = encodeStoredJSON(all); i--; continue;
  }
  if (rest[i] === '--set') { const [k, ...v] = rest[i + 1].split('='); seed[k] = v.join('='); continue; }
  if (rest[i] !== '--copy-desk') throw Error('unknown option ' + rest[i]);
  const [from, to, desk] = rest[i + 1].split(':'), key = 'ergoflex.sceneDesksBySizeV2', all = decodeStoredJSON(seed[key]);
  const a = all.rooms[from]?.desks?.[desk], b = all.rooms[to]?.desks?.[desk];
  if (!a || !b) throw Error(`no desk ${desk} in ${from} or ${to}`);
  for (const [id, o] of Object.entries(a.objects)) {
    if (!b.objects[id] || JSON.stringify(b.objects[id].transform) === JSON.stringify(o.transform)) continue;
    console.log(`${to}/${desk} ${o.label}: ${JSON.stringify(b.objects[id].transform.p)} -> ${JSON.stringify(o.transform.p)}`);
    b.objects[id].transform = structuredClone(o.transform);
  }
  seed[key] = encodeStoredJSON(all);
}
fs.writeFileSync(out, JSON.stringify(seed));
console.log(`${Object.keys(seed).length} keys -> ${out}`);
