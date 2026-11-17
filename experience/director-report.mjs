// The action log (the last 50 things done, by key, click or command search) and ⋯ → Report a problem: a note from
// Vico, a screenshot of the 3D view, what is selected, the log and the browser's recent errors, POSTed to the studio
// server (/__director/report → exports/director-reports/<time>/, which Claude reads; that folder never reloads a page).
// A server without the endpoint (not restarted since): the report is downloaded as a file instead.
export function createActionLog(limit = 50) {
  const items = [];
  return {
    add(id, label, via) { items.push({ at: new Date().toISOString(), id, label, via }); if (items.length > limit) items.shift(); },
    // the last command run from a key or the search (repeat-last itself, the panel and the search are not "commands")
    last() { for (let i = items.length - 1; i >= 0; i--) if (!['repeat-last', 'palette', 'keys-panel', 'keys-panel-anywhere', 'report'].includes(items[i].id)) return items[i].id; return null; },
    list: () => items.slice(),
  };
}
// Errors the page met (window error and unhandled rejections, console.error), the last 30.
export function captureErrors(win = globalThis) {
  const errors = [], push = text => { errors.push({ at: new Date().toISOString(), text: String(text).slice(0, 600) }); if (errors.length > 30) errors.shift(); };
  win.addEventListener?.('error', e => push(e.message + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
  win.addEventListener?.('unhandledrejection', e => push('Unhandled: ' + (e.reason?.message || e.reason)));
  const was = win.console?.error; if (was) win.console.error = (...a) => { try { push(a.map(x => x?.message || (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); } catch {} return was.apply(win.console, a); };
  return () => errors.slice();
}
// The report as sent. screenshot: a data: URL (png/jpeg) or null.
export function reportBody({ note, url, selection, log, errors, screenshot, view, version }) {
  return { v: 1, at: new Date().toISOString(), note: String(note || '').slice(0, 4000), url, selection, log, errors, view, version, screenshot: typeof screenshot === 'string' && /^data:image\/(png|jpeg);base64,/.test(screenshot) ? screenshot : null };
}
// The dialog: ask for a note, then send. send(body) -> Promise<{dir}|null>.
export function createReportDialog({ collect, send, status }) {
  const d = document.createElement('dialog'); d.className = 'df-report';
  d.innerHTML = `<form method="dialog"><h3>Report a problem</h3><p>What went wrong, or what did you expect? A screenshot of the view, what is selected and your last 50 actions go with it, for Claude to read.</p>
    <textarea name="note" rows="5" placeholder="e.g. I pressed W on Maya and nothing happened"></textarea>
    <label><input type="checkbox" name="shot" checked> Include a screenshot of the 3D view</label>
    <menu><button value="cancel" type="submit">Cancel</button><button value="send" type="submit" class="primary">Send report</button></menu></form>`;
  document.body.append(d);
  d.addEventListener('close', async () => {
    if (d.returnValue !== 'send') return;
    const note = d.querySelector('textarea').value, shot = d.querySelector('[name=shot]').checked;
    try { const body = await collect({ note, shot }), r = await send(body); status(r?.dir ? `Report saved for Claude: ${r.dir}` : 'Report downloaded (this server cannot save it): send Claude the file.'); }
    catch (e) { status('The report could not be made: ' + e.message, true); }
    d.querySelector('textarea').value = '';
  });
  return { open() { if (!d.open) d.showModal(); d.querySelector('textarea').focus(); } };
}
// POST to the studio server; on a 404/405 (an older server) download the report as a JSON file.
export async function sendReport(body, { fetch: f = globalThis.fetch, download } = {}) {
  try {
    const r = await f('/__director/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return await r.json();
    if (r.status !== 404 && r.status !== 405) throw Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
  } catch (e) { if (!/fetch|network|HTTP 40[45]/i.test(e.message)) throw e; }
  download?.(body); return null;
}
