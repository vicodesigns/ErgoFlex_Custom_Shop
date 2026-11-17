// Right-click menus (plan rev 3, P4): one floating menu for the Director. items: [{label, hint, run, disabled,
// checked}] or '-' for a line. Esc, a click elsewhere or a choice closes it.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function createContextMenu() {
  const el = document.createElement('div'); el.className = 'df-ctx ab-pop'; el.setAttribute('role', 'menu'); el.hidden = true; document.body.append(el);
  let items = [];
  function close() { el.hidden = true; items = []; }
  function open(x, y, list, title = '') {
    items = list.filter(Boolean);
    el.innerHTML = (title ? `<p class="df-ctx-title">${esc(title)}</p>` : '') + items.map((it, i) => it === '-' ? '<hr>' : `<button type="button" role="${it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}" data-ctx="${i}" ${it.disabled ? 'disabled' : ''} ${it.checked === undefined ? '' : `aria-checked="${!!it.checked}"`}><span>${it.checked ? '✓ ' : ''}${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
    el.hidden = false; const w = el.offsetWidth, h = el.offsetHeight;
    Object.assign(el.style, { position: 'fixed', left: Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px', top: Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px', right: 'auto' });
    el.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }
  el.addEventListener('click', ev => { const b = ev.target.closest('[data-ctx]'); if (!b || b.disabled) return; const it = items[Number(b.dataset.ctx)]; close(); try { it?.run?.(); } catch (e) { console.error(e); } });
  document.addEventListener('pointerdown', ev => { if (!el.hidden && !el.contains(ev.target)) close(); }, true);
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && !el.hidden) { ev.stopImmediatePropagation(); close(); } }, true);
  addEventListener('blur', close);
  return { open, close, isOpen: () => !el.hidden };
}
