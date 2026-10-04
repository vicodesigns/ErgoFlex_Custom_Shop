"""Check generated Apple tap assets with OpenUSD (not the Apple tap runtime).

Usage: python tools/validate-apple-ar.py /path/to/preview.usdz [...]
Requires usd-core, e.g. in a separate validation virtual environment.
"""
import math
from pathlib import Path
import struct
import sys
import zipfile

from pxr import Gf, Usd, UsdGeom

SCENE = '/Root/Scenes/Scene'


def check(path):
    with zipfile.ZipFile(path) as archive:
        assert archive.namelist()[0] == 'model.usda', 'Root layer must be first'
        with open(path, 'rb') as raw:
            for entry in archive.infolist():
                assert entry.compress_type == zipfile.ZIP_STORED, entry.filename
                raw.seek(entry.header_offset + 26)
                name_len, extra_len = struct.unpack('<HH', raw.read(4))
                assert (entry.header_offset + 30 + name_len + extra_len) % 64 == 0, entry.filename
        assert archive.testzip() is None

    stage = Usd.Stage.Open(str(path.resolve()))
    assert stage and stage.GetDefaultPrim(), 'Invalid USD stage'
    assert UsdGeom.GetStageMetersPerUnit(stage) == 1
    prims = list(stage.Traverse())
    for prim in prims:
        for relationship in prim.GetRelationships():
            for target in relationship.GetTargets():
                assert stage.GetObjectAtPath(target), f'Unresolved relationship: {prim.GetPath()} -> {target}'
        if prim.GetTypeName() == 'Mesh':
            assert len(UsdGeom.Mesh(prim).GetPointsAttr().Get()) > 0, prim.GetPath()
        if prim.GetAttribute('xformOp:transform'):
            matrix = prim.GetAttribute('xformOp:transform').Get()
            assert all(math.isfinite(matrix[r][c]) for r in range(4) for c in range(4)), prim.GetPath()

    behaviors = [prim for prim in prims if prim.GetTypeName() == 'Preliminary_Behavior']
    assert behaviors and len(behaviors) % 2 == 0
    states = len(behaviors) // 2
    for index in range(states):
        for part in ('leg', 'wing'):
            behavior = stage.GetPrimAtPath(f'{SCENE}/Behaviors/Tap_{part}_{index}')
            assert behavior and behavior.GetAttribute('exclusive').Get()
            trigger = stage.GetPrimAtPath(behavior.GetRelationship('triggers').GetTargets()[0])
            assert trigger.GetAttribute('info:id').Get() == 'TapGesture'
            targets = trigger.GetRelationship('affectedObjects').GetTargets()
            assert targets
            for target in targets:
                assert stage.GetPrimAtPath(target).GetTypeName() == 'Mesh', target
                assert f'/State_{index}/' in str(target), target

    wrappers = [prim for prim in prims if prim.GetName().startswith('State_')]
    for prim in wrappers:
        determinant = prim.GetAttribute('xformOp:transform').Get().GetDeterminant()
        assert abs(determinant - (1 if prim.GetName() == 'State_0' else 0)) < 1e-8

    world_actions = False

    def perform(action):
        assert action, 'Missing action'
        kind = action.GetAttribute('info:id').Get()
        if kind == 'Group':
            assert action.GetAttribute('type').Get() in ('serial', 'parallel')
            for target in action.GetRelationship('actions').GetTargets():
                perform(stage.GetPrimAtPath(target))
        else:
            assert kind == 'Transform', kind
            assert action.GetAttribute('type').Get() == 'absolute'
            target = stage.GetPrimAtPath(action.GetRelationship('xformTarget').GetTargets()[0])
            matrix = target.GetAttribute('xformOp:transform').Get()
            for affected in action.GetRelationship('affectedObjects').GetTargets():
                prim = stage.GetPrimAtPath(affected)
                value = matrix
                if world_actions:
                    cache = UsdGeom.XformCache()
                    value = cache.GetLocalToWorldTransform(target) * cache.GetLocalToWorldTransform(prim.GetParent()).GetInverse()
                prim.GetAttribute('xformOp:transform').Set(value)

    # Evaluate every transition, including the state-copy handoff that caused
    # wings to snap back in the first iPhone test. This remains an offline
    # action interpreter, not Quick Look's animation engine.
    layer = stage.GetSessionLayer()
    stage.SetEditTarget(layer)
    def seed(index):
        for prim in stage.GetPrimAtPath(f'{SCENE}/Rig').GetChildren():
            if prim.GetName().startswith('Motion_'):
                target = stage.GetPrimAtPath(f'{SCENE}/Targets/Pose_{index}_{prim.GetName()}')
                if target:
                    prim.GetAttribute('xformOp:transform').Set(target.GetAttribute('xformOp:transform').Get())
        perform(stage.GetPrimAtPath(f'{SCENE}/Actions/Select_{index}'))

    def snapshot():
        cache = UsdGeom.XformCache()
        active = {}
        for prim in prims:
            if prim.GetTypeName() != 'Mesh':
                continue
            matrix = cache.GetLocalToWorldTransform(prim)
            if abs(matrix.GetDeterminant()) < 1e-14:
                continue
            key = prim.GetParent().GetName()
            assert key not in active, f'Duplicate visible surface: {key}'
            assert all(math.isfinite(matrix[r][c]) for r in range(4) for c in range(4)), prim.GetPath()
            endpoint = matrix.Transform(Gf.Vec3d(UsdGeom.Mesh(prim).GetPointsAttr().Get()[0]))
            assert all(math.isfinite(n) and abs(n) < 10 for n in endpoint), prim.GetPath()
            active[key] = matrix
        return active

    def same_pose(actual, expected, label):
        assert actual.keys() == expected.keys(), f'{label}: lost/duplicated a surface'
        for key in expected:
            assert all(abs(actual[key][r][c] - expected[key][r][c]) < 1e-6
                       for r in range(4) for c in range(4)), f'{label}: {key} moved'

    expected = []
    for index in range(states):
        seed(index)
        expected.append(snapshot())
        for prim in wrappers:
            shown = prim.GetName() == f'State_{index}'
            determinant = prim.GetAttribute('xformOp:transform').Get().GetDeterminant()
            assert abs(determinant - int(shown)) < 1e-5
    assert all(len(pose) == len(expected[0]) for pose in expected)
    for world_actions in (False, True):
        space = 'world' if world_actions else 'local'
        for index in range(states):
            for part in ('leg', 'wing'):
                seed(index)
                behavior = stage.GetPrimAtPath(f'{SCENE}/Behaviors/Tap_{part}_{index}')
                entry = stage.GetPrimAtPath(behavior.GetRelationship('actions').GetTargets()[0])
                steps = entry.GetRelationship('actions').GetTargets()
                assert entry.GetAttribute('type').Get() == 'serial' and len(steps) == 2
                move, select = (stage.GetPrimAtPath(step) for step in steps)
                destination = int(select.GetName().split('_')[-1])
                animated = [target for action_path in move.GetRelationship('actions').GetTargets()
                            for target in stage.GetPrimAtPath(action_path).GetRelationship('affectedObjects').GetTargets()]
                for parent in animated:
                    assert not any(child != parent and child.HasPrefix(parent) for child in animated), \
                        'A transition animates both parent and child'
                for action_path in select.GetRelationship('actions').GetTargets():
                    for target in stage.GetPrimAtPath(action_path).GetRelationship('affectedObjects').GetTargets():
                        assert not any(target != parent and target.HasPrefix(parent) for parent in animated), \
                            'Handoff changes a child of an animated parent'
                perform(move)
                at_end = snapshot()
                same_pose(at_end, expected[destination], f'{space}/{index}/{part}: animation endpoint')
                perform(select)
                same_pose(snapshot(), at_end, f'{space}/{index}/{part}: handoff snap-back')
    print(f'{path.name}: valid USD, references, aligned ZIP; {states} poses, '
          f'{len(behaviors)} transitions without handoff jumps, {len(expected[0])} active meshes per pose. '
          'Apple tap runtime unverified.')


if __name__ == '__main__':
    assert len(sys.argv) > 1, __doc__
    for filename in sys.argv[1:]:
        check(Path(filename))
