// Cine cut · oilers (high school, Kai at the featured desk), Nov 14 2026. Vico likes the quiz; the cine cut's chapter
// (review-cut.json 'oilers', 14 s) brings the desk down to Kai's wheelchair height (the lift clip, 8-11 s), so the quiz
// is his moment: he answers on his pad, the portrait shows the desk coming down to him, and the reveal lands once it
// is at his height: "Mercury ✓ · Kai +100", his chip lit in the class.
//   c06p  portrait (1080x1856): live quiz (votes 1.5-7.5) -> "Lowering to Kai's height" (the lift) -> reveal -> class
//   c06k  laptop (1280x776): Kai's answer pad, A tapped at TAP, "+100" at the reveal
// opts: {name: 'Kai', dock, tap, reveal, dash (clips.mjs OILERS_BEATS), class: ['Fern', 'Noah', …]}. Nov 14 (S9's 15 s
// chapter): the class answers while the desk comes down for Kai (the lift clip, 8.5-11.5 s); once docked he taps A
// (tap), the reveal at `reveal` (31.0 in stays on screen above it), the class dashboard at `dash`. Without the opts:
// the reveal at the lift's end, as before. The curved orbit lesson is ch06l (opts.teacher).
(function () {
  const ANS = [['A', 'Mercury', C.coral], ['B', 'Earth', C.blue2], ['C', 'Mars', C.amber], ['D', 'Jupiter', C.green]];
  const votes = t => { const k = eo(seg(t, 1.5, 7.5)); return [19 * k, 4 * k, 3 * k, 2 * k].map((v, i) => Math.floor(v + .4 * noise(t * 3 + i) * k)); };
  const lift = () => clipsOf('lift')[0] || {start: 8, duration: 3, target: 31};
  const beats = () => { const L = lift(), o = SHOT.clip.opts || {}, R = o.reveal ?? L.start + L.duration;
    return {L, REVEAL: R, DOCK: o.dock ?? L.start + L.duration, DASH: o.dash ?? R + 1.6, name: o.name || 'Kai', tap: o.tap ?? 5.0, cls: o.class || ['Fern', 'Noah', 'Zoe', 'Mia', 'Leo', 'Eli', 'Sofia']}; };
  SCENES.c06p = {
    draw(t) {
      const {L, REVEAL, DASH, name, cls, tap} = beats(), p = pose(t);
      backdrop(t, {top: '#0b1430', bot: '#050812', blobs: [[C.blue, .18]]});
      const quiz = 1 - sm(seg(t, DASH, DASH + .6)), reveal = t >= REVEAL;
      alpha(quiz, () => {
        pill(60, 80, 'LIVE QUIZ · PERIOD 2', 40, {bg: hexA(C.coral, .2), c: C.coral, dot: C.coral});
        T('Which planet', 60, 320, 100, {w: 700}); T('orbits fastest?', 60, 430, 100, {w: 700});
        const V = votes(t); if (t >= tap) V[0] += 1;   // his answer joins the class's
        const tot = Math.max(1, V.reduce((a, b) => a + b, 0));
        ANS.forEach(([k, n, c], i) => {
          const y = 560 + i * 250, frac = V[i] / 28, right = i === 0;
          fillR(60, y, W - 120, 210, 40, 'rgba(255,255,255,0.06)');
          fillR(60, y, (W - 120) * frac, 210, 40, hexA(c, reveal && !right ? .25 : .55));
          if (reveal && right) strokeR(60, y, W - 120, 210, 40, C.green, 10);
          T(k, 120, y + 140, 100, {w: 700, c}); T(n, 230, y + 135, 80, {w: 700});
          T(String(V[i]), W - 110, y + 135, 80, {w: 700, a: 'right', c: C.soft});
        });
        alpha(1 - sm(seg(t, REVEAL - .2, REVEAL + .2)), () => T(`${Math.min(30, tot)} of 30 answered` + (t < tap ? ` · waiting for ${name}` : ` · ${name} answered`), 60, 1640, 52, {w: 600, c: C.soft}));
        // the desk comes down to him: the overlay over the answers while it moves, kept up through the reveal so his
        // 31.0 in stays readable
        alpha(sm(seg(t, L.start - .2, L.start + .2)), () => {
          card(40, 1080, W - 80, 420, {r: 44, top: '#14304a', bot: '#0c1c2e', border: hexA(C.blue2, .6), accent: C.blue});
          icon('down', 140, 1210, 90, C.blue2, 11);
          T(`Lowering to ${name}'s height`, 220, 1200, 56, {w: 700});
          T(`${p.height.toFixed(1)} in`, 220, 1350, 130, {w: 700, c: C.blue2});
          T(`his preset · ${(+L.target).toFixed(0)} in · wheelchair`, W - 90, 1478, 34, {w: 500, a: 'right', c: C.soft});
          bar(90, 1420, W - 180, 26, clamp((43.5 - p.height) / (43.5 - +L.target)), lin(90, 0, W - 90, 0, [[0, C.blue], [1, C.teal]]));
        });
        alpha(sm(seg(t, REVEAL, REVEAL + .4)), () => {
          const k = back(seg(t, REVEAL, REVEAL + .5));
          at(W / 2, 1680, lerp(.7, 1, k), () => {
            card(-500, -150, 1000, 300, {r: 50, top: '#173a2f', bot: '#0d1f1c', border: hexA(C.green, .7), accent: C.green});
            circle(-360, 0, 80, C.green); icon('check', -360, 0, 110, '#06231a', 14);
            T('Mercury ✓', -240, -20, 76, {w: 700}); T(`${name} +100`, -240, 66, 60, {w: 700, c: C.green});
          });
        });
      });
      alpha(sm(seg(t, DASH, DASH + .6)), () => {
        T('Class', 60, 220, 120, {w: 700}); T('dashboard', 60, 350, 120, {w: 700});
        ring(W / 2, 760, 280, 66, .68 * eo(seg(t, DASH, DASH + 1.2)), C.green, {glow: 30});
        T('68%', W / 2, 800, 150, {w: 700, a: 'center'}); T('got it right', W / 2, 880, 50, {w: 500, a: 'center', c: C.soft});
        [name, ...cls].forEach((n, i) => {
          const x = 60 + (i % 2) * 490, y = 1130 + Math.floor(i / 2) * 140, me = i === 0, ok = me || i % 3 !== 2;
          fillR(x, y, 470, 112, 56, me ? hexA(C.green, .3) : 'rgba(255,255,255,0.06)');
          if (me) strokeR(x, y, 470, 112, 56, C.green, 5);
          circle(x + 56, y + 56, 30, ok ? C.green : C.amber);
          T(n, x + 110, y + 72, 46, {w: me ? 700 : 500, c: me ? C.text : C.soft});
          if (me) T('+100', x + 450, y + 72, 40, {w: 700, a: 'right', c: C.green});
        });
        T(`+ ${29 - cls.length} more`, 60 + 490 + 110, 1130 + Math.floor(cls.length / 2) * 140 + 72, 44, {w: 500, c: C.dim});
      });
    },
  };
  SCENES.c06k = {
    draw(t) {
      const {L, REVEAL, DOCK, name, tap} = beats(), ready = t >= DOCK;
      g.fillStyle = '#070b18'; g.fillRect(0, 0, W, H);
      T(`${name} · Period 2 · Physics`, 40, 64, 40, {w: 700}); T('Lesson 4 · Orbits', W - 40, 64, 34, {w: 500, a: 'right', c: C.dim});
      const press = t > tap && t < tap + .3, picked = t > tap, wake = sm(seg(t, DOCK - .3, DOCK + .2));
      ANS.forEach(([k, n, c], i) => {
        const x = 40 + (i % 2) * (W / 2 - 20), y = 110 + Math.floor(i / 2) * 470, w = W / 2 - 60, h = 430;
        alpha((picked && i !== 0 ? .3 : 1) * (.35 + .65 * wake), () => at(x + w / 2, y + h / 2, i === 0 && press ? .95 : 1, () => {
          fillR(-w / 2, -h / 2, w, h, 50, c); T(k, 0, 40, 220, {w: 700, a: 'center', c: '#fff'}); T(n, 0, 150, 56, {w: 600, a: 'center', c: 'rgba(255,255,255,.85)'});
        }));
      });
      // before he has docked: the pad asleep, then the desk coming down to him
      alpha(1 - wake, () => { fillR(W / 2 - 430, H / 2 - 70, 860, 140, 70, 'rgba(0,0,0,.72)'); T(t >= L.start ? `Desk coming down to you · ${pose(t).height.toFixed(1)} in` : 'Roll in to answer', W / 2, H / 2 + 16, 44, {w: 700, a: 'center'}); });
      alpha(win(t, tap + .1, REVEAL, .2), () => { fillR(W / 2 - 330, H - 120, 660, 84, 42, 'rgba(0,0,0,.7)'); T('Answer sent · waiting for the reveal', W / 2, H - 64, 34, {w: 600, a: 'center', c: C.soft}); });
      alpha(sm(seg(t, REVEAL, REVEAL + .4)), () => {
        g.fillStyle = 'rgba(8,40,26,0.95)'; g.fillRect(0, 0, W, H);
        circle(W / 2, 380, 170, C.green); icon('check', W / 2, 380, 240, '#062a18', 34);
        T('+100', W / 2, 780, 190, {w: 700, a: 'center'}); T(`Nice one, ${name}`, W / 2, 900, 60, {w: 600, a: 'center', c: C.green});
      });
    },
  };
})();
