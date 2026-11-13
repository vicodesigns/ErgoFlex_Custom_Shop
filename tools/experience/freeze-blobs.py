#!/usr/bin/env python3
"""freeze-blobs.py <repo root> <freeze dir>      give every file of a freeze's manifest a stored copy
freeze-blobs.py prune <repo root> [--days N]  delete stored copies no freeze has used for N days (default 21)

A freeze (freeze-inputs.sh) copies the code and the film's JSON into its own folder, and listed everything else by its
path in the checkout: about 2.3 GB of models, images, sound and clips, with no url-path, so the render PC fetched them
from the live checkout. A merge or a rebuild that changed one of them after the freeze made the render PC's sha check
fail on every attempt, and the job never rendered (2026-11-13: two 4K film jobs, four files changed by a merge).

Now each such line gets a url-path into a store keyed by content: <root>/exports/render-blobs/<aa>/<sha256><.ext>.
A file is copied there once (a real copy: the checkout's file can be rewritten in place); later freezes find it by its
sha and only touch it. The manifest's columns are unchanged (sha256 size path url-path), so the render PC needs nothing
new: it already fetches base + url-path and writes to path. If a file changed between the freeze's hashing and this copy,
the line takes the sha and size of what was copied. A listed file that has gone is dropped from the manifest with a
warning. exports/ is served and not watched, and exports/render-blobs/ is not tracked.

Prints "<manifest>: N lines, M stored now (X MB), K already stored" as its last line.
"""
import hashlib, os, shutil, sys, time

STORE = 'exports/render-blobs'


def sha_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def blob_path(sha, path):
    ext = os.path.splitext(path)[1]
    if not ext.replace('.', '').isalnum() or len(ext) > 12: ext = ''
    return f'{STORE}/{sha[:2]}/{sha}{ext}'


def store(root, path, sha, size):
    """A stored copy of root/path; returns (sha, size, url-path, copied bytes). The copy is what the line describes."""
    dst = blob_path(sha, path)
    full = os.path.join(root, dst)
    if os.path.isfile(full) and os.path.getsize(full) == size:
        os.utime(full, None); return sha, size, dst, 0
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = f'{full}.{os.getpid()}.tmp'
    shutil.copyfile(os.path.join(root, path), tmp)
    got, n = sha_of(tmp), os.path.getsize(tmp)
    if got != sha:                              # the checkout's file changed since it was hashed: describe the copy
        dst = blob_path(got, path); full = os.path.join(root, dst); os.makedirs(os.path.dirname(full), exist_ok=True)
    os.replace(tmp, full)
    return got, n, dst, n


def freeze(root, F):
    root = os.path.abspath(root)
    F = os.path.relpath(F.rstrip('/'), root) if os.path.isabs(F) else F.rstrip('/')
    mp = os.path.join(root, F, 'manifest.txt')
    lines = open(mp).read().rstrip('\n').split('\n')
    out, new, new_bytes, had, gone = [lines[0]], 0, 0, 0, []
    for line in lines[1:]:
        parts = line.split(' ')
        if len(parts) != 3 or not parts[0]:      # already has a url-path (a frozen copy), or not a file line
            out.append(line); continue
        sha, size, path = parts[0], int(parts[1]), parts[2]
        if not os.path.isfile(os.path.join(root, path)):
            gone.append(path); continue
        sha, size, url, copied = store(root, path, sha, size)
        new += 1 if copied else 0; new_bytes += copied; had += 0 if copied else 1
        out.append(f'{sha} {size} {path} {url}')
    tmp = f'{mp}.{os.getpid()}.tmp'; open(tmp, 'w').write('\n'.join(out) + '\n'); os.replace(tmp, mp)
    for p in gone: print(f'WARNING: {p} was listed but is gone; dropped from the manifest', file=sys.stderr)
    print(f'{os.path.join(F, "manifest.txt")}: {len(out) - 1} lines, {new} stored now ({new_bytes / 1e6:.0f} MB), {had} already stored')


def prune(root, days):
    base, cut, n, freed = os.path.join(os.path.abspath(root), STORE), time.time() - days * 86400, 0, 0
    for d, _, files in os.walk(base):
        for f in files:
            p = os.path.join(d, f)
            if os.path.getmtime(p) < cut: freed += os.path.getsize(p); os.remove(p); n += 1
    print(f'{STORE}: removed {n} stored files not used for {days} days ({freed / 1e6:.0f} MB)')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == 'prune':
        prune(a[1], float(a[a.index('--days') + 1]) if '--days' in a else 21)
    elif len(a) == 2:
        freeze(a[0], a[1])
    else:
        sys.exit(__doc__)
