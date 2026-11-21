import json,math,subprocess,os
BONES=['spine_02','spine_03','clavicle_r','upperarm_r','lowerarm_r','hand_r']
def rv2q(r):
    a=math.sqrt(sum(x*x for x in r))
    if a<1e-9: return [0,0,0,1]
    s=math.sin(a/2)/a
    return [r[0]*s,r[1]*s,r[2]*s,math.cos(a/2)]
def qmul(a,b):
    ax,ay,az,aw=a; bx,by,bz,bw=b
    return [aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz]
def pose_from(rv):  # rv: dict bone->rotvec
    return {b:[round(x,5) for x in rv2q(r)] for b,r in rv.items()}
def make_cut(cands, base='base2-commons.json', out='sweep-cut.json', t0=1.0, dt=0.1):
    d=json.load(open(base))
    mia=[c for c in d['people']['cast'] if c['key']=='mia-waits'][0]
    keys=[]
    for k,rv in enumerate(cands):
        keys.append({"t":round(t0+dt*k,3),"pose":pose_from(rv),"ease":"hold"})
    mia['postures']['people-mia-power-phone']['poseKeys']=keys
    d['seconds']=16
    json.dump({"name":"cphone","shots":[d]},open(out,'w'))
    return [round(t0+dt*k+0.04,3) for k in range(len(cands))]
