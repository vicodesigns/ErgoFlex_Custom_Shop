// Cine cut · wellness (gym, Maya), Nov 14 2026: a break built into Maya's day (review-cut.json 'wellness', 16 s: the
// desk rises 6.0-11.0 s to 41 in as she gets up; S16: she is up by 8.9 s, changes into the stretch 9.0-10.4 s, holds it
// to 11.6 s and is back on the keys at 13.0 s). Main (Dell 16:9) and tablet (3:2), with the beats (WELLNESS_BEATS):
//   0 .. nudge            her report, focused time ticking (she is seated, working)
//   nudge .. L0           "Time to move, Maya" + 3-2-1 (L0: the lift, her hands off the keys)
//   L0 .. stretch         the desk rising: the live height ring, no demo (she stands up)
//   stretch .. stretchEnd the stretch she does (the shoulder-squeeze demo clip, dark mode) beside the height
//   stretchEnd ..         back to her report, standing; "Reset done · +4 min standing" at reset
// Tablet: quiet focus, the breathing coach stretch .. breatheEnd, then "HR 74 · nice reset, Maya".
// Without the beats (older captures): the stretch during the lift, the nudge 3 s before it, as before.
// opts: {name: 'Maya', doc: 'Q4 report', nudge, stretch, stretchEnd, breatheEnd, reset (clips.mjs WELLNESS_BEATS)}.
(function () {
  const lift = () => clipsOf('lift')[0] || {start: 6, duration: 5, target: 43.5};
  const O = () => SHOT.clip.opts || {};
  function beats() {
    const L = lift(), o = O(), L0 = L.start, L1 = L.start + L.duration;
    if (o.stretch === undefined) return {L, L0, L1, rise: false, nudge: L0 - 3, stretch: L0, stretchEnd: L1, breatheEnd: L1, reset: L1 + .3};
    return {L, L0, L1, rise: true, nudge: o.nudge, stretch: o.stretch, stretchEnd: o.stretchEnd, breatheEnd: o.breatheEnd ?? o.stretchEnd, reset: o.reset};
  }
  // Desk Squats (Nov 20 2026, Vico's 3rd cuts; opts.squats = {at, dur, reps}: the film's squats): the app's real exercise
  // desk_squats_01 ("Desk Squats", lower body and mobility, glutes / quads / hamstrings / core), its demo clip (15.67 s, its red
  // 'incorrect form' segment 4.9-7.6 s left out) played over the stretch span, so the clip and Maya squat together.
  const SQ_GOOD = 4.9 + (15.667 - 7.6);
  const squatIdx = (t, B) => { const u = clamp((t - B.stretch) / (B.stretchEnd - B.stretch)), gt = u * SQ_GOOD; return Math.round((gt < 4.9 ? gt : gt + 2.7) * 30); };
  const squatReps = (t, sq) => Math.max(0, Math.min(sq.reps, Math.floor((t - sq.at) / (sq.dur / sq.reps) + 1e-6)));
  function demo(idx, x, y, w, h, key = 'shoulder') {
    const im = frameImg(key, idx); if (!im) return;
    clip(x, y, w, h, 30, () => {
      g.save(); g.filter = 'invert(1) hue-rotate(180deg) brightness(1.05) contrast(1.05)'; drawCover(im, x, y, w, h, {zoom: 1.12, ay: .75}); g.restore();
      g.fillStyle = rad(x + w / 2, y + h * .55, w * .6, [[0, hexA(C.teal, .12)], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h);
    });
  }
  const good = i => i < 144 ? i : i + 99;   // skip the clip's red 'incorrect form' segment
  function report(t, x, y, w, h, name, doc, standing, more = []) {
    card(x, y, w, h, {r: 34, top: '#0e1626', bot: '#0b111d'});
    T(`${doc} · ${name}`, x + 40, y + 70, 36, {w: 600, c: C.soft});
    pill(x + w - 40, y + 30, standing ? 'Standing' : 'Seated', 28, {a: 'right', dot: standing ? C.green : C.amber, bg: hexA(standing ? C.green : C.amber, .15), c: standing ? C.green : C.amber});
    fillR(x, y + 110, w, 2, 0, C.line);
    const lines = [['Q4 membership report', 64, 700, C.blue2], ['Class attendance up 12 %', 44, 500, C.text], ['Morning slots fill first;', 44, 500, C.text], ['add a 7 AM mobility class.', 44, 500, C.text]];
    let yy = y + 200, ct = .3;
    lines.forEach(([s, sz, wt, c]) => { const vis = typed(s, t, ct, 30); ct += s.length / 30 + .1; T(vis, x + 50, yy, sz, {w: wt, c}); yy += sz * 1.6; });
    // (the new order: more lines typed while she is at the keys, standing and then seated: [text, from, until])
    for (const [s, t0, t1] of more) { const vis = typed(s, Math.min(t, t1), t0, 16); if (vis) { T(vis, x + 50, yy, 44, {w: 500, c: C.text}); if (t < t1 && vis.length < s.length) caret(x + 50 + tw(vis, 44, 500), yy, 44, t); } yy += 44 * 1.6; }
    const bars = [.5, .62, .58, .74, .81, .9]; bars.forEach((v, i) => fillR(x + 50 + i * 110, y + h - 60 - 220 * v, 80, 220 * v, 12, i === 5 ? C.teal : hexA(C.blue2, .55)));
  }
  // ---- Nov 21 2026, Vico's 3rd cut (seated): the new order (opts.notice = {nudge, routine}). The desk rises with her at the
  // keys (the cut's first lift clip), she types standing, the reminder comes at `nudge` (both screens: the tablet chimes, the
  // monitor shows 'Time to move'), the Desk Squats card while she does them (stretch .. stretchEnd, the clip in step), 'Great
  // job', the desk lowers (the second lift clip) and she sits; from `routine` on the routine card is highlighted (everything
  // done) while she types again. The right column of the monitor: the desk's live height, then the routine's three steps.
  function noticeBeats() {
    const L = clipsOf('lift'), up = L[0] || {start: 6, duration: 5, target: 41}, dn = L[1] || null, B = beats(), NO = O().notice;
    return {B, up, dn, U0: up.start, U1: up.start + up.duration, D0: dn ? dn.start : 1e9, D1: dn ? dn.start + dn.duration : 1e9, N: NO.nudge, S0: B.stretch, S1: B.stretchEnd, RT: NO.routine};
  }
  function routineCard(t, x, y, w, h, nb, SQ, glow) {
    const {U1, N, S0, S1, D1, RT} = nb, lit = glow * (.75 + .25 * Math.sin((t - RT) * 3.2));
    if (glow > 0) { g.save(); g.shadowColor = hexA(C.teal, .9 * lit); g.shadowBlur = 60 * lit; fillR(x, y, w, h, 36, hexA(C.teal, .25 * glow)); g.restore(); }
    card(x, y, w, h, {r: 36, accent: C.teal, border: glow > 0 ? hexA(C.teal, .35 + .5 * lit) : undefined, bw: glow > 0 ? 4 : 2});
    T('Movement routine', x + 40, y + 70, 36, {w: 700, c: glow > 0 ? C.teal : C.soft});
    const rows = [['Stand up · 41 in', t >= U1, t < U1 && t >= nb.U0], ['Desk Squats · ' + SQ.reps + ' reps', t >= S1, t >= N && t < S1], ['Sit back · 28 in', t >= D1, t >= S1 && t < D1]];
    rows.forEach(([s, done, now], i) => {
      const yy = y + 150 + i * 82, pulse = now ? .5 + .5 * Math.sin(t * 6) : 0;
      circle(x + 62, yy - 12, 22, done ? C.green : now ? hexA(C.amber, .55 + .45 * pulse) : 'rgba(255,255,255,0.12)');
      if (done) T('✓', x + 62, yy - 1, 30, {w: 800, a: 'center', c: '#06202a'});
      T(s, x + 104, yy, 36, {w: done || now ? 600 : 500, c: done ? C.text : now ? C.amber : C.dim});
    });
    if (glow > 0) alpha(glow, () => T('Routine done · next reset in 45 min', x + 40, y + h - 40, 30, {w: 600, c: C.green}));
  }
  function noticeMain(t) {
    const nb = noticeBeats(), {B, up, dn, U0, U1, D0, D1, N, S0, S1, RT} = nb, SQ = O().squats, name = O().name || 'Maya', doc = O().doc || 'Q4 report', p = pose(t);
    backdrop(t, {top: '#071a1a', bot: '#04080c', blobs: [[C.teal, .14], [C.blue, .1]]});
    appIcon(70, 70, 64, {glow: true}); T('Move', 124, 86, 46, {w: 700});
    const moving = (t >= U0 && t < U1 + .3) || (t >= D0 && t < D1 + .3);
    const label = t < U0 ? 'Focus' : t < U1 ? 'Standing up · desk rising' : t < N ? 'Focus · standing' : t < S0 ? 'Time to move' : t < S1 ? 'Stand and reset · desk squats' : t < D0 ? 'Desk Squats complete' : t < D1 ? 'Desk lowering · back to sitting' : 'Back to work, seated';
    T(label, 280, 86, 40, {w: 600, c: C.soft});
    const focused = 52 + Math.floor(Math.min(t, N) / 2);
    pill(W - 50, 38, t < N ? `${focused} min focused` : t < D1 ? 'Break · 1 min' : 'Desk Squats ✓', 30, {a: 'right', bg: hexA(t >= D1 ? C.green : C.teal, .18), c: t >= D1 ? C.green : C.teal});
    // the break view (the squats card) from just before the first rep to a moment after the last
    const away = win(t, S0 - .3, S1 + .8, .5), rx = 1270, rw = W - rx - 50;
    alpha(1 - away, () => {
      report(t, 50, 140, rx - 80, H - 190, name, doc, t >= U1 - 1 && t < D1 - 1.5, [['Standing option for the 6 PM class.', O().notice.typeStanding ?? U1 - 1, N], ['Next: draft the Q1 class schedule.', RT, 1e9]]);
      // the desk now: its live height (rising, standing, lowering, seated)
      const k = clamp((p.height - 28) / (+up.target - 28));
      card(rx, 140, rw, 300, {r: 36, accent: C.blue});
      ring(rx + 150, 290, 100, 22, k, C.blue2, {glow: moving ? 20 : 8});
      T(`${p.height.toFixed(1)} in`, rx + 150, 305, 50, {w: 700, a: 'center'});
      T(moving ? (t < U1 + .3 ? 'rising' : 'lowering') : k > .99 ? 'standing' : 'seated', rx + 290, 300, 38, {w: 600, c: moving ? C.blue2 : C.soft});
      routineCard(t, rx, 470, rw, 560, nb, SQ, sm(seg(t, RT, RT + .6)));
    });
    alpha(away, () => {
      const vx = 50, vy = 140, vw = 1180, vh = 890;
      card(vx - 6, vy - 6, vw + 12, vh + 12, {r: 36, top: '#0b1414', bot: '#070c0e'});
      demo(squatIdx(t, B), vx, vy, vw, vh, 'squat');
      fillR(vx + 40, vy + 40, 700, 150, 50, 'rgba(4,12,14,0.8)'); T(`Desk Squats · ${SQ.reps} reps`, vx + 80, vy + 106, 48, {w: 700, c: C.teal}); T('Glutes, quads, hamstrings, core', vx + 80, vy + 156, 30, {w: 500, c: C.soft});
      const k = clamp((p.height - 28) / (+up.target - 28));
      card(rx, 140, rw, 560, {r: 36, accent: C.blue});
      ring(rx + rw / 2, 400, 170, 32, k, C.blue2, {glow: 20});
      T(`${p.height.toFixed(1)} in`, rx + rw / 2, 420, 84, {w: 700, a: 'center'});
      T(t >= D0 ? 'desk lowering' : 'standing', rx + rw / 2, 480, 34, {w: 500, a: 'center', c: C.dim});
      card(rx, 730, rw, 300, {r: 36, accent: C.coral});
      T('Reps', rx + 40, 800, 34, {w: 700, c: C.dim}); T(`${squatReps(t, SQ)} / ${SQ.reps}`, rx + 40, 920, 100, {w: 700});
    });
    // the reminder (she notices it): pops at N, gives way to the squats card
    alpha(win(t, N, S0 + .1, .4), () => {
      const k = back(seg(t, N, N + .5));
      at(W / 2, H / 2, lerp(.8, 1, k), () => {
        card(-560, -220, 1120, 440, {r: 56, top: '#173a3a', bot: '#0d1f22', border: hexA(C.teal, .7), accent: C.teal});
        T(`Time to move, ${name}`, 0, -60, 84, {w: 700, a: 'center'});
        T(`${focused} min at the desk · a 1-minute reset`, 0, 10, 40, {w: 500, a: 'center', c: C.soft});
        T(`Desk Squats · ${SQ.reps} reps`, 0, 140, 72, {w: 700, a: 'center', c: C.amber});
      });
    });
    toast(t, S1 + .05, 1.7, W - 900, 170, 840, `Great job, ${name}!`, 'Desk Squats complete · back to 28 in', {col: C.teal, icon: 'check', h: 150});
    vignette(.4);
  }
  function noticeTablet(t) {
    const nb = noticeBeats(), {B, N, S0, S1, RT} = nb, name = O().name || 'Maya', SQ = O().squats, calm = t < S0 ? 92 + 2 * Math.sin(t) : (t < S1 ? lerp(92, 112, sm(seg(t, S0, S1))) : lerp(112, 96, sm(seg(t, S1, S1 + 4)))) + 1.5 * Math.sin(t * 1.3);
    backdrop(t, {top: '#08182a', bot: '#04070d', blobs: [[C.teal, .16], [C.violet, .12]]});
    const alert = win(t, N, S0 - .1, .3), on = win(t, S0 - .3, S1 + .1, .4), after = t > S1 + .1, done = sm(seg(t, RT, RT + .6));
    alpha(1 - alert - on, () => {
      T(t < N ? 'Focus' : after && done < .5 ? `Great job, ${name}!` : t < N ? 'Focus' : 'Movement routine', 120, 330, 110, {w: 700, c: done > .5 ? C.teal : C.text});
      T(t < N ? 'Notifications quiet until your break' : done < .5 ? 'Desk Squats complete · heart rate settling' : 'Stand · Desk Squats · Sit: all done', 125, 420, 46, {w: 500, c: C.soft});
      if (done > 0) { g.save(); g.shadowColor = hexA(C.teal, .8); g.shadowBlur = 50 * done; ring(1260, 560, 200, 34, 1, C.green, {glow: 30}); g.restore(); }
      else ring(1260, 560, 200, 34, t < N ? seg(t, 0, N) : 1, t < N ? C.teal : C.green, {glow: 18});
      T(t < N ? Math.max(0, Math.ceil(N - t)) + 's' : '✓', 1260, 600, 110, {w: 700, a: 'center'});
    });
    alpha(alert, () => {   // the reminder: what she glances at
      const k = back(seg(t, N, N + .45)), ring2 = fract((t - N) * 1.4);
      at(540, 520, lerp(.7, 1, k), () => { g.save(); g.globalAlpha *= 1 - ring2; ring(0, 0, 150 + 120 * ring2, 10, 1, C.amber); g.restore(); icon('bell', 0, 0, 170, C.amber, 14); });
      T('Time to move', 860, 470, 96, {w: 700});
      T(`Desk Squats · ${SQ.reps} reps`, 865, 570, 56, {w: 600, c: C.amber});
      T('A 1-minute reset, standing', 865, 650, 42, {w: 500, c: C.soft});
    });
    alpha(on, () => {
      demo(squatIdx(t, B), 70, 90, 960, 880, 'squat');
      T('Desk Squats', 1090, 250, 100, {w: 700}); T('Glutes, quads, hamstrings, core', 1095, 320, 40, {w: 500, c: C.soft});
      pill(1095, 360, 'Lower body and mobility', 36, {bg: hexA(C.teal, .2), c: C.teal, dot: C.teal});
      T('Reps', 1095, 560, 40, {w: 700, c: C.dim}); T(squatReps(t, SQ) + ' / ' + SQ.reps, 1095, 700, 160, {w: 700});
      T('Feet shoulder-width, arms forward', 1095, 790, 38, {w: 500, c: C.soft});
    });
    at(1010, 900, 1 + .12 * Math.exp(-fract(t * calm / 60) * 6), () => icon('heart', 0, 0, 70, C.coral));
    T(Math.round(calm) + ' bpm', 1080, 925, 64, {w: 700});
    vignette(.4);
  }
  SCENES.c07l = {
    prefetch(t) { const B = beats(); return O().squats ? [['squat', squatIdx(t, B)]] : [['shoulder', good(Math.round(Math.max(0, t - B.stretch) * 30))]]; },
    draw(t) {
      if (O().notice) return noticeMain(t);
      const B = beats(), {L, L0} = B, NUDGE = B.nudge, S0 = B.stretch, S1 = B.stretchEnd, name = O().name || 'Maya', doc = O().doc || 'Q4 report', p = pose(t);
      backdrop(t, {top: '#071a1a', bot: '#04080c', blobs: [[C.teal, .14], [C.blue, .1]]});
      appIcon(70, 70, 64, {glow: true}); T('Move', 124, 86, 46, {w: 700});
      const phase = t < NUDGE ? 0 : t < L0 ? 1 : t < S0 ? 2 : t < S1 ? 3 : 4, standing = t >= L0;
      T(['Focus', 'Break in a moment', 'Standing up · desk rising', O().squats ? 'Stand and reset · desk squats' : 'Stand and reset · shoulder squeeze', 'Back to work, standing'][phase], 280, 86, 40, {w: 600, c: C.soft});
      const focused = 52 + Math.floor(Math.min(t, L0) / 2);
      pill(W - 50, 38, phase === 2 || phase === 3 ? 'Break · 5 min' : `${focused} min focused`, 30, {a: 'right', bg: hexA(C.teal, .18), c: C.teal});
      // work (until she gets up and back after the stretch)
      const away = B.rise ? win(t, L0, S1, .5) : win(t, S0, S1, .5);
      alpha(1 - away, () => report(t, 50, 140, W - 100, H - 190, name, doc, t > S1));
      // the break: the desk rising (no demo) while she stands up, then the stretch beside the height
      alpha(away, () => {
        const vx = 50, vy = 140, vw = 1180, vh = 890;
        card(vx - 6, vy - 6, vw + 12, vh + 12, {r: 36, top: '#0b1414', bot: '#070c0e'});
        const SQ = O().squats, REPS = SQ ? SQ.reps : B.rise ? 4 : 8, per = B.rise ? (S1 - S0 - .4) / REPS : .6;
        const sq = B.rise ? sm(seg(t, S0 - .25, S0 + .25)) : 1;
        alpha(1 - sq, () => {   // standing up: the desk on its way to her standing height
          icon('up', vx + vw / 2, vy + vh / 2 - 120, 160, C.blue2, 16);
          T('Stand up', vx + vw / 2, vy + vh / 2 + 60, 96, {w: 700, a: 'center'});
          T(`The desk is rising to your ${(+L.target).toFixed(1)} in`, vx + vw / 2, vy + vh / 2 + 140, 44, {w: 500, a: 'center', c: C.soft});
        });
        alpha(sq, () => {
          if (SQ) {
            demo(squatIdx(t, B), vx, vy, vw, vh, 'squat');
            fillR(vx + 40, vy + 40, 700, 150, 50, 'rgba(4,12,14,0.8)'); T(`Desk Squats · ${REPS} reps`, vx + 80, vy + 106, 48, {w: 700, c: C.teal}); T('Glutes, quads, hamstrings, core', vx + 80, vy + 156, 30, {w: 500, c: C.soft});
          } else {
            demo(good(Math.round(Math.max(0, t - S0) * 30)), vx, vy, vw, vh);
            fillR(vx + 40, vy + 40, 520, 100, 50, 'rgba(4,12,14,0.8)'); T(`Shoulder squeeze · ${REPS} reps`, vx + 80, vy + 106, 40, {w: 700, c: C.teal});
          }
        });
        const rx = 1270, rw = W - rx - 50, k = clamp((p.height - 28) / (+L.target - 28));
        card(rx, 140, rw, 560, {r: 36, accent: C.blue});
        ring(rx + rw / 2, 400, 170, 32, k, C.blue2, {glow: 20});
        T(`${p.height.toFixed(1)} in`, rx + rw / 2, 420, 84, {w: 700, a: 'center'});
        T(k > .99 ? 'standing' : 'desk rising', rx + rw / 2, 480, 34, {w: 500, a: 'center', c: C.dim});
        card(rx, 730, rw, 300, {r: 36, accent: C.coral});
        T(t < S0 ? 'Up next' : 'Reps', rx + 40, 800, 34, {w: 700, c: C.dim}); T(`${SQ ? squatReps(t, SQ) : Math.min(REPS, Math.floor(Math.max(0, t - S0 - (B.rise ? .2 : .4)) / per))} / ${REPS}`, rx + 40, 920, 100, {w: 700});
      });
      // the nudge and the countdown
      alpha(win(t, NUDGE, L0 + .1, .4), () => {
        const k = back(seg(t, NUDGE, NUDGE + .5));
        at(W / 2, H / 2, lerp(.8, 1, k), () => {
          card(-560, -220, 1120, 440, {r: 56, top: '#173a3a', bot: '#0d1f22', border: hexA(C.teal, .7), accent: C.teal});
          T(`Time to move, ${name}`, 0, -60, 84, {w: 700, a: 'center'});
          T(`${focused} min seated · a 5-minute reset`, 0, 10, 40, {w: 500, a: 'center', c: C.soft});
          T(`Standing in ${Math.max(1, Math.ceil(L0 - t))}`, 0, 140, 72, {w: 700, a: 'center', c: C.amber});
        });
      });
      if (O().squats) toast(t, S1 + .05, 1.7, W - 900, 170, 840, `Great job, ${name}!`, 'Desk Squats complete', {col: C.teal, icon: 'check', h: 150});
      toast(t, B.reset, B.rise ? 2.6 : 3.4, W - 900, 170, 840, 'Reset done · +4 min standing', 'Next break in 45 min', {col: C.green, icon: 'check', h: 150});
      vignette(.4);
    },
  };
  // The tablet during the squats: focus, then the exercise card (name, demo clip, reps) with the clip in step, then the cheer.
  function squatsTablet(t) {
    const B = beats(), L0 = B.stretch, L1 = B.stretchEnd, name = O().name || 'Maya', SQ = O().squats, calm = t < L0 ? 92 + 2 * Math.sin(t) : lerp(92, 112, sm(seg(t, L0, L1))) + 1.5 * Math.sin(t * 1.3);
    backdrop(t, {top: '#08182a', bot: '#04070d', blobs: [[C.teal, .16], [C.violet, .12]]});
    const on = win(t, L0 - .3, L1 + .1, .4), after = t > L1 + .1;
    alpha(1 - on, () => {
      T(after ? 'Great job, ' + name + '!' : 'Focus', 120, 330, 110, {w: 700});
      T(after ? 'Desk Squats complete · heart rate settling' : 'Notifications quiet until your break', 125, 420, 46, {w: 500, c: C.soft});
      ring(1260, 560, 200, 34, after ? 1 : seg(t, 0, L0), after ? C.green : C.teal, {glow: 18});
      T(after ? '✓' : Math.max(0, Math.ceil(L0 - t)) + 's', 1260, 600, 110, {w: 700, a: 'center'});
    });
    alpha(on, () => {
      demo(squatIdx(t, B), 70, 90, 960, 880, 'squat');
      T('Desk Squats', 1090, 250, 100, {w: 700}); T('Glutes, quads, hamstrings, core', 1095, 320, 40, {w: 500, c: C.soft});
      pill(1095, 360, 'Lower body and mobility', 36, {bg: hexA(C.teal, .2), c: C.teal, dot: C.teal});
      T('Reps', 1095, 560, 40, {w: 700, c: C.dim}); T(squatReps(t, SQ) + ' / ' + SQ.reps, 1095, 700, 160, {w: 700});
      T('Feet shoulder-width, arms forward', 1095, 790, 38, {w: 500, c: C.soft});
    });
    at(1010, 900, 1 + .12 * Math.exp(-fract(t * calm / 60) * 6), () => icon('heart', 0, 0, 70, C.coral));
    T(Math.round(calm) + ' bpm', 1080, 925, 64, {w: 700});
    vignette(.4);
  }
  SCENES.c07t = {
    prefetch(t) { const B = beats(); return O().squats ? [['squat', squatIdx(t, B)]] : []; },
    draw(t) {
      if (O().notice) return noticeTablet(t);
      if (O().squats) return squatsTablet(t);
      const B = beats(), L0 = B.stretch, L1 = B.breatheEnd, name = O().name || 'Maya', half = B.rise ? (L1 - L0) / 2 : 3;
      backdrop(t, {top: '#08182a', bot: '#04070d', blobs: [[C.teal, .16], [C.violet, .12]]});
      const calm = t < L0 ? 92 + 2 * Math.sin(t) : lerp(92, 74, sm(seg(t, L0, L1 + 1))) + 1.5 * Math.sin(t * 1.3);
      alpha(1 - win(t, L0 - .3, L1 + .3, .5), () => {
        const after = t > L1;
        T(after ? `Nice reset, ${name}` : 'Focus', 120, 330, 110, {w: 700});
        T(after ? 'Heart rate back to resting · 74 bpm' : 'Notifications quiet until your break', 125, 420, 46, {w: 500, c: C.soft});
        ring(1260, 560, 200, 34, after ? 1 : seg(t, 0, L0), after ? C.green : C.teal, {glow: 18});
        T(after ? '✓' : `${Math.max(0, Math.ceil(L0 - t))}s`, 1260, 600, 110, {w: 700, a: 'center'});
      });
      alpha(win(t, L0 - .3, L1 + .3, .5), () => {   // breathe with the stretch: in 3, out 3
        const c = Math.max(0, t - L0), ph = Math.floor(c / half) % 2, u = fract(c / half), sz = ph === 0 ? sm(u) : 1 - sm(u);
        const cx = 520, cy = H / 2, r = 170 + 200 * sz;
        g.fillStyle = rad(cx, cy, r * 1.6, [[0, hexA(C.teal, .35)], [1, hexA(C.teal, 0)]]); g.fillRect(0, 0, W, H);
        circle(cx, cy, r, lin(cx - r, cy - r, cx + r, cy + r, [[0, '#3fe0c0'], [1, '#1388ec']]));
        const n = Math.max(1, Math.round(half)); T(String(n - Math.floor(u * n)), cx, cy + 50, 150, {w: 700, a: 'center', c: '#06202a'});
        T(ph === 0 ? 'Breathe in' : 'Breathe out', 960, 420, 96, {w: 700});
        T(`${name} · while the desk rises`, 985, 500, 44, {w: 500, c: C.soft});
      });
      at(1010, 820, 1 + .12 * Math.exp(-fract(t * calm / 60) * 6), () => icon('heart', 0, 0, 80, C.coral));
      T(`${Math.round(calm)} bpm`, 1080, 850, 80, {w: 700});
      vignette(.4);
    },
  };
})();
