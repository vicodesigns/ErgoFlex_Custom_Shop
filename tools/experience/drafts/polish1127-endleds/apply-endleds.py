#!/usr/bin/env python3
"""Chapter 12 (hero) data patch, polish1127-endleds: the white ending has its LEDs on.

    python3 tools/experience/drafts/polish1127-endleds/apply-endleds.py <cut folder>           dry run: reports
    python3 tools/experience/drafts/polish1127-endleds/apply-endleds.py <cut folder> --apply   writes

Vico (27 Nov 2026): at the end of the hero the Pearl White desk's lights are off (only a faint glow on the floor). They should be on, the
same natural white LEDs as the film's first chapter, fading in with the finish fade and staying on to the end.

The finish fade of the Gaming desk (letter H) cross-fades the picture from the desk's own look to {..., set}; its set had
ledColor #fff6ea and ledGlow 0.06 (the glow is a multiplier of every strip, so the strips were nearly dark). The set now carries
what chapter 1 (awaken.json) uses: ledColor, ledGlow and ledSurfaces. Files: director-camera-hero.json (finishFades.H.set, the
Director's), director-film/hero-subshots.json and shots/13-subshots.json (the sub-shot's finishFade.set, the film's).
Options: --color '#767676' --glow 1 (default: awaken.json's). A second run reports 'already applied'.
"""
import json, os, re, sys

class Doc:
    def __init__(self, path):
        self.path = path; self.raw = open(path, encoding='utf-8', newline='').read(); self.data = json.loads(self.raw)
        self.ascii = '\\u' in self.raw
        m = re.match(r'^[\[{]\n( +)', self.raw); self.indent = len(m.group(1)) if m else None
        self.seps = None if self.indent is not None or '": ' in self.raw[:3000] or '", "' in self.raw[:3000] else (',', ':')
        if self.dumps() != self.raw: sys.exit(f'{path}: cannot write it back byte for byte; stopped before changing anything')
    def dumps(self):
        return json.dumps(self.data, ensure_ascii=self.ascii, indent=self.indent, separators=self.seps) + ('\n' if self.raw.endswith('\n') else '')
    def write(self):
        with open(self.path, 'w', encoding='utf-8', newline='') as f: f.write(self.dumps())

def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def fades(node):
    """every finish fade 'set' in a document: finishFade of a sub-shot, finishFades {letter: fade} of the Director's file"""
    if isinstance(node, dict):
        f = node.get('finishFade')
        if isinstance(f, dict) and isinstance(f.get('set'), dict): yield f['set']
        ff = node.get('finishFades')
        if isinstance(ff, dict):
            for v in ff.values():
                if isinstance(v, dict) and isinstance(v.get('set'), dict): yield v['set']
        for v in node.values(): yield from fades(v)
    elif isinstance(node, list):
        for v in node: yield from fades(v)

def main():
    cut = sys.argv[1]; apply = '--apply' in sys.argv
    awaken = json.load(open(os.path.join(cut, 'director-film', 'awaken.json'), encoding='utf-8'))
    color = arg('--color', awaken['ledColor']); glow = float(arg('--glow', awaken['ledGlow'])); surfaces = awaken['ledSurfaces']
    n = 0
    for rel in ('director-camera-hero.json', 'director-film/hero-subshots.json', 'shots/13-subshots.json'):
        doc = Doc(os.path.join(cut, rel)); hit = 0
        for s in fades(doc.data):
            if s.get('ledColor') == color and s.get('ledGlow') == glow and s.get('ledSurfaces') == surfaces: print(f'{rel}: already applied'); continue
            print(f"{rel}: ledColor {s.get('ledColor')} -> {color}, ledGlow {s.get('ledGlow')} -> {glow}, ledSurfaces {'set' if s.get('ledSurfaces') else 'none'} -> chapter 1's")
            s['ledColor'] = color; s['ledGlow'] = glow; s['ledSurfaces'] = json.loads(json.dumps(surfaces)); hit += 1
        if hit and apply: doc.write()
        n += hit
    print(f"{n} fade(s) {'changed' if apply else 'would change (dry run: add --apply)'}")

if __name__ == '__main__': main()
