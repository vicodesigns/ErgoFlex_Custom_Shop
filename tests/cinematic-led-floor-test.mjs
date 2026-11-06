// The floor's LED colour in lit rooms (film-viewer-leds.mjs floorHue / addFloorTint) and the floor / wall LED split
// (film-lighting cleanLighting, the Director's GLOBALS). Node only: the shader text and the tint maths, no GPU.
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
const THREE = await import('three');
const { floorHue, addFloorTint, FLOOR_TINT, FLOOR_TINT_MAX } = await import('../tools/experience/film-viewer-leds.mjs');

// A floor overlay as the app writes them: colour + alpha, tone mapped, sRGB, additive.
const overlay = () => {
  const m = new THREE.ShaderMaterial({ uniforms: { strength: { value: .5 }, ledColor: { value: new THREE.Color(1, 0, 0) } },
    vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 ledColor; uniform float strength; void main(){ gl_FragColor = vec4(ledColor, strength);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.name = 'Foot LED floor glow'; mesh.renderOrder = 3; return mesh;
};
// floorHue: the colour is tone mapped at no more than exposure 1 (stage chapters, exposure <= 1, keep theirs); idempotent; undo restores.
{
  const o = overlay(), before = o.material.fragmentShader, undo = floorHue(o.material);
  assert.ok(o.material.fragmentShader.includes('gl_FragColor.rgb /= max( toneMappingExposure, 1.0 );'));
  assert.ok(o.material.fragmentShader.indexOf('toneMappingExposure, 1.0') < o.material.fragmentShader.indexOf('#include <tonemapping_fragment>'), 'before the tone mapping');
  assert.ok(o.material.fragmentShader.includes('#if defined( TONE_MAPPING )'), 'guarded: the uniform exists only with tone mapping on');
  assert.equal(floorHue(o.material), null, 'patched once');
  undo(); assert.equal(o.material.fragmentShader, before);
}
// addFloorTint: a multiply pass drawn just before the overlay, on the same uniform objects, as its child.
{
  const o = overlay(), tint = { amount: { value: FLOOR_TINT }, max: { value: FLOOR_TINT_MAX } }, undo = addFloorTint(o, tint), t = o.children[0];
  assert.equal(t.name, 'Foot LED floor glow tint'); assert.equal(t.renderOrder, 2.5); assert.equal(t.geometry, o.geometry);
  assert.equal(t.material.uniforms.strength, o.material.uniforms.strength, 'shares the strength the app writes');
  assert.equal(t.material.uniforms.efFloorTint, tint.amount);
  assert.equal(t.material.blending, THREE.CustomBlending); assert.equal(t.material.blendSrc, THREE.ZeroFactor); assert.equal(t.material.blendDst, THREE.SrcColorFactor);
  assert.ok(t.userData.filmFx, 'skipped by the viewer\'s own spill scan');
  assert.notEqual(t.onBeforeRender, THREE.Object3D.prototype.onBeforeRender, 'its own hook keeps it out of film-quality\'s black swap');
  assert.equal(o.material.uniforms.efFloorTint, undefined, 'the app\'s uniforms are not touched');
  undo(); assert.equal(o.children.length, 0);
}
// The tint maths (TINT_OUT in JS): red on a sunlit cream rug reads red, white light and an unlit strip leave the floor.
{
  const blend = (floor, rgb, a) => { const peak = Math.max(...rgb), hue = rgb.map(c => c / Math.max(peak, 1e-4)), k = Math.min(FLOOR_TINT_MAX, FLOOR_TINT * a * Math.min(1, peak));
    return floor.map((d, i) => Math.min(1, d * (1 + (hue[i] - 1) * k) + rgb[i] * a)); };
  const rug = [.84, .71, .62], red = [.97, .19, .19];
  const old = rug.map((d, i) => Math.min(1, d + [.98, .40, .40][i] * .3)), now = blend(rug, red, .3);
  assert.ok(old[1] > .8 && old[2] > .7, 'before: the pool lifted green and blue (pale pink)');
  assert.ok(now[0] > .99 && now[1] < .55 && now[2] < .5 && now[1] < old[1] - .3, 'after: red reads red (one overlay; the bounce and foot glow overlap) ' + now.map(v => v.toFixed(2)));
  assert.deepEqual(blend(rug, [.3, .3, .3], .3).map(v => +v.toFixed(3)), rug.map((d, i) => +Math.min(1, d + .09).toFixed(3)), 'white light only adds');
  assert.deepEqual(blend(rug, [0, 0, 0], .4), rug, 'an unlit strip leaves the floor');
  assert.ok(blend([.05, .05, .06], red, .3).every((v, i) => Math.abs(v - Math.min(1, [.05, .05, .06][i] + red[i] * .3)) < .05), 'a dark (stage) floor barely changes');
}
console.log('cinematic-led-floor-test ok');
