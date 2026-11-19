// The Director's 3D view navigation, Rhino style (17 Nov 2026, Vico): right-drag orbits, Shift+right-drag pans,
// Ctrl+right-drag zooms, the wheel zooms toward the pointer, middle-drag pans, a click of the wheel centres the
// selection (the next orbit turns around it), and the left button only selects: a left-drag on empty space draws a
// box (props: left-to-right picks what is inside, right-to-left what it touches; Shift adds, Ctrl toggles).
//   Only while the Director is open: the stage's OrbitControls (studio.js) are shared with the public visualizer and
// the Studio, so their own defaults never change; setActive(false) puts back what was there.
//   F frames the selection and Shift+F the room (director.mjs calls frame()); centre() is the wheel click.
//
// Reliability (19 Nov 2026, Vico: "sometimes it works, sometimes it doesn't go anywhere"). What was wrong, and the fix:
//  1. The 250 ms ease timed itself with the PARENT page's performance.now() but advanced on the STAGE iframe's
//     requestAnimationFrame timestamp. The two pages have different time origins, so k was negative (the camera was
//     thrown out by 2k^2) or never reached 1 for as long as the iframe is younger than the Director page. Now the first
//     frame's own timestamp starts the clock, and a timer snaps to the end if the iframe throttles its frames.
//  2. Any user input now stops the ease where it is (pointerdown of any button, the wheel); before, only the right
//     button did, so a wheel or a left click fought the tween for 250 ms.
//  3. OrbitControls ignores the wheel (and every press with the same pointer id) while it thinks a button is still down.
//     A pointerup that never arrived (window blur mid-drag, a context menu, a pointer capture taken by someone else)
//     left it that way until reload. We track presses and send OrbitControls the missing pointercancel.
//  4. The wheel click was "a click" if it ended near where it began, even after a long pan; the travel is now counted.
//  5. Damping: with it the camera keeps gliding for ~1 s after a drag, but the stage stops drawing 800 ms after the last
//     input (wake()), so the rest of the glide, and a pan that lags the mouse, arrived later as a jump on the next
//     gesture. Off while the Director is open (the Studio's setting is put back).
//  6. The centre was the middle of every mesh's box including hidden subtrees, gizmos and selection helpers; stale
//     (a scene the stage page replaced) selections were centred as if they were still there; and a click with nothing
//     to centre on said nothing. Now: visible, real geometry only; an object that is not in the stage's scene counts
//     as no selection; and "Select something to centre on" is shown.
// A read-only trace of the last 16 steps (presses, releases, wheels, centres, heals) is on window.__directorNavTrace.
const MOUSE = { ROTATE: 0, DOLLY: 1, PAN: 2, NONE: -1 };
const CLICK = 4;          // px: a press that moves less than this is a click, not a drag
const EASE_MS = 250;
const NAV_TRACE_MAX = 16;

export function createViewNav({ three, selectionObject = () => null, boxPick = () => 0, editing = () => true, status = () => {}, wake = () => {} }) {
  let active = false, saved = null, hooked = new WeakSet(), tween = null, box = null, dolly = null, middle = null, right = null, lockedNoticeAt = 0;
  const heldPointers = new Map();       // pointerId -> the canvas that saw its press and has not yet seen its release
  const t = () => { try { return three(); } catch { return null; } };
  const easeInOut = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  function navTrace(kind, ev, extra) {
    try {
      const list = (globalThis.__directorNavTrace ||= []), c = t()?.controls;
      list.push({ t: Math.round(globalThis.performance?.now?.() ?? 0), kind, button: ev?.button, buttons: ev?.buttons, id: ev?.pointerId, enabled: c?.enabled, easing: !!tween, held: heldPointers.size, ...extra });
      if (list.length > NAV_TRACE_MAX) list.shift();
    } catch { /* a trace never breaks navigation */ }
  }

  function apply() {
    const s = t(), c = s?.controls; if (!c) return;
    if (active) {
      if (!saved || saved.controls !== c) saved = { controls: c, mouseButtons: { ...c.mouseButtons }, zoomToCursor: c.zoomToCursor, screenSpacePanning: c.screenSpacePanning, enableDamping: c.enableDamping };
      c.mouseButtons = { LEFT: MOUSE.NONE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
      c.zoomToCursor = true; c.screenSpacePanning = true; c.enableDamping = false;
      hook(s.renderer.domElement, s);
    } else if (saved) {
      if (saved.controls === c) { c.mouseButtons = saved.mouseButtons; c.zoomToCursor = saved.zoomToCursor; c.screenSpacePanning = saved.screenSpacePanning; c.enableDamping = saved.enableDamping; }
      saved = null;
    }
  }
  function setActive(on) {
    active = !!on;
    if (!active) { stopTween(); forgetDrags(); }
    apply();
  }
  // the stage page can reload (a new renderer): hook its canvas again
  function refresh() { if (active) apply(); }

  // Every drag state of ours goes.
  function forgetDrags() { box?.el?.remove(); box = null; dolly = null; middle = null; right = null; }
  // ...and OrbitControls is told its pointers are gone (it keeps its own list, and while it thinks a button is down it
  // ignores the wheel and every new press).
  function releaseHeld(why) {
    const list = [...heldPointers]; heldPointers.clear(); forgetDrags();
    for (const [id, dom] of list) {
      navTrace('heal', { pointerId: id }, { why });
      try {
        const w = dom.ownerDocument?.defaultView, Ctor = w?.PointerEvent || w?.Event;
        dom.dispatchEvent(new Ctor('pointercancel', { pointerId: id, pointerType: 'mouse', bubbles: true }));
      } catch { /* nothing more to do */ }
    }
  }

  function hook(dom, s) {
    if (!dom || hooked.has(dom)) return; hooked.add(dom);
    const doc = dom.ownerDocument;
    // the stage's controls were disabled by something else (a loading shot, a gizmo drag that never ended): say so
    // instead of silently doing nothing
    const noticeIfLocked = () => {
      const c = t()?.controls, w = doc.defaultView;
      if (!c || c.enabled !== false || w?.__directorDragging) return;
      const now = Date.now(); if (now - lockedNoticeAt < 4000) return; lockedNoticeAt = now;
      status('The 3D view is not taking camera input right now (the stage is loading, or the film is playing).');
    };
    // a button is up that we think is down: a release was lost
    const checkLostRelease = ev => { if (heldPointers.size && ev.buttons === 0 && ev.pointerType !== 'touch') releaseHeld('buttons-0'); };
    dom.addEventListener('contextmenu', ev => { if (!active) return; ev.preventDefault(); checkLostRelease(ev); }, true);
    dom.addEventListener('pointerdown', ev => {
      if (!active) return;
      if (ev.pointerType !== 'touch' && heldPointers.has(ev.pointerId)) releaseHeld('duplicate-down');   // the last press never reported its release
      if (ev.pointerType !== 'touch') heldPointers.set(ev.pointerId, dom);
      stopTween(); navTrace('down', ev);                                // any input ends an ease where it is
      if (ev.button === 1) { ev.preventDefault(); middle = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, far: 0 }; noticeIfLocked(); return; }   // no autoscroll / paste
      if (ev.button === 2 && (ev.ctrlKey || ev.metaKey)) {            // Ctrl+right-drag: zoom (OrbitControls would pan)
        ev.preventDefault(); ev.stopImmediatePropagation();
        dolly = { id: ev.pointerId, y: ev.clientY }; try { dom.setPointerCapture(ev.pointerId); } catch {} noticeIfLocked(); return;
      }
      if (ev.button === 2) { right = { x: ev.clientX, y: ev.clientY }; noticeIfLocked(); return; }
      if (ev.button === 0 && editing()) box = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, el: null, shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey };
    }, true);
    dom.addEventListener('pointermove', ev => {
      checkLostRelease(ev);
      if (middle && ev.pointerId === middle.id) middle.far = Math.max(middle.far, Math.hypot(ev.clientX - middle.x, ev.clientY - middle.y));
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
    // the wheel: input ends an ease; a wheel while we think a button is down means a release was lost (OrbitControls
    // would drop the wheel). Passive: OrbitControls does its own preventDefault.
    dom.addEventListener('wheel', ev => {
      if (!active) return;
      checkLostRelease(ev); stopTween(); navTrace('wheel', ev, { dy: ev.deltaY }); noticeIfLocked();
    }, { capture: true, passive: true });
    const up = ev => {
      heldPointers.delete(ev.pointerId); navTrace('up', ev);
      if (dolly && ev.pointerId === dolly.id) { dolly = null; return; }
      if (ev.button === 1 && middle) {
        const m = middle; middle = null;
        // a click: it began AND ended here, and never strayed in between (a long pan that comes back is not a click)
        const far = Math.max(m.far, Math.hypot(ev.clientX - m.x, ev.clientY - m.y));
        if (far < CLICK) centre(ev);
        return;
      }
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
    dom.addEventListener('pointercancel', ev => { heldPointers.delete(ev.pointerId); navTrace('cancel', ev); forgetDrags(); }, true);
    dom.addEventListener('lostpointercapture', ev => { if (dolly && ev.pointerId === dolly.id) dolly = null; }, true);
    doc.defaultView.addEventListener('blur', () => { navTrace('blur'); releaseHeld('blur'); });
    function endBox() { box?.el?.remove(); box = null; }
    // middle-click pastes on Linux (auxclick / paste); keep the page from doing anything with it
    dom.addEventListener('auxclick', ev => { if (active && ev.button === 1) ev.preventDefault(); }, true);
  }

  function zoomBy(factor) {
    const s = t(), c = s?.controls, cam = s?.camera; if (!c || !cam) return;
    const off = cam.position.clone().sub(c.target), len = off.length(); if (len < 1e-9) return;
    const next = Math.max(c.minDistance || .05, Math.min(c.maxDistance || 1e4, len * factor));
    cam.position.copy(c.target).add(off.multiplyScalar(next / len)); c.update?.(); wake();
  }
  // Is `o` really part of the stage's scene (not a leftover from a scene the stage page replaced)?
  function inScene(o, scene) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; }
  // The world centre and radius of an object (its bounding box), or null.
  function boundsOf(o) {
    if (!o) return null; const s = t(); if (!s || !s.camera) return null;
    if (s.scene && !inScene(o, s.scene)) return null;
    const V = s.camera.position.constructor, min = new V(Infinity, Infinity, Infinity), max = new V(-Infinity, -Infinity, -Infinity), p = new V();
    o.updateWorldMatrix?.(true, true);
    const walk = n => {
      // hidden subtrees, gizmos and selection helpers are not the object
      if (n !== o && (n.visible === false || n.userData?.directorTools || n.isTransformControls || n.isBoxHelper || n.isBox3Helper)) return;
      const g = n.geometry;
      if (g && n.matrixWorld) {
        let bb = null;
        try {
          if (n.boundingBox !== undefined) { if (!n.boundingBox) n.computeBoundingBox?.(); bb = n.boundingBox; }   // skinned / instanced meshes know their own box
          else { if (!g.boundingBox) g.computeBoundingBox?.(); bb = g.boundingBox; }
        } catch { bb = null; }
        if (bb && !bb.isEmpty?.() && Number.isFinite(bb.min.x) && Number.isFinite(bb.max.x))
          for (let i = 0; i < 8; i++) { p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(n.matrixWorld); min.min(p); max.max(p); }
      }
      for (const child of n.children || []) walk(child);
    };
    walk(o);
    if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) {
      o.getWorldPosition?.(p); if (!Number.isFinite(p.x + p.y + p.z)) return null;
      return { centre: p.clone(), radius: .3 };
    }
    const centre = min.clone().add(max).multiplyScalar(.5);
    return { centre, radius: Math.max(.15, max.clone().sub(min).length() / 2) };
  }
  // One ease at a time: frame(e) is called with the eased 0..1. The clock is the FIRST frame's own timestamp (the stage
  // iframe's timeline, not this page's performance.now()); a timer lands the end state if the iframe stops drawing.
  function runTween(w, frame) {
    stopTween();
    const job = { raf: 0, timer: 0, w }; let start = null;
    const finish = how => { clearTimeout(job.timer); if (tween === job) tween = null; navTrace('ease-' + how); };
    const step = ts => {
      if (tween !== job) return;
      if (start === null) start = ts;
      const k = Math.max(0, Math.min(1, (ts - start) / EASE_MS));
      frame(k >= 1 ? 1 : easeInOut(k)); wake();
      if (k < 1) job.raf = w.requestAnimationFrame(step); else finish('done');
    };
    job.timer = setTimeout(() => { if (tween !== job) return; try { w.cancelAnimationFrame(job.raf); } catch {} frame(1); wake(); finish('snap'); }, EASE_MS + 300);
    tween = job; job.raf = w.requestAnimationFrame(step); return true;
  }
  function stopTween() {
    const job = tween; if (!job) return;
    tween = null; clearTimeout(job.timer); try { job.w.cancelAnimationFrame(job.raf); } catch {}
  }
  const stageWindow = s => s.renderer.domElement.ownerDocument.defaultView;
  // Move the orbit pivot (and the camera with it) so `centre` is in the middle; `distance` changes the zoom too.
  function glide(centre, distance = null) {
    const s = t(), c = s?.controls, cam = s?.camera; if (!c || !cam) return false;
    const fromT = c.target.clone(), fromP = cam.position.clone(), V = fromT.constructor;
    let off = fromP.clone().sub(fromT);
    if (off.lengthSq() < 1e-10) off = new V(0, 0, 1).applyQuaternion(cam.quaternion || { x: 0, y: 0, z: 0, w: 1 }).multiplyScalar(distance || 3);   // the camera sat on its pivot
    if (distance) off.setLength(distance);
    const toT = centre.clone(), toP = centre.clone().add(off);
    return runTween(stageWindow(s), e => {
      if (e >= 1) { c.target.copy(toT); cam.position.copy(toP); } else { c.target.lerpVectors(fromT, toT, e); cam.position.lerpVectors(fromP, toP, e); }
      cam.lookAt(c.target); c.update?.();
    });
  }
  // Wheel click: centre the selection, else the surface under the pointer. The zoom distance stays (unless the
  // selection is so big it would not fit: then the camera backs off to fit it).
  function centre(ev) {
    const s = t(), cam = s?.camera, c = s?.controls;
    if (!s || !c || !cam) { status('The 3D view is not ready yet.'); navTrace('centre', null, { result: 'no-stage' }); return false; }
    const sel = boundsOf(selectionObject());
    if (sel) {
      const fit = fitDistance(sel.radius, cam, .8), now = cam.position.distanceTo(c.target);
      glide(sel.centre, now < fit ? fit : null);
      navTrace('centre', null, { result: 'selection', radius: +sel.radius.toFixed(3) });
      status('Centred on the selection: right-drag orbits around it. 0 goes back to the film camera.'); return true;
    }
    const hit = ev && pointAt(ev); if (hit) { glide(hit); navTrace('centre', null, { result: 'surface' }); status('Centred on that spot. 0 goes back to the film camera.'); return true; }
    navTrace('centre', null, { result: 'nothing' });
    status('Select something to centre on, then click the mouse wheel.'); return false;
  }
  // The camera distance at which a bounding sphere of `radius` fills the view (`factor` 1 = about 90% of it).
  function fitDistance(radius, cam, factor = 1.15) {
    const fov = (cam.fov || 40) * Math.PI / 180;
    return radius / Math.sin(fov / 2) * factor / Math.min(1, cam.aspect || 1);
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
    glide(b.centre, fitDistance(b.radius, cam)); return true;
  }
  // Rhino's named views around the orbit pivot, the zoom distance kept: top (straight down; a hair off so the orbit
  // keeps its up), front (from +Z), right (from +X), persp (from the front right, above). The room's own frame: the
  // stage's room root, so "front" faces the room the way the Studio does.
  const DIRS = { top: [0, 1, 1e-3], front: [0, .02, 1], right: [1, .02, 0], persp: [.62, .5, .62] };
  function setView(name) {
    const s = t(), c = s?.controls, cam = s?.camera, d = DIRS[name]; if (!c || !cam || !d) return false;
    const V = cam.position.constructor, dist = cam.position.distanceTo(c.target), w = stageWindow(s);
    const root = w.ErgoFlex?.workspaceRoom?.root, dir = new V(...d).normalize();
    if (root) { root.updateWorldMatrix?.(true, false); const q = root.getWorldQuaternion?.(cam.quaternion.clone()); if (q) dir.applyQuaternion(q); }
    const fromP = cam.position.clone(), toP = c.target.clone().addScaledVector(dir, dist), pivot = c.target.clone();
    return runTween(w, e => {
      // (along an arc round the pivot, so the view never passes through it)
      const a = fromP.clone().sub(pivot), b = toP.clone().sub(pivot), v = a.clone().lerp(b, e); if (v.lengthSq() < 1e-8) v.set(0, 1, 0); v.setLength(a.length() + (b.length() - a.length()) * e);
      c.target.copy(pivot); cam.position.copy(pivot).add(v); cam.lookAt(pivot); c.update?.();
    });
  }
  return { setActive, refresh, centre, frame, setView, active: () => active };
}
