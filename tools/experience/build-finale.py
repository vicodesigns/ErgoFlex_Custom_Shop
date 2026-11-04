#!/usr/bin/env python3
"""Chapter 13 ('hero') as the finale, v3 (HQ10): six desks, six positions, one continuous performance.

    python3 tools/experience/build-finale.py exports/cinematic-intro-20261103-hq10

v3 (round 5, Vico: "starting to look better... can still be improved", "camera work... a little jerky"):
the same looks, seams, light and grade as v2; a new camera (one monotone orbit with a smooth pan-rate
profile, desk larger in frame, end card framed above the wordmark) and a cleaner desk performance (each
desk rests in its own position; no stop-start or reversal). Review: /home/ergo/logs/cinematography_finale_round5_2026-11-03.md.

v3.1 (round 6, HQ11; /home/ergo/logs/final_review_lighting_2026-11-04.md MUST 1/2, SHOULD 6/7, NICE 12 and
final_review_motion_2026-11-04.md S4). Camera and the shared performance are unchanged apart from f7:
  - key dips 30 > 12 over the OCC board's steep tilt (2.3-4.6 s) on EVERY sub-shot, so the seams still match;
    the mirror of the lens sat on the key's edge and veiled the Coast Navy board and its wordmark.
  - rims raised to el 45 and the kicker to el 25 (all sub-shots); rims 170 on every finish (dark were 240);
    dark finishes (gaming, hbhs) get a satin-black top (no clearcoat, specular .05; see DARK_TOP). F's
    kicker rises 18 > 30 after the E > F seam so the black side panels separate from the stage on the end card.
  - main-portrait clips on HBHS (06-portrait, the class quiz) and office (05-portrait, a colour page): no more
    blank, key-lit beige slabs.
  - f7 (gaming down to sitting) 11.5 + 5.5 s: peak 4.91 in/s, under the 4.94 in/s lift limit; still lands 17.0.
    The montage-speed tilts f1/f3/f5 stay as they are (owner's call, motion review S5).
  - post/shade.png regenerated: clear above y .60, ramping to alpha 150 at .72 and 190 at 1.0 (only under the
    wordmark); grade.json loses the orphan 'status' entry.


Writes <dir>/shots/13.json and <dir>/shots/13-subshots.json (six copies of the chapter that share ONE
desk performance, ONE camera and ONE light rig, and differ only in preset, exposure and renderRange) and
sets the chapter to 23 s in review-cut.json. Because pose and lens are identical in both renders at each
seam, join-subshots.py --transition fade (0.6 s, centred on the bar lines) only blends the finish and the
accessories: the desk never doubles. Vico (round 4): each desk in its own position (painter, drafter,
gamer near sitting, professional standing), a real blend, the two white desks split up, better light,
end on gaming at sitting with the ergonomic keyboard.

  A artist 0.00-3.12 (painter 65)   B occ 2.52-5.19 (tilting)      C architect 4.59-7.26 (drafting 35)
  D hbhs 6.66-9.33 (reading 10, rests 7.8-8.5)  E office 8.73-11.40 (rises to standing 46 in by 10.4)
  F gaming 10.80-23.00 (comes down to sitting 28 in, ergonomic keyboard: kind 'glide' triggers the
    stage's own keyboard swap)
Camera and timing: /home/ergo/logs/cinematography_review_round4_2026-11-03.md (ch 13). Light:
/home/ergo/logs/lighting_review_round4_2026-11-03.md (section 1): flag the top, light from the side,
edges for the black frames, expose per finish. Opens at 43.5 in / 65 deg, the pose of ch 12's folded
desk, so the ch 12 > 13 dissolve is a match dissolve. Render with post/finale-seed.json
(tools/studio-state/derive-seed.mjs --zero-preset-poses: the saved builds carry their own desk poses).
"""
import json, os, subprocess, sys, copy
import numpy as np
from PIL import Image
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 23
LOOKS = [('A', 'artist', 0.00, 3.12), ('B', 'occ', 2.52, 5.19), ('C', 'architect', 4.59, 7.26),
         ('D', 'hbhs', 6.66, 9.33), ('E', 'office', 8.73, 11.40), ('F', 'gaming', 10.80, 23.00)]
DARK = {'gaming', 'hbhs'}                                             # Black Birch tops: satin, not gloss
# The lighting review's satin (env .35, clearcoat .25 / .55) alone measured WORSE on these tops (HBHS 8.0 s raw p50
# 214 > 234, gaming 20 s 210 > 186, with the rims at el 45): the albedo is ~1 % (tint #1b1b1b), so all of that is
# the clearcoat plus the base layer's grazing specular. No coat, specular .05 and rims 170: 85 and 62.
# (envMapIntensity is left out: three r163 overrides it with the scene's environment intensity, so
# sceneGlobals.environmentScale, .4 here, is the real control.)
DARK_TOP = {'clearcoat': 0, 'specularIntensity': 0.05}
PORTRAIT = {'hbhs': 'exports/cinematic-intro-20261030/screens/06-portrait.mp4',    # live class quiz > class dashboard
            'office': 'exports/cinematic-intro-20261030/screens/05-portrait.mp4'}  # colour page, export progress
KEY = [[0, 30], [2.3, 30], [2.7, 12], [3.9, 12], [4.6, 30]]            # dip over the OCC board's steep tilt
KICKER_F = [[0, 18], [12, 18], [16.5, 30]]                             # F: 18 at the E > F seam, 30 on the end card
OCC_CCR = None                                                         # OCC desktop clearcoatRoughness (wood default .35); None = leave
EXPOSURE = {'gaming': .95, 'hbhs': .95, 'office': .85, 'occ': .85, 'architect': .70, 'artist': .65}

def clip(id, lane, start, dur, target):
    return {'id': id, 'lane': lane, 'kind': lane, 'start': start, 'duration': dur, 'easing': 'smooth', 'label': '', 'target': target}
# v3 (HQ10): every desk RESTS in its own position before it blends on; no stop-start inside a move.
#   v2's reading tilt ended at 8.2 and the next tilt restarted at 8.5 (a 0.3 s stutter), the HBHS desk dipped
#   40 > 38 in and then rose (a lift reversal), and the office reached standing 0.3 s before its blend.
clips = [clip('f1', 'tilt', 2.4, 2.2, 35), clip('f2', 'lift', 2.6, 1.8, 40),       # painter to drafting, through seam 2.82
         clip('f3', 'tilt', 6.2, 1.6, 10),                                           # drafting to reading, through seam 6.96; rests 7.8-8.5
         clip('f5', 'tilt', 8.5, 1.0, 0), clip('f6', 'lift', 8.5, 1.9, 46),         # one unfold: flat and up to standing by 10.4
         clip('f7', 'lift', 11.5, 5.5, 28)]                                           # gaming comes back down to sitting (lands 17.0; peak 4.91 in/s)

# v3 camera (/home/ergo/logs/cinematography_finale_round5_2026-11-03.md): ONE monotone orbit about the desk
# (camera azimuth 62 > -26 deg), its pan rate rising smoothly 1.0 > 5.3 deg/s by 5 s, cruising 5.3-5.5 to 12 s, then
# falling smoothly to rest (v2 surged 3.6 > 7.8 deg/s at 10-12 s, the jerk). Distance pushes in 9.5 > 7.7 by 5 s,
# holds 7.6-7.7 to 13 s (v2 kept closing to 6.5 and then backed out to 11.2: a dolly reversal on the 11.1 key),
# then eases back to 9.3 for the end card. Peak 0.83 u/s (cap 1.35). Framing (desk incl. the HBHS/office portrait
# monitor, top 3.0 u, which v2 cropped at 7-11 s): the desk fills 0.74-0.85 of the frame height from 5 to 11 s,
# stays right of the headline (lower half clear of x < 0.50 from 11.1 to 16.2), and on the end card is centred
# with its wheels at y ~0.63, above the wordmark (top 0.69), ~0.59 of the frame tall (v2 0.51), seen from 2.1 u up
# so the desktop and the ergonomic keyboard read. Keys were solved for framing against a projection of the desk
# (scratch planner) and checked with stills.
key = lambda at, p, t, fov, **kw: dict(at=at, position=p, target=t, fov=fov, **kw)
camera = {'easeIn': False, 'easeOut': True, 'keys': [
    key(0.0, [4.500, 2.050, 8.300], [-1.276, 1.200, 0.744], 26, label='Ch 12 match: the painter'),
    key(2.8, [5.150, 2.450, 6.852], [-0.646, 1.202, 0.562], 27),
    key(4.9, [5.468, 2.800, 5.259], [-0.417, 1.139, 0.546], 28, label='Architect, drafting'),
    key(7.0, [6.440, 2.900, 4.039], [-0.261, 1.317, 0.597], 28),
    key(9.0, [7.043, 2.850, 2.751], [-0.146, 1.346, 0.670], 28, label='Office rises'),
    key(11.1, [7.324, 2.800, 1.692], [-0.134, 1.342, 1.080], 28, label='Gaming, headline room'),
    key(13.6, [7.620, 2.550, 0.014], [0.118, 1.128, 1.114], 28),
    key(16.2, [8.179, 2.250, -1.515], [0.318, 0.881, 1.055], 28),
    key(19.4, [8.316, 2.100, -3.596], [0.158, 0.518, 0.086], 27, label='End card'),
    key(23.0, [8.395, 2.050, -4.021], [0.157, 0.500, 0.076], 27, label='Settle')]}

def rig(kicker=18):
    # v3.1: one rim level for every finish (dark finishes were 240). At 240 the rims' specular off the flat
    # Black Birch tops read them as white (p50 ~210 raw), whatever the coat; 170 matches the light finishes, so the
    # seams also match in light, and the kicker (F: 30) carries the black frame's edge.
    rim = 170
    return [{'preset': 'productRig', 'key': {'at': {'az': 35, 'el': 22, 'dist': 3.4}, 'width': 2.6, 'height': 1.3, 'intensity': KEY},
             'rimLeft': {'at': {'az': 135, 'el': 45, 'dist': 3.6}, 'intensity': rim}, 'rimRight': {'at': {'az': -135, 'el': 45, 'dist': 3.6}, 'intensity': rim},
             'pool': {'strength': 0.18}, 'contact': {'opacity': 0.8}},
            {'type': 'rect', 'name': 'kicker', 'at': {'az': 180, 'el': 25, 'dist': 3.2}, 'width': 0.5, 'height': 2.0, 'color': '#eef1ff', 'intensity': kicker},
            {'type': 'rect', 'name': 'frontLow', 'at': {'az': -45, 'el': 8, 'dist': 4.0}, 'width': 1.2, 'height': 0.6, 'color': '#fff0e0', 'intensity': 6}]

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i13 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'hero')
shot = copy.deepcopy(cut['shots'][i13])
for k in ('subshots', 'presets', 'renderRange', 'subshot'): shot.pop(k, None)
wheels = [e for e in shot['sceneEdits'] if str(e.get('match', '')).startswith('^Wheel')]
shot.update(seconds=SECONDS, cameraPlan=camera, kind='hero',
            motion={'version': 2, 'initial': {'height': 43.5, 'tilt': 65, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
            sceneEdits=wheels + [{'match': '@grid', 'opacity': [[0, 0.35], [11.5, 0.25], [16, 0]], 'radialFade': [3, 8]},
                                 {'match': '@pulse', 'opacity': [[0, 1], [11.5, 0.6], [16, 0]]},
                                 {'lightType': 'DirectionalLight', 'intensity': 0.45}, {'lightType': 'HemisphereLight', 'intensity': 0.5},
                                 {'match': '@stageLight', 'intensity': 0.5}],
            ledGlow=0.2, ledSurfaces={'desktopStrength': 35, 'shelfStrength': 70, 'baseStrength': 30, 'topStrength': 80,
                                      'floorStrength': 150, 'floorReach': 60, 'floorWidth': 80})
f = os.path.join(d, 'shots', '13-tmp.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
shot = json.load(open(f)); os.remove(f)
subs = []
for n, p, t0, t1 in LOOKS:
    x = dict(copy.deepcopy(shot), preset=p, renderRange=[t0, t1], subshot=n,
             lights=rig(KICKER_F if n == 'F' else 18), sceneGlobals={'environmentScale': 0.4, 'exposure': EXPOSURE[p]})
    x['screens'] = [s for s in x.get('screens', []) if s.get('target') != 'main-portrait']
    if p in PORTRAIT: x['screens'] = x['screens'] + [{'target': 'main-portrait', 'src': PORTRAIT[p]}]
    if p in DARK: x['sceneEdits'] = x['sceneEdits'] + [{'match': r'^(Desktop|Top_Shelf)(_\d+)?$', 'material': DARK_TOP}]
    if p == 'occ' and OCC_CCR: x['sceneEdits'] = x['sceneEdits'] + [{'match': '^Desktop', 'material': {'clearcoatRoughness': OCC_CCR}}]
    if p == 'gaming' and n == 'F': x['kind'] = 'glide'          # the stage swaps the mechanical keyboard for the ergonomic one
    if p == 'architect': x.pop('screens', None)                  # the drafting build has no monitor
    if p in ('artist', 'architect'):   # their shelf organizer lands on the floor: hide it and drop it under the floor
        x['sceneEdits'] = x['sceneEdits'] + [{'match': 'shelf-organizer|^Organizer ', 'hide': True}, {'match': '^Accessory:shelf-organizer$', 'position': [0, -20, 0]}]
    subs.append(x)
json.dump({'name': 'HQ11 finale sub-shots (v3.1)', 'shots': subs}, open(os.path.join(d, 'shots', '13-subshots.json'), 'w'))
# The cut keeps one shot for the chapter (F, the black-and-red title shot) so review tools still read it.
main = copy.deepcopy(subs[-1]); main.pop('renderRange'); main.pop('subshot')
main['subshots'] = {n: [t0, t1] for n, _, t0, t1 in LOOKS}; main['presets'] = [p for _, p, _, _ in LOOKS]
json.dump(main, open(os.path.join(d, 'shots', '13.json'), 'w'), indent=1)
cut['shots'][i13] = main
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
grade = json.load(open(os.path.join(d, 'grade.json')))
grade['hero'] = {'gamma': 1.0, 'temp': 0, 'curves': '0/0 0.5/0.5 0.85/0.83 1/0.95', 'bloom': 0.04}
grade.pop('status', None)                                     # orphan: that chapter was cut
json.dump(grade, open(os.path.join(d, 'grade.json'), 'w'), indent=1)
# End-card shade (finish-intro.py overlays it, fading in with the logo): 1920x1080 grey+alpha, black, darkening
# only under the wordmark so the desk's base and wheels (y ~.63) keep their silhouette.
yy = np.arange(1080) / 1079
alpha = np.interp(yy, [0, 0.60, 0.72, 1.0], [0, 0, 150, 190])
la = np.zeros((1080, 1920, 2), np.uint8); la[..., 1] = np.round(alpha)[:, None]
Image.fromarray(la, 'LA').save(os.path.join(d, 'post', 'shade.png'))
print('finale v3.1:', ' > '.join(f'{p} {t0}-{t1}' for _, p, t0, t1 in LOOKS))
