(() => {
  let top_ = null; try { top_ = window.top; void top_.document; } catch (e) { top_ = null; }
  const W = window;
  const realRAF = W.requestAnimationFrame.bind(W), realCAF = W.cancelAnimationFrame.bind(W);
  const realST = W.setTimeout.bind(W), realCT = W.clearTimeout.bind(W);
  const realPerfNow = performance.now.bind(performance), realDateNow = Date.now;
  if (top_ && top_ !== W) { try { Object.defineProperty(W, "devicePixelRatio", { get: () => (top_.__vcIframeDpr || 1), configurable: true }); } catch (e) {} }
  let vc;
  if (top_ && top_ !== W && top_.__vc) { vc = top_.__vc; }
  else {
    vc = W.__vc = { frozen: false, base: realPerfNow(), dateBase: realDateNow(), v: 0, timers: new Map(), rafs: new Map(), seq: 1, realPerfNow, realDateNow };
    vc.now = () => vc.frozen ? vc.v : (realPerfNow() - vc.base);
    vc.runTimers = (upto) => {
      for (;;) {
        let best = null;
        for (const [id, t] of vc.timers) if (t.due <= upto && (!best || t.due < best.due || (t.due === best.due && id < best.id))) best = t;
        if (!best) break;
        if (vc.frozen) vc.v = Math.max(vc.v, best.due);
        if (best.interval != null) best.due += Math.max(1, best.interval); else vc.timers.delete(best.id);
        try { best.fn.apply(best.win, best.args); } catch (e) { console.error('vc timer', e); }
      }
    };
    const pump = () => { if (!vc.frozen) vc.runTimers(vc.now()); realST(pump, 2); };
    realST(pump, 2);
    vc.freeze = () => { vc.v = realPerfNow() - vc.base; vc.frozen = true; return vc.v; };
    vc.unfreeze = () => { vc.base = realPerfNow() - vc.v; vc.frozen = false; const q = [...vc.rafs.values()]; vc.rafs.clear(); for (const r of q) r.realId = r.realRAF(ts => r.fn(vc.now())); };
    vc.fireRAF = () => { const q = [...vc.rafs.values()]; vc.rafs.clear(); for (const r of q) { try { r.fn(vc.v); } catch (e) { console.error('vc raf', e); } } return q.length; };
    // advance by ms in steps: runs timers in order, then fires one rAF round at the end
    vc.advance = (ms) => { const end = vc.v + ms; vc.runTimers(end); vc.v = end; return vc.fireRAF(); };
  }
  performance.now = () => vc.now();
  Date.now = () => Math.round(vc.dateBase + vc.now());
  W.setTimeout = (fn, ms, ...args) => { if (typeof fn !== 'function') { const s = fn; fn = () => (0, eval)(s); } const id = vc.seq++; vc.timers.set(id, { id, fn, args, win: W, due: vc.now() + Math.max(0, +ms || 0), interval: null }); return id; };
  W.setInterval = (fn, ms, ...args) => { const id = vc.seq++; vc.timers.set(id, { id, fn, args, win: W, due: vc.now() + Math.max(1, +ms || 0), interval: Math.max(1, +ms || 0) }); return id; };
  W.clearTimeout = W.clearInterval = (id) => { vc.timers.delete(id); };
  W.requestAnimationFrame = (fn) => { const id = vc.seq++; const r = { id, fn, realRAF }; if (vc.frozen) vc.rafs.set(id, r); else { vc.rafs.set(id, r); r.realId = realRAF(() => { if (vc.rafs.has(id) && !vc.frozen) { vc.rafs.delete(id); fn(vc.now()); } }); } return id; };
  W.cancelAnimationFrame = (id) => { const r = vc.rafs.get(id); if (r) { vc.rafs.delete(id); if (r.realId) realCAF(r.realId); } };
})();
