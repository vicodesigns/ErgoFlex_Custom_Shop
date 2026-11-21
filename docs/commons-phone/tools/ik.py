import numpy as np, json
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot
from fk import *
P0,Q0=load_base()
VLOC=np.load('phone_centre_local.npy'); MAX=np.load('phone_axes_local.npy')      # phone centre in the held bone's frame (m)
ELBOW_Y=1.22
BONES=['spine_02','spine_03','clavicle_r','upperarm_r','lowerarm_r','hand_r']
LIM={'spine_02':0.6,'spine_03':0.6,'clavicle_r':0.35,'upperarm_r':1.6,'lowerarm_r':1.9,'hand_r':1.1}
# target orientation of the held frame: local x->(0,-1,0), y->(-1,0,0), z->(0,0,-1)  (screen up, top away from her)
def target_q(yaw=0.0,n=(0,1,0),l=(-1,0,0)):
    n=np.array(n,float); l=np.array(l,float); l-=n*(l@n); l/=np.linalg.norm(l); n/=np.linalg.norm(n); w=np.cross(l,n)
    T=np.column_stack([n,l,w]); R=Rot.from_matrix(T@MAX.T)
    return Rot.from_euler('y',yaw)*R
def phone_centre(P,Q): return P['held_hand_r']+Q['held_hand_r'].apply(VLOC)
def solve(tpos,yaw=0.0,x0=None,w_or=0.35,w_reg=0.02,fixed=None,wrist_free=False):
    tq=target_q(yaw)
    def unpack(x): return {b:x[3*i:3*i+3] for i,b in enumerate(BONES)}
    def res(x):
        d=unpack(x); P,Q=fk(P0,Q0,d)
        e_p=(phone_centre(P,Q)-tpos)*10
        e_o=(Q['held_hand_r']*tq.inv()).as_rotvec()*w_or
        reg=x*w_reg
        el=P['lowerarm_r']; e_el=np.array([max(0,el[1]-ELBOW_Y)*4])
        return np.concatenate([e_p,e_o,reg,e_el])
    lo=np.concatenate([[-LIM[b]]*3 for b in BONES]); hi=-lo
    if x0 is None: x0=np.zeros(18)
    sol=least_squares(res,x0,bounds=(lo,hi))
    d=unpack(sol.x); P,Q=fk(P0,Q0,d)
    return sol.x,P,Q,np.linalg.norm(phone_centre(P,Q)-tpos),np.degrees(np.linalg.norm((Q['held_hand_r']*tq.inv()).as_rotvec()))
if __name__=='__main__':
    for x in (2.6,2.8,2.95,3.2):
        tp=np.array([x,1.123+0.04,-10.838])
        sol,P,Q,ep,eo=solve(tp)
        print('target x',x,'pos err m %.3f'%ep,'orient err deg %.1f'%eo)
        print('  rotvec',{b:np.round(sol[3*i:3*i+3],2).tolist() for i,b in enumerate(BONES)})
        print('  hand',np.round(P['hand_r'],3),'elbow',np.round(P['lowerarm_r'],3),'phone',np.round(phone_centre(P,Q),3))
