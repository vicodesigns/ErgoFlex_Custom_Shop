// Director on a Galaxy Z Fold 5, touch only: Chrome touch emulation at the inner screen, real touch events (CDP
// Input.dispatchTouchEvent: no mouse, no keyboard). For each size (default 884x1100 portrait, then 1100x884 landscape):
//   layout        phone mode on, the Guided demo card hidden, the Film / Persp / Top / Front / Right buttons reachable,
//                 Export cut and Send to desk on screen, nothing overlaps the cut picker, tap targets >= 44 px, fields >= 16 px
//   inspector     landscape: the drawer's tab closes and opens it (remembered); portrait: the bottom sheet peek / half / full
//   titles        tap a block (select), drag it (move), drag its end handle (trim), Undo, + Add title, edit the text with
//                 the (simulated) keyboard, nudge buttons, Delete; scrub the ruler; play / pause; pinch-zoom is not locked
//   send to desk  the Send to desk button posts the chapter; the file lands in a SCRATCH Downloads (never ~/Downloads)
//
//   node tests/fold-titles-e2e.mjs [--shots DIR] [--chapter awareness] [--views 884x1100,1100x884]
//   env: CHROME (browser path), BASE (an already running server: Send to desk is then skipped, it would write to that
//        server's real Downloads), HQ (the cut folder, default exports/cinematic-intro-cut-vicos-3rd-cut), VIEWS
//   e.g. on Windows (PowerShell):  $env:CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; node tests/fold-titles-e2e.mjs --shots shots\fold
// It starts its own scratch studio server (tests/director-e2e-harness.mjs), so no BASE is needed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const shots = opt('shots', null), CHAPTER = opt('chapter', 'awareness');
const VIEWS = String(opt('views', process.env.VIEWS || '884x1100,1100x884')).split(',').map(v => v.trim().match(/^(\d+)x(\d+)$/)).filter(Boolean).map(m => ({ width: Number(m[1]), height: Number(m[2]) }));
process.env.HQ ||= 'exports/cinematic-intro-cut-vicos-3rd-cut';
const inbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-inbox-'));
process.env.DIRECTOR_INBOX_DIR = inbox;            // the scratch server writes Send to desk here, never into ~/Downloads
process.env.DIRECTOR_IMPORT_DIRS = '';
const { openDirectorBrowser, openChapter, chapterList, wait } = await import('./director-e2e-harness.mjs');

if (shots) fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const check = (ok, label, extra = '') => { log(ok ? 'PASS' : 'FAIL', label, ok ? '' : extra); if (!ok) failures++; };

const chapters = chapterList(), chapter = chapters?.find(c => c.id === CHAPTER);
if (!chapter) { console.error(`no chapter "${CHAPTER}" in ${process.env.HQ}/director-chapters.json`); process.exit(2); }
const { base, page, errors, close } = await openDirectorBrowser({ width: VIEWS[0].width, height: VIEWS[0].height });
const cdp = await page.createCDPSession();
const fold = v => page.setViewport({ ...v, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });   // (coarse pointer, no hover, a mobile layout viewport)

// ---- touch (the page gets touch events and the pointer events made from them; never a mouse)
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
async function tap(x, y) { await touch('touchStart', [[x, y]]); await wait(70); await touch('touchEnd', []); await wait(350); }
async function drag(from, to, { steps = 14, hold = 0 } = {}) {
  await touch('touchStart', [from]); if (hold) await wait(hold);
  for (let i = 1; i <= steps; i++) { await touch('touchMove', [[from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps]]); await wait(16); }
  await touch('touchEnd', []); await wait(450);
}
const centre = sel => page.evaluate(sel => {
  const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = e.getBoundingClientRect(); return r.width && r.height ? [r.x + r.width / 2, r.y + r.height / 2] : null;
}, sel);
const tapSel = async sel => { const c = await centre(sel); if (!c) throw Error('nothing to tap: ' + sel); await tap(...c); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const statusText = () => ev(() => document.querySelector('#director-panel [data-status]')?.textContent || '');
const timelineStatus = () => ev(() => document.querySelector('#director-timeline [data-timeline-status]')?.textContent || '');
const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
const body = () => ev(() => [...document.body.classList].filter(c => /^(ef-|inspector-hidden|directing)/.test(c)).sort().join(' '));
const blocks = () => ev(() => [...document.querySelectorAll('[data-title-clip]')].map(b => ({ id: b.dataset.titleClip, sel: b.classList.contains('selected'), text: b.querySelector('small')?.textContent || '', name: b.querySelector('strong')?.textContent || '' })));
const times = t => (t.match(/([\d.]+)–([\d.]+)s/) || []).slice(1, 3).map(Number);

// ---- measurements
const small = (sel, min = 44) => ev((sel, min) => [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && (r.height < min - .5 || r.width < min - .5); }).map(e => `${e.tagName.toLowerCase()}${e.dataset.action ? '[' + e.dataset.action + ']' : ''}${e.className ? '.' + String(e.className).split(' ')[0] : ''} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), sel, min);
const onScreen = sel => ev(sel => { const e = document.querySelector(sel); if (!e) return { found: false }; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { found: true, shown: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0, inside: r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, w: r.width, h: r.height, x: r.x, y: r.y, r: r.right, b: r.bottom }; }, sel);
const rectOf = sel => ev(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: getComputedStyle(e).display !== 'none' && r.width > 0 }; }, sel);
const apart = (a, b, gap = 0) => !a || !b || !a.shown || !b.shown || a.r <= b.x + gap || b.r <= a.x + gap || a.b <= b.y + gap || b.b <= a.y + gap;
const appbarOverlaps = () => ev(() => {
  const items = [];
  for (const c of document.querySelectorAll('#director-appbar>*')) {
    const parts = c.classList.contains('ab-film') ? [...c.querySelectorAll('select,strong')] : c.classList.contains('ab-menu') ? [c.querySelector('[data-ab-open]')] : c.classList.contains('studio-sync') ? [...c.querySelectorAll('button')] : c.classList.contains('ab-group') ? [...c.querySelectorAll('button')] : [c];
    for (const p of parts) { if (!p) continue; const r = p.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && getComputedStyle(p).display !== 'none') items.push({ name: (p.dataset.action || p.name || p.className || p.tagName).toString().slice(0, 30), x: r.x, y: r.y, r: r.right, b: r.bottom }); }
  }
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (a.r > b.x + 1 && b.r > a.x + 1 && a.b > b.y + 1 && b.b > a.y + 1) out.push(a.name + ' x ' + b.name); }
  return { n: items.length, out };
});

async function layoutChecks(tag, landscape) {
  const bodyClasses = await body();
  check(/ef-phone/.test(bodyClasses) && bodyClasses.includes(landscape ? 'ef-landscape' : 'ef-portrait'), `${tag}: phone mode is on (${bodyClasses})`);
  check(await ev(() => matchMedia('(pointer: coarse)').matches), `${tag}: the page sees a coarse pointer (touch emulation)`);
  // the Guided demo card
  const demo = await ev(() => { const d = document.getElementById('demo'); return { shown: !!d && getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0 }; });
  check(!demo.shown, `${tag}: the Guided demo card is hidden by default`);
  // the view buttons
  const views = await ev(() => [...document.querySelectorAll('[data-nav-view]')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.navView, ok: r.width >= 43.5 && r.height >= 43.5 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, w: Math.round(r.width), h: Math.round(r.height) }; }));
  check(views.length === 5 && views.every(v => v.ok), `${tag}: Film / Persp / Top / Front / Right are on screen and 44 px`, JSON.stringify(views));
  await tapSel('[data-nav-view="view-top"]'); await wait(300);
  check(/Top view/.test(await statusText()), `${tag}: tapping Top changes the view`, await statusText());
  await tapSel('[data-nav-view="film-camera"]'); await wait(300);
  // the app bar
  for (const a of ['save-export', 'send-desk', 'undo', 'redo', 'inspector']) {
    const o = await onScreen(`#director-appbar [data-action="${a}"]`);
    check(o.found && o.shown && o.inside && o.h >= 43.5, `${tag}: ${a} is on screen and 44 px tall`, JSON.stringify(o));
  }
  const ov = await appbarOverlaps(); check(ov.n > 5 && ov.out.length === 0, `${tag}: nothing in the app bar overlaps the cut picker or another control`, JSON.stringify(ov));
  const refresh = await rectOf('#director-appbar [data-studio-refresh]'), picker = await rectOf('#director-appbar .ab-film');
  check(apart(refresh, picker), `${tag}: Refresh from Studio (when shown) does not cover the cut picker`, JSON.stringify({ refresh, picker }));
  const bar = await rectOf('#director-appbar'), stage = await rectOf('#stage');
  check(bar.r <= await ev(() => innerWidth) + .5 && bar.b < stage.y + 1, `${tag}: the app bar fits the width and sits above the stage`, JSON.stringify({ bar, stage }));
  // areas do not overlap
  const tl = await rectOf('#director-timeline'), panel = await rectOf('#director-panel');
  check(apart(stage, tl, 1), `${tag}: the stage and the timeline do not overlap`, JSON.stringify({ stage, tl }));
  if (landscape && panel?.shown) check(apart(panel, tl, 1) && apart(panel, stage, 1), `${tag}: the drawer overlaps neither the stage nor the timeline`, JSON.stringify({ panel, stage, tl }));
  check(stage.w > 200 && stage.h > 110, `${tag}: the stage is a real size (${Math.round(stage.w)}x${Math.round(stage.h)})`);
  // tap targets and fields
  const tiny = [...await small('#director-appbar .ab-btn, #director-appbar select'), ...await small('#director-timeline .timeline-transport button, #director-timeline .title-add, #director-timeline .timeline-zoom button, #director-timeline .magnet'), ...(panel?.shown ? await small('#director-panel [data-title-action], #director-panel .inspector-tabs button') : [])];
  check(tiny.length === 0, `${tag}: tap targets are at least 44 px`, tiny.join(' | '));
  const fonts = await ev(() => [...document.querySelectorAll('#director-panel input:not([type=checkbox]):not([type=range]):not([type=color]), #director-panel select, #director-panel textarea, #director-appbar select, #director-timeline input:not([type=range]), #director-timeline select')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').map(e => [e.name || e.dataset.type || e.tagName, parseFloat(getComputedStyle(e).fontSize)]).filter(([, f]) => f < 16));
  check(fonts.length === 0, `${tag}: fields are 16 px or more (the page does not zoom on focus)`, JSON.stringify(fonts));
  // the overflow menu
  await tapSel('#director-appbar [data-ab-open="more"]'); await wait(300);
  const pop = await ev(() => { const p = document.querySelector('#director-appbar [data-ab-menu="more"] .ab-pop'); const r = p.getBoundingClientRect(); return { open: !p.hidden, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1, items: [...p.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 30)) }; });
  check(pop.open && pop.inside && pop.items.some(t => /Sound/.test(t)) && pop.items.some(t => /Editing camera/.test(t)) && pop.items.some(t => /Guided demo card/.test(t)), `${tag}: the ⋯ menu opens on screen with Sound, Editing camera and Guided demo card`, JSON.stringify(pop));
  await shot(`${tag}-menu`);
  await tapSel('#director-appbar [data-ab-menu="more"] [data-action="demo-card"]'); await wait(400);
  const shown = await ev(() => { const d = document.getElementById('demo'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none'; });
  check(await ev(() => !document.body.classList.contains('ef-demo-closed')), `${tag}: ⋯ → Guided demo card opens the card again`, String(shown));
  await shot(`${tag}-demo-open`);
  if (await ev(() => document.getElementById('demo-close') && getComputedStyle(document.getElementById('demo-close')).display !== 'none' && getComputedStyle(document.getElementById('demo')).display !== 'none')) {
    await tapSel('#demo-close'); await wait(300);
    check(await ev(() => document.body.classList.contains('ef-demo-closed')), `${tag}: the card's × closes it`);
  } else { await tapSel('#director-appbar [data-ab-open="more"]'); await tapSel('#director-appbar [data-ab-menu="more"] [data-action="demo-card"]'); await wait(300); log('NOTE the card has no visible × here (the player has not shown it): closed through the menu'); }
  check(await ev(() => JSON.parse(localStorage.getItem('ergoflex.director.demoCard.v1') ?? 'null') === 'closed' || localStorage.getItem('ergoflex.director.demoCard.v1') === 'closed'), `${tag}: the choice is remembered (localStorage)`);
}

async function inspectorChecks(tag, landscape) {
  if (landscape) {
    check((await rectOf('#director-panel')).shown, `${tag}: the drawer starts open`);
    const stageBefore = await rectOf('#stage'), tabInfo = await onScreen('#ef-drawer-tab');
    check(tabInfo.found && tabInfo.shown && tabInfo.inside && tabInfo.w >= 43.5 && tabInfo.h >= 43.5, `${tag}: the drawer's tab is on screen and 44 px`, JSON.stringify(tabInfo));
    await shot(`${tag}-drawer-open`);
    await tapSel('#ef-drawer-tab');
    check(!(await rectOf('#director-panel')).shown && /inspector-hidden/.test(await body()), `${tag}: the tab collapses the inspector`);
    const stageAfter = await rectOf('#stage'), tl = await rectOf('#director-timeline');
    check(stageAfter.w > stageBefore.w + 20, `${tag}: the stage gets the width (${Math.round(stageBefore.w)} -> ${Math.round(stageAfter.w)})`);
    check(tl.r > (await ev(() => innerWidth)) - 12, `${tag}: the timeline takes the full width too`, JSON.stringify(tl));
    check(await ev(() => JSON.parse(localStorage.getItem('ergoflex.director.phone.v1') || '{}').drawer === false), `${tag}: the closed drawer is remembered`);
    await shot(`${tag}-drawer-closed`);
    await tapSel('#ef-drawer-tab');
    check((await rectOf('#director-panel')).shown && !/inspector-hidden/.test(await body()), `${tag}: the tab opens it again`);
    const p = await rectOf('#director-panel'), s = await rectOf('#stage');
    check(apart(p, s, 1), `${tag}: the open drawer leaves the stage clear`, JSON.stringify({ p, s }));
  } else {
    const peek = await rectOf('#director-panel'), handle = await onScreen('#ef-sheet-handle');
    check(/ef-sheet-peek/.test(await body()) && !peek.shown, `${tag}: the sheet starts at peek (only the handle)`, await body());
    check(handle.found && handle.shown && handle.inside && handle.h >= 43.5 && handle.b >= (await ev(() => innerHeight)) - 1, `${tag}: the handle is on screen at the bottom and 44 px tall`, JSON.stringify(handle));
    const tlPeek = await rectOf('#director-timeline'), stage = await rectOf('#stage');
    check(tlPeek.b <= handle.y + 1 && tlPeek.y >= stage.b - 1, `${tag}: at peek the stage, the timeline and the handle stack without overlap`, JSON.stringify({ stage, tlPeek, handle }));
    await shot(`${tag}-sheet-peek`);
    await tapSel('#ef-sheet-handle');
    check(/ef-sheet-half/.test(await body()) && (await rectOf('#director-panel')).shown, `${tag}: a tap on the handle opens the sheet to half`, await body());
    const half = await rectOf('#director-panel'), st = await rectOf('#stage');
    check(half.y >= st.b - 2, `${tag}: at half the sheet leaves the stage clear (sheet top ${Math.round(half.y)}, stage bottom ${Math.round(st.b)})`);
    await shot(`${tag}-sheet-half`);
    const h1 = await centre('#ef-sheet-handle'); await drag(h1, [h1[0], h1[1] - 300]);
    check(/ef-sheet-full/.test(await body()), `${tag}: dragging the handle up opens the sheet to full`, await body());
    const full = await rectOf('#director-panel'), bar = await rectOf('#director-appbar');
    check(full.y >= bar.b - 56 && full.h > half.h, `${tag}: full is taller than half and stays under the app bar`, JSON.stringify({ full, half, bar }));
    await shot(`${tag}-sheet-full`);
    const h2 = await centre('#ef-sheet-handle'); await drag(h2, [h2[0], h2[1] + 300]);
    check(/ef-sheet-half/.test(await body()), `${tag}: dragging down closes one step (back to half)`, await body());
    const h3 = await centre('#ef-sheet-handle'); await drag(h3, [h3[0], h3[1] + 300]);
    check(/ef-sheet-peek/.test(await body()) && !(await rectOf('#director-panel')).shown, `${tag}: dragging down again returns to peek`, await body());
    check(await ev(() => JSON.parse(localStorage.getItem('ergoflex.director.phone.v1') || '{}').sheet === 'peek'), `${tag}: the sheet state is remembered`);
  }
}

async function closeInspector(landscape) {   // timeline work wants the room
  const b = await body();
  if (landscape && !/inspector-hidden/.test(b)) await tapSel('#ef-drawer-tab');
  if (!landscape && !/ef-sheet-peek/.test(b)) await tapSel('#ef-sheet-handle');   // (half -> peek; full -> half: twice)
  if (!landscape && !/ef-sheet-peek/.test(await body())) await tapSel('#ef-sheet-handle');
}
async function openInspector(landscape) {
  const b = await body();
  if (landscape && /inspector-hidden/.test(b)) await tapSel('#ef-drawer-tab');
  if (!landscape && /ef-sheet-peek/.test(b)) await tapSel('#ef-sheet-handle');
  await wait(300);
}

let sent = false;
async function titleChecks(tag, landscape) {
  await closeInspector(landscape);
  const first = (await blocks())[0];
  check(!!first, `${tag}: the chapter has a title block in the Titles lane`);
  if (!first) return;
  // tap = select
  await tapSel('[data-title-clip]');
  let bl = (await blocks())[0];
  check(bl.sel && /Title selected/.test(await statusText()), `${tag}: tapping a block selects it`, await statusText());
  const opened = /ef-sheet-half/.test(await body()) || (landscape && !/inspector-hidden/.test(await body()));
  check(opened, `${tag}: selecting a title brings its inspector up`, await body());
  await shot(`${tag}-title-selected`);
  await closeInspector(landscape);
  const handles = await ev(() => { const h = document.querySelectorAll('[data-title-clip].selected .clip-resize'); return [...h].map(e => { const r = e.getBoundingClientRect(); return [e.dataset.resize, Math.round(r.width), Math.round(r.height)]; }); });
  check(handles.length === 2 && handles.every(([, w, h]) => w >= 44 && h >= 44), `${tag}: the selected title's trim handles are 44 px`, JSON.stringify(handles));
  // drag = move
  const t0 = times((await blocks())[0].text), c = await centre('[data-title-clip]');
  const laneW = await ev(() => document.querySelector('[data-title-lane]').getBoundingClientRect().width);
  await drag(c, [c[0] + laneW * 0.12, c[1]]);
  const t1 = times((await blocks())[0].text);
  check(t1[0] > t0[0] + 0.3 && Math.abs((t1[1] - t1[0]) - (t0[1] - t0[0])) < 0.06, `${tag}: a finger drag moves the block (${t0.join('–')} -> ${t1.join('–')})`, await statusText());
  // trim the end
  const he = await centre('[data-title-clip] .clip-resize[data-resize="end"]');
  await drag(he, [he[0] - laneW * 0.08, he[1]]);
  const t2 = times((await blocks())[0].text);
  check(t2[1] < t1[1] - 0.2 && Math.abs(t2[0] - t1[0]) < 0.01, `${tag}: dragging the end handle trims the out point (${t1.join('–')} -> ${t2.join('–')})`, await statusText());
  const hs = await centre('[data-title-clip] .clip-resize[data-resize="start"]');
  await drag(hs, [hs[0] + laneW * 0.05, hs[1]]);
  const t3 = times((await blocks())[0].text);
  check(t3[0] > t2[0] + 0.15 && Math.abs(t3[1] - t2[1]) < 0.01, `${tag}: dragging the start handle trims the in point (${t2.join('–')} -> ${t3.join('–')})`, await statusText());
  await shot(`${tag}-title-trimmed`);
  // undo / redo buttons
  await tapSel('#director-appbar [data-action="undo"]');
  const t4 = times((await blocks())[0].text);
  check(Math.abs(t4[0] - t2[0]) < 0.01 && Math.abs(t4[1] - t2[1]) < 0.01, `${tag}: Undo (a visible button) takes the last trim back`, t4.join('–'));
  await tapSel('#director-appbar [data-action="redo"]');
  const t5 = times((await blocks())[0].text);
  check(Math.abs(t5[0] - t3[0]) < 0.01, `${tag}: Redo puts it back`, t5.join('–'));
  // scrub with a finger
  const ruler = await ev(() => { document.querySelector('.time-ruler').scrollIntoView({ block: 'nearest' }); const r = document.querySelector('.time-ruler').getBoundingClientRect(); return [r.x, r.y + r.height / 2, r.width]; });
  const before = await ev(() => Number(document.querySelector('[name="timeline-seconds"]').value));
  await drag([ruler[0] + ruler[2] * 0.2, ruler[1]], [ruler[0] + ruler[2] * 0.7, ruler[1]]);
  const after = await ev(() => Number(document.querySelector('[name="timeline-seconds"]').value));
  check(Math.abs(after - before) > 2, `${tag}: a finger on the ruler scrubs the playhead (${before} -> ${after} s)`);
  // play / pause
  const label = () => ev(() => document.querySelector('#director-timeline [data-action="chapter-toggle"]')?.textContent.trim() || '');
  await tapSel('#director-timeline [data-action="chapter-toggle"]'); await wait(800);
  const playing = await label(); await tapSel('#director-timeline [data-action="chapter-toggle"]'); await wait(600);
  check(/Pause/.test(playing) && /Play/.test(await label()), `${tag}: Play chapter / Pause work by touch ("${playing}" then "${await label()}")`);
  // + Add title (the lane's button)
  const n0 = (await blocks()).length;
  await tapSel('[data-title-add]');
  const n1 = (await blocks()).length;
  check(n1 === n0 + 1, `${tag}: + Title adds a title (${n0} -> ${n1})`, await statusText());
  // edit the text: tap the field, type with the (simulated) on-screen keyboard
  await openInspector(landscape);
  if (!landscape) { const h = await centre('#ef-sheet-handle'); await drag(h, [h[0], h[1] - 300]); }   // (full: the form is long)
  await ev(() => document.querySelector('#director-panel [name="ft-title"]')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  const field = await centre('#director-panel [data-inspector-page="title"] [name="ft-title"]') || await centre('#director-panel [name="ft-title"]');
  check(!!field, `${tag}: the headline field is reachable in the inspector`);
  if (field) {
    await tap(...field);
    const fs16 = await ev(() => parseFloat(getComputedStyle(document.activeElement).fontSize));
    check(await ev(() => document.activeElement?.name === 'ft-title') && fs16 >= 16, `${tag}: the field takes the focus with a ${fs16} px font`);
    await ev(() => document.activeElement.select()); await cdp.send('Input.insertText', { text: 'Touch titles work' });
    await wait(500);
    check((await blocks()).some(b => /Touch titles work/.test(b.name)), `${tag}: the typed text reaches the title block`, JSON.stringify(await blocks()));
    await ev(() => document.activeElement.blur()); await wait(200);
    await shot(`${tag}-title-text`);
  }
  // nudge buttons (a touch-only aid)
  const tn0 = times((await blocks()).find(b => b.sel)?.text || '');
  const nudge = await centre('[data-nudge="move:0.5"]');
  if (nudge) { await tap(...nudge); const tn1 = times((await blocks()).find(b => b.sel)?.text || ''); check(Math.abs(tn1[0] - tn0[0] - 0.5) < 0.02 || tn1[1] >= (await ev(() => Number(document.querySelector('[name="ft-out"]').max))) - 0.01, `${tag}: Move +0.5 s moves the selected title (${tn0.join('–')} -> ${tn1.join('–')})`); }
  else check(false, `${tag}: the nudge buttons are in the Title inspector under touch`);
  // Send to desk (once: the first orientation), with the edited text in the chapter
  if (!sent && !process.env.BASE) {
    await closeInspector(landscape);
    const before = fs.readdirSync(inbox).length;
    await tapSel('#director-appbar [data-action="send-desk"]');
    await page.waitForFunction(() => /Sent to the desk|Could not|refused/.test(document.querySelector('#director-panel [data-status]')?.textContent || ''), { timeout: 20000 }).catch(() => {});
    const st = await statusText(); await shot(`${tag}-sent`);
    check(/Sent to the desk/.test(st), `${tag}: Send to desk says "Sent to the desk"`, st);
    const files = fs.readdirSync(inbox).filter(f => /^Film-chapter-.*\.json$/.test(f));
    check(files.length === before + 1 && files.length >= 1, `${tag}: one Film-chapter file appeared in the scratch Downloads`, JSON.stringify(fs.readdirSync(inbox)));
    if (files.length) {
      const f = files.at(-1), data = JSON.parse(fs.readFileSync(path.join(inbox, f), 'utf8'));
      check(new RegExp(`^Film-chapter-${CHAPTER}-\\d{8}-\\d{6}(-\\d+)?\\.json$`).test(f) && data.schema === 'ergoflex.client-cut' && data.shots?.length === 1 && data.shots[0].id === CHAPTER, `${tag}: the file is named for the importer and holds this chapter (${f})`);
      check(JSON.stringify(data).includes('Touch titles work'), `${tag}: the sent chapter has the title typed on the phone`);
    }
    sent = true;
  } else log(process.env.BASE ? 'SKIP send to desk (BASE is set: it would write to that server\'s real Downloads)' : 'send to desk already done');
  // delete (visible button): select the added title, Delete in the inspector
  await openInspector(landscape);
  const delBtn = await centre('#director-panel [data-title-action="delete"]');
  const nb = (await blocks()).length;
  if (delBtn) { await tap(...delBtn); check((await blocks()).length === nb - 1, `${tag}: Delete removes the selected title (${nb} -> ${(await blocks()).length})`, await statusText()); }
  else check(false, `${tag}: a Delete button is visible in the title inspector`);
  await tapSel('#director-appbar [data-action="undo"]');
  check((await blocks()).length === nb, `${tag}: Undo brings the deleted title back`);
  await closeInspector(landscape);
}

async function pinchCheck(tag) {
  const scale0 = await ev(() => visualViewport.scale);
  await cdp.send('Input.synthesizePinchGesture', { x: 200, y: 400, scaleFactor: 1.6, relativeSpeed: 300, gestureSourceType: 'touch' }).catch(e => log('NOTE pinch gesture:', e.message));
  await wait(500);
  const scale1 = await ev(() => visualViewport.scale);
  check(scale1 > scale0 + 0.1, `${tag}: the page can be pinch-zoomed (visualViewport.scale ${scale0} -> ${scale1})`);
  await cdp.send('Input.synthesizePinchGesture', { x: 200, y: 400, scaleFactor: 1 / 1.6, relativeSpeed: 300, gestureSourceType: 'touch' }).catch(() => {});
  await wait(500);
}

try {
  let first = true;
  for (const v of VIEWS) {
    const landscape = v.width > v.height, tag = `${v.width}x${v.height}`;
    log(`== ${tag} (${landscape ? 'landscape' : 'portrait'}), touch emulation`);
    await fold(v);
    if (first) { await openChapter(page, base, chapter); first = false; } else { await wait(300); await page.evaluate(() => dispatchEvent(new Event('resize'))); }
    await page.waitForFunction(() => document.body.classList.contains('ef-phone'), { timeout: 20000 }).catch(() => {});
    await wait(800);
    await shot(`${tag}-start`);
    await layoutChecks(tag, landscape);
    await inspectorChecks(tag, landscape);
    await titleChecks(tag, landscape);
    await pinchCheck(tag);
    await shot(`${tag}-end`);
  }
  check(errors.length === 0, 'no page errors or missing-export errors in the console', errors.slice(0, 3).join(' | '));
} catch (e) { failures++; console.error('FAILED:', e.stack || e); try { await shot('failure'); } catch { /* the page is gone */ } }
finally { await close(); fs.rmSync(inbox, { recursive: true, force: true }); }
log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
