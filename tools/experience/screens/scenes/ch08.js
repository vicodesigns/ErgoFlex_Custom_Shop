// Chapter 8 · awareness (product void). Proximity radar; forward roll 7-9.8 s (z 0 -> 9.7 in).
(function () {
  const OBST = [[0, 44, 'Chair'], [-38, 46, 'Wall'], [42, 40, 'Planter'], [-20, -36, 'Bag']]; // [x in, z in, label] relative to start
  SCENES.ch08 = {
    draw(t) {
      backdrop(t, {top: '#050b14', bot: '#020408', blobs: [[C.teal, .1]]});
      const p = pose(t), moving = speed(t) > .2;
      const cx = 560, cy = H / 2 + 20, R = 440, sc = R / 60;
      // radar
      for (let k = 1; k <= 4; k++) ringStroke(cx, cy, R * k / 4, hexA(C.teal, .18), 3);
      poly([[cx - R, cy], [cx + R, cy]], hexA(C.teal, .12), 2); poly([[cx, cy - R], [cx, cy + R]], hexA(C.teal, .12), 2);
      const sa = t * 2.4;
      g.save(); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sa - .7, sa); g.closePath();
      g.fillStyle = g.createConicGradient ? (() => { const cg = g.createConicGradient(sa - .7, cx, cy); cg.addColorStop(0, hexA(C.teal, 0)); cg.addColorStop(.111, hexA(C.teal, .45)); cg.addColorStop(.112, hexA(C.teal, 0)); return cg; })() : hexA(C.teal, .2);
      g.fill(); g.restore();
      poly([[cx, cy], [cx + Math.cos(sa) * R, cy + Math.sin(sa) * R]], C.teal, 4);
      // desk (centre)
      fillR(cx - 60, cy - 30, 120, 60, 12, hexA(C.blue, .9)); strokeR(cx - 60, cy - 30, 120, 60, 12, '#cfe6ff', 3);
      polyFill([[cx, cy - 56], [cx - 14, cy - 38], [cx + 14, cy - 38]], C.teal);
      if (moving) for (let k = 0; k < 3; k++) { const u = fract(t * 2 + k / 3); poly([[cx - 40, cy + 40 + u * 60], [cx + 40, cy + 40 + u * 60]], hexA(C.teal, .5 * (1 - u)), 4); }
      // blips (obstacles move toward the desk as it rolls forward)
      let nearest = 1e9, nearLabel = '';
      OBST.forEach(([ox, oz, label], i) => {
        const dx = ox - p.x, dz = oz - p.z, dist = Math.max(0, Math.hypot(dx, dz) - 18);
        if (dz > 0 && Math.abs(dx) < 30 && dist < nearest) { nearest = dist; nearLabel = label; }
        const bx = cx + dx * sc, by = cy - dz * sc, ang = Math.atan2(by - cy, bx - cx);
        const since = fract((sa - ang) / (Math.PI * 2)), glow = Math.exp(-since * 4);
        const col = dist < 14 ? C.amber : C.teal;
        circle(bx, by, 22 + 10 * glow, hexA(col, .25 + .5 * glow)); circle(bx, by, 12, col);
        T(`${label} ${Math.round(dist)}″`, bx + 34, by + 12, 36, {w: 600, c: C.soft, alpha: .5 + .5 * glow});
      });
      // right panel
      const rx = 1140, rw = W - rx - 60;
      const state = t < 7 ? ['Path clear', C.green] : moving ? ['Moving · watching', C.blue2] : ['Stopped safely', C.amber];
      T('PROXIMITY', rx, 150, 40, {w: 700, c: C.dim, ls: 8});
      T(state[0], rx, 290, 120, {w: 700, c: state[1]});
      card(rx, 360, rw * .5 - 20, 400, {r: 44, accent: C.teal});
      T('NEAREST', rx + 50, 440, 34, {w: 700, c: C.dim, ls: 4});
      T(`${Math.round(nearest)}″`, rx + 50, 620, 190, {w: 700});
      T(nearLabel + ' ahead', rx + 50, 710, 44, {w: 500, c: C.soft});
      card(rx + rw * .5 + 20, 360, rw * .5 - 20, 400, {r: 44});
      T('SPEED', rx + rw * .5 + 70, 440, 34, {w: 700, c: C.dim, ls: 4});
      T(speed(t).toFixed(1), rx + rw * .5 + 70, 620, 190, {w: 700});
      T('in/s · limit 6', rx + rw * .5 + 70, 710, 44, {w: 500, c: C.soft});
      bar(rx, 820, rw, 40, 1 - clamp(nearest / 40), lin(rx, 0, rx + rw, 0, [[0, C.green], [.6, C.amber], [1, C.coral]]));
      T('Sensors · 8 of 8 active', rx, 940, 44, {w: 500, c: C.dim});
      vignette(.45);
    },
  };
})();
