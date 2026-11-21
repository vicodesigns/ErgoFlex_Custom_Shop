"""Window minima / maxima of the skinned-mesh measurements (measure-mesh.mjs CSVs), the moving part only:
entry 13.1-15.267 (keyboard -> hold 1), exit before 21.133-23.5 (Vico's), exit after 21.133-23.3 (the fix).
The exit's L columns are compared with the entry's R columns (mirror). Clearances in cm (capped at 6, pony at 3), deskHand /
deskFore = lowest hand / forearm vertex vs the typing pose (cm; negative = below the keys), stretch / area vs the mesh as built.
  python summarize-mesh.py <entry.csv> <before.csv> <after.csv>"""
import csv, sys
def load(f): return [{k: float(v) for k, v in r.items()} for r in csv.DictReader(open(f))]
E, B, A = (load(f) for f in sys.argv[1:4])
win = lambda rows, a, b: [r for r in rows if a - 1e-6 <= r['t'] <= b + 1e-6]
E, B, A = win(E, 13.1, 15.267), win(B, 21.133, 23.5), win(A, 21.133, 23.3)
sw = lambda k: k.replace('L', '#').replace('R', 'L').replace('#', 'R') if k[-1] in 'LR' else (k[:-1] + ('r' if k[-1] == 'l' else 'l') if k[-2] == '_' else k)
cols = ['headL', 'headR', 'neckL', 'neckR', 'torsoL', 'torsoR', 'ponyL', 'ponyR', 'armarm', 'deskHand', 'deskFore', 'zminL', 'zminR']
print(f'{"measure":26}{"entry (mirrored side)":>24}{"exit BEFORE":>14}{"exit AFTER":>13}')
for k in cols:
    ek = sw(k)
    mn = lambda rows, c: min(r[c] for r in rows)
    print(f'{"min " + k:26}{mn(E, ek):>17.1f} ({ek:>6}){mn(B, k):>14.1f}{mn(A, k):>13.1f}')
for reg in ['shoulder', 'elbow', 'wrist']:
    for s in 'lr':
        k, ek = f'str_{reg}_{s}', f'str_{reg}_{"r" if s == "l" else "l"}'
        print(f'{"max stretch " + reg + " " + s:26}{max(r[ek] for r in E):>17.2f} ({ek[-1]:>6}){max(r[k] for r in B):>14.2f}{max(r[k] for r in A):>13.2f}')
        k, ek = f'area_{reg}_{s}', f'area_{reg}_{"r" if s == "l" else "l"}'
        print(f'{"min area " + reg + " " + s:26}{min(r[ek] for r in E):>17.2f} ({ek[-1]:>6}){min(r[k] for r in B):>14.2f}{min(r[k] for r in A):>13.2f}')
# frame-to-frame jumps of the clearance / desk numbers (a snap shows as a big step)
for k in ['deskHand', 'deskFore']:
    st = lambda rows: max(abs(rows[i][k] - rows[i - 1][k]) for i in range(1, len(rows)))
    print(f'{"max step/frame " + k:26}{st(E):>24.1f}{st(B):>14.1f}{st(A):>13.1f}')
