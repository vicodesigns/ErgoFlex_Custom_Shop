"""mkviews.py <chapter json | cut dir> <tag>: review-camera cuts (the earlier engineer's mkview.py: one fixed view over the chapter)."""
import json,sys,os
src,tag=sys.argv[1:3]
if os.path.isdir(src):
    cut=json.load(open(os.path.join(src,'review-cut.json'),encoding='utf8')); d=next(s for s in cut['shots'] if s['id']=='commons')
else: d=json.load(open(src,encoding='utf8'))
VIEWS={'f2f':([4.2,2.2,-11.9],[2.9,1.1,-10.8],36),
       'top':([3.0,4.2,-10.3],[3.0,0.8,-10.7],42),
       'low':([2.8,1.30,-11.9],[2.8,1.13,-10.8],30),
       'pad':([3.75,1.7,-11.45],[3.247,1.13,-10.838],30),
       'yara':([-2.2,2.3,-11.0],[-3.13,1.45,-11.94],40),
       'yarawide':([-1.2,2.4,-9.9],[-3.13,1.3,-11.94],50)}
for name,(p,t,fov) in VIEWS.items():
    s=json.loads(json.dumps(d))
    v={"position":p,"target":t,"fov":fov,"aspect":16/9}
    s['camera']={"keys":[{"id":"v0","time":0,"label":"v","easing":"linear","view":v},{"id":"v1","time":1,"label":"v","easing":"linear","view":v}]}
    s.pop('cameraPlan',None)
    json.dump({"name":"cphone","shots":[s]},open(f'C:/work/cphone/cuts/{tag}-{name}.json','w',encoding='utf8'))
print('views',list(VIEWS))
