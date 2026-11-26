// Small outdoor assemblies in the scenery builder's window-local millimetres.
import * as THREE from 'three';
import { M, colour, limb, pole } from './window-scenery-kit.mjs?v=polish-20261113b';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tyre = new THREE.TorusGeometry(325, 24, 6, 28);
const hoop = new THREE.TorusGeometry(230, 14, 6, 24).rotateX(Math.PI / 2);

export function bicycle(b, x, ground, z, turn, frame) {
    const transform = M(x, ground, z, 1, 1, 1, turn);
    const at = (px, py, pz = 0) => V(px, py, pz).applyMatrix4(transform);
    const bar = (a, c, r, hex) => limb(b, at(...a), at(...c), r, hex);
    for (const axle of [-510, 510]) {
        const centre = at(axle, 349);
        b.add(tyre, M(centre.x, centre.y, centre.z, 1, 1, 1, turn), () => colour('#31363a'));
        for (let n = 0; n < 8; n++) {
            const a = (n * Math.PI) / 4;
            bar([axle, 349], [axle + 320 * Math.cos(a), 349 + 320 * Math.sin(a)], 5, '#a8a9a1');
        }
    }
    const crank = [30, 318],
        seat = [-160, 788],
        head = [360, 780];
    for (const [a, c] of [
        [[-510, 349], crank],
        [[-510, 349], seat],
        [crank, seat],
        [seat, head],
        [crank, head]
    ])
        bar(a, c, 19, frame);
    bar(head, [510, 349], 19, '#7b8585');
    bar(head, [327, 902], 16, '#737d7f');
    bar([327, 902, -190], [327, 902, 190], 15, '#484f4e');
    bar(seat, [-185, 877], 16, '#75807e');
    bar([-268, 883], [-112, 883], 31, '#53483e');
    b.shadow(x, ground, z, 950, 250, 0.36, 300, turn);
}

export function basket(b, x, ground, z, dx, dz) {
    // dx,dz are the unit direction from the backboard into the court.
    const centre = V(x + dx * 335, ground + 3050, z + dz * 335);
    b.add(hoop, M(...centre.toArray()), () => colour('#bb613b'));
    const cord = '#ded9c9';
    for (let i = 0; i < 10; i++) {
        const point = (a, r, h) => V(centre.x + r * Math.cos(a), centre.y + h, centre.z + r * Math.sin(a));
        const a = (i * Math.PI) / 5;
        for (const s of [-1, 1]) limb(b, point(a, 225, -12), point(a + s * 0.31, 133, -350), 6, cord);
    }
}

export function shadeSail(b, corners) {
    const [a, c, d] = corners,
        cloth = colour('#d2bc90'),
        hem = '#9a8a70';
    const point = (u, v) => {
        const p = a
            .clone()
            .multiplyScalar(1 - u - v)
            .addScaledVector(c, u)
            .addScaledVector(d, v);
        p.y -= 510 * 3 * (u * v + (1 - u - v) * (u + v));
        return p;
    };
    const n = 8;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n - i; j++) {
            const p = point(i / n, j / n),
                q = point((i + 1) / n, j / n),
                s = point(i / n, (j + 1) / n);
            b.tri(p, q, s, cloth);
            if (i + j < n - 1) b.tri(q, point((i + 1) / n, (j + 1) / n), s, cloth);
        }
    for (let i = 0; i < n; i++) {
        const t = i / n,
            u = (i + 1) / n;
        for (const [a, c] of [
            [point(t, 0), point(u, 0)],
            [point(0, t), point(0, u)],
            [point(t, 1 - t), point(u, 1 - u)]
        ])
            limb(b, a, c, 16, hem);
    }
}

export function sunflower(b, x, y, z, height, angle) {
    const dir = V(Math.cos(angle), 0, Math.sin(angle)),
        side = V(-dir.z, 0, dir.x);
    const base = V(x, y, z),
        tip = base.clone().addScaledVector(dir, height * 0.1);
    tip.y += height;
    limb(b, base, tip, 14, '#657844');
    for (let i = 0; i < 5; i++) {
        const stem = base.clone().lerp(tip, 0.23 + i * 0.124),
            sign = i % 2 ? 1 : -1;
        const end = stem
            .clone()
            .addScaledVector(side, sign * (200 - i * 15))
            .addScaledVector(dir, 65);
        end.y -= 48;
        const mid = stem.clone().lerp(end, 0.45);
        mid.y += 38;
        for (const k of [-1, 1]) {
            const edge = mid.clone().addScaledVector(dir, k * 63);
            b.tri(stem, edge, mid, colour('#708648'));
            b.tri(mid, edge, end, colour('#627a43'));
        }
    }
    // Tilt the head toward the glass, with a seed disc separate from the petals.
    const face = V(0.25 * Math.sin(angle), 0.24, 1).normalize(),
        axis = V(0, 1, 0).cross(face).normalize(),
        up = face.clone().cross(axis);
    const radial = (a, r) =>
        tip
            .clone()
            .addScaledVector(axis, r * Math.cos(a))
            .addScaledVector(up, r * Math.sin(a));
    for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
            l = radial(a - 0.25, 46),
            r = radial(a + 0.25, 46),
            p = radial(a, 89 + (i % 3) * 4);
        p.addScaledVector(face, -15);
        b.tri(l, r, p, colour(i % 3 ? '#d9a233' : '#e4b94d'));
        b.tri(tip.clone().addScaledVector(face, 9), l, r, colour('#6d5639'));
    }
}

export function pitchedGlasshouse(b, x, ground, z, width, depth, eaves) {
    const u = width / 2,
        v = depth / 2,
        rise = width * 0.23,
        frame = '#bcc8c0';
    const point = (a, h, c) => V(x + a, ground + h, z + c);
    b.box([width, 250, depth], [x, ground + 125, z], '#a8775e');
    for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
            pole(b, x + side * u, ground + 240, z + end * v, eaves - 240, 21, frame);
            limb(b, point(side * u, eaves, end * v), point(0, eaves + rise, end * v), 24, frame);
        }
        b.box([40, 45, depth], [x + side * u, ground + eaves, z], frame);
        // Rear glazing and a waist rail, the near panels left clear to show
        // growing benches, pot silhouettes and the structure on the far side.
        for (let i = 1; i < 4; i++) {
            const c = -v + (depth * i) / 4;
            limb(b, point(side * u, eaves, c), point(0, eaves + rise, c), 16, frame);
            pole(b, x + side * u, ground + 250, z + c, eaves - 250, 13, frame);
        }
        b.box([30, 45, depth], [x + side * u, ground + eaves * 0.46, z], frame);
        const glass = colour(side === 1 ? '#839fa3' : '#9eb5b2');
        const p = point(side * u, eaves, -v),
            q = point(side * u, eaves, v),
            s = point(0, eaves + rise, -v);
        b.tri(p, q, s, glass);
        b.tri(s, q, point(0, eaves + rise, v), glass);
    }
    b.box([52, 56, depth + 75], [x, ground + eaves + rise, z], frame);
    b.quad(width - 90, eaves - 310, [x, ground + (eaves + 250) / 2, z - v + 20], '#77948f');
    b.box([width * 0.86, 65, depth * 0.38], [x, ground + 850, z - depth * 0.13], '#876b50');
    for (let i = 0; i < 6; i++) {
        const px = x + width * (i / 6 - 0.405),
            pz = z - depth * 0.12;
        b.box([150, 170, 150], [px, ground + 975, pz], i % 2 ? '#aa7150' : '#9e6247');
        for (const s of [-1, 1])
            limb(b, V(px, ground + 1040, pz), V(px + s * 65, ground + 1220 + (i % 3) * 40, pz + 25), 22, '#627d52');
    }
    for (const s of [-1, 1]) pole(b, x + s * width * 0.18, ground + 250, z + v, eaves - 250, 22, frame);
    b.box([width * 0.36, 50, 56], [x, ground + eaves - 20, z + v], frame);
}

export function roofDetail(b, x, top, z, width, depth) {
    const metal = '#626e70',
        cap = '#b0a79a';
    for (const sign of [-1, 1]) {
        b.box([width, 420, 150], [x, top + 210, z + sign * (depth / 2 - 75)], cap);
        b.box([150, 420, depth - 300], [x + sign * (width / 2 - 75), top + 210, z], cap);
    }
    // A bank of sloping northlights. Each has a raised curb, glazing bars
    // and an opaque high side, so it also reads in silhouette from below.
    const length = Math.min(5600, width * 0.31),
        run = 1500,
        rise = 790;
    const ox = x - width * 0.25,
        oz = z + depth * 0.18;
    for (let i = 0; i < 3; i++) {
        const pz = oz - i * 1850,
            near = pz + run / 2,
            far = pz - run / 2;
        const glass = colour(i % 2 ? '#638187' : '#708d94');
        const a = V(ox - length / 2, top + 170, near),
            c = V(ox + length / 2, top + 170, near);
        const d = V(a.x, top + rise, far),
            e = V(c.x, top + rise, far);
        b.tri(a, c, d, glass);
        b.tri(d, c, e, glass);
        b.box([length, rise, 90], [ox, top + rise / 2, far], metal);
        for (let j = 0; j <= 3; j++) {
            const px = a.x + (j * length) / 3;
            limb(b, V(px, a.y, near), V(px, d.y, far), 32, cap);
        }
    }
}

export function neonMarquee(k, x, ground, z, width) {
    const b = k.land,
        w = Math.min(6900, width * 0.73),
        y = ground + 4690;
    // An enamel marquee and the bent tubes that trace its waveform. The
    // housings remain legible by day, the two colours switch on at dusk.
    b.box([w, 1500, 260], [x, y, z], '#24393f');
    b.box([w + 120, 100, 420], [x, y + 770, z + 50], '#535e5d');
    const wave = [0, 0, 0.32, -0.15, 0.87, -0.72, 0.45, 0, 0],
        pitch = (w * 0.79) / (wave.length - 1);
    for (let i = 1; i < wave.length; i++) {
        const end = (n, dz) => V(x - w * 0.395 + n * pitch, y + wave[n] * 530, z + dz);
        limb(b, end(i - 1, 145), end(i, 145), 47, '#a7c9c4');
        limb(k.lights, end(i - 1, 183), end(i, 183), 33, '#62cfc6');
    }
    for (const side of [-1, 1]) {
        b.box([w * 0.9, 60, 60], [x, y + side * 600, z + 145], '#c98b71');
        k.lights.box([w * 0.9, 38, 35], [x, y + side * 600, z + 195], '#e5a07d');
    }
    b.light(x, y - 160, z + 1100, '#92d7cf', 4200, 0.25);
}

export function parasol(b, x, y, z) {
    const top = y + 2520,
        radius = 1470;
    pole(b, x, y, z, 2500, 29, '#827460');
    for (let n = 0; n < 12; n++) {
        const at = (angle, r, h) => V(x + Math.cos(angle) * r, h, z + Math.sin(angle) * r);
        const a = (n * Math.PI) / 6,
            c = a + Math.PI / 6,
            d = (a + c) * 0.5;
        const start = at(a, radius, top - 425),
            end = at(c, radius, top - 425),
            middle = at(d, radius * 1.02, top - 505);
        const ink = colour(n % 2 ? '#b78d62' : '#e0cfad');
        b.tri(V(x, top, z), start, middle, ink);
        b.tri(V(x, top, z), middle, end, ink);
        limb(b, V(x, top - 25, z), start, 13, '#997f62');
    }
    pole(b, x, top - 10, z, 70, 26, '#6e6759');
}

export function steppingStone(b, x, y, z, size, turn, hex) {
    const pigment = colour(hex),
        S = 6;
    const corner = i => {
        const a = turn + (i / S) * Math.PI * 2,
            r = size * [1, 0.91, 0.87, 1, 0.84, 0.96][i % S];
        return V(x + 1.24 * r * Math.cos(a), y + 38, z + r * 0.67 * Math.sin(a));
    };
    for (let i = 0; i < S; i++) {
        const a = corner(i),
            c = corner(i + 1),
            foot = a.clone();
        foot.y = y + 2;
        b.tri(V(x, y + 46, z), c, a, pigment);
        const otherFoot = c.clone();
        otherFoot.y = foot.y;
        const edge = pigment.clone().multiplyScalar(0.74);
        b.tri(a, c, foot, edge);
        b.tri(foot, c, otherFoot, edge);
    }
}

// Outer folds spread into the duff at the base of the grove's mature trees.
export function redwoodRoots() {
    // The buttresses are part of the trunk now (kit redwood: one modelled surface that spreads into the duff, its
    // foot in its own shade), so the separate triangular fins that stood here are gone. Kept for the scenes' calls.
}
