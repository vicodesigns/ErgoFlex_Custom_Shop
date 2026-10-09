const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if(m.type() === 'error' && /Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text())) errors.push(m.text()); });
        await page.setViewport({ width: 1500, height: 1200 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?room=home&view=room`, { timeout: 120000 });
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length === 4 && getComputedStyle(document.querySelector('#loader')).display === 'none', { timeout: 120000 });
        await page.evaluate(() => { ErgoFlex.renderer.setPixelRatio(.5); ErgoFlex.renderer.shadowMap.enabled = false; });
        const names = { home: 'Home', gaming: 'Gaming', music: 'Music', creative: 'Artist', study: 'Study', office: 'Office', gym: 'Gym', kitchen: 'Kitchen', lounge: 'Lounge', workshop: 'Workshop', bedroom: 'Bedroom', gallery: 'Gallery', scifi: 'Scifi', coworking: 'Coworking', library: 'Library' };
        for (const [id, name] of Object.entries(names)) {
            const result = await page.evaluate(async (id, name) => {
                const THREE = await import('three');
                ErgoFlex.setRoomScene(id, false);
                ErgoFlex[`set${name}Layout`](id === 'library' ? 'executive' : 'house');
                await ErgoFlex.workspaceRoom.ready;
                const room = ErgoFlex.workspaceRoom, modes = [], badUVs = [], imported = [];
                for (const mode of ['morning', 'afternoon', 'evening', 'night', 'party']) {
                    ErgoFlex[`set${name}Mode`](mode, false);
                    const state = ErgoFlex.roomLightingState, c = state.shadow;
                    const view = new THREE.Matrix4().fromArray(state.viewMatrix), l = room.roomLayout;
                    let contained = true;
                    for (const x of [-l.width / 2, l.width / 2]) for (const y of [0, l.height]) for (const z of [l.back, l.back + l.depth]) {
                        const p = room.root.localToWorld(new THREE.Vector3(x, y, z)).applyMatrix4(view);
                        contained &&= p.x >= c.left && p.x <= c.right && p.y >= c.bottom && p.y <= c.top && -p.z >= c.near && -p.z <= c.far;
                    }
                    modes.push({ ...state, contained, polish: { ...room.root.userData.polish }, backdrop: getComputedStyle(document.querySelector('#viewer-shell')).backgroundImage });
                }
                const grounding = room.grounding;
                const groundingState = { count: grounding.entries.length, expected: ErgoFlex.roomInteractions.entries.filter(e=>e.surface==='floor'&&e.collider).length,
                    interactive: ErgoFlex.roomInteractions.entries.some(e=>e.obj.userData.presentationOnly), seams: grounding.seams.length };
                const entry = grounding.entries[0], initial = entry.obj.position.clone(), rotation = entry.obj.quaternion.clone();
                const before = new THREE.Matrix4(); grounding.mesh.getMatrixAt(0,before);
                entry.obj.position.x += 100; entry.obj.rotateY(.25); grounding.update();
                const after = new THREE.Matrix4(); grounding.mesh.getMatrixAt(0,after);
                const expected = room.root.matrixWorld.clone().invert().multiply(entry.obj.matrixWorld).multiply(entry.local);
                groundingState.follows = after.elements.every((v,i)=>Math.abs(v-expected.elements[i])<.01) && !after.equals(before);
                entry.obj.visible = false; grounding.update(); const hidden = new THREE.Matrix4(); grounding.mesh.getMatrixAt(0,hidden);
                groundingState.hidden = hidden.elements[0] === 0 && hidden.elements[5] === 0;
                entry.obj.visible = true; entry.obj.position.copy(initial); entry.obj.quaternion.copy(rotation); grounding.update();
                let disposedContacts = 0;
                grounding.mesh.geometry.addEventListener('dispose',()=>disposedContacts++);
                const textures = new Set();
                room.root.traverse(obj => {
                    if (!obj.isMesh) return;
                    for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
                        if (mat.userData.roomSurface && mat.bumpMap && (!obj.geometry.attributes.uv1 || mat.bumpMap.channel !== 1)) badUVs.push(obj.name);
                        if (obj.userData.sharedProp) imported.push({ surface: !!mat.userData.roomSurface, map: mat.map?.uuid });
                        else if (!mat.userData.sharedTextures) for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
                    }
                });
                window.roomTextureDisposal = { count: textures.size, disposed: 0 };
                textures.forEach(texture => texture.addEventListener('dispose', () => window.roomTextureDisposal.disposed++));
                const data = { detail: room.root.userData.surfaceDetail, missing: room.missingProps, modes, badUVs, imported, groundingState };
                ErgoFlex.setRoomScene('product', false);
                data.disposal = window.roomTextureDisposal; data.product = ErgoFlex.roomLightingState; data.disposedContacts = disposedContacts; data.productDark = document.querySelector('#viewer-shell').dataset.roomDark;
                return data;
            }, id, name);
            assert.ok(result.detail.materials >= 4, id + ': tagged room materials have surface detail');
            assert.ok(result.detail.meshes > result.detail.materials, id + ': shared materials retain UVs on every mesh');
            assert.ok(result.groundingState.count > 0, id + ': floor furnishings have contact shadows');
            assert.equal(result.groundingState.count,result.groundingState.expected,id + ': one instance per floor collider');
            assert.equal(result.groundingState.interactive,false,id + ': presentation meshes are not furniture or obstacles');
            assert.ok(result.groundingState.follows && result.groundingState.hidden,id + ': shadows follow movement/rotation and hide with objects');
            assert.equal(result.disposedContacts,1,id + ': contact geometry is disposed once');
            assert.equal(result.productDark,undefined,id + ': product restores its backdrop');
            assert.equal(new Set(result.modes.map(m=>m.backdrop)).size, ['library','bedroom'].includes(id)?4:5,id + ': coordinated daypart backdrops');
            assert.ok(result.modes.every(m=>m.polish.mode===m.mode&&m.polish.contactCount>0),id + ': finish profile covers every time');
            assert.equal(result.modes[3].polish.dark,true,id + ': night backdrop is dark');
            assert.deepEqual(result.badUVs, [], id + ': detail maps use physical UVs');
            assert.deepEqual(result.missing, [], id + ': room props loaded');
            assert.ok(result.imported.every(m => !m.surface), id + ': imported models keep authored materials');
            assert.ok(result.modes.every(m => m.contained), id + ': complete floor and height fit the shadow frustum');
            assert.ok(result.modes.every(m => m.shadowLights === 1), id + ': only one shadow map');
            assert.equal(new Set(result.modes.slice(0, 3).map(m => JSON.stringify(m.key))).size, 3, id + ': daylight direction changes across the day');
            assert.equal(result.disposal.disposed, result.disposal.count, id + ': owned colour, bump and roughness textures disposed');
            assert.deepEqual(result.product.target, [0, 0, 0]);
            assert.deepEqual(result.product.shadow, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
            console.log('Lighting and surface detail:', id, result.detail.meshes, 'meshes');
        }
        assert.deepEqual(errors, [], 'No browser errors');
        console.log('All 15 environments × 5 times passed lighting, finishes, backdrops, shadow movement, coverage and disposal checks.');
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
