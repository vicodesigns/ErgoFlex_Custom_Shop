import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from fk_elbow import report, RIGS
def keys_at(i): return .678 + (i - 28) * .0269
def setting_for(keys): return 28 + (keys - .678) / .0269
ids = sys.argv[1:]
for pid in ids:
    who = pid.split('-')[1]; r = report(who, pid)
    if r.get('missing'): print(f'{pid:34s} MISSING'); continue
    L, R = r['l'], r['r']; sh = (L['shoulderY'] + R['shoulderY']) / 2; up = (L['upper'] + R['upper']) / 2
    el = (L['elbowY'] + R['elbowY']) / 2; wr = (L['wristY'] + R['wristY']) / 2
    relaxed = sh - up          # elbow height with the upper arm hanging vertical, this posture's shoulders
    dh = r['deskHeight']; off = wr - keys_at(dh) if dh else None
    ideal = setting_for(relaxed - (off if off is not None else .054)) if True else None
    print(f"{pid:34s} {r['pose']:16s} built={dh!s:5s} sh={sh:.3f} up={up:.3f} el={el:.3f} wr={wr:.3f} relaxedEl={relaxed:.3f} "
          f"wr-relaxedEl={(wr-relaxed)*100:+5.1f}cm elbowAng={ (L['elbow']+R['elbow'])/2:5.1f} forearm={(L['forearm_pitch']+R['forearm_pitch'])/2:+5.1f} "
          f"upperFwd={(L['upperarm_from_vertical']+R['upperarm_from_vertical'])/2:4.1f} wristOverKeys={'' if off is None else f'{off*100:.1f}cm'} idealSetting={ideal:.1f}in")
