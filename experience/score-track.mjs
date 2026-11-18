// The Director's Sound layer (plan rev 3, P2, 17 Nov 2026): the film cut's score, where it plays and how it lines up.
//   Data (tools/experience/build-score-preview.py, next to the cut's score): score/tempo-map.json (sections, beats,
// bars, movement sounds `sfx`, hits, picture sync, every chapter's `start`), score/peaks.json (the waveform),
// score/inputs.json (what the score was built for), score/preview/<chapter>.opus (what plays).
//   Time: film seconds = tempo-map chapters[<id>].start + chapter seconds (by chapter id, never by index).
//   Playback follows the Director's playhead: started on play at the playhead, stopped on pause, restarted on a seek
// or a loop, and re-synced when it drifts more than 40 ms; a seek while paused plays a 70 ms grain (scrubbing).
// The pure helpers (chapterScore, staleness, snapTimes) are tested in node; createScorePlayer needs Web Audio.
export const DRIFT = .04, GRAIN = .07;

// The chapter's score in chapter seconds. tempo: tempo-map.json; peaks: peaks.json (or null); inputs: inputs.json (or null).
export function chapterScore(tempo, id, { peaks = null, inputs = null } = {}) {
  const ch = tempo?.chapters?.[id]; if (!ch) return null;
  const start = ch.start, seconds = inputs?.chapters?.[id]?.seconds ?? null, end = seconds === null ? Infinity : seconds;
  const rel = t => Math.round((t - start) * 1e4) / 1e4, inside = (t, pad = 0) => t >= -pad && t <= end + pad;
  const sections = (tempo.sections || []).filter(s => s.chapter === id || (rel(s.t1) > 0 && rel(s.t0) < end)).map(s => ({ name: s.name, t0: rel(s.t0), t1: rel(s.t1), bpm: s.bpm ?? null, chords: s.chords || null }));
  const beats = (ch.beats_rel || []).map(t => ({ t })), bars = ch.bars_rel || [];
  // beat numbers from the film's beat list (bar lines are beat 1)
  const numbered = (tempo.beats || []).map(b => ({ t: rel(b.t), beat: b.beat, of: b.bar_beats })).filter(b => inside(b.t, .01));
  const sfx = (tempo.sfx || []).map(([t, dur, kind]) => ({ t: rel(t), dur, kind })).filter(s => s.t + s.dur > 0 && s.t < end);
  const hits = Object.entries(tempo.hits || {}).map(([name, t]) => ({ name, t: rel(t) })).filter(h => inside(h.t));
  const sync = (tempo.picture_sync || []).map(p => ({ t: rel(p.t), kind: p.kind, off: p.off_beats, knot: !!p.knot })).filter(p => inside(p.t));
  const w = inputs?.chapters?.[id], pk = peaks?.chapters?.[id];
  return {
    id, start, seconds, bpm: ch.bpm ?? null, musicFrom: ch.music_from ?? null,
    sections, beats: numbered.length ? numbered : beats, bars, sfx, hits, sync,
    head: w?.head || null, tail: w?.tail || null,
    peaks: pk ? { t0: rel(pk.t0), t1: rel(pk.t1), rate: peaks.rate || 200, min: pk.min, max: pk.max, rms: pk.rms, clip: pk.clip } : null,
  };
}
// What changed since the score was built, for this chapter (null: in step). live: { seconds }.
export function staleness(inputs, id, live) {
  const w = inputs?.chapters?.[id]; if (!w || !live) return null;
  if (Math.abs((live.seconds ?? w.seconds) - w.seconds) > .01) return `${id[0].toUpperCase() + id.slice(1)} is ${live.seconds} s; the score was built for ${w.seconds} s · it is rebuilt at render`;
  return null;
}
// Snap targets for the timeline: 'beat' or 'bar' (chapter seconds), else [].
export function snapTimes(model, kind) {
  if (!model) return [];
  if (kind === 'bar') return model.bars.slice();
  if (kind === 'beat') return model.beats.map(b => b.t);
  return [];
}
// The nearest of `times` to t within `tol` seconds, else t.
export function snapTo(t, times, tol) { let best = t, d = tol; for (const x of times) { const e = Math.abs(x - t); if (e <= d) { d = e; best = x; } } return best; }
// The waveform's peaks between chapter seconds a and b, folded to `columns` (log-scaled 0..1 heights).
export function waveColumns(p, a, b, columns) {
  if (!p) return [];
  const out = [], per = (b - a) / columns, at = t => Math.round((t - p.t0) * p.rate), log = v => v <= 0 ? 0 : Math.max(0, 1 + Math.log10(v / 127) / 2.4);
  for (let c = 0; c < columns; c++) {
    const i0 = Math.max(0, at(a + c * per)), i1 = Math.min(p.max.length, Math.max(i0 + 1, at(a + (c + 1) * per)));
    let hi = 0, rms = 0, n = 0; for (let i = i0; i < i1; i++) { hi = Math.max(hi, Math.abs(p.max[i]), Math.abs(p.min[i])); rms += p.rms[i] * p.rms[i]; n++; }
    out.push(n ? { peak: log(hi), rms: log(Math.sqrt(rms / n)) } : { peak: 0, rms: 0 });
  }
  return out;
}

// ---- playback ------------------------------------------------------------------------------------------------
// base: the cut's folder URL ('/exports/<cut>'); clipOf(id) -> 'score/preview/<id>.opus'. All times chapter seconds.
export function createScorePlayer({ base, AudioContextClass = globalThis.AudioContext }) {
  let ctx = null, gain = null, analyser = null, buffer = null, bufferFor = null, loading = null, source = null, startedAt = 0, offset = 0, t0 = 0, volume = .8, muted = false, rate = 1;
  const level = () => muted ? 0 : volume;
  function context() {
    if (!ctx) { ctx = new AudioContextClass(); gain = ctx.createGain(); gain.gain.value = level(); gain.connect(ctx.destination); }
    return ctx;
  }
  async function load(model) {
    const clip = model?.peaks?.clip; if (!clip) return false;
    if (bufferFor === model.id && buffer) return true;
    loading = (async () => { const c = context(), r = await fetch(`${base}/score/${clip}`); if (!r.ok) throw Error('The score preview is missing: run tools/experience/build-score-preview.py on this cut.'); buffer = await c.decodeAudioData(await r.arrayBuffer()); bufferFor = model.id; t0 = model.peaks.t0; return true; })();
    try { return await loading; } finally { loading = null; }
  }
  function stop() { try { source?.stop(); } catch {} source = null; }
  // play from chapter second t (for `dur` seconds, or to the end)
  function play(t, dur = null) {
    if (!buffer) return; const c = context(); c.resume?.(); stop();
    const at = Math.max(0, t - t0); if (at >= buffer.duration) return;
    source = c.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate; source.connect(gain);
    if (dur) { const g = c.createGain(); source.disconnect(); source.connect(g); g.connect(gain); g.gain.setValueAtTime(1, c.currentTime); g.gain.linearRampToValueAtTime(0, c.currentTime + dur); }
    source.start(0, at, dur || undefined); startedAt = c.currentTime; offset = t;
  }
  // where the score is now (chapter seconds), or null when it is not playing
  const position = () => source && ctx ? offset + (ctx.currentTime - startedAt) * rate : null;
  return {
    load, stop, play, position, playing: () => !!source,
    grain: t => play(t, GRAIN),
    // keep in step with the playhead: restart when off by more than DRIFT
    follow(t) { const p = position(); if (p === null || Math.abs(p - t) > DRIFT) play(t); },
    setRate(r) { const p = position(); rate = r > 0 ? r : 1; if (p !== null) play(p); },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (gain) gain.gain.value = level(); },
    volume: () => volume,
    // the lane's mute (Premiere's M): silent, the volume kept for unmuting; it keeps playing so unmuting is instant
    setMuted(m) { muted = !!m; if (gain) gain.gain.value = level(); },
    muted: () => muted,
    meter() {   // the level now, 0..1 (peak of the last few ms), for the lane header's meter
      if (!ctx || !source) return 0;
      if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 512; gain.connect(analyser); }
      const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m;
    },
    loaded: id => bufferFor === id && !!buffer,
  };
}
