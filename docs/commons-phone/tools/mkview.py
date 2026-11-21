import json,sys
# usage: mkview.py <chapter.json> <out cut.json> px,py,pz tx,ty,tz fov
src,dst,p,t,fov=sys.argv[1:6]
d=json.load(open(src))
v={"position":[float(x) for x in p.split(',')],"target":[float(x) for x in t.split(',')],"fov":float(fov),"aspect":16/9}
d['camera']={"keys":[{"id":"v0","time":0,"label":"v","easing":"linear","view":v},{"id":"v1","time":1,"label":"v","easing":"linear","view":v}]}
d.pop('cameraPlan',None)
json.dump({"name":"cphone","shots":[d]},open(dst,'w'))
