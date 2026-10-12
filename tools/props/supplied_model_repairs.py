"""Small material/support repairs for the user-supplied ErgoFlex CAD collection.
Runs after Y-up orientation, fitting and transform baking (Blender Z is up).
"""
import bpy
import math
from mathutils import Matrix

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
    elif id=='ergoflex-keyboard-tray':
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
