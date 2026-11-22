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
  // On a phone the bar keeps Undo / Redo, Export cut, Send to desk, Render and Panel; the rest lives in the ⋯ menu.
  const proxy = (id, label, on) => `<button type="button" role="menuitem" data-ab-proxy="${id}" aria-pressed="${!!on}"><span>${esc(label)}</span></button>`;
  const phoneItems = [
    item('chapter-toggle', s.playing ? 'Pause chapter' : 'Play chapter'),
    proxy('sound', s.sound ? 'Sound on' : 'Sound off (muted)', s.sound),
    ...(s.lowres === null ? [] : [proxy('preview-quality', s.lowres ? 'Low-res on' : 'Low-res', s.lowres)]),
    item('hold-camera', s.held ? '● Editing camera (on)' : 'Editing camera', 'keep the view where you put it'),
    ...(s.overlays ? [
      check('ov-guides', 'Thirds and title-safe guides', s.overlays.guides),
      item('ov-crop', 'Crop guide: ' + (s.overlays.crop || 'off')),
      item('ov-look', 'Film look: ' + (s.overlays.look || 'live')),
      check('ov-lights', 'Light markers', s.overlays.lights),
    ] : []),
    check('demo-card', 'Guided demo card', s.demoCard),
    proxy('director', 'Close the Director'),
  ];
  return `${s.phone ? '' : '<span class="ab-brand">ErgoFlex <b>Director</b></span>'}
    <div class="ab-film">${s.picker || `<strong class="ab-name" title="${esc(s.name)}">${esc(s.name)}</strong>`}</div>
    <div class="ab-group ab-history"><button type="button" class="ab-btn ab-icon" data-action="undo" aria-label="${esc(step('Undo', s.undo?.label))}" title="${esc(step('Undo', s.undo?.label))} (Ctrl+Z)" ${s.undo?.n ? '' : 'disabled'}>↶</button><button type="button" class="ab-btn ab-icon" data-action="redo" aria-label="${esc(step('Redo', s.redo?.label))}" title="${esc(step('Redo', s.redo?.label))} (Ctrl+Y)" ${s.redo?.n ? '' : 'disabled'}>↷</button></div>
    <span class="studio-sync" data-studio-sync>${s.studio || ''}</span><span class="saved-indicator${s.saved?.warn ? ' warn' : ''}" data-saved title="${esc(s.saved?.title || 'Draft kept in this browser')}">${esc(s.saved?.text || '')}</span>
    <span class="ab-spacer"></span>
    ${s.phone ? '' : `<button type="button" class="ab-btn ab-play" data-action="chapter-toggle" aria-pressed="${!!s.playing}" ${s.busy ? 'disabled' : ''} title="Play / pause the chapter (Space)">${s.playing ? '❚❚ Pause chapter' : '▶ Play chapter'}</button>`}
    ${s.phone ? '' : `<button type="button" class="ab-btn" data-ab-proxy="sound" aria-pressed="${!!s.sound}" title="Sound (Shift+M)">${s.sound ? '🔊 Sound' : '🔈 Muted'}</button>`}
    ${s.phone ? '' : `${s.lowres === null ? '' : `<button type="button" class="ab-btn" data-ab-proxy="preview-quality" aria-pressed="${!!s.lowres}" title="Reduce the preview resolution for smoother editing (the film is not affected)">${s.lowres ? 'Low-res on' : 'Low-res'}</button>`}`}
    ${s.phone ? '' : `<button type="button" class="ab-btn ab-hold${s.held ? ' on' : ''}" data-action="hold-camera" aria-pressed="${!!s.held}" title="Editing camera (Shift+C): ${s.held ? 'ON: the view stays where you put it while the chapter plays or scrubs. Click: back to the film camera' : 'keep the view where you put it while the chapter plays or scrubs'}">${s.held ? '● Editing camera' : 'Editing camera'}</button>`}
    <button type="button" class="ab-btn primary" data-action="save-export" title="Download this cut for the film (Ctrl+M); also keeps a copy in this browser">Export cut</button>
    ${s.film ? '<button type="button" class="ab-btn ab-send" data-action="send-desk" title="Send this chapter to the desk, where the film takes it in (for a phone or tablet: Export cut downloads to the device)">Send to desk</button>' : ''}
    ${menu('render', 'Render ▾', 'Still image, preview video, final render', [
      item('render-still', 'Still image', 'Shift+R · this frame, full quality'),
      item('bake', 'Preview video', 'bake this chapter for smooth playback'),
      item('bake-all', 'Preview video, every chapter', '1080p'),
      ...(s.film ? [item('final-render', 'Final render…', 'on the render PC')] : []),
    ])}
    ${s.overlays && !s.phone ? menu('overlays', 'Overlays ▾', 'What is drawn over the frame (Shift+O)', [
      check('ov-guides', 'Thirds and title-safe guides', s.overlays.guides, 'G'),
      item('ov-crop', 'Crop guide: ' + (s.overlays.crop || 'off'), 'Shift+G · 9:16 · 1:1 · 4:5'),
      item('ov-look', 'Film look: ' + (s.overlays.look || 'live'), 'V · Live / Film look / Split'),
      check('ov-lights', 'Light markers', s.overlays.lights, 'Shift+L'),
      check('titles', 'Titles in the frame', s.titles),
    ]) : ''}
    ${s.phone ? `<button type="button" class="ab-btn ab-panel" data-action="inspector" aria-pressed="${!!s.inspector}" title="Show or hide the inspector">Panel</button>` : ''}
    ${menu('more', '⋯', 'Cut settings, history, layout, report a problem', [
      ...(s.phone ? phoneItems : []),
      item('autosaves', 'Autosaves…', 'Ctrl+Alt+S · earlier versions, kept on this computer'),
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
