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
    const mode = async m => { await page.evaluate(m => window.ErgoFlex.setMeasuredRoomMode('highschool', m), m); await settle(2500); };
    const layers = (fn, id, scope) => page.evaluate((fn, id, scope) => window.ErgoFlex.layers[fn](id, scope), fn, id, scope);
    const serverDesks = async () => (await api()).values?.[DESKS_KEY] ?? null;

    await open();
    check('the page has the Layers test API', await page.evaluate(() => !!window.ErgoFlex.layers?.rows && !!window.ErgoFlex.undoEdit), 'window.ErgoFlex.layers or undoEdit is missing (is Layers switched off?)');
    const noah = await page.evaluate(() => window.__lyE2E.userOf('research-desk')), kai = await page.evaluate(() => window.__lyE2E.userOf(null));
    const b0 = await snap(), desks0 = await serverDesks(), local0 = await page.evaluate(k => localStorage.getItem(k), DESKS_KEY);
    check('the research desk and Noah are shown at First bell before any hide', b0.desks[RESEARCH]?.shown && noah && b0.people[noah]?.shown, `desk shown ${b0.desks[RESEARCH]?.shown}, user ${noah} shown ${b0.people[noah]?.shown}`);
    const rows = await page.evaluate(() => window.ErgoFlex.layers.rows());
    check('the Desks group lists the research desk with its user nested under it', rows.some(r => r.id === RESEARCH && r.group === 'desk') && rows.some(r => r.nestedIn === RESEARCH), 'no desk row or no nested user row for ' + RESEARCH);

    // 1. one eye, this time and size
    await layers('hide', RESEARCH, 'cell'); await settle();
    let s = await snap();
    check('hide (this time & size): the research desk, its screens and objects are invisible', !s.desks[RESEARCH]?.shown && s.desks[RESEARCH]?.meshesShown === 0, `shown ${s.desks[RESEARCH]?.shown}, ${s.desks[RESEARCH]?.meshesShown} of ${s.desks[RESEARCH]?.meshes} meshes still drawn`);
    check('hide: Noah is not shown', !s.people[noah]?.shown, `${noah} still shown`);
    const d1 = othersUnchanged(b0, s, { desks: [RESEARCH], people: [noah] });
    check('hide: the room\'s other desks and people are unchanged', !d1.length, d1.slice(0, 4).join(', '));
    await mode('afternoon'); s = await snap();
    check('Wave lab: the research desk and Noah are back', s.desks[RESEARCH]?.shown && s.people[noah]?.shown, `desk ${s.desks[RESEARCH]?.shown}, ${noah} ${s.people[noah]?.shown}`);
    await mode('morning'); s = await snap();
    check('First bell again: hidden again', !s.desks[RESEARCH]?.shown && !s.people[noah]?.shown, `desk ${s.desks[RESEARCH]?.shown}, ${noah} ${s.people[noah]?.shown}`);
    await layers('show', RESEARCH, 'cell'); await settle(2000); s = await snap();
    check('the eye: the desk and Noah are back, seated, at the same pose', s.desks[RESEARCH]?.shown && s.people[noah]?.shown && s.people[noah]?.desk === 'sit' && samePlace(s.people[noah], b0.people[noah]),
      `desk ${s.desks[RESEARCH]?.shown}, ${noah} shown ${s.people[noah]?.shown} desk ${s.people[noah]?.desk}, moved ${s.people[noah] && b0.people[noah] ? Math.round(Math.hypot(s.people[noah].x - b0.people[noah].x, s.people[noah].z - b0.people[noah].z)) + ' units' : '?'}`);

    // 2. the featured desk (Kai goes with it)
    check('Kai is shown at the featured desk before its hide', kai && b0.people[kai]?.shown, `${kai || 'no featured-desk user'} not shown (the desk is not at a wheelchair height?)`);
    await layers('hide', MAIN, 'cell'); await settle(2500); s = await snap();
    check('hide the featured desk: it is invisible and another desk is featured', !s.desks[MAIN]?.shown && s.selected !== 'main', `main shown ${s.desks[MAIN]?.shown}, selected ${s.selected}`);
    check('hide the featured desk: Kai goes with it', !kai || !s.people[kai]?.shown, `${kai} still shown`);
    await layers('show', MAIN, 'cell'); await settle(2500); s = await snap();
    check('show the featured desk: featured again, Kai back at the same pose', s.selected === 'main' && s.desks[MAIN]?.shown && (!kai || (s.people[kai]?.shown && samePlace(s.people[kai], b0.people[kai]))),
      `selected ${s.selected}, main shown ${s.desks[MAIN]?.shown}, ${kai} shown ${s.people[kai]?.shown}`);

    // 3. everywhere
    await layers('hide', RESEARCH, 'all'); await settle(); const e1 = await snap(); await mode('afternoon'); const e2 = await snap(); await mode('morning');
    check('hide everywhere: hidden at First bell and at Wave lab', !e1.desks[RESEARCH]?.shown && !e2.desks[RESEARCH]?.shown && !e2.people[noah]?.shown, `First bell ${e1.desks[RESEARCH]?.shown}, Wave lab ${e2.desks[RESEARCH]?.shown}`);
    await layers('show', RESEARCH, 'all'); await settle(); s = await snap();
    check('show everywhere: back', s.desks[RESEARCH]?.shown && s.people[noah]?.shown, `desk ${s.desks[RESEARCH]?.shown}, ${noah} ${s.people[noah]?.shown}`);

    // 4. undo / redo
    await layers('hide', RESEARCH, 'cell'); await settle();
    await page.evaluate(() => window.ErgoFlex.undoEdit()); await settle(); const u = await snap();
    await page.evaluate(() => window.ErgoFlex.redoEdit()); await settle(); const r = await snap();
    check('undo shows it, redo hides it again', u.desks[RESEARCH]?.shown && u.people[noah]?.shown && !r.desks[RESEARCH]?.shown && !r.people[noah]?.shown, `after undo ${u.desks[RESEARCH]?.shown}, after redo ${r.desks[RESEARCH]?.shown}`);

    // 5. nothing written to the desks key by hiding
    await page.evaluate(() => window.__lyE2E.flush()); await settle(1500);
    const desks1 = await serverDesks(), local1 = await page.evaluate(k => localStorage.getItem(k), DESKS_KEY);
    check('hiding wrote nothing to ' + DESKS_KEY, desks1 === desks0 && local1 === local0, `server ${desks0 === desks1 ? 'same' : 'changed'}, this browser ${local0 === local1 ? 'same' : 'changed'}`);
    const stored = (await api()).values?.[LAYERS_KEY] || '';
    check('the hide is in the shared ' + LAYERS_KEY, stored.includes('desk:station-research-desk'), 'no research desk entry on the server');

    // 6. reload: still hidden (the redo above left it hidden for First bell)
    await open(); s = await snap();
    check('after a reload the hide is still there', !s.desks[RESEARCH]?.shown && !s.people[noah]?.shown, `desk ${s.desks[RESEARCH]?.shown}, ${noah} ${s.people[noah]?.shown}`);
    check('no page errors', !errors.length, errors.slice(0, 2).join(' | '));
  } catch (error) {
    check('the run', false, error.message);
  }
  const { lines, code } = formatResult(checks);
  console.log(lines.at(-1));
  return finish(code);
}

module.exports = { serverArgs, pickPort, chromeOptions, formatResult, othersUnchanged, samePlace, installPageHelpers, FORBIDDEN_PORTS };
if (require.main === module) main().then(code => process.exit(code), error => { console.log('FAIL the run: ' + error.message); process.exit(1); });
