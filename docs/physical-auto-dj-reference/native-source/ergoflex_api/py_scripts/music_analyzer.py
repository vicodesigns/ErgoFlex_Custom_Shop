#!/usr/bin/env python3
"""
ErgoLED Music Analyzer

Captures audio via PipeWire (pw-record), with a PyAudio fallback for non-PipeWire
hosts, performs FFT analysis, and POSTs frequency-band metrics to the Go API for
real-time LED music visualisation.

Audio source isolation (--source): mic = default PipeWire source (microphone);
system = default sink MONITOR (system playback only, no mic bleed); both = mic and
system captured as separate pw-record streams and mixed. (The legacy PULSE_SOURCE
env-var routing silently opened the mic for BOTH modes on PipeWire hosts whose
PyAudio/PortAudio lacks a PulseAudio backend; pw-record targets the nodes directly,
so the isolation is structural.)

Two modes:
  * Legacy (default): a single loop captures, analyses, smooths (EMA), and POSTs
    each frame synchronously at ~50 Hz. Kept for rollback.
  * Low-latency (--low-latency, Step 6 / MUSIC_ANALYZER_LOW_LATENCY_V2): capture
    and send run on SEPARATE threads with a single-slot "latest frame" so audio
    capture is never serialized behind a stalled POST. It requests a small
    pw-record --latency fragment (the biggest single latency drop) and does NO
    Python-side EMA so smoothing happens exactly once, in firmware (avoids the
    cascaded double-EMA lag).

Dependencies: pw-record (PipeWire) primary; pyaudio (fallback), numpy, requests
"""

import argparse
import collections
import json
import logging
import os
import select
import shutil
import subprocess
import sys
import threading
import time

import numpy as np
import pyaudio
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SAMPLE_RATE = 44100
CHUNK_SIZE = 882             # 44100 / 50 = 882 samples per frame (~50 Hz) — legacy
CHUNK_SIZE_LOW_LATENCY = 441  # 10 ms @ 44.1 kHz — smaller window = lower capture latency
FORMAT = pyaudio.paInt16
CHANNELS = 1
NUM_BANDS = 8

# Low-latency PulseAudio fragment hint (ms). Tells the PulseAudio/PipeWire client
# to use a small buffer so monitor/mic capture isn't held in a large fragment.
PULSE_LATENCY_MSEC_LOW = "15"

# Logarithmic frequency band edges (Hz)
BAND_EDGES = [
    (20, 60),       # 0  sub-bass
    (60, 150),      # 1  bass
    (150, 400),     # 2  low-mid
    (400, 1000),    # 3  mid
    (1000, 2500),   # 4  upper-mid
    (2500, 5000),   # 5  presence
    (5000, 10000),  # 6  brilliance
    (10000, 20000), # 7  air
]

# Smoothing / detection parameters (asymmetric: fast attack / slow decay)
EMA_ATTACK_ALPHA = 0.6         # Rising edge: fast response to transients (legacy only)
EMA_DECAY_ALPHA = 0.15         # Falling edge: smooth visual decay (legacy only)
BEAT_HISTORY_LEN = 25          # ~0.5 s at 50 fps
BEAT_THRESHOLD_MULT = 1.5
BEAT_DEBOUNCE_SEC = 0.150      # 150 ms

# POST failure thresholds, EXPRESSED IN SECONDS AND DERIVED FROM THE FRAME RATE.
#
# These used to be frame counts with the seconds in a comment: MAX_CONSECUTIVE_FAILURES = 500,
# "~10 seconds at 50Hz". The comment was already wrong (500 frames is 23s at the 21.7Hz the sender
# actually ran at) and raising the capture rate would have silently shrunk the self-exit window by
# 4.6x — a change whose whole purpose is to move the frame rate must move everything expressed in
# frames-as-time.
#
# Derived rather than re-hardcoded because BOTH paths share them and they run at different rates:
# legacy is chunk 882 (50Hz), low-latency is chunk 441 (100Hz). At 882 this yields exactly
# 50/250/500 — byte-identical to the old literals — and at 441 it yields 100/500/1000.
#
# The window is a LOWER BOUND, not an exact duration: a POST that TIMES OUT takes up to the 0.5s
# `timeout` rather than one frame period, so a run of timeouts spans longer than the nominal
# seconds. The old comment did not say this either.
POST_WARN_AFTER_SEC = 1.0
POST_BACKOFF_AFTER_SEC = 5.0
POST_SELF_EXIT_AFTER_SEC = 10.0


def failure_thresholds(chunk: int) -> tuple:
    """(warn, backoff, self_exit) as consecutive-failure counts for this chunk size."""
    fps = SAMPLE_RATE / float(chunk)
    return (int(round(POST_WARN_AFTER_SEC * fps)),
            int(round(POST_BACKOFF_AFTER_SEC * fps)),
            int(round(POST_SELF_EXIT_AFTER_SEC * fps)))

# ---------------------------------------------------------------------------
# Music Mode 2.0 (packet v2) — tempo / phase / structure parameters
# ---------------------------------------------------------------------------
TEMPO_MIN_BPM = 60.0
TEMPO_MAX_BPM = 200.0
TEMPO_WINDOW_SEC = 6.0         # onset ring length for autocorrelation
TEMPO_RECALC_SEC = 0.5         # autocorrelation cadence
TEMPO_MIN_FILL_SEC = 3.0       # don't estimate until the ring is this full
TEMPO_CONF_LOCK = 2.2          # peak/mean autocorr ratio to lock tempo
TEMPO_CONF_UNLOCK = 1.4        # hysteresis: drop lock below this
PHASE_CORRECT_GAIN = 0.15      # PLL nudge toward detected beats (0.30 wobbled the grid ±38ms/beat; halved 2026-07-12 for metronomic flash timing)
ENV_TAU_SEC = 4.0              # loudness envelope EMA time constant
ENV_REF_HALFLIFE_SEC = 30.0    # AGC reference peak decay half-life
BUILD_RISE_RATIO = 1.22        # env now vs ~8s ago to call a build
BUILD_MIN_ENV = 40             # envelope byte floor for build detection
DROP_BASS_RATIO = 2.2          # fast/slow bass ratio that fires a drop
DROP_REARM_SEC = 4.0           # min spacing between drops
DROP_LATCH_SEC = 0.6           # how long the drop flag stays up
QUIET_HOLD_SEC = 1.0           # sustained low RMS before quiet flag
GRID_SNAP_TOL = 0.18           # beat-phase window (±18% of a beat) counted as on-grid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [music_analyzer] %(levelname)s %(message)s",
)
log = logging.getLogger("music_analyzer")


def internal_session() -> requests.Session:
    """A requests.Session that identifies this analyzer to the Go API.

    /api/v1/internal/led/audio-metrics is on the localhost-only internal group,
    which is being given service-key authentication. This process is spawned as a
    CHILD of the API (services/music_mode_service.go:2639, exec.CommandContext with
    no cmd.Env), so it inherits INTERNAL_SERVICE_KEY with nothing to provision —
    the same route the voice sidecar takes.

    Set on the session rather than per-call so every POST through it is covered,
    including any added later. No key → no header, leaving the request identical to
    the pre-key behaviour; an empty header value would read as a wrong credential
    and be rejected rather than falling through to the dev-mode localhost path.

    audio-metrics carries no user_id and is telemetry, so it is slated to fail OPEN
    — a missing key must not cost the user their music reactivity.
    """
    session = requests.Session()
    key = os.getenv('INTERNAL_SERVICE_KEY') or ''
    if key:
        session.headers.update({'X-Internal-Service-Key': key})
    return session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def check_parent_alive() -> bool:
    """Return False when stdin hits EOF (Go parent died)."""
    if select.select([sys.stdin], [], [], 0)[0]:
        data = sys.stdin.buffer.read(1)
        if not data:  # EOF — parent died
            return False
    return True


def open_audio_stream(pa: pyaudio.PyAudio, source: str, chunk: int) -> pyaudio.Stream:
    """Open a PyAudio input stream. Source routing handled by PULSE_SOURCE env var."""
    kwargs: dict = dict(
        format=FORMAT,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=chunk,
    )
    log.info("Opening audio stream (source=%s, rate=%d, chunk=%d)", source, SAMPLE_RATE, chunk)
    try:
        stream = pa.open(**kwargs)
        log.info("Audio stream opened successfully")
        return stream
    except Exception as exc:
        log.error("Failed to open audio stream (source=%s): %s", source, exc)
        raise


# ---------------------------------------------------------------------------
# Audio capture backend: PipeWire pw-record (primary) + PyAudio fallback.
# pw-record addresses PipeWire nodes directly so mic vs system are truly isolated.
# The old PULSE_SOURCE env path is ignored by PyAudio builds without a pulse backend
# (the cause of the mic bleeding into "system" mode on this host).
# ---------------------------------------------------------------------------

def pw_record_available() -> bool:
    """True if the PipeWire pw-record CLI is on PATH."""
    return shutil.which("pw-record") is not None


def _pw_record_cmd(kind: str, low_latency: bool) -> list:
    """argv for one pw-record stream. kind = 'mic' or 'system'."""
    latency = "15ms" if low_latency else "40ms"
    cmd = ["pw-record", "--rate", str(SAMPLE_RATE), "--channels", str(CHANNELS),
           "--format", "s16", "--latency", latency]
    if kind == "system":
        # Capture the DEFAULT SINK's monitor (system playback only). A record stream
        # with stream.capture.sink=true links to the default sink's monitor instead
        # of the default source — the PipeWire equivalent of pulse @DEFAULT_MONITOR@.
        cmd += ["-P", "stream.capture.sink=true"]
    # 'mic' uses the default: a capture stream auto-links to the default source.
    cmd.append("-")  # raw stream to stdout
    return cmd


class _PwStream:
    """A single pw-record subprocess emitting s16-mono PCM on stdout."""

    def __init__(self, kind: str, low_latency: bool):
        self.kind = kind
        self._cmd = _pw_record_cmd(kind, low_latency)
        # bufsize=0 IS THE FIX FOR THE 100Hz -> 22Hz GAP.
        #
        # Default bufsize=-1 wraps stdout in a BufferedReader sized from the pipe's st_blksize,
        # which is 4096 bytes = 2048 samples = 46.4ms of audio = 4.64 analysis chunks. So the
        # capture loop blocked ~46ms on a refill, then ran ~4.6 iterations back-to-back in under a
        # millisecond, published all of them into a single-slot mailbox, and blocked again. Mean
        # 100Hz, instantaneous a burst train — and the sender, polling every 5ms into a slot that
        # holds one frame, got ONE FRAME PER BURST. 21.5 bursts/s is the 22Hz that was reaching the
        # API.
        #
        # The writer was never the cause: pw-record writes 165.8/s at 537.9B, i.e. 6.03ms of audio
        # per write, FINER than one 10ms chunk. The lumping was entirely reader-side.
        #
        # Measured with the reader buffered: read fast=78% p90=41.8ms — a bimodal 0/45ms split
        # whose MEAN (9.75ms) happens to match one 441-sample chunk at 44.1kHz. That coincidence is
        # why this hid: the mean looked exactly like the thing it was hiding.
        #
        # bufsize=0 makes reads map to syscalls that pace against audio arrival. _read_n already
        # loops over short reads, so raw FileIO semantics need nothing else here.
        self._proc = subprocess.Popen(
            self._cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
        self._out = self._proc.stdout
        self._pending = b""
        self._header_checked = False
        log.info("pw-record[%s]: %s", kind, " ".join(self._cmd))

    def _read_n(self, n: int) -> bytes:
        """Read up to exactly n bytes; returns fewer only on EOF/dead child."""
        buf = bytearray()
        while len(buf) < n:
            try:
                part = self._out.read(n - len(buf))
            except Exception:
                break
            if not part:
                break
            buf += part
        return bytes(buf)

    def _check_header(self) -> None:
        # pw-record may write a WAV (RIFF) container to stdout; skip a canonical
        # 44-byte PCM header if present, otherwise keep the bytes as raw PCM.
        head = self._read_n(4)
        if head == b"RIFF":
            self._read_n(40)  # rest of the 44-byte WAV header
        else:
            self._pending = head
        self._header_checked = True

    def read_frame(self, nbytes: int) -> bytes:
        """Return exactly nbytes of PCM. Zero-fills on EOF / dead child — NEVER raises,
        so a single failed/blocked source can't stall the analyzer (or the mix)."""
        if not self._header_checked:
            try:
                self._check_header()
            except Exception as exc:
                log.warning("pw-record[%s] header read failed: %s", self.kind, exc)
                self._header_checked = True
        out = bytearray(self._pending)
        self._pending = b""
        if len(out) < nbytes:
            out += self._read_n(nbytes - len(out))
        if len(out) < nbytes:
            if self._proc.poll() is not None:
                log.warning("pw-record[%s] exited (rc=%s); zero-filling.",
                            self.kind, self._proc.returncode)
            out += b"\x00" * (nbytes - len(out))
        elif len(out) > nbytes:
            self._pending = bytes(out[nbytes:])
            out = out[:nbytes]
        return bytes(out)

    def close(self) -> None:
        try:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=1.0)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        except Exception:
            pass


class PwCapture:
    """PyAudio-stream-shaped capture backed by pw-record. Supports mic/system/both."""

    def __init__(self, source: str, low_latency: bool):
        self.source = source
        if source == "both":
            self._streams = [_PwStream("mic", low_latency), _PwStream("system", low_latency)]
        elif source == "system":
            self._streams = [_PwStream("system", low_latency)]
        else:  # 'mic' / default
            self._streams = [_PwStream("mic", low_latency)]

    def read(self, chunk: int, exception_on_overflow: bool = False) -> bytes:
        nbytes = chunk * 2  # s16 mono = 2 bytes/sample
        if len(self._streams) == 1:
            return self._streams[0].read_frame(nbytes)
        # both: mix the two sources with clipping. read_frame() zero-fills a dead /
        # underrunning side, so one bad source never stalls the mix.
        a = np.frombuffer(self._streams[0].read_frame(nbytes), dtype=np.int16).astype(np.int32)
        b = np.frombuffer(self._streams[1].read_frame(nbytes), dtype=np.int16).astype(np.int32)
        return np.clip(a + b, -32768, 32767).astype(np.int16).tobytes()

    def stop_stream(self) -> None:  # PyAudio-compat no-op
        pass

    def close(self) -> None:
        for s in self._streams:
            s.close()


class _PyAudioCapture:
    """Fallback when pw-record is unavailable (non-PipeWire hosts). Preserves legacy
    PyAudio behaviour: mic works; 'system'/'both' degrade to best-effort."""

    def __init__(self, source: str, chunk: int):
        if source in ("system", "both"):
            os.environ["PULSE_SOURCE"] = "@DEFAULT_MONITOR@"  # only helps if a pulse backend exists
        else:
            os.environ.pop("PULSE_SOURCE", None)
        self._pa = pyaudio.PyAudio()
        self._stream = open_audio_stream(self._pa, source, chunk)

    def read(self, chunk: int, exception_on_overflow: bool = False) -> bytes:
        return self._stream.read(chunk, exception_on_overflow=exception_on_overflow)

    def stop_stream(self) -> None:
        try:
            self._stream.stop_stream()
        except Exception:
            pass

    def close(self) -> None:
        self.stop_stream()
        try:
            self._stream.close()
        except Exception:
            pass
        self._pa.terminate()


def open_capture(source: str, chunk: int, low_latency: bool):
    """Return a PyAudio-stream-shaped capture: pw-record if available, else PyAudio."""
    if pw_record_available():
        log.info("Capture backend: pw-record (PipeWire), source=%s, low_latency=%s",
                 source, low_latency)
        return PwCapture(source, low_latency)
    log.warning("pw-record not found — falling back to PyAudio (source isolation limited). "
                "source=%s", source)
    return _PyAudioCapture(source, chunk)


def freq_to_bin(freq_hz: float, chunk: int) -> int:
    """Convert a frequency in Hz to the corresponding FFT bin index for `chunk`."""
    return int(round(freq_hz * chunk / SAMPLE_RATE))


def compute_bin_ranges(chunk: int) -> list:
    """Pre-compute (lo_bin, hi_bin) FFT ranges per band for a given chunk size."""
    bin_ranges = []
    for lo_hz, hi_hz in BAND_EDGES:
        lo_bin = max(freq_to_bin(lo_hz, chunk), 1)  # skip DC at bin 0
        hi_bin = min(freq_to_bin(hi_hz, chunk), chunk // 2)
        if hi_bin <= lo_bin:
            hi_bin = lo_bin + 1  # Guarantee at least 1 FFT bin per band at small chunk sizes
        bin_ranges.append((lo_bin, hi_bin))
    return bin_ranges


def clamp_byte(value: float) -> int:
    """Clamp a float to the 0-255 integer range."""
    return max(0, min(255, int(round(value))))


def compute_metrics(samples: np.ndarray, window: np.ndarray, bin_ranges: list):
    """Pure per-chunk FFT analysis. `samples` must already be sensitivity-scaled.

    Returns (raw_bands[8], rms, total_energy). No smoothing, no normalization —
    callers decide how to smooth (legacy = Python EMA; low-latency = none, firmware
    smooths once).
    """
    windowed = samples * window
    spectrum = np.abs(np.fft.rfft(windowed))

    raw_bands = np.zeros(NUM_BANDS, dtype=np.float64)
    for i, (lo, hi) in enumerate(bin_ranges):
        if hi > lo:
            raw_bands[i] = np.mean(spectrum[lo:hi])

    rms = np.sqrt(np.mean(samples ** 2))
    total_energy = np.sum(spectrum)
    return raw_bands, rms, total_energy


def detect_beat(raw_bands: np.ndarray, rms: float, sensitivity: float,
                bass_history: collections.deque, last_beat_time: float):
    """Bass-band (0+1) beat detection with debounce. Returns (beat, bass_beat, last_beat_time)."""
    bass_energy = raw_bands[0] + raw_bands[1]
    bass_history.append(bass_energy)
    bass_avg = np.mean(bass_history) if bass_history else 1.0

    now = time.monotonic()
    beat = 0
    bass_beat = 0
    quiet = rms < (5 * sensitivity)

    if not quiet and bass_avg > 0:
        if bass_energy > bass_avg * BEAT_THRESHOLD_MULT:
            if (now - last_beat_time) >= BEAT_DEBOUNCE_SEC:
                beat = 1
                bass_beat = 1
                last_beat_time = now
    return beat, bass_beat, last_beat_time


def normalize(raw_bands: np.ndarray, rms: float, total_energy: float, chunk: int):
    """Normalize bands/volume/energy to 0-255 floats (dynamic per-frame ceiling)."""
    band_max = np.max(raw_bands) if np.max(raw_bands) > 0 else 1.0
    norm_bands = (raw_bands / band_max) * 255.0

    rms_max = 32768.0  # int16 peak
    norm_volume = (rms / rms_max) * 255.0

    energy_max = band_max * chunk  # rough normalizer
    norm_energy = (total_energy / energy_max) * 255.0 if energy_max > 0 else 0.0
    return norm_bands, norm_volume, norm_energy


class MusicBrain:
    """Tempo, beat-phase, and musical-structure tracker (Music Mode 2.0 / packet v2).

    Fed one frame per capture chunk via update(); emits the packet-v2 extras via
    fields(). Self-contained so the legacy and low-latency loops share one
    implementation. Costs: O(bands) per frame plus one autocorrelation over a
    ~6 s onset ring every TEMPO_RECALC_SEC (hundreds of samples — negligible).

    Degrades honestly: until tempo locks (confidence hysteresis), bpm reports 0
    and consumers must fall back to plain beat edges — same behavior as v1.
    """

    def __init__(self, frame_rate: float, sensitivity: float):
        self.fr = max(frame_rate, 1.0)
        self.sensitivity = sensitivity
        n_ring = int(TEMPO_WINDOW_SEC * self.fr)
        self.onsets: collections.deque = collections.deque(maxlen=n_ring)
        self.prev_bands = np.zeros(NUM_BANDS, dtype=np.float64)
        self.frames = 0
        self.recalc_every = max(1, int(TEMPO_RECALC_SEC * self.fr))
        # Tempo state
        self.bpm = 0.0
        self.locked = False
        # conf is the peak/mean autocorrelation ratio that drives the lock
        # hysteresis. It was computed and thrown away; the DJ only ever saw
        # bpm, so "locked at 107" and "locked at 176 on a track that is 103"
        # were indistinguishable downstream. Retained and published.
        self.conf = 0.0
        # Frame-to-frame spectral movement, at the analyzer's own ~100 Hz
        # rather than the 2 Hz the API and flight recorder sample at. How much
        # the strip MOVES between switches is invisible at 2 Hz, and it is what
        # a viewer actually judges.
        self._prev_bands = None
        self.flux = 0.0
        self.bpm_votes: collections.deque = collections.deque(maxlen=5)
        # Phase / bar state
        self.phase = 0.0          # [0,1) through the current beat
        self.beat_in_bar = 0      # 0-3 (assume 4/4)
        self.bar_in_phrase = 0    # 0-7 (8-bar phrases)
        # Envelope / AGC reference
        self.env = 0.0
        self.env_ref = 1e-6
        self.env_alpha = 1.0 - np.exp(-1.0 / (self.fr * ENV_TAU_SEC))
        self.ref_decay = 0.5 ** (1.0 / (self.fr * ENV_REF_HALFLIFE_SEC))
        n_env = int(8.0 * self.fr)
        self.env_hist: collections.deque = collections.deque(maxlen=n_env)
        # Bass fast/slow trackers for drop detection
        self.bass_fast = 0.0
        self.bass_slow = 0.0
        self.bass_fast_alpha = 1.0 - np.exp(-1.0 / (self.fr * 0.3))
        self.bass_slow_alpha = 1.0 - np.exp(-1.0 / (self.fr * 3.0))
        # Structure flags
        self.building = False
        self.last_build_time = 0.0
        self.last_drop_time = 0.0
        self.drop_until = 0.0
        self.quiet_since = None
        self.quiet = False
        self.centroid = 0
        # Grid snap (beat-flash quality; 2026-07-12 latency-probe findings:
        # ~40% spurious off-grid detections + ~25% missed kicks under sustained
        # bass, and pass-through detections still jittered ±60ms). While
        # tempo-locked, snap_beat() publishes beats ON THE PLL GRID TICK,
        # gated by kick EVIDENCE from the last ~1.25 beats — metronomic
        # flashes while the kick pattern holds, silence through breakdowns,
        # immediate re-entry on the first kick back. Raw behavior unlocked.
        self.grid_snap = True
        self._wrapped = False          # set by update() on each phase wrap
        self._fired_this_beat = False  # a beat flag was published this beat period
        self._grid_evidence = 0.0      # monotonic time of the last NEAR-GRID detection

    # -- internals ----------------------------------------------------------

    def _estimate_tempo(self) -> None:
        n = len(self.onsets)
        if n < int(TEMPO_MIN_FILL_SEC * self.fr):
            return
        sig = np.asarray(self.onsets, dtype=np.float64)
        sig = sig - sig.mean()
        if not np.any(sig):
            self._set_confidence(0.0, 0.0)
            return
        ac = np.correlate(sig, sig, mode="full")[n - 1:]
        lag_min = max(2, int(self.fr * 60.0 / TEMPO_MAX_BPM))
        lag_max = min(n - 2, int(self.fr * 60.0 / TEMPO_MIN_BPM))
        if lag_max <= lag_min:
            return
        window = ac[lag_min:lag_max + 1].copy()
        # Harmonic reinforcement: a true beat lag also scores at 2x its period.
        for i in range(window.size):
            lag2 = (lag_min + i) * 2
            if lag2 < n:
                window[i] += 0.5 * ac[lag2]
        # Mild prior toward the 90-150 BPM dance band.
        lags = np.arange(lag_min, lag_max + 1, dtype=np.float64)
        bpms = 60.0 * self.fr / lags
        window *= np.exp(-0.5 * ((bpms - 120.0) / 90.0) ** 2) + 0.75
        best = int(np.argmax(window))
        mean_abs = float(np.mean(np.abs(window))) or 1e-9
        conf = float(window[best]) / mean_abs
        # Parabolic interpolation around the peak for sub-lag precision.
        lag = float(lag_min + best)
        if 0 < best < window.size - 1:
            y0, y1, y2 = window[best - 1], window[best], window[best + 1]
            denom = (y0 - 2 * y1 + y2)
            if abs(denom) > 1e-12:
                lag += 0.5 * (y0 - y2) / denom
        bpm = 60.0 * self.fr / max(lag, 1e-6)
        self._set_confidence(conf, bpm)

    def _set_confidence(self, conf: float, bpm: float) -> None:
        self.conf = conf
        if conf >= TEMPO_CONF_LOCK and TEMPO_MIN_BPM <= bpm <= TEMPO_MAX_BPM:
            # Octave stability: ignore a sudden 2x/0.5x jump unless it persists.
            if self.bpm > 0 and (abs(bpm - 2 * self.bpm) < 6 or abs(2 * bpm - self.bpm) < 6):
                self.bpm_votes.append(bpm)
                if list(self.bpm_votes).count(0) == 0 and len(self.bpm_votes) == self.bpm_votes.maxlen:
                    votes = np.asarray(self.bpm_votes)
                    if np.all(np.abs(votes - votes.mean()) < 4.0):
                        self.bpm = float(np.median(votes))
                return
            self.bpm_votes.append(bpm)
            self.bpm = float(np.median(np.asarray(self.bpm_votes)))
            self.locked = True
        elif conf < TEMPO_CONF_UNLOCK and self.locked:
            self.locked = False
            self.bpm_votes.clear()
            self.phase = 0.0
            self.beat_in_bar = 0
            self.bar_in_phrase = 0

    # -- per-frame update ----------------------------------------------------

    def update(self, raw_bands: np.ndarray, rms: float, beat: int) -> None:
        # Flux is computed on PEAK-NORMALIZED bands, not raw ones. raw_bands are
        # unnormalized FFT magnitudes whose absolute scale follows input gain, so
        # differencing them directly produced a gain-dependent number that pinned
        # at the 255 ceiling on ordinary pop and carried no information at all.
        # Normalizing each frame by its own peak measures how much the spectral
        # SHAPE churns, which is scale-invariant, comparable across tracks, and
        # closer to what a viewer reads as "busy" than loudness is.
        mx = float(np.max(raw_bands)) if raw_bands.size else 0.0
        cur = (raw_bands / mx) * 255.0 if mx > 0 else np.zeros_like(raw_bands)
        if self._prev_bands is not None and len(cur) == len(self._prev_bands):
            d = float(np.mean(np.abs(cur - self._prev_bands)))
            # Same one-pole smoothing the envelope uses, so a single transient
            # cannot dominate a value sampled 50x more slowly than it is made.
            self.flux = 0.9 * self.flux + 0.1 * d
        self._prev_bands = cur
        now = time.monotonic()
        self.frames += 1

        # Onset strength: positive spectral flux across bands (sqrt-compressed).
        comp = np.sqrt(np.maximum(raw_bands, 0.0))
        flux = float(np.sum(np.maximum(comp - self.prev_bands, 0.0)))
        self.prev_bands = comp
        self.onsets.append(flux)

        # Loudness envelope against a slowly-decaying reference peak (AGC ref).
        self.env += self.env_alpha * (rms - self.env)
        self.env_ref = max(self.env_ref * self.ref_decay, rms, 1e-6)
        env_byte = clamp_byte(255.0 * self.env / self.env_ref)
        self.env_hist.append(env_byte)

        # Bass trackers for drop detection.
        bass = float(raw_bands[0] + raw_bands[1])
        self.bass_fast += self.bass_fast_alpha * (bass - self.bass_fast)
        self.bass_slow += self.bass_slow_alpha * (bass - self.bass_slow)

        # Quiet: same RMS floor the beat detector uses, sustained.
        if rms < (5 * self.sensitivity):
            if self.quiet_since is None:
                self.quiet_since = now
            self.quiet = (now - self.quiet_since) >= QUIET_HOLD_SEC
        else:
            self.quiet_since = None
            self.quiet = False

        # Tempo re-estimate on a cadence.
        if self.frames % self.recalc_every == 0:
            self._estimate_tempo()

        # Phase-locked loop: free-run at the locked tempo, nudge on real beats.
        if self.locked and self.bpm > 0:
            self.phase += self.bpm / 60.0 / self.fr
            if self.phase >= 1.0:
                self.phase -= 1.0
                self._wrapped = True  # consumed by snap_beat()
                self.beat_in_bar = (self.beat_in_bar + 1) % 4
                if self.beat_in_bar == 0:
                    self.bar_in_phrase = (self.bar_in_phrase + 1) % 8
            if beat:
                err = self.phase if self.phase < 0.5 else self.phase - 1.0
                # Only NEAR-GRID detections steer the PLL — a syncopated bass
                # hit at half-beat phase is music, not grid evidence, and
                # letting it yank the phase is what made the grid wander
                # (probe 2026-07-12: snapped σ ~60ms on busy basslines).
                if abs(err) <= 0.25:
                    self.phase -= PHASE_CORRECT_GAIN * err
                    if self.phase < 0.0:
                        self.phase += 1.0
                    self._grid_evidence = time.monotonic()

        # Build: sustained envelope rise vs ~8s and ~4s ago, loud enough, not quiet.
        h = self.env_hist
        if len(h) >= h.maxlen and not self.quiet:
            old = h[0]
            mid = h[len(h) // 2]
            newest = h[-1]
            self.building = (newest > BUILD_MIN_ENV
                             and newest > mid >= old
                             and newest >= old * BUILD_RISE_RATIO)
        else:
            self.building = False
        if self.building:
            self.last_build_time = now

        # Drop: bass slams back after a recent build, rate-limited, latched briefly.
        if (bass > 0 and self.bass_slow > 0
                and self.bass_fast > DROP_BASS_RATIO * self.bass_slow
                and (now - self.last_build_time) < 3.0
                and (now - self.last_drop_time) >= DROP_REARM_SEC
                and not self.quiet):
            self.last_drop_time = now
            self.drop_until = now + DROP_LATCH_SEC

        # Spectral centroid proxy: band-index weighted energy → 0-255.
        total = float(np.sum(raw_bands))
        if total > 0:
            idx = float(np.dot(raw_bands, np.arange(NUM_BANDS))) / total
            self.centroid = clamp_byte(255.0 * idx / (NUM_BANDS - 1))
        else:
            self.centroid = 0

    def snap_beat(self, detected: int) -> int:
        """Grid-quality gate for the PUBLISHED beat flag (call after update();
        update() must keep receiving the RAW detection so the PLL still corrects
        from every real kick).

        Unlocked (or disabled): pass the detection through unchanged.
        Locked: beats publish ON THE GRID TICK (phase wrap), gated by kick
        evidence — a raw detection within the last ~1.25 beat periods. Steady
        kick pattern → one flash per beat, exactly on the grid, zero detection
        jitter. Breakdown (kicks stop) → flashes stop within a beat. Pattern
        restart → the first kick fires immediately if it lands just after an
        unserved grid tick (low-latency re-entry), then the grid clock owns
        the train again. Off-grid syncopated bass never flashes — that is the
        "sometimes early, sometimes late" artifact this replaces.
        """
        if not self.grid_snap or not self.locked or self.bpm <= 0:
            self._wrapped = False
            return detected

        now = time.monotonic()
        beat_period = 60.0 / self.bpm

        out = 0
        if self._wrapped:
            self._wrapped = False
            served = self._fired_this_beat
            self._fired_this_beat = False
            # Evidence = a NEAR-GRID kick within the last ~2.3 beats (set by
            # update()'s gated PLL correction) — one skipped kick keeps the
            # train alive, a breakdown stops it within two beats.
            if not served and (now - self._grid_evidence) <= 2.3 * beat_period:
                out = 1                       # grid tick, pattern alive → flash
                self._fired_this_beat = True

        # Pattern re-entry: a kick just after an UNSERVED grid tick fires now
        # (± one frame of the grid) instead of waiting a whole beat.
        if not out and detected and not self._fired_this_beat and self.phase <= GRID_SNAP_TOL:
            out = 1
            self._fired_this_beat = True
        return out

    def fields(self) -> dict:
        now = time.monotonic()
        flags = ((1 if self.building else 0)
                 | ((1 if now < self.drop_until else 0) << 1)
                 | ((1 if self.quiet else 0) << 2))
        return {
            "bpm": clamp_byte(self.bpm) if self.locked else 0,
            "bph": int(self.phase * 256.0) & 0xFF,
            "bar": ((self.beat_in_bar & 0x03) << 6) | (self.bar_in_phrase & 0x3F),
            "env": self.env_hist[-1] if self.env_hist else 0,
            "fl": flags,
            "sc": self.centroid,
            # tcf: tempo confidence, x10 and clamped, so 2.2 (the lock
            # threshold) reads as 22. A consumer can tell a firm lock from a
            # marginal one instead of trusting bpm equally in both cases.
            "tcf": clamp_byte(int(self.conf * 10.0)),
            "flx": clamp_byte(int(self.flux)),
        }


# How far the audio clock may drift from wall clock before it is re-anchored.
#
# Must exceed the NATURAL cyclic lag: audio arrives in ~39ms bursts, so the audio clock sits up to
# one burst behind wall clock and catches up when the next burst lands. That lag is CORRECT — the
# samples really are that old — and re-anchoring on it would reintroduce the clustering this fix
# removes. 500ms is clear of the cycle while still correcting a real clock step promptly.
TS_REANCHOR_MS = 500.0


def build_payload(bands: np.ndarray, norm_volume: float, norm_energy: float,
                  beat: int, bass_beat: int, peak_band: int, extra: dict = None,
                  ts_ms: int = None) -> dict:
    payload = {
        "b": [clamp_byte(v) for v in bands],
        "v": clamp_byte(norm_volume),
        "e": clamp_byte(norm_energy),
        "bt": beat,
        "bb": bass_beat,
        "pk": peak_band,
        # AUDIO TIME, NOT WALL CLOCK — see the audio-clock block in _capture_loop.
        #
        # This was int(time.time()*1000), stamped at analysis completion. Audio arrives in bursts,
        # so a burst's 4-5 frames were analysed inside ~1.2ms and every one carried the SAME
        # millisecond. Two Go consumers key on this field, and paceGate.Allow reads equal timestamps
        # as "no time has passed" and blocks the frame. Measured 2026-08-19: closing the analyzer
        # gap took ingest 22.8 -> 93.9 Hz while the DEVICE rate FELL 22.8 -> 19.2 pps, because
        # 74.3 frames/s were rate-capped on clustered timestamps.
        "ts": int(time.time() * 1000) if ts_ms is None else ts_ms,
    }
    if extra:
        payload.update(extra)
    return payload


# ---------------------------------------------------------------------------
# Low-latency mode (Step 6): decoupled capture + sender threads
# ---------------------------------------------------------------------------

FRAME_QUEUE_MAXLEN = 64  # see FrameChannel — sized from the POST timeout, not the steady state


class FrameChannel:
    """Bounded drop-oldest frame queue between the capture and sender threads.

    THIS WAS A SINGLE SLOT AND THE SINGLE SLOT WAS THE 100Hz -> 22Hz GAP.

    Its docstring used to say: "Do NOT 'fix' this into a queue: a queue reintroduces
    backlog/latency; overwrite-newest is the whole point." That reasoning assumed a SLOW SENDER.
    Measured 2026-08-19, the sender is not slow — POST is 1.1ms p50 / 1.5ms p90, roughly 900
    frames/s of drain against a 100/s fill. What is slow is nothing; what was lossy was the handoff.

    The capture loop analyses and publishes at 100.3Hz, but audio ARRIVES in lumps: the capture
    thread blocks 25.7 times a second and then runs 3.90 iterations back-to-back in under a
    millisecond. A sender polling a ONE-FRAME mailbox every 5ms takes one frame per lump however
    often it looks, which is 23.8Hz. The other ~76% were overwritten before anyone could read them.

    Draining a 3.90-frame burst costs 5.9ms at POST p90 against a 38.9ms burst period — 6.6x
    headroom — so the queue drains to empty long before the next lump and NEVER accumulates the
    backlog the original docstring feared. That fear was correct about a slow sender and this is
    not one.

    maxlen=64 IS SIZED FROM THE FAILURE CASE, NOT THE STEADY ONE. Steady depth is ~4. One POST that
    hits its 0.5s timeout queues ~50 frames at 100Hz, so 64 absorbs a full timeout without dropping.
    Sizing to the steady state would have made every timeout an overflow.

    THREADING: exactly one producer (capture) and exactly one consumer (sender). deque.append and
    deque.popleft are atomic under the GIL, so no lock is needed — the same reasoning the single
    slot used. The overflow branch in set() is multi-step but only the producer runs it.
    """

    def __init__(self, maxlen: int = FRAME_QUEUE_MAXLEN):
        self._dq = collections.deque()
        self._maxlen = maxlen
        self.overflowed = 0
        self.max_depth = 0

    def set(self, payload: dict) -> None:
        """Publish one frame. Producer side only."""
        if len(self._dq) >= self._maxlen:
            # OVERFLOW: drop the OLDEST, but carry its transients forward first.
            #
            # THE END MATTERS AND IS NAMED ON PURPOSE. dq[0] is the pop end — the next frame the
            # sender will take — so a rescued beat fires on the very next send. OR-ing into the
            # APPEND end (dq[-1]) would delay it by the full queue depth: 64 frames at 100Hz is
            # 640ms, far past any perceptual bound, while still looking like a working feature.
            #
            # Beat, bass-beat and structural flags are single-frame pulses and are the only things
            # destroyed by being skipped; bands and scalars are superseded by the newer frame
            # anyway, which is why only these three carry.
            dropped = self._dq.popleft()
            if self._dq:
                head = self._dq[0]
                head["bt"] = head.get("bt", 0) | dropped.get("bt", 0)
                head["bb"] = head.get("bb", 0) | dropped.get("bb", 0)
                head["fl"] = head.get("fl", 0) | dropped.get("fl", 0)
            self.overflowed += 1
        self._dq.append(payload)
        if len(self._dq) > self.max_depth:
            self.max_depth = len(self._dq)

    def get(self):
        """Take the oldest frame, or None when empty. CONSUMING, and SINGLE-CONSUMER ONLY.

        THE INVARIANT, STATED HERE BECAUSE IT LIVED ONLY IN A COMMIT MESSAGE: exactly one caller
        may consume this channel. A second reader — a debug endpoint, a metrics scrape, a future
        consumer — would take frames the sender never sees, and NOTHING WOULD ERROR ANYWHERE. The
        symptom would be a halved send rate with every component reporting healthy.

        This was already true of the single-slot version, where a second reader stole accumulated
        beats. With a queue it is worse in blast radius (whole frames, not just transients) and
        more obvious in structure (each frame pops exactly once), which is not the same as being
        enforced. It is not enforced. Do not add a second consumer.
        """
        try:
            return self._dq.popleft()
        except IndexError:
            return None

    def depth(self) -> int:
        return len(self._dq)

def _capture_loop(capture, chunk, window, bin_ranges, sensitivity,
                  frames: FrameChannel, stop_event: threading.Event,
                  grid_snap: bool = True) -> None:
    """Capture + analyse as fast as the audio device delivers; publish latest frame.

    NO Python EMA here (B2): smoothing happens once, in firmware. We publish
    near-raw normalized bands so the firmware's single EMA stage is the only
    smoothing — eliminating the cascaded double-EMA lag.
    """
    bass_history: collections.deque = collections.deque(maxlen=BEAT_HISTORY_LEN)
    last_beat_time = 0.0
    brain = MusicBrain(frame_rate=SAMPLE_RATE / chunk, sensitivity=sensitivity)
    brain.grid_snap = grid_snap

    # PHASE TIMING. The host observes ~23 frames/sec from a path configured for 441-sample (10ms)
    # chunks, i.e. up to 100Hz — a 4x gap. Which phase owns it decides two very different jobs:
    #
    #   read() dominates      -> PulseAudio is handing back a fragment much larger than we asked
    #                            for (43ms is ~1900 samples, i.e. a 2048 fragment). The analyzer is
    #                            not slow, it is WAITING, and the fix is a fragsize attribute.
    #   analysis dominates    -> real optimisation work, and a different evening.
    #
    # Inferring this from "the sender is not throttled" was sound but indirect. This measures it.
    # t_tail covers everything AFTER beat detection — normalize, argmax, the PLL update,
    # snap_beat and build_payload. Timing only read/fft/beat and calling the result 'the loop'
    # answered a narrower question than the one asked: it reported a 100Hz ceiling while the
    # loop was actually turning over at ~45ms.
    t_read = t_fft = t_beat = t_tail = 0.0
    n_timed = 0
    # read_samples makes the read distribution visible. t_read alone is a MEAN, and the mean here
    # is 9.75ms over a bimodal 0/45ms split — ~78% of reads return instantly from the pipe's
    # BufferedReader and ~22% block for a refill. 9.75 pattern-matches "exactly one 441-sample
    # chunk at 44.1kHz", which is a coincidence of the mean and is why the burst hid for so long.
    # fast% and p90 are what distinguish "every read costs 9.75ms" from "one read in 4.6 costs 45".
    read_samples = []
    # AUDIO CLOCK. Advances one chunk period per frame instead of reading the wall clock, so a
    # burst's frames carry correctly-spaced timestamps rather than all sharing one millisecond.
    # Anchored to wall clock at start and re-anchored only on a large divergence, so it stays
    # comparable for consumers that diff it against time.Now().
    chunk_ms = 1000.0 * chunk / SAMPLE_RATE
    audio_ts = time.time() * 1000.0
    # w0 is the TRUE wall-clock window start. The loop= figure below is the SUM OF THE PARTS, so
    # its residual is identically zero by construction and it can never detect a gap. wall= is the
    # independent whole those parts must reconcile against.
    w0 = time.perf_counter()
    while not stop_event.is_set():
        _t0 = time.perf_counter()
        try:
            raw = capture.read(chunk, exception_on_overflow=False)
        except IOError as exc:
            log.warning("Audio read error: %s", exc)
            continue
        _t1 = time.perf_counter()

        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64) * sensitivity
        raw_bands, rms, total_energy = compute_metrics(samples, window, bin_ranges)
        _t2 = time.perf_counter()
        beat, bass_beat, last_beat_time = detect_beat(raw_bands, rms, sensitivity, bass_history, last_beat_time)
        _t3 = time.perf_counter()

        # MONOTONIC BY CONSTRUCTION. ts must never decrease: paceGate.Allow computes
        # captureMs - lastSentAtMs, so a backward step goes negative, reads as < minGap, and the
        # gate BLOCKS until ts climbs back past the old value — ~15 frames of silence for a 500ms
        # step, reported as nothing but normal pacing. That is the exact mirror of the ts==0 defect
        # documented at Allow, where a zero timestamp leaves the gate permanently OPEN. Same root:
        # the gate assumes monotonic ts and nothing on its side enforces it, so it is enforced here.
        _wall_ms = time.time() * 1000.0
        _lag = _wall_ms - audio_ts
        _step = chunk_ms
        if _lag > TS_REANCHOR_MS:
            # Behind wall clock: jump FORWARD, which is safe because ts still increases. Causes are
            # a wall-clock step forward or an audio device running slow.
            log.warning("audio clock re-anchored forward: was %.0fms behind wall clock", _lag)
            audio_ts = _wall_ms
        elif _lag < -TS_REANCHOR_MS:
            # Ahead of wall clock: SLEW, never jump back. 1% per frame converges ~10ms/s, so a
            # 500ms lead closes in under a minute while ts never decreases.
            _step = chunk_ms * 0.99
        frame_ts = int(audio_ts)
        audio_ts += _step

        norm_bands, norm_volume, norm_energy = normalize(raw_bands, rms, total_energy, chunk)
        peak_band = int(np.argmax(norm_bands))
        brain.update(raw_bands, rms, beat)
        published = brain.snap_beat(beat)
        frames.set(build_payload(norm_bands, norm_volume, norm_energy, published,
                                  published and bass_beat, peak_band, extra=brain.fields(),
                                  ts_ms=frame_ts))
        _t4 = time.perf_counter()

        t_read += _t1 - _t0
        t_fft  += _t2 - _t1
        t_beat += _t3 - _t2
        t_tail += _t4 - _t3
        read_samples.append(_t1 - _t0)
        n_timed += 1
        if n_timed >= 200:
            total = t_read + t_fft + t_beat + t_tail
            wall = time.perf_counter() - w0
            read_samples.sort()
            fast = sum(1 for v in read_samples if v < 0.001)
            p90 = read_samples[int(0.9 * (len(read_samples) - 1))]
            log.info("PHASE-SPLIT over %d frames: read=%.2f fft=%.2f beat=%.2f TAIL=%.2f ms "
                     "| parts=%.2fms/frame (%.1f Hz) | WALL=%.2fms/frame (%.1f Hz) "
                     "| read fast=%.0f%% p90=%.1fms | tail is %.0f%% of it",
                     n_timed, 1000*t_read/n_timed, 1000*t_fft/n_timed, 1000*t_beat/n_timed,
                     1000*t_tail/n_timed, 1000*total/n_timed, n_timed/total if total else 0,
                     1000*wall/n_timed, n_timed/wall if wall else 0,
                     100.0*fast/n_timed, 1000*p90,
                     100*t_tail/total if total else 0)
            t_read = t_fft = t_beat = t_tail = 0.0
            read_samples = []
            n_timed = 0
            w0 = time.perf_counter()


def _sender_loop(frames: FrameChannel, endpoint: str, session: requests.Session,
                 stop_event: threading.Event, chunk: int = CHUNK_SIZE_LOW_LATENCY) -> None:
    """Send the most recent captured frame; never blocks capture. Self-exits the
    process (matching legacy behaviour) after a sustained POST outage."""
    warn_at, backoff_at, self_exit_at = failure_thresholds(chunk)
    frame_count = 0
    success_count = 0
    fail_count = 0
    consecutive_failures = 0

    _lat = []
    # SENDER-POLL: the measurement the handoff pre-registered. poll-to-poll ~5ms with most polls
    # stale means the sender is fine and seq genuinely is not advancing (a publish/visibility
    # problem); ~45ms would mean the thread is not being scheduled. Recording it in-process so the
    # answer does not rest on /proc context-switch arithmetic from outside.
    _polls = []
    _stale = 0
    _t_poll = time.perf_counter()
    # _drained counts consecutive pops WITHOUT sleeping — i.e. how much of a burst one wake takes.
    # It is the most direct proof fix 2 works: 1 means the drain loop is not draining, ~4 means it
    # is taking whole bursts. It also justifies FRAME_QUEUE_MAXLEN by data instead of by taste.
    _drained = 0
    _max_drained = 0
    while not stop_event.is_set():
        _now = time.perf_counter()
        _polls.append(_now - _t_poll)
        _t_poll = _now
        if len(_polls) >= 200:
            _polls.sort()
            _n = len(_polls)
            log.info("SENDER-POLL over %d polls: p50=%.2f p90=%.2f max=%.2f ms | %.0f%% empty "
                     "| %.1f frames/s implied | max drained per wake=%d, depth=%d, overflow=%d",
                     _n, 1000*_polls[_n//2], 1000*_polls[9*_n//10], 1000*_polls[-1],
                     100.0*_stale/_n,
                     (_n - _stale) / sum(_polls) if sum(_polls) else 0,
                     _max_drained, frames.max_depth, frames.overflowed)
            _polls = []
            _stale = 0
            _max_drained = 0
            frames.max_depth = 0

        payload = frames.get()
        if payload is None:
            # EMPTY, not stale. The sleep happens ONLY here — a non-empty queue loops straight back
            # and pops again, which is the half of fix 2 that actually drains the burst. Sleeping
            # between pops would reinstate the one-frame-per-burst behaviour with extra steps.
            _stale += 1
            if _drained > _max_drained:
                _max_drained = _drained
            _drained = 0
            time.sleep(0.005)
            continue
        _drained += 1

        ok = False
        try:
            _p0 = time.perf_counter()
            resp = session.post(
                endpoint,
                data=json.dumps(payload, separators=(",", ":")),
                headers={"Content-Type": "application/json"},
                timeout=0.5,
            )
            _pd = (time.perf_counter() - _p0) * 1000.0
            _lat.append(_pd)
            if len(_lat) >= 200:
                _lat.sort()
                # NAGLE / DELAYED-ACK SIGNATURE: a hard cluster at ~40ms with a thin tail. Real
                # work produces a smooth distribution instead. p50 and p90 both pinned near 40
                # with a tiny p10 is the tell — the socket is waiting on a deliberately delayed
                # ACK, not doing anything.
                _n = len(_lat)
                _near40 = sum(1 for v in _lat if 35.0 <= v <= 45.0)
                log.info("POST-LATENCY over %d: p10=%.1f p50=%.1f p90=%.1f max=%.1f ms | "
                         "%.0f%% in the 35-45ms band (Nagle/delayed-ACK signature)",
                         _n, _lat[_n//10], _lat[_n//2], _lat[9*_n//10], _lat[-1],
                         100.0*_near40/_n)
                _lat.clear()
            resp.raise_for_status()
            ok = True
        except requests.RequestException as exc:
            log.warning("HTTP POST failed: %s", exc)

        frame_count += 1
        if ok:
            success_count += 1
            consecutive_failures = 0
        else:
            fail_count += 1
            consecutive_failures += 1
            if consecutive_failures == warn_at:
                log.warning("POST failures sustained for ~%.0fs (%d consecutive)",
                            POST_WARN_AFTER_SEC, consecutive_failures)
            elif consecutive_failures == backoff_at:
                log.warning("POST failures sustained for ~%.0fs, backing off (%d consecutive)",
                            POST_BACKOFF_AFTER_SEC, consecutive_failures)
                time.sleep(0.5)
            elif consecutive_failures >= self_exit_at:
                log.error("FATAL: %d consecutive POST failures (>=~%.0fs at %.0f Hz). Go API "
                          "unreachable. Self-exiting so Go side can cleanup.",
                          self_exit_at, POST_SELF_EXIT_AFTER_SEC, SAMPLE_RATE / float(chunk))
                stop_event.set()
                os._exit(1)

        if frame_count % 100 == 0:
            log.info("Stats(low-latency): frames=%d ok=%d fail=%d", frame_count, success_count, fail_count)


def run_low_latency(source: str, sensitivity: float, api_url: str, grid_snap: bool = True) -> None:
    endpoint = f"{api_url}/api/v1/internal/led/audio-metrics"
    session = internal_session()
    chunk = CHUNK_SIZE_LOW_LATENCY

    log.info("Low-latency mode: chunk=%d (~%.0fms)", chunk, 1000.0 * chunk / SAMPLE_RATE)

    try:
        capture = open_capture(source, chunk, low_latency=True)
    except Exception as exc:
        log.error("Failed to open audio capture: %s", exc)
        sys.exit(1)

    window = np.hanning(chunk).astype(np.float32)
    bin_ranges = compute_bin_ranges(chunk)

    log.info("Streaming (low-latency, decoupled capture/send) -> %s", endpoint)
    log.info("Waiting 1s for initial ErgoLED setup to complete...")
    time.sleep(1.0)

    frames = FrameChannel()
    stop_event = threading.Event()
    cap = threading.Thread(target=_capture_loop,
                           args=(capture, chunk, window, bin_ranges, sensitivity, frames, stop_event, grid_snap),
                           name="capture", daemon=True)
    snd = threading.Thread(target=_sender_loop,
                           args=(frames, endpoint, session, stop_event, chunk),
                           name="sender", daemon=True)
    cap.start()
    snd.start()

    try:
        while not stop_event.is_set():
            if not check_parent_alive():
                log.info("Parent process gone (stdin EOF). Exiting.")
                break
            if not cap.is_alive() or not snd.is_alive():
                log.warning("A worker thread exited; shutting down.")
                break
            time.sleep(0.1)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")
    finally:
        stop_event.set()
        cap.join(timeout=1.0)
        snd.join(timeout=1.0)
        log.info("Shutting down audio capture.")
        capture.close()


# ---------------------------------------------------------------------------
# Legacy mode: single-threaded capture → EMA → POST (rollback path)
# ---------------------------------------------------------------------------

def run(source: str, sensitivity: float, api_url: str, grid_snap: bool = True) -> None:
    endpoint = f"{api_url}/api/v1/internal/led/audio-metrics"
    session = internal_session()

    try:
        capture = open_capture(source, CHUNK_SIZE, low_latency=False)
    except Exception as exc:
        log.error("Failed to open audio capture: %s", exc)
        sys.exit(1)

    warn_at, backoff_at, self_exit_at = failure_thresholds(CHUNK_SIZE)

    bin_ranges = compute_bin_ranges(CHUNK_SIZE)
    window = np.hanning(CHUNK_SIZE).astype(np.float32)

    # EMA-smoothed band values (legacy Python-side smoothing)
    smooth_bands = np.zeros(NUM_BANDS, dtype=np.float64)

    bass_history: collections.deque = collections.deque(maxlen=BEAT_HISTORY_LEN)
    last_beat_time: float = 0.0
    brain = MusicBrain(frame_rate=SAMPLE_RATE / CHUNK_SIZE, sensitivity=sensitivity)
    brain.grid_snap = grid_snap

    log.info("Streaming at ~50 Hz -> %s", endpoint)
    log.info("Waiting 1s for initial ErgoLED setup to complete...")
    time.sleep(1.0)

    frame_count = 0
    success_count = 0
    fail_count = 0
    consecutive_failures = 0

    try:
        while True:
            if not check_parent_alive():
                log.info("Parent process gone (stdin EOF). Exiting.")
                break

            try:
                raw = capture.read(CHUNK_SIZE, exception_on_overflow=False)
            except IOError as exc:
                log.warning("Audio read error: %s", exc)
                continue

            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64) * sensitivity
            raw_bands, rms, total_energy = compute_metrics(samples, window, bin_ranges)
            beat, bass_beat, last_beat_time = detect_beat(raw_bands, rms, sensitivity, bass_history, last_beat_time)
            norm_bands, norm_volume, norm_energy = normalize(raw_bands, rms, total_energy, CHUNK_SIZE)

            # Asymmetric EMA smoothing per band (legacy)
            for i in range(NUM_BANDS):
                alpha = EMA_ATTACK_ALPHA if norm_bands[i] > smooth_bands[i] else EMA_DECAY_ALPHA
                smooth_bands[i] = alpha * norm_bands[i] + (1.0 - alpha) * smooth_bands[i]

            peak_band = int(np.argmax(smooth_bands))
            brain.update(raw_bands, rms, beat)  # PLL corrects from the RAW detection
            published = brain.snap_beat(beat)   # grid-quality gate on what firmware sees
            payload = build_payload(smooth_bands, norm_volume, norm_energy, published,
                                    published and bass_beat, peak_band, extra=brain.fields())

            post_succeeded = False
            try:
                resp = session.post(
                    endpoint,
                    data=json.dumps(payload, separators=(",", ":")),
                    headers={"Content-Type": "application/json"},
                    timeout=0.5,
                )
                resp.raise_for_status()
                post_succeeded = True
            except requests.RequestException as exc:
                log.warning("HTTP POST failed: %s", exc)

            frame_count += 1
            if post_succeeded:
                success_count += 1
                consecutive_failures = 0
            else:
                fail_count += 1
                consecutive_failures += 1

                if consecutive_failures == warn_at:
                    log.warning("POST failures sustained for ~%.0fs (%d consecutive)",
                                POST_WARN_AFTER_SEC, consecutive_failures)
                elif consecutive_failures == backoff_at:
                    log.warning("POST failures sustained for ~%.0fs, backing off (%d consecutive)",
                                POST_BACKOFF_AFTER_SEC, consecutive_failures)
                    time.sleep(0.5)
                elif consecutive_failures >= self_exit_at:
                    log.error("FATAL: %d consecutive POST failures (>=~%.0fs at %.0f Hz). "
                              "Go API unreachable. Self-exiting so Go side can cleanup.",
                              self_exit_at, POST_SELF_EXIT_AFTER_SEC, SAMPLE_RATE / float(CHUNK_SIZE))
                    sys.exit(1)

            if frame_count % 50 == 0:
                log.info("Stats: frames=%d ok=%d fail=%d bands=%s vol=%d",
                         frame_count, success_count, fail_count,
                         [clamp_byte(v) for v in smooth_bands], clamp_byte(norm_volume))

    except KeyboardInterrupt:
        log.info("Interrupted by user.")
    finally:
        log.info("Shutting down audio capture.")
        capture.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="ErgoLED Music Analyzer — captures audio, runs FFT, posts metrics to Go API.",
    )
    parser.add_argument(
        "--source",
        choices=["mic", "system", "both"],
        default="mic",
        help='Audio source: "mic" (microphone), "system" (default sink monitor), '
             'or "both" (mic + system mixed)',
    )
    parser.add_argument(
        "--sensitivity",
        type=float,
        default=1.0,
        help="Gain multiplier applied to raw samples (default: 1.0)",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:5000",
        help="Go API base URL (default: http://localhost:5000)",
    )
    parser.add_argument(
        "--no-grid-snap",
        action="store_true",
        help="Disable beat grid-snapping (suppress off-grid flashes / synthesize "
             "missed ones while tempo-locked). Rollback flag for the 2026-07-12 "
             "beat-quality change; Go passes it when MUSIC_BEAT_GRID_SNAP=false.",
    )
    parser.add_argument(
        "--low-latency",
        action="store_true",
        help="Step 6: decoupled capture/send threads + PULSE_LATENCY_MSEC + single-stage "
             "(firmware) smoothing. Enabled by Go when MUSIC_ANALYZER_LOW_LATENCY_V2 is on.",
    )
    args = parser.parse_args()

    if args.low_latency:
        run_low_latency(source=args.source, sensitivity=args.sensitivity, api_url=args.api_url,
                        grid_snap=not args.no_grid_snap)
    else:
        run(source=args.source, sensitivity=args.sensitivity, api_url=args.api_url,
            grid_snap=not args.no_grid_snap)
