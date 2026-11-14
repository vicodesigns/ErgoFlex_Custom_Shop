#!/usr/bin/env python3
"""Film cuts: whole versions of the film that the Director's Cut menu switches between.

A cut is a folder under exports/ with a review-cut.json. The master cut (exports/cinematic-intro-20261104-hq14, Vico's)
has the whole builder chain behind it; every other cut carries a cut.json ({id, name, note, from, created}) and is
edited through the same round trip (Director -> Export cut -> build-round8-director.py --import / pass / --pages in
that folder; a render request for it freezes the master's inputs with this folder's film data laid over them,
tools/experience/render-request.sh).

  film-cuts.py list                               write exports/film-cuts.json (what the Cut menu reads) and print it
  film-cuts.py adopt <cut dir> "<name>" [--id slug] [--note text] [--from <cut dir>]
                                                  make an existing folder with a review-cut.json a cut: cut.json, the
                                                  support files it lacks from the cut it came from, Director pages
  film-cuts.py duplicate <cut dir> "<name>" [--id slug] [--note text]
                                                  a new cut folder with a copy of that cut's film data; prints its dir
  film-cuts.py pages <cut dir> [chapter id ...]   (re)build the cut's Director pages and chapter list
Run under flock /tmp/claude-1000/hq14-cut.lock when a Director import may be running.
"""
import glob, json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
MASTER = 'exports/cinematic-intro-20261104-hq14'
DIRECTOR = os.path.join(HERE, 'build-round8-director.py')
# What makes a cut besides review-cut.json: the film data the Director pass and the renderer read from the folder.
DATA = ('shots/*.json', 'director-camera.json', 'director-camera-*.json', 'previews/awaken-v5-cut.json', 'post/finale-seed.json', 'titles-src.json', 'edl.json')
# A derived cut with only a review-cut.json still needs these of its source (the finale's desk versions and their builds).
SUPPORT = ('shots/13-subshots.json', 'post/finale-seed.json', 'titles-src.json')


def rel(d): return os.path.relpath(os.path.abspath(d if os.path.isabs(d) else os.path.join(ROOT, d)), ROOT).strip('/')
def full(d): return os.path.join(ROOT, rel(d))
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')[:40] or 'cut'
def info(d):
    p = os.path.join(full(d), 'cut.json')
    return json.load(open(p)) if os.path.exists(p) else None


def cuts():
    out = []
    for cut in sorted(glob.glob(os.path.join(ROOT, 'exports', '*', 'review-cut.json'))):
        d = rel(os.path.dirname(cut)); i = info(d)
        if d != MASTER and not i: continue
        chapters = os.path.join(ROOT, d, 'director-chapters.json')
        if not os.path.exists(chapters): continue
        seconds = sum(float(s.get('seconds') or 0) for s in json.load(open(cut))['shots'])
        e = {'id': 'vico', 'name': "Vico's cut", 'note': 'The film as it renders today.', 'master': True} if d == MASTER else {'id': i['id'], 'name': i['name'], 'note': i.get('note', ''), 'from': i.get('from', '')}
        out.append({**e, 'dir': '/' + d, 'chapters': '/' + d + '/director-chapters.json', 'seconds': round(seconds, 2),
                    'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(os.path.getmtime(cut))), 'created': (i or {}).get('created', '')})
    out.sort(key=lambda c: (not c.get('master'), c.get('created', ''), c['name']))
    return out


def write_list():
    data = {'v': 1, 'cuts': cuts()}; p = os.path.join(ROOT, 'exports', 'film-cuts.json')
    if not os.path.exists(p) or json.load(open(p)) != data: json.dump(data, open(p, 'w'), indent=1)
    return data


def pages(d, ids=()):
    os.makedirs(os.path.join(full(d), 'director-import'), exist_ok=True)
    subprocess.run([sys.executable, DIRECTOR, full(d), '--pages', *ids, '--downloads', os.path.join(full(d), 'director-import')], check=True, stdout=subprocess.DEVNULL)


def opt(args, name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default


def new_id(want):
    taken = {c['id'] for c in cuts()} | {'vico'}; base = slug(want); cid = base; n = 2
    while cid in taken or os.path.exists(os.path.join(ROOT, 'exports', 'cinematic-intro-cut-' + cid)): cid = f'{base}-{n}'; n += 1
    return cid


def copy_data(src, dst, patterns):
    for pat in patterns:
        for f in glob.glob(os.path.join(full(src), pat)):
            name = os.path.relpath(f, full(src))
            if re.search(r'\.(pre|vico|cine)[-.]', name): continue        # backups stay with their cut
            to = os.path.join(full(dst), name)
            if not os.path.exists(to): os.makedirs(os.path.dirname(to), exist_ok=True); shutil.copy2(f, to)


def main():
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    cmd = args.pop(0)
    if cmd == 'list': print(json.dumps(write_list(), indent=1)); return
    if cmd == 'pages': pages(args[0], args[1:]); write_list(); return
    if cmd == 'adopt':
        cid, note, src = opt(args, '--id'), opt(args, '--note', ''), opt(args, '--from', MASTER); d, name = rel(args[0]), args[1]
        if d == MASTER: sys.exit('the master cut needs no cut.json')
        if not os.path.exists(os.path.join(full(d), 'review-cut.json')): sys.exit(f'{d}: no review-cut.json')
        old = info(d) or {}
        json.dump({'id': old.get('id') or cid or new_id(name), 'name': name, 'note': note or old.get('note', ''), 'from': rel(src), 'created': old.get('created') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())},
                  open(os.path.join(full(d), 'cut.json'), 'w'), indent=1)
        copy_data(src, d, SUPPORT); pages(d); write_list(); print(d); return
    if cmd == 'duplicate':
        cid, note = opt(args, '--id'), opt(args, '--note', ''); src, name = rel(args[0]), args[1].strip()[:60]
        if not name: sys.exit('a cut needs a name')
        if not os.path.exists(os.path.join(full(src), 'review-cut.json')): sys.exit(f'{src}: no review-cut.json')
        cid = new_id(cid or name); d = 'exports/cinematic-intro-cut-' + cid; os.makedirs(full(d))
        shutil.copy2(os.path.join(full(src), 'review-cut.json'), os.path.join(full(d), 'review-cut.json'))
        copy_data(src, d, DATA)
        from_name = (info(src) or {}).get('name') or "Vico's cut"
        json.dump({'id': cid, 'name': name, 'note': note or f'A copy of {from_name}, made {time.strftime("%B %-d, %Y")}.', 'from': src, 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())},
                  open(os.path.join(full(d), 'cut.json'), 'w'), indent=1)
        pages(d); write_list()
        ep = os.path.join(full(d), 'edl.json')
        if os.path.exists(ep) and 'GENERATED by tools/experience/build-cine-score.py' in open(ep, encoding='utf-8').read():
            # the copy has a generated edl.json but no score (score/ is not copied): render requests for it are refused
            # until its own score is built
            print(f'{d} has a generated edl.json: build its score before a render request with\n'
                  f'  python3 tools/experience/build-cine-score.py {d}', file=sys.stderr)
        print(d); return
    sys.exit(__doc__)


if __name__ == '__main__': main()
