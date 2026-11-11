/* Studio UI shell: one organised layout for the controls studio.js builds.
 *
 * studio.js still creates every control and owns every handler. This module only MOVES those
 * nodes (same elements, same ids, same listeners) into:
 *   - a two-row bar at the top of the 3D view: the scene row (scene, room size, desk size, time of
 *     day, Groove) and the tools row (Camera, Light & quality, Screens, Desks menus, mode chips,
 *     Send to Director, Hide panel, Find);
 *   - menus that float over the canvas (native <details>, one open at a time, Escape closes); they
 *     never change the bar's height, so opening one does not resize the WebGL canvas;
 *   - collapsible groups in the Editor tools tab that remember whether they are open;
 *   - a quick find over every labelled control.
 * A control inside a closed menu or group is still in the document: getElementById, .value,
 * dispatchEvent and .click() work as before.
 *
 * studio.js calls window.ErgoStudioShell.mount() once its own UI exists. The shell is never mounted
 * in a presentation frame (window.__ERGO_PRESENTATION__) or on product-demo.html: there the page is
 * exactly what studio.js built.
 */
const PREF_KEY = 'ergoflex.ui.shell.v1';   // { v, groups: {id: open}, more: {id: open}, sidebarHidden }
const PHONE = matchMedia('(max-width: 760px)');
const $ = id => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === false || value == null) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...kids.filter(Boolean));
    return node;
};

let prefs = { v: 1, groups: {}, more: {}, sidebarHidden: false };
function loadPrefs() {
    try {
        const stored = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
        if (stored?.v === 1) prefs = { v: 1, groups: { ...stored.groups }, more: { ...stored.more }, sidebarHidden: stored.sidebarHidden === true };
    } catch {}
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

let mounted = false, bar = null, ctx = {};

// ---------------------------------------------------------------- menus
// A bar menu is a <details>: its <summary> is the button, everything else sits in one .vb-pop.
function asMenu(details, label) {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return details;
    details.classList.add('vb-menu');
    let pop = details.querySelector(':scope > .vb-pop');
    if (!pop) {
        const rest = [...details.childNodes].filter(node => node !== summary);
        const elements = rest.filter(node => node.nodeType === 1);
        if (elements.length === 1 && elements[0].tagName === 'DIV' && !elements[0].className) pop = elements[0];   // studio.js's own wrapper
        else { pop = h('div'); pop.append(...rest); details.append(pop); }
        pop.classList.add('vb-pop');
    }
    if (!pop.id) pop.id = `${details.id || 'vb-menu-' + (++asMenu.count)}-pop`;
    summary.setAttribute('aria-controls', pop.id);
    summary.setAttribute('aria-expanded', String(details.open));
    if (!pop.querySelector(':scope > .vb-pop-head')) {
        const close = h('button', { type: 'button', class: 'vb-pop-close', 'aria-label': `Close ${label}`, text: '×' });
        close.onclick = () => { details.open = false; summary.focus(); };
        pop.prepend(h('div', { class: 'vb-pop-head' }, h('strong', { text: label }), close));
    }
    return details;
}
asMenu.count = 0;

function newMenu(id, label, nodes, title) {
    const details = h('details', { id }, h('summary', { text: label, title }));
    const pop = h('div', { class: 'vb-pop' });
    pop.append(...nodes.filter(Boolean));
    details.append(pop);
    return asMenu(details, label);
}

// The popover's containing block is the bar, so it is never clipped by a row; place it under its button.
function placePop(details) {
    const pop = details.querySelector(':scope > .vb-pop'), summary = details.querySelector(':scope > summary');
    if (!pop || !summary) return;
    pop.style.left = pop.style.top = pop.style.maxHeight = '';
    if (PHONE.matches) return;   // a bottom sheet (studio-shell.css)
    const barBox = bar.getBoundingClientRect(), button = summary.getBoundingClientRect();
    const shell = $('viewer-shell')?.getBoundingClientRect() || barBox;
    pop.style.left = Math.round(Math.max(0, Math.min(button.left - barBox.left, barBox.width - pop.offsetWidth))) + 'px';
    pop.style.top = Math.round(button.bottom - barBox.top + 6) + 'px';
    pop.style.maxHeight = Math.round(Math.max(180, shell.bottom - button.bottom - 20)) + 'px';
}

function openMenus() { return [...bar.querySelectorAll('details.vb-menu[open]')].filter(d => !d.closest('[hidden]')); }
function syncMenuState() {
    const open = openMenus().length > 0;
    bar.classList.toggle('vb-menu-open', open);
    document.body.classList.toggle('ui-menu-open', open);
}
function closeMenus(except = null) {
    for (const details of bar.querySelectorAll('details.vb-menu[open]'))
        if (details !== except && !details.contains(except)) details.open = false;
}

// ---------------------------------------------------------------- the bar
function buildBar() {
    const toolbar = bar.querySelector('.studio-toolbar'), scenes = bar.querySelector('.scene-switcher');
    if (!toolbar || !scenes) return false;
    bar.classList.add('vb');
    bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Scene and view controls');

    // Row 1: where and when. Scene, the active room's size / desk / time of day, Groove.
    const rowScene = h('div', { class: 'vb-row vb-row-scene', role: 'group', 'aria-label': 'Scene' });
    const chips = scenes.querySelector('.scene-options');
    const scenesMenu = newMenu('vb-scenes-menu', 'All scenes', [chips, $('room-scene-caption')], 'Browse every scene');
    scenes.append(scenesMenu);
    rowScene.append(scenes);
    for (const panel of bar.querySelectorAll('.measured-room-controls')) {
        const groove = panel.querySelector('.groove-controls');
        if (groove && !groove.querySelector('.vb-menu')) {
            // Start and Stop stay on the bar; the rest of this room's Groove and routine tools open from here.
            const more = newMenu(`${panel.id}-more`, 'Groove & routines', [
                panel.querySelector(':scope > p'),
                groove.querySelector('[data-groove-save]'), groove.querySelector('[data-groove-reset]'),
                groove.querySelector('[data-groove-saved]'), groove.querySelector('[data-groove-status]'),
                panel.querySelector('.room-mobility-controls')
            ], 'Save or reset this Groove position, and the room routines');
            more.classList.add('vb-room-more');
            groove.append(more);
        }
        rowScene.append(panel);
    }

    // Row 2: tools. Menus first, then the mode chips, then panel and find.
    toolbar.classList.add('vb-row', 'vb-row-tools');
    toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'View tools');
    const labelOf = id => $(id)?.closest('label');
    const cameraMenu = newMenu('vb-camera-menu', 'Camera', [
        labelOf('camera-view'),
        h('div', { class: 'vb-pop-row' }, $('fit-view'), $('rotate-scene'), $('grid-toggle'), $('capture-view')),
        toolbar.querySelector('.camera-shortcuts')
    ], 'Camera view, fit, orbit, grid and capture');
    const light = $('studio-exposure')?.closest('details');
    if (light) {
        light.id ||= 'vb-light-menu';
        asMenu(light, 'Light & quality');
        const pop = light.querySelector(':scope > .vb-pop');
        pop.querySelector('.vb-pop-head').after(labelOf('studio-environment') || '');
        pop.append(...[$('room-ceiling-control'), $('room-bounce-control')].filter(Boolean));
    }
    const screens = $('scene-screen-controls');
    if (screens) asMenu(screens, 'Screens');
    const hint = $('room-interaction-hint');
    if (hint) hint.classList.add('vb-hint');

    const panelToggle = h('button', { type: 'button', id: 'ui-panel-toggle', class: 'vb-panel-toggle', 'aria-controls': 'setup-sidebar', 'aria-expanded': 'true', text: 'Hide panel' });
    panelToggle.onclick = toggleSidebar;
    const find = h('button', { type: 'button', id: 'ui-find-open', class: 'vb-find', 'aria-haspopup': 'dialog', title: 'Find any control (Ctrl+K or /)' },
        h('span', { 'aria-hidden': 'true', class: 'vb-find-glyph' }), h('span', { text: 'Find' }), h('kbd', { 'aria-hidden': 'true', text: 'Ctrl K' }));
    find.onclick = () => openFind(find);

    // The desks panel is mounted later by studio.js as `hint.before(panel)`: keeping the hint here
    // (it is positioned out of the row by CSS) puts that panel in the menus where it belongs.
    toolbar.append(...[cameraMenu, light, screens, bar.querySelector('.scene-desk-panel'), hint, $('room-desk-palette'), $('room-people-control'),
        $('room-rearrange-desks-control'), $('room-rearrange-control'), $('room-undo-btn'), $('room-redo-btn'), $('room-save-status'),
        h('span', { class: 'vb-spacer', 'aria-hidden': 'true' }), $('send-to-director'), panelToggle, find].filter(Boolean));

    const objectControls = $('room-object-controls');
    bar.append(...[rowScene, toolbar, objectControls].filter(Boolean));
    adoptDeskPanel();
    new MutationObserver(adoptDeskPanel).observe(toolbar, { childList: true });

    // One menu open at a time; aria-expanded follows the native state. `toggle` does not bubble.
    bar.addEventListener('toggle', event => {
        const details = event.target;
        if (!details.classList?.contains('vb-menu')) return;
        details.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(details.open));
        if (details.open) { closeMenus(details); placePop(details); }
        syncMenuState();
    }, true);
    let resizeQueued = false;
    window.addEventListener('resize', () => {
        if (resizeQueued || !bar.classList.contains('vb-menu-open')) return;
        resizeQueued = true;
        requestAnimationFrame(() => { resizeQueued = false; openMenus().forEach(placePop); });
    });
    return true;
}

function adoptDeskPanel() {
    const panel = bar.querySelector('.studio-toolbar > .scene-desk-panel:not(.vb-menu)');
    if (!panel) return;
    panel.id ||= 'vb-desks-menu';
    asMenu(panel, 'Desks');
}

// ---------------------------------------------------------------- sidebar: hide / show
function sidebarHidden() {
    return document.body.classList.contains('setup-layout') ? document.body.classList.contains('ui-sidebar-hidden')
        : document.body.classList.contains('sidebar-collapsed');
}
function syncSidebarToggle() {
    const button = $('ui-panel-toggle');
    if (!button) return;
    const hidden = sidebarHidden();
    button.textContent = hidden ? 'Show panel' : 'Hide panel';
    button.setAttribute('aria-expanded', String(!hidden));
    button.title = hidden ? 'Show the options panel' : 'Hide the options panel so the 3D view takes the screen';
}
function setStudioSidebarHidden(hidden, persist = true) {
    document.body.classList.toggle('ui-sidebar-hidden', hidden);
    if (persist && prefs.sidebarHidden !== hidden) { prefs.sidebarHidden = hidden; savePrefs(); }
    syncSidebarToggle();
    requestAnimationFrame(() => ctx.syncViewerSize?.());
}
function toggleSidebar() {
    // The Store keeps its own "Hide product options" control and its own memory; this button drives it.
    if (document.body.classList.contains('setup-layout')) setStudioSidebarHidden(!sidebarHidden());
    else $('config-collapse')?.click();
    syncSidebarToggle();
}

// ---------------------------------------------------------------- Editor tools: groups
const EDITOR_GROUPS = [
    { id: 'transform', label: 'Transform', open: true, members: ['transform-inspector', 'undo-btn', 'focus-selected'] },
    { id: 'library', label: 'Prop library', open: true, members: ['scene-asset-tools'] },
    { id: 'selection', label: 'Selection', open: true, members: ['selection-mode-toggle', 'selected-part-id', 'box-select-sticky'] },
    { id: 'groups', label: 'Groups & cloning', open: false, members: ['group-name-input', 'clone-parts-btn', 'ui-pro-tip', 'clear-parts-btn'] },
    { id: 'lift', label: 'Lift & tilt', open: false, members: ['assign-lift', 'tilt-configs-list'] },
    { id: 'rigs', label: 'Actuator rigs', open: false, members: ['rig-list'] },
    { id: 'tree', label: 'Scene hierarchy', open: true, members: ['scene-tree-header'] },   // keeps its own disclosure inside
    { id: 'project', label: 'Project & recovery', open: false, members: ['project-tools'] }
];
function setGroup(section, open, persist = true) {
    const head = section.querySelector(':scope > .ui-group-head'), body = section.querySelector(':scope > .ui-group-body');
    body.hidden = !open;
    head.setAttribute('aria-expanded', String(open));
    if (persist) { prefs.groups[section.dataset.uiGroup] = open; savePrefs(); }
}
function adoptEditorGroups() {
    const content = $('debug-panel-content');
    if (!content) return;
    const topChild = node => { while (node && node.parentElement !== content) node = node.parentElement; return node; };
    const tip = [...content.querySelectorAll(':scope > p')].find(p => /Pro Tip/.test(p.textContent));
    if (tip && !tip.id) tip.id = 'ui-pro-tip';
    for (const group of EDITOR_GROUPS) {
        const key = `editor.${group.id}`;
        let section = content.querySelector(`:scope > .ui-group[data-ui-group="${key}"]`);
        const members = group.members.map(id => topChild($(id))).filter(node => node && !node.classList.contains('ui-group'));
        if (!members.length) continue;
        if (!section) {
            const bodyId = `ui-group-${group.id}`;
            const head = h('button', { type: 'button', class: 'ui-group-head', 'aria-controls': bodyId, 'aria-expanded': 'true' }, h('span', { text: group.label }));
            section = h('section', { class: 'ui-group', 'data-ui-group': key, 'aria-label': group.label }, head, h('div', { class: 'ui-group-body', id: bodyId }));
            head.onclick = () => setGroup(section, section.querySelector('.ui-group-body').hidden);
            members[0].before(section);
            setGroup(section, prefs.groups[key] ?? group.open, false);
        }
        // Members arrive at different moments (some blocks are built after the model loads): keep the listed order.
        const body = section.querySelector('.ui-group-body');
        body.append(...members);
        const inBody = id => { let node = $(id); while (node && node.parentElement !== body) node = node.parentElement; return node; };
        const ordered = group.members.map(inBody).filter(Boolean);
        if (ordered.some((node, index) => body.children[index] !== node)) body.append(...ordered);
    }
    // Keep the groups in their intended order whatever order studio.js built the blocks in.
    const sections = EDITOR_GROUPS.map(g => content.querySelector(`:scope > .ui-group[data-ui-group="editor.${g.id}"]`)).filter(Boolean);
    sections.forEach((section, index) => { if (index && sections[index - 1].nextElementSibling !== section) sections[index - 1].after(section); });
}
function enhanceEditor() {
    adoptEditorGroups();
    const content = $('debug-panel-content');
    if (content) new MutationObserver(records => {
        if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && !node.classList.contains('ui-group')))) adoptEditorGroups();
    }).observe(content, { childList: true });
    // The two disclosures studio.js already had: say what they control.
    const header = $('debug-panel-header');
    if (header && content) {
        header.setAttribute('role', 'button'); header.tabIndex = 0;
        header.setAttribute('aria-controls', 'debug-panel-content');
        header.setAttribute('aria-expanded', String(content.style.display !== 'none'));
        header.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); header.click(); } });
    }
    const treeHeader = $('scene-tree-header'), tree = $('scene-tree-container');
    if (treeHeader && tree) {
        const sync = () => treeHeader.setAttribute('aria-expanded', String(tree.style.display !== 'none'));
        treeHeader.setAttribute('role', 'button'); treeHeader.tabIndex = 0;
        treeHeader.setAttribute('aria-controls', 'scene-tree-container');
        treeHeader.addEventListener('click', () => requestAnimationFrame(sync));
        treeHeader.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); treeHeader.click(); } });
        sync();
    }
}

// ---------------------------------------------------------------- Desk tab: expert LED sliders behind a disclosure
function tuckLedSurfaces() {
    const first = document.querySelector('label[for="led-desktop-strength"]'), holder = first?.parentElement;
    if (!holder || $('led-surfaces-advanced')) return;
    let start = first;
    for (let i = 0; i < 2 && start.previousElementSibling && !start.previousElementSibling.matches('input, label, #led-effects, #led-mapping, #led-playback'); i++) start = start.previousElementSibling;
    const nodes = []; for (let node = start; node; node = node.nextElementSibling) nodes.push(node);
    const body = h('div', { class: 'ui-more-body', id: 'led-surfaces-advanced-body' });
    const summary = h('summary', { text: 'Advanced · light on surfaces', 'aria-controls': body.id, 'aria-expanded': 'false' });
    const details = h('details', { class: 'ui-more', id: 'led-surfaces-advanced' }, summary, body);
    start.before(details);
    body.append(...nodes);
    details.open = prefs.more.ledSurfaces === true;
    summary.setAttribute('aria-expanded', String(details.open));
    details.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', String(details.open));
        if ((prefs.more.ledSurfaces === true) !== details.open) { prefs.more.ledSurfaces = details.open; savePrefs(); }
    });
}

// ---------------------------------------------------------------- quick find
const FIND_ROOTS = () => [bar, $('setup-sidebar'), document.querySelector('#viewer-shell .absolute.top-4.right-4'), $('motion-dock'), document.querySelector('.portal-header')];
const FIND_SKIP = '#ui-find, .vb-pop-head, .ui-group-head, .scene-library-card, .desk-object-card, #scene-tree-content, #part-search-results, #scene-assets-current, .portal-skip, #scene-library-grid';
const clean = text => (text || '').replace(/\s+/g, ' ').trim();
function controlLabel(el) {
    const own = node => { const copy = node.cloneNode(true); copy.querySelectorAll('select, input, output, textarea, kbd, svg, .vb-pop').forEach(n => n.remove()); return clean(copy.textContent); };
    let label = clean(el.getAttribute('aria-label'));
    if (!label && el.matches('input, select, textarea')) label = clean(el.labels?.[0] ? own(el.labels[0]) : '') || clean(el.closest('label') ? own(el.closest('label')) : '') || clean(el.placeholder);
    if (!label && el.matches('input[type=radio], input[type=checkbox]')) label = clean(el.value);
    if (!label) label = own(el) || clean(el.title);
    if (el.title && label.length < 22 && clean(el.title) !== label && !/^(Ctrl|Cmd|Shift|Alt|Delete|Down)/.test(el.title)) label += ` · ${clean(el.title)}`;
    return label.slice(0, 90);
}
function available(el) {
    const studio = document.body.classList.contains('setup-layout');
    for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (node.hidden && !node.classList.contains('ui-group-body')) return false;
        if (!studio && (node.id === 'anim-debugger' || node.classList.contains('camera-shortcuts') || node.id === 'portal-project-actions')) return false;
    }
    return true;
}
function whereIs(el) {
    const parts = [];
    if (bar.contains(el)) {
        parts.push('3D view');
        const menu = el.closest('.vb-pop')?.querySelector(':scope > .vb-pop-head strong');
        if (menu) parts.push(menu.textContent);
    } else if (el.closest('#setup-sidebar')) {
        const tab = el.closest('[data-shell-tab]')?.dataset.shellTab;
        parts.push({ editor: 'Editor tools', finishes: 'Product & finishes', build: 'Configure' }[tab] || 'Panel');
        const group = el.closest('.ui-group')?.getAttribute('aria-label') || clean(el.closest('.config-section')?.querySelector('h3')?.textContent)
            || (el.closest('.accessory-block') ? 'Accessories' : el.closest('#build-actions') ? 'Build' : el.closest('#preset-list, .look-presets') ? 'Start from' : '');
        if (group) parts.push(group);
        if (el.closest('#led-surfaces-advanced')) parts.push('Advanced');
    } else if (el.closest('#motion-dock')) parts.push('Movement panel');
    else if (el.closest('.portal-header')) parts.push('Header');
    else parts.push('3D view');
    return parts.join(' › ');
}
function findIndex() {
    const items = [], seen = new Set();
    for (const root of FIND_ROOTS()) {
        if (!root) continue;
        for (const el of root.querySelectorAll('button, select, input:not([type=hidden]):not([type=file]), textarea, summary, a[href], .config-header')) {
            if (el.closest(FIND_SKIP) || !available(el)) continue;
            const label = controlLabel(el);
            if (!label) continue;
            const where = whereIs(el), key = `${label}|${where}`;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({ el, label, where, text: `${label} ${where}`.toLowerCase() });
        }
    }
    return items;
}
function reveal(el) {
    const side = el.closest('#setup-sidebar');
    if (side) {
        if (sidebarHidden()) toggleSidebar();
        const tab = el.closest('[data-shell-tab]')?.dataset.shellTab;
        if (tab && side.dataset.tab !== tab) side.querySelector(`[data-sidebar-tab="${tab}"]`)?.click();
        const collapse = $('config-collapse');
        if (el.closest('#config-column-content') && collapse?.getAttribute('aria-expanded') === 'false') collapse.click();
        if (el.closest('#debug-panel-content') && $('debug-panel-content').style.display === 'none') $('debug-panel-header')?.click();
        const section = el.closest('.config-content');
        if (section && !section.classList.contains('expanded')) window.toggleSection?.(section.id.replace(/-content$/, ''));
    }
    if (bar.contains(el) && bar.hidden) $('lab-preview-toggle')?.click();
    if (el.closest('#motion-dock-content') && $('motion-dock')?.classList.contains('collapsed')) $('motion-dock-toggle')?.click();
    const chain = [];
    for (let node = el.parentElement; node; node = node.parentElement) chain.push(node);
    for (const node of chain.reverse()) {   // outermost first, so a menu is placed before anything inside it opens
        if (node.tagName === 'DETAILS' && !node.open) node.open = true;
        if (node.classList.contains('ui-group-body') && node.hidden) setGroup(node.parentElement, true);
    }
    requestAnimationFrame(() => {
        // Only scroll containers that are meant to scroll: the panel, a popover, the page on a phone.
        if (side || PHONE.matches || el.closest('.vb-pop')) el.scrollIntoView({ block: side ? 'center' : 'nearest', inline: 'nearest' });
        const target = el.matches('.config-header, button, select, input, textarea, summary, a') ? el : el.querySelector('button, select, input') || el;
        target.focus({ preventScroll: true });
        target.classList.add('ui-found');
        setTimeout(() => target.classList.remove('ui-found'), 1600);
    });
}

let findState = null;
function buildFind() {
    const input = h('input', { type: 'search', id: 'ui-find-input', placeholder: 'Find a control: camera, grid, exposure, people…', role: 'combobox', autocomplete: 'off', spellcheck: 'false',
        'aria-expanded': 'true', 'aria-controls': 'ui-find-list', 'aria-autocomplete': 'list', 'aria-label': 'Find a control' });
    const list = h('ul', { id: 'ui-find-list', role: 'listbox', 'aria-label': 'Matching controls' });
    const dialog = h('div', { id: 'ui-find', class: 'ui-find', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Find a control', hidden: true },
        h('div', { class: 'ui-find-box' }, input, list, h('p', { class: 'ui-find-hint', text: '↑ ↓ choose · Enter go · Esc close' })));
    document.body.append(dialog);
    const render = () => {
        const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        const score = item => { const label = item.label.toLowerCase(); return words.length && label.startsWith(words[0]) ? 0 : words.length && new RegExp(`\\b${words[0].replace(/[^a-z0-9]/g, '.')}`).test(label) ? 1 : 2; };
        const matches = findState.items.filter(item => words.every(word => item.text.includes(word)));
        findState.matches = (words.length ? matches.sort((a, b) => score(a) - score(b)) : matches).slice(0, 40);
        findState.active = 0;
        list.replaceChildren(...findState.matches.map((item, index) => {
            const option = h('li', { role: 'option', id: `ui-find-option-${index}`, 'aria-selected': String(index === 0) }, h('span', { text: item.label }), h('small', { text: item.where }));
            option.onclick = () => choose(index);
            return option;
        }));
        if (!findState.matches.length) list.append(h('li', { class: 'ui-find-empty', text: 'No control matches. Try another word.' }));
        input.setAttribute('aria-activedescendant', findState.matches.length ? 'ui-find-option-0' : '');
    };
    const move = delta => {
        if (!findState.matches.length) return;
        findState.active = (findState.active + delta + findState.matches.length) % findState.matches.length;
        [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === findState.active)));
        list.children[findState.active].scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', `ui-find-option-${findState.active}`);
    };
    const choose = index => { const item = findState.matches[index]; closeFind(false); if (item) reveal(item.el); };
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
        else if (event.key === 'Enter') { event.preventDefault(); choose(findState.active); }
        else if (event.key === 'Tab') event.preventDefault();   // the dialog has one stop
    });
    dialog.addEventListener('pointerdown', event => { if (event.target === dialog) closeFind(); });
    buildFind.render = render;
}
function openFind(trigger = null) {
    const dialog = $('ui-find');
    if (!dialog || !dialog.hidden) return;
    closeMenus();
    findState = { items: findIndex(), matches: [], active: 0, trigger: trigger || document.activeElement };
    dialog.hidden = false;
    const input = $('ui-find-input'); input.value = ''; buildFind.render(); input.focus();
}
function closeFind(restoreFocus = true) {
    const dialog = $('ui-find');
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    if (restoreFocus) findState?.trigger?.focus?.();
}

// ---------------------------------------------------------------- mount
function mount(context = {}) {
    if (mounted || window.__ERGO_PRESENTATION__ || location.pathname.endsWith('/product-demo.html')) return false;
    bar = $('scene-controls');
    if (!bar) return false;
    ctx = context;
    loadPrefs();
    if (!buildBar()) return false;
    mounted = true;
    document.documentElement.classList.add('ui-shell');
    enhanceEditor();
    tuckLedSurfaces();
    buildFind();
    if (prefs.sidebarHidden) setStudioSidebarHidden(true, false);
    syncSidebarToggle();
    new MutationObserver(syncSidebarToggle).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('keydown', event => {
        const find = $('ui-find');
        if (event.key === 'Escape') {
            if (find && !find.hidden) { event.preventDefault(); closeFind(); return; }
            const open = openMenus();
            if (open.length) { const summary = open.at(-1).querySelector(':scope > summary'); closeMenus(); summary?.focus(); }
            return;
        }
        const typing = event.target.closest?.('input, select, textarea, [contenteditable], #glide-pad');
        if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey) || (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
            if (!document.getElementById('cart-modal')?.classList.contains('hidden')) return;
            event.preventDefault();
            openFind();
        }
    });
    requestAnimationFrame(() => ctx.syncViewerSize?.());
    return true;
}

window.ErgoStudioShell = {
    mount,
    get mounted() { return mounted; },
    openFind, closeFind, reveal,
    findIndex: () => findIndex().map(({ label, where, el }) => ({ label, where, id: el.id || null })),
    get prefs() { return JSON.parse(JSON.stringify(prefs)); },
    PREF_KEY
};
