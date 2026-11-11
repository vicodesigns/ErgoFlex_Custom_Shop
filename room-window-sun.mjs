import * as THREE from 'three';

// Daylight a window lays on the floor. A room's floor is lit by one shared sun that does not know about windows; this
// is the patch the panes let in, reshaped for each daypart. It follows the sun the shared light rig uses for shadows
// (room-refinement.mjs DAY_ANGLES): long and low in the morning and evening, short at midday, none after dark.
//   near    where the patch starts, mm from the window wall
//   length  how far it reaches from there (cut short where the room is narrower)
//   skew    its slant along the wall over that reach (mm; negative towards the back of the room)
export const WINDOW_SUN = {
    morning: { near: 900, length: 2500, skew: -850, color: '#fff0d6', gain: .3 },
    afternoon: { near: 450, length: 1150, skew: 140, color: '#ffeccd', gain: .2 },
    evening: { near: 1500, length: 3400, skew: 1450, color: '#ffae72', gain: .2 },
    night: { near: 450, length: 1200, skew: 100, color: '#000000', gain: 0 },
    party: { near: 450, length: 1200, skew: 0, color: '#000000', gain: 0 }
};

// windowSun(parent, { x, inward, from, to, panes, span }) -> { mesh, set(daypart, accent) }
//   x, inward   the window wall's inner face (room mm) and which way the room lies from it (+1: the wall is on the left)
//   from, to    the window's extent along that wall (z, room mm); panes: how many panes it has
//   span        the room's width from that wall (the patch stops 400 mm short of the far wall)
//   hours       a table like WINDOW_SUN for a room whose dayparts differ (a daytime "party", a room with blinds drawn)
export function windowSun(parent, { x, inward = 1, from, to, panes = 2, span, y = 14, name = 'Window daylight patch', hours = WINDOW_SUN }) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const c = canvas.getContext('2d'), tw = canvas.width, th = canvas.height;
    c.filter = 'blur(6px)'; c.fillStyle = '#ffffff'; for (let i = 0; i < panes; i++) c.fillRect(i * tw / panes + 12, 14, tw / panes - 24, th - 28); c.filter = 'none';
    // (it fades into the room)
    c.globalCompositeOperation = 'destination-out'; const fade = c.createLinearGradient(0, th, 0, 0); fade.addColorStop(0, '#00000000'); fade.addColorStop(1, '#000000d0'); c.fillStyle = fade; c.fillRect(0, 0, tw, th);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map, color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(1, 1), mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 2; parent.add(mesh);
    const set = (daypart, accent = 1) => {
        const s = hours[daypart] || hours.afternoon || WINDOW_SUN.afternoon, pos = geometry.attributes.position, uv = geometry.attributes.uv, reach = Math.min(s.length, span - s.near - 400);
        mesh.visible = s.gain > 0 && reach > 300; if (!mesh.visible) return;
        for (let i = 0; i < pos.count; i++) { const u = uv.getX(i), v = uv.getY(i); pos.setXYZ(i, x + inward * (s.near + v * reach), y, from + 60 + u * (to - from - 120) + v * s.skew * inward * reach / s.length); }
        pos.needsUpdate = true; geometry.computeBoundingSphere(); material.color.set(s.color).multiplyScalar(s.gain * accent);
    };
    return { mesh, set };
}
