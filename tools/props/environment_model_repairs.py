"""PBR finishing for the October decoration collection after metric fitting.
No changes to user source files. Blender Z is vertical at this stage.
"""
import bpy
from mathutils import Vector, Matrix
from supplied_model_repairs import mat

def bounds(o):
    pts=[o.matrix_world @ v.co for v in o.data.vertices]
    lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)))
    hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
    return lo,hi,hi-lo

def improve(id):
    key=id.removeprefix('ergoflex-')
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    ivory=mat('Warm ivory polymer',(.69,.72,.69),.48)
    graphite=mat('Graphite polymer',(.035,.043,.05),.5)
    steel=mat('Brushed silver metal',(.55,.60,.65),.3,.9)
    wood=mat('Warm oak finish',(.36,.21,.105),.57)
    paper=mat('Natural paper',(.84,.81,.72),.94)
    fabric=mat('Woven sage upholstery',(.17,.25,.22),.94)
    leather=mat('Cognac leather',(.23,.10,.046),.66)
    foliage=[mat('Leaf green '+str(i),c,.86)for i,c in enumerate([(.065,.19,.074),(.085,.24,.09),(.10,.27,.105)])]
    ceramic=mat('Terracotta planter',(.40,.20,.12),.8)
    glass=mat('Clear optical glass',(.85,.93,.96),.12)
    p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.92;p.inputs['IOR'].default_value=1.48
    glass.diffuse_color=(.85,.93,.96,.2);p.inputs['Alpha'].default_value=.2
    # Preserve deliberately assigned source materials, improving named finishes.
    for m in list(bpy.data.materials):
        if not m.use_nodes:continue
        p=m.node_tree.nodes.get('Principled BSDF')
        if not p:continue
        name=m.name.lower()
        if 'metal' in name or 'nickel' in name or 'aluminum' in name:
            p.inputs['Metallic'].default_value=.9;p.inputs['Roughness'].default_value=.29
        elif 'fabric' in name or 'leather' in name:
            p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.86
        elif max(p.inputs['Base Color'].default_value[:3])<.005:
            p.inputs['Base Color'].default_value=(.025,.032,.04,1);p.inputs['Roughness'].default_value=.52
    total=max(bounds(o)[1].z for o in objs)
    for index,o in enumerate(objs):
        lo,hi,size=bounds(o);chosen=None
        if key in ('large-shelf','small-shelf','furnishing-console'):chosen=wood
        elif key.startswith('plant-'):
            o.data.materials.clear()
            for m in [ceramic,wood,*foliage]:o.data.materials.append(m)
            for poly in o.data.polygons:
                c=o.matrix_world @ poly.center
                poly.material_index=0 if c.z<total*.24 else 1 if abs(c.x)<.012 and abs(c.y)<.012 else 2+index%3
            o.name='Planter and foliage '+str(index);continue
        elif key=='pencil-cup':
            o.data.materials.clear()
            for m in [graphite,wood,paper]:o.data.materials.append(m)
            for poly in o.data.polygons:
                z=(o.matrix_world @ poly.center).z
                poly.material_index=0 if z<total*.42 or z>total*.97 else 2 if z>total*.91 else 1
            continue
        elif key=='paper-tray':chosen=graphite
        elif key=='printer':chosen=ivory
        elif key=='thermal-cup':chosen=steel if index==0 else graphite
        elif key in ('picture-frame','picture-frame-1','picture-frame-2'):chosen=paper if min(size)<.005 else wood
        elif key=='couch':chosen=fabric if 'fabric' in ' '.join(m.name.lower()for m in o.data.materials if m) or size.z>.15 else graphite
        elif key=='cup-holder':chosen=graphite
        elif key=='cat':chosen=mat('Ivory ceramic figurine',(.71,.68,.59),.32)
        elif key=='trash-can':chosen=mat('Satin brushed bin',(.22,.27,.28),.4,.72)
        elif key=='violin':chosen=mat('Violin amber varnish',(.34,.10,.025),.3) if size.x>.25 and size.y>.10 else graphite
        elif key=='balloon-dog':chosen=mat('Balloon dog polished copper',(.72,.27,.09),.16,.95)
        elif key=='earbuds':chosen=ivory
        elif key=='purse':chosen=steel if 'metal' in ' '.join(m.name.lower()for m in o.data.materials if m) else leather
        elif key=='camera':chosen=graphite if index<4 else steel
        elif key=='standing-mirror':chosen=mat('Mirror silver',(.83,.85,.87),.05,1) if size.z>total*.75 and size.y<.035 else steel
        elif key=='laptop':chosen=steel if size.z<total*.25 else graphite
        elif key=='glasses':chosen=glass if size.y<.035 and size.x>.07 else steel
        if chosen:
            o.data.materials.clear();o.data.materials.append(chosen)
        # Named mesh roles keep the repair reviewable after compression.
        o.name='Supplied '+key+' part '+str(index)
    if key=='laptop':
        # The supplied display is mounted obliquely across the deck. Give the
        # laptop a thin hinged panel and keyboard, fitted to its existing base.
        decks=[o for o in objs if bounds(o)[2].z<.04]
        deck=max(decks,key=lambda o:bounds(o)[2].x)
        lo,hi,size=bounds(deck);w=size.x;depth=size.y;top=hi.z
        for o in objs:
            if o not in decks:bpy.data.objects.remove(o,do_unlink=True)
        def cube(name,dims,at,m):
            bpy.ops.mesh.primitive_cube_add(size=1,location=at)
            o=bpy.context.object;o.name=name;o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
        height=w*.62;rear=hi.y-.012
        cube('Laptop thin display housing',(w*.97,.008,height),(0,rear,top+height/2),graphite)
        display=mat('Decor screen glass',(.008,.012,.018),.38)
        # X/Z plane, front normal -Y -> +Z in the exported Y-up scene.
        verts=[(-w*.45,rear-.0048,top+height*.06),(w*.45,rear-.0048,top+height*.06),(w*.45,rear-.0048,top+height*.94),(-w*.45,rear-.0048,top+height*.94)]
        data=bpy.data.meshes.new('Laptop active screen');data.from_pydata(verts,[],[(0,1,2,3)]);data.update();uv=data.uv_layers.new(name='UVMap')
        for loop,coord in zip(data.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord
        o=bpy.data.objects.new('Decoration display glass',data);bpy.context.collection.objects.link(o);data.materials.append(display)
        for row in range(5):
            for col in range(12):cube('Laptop keyboard key',(w*.055,.012,.0018),(-w*.36+col*w*.064,rear-.04-row*.017,top+.001),graphite)
        cube('Laptop touchpad',(w*.28,depth*.19,.0006),(0,lo.y+depth*.24,top+.0005),steel)
    elif key=='calendar':
        # Printed numbers follow the inclined face of the supplied stand.
        # The generic month planner remains useful across all scene activities.
        u=Vector((0,1,0));v=Vector((-.359,0,.934));n=u.cross(v).normalized()
        origin=Vector((.0448,-.067,.024))
        vertices=[origin,origin+u*.134,origin+u*.134+v*.0835,origin+v*.0835]
        data=bpy.data.meshes.new('Calendar printed face');data.from_pydata(vertices,[],[(0,1,2,3)]);data.update()
        o=bpy.data.objects.new('Calendar natural paper face',data);bpy.context.collection.objects.link(o);data.materials.append(paper)
        basis=Matrix((u,v,n)).transposed().to_4x4()
        def text(label,x,y,size):
            curve=bpy.data.curves.new('Calendar print','FONT');curve.body=label;curve.size=size;curve.resolution_u=3
            obj=bpy.data.objects.new('Calendar '+label,curve);bpy.context.collection.objects.link(obj)
            obj.matrix_world=basis.copy();obj.location=origin+u*x+v*y+n*.0004;curve.materials.append(graphite)
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
        text('MONTH PLAN',.034,.073,.0055)
        for i,label in enumerate(['M','T','W','T','F','S','S']):text(label,.01+i*.018,.062,.004)
        for i in range(31):text(str(i+1),.01+i%7*.018,.050-(i//7)*.010,.004)
