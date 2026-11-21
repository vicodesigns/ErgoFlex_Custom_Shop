import json,sys
from gen1 import *
p=dict(T0=float(sys.argv[2]),T1=float(sys.argv[3]),Tr=float(sys.argv[4]),hover=float(sys.argv[5]),smid=0.5,mid_lift=0.05)
keys=build(p)
json.dump([[t,x.tolist()] for t,x in keys],open(sys.argv[1],'w'))
