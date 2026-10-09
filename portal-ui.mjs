/* Shared portal chrome. Kept separate from scene construction and desk controls. */
const root = document.documentElement;
const THEME_KEY = 'ergoflex.portal.theme.v1';
const media = matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = localStorage.getItem(THEME_KEY); } catch {}
if (!['light', 'dark', 'system'].includes(preference)) preference = 'system';
const shop = !location.pathname.endsWith('product-demo.html');
root.dataset.portalPage = shop ? 'shop' : 'demo';
function applyTheme(value, persist = false) {
    preference = ['light', 'dark', 'system'].includes(value) ? value : 'system';
    root.dataset.portalTheme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.style.colorScheme = root.dataset.portalTheme;
    if (persist) try { localStorage.setItem(THEME_KEY, preference); } catch {}
    document.querySelectorAll('[data-portal-appearance]').forEach(select => select.value = preference);
}
applyTheme(preference);
media.addEventListener('change', () => { if (preference === 'system') applyTheme(preference); });
window.addEventListener('storage', event => { if (event.key === THEME_KEY) applyTheme(event.newValue); });

function appearance() {
    const label = document.createElement('label');
    label.className = 'portal-appearance';
    label.innerHTML = '<span aria-hidden="true">◐</span><select data-portal-appearance aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>';
    label.querySelector('select').value = preference;
    label.querySelector('select').addEventListener('change', event => applyTheme(event.target.value, true));
    return label;
}
const header = shop ? document.querySelector('body > header') : null;
if (header) {
    const share = document.getElementById('share-build'), cart = document.getElementById('cart-btn');
    const originalStudio = document.getElementById('open-editor');
    // Preserve existing listeners and counters by moving the actual action nodes.
    header.className = 'portal-header';
    header.innerHTML = '<a class="portal-skip" href="#setup-sidebar">Skip to options</a><div class="portal-brand"><strong>ErgoFlex<span>®</span></strong><small>Custom shop</small></div><nav class="portal-modes" aria-label="Portal"><button type="button" data-portal-mode="store" aria-pressed="false">Store</button><button type="button" data-portal-mode="studio" aria-pressed="false">Studio</button></nav><div class="portal-actions"></div><nav class="portal-mobile-nav" aria-label="Workspace panels"><button type="button" data-portal-jump="preview">3D preview</button><button type="button" data-portal-jump="options">Options</button></nav>';
    if (originalStudio) { originalStudio.hidden = true; header.append(originalStudio); }
    const actions = header.querySelector('.portal-actions');
    actions.append(appearance());
    for (const [node, text] of [[share, 'Share'], [cart, 'Build list']]) {
        if (!node) continue;
        node.className = 'portal-action';
        const label = document.createElement('span'); label.className = 'portal-action-label'; label.textContent = text;
        node.append(label); actions.append(node);
    }
    header.querySelectorAll('[data-portal-mode]').forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.portalMode;
            if (window.ErgoFlex?.setShellMode) window.ErgoFlex.setShellMode(mode);
            else if (mode === 'studio') originalStudio?.click();
            else document.getElementById('setup-exit-btn')?.click();
            updateMode();
        });
    });
    header.querySelectorAll('[data-portal-jump]').forEach(button => button.addEventListener('click', () => {
        const options = button.dataset.portalJump === 'options';
        const target = document.getElementById(options ? 'setup-sidebar' : 'viewer-shell');
        if (options && document.getElementById('config-collapse')?.getAttribute('aria-expanded') === 'false') document.getElementById('config-collapse').click();
        target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
        target?.focus({ preventScroll: true });
    }));
    document.querySelector('.breadcrumb')?.parentElement.classList.add('portal-breadcrumb');
    new ResizeObserver(() => root.style.setProperty('--portal-header-height', header.offsetHeight + 'px')).observe(header);
}

function updateMode() {
    if (!header) return;
    const studio = document.body.classList.contains('setup-layout');
    header.querySelector('.portal-brand small').textContent = studio ? 'Design studio' : 'Custom shop';
    header.querySelectorAll('[data-portal-mode]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.portalMode === 'studio') === studio)));
    const quick = document.getElementById('portal-project-actions');
    if (quick) quick.hidden = !studio;
}
new MutationObserver(updateMode).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function enhance(scope) {
    if (!(scope instanceof Element || scope instanceof Document)) return;
    scope.querySelectorAll('.config-header').forEach(header => {
        const content = header.parentElement.querySelector('.config-content');
        if (!content) return;
        header.setAttribute('role', 'button'); header.tabIndex = 0;
        header.setAttribute('aria-controls', content.id);
        const sync = () => {
            const expanded = content.classList.contains('expanded');
            header.setAttribute('aria-expanded', String(expanded));
            content.inert = !expanded;
        };
        sync();
        if (header.dataset.portalEnhanced) return;
        header.dataset.portalEnhanced = 'true';
        header.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); header.click(); } };
        new MutationObserver(sync).observe(content, { attributes: true, attributeFilter: ['class'] });
    });
    const sidebar = document.getElementById('setup-sidebar');
    if (sidebar && !sidebar.dataset.portalEnhanced) {
        sidebar.dataset.portalEnhanced = 'true'; sidebar.tabIndex = -1; sidebar.setAttribute('aria-label', 'Design options and tools');
        sidebar.addEventListener('keydown', event => {
            const tab = event.target.closest('[data-sidebar-tab]');
            if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = [...sidebar.querySelectorAll('[data-sidebar-tab]')];
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            event.preventDefault(); tabs[index].click(); tabs[index].focus();
        });
    }
    if (sidebar && shop && !document.getElementById('portal-build-summary')) {
        const summary = document.createElement('div'); summary.id = 'portal-build-summary';
        summary.innerHTML = '<div><small>Configuration estimate</small><strong data-portal-price></strong></div><button type="button">Add to build list <span aria-hidden="true">＋</span></button>';
        summary.querySelector('button').onclick = () => document.getElementById('add-to-cart')?.click();
        sidebar.append(summary);
        const sync = () => {
            summary.querySelector('[data-portal-price]').textContent = document.getElementById('total-price')?.textContent || '—';
            summary.hidden = sidebar.dataset.tab === 'editor' || document.body.classList.contains('sidebar-collapsed');
        };
        const price = document.getElementById('total-price');
        if (price) new MutationObserver(sync).observe(price, { childList: true, characterData: true, subtree: true });
        new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ['data-tab'] });
        new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        sync();
    }
    const summary = document.getElementById('portal-build-summary');
    if (summary && sidebar?.lastElementChild !== summary) sidebar.append(summary);
    const chrome = sidebar?.querySelector('.studio-sidebar-header');
    if (chrome && !chrome.querySelector('#portal-project-actions')) {
        const quick = document.createElement('div'); quick.id = 'portal-project-actions';
        quick.innerHTML = '<button type="button" data-project-action="project-save">Save project <span aria-hidden="true">↓</span></button><button type="button" data-project-action="project-load">Open project</button>';
        quick.querySelectorAll('button').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.projectAction)?.click()));
        chrome.append(quick); updateMode();
    }
    const viewer = document.getElementById('viewer-shell');
    if (viewer) { viewer.tabIndex = -1; viewer.setAttribute('aria-label', 'Interactive 3D preview'); }
    const search = document.getElementById('part-search-input');
    if (search) { search.setAttribute('aria-label', 'Search desk parts and scene assets'); search.type = 'search'; }
    const resizer = document.getElementById('setup-resizer');
    if (resizer && !resizer.dataset.portalEnhanced) {
        resizer.dataset.portalEnhanced = 'true'; resizer.tabIndex = 0; resizer.setAttribute('role', 'separator'); resizer.setAttribute('aria-label', 'Resize options panel'); resizer.setAttribute('aria-orientation', 'vertical');
        const syncWidth = () => { resizer.setAttribute('aria-valuemin', '300'); resizer.setAttribute('aria-valuemax', String(Math.max(300, innerWidth - 420))); resizer.setAttribute('aria-valuenow', String(Math.round(sidebar.getBoundingClientRect().width))); };
        new MutationObserver(syncWidth).observe(root, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', syncWidth); syncWidth();
        resizer.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            const current = parseInt(root.style.getPropertyValue('--shell-sidebar-w')) || 360;
            root.style.setProperty('--shell-sidebar-w', Math.max(300, Math.min(innerWidth - 420, current + (event.key === 'ArrowRight' ? 20 : -20))) + 'px');
            window.dispatchEvent(new Event('resize'));
        });
    }
    if (!shop) {
        const top = document.querySelector('.demo-top');
        if (top && !top.querySelector('[data-portal-appearance]')) top.append(appearance());
    }
}
// Observe only structural additions. Live LED values must not trigger an entire UI scan.
let scheduled = false;
const observer = new MutationObserver(records => {
    if (!records.some(record => [...record.addedNodes].some(node => node.nodeType === 1)) || scheduled) return;
    scheduled = true; requestAnimationFrame(() => { scheduled = false; enhance(document); });
});
observer.observe(document.body, { childList: true, subtree: true });
enhance(document); updateMode();

// The existing build-list dialog owns its focus trap and return-focus behavior.
// Viewer popovers additionally return focus to their trigger on Escape.
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('.render-settings[open]').forEach(details => { details.open = false; details.querySelector('summary')?.focus(); });
});
