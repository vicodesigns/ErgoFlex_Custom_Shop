#!/usr/bin/env node
// Camera DISSOLVES for the render (Vico, Nov 20 2026; experience/camera-transitions.mjs): a cameraPlan key
// {cut: true, transition: {type: 'dissolve', dur}} at time T mixes the outgoing and the incoming view over [T - dur/2, T + dur/2].
// The camera bake already cuts at T; a dissolve needs both views for dur seconds, so the chapter is rendered as SEGMENTS that
// overlap by the dissolve and join-subshots.py (xfade 'fade') mixes the overlap:
//
//   node tools/experience/transition-plan.mjs <cut.json> <chapter id> <out segments-cut.json>
//   node tools/experience/render-cut.cjs --cut <out> --shots all --out <render dir> --video      (01.mkv, 02.mkv, ...)
//   python3 tools/experience/join-subshots.py <out> <render dir> <chapter.mkv>
//
// Segment j runs from the previous dissolve's overlap start to this one's overlap end (renderRange, absolute chapter seconds, so every
// segment bakes the same chapter time: scene animation (people, LEDs, clocks, screens) is in step across both). The outgoing
// segment keeps the plan's keys up to the dissolve (the camera holds its last view through the overlap); the incoming segment
// holds the incoming key's view from the overlap start to T, then its own move: frames outside the overlaps are the frames of
// the plain render. dips and hard cuts inside a segment stay as they are (render-cut.cjs applies dips). No dissolve: nothing to
// plan (exit 3, the chapter renders as it always did). Overlaps are whole frames (at least 2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FPS = 30;
const [cutFile, chapter, outFile] = process.argv.slice(2);
if (!cutFile || !chapter || !outFile) { console.error('usage: transition-plan.mjs <cut.json> <chapter id> <out.json>'); process.exit(2); }
const cut = JSON.parse(fs.readFileSync(cutFile, 'utf8')), shot = (cut.shots || []).find(s => s.id === chapter);
if (!shot) { console.error('no chapter ' + chapter); process.exit(2); }
const keys = [...(shot.cameraPlan?.keys || [])].sort((a, b) => a.at - b.at), seconds = Number(shot.seconds);
const isDissolve = k => k && k.cut && k.transition?.type === 'dissolve' && Number(k.transition.dur) > 0;
const idx = keys.map((k, i) => isDissolve(k) && i > 0 ? i : -1).filter(i => i >= 0);
if (!idx.length) process.exit(3);
const frame = s => Math.round(s * FPS) / FPS;
// each dissolve's overlap [ts, te] in whole frames, inside the chapter and clear of the neighbouring overlaps
const dis = idx.map(i => { const T = keys[i].at, d = Number(keys[i].transition.dur); let ts = Math.max(0, frame(T - d / 2)), te = Math.min(seconds, frame(T + d / 2)); if (te - ts < 2 / FPS) te = ts + 2 / FPS; return { i, T, ts, te }; });
for (let j = 1; j < dis.length; j++) if (dis[j].ts < dis[j - 1].te) { console.error('dissolves overlap each other near ' + dis[j].T + ' s'); process.exit(2); }
const bake = plan => {
    const tmp = path.join(os.tmpdir(), 'tp-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json');
    fs.writeFileSync(tmp, JSON.stringify({ seconds, cameraPlan: plan }));
    try { execFileSync('node', [path.join(HERE, 'camera-spline.mjs'), tmp], { stdio: 'ignore' }); return JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; } finally { fs.unlinkSync(tmp); }
};
const segments = [];
for (let j = 0; j <= dis.length; j++) {
    const from = j === 0 ? 0 : dis[j - 1].i, to = j === dis.length ? keys.length : dis[j].i;      // keys [from, to)
    let sub = keys.slice(from, to).map(k => structuredClone(k));
    if (j > 0) {                                  // incoming: its view held from the overlap start to T, then its own move
        const first = sub[0]; delete first.transition;
        const hold = { ...structuredClone(first), at: Math.min(dis[j - 1].ts, first.at - 1e-3) }; delete hold.cut; delete hold.transition;
        if (hold.at < first.at) sub = [hold, ...sub];
    }
    const s = structuredClone(shot);
    s.cameraPlan = { ...structuredClone(shot.cameraPlan), keys: sub };
    s.camera = bake(s.cameraPlan);
    s.renderRange = [j === 0 ? 0 : dis[j - 1].ts, j === dis.length ? seconds : dis[j].te];
    s.id = chapter;
    segments.push(s);
}
fs.writeFileSync(outFile, JSON.stringify({ ...cut, name: (cut.name || 'cut') + ' · ' + chapter + ' dissolves', shots: segments }));
console.log(JSON.stringify({ chapter, seconds, segments: segments.map(s => s.renderRange), overlaps: dis.map(d => [d.ts, d.te]) }));
