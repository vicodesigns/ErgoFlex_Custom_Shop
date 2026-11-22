// Full-size frames of one clip at given chapter times, as a grid (2 columns), each labelled.
//   node grid.mjs <out.png> <clip start s> <label> <clip.mkv> <t1,t2,...> [crop w:h:x:y]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [out, startA, label, clip, tsA, crop] = process.argv.slice(2), ts = tsA.split(',').map(Number);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rise4-grid-')), font = 'C\\:/Windows/Fonts/arial.ttf';
const files = ts.map((t, i) => {
    const f = path.join(tmp, i + '.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (t - +startA + 1 / 60).toFixed(4), '-i', clip, '-frames:v', '1', '-vf', `${crop ? 'crop=' + crop + ',scale=854:480,' : ''}drawtext=fontfile='${font}':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:x=8:y=8:text='${label}  ${t.toFixed(2)} s'`, f]);
    return f;
});
const layout = files.map((_, k) => `${(k % 2) * 854}_${Math.floor(k / 2) * 480}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', files.map((_, k) => `[${k}:v]`).join('') + `xstack=inputs=${files.length}:layout=${layout}:fill=black`, out]);
fs.rmSync(tmp, { recursive: true, force: true }); console.log(out);
