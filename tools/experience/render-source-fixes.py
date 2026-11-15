#!/usr/bin/env python3
"""Apply reviewed render fixes after pin-inputs restores unrelated live edits to HEAD."""
import hashlib
import pathlib
import re
import sys

freeze = pathlib.Path(sys.argv[1])
source = freeze / 'studio.js'
text = source.read_text()
old = 'applyGlideOffset(directorAnchor.offset.clone().add(new THREE.Vector3(p.z*directorAnchor.unit,0,-p.x*directorAnchor.unit)),{collide:true});'
new = '''// Authored Director poses must be independent of furniture and seek history.
            roomCollisionBlocked=false;
            applyGlideOffset(directorAnchor.offset.clone().add(new THREE.Vector3(p.z*directorAnchor.unit,0,-p.x*directorAnchor.unit)));'''
if text.count(old) == 1:
    text = text.replace(old, new)
elif text.count('applyGlideOffset(directorAnchor.offset.clone().add(new THREE.Vector3(p.z*directorAnchor.unit,0,-p.x*directorAnchor.unit)));') != 1:
    raise SystemExit('Director travel implementation changed; review frozen studio.js before queueing')

# The wheel rollers (a38c8c, 5e4343) are rubber (studio.js WHEEL_ROLLER_COLORS). This script used to write them into
# the aluminium list of every frozen studio.js (white mirror rollers in the film; Vico, Nov 14); it must not.
aluminium = re.search(r'const POLISHED_ALUMINUM_COLORS = \[([^\]]*)\];', text)
if aluminium and re.search(r'"(a38c8c|5e4343)"', aluminium.group(1)):
    raise SystemExit('frozen studio.js lists the wheel rollers (a38c8c / 5e4343) as polished aluminium; they are rubber')

old_finish = "const set=createSceneAccessorySet(r.rig.mounts,config,()=>r.group.children.find(obj=>obj.isMesh&&String(obj.material?.userData?.sceneDeskMaterial).startsWith('wood:'))?.material);"
new_finish = "const set=createSceneAccessorySet(r.rig.mounts,config,()=>(r.id===sceneDesks.selected&&woodMaterials.get('desktop'))||r.group.children.find(obj=>obj.isMesh&&String(obj.material?.userData?.sceneDeskMaterial).startsWith('wood:'))?.material);"
if old_finish in text:
    text = text.replace(old_finish, new_finish, 1)

source.write_text(text)
data = source.read_bytes()
manifest = freeze / 'manifest.txt'
lines = manifest.read_text().splitlines()
indices = [i for i, line in enumerate(lines) if len(line.split()) >= 3 and line.split()[2] == 'studio.js']
if len(indices) != 1:
    raise SystemExit('Expected exactly one studio.js manifest entry')
fields = lines[indices[0]].split()
fields[:2] = [hashlib.sha256(data).hexdigest(), str(len(data))]
lines[indices[0]] = ' '.join(fields)
manifest.write_text('\n'.join(lines) + '\n')
print('Render source fixes checked and applied to frozen studio.js (Director travel, scene accessory finish; wheel rollers not aluminium); manifest updated')
