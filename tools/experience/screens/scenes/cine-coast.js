// Cine cut · coast (OCC media lab), Nov 14 2026: "your own edit suite inside a shared media lab". The featured suite's
// flat monitor (review-cut.json 'coast', 14.5 s; the camera cuts past Maya's bay to the free suite at 2.0 s):
//   0 .. SIGN       "Suite 3 · free · tap your card"
//   SIGN ..         <name> signed in: her project opens (COAST, review playback)
//   lift            "Raising to your standing height" with the live height (the chapter's lift clip, 4.4-7.4 s)
//   tilt ..         "Board tilted · colour mode": the grade (the tilt clip, 9.65-11.25 s)
//   tilt end ..     the export finishes: "COAST_final_4K.mp4 · 100 % · sent to Portfolio Review" (the wall reel's
//                   first title credits her: ch05w opts.credit)
// opts: {name (the suite's person, from S4's decision), sign: 2.4, suite: 'Suite 3'}.
(function () {
  const EDIT = [[0, 2.6, 0, 'ocean sunset'], [2.6, 5.0, 1, 'ridge dusk'], [5.0, 7.6, 3, 'interview A'], [7.6, 9.8, 2, 'city night'], [9.8, 12.6, 4, 'road trip'], [12.6, 99, 5, 'aurora']];
  const at_ = s => EDIT.find(e => s >= e[0] && s < e[1]);
  SCENES.c05m = {
    draw(t) {
      const o = SHOT.clip.opts || {}, name = o.name || 'Student', SIGN = o.sign ?? 2.4, suite = o.suite || 'Suite 3', p = pose(t);
      const L = clipsOf('lift')[0] || {start: 4.4, duration: 3, target: 38}, TL = clipsOf('tilt')[0] || {start: 9.65, duration: 1.6, target: 5};
      const L1 = L.start + L.duration, T0 = TL.start, T1 = TL.start + TL.duration, EXP = T1 + .2;
      g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
      // ---- free / sign-in
      const signed = sm(seg(t, SIGN, SIGN + .5));
      alpha(1 - signed, () => {
        backdrop(t, {top: '#101a30', bot: '#05070c', blobs: [[C.coral, .14], [C.blue, .14]]});
        T('OCC MEDIA ARTS', W / 2, 360, 44, {w: 600, a: 'center', c: C.coral, ls: 10});
        T(`${suite} · free`, W / 2, 520, 140, {w: 700, a: 'center'});
        T('Tap your student card to sign in', W / 2, 610, 50, {w: 500, a: 'center', c: C.soft});
        ringStroke(W / 2, 800, 80 + 10 * Math.sin(t * 3), hexA(C.blue2, .6), 6); icon('user', W / 2, 800, 70, C.blue2, 7);
      });
      // ---- her project
      alpha(signed, () => {
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, 90);
        fillR(30, 22, 46, 46, 12, C.coral); icon('play', 53, 45, 28, '#fff');
        T('Reel Studio', 96, 60, 36, {w: 700}); T(`COAST · ${name}`, 330, 60, 34, {w: 500, c: C.dim});
        pill(W - 30, 20, `${suite} · ${name}`, 30, {a: 'right', dot: C.green, bg: hexA(C.green, .14), c: C.green});
        const grade = sm(seg(t, T0, T0 + .6)), s = t + 60 - 60;   // playback time = chapter time
        const vx = 30, vy = 120, vw = W - 60, vh = H - 380, sh = at_(s % 14);
        clip(vx, vy, vw, vh, 26, () => {
          footage(sh[2], vx, vy, vw, vh, s, {zoom: 1.02 + (s - sh[0]) * .03});
          if (grade > 0) { g.fillStyle = `rgba(20,60,80,${.28 * grade})`; g.fillRect(vx, vy, vw * (.5 + .3 * Math.sin(t)), vh); fillR(vx + vw * (.5 + .3 * Math.sin(t)) - 3, vy, 6, vh, 3, `rgba(255,255,255,${grade})`); }
        });
        pill(vx + 40, vy + 36, grade > .5 ? 'COLOUR' : 'REVIEW', 40, {bg: hexA(grade > .5 ? C.amber : C.coral, .9), c: '#fff', wt: 700});
        T(sh[3], vx + 40, vy + vh - 50, 72, {w: 700, glow: 'rgba(0,0,0,.6)'});
        // timeline
        const ty = H - 230, tx = 40, tW = W - 80, len = 14;
        EDIT.forEach(([a, b, k], i) => fillR(tx + tW * a / len + 3, ty, tW * (Math.min(b, len) - a) / len - 6, 64, 14, hexA([C.blue, C.violet, C.coral, C.teal, C.amber, C.green][i], .7)));
        waveform(tx, ty + 80, tW, 60, 3, hexA(C.green, .8), {step: 10});
        fillR(tx + tW * (s % len) / len - 5, ty - 20, 10, 180, 5, '#fff');
        // the lift: her height
        alpha(win(t, L.start - .2, L1 + .6, .4), () => {
          card(W - 760, vy + 30, 700, 230, {r: 36, top: '#14304a', bot: '#0c1c2e', border: hexA(C.blue2, .6)});
          icon('up', W - 690, vy + 145, 70, C.blue2, 9);
          T('Raising to your standing height', W - 630, vy + 105, 36, {w: 600, c: C.soft});
          T(`${p.height.toFixed(1)} in`, W - 630, vy + 205, 96, {w: 700, c: p.height >= +L.target - .05 ? C.teal : C.text});
        });
        // the tilt: colour mode
        toast(t, T0, T1 - T0 + 1.4, W - 820, vy + 30, 760, `Board tilted ${Math.round(+TL.target)}° · colour mode`, 'Grade · Teal & Amber', {col: C.amber, icon: 'tilt', h: 150});
        // the export
        alpha(sm(seg(t, EXP, EXP + .4)), () => {
          const pr = clamp(.6 + .4 * eo(seg(t, EXP, EXP + 1.6))), done = pr >= 1;
          card(W / 2 - 620, vy + vh / 2 - 170, 1240, 340, {r: 44, top: done ? '#173a2f' : '#14203a', bot: done ? '#0d1f1c' : '#0c1424', border: hexA(done ? C.green : C.blue2, .7), accent: done ? C.green : C.blue});
          T(done ? 'Sent to Portfolio Review' : 'Exporting', W / 2 - 560, vy + vh / 2 - 70, 64, {w: 700});
          T('COAST_final_4K.mp4', W / 2 - 560, vy + vh / 2 - 10, 40, {w: 500, c: C.soft});
          T(`${Math.round(pr * 100)}%`, W / 2 + 560, vy + vh / 2 - 70, 80, {w: 700, a: 'right', c: done ? C.green : C.blue2});
          bar(W / 2 - 560, vy + vh / 2 + 60, 1120, 30, pr, lin(0, 0, W, 0, [[0, C.teal], [1, C.green]]));
          if (done) T(`a short film by ${name} · on the screening wall`, W / 2 - 560, vy + vh / 2 + 140, 36, {w: 500, c: C.green});
        });
      });
    },
  };
})();
