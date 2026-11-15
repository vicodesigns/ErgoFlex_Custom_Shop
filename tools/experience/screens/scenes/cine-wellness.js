// Cine cut · wellness (gym, Maya), Nov 14 2026: a break built into Maya's day (review-cut.json 'wellness', 16 s: the
// desk rises 6-11 s while she stretches 6.6-10.35 s, then she works standing). Main (Dell 16:9) and tablet (3:2):
//   0 .. NUDGE      her report, focused time ticking (she is seated, working)
//   NUDGE .. L0     "Time to move, Maya" + 3-2-1
//   L0 .. L1        the stretch she does (the shoulder-squeeze demo clip, dark mode) beside the live height ring
//   L1 ..           back to her report, standing: "Reset done · +4 min standing · next break 45 min"
// Tablet: quiet focus, the breathing coach during the stretch (in 3 / out 3), then "HR 74 · nice reset, Maya".
// opts: {name: 'Maya', doc: 'Q4 report', and the beats: nudge, stretch, stretchEnd, reset, work (clips.mjs
// WELLNESS_BEATS)}. Nov 14 (S16's stretch): she gets up as the desk rises (6.0-11.0 s, to 41 in), stands with the chair
// aside, stretches 9.0-11.6 s, back to typing by 13 s: the report shows her standing with the live height while the desk
// rises, 'Time to move' at nudge, the shoulder squeeze stretch..stretchEnd beside the height, 'Reset done' at reset,
// the report back by work. Without the beats: as before, from the lift (the nudge 3 s before it, the stretch during it).
(function () {
  const lift = () => clipsOf('lift')[0] || {start: 6, duration: 5, target: 43.5};
  const O = () => SHOT.clip.opts || {};
  function beats() {
    const L = lift(), o = O(), L0 = L.start, L1 = L.start + L.duration;
    if (o.stretch === undefined) return {L, L0, L1, rise: false, nudge: L0 - 3, stretch: L0, stretchEnd: L1, reset: L1 + .3, work: L1};
    return {L, L0, L1, rise: true, nudge: o.nudge, stretch: o.stretch, stretchEnd: o.stretchEnd, reset: o.reset, work: o.work};
  }
  function demo(idx, x, y, w, h) {
    const im = frameImg('shoulder', idx); if (!im) return;
    clip(x, y, w, h, 30, () => {
      g.save(); g.filter = 'invert(1) hue-rotate(180deg) brightness(1.05) contrast(1.05)'; drawCover(im, x, y, w, h, {zoom: 1.12, ay: .75}); g.restore();
      g.fillStyle = rad(x + w / 2, y + h * .55, w * .6, [[0, hexA(C.teal, .12)], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h);
    });
  }
  const good = i => i < 144 ? i : i + 99;   // skip the clip's red 'incorrect form' segment
  function report(t, x, y, w, h, name, doc, standing) {
    card(x, y, w, h, {r: 34, top: '#0e1626', bot: '#0b111d'});
    T(`${doc} · ${name}`, x + 40, y + 70, 36, {w: 600, c: C.soft});
    pill(x + w - 40, y + 30, standing ? 'Standing' : 'Seated', 28, {a: 'right', dot: standing ? C.green : C.amber, bg: hexA(standing ? C.green : C.amber, .15), c: standing ? C.green : C.amber});
    fillR(x, y + 110, w, 2, 0, C.line);
    const lines = [['Q4 membership report', 64, 700, C.blue2], ['Class attendance up 12 %', 44, 500, C.text], ['Morning slots fill first;', 44, 500, C.text], ['add a 7 AM mobility class.', 44, 500, C.text]];
    let yy = y + 200, ct = .3;
    lines.forEach(([s, sz, wt, c]) => { const vis = typed(s, t, ct, 30); ct += s.length / 30 + .1; T(vis, x + 50, yy, sz, {w: wt, c}); yy += sz * 1.6; });
    const bars = [.5, .62, .58, .74, .81, .9]; bars.forEach((v, i) => fillR(x + 50 + i * 110, y + h - 60 - 220 * v, 80, 220 * v, 12, i === 5 ? C.teal : hexA(C.blue2, .55)));
  }
  SCENES.c07l = {
    prefetch(t) { const B = beats(); return [['shoulder', good(Math.round(Math.max(0, t - B.stretch) * 30))]]; },
    draw(t) {
      const B = beats(), {L, L0} = B, NUDGE = B.nudge, S0 = B.stretch, S1 = B.stretchEnd, name = O().name || 'Maya', doc = O().doc || 'Q4 report', p = pose(t);
      backdrop(t, {top: '#071a1a', bot: '#04080c', blobs: [[C.teal, .14], [C.blue, .1]]});
      appIcon(70, 70, 64, {glow: true}); T('Move', 124, 86, 46, {w: 700});
      const phase = t < Math.min(NUDGE, L0) ? 0 : t < S0 ? 1 : t < S1 ? 2 : 3, standing = B.rise ? t >= L0 : t > S1;
      const head = phase === 0 ? 'Focus' : phase === 1 ? (B.rise ? (t < NUDGE ? 'Standing up · desk rising' : 'Time to move') : 'Break in a moment') : phase === 2 ? 'Stand and reset · shoulder squeeze' : 'Back to work, standing';
      T(head, 280, 86, 40, {w: 600, c: C.soft});
      const focused = 52 + Math.floor(Math.min(t, L0) / 2);
      pill(W - 50, 38, phase === 2 ? 'Break · 5 min' : `${focused} min focused`, 30, {a: 'right', bg: hexA(C.teal, .18), c: C.teal});
      // work (until the stretch and back after it), standing with the live height once she is up
      alpha(1 - win(t, S0, S1, .5), () => {
        report(t, 50, 140, W - 100, H - 190, name, doc, standing);
        if (B.rise && standing) pill(W - 330, 170, `${p.height.toFixed(1)} in`, 28, {a: 'right', dot: C.blue2, bg: hexA(C.blue, .18), c: C.blue2});
      });
      // the stretch
      alpha(win(t, S0, S1, .5), () => {
        const vx = 50, vy = 140, vw = 1180, vh = 890;
        card(vx - 6, vy - 6, vw + 12, vh + 12, {r: 36, top: '#0b1414', bot: '#070c0e'});
        const REPS = B.rise ? 4 : 8, per = B.rise ? (S1 - S0 - .4) / REPS : .6;
        demo(good(Math.round(Math.max(0, t - S0) * 30)), vx, vy, vw, vh);
        fillR(vx + 40, vy + 40, 520, 100, 50, 'rgba(4,12,14,0.8)'); T(`Shoulder squeeze · ${REPS} reps`, vx + 80, vy + 106, 40, {w: 700, c: C.teal});
        const rx = 1270, rw = W - rx - 50, k = clamp((p.height - 28) / (+L.target - 28));
        card(rx, 140, rw, 560, {r: 36, accent: C.blue});
        ring(rx + rw / 2, 400, 170, 32, k, C.blue2, {glow: 20});
        T(`${p.height.toFixed(1)} in`, rx + rw / 2, 420, 84, {w: 700, a: 'center'});
        T(k > .99 ? 'standing' : 'desk rising', rx + rw / 2, 480, 34, {w: 500, a: 'center', c: C.dim});
        card(rx, 730, rw, 300, {r: 36, accent: C.coral});
        T('Reps', rx + 40, 800, 34, {w: 700, c: C.dim}); T(`${Math.min(REPS, Math.floor(Math.max(0, t - S0 - (B.rise ? .2 : .4)) / per))} / ${REPS}`, rx + 40, 920, 100, {w: 700});
      });
      // the nudge and the countdown
      alpha(win(t, NUDGE, S0 + .1, B.rise ? .25 : .4), () => {
        const k = back(seg(t, NUDGE, NUDGE + .5));
        at(W / 2, H / 2, lerp(.8, 1, k), () => {
          card(-560, -220, 1120, 440, {r: 56, top: '#173a3a', bot: '#0d1f22', border: hexA(C.teal, .7), accent: C.teal});
          T(`Time to move, ${name}`, 0, -60, 84, {w: 700, a: 'center'});
          T(B.rise ? 'Shoulder squeeze · arms up, hands behind your head' : `${focused} min seated · a 5-minute reset`, 0, 10, 40, {w: 500, a: 'center', c: C.soft});
          T(B.rise ? 'Stretch with me' : `Standing in ${Math.max(1, Math.ceil(L0 - t))}`, 0, 140, 72, {w: 700, a: 'center', c: C.amber});
        });
      });
      toast(t, B.reset, B.rise ? B.work - B.reset + .6 : 3.4, W - 900, 170, 840, 'Reset done · +4 min standing', 'Next break in 45 min', {col: C.green, icon: 'check', h: 150});
      vignette(.4);
    },
  };
  SCENES.c07t = {
    draw(t) {
      const B = beats(), L0 = B.stretch, L1 = B.stretchEnd, name = O().name || 'Maya', half = B.rise ? (L1 - L0) / 2 : 3;
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
