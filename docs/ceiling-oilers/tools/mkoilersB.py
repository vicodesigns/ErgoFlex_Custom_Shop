import json,copy,sys
src,dst=sys.argv[1:3]
c=json.load(open(src));s=c['shots'][0]
SPOT=[-3098,-1064]
for e in s['people']['cast']:
  if e['key']=='noah-steps': e['walk']['path'][2]=SPOT
  if e['key'] in ('noah-pulls','noah-taps','noah-watches'): e['at']=SPOT
  if e['key']=='noah-pulls': e['act']['by']=[0,0,142]
json.dump(c,open(dst,'w'))
print('ok')
