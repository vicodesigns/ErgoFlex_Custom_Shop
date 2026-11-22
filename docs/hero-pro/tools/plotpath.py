# usage: python plotpath.py <before.csv> <after.csv> <before plan json> <after plan json> <out.png>
# top view of the studio: the camera path before and after, a dot every second, the story keys, the desk, the wheel, the walls
import sys, csv, json
sys.path.insert(0, r'C:\work\fixB\pylib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

def load(p):
    rows = list(csv.DictReader(open(p)))
    return {k: [float(r[k]) for r in rows] for k in rows[0]}

def plan(p):
    d = json.load(open(p, encoding='utf-8'))
    if 'shots' in d: d = [s for s in d['shots'] if s['id'] == 'create'][0]
    return d['cameraPlan']['keys']

b, a = load(sys.argv[1]), load(sys.argv[2]); kb, ka = plan(sys.argv[3]), plan(sys.argv[4]); out = sys.argv[5]
CB, CA = '#b3541e', '#1f6f9c'
fig, axes = plt.subplots(1, 2, figsize=(15, 8.2), sharex=True, sharey=True)
for ax, d, keys, c, name in ((axes[0], b, kb, CB, 'BEFORE (film)'), (axes[1], a, ka, CA, 'AFTER')):
    # room (world metres, from render-cut --list-objects): brick wall x=-2.55, materials wall z=-3.92 (cabinets to -3.45), daylight wall z=3.63, far side x=5.96
    ax.add_patch(Rectangle((-2.55, -3.92), 8.51, 7.55, fill=False, ec='#555', lw=1.5))
    ax.add_patch(Rectangle((-2.55, -3.92), 8.51, 0.47, fc='#e6e2d8', ec='none'))
    ax.text(1.7, -3.78, 'materials wall: cabinets, pinboard', fontsize=8, color='#555', ha='center')
    ax.text(1.7, 3.72, 'daylight wall: window', fontsize=8, color='#555', ha='center')
    ax.text(-2.72, 0.3, 'brick gallery wall', fontsize=8, color='#555', rotation=90, va='center')
    ax.add_patch(Rectangle((-2.3, -0.75), 1.25, 2.1, fc='#d9d2c0', ec='#777'))
    ax.text(-1.67, 0.3, 'desk', fontsize=9, ha='center', va='center')
    ax.add_patch(Rectangle((1.58, 1.77), 1.45, 1.29, fc='#cfe0d2', ec='#777'))
    ax.text(2.3, 2.4, 'Lin at\nthe wheel', fontsize=8, ha='center', va='center')
    cut = [i for i, v in enumerate(d['cut']) if v]
    segs = [0] + cut + [len(d['s'])]
    for i in range(len(segs) - 1):
        s, e = segs[i], segs[i + 1]
        ax.plot(d['px'][s:e], d['pz'][s:e], color=c, lw=2)
    for i in range(0, len(d['s']), 30):
        ax.plot(d['px'][i], d['pz'][i], 'o', color=c, ms=4)
        if i % 60 == 0: ax.annotate(f"{d['s'][i]:.0f}", (d['px'][i], d['pz'][i]), textcoords='offset points', xytext=(5, 4), fontsize=7.5, color=c)
    for k in keys:
        ax.plot(k['position'][0], k['position'][2], 's', mfc='white', mec='black', ms=7, zorder=5)
        ax.plot([k['position'][0], k['position'][0] + 0.18 * (k['target'][0] - k['position'][0])], [k['position'][2], k['position'][2] + 0.18 * (k['target'][2] - k['position'][2])], color='black', lw=0.7, zorder=4)
    ax.set_title(f"{name}: {len(keys)} story keys; dots = 1 s apart, numbers = seconds", fontsize=11, loc='left')
    ax.set_aspect('equal'); ax.set_xlim(-3.0, 6.2); ax.set_ylim(4.1, -4.2)
    ax.set_xlabel('x (m)'); ax.grid(True, color='#eee', lw=0.5)
axes[0].set_ylabel('z (m)')
fig.suptitle('Chapter 3 Create: camera path from above (squares = story keys with their aim; evenly spaced dots = even speed)', fontsize=12.5, fontweight='bold', x=0.05, ha='left')
fig.tight_layout(rect=(0, 0, 1, 0.96))
fig.savefig(out, dpi=105)
print('wrote', out)
