"""Per character: the eye centre (MakeHuman 'low-poly' eye proxy) and crown in the head bone's frame, from the decoded posture GLB."""
import sys, json, numpy as np, os, subprocess
sys.path.insert(0, r'C:\work\cine-pics\s22')
from glb import load, accessor
DEC = r'C:\work\cine-pics\s22\dec'
def decoded(posture):
    out = os.path.join(DEC, posture + '.glb')
    if not os.path.exists(out):
        subprocess.run(['node', r'C:\work\cine-pics\s22\decode.mjs', rf'C:/work/ergoflex-cine-s22/assets/props/{posture}.glb', out], check=True)
    return out
def head_local(posture):
    js, binc = load(decoded(posture))
    sk = js['skins'][0]; ibm = accessor(js, binc, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    names = [js['nodes'][j]['name'] for j in sk['joints']]; H = ibm[names.index('head')]
    res = {}
    for pr in js['meshes'][0]['primitives']:
        mat = js['materials'][pr['material']]['name']
        a = js['accessors'][pr['attributes']['POSITION']]
        v = accessor(js, binc, pr['attributes']['POSITION']).astype(float)
        if a.get('normalized'): v = v / 32767.0
        vh = (H[:3, :3] @ v.T).T + H[:3, 3]
        res[mat] = vh
    eye = res.get('Human.low-poly'); 
    body = np.vstack([vv for k, vv in res.items()])
    return {'eye': eye.mean(0) if eye is not None else None, 'eye_n': 0 if eye is None else len(eye),
            'crown': body[np.argmax(body[:, 1])], 'mats': list(res.keys())}
if __name__ == '__main__':
    for p in sys.argv[1:]:
        r = head_local(p); print(p, 'eye(head-local)', None if r['eye'] is None else r['eye'].round(4), r['eye_n'], 'crown', r['crown'].round(4), r['mats'])
