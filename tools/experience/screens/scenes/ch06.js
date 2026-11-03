// Chapter 6 · oilers (high-school classroom). No desk motion; 11 s (+1).
// Curved: orbit simulation lesson. Portrait: live quiz -> class dashboard. Laptop: answer pad.
(function () {
  const ANS = [['A', 'Mercury', C.coral], ['B', 'Earth', C.blue2], ['C', 'Mars', C.amber], ['D', 'Jupiter', C.green]];
  const votes = t => { const k = eo(seg(t, 1.5, 7)); return [19 * k, 4 * k, 3 * k, 2 * k].map((v, i) => Math.floor(v + .4 * noise(t * 3 + i) * k)); };
  SCENES.ch06l = {
    draw(t) {
      backdrop(t, {top: '#060b1c', bot: '#03050c', blobs: [[C.violet, .12], [C.blue, .12]]});
      const cx = W * .3, cy = H / 2 + 40, SC = 1.3;
      // stars
      for (let i = 0; i < 90; i++) circle(W * hash(i), H * hash(i + 90), 1.5 + 2 * hash(i + 7), `rgba(255,255,255,${.25 + .4 * noise(t + i)})`);
      // sun
      g.fillStyle = rad(cx, cy, 260, [[0, 'rgba(255,190,80,.55)'], [1, 'rgba(255,190,80,0)']]); g.fillRect(0, 0, W, H);
      circle(cx, cy, 90 + 3 * Math.sin(t * 3), lin(cx - 70, cy - 70, cx + 70, cy + 70, [[0, '#ffe08a'], [1, '#ff9a3d']]));
      // planets on Kepler-ish orbits (angular speed ~ r^-1.5)
      const P = [[150, C.coral, 16], [250, C.blue2, 24], [350, C.amber, 20], [470, C.green, 34]].map(([r, c, s]) => [r * SC, c, s * SC]);
      P.forEach(([r, c, s], i) => {
        const ry = r * .62; g.save(); g.beginPath(); g.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2); g.strokeStyle = hexA(c, .3); g.lineWidth = 3; g.stroke(); g.restore();
        const w = 2.6 * Math.pow(150 * SC / r, 1.5), a = t * w + i * 1.7;
        for (let k = 18; k > 0; k--) { const aa = a - k * .03 * w * 2; circle(cx + Math.cos(aa) * r, cy + Math.sin(aa) * ry, s * .5 * (1 - k / 18), hexA(c, .5 * (1 - k / 18))); }
        circle(cx + Math.cos(a) * r, cy + Math.sin(a) * ry, s, c);
        if (i === 1) { const ax = cx + Math.cos(a) * r, ay = cy + Math.sin(a) * ry; poly([[ax, ay], [ax - Math.sin(a) * 90, ay + Math.cos(a) * 56]], '#fff', 5); polyFill([[ax - Math.sin(a) * 104, ay + Math.cos(a) * 65], [ax - Math.sin(a) * 84 + Math.cos(a) * 10, ay + Math.cos(a) * 52 + Math.sin(a) * 10], [ax - Math.sin(a) * 84 - Math.cos(a) * 10, ay + Math.cos(a) * 52 - Math.sin(a) * 10]], '#fff'); }
      });
      // header
      T('Lesson 4 · Orbits', 60, 110, 84, {w: 700});
      pill(60, 140, 'Live simulation', 32, {dot: C.green, bg: hexA(C.green, .15), c: C.green});
      // control panel
      const px = W * .64, pw = W - px - 50;
      card(px, 60, pw, H - 120, {r: 44, accent: C.violet});
      const mass = .35 + .4 * sm(seg(t, 2, 4.5)) - .2 * sm(seg(t, 7, 9));
      [['Sun mass', mass, C.amber], ['Speed', .5 + .2 * Math.sin(t * .6), C.blue2], ['Zoom', .62, C.violet]].forEach(([l, v, c], i) => {
        const y = 200 + i * 190;
        T(l, px + 50, y, 50, {w: 600});
        T(`${(v * 2).toFixed(2)}×`, px + pw - 50, y, 50, {w: 700, a: 'right', c});
        bar(px + 50, y + 44, pw - 100, 22, v, c); circle(px + 50 + (pw - 100) * v, y + 55, 26, '#fff');
      });
      const per = 365 / Math.sqrt(mass * 2 / .7);
      T('Earth year', px + 50, 820, 44, {w: 500, c: C.dim});
      T(`${Math.round(per)} days`, px + 50, 920, 96, {w: 700});
      // teacher cursor dragging the mass slider
      const sy = 255, sx = px + 50 + (pw - 100) * mass;
      const [wx, wy] = wander(t, 3, 900, 300, 500, 400, .3);
      const drag = Math.max(win(t, 2, 4.5, .4), win(t, 7, 9, .4));
      cursor(lerp(wx, sx, drag), lerp(wy, sy, drag), 1.6, '#ffffff');
      toast(t, 8.4, 2.6, 60, 830, 900, 'Kepler: equal areas', 'closer planets move faster', {col: C.amber, icon: 'atom', h: 160, ts: 52, ss: 34});
      vignette(.4);
    },
  };
  SCENES.ch06p = {
    draw(t) {
      backdrop(t, {top: '#0b1430', bot: '#050812', blobs: [[C.blue, .18]]});
      const quiz = 1 - sm(seg(t, 8, 8.6));
      alpha(quiz, () => {
        pill(60, 80, 'LIVE QUIZ', 40, {bg: hexA(C.coral, .2), c: C.coral, dot: C.coral});
        T('Which planet', 60, 320, 100, {w: 700}); T('orbits fastest?', 60, 430, 100, {w: 700});
        const V = votes(t), tot = Math.max(1, V.reduce((a, b) => a + b, 0)), reveal = t > 6.6;
        ANS.forEach(([k, n, c], i) => {
          const y = 560 + i * 250, frac = V[i] / 28, right = i === 0;
          fillR(60, y, W - 120, 210, 40, 'rgba(255,255,255,0.06)');
          fillR(60, y, (W - 120) * Math.max(.0, frac), 210, 40, hexA(c, reveal && !right ? .25 : .55));
          if (reveal && right) strokeR(60, y, W - 120, 210, 40, C.green, 10);
          T(k, 120, y + 140, 100, {w: 700, c});
          T(n, 230, y + 135, 80, {w: 700});
          T(String(V[i]), W - 110, y + 135, 80, {w: 700, a: 'right', c: C.soft});
        });
        T(`${tot} of 30 answered`, 60, 1640, 60, {w: 600, c: C.soft});
      });
      alpha(sm(seg(t, 8.2, 8.8)), () => {
        T('Class', 60, 220, 120, {w: 700}); T('dashboard', 60, 350, 120, {w: 700});
        ring(W / 2, 800, 300, 70, .68 * eo(seg(t, 8.4, 9.6)), C.green, {glow: 30});
        T('68%', W / 2, 840, 160, {w: 700, a: 'center'});
        T('got it right', W / 2, 920, 50, {w: 500, a: 'center', c: C.soft});
        for (let i = 0; i < 30; i++) { const x = 120 + (i % 6) * 168, y = 1250 + Math.floor(i / 6) * 120; circle(x, y, 44, i < 19 ? C.green : i < 26 ? C.amber : 'rgba(255,255,255,0.15)'); }
      });
    },
  };
  SCENES.ch06k = {
    draw(t) {
      g.fillStyle = '#070b18'; g.fillRect(0, 0, W, H);
      const press = t > 3 && t < 3.3, picked = t > 3, right = t > 6.6;
      ANS.forEach(([k, n, c], i) => {
        const x = 40 + (i % 2) * (W / 2 - 20), y = 40 + Math.floor(i / 2) * 520, w = W / 2 - 60, h = 480;
        const dim = picked && i !== 0 ? .3 : 1;
        alpha(dim, () => { at(x + w / 2, y + h / 2, i === 0 && press ? .95 : 1, () => { fillR(-w / 2, -h / 2, w, h, 50, c); T(k, 0, 70, 260, {w: 700, a: 'center', c: '#fff'}); }); });
      });
      alpha(sm(seg(t, 6.6, 7.0)), () => {
        g.fillStyle = 'rgba(8,40,26,0.95)'; g.fillRect(0, 0, W, H);
        circle(W / 2, 400, 180, C.green); icon('check', W / 2, 400, 260, '#062a18', 36);
        T('+100', W / 2, 820, 200, {w: 700, a: 'center'});
      });
    },
  };
})();
