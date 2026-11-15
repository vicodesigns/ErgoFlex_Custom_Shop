import sys; sys.path.insert(0, r'C:\work\cine-pics\s22')
from screen_audit import *
def ev(c, py):
    c = dict(c); c['disp'] = dict(c['disp'], y=py); r = case(c)
    return f"{c['who']}/{c['pid'].split('-',2)[2]} py={py}: top-eye={round(r['sc']['top']-r['eye'])}mm centre {r['ang_c']:.1f} deg, top {r['ang_t']:.1f} deg, dist {round(r['dist'])}"
byname = {(c['ch'], c['who'], c['pid']): c for c in CASES}
yara_up = dict(byname[('commons', 'Yara', 'people-yara-stand-mid')], pid='people-yara-stand-type')
ava_up = dict(byname[('coast', 'Ava', 'people-ava-stand-mid')], pid='people-ava-stand-type')
sets = {
 'commons': [byname[('commons', 'Yara', 'people-yara-stand-mid')], yara_up, byname[('commons', 'Mia (power chair)', 'people-mia-power-type-30')]],
 'coast': [byname[('coast', 'Ava', 'people-ava-sit-type')], byname[('coast', 'Ava', 'people-ava-stand-mid')], ava_up],
 'oilers': [byname[('oilers', 'Kai (wheelchair)', 'people-kai-wheel-type-31')]],
}
for ch, cs in sets.items():
    for py in {'commons': (-80, -130, -150, -170), 'coast': (-80, -150, -190, -201), 'oilers': (-80, -150, -201)}[ch]:
        for c in cs: print(ch, ev(c, py))
    print()
for c in CASES:
    if c['who'].startswith('Zoe'):
        for py in (-166.3, -250, -318): print('oilers', ev(c, py))
    if c['who'].startswith('Lin') or c['who'].startswith('Mia (window'):
        for py in (c['disp']['y'], -150, -201): print(c['ch'], ev(c, py))
