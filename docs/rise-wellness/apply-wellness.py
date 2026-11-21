#!/usr/bin/env python3
"""Chapter 7 (wellness, Desk Squats) of Vico's 3rd cuts, Nov 21 2026: Maya's arms into and out of the squats, and the chair out of the desk's way.

  apply-wellness.py <cut dir> [--chair '{"back": .., "side": .., "turn": ..}'] [--fade from,to,fadeOut] [--when t0,t1]
  Data (people only; camera, seconds, screens, the act's timing { at 10.2, dur 5.2, reps 3 } are not touched):
    people.when.maya-break [9.7, 15.8, .3, .35] -> [9.5, 16.1, .3, .35]: with the 1.4 s step each end is centred on, she is at her spot,
        arms by her sides, exactly when the first rep begins (10.2) and steps back in exactly as the last one ends (15.4); before, the step out
        ran into the first rep and the step in cut the last one short (the action was faded with the step's life: reps of 75 / 100 / 60 %).
    people.chair { back 100, side 1000, turn -60 } (parked between the film camera and the desk) -> { back 1700, side -500, turn 160 }: it rolls well back as
        she gets up, to free floor between the bike and the mat, and is out of the frame for the squats and the end beat.
  The arms themselves are code (room-people-motion.mjs squatArms / squatKey, room-people.mjs stepOuts).
  Writes review-cut.json, director-film/wellness.json and director-camera-wellness.json (format kept: indent 1, LF, no final newline).
"""
import json, os, sys
CHAIR = {'back': 1700, 'side': -500, 'turn': 160}   # free floor behind her to the window side, between the bike and the mat: out of the film camera's frame from 8.6 s on (checked on the top view and the film frames)
def load(p): return json.load(open(p, encoding='utf-8'))
def dump(p, d):   # (the file's own style is kept: some of the cut's files escape non-ASCII, some do not)
    raw = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8', newline=chr(10)).write(json.dumps(d, indent=1, ensure_ascii=raw.isascii()))
args = sys.argv[1:]; cut = args[0].rstrip('/' + chr(92))
opt = lambda k: args[args.index(k) + 1] if k in args else None
chair = json.loads(opt('--chair')) if opt('--chair') else CHAIR
when = [float(x) for x in opt('--when').split(',')] if opt('--when') else [9.5, 16.1]
fade = [float(x) for x in opt('--fade').split(',')] if opt('--fade') else None
rc = os.path.join(cut, 'review-cut.json'); cutd = load(rc)
shot = next(s for s in cutd['shots'] if s['id'] == 'wellness'); P = shot['people']
w = P['when']['maya-break'][0]; w[0], w[1] = when
P['chair'] = chair
shot['sceneEdits'] = [e for e in shot['sceneEdits'] if not e.get('chairAway')]
if fade: shot['sceneEdits'].append({'match': '^Person chair:', 'label': 'Task chair: gone while she is on her feet', 'show': {'from': fade[0], 'to': fade[1], 'fadeOut': fade[2], 'ease': 'smooth'}, 'chairAway': True})
cutd['shots'] = [shot if s['id'] == 'wellness' else s for s in cutd['shots']]
dump(rc, cutd); dump(os.path.join(cut, 'director-film', 'wellness.json'), shot)
dc = os.path.join(cut, 'director-camera-wellness.json'); d = load(dc)
d['people'] = {'v': 2, **P} if 'v' in d['people'] else P
dump(dc, d)
print('wellness:', os.path.basename(cut), 'when', P['when']['maya-break'], 'chair', P['chair'], 'fade', fade)
