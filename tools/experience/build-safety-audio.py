#!/usr/bin/env python3
"""Score for the safety chapter (HQ7): a generated 'status' section in place of HQ6's stretched pad, plus one chime.

    python3 tools/experience/build-safety-audio.py exports/cinematic-intro-20261103-hq6 exports/cinematic-intro-20261103-hq7

1. score-synth.py renders the whole score from <dst>/edl.json (the 'status' style: 7 bars at
   115.9 BPM between the dissolve centres 86.25 and 100.75, with a swell on each centre).
2. Only that slot is taken from it; before 86.25 and after 100.75 the film keeps <src>'s score
   (HQ6 = HQ5 there, including HQ4's movement textures), joined with 0.3 s crossfades centred on
   the bar lines, so the length and every later cue are unchanged.
3. The app's target_reached chime (assets/led/audio, a C5 sine) plays once, at the green
   arrival, pitched up 2 semitones to D5 so it sits in the score's key (the fifth of the Gmaj9
   bar it lands on), about 8 dB under the music, which ducks 3 dB for 0.7 s around it.
"""
import json, os, subprocess, sys, tempfile
src, dst = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
edl = json.load(open(os.path.join(dst, 'edl.json'))); shot = json.load(open(os.path.join(dst, 'shots', '06.json')))
ch = {c['id']: c for c in edl['chapters']}; status = ch['status']
centres = sorted(edl['chapters'], key=lambda c: c['index'])
i = centres.index(status)
c_in = round((centres[i - 1]['end'] + status['start']) / 2, 3)     # 86.25
c_out = round((status['end'] + centres[i + 1]['start']) / 2, 3)    # 100.75
XF = 0.3
chime_at = round(status['start'] + next(e for e in shot['ledStatus'] if e['kind'] == 'target')['at'], 3)
CHIME_DB, DUCK_DB, ATT, HOLD, REL = -7.0, -3.0, 0.08, 0.7, 0.4

tmp = tempfile.mkdtemp(prefix='safety-score-')
gen = os.path.join(tmp, 'generated.wav')
subprocess.run([sys.executable, os.path.join(root, 'tools/experience/score-synth.py'), os.path.join(dst, 'edl.json'), gen, '--no-extras'], check=True, stdout=subprocess.DEVNULL)
old = os.path.join(src, 'score', 'score.wav')
h = XF / 2
# duck: 0 dB -> DUCK_DB over ATT from the chime, hold, release over REL
T0, T1, T2 = chime_at, chime_at + ATT, chime_at + HOLD
duck = (f"pow(10,({DUCK_DB}*if(lt(t,{T0}),0,if(lt(t,{T1}),(t-{T0})/{ATT},if(lt(t,{T2}),1,if(lt(t,{T2 + REL}),1-(t-{T2})/{REL},0)))))/20)")
f = [f'[0:a]atrim=0:{c_in + h},asetpts=N/SR/TB[a]',
     f'[1:a]atrim={c_in - h}:{c_out + h},asetpts=N/SR/TB[b]',
     f'[0:a]atrim={c_out - h},asetpts=N/SR/TB[c]',
     f'[a][b]acrossfade=d={XF}:c1=tri:c2=tri[ab]', f'[ab][c]acrossfade=d={XF}:c1=tri:c2=tri,volume=eval=frame:volume=\'{duck}\'[score]',
     f'[2:a]aformat=sample_rates=48000:channel_layouts=stereo,asetrate={48000 * 2 ** (2 / 12):.3f},aresample=48000,'
     f'afade=t=out:st=0.6:d=0.3,volume={CHIME_DB}dB,adelay={int(chime_at * 1000)}|{int(chime_at * 1000)}[k]',
     '[score][k]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[out]']
out = os.path.join(dst, 'score', 'score.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.islink(out): os.unlink(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', old, '-i', gen, '-i', os.path.join(root, 'assets/led/audio/target_reached.mp3'),
                '-filter_complex', ';'.join(f), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
os.remove(gen); os.rmdir(tmp)
print('wrote', out, '| slot', c_in, '-', c_out, '| chime', chime_at)
