// Chapter 4 · commons (library). The Humboldt desk rolls 1.2-9.8 s then slides left into the group (9.8-12.2 s).
// Single curved screen: shared whiteboard with live cursors + a research-notes panel.
(function () {
  const PEOPLE = [['Maya', C.pink], ['Jordan', C.amber], ['Sam', C.teal], ['Priya', C.violet]];
  const NOTES = [ // [x, y, colour, text1, text2, t]
    [.03, .08, '#ffd166', 'Research', 'question', .3], [.37, .05, '#7bdff2', 'Interview', '5 students', 1.4], [.71, .1, '#b8f2a6', 'Quiet zones', 'vs group', 2.6],
    [.06, .5, '#f7a1c4', 'Rolling', 'desks!', 3.8], [.4, .47, '#ffd166', 'Book the', 'commons', 5.2], [.72, .52, '#cdb4ff', 'Draft due', 'Friday', 6.6],
  ];
  SCENES.ch04 = {
    draw(t) {
      backdrop(t, {top: '#0b1220', bot: '#060a12', blobs: [[C.teal, .1], [C.blue, .1]]});
      // header
      appIcon(70, 70, 64, {glow: true});
      T('Group project · Commons', 124, 88, 52, {w: 700});
      PEOPLE.forEach(([n, c], i) => avatar(W - 110 - i * 80, 66, 38, c, n[0], {ring: '#0b1220', ringW: 6, ringGap: 0}));
      pill(W - 440, 36, `${PEOPLE.length} online`, 30, {a: 'right', dot: C.green, bg: hexA(C.green, .15), c: C.green});
      // whiteboard
      const bx = 40, by = 140, bw = W * .62, bh = H - 180;
      fillR(bx, by, bw, bh, 36, '#e9edf3'); // whiteboard surface (soft, not pure white)
      g.fillStyle = 'rgba(20,40,80,0.08)'; for (let x = bx + 40; x < bx + bw; x += 40) for (let y = by + 40; y < by + bh; y += 40) g.fillRect(x, y, 4, 4);
      // connector lines drawn progressively
      const lines = [[0, 1, 2.0], [1, 2, 3.2], [0, 3, 4.6], [3, 4, 5.9], [4, 5, 7.2]];
      lines.forEach(([a, b, t0]) => {
        const A = NOTES[a], B = NOTES[b], k = eo(seg(t, t0, t0 + .6)); if (k <= 0) return;
        const ax = bx + bw * A[0] + 190, ay = by + bh * A[1] + 120, bxx = bx + bw * B[0] + 190, byy = by + bh * B[1] + 120;
        poly([[ax, ay], [lerp(ax, bxx, k), lerp(ay, byy, k)]], '#5b6b86', 6);
      });
      NOTES.forEach(([nx, ny, col, a, b, t0], i) => {
        const k = back(seg(t, t0, t0 + .45)); if (k <= 0) return;
        const x = bx + bw * nx + 20, y = by + bh * ny;
        at(x + 170, y + 120, k, () => {
          g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 20; g.shadowOffsetY = 8; fillR(-170, -120, 340, 240, 16, col); g.restore();
          T(a, -140, -20, 56, {w: 700, c: '#1b2233'}); T(b, -140, 50, 50, {w: 500, c: '#2b3550'});
        }, (hash(i) - .5) * .08);
      });
      // highlighter stroke
      const hk = seg(t, 8.2, 9.4);
      if (hk > 0) { const pts = []; for (let i = 0; i <= 30 * hk; i++) pts.push([bx + 120 + i * 22, by + bh - 90 + Math.sin(i * .5) * 12]); poly(pts, 'rgba(255,90,120,0.75)', 18); }
      // cursors
      PEOPLE.slice(0, 3).forEach(([n, c], i) => { const [x, y] = wander(t, i + 1, bx + 80, by + 60, bw - 260, bh - 160, .22); cursor(x, y, 1.6, c, n, c); });
      // research notes panel
      const px = bx + bw + 30, pw = W - px - 40;
      card(px, by, pw, bh, {r: 36});
      T('Research notes', px + 40, by + 80, 50, {w: 700});
      const rows = [['Commons usage peaks 11-2', C.teal], ['Groups of 3-5 prefer', C.amber], ['  movable tables', C.amber], ['Quiet + social zones', C.pink], ['Cite: Ortiz 2025', C.blue2]];
      let ct = .8;
      rows.forEach(([s, c], i) => {
        const y = by + 170 + i * 88, vis = typed(s, t, ct, 22); ct += s.length / 22 + .3;
        if (!s.startsWith('  ') && vis.length) circle(px + 54, y - 14, 10, c);
        T(vis, px + 80, y, 44, {w: 500});
        if (vis.length && vis.length < s.length) caret(px + 80 + tw(vis, 44, 500), y, 44, t, c);
      });
      // a collaborator typing indicator
      fillR(px + 40, by + bh - 110, 360, 70, 35, 'rgba(255,255,255,0.06)');
      avatar(px + 80, by + bh - 75, 24, C.violet, 'P');
      T('Priya is typing', px + 120, by + bh - 62, 32, {w: 500, c: C.soft});
      for (let k = 0; k < 3; k++) circle(px + 350 + k * 18, by + bh - 75, 6, `rgba(255,255,255,${.3 + .7 * (fract(t * 2 - k * .2) < .5 ? 1 : 0)})`);
      toast(t, 12.1, 2.6, W - 900, 150, 840, 'Your desk joined the table', 'Screen shared with the group', {col: C.teal, icon: 'desk', h: 150});
      vignette(.35);
    },
  };
})();
