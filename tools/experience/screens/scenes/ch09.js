// Chapter 9 · music (gaming room, night). Secondary screens around the game-montage main monitor.
// Beat grid matches the score: music section starts on a bar line at t=0.75 s, 115.2 BPM.
// Spectrum/level data comes from the score itself (SHOT.audio, see audio-bands.py).
(function () {
  const BPM = 115.2, B0 = .75;
  const beat = t => (t - B0) * BPM / 60;
  const pulse = t => t < B0 ? 0 : Math.exp(-fract(beat(t)) * 5);
  const bar4 = t => t < B0 ? 0 : Math.exp(-fract(beat(t) / 4) * 3);
  const hue = t => (285 + t * 30) % 360; // LED spectrum sweep (12 s period)
  const hsl = (h, s = 100, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const level = t => SHOT.audio ? aVal('rms', t, 1) : .5 + .3 * pulse(t);
  const kick = t => SHOT.audio ? aVal('low', t) : pulse(t);
  const bands = t => aBands(t) || Array.from({length: 32}, (_, i) => .3 + .5 * noise(t * 3 + i));

  // ---------------- Portrait: now playing / visualiser ----------------
  function art(cx, cy, r, t) {
    clip(cx - r, cy - r, 2 * r, 2 * r, r, () => {
      g.fillStyle = lin(0, cy - r, 0, cy + r, [[0, '#1a0638'], [.55, '#7a1a8a'], [.56, '#12062a'], [1, '#05020f']]); g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      // sun with stripes
      const sr = r * .42 * (1 + .04 * kick(t)), sy = cy - r * .02;
      g.save(); g.beginPath(); g.arc(cx, sy, sr, Math.PI, 0); g.closePath(); g.clip();
      g.fillStyle = lin(0, sy - sr, 0, sy, [[0, '#ffd34d'], [1, '#ff3d8b']]); g.fillRect(cx - sr, sy - sr, 2 * sr, sr);
      for (let k = 0; k < 5; k++) { const yy = sy - sr * .1 - k * sr * .16; g.fillStyle = '#7a1a8a'; g.fillRect(cx - sr, yy, 2 * sr, 4 + k * 1.5); }
      g.restore();
      // perspective grid scrolling to the beat
      const hz = cy + r * .1;
      g.strokeStyle = hsl(hue(t), 100, 65, .9); g.lineWidth = 3;
      for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(cx + i * 12, hz); g.lineTo(cx + i * r * .32, cy + r); g.stroke(); }
      const sc = fract(beat(t) * .5);
      for (let k = 0; k < 8; k++) { const u = Math.pow((k + sc) / 8, 2.2), yy = hz + u * (cy + r - hz); g.globalAlpha = .3 + .7 * u; g.beginPath(); g.moveTo(cx - r, yy); g.lineTo(cx + r, yy); g.stroke(); }
      g.globalAlpha = 1;
    });
    ringStroke(cx, cy, r, 'rgba(255,255,255,0.15)', 4);
  }
  SCENES.ch09v = {
    draw(t) {
      const h = hue(t), lv = level(t), kk = kick(t);
      g.fillStyle = '#05030c'; g.fillRect(0, 0, W, H);
      g.fillStyle = rad(W / 2, 620, 1100, [[0, hsl(h, 90, 45, .35 + .25 * kk)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      g.fillStyle = rad(W * .2, H * .9, 900, [[0, hsl(h + 120, 90, 50, .18)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      // header
      T('NOW PLAYING', 70, 130, 36, {w: 600, c: C.soft, ls: 6});
      pill(W - 70, 84, 'LED sync', 32, {a: 'right', dot: hsl(h, 100, 60), bg: 'rgba(255,255,255,0.08)', c: '#fff'});
      // radial spectrum around the art
      const cx = W / 2, cy = 640, r = 330, B = bands(t);
      at(cx, cy, 1, () => {
        const n = 96;
        for (let i = 0; i < n; i++) {
          const bi = Math.floor((i < n / 2 ? i : n - 1 - i) / (n / 2) * 31), v = B[bi];
          const a = i / n * Math.PI * 2 + t * .15, len = 20 + v * 150 * (.6 + .6 * lv);
          g.strokeStyle = hsl(h + i * 2.5, 100, 62); g.lineWidth = 12; g.lineCap = 'round';
          g.beginPath(); g.moveTo(Math.cos(a) * (r + 30), Math.sin(a) * (r + 30)); g.lineTo(Math.cos(a) * (r + 30 + len), Math.sin(a) * (r + 30 + len)); g.stroke();
        }
      });
      at(cx, cy, 1 + .025 * kk, () => art(0, 0, r, t));
      // title
      T('Neon Flight', 70, 1260, 96, {w: 700});
      T('ErgoFlex Sessions · Night Drive', 70, 1330, 40, {w: 500, c: C.soft});
      icon('heart', W - 110, 1240, 80, hsl(h + 40, 100, 62));
      // progress
      const el = 72 + t;
      bar(70, 1390, W - 140, 14, el / 225, lin(70, 0, W - 70, 0, [[0, hsl(h, 100, 60)], [1, hsl(h + 80, 100, 60)]]));
      circle(70 + (W - 140) * el / 225, 1397, 20, '#fff');
      T(fmtMS(Math.floor(el)), 70, 1460, 34, {w: 500, c: C.soft}); T('3:45', W - 70, 1460, 34, {w: 500, a: 'right', c: C.soft});
      // controls
      icon('play', W / 2 - 220, 1560, 60, C.soft); at(W / 2 - 220, 1560, -1, () => icon('play', 0, 0, 60, C.soft));
      circle(W / 2, 1560, 74 + 6 * pulse(t), '#fff'); icon('pause', W / 2, 1560, 70, '#120820');
      icon('play', W / 2 + 220, 1560, 60, C.soft);
      // spectrum bars
      const by = 1870, bw = (W - 140) / 32;
      for (let i = 0; i < 32; i++) {
        const v = B[i], hh = 18 + v * 190;
        fillR(70 + i * bw + 4, by - hh, bw - 8, hh, 8, lin(0, by - 210, 0, by, [[0, hsl(h + i * 4, 100, 66)], [1, hsl(h + i * 4 + 40, 100, 45)]]));
      }
      // BPM chip
      fillR(70, 1640, 260, 70, 35, 'rgba(255,255,255,0.08)');
      circle(110, 1675, 14 + 6 * pulse(t), hsl(h, 100, 62));
      T('115 BPM', 140, 1690, 36, {w: 700});
      fillR(360, 1640, W - 430, 70, 35, lin(360, 0, W - 70, 0, [[0, hsl(h, 100, 55, .9)], [.5, hsl(h + 60, 100, 55, .9)], [1, hsl(h + 120, 100, 55, .9)]]));
      T('Desk LEDs · spectrum', 400, 1690, 34, {w: 600, c: '#fff'});
      g.fillStyle = `rgba(255,255,255,${.06 * bar4(t)})`; g.fillRect(0, 0, W, H);
    },
  };

  // ---------------- Landscape: stream dashboard + chat ----------------
  const USERS = [['pixelpanda', C.cyan], ['nova_kai', C.pink], ['driftqueen', C.amber], ['retroRex', C.lime], ['glitchbyte', C.violet], ['lumen', C.teal], ['mochi', C.coral], ['bytebeat', C.blue2]];
  const MSGS = ['that drift was CLEAN', 'GG!!', 'the LEDs hit on the beat', 'what desk is that??', 'this song slaps', 'clip it clip it', 'combo x12 lets go', 'retro round next pls', 'lights match the music', 'W stream', 'HYPE', 'ErgoFlex setup goals', 'one more race', 'that boss fight tho', 'no way, perfect lap', 'hype train incoming'];
  function msg(i) { const r = rng(i * 31 + 7); return {u: USERS[Math.floor(r() * USERS.length)], text: MSGS[i % MSGS.length], badge: r() < .3}; }
  SCENES.ch09c = {
    prefetch(t) { return SHOT.videos.montage ? [['montage', Math.round(t * 30)]] : []; },
    draw(t) {
      const h = hue(t), lv = level(t), kk = kick(t);
      g.fillStyle = '#07050f'; g.fillRect(0, 0, W, H);
      g.fillStyle = rad(W * .7, H * .3, 1200, [[0, hsl(h, 90, 45, .18 + .1 * kk)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      // server rail
      fillR(0, 0, 120, H, 0, 'rgba(0,0,0,0.45)');
      [C.blue, C.pink, C.amber, C.teal, C.violet].forEach((c, i) => { const y = 80 + i * 112; fillR(26, y - 34, 68, 68, i === 1 ? 22 : 34, c); if (i === 1) fillR(0, y - 26, 8, 52, 4, '#fff'); });
      appIcon(60, 80, 68);
      // voice channel
      fillR(120, 0, 400, H, 0, 'rgba(255,255,255,0.03)');
      T('Night Squad', 160, 82, 44, {w: 700});
      ['# general', '# clips', '# setups'].forEach((s, i) => T(s, 160, 170 + i * 62, 34, {w: i === 0 ? 600 : 500, c: i === 0 ? C.text : C.dim}));
      T('VOICE · LOBBY', 160, 400, 26, {w: 600, c: C.dim, ls: 3});
      [['nova_kai', C.pink], ['retroRex', C.lime], ['you', C.blue2], ['mochi', C.coral]].forEach(([n, c], i) => {
        const y = 470 + i * 104, talk = noise(t * 2.2 + i * 5) > .55;
        avatar(200, y, 38, c, n[0].toUpperCase(), talk ? {ring: C.green, ringW: 5, ringGap: 5} : {});
        T(n, 262, y + 13, 36, {w: 600, c: talk ? C.text : C.soft});
        if (talk) for (let k = 0; k < 4; k++) { const v = noise(t * 10 + k * 3 + i); fillR(440 + k * 14, y - 4 - v * 26, 9, 8 + v * 26 * 2, 4, C.green); }
      });
      // stream preview (the main monitor's game montage) + stats
      const px = 560, pw = 820, ph = pw * 9 / 16, py = 40;
      card(px - 8, py - 8, pw + 16, ph + 16, {r: 26, top: '#16102a', bot: '#0d0a1a', border: hsl(h, 100, 60, .5)});
      clip(px, py, pw, ph, 20, () => {
        const im = frameImg('montage', Math.round(t * 30));
        if (im) drawCover(im, px, py, pw, ph); else { g.fillStyle = lin(px, py, px + pw, py + ph, [[0, hsl(h, 80, 40)], [1, hsl(h + 90, 80, 30)]]); g.fillRect(px, py, pw, ph); }
      });
      pill(px + 24, py + 24, 'LIVE', 30, {bg: '#ff2d55', c: '#fff', wt: 700});
      const viewers = Math.round(1204 + t * 13 + 20 * noise(t));
      pill(px + 160, py + 24, viewers.toLocaleString('en-US') + ' watching', 30, {bg: 'rgba(0,0,0,0.6)', c: '#fff'});
      // hype meter driven by the score level
      const hy = py + ph + 40;
      card(px - 8, hy, pw + 16, 150, {r: 26});
      T('HYPE TRAIN', px + 30, hy + 58, 30, {w: 700, c: hsl(h, 100, 70), ls: 4});
      T(`Level ${1 + Math.floor(seg(t, 0, 15) * 3.999)}`, px + pw - 20, hy + 58, 34, {w: 700, a: 'right'});
      bar(px + 30, hy + 86, pw - 50, 36, clamp(fract(seg(t, 0, 15) * 4) * .8 + lv * .25), lin(px, 0, px + pw, 0, [[0, hsl(h, 100, 58)], [1, hsl(h + 70, 100, 58)]]));
      // equaliser strip
      const ey = hy + 190, B = bands(t), ew = (pw + 16) / 32;
      for (let i = 0; i < 32; i++) { const v = B[i], hh = 10 + v * 200; fillR(px - 8 + i * ew + 3, ey + 210 - hh, ew - 6, hh, 6, hsl(h + i * 5, 100, 60)); }
      // chat column
      const cx0 = 1420, cw = W - cx0 - 30;
      card(cx0, 40, cw, H - 80, {r: 30, top: '#120e22', bot: '#0b0916'});
      T('STREAM CHAT', cx0 + 30, 100, 28, {w: 700, c: C.dim, ls: 4});
      const rate = 1.6, n = Math.floor(t * rate) + 6, rowH = 112;
      clip(cx0, 130, cw, H - 190, 0, () => {
        for (let j = 0; j < 9; j++) {
          const i = n - j; if (i < 0) continue;
          const born = (i - 6) / rate, k = eo(seg(t, born, born + .3));
          const y = H - 130 - (j + 1 - (1 - k)) * rowH + 50;
          const m = msg(i);
          alpha(j === 0 ? k : 1, () => {
            avatar(cx0 + 62, y - 14, 30, m.u[1], m.u[0][0].toUpperCase());
            T(m.u[0], cx0 + 110, y - 22, 30, {w: 700, c: m.u[1]});
            T(m.text, cx0 + 110, y + 22, 34, {w: 500, c: C.text, max: cw - 130});
          });
        }
      });
      // follower alert on a bar line
      [4.92, 9.08, 13.25].forEach((t0, i) => toast(t, t0, 2.2, px + 120, py + ph - 190, pw - 240, ['pixelpanda followed!', 'glitchbyte subscribed', 'driftqueen x5 combo'][i], 'Thanks for the support', {col: [C.pink, C.violet, C.amber][i], icon: 'heart', h: 140, ts: 44, ss: 28}));
      g.fillStyle = `rgba(255,255,255,${.05 * bar4(t)})`; g.fillRect(0, 0, W, H);
    },
  };
  // ---------------- Arcade cabinet: "Orbit Runner" gameplay ----------------
  function crt() {
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    g.fillStyle = rad(W / 2, H / 2, Math.hypot(W, H) * .6, [[0, 'rgba(0,0,0,0)'], [.7, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0.75)']]); g.fillRect(0, 0, W, H);
  }
  const stars = Array.from({length: 140}, (_, i) => [hash(i), hash(i + 300), .3 + hash(i + 600) * .7]);
  SCENES.ch09a = {
    draw(t) {
      const h = hue(t), kk = kick(t), b = Math.max(0, beat(t));
      g.fillStyle = '#04020c'; g.fillRect(0, 0, W, H);
      // starfield streaming outward
      stars.forEach(([sx, sy, z], i) => {
        const a = sx * Math.PI * 2, d = fract(sy + t * .12 * z) , r = d * d * W * .8;
        const x = W / 2 + Math.cos(a) * r, y = H / 2 + 40 + Math.sin(a) * r;
        circle(x, y, 1 + d * 4 * z, `hsla(${(h + i * 3) % 360},100%,${70 + 30 * z}%,${.3 + .7 * d})`);
      });
      const cx = W / 2, cy = H / 2 + 40;
      // planet
      g.fillStyle = rad(cx, cy, 420, [[0, hsl(h + 180, 100, 50, .35 + .2 * kk)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      circle(cx, cy, 170 * (1 + .03 * kk), lin(cx - 170, cy - 170, cx + 170, cy + 170, [[0, hsl(h + 180, 90, 60)], [1, hsl(h + 240, 90, 25)]]));
      g.save(); g.beginPath(); g.ellipse(cx, cy, 290, 70, -.35, 0, Math.PI * 2); g.strokeStyle = hsl(h + 60, 100, 70, .8); g.lineWidth = 8; g.stroke(); g.restore();
      // orbit track
      const R = 360;
      g.setLineDash([14, 18]); ringStroke(cx, cy, R, hsl(h, 100, 70, .35), 4); g.setLineDash([]);
      // pickups spawn on each beat around the orbit, collected when the ship passes
      const ang = t * 1.9; // ship angle
      for (let k = Math.floor(b) - 6; k <= Math.floor(b) + 2; k++) {
        if (k < 0) continue;
        const pa = k * 1.9 * 60 / BPM + 1.2; // ship reaches this angle one beat-ish later
        const tSpawn = B0 + k * 60 / BPM, tHit = tSpawn + 1.2 / 1.9;
        if (t < tSpawn) continue;
        const px = cx + Math.cos(pa) * R, py = cy + Math.sin(pa) * R;
        if (t < tHit) { const sc = eo(seg(t, tSpawn, tSpawn + .25)); at(px, py, sc, () => { g.save(); g.shadowColor = hsl(h + 60 + k * 40, 100, 60); g.shadowBlur = 30; polyFill([[0, -26], [8, -8], [26, 0], [8, 8], [0, 26], [-8, 8], [-26, 0], [-8, -8]], hsl(h + 60 + k * 40, 100, 70)); g.restore(); }, t * 3); }
        else if (t < tHit + .6) {
          const u = (t - tHit) / .6;
          for (let q = 0; q < 14; q++) { const qa = q / 14 * Math.PI * 2; circle(px + Math.cos(qa) * u * 120, py + Math.sin(qa) * u * 120, 8 * (1 - u), hsl(h + 60 + k * 40, 100, 70)); }
          T('+100', px, py - 30 - u * 60, 46, {w: 700, a: 'center', c: '#fff', alpha: 1 - u});
        }
      }
      // enemy drones
      for (let e = 0; e < 3; e++) { const ea = -t * .7 + e * 2.1, er = 520 + 40 * Math.sin(t * 2 + e); at(cx + Math.cos(ea) * er, cy + Math.sin(ea) * er * .8, 1, () => { polyFill([[0, -24], [24, 14], [0, 4], [-24, 14]], hsl(h + 140, 100, 60)); circle(0, 0, 8, '#fff'); }, ea); }
      // ship with trail
      for (let k = 12; k >= 0; k--) { const a2 = ang - k * .05; circle(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R, 18 - k, hsl(h + k * 6, 100, 60, .5 * (1 - k / 12))); }
      at(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 1.1 + .1 * kk, () => { g.save(); g.shadowColor = '#fff'; g.shadowBlur = 30; polyFill([[34, 0], [-22, -22], [-12, 0], [-22, 22]], '#ffffff'); g.restore(); circle(-14, 0, 8, hsl(h, 100, 60)); }, ang + Math.PI / 2);
      // HUD
      const score = 4250 + Math.floor(Math.max(0, b - 1.2)) * 100;
      T('1UP', 50, 80, 40, {w: 700, c: hsl(h, 100, 65)}); T(String(score).padStart(6, '0'), 50, 140, 64, {w: 700});
      T('HI', W / 2, 80, 40, {w: 700, a: 'center', c: hsl(h + 120, 100, 65)}); T('099500', W / 2, 140, 64, {w: 700, a: 'center'});
      for (let l = 0; l < 3; l++) polyFill([[W - 70 - l * 60, 72], [W - 100 - l * 60, 120], [W - 40 - l * 60, 120]], C.text);
      const combo = 1 + Math.floor(Math.max(0, b - 1));
      at(W - 60, H - 70, 1 + .15 * pulse(t), () => T(`COMBO x${combo}`, 0, 0, 56, {w: 700, a: 'right', c: hsl(h + 60, 100, 65)}));
      T('STAGE 3', 50, H - 70, 44, {w: 700, c: C.soft});
      // banner on bar lines
      [[4.92, 'GREAT!'], [9.08, 'BONUS STAGE'], [13.25, 'PERFECT!']].forEach(([t0, txt]) => {
        const v = win(t, t0, t0 + 1.4, .3); if (v <= 0) return;
        alpha(v, () => at(W / 2, 320, lerp(.6, 1, back(seg(t, t0, t0 + .35))), () => T(txt, 0, 0, 130, {w: 700, a: 'center', c: '#fff', glow: hsl(h + 30, 100, 60), glowR: 40})));
      });
      crt();
    },
  };

  // ---------------- Marquee: lit "ORBIT RUNNER" logo ----------------
  SCENES.ch09m = {
    draw(t) {
      const h = hue(t), kk = kick(t), b = Math.max(0, beat(t));
      g.fillStyle = lin(0, 0, 0, H, [[0, '#14062a'], [1, '#05020e']]); g.fillRect(0, 0, W, H);
      // sunburst rays
      at(W / 2, H * .55, 1, () => { for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = hsl(h + i * 8, 100, 55, .1 + .06 * kk); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -120); g.lineTo(W, 120); g.fill(); } }, t * .1);
      g.fillStyle = rad(W / 2, H / 2, W * .45, [[0, hsl(h, 100, 50, .35)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
      // chase bulbs around the frame
      const n = 64, per = 2 * (W + H) - 160;
      for (let i = 0; i < n; i++) {
        let d = i / n * per, x, y; const m = 60;
        if (d < W - 2 * m) { x = m + d; y = m; } else if ((d -= W - 2 * m) < H - 2 * m) { x = W - m; y = m + d; } else if ((d -= H - 2 * m) < W - 2 * m) { x = W - m - d; y = H - m; } else { d -= W - 2 * m; x = m; y = H - m - d; }
        const on = (i + Math.floor(b * 2)) % 4 === 0;
        circle(x, y, on ? 22 : 16, on ? hsl(h + 40, 100, 75) : 'rgba(255,220,160,0.25)');
      }
      g.save(); g.shadowColor = hsl(h, 100, 60); g.shadowBlur = 60 + 50 * kk;
      T('ORBIT RUNNER', W / 2, H / 2 + 150, 420, {w: 700, a: 'center', c: '#fff', ls: 30});
      g.restore();
      T('ORBIT RUNNER', W / 2, H / 2 + 150, 420, {w: 700, a: 'center', c: lin(0, H / 2 - 170, 0, H / 2 + 150, [[0, '#fff6c8'], [.5, hsl(h + 50, 100, 65)], [1, hsl(h, 100, 50)]]), ls: 30});
      T('INSERT COIN', W / 2, H - 120, 72, {w: 700, a: 'center', c: '#fff', ls: 20, alpha: fract(t * 1.92) < .6 ? 1 : .25});
    },
  };

  // ---------------- Macro key display: beat-lit key grid ----------------
  const KEYS = ['music', 'mic', 'cam', 'bolt', 'heart', 'play', 'chat', 'desk', 'up', 'down', 'sun', 'moon', 'gear', 'atom', 'wifi'];
  SCENES.ch09k = {
    draw(t) {
      const h = hue(t), b = Math.max(0, beat(t));
      g.fillStyle = '#050309'; g.fillRect(0, 0, W, H);
      const cols = 5, rows = 3, gap = 40, kw = (W - gap * (cols + 1)) / cols, kh = (H - gap * (rows + 1)) / rows;
      for (let i = 0; i < 15; i++) {
        const c = i % cols, r = Math.floor(i / cols), x = gap + c * (kw + gap), y = gap + r * (kh + gap);
        const lit = Math.exp(-((((b * 2 - (c + r * 2)) % 8) + 8) % 8) * 1.2);
        const col = hsl(h + c * 25 + r * 40, 100, 30 + 30 * lit);
        g.save(); g.shadowColor = hsl(h + c * 25, 100, 60); g.shadowBlur = 40 * lit;
        fillR(x, y, kw, kh, 40, col); g.restore();
        icon(KEYS[i], x + kw / 2, y + kh / 2, kh * .62, '#fff', 14);
      }
    },
  };

})();
