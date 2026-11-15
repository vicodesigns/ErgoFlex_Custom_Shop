#!/usr/bin/env python3
"""tools/experience/render-source-fixes.py on a temp freeze (this worktree's studio.js and a one-line manifest).
Checks: the frozen studio.js does not list the wheel rollers (a38c8c / 5e4343) as polished aluminium (the script used
to write them in: white mirror rollers in the film, Vico Nov 14), the manifest line follows the file, and a studio.js
that does list them is refused.

  python3 tests/render-source-fixes-test.py        (a second; no browser)"""
import hashlib, os, re, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(WT, 'tools/experience/render-source-fixes.py')
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
def freeze(studio_text):
    d = tempfile.mkdtemp(prefix='render-source-fixes-test-')
    open(os.path.join(d, 'studio.js'), 'w', encoding='utf8', newline='').write(studio_text)
    open(os.path.join(d, 'manifest.txt'), 'w').write('0 0 studio.js\n')
    return d
def aluminium(text):
    return re.search(r'const POLISHED_ALUMINUM_COLORS = \[([^\]]*)\];', text).group(1)
src = open(os.path.join(WT, 'studio.js'), encoding='utf8').read()
d = freeze(src)
try:
    r = subprocess.run([sys.executable, SCRIPT, d], capture_output=True, text=True, env={**os.environ, 'PYTHONUTF8': '1'})
    check(r.returncode == 0, 'the fixes apply to this worktree\'s studio.js ' + r.stderr.strip()[-200:])
    out = open(os.path.join(d, 'studio.js'), encoding='utf8').read()
    check(not re.search(r'a38c8c|5e4343', aluminium(out)), 'frozen studio.js: the wheel rollers are not in POLISHED_ALUMINUM_COLORS')
    check('const WHEEL_ROLLER_COLORS = ["a38c8c", "5e4343"];' in out, 'frozen studio.js keeps the rubber roller list')
    data = open(os.path.join(d, 'studio.js'), 'rb').read(); line = open(os.path.join(d, 'manifest.txt')).read().split()
    check(line[0] == hashlib.sha256(data).hexdigest() and line[1] == str(len(data)), 'manifest sha and size follow the frozen file')
finally:
    shutil.rmtree(d, ignore_errors=True)
bad = re.sub(r'(const POLISHED_ALUMINUM_COLORS = \[[^\]]*)\]', r'\1, "a38c8c", "5e4343"]', src, count=1)
d = freeze(bad)
try:
    r = subprocess.run([sys.executable, SCRIPT, d], capture_output=True, text=True, env={**os.environ, 'PYTHONUTF8': '1'})
    check(r.returncode != 0 and 'rubber' in (r.stdout + r.stderr), 'a studio.js listing the rollers as aluminium is refused')
finally:
    shutil.rmtree(d, ignore_errors=True)
for label, text in (('without WHEEL_ROLLER_COLORS', src.replace('const WHEEL_ROLLER_COLORS', 'const WHEEL_ROLLERS_GONE', 1)),
                    ('without a matching POLISHED_ALUMINUM_COLORS', src.replace('const POLISHED_ALUMINUM_COLORS = [', 'const POLISHED_ALUMINUM_COLORS=[', 1))):
    d = freeze(text)
    try:
        r = subprocess.run([sys.executable, SCRIPT, d], capture_output=True, text=True, env={**os.environ, 'PYTHONUTF8': '1'})
        check(r.returncode != 0, 'a studio.js ' + label + ' is refused')
    finally:
        shutil.rmtree(d, ignore_errors=True)
print('FAILED: ' + '; '.join(fails) if fails else 'all passed')
sys.exit(1 if fails else 0)
