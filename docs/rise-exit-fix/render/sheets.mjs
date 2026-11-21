// Contact sheets from the verification clips: every time a row, columns = the clips given (e.g. before | after), each frame labelled.
//   node docs/rise-exit-fix/render/sheets.mjs <out.png> <clip start s> <t0> <t1> <step> <label=clip.mkv> [label=clip.mkv ...]
// A clip made with renderRange [a, b] starts at chapter second a (frame i = a + i/30).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [out, startA, t0A, t1A, stepA, ...cols] = process.argv.slice(2);
const start = +startA, t0 = +t0A, t1 = +t1A, step = +stepA, W = 427, H = 240;
const clips = cols.map(c => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rise4-sheet-')), tiles = [];
const times = []; for (let t = t0; t <= t1 + 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
const font = 'C\\:/Windows/Fonts/arial.ttf';
times.forEach((t, r) => clips.forEach(([label, file], c) => {
    const f = path.join(tmp, `${r}-${c}.png`), at = Math.max(0, t - start + 1 / 60);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', at.toFixed(4), '-i', file, '-frames:v', '1', '-vf', `${process.env.CROP ? 'crop=' + process.env.CROP + ',' : ''}scale=${W}:${H},drawtext=fontfile='${font}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.65:x=6:y=6:text='${label}  ${t.toFixed(2)} s'`, f]);
    tiles.push(f);
}));
const per = clips.length * (+process.env.PER_ROW || 2);   // PER_ROW times side by side (each with all its clips)
const n = tiles.length, layout = tiles.map((_, k) => `${(k % per) * W}_${Math.floor(k / per) * H}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...tiles.flatMap(f => ['-i', f]), '-filter_complex', tiles.map((_, k) => `[${k}:v]`).join('') + `xstack=inputs=${n}:layout=${layout}:fill=black`, '-q:v', '3', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, `${times.length} times x ${clips.length} clips`);
