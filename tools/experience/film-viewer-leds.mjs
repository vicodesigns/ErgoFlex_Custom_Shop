// Render-harness-only: the app visualizer's LED receivers on the Custom Shop desk the film renders.
// Loaded by film-fx.mjs for shot.ledReceivers ('viewer' or {mode:'viewer', …}); nothing in the app imports it.
// Every change lives in the disposable stage and is undone by restore().
//
// Ported from the visualizer, app-reference/assets/desk_viewer/led/led-receivers.mjs (byte-identical to
// ergoflex_app/desk_viewer/led/ in WellnessVoice_Worktree and Polish-Features), and the level it applies at
// runtime in desk-viewer.js (updateLeds: indicatorLift, setLevel, setRise, LED_STRIP_POWER). The visualizer's
// receivers are the Custom Shop's (studio.js) plus its "app additions", so only the additions and the changed
// constants are ported; the Custom Shop's own receivers stay and are re-tuned in place:
//   * addFloorBounce   the desktop-underside strips (centre 4, sides 5/6) and the two lit wing faces light the floor,
//                      per pixel (the comets travel on the floor), Lambert h / r^3, rise gain, side walls.
//   * addLegWingSpill  the wing glow carried down the side plates (Base_Panels_1 under Desktop_1, Base_Panels under
//                      Desktop_2).
//   * WING_FALL_BELOW  the wing glow falls off over 18 authored inches below its centre (the Custom Shop uses 7).
//   * DESKTOP_REFLECTION_BANDS  depth order lower shelf (3) / upper back (1) / upper front (2), rear to front
//                      (Vico, 2026-10-08); the Custom Shop has 2 in the middle. Set through the band uniforms.
//   * Each wing takes its colour from the side strip physically beside it (nearest in Z), as the visualizer does.
//   * indicatorLift    a status indicator (the film's ledStatus frames) is drawn as bright as red would be: blue up to
//                      2x, receivers and strip power alike (desk-viewer.js INDICATOR_LIFT_MAX).
// Shader bodies and constants are the visualizer's. Coordinates are the AUTHORED model frame (api.loadedModel's
// local frame, inches), the same frame the visualizer computes in.
//
// Film differences, each deliberate:
//   * Binding: the Custom Shop desk carries both the 48-inch (Standard) and the 60-inch (Extended) underside strips;
//     both sets are floor-bounce sources and each is on only while its group is visible (srcOn), so either size works.
//     The pixel atlas, its uniforms and the strip meshes are the app's own (api.ledPixelRenderer, userData.ledPhysicalId).
//   * Pixel-less looks: the visualizer always draws firmware pixels; the Custom Shop shows a solid colour without them
//     (the film's neutral white between moves). The floor bounce then takes the receivers' ledColor, as every Custom
//     Shop receiver does, instead of discarding.
//   * Level: strength follows the app's own level (ledGlow x its effect gain, read from the foot floor glow), so
//     ledGlow, the lights-off state and fades drive it as they drive the other receivers. ledGlow 1 is the
//     visualizer's gain 1, the level it draws status indicators at.
//   * Draw order: the floor bounce and the app's foot floor glow draw over the film stage's contact shadow (renderOrder
//     3; the stage draws it at 2), as the visualizer draws them over its shadow catcher.
//   * Side walls: the visualizer measures the wing box in the wing's geometry frame (its applyMatrix4 sits inside a
//     comment, led-receivers.mjs:628); here it is taken into the model frame as intended (under an inch at rest).
//   * Strip map: the Custom Shop's (led-strip-map.mjs) is the visualizer's mirror image (its sides 5/6 trade meshes and
//     every strip along Z runs the other way; Vico, 2026-10-06). stripMap:'viewer' remaps the uploaded pixel rows so
//     the desk shows the visualizer's map; the default 'app' leaves the film's status animations exactly as they are.
//
// render-cut.cjs loads film-fx only for shots with one of its FX_FIELDS, which do not list ledReceivers yet: a shot
// using it needs another film field too (every status shot has ledStatus).
//
//   ledReceivers:'viewer' | {mode:'viewer', floorBounce=true, legWings=true, wingFallBelow=true, bands=true,
//                 wingRows='beside'|'app', indicatorLift=true, stripMap='app'|'viewer', appFloorGlow=true,
//                 floorBounceStrength=130, floorBounceReach=100, wingFloorGain=0.6 (the wing faces' share of the floor)}
import * as THREE from 'three';

const api = window.ErgoFlex;

// ---- the visualizer's constants (led-receivers.mjs, desk-viewer.js) ----
export const LED_SURFACE_DEFAULTS = Object.freeze({
  desktopStrength: 157, desktopReach: 100, desktopWidth: 5,
  desktopCone: 100, desktopEdgeFade: 46, desktopSharpness: 62,
  shelfStrength: 176, shelfReach: 98,
  baseStrength: 54, baseReach: 20,
  topStrength: 143, topReach: 77,
  floorStrength: 156, floorReach: 4, floorWidth: 50, floorSharpness: 73,
  leftWingStrength: 111, leftWingReach: 85,
  rightWingStrength: 110, rightWingReach: 87,
});
export const APP_SURFACE_DEFAULTS = Object.freeze({ floorBounceStrength: 130, floorBounceReach: 100 });
export const DESKTOP_REFLECTION_BANDS = Object.freeze([
  { sourceId: 3, centerX: -171, width: 0.85, gain: 1.0 },
  { sourceId: 1, centerX: -164, width: 1.0, gain: 0.8 },
  { sourceId: 2, centerX: -157, width: 1.15, gain: 0.65 },
]);
const WING_FALL_BELOW = 18;
const WING_FLOOR_GAIN = 0.6;
const WING_GLOW_Y = 44;
const FLOOR_BOUNCE_HEIGHT_REF = 26;
export const FLOOR_SIT_GAIN = 1.3;
export const FLOOR_STAND_GAIN = 0.55;
export const FLOOR_RISE_WIDEN = 0.5;
const HEIGHT_MIN = 28.0, HEIGHT_MAX = 52.5;   // desk-viewer.js / studio.js
const INDICATOR_LIFT_MAX = 2;
function indicatorLift(rows) {
  let y = 0, ref = 0;
  for (const row of rows) {
    for (let i = 0; i < row.length; i += 4) {
      const w = row[i + 3], r = Math.min(255, row[i] + w), g = Math.min(255, row[i + 1] + w), b = Math.min(255, row[i + 2] + w);
      y += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      ref += 0.2126 * Math.max(r, g, b);
    }
  }
  return y > 0 ? Math.min(INDICATOR_LIFT_MAX, Math.max(1, ref / y)) : 1;
}
// led-pixel-renderer.mjs samplingGLSL (the Custom Shop's copy does not export it; the text is identical).
const samplingGLSL = `
uniform sampler2D efPixelTexture;
uniform float efPixelActive;
uniform float efPixelRows;
uniform float efPixelWidth;
uniform float efPixelCounts[8];
vec3 efLedLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 efLedSample(float t, float row) {
    float count = efPixelCounts[int(row)];
    float pixel = min(count - 1.0, floor(clamp(t, 0.0, 1.0) * count));
    return efLedLinear(texture2D(efPixelTexture, vec2((pixel + 0.5) / efPixelWidth, (row + 0.5) / efPixelRows)).rgb);
}
`;

const OVERLAY = {
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
};

// ---- addLegWingSpill (verbatim shader) ----
function addLegWingSpill(list, plate, wing, receiver, sourceId) {
  const minReach = 5;
  const maxReach = 18;
  wing.geometry.computeBoundingBox();
  const wingBox = wing.geometry.boundingBox;
  const outward = Math.sign(wingBox.getCenter(new THREE.Vector3()).z + 327.1) || 1;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ledColor: { value: new THREE.Color(1, 1, 1) },
      strength: { value: 0 },
      faceSign: { value: outward },
      fadeReach: { value: (minReach + maxReach) / 2 },
      reflectionFrame: { value: new THREE.Matrix4() },
      reflectionNormal: { value: new THREE.Matrix3() },
    },
    vertexShader: `
      uniform mat4 reflectionFrame;
      uniform mat3 reflectionNormal;
      varying vec3 ledPosition;
      varying vec3 ledNormal;
      void main() {
        ledPosition = (reflectionFrame * vec4(position, 1.0)).xyz;
        ledNormal = reflectionNormal * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 ledColor;
      uniform float strength;
      uniform float fadeReach;
      uniform float faceSign;
      varying vec3 ledPosition;
      varying vec3 ledNormal;
      void main() {
        float face = smoothstep(0.7, 0.95, normalize(ledNormal).z * faceSign);
        float dx = (ledPosition.x + 159.8) / fadeReach;
        float dy = (ledPosition.y - 48.5) / (ledPosition.y < 48.5 ? ${WING_FALL_BELOW.toFixed(1)} : 7.0);
        float pool = exp(-0.5 * (dx * dx + dy * dy));
        float alpha = min(0.75, 0.38 * strength * pool * face);
        gl_FragColor = vec4(ledColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    ...OVERLAY,
    side: THREE.FrontSide,
  });
  const spill = new THREE.Mesh(plate.geometry, material);
  spill.name = `${plate.name} LED leg (wing glow)`;
  spill.renderOrder = 1;
  spill.raycast = () => {};
  spill.castShadow = spill.receiveShadow = false;
  spill.userData.filmFx = true;
  plate.add(spill);
  const frame = new THREE.Matrix4();
  spill.onBeforeRender = () => {
    frame.copy(wing.matrixWorld).invert().multiply(plate.matrixWorld);
    material.uniforms.reflectionFrame.value.copy(frame);
    material.uniforms.reflectionNormal.value.getNormalMatrix(frame);
  };
  list.push({ material, receiver, minReach, maxReach, sourceIds: [sourceId], mesh: spill });
}

// ---- addFloorBounce (shader body verbatim but for the pixel-less fallback, see the header) ----
function addFloorBounce(list, parent, floorY, model, sources, pixels, sides, ledColorUniform) {
  const n = sources.length;
  const rows = sources.map(({ id }) => pixels.strips.findIndex((s) => s.id === id));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...pixels.uniforms,
      ledColor: ledColorUniform,
      strength: { value: 0 },
      fadeReach: { value: 1 },
      planeToModel: { value: new THREE.Matrix4() },
      srcA: { value: sources.map(() => new THREE.Vector3()) },
      srcB: { value: sources.map(() => new THREE.Vector3()) },
      srcOn: { value: sources.map(() => 1) },
      srcGain: { value: sources.map((s) => s.gain ?? 1) },
      srcN: { value: sources.map(() => new THREE.Vector3()) },
      heightRef: { value: FLOOR_BOUNCE_HEIGHT_REF },
      rise: { value: 0 },
      sitGain: { value: FLOOR_SIT_GAIN },
      standGain: { value: FLOOR_STAND_GAIN },
      sideWall: { value: sides.map(() => new THREE.Vector4()) },
    },
    vertexShader: `
      uniform mat4 planeToModel;
      varying vec3 floorPos;
      varying vec2 floorUv;
      void main() {
        floorPos = (planeToModel * vec4(position, 1.0)).xyz;
        floorUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: samplingGLSL + `
      uniform vec3 ledColor;
      uniform float strength;
      uniform vec3 srcA[${n}];
      uniform vec3 srcB[${n}];
      uniform float srcOn[${n}];
      uniform float srcGain[${n}];
      uniform vec3 srcN[${n}];
      uniform vec4 sideWall[${Math.max(1, sides.length)}];
      float wallPass(vec3 S, vec3 P) {
        float pass = 1.0;
        for (int j = 0; j < ${sides.length}; j++) {
          vec4 w = sideWall[j];
          float sp = (P.z - w.x) * w.y, ss = (S.z - w.x) * w.y;
          if (sp > 0.0 && ss < 0.0) {
            float x = mix(S.x, P.x, (w.x - S.z) / (P.z - S.z));
            float across = smoothstep(w.z - 2.0, w.z + 1.0, x) * (1.0 - smoothstep(w.w - 1.0, w.w + 2.0, x));
            pass *= 1.0 - across * smoothstep(0.0, 3.0, sp);
          }
        }
        return pass;
      }
      uniform float heightRef;
      uniform float rise;
      uniform float sitGain;
      uniform float standGain;
      varying vec3 floorPos;
      varying vec2 floorUv;
      void main() {
        vec3 rgb = vec3(0.0);
        float total = 0.0;
        ${rows.map((row, i) => `{
          vec3 A = srcA[${i}], B = srcB[${i}];
          float e = 0.0;
          for (int k = 0; k < 5; k++) {
            vec3 S = mix(A, B, (float(k) + 0.5) / 5.0);
            vec3 v = S - floorPos;
            float r = max(length(v), 0.5);
            float facing = dot(srcN[${i}], srcN[${i}]) > 0.0 ? max(dot(srcN[${i}], -v / r), 0.0) : 1.0;
            e += facing * wallPass(S, floorPos) * max(v.y, 0.0) / (r * r * r) / 5.0
              * pow(max(v.y, 0.5) / heightRef, 2.0 * rise);
          }
          e *= heightRef * heightRef * srcOn[${i}] * srcGain[${i}];
          vec3 ab = B - A;
          float t = clamp(dot(floorPos - A, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
          vec3 c = efPixelActive > 0.5 ? (efLedSample(t, ${row.toFixed(1)}) + efLedSample(t - 1.0 / efPixelCounts[${row}], ${row.toFixed(1)})
            + efLedSample(t + 1.0 / efPixelCounts[${row}], ${row.toFixed(1)})) / 3.0 : ledColor;
          rgb += c * e;
          total += e;
        }`).join('\n')}
        float edge = 1.0 - smoothstep(0.30, 0.5, length(floorUv - 0.5));
        vec3 color = rgb / max(total, 0.0001);
        float level = dot(rgb, vec3(0.2126, 0.7152, 0.0722)) / max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
        float alpha = min(0.65, 0.30 * strength * mix(sitGain, standGain, rise) * level * edge);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), material);
  glow.name = 'LED floor bounce';
  glow.userData.noCameraFit = true;
  glow.userData.filmFx = true;
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(-159.2, floorY + 0.02, -327.1);
  glow.renderOrder = 3;
  glow.raycast = () => {};
  glow.castShadow = glow.receiveShadow = false;
  parent.add(glow);
  const ends = sources.map(({ part, axis, frame, a: fa, b: fb, normal }) => {
    if (frame) return { mesh: frame, part: frame, a: fa, b: fb, n: normal };
    let mesh = null;
    part.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
    const a = c.clone(), b = c.clone();
    a[axis] = bb.min[axis];
    b[axis] = bb.max[axis];
    return { mesh, part, a, b };
  });
  const toModel = new THREE.Matrix4(), inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), box = new THREE.Box3();
  glow.onBeforeRender = () => {
    inv.copy(model.matrixWorld).invert();
    material.uniforms.planeToModel.value.multiplyMatrices(inv, glow.matrixWorld);
    sides.forEach(({ wing, outward }, j) => {
      box.copy(wing.geometry.boundingBox).applyMatrix4(toModel.multiplyMatrices(inv, wing.matrixWorld));
      material.uniforms.sideWall.value[j].set(outward > 0 ? box.max.z : box.min.z, outward, box.min.x, box.max.x);
    });
    ends.forEach(({ mesh, part, a, b, n: normal }, i) => {
      toModel.multiplyMatrices(inv, mesh.matrixWorld);
      material.uniforms.srcA.value[i].copy(a).applyMatrix4(toModel);
      material.uniforms.srcB.value[i].copy(b).applyMatrix4(toModel);
      if (normal) material.uniforms.srcN.value[i].copy(normal).applyMatrix3(nm.getNormalMatrix(toModel)).normalize();
      let on = true;
      for (let node = part; node; node = node.parent) on &&= node.visible;
      material.uniforms.srcOn.value[i] = on ? 1 : 0;
    });
  };
  list.push({ material, receiver: 'floorBounce', custom: true, glow });
  return glow;
}

const meshNamed = (root, name) => { let m = null; root.traverse((o) => { if (!m && o.isMesh && o.name === name) m = o; }); return m; };
const named = (root, name) => { let m = null; root.traverse((o) => { if (!m && o.name === name) m = o; }); return m; };
const shownIn = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

export function installViewerLeds(shot) {
  const raw = shot.ledReceivers;
  const spec = { floorBounce: true, legWings: true, wingFallBelow: true, bands: true, wingRows: 'beside', indicatorLift: true,
    stripMap: 'app', appFloorGlow: true, ...APP_SURFACE_DEFAULTS, ...(typeof raw === 'object' ? raw : {}) };
  const model = api.loadedModel, pixels = api.ledPixelRenderer, renderer = api.renderer;
  if (!model || !pixels) { console.warn('[viewer-leds] no desk or LED pixel renderer'); return null; }
  let scene = model; while (scene.parent) scene = scene.parent; scene.updateMatrixWorld(true);
  const undo = [], list = [];
  const appGlow = named(model, 'Foot LED floor glow');
  if (!appGlow?.material?.uniforms?.efPixelTexture) { console.warn('[viewer-leds] no bound Foot LED floor glow'); return null; }
  const leftWing = meshNamed(model, 'Desktop_1'), rightWing = meshNamed(model, 'Desktop_2');
  if (!leftWing || !rightWing) { console.warn('[viewer-leds] no wing panels'); return null; }
  const patchShader = (material, edit) => {
    const before = material.fragmentShader, after = edit(before);
    if (after === before) return false;
    material.fragmentShader = after; material.needsUpdate = true;
    undo.push(() => { material.fragmentShader = before; material.needsUpdate = true; });
    return true;
  };

  // Side strips (both size groups) and the one physically beside each wing (nearest in Z, among the visible ones).
  const inv = model.matrixWorld.clone().invert();
  const groups = ['Standard desktop underside LEDs', 'Extended desktop underside LEDs'].map((n) => named(model, n)).filter(Boolean);
  const zOf = (o) => { const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv); return (b.min.z + b.max.z) / 2; };
  const wingZ = (wing) => { wing.geometry.computeBoundingBox(); return wing.geometry.boundingBox.getCenter(new THREE.Vector3()).z; };
  const sideParts = groups.flatMap((g) => [g.children[0], g.children[1]]).filter(Boolean);
  const besideStrip = (wing) => {
    const z = wingZ(wing), live = sideParts.filter(shownIn), pool = live.length ? live : sideParts;
    return pool.reduce((a, b) => (Math.abs(zOf(b) - z) < Math.abs(zOf(a) - z) ? b : a));
  };
  const wingInfo = [[leftWing, 'leftWing', 'Base_Panels_1'], [rightWing, 'rightWing', 'Base_Panels']].map(([wing, receiver, plate]) => {
    const strip = besideStrip(wing), outer = wing.children.find((c) => /outer reflection$/.test(c.name));
    const appRow = outer?.material.userData.ledSpillSources?.[0];
    return { wing, receiver, plate, strip, id: spec.wingRows === 'app' && Number.isInteger(appRow) ? appRow : strip.userData.ledPhysicalId, outer };
  });
  const rowOf = (id) => pixels.strips.findIndex((s) => s.id === id);

  // Wing panels: the visualizer's slower fall-off below the glow centre, and the colour of the strip beside it.
  for (const w of wingInfo) {
    for (const c of w.wing.children) {
      if (!/LED wing (outer reflection|inner bounce)$/.test(c.name) || !c.material?.fragmentShader) continue;
      if (spec.wingFallBelow) patchShader(c.material, (s) => s.replace('float dy = (ledPosition.y - 48.5) / 7.0;',
        `float dy = (ledPosition.y - 48.5) / (ledPosition.y < 48.5 ? ${WING_FALL_BELOW.toFixed(1)} : 7.0);`));
      const from = c.material.userData.ledSpillSources?.[0];
      if (c === w.outer && spec.wingRows !== 'app' && Number.isInteger(from) && from !== w.id) {
        const a = rowOf(from), b = rowOf(w.id);
        patchShader(c.material, (s) => s.split(`efPixelCounts[${a}], ${a}.0)`).join(`efPixelCounts[${b}], ${b}.0)`)
          .split(`efLedSample(efLocal, ${a}.0)`).join(`efLedSample(efLocal, ${b}.0)`));
      }
    }
  }

  // Desktop depth bands in the visualizer's order (the band uniforms belong to the depth position, the sampled rows
  // to the sources: give each source its visualizer position).
  if (spec.bands) model.traverse((o) => {
    const u = o.material?.uniforms; if (!u?.reflectionBandActive?.value || !o.material.userData.ledSpillSources) return;
    const ids = o.material.userData.ledSpillSources, at = ids.map((id) => DESKTOP_REFLECTION_BANDS.find((b) => b.sourceId === id));
    if (at.some((b) => !b)) return;
    const saved = [u.reflectionBandCenters.value.clone(), u.reflectionBandGains.value.clone(), u.reflectionBandWidths.value.clone()];
    u.reflectionBandCenters.value.set(...at.map((b) => b.centerX)); u.reflectionBandGains.value.set(...at.map((b) => b.gain)); u.reflectionBandWidths.value.set(...at.map((b) => b.width));
    undo.push(() => { u.reflectionBandCenters.value.copy(saved[0]); u.reflectionBandGains.value.copy(saved[1]); u.reflectionBandWidths.value.copy(saved[2]); });
  });

  // Leg spill: the wing glow down the side plates.
  if (spec.legWings) for (const w of wingInfo) {
    const plate = meshNamed(model, w.plate); if (!plate || !w.outer) continue;
    addLegWingSpill(list, plate, w.wing, w.receiver, w.id);
    const entry = list.at(-1), source = pixels.bindings.find((b) => b.stripId === w.id);
    pixels.bindSpill(entry, [w.id], [source.min, source.max], `ledPosition.${source.axis}`);
    entry.material.uniforms.ledColor = w.outer.material.uniforms.ledColor;   // the app writes the panel's colour each frame
    entry.panel = w.outer.material;
    undo.push(() => { entry.mesh.removeFromParent(); entry.material.dispose(); });
  }

  // Floor bounce.
  let bounce = null;
  if (spec.floorBounce) {
    const sources = groups.flatMap((g) => [2, 0, 1].map((i) => g.children[i]).filter((p) => p && Number.isInteger(p.userData.ledPhysicalId))
      .map((part) => ({ id: part.userData.ledPhysicalId, part, axis: pixels.strips.find((s) => s.id === part.userData.ledPhysicalId).axis })));
    const wingSource = (w) => {
      w.wing.geometry.computeBoundingBox();
      const wb = w.wing.geometry.boundingBox;
      const outward = Math.sign(wb.getCenter(new THREE.Vector3()).z + 327.1) || 1;
      const z = (outward > 0 ? wb.max.z : wb.min.z) + 1.5 * outward;
      const strip = pixels.bindings.find((b) => b.part === w.strip) || pixels.bindings.find((b) => b.stripId === w.id);
      return { id: w.id, frame: w.wing, gain: spec.wingFloorGain ?? WING_FLOOR_GAIN, normal: new THREE.Vector3(0, 0, outward),
        a: new THREE.Vector3(strip.min, WING_GLOW_Y, z), b: new THREE.Vector3(strip.max, WING_GLOW_Y, z) };
    };
    const sides = wingInfo.map((w) => ({ wing: w.wing, outward: Math.sign(wingZ(w.wing) + 327.1) || 1 }));
    bounce = addFloorBounce(list, appGlow.parent, appGlow.position.y, model, [...sources, ...wingInfo.map(wingSource)], pixels, sides, appGlow.material.uniforms.ledColor);
    undo.push(() => { bounce.removeFromParent(); bounce.geometry.dispose(); bounce.material.dispose(); });
  }
  // The app's foot floor glow: kept (the visualizer keeps it), drawn over the stage's contact shadow.
  { const vis = appGlow.visible, ro = appGlow.renderOrder; appGlow.visible = spec.appFloorGlow !== false; appGlow.renderOrder = 3; undo.push(() => { appGlow.visible = vis; appGlow.renderOrder = ro; }); }

  // Pixel uploads: the indicator level (and optionally the visualizer's strip map).
  let lift = 1;
  const upload = pixels.upload, reverseRows = pixels.strips.map((s, i) => s.axis === 'z' ? i : -1).filter((i) => i >= 0);
  const r5 = rowOf(5), r6 = rowOf(6);
  pixels.upload = function (frame, linear) {
    // Only the film's status indicators (ledStatus) are lifted, as the visualizer lifts only its indicators.
    lift = spec.indicatorLift && shot.ledStatus ? indicatorLift(frame) : 1;
    if (spec.stripMap === 'viewer') {
      const out = frame.map((row) => row.slice());
      for (const i of reverseRows) { const n = out[i].length / 4; for (let p = 0; p < n; p++) out[i].set(frame[i].subarray((n - 1 - p) * 4, (n - p) * 4), p * 4); }
      if (r5 >= 0 && r6 >= 0 && out[r5].length === out[r6].length) { out[r5] = frame[r6].slice(); out[r6] = frame[r5].slice(); }
      frame = out;
    }
    return upload.call(this, frame, linear);
  };
  undo.push(() => { pixels.upload = upload; });

  // Per render: level (the app's, times the indicator lift on pixel frames), rise, and the new receivers' strengths.
  const appSpills = [];
  model.traverse((o) => { const u = o.material?.uniforms; if (u?.strength && o.material.isShaderMaterial && /LED/.test(o.name) && !o.userData.filmFx) appSpills.push(u); });
  const ours = list.map((e) => e.material.uniforms);
  // Held once: film-quality's glow pass swaps non-glow meshes to a black material inside render (HQ14g crash on Win).
  const U = appGlow.material.uniforms, panelU = new Map(list.filter((e) => e.panel).map((e) => [e, e.panel.uniforms]));
  const direct = renderer.render;
  renderer.render = function (sc, cam) {
    const surfaces = api.ledSurfaces;
    // The app's glow x effect gain, recovered from a receiver it drives (strength = glow * S / 10000 * gain).
    const glow = surfaces.floorStrength > 0 ? U.strength.value * 10000 / surfaces.floorStrength : api.ledsEnabled ? api.ledGlow : 0;
    for (const e of list) {
      if (e.receiver === 'floorBounce') e.material.uniforms.strength.value = glow * spec.floorBounceStrength / 10000;
      else if (e.panel) { const pu = panelU.get(e); e.material.uniforms.strength.value = pu.strength.value; e.material.uniforms.fadeReach.value = pu.fadeReach.value; }
    }
    if (bounce) {
      const r = THREE.MathUtils.clamp((api.heightInches - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN), 0, 1);
      bounce.material.uniforms.rise.value = r; const k = 1 + FLOOR_RISE_WIDEN * r; bounce.scale.set(k, k, 1);
    }
    const k = pixels.uniforms.efPixelActive.value > 0.5 ? lift : 1;
    if (k === 1) return direct.call(this, sc, cam);
    const all = [...appSpills, ...ours], saved = all.map((u) => u.strength.value), power = pixels.uniforms.efPixelPower.value;
    all.forEach((u) => { u.strength.value *= k; }); pixels.uniforms.efPixelPower.value = power * k;
    try { return direct.call(this, sc, cam); } finally { all.forEach((u, i) => { u.strength.value = saved[i]; }); pixels.uniforms.efPixelPower.value = power; }
  };
  undo.push(() => { renderer.render = direct; });

  const info = { wings: wingInfo.map((w) => `${w.wing.name}:${w.id}${w.outer?.material.userData.ledSpillSources?.[0] !== w.id ? ' (app ' + w.outer?.material.userData.ledSpillSources?.[0] + ')' : ''}`),
    legs: list.filter((e) => e.panel).length, bounceSources: bounce ? bounce.material.uniforms.srcA.value.length : 0, stripMap: spec.stripMap };
  return { info, restore() { for (const f of undo.reverse()) { try { f(); } catch (e) { console.warn('[viewer-leds] restore', e); } } } };
}
