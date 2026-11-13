#!/usr/bin/env python3
"""Cache stamps for changed browser modules.

    python3 tools/dev/restamp.py <stamp> [<base commit, default HEAD>] [--dry]

The Studio imports its modules with a version in the URL ('./room-people.mjs?v=polish-20261112e'), so a browser
that has the old file cached asks for the new one. A module that changed needs a new stamp wherever it is imported,
which changes the importer, which then needs one too, up to index.html and product-demo.html. This finds every
root-level .mjs / .js that differs from <base> (committed or not), gives its import URLs the new stamp in the
root-level .mjs, .js and .html files, and repeats until nothing more changes.
"""
import re, subprocess, sys, os
args = [a for a in sys.argv[1:] if not a.startswith('--')]; dry = '--dry' in sys.argv
if not args: sys.exit(__doc__)
stamp, base = args[0], (args[1] if len(args) > 1 else 'HEAD')
root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip(); os.chdir(root)
files = [f for f in os.listdir('.') if f.endswith(('.mjs', '.js', '.html')) and os.path.isfile(f)]
text = {f: open(f, encoding='utf8').read() for f in files}
changed = set(subprocess.check_output(['git', 'diff', '--name-only', base, '--'] + files, text=True).split())
done, touched = set(), {}
while changed - done:
    name = sorted(changed - done)[0]; done.add(name)
    if not name.endswith(('.mjs', '.js')): continue
    pattern = re.compile(r"((?:\./|/)?" + re.escape(name) + r"\?v=)([A-Za-z0-9._-]+)")
    for f in files:
        new, n = pattern.subn(lambda m: m.group(1) + stamp, text[f])
        if n and new != text[f]: text[f] = new; touched[f] = touched.get(f, 0) + n; changed.add(f)
for f, n in sorted(touched.items()):
    print(f'{f}: {n} import{"s" if n > 1 else ""} -> {stamp}')
    if not dry: open(f, 'w', encoding='utf8').write(text[f])
print(f'{len(touched)} files restamped' + (' (dry run)' if dry else ''))
