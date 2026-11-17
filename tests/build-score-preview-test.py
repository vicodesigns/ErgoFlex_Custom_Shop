"""build-score-preview.py on a synthetic two-chapter cut: clip lengths (the chapter +-1.5 s), peaks at 200 Hz, the
transient where it was put, the dissolves, the sha stamp, and that a second run with the same score.wav does nothing.
  python3 tests/build-score-preview-test.py"""
import json, os, subprocess, sys, tempfile, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.join(HERE, '..', 'tools', 'experience', 'build-score-preview.py')
with tempfile.TemporaryDirectory() as cut:
    os.makedirs(os.path.join(cut, 'score'))
    sr, total = 48000, 20.0
    x = np.zeros(int(sr * total), dtype=np.float32); x[int(12.0 * sr):int(12.05 * sr)] = 0.9   # a hit at 12.000 s
    with wave.open(os.path.join(cut, 'score', 'score.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); s16 = (x * 32767).astype('<i2'); w.writeframes(np.repeat(s16, 2).tobytes())
    edl = dict(fps=30, dissolve=1.0, total=total, transitions=[1.0], chapters=[dict(id='a', duration=10.5, start=0.0, end=10.5), dict(id='b', duration=10.5, start=9.5, end=20.0)])
    json.dump(edl, open(os.path.join(cut, 'edl.json'), 'w'))
    json.dump(dict(chapters=dict(a=dict(start=0.0), b=dict(start=9.5)), hits=dict(logo=12.0)), open(os.path.join(cut, 'score', 'tempo-map.json'), 'w'))
    out = subprocess.run([sys.executable, TOOL, cut], capture_output=True, text=True); assert out.returncode == 0, out.stderr
    pk = json.load(open(os.path.join(cut, 'score', 'peaks.json'))); inp = json.load(open(os.path.join(cut, 'score', 'inputs.json')))
    assert pk['wav_sha256'] == inp['wav_sha256'] and len(inp['wav_sha256']) == 64
    b = pk['chapters']['b']; assert b['t0'] == 8.0 and b['t1'] == 20.0, b['t0']
    assert len(b['max']) == round((20.0 - 8.0) * 200)
    i = max(range(len(b['max'])), key=lambda k: b['max'][k]); assert abs(8.0 + i / 200 - 12.0) <= 0.01, i
    assert inp['chapters']['b']['head'] == [0.5, 1.0] and inp['chapters']['a']['tail'] == [10.0, 1.0], inp['chapters']
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(cut, 'score', 'preview', 'b.opus')], capture_output=True, text=True).stdout)
    assert abs(dur - 12.0) < 0.05, dur
    again = subprocess.run([sys.executable, TOOL, cut], capture_output=True, text=True); assert 'up to date' in again.stdout
print('build-score-preview-test: ok')
