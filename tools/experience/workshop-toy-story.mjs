// Workshop Chapter ("storage"): Father building a Smart Robotic Toy / Action Figure
// ("Robo-Pal MK-I") for his child.
// - At 0°..7° tilt (workbench mode): The maker mat, Smart Robot figure in its cradle,
//   OLED diagnostic test dock, magnetic parts tray, and child's crayon drawing sit on
//   the main desktop.
// - At 7°..10° tilt (entering storage mode): The desktop items smoothly fade out off
//   the tilting desktop and fade in neatly organized across the top shelf ('shelf'),
//   second shelf ('lower-shelf'), and bottom shelf/footrest ('base-shelf').
import * as THREE from 'three';
import { propLibrary } from './film-edits.mjs';

const TILT_FADE_START = 7;
const TILT_FADE_END = 10;

const markAsset = (obj, key, role = 'desktop') => {
  obj.userData.sceneAsset = true;
  obj.userData.sceneAssetKey = key;
  obj.userData.sceneAssetRole = role;
  obj.userData.fixedHardware = true;
  return obj;
};

function makeCanvasTexture(width, height, draw, name = 'display-map') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = name;
  return tex;
}

// Ensure every mesh inside `root` owns a unique material instance so we can fade
// its opacity smoothly between 7° and 10° tilt without affecting shared GLB materials.
function prepareFadeableRoot(root, matPool) {
  const fadeMats = [];
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const cloneOne = m => {
      const c = m.clone();
      c.userData = {
        ...m.userData,
        sharedTextures: true,
        baseOpacity: typeof m.opacity === 'number' ? m.opacity : 1,
        baseTransparent: !!m.transparent,
      };
      matPool.push(c);
      fadeMats.push(c);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(cloneOne) : cloneOne(o.material);
  });
  root.userData.__fadeMats = fadeMats;
  return root;
}

function setNodesFade(nodes, alpha) {
  const a = THREE.MathUtils.clamp(alpha, 0, 1);
  for (const node of nodes) {
    if (a <= 0.001) {
      node.visible = false;
      continue;
    }
    node.visible = true;
    const mats = node.userData.__fadeMats || [];
    const fading = a < 0.999;
    for (const m of mats) {
      const baseOp = m.userData?.baseOpacity ?? 1;
      const baseTr = !!m.userData?.baseTransparent;
      m.transparent = fading || baseTr;
      m.opacity = baseOp * a;
      m.depthWrite = !fading || a > 0.55;
    }
  }
}

function buildMakerMat(matPool, texPool, { stowed = false } = {}) {
  const group = new THREE.Group();
  group.name = stowed ? 'Smart robot maker mat (stowed)' : 'Smart robot workbench mat';
  markAsset(group, stowed ? 'workshop:toy-story:stowed-mat' : 'workshop:toy-story:desktop-mat', stowed ? 'shelf' : 'desktop');

  // Sized 550 x 248 mm so it fits both the main desktop AND fits flush inside the 280 mm top shelf!
  const matW = 550, matD = 248;
  const matTex = makeCanvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = '#18323c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2d5b6b';
    c.lineWidth = 4;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.strokeStyle = 'rgba(130, 210, 230, 0.18)';
    c.lineWidth = 1.5;
    for (let x = 44; x < w - 40; x += 32) {
      c.beginPath(); c.moveTo(x, 52); c.lineTo(x, h - 36); c.stroke();
    }
    for (let y = 52; y < h - 36; y += 32) {
      c.beginPath(); c.moveTo(44, y); c.lineTo(w - 44, y); c.stroke();
    }
    c.strokeStyle = 'rgba(110, 225, 245, 0.35)';
    c.lineWidth = 2;
    for (const r of [75, 125, 175]) {
      c.beginPath(); c.arc(w * 0.42, h * 0.52, r, 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = '#9fe6f7';
    c.font = 'bold 20px monospace';
    c.fillText('ROBO-PAL MK-I  ·  SMART TOY ASSEMBLY & SERVO MAT', 44, 42);
    c.font = '15px monospace';
    c.fillText('SCALE: 1:1 (MM)   ·   12-DOF BUS   ·   5V LOGIC', 44, h - 22);
  }, stowed ? 'maker-mat-stowed-display' : 'maker-mat-desktop-display');
  texPool.push(matTex);

  const matSurface = new THREE.MeshStandardMaterial({
    name: 'Maker mat display surface',
    map: matTex,
    roughness: 0.78,
    metalness: 0.06,
  });
  const matBase = new THREE.MeshStandardMaterial({ color: '#102128', roughness: 0.85 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#252c33', metalness: 0.78, roughness: 0.32 });
  const anodizedOrange = new THREE.MeshStandardMaterial({ color: '#e86a24', metalness: 0.45, roughness: 0.35 });
  const brushedAlum = new THREE.MeshStandardMaterial({ color: '#c8d2d8', metalness: 0.82, roughness: 0.26 });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(matW, 4, matD), matBase);
  slab.position.set(0, 2, 0);
  slab.castShadow = true; slab.receiveShadow = true;
  group.add(slab);

  const topPlane = new THREE.Mesh(new THREE.PlaneGeometry(matW - 8, matD - 8), matSurface);
  topPlane.name = 'Maker mat display top';
  topPlane.rotation.x = -Math.PI / 2;
  topPlane.position.set(0, 4.2, 0);
  topPlane.receiveShadow = true;
  group.add(topPlane);

  // Corner hold-down clips on the mat
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (matW / 2 - 20), cz = sz * (matD / 2 - 16);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(32, 10, 22), darkSteel);
      bracket.position.set(cx, 5, cz);
      bracket.castShadow = true;
      group.add(bracket);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 8, 16), anodizedOrange);
      knob.position.set(cx, 12, cz);
      knob.castShadow = true;
      group.add(knob);
      const washer = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2.5, 16), brushedAlum);
      washer.position.set(cx, 9, cz);
      group.add(washer);
    }
  }
  return prepareFadeableRoot(group, matPool);
}

function buildGimbalCradle(matPool, { stowed = false } = {}) {
  const cradle = new THREE.Group();
  cradle.name = stowed ? 'Robot gimbal assembly cradle (stowed)' : 'Robot gimbal assembly cradle';
  markAsset(cradle, stowed ? 'workshop:toy-story:stowed-cradle' : 'workshop:toy-story:desktop-cradle', stowed ? 'base-shelf' : 'desktop');

  const darkChassis = new THREE.MeshStandardMaterial({ color: '#1d242b', roughness: 0.42, metalness: 0.65 });
  const titaniumJoint = new THREE.MeshStandardMaterial({ color: '#6e7b85', roughness: 0.28, metalness: 0.82 });
  const orangeAccent = new THREE.MeshStandardMaterial({ color: '#ee6b24', roughness: 0.34, metalness: 0.28 });
  const tealArmor = new THREE.MeshStandardMaterial({ color: '#246a78', roughness: 0.36, metalness: 0.35 });

  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(195, 7, 210), darkChassis);
  basePlate.position.set(0, 3.5, 0);
  basePlate.castShadow = true; basePlate.receiveShadow = true;
  cradle.add(basePlate);

  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(12, 74, 20), titaniumJoint);
    pillar.position.set(s * 82, 38, -8);
    pillar.castShadow = true;
    cradle.add(pillar);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 16), orangeAccent);
    arm.position.set(s * 64, 62, -8);
    arm.castShadow = true;
    cradle.add(arm);

    const knob = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 16), orangeAccent);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(s * 92, 62, -8);
    cradle.add(knob);
  }

  const backSupport = new THREE.Mesh(new THREE.BoxGeometry(98, 10, 135), tealArmor);
  backSupport.position.set(0, 34, -18);
  backSupport.rotation.x = 0.42;
  backSupport.castShadow = true;
  cradle.add(backSupport);

  const footStop = new THREE.Mesh(new THREE.BoxGeometry(142, 22, 16), orangeAccent);
  footStop.position.set(0, 14, 92);
  footStop.castShadow = true;
  cradle.add(footStop);

  return prepareFadeableRoot(cradle, matPool);
}

function buildSmartRobotFigure(matPool, { stowed = false } = {}) {
  const root = new THREE.Group();
  root.name = stowed ? 'Smart robot figure · Robo-Pal (stowed)' : 'Smart robot figure · Robo-Pal';
  markAsset(root, stowed ? 'workshop:toy-story:stowed-robo-pal' : 'workshop:toy-story:desktop-robo-pal', stowed ? 'shelf' : 'desktop');

  const ivoryShell = new THREE.MeshStandardMaterial({ color: '#ece7dc', roughness: 0.32, metalness: 0.18 });
  const tealArmor = new THREE.MeshStandardMaterial({ color: '#246a78', roughness: 0.36, metalness: 0.35 });
  const orangeAccent = new THREE.MeshStandardMaterial({ color: '#ee6b24', roughness: 0.34, metalness: 0.28 });
  const titaniumJoint = new THREE.MeshStandardMaterial({ color: '#6e7b85', roughness: 0.28, metalness: 0.82 });
  const darkChassis = new THREE.MeshStandardMaterial({ color: '#1d242b', roughness: 0.42, metalness: 0.65 });
  const visorGlass = new THREE.MeshStandardMaterial({ color: '#0a161e', roughness: 0.12, metalness: 0.2 });
  const cyanLed = new THREE.MeshStandardMaterial({
    color: '#4af5ff',
    emissive: new THREE.Color('#1ce8ff'),
    emissiveIntensity: 2.8,
    roughness: 0.2,
  });
  const heartCoreGlow = new THREE.MeshStandardMaterial({
    color: '#ffcf5c',
    emissive: new THREE.Color('#ff9d1c'),
    emissiveIntensity: 3.1,
    roughness: 0.18,
  });
  const greenLed = new THREE.MeshStandardMaterial({
    color: '#4dff88',
    emissive: new THREE.Color('#1fe060'),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  if (!stowed) {
    const cradle = buildGimbalCradle(matPool, { stowed: false });
    root.add(cradle);
  }

  const figure = new THREE.Group();
  figure.name = 'Robo-Pal articulated figure';
  if (stowed) {
    // Seated/standing upright on the mat on the top shelf!
    figure.position.set(0, 72, -10);
    figure.rotation.x = 0;
    figure.scale.setScalar(0.76);
  } else {
    // Reclined in its assembly cradle on the flat desktop
    figure.position.set(0, 62, -6);
    figure.rotation.x = -1.08;
    figure.scale.setScalar(0.88);
  }
  root.add(figure);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(104, 112, 64), ivoryShell);
  torso.castShadow = true; torso.receiveShadow = true;
  figure.add(torso);

  const chestCollar = new THREE.Mesh(new THREE.BoxGeometry(110, 24, 68), tealArmor);
  chestCollar.position.set(0, 44, 0);
  chestCollar.castShadow = true;
  figure.add(chestCollar);

  // Open chest bay + glowing Smart Heart Core
  const chestBay = new THREE.Mesh(new THREE.BoxGeometry(74, 64, 10), darkChassis);
  chestBay.position.set(0, 4, 29);
  figure.add(chestBay);

  const coreRing = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 10, 24), cyanLed);
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.set(0, 6, 32);
  figure.add(coreRing);

  const heartCore = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 13, 24), heartCoreGlow);
  heartCore.rotation.x = Math.PI / 2;
  heartCore.position.set(0, 6, 34);
  figure.add(heartCore);

  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 10), i === 1 ? greenLed : cyanLed);
    led.position.set(-22 + i * 22, -18, 34);
    figure.add(led);
  }

  const chestHatch = new THREE.Mesh(new THREE.BoxGeometry(36, 60, 6), orangeAccent);
  chestHatch.position.set(-54, 4, 44);
  chestHatch.rotation.y = -0.85;
  chestHatch.castShadow = true;
  figure.add(chestHatch);

  // Neck + Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 22, 16), titaniumJoint);
  neck.position.set(0, 66, 0);
  figure.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 112, 4);
  head.rotation.y = stowed ? -0.15 : 0.12;
  head.rotation.x = stowed ? 0.05 : 0.15;
  figure.add(head);

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(92, 74, 72), ivoryShell);
  helmet.castShadow = true; helmet.receiveShadow = true;
  head.add(helmet);

  const helmetCrown = new THREE.Mesh(new THREE.BoxGeometry(76, 12, 58), tealArmor);
  helmetCrown.position.set(0, 40, 0);
  head.add(helmetCrown);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(78, 38, 8), visorGlass);
  visor.position.set(0, 4, 34);
  head.add(visor);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 6, 20), cyanLed);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(s * 20, 6, 37);
    head.add(eye);

    const earPod = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 12, 16), orangeAccent);
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(s * 50, 2, 0);
    head.add(earPod);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 32, 10), titaniumJoint);
    antenna.position.set(s * 30, 52, -4);
    antenna.rotation.z = -s * 0.18;
    head.add(antenna);

    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 12), s < 0 ? cyanLed : heartCoreGlow);
    antennaTip.position.set(s * 35, 68, -4);
    head.add(antennaTip);
  }
  const smile = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 6), cyanLed);
  smile.position.set(0, -7, 37);
  head.add(smile);

  // Arms
  for (const s of [-1, 1]) {
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), titaniumJoint);
    shoulderBall.position.set(s * 66, 34, 0);
    figure.add(shoulderBall);

    const armGroup = new THREE.Group();
    armGroup.position.set(s * 66, 34, 0);
    if (s > 0) {
      armGroup.rotation.x = -0.85;
      armGroup.rotation.z = -0.38;
    } else {
      armGroup.rotation.x = -0.35;
      armGroup.rotation.z = 0.28;
    }
    figure.add(armGroup);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(28, 52, 28), tealArmor);
    upperArm.position.set(s * 6, -26, 0);
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 14), titaniumJoint);
    elbow.position.set(s * 6, -56, 0);
    armGroup.add(elbow);

    const forearm = new THREE.Group();
    forearm.position.set(s * 6, -56, 0);
    forearm.rotation.x = s > 0 ? -0.95 : -0.55;
    armGroup.add(forearm);

    const forearmShell = new THREE.Mesh(new THREE.BoxGeometry(32, 50, 32), ivoryShell);
    forearmShell.position.set(0, -26, 0);
    forearmShell.castShadow = true;
    forearm.add(forearmShell);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 34), orangeAccent);
    cuff.position.set(0, -46, 0);
    forearm.add(cuff);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 16), titaniumJoint);
    hand.position.set(0, -62, 4);
    forearm.add(hand);
  }

  // Pelvis & Legs (in stowed mode on the top shelf, legs are posed in a neat seated posture on the mat!)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(92, 28, 58), tealArmor);
  pelvis.position.set(0, -68, 0);
  pelvis.castShadow = true;
  figure.add(pelvis);

  for (const s of [-1, 1]) {
    const legGroup = new THREE.Group();
    legGroup.position.set(s * 28, -84, 0);
    if (stowed) {
      // Seated forward on the top shelf mat so the boots rest right on the mat!
      legGroup.rotation.x = -Math.PI / 2 + 0.08;
    }
    figure.add(legGroup);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(16, 14, 14), titaniumJoint);
    legGroup.add(hip);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(34, 54, 38), ivoryShell);
    thigh.position.set(0, -30, 2);
    thigh.castShadow = true;
    legGroup.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(15, 14, 14), orangeAccent);
    knee.position.set(0, -62, 6);
    legGroup.add(knee);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(38, 52, 42), tealArmor);
    shin.position.set(0, -92, 4);
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 62), ivoryShell);
    boot.position.set(0, -124, 14);
    boot.castShadow = true;
    legGroup.add(boot);

    const bootToe = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 24), orangeAccent);
    bootToe.position.set(0, -130, 35);
    legGroup.add(bootToe);
  }

  return prepareFadeableRoot(root, matPool);
}

function buildDiagnosticDock(matPool, texPool, { stowed = false } = {}) {
  const group = new THREE.Group();
  group.name = stowed ? 'Robot diagnostic test dock (stowed)' : 'Robot diagnostic test dock';
  markAsset(group, stowed ? 'workshop:toy-story:stowed-dock' : 'workshop:toy-story:desktop-dock', stowed ? 'lower-shelf' : 'desktop');

  const oledTex = makeCanvasTexture(512, 320, (c, w, h) => {
    c.fillStyle = '#071821';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#26d7f7';
    c.lineWidth = 4;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#38f2ff';
    c.font = 'bold 24px monospace';
    c.fillText('ROBO-PAL DIAGNOSTICS', 26, 44);
    c.fillStyle = '#7dffb3';
    c.font = 'bold 19px monospace';
    c.fillText('HEART CORE : ONLINE (99%)', 26, 82);
    c.fillText('SERVO BUS  : 12/12 OK', 26, 112);
    c.fillText('VOICE CHIP : "HI LEO!"', 26, 142);
    c.strokeStyle = '#ffb84d';
    c.lineWidth = 4;
    c.beginPath();
    for (let x = 28; x < w - 28; x += 8) {
      const y = 225 + Math.sin(x * 0.055) * 32 * Math.cos(x * 0.015);
      if (x === 28) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }, stowed ? 'diagnostic-oled-stowed-display' : 'diagnostic-oled-desktop-display');
  texPool.push(oledTex);

  const caseMat = new THREE.MeshStandardMaterial({ color: '#1f2830', roughness: 0.38, metalness: 0.65 });
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Diagnostic display screen',
    map: oledTex,
    emissiveMap: oledTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#e86a24', roughness: 0.35, metalness: 0.3 });
  const cableMat = new THREE.MeshStandardMaterial({ color: '#19a8c8', roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(142, 26, 110), caseMat);
  body.position.set(0, 13, 0);
  body.castShadow = true;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(132, 48, 68), caseMat);
  hood.position.set(0, 34, -10);
  hood.rotation.x = -0.52;
  hood.castShadow = true;
  group.add(hood);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(118, 58), screenMat);
  screen.name = 'Diagnostic display panel';
  screen.position.set(0, 44, 12);
  screen.rotation.x = -0.98;
  group.add(screen);

  for (const sx of [-40, 0, 40]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 9, 16), orangeMat);
    dial.position.set(sx, 28, 38);
    group.add(dial);
  }

  if (!stowed) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-64, 16, -10),
      new THREE.Vector3(-110, 28, -22),
      new THREE.Vector3(-155, 52, -12),
      new THREE.Vector3(-185, 64, 8),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 4.0, 8, false), cableMat);
    cable.castShadow = true;
    group.add(cable);
  }

  return prepareFadeableRoot(group, matPool);
}

function buildMagneticPartsTray(matPool, { stowed = false } = {}) {
  const group = new THREE.Group();
  group.name = stowed ? 'Magnetic maker parts tray (stowed)' : 'Magnetic maker parts tray';
  markAsset(group, stowed ? 'workshop:toy-story:stowed-tray' : 'workshop:toy-story:desktop-tray', stowed ? 'shelf' : 'desktop');

  const trayRim = new THREE.MeshStandardMaterial({ color: '#266d7a', roughness: 0.42, metalness: 0.35 });
  const magPad = new THREE.MeshStandardMaterial({ color: '#1b2228', roughness: 0.75 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d4a243', roughness: 0.28, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#bcc6cc', roughness: 0.25, metalness: 0.85 });
  const ivory = new THREE.MeshStandardMaterial({ color: '#ebe6db', roughness: 0.35, metalness: 0.15 });
  const orange = new THREE.MeshStandardMaterial({ color: '#e86a24', roughness: 0.35, metalness: 0.3 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(148, 12, 174), trayRim);
  base.position.set(0, 6, 0);
  base.castShadow = true;
  group.add(base);

  const insert = new THREE.Mesh(new THREE.BoxGeometry(132, 4, 158), magPad);
  insert.position.set(0, 11, 0);
  group.add(insert);

  const spareArm = new THREE.Mesh(new THREE.BoxGeometry(26, 16, 58), ivory);
  spareArm.position.set(-26, 19, -20);
  spareArm.rotation.y = 0.25;
  spareArm.castShadow = true;
  group.add(spareArm);

  const spareCuff = new THREE.Mesh(new THREE.BoxGeometry(28, 18, 13), orange);
  spareCuff.position.set(-20, 19, 8);
  spareCuff.rotation.y = 0.25;
  group.add(spareCuff);

  for (const [gx, gz, r] of [[28, -36, 15], [38, -6, 11], [16, 16, 13]]) {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 6, 16), brass);
    gear.position.set(gx, 15, gz);
    gear.castShadow = true;
    group.add(gear);
  }
  const driverHandle = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 62, 14), orange);
  driverHandle.rotation.x = Math.PI / 2;
  driverHandle.rotation.z = -0.18;
  driverHandle.position.set(-10, 18, 46);
  driverHandle.castShadow = true;
  group.add(driverHandle);

  const driverShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 52, 10), steel);
  driverShaft.rotation.x = Math.PI / 2;
  driverShaft.rotation.z = -0.18;
  driverShaft.position.set(34, 18, 38);
  group.add(driverShaft);

  return prepareFadeableRoot(group, matPool);
}

function buildChildSketchSheet(matPool, texPool, { stowed = false } = {}) {
  const group = new THREE.Group();
  group.name = stowed ? "Child's robot drawing (stowed)" : "Child's robot drawing";
  markAsset(group, stowed ? 'workshop:toy-story:stowed-drawing' : 'workshop:toy-story:desktop-drawing', stowed ? 'lower-shelf' : 'desktop');

  const sketchTex = makeCanvasTexture(512, 384, (c, w, h) => {
    c.fillStyle = '#fff8e8';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(110, 165, 220, 0.35)';
    c.lineWidth = 2;
    for (let y = 52; y < h - 20; y += 32) {
      c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
    }
    c.fillStyle = '#d93b3b';
    c.font = 'bold 30px sans-serif';
    c.fillText('FOR DAD + ROBO-PAL!', 34, 44);
    c.strokeStyle = '#1f6e7c';
    c.lineWidth = 8;
    c.strokeRect(145, 76, 110, 74);
    c.strokeRect(128, 156, 144, 118);
    c.fillStyle = '#24d4f5';
    c.fillRect(168, 98, 22, 22);
    c.fillRect(212, 98, 22, 22);
    c.fillStyle = '#ff4f4f';
    c.beginPath(); c.arc(200, 214, 24, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ee6b24';
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(128, 180); c.lineTo(82, 134);
    c.moveTo(272, 180); c.lineTo(318, 136);
    c.moveTo(164, 274); c.lineTo(164, 336);
    c.moveTo(236, 274); c.lineTo(236, 336);
    c.stroke();
    c.fillStyle = '#2b5592';
    c.font = 'bold 26px sans-serif';
    c.fillText('BEST BIRTHDAY EVER <3', 98, 368);
  }, stowed ? 'kid-notebook-stowed' : 'kid-notebook-desktop');
  texPool.push(sketchTex);

  const paperMat = new THREE.MeshStandardMaterial({
    name: 'Child notebook drawing',
    map: sketchTex,
    roughness: 0.88,
  });
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#2b7de0', roughness: 0.6 });

  const sheet = new THREE.Mesh(new THREE.BoxGeometry(160, 2.5, 124), paperMat);
  sheet.name = 'Child notebook sketch mesh';
  sheet.position.set(0, 1.5, 0);
  sheet.receiveShadow = true;
  group.add(sheet);

  for (const [tx, tz, rot] of [[-64, -50, -0.45], [64, 50, -0.45]]) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(38, 3.2, 13), tapeMat);
    tape.position.set(tx, 2.4, tz);
    tape.rotation.y = rot;
    group.add(tape);
  }
  return prepareFadeableRoot(group, matPool);
}

function buildBottomShelfSpareCase(matPool, texPool) {
  const group = new THREE.Group();
  group.name = 'Robo-Pal spare parts and servo case';
  markAsset(group, 'workshop:toy-story:base-case', 'base-shelf');

  const labelTex = makeCanvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = '#1c262e';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ee6b24';
    c.lineWidth = 6;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#ee6b24';
    c.font = 'bold 30px monospace';
    c.fillText('ROBO-PAL MK-I', 38, 72);
    c.fillStyle = '#d8edf2';
    c.font = 'bold 22px monospace';
    c.fillText('SERVO & LIPO SPARES', 38, 118);
    c.fillStyle = '#6ad8ec';
    c.font = '18px monospace';
    c.fillText('GIFT BUILD · DO NOT PEEK!', 38, 168);
  }, 'base-case-display');
  texPool.push(labelTex);

  const caseBody = new THREE.MeshStandardMaterial({ color: '#202a32', roughness: 0.45, metalness: 0.55 });
  const orangeTrim = new THREE.MeshStandardMaterial({ color: '#e86a24', roughness: 0.35, metalness: 0.3 });
  const topLabel = new THREE.MeshStandardMaterial({ name: 'Spare case display label', map: labelTex, roughness: 0.5 });

  const box = new THREE.Mesh(new THREE.BoxGeometry(240, 78, 175), caseBody);
  box.position.set(0, 39, 0);
  box.castShadow = true; box.receiveShadow = true;
  group.add(box);

  const lidRim = new THREE.Mesh(new THREE.BoxGeometry(246, 10, 181), orangeTrim);
  lidRim.position.set(0, 66, 0);
  group.add(lidRim);

  const badge = new THREE.Mesh(new THREE.PlaneGeometry(180, 90), topLabel);
  badge.name = 'Spare case display top';
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, 78.5, 0);
  group.add(badge);

  return prepareFadeableRoot(group, matPool);
}

export async function installWorkshopToyStory(api) {
  const activeDesk = api?.sceneDesks?.active;
  const rigMounts = activeDesk?.rig?.mounts;
  const fallbackMounts = api?.workspaceAccessories?.mounts;
  const getMount = role => rigMounts?.[role] || fallbackMounts?.get(role)?.group || null;

  const desktop = getMount('desktop');
  if (!desktop) return null;
  const shelf = getMount('shelf');
  const lowerShelf = getMount('lower-shelf');
  const baseShelf = getMount('base-shelf');

  // Hide the drafting-kit board / floor plan on the workshop desk so the Smart Robot Toy
  // workbench takes its place at every tilt angle.
  const hiddenItems = [];
  for (const [id, item] of activeDesk?.objects?.entries?.() || []) {
    const label = `${id} ${item?.obj?.name || ''} ${item?.saved?.label || ''} ${item?.obj?.userData?.accessoryId || ''}`;
    if (/drafting-kit|drafting board|floor plan/i.test(label)) {
      hiddenItems.push({ item, wasRemoved: !!item.saved?.removed, wasVisible: item.obj ? item.obj.visible : true });
      if (item.saved) item.saved.removed = true;
      if (item.obj) item.obj.visible = false;
    }
  }
  desktop.traverse(o => {
    if (o !== desktop && /drafting-kit|drafting board|floor plan/i.test(o.name || '')) {
      hiddenItems.push({ item: { obj: o }, wasRemoved: false, wasVisible: o.visible });
      o.visible = false;
    }
  });

  const added = [];
  const desktopNodes = [];
  const stowedNodes = [];
  const matPool = [];
  const texPool = [];

  const addNode = (parent, node, pos, rotY = 0, bucket = null) => {
    if (!parent || !node) return;
    node.position.set(pos[0], pos[1], pos[2]);
    if (rotY) node.rotation.y = THREE.MathUtils.degToRad(rotY);
    parent.add(node);
    node.updateMatrixWorld(true);
    added.push(node);
    if (bucket) bucket.push(node);
  };

  // ============================================================================
  // A. DESKTOP WORKBENCH ITEMS (visible at 0°..7° tilt, fade out 7°..10° tilt)
  // ============================================================================
  addNode(desktop, buildMakerMat(matPool, texPool, { stowed: false }), [-25, 0, 50], 0, desktopNodes);
  addNode(desktop, buildSmartRobotFigure(matPool, { stowed: false }), [-20, 4, 42], 0, desktopNodes);
  addNode(desktop, buildDiagnosticDock(matPool, texPool, { stowed: false }), [175, 4, 72], -14, desktopNodes);
  addNode(desktop, buildMagneticPartsTray(matPool, { stowed: false }), [-225, 4, 78], 11, desktopNodes);
  addNode(desktop, buildChildSketchSheet(matPool, texPool, { stowed: false }), [-220, 4.5, -75], 8, desktopNodes);

  // ============================================================================
  // B. STOWED SHELF ITEMS (fade in at 7°..10° tilt on top shelf, 2nd shelf & base shelf)
  // ============================================================================
  if (shelf) {
    // Maker mat stowed flat in the center of the top shelf (fits the 280 mm shelf depth!)
    addNode(shelf, buildMakerMat(matPool, texPool, { stowed: true }), [-10, 0, 2], 0, stowedNodes);
    // Smart Robot ("Robo-Pal") seated proudly on the left-center of the mat on the top shelf
    addNode(shelf, buildSmartRobotFigure(matPool, { stowed: true }), [-115, 4.5, 8], 8, stowedNodes);
    // Magnetic parts tray stowed on the right side of the mat on the top shelf
    addNode(shelf, buildMagneticPartsTray(matPool, { stowed: true }), [165, 4.5, 4], -6, stowedNodes);
  }
  if (lowerShelf) {
    // Child's robot drawing & Diagnostic OLED test dock organized on the second shelf
    addNode(lowerShelf, buildChildSketchSheet(matPool, texPool, { stowed: true }), [-195, 0, 12], 5, stowedNodes);
    addNode(lowerShelf, buildDiagnosticDock(matPool, texPool, { stowed: true }), [45, 0, 18], -8, stowedNodes);
  }
  if (baseShelf) {
    // Gimbal cradle stowed on the bottom shelf / footrest alongside the spare parts case
    addNode(baseShelf, buildGimbalCradle(matPool, { stowed: true }), [-215, 0, 8], 6, stowedNodes);
    addNode(baseShelf, buildBottomShelfSpareCase(matPool, texPool), [225, 0, 6], -5, null);
  }

  // ============================================================================
  // C. COMPANION PROTOTYPES & MAKER TOOLS ON SHELVES
  // ============================================================================
  try {
    const lib = await propLibrary();
    const shelfSpecs = [
      // Always on Top Shelf (flanking the center mat bay on the left and right)
      { parent: shelf, role: 'shelf', id: 'droid-figure', name: 'Companion droid prototype', key: 'workshop:toy-story:droid-prototype', pos: [-475, 0, 10], scale: 0.21, rotY: 18, bucket: null },
      { parent: shelf, role: 'shelf', id: 'lego-bricks', name: 'Maker building bricks', key: 'workshop:toy-story:lego-bricks', pos: [430, 0, 20], scale: 0.78, rotY: -10, bucket: null },
      // Stowed onto center of Top Shelf (next to Robo-Pal on the mat) when tilted
      { parent: shelf, role: 'shelf', id: 'robotic-arm', name: 'Servo arm sub-assembly', key: 'workshop:toy-story:servo-arm', pos: [25, 4.5, 12], scale: 0.14, rotY: 22, bucket: stowedNodes },
      // Always on Second Shelf (flanking the stowed drawing & diagnostic dock)
      { parent: lowerShelf, role: 'lower-shelf', id: 'caliper', name: 'Workshop digital caliper', key: 'workshop:toy-story:caliper', pos: [-425, 0, 28], scale: 1.15, rotY: 14, bucket: null },
      { parent: lowerShelf, role: 'lower-shelf', id: 'multi-tool-open', name: 'Workshop multi-tool', key: 'workshop:toy-story:multi-tool', pos: [275, 0, 28], scale: 1.15, rotY: -20, bucket: null },
      { parent: lowerShelf, role: 'lower-shelf', id: 'painters-tape', name: "Workshop painter's tape", key: 'workshop:toy-story:painters-tape', pos: [425, 0, 24], scale: 1.0, rotY: 15, bucket: null },
      // Stowed onto Bottom Shelf / Footrest (between the gimbal cradle and spare parts case)
      { parent: baseShelf, role: 'base-shelf', id: 'atelier-gaming-controller-cyber', name: 'Robot RC test controller', key: 'workshop:toy-story:rc-controller', pos: [5, 0, 22], scale: 1.15, rotY: -14, bucket: stowedNodes },
    ];
    for (const s of shelfSpecs) {
      if (!s.parent || !lib.entry(s.id)) continue;
      const inst = await lib.instance(s.id);
      inst.name = s.name;
      markAsset(inst, s.key, s.role);
      inst.scale.multiplyScalar(s.scale);
      if (s.bucket) prepareFadeableRoot(inst, matPool);
      addNode(s.parent, inst, s.pos, s.rotY, s.bucket);
    }
  } catch (err) {
    console.warn('[workshop-toy-story] shelf prop load warning:', err);
  }

  // Keep the hanging shelf-organizer ("Organizer desk finish") anchored to the stationary base-shelf (legs)
  // AND synced to the live desk wood material (Natural Birch) so it neither floats up on Lift nor turns blue-green.
  const syncOrganizerWood = () => {
    const orgX = activeDesk?.state?.size === '48x30' ? -485.4903591652852 : -606.8640533097873;
    const orgY = -2.0828908087664786;
    const orgZ = -93.62175885514537;
    const orgItem = activeDesk?.objects?.get?.('accessory-shelf-organizer');
    if (orgItem && baseShelf) {
      if (orgItem.obj && orgItem.obj.parent !== baseShelf) {
        baseShelf.add(orgItem.obj);
      }
      if (orgItem.obj) {
        orgItem.obj.position.set(orgX, orgY, orgZ);
        orgItem.obj.quaternion.set(0, -0.7071067811865475, 0, 0.7071067811865476);
        orgItem.obj.updateMatrixWorld(true);
      }
      if (orgItem.saved) {
        orgItem.saved.role = 'base-shelf';
        if (orgItem.saved.transform?.p) {
          orgItem.saved.transform.p.x = orgX;
          orgItem.saved.transform.p.y = orgY;
          orgItem.saved.transform.p.z = orgZ;
        }
      }
    } else if (baseShelf) {
      for (const m of [lowerShelf, shelf, desktop]) {
        m?.traverse?.(o => {
          if (o.name === 'Accessory:shelf-organizer' || o.userData?.accessoryId === 'shelf-organizer') {
            baseShelf.add(o);
            o.position.set(orgX, orgY, orgZ);
            o.quaternion.set(0, -0.7071067811865475, 0, 0.7071067811865476);
            o.updateMatrixWorld(true);
          }
        });
      }
    }

    let liveWood = null;
    api.loadedModel?.traverse?.(o => {
      if (!liveWood && o.isMesh && /^Desktop(_3)?$/.test(o.name) && o.material?.isMeshPhysicalMaterial) liveWood = o.material;
    });
    if (!liveWood) return;
    for (const m of [desktop, shelf, lowerShelf, baseShelf]) {
      m?.traverse?.(o => {
        if (o.isMesh && (o.userData?.artistShelfWood || o.name === 'Organizer desk finish')) {
          const sig = liveWood.uuid + ':' + liveWood.version + ':' + liveWood.color?.getHex?.() + ':' + liveWood.map?.uuid;
          if (o.sceneFinishSignature === sig) return;
          o.material.copy(liveWood);
          o.material.name = 'Artist shelf wood';
          o.material.userData.sharedTextures = true;
          o.material.needsUpdate = true;
          o.sceneFinishSignature = sig;
        }
      });
    }
  };

  // Smooth 7°..10° tilt cross-fade between Desktop Workbench state and Stowed Shelf state. A node that a film chapter
  // gives a time on screen of its own (a sceneEdits `show` window: the storage chapter's Robo-Pal, which Andre sets on
  // the top shelf by hand) is left out of the cross-fade: it is there, whole, and the chapter's window decides.
  const timed = node => !!node?.userData?.__filmFxEdits?.some?.(edit => edit?.show);
  const applyTilt = (rawTilt = 0) => {
    const tilt = Number(rawTilt) || 0;
    let u = THREE.MathUtils.clamp((tilt - TILT_FADE_START) / (TILT_FADE_END - TILT_FADE_START), 0, 1);
    u = u * u * (3 - 2 * u);
    setNodesFade(desktopNodes.filter(n => !timed(n)), 1 - u);
    setNodesFade(stowedNodes.filter(n => !timed(n)), u);
    setNodesFade(desktopNodes.concat(stowedNodes).filter(timed), 1);
  };

  // Hook both rig.updatePose and peripherals.update so live playback, timeline scrubbing,
  // Render still, and 480p/4K bakeDraw all update the fade and stationary organizer synchronously!
  const rig = activeDesk?.rig;
  const origUpdatePose = rig?.updatePose;
  if (rig && typeof origUpdatePose === 'function') {
    rig.updatePose = function (h, t) {
      const res = origUpdatePose.call(this, h, t);
      syncOrganizerWood();
      applyTilt(t);
      return res;
    };
  }
  const periph = activeDesk?.peripherals;
  const origPeriphUpdate = periph?.update;
  if (periph && typeof origPeriphUpdate === 'function') {
    periph.update = function (...args) {
      const res = origPeriphUpdate.apply(this, args);
      syncOrganizerWood();
      applyTilt(activeDesk?.state?.tilt ?? 0);
      return res;
    };
  }

  activeDesk?.rig?.restyle?.();
  syncOrganizerWood();
  activeDesk?.peripherals?.ready?.then?.(() => {
    syncOrganizerWood();
    requestAnimationFrame(() => syncOrganizerWood());
  });
  api.sceneDesks?.objects?.ready?.then?.(() => {
    syncOrganizerWood();
    requestAnimationFrame(() => syncOrganizerWood());
  });
  applyTilt(activeDesk?.state?.tilt ?? 0);

  return {
    count: added.length,
    frame() {
      syncOrganizerWood();
      applyTilt(activeDesk?.state?.tilt ?? 0);
    },
    restore() {
      if (rig && origUpdatePose) rig.updatePose = origUpdatePose;
      if (periph && origPeriphUpdate) periph.update = origPeriphUpdate;
      for (const h of hiddenItems) {
        if (h.item?.saved) h.item.saved.removed = h.wasRemoved;
        if (h.item?.obj) h.item.obj.visible = h.wasVisible;
      }
      for (const node of added) node.removeFromParent();
      for (const m of matPool) m.dispose();
      for (const t of texPool) t.dispose();
    },
  };
}
