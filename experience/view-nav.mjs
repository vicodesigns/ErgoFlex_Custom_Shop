// The Director's 3D view navigation, Rhino style (17 Nov 2026, Vico): right-drag orbits, Shift+right-drag pans,
// Ctrl+right-drag zooms, the wheel zooms toward the pointer, middle-drag pans, a click of the wheel centres the
// selection (the next orbit turns around it), and the left button only selects: a left-drag on empty space draws a
// box (props: left-to-right picks what is inside, right-to-left what it touches; Shift adds, Ctrl toggles).
//   Only while the Director is open: the stage's OrbitControls (studio.js) are shared with the public visualizer and
// the Studio, so their own defaults never change; setActive(false) puts back what was there.
//   F frames the selection and Shift+F the room (director.mjs calls frame()); centre() is the wheel click.
const MOUSE = { ROTATE: 0, DOLLY: 1, PAN: 2, NONE: -1 };
const CLICK = 4;          // px: a press that moves less than this is a click, not a drag
const EASE_MS = 250;

export function createViewNav({ three, selectionObject = () => null, boxPick = () => 0, editing = () => true, status = () => {}, wake = () => {} }) {
  let active = false, saved = null, hooked = new WeakSet(), tween = 0, box = null, dolly = null, middle = null, right = null;
  const t = () => { try { return three(); } catch { return null; } };

  function apply() {
    const s = t(), c = s?.controls; if (!c) return;
    if (active) {
      if (!saved) saved = { mouseButtons: { ...c.mouseButtons }, zoomToCursor: c.zoomToCursor, screenSpacePanning: c.screenSpacePanning };
      c.mouseButtons = { LEFT: MOUSE.NONE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
      c.zoomToCursor = true; c.screenSpacePanning = true;
      hook(s.renderer.domElement, s);
    } else if (saved) {
      c.mouseButtons = saved.mouseButtons; c.zoomToCursor = saved.zoomToCursor; c.screenSpacePanning = saved.screenSpacePanning; saved = null;
    }
  }
  function setActive(on) { active = !!on; apply(); }
  // the stage page can reload (a new renderer): hook its canvas again
  function refresh() { if (active) apply(); }

  function hook(dom, s) {
    if (!dom || hooked.has(dom)) return; hooked.add(dom);
    const doc = dom.ownerDocument;
    dom.addEventListener('contextmenu', ev => { if (active) ev.preventDefault(); }, true);
    dom.addEventListener('pointerdown', ev => {
      if (!active) return;
      if (ev.button === 1) { ev.preventDefault(); middle = { x: ev.clientX, y: ev.clientY }; return; }   // no autoscroll / paste
      if (ev.button === 2 && (ev.ctrlKey || ev.metaKey)) {            // Ctrl+right-drag: zoom (OrbitControls would pan)
        ev.preventDefault(); ev.stopImmediatePropagation(); stopTween();
        dolly = { id: ev.pointerId, y: ev.clientY }; try { dom.setPointerCapture(ev.pointerId); } catch {} return;
      }
      if (ev.button === 2) { right = { x: ev.clientX, y: ev.clientY }; stopTween(); return; }
      if (ev.button === 0 && editing()) box = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, el: null, shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey };
    }, true);
    dom.addEventListener('pointermove', ev => {
      if (dolly && ev.pointerId === dolly.id) { const dy = ev.clientY - dolly.y; dolly.y = ev.clientY; zoomBy(Math.exp(dy * .01)); return; }
      if (!box || ev.pointerId !== box.id) return;
      const w = doc.defaultView;
      if (w.__directorDragging) { endBox(); return; }                 // a gizmo or a path handle took this drag
      if (!box.el && Math.hypot(ev.clientX - box.x, ev.clientY - box.y) < CLICK + 1) return;
      if (!box.el) { box.el = doc.createElement('div'); box.el.className = 'director-box-select'; doc.body.append(box.el); }
      const l = Math.min(box.x, ev.clientX), r = Math.max(box.x, ev.clientX), tp = Math.min(box.y, ev.clientY), b = Math.max(box.y, ev.clientY), touch = ev.clientX < box.x;
      Object.assign(box.el.style, { position: 'fixed', left: l + 'px', top: tp + 'px', width: r - l + 'px', height: b - tp + 'px', zIndex: 99999, pointerEvents: 'none',
        border: '1px ' + (touch ? 'dashed' : 'solid') + ' #63d8f5', background: touch ? '#63d8f514' : '#63d8f522' });
      box.rect = { left: l, right: r, top: tp, bottom: b }; box.touch = touch;
    }, true);
    const up = ev => {
      if (dolly && ev.pointerId === dolly.id) { dolly = null; return; }
      if (ev.button === 1 && middle) { const m = middle; middle = null; if (Math.hypot(ev.clientX - m.x, ev.clientY - m.y) < CLICK) centre(ev); return; }
      if (ev.button === 2) right = null;
      if (box && ev.pointerId === box.id) {
        const b = box; endBox();
        if (b.rect && !doc.defaultView.__directorDragging) {
          const how = b.ctrl ? 'toggle' : b.shift ? 'add' : 'replace';
          const n = boxPick(b.rect, { touch: b.touch, how });
          if (!n && how === 'replace') status(b.touch ? 'The box touched no props.' : 'No prop fully inside the box. Drag right-to-left to pick what it touches.');
        }
      }
    };
    dom.addEventListener('pointerup', up, true);
    dom.addEventListener('pointercancel', () => { endBox(); dolly = null; middle = null; right = null; }, true);
    doc.defaultView.addEventListener('blur', () => { endBox(); dolly = null; middle = null; });
    function endBox() { box?.el?.remove(); box = null; }
    // middle-click pastes on Linux (auxclick / paste); keep the page from doing anything with it
    dom.addEventListener('auxclick', ev => { if (active && ev.button === 1) ev.preventDefault(); }, true);
  }

  function zoomBy(factor) {
    const s = t(), c = s?.controls, cam = s?.camera; if (!c || !cam) return;
    const off = cam.position.clone().sub(c.target), len = off.length(), next = Math.max(c.minDistance || .05, Math.min(c.maxDistance || 1e4, len * factor));
    cam.position.copy(c.target).add(off.multiplyScalar(next / len)); c.update?.(); wake();
  }
  // The world centre and radius of an object (its bounding box), or null.
  function boundsOf(o) {
    if (!o) return null; const s = t(); if (!s) return null;
    const V = s.camera.position.constructor, min = new V(Infinity, Infinity, Infinity), max = new V(-Infinity, -Infinity, -Infinity), p = new V();
    o.updateWorldMatrix?.(true, true);
    o.traverse?.(m => {
      const g = m.geometry; if (!m.visible && m !== o) return;
      if (g) { if (!g.boundingBox) g.computeBoundingBox?.(); const bb = g.boundingBox; if (!bb) return;
        for (let i = 0; i < 8; i++) { p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld); min.min(p); max.max(p); } }
    });
    if (!Number.isFinite(min.x)) { o.getWorldPosition?.(p); return { centre: p.clone(), radius: .3 }; }
    const centre = min.clone().add(max).multiplyScalar(.5);
    return { centre, radius: Math.max(.15, max.clone().sub(min).length() / 2) };
  }
  // Move the orbit pivot (and the camera with it) so `centre` is in the middle; `distance` changes the zoom too.
  function glide(centre, distance = null) {
    const s = t(), c = s?.controls, cam = s?.camera; if (!c || !cam) return false;
    stopTween();
    const fromT = c.target.clone(), fromP = cam.position.clone(), off = fromP.clone().sub(fromT);
    if (distance) off.setLength(distance);
    const toT = centre.clone(), toP = centre.clone().add(off), start = performance.now(), w = s.renderer.domElement.ownerDocument.defaultView;
    const step = now => {
      const k = Math.min(1, (now - start) / EASE_MS), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      c.target.lerpVectors(fromT, toT, e); cam.position.lerpVectors(fromP, toP, e); cam.lookAt(c.target); c.update?.(); wake();
      tween = k < 1 ? w.requestAnimationFrame(step) : 0;
    };
    tween = w.requestAnimationFrame(step); return true;
  }
  function stopTween() { if (!tween) return; const w = t()?.renderer?.domElement?.ownerDocument?.defaultView; w?.cancelAnimationFrame(tween); tween = 0; }
  // Wheel click: centre the selection, else the surface under the pointer. The zoom distance stays.
  function centre(ev) {
    const sel = boundsOf(selectionObject());
    if (sel) { glide(sel.centre); status('Centred on the selection: right-drag orbits around it. 0 goes back to the film camera.'); return true; }
    const hit = ev && pointAt(ev); if (hit) { glide(hit); status('Centred on that spot. 0 goes back to the film camera.'); return true; }
    return false;
  }
  // The surface point under the pointer (a real raycast with the stage page's own three.js, loaded by the editors).
  function pointAt(ev) {
    const s = t(); if (!s) return null; const dom = s.renderer.domElement, w = dom.ownerDocument.defaultView, THREE = w.__directorThree?.THREE; if (!THREE) return null;
    const r = dom.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1), s.camera);
    const ours = o => { for (let p = o; p; p = p.parent) if (!p.visible || p.userData?.directorTools || p.isTransformControls) return true; return false; };
    return ray.intersectObject(s.scene, true).find(h => h.object.isMesh && !ours(h.object))?.point || null;
  }
  // F: frame the selection (fills about two thirds of the view); Shift+F (room) is the stage's own Frame room.
  function frame() {
    const b = boundsOf(selectionObject()), cam = t()?.camera; if (!b || !cam) return false;
    const fov = (cam.fov || 40) * Math.PI / 180, dist = b.radius / Math.sin(fov / 2) * 1.15 / Math.min(1, cam.aspect || 1);
    glide(b.centre, dist); return true;
  }
  // Rhino's named views around the orbit pivot, the zoom distance kept: top (straight down; a hair off so the orbit
  // keeps its up), front (from +Z), right (from +X), persp (from the front right, above). The room's own frame: the
  // stage's room root, so "front" faces the room the way the Studio does.
  const DIRS = { top: [0, 1, 1e-3], front: [0, .02, 1], right: [1, .02, 0], persp: [.62, .5, .62] };
  function setView(name) {
    const s = t(), c = s?.controls, cam = s?.camera, d = DIRS[name]; if (!c || !cam || !d) return false;
    stopTween();
    const V = cam.position.constructor, dist = cam.position.distanceTo(c.target), w = s.renderer.domElement.ownerDocument.defaultView;
    const root = w.ErgoFlex?.workspaceRoom?.root, dir = new V(...d).normalize();
    if (root) { root.updateWorldMatrix?.(true, false); const q = root.getWorldQuaternion?.(cam.quaternion.clone()); if (q) dir.applyQuaternion(q); }
    const fromP = cam.position.clone(), toP = c.target.clone().addScaledVector(dir, dist), start = performance.now();
    const step = now => {
      const k = Math.min(1, (now - start) / EASE_MS), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // (along an arc round the pivot, so the view never passes through it)
      const a = fromP.clone().sub(c.target), b = toP.clone().sub(c.target), v = a.clone().lerp(b, e); if (v.lengthSq() < 1e-8) v.set(0, 1, 0); v.setLength(a.length() + (b.length() - a.length()) * e);
      cam.position.copy(c.target).add(v); cam.lookAt(c.target); c.update?.(); wake();
      tween = k < 1 ? w.requestAnimationFrame(step) : 0;
    };
    tween = w.requestAnimationFrame(step); return true;
  }
  return { setActive, refresh, centre, frame, setView, active: () => active };
}
