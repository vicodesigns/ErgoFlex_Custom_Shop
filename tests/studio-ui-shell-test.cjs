// The Studio UI shell (studio-shell.mjs) only moves controls; it must not lose one, break one, or show up where it
// should not. Loads the Studio in a real browser and checks:
//   1. every element id, named form control and data-* hook recorded before the shell (fixtures/studio-ui-ids.json)
//      still exists exactly once;
//   2. controls inside a closed menu or group still answer .value / change / .click();
//   3. menus and groups open and close with aria-expanded, one menu at a time, Escape closes, and the canvas does not
//      resize when a menu opens; groups, the advanced LED block and the hidden panel are remembered across a reload;
//   4. quick find reveals a control wherever it is;
//   5. a phone has no horizontal overflow, 40 px targets, a usable 3D view, and menus as bottom sheets;
//   6. the Store keeps its single-tab panel, and the presentation frame and product-demo.html get no shell at all.
// Run: node tests/studio-ui-shell-test.cjs   (uses the GPU Chrome when present: wrap in the stills lock on a shared box)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/studio-ui-ids.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(root, name === '/' ? 'index.html' : name);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
const PREF_KEY = 'ergoflex.ui.shell.v1';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const system = fs.existsSync('/usr/bin/google-chrome');
    const browser = await puppeteer.launch(system
        ? { executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] }
        : { headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const errors = [];
    const open = async (url, viewport = { width: 1440, height: 900 }) => {
        const page = await browser.newPage();
        page.on('pageerror', error => errors.push(`${url}: ${error.message}`));
        await page.setViewport(viewport);
        await page.goto(base + url, { waitUntil: 'domcontentloaded' });
        return page;
    };
    const ready = async page => {
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs?.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 180000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; });
        await wait(600);
    };
    const canvasBox = page => page.$eval('#model-canvas', el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
    try {
        // ------------------------------------------------------------ Studio, desktop
        let page = await open('/?setup&room=home&layout=house');
        await ready(page);
        assert.equal(await page.evaluate(() => window.ErgoStudioShell?.mounted === true && document.documentElement.classList.contains('ui-shell')), true, 'the shell mounts in the Studio');

        // 1. Nothing lost.
        const inventory = await page.evaluate(expected => {
            const all = [...document.querySelectorAll('[id]')].map(el => el.id);
            return {
                missing: expected.ids.filter(id => !all.includes(id)),
                repeated: [...new Set(all.filter((id, index) => all.indexOf(id) !== index))],
                named: expected.named.filter(pair => { const [name, value] = pair.split('='); return document.querySelectorAll(`input[name="${name}"][value="${value}"]`).length !== 1; }),
                data: Object.entries(expected.data).filter(([name, count]) => document.querySelectorAll(`[${name}]`).length !== count).map(([name, count]) => `${name}: ${document.querySelectorAll(`[${name}]`).length} (was ${count})`)
            };
        }, fixture);
        assert.deepEqual(inventory.missing, [], 'every id from before the shell still exists');
        assert.deepEqual(inventory.repeated, [], 'and no id occurs twice');
        assert.deepEqual(inventory.named, [], 'every named radio is still there once');
        assert.deepEqual(inventory.data, [], 'every data-* hook is still there, the same number of times');
        console.log(`Inventory: ${fixture.ids.length} ids, ${fixture.named.length} named controls, ${Object.keys(fixture.data).length} data hooks intact.`);

        // The 3D view is the hero: on the base this canvas was 160 px tall here.
        const hero = await page.evaluate(() => ({ canvas: document.querySelector('#model-canvas').getBoundingClientRect().height, shell: document.querySelector('#viewer-shell').getBoundingClientRect().height }));
        assert.ok(hero.canvas >= hero.shell * .6, `the canvas takes most of the viewer (${hero.canvas} of ${hero.shell})`);

        // 2. Closed menus and groups: every control still answers a script.
        const closed = await page.evaluate(async () => {
            const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
            const out = { hiddenFirst: {} };
            for (const id of ['camera-view', 'rotate-scene', 'grid-toggle', 'studio-exposure', 'room-ceiling-toggle', 'assign-lift', 'led-floor-reach', 'project-save'])
                out.hiddenFirst[id] = visible(document.getElementById(id));
            document.getElementById('rotate-scene').click();
            out.orbit = document.getElementById('rotate-scene').getAttribute('aria-pressed');
            document.getElementById('rotate-scene').click();
            document.getElementById('grid-toggle').click();
            out.grid = document.getElementById('grid-toggle').getAttribute('aria-pressed');
            document.getElementById('grid-toggle').click();
            const camera = ErgoFlex.sceneDesks.ctx.camera, before = camera.position.clone();
            const view = document.getElementById('camera-view'); view.value = 'top'; view.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 1200));
            out.cameraMoved = camera.position.distanceTo(before) > .5;
            view.value = 'hero'; view.dispatchEvent(new Event('change', { bubbles: true }));
            const exposure = document.getElementById('studio-exposure'); exposure.value = '1.3'; exposure.dispatchEvent(new Event('input', { bubbles: true }));
            out.exposure = ErgoFlex.renderer.toneMappingExposure;
            out.exposureLabel = document.getElementById('studio-exposure-value').textContent;
            document.getElementById('reset-scene-light').click();
            const slider = document.getElementById('led-floor-reach'), original = slider.value;
            slider.value = '31'; slider.dispatchEvent(new Event('input', { bubbles: true }));
            out.ledSurface = ErgoFlex.ledSurfaces.floorReach;
            slider.value = original; slider.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('assign-lift').click();
            out.toast = document.getElementById('studio-toast').textContent;
            out.grooveInPanel = !!document.querySelector('#home-office-controls [data-groove-save]') && !!document.querySelector('#home-office-controls [data-home-description]')?.textContent;
            out.startVisible = visible(document.querySelector('#home-office-controls [data-groove-start]'));
            out.essentials = ['room-scene-select', 'home-room-size', 'room-rearrange-toggle'].every(id => visible(document.getElementById(id)))
                && visible(document.querySelector('[data-home-mode="evening"]')) && visible(document.querySelector('[data-home-size="60x30"]'));
            return out;
        });
        assert.deepEqual(Object.values(closed.hiddenFirst), Array(8).fill(false), 'these controls start inside closed menus, groups or the advanced block');
        assert.equal(closed.orbit, 'true', 'Orbit works from inside the closed Camera menu');
        assert.equal(closed.grid, 'true', 'Grid works from inside the closed Camera menu');
        assert.ok(closed.cameraMoved, 'setting #camera-view and dispatching change moves the camera');
        assert.ok(Math.abs(closed.exposure - 1.3) < .2 && closed.exposureLabel.startsWith('1.3'), `the exposure slider works inside the closed Light menu (${closed.exposure}, ${closed.exposureLabel})`);
        assert.equal(closed.ledSurface, 31, 'a light-on-surfaces slider works inside the closed advanced block');
        assert.match(closed.toast, /Select unrigged parts first|parts assigned/, 'a button in a closed Editor group still runs');
        assert.ok(closed.grooveInPanel, 'Groove tools and the description stay inside their room panel');
        assert.ok(closed.startVisible && closed.essentials, 'scene, room size, desk size, time of day, Start Groove and the rearrange toggle are always visible');
        console.log('Closed menus and groups answer scripts.');

        // 3. Menus.
        const before = await canvasBox(page);
        await page.click('#vb-camera-menu > summary');
        await page.waitForFunction(() => document.getElementById('vb-camera-menu').open);
        const camera = await page.evaluate(() => {
            const menu = document.getElementById('vb-camera-menu'), summary = menu.querySelector('summary'), pop = document.getElementById(summary.getAttribute('aria-controls'));
            const r = pop.getBoundingClientRect(), shell = document.getElementById('viewer-shell').getBoundingClientRect();
            return { expanded: summary.getAttribute('aria-expanded'), inside: r.left >= shell.left && r.right <= shell.right && r.bottom <= shell.bottom && r.height > 60,
                select: document.getElementById('camera-view').getBoundingClientRect().height > 0 };
        });
        assert.deepEqual(camera, { expanded: 'true', inside: true, select: true }, 'the Camera menu opens inside the viewer with aria-expanded');
        assert.deepEqual(await canvasBox(page), before, 'opening a menu does not move or resize the canvas');
        await page.click('#vb-light-menu > summary, .render-settings:not(.scene-screen-controls) > summary');
        assert.deepEqual(await page.evaluate(() => [document.getElementById('vb-camera-menu').open, document.getElementById('studio-exposure').closest('details').open,
            document.querySelector('#vb-camera-menu > summary').getAttribute('aria-expanded')]), [false, true, 'false'], 'one menu at a time');
        await page.keyboard.press('Escape');
        assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('#scene-controls details.vb-menu[open]').length, document.activeElement?.tagName]), [0, 'SUMMARY'], 'Escape closes the menu and returns focus to its button');
        const disclosures = await page.evaluate(() => [...document.querySelectorAll('#scene-controls details.vb-menu > summary, #setup-sidebar .ui-group-head, #led-surfaces-advanced > summary')]
            .filter(el => !el.hasAttribute('aria-expanded') || !document.getElementById(el.getAttribute('aria-controls'))).length);
        assert.equal(disclosures, 0, 'every disclosure has aria-expanded and a valid aria-controls');

        // Groups remember their state.
        const groupState = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#setup-sidebar .ui-group')].map(group =>
            [group.dataset.uiGroup, group.querySelector('.ui-group-head').getAttribute('aria-expanded') === 'true' && !group.querySelector('.ui-group-body').hidden])));
        const initial = await groupState();
        assert.deepEqual(initial, { 'editor.transform': true, 'editor.library': true, 'editor.selection': true, 'editor.groups': false, 'editor.lift': false, 'editor.rigs': false, 'editor.tree': true, 'editor.project': false },
            'working groups start open, expert groups start closed');
        await page.click('[data-ui-group="editor.groups"] > .ui-group-head');
        await page.click('[data-ui-group="editor.library"] > .ui-group-head');
        await page.evaluate(() => { document.getElementById('led-surfaces-advanced').open = true; });
        await page.click('#ui-panel-toggle');
        await wait(400);
        const hiddenPanel = await page.evaluate(() => ({ expanded: document.getElementById('ui-panel-toggle').getAttribute('aria-expanded'), label: document.getElementById('ui-panel-toggle').textContent,
            left: document.getElementById('viewer-shell').getBoundingClientRect().left }));
        assert.deepEqual([hiddenPanel.expanded, hiddenPanel.label], ['false', 'Show panel']);
        assert.ok(hiddenPanel.left < 10, 'hiding the panel gives the 3D view the whole width');
        assert.ok((await canvasBox(page)).w > before.w + 250, 'and the canvas follows');
        const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PREF_KEY);
        assert.deepEqual([stored.v, stored.groups['editor.groups'], stored.groups['editor.library'], stored.more.ledSurfaces, stored.sidebarHidden], [1, true, false, true, true], 'preferences are stored under ergoflex.ui.shell.v1');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        const after = await groupState();
        assert.deepEqual([after['editor.groups'], after['editor.library'], after['editor.transform']], [true, false, true], 'groups keep their state across a reload');
        assert.equal(await page.$eval('#led-surfaces-advanced', el => el.open), true, 'so does the advanced LED block');
        assert.equal(await page.evaluate(() => document.body.classList.contains('ui-sidebar-hidden') && document.getElementById('ui-panel-toggle').getAttribute('aria-expanded') === 'false'), true, 'and the hidden panel');

        // 4. Quick find: a control in a closed group of a hidden panel, then one in a closed menu.
        await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
        await page.waitForSelector('#ui-find:not([hidden])');
        await page.keyboard.type('save actuator');
        assert.match(await page.$eval('#ui-find-list [aria-selected=true]', el => el.textContent), /Save Actuator Rig/);
        await page.keyboard.press('Enter');
        await wait(500);
        const found = await page.evaluate(() => { const el = document.getElementById('save-rig-btn'), r = el.getBoundingClientRect(), side = document.getElementById('setup-sidebar').getBoundingClientRect();
            return { focused: document.activeElement === el, shown: r.height > 0 && r.top >= side.top && r.bottom <= side.bottom, panel: !document.body.classList.contains('ui-sidebar-hidden'), find: document.getElementById('ui-find').hidden }; });
        assert.deepEqual(found, { focused: true, shown: true, panel: true, find: true }, 'find shows the panel, opens the group, scrolls to the control and focuses it');
        await page.keyboard.press('/');
        await page.waitForSelector('#ui-find:not([hidden])');
        await page.keyboard.type('exposure');
        await page.keyboard.press('Enter');
        await wait(400);
        assert.equal(await page.evaluate(() => document.activeElement?.id === 'studio-exposure' && document.getElementById('studio-exposure').closest('details').open), true, 'find opens the Light menu on the exposure slider');
        await page.keyboard.press('Escape');
        await page.evaluate(key => localStorage.removeItem(key), PREF_KEY);
        await page.close();
        console.log('Menus, groups, memory and quick find pass.');

        // ------------------------------------------------------------ Store, desktop
        page = await open('/?room=home&layout=house');
        await ready(page);
        const store = await page.evaluate(() => ({
            shell: window.ErgoStudioShell.mounted, parent: document.getElementById('config-column').parentElement.id, tab: document.getElementById('config-column').dataset.shellTab,
            tabsHidden: getComputedStyle(document.querySelector('.studio-tabs')).display === 'none', editorHidden: document.getElementById('anim-debugger').getBoundingClientRect().height === 0,
            canvas: document.querySelector('#model-canvas').getBoundingClientRect().height, viewer: document.querySelector('#viewer-shell').getBoundingClientRect().height,
            findsEditor: window.ErgoStudioShell.findIndex().some(item => /Actuator Rig/.test(item.label)), findsCamera: window.ErgoStudioShell.findIndex().some(item => item.id === 'camera-view')
        }));
        assert.deepEqual([store.shell, store.parent, store.tab, store.tabsHidden, store.editorHidden], [true, 'setup-sidebar', 'build', true, true], 'the Store keeps its single-tab panel');
        assert.ok(store.canvas >= store.viewer * .6, 'and gets the same large 3D view');
        assert.deepEqual([store.findsEditor, store.findsCamera], [false, true], 'find lists only what the Store offers');
        await page.click('#ui-panel-toggle');
        await wait(400);
        assert.equal(await page.evaluate(() => document.body.classList.contains('sidebar-collapsed') && document.getElementById('config-collapse').getAttribute('aria-expanded') === 'false'), true, "in the Store the panel button drives the Store's own collapse");
        await page.click('#ui-panel-toggle');
        await page.close();

        // ------------------------------------------------------------ phone
        page = await browser.newPage();
        page.on('pageerror', error => errors.push(`phone: ${error.message}`));
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await page.goto(base + '/?setup&room=home&layout=house', { waitUntil: 'domcontentloaded' });
        await ready(page);
        const phone = await page.evaluate(() => {
            const box = el => el.getBoundingClientRect(), bar = box(document.getElementById('scene-controls')), canvas = box(document.getElementById('model-canvas')), viewer = box(document.getElementById('viewer-shell'));
            const small = [...document.querySelectorAll('#scene-controls .vb-row > button, #scene-controls .vb-end > button, #scene-controls .vb-row > label, #scene-controls .vb-menu > summary, #scene-controls .measured-room-controls button, #scene-controls select')]
                .filter(el => box(el).height > 0 && box(el).height < 40).map(el => el.id || el.textContent.trim().slice(0, 20));
            return { overflow: document.documentElement.scrollWidth - innerWidth, barInside: bar.left >= 0 && bar.right <= innerWidth, barHeight: bar.height, canvasTop: canvas.top - viewer.top, canvasHeight: canvas.height, small };
        });
        assert.equal(phone.overflow, 0, 'no horizontal overflow on a phone');
        assert.ok(phone.barInside && phone.barHeight < 130, `the bar is two scrolling rows inside the screen (${phone.barHeight})`);
        assert.ok(phone.canvasTop < 260 && phone.canvasHeight >= 420, `the 3D view starts near the top of the viewer and is usable (${phone.canvasTop}, ${phone.canvasHeight})`);
        assert.deepEqual(phone.small, [], 'bar targets are at least 40 px on touch');
        await page.evaluate(() => document.getElementById('viewer-shell').scrollIntoView({ block: 'start' }));
        await page.tap('#vb-camera-menu > summary');
        await page.waitForFunction(() => document.getElementById('vb-camera-menu').open);
        const sheet = await page.evaluate(() => { const r = document.querySelector('#vb-camera-menu > .vb-pop').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), height: r.height, vw: innerWidth, vh: innerHeight }; });
        assert.deepEqual([sheet.left, sheet.right, sheet.bottom], [0, sheet.vw, sheet.vh], 'a menu is a bottom sheet on a phone');
        assert.ok(sheet.height <= sheet.vh * .63, 'that leaves the 3D view in sight');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'and still no overflow');
        await page.tap('#vb-camera-menu .vb-pop-close');
        assert.equal(await page.$eval('#vb-camera-menu', el => el.open), false, 'the sheet has its own close button');
        await page.close();
        console.log('Phone layout passes.');

        // ------------------------------------------------------------ special modes: no shell at all
        page = await open('/product-demo.html');
        await ready(page);
        const demo = await page.evaluate(() => ({ shell: typeof window.ErgoStudioShell, scoped: document.documentElement.classList.contains('ui-shell'),
            added: document.querySelectorAll('.vb, .vb-menu, .ui-group, .ui-more, #ui-find, #ui-panel-toggle, #ui-find-open').length, css: [...document.styleSheets].some(s => /studio-shell/.test(s.href || '')) }));
        assert.deepEqual(demo, { shell: 'undefined', scoped: false, added: 0, css: false }, 'product-demo.html loads no shell code, markup or styles');
        await page.close();

        page = await open('/package.json', { width: 1280, height: 720 });
        await page.evaluate(() => { document.documentElement.innerHTML = '<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?room=home&view=room&layout=house&presentation=1&tour=1"></iframe></body>'; });
        const frame = await (await page.waitForSelector('#s')).contentFrame();
        await frame.waitForFunction('window.ErgoPresentation&&window.ErgoFlex', { timeout: 180000 });
        await wait(1500);
        const presentation = await frame.evaluate(() => { const r = document.getElementById('model-canvas').getBoundingClientRect();
            return { mounted: window.ErgoStudioShell?.mounted === true, scoped: document.documentElement.classList.contains('ui-shell'),
                added: document.querySelectorAll('.vb, .vb-menu, .ui-group, .ui-more, #ui-find, #ui-panel-toggle, #ui-find-open').length,
                canvas: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], toolbarInBar: document.querySelector('.studio-toolbar')?.parentElement?.id };
        });
        assert.deepEqual(presentation, { mounted: false, scoped: false, added: 0, canvas: [0, 0, 1280, 720], toolbarInBar: 'scene-controls' }, 'the presentation frame is exactly what studio.js built, canvas edge to edge');
        await page.close();
        console.log('Presentation frame and event demo have no shell.');

        assert.deepEqual(errors, [], 'no page errors');
        console.log('Studio UI shell: all checks passed.');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
