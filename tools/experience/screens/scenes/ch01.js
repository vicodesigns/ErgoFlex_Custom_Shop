// Chapter 1 · awaken (product void). ErgoFlex app "digital twin" control screen.
// Readouts, the activity log and the beats follow the shot's motion clips (CAPTURE_SHOT or shots/01.json):
// "Twin synced" sits in the longest pause between moves, the end wordmark comes after the last move's light
// has settled (the rules reproduce the 2026-10-30 clip's 19-24.4 s and 30.4 s exactly).
// With TWIN=<video> (capture.mjs) the DIGITAL TWIN card shows the real 3D desk (twinCard) instead of the
// drawn side view (schematic).
(function () {
  let BOOT = 1.5, ON = 0, EARLY = 10;   // ON: the desk's lights-on (SHOT.lightsOn); the screen is black before it
  // Merged busy spans of every clip; the longest gap between them is the hold for the "Twin synced" moment.
  function beats() {
    const spans = SHOT.clips.map(c => [c.start, c.start + c.duration]).sort((a, b) => a[0] - b[0]), busy = [];
    for (const s of spans) { const last = busy[busy.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else busy.push(s.slice()); }
    let gap = null;
    for (let i = 1; i < busy.length; i++) if (!gap || busy[i][0] - busy[i - 1][1] > gap[1] - gap[0]) gap = [busy[i - 1][1], busy[i][0]];
    const lastEnd = busy.length ? busy[busy.length - 1][1] : 0;
    const synced = gap ? [Math.max(gap[0] + .9, gap[1] - 6), gap[1] - .6] : [-1, -1];
    return {synced, end: Math.max(SHOT.seconds - 3.6, lastEnd + 1)};
  }
  let B = null;
  function logEntries() {
    return SHOT.clips.filter(c => c.duration >= .3).map(c => {
      let text, icn, col;
      if (c.lane === 'lift') { text = `Lift to ${(+c.target).toFixed(1)} in`; icn = 'up'; col = C.blue2; }
      else if (c.lane === 'tilt') { text = c.target > .5 ? `Tilt to ${Math.round(c.target)}°` : 'Level surface'; icn = 'tilt'; col = C.violet; }
      else if (c.kind === 'rotate') { text = `Turn ${c.direction || 'right'} ${Math.round(+c.value || 0)}°`; icn = 'wheel'; col = C.teal; }
      else if (c.kind === 'travel') { text = `Roll ${c.direction || 'forward'} ${Math.round(+c.value || 0)} in`; icn = 'wheel'; col = C.teal; }
      else { const y = c.target && c.target.yaw; text = /Turn/.test(c.label) ? `${c.label} to ${Math.round(y)}°` : c.label; icn = 'wheel'; col = C.teal; }
      return {t: c.start, end: c.start + c.duration, text, icn, col};
    });
  }
  function wheelStatus(t) {
    const c = activeClip(t, 'wheels');
    if (!c || c.duration < .3) return {label: 'Wheels locked', col: C.dim, moving: false};
    return {label: c.label.replace('Move', 'Rolling').replace('Turn', 'Turning'), col: C.teal, moving: true};
  }
  function schematic(t, x, y, w, h) {
    const p = pose(t);
    card(x, y, w, h, {r: 36, top: '#0c1628', bot: '#08101d'});
    clip(x, y, w, h, 36, () => {
      // blueprint grid
      g.strokeStyle = 'rgba(82,178,255,0.07)'; g.lineWidth = 2;
      for (let gx = x + 40; gx < x + w; gx += 60) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); }
      for (let gy = y + 40; gy < y + h; gy += 60) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); }
      // scanning beam
      const sx = x + w * fract(t * .12);
      g.fillStyle = lin(sx - 160, 0, sx, 0, [[0, 'rgba(82,178,255,0)'], [1, 'rgba(82,178,255,0.12)']]); g.fillRect(sx - 160, y, 160, h);
    });
    T('DIGITAL TWIN', x + 44, y + 70, 30, {w: 600, c: C.dim, ls: 4});
    pill(x + w - 44, y + 34, 'Live', 28, {a: 'right', dot: C.green, bg: hexA(C.green, .16), c: C.green});
    // desk side view
    const floor = y + h - 90, cx = x + w * .52, s = 9.4;
    poly([[x + 40, floor], [x + w - 40, floor]], 'rgba(82,178,255,0.35)', 3);
    const roll = (p.z * 4 + p.x * 3) * .9;
    const topY = floor - p.height * s;
    // wheels (spin with travel)
    [-1, 1].forEach(sg => {
      const wx = cx + sg * 190, wy = floor - 26;
      ringStroke(wx, wy, 26, C.blue2, 5);
      for (let k = 0; k < 3; k++) { const a = roll * .3 + k * 2.09; poly([[wx, wy], [wx + Math.cos(a) * 22, wy + Math.sin(a) * 22]], C.blue2, 3); }
    });
    fillR(cx - 250, floor - 66, 500, 22, 11, C.blue);
    // column (telescoping)
    fillR(cx - 26, topY + 20, 52, floor - 66 - topY - 20, 10, hexA(C.blue2, .55));
    fillR(cx - 36, floor - 66 - 160, 72, 160, 12, hexA(C.blue, .7));
    // top (tilts)
    at(cx, topY + 14, 1, () => {
      g.save(); g.shadowColor = hexA(C.blue2, .8); g.shadowBlur = 30;
      fillR(-330, -14, 660, 28, 14, '#cfe6ff'); g.restore();
      fillR(-330, 14, 660, 6, 3, hexA(C.cyan, .8 + .2 * Math.sin(t * 3)));
    }, -p.tilt * Math.PI / 180);
    // dimension line
    const dx = x + 110;
    poly([[dx, floor], [dx, topY + 14]], C.amber, 3);
    poly([[dx - 16, floor], [dx + 16, floor]], C.amber, 3); poly([[dx - 16, topY + 14], [dx + 16, topY + 14]], C.amber, 3);
    fillR(dx + 26, (floor + topY) / 2 - 34, 190, 68, 20, 'rgba(255,178,46,0.16)');
    T(`${p.height.toFixed(1)} in`, dx + 121, (floor + topY) / 2 + 14, 40, {w: 700, a: 'center', c: C.amber});
    // tilt arc
    if (p.tilt > .3) {
      g.beginPath(); g.arc(cx + 330, topY + 14, 90, -p.tilt * Math.PI / 180, 0); g.strokeStyle = C.violet; g.lineWidth = 4; g.stroke();
      T(`${p.tilt.toFixed(0)}°`, cx + 350, topY + 90, 44, {w: 700, c: C.violet});
    }
  }
  // The real desk: frame round(t * 30) of the twin render (build-round8-twin.py), cover-fitted into the card,
  // with the card's label, Live pill and the height / tilt chips the side view had.
  const twinOn = () => !!(SHOT.videos && SHOT.videos.twin);
  const twinIdx = t => clamp(Math.round(t * 30), 0, SHOT.videos.twin.count - 1);
  function twinCard(t, x, y, w, h) {
    const p = pose(t);
    card(x, y, w, h, {r: 36, top: '#0c1628', bot: '#08101d'});
    clip(x, y, w, h, 36, () => {
      drawCover(frameImg('twin', twinIdx(t)), x, y, w, h);
      g.fillStyle = lin(0, y, 0, y + 170, [[0, 'rgba(5,10,18,0.72)'], [1, 'rgba(5,10,18,0)']]); g.fillRect(x, y, w, 170);
      g.fillStyle = lin(0, y + h - 150, 0, y + h, [[0, 'rgba(5,10,18,0)'], [1, 'rgba(5,10,18,0.6)']]); g.fillRect(x, y + h - 150, w, 150);
      const sx = x + w * fract(t * .12);   // soft both sides: a hard edge over the picture reads as a seam
      g.fillStyle = lin(sx - 180, 0, sx + 180, 0, [[0, 'rgba(82,178,255,0)'], [.5, 'rgba(82,178,255,0.06)'], [1, 'rgba(82,178,255,0)']]); g.fillRect(sx - 180, y, 360, h);
    });
    strokeR(x + .5, y + .5, w - 1, h - 1, 36, C.line2, 2);
    T('DIGITAL TWIN', x + 44, y + 70, 30, {w: 600, c: C.dim, ls: 4});
    pill(x + w - 44, y + 34, 'Live', 28, {a: 'right', dot: C.green, bg: hexA(C.green, .16), c: C.green});
    const cy = y + h - 64;
    fillR(x + 40, cy - 34, 190, 68, 20, 'rgba(255,178,46,0.16)');
    T(`${p.height.toFixed(1)} in`, x + 135, cy + 14, 40, {w: 700, a: 'center', c: C.amber});
    alpha(sm(seg(p.tilt, .3, 1.5)), () => {
      fillR(x + 246, cy - 34, 130, 68, 20, hexA(C.violet, .18));
      T(`${p.tilt.toFixed(0)}°`, x + 311, cy + 14, 40, {w: 700, a: 'center', c: C.violet});
    });
  }
  function minimap(t, x, y, w, h) {
    card(x, y, w, h, {r: 32});
    T('POSITION', x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    const p = pose(t), cx = x + w / 2, cy = y + h / 2 + 36, sc = 8;
    const toS = (px, pz) => [cx + (px - 3) * sc, cy + (6 - pz) * sc];
    clip(x, y + 80, w, h - 90, 0, () => {
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
      for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(cx + i * 40, y); g.lineTo(cx + i * 40, y + h); g.stroke(); g.beginPath(); g.moveTo(x, cy + i * 40); g.lineTo(x + w, cy + i * 40); g.stroke(); }
      const trail = []; for (let s = 0; s <= t; s += .1) { const q = pose(s); trail.push(toS(q.x, q.z)); }
      if (trail.length > 1) { g.setLineDash([10, 10]); poly(trail, hexA(C.teal, .7), 4); g.setLineDash([]); }
      const [sx, sy] = toS(p.x, p.z);
      at(sx, sy, 1, () => {
        g.fillStyle = rad(0, 0, 120, [[0, hexA(C.teal, .25)], [1, hexA(C.teal, 0)]]); g.fillRect(-120, -120, 240, 240);
        fillR(-46, -24, 92, 48, 10, hexA(C.blue, .85)); strokeR(-46, -24, 92, 48, 10, '#cfe6ff', 3);
        polyFill([[0, -44], [-14, -30], [14, -30]], C.teal);
      }, p.yaw * Math.PI / 180);
    });
  }
  function readout(x, y, w, h, label, val, unit, col, sub, frac) {
    card(x, y, w, h, {r: 30, accent: col});
    T(label, x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    T(val, x + 32, y + 145, 92, {w: 700});
    T(unit, x + 40 + tw(val, 92, 700), y + 145, 40, {w: 600, c: C.dim});
    if (frac != null) bar(x + 34, y + 168, w - 68, 12, frac, col);
    if (sub) T(sub, x + 34, y + 222, 30, {w: 500, c: col});
  }
  SCENES.ch01 = {
    prefetch(t) { return twinOn() ? [['twin', twinIdx(t)]] : []; },
    draw(t) {
      if (SHOT.lightsOn && !ON) { ON = SHOT.lightsOn; BOOT = ON + 1.5; EARLY = BOOT + 5; }
      if (t < ON) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
      if (!B) B = beats();
      backdrop(t, {top: '#08101e', bot: '#04060b', blobs: [[C.blue, .16], [C.violet, .06]]});
      const p = pose(t), ui = eo(seg(t, BOOT - .2, BOOT + .8)), endLogo = sm(seg(t, B.end, B.end + 1.2));
      // ---- main UI
      alpha(ui * (1 - endLogo * .85), () => {
        at(0, (1 - ui) * 40, 1, () => {
          // header
          appIcon(78, 70, 64, {glow: true});
          T('ErgoFlex', 128, 84, 44, {w: 700});
          T('· Studio Desk 60×30', 330, 84, 34, {w: 500, c: C.dim});
          const syncPulse = .5 + .5 * Math.sin(t * 4);
          pill(W - 40, 40, 'Connected', 28, {a: 'right', dot: hexA(C.green, .6 + .4 * syncPulse), bg: hexA(C.green, .14), c: C.green});
          const RW = Math.min(1000, W * .42), rx = W - 40 - RW, SW = rx - 70, HW = (SW - 20) / 2;
          (twinOn() ? twinCard : schematic)(t, 40, 130, SW, 640);
          minimap(t, 40, 790, HW, 260);
          // height history sparkline
          const sx0 = 60 + HW;
          card(sx0, 790, HW, 260, {r: 32});
          T('HEIGHT · LIVE', sx0 + 34, 846, 26, {w: 600, c: C.dim, ls: 3});
          const hist = []; for (let k = 0; k < 60; k++) hist.push(pose(t - 6 + k * .1).height);
          spark(sx0 + 34, 880, HW - 68, 140, hist, C.blue2, {min: 26, max: 54, fill: .35, lw: 5});
          circle(sx0 + HW - 34, 880 + 140 - 140 * (p.height - 26) / 28, 10, C.blue2);
          // right column
          const rw = RW;
          readout(rx, 130, rw / 2 - 10, 250, 'HEIGHT', p.height.toFixed(1), 'in', C.blue2, liftRate(t) > .05 ? '▲ Lifting' : 'Holding', (p.height - 28) / 24.5);
          readout(rx + rw / 2 + 10, 130, rw / 2 - 10, 250, 'TILT', p.tilt.toFixed(0), '°', C.violet, tiltRate(t) > .2 ? '▲ Tilting' : tiltRate(t) < -.2 ? '▼ Leveling' : 'Level', p.tilt / 65);
          const ws = wheelStatus(t), hd = ((p.yaw % 360) + 360) % 360;
          card(rx, 400, rw, 200, {r: 30, accent: ws.moving ? C.teal : null});
          T('WHEELS', rx + 34, 456, 26, {w: 600, c: C.dim, ls: 3});
          T(ws.label, rx + 34, 530, 52, {w: 700, c: ws.moving ? C.text : C.soft});
          T(`Heading ${hd.toFixed(0)}°  ·  ${speed(t).toFixed(1)} in/s`, rx + 34, 578, 30, {w: 500, c: ws.moving ? C.teal : C.dim});
          // compass
          at(rx + rw - 100, 500, 1, () => {
            ringStroke(0, 0, 62, 'rgba(255,255,255,0.15)', 4);
            T('N', 0, -72, 22, {w: 700, a: 'center', c: C.dim});
            at(0, 0, 1, () => { polyFill([[0, -54], [-14, 0], [14, 0]], C.teal); polyFill([[0, 54], [-14, 0], [14, 0]], 'rgba(255,255,255,0.25)'); }, hd * Math.PI / 180);
          });
          // activity log
          card(rx, 620, rw, 430, {r: 30});
          T('ACTIVITY', rx + 34, 676, 26, {w: 600, c: C.dim, ls: 3});
          const ents = logEntries().filter(e => t >= e.t - .1);
          ents.slice(-4).reverse().forEach((e, i) => {
            const k = eo(seg(t, e.t - .1, e.t + .3)), y = 724 + i * 76, done = t >= e.end;
            alpha(k * (1 - i * .14), () => {
              iconBadge(e.icn, rx + 64, y + 20 - (1 - k) * 20, 26, e.col);
              T(e.text, rx + 110, y + 32, 34, {w: 600, c: i === 0 ? C.text : C.soft});
              if (done) icon('check', rx + rw - 60, y + 20, 34, C.green, 4);
              else { const fr = seg(t, e.t, e.end); ring(rx + rw - 60, y + 20, 15, 5, fr, e.col); }
            });
          });
        });
      });
      // "Digital twin synced" moment in the longest hold between moves. Over the real desk it sits small at the
      // card's bottom right instead of across the middle.
      const [s0, s1] = B.synced, tw_ = win(t, s0, s1, .6), twin = twinOn();
      alpha(tw_ * (1 - endLogo), () => {
        const k = eo(seg(t, s0, s0 + .8));
        at(twin ? W - Math.min(1000, W * .42) - 70 - 216 : 40 + (W - 1110) / 2, twin ? 130 + 640 - 74 : 480, lerp(.9, 1, k) * (twin ? .62 : 1), () => {
          fillR(-300, -70, 600, 140, 70, 'rgba(6,14,28,0.82)'); strokeR(-300, -70, 600, 140, 70, hexA(C.blue2, .6), 3);
          iconBadge('check', -220, 0, 40, C.green);
          T('Twin synced', -160, 0, 50, {w: 700});
          T('every move mirrored', -160, 44, 28, {w: 500, c: C.dim});
        });
        if (!twin) ringStroke(40 + (W - 1110) / 2, 480, 320 + 200 * fract(t * .6), hexA(C.blue2, .35 * (1 - fract(t * .6))), 4);
      });
      // ---- boot logo and end logo
      const bootA = 1 - sm(seg(t, BOOT - .3, BOOT + .5));
      const la = Math.max(bootA * sm(seg(t, ON, ON + .7)), endLogo);
      alpha(la, () => {
        const k = t < EARLY ? eo(seg(t, ON, ON + 1.2)) : eo(seg(t, B.end, B.end + 1.6));
        g.fillStyle = rad(W / 2, H / 2, 700, [[0, hexA(C.blue, .22 * la)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
        logo(W / 2, H / 2 - 30, lerp(760, 820, k), 1, {glow: hexA(C.blue2, .6), glowR: 50});
        T(t < EARLY ? 'Connecting to your desk' : 'Your partner in health', W / 2, H / 2 + 120, 40, {w: 500, a: 'center', c: C.soft});
        if (t < EARLY) bar(W / 2 - 220, H / 2 + 170, 440, 10, eo(seg(t, ON + .2, BOOT)), C.blue);
        else { T(`${p.height.toFixed(1)} in  ·  ${Math.round(p.tilt)}°  ·  synced`, W / 2, H / 2 + 180, 32, {w: 600, a: 'center', c: C.blue2}); }
      });
      vignette(.45);
    },
  };
})();
