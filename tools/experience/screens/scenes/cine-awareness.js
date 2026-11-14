// Cine cut · awareness (product stage, the dog), Nov 14 2026. The proximity radar on the cut's own roll and stop
// (review-cut.json 'awareness': the wheels clip 2.7-5.4 s, stopped short of the Labrador): one obstacle, the pet, placed
// where the desk stops `gap` inches short of it, picked up by the beam as the desk rolls, then "Stopped · pet ahead"
// through the floor-level gap shot. opts: {gap: 16, label: 'Pet'}.
(function () {
  SCENES.c08 = {
    draw(t) {
      const o = SHOT.clip.opts || {}, GAP = o.gap ?? 16, LABEL = o.label || 'Pet';
      const roll = clipsOf('wheels')[0] || {start: 2.7, duration: 2.7}, R0 = roll.start, R1 = roll.start + roll.duration;
      const end = pose(R1 + .5), p = pose(t), moving = speed(t) > .2;
      const dogZ = end.z + GAP + 18, dogX = end.x;   // 18: the desk's half-depth (as ch08)
      backdrop(t, {top: '#050b14', bot: '#020408', blobs: [[C.teal, .1]]});
      const cx = 560, cy = H / 2 + 20, R = 440, sc = R / 60;
      for (let k = 1; k <= 4; k++) ringStroke(cx, cy, R * k / 4, hexA(C.teal, .18), 3);
      poly([[cx - R, cy], [cx + R, cy]], hexA(C.teal, .12), 2); poly([[cx, cy - R], [cx, cy + R]], hexA(C.teal, .12), 2);
      const sa = t * 2.4;
      g.save(); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sa - .7, sa); g.closePath();
      const cg = g.createConicGradient(sa - .7, cx, cy); cg.addColorStop(0, hexA(C.teal, 0)); cg.addColorStop(.111, hexA(C.teal, .45)); cg.addColorStop(.112, hexA(C.teal, 0));
      g.fillStyle = cg; g.fill(); g.restore();
      poly([[cx, cy], [cx + Math.cos(sa) * R, cy + Math.sin(sa) * R]], C.teal, 4);
      fillR(cx - 60, cy - 30, 120, 60, 12, hexA(C.blue, .9)); strokeR(cx - 60, cy - 30, 120, 60, 12, '#cfe6ff', 3);
      polyFill([[cx, cy - 56], [cx - 14, cy - 38], [cx + 14, cy - 38]], C.teal);
      if (moving) for (let k = 0; k < 3; k++) { const u = fract(t * 2 + k / 3); poly([[cx - 40, cy + 40 + u * 60], [cx + 40, cy + 40 + u * 60]], hexA(C.teal, .5 * (1 - u)), 4); }
      // the pet: seen once the beam has passed it after the roll starts
      const dx = dogX - p.x, dz = dogZ - p.z, dist = Math.max(0, Math.hypot(dx, dz) - 18), bx = cx + dx * sc, by = cy - dz * sc;
      const ang = Math.atan2(by - cy, bx - cx), since = fract((sa - ang) / (Math.PI * 2)), glow = Math.exp(-since * 4);
      const seen = t >= R0 + .5, near = dist < 30, col = near ? C.amber : C.teal;
      if (seen) {
        const k = eo(seg(t, R0 + .5, R0 + 1));
        circle(bx, by, (26 + 12 * glow) * k, hexA(col, .25 + .5 * glow)); circle(bx, by, 14 * k, col);
        if (near) ringStroke(bx, by, 40 + 30 * fract(t * 1.5), hexA(C.amber, .6 * (1 - fract(t * 1.5))), 4);
        T(`${LABEL} ${Math.round(dist)}″`, bx + 40, by + 12, 40, {w: 700, c: C.text, alpha: k});
      }
      // panel
      const rx = 1140, rw = W - rx - 60, stopped = t >= R1, slowing = !stopped && seen && near && t >= R0;
      const state = stopped && seen ? [`Stopped · ${LABEL.toLowerCase()} ahead`, C.amber] : slowing ? [`${LABEL} ahead · slowing`, C.amber] : moving ? ['Moving · watching', C.blue2] : ['Path clear', C.green];
      T('PROXIMITY', rx, 150, 40, {w: 700, c: C.dim, ls: 8});
      T(state[0], rx, 290, state[0].length > 16 ? 90 : 120, {w: 700, c: state[1], max: rw});
      card(rx, 360, rw * .5 - 20, 400, {r: 44, accent: C.teal});
      T('NEAREST', rx + 50, 440, 34, {w: 700, c: C.dim, ls: 4});
      T(seen ? `${Math.round(dist)}″` : '—', rx + 50, 620, 190, {w: 700});
      T(seen ? LABEL + ' ahead' : 'nothing in range', rx + 50, 710, 44, {w: 500, c: C.soft});
      card(rx + rw * .5 + 20, 360, rw * .5 - 20, 400, {r: 44});
      T('SPEED', rx + rw * .5 + 70, 440, 34, {w: 700, c: C.dim, ls: 4});
      T(speed(t).toFixed(1), rx + rw * .5 + 70, 620, 190, {w: 700});
      T(speed(t) > .2 ? 'in/s · rolling' : 'in/s · held', rx + rw * .5 + 70, 710, 44, {w: 500, c: C.soft});
      bar(rx, 820, rw, 40, seen ? 1 - clamp(dist / 60) : 0, lin(rx, 0, rx + rw, 0, [[0, C.green], [.6, C.amber], [1, C.coral]]));
      T('Sensors · 8 of 8 active', rx, 940, 44, {w: 500, c: C.dim});
      vignette(.45);
    },
  };
})();
