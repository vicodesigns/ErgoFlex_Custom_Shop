"""Apply the requested playlist order and four-second Vision poster once."""
from pathlib import Path
import base64
import html
import json
import re
import shutil
from datetime import datetime

folder = Path(__file__).resolve().parent
path = folder / 'tech-week-divi-code-module.html'
s = path.read_text()
backup = folder / 'backups' / ('before-video-order-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
for name in ['tech-week-divi-code-module.html', 'ergoflex-editor.html', 'ergoflex-demos.html']:
    shutil.copy2(folder / name, backup / name)
match = re.search(r'const clips=(\[[\s\S]*?\]);const video=', s)
old = json.loads(match[1])
assert old[0]['title'] == 'Voice control & pre-collision sensing'
clips = [old[i] for i in [1,2,0,4,3]]
poster = 'data:image/jpeg;base64,' + base64.b64encode((folder / 'assets/vision-control-04s.jpg').read_bytes()).decode()
for i, clip in enumerate(clips):
    clip['muted'] = i == 0
clips[0]['poster'] = poster
s = s[:match.start(1)] + json.dumps(clips, ensure_ascii=False) + s[match.end(1):]
def esc(value):
    return html.escape(value, quote=True)
buttons = ''.join(f'<button class="ef-clip" type="button" data-clip="{i}" aria-pressed="{str(i == 0).lower()}"><img src="{esc(c["poster"])}" alt="" loading="lazy"><span class="ef-clip-copy"><small>{i+1:02d} / {esc(c["tag"])}</small><strong>{esc(c["title"])}</strong></span></button>' for i,c in enumerate(clips))
s,n = re.subn(r'(<div class="ef-playlist"[^>]*>).*?(</div></div><noscript>)', lambda m:m[1]+buttons+m[2], s, count=1, flags=re.S)
assert n == 1
s = re.sub(r'(<noscript>.*?<ul>).*?(</ul></noscript>)',lambda m:m[1]+''.join(f'<li><a href="{esc(c["src"])}" target="_blank" rel="noopener">{esc(c["title"])}</a></li>' for c in clips)+m[2],s,count=1,flags=re.S)
s = re.sub(r'<video id="ef-tech-player"[^>]*>',f'<video id="ef-tech-player" controls muted playsinline preload="none" poster="{poster}" aria-label="Vision control">',s,count=1)
s = re.sub(r'(<h3 id="ef-tech-title">).*?(</h3>)',lambda m:m[1]+esc(clips[0]['title'])+m[2],s,count=1)
s = re.sub(r'(<p id="ef-tech-description">).*?(</p>)',lambda m:m[1]+esc(clips[0]['description'])+m[2],s,count=1)
s = re.sub(r'(<a id="ef-tech-direct" href=")[^"]*',lambda m:m[1]+esc(clips[0]['src']),s,count=1)
s = s.replace('aria-label="Play Voice control &amp; pre-collision sensing"','aria-label="Play Vision control"')
s = s.replace('let current=0;', 'let current=0;video.muted=Boolean(clips[0].muted);')
s = s.replace('function start(){', 'function start(){video.muted=Boolean(clips[current].muted);')
s = s.replace('current=Number(button.dataset.clip);video.pause();', 'current=Number(button.dataset.clip);video.pause();video.muted=Boolean(clips[current].muted);')
s = s.replace('Start with voice control to see the desk respond. Then explore vision, lighting, and recorded movement.', 'Start with Vision control to see the desk respond. Then explore light and sound, voice control, recorded routines, and the LED inlay.')
path.write_text(s)
print('Updated playlist, initial player, mute behavior, and embedded Vision poster.')
