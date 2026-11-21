import json, sys, math
def load(f):
    d = json.load(open(f, encoding='utf-8'))
    pe = d['shots'][0]['peopleEdits'] if 'shots' in d else d.get('people', d)
    cast = [c for c in pe['cast'] if c.get('key') == 'maya-stand'][0]
    return {round(k['t'], 3): k for k in cast['postures']['people-maya-sit-type']['poseKeys']}
A, B = load(sys.argv[1]), load(sys.argv[2])
def ang(p, q):
    n = math.sqrt(sum(a * a for a in p) * sum(b * b for b in q))
    d = abs(sum(a * b for a, b in zip(p, q))) / n; return 2 * math.degrees(math.acos(min(1, d)))
for t in sorted(set(A) | set(B)):
    a, b = A.get(t), B.get(t)
    if a and not b: print('%7.3f only-A %s' % (t, ','.join(sorted(a['pose']))[:80])); continue
    if b and not a: print('%7.3f only-B %-6s %s' % (t, b.get('ease', ''), ','.join(sorted(b['pose']))[:80])); continue
    ch = []
    for bone in sorted(set(a['pose']) | set(b['pose'])):
        p, q = a['pose'].get(bone), b['pose'].get(bone)
        if p is None or q is None: ch.append(bone + ('+' if p is None else '-'))
        elif ang(p, q) > 0.05: ch.append('%s:%.1f' % (bone, ang(p, q)))
    if a.get('ease') != b.get('ease'): ch.append('ease %s->%s' % (a.get('ease'), b.get('ease')))
    if ch: print('%7.3f changed %s' % (t, ' '.join(ch)[:160]))
