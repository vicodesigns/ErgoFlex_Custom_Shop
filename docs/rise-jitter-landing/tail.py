import json, sys
f = sys.argv[1]; t0 = float(sys.argv[2]); t1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9
bones = sys.argv[4].split(',') if len(sys.argv) > 4 else None
d = json.load(open(f, encoding='utf-8'))
pe = d['shots'][0]['peopleEdits'] if 'shots' in d else d['people']
cast = [c for c in pe['cast'] if c.get('key') == 'maya-stand'][0]
pk = cast['postures']['people-maya-sit-type']['poseKeys']
for k in pk:
    if t0 <= k['t'] <= t1:
        items = [(b, q) for b, q in k['pose'].items() if not bones or b in bones]
        print('%7.3f %-6s %s' % (k['t'], k.get('ease', ''), ' '.join('%s=%s' % (b, q) for b, q in items)))
