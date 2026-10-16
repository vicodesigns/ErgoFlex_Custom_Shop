// Owner's scene tour: a compact toolbar on the 3D viewer for flipping through
// every environment, its room sizes and its times of day, plus a full-screen
// mode that shows only the 3D view. Shown on development hosts (localhost,
// LAN, Tailscale) or with ?tour in the URL; never on the public site unless
// asked for.
const LOCAL = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.ts\.net$/;
export function tourEnabled(location = window.location) {
    const params = new URLSearchParams(location.search);
    if (params.get('tour') === '0') return false;
    return params.has('tour') || LOCAL.test(location.hostname);
}

const CSS = `
#scene-tour{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:6px;
  padding:6px;border-radius:14px;background:rgba(15,20,26,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  color:#f3f5f7;font:500 13px/1.2 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:calc(100% - 24px);user-select:none}
#scene-tour button{display:flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.08);color:inherit;font:inherit;white-space:nowrap;touch-action:manipulation;cursor:pointer}
#scene-tour button:active{background:rgba(255,255,255,.2)}
#scene-tour button[disabled]{opacity:.4}
#scene-tour button[aria-pressed="true"]{background:#2bb673;border-color:#2bb673;color:#06140c}
#scene-tour .tour-label{display:flex;flex-direction:column;min-width:0;padding:0 6px;max-width:260px}
#scene-tour .tour-label strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#scene-tour .tour-label span{opacity:.72;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#scene-tour svg{width:18px;height:18px;flex:none}
/* Full screen: only the canvas and this toolbar remain. */
.scene-tour-full{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;max-height:none!important;
  min-height:0!important;margin:0!important;border-radius:0!important;z-index:2147483000!important;background:#0f141a}
.scene-tour-full canvas{width:100%!important;height:100%!important}
.scene-tour-full .scene-tour-hide{display:none!important}
html.scene-tour-locked,html.scene-tour-locked body{overflow:hidden!important}
#scene-tour.tour-collapsed .tour-cycle,#scene-tour.tour-collapsed .tour-label span{display:none}
/* Sized to the 3D view, not the window: the view is narrow beside the store panel. */
#scene-tour.tour-compact .tour-word{display:none}#scene-tour.tour-compact button{padding:0 10px}#scene-tour.tour-compact .tour-label{max-width:140px}
`;
const ICON = {
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/></svg>',
    size: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h9V3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
};

export class SceneTour {
    // ctx: { shell, scenes() -> [{id,name}], current() -> id, profile(id) -> {layouts,modes,layout,mode}|null,
    //        setScene(id), setLayout(sceneId, layoutId), setMode(sceneId, modeId), ready(kind) -> Promise, onResize(),
    //        groove: { toggle(), active(), available() } }
    constructor(ctx) {
        this.ctx = ctx; this.busy = false; this.full = false;
        const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
        const bar = this.bar = document.createElement('div'); bar.id = 'scene-tour'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Scene tour');
        bar.innerHTML = `
            <button type="button" data-tour="full" aria-pressed="false" title="Full screen">${ICON.full}<span class="tour-word">Full</span></button>
            <button type="button" class="tour-cycle" data-tour="scene" title="Next environment">${ICON.room}<span class="tour-word">Room</span></button>
            <button type="button" class="tour-cycle" data-tour="layout" title="Next room size">${ICON.size}<span class="tour-word">Size</span></button>
            <button type="button" class="tour-cycle" data-tour="mode" title="Next time of day">${ICON.time}<span class="tour-word">Time</span></button>
            <button type="button" class="tour-cycle" data-tour="groove" aria-pressed="false" title="Play this time of day's Groove routine">${ICON.play}<span class="tour-word">Groove</span></button>
            <div class="tour-label" aria-live="polite"><strong></strong><span></span></div>`;
        const host = ctx.shell.querySelector('canvas').parentElement; host.append(bar);
        new ResizeObserver(() => bar.classList.toggle('tour-compact', host.clientWidth < 760)).observe(host);
        // Tapping the label hides the cycle buttons for a less obstructed view; tap it again to bring them back.
        bar.querySelector('.tour-label').addEventListener('click', () => bar.classList.toggle('tour-collapsed'));
        bar.addEventListener('click', e => {
            const action = e.target.closest('[data-tour]')?.dataset.tour; if (!action) return;
            e.stopPropagation();
            if (action === 'full') this.toggleFull();
            else if (action === 'groove') { Promise.resolve(this.ctx.groove.toggle()).finally(() => this.sync()); this.sync(); }
            else this.step(action);
        });
        // Keep the toolbar's taps and drags from orbiting the camera or selecting items.
        for (const type of ['pointerdown', 'pointerup', 'pointermove', 'wheel']) bar.addEventListener(type, e => e.stopPropagation());
        document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && this.full) this.setFull(false, false); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.full && !document.fullscreenElement) this.setFull(false); });
        // Groove runs for many seconds and can be stopped elsewhere; keep its button honest.
        setInterval(() => { if (this.bar.isConnected && !document.hidden) this.syncGroove(); }, 400);
        this.sync();
    }
    syncGroove() {
        const button = this.bar.querySelector('[data-tour="groove"]'), on = !!this.ctx.groove.active();
        button.disabled = !this.ctx.groove.available();
        if (button.getAttribute('aria-pressed') === String(on)) return;
        button.setAttribute('aria-pressed', String(on)); button.title = on ? 'Stop Groove' : "Play this time of day's Groove routine";
        button.innerHTML = `${on ? ICON.stop : ICON.play}<span class="tour-word">${on ? 'Stop' : 'Groove'}</span>`;
    }
    list(kind) {
        const id = this.ctx.current(), profile = this.ctx.profile(id);
        if (kind === 'scene') return { ids: this.ctx.scenes().map(s => s.id), at: id };
        if (!profile) return { ids: [], at: null };
        if (kind === 'layout') return { ids: Object.keys(profile.layouts), at: profile.layout?.id };
        return { ids: Object.keys(profile.modes), at: profile.mode };
    }
    async step(kind) {
        if (this.busy) return;
        const { ids, at } = this.list(kind); if (ids.length < 2) return;
        const next = ids[(ids.indexOf(at) + 1) % ids.length], scene = this.ctx.current();
        this.busy = true; this.bar.setAttribute('aria-busy', 'true');
        try {
            if (kind === 'scene') this.ctx.setScene(next);
            else if (kind === 'layout') this.ctx.setLayout(scene, next);
            else this.ctx.setMode(scene, next);
            this.sync();
            await this.ctx.ready(kind);
        } finally { this.busy = false; this.bar.removeAttribute('aria-busy'); this.sync(); }
    }
    sync() {
        const id = this.ctx.current(), scene = this.ctx.scenes().find(s => s.id === id), profile = this.ctx.profile(id);
        const layout = profile?.layout, mode = profile?.modes?.[profile.mode];
        this.bar.querySelector('.tour-label strong').textContent = scene?.name || id;
        this.bar.querySelector('.tour-label span').textContent = profile ? [layout?.name || layout?.id, mode?.label || profile.mode].filter(Boolean).join(' · ') : 'No room sizes';
        for (const kind of ['layout', 'mode']) this.bar.querySelector(`[data-tour="${kind}"]`).disabled = this.list(kind).ids.length < 2;
        this.syncGroove();
    }
    toggleFull() { this.setFull(!this.full); }
    setFull(on, useApi = true) {
        const shell = this.ctx.shell; this.full = on;
        shell.classList.toggle('scene-tour-full', on);
        document.documentElement.classList.toggle('scene-tour-locked', on);
        // Hide every viewer overlay except the canvas and this toolbar.
        for (const el of this.bar.parentElement.children) if (el !== this.bar && el.tagName !== 'CANVAS') el.classList.toggle('scene-tour-hide', on);
        for (const el of shell.children) if (!el.contains(this.bar)) el.classList.toggle('scene-tour-hide', on);
        const button = this.bar.querySelector('[data-tour="full"]');
        button.setAttribute('aria-pressed', String(on)); button.title = on ? 'Exit full screen' : 'Full screen';
        button.innerHTML = `${on ? ICON.exit : ICON.full}<span class="tour-word">${on ? 'Exit' : 'Full'}</span>`;
        if (useApi) {
            if (on && !document.fullscreenElement) shell.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
            else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        }
        requestAnimationFrame(() => this.ctx.onResize?.());
    }
}
