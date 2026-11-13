// Film render quality overrides (HQ13, GPU render box). Installed by film-fx when a shot carries
// `quality` (render-cut --quality hq13 adds it to every shot); everything is restored by restore().
//   shadowMap: 4096           light.shadow.mapSize for every shadow-casting light (the stage clamps to 1024)
//   shadowRadius: 2           VSM blur radius multiplier in texels (4x texels x 2 = half the world-space softness: crisper contacts)
//   shadowSamples: 25         VSM blur samples
//   anisotropy: 16            every material texture slot (clamped to the GPU max)
//   reflections: 512          room cube capture (PMREM) as envMap on glossy/metal materials, instead of the studio env
//   ao: {intensity, radius}   GTAO ambient occlusion; radius as a fraction of the desk width
//   bloom: {strength, radius, threshold}  selective bloom on screens, LED strips and emissive fixtures only
//   bloomOnly: '<regex>'      only meshes under a node whose name matches keep the bloom (HQ21, Vico: no bloom on screens,
//                             desk light or LEDs; only the light from outside: 'window|daylight')
//   screenBloom: 1            the screens' share of the bloom (0 = none: sharp screens; .25 = a quarter). Vico, HQ20.
//   bloomReceivers: true      false keeps the LED light ON surfaces (the app's '<surface> LED reflection' overlays, the film's
//                             'LED floor bounce') out of the bloom: lit surfaces, not sources (Vico, HQ18: the light looked hazy)
// ao/bloom run through an EffectComposer that replaces the main canvas render; tone mapping and output
// colour space move to OutputPass, so with both off the image matches the direct render.
import * as THREE from 'three';

const api = window.ErgoFlex;
const ADDONS = 'three/addons/postprocessing/';
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap', 'alphaMap', 'clearcoatNormalMap'];
const LEDISH = /\bLEDs?\b|LED strip|led-strip/i, NOT_BLOOM = /floor glow|floor light|film floor/i;
const RECEIVER = /LED reflection|LED floor bounce/i;
const SCREENISH = /screen|display|monitor|\btv\b|marquee|stage media/i;
export const PRESETS = {
  hq13: { shadowMap: 4096, shadowRadius: 2, shadowSamples: 25, anisotropy: 16, reflections: 512,
          ao: { intensity: .45, radius: .12 }, bloom: { strength: .16, radius: .28, threshold: .0 } }
};

const sceneRoot = () => { let s = api.loadedModel; while (s?.parent) s = s.parent; return s; };
const named = (o, re) => { for (let p = o; p; p = p.parent) if (re.test(p.name || '')) return true; return false; };
const luma = c => c ? .2126 * c.r + .7152 * c.g + .0722 * c.b : 0;

export async function installQuality(shot, { screens = [] } = {}) {
  const q = typeof shot.quality === 'string' ? PRESETS[shot.quality] : { ...PRESETS.hq13, ...shot.quality };
  if (!q) return null;
  const renderer = api.renderer, scene = sceneRoot(), undo = [], info = {};
  const desk = new THREE.Box3().setFromObject(api.loadedModel), deskSize = desk.getSize(new THREE.Vector3());
  const deskWidth = Math.max(deskSize.x, deskSize.z) || 1;

  // ---- shadows -------------------------------------------------------------------------
  const lights = [];
  if (q.shadowMap) {
    scene.traverse(o => { if (o.isLight && o.castShadow && o.shadow) lights.push({ o, size: o.shadow.mapSize.clone(), radius: o.shadow.radius, samples: o.shadow.blurSamples }); });
    undo.push(() => { for (const l of lights) { l.o.shadow.mapSize.copy(l.size); l.o.shadow.radius = l.radius; l.o.shadow.blurSamples = l.samples; resetShadow(l.o); } });
    info.shadows = lights.length;
  }
  const max = renderer.capabilities.maxTextureSize || 4096;
  const applyShadows = () => {
    for (const l of lights) {
      const s = Math.min(q.shadowMap, max), sh = l.o.shadow;
      if (sh.mapSize.x === s && sh.mapSize.y === s) continue;
      sh.mapSize.set(s, s); sh.radius = l.radius * (q.shadowRadius ?? 1); sh.blurSamples = q.shadowSamples ?? l.samples; resetShadow(l.o);
      renderer.shadowMap.needsUpdate = true;
    }
  };
  applyShadows();

  // ---- texture anisotropy ------------------------------------------------------------------
  if (q.anisotropy) {
    const a = Math.min(q.anisotropy, renderer.capabilities.getMaxAnisotropy?.() || 1), seen = new Map();
    scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) for (const k of SLOTS) {
      const t = m[k]; if (!t?.isTexture || seen.has(t) || t.anisotropy >= a) continue; seen.set(t, t.anisotropy); t.anisotropy = a; t.needsUpdate = true; } });
    undo.push(() => { for (const [t, v] of seen) { t.anisotropy = v; t.needsUpdate = true; } });
    info.anisotropy = [a, seen.size];
  }

  // ---- room reflections ----------------------------------------------------------------------
  if (q.reflections) {
    const rt = new THREE.WebGLCubeRenderTarget(q.reflections, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(deskWidth * .01, deskWidth * 60, rt);
    const c = desk.getCenter(new THREE.Vector3()); cam.position.set(c.x, desk.min.y + deskSize.y * .75, c.z); scene.add(cam);
    const was = api.loadedModel.visible; api.loadedModel.visible = false;
    try { cam.update(renderer, scene); } finally { api.loadedModel.visible = was; cam.removeFromParent(); }
    // how bright the capture is (mean radiance of each face's middle): a black capture turns every metal in the film black
    try {
      const n = 16, buf = new Uint16Array(n * n * 4), at = Math.floor((q.reflections - n) / 2), level = [];
      for (let face = 0; face < 6; face++) { renderer.readRenderTargetPixels(rt, at, at, n, n, buf, face); let sum = 0; for (let i = 0; i < n * n; i++) sum += (THREE.DataUtils.fromHalfFloat(buf[i * 4]) + THREE.DataUtils.fromHalfFloat(buf[i * 4 + 1]) + THREE.DataUtils.fromHalfFloat(buf[i * 4 + 2])) / 3; level.push(+(sum / (n * n)).toFixed(3)); }
      info.reflectionLevel = level;      // +x, -x, +y (ceiling), -y (floor), +z, -z
    } catch (error) { info.reflectionLevel = String(error).slice(0, 80); }
    const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromCubemap(rt.texture).texture; pmrem.dispose(); rt.dispose();
    // Metals and clear plastics in a room already reflect a room (studio.js roomGlossPass: the same in the Studio
    // and here, at the room's own level). They keep it: this capture is taken inside a room whose ceiling and near
    // walls are cut away for the camera and often comes out black (reflectionLevel above), which turned the film's
    // aluminium black. What is left for the capture: glass and whatever else has no environment of its own yet.
    api.applyRoomGloss?.();
    const swapped = [];
    scene.traverse(o => { if (!o.isMesh || within(o, api.loadedModel) && named(o, LEDISH)) return;
      for (const m of [].concat(o.material || [])) {
        if (!m.isMeshStandardMaterial || m.envMap || swapped.some(s => s.m === m)) continue;
        // envMap feeds the diffuse IBL too, so only metals and glass (little or no diffuse) get the room capture;
        // glossy dielectrics (desk tops, paint) keep the studio environment or their colour shifts.
        const reflective = m.metalness >= .6 || m.transmission > 0; if (!reflective) continue;
        swapped.push({ m, intensity: m.envMapIntensity }); m.envMap = env; m.envMapIntensity = m.envMapIntensity * (scene.environmentIntensity ?? 1); m.needsUpdate = true;
      } });
    undo.push(() => { for (const s of swapped) { s.m.envMap = null; s.m.envMapIntensity = s.intensity; s.m.needsUpdate = true; } env.dispose(); });
    info.reflections = swapped.length;
  }

  // ---- post: GTAO + selective bloom --------------------------------------------------------
  let post = null;
  if (q.ao || q.bloom) post = await installPost(renderer, scene, q, deskWidth, screens, info);
  if (post) undo.push(post.restore);

  return { info, frame: applyShadows, restore: () => { for (const f of undo.reverse()) { try { f(); } catch (e) { console.warn('[film-quality] restore', e); } } } };
}

function within(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
function resetShadow(light) { const sh = light.shadow; sh.map?.dispose(); sh.map = null; sh.mapPass?.dispose(); sh.mapPass = null; }

// Post as a compositor over the normal canvas render: the beauty pass is the app's own direct render (so the look,
// sRGB-space blending of the light pools and MSAA are unchanged), then AO is multiplied and the bloom glow added on top.
async function installPost(renderer, scene, q, deskWidth, screens, info) {
  const [{ GTAOPass }, { UnrealBloomPass }, { FullScreenQuad }] = await Promise.all(
    ['GTAOPass', 'UnrealBloomPass', 'Pass'].map(n => import(ADDONS + n + '.js')));
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()), cam0 = new THREE.PerspectiveCamera();
  let gtao = null;
  if (q.ao) {
    gtao = new GTAOPass(scene, cam0, size.x, size.y, undefined, { radius: deskWidth * q.ao.radius, distanceExponent: 1, thickness: deskWidth * .02, scale: 1, samples: 16 }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.output = GTAOPass.OUTPUT.Off;
  }
  // The glow set (screens, LEDs, emissive fixtures) over black: the bloom source, and the AO mask (no AO on light sources).
  const glowRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const aoQuad = gtao && new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tAO: { value: gtao.pdRenderTarget.texture }, tMask: { value: glowRT.texture }, intensity: { value: q.ao.intensity } },
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tAO, tMask; uniform float intensity; varying vec2 vUv; void main(){ float lit = step(.002, dot(texture2D(tMask, vUv).rgb, vec3(1.))); gl_FragColor = vec4(vec3(mix(1., texture2D(tAO, vUv).r, intensity * (1. - lit))), 1.); }' }));
  let bloom = null, others = null, muted = [], dimmed = [], black = null, glowQuad = null;
  if (q.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), q.bloom.strength, q.bloom.radius, q.bloom.threshold);
    // Glow (linear) added over the display-referred canvas: encode to sRGB first, additive blend.
    glowQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tGlow: { value: bloom.renderTargetsHorizontal[0].texture } }, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tGlow; varying vec2 vUv; void main(){ vec3 g = max(texture2D(tGlow, vUv).rgb, 0.0); gl_FragColor = vec4(pow(g / (1.0 + g), vec3(1.0 / 2.2)), 1.0); }' }));
  }
  {
    black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const screenMeshes = new Set(screens.map(s => s.mesh)); let n = 0; others = []; muted = []; dimmed = [];
    // The glow set is also the AO mask (no AO on light sources): with the bloom off, bloomOnly / screenBloom would only
    // take screens and LEDs out of the mask and AO would darken them (HQ22: the OCC monitors looked turned down).
    const bloomOnly = q.bloom && q.bloomOnly ? new RegExp(q.bloomOnly, 'i') : null;
    scene.traverse(o => { if (!o.isMesh) return;
      const m = [].concat(o.material || [])[0];
      // Meshes with their own onBeforeRender (the film's LED floor bounce reads its shader's uniforms there) and the LED
      // surface overlays are hidden in the glow pass, never swapped to the black material (HQ21 crash on awareness).
      const custom = o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender;
      if (bloomOnly) { if (named(o, bloomOnly)) n++; else if (custom || named(o, RECEIVER)) muted.push(o); else others.push(o); return; }
      // bloomReceivers false: the surface overlays are hidden (not blacked: their own onBeforeRender needs their shader) in the glow pass.
      if (q.bloomReceivers === false && named(o, RECEIVER)) { muted.push(o); return; }
      const isScreen = screenMeshes.has(o) || (m?.isMeshBasicMaterial && m.map && named(o, SCREENISH));
      if (q.bloom && isScreen && q.screenBloom !== undefined && Number(q.screenBloom) < 1) {
        if (Number(q.screenBloom) <= 0) { others.push(o); return; }
        dimmed.push(o); n++; return;
      }
      const glow = !named(o, NOT_BLOOM) && (screenMeshes.has(o) || named(o, LEDISH) || (m?.isMeshBasicMaterial && m.map && named(o, SCREENISH)) || (m?.emissive && luma(m.emissive) * (m.emissiveIntensity ?? 1) > .3));
      if (glow) n++; else others.push(o); });
    info.bloom = n;
  }
  info.ao = !!gtao;

  const direct = renderer.render; let busy = false;
  renderer.render = function (sc, cam) {
    if (busy || this.getRenderTarget() !== null || sc !== scene || !cam?.isCamera) return direct.call(this, sc, cam);
    busy = true; const auto = this.shadowMap.autoUpdate;
    try {
      direct.call(this, sc, cam);                       // beauty, exactly as without post
      this.shadowMap.autoUpdate = false;                // the extra scene passes below must not redraw shadow maps
      const s = this.getDrawingBufferSize(new THREE.Vector2());
      if (s.x !== size.x || s.y !== size.y) { size.copy(s); gtao?.setSize(s.x, s.y); bloom?.setSize(s.x, s.y); glowRT.setSize(s.x, s.y); }
      {
        const bg = sc.background, saved = others.map(o => o.material), shown = muted.map(o => o.visible); sc.background = null;
        for (const o of others) o.material = black;
        for (const o of muted) o.visible = false;
        // screenBloom < 1: the screens draw into the glow set at that fraction of their colour (their own material,
        // toned down for this pass only), so their bloom is that fraction too.
        const k = Number(q.screenBloom), dimSaved = [...new Set(dimmed.map(o => [].concat(o.material)[0]).filter(mm => mm?.color))].map(mm => { const c = mm.color.clone(); mm.color.multiplyScalar(k); return [mm, c]; });   // once per shared material
        const ac = this.autoClear; this.autoClear = true;
        try { this.setRenderTarget(glowRT); direct.call(this, sc, cam); } finally { others.forEach((o, i) => { o.material = saved[i]; }); muted.forEach((o, i) => { o.visible = shown[i]; }); dimSaved.forEach(([mm, c]) => mm.color.copy(c)); sc.background = bg; this.setRenderTarget(null); this.autoClear = ac; }
      }
      const ac = this.autoClear; this.autoClear = false;
      try {
        if (gtao) { gtao.camera = cam; gtao.render(this, null, null); this.setRenderTarget(null); aoQuad.render(this); }   // AO multiplied onto the canvas, masked
        if (bloom) { bloom.renderToScreen = false; bloom.render(this, null, glowRT); this.setRenderTarget(null); this.autoClear = false; glowQuad.render(this); }
      } finally { this.autoClear = ac; }
    } finally { this.shadowMap.autoUpdate = auto; this.setRenderTarget(null); busy = false; }
  };
  return { restore: () => { renderer.render = direct; gtao?.dispose?.(); bloom?.dispose?.(); glowRT.dispose(); black?.dispose(); glowQuad?.dispose(); aoQuad?.material.dispose(); aoQuad?.dispose(); } };
}
