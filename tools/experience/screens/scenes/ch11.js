// Chapter 11 · storage (library). Tilt 0 -> 65° at 1.5-6.5 s, roll to the wall 6.6-13 s, then the screen dims.
(function () {
  SCENES.ch11 = {
    dim: t => .82 * sm(seg(t, 14.6, 17.4)),
    draw(t) {
      backdrop(t, {top: '#0b1424', bot: '#05080f', blobs: [[C.violet, .14], [C.blue, .12]]});
      g.save(); g.globalAlpha = 1 - sm(seg(t, 13.5, 14.0));
      const p = pose(t), tiltK = clamp(p.tilt / 65), rollK = clamp(p.z / 55), parked = t >= 13;
      const total = clamp(tiltK * .45 + rollK * .55);
      // header
      appIcon(80, 90, 76, {glow: true});
      T('Storage mode', 140, 116, 70, {w: 700});
      pill(W - 60, 52, parked ? 'Parked' : 'In progress', 40, {a: 'right', dot: parked ? C.green : C.amber, bg: hexA(parked ? C.green : C.amber, .16), c: parked ? C.green : C.amber});
      // tilt graphic
      const gx = 380, gy = 700;
      card(60, 190, 640, 700, {r: 44, accent: C.violet});
      poly([[120, gy + 90], [640, gy + 90]], 'rgba(255,255,255,0.2)', 5);
      fillR(gx - 22, gy - 120, 44, 210, 12, hexA(C.blue2, .5));
      at(gx, gy - 120, 1, () => { g.save(); g.shadowColor = hexA(C.violet, .8); g.shadowBlur = 30; fillR(-210, -20, 420, 40, 20, '#d9ccff'); g.restore(); }, -p.tilt * Math.PI / 180);
      g.beginPath(); g.arc(gx, gy - 120, 260, -p.tilt * Math.PI / 180, 0); g.strokeStyle = C.violet; g.lineWidth = 10; g.stroke();
      T(`${Math.round(p.tilt)}°`, 380, 360, 170, {w: 700, a: 'center'});
      // steps
      const steps = [['Fold to 65°', tiltK, 1.5], ['Roll to the wall', rollK, 6.6], ['Parked · floor clear', parked ? 1 : 0, 13]];
      const sx = 760, sw = W - sx - 60;
      steps.forEach(([label, k, t0], i) => {
        const y = 200 + i * 230, active = t >= t0 && k < 1, done = k >= 1;
        card(sx, y, sw, 200, {r: 40, accent: active ? C.blue : done ? C.green : null, border: active ? hexA(C.blue2, .5) : C.line});
        if (done) { circle(sx + 100, y + 100, 56, C.green); icon('check', sx + 100, y + 100, 80, '#05231a', 12); }
        else { ring(sx + 100, y + 100, 52, 12, k, C.blue2); T(String(i + 1), sx + 100, y + 122, 60, {w: 700, a: 'center', c: active ? C.text : C.faint}); }
        T(label, sx + 200, y + 125, 84, {w: 700, c: done ? C.soft : active ? C.text : C.faint});
        if (active) T(`${Math.round(k * 100)}%`, sx + sw - 50, y + 125, 84, {w: 700, a: 'right', c: C.blue2});
      });
      // overall progress
      T(parked ? 'Parked at the wall' : `Parking · ${Math.round(total * 100)}%`, 60, 990, 64, {w: 700, c: parked ? C.green : C.text});
      bar(860, 950, W - 920, 40, total, lin(860, 0, W, 0, [[0, C.blue], [1, parked ? C.green : C.violet]]));
      g.restore();
      // sleep moment
      alpha(sm(seg(t, 13.9, 14.5)), () => {
        icon('moon', W / 2 - 380, H / 2 - 10, 160, C.violet, 14);
        T('Floor is yours', W / 2 - 260, H / 2 + 20, 120, {w: 700});
        T('Desk parked · 65° · locked', W / 2 - 255, H / 2 + 110, 50, {w: 500, c: C.soft});
      });
    },
  };
})();
