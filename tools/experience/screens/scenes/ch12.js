// Chapter 12 · hero (product void). Dark, elegant app home; from ~8.5 s it recedes to a quiet brand loop
// so it never fights the end card. opts.homeUntil (default 8.0) moves that hand-off; the finale keeps the home.
(function () {
  SCENES.ch12 = {
    draw(t, o = {}) {
      const h0 = o.homeUntil ?? 8.0;
      backdrop(t, {top: '#070c16', bot: '#030509', blobs: [[C.blue, .12]]});
      const home = 1 - sm(seg(t, h0, h0 + 1.6));
      alpha(home * sm(seg(t, 0, .8)), () => {
        appIcon(90, 100, 84, {glow: true});
        T('Good evening, Alex', 160, 128, 76, {w: 700});
        T('Your desk is ready', 165, 190, 44, {w: 500, c: C.dim});
        const tiles = [['Height', '30.0', 'in', C.blue2, .22], ['Today', '9', 'stand breaks', C.green, .9], ['Focus', '6h 40m', '', C.violet, .7], ['Lights', 'Aurora', '', C.teal, .5]];
        const tw_ = (W - 120 - 3 * 40) / 4;
        tiles.forEach(([l, v, u, c, f], i) => {
          const x = 60 + i * (tw_ + 40), y = 300, k = eo(seg(t, .3 + i * .15, 1.1 + i * .15));
          alpha(k, () => at(0, (1 - k) * 40, 1, () => {
            card(x, y, tw_, 640, {r: 50, accent: c});
            T(l.toUpperCase(), x + 50, y + 90, 40, {w: 700, c: C.dim, ls: 6});
            ring(x + tw_ / 2, y + 330, 150, 26, f * eo(seg(t, .6 + i * .15, 2.4 + i * .15)) + .02 * Math.sin(t + i), c, {glow: 18});
            T(v, x + tw_ / 2, y + 355 - (u ? 0 : -10), v.length > 4 ? 64 : 96, {w: 700, a: 'center'});
            if (u) T(u, x + tw_ / 2, y + 410, 36, {w: 500, a: 'center', c: C.dim});
            T(['Sit', 'Goal 10', 'Deep work', 'LED scene'][i], x + 50, y + 590, 40, {w: 500, c: C.soft});
          }));
        });
      });
      // brand loop
      const b = sm(seg(t, h0 + .6, h0 + 2.2));
      alpha(b, () => {
        const breathe = .5 + .5 * Math.sin((t - 8.6) * 1.2);
        g.fillStyle = rad(W / 2, H / 2, 900, [[0, hexA(C.blue, .12 + .06 * breathe)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
        logo(W / 2, H / 2 - 20, 1000, .55 + .15 * breathe, {glow: hexA(C.blue2, .4), glowR: 40});
        fillR(W / 2 - 200 + 400 * fract((t - 8.6) * .25) - 60, H / 2 + 170, 120, 6, 3, hexA(C.blue2, .6));
      });
    },
  };
})();
