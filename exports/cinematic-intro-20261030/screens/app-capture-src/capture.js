(async (page) => {
  const fs = require('fs');
  const CFG = JSON.parse(fs.readFileSync(process.env.CAPCFG, 'utf8'));
  const OUT = CFG.out; fs.mkdirSync(OUT, { recursive: true });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const state = async () => page.evaluate(() => {
    const d = JSON.parse(window.__efDesk || '{}'); let r = null, a = null;
    const h = document.querySelector('flt-semantics-host');
    if (h) h.querySelectorAll('flt-semantics').forEach(e => { const t = e.textContent || ''; let m = /^\s*(\d\d\.\d)\s*INCHES/.exec(t); if (m && r == null) r = +m[1]; m = /^\s*([-−+]?\d+)\s*°\s*ANGLE/.exec(t); if (m && a == null) a = m[1]; });
    return { v: window.__vc.now(), h: d.height, tilt: d.tilt, lm: d.liftMoving, tm: d.tiltMoving, r, a };
  });
  await page.setViewport({ width: CFG.w, height: CFG.h, deviceScaleFactor: 2 });
  const cuesOff = async () => page.evaluate(() => { const f = document.querySelector('iframe'); return !!(f && f.contentWindow.ErgoViewer && f.contentWindow.ErgoViewer.screenCues(false)); });
  await sleep(4000);
  console.log('cuesOff', await cuesOff());
  await page.evaluate(() => { const p = document.querySelector('flt-semantics-placeholder'); if (p) p.click(); });
  // reset pose in real time
  const tap = async (x, y) => { await page.mouse.move(x, y); await sleep(200); await page.mouse.click(x, y, { delay: 80 }); };
  await tap(...CFG.tilt0); await sleep(6000); await tap(...CFG.h28);
  for (let i = 0; i < 60; i++) { await sleep(500); const s = await state(); if (!s.lm && !s.tm && Math.abs(s.h - 28) < 0.01) break; }
  await page.mouse.move(CFG.stand[0], CFG.stand[1]); await sleep(4000);
  console.log('cuesOff2', await cuesOff());
  await page.evaluate(() => window.__vc.freeze());
  const log = []; let n = 0; const dt = 1000 / 30; let lastR = null;
  const step = async (shoot, ev) => {
    await page.evaluate(ms => window.__vc.advance(ms), dt);
    const s = await state(); s.i = n; s.ev = ev || null;
    if (shoot || s.r !== lastR) { await page.screenshot({ path: `${OUT}/f${String(n).padStart(5, '0')}.png` }); s.shot = true; }
    lastR = s.r; log.push(s); n++;
    if (n % 30 === 0) fs.writeFileSync(`${OUT}/log.json`, JSON.stringify(log));
    return s;
  };
  for (let i = 0; i < 45; i++) await step(true);
  // touch 1: tap Standing
  await page.mouse.down(); await step(true, 'down1');
  for (let i = 0; i < 3; i++) await step(true);
  await page.mouse.up(); await step(true, 'up1');
  let s, idle = 0, k = 0, started = false;
  for (let guard = 0; guard < 30 * 40; guard++) {
    s = await step(!started || (k++ % 3 === 0));
    if (s.lm || s.tm) started = true;
    if (started && !s.lm && !s.tm) break;
  }
  for (let i = 0; i < 45; i++) await step(true);
  // touch 2: press-and-drag the height thumb to the top, hold
  await page.mouse.move(CFG.thumb[0], CFG.thumb[1]); await step(true);
  await page.mouse.down(); await step(true, 'down2');
  const N = 6; for (let i = 1; i <= N; i++) { await page.mouse.move(CFG.thumb[0], CFG.thumb[1] + (CFG.thumbTop - CFG.thumb[1]) * i / N); await step(true, i === N ? 'dragdone2' : null); }
  started = false;
  for (let guard = 0; guard < 30 * 30; guard++) { s = await step(true); if (s.lm) started = true; if (started && !s.lm) break; }
  for (let i = 0; i < 10; i++) await step(true);
  await page.mouse.up(); await step(true, 'up2');
  for (let i = 0; i < 30 * 8; i++) await step(true);
  fs.writeFileSync(`${OUT}/log.json`, JSON.stringify(log));
  await page.evaluate(() => window.__vc.unfreeze());
  return { frames: n, shots: log.filter(x => x.shot).length };
})
