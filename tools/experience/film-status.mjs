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
//                         Rotation (5/6): the wings (strips 5, 6) run like the real desk's
//                         (firmware fxWheels), every other strip keeps the preview's reversal.
//          'collision'    latched breathing red, the app's roomSafety 'collision' look
//          'off'          all strips dark (and their spill); the event's fade is the switch-on to the regular look
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
  if (ev.kind === 'wheels') return { fx: 36, ix: ev.mode, sx: 180, reverseRotation: ev.mode === 5 || ev.mode === 6, colors: [RED, RED, AMBER] };
  return null;
}

export function installStatus(shot) {
  const game = api.ledGameMode, counts = game.counts;
  const frame = counts.map(n => new Uint8Array(n * 4)), events = (shot.ledStatus || []).map(e => ({ ...e }));
  const group = new THREE.Group(); group.name = 'Film status'; group.userData.filmFx = true;
  const pylons = [], regular = api.ledColor || '#ffffff';
  const regularRgb = [1, 3, 5].map(i => parseInt(regular.slice(i, i + 2), 16));
  // The status frames go to the strips through the game path, which uploads them as LINEAR bytes
  // (led-pixel-renderer linearByteToSrgb), while the regular look is the sRGB colour regularRgb. So the
  // fade aims at the linear byte that the upload turns back into regularRgb: fading to regularRgb itself
  // ended about 7x too bright (#2b2b2b as linear 43 is sRGB 114), and the floor and desk spill popped off
  // in one frame at the handoff (cinematography final review 8, film 35.43).
  const toSrgbByte = v => { const x = v / 255; return Math.round(255 * (x <= .0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - .055)); };
  const regularLinear = regularRgb.map(c => { let best = 0; for (let b = 0; b < 256; b++) if (Math.abs(toSrgbByte(b) - c) < Math.abs(toSrgbByte(best) - c)) best = b; return best; });
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
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r, h, 24),
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
      pylons.push({ mesh, h, y0: box.min.y, rise: o.rise || [0, 0] }); group.add(mesh);
    }
    scene.add(group);
  }
  return {
    frame(seconds) {
      for (const p of pylons) {
        const u = p.rise[1] > p.rise[0] ? smooth((seconds - p.rise[0]) / (p.rise[1] - p.rise[0])) : 1;
        p.mesh.visible = u > 0; p.mesh.scale.y = Math.max(.001, u); p.mesh.position.y = p.y0 + p.h * u / 2;
      }
      const ev = events.find(e => seconds >= e.at && seconds < e.at + e.dur);
      const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      if (!ev) {
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
        if (m.fx === 34 && ev.sweep !== false) ms = Math.min(1, t / (ev.dur * .9)) * .8 / (.12 + m.sx / 255 * .28) * 1000;
        sampleMovementInto(frame, { ...m, elapsedMs: ms });
        if (m.reverseRotation) {
          // The wings run like the real desk's: re-sample rows 5 and 6 with the physical mode.
          const wings = counts.map(n => new Uint8Array(n * 4));
          sampleMovementInto(wings, { ...m, reverseRotation: false, elapsedMs: t * 1000 });
          frame[5].set(wings[5]); frame[6].set(wings[6]);
        }
        if (ev.kind === 'wheels' && ev.footComet !== false) {
          // Vico (HQ14c): the foot rest runs the wings' comet. The firmware gives it a slow red pulse on forward/back
          // (and a short comet on turns), which starts dark and read as off. Sampled at the foot's own length.
          const foot = counts.map((n, i) => new Uint8Array((i === 5 ? counts[7] : 1) * 4));
          sampleMovementInto(foot, { ...m, reverseRotation: false, elapsedMs: t * 1000 });
          frame[7].set(foot[5]);
        }
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
      ev.last = frame.map(r => r.slice());
      api.setLedColor(hex(ev.spill), false); lightFill(ev.spill, frame);
      game.sample = out => { out.forEach((row, i) => row.set(frame[i])); return true; };
      game.active = true;
    },
    after() { game.active = false; delete game.sample; },
    clear() { group.removeFromParent(); fill?.dispose(); for (const p of pylons) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); } game.active = false; delete game.sample; }
  };
}
