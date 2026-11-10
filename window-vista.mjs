// Photographic window views. A room's window pane keeps its place in the wall,
// and this material looks "through" it: every pixel's view ray is mapped to a
// pixel of a photograph taken at the horizon, so the scene outside sits at a
// distance and shifts as the camera moves, the way a real view does. A painted
// canvas on the pane cannot do that; it reads as a poster on the wall.
//
// The images are rectilinear crops of CC0 panoramas (tools/rooms/build-window-vistas.py),
// 110 degrees wide, horizon in the middle. Dayparts are a grade (gain, lift,
// saturation) plus, where a location has one, a second photograph taken after
// dark. Every value is a uniform, so the film's time-of-day blend (film-tod)
// interpolates them like any other light.
import * as THREE from 'three';

const BASE = new URL('./assets/rooms/vistas/', import.meta.url).href;
const HFOV = 110, ASPECT = 2048 / 1280;
const TAN_X = Math.tan(THREE.MathUtils.degToRad(HFOV) / 2), TAN_Y = TAN_X / ASPECT;

// day: the daylight photograph. dusk: a second photograph for the phases in
// duskPhases. zoom < 1 enlarges the view (a longer lens on the outside).
// horizon shifts the horizon up (+) or down (-) as a fraction of the image.
// brightness, saturation and contrast grade one photograph on top of the daypart (a hazy beach needs less light and
// more colour than a garden to sit at the same exposure).
export const VISTAS = {
    garden: { day: 'garden', brightness: .92 },
    'studio-garden': { day: 'studio-garden' },
    campus: { day: 'campus' },
    yard: { day: 'yard', brightness: .92 },
    coast: { day: 'coast', brightness: .74, saturation: 1.3, contrast: 1.22 },
    city: { day: 'city-day', dusk: 'city-dusk', duskPhases: ['evening', 'night', 'party'], zoom: .8 },
    'city-neon': { day: 'city-day', dusk: 'city-neon', duskPhases: ['night', 'party'], zoom: .8 }
};

// A window is brighter than the room: daylight grades sit above 1 so the tone
// mapper rolls the view off the way a camera exposed for the interior would.
const DAY = {
    morning: { gain: [1.34, 1.25, 1.1], lift: [.014, .014, .018], saturation: .98 },
    afternoon: { gain: [1.3, 1.28, 1.25], lift: [.008, .008, .012], saturation: 1.02 },
    evening: { gain: [1.12, .88, .68], lift: [.03, .015, .005], saturation: .9 },
    night: { gain: [.05, .075, .15], lift: [.004, .006, .014], saturation: .5 },
    party: { gain: [.12, .12, .24], lift: [.006, .006, .018], saturation: .65 }
};
// The after-dark photograph is already exposed for its hour.
const DUSK = {
    evening: { gain: [1.15, 1.05, 1], lift: [0, 0, 0], saturation: 1 },
    night: { gain: [.55, .6, .8], lift: [0, 0, .004], saturation: .95 },
    party: { gain: [.8, .8, 1], lift: [0, 0, .004], saturation: 1 }
};

const textures = new Map();
function load(name) {
    if (!textures.has(name)) textures.set(name, new Promise((resolve, reject) => new THREE.TextureLoader().load(BASE + name + '.jpg', t => {
        t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; resolve(t);
    }, undefined, reject)));
    return textures.get(name);
}

const VERTEX = `varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAGMENT = `uniform sampler2D dayMap; uniform sampler2D duskMap;
uniform float duskMix, saturation, zoom, horizon, soften, contrast;
uniform vec3 gain, lift, wRight, wUp, wOut;
uniform vec2 tanHalf;
varying vec3 vWorld;
void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float z = max(abs(dot(dir, wOut)), .08);
    vec2 uv = .5 + vec2(dot(dir, wRight), dot(dir, wUp)) / z * zoom / (2. * tanHalf);
    uv.y = clamp(uv.y + horizon, .002, .998);
    vec3 c = texture2D(dayMap, uv, soften).rgb;
    if (duskMix > 0.) c = mix(c, texture2D(duskMap, uv, soften).rgb, duskMix);
    c = max((c - .42) * contrast + .42, 0.);
    c = mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, saturation) * gain + lift;
    gl_FragColor = vec4(c, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

const local = new THREE.Vector3(), quaternion = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

// pane: the window's view mesh; its local +Z faces the room. Returns
// { ready, setPhase(phase) }. Until the photograph has loaded (or if it cannot
// be), the pane keeps the material it came with.
export function attachVista(pane, name, phase = 'afternoon') {
    const vista = VISTAS[name]; if (!vista) throw Error('No window vista "' + name + '".');
    const uniforms = {
        dayMap: { value: null }, duskMap: { value: null }, duskMix: { value: 0 }, saturation: { value: 1 }, soften: { value: .6 }, contrast: { value: 1 },
        zoom: { value: vista.zoom ?? 1 }, horizon: { value: vista.horizon ?? 0 }, tanHalf: { value: new THREE.Vector2(TAN_X, TAN_Y) },
        gain: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3() },
        wRight: { value: new THREE.Vector3(1, 0, 0) }, wUp: { value: UP.clone() }, wOut: { value: new THREE.Vector3(0, 0, -1) }
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: pane.material?.side ?? THREE.FrontSide });
    material.name = 'Window vista · ' + name; material.toneMapped = true;
    const setPhase = id => {
        const dusk = !!vista.dusk && vista.duskPhases.includes(id), grade = (dusk ? DUSK : DAY)[id] || DAY.afternoon;
        // The photograph's own grade applies to its daylight picture; the after-dark one is exposed for its hour.
        uniforms.duskMix.value = dusk ? 1 : 0; uniforms.saturation.value = grade.saturation * (dusk ? 1 : vista.saturation ?? 1); uniforms.contrast.value = dusk ? 1 : vista.contrast ?? 1;
        uniforms.gain.value.fromArray(grade.gain).multiplyScalar(dusk ? 1 : vista.brightness ?? 1); uniforms.lift.value.fromArray(grade.lift);
    };
    setPhase(phase);
    const before = pane.onBeforeRender;
    const aim = () => {
        // Outward is the pane's -Z in world space, kept level; right is the viewer's right when facing the window.
        pane.getWorldQuaternion(quaternion); local.set(0, 0, -1).applyQuaternion(quaternion); local.y = 0;
        if (local.lengthSq() < 1e-6) return; local.normalize();
        uniforms.wOut.value.copy(local); uniforms.wRight.value.crossVectors(local, UP).normalize();
    };
    const ready = Promise.all([load(vista.day), vista.dusk ? load(vista.dusk) : null]).then(([day, dusk]) => {
        uniforms.dayMap.value = day; uniforms.duskMap.value = dusk || day;
        pane.userData.paintedMaterial = pane.material; pane.material = material; pane.userData.windowVista = name;
        pane.onBeforeRender = function (...args) { aim(); before?.apply(this, args); };
        aim();
    }).catch(error => { console.warn('[window-vista] ' + name + ' keeps its painted view:', error?.message || error); });
    return { ready, setPhase, material };
}
