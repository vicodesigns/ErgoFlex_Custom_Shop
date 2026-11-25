// Chapter 12 (hero) desk screens, polish1124 Stream D (Vico, Nov 24 2026: the artist and architect desks' screens had no content).
//   artist portrait  scene 'c03p' (cine-create.js) held in act 1: Lin's reference board and palette (clips.mjs opts A, B past the clip)
//   artist wide      scene 'c03l' held in act 1: the Lakeside dusk canvas being painted, brush and layers windows
//   architect wide   SCENES.hdarch (here): 'House B', a variant of the Create chapter's House A (slate roof, sheet B-101): the turning
//                    3D model on the left, the floor plan and a properties panel on the right. opts: {name}
(function () {
  const O = () => SHOT.clip.opts || {};
  const VARIANT = {name: 'HOUSE B', sheet: 'B-101', stage: 'DESIGN DEVELOPMENT', roof: '#4d5a66'};
  SCENES.hdarch = {
    draw(t) {
      const K = SCENES._create, name = O().name || 'Studio', A = -12, B = 60;   // fully built, roof on, a slow orbit through the hold
      K.withHouse(VARIANT, () => {
        g.fillStyle = lin(0, 0, 0, H, [[0, '#0b1424'], [1, '#05080f']]); g.fillRect(0, 0, W, H);
        g.fillStyle = '#0a1120'; g.fillRect(0, 0, W, 84);
        fillR(26, 20, 44, 44, 12, lin(0, 20, 0, 64, [[0, C.cyan], [1, C.blue]])); icon('layers', 48, 42, 30, '#fff', 4);
        T('Model', 88, 56, 34, {w: 700}); T(`House B · ${name}`, 210, 56, 30, {w: 500, c: C.dim});
        pill(W - 30, 18, 'Synced with B-101', 30, {a: 'right', dot: C.teal, bg: hexA(C.teal, .16), c: C.teal});
        const split = Math.round(W * .58), yaw = K.yawAt(t, A, B), hl = K.facing(yaw);
        K.houseView(t, 110, 84, split - 110, H - 84, A, B, hl);
        fillR(0, 84, 110, H - 84, 0, '#0a1120');
        ['home', 'layers', 'search', 'gear'].forEach((n, i) => { const yy = 160 + i * 110, on = i === 0; if (on) fillR(18, yy - 37, 74, 74, 20, hexA(C.cyan, .25)); icon(n, 55, yy, 44, on ? '#fff' : C.dim, 4); });
        T(`Orbit ${Math.round(((yaw % 360) + 360) % 360)}°`, split - 30, H - 40, 30, {w: 600, a: 'right', c: C.dim});
        // right column: the floor plan sheet, then the properties
        const px = split + 30, pw = W - px - 30, ph = 440, sw = Math.round(ph * 1600 / 1000), sx = px + Math.round((pw - sw) / 2);
        card(px - 10, 104, pw + 20, ph + 90, {r: 26, top: '#121b2c', bot: '#0e1522'});
        T('Floor plan · Level 1', px + 20, 152, 32, {w: 700});
        g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 20; fillR(sx, 176, sw, ph, 14, '#f2eee3'); g.restore();
        clip(sx, 176, sw, ph, 14, () => K.drawPlanSheet(sx, 176, sw, ph, {hl}));
        const qy = 176 + ph + 40;
        card(px - 10, qy, pw + 20, H - qy - 24, {r: 26, top: '#121b2c', bot: '#0e1522'});
        T('Properties', px + 20, qy + 52, 32, {w: 700});
        const gross = (K.OUT[2] / K.M * K.OUT[3] / K.M).toFixed(0), room = K.ROOMS[hl];
        const rows = [['Gross area', gross + ' m²'], ['Rooms', K.ROOMS.length + ' · 1 level'], ['Roof', 'Gable 35° · slate'], ['Selected', room.n.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()) + ' · ' + K.area(room.r) + ' m²'], ['Status', 'Design development']];
        rows.forEach(([k, v], i) => { const y = qy + 100 + i * 50; if (y > H - 40) return; T(k, px + 20, y, 27, {w: 500, c: C.dim}); T(v, px + pw - 10, y, 27, {w: 600, a: 'right', c: i === 3 ? '#ffcf8a' : C.text}); });
      });
    },
  };
})();
