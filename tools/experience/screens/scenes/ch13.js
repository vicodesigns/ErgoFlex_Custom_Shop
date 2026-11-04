// Chapter 13 · hero (finale), look E: the office desk as a financial analyst's station (HQ12, Vico's note 16).
// t is clip seconds; the shot plays the clip with offset = -(E's window start), so t = 0 is the moment the
// office look starts to blend on (window ~7 s). Everything is a pure function of t and fixed seeds.
//   ch13p  portrait monitor: Portfolio (total value, intraday P&L chart, allocation ring, holdings)
//   ch13w  wide curved monitor: Markets (index candles + volume, DCF model sheet, watchlist, ticker tape)
// The monitors read small in the finale (portrait ~190x360 px, wide ~400x170 px at 1080p), so the layouts are big
// shapes and big numbers: green/red reads as finance at any size.
(function () {
  const UP = '#2fd08a', DOWN = '#ff5d6c';
  // deterministic random walk (price series), n points, seed
  function walk(n, seed, drift = 0, vol = 1) { const r = rng(seed), out = [0]; for (let i = 1; i < n; i++) out.push(out[i - 1] + drift + (r() - .5) * 2 * vol); return out; }
  const money = (v, dp = 0) => '$' + v.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp});
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%';

  // ---------------- portrait: Portfolio ----------------
  const INTRA = walk(140, 1307, .055, .9);              // the day so far; the last 20 points arrive while we watch
  const HOLD = [['NOVA', 'Nova Semiconductor', 2.41, 301], ['KSTL', 'Kestrel Energy', -0.86, 302], ['ORLN', 'Orlan Health', 1.12, 303],
    ['BRX', 'Brix Industrials', 0.47, 304], ['TALN', 'Talon Financial', -0.31, 305]];
  const ALLOC = [['Equities', .58, C.blue2], ['Fixed income', .24, C.teal], ['Alternatives', .11, C.violet], ['Cash', .07, C.amber]];
  SCENES.ch13p = {
    draw(t) {
      backdrop(t, {top: '#0a1220', bot: '#05080e', blobs: [[C.teal, .08], [C.blue, .1]]});
      T('Portfolio', 60, 130, 76, {w: 700});
      pill(W - 60, 70, 'Market open', 30, {a: 'right', dot: UP, bg: hexA(UP, .16), c: UP});
      // live total: ticks with the chart
      const n = Math.min(INTRA.length, 120 + Math.floor(t * 3)), last = INTRA[n - 1];
      const day = 38420 + last * 950, total = 4180140 + day;
      T(money(total), 60, 300, 118, {w: 700});
      T(`${day >= 0 ? '+' : '−'}${money(Math.abs(day))}  ${pct(day / 4180140 * 100)}  today`, 64, 372, 44, {w: 600, c: day >= 0 ? UP : DOWN});
      // intraday chart (the session so far: 9:30 to ~2:40 PM, 80 % of the axis)
      const cx = 60, cy = 430, cw = W - 120, ch = 470;
      card(cx, cy, cw, ch, {r: 34, top: '#0d1a2b', bot: '#0a1422'});
      ['9:30', '11:00', '12:30', '2:00', '4:00'].forEach((s, i) => T(s, cx + 40 + i * (cw - 80) / 4, cy + ch - 28, 26, {w: 500, c: C.faint, a: 'center'}));
      for (let k = 1; k < 4; k++) fillR(cx + 30, cy + 40 + k * 95, cw - 60, 2, 1, 'rgba(160,190,230,0.07)');
      const vals = INTRA.slice(0, n), mn = Math.min(...INTRA) - 1, mx = Math.max(...INTRA) + 1;
      const pts = spark(cx + 40, cy + 50, (cw - 80) * .8 * (n - 1) / (INTRA.length - 1), ch - 130, vals, UP, {min: mn, max: mx, lw: 7, fill: .35});
      const p = pts[pts.length - 1]; circle(p[0], p[1], 14 + 4 * Math.sin(t * 5), hexA(UP, .3)); circle(p[0], p[1], 9, UP);
      // allocation ring + legend
      const ay = 940, rx = 230, ry = ay + 190;
      card(60, ay, W - 120, 390, {r: 34});
      let a0 = -Math.PI / 2; const grow = eo(seg(t, .2, 1.6));
      ALLOC.forEach(([, f, col]) => { const a1 = a0 + f * Math.PI * 2 * grow; g.beginPath(); g.arc(rx, ry, 120, a0 + .03, a1 - .03); g.strokeStyle = col; g.lineWidth = 46; g.lineCap = 'butt'; g.stroke(); a0 = a1; });
      T('58%', rx, ry + 16, 54, {w: 700, a: 'center'}); T('equity', rx, ry + 56, 26, {w: 500, a: 'center', c: C.dim});
      ALLOC.forEach(([name, f, col], i) => { const y = ay + 95 + i * 78; circle(440, y - 12, 14, col); T(name, 475, y, 40, {w: 500, c: C.soft}); T(Math.round(f * 100) + '%', W - 100, y, 40, {w: 700, a: 'right'}); });
      // holdings
      const hy = 1400;
      T('TOP HOLDINGS', 64, hy, 28, {w: 700, c: C.dim, ls: 4});
      HOLD.forEach(([tk, , ch_, seed], i) => {
        const y = hy + 30 + i * 76, chg = ch_ + .08 * Math.sin(t * 1.3 + i), col = chg >= 0 ? UP : DOWN;
        fillR(60, y, W - 120, 66, 18, i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)');
        T(tk, 90, y + 47, 38, {w: 700});
        spark(300, y + 12, 380, 42, walk(30, seed, ch_ * .05, .6), col, {lw: 4});
        T(pct(chg), W - 90, y + 47, 38, {w: 700, a: 'right', c: col});
      });
      vignette(.3);
    },
  };

  // ---------------- wide: Markets ----------------
  const CANDLE = (() => { const r = rng(9001), out = []; let p = 5940; for (let i = 0; i < 64; i++) { const o = p, c = o + (r() - .45) * 14, h = Math.max(o, c) + r() * 7, l = Math.min(o, c) - r() * 7; out.push([o, h, l, c, 30 + r() * 70]); p = c; } return out; })();
  const ROWS = [['Revenue', [412.0, 468.3, 529.1, 592.6, 657.8]], ['EBITDA', [98.9, 117.1, 137.6, 160.0, 184.2]], ['Margin', [24.0, 25.0, 26.0, 27.0, 28.0], '%'],
    ['Capex', [-31.2, -35.6, -40.1, -44.5, -48.7]], ['Free cash flow', [52.4, 63.8, 76.2, 89.9, 104.6]], ['Discounted FCF', [49.0, 55.6, 62.1, 68.4, 74.3]]];
  const WATCH = [['S&P 500', '5,982.40', .62, 11], ['NASDAQ', '19,104.7', .91, 12], ['DOW', '43,388.1', .18, 13], ['10Y UST', '4.21%', -0.04, 14], ['EUR/USD', '1.0874', -0.22, 15], ['GOLD', '2,684.3', .35, 16]];
  SCENES.ch13w = {
    draw(t) {
      g.fillStyle = lin(0, 0, 0, H, [[0, '#0a111d'], [1, '#05080d']]); g.fillRect(0, 0, W, H);
      // top bar
      fillR(0, 0, W, 92, 0, 'rgba(255,255,255,0.03)');
      appIcon(70, 46, 54); T('Markets', 120, 64, 46, {w: 700});
      ['Overview', 'Models', 'Research', 'Risk'].forEach((s, i) => T(s, 400 + i * 220, 62, 34, {w: i === 1 ? 700 : 500, c: i === 1 ? C.text : C.dim}));
      fillR(620 - 4, 82, 150, 6, 3, C.blue2);
      T('NY 2:41 PM · Q3 earnings week', W - 60, 62, 32, {w: 500, a: 'right', c: C.soft});
      // candles (left)
      const L = 40, Tp = 120, Wc = 1000, Hc = 820;
      card(L, Tp, Wc, Hc, {r: 30, top: '#0c1726', bot: '#09111c'});
      T('S&P 500', L + 40, Tp + 74, 52, {w: 700}); T('5,982.40', L + 330, Tp + 74, 52, {w: 700, c: UP}); T('+0.62%', L + 620, Tp + 74, 40, {w: 600, c: UP});
      const n = Math.min(CANDLE.length, 52 + Math.floor(t * 1.6)), vis = CANDLE.slice(0, n);
      const mn = Math.min(...CANDLE.map(c => c[2])), mx = Math.max(...CANDLE.map(c => c[1])), px = Wc - 100, bw = px / CANDLE.length;
      const Y = v => Tp + 130 + (Hc - 330) * (1 - (v - mn) / (mx - mn));
      for (let k = 0; k < 5; k++) fillR(L + 40, Tp + 130 + k * (Hc - 330) / 4, Wc - 80, 2, 1, 'rgba(160,190,230,0.07)');
      vis.forEach(([o, h, l, c, v], i) => {
        const live = i === n - 1, cc = live ? c + 4 * Math.sin(t * 3) : c, x = L + 50 + i * bw, col = cc >= o ? UP : DOWN;
        fillR(x + bw * .5 - 2, Y(h), 4, Y(l) - Y(h), 2, col);
        fillR(x + bw * .15, Math.min(Y(o), Y(cc)), bw * .7, Math.max(4, Math.abs(Y(o) - Y(cc))), 3, col);
        fillR(x + bw * .15, Tp + Hc - 40 - v * 1.5, bw * .7, v * 1.5, 3, hexA(col, .35));
      });
      // moving average
      const ma = vis.map((_, i) => { const s = vis.slice(Math.max(0, i - 8), i + 1); return s.reduce((a, c) => a + c[3], 0) / s.length; });
      poly(ma.map((v, i) => [L + 50 + i * bw + bw / 2, Y(v)]), hexA(C.amber, .9), 4);
      // model sheet (middle)
      const M = L + Wc + 30, Wm = 900;
      card(M, Tp, Wm, Hc, {r: 30});
      T('DCF model · NOVA', M + 40, Tp + 74, 44, {w: 700}); pill(M + Wm - 40, Tp + 34, 'Base case', 26, {a: 'right', bg: hexA(C.blue, .2)});
      const cols = ['FY25', 'FY26', 'FY27', 'FY28', 'FY29'], c0 = M + 330, cwid = 112;
      cols.forEach((s, i) => T(s, c0 + i * cwid + cwid, Tp + 150, 28, {w: 700, a: 'right', c: C.dim}));
      ROWS.forEach(([name, v, unit], r) => {
        const y = Tp + 210 + r * 82, sel = r === 4;
        if (sel) { fillR(M + 20, y - 52, Wm - 40, 72, 14, hexA(C.blue, .16)); strokeR(c0 + 4 * cwid + 8, y - 48, cwid, 64, 10, C.blue2, 3); }
        T(name, M + 40, y, 32, {w: sel ? 700 : 500, c: sel ? C.text : C.soft});
        v.forEach((x, i) => T(unit ? x.toFixed(1) + unit : x.toFixed(1), c0 + i * cwid + cwid, y, 30, {w: 600, a: 'right', c: x < 0 ? DOWN : sel ? C.text : C.soft}));
      });
      // valuation (fills in)
      const vy = Tp + Hc - 120, k = eo(seg(t, .8, 2.6));
      fillR(M + 20, vy - 70, Wm - 40, 150, 22, hexA(UP, .1));
      T('Fair value / share', M + 50, vy, 36, {w: 600, c: C.soft});
      T('$' + (120 + 22.8 * k).toFixed(2), M + Wm - 50, vy + 8, 72, {w: 700, a: 'right', c: UP});
      T('Upside +14.6% vs $124.60', M + 50, vy + 52, 28, {w: 500, c: C.dim});
      // watchlist (right)
      const R = M + Wm + 30, Wr = W - R - 40;
      card(R, Tp, Wr, Hc, {r: 30});
      T('WATCHLIST', R + 36, Tp + 66, 28, {w: 700, c: C.dim, ls: 4});
      WATCH.forEach(([name, val, ch_, seed], i) => {
        const y = Tp + 100 + i * 118, chg = ch_ + .03 * Math.sin(t * 1.7 + i), col = chg >= 0 ? UP : DOWN;
        T(name, R + 36, y + 46, 32, {w: 700}); T(val, R + 36, y + 90, 30, {w: 500, c: C.soft});
        spark(R + Wr - 350, y + 30, 150, 56, walk(24, seed, ch_ * .08, .5), col, {lw: 4});
        T(pct(chg), R + Wr - 36, y + 72, 32, {w: 700, a: 'right', c: col});
      });
      // ticker tape
      const tape = 'NOVA 142.18 +2.41%   KSTL 61.07 −0.86%   ORLN 88.40 +1.12%   BRX 37.95 +0.47%   TALN 54.12 −0.31%   VIX 14.8 −3.1%   WTI 71.24 +0.9%   ';
      fillR(0, H - 110, W, 110, 0, 'rgba(255,255,255,0.035)');
      g.save(); g.beginPath(); g.rect(0, H - 110, W, 110); g.clip();
      const tw_ = tw(tape, 40, 600), off = (t * 90) % tw_;
      for (let x = -off; x < W; x += tw_) T(tape, x, H - 42, 40, {w: 600, c: C.soft});
      g.restore();
      vignette(.25);
    },
  };
})();
