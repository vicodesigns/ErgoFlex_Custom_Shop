// Cine cut · create (artist studio, Lin), Nov 14 2026 (Vico: "the digital painting goes by so quick ... start when the
// shot opens ... play up until the architecture stuff ... a 3D model of a home floating around ... both screens about
// architecture ... when it tilts down to the painting, natural landscapes"). Three acts in chapter time (offset 0):
//   act 1  0 .. A    digital painting: Lakeside dusk already under way (a quarter of the strokes laid) at frame 0, the
//                    last highlight ~0.4 s before A, then 'Saved'; the reference board full from frame 0
//   act 2  A .. B    architecture: left the floor plan of the drafting paper (House A, A-101), right the same house as a
//                    floating, turning 3D model; the room facing the viewer is lit on both
//   act 3  B .. end  oil painting: natural landscapes on both screens (the easel's meadow-edge painting: reeds, sunlit
//                    grass, blue sky), the painter's references
// opts: {A, B} the act boundaries (S3's create time ranges), name (Lin).
// Also: SCENES.cplan, the drafting paper itself (1600x1000 still, film texture target 'Architect floor plan').
(function () {
  const O = () => SHOT.clip.opts || {};
  const acts = () => { const o = O(); return {A: o.A ?? 7.0, B: o.B ?? 16.9, name: o.name || 'Lin'}; };
  const X = 0.35;   // crossfade between acts (s)

  // ---------------- the plan: the drafting kit's sheet (workspace-3d.mjs), relabelled as a home ----------------
  // Sheet px (1600x1000); the outline and the five rooms are the kit's own rectangles.
  const OUT = [220, 200, 1040, 540];
  const ROOMS = [
    {n: 'LIVING', r: [230, 210, 390, 250], col: '#e9c99a'},
    {n: 'BEDROOM', r: [230, 480, 390, 250], col: '#c9d8e6'},
    {n: 'KITCHEN · DINING', r: [640, 210, 610, 250], col: '#e6dcc4'},
    {n: 'BATH', r: [640, 480, 290, 250], col: '#cde3df'},
    {n: 'ENTRY', r: [950, 480, 300, 250], col: '#dcd2e6'},
  ];
  const DOOR = [640, 480, 80];
  // The house's name, sheet and roof colour: House A here; the chapter 12 architect desk (scenes/cine-herodesks.js) draws a
  // variant of it (House B) through SCENES._create.withHouse, and puts these defaults back afterwards.
  const HOUSE = {name: 'HOUSE A', sheet: 'A-101', stage: 'CONCEPT DESIGN', roof: '#8a5a44'};
  // metres: 100 px = 1 m (1:100), x right, z down the sheet, the house centred on the origin
  const M = 100, CX = OUT[0] + OUT[2] / 2, CZ = OUT[1] + OUT[3] / 2;
  const mx = px => (px - CX) / M, mz = pz => (pz - CZ) / M;
  const area = r => (r[2] / M * r[3] / M).toFixed(1);

  function drawPlanSheet(x, y, w, h, o = {}) {   // the paper, as the kit draws it (scaled to w x h)
    const k = w / 1600;
    g.save(); g.translate(x, y); g.scale(k, h / 1000);
    g.fillStyle = o.paper || '#f2eee3'; g.fillRect(0, 0, 1600, 1000);
    g.strokeStyle = o.grid || '#d6d9d4'; g.lineWidth = 1;
    for (let gx = 40; gx < 1600; gx += 40) { g.beginPath(); g.moveTo(gx, 40); g.lineTo(gx, 960); g.stroke(); }
    for (let gy = 40; gy < 1000; gy += 40) { g.beginPath(); g.moveTo(40, gy); g.lineTo(1560, gy); g.stroke(); }
    const ink = o.ink || '#355b68';
    if (o.hl != null) { const r = ROOMS[o.hl].r; g.fillStyle = hexA(o.hlCol || '#f2a33a', .28); g.fillRect(r[0], r[1], r[2], r[3]); }
    g.strokeStyle = ink; g.lineWidth = 8; g.strokeRect(...OUT);
    g.lineWidth = 5; ROOMS.forEach(({r}) => g.strokeRect(...r));
    g.lineWidth = 2; g.strokeRect(180, 160, 1120, 620);
    const L = o.big ? 1.9 : 1;
    g.fillStyle = ink;
    ROOMS.forEach(({n, r}) => { g.font = `600 ${24 * L}px Poppins`; g.fillText(n, r[0] + 24, r[1] + 44 * L); g.font = `500 ${20 * L}px Poppins`; g.fillText(area(r) + ' m²', r[0] + 24, r[1] + 78 * L); });
    g.lineWidth = 2; g.beginPath(); g.arc(DOOR[0], DOOR[1], DOOR[2], -Math.PI / 2, 0); g.stroke();
    g.beginPath(); g.arc(1180, 740, 60, Math.PI, Math.PI * 1.5); g.stroke();   // the front door, into the entry
    g.font = '500 22px monospace'; g.fillText('N ↑', 1390, 160);
    g.fillText(HOUSE.name + '  /  FLOOR PLAN', 110, 875); g.fillText(HOUSE.sheet + '   ·   1:100   ·   ' + HOUSE.stage, 110, 925);
    g.restore();
  }
  SCENES.cplan = {draw() { drawPlanSheet(0, 0, W, H); }};

  // ---------------- the 3D house ----------------
  const WH = 2.7, T_EXT = .16, T_INT = .1;
  function walls() {   // unique wall segments from the room rectangles: [x0, z0, x1, z1, exterior]
    const segs = [], key = s => s.map(v => v.toFixed(2)).join(',');
    const seen = new Set();
    const add = (x0, z0, x1, z1) => { const s = x0 < x1 || z0 < z1 ? [x0, z0, x1, z1] : [x1, z1, x0, z0], k = key(s); if (!seen.has(k)) { seen.add(k); segs.push(s); } };
    const ox0 = mx(OUT[0]), oz0 = mz(OUT[1]), ox1 = mx(OUT[0] + OUT[2]), oz1 = mz(OUT[1] + OUT[3]);
    add(ox0, oz0, ox1, oz0); add(ox0, oz1, ox1, oz1); add(ox0, oz0, ox0, oz1); add(ox1, oz0, ox1, oz1);
    add(mx(630), oz0, mx(630), oz1); add(ox0, mz(470), ox1, mz(470)); add(mx(940), mz(470), mx(940), oz1);
    return segs.map(s => [...s, Math.abs(s[1] - s[3]) < 1e-6 ? (Math.abs(s[1] - oz0) < 1e-6 || Math.abs(s[1] - oz1) < 1e-6) : (Math.abs(s[0] - ox0) < 1e-6 || Math.abs(s[0] - ox1) < 1e-6)]);
  }
  const WALLS = walls();
  function houseFaces(t, build, roofLift, roofA, hl) {
    const F = [], hW = WH * build;
    const ox0 = mx(OUT[0]) - .25, oz0 = mz(OUT[1]) - .25, ox1 = mx(OUT[0] + OUT[2]) + .25, oz1 = mz(OUT[1] + OUT[3]) + .25;
    F.push(...box3(ox0, -.25, oz0, ox1, 0, oz1, '#d9d4c8', {edge: 'rgba(40,50,60,.35)', lw: 1.5}));   // the slab
    ROOMS.forEach(({r, col}, i) => {   // room floors, the lit one brighter
      const x0 = mx(r[0]), z0 = mz(r[1]), x1 = mx(r[0] + r[2]), z1 = mz(r[1] + r[3]);
      F.push({p: [[x0, .01, z0], [x0, .01, z1], [x1, .01, z1], [x1, .01, z0]], col: i === hl ? '#ffbf5c' : col, flat: true, two: true, bias: .4, glow: i === hl ? 'rgba(255,170,60,.6)' : null});
    });
    if (hW > .02) for (const [x0, z0, x1, z1, ext] of WALLS) {
      const th = (ext ? T_EXT : T_INT) / 2, horiz = Math.abs(z0 - z1) < 1e-6;
      const bx0 = horiz ? x0 - th : x0 - th, bx1 = horiz ? x1 + th : x0 + th, bz0 = horiz ? z0 - th : z0 - th, bz1 = horiz ? z0 + th : z1 + th;
      F.push(...box3(bx0, 0, bz0, bx1, hW, bz1, ext ? '#f4f1ea' : '#e7e3da', {edge: 'rgba(30,40,55,.45)', lw: 1.6}));
      if (ext && build > .98) {   // windows on the long exterior walls
        const L = horiz ? x1 - x0 : z1 - z0, n = Math.max(1, Math.floor(L / 2.6));
        for (let k = 0; k < n; k++) {
          const c = (k + .5) / n, ww = .9, y0 = .9, y1 = 2.1, out = horiz ? (z0 < 0 ? -th - .01 : th + .01) : (x0 < 0 ? -th - .01 : th + .01);
          if (horiz) { const cx = x0 + L * c, zz = z0 + out; F.push({p: z0 < 0 ? [[cx + ww / 2, y0, zz], [cx - ww / 2, y0, zz], [cx - ww / 2, y1, zz], [cx + ww / 2, y1, zz]] : [[cx - ww / 2, y0, zz], [cx + ww / 2, y0, zz], [cx + ww / 2, y1, zz], [cx - ww / 2, y1, zz]], col: '#6fa8d8', flat: true, two: true, bias: -.05, edge: 'rgba(255,255,255,.6)', lw: 1.5}); }
          else { const cz = z0 + L * c, xx = x0 + out; F.push({p: x0 < 0 ? [[xx, y0, cz - ww / 2], [xx, y0, cz + ww / 2], [xx, y1, cz + ww / 2], [xx, y1, cz - ww / 2]] : [[xx, y0, cz + ww / 2], [xx, y0, cz - ww / 2], [xx, y1, cz - ww / 2], [xx, y1, cz + ww / 2]], col: '#6fa8d8', flat: true, two: true, bias: -.05, edge: 'rgba(255,255,255,.6)', lw: 1.5}); }
        }
      }
    }
    if (roofA > .01) {   // a gable roof along x, hovering roofLift above the walls (an architect's exploded model)
      const y0 = WH + roofLift, yr = y0 + 1.7, zc = (oz0 + oz1) / 2, col = HOUSE.roof, o = {a: roofA, two: true, edge: 'rgba(255,230,210,.35)', lw: 1.5};
      F.push({p: [[ox0, y0, oz0], [ox1, y0, oz0], [ox1, yr, zc], [ox0, yr, zc]].reverse(), col, ...o});   // north slope
      F.push({p: [[ox0, y0, oz1], [ox0, yr, zc], [ox1, yr, zc], [ox1, y0, oz1]].reverse(), col, ...o});   // south slope
      F.push({p: [[ox0, y0, oz0], [ox0, yr, zc], [ox0, y0, oz1]], col: '#efe9df', ...o});   // gables
      F.push({p: [[ox1, y0, oz1], [ox1, yr, zc], [ox1, y0, oz0]], col: '#efe9df', ...o});
    }
    return F;
  }
  // The room that faces the viewer most at this yaw: the left plan lights the same one.
  const yawAt = (t, A, B) => -32 + 300 * eio(seg(t, A + .2, B + .3)) * .92 + 18 * seg(t, A, B);
  function facing(yaw) {
    const a = yaw * Math.PI / 180, vx = Math.sin(a), vz = -Math.cos(a);   // the camera's direction from the house (world)
    let best = 0, bd = -1e9;
    ROOMS.forEach(({r}, i) => { const cx = mx(r[0] + r[2] / 2), cz = mz(r[1] + r[3] / 2), d = -(cx * vx + cz * vz) / Math.hypot(cx, cz); if (d > bd) { bd = d; best = i; } });
    return best;
  }
  function houseView(t, x, y, w, h, A, B, hl) {
    const local = t - A, build = eo(seg(local, .15, 1.4)), roofDrop = eo(seg(local, .9, 2.0));
    const sect = win(t, A + (B - A) * .5, A + (B - A) * .8, .8);   // the roof lifts away to show the rooms
    const roofLift = lerp(3.2, .55, roofDrop) + 2.4 * sect, roofA = roofDrop * (1 - .75 * sect);
    const yaw = yawAt(t, A, B), bob = Math.sin(t * 1.1) * .12;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    // blueprint floor grid in perspective under the model and its soft shadow
    const cam = {target: [0, 1.3 - bob, 0], yaw, pitch: 27, dist: 21, fov: 32, cx: x + w / 2, cy: y + h * .52};
    const {proj} = cam3d({...cam, target: [0, 1.3, 0]});
    g.strokeStyle = 'rgba(120,170,230,0.10)'; g.lineWidth = 1.5;
    for (let k = -10; k <= 10; k++) { const a = proj([k, -1.6, -10]), b = proj([k, -1.6, 10]); poly([[a[0], a[1]], [b[0], b[1]]], 'rgba(120,170,230,0.10)', 1.5); const c = proj([-10, -1.6, k]), d = proj([10, -1.6, k]); poly([[c[0], c[1]], [d[0], d[1]]], 'rgba(120,170,230,0.10)', 1.5); }
    const sh = proj([0, -1.6, 0]);
    g.fillStyle = rad(sh[0], sh[1], w * .28, [[0, `rgba(0,0,0,${.45 - bob})`], [1, 'rgba(0,0,0,0)']]); g.save(); g.translate(sh[0], sh[1]); g.scale(1, .32); g.translate(-sh[0], -sh[1]); g.beginPath(); g.arc(sh[0], sh[1], w * .28, 0, Math.PI * 2); g.fill(); g.restore();
    mesh3d(houseFaces(t, build, roofLift, roofA, hl), cam, {light: [-.5, .85, -.35]});
    // the lit room's label floats over it
    const r = ROOMS[hl].r, lp = cam3d(cam).proj([mx(r[0] + r[2] / 2), WH * build + .4, mz(r[1] + r[3] / 2)]);
    alpha(build * (.55 + .45 * sect), () => { pill(lp[0], lp[1] - 30, ROOMS[hl].n + '  ' + area(r) + ' m²', 26, {a: 'center', bg: 'rgba(10,16,28,0.8)', c: '#ffcf8a', dot: '#ffb24a'}); });
    g.restore();
  }

  // ---------------- landscapes (act 3): painterly meadows, cached once ----------------
  const CACHE = {};
  function meadow(key, w, h, o) {
    if (CACHE[key]) return CACHE[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d'), R = rng(o.seed);
    const sky = q.createLinearGradient(0, 0, 0, h * o.hz); sky.addColorStop(0, '#1d4fb8'); sky.addColorStop(.7, '#5b95e0'); sky.addColorStop(1, '#a9cdee');
    q.fillStyle = sky; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { q.fillStyle = `rgba(255,255,255,${.12 + .2 * R()})`; q.beginPath(); q.ellipse(w * R(), h * o.hz * (.15 + .5 * R()), w * (.06 + .1 * R()), h * .025, 0, 0, Math.PI * 2); q.fill(); }
    const hills = [['#3f7a3a', .0], ['#2f6a34', .06], ['#4f8f2c', .12]];
    hills.forEach(([col, off], L) => { q.beginPath(); q.moveTo(0, h); for (let i = 0; i <= 60; i++) { const x = w * i / 60; q.lineTo(x, h * (o.hz + off) - h * .06 * fbm(i * .09 + L * 7 + o.seed)); } q.lineTo(w, h); q.closePath(); q.fillStyle = col; q.fill(); });
    const field = q.createLinearGradient(0, h * o.hz, 0, h); field.addColorStop(0, '#9ccc3a'); field.addColorStop(.5, '#6aa82a'); field.addColorStop(1, '#2f5a1e');
    q.fillStyle = field; q.fillRect(0, h * (o.hz + .14), w, h);
    if (o.creek) { q.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, x = w * (.5 + .28 * Math.sin(u * 3.2 + 1) * u), y = h * (o.hz + .14) + (h * (1 - o.hz - .14)) * u, ww = w * (.02 + .3 * u * u); i ? q.lineTo(x - ww, y) : q.moveTo(x - ww, y); } for (let i = 40; i >= 0; i--) { const u = i / 40, x = w * (.5 + .28 * Math.sin(u * 3.2 + 1) * u), y = h * (o.hz + .14) + (h * (1 - o.hz - .14)) * u, ww = w * (.02 + .3 * u * u); q.lineTo(x + ww, y); } q.closePath(); const wg = q.createLinearGradient(0, h * o.hz, 0, h); wg.addColorStop(0, '#9fc6ee'); wg.addColorStop(1, '#2b5f9a'); q.fillStyle = wg; q.fill(); }
    // sunlit dabs over the field
    for (let i = 0; i < o.dabs; i++) { const x = w * R(), y = h * (o.hz + .14 + R() * (1 - o.hz - .14)); q.fillStyle = ['#d8e84a', '#b9d63a', '#f0e070', '#3f7a2a', '#7fb83a'][Math.floor(R() * 5)]; q.globalAlpha = .55; q.beginPath(); q.ellipse(x, y, 8 + 22 * R(), 3 + 6 * R(), (R() - .5) * .4, 0, Math.PI * 2); q.fill(); }
    q.globalAlpha = 1;
    // reeds and grasses: long curved strokes, foreground heavy (the easel painting's language)
    for (let i = 0; i < o.reeds; i++) {
      const u = Math.pow(R(), .45), base = h * (.78 + .26 * u), x = w * R(), len = h * (.05 + .3 * u * u * (.4 + .6 * R())), bend = (R() - .5) * w * .08;
      const col = ['#2f8a2a', '#59b23a', '#c9b45a', '#e0c070', '#8a5a2a', '#b8452e', '#1f5a24', '#a6d24a'][Math.floor(R() * 8)];
      q.strokeStyle = col; q.lineWidth = 2 + 7 * u * R(); q.lineCap = 'round'; q.globalAlpha = .55 + .45 * u;
      q.beginPath(); q.moveTo(x, base); q.quadraticCurveTo(x + bend * .3, base - len * .6, x + bend, base - len); q.stroke();
      if (R() < .25) { q.strokeStyle = '#f2e3a0'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(x + 2, base); q.quadraticCurveTo(x + bend * .3 + 2, base - len * .6, x + bend + 2, base - len); q.stroke(); }
    }
    q.globalAlpha = 1;
    if (o.tree) { q.fillStyle = '#3a2a1c'; q.fillRect(w * .72, h * .3, w * .025, h * .3); for (let i = 0; i < 26; i++) { q.fillStyle = ['#2f6a2a', '#3f8a32', '#5aa63a'][i % 3]; q.beginPath(); q.arc(w * (.73 + (R() - .5) * .22), h * (.28 + (R() - .5) * .16), w * (.03 + .04 * R()), 0, Math.PI * 2); q.fill(); } }
    return (CACHE[key] = c);
  }
  function landscape(c, x, y, w, h, t, t0) {
    const z = 1.04 + .05 * seg(t, t0, t0 + 8), dx = (t - t0) * 6;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const s = Math.max(w / c.width, h / c.height) * z;
    g.drawImage(c, x + w / 2 - c.width * s / 2 - dx, y + h / 2 - c.height * s / 2, c.width * s, c.height * s);
    g.restore();
  }

  // ---------------- right monitor (landscape 1920x1120) ----------------
  SCENES.c03l = {
    draw(t) {
      const {A, B, name} = acts(), P = SCENES._ch03, p = pose(t);
      g.fillStyle = '#15161a'; g.fillRect(0, 0, W, H);
      const a1 = 1 - sm(seg(t, A - X / 2, A + X / 2)), a3 = sm(seg(t, B - X / 2, B + X / 2)), a2 = 1 - a1 - a3;
      // act 1: the painting app
      alpha(a1, () => {
        g.fillStyle = '#0e0f12'; g.fillRect(0, 0, W, 84);
        fillR(26, 20, 44, 44, 12, lin(0, 20, 0, 64, [[0, C.pink], [1, C.orange]])); icon('brush', 48, 42, 34, '#fff', 4);
        T('Canvas', 88, 56, 34, {w: 700}); T(`Lakeside dusk.psd · ${name}`, 240, 56, 30, {w: 500, c: C.dim});
        pill(W - 30, 18, `Surface ${Math.round(p.tilt)}°`, 30, {a: 'right', dot: C.violet, bg: hexA(C.violet, .2), c: '#d9ccff'});
        fillR(0, 84, 110, H - 84, 0, '#0e0f12');
        ['brush', 'drop', 'layers', 'search', 'plus'].forEach((n, i) => { const yy = 160 + i * 110, on = i === 0; if (on) fillR(18, yy - 37, 74, 74, 20, hexA(C.pink, .3)); icon(n, 55, yy, 46, on ? '#fff' : C.dim, 4); });
        const cx = 150, cy = 120, cw = W - 150 - 420, ch = H - 160;
        g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; fillR(cx, cy, cw, ch, 8, '#efe6d6'); g.restore();
        // pacing: a quarter laid at frame 0, the last stroke done 0.4 s before act 2
        const N = P.STROKES.length, N0 = Math.floor(N * .25), end = Math.max(1, A - .4), per = end / (N - N0 + 1.4);
        let tip = null, cur = null, done = 0;
        clip(cx, cy, cw, ch, 8, () => {
          for (let i = 0; i < N; i++) {
            const ts = i < N0 ? -10 : (i - N0) * per; if (t < ts) break;
            const f = clamp((t - ts) / (per * 1.4)); const tp = P.strokePath(P.STROKES[i], cx, cy, cw, ch, eio(f));
            if (f < 1) { tip = tp; cur = P.STROKES[i]; } done = i;
          }
        });
        if (tip) P.cursorBrush(tip[0], tip[1], cur.w * cw, t);
        const rx = W - 390, rw = 360;
        card(rx, 120, rw, 300, {r: 28, top: '#1c1d22', bot: '#18191d'});
        T('Brush', rx + 30, 180, 34, {w: 700});
        circle(rx + 90, 290, 60, cur ? cur.col : '#ffd59a'); ringStroke(rx + 90, 290, 66, 'rgba(255,255,255,.4)', 3);
        T(cur ? `${Math.round(cur.w * cw)} px` : '24 px', rx + 180, 280, 40, {w: 700}); T('Oil · soft', rx + 180, 326, 30, {w: 500, c: C.dim});
        card(rx, 450, rw, H - 490, {r: 28, top: '#1c1d22', bot: '#18191d'});
        T('Layers', rx + 30, 510, 34, {w: 700});
        const layers = [['Highlights', 240], ['Trees', 190], ['Water', 150], ['Hills', 100], ['Mountains', 70], ['Sky', 0]];
        layers.forEach(([n, at0], i) => {
          const yy = 550 + i * 82, on = done >= at0 && (i === 0 || done < layers[i - 1][1]);
          if (on) fillR(rx + 14, yy, rw - 28, 70, 14, hexA(C.pink, .25));
          fillR(rx + 30, yy + 10, 50, 50, 8, done >= at0 ? P.PAL[i] : '#2a2b30');
          T(n, rx + 100, yy + 46, 32, {w: on ? 700 : 500, c: done >= at0 ? C.text : C.faint});
        });
        toast(t, A - .4, 1.2, cx + 40, cy + 30, 640, 'Saved · Lakeside dusk', `${name} · 6 layers`, {col: C.green, icon: 'check', h: 130, ts: 44, ss: 28});
      });
      // act 2: the model viewer
      alpha(a2, () => {
        g.fillStyle = lin(0, 0, 0, H, [[0, '#0b1424'], [1, '#05080f']]); g.fillRect(0, 0, W, H);
        g.fillStyle = '#0a1120'; g.fillRect(0, 0, W, 84);
        fillR(26, 20, 44, 44, 12, lin(0, 20, 0, 64, [[0, C.cyan], [1, C.blue]])); icon('layers', 48, 42, 30, '#fff', 4);
        T('Model', 88, 56, 34, {w: 700}); T(`House A · ${name}`, 210, 56, 30, {w: 500, c: C.dim});
        pill(W - 30, 18, 'Synced with A-101', 30, {a: 'right', dot: C.teal, bg: hexA(C.teal, .16), c: C.teal});
        pill(W - 400, 18, `Surface ${Math.round(p.tilt)}°`, 30, {a: 'right', dot: C.violet, bg: hexA(C.violet, .2), c: '#d9ccff'});
        const yaw = yawAt(t, A, B), hl = facing(yaw);
        houseView(t, 110, 84, W - 110, H - 84, A, B, hl);
        fillR(0, 84, 110, H - 84, 0, '#0a1120');
        ['home', 'layers', 'search', 'gear'].forEach((n, i) => { const yy = 160 + i * 110, on = i === 0; if (on) fillR(18, yy - 37, 74, 74, 20, hexA(C.cyan, .25)); icon(n, 55, yy, 44, on ? '#fff' : C.dim, 4); });
        T(`${((OUT[2] / M) * (OUT[3] / M)).toFixed(0)} m²  ·  5 rooms  ·  1 level`, 150, H - 40, 32, {w: 600, c: C.soft});
        T(`Orbit ${Math.round(((yaw % 360) + 360) % 360)}°`, W - 40, H - 40, 32, {w: 600, a: 'right', c: C.dim});
      });
      // act 3: the reference
      alpha(a3, () => {
        landscape(meadow('wide', 1920, 1120, {seed: 7, hz: .34, reeds: 320, dabs: 900, tree: true}), 0, 0, W, H, t, B);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H);
        fillR(30, 26, 760, 76, 38, 'rgba(10,12,16,0.62)');
        T('Reference · Meadow edge, late afternoon', 64, 76, 32, {w: 600});
        const sw = ['#1d4fb8', '#a9cdee', '#9ccc3a', '#2f6a34', '#e0c070', '#b8452e'];
        fillR(W - 30 - 6 * 70 - 20, 26, 6 * 70 + 20, 76, 38, 'rgba(10,12,16,0.62)');
        sw.forEach((c, i) => circle(W - 30 - 6 * 70 + 25 + i * 70, 64, 24, c));
      });
    },
  };

  SCENES._create = {houseView, drawPlanSheet, ROOMS, OUT, M, area, yawAt, facing,
    withHouse(v, fn) { const keep = {...HOUSE}; Object.assign(HOUSE, v); try { fn(); } finally { Object.assign(HOUSE, keep); } }};

  // ---------------- left monitor (portrait 1080x1856) ----------------
  SCENES.c03p = {
    draw(t) {
      const {A, B, name} = acts();
      g.fillStyle = '#121317'; g.fillRect(0, 0, W, H);
      const a1 = 1 - sm(seg(t, A - X / 2, A + X / 2)), a3 = sm(seg(t, B - X / 2, B + X / 2)), a2 = 1 - a1 - a3;
      alpha(a1, () => {   // the reference board, full from frame 0
        T('Reference', 60, 130, 76, {w: 700});
        T(`Lakeside dusk · 4 pins · ${name}`, 64, 190, 36, {w: 500, c: C.dim});
        [[0, 0, 0, 560, 400], [1, 580, 0, 440, 400], [5, 0, 420, 440, 340], [4, 460, 420, 560, 340]].forEach(([k, x, y, w, h], i) => {
          const kx = 30 + x, ky = 240 + y;
          g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 26; fillR(kx, ky, w, h, 22, '#000'); g.restore();
          clip(kx, ky, w, h, 22, () => footage(k, kx, ky, w, h, t, {zoom: 1.05 + .03 * Math.sin(t * .3 + i)}));
          circle(kx + w / 2, ky + 18, 12, C.coral);
        });
        const PAL = SCENES._ch03.PAL, py = 1060, pick = Math.floor(t / 1.2) % PAL.length;
        T('Palette', 60, py, 60, {w: 700});
        PAL.forEach((c, i) => { const x = 200 + (i % 3) * 340, y = py + 130 + Math.floor(i / 3) * 168, on = i === pick, k = on ? 1 + .1 * back(seg(t % 1.2, 0, .3)) : 1; at(x, y, k, () => { circle(0, 0, 70, c); if (on) ringStroke(0, 0, 86, '#fff', 8); }); });
        const c = PAL[pick];
        fillR(60, H - 190, W - 120, 130, 65, 'rgba(255,255,255,0.06)'); circle(130, H - 125, 44, c); icon('drop', 130, H - 125, 44, 'rgba(0,0,0,.4)');
        T(c.toUpperCase(), 200, H - 110, 56, {w: 700}); T('picked from reference', W - 100, H - 112, 34, {w: 500, a: 'right', c: C.dim});
      });
      alpha(a2, () => {   // the floor plan, the same room lit as on the model
        backdrop(t, {top: '#0c1a33', bot: '#060b16', blobs: [[C.blue, .12]]});
        T('Floor plan', 60, 130, 76, {w: 700});
        T(`House A · Level 1 · ${name}`, 64, 190, 36, {w: 500, c: C.dim});
        const yaw = yawAt(t, A, B), hl = facing(yaw), k = eo(seg(t, A, A + .8));
        const pw = W - 60, ph = pw * 1000 / 1600, px = 30, py = 260;
        g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30; fillR(px, py, pw, ph, 18, '#f2eee3'); g.restore();
        clip(px, py, pw, ph, 18, () => drawPlanSheet(px, py, pw, ph, {hl, big: true}));
        // the model's view on the plan: a cone from the viewer toward the house
        const s = pw / 1600, hx = px + CX * s, hz = py + CZ * s, a = yaw * Math.PI / 180, vx = Math.sin(a), vz = -Math.cos(a);
        alpha(.85 * k, () => { const ex = hx + vx * 460 * s, ez = hz + vz * 460 * s; g.fillStyle = hexA(C.blue, .18); g.beginPath(); g.moveTo(ex, ez); g.lineTo(hx + (vx * Math.cos(.5) - vz * Math.sin(.5)) * 120 * s, hz + (vz * Math.cos(.5) + vx * Math.sin(.5)) * 120 * s); g.lineTo(hx + (vx * Math.cos(-.5) - vz * Math.sin(-.5)) * 120 * s, hz + (vz * Math.cos(-.5) + vx * Math.sin(-.5)) * 120 * s); g.closePath(); g.fill(); circle(ex, ez, 14, C.blue); });
        // dimension lines draw in
        const d = eo(seg(t, A + .6, A + 3)), y0 = py + ph + 40;
        poly([[px + 220 * s, y0], [px + (220 + 1040 * d) * s, y0]], C.blue2, 4); T(`${(OUT[2] / M * d).toFixed(1)} m`, px + 730 * s, y0 + 50, 34, {w: 700, a: 'center', c: C.blue2});
        // room schedule
        card(30, py + ph + 120, W - 60, 760, {r: 36});
        T('Rooms', 80, py + ph + 200, 48, {w: 700}); T('m²', W - 80, py + ph + 200, 36, {w: 600, a: 'right', c: C.dim});
        ROOMS.forEach(({n, r, col}, i) => { const y = py + ph + 290 + i * 112, on = i === hl; if (on) fillR(50, y - 62, W - 100, 96, 24, hexA('#f2a33a', .22)); fillR(80, y - 40, 52, 52, 12, on ? '#ffbf5c' : col); T(n, 160, y, 42, {w: on ? 700 : 500, c: on ? C.text : C.soft}); T(area(r), W - 80, y, 42, {w: 700, a: 'right', c: on ? '#ffcf8a' : C.soft}); });
      });
      alpha(a3, () => {   // a second natural reference, vertical
        landscape(meadow('tall', 1080, 1856, {seed: 21, hz: .3, reeds: 380, dabs: 1000, creek: true}), 0, 0, W, H, t, B);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H);
        fillR(30, 30, W - 60, 120, 40, 'rgba(10,12,16,0.62)');
        T('Creek through the reeds', 70, 104, 44, {w: 700}); T(`${name} · 2 pins`, W - 70, 104, 34, {w: 500, a: 'right', c: C.soft});
      });
    },
  };
})();
