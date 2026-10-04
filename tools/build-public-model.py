"""Replace the two shelf plates and repack GLB bytes without their old geometry.

Usage: python3 tools/build-public-model.py source.glb platesreplacement.glb
The output preserves node/mesh order for the Studio motion rigs and editor IDs.
"""
import copy
import json
from pathlib import Path
import struct
import sys


def read_glb(path):
    data = Path(path).read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    json_size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_size])
    start = 20 + json_size
    bin_size = struct.unpack_from('<I', data, start)[0]
    return doc, data[start + 8:start + 8 + bin_size]


def accessor_values(doc, binary, index):
    accessor = doc['accessors'][index]
    view = doc['bufferViews'][accessor['bufferView']]
    widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    formats = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}
    fmt = '<' + formats[accessor['componentType']] * widths[accessor['type']]
    stride = view.get('byteStride', struct.calcsize(fmt))
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, offset + i * stride)
            for i in range(accessor['count'])]


source, source_bytes = read_glb(sys.argv[1])
plates, plate_bytes = read_glb(sys.argv[2])
assert len(plates['meshes']) == 2
assert len(source['meshes']) == 830, 'Verify plate mapping against a changed source model.'
output = bytearray()
accessors = []
views = []
copied_accessors = {}


def append_view(data, target=None):
    output.extend(b'\0' * (-len(output) % 4))
    view = {'buffer': 0, 'byteOffset': len(output), 'byteLength': len(data)}
    if target is not None:
        view['target'] = target
    views.append(view)
    output.extend(data)
    return len(views) - 1


def copy_accessor(index):
    if index in copied_accessors:
        return copied_accessors[index]
    accessor = copy.deepcopy(source['accessors'][index])
    view = source['bufferViews'][accessor['bufferView']]
    assert 'sparse' not in accessor and 'byteStride' not in view
    start = view.get('byteOffset', 0)
    accessor['bufferView'] = append_view(source_bytes[start:start + view['byteLength']], view.get('target'))
    accessors.append(accessor)
    copied_accessors[index] = len(accessors) - 1
    return len(accessors) - 1


def add_accessor(values, value_type, component_type, target):
    fmt = '<' + ('f' if component_type == 5126 else 'I') * len(values[0])
    data = b''.join(struct.pack(fmt, *value) for value in values)
    accessor = {'bufferView': append_view(data, target), 'componentType': component_type,
                'count': len(values), 'type': value_type}
    if value_type == 'VEC3' and target == 34962:
        accessor['min'] = [min(value[k] for value in values) for k in range(3)]
        accessor['max'] = [max(value[k] for value in values) for k in range(3)]
    accessors.append(accessor)
    return len(accessors) - 1


# Exported plates are 100 source units forward of full.glb. Match their original
# thickness midplanes independently; Y extents match the original plates exactly.
replacement_mapping = {580: 1, 581: 0}  # Plates_Hardware_290 and _291
for mesh_index, mesh in enumerate(source['meshes']):
    if mesh_index not in replacement_mapping:
        for primitive in mesh['primitives']:
            primitive['attributes'] = {key: copy_accessor(value) for key, value in primitive['attributes'].items()}
            if 'indices' in primitive:
                primitive['indices'] = copy_accessor(primitive['indices'])
        continue
    assert source['nodes'][mesh_index]['name'] == 'Plates_Hardware'
    old = source['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
    old_mid_z = (old['min'][2] + old['max'][2]) / 2
    replacement = plates['meshes'][replacement_mapping[mesh_index]]
    new_bounds = [plates['accessors'][p['attributes']['POSITION']] for p in replacement['primitives']]
    new_mid_z = (min(a['min'][2] for a in new_bounds) + max(a['max'][2] for a in new_bounds)) / 2
    assert abs(old['min'][1] - min(a['min'][1] for a in new_bounds)) < .001
    assert abs(old['max'][1] - max(a['max'][1] for a in new_bounds)) < .001
    merged = {'POSITION': [], 'NORMAL': [], 'TEXCOORD_0': []}
    indices = []
    for primitive in replacement['primitives']:
        base = len(merged['POSITION'])
        for key in merged:
            values = accessor_values(plates, plate_bytes, primitive['attributes'][key])
            if key == 'POSITION':
                values = [(x - 100, y, z + old_mid_z - new_mid_z) for x, y, z in values]
            merged[key].extend(values)
        indices.extend((value[0] + base,) for value in accessor_values(plates, plate_bytes, primitive['indices']))
    attributes = {key: add_accessor(values, 'VEC2' if key == 'TEXCOORD_0' else 'VEC3', 5126, 34962)
                  for key, values in merged.items()}
    mesh['primitives'] = [{'attributes': attributes, 'indices': add_accessor(indices, 'SCALAR', 5125, 34963),
                          'material': mesh['primitives'][0]['material']}]
    print(f'Replaced mesh {mesh_index}: {len(merged["POSITION"])} vertices, {len(indices) // 3} triangles')

source['accessors'] = accessors
source['bufferViews'] = views
source['buffers'] = [{'byteLength': len(output)}]
json_bytes = json.dumps(source, separators=(',', ':')).encode()
json_bytes += b' ' * (-len(json_bytes) % 4)
output.extend(b'\0' * (-len(output) % 4))
result = struct.pack('<III', 0x46546C67, 2, 28 + len(json_bytes) + len(output))
result += struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes
result += struct.pack('<II', len(output), 0x004E4942) + output
path = Path(__file__).resolve().parent.parent / 'assets/model/desk-public.glb'
path.parent.mkdir(parents=True, exist_ok=True)
path.write_bytes(result)
print(f'Built {path} ({len(result):,} bytes); removed original plate accessors and buffer bytes.')
