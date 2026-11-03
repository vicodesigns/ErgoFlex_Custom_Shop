#!/usr/bin/env python3
"""ErgoFlex intro film: original score, synthesized from scratch (numpy + ffmpeg).

    python3 tools/experience/score-synth.py exports/cinematic-intro-20261030/edl.json \
        exports/cinematic-intro-20261030/score/score.wav [--no-extras] [--seed N]

Everything is derived from the EDL on every run:
  * The tempo map is built so that title B, every dissolve centre and the end-card
    beat land exactly on a bar line (or, where a whole bar would bend the tempo by
    more than ~2.5 %, on a half bar: a 2/4 turnaround just before the transition).
    The nominal BPM is searched for the smallest tempo deviation.
  * Each chapter between two dissolve centres gets its own arrangement style
    (keyed by chapter id, falling back to a generic groove for unknown ids).
  * The logo hit lands on the end-card beat and the tail rings out to silence by edl.total.

Output: 48 kHz / 24-bit stereo WAV, exactly edl.total seconds, mastered to -16 LUFS
integrated with true peak <= -1.5 dBTP (own BS.1770 meter + 4x oversampled limiter,
verified with ffmpeg ebur128). Unless --no-extras is given it also writes, next to the
WAV: CUE-SHEET.md, score-analysis.json, score-spectrogram.png and score-waveform.png.

Sources: oscillators are PolyBLEP saws (band-limited) and additive sine partials, noise is
FFT-shaped. No samples or recordings of any kind are used.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import wave

import numpy as np

SR = 48000
TAU = 2 * np.pi


# ---------------------------------------------------------------------------
# basic helpers
# ---------------------------------------------------------------------------

def mtof(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def db(x):
    return 20 * math.log10(max(x, 1e-12))


def undb(d):
    return 10 ** (d / 20.0)


def fade_in(n):
    if n <= 0:
        return np.zeros(0)
    return 0.5 - 0.5 * np.cos(np.pi * (np.arange(n) + 0.5) / n)


def fade_out(n):
    return fade_in(n)[::-1]


def env_note(n_hold, n_rel, att, dec=None, sus=1.0, rel_shape='cos'):
    """Hold segment (attack + optional exponential decay to sus) then a release to 0.
    All segments are smooth and end exactly at zero, so notes never click."""
    n = n_hold + n_rel
    e = np.ones(n)
    a = int(max(1, min(att, n_hold if n_hold > 0 else n)))
    e[:a] = fade_in(a)
    if dec:
        t = np.arange(n - a)
        e[a:] = sus + (1 - sus) * np.exp(-t / dec)
    if n_rel > 0:
        lvl = e[n_hold - 1] if n_hold > 0 else 1.0
        u = (np.arange(n_rel) + 0.5) / n_rel
        if rel_shape == 'cos':
            r = 0.5 + 0.5 * np.cos(np.pi * u)
        else:  # long, exponential-feeling release that still ends at exactly 0
            r = (1 - u) ** 2.2
        e[n_hold:] = lvl * r
    e[-1] = 0.0
    return e


def blep_saw(freq, n, phase0=0.0):
    """Band-limited sawtooth (2-point PolyBLEP). freq: scalar or per-sample array (Hz)."""
    dt = np.broadcast_to(np.asarray(freq, dtype=np.float64) / SR, (n,)).copy()
    ph = (phase0 + np.cumsum(dt) - dt[0]) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1.0
    m = ph > 1.0 - dt
    x = (ph[m] - 1.0) / dt[m]
    y[m] -= x * x + x + x + 1.0
    return y


def shaped_noise(n, rng, lo, hi, slope_lo=2, slope_hi=3):
    """White noise band-limited in the frequency domain (smooth Butterworth-like skirts)."""
    nfft = max(256, int(2 ** math.ceil(math.log2(n + 1))))
    X = np.fft.rfft(rng.standard_normal(nfft))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    f[0] = 1e-3
    G = np.ones_like(f)
    if lo:
        G /= np.sqrt(1 + (lo / f) ** (2 * slope_lo))
    if hi:
        G /= np.sqrt(1 + (f / hi) ** (2 * slope_hi))
    G[0] = 0
    y = np.fft.irfft(X * G, nfft)[:n]
    return y / (np.std(y) + 1e-12)


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    nfft = int(2 ** math.ceil(math.log2(n)))
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:n]
    return y


def stft_filter(x, gain_fn, frame=2048, hop=512, t_offset=0.0):
    """Time-varying zero-phase filter: Hann-windowed STFT, per-frame magnitude gain
    gain_fn(frame_centre_times[s], freqs[Hz]) -> (frames, bins), 75 % overlap-add.
    Smooth parameter curves + heavy overlap = no zipper noise."""
    n = len(x)
    pad = frame
    xp = np.concatenate([np.zeros(pad), x, np.zeros(pad + frame)])
    nblk = len(xp) // hop
    xp = xp[:nblk * hop]
    w = np.sqrt(0.5 - 0.5 * np.cos(TAU * np.arange(frame) / frame))  # sqrt periodic Hann
    sub = frame // hop
    nfr = nblk - sub + 1
    out = np.zeros((nblk, hop))
    freqs = np.fft.rfftfreq(frame, 1 / SR)
    ar = np.arange(frame)
    for c0 in range(0, nfr, 1024):
        idx = np.arange(c0, min(nfr, c0 + 1024))
        st = idx * hop
        fr = xp[st[:, None] + ar] * w
        S = np.fft.rfft(fr, axis=1)
        tc = (st + frame / 2 - pad) / SR + t_offset
        S *= gain_fn(tc, freqs)
        y = (np.fft.irfft(S, n=frame, axis=1) * w).reshape(len(idx), sub, hop)
        for j in range(sub):
            out[idx + j] += y[:, j, :]
    out = out.reshape(-1) / 2.0  # sum of periodic Hann at 75 % overlap == 2
    return out[pad:pad + n]


def lp_gain(f, fc, q=0.8, order3=True):
    r = f / fc
    g = 1 / np.sqrt((1 - r * r) ** 2 + (r / q) ** 2)
    if order3:
        g = g / np.sqrt(1 + r * r)
    return g


def hp_gain(f, fc):
    r = fc / np.maximum(f, 1e-3)
    return 1 / np.sqrt(1 + r ** 4)


def pan_gains(p):
    """Constant-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return math.cos(a), math.sin(a)


# ---------------------------------------------------------------------------
# instruments
# ---------------------------------------------------------------------------

class Synth:
    def __init__(self, rng):
        self.rng = rng
        self.cache = {}

    # Lush detuned pad: 4 PolyBLEP saws per note (+/- cents, spread L/R) + a sine body.
    def pad_note(self, midi, hold_s, rel_s, att_s, spread=0.65):
        rng = self.rng
        f = mtof(midi)
        nh, nr = int(hold_s * SR), int(rel_s * SR)
        n = nh + nr
        t = np.arange(n) / SR
        L = np.zeros(n)
        R = np.zeros(n)
        for cents, p in ((-11, -spread), (-4, spread * 0.35), (3.5, -spread * 0.35), (10, spread)):
            rate = 0.07 + 0.11 * rng.random()
            drift = 1 + (2 ** (2.2 / 1200) - 1) * np.sin(TAU * rate * t + TAU * rng.random())
            v = blep_saw(f * 2 ** (cents / 1200) * drift, n, rng.random()) * 0.25
            gl, gr = pan_gains(p)
            L += gl * v
            R += gr * v
        body = 0.2 * np.sin(TAU * f * t + TAU * rng.random())
        L += body * 0.7071
        R += body * 0.7071
        e = env_note(nh, nr, int(att_s * SR), rel_shape='cos' if rel_s < 2.5 else 'exp')
        return L * e, R * e

    # Soft "digital" pluck for the arpeggio: additive, odd-leaning harmonics,
    # high partials decay faster (natural filter envelope), capped at 7 kHz.
    def pluck(self, midi, bright):
        bright = round(float(bright) * 20) / 20
        key = ('pluck', midi, bright)
        if key in self.cache:
            return self.cache[key]
        f = mtof(midi)
        n = int(0.85 * SR)
        t = np.arange(n) / SR
        K = int(min(20, 7000 / f))
        y = np.zeros(n)
        for k in range(1, K + 1):
            amp = (1.0 / k) * (1.0 if k % 2 else 0.5)
            dec = 5.0 + (k - 1) * (2.0 + 10.0 * (1.0 - bright))
            y += amp * np.exp(-t * dec) * np.sin(TAU * k * f * t + (0.3 * k))
        y *= np.concatenate([fade_in(int(0.002 * SR)), np.ones(n - int(0.002 * SR))])
        y *= np.concatenate([np.ones(n - int(0.06 * SR)), fade_out(int(0.06 * SR))])
        y /= np.max(np.abs(y))
        self.cache[key] = y
        return y

    # Bells / keys: additive partial sets.
    BELLS = {
        'glass': [(1, 1.0, 1.1), (2.0, 0.28, 2.0), (3.0, 0.10, 3.4), (4.16, 0.07, 5.0), (5.43, 0.035, 7.5)],
        'celesta': [(1, 1.0, 1.7), (2.0, 0.18, 3.0), (3.0, 0.06, 6.0), (4.0, 0.035, 8.0)],
        'rhodes': [(1, 1.0, 0.9), (2.0, 0.22, 2.4), (3.0, 0.05, 4.0), (7.0, 0.035, 14.0)],
        'shimmer': [(1, 1.0, 0.35), (2.0, 0.2, 0.7), (3.01, 0.06, 1.2), (4.2, 0.04, 2.0)],
    }

    def bell(self, midi, kind='glass', length=2.6):
        key = ('bell', midi, kind, length)
        if key in self.cache:
            return self.cache[key]
        f = mtof(midi)
        n = int(length * SR)
        t = np.arange(n) / SR
        y = np.zeros(n)
        for i, (ratio, amp, dec) in enumerate(self.BELLS[kind]):
            if ratio * f > 9000:
                continue
            y += amp * np.exp(-t * dec) * np.sin(TAU * ratio * f * t + 0.7 * i)
        if kind == 'rhodes':
            y *= 1 + 0.08 * np.sin(TAU * 4.6 * t)
        att = int((0.004 if kind != 'shimmer' else 0.03) * SR)
        y[:att] *= fade_in(att)
        y[-int(0.08 * SR):] *= fade_out(int(0.08 * SR))
        y /= np.max(np.abs(y))
        self.cache[key] = y
        return y

    # Warm bass: sine + a little 2nd/3rd harmonic so it reads on small speakers.
    def bass(self, midi, hold_s, att_s=0.012, rel_s=0.09, dec=None, sus=1.0):
        f = mtof(midi)
        nh, nr = int(hold_s * SR), int(rel_s * SR)
        n = nh + nr
        t = np.arange(n) / SR
        y = np.sin(TAU * f * t) + 0.22 * np.sin(TAU * 2 * f * t + 0.4) + 0.07 * np.sin(TAU * 3 * f * t + 1.1)
        y = np.tanh(1.3 * y) / np.tanh(1.3)
        e = env_note(nh, nr, int(att_s * SR), dec=None if dec is None else dec * SR, sus=sus)
        return y * e

    # Felt kick: sine with pitch sweep, soft transient.
    def kick(self, var=0, weight=1.0):
        key = ('kick', var, weight)
        if key in self.cache:
            return self.cache[key]
        rng = np.random.default_rng(100 + var)
        n = int(0.62 * SR)
        t = np.arange(n) / SR
        f = 50 + 88 * np.exp(-t / 0.026) + 12 * np.exp(-t / 0.18)
        body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / (0.26 * weight))
        click = shaped_noise(n, rng, 900, 3500) * np.exp(-t / 0.0035) * 0.05
        y = np.tanh(1.4 * (body + click)) / np.tanh(1.4)
        y[:int(0.0015 * SR)] *= fade_in(int(0.0015 * SR))
        y[-int(0.08 * SR):] *= fade_out(int(0.08 * SR))
        self.cache[key] = y
        return y

    def clap(self, var=0):
        key = ('clap', var)
        if key in self.cache:
            return self.cache[key]
        rng = np.random.default_rng(200 + var)
        n = int(0.42 * SR)
        t = np.arange(n) / SR
        nz = shaped_noise(n, rng, 900, 5200, 2, 3)
        e = np.zeros(n)
        for k, d in enumerate((0.0, 0.009, 0.019)):
            m = t >= d
            e[m] += (0.7 + 0.15 * k) * np.exp(-(t[m] - d) / 0.0055)
        m = t >= 0.022
        e[m] += 0.55 * np.exp(-(t[m] - 0.022) / 0.13)
        body = 0.25 * np.sin(TAU * 196 * t) * np.exp(-t / 0.04)
        y = nz * e * 0.5 + body
        y[:int(0.001 * SR)] *= fade_in(int(0.001 * SR))
        y[-int(0.06 * SR):] *= fade_out(int(0.06 * SR))
        y /= np.max(np.abs(y))
        self.cache[key] = y
        return y

    def hat(self, var=0, kind='hat'):
        key = (kind, var)
        if key in self.cache:
            return self.cache[key]
        rng = np.random.default_rng(300 + var)
        if kind == 'hat':
            n = int(0.11 * SR)
            t = np.arange(n) / SR
            y = shaped_noise(n, rng, 6500, 10500, 3, 4) * np.exp(-t / 0.022)
            a = int(0.0008 * SR)
        else:  # shaker: softer attack, band a little lower
            n = int(0.14 * SR)
            t = np.arange(n) / SR
            y = shaped_noise(n, rng, 4200, 9500, 2, 4) * np.exp(-t / 0.045)
            a = int(0.009 * SR)
        y[:a] *= fade_in(a)
        y[-int(0.03 * SR):] *= fade_out(int(0.03 * SR))
        y /= np.max(np.abs(y))
        self.cache[key] = y
        return y

    def tick(self, midi=93):
        key = ('tick', midi)
        if key in self.cache:
            return self.cache[key]
        f = mtof(midi)
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        y = np.sin(TAU * f * t) * np.exp(-t / 0.07) + 0.15 * np.sin(TAU * 2.0 * f * t) * np.exp(-t / 0.02)
        y[:int(0.002 * SR)] *= fade_in(int(0.002 * SR))
        y[-int(0.05 * SR):] *= fade_out(int(0.05 * SR))
        self.cache[key] = y / np.max(np.abs(y))
        return self.cache[key]

    def boom(self, length=2.5, f0=64, f1=40, tau=0.9):
        """Soft cinematic impact: gliding sub sine + lowpassed air burst."""
        rng = self.rng
        n = int(length * SR)
        t = np.arange(n) / SR
        f = f1 + (f0 - f1) * np.exp(-t / 0.12)
        y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / tau)
        air = shaped_noise(n, rng, 70, 700, 2, 2) * np.exp(-t / 0.22) * 0.18
        y = y + air
        y[:int(0.004 * SR)] *= fade_in(int(0.004 * SR))
        y *= np.concatenate([np.ones(n - int(0.4 * SR)), fade_out(int(0.4 * SR))])
        return y / np.max(np.abs(y))

    def whoosh(self, pre, post, f_lo=280, f_hi=3200, pan_from=-0.5, pan_to=0.5, curve=2.4):
        """Filtered-noise swell peaking at `pre` seconds; sweeping band-pass + pan move."""
        rng = self.rng
        n = int((pre + post) * SR)
        t = np.arange(n) / SR
        c = shaped_noise(n, rng, 120, 9000)
        nl = 0.6 * c + 0.8 * shaped_noise(n, rng, 120, 9000)
        nr = 0.6 * c + 0.8 * shaped_noise(n, rng, 120, 9000)

        def centre(tt):
            u = np.clip(tt / pre, 0, 1)
            up = f_lo * (f_hi / f_lo) ** (u ** 1.4)
            d = np.clip((tt - pre) / max(post, 1e-3), 0, 1)
            return np.where(tt <= pre, up, f_hi * (f_lo / f_hi) ** (d ** 0.6))

        def gain_fn(tc, freqs):
            fc = centre(tc)[:, None]
            r = np.log2(np.maximum(freqs[None, :], 1) / fc)
            return np.exp(-0.5 * (r / 0.9) ** 2)

        nl = stft_filter(nl, gain_fn)
        nr = stft_filter(nr, gain_fn)
        u = np.clip(t / pre, 0, 1)
        e = np.where(t <= pre, u ** curve, np.exp(-(t - pre) / (post / 3.5)))
        e[-int(0.1 * SR):] *= fade_out(int(0.1 * SR))
        pan = pan_from + (pan_to - pan_from) * np.clip(t / (pre + post), 0, 1)
        a = (pan + 1) * np.pi / 4
        L = nl * e * np.cos(a)
        R = nr * e * np.sin(a)
        m = max(np.max(np.abs(L)), np.max(np.abs(R)))
        return L / m, R / m

    def reverse_bell(self, midis, length, kind='glass'):
        """Reversed bell chord swelling into a downbeat (ends at full level with a 25 ms
        fade so the cut is click-free; the downbeat masks the stop)."""
        n = int(length * SR)
        y = np.zeros(n)
        for m in midis:
            b = self.bell(m, kind, length=max(3.0, length))[:n]
            y[:len(b)] += b
        y = y[::-1].copy()
        y[:int(0.2 * SR)] *= fade_in(int(0.2 * SR))
        y[-int(0.025 * SR):] *= fade_out(int(0.025 * SR))
        return y / np.max(np.abs(y))


# ---------------------------------------------------------------------------
# harmony
# ---------------------------------------------------------------------------

# pad voicing (MIDI), bass root (MIDI, range A1..G2: keeps the sub gentle)
CHORDS = {
    'Dmaj9':    ([50, 57, 61, 64, 66], 38),
    'Dadd9':    ([50, 57, 62, 64, 66], 38),
    'D/F#':     ([54, 57, 62, 64, 69], 42),
    'A/C#':     ([52, 57, 61, 64, 69], 37),
    'Bm9':      ([50, 54, 57, 61, 66], 35),
    'Gmaj9':    ([50, 59, 62, 66, 69], 43),
    'Gmaj7#11': ([50, 59, 61, 66, 69], 43),
    'Asus4':    ([52, 57, 62, 64, 69], 33),
    'A':        ([52, 57, 61, 64, 69], 33),
    'A6':       ([52, 57, 61, 66, 69], 33),
    'Em9':      ([50, 55, 59, 62, 66], 40),
    'F#m7':     ([49, 54, 57, 61, 64], 42),
    'F#7sus4':  ([52, 59, 61, 64, 66], 42),
}


def arp_tones(chord, lo=62, hi=81):
    pcs = sorted(set(m % 12 for m in CHORDS[chord][0]) | {CHORDS[chord][1] % 12})
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]


def bell_tones(chord, lo=74, hi=90):
    return arp_tones(chord, lo, hi)


# ---------------------------------------------------------------------------
# arrangement styles (per chapter id)
# ---------------------------------------------------------------------------
# progression: list of (chord, bars); anchor 'start' cycles from the section start,
# 'end' places one cycle ending at the transition and fills earlier bars with the
# first chord. `turn`: chord for a short (2-beat) final bar.
# Patterns: 16 steps per 4/4 bar; X=1.0 x=0.75 o=0.45 .=rest

S = lambda **k: k  # noqa: E731

STYLES = {
    'wake': S(prog=[('Dmaj9', 2), ('Bm9', 2), ('Gmaj9', 1), ('Asus4', 1)], anchor='end',
              pad=0.80, cut=(900, 2300), arp='8', arp_lvl=0.55, bright=0.30, bass='sustain', bass_lvl=0.35,
              energy=0.35),
    'twin': S(prog=[('Dmaj9', 1), ('A/C#', 1), ('Bm9', 1), ('Gmaj9', 1)], turn='Asus4',
              pad=0.92, cut=2700, arp='16', arp_lvl=0.72, bright=0.45, bass='pulse8', bass_lvl=0.8,
              kick='x.......x.......', shaker='..o...o...o...o.', tickp='............o...',
              lead='twin', duck=0.12, energy=0.65),
    'rise': S(prog=[('Gmaj9', 1), ('D/F#', 1), ('Em9', 1), ('Asus4', 1)], turn='A',
              pad=0.86, cut=3000, arp='16', arp_lvl=0.70, bright=0.5, bass='pulse8', bass_lvl=0.85,
              kick='x.....x...x.....', clap='....o.......o...', shaker='o.o.o.o.o.o.o.o.',
              hat='..x...x...x...x.', duck=0.15, energy=0.72),
    'create': S(prog=[('Bm9', 1), ('Gmaj9', 1), ('Dmaj9', 1), ('A6', 1)], turn='A',
                pad=0.84, cut=2600, arp='8up', arp_lvl=0.62, bright=0.6, bass='sustain', bass_lvl=0.8,
                kick='x.......x.......', tickp='....o.......o..o', shaker='o.o.o.o.o.o.o.o.',
                lead='sparkle', duck=0.10, energy=0.62),
    'commons': S(prog=[('Dmaj9', 1), ('F#m7', 1), ('Gmaj9', 1), ('Asus4', 1)], turn='A',
                 pad=0.85, cut=3100, arp='16', arp_lvl=0.68, bright=0.52, bass='syncop', bass_lvl=0.85,
                 kick='x.....x.x.......', clap='....x.......x...', shaker='oxo.oxo.oxo.oxo.',
                 hat='..x...x...x...x.', duck=0.16, energy=0.75),
    'coast': S(prog=[('Em9', 1), ('Gmaj9', 1), ('D/F#', 1), ('Asus4', 1)], turn='A',
               pad=0.84, cut=3200, arp='syn', arp_lvl=0.72, bright=0.55, bass='pulse8', bass_lvl=0.85,
               kick='x...x...x...x...', clap='....o.......o...', hat='..x...x...x...x.',
               shaker='o.oxo.oxo.oxo.ox', duck=0.18, energy=0.8),
    'oilers': S(prog=[('Gmaj9', 1), ('A', 1), ('F#m7', 1), ('Bm9', 1)], turn='A',
                pad=0.86, cut=3400, arp='16', arp_lvl=0.70, bright=0.62, bass='pulse8', bass_lvl=0.85,
                kick='x...x...x...x...', clap='....x.......x...', hat='..x...x...x...x.',
                shaker='oxoxoxoxoxoxoxox', lead='sparkle', duck=0.18, energy=0.8),
    'wellness': S(prog=[('Gmaj7#11', 2), ('Dmaj9', 2), ('Em9', 2)], turn='F#7sus4',
                  pad=0.95, cut=(2000, 2400), arp='8', arp_lvl=0.45, bright=0.35, bass='sustain', bass_lvl=0.75,
                  kick='x...............', shaker='........o.......', breathe=True, duck=0.0, energy=0.5),
    'awareness': S(prog=[('Bm9', 1), ('Gmaj9', 1), ('Em9', 1), ('F#7sus4', 1)], anchor='end',
                   pad=0.78, cut=1500, arp='8', arp_lvl=0.40, bright=0.25, bass='sustain', bass_lvl=0.85,
                   kick='x.......x.......', tickp='x.....o...x.....', lead='sonar', duck=0.08, energy=0.5),
    'music': S(prog=[('Bm9', 1), ('Gmaj9', 1), ('Dmaj9', 1), ('A', 1)],
               pad=0.84, cut=3600, arp='16', arp_lvl=0.78, bright=0.72, bass='syncop16', bass_lvl=0.95,
               kick='x...x...x...x...', clap='....X.......X...', hat='..x...x...x...x.',
               shaker='oxoxoxoxoxoxoxox', swing=0.06, duck=0.30, energy=0.95),
    'media': S(prog=[('Em9', 1), ('F#m7', 1), ('Gmaj9', 1), ('Asus4', 1)],
               pad=0.80, cut=1700, arp='8', arp_lvl=0.50, bright=0.28, bass='sustain', bass_lvl=0.85,
               kick='x.......x.x.....', clap='....o.......o...', shaker='..o...o...o...o.',
               lead='rhodes', duck=0.12, energy=0.6),
    'storage': S(prog=[('Dmaj9', 1), ('D/F#', 1), ('Gmaj9', 1), ('A', 1), ('Bm9', 1), ('Gmaj9', 1),
                       ('Asus4', 1), ('A', 1)], anchor='end',
                 pad=0.86, cut=(2300, 3800), arp='16', arp_lvl=(0.6, 0.78), bright=0.6, bass='pulse8',
                 bass_lvl=0.9, kick='x...x...x...x...', clap='....x.......x...', hat='..x...x...x...x.',
                 shaker='oxoxoxoxoxoxoxox', duck=0.2, roll=True, energy=0.85),
    'hero': S(prog=[('D/F#', 1), ('Gmaj9', 1), ('Em9', 1), ('Asus4', 1), ('A', 1)], anchor='end',
              pad=1.0, cut=4000, arp='16', arp_lvl=0.62, bright=0.6, bass='sustain', bass_lvl=0.95,
              kick='x.......x.......', shaker='..o...o...o...o.', lead='hero', duck=0.1, breath_end=True,
              energy=0.9),
    # generic fallback for chapters added later
    'groove': S(prog=[('Dmaj9', 1), ('Bm9', 1), ('Gmaj9', 1), ('Asus4', 1)], turn='A',
                pad=0.85, cut=3000, arp='16', arp_lvl=0.68, bright=0.5, bass='pulse8', bass_lvl=0.85,
                kick='x.....x...x.....', clap='....o.......o...', shaker='o.o.o.o.o.o.o.o.', duck=0.15,
                energy=0.72),
}

# macro dynamics (dB on the whole mix, smoothed over the dissolve)
for _k, _v in dict(twin=0.0, rise=0.0, create=-1.0, commons=0.0, coast=0.5, oilers=0.5, wellness=-2.5,
                   awareness=-2.0, music=1.5, media=-2.0, storage=(-0.5, 1.0), hero=1.0, groove=0.0).items():
    STYLES[_k]['mixdb'] = _v

GROOVE_FALLBACK = ['rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'awareness', 'music',
                   'media', 'storage']

LEADS = {
    'twin': {
        'Dmaj9': [[(0, 81, 1.5, .8), (1.5, 78, .5, .6), (2, 81, 1, .7), (3, 83, 1, .6)],
                  [(0, 81, 1.5, .8), (1.5, 78, .5, .6), (2, 81, 1, .7), (3, 86, 1, .7)]],
        'A/C#': [[(0, 85, 2, .75), (2, 81, 2, .6)], [(0, 88, 2, .75), (2, 85, 2, .65)]],
        'Bm9': [[(0, 78, 2, .7), (2, 76, 1, .6), (3, 74, 1, .55)], [(0, 86, 2, .7), (2, 83, 1, .6), (3, 81, 1, .6)]],
        'Gmaj9': [[(0, 74, 3, .6)], [(0, 78, 4, .65)]],
        'Asus4': [[(0, 76, 2, .5)]],
    },
    'hero': {
        'D/F#': [[(0, 81, 2, .7), (2, 78, 2, .6)]],
        'Gmaj9': [[(0, 83, 2, .8), (2, 81, 1, .65), (3, 78, 1, .6)]],
        'Em9': [[(0, 79, 2, .7), (2, 78, 2, .65)]],
        'Asus4': [[(0, 76, 3, .7), (3, 74, 1, .5)]],
        'A': [[(0, 73, 2, .6)]],
    },
}


def parse_pattern(p):
    vals = {'X': 1.0, 'x': 0.75, 'o': 0.45, '.': 0.0}
    return [vals.get(c, 0.0) for c in p]


# ---------------------------------------------------------------------------
# tempo map + section plan from the EDL
# ---------------------------------------------------------------------------

class Grid:
    """Piecewise-linear beat<->time map; beat 0 = title B. Extrapolates at nominal tempo."""

    def __init__(self, ts, bs, beat_nom):
        self.ts = np.asarray(ts, float)
        self.bs = np.asarray(bs, float)
        self.beat = beat_nom

    def t(self, b):
        b = np.asarray(b, float)
        out = np.interp(b, self.bs, self.ts)
        out = np.where(b < self.bs[0], self.ts[0] + (b - self.bs[0]) * self.beat, out)
        out = np.where(b > self.bs[-1], self.ts[-1] + (b - self.bs[-1]) * self.beat, out)
        return out if out.ndim else float(out)

    def local_bpm(self, b):
        i = int(np.clip(np.searchsorted(self.bs, b, side='right') - 1, 0, len(self.bs) - 2))
        if b < self.bs[0] or b >= self.bs[-1]:
            return 60 / self.beat
        return 60 * (self.bs[i + 1] - self.bs[i]) / (self.ts[i + 1] - self.ts[i])


def find_beat(edl, pattern, default):
    for b in edl.get('beats', []):
        if re.search(pattern, b.get('what', ''), re.I):
            return float(b['at'])
    return default


def choose_tempo(anchors, lo=104, hi=124, pref=116):
    segs = np.diff(anchors)
    best = None
    for bpm in np.arange(lo, hi + 1e-9, 0.25):
        beat = 60 / bpm
        beats, devs, halves = [], [], 0
        for s in segs:
            nb = s / beat
            n4 = max(4, 4 * round(nb / 4))
            d4 = abs(s / (n4 * beat) - 1)
            n2 = max(2, 2 * round(nb / 2))
            d2 = abs(s / (n2 * beat) - 1)
            if d4 <= 0.025 or d4 <= d2:
                beats.append(n4)
                devs.append(d4)
            else:
                beats.append(n2)
                devs.append(d2)
                halves += 1
        devs = np.array(devs)
        score = devs.max() + 0.5 * np.sqrt(np.mean(devs ** 2)) + 0.0015 * halves + 0.0006 * abs(bpm - pref)
        if best is None or score < best[0]:
            best = (score, float(bpm), beats, devs)
    return best[1], best[2], best[3]


def build_plan(edl):
    chs = sorted(edl['chapters'], key=lambda c: c['start'])
    total = float(edl['total'])
    title_a = find_beat(edl, r'title A|level up', 1.5)
    title_b = find_beat(edl, r'title B|digital twin', 16.0)
    hero = chs[-1]
    end_card = find_beat(edl, r'end card|wordmark', hero['start'] + 8.0)
    centres = [(chs[i]['end'] + chs[i + 1]['start']) / 2 for i in range(len(chs) - 1)]

    # anchors: title B, every dissolve centre after it, the end card
    anchors = [title_b]
    owners = []  # which chapter the segment [anchor_i, anchor_i+1] belongs to
    for i, c in enumerate(centres):
        if c > anchors[-1] + 2.5 and c < end_card - 2.5:
            anchors.append(c)
            owners.append(i)  # segment ending at centre i belongs to chapter index i (0-based)
    anchors.append(end_card)
    owners.append(len(chs) - 1)

    bpm, seg_beats, devs = choose_tempo(anchors)
    beat = 60 / bpm
    bs = [0.0]
    for n in seg_beats:
        bs.append(bs[-1] + n)
    grid = Grid(anchors, bs, beat)

    sections = []

    # pre-title-B: the wake section begins on the first bar line ~a bar after title A
    k = 1
    while title_b - 4 * (k + 1) * beat >= title_a + 0.9 * 4 * beat:
        k += 1
    wake_b0 = -4.0 * k
    pulse_bar = None
    for kk in range(k, 0, -1):
        tb = grid.t(-4.0 * kk)
        if 4.0 <= tb <= 6.5 and (pulse_bar is None or abs(tb - 5.0) < abs(grid.t(pulse_bar) - 5.0)):
            pulse_bar = -4.0 * kk
    if pulse_bar is None:  # nearest beat to 5 s
        pulse_bar = float(np.clip(round((5.0 - title_b) / beat), wake_b0, -1))

    sections.append(dict(name='intro', style='intro', chapter=chs[0]['id'], t0=0.0, t1=grid.t(wake_b0),
                         b0=None, b1=wake_b0, bars=[]))
    sections.append(dict(name='wake', style='wake', chapter=chs[0]['id'], b0=wake_b0, b1=0.0))
    for si, (a0, a1) in enumerate(zip(bs[:-1], bs[1:])):
        ci = owners[si]
        cid = chs[ci]['id']
        if si == 0:
            style = 'twin'
            name = 'twin'
        else:
            style = cid if cid in STYLES else 'groove'
            if style == 'groove' and ci - 1 < len(GROOVE_FALLBACK):
                style = GROOVE_FALLBACK[(ci - 1) % len(GROOVE_FALLBACK)]
            if ci == len(chs) - 1:
                style = 'hero'
            name = cid
        sections.append(dict(name=name, style=style, chapter=cid, b0=a0, b1=a1))

    for s in sections:
        if s['b0'] is None:
            continue
        s['t0'] = grid.t(s['b0'])
        s['t1'] = grid.t(s['b1'])
        nbeats = int(round(s['b1'] - s['b0']))
        bars = []
        b = s['b0']
        while nbeats >= 4:
            bars.append((b, 4))
            b += 4
            nbeats -= 4
        if nbeats > 0:
            bars.append((b, nbeats))
        s['bars'] = bars
        st = STYLES[s['style']]
        prog = []
        for ch, nb in st['prog']:
            prog += [ch] * nb
        nbar = len(bars)
        if st.get('anchor') == 'end':
            if nbar >= len(prog):
                chords = [prog[0]] * (nbar - len(prog)) + prog
            else:
                chords = prog[len(prog) - nbar:]
        else:
            chords = [prog[i % len(prog)] for i in range(nbar)]
            if bars and bars[-1][1] < 4 and st.get('turn'):
                chords[-1] = st['turn']
        s['chords'] = chords
    tail = dict(name='tail', style='tail', chapter=hero['id'], t0=end_card, t1=total, b0=bs[-1], b1=None,
                bars=[], chords=['Dmaj9'])
    sections.append(tail)
    return dict(total=total, title_a=title_a, title_b=title_b, end_card=end_card, centres=centres,
                anchors=anchors, bpm=bpm, seg_beats=seg_beats, devs=devs, grid=grid, sections=sections,
                pulse_t=grid.t(pulse_bar), pulse_b=pulse_bar, chapters=chs, dissolve=float(edl.get('dissolve', 1.5)))


# ---------------------------------------------------------------------------
# automation curves (100 Hz control rate, Hann-smoothed, interpolated per sample)
# ---------------------------------------------------------------------------

CTRL = 100


def curve(plan, values, smooth_s=1.0, default=0.0):
    """values: dict section-name/style -> scalar or (start, end) ramp."""
    total = plan['total']
    n = int(total * CTRL) + 2
    tc = np.arange(n) / CTRL
    c = np.full(n, float(default))
    for s in plan['sections']:
        v = values.get(s['name'], values.get(s['style']))
        if v is None:
            continue
        i0, i1 = int(round(s['t0'] * CTRL)), int(round(s['t1'] * CTRL))
        i1 = min(i1, n)
        if isinstance(v, tuple):
            c[i0:i1] = np.linspace(v[0], v[1], max(1, i1 - i0))
        else:
            c[i0:i1] = v
    if smooth_s > 0:
        w = np.hanning(max(3, int(smooth_s * CTRL)))
        w /= w.sum()
        cp = np.concatenate([np.full(len(w), c[0]), c, np.full(len(w), c[-1])])
        c = np.convolve(cp, w, mode='same')[len(w):-len(w)]
    return tc, c


def at_samples(tc, c, n, offset=0):
    return np.interp((np.arange(n) + offset) / SR, tc, c)


# ---------------------------------------------------------------------------
# the score
# ---------------------------------------------------------------------------

class Mixer:
    def __init__(self, n):
        self.n = n
        self.buses = {}

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.n), dtype=np.float64)
        return self.buses[name]

    def add(self, name, t, L, R=None, gain=1.0, pan=0.0):
        if R is None:
            gl, gr = pan_gains(pan)
            R = L * gr
            L = L * gl
        b = self.bus(name)
        i0 = int(round(t * SR))
        if i0 >= self.n:
            return
        j0 = 0
        if i0 < 0:
            j0 = -i0
            i0 = 0
        m = min(len(L) - j0, self.n - i0)
        if m <= 0:
            return
        b[0, i0:i0 + m] += gain * L[j0:j0 + m]
        b[1, i0:i0 + m] += gain * R[j0:j0 + m]


def compose(plan, seed):
    rng = np.random.default_rng(seed)
    syn = Synth(rng)
    grid = plan['grid']
    total = plan['total']
    N = int(round(total * SR))
    NM = N + int(1.0 * SR)  # small margin, trimmed later
    mix = Mixer(NM)
    secs = [s for s in plan['sections'] if s['name'] not in ('intro', 'tail')]
    events = dict(kicks=[], hits=[])
    beat_nom = grid.beat
    ta, tb, te = plan['title_a'], plan['title_b'], plan['end_card']

    # ---------------- pad (chords) ----------------
    pad_events = [(0.0, 'Asus4', 1.35), (ta, 'Dmaj9', 0.10)]
    for s in secs:
        for (b, nb), ch in zip(s['bars'], s['chords']):
            t0 = grid.t(b)
            if pad_events[-1][1] != ch:
                att = 0.35 if s['style'] not in ('wellness', 'awareness', 'media') else 0.7
                pad_events.append((t0, ch, att))
    pad_events.append((te, 'Dmaj9', 0.06))
    # voice-led: common tones are held across chord changes (no re-attack, no phasing),
    # departing tones release over ~0.9 s while arriving tones fade in.
    open_notes = {}  # midi -> (t_start, attack)
    spans = []
    for i, (t0, ch, att) in enumerate(pad_events):
        notes = set(CHORDS[ch][0])
        last = i == len(pad_events) - 1
        for m in list(open_notes):
            if m not in notes:
                ts, a = open_notes.pop(m)
                spans.append((m, ts, t0 + 0.12, a, 0.9))
        for m in notes:
            if m not in open_notes:
                open_notes[m] = (t0, att)
        if last:
            for m, (ts, a) in open_notes.items():
                end_hold = t0 + 1.6
                spans.append((m, ts, end_hold, a, (total - 0.25) - end_hold))
    for (m, ts, te_, a, rel) in spans:
        hold = te_ - ts
        L, R = syn.pad_note(m, hold, rel, min(a, hold * 0.6))
        mix.add('pad', ts, L, R, gain=0.16)

    # ---------------- arpeggio / pulse ----------------
    arp_lvl_c = curve(plan, {s['name']: STYLES[s['style']].get('arp_lvl', 0) for s in secs}, smooth_s=0.6)
    for s in secs:
        st = STYLES[s['style']]
        kind = st.get('arp')
        if not kind:
            continue
        step_i = 0
        for bi, ((b, nb), ch) in enumerate(zip(s['bars'], s['chords'])):
            tones = arp_tones(ch)
            if kind in ('16', 'syn'):
                steps = range(4 * nb)
                rate = 0.25
            else:
                steps = range(2 * nb)
                rate = 0.5
            syn_pat = parse_pattern('X.xx.x.xX.x.x.xx')
            for k in steps:
                bb = b + k * rate
                if bb < plan['pulse_b']:
                    continue
                if kind == 'syn' and syn_pat[k % 16] == 0:
                    continue
                if st.get('breath_end') and bi == len(s['bars']) - 1:
                    continue
                seq = [0, 2, 1, 3, 2, 4, 3, 5] if kind != '8up' else [0, 1, 2, 3, 4, 5, 4, 2]
                idx = seq[step_i % len(seq)] + (2 if (bi % 4) == 3 and kind != '8' else 0)
                step_i += 1
                midi = tones[idx % len(tones)]
                acc = [1.0, 0.55, 0.72, 0.55][k % 4] if rate == 0.25 else [1.0, 0.7][k % 2]
                vel = acc * (0.85 + 0.15 * rng.random())
                t0 = grid.t(bb)
                if st.get('swing') and k % 2 == 1:
                    t0 += st['swing'] * beat_nom * 0.5
                # wake: pulse fades in over two bars from the pulse entry
                if s['style'] == 'wake':
                    vel *= min(1.0, max(0.0, (t0 - plan['pulse_t']) / (8 * beat_nom))) ** 1.5
                lvl = np.interp(t0, *arp_lvl_c)
                y = syn.pluck(midi, st.get('bright', 0.5))
                mix.add('arp', t0, y, gain=0.10 * vel * lvl, pan=0.28 * math.sin(step_i * 0.9))

    # ---------------- bass ----------------
    for s in secs:
        st = STYLES[s['style']]
        kind = st.get('bass')
        lvl = st.get('bass_lvl', 0.8)
        if not kind:
            continue
        bars = list(zip(s['bars'], s['chords']))
        if kind == 'sustain':
            i = 0
            while i < len(bars):
                (b, nb), ch = bars[i]
                j = i
                while j + 1 < len(bars) and bars[j + 1][1] == ch:
                    j += 1
                b_end = bars[j][0][0] + bars[j][0][1]
                t0, t1 = grid.t(b), grid.t(b_end)
                g = lvl
                if s['style'] == 'wake':  # sub only joins for the last bars before title B
                    if t1 < tb - 4 * beat_nom * 2.5:
                        i = j + 1
                        continue
                    g *= 0.55
                y = syn.bass(CHORDS[ch][1], t1 - t0 - 0.03, att_s=0.06, rel_s=0.12)
                mix.add('bass', t0, y, gain=0.30 * g)
                i = j + 1
        else:
            for (b, nb), ch in bars:
                root = CHORDS[ch][1]
                if kind == 'pulse8':
                    hits = [(k * 0.5, 0.42, 1.0 if k % 2 == 0 else 0.78) for k in range(2 * nb)]
                elif kind == 'syncop':
                    hits = [(0, 1.4, 1.0), (1.5, 0.9, 0.8), (2.5, 0.4, 0.7), (3.0, 0.9, 0.85)]
                else:  # syncop16
                    hits = [(0, 0.7, 1.0), (0.75, 0.6, 0.75), (1.5, 0.4, 0.8), (2.5, 0.4, 0.8),
                            (3.0, 0.4, 0.75), (3.5, 0.4, 0.7)]
                for (off, dur, v) in hits:
                    if off >= nb:
                        continue
                    if st.get('breath_end') and (b + off) >= s['b1'] - 2:
                        continue
                    t0 = grid.t(b + off)
                    d = grid.t(b + off + dur) - t0
                    oct_up = 12 if (kind == 'syncop16' and off in (1.5, 3.5)) else 0
                    y = syn.bass(root + oct_up, d, att_s=0.006, rel_s=0.05, dec=0.32, sus=0.55)
                    mix.add('bass', t0, y, gain=0.32 * lvl * v)

    # ---------------- drums ----------------
    for s in secs:
        st = STYLES[s['style']]
        for (b, nb) in s['bars']:
            last_bar = (b + nb) >= s['b1'] - 1e-6
            for inst in ('kick', 'clap', 'hat', 'shaker', 'tickp'):
                pat = st.get(inst)
                if not pat:
                    continue
                vals = parse_pattern(pat)
                for k in range(4 * nb):
                    v = vals[k % 16]
                    if v <= 0:
                        continue
                    bb = b + k * 0.25
                    if st.get('breath_end') and bb >= s['b1'] - 2:
                        continue
                    t0 = grid.t(bb)
                    if st.get('swing') and k % 2 == 1:
                        t0 += st['swing'] * beat_nom * 0.5
                    if inst != 'kick':
                        t0 += rng.normal(0, 0.002)
                    vel = v * (0.9 + 0.1 * rng.random())
                    if inst == 'kick':
                        mix.add('kick', t0, syn.kick(int(rng.integers(4)), 1.0), gain=0.55 * vel)
                        events['kicks'].append((t0, vel))
                    elif inst == 'clap':
                        mix.add('clap', t0, syn.clap(int(rng.integers(6))), gain=0.16 * vel,
                                pan=rng.uniform(-0.1, 0.1))
                    elif inst == 'hat':
                        mix.add('hat', t0, syn.hat(int(rng.integers(8)), 'hat'), gain=0.075 * vel, pan=0.32)
                    elif inst == 'shaker':
                        mix.add('hat', t0, syn.hat(int(rng.integers(8)), 'shaker'), gain=0.06 * vel, pan=-0.3)
                    else:
                        mix.add('tick', t0, syn.tick(93 if s['style'] == 'awareness' else 86),
                                gain=0.045 * vel, pan=rng.uniform(-0.4, 0.4))
            # storage: soft 16th clap roll building through the final bar
            if st.get('roll') and last_bar:
                for k in range(4 * nb):
                    u = (k + 1) / (4 * nb)
                    t0 = grid.t(b + k * 0.25)
                    mix.add('clap', t0, syn.clap(int(rng.integers(6))), gain=0.11 * u ** 1.6, pan=0.15 * math.sin(k))

    # ---------------- leads / bells ----------------
    for s in secs:
        st = STYLES[s['style']]
        lead = st.get('lead')
        if not lead:
            continue
        occ = {}
        for bi, ((b, nb), ch) in enumerate(zip(s['bars'], s['chords'])):
            if lead in LEADS:
                variants = LEADS[lead].get(ch)
                if not variants:
                    continue
                notes = variants[occ.get(ch, 0) % len(variants)]
                occ[ch] = occ.get(ch, 0) + 1
                for (off, midi, dur, v) in notes:
                    if off >= nb:
                        continue
                    t0 = grid.t(b + off)
                    y = syn.bell(midi, 'celesta', length=3.0)
                    mix.add('lead', t0, y, gain=0.085 * v, pan=0.12)
            elif lead == 'sparkle':
                tones = bell_tones(ch)
                cell = [(0, 0), (1.5, 2), (3, 1)] if bi % 2 == 0 else [(0.5, 3), (2, 2), (2.5, 4)]
                for off, ii in cell:
                    if off >= nb:
                        continue
                    t0 = grid.t(b + off)
                    y = syn.bell(tones[(ii + bi) % len(tones)], 'glass', length=2.4)
                    mix.add('lead', t0, y, gain=0.05 * (0.8 + 0.2 * rng.random()), pan=rng.uniform(-0.45, 0.45))
            elif lead == 'sonar':
                t0 = grid.t(b)
                mix.add('lead', t0, syn.bell(93, 'glass', 2.6), gain=0.045, pan=-0.3)
                if nb >= 4:
                    mix.add('lead', grid.t(b + 2.5), syn.bell(88, 'glass', 2.6), gain=0.03, pan=0.3)
            elif lead == 'rhodes':
                for off, v in ((0, 0.55), (2.5, 0.38)):
                    if off >= nb:
                        continue
                    t0 = grid.t(b + off)
                    for m in CHORDS[ch][0][1:]:
                        mix.add('keys', t0 + 0.008 * rng.random(), syn.bell(m + 12, 'rhodes', 1.8), gain=0.03 * v,
                                pan=rng.uniform(-0.3, 0.3))

    # ---------------- transitions & hits ----------------
    # intro: airy riser from black into title A, then a soft bloom
    L, R = syn.whoosh(ta + 0.02, 2.2, f_lo=500, f_hi=4200, pan_from=-0.3, pan_to=0.3, curve=1.6)
    mix.add('fx', 0.0, L, R, gain=0.09)
    rb = syn.reverse_bell([74, 81, 86], ta)
    mix.add('fxt', 0.0, rb, rb, gain=0.05)
    mix.add('boom', ta, syn.boom(3.0, 58, 38, 1.0), gain=0.32)
    for m, g in ((86, 0.05), (81, 0.04), (90, 0.03)):
        mix.add('lead', ta + 0.01, syn.bell(m, 'celesta', 3.0), gain=g, pan=0.2 * (m - 85) / 5)
    events['hits'].append((ta, 'title A bloom'))

    # title B lift: reverse swell + soft impact
    pre = 4 * beat_nom * 0.9
    L, R = syn.whoosh(pre, 1.8, f_lo=300, f_hi=4500, pan_from=0.4, pan_to=-0.2)
    mix.add('fx', tb - pre, L, R, gain=0.10)
    rb = syn.reverse_bell([69, 74, 81], 2 * beat_nom * 1.0)
    mix.add('fxt', tb - 2 * beat_nom, rb, rb, gain=0.07)
    mix.add('boom', tb, syn.boom(2.5, 62, 40, 0.75), gain=0.36)
    events['hits'].append((tb, 'title B lift'))

    # dissolve swells, centred on each transition (bar line)
    big = {'music', 'storage', 'hero'}
    for s in secs[2:]:
        tc_ = s['t0']
        size = 1.3 if s['style'] in big else 1.0
        pre = 1.9 * size
        L, R = syn.whoosh(pre, 1.3, f_lo=260, f_hi=2600 + 600 * size,
                          pan_from=-0.45 if len(events['hits']) % 2 else 0.45,
                          pan_to=0.45 if len(events['hits']) % 2 else -0.45)
        mix.add('fx', tc_ - pre, L, R, gain=0.075 * size)
        ch0 = s['chords'][0] if s['chords'] else 'Dmaj9'
        top = bell_tones(ch0, 76, 88)[:3]
        rb = syn.reverse_bell(top, 1.6)
        mix.add('fxt', tc_ - 1.6, rb, rb, gain=0.03 * size)
        events['hits'].append((tc_, 'dissolve swell -> ' + s['name']))

    # logo hit at the end card: riser, soft impact, felt mallet and shimmer, ring-out
    pre = 2 * beat_nom * 1.0 + 1.2
    L, R = syn.whoosh(pre, 3.0, f_lo=300, f_hi=5200, pan_from=-0.3, pan_to=0.3, curve=2.8)
    mix.add('fx', te - pre, L, R, gain=0.10)
    rb = syn.reverse_bell([74, 78, 81, 86], 2.4)
    mix.add('fxt', te - 2.4, rb, rb, gain=0.07)
    mix.add('boom', te, syn.boom(4.5, 60, 37, 1.5), gain=0.33)
    mix.add('kick', te, syn.kick(0, 1.6), gain=0.30)
    for m, g, p in ((50, 0.10, 0), (57, 0.07, -0.1), (62, 0.06, 0.1)):  # felt mallet body
        mix.add('keys', te, syn.bell(m, 'rhodes', 4.0), gain=g, pan=p)
    for i, m in enumerate((86, 90, 93, 98, 100)):  # shimmer cluster D6 F#6 A6 D7 E7
        y = syn.bell(m, 'shimmer', 5.5) * (1 + 0.25 * np.sin(TAU * (5.1 + 0.7 * i) * np.arange(int(5.5 * SR)) / SR))
        mix.add('lead', te + 0.03 * i, y, gain=0.022, pan=-0.5 + 0.25 * i)
    for i, m in enumerate((74, 81, 86)):
        mix.add('lead', te + 0.12 + 0.18 * i, syn.bell(m, 'celesta', 4.0), gain=0.05, pan=0.15 * (i - 1))
    by = syn.bass(38, (total - te) * 0.45, att_s=0.02, rel_s=(total - te) * 0.5)
    mix.add('bass', te, by, gain=0.28)
    events['hits'].append((te, 'LOGO HIT'))

    # ---------------- bus processing ----------------
    tc_cut, cut = curve(plan, dict({s['name']: tuple(np.multiply(STYLES[s['style']]['cut'], 1.2)) if isinstance(STYLES[s['style']]['cut'], tuple) else 1.2 * STYLES[s['style']]['cut'] for s in secs},
                                   intro=(500, 1500), tail=(4200, 900)), smooth_s=1.2, default=1500)
    tc_pad, padlvl = curve(plan, dict({s['name']: STYLES[s['style']]['pad'] for s in secs},
                                      intro=(0.7, 0.8), tail=1.0), smooth_s=1.0, default=0.8)
    # slow filter motion: 8-bar LFO (+/- 0.3 octave) and breathing in wellness
    lfo = 2 ** (0.3 * np.sin(TAU * tc_cut / (32 * beat_nom)))
    _, breathe = curve(plan, {s['name']: 1.0 for s in secs if STYLES[s['style']].get('breathe')}, smooth_s=2.0)
    lfo *= 2 ** (0.45 * breathe * np.sin(TAU * tc_cut / (8 * beat_nom)))
    cut = cut * lfo

    def pad_gain(tc, freqs):
        fc = np.interp(tc, tc_cut, cut)[:, None]
        return lp_gain(freqs[None, :], fc, q=0.9) * hp_gain(freqs[None, :], 150)

    pb = mix.bus('pad')
    for c in range(2):
        pb[c] = stft_filter(pb[c], pad_gain)
    pb *= at_samples(tc_pad, padlvl, NM)[None, :]

    # breath in wellness: pad swells with the 2-bar breathing cycle
    g_breath = 1 + 0.22 * breathe * np.sin(TAU * tc_pad / (8 * beat_nom))
    pb *= at_samples(tc_pad, g_breath, NM)[None, :]

    # media/night: the arp also gets darker; gentle lowpass on arp bus following cut
    def arp_gain(tc, freqs):
        fc = 2.1 * np.interp(tc, tc_cut, cut)[:, None]
        return lp_gain(freqs[None, :], fc, q=0.75) * hp_gain(freqs[None, :], 180)

    ab = mix.bus('arp')
    for c in range(2):
        ab[c] = stft_filter(ab[c], arp_gain)

    # sidechain ducking from kicks
    _, duck_amt = curve(plan, {s['name']: STYLES[s['style']].get('duck', 0) for s in secs}, smooth_s=0.5)
    duck = np.zeros(NM)
    kern_n = int(0.45 * SR)
    kt = np.arange(kern_n) / SR
    kern = np.exp(-kt / 0.14)
    a = int(0.006 * SR)
    kern[:a] *= fade_in(a)
    for (t0, vel) in events['kicks']:
        i0 = int(round(t0 * SR))
        m = min(kern_n, NM - i0)
        if m > 0 and i0 >= 0:
            duck[i0:i0 + m] = np.maximum(duck[i0:i0 + m], vel * kern[:m])
    dg = 1 - at_samples(_, duck_amt, NM) * duck
    for name, depth in (('pad', 1.0), ('bass', 0.8), ('arp', 0.5), ('keys', 0.6)):
        if name in mix.buses:
            mix.buses[name] *= (1 - depth * (1 - dg))[None, :]

    return mix, events, N, NM


# ---------------------------------------------------------------------------
# effects: reverb, delay
# ---------------------------------------------------------------------------

def make_ir(rng, length=4.2, predelay=0.024):
    n = int(length * SR)
    t = np.arange(n) / SR
    edges = [0, 200, 500, 1000, 2000, 4000, 8000, 24000]
    rts = [2.6, 3.1, 3.0, 2.6, 2.0, 1.35, 0.8]
    common = rng.standard_normal(n)
    out = []
    for ch in range(2):
        nz = 0.5 * common + 0.866 * rng.standard_normal(n)
        X = np.fft.rfft(nz)
        f = np.fft.rfftfreq(n, 1 / SR)
        y = np.zeros(n)
        for i in range(len(rts)):
            lo, hi = edges[i], edges[i + 1]
            m = ((f >= lo) & (f < hi)).astype(float)
            # smooth band edges (~15 Hz raised-cosine crossover)
            m = np.convolve(m, np.hanning(64) / np.hanning(64).sum(), mode='same')
            yb = np.fft.irfft(X * m, n)
            y += yb * np.exp(-6.91 * t / rts[i])
        lp = 1 / np.sqrt(1 + (f / 9000) ** 4)
        y = np.fft.irfft(np.fft.rfft(y) * lp, n)
        a = int(0.012 * SR)
        y[:a] *= fade_in(a)
        y[-int(0.3 * SR):] *= fade_out(int(0.3 * SR))
        y = np.concatenate([np.zeros(int(predelay * SR) + ch * int(0.0037 * SR)), y])
        out.append(y / np.sqrt(np.sum(y ** 2)))
    m = max(len(o) for o in out)
    return [np.pad(o, (0, m - len(o))) for o in out]


def make_delay_ir(delay_s, fb=0.38, taps=8):
    n = int(delay_s * SR * (taps + 1))
    irs = [np.zeros(n), np.zeros(n)]
    for k in range(1, taps + 1):
        i = int(round(k * delay_s * SR))
        sigma = 1.0 + 1.6 * k
        w = int(4 * sigma)
        x = np.arange(-w, w + 1)
        g = np.exp(-0.5 * (x / sigma) ** 2)
        g /= g.sum()
        ch = k % 2  # ping-pong: first repeat right
        irs[ch][i - w:i + w + 1] += (fb ** (k - 1)) * g
    return irs


# ---------------------------------------------------------------------------
# loudness, true peak, limiter
# ---------------------------------------------------------------------------

def kweight_mag(nfft):
    """|H| of the BS.1770 K-weighting (two biquads at 48 kHz) on rfft bins."""
    w = TAU * np.fft.rfftfreq(nfft, 1 / SR) / SR
    z = np.exp(-1j * w)

    def biq(b, a):
        return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    h1 = biq([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
    h2 = biq([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])
    return np.abs(h1 * h2)


def integrated_lufs(x):
    n = x.shape[1]
    nfft = int(2 ** math.ceil(math.log2(n)))
    K = kweight_mag(nfft)
    p = 0
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    nb = (n - blk) // hop + 1
    pw = np.zeros(nb)
    for c in range(2):
        y = np.fft.irfft(np.fft.rfft(x[c], nfft) * K, nfft)[:n]
        cs = np.concatenate([[0], np.cumsum(y * y)])
        st = np.arange(nb) * hop
        pw += (cs[st + blk] - cs[st]) / blk
    lk = -0.691 + 10 * np.log10(np.maximum(pw, 1e-20))
    g = pw[lk > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = pw[(lk > -70) & (lk > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))


def _interp_fir(os_=4, taps_per_phase=48):
    L = os_ * taps_per_phase
    k = np.arange(L) - (L - 1) / 2
    h = np.sinc(k / os_) * np.kaiser(L, 9.0)
    return h * os_ / h.sum()


def oversampled_abs(x, os_=4):
    """Per-sample max |x| over the 4x interpolated signal (true-peak estimate),
    polyphase FIR interpolation done with FFT convolution."""
    h = _interp_fir(os_)
    n = len(x)
    lp = len(h) // os_
    nfft = int(2 ** math.ceil(math.log2(n + lp)))
    X = np.fft.rfft(x, nfft)
    d = lp // 2
    out = np.abs(x).copy()
    for p in range(os_):
        y = np.fft.irfft(X * np.fft.rfft(h[p::os_], nfft), nfft)[d:d + n]
        np.maximum(out, np.abs(y), out=out)
    return out


def true_peak_db(x):
    return db(max(np.max(oversampled_abs(x[c])) for c in range(x.shape[0])))


def sliding_min(g, w):
    """Exact min over the window [i-w, i+w] (sparse-table doubling)."""
    W = 2 * w + 1
    n = len(g)
    gp = np.concatenate([np.full(w, 1.0), g, np.full(w + W, 1.0)])
    m = gp.copy()
    s = 1
    while 2 * s <= W:
        m[:-s] = np.minimum(m[:-s], m[s:])
        s *= 2
    # m[i] = min gp[i : i+s]; combine two overlapping spans to cover exactly W
    out = np.minimum(m[:n], m[W - s:W - s + n])
    return out


def limiter_gain(x, ceil_db, look=0.012):
    pk = np.maximum(oversampled_abs(x[0]), oversampled_abs(x[1]))
    req = np.minimum(1.0, undb(ceil_db) / np.maximum(pk, 1e-9))
    if req.min() >= 1.0:
        return np.ones(x.shape[1]), 0.0
    w = int(look * SR)
    g = sliding_min(req, w)
    box = np.ones(w) / w
    g = np.convolve(np.concatenate([np.ones(w), g, np.ones(w)]), box, mode='same')[w:-w]
    g = np.minimum(g, req)
    return g, -db(req.min())


# ---------------------------------------------------------------------------
# analysis
# ---------------------------------------------------------------------------

BANDS = [('sub <60', 20, 60), ('low 60-250', 60, 250), ('lowmid 250-1k', 250, 1000),
         ('mid 1-4k', 1000, 4000), ('high 4-10k', 4000, 10000), ('air >10k', 10000, 24000)]


def band_db(seg):
    m = 0.5 * (seg[0] + seg[1])
    n = len(m)
    if n < 2048:
        return {b[0]: None for b in BANDS}
    X = np.abs(np.fft.rfft(m * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    tot = X[(f >= 20)].sum() + 1e-30
    return {name: round(10 * math.log10(X[(f >= lo) & (f < hi)].sum() / tot + 1e-30), 1) for name, lo, hi in BANDS}


def click_score(seg):
    """Clicks/discontinuities are broadband, so they show up as spikes in the >12 kHz
    residual (where this score has almost no musical content). Returns the peak of that
    residual in dBFS (mono sum / 2); anything below about -40 dBFS is inaudible here."""
    m = 0.5 * (seg[0] + seg[1])
    n = len(m)
    if n < 4096:
        return None
    tw = int(0.02 * SR)  # taper the cut edges so the segment boundary itself is not a 'click'
    m = m.copy()
    m[:tw] *= fade_in(tw)
    m[-tw:] *= fade_out(tw)
    X = np.fft.rfft(m)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[f < 12000] = 0
    hf = np.fft.irfft(X, n)
    return db(float(np.max(np.abs(hf))))


def analyze(x, plan, events):
    rep = dict(sections=[], hits=[])
    for s in plan['sections']:
        i0, i1 = int(s['t0'] * SR), int(min(s['t1'], plan['total']) * SR)
        seg = x[:, i0:i1]
        if seg.shape[1] < 100:
            continue
        pk = float(np.max(np.abs(seg)))
        rms = float(np.sqrt(np.mean(seg ** 2)))
        L, R = seg
        corr = float(np.sum(L * R) / (np.sqrt(np.sum(L * L) * np.sum(R * R)) + 1e-20))
        mono = 0.5 * (L + R)
        mono_loss = db(np.sqrt(np.mean(mono ** 2))) - db(np.sqrt(0.5 * (np.mean(L * L) + np.mean(R * R))))
        jump = float(np.max(np.abs(np.diff(seg, axis=1))))
        rep['sections'].append(dict(
            name=s['name'], t0=round(s['t0'], 3), t1=round(s['t1'], 3), peak_dbfs=round(db(pk), 2),
            rms_dbfs=round(db(rms), 2), crest_db=round(db(pk) - db(rms), 2), corr=round(corr, 3),
            mono_sum_db=round(mono_loss, 2), max_jump=round(jump, 4), hf_spike_dbfs=round(click_score(seg) or -200, 1),
            bands=band_db(seg)))
    rep['dc'] = [float(np.mean(x[0])), float(np.mean(x[1]))]
    rep['sample_peak_dbfs'] = round(db(np.max(np.abs(x))), 2)
    rep['true_peak_dbtp_est'] = round(true_peak_db(x), 2)
    L, R = x
    rep['corr_total'] = round(float(np.sum(L * R) / np.sqrt(np.sum(L * L) * np.sum(R * R))), 3)
    rep['bands_total'] = band_db(x)
    rep['n_full_scale'] = int(np.sum(np.abs(x) > 0.999))
    # tail level: last 0.5 s RMS
    rep['last_0.5s_rms_dbfs'] = round(db(float(np.sqrt(np.mean(x[:, -SR // 2:] ** 2)))), 1)
    rep['first_0.05s_peak_dbfs'] = round(db(float(np.max(np.abs(x[:, :SR // 20])))), 1)
    return rep


def ffmpeg_measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr
    summ = txt[txt.rfind('Summary:'):]
    out = {}
    for key, pat in (('I', r'I:\s+(-?[\d.]+) LUFS'), ('LRA', r'LRA:\s+(-?[\d.]+) LU'),
                     ('TP', r'Peak:\s+(-?[\d.]+) dBFS')):
        m = re.search(pat, summ)
        out[key] = float(m.group(1)) if m else None
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                        'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    if m:
        j = json.loads(m.group(0))
        out['loudnorm_input_i'] = float(j['input_i'])
        out['loudnorm_input_tp'] = float(j['input_tp'])
        out['loudnorm_input_lra'] = float(j['input_lra'])
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate,channels,bits_per_raw_sample,'
                        'bits_per_sample,duration_ts,codec_name', '-of', 'json', path], capture_output=True, text=True)
    try:
        out['stream'] = json.loads(r.stdout)['streams'][0]
    except Exception:
        pass
    return out


# ---------------------------------------------------------------------------
# output
# ---------------------------------------------------------------------------

def write_wav24(path, x, rng):
    lsb = 1.0 / 8388608.0
    d = (rng.random(x.shape) - rng.random(x.shape)) * lsb  # TPDF dither
    q = np.clip(np.round((x + d) * 8388607.0), -8388608, 8388607).astype(np.int32)
    inter = q.T.reshape(-1)
    b = inter.astype('<i4').view(np.uint8).reshape(-1, 4)[:, :3].reshape(-1).tobytes()
    tmp = path + '.tmp.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)
    os.replace(tmp, path)


def fmt_t(t):
    m = int(t // 60)
    return f'{m}:{t - 60 * m:05.2f}'


SECTION_TEXT = {
    'intro': 'From black: airy noise riser + reversed bell swell on Asus4, blooming into Dmaj9 on title A (soft sub boom + celesta chime).',
    'wake': 'Desk wakes up: detuned pad (filter opening), soft pluck pulse fades in on the bar line, sub joins for the last bars. D-Bm-G-Asus.',
    'twin': 'Lift: felt kick on 1 and 3, shaker, 16th pluck arp, celesta "digital twin" motif. I-V6-vi-IV.',
    'rise': 'Home-office groove: syncopated kick, soft claps 2/4, offbeat hats, 8th-note bass. IV-I6-ii-V.',
    'create': 'Artist studio: lighter drums (rim ticks), rising 8th arp, glass-bell sparkles. vi-IV-I-V.',
    'commons': 'Library commons: warm social groove, claps, syncopated bass. I-iii-IV-V.',
    'coast': 'Media lab: forward motion, four-on-the-floor felt kick, syncopated arp. ii-IV-I6-V.',
    'oilers': 'Classroom: bright discovery, busier shaker, bell sparkles. IV-V-iii-vi.',
    'wellness': 'Gym: drums drop to one soft kick per bar, pad breathes on a 2-bar cycle (Pause. Stand. Breathe.). Lydian IV, I, ii; F#7sus4 turn.',
    'awareness': 'Product void, dark and premium: relative minor, sensor-like pings with ping-pong delay, sparse kick. vi-IV-ii-V/vi.',
    'music': 'Gaming room, most rhythm: four-on-the-floor, claps, hats + 16th shaker with swing, 16th syncopated bass, strongest sidechain pump. vi-IV-I-V.',
    'media': 'Movie night: filter closes, Rhodes stabs, half-time kick, darker arp. ii-iii-IV-Vsus.',
    'storage': 'Library storage: build. Filter and arp open up across the section, rising bass line, 16th clap roll into the hero.',
    'hero': 'Hero orbit: widest pad, celesta hero motif; drums and arp breathe out for the last 2 beats while the riser pulls into the logo hit. IV-ii-Vsus-V.',
    'tail': 'Logo hit on Dmaj9 (felt impact + sub, Rhodes mallet, shimmer cluster, celesta D-A-D); pad filter closes and everything rings out to silence.',
}


def write_cue_sheet(path, plan, events, meas, rep, edl_path, out_wav):
    g = plan['grid']
    lines = []
    lines.append('# ErgoFlex intro: score cue sheet')
    lines.append('')
    lines.append(f'Generated by `tools/experience/score-synth.py` from `{os.path.relpath(edl_path, os.path.dirname(path))}`. '
                 'Re-run the generator after any EDL change; this sheet, the WAV and the PNGs are rewritten.')
    lines.append('')
    lines.append(f'- **Tempo:** {plan["bpm"]:.2f} BPM nominal, 4/4. Local tempo per section is bent by at most '
                 f'{100 * float(np.max(plan["devs"])):.1f} % so that title B, every dissolve centre and the end card land on a bar line.')
    lines.append('- **Key:** D major (relative B minor in the awareness chapter; Lydian colour Gmaj7#11 in wellness).')
    lines.append(f'- **Length:** {plan["total"]:.3f} s ({int(round(plan["total"] * SR))} samples @ 48 kHz), 24-bit stereo.')
    if meas:
        lines.append(f'- **Loudness (ffmpeg ebur128):** {meas.get("I")} LUFS integrated, true peak {meas.get("TP")} dBTP, '
                     f'LRA {meas.get("LRA")} LU. loudnorm reads I={meas.get("loudnorm_input_i")}, TP={meas.get("loudnorm_input_tp")}.')
    lines.append('')
    lines.append('## Section map')
    lines.append('')
    lines.append('| section | chapter | start | end | bars (beats) | local BPM | chords | music |')
    lines.append('|---|---|---:|---:|---|---:|---|---|')
    for s in plan['sections']:
        if s['bars']:
            nbt = int(round(s['b1'] - s['b0']))
            bars = f'{len(s["bars"])} ({nbt})' + (' incl. 2/4 turn' if s['bars'][-1][1] < 4 else '')
            bpm = f'{g.local_bpm(s["b0"] + 0.01):.2f}'
            chords = ' · '.join(s['chords'])
        else:
            bars, bpm, chords = 'free', '-', ('Asus4 -> Dmaj9' if s['name'] == 'intro' else 'Dmaj9')
        lines.append(f'| {s["name"]} | {s["chapter"]} | {fmt_t(s["t0"])} | {fmt_t(s["t1"])} | {bars} | {bpm} | {chords} | '
                     f'{SECTION_TEXT.get(s["style"], "")} |')
    lines.append('')
    lines.append('## Hits and sync points')
    lines.append('')
    lines.append('| time | what |')
    lines.append('|---:|---|')
    for t, what in sorted(events['hits'] + [(plan['pulse_t'], 'pulse/arp enters on a bar line (desk wakes up)')]):
        lines.append(f'| {fmt_t(t)} ({t:.3f} s) | {what} |')
    lines.append(f'| {fmt_t(plan["total"])} | end of file (tail has rung out; master fade completes) |')
    lines.append('')
    lines.append('Dissolve swells peak exactly on each dissolve centre (= chapter i end - dissolve/2), which is also the bar line '
                 'where the next chapter\'s arrangement starts. Reversed bells resolve on the same downbeat.')
    lines.append('')
    lines.append('## Mix / master')
    lines.append('')
    lines.append('- Buses: detuned PolyBLEP pad (STFT time-varying resonant low-pass + 150 Hz HP, 8-bar filter LFO, voice-led common tones), additive pluck '
                 'arp (+ dotted-8th ping-pong delay), sine bass, felt kick / clap / hat / shaker / ticks (FFT-shaped noise), '
                 'celesta/glass/Rhodes bells, whooshes + reversed bells, sub booms. Kick sidechain ducks pad/bass/arp per section.')
    lines.append('- Shared synthetic stereo hall (frequency-dependent RT60 0.8-3.1 s, partially correlated L/R for mono safety).')
    lines.append('- Master: 30 Hz HP, -2.5 dB low shelf under 55 Hz, gentle -1.5 dB shelf above 9 kHz, gain to -16 LUFS (BS.1770 meter in numpy), 4x-oversampled look-ahead '
                 'limiter at -1.9 dBTP, 2.5 s fade to silence, TPDF dither to 24-bit.')
    if rep:
        lines.append(f'- Analysis: stereo correlation {rep["corr_total"]}, DC {rep["dc"][0]:.1e}/{rep["dc"][1]:.1e}, sample peak '
                     f'{rep["sample_peak_dbfs"]} dBFS, {rep["n_full_scale"]} samples at full scale, last 0.5 s RMS '
                     f'{rep["last_0.5s_rms_dbfs"]} dBFS. Per-section numbers: `score-analysis.json`.')
    lines.append('')
    lines.append('## Re-render')
    lines.append('')
    lines.append('```')
    lines.append(f'python3 tools/experience/score-synth.py {os.path.relpath(edl_path, os.getcwd())} {os.path.relpath(out_wav, os.getcwd())}')
    lines.append('```')
    lines.append('')
    with open(path, 'w') as f:
        f.write('\n'.join(lines))


def write_pngs(out_wav, plan):
    d = os.path.dirname(out_wav)
    spec = os.path.join(d, 'score-spectrogram.png')
    wavp = os.path.join(d, 'score-waveform.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out_wav, '-lavfi',
                    'showspectrumpic=s=1920x720:mode=combined:color=intensity:scale=log:fscale=lin:legend=1',
                    spec], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out_wav, '-lavfi',
                    'showwavespic=s=1920x480:split_channels=1:colors=0x6fc2ff|0xffb36f:scale=lin',
                    '-frames:v', '1', wavp], check=True)
    # annotate waveform with section boundaries and hits (ImageMagick, optional)
    try:
        W = 1920
        draws = []
        for s in plan['sections']:
            x = int(s['t0'] / plan['total'] * W)
            draws += ['-stroke', '#ffffff80', '-draw', f'line {x},0 {x},480', '-stroke', 'none', '-fill', '#ffffff',
                      '-pointsize', '13', '-annotate', f'+{x + 3}+14', s['name']]
        for t in (plan['title_a'], plan['title_b'], plan['end_card']):
            x = int(t / plan['total'] * W)
            draws += ['-stroke', '#ff4f6a', '-draw', f'line {x},0 {x},480']
        subprocess.run(['convert', wavp, '-background', '#101418', '-flatten', *draws, wavp], check=True,
                       capture_output=True)
    except Exception as e:  # noqa: BLE001
        print('waveform annotation skipped:', e)
    return spec, wavp


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('edl')
    ap.add_argument('out')
    ap.add_argument('--seed', type=int, default=20261030)
    ap.add_argument('--target-lufs', type=float, default=-16.0)
    ap.add_argument('--ceiling', type=float, default=-1.9, help='limiter ceiling, dBTP (4x oversampled)')
    ap.add_argument('--no-extras', action='store_true', help='skip cue sheet, analysis json and PNGs')
    ap.add_argument('--stems', action='store_true', help='also write per-bus stems (float, pre-master) for debugging')
    args = ap.parse_args()

    with open(args.edl) as f:
        edl = json.load(f)
    plan = build_plan(edl)
    print(f'tempo {plan["bpm"]:.2f} BPM; segments (beats) {plan["seg_beats"]}; max bend '
          f'{100 * float(np.max(plan["devs"])):.2f} %; pulse at {plan["pulse_t"]:.2f} s')
    for s in plan['sections']:
        print(f'  {s["name"]:<10} {s["t0"]:7.2f}-{s["t1"]:7.2f}  {" ".join(s.get("chords", []))}')

    mix, events, N, NM = compose(plan, args.seed)

    # ---- effects ----
    rng = np.random.default_rng(args.seed + 1)
    ir = make_ir(rng)
    beat = plan['grid'].beat
    dly = make_delay_ir(0.75 * beat, fb=0.36)
    sends_rev = {'pad': 0.30, 'arp': 0.30, 'lead': 0.55, 'keys': 0.45, 'clap': 0.22, 'hat': 0.10, 'tick': 0.4,
                 'fx': 0.45, 'fxt': 0.6, 'boom': 0.12, 'kick': 0.03, 'bass': 0.0}
    sends_dly = {'arp': 0.30, 'lead': 0.28, 'tick': 0.45, 'keys': 0.15}
    gains = {'pad': 1.0, 'arp': 3.2, 'lead': 2.5, 'keys': 2.0, 'bass': 0.5, 'kick': 0.7, 'clap': 2.0, 'hat': 2.5,
             'tick': 1.5, 'fx': 1.0, 'fxt': 1.0, 'boom': 0.8}
    for k, v in list(mix.buses.items()):
        v *= gains.get(k, 1.0)
    dsend = np.zeros(NM)
    for k, s in sends_dly.items():
        if k in mix.buses:
            dsend += s * 0.5 * (mix.buses[k][0] + mix.buses[k][1])
    dly_ret = np.stack([fft_convolve(dsend, dly[c])[:NM] for c in range(2)])
    rsend = np.zeros((2, NM))
    for k, s in sends_rev.items():
        if k in mix.buses:
            rsend += s * mix.buses[k]
    rsend += 0.5 * dly_ret
    rev_ret = np.stack([fft_convolve(rsend[c], ir[c])[:NM] for c in range(2)])
    dry = sum(mix.buses.values())
    x = dry + 0.85 * dly_ret * 0.6 + 0.55 * rev_ret
    # macro dynamics per chapter (dB), smoothed across the dissolves
    tcm, mdb = curve(plan, {sec['name']: STYLES[sec['style']].get('mixdb', 0.0) for sec in plan['sections']
                            if sec['style'] in STYLES}, smooth_s=plan['dissolve'])
    x *= undb(1.0) ** at_samples(tcm, mdb, NM)[None, :]
    if args.stems:
        sd = os.path.join(os.path.dirname(args.out), 'stems')
        os.makedirs(sd, exist_ok=True)
        for k, v in list(mix.buses.items()) + [('reverb', rev_ret), ('delay', dly_ret)]:
            np.save(os.path.join(sd, k + '.npy'), v[:, :N].astype(np.float32))
    del mix, rsend, dsend

    # ---- master EQ (static, zero-phase, full length) ----
    x = x[:, :N]
    nfft = int(2 ** math.ceil(math.log2(N + 1)))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    eq = hp_gain(f, 30) * (1 / np.sqrt(1 + (f / 15500) ** 8))
    eq *= 1 - (1 - undb(-1.5)) * (1 / (1 + (9000 / np.maximum(f, 1)) ** 2))  # gentle high shelf
    eq *= 1 - (1 - undb(-2.5)) * (1 / (1 + (np.maximum(f, 1) / 55) ** 2))  # tame the sub (low shelf)
    x = np.stack([np.fft.irfft(np.fft.rfft(x[c], nfft) * eq, nfft)[:N] for c in range(2)])
    x -= x.mean(axis=1, keepdims=True)

    # fades: start from true silence, ring out to silence at total
    fi = int(0.01 * SR)
    x[:, :fi] *= fade_in(fi)
    fo = int(2.5 * SR)
    x[:, -fo:] *= ((0.5 + 0.5 * np.cos(np.pi * (np.arange(fo) + 0.5) / fo)) ** 1.5)
    x[:, -1] = 0

    # ---- loudness + true-peak limiter (iterate) ----
    pre_rep = dict(raw_tp=round(true_peak_db(x), 2), raw_lufs=round(integrated_lufs(x), 2))
    gain_db = args.target_lufs - pre_rep['raw_lufs']
    gr_max = 0
    for it in range(6):
        y = x * undb(gain_db)
        g, gr_max = limiter_gain(y, args.ceiling)
        y = y * g[None, :]
        lufs = integrated_lufs(y)
        tp = true_peak_db(y)
        print(f'  master iter {it}: gain {gain_db:+.2f} dB, limiter max GR {gr_max:.2f} dB, '
              f'{lufs:.2f} LUFS, TP {tp:.2f} dBTP')
        if abs(lufs - args.target_lufs) < 0.05 and tp <= args.ceiling + 0.15:
            break
        gain_db += args.target_lufs - lufs
    x = y
    pre_rep.update(master_gain_db=round(gain_db, 2), limiter_max_gr_db=round(gr_max, 2),
                   limited_ms=round(float(np.sum(g < 0.999)) / SR * 1000, 1),
                   limiter_gr_db_by_section={sec['name']: round(-db(float(np.min(g[int(sec['t0'] * SR):max(int(sec['t0'] * SR) + 1, int(sec['t1'] * SR))]))), 2)
                                             for sec in plan['sections']})
    print('  limiter GR by section:', pre_rep['limiter_gr_db_by_section'])

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_wav24(args.out, x, np.random.default_rng(args.seed + 2))
    print('wrote', args.out, f'{N} samples, {N / SR:.3f} s')

    if args.no_extras:
        return
    rep = analyze(x, plan, events)
    rep['master'] = pre_rep
    meas = ffmpeg_measure(args.out)
    rep['ffmpeg'] = meas
    rep['tempo'] = dict(bpm=plan['bpm'], seg_beats=plan['seg_beats'], max_bend_pct=round(100 * float(np.max(plan['devs'])), 2))
    d = os.path.dirname(args.out)
    with open(os.path.join(d, 'score-analysis.json'), 'w') as f:
        json.dump(rep, f, indent=1)
    write_cue_sheet(os.path.join(d, 'CUE-SHEET.md'), plan, events, meas, rep, os.path.abspath(args.edl),
                    os.path.abspath(args.out))
    write_pngs(args.out, plan)
    print(f'ffmpeg: I={meas.get("I")} LUFS  TP={meas.get("TP")} dBTP  LRA={meas.get("LRA")}  '
          f'loudnorm I={meas.get("loudnorm_input_i")} TP={meas.get("loudnorm_input_tp")}')
    print(f'corr {rep["corr_total"]}  DC {rep["dc"]}  bands {rep["bands_total"]}')
    print(f'{"section":<10} {"peak":>7} {"rms":>7} {"crest":>6} {"corr":>6} {"mono":>6} {"jump":>7} {"hfspk":>6}  bands')
    for s in rep['sections']:
        print(f'{s["name"]:<10} {s["peak_dbfs"]:7.2f} {s["rms_dbfs"]:7.2f} {s["crest_db"]:6.2f} {s["corr"]:6.3f} '
              f'{s["mono_sum_db"]:6.2f} {s["max_jump"]:7.4f} {s["hf_spike_dbfs"]:6.1f}  '
              + ' '.join(f'{v}' for v in s['bands'].values()))


if __name__ == '__main__':
    main()
