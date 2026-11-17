// Rhino's Gumball behaviours on every move / turn / scale gizmo of the Director (plan rev 3, P3, 17 Nov 2026), laid
// over the editors' own TransformControls (props, people, lights, room desks, pose joints) so each keeps its rules:
//   · a readout at the pointer while dragging: how far (in and mm), how much it turned (°), the size (%);
//   · type an exact value while dragging or just after (12, 12in, 30cm, 300mm, 2ft, 45°, 150%) and press Enter: the
//     move is redone to exactly that, from where the drag started, along the way it went (Esc drops the typing);
//   · Shift held: constrain a free or plane move to its main axis;
//   · Ctrl held: snapping inverted (5 cm, 15°, 10 %), whatever the editor's default;
//   · World / Object: setSpaceAll() turns every gizmo's frame (a desk's keeps its own: `fixedSpace`).
// parseLength / parseValue are pure (node tests).
const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, ft: 304.8, "'": 304.8 };
// A length typed by Vico, in mm (bare numbers are inches: the desk world is in inches), or null.
export function parseLength(text, bare = 'in') {
  const m = String(text).trim().toLowerCase().replace(/\s+/g, '').match(/^([+-]?\d*\.?\d+)(mm|cm|m|in|"|ft|')?$/);
  if (!m) return null; const v = Number(m[1]); return Number.isFinite(v) ? Math.round(v * UNITS[m[2] || bare] * 1e6) / 1e6 : null;
}
// A typed value for a mode: translate → mm, rotate → degrees, scale → factor; null when it does not parse.
export function parseValue(text, mode) {
  const t = String(text).trim().toLowerCase();
  if (mode === 'rotate') { const m = t.match(/^([+-]?\d*\.?\d+)(°|deg|d)?$/); return m ? Number(m[1]) : null; }
  if (mode === 'scale') { const m = t.match(/^([+-]?\d*\.?\d+)(%|x)?$/); if (!m) return null; const v = Number(m[1]); return m[2] === 'x' || (!m[2] && v <= 5) ? v : v / 100; }
  return parseLength(t);
}
// The component of a free / plane move that is kept with Shift: the main one (others zeroed). d: {x,y,z}.
export function constrain(d, axis) {
  if (!axis || axis.length === 1) return d;
  const keys = ['x', 'y', 'z'].filter(k => axis.toLowerCase().includes(k)), main = keys.sort((a, b) => Math.abs(d[b]) - Math.abs(d[a]))[0];
  return { x: main === 'x' ? d.x : 0, y: main === 'y' ? d.y : 0, z: main === 'z' ? d.z : 0 };
}
const fmtLen = mm => `${(mm / 25.4).toFixed(Math.abs(mm) < 254 ? 2 : 1)} in · ${Math.round(mm)} mm`;
const all = new Set();
export function setSpaceAll(space) { for (const g of all) if (!g.userData.fixedSpace) g.setSpace(space); }
export function spaceNow() { for (const g of all) if (!g.userData.fixedSpace) return g.space; return 'world'; }

// gizmo: a TransformControls; win: the stage window; THREE: its three.js; mmPerUnit(): mm per world unit;
// snap: { t: world units, r: degrees, s: factor } for Ctrl; ownSnap: the editor snaps by itself (Ctrl then inverts it
// through the editor's setSnap(bool)); status(text).
export function enhanceGizmo(gizmo, { win, THREE, mmPerUnit = () => 1000, snap = { t: .05, r: 15, s: .1 }, setSnap = null, status = () => {} }) {
  all.add(gizmo);
  const doc = win.document, tip = doc?.createElement?.('div') || { style: {}, remove() {} }; tip.className = 'gumball-tip';
  Object.assign(tip.style, { position: 'fixed', zIndex: 99999, pointerEvents: 'none', padding: '3px 7px', borderRadius: '6px', background: '#0b1118e6', border: '1px solid #ffffff22', color: '#e8eef4', font: '600 11px/1.3 system-ui,sans-serif', whiteSpace: 'nowrap', display: 'none' });
  doc?.body?.append?.(tip);
  let start = null, last = null, typed = '', px = 0, py = 0, ctrl = false, shift = false;
  const o = () => gizmo.object;
  const take = obj => ({ p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(), wp: obj.getWorldPosition(new THREE.Vector3()) });
  function readout() {
    const obj = o(); if (!obj || !start) return '';
    if (gizmo.mode === 'rotate') { const a = 2 * Math.acos(Math.min(1, Math.abs(start.q.clone().invert().multiply(obj.quaternion).w))); return `${(a * 180 / Math.PI).toFixed(1)}°`; }
    if (gizmo.mode === 'scale') return `${Math.round(obj.scale.x / (start.s.x || 1) * 100)} %`;
    const d = obj.getWorldPosition(new THREE.Vector3()).sub(start.wp), mm = d.length() * mmPerUnit();
    return fmtLen(mm) + (gizmo.axis && gizmo.axis.length === 1 ? ` (${gizmo.axis})` : '');
  }
  function show() {
    const text = readout(); if (!text && !typed) { tip.style.display = 'none'; return; }
    tip.textContent = typed ? `${text} → ${typed}▏ Enter` : text + (gizmo.dragging ? ' · type a value' : '');
    Object.assign(tip.style, { display: 'block', left: px + 14 + 'px', top: py + 14 + 'px' });
  }
  const applySnap = () => { const on = !!ctrl; if (setSnap) { setSnap(on); return; } gizmo.setTranslationSnap(on ? snap.t : null); gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(snap.r) : null); gizmo.setScaleSnap(on ? snap.s : null); };
  gizmo.addEventListener('dragging-changed', ev => {
    if (ev.value && !ev.gumball) { const obj = o(); start = obj ? take(obj) : null; typed = ''; }
    else if (!ev.value && !ev.gumball) { const obj = o(); if (obj && start) last = { obj, start, mode: gizmo.mode, axis: gizmo.axis, end: take(obj), until: performance.now() + 4000 }; start = null; setTimeout(() => { if (!typed) tip.style.display = 'none'; }, 900); }
  });
  gizmo.addEventListener('objectChange', () => {
    const obj = o(); if (!obj || !start || !gizmo.dragging) return;
    if (shift && gizmo.mode === 'translate' && gizmo.axis && gizmo.axis.length > 1) {
      const d = obj.position.clone().sub(start.p), c = constrain({ x: d.x, y: d.y, z: d.z }, gizmo.axis); obj.position.copy(start.p).add(new THREE.Vector3(c.x, c.y, c.z));
    }
    show();
  });
  // Redo the last drag to exactly `text`, from its start, as one more edit the editor commits (a synthetic drag).
  function apply(text) {
    const L = last; if (!L || L.obj !== o()) { status('Drag first, then type the exact value and press Enter.'); return false; }
    const v = parseValue(text, L.mode); if (v === null) { status(`“${text}” is not a value: try 12, 12in, 30cm, 45°, 150%.`); return false; }
    const obj = L.obj; gizmo.dispatchEvent({ type: 'dragging-changed', value: true, gumball: true });
    if (L.mode === 'translate') {
      const dir = L.end.p.clone().sub(L.start.p); if (dir.lengthSq() < 1e-12) { status('Drag a little in the direction you want, then type the distance.'); gizmo.dispatchEvent({ type: 'dragging-changed', value: false, gumball: true }); return false; }
      const unitsPerMm = 1 / mmPerUnit(), worldLen = L.end.wp.clone().sub(L.start.wp).length(), localLen = dir.length(), k = worldLen > 0 ? localLen / worldLen : 1;
      obj.position.copy(L.start.p).addScaledVector(dir.normalize(), v * unitsPerMm * k);
    } else if (L.mode === 'rotate') {
      const rel = L.start.q.clone().invert().multiply(L.end.q), axis = new THREE.Vector3(rel.x, rel.y, rel.z); if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0); axis.normalize(); if (rel.w < 0) axis.negate();
      obj.quaternion.copy(L.start.q).multiply(new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(v)));
    } else obj.scale.copy(L.start.s).multiplyScalar(v);
    obj.updateMatrixWorld(true); gizmo.dispatchEvent({ type: 'objectChange' }); gizmo.dispatchEvent({ type: 'dragging-changed', value: false, gumball: true });
    last = { ...L, end: take(obj), until: performance.now() + 4000 };
    status(L.mode === 'translate' ? `Moved exactly ${fmtLen(v)}.` : L.mode === 'rotate' ? `Turned exactly ${v}°.` : `Scaled to exactly ${Math.round(v * 100)} %.`);
    return true;
  }
  const typingOk = e => !e.target?.closest?.('input,textarea,select,[contenteditable]') && (gizmo.dragging || (last && performance.now() < last.until && last.obj === o()));
  const onKey = e => {
    if (e.key === 'Control' || e.key === 'Meta') { const on = e.type === 'keydown'; if (on !== ctrl) { ctrl = on; applySnap(); } }
    if (e.key === 'Shift') shift = e.type === 'keydown';
    if (e.type !== 'keydown' || !gizmo.enabled || !o()) return;
    if (typed && e.key === 'Escape') { typed = ''; e.preventDefault(); e.stopImmediatePropagation(); show(); return; }
    if (typed && e.key === 'Backspace') { typed = typed.slice(0, -1); e.preventDefault(); e.stopImmediatePropagation(); show(); return; }
    if (typed && e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); const t = typed; typed = ''; apply(t); tip.style.display = 'none'; return; }
    if (e.ctrlKey || e.altKey || e.metaKey || !typingOk(e)) return;
    if (/^[0-9.+\-]$/.test(e.key) || (typed && /^[a-z"'°%]$/i.test(e.key))) { typed += e.key; e.preventDefault(); e.stopImmediatePropagation(); show(); }
  };
  // (on the windows, capture: ahead of the Director's key dispatcher on the documents, so 1–8 and 0 type a value
  // during a drag and for 4 s after it, instead of jumping to a lane group or the film camera)
  const docs = [win, win.parent].filter((d, i, a) => d && a.indexOf(d) === i);
  for (const d of docs) { d.addEventListener?.('keydown', onKey, true); d.addEventListener?.('keyup', onKey, true); }
  win.addEventListener?.('blur', () => { if (ctrl) { ctrl = false; applySnap(); } shift = false; });
  gizmo.domElement?.addEventListener?.('pointermove', e => { px = e.clientX; py = e.clientY; if (gizmo.dragging) show(); });
  return { apply, typed: () => typed, dispose() { all.delete(gizmo); tip.remove(); for (const d of docs) { d.removeEventListener?.('keydown', onKey, true); d.removeEventListener?.('keyup', onKey, true); } } };
}
// mm per world unit on the stage: the room's root carries the scale from the room's millimetres to the scene.
export function mmPerUnitOf(win, THREE) { const r = win.ErgoFlex?.workspaceRoom?.root; if (!r?.getWorldScale) return 1000; const s = r.getWorldScale(new THREE.Vector3()).x; return s > 0 ? 1 / s : 1000; }
