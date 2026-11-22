// Entry vs exit by progress u (0 = hands on the keys, 1 = in the stretch): a row per u, columns
//   ENTRY at 13.1 + u * 2.167 | EXIT AFTER at 23.3 - u * 2.167 | EXIT BEFORE (Vico's) at 23.5 - u * 2.367
// (the exit is the entry backwards and mirrored: the arm that folds overhead is her left in the exit, her right in the entry).
//   node progress-sheet.mjs <out.jpg> <entry clip (starts 12.9 s)> <after clip (20.4 s)> <before clip (20.4 s)> [du=0.1]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [out, entry, after, before, duA] = process.argv.slice(2), du = +(duA || 0.1), W = 427, H = 240;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rise4-prog-')), font = 'C\\:/Windows/Fonts/arial.ttf', tiles = [];
const us = []; for (let u = 1; u >= -1e-9; u -= du) us.push(Math.max(0, Math.round(u * 1000) / 1000));
const cols = [['ENTRY', entry, 12.9, u => 13.1 + u * 2.167], ['EXIT AFTER', after, 20.4, u => 23.3 - u * 2.167], ['EXIT BEFORE', before, 20.4, u => 23.5 - u * 2.367]];
us.forEach((u, r) => cols.forEach(([label, clip, start, tf], c) => {
    const t = tf(u), f = path.join(tmp, `${r}-${c}.png`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (t - start + 1 / 60).toFixed(4), '-i', clip, '-frames:v', '1', '-vf', `scale=${W}:${H},drawtext=fontfile='${font}':fontsize=17:fontcolor=white:box=1:boxcolor=black@0.65:x=6:y=6:text='${label} u=${u.toFixed(1)}  ${t.toFixed(2)} s'`, f]);
    tiles.push(f);
}));
const per = cols.length * 2, layout = tiles.map((_, k) => `${(k % per) * W}_${Math.floor(k / per) * H}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...tiles.flatMap(f => ['-i', f]), '-filter_complex', tiles.map((_, k) => `[${k}:v]`).join('') + `xstack=inputs=${tiles.length}:layout=${layout}:fill=black`, '-q:v', '3', out]);
fs.rmSync(tmp, { recursive: true, force: true }); console.log(out, us.length, 'rows');
