// The parts window scenery is built from (window-scenery.mjs): geometry with a colour per vertex and its daylight baked
// in, trees and planting, houses, city blocks, streets, and the lights that come on after dark.
//
// Everything is in a window's frame: millimetres, the wall at z = 0, the room on +z, outside on -z, x to the right of
// someone looking out, y up. Nothing here touches the room's lights or casts a shadow; there are no textures.
import * as THREE from 'three';

// The baked sun, in the window's frame: from above and a little from the room's side, so the faces seen from the room
// are lit (a view into backlit shade reads as a dark hole).
export const SUN = new THREE.Vector3(-.42, .78, .46).normalize();
export const rand = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const colour = hex => new THREE.Color(hex);      // (linear working values)
const smooth = THREE.MathUtils.smoothstep, point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
const flatGeometry = new WeakMap(), nonIndexed = g => { if (!g.index) return g; let n = flatGeometry.get(g); if (!n) { n = g.toNonIndexed(); flatGeometry.set(g, n); } return n; };
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), FN = new THREE.Vector3();

export const M = (x, y, z, sx = 1, sy = sx, sz = sx, turn = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), new THREE.Vector3(sx, sy, sz));

// Whether something at (x, z), `radius` across, can be seen through the openings from anywhere a room's cameras go:
// a wedge widening with distance (b.view, set from the openings when a world is built). Things outside it are skipped.
export const seen = (b, x, z, radius = 0) => !b.view || Math.abs(x - b.view.cx) - radius < b.view.half + Math.abs(z) * b.view.slope;

// Geometry with a colour per vertex. `tone` is the colour by day with the baked sun in it; `glow` is what the lights
// after dark put on the surface (added under the hour's `lamp`), from the point lights given with light().
export class Builder {
    constructor(sun = SUN) { this.position = []; this.tone = []; this.normal = []; this.lights = []; this.sun = sun; }
    get triangles() { return this.position.length / 9; }
    // geometry in place (matrix), coloured by shade(position, normal) -> Color. light: false takes the colour as it is
    // (already lit); facet: light each triangle by its own face (sprays of leaves, rocks).
    add(geometry, matrix, shade, { ambient = .6, light = true, facet = false, lumps = 0, dapple = 0, seed = 0 } = {}) {
        const g = nonIndexed(geometry), p = g.attributes.position, n = g.attributes.normal, sun = this.sun; normalMatrix.getNormalMatrix(matrix);
        for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i); normal.fromBufferAttribute(n, i);
            let patch = 0;
            if (lumps || dapple) { const { x, y, z } = point, w = Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 3.3 + seed * .6) + .55 * Math.sin(x * 6.3 + seed * 2.1) * Math.sin(y * 5.9 + seed) * Math.sin(z * 6.7 + seed * 1.3);
                patch = Math.sin(x * 9.1 + seed * 3) * Math.sin(y * 8.3 + seed) * Math.sin(z * 9.7 + seed * 2); point.addScaledVector(normal, w * lumps); }
            point.applyMatrix4(matrix);
            if (facet) { const t = i - i % 3; A.fromBufferAttribute(p, t).applyMatrix4(matrix); B.fromBufferAttribute(p, t + 1).applyMatrix4(matrix); C.fromBufferAttribute(p, t + 2).applyMatrix4(matrix);
                normal.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize(); if (!Number.isFinite(normal.x)) normal.set(0, 1, 0); }
            else normal.applyMatrix3(normalMatrix).normalize();
            const c = shade(point, normal), lit = light ? (ambient + (1 - ambient) * Math.max(0, normal.dot(sun)) + .05 * normal.y) * (1 + patch * dapple) : 1;
            this.position.push(point.x, point.y, point.z); this.tone.push(c.r * lit, c.g * lit, c.b * lit); this.normal.push(normal.x, normal.y, normal.z);
        }
        return this;
    }
    box(size, at, hex, vary = 0, r = null, options) { const c = typeof hex === 'string' ? colour(hex) : hex.clone(); if (vary && r) c.offsetHSL(0, 0, (r() - .5) * vary);
        return this.add(BOX, M(at[0], at[1], at[2], size[0], size[1], size[2]), () => c, options); }
    // a flat rectangle facing the room (+z): window glass, a lit window, a sign
    quad(w, h, at, hex, options) { const c = typeof hex === 'string' ? colour(hex) : hex; return this.add(QUAD, M(at[0], at[1], at[2], w, h, 1), () => c, { light: false, ...options }); }
    // one triangle, lit by its face (both sides: a leaf, a frond)
    tri(a, b, c, col, ambient = .55) {
        FN.crossVectors(E1.subVectors(b, a), E2.subVectors(c, a)).normalize(); if (FN.dot(this.sun) < 0) FN.negate();
        const lit = ambient + (1 - ambient) * Math.max(0, FN.dot(this.sun));
        for (const v of [a, b, c]) { this.position.push(v.x, v.y, v.z); this.tone.push(col.r * lit, col.g * lit, col.b * lit); this.normal.push(FN.x, FN.y, FN.z); }
    }
    // a light after dark: a pool of `hex` on what is within `radius` of (x, y, z)
    light(x, y, z, hex, radius = 6000, power = 1) { const c = colour(hex); this.lights.push([x, y, z, c.r * power, c.g * power, c.b * power, radius]); return this; }
    geometry() {
        const n = this.position.length, glow = new Float32Array(n), P = this.position, N = this.normal;
        for (const [lx, ly, lz, r, g, b, R] of this.lights) {
            const R2 = R * R;
            for (let i = 0; i < n; i += 3) {
                const dx = lx - P[i]; if (dx > R || dx < -R) continue; const dz = lz - P[i + 2]; if (dz > R || dz < -R) continue; const dy = ly - P[i + 1], d2 = dx * dx + dy * dy + dz * dz; if (d2 >= R2) continue;
                const d = Math.sqrt(d2) || 1, f = (1 - d2 / R2) ** 2 * Math.max(.18, (N[i] * dx + N[i + 1] * dy + N[i + 2] * dz) / d);
                glow[i] += r * f; glow[i + 1] += g * f; glow[i + 2] += b * f;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('tone', new THREE.Float32BufferAttribute(this.tone, 3)); geo.setAttribute('glow', new THREE.BufferAttribute(glow, 3));
        geo.computeBoundingSphere(); return geo;
    }
}

// Soft glows around lamps after dark: quads that face the camera (the shader turns them), one colour each.
export class Halos {
    constructor() { this.position = []; this.corner = []; this.tone = []; this.size = []; }
    add(x, y, z, size, hex, strength = 1) { const c = colour(hex).multiplyScalar(strength);
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { this.position.push(x, y, z); this.corner.push(u, v); this.tone.push(c.r, c.g, c.b); this.size.push(size); }
        return this; }
    geometry() { const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3)); g.setAttribute('corner', new THREE.Float32BufferAttribute(this.corner, 2));
        g.setAttribute('tone', new THREE.Float32BufferAttribute(this.tone, 3)); g.setAttribute('size', new THREE.Float32BufferAttribute(this.size, 1));
        g.computeBoundingSphere(); return g; }
}

// ---- shapes
export const BOX = new THREE.BoxGeometry(1, 1, 1), QUAD = new THREE.PlaneGeometry(1, 1);
const SPRAY = new THREE.TetrahedronGeometry(1, 0), CORE = new THREE.IcosahedronGeometry(1, 2), CORE_FAR = new THREE.IcosahedronGeometry(1, 1), BLOOM = new THREE.TetrahedronGeometry(1, 0), ROCK = new THREE.IcosahedronGeometry(1, 0);
const STEM = new THREE.CylinderGeometry(.72, 1, 1, 7, 1, true).translate(0, .5, 0), POLE = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, .5, 0);
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion(), euler = new THREE.Euler(), at = new THREE.Vector3(), scale = new THREE.Vector3(), m4 = new THREE.Matrix4();

// A tapered limb (or pole) from a to b, radius r at a.
export function limb(b, a, end, radius, hex, { geometry = STEM, ambient = .5 } = {}) {
    const dir = new THREE.Vector3().subVectors(end, a), len = dir.length(); if (len < 1) return;
    q.setFromUnitVectors(Y, dir.divideScalar(len)); m4.compose(a, q, scale.set(radius, len, radius));
    const c = typeof hex === 'string' ? colour(hex) : hex; b.add(geometry, m4, () => c, { ambient });
}
export const pole = (b, x, y0, z, height, radius, hex) => limb(b, new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y0 + height, z), radius, hex, { geometry: POLE });

// How big a spray of leaves is drawn at a distance from the window (a near tree has small ones, a far one big ones):
// the detail goes where the eye can see it.
export const spray = z => 75 + Math.abs(z) * .012;

const WARM = colour('#e8e0a0'), COOL = colour('#5f7488'), cl = new THREE.Color(), shadeOut = new THREE.Color();
// A crown of leaves: sprays inside an ellipsoid, most of them near its surface, the outline pushed in and out in lobes,
// lit as one volume (lighter and warmer toward the sun, darker inside and underneath), so it reads as foliage with
// sky between the sprays, not as a ball. The side facing away from the room is mostly left out (it is not seen).
export function crown(b, r, cx, cy, cz, rx, ry, rz, hex, { size = spray(cz), density = 1, lobes = .32, flat = .5, light = 1, under = .5, core = .78 } = {}) {
    const base = colour(hex), sun = b.sun, seed = r() * 100, p = 1.6;
    const lobeAt = (dx, dy, dz) => 1 + lobes * (1.5 * Math.sin(dx * 3.1 + seed) * Math.sin(dy * 2.9 + seed * 1.3) * Math.sin(dz * 3.3 + seed * .7) + .45 * Math.sin(dx * 7 + dy * 5 + seed));
    const volume = (nx, ny, nz, k) => { const s = nx * sun.x + ny * sun.y + nz * sun.z, wrap = .5 + .5 * s; return [s, (.3 + .85 * wrap * wrap) * (.4 + .6 * smooth(k, .3, 1.05)) * (.8 + .2 * (ny * .5 + .5)) * light]; };
    // the mass: a lumpy body inside the sprays, so the crown has weight where the sprays thin out
    if (core) {
        const geometry = size > 260 ? CORE_FAR : CORE, dark = base.clone();
        m4.compose(at.set(cx, cy, cz), q.set(0, 0, 0, 1), scale.set(rx * core, ry * core, rz * core));
        b.add(geometry, m4, (pt, nr) => { const [s, l] = volume(nr.x, nr.y, nr.z, core); return shadeOut.copy(dark).multiplyScalar(l * .92).lerp(COOL, s < 0 ? -s * .05 : 0); }, { light: false, lumps: .14 * (1 + lobes), seed });
    }
    const area = 4 * Math.PI * (((rx * ry) ** p + (rx * rz) ** p + (ry * rz) ** p) / 3) ** (1 / p), n = Math.round(area / (size * size) * (core ? .42 : .5) * density);
    for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
        let dx = r() * 2 - 1, dy = r() * 2 - 1, dz = r() * 2 - 1; const l = Math.hypot(dx, dy, dz); if (l > 1 || l < .08) continue;
        dx /= l; dy /= l; dz /= l; i++;
        if (dz < -.25 && r() < .75) continue;                    // the far side: barely seen
        if (dy < -.35 && r() < under) continue;                  // thin underneath
        const k = (core ? core * .95 + (1.06 - core * .95) * Math.pow(r(), .6) : Math.pow(r(), .28)) * lobeAt(dx, dy, dz), px = cx + dx * rx * k, py = cy + dy * ry * k, pz = cz + dz * rz * k;
        let nx = dx / rx, ny = dy / ry, nz = dz / rz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const [s, lum] = volume(nx, ny, nz, k);
        cl.copy(base).offsetHSL((r() - .5) * .03, (r() - .5) * .08, (r() - .5) * .045);
        const out = new THREE.Color().copy(cl).multiplyScalar(lum);
        if (s > .25) out.lerp(WARM.clone().multiplyScalar(out.r + out.g + out.b), (s - .25) * .1); else out.lerp(COOL.clone().multiplyScalar((out.r + out.g + out.b) * .9), (.25 - s) * .1);
        const sc = size * (.6 + r() * .8);
        euler.set(r() * 6.28, r() * 6.28, r() * 6.28); q.setFromEuler(euler); m4.compose(at.set(px, py, pz), q, scale.set(sc, sc * flat, sc * (.75 + r() * .5)));
        b.add(SPRAY, m4, (pt, nr) => shadeOut.copy(out).multiplyScalar(.9 + .16 * Math.max(0, nr.dot(sun))), { light: false, facet: true });
    }
}

// A broadleaf tree: a trunk forking into limbs, a crown of several masses (gaps between them), grounded at `ground`.
// shape: 'round', 'tall' (narrow, upright), 'spreading' (wide, low), 'ornamental' (small, light).
export function tree(b, r, x, ground, z, { height = 6000, spread, hex = '#62804f', bark = '#5e5046', shape = 'round', density = 1, size } = {}) {
    if (!seen(b, x, z, 8000)) return;
    const wide = { round: .36, tall: .24, spreading: .48, ornamental: .4 }[shape] ?? .36, R = height * (spread ?? wide), fork = height * (shape === 'tall' ? .28 : shape === 'spreading' ? .32 : .38);
    const lean = (r() - .5) * height * .05, base = new THREE.Vector3(x, ground - 100, z), top = new THREE.Vector3(x + lean, ground + fork, z + (r() - .5) * height * .03), trunkR = height * (shape === 'ornamental' ? .016 : .022);
    const barkC = colour(bark); limb(b, base, top, trunkR, barkC);
    const cy = ground + fork + (height - fork) * .5, masses = 3 + Math.floor(r() * 3), sz = size ?? spray(z);
    for (let i = 0; i < masses; i++) {
        const a = i / masses * 6.28 + r() * .9, off = R * (.32 + .22 * r()), rr = R * (.48 + .22 * r()), up = (r() - .35) * R * .55;
        const c = new THREE.Vector3(x + lean + Math.cos(a) * off, cy + up, z + Math.sin(a) * off * .8);
        limb(b, top, new THREE.Vector3().lerpVectors(top, c, .75), trunkR * .5, barkC);
        crown(b, r, c.x, c.y, c.z, rr * 1.05, rr * (shape === 'tall' ? 1.25 : .82), rr, hex, { size: sz, density });
    }
    crown(b, r, x + lean, cy + R * .3, z, R * .62, R * (shape === 'tall' ? 1.1 : .62), R * .6, hex, { size: sz, density });
}

// A conifer (fir, spruce, pine): whorls of drooping branches, each a line of flat sprays, on a straight trunk.
export function conifer(b, r, x, ground, z, { height = 8000, width = .34, hex = '#3d5c4a', bark = '#4f4038', size, density = 1, start = .1 } = {}) {
    if (!seen(b, x, z, 8000)) return;
    const sun = b.sun, base = colour(hex), sz = size ?? spray(z) * 1.1;
    limb(b, new THREE.Vector3(x, ground - 100, z), new THREE.Vector3(x, ground + height * .97, z), height * .012, bark);
    const whorls = Math.round(10 + height / 1500);
    for (let w = 0; w < whorls; w++) {
        const t = start + (1 - start) * (w + r() * .6) / whorls, y = ground + height * t, R = height * width * .5 * Math.pow(1 - t, .9) + sz * .4;
        const count = Math.max(3, Math.round(5 + R / 900)), turn = r() * 6.28;
        for (let k = 0; k < count; k++) {
            const a = turn + k / count * 6.28 + (r() - .5) * .6, ca = Math.cos(a), sa = Math.sin(a); if (sa < -.6 && r() < .7) continue;
            const L = R * (.75 + r() * .4), steps = Math.max(2, Math.round(L / (sz * .75)));
            for (let j = 1; j <= steps; j++) {
                const f = j / steps, px = x + ca * L * f, pz = z + sa * L * f, py = y - L * f * f * .32 + (r() - .5) * sz * .3;
                const light = (.36 + .7 * (.5 + .5 * (ca * sun.x + .5 * sun.y + sa * sun.z)) ** 2) * (.55 + .45 * f) * (.85 + .25 * t);
                const c = base.clone().offsetHSL((r() - .5) * .03, (r() - .5) * .08, (r() - .5) * .06).multiplyScalar(light), sc = sz * (.7 + r() * .5);
                q.setFromAxisAngle(Y, -a); euler.set((r() - .5) * .5, -a + (r() - .5) * .6, (r() - .5) * .5); q.setFromEuler(euler);
                m4.compose(at.set(px, py, pz), q, scale.set(sc * 1.25, sc * .32 * density, sc * .85));
                b.add(SPRAY, m4, (pt, nr) => shadeOut.copy(c).multiplyScalar(.82 + .28 * Math.max(0, nr.dot(sun))), { light: false, facet: true });
            }
        }
    }
}

// A coast redwood: a massive straight red-brown trunk, furrowed, and short drooping sprays that start high; seen from
// the ground the crown runs off the top of the window and the trunks are what you see.
export function redwood(b, r, x, ground, z, { height = 42000, girth = 1.0, hex = '#4a5c3c', bark = '#6a4a3c', size, start = .32 } = {}) {
    if (!seen(b, x, z, 8000)) return;
    const sun = b.sun, R0 = 650 * girth, barkC = colour(bark), dark = barkC.clone().multiplyScalar(.6), out = new THREE.Color(), seed = r() * 50;
    // the trunk: a fluted, tapering column; the bark's furrows in the colour
    const trunk = new THREE.CylinderGeometry(R0 * .28, R0, height, 12, 8, true).translate(0, height / 2, 0);
    b.add(trunk, M(x, ground - 200, z), (p, n) => { const a = Math.atan2(n.z, n.x), f = .5 + .5 * Math.sin(a * 9 + seed + p.y * .0002);
        return out.copy(dark).lerp(barkC, .45 + .55 * f * f).multiplyScalar(.9 + .1 * Math.sin(p.y * .003 + seed)); }, { ambient: .52 });
    // a buttressed foot
    b.add(new THREE.ConeGeometry(R0 * 1.55, R0 * 2.2, 10, 1, true).translate(0, R0 * 1.1, 0), M(x, ground - 60, z, 1, 1, 1, seed), () => barkC.clone().multiplyScalar(.82), { ambient: .5 });
    // sprays high above the window's sight lines are never seen (from a ground floor the view tops out near 40 degrees)
    const base = colour(hex), sz = size ?? spray(z) * 1.2, tiers = Math.round(12 + height / 4000), sightTop = ground + 5000 + Math.abs(z) * .85;
    for (let w = 0; w < tiers; w++) {
        const t = start + (1 - start) * w / tiers, y = ground + height * t; if (y > sightTop) break;
        const R = (1600 + 3400 * Math.sin(Math.PI * Math.min(1, (t - start) / (1 - start) * 1.1))) * girth * (.7 + r() * .5);
        const count = 4 + Math.floor(r() * 3);
        for (let k = 0; k < count; k++) {
            const a = r() * 6.28, ca = Math.cos(a), sa = Math.sin(a); if (sa < -.5 && r() < .7) continue;
            const L = R * (.6 + r() * .5), steps = Math.max(2, Math.round(L / (sz * .5)));
            for (let j = 1; j <= steps; j++) {
                const f = j / steps, px = x + ca * (R0 * .5 + L * f), pz = z + sa * (R0 * .5 + L * f), py = y - L * f * .28 + f * f * L * .18 - (r() * .6) * sz;
                const light = (.32 + .7 * (.5 + .5 * (ca * sun.x + .4 * sun.y + sa * sun.z)) ** 2) * (.6 + .4 * f);
                const c = base.clone().offsetHSL((r() - .5) * .03, (r() - .5) * .08, (r() - .5) * .07).multiplyScalar(light), sc = sz * (.7 + r() * .6);
                euler.set((r() - .5) * .6, -a + (r() - .5) * .8, .35 + (r() - .5) * .5); q.setFromEuler(euler);
                m4.compose(at.set(px, py, pz), q, scale.set(sc * 1.7, sc * .6, sc * 1.2));
                b.add(SPRAY, m4, (pt, nr) => shadeOut.copy(c).multiplyScalar(.82 + .28 * Math.max(0, nr.dot(sun))), { light: false, facet: true });
            }
        }
    }
}

// A fan palm (the tall, thin Washingtonia of Southern California): a slim grey trunk with a slight curve, a skirt of
// dead fronds under a small head of fan leaves high up.
export function fanPalm(b, r, x, ground, z, { height = 18000, hex = '#6f8452', skirt = '#8a7357' } = {}) {
    if (!seen(b, x, z, 8000)) return;
    const bend = new THREE.Vector3((r() - .5) * height * .06, 0, (r() - .5) * height * .03), barkC = colour('#8b7f72'), segs = 6;
    let prev = new THREE.Vector3(x, ground - 100, z);
    for (let i = 1; i <= segs; i++) { const t = i / segs, p = new THREE.Vector3(x + bend.x * t * t, ground + height * t, z + bend.z * t * t);
        limb(b, prev, p, 260 - t * 60, barkC.clone().multiplyScalar(.85 + .15 * ((i % 2))), { geometry: POLE }); prev = p; }
    const head = prev.clone(), sun = b.sun;
    // the skirt: brown sprays hanging under the head
    for (let k = 0; k < 70; k++) { const a = r() * 6.28, h = r(), R = 420 + 380 * (1 - h);
        const c = colour(skirt).offsetHSL(0, 0, (r() - .5) * .08).multiplyScalar(.55 + .45 * (.5 + .5 * Math.cos(a - 2.2)));
        euler.set(0, -a, 0); q.setFromEuler(euler); m4.compose(at.set(head.x + Math.cos(a) * R, head.y - 300 - h * 2600, head.z + Math.sin(a) * R), q, scale.set(260, 900, 260));
        b.add(SPRAY, m4, () => c, { light: false }); }
    // fan leaves: flat wedges radiating from the head, held up and out, the lower ones drooping
    const base = colour(hex);
    for (let k = 0; k < 26; k++) {
        const a = r() * 6.28, tilt = -.7 + r() * 1.7, len = 1300 + r() * 500, dir = new THREE.Vector3(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt));
        const stalk = head.clone().addScaledVector(dir, len * .55), side = new THREE.Vector3().crossVectors(dir, Y).normalize(); if (side.lengthSq() < .1) side.set(1, 0, 0);
        const up = new THREE.Vector3().crossVectors(side, dir).normalize(), c = base.clone().offsetHSL((r() - .5) * .03, 0, (r() - .5) * .08);
        for (let s = 0; s < 7; s++) { const u0 = (s / 7 - .5) * 2.1, u1 = ((s + 1) / 7 - .5) * 2.1;
            const tip = d => stalk.clone().addScaledVector(dir, Math.cos(d) * len * .55).addScaledVector(side, Math.sin(d) * len * .55).addScaledVector(up, -Math.abs(d) * 120);
            b.tri(stalk, tip(u0), tip(u1), c.clone().multiplyScalar(s % 2 ? .9 : 1), .5); }
        limb(b, head, stalk, 40, '#6b6450', { geometry: POLE });
    }
    void sun;
}

// A feather palm (queen or Canary palm): arching fronds of leaflets on a shorter, stouter trunk.
export function featherPalm(b, r, x, ground, z, { height = 7000, hex = '#5f7d48', fronds = 18, trunk = '#8e877c', stout = 1 } = {}) {
    if (!seen(b, x, z, 8000)) return;
    const top = new THREE.Vector3(x + (r() - .5) * 600, ground + height, z + (r() - .5) * 300), barkC = colour(trunk);
    limb(b, new THREE.Vector3(x, ground - 100, z), top, 170 * stout, barkC);
    b.add(SPRAY, M(top.x, top.y - 200, top.z, 300 * stout, 600, 300 * stout), () => barkC.clone().multiplyScalar(.75), { light: false });
    const base = colour(hex);
    for (let k = 0; k < fronds; k++) {
        const a = k / fronds * 6.28 + r() * .3, rise = .3 + r() * .9, len = 2800 + r() * 1200, out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        const c = base.clone().offsetHSL((r() - .5) * .03, 0, (r() - .5) * .09), spine = [];
        for (let i = 0; i <= 9; i++) { const t = i / 9; spine.push(top.clone().addScaledVector(out, len * t).add(new THREE.Vector3(0, len * (rise * t - (rise + .55) * t * t), 0))); }
        for (let i = 1; i < spine.length; i++) {
            const p = spine[i], prev = spine[i - 1], leaf = len * .2 * Math.sin(Math.PI * Math.min(1, i / 9 * 1.1)) + 120;
            for (const s of [-1, 1]) { const tip = p.clone().addScaledVector(side, s * leaf).add(new THREE.Vector3(0, -leaf * .55, 0)).addScaledVector(out, -leaf * .15);
                b.tri(prev, p, tip, c.clone().multiplyScalar(i % 2 ? 1 : .88), .5); }
        }
    }
}

// Low planting: a shrub (a small crown sitting on the ground), a clipped hedge, flowers in a bed, grass tufts.
export const shrub = (b, r, x, ground, z, radius, hex, options = {}) => seen(b, x, z, radius) && crown(b, r, x, ground + radius * .62, z, radius * 1.1, radius * .72, radius, hex, { size: Math.min(spray(z), radius * .55), under: .9, ...options });
export function hedge(b, r, x0, x1, ground, z, height, depth, hex, { size } = {}) {
    const sz = size ?? spray(z) * .9;
    for (let x = x0; x < x1; x += depth * 1.1) { const w = Math.min(depth * 1.3, x1 - x);
        crown(b, r, x + w / 2, ground + height / 2, z, w * .62, height * .55, depth * .55, hex, { size: sz, lobes: .12, under: 1 }); }
}
const BLOOMS = ['#d394a8', '#dba266', '#efe8d8', '#9d8fc4', '#cf7676', '#e3cf74'];
export function flowers(b, r, x, y, z, radius, count, palette = BLOOMS, size = 26) {
    for (let k = 0; k < count; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * radius, c = colour(palette[Math.floor(r() * palette.length)]).multiplyScalar(.82 + r() * .2);
        euler.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(euler); m4.compose(at.set(x + Math.cos(a) * d, y + r() * radius * .35, z + Math.sin(a) * d), q, scale.setScalar(size * (.7 + r() * .6)));
        b.add(BLOOM, m4, () => c, { light: false }); }
}
// blades of grass (a few triangles each) in a strip near the window, where a mown plane would look like carpet
export function grass(b, r, x0, x1, z0, z1, ground, count, hex = '#6f8758', height = 260) {
    const base = colour(hex), a = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
    for (let k = 0; k < count; k++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), h = height * (.5 + r() * .8), turn = r() * 6.28, lean = (r() - .5) * .5, w = 18 + r() * 14;
        a.set(x - Math.cos(turn) * w, ground, z - Math.sin(turn) * w); c.set(x + Math.cos(turn) * w, ground, z + Math.sin(turn) * w); t.set(x + lean * h * .4, ground + h, z + lean * h * .2);
        b.tri(a, c, t, base.clone().offsetHSL((r() - .5) * .04, 0, (r() - .5) * .1), .6); }
}
export const rock = (b, r, x, y, z, size, hex = '#8f8a80') => { euler.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(euler); m4.compose(at.set(x, y, z), q, scale.set(size * (1 + r() * .5), size * .6, size)); const c = colour(hex).offsetHSL(0, 0, (r() - .5) * .08); b.add(ROCK, m4, () => c, { facet: true, ambient: .55 }); };

// ---- ground: a big plane coloured by fill(x, z) -> Color (lawn, gravel, paving, roads)
export function ground(b, y, x0, x1, z0, z1, step, fill, ambient = .72) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.round((x1 - x0) / step)), Math.max(1, Math.round((z1 - z0) / step))).rotateX(-Math.PI / 2);
    b.add(geo, M((x0 + x1) / 2, y, (z0 + z1) / 2), p => fill(p.x, p.z), { ambient }); geo.dispose();
}
// far ground: a band of hills or forest along the horizon, its top a noisy ridge line
export function ridge(b, r, z, y0, x0, x1, height, hex, { step = 1500, rough = .35, bumps = 3 } = {}) {
    const c = colour(hex), seed = r() * 40, a = new THREE.Vector3(), bb = new THREE.Vector3(), cc = new THREE.Vector3(), d = new THREE.Vector3();
    const top = x => y0 + height * (.62 + .25 * Math.sin(x / 9000 * bumps + seed) + .13 * Math.sin(x / 2300 + seed * 2) * rough * 2 + rough * .12 * Math.sin(x / 700 + seed));
    for (let x = x0; x < x1; x += step) { a.set(x, y0 - 400, z); bb.set(x + step, y0 - 400, z); cc.set(x + step, top(x + step), z); d.set(x, top(x), z);
        const shade = c.clone().multiplyScalar(.9 + .1 * Math.sin(x / 3100 + seed));
        b.tri(a, bb, cc, shade, 1); b.tri(a, cc, d, shade, 1); }
}

// ---- built things
// A house: walls, a pitched roof along x, windows on the face toward the room (dark glass by day; `lit` ones glow
// after dark), a door with a porch light.
export function house(k, r, x, ground, z, { width = 9000, depth = 7000, eaves = 5600, ridge: rise = 2600, wall = '#d6cab5', roof = '#96705e', lit = [1, 4], porch = true, storeys = 2 } = {}) {
    if (!seen(k.land, x, z, width / 2 + 3000)) return;
    const { land: b, lights } = k;
    b.box([width, eaves, depth], [x, ground + eaves / 2, z], wall);
    const shape = new THREE.Shape(); shape.moveTo(-depth / 2 - 350, 0); shape.lineTo(0, rise); shape.lineTo(depth / 2 + 350, 0); shape.closePath();
    const prism = new THREE.ExtrudeGeometry(shape, { depth: width + 500, bevelEnabled: false }), c = colour(roof), gable = colour(wall).multiplyScalar(.93);
    b.add(prism, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x - width / 2 - 250, ground + eaves, z), (p, n) => Math.abs(n.x) > .9 ? gable : c.clone().multiplyScalar(.92 + .08 * Math.sin(p.y * .02)), { facet: true }); prism.dispose();
    b.box([520, 1500, 520], [x + width * .28, ground + eaves + rise * .8, z - depth * .12], '#8e7767');
    const face = z + depth / 2, frame = '#efe8dc'; let n = 0;
    for (const level of storeys > 1 ? [1500, 4150] : [1500]) for (const u of [-.32, 0, .32]) {
        const wx = x + u * width, wy = ground + level, door = level < 2000 && u === 0;
        if (door) { b.box([1050, 2150, 40], [wx, ground + 1075, face + 20], '#6d5a4c');
            if (porch) { lights.box([140, 200, 40], [wx + 800, ground + 2250, face + 60], '#ffd9a0'); k.halos.add(wx + 800, ground + 2250, face + 120, 650, '#ffcf8f', .55); b.light(wx + 800, ground + 2200, face + 700, '#ffc98a', 3200, .5); }
            n++; continue; }
        b.box([1350, 1450, 30], [wx, wy, face + 15], frame); b.quad(1190, 1290, [wx, wy, face + 32], colour('#4d5c68').multiplyScalar(.8 + .25 * (level > 2000)));
        if (lit.includes(n)) { lights.quad(1190, 1290, [wx, wy, face + 46], n % 2 ? '#ffd29a' : '#ffe2b6'); b.light(wx, wy - 400, face + 1500, '#ffd8a0', 2600, .35); }
        n++;
    }
}

// A block of a city: a box of `floors` storeys, its face toward the room (+z) a grid of windows (and its side, when it
// shows), a cornice, a ground floor of shops. litRate: the share of windows lit after dark.
// material ('brick', 'stone', 'render', 'panel') gives the face its make: the wall's tone, string courses and pilasters,
// windows set in a shadowed reveal with sills (and heads on brick), a stepped cornice or a parapet, signs over the
// shops, things on the roof. Without it the face is plain (far blocks, campus buildings).
const MAKES = {
    brick: { walls: ['#946655', '#8a5d4d', '#a07462', '#7f5a4c'], trim: '#d2c8b4', courses: 1, pilasters: true, heads: true },
    stone: { walls: ['#c9bda6', '#bdb19b', '#cfc5b2'], trim: '#e0d8c6', courses: 1, pilasters: true, heads: false },
    render: { walls: ['#d3ccbf', '#b9b3a8', '#c7bfae', '#a5a9a7'], trim: '#e4ded2', courses: 2, pilasters: false, heads: false },
    panel: { walls: ['#77787a', '#6c6f72', '#86837d'], trim: '#5b5d60', courses: 1, pilasters: false, heads: false }
};
const SIGNS = ['#5c3a34', '#2f4c4a', '#353f55', '#7a6a3e', '#4a4a4c', '#6d4f3a'];
const TANK = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
export function building(k, r, x, ground, z, { width = 16000, depth = 14000, floors = 6, storey = 3200, wall = '#b9ab97', glass = '#3e4a55', frame = '#d9d2c4', bays, litRate = .35, shops = true, side = 0, style = 'punched', cornice = true, warm = .7, neon = null, skip = 0, fins = null, roof = null, material = null } = {}) {
    if (!seen(k.land, x, z, width / 2 + 3000)) return 0;
    const make = material && MAKES[material], { land: b, lights, halos } = k, base = shops ? 600 : 0, height = floors * storey + base, face = z + depth / 2;
    const wallC = colour(make ? make.walls[Math.floor(r() * make.walls.length)] : wall).offsetHSL(0, 0, (r() - .5) * .05), trim = make ? colour(make.trim).offsetHSL(0, 0, (r() - .5) * .04) : colour(frame);
    b.box([width, height, depth], [x, ground + height / 2, z], wallC);
    if (cornice) { b.box([width + 300, 380, 500], [x, ground + height - 190, face - 100], trim);
        if (make && material !== 'panel' && material !== 'render') b.box([width + 600, 160, 760], [x, ground + height - 20, face - 230], trim); }
    else if (make) b.box([width, 700, 200], [x, ground + height + 350, face - 100], wallC.clone().multiplyScalar(.92));     // a parapet
    if (roof) b.box([width + 1200, 450, depth + 1200], [x, ground + height + 225, z], roof);
    const n = bays ?? Math.max(2, Math.round(width / 3200)), bay = width / n, glassC = colour(glass);
    const litColours = ['#ffd9a3', '#ffe4bd', '#fff0d6', '#f6d8b0', '#d9e4f0'], wFrac = .42 + r() * .16, hFrac = .5 + r() * .12, reveal = wallC.clone().multiplyScalar(.62);
    if (make) {
        for (let f = shops ? 1 : 0; f < floors; f += make.courses) b.box([width + 120, 140, 160], [x, ground + base + f * storey + 70, face + 80], trim);
        if (make.pilasters) for (let i = 0; i <= n; i += 2) b.box([300, height - base - (shops ? 3800 - base : 0), 140], [x - width / 2 + bay * i, ground + (height + (shops ? 3800 : 0)) / 2, face + 70], trim.clone().multiplyScalar(.96));
    }
    for (let f = shops ? 1 : 0; f < floors; f++) {
        const y = ground + base + f * storey + storey * .52;
        if (style === 'band') {   // a curtain wall: one band of glass per floor
            b.quad(width - 400, storey * .62, [x, y, face + 12], glassC.clone().multiplyScalar(.85 + .3 * (f / floors)));
            for (let i = 0; i < n; i++) if (r() < litRate) lights.quad(bay * .8, storey * .5, [x - width / 2 + bay * (i + .5), y, face + 22], litColours[Math.floor(r() * (r() < warm ? 4 : 5))]);
            continue;
        }
        for (let i = 0; i < n; i++) {
            if (skip && r() < skip) continue;
            const wx = x - width / 2 + bay * (i + .5), ww = bay * (make ? wFrac : .52), wh = storey * (make ? hFrac : .56), g = glassC.clone().multiplyScalar(.75 + r() * .4 + .25 * (f / floors));
            if (make) { b.box([ww + 140, wh + 140, 30], [wx, y, face + 15], reveal); b.quad(ww, wh, [wx, y, face + 34], g);
                b.box([ww + 260, 90, 170], [wx, y - wh / 2 - 60, face + 85], trim); if (make.heads) b.box([ww + 240, 170, 60], [wx, y + wh / 2 + 120, face + 30], trim); }
            else { b.box([ww + 160, wh + 160, 40], [wx, y, face + 20], frame); b.quad(ww, wh, [wx, y, face + 44], g); }
            if (r() < litRate) { const lc = colour(litColours[Math.floor(r() * (r() < warm ? 4 : 5))]).multiplyScalar(.6 + r() * .45); lights.quad(ww, wh * (r() < .3 ? .55 : 1), [wx, y, face + (make ? 46 : 56)], lc); }
        }
    }
    if (fins) { const n2 = (bays ?? Math.max(2, Math.round(width / 3200))) * 2; for (let i = 0; i <= n2; i++) b.box([180, height - 300, 420], [x - width / 2 + width * i / n2, ground + (height - 300) / 2, face + 210], fins, .08, r); }
    if (side) { const sx = x + side * width / 2, sideN = Math.max(1, Math.round(depth / 3600));
        for (let f = shops ? 1 : 0; f < floors; f++) for (let i = 0; i < sideN; i++) {
            const y = ground + base + f * storey + storey * .52, wz = z - depth / 2 + depth / sideN * (i + .5);
            b.add(QUAD, new THREE.Matrix4().compose(at.set(sx + side * 30, y, wz), q.setFromAxisAngle(Y, side * Math.PI / 2), scale.set(depth / sideN * .5, storey * .55, 1)), () => glassC, { light: false });
            if (r() < litRate * .8) lights.add(QUAD, new THREE.Matrix4().compose(at.set(sx + side * 45, y, wz), q.setFromAxisAngle(Y, side * Math.PI / 2), scale.set(depth / sideN * .5, storey * .55, 1)), () => colour('#ffdcaa'));
        } }
    if (shops) {   // a ground floor of shopfronts: glass, a fascia with its sign, an awning or a hanging sign, lit after dark
        const sh = 3800;
        for (let i = 0; i < n; i++) { const wx = x - width / 2 + bay * (i + .5), sign = colour(SIGNS[Math.floor(r() * SIGNS.length)]).offsetHSL(0, 0, (r() - .5) * .05);
            b.quad(bay * .78, sh * .62, [wx, ground + sh * .4, face + 30], glassC.clone().multiplyScalar(.7));
            b.box([bay * .92, 520, 140], [wx, ground + sh * .82, face + 70], make ? sign : frame);
            if (make) b.quad(bay * .5, 220, [wx, ground + sh * .82, face + 142], trim.clone().multiplyScalar(.95));
            if (r() < .45) { const aw = colour(['#7a4b3e', '#3f5a54', '#5a5a6e', '#8a7a52', '#6b6f62'][Math.floor(r() * 5)]);
                b.add(BOX, new THREE.Matrix4().compose(at.set(wx, ground + sh * .7, face + 650), q.setFromAxisAngle(X, .35), scale.set(bay * .82, 60, 1250)), () => aw, { ambient: .6 });
                b.box([bay * .82, 260, 40], [wx, ground + sh * .7 - 270, face + 1230], aw.clone().multiplyScalar(.85)); }
            else if (make && r() < .35) { b.box([60, 700, 600], [wx + bay * .4, ground + sh + 300, face + 420], sign); b.box([40, 900, 40], [wx + bay * .4, ground + sh + 750, face + 120], '#3c3e40'); }
            if (r() < .8) { lights.quad(bay * .74, sh * .55, [wx, ground + sh * .4, face + 42], colour('#ffe2b8').multiplyScalar(.5 + r() * .15)); b.light(wx, ground + 1600, face + 2200, '#ffd9a8', 3800, .32); }
            if (neon && r() < .7) { const nc = neon[Math.floor(r() * neon.length)]; lights.box([bay * .55, 260, 40], [wx, ground + sh + 500, face + 70], nc); halos.add(wx, ground + sh + 500, face + 300, bay * .55, nc, .35); b.light(wx, ground + sh, face + 2500, nc, 5000, .5); }
        } }
    // on the roof: a plant room, a water tank on legs, air-conditioning units, an aerial
    const top = ground + height;
    if (r() < .6) b.box([width * .3, 1800, depth * .3], [x + (r() - .5) * width * .4, top + 900, z - depth * .1], '#9a958d');
    if (make) {
        if (r() < .35) { const tx = x + (r() - .5) * width * .6, tz = z + depth * .1; b.add(TANK, M(tx, top + 3200, tz, 1300, 2600, 1300), () => colour('#7d6a58'), { ambient: .55 }); for (const [dx, dz] of [[-900, -900], [900, -900], [-900, 900], [900, 900]]) b.box([90, 1900, 90], [tx + dx, top + 950, tz + dz], '#4a4b4c'); }
        for (let i = 0, m = Math.floor(r() * 4); i < m; i++) b.box([1100, 800, 900], [x + (r() - .5) * width * .7, top + 400, face - 1500 - r() * 3000], '#a3a3a0');
        if (r() < .4) pole(b, x + (r() - .5) * width * .5, top, face - 2000, 3500, 35, '#58595b');
    }
    return height;
}

// A street lamp: a pole, an arm over the road, a head; after dark a lamp, a halo and a pool of light.
export function streetLamp(k, x, ground, z, { height = 6500, reach = 1200, hex = '#ffd6a0', face = 1, power = 1 } = {}) {
    if (!seen(k.land, x, z, 3000)) return;
    const { land: b, lights, halos } = k; pole(b, x, ground, z, height, 70, '#3c3e40');
    b.box([reach, 70, 70], [x, ground + height, z + face * reach / 2], '#3c3e40');
    b.box([520, 140, 260], [x, ground + height - 60, z + face * reach], '#2f3133');
    lights.box([440, 30, 200], [x, ground + height - 140, z + face * reach], hex);
    halos.add(x, ground + height - 200, z + face * reach, 1800, hex, .45 * power);
    b.light(x, ground + height - 300, z + face * reach, hex, 8500, .8 * power);
}
// A parked car: a body, a cabin with dark glass, wheels; its colour muted.
// A parked car: a body with a raked bonnet and boot, a glass cabin with its roof in the body's colour, wheels with
// hubs, lamps front and back; a few muted colours.
const profile = points => { const sh = new THREE.Shape(); sh.moveTo(...points[0]); for (const p of points.slice(1)) sh.lineTo(...p); sh.closePath(); return sh; };
const CAR_BODY = new THREE.ExtrudeGeometry(profile([[-2200, 280], [2200, 280], [2230, 520], [2150, 720], [1050, 860], [-1450, 900], [-2150, 820], [-2230, 560]]), { depth: 1, bevelEnabled: false }).translate(0, 0, -.5);
const CAR_CABIN = new THREE.ExtrudeGeometry(profile([[1050, 860], [250, 1400], [-1050, 1420], [-1650, 900]]), { depth: 1, bevelEnabled: false }).translate(0, 0, -.5);
const WHEEL = new THREE.CylinderGeometry(330, 330, 230, 10, 1).rotateX(Math.PI / 2), HUB = new THREE.CylinderGeometry(170, 170, 250, 8, 1).rotateX(Math.PI / 2);
const CAR_COLOURS = ['#4f545a', '#6d7176', '#2f3438', '#5e3c36', '#36475a', '#8d8a83', '#424b3f', '#6a5f52', '#7a2f2b', '#9a9890'];
export function car(k, r, x, ground, z, { turn = 0, hex } = {}) {
    if (!seen(k.land, x, z, 3000)) return;
    const b = k.land, body = colour(hex || CAR_COLOURS[Math.floor(r() * CAR_COLOURS.length)]), glass = colour('#262c32'), tyre = colour('#1b1b1d'), hub = colour('#8a8d90');
    const T = new THREE.Matrix4().makeTranslation(x, ground, z).multiply(new THREE.Matrix4().makeRotationY(turn)), sx = .95 + r() * .1;
    const put = (geometry, m, shade, options) => b.add(geometry, T.clone().multiply(m), shade, { ambient: .55, facet: true, ...options });
    put(CAR_BODY, M(0, 0, 0, sx, 1, 1780), () => body);
    put(CAR_CABIN, M(0, 0, 0, sx, 1, 1520), (p, n) => n.y > .8 ? body : glass);
    for (const wx of [-1380, 1320]) for (const wz of [-800, 800]) { put(WHEEL, M(wx * sx, 330, wz), () => tyre); put(HUB, M(wx * sx, 330, wz), () => hub); }
    put(BOX, M(2215 * sx, 640, 0, 30, 110, 1500), () => colour('#d8d4c8')); put(BOX, M(-2215 * sx, 700, 0, 30, 120, 1500), () => colour('#6e2a24'));
}
// A bench, a bollard, a bike rack, a bin: the furniture of paths and plazas.
export function bench(b, x, ground, z, turn = 0, hex = '#76624f') {
    const R = new THREE.Matrix4().makeRotationY(turn), put = (size, p, h) => b.add(BOX, new THREE.Matrix4().makeTranslation(x, ground, z).multiply(R).multiply(M(p[0], p[1], p[2], size[0], size[1], size[2])), (() => { const c = colour(h); return () => c; })());
    put([1600, 50, 420], [0, 450, 0], hex); put([1600, 380, 50], [0, 720, -200], hex); for (const s of [-680, 680]) put([60, 450, 400], [s, 225, 0], '#4a4a4c');
}
// A path light (a bollard with a lamp): dark by day, a soft pool after dark.
export function pathLight(k, x, ground, z, hex = '#ffdcae', power = .7) {
    k.land.box([150, 850, 150], [x, ground + 425, z], '#3d3e40'); k.lights.box([160, 140, 160], [x, ground + 800, z], hex);
    k.halos.add(x, ground + 820, z + 80, 420, hex, .4 * power); k.land.light(x, ground + 700, z, hex, 3000, power);
}
// A utility pole with its crossarm, and wires sagging to the next one.
export function utilityPole(k, x, ground, z, height = 10500) {
    const b = k.land; pole(b, x, ground, z, height, 140, '#6a5a4a'); b.box([2200, 120, 120], [x, ground + height - 600, z], '#5a4c3e');
    for (const s of [-900, 0, 900]) b.box([80, 160, 80], [x + s, ground + height - 460, z], '#ccc8c0');
}
export function wire(b, a, end, sag, hex = '#2b2b2b', radius = 18) {
    let prev = a.clone(); for (let i = 1; i <= 12; i++) { const t = i / 12, p = new THREE.Vector3().lerpVectors(a, end, t); p.y -= sag * 4 * t * (1 - t); limb(b, prev, p, radius, hex, { geometry: POLE }); prev = p; }
}
// A fence of boards (or pickets, or a chain-link run: thin posts and a grey veil).
export function fence(b, r, x0, x1, ground, z, { height = 1750, hex = '#9a7d62', kind = 'boards', gap } = {}) {
    if (kind === 'chain') { for (let x = x0; x <= x1; x += 2500) pole(b, x, ground, z, height + 100, 30, '#8c9094');
        // the mesh: two families of slanted wires (seen through, as chain-link is), only where the openings can see it
        b.box([x1 - x0, 30, 30], [(x0 + x1) / 2, ground + height, z], '#8c9094'); const wire = colour('#9aa0a4'), slant = Math.SQRT2 * height;
        for (let x = x0; x <= x1; x += 220) { if (!seen(b, x, z, 2000)) continue; for (const s of [-1, 1]) b.add(BOX, new THREE.Matrix4().compose(at.set(x, ground + height / 2, z), q.setFromAxisAngle(FWD, s * Math.PI / 4), scale.set(14, slant, 14)), () => wire, { ambient: .7 }); }
        return; }
    const step = gap ?? (kind === 'pickets' ? 140 : 150), w = kind === 'pickets' ? 85 : 138;
    for (let x = x0; x <= x1; x += step) b.box([w, height + (kind === 'pickets' ? 0 : Math.abs(x) % 450 === 0 ? 60 : 0), 26], [x, ground + height / 2, z], hex, .07, r);
    b.box([x1 - x0, 90, 40], [(x0 + x1) / 2, ground + height * .75, z - 30], hex); b.box([x1 - x0, 90, 40], [(x0 + x1) / 2, ground + height * .2, z - 30], hex);
    for (let x = x0; x <= x1; x += 2400) b.box([110, height + 150, 110], [x, ground + (height + 150) / 2, z - 60], '#7a614c');
}
// A wall of brick or stone: courses in the colour, a coping on top.
export function masonry(b, r, x0, x1, ground, z, height, hex = '#a0705a', { course = 150, coping = '#b8b0a2', thick = 300 } = {}) {
    const c = colour(hex), out = new THREE.Color(), seed = r() * 20;
    b.box([x1 - x0, height, thick], [(x0 + x1) / 2, ground + height / 2, z], c.clone().multiplyScalar(.92));
    // the face toward the room: courses and the odd darker brick in the colour
    const geo = new THREE.PlaneGeometry(x1 - x0, height, Math.max(1, Math.round((x1 - x0) / 600)), Math.max(1, Math.round(height / course)));
    b.add(geo, M((x0 + x1) / 2, ground + height / 2, z + thick / 2 + 4), p => { const row = Math.floor((p.y - ground) / course), v = Math.sin(row * 12.9898 + Math.floor(p.x / 600) * 78.233 + seed) * 43758.5453;
        return out.copy(c).multiplyScalar(.84 + .22 * (v - Math.floor(v))); }); geo.dispose();
    b.box([x1 - x0 + 60, 70, thick + 80], [(x0 + x1) / 2, ground + height + 35, z], coping);
}
