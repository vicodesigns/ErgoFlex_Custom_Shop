// Contact sheet: tiles of stills or of frames from a clip, each labelled, in a grid.
//   node docs/wellness-order/sheet.mjs <out.png|jpg> <columns> <tile WxH> <entry> [entry ...]
//   entry: label=path (a still)   or   label=clip.mkv@seconds (that frame of a clip; seconds into the file)
//   or a range from one clip:  @clip.mkv:clipStart:t0:t1:step   (chapter seconds t0..t1 every step; the clip starts at chapter
//   second clipStart; each tile is labelled with its chapter second)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [out, colsA, size, ...entries] = process.argv.slice(2), cols = +colsA, [W, H] = size.split('x').map(Number);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'well-sheet-')), font = 'C\\:/Windows/Fonts/arial.ttf', items = [];
for (const e of entries) {
    if (e.startsWith('@')) { const [file, start, t0, t1, step] = e.slice(1).split(/:(?=[-\d.]+(?::|$))/); for (let t = +t0; t <= +t1 + 1e-6; t += +step) items.push([`${t.toFixed(2)} s`, file, Math.max(0, t - +start + 1 / 60)]); continue; }
    const i = e.indexOf('='), label = e.slice(0, i), rest = e.slice(i + 1), m = /^(.*)@([\d.]+)$/.exec(rest);
    items.push(m ? [label, m[1], +m[2]] : [label, rest, null]);
}
const tiles = items.map(([label, file, at], k) => {
    const f = path.join(tmp, k + '.png'), safe = label.replace(/[:'\\]/g, ' ');
    const vf = `scale=${W}:${H},drawtext=fontfile='${font}':fontsize=${Math.round(H / 13)}:fontcolor=white:box=1:boxcolor=black@0.65:x=6:y=6:text='${safe}'`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...(at !== null ? ['-ss', at.toFixed(4)] : []), '-i', file, '-frames:v', '1', '-vf', vf, f]);
    if (!fs.existsSync(f)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.05', '-i', file, '-frames:v', '1', '-vf', vf, f]);   // (past the clip's last frame: its last frame)
    return f;
});
const layout = tiles.map((_, k) => `${(k % cols) * W}_${Math.floor(k / cols) * H}`).join('|');
const rows = Math.ceil(tiles.length / cols), pad = rows * cols - tiles.length;
const args = ['-v', 'error', '-y']; tiles.forEach(f => args.push('-i', f));
for (let i = 0; i < pad; i++) args.push('-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}`);
const n = tiles.length + pad, lay = Array.from({ length: n }, (_, k) => `${(k % cols) * W}_${Math.floor(k / cols) * H}`).join('|');
args.push('-filter_complex', `${Array.from({ length: n }, (_, k) => `[${k}:v]`).join('')}xstack=inputs=${n}:layout=${lay}${n === 1 ? '' : ''}`, '-frames:v', '1', ...(out.endsWith('.jpg') ? ['-q:v', '3'] : []), out);
if (n === 1) fs.copyFileSync(tiles[0], out); else execFileSync('ffmpeg', args);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('sheet', out, items.length, 'tiles', cols + 'x' + rows);
