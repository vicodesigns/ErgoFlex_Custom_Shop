// Layers, phase 4, end to end in a real Studio page (an agent can run it, no human needed):
//   node tests/studio-layers-desks-e2e.cjs [--port N] [--keep]
// It starts its OWN studio server on a free port (never :3000) with a scratch state file in a new temp directory,
// opens the high school at First bell and checks, through the page's own API (window.ErgoFlex.layers, .undoEdit,
// .redoEdit, .sceneDesks, .workspaceRoom), that one eye hides a desk with what is on it and the person at it for this
// time and size, and that everything comes back. One line per check ("PASS name" / "FAIL name: reason"), exit 0 or 1.
// Chrome: Linux uses /usr/bin/google-chrome when it exists with the GPU flags of tools/rooms/room-stills.cjs; Windows
// uses puppeteer's default launch. Needs the GPU (or a patient software GL): do not run it while a film renders.
// The pure helpers below (server args, free port, launch options, result lines) are tested in node without a browser
// by tests/studio-layers-desks-e2e-helpers-test.mjs.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const FORBIDDEN_PORTS = new Set([3000]);   // Vico's live Studio server
const DESKS_KEY = 'ergoflex.sceneDesksBySizeV2', LAYERS_KEY = 'ergoflex.sceneLayers.v1';
const RESEARCH = 'desk:station-research-desk', MAIN = 'desk:main';

// ---- pure helpers
function serverArgs({ repo = REPO, port, stateFile }) {
  if (!Number.isInteger(port) || port <= 0 || FORBIDDEN_PORTS.has(port)) throw Error(`refusing port ${port}`);
  if (!stateFile || path.resolve(stateFile) === path.resolve(repo, 'studio-state.json')) throw Error('refusing the committed studio-state.json');
  return [path.join(repo, 'tools', 'studio-server.mjs'), '--port', String(port), '--host', '127.0.0.1', '--state', stateFile, '--no-watch'];
}
// A free TCP port on 127.0.0.1 (never a forbidden one). netImpl for tests.
function pickPort(netImpl = net, tries = 5) {
  return new Promise((resolve, reject) => {
    const attempt = left => {
      const srv = netImpl.createServer();
      srv.once('error', e => left > 0 ? attempt(left - 1) : reject(e));
      srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => (FORBIDDEN_PORTS.has(port) && left > 0) ? attempt(left - 1) : FORBIDDEN_PORTS.has(port) ? reject(Error('no free port')) : resolve(port)); });
    };
    attempt(tries);
  });
}
function chromeOptions({ platform = process.platform, exists = fs.existsSync, width = 1600, height = 1000 } = {}) {
  const opts = { headless: 'new', defaultViewport: { width, height }, protocolTimeout: 600000 };
  if (platform === 'linux') {
    if (exists('/usr/bin/google-chrome')) opts.executablePath = '/usr/bin/google-chrome';
    opts.args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'];
  } else opts.args = ['--mute-audio'];   // Windows / macOS: puppeteer's default Chrome and GL
  return opts;
}
// checks: [{name, ok, reason}] -> {lines, code}
function formatResult(checks) {
  const one = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const lines = checks.map(c => c.ok ? `PASS ${one(c.name)}` : `FAIL ${one(c.name)}: ${one(c.reason) || 'no reason given'}`);
  const failed = checks.filter(c => !c.ok).length;
  lines.push(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`);
  return { lines, code: failed || !checks.length ? 1 : 0 };
}
// Poll read() until pred(value) or the timeout: {ok, value, ms}. now / sleep for tests.
async function pollUntil(read, pred, { timeout = 30000, interval = 250, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const t0 = now(); let value;
  for (;;) {
    value = await read();
    if (pred(value)) return { ok: true, value, ms: now() - t0 };
    if (now() - t0 >= timeout) return { ok: false, value, ms: now() - t0 };
    await sleep(interval);
  }
}
// Compare two snapshots of the room (page side: snap()), all desks and people but the ones named.
function othersUnchanged(before, after, { desks = [], people = [] } = {}) {
  const diffs = [];
  for (const [id, d] of Object.entries(before.desks || {})) if (!desks.includes(id) && after.desks?.[id]?.shown !== d.shown) diffs.push(`${id} ${d.shown ? 'disappeared' : 'appeared'}`);
  for (const [k, p] of Object.entries(before.people || {})) if (!people.includes(k) && after.people?.[k]?.shown !== p.shown) diffs.push(`${k} ${p.shown ? 'disappeared' : 'appeared'}`);
  return diffs;
}
const samePlace = (a, b, mm = 5) => !!a && !!b && Math.abs(a.x - b.x) <= mm && Math.abs(a.z - b.z) <= mm && Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw))) <= .01;

// ---- page side (installed with page.evaluate; plain functions, every lookup guarded)
function installPageHelpers() {
  const shownChain = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  window.__lyE2E = {
    ready() { const E = window.ErgoFlex; return !!(E?.loadedModel && E.layers && E.workspaceRoom?.id === 'highschool' && E.sceneDesks?.key && E.sceneDesks.records?.size > 1 && E.workspaceRoom.people?.people?.length); },
    snap() {
      const E = window.ErgoFlex, sd = E.sceneDesks, out = { selected: sd?.selected || null, desks: {}, people: {} };
      for (const [id, r] of sd?.records || []) {
        const live = id === sd.selected, root = live ? E.loadedModel : r.group;
        let meshes = 0, shown = 0; r.group?.traverse?.(o => { if (o.isMesh) { meshes++; if (shownChain(o)) shown++; } });
        out.desks['desk:' + id] = { shown: !!root && shownChain(root) && (live || shown > 0), meshes, meshesShown: shown, live };
      }
      for (const o of E.workspaceRoom?.people?.people || []) {
        const s = o?.userData?.person; if (!s) continue;
        const key = s.variant || s.key || s.id, was = out.people[key], on = !!o.parent && shownChain(o);
        if (!was || (on && !was.shown)) out.people[key] = { shown: on || !!was?.shown, station: s.station || null, desk: s.desk || null, x: o.position.x, z: o.position.z, yaw: o.rotation.y };
      }
      // what belongs to a desk (its placement names the station: userData.layersStation): shown, and where (room frame)
      out.items = {};
      for (const o of E.workspaceRoom?.assets?.() || []) {
        const st = o?.userData?.layersStation; if (typeof st !== 'string') continue;
        const key = 'scene:' + o.userData.sceneAssetKey; o.updateWorldMatrix?.(true, false);
        out.items[key] = { station: st, propId: o.userData.propId || '', shown: !!o.parent && shownChain(o), p: o.position.toArray(), q: o.quaternion.toArray() };
      }
      return out;
    },
    userOf(station) { for (const o of window.ErgoFlex.workspaceRoom?.people?.people || []) { const s = o?.userData?.person; if (s && (station ? s.station === station : s.desk && !s.station) && (!s.modes || s.modes.includes(window.ErgoFlex.measuredRoom?.mode))) return s.variant || s.key || s.id; } return null; },
    async flush() { try { await window.__studioState?.flush?.(); } catch {} }
  };
}

// ---- the run
async function main() {
  const argv = process.argv.slice(2), keep = argv.includes('--keep'), portArg = Number(argv[argv.indexOf('--port') + 1]);
  const port = argv.includes('--port') ? portArg : await pickPort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-e2e-')), stateFile = path.join(tmp, 'studio-state.json');
  const checks = [], check = (name, ok, reason = '') => { checks.push({ name, ok: !!ok, reason: ok ? '' : reason }); console.log(ok ? `PASS ${name}` : `FAIL ${name}: ${reason}`); };
  let server = null, browser = null;
  const finish = code => { try { browser?.close(); } catch {} try { server?.kill(); } catch {} if (!keep) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} return code; };
  try {
    server = spawn(process.execPath, serverArgs({ port, stateFile }), { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverErr = ''; server.stderr.on('data', d => { serverErr += d; });
    const base = `http://127.0.0.1:${port}/`, api = () => fetch(base + 'api/studio-state').then(r => r.json());
    const t0 = Date.now(); for (;;) { try { await api(); break; } catch { if (Date.now() - t0 > 60000) throw Error('the test studio server did not start: ' + serverErr.split('\n').filter(Boolean).slice(-1)[0]); await new Promise(r => setTimeout(r, 500)); } }
    let puppeteer; try { puppeteer = require('puppeteer'); } catch { puppeteer = require('puppeteer-core'); }
    browser = await puppeteer.launch(chromeOptions());
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
    const wait = (fn, ms, what, ...a) => page.waitForFunction(fn, { timeout: ms, polling: 250 }, ...a).catch(() => { throw Error('timed out waiting for ' + what); });
    const settle = (ms = 900) => new Promise(r => setTimeout(r, ms));   // the panel re-applies on a 500 ms tick
    async function open() {
      await page.goto(base + '?layers=1', { waitUntil: 'domcontentloaded', timeout: 240000 });
      await wait(() => !!(window.ErgoFlex?.loadedModel && window.ErgoFlex.layers), 240000, 'the Studio and its Layers API');
      await page.evaluate(installPageHelpers);
      await page.evaluate(() => { window.ErgoFlex.setRoomScene('highschool'); });
      await wait(() => window.ErgoFlex.workspaceRoom?.id === 'highschool' && window.ErgoFlex.sceneDesks?.records?.size > 1, 240000, 'the high school and its desks');
      await page.evaluate(() => { window.ErgoFlex.setMeasuredRoomMode('highschool', 'morning'); window.ErgoFlex.setRoomPeople(true); });
      await wait(() => window.__lyE2E.ready(), 240000, 'the people of the high school');
      await settle(3000);
    }
    const snap = () => page.evaluate(() => window.__lyE2E.snap());
    // Wait on the state itself (seen on the desk: a fixed pause read the room one daypart behind while the new hour's
    // people loaded). Each check polls the page until its condition holds or 30 s pass, and says how long it took.
    const until = (pred, timeout = 30000) => pollUntil(snap, v => { try { return !!pred(v); } catch { return false; } }, { timeout });
    const took = w => ` (after ${Math.round(w.ms / 100) / 10} s)`;
    const mode = m => page.evaluate(m => window.ErgoFlex.setMeasuredRoomMode('highschool', m), m);
    const layers = (fn, id, scope) => page.evaluate((fn, id, scope) => window.ErgoFlex.layers[fn](id, scope), fn, id, scope);
    const serverDesks = async () => (await api()).values?.[DESKS_KEY] ?? null;
    const deskWrites = async () => { await page.evaluate(() => window.__lyE2E.flush()); await settle(1500); return [await serverDesks(), await page.evaluate(k => localStorage.getItem(k), DESKS_KEY)]; };
    let noah = null;
    const hiddenR = v => !v.desks[RESEARCH]?.shown && v.desks[RESEARCH]?.meshesShown === 0 && !v.people[noah]?.shown;
    const shownR = v => v.desks[RESEARCH]?.shown && v.people[noah]?.shown;
    const sayR = v => `desk shown ${v.desks[RESEARCH]?.shown} (${v.desks[RESEARCH]?.meshesShown} of ${v.desks[RESEARCH]?.meshes} meshes drawn), ${noah} shown ${v.people[noah]?.shown}`;

    await open();
    check('the page has the Layers test API', await page.evaluate(() => !!window.ErgoFlex.layers?.rows && !!window.ErgoFlex.undoEdit), 'window.ErgoFlex.layers or undoEdit is missing (is Layers switched off?)');
    noah = await page.evaluate(() => window.__lyE2E.userOf('research-desk'));
    const w0 = await until(shownR, 60000), b0 = w0.value, [desks0, local0] = await deskWrites();
    check('the research desk and Noah are shown at First bell before any hide', w0.ok && noah, `user ${noah}; ${sayR(b0)}${took(w0)}`);
    const rows = await page.evaluate(() => window.ErgoFlex.layers.rows());
    check('the Desks group lists the research desk with its user nested under it', rows.some(r => r.id === RESEARCH && r.group === 'desk') && rows.some(r => r.nestedIn === RESEARCH), 'no desk row or no nested user row for ' + RESEARCH);

    // 1. one eye, this time and size
    await layers('hide', RESEARCH, 'cell');
    let w = await until(hiddenR);
    check('hide (this time & size): the research desk, its screens and objects are invisible', !w.value.desks[RESEARCH]?.shown && w.value.desks[RESEARCH]?.meshesShown === 0, sayR(w.value) + took(w));
    check('hide: Noah is not shown', !w.value.people[noah]?.shown, sayR(w.value) + took(w));
    const d1 = othersUnchanged(b0, w.value, { desks: [RESEARCH], people: [noah] });
    check('hide: the room\'s other desks and people are unchanged', !d1.length, d1.slice(0, 4).join(', '));
    await mode('afternoon'); w = await until(shownR);
    check('Wave lab: the research desk and Noah are back', w.ok, sayR(w.value) + took(w));
    await mode('morning'); w = await until(hiddenR);
    check('First bell again: hidden again', w.ok, sayR(w.value) + took(w));
    await layers('show', RESEARCH, 'cell'); w = await until(v => shownR(v) && samePlace(v.people[noah], b0.people[noah]));
    const moved = w.value.people[noah] && b0.people[noah] ? Math.round(Math.hypot(w.value.people[noah].x - b0.people[noah].x, w.value.people[noah].z - b0.people[noah].z)) + ' units' : '?';
    check('the eye: the desk and Noah are back, seated, at the same pose', w.ok && w.value.people[noah]?.desk === 'sit', `${sayR(w.value)}, desk role ${w.value.people[noah]?.desk}, moved ${moved}${took(w)}`);
    const [desksA, localA] = await deskWrites();

    // 1b. what belongs to the media desk (its office chair, the PC tower) goes and comes back with it. "Back" means the
    // visibility each had BEFORE the hide: at First bell Noah sits at the media desk and the people code sets the room's
    // station chair aside for the chair his posture brings, so that chair is already invisible then (not a Layers hide).
    const mine = v => Object.entries(v.items || {}).filter(([, x]) => x.station === 'research-desk'), theirs = v => Object.entries(v.items || {}).filter(([, x]) => x.station !== 'research-desk');
    const short = k => k.split(':').slice(-2).join(':'), was = k => !!b0.items?.[k]?.shown;
    const asBefore = (v, except = null) => mine(b0).every(([k]) => k === except || !!v.items?.[k]?.shown === was(k));
    const sayItems = v => mine(b0).map(([k]) => `${short(k)} shown ${!!v.items?.[k]?.shown} (before: ${was(k)})`).join(', ');
    check('the media desk has its chair and PC tower in the room', mine(b0).length >= 2, `${mine(b0).length} items belong to it: ${mine(b0).map(([k, x]) => short(k) + (x.shown ? '' : ' (not shown: set aside for its seated user)')).join(', ')}`);
    await layers('hide', RESEARCH, 'cell'); w = await until(v => hiddenR(v) && mine(v).every(([, x]) => !x.shown));
    check('hide the media desk: its chair and PC tower are invisible too', w.ok, mine(w.value).filter(([, x]) => x.shown).map(([k]) => short(k) + ' still shown').join(', ') + took(w));
    const moved1 = theirs(b0).filter(([k, x]) => w.value.items[k]?.shown !== x.shown).map(([k]) => short(k));
    check('hide the media desk: the other desks\' chairs and props are unchanged', !moved1.length, moved1.join(', ') + ' changed');
    await layers('show', RESEARCH, 'cell'); w = await until(v => shownR(v) && asBefore(v));
    check('show the media desk: its chair and PC tower are as they were before the hide', w.ok, 'expected each as before: ' + sayItems(w.value) + took(w));
    // one check per item: back where it was (position within 0.5 units, rotation |q.q'| >= 0.9999)
    for (const [k, x] of mine(b0)) {
      const y = w.value.items[k], dp = y ? Math.hypot(...y.p.map((c, i) => c - x.p[i])) : NaN, dq = y ? Math.abs(y.q.reduce((acc, c, i) => acc + c * x.q[i], 0)) : NaN;
      check(`show the media desk: ${short(k)} is back at the same transform`, !!y && dp <= .5 && dq >= .9999, y ? `moved ${dp.toFixed(2)} units, |q.q'| ${dq.toFixed(5)}` : 'not in the room any more');
    }
    // an item hidden on its own stays hidden when its desk comes back (the others return to how they were before)
    const pcKey = mine(b0).find(([, x]) => /desktop-pc/.test(x.propId))?.[0] || mine(b0).at(-1)?.[0];
    if (pcKey) {
      await layers('hide', pcKey, 'all'); await until(v => !v.items[pcKey]?.shown);
      await layers('hide', RESEARCH, 'cell'); await until(hiddenR); await layers('show', RESEARCH, 'cell');
      w = await until(v => shownR(v) && !v.items[pcKey]?.shown && asBefore(v, pcKey));
      check('an item hidden on its own stays hidden when its desk is shown', w.ok,
        `expected ${short(pcKey)} hidden (its own hide) and the rest as before: ${short(pcKey)} shown ${!!w.value.items[pcKey]?.shown}; ${mine(b0).filter(([k]) => k !== pcKey).map(([k]) => `${short(k)} shown ${!!w.value.items[k]?.shown} (before: ${was(k)})`).join(', ')}${took(w)}`);
      await layers('show', pcKey, 'all'); w = await until(v => asBefore(v));
      check(`showing ${short(pcKey)} again brings it back`, w.ok, sayItems(w.value) + took(w));
    } else check('an item hidden on its own stays hidden when its desk is shown', false, 'the media desk has no item of its own to hide');
    check('hiding the research desk wrote nothing to ' + DESKS_KEY, desksA === desks0 && localA === local0, `server ${desks0 === desksA ? 'same' : 'changed'}, this browser ${local0 === localA ? 'same' : 'changed'}`);

    // 2. the featured desk (Kai goes with it). Kai sits in a wheelchair: his postures are for 28 and 31 in, so the
    // featured desk goes to 28 in, flat, first (the empty test state starts it at the First bell height, 43.5 in).
    const kai = await page.evaluate(() => window.__lyE2E.userOf(null));
    await page.evaluate(() => { const E = window.ErgoFlex; for (const c of E.tiltConfigs || []) { try { E.setTilt(c.name, 0); } catch {} } E.setHeight(28); });
    const hk = await pollUntil(() => page.evaluate(() => ({ h: window.ErgoFlex.heightInches, v: window.__lyE2E.snap() })), x => Math.abs(x.h - 28) <= .05 && !!kai && !!x.v.people[kai]?.shown, { timeout: 30000 });
    check('Kai is shown at the featured desk at 28 in before its hide', hk.ok, `${kai || 'no featured-desk user'} shown ${hk.value.v.people[kai]?.shown}, desk at ${Number(hk.value.h).toFixed(2)} in${took(hk)}`);
    const k0 = hk.value.v, [desksB0, localB0] = await deskWrites();
    await layers('hide', MAIN, 'cell'); w = await until(v => !v.desks[MAIN]?.shown && v.selected !== 'main' && (!kai || !v.people[kai]?.shown));
    check('hide the featured desk: it is invisible and another desk is featured', !w.value.desks[MAIN]?.shown && w.value.selected !== 'main', `main shown ${w.value.desks[MAIN]?.shown}, selected ${w.value.selected}${took(w)}`);
    check('hide the featured desk: Kai goes with it', !kai || !w.value.people[kai]?.shown, `${kai} still shown${took(w)}`);
    await layers('show', MAIN, 'cell'); w = await until(v => v.selected === 'main' && v.desks[MAIN]?.shown && (!kai || (v.people[kai]?.shown && samePlace(v.people[kai], k0.people[kai]))));
    const hAfter = await page.evaluate(() => window.ErgoFlex.heightInches);
    check('show the featured desk: featured again, Kai back at the same pose', w.ok,
      `selected ${w.value.selected}, main shown ${w.value.desks[MAIN]?.shown}, ${kai} shown ${w.value.people[kai]?.shown}, desk at ${Number(hAfter).toFixed(2)} in${took(w)}`);
    const [desksB1, localB1] = await deskWrites();
    check('hiding the featured desk wrote nothing to ' + DESKS_KEY, desksB1 === desksB0 && localB1 === localB0, `server ${desksB0 === desksB1 ? 'same' : 'changed'}, this browser ${localB0 === localB1 ? 'same' : 'changed'}`);

    // 3. everywhere
    await layers('hide', RESEARCH, 'all'); const e1 = await until(hiddenR); await mode('afternoon'); await settle(1500); const e2 = await until(hiddenR, 8000);
    check('hide everywhere: hidden at First bell and at Wave lab', e1.ok && e2.ok, `First bell: ${sayR(e1.value)}; Wave lab: ${sayR(e2.value)}`);
    await mode('morning'); await until(hiddenR, 8000);
    await layers('show', RESEARCH, 'all'); w = await until(shownR);
    check('show everywhere: back', w.ok, sayR(w.value) + took(w));

    // 4. undo / redo
    await layers('hide', RESEARCH, 'cell'); await until(hiddenR);
    await page.evaluate(() => window.ErgoFlex.undoEdit()); const u = await until(v => shownR(v) && asBefore(v));
    await page.evaluate(() => window.ErgoFlex.redoEdit()); const r = await until(v => hiddenR(v) && mine(v).every(([, x]) => !x.shown));
    check('undo shows it, redo hides it again', u.ok && r.ok, `after undo: ${sayR(u.value)}; after redo: ${sayR(r.value)}`);
    check('undo / redo take the desk\'s chair and PC tower with it', asBefore(u.value) && mine(r.value).every(([, x]) => !x.shown),
      `after undo (expected as before): ${sayItems(u.value)}; after redo (expected all hidden): ${mine(r.value).filter(([, x]) => x.shown).map(([k]) => short(k)).join(', ') || 'all hidden'}`);
    await page.evaluate(() => window.__lyE2E.flush()); await settle(1500);
    const stored = (await api()).values?.[LAYERS_KEY] || '';
    check('the hide is in the shared ' + LAYERS_KEY, stored.includes('desk:station-research-desk'), 'no research desk entry on the server');

    // 5. reload: still hidden (the redo above left it hidden for First bell)
    await open(); w = await until(hiddenR, 60000);
    check('after a reload the hide is still there', w.ok, sayR(w.value) + took(w));
    check('no page errors', !errors.length, errors.slice(0, 2).join(' | '));
  } catch (error) {
    check('the run', false, error.message);
  }
  const { lines, code } = formatResult(checks);
  console.log(lines.at(-1));
  return finish(code);
}

module.exports = { serverArgs, pickPort, chromeOptions, formatResult, othersUnchanged, samePlace, pollUntil, installPageHelpers, FORBIDDEN_PORTS };
if (require.main === module) main().then(code => process.exit(code), error => { console.log('FAIL the run: ' + error.message); process.exit(1); });
