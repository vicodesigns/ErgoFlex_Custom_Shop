// Chapter 1 · awaken, wellness variant (Vico, 2026-11-04: "more information about the wellness routine ... or their
// productiveness, kind of how the desk helps"): the same ErgoFlex header, cards and colours as ch01, with no desk
// picture. Every number follows the shot's motion clips (CAPTURE_SHOT or shots/01.json):
//   standing time today ticks only while the desk is at standing height, the posture score rises with the lift and
//   each finished move, the routine checks off each move as it lands, the coach line reacts to the move in progress,
//   the focus streak and the next-stretch countdown run in real time. Boot logo and end wordmark as ch01.
(function () {
  const BOOT = 1.5, STAND_IN = 38;
  function beats() {
    const spans = SHOT.clips.map(c => [c.start, c.start + c.duration]).sort((a, b) => a[0] - b[0]), busy = [];
    for (const s of spans) { const last = busy[busy.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else busy.push(s.slice()); }
    const lastEnd = busy.length ? busy[busy.length - 1][1] : 0;
    return {end: Math.max(SHOT.seconds - 3.6, lastEnd + 1)};
  }
  let B = null, STEPS = null, STAND = null;
  // One routine step per move (lift / tilt / wheels), in the shot's order, with the wellness reason it serves.
  function steps() {
    return SHOT.clips.filter(c => c.duration >= .3).sort((a, b) => a.start - b.start).map(c => {
      let text, why, icn, col;
      if (c.lane === 'lift') { const up = +c.target > STAND_IN; text = up ? `Stand up · ${(+c.target).toFixed(1)} in` : `Sit down · ${(+c.target).toFixed(1)} in`; why = up ? 'Standing breaks lift energy and circulation' : 'Rest your legs, keep your back supported'; icn = 'up'; col = C.blue2; }
      else if (c.lane === 'tilt') { text = c.target > .5 ? `Tilt the board · ${Math.round(c.target)}°` : 'Level the surface'; why = c.target > .5 ? 'An angled surface keeps your neck neutral' : 'Back to flat for typing and mousing'; icn = 'tilt'; col = C.violet; }
      else if (c.kind === 'rotate') { text = `Turn ${c.direction || 'right'} ${Math.round(+c.value || 0)}°`; why = 'A new view: face the room, not the wall'; icn = 'wheel'; col = C.teal; }
      else { text = c.kind === 'travel' ? `Roll ${c.direction || 'forward'} ${Math.round(+c.value || 0)} in` : c.label; why = 'Bring the desk to you, not you to the desk'; icn = 'wheel'; col = C.teal; }
      return {t: c.start, end: c.start + c.duration, text, why, icn, col};
    });
  }
  // Standing seconds so far (integrated from the pose, 10 Hz table).
  function standTable() { const a = [0]; for (let i = 1; i <= Math.ceil(SHOT.duration * 10); i++) a.push(a[i - 1] + (pose(i / 10).height > STAND_IN ? .1 : 0)); return a; }
  const standSec = t => STAND[clamp(Math.round(t * 10), 0, STAND.length - 1)];
  const doneFrac = t => STEPS.length ? STEPS.reduce((n, s) => n + clamp(seg(t, s.t, s.end)), 0) / STEPS.length : 0;
  const posture = t => 76 + 9 * sm(seg(pose(t).height, 30, 44)) + 9 * doneFrac(t);
  function statTile(x, y, w, h, label, val, unit, col, sub, frac) {
    card(x, y, w, h, {r: 30, accent: col});
    T(label, x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    T(val, x + 32, y + 140, 84, {w: 700});
    if (unit) T(unit, x + 40 + tw(val, 84, 700), y + 140, 36, {w: 600, c: C.dim});
    if (frac != null) bar(x + 34, y + 164, w - 68, 12, frac, col);
    if (sub) T(sub, x + 34, y + h - 30, 28, {w: 500, c: col});
  }
  function today(t, x, y, w, h) {
    card(x, y, w, h, {r: 36, top: '#0c1628', bot: '#08101d'});
    T('TODAY', x + 44, y + 70, 30, {w: 600, c: C.dim, ls: 4});
    const p = pose(t), standing = p.height > STAND_IN;
    pill(x + w - 44, y + 34, standing ? 'Standing' : 'Sitting', 28, {a: 'right', dot: standing ? C.blue2 : C.soft, bg: hexA(standing ? C.blue2 : '#ffffff', .12), c: standing ? C.blue2 : C.soft});
    // wellness score ring
    const cx = x + 270, cy = y + 360, sc = posture(t);
    ring(cx, cy, 190, 30, sc / 100, C.green, {glow: 24});
    T(String(Math.round(sc)), cx, cy + 34, 120, {w: 700, a: 'center'});
    T('WELLNESS SCORE', cx, cy + 92, 24, {w: 600, a: 'center', c: C.dim, ls: 3});
    const gain = Math.round(sc) - 76;
    if (gain > 0) T(`▲ ${gain} since you started`, cx, y + h - 40, 28, {w: 600, a: 'center', c: C.green});
    // tiles
    const tx = x + 540, tw2 = (w - 540 - 40 - 20) / 2, th = 250;
    const st = 23 * 60 + 18 + standSec(t);
    statTile(tx, y + 110, tw2, th, 'STANDING TODAY', `${Math.floor(st / 60)}:${pad2(st % 60)}`, 'min', C.blue2, standing ? '▲ Standing now' : 'Goal 45 min', st / (45 * 60));
    const fs = 47 * 60 + 12 + t;
    statTile(tx + tw2 + 20, y + 110, tw2, th, 'FOCUS STREAK', `${Math.floor(fs / 60)}:${pad2(fs % 60)}`, 'min', C.violet, 'Deep work · alerts held', null);
    const tilt = p.tilt > .3;
    statTile(tx, y + 380, tw2, th, 'POSTURE', tilt ? 'Neutral' : standing ? 'Upright' : 'Seated', '', C.teal, tilt ? `Neck angle eased by ${Math.round(p.tilt)}°` : standing ? 'Weight on both feet' : 'Lumbar supported', null);
    const ns = Math.max(0, 6 * 60 + 40 - t);
    statTile(tx + tw2 + 20, y + 380, tw2, th, 'NEXT STRETCH', `${Math.floor(ns / 60)}:${pad2(ns % 60)}`, '', C.amber, 'Shoulder rolls · 2 min', 1 - ns / 400);
  }
  function dayline(t, x, y, w, h) {
    card(x, y, w, h, {r: 32});
    T('SIT · STAND TODAY', x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    const bx = x + 34, bw = w - 68, by = y + 110, bh = 54, now = .62;   // 8:00 -> 18:00, now ~14:12
    const blocks = [[0, .08, 0], [.08, .13, 1], [.13, .24, 0], [.24, .3, 1], [.3, .41, 0], [.41, .47, 1], [.47, .57, 0], [.57, now, 0]];
    fillR(bx, by, bw, bh, 12, 'rgba(255,255,255,0.06)');
    blocks.forEach(([a, b, s], i) => fillR(bx + bw * a + 2, by, bw * (b - a) - 4, bh, 10, i === blocks.length - 1 ? hexA(pose(t).height > STAND_IN ? C.blue2 : C.soft, .55) : s ? hexA(C.blue2, .8) : 'rgba(195,206,223,0.22)'));
    fillR(bx + bw * now - 2, by - 12, 4, bh + 24, 2, C.text);
    T('8 AM', bx, by + bh + 46, 24, {w: 500, c: C.dim}); T('Now', bx + bw * now, by + bh + 46, 24, {w: 600, a: 'center', c: C.soft}); T('6 PM', bx + bw, by + bh + 46, 24, {w: 500, a: 'right', c: C.dim});
  }
  function weekly(t, x, y, w, h) {
    card(x, y, w, h, {r: 32});
    T('HOW THE DESK HELPS · THIS WEEK', x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    const items = [['−38%', 'sitting time', C.blue2], ['+21%', 'focus hours', C.violet], ['4.6', 'moves / hour', C.teal]];
    items.forEach(([v, l, c], i) => { const ix = x + 34 + i * (w - 68) / 3; T(v, ix, y + 160, 64, {w: 700, c}); T(l, ix, y + 206, 26, {w: 500, c: C.soft}); });
  }
  function routine(t, x, y, w, h) {
    card(x, y, w, h, {r: 30, accent: C.green});
    T('MOVEMENT ROUTINE', x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    const done = STEPS.filter(s => t >= s.end).length;
    T(`${done} of ${STEPS.length}`, x + w - 34, y + 56, 28, {w: 700, a: 'right', c: done === STEPS.length ? C.green : C.soft});
    const rowH = Math.min(84, (h - 110) / Math.max(1, STEPS.length));
    STEPS.forEach((s, i) => {
      const ry = y + 100 + i * rowH, active = t >= s.t && t < s.end, fin = t >= s.end;
      alpha(fin || active ? 1 : .5, () => {
        iconBadge(s.icn, x + 64, ry + 22, 26, s.col);
        T(s.text, x + 110, ry + 34, 34, {w: 600, c: active ? C.text : fin ? C.soft : C.dim});
        if (fin) icon('check', x + w - 60, ry + 22, 34, C.green, 4);
        else if (active) ring(x + w - 60, ry + 22, 15, 5, seg(t, s.t, s.end), s.col);
        else ringStroke(x + w - 60, ry + 22, 15, 'rgba(255,255,255,0.15)', 4);
      });
    });
  }
  function coach(t, x, y, w, h) {
    card(x, y, w, h, {r: 30});
    T('COACH', x + 34, y + 56, 26, {w: 600, c: C.dim, ls: 3});
    const cur = [...STEPS].reverse().find(s => t >= s.t - .1);
    const all = STEPS.length && t >= STEPS[STEPS.length - 1].end;
    const head = all ? 'Routine complete' : cur ? cur.text : 'Ready when you are';
    const body = all ? 'Every move logged to your wellness score' : cur ? cur.why : 'Your desk follows your day';
    const k = eo(seg(t, cur ? cur.t - .1 : 0, (cur ? cur.t : 0) + .4));
    alpha(k, () => {
      T(head, x + 34, y + 140 - (1 - k) * 16, 46, {w: 700});
      T(body, x + 34, y + 196, 30, {w: 500, c: C.soft, max: w - 68});
    });
  }
  SCENES.ch01w = {
    draw(t) {
      if (!B) { B = beats(); STEPS = steps(); STAND = standTable(); }
      backdrop(t, {top: '#08101e', bot: '#04060b', blobs: [[C.blue, .16], [C.green, .05]]});
      const p = pose(t), ui = eo(seg(t, BOOT - .2, BOOT + .8)), endLogo = sm(seg(t, B.end, B.end + 1.2));
      alpha(ui * (1 - endLogo * .85), () => {
        at(0, (1 - ui) * 40, 1, () => {
          appIcon(78, 70, 64, {glow: true});
          T('ErgoFlex', 128, 84, 44, {w: 700});
          T('· Studio Desk 60×30', 330, 84, 34, {w: 500, c: C.dim});
          const syncPulse = .5 + .5 * Math.sin(t * 4);
          pill(W - 40, 40, 'Connected', 28, {a: 'right', dot: hexA(C.green, .6 + .4 * syncPulse), bg: hexA(C.green, .14), c: C.green});
          const RW = Math.min(1000, W * .42), rx = W - 40 - RW, SW = rx - 70, HW = (SW - 20) / 2;
          today(t, 40, 130, SW, 640);
          dayline(t, 40, 790, HW, 260);
          weekly(t, 60 + HW, 790, HW, 260);
          routine(t, rx, 130, RW, 560);
          coach(t, rx, 710, RW, 340);
        });
      });
      const bootA = 1 - sm(seg(t, BOOT - .3, BOOT + .5));
      const la = Math.max(bootA * sm(seg(t, 0, .7)), endLogo);
      alpha(la, () => {
        const k = t < 10 ? eo(seg(t, 0, 1.2)) : eo(seg(t, B.end, B.end + 1.6));
        g.fillStyle = rad(W / 2, H / 2, 700, [[0, hexA(C.blue, .22 * la)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
        logo(W / 2, H / 2 - 30, lerp(760, 820, k), 1, {glow: hexA(C.blue2, .6), glowR: 50});
        T(t < 10 ? 'Good afternoon' : 'Your partner in health', W / 2, H / 2 + 120, 40, {w: 500, a: 'center', c: C.soft});
        if (t < 10) bar(W / 2 - 220, H / 2 + 170, 440, 10, eo(seg(t, .2, BOOT)), C.blue);
        else T(`Wellness ${Math.round(posture(t))}  ·  ${Math.floor((23 * 60 + 18 + standSec(t)) / 60)} min standing  ·  routine done`, W / 2, H / 2 + 180, 32, {w: 600, a: 'center', c: C.green});
      });
      vignette(.45);
    },
  };
})();
