// The inspector's number fields, pro style (plan rev 3, P5, 17 Nov 2026), on every <input type=number> in a root:
//   · drag the field's label sideways to scrub it (Shift ×10, Ctrl ×0.1): the field shows the value as it goes and
//     the edit lands once, on release (one undo step);
//   · Esc puts back the value the field had when it was focused (and leaves it, without deselecting anything);
//   · ↑ / ↓ step it (the browser's own), Shift ×10.
// scrubValue is pure (node test).
export function scrubValue({ start, dx, step = 1, min = -Infinity, max = Infinity, shift = false, ctrl = false }) {
  const k = shift ? 10 : ctrl ? .1 : 1, s = (Number.isFinite(step) && step > 0 ? step : 1) * k, v = start + Math.round(dx / 4) * s;
  const dec = Math.max(0, -Math.floor(Math.log10(s) + 1e-9) + (s % 1 ? 1 : 0)), r = Math.round(v / s) * s;
  return Math.min(max, Math.max(min, Number(r.toFixed(Math.min(6, dec + 1)))));
}
export function enhanceNumberFields(root) {
  let drag = null;
  const fieldOf = label => label?.querySelector?.('input[type=number]:not([disabled])');
  root.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ev.target.closest('input,select,textarea,button')) return;
    const label = ev.target.closest('label'), input = fieldOf(label); if (!input || !root.contains(label)) return;
    drag = { input, x: ev.clientX, start: Number(input.value) || 0, moved: false, id: ev.pointerId, label };
    try { label.setPointerCapture(ev.pointerId); } catch {}
  });
  root.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return; const dx = ev.clientX - drag.x; if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true; ev.preventDefault();
    const i = drag.input, v = scrubValue({ start: drag.start, dx, step: Number(i.step) || 1, min: i.min === '' ? -Infinity : Number(i.min), max: i.max === '' ? Infinity : Number(i.max), shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey });
    i.value = String(v); i.classList.add('nf-scrubbing');
  });
  const end = ev => {
    if (!drag || (ev.pointerId !== undefined && ev.pointerId !== drag.id)) return; const d = drag; drag = null;
    try { d.label.releasePointerCapture(d.id); } catch {}
    d.input.classList.remove('nf-scrubbing');
    if (d.moved && Number(d.input.value) !== d.start) d.input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('focusin', ev => { if (ev.target.matches?.('input[type=number]')) ev.target.dataset.nfWas = ev.target.value; });
  root.addEventListener('keydown', ev => {
    const i = ev.target; if (ev.key !== 'Escape' || !i.matches?.('input[type=number]') || i.dataset.nfWas === undefined) return;
    ev.preventDefault(); ev.stopPropagation(); if (i.value !== i.dataset.nfWas) i.value = i.dataset.nfWas; i.blur();
  }, true);
}
