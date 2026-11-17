// The Director's app bar and status bar (plan rev 3, P1b "calm shell", 17 Nov 2026): every global command once.
//   ErgoFlex Director · Cut ▾ ‹ Chapter ▾ › · ↶ ↷ · Studio badge · saved · ▶ · Sound · Low-res · Export cut ·
//   Render ▾ · ⋯ · ⌨ · Close
// It replaces the website's header, the inspector's global row (Export cut, Undo, Redo, the film picker) and the
// timeline's project row (Inspector, Titles, Chapters, Bake, + / duplicate / remove chapter, its own Undo / Redo).
// The status bar under the timeline: what the selection's keys do, and a pill for every mode that is on.
// ?shell=classic (or ⋯ → Classic layout) brings back the old arrangement (ui store `shell`).
// Pure HTML builders here (node-testable); director.mjs owns the state and runs the actions (data-action ids are the
// same as before, so the e2e tests keep their hooks).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const step = (verb, l) => l ? `${verb} ${l}` : verb;

// s: { picker (html), name, undo: {n, label}, redo: {n, label}, studio (html), playing, busy, sound, lowres (null: not
// offered), film (a film cut: Final render), history: [label…] newest first, titles, chapters, inspector, timeline }
export function appBarHtml(s) {
  const menu = (id, label, title, items) => `<div class="ab-menu" data-ab-menu="${id}"><button type="button" class="ab-btn" data-ab-open="${id}" aria-haspopup="menu" aria-expanded="false" title="${esc(title)}">${label}</button><div class="ab-pop" role="menu" hidden>${items.join('')}</div></div>`;
  const item = (action, label, hint = '', more = '') => `<button type="button" role="menuitem" data-action="${action}" ${more}><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</button>`;
  const check = (action, label, on, hint = '') => item(action, (on ? '✓ ' : '  ') + label, hint, `aria-checked="${!!on}" role="menuitemcheckbox"`);
  const history = (s.history || []).slice(0, 12);
  return `<span class="ab-brand">ErgoFlex <b>Director</b></span>
    <div class="ab-film">${s.picker || `<strong class="ab-name" title="${esc(s.name)}">${esc(s.name)}</strong>`}</div>
    <div class="ab-group ab-history"><button type="button" class="ab-btn ab-icon" data-action="undo" aria-label="${esc(step('Undo', s.undo?.label))}" title="${esc(step('Undo', s.undo?.label))} (Ctrl+Z)" ${s.undo?.n ? '' : 'disabled'}>↶</button><button type="button" class="ab-btn ab-icon" data-action="redo" aria-label="${esc(step('Redo', s.redo?.label))}" title="${esc(step('Redo', s.redo?.label))} (Ctrl+Y)" ${s.redo?.n ? '' : 'disabled'}>↷</button></div>
    <span class="studio-sync" data-studio-sync>${s.studio || ''}</span><span class="saved-indicator" data-saved title="Draft kept in this browser"></span>
    <span class="ab-spacer"></span>
    <button type="button" class="ab-btn ab-play" data-action="chapter-toggle" aria-pressed="${!!s.playing}" ${s.busy ? 'disabled' : ''} title="Play / pause the chapter (Space)">${s.playing ? '❚❚ Pause chapter' : '▶ Play chapter'}</button>
    <button type="button" class="ab-btn" data-ab-proxy="sound" aria-pressed="${!!s.sound}" title="Sound (Shift+M)">${s.sound ? '🔊 Sound' : '🔈 Muted'}</button>
    ${s.lowres === null ? '' : `<button type="button" class="ab-btn" data-ab-proxy="preview-quality" aria-pressed="${!!s.lowres}" title="Reduce the preview resolution for smoother editing (the film is not affected)">${s.lowres ? 'Low-res on' : 'Low-res'}</button>`}
    <button type="button" class="ab-btn primary" data-action="save-export" title="Download this cut for the film (Ctrl+M); also keeps a copy in this browser">Export cut</button>
    ${menu('render', 'Render ▾', 'Still image, preview video, final render', [
      item('render-still', 'Still image', 'Shift+R · this frame, full quality'),
      item('bake', 'Preview video', 'bake this chapter for smooth playback'),
      item('bake-all', 'Preview video, every chapter', '1080p'),
      ...(s.film ? [item('final-render', 'Final render…', 'on the render PC')] : []),
    ])}
    ${menu('more', '⋯', 'Cut settings, history, layout, report a problem', [
      item('cut-settings', 'Cut settings…', 'name, versions, import / export'),
      `<div class="ab-sub" role="group" aria-label="History"><p>History${history.length ? '' : ': nothing yet'}</p>${history.map((h, i) => `<button type="button" role="menuitem" data-ab-undo="${i + 1}" title="Undo back to before this step">${esc(h || 'Edit')}</button>`).join('')}</div>`,
      check('titles', 'Titles in the frame', s.titles), check('chapters', 'Chapter strip', s.chapters),
      check('inspector', 'Side column', s.inspector, 'Tab'), check('ab-timeline', 'Timeline', s.timeline, 'Shift+Tab'),
      item('ab-review', 'Review mode', 'Ctrl+` · the film alone, playing'),
      item('ab-classic', 'Classic layout', 'the old arrangement; ⋯ brings this one back'),
      item('report-problem', 'Report a problem…', 'for Claude'),
    ])}
    <button type="button" class="ab-btn ab-icon" data-action="keys-panel" title="Keys & mouse (?)" aria-label="Keys and mouse">⌨</button>
    <button type="button" class="ab-btn" data-ab-proxy="director" title="Close the Director">Close</button>`;
}
// pills: [{ id, label, on, title }] (only the ones that are on are shown, plus Snap, which is shown either way)
export function statusBarHtml(text, pills) {
  return `<span class="sb-text" data-statusbar-text title="${esc(text)}">${esc(text)}</span><span class="sb-pills">${pills.filter(p => p.on || p.always).map(p => `<button type="button" class="sb-pill${p.on ? ' on' : ''}${p.warn ? ' warn' : ''}" data-sb-pill="${esc(p.id)}" title="${esc(p.title || '')}">${esc(p.label)}</button>`).join('')}</span>`;
}
// Menus: one open at a time; Esc or a click elsewhere closes it.
export function wireMenus(root) {
  const closeAll = except => { for (const m of root.querySelectorAll('[data-ab-menu]')) if (m !== except) { m.querySelector('.ab-pop').hidden = true; m.querySelector('[data-ab-open]').setAttribute('aria-expanded', 'false'); } };
  root.addEventListener('click', ev => {
    const opener = ev.target.closest('[data-ab-open]');
    if (opener) { const m = opener.closest('[data-ab-menu]'), pop = m.querySelector('.ab-pop'), show = pop.hidden; closeAll(m); pop.hidden = !show; opener.setAttribute('aria-expanded', String(show)); if (show) pop.querySelector('button:not([disabled])')?.focus(); return; }
    if (ev.target.closest('.ab-pop button')) closeAll();
  });
  document.addEventListener('pointerdown', ev => { if (!root.contains(ev.target)) closeAll(); }, true);
  root.addEventListener('keydown', ev => { if (ev.key === 'Escape' && root.querySelector('.ab-pop:not([hidden])')) { ev.stopPropagation(); closeAll(); root.querySelector('[aria-expanded="true"]')?.focus(); } });
  return closeAll;
}
