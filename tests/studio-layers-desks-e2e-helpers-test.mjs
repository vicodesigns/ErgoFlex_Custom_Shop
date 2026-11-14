// The pure helpers of tests/studio-layers-desks-e2e.cjs, without a browser or a server:
//   node tests/studio-layers-desks-e2e-helpers-test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import net from 'node:net';
const require = createRequire(import.meta.url);
const E = require('./studio-layers-desks-e2e.cjs');
const repo = path.resolve(path.dirname(require.resolve('./studio-layers-desks-e2e.cjs')), '..');

// server args: its own port and a scratch state file, never :3000, never the committed state, no file watching
const args = E.serverArgs({ port: 41234, stateFile: path.join('/tmp', 'x', 'studio-state.json') });
assert.deepEqual(args.slice(1), ['--port', '41234', '--host', '127.0.0.1', '--state', path.join('/tmp', 'x', 'studio-state.json'), '--no-watch']);
assert.equal(args[0], path.join(repo, 'tools', 'studio-server.mjs'));
assert.throws(() => E.serverArgs({ port: 3000, stateFile: '/tmp/a.json' }), /refusing port 3000/);
assert.throws(() => E.serverArgs({ port: 0, stateFile: '/tmp/a.json' }));
assert.throws(() => E.serverArgs({ port: 41234, stateFile: path.join(repo, 'studio-state.json') }), /committed/);
assert.throws(() => E.serverArgs({ port: 41234 }));

// a free port (binds and releases one on 127.0.0.1; no server is started)
const port = await E.pickPort();
assert.ok(Number.isInteger(port) && port > 0 && port !== 3000);
await new Promise((ok, fail) => { const s = net.createServer(); s.once('error', fail); s.listen(port, '127.0.0.1', () => s.close(ok)); });
// a fake net that only ever offers 3000: refused, never returned
const fake3000 = { createServer: () => { const h = {}; return { once: (e, f) => { h[e] = f; }, listen: (p, host, cb) => cb(), address: () => ({ port: 3000 }), close: cb => cb() }; } };
await assert.rejects(E.pickPort(fake3000, 2), /no free port/);

// launch options: Linux = the desk's GPU Chrome and flags (room-stills.cjs); Windows = the default
const linux = E.chromeOptions({ platform: 'linux', exists: p => p === '/usr/bin/google-chrome' });
assert.equal(linux.executablePath, '/usr/bin/google-chrome');
for (const f of ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan']) assert.ok(linux.args.includes(f), f);
assert.equal(E.chromeOptions({ platform: 'linux', exists: () => false }).executablePath, undefined, 'no system Chrome: puppeteer\'s own');
const win = E.chromeOptions({ platform: 'win32', exists: () => true });
assert.equal(win.executablePath, undefined); assert.ok(!win.args.includes('--no-sandbox') && !win.args.some(a => a.startsWith('--use-angle')));
assert.equal(win.headless, 'new');

// result lines: one per check, a reason on each failure, exit code
const ok = E.formatResult([{ name: 'a', ok: true }, { name: 'b', ok: true }]);
assert.deepEqual(ok, { lines: ['PASS a', 'PASS b', 'all 2 checks passed'], code: 0 });
const bad = E.formatResult([{ name: 'hide: Noah is not shown', ok: false, reason: 'people-noah-sit-type\n still shown' }, { name: 'x', ok: false }]);
assert.deepEqual(bad.lines, ['FAIL hide: Noah is not shown: people-noah-sit-type still shown', 'FAIL x: no reason given', '2 of 2 checks failed']); assert.equal(bad.code, 1);
assert.equal(E.formatResult([]).code, 1, 'no checks ran: a failure');

// snapshot comparison and same place
const before = { desks: { 'desk:a': { shown: true }, 'desk:b': { shown: true } }, people: { noah: { shown: true }, zoe: { shown: true } } };
assert.deepEqual(E.othersUnchanged(before, { desks: { 'desk:a': { shown: false }, 'desk:b': { shown: true } }, people: { noah: { shown: false }, zoe: { shown: true } } }, { desks: ['desk:a'], people: ['noah'] }), []);
assert.deepEqual(E.othersUnchanged(before, { desks: { 'desk:a': { shown: true }, 'desk:b': { shown: false } }, people: { noah: { shown: true } } }), ['desk:b disappeared', 'zoe disappeared']);
assert.ok(E.samePlace({ x: 1, z: 2, yaw: 3.14 }, { x: 4, z: 2, yaw: -3.14 + 2 * Math.PI - 2 * Math.PI + 6.28 }));
assert.ok(!E.samePlace({ x: 0, z: 0, yaw: 0 }, { x: 10, z: 0, yaw: 0 })); assert.ok(!E.samePlace(null, { x: 0, z: 0, yaw: 0 }));
assert.equal(typeof E.installPageHelpers, 'function'); assert.ok(E.FORBIDDEN_PORTS.has(3000));
console.log('Layers desks e2e helpers: server args, free port, launch options, result lines, comparisons: pass.');
