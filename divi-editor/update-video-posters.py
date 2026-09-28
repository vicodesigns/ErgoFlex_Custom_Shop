"""Refresh selected video posters without changing page copy or playback settings."""
from pathlib import Path
from datetime import datetime
import base64
import json
import re
import shutil

folder = Path(__file__).resolve().parent
path = folder / 'tech-week-divi-code-module.html'
source = path.read_text()
match = re.search(r'const clips=(\[[\s\S]*?\]);const video=', source)
clips = json.loads(match[1])
backup = folder / 'backups' / ('before-posters-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
for name in ['tech-week-divi-code-module.html', 'ergoflex-editor.html', 'ergoflex-demos.html']:
    shutil.copy2(folder / name, backup / name)
for index, name in [(1,'light-sound-02s.jpg'),(2,'voice-control-02s.jpg'),(4,'led-inlay-59s.jpg')]:
    poster = 'data:image/jpeg;base64,' + base64.b64encode((folder / 'assets' / name).read_bytes()).decode()
    clips[index]['poster'] = poster
    pattern = rf'(<button class="ef-clip"[^>]*data-clip="{index}"[^>]*><img src=")[^"]*'
    source, count = re.subn(pattern, lambda m:m[1]+poster, source, count=1)
    assert count == 1
source = re.sub(r'const clips=(\[[\s\S]*?\]);const video=', lambda m:'const clips='+json.dumps(clips,ensure_ascii=False)+';const video=',source,count=1)
path.write_text(source)
print('Updated posters for videos 02, 03, and 05; backups preserved.')
