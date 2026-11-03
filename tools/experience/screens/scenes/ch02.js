// Chapter 2 · rise (home office, morning -> evening). Lift 28 -> 43.5 (1.6-6.4 s) -> 52.5 (7.4-10.6 s).
(function () {
  // Workday clock shared by both screens: 8:00 AM at t=0, ~6:00 PM by the end.
  const CK = [[0, 480], [4, 512], [8, 655], [12, 840], [15, 1040], [17, 1080]];
  const clock = t => { for (let i = 1; i < CK.length; i++) if (t <= CK[i][0]) { const [a, ma] = CK[i - 1], [b, mb] = CK[i]; return lerp(ma, mb, (t - a) / (b - a)); } return 1080; };
  const day = t => seg(t, 0, 16); // 0 morning .. 1 evening
  const fmtH = h => h.toFixed(1);

  // ---------------- Portrait: ErgoFlex wellness app ----------------
  function heightState(t) {
    const p = pose(t), r = liftRate(t);
    if (r > .05) return {label: 'Rising', col: C.blue2, icon: 'up'};
    if (p.height >= 52.3) return {label: 'Full height', col: C.teal, icon: 'check'};
    if (p.height >= 43) return {label: 'Standing', col: C.green, icon: 'check'};
    return {label: 'Sitting', col: C.amber, icon: 'desk'};
  }
  function deskGlyph(x, y, s, h01, tilt, col) { // tiny side-view desk drawn at ground y
    const top = y - (120 + h01 * 150) * s;
    fillR(x - 18 * s, top, 36 * s, y - top, 10 * s, hexA(col, .55));
    at(x, top, 1, () => fillR(-130 * s, -16 * s, 260 * s, 26 * s, 13 * s, col), -tilt * Math.PI / 180);
    fillR(x - 110 * s, y - 12 * s, 220 * s, 18 * s, 9 * s, hexA(col, .7));
    circle(x - 90 * s, y + 14 * s, 14 * s, hexA(col, .8)); circle(x + 90 * s, y + 14 * s, 14 * s, hexA(col, .8));
  }
  SCENES.ch02p = {
    draw(t) {
      backdrop(t, {top: '#0b1424', bot: '#05080f', blobs: [[C.blue, .2], [C.teal, .08]]});
      statusBar(t, clock(t), {h: 72});
      const p = pose(t), h01 = (p.height - 28) / 24.5, st = heightState(t);
      // header
      appIcon(92, 168, 84, {glow: true});
      T('ErgoFlex', 152, 162, 40, {w: 700});
      T('Wellness', 152, 202, 28, {w: 500, c: C.dim});
      avatar(W - 92, 168, 42, C.violet, 'AK');
      T(clock(t) < 720 ? 'Good morning, Alex' : 'Good afternoon, Alex', 60, 300, 58, {w: 600});

      // ---- hero height card
      const cy = 330, ch = 700;
      card(40, cy, W - 80, ch, {r: 44, accent: st.col, border: hexA(st.col, .35)});
      T('DESK HEIGHT', 90, cy + 92, 34, {w: 600, c: C.dim, ls: 4});
      pill(W - 90, cy + 46, st.label, 34, {a: 'right', bg: hexA(st.col, .2), c: st.col, dot: st.col});
      const big = fmtH(p.height);
      T(big, 80, cy + 400, 270, {w: 700, glow: hexA(C.blue, .55), glowR: 50});
      T('in', 90 + tw(big, 270, 700), cy + 400, 76, {w: 600, c: C.dim});
      // gauge column on the right
      const gx = W - 170, gy0 = cy + 600, gy1 = cy + 170;
      fillR(gx - 16, gy1, 32, gy0 - gy1, 16, 'rgba(255,255,255,0.08)');
      const hy = lerp(gy0, gy1, h01);
      fillR(gx - 16, hy, 32, gy0 - hy, 16, lin(0, gy1, 0, gy0, [[0, C.teal], [1, C.blue]]));
      [[28, 'Sit'], [43.5, 'Stand'], [52.5, 'Max']].forEach(([v, l]) => {
        const yy = lerp(gy0, gy1, (v - 28) / 24.5), on = Math.abs(p.height - v) < .4;
        fillR(gx - 40, yy - 2, 16, 4, 2, on ? C.text : C.faint);
        T(l, gx - 56, yy + 12, 30, {w: on ? 700 : 500, a: 'right', c: on ? C.text : C.faint});
      });
      circle(gx, hy, 30, '#fff'); circle(gx, hy, 18, C.blue);
      // desk glyph that rises with the desk
      deskGlyph(270, cy + 640, .85, h01, 0, C.blue2);
      // rate readout
      const r = liftRate(t);
      T(r > .05 ? `▲ ${r.toFixed(1)} in/s` : `${(p.height * 2.54).toFixed(0)} cm`, 520, cy + 520, 44, {w: 600, c: r > .05 ? C.blue2 : C.dim});
      T(r > .05 ? 'Motor active' : 'Locked', 520, cy + 570, 32, {w: 500, c: C.faint});

      // ---- lower region: cycles with the action
      const ly = 1065;
      // A: stand nudge (0..1.9)
      alpha(win(t, -1, 1.7, .4), () => {
        card(40, ly, W - 80, 300, {r: 40, accent: C.amber});
        iconBadge('bell', 140, ly + 150, 58, C.amber);
        T('Time to stand', 230, ly + 130, 60, {w: 600});
        T('Seated 52 min · tap to rise', 230, ly + 196, 38, {w: 400, c: C.dim});
      });
      // B: rising progress (1.6..6.6), then second rise (7.4..10.6)
      const riseA = win(t, 1.6, 7.3, .4), riseB = win(t, 7.2, 10.9, .4);
      alpha(Math.max(riseA, riseB), () => {
        const target = t < 7 ? 43.5 : 52.5, from = t < 7 ? 28 : 43.5, k = clamp((p.height - from) / (target - from));
        card(40, ly, W - 80, 300, {r: 40, accent: C.blue});
        T(t < 7 ? (k > .99 ? 'Standing · nice!' : 'Rising to standing') : 'Going to full height', 90, ly + 100, 50, {w: 600});
        T(`${fmtH(target)} in`, W - 90, ly + 100, 50, {w: 700, a: 'right', c: C.blue2});
        bar(90, ly + 150, W - 180, 34, k, lin(90, 0, W - 90, 0, [[0, C.blue], [1, C.teal]]));
        T(`${Math.round(k * 100)}%`, 90, ly + 250, 44, {w: 700, c: C.text});
        T('Keep the area clear', W - 90, ly + 250, 34, {w: 400, a: 'right', c: C.dim});
      });
      // C: standing timer + rings (from 6.4)
      const standT = Math.max(0, t - 6.4);
      alpha(win(t, 10.8, 99, .5), () => {
        card(40, ly, W - 80, 740, {r: 40});
        const rx = 290, ry = ly + 300;
        ring(rx, ry, 190, 40, countTo(t, 6.4, 16, .18, .86), C.coral, {glow: 18});
        ring(rx, ry, 140, 40, countTo(t, 6.4, 16, .3, 1.0), C.green, {glow: 18});
        ring(rx, ry, 90, 40, countTo(t, 6.4, 16, .12, .74), C.cyan, {glow: 18});
        icon('up', rx, ry, 70, C.text, 9);
        const stats = [['Standing', fmtMS(Math.floor(standT * 7 + 12)), C.green], ['Calories', String(Math.round(countTo(t, 6.4, 16, 96, 168))), C.coral], ['Steps', Math.round(countTo(t, 6.4, 16, 1840, 2612)).toLocaleString('en-US'), C.cyan]];
        stats.forEach(([l, v, c], i) => {
          const sy = ly + 150 + i * 150;
          circle(548, sy - 18, 14, c);
          T(l, 580, sy - 6, 36, {w: 500, c: C.dim});
          T(v, 580, sy + 56, 66, {w: 700});
        });
        T('Stand goal', 90, ly + 600, 36, {w: 500, c: C.dim});
        T(`${Math.min(10, 6 + Math.floor(seg(t, 10.6, 13) * 2 + (t > 10.6 ? 1 : 0)))} / 10 hours`, 90, ly + 660, 50, {w: 700});
        for (let i = 0; i < 10; i++) { const on = i < (t > 10.6 ? 7 : 6); fillR(500 + i * 48, ly + 618, 36, 48, 10, on ? C.green : 'rgba(255,255,255,0.1)'); }
      });
      // Today's rhythm strip (visible until the rings card takes over)
      alpha(1 - win(t, 10.8, 99, .5), () => {
        const ry = 1400;
        card(40, ry, W - 80, 330, {r: 40});
        T("Today's rhythm", 90, ry + 82, 44, {w: 600});
        T('sit · stand', W - 90, ry + 82, 32, {w: 500, a: 'right', c: C.dim});
        const n = 14, bw = (W - 180) / n;
        for (let i = 0; i < n; i++) {
          const stand = [0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1][i], now = i === 5;
          const hh = (stand ? 150 : 80) * eo(seg(t, .1 + i * .05, .6 + i * .05)) + (now ? 12 * Math.sin(t * 4) : 0);
          fillR(90 + i * bw + 6, ry + 290 - hh, bw - 12, hh, 10, now ? C.blue2 : stand ? C.green : hexA(C.amber, .7));
        }
      });
      // D: celebration (10.6..13.4)
      const cA = win(t, 10.7, 13.6, .5);
      alpha(cA, () => {
        g.fillStyle = 'rgba(3,6,12,0.55)'; g.fillRect(0, 0, W, H);
        const k = back(seg(t, 10.7, 11.3));
        at(W / 2, 980, lerp(.7, 1, k), () => {
          card(-440, -330, 880, 660, {r: 56, top: '#173a2f', bot: '#0d1f1c', border: hexA(C.green, .6), accent: C.green});
          circle(0, -150, 110, hexA(C.green, .2)); circle(0, -150, 80, C.green);
          icon('check', 0, -150, 110, '#06231a', 14);
          T('Great job,', 0, 30, 76, {w: 700, a: 'center'});
          T('you stood up!', 0, 118, 76, {w: 700, a: 'center'});
          T('+1 stand hour · 52.5 in', 0, 210, 40, {w: 500, a: 'center', c: C.green});
        });
      });
      confetti(t, 10.75, W / 2, 840, 90, 620);
      vignette(.35);
    },
  };

  // ---------------- Tablet (3:2): desk remote ----------------
  SCENES.ch02t = {
    draw(t) {
      backdrop(t, {top: '#0c1628', bot: '#05080f', blobs: [[C.blue, .22]]});
      const p = pose(t), r = liftRate(t), up = r > .05;
      T('DESK', 90, 150, 44, {w: 700, c: C.dim, ls: 8});
      const big = p.height.toFixed(1);
      T(big, 80, 520, 330, {w: 700, glow: hexA(C.blue, .5), glowR: 50});
      T('in', 96 + tw(big, 330, 700), 520, 96, {w: 600, c: C.dim});
      // up / down buttons
      const bx = W - 330, glow = up ? .6 + .4 * Math.sin(t * 10) : 0;
      g.save(); if (up) { g.shadowColor = hexA(C.blue2, .9); g.shadowBlur = 60 * glow + 20; }
      fillR(bx, 90, 240, 400, 120, up ? C.blue : 'rgba(255,255,255,0.08)'); g.restore();
      icon('up', bx + 120, 290, 200, up ? '#fff' : C.soft, 22);
      fillR(bx, 520, 240, 400, 120, 'rgba(255,255,255,0.06)');
      icon('down', bx + 120, 720, 200, C.faint, 22);
      // presets
      [[28, 'Sit'], [43.5, 'Stand'], [52.5, 'Max']].forEach(([v, l], i) => {
        const x = 80 + i * 360, on = Math.abs(p.height - v) < .4, near = (r > .05 && ((i === 1 && t < 7) || (i === 2 && t > 7)));
        fillR(x, 640, 330, 280, 50, on ? hexA(C.green, .28) : near ? hexA(C.blue, .22) : 'rgba(255,255,255,0.06)');
        if (on || near) strokeR(x, 640, 330, 280, 50, on ? C.green : C.blue2, 5);
        T(l, x + 40, 740, 64, {w: 700, c: on ? C.green : C.text});
        T(`${v}`, x + 40, 860, 100, {w: 700, c: on ? C.text : C.soft});
      });
      vignette(.4);
    },
  };

  // ---------------- Curved ultrawide: the workday ----------------
  const PEOPLE = [
    ['Maya Chen', '#e0a07a', '#3a6fd8', '#2a3c5a'], ['Jordan Lee', '#8d5a3b', '#e0663d', '#3a2f4a'], ['Sam Rivera', '#c98d66', '#26a17a', '#20343a'],
    ['Priya N.', '#a8714f', '#9a5cf0', '#2e2a48'], ['Alex (you)', '#e8b48f', '#1388ec', '#1c2c44'], ['Leo Park', '#f0c4a0', '#d84a7a', '#3a2a36'],
  ];
  function person(x, y, w, h, i, t, speaking) {
    const [name, skin, shirt, room] = PEOPLE[i];
    clip(x, y, w, h, 26, () => {
      g.fillStyle = lin(x, y, x + w, y + h, [[0, mix(room, '#ffffff', .08)], [1, mix(room, '#000000', .3)]]); g.fillRect(x, y, w, h);
      // window / shelf hint in the background
      fillR(x + w * .62, y + h * .12, w * .26, h * .38, 10, hexA('#ffffff', .07));
      fillR(x + w * .08, y + h * .22, w * .2, h * .05, 4, hexA('#ffffff', .06));
      const bob = Math.sin(t * 1.3 + i * 2) * 4 + (speaking ? Math.sin(t * 7 + i) * 3 : 0);
      const cx = x + w * (.46 + .03 * Math.sin(t * .4 + i)), cy = y + h * .5 + bob;
      fillR(cx - w * .24, cy + h * .14, w * .48, h * .5, w * .16, shirt);
      circle(cx, cy - h * .02, h * .17, skin);
      g.fillStyle = mix(skin, '#1a0f08', .7); g.beginPath(); g.arc(cx, cy - h * .06, h * .175, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    });
    strokeR(x, y, w, h, 26, speaking ? C.green : 'rgba(255,255,255,0.08)', speaking ? 6 : 2);
    fillR(x + 16, y + h - 62, tw(name, 28, 600) + 64, 46, 14, 'rgba(0,0,0,0.55)');
    icon('mic', x + 40, y + h - 39, 30, speaking ? C.green : C.soft, 3);
    T(name, x + 62, y + h - 29, 28, {w: 600});
    if (speaking) for (let k = 0; k < 4; k++) fillR(x + w - 70 + k * 12, y + 30 + 20 - (10 + 18 * noise(t * 9 + k * 3)), 8, 10 + 18 * noise(t * 9 + k * 3), 4, C.green);
  }
  function topBar(t, tint) {
    g.fillStyle = 'rgba(4,8,14,0.6)'; g.fillRect(0, 0, W, 72);
    appIcon(46, 36, 40);
    T('Workspace', 84, 48, 30, {w: 600});
    ['File', 'View', 'Today'].forEach((s, i) => T(s, 280 + i * 120, 48, 28, {w: 500, c: C.dim}));
    // desk widget synced to the lift
    const p = pose(t), r = liftRate(t);
    const wx = W - 800;
    fillR(wx, 14, 300, 44, 22, r > .05 ? hexA(C.blue, .35) : 'rgba(255,255,255,0.08)');
    icon(r > .05 ? 'up' : 'desk', wx + 30, 36, 30, r > .05 ? C.blue2 : C.soft, 3.5);
    T(`Desk ${p.height.toFixed(1)} in`, wx + 56, 47, 28, {w: 600, c: r > .05 ? C.text : C.soft});
    icon(tint < .6 ? 'sun' : 'moon', W - 460, 36, 40, tint < .6 ? C.amber : C.violet, 3.5);
    T(`${Math.round(lerp(61, 68, tint))}°F`, W - 430, 47, 28, {w: 500, c: C.soft});
    T('Thu Oct 30', W - 350, 47, 28, {w: 500, c: C.soft});
    T(fmtClock(clock(t)), W - 40, 47, 32, {w: 700, a: 'right'});
  }
  function dock(t, active) {
    fillR(24, 120, 96, H - 240, 30, 'rgba(10,16,28,0.75)');
    ['home', 'calendar', 'video', 'doc', 'chat', 'music'].forEach((n, i) => {
      const y = 190 + i * 120, on = i === active;
      if (on) fillR(36, y - 36, 72, 72, 20, hexA(C.blue, .35));
      icon(n, 72, y, 46, on ? '#fff' : C.dim, 3.5);
    });
  }
  function secMorning(t, x0) {
    T('Good morning, Alex', x0, 220, 92, {w: 700});
    T('Thursday · 3 meetings · 2 focus blocks', x0, 290, 40, {w: 400, c: C.dim});
    // weather / sun card
    card(x0, 350, 560, 600, {accent: C.amber, r: 40});
    const sunY = 560 - 80 * eo(seg(t, 0, 3));
    circle(x0 + 280, sunY, 120, rad(x0 + 280, sunY, 120, [[0, '#ffd27a'], [1, '#ff9a3d']]));
    g.fillStyle = rad(x0 + 280, sunY, 300, [[0, hexA('#ffb84a', .35)], [1, hexA('#ffb84a', 0)]]); g.fillRect(x0, 350, 560, 600);
    T('62°F', x0 + 50, 820, 96, {w: 700});
    T('Sunny · walk at lunch', x0 + 50, 890, 36, {w: 500, c: C.soft});
    // tasks
    const tx = x0 + 620, tasks = [['Review launch deck', 1.2], ['Reply to design notes', 2.2], ['Stand + stretch', 2.9], ['Ship sprint summary', 99]];
    card(tx, 350, W - tx - 100, 600, {r: 40});
    T("Today's plan", tx + 50, 440, 52, {w: 600});
    tasks.forEach(([s, done], i) => {
      const y = 550 + i * 105, k = eo(seg(t, done, done + .35));
      ringStroke(tx + 80, y - 14, 28, k > 0 ? C.green : C.faint, 4);
      if (k > 0) { circle(tx + 80, y - 14, 28 * k, C.green); icon('check', tx + 80, y - 14, 40, '#05231a', 6); }
      T(s, tx + 140, y, 50, {w: 500, c: k > .5 ? C.dim : C.text});
      if (k > .5) fillR(tx + 140, y - 18, tw(s, 50, 500) * eo(seg(t, done, done + .4)), 4, 2, C.dim);
    });
    pill(W - 140, 380, 'Stand-up in 25 min', 30, {a: 'right', bg: hexA(C.blue, .2)});
  }
  function secCalendar(t, x0) {
    T('Calendar', x0, 200, 76, {w: 700});
    const days = ['Mon 27', 'Tue 28', 'Wed 29', 'Thu 30', 'Fri 31'], cw = (W - x0 - 100) / 5, top = 280, bot = H - 80;
    days.forEach((d, i) => {
      const x = x0 + i * cw, today = i === 3;
      if (today) fillR(x + 4, top, cw - 8, bot - top, 24, hexA(C.blue, .08));
      T(d, x + 20, top + 50, 38, {w: today ? 700 : 500, c: today ? C.blue2 : C.dim});
    });
    const hr = m => lerp(top + 90, bot, (m - 480) / 300);
    const ev = [[0, 540, 610, 'Design sync', C.violet], [1, 600, 690, 'Customer call', C.teal], [2, 495, 560, 'Gym', C.coral], [4, 570, 660, 'Roadmap', C.amber],
      [3, 540, 590, 'Stand-up', C.blue], [3, 615, 720, 'Deep work', C.green], [2, 640, 740, 'Workshop', C.pink], [0, 680, 760, 'Review', C.blue], [1, 735, 780, '1:1 Priya', C.violet], [4, 700, 780, 'Lunch', C.cyan]];
    ev.forEach(([d, a, b, l, c], i) => {
      const k = back(seg(t, 4.1 + i * .15, 4.6 + i * .15)); if (k <= 0) return;
      const x = x0 + d * cw + 10, y = hr(a), h = hr(b) - y - 8;
      at(x + (cw - 20) / 2, y + h / 2, k, () => {
        fillR(-(cw - 20) / 2, -h / 2, cw - 20, h, 18, hexA(c, .3));
        fillR(-(cw - 20) / 2, -h / 2, 10, h, 5, c);
        T(l, -(cw - 20) / 2 + 30, -h / 2 + 50, 38, {w: 600, max: cw - 60});
      });
    });
    const ny = hr(clock(t));
    fillR(x0 + 3 * cw, ny - 3, cw, 6, 3, C.coral); circle(x0 + 3 * cw, ny, 14, C.coral);
    T(fmtClock(clock(t)), x0 + 3 * cw + 24, ny - 16, 28, {w: 700, c: C.coral});
  }
  function secCall(t, x0) {
    const gw = W - x0 - 100, cols = 3, gap = 24, tw_ = (gw - gap * 2) / cols, th = (H - 300 - gap) / 2;
    T('Team call', x0, 180, 64, {w: 700});
    pill(x0 + 330, 136, `● REC  ${fmtMS(Math.floor((t - 8) * 3 + 754))}`, 28, {bg: hexA(C.coral, .2), c: C.coral});
    const spk = Math.floor(fract((t - 8) / 6) * 6 * 1.0001) % 6, order = [1, 3, 0, 5, 2, 1];
    for (let i = 0; i < 6; i++) {
      const cx = i % cols, cy = Math.floor(i / cols), k = eo(seg(t, 8 + i * .08, 8.5 + i * .08));
      alpha(k, () => person(x0 + cx * (tw_ + gap), 220 + cy * (th + gap) + (1 - k) * 30, tw_, th, i, t, order[Math.floor((t - 8) / 1.1) % 6] === i));
    }
    // controls
    void spk;
  }
  function secFocus(t, x0, tint) {
    const ew = W - x0 - 740;
    card(x0, 120, ew, H - 200, {r: 34, top: '#0e1626', bot: '#0b111d'});
    T('sprint-summary.md', x0 + 40, 185, 34, {w: 600, c: C.soft});
    fillR(x0, 220, ew, 2, 0, C.line);
    const lines = [['# Sprint 42 summary', C.blue2, 72, 700], ['Shipped standing reminders', C.text, 54, 500], ['and new height presets.', C.text, 54, 500],
      ['## Wins', C.teal, 60, 700], ['• 9 stand breaks today', C.soft, 52, 500], ['• 2 focus blocks done', C.soft, 52, 500]];
    let cT = 12.3, y = 320;
    lines.forEach(([s, c, sz, w]) => {
      const vis = typed(s, t, cT, 40); cT += s.length / 40 + .08;
      if (vis.length || !s) T(vis, x0 + 50, y, sz, {w, c});
      if (vis.length && vis.length < s.length) caret(x0 + 50 + tw(vis, sz, w), y, sz, t);
      y += sz * 1.55;
    });
    // focus ring
    const fx = W - 380, fy = 430;
    card(W - 700, 120, 600, 620, {r: 40, accent: C.violet});
    ring(fx, fy, 200, 34, 1 - seg(t, 12, 17) * .35 - .1, C.violet, {glow: 20});
    T(fmtMS(Math.floor(lerp(25 * 60, 25 * 60 - 400, seg(t, 12, 17)))), fx, fy + 30, 92, {w: 700, a: 'center'});
    T('Deep work', fx, fy + 90, 34, {w: 500, a: 'center', c: C.dim});
    T('Focus · notifications off', W - 650, 690, 34, {w: 500, c: C.soft});
    // music widget
    card(W - 700, 770, 600, 230, {r: 40});
    fillR(W - 660, 810, 150, 150, 26, lin(0, 810, 0, 960, [[0, C.pink], [1, C.violet]]));
    T('Lo-fi sunset', W - 480, 870, 40, {w: 600}); T('Evening focus mix', W - 480, 920, 30, {w: 400, c: C.dim});
    bar(W - 480, 945, 330, 10, fract(t * .05) * .5 + .3, C.pink);
    void tint;
  }
  SCENES.ch02l = {
    draw(t) {
      const tint = day(t);
      // wallpaper: morning blue/gold -> evening violet/amber
      g.fillStyle = lin(0, 0, 0, H, [[0, mix('#14365e', '#2a1a40', tint)], [.6, mix('#0b1a30', '#1a0f24', tint)], [1, '#05070d']]); g.fillRect(0, 0, W, H);
      const sx = lerp(W * .2, W * .85, tint), sy = lerp(H * .15, H * .7, tint * tint);
      g.fillStyle = rad(sx, sy, H * 1.3, [[0, hexA(tint < .5 ? '#ffc067' : '#ff7a59', .22)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      backdrop(t, {top: 'rgba(0,0,0,0)', bot: 'rgba(0,0,0,0)', blobs: [[C.blue, .1]]});
      const secs = [[-1, 4.0, 0], [4.0, 8.0, 1], [8.0, 12.0, 2], [12.0, 99, 3]];
      const x0 = 200;
      secs.forEach(([a, b, i]) => {
        const v = win2(t, a, b, .45); if (v <= 0) return;
        const dx = t < a + .45 ? (1 - eo(seg(t, a, a + .45))) * 90 : -(1 - v) * 90;
        alpha(v, () => at(dx, 0, 1, () => [secMorning, secCalendar, secCall, secFocus][i](t, x0, tint)));
      });
      // call controls overlay (part of call section)
      alpha(win2(t, 8.0, 12.0, .45), () => {
        const bx = W / 2 + 60;
        fillR(bx - 280, H - 66, 560, 60, 30, 'rgba(6,10,18,0.85)');
        ['mic', 'cam', 'chat', 'user'].forEach((n, i) => icon(n, bx - 200 + i * 110, H - 36, 40, C.soft, 3.5));
        fillR(bx + 190, H - 58, 80, 44, 22, C.coral); T('End', bx + 230, H - 27, 24, {w: 700, a: 'center'});
      });
      dock(t, t < 4.1 ? 0 : t < 8.1 ? 1 : t < 12.1 ? 2 : 3);
      topBar(t, tint);
      toast(t, 15.0, 2.5, W - 760, 96, 660, 'Great day, Alex', '6h 40m focused · 9 stand breaks', {col: C.green, icon: 'check'});
      vignette(.4);
    },
  };
})();
