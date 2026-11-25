// Director Tray mode: the keyboard tray as an articulated part (docs/keyboard-tray/SPEC.md section 5; modelled on pose mode,
// scene-pose-editor.mjs). Double-click the tray in the view (or "Tray mode" in the Tray tab): the Tray tab shows the joints as sliders
// inside their live limits, the keys, the bracket switch; the timeline's Motion group gets a Tray lane of key diamonds.
//   Slide / Swing / Tilt (and Drop, only with the bracket on): a slider and a number each. A change is written at the playhead: into the
//     key that is there, else (Auto-key on) as a new key, else into the tray's starting pose (a chapter with no keys: the tray stays so).
//   The tray never leaves its limits: what was keyed shows next to what the tray takes, with the reason (tray-ui.mjs limitReason).
//   Mount bracket (added): the optional plain block, and with it the Drop joint (tray-pose.mjs setBracket / trayBracket).
//   Keys: click a diamond = select + go there, Shift-click adds, drag = retime (all selected keys), Delete removes, an ease and a route per
//     key, copy / paste at the playhead, previous / next. Every change is ONE undo step (slider drags merge into one).
// The data is shot.trayEdits (tray-pose.mjs); the live stage plays it at once (player.mjs -> stage.trayEditsTrack), the film as sceneTray.
import { JOINTS, cleanTrayEdits, pickTrayEdit, filmTrayEdits, setKey, removeKey, retimeKeys, setKeyEase, setKeyRoute, setInitial, setBracket, trayBracket, copyKey, pasteKey, EASES, ROUTES, KEY_SNAP, trayKeyTimes, sampleTray } from './tray-pose.mjs';
import { riderThicknessMm } from './tray-pose.mjs';
import { panelModel, laneModel, keyTitle, fmtT, PRESETS, BRACKET_LABEL, BRACKET_HINT, toDisplay, fromDisplay, unitOf, labelOf, optionsFor, SAVED_KEY, cleanSaved, addSaved } from './tray-ui.mjs';

const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AUTO = 'ergoflex.director.autoKey';
const EASE_LABEL = { smooth: 'Smooth', linear: 'Linear', hold: 'Hold (step)' }, ROUTE_LABEL = { auto: 'Auto (safe order)', direct: 'Direct (all together)' };

export function createTrayEditor({ win = () => null, three = () => null, stage = () => null, shot, film = () => null, commit, status, rerender = () => {}, time = () => 0, seek = () => {}, seconds = () => 0, editing = () => true, lightsShowing = () => false, keyPicked = () => {}, reveal = () => {}, onEnter = () => {}, store = globalThis.localStorage, doc = globalThis.document }) {
    let active = false, sel = [], clip = null, attached = new WeakSet(), saved = null, kd = null, kdSuppress = 0;
    let autoKey = (() => { try { return store?.getItem(AUTO) === '1'; } catch { return false; } })();     // (the pose mode's habit, shared: off until turned on, then remembered)
    const now = () => Math.round(time() * 1000) / 1000;
    const info = () => { try { return stage()?.trayInfo?.() || { has: false, riders: [] }; } catch { return { has: false, riders: [] }; } };
    const riderMm = () => riderThicknessMm(info().riders.map(r => r.propId));
    const riderNames = () => [...new Set(info().riders.map(r => r.kind))];
    const T = () => seconds() || 1;
    const effective = () => Array.isArray(shot()?.trayEdits) ? shot().trayEdits : filmTrayEdits(film());
    const targetIndex = list => { const preset = info().preset; let i = preset ? list.findIndex(e => e.desk === preset) : -1; if (i < 0) i = list.findIndex(e => !e.desk); return i; };
    const current = () => { const list = effective(), i = targetIndex(list); return i < 0 ? null : list[i]; };
    const keyAt = (e, t) => trayKeyTimes(e).find(k => Math.abs(k - t) <= KEY_SNAP / 2 + 1e-9);
    const selectedHere = () => sel.filter(t => current() && keyAt(current(), t) !== undefined);

    // One undo step: change(edit) -> the edit's next state. The first edit of a chapter starts from the film's own tray keys (an earlier import).
    function write(change, text, { undoKey = null, quiet = false, render = true } = {}) {
        const list = structuredClone(effective()); let i = targetIndex(list); if (i < 0) { list.push({}); i = list.length - 1; }
        list[i] = change(list[i]) || list[i];
        let clean = cleanTrayEdits({ trayEdits: list }).trayEdits;
        commit(() => {
            if (!clean.length && !film()?.sceneTray?.length) delete shot().trayEdits;       // (nothing left, and nothing of the film's to take off: no field)
            else shot().trayEdits = clean;
        }, { key: undoKey, render: false });
        if (text && !quiet) status(text);
        if (render) rerender();
    }

    // ---- what the panel and the lane show
    const model = () => panelModel(current(), now(), { riderMm: riderMm(), riders: riderNames() });
    const laneOf = () => laneModel(current(), T(), { riderMm: riderMm(), selected: selectedHere() });
    const has = () => !!info().has;

    // ---- changes
    function setJoint(joint, value, { live = false } = {}) {
        const t = now(), e = current();
        if (!Number.isFinite(value)) return;
        const here = e && keyAt(e, t) !== undefined, onKey = here || autoKey, name = labelOf(joint).toLowerCase(), shown = `${toDisplay(joint, fromDisplay(joint, value))} ${unitOf(joint)}`;
        const note = !onKey && trayKeyTimes(e).length ? ' Auto-key is off and there is no key here: this is the tray\'s starting pose (before the first key). Turn Auto-key on to key it here.' : '';
        write(x => onKey ? setKey(x, t, { [joint]: fromDisplay(joint, value) }) : setInitial(x, { [joint]: fromDisplay(joint, value) }),
            `Tray: ${name} ${shown}${onKey ? ` · key at ${fmtT(t)} s` : trayKeyTimes(e).length ? ' · starting pose' : ' · the whole chapter'}.${note}`, { undoKey: 'tray-' + joint + (onKey ? ':' + t : ''), render: !live });
        if (onKey) sel = [t];
        // a value outside what the tray may do right now is SAID, not silently ignored (the tray takes the limit, the reason is under the slider too)
        { const row = model().rows.find(r => r.joint === joint); if (row?.reason && row.shown !== row.value) status(`Tray: ${name} held at ${row.shown} ${row.unit} (you asked for ${row.value}). ${row.reason}`, true); }
        if (live) liveReadout(joint, value);
    }
    // while a slider is dragged the panel is not redrawn (that would drop the slider): its number follows, the rest on release
    function liveReadout(joint, value) {
        const n = doc?.querySelector?.(`[name="tr-${joint}-n"]`); if (n) n.value = value;
    }
    function setPose(pose, label) {
        const t = now(), bracket = trayBracket(current()), named = Object.fromEntries(Object.entries(pose).filter(([j]) => j !== 'drop' || bracket)), onKey = autoKey || (current() && keyAt(current(), t) !== undefined);
        write(x => onKey ? setKey(x, t, named) : setInitial(x, named), `Tray: ${label}${onKey ? ` · key at ${fmtT(t)} s` : ' · starting pose'}.`);
        if (onKey) sel = [t];
    }
    function keyAll() {
        const t = now(), m = model(), pose = Object.fromEntries(m.rows.map(r => [r.joint, m.shown[r.joint]]));
        write(x => setKey(x, t, pose), `Tray: every joint keyed at ${fmtT(t)} s (as the tray is now).`); sel = [t];
    }
    function deleteKeys() {
        const e = current(), ts = selectedHere(); if (!e || !ts.length) { status('Select a tray key (a diamond) first.', true); return false; }
        sel = []; write(x => ts.reduce((acc, t) => removeKey(acc, t), x), `Tray: ${ts.length === 1 ? 'key at ' + fmtT(ts[0]) + ' s' : ts.length + ' keys'} deleted. Undo brings ${ts.length === 1 ? 'it' : 'them'} back.`); return true;
    }
    function retime(moves) {
        const e = current(); if (!e || !moves.length) return;
        const to = moves.map(([a, b]) => [a, Math.max(0, Math.min(T(), Math.round(b * 1000) / 1000))]);
        sel = to.map(m => m[1]);
        write(x => retimeKeys(x, to), to.length === 1 ? `Tray: key moved ${fmtT(to[0][0])} → ${fmtT(to[0][1])} s.` : `Tray: ${to.length} keys moved.`);
    }
    const keyEdit = (fn, text) => { const ts = selectedHere(); if (!ts.length) return; write(x => ts.reduce((acc, t) => fn(acc, t), x), text); };
    function setSaved(list) { saved = cleanSaved(list); try { store?.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {} }
    const savedList = () => { if (saved) return saved; try { saved = cleanSaved(JSON.parse(store?.getItem(SAVED_KEY) || '[]')); } catch { saved = []; } return saved; };

    // ---- mode
    function enter() {
        if (!has()) { status('This chapter\'s desk has no keyboard tray.', true); return false; }
        if (active) return true;
        active = true; sel = []; status('Tray mode: set Slide, Swing and Tilt in the Tray tab; Auto-key writes keys at the playhead. Esc or Done leaves.'); onEnter(); reveal(); rerender(); return true;
    }
    function exit() { if (!active) return; active = false; sel = []; rerender(); }

    // ---- the Tray tab
    const num = (m, r) => `<input type="number" name="tr-${r.joint}-n" value="${r.value}" min="${r.lo}" max="${r.hi}" step="${r.joint === 'slide' ? 1 : 1}" aria-label="${escape(r.label)} (${r.unit})" inputmode="decimal">`;
    function jointRow(m, r) {
        const why = r.reason ? `<p class="tray-why" role="status">${escape(r.reason)}</p>` : '';
        const keyed = r.clamped ? `<small class="tray-clamped">keyed ${r.value} ${r.unit} · the tray takes ${r.shown} ${r.unit}</small>` : '';
        return `<div class="tray-joint ${r.clamped ? 'clamped' : ''}" data-tray-joint="${r.joint}"><label class="tray-joint-label"><span>${escape(r.label)}</span><span class="tray-limit" title="What the tray may do here, given the other joints and what stands on it">${escape(r.limitText)}</span></label>
          <div class="tray-joint-controls"><input type="range" name="tr-${r.joint}" min="${r.min}" max="${r.max}" step="1" value="${r.shown}" aria-label="${escape(r.label)}">${num(m, { ...r, value: r.shown })}<small>${r.unit}</small></div>${keyed}${why}</div>`;
    }
    function keysPanel(e) {
        const ts = trayKeyTimes(e), t = now(), here = e ? keyAt(e, t) : undefined, ones = selectedHere(), one = ones.length === 1 ? (e.keys || []).find(k => Math.abs(k.t - ones[0]) < 1e-6) : null;
        const prev = [...ts].reverse().find(k => k < t - 1e-6), next = ts.find(k => k > t + 1e-6), L = laneOf();
        return `<h4>Keys <small class="director-hint">${ts.length ? `${ts.length} key${ts.length === 1 ? '' : 's'}` : 'none yet'} · playhead <span data-tray-at>${fmtT(t)}</span> s</small></h4>
          <div class="director-actions tray-tools"><button type="button" class="tray-autokey" data-action="tr-auto" aria-pressed="${autoKey}" title="Auto-key: a change writes a key at the playhead (off: it changes the starting pose, or the key that is already here)">● Auto-key</button><button type="button" data-action="tr-key-all" title="Key all joints as the tray is now, at the playhead (K)">◆ Key all</button></div>
          <div class="tray-key-row" data-tray-key-row aria-label="Tray keys">${L.keys.map(k => keyButton(k)).join('')}<div class="tray-key-playhead" data-shared-playhead style="left:${t / T() * 100}%"></div></div>
          <div class="director-actions tray-nav"><button type="button" data-action="tr-key-prev" ${prev === undefined ? 'disabled' : ''} title="Previous key">◀ Key</button><button type="button" data-action="tr-key-next" ${next === undefined ? 'disabled' : ''} title="Next key">Key ▶</button><button type="button" data-action="tr-key-copy" ${ones.length || here !== undefined ? '' : 'disabled'} title="Copy the selected key (or the one at the playhead)">Copy</button><button type="button" data-action="tr-key-paste" ${clip ? '' : 'disabled'} title="Paste it at the playhead">Paste</button><button type="button" data-action="tr-key-delete" ${ones.length ? '' : 'disabled'} title="Delete the selected key (Delete)">Delete key</button></div>
          ${one ? `<div class="director-row tray-key-fields"><label>Key at<input type="number" name="tr-key-t" value="${fmtT(one.t)}" step="0.05" min="0" max="${seconds()}"><small>s</small></label><label>Ease out<select name="tr-key-ease">${EASES.map(x => `<option value="${x}" ${x === (one.ease || 'smooth') ? 'selected' : ''}>${EASE_LABEL[x]}</option>`).join('')}</select></label><label>Way to the next key<select name="tr-key-route">${ROUTES.map(x => `<option value="${x}" ${x === (one.route || 'auto') ? 'selected' : ''}>${ROUTE_LABEL[x]}</option>`).join('')}</select></label><label>Name<input type="text" name="tr-key-label" maxlength="40" value="${escape(one.label || '')}" placeholder="Out, Tucked…" autocomplete="off" spellcheck="false"></label></div>` : ones.length > 1 ? `<p class="director-hint">${ones.length} keys selected: drag one to move them together, Delete removes them.</p>` : ''}
          ${!autoKey ? '<p class="director-hint">Auto-key is off: a change goes into the key at the playhead if there is one, else into the tray\'s starting pose.</p>' : ''}`;
    }
    const keyButton = k => `<button type="button" class="tray-key ${k.selected ? 'selected' : ''} ${k.warn ? 'warn' : ''}" data-tray-key="${k.t}" style="left:${k.left}%" title="${escape(keyTitle(k))}" aria-label="Tray key at ${fmtT(k.t)} s${k.warn ? ', held to the limits' : ''}"></button>`;
    function panel() {
        if (!has()) return `<section class="tray-panel" data-reveal="tray"><h4>Keyboard tray</h4><p class="director-hint">This chapter's desk has no keyboard tray. Add one in the desk's build (Build tab) to pose it here.</p></section>`;
        const e = current(), n = trayKeyTimes(e).length;
        if (!active) return `<section class="tray-panel" data-reveal="tray"><h4>Keyboard tray</h4><p class="director-hint">Double-click the tray in the view, or press the button, to pose it: it slides out on its track, swings to the side and tilts, inside the limits of the real part.${n ? ` ${n} key${n === 1 ? '' : 's'} so far.` : ''}</p><div class="director-actions"><button type="button" class="primary" data-action="tr-enter">Tray mode</button></div></section>`;
        const m = model(), cur = trayBracket(e), list = savedList(), ready = !!e && (n > 0 || e.initial);
        return `<section class="tray-panel" data-reveal="tray"><div class="tray-bar"><strong>Tray mode · Keyboard tray</strong><span>${n ? `${n} key${n === 1 ? '' : 's'}` : e?.initial ? 'starting pose set' : 'as built'}</span><button type="button" class="primary" data-action="tr-done">Done</button></div>
          <p class="director-hint">Move a slider or type a number: it goes where Auto-key says (see Keys). The tray cannot leave its limits; the reason shows under the slider.</p>
          <div class="tray-joints">${m.rows.map(r => jointRow(m, r)).join('')}</div>
          <label class="tray-bracket"><input type="checkbox" name="tr-bracket" ${cur ? 'checked' : ''}> ${BRACKET_LABEL}</label><p class="director-hint tray-bracket-hint">${BRACKET_HINT}</p>
          <h4>Poses</h4><div class="director-actions tray-presets">${PRESETS.map((p, i) => `<button type="button" data-action="tr-preset" data-index="${i}" title="Set ${escape(p.label.toLowerCase())} at the playhead">${escape(p.label)}</button>`).join('')}</div>
          ${keysPanel(e)}
          <h4>Save this pose</h4><div class="tray-save"><input type="text" name="tr-pose-name" maxlength="40" placeholder="Name, for example: Typing" autocomplete="off" spellcheck="false" aria-label="Name for the saved pose"><button type="button" data-action="tr-save" title="Keep the tray's pose at the playhead in this browser">Save</button></div>
          ${list.length ? `<ul class="tray-saved">${list.map((p, i) => `<li><button type="button" data-action="tr-apply" data-index="${i}" title="Set this pose at the playhead">${escape(p.name)}</button><button type="button" data-action="tr-forget" data-index="${i}" aria-label="Forget ${escape(p.name)}" title="Forget it">×</button></li>`).join('')}</ul>` : ''}
          <div class="director-actions tray-end"><button type="button" data-action="tr-reset" ${ready ? '' : 'disabled'} title="Take every tray key and the starting pose out of this chapter (Undo brings them back)">Reset the tray</button></div></section>`;
    }
    // The timeline's Tray lane (the Motion group): a diamond per key, a bar per stretch coloured by its route.
    function laneRow() {
        if (!has()) return '';
        const L = laneOf(), n = L.keys.length;
        return `<div class="desk-lane-row tray-lane-row ${n ? '' : 'empty'}" data-lane-color="tray"><span class="desk-lane-label" title="The keyboard tray's own keys: slide, swing, tilt (double-click the tray in the view to pose it)"><b>Tray</b><small data-tray-count>${n ? n + ' key' + (n === 1 ? '' : 's') + (L.warnings ? ' · held' : '') : ''}</small></span><div class="desk-lane tray-lane" data-tray-lane role="group" aria-label="Keyboard tray keys"><div class="desk-lane-line"></div>${lane()}</div></div>`;
    }
    function lane() {
        const L = laneOf(), e = current();
        const empty = !L.keys.length ? '<span class="tray-lane-empty">Double-click the tray to key it</span>' : '';
        return `${L.segments.map(s => `<span class="tray-seg ${s.route} ${s.warn ? 'warn' : ''}" style="left:${s.left}%;width:${s.width}%" title="${escape(`${fmtT(s.from)}–${fmtT(s.to)} s · ${s.route === 'direct' ? 'direct' : 'safe order'} · eases ${s.ease}${s.warn ? ' · ' + s.why : ''}`)}"></span>`).join('')}${L.keys.map(keyButton).join('')}${empty}<div class="camera-track-playhead" data-shared-playhead style="left:${now() / T() * 100}%"></div>`;
    }
    function sync() {
        poll();
        for (const el of doc?.querySelectorAll?.('[data-tray-at]') || []) el.textContent = fmtT(now());
        if (active) rerender(true);
    }

    // ---- events from the Director's panel
    function action(name, index) {
        if (name === 'tr-enter') { enter(); return true; }
        if (name === 'tr-done') { exit(); status('Tray kept. Double-click the tray to pose it again.'); return true; }
        if (name === 'tr-auto') { autoKey = !autoKey; try { store?.setItem(AUTO, autoKey ? '1' : '0'); } catch {} status(autoKey ? 'Auto-key on: a tray change writes a key at the playhead.' : 'Auto-key off: a change goes into the key at the playhead, else the starting pose.'); rerender(); return true; }
        if (!active && name !== 'tr-key-delete') return false;
        const e = current();
        if (name === 'tr-key-all') { keyAll(); return true; }
        if (name === 'tr-key-delete') { deleteKeys(); return true; }
        if (name === 'tr-key-prev' || name === 'tr-key-next') { const ts = trayKeyTimes(e), t = now(), k = name === 'tr-key-prev' ? [...ts].reverse().find(x => x < t - 1e-6) : ts.find(x => x > t + 1e-6); if (k !== undefined) { sel = [k]; keyPicked(k); seek(k); rerender(); } return true; }
        if (name === 'tr-key-copy') { const t = selectedHere()[0] ?? keyAt(e, now()), c = t !== undefined ? copyKey(e, t) : null; if (c) { clip = c; status(`Copied the tray key at ${fmtT(t)} s. Paste puts it at the playhead.`); rerender(); } return true; }
        if (name === 'tr-key-paste') { if (!clip) return true; const t = now(); sel = [t]; write(x => pasteKey(x, t, clip), `Tray: key pasted at ${fmtT(t)} s.`); return true; }
        if (name === 'tr-preset') { const p = PRESETS[Number(index)]; if (p) setPose(p.pose, p.label.toLowerCase()); return true; }
        if (name === 'tr-save') { const field = doc?.querySelector?.('[name="tr-pose-name"]'), label = (field?.value || '').trim(); if (!label) { status('Name the pose first.', true); return true; } const m = model(); setSaved(addSaved(savedList(), label, Object.fromEntries(m.rows.map(r => [r.joint, m.shown[r.joint]])))); status(`Pose "${label}" saved in this browser.`); rerender(); return true; }
        if (name === 'tr-apply') { const p = savedList()[Number(index)]; if (p) setPose(p.pose, `"${p.name}"`); return true; }
        if (name === 'tr-forget') { const p = savedList()[Number(index)]; if (p) { setSaved(savedList().filter((_, i) => i !== Number(index))); status(`Forgot "${p.name}".`); rerender(); } return true; }
        if (name === 'tr-reset') { sel = []; write(() => ({}), 'Tray: back as built. Undo brings the keys back.'); return true; }
        return false;
    }
    // a field changed (the Director's change handler): numbers and selects on release, the bracket checkbox
    function changed(el) {
        const name = el.name;
        if (name === 'tr-bracket') { const on = !!el.checked; write(x => setBracket(x, on), on ? `Tray: ${BRACKET_LABEL} on. The Drop slider is there now; the rig loads once the tray has a key.` : `Tray: ${BRACKET_LABEL} off. The tray is the original model again and the drop is off.`); return true; }
        const j = /^tr-(slide|swing|tilt|drop)(-n)?$/.exec(name);
        if (j) { const v = Number(el.value); if (String(el.value).trim() === '' || !Number.isFinite(v)) throw Error('Type a number.'); setJoint(j[1], v); return true; }
        if (name === 'tr-key-t') { const ts = selectedHere(), v = Number(el.value); if (ts.length === 1 && Number.isFinite(v)) retime([[ts[0], v]]); return true; }
        if (name === 'tr-key-ease') { if (EASES.includes(el.value)) keyEdit((x, t) => setKeyEase(x, t, el.value), `Tray: the key eases ${el.value === 'hold' ? 'by holding until the next key' : el.value}.`); return true; }
        if (name === 'tr-key-route') { if (ROUTES.includes(el.value)) keyEdit((x, t) => setKeyRoute(x, t, el.value), `Tray: the way to the next key is ${el.value === 'direct' ? 'direct (every joint together)' : 'auto (a safe order)'}.`); return true; }
        if (name === 'tr-key-label') { const label = String(el.value || ''), e = current(), ts = selectedHere(); if (ts.length === 1 && e) { const k = (e.keys || []).find(k => Math.abs(k.t - ts[0]) < 1e-6), j0 = k && Object.keys(k.pose)[0]; if (j0) write(x => setKey(x, ts[0], { [j0]: k.pose[j0] }, { label }), 'Tray: key named.'); } return true; }
        return name === 'tr-pose-name';
    }
    // a slider moving (live): the tray follows at once; one undo step for the whole drag
    function input(el) {
        const j = /^tr-(slide|swing|tilt|drop)$/.exec(el.name); if (!j) return false;
        const v = Number(el.value); if (Number.isFinite(v)) setJoint(j[1], v, { live: true }); return true;
    }

    // ---- the view: double-click the tray, and the timeline's key diamonds
    function poll() {
        const t = three(); if (!t) return;
        const dom = t.renderer?.domElement; if (!dom || attached.has(dom)) return; attached.add(dom);
        dom.addEventListener('dblclick', ev => {
            if (ev.button !== 0 || !editing() || lightsShowing() || !has()) return;
            let hit = false; try { hit = !!stage()?.trayAt?.(ev.clientX, ev.clientY); } catch { hit = false; }
            if (hit) { ev.preventDefault(); enter(); } else if (active) exit();
        }, true);
    }
    if (doc?.addEventListener) {
        doc.addEventListener('pointerdown', ev => {
            const d = ev.target.closest?.('[data-tray-key]'); if (!d || ev.button !== 0) return;
            const row = d.parentElement.getBoundingClientRect(), t0 = Number(d.dataset.trayKey);
            ev.preventDefault(); ev.stopPropagation();
            // a press on a key that is not selected selects it (Shift adds, a plain press replaces); a selected one keeps the selection for the drag
            if (ev.shiftKey) sel = sel.some(x => Math.abs(x - t0) < 1e-6) ? sel.filter(x => Math.abs(x - t0) >= 1e-6) : [...selectedHere(), t0];
            else if (!sel.some(x => Math.abs(x - t0) < 1e-6)) sel = [t0];
            kd = { el: d, t: t0, x: ev.clientX, width: row.width, left: row.left, now: null, group: selectedHere().length ? selectedHere() : [t0], shift: ev.shiftKey };
        }, true);
        doc.addEventListener('pointermove', ev => {
            if (!kd || (kd.now === null && Math.abs(ev.clientX - kd.x) < 3)) return;
            let t = Math.max(0, Math.min(T(), (ev.clientX - kd.left) / kd.width * T())); t = ev.altKey ? t : Math.round(t * 20) / 20; kd.now = t;
            const first = Math.min(...kd.group), last = Math.max(...kd.group), d = Math.max(-first, Math.min(T() - last, t - kd.t));
            kd.delta = d; kd.el.style.left = (kd.t + d) / T() * 100 + '%'; status(`Tray key ${fmtT(kd.t)} → ${fmtT(kd.t + d)} s${kd.group.length > 1 ? ` (${kd.group.length} keys)` : ''}`);
        }, true);
        doc.addEventListener('pointerup', ev => {
            const d = kd; kd = null; if (!d) return; ev.stopPropagation(); kdSuppress = performance.now() + 300;
            if (d.now === null) { if (!d.shift) { sel = [d.t]; } keyPicked(d.t); seek(d.t); rerender(); status(`Tray key at ${fmtT(d.t)} s: drag to retime, Delete removes it, Ease out sets how it leaves.`); return; }
            if (!d.delta) { rerender(); return; }
            retime(d.group.map(t => [t, t + d.delta]));
        }, true);
        doc.addEventListener('click', ev => {      // (a keyboard Enter or a script's click)
            const d = ev.target.closest?.('[data-tray-key]'); if (!d) return; ev.preventDefault(); ev.stopPropagation(); if (performance.now() < kdSuppress) return;
            const t = Number(d.dataset.trayKey); sel = ev.shiftKey ? [...selectedHere(), t] : [t]; keyPicked(t); seek(t); rerender();
        }, true);
    }
    return { enter, exit, active: () => active, has, panel, laneRow, lane, action, changed, input, sync, poll, deleteKeys, keySelected: () => selectedHere().length > 0, selectedKeys: selectedHere, autoKey: () => autoKey,
        current, effective, model, laneModel: laneOf, setJoint, setPose, keyAll, retime, setSelection: ts => { sel = [...ts]; }, text: () => '' };
}
