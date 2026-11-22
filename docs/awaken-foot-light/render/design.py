import json, sys
# design.py <out ledFloorSources.json>: the keyed foot pool of awaken, 7.5-9.5 s (smoothstep ramps, held 8.5-9.0 s)
def ss(x): return x * x * (3 - 2 * x)
IN = [7.5 + i * .25 for i in range(5)]            # 7.5 .. 8.5
OUT = [9.0 + i * .125 for i in range(5)]           # 9.0 .. 9.5
def keys(peak, base=0.0):
    ks = [[t, round(base + (peak - base) * ss((t - 7.5) / 1.0), 4)] for t in IN]
    ks += [[t, round(base + (peak - base) * (1 - ss((t - 9.0) / .5)), 4)] for t in OUT]
    return ks
P = dict(brightness=2.6, saturation=1.4, spread=1.25, edge=1.5, tintAmount=0.8)
foot = {k: keys(v, 0.0 if k == 'tintAmount' else 1.0) for k, v in P.items()}
foot['tint'] = '#2438ff'
json.dump({'foot': foot}, open(sys.argv[1], 'w'), indent=1)
print(json.dumps(foot['brightness']))
