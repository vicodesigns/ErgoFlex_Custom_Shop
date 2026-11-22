# usage: python plot_light.py <before luma.csv> <before beats.json> <after luma.csv> <after beats.json> <out.png>
# beats.json: {"seconds", "subshots": [[name, t0, t1], ...], "clips": [[id, start, dur], ...], "logo": s, "cta": s, "dissolveIn": s,
#              "bars": [s, ...] (the score's bar lines, optional), "keyLight": [[t, v], ...], "kicker": [[t, v], ...]}
# Lighting over chapter time, before (top) and after (bottom): mean luma, p95 highlights, the red (gaming LED) share and the
# key colour's hue, with the sub-shot dissolves, desk moves, the logo and the score's bar lines behind.
import sys, csv, json
sys.path.insert(0, r'C:\work\fixB\pylib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
def load(p):
    rows = list(csv.DictReader(open(p)))
    return {k: [float(r[k]) if r[k] not in ('nan', '') else float('nan') for r in rows] for k in rows[0]}
bl, bb, al, ab, out = load(sys.argv[1]), json.load(open(sys.argv[2])), load(sys.argv[3]), json.load(open(sys.argv[4])), sys.argv[5]
fig, axes = plt.subplots(4, 1, figsize=(14, 13), gridspec_kw={'height_ratios': [3, 1.2, 3, 1.2]})
T = max(bb['seconds'], ab['seconds']) + 0.3
def beats(ax, b, y0=0, y1=1):
    if b.get('dissolveIn'): ax.axvspan(0, b['dissolveIn'], color='#bbb', alpha=0.35, lw=0)
    for n, (name, t0, t1) in enumerate(b['subshots']):
        if n: ax.axvspan(t0, b['subshots'][n - 1][2], color='#f2c14e', alpha=0.35, lw=0)
        ax.text((t0 + t1) / 2 if n == 0 else (t0 + t1) / 2, 0.985, name, transform=ax.get_xaxis_transform(), ha='center', va='top', fontsize=9, color='#7a5c00')
    for t in b.get('bars', []): ax.axvline(t, color='#9bb', lw=0.5, ls=':')
    if b.get('logo') is not None: ax.axvline(b['logo'], color='#c0392b', lw=1.6); ax.text(b['logo'], 0.02, ' logo', transform=ax.get_xaxis_transform(), color='#c0392b', fontsize=9)
for row, (L, B, name) in enumerate(((bl, bb, 'BEFORE (Vico 16:01)'), (al, ab, 'AFTER'))):
    ax = axes[row * 2]
    beats(ax, B)
    ax.plot(L['s'], L['luma'], color='#222', lw=1.8, label='mean luma')
    ax.plot(L['s'], L['p95'], color='#777', lw=1.0, label='p95 luma (highlights)')
    ax.plot(L['s'], [x * 3 for x in L['redShare']], color='#d62728', lw=1.4, label='red LED share x3')
    ax.set_ylim(0, max(0.6, max(L['p95']) * 1.1)); ax.set_xlim(0, T)
    ax.set_title(f'{name}: picture luma and LED red over the hero (shaded: dissolves; grey: dissolve in from storage; red line: logo; dotted: score bars)', fontsize=10, loc='left')
    ax.legend(loc='upper left', fontsize=8, frameon=False, ncol=3, bbox_to_anchor=(0, 0.93))
    ax.grid(True, color='#eee', lw=0.5)
    ax2 = axes[row * 2 + 1]
    beats(ax2, B)
    for cid, s, d in B['clips']:
        ax2.plot([s, s + d], [0.5, 0.5], lw=6, color='#2c7fb8', solid_capstyle='butt'); ax2.text(s, 0.62, cid, fontsize=8, color='#2c7fb8')
    if B.get('keyLight'):
        kx, ky = zip(*B['keyLight']); m = max(ky)
        ax2.plot(kx + (T,), [v / m * 0.4 for v in ky] + [ky[-1] / m * 0.4], color='#e67e22', lw=1.4, drawstyle='default', label='key light (rel.)')
    if B.get('kicker'):
        kx, ky = zip(*B['kicker']); m = max(ky)
        ax2.plot(kx + (T,), [0.05 + v / m * 0.35 for v in ky] + [0.05 + ky[-1] / m * 0.35], color='#8e44ad', lw=1.2, label='kicker (rel.)')
    ax2.set_ylim(0, 1); ax2.set_yticks([]); ax2.set_xlim(0, T); ax2.legend(loc='upper right', fontsize=8, frameon=False)
    ax2.set_ylabel('desk moves\n+ light keys', fontsize=8)
axes[-1].set_xlabel('hero chapter time (s)')
fig.tight_layout(); fig.savefig(out, dpi=105); print('wrote', out)
