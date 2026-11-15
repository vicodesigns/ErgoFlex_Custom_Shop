// Cine cut · storage (workshop, Andre), Nov 14 2026: the phone in Andre's hand (film texture target: the people GLBs'
// 'Held.phone screen' material, person andre; the picture fills the phone's own screen texture, 270x580 aspect).
// The ErgoFlex app with one button: ready while he takes it out, his finger on it, the tap lights it (TAP), then the
// desk's own steps tick off from the chapter's clips (fold to 65°, roll to the wall) and "Parked · floor clear".
// review-cut.json 'storage': phone out 7.71, up 8.42, press 10.65, the button lights 11.14; fold 11.25-21.25, rolls
// 12.25-22.15, turn to 22.55. opts: {tap: 11.14, desk: 'Workshop desk', flip: true}.
// flip: the picture turned 180 degrees so the insert's camera (8.95-11.45 s, in front of Andre, over the tip of the
// phone) reads it upright (chingon, Nov 14: a viewer must be able to read 'Store the desk'); to Andre it is then upside down.
(function () {
  SCENES.c11p = {
    draw(t) {
      const o = SHOT.clip.opts || {}, TAP = o.tap ?? 11.14, p = pose(t);
      const tilt = clipsOf('tilt')[0] || {start: 11.25, duration: 10, target: 65}, rolls = clipsOf('wheels');
      const FOLD = +tilt.target || 65, rollA = rolls.length ? rolls[0].start : 12.25, PARK = rolls.length ? Math.max(...rolls.map(c => c.start + c.duration)) : 22.5;
      if (o.flip) { g.translate(W, H); g.rotate(Math.PI); }
      g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
      g.fillStyle = rad(W / 2, H * .45, W * 1.2, [[0, hexA(t >= TAP ? C.amber : C.blue, .16)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      // status bar + app header (the phone's design space is 1080 wide)
      T('9:41', 70, 90, 40, {w: 600, c: C.soft});
      appIcon(110, 220, 96, {glow: true});
      T('ErgoFlex', 190, 210, 56, {w: 700}); T(o.desk || 'Workshop desk · Groove', 192, 262, 34, {w: 500, c: C.dim});
      const pressed = t >= TAP, parked = t >= PARK;
      // the one button
      const bx = W / 2, by = 820, r = 300, k = pressed ? back(seg(t, TAP, TAP + .45)) : 1;
      if (!parked) {
        at(bx, by, k, () => {
          if (pressed) { g.save(); g.shadowColor = hexA(C.amber, .9); g.shadowBlur = 90; circle(0, 0, r, '#f29a00'); g.restore(); }
          else { ringStroke(0, 0, r - 14, '#f29a00', 28); }
          icon('park', 0, 0, 260, pressed ? '#0b0d12' : '#f29a00', 22);
        });
        if (pressed) { const fr = clamp((p.tilt / FOLD) * .5 + seg(t, rollA, PARK) * .5); ring(bx, by, r + 46, 16, fr, '#e8e8ea'); }
        T(pressed ? 'Storing…' : 'Store the desk', W / 2, by + r + 150, 76, {w: 700, a: 'center'});
        T(pressed ? 'Keep the path clear' : 'Fold to 65° and roll to the wall', W / 2, by + r + 220, 38, {w: 500, a: 'center', c: C.dim});
      } else {
        alpha(sm(seg(t, PARK, PARK + .5)), () => {
          circle(bx, by, r, hexA(C.green, .2)); circle(bx, by, r * .72, C.green); icon('check', bx, by, 300, '#06231a', 30);
          T('Parked', W / 2, by + r + 150, 90, {w: 700, a: 'center'}); T(`Floor clear · ${FOLD}° · locked`, W / 2, by + r + 220, 40, {w: 500, a: 'center', c: C.green});
        });
      }
      // the steps
      const steps = [[`Fold to ${FOLD}°`, clamp(p.tilt / FOLD), tilt.start], ['Roll to the wall', seg(t, rollA, PARK), rollA], ['Parked', parked ? 1 : 0, PARK]];
      alpha(sm(seg(t, TAP, TAP + .4)), () => steps.forEach(([l, f, t0], i) => {
        const y = 1500 + i * 120, done = f >= 1, active = t >= t0 && !done;
        if (done) { circle(120, y, 34, C.green); icon('check', 120, y, 46, '#06231a', 8); } else ring(120, y, 30, 8, f, active ? C.amber : C.faint);
        T(l, 190, y + 16, 50, {w: done || active ? 700 : 500, c: done ? C.soft : active ? C.text : C.faint});
        if (active) T(`${Math.round(f * 100)}%`, W - 70, y + 16, 50, {w: 700, a: 'right', c: C.amber});
      }));
    },
  };
})();
