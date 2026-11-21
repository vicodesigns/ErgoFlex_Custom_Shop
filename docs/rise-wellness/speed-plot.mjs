// Before / after speed plots of the rise stretch as one SVG (small multiples, one measure per panel, shared time axis per column):
// wrist speed (m/s) and upper-arm, forearm angular speed (deg/s), the faster arm of the two at each frame, from arm-kin.mjs's CSVs.
// "Before" (the 4K film, 7ffa208c) is drawn on the new chapter's clock from the stretch's first move, so the two start together.
//   node docs/rise-wellness/speed-plot.mjs <measurements dir> <out.svg>
import fs from 'node:fs';
const [dir, out] = process.argv.slice(2);
const csv = f => { const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n').map(l => l.split(',')); return r.map(x => Object.fromEntries(h.map((k, i) => [k, +x[i]]))); };
const BLUE = '#2a78d6', ORANGE = '#eb6834', INK = '#0b0b0b', INK2 = '#52514e', GRID = '#e4e3df', BG = '#fcfcfb';
const COLS = [['seated (the film cut)', 'seated', 13.1, 13.35], ['standing', 'standing', 9.6, 9.6]];
const ROWS = [['Wrist speed, m/s', r => Math.max(r.vWl || 0, r.vWr || 0)], ['Upper arm, deg/s', r => Math.max(r.w_upperarm_l || 0, r.w_upperarm_r || 0)], ['Forearm, deg/s', r => Math.max(r.w_lowerarm_l || 0, r.w_lowerarm_r || 0)]];
const W = 1500, H = 930, ML = 70, MT = 124, PW = 640, PH = 210, GX = 80, GY = 44;
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif"><rect width="${W}" height="${H}" fill="${BG}"/>`;
s += `<text x="${ML}" y="38" font-size="24" font-weight="600" fill="${INK}">Rise, overhead triceps stretch: how fast the arms move, before and after</text>`;
s += `<text x="${ML}" y="64" font-size="15" fill="${INK2}">The faster arm at each frame (30 fps, forward kinematics on Maya's rig). Before = the 4K film's keys, drawn from the stretch's first move.</text>`;
s += `<g font-size="15" fill="${INK}"><line x1="${W - 330}" y1="33" x2="${W - 300}" y2="33" stroke="${ORANGE}" stroke-width="2.5"/><text x="${W - 292}" y="38">Before</text><line x1="${W - 210}" y1="33" x2="${W - 180}" y2="33" stroke="${BLUE}" stroke-width="2.5"/><text x="${W - 172}" y="38">After</text></g>`;
COLS.forEach(([title, key, t0new, t0old], ci) => {
    const A = csv(`${dir}/kin-after-${key}.csv`), B = csv(`${dir}/kin-before-${key}.csv`), x0 = ML + ci * (PW + GX), span = 11;
    s += `<text x="${x0}" y="${MT - 32}" font-size="16" font-weight="600" fill="${INK}">${title}</text>`;
    ROWS.forEach(([label, fn], ri) => {
        const y0 = MT + ri * (PH + GY), a = A.filter(r => r.t >= t0new - 0.3).map(r => [r.t - t0new, fn(r)]), b = B.filter(r => r.t >= t0old - 0.3).map(r => [r.t - t0old, fn(r)]);
        const top = Math.max(...a.map(p => p[1]), ...b.map(p => p[1])), step = top > 800 ? 500 : top > 4 ? 2 : 0.5, ymax = Math.ceil(top / step) * step;
        const X = t => x0 + (t + 0.3) / (span + 0.3) * PW, Y = v => y0 + PH - v / ymax * PH;
        for (let v = 0; v <= ymax + 1e-9; v += step) s += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + PW}" y2="${Y(v)}" stroke="${GRID}" stroke-width="1"/><text x="${x0 - 8}" y="${Y(v) + 5}" font-size="12" text-anchor="end" fill="${INK2}">${v}</text>`;
        for (let t = 0; t <= span; t += 2) s += `<text x="${X(t)}" y="${y0 + PH + 18}" font-size="12" text-anchor="middle" fill="${INK2}">${t} s</text>`;
        const path = (pts, c) => `<path d="${pts.filter(p => p[0] <= span).map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
        s += path(b, ORANGE) + path(a, BLUE);
        const pk = pts => pts.reduce((m, p) => p[1] > m[1] ? p : m), pa = pk(a), pb = pk(b), f = v => v > 20 ? v.toFixed(0) : v.toFixed(1);
        s += `<text x="${x0}" y="${y0 - 8}" font-size="13" fill="${INK2}">${label}</text>`;
        s += `<circle cx="${X(pb[0])}" cy="${Y(pb[1])}" r="4" fill="${ORANGE}" stroke="${BG}" stroke-width="2"/><text x="${X(pb[0]) + 9}" y="${Y(pb[1]) + 12}" font-size="13" fill="${INK}">before, peak ${f(pb[1])}</text>`;
        s += `<circle cx="${X(pa[0])}" cy="${Y(pa[1])}" r="4" fill="${BLUE}" stroke="${BG}" stroke-width="2"/><text x="${X(pa[0]) + 9}" y="${Y(pa[1]) - 8}" font-size="13" fill="${INK}">after, peak ${f(pa[1])}</text>`;
    });
});
s += '</svg>'; fs.writeFileSync(out, s); console.log('ok', out);
