// Chapter 7 · wellness (gym). Lift 28 -> 43.5 at 3-8 s ("Stand and reset").
// Main (Dell 16:9): guided workout coach around the app's real exercise demo clips,
// shown in dark mode (inverted). Tablet (3:2): breathing coach + heart rate.
(function () {
  const hr = t => 74 + 26 * sm(seg(t, 7, 14)) + 3 * Math.sin(t * 1.7) + 2 * noise(t * 2);
  function ecg(x, y, w, h, t, col) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const u = i / 160, tt = t - (1 - u) * 3, ph = fract(tt * hr(tt) / 60);
      let v = 0;
      if (ph < .04) v = Math.sin(ph / .04 * Math.PI) * .15;
      else if (ph > .1 && ph < .13) v = -.2; else if (ph >= .13 && ph < .16) v = 1; else if (ph >= .16 && ph < .19) v = -.35;
      else if (ph > .3 && ph < .42) v = Math.sin((ph - .3) / .12 * Math.PI) * .25;
      pts.push([x + u * w, y + h / 2 - v * h * .45]);
    }
    g.save(); g.shadowColor = col; g.shadowBlur = 16; poly(pts, col, 6); g.restore();
    circle(pts[pts.length - 1][0], pts[pts.length - 1][1], 10, col);
  }
  function demo(key, idx, x, y, w, h) {
    const im = frameImg(key, idx); if (!im) return;
    clip(x, y, w, h, 30, () => {
      g.save(); g.filter = 'invert(1) hue-rotate(180deg) brightness(1.05) contrast(1.05)';
      drawCover(im, x, y, w, h, {zoom: 1.12, ay: .75});
      g.restore();
      g.fillStyle = rad(x + w / 2, y + h * .55, w * .6, [[0, hexA(C.teal, .12)], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h);
    });
  }
  // Each demo clip shows a red 'incorrect form' segment at ~4.8-8.1 s; skip it.
  const good = i => i < 144 ? i : i + 99;
  const phase = t => t < 3 ? 0 : t < 8 ? 1 : 2;
  SCENES.ch07l = {
    prefetch(t) { return [['shoulder', good(Math.round(t * 30))], ['squats', good(Math.round(Math.max(0, t - 7.5) * 30))]]; },
    draw(t) {
      backdrop(t, {top: '#071a1a', bot: '#04080c', blobs: [[C.teal, .14], [C.blue, .1]]});
      const p = pose(t), ph = phase(t);
      // header
      appIcon(70, 70, 64, {glow: true});
      T('Move', 124, 86, 46, {w: 700});
      const titles = ['Warm-up · Shoulder squeeze', 'Stand and reset', 'Desk squats'];
      [0, 1, 2].forEach(i => alpha(win2(t, [-1, 3, 8][i], [3, 8, 99][i], .35), () => T(titles[i], 280, 86, 46, {w: 600, c: C.soft})));
      pill(W - 50, 38, ph === 2 ? 'Set 1 of 2' : 'Break · 5 min', 30, {a: 'right', bg: hexA(C.teal, .18), c: C.teal});
      // video panel
      const vx = 50, vy = 140, vw = 1180, vh = 890;
      card(vx - 6, vy - 6, vw + 12, vh + 12, {r: 36, top: '#0b1414', bot: '#070c0e'});
      alpha(1 - sm(seg(t, 7.5, 8.1)), () => demo('shoulder', good(Math.round(t * 30)), vx, vy, vw, vh));
      alpha(sm(seg(t, 7.5, 8.1)), () => demo('squats', good(Math.round(Math.max(0, t - 7.5) * 30)), vx, vy, vw, vh));
      // rising overlay on the video
      alpha(win(t, 3, 8.2, .5), () => {
        fillR(vx + 40, vy + vh - 220, vw - 80, 180, 30, 'rgba(4,12,14,0.85)');
        icon('up', vx + 120, vy + vh - 130, 80, C.blue2, 10);
        T(`${p.height.toFixed(1)} in`, vx + 190, vy + vh - 104, 92, {w: 700});
        T('Desk rising to standing', vx + vw - 70, vy + vh - 150, 36, {w: 500, a: 'right', c: C.soft});
        bar(vx + 640, vy + vh - 110, vw - 710, 20, (p.height - 28) / 15.5, lin(0, 0, W, 0, [[0, C.blue], [1, C.teal]]));
      });
      // countdown before the lift
      alpha(win(t, -1, 3, .4), () => {
        fillR(vx + 40, vy + 40, 360, 120, 60, 'rgba(4,12,14,0.8)');
        T(`Standing in ${Math.max(1, Math.ceil(3 - t))}`, vx + 80, vy + 120, 48, {w: 700, c: C.amber});
      });
      // right column
      const rx = 1270, rw = W - rx - 50;
      const setLen = 30, el = clamp(t - 8, 0, setLen), rep = Math.min(12, Math.floor(el / 1.35 + (t > 8 ? 1 : 0)));
      card(rx, 140, rw, 420, {r: 36, accent: C.teal});
      if (ph < 2) {
        const left = ph === 0 ? 3 - t : 8 - t;
        ring(rx + rw / 2, 350, 150, 30, ph === 0 ? t / 3 : (t - 3) / 5, ph === 0 ? C.amber : C.blue2, {glow: 20});
        T(ph === 0 ? String(Math.ceil(Math.max(.01, left))) : `${Math.round(clamp((p.height - 28) / 15.5) * 100)}%`, rx + rw / 2, 385, 110, {w: 700, a: 'center'});
        T(ph === 0 ? 'get ready' : 'rising', rx + rw / 2, 440, 34, {w: 500, a: 'center', c: C.dim});
      } else {
        ring(rx + rw / 2, 350, 150, 30, 1 - el / setLen, C.teal, {glow: 20});
        T(fmtMS(Math.ceil(setLen - el)), rx + rw / 2, 380, 96, {w: 700, a: 'center'});
        T('remaining', rx + rw / 2, 440, 34, {w: 500, a: 'center', c: C.dim});
      }
      // reps
      card(rx, 590, rw, 200, {r: 36});
      T('REPS', rx + 40, 650, 30, {w: 700, c: C.dim, ls: 4});
      const repK = t > 8 ? 1 - fract(el / 1.35) : 0;
      at(rx + 40, 760, 1 + .12 * Math.pow(repK, 6), () => T(`${rep}`, 0, 0, 110, {w: 700, c: rep ? C.text : C.faint}));
      T('/ 12', rx + 60 + tw(`${rep}`, 110, 700), 760, 52, {w: 600, c: C.dim});
      // heart rate
      card(rx, 820, rw, 210, {r: 36, accent: C.coral});
      at(rx + 64, 890, 1 + .15 * Math.exp(-fract(t * hr(t) / 60) * 6), () => icon('heart', 0, 0, 60, C.coral));
      T(`${Math.round(hr(t))}`, rx + 110, 910, 72, {w: 700});
      T('bpm', rx + 120 + tw(`${Math.round(hr(t))}`, 72, 700), 910, 32, {w: 600, c: C.dim});
      ecg(rx + 30, 940, rw - 60, 80, t, C.coral);
      toast(t, 12.6, 2.6, 330, 170, 760, 'Great form!', 'Keep your back tall', {col: C.green, icon: 'check', h: 140});
      vignette(.4);
    },
  };

  // ---------------- Tablet: breathing coach ----------------
  // Box breathing 4-4-4-4 (one 4 s box side per phase) starting at 1 s.
  SCENES.ch07t = {
    draw(t) {
      backdrop(t, {top: '#08182a', bot: '#04070d', blobs: [[C.teal, .16], [C.violet, .12]]});
      const c = Math.max(0, t - 1), ph = Math.floor(c / 4) % 4, u = fract(c / 4);
      const sz = ph === 0 ? sm(u) : ph === 1 ? 1 : ph === 2 ? 1 - sm(u) : 0;
      const labels = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
      const cx = 520, cy = H / 2, r = 170 + 200 * sz;
      g.fillStyle = rad(cx, cy, r * 1.6, [[0, hexA(C.teal, .35)], [1, hexA(C.teal, 0)]]); g.fillRect(0, 0, W, H);
      circle(cx, cy, r, lin(cx - r, cy - r, cx + r, cy + r, [[0, '#3fe0c0'], [1, '#1388ec']]));
      ringStroke(cx, cy, 380, 'rgba(255,255,255,0.15)', 6);
      // progress dot running around the box phase
      const a = -Math.PI / 2 + (ph + u) / 4 * Math.PI * 2;
      circle(cx + Math.cos(a) * 380, cy + Math.sin(a) * 380, 22, '#fff');
      T(String(4 - Math.floor(u * 4)), cx, cy + 50, 150, {w: 700, a: 'center', c: '#06202a'});
      T(t < 1 ? 'Get comfortable' : labels[ph], 960, 420, 96, {w: 700, max: W - 990});
      T('Box breathing · 4-4-4-4', 985, 500, 44, {w: 500, c: C.soft});
      const calm = 92 - 22 * sm(seg(t, 1, 15)) + 1.5 * Math.sin(t * 1.3);
      at(1010, 700, 1 + .12 * Math.exp(-fract(t * calm / 60) * 6), () => icon('heart', 0, 0, 90, C.coral));
      T(`${Math.round(calm)} bpm`, 1080, 730, 90, {w: 700});
      T('calming', 1085, 800, 40, {w: 500, c: C.teal});
      vignette(.4);
    },
  };
})();
