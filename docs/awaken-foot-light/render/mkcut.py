import json, sys
# mkcut.py <review-cut.json> <out cut.json> <ledFloorSources json | -> : sets awaken's sceneGlobals.ledFloorSources (the Director's per-source floor controls)
src, dst, fs = sys.argv[1:4]
c = json.load(open(src, encoding='utf-8'))
s = [x for x in c['shots'] if x['id'] == 'awaken'][0]
if fs != '-': s.setdefault('sceneGlobals', {})['ledFloorSources'] = json.loads(fs)
json.dump(c, open(dst, 'w', encoding='utf-8'), indent=1)
