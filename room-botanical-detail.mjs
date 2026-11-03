import * as THREE from 'three';

// Closed, gently folded leaves catch light on both faces without transparent
// cards. Millimetres; low polygon count, merged by the caller's detail kit.
export function leafGeometry(width, length, bend = 12) {
    const positions = [], indices = [], rows = 10;
    for (let face = 0; face < 2; face++) for (let row = 0; row <= rows; row++) {
        const t = row / rows, half = Math.max(.15, Math.sin(t * Math.PI) ** .8 * width / 2);
        for (let side = -1; side <= 1; side++) positions.push(side * half,
            (t - .5) * length, Math.sin(t * Math.PI) * bend - Math.abs(side) * half * .16 + (face ? -.4 : .4));
    }
    const count = (rows + 1) * 3;
    for (let row = 0; row < rows; row++) for (let side = 0; side < 2; side++) {
        const a = row * 3 + side, b = a + 1, c = a + 3, d = c + 1;
        indices.push(a, b, c, b, d, c, a + count, c + count, b + count, b + count, c + count, d + count);
    }
    for (const side of [0, 2]) for (let row = 0; row < rows; row++) {
        const a = row * 3 + side, b = a + 3;
        if (side === 0) indices.push(a, b, a + count, b, b + count, a + count);
        else indices.push(a, a + count, b, b, a + count, b + count);
    }
    indices.push(0, count, 2, 2, count, count + 2,
        count - 3, count - 1, count * 2 - 3, count - 1, count * 2 - 1, count * 2 - 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices); g.computeVertexNormals();
    // detailKit merges these with standard primitives, which have UVs.
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
    return g;
}

export function botanicalPlant(k, x, y, z, size = 1) {
    const at = (a, b, c) => [x + a * size, y + b * size, z + c * size];
    k.cyl(95 * size, 75 * size, 170 * size, at(0, 85, 0), '#b5aa93');
    k.cyl(89 * size, 89 * size, 5 * size, at(0, 163, 0), '#433d30');
    k.add(new THREE.TorusGeometry(92 * size, 3 * size, 6, 24), at(0, 168, 0), '#c6bda7', [1, 1, 1], [Math.PI / 2, 0, 0]);
    for (let n = 0; n < 11; n++) {
        const angle = n * 2.39996, radius = 82 + n % 3 * 20;
        const center = new THREE.Vector3(Math.cos(angle) * radius, 225 + n * 24, Math.sin(angle) * radius);
        const rotation = new THREE.Euler(.16 * Math.sin(n), -angle, -.5 + (n % 3) * .14);
        const bottom = new THREE.Vector3(0, -75, 0).applyEuler(rotation).add(center);
        const start = new THREE.Vector3(0, 165, 0), direction = bottom.clone().sub(start);
        const stemRotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
        const middle = start.add(bottom).multiplyScalar(.5);
        k.add(new THREE.CylinderGeometry(1.7 * size, 2.8 * size, direction.length() * size, 5), at(...middle.toArray()), '#65754d', [1, 1, 1], stemRotation.toArray().slice(0, 3));
        k.add(leafGeometry(62, 158 + n % 3 * 12, 13), at(...center.toArray()), ['#426951', '#58784f', '#365e4b'][n % 3], [size, size, size], rotation.toArray().slice(0, 3));
    }
    for (let n = 0; n < 12; n++) {
        const a = n * 2.4, r = 24 + n % 4 * 14;
        k.ball(3 * size, at(Math.cos(a) * r, 167, Math.sin(a) * r), n % 2 ? '#706550' : '#514b3c', [1.4, .6, 1]);
    }
}
