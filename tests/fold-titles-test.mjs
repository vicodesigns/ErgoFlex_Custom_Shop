// Touch workflow for the Director on a phone (Galaxy Z Fold 5), source level, no browser:
// the phone-mode rules, the touch CSS, the titles' pointer handlers, Send to desk's wiring, and that the desktop CSS is untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { phoneLayout, nextSheet, dragSheet, fitSheet, PHONE_MAX_WIDTH } from '../experience/director-phone.mjs';
import { appBarHtml, switchButton, cutChapterSheetHtml } from '../experience/director-appbar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const BASE = 'aaf6bb54';   // the commit this work branched from (video/cinematic-intro-hq)

// ---- phone mode: when, and the sheet's steps
assert.equal(phoneLayout({ coarse: true, width: 884, height: 1100 }), 'portrait', 'the Fold, portrait (zoomed)');
assert.equal(phoneLayout({ coarse: true, width: 1100, height: 884 }), 'landscape');
assert.equal(phoneLayout({ coarse: true, width: 697, height: 800 }), 'portrait', 'the Fold as Chrome reports it folded out');
assert.equal(phoneLayout({ coarse: true, width: 837, height: 600 }), 'landscape');
assert.equal(phoneLayout({ coarse: false, width: 884, height: 1100 }), null, 'a mouse: the desktop layout, whatever the size');
assert.equal(phoneLayout({ coarse: true, width: PHONE_MAX_WIDTH + 1, height: 900 }), null, 'a big touch screen keeps the desktop layout');
assert.equal(phoneLayout({ coarse: true, width: 0, height: 0 }), null);
assert.equal(nextSheet('peek', 'tap'), 'half'); assert.equal(nextSheet('half', 'tap'), 'peek'); assert.equal(nextSheet('full', 'tap'), 'half');
assert.equal(nextSheet('peek', 'up'), 'half'); assert.equal(nextSheet('half', 'up'), 'full'); assert.equal(nextSheet('full', 'up'), 'full');
assert.equal(nextSheet('full', 'down'), 'half'); assert.equal(nextSheet('half', 'down'), 'peek'); assert.equal(nextSheet('peek', 'down'), 'peek');
assert.equal(dragSheet('peek', -120), 'half'); assert.equal(dragSheet('half', -120), 'full'); assert.equal(dragSheet('full', 90), 'half'); assert.equal(dragSheet('peek', 5), 'half', 'a small move is a tap');

// ---- director-phone.css: nothing outside @media (pointer: coarse) but the default-hidden new elements
const css = read('experience/director-phone.css').replace(/\/\*[\s\S]*?\*\//g, '');
{
  let depth = 0, media = 0, top = []; let cur = '';
  for (const ch of css) {
    if (ch === '{') { if (depth === 0 && /@media/.test(cur)) { assert.match(cur.trim(), /^@media\s*\(\s*pointer\s*:\s*coarse\s*\)$/, 'the only @media is (pointer: coarse)'); media++; } else if (depth === 0) top.push(cur.trim()); depth++; cur = ''; }
    else if (ch === '}') { depth--; cur = ''; }
    else if (depth === 0) cur += ch;
  }
  assert.equal(media, 1, 'one coarse-pointer block');
  assert.deepEqual(top, ['#ef-sheet-handle,#ef-drawer-tab'], 'outside it, only the new handle and tab, hidden');
  const hidden = css.slice(0, css.indexOf('@media')); assert.match(hidden, /\{display:none\}/);
}
const phoneCss = read('experience/director-phone.css');
// every selector of the phone layout is keyed on body.ef-phone (Part B)
const partB = phoneCss.slice(phoneCss.indexOf('/* ---------- B.'));
for (const rule of partB.split('\n').filter(l => /^[a-z#.]/i.test(l) && l.includes('{'))) assert.match(rule.split('{')[0], /ef-phone/, 'phone rule keyed on ef-phone: ' + rule.slice(0, 80));
// touch basics
assert.match(phoneCss, /#director-appbar \.ab-btn\{height:44px;min-width:44px\}/, 'the bar\'s buttons are 44 px');
assert.match(phoneCss, /\.ab-btn\.ab-icon\{width:44px\}/, 'undo / redo 44 px');
assert.match(phoneCss, /#director-panel button,#director-timeline button[^{]*\{min-height:44px\}/, 'every button 44 px');
assert.match(phoneCss, /font-size:16px;min-height:44px\}/, 'fields 16 px so the page does not zoom');
assert.match(phoneCss, /\.desk-clip,[^{]*\.clip-resize[^{]*\.time-ruler[^{]*\{touch-action:none/, 'blocks, handles and the ruler own their drags');
assert.match(phoneCss, /\.desk-lane,[^{]*\{touch-action:pan-x pan-y pinch-zoom\}/, 'the lanes pan and pinch');
assert.match(phoneCss, /\.title-clip\.selected \.clip-resize\{width:44px/, 'a selected title\'s handles are 44 px wide');
assert.match(phoneCss, /\.time-ruler\{height:44px\}/, 'the scrub ruler is 44 px');
assert.match(phoneCss, /\.desk-clip\{top:6px;height:44px;min-height:44px\}/, 'blocks are 44 px tall');
assert.match(phoneCss, /ef-sheet-peek #director-panel\{display:none\}/);
assert.match(phoneCss, /\.ab-pop\{position:fixed/, 'menus are fixed, so a wrapping bar cannot clip them');
assert.doesNotMatch(phoneCss, /hover\s*:\s*hover|:hover\{[^}]*display/, 'nothing needs a hover');
const html = read('experience/index.html');
assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale/, 'pinch-zoom of the page is not blocked');
assert.match(html, /interactive-widget=resizes-content/, 'the keyboard resizes the layout, so the sheet stays above it');
assert.match(html, /<link rel="stylesheet" href="\.\/director-phone\.css">/); assert.ok(html.indexOf('director-phone.css') > html.indexOf('director-shell.css'), 'loaded last');
assert.match(html, /id="demo-close"/);

// ---- the desktop CSS is untouched: the three existing files only gain lines (the demo card's close button), none removed
try {
  execFileSync('git', ['cat-file', '-e', BASE + '^{commit}'], { cwd: root, stdio: 'ignore' });
  for (const f of ['experience/director.css', 'experience/director-theme.css', 'experience/director-shell.css', 'experience/experience.css']) {
    const [added, removed] = execFileSync('git', ['diff', '--numstat', BASE, '--', f], { cwd: root, encoding: 'utf8' }).trim().split('\t').map(Number);
    assert.ok(!(removed > 0), `${f}: no existing line changed (${removed} removed)`);
    if (added) { const now = read(f), was = execFileSync('git', ['show', BASE + ':' + f], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }); assert.ok(now.startsWith(was.replace(/\n$/, '')), f + ': only appended'); assert.match(now.slice(was.length), /demo/i, f + ': what was appended is the demo card'); }
  }
} catch (e) { if (e.name === 'AssertionError') throw e; console.log('(no base commit ' + BASE + ' here: desktop CSS diff not checked)'); }

// ---- the app bar's phone variant
const phone = appBarHtml({ picker: '<div data-film-picker></div>', name: 'Cut', undo: { n: 1, label: 'x' }, redo: { n: 0 }, film: true, phone: true, lowres: false, sound: false, demoCard: false, inspector: true, titles: true, chapters: false, timeline: true, history: [], overlays: { guides: false } });
for (const a of ['undo', 'redo', 'save-export', 'send-desk', 'inspector']) assert.ok(phone.includes(`data-action="${a}"`), a + ' on the phone bar');
assert.match(phone, />Send to desk</); assert.match(phone, />Export cut</);
assert.doesNotMatch(phone, /ab-brand|ab-play|Overlays ▾/, 'the phone bar drops the brand, Play and Overlays (they move to ⋯ or the timeline)');
for (const id of ['sound', 'preview-quality', 'director']) assert.match(phone, new RegExp(`data-ab-proxy="${id}"`), id + ' in ⋯');
assert.match(phone, /data-action="demo-card"/); assert.match(phone, /data-action="hold-camera"/);
const desk = appBarHtml({ name: 'Cut', film: true, lowres: false });
assert.match(desk, /ab-brand/); assert.match(desk, /ab-play/); assert.match(desk, /data-action="send-desk"/, 'Send to desk beside Export cut on the desktop too'); assert.doesNotMatch(desk, /ab-panel|demo-card/, 'the desktop bar has no Panel button');
assert.doesNotMatch(appBarHtml({ name: 'Cut', film: false, phone: true }), /send-desk/, 'only a film chapter can be sent');

// ---- director.mjs: Send to desk reuses the Export cut serialisation
const dir = read('experience/director.mjs');
assert.equal((dir.match(/JSON\.stringify\(\(\(c\)=>\(\{\.\.\.c,shots:c\.shots\.map/g) || []).length, 1, 'the cut is serialised in one place');
assert.match(dir, /const exportText=\(\)=>/); assert.match(dir, /function exportCut\(\)\{const text=exportText\(\)/); assert.match(dir, /async function sendToDesk\(\)\{[\s\S]*?const text=exportText\(\)/);
assert.match(dir, /fetch\('\/__director\/inbox'/); assert.match(dir, /'x-director-inbox':'1'/); assert.match(dir, /Sent to the desk/);
assert.match(dir, /name==='send-desk'\)\{[^\n]*await sendToDesk\(\)/); assert.match(dir, /\|\|name==='send-desk'\)&&index!=='stale-ok'/, 'the stale-chapter guard covers it');
assert.match(dir, /createPhoneMode\(\{appbar,panel/); assert.match(dir, /name==='demo-card'/);

// ---- titles by touch: pointer events with capture, a finger's threshold, nudge buttons
const te = read('experience/title-editor.mjs');
assert.match(te, /timeline\.addEventListener\('pointerdown'[\s\S]*?setPointerCapture\(event\.pointerId\)/);
assert.match(te, /event\.pointerType==='touch'\?8:3/);
assert.match(te, /timeline\.addEventListener\('pointerup',endDrag\);timeline\.addEventListener\('pointercancel',endDrag\)/);
assert.match(te, /data-title-action="nudge"/); assert.match(te, /matchMedia\('\(pointer: coarse\)'\)/);
assert.match(te, /data-title-action="add"/); assert.match(te, /data-title-action="delete"/); assert.match(te, /data-title-add/);
// the timeline marquee must not eat a title block (new draggable widgets are buttons: .title-clip is one)
assert.match(te, /<button class="desk-clip title-clip/);

// ---- phone mode never touches the desktop path
const pm = read('experience/director-phone.mjs');
assert.match(pm, /matchMedia\('\(pointer: coarse\)'\)/); assert.match(pm, /phoneLayout\(\{ coarse: coarse\.matches/);
assert.match(pm, /PHONE_KEY = 'ergoflex\.director\.phone\.v1'/); assert.match(pm, /localStorage\.setItem\(PHONE_KEY/);
// ---- Send to desk carries the desk code: asked once, kept per device under a key the studio sync never shares (it shares
// only keys starting 'ergoflex': tools/studio-state/merge.mjs SHARED_KEY), forgotten when the desk says it is wrong
{const dm = read('experience/director.mjs');
 assert.match(dm, /const CODE_KEY='directorInboxCode';/); assert.ok(!/^ergoflex/.test('directorInboxCode'), 'not a shared studio key');
 assert.match(dm, /'x-director-token':code/, 'sent in a header'); assert.match(dm, /if\(response\.status===401\)\{try\{localStorage\.removeItem\(CODE_KEY\);\}catch\{\}/, 'a wrong code is forgotten');
 assert.match(read('tools/director-inbox.mjs'), /if \(!sameToken\(String\(req\.headers\['x-director-token'\] \|\| ''\), want\)\) return refuse\(401/, 'the server checks it (constant time)');}
// ---- Windows on 4b828a6f: Titles unfolded on a phone until the user folds it; the portrait timeline fits its lanes
assert.match(read('experience/director.mjs'), /if\(g==='titles'&&laneGroups\.titles===undefined&&document\.body\.classList\.contains\('ef-phone'\)\)return false;return isFolded\(laneGroups,g\);/);
{const pm2 = read('experience/director-phone.mjs');
 assert.match(pm2, /content\.scrollHeight/, 'measured on the lanes\' content, not the scrolling viewport (no feedback)');
 assert.match(pm2, /setVar\('--ef-tl-h', fit\.h \+ 'px'\)/);
 assert.ok(pm2.indexOf('wasOpen = isOpen;') < pm2.indexOf('if (!m)'), 'desktop (!m) updates wasOpen before returning so MutationObserver never loops');}

// ---- ui/fold-pickers: phone Cut & Chapter switch button + modal sheet + fitSheet hysteresis
{
  const bar = appBarHtml({ picker: '<div data-film-picker><select></select></div>', name: 'Cut', undo: { n: 0 }, redo: { n: 0 }, film: true, phone: true, cutChapter: { label: 'Vicos 3rd cut · 2 · rise (18 s)', dirty: true, choice: false }, lowres: false, sound: false, demoCard: false, inspector: true, titles: true, chapters: false, timeline: true, history: [], overlays: { guides: false } });
  assert.match(bar, /data-action="cc-open"/, 'phone bar renders the Cut & Chapter switch button');
  assert.match(bar, /Vicos 3rd cut · 2 · rise \(18 s\)/);
  assert.doesNotMatch(bar, /<select/, 'no native select inside the phone bar when cutChapter is active');
  const sheet = cutChapterSheetHtml({ cuts: [{ id: 'c2', name: 'Vicos 2nd cut' }, { id: 'c3', name: 'Vicos 3rd cut' }], mine: 'c3', chapters: [{ n: 0, label: '1 · awaken' }, { n: 1, label: '2 · rise' }], index: 1, error: '', notice: '', canDuplicate: true });
  assert.match(sheet, /data-cc-cut="c3" aria-current="true"/, 'active cut marked');
  assert.match(sheet, /data-cc-chapter="1" aria-current="true"/, 'active chapter marked');
  assert.match(sheet, /data-cc-cut="__new"/, 'duplicate cut action offered');
  assert.match(sheet, /data-cc-step="-1"/); assert.match(sheet, /data-cc-step="1" disabled/, 'next disabled on last chapter');
  assert.match(switchButton({ label: 'Cut', dirty: false, choice: true }), /needs-choice/);
  const f1 = fitSheet({ need: 210, avail: 420 }), f2 = fitSheet({ need: 210, avail: 420, prev: f1 });
  assert.deepEqual(f2, f1, 'fitSheet is idempotent');
  const fJitter = fitSheet({ need: 215, avail: 420, prev: f1 });
  assert.equal(fJitter.h, f1.h, 'fitSheet ignores small content jitter within slack');
  const rIn = fitSheet({ need: 200, avail: 400 }), rStay = fitSheet({ need: 260, avail: 400, prev: rIn }), rOut = fitSheet({ need: 310, avail: 400, prev: rStay });
  assert.equal(rIn.roomy, true); assert.equal(rStay.roomy, true, 'hysteresis keeps roomy until below roomyOut'); assert.equal(rOut.roomy, false);
  assert.match(phoneCss, /body\.directing\.ef-phone #director-appbar \.ab-switch\{/, 'switch button styled on phone');
  assert.match(phoneCss, /body\.directing\.ef-phone #ef-cc-sheet\{/, 'Cut & Chapter modal sheet styled on phone');
}

// ---- Windows run on e15d69ec (fold-fixes-3)
assert.doesNotMatch(phone.replace(/<div class="ab-pop"[\s\S]*?<\/div>/g, ''), /data-action="keys-panel"|>Close</, 'no ⌨ and no Close button in the phone bar (Close is in ⋯)');
assert.match(desk, /data-action="keys-panel"/, 'the desktop bar keeps them');
assert.match(dir, /function reveal\(type\)\{\s*const home=homeOf\(type\);if\(!home\|\|typing\(\)\)return false;\s*phoneMode\?\.reveal\(\)/, 'every selection\'s reveal() raises the sheet / opens the drawer');
assert.match(dir, /status\(`Sent to the desk: \$\{n\} chapter\$\{n===1\?'':'s'\}, \$\{Math\.round\(duration\(project\.shots\)\)\} s/, 'Send to desk: singular, set after the panel redraw');
assert.match(dir, /const sent=await sendToDesk\(\);renderPanel\(\);const n=/, 'the status is set after renderPanel (renderPanel resets it)');
assert.match(te, /stopped at '\+stop/, 'a drag stopped by the chapter\'s ends or the minimum says so');
assert.match(phoneCss, /\.inspector-tabs:has\(\[data-inspector-tab\]\) button\{min-height:44px\}/, 'the inspector tabs are 44 px (the theme\'s :has() rule pinned 28)');
assert.match(phoneCss, /\.title-clip\.selected \.clip-resize\{width:46px\}/); assert.match(phoneCss, /\.title-clip\{top:4px;height:48px;min-height:48px\}/, 'trim handles at least 46 px');
assert.match(phoneCss, /\.film-fresh:not\(:has\(\.film-fresh-choice\)\)\{display:none\}/, 'the export note does not wrap in the bar');
assert.match(phoneCss, /#demo\{top:calc\(var\(--ef-top\) \+ 10px\);right:calc\(var\(--ef-reserve\) \+ 64px\)/, 'the demo card clears the drawer\'s tab');
assert.match(phoneCss, /#ef-drawer-tab\{top:calc\(var\(--ef-top\) \+ \(100dvh/, 'the tab sits mid-edge');
assert.match(phoneCss, /@media \(max-height:700px\)\{[\s\S]*film-prev/, 'short landscape: pickers share the bar row');
// no Director handler takes two-finger touches or locks the page's zoom
for (const f of fs.readdirSync(path.join(root, 'experience')).filter(f => f.endsWith('.mjs'))) assert.doesNotMatch(read('experience/' + f), /addEventListener\(\s*['"](touchstart|touchmove|gesturestart|gesturechange)['"]/, f + ': no touch / gesture listener');
assert.doesNotMatch(read('experience/experience.css') + read('experience/director-shell.css'), /(html|body)\s*\{[^}]*touch-action/, 'no touch-action on html / body');
console.log('fold-titles-test: ok');
