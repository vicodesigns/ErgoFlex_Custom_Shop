// Autosave to disk (17 Nov 2026, Vico: "So many times I've been … losing work … what about just adding an autosave").
// The open Director project goes to the studio server (tools/studio-server.mjs /__director/autosave, kept under
// exports/director-autosaves/<cut>/<chapter>/, tools/studio-state/autosave-store.mjs):
//   QUIET s after the last change (at most every MAX_WAIT s while editing), and at once before anything replaces the
//   editor (a chapter or cut switch, Export cut, the film's newer version, a restore) and when the tab goes away.
// The browser draft (film-fresh.mjs / the library) stays as it was: this is a second, lasting copy with history.
// File ▸ Autosaves… lists them; Restore first autosaves what is open, then loads the version as an unexported draft.
const QUIET = 3000, MAX_WAIT = 10000, BEACON_MAX = 60000;
export const REASON_LABEL = { edit: 'edit', chapter: 'before switching', close: 'tab closed', export: 'before Export cut', replace: 'before the film\'s version', restore: 'before a restore', reopen: 'reopened draft' };
const pad = n => String(n).padStart(2, '0');
export function when(iso, now = new Date()) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}
// where a project's autosaves go: the film cut's folder name and the chapter id, or a library cut's own id
export function placeOf(cutDir, project) {
  const clean = s => String(s || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, 90);
  const cut = cutDir ? clean(String(cutDir).replace(/\/+$/, '').split('/').pop()) : clean('library-' + (project?.id || 'project'));
  const chapter = cutDir && project?.shots?.length === 1 ? clean(project.shots[0].id) : 'project';
  return { cut: cut || 'library-project', chapter: chapter || 'project' };
}

export function createAutosave({ place, project, groups = () => [], escape, onState = () => {}, restore, status, fetcher = (...a) => globalThis.fetch(...a) }) {
  let timer = 0, first = 0, last = '', inflight = null, state = { kind: 'idle' };
  const set = s => { state = s; onState(s); };
  function text() {
    if (state.kind === 'saved') return { text: `Autosaved ${when(state.at)} ✓`, title: 'Kept on this computer (exports/director-autosaves) · File ▸ Autosaves… brings back an earlier version · Export cut sends it to the film', warn: false };
    if (state.kind === 'saving' || state.kind === 'pending') return { text: 'Autosaving…', title: 'Your edits are being written to this computer', warn: false };
    if (state.kind === 'off') return { text: 'Autosave off: restart the studio server', title: 'This studio server is older than autosave: restart it once (node tools/studio-server.mjs). Your edits are still kept as a browser draft.', warn: true };
    if (state.kind === 'error') return { text: 'Not autosaved', title: `Autosave failed: ${state.error}. Your edits are still kept as a browser draft.`, warn: true };
    return { text: '', title: '', warn: false };
  }
  const body = reason => { const p = project(); return JSON.stringify({ v: 1, ...place(), reason, groups: groups(), project: p }); };
  async function save(reason = 'edit', { force = false } = {}) {
    clearTimeout(timer); timer = 0; first = 0;
    const b = body(reason), same = b.replace(/"reason":"[a-z]+",/, '') === last;
    if (same && !force) { if (state.kind === 'pending') set(state.at ? { kind: 'saved', at: state.at } : { kind: 'idle' }); return state; }
    if (inflight) await inflight.catch(() => {});
    set({ kind: 'saving', at: state.at });
    inflight = (async () => {
      const r = await fetcher('/__director/autosave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: b });
      if (r.status === 404 || r.status === 405) { set({ kind: 'off' }); return state; }
      let v = null; try { v = await r.json(); } catch {}
      if (!r.ok) throw Error(v?.error || `the server said ${r.status}`);
      last = b.replace(/"reason":"[a-z]+",/, ''); set({ kind: 'saved', at: v?.at || new Date().toISOString(), file: v?.file }); return state;
    })().catch(error => { set({ kind: 'error', error: error.message }); return state; }).finally(() => { inflight = null; });
    return inflight;
  }
  // a change: saved once things are quiet, or after MAX_WAIT of steady editing
  function poke() {
    if (state.kind === 'off') return;
    const now = Date.now(); if (!first) first = now;
    clearTimeout(timer); timer = setTimeout(() => save('edit'), Math.max(0, Math.min(QUIET, first + MAX_WAIT - now)));
    if (state.kind !== 'saving') set({ ...state, kind: 'pending' });
  }
  // the tab is going: what is still waiting goes now (keepalive, when small enough for the browser to let it)
  function closing() {
    if (!timer && state.kind !== 'pending') return; clearTimeout(timer); timer = 0;
    const b = body('close'); if (b.replace(/"reason":"[a-z]+",/, '') === last || b.length > BEACON_MAX) return;
    try { fetcher('/__director/autosave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: b, keepalive: true }).catch(() => {}); } catch {}
  }
  // ---- File ▸ Autosaves…
  let dialog = null, rows = [];
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog'); dialog.id = 'director-autosaves'; dialog.setAttribute('aria-labelledby', 'director-autosaves-title'); document.body.append(dialog);
    dialog.addEventListener('click', onClick); return dialog;
  }
  async function open() {
    ensureDialog();
    const { cut, chapter } = place(), e = escape;
    dialog.innerHTML = `<div class="director-heading"><div><span class="director-kicker">AUTOSAVES</span><h2 id="director-autosaves-title">Earlier versions</h2></div><button type="button" data-autosave-close aria-label="Close">✕</button></div><p class="director-hint">Loading…</p>`;
    if (!dialog.open) dialog.showModal();
    await save('edit');
    let list = [];
    try { const r = await fetcher(`/__director/autosaves?cut=${encodeURIComponent(cut)}`, { cache: 'no-store' }); if (r.status === 404) throw Error('this studio server is older than autosave: restart it once'); const v = await r.json(); if (!r.ok) throw Error(v.error); list = v.list || []; }
    catch (error) { dialog.querySelector('.director-hint').textContent = 'No autosaves: ' + error.message; return; }
    rows = list; const mine = list.filter(x => x.chapter === chapter), others = list.filter(x => x.chapter !== chapter);
    const row = (x, i, here) => `<li class="autosave-row ${here ? '' : 'other'}"><span class="autosave-time">${e(when(x.at))}</span><span class="autosave-why">${e(REASON_LABEL[x.reason] || x.reason)}</span><span class="autosave-groups">${x.groups?.length ? e('changed: ' + x.groups.join(', ')) : 'as the film'}</span><small>${Math.max(1, Math.round((x.bytes || 0) / 1024))} KB</small>${here ? `<button type="button" data-autosave-restore="${i}">Restore</button>` : `<small class="autosave-elsewhere">${e(x.chapter)}: open that chapter to restore</small>`}</li>`;
    dialog.innerHTML = `<div class="director-heading"><div><span class="director-kicker">AUTOSAVES</span><h2 id="director-autosaves-title">Earlier versions of this chapter</h2></div><button type="button" data-autosave-close aria-label="Close">✕</button></div>
      <p class="director-hint">Kept on this computer: the last 30, then one an hour for two weeks, then one a day. Restore saves what is open first, then brings the version back as an unexported draft; Export cut sends it to the film.</p>
      ${mine.length ? `<ol class="autosave-list">${mine.map(x => row(x, list.indexOf(x), true)).join('')}</ol>` : '<p class="director-hint">No autosaves of this chapter yet.</p>'}
      ${others.length ? `<details class="autosave-others"><summary>Other chapters of this cut (${others.length})</summary><ol class="autosave-list">${others.slice(0, 60).map(x => row(x, list.indexOf(x), false)).join('')}</ol></details>` : ''}`;
  }
  async function onClick(event) {
    if (event.target.closest('[data-autosave-close]') || event.target === dialog) { dialog.close(); return; }
    const b = event.target.closest('[data-autosave-restore]'); if (!b) return;
    const x = rows[Number(b.dataset.autosaveRestore)]; if (!x) return; const { cut } = place();
    b.disabled = true; b.textContent = 'Restoring…';
    try {
      await save('restore', { force: true });
      if (state.kind === 'error') throw Error('what is open could not be saved first (' + state.error + ')');
      const r = await fetcher(`/__director/autosave?cut=${encodeURIComponent(cut)}&chapter=${encodeURIComponent(x.chapter)}&file=${encodeURIComponent(x.file)}`, { cache: 'no-store' });
      const v = await r.json(); if (!r.ok) throw Error(v.error || r.status);
      dialog.close(); restore(v, x); last = '';
      status(`Restored the autosave from ${when(x.at)} as an unexported draft. What was open is saved too (File ▸ Autosaves…, “before a restore”).`);
    } catch (error) { b.disabled = false; b.textContent = 'Restore'; status('Not restored: ' + error.message, true); }
  }
  return { poke, save, closing, open, text, state: () => state };
}
