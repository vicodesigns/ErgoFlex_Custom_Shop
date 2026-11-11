#!/usr/bin/env node
// Who is in each room, and are they believable: loads rooms in the Studio with People on and reports every cast member.
//
//   node tools/people/cast-audit.cjs <room:layout:daypart[:size]> [...] --port 3123 [--out report.json] [--survey]
//   node tools/people/cast-audit.cjs --film --port 3123          the nine film rooms, film layouts, all five dayparts
//   node tools/people/cast-audit.cjs home:*:*                     every layout and daypart of a room ('*')
//
// Per person: the model and placement key, visible or not and why (anchor missing, other daypart, desk height,
// filtered), position (room mm) and whether it is inside the room, the distance to the nearest other visible person,
// and furniture it intersects: sample points of the person's mesh inside a mesh box of a piece of furniture other than
// the one they sit on, stand at or roll in (an overlap of 3 % or more of the points is reported as a problem).
// --survey adds the room's layouts, dayparts (label, description, desk height), stations and furniture (for planning).
// Needs a static server of the worktree on --port (the kit's serve.cjs) and Chrome at /usr/bin/google-chrome.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const puppeteer = require(fs.existsSync(path.join(ROOT, 'node_modules/puppeteer')) ? path.join(ROOT, 'node_modules/puppeteer') : '/home/ergo/ErgoFlex_Custom_Shop/node_modules/puppeteer');
const args = process.argv.slice(2), flag = n => { const i = args.indexOf('--' + n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }, bool = n => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const port = flag('port') || 3123, outFile = flag('out'), survey = bool('survey'), film = bool('film');
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const FILM = ['home:house', 'creative:premium', 'library:humboldt', 'occmedialab:house', 'highschool:house', 'gym:house', 'gaming:house', 'music:house', 'workshop:house'];
let specs = args.length ? args : film ? FILM.flatMap(s => PHASES.map(p => s + ':' + p)) : [];

// In the page: the room as loaded, its cast and what each person touches.
async function inspect(room, layout, phase, size, survey) {
    const T = window.__T, E = window.ErgoFlex;
    await EnvironmentReview.load(room, phase, size, layout);
    // the Studio sets the daypart's desk height and tilt; the review loader leaves every desk at 30 in
    const md = E.measuredRoom?.modes?.[phase]; if (md && Number.isFinite(md.height)) { E.setHeight(md.height); if (Number.isFinite(md.tilt)) E.setTilt('tilting', md.tilt); await new Promise(res => setTimeout(res, 1800)); }
    await E.setRoomPeople(true); const r = E.workspaceRoom, P = r.people; if (P?.built) await P.built;
    await new Promise(res => setTimeout(res, 600));
    const l = r.roomLayout, m = E.measuredRoom, root = r.root; root.updateWorldMatrix(true, true);
    const inv = root.matrixWorld.clone().invert(), local = v => v.clone().applyMatrix4(inv);
    const name = o => o.userData.propId || o.userData.decorUpgrade || o.name || o.type;
    // furniture: every scene asset (and the featured desk), as the boxes of its meshes in room millimetres
    const people = P ? P.people : [], personParts = new Set(); for (const o of people) { o.traverse(c => personParts.add(c)); o.userData.personChair?.traverse(c => personParts.add(c)); }
    const furniture = [];
    const boxesOf = obj => { const out = []; obj.updateWorldMatrix(true, true); obj.traverse(c => { if (!c.isMesh || personParts.has(c) || !c.visible) return; let v = c, shown = true; while (v && v !== root) { if (!v.visible) { shown = false; break; } v = v.parent; } if (!shown || !c.geometry) return; if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld).applyMatrix4(inv); if (b.isEmpty()) return; out.push(b); }); return out; };
    for (const a of r.assets()) { if (personParts.has(a) || /^Person/.test(a.name)) continue; const boxes = boxesOf(a); if (!boxes.length) continue; const all = boxes.reduce((s, b) => s.union(b), new T.Box3()); furniture.push({ id: name(a), object: a, boxes, box: all }); }
    const deskObj = E.loadedModel; if (deskObj) { const boxes = boxesOf(deskObj); if (boxes.length) furniture.push({ id: 'featured-desk', object: deskObj, boxes, box: boxes.reduce((s, b) => s.union(b), new T.Box3()) }); }
    const state = r.peopleState?.() || {}, mode = state.mode, height = state.height;
    // the featured desk's keyboard (tray or desktop), for "are the desk user's hands on it" at this height and tilt
    let keys = null; for (const [k, item] of E.sceneDesks?.active?.objects || []) { const label = k + ' ' + (item.obj?.userData?.propId || '') + ' ' + (item.obj?.name || ''); if (!/keyboard/i.test(label) || /tray/i.test(label) || item.saved?.removed || !item.obj?.visible) continue; item.obj.updateWorldMatrix(true, true); const b = new T.Box3().setFromObject(item.obj).applyMatrix4(inv); if (!b.isEmpty()) { keys = b; break; } }
    const anchorOf = spec => { const id = [].concat(spec.on || spec.by || [])[0]; return id || null; };
    const rows = people.map(o => {
        const s = o.userData.person, fit = o.userData.personFit, key = s.key || s.id;
        let why = 'shown';
        if (!o.visible) why = o.userData.personMissing ? (s.station ? 'station missing or its height does not fit' : 'anchor not found') : !P.allowed(s) ? 'filtered' : (s.modes && !s.modes.includes(mode)) ? 'not this daypart' : (s.desk && !s.station) ? (fit !== null && Math.abs(height - fit) > 1.4 ? `cast but hidden: desk at ${height} in, pose for ${fit} in` : !state.pose ? 'cast but hidden: the featured desk has no pose' : 'another desk user is at the desk') : 'hidden';
        const row = { key, id: s.id, desk: !!(s.desk && !s.station), visible: o.visible, why, at: [Math.round(o.position.x), Math.round(o.position.z)], y: Math.round(o.position.y), turn: Math.round(T.MathUtils.radToDeg(o.rotation.y)) };
        if (!o.visible) return row;
        o.updateWorldMatrix(true, true);
        const pts = []; o.traverse(c => { if (!c.isMesh || !c.geometry?.attributes?.position) return; const p = c.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 700)); for (let i = 0; i < p.count; i += step) pts.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld).applyMatrix4(inv)); });
        const pb = new T.Box3().setFromPoints(pts);
        if (s.desk && !s.station && keys) {   // the closest the person comes to the keyboard (mm): hands on it are within ~40
            const near = []; o.traverse(c => { if (!c.isMesh || !c.geometry?.attributes?.position) return; const p = c.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 6000)); for (let i = 0; i < p.count; i += step) near.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld).applyMatrix4(inv)); });
            let best = null, bd = Infinity; for (const p of near) { const d = keys.distanceToPoint(p); if (d < bd) { bd = d; best = p; } }
            row.hands = Math.round(bd); row.handAt = best.toArray().map(Math.round); row.keyboard = [keys.min.toArray().map(Math.round), keys.max.toArray().map(Math.round)];
            // the lowest point of the person's hands region in front of the body, for "above or behind the keys"
            const front = near.filter(p => p.y > keys.min.y - 250 && p.y < keys.max.y + 250 && Math.hypot(p.x - o.position.x, p.z - o.position.z) > 250);
            if (front.length) { const lo = front.reduce((a, b) => (a.y < b.y ? a : b)); row.handLow = lo.toArray().map(Math.round); }
        } row.box = [pb.min.toArray().map(Math.round), pb.max.toArray().map(Math.round)];
        const cx = l.id === 'humboldt' ? 2300 : 0;   // the commons is not centred on x = 0
        row.inside = pb.min.x > cx - l.width / 2 - 5 && pb.max.x < cx + l.width / 2 + 5 && pb.min.z > l.back - 5 && pb.max.z < l.back + l.depth + 5;
        const own = new Set([anchorOf(s)].filter(Boolean)); if (s.desk && !s.station) own.add('featured-desk'); if (s.station) for (const f of furniture) if (f.id.endsWith('station-' + s.station)) own.add(f.id);
        // seated people put their legs under tables and sit on the chair nearest them: for furniture standing on the
        // floor only the top 60 mm (the surface) counts, and their own chair not at all
        const seated = /-sit-|-wheel-|sit-floor|floor-stretch/.test(s.id) || !!s.near || !!s.on;
        if (seated) { const c = new T.Vector3(o.position.x, 0, o.position.z); let best = null, bd = 450; for (const f of furniture) { if (!/chair|stool|bench|sofa|seat/i.test(f.id)) continue; const d = Math.hypot((f.box.min.x + f.box.max.x) / 2 - c.x, (f.box.min.z + f.box.max.z) / 2 - c.z); if (d < bd) { bd = d; best = f.id; } } if (best) own.add(best); }
        const hits = [];
        for (const f of furniture) {
            if (own.has(f.id) || !f.box.clone().expandByScalar(10).intersectsBox(pb)) continue;
            // the seat a seated person was placed on by `near`, or a station desk they work at, is theirs too
            const shrunk = f.boxes.map(b => { const k = b.clone().expandByScalar(-15); if (seated && b.min.y < 120 && b.max.y < 1250) k.min.y = Math.max(k.min.y, b.max.y - 60); return k; }).filter(b => !b.isEmpty());
            let n = 0; for (const p of pts) if (shrunk.some(b => b.containsPoint(p))) n++;
            if (n) hits.push({ id: f.id, share: Math.round(n / pts.length * 1000) / 10 });
        }
        row.hits = hits.sort((a, b) => b.share - a.share).slice(0, 4);
        return row;
    });
    for (const a of rows) if (a.visible) { let best = Infinity, who = null; for (const b of rows) if (b !== a && b.visible) { const d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]); if (d < best) { best = d; who = b.key; } } a.nearest = who ? { key: who, mm: Math.round(best) } : null; }
    const out = { room, layout: l.id, phase: mode || phase, deskHeight: height, deskTilt: md?.tilt ?? null, deskPose: state.pose ? [Math.round(state.pose.x), Math.round(state.pose.z)] : null, keyboard: state.keyboard ? [Math.round(state.keyboard.x), Math.round(state.keyboard.z)] : null, room_mm: [l.width, l.depth, l.height], back: l.back, people: rows };
    if (survey) {
        out.layouts = Object.fromEntries(Object.entries(m.layouts || {}).map(([k, v]) => [k, { name: v.name || v.label, size: [v.width, v.depth, v.height] }]));
        out.modes = Object.fromEntries(Object.entries(m.modes || {}).map(([k, v]) => [k, { label: v.label, description: v.description, height: v.height }]));
        out.stations = (l.stations || []).map(s => ({ id: s.id, at: s.at, turn: s.turn, height: s.height }));
        out.desk = state.pose ? { x: Math.round(state.pose.x), z: Math.round(state.pose.z), yaw: Math.round(T.MathUtils.radToDeg(state.pose.yaw || 0)) } : null;
        out.furniture = furniture.map(f => ({ id: f.id, c: [Math.round((f.box.min.x + f.box.max.x) / 2), Math.round((f.box.min.z + f.box.max.z) / 2)], size: [Math.round(f.box.max.x - f.box.min.x), Math.round(f.box.max.y), Math.round(f.box.max.z - f.box.min.z)], turn: Math.round(T.MathUtils.radToDeg(f.object.rotation.y)) }));
    }
    return out;
}

(async () => {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', defaultViewport: { width: 960, height: 540 },
        args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message.slice(0, 300)));
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => { document.documentElement.innerHTML = '<body style="margin:0"><iframe id="s" style="width:960px;height:540px;border:0" src="/?room=home&view=room&layout=house&presentation=1&tour=1"></iframe></body>'; });
    const frame = await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction('window.ErgoPresentation&&window.ErgoFlex', { timeout: 180000 });
    await frame.addScriptTag({ type: 'module', url: '/tools/environment-review-session.mjs' });
    await frame.waitForFunction('window.EnvironmentReview', { timeout: 60000 });
    await frame.addScriptTag({ type: 'module', content: "import * as THREE from 'three';window.__T=THREE;" });
    await frame.waitForFunction('window.__T', { timeout: 60000 });
    // '*' expands to every layout or daypart of the room
    const expanded = [];
    for (const spec of specs) {
        const [room, layout, phase, size = '60x30'] = spec.split(':');
        let layouts = [layout];
        if (layout === '*') { await frame.evaluate(async room => { await EnvironmentReview.load(room, 'afternoon', '60x30'); }, room); layouts = await frame.evaluate(() => Object.keys(window.ErgoFlex.measuredRoom.layouts)); }
        for (const L of layouts) for (const p of phase === '*' ? PHASES : [phase]) expanded.push([room, L, p, size]);
    }
    const reports = [];
    for (const [room, layout, phase, size] of expanded) {
        let rep; try { rep = await frame.evaluate(`(${inspect})(${JSON.stringify(room)},${JSON.stringify(layout)},${JSON.stringify(phase)},${JSON.stringify(size)},${survey})`); }
        catch (e) { rep = { room, layout, phase, error: String(e.message || e).slice(0, 300) }; }
        reports.push(rep);
        const bad = (rep.people || []).filter(p => p.visible && ((p.hands ?? 0) > 60 || !p.inside || p.hits.some(h => h.share >= 3) || (p.nearest && p.nearest.mm < 600)));
        const hiddenDesk = (rep.people || []).filter(p => /cast but hidden/.test(p.why)).map(p => p.key + ' (' + p.why + ')');
        console.log(`${room}:${layout}:${phase} desk ${rep.deskHeight} in, ${(rep.people || []).some(p => p.visible && /desk/.test(p.why) === false && rep.people) ? '' : ''}${(rep.people || []).filter(p => p.visible).length}/${(rep.people || []).length} shown` + (rep.error ? ' ERROR ' + rep.error : '') + ((rep.people || []).some(p => p.visible && p.desk) ? '' : hiddenDesk.length ? '  DESK EMPTY: ' + hiddenDesk.join(', ') : '') + (bad.length ? '  PROBLEMS: ' + bad.map(p => `${p.key}${p.inside ? '' : ' outside'}${p.hits.filter(h => h.share >= 3).map(h => ` in ${h.id} ${h.share}%`).join('')}${p.nearest && p.nearest.mm < 600 ? ` ${p.nearest.mm}mm from ${p.nearest.key}` : ''}${(p.hands ?? 0) > 60 ? ` hands ${p.hands}mm off the keyboard (tilt ${rep.deskTilt})` : ''}`).join('; ') : ''));
    }
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(reports, null, 1));
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
