# usage: python plot.py <before.csv> <after.csv> <out.png> [title]
# camera speed / acceleration / angular speed / angular acceleration over chapter time, BEFORE vs AFTER
import sys, csv
sys.path.insert(0, r'C:\work\fixB\pylib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def load(p):
    rows = list(csv.DictReader(open(p)))
    return {k: [float(r[k]) for r in rows] for k in rows[0]}

b, a = load(sys.argv[1]), load(sys.argv[2])
out = sys.argv[3]
title = sys.argv[4] if len(sys.argv) > 4 else 'Chapter 12 Hero: camera motion, before (Vico 16:01, 23.5 s) vs after (25.5 s)'
CB, CA = '#b3541e', '#1f6f9c'   # before: burnt orange, after: blue (distinct in greyscale too: after is drawn thicker)
panels = [
    ('speed', 'Camera speed (m/s)', None),
    ('sAcc', 'Acceleration along the path (m/s$^2$)', None),
    ('ang', 'Look direction: angular speed (deg/s)', None),
    ('angAcc', 'Angular acceleration (deg/s$^2$)', None),
    ('fov', 'Lens: vertical field of view (deg)', None),
]
fig, axes = plt.subplots(len(panels), 1, figsize=(13, 13.5), sharex=False)
fig.suptitle(title, fontsize=14, fontweight='bold', x=0.06, ha='left')
for ax, (k, label, _) in zip(axes, panels):
    ax.plot(b['s'], b[k], color=CB, lw=1.3, label='before (Vico 16:01)')
    ax.plot(a['s'], a[k], color=CA, lw=2.0, label='after')
    for d, c in ((b, CB), (a, CA)):
        for s, cut in zip(d['s'], d['cut']):
            if cut: ax.axvline(s, color=c, lw=0.8, ls=':')
    ax.axhline(0, color='#888', lw=0.6)
    ax.set_ylabel(label, fontsize=9)
    ax.grid(True, color='#ddd', lw=0.5)
    ax.set_xlim(0, max(b['s'][-1], a['s'][-1]) + 0.1)
    ax.spines[['top', 'right']].set_visible(False)
    if k != 'fov':
        pb = max(abs(x) for x in b[k]); pa = max(abs(x) for x in a[k])
        ax.text(0.995, 0.93, f'peak |before| {pb:.2f}   |after| {pa:.2f}', transform=ax.transAxes, ha='right', va='top', fontsize=9,
                bbox=dict(facecolor='white', edgecolor='#ccc', boxstyle='round,pad=0.25'))
axes[0].legend(loc='upper left', frameon=False, fontsize=9, ncol=2)
axes[-1].set_xlabel('chapter time (s); dotted line = cut inside the chapter', fontsize=9)
fig.tight_layout(rect=(0, 0, 1, 0.975))
fig.savefig(out, dpi=110)
print('wrote', out)
