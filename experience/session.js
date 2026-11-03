/* Runs before the configurator imports: presentation writes stay in memory. */
(() => {
  const query = new URLSearchParams(location.search);
  if (query.get('presentation') === '1' && parent !== window) {
    const memory = source => {
      const values = new Map();
      try { for (let i = 0; i < source.length; i++) { const k = source.key(i); values.set(k, source.getItem(k)); } } catch {}
      const methods = { getItem: k => values.get(String(k)) ?? null,
        setItem: (k,v) => { values.set(String(k), String(v)); }, removeItem: k => { values.delete(String(k)); },
        clear: () => values.clear(), key: i => [...values.keys()][i] ?? null };
      return new Proxy(methods, {
        get: (t,k) => k === 'length' ? values.size : k in t ? t[k] : values.get(k),
        set: (_,k,v) => { values.set(k,String(v)); return true; },
        ownKeys: () => [...values.keys()], getOwnPropertyDescriptor: (_,k) => values.has(k) ? {configurable:true, enumerable:true,value:values.get(k)} : undefined
      });
    };
    try {
      for (const name of ['localStorage','sessionStorage']) {
        const store = memory(window[name]);
        Object.defineProperty(window, name, {value:store, configurable:false});
      }
      Object.defineProperty(window, '__ERGO_PRESENTATION__', {value:true});
    } catch {
      // Never run a demo against writable owner storage when isolation failed.
      window.stop();
      document.documentElement.textContent = 'Preview isolation unavailable. Return to the interactive experience.';
      throw new Error('Presentation storage isolation failed');
    }
    return;
  }
  if (parent !== window) return;
  let seen = true;
  try { seen = localStorage.getItem('ergoflex.cinematicSeen.v1') === '1'; } catch {}
  // Existing editing links always go straight to their workspace.
  if (query.get('intro') === '1' || (!seen && !location.search && !matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    const target = new URL('./experience/', location.href);
    target.searchParams.set('return', location.pathname + location.search.replace(/([?&])intro=1&?/, '$1'));
    location.replace(target);
  }
})();
