"""Posing helpers for the MPFB "game_engine" rig (Blender 4.2).

A pose is described in the character's own frame, in metres: Z up, the
character faces -Y, its left side is +X, the floor is Z = 0. Hands and feet
are pulled to targets with IK, the result is baked onto the bones (so the
pose survives export), then hands, feet, fingers, spine and head are set.

    pose = {
      'pelvis': (x, y, z),            # pelvis bone head
      'pelvis_pitch': deg,            # forward tilt (+ leans forward)
      'pelvis_yaw': deg, 'pelvis_roll': deg,
      'hip_z': z,                     # optional: then the pelvis is moved up or down so the hip joints are at this height
      'spine': (deg, deg, deg),       # forward bend of spine_01..03 (+ forward)
      'spine_twist': deg, 'spine_side': deg,
      'neck': deg, 'head': deg,       # forward nod (+ looks down)
      'head_yaw': deg, 'head_roll': deg,
      'hand_l': {'at': (x,y,z), 'fingers': (dx,dy,dz), 'palm': (dx,dy,dz), 'elbow': (dx,dy,dz), 'curl': 0..1, 'thumb': 0..1, 'spread': 0..1},
      'hand_r': {...},                # 'at' is the wrist. 'shoulder': (forward, down) degrees of the collarbone (optional). Without 'at' the arm is posed by 'arm': (pitch, out, twist, elbow bend)
      'foot_l': {'at': (x,y,z), 'toes': (dx,dy,dz), 'knee': (dx,dy,dz), 'pitch': deg},
      'foot_r': {...},                # 'at' is the ankle; rest ankle height is ~0.07
    }
"""
import math
import bpy
from mathutils import Matrix, Vector, Quaternion

FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')


def _update():
    bpy.context.view_layer.update()


def bone_world(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].matrix


def set_bone_world(rig, name, world):
    rig.pose.bones[name].matrix = rig.matrix_world.inverted() @ world
    _update()


def rotate_world(rig, name, axis, degrees, pivot=None):
    """Rotate a bone about a world-space axis through its head (or pivot)."""
    if abs(degrees) < 1e-6:
        return
    world = bone_world(rig, name)
    p = Vector(pivot) if pivot is not None else world.translation.copy()
    r = Matrix.Translation(p) @ Matrix.Rotation(math.radians(degrees), 4, Vector(axis).normalized()) @ Matrix.Translation(-p)
    set_bone_world(rig, name, r @ world)


def bone_dir(rig, name):
    """World direction the bone points along (its local Y)."""
    return (bone_world(rig, name).to_3x3() @ Vector((0, 1, 0))).normalized()


def palm_normal(rig, side):
    """World-space normal pointing out of the palm, from the knuckle layout."""
    along = bone_world(rig, 'middle_01_' + side).translation - bone_world(rig, 'hand_' + side).translation
    across = bone_world(rig, 'pinky_01_' + side).translation - bone_world(rig, 'index_01_' + side).translation
    n = across.cross(along) if side == 'l' else along.cross(across)
    return n.normalized()


def _frame(along, normal):
    a = Vector(along).normalized(); n = Vector(normal); n = (n - a * n.dot(a)).normalized(); s = a.cross(n).normalized()
    return Matrix((s, a, n)).transposed()   # columns: side, along, normal


def aim_hand(rig, side, fingers, palm):
    """Point the hand's fingers along `fingers` with the palm facing `palm`."""
    name = 'hand_' + side; world = bone_world(rig, name)
    along = bone_world(rig, 'middle_01_' + side).translation - world.translation
    r = _frame(fingers, palm) @ _frame(along, palm_normal(rig, side)).inverted()
    m = (r @ world.to_3x3()).to_4x4(); m.translation = world.translation
    set_bone_world(rig, name, m)


def curl_fingers(rig, side, curl=.35, thumb=.25, spread=0.):
    """Relaxed flexion: every joint bends toward the palm."""
    for f in FINGERS:
        amount = thumb if f == 'thumb' else curl
        for j, share in ((1, 38), (2, 46), (3, 30)):
            name = f'{f}_0{j}_{side}'
            if name not in rig.pose.bones:
                continue
            n = palm_normal(rig, side); d = bone_dir(rig, name)
            axis = d.cross(n)
            if axis.length < 1e-5:
                continue
            k = {'thumb': .6, 'index': .9, 'middle': 1., 'ring': 1.05, 'pinky': 1.1}[f]
            rotate_world(rig, name, axis, amount * share * k)
        if spread and f != 'thumb' and f != 'middle':
            n = palm_normal(rig, side); sign = {'index': -1, 'ring': 1, 'pinky': 2}[f] * (1 if side == 'l' else -1)
            rotate_world(rig, f'{f}_01_{side}', n, sign * spread * 7)


def _empty(name, at):
    e = bpy.data.objects.new(name, None); e.location = Vector(at); bpy.context.scene.collection.objects.link(e); return e


def _ik(rig, bone, target, pole_at, pole_angle=0.):
    c = rig.pose.bones[bone].constraints.new('IK'); c.target = _empty('ik_' + bone, target); c.chain_count = 2
    c.pole_target = _empty('pole_' + bone, pole_at); c.pole_angle = pole_angle; c.use_stretch = False
    return c


def _best_pole_angle(rig, bone, constraint, pole_at):
    """Pick the pole angle that puts the middle joint closest to the pole."""
    best = (1e9, 0.)
    for deg in range(-180, 180, 15):
        constraint.pole_angle = math.radians(deg); _update()
        joint = (rig.matrix_world @ rig.pose.bones[bone].matrix).translation
        d = (joint - Vector(pole_at)).length
        if d < best[0]:
            best = (d, constraint.pole_angle)
    constraint.pole_angle = best[1]; _update()


def _bake(rig, names):
    """Freeze constraint results onto the bones, parents first."""
    mats = {n: rig.pose.bones[n].matrix.copy() for n in names}
    for n in names:
        for c in list(rig.pose.bones[n].constraints):
            if c.type == 'IK':
                for o in (c.target, c.pole_target):
                    if o: bpy.data.objects.remove(o)
            rig.pose.bones[n].constraints.remove(c)
    for n in names:
        rig.pose.bones[n].matrix = mats[n]; _update()


def apply_pose(rig, pose):
    bpy.context.view_layer.objects.active = rig
    for b in rig.pose.bones:
        b.rotation_mode = 'QUATERNION'; b.location = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.scale = (1, 1, 1)
    # Short limbs (short stature): the long bones shrink along their length only; hands and feet keep their size.
    limbs = pose.get('limbs')
    if limbs:
        for side in ('l', 'r'):
            for name, child in (('thigh', 'calf'), ('calf', 'foot'), ('upperarm', 'lowerarm'), ('lowerarm', 'hand')):
                rig.data.bones[f'{child}_{side}'].inherit_scale = 'NONE'
                rig.pose.bones[f'{name}_{side}'].scale = (1, limbs[0] if name in ('thigh', 'calf') else limbs[1], 1)
    _update()
    X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)

    # Pelvis: position, then yaw / pitch / roll about its head.
    world = bone_world(rig, 'pelvis'); rest_head = world.translation.copy()
    at = Vector(pose.get('pelvis', rest_head)) + Vector(pose.get('pelvis_offset', (0, 0, 0)))
    set_bone_world(rig, 'pelvis', Matrix.Translation(at - rest_head) @ world)
    rotate_world(rig, 'pelvis', Z, pose.get('pelvis_yaw', 0))
    rotate_world(rig, 'pelvis', X, pose.get('pelvis_pitch', 0))   # a positive turn about X tips the top toward -Y (forward)
    rotate_world(rig, 'pelvis', Y, pose.get('pelvis_roll', 0))
    if 'hip_z' in pose:      # the hip joints at this height whoever sits (the pelvis bone's head is not as high above them in everyone)
        hz = (bone_world(rig, 'thigh_l').translation.z + bone_world(rig, 'thigh_r').translation.z) / 2
        set_bone_world(rig, 'pelvis', Matrix.Translation((0, 0, pose['hip_z'] - hz)) @ bone_world(rig, 'pelvis'))

    # Spine, neck and head (FK). Forward is -Y, so a forward bend is a positive rotation about X.
    yaw = Matrix.Rotation(math.radians(pose.get('pelvis_yaw', 0)), 3, 'Z')
    side_axis = yaw @ Vector(X); fwd_axis = yaw @ Vector(Y)
    bends = pose.get('spine', (0, 0, 0))
    for name, deg in zip(('spine_01', 'spine_02', 'spine_03'), bends):
        rotate_world(rig, name, side_axis, deg)
        rotate_world(rig, name, Z, pose.get('spine_twist', 0) / 3)
        rotate_world(rig, name, fwd_axis, pose.get('spine_side', 0) / 3)
    rotate_world(rig, 'neck_01', side_axis, pose.get('neck', 0))
    rotate_world(rig, 'neck_01', Z, pose.get('head_yaw', 0) * .4)
    rotate_world(rig, 'head', side_axis, pose.get('head', 0))
    rotate_world(rig, 'head', Z, pose.get('head_yaw', 0) * .6)
    rotate_world(rig, 'head', fwd_axis, pose.get('head_roll', 0))

    # Arms.
    for side in ('l', 'r'):
        spec = pose.get('hand_' + side) or {}
        s = 1 if side == 'l' else -1
        if 'shoulder' in spec:
            # the shoulder brought forward (+ degrees, reaching) and down (+ degrees) by the collarbone, before the arm reaches
            fwd, down = (tuple(spec['shoulder']) + (0,))[:2]
            up = bone_dir(rig, 'spine_03'); rotate_world(rig, 'clavicle_' + side, up, -s * fwd)
            rotate_world(rig, 'clavicle_' + side, up.cross(bone_dir(rig, 'clavicle_' + side)), down)
        if 'at' in spec:
            wrist = Vector(spec['at']); shoulder = bone_world(rig, 'upperarm_' + side).translation
            pole = (shoulder + wrist) / 2 + Vector(spec.get('elbow', (s * .25, .2, -.3)))
            c = _ik(rig, 'lowerarm_' + side, wrist, pole); _update()
            _best_pole_angle(rig, 'lowerarm_' + side, c, pole)
            _bake(rig, ['clavicle_' + side, 'upperarm_' + side, 'lowerarm_' + side])
        elif 'arm' in spec:
            pitch, out, twist, bend = spec['arm']
            rotate_world(rig, 'upperarm_' + side, side_axis, pitch)
            rotate_world(rig, 'upperarm_' + side, fwd_axis, s * out)
            rotate_world(rig, 'upperarm_' + side, bone_dir(rig, 'upperarm_' + side), s * twist)
            # The elbow folds the forearm toward the front of the upper arm.
            up = bone_dir(rig, 'upperarm_' + side); low = bone_dir(rig, 'lowerarm_' + side)
            axis = up.cross(low) if up.cross(low).length > 1e-3 else side_axis
            rotate_world(rig, 'lowerarm_' + side, axis, bend)
        if 'fingers' in spec:
            aim_hand(rig, side, spec['fingers'], spec.get('palm', (0, 0, -1)))
        curl_fingers(rig, side, spec.get('curl', .3), spec.get('thumb', .2), spec.get('spread', 0))

    # Legs.
    for side in ('l', 'r'):
        spec = pose.get('foot_' + side) or {}
        s = 1 if side == 'l' else -1
        if 'at' not in spec:
            continue
        foot_rest = bone_world(rig, 'foot_' + side).to_3x3()
        toes_rest = (bone_world(rig, 'ball_' + side).translation - bone_world(rig, 'foot_' + side).translation)
        ankle = Vector(spec['at']); hip = bone_world(rig, 'thigh_' + side).translation
        pole = (hip + ankle) / 2 + Vector(spec.get('knee', (s * .05, -.6, .25)))
        c = _ik(rig, 'calf_' + side, ankle, pole); _update()
        _best_pole_angle(rig, 'calf_' + side, c, pole)
        _bake(rig, ['thigh_' + side, 'calf_' + side])
        # Foot: keep the sole level, turn the toes to `toes`, then pitch.
        toes = Vector(spec.get('toes', (s * .12, -1, 0))); toes.z = 0; toes.normalize()
        flat = Vector((toes_rest.x, toes_rest.y, 0)).normalized()
        turn = flat.rotation_difference(toes).to_matrix()
        m = (turn @ foot_rest).to_4x4(); m.translation = bone_world(rig, 'foot_' + side).translation
        set_bone_world(rig, 'foot_' + side, m)
        rotate_world(rig, 'foot_' + side, toes.cross(Vector(Z)), spec.get('pitch', 0))
    _update()
