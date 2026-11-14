// Cine cut · commons (Humboldt library, Yara -> Mia), Nov 14 2026. The reservation screen Vico liked ("your session's
// up, and the other person was up": exports/cinematic-intro-20261110-people/screens/04-reservation.js), pushed for the
// cine cut's shots (review-cut.json 'commons'):
//   0 .. END        Yara's booking runs out: the countdown and "Booked until 8:00 AM" are the big things (the 2.45-5.2 s
//                   front three-quarter has the screen to the lens); the analog clock is small, racing 5:40 -> 8:00
//   END .. THANKS   "Time's up"
//   THANKS .. MIA   "Thanks, Yara · see you tomorrow" while she takes her bag and walks off (cut at 5.25 s)
//   MIA ..          Mia's turn: lowering to her preset, the drive to table 4 (from the chapter's own lift / drive clips)
//   ARRIVE          "Welcome, Mia", then her team's shared notes open (Mia, Kai, Sofia at work) for the last frames
// opts: {next: 'Mia', prev: 'Yara', team: ['Mia', 'Kai', 'Sofia']}.
(function () {
  const END = 4.6, THANKS = 5.3;
  const lift = () => clipsOf('lift')[0] || {start: 6.2, duration: 2, target: 32};
  const drive = () => clipsOf('wheels')[0] || {start: 7.2, duration: 6.2};
  const YC = C.amber, MC = C.teal;
  const clockMin = t => lerp(5 * 60 + 40, 8 * 60, eio(seg(t, 0, END)));
  function clockFace(cx, cy, r, min, t) {
    circle(cx, cy, r, 'rgba(255,255,255,0.05)'); ringStroke(cx, cy, r, 'rgba(255,255,255,0.22)', 4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; poly([[cx + Math.sin(a) * r * .8, cy - Math.cos(a) * r * .8], [cx + Math.sin(a) * r * .94, cy - Math.cos(a) * r * .94]], i % 3 ? C.dim : C.text, i % 3 ? 3 : 5); }
    const hA = (min / 60 % 12) / 12 * Math.PI * 2, mA = (min % 60) / 60 * Math.PI * 2, race = 1 - seg(t, END - .4, END), sA = (min * 60 % 60) / 60 * Math.PI * 2;
    poly([[cx, cy], [cx + Math.sin(hA) * r * .5, cy - Math.cos(hA) * r * .5]], C.text, 9);
    poly([[cx, cy], [cx + Math.sin(mA) * r * .76, cy - Math.cos(mA) * r * .76]], C.text, 6);
    if (race > .02) alpha(.85 * race, () => poly([[cx, cy], [cx + Math.sin(sA) * r * .86, cy - Math.cos(sA) * r * .86]], C.coral, 3));
    circle(cx, cy, 8, C.text);
  }
  const NOTES = [[.03, .08, '#ffd166', 'Research', 'question'], [.37, .05, '#7bdff2', 'Interview', '5 students'], [.71, .1, '#b8f2a6', 'Quiet zones', 'vs group'],
    [.06, .5, '#f7a1c4', 'Rolling', 'desks!'], [.4, .47, '#ffd166', 'Book the', 'commons'], [.72, .52, '#cdb4ff', 'Draft due', 'Friday']];
  function teamNotes(t, t0, team) {   // Mia's saved workspace: the group's board, three live cursors
    backdrop(t, {top: '#0b1220', bot: '#060a12', blobs: [[MC, .1], [C.blue, .1]]});
    appIcon(70, 70, 64, {glow: true});
    T('Group project · Commons · table 4', 124, 88, 50, {w: 700});
    const cols = [MC, C.amber, C.violet];
    team.forEach((n, i) => avatar(W - 110 - i * 80, 66, 38, cols[i % 3], n[0], {ring: '#0b1220', ringW: 6, ringGap: 0}));
    pill(W - 380, 36, `${team.length} online`, 30, {a: 'right', dot: C.green, bg: hexA(C.green, .15), c: C.green});
    const bx = 40, by = 140, bw = W * .62, bh = H - 180;
    fillR(bx, by, bw, bh, 36, '#e9edf3');
    NOTES.forEach(([nx, ny, col, a, b], i) => {
      const k = back(seg(t, t0 + .1 + i * .12, t0 + .5 + i * .12)); if (k <= 0) return;
      at(bx + bw * nx + 20 + 150, by + bh * ny + 95, k * .8, () => { fillR(-170, -120, 340, 240, 16, col); T(a, -140, -20, 56, {w: 700, c: '#1b2233'}); T(b, -140, 50, 50, {w: 500, c: '#2b3550'}); }, (hash(i) - .5) * .08);
    });
    team.forEach((n, i) => { const [x, y] = wander(t, i + 1, bx + 80, by + 60, bw - 260, bh - 160, .22); cursor(x, y, 1.5, cols[i % 3], n, cols[i % 3]); });
    const px = bx + bw + 30, pw = W - px - 40;
    card(px, by, pw, bh, {r: 36});
    T('Notes', px + 40, by + 80, 50, {w: 700});
    const vis = typed('Desk is here, starting the draft', t, t0 + .4, 24);
    T(vis, px + 40, by + 170, 40, {w: 500, max: pw - 80}); if (vis.length < 32) caret(px + 40 + tw(vis, 40, 500), by + 170, 40, t);
    T(`${team[1]} · ${team[2]} joined`, px + 40, by + 250, 34, {w: 500, c: C.dim});
  }
  SCENES.c04r = {
    draw(t) {
      const o = SHOT.clip.opts || {}, PREV = o.prev || 'Yara', NEXT = o.next || 'Mia', TEAM = o.team || [NEXT, 'Kai', 'Sofia'];
      const L = lift(), D = drive(), MIA = L.start + .8, ARRIVE = D.start + D.duration, NOTES_AT = ARRIVE + .6;
      const height = t => lerp(43.5, +L.target || 32, eio(seg(t, L.start, L.start + L.duration)));
      backdrop(t, {top: '#0b1220', bot: '#060a12', blobs: [[t < MIA ? YC : MC, .1], [C.blue, .1]]});
      appIcon(80, 80, 72, {glow: true});
      T('Commons · shared ErgoFlex desk', 140, 100, 56, {w: 600});
      const min = clockMin(t);
      T(fmtClock(min), W - 220, 104, 60, {w: 600, a: 'right', c: C.soft});
      clockFace(W - 110, 84, 56, min, t);
      // ---- 1. Yara's booking: the countdown is the hero
      const a1 = 1 - sm(seg(t, MIA - .3, MIA + .2)), up = t >= END;
      if (a1 > 0) alpha(a1, () => {
        const left = Math.max(0, 8 * 60 - min), frac = clamp(left / 140), col = up ? C.coral : YC;
        ring(400, 470, 250, 44, frac, col, {glow: 26});
        T(up ? '0:00' : `${Math.floor(left / 60)}:${pad2(left % 60)}`, 400, 520, 150, {w: 700, a: 'center'});
        T(up ? 'time is up' : 'left', 400, 590, 44, {a: 'center', c: C.dim});
        const thanks = sm(seg(t, THANKS - .2, THANKS + .3));
        alpha(1 - thanks, () => {
          avatar(780, 300, 66, YC, PREV[0]);
          T(PREV, 880, 290, 72, {w: 700});
          T(up ? 'Session ended · 8:00 AM' : 'Booked until 8:00 AM', 880, 350, 50, {w: 600, c: up ? C.coral : YC});
          T(up ? `Time's up. Thanks, ${PREV}!` : 'Group study booking', 720, 500, up ? 90 : 70, {w: 700, c: up ? C.text : C.soft});
          bar(720, 560, W - 820, 22, 1 - frac, col);
        });
        alpha(thanks, () => {
          T(`Thanks, ${PREV}`, 720, 420, 120, {w: 700});
          T('See you tomorrow · your notes are saved', 724, 500, 50, {c: C.soft});
        });
        card(720, 620, W - 780, 150, {r: 36, top: '#123b38', bot: '#0d2a2a', border: hexA(MC, .5)});
        avatar(810, 695, 46, MC, NEXT[0]);
        T(`Up next · ${NEXT}`, 880, 690, 56, {w: 700});
        T('8:00 AM · team project · table 4', 880, 745, 38, {c: C.soft});
      });
      // ---- 2. the next person's turn
      const a2 = sm(seg(t, MIA - .1, MIA + .5)) * (1 - sm(seg(t, NOTES_AT, NOTES_AT + .5)));
      if (a2 > 0) alpha(a2, () => {
        const arrived = t >= ARRIVE;
        avatar(260, 380, 130, MC, NEXT[0], {ring: hexA(MC, .6), ringW: 8, ringGap: 12});
        T(arrived ? `Welcome, ${NEXT}` : `${NEXT}'s turn`, 450, 360, 120, {w: 700});
        T(arrived ? 'Your desk is here · until 10:00 AM' : 'Booked from the team table · 8:00 to 10:00', 455, 430, 46, {c: C.soft});
        card(120, 540, 700, 230, {r: 36});
        const hh = height(t), at32 = hh <= (+L.target || 32) + .05;
        T('Height', 170, 600, 40, {c: C.dim});
        T(hh.toFixed(1) + ' in', 170, 700, 100, {w: 700, c: at32 ? MC : C.text});
        T(at32 ? 'Her preset' : 'Lowering to her preset', 170, 750, 34, {c: C.soft});
        const k = eio(seg(t, D.start, ARRIVE)), x0 = 960, x1 = W - 200, y = 690;
        card(880, 540, W - 940, 230, {r: 36});
        T(arrived ? 'Arrived at table 4' : t < D.start ? 'Ready to go' : 'Driving to table 4', 940, 600, 46, {w: 600});
        if (!arrived) T(`${Math.max(0, Math.ceil(ARRIVE - Math.max(t, D.start)))} s`, W - 200, 600, 46, {w: 600, a: 'right', c: MC});
        poly([[x0, y + 20], [x1, y + 20]], 'rgba(255,255,255,0.14)', 14);
        poly([[x0, y + 20], [lerp(x0, x1, k), y + 20]], MC, 14);
        circle(x1, y + 20, 26, arrived ? MC : 'rgba(255,255,255,0.25)');
        iconBadge('desk', lerp(x0, x1, k), y + 20, 44, MC);
      });
      // ---- 3. her team's notes
      const a3 = sm(seg(t, NOTES_AT, NOTES_AT + .5));
      if (a3 > 0) alpha(a3, () => teamNotes(t, NOTES_AT, TEAM));
      vignette(.3);
    },
  };
})();
