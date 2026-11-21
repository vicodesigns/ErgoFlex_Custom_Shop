import json,sys
def walk(a,b,p=''):
    if type(a)!=type(b): print('CHANGED',p,str(a)[:80],'->',str(b)[:80]); return
    if isinstance(a,dict):
        for k in sorted(set(a)|set(b)):
            if k not in a: print('ADDED',p+'/'+k,json.dumps(b[k])[:110])
            elif k not in b: print('REMOVED',p+'/'+k)
            else: walk(a[k],b[k],p+'/'+k)
    elif isinstance(a,list):
        if len(a)!=len(b): print('LEN',p,len(a),'->',len(b))
        for i,(x,y) in enumerate(zip(a,b)): walk(x,y,f'{p}[{i}]')
    elif a!=b: print('CHANGED',p,str(a)[:80],'->',str(b)[:80])
walk(json.load(open(sys.argv[1],encoding='utf8')),json.load(open(sys.argv[2],encoding='utf8')))
