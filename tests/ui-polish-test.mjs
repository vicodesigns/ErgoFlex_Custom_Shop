// Pure Node verification for ui/store-studio-director-polish (no browser required).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// 1. Director polish stylesheet order & content (desktop guardrail intact, touch 44px untouched).
const expHtml = read('experience/index.html');
const polishIdx = expHtml.indexOf('./director-polish.css');
const phoneIdx = expHtml.indexOf('./director-phone.css');
const shellIdx = expHtml.indexOf('./director-shell.css');
assert.ok(polishIdx > shellIdx && phoneIdx > polishIdx, 'director-polish.css loads after director-shell.css and before director-phone.css');

const polishCss = read('experience/director-polish.css');
assert.match(polishCss, /\.prop-flip button\[aria-pressed=true\]/, 'prop-flip active state moved into director-polish.css');
assert.match(polishCss, /\.inspector-tabs\.inspector-tabs-grouped/, 'grouped inspector tabs styled in director-polish.css');
assert.match(polishCss, /@media \(pointer: fine\)\{[\s\S]*min-height:25px/, 'compact desktop tab height strictly gated on pointer: fine');

// 2. Director grouped inspector tabs & Fold landscape drawer respect.
const dirJs = read('experience/director.mjs');
for (const g of ['story', 'motion', 'stage', 'look']) {
  assert.match(dirJs, new RegExp(`id:'${g}'`), `TAB_GROUPS includes ${g}`);
}
assert.match(dirJs, /inspectorTabsHtml\(/, 'renderPanel uses inspectorTabsHtml');
assert.match(dirJs, /phoneMode\?\.keepDrawerClosed\?\.\(home\[0\]\)/, 'reveal respects explicitly closed Fold landscape drawer');
assert.match(dirJs, /phoneMode\?\.reveal\(tab\)/, 'showInspector forwards active tab to phoneMode.reveal');

const phoneJs = read('experience/director-phone.mjs');
assert.match(phoneJs, /reveal\(tab = ''\)/, 'director-phone reveal accepts tab hint');
assert.match(phoneJs, /store\.drawer !== false \|\| tab === 'title'/, 'landscape drawer only auto-reopens when not collapsed or for title selections');
assert.match(phoneJs, /keepDrawerClosed:/, 'director-phone exposes keepDrawerClosed');

const titleJs = read('experience/title-editor.mjs');
assert.match(titleJs, /ef-phone[\s\S]*scrollIntoView/, 'title-editor scrolls newly added/selected clip into view on Fold');

// 3. Storefront initial price matches catalog basePrice ($4,999, no stale $1,299 flash).
for (const htmlFile of ['index.html', 'product-demo.html']) {
  const html = read(htmlFile);
  assert.doesNotMatch(html, /\$1,299/, `${htmlFile} has no stale $1,299 flash`);
  assert.match(html, /id="total-price">\$4,999</, `${htmlFile} total-price defaults to $4,999`);
  assert.match(html, /id="cart-price">\$4,999</, `${htmlFile} cart-price defaults to $4,999`);
}

// 4. experience/session.js: bare / stays on Custom Shop; ?intro=1 redirects to ./experience/.
const sessionSrc = read('experience/session.js');
{
  let redirectedTo = null;
  const runSession = search => {
    redirectedTo = null;
    const loc = { href: 'http://127.0.0.1:3000/' + search, pathname: '/', search, replace: u => { redirectedTo = String(u); } };
    const ctx = { URL, URLSearchParams, location: loc, document: { documentElement: {} }, console, matchMedia: () => ({ matches: false }) };
    ctx.window = ctx; ctx.parent = ctx;
    vm.runInNewContext(sessionSrc, ctx);
    return redirectedTo;
  };
  assert.equal(runSession(''), null, 'bare / visit does not hijack first-time shopper into /experience/');
  assert.equal(runSession('?view=product'), null, 'store query stays on store');
  const intro = runSession('?intro=1');
  assert.ok(intro && intro.includes('/experience/?return='), '?intro=1 still launches cinematic intro');
}

// 5. Store vs Studio separation in studio-shell.css and studio-shell.mjs.
const shellCss = read('studio-shell.css');
for (const sel of ['#send-to-director', '#layers-open', '#vb-light-menu', '.vb-room-more', '#led-surfaces-advanced', '#save-preset', '#preset-save-status']) {
  assert.ok(shellCss.includes(sel), `studio-shell.css hides ${sel} in Store mode`);
}
const shellJs = read('studio-shell.mjs');
assert.match(shellJs, /STORE_HIDDEN_IDS/, 'studio-shell.mjs excludes Studio-only controls from Store Quick Find');

// 6. Divi static upload bundler resolves full local ES module graph with zero missing imports.
const diviOut = execFileSync('python3', ['divi-editor/build-site-upload.py', '--check'], { cwd: root, encoding: 'utf8' });
assert.match(diviOut, /0 missing/, 'Divi bundle graph check passes with 0 missing local imports');

console.log('ui-polish-test: ok (' + diviOut.trim() + ')');
