import json,sys,re
rows=[json.loads(l) for l in open(sys.argv[1])]
mode=sys.argv[2] if len(sys.argv)>2 else 'summary'
def size(b): return [round((b[3+i]-b[i])*1000) for i in range(3)] if b else None
if mode=='parts':
    r=rows[int(sys.argv[3])]; print('t',r['t'])
    for o in r['objects']:
        if 'ergoflex-phone' in (o.get('path') or '') or 'ergoflex-phone' in o['name']:
            print(o['name'].ljust(40),'shown' if o['shown'] else 'HIDDEN',o['pos'],'box',o['box'],'size mm',size(o['box']),(o.get('path') or '')[-60:])
else:
    for r in rows:
        line=[f"t={r['t']:5.2f}"]
        for o in r['objects']:
            p=o.get('path') or ''
            if o['name'] in ('hand_r','held_hand_r') and 'mia-power-phone' in p: line.append(f"{o['name']}={o['pos']}")
            if o['name']=='base001_1' and 'mia-power-phone' in p: line.append(f"heldphone {'on' if o['shown'] else 'off'} box={o['box']}")
            if o['name']=='Prop:ergoflex-phone': line.append(f"charger {'on' if o['shown'] else 'off'} {o['pos']}")
            if o['name']=='Added prop:ergoflex-phone#mph01': line.append(f"added {'on' if o['shown'] else 'off'} {o['pos']} q{o['quat']}")
        print('  '.join(line))
