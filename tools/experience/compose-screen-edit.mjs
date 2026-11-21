#!/usr/bin/env node
// Screen edit list composer (docs/screen-edit-list/CONTRACT.md). An edit list is a track of shot.screens (the Graphics
// lane's track: experience/graphic-clips.mjs graphicTrack) where at least one clip has `transitionIn`. Its clips (src,
// start/end in chapter seconds, offset = source in, rate, loop, transitionIn {type: cut|dissolve|dip, dur, color}) are
// composed by ffmpeg into ONE mp4 per track; the render then plays that mp4 on the screen (one film-fx entry per
// contiguous run of clips). A shot without such a track is returned untouched (the same object).
//
//   node tools/experience/compose-screen-edit.mjs <cut dir | cut.json> <chapter id | index> [--dry] [--out <dir>]
//       compose (or with --dry only plan) every edit-list track of the chapter; prints the report
//   node tools/experience/compose-screen-edit.mjs --bin [<cut dir>]
//       the source bin: every usable source clip as JSON; with a cut dir also <cut>/director-film/screen-bin.json
//
// render-cut.cjs / render-still.cjs call applyScreenEdits(shot, {cutFile}) for each shot they render.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execFileSync, spawnSync} from 'child_process';
import {fileURLToPath} from 'url';
import {graphicTrack} from '../../experience/graphic-clips.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const SCREEN_EDIT_VERSION = fs.readFileSync(path.join(HERE, 'screen-edit-version.txt'), 'utf8').trim();
export const FPS = 30, CAP = 2048, MAX_DUR = 4;
const TRACK_FIELDS = ['target', 'mesh', 'material', 'person', 'within'];
const EDIT_FIELDS = ['src', 'start', 'end', 'offset', 'rate', 'loop', 'transitionIn', 'compose'];
const DISPLAY_FIELDS = ['rotate', 'flipX', 'flipY', 'brightness', 'inset', 'blend', 'res'];
const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const posix = p => p.split(path.sep).join('/');
const r3 = v => Math.round(v * 1000) / 1000;
const fmt = v => r3(v).toFixed(2);

// ---- tracks -------------------------------------------------------------------------------------------------------------
export const isEditTrack = entries => entries.some(sc => has(sc, 'transitionIn'));
export function editTracks(shot) {
  const list = Array.isArray(shot?.screens) ? shot.screens : [], m = new Map();
  list.forEach((sc, i) => { const k = graphicTrack(sc || {}, i); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return [...m.entries()].filter(([, ix]) => isEditTrack(ix.map(i => list[i]))).map(([key, indices]) => ({key, indices, entries: indices.map(i => list[i])}));
}
export const hasEditList = shot => editTracks(shot).length > 0;
export function trackSlug(sc) {
  const parts = [sc.target ?? 'screen', sc.mesh, sc.material, sc.person, sc.within].filter(v => v !== undefined && v !== null && v !== '');
  return parts.map(String).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'screen';
}

// ---- probing / hashing ----------------------------------------------------------------------------------------------------
const probeCache = new Map(), shaCache = new Map();
export function probe(file) {
  const st = fs.statSync(file), ck = file + '|' + st.size + '|' + st.mtimeMs;
  if (probeCache.has(ck)) return probeCache.get(ck);
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {maxBuffer: 1 << 24}).toString());
  const v = (j.streams || []).find(s => s.codec_type === 'video'), a = (j.streams || []).find(s => s.codec_type === 'audio');
  if (!v) throw Error(`${file}: no video stream`);
  const [n, d] = String(v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate).split('/').map(Number);
  const out = {duration: Number(v.duration || j.format?.duration) || 0, w: v.width, h: v.height, fps: d ? n / d : n, audio: !!a};
  probeCache.set(ck, out); return out;
}
export function sha256(file) {
  const st = fs.statSync(file), ck = file + '|' + st.size + '|' + st.mtimeMs;
  if (!shaCache.has(ck)) shaCache.set(ck, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  return shaCache.get(ck);
}
function canon(v) { return Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v; }
const srcFile = (root, src) => path.resolve(root, String(src).replace(/^\/+/, ''));

// ---- the plan (pure, frame-exact) -------------------------------------------------------------------------------------------
// entries: one track's shot.screens entries; seconds: the chapter length; info(src) -> {duration, w, h, fps, audio}.
export function planTrack(entries, {seconds, info, label = 'screen'}) {
  const report = [], say = s => report.push(`${label} ${s}`);
  const order = entries.map((sc, j) => ({sc, j})).sort((a, b) => (Number(a.sc.start) || 0) - (Number(b.sc.start) || 0) || a.j - b.j);
  const first = order[0].sc, compose = first.compose && typeof first.compose === 'object' ? first.compose : {};
  const fps = Number(compose.fps) > 0 ? Number(compose.fps) : FPS;
  const fi = info(first.src);
  let w0 = Number(compose.w) || fi.w, h0 = Number(compose.h) || fi.h; const s = Math.min(1, CAP / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * s / 2) * 2), h = Math.max(2, Math.round(h0 * s / 2) * 2);
  const T = Number(seconds) || Infinity;
  const clips = order.map(({sc, j}, k) => {
    const start = Math.max(0, Math.min(T, Number(sc.start) || 0)), end = Math.max(0, Math.min(T, Number(sc.end ?? T)));
    if (!Number.isFinite(end)) throw Error(`${label} clip ${k + 1}: no end (the chapter length is unknown)`);
    const sF = Math.round(start * fps), eF = Math.round(end * fps), len = eF - sF;
    if (len < 1) throw Error(`${label} clip ${k + 1}: shorter than one frame (${start}-${end} s)`);
    const rate = Number(sc.rate ?? 1); if (!(rate > 0)) throw Error(`${label} clip ${k + 1}: rate must be > 0`);
    if (!sc.src) throw Error(`${label} clip ${k + 1}: no src`);
    const src = info(sc.src), loop = sc.loop !== false; let offset = Number(sc.offset) || 0;
    if (loop && src.duration > 0) offset = ((offset % src.duration) + src.duration) % src.duration;
    else if (offset < 0) { say(`clip ${k + 1}: offset ${offset} s before the source start, clamped to 0`); offset = 0; }
    return {k, index: j, src: sc.src, start, end, sF, eF, len, rate, offset, loop, fit: sc.fit || 'cover', duration: src.duration, audio: src.audio,
      xIn: 0, dipIn: 0, dipOut: 0, dipInColor: null, dipOutColor: null, loopSrc: false, hold: 0, transition: 'cut'};
  });
  for (let k = 1; k < clips.length; k++) if (clips[k].sF < clips[k - 1].eF) throw Error(`${label}: clips ${k} and ${k + 1} overlap on the timeline (${fmt(clips[k - 1].end)} > ${fmt(clips[k].start)} s)`);
  for (const c of clips) {
    const sc = order[c.k].sc, t = sc.transitionIn, prev = clips[c.k - 1], adjacent = !!prev && prev.eF === c.sF;
    if (t === undefined || t === null) continue;
    let type = t.type ?? 'cut';
    if (!['cut', 'dissolve', 'dip'].includes(type)) { say(`clip ${c.k + 1}: transition type '${type}' unknown, cut`); type = 'cut'; }
    if (type === 'cut') continue;
    let dur = Number(t.dur);
    if (!(dur > 0)) { say(`clip ${c.k + 1}: ${type} without a duration, cut`); continue; }
    if (dur > MAX_DUR) { say(`clip ${c.k + 1}: ${type} ${fmt(dur)} s -> ${fmt(MAX_DUR)} s (the longest transition)`); dur = MAX_DUR; }
    if (type === 'dissolve') {
      if (!adjacent) { say(`clip ${c.k + 1}: dissolve ${fmt(dur)} s -> cut (${prev ? 'a gap before it' : 'the first clip'}: nothing to dissolve from)`); continue; }
      const want = Math.round(dur * fps), handle = Math.floor(c.offset / c.rate * fps + 1e-6), room = prev.len - prev.dipIn;
      const d = Math.max(0, Math.min(want, handle, room));
      if (d < want) say(`clip ${c.k + 1}: dissolve ${fmt(want / fps)} s -> ${d ? fmt(d / fps) + ' s' : 'cut'} (${d === handle ? `head handle: source in ${fmt(c.offset)} s at rate ${c.rate}` : `the outgoing clip ${c.k} has ${fmt(room / fps)} s free`})`);
      if (d >= 1) { c.xIn = d; c.transition = 'dissolve'; }
    } else {
      const color = /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color.toLowerCase() : '#000000';
      if (t.color !== undefined && color !== String(t.color).toLowerCase()) say(`clip ${c.k + 1}: dip colour '${t.color}' is not #rrggbb, black`);
      const want = Math.round(dur * fps / 2);
      const hIn = Math.min(want, c.len), hOut = adjacent ? Math.min(want, prev.len - prev.dipIn) : 0;
      if (hIn < want || (adjacent && hOut < want)) say(`clip ${c.k + 1}: dip ${fmt(2 * want / fps)} s -> out ${fmt(hOut / fps)} s + in ${fmt(hIn / fps)} s (clip length)`);
      if (!adjacent) say(`clip ${c.k + 1}: dip after ${prev ? 'a gap' : 'nothing'}: fades up from ${color} only`);
      c.dipIn = hIn; c.dipInColor = color; if (adjacent) { prev.dipOut = hOut; prev.dipOutColor = color; }
      c.transition = 'dip';
    }
  }
  for (const c of clips) {
    c.srcStart = Math.max(0, c.offset - c.xIn * c.rate / fps);
    const need = (c.xIn + c.len) * c.rate / fps, over = c.srcStart + need - c.duration;
    if (over > .5 / fps * c.rate) {
      if (c.loop) { c.loopSrc = true; say(`clip ${c.k + 1}: loops its source (${fmt(over)} s past the end of ${path.basename(c.src)})`); }
      else { c.hold = Math.ceil(over * fps / c.rate); say(`clip ${c.k + 1}: HOLDS ITS LAST FRAME for ${c.hold} frames (${fmt(c.hold / fps)} s; source ${fmt(c.duration)} s, loop:false): a frozen picture`); }
    }
  }
  for (const [k, {sc}] of order.entries()) {
    if (k === 0) continue;
    for (const f of DISPLAY_FIELDS) if (JSON.stringify(sc[f]) !== JSON.stringify(first[f])) say(`clip ${k + 1}: ${f} differs from clip 1 (not applied: the screen's ${f} is clip 1's)`);
  }
  let audio = compose.audio === true;
  if (audio && clips.some(c => !c.audio)) { say(`compose.audio: a source has no audio track, composed without audio`); audio = false; }
  const runs = [];
  for (const c of clips) { const r = runs[runs.length - 1]; if (r && r.endF === c.sF) { r.endF = c.eF; r.end = c.end; } else runs.push({startF: c.sF, endF: c.eF, start: c.start, end: c.end}); }
  return {version: SCREEN_EDIT_VERSION, fps, w, h, audio, startF: clips[0].sF, endF: clips[clips.length - 1].eF, start: clips[0].start, clips, runs, report};
}

// ---- ffmpeg ------------------------------------------------------------------------------------------------------------------
const hex = c => '0x' + c.slice(1);
function fitFilter(fit, w, h) {
  if (fit === 'stretch') return `scale=${w}:${h}:flags=bicubic`;
  if (fit === 'contain') return `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=bicubic,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
  return `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=bicubic,crop=${w}:${h}`;
}
function atempo(rate) { const out = []; let r = rate; while (r > 2) { out.push('atempo=2'); r /= 2; } while (r < .5) { out.push('atempo=0.5'); r /= .5; } if (Math.abs(r - 1) > 1e-9) out.push(`atempo=${r}`); return out; }
export function ffmpegArgs(plan, out, {root = ROOT} = {}) {
  const {fps, w, h, clips} = plan, inputs = [], g = [], restamp = `setpts=N/(${fps}*TB)`;
  for (const c of clips) inputs.push('-ss', c.srcStart.toFixed(6), ...(c.loopSrc ? ['-stream_loop', '-1'] : []), '-i', srcFile(root, c.src));
  clips.forEach((c, k) => {
    const n = c.xIn + c.len, fades = [];
    if (c.dipIn) fades.push(`fade=t=in:s=${c.xIn}:n=${c.dipIn}:c=${hex(c.dipInColor)}`);
    if (c.dipOut) fades.push(`fade=t=out:s=${n - c.dipOut}:n=${c.dipOut}:c=${hex(c.dipOutColor)}`);
    // +2 cloned frames only cover fps rounding at a source's very end; a real shortage is c.hold (reported)
    g.push(`[${k}:v]setpts=(PTS-STARTPTS)/${c.rate},fps=${fps},${fitFilter(c.fit, w, h)},setsar=1,format=yuv420p,tpad=stop_mode=clone:stop=${c.hold + 2},trim=end_frame=${n},${restamp}${fades.length ? ',' + fades.join(',') : ''}[v${k}]`);
    if (plan.audio) {
      const afades = [];
      if (c.dipIn) afades.push(`afade=t=in:st=${(c.xIn / fps).toFixed(6)}:d=${(c.dipIn / fps).toFixed(6)}`);
      if (c.dipOut) afades.push(`afade=t=out:st=${((n - c.dipOut) / fps).toFixed(6)}:d=${(c.dipOut / fps).toFixed(6)}`);
      g.push(`[${k}:a]asetpts=PTS-STARTPTS,${[...atempo(c.rate), 'aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo', 'apad', `atrim=end=${(n / fps).toFixed(6)}`, 'asetpts=PTS-STARTPTS', ...afades].join(',')}[a${k}]`);
    }
  });
  let acc = 'v0', aacc = 'a0', len = clips[0].len, step = 0;
  const join = (x, ax, frames) => {
    g.push(`[${acc}][${x}]concat=n=2:v=1:a=0,${restamp}[j${step}]`); acc = `j${step}`;
    if (plan.audio) { g.push(`[${aacc}][${ax}]concat=n=2:v=0:a=1[ja${step}]`); aacc = `ja${step}`; }
    len += frames; step++;
  };
  for (let k = 1; k < clips.length; k++) {
    const c = clips[k], gap = c.sF - clips[k - 1].eF;
    if (gap > 0) {
      g.push(`color=c=black:s=${w}x${h}:r=${fps},format=yuv420p,setsar=1,trim=end_frame=${gap},${restamp}[g${k}]`);
      if (plan.audio) g.push(`anullsrc=r=48000:cl=stereo,aformat=sample_fmts=fltp,atrim=end=${(gap / fps).toFixed(6)}[ga${k}]`);
      join(`g${k}`, `ga${k}`, gap);
    }
    if (c.xIn) {
      g.push(`[${acc}][v${k}]xfade=transition=fade:duration=${(c.xIn / fps).toFixed(6)}:offset=${((len - c.xIn) / fps).toFixed(6)},${restamp}[x${k}]`); acc = `x${k}`;
      if (plan.audio) { g.push(`[${aacc}][a${k}]acrossfade=d=${(c.xIn / fps).toFixed(6)}:c1=tri:c2=tri[xa${k}]`); aacc = `xa${k}`; }
      len += c.len;
    } else join(`v${k}`, `a${k}`, c.len);
  }
  const total = plan.endF - plan.startF;
  if (len !== total) throw Error(`internal: composed ${len} frames, the track spans ${total}`);
  g.push(`[${acc}]trim=end_frame=${total},${restamp}[vout]`);
  return ['-v', 'error', '-y', ...inputs, '-filter_complex', g.join(';'), '-map', '[vout]', ...(plan.audio ? ['-map', `[${aacc}]`, '-c:a', 'aac', '-b:a', '160k', '-shortest'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-g', '15', '-r', String(fps), '-frames:v', String(total), '-movflags', '+faststart', out];
}

// ---- keys, files, compose ----------------------------------------------------------------------------------------------------
export function composeKey(entries, plan, shaOf) {
  const clips = [...entries].sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0));
  const sources = Object.fromEntries([...new Set(clips.map(c => c.src))].sort().map(s => [s, shaOf(s)]));
  return crypto.createHash('sha256').update(JSON.stringify(canon({version: SCREEN_EDIT_VERSION, fps: plan.fps, w: plan.w, h: plan.h, audio: plan.audio, clips, sources}))).digest('hex');
}
export function edlDir(root, cutFile) {
  if (cutFile) { const rel = posix(path.relative(root, path.resolve(cutFile))).split('/'); if (rel[0] === 'exports' && rel.length > 2) return path.join(root, 'exports', rel[1], 'screens', 'edl'); }
  return path.join(root, 'exports', 'screen-edl', 'screens', 'edl');
}
function findComposed(root, dir, name) {
  if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  const ex = path.join(root, 'exports');
  for (const d of fs.existsSync(ex) ? fs.readdirSync(ex) : []) { const p = path.join(ex, d, 'screens', 'edl', name); if (fs.existsSync(p)) return p; }
  return null;
}
export function composeTrack(plan, out, {root = ROOT} = {}) {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  const tmp = out.replace(/\.mp4$/, '.part.mp4'), r = spawnSync('ffmpeg', ffmpegArgs(plan, tmp, {root}), {encoding: 'utf8', maxBuffer: 1 << 26});
  if (r.status !== 0) { fs.rmSync(tmp, {force: true}); throw Error(`ffmpeg failed composing ${path.basename(out)}: ${(r.stderr || r.error?.message || '').slice(-1500)}`); }
  fs.renameSync(tmp, out); return out;
}
function describe(plan) {
  return plan.clips.map(c => `  clip ${c.k + 1}: ${fmt(c.start)}-${fmt(c.end)} s  ${path.basename(c.src)} @ ${fmt(c.offset)} s x${c.rate}  in: ${c.transition}${c.xIn ? ' ' + fmt(c.xIn / plan.fps) + ' s' : c.dipIn ? ` ${fmt((c.dipIn + (plan.clips[c.k - 1]?.dipOut || 0)) / plan.fps)} s ${c.dipInColor}` : ''}`);
}

// shot -> shot whose edit-list tracks play their composed mp4 (one entry per contiguous run). No edit list: the same object.
export async function applyScreenEdits(shot, {root = ROOT, cutFile = null, outDir = null, dry = false, log = console.log} = {}) {
  const tracks = editTracks(shot);
  if (!tracks.length) return shot;
  const dir = outDir ? path.resolve(root, outDir) : edlDir(root, cutFile), list = shot.screens, replace = new Map(), drop = new Set(), results = [];
  for (const t of tracks) {
    const first = [...t.entries].sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0))[0], slug = trackSlug(first);
    const label = `${shot.id || 'shot'} ${slug}`;
    const plan = planTrack(t.entries, {seconds: shot.seconds, label, info: src => { const f = srcFile(root, src); if (!fs.existsSync(f)) throw Error(`${label}: source missing: ${src}`); return probe(f); }});
    const key = composeKey(t.entries, plan, src => sha256(srcFile(root, src))), name = `${shot.id || 'shot'}-${slug}-${key.slice(0, 12)}.mp4`;
    let file = findComposed(root, dir, name), made = false;
    log(`[screen-edit] ${label}: ${plan.clips.length} clips, ${plan.runs.length} run(s), ${plan.w}x${plan.h} @ ${plan.fps}${plan.audio ? ' +audio' : ''} -> ${name}${file ? ' (cached)' : dry ? ' (dry run)' : ''}`);
    for (const l of describe(plan)) log('[screen-edit]' + l);
    for (const l of plan.report) log('[screen-edit] REPORT ' + l);
    if (!file && !dry) {
      const t0 = Date.now(); file = composeTrack(plan, path.join(dir, name), {root}); made = true;
      fs.writeFileSync(file.replace(/\.mp4$/, '.json'), JSON.stringify({version: SCREEN_EDIT_VERSION, shot: shot.id, track: slug, key, at: new Date().toISOString(), report: plan.report,
        plan: {...plan, clips: plan.clips.map(({duration, audio, ...c}) => c)}, entries: t.entries}, null, 1));
      log(`[screen-edit] ${label}: composed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    const rel = file ? posix(path.relative(root, file)) : posix(path.relative(root, path.join(dir, name)));
    const base = {...first}; for (const f of EDIT_FIELDS) delete base[f];
    for (const f of TRACK_FIELDS) if (first[f] !== undefined) base[f] = first[f];
    const runs = plan.runs.map(r => ({...base, src: rel, start: r.start, end: r.end, offset: r3(r.start - plan.start), rate: 1, loop: false}));
    replace.set(Math.min(...t.indices), runs); for (const i of t.indices) drop.add(i);
    results.push({track: slug, file: rel, key, made, report: plan.report, runs: runs.length});
  }
  const screens = [];
  list.forEach((sc, i) => { if (replace.has(i)) screens.push(...replace.get(i)); else if (!drop.has(i)) screens.push(sc); });
  const next = {...shot, screens};
  Object.defineProperty(next, '__screenEdits', {value: results, enumerable: false});
  return next;
}

// ---- source bin ----------------------------------------------------------------------------------------------------------------
export function sourceBin(root = ROOT) {
  const out = [], add = (group, rel) => { try { const i = probe(path.join(root, rel)); out.push({src: posix(rel), group, seconds: r3(i.duration), w: i.w, h: i.h, fps: r3(i.fps), audio: i.audio}); } catch { /* unreadable: not offered */ } };
  const ls = (dir, re) => { const d = path.join(root, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => dir + '/' + f) : []; };
  for (const f of ls('app-reference/assets/desk_viewer/media', /\.mp4$/i)) add('movie', f);
  for (const f of ls('app-reference/demo_media', /\.mp4$/i)) add('demo', f);
  const ex = path.join(root, 'exports');
  for (const d of fs.existsSync(ex) ? fs.readdirSync(ex).sort() : []) for (const f of ls(`exports/${d}/screens`, /^(?!.*\.part\.mp4$).*\.mp4$/i)) add('captures', f);
  for (const f of ls('divi-editor/upload-to-promo', /\.mp4$/i)) add('promo', f);
  for (const f of ls('assets/led/game', /\.mp4$/i)) add('game', f);
  return out;
}

// ---- CLI ---------------------------------------------------------------------------------------------------------------------
async function main(argv) {
  if (argv[0] === '--bin') {
    const bin = sourceBin(ROOT), dir = argv[1] ? path.resolve(argv[1]) : null;
    const doc = {version: SCREEN_EDIT_VERSION, at: new Date().toISOString(), sources: bin,
      missing: ['the full movie (only app-reference/assets/desk_viewer/media/ambient-clip.mp4, 100 s, exists)', 'game-montage.py source reels (smb-nes, mario, smk-snes, kart, sf2-snes, sf6, doom-1993, fps .mp4)']};
    if (dir) { const f = path.join(dir, 'director-film', 'screen-bin.json'); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, JSON.stringify(doc, null, 1)); console.error(`wrote ${posix(path.relative(ROOT, f))} (${bin.length} sources)`); }
    console.log(JSON.stringify(doc, null, 1)); return;
  }
  const dry = argv.includes('--dry'), oi = argv.indexOf('--out'), outDir = oi >= 0 ? argv[oi + 1] : null;
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(oi >= 0 && i === oi + 1));
  if (pos.length < 2) { console.error('usage: compose-screen-edit.mjs <cut dir | cut.json> <chapter id | index> [--dry] [--out dir]\n       compose-screen-edit.mjs --bin [<cut dir>]'); process.exit(2); }
  let cutFile = path.resolve(pos[0]); if (fs.statSync(cutFile).isDirectory()) cutFile = path.join(cutFile, 'review-cut.json');
  const cut = JSON.parse(fs.readFileSync(cutFile, 'utf8')), shots = cut.shots || [cut];
  const shot = /^\d+$/.test(pos[1]) ? shots[Number(pos[1])] : shots.find(s => s.id === pos[1]);
  if (!shot) { console.error(`no chapter ${pos[1]} in ${cutFile}`); process.exit(2); }
  if (!hasEditList(shot)) { console.log(`${shot.id}: no edit list (no screens clip has transitionIn): the chapter renders its screens as before`); return; }
  const next = await applyScreenEdits(shot, {cutFile, outDir, dry});
  console.log(JSON.stringify({chapter: shot.id, tracks: next.__screenEdits, screens: next.screens}, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(e => { console.error(e.message || e); process.exit(1); });
