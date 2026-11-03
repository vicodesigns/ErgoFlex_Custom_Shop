#!/usr/bin/env python3
"""Per-frame spectrum of the film score for one chapter, for the music visualiser.
usage: audio-bands.py score.wav start_seconds duration fps bands > out.json
Output: {"fps":30,"bands":[[...per frame 0..1...]],"rms":[...],"low":[...]}"""
import sys, json, subprocess
import numpy as np
wav, start, dur, fps, nb = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
sr = 48000
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(max(0, start - 0.1)), '-t', str(dur + 0.3), '-i', wav, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
pre = int(min(start, 0.1) * sr)
N = 4096
win = np.hanning(N)
freqs = np.fft.rfftfreq(N, 1 / sr)
edges = np.geomspace(60, 12000, nb + 1)
frames = int(round(dur * fps))
bands, rms, low = [], [], []
for i in range(frames):
    c = pre + int(i / fps * sr)
    seg = x[max(0, c - N // 2): c + N // 2]
    if len(seg) < N: seg = np.pad(seg, (0, N - len(seg)))
    spec = np.abs(np.fft.rfft(seg * win)) / N
    b = [float(spec[(freqs >= edges[k]) & (freqs < edges[k + 1])].mean() if np.any((freqs >= edges[k]) & (freqs < edges[k + 1])) else 0) for k in range(nb)]
    bands.append(b)
    rms.append(float(np.sqrt(np.mean(seg[N // 4: 3 * N // 4] ** 2))))
    low.append(float(spec[(freqs > 35) & (freqs < 140)].mean()))
B = 20 * np.log10(np.array(bands) + 1e-9)
# per-band normalisation to 0..1 over the chapter (robust percentiles), slight tilt so highs show
lo, hi = np.percentile(B, 8, axis=0), np.percentile(B, 99.5, axis=0)
Bn = np.clip((B - lo) / np.maximum(hi - lo, 1e-6), 0, 1)
r = np.array(rms); r = np.clip(r / np.percentile(r, 99.5), 0, 1)
l = np.array(low); l = np.clip((l - np.percentile(l, 10)) / max(np.percentile(l, 99.5) - np.percentile(l, 10), 1e-9), 0, 1)
json.dump({'fps': fps, 'bands': np.round(Bn, 3).tolist(), 'rms': np.round(r, 3).tolist(), 'low': np.round(l, 3).tolist()}, sys.stdout)
