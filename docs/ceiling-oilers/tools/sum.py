import json,sys
for l in open(sys.argv[1],encoding='utf8'):
  if not l.startswith('PROBE '): continue
  r=json.loads(l[6:])
  hits={k:(v['hits'],v['minMm']) for k,v in r['obstacles'].items() if (v['minMm'] if v['minMm'] is not None else 1e9)<float(sys.argv[2] if len(sys.argv)>2 else 15)}
  print(r['sec'],r['moving'],'scrW',r['screenWorldBox'],'loc',r['screenLocalBox'],'hand',r['handToScreenMm'],r['tipToScreenMm'],r['noah'])
  print('    ',hits)
