import * as THREE from 'three';

// Local millimetres. A continuous lathed profile includes the saucer, turned lip,
// exposed inner rim and soil. Each frond has a curved rachis and folded pinnae.
export function pottedFern(radius, seed, glaze = '#9e7460') {
    const plant = new THREE.Group();
    plant.name = 'Potted fern';
    const profile = [[0,0],[.86,0],[.94,.05],[.95,.12],[.86,.13],[.76,.10],[.72,.16],
        [.77,.22],[.88,.87],[.92,.96],[.92,1.02],[.88,1.05],[.84,1.02],[.82,.95],[.78,.91],[0,.93]];
    const pot = new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r * radius,y * radius)), 32);
    const clay = new THREE.Color(glaze), earth = new THREE.Color('#382e21'), potColors = [];
    for (let i = 0; i < pot.attributes.position.count; i++) {
        const j = i % profile.length;
        const c = j >= 14 ? earth : clay;
        const value = j === 5 || j === 6 ? .76 : j === 2 || j === 10 ? 1.07 : 1;
        potColors.push(c.r * value, c.g * value, c.b * value);
    }
    pot.setAttribute('color', new THREE.Float32BufferAttribute(potColors, 3));
    const vessel = new THREE.Mesh(pot, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.58}));
    plant.add(vessel);
    const positions = [], colors = [], indices = [];
    const palette = ['#425c33','#526d3d','#68834c','#344e33','#748950'].map(c => new THREE.Color(c));
    const vertex = (p, c, brightness = 1) => {
        positions.push(p.x, p.y, p.z); colors.push(c.r*brightness,c.g*brightness,c.b*brightness);
        return positions.length / 3 - 1;
    };
    for (let f = 0; f < 15; f++) {
        const angle = seed + f * 2.39996, spread = .72 + ((f*7)%13)/13, length = 1.48 + spread*.54;
        const radial = new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z,0,radial.x), green = palette[f % palette.length];
        const point = t => radial.clone().multiplyScalar(radius * (.09 + spread * t**1.42)).setY(
            radius * (.92 + length * (1.55*t - (.59 + spread*.12)*t*t)));
        let left, right;
        for (let k = 0; k <= 19; k++) {
            const t = k/19, base = point(t), stem = radius*(.018 - .012*t);
            const a = vertex(base.clone().addScaledVector(lateral,stem),green,1.23);
            const b = vertex(base.clone().addScaledVector(lateral,-stem),green,1.12);
            if (k) indices.push(left,right,a,right,b,a);
            left = a; right = b;
            if (k < 3 || k === 19) continue;
            const width = radius*(.15+.19*Math.sin(Math.PI*t))*(1-t**3);
            for (const side of [-1,1]) {
                const tip = point(t+.066).addScaledVector(lateral,width*side);
                const fold = base.clone().lerp(tip,.45); fold.y += radius*.022;
                const offset = radius*(.036+.018*(1-t));
                const i = vertex(base,green,.76), j = vertex(fold.clone().addScaledVector(radial,-offset),green,.91);
                const mid = vertex(fold,green,1.18), end = vertex(tip,green,1.07);
                const l = vertex(fold.clone().addScaledVector(radial,offset),green,1.02);
                indices.push(i,j,mid,j,end,mid,i,mid,l,mid,end,l);
            }
        }
    }
    const leaves = new THREE.BufferGeometry();
    leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
    leaves.setIndex(indices); leaves.computeVertexNormals();
    const crown = new THREE.Mesh(leaves, new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.77}));
    plant.add(crown);
    for (const part of plant.children) { part.castShadow = part.receiveShadow = true; part.material.userData.roomPaletteLocked = true; }
    return plant;
}
