// Rhino's Gumball behaviours on every move / turn / scale gizmo of both Director and Studio (plan rev 3, P3):
//   · click any handle (Move arrow X/Y/Z, Rotate arc X/Y/Z/E, Scale cube X/Y/Z/XYZ) to open a Rhino-style inline
//     numeric box right at the handle — default unit is inches (accepts 2.5, -1 1/2, 3/4", 50mm, 5cm, 1ft, 90°,
//     -1 / -100% to mirror/invert, 150%) and press Enter to apply as one undoable edit (Esc cancels);
//   · a live readout at the pointer while dragging: how far (in and mm), how much it turned (°), the active-axis size
//     (%, flagging flipped/mirrored axes);
//   · type an exact value while dragging or just after and press Enter to redo the last drag to that exact amount;
//   · Shift held: constrain a free or plane move to its main axis;
//   · Ctrl held: snapping inverted (5 cm, 15°, 10 %), whatever the editor's default;
//   · World / Object: setSpaceAll() turns every gizmo's frame (a desk's keeps its own: `fixedSpace`).
// parseLength / parseValue / clickableHandle / applyAxisTransform / constrain are pure (node tests).
const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, ft: 304.8, "'": 304.8 };
const AXIS_COLORS = { X: '#ff5c5c', Y: '#52e078', Z: '#5aa8ff', XYZ: '#63d8f5', E: '#63d8f5' };

// Parse a decimal or fraction expression (e.g. "2.5", "2 1/2", "2-1/2", "-3/4", ".5") into a signed number, or null.
function parseNumberOrFraction(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^([+-]?)\s*(\d+)\s*(?:[\s-]+)\s*(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const den = Number(m[4]); if (!den) return null;
    const mag = Number(m[2]) + Number(m[3]) / den;
    return m[1] === '-' ? -mag : mag;
  }
  m = s.match(/^([+-]?)\s*(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const den = Number(m[3]); if (!den) return null;
    const mag = Number(m[2]) / den;
    return m[1] === '-' ? -mag : mag;
  }
  m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))$/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

// A length typed by Vico, in mm (bare numbers and fractions are inches: the desk world is in inches), or null.
export function parseLength(text, bare = 'in') {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s) return null;
  // Compound feet + inches, e.g. 1' 6", -2' 3 1/2", 1ft 2in
  const ftIn = s.match(/^([+-]?)\s*(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(.+?)\s*(?:"|in)?$/);
  if (ftIn && ftIn[3].trim()) {
    const inches = parseNumberOrFraction(ftIn[3]);
    if (inches === null || inches < 0) return null;
    const totalMm = Number(ftIn[2]) * 304.8 + inches * 25.4;
    const signed = ftIn[1] === '-' ? -totalMm : totalMm;
    return Number.isFinite(signed) ? Math.round(signed * 1e6) / 1e6 : null;
  }
  const m = s.match(/^(.+?)\s*(mm|cm|m|in|"|ft|')?$/);
  if (!m) return null;
  const v = parseNumberOrFraction(m[1]);
  if (v === null) return null;
  const unit = UNITS[m[2] || bare];
  if (!unit) return null;
  return Math.round(v * unit * 1e6) / 1e6;
}

// A typed value for a mode: translate → mm, rotate → degrees, scale → signed non-zero factor; null when invalid.
export function parseValue(text, mode) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  if (mode === 'rotate') {
    const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*(°|deg|d)?$/);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : null;
  }
  if (mode === 'scale') {
    const stripped = t.replace(/^[×x]\s*/, '');
    const m = stripped.match(/^(.+?)\s*(%|x|×)?$/);
    if (!m) return null;
    const v = parseNumberOrFraction(m[1]);
    if (v === null) return null;
    const factor = m[2] === '%' ? v / 100 : (m[2] === 'x' || m[2] === '×' || Math.abs(v) <= 5) ? v : v / 100;
    return Math.abs(factor) >= 1e-6 ? Math.round(factor * 1e6) / 1e6 : null;
  }
  return parseLength(t, 'in');
}

// Handles that open Rhino's click-to-type numeric box (explicit directional arrows, rotate rings, scale cubes).
export function clickableHandle(mode, axis) {
  if (!axis) return false;
  if (mode === 'translate') return axis === 'X' || axis === 'Y' || axis === 'Z';
  if (mode === 'rotate') return axis === 'X' || axis === 'Y' || axis === 'Z' || axis === 'E';
  if (mode === 'scale') return axis === 'X' || axis === 'Y' || axis === 'Z' || axis === 'XYZ';
  return false;
}

// The component of a free / plane move that is kept with Shift: the main one (others zeroed). d: {x,y,z}.
export function constrain(d, axis) {
  if (!axis || axis.length === 1) return d;
  const keys = ['x', 'y', 'z'].filter(k => axis.toLowerCase().includes(k)), main = keys.sort((a, b) => Math.abs(d[b]) - Math.abs(d[a]))[0];
  return { x: main === 'x' ? d.x : 0, y: main === 'y' ? d.y : 0, z: main === 'z' ? d.z : 0 };
}

// Apply a typed transform directly along one gumball handle (no prior drag needed):
//   translate: `value` in mm along +X/+Y/+Z (in `space`: 'world' or 'local')
//   rotate:    `value` in degrees around X/Y/Z (in `space`) or camera view axis 'E'
//   scale:     `value` signed non-zero factor on the handle's axis letters (X/Y/Z/XY/XZ/YZ/XYZ)
export function applyAxisTransform({ THREE, obj, mode, axis, value, space = 'world', mmPerUnit = 1000, camera = null }) {
  if (!obj || !Number.isFinite(value)) return false;
  const unitAxis = a => new THREE.Vector3(a === 'X' ? 1 : 0, a === 'Y' ? 1 : 0, a === 'Z' ? 1 : 0);
  if (mode === 'translate') {
    if (axis !== 'X' && axis !== 'Y' && axis !== 'Z') return false;
    obj.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    obj.matrixWorld.decompose(wp, wq, ws);
    const dir = unitAxis(axis);
    if (space === 'local') dir.applyQuaternion(wq).normalize();
    const targetWorld = wp.clone().addScaledVector(dir, value / (mmPerUnit || 1000));
    if (obj.parent) {
      obj.parent.updateWorldMatrix(true, false);
      obj.position.copy(obj.parent.worldToLocal(targetWorld));
    } else {
      obj.position.copy(targetWorld);
    }
    obj.updateMatrixWorld(true);
    return true;
  }
  if (mode === 'rotate') {
    const rad = THREE.MathUtils.degToRad(value);
    obj.updateWorldMatrix(true, false);
    if (axis === 'E' && camera) {
      const viewAxis = new THREE.Vector3();
      camera.getWorldDirection(viewAxis).negate().normalize();
      const parentQ = obj.parent ? obj.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
      const localAxis = viewAxis.applyQuaternion(parentQ.invert()).normalize();
      obj.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(localAxis, rad));
    } else if (axis === 'X' || axis === 'Y' || axis === 'Z') {
      if (space === 'local') {
        obj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(unitAxis(axis), rad));
      } else {
        const parentQ = obj.parent ? obj.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
        const localAxis = unitAxis(axis).applyQuaternion(parentQ.invert()).normalize();
        obj.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(localAxis, rad));
      }
    } else return false;
    obj.updateMatrixWorld(true);
    return true;
  }
  if (mode === 'scale') {
    if (Math.abs(value) < 1e-6) return false;
    const ax = String(axis || 'XYZ').toUpperCase();
    const hasX = ax.includes('X'), hasY = ax.includes('Y'), hasZ = ax.includes('Z');
    if (!hasX && !hasY && !hasZ) { obj.scale.multiplyScalar(value); }
    else {
      if (hasX) obj.scale.x *= value;
      if (hasY) obj.scale.y *= value;
      if (hasZ) obj.scale.z *= value;
    }
    obj.updateMatrixWorld(true);
    return true;
  }
  return false;
}

const fmtIn = mm => `${(mm / 25.4).toFixed(Math.abs(mm) < 254 ? 2 : 1)} in`;
const fmtLen = mm => `${fmtIn(mm)} · ${Math.round(mm)} mm`;
const all = new Set();
export function setSpaceAll(space) { for (const g of all) if (!g.userData?.fixedSpace) g.setSpace(space); }
export function spaceNow() { for (const g of all) if (!g.userData?.fixedSpace) return g.space; return 'world'; }

function scaleRatio(cur, start, axis) {
  const ax = String(axis || '').toUpperCase();
  if (ax === 'X') return cur.x / (start.x || 1);
  if (ax === 'Y') return cur.y / (start.y || 1);
  if (ax === 'Z') return cur.z / (start.z || 1);
  return cur.x / (start.x || 1);
}

// gizmo: a TransformControls or Studio UnifiedTransformGumball; win: the viewport window; THREE: its three.js;
// mmPerUnit(): mm per world unit; snap: { t, r, s } for Ctrl; setSnap(bool): editor-owned snap toggle;
// allowNegativeScale: permit negative/inverted scale (-1 / -100%); status(text); readout: show live drag tooltip.
export function enhanceGizmo(gizmo, { win, THREE, mmPerUnit = () => 1000, snap = { t: .05, r: 15, s: .1 }, setSnap = null, status = () => {}, readout = true, allowNegativeScale = true }) {
  all.add(gizmo);
  const doc = win?.document;
  const tip = doc?.createElement?.('div') || { style: {}, remove() {} };
  tip.className = 'gumball-tip';
  Object.assign(tip.style, { position: 'fixed', zIndex: 99999, pointerEvents: 'none', padding: '3px 7px', borderRadius: '6px', background: '#0b1118e6', border: '1px solid #ffffff22', color: '#e8eef4', font: '600 11px/1.3 system-ui,sans-serif', whiteSpace: 'nowrap', display: 'none' });
  doc?.body?.append?.(tip);

  let start = null, last = null, typed = '', px = 0, py = 0, ctrl = false, shift = false;
  let clickCand = null, popupState = null, popupEl = null;
  const o = () => gizmo.object;
  const modeOf = () => gizmo.activeMode || (gizmo.mode === 'unified' ? 'translate' : gizmo.mode);
  const enabledOf = () => gizmo.enabled !== false;
  const take = obj => ({ p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(), wp: obj.getWorldPosition(new THREE.Vector3()) });
  const posedAway = (obj, from) => !!obj && !!from && (obj.position.distanceToSquared(from.p) > 1e-12 || obj.quaternion.angleTo(from.q) > 1e-6 || obj.scale.distanceToSquared(from.s) > 1e-12);

  function reading() {
    const obj = o(); if (!obj || !start) return '';
    const mode = start.mode || modeOf();
    if (mode === 'rotate') {
      const a = 2 * Math.acos(Math.min(1, Math.abs(start.q.clone().invert().multiply(obj.quaternion).w)));
      return `${(a * 180 / Math.PI).toFixed(1)}°` + (gizmo.axis && gizmo.axis.length === 1 ? ` (${gizmo.axis})` : '');
    }
    if (mode === 'scale') {
      const ax = gizmo.axis || start.axis || '';
      const pct = Math.round(scaleRatio(obj.scale, start.s, ax) * 100);
      const tag = ax && ax !== 'XYZ' ? ` (${ax})` : '';
      return `${pct} %${pct < 0 ? ' · flipped' : ''}${tag}`;
    }
    const d = obj.getWorldPosition(new THREE.Vector3()).sub(start.wp), mm = d.length() * mmPerUnit();
    return fmtLen(mm) + (gizmo.axis && gizmo.axis.length === 1 ? ` (${gizmo.axis})` : '');
  }
  function show() {
    if (popupState) { tip.style.display = 'none'; return; }
    const text = readout && !typed ? reading() : typed ? reading() : '';
    if (!text && !typed) { tip.style.display = 'none'; return; }
    tip.textContent = typed ? `${text} → ${typed}▏ Enter` : text + (gizmo.dragging ? ' · type a value' : '');
    Object.assign(tip.style, { display: 'block', left: px + 14 + 'px', top: py + 14 + 'px' });
  }
  const applySnap = () => {
    const on = !!ctrl;
    if (setSnap) { setSnap(on); return; }
    gizmo.setTranslationSnap(on ? snap.t : null);
    gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(snap.r) : null);
    gizmo.setScaleSnap(on ? snap.s : null);
  };

  function closePopup() {
    popupState = null;
    if (popupEl) { popupEl.style.display = 'none'; }
  }

  function applyAxis(mode, axis, text, { space = gizmo.space || 'world' } = {}) {
    const obj = o();
    if (!obj) return false;
    const v = parseValue(text, mode);
    if (v === null) {
      const msg = mode === 'scale' ? `“${text}” is not a valid scale (cannot be 0; try -1 to flip, 1.5, or 150%).`
        : mode === 'rotate' ? `“${text}” is not an angle (try 90 or -45°).`
        : `“${text}” is not a length (try 2.5, -1 1/2, 50mm, 5cm, 1ft).`;
      status(msg);
      return false;
    }
    if (mode === 'scale' && !allowNegativeScale && v < 0) {
      status('Negative scale is not supported on this item.');
      return false;
    }
    const before = take(obj);
    const prevAxis = gizmo.axis;
    gizmo.dispatchEvent({ type: 'dragging-changed', value: true, mode, gumball: true });
    const ok = applyAxisTransform({ THREE, obj, mode, axis, value: v, space, mmPerUnit: mmPerUnit(), camera: gizmo.camera });
    if (!ok) {
      gizmo.dispatchEvent({ type: 'dragging-changed', value: false, mode, gumball: true });
      return false;
    }
    gizmo.dispatchEvent({ type: 'objectChange', mode });
    gizmo.dispatchEvent({ type: 'dragging-changed', value: false, mode, gumball: true });
    last = { obj, start: before, mode, axis: axis || prevAxis, end: take(obj), until: performance.now() + 4000 };
    if (mode === 'translate') status(`Moved ${axis} by ${fmtLen(v)}.`);
    else if (mode === 'rotate') status(`Rotated ${axis === 'E' ? 'view' : axis} by ${v}°.`);
    else {
      const axLabel = axis && axis !== 'XYZ' ? ` ${axis}` : '';
      status(v === -1 ? `Flipped${axLabel} (×−1).` : `Scaled${axLabel} by ${Math.round(v * 100)} %.`);
    }
    return true;
  }

  function ensurePopupEl() {
    if (popupEl || !doc?.createElement || !doc?.body?.append) return popupEl;
    const box = doc.createElement('div');
    if (!box.addEventListener) return null;   // minimal headless test stub without DOM API
    box.className = 'gumball-input-pop';
    box.setAttribute?.('role', 'dialog');
    box.setAttribute?.('aria-label', 'Gumball numeric input');
    Object.assign(box.style, {
      position: 'fixed', zIndex: 100001, display: 'none', minWidth: '208px', maxWidth: '280px',
      padding: '8px 10px', borderRadius: '8px', background: 'rgba(11, 17, 24, 0.96)',
      border: '1px solid rgba(255,255,255,0.18)', borderLeft: '3px solid #63d8f5',
      boxShadow: '0 10px 28px rgba(0,0,0,0.55)', color: '#e8eef4',
      font: '500 12px/1.35 system-ui, -apple-system, sans-serif', backdropFilter: 'blur(8px)'
    });
    box.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <span data-gb-title style="font-weight:700;font-size:11px;letter-spacing:.03em;text-transform:uppercase"></span>
        <button type="button" data-gb-close aria-label="Close" style="background:none;border:0;color:#9ab0c4;cursor:pointer;font:700 14px/1 system-ui,sans-serif;padding:0 2px">×</button>
      </div>
      <div style="display:flex;align-items:center;gap:5px">
        <input type="text" data-gb-input autocomplete="off" spellcheck="false" style="flex:1;min-width:0;padding:5px 7px;border-radius:5px;border:1px solid rgba(255,255,255,0.22);background:#060a0f;color:#f4f8fc;font:600 13px/1.2 ui-monospace,SFMono-Regular,monospace;outline:none">
        <button type="button" data-gb-apply title="Apply (Enter)" style="padding:5px 8px;border-radius:5px;border:0;background:#63d8f5;color:#04121a;font:700 12px/1.2 system-ui,sans-serif;cursor:pointer">↵</button>
        <button type="button" data-gb-flip title="Mirror / invert along this axis (×−1)" style="display:none;padding:5px 7px;border-radius:5px;border:1px solid rgba(255,255,255,0.24);background:#1b2633;color:#e8eef4;font:600 11px/1.2 system-ui,sans-serif;cursor:pointer;white-space:nowrap">Flip ×−1</button>
      </div>
      <div data-gb-hint style="margin-top:5px;font-size:10.5px;color:#95a8ba"></div>`;
    for (const evName of ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel']) {
      box.addEventListener(evName, ev => ev.stopPropagation());
    }
    const input = box.querySelector('[data-gb-input]');
    const hint = box.querySelector('[data-gb-hint]');
    const submit = () => {
      if (!popupState) return;
      if (popupState.obj !== o()) { closePopup(); return; }
      const raw = input.value.trim();
      if (!raw) { closePopup(); return; }
      const { mode, axis, space } = popupState;
      const v = parseValue(raw, mode);
      if (v === null || (mode === 'scale' && !allowNegativeScale && v < 0)) {
        input.style.borderColor = '#ff5c5c';
        hint.style.color = '#ff8a8a';
        hint.textContent = v === null
          ? (mode === 'scale' ? 'Enter a non-zero scale (e.g. -1, 1.5, 150%)' : mode === 'rotate' ? 'Enter degrees (e.g. 90, -45)' : 'Enter inches or units (e.g. 2.5, -1 1/2, 50mm)')
          : 'Negative scale is not supported on this item.';
        input.select?.();
        return;
      }
      const st = popupState;
      closePopup();
      applyAxis(st.mode, st.axis, raw, { space: st.space });
    };
    box.querySelector('[data-gb-close]').addEventListener('click', () => closePopup());
    box.querySelector('[data-gb-apply]').addEventListener('click', submit);
    box.querySelector('[data-gb-flip]').addEventListener('click', () => {
      if (!popupState) return;
      const st = popupState;
      closePopup();
      applyAxis('scale', st.axis, '-1', { space: st.space });
    });
    input.addEventListener('input', () => {
      input.style.borderColor = 'rgba(255,255,255,0.22)';
      if (popupState) { hint.style.color = '#95a8ba'; hint.textContent = popupState.hint; }
    });
    doc.body.append(box);
    popupEl = box;
    popupEl._submit = submit;
    popupEl._input = input;
    popupEl._title = box.querySelector('[data-gb-title]');
    popupEl._hint = hint;
    popupEl._flip = box.querySelector('[data-gb-flip]');
    return popupEl;
  }

  function openPopup({ x, y, mode, axis, space = gizmo.space || 'world', obj = o() }) {
    if (!obj || !clickableHandle(mode, axis)) return false;
    const title = mode === 'translate' ? `Move ${axis} (in)`
      : mode === 'rotate' ? `Rotate ${axis === 'E' ? 'View' : axis} (°)`
      : axis === 'XYZ' ? 'Scale All (× or %)' : `Scale ${axis} (× or %)`;
    const hint = mode === 'translate' ? 'Inches default (2.5, -1 1/2, 50mm) · Enter · Esc'
      : mode === 'rotate' ? 'Degrees (90, -45) · Enter · Esc'
      : allowNegativeScale ? 'Factor or % (-1 flips/inverts, 150%) · Enter · Esc' : 'Factor or % (1.2, 120%) · Enter · Esc';
    const placeholder = mode === 'translate' ? '2.5 or -1 1/2' : mode === 'rotate' ? '90 or -45' : allowNegativeScale ? '-1 to flip, 1.5, 150%' : '1.2 or 120%';
    popupState = { mode, axis, space, obj, hint, openedAt: performance.now() };
    tip.style.display = 'none';
    const box = ensurePopupEl();
    if (!box) return true;   // headless test stub: state tracked even without real DOM
    const accent = AXIS_COLORS[axis] || '#63d8f5';
    box.style.borderLeftColor = accent;
    box._title.textContent = title;
    box._title.style.color = accent;
    box._input.value = '';
    box._input.placeholder = placeholder;
    box._input.style.borderColor = 'rgba(255,255,255,0.22)';
    box._hint.textContent = hint;
    box._hint.style.color = '#95a8ba';
    box._flip.style.display = mode === 'scale' && allowNegativeScale && axis !== 'XYZ' ? 'inline-block' : 'none';
    box.style.display = 'block';
    const vw = win.innerWidth || 1280, vh = win.innerHeight || 720;
    const w = box.offsetWidth || 236, h = box.offsetHeight || 86;
    const left = Math.max(8, Math.min((x || 0) + 14, vw - w - 8));
    const top = Math.max(8, Math.min((y || 0) - 18, vh - h - 8));
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    setTimeout(() => { if (popupState) { box._input.focus?.(); box._input.select?.(); } }, 0);
    return true;
  }

  gizmo.addEventListener('dragging-changed', ev => {
    if (ev.value && !ev.gumball) {
      closePopup();
      const obj = o();
      start = obj ? { ...take(obj), mode: ev.mode || modeOf(), axis: gizmo.axis } : null;
      typed = '';
    } else if (!ev.value && !ev.gumball) {
      const obj = o();
      if (obj && start && posedAway(obj, start)) {
        last = { obj, start, mode: ev.mode || start.mode || modeOf(), axis: gizmo.axis || start.axis, end: take(obj), until: performance.now() + 4000 };
      }
      start = null;
      setTimeout(() => { if (!typed) tip.style.display = 'none'; }, 900);
    }
  });
  gizmo.addEventListener('objectChange', () => {
    const obj = o();
    if (clickCand && !clickCand.moved && obj && posedAway(obj, clickCand.startPose)) clickCand.moved = true;
    if (!obj || !start || !gizmo.dragging) return;
    const mode = start.mode || modeOf();
    if (shift && mode === 'translate' && gizmo.axis && gizmo.axis.length > 1) {
      const d = obj.position.clone().sub(start.p), c = constrain({ x: d.x, y: d.y, z: d.z }, gizmo.axis);
      obj.position.copy(start.p).add(new THREE.Vector3(c.x, c.y, c.z));
    }
    show();
  });

  // Redo the last drag to exactly `text`, from its start, as one more edit the editor commits (a synthetic drag).
  function apply(text) {
    const L = last;
    if (!L || L.obj !== o()) { status('Click any gumball handle to type a value, or drag first then type and press Enter.'); return false; }
    const v = parseValue(text, L.mode);
    if (v === null) { status(`“${text}” is not a value: try 2.5, -1 1/2, 50mm, 45°, -1, 150%.`); return false; }
    if (L.mode === 'scale' && !allowNegativeScale && v < 0) { status('Negative scale is not supported on this item.'); return false; }
    const obj = L.obj;
    gizmo.dispatchEvent({ type: 'dragging-changed', value: true, mode: L.mode, gumball: true });
    if (L.mode === 'translate') {
      const dir = L.end.p.clone().sub(L.start.p);
      if (dir.lengthSq() < 1e-12) { status('Drag a little in the direction you want, or click an arrow to type the distance.'); gizmo.dispatchEvent({ type: 'dragging-changed', value: false, mode: L.mode, gumball: true }); return false; }
      const unitsPerMm = 1 / mmPerUnit(), worldLen = L.end.wp.clone().sub(L.start.wp).length(), localLen = dir.length(), k = worldLen > 0 ? localLen / worldLen : 1;
      obj.position.copy(L.start.p).addScaledVector(dir.normalize(), v * unitsPerMm * k);
    } else if (L.mode === 'rotate') {
      const rel = L.start.q.clone().invert().multiply(L.end.q), axis = new THREE.Vector3(rel.x, rel.y, rel.z);
      if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0);
      axis.normalize();
      if (rel.w < 0) axis.negate();
      obj.quaternion.copy(L.start.q).multiply(new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(v)));
    } else {
      obj.scale.copy(L.start.s);
      applyAxisTransform({ THREE, obj, mode: 'scale', axis: L.axis || 'XYZ', value: v });
    }
    obj.updateMatrixWorld(true);
    gizmo.dispatchEvent({ type: 'objectChange', mode: L.mode });
    gizmo.dispatchEvent({ type: 'dragging-changed', value: false, mode: L.mode, gumball: true });
    last = { ...L, end: take(obj), until: performance.now() + 4000 };
    status(L.mode === 'translate' ? `Moved exactly ${fmtLen(v)}.` : L.mode === 'rotate' ? `Turned exactly ${v}°.` : `Scaled to exactly ${Math.round(v * 100)} %.`);
    return true;
  }

  const dom = gizmo.domElement;
  const onPointerDown = ev => {
    clickCand = null;
    if (popupEl && popupState && !popupEl.contains?.(ev.target)) closePopup();
    if (ev.button !== 0 || ev.altKey || ev.shiftKey || ev.ctrlKey || ev.metaKey || !enabledOf() || !o() || gizmo.dragging) return;
    if (dom?.getBoundingClientRect && gizmo.pointerHover) {
      const r = dom.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        gizmo.pointerHover({ x: (ev.clientX - r.left) / r.width * 2 - 1, y: -(ev.clientY - r.top) / r.height * 2 + 1, button: ev.button });
      }
    }
    const mode = modeOf(), axis = gizmo.axis;
    if (clickableHandle(mode, axis)) {
      clickCand = { x: ev.clientX, y: ev.clientY, mode, axis, space: gizmo.space || 'world', obj: o(), moved: false, startPose: take(o()) };
    }
  };
  const onPointerMove = ev => {
    px = ev.clientX; py = ev.clientY;
    if (clickCand && !clickCand.moved && Math.hypot(ev.clientX - clickCand.x, ev.clientY - clickCand.y) >= 5) clickCand.moved = true;
    if (gizmo.dragging) show();
  };
  const onPointerUp = ev => {
    const c = clickCand; clickCand = null;
    if (!c || c.moved || ev.button !== 0 || Math.hypot(ev.clientX - c.x, ev.clientY - c.y) >= 5) return;
    if (!enabledOf() || c.obj !== o() || posedAway(c.obj, c.startPose)) return;
    openPopup({ x: ev.clientX, y: ev.clientY, mode: c.mode, axis: c.axis, space: c.space, obj: c.obj });
  };
  const onDocPointerDown = ev => {
    if (popupState && popupEl && !popupEl.contains?.(ev.target) && ev.target !== dom) closePopup();
  };

  const typingOk = e => !e.target?.closest?.('input,textarea,select,[contenteditable]') && (gizmo.dragging || (last && performance.now() < last.until && last.obj === o()));
  const onKey = e => {
    if (e.key === 'Control' || e.key === 'Meta') { const on = e.type === 'keydown'; if (on !== ctrl) { ctrl = on; applySnap(); } }
    if (e.key === 'Shift') shift = e.type === 'keydown';
    if (e.type !== 'keydown') return;
    if (popupState) {
      if (popupState.obj !== o()) { closePopup(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closePopup(); return; }
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); popupEl?._submit?.(); return; }
      return;
    }
    if (!enabledOf() || !o()) return;
    if (typed && e.key === 'Escape') { typed = ''; e.preventDefault(); e.stopImmediatePropagation(); show(); return; }
    if (typed && e.key === 'Backspace') { typed = typed.slice(0, -1); e.preventDefault(); e.stopImmediatePropagation(); show(); return; }
    if (typed && e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); const t = typed; typed = ''; apply(t); tip.style.display = 'none'; return; }
    if (e.ctrlKey || e.altKey || e.metaKey || !typingOk(e)) return;
    if (/^[0-9.+\-\/]$/.test(e.key) || (typed && /^[a-z"'°%\s]$/i.test(e.key))) { typed += e.key; e.preventDefault(); e.stopImmediatePropagation(); show(); }
  };
  const onBlur = () => { if (ctrl) { ctrl = false; applySnap(); } shift = false; };
  // (on the windows, capture: ahead of the Director's key dispatcher on the documents, so Escape closes the popup
  // cleanly and 1–8 / 0 type a value during a drag and for 4 s after it instead of triggering viewport shortcuts)
  const docs = [win, win?.parent].filter((d, i, a) => d && a.indexOf(d) === i);
  for (const d of docs) { d.addEventListener?.('keydown', onKey, true); d.addEventListener?.('keyup', onKey, true); }
  win?.addEventListener?.('blur', onBlur);
  doc?.addEventListener?.('pointerdown', onDocPointerDown, true);
  dom?.addEventListener?.('pointerdown', onPointerDown, true);
  dom?.addEventListener?.('pointermove', onPointerMove);
  dom?.addEventListener?.('pointerup', onPointerUp, true);
  return {
    apply,
    applyAxis,
    openPopup,
    closePopup,
    popupOpen: () => !!popupState,
    typed: () => typed,
    dispose() {
      all.delete(gizmo);
      closePopup();
      tip.remove?.();
      popupEl?.remove?.();
      for (const d of docs) { d.removeEventListener?.('keydown', onKey, true); d.removeEventListener?.('keyup', onKey, true); }
      win?.removeEventListener?.('blur', onBlur);
      doc?.removeEventListener?.('pointerdown', onDocPointerDown, true);
      dom?.removeEventListener?.('pointerdown', onPointerDown, true);
      dom?.removeEventListener?.('pointermove', onPointerMove);
      dom?.removeEventListener?.('pointerup', onPointerUp, true);
    }
  };
}

// mm per world unit on the stage / Studio: the room's root (or accessories/room scale in product view) maps mm → scene.
export function mmPerUnitOf(win, THREE) {
  const ef = win?.ErgoFlex;
  const r = ef?.workspaceRoom?.root;
  if (r?.getWorldScale) { const s = r.getWorldScale(new THREE.Vector3()).x; if (s > 0) return 1 / s; }
  const accScale = ef?.workspaceAccessories?.scale;
  if (accScale > 0) return 1 / accScale;
  const roomScale = ef?.workspaceRoom?.scale;
  if (roomScale > 0) return 1 / roomScale;
  return 1000;
}
