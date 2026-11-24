import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { roomSurfaceFinish } from './room-polish.mjs?v=polish-20261111f';

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
    const x0 = layout.left ?? -w / 2, center = new THREE.Vector3(x0 + w / 2, h * .4, back + d * .5);
    // Home office windows are on the rear wall; the other layouts explicitly
    // declare their left/right window. Use the window's outward normal.
    const window = layout.daylight || [0, back];
    const outward = layout.daylight ? new THREE.Vector3(Math.sign(window[0]), 0, 0) : new THREE.Vector3(0, 0, -1);
    const along = new THREE.Vector3(-outward.z, 0, outward.x);
    const contemporary = room.id === 'lounge' && layout.style === 'contemporary';
    const workshopDay = room.id === 'workshop' && ['morning', 'afternoon'].includes(mode);
    const angle = workshopDay ? {elevation:.95,sweep:-.22,softness:12} : contemporary && mode === 'evening' ? {elevation:1.0,sweep:.2,softness:16} : DAY_ANGLES[mode] || DAY_ANGLES.afternoon;
    // Broad workshop daylight keeps the folding mechanism legible without
    // letting hard lumber-rack shadows dominate the product shot.
    if (workshopDay) { lights.key.intensity *= .78; lights.fill.intensity *= 1.35; }
    if(contemporary && mode === 'evening'){lights.key.intensity *= .85;lights.fill.intensity *= 1.22;}
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
    for (const x of [x0 - 100, x0 + w + 100]) for (const y of [-40, h + 100]) for (const z of [back - 100, back + d + 100]) {
        bounds.expandByPoint(root.localToWorld(new THREE.Vector3(x, y, z)).applyMatrix4(camera.matrixWorldInverse));
    }
    const margin = 150 * root.scale.x;
    camera.left = bounds.min.x - margin; camera.right = bounds.max.x + margin;
    camera.bottom = bounds.min.y - margin; camera.top = bounds.max.y + margin;
    camera.near = Math.max(.01, -bounds.max.z - margin);
    camera.far = -bounds.min.z + margin;
    camera.updateProjectionMatrix();
    shadow.radius = room.id === 'lounge' && layout.style === 'contemporary' ? 16 : angle.softness;
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
    wood:    { period: 240, relief: .16, normalScale: .32, slope: 3.4, roughRange: 76 },
    plaster: { period: 120, relief: .25, normalScale: .28, slope: 2.8, roughRange: 56 },
    fabric:  { period: 20,  relief: .28, normalScale: .42, slope: 4.0, roughRange: 44 },
    powder:  { period: 65,  relief: .07, normalScale: .16, slope: 1.9, roughRange: 42 },
    metal:   { period: 100, relief: .025, normalScale: .18, slope: 2.2, roughRange: 68 },
    stone:   { period: 160, relief: .08, normalScale: .26, slope: 2.6, roughRange: 88 },
    rubber:  { period: 55,  relief: .30, normalScale: .40, slope: 3.6, roughRange: 52 }
};

function surfaceMaps(kind) {
    const spec = SURFACES[kind] || SURFACES.plaster;
    const size = 256, field = new Float32Array(size * size);
    const height = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), sheen = new Uint8Array(size * size * 4), color = new Uint8Array(size * size * 4);
    // Integer hash noise is deterministic across rebuilds; value-interpolated octave + sine waves tile seamlessly.
    const hash = (x, y) => {
        const xm = ((x % size) + size) % size, ym = ((y % size) + size) % size;
        let n = Math.imul(xm + 13, 374761393) ^ Math.imul(ym + 37, 668265263);
        n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0) / 4294967295;
    };
    const smoothNoise = (x, y, step) => {
        const gx = Math.floor(x / step), gy = Math.floor(y / step);
        const fx = (x - gx * step) / step, fy = (y - gy * step) / step;
        const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        const cells = size / step;
        const h = (cx, cy) => hash(((cx % cells) + cells) % cells * step, ((cy % cells) + cells) % cells * step);
        const a = h(gx, gy) + (h(gx + 1, gy) - h(gx, gy)) * ux;
        const b = h(gx, gy + 1) + (h(gx + 1, gy + 1) - h(gx, gy + 1)) * ux;
        return a + (b - a) * uy;
    };
    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const a = x / size * Math.PI * 2, b = y / size * Math.PI * 2;
        const n1 = hash(x, y), n4 = smoothNoise(x, y, 4), n16 = smoothNoise(x, y, 16);
        let value;
        if (kind === 'wood') {
            const warp = .65 * Math.sin(b * 2 + n16 * 1.4) + .25 * Math.sin(b * 5);
            value = .5 + .16 * Math.sin(a * 11 + warp) + .09 * Math.sin(a * 37 + warp * 1.6) + .045 * Math.cos(a * 79 + b) + (n4 - .5) * .08 + (n1 - .5) * .045;
        } else if (kind === 'fabric') {
            const twill = Math.cos(a * 24) * .12 + Math.cos(b * 24) * .12 + Math.sin((a + b) * 16) * .065;
            value = .5 + twill + .035 * Math.sin(a * 3 + Math.sin(b * 2)) + (n4 - .5) * .10 + (n1 - .5) * .09;
        } else if (kind === 'metal') {
            value = .5 + .11 * Math.sin(a * 61) + .055 * Math.sin(a * 113 + n4 * .5) + .03 * Math.cos(a * 19) + (n1 - .5) * .04;
        } else if (kind === 'stone') {
            const vein = Math.sin(a * 2 + 1.5 * Math.sin(b * 3) + (n16 - .5) * 2.4);
            value = .52 + .11 * vein + .045 * Math.sin(a * 9 + Math.cos(b * 7)) + (n16 - .5) * .14 + (n4 - .5) * .08 + (n1 - .5) * .05;
        } else if (kind === 'rubber') {
            value = .5 + (n4 - .5) * .34 + (n1 - .5) * .36 + .055 * Math.cos(a * 24) * Math.cos(b * 24);
        } else if (kind === 'powder') {
            value = .5 + (n4 - .5) * .18 + (n1 - .5) * .14;
        } else {
            value = .5 + (n16 - .5) * .16 + (n4 - .5) * .18 + (n1 - .5) * .16 + .035 * Math.sin(a * 3) * Math.cos(b * 4);
        }
        const v = clamp01(value);
        field[y * size + x] = v;
        const i = (y * size + x) * 4;
        height[i] = height[i + 1] = height[i + 2] = Math.round(v * 255); height[i + 3] = 255;
        const range = spec.roughRange;
        // Stone veins / high spots read slightly glossier than matte pores; other surfaces brighten roughness on peaks.
        const roughVal = kind === 'stone' ? (1 - v) : v;
        sheen[i] = sheen[i + 1] = sheen[i + 2] = Math.round(255 - range + roughVal * range); sheen[i + 3] = 255;
        color[i] = color[i + 1] = color[i + 2] = Math.round(236 + v * 19); color[i + 3] = 255;
    }
    // 3x3 Sobel tangent-space normal map (seamless wrap across edges).
    const sample = (x, y) => field[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
    const slope = spec.slope;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const tl = sample(x - 1, y - 1), t = sample(x, y - 1), tr = sample(x + 1, y - 1);
        const l  = sample(x - 1, y),                           r  = sample(x + 1, y);
        const bl = sample(x - 1, y + 1), b = sample(x, y + 1), br = sample(x + 1, y + 1);
        const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        let nx = -dx * slope, ny = -dy * slope, nz = 1;
        const inv = 1 / Math.hypot(nx, ny, nz);
        nx *= inv; ny *= inv; nz *= inv;
        const i = (y * size + x) * 4;
        normal[i]     = Math.round((nx * .5 + .5) * 255);
        normal[i + 1] = Math.round((ny * .5 + .5) * 255);
        normal[i + 2] = Math.round((nz * .5 + .5) * 255);
        normal[i + 3] = 255;
    }
    const texture = (data, srgb = false) => {
        const map = new THREE.DataTexture(data, size, size); map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true;
        map.channel = 1; map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        map.needsUpdate = true; return map;
    };
    return { bump: texture(height), normal: texture(normal), roughness: texture(sheen), color: ['wood', 'stone', 'fabric', 'rubber'].includes(kind) ? texture(color, true) : null };
}

// A second UV set gives surface relief a physical repeat distance. Authored
// colour maps, artwork, screens, imported GLBs and cached desk meshes keep
// their existing UVs and textures. Textures are shared only within this room.
export function refineRoomSurfaces(room) {
    const { root } = room, maps = new Map(), materials = new Set();
    // Millimetre-scale eased edges on furniture slabs catch window light.
    // Shells, thin panels, desk CAD, imported meshes and authored roundovers
    // are excluded. Shared box geometry receives one shared replacement.
    const softened = new Map();
    root.traverse(obj => {
        const m = obj.material, p = obj.geometry?.parameters;
        if (!obj.isMesh || obj.isInstancedMesh || obj.userData.sharedProp || obj.geometry.type !== 'BoxGeometry'
            || !['wood', 'stone', 'powder'].includes(m?.userData?.roomSurface) || !p
            || p.height < 12 || p.height > 80 || p.width < 200 || p.depth < 160
            || p.width > 3000 || p.depth > 1600) return;
        const source = obj.geometry;
        if (!softened.has(source)) softened.set(source, new RoundedBoxGeometry(p.width, p.height, p.depth, 2, Math.min(2, p.height * .07)));
        obj.geometry = softened.get(source);
    });
    // Geometry can also be shared with an excluded mesh: dispose only when
    // no remaining object references the original.
    const inUse = new Set(); root.traverse(o => { if (o.geometry) inUse.add(o.geometry); });
    for (const original of softened.keys()) if (!inUse.has(original)) original.dispose();
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
        if (!positions || !normals || mat.userData.roomDetailAuthored || ((mat.bumpMap || mat.normalMap) && !materials.has(mat))) return;
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
        roomSurfaceFinish(room, mat, kind);
        if (!maps.has(kind)) {
            const generated = surfaceMaps(kind); maps.set(kind, generated);
            // A mapped surface may not use the neutral colour detail. Own even
            // those unused maps so a scene switch releases every allocation.
            root.ownedTextures ||= []; root.ownedTextures.push(...Object.values(generated).filter(Boolean));
        }
        const detail = maps.get(kind);
        mat.bumpMap = detail.bump; mat.bumpScale = 0;
        mat.normalMap = detail.normal;
        mat.normalScale.set(spec.normalScale, spec.normalScale);
        if (!mat.roughnessMap) mat.roughnessMap = detail.roughness;
        if (!mat.map && detail.color) mat.map = detail.color;
        mat.needsUpdate = true;
    });
    // Guard against shared/instanced/array-material meshes that share a refined material without uv1.
    const detachCache = new Map();
    const detachMat = m => {
        if (!detachCache.has(m)) {
            const c = m.clone();
            c.bumpMap = null; c.bumpScale = 0; c.normalMap = null;
            if (c.roughnessMap && c.roughnessMap.channel === 1) c.roughnessMap = null;
            if (c.map && c.map.channel === 1) c.map = null;
            if (c.userData) { c.userData = { ...c.userData }; delete c.userData.roomSurface; }
            c.needsUpdate = true;
            detachCache.set(m, c);
        }
        return detachCache.get(m);
    };
    root.traverse(obj => {
        if (!obj.isMesh || obj.geometry?.attributes?.uv1) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const hit = mats.find(m => materials.has(m));
        if (!hit) return;
        const geometry = obj.geometry, positions = geometry?.attributes?.position, normals = geometry?.attributes?.normal;
        if (!obj.isInstancedMesh && !obj.userData.sharedProp && positions && normals) {
            const spec = SURFACES[hit.userData?.roomSurface] || SURFACES.plaster;
            const transform = inverse.clone().multiply(obj.matrixWorld), normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
            const uv = new Float32Array(positions.count * 2), p = new THREE.Vector3(), n = new THREE.Vector3();
            for (let i = 0; i < positions.count; i++) {
                p.fromBufferAttribute(positions, i).applyMatrix4(transform); n.fromBufferAttribute(normals, i).applyMatrix3(normalTransform);
                const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
                const pair = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y];
                uv[i * 2] = pair[0] / spec.period; uv[i * 2 + 1] = pair[1] / spec.period;
            }
            geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2)); meshes++;
        } else if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(m => materials.has(m) ? detachMat(m) : m);
        } else {
            obj.material = detachMat(obj.material);
        }
    });
    root.userData.surfaceDetail = { meshes, materials: materials.size, types: [...maps.keys()], textureSize: 256, easedFurnitureEdges: softened.size };
}
