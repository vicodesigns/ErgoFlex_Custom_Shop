"""Small material/support repairs for the user-supplied ErgoFlex CAD collection.
Runs after Y-up orientation, fitting and transform baking (Blender Z is up).
"""
import bpy

def mat(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    return m

def improve(id):
    if id in ('ergoflex-small-bookshelf','ergoflex-tall-bookshelf'):
        wood=mat('Warm walnut cabinet',(.24,.115,.05),.5)
        colors=[(.06,.15,.12),(.13,.19,.24),(.32,.10,.08),(.49,.33,.14),(.32,.29,.24)]
        books=[mat('Book cloth '+str(i),c,.82) for i,c in enumerate(colors)]
        for o in list(bpy.context.scene.objects):
            if o.type!='MESH':continue
            # Split into connected islands so cabinetry and book spines keep
            # distinct materials; retain original geometry and shelf spacing.
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
        for i,o in enumerate(list(bpy.context.scene.objects)):
            if o.type!='MESH':continue
            xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices];zs=[v.co.z for v in o.data.vertices]
            w,d,h=max(xs)-min(xs),max(ys)-min(ys),max(zs)-min(zs)
            is_book=.012<w<.14 and .06<d<.4 and .08<h<.5
            o.data.materials.clear();o.data.materials.append(books[i%len(books)] if is_book else wood)
    elif id=='ergoflex-artist-stool':
        # The imported gas lift is extremely thin after CAD tessellation.
        # Reinforce the existing central support without changing seat height.
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.019,depth=.285,location=(0,0,.23))
        o=bpy.context.object;o.name='Reinforced stool gas lift';o.data.materials.append(mat('Gas lift graphite',(.025,.03,.032),.35,.55))
    elif id=='ergoflex-dual-monitor-arm':
        for m in bpy.data.materials:
            if not m.use_nodes:continue
            p=m.node_tree.nodes.get('Principled BSDF')
            if p:
                p.inputs['Base Color'].default_value=(.16,.18,.20,1)
                p.inputs['Roughness'].default_value=.32;p.inputs['Metallic'].default_value=.65
