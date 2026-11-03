const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ergoflex-campus-life-20261019';
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => { if (err) return res.writeHead(404).end(); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r)); fs.mkdirSync(out, { recursive: true });
    let browser; const report = [];
    try {
        for (const [id, layout] of [['library', 'humboldt'], ['occmedialab', 'house'], ['highschool', 'house']]) {
            browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS/.test(m.text())) errors.push(m.text()); });
            await page.setViewport({ width: 1280, height: 800 });
            await page.evaluateOnNewDocument(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => .35 }));
            await page.goto(`http://127.0.0.1:${server.address().port}/?room=${id}&layout=${layout}&view=room&tour=0`, { timeout: 180000 });
            await page.waitForFunction(() => window.ErgoFlex?.sceneDesks?.active && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 240000 });
            await page.evaluate(async () => { const e = ErgoFlex; await e.workspaceRoom.ready; await e.sceneDesks.objects.ready; e.renderer.setAnimationLoop(null); });
            console.log('Loaded', id);
            for (const size of ['48x30', '60x30']) {
                const result = await page.evaluate(async ({ id, size }) => {
                    const e = ErgoFlex, T = await import('three'); e.sceneDesks.setSize(size); await e.sceneDesks.objects.ready;
                    const r = e.workspaceRoom, fail = [], signatures = [], check = (ok, msg) => { if (!ok) fail.push(msg); };
                    const before = JSON.stringify([...e.sceneDesks.records.values()].map(x => ({ style: x.state.style, artwork: x.state.artwork, accessories: x.state.accessories })));
                    check(r.missingProps.length === 0, 'Missing props: ' + r.missingProps);
                    for (const phase of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                        e.setMeasuredRoomMode(id, phase, false);
                        check(r.root.userData.campusLife?.phase === phase, 'Activity did not update');
                        let groups = 0, vertices = 0;
                        r.root.traverse(g => {
                            if (!g.userData.campusLife?.support) return; groups++;
                            const active = g.children.filter(c => c.visible && c.userData.campusPhase);
                            check(active.length === 1 && active[0].userData.campusPhase === phase, 'Mixed activity kits');
                            active.forEach(c => c.traverse(o => { vertices += o.geometry?.attributes.position?.count || 0; }));
                        });
                        check(groups === (id === 'highschool' ? 9 : id === 'occmedialab' ? 2 : 1), 'Missing support kits');
                        signatures.push(vertices);
                        if (id === 'occmedialab') check(r.root.userData.mediaLab.phase === phase, 'Media phase');
                    }
                    check(new Set(signatures).size >= (id === 'library' ? 2 : 4), 'Activities have identical geometry');
                    check(before === JSON.stringify([...e.sceneDesks.records.values()].map(x => ({ style: x.state.style, artwork: x.state.artwork, accessories: x.state.accessories }))), 'Activity changed saved desk build');
                    let kit; r.root.traverse(g => { if (!kit && g.userData.campusLife?.support) kit = g; });
                    const support = kit.parent, origin = support.position.clone(), local = kit.position.clone();
                    r.root.updateMatrixWorld(true); const initial = kit.getWorldPosition(new T.Vector3());
                    const frame = support.parent.matrixWorld;
                    const delta = new T.Vector3(200, 0, 0).applyMatrix4(frame).sub(new T.Vector3().applyMatrix4(frame));
                    support.position.x += 200; r.root.updateMatrixWorld(true);
                    check(kit.position.equals(local) && kit.getWorldPosition(new T.Vector3()).distanceTo(initial.add(delta)) < .001, 'Dressing detached from moved support');
                    support.position.copy(origin); kit.visible = false; e.setMeasuredRoomMode(id, 'morning', false);
                    check(!kit.visible, 'Activity restored a deleted/hidden kit'); kit.visible = true;
                    return { id, size, signatures, fail, details: r.root.userData.campusLife };
                }, { id, size });
                console.log(JSON.stringify(result)); report.push(result); assert.deepEqual(result.fail, []);
            }
            for (const phase of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                const shot = await page.evaluate(async ({ id, phase }) => {
                    const e = ErgoFlex, T = await import('three'); e.setMeasuredRoomMode(id, phase, false);
                    const r = e.workspaceRoom, l = r.roomLayout, { camera, controls } = e.roomInteractions;
                    e.renderer.setAnimationLoop(null); e.renderer.setPixelRatio(.75); e.renderer.setSize(1280, 800, false);
                    camera.aspect = 1.6; camera.fov = 48; camera.updateProjectionMatrix(); controls.enableDamping = false;
                    const world = xyz => new T.Vector3(...xyz).applyMatrix4(r.root.matrixWorld);
                    const focus = id === 'library' ? [2450, 850, -1200] : [0, 900, l.back + l.depth * .44];
                    const eye = id === 'library' ? [-8800, 10500, 11600] : [l.width * .88, 10500, l.back + l.depth * 1.3];
                    controls.target.copy(world(focus)); camera.position.copy(world(eye)); camera.lookAt(controls.target); controls.update();
                    e.setHeight(l.modes?.[phase]?.height || e.measuredRoom.modes[phase].height);
                    e.setTilt('tilting', l.modes?.[phase]?.tilt ?? e.measuredRoom.modes[phase].tilt);
                    e.workspaceAccessories.update(); r.root.updateWorldMatrix(true, true); r.update(camera);
                    e.renderer.render(e.roomInteractions.scene, camera);
                    e.renderer.render(e.roomInteractions.scene, camera);
                    return e.renderer.domElement.toDataURL('image/png').split(',')[1];
                }, { id, phase });
                fs.writeFileSync(path.join(out, `${id}-${phase}.png`), Buffer.from(shot, 'base64'));
            }
            const closeup = await page.evaluate(async id => {
                const e = ErgoFlex, T = await import('three'), r = e.workspaceRoom, { camera, controls } = e.roomInteractions;
                e.setMeasuredRoomMode(id, id === 'library' ? 'evening' : 'afternoon', false);
                const key = id === 'library' ? 'humboldt-table-l1' : id === 'occmedialab' ? 'activity-table' : 'student-table-1-1';
                let table; r.root.traverse(g => { if (g.userData.propId === key) table = g; });
                r.root.updateWorldMatrix(true, true);
                const point = v => table.localToWorld(new T.Vector3(...v));
                e.renderer.setPixelRatio(1); e.renderer.setSize(1280, 800, false); camera.aspect = 1.6; camera.fov = 45; camera.updateProjectionMatrix();
                controls.target.copy(point([0, 820, 0])); camera.position.copy(point(id === 'library' ? [2250, 2600, 2600] : [1450, 2100, 1850]));
                camera.lookAt(controls.target); controls.update(); r.update(camera); e.renderer.render(e.roomInteractions.scene, camera); e.renderer.render(e.roomInteractions.scene, camera);
                return e.renderer.domElement.toDataURL('image/png').split(',')[1];
            }, id);
            fs.writeFileSync(path.join(out, `${id}-detail.png`), Buffer.from(closeup, 'base64'));
            assert.deepEqual(errors, []); await browser.close(); browser = null;
        }
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
        console.log('PASS all three environments, both widths, five activities, saved build retention, furniture attachment, hidden items and render checks.');
    } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
