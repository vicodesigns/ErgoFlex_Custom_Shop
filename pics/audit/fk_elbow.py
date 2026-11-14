"""Read-only FK over assets/props/people-rigs/<who>.json: shoulder/elbow/wrist world positions and elbow angles."""
import json, math, sys, os
RIGS = r'C:\work\ergoflex-cine-s4\assets\props\people-rigs'
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz)
def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    # v' = q v q*
    ix = w*vx + y*vz - z*vy; iy = w*vy + z*vx - x*vz; iz = w*vz + x*vy - y*vx; iw = -x*vx - y*vy - z*vz
    return (ix*w + iw*-x + iy*-z - iz*-y, iy*w + iw*-y + iz*-x - ix*-z, iz*w + iw*-z + ix*-y - iy*-x)
def fk(rig, pid):
    P = rig['postures'][pid]; B = rig['bones']; par = rig['parents']; off = rig['offsets']; q = P['q']
    wp, wq = [None]*len(B), [None]*len(B)
    for i, name in enumerate(B):
        t = tuple(off[3*i:3*i+3])
        if name == 'Root': t = tuple(P['root'])
        if name == 'pelvis': t = tuple(P['pelvis'])
        lq = tuple(q[4*i:4*i+4])
        if par[i] < 0: wp[i], wq[i] = t, lq
        else:
            pp, pq = wp[par[i]], wq[par[i]]
            r = qrot(pq, t); wp[i] = (pp[0]+r[0], pp[1]+r[1], pp[2]+r[2]); wq[i] = qmul(pq, lq)
    return dict(zip(B, wp)), dict(zip(B, wq))
def ang(a, o, b):
    u = [a[i]-o[i] for i in range(3)]; v = [b[i]-o[i] for i in range(3)]
    c = sum(u[i]*v[i] for i in range(3)) / (math.dist(a, o) * math.dist(b, o)); return math.degrees(math.acos(max(-1, min(1, c))))
def report(who, pid):
    rig = json.load(open(os.path.join(RIGS, who + '.json')))
    if pid not in rig['postures']: return {'id': pid, 'missing': True}
    p, _ = fk(rig, pid); P = rig['postures'][pid]
    out = {'id': pid, 'pose': P['pose'], 'deskHeight': P.get('deskHeight'), 'pelvisY': p['pelvis'][1], 'headY': p['head'][1]}
    for s in 'lr':
        sh, el, wr = p['upperarm_' + s], p['lowerarm_' + s], p['hand_' + s]
        fa = [wr[i]-el[i] for i in range(3)]; h = math.hypot(fa[0], fa[2])
        out[s] = {'shoulderY': sh[1], 'elbowY': el[1], 'wristY': wr[1], 'elbow': ang(sh, el, wr),
                  'forearm_pitch': math.degrees(math.atan2(fa[1], h)),   # + = hand above elbow
                  'upperarm_from_vertical': math.degrees(math.acos(max(-1, min(1, (el[1]-sh[1]) / -math.dist(sh, el))))),
                  'upper': math.dist(sh, el), 'fore': math.dist(el, wr)}
    return out
if __name__ == '__main__':
    for arg in sys.argv[1:]:
        who = arg.split('-')[1]; r = report(who, arg)
        if r.get('missing'): print(arg, 'MISSING'); continue
        L, R = r['l'], r['r']
        print(f"{arg:34s} {r['pose']:16s} dh={r['deskHeight']!s:5s} pelvis={r['pelvisY']:.3f} head={r['headY']:.3f} | "
              f"sh={(L['shoulderY']+R['shoulderY'])/2:.3f} el={(L['elbowY']+R['elbowY'])/2:.3f} wr={(L['wristY']+R['wristY'])/2:.3f} "
              f"elbowAng L/R={L['elbow']:.0f}/{R['elbow']:.0f} forearm L/R={L['forearm_pitch']:+.0f}/{R['forearm_pitch']:+.0f} "
              f"upperarm L/R={L['upperarm_from_vertical']:.0f}/{R['upperarm_from_vertical']:.0f}")
