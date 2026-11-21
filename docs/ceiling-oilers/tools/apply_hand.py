#!/usr/bin/env python3
"""Applies the Oilers HAND sceneEdits of docs/ceiling-oilers/oilers-hair-edit.json (Noah's hair) to a cut folder:
review-cut.json and every shots/NN.json that holds the oilers chapter. Hand-made sceneEdits do not travel through the
Director importer (it only replaces the Director's own director:true entries), so this is how org applies them; the
importer's pass keeps hand entries as they are (build-round8-director.py: hand entries first, then the Director's).
Idempotent: an entry with the same label is replaced, and the edit goes before the first director:true entry.
usage: apply_hand.py <cut folder> <docs/ceiling-oilers/oilers-hair-edit.json>"""
import json, sys, os, glob
H, editp = sys.argv[1:3]
mine = json.load(open(editp, encoding='utf8'))
mine = mine if isinstance(mine, list) else [mine]
labels = {e['label'] for e in mine}
def merge(shot):
    se = [e for e in (shot.get('sceneEdits') or []) if e.get('label') not in labels]
    first = next((i for i, e in enumerate(se) if e.get('director')), len(se))
    shot['sceneEdits'] = se[:first] + json.loads(json.dumps(mine)) + se[first:]
n = 0
for p in [os.path.join(H, 'review-cut.json')] + sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json'))):
    if not os.path.exists(p): continue
    raw = open(p, encoding='utf8').read(); d = json.loads(raw)
    shots = d['shots'] if 'shots' in d else [d]
    hit = False
    for s in shots:
        if s.get('id') == 'oilers': merge(s); hit = True
    if hit:
        with open(p, 'w', encoding='utf8', newline='\n') as f: json.dump(d, f, indent=1 if '\n ' in raw[:200] else None)
        n += 1; print('patched', os.path.relpath(p, H))
print('files patched:', n)
