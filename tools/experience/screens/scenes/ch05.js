// Chapter 5 · coast (OCC media lab). No desk motion; camera dollies along the stations.
// Station landscape: NLE editor with a playing preview, moving playhead, waveforms.
// Station portrait: colour scopes + bins + export. Wall display: "Portfolio review" reel.
(function () {
  const FPS_TC = 24;
  const tc = s => { const f = Math.floor(s * FPS_TC); return `00:${pad2(f / FPS_TC / 60)}:${pad2((f / FPS_TC) % 60)}:${pad2(f % FPS_TC)}`; };
  // V1 edit: [startSec, endSec, footageKind, name, colour]
  const EDIT = [[0, 2.6, 0, 'ocean_sunset', C.blue], [2.6, 5.0, 1, 'ridge_dusk', C.violet], [5.0, 7.6, 3, 'interview_A', C.coral], [7.6, 9.8, 2, 'city_night', C.teal], [9.8, 12.6, 4, 'road_trip', C.amber], [12.6, 19, 5, 'aurora', C.green]];
  const PH0 = 60.0; // sequence time at t=0
  const playT = t => PH0 + t;
  const shotAt = s => EDIT.find(e => s - PH0 >= e[0] && s - PH0 < e[1]) || EDIT[EDIT.length - 1];

  SCENES.ch05l = {
    draw(t) {
      backdrop(t, {top: '#0a0f1a', bot: '#05070c', blobs: [[C.violet, .08]]});
      // title bar
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, W, 70);
      fillR(28, 18, 34, 34, 9, C.coral); icon('play', 45, 35, 22, '#fff');
      T('Reel Studio', 78, 47, 30, {w: 700});
      T('COAST  ·  Ideas become stories', 300, 47, 28, {w: 500, c: C.dim});
      pill(W - 30, 14, 'Auto-saved', 24, {a: 'right', dot: C.green, bg: 'rgba(255,255,255,0.06)', c: C.soft});
      // bins (left) - widens on ultrawide screens
      const binW = W - 1040 - 420 - 60, cols = Math.max(2, Math.floor((binW - 24) / 200)), tw0 = (binW - 24 - (cols - 1) * 14) / cols;
      card(20, 90, binW, 520, {r: 22});
      T('Media', 44, 140, 32, {w: 700});
      for (let i = 0; i < cols * 3 && i < 12; i++) {
        const bx = 44 + (i % cols) * (tw0 + 14), by = 170 + Math.floor(i / cols) * 140, sel = shotAt(playT(t))[2] === i % 6;
        clip(bx, by, tw0, 94, 10, () => footage(i % 6, bx, by, tw0, 94, t * .3 + i));
        if (sel && i < 6) strokeR(bx - 3, by - 3, tw0 + 6, 100, 12, C.blue2, 4);
        T(['ocean', 'ridge', 'city', 'intvw', 'road', 'aurora'][i % 6] + (i >= 6 ? '_02' : ''), bx + 4, by + 122, 22, {w: 500, c: sel ? C.text : C.dim});
      }
      // program monitor
      const mx = 40 + binW, my = 90, mw = 1040, mh = 585;
      fillR(mx, my, mw, mh, 18, '#000');
      const s = playT(t), sh = shotAt(s), local = s - PH0 - sh[0];
      clip(mx, my, mw, mh, 18, () => {
        footage(sh[2], mx, my, mw, mh, s, {zoom: 1 + local * .03});
        // lower-third title over the first two shots
        const lt = win(t, .4, 4.6, .6);
        alpha(lt, () => {
          fillR(mx + 60, my + mh - 200, 560 * eo(seg(t, .4, 1)), 140, 14, 'rgba(0,0,0,0.55)');
          fillR(mx + 60, my + mh - 200, 10, 140, 5, C.coral);
          T('COAST', mx + 96, my + mh - 120, 64, {w: 700, ls: 10});
          T('a short film by Dana Ortiz', mx + 98, my + mh - 82, 28, {w: 500, c: C.soft});
        });
        // cut flash
        const since = Math.min(...EDIT.map(e => { const d = s - PH0 - e[0]; return d >= 0 ? d : 99; }));
        if (since < .12) { g.fillStyle = `rgba(255,255,255,${.25 * (1 - since / .12)})`; g.fillRect(mx, my, mw, mh); }
      });
      T(tc(s), mx + mw / 2, my + mh + 52, 40, {w: 600, a: 'center', c: C.text});
      icon('play', mx + mw / 2 - 210, my + mh + 40, 34, C.soft); T('1080p · 24 fps', mx + mw - 10, my + mh + 50, 26, {w: 500, a: 'right', c: C.dim});
      // inspector / audio meters (right)
      const ix = mx + mw + 20, iw = W - ix - 20;
      card(ix, 90, iw, 640, {r: 22});
      T('Audio', ix + 24, 140, 32, {w: 700});
      for (let c = 0; c < 2; c++) {
        const lv = .45 + .4 * noise(t * 6 + c * 3) + .1 * Math.sin(t * 12 + c);
        const bx = ix + 40 + c * 70, top = 180, bh = 500;
        fillR(bx, top, 46, bh, 10, 'rgba(255,255,255,0.06)');
        const hh = bh * clamp(lv);
        fillR(bx, top + bh - hh, 46, hh, 10, lin(0, top, 0, top + bh, [[0, C.coral], [.25, C.amber], [.5, C.green], [1, C.green]]));
      }
      T('-6 dB', ix + iw - 24, 230, 26, {w: 600, a: 'right', c: C.soft}); T('L  R', ix + 52, 712, 24, {w: 600, c: C.dim});
      ['Dialog', 'Music', 'FX'].forEach((n, i) => { T(n, ix + iw - 24, 330 + i * 110, 28, {w: 600, a: 'right'}); bar(ix + 200, 350 + i * 110, iw - 224, 10, .5 + .3 * noise(t + i * 4), [C.blue2, C.violet, C.teal][i]); });
      // ---------------- timeline
      const tx = 20, ty = 760, tW = W - 40, tH = H - ty - 20;
      card(tx, ty, tW, tH, {r: 22, top: '#0d1422', bot: '#090e18'});
      const hx = tx + 110, pxPerSec = (tW - 120) / 16, view0 = PH0 - 3 + t * .55; // timeline scrolls gently
      const X = sec => hx + (sec - view0) * pxPerSec;
      // ruler
      for (let sec = Math.floor(view0); sec < view0 + 16; sec++) { const x = X(sec); if (x < hx) continue; fillR(x, ty + 12, 2, 18, 1, C.faint); if (sec % 2 === 0) T(`${pad2(sec / 60)}:${pad2(sec % 60)}`, x + 6, ty + 30, 20, {w: 500, c: C.dim}); }
      const lanes = [['V2', 46], ['V1', 72], ['A1', 60], ['A2', 46]];
      let ly = ty + 46;
      clip(hx, ty, tW - 120, tH, 0, () => {
        lanes.forEach(([n, lh], li) => {
          if (li === 0) { [[0.4, 4.6, 'Title · COAST'], [8.2, 10.6, 'Lower third']].forEach(([a, b, l]) => { fillR(X(PH0 + a), ly, (b - a) * pxPerSec - 4, lh, 10, hexA(C.pink, .55)); T(l, X(PH0 + a) + 12, ly + 32, 22, {w: 600}); }); }
          if (li === 1) EDIT.forEach(([a, b, k, nm, col]) => { const x = X(PH0 + a), w = (b - a) * pxPerSec - 4; fillR(x, ly, w, lh, 10, hexA(col, .55)); clip(x + 4, ly + 4, Math.min(110, w - 8), lh - 8, 6, () => footage(k, x + 4, ly + 4, 110, lh - 8, 0)); T(nm, x + 124, ly + 44, 22, {w: 600}); });
          if (li === 2) { fillR(X(PH0 - 3), ly, 22 * pxPerSec, lh, 10, hexA(C.green, .22)); waveform(X(PH0 - 3) + 6, ly + 6, 22 * pxPerSec - 12, lh - 12, 3, hexA(C.green, .9)); }
          if (li === 3) { fillR(X(PH0 + 1), ly, 18 * pxPerSec, lh, 10, hexA(C.cyan, .2)); waveform(X(PH0 + 1) + 6, ly + 6, 18 * pxPerSec - 12, lh - 12, 9, hexA(C.cyan, .85), {step: 7}); }
          ly += lh + 10;
        });
      });
      ly = ty + 46; lanes.forEach(([n, lh]) => { T(n, tx + 30, ly + lh / 2 + 10, 26, {w: 700, c: C.dim}); ly += lh + 10; });
      // playhead
      const phx = X(s);
      fillR(phx - 2, ty + 8, 4, tH - 16, 2, C.coral);
      polyFill([[phx - 14, ty + 8], [phx + 14, ty + 8], [phx, ty + 26]], C.coral);
      // editor cursor: drags in a marker around 6-8 s
      const cxp = lerp(mx + mw - 200, X(PH0 + 8.2) + 40, eio(seg(t, 5.4, 6.6))), cyp = lerp(560, ty + 60, eio(seg(t, 5.4, 6.6)));
      cursor(cxp + 20 * Math.sin(t * .7), cyp, 1.2);
      vignette(.35);
    },
  };

  // ---------------- Station portrait: colour + bins + export ----------------
  SCENES.ch05p = {
    draw(t) {
      backdrop(t, {top: '#0a0f1a', bot: '#05070c', blobs: [[C.coral, .08], [C.blue, .1]]});
      T('Color', 60, 130, 72, {w: 700});
      pill(W - 60, 76, 'Grade · Teal & Amber', 28, {a: 'right', bg: hexA(C.amber, .18), c: C.amber});
      // reference frame
      const s = playT(t), sh = shotAt(s);
      clip(60, 180, W - 120, (W - 120) * 9 / 16, 26, () => footage(sh[2], 60, 180, W - 120, (W - 120) * 9 / 16, s));
      const split = 60 + (W - 120) * (.5 + .3 * Math.sin(t * .8));
      g.save(); rr(60, 180, W - 120, (W - 120) * 9 / 16, 26); g.clip(); g.fillStyle = 'rgba(20,60,80,0.35)'; g.fillRect(60, 180, split - 60, 600); g.restore();
      fillR(split - 2, 180, 4, (W - 120) * 9 / 16, 2, '#fff'); T('BEFORE', 90, 230, 26, {w: 700, c: '#fff'}); T('AFTER', W - 90, 230, 26, {w: 700, a: 'right', c: '#fff'});
      // colour wheels
      const wy = 920;
      ['Lift', 'Gamma', 'Gain'].forEach((n, i) => {
        const cx = 200 + i * 340, r = 130;
        g.save(); for (let a = 0; a < 360; a += 6) { g.beginPath(); g.moveTo(cx, wy); g.arc(cx, wy, r, a * Math.PI / 180, (a + 7) * Math.PI / 180); g.closePath(); g.fillStyle = `hsla(${a},80%,55%,.55)`; g.fill(); } g.restore();
        circle(cx, wy, r * .62, rad(cx, wy, r * .62, [[0, 'rgba(30,34,44,.6)'], [1, 'rgba(30,34,44,0)']]));
        ringStroke(cx, wy, r, 'rgba(255,255,255,0.2)', 3);
        const a = t * (.4 + i * .2) + i * 2, d = r * (.25 + .2 * noise(t * .5 + i * 3));
        circle(cx + Math.cos(a) * d, wy + Math.sin(a) * d, 18, '#fff'); ringStroke(cx + Math.cos(a) * d, wy + Math.sin(a) * d, 18, '#000', 3);
        T(n, cx, wy + r + 56, 34, {w: 600, a: 'center', c: C.soft});
      });
      // waveform scope
      const sy = 1180;
      card(60, sy, W - 120, 330, {r: 26, top: '#070b12', bot: '#05080e'});
      T('WAVEFORM', 90, sy + 50, 24, {w: 700, c: C.dim, ls: 3});
      g.save(); rr(60, sy, W - 120, 330, 26); g.clip();
      for (let i = 0; i < 180; i++) {
        const x = 80 + i * (W - 160) / 180;
        for (let k = 0; k < 6; k++) { const v = fbm(i * .05 + k * 3 + t * .6), y = sy + 300 - v * 240; g.fillStyle = ['rgba(255,80,80,.35)', 'rgba(80,255,120,.35)', 'rgba(80,150,255,.35)'][k % 3]; g.fillRect(x, y, 4, 4 + 6 * hash(i + k)); }
      }
      g.restore();
      // export progress
      const ey = 1560, pr = clamp(.38 + t * .052);
      card(60, ey, W - 120, 300, {r: 30, accent: C.green});
      T('Exporting', 100, ey + 90, 52, {w: 700});
      T('COAST_final_4K.mp4', 100, ey + 145, 32, {w: 500, c: C.dim});
      T(`${Math.round(pr * 100)}%`, W - 100, ey + 100, 72, {w: 700, a: 'right', c: C.green});
      bar(100, ey + 200, W - 200, 26, pr, lin(100, 0, W - 100, 0, [[0, C.teal], [1, C.green]]));
      T(`${Math.max(0, Math.round((1 - pr) * 140))} s left`, 100, ey + 268, 30, {w: 500, c: C.soft});
      vignette(.35);
    },
  };

  // ---------------- Wall display: Portfolio review reel ----------------
  const WORKS = [
    [0, 'Dana Ortiz', 'COAST', 'Short film · 4 min'], [3, 'Marcus Bell', 'Faces of Costa Mesa', 'Portrait series'],
    [2, 'Ivy Tran', 'Night Shift', 'Motion design'], [5, 'Leo Martins', 'Northern Lights', 'Timelapse'], [4, 'Sofia Reyes', 'Open Road', 'Documentary'],
  ];
  SCENES.ch05w = {
    draw(t) {
      g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
      const intro = 2.4, per = 2.2;
      // title card
      alpha(1 - sm(seg(t, intro - .4, intro)), () => {
        backdrop(t, {top: '#0e1630', bot: '#05070c', blobs: [[C.coral, .18], [C.blue, .2]]});
        T('OCC MEDIA ARTS · FALL 2026', W / 2, 400, 40, {w: 600, a: 'center', c: C.coral, ls: 8});
        T('Portfolio Review', W / 2, 560, 150, {w: 700, a: 'center', glow: hexA(C.blue2, .4), glowR: 40});
        T('5 student showcases', W / 2, 660, 48, {w: 500, a: 'center', c: C.soft});
        bar(W / 2 - 300, 740, 600, 10, eo(seg(t, 0, intro)), C.coral);
      });
      for (let i = 0; i < WORKS.length; i++) {
        const a = intro + i * per - .2, b = a + per + .4;
        const v = Math.min(sm(seg(t, a - .2, a + .3)), 1 - sm(seg(t, b - .3, b + .2)) + (i === WORKS.length - 1 ? 1 : 0));
        if (v <= 0) continue;
        const [k, name, title, kind] = WORKS[i], lt = t - a;
        alpha(v, () => {
          footage(k, 0, 0, W, H, t, {zoom: 1.04 + lt * .03});
          g.fillStyle = lin(0, H * .45, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]); g.fillRect(0, 0, W, H);
          const k2 = eo(seg(lt, .2, .8));
          at(-(1 - k2) * 60, 0, 1, () => {
            T(kind.toUpperCase(), 110, H - 290, 36, {w: 600, c: C.amber, ls: 6, alpha: k2});
            T(title, 104, H - 180, 120, {w: 700, alpha: k2});
            T(name, 110, H - 110, 48, {w: 500, c: C.soft, alpha: k2});
          });
        });
      }
      // persistent chrome: brand + progress dots
      alpha(sm(seg(t, intro - .3, intro + .3)), () => {
        fillR(60, 50, 430, 76, 38, 'rgba(0,0,0,0.5)');
        circle(104, 88, 14, C.coral); T('Portfolio Review', 134, 101, 38, {w: 700});
        const cur = clamp(Math.floor((t - intro) / per), 0, WORKS.length - 1);
        WORKS.forEach((_, i) => { const on = i === cur; fillR(W - 110 - (WORKS.length - i) * 64, 78, on ? 52 : 20, 20, 10, on ? '#fff' : 'rgba(255,255,255,0.35)'); });
      });
    },
  };
  // ---------------- Hero station (flat 12:7, small in frame): review playback ----------------
  SCENES.ch05m = {
    draw(t) {
      g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
      const s = playT(t), sh = shotAt(s);
      const vx = 30, vy = 30, vw = W - 60, vh = H - 260;
      clip(vx, vy, vw, vh, 28, () => footage(sh[2], vx, vy, vw, vh, s, {zoom: 1.02 + (s - PH0 - sh[0]) * .03}));
      pill(vx + 40, vy + 40, 'REVIEW', 44, {bg: hexA(C.coral, .9), c: '#fff', wt: 700});
      T(sh[3].replace('_', ' '), vx + 40, vy + vh - 50, 80, {w: 700, glow: 'rgba(0,0,0,.6)'});
      // chunky timeline
      const ty = H - 200, tx = 40, tW = W - 80, len = 12.6;
      EDIT.forEach(([a, b, k, nm, col]) => fillR(tx + tW * a / len + 3, ty, tW * (Math.min(b, len) - a) / len - 6, 70, 14, hexA(col, .7)));
      waveform(tx, ty + 90, tW, 70, 3, hexA(C.green, .8), {step: 10});
      const phx = tx + tW * (s - PH0) / len;
      fillR(phx - 5, ty - 20, 10, 200, 5, '#fff');
      // review comments popping on the timeline
      [[2.2, C.amber], [5.6, C.pink], [8.4, C.teal]].forEach(([at0, c]) => { const k = back(seg(t, at0, at0 + .4)); if (k > 0) at(tx + tW * at0 / len, ty - 50, k, () => { circle(0, 0, 30, c); icon('chat', 0, 0, 34, '#111', 5); }); });
    },
  };

})();
