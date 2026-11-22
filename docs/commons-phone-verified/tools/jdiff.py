import json,sys
def walk(a,b,p='',out=None):
    if type(a)!=type(b) and not (isinstance(a,(int,float)) and isinstance(b,(int,float))):
        out.append(f'CHANGED {p} {str(a)[:90]} -> {str(b)[:90]}'); return
    if isinstance(a,dict):
        for k in sorted(set(a)|set(b)):
            if k not in a: out.append(f'ADDED {p}/{k} {json.dumps(b[k],ensure_ascii=False)[:140]}')
            elif k not in b: out.append(f'REMOVED {p}/{k} {json.dumps(a[k],ensure_ascii=False)[:140]}')
            else: walk(a[k],b[k],p+'/'+k,out)
    elif isinstance(a,list):
        if len(a)!=len(b): out.append(f'LEN {p} {len(a)} -> {len(b)}')
        for i,(x,y) in enumerate(zip(a,b)): walk(x,y,f'{p}[{i}]',out)
        for i in range(len(a),len(b)): out.append(f'ADDED {p}[{i}] {json.dumps(b[i],ensure_ascii=False)[:140]}')
        for i in range(len(b),len(a)): out.append(f'REMOVED {p}[{i}] {json.dumps(a[i],ensure_ascii=False)[:140]}')
    elif a!=b: out.append(f'CHANGED {p} {str(a)[:90]} -> {str(b)[:90]}')
    return out
def diff(a,b): return walk(a,b,'',[])
if __name__=='__main__':
    a=json.load(open(sys.argv[1],encoding='utf8')); b=json.load(open(sys.argv[2],encoding='utf8'))
    if len(sys.argv)>3:
        for k in sys.argv[3].split('.'):
            a=a[int(k)] if k.isdigit() else a[k]; b=b[int(k)] if k.isdigit() else b[k]
    for l in diff(a,b): print(l)
