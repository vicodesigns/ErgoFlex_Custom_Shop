// Read-only ErgoFlex desk pose viewer for the Flutter wellness footer.
//
// Display-only: it receives measured lift/tilt from the host and moves the model.
// It has no command route, no credentials and no network access beyond loading
// its own bundled model. Rig data below is ported from the Custom Shop
// studio.js (BAKED_TILT_CONFIGS / BAKED_ACTUATOR_RIGS / PART_BAKE_DATA /
// INITIAL_ANIMATED_PARTS). Keep it in step with desk-public.glb: the editor ids
// depend on the GLB's mesh traversal order.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { INITIAL_ANIMATED_PARTS } from './rig-parts.js';
import { LedPixelRenderer, samplingGLSL } from './led/led-pixel-renderer.mjs';
import { LED_STRIPS, createLedFrame } from './led/led-strip-map.mjs';
import { DECORATIVE_EFFECTS, sampleDecorativeInto } from './led/led-showcase-effects.mjs';
import { LedMotion } from './led/led-movement.mjs';
import { rigDegreesForTilt, maximumTiltForHeight, TILT_MIN, TILT_MAX } from './motion-limits.mjs';

const SCHEMA_VERSION = 1;
const MODEL_URL = './model/desk-public.glb';
const TRIM_URL = './model/fullTrim.glb';
const LED_URL = './model/LEDS.glb';
const WIDE_LED_URL = './model/LEDSforWideDesktop.glb';
const LARGE_TOP_URL = './model/desktopLwTrim.glb';
const LARGE_TRIM_URL = './model/desktopLwTrimV2.glb';
const DESK_SIZE = '60x30'; // the 60-inch Extended desktop
const SHELF_TRIM_URL = './model/shelveanddesktopTrim.glb';

const LIFT_MIN = -19.25, LIFT_MAX = 6.53;
const HEIGHT_MIN = 28.0, HEIGHT_MAX = 52.5;
const TELESCOPING_RATIO = 0.5;
const MAX_MESSAGE_CHARS = 2048;
const BLEND_MS = 350;

const TELESCOPING_PARTS = ['Lift_Column_Center_1', 'Lift_Column_Center'];
const PART_BAKE_DATA = {
  Lift_Column_Center: { x: 6.283983309254151, y: -0.7430694811477421, z: 12.6278441313198, s: 0.03859392694789662 },
  Lift_Column_Center_1: { x: 6.283983309254151, y: -0.7430694811477421, z: 12.6278441313198, s: 0.03859392694789662 },
};
const TILT = {
  pivotLocal: { x: -175.85000650000003, y: 24.739389450000004, z: -306.42251899999997 },
  groupEditorIds: [
    'Desktop_1_4', 'Desktop_2_5', 'Desktop_3', 'Desktop_3_6',
    'L_A_Hardware_Top_1_33', 'L_A_Hardware_Top_3_35', 'L_A_Hardware_Top_4_255',
    'L_A_Hardware_Top_6_257', 'L_A_Hardware_Top_7_258', 'mesh_692_692',
    'Power_1_1', 'Power_2_2', 'Power_4_8', 'Power_7_11',
    'L_A_Hardware_Top_32', 'L_A_Hardware_Top_2_34', 'L_A_Hardware_Top_5_256',
    'Touch_Screen_1_583', 'Touch_Screen_2_584', 'Touch_Screen_3_585',
    'mesh_624_624', 'mesh_625_625', 'mesh_626_626',
    'Touch_Screen_4_683', 'Touch_Screen_5_684', 'Touch_Screen_6_685',
    'Touch_Screen_7_686', 'Power_3_7', 'Power_5_9', 'Touch_Screen_582',
    'Power_0', 'Power_6_10',
  ],
};
const ACTUATOR_RIGS = [
  {
    baseLocal: { x: -173.1007, y: 13.382, z: -346.3278 },
    targetEditorId: 'L_A_Hardware_Top_4_255',
    cylinderEditorIds: ['Linear_Actuators_2_38', 'Linear_Actuators_5_41', 'Linear_Actuators_6_42', 'Linear_Actuators_8_44'],
    rodEditorIds: ['Linear_Actuators_36'],
  },
  {
    baseLocal: { x: -173.1002, y: 13.3808, z: -307.9656 },
    targetEditorId: 'L_A_Hardware_Top_3_35',
    cylinderEditorIds: ['Linear_Actuators_3_39', 'Linear_Actuators_4_40', 'Linear_Actuators_7_43', 'Linear_Actuators_9_45'],
    rodEditorIds: ['Linear_Actuators_1_37'],
  },
];

// ---- outbound bridge -------------------------------------------------------
function send(msg) {
  const text = JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...msg });
  try { window.ErgoBridge?.postMessage(text); } catch (_) { /* host gone */ }
  try { window.ErgoViewer?.onOutbound?.(msg); } catch (_) { /* test hook */ }
}

// ---- scene -----------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(3, 5, 4);
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 0.7));

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
const CAMERA_DIR = new THREE.Vector3(4.8, 3.4, 4.2).normalize(); // fixed three-quarter view

// ---- rig state -------------------------------------------------------------
let model = null;
const liftParts = [];        // { obj, baseY }
const telescopingParts = []; // { obj, baseY }
let tiltWrapper = null;
let tiltWrapperBaseY = 0;
const actuators = [];
const registry = new Map();

const _a = new THREE.Vector3(), _base = new THREE.Vector3(), _dir = new THREE.Vector3(), _q = new THREE.Quaternion();

function liftForHeight(h) {
  return LIFT_MIN + ((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * (LIFT_MAX - LIFT_MIN);
}

function applyPose(heightInches, tiltDegrees) {
  const offset = liftForHeight(heightInches) - LIFT_MIN;
  for (const p of liftParts) p.obj.position.y = p.baseY + offset;
  for (const p of telescopingParts) p.obj.position.y = p.baseY + offset * TELESCOPING_RATIO;
  tiltWrapper.position.y = tiltWrapperBaseY + offset;
  tiltWrapper.rotation.set(0, 0, THREE.MathUtils.degToRad(rigDegreesForTilt(tiltDegrees)));
  tiltWrapper.updateMatrixWorld(true);
  for (const r of actuators) {
    _base.set(r.baseLocal.x, r.baseLocal.y + offset, r.baseLocal.z);
    r.target.updateWorldMatrix(true, false);
    _a.copy(r.targetCenter);
    r.target.localToWorld(_a);
    model.worldToLocal(_a);
    _dir.copy(_a).sub(_base);
    const len = _dir.length();
    if (len < 1e-6) continue;
    _dir.normalize();
    _q.setFromUnitVectors(r.restDir, _dir);
    r.cyl.position.copy(_base);
    r.cyl.quaternion.copy(_q);
    r.rod.quaternion.copy(_q);
    r.rod.position.copy(_base).addScaledVector(_dir, len - r.restLen);
  }
  model.updateMatrixWorld(true);
}

// Placeholder GLB colours -> real materials, as in studio.js onLoaded().
const BIRCH_COLORS = ['eaeda2', 'ebee87', 'ffff00', 'bbff00'];
const BASE_PAINT_COLORS = ['4fa5bd', '51b8d3', '51d0ef', 'd4b3e6', 'ffbbff', '689bad'];
const POLISHED_ALUMINUM_COLORS = ['e8e800', '7ec7f9', 'ce8ca4', '000000', '4db6c1', 'e7e7e7', '00ffff', 'ff0000', '6288aa', 'bbffe0', 'babb95', 'a5f1d0'];
const BLACK_PLASTIC_COLORS = ['0000ff', 'e6dabd'];
const BLACK_METAL_COLORS = ['7c5f5f', '75b4bd'];
const FINISH = { wood: '#1b1b1b', base: '#1C1C1E', trim: '#dc0909' }; // Black Birch / Black / red trim (Custom Shop defaults)
const materials = {
  wood: () => new THREE.MeshPhysicalMaterial({ color: FINISH.wood, metalness: 0, ior: 1.5, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
  base: () => new THREE.MeshPhysicalMaterial({ color: FINISH.base, metalness: 0.1, roughness: 0.45, ior: 1.5, clearcoat: 0.1, envMapIntensity: 1.1 }),
  aluminum: () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 1, roughness: 0.14, ior: 2.5, envMapIntensity: 1.35 }),
  plastic: () => new THREE.MeshPhysicalMaterial({ color: '#1a1a1a', metalness: 0.1, roughness: 0.55, ior: 1.45 }),
  metal: () => new THREE.MeshPhysicalMaterial({ color: '#2a2a2a', metalness: 0.85, roughness: 0.3, ior: 1.8, envMapIntensity: 1.2 }),
};
const shared = {};
function remapMaterials(root) {
  const pick = (hex) => {
    if (BIRCH_COLORS.includes(hex)) return 'wood';
    if (BASE_PAINT_COLORS.includes(hex)) return 'base';
    if (POLISHED_ALUMINUM_COLORS.includes(hex)) return 'aluminum';
    if (BLACK_PLASTIC_COLORS.includes(hex)) return 'plastic';
    if (BLACK_METAL_COLORS.includes(hex)) return 'metal';
    return null;
  };
  root.traverse((child) => {
    if (!child.isMesh) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.forEach((mat, i) => {
      if (!mat) return;
      const kind = pick(mat.color ? mat.color.getHexString().toLowerCase() : 'ffffff');
      if (!kind) return;
      shared[kind] ??= materials[kind]();
      if (Array.isArray(child.material)) child.material[i] = shared[kind]; else child.material = shared[kind];
    });
  });
}

function buildRigs(gltf) {
  model = gltf.scene;
  remapMaterials(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2.5 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  const scaled = new THREE.Box3().setFromObject(model);
  model.position.set(-center.x * scale, -scaled.min.y + 0.005, -center.z * scale);
  scene.add(model);
  model.updateMatrixWorld(true);

  model.traverse((child) => {
    if (!child.isMesh) return;
    const bake = PART_BAKE_DATA[child.name];
    if (bake) {
      const world = new THREE.Vector3(bake.x, bake.y, bake.z);
      child.parent.updateMatrixWorld(true);
      child.parent.worldToLocal(world);
      child.position.copy(world);
      child.updateMatrixWorld(true);
    }
  });

  let counter = 0;
  model.traverse((child) => {
    if (!child.isMesh) return;
    const id = child.name + '_' + (counter++);
    child.userData.editorId = id;
    registry.set(id, child);
    // The built-in LED meshes are placeholders the studio hides (LEDs come from a separate overlay).
    if (/^Leds(?:_|$)/.test(child.name)) child.visible = false;
    if (TELESCOPING_PARTS.includes(child.name)) {
      telescopingParts.push({ obj: child, baseY: child.position.y });
    } else if (INITIAL_ANIMATED_PARTS.includes(child.name)) {
      liftParts.push({ obj: child, baseY: child.position.y + LIFT_MIN });
    }
  });

  // Everything must be at the 28" start pose BEFORE parts are re-parented into the
  // tilt wrapper (attach() preserves their world transform), as studio.js does.
  for (const p of liftParts) p.obj.position.y = p.baseY;
  for (const p of telescopingParts) p.obj.position.y = p.baseY;
  model.updateMatrixWorld(true);

  // Tilt wrapper at the pivot, at the 28" reference height.
  tiltWrapper = new THREE.Group();
  tiltWrapper.position.set(TILT.pivotLocal.x, TILT.pivotLocal.y, TILT.pivotLocal.z);
  tiltWrapperBaseY = TILT.pivotLocal.y;
  model.add(tiltWrapper);
  tiltWrapper.updateMatrixWorld(true);
  const missing = [];
  for (const id of TILT.groupEditorIds) {
    const obj = registry.get(id);
    if (!obj) { missing.push(id); continue; }
    const i = liftParts.findIndex((p) => p.obj === obj);
    if (i > -1) liftParts.splice(i, 1);
    obj.updateMatrixWorld(true);
    tiltWrapper.attach(obj);
  }

  for (const def of ACTUATOR_RIGS) {
    const target = registry.get(def.targetEditorId);
    const cylParts = def.cylinderEditorIds.map((id) => registry.get(id)).filter(Boolean);
    const rodParts = def.rodEditorIds.map((id) => registry.get(id)).filter(Boolean);
    if (!target) { missing.push(def.targetEditorId); continue; }
    if (cylParts.length !== def.cylinderEditorIds.length || rodParts.length !== def.rodEditorIds.length) {
      missing.push(...def.cylinderEditorIds.concat(def.rodEditorIds).filter((id) => !registry.has(id)));
    }
    target.geometry.computeBoundingBox();
    const targetCenter = target.geometry.boundingBox.getCenter(new THREE.Vector3());
    const basePos = new THREE.Vector3(def.baseLocal.x, def.baseLocal.y, def.baseLocal.z);
    target.updateWorldMatrix(true, false);
    const A = target.localToWorld(targetCenter.clone());
    model.worldToLocal(A);
    const rest = A.sub(basePos);
    const restLen = rest.length();
    if (restLen < 1e-6) continue;
    const restDir = rest.clone().normalize();
    const mk = () => { const w = new THREE.Group(); w.position.copy(basePos); model.add(w); w.updateMatrixWorld(true); return w; };
    const cyl = mk(), rod = mk();
    const adopt = (parts, wrapper) => parts.forEach((o) => {
      const i = liftParts.findIndex((p) => p.obj === o); // the rig moves it now, not the lift list
      if (i > -1) liftParts.splice(i, 1);
      o.updateMatrixWorld(true);
      wrapper.attach(o);
    });
    adopt(cylParts, cyl);
    adopt(rodParts, rod);
    actuators.push({ baseLocal: def.baseLocal, target, targetCenter, cyl, rod, restDir, restLen });
  }
  return missing;
}

// ---- LEDs ------------------------------------------------------------------
// Driven by the desk's real light settings (host message `desk.led`), plus lift /
// tilt / wheel cues derived from the measured motion. A preview adaptation of the
// Custom Shop renderer: not byte-identical to the strips (no per-pixel feed exists).
const ledParts = [];            // { part, material } indexed by LEDS.glb child
const LED_DIM = 0.75;           // 25% dimmer than the first pass (too bright at 100% brightness)
const LED_EMISSIVE = 1.5;
const GLOW_RADIUS = 0.55;       // world units: how far a strip's light reaches (tuned against the Custom Shop render)
const GLOW_GAIN = 0.5;
const GLOW_AMBIENT = 0.05;      // light on a surface that faces away from the strip
const FLOOR_GLOW_GAIN = 0.7;
let ledPixels = null;
const ledFrame = createLedFrame();
const ledMotion = new LedMotion();
const DECORATIVE_IDS = new Set(DECORATIVE_EFFECTS.map((e) => e.fx));
const led = { on: false, bri: 255, rgb: [255, 255, 255], fx: 0, sx: 128, cues: true, fresh: true, wheelDir: 0, start: 0 };
let lastObserveAt = 0, lastPoseForLed = null, ledRenderedAt = 0;
const _ledColor = new THREE.Color();

function makeOverlayNode(gltf, index, xShift, material, name) {
  gltf.scene.updateMatrixWorld(true);
  const inverse = gltf.scene.matrixWorld.clone().invert();
  const group = new THREE.Group();
  group.name = name;
  gltf.scene.children[index].traverse((child) => {
    if (!child.isMesh) return;
    const g = child.geometry.clone();
    g.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
    g.translate(xShift, 0, 0);
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  });
  return group;
}

let ledExtended = null;

// Port of studio.js revealCenterLed: drop the centre strip below the desktop's underside so it
// does not poke through the top surface.
function revealCenterLed(part, desktopGeometry) {
  const underside = new THREE.Mesh(desktopGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  part.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(part);
  const ray = new THREE.Raycaster(
    new THREE.Vector3((center.min.x + center.max.x) / 2, -100, (center.min.z + center.max.z) / 2),
    new THREE.Vector3(0, 1, 0), 0, 200);
  const hit = ray.intersectObject(underside, false)[0];
  if (hit) part.position.y += Math.min(0, hit.point.y - center.min.y - 0.06);
  underside.material.dispose();
}

async function loadLed(loader) {
  const gltf = await loader.loadAsync(LED_URL);
  if (gltf.scene.children.length !== 43) throw new Error('LED export changed (' + gltf.scene.children.length + ' parts)');
  const roots = { base: new THREE.Group(), lift: new THREE.Group(), tilt: new THREE.Group() };
  gltf.scene.children.forEach((_, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.05,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      toneMapped: false, // keep the strip colour true instead of washing out to white
    });
    const role = index === 38 ? 'base' : index >= 39 ? 'lift' : 'tilt';
    const part = makeOverlayNode(gltf, index, -100, material, 'LED ' + index);
    roots[role].add(part);
    // The fixed red IC details are not part of the lit strips.
    if (index >= 3 && index <= 37) part.visible = false;
    ledParts.push({ part, material });
  });
  // 60-inch desktop: two wide side strips and the centre strip, sunk under the desktop
  // surface (otherwise it shows through the top as a white line).
  const wide = await loader.loadAsync(WIDE_LED_URL);
  if (wide.scene.children.length !== 2) throw new Error('wide LED export changed');
  ledExtended = new THREE.Group();
  for (let i = 0; i < 2; i++) ledExtended.add(makeOverlayNode(wide, i, -100, ledParts[i].material, 'Wide LED ' + i));
  const wideCenter = ledParts[2].part.clone(true);
  wideCenter.name = 'Wide centre LED';
  revealCenterLed(wideCenter, variantParts.largeTop.geometry);
  ledExtended.add(wideCenter);
  for (let i = 0; i < 3; i++) ledParts[i].part.visible = false; // the 48-inch strips
  roots.tilt.add(ledExtended);

  roots.lift.position.y = LIFT_MIN;
  roots.tilt.position.y = LIFT_MIN;
  for (const root of Object.values(roots)) model.add(root);
  liftParts.push({ obj: roots.lift, baseY: roots.lift.position.y });
  ledPixels = new LedPixelRenderer(LED_STRIPS);
  LED_STRIPS.forEach((strip) => ledPixels.bindStrip(ledParts[strip.mesh].part, strip.id));
  ledPixels.bindStrip(ledExtended.children[0], 6);
  ledPixels.bindStrip(ledExtended.children[1], 5);
  ledPixels.bindStrip(ledExtended.children[2], 4);

  setupGlow(roots.base);
  return roots.tilt;
}

// ---- LED surface glow ------------------------------------------------------
// Each of the 8 strips lights the surfaces around it along its whole length (a line
// source), in the strip's own colours. Done as an emissive term patched into every
// surface material: distance to the strip segment, fade-out, and surface facing. When a
// pixel effect is running the colours come from the same per-pixel texture the strips use.
const glow = {
  strips: [],
  floor: null,
  uniforms: {
    ledGlowA: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
    ledGlowB: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
    ledGlowColor: { value: Array.from({ length: 8 }, () => new THREE.Vector3(1, 1, 1)) },
    ledGlowRadius: { value: GLOW_RADIUS },
    ledGlowGain: { value: 0 },
    ledGlowAmb: { value: GLOW_AMBIENT },
  },
};
const GLOW_GLSL = `
uniform vec3 ledGlowA[8];
uniform vec3 ledGlowB[8];
uniform vec3 ledGlowColor[8];
uniform float ledGlowRadius;
uniform float ledGlowGain;
uniform float ledGlowAmb;
vec3 ledGlowAt(vec3 P, vec3 N) {
  vec3 sum = vec3(0.0);
  if (ledGlowGain <= 0.0) return sum;
  for (int i = 0; i < 8; i++) {
    vec3 A = ledGlowA[i];
    vec3 AB = ledGlowB[i] - A;
    float t = clamp(dot(P - A, AB) / max(dot(AB, AB), 1e-6), 0.0, 1.0);
    vec3 d = (A + AB * t) - P;
    float dist = length(d);
    if (dist >= ledGlowRadius) continue;
    float fall = 1.0 - smoothstep(0.0, ledGlowRadius, dist);
    fall *= fall;
    float facing = max(dot(N, d / max(dist, 1e-4)), 0.0);
    vec3 col = efPixelActive > 0.5 ? efLedSample(t, float(i)) : ledGlowColor[i];
    sum += col * fall * (ledGlowAmb + (1.0 - ledGlowAmb) * facing);
  }
  return sum * ledGlowGain;
}
`;

function patchSurfaceForGlow(mat) {
  if (!mat || mat.userData.glowPatched) return;
  mat.userData.glowPatched = true;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, glow.uniforms, ledPixels.uniforms);
    shader.fragmentShader = samplingGLSL + GLOW_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += ledGlowAt(-vViewPosition, normal);');
  };
  mat.customProgramCacheKey = () => 'ergoflex-led-glow-v1';
  mat.needsUpdate = true;
}

function setupGlow(baseRoot) {
  // Strip centre-lines in their own mesh's local space: min..max along the strip axis.
  for (const strip of LED_STRIPS) {
    const part = strip.id === 6 ? ledExtended.children[0] : strip.id === 5 ? ledExtended.children[1]
      : strip.id === 4 ? ledExtended.children[2] : ledParts[strip.mesh].part;
    let mesh = null;
    part.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
    const a = c.clone(), b = c.clone();
    a[strip.axis] = bb.min[strip.axis];
    b[strip.axis] = bb.max[strip.axis];
    glow.strips[strip.id] = { mesh, a, b };
  }
  // Every surface gets the glow term (the strips themselves and the trim do not).
  const skip = new Set(ledParts.map((p) => p.material));
  model.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    list.forEach((m) => { if (!skip.has(m) && !(m.userData && m.userData.noGlow)) patchSurfaceForGlow(m); });
  });

  // Soft glow on the floor under the foot rest strip (strip 7 sits on the static base).
  model.updateMatrixWorld(true);
  const foot = glow.strips[7];
  const fa = foot.a.clone().applyMatrix4(foot.mesh.matrixWorld);
  const fb = foot.b.clone().applyMatrix4(foot.mesh.matrixWorld);
  const floorY = new THREE.Box3().setFromObject(model).min.y + 0.004;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { fA: { value: fa }, fB: { value: fb }, fColor: { value: new THREE.Vector3(1, 1, 1) }, fGain: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform vec3 fA; uniform vec3 fB; uniform vec3 fColor; uniform float fGain;
      void main(){
        vec2 A = fA.xz, AB = fB.xz - fA.xz, P = vW.xz;
        float t = clamp(dot(P - A, AB) / max(dot(AB, AB), 1e-6), 0.0, 1.0);
        float d = length(P - (A + AB * t));
        float a = exp(-(d * d) / (2.0 * 0.22 * 0.22)) * fGain;
        gl_FragColor = vec4(fColor * a, a);
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((fa.x + fb.x) / 2, floorY, (fa.z + fb.z) / 2);
  plane.renderOrder = -1;
  scene.add(plane);
  glow.floor = mat;
}

// View-space strip end points for the surface shader; world-space is static for the floor.
function updateGlowUniforms() {
  if (!glow.strips.length) return;
  camera.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse;
  glow.strips.forEach((s, i) => {
    s.mesh.updateWorldMatrix(true, false);
    glow.uniforms.ledGlowA.value[i].copy(s.a).applyMatrix4(s.mesh.matrixWorld).applyMatrix4(inv);
    glow.uniforms.ledGlowB.value[i].copy(s.b).applyMatrix4(s.mesh.matrixWorld).applyMatrix4(inv);
  });
}

const ledPeriod = () => 30 - (led.sx / 255) * 26; // firmware speed -> preview cycle seconds (4..30)

function ledAnimated() {
  if (reducedMotion || !ledParts.length) return false;
  return !!ledMotion.owner || (led.on && (led.fx === 2 || DECORATIVE_IDS.has(led.fx)));
}

function updateLeds(nowMs) {
  if (!ledParts.length) return;
  const seconds = (nowMs - led.start) / 1000;
  const dimmed = !led.fresh ? 0.5 : 1;
  const scale = (led.bri / 255) * dimmed * LED_DIM;
  let pixels = false;
  if (ledMotion.sample(ledFrame, nowMs, reducedMotion)) pixels = true;
  else if (led.on && DECORATIVE_IDS.has(led.fx) &&
           sampleDecorativeInto(ledFrame, { mode: 'fx-' + led.fx, period: ledPeriod() }, seconds,
             '#' + led.rgb.map((v) => v.toString(16).padStart(2, '0')).join(''), reducedMotion, (view.h - 28) / 24)) pixels = true;

  let gain = 1;
  if (led.fx === 2 && !reducedMotion) {   // Breathe
    const phase = (Math.max(0, seconds) / ledPeriod()) % 1;
    gain = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2));
  }
  _ledColor.setRGB(led.rgb[0] / 255, led.rgb[1] / 255, led.rgb[2] / 255, THREE.SRGBColorSpace);
  ledParts.forEach(({ material }, index) => {
    if (index >= 3 && index <= 37) return;
    material.color.copy(_ledColor).multiplyScalar(led.on ? 1 : 0.12);
    material.emissive.copy(_ledColor);
    material.emissiveIntensity = led.on ? LED_EMISSIVE * scale * gain : 0;
  });
  // Glow colour: the movement cue's colour while one is showing, else the desk's colour.
  const cue = ledMotion.owner ? ledMotion.owner.colors[0] : null;
  if (cue) _ledColor.setRGB(cue[0] / 255, cue[1] / 255, cue[2] / 255, THREE.SRGBColorSpace);
  const lit = led.on || !!cue;
  glow.uniforms.ledGlowColor.value.forEach((v) => v.set(_ledColor.r, _ledColor.g, _ledColor.b));
  const strength = lit ? (cue ? LED_DIM : scale * gain) : 0;
  glow.uniforms.ledGlowGain.value = GLOW_GAIN * strength;
  if (glow.floor) {
    glow.floor.uniforms.fColor.value.set(_ledColor.r, _ledColor.g, _ledColor.b);
    glow.floor.uniforms.fGain.value = FLOOR_GLOW_GAIN * strength;
  }
  const showPixels = pixels && (led.on || !!ledMotion.owner);
  if (showPixels) ledPixels.upload(ledFrame);
  ledPixels.setActive(showPixels, LED_EMISSIVE * (ledMotion.owner ? LED_DIM : scale));
}

// Feed the movement-cue engine. Called with each accepted measured pose, and with an
// unchanged pose after the desk goes quiet so the cue clears and "target reached" shows.
function observeMotion(h, t, settled) {
  const now = performance.now();
  lastObserveAt = now;
  lastPoseForLed = { h, t };
  ledMotion.observe({ lift: h, tilt: t, x: 0, z: 0, yaw: 0, wheelDir: led.wheelDir || 0 }, now,
    { liftReached: settled, tiltReached: settled, enabled: led.cues });
}

function setLedLook(msg) {
  const rgb = Array.isArray(msg.rgb) && msg.rgb.length === 3 && msg.rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) ? msg.rgb : led.rgb;
  const prevFx = led.fx;
  led.rgb = rgb;
  led.on = msg.on === true;
  led.bri = Number.isInteger(msg.bri) ? Math.min(255, Math.max(0, msg.bri)) : led.bri;
  led.fx = Number.isInteger(msg.fx) ? msg.fx : 0;
  led.sx = Number.isInteger(msg.sx) ? Math.min(255, Math.max(0, msg.sx)) : led.sx;
  led.cues = msg.cues !== false;
  led.fresh = msg.fresh !== false;
  const wheel = Number.isInteger(msg.wheelDir) && msg.wheelDir >= 0 && msg.wheelDir <= 10 ? msg.wheelDir : 0;
  const wheelChanged = wheel !== led.wheelDir;
  led.wheelDir = wheel;
  if (led.fx !== prevFx) led.start = performance.now();
  if (wheelChanged && lastPoseForLed) observeMotion(lastPoseForLed.h, lastPoseForLed.t, false);
  if (!led.cues) ledMotion.cancel(null);
  updateLeds(performance.now());
  if (poseSeen) { renderOnce(); kick(); }
}

// Roles of the ten fullTrim.glb nodes (index 0 is replaced by the standard desktop trim below).
let variantParts = null;
const TRIM_ROLES = ['tilt', 'base', 'base', 'tilt', 'tilt', 'lift', 'lift', 'lift', 'base', 'base'];

async function loadTrim(loader) {
  const trimMaterial = new THREE.MeshPhysicalMaterial({
    color: FINISH.trim, metalness: 0.35, roughness: 0.45,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const tiltParts = [];
  const addLift = (obj) => liftParts.push({ obj, baseY: obj.position.y });

  // Merge a source node's meshes into one mesh in the source scene's frame.
  const merge = (source, node, shiftX) => {
    source.scene.updateMatrixWorld(true);
    const inverse = source.scene.matrixWorld.clone().invert();
    const shift = new THREE.Matrix4().makeTranslation(shiftX, 0, 0);
    const geoms = [];
    node.traverse((c) => {
      if (!c.isMesh) return;
      const g = c.geometry.clone();
      g.applyMatrix4(inverse.clone().multiply(c.matrixWorld).premultiply(shift));
      geoms.push(g);
    });
    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    if (!merged) throw new Error('trim merge failed');
    const mesh = new THREE.Mesh(merged, trimMaterial);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  };

  const full = await loader.loadAsync(TRIM_URL);
  const nodes = full.scene.children.filter((n) => { let m = false; n.traverse((o) => { if (o.isMesh) m = true; }); return m; });
  if (nodes.length !== TRIM_ROLES.length) throw new Error('unexpected fullTrim parts: ' + nodes.length);
  nodes.forEach((node, i) => {
    if (i === 0) return;
    const obj = merge(full, node, 0);
    obj.name = 'Trim_' + i;
    model.add(obj);
    const role = TRIM_ROLES[i];
    if (role !== 'base') obj.position.y += LIFT_MIN; // authored above the 28" start pose
    if (role === 'lift') addLift(obj);
    if (role === 'tilt') tiltParts.push(obj);
  });

  const small = await loader.loadAsync(SHELF_TRIM_URL);
  if (small.scene.children.length !== 3) throw new Error('unexpected shelf trim parts');
  [['Trim_Shelf_Lower', 0, 'lift'], ['Trim_Shelf_Upper', 1, 'lift'], ['Trim_Desktop_Standard', 2, 'tilt']].forEach(([name, idx, role]) => {
    const obj = merge(small, small.scene.children[idx], -100);
    obj.name = name;
    obj.position.y = LIFT_MIN;
    model.add(obj);
    if (role === 'lift') addLift(obj); else tiltParts.push(obj);
  });
  // 60-inch Extended desktop and its trim replace the 48-inch top and trim.
  const [largeGltf, largeTrimGltf] = await Promise.all([loader.loadAsync(LARGE_TOP_URL), loader.loadAsync(LARGE_TRIM_URL)]);
  if (largeGltf.scene.children.length !== 2 || largeTrimGltf.scene.children.length !== 1) throw new Error('unexpected 60-inch desktop parts');
  let smallTop = null;
  for (const o of registry.values()) {
    if (smallTop || !o.name.startsWith('Desktop') || !o.geometry) continue;
    o.geometry.computeBoundingBox();
    const sz = o.geometry.boundingBox.getSize(new THREE.Vector3());
    if (sz.x > 30 && sz.z > 40 && sz.y < 5) smallTop = o;
  }
  if (!smallTop) throw new Error('could not identify the 48-inch desktop');
  const largeTop = merge(largeGltf, largeGltf.scene.children[0], -100);
  largeTop.material = smallTop.material;
  largeTop.castShadow = true; largeTop.receiveShadow = true;
  const largeTrim = merge(largeTrimGltf, largeTrimGltf.scene.children[0], -100);
  for (const [obj, name] of [[largeTop, 'Variant_Desktop_Extended'], [largeTrim, 'Trim_Desktop_Extended']]) {
    obj.name = name;
    obj.position.y = LIFT_MIN;
    model.add(obj);
    tiltParts.push(obj);
  }
  smallTop.visible = false;
  tiltParts.find((o) => o.name === 'Trim_Desktop_Standard').visible = false;
  variantParts = { largeTop };
  return tiltParts;
}

function attachToTilt(parts) {
  tiltWrapper.rotation.set(0, 0, 0);
  tiltWrapper.updateMatrixWorld(true);
  for (const obj of parts) {
    obj.updateMatrixWorld(true);
    tiltWrapper.attach(obj);
  }
}

// ---- camera: tight fit to the desk's full travel, orbitable by the host ------
let unionBox = null;
let orbit = { yaw: 0, pitch: 0 };
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const FIT_MARGIN = 1.0;
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3());
const _p = new THREE.Vector3();

function measureTravel() {
  unionBox = new THREE.Box3();
  for (const [h, t] of [[HEIGHT_MIN, TILT_MIN], [HEIGHT_MAX, TILT_MIN], [HEIGHT_MAX, TILT_MAX], [44, TILT_MAX]]) {
    applyPose(h, t);
    unionBox.union(new THREE.Box3().setFromObject(model));
  }
}

// Largest normalized-device extent of the box corners for a camera at distance d.
function fitExtent(center, dir, d) {
  camera.position.copy(center).addScaledVector(dir, d);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  let maxX = 0, maxY = 0;
  for (const c of _corners) {
    _p.copy(c).project(camera);
    maxX = Math.max(maxX, Math.abs(_p.x));
    maxY = Math.max(maxY, Math.abs(_p.y));
  }
  return Math.max(maxX, maxY);
}

function updateCamera() {
  if (!unionBox) return;
  const { min, max } = unionBox;
  let i = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) _corners[i++].set(x, y, z);
  const center = unionBox.getCenter(new THREE.Vector3());
  const dir = CAMERA_DIR.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.yaw);
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  dir.applyAxisAngle(side, -orbit.pitch).normalize();
  const radius = unionBox.getSize(new THREE.Vector3()).length() / 2;
  let lo = radius * 0.4, hi = radius * 8;
  for (let n = 0; n < 24; n++) {            // smallest distance that still fits
    const mid = (lo + hi) / 2;
    if (fitExtent(center, dir, mid) * FIT_MARGIN > 1) lo = mid; else hi = mid;
  }
  fitExtent(center, dir, hi);
}

function frameCamera() {
  measureTravel();
  updateCamera();
}

function orbitBy(dxPx, dyPx) {
  orbit.yaw = THREE.MathUtils.euclideanModulo(orbit.yaw - dxPx * 0.012 + Math.PI, Math.PI * 2) - Math.PI;
  orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dyPx * 0.008, -MAX_PITCH, MAX_PITCH);
  updateCamera();
  if (poseSeen) renderOnce();
}

function resetOrbit() {
  orbit = { yaw: 0, pitch: 0 };
  updateCamera();
  if (poseSeen) renderOnce();
}


// ---- pose queue & blending -------------------------------------------------
const view = { h: HEIGHT_MIN, t: TILT_MIN };
let from = null, to = null, blendStart = 0;
let reducedMotion = false, paused = false, ready = false, rafId = 0;
let sessionId = null, lastSequence = -1;
let poseSeen = false;
let pendingPose = null;

function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

function acceptPose(msg) {
  if (typeof msg.sessionId !== 'string' || msg.sessionId.length > 64) return 'bad-session';
  if (!Number.isInteger(msg.sequence) || msg.sequence < 0) return 'bad-sequence';
  if (!finite(msg.heightInches) || msg.heightInches < HEIGHT_MIN - 0.5 || msg.heightInches > HEIGHT_MAX + 0.5) return 'height-out-of-range';
  if (!finite(msg.tiltDegrees) || msg.tiltDegrees < TILT_MIN - 1 || msg.tiltDegrees > TILT_MAX + 1) return 'tilt-out-of-range';
  if (msg.sessionId !== sessionId) { sessionId = msg.sessionId; lastSequence = -1; }
  if (msg.sequence <= lastSequence) return 'stale-sequence';
  return null;
}

function startPose(msg) {
  lastSequence = msg.sequence;
  poseSeen = true;
  reducedMotion = msg.reducedMotion === true;
  // Measured pose is shown as-is; the builder's tilt/height clamps are deliberately not applied.
  const h = Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, msg.heightInches));
  const t = Math.min(TILT_MAX, Math.max(TILT_MIN, msg.tiltDegrees));
  to = { h, t, sequence: msg.sequence };
  observeMotion(h, t, false);
  const envelope = t <= maximumTiltForHeight(h, DESK_SIZE) + 0.5;
  if (reducedMotion || !ready) {
    view.h = h; view.t = t; from = null;
    applyPose(h, t);
    updateLeds(performance.now());
    renderOnce();
    send({ type: 'pose.applied', sessionId, sequence: msg.sequence, heightInches: h, tiltDegrees: t, withinEnvelope: envelope });
    return;
  }
  from = { h: view.h, t: view.t };
  blendStart = performance.now();
  kick();
}

function kick() { if (!rafId && !paused) rafId = requestAnimationFrame(tick); }

function tick(now) {
  rafId = 0;
  if (paused) return;
  if (to && from) {
    const k = Math.min(1, (now - blendStart) / BLEND_MS);
    const e = 1 - Math.pow(1 - k, 3);
    view.h = from.h + (to.h - from.h) * e;
    view.t = from.t + (to.t - from.t) * e;
    applyPose(view.h, view.t);
    if (k >= 1) {
      from = null;
      send({ type: 'pose.applied', sessionId, sequence: to.sequence, heightInches: to.h, tiltDegrees: to.t,
             withinEnvelope: to.t <= maximumTiltForHeight(to.h, DESK_SIZE) + 0.5 });
    }
  }
  // Desk went quiet: clear the cue (and show "target reached") once.
  if (!from && lastPoseForLed && (ledMotion.owner || ledMotion.completionUntil) && now - lastObserveAt > 900) {
    observeMotion(lastPoseForLed.h, lastPoseForLed.t, true);
  }
  const ledOnly = !from;
  if (!ledOnly || now - ledRenderedAt >= 45) {   // LED-only animation capped at ~20 fps
    ledRenderedAt = now;
    updateLeds(now);
    renderOnce();
  }
  if (from || ledAnimated() || ledMotion.owner || ledMotion.completionUntil) kick();
}

function renderOnce() {
  if (!ready) return;
  updateGlowUniforms();
  renderer.render(scene, camera);
}

function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (model) {
    camera.updateProjectionMatrix();
    updateCamera();
  }
  if (poseSeen) renderOnce();
}

// ---- inbound bridge --------------------------------------------------------
function receive(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_CHARS) return;
  let msg;
  try { msg = JSON.parse(raw); } catch (_) { return; }
  if (!msg || typeof msg !== 'object' || msg.schemaVersion !== SCHEMA_VERSION) return;
  switch (msg.type) {
    case 'desk.pose': {
      const problem = acceptPose(msg);
      if (problem) { if (problem !== 'stale-sequence') send({ type: 'viewer.error', code: 'pose.rejected', detail: problem }); return; }
      if (!ready) { pendingPose = msg; return; }
      startPose(msg);
      break;
    }
    case 'desk.led':
      setLedLook(msg);
      break;
    case 'viewer.orbit':
      if (finite(msg.dx) && finite(msg.dy) && Math.abs(msg.dx) < 400 && Math.abs(msg.dy) < 400) orbitBy(msg.dx, msg.dy);
      break;
    case 'viewer.resetView': resetOrbit(); break;
    case 'viewer.pause': paused = true; break;
    case 'viewer.resume': paused = false; renderOnce(); kick(); break;
    default: break; // unknown types are ignored
  }
}

window.ErgoViewer = { receive, onOutbound: null };

// ---- boot ------------------------------------------------------------------
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  ready = false;
  send({ type: 'viewer.error', code: 'context-lost' });
});
window.addEventListener('resize', resize);

const loader = new GLTFLoader();
loader.load(MODEL_URL, async (gltf) => {
  try {
    const missing = buildRigs(gltf);
    if (missing.length) {
      send({ type: 'viewer.error', code: 'rig-parts-missing', detail: missing.slice(0, 8).join(',') });
      return;
    }
    const tiltExtras = [];
    try {
      tiltExtras.push(...await loadTrim(loader));
    } catch (err) {
      // The desk is still correct without the red trim; report it and carry on.
      send({ type: 'viewer.warning', code: 'trim-failed', detail: String(err && err.message || err).slice(0, 120) });
    }
    try {
      tiltExtras.push(await loadLed(loader));
    } catch (err) {
      send({ type: 'viewer.warning', code: 'led-failed', detail: String(err && err.message || err).slice(0, 120) });
    }
    attachToTilt(tiltExtras);
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frameCamera();
    applyPose(HEIGHT_MIN, TILT_MIN);
    ready = true;
    send({ type: 'viewer.ready', assetVersion: 'desk-public-2026-09-30', geometry: DESK_SIZE });
    if (pendingPose) { const p = pendingPose; pendingPose = null; startPose(p); }
    // No initial render: the canvas stays clear until a measured pose arrives.
  } catch (err) {
    send({ type: 'viewer.error', code: 'build-failed', detail: String(err && err.message || err).slice(0, 120) });
  }
}, undefined, (err) => send({ type: 'viewer.error', code: 'load-failed', detail: String(err && err.message || err).slice(0, 120) }));

// Read-only diagnostic: where a named part sits in the rig and its world height.
window.ErgoViewer.inspect = (prefix) => [...registry.entries()]
  .filter(([id]) => id.startsWith(prefix))
  .map(([id, o]) => {
    let inTilt = false; for (let p = o.parent; p; p = p.parent) if (p === tiltWrapper) inTilt = true;
    return { id, inLift: liftParts.some((l) => l.obj === o), inTilt, worldY: +new THREE.Box3().setFromObject(o).min.y.toFixed(3) };
  });
