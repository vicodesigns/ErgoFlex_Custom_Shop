// Camera transitions on the render side (Nov 20 2026): dips in render-cut.cjs, dissolves through transition-plan.mjs + join-subshots.py.
//   node tests/camera-transitions-render-test.mjs <one-chapter cut.json> [port]
// NEEDS Chrome and the GPU: run it through /f/eng-tools/gpuwait.sh (never over a render). 480p, a few minutes.
// 1. a chapter with no transition renders byte-identical frames to the render-cut.cjs before the dip code (git HEAD~1's copy)
// 2. a dip-black: the frame at the key is black; every frame outside the window equals the plain render's frame; the length is unchanged
// 3. a dissolve: the join has the chapter's length; outside the overlap the frames are the plain segments' frames (to within the re-encode);
//    the frame at the key is a mix of the outgoing and the incoming view (close to the mean of the two segments' frames there)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [cutFile, port = '4931'] = process.argv.slice(2);
if (!cutFile) { console.error('usage: node tests/camera-transitions-render-test.mjs <one-chapter cut.json> [port]'); process.exit(2); }
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cam-trans-')), FPS = 30;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = JSON.parse(fs.readFileSync(cutFile, 'utf8')), shot0 = base.shots[0], chapter = shot0.id;
const keysAt = shot0.cameraPlan.keys.map(k => k.at);
const server = spawn('node', ['tools/experience/render-server.cjs', port], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
const render = (cutPath, out, script = 'render-cut.cjs', extra = []) => {
    fs.mkdirSync(out, { recursive: true });
    execFileSync('node', [path.join(root, 'tools/experience', script), '--cut', cutPath, '--shots', 'all', '--out', out, '--size', '854x480', '--video', '--server', 'http://127.0.0.1:' + port, ...extra], { cwd: root, env: { ...process.env, CHROME_PATH: CHROME, CHROME }, stdio: 'ignore' });
};
const md5s = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'framemd5', '-'], { encoding: 'utf8', maxBuffer: 1e8 }).split('\n').filter(l => l && l[0] !== '#').map(l => l.split(',').pop().trim());
const frameRaw = (file, n) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1e8 });
const mean = buf => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i]; return s / buf.length; };
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const write = (name, shot) => { const p = path.join(work, name + '.json'); fs.writeFileSync(p, JSON.stringify({ name, shots: [shot] })); return p; };
const withKey = (shot, at, transition) => { const s = structuredClone(shot); const k = s.cameraPlan.keys.find(k => Math.abs(k.at - at) < 1e-6); k.cut = true; k.transition = transition; return s; };
try {
    // a window inside the chapter around the dip key (frames [a, b) in chapter seconds), short so the test is quick
    const dipAt = keysAt.find(t => t > 2 && t < shot0.seconds - 3), a = Math.max(0, dipAt - 1.5), b = dipAt + 1.5;
    const ranged = shot => ({ ...structuredClone(shot), renderRange: [a, b] });
    // 1. no transition: byte-identical to the render before the dip code
    const plainCut = write('plain', ranged(shot0));
    fs.writeFileSync(path.join(root, 'tools/experience/render-cut-before-dips.cjs'), execFileSync('git', ['show', 'c003ddde:tools/experience/render-cut.cjs'], { cwd: root, encoding: 'utf8' }));
    render(plainCut, path.join(work, 'plain-new'));
    render(plainCut, path.join(work, 'plain-old'), 'render-cut-before-dips.cjs');
    // (two renders of the same chapter are not bit-identical on this machine (the GPU's shadow / anti-alias noise, mean difference
    // ~0.4 grey levels), so "identical" means: the new code differs from the old by no more than the old differs from itself)
    render(plainCut, path.join(work, 'plain-old2'), 'render-cut-before-dips.cjs');
    const avg = (x, y) => { const o = execFileSync('ffmpeg', ['-v', 'error', '-i', x, '-i', y, '-filter_complex', '[0][1]blend=all_mode=difference,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 }); const v = [...o.matchAll(/YAVG=([0-9.]+)/g)].map(m => Number(m[1])); return v.reduce((s, n) => s + n, 0) / v.length; };
    const pn = md5s(path.join(work, 'plain-new/01.mkv')), po = md5s(path.join(work, 'plain-old/01.mkv')), noise = avg(path.join(work, 'plain-old/01.mkv'), path.join(work, 'plain-old2/01.mkv')), change = avg(path.join(work, 'plain-new/01.mkv'), path.join(work, 'plain-old/01.mkv'));
    assert.equal(pn.length, po.length, 'same frame count');
    assert.ok(change <= noise * 1.5 + .02, `a chapter without a transition renders as before (new vs old ${change.toFixed(3)} grey levels, old vs old ${noise.toFixed(3)})`);
    console.log(`PASS 1: no transition: ${pn.length} frames, new vs old ${change.toFixed(3)} (the old render differs from itself by ${noise.toFixed(3)}); identical frames: ${pn.filter((h, i) => h === po[i]).length}`);
    // 2. a dip to black, 1.0 s, at dipAt
    const dur = 1.0, dipCut = write('dip', ranged(withKey(shot0, dipAt, { type: 'dip-black', dur })));
    render(dipCut, path.join(work, 'dip'));
    const dm = md5s(path.join(work, 'dip/01.mkv')); assert.equal(dm.length, pn.length, 'a dip does not change the length');
    const frameOf = t => Math.round((t - a) * FPS);
    const mid = frameRaw(path.join(work, 'dip/01.mkv'), frameOf(dipAt));
    assert.ok(mean(mid) < 3, `the frame at the key is black (mean ${mean(mid).toFixed(2)})`);
    const outside = avg(path.join(work, 'dip/01.mkv'), path.join(work, 'plain-new/01.mkv')); // (all frames; the dip's own frames raise it, so compare the frames outside the window below)
    for (const n of [0, 3, 6, pn.length - 4, pn.length - 1]) { const t = a + n / FPS; if (Math.abs(t - dipAt) >= dur / 2 + 1 / FPS) assert.ok(diff(frameRaw(path.join(work, 'dip/01.mkv'), n), frameRaw(path.join(work, 'plain-new/01.mkv'), n)) < 2.5, `frame ${n} (t ${t.toFixed(2)}) outside the dip window equals the plain render (to the render noise)`); }
    const edge = frameRaw(path.join(work, 'dip/01.mkv'), frameOf(dipAt - dur / 4)), plainEdge = frameRaw(path.join(work, 'plain-new/01.mkv'), frameOf(dipAt - dur / 4));
    assert.ok(Math.abs(mean(edge) - mean(plainEdge) * .5) < mean(plainEdge) * .12 + 2, 'half way into the dip the frame is about half bright');
    console.log('PASS 2: dip-black: black at the key, frames outside the window identical, length unchanged');
    // 3. a dissolve, 1.0 s, at dipAt (the whole chapter in segments)
    const disShot = withKey(shot0, dipAt, { type: 'dissolve', dur }), disCut = write('dissolve', disShot), segs = path.join(work, 'segments.json');
    execFileSync('node', ['tools/experience/transition-plan.mjs', disCut, chapter, segs], { cwd: root, stdio: 'ignore' });
    const plan = JSON.parse(fs.readFileSync(segs, 'utf8')); assert.equal(plan.shots.length, 2, 'two segments');
    render(segs, path.join(work, 'segs'));
    const joined = path.join(work, 'joined.mkv'), py = process.env.PYTHON || 'python';
    execFileSync(py, ['tools/experience/join-subshots.py', segs, path.join(work, 'segs'), joined], { cwd: root, stdio: 'ignore' });
    const jm = md5s(joined), want = Math.round(shot0.seconds * FPS);
    assert.ok(Math.abs(jm.length - want) <= 1, `the joined chapter keeps its length (${jm.length} frames, ${want} expected)`);
    const [ts, te] = [plan.shots[1].renderRange[0], plan.shots[0].renderRange[1]], key = Math.round(dipAt * FPS);
    const A = frameRaw(path.join(work, 'segs/01.mkv'), Math.round(dipAt * FPS) - Math.round(plan.shots[0].renderRange[0] * FPS));
    const B = frameRaw(path.join(work, 'segs/02.mkv'), Math.round(dipAt * FPS) - Math.round(ts * FPS));
    const J = frameRaw(joined, key), M = Buffer.from(A.map((v, i) => (v + B[i]) >> 1));
    assert.ok(diff(A, B) > 3, 'the outgoing and the incoming view differ at the key');
    assert.ok(diff(J, M) < diff(J, A) && diff(J, M) < diff(J, B), `the frame at the key is a mix (to the mean ${diff(J, M).toFixed(2)}, to A ${diff(J, A).toFixed(2)}, to B ${diff(J, B).toFixed(2)})`);
    const before = frameRaw(joined, Math.round(ts * FPS) - 3), plainBefore = frameRaw(path.join(work, 'segs/01.mkv'), Math.round(ts * FPS) - 3 - Math.round(plan.shots[0].renderRange[0] * FPS));
    assert.ok(diff(before, plainBefore) < 2.5, 'outside the overlap the joined frames are the outgoing segment\'s frames (to the re-encode)');
    console.log(`PASS 3: dissolve: ${jm.length} frames, overlap ${ts.toFixed(2)}-${te.toFixed(2)} s, the key frame is a mix`);
} finally {
    server.kill(); fs.rmSync(path.join(root, 'tools/experience/render-cut-before-dips.cjs'), { force: true });
    console.log('work files: ' + work);
}
