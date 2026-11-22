// Phone mode for the Director (23 Nov 2026, Vico's Galaxy Z Fold 5 over the tailnet): a coarse pointer on a screen up to
// 1200 CSS px wide. The page asks for it with matchMedia('(pointer: coarse)') and the layout viewport's size
// (the visual viewport changes while pinching or when the keyboard shows; the layout viewport follows the keyboard only
// with interactive-widget=resizes-content, which index.html asks for).
//   body.ef-phone + body.ef-portrait | body.ef-landscape    set only for a coarse pointer; director-phone.css keys on these
//   portrait   the stage on top, the timeline under it, the inspector a bottom sheet: peek (a handle) / half / full
//              (body.ef-sheet-peek | ef-sheet-half | ef-sheet-full; the handle: tap, or drag up / down)
//   landscape  the stage on the left over the timeline, the inspector a side drawer: body.inspector-hidden is the drawer
//              closed (the existing class, so the ⋯ menu and the Tab key stay in step); the tab on the edge opens it
//   --ef-top   the bottom of the app bar in px (the app bar wraps to two rows on a narrow screen)
// The choices (sheet, drawer, the Guided demo card) are remembered per device in localStorage.
// Pure parts (phoneLayout, nextSheet, dragSheet) are node-tested (tests/fold-titles-test.mjs).
export const PHONE_KEY = 'ergoflex.director.phone.v1', DEMO_KEY = 'ergoflex.director.demoCard.v1';
export const PHONE_MAX_WIDTH = 1200;
const SHEETS = ['peek', 'half', 'full'];

export function phoneLayout({ coarse, width, height }) {
  if (!coarse || !(width > 0) || !(height > 0) || width > PHONE_MAX_WIDTH) return null;
  return height > width ? 'portrait' : 'landscape';
}
// A tap on the handle: peek -> half, half -> peek, full -> half. A drag: up opens one step more, down one step less.
export function nextSheet(sheet, how) {
  const i = Math.max(0, SHEETS.indexOf(sheet));
  if (how === 'up') return SHEETS[Math.min(2, i + 1)];
  if (how === 'down') return SHEETS[Math.max(0, i - 1)];
  return sheet === 'peek' ? 'half' : sheet === 'half' ? 'peek' : 'half';
}
// The portrait fit: the timeline as tall as its lanes need, the height left over to the sheet at peek. Pure and idempotent:
// fitSheet(same inputs, its own result as prev) gives the same result, so a re-measure after its own change never moves anything.
// need is quantised to `step` px and a change smaller than `slack` px is ignored (the lanes' content jitters by a pixel or two);
// the peek sheet shows the inspector ("roomy") from `roomyIn` px of spare height and stops showing it below `roomyOut` (hysteresis).
export function fitSheet({ need, avail, handle = 52, prev = null, roomyIn = 160, roomyOut = 110, step = 8, slack = 12 }) {
  avail = Math.max(120, Math.round(avail));
  let h = Math.min(Math.ceil(need / step) * step, avail);
  if (prev && prev.h <= avail && Math.abs(h - prev.h) < slack && !(prev.h === avail && h < avail)) h = prev.h;
  const left = Math.max(0, avail - h), roomy = prev?.roomy ? left >= roomyOut : left >= roomyIn;
  return { h, peek: handle + left, roomy, avail };
}
export const dragSheet = (sheet, dy, slop = 24) => Math.abs(dy) < slop ? nextSheet(sheet, 'tap') : nextSheet(sheet, dy < 0 ? 'up' : 'down');

const load = () => { try { return JSON.parse(localStorage.getItem(PHONE_KEY) || '{}') || {}; } catch { return {}; } };
const save = v => { try { localStorage.setItem(PHONE_KEY, JSON.stringify(v)); } catch { /* storage full: the choice lasts this visit */ } };

// appbar, panel: the Director's elements; shellOn(): the calm layout is on (the phone layout needs its app bar).
export function createPhoneMode({ appbar, panel, shellOn = () => true, changed = () => {} }) {
  const body = document.body, cls = body.classList, coarse = matchMedia('(pointer: coarse)');
  let mode = null, store = load(), wasOpen = false, labelText = '';
  if (!SHEETS.includes(store.sheet)) store.sheet = 'peek';

  const handle = document.createElement('div');
  handle.id = 'ef-sheet-handle'; handle.setAttribute('role', 'button'); handle.tabIndex = 0;
  handle.setAttribute('aria-label', 'Inspector sheet: tap or drag to open and close');
  handle.innerHTML = '<span class="ef-grip" aria-hidden="true"></span><span class="ef-sheet-label" data-ef-sheet-label>Inspector</span><span class="ef-sheet-state" aria-hidden="true"></span>';
  const tab = document.createElement('button');
  tab.id = 'ef-drawer-tab'; tab.type = 'button'; tab.setAttribute('aria-label', 'Show or hide the inspector'); tab.innerHTML = '<span aria-hidden="true">‹</span>';
  body.append(handle, tab);

  const size = () => ({ width: innerWidth, height: innerHeight });
  const setSheet = (sheet, keep = false) => {
    store.sheet = sheet; if (!keep) save(store);
    for (const s of SHEETS) cls.toggle('ef-sheet-' + s, mode === 'portrait' && s === sheet);
    handle.setAttribute('aria-expanded', String(sheet !== 'peek')); handle.dataset.sheet = sheet;
    changed(); scheduleFit();
  };
  const setDrawer = (open, keep = false) => {
    cls.toggle('inspector-hidden', !open); if (!keep) { store.drawer = open; save(store); }
    tab.setAttribute('aria-expanded', String(open)); tab.firstChild.textContent = open ? '›' : '‹'; changed();
  };
  // Portrait: the timeline as tall as its lanes need (no dark empty area under a short lane list: Windows at 884 x 1100);
  // the height left over goes to the sheet, which then shows the inspector even at peek when there is room for it.
  // (measured on the lanes' content, not the scrolling viewport, so the size never feeds back into itself)
  const HANDLE = 52;
  let lastFit = null, fitTimer = 0, fitFrame = 0;
  const setVar = (name, value) => { if (body.style.getPropertyValue(name) !== value) body.style.setProperty(name, value); };
  function fitPortrait() {
    const tl = document.getElementById('director-timeline'), vp = tl?.querySelector('.timeline-viewport'), content = vp?.querySelector('.timeline-content');
    if (mode !== 'portrait' || !tl || !vp || !content) { lastFit = null; body.style.removeProperty('--ef-tl-h'); body.style.removeProperty('--ef-peek'); cls.remove('ef-peek-roomy'); return; }
    const top = tl.getBoundingClientRect().top, need = Math.ceil(tl.offsetHeight - vp.clientHeight + content.scrollHeight + 2);
    const fit = fitSheet({ need, avail: innerHeight - top - HANDLE - 8, handle: HANDLE, prev: lastFit });
    lastFit = fit; setVar('--ef-tl-h', fit.h + 'px'); setVar('--ef-peek', fit.peek + 'px'); if (cls.contains('ef-peek-roomy') !== fit.roomy) cls.toggle('ef-peek-roomy', fit.roomy);
  }
  // No timer: the fit runs when something real changed (the window, the app bar, the lanes' size or a re-render of the timeline, the sheet)
  // and is coalesced to one run a frame after the changes stop.
  const scheduleFit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fitPortrait); }, 60); };
  function measure() {
    if (!cls.contains('directing') || appbar.hidden) return;
    const r = appbar.getBoundingClientRect(); if (r.height) setVar('--ef-top', Math.round(r.bottom + 8) + 'px');
    scheduleFit();
  }
  // Only touch classList when state actually changes: DOMTokenList.remove/toggle otherwise re-triggers MutationObserver.
  const setCls = (name, on) => { if (cls.contains(name) !== !!on) cls.toggle(name, !!on); };
  function apply() {
    const m = shellOn() ? phoneLayout({ coarse: coarse.matches, ...size() }) : null, was = mode; mode = m;
    const isOpen = cls.contains('directing'), openChanged = isOpen !== wasOpen;
    // Always record wasOpen before the desktop (!m) early return; leaving it false caused an infinite MutationObserver
    // microtask loop whenever 'directing' was added on desktop browsers.
    wasOpen = isOpen;
    setCls('ef-phone', !!m); setCls('ef-portrait', m === 'portrait'); setCls('ef-landscape', m === 'landscape');
    if (!m) { for (const s of SHEETS) setCls('ef-sheet-' + s, false); body.style.removeProperty('--ef-top'); syncDemo(); return; }
    if (m !== was) changed();
    if (m !== was || openChanged) {
      if (m === 'portrait') { setCls('inspector-hidden', false); setSheet(store.sheet, true); }
      else { for (const s of SHEETS) setCls('ef-sheet-' + s, false); setDrawer(store.drawer !== false, true); }
    }
    measure(); syncDemo();
  }
  // Portrait has no "hidden inspector": the existing ⋯ and Tab toggle (and ≤ 700 px's start) mean the handle only.
  new MutationObserver(() => {
    if (mode === 'portrait' && cls.contains('inspector-hidden')) { cls.remove('inspector-hidden'); setSheet('peek', true); }
    if (cls.contains('directing') !== wasOpen) apply();
    tab.firstChild.textContent = cls.contains('inspector-hidden') ? '‹' : '›';
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  let lastTouch = -1e9; document.addEventListener('pointerdown', () => { lastTouch = performance.now(); }, true);
  // the handle: tap, or a drag up / down
  let down = null;
  handle.addEventListener('pointerdown', e => { if (e.button) return; down = { y: e.clientY, id: e.pointerId }; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
  handle.addEventListener('pointerup', e => { if (!down) return; const dy = e.clientY - down.y; down = null; setSheet(dragSheet(store.sheet, dy)); });
  handle.addEventListener('pointercancel', () => { down = null; });
  handle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet(nextSheet(store.sheet, 'tap')); } });
  tab.addEventListener('click', () => setDrawer(cls.contains('inspector-hidden')));

  // The Guided demo card (#demo): hidden by default on a phone, closable everywhere, remembered.
  const demoStored = () => { try { return localStorage.getItem(DEMO_KEY); } catch { return null; } };
  function syncDemo() { const v = demoStored(); setCls('ef-demo-closed', v === 'closed' || (v !== 'open' && !!mode)); }
  function demo(open) { try { localStorage.setItem(DEMO_KEY, open ? 'open' : 'closed'); } catch { /* this visit only */ } cls.toggle('ef-demo-closed', !open); changed(); }
  document.addEventListener('click', e => { if (e.target.closest?.('#demo-close')) demo(false); });

  // The handle says what the sheet holds: the tab and the selection.
  function label() {
    const t = panel.querySelector('[data-inspector-tab][aria-pressed="true"]')?.textContent.trim() || 'Inspector', sel = panel.querySelector('.sel-name b')?.textContent.trim() || '';
    const text = !sel ? t : sel.startsWith(t) ? sel : `${t} · ${sel}`; if (text !== labelText) { labelText = text; handle.querySelector('[data-ef-sheet-label]').textContent = text; }
  }
  setInterval(() => { if (mode) label(); }, 500);
  coarse.addEventListener?.('change', apply); addEventListener('resize', apply); addEventListener('orientationchange', () => setTimeout(apply, 120));
  if ('ResizeObserver' in window) {
    new ResizeObserver(measure).observe(appbar);
    const lanes = new ResizeObserver(scheduleFit);   // the lanes' content (the timeline is rebuilt on every edit: re-attach when it is)
    const watch = () => { lanes.disconnect(); const tl = document.getElementById('director-timeline'); for (const e of [tl?.querySelector('.timeline-viewport'), tl?.querySelector('.timeline-content')]) if (e) lanes.observe(e); };
    const tl = document.getElementById('director-timeline'); if (tl) { new MutationObserver(() => { watch(); scheduleFit(); }).observe(tl, { childList: true }); watch(); }
  }
  visualViewport?.addEventListener('resize', scheduleFit);
  apply();
  return {
    apply, layout: () => mode, sheet: () => store.sheet,
    // The app bar's Panel button and the ⋯ Side column: portrait toggles the sheet, landscape the drawer.
    togglePanel() { if (mode === 'portrait') { setSheet(store.sheet === 'peek' ? 'half' : 'peek'); return true; } if (mode === 'landscape') { setDrawer(cls.contains('inspector-hidden')); return true; } return false; },
    // A selection on the timeline or in the frame asks to show its inspector: a sheet at peek comes up to half, a closed drawer opens (not remembered).
    reveal() { if (performance.now() - lastTouch > 1200) return;   // only a user's own selection, never a re-render
      if (mode === 'portrait' && store.sheet === 'peek') setSheet('half', true); else if (mode === 'landscape' && cls.contains('inspector-hidden')) setDrawer(true, true); },
    demo, demoOpen: () => !cls.contains('ef-demo-closed'),
  };
}
