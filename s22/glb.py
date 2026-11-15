"""Minimal read-only GLB reader: node world matrices and per-mesh POSITION bounds (numpy)."""
import json, struct, numpy as np
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def load(path):
    b = open(path, 'rb').read(); assert b[:4] == b'glTF'
    off = 12; js = None; binc = None
    while off < len(b):
        ln, ty = struct.unpack('<II', b[off:off+8]); chunk = b[off+8:off+8+ln]; off += 8 + ln
        if ty == 0x4E4F534A: js = json.loads(chunk)
        else: binc = chunk
    return js, binc
def accessor(js, binc, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    dt = CT[a['componentType']]; n = NC[a['type']]; start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride'); size = np.dtype(dt).itemsize * n
    if stride and stride != size:
        raw = np.frombuffer(binc, np.uint8, count=stride*a['count'], offset=start).reshape(a['count'], stride)[:, :size]
        return np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n)
    return np.frombuffer(binc, dt, count=a['count']*n, offset=start).reshape(a['count'], n)
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
def local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); R = qmat(n.get('rotation', [0, 0, 0, 1])); S = np.diag(n.get('scale', [1, 1, 1]))
    M[:3, :3] = R @ S; M[:3, 3] = n.get('translation', [0, 0, 0]); return M
def nodes(path):
    """Yield (name, world matrix, world-space vertices) for every mesh node."""
    js, binc = load(path); out = []
    def walk(i, P):
        n = js['nodes'][i]; W = P @ local(n)
        if 'mesh' in n:
            vs = []
            for pr in js['meshes'][n['mesh']]['primitives']:
                v = accessor(js, binc, pr['attributes']['POSITION']).astype(float)
                vs.append(v)
            v = np.vstack(vs); vw = (W[:3, :3] @ v.T).T + W[:3, 3]
            out.append((n.get('name', ''), W, vw, js['meshes'][n['mesh']].get('name', '')))
        for c in n.get('children', []): walk(c, W)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return out
