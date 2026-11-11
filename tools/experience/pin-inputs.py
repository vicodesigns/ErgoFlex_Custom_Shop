#!/usr/bin/env python3
"""pin-inputs.py <repo root> <freeze dir> <file>...: in a freeze (freeze-inputs.sh), replace each repo file with its HEAD copy
(files another session is editing live), or drop it if it isn't tracked yet (a brand-new file of theirs). Updates the
manifest's sha/size/url-path. The scratchpad pin.py, parameterised by the repo root; <freeze dir> is relative to it
(or absolute)."""
import hashlib, os, subprocess, sys
if len(sys.argv) < 3: sys.exit(__doc__)
ROOT = os.path.abspath(sys.argv[1]); os.chdir(ROOT)
F, files = os.path.relpath(sys.argv[2].rstrip('/'), ROOT) if os.path.isabs(sys.argv[2]) else sys.argv[2].rstrip('/'), sys.argv[3:]
M = os.path.join(F, 'manifest.txt'); L = open(M).read().split('\n')
for f in files:
    try: data = subprocess.run(['git', 'show', f'HEAD:{f}'], capture_output=True, check=True).stdout
    except subprocess.CalledProcessError: data = None
    idx = [i for i, l in enumerate(L) if len(l.split(' ')) >= 3 and l.split(' ')[2] == f]
    if data is None:
        L = [l for i, l in enumerate(L) if i not in idx]
        p = os.path.join(F, f)
        if os.path.exists(p): os.remove(p)
        print(f'dropped {f} (untracked)'); continue
    p = os.path.join(F, f); os.makedirs(os.path.dirname(p) or '.', exist_ok=True); open(p, 'wb').write(data)
    line = f'{hashlib.sha256(data).hexdigest()} {len(data)} {f} {p}'
    if idx: L[idx[0]] = line
    else: L.append(line)
    print(f'pinned {f} {hashlib.sha256(data).hexdigest()[:8]}')
open(M, 'w').write('\n'.join(L))
