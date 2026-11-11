#!/usr/bin/env python3
"""chapter-keys.py <hq dir> [--resolution R] [--json] [--root DIR] [--overlay FREEZE_DIR] [--chapter ID]

One cache key per film chapter: sha256 of a canonical JSON (keys sorted) of everything that decides that chapter's frames.
  * the chapter's render shot(s) exactly as the render PC uses them: awaken = previews/awaken-v5-cut.json shot 0;
    chapters 2-11 = their review-cut.json shot; hero = all six sub-shots of shots/13-subshots.json (plus the cut's other
    top-level fields except its name)
  * the storage seed it renders with (name + sha256): coast post/occ-seed.json, hero post/finale-seed.json, every other
    chapter post/college-seed.json
  * the sha256 of every media file the shot names (screens clips etc.; 'missing' when the file is not there)
  * the resolution (480p | 720p | 1080p | 4K) and RENDER_EPOCH (tools/experience/render-epoch.txt)
Nothing else: no code hashes (bump the epoch when a code change alters pixels), and no field of the shot is left out.

<hq dir> is repo-relative (or absolute under --root; root default = this script's repo). --overlay is a freeze directory:
a file is read from <freeze>/<path> when it exists there, else from <root>/<path>; sha256 of media/seeds come from the
freeze's manifest.txt when it lists them (those are what the render PC verifies), else from the file.
Prints "index id key" per chapter, or with --json {"epoch","resolution","keys":{id:key}}."""
import argparse, hashlib, json, os, re, sys

MEDIA = re.compile(r'\.(mp4|webm|mkv|mov|png|jpe?g|webp|gif|svg|glb|gltf|m4a|wav|mp3)$', re.I)
RES = ('480p', '720p', '1080p', '4K')

def seed_for(cid):
    return 'occ-seed.json' if cid == 'coast' else 'finale-seed.json' if cid == 'hero' else 'college-seed.json'

def strings(o):
    if isinstance(o, dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o, list):
        for v in o: yield from strings(v)
    elif isinstance(o, str): yield o

class Tree:
    def __init__(self, root, overlay=None):
        self.root, self.overlay, self.man, self._sha = root, overlay, {}, {}
        mp = os.path.join(overlay, 'manifest.txt') if overlay else None
        if mp and os.path.exists(mp):
            for l in open(mp).read().split('\n')[1:]:
                c = l.split(' ')
                if len(c) >= 3: self.man[c[2]] = c[0]
    def path(self, rel):
        if self.overlay and os.path.isfile(os.path.join(self.overlay, rel)): return os.path.join(self.overlay, rel)
        p = os.path.join(self.root, rel); return p if os.path.isfile(p) else None
    def load(self, rel):
        p = self.path(rel)
        if not p: raise FileNotFoundError(rel)
        return json.load(open(p))
    def sha(self, rel):
        if rel in self._sha: return self._sha[rel]
        p = self.path(rel); s = None
        if self.overlay and os.path.isfile(os.path.join(self.overlay, rel)): p = os.path.join(self.overlay, rel)
        elif rel in self.man: s = self.man[rel]
        if s is None and p:
            h = hashlib.sha256()
            with open(p, 'rb') as f:
                for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
            s = h.hexdigest()
        self._sha[rel] = s or 'missing'; return self._sha[rel]

def read_epoch(script_dir):
    for l in open(os.path.join(script_dir, 'render-epoch.txt')).read().split('\n'):
        if l.strip() and not l.lstrip().startswith('#'): return l.strip()
    raise SystemExit('render-epoch.txt has no epoch line')

def canon(o): return json.dumps(o, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def chapter_keys(hq, resolution, root, overlay=None, epoch=None, only=None):
    """-> [(index 1-based, id, key)] in film order"""
    T = Tree(root, overlay); epoch = epoch or read_epoch(os.path.dirname(os.path.abspath(__file__)))
    review = T.load(f'{hq}/review-cut.json'); out = []
    def cutinfo(cut): return {k: v for k, v in cut.items() if k not in ('shots', 'name')}
    for i, s in enumerate(review['shots']):
        cid = s['id']
        if only and cid != only: continue
        if cid == 'awaken':
            cut = T.load(f'{hq}/previews/awaken-v5-cut.json'); shots = [cut['shots'][0]]; src = 'previews/awaken-v5-cut.json#0'
        elif cid == 'hero':
            cut = T.load(f'{hq}/shots/13-subshots.json'); shots = cut['shots']; src = 'shots/13-subshots.json#all'
        else:
            cut = review; shots = [s]; src = f'review-cut.json#{cid}'
        seed = f'{hq}/post/{seed_for(cid)}'
        media = sorted({v for sh in shots for v in strings(sh) if MEDIA.search(v) and not v.startswith(('http', 'data:', '/'))})
        payload = {'epoch': epoch, 'resolution': resolution, 'chapter': cid, 'source': src, 'cut': cutinfo(cut), 'shots': shots,
                   'seed': {'name': seed_for(cid), 'sha256': T.sha(seed)}, 'media': {m: T.sha(m) for m in media}}
        out.append((i + 1, cid, hashlib.sha256(canon(payload).encode()).hexdigest()))
    return out

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0]); ap.add_argument('hq'); ap.add_argument('--resolution', default='4K', choices=RES)
    ap.add_argument('--json', action='store_true'); ap.add_argument('--root', default=os.path.dirname(os.path.dirname(here)))
    ap.add_argument('--overlay'); ap.add_argument('--chapter'); a = ap.parse_args()
    root = os.path.abspath(a.root); hq = os.path.relpath(os.path.abspath(a.hq if os.path.isabs(a.hq) else os.path.join(root, a.hq)), root)
    rows = chapter_keys(hq, a.resolution, root, os.path.abspath(a.overlay) if a.overlay else None, only=a.chapter)
    if a.json: print(json.dumps({'epoch': read_epoch(here), 'resolution': a.resolution, 'keys': {c: k for _, c, k in rows}}, indent=1))
    else:
        for i, c, k in rows: print(f'{i:02d} {c:<10} {k}')

if __name__ == '__main__': main()
