#!/usr/bin/env python3
"""The Director's Sound lane (plan rev 3, P2, 17 Nov 2026): small files cut from a film cut's score, for the browser.

  python3 tools/experience/build-score-preview.py <cut dir> [--force]

Reads <cut>/score/score.wav (48 kHz, gitignored: built where the film is frozen), score/tempo-map.json and edl.json.
Writes, next to them (additive; nothing the film reads):
  score/preview/<chapter>.opus   96 kbps stereo, the chapter's window +-1.5 s (what the Director plays)
  score/peaks.json               per chapter: mono min / max / RMS at 200 Hz as int8 (-127..127), the window's t0
  score/inputs.json              what the score was built for: every chapter's start and length, the dissolves, the
                                 hits; the Director compares the live cut with it ("Rise is 20 s; the score was built for 18 s")
All three carry wav_sha256 (the score.wav they were cut from). Re-running with the same score.wav does nothing
unless --force. Needs ffmpeg with libopus.
"""
import argparse, hashlib, json, os, subprocess, sys
import numpy as np

PAD = 1.5          # seconds of score either side of a chapter (its dissolves)
RATE = 200         # peaks a second
SR = 48000


def sha_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def windows(edl):
    """Per chapter: start, length, and the dissolves at its head and tail in chapter seconds (centre, length)."""
    ch, X = edl['chapters'], float(edl['dissolve'])
    tr = [v if isinstance(v, list) else [v, 0] for v in edl.get('transitions', [X] * (len(ch) - 1))]
    xd = [min(X, float(v[0])) for v in tr]; xs = [float(v[1]) for v in tr]
    out = {}
    for i, c in enumerate(ch):
        head = tail = None
        if i: centre = (ch[i - 1]['end'] + c['start']) / 2 + xs[i - 1]; head = [round(centre - c['start'], 3), xd[i - 1]]
        if i < len(ch) - 1: centre = (c['end'] + ch[i + 1]['start']) / 2 + xs[i]; tail = [round(centre - c['start'], 3), xd[i]]
        out[c['id']] = dict(start=float(c['start']), seconds=float(c['duration']), head=head, tail=tail)
    return out


def decode_mono(wav):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def peaks(x, t0, t1):
    """min, max, rms per 1/RATE s over [t0, t1) film seconds (zeros outside the score), int8."""
    n = int(round((t1 - t0) * RATE)); per = SR // RATE
    a = int(round(t0 * SR)); seg = np.zeros(n * per, dtype=np.float32)
    lo, hi = max(0, a), min(len(x), a + n * per)
    if hi > lo: seg[lo - a:hi - a] = x[lo:hi]
    blocks = seg.reshape(n, per)
    q = lambda v: np.clip(np.round(v * 127), -127, 127).astype(int).tolist()
    return q(blocks.min(1)), q(blocks.max(1)), q(np.sqrt((blocks.astype(np.float64) ** 2).mean(1)))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('cut'); ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    cut = os.path.abspath(a.cut); score = os.path.join(cut, 'score'); wav = os.path.join(score, 'score.wav')
    if not os.path.exists(wav): sys.exit(f'no {wav}: build the score first (tools/experience/build-cine-score.py)')
    tm = json.load(open(os.path.join(score, 'tempo-map.json'))); edl = json.load(open(os.path.join(cut, 'edl.json')))
    sha = sha_file(wav)
    if tm.get('wav_sha256') and tm['wav_sha256'] != sha: print('note: tempo-map.json describes another score.wav; the preview follows the wav itself', file=sys.stderr)
    done = os.path.join(score, 'inputs.json')
    if not a.force and os.path.exists(done) and json.load(open(done)).get('wav_sha256') == sha and os.path.exists(os.path.join(score, 'peaks.json')):
        print('score preview is up to date'); return
    win = windows(edl); total = float(edl['total'])
    os.makedirs(os.path.join(score, 'preview'), exist_ok=True)
    x = decode_mono(wav); pk = {}
    for cid, w in win.items():
        t0 = max(0.0, w['start'] - PAD); t1 = min(total, w['start'] + w['seconds'] + PAD)
        clip = os.path.join(score, 'preview', cid + '.opus')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.4f}', '-t', f'{t1 - t0:.4f}', '-i', wav, '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', clip], check=True)
        lo, hi, rms = peaks(x, t0, t1)
        pk[cid] = dict(t0=round(t0, 4), t1=round(t1, 4), clip=f'preview/{cid}.opus', min=lo, max=hi, rms=rms)
        print(f'  {cid}: {t0:.2f}-{t1:.2f} s, {os.path.getsize(clip) // 1024} KB')
    json.dump(dict(schema='ergoflex.score-peaks', rate=RATE, wav_sha256=sha, chapters=pk), open(os.path.join(score, 'peaks.json'), 'w'), separators=(',', ':'))
    hits = tm.get('hits', {})
    json.dump(dict(schema='ergoflex.score-inputs', wav_sha256=sha, inputs_sha256=tm.get('inputs_sha256'), total=total, chapters=win, hits=hits,
                   order=[c['id'] for c in edl['chapters']]), open(done, 'w'), indent=1)
    print(f'score preview: {len(win)} chapters -> {os.path.relpath(score)}')


if __name__ == '__main__':
    main()
