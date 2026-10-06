import * as THREE from 'three';

// A single sun shadow map serves each measured room. Architectural coordinates
// are millimetres; targets, shadow bounds and relief are converted through the
// room transform, just like the furniture. This never runs in the AR scene.
const DAY_ANGLES = {
    morning: { elevation: .62, sweep: -.36, softness: 3 },
    afternoon: { elevation: 1.45, sweep: .12, softness: 4 },
    evening: { elevation: .32, sweep: .48, softness: 5 },
    night: { elevation: 1.8, sweep: -.1, softness: 7 },
    party: { elevation: 1.35, sweep: .25, softness: 7 }
};

export function configureRoomLightRig(room, lights, mode) {
    const { root, roomLayout: layout } = room;
    root.updateWorldMatrix(true, false);
    const { width: w, depth: d, height: h, back } = layout;
    const center = new THREE.Vector3(0, h * .4, back + d * .5);
    // Home office windows are on the rear wall; the other layouts explicitly
    // declare their left/right window. Use the window's outward normal.
    const window = layout.daylight || [0, back];
    const outward = layout.daylight ? new THREE.Vector3(Math.sign(window[0]), 0, 0) : new THREE.Vector3(0, 0, -1);
    const along = new THREE.Vector3(-outward.z, 0, outward.x);
    const angle = DAY_ANGLES[mode] || DAY_ANGLES.afternoon;
    const distance = Math.hypot(w, d, h) * 1.4;
    const direction = outward.clone().addScaledVector(along, angle.sweep);
    direction.y = angle.elevation;
    // At night the weak main light acts as a ceiling wash; practical lamps and
    // desk LEDs retain the colours/intensities authored by each environment.
    if (mode === 'night' || mode === 'party' || room.id === 'scifi') direction.y = Math.max(direction.y, 1.3);
    direction.normalize();
    const place = (light, point, target = center) => {
        light.position.copy(root.localToWorld(point.clone()));
        light.target.position.copy(root.localToWorld(target.clone()));
        light.updateMatrixWorld(true); light.target.updateMatrixWorld(true);
    };
    place(lights.key, center.clone().addScaledVector(direction, distance));
    place(lights.fill, center.clone().addScaledVector(outward, -distance * .65).add(new THREE.Vector3(0, h, 0)));
    place(lights.rim, new THREE.Vector3(w * .25, h * 1.2, back - d * .4));
    lights.hemi.groundColor.set(room.id === 'scifi' ? '#253443' : room.id === 'gym' ? '#3e4649' : '#8c8172');

    const shadow = lights.key.shadow, camera = shadow.camera;
    shadow.updateMatrices(lights.key);
    const bounds = new THREE.Box3();
    // Include the real floor footprint and wall height, plus the thickness of
    // the shell, rather than the product viewer's fixed +/-5 unit square.
    for (const x of [-w / 2 - 100, w / 2 + 100]) for (const y of [-40, h + 100]) for (const z of [back - 100, back + d + 100]) {
        bounds.expandByPoint(root.localToWorld(new THREE.Vector3(x, y, z)).applyMatrix4(camera.matrixWorldInverse));
    }
    const margin = 150 * root.scale.x;
    camera.left = bounds.min.x - margin; camera.right = bounds.max.x + margin;
    camera.bottom = bounds.min.y - margin; camera.top = bounds.max.y + margin;
    camera.near = Math.max(.01, -bounds.max.z - margin);
    camera.far = -bounds.min.z + margin;
    camera.updateProjectionMatrix();
    shadow.radius = angle.softness;
    shadow.normalBias = 1.2 * root.scale.x;
    shadow.bias = -.00012;
    shadow.needsUpdate = true;
    root.userData.lighting = {
        mode, source: room.id === 'scifi' ? 'orbital-wash' : mode === 'night' || mode === 'party' ? 'ceiling-wash' : 'window-daylight',
        direction: direction.toArray(), target: lights.key.target.position.toArray(),
        shadowSize: [camera.right - camera.left, camera.top - camera.bottom],
        shadowMapSize: shadow.mapSize.x
    };
}

export function resetRoomLightRig(lights) {
    for (const light of [lights.key, lights.fill, lights.rim]) {
        light.target.position.set(0, 0, 0); light.target.updateMatrixWorld(true);
    }
    lights.fill.position.set(-6, 3.5, 3); lights.rim.position.set(-4, 5.5, -7.5);
    Object.assign(lights.key.shadow.camera, { near: 1, far: 25, left: -5, right: 5, top: 5, bottom: -5 });
    lights.key.shadow.camera.updateProjectionMatrix();
    Object.assign(lights.key.shadow, { radius: 8, normalBias: .004, bias: -.0002, needsUpdate: true });
}

const SURFACES = {
    wood: { period: 240, relief: .16 },
    plaster: { period: 120, relief: .25 },
    fabric: { period: 20, relief: .28 },
    powder: { period: 65, relief: .07 },
    metal: { period: 100, relief: .025 },
    stone: { period: 160, relief: .08 },
    rubber: { period: 55, relief: .3 }
};

function surfaceMaps(kind) {
    const size = 128, height = new Uint8Array(size * size * 4), sheen = new Uint8Array(size * size * 4), color = new Uint8Array(size * size * 4);
    // Integer noise is stable across rebuilds. Sine waves tile at the edges.
    const noise = (x, y) => { let n = Math.imul(x + 13, 374761393) ^ Math.imul(y + 37, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0) / 4294967295; };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const a = x / size * Math.PI * 2, b = y / size * Math.PI * 2, n = noise(x, y);
        let value;
        if (kind === 'wood') value = .5 + .19 * Math.sin(a * 13 + .8 * Math.sin(b * 2)) + .07 * Math.sin(a * 29 + Math.sin(b)) + (n - .5) * .08;
        else if (kind === 'fabric') value = .5 + .16 * Math.cos(a * 16) + .16 * Math.cos(b * 16) + .08 * Math.sin((a + b) * 8);
        else if (kind === 'metal') value = .5 + .13 * Math.sin(a * 29) + (n - .5) * .06;
        else value = .5 + (n - .5) * .48 + .07 * Math.sin(a * 3) * Math.cos(b * 4);
        const i = (y * size + x) * 4;
        height[i] = height[i + 1] = height[i + 2] = Math.round(value * 255); height[i + 3] = 255;
        sheen[i] = sheen[i + 1] = sheen[i + 2] = Math.round(225 + value * 30); sheen[i + 3] = 255;
        color[i] = color[i + 1] = color[i + 2] = Math.round(232 + value * 23); color[i + 3] = 255;
    }
    const texture = (data, srgb = false) => {
        const map = new THREE.DataTexture(data, size, size); map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true;
        map.channel = 1; if (srgb) map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true; return map;
    };
    return { bump: texture(height), roughness: texture(sheen), color: kind === 'wood' ? texture(color, true) : null };
}

// A second UV set gives surface relief a physical repeat distance. Authored
// colour maps, artwork, screens, imported GLBs and cached desk meshes keep
// their existing UVs and textures. Textures are shared only within this room.
export function refineRoomSurfaces(room) {
    const { root } = room, maps = new Map(), materials = new Set();
    // Instanced book bands may share brass with lamp stems. Keep those tiny
    // batches flat rather than applying UVs for just one instance to all books.
    root.traverse(obj => {
        if (obj.isInstancedMesh && obj.material?.userData?.roomSurface && !obj.userData.sharedProp) {
            obj.material = obj.material.clone(); delete obj.material.userData.roomSurface;
        }
    });
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    let meshes = 0;
    root.traverse(obj => {
        const mat = obj.material, kind = mat?.userData?.roomSurface, spec = SURFACES[kind];
        if (!obj.isMesh || obj.isInstancedMesh || !spec || obj.userData.sharedProp || !mat.isMeshStandardMaterial || mat.transparent || mat.emissive.getHex() !== 0) return;
        const geometry = obj.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
        if (!positions || !normals || (mat.bumpMap && !materials.has(mat))) return;
        const transform = inverse.clone().multiply(obj.matrixWorld), normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
        const uv = new Float32Array(positions.count * 2), p = new THREE.Vector3(), n = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            p.fromBufferAttribute(positions, i).applyMatrix4(transform); n.fromBufferAttribute(normals, i).applyMatrix3(normalTransform);
            const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
            const pair = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y];
            uv[i * 2] = pair[0] / spec.period; uv[i * 2 + 1] = pair[1] / spec.period;
        }
        geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2)); meshes++;
        if (materials.has(mat)) return;
        materials.add(mat);
        if (!maps.has(kind)) maps.set(kind, surfaceMaps(kind));
        const detail = maps.get(kind);
        mat.bumpMap = detail.bump; mat.bumpScale = spec.relief * root.scale.x;
        if (!mat.roughnessMap) mat.roughnessMap = detail.roughness;
        if (!mat.map && detail.color) mat.map = detail.color;
        mat.needsUpdate = true;
    });
    root.userData.surfaceDetail = { meshes, materials: materials.size, types: [...maps.keys()], textureSize: 128 };
}
