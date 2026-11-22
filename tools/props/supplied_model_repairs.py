"""Small material/support repairs for the user-supplied ErgoFlex CAD collection.
Runs after Y-up orientation, fitting and transform baking (Blender Z is up).
"""
import bpy
import math
from mathutils import Matrix, Vector

def mat(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    return m

def improve(id):
    if id in ('ergoflex-art-easel','ergoflex-easel-accessory','ergoflex-painter-shelf'):
        improve_artist(id)
    elif id in ('ergoflex-mechanical-keyboard','ergoflex-desktop-pc','ergoflex-mouse-2'):
        # CAD's pure-black factors erase the form under any room lighting.
        # Preserve each material assignment and expose the original detail.
        for m in bpy.data.materials:
            if not m.use_nodes:continue
            p=m.node_tree.nodes.get('Principled BSDF')
            if p and max(p.inputs['Base Color'].default_value[:3])<.005:
                p.inputs['Base Color'].default_value=(.032,.04,.048,1)
                p.inputs['Roughness'].default_value=.48
    elif id=='ergoflex-game-table':
        # The CAD shell has an open upper rim. Close that rim with a fitted
        # working top, retaining the original cabinet and its footprint.
        vertices=[o.matrix_world @ v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
        height=max(v.z for v in vertices)
        points=sorted(set((round(v.x,5),round(v.y,5)) for v in vertices if v.z>height-.005))
        def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        lower=[];upper=[]
        for v in points:
            while len(lower)>1 and cross(lower[-2],lower[-1],v)<=0:lower.pop()
            lower.append(v)
        for v in reversed(points):
            while len(upper)>1 and cross(upper[-2],upper[-1],v)<=0:upper.pop()
            upper.append(v)
        hull=lower[:-1]+upper[:-1];n=len(hull)
        if n>=3:
            data=bpy.data.meshes.new('Fitted gaming table top')
            data.from_pydata([(x,y,z) for z in [height-.03,height] for x,y in hull],[],
                [tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
            data.update();o=bpy.data.objects.new('Fitted gaming table top',data);bpy.context.collection.objects.link(o)
            o.data.materials.append(mat('Gaming table warm graphite top',(.09,.07,.045),.55,.05))
    elif id in ('ergoflex-small-bookshelf','ergoflex-tall-bookshelf'):
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
    elif id in ('ergoflex-keyboard-tray','ergoflex-keyboard-tray-rig'):
        # Turn right after fitting, preserving the CAD dimensions and
        # the ceiling anchor. Blender Z becomes glTF Y on export.
        turn=Matrix.Rotation(math.radians(80),4,'Z')
        for o in bpy.context.scene.objects:
            if o.parent is None:o.matrix_world=turn @ o.matrix_world
        bpy.context.view_layer.update()
    elif id=='ergoflex-dual-monitor-arm':
        for m in bpy.data.materials:
            if not m.use_nodes:continue
            p=m.node_tree.nodes.get('Principled BSDF')
            if p:
                p.inputs['Base Color'].default_value=(.16,.18,.20,1)
                p.inputs['Roughness'].default_value=.32;p.inputs['Metallic'].default_value=.65

# Artist accessory material roles survive conversion for finish matching.
def improve_artist(id):
    from mathutils import Vector
    aluminium=mat('Artist brushed aluminium',(.58,.62,.66),.34,.92)
    beige=mat('Artist beige plastic lip',(.69,.59,.43),.58)
    if id=='ergoflex-art-easel':
        for o in mesh_objects_artist():
            if o.name in ('Mesh_0','Mesh_5'):continue # backing and art remain intact
            o.data.materials.clear();o.data.materials.append(beige if o.name=='Mesh_1' else aluminium)
    elif id=='ergoflex-easel-accessory':
        for o in mesh_objects_artist():
            o.data.materials.clear();o.data.materials.append(beige if o.name=='Mesh_7' else aluminium)
    elif id=='ergoflex-painter-shelf':
        acrylic=mat('Artist clear acrylic',(.94,.97,1),.09)
        p=acrylic.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.94;p.inputs['IOR'].default_value=1.49
        wood=mat('Artist shelf wood',(.52,.34,.16),.53)
        for o in list(mesh_objects_artist()):
            if o.name=='Mesh_0':
                o.name='Artist clear acrylic holders';o.data.materials.clear();o.data.materials.append(acrylic)
            elif o.name=='Mesh_11':
                o.name='Artist shelf surface';o.data.materials.clear();o.data.materials.append(wood)
                uv=o.data.uv_layers.new(name='Shelf grain')
                for face in o.data.polygons:
                    # Horizontal grain projection, with real metre-based repeats.
                    for loop in face.loop_indices:
                        v=o.data.vertices[o.data.loops[loop].vertex_index].co
                        uv.data[loop].uv=(v.x/.5,-v.y/.5)
            else:bpy.data.objects.remove(o,do_unlink=True)
        handles=[mat('Brush walnut handle',(.17,.065,.024),.32),mat('Brush ochre handle',(.43,.23,.07),.38),mat('Brush sage handle',(.11,.23,.19),.4)]
        ferrule=mat('Brush nickel ferrule',(.61,.66,.69),.22,.95)
        bristle=mat('Brush natural bristles',(.25,.13,.055),.82)
        dark=mat('Brush dark bristles',(.055,.035,.023),.9)
        def point(v):return Vector((v[0]/1000,-v[2]/1000,v[1]/1000))
        def taper(name,a,b,r1,r2,m,vertices=16):
            a,b=point(a),point(b);d=b-a
            bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1/1000,radius2=r2/1000,depth=d.length,location=(a+b)/2)
            o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');o.data.materials.append(m)
            for f in o.data.polygons:f.use_smooth=True
        brushes=[([78,80,0],[78,210,34],[78,232,40],[78,280,52],5.2,handles[0],dark),
                 ([94,70,75],[94,185,121],[94,198,127],[94,220,136],2.8,handles[1],bristle),
                 ([75,115,-85],[68,230,0],[67,245,11],[65,273,30],3.8,handles[2],bristle)]
        for i,(base,neck,head,tip,r,hairHandle,hair) in enumerate(brushes):
            taper('Brush %d lacquered handle'%i,base,neck,r*.55,r,hairHandle)
            taper('Brush %d ferrule'%i,neck,head,r*1.12,r*1.08,ferrule)
            taper('Brush %d bristle body'%i,head,tip,r*1.05,.3,hair,24)
            # Fine strands extend the silhouette and catch light independently.
            for j in range(14):
                a=2*math.pi*j/14;dx=math.cos(a)*r*.82;dz=math.sin(a)*r*.82
                start=[head[0]+dx,head[1],head[2]+dz]
                end=[tip[0]+dx*.12,tip[1]-(j%4)*.7,tip[2]+dz*.12]
                taper('Brush %d strand %d'%(i,j),start,end,.24,.055,hair,5)

def mesh_objects_artist():
    return [o for o in bpy.context.scene.objects if o.type=='MESH']


# ---- Keyboard tray rig (docs/keyboard-tray/SPEC.md sections 2 and 3) -----------------------------------------------
# The CAD arrives as 7 meshes. They are not welded together here: each is a whole part of the mechanism, and the hinged
# groups are built by PARENTING them under named pivot empties, so the rest pose is the glb exactly as the rigid asset has it.
# Everything below is in the glTF frame (Y up, +z toward the user), millimetres, after the fit, the ceiling anchor and the
# 80 degree turn of improve(): the frame of assets/props/ergoflex-keyboard-tray.glb.
#
# Skew: the whole CAD is turned about the vertical by 7.43 degrees against glTF x/z (measured on the pin, rod and link axes,
# 7.31 .. 7.44; the track's long axis is 7.4 off z). The hinge axes follow it, so the pivot nodes carry it: Tray_Slide is
# turned 7.43 about the vertical, everything below it keeps an identity rotation of its own. Do not "straighten" the model:
# the saved placements in preset-defaults.mjs undo the same skew with their own yaw.
TRAY_SKEW_DEG = 7.43
# Source meshes found by their bounds (min, max), tolerance 1 mm: a changed source stops the build instead of mis-assigning.
TRAY_PARTS = [
    ('Tray_Track',    (-67.4, -8.6, -343.2), (85.4, 0.0, 47.4)),       # fixed track under the desk
    ('Tray_Carriage', (-68.3, -52.2, -110.4), (56.4, 0.0, 42.7)),     # carriage, guide rails, the pins on it
    ('Tray_Links',    (-67.9, -84.3, -7.6), (27.9, -15.8, 145.2)),     # the two sloped links and their bracket
    ('Tray_Forks',    (-97.5, -80.7, 99.1), (35.0, -27.0, 222.7)),     # both forks, the pin and the spacer between
    ('Tray_Plate',    (-284.3, -28.1, 68.9), (209.6, -19.7, 354.8)),   # the 494 x 286 plate (the riders' frame)
    ('Tray_Crossbar', (-68.7, -96.7, 84.0), (105.2, -65.8, 126.4)),   # cross-bar, rod and the lock knob
    ('Tray_Screw',    (49.9, -88.4, 98.8), (53.4, -73.0, 114.4)),      # the small pin at the rod's end (its own material in the CAD)
]
# Pivot nodes: (name, parent, position in the glb frame, mm). Positions follow the track's centre line, which is the line
# through the track centre (9.0, 0, -147.9) along the skewed track axis: the carriage centre sits on it at z -33.8, its front
# at z 29.7 (the AABB's 36.1 is the front corner of a skewed box). tilt is on the rod axis, mid-rod. Rest pose: every node's
# own translation / rotation about its joint is zero, so the world pose of every mesh is what the rigid glb has.
TRAY_PIVOTS = [
    ('Tray',       None,          (0.0, 0.0, 0.0), False),      # = today's prop root, identity
    ('Tray_Drop',  'Tray',        (9.0, 0.0, -147.9), False),   # the mount: the track's top centre; the whole tray moves down this node's -Y
    ('Tray_Slide', 'Tray_Drop',   (-5.9, -26.1, -33.8), True),  # carriage centre; moves along its own +Z (the track axis); carries the skew
    ('Tray_Swing', 'Tray_Slide',  (-14.2, -26.1, 29.7), True),  # vertical pivot at the carriage front (the track's end when out); local Y
    ('Tray_Tilt',  'Tray_Swing',  (-9.0, -80.7, 98.6), True),   # the rod under the plate's rear; local X (front edge up = turn about -X)
]
TRAY_BRACKET_AT = (9.0, 0.0, -147.9)     # the track's top centre, on the skewed centre line
TRAY_BRACKET_HALF = (22.0, 35.0)         # half width across the track, half length along it (mm)
TRAY_PARENT = {'Tray_Track': 'Tray_Drop', 'Tray_Carriage': 'Tray_Slide', 'Tray_Links': 'Tray_Swing', 'Tray_Forks': 'Tray_Tilt',
               'Tray_Plate': 'Tray_Tilt', 'Tray_Crossbar': 'Tray_Tilt', 'Tray_Screw': 'Tray_Tilt'}

def rig_keyboard_tray():
    """Names the seven CAD meshes, creates the pivot empties and parents everything, keeping every world transform."""
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(meshes) != len(TRAY_PARTS): raise ValueError('keyboard tray rig: expected %d meshes, found %d' % (len(TRAY_PARTS), len(meshes)))
    def box(o):
        pts = [o.matrix_world @ v.co for v in o.data.vertices]
        lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
        g = lambda v: (v[0] * 1000, v[2] * 1000, -v[1] * 1000)   # Blender (Z up, -y toward the user) -> glTF, mm
        a, b = g(lo), g(hi)
        return tuple(min(a[i], b[i]) for i in range(3)), tuple(max(a[i], b[i]) for i in range(3))
    found = {}
    for o in meshes:
        lo, hi = box(o)
        print('RIGDUMP', o.name, [round(c, 1) for c in lo], [round(c, 1) for c in hi], len(o.data.vertices), flush=True)
        for name, elo, ehi in TRAY_PARTS:
            if all(abs(lo[i] - elo[i]) < 1.0 and abs(hi[i] - ehi[i]) < 1.0 for i in range(3)):
                if name in found: raise ValueError('keyboard tray rig: two meshes match ' + name)
                found[name] = o
    missing = [n for n, _, _ in TRAY_PARTS if n not in found]
    if missing: raise ValueError('keyboard tray rig: the source changed, no mesh matches ' + ', '.join(missing) + ' (see RIGDUMP lines)')
    # One material for every part, as the rigid glb ends up with: finishes are applied by material role (workspace-3d.mjs).
    shared = found['Tray_Carriage'].data.materials[0]
    for name, o in found.items():
        o.name = name; o.data.name = name
        o.data.materials.clear(); o.data.materials.append(shared)
    phi = -math.radians(TRAY_SKEW_DEG)          # Blender Z turn that points local X at glTF (cos, 0, +sin) and local Z along the track
    pivots = {}
    for name, parent, pos, skewed in TRAY_PIVOTS:
        e = bpy.data.objects.new(name, None); e.empty_display_type = 'ARROWS'; e.empty_display_size = 0.02
        bpy.context.scene.collection.objects.link(e)
        e.location = Vector((pos[0] / 1000, -pos[2] / 1000, pos[1] / 1000))
        e.rotation_euler = (0, 0, phi if skewed else 0)
        bpy.context.view_layer.update()
        if parent:
            e.parent = pivots[parent]; e.matrix_parent_inverse = pivots[parent].matrix_world.inverted()
        pivots[name] = e
    for name, parent in TRAY_PARENT.items():
        o = found[name]; world = o.matrix_world.copy()
        o.parent = pivots[parent]; o.matrix_parent_inverse = pivots[parent].matrix_world.inverted()
        o.matrix_world = world
    # The mount bracket (the one part that is not CAD): a plain block that hangs from the desktop underside to the track, so a dropped
    # tray is not floating. Its pivot node Tray_Bracket sits on the Tray root (it does not move with Tray_Drop) with a vertical scale
    # of 0.001 (1 mm of its 1 m block, hidden inside the track at rest); the stage sets scale Y = drop / 1000 (tray-rig.mjs). The
    # mesh is a child so the quantisation scale of the mesh node is never touched.
    at = TRAY_BRACKET_AT
    holder = bpy.data.objects.new('Tray_Bracket', None); holder.empty_display_type = 'ARROWS'; holder.empty_display_size = 0.02
    bpy.context.scene.collection.objects.link(holder)
    holder.location = Vector((at[0] / 1000, -at[2] / 1000, at[1] / 1000)); holder.rotation_euler = (0, 0, phi); holder.scale = (1, 1, 0.001)
    bpy.context.view_layer.update(); holder.parent = pivots['Tray']; holder.matrix_parent_inverse = pivots['Tray'].matrix_world.inverted()
    hx, hz = TRAY_BRACKET_HALF[0] / 1000, TRAY_BRACKET_HALF[1] / 1000
    mesh = bpy.data.meshes.new('Tray_BracketMesh')
    mesh.from_pydata([(x * hx, y * hz, z) for z in (0.0, -1.0) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))], [],
                     [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    mesh.update(); mesh.materials.append(shared)
    block = bpy.data.objects.new('Tray_BracketMesh', mesh); bpy.context.scene.collection.objects.link(block)
    bpy.context.view_layer.update(); block.parent = holder; block.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    print('RIGDONE', {n: [round(c, 2) for c in ((e.matrix_world.translation.x * 1000), (e.matrix_world.translation.z * 1000), (-e.matrix_world.translation.y * 1000))] for n, e in pivots.items()}, flush=True)
