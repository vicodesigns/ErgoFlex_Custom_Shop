// The app's Overhead Triceps Stretch (exercise_id overhead_triceps_stretch_01, "Overhead Triceps Stretch",
// stretching, beginner, triceps + shoulders; demo clip overhead_triceps_stretch_01_demo.mp4, 9.75 s) on the film's screens
// (Vico's 3rd cut, Nov 20 2026). One set of beats, the same for the portrait monitor and the phone:
//   opts.stretch = {start, rightEnd, leftEnd, good, goodEnd, seated}  chapter seconds
//   start .. rightEnd   right arm (about 1.5 s, quick)          leftEnd = end of the left arm (about 3 s), no pause between
//   good .. goodEnd     the congratulations ("Great job" + "Time to sit" when she is still standing, seated = false)
// The demo clip plays on the two arms' clock: its first 3.25 s (the right arm: raise, bend, hand behind the head) over the
// right-arm span, the rest (the left arm: the same on the other side) over the left-arm span, so the clip and the person agree.
(function () {
  const CUT_AT = 3.25;   // seconds into the demo clip where the second arm starts
  window.stretchClipTime = (t, B) => t <= B.rightEnd ? CUT_AT * Math.max(0, t - B.start) / (B.rightEnd - B.start) : CUT_AT + (9.75 - CUT_AT) * Math.min(1, (t - B.rightEnd) / (B.leftEnd - B.rightEnd));
  window.stretchFrame = (t, B) => Math.round(window.stretchClipTime(Math.min(Math.max(t, B.start), B.leftEnd), B) * 30);
  window.stretchPrefetch = (t, B) => t >= B.start - .6 && t <= B.leftEnd + .2 ? [['tricep', window.stretchFrame(t, B)], ['tricep', window.stretchFrame(t + .05, B)]] : [];
  window.stretchOn = (t, B) => B ? win(t, B.start - .6, B.goodEnd, .35) : 0;
  function demo(t, B, x, y, w, h) {
    const im = frameImg('tricep', window.stretchFrame(t, B)); if (!im) return;
    clip(x, y, w, h, 30, () => {
      g.save(); g.filter = 'invert(1) hue-rotate(180deg) brightness(1.05) contrast(1.05)'; drawCover(im, x, y, w, h, {zoom: 1.0, ay: .5}); g.restore();
      g.fillStyle = rad(x + w / 2, y + h * .55, w * .6, [[0, hexA(C.teal, .12)], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h);
    });
  }
  // The portrait monitor's card: x, y, w, h = the area it takes over.
  window.stretchCard = (t, x, y, w, h, B) => {
    const a = window.stretchOn(t, B); if (a < .01) return;
    alpha(a, () => {
      card(x, y, w, h, {r: 40, top: '#0e1a1d', bot: '#0a1114', accent: C.teal});
      const inEx = t < B.good - .1;
      alpha(inEx ? 1 : 1 - sm(seg(t, B.good - .1, B.good + .2)), () => {
        T('Overhead Triceps Stretch', x + 50, y + 80, 52, {w: 700});
        T('Triceps, shoulders · stretching · beginner', x + 50, y + 130, 30, {w: 500, c: C.dim});
        const dh = Math.min(h - 360, 600); demo(t, B, x + 40, y + 160, w - 80, dh);
        const right = t < B.rightEnd, k = right ? seg(t, B.start, B.rightEnd) : seg(t, B.rightEnd, B.leftEnd), by = y + 160 + dh + 40;
        pill(x + 50, by - 6, right ? 'Right arm' : 'Left arm', 40, {bg: hexA(C.teal, .2), c: C.teal, dot: C.teal});
        bar(x + 400, by + 14, w - 450, 26, k, lin(x + 400, 0, x + w - 50, 0, [[0, C.teal], [1, C.blue]]));
        T(t < B.start ? 'Get ready' : right ? 'Raise, bend, hand behind the head' : 'Now the other side', x + 50, by + 90, 34, {w: 500, c: C.soft});
      });
      const ga = sm(seg(t, B.good, B.good + .4));
      alpha(ga, () => {
        const k = back(seg(t, B.good, B.good + .6));
        at(x + w / 2, y + h * .42, lerp(.8, 1, k), () => {
          circle(0, -150, 110, hexA(C.green, .2)); circle(0, -150, 80, C.green);
          icon('check', 0, -150, 110, '#06231a', 14);
          T('Great job!', 0, 20, 84, {w: 700, a: 'center'});
          T(B.seated ? 'Overhead triceps stretch done' : 'Overhead triceps stretch done', 0, 100, 40, {w: 500, a: 'center', c: C.green});
          T(B.seated ? 'Back to work · sitting' : 'Time to sit', 0, 170, 40, {w: 600, a: 'center', c: C.soft});
        });
        confetti(t, B.good + .05, x + w / 2, y + h * .12, 36, 300);
      });
    });
  };
  // The phone's push notification (top of the lock glass): the exercise name, a thumbnail of the demo, then the cheer.
  window.stretchPush = (t, B, d) => {
    const a = window.stretchOn(t, B); if (a < .01) return;
    alpha(a, () => {
      const x = d.x + 30, w = d.w - 60, y = d.y + 150, h = 640;
      fillR(x, y, w, h, 56, 'rgba(14,26,29,0.93)'); strokeR(x + 1, y + 1, w - 2, h - 2, 56, hexA(C.teal, .5), 2);
      appIcon(x + 84, y + 84, 80);
      T('ERGOFLEX · MOVE', x + 150, y + 70, 32, {w: 600, c: C.soft, ls: 3});
      T(t < B.good - .1 ? 'Overhead Triceps Stretch' : 'Great job!', x + 150, y + 124, 46, {w: 700, c: C.text});
      if (t < B.good - .1) {
        demo(t, B, x + 30, y + 170, w - 60, 330);
        T(t < B.rightEnd ? 'Right arm' : 'Left arm', x + 40, y + 570, 44, {w: 700, c: C.teal});
        T('Triceps, shoulders', x + w - 40, y + 570, 34, {w: 500, a: 'right', c: C.dim});
      } else {
        icon('check', x + w / 2, y + 330, 150, C.green, 14);
        T(B.seated ? 'Back to work' : 'Time to sit', x + w / 2, y + 570, 50, {w: 600, a: 'center', c: C.soft});
      }
    });
  };
})();
