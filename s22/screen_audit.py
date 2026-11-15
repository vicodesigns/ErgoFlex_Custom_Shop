"""S22 screen-height audit (read-only). Eye from FK (rig JSON) + the eye proxy's offset in the head frame (decoded
posture GLB); screen from the desk GLB (shelf vs desktop), the display prop's glass bounds and the build's p.y."""
import json, math, os, sys
sys.path.insert(0, r'C:\work\cine-pics\s22'); sys.path.insert(0, r'C:\work\cine-pics\audit')
import fk_elbow
fk_elbow.RIGS = r'C:\work\ergoflex-cine-s22\assets\props\people-rigs'
from fk_elbow import fk, qrot
from eyes import head_local

U = 25.4 * 24.5 / (6.53 + 19.25)          # mm per desk-model unit (studio.js millimetreScale: 1 in of lift = 25.4 mm)
FLOOR, DESK_C, SHELF4 = 1.8352, 49.05, 57.784   # desk-public.glb: wheel bottom, Desktop_3 working-surface centre, Top_Shelf_4 top
LIFT_MIN = -19.25
def desktop(H): return (DESK_C + LIFT_MIN - FLOOR) * U + 3 + (H - 28) * 25.4      # +3: model sits 0.005 studio units up
def shelf(H): return (SHELF4 + LIFT_MIN - FLOOR) * U + 3 + (H - 28) * 25.4
SHELF_BEHIND = ((-160.535) - (-171.955)) * U    # shelf mount centre lies this far behind the desktop mount centre (mm)
# glass (monitor-screen) bounds in each display's own mm: (bottom, top, face z at the centre of the glass)
GLASS = {'wide': (21.7, 357.7, -4.0), 'flat': (9.5, 408.6, 10.1), 'portrait': (7.9, 692.1, 10.1), 'dell': (108.2, 443.8, 4.6)}
MOUNT = {'wide': (0, 194.7, -36.35), 'flat': (0, 209.05, -11.6), 'portrait': (-0.8, 350.0, -11.6), 'dell': (0, 273.745, -24)}
ARM_L = 339.6 + 311.5                         # single arm: lower + upper link (workspace-3d.mjs singleArmRig), mm
ARM_BASE = (2.47, 8.84, 6.62)

_eye_cache = {}
def eye_local(who):
    if who not in _eye_cache:
        cands = sorted(f for f in os.listdir(r'C:\work\ergoflex-cine-s22\assets\props') if f.startswith(f'people-{who}-') and f.endswith('.glb'))
        _eye_cache[who] = head_local(cands[0][:-4])['eye']
    return _eye_cache[who]

def person(pid):
    who = pid.split('-')[1]
    rig = json.load(open(os.path.join(fk_elbow.RIGS, who + '.json')))
    p, q = fk(rig, pid); e = eye_local(who); r = qrot(q['head'], tuple(e))
    eye = [p['head'][i] + r[i] for i in range(3)]
    fwd = qrot(q['head'], (0, 0, 1)); sp = qrot(q['spine_03'], (0, 1, 0)); nk = qrot(q['neck_01'], (0, 1, 0))
    ref = f'people-{who}-stand-wait'
    pn, qn = fk(rig, ref) if ref in rig['postures'] else (p, q)
    fn = qrot(qn['head'], (0, 0, 1))
    pitch = lambda v: math.degrees(math.atan2(-v[1], math.hypot(v[0], v[2])))       # + = pointing below horizontal
    lean = lambda v: math.degrees(math.atan2(v[2], v[1]))                            # + = leaning forward
    wr = [(p['hand_l'][i] + p['hand_r'][i]) / 2 for i in range(3)]
    return dict(pid=pid, pose=rig['postures'][pid]['pose'], built=rig['postures'][pid].get('deskHeight'),
                eye=eye, wrist=wr, head_pitch=pitch(fwd), head_pitch_neutral=pitch(fn), trunk=lean(sp), neck=lean(nk),
                shoulder=(p['upperarm_l'][1] + p['upperarm_r'][1]) / 2)

def screen(H, disp):
    kind, px, py, pz, s = disp['kind'], disp['x'], disp['y'], disp['z'], disp.get('scale', 1)
    b, t, fz = GLASS[kind]; S = shelf(H)
    return dict(bottom=S + py + s * b, top=S + py + s * t, centre=S + py + s * (b + t) / 2,
                z=pz - SHELF_BEHIND + s * fz, x=px, shelf=S)

def arm_max_py(disp, arm):
    """Highest p.y the rigid single arm can reach for this display (head within the two links of the clamp)."""
    if not arm: return None
    m = MOUNT[disp['kind']]; s = disp.get('scale', 1)
    dx = disp['x'] + s * m[0] - (arm[0] + ARM_BASE[0]); dz = disp['z'] + s * (m[2] - 4) - 20 - (arm[2] + ARM_BASE[2])
    h = math.sqrt(max(0, ARM_L ** 2 - dx * dx - dz * dz)); return ARM_BASE[1] + h - s * m[1]

def case(c):
    P = person(c['pid']); H = c['H']; d = c['disp']; sc = screen(H, d)
    ey = P['eye'][1] * 1000
    if c['place'] == 'keys':      root = c['kb'] + (P['wrist'][2] + .085) * 1000          # hands on the keyboard centre (static placements)
    elif c['place'] == 'behind':  root = c['kb'] + c['behind']                             # desk-driven, featured desk (room-people BEHIND_KEYS)
    else:                         root = c['reach'] - 33                                   # desk-driven station (REACH from the desk anchor)
    ez = root - P['eye'][2] * 1000                                                          # eye, mm in front of the desktop centre
    dz = ez - sc['z']; dx = d['x'] - c.get('eye_x', 0)
    dh = math.hypot(dz, dx)
    ang_c = math.degrees(math.atan2(ey - sc['centre'], dh)); ang_t = math.degrees(math.atan2(ey - sc['top'], dh))
    dist = math.sqrt(dh ** 2 + (ey - sc['centre']) ** 2)
    want_top = ey - 25; new_py = d['y'] + (want_top - sc['top'])
    cen_new = sc['centre'] + (new_py - d['y'])
    amax = arm_max_py(d, c.get('arm'))
    return dict(c=c, P=P, sc=sc, eye=ey, dist=dist, dh=dh, ang_c=ang_c, ang_t=ang_t, new_py=new_py,
                ang_c_new=math.degrees(math.atan2(ey - cen_new, dh)), arm_max=amax, ez=ez)

LIB = dict(kind='wide', x=-0.96, y=-80, z=335.48)
HBHS = dict(kind='flat', x=0, y=-80, z=335.48)
OFFICE_W = dict(kind='wide', x=323.64, y=-60, z=316.04); OFFICE_P = dict(kind='portrait', x=-357.11, y=-165, z=341.09)
ST_OFFICE_W = dict(kind='wide', x=210.9, y=-60, z=316.0)
ST_MUSIC_W = dict(kind='wide', x=270.1, y=-70, z=302.5)
ST_CREATIVE48 = dict(kind='flat', x=2.4, y=-89.8, z=264.2, scale=1.1)
ST_OCC48 = dict(kind='flat', x=-15.5, y=-70, z=273.7)
ST_COMPACT48 = dict(kind='dell', x=9.5, y=-166.3, z=313.2, scale=1.2)
ST_COMPACT60 = dict(kind='dell', x=11.8, y=-166.3, z=313.2, scale=1.2)
ST_LIB48 = dict(kind='wide', x=-0.8, y=-80, z=335.5)
ARM_LIB = (12.26, 0, -94.95); ARM_OCC48 = (9.8, 0, -95); ARM_ART48 = (-2.5, 0, -109.9); ARM_COMP = (-13, 0, -104.4); ARM_LIB48 = (-5.2, 0, -100.8)

CASES = [
 dict(ch='rise', t0=43.35, t='0-3.4, 12.65-18', who='Maya', pid='people-maya-sit-type', H=28, disp=OFFICE_W, place='behind', kb=427.7, behind=470, arm=None, src='office preset wide-monitor y -60 (dual arm)'),
 dict(ch='rise', t0=43.35, t='0-3.4, 12.65-18', who='Maya (portrait screen)', pid='people-maya-sit-type', H=28, disp=OFFICE_P, place='behind', kb=427.7, behind=470, arm=None, src='office preset portrait-monitor y -165'),
 dict(ch='rise', t0=43.35, t='7.6-9.45', who='Maya', pid='people-maya-stand-type-41', H=41, disp=OFFICE_W, place='behind', kb=427.7, behind=375, arm=None, src='office preset wide-monitor y -60'),
 dict(ch='commons', t0=81.85, t='0-5.3', who='Yara', pid='people-yara-stand-mid', H=39, disp=LIB, place='keys', kb=441.9, arm=ARM_LIB, src='library preset wide-monitor y -80 (single arm)'),
 dict(ch='commons', t0=81.85, t='12.6-16', who='Mia (power chair)', pid='people-mia-power-type-30', H=30, disp=LIB, place='keys', kb=441.9, arm=ARM_LIB, src='library preset wide-monitor y -80'),
 dict(ch='coast', t0=96.35, t='0-3.6', who='Ava', pid='people-ava-sit-type', H=28, disp=LIB, place='behind', kb=441.9, behind=470, arm=ARM_LIB, src='occ preset (library objects) wide y -80'),
 dict(ch='coast', t0=96.35, t='7.6-14.5', who='Ava', pid='people-ava-stand-mid', H=39, disp=LIB, place='behind', kb=441.9, behind=415, arm=ARM_LIB, src='occ preset wide y -80'),
 dict(ch='coast', t0=96.35, t='0-14.5', who='Maya (film-edit-01)', pid='people-maya-sit-type', H=28, disp=ST_OFFICE_W, place='reach', reach=945, arm=None, src='station recipe office 60x30 wide y -60'),
 dict(ch='coast', t0=96.35, t='0-14.5', who='Andre (sound-mix-02)', pid='people-andre-sit-type', H=28, disp=ST_MUSIC_W, place='reach', reach=945, arm=None, src='station recipe music 60x30 wide y -70'),
 dict(ch='coast', t0=96.35, t='0-14.5', who='Lin (digital-art-03)', pid='people-lin-sit-type', H=28, disp=ST_CREATIVE48, place='reach', reach=945, arm=ARM_ART48, src='station recipe creative 48x30 flat y -89.8 x1.1'),
 dict(ch='coast', t0=96.35, t='0-14.5', who='Omar (accessible-edit-04)', pid='people-omar-wheel-type-28', H=28, disp=ST_OCC48, place='reach', reach=935, arm=ARM_OCC48, src='station recipe occ 48x30 flat y -70'),
 dict(ch='oilers', t0=109.35, t='10.6-14', who='Kai (wheelchair)', pid='people-kai-wheel-type-31', H=31, disp=HBHS, place='keys', kb=441.9, arm=ARM_LIB, src='hbhs preset flat y -80'),
 dict(ch='oilers', t0=109.35, t='0-14', who='Zoe (student-standing)', pid='people-zoe-stand-type', H=41, disp=ST_COMPACT48, place='reach', reach=890, arm=ARM_COMP, src='station recipe compact 48x30 dell y -166.3 x1.2'),
 dict(ch='oilers', t0=109.35, t='0-14', who='Mia (window-research)', pid='people-mia-sit-type', H=28, disp=ST_LIB48, place='reach', reach=945, arm=ARM_LIB48, src='station recipe library 48x30 wide y -80'),
 dict(ch='oilers', t0=109.35, t='0-14', who='Fern (project-review)', pid='people-fern-sit-type', H=28, disp=ST_COMPACT60, place='reach', reach=945, arm=ARM_COMP, src='compact 60x30 dell (likely shelf-first: no monitor)'),
 dict(ch='wellness', t0=121.85, t='0-6', who='Maya', pid='people-maya-sit-type', H=28, disp=OFFICE_W, place='behind', kb=433, behind=470, arm=None, src='office preset wide y -60'),
 dict(ch='wellness', t0=121.85, t='11-16', who='Maya', pid='people-maya-stand-type-41', H=41, disp=OFFICE_W, place='behind', kb=433, behind=375, arm=None, src='office preset wide y -60'),
]
if __name__ == '__main__':
    out = []
    for c in CASES:
        r = case(c); P = r['P']; sc = r['sc']
        row = dict(ch=c['ch'], t=c['t'], t0=c['t0'], who=c['who'], pid=c['pid'], pose=P['pose'], built=P['built'], H=c['H'],
                   eye=round(r['eye']), eye_ahead=round(r['ez']), shoulder=round(P['shoulder'] * 1000), top=round(sc['top']), centre=round(sc['centre']),
                   bottom=round(sc['bottom']), shelf=round(sc['shelf']), desk=round(desktop(c['H'])), dist=round(r['dist']), dh=round(r['dh']),
                   ang_c=round(r['ang_c'], 1), ang_t=round(r['ang_t'], 1), head_pitch=round(P['head_pitch'], 1), head_neutral=round(P['head_pitch_neutral'], 1),
                   trunk=round(P['trunk'], 1), neck=round(P['neck'], 1), py=c['disp']['y'], new_py=round(r['new_py']), ang_c_new=round(r['ang_c_new'], 1),
                   arm_max=None if r['arm_max'] is None else round(r['arm_max']), src=c['src'])
        out.append(row)
        print(f"{row['ch']:8s} {row['who']:26s} {row['pose']:14s} H={row['H']:<4} eye={row['eye']} sh={row['shoulder']} top={row['top']} cen={row['centre']} "
              f"bot={row['bottom']} shelf={row['shelf']} desk={row['desk']} dist={row['dist']} dh={row['dh']} angC={row['ang_c']} angT={row['ang_t']} "
              f"head={row['head_pitch']}/{row['head_neutral']} trunk={row['trunk']} neck={row['neck']} py={row['py']}->{row['new_py']} angCnew={row['ang_c_new']} armMax={row['arm_max']}")
    json.dump(out, open(r'C:\work\cine-pics\s22\screen_audit.json', 'w'), indent=1)
