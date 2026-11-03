// Render-harness-only: status-indicator light show and simulated obstacle.
// Loaded by film-fx.mjs when a shot has ledStatus or obstacles, inside the
// disposable stage iframe. Nothing in the app imports it.
//
//   ledStatus:[{at, dur, kind, mode?}]   times in chapter seconds
//     kind 'lift-up'      FX34 vertical wavefront, blue   (ColorLiftUp   0,0,255)
//          'lift-down'    FX34 reversed wavefront, red    (ColorLiftDown 255,0,0)
//          'wheels'       FX36 comet, travel red with caution amber; mode = drive mode 1-10
//                         1 strafe L, 2 strafe R, 3 fwd, 4 back, 5 CW, 6 CCW,
//                         7 diag L-fwd, 8 diag L-back, 9 diag R-fwd, 10 diag R-back
//          'target'       solid green, ColorTargetReached 0,255,0 (fades out over 0.25 s)
//          'collision'    latched breathing red, the app's roomSafety 'collision' look
//          'proximity'    latched breathing amber, the app's roomSafety 'ahead' look
//     The animation is the app's own: led-movement.mjs sampleMovementInto (the
//     source-derived firmware FX 34/35/36), fed to the strips through the same
//     LedGameMode.sample hook that film-fx uses for media mode.
//   obstacles:[{x=0, ahead=.4, from='desk'|'base', radius=.09, height=.5, rise:[t0,t1]}]
//     A simulated pylon, styled like the stage's proximity pylons. ahead is the gap
//     in scene units between the desk's (or, from:'base', the base's front at the pylon's height) initial front (+x) edge and the pylon's near
//     face; x is sideways from the desk's centre. rise eases its scale in.
import * as THREE from 'three';
import { sampleMovementInto } from '../../led-movement.mjs';

const api = window.ErgoFlex;
const ZERO = [0, 0, 0, 0], RED = [255, 0, 0, 0], BLUE = [0, 0, 255, 0], AMBER = [255, 70, 0, 0];
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function movement(ev) {
  if (ev.kind === 'lift-up') return { fx: 34, ix: 0, sx: 160, colors: [BLUE, BLUE, ZERO] };
  if (ev.kind === 'lift-down') return { fx: 34, ix: 128, sx: 160, colors: [RED, RED, ZERO] };
  if (ev.kind === 'wheels') return { fx: 36, ix: ev.mode, sx: 180, reverseRotation: ev.mode === 5 || ev.mode === 6, colors: [RED, RED, AMBER] };
  return null;
}

export function installStatus(shot) {
  const game = api.ledGameMode, counts = game.counts;
  const frame = counts.map(n => new Uint8Array(n * 4)), events = (shot.ledStatus || []).map(e => ({ ...e }));
  const group = new THREE.Group(); group.name = 'Film status'; group.userData.filmFx = true;
  const pylons = [];
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
      mesh.position.set((o.from === 'base' ? frontAt(h) : box.max.x) + (o.ahead ?? .4) + r, box.min.y + h / 2, c.z + (o.x ?? 0));
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
      if (!ev) { game.active = false; delete game.sample; return; }
      const t = seconds - ev.at, m = movement(ev);
      if (m) sampleMovementInto(frame, { ...m, elapsedMs: t * 1000 });
      else {
        let rgb, gain = 1;
        if (ev.kind === 'target') { rgb = [0, 255, 0]; gain = Math.min(1, (ev.dur - t) / .25); }
        else {
          gain = .72 + .28 * Math.sin(t * 3) ** 2; // the app's roomSafety pulse (studio.js updateLedEffectFrame)
          rgb = ev.kind === 'proximity' ? [255, 145, 8] : [255, 16, 12];
        }
        for (const row of frame) for (let p = 0; p < row.length; p += 4) row.set([Math.round(rgb[0] * gain), Math.round(rgb[1] * gain), Math.round(rgb[2] * gain), 0], p);
      }
      // The spill on the desk and floor follows the indicator colour, as the app's solid colour does.
      const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      api.setLedColor(m ? hex((ev.kind === 'wheels' ? RED : m.colors[0]).slice(0, 3)) : ev.kind === 'target' ? '#00ff00' : ev.kind === 'proximity' ? '#ff9108' : '#ff100c', false);
      game.sample = out => { out.forEach((row, i) => row.set(frame[i])); return true; };
      game.active = true;
    },
    after() { game.active = false; delete game.sample; },
    clear() { group.removeFromParent(); for (const p of pylons) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); } game.active = false; delete game.sample; }
  };
}
