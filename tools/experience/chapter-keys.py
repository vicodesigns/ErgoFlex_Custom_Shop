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
  * a per-chapter epoch ('chapter <id> <n>' in render-epoch.txt), for a code change that alters one chapter's pixels
  * 'studioAssets': the slice of the Studio's room state 'ergoflex.sceneAssets.v1' (removed / added / transforms) for the
    chapter's room(s), exactly what the render overlays (render-cut.cjs --state-keys ergoflex.sceneAssets.v1 reads it from
    <root>/studio-state.json, i.e. the freeze's frozen copy; studio.js restoreSceneAssetStates + hydrateSceneAssets apply it).
    See studio_assets() for which entries, the canonical form, and what an absent/unreadable state hashes as.
Nothing else: no code hashes (bump the epoch when a code change alters pixels), and no field of the shot is left out.
Other Studio state (ergoflex.sceneLayers.v1, desks, presets, ...) is never in a key: the render does not overlay it.

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
        with open(p, encoding='utf-8-sig') as f: return json.load(f)   # utf-8 on every OS (Windows' default is cp1252)
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

def read_chapter_epochs(script_dir):
    """'chapter <id> <n>' lines of render-epoch.txt: that chapter alone re-renders (its key changes); every other key stays."""
    out = {}
    for l in open(os.path.join(script_dir, 'render-epoch.txt')).read().split('\n'):
        w = l.split()
        if len(w) == 3 and w[0] == 'chapter': out[w[1]] = w[2]
    return out

def canon(o): return json.dumps(o, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

# ---- Studio room state the render overlays (phase 5 of the layers design, DESIGN.md 5.2/5.3) -----------------------------
# The render (render-cut.cjs stage(), --state-keys ergoflex.sceneAssets.v1, no --state) seeds localStorage with the chapter's
# seed file and then overwrites ONE key with <root>/studio-state.json keys['ergoflex.sceneAssets.v1'].value (when that record
# exists and is not deleted); the render PC's <root>/studio-state.json is the freeze's frozen copy (freeze-inputs.sh always
# freezes it), which is what Tree reads with --overlay <freeze>. studio.js then: restoreSceneAssetStates(JSON.parse(value))
# (an unparseable value = no Studio state at all), and for the open room hydrateSceneAssets(sceneId): `removed` ids are
# removeFromParent()ed, `transforms` applied, `added` items (editorId + propId) built. The state of a room is keyed
# '<room>:<layout>' for measured rooms and '<room>' otherwise (sceneAssetState); a bare '<room>' entry of a measured room is
# folded into '<room>:<layout at load>' on restore. The Director maps a shot to those ids with prop-edits.mjs studioSceneIds.
STATE_KEY = 'ergoflex.sceneAssets.v1'

def _num(o):
    """Canonical numbers: an integral float is the int (JS writes 1, not 1.0), -0.0 is 0. No rounding: Python's float repr
    is the shortest round-trip form on every platform, and rounding could give two different states one key."""
    if isinstance(o, float): return int(o) if o == o and o not in (float('inf'), float('-inf')) and o.is_integer() else o
    if isinstance(o, dict): return {k: _num(v) for k, v in o.items()}
    if isinstance(o, list): return [_num(v) for v in o]
    return o

def _parse_assets(raw):
    """The render's JSON.parse(localStorage value) -> {sceneId: saved}; anything else = empty (studio.js try/catch)."""
    if not isinstance(raw, str): return {}
    try: v = json.loads(raw)
    except ValueError: return {}
    return v if isinstance(v, dict) else {}

def _slice(saved):
    """One room's saved state as studio.js restoreSceneAssetStates keeps it, canonical; None when it holds nothing.
    removed is a Set (order and duplicates do not matter: sorted, unique); added keeps only items with editorId and propId,
    one per editorId (a Map: first position, last value), in order; transforms is an object (key order irrelevant)."""
    if not isinstance(saved, dict): return None
    rem, add, tr = saved.get('removed') or [], saved.get('added') or [], saved.get('transforms') or {}
    if isinstance(rem, list): rem = sorted({x for x in rem if isinstance(x, str)})
    if isinstance(add, list):
        m = {}
        for a in add:
            if isinstance(a, dict) and a.get('editorId') and a.get('propId'): m[canon(a['editorId'])] = a
        add = list(m.values())
    if not rem and not add and not tr: return None
    return _num({'removed': rem, 'added': add, 'transforms': tr})

def scene_ids(shot, assets):
    """The sceneAssets entries a shot's room can read: prop-edits.mjs studioSceneIds ('<room>:<layout>' and '<room>'); a shot
    with a room but no layout also takes every '<room>:*' entry (the stage then opens the room's default layout, which this
    script cannot know: a superset, so a change there never keeps a stale key)."""
    room, layout = shot.get('room'), shot.get('layout')
    if not isinstance(room, str) or not room: return set()
    if layout: return {f'{room}:{layout}', room}
    return {room} | {k for k in assets if k.startswith(room + ':')}

def studio_assets(T, seed_rel):
    """-> {sceneId: raw saved} the render ends up with for 'ergoflex.sceneAssets.v1'. The overlay from studio-state.json
    when that file is readable and its record exists and is not deleted; otherwise (no state file, unreadable, key absent
    or deleted: the render would keep the seed's value, or crash without a state file) the seed's own value of that key,
    and {} when the seed has none. Never raises: a call without state degrades to the seed's value / {} (stable)."""
    try:
        st = T.load('studio-state.json')
        rec = st['keys'].get(STATE_KEY) if isinstance(st, dict) and isinstance(st.get('keys'), dict) else None
    except (OSError, ValueError): rec = None
    if isinstance(rec, dict) and not rec.get('deleted'): return _parse_assets(rec.get('value'))
    try:
        seed = T.load(seed_rel)
        if isinstance(seed, dict) and seed.get('format') == 'ergoflex-studio-state-v1':
            r = (seed.get('keys') or {}).get(STATE_KEY)
            return _parse_assets(r.get('value')) if isinstance(r, dict) and not r.get('deleted') else {}
        return _parse_assets(seed.get(STATE_KEY)) if isinstance(seed, dict) else {}
    except (OSError, ValueError): return {}

def room_slices(assets, shots):
    """{sceneId: canonical slice} for the chapter's shots; rooms with nothing saved are left out, so an empty slice, a
    missing one and an absent state all give {} (one stable value), and other rooms never enter."""
    ids = set().union(*(scene_ids(sh, assets) for sh in shots)) if shots else set()
    out = {}
    for sid in sorted(ids):
        sl = _slice(assets.get(sid))
        if sl is not None: out[sid] = sl
    return out

def chapter_keys(hq, resolution, root, overlay=None, epoch=None, only=None):
    """-> [(index 1-based, id, key)] in film order"""
    here = os.path.dirname(os.path.abspath(__file__))
    T = Tree(root, overlay); epoch = epoch or read_epoch(here); chapter_epochs = read_chapter_epochs(here)
    review = T.load(f'{hq}/review-cut.json'); out = []; assets_by_seed = {}
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
        if seed not in assets_by_seed: assets_by_seed[seed] = studio_assets(T, seed)
        payload['studioAssets'] = room_slices(assets_by_seed[seed], shots)   # always present ({} = nothing saved for the room)
        if cid in chapter_epochs: payload['chapterEpoch'] = chapter_epochs[cid]   # only that chapter's key changes
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
