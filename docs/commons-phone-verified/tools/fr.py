"""fr.py <seconds> <t1> <t2> ... | fr.py <seconds> range a b step : chapter seconds -> comma-separated fractions"""
import sys
T=float(sys.argv[1]); a=sys.argv[2:]
if a[0]=='range':
    x,y,s=map(float,a[1:4]); ts=[]; t=x
    while t<=y+1e-9: ts.append(round(t,4)); t+=s
else: ts=[float(v) for v in a]
print(','.join(f'{t/T:.6f}'.rstrip('0').rstrip('.') if t else '0' for t in ts))
