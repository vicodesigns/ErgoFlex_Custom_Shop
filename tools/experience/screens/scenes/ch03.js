// Chapter 3 · create (artist studio). Tilt 12 -> 25° (1.4-4.4 s) -> 65° easel (7.6-12.6 s).
// Flat monitor: painting app timelapse, stroke by stroke. Portrait: reference board + palette.
(function () {
  const PAL = ['#2b3d7a', '#6a4c9c', '#f2a36b', '#ffd59a', '#3d8f8a', '#1f4f5a', '#9ad1d4', '#2a2233', '#e86f68'];
  // Build the painting's strokes once (unit coords), in painting order.
  const STROKES = (() => {
    const r = rng(42), S = [];
    const add = (pts, w, col, a = .9) => S.push({pts, w, col, a});
    for (let i = 0; i < 34; i++) { const y = .04 + i * .016 + r() * .01, u = i / 33; add([[-.05, y], [.35, y + (r() - .5) * .02], [.7, y + (r() - .5) * .02], [1.05, y]], .03 + r() * .01, mix('#24356f', '#f2a36b', Math.pow(u, 1.3)), .85); }
    for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = r() * .035; add([[.68 + Math.cos(a) * d, .24 + Math.sin(a) * d], [.68 + Math.cos(a + 1) * d * .6, .24 + Math.sin(a + 1) * d * .6]], .04, i < 6 ? '#ffd59a' : '#fff2cf', .95); }
    for (let i = 0; i < 6; i++) add([[-.05, .52 + i * .016], [1.05, .53 + i * .016]], .035, '#5a4488', .95);
    for (let i = 0; i < 16; i++) { const x0 = -.08 + i * .075, top = .3 + .12 * fbm(i * .7 + 2); add([[x0, .58], [x0 + .07, top], [x0 + .16, .58]], .07, mix('#6a4c9c', '#4a3a78', r()), .95); }
    for (let i = 0; i < 30; i++) { const y = .58 + i * .006; add([[-.05, y + .02 * Math.sin(i)], [.3, y - .03], [.6, y + .01], [1.05, y - .02]], .028, mix('#3d8f8a', '#1f4f5a', i / 30), .9); }
    for (let i = 0; i < 26; i++) { const y = .72 + i * .011; add([[-.05, y], [.5, y + (r() - .5) * .01], [1.05, y]], .022, mix('#2f6f9a', '#173a5a', i / 26), .85); }
    for (let i = 0; i < 12; i++) { const x = .62 + r() * .14, y = .73 + r() * .2; add([[x, y], [x + .05 + r() * .05, y]], .008, '#ffd59a', .8); }
    for (let k = 0; k < 7; k++) { const x = .06 + k * .04 + r() * .02, base = .74 + r() * .03, h = .18 + r() * .1; add([[x, base], [x + .003, base - h]], .012, '#2a2233', 1); for (let j = 0; j < 6; j++) { const yy = base - h * (.3 + j * .12), ww = .05 * (1 - j / 7); add([[x - ww, yy], [x, yy - .04], [x + ww, yy]], .02, mix('#1f4f5a', '#2a2233', j / 6), .95); } }
    for (let i = 0; i < 6; i++) { const x = .4 + i * .05 + r() * .02, y = .2 + r() * .08; add([[x, y], [x + .012, y - .01], [x + .024, y]], .005, '#2a2233', 1); }
    for (let i = 0; i < 14; i++) { const x = r(), y = .6 + r() * .04; add([[x, y], [x + .03, y - .005]], .01, '#f6c28b', .7); }
    return S;
  })();
  const T0 = 1.0, T1 = 17.2, N = STROKES.length, per = (T1 - T0) / N;
  function strokePath(s, x, y, w, h, frac) {
    const P = s.pts.map(([u, v]) => [x + u * w, y + v * h]);
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    const segs = P.length - 1, upto = frac * segs;
    let tip = P[0];
    for (let i = 1; i <= segs; i++) {
      const f = clamp(upto - (i - 1));
      if (f <= 0) break;
      const a = P[i - 1], b = P[i]; tip = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      g.lineTo(tip[0], tip[1]);
    }
    g.lineWidth = s.w * w; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = s.col; g.globalAlpha = s.a; g.stroke(); g.globalAlpha = 1;
    return tip;
  }
  function painting(t, x, y, w, h) {
    fillR(x, y, w, h, 8, '#efe6d6');
    let tip = null, cur = null;
    clip(x, y, w, h, 8, () => {
      for (let i = 0; i < N; i++) {
        const ts = T0 + i * per; if (t < ts) break;
        const f = clamp((t - ts) / (per * 1.4));
        const tp = strokePath(STROKES[i], x, y, w, h, eio(f));
        if (f < 1) { tip = tp; cur = STROKES[i]; }
      }
    });
    return {tip, cur};
  }
  SCENES.ch03l = {
    draw(t) {
      g.fillStyle = '#15161a'; g.fillRect(0, 0, W, H);
      const p = pose(t);
      // top bar
      g.fillStyle = '#0e0f12'; g.fillRect(0, 0, W, 84);
      fillR(26, 20, 44, 44, 12, lin(0, 20, 0, 64, [[0, C.pink], [1, C.orange]])); icon('brush', 48, 42, 34, '#fff', 4);
      T('Canvas', 88, 56, 34, {w: 700}); T('Lakeside dusk.psd · 64%', 240, 56, 30, {w: 500, c: C.dim});
      pill(W - 30, 18, `Surface ${Math.round(p.tilt)}°`, 30, {a: 'right', dot: C.violet, bg: hexA(C.violet, .2), c: '#d9ccff'});
      // tools
      fillR(0, 84, 110, H - 84, 0, '#0e0f12');
      ['brush', 'drop', 'layers', 'search', 'plus'].forEach((n, i) => { const y = 160 + i * 110, on = i === 0; if (on) fillR(18, y - 37, 74, 74, 20, hexA(C.pink, .3)); icon(n, 55, y, 46, on ? '#fff' : C.dim, 4); });
      // canvas
      const cx = 150, cy = 120, cw = W - 150 - 420, ch = H - 160;
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; fillR(cx, cy, cw, ch, 8, '#efe6d6'); g.restore();
      const {tip, cur} = painting(t, cx, cy, cw, ch);
      if (tip) cursorBrush(tip[0], tip[1], cur.w * cw, t);
      // right panel
      const rx = W - 390, rw = 360;
      card(rx, 120, rw, 300, {r: 28, top: '#1c1d22', bot: '#18191d'});
      T('Brush', rx + 30, 180, 34, {w: 700});
      const curCol = cur ? cur.col : '#ffd59a';
      circle(rx + 90, 290, 60, curCol); ringStroke(rx + 90, 290, 66, 'rgba(255,255,255,.4)', 3);
      T(cur ? `${Math.round(cur.w * cw)} px` : '24 px', rx + 180, 280, 40, {w: 700}); T('Oil · soft', rx + 180, 326, 30, {w: 500, c: C.dim});
      card(rx, 450, rw, H - 490, {r: 28, top: '#1c1d22', bot: '#18191d'});
      T('Layers', rx + 30, 510, 34, {w: 700});
      const layers = [['Highlights', 240], ['Trees', 190], ['Water', 150], ['Hills', 100], ['Mountains', 70], ['Sky', 0]];
      const done = Math.floor((t - T0) / per);
      layers.forEach(([n, at0], i) => {
        const y = 550 + i * 82, on = done >= at0 && (i === 0 || done < layers[i - 1][1]);
        if (on) fillR(rx + 14, y, rw - 28, 70, 14, hexA(C.pink, .25));
        fillR(rx + 30, y + 10, 50, 50, 8, done >= at0 ? PAL[i] : '#2a2b30');
        T(n, rx + 100, y + 46, 32, {w: on ? 700 : 500, c: done >= at0 ? C.text : C.faint});
      });
      toast(t, 4.3, 2.6, cx + 40, cy + 30, 640, 'Drafting · 25°', 'Surface angle synced', {col: C.violet, icon: 'tilt', h: 130, ts: 44, ss: 28});
      toast(t, 12.5, 3.0, cx + 40, cy + 30, 640, `Creative angle · ${Math.round(p.tilt)}°`, 'Surface angle synced', {col: C.pink, icon: 'brush', h: 130, ts: 44, ss: 28});
    },
  };
  function cursorBrush(x, y, r, t) {
    ringStroke(x, y, Math.max(10, r / 2), 'rgba(255,255,255,.85)', 3);
    at(x, y, 1, () => { fillR(-8, -150, 16, 140, 8, '#d8d8de'); fillR(-10, -160, 20, 40, 8, '#2a2b30'); polyFill([[-8, -12], [8, -12], [0, 4]], '#2a2b30'); }, .5 + .05 * Math.sin(t * 3));
  }

  // ---------------- Portrait: reference board + palette ----------------
  SCENES.ch03p = {
    draw(t) {
      g.fillStyle = '#121317'; g.fillRect(0, 0, W, H);
      T('Reference', 60, 130, 76, {w: 700});
      T('Lakeside dusk · 6 pins', 64, 190, 36, {w: 500, c: C.dim});
      const refs = [[0, 0, 0, 560, 400], [1, 580, 0, 440, 400], [5, 0, 420, 440, 340], [4, 460, 420, 560, 340]];
      refs.forEach(([k, x, y, w, h], i) => {
        const kx = 30 + x, ky = 240 + y, a = eo(seg(t, .2 + i * .25, .9 + i * .25));
        alpha(a, () => at(0, (1 - a) * 40, 1, () => {
          g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 26; fillR(kx, ky, w, h, 22, '#000'); g.restore();
          clip(kx, ky, w, h, 22, () => footage(k, kx, ky, w, h, t, {zoom: 1.05 + .03 * Math.sin(t * .3 + i)}));
          circle(kx + w / 2, ky + 18, 12, C.coral);
        }));
      });
      // palette
      const py = 1060;
      T('Palette', 60, py, 60, {w: 700});
      const pick = Math.floor(t / 2.4) % PAL.length;
      PAL.forEach((c, i) => {
        const x = 200 + (i % 3) * 340, y = py + 130 + Math.floor(i / 3) * 168, on = i === pick;
        const k = on ? 1 + .1 * back(seg(t % 2.4, 0, .4)) : 1;
        at(x, y, k, () => { circle(0, 0, 70, c); if (on) ringStroke(0, 0, 86, '#fff', 8); });
      });
      // eyedropper chip
      const c = PAL[pick];
      fillR(60, H - 190, W - 120, 130, 65, 'rgba(255,255,255,0.06)');
      circle(130, H - 125, 44, c); icon('drop', 130, H - 125, 44, 'rgba(0,0,0,.4)');
      T(c.toUpperCase(), 200, H - 110, 56, {w: 700}); T('picked from reference', W - 100, H - 112, 34, {w: 500, a: 'right', c: C.dim});
    },
  };
})();
