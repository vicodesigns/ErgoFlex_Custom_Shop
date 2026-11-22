import json, sys
# mkcut.py <in review-cut.json> <out cut.json> <roughness>: adds the gym desk's aluminium edit to the wellness shot
src, dst, rough = sys.argv[1], sys.argv[2], float(sys.argv[3])
c = json.load(open(src, encoding='utf-8'))
s = [x for x in c['shots'] if x['id'] == 'wellness'][0]
s['sceneEdits'].append({
    "match": "", "materialColor": "#ffffff",
    "material": {"roughness": rough},
    "note": "the desk's aluminium at the catalog's gloss finish (SURFACE_TREATMENTS.aluminium.gloss)"})
json.dump(c, open(dst, 'w', encoding='utf-8'), indent=1)
