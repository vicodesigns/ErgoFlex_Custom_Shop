import { THREE, rig, loadRow, filmFrames, shot, stripKai } from './rigtools.mjs';
const ts = [12.36, 12.6, 12.75, 13.0, 13.25, 13.5];
const rows = await filmFrames({ shot, key: /^kai/, times: ts, edit: stripKai });
const real = await filmFrames({ shot, key: /^kai/, times: [13.5] });
for (const r of [...rows, real[0]]) { loadRow(r); const [, up, lo, h] = rig.side.l.arm; const S = rig.wp[up], E = rig.wp[lo], H = rig.wp[h]; const ax = H.clone().sub(S).normalize(); const c = E.clone().sub(S); c.addScaledVector(ax, -c.dot(ax)).normalize();
  console.log(r.t, 'S', S.toArray().map(v => v.toFixed(3)).join(','), 'E', E.toArray().map(v => v.toFixed(3)).join(','), 'H', H.toArray().map(v => v.toFixed(3)).join(','), 'elbowDir', c.toArray().map(v => v.toFixed(2)).join(',')); }
