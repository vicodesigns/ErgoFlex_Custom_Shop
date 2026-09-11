"""Export the render meshes of a Rhino .3dm file as a Y-up OBJ (+ MTL) in millimetres.

Usage: python rhino-to-obj.py input.3dm output.obj
Needs: pip install rhino3dm
Rhino files are Z-up; the OBJ written here is Y-up (Rhino Y -> -Z, Rhino Z -> Y).
Breps and extrusions are exported through the render meshes Rhino cached in the
file; rhino3dm cannot mesh a surface itself, so a file saved without render
meshes exports nothing and is reported as such.
"""
import sys, os, rhino3dm

UNIT_TO_MM = {
    rhino3dm.UnitSystem.Millimeters: 1.0, rhino3dm.UnitSystem.Centimeters: 10.0,
    rhino3dm.UnitSystem.Meters: 1000.0, rhino3dm.UnitSystem.Inches: 25.4, rhino3dm.UnitSystem.Feet: 304.8,
}

def geometry_meshes(g):
    if isinstance(g, rhino3dm.Mesh): return [g]
    if isinstance(g, rhino3dm.Extrusion):
        m = g.GetMesh(rhino3dm.MeshType.Render); return [m] if m else []
    if isinstance(g, rhino3dm.Brep):
        out = []
        for i in range(len(g.Faces)):
            m = g.Faces[i].GetMesh(rhino3dm.MeshType.Render)
            if m: out.append(m)
        return out
    return []

def material_for(model, obj):
    a = obj.Attributes
    src = a.MaterialSource
    idx = a.MaterialIndex
    if src == rhino3dm.ObjectMaterialSource.MaterialFromLayer and 0 <= a.LayerIndex < len(model.Layers):
        idx = model.Layers[a.LayerIndex].RenderMaterialIndex
    if 0 <= idx < len(model.Materials):
        m = model.Materials[idx]
        c = m.DiffuseColor
        return (m.Name or f'mat{idx}').replace(' ', '_'), (c[0]/255, c[1]/255, c[2]/255), 1 - m.Transparency
    if 0 <= a.LayerIndex < len(model.Layers):
        c = model.Layers[a.LayerIndex].Color
        return f'layer_{a.LayerIndex}', (c[0]/255, c[1]/255, c[2]/255), 1.0
    return 'default', (0.8, 0.8, 0.8), 1.0

def main(src, dst):
    model = rhino3dm.File3dm.Read(src)
    scale = UNIT_TO_MM.get(model.Settings.ModelUnitSystem, 1.0)
    blocks = {d.Id: d for d in model.InstanceDefinitions}
    mats, lines, v_off, vn_off, vt_off = {}, [], 0, 0, 0
    def emit(mesh, xf, mat_name):
        nonlocal v_off, vn_off, vt_off
        if xf is not None: mesh = mesh.Duplicate(); mesh.Transform(xf)
        vs, ns, ts = mesh.Vertices, mesh.Normals, mesh.TextureCoordinates
        for i in range(len(vs)):
            p = vs[i]; lines.append(f'v {p.X*scale:.4f} {p.Z*scale:.4f} {-p.Y*scale:.4f}')
        has_n = len(ns) == len(vs); has_t = len(ts) == len(vs)
        for i in range(len(ns) if has_n else 0):
            n = ns[i]; lines.append(f'vn {n.X:.5f} {n.Z:.5f} {-n.Y:.5f}')
        for i in range(len(ts) if has_t else 0):
            t = ts[i]; lines.append(f'vt {t.X:.5f} {t.Y:.5f}')
        lines.append(f'usemtl {mat_name}')
        def ref(i):
            v = i + 1 + v_off
            return f'{v}/{i+1+vt_off if has_t else ""}/{i+1+vn_off if has_n else ""}'.rstrip('/').replace('//', '//') if (has_n or has_t) else str(v)
        for fi in range(mesh.Faces.Count):
            f = mesh.Faces[fi]
            idx = [f[0], f[1], f[2]] + ([f[3]] if f[3] != f[2] else [])
            lines.append('f ' + ' '.join(ref(i) for i in idx))
        v_off += len(vs); vn_off += len(ns) if has_n else 0; vt_off += len(ts) if has_t else 0
    def walk(obj, xf):
        g = obj.Geometry
        if isinstance(g, rhino3dm.InstanceReference):
            d = blocks.get(g.ParentIdefId)
            if not d: return
            child_xf = g.Xform if xf is None else rhino3dm.Transform.Multiply(xf, g.Xform)
            for oid in d.GetObjectIds():
                child = model.Objects.FindId(oid)
                if child: walk(child, child_xf)
            return
        name, rgb, alpha = material_for(model, obj)
        mats[name] = (rgb, alpha)
        for m in geometry_meshes(g): emit(m, xf, name)
    for obj in model.Objects:
        if obj.Attributes.IsInstanceDefinitionObject: continue
        walk(obj, None)
    mtl = os.path.splitext(dst)[0] + '.mtl'
    with open(mtl, 'w') as f:
        for name, (rgb, alpha) in mats.items():
            f.write(f'newmtl {name}\nKd {rgb[0]:.4f} {rgb[1]:.4f} {rgb[2]:.4f}\nd {alpha:.3f}\nNs 40\n\n')
    with open(dst, 'w') as f:
        f.write(f'mtllib {os.path.basename(mtl)}\no {os.path.splitext(os.path.basename(src))[0]}\n' + '\n'.join(lines) + '\n')
    print(f'{os.path.basename(src)}: {v_off} vertices, {len(mats)} materials, units x{scale} -> mm')
    if v_off == 0: sys.exit(f'{src}: no render meshes found; open in Rhino, render once, and re-save')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
