// Chapter 4 · commons (Vico's cut with people): the desk's curved monitor as the shared desk's reservation screen.
// Drawn with the film's screen toolkit (tools/experience/screens/lib.js); rendered by render-04-reservation.mjs.
// t = chapter seconds. The beats follow the chapter (review-cut.json, shot "commons"):
//   0-4.6    Yara's booking runs out, the clock racing (the night going by in a few seconds)
//   4.6-6.8  time's up; Mia, who booked the next slot from the team table, is next
//   6.2-8.2  the desk lowers 43.5 -> 32 in (her preset), 6.8-13.4 it drives itself to her
//   13.4-    welcome, Mia
(function () {
  const END = 4.6, LIFT = [6.2, 8.2], DRIVE = [6.8, 13.4], ARRIVE = 13.4;
  const YARA = C.amber, MIA = C.teal;
  // the clock: 5:40 AM to 8:00 AM over the first 4.6 s, eased so it slows into the hour
  const clockMin = t => lerp(5 * 60 + 40, 8 * 60, eio(seg(t, 0, END)));
  const height = t => lerp(43.5, 32, seg(t, LIFT[0], LIFT[1]));
  function clockFace(cx, cy, r, min, t) {
    g.save();
    circle(cx, cy, r, 'rgba(255,255,255,0.05)'); ringStroke(cx, cy, r, 'rgba(255,255,255,0.22)', 6);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r0 = r * (i % 3 ? .88 : .8); poly([[cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * r * .95, cy - Math.cos(a) * r * .95]], i % 3 ? C.dim : C.text, i % 3 ? 4 : 8); }
    const hA = (min / 60 % 12) / 12 * Math.PI * 2, mA = (min % 60) / 60 * Math.PI * 2;
    // the second hand: a blur of turns while time races, still once it is 8:00
    const race = 1 - seg(t, END - .4, END), sA = (min * 60 % 60) / 60 * Math.PI * 2;
    poly([[cx, cy], [cx + Math.sin(hA) * r * .5, cy - Math.cos(hA) * r * .5]], C.text, 16);
    poly([[cx, cy], [cx + Math.sin(mA) * r * .76, cy - Math.cos(mA) * r * .76]], C.text, 10);
    if (race > .02) alpha(.85 * race, () => poly([[cx, cy], [cx + Math.sin(sA) * r * .86, cy - Math.cos(sA) * r * .86]], C.coral, 4));
    circle(cx, cy, 14, C.text);
    g.restore();
  }
  SCENES.ch04r = {
    draw(t) {
      backdrop(t, {top: '#0b1220', bot: '#060a12', blobs: [[t < END + 1 ? YARA : MIA, .1], [C.blue, .1]]});
      appIcon(80, 80, 72, {glow: true});
      T('Commons · shared ErgoFlex desk', 140, 100, 56, {w: 600});
      const min = clockMin(t);
      T(fmtClock(min), W - 60, 104, 60, {w: 600, a: 'right', c: C.soft});
      // ---- 1. Yara's booking runs out
      const a1 = 1 - sm(seg(t, END + 1.2, END + 1.7));
      if (a1 > 0) alpha(a1, () => {
        clockFace(390, 600, 300, min, t);
        const left = Math.max(0, 8 * 60 - min), up = t >= END;
        card(780, 190, W - 840, 560, {r: 40});
        avatar(900, 330, 70, YARA, 'Y');
        T('Yara', 1000, 320, 64, {w: 700});
        T(up ? 'Session ended · 8:00 AM' : 'Booked until 8:00 AM', 1000, 385, 44, {c: up ? C.coral : C.soft});
        const frac = clamp(left / 140);
        ring(W - 260, 470, 170, 30, frac, up ? C.coral : YARA, {glow: 20});
        T(up ? '0:00' : `${Math.floor(left / 60)}:${pad2(left % 60)}`, W - 260, 500, 96, {w: 700, a: 'center'});
        T('left', W - 260, 560, 40, {a: 'center', c: C.dim});
        bar(860, 520, W - 1340, 22, 1 - frac, up ? C.coral : YARA);
        T(up ? "Time's up. Thanks, Yara!" : 'Group study booking', 860, 640, up ? 64 : 48, {w: up ? 700 : 500, c: up ? C.text : C.soft});
        // up next
        card(780, 790, W - 840, 220, {r: 36, top: '#123b38', bot: '#0d2a2a', border: hexA(MIA, .5)});
        avatar(890, 900, 56, MIA, 'M');
        T('Up next · Mia', 980, 890, 56, {w: 700});
        T('8:00 AM · team project · table 4', 980, 950, 42, {c: C.soft});
      });
      // ---- 2. Mia's turn: the desk sets her height and comes to her table
      const a2 = sm(seg(t, END + 1.3, END + 1.9));
      if (a2 > 0) alpha(a2, () => {
        avatar(300, 470, 150, MIA, 'M', {ring: hexA(MIA, .6), ringW: 8, ringGap: 12});
        const arrived = t >= ARRIVE;
        T(arrived ? 'Welcome, Mia' : "Mia's turn", 520, 430, 120, {w: 700});
        T(arrived ? 'Your desk is here · until 10:00 AM' : 'Booked from the team table · 8:00 to 10:00', 520, 510, 48, {c: C.soft});
        // height to her preset
        card(160, 680, 760, 320, {r: 36});
        T('Height', 220, 760, 44, {c: C.dim});
        T(height(t).toFixed(1) + ' in', 220, 880, 110, {w: 700, c: height(t) <= 32.05 ? MIA : C.text});
        T(height(t) <= 32.05 ? 'Her preset' : 'Lowering to her preset', 220, 960, 40, {c: C.soft});
        // the drive
        const k = eio(seg(t, DRIVE[0], DRIVE[1])), x0 = 1040, x1 = W - 200, y = 840;
        card(980, 680, W - 1140, 320, {r: 36});
        T(arrived ? 'Arrived at table 4' : t < DRIVE[0] ? 'Ready to go' : 'Driving to table 4', 1040, 760, 48, {w: 600});
        if (!arrived) T(`${Math.max(0, Math.ceil(DRIVE[1] - Math.max(t, DRIVE[0])))} s`, W - 200, 760, 48, {w: 600, a: 'right', c: MIA});
        poly([[x0, y + 40], [x1, y + 40]], 'rgba(255,255,255,0.14)', 14);
        poly([[x0, y + 40], [lerp(x0, x1, k), y + 40]], MIA, 14);
        circle(x1, y + 40, 26, arrived ? MIA : 'rgba(255,255,255,0.25)');
        iconBadge('desk', lerp(x0, x1, k), y + 40, 44, MIA);
        T('Group study table · Mia, Kai, Sofia', 1040, 960, 40, {c: C.soft});
      });
      vignette(.3);
    },
  };
})();
