# python sync.py keys.json : put Maya's sit-type poseKeys into the four 3rd-cut rise stores, serialized as they already are
import json, sys
E = 'C:/Users/Vico/polish-wt/rise-maya-elbow-hand/exports/cinematic-intro-cut-vicos-3rd-cut/'
keys = json.load(open(sys.argv[1], encoding='utf-8'))
ID = 'people-maya-sit-type'
def rw(path, get, indent, crlf):
    raw = open(E + path, 'rb').read().decode('utf-8'); o = json.loads(raw)
    get(o)['postures'][ID]['poseKeys'] = keys
    s = json.dumps(o, indent=indent) if indent else json.dumps(o)
    if crlf: s = s.replace('\n', '\r\n')
    open(E + path, 'wb').write(s.encode('utf-8'))
rw('director-camera-rise.json', lambda o: o['people']['cast'][0], 1, True)
rw('director-film/rise.json', lambda o: o['people']['cast'][0], 1, True)
rw('review-cut.json', lambda o: next(s for s in o['shots'] if s.get('id') == 'rise')['people']['cast'][0], 1, True)
rw('director-import/ErgoFlex-film-ch02-rise-director.json', lambda o: o['shots'][0]['peopleEdits']['cast'][0], None, False)
cs = [json.dumps(c) for c in [json.load(open(E + 'director-camera-rise.json'))['people']['cast'][0], json.load(open(E + 'director-film/rise.json'))['people']['cast'][0],
      next(s for s in json.load(open(E + 'review-cut.json'))['shots'] if s.get('id') == 'rise')['people']['cast'][0], json.load(open(E + 'director-import/ErgoFlex-film-ch02-rise-director.json'))['shots'][0]['peopleEdits']['cast'][0]]]
print('cast[0] identical in 4 stores:', all(c == cs[0] for c in cs), len(cs[0]))
