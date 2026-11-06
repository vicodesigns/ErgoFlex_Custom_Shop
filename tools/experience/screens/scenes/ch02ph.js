// Chapter 2 · rise: the phone lying on the desk's wireless charger, beside the open Daily planning notebook.
// Vico (2026-11-06): "It starts with a 100% charge icon animated, then the screen kind of loads. It shows it charged
// overnight, that you have your notes, and then the whole scene starts."
//   0 – 1.2 s  black glass: a softly pulsing wireless-charging ring fills to 100 %, bolt and count-up
//   1.2 – 2.2  the lock screen loads: 8:00, the date, "Charged overnight · 100%", the Daily notes card
//   2.3 – 3.4  it settles to an always-on dim as the desk and monitors wake; from there it stays lit but quiet
// The clip covers the phone's whole front glass (canvas = the glass's aspect): a black bezel, rounded display corners
// and the island are drawn here, so the shot maps it with fit 'cover' and blend 'add' (black = the glass's reflections).
(function () {
  // The monitors' workday clock (ch02.js): 8:00 AM at t=0. The lock screen holds 8:00 while it is the hero, then the
  // always-on clock runs at the monitors' pace from there.
  const CK = [[0, 480], [4, 512], [8, 655], [12, 840], [15, 1040], [17, 1080]];
  const workday = t => { for (let i = 1; i < CK.length; i++) if (t <= CK[i][0]) { const [a, ma] = CK[i - 1], [b, mb] = CK[i]; return lerp(ma, mb, (t - a) / (b - a)); } return 1080; };
  // 8:00 through the reveal; once it is dim it runs at the workday's pace from 8:00.
  const phoneMin = t => 480 + Math.max(0, workday(t) - workday(T_DIM1));
  const T_RING = .1, T_FULL = .95, T_LOCK = 1.2, T_CARD = 1.55, T_DIM0 = 2.35, T_DIM1 = 3.4;

  // Display rectangle inside the glass (fractions of W / H) and its corner radius.
  const disp = () => { const x = W * .045, y = H * .026; return {x, y, w: W - 2 * x, h: H - 2 * y, r: W * .135}; };

  function wallpaper(t, d, k) {
    // Deep ErgoFlex blue, a slow aurora of the app's blue and teal, darker toward the bottom.
    g.fillStyle = lin(0, d.y, 0, d.y + d.h, [[0, mix('#0d2140', '#000000', 1 - k)], [.55, mix('#081428', '#000000', 1 - k)], [1, '#020409']]);
    g.fillRect(d.x, d.y, d.w, d.h);
    [[C.blue, .34, .25, .2], [C.teal, .16, .8, .36], [C.violet, .1, .4, .58]].forEach(([col, a, fx, fy], i) => {
      const bx = d.x + d.w * (fx + .08 * Math.sin(t * .35 + i * 2.1)), by = d.y + d.h * (fy + .03 * Math.cos(t * .3 + i));
      g.fillStyle = rad(bx, by, d.w * .95, [[0, hexA(col, a * k)], [1, hexA(col, 0)]]); g.fillRect(d.x, d.y, d.w, d.h);
    });
  }

  // Wireless-charging ring: soft ripples outward from the coil, the battery arc filling to 100 %, bolt + count.
  function charging(t, a, cx, cy, s) {
    if (a <= .001) return;
    alpha(a, () => {
      // It has charged overnight: the count reads 100 % from the start while the ring draws in around it.
      const R = 230 * s, fill = eo(seg(t, T_RING, T_FULL)), full = seg(t, T_FULL, T_FULL + .25), intro = eo(seg(t, 0, .45));
      // ripples: three rings expanding and fading, staggered (the coil's pulse)
      for (let i = 0; i < 3; i++) {
        const u = fract(t * .85 + i / 3), rr0 = R * (1.02 + .55 * eo(u));
        g.save(); g.globalAlpha *= (1 - u) * .32 * sm(seg(t, 0, .35)); ringStroke(cx, cy, rr0, C.green, 5 * s); g.restore();
      }
      // halo
      const breathe = .5 + .5 * Math.sin(t * Math.PI * 2 * .9);
      g.fillStyle = rad(cx, cy, R * 1.9, [[0, hexA(C.green, .1 + .08 * breathe + .12 * full)], [.55, hexA(C.green, .04)], [1, hexA(C.green, 0)]]);
      g.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
      // track + arc
      ring(cx, cy, R, 22 * s, fill, mix('#3ddc84', '#b6f046', full * .35), {track: 'rgba(255,255,255,0.07)', glow: 26 * s + 22 * s * full});
      // bright head on the arc
      if (fill > .01 && fill < .999) { const an = -Math.PI / 2 + Math.PI * 2 * fill; g.save(); g.shadowColor = C.lime; g.shadowBlur = 30 * s; circle(cx + Math.cos(an) * R, cy + Math.sin(an) * R, 13 * s, '#eaffd8'); g.restore(); }
      // bolt
      at(cx, cy - 92 * s, 1 + .06 * full * (1 - seg(t, T_FULL + .25, T_FULL + .6)), () => {
        g.save(); g.shadowColor = C.green; g.shadowBlur = 30 * s; icon('bolt', 0, 0, 110 * s, '#7ff0b0'); g.restore();
      });
      // count
      at(cx, cy + 40 * s, lerp(.92, 1, intro) + .04 * full * (1 - seg(t, T_FULL + .25, T_FULL + .7)), () => {
        T('100%', 0, 22 * s, 132 * s, {w: 600, a: 'center', c: '#f4fff8', glow: hexA(C.green, .4 + .3 * full), glowR: 30 * s, alpha: intro});
      });
      T('Fully charged', cx, cy + 128 * s, 38 * s, {w: 500, a: 'center', c: hexA('#c8f5dc', .8), ls: 1, alpha: sm(seg(t, .3, .8))});
    });
  }

  // Small battery glyph (status bar, pill).
  function battery(x, y, s, col, frac = 1) {
    strokeR(x, y, 58 * s, 28 * s, 9 * s, hexA('#ffffff', .55), 3 * s);
    fillR(x + 60 * s, y + 9 * s, 5 * s, 10 * s, 2 * s, hexA('#ffffff', .55));
    fillR(x + 5 * s, y + 5 * s, 48 * s * frac, 18 * s, 5 * s, col);
  }

  function notesCard(t, d, y, k) {
    const x = d.x + 40, w = d.w - 80, h = 430, a = sm(seg(t, T_CARD, T_CARD + .45)) * k, rise = 1 - eo(seg(t, T_CARD, T_CARD + .55));
    alpha(a, () => at(0, rise * 70, 1, () => {
      g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
      fillR(x, y, w, h, 48, 'rgba(28,40,62,0.72)'); g.restore();
      strokeR(x + 1, y + 1, w - 2, h - 2, 48, 'rgba(190,215,255,0.14)', 2);
      appIcon(x + 82, y + 84, 84);
      T('DAILY NOTES', x + 148, y + 70, 34, {w: 600, c: C.soft, ls: 3});
      T('now', x + w - 44, y + 70, 34, {w: 500, a: 'right', c: C.dim});
      T('3 items for today', x + 148, y + 128, 56, {w: 600, c: C.text});
      const items = [['Stand-up · 9:30', C.blue2], ['Review the sprint plan', C.teal], ['Stretch break · 11:00', C.amber]];
      items.forEach(([s, col], i) => {
        const iy = y + 226 + i * 64, ia = sm(seg(t, T_CARD + .25 + i * .12, T_CARD + .6 + i * .12));
        alpha(ia, () => { circle(x + 156, iy - 14, 11, col); T(s, x + 188, iy, 42, {w: 500, c: C.soft}); });
      });
    }));
  }

  SCENES.ch02ph = {
    draw(t) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const d = disp(), lock = sm(seg(t, T_LOCK, T_LOCK + .55)), dim = sm(seg(t, T_DIM0, T_DIM1));
      // whole-display level: full for the reveal, an always-on glow after (the shot's brightness keys taper it more)
      const level = lerp(1, .42, dim);
      clip(d.x, d.y, d.w, d.h, d.r, () => {
        alpha(level, () => {
          // lock screen
          if (lock > .001) alpha(lock, () => {
            wallpaper(t, d, lerp(1, .55, dim));
            const cx = W / 2, top = d.y + 300 + (1 - eo(seg(t, T_LOCK, T_LOCK + .7))) * 40;
            // status row
            T(fmtClock(phoneMin(t), false), d.x + 92, d.y + 92, 40, {w: 600, c: C.text});
            battery(d.x + d.w - 150, d.y + 64, 1, C.green);
            icon('wifi', d.x + d.w - 200, d.y + 82, 40, C.text, 4);
            // lock glyph, time, date
            icon('lock', cx, top - 70, 56, hexA('#ffffff', .8), 5);
            const hm = fmtClock(phoneMin(t), false);
            T(hm, cx, top + 230, 300, {w: 600, a: 'center', c: '#f3f7ff', glow: hexA(C.blue2, .35), glowR: 40});
            T('Friday, November 6', cx, top + 318, 56, {w: 500, a: 'center', c: hexA('#e8eef7', .85)});
            // charged pill
            const pa = sm(seg(t, T_LOCK + .25, T_LOCK + .65));
            alpha(pa, () => {
              const label = 'Charged overnight · 100%', pw = tw(label, 44, 600) + 160, px = cx - pw / 2, py = top + 380;
              fillR(px, py, pw, 92, 46, hexA(C.green, .18)); strokeR(px, py, pw, 92, 46, hexA(C.green, .45), 2);
              g.save(); g.shadowColor = C.green; g.shadowBlur = 18; icon('bolt', px + 56, py + 46, 54, C.green); g.restore();
              T(label, px + 100, py + 62, 44, {w: 600, c: '#c9f7dc'});
            });
            notesCard(t, d, top + 540, 1);
            // bottom: torch / camera buttons and the home bar
            const by = d.y + d.h - 230;
            [[d.x + 150, 'sun'], [d.x + d.w - 150, 'cam']].forEach(([bx, ic]) => { circle(bx, by, 62, 'rgba(255,255,255,0.12)'); icon(ic, bx, by, 64, hexA('#ffffff', .85), 5); });
            fillR(cx - 150, d.y + d.h - 60, 300, 12, 6, hexA('#ffffff', .7));
          });
          // charging animation over black, handing over to the lock screen
          const ca = 1 - sm(seg(t, T_LOCK - .05, T_LOCK + .4));
          const s = lerp(1, .8, eo(seg(t, T_LOCK - .05, T_LOCK + .4)));
          charging(t, ca, W / 2, lerp(H * .47, H * .40, eo(seg(t, T_LOCK - .05, T_LOCK + .4))), s);
          // the island
          fillR(W / 2 - 130, d.y + 44, 260, 76, 38, '#000');
        });
      });
    },
  };
})();
