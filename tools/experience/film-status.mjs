// Render-harness-only: status-indicator light show and simulated obstacle.
// Loaded by film-fx.mjs when a shot has ledStatus or obstacles, inside the
// disposable stage iframe. Nothing in the app imports it.
//
//   ledStatus:[{at, dur, kind, mode?}]   times in chapter seconds
//     kind 'lift-up'      FX34 vertical wavefront, blue   (ColorLiftUp   0,0,255); strip 2 dark
//          'lift-down'    FX34 reversed wavefront, red    (ColorLiftDown 255,0,0); strip 2 dark
//                         (the API's liftDarkStrips, ergoled_native_anim.go)
//          'tilt-extend'  FX35 sway, yellow 255,255,0;  'tilt-retract' FX35 reversed, purple 150,0,255
//          (Vico, real desk: tilt angle increasing / board steepening = tilt down = purple 'tilt-retract'; back toward flat = yellow-green)
//          'wheels'       FX36 comet, travel red with caution amber; mode = drive mode 1-10
//                         1 strafe L, 2 strafe R, 3 fwd, 4 back, 5 CW, 6 CCW,
//                         7 diag L-fwd, 8 diag L-back, 9 diag R-fwd, 10 diag R-back
//                         Rotation (5/6): every strip runs the firmware direction (fxWheels; the viewer's
//                         reversal was wrong, Vico 2026-11-04). Forward/back: the foot rest runs the wings' comet.
//          reverse:true   (any animated kind) every strip runs its animation the other way along its length (Vico, HQ16e:
//                         storage's roll moves right on screen while the visualizer map ran the floor comet left).
//          'collision'    latched breathing red, the app's roomSafety 'collision' look
//          'off'          all strips dark (and their spill); the event's fade is the switch-on to the regular look
//     fadeIn:s (any kind, default 0)  the regular look fades out under the state over its first s seconds (else it cuts).
//          'proximity'    latched amber, the desk's FX2 breathe (sx 150: one breath per ~3.1 s,
//                         ERGOLED_BREATHE_SHAPE 1, dark at the bottom), starting dark
//     No arrival light: when a state ends the strips fade (fade s, default 1) back to the
//     regular look, the colour the shot started with, as the desk restores its snapshot.
//     The animation is the app's own: led-movement.mjs sampleMovementInto (the
//     source-derived firmware FX 34/35/36), fed to the strips through the same
//     LedGameMode.sample hook that film-fx uses for media mode.
//   ledFill:{intensity=8, distance=3, height=.55}  a point light at the desk that takes the state's colour and
//     brightness while a state plays (off at rest), so surfaces with no LED receiver (accessories: drafting
//     board, paper, easel) and the room around the desk catch the strip light too.
//   obstacles:[{x=0, ahead=.4, from='desk'|'base', radius=.09, height=.5, rise:[t0,t1]}]
//     at:[x, z] places it in world space; heading (deg, + = left turn) and travel (scene units rolled along it) place the pylon
//     ahead of the desk after a turn and a roll; without them it is ahead along +x.
//     person:'<library id>' puts that posed person (assets/props, category people) there instead of the pylon,
//     facing the desk, from the first frame (rise is ignored); turn (deg) adds to the facing. prepareObstacles(shot)
//     loads them first (film-fx awaits it). A dog ('dog…') wags its tail, moves its head and breathes; still:true keeps it still.
//     A simulated pylon, styled like the stage's proximity pylons. ahead is the gap
//     in scene units between the desk's (or, from:'base', the base's front at the pylon's height) initial front (+x) edge and the pylon's near
//     face; x is sideways from the desk's centre. rise eases its scale in.
import * as THREE from 'three';
import { sampleMovementInto } from '../../led-movement.mjs';

const api = window.ErgoFlex;
const ZERO = [0, 0, 0, 0], RED = [255, 0, 0, 0], BLUE = [0, 0, 255, 0], AMBER = [255, 70, 0, 0], YELLOW = [255, 255, 0, 0], PURPLE = [150, 0, 255, 0];
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function movement(ev) {
  if (ev.kind === 'lift-up') return { fx: 34, ix: 0, sx: 160, colors: [BLUE, BLUE, ZERO], dark: [2] };
  if (ev.kind === 'lift-down') return { fx: 34, ix: 128, sx: 160, colors: [RED, RED, ZERO], dark: [2] };
  if (ev.kind === 'tilt-extend') return { fx: 35, ix: 0, sx: 160, colors: [YELLOW, YELLOW, ZERO] };
  if (ev.kind === 'tilt-retract') return { fx: 35, ix: 128, sx: 160, colors: [PURPLE, PURPLE, ZERO] };
  // Rotation comets run the firmware direction on every strip (Vico confirmed 2026-11-04: the viewer's
  // "preview correction" reverseRotation flip was wrong; Polish removed it from the demo).
  if (ev.kind === 'wheels') return { fx: 36, ix: ev.mode, sx: 180, reverseRotation: false, colors: [RED, RED, AMBER] };
  return null;
}

// People who stand in for a pylon: loaded through the film's prop library before installStatus places them.
const obstaclePeople = new WeakMap();
export async function prepareObstacles(shot) {
  const wanted = (shot.obstacles || []).filter(o => o?.person); if (!wanted.length) return 0;
  const { propLibrary } = await import('./film-edits.mjs'), library = await propLibrary();
  await Promise.all(wanted.map(async o => { try { obstaclePeople.set(o, await library.instance(o.person)); } catch (error) { console.warn('[film-status] obstacle person ' + o.person + ' did not load', error); } }));
  return wanted.length;
}

// A dog that stands in for a pylon is one unrigged mesh: it is given life in its vertex shader. In the dog's own frame
// (z from tail to nose, y up) the tail wags from its root, the head turns and nods from the neck, the chest breathes;
// the paws and the body stay where they stand. `seconds` drives it, so a frame of the film is always the same.
function animateDog(person) {
  person.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(person.matrixWorld).invert(), box = new THREE.Box3(), v = new THREE.Vector3(), time = { value: 0 }, meshes = [];
  person.traverse(m => { const pos = m.isMesh && m.geometry?.attributes?.position; if (!pos) return;
    const to = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld); for (let i = 0; i < pos.count; i += 3) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to)); meshes.push([m, to]); });
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  for (const [m, to] of meshes) {
    const uniforms = { dogTime: time, dogIn: { value: to }, dogOut: { value: to.clone().invert() }, dogMin: { value: box.min.clone() }, dogSize: { value: size } };
    const patch = mat => { const c = mat.clone();
      c.onBeforeCompile = sh => { Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float dogTime; uniform mat4 dogIn, dogOut; uniform vec3 dogMin, dogSize;
vec2 dogTurn(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(p.x * c - p.y * s, p.x * s + p.y * c); }
vec3 dogMove(vec3 pos) {
  vec3 p = (dogIn * vec4(pos, 1.)).xyz, n = (p - dogMin) / dogSize; float mid = dogMin.x + .5 * dogSize.x;
  float tail = smoothstep(.3, .1, n.z) * smoothstep(.36, .5, n.y), tz = dogMin.z + .3 * dogSize.z;                 // the tail, from its root
  vec2 t = dogTurn(vec2(p.x - mid, p.z - tz), sin(dogTime * 8.5) * .5 * (.6 + .4 * sin(dogTime * .9 + 1.)) * tail); p.x = mid + t.x; p.z = tz + t.y;
  float ty = dogMin.y + .64 * dogSize.y; vec2 lift = dogTurn(vec2(p.z - tz, p.y - ty), -(.12 + .2 * sin(dogTime * 2.3 + .5)) * tail); p.z = tz + lift.x; p.y = ty + lift.y;   // and lifts and drops as it wags
  float head = smoothstep(.68, .86, n.z) * smoothstep(.42, .6, n.y), hz = dogMin.z + .7 * dogSize.z, hy = dogMin.y + .62 * dogSize.y;   // the head, from the neck
  vec2 h = dogTurn(vec2(p.x - mid, p.z - hz), (.24 * sin(dogTime * .8) + .07 * sin(dogTime * 2.1 + .7)) * head); p.x = mid + h.x; p.z = hz + h.y;
  vec2 nod = dogTurn(vec2(p.z - hz, p.y - hy), (.13 * sin(dogTime * 1.1 + 2.) - .03) * head); p.z = hz + nod.x; p.y = hy + nod.y;
  float chest = smoothstep(.3, .45, n.z) * smoothstep(.78, .6, n.z) * smoothstep(.3, .5, n.y), breath = sin(dogTime * 2.6);      // breathing
  p.x = mid + (p.x - mid) * (1. + .035 * breath * chest); p.y += .008 * dogSize.y * breath * chest;
  return (dogOut * vec4(p, 1.)).xyz;
}`).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = dogMove(transformed);'); };
      c.customProgramCacheKey = () => 'film-dog'; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(patch) : patch(m.material);
  }
  return time;
}

export function installStatus(shot) {
  const game = api.ledGameMode, counts = game.counts;
  const frame = counts.map(n => new Uint8Array(n * 4)), events = (shot.ledStatus || []).map(e => ({ ...e }));
  const group = new THREE.Group(); group.name = 'Film status'; group.userData.filmFx = true;
  const pylons = [], dogs = [], regular0 = api.ledColor || '#ffffff';
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  // The status frames go to the strips through the game path, which uploads them as LINEAR bytes
  // (led-pixel-renderer linearByteToSrgb), while the regular look is the sRGB colour regularRgb. So the
  // fade aims at the linear byte that the upload turns back into regularRgb: fading to regularRgb itself
  // ended about 7x too bright (#2b2b2b as linear 43 is sRGB 114), and the floor and desk spill popped off
  // in one frame at the handoff (cinematography final review 8, film 35.43).
  const toSrgbByte = v => { const x = v / 255; return Math.round(255 * (x <= .0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - .055)); };
  const linearOf = rgb => rgb.map(c => { let best = 0; for (let b = 0; b < 256; b++) if (Math.abs(toSrgbByte(b) - c) < Math.abs(toSrgbByte(best) - c)) best = b; return best; });
  // ledNeutral:[[seconds, '#hex'], ...] (optional): the regular look changes over the chapter, smoothstep between keys
  // (Vico, HQ14k: the app's time-based white, true white in the morning, warm white from sunset). Without it the
  // regular look is the shot's ledColor throughout.
  const neutral = (shot.ledNeutral || []).map(([at, c]) => [at, rgbOf(c)]).sort((a, b) => a[0] - b[0]);
  const regularAt = s => {
    if (!neutral.length) return rgbOf(regular0);
    const i = neutral.findIndex(k => k[0] > s);
    if (i === 0) return neutral[0][1]; if (i < 0) return neutral.at(-1)[1];
    const [a, ca] = neutral[i - 1], [b, cb] = neutral[i], k = smooth((s - a) / (b - a));
    return ca.map((v, c) => Math.round(v + (cb[c] - v) * k));
  };
  let fill = null;
  if (shot.ledFill) {
    const b = new THREE.Box3().setFromObject(api.loadedModel), c = b.getCenter(new THREE.Vector3()), f = shot.ledFill;
    fill = new THREE.PointLight(0xffffff, 0, f.distance ?? 3, 2); fill.name = 'Film LED fill'; fill.userData.filmFx = true;
    fill.position.set(c.x, b.min.y + (b.max.y - b.min.y) * (f.height ?? .55), c.z); fill.userData.k = f.intensity ?? 8;
    let root = api.loadedModel; while (root.parent) root = root.parent; group.add(fill); if (!group.parent) root.add(group);
  }
  const lightFill = (rgb, rows) => {
    if (!fill) return;
    let sum = 0, n = 0; for (const r of rows) for (let p = 0; p < r.length; p += 4) { sum += Math.max(r[p], r[p + 1], r[p + 2]); n++; }
    const m = Math.max(...rgb, 1); fill.color.setRGB(rgb[0] / m, rgb[1] / m, rgb[2] / m); fill.intensity = fill.userData.k * (n ? sum / n / 255 : 0);
  };
  if (shot.obstacles?.length) {
    let scene = api.loadedModel; while (scene.parent) scene = scene.parent; scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(api.loadedModel), c = box.getCenter(new THREE.Vector3());
    // from:'base': the front-most desk geometry at the pylon's own height (the base, not the overhanging tray).
    const frontAt = h => {
      let max = -Infinity; const v = new THREE.Vector3();
      api.loadedModel.traverse(m => {
        const pos = m.isMesh && m.geometry?.attributes?.position; if (!pos) return; m.updateWorldMatrix(true, false);
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); if (v.y > box.min.y + .02 && v.y < box.min.y + h * .9 && v.x > max) max = v.x; }
      });
      return max;
    };
    for (const o of shot.obstacles) {
      const r = o.radius ?? .09, h = o.height ?? .5;
      const person = o.person && obstaclePeople.get(o);
      const mesh = person || new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r, h, 24),
        new THREE.MeshStandardMaterial({ color: 0x163344, metalness: .6, roughness: .3, emissive: 0x0873a4, emissiveIntensity: .6 }));
      // The desk's forward (director +z, the app's wheel mode 3) is world +x; x here is sideways in world z.
      const front = (o.from === 'base' ? frontAt(h) : box.max.x) + (o.ahead ?? .4) + r;
      if (o.at) mesh.position.set(o.at[0], box.min.y + h / 2, o.at[1]);   // explicit world [x, z]
      else if (o.heading !== undefined) {
        // Along the desk's heading after a turn, from its pivot (the model's origin).
        const pv = api.loadedModel.getWorldPosition(new THREE.Vector3()), a = o.heading * Math.PI / 180, d = front - pv.x + (o.travel ?? 0);
        mesh.position.set(pv.x + Math.cos(a) * d - Math.sin(a) * (o.x ?? 0), box.min.y + h / 2, pv.z + Math.sin(a) * d + Math.cos(a) * (o.x ?? 0));
      } else mesh.position.set(front, box.min.y + h / 2, c.z + (o.x ?? 0));
      mesh.castShadow = true; mesh.name = 'Film obstacle'; mesh.userData.filmFx = true;
      if (person) {
        // A library instance is millimetres at scale 1000: bring it to scene units, feet on the stage floor, facing the desk.
        const k = api.workspaceAccessories?.scale || api.workspaceRoom?.scale || .001;
        person.scale.setScalar(1000 * k); person.position.y = box.min.y;
        person.rotation.y = Math.atan2(c.x - person.position.x, c.z - person.position.z) + THREE.MathUtils.degToRad(o.turn || 0);
        person.traverse(m => { if (m.isMesh) m.castShadow = true; }); group.add(person);
        if (/^dog/.test(o.person) && o.still !== true) { const time = animateDog(person); if (time) dogs.push(time); }
        continue;
      }
      pylons.push({ mesh, h, y0: box.min.y, rise: o.rise || [0, 0] }); group.add(mesh);
    }
    scene.add(group);
  }
  return {
    frame(seconds) {
      for (const time of dogs) time.value = seconds;
      for (const p of pylons) {
        const u = p.rise[1] > p.rise[0] ? smooth((seconds - p.rise[0]) / (p.rise[1] - p.rise[0])) : 1;
        p.mesh.visible = u > 0; p.mesh.scale.y = Math.max(.001, u); p.mesh.position.y = p.y0 + p.h * u / 2;
      }
      const ev = events.find(e => seconds >= e.at && seconds < e.at + e.dur);
      const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      const regularRgb = regularAt(seconds), regular = hex(regularRgb);
      if (!ev) {
        const regularLinear = linearOf(regularRgb);
        // Fade from the last state's final frame back to the regular look, ending on what it renders.
        const done = events.filter(e => e.at + e.dur <= seconds).at(-1), u = done ? (seconds - done.at - done.dur) / (done.fade ?? 1) : 1;
        if (!done?.last || u >= 1) { api.setLedColor(regular, false); if (fill) fill.intensity = 0; game.active = false; delete game.sample; return; }
        const k = smooth(u);
        for (let i = 0; i < frame.length; i++) for (let p = 0; p < frame[i].length; p += 4) for (let c = 0; c < 4; c++) frame[i][p + c] = Math.round(done.last[i][p + c] * (1 - k) + (c < 3 ? regularLinear[c] : 0) * k);
        api.setLedColor(hex(done.spill.map((v, c) => v * (1 - k) + regularRgb[c] * k)), false);
        lightFill(done.spill, done.last.map(r => r.map(v => v * (1 - k))));
        game.sample = out => { out.forEach((row, i) => row.set(frame[i])); return true; };
        game.active = true; return;
      }
      const t = seconds - ev.at, m = movement(ev);
      if (m) {
        // Lift (FX34): one wavefront per move, foot rest to top shelf going up and top to foot going down,
        // spread over the event (Vico, round 8: the desk sweeps once with the move). The app's own FX34 frames
        // are kept; only their clock is mapped: head travel 0 -> 4 layers = phase 0 -> .8, reached at 90% of dur.
        // sweep:false keeps the firmware's free-running loop.
        let ms = t * 1000;
        // Stepped (Vico, HQ14g: "the second layer lights up so fast ... it looks almost like one light"): the head rests on
        // each layer (hold, default .5 of its step) and then moves on, and gamma (default 2.5) on the frame shrinks the
        // overlap, so the foot rest lights, fades out, and only then the desktop layer comes up. steps:false = the glide.
        const stepped = m.fx === 34 && ev.sweep !== false && ev.steps !== false;
        if (m.fx === 34 && ev.sweep !== false) {
          let travel = Math.min(1, t / (ev.dur * .9)) * 4;
          if (stepped) { const hold = ev.hold ?? .5, k = Math.min(3, Math.floor(travel)), f = travel - k; travel = k + (f < hold ? 0 : smooth((f - hold) / (1 - hold))); }
          ms = travel / 5 / (.12 + m.sx / 255 * .28) * 1000;
        }
        sampleMovementInto(frame, { ...m, elapsedMs: ms });
        if (stepped) { const g = ev.gamma ?? 2.5; for (const row of frame) for (let p = 0; p < row.length; p++) row[p] = Math.round(255 * (row[p] / 255) ** g); }
        if (m.reverseRotation) {
          // The wings run like the real desk's: re-sample rows 5 and 6 with the physical mode.
          const wings = counts.map(n => new Uint8Array(n * 4));
          sampleMovementInto(wings, { ...m, reverseRotation: false, elapsedMs: t * 1000 });
          frame[5].set(wings[5]); frame[6].set(wings[6]);
        }
        if (ev.kind === 'wheels' && (ev.mode === 3 || ev.mode === 4) && ev.footComet !== false) {
          // Vico (HQ14c): on forward/back the firmware gives the foot rest a slow red pulse that starts dark and read
          // as off, so it runs the wings' comet there (sampled at the foot's own length). Other modes keep the firmware's.
          const foot = counts.map((n, i) => new Uint8Array((i === 5 ? counts[7] : 1) * 4));
          sampleMovementInto(foot, { ...m, reverseRotation: false, elapsedMs: t * 1000 });
          frame[7].set(foot[5]);
        }
        if (ev.reverse) for (const row of frame) { const n = row.length / 4, tmp = row.slice(); for (let p = 0; p < n; p++) row.set(tmp.subarray((n - 1 - p) * 4, (n - p) * 4), p * 4); }
        for (const id of m.dark || []) frame[id].fill(0);
      } else {
        let rgb, gain;
        if (ev.kind === 'proximity') {
          // FX2 breathe: +0.0671 rad per 33 ms frame (sx 150), pulse = sin(angle / 2).
          const angle = (t * 1000 / 33 * (0.02 + 150 / 255 * 0.08)) % (2 * Math.PI);
          gain = Math.sin(angle / 2); rgb = [255, 145, 8];
        } else if (ev.kind === 'off') { gain = 0; rgb = [0, 0, 0]; } // lights off (the opener's dark desk); its fade is the switch-on
        else { gain = .72 + .28 * Math.sin(t * 3) ** 2; rgb = [255, 16, 12]; } // the app's roomSafety pulse
        for (const row of frame) for (let p = 0; p < row.length; p += 4) row.set([Math.round(rgb[0] * gain), Math.round(rgb[1] * gain), Math.round(rgb[2] * gain), 0], p);
      }
      // The spill on the desk and floor follows the indicator colour, as the app's solid colour does.
      ev.spill = m ? (ev.kind === 'wheels' ? RED : m.colors[0]).slice(0, 3) : ev.kind === 'proximity' ? [255, 145, 8] : ev.kind === 'off' ? [0, 0, 0] : [255, 16, 12];
      // fadeIn (s, default 0): the regular look fades out under the state over its first fadeIn seconds instead of
      // vanishing on the event's first frame (Vico, HQ18: the white "goes boom, dark really fast" into the lift light;
      // match the fade back). The state itself plays unscaled on top.
      const into = Number(ev.fadeIn) || 0;
      if (into > 0 && t < into) {
        const k = 1 - smooth(t / into), reg = linearOf(regularRgb);
        for (const row of frame) for (let p = 0; p < row.length; p += 4) for (let c = 0; c < 3; c++) row[p + c] = Math.min(255, Math.round(row[p + c] + reg[c] * k));
        const spill = ev.spill.map((v, c) => v * (1 - k) + regularRgb[c] * k);
        ev.last = frame.map(r => r.slice());
        api.setLedColor(hex(spill), false); lightFill(spill, frame);
        game.sample = out => { out.forEach((row, i) => row.set(frame[i])); return true; };
        game.active = true; return;
      }
      ev.last = frame.map(r => r.slice());
      api.setLedColor(hex(ev.spill), false); lightFill(ev.spill, frame);
      game.sample = out => { out.forEach((row, i) => row.set(frame[i])); return true; };
      game.active = true;
    },
    after() { game.active = false; delete game.sample; },
    clear() { group.removeFromParent(); fill?.dispose(); for (const p of pylons) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); } game.active = false; delete game.sample; }
  };
}
