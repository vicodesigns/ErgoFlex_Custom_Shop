#!/usr/bin/env python3
"""Build the posed people in tools/people/cast.py into library props.

    python3 tools/people/build.py [id ...] [--all] [--who a,b] [--pose p,q] [--jobs 4] [--keep]

--all: every character in every posture (cast.all_outputs(): about 500 models, a few minutes), the library the
Director's People tab swaps between; --who and --pose narrow it to some characters or postures. Only the listed cast (cast.OUTPUTS) is entered in tools/props/manifest.json.

For each output: Blender + MPFB makes a posed static GLB (build_people.py), its
materials get the right alpha mode, gltf-transform compresses it into
assets/props/<id>.glb, and the prop is entered in tools/props/manifest.json and
assets/props/index.json (category "people"). Thumbnails: tools/props/thumbnails.mjs.

Needs: BLENDER (default ~/blender/blender-4.2.3-linux-x64/blender; on Windows
~/blender/blender-4.2.3-windows-x64/blender.exe) with MPFB 2.0.18 and the MakeHuman CC0 asset packs in
BLENDER_USER_RESOURCES (default ~/blender/mpfb-user). Runs on Linux and Windows (there: python, not python3).
"""
import glob, json, os, struct, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import cast  # noqa: E402

WINDOWS = os.name == 'nt'      # (the render PC builds people too: same Blender, MPFB and packs under ~/blender)
BLENDER = os.environ.get('BLENDER', os.path.expanduser('~/blender/blender-4.2.3-windows-x64/blender.exe' if WINDOWS else '~/blender/blender-4.2.3-linux-x64/blender'))
ENV = dict(os.environ, BLENDER_USER_RESOURCES=os.environ.get('BLENDER_USER_RESOURCES', os.path.expanduser('~/blender/mpfb-user')))
args = sys.argv[1:]
jobs = int(args[args.index('--jobs') + 1]) if '--jobs' in args else 4
keep = '--keep' in args
preview = args[args.index('--preview') + 1] if '--preview' in args else None   # folder for two Cycles views per person
no_manifest = '--no-manifest' in args                      # built on request: leave tools/props/manifest.json alone
who = args[args.index('--who') + 1].split(',') if '--who' in args else None     # with --all: only these characters
poses = args[args.index('--pose') + 1].split(',') if '--pose' in args else None   # with --all: only these postures
only = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] not in ('--jobs', '--preview', '--who', '--pose'))]
gltf_transform = ['node', os.path.join(ROOT, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js')]      # (not node_modules/.bin: that is a shell launcher, a .cmd on Windows)
outputs = [cast.output(i) for i in only] if only else cast.all_outputs() if '--all' in args else list(cast.OUTPUTS)
if who: outputs = [o for o in outputs if o['character'] in who]
if poses: outputs = [o for o in outputs if o['pose'] in poses]
listed = {o['id'] for o in cast.OUTPUTS}      # an id nobody listed: people-<character>-<pose>
work = os.path.join(tempfile.gettempdir(), 'ergoflex-people'); os.makedirs(work, exist_ok=True)


def blender(o):
    r = subprocess.run([BLENDER, '-b', '--python-exit-code', '1', '--python', os.path.join(HERE, 'build_people.py'), '--', o['id'], work] + (['--preview', os.path.join(preview, o['id'])] if preview else []),
                       capture_output=True, text=True, env=ENV)
    line = next((l for l in r.stdout.splitlines() if l.startswith('RESULT ')), None)
    if r.returncode or not line: return o, None, 'Blender failed\n' + (r.stdout[-1500:] + r.stderr[-1500:])
    result = json.loads(line[7:]); raw = os.path.join(work, o['id'] + '.glb'); out = os.path.join(ROOT, 'assets/props', o['id'] + '.glb')
    set_alpha(raw, result['alpha'], result.get('cutoff', {}))
    r = subprocess.run([*gltf_transform, 'optimize', raw, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', str(o.get('textureSize', 1024)),
                        '--simplify', 'false', '--palette', 'false', '--join', 'false'], capture_output=True, text=True)
    if r.returncode: return o, None, 'optimize failed\n' + r.stderr[-800:]
    if not keep:
        os.remove(raw)
        for f in glob.glob(os.path.join(work, 'tex', glob.escape(o['id']) + '--*.png')): os.remove(f)      # (the textures it was built with: some 10 MB a model)
    return o, result, None


def set_alpha(path, alpha, cutoff={}):
    """Rewrite the GLB's JSON chunk: hair, brows and lashes are cut-outs, everything else is opaque."""
    data = open(path, 'rb').read(); magic, version, _ = struct.unpack_from('<4sII', data, 0)
    length, kind = struct.unpack_from('<I4s', data, 12); doc = json.loads(data[20:20 + length]); rest = data[20 + length:]
    for m in doc.get('materials', []):
        mode = alpha.get(m.get('name'), 'OPAQUE'); m['alphaMode'] = mode; m.pop('alphaCutoff', None)
        if mode == 'MASK': m['alphaCutoff'] = cutoff.get(m.get('name'), .4); m['doubleSided'] = True
    body = json.dumps(doc, separators=(',', ':')).encode(); body += b' ' * (-len(body) % 4)
    out = struct.pack('<4sII', magic, version, 12 + 8 + len(body) + len(rest)) + struct.pack('<I4s', len(body), kind) + body + rest
    open(path, 'wb').write(out)


results = []; failed = 0
with ThreadPoolExecutor(jobs) as pool:
    for o, result, error in pool.map(blender, outputs):
        if error: failed += 1; print(f"x {o['id']}: {error}"); continue
        out = os.path.join(ROOT, 'assets/props', o['id'] + '.glb')
        entry = {'id': o['id'], 'name': o['name'], 'category': 'people', 'scenes': o.get('scenes', []), 'file': f"assets/props/{o['id']}.glb", 'anchor': 'floor',
                 'size': result['size'], 'min': result['min'], 'max': result['max'], 'tris': result['tris'], 'bytes': os.path.getsize(out),
                 'source': 'tools/people/cast.py', 'license': 'CC0 (MakeHuman / MPFB assets)', 'attribution': None, 'collection': 'people',
                 'person': {'character': o['character'], 'pose': o['pose'], **({'deskHeight': o['height']} if 'height' in o else {})}}
        spec = {'id': o['id'], 'name': o['name'], 'category': 'people', 'scenes': o.get('scenes', []), 'converter': 'people-generator', 'collection': 'people'}
        results.append({'manifest': spec if o['id'] in listed else None, 'index': entry})
        print(f"ok {o['id']:34} {result['tris']:6} tris {entry['bytes'] // 1024:5} KB  {' x '.join(str(round(v)) for v in result['size'])} mm")
results_file = os.path.join(work, 'results.json'); json.dump(results, open(results_file, 'w'))
subprocess.run(['node', os.path.join(HERE, 'index-people.mjs'), results_file] + (['--no-manifest'] if no_manifest else []), check=True)
subprocess.run([sys.executable, os.path.join(HERE, 'catalog.py')], check=True)
print(f"{len(outputs) - failed} built, {failed} failed")
sys.exit(1 if failed else 0)
