# The key timeline of Maya's seated posture: time, ease, bone count, the bones a key names ((same) = as the key before).
#   keys.py <export doc | director-camera / director-film json | by-key patch> [posture]
import json, sys
f = sys.argv[1]; posture = sys.argv[2] if len(sys.argv) > 2 else 'people-maya-sit-type'
d = json.load(open(f, encoding='utf-8'))
if posture in d:   # a by-key patch { "<posture>": [keys] }
    pk = d[posture]
else:
    pe = d['shots'][0]['peopleEdits'] if 'shots' in d else d.get('people', d)
    cast = [c for c in pe['cast'] if c.get('key') == 'maya-stand'][0]
    pk = cast['postures'][posture]['poseKeys']
print('n', len(pk))
prev = None
for k in pk:
    bones = sorted(k['pose'].keys())
    sig = ','.join(bones)
    print('%7.3f %-6s %2d %s' % (k['t'], k.get('ease', ''), len(bones), sig if sig != prev else '(same)'))
    prev = sig
