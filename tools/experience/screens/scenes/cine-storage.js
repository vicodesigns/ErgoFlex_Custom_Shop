// Cine cut · storage (workshop, Andre), Nov 14 2026: the phone in Andre's hand (film texture target: the people GLBs'
// 'Held.phone screen' material, person andre; the picture fills the phone's own screen texture, 270x580 aspect).
// Authored upright, with no small text: the one button and the words 'Store the desk' fill the screen, so a viewer of
// the insert (8.95-11.45 s) reads them at 480p. The insert's camera is on the far side of Andre, so the texture is
// turned for it with {flipX:true} on the review-cut.json screens entry (film-texture-screens.mjs), not in the clip.
// The tap lights the button (TAP 11.14), then the desk's own steps show as a progress ring around it (fold to 65 deg
// and roll to the wall from the chapter's clips) and "Parked" with a check. opts: {tap: 11.14}.
(function () {
  SCENES.c11p = {
    draw(t) {
      const o = SHOT.clip.opts || {}, TAP = o.tap ?? 11.14, p = pose(t);
      const tilt = clipsOf('tilt')[0] || {start: 11.25, duration: 10, target: 65}, rolls = clipsOf('wheels');
      const FOLD = +tilt.target || 65, rollA = rolls.length ? rolls[0].start : 12.25, PARK = rolls.length ? Math.max(...rolls.map(c => c.start + c.duration)) : 22.5;
      g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
      g.fillStyle = rad(W / 2, H * .5, W * 1.2, [[0, hexA(t >= TAP ? C.amber : C.blue, .16)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      const pressed = t >= TAP, parked = t >= PARK;
      // the one big button, then two big lines under it
      const bx = W / 2, by = 1090, r = 340, k = pressed ? back(seg(t, TAP, TAP + .45)) : 1;
      if (!parked) {
        at(bx, by, k, () => {
          if (pressed) { g.save(); g.shadowColor = hexA(C.amber, .9); g.shadowBlur = 90; circle(0, 0, r, '#f29a00'); g.restore(); }
          else { ringStroke(0, 0, r - 18, '#f29a00', 36); }
          icon('park', 0, 0, 290, pressed ? '#0b0d12' : '#f29a00', 26);
        });
        if (pressed) { const fr = clamp((p.tilt / FOLD) * .5 + seg(t, rollA, PARK) * .5); ring(bx, by, r + 50, 18, fr, '#e8e8ea'); }
        if (pressed) T('Storing…', W / 2, 1880, 230, {w: 800, a: 'center'});
        else { T('Store', W / 2, 1790, 230, {w: 800, a: 'center'}); T('the desk', W / 2, 2030, 230, {w: 800, a: 'center'}); }
      } else {
        alpha(sm(seg(t, PARK, PARK + .5)), () => {
          circle(bx, by, r, hexA(C.green, .2)); circle(bx, by, r * .72, C.green); icon('check', bx, by, 330, '#06231a', 34);
          T('Parked', W / 2, 1880, 240, {w: 800, a: 'center', c: C.green});
        });
      }
    },
  };
})();
