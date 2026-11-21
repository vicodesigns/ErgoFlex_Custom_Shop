#!/usr/bin/env python3
"""Export docs (the Director's 'Export cut' format, one chapter) for the commons phone patch, one per cut.
usage: make_export.py <cut id e.g. vicos-3rd-cut> <chapter json (the patched commons film shot)> <out doc>"""
import json,sys
cid,chapter,out=sys.argv[1:4]
d=json.load(open(chapter,encoding='utf8'))
T=d['seconds']
keys=[]
for i,k in enumerate(d['cameraPlan']['keys']):
    key={'id':f'plan-{i:02d}','time':k['at']/T,'label':k.get('label',''),'easing':'smooth','view':{'position':k['position'],'target':k['target'],'fov':k.get('fov',35),'aspect':16/9}}
    keys.append(key)
shot={k:d[k] for k in ('id','room','kind','seconds','title','detail','preset','transition','size','layout','look','mode') if k in d}
shot['motion']=d['motion']
shot['camera']={'keys':keys}
people=json.loads(json.dumps(d['people']))
shot['peopleEdits']={'v':2,**people}
doc={'schema':'ergoflex.client-cut','version':1,'id':f'film-{cid}-commons','name':'Film chapter: commons (16 s)','client':cid.replace('vicos-','Vicos ').replace('-',' '),'volume':0.32,'shots':[shot]}
json.dump(doc,open(out,'w',encoding='utf8',newline='\n'),indent=2,ensure_ascii=False)
print('wrote',out)
