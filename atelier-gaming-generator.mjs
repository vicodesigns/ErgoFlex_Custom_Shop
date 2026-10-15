// Owner-supplied Atelier pro gaming generator; metres, Y up, no staging furniture.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x47414d45;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Carbon Fiber Weave Bump Texture
      const carbonCanvas = document.createElement('canvas');
      carbonCanvas.width = 128;
      carbonCanvas.height = 128;
      const cCtx = carbonCanvas.getContext('2d');
      cCtx.fillStyle = '#505050';
      cCtx.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 8) {
        for (let x = 0; x < 128; x += 8) {
          const offset = (y / 8) % 2 === 0 ? 0 : 4;
          cCtx.fillStyle = '#909090';
          cCtx.fillRect((x + offset) % 128, y, 4, 4);
          cCtx.fillStyle = '#303030';
          cCtx.fillRect((x + offset + 4) % 128, y, 4, 4);
        }
      }
      const carbonTex = new THREE.CanvasTexture(carbonCanvas);
      carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
      carbonTex.repeat.set(16, 16);

      // 2. Micro-Textured Speed Cloth Mousepad Texture
      const padCanvas = document.createElement('canvas');
      padCanvas.width = 256;
      padCanvas.height = 256;
      const pCtx = padCanvas.getContext('2d');
      pCtx.fillStyle = '#222630';
      pCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5000; i++) {
        const v = 40 + Math.floor(random() * 35);
        pCtx.fillStyle = `rgb(${v},${v},${v + 6})`;
        pCtx.fillRect(random() * 256, random() * 256, 2, 2);
      }
      const padTex = new THREE.CanvasTexture(padCanvas);
      padTex.wrapS = padTex.wrapT = THREE.RepeatWrapping;
      padTex.repeat.set(10, 6);

      // 3. Sci-Fi Esports HUD / Ultrawide Game Screen Texture
      const gameScreenCanvas = document.createElement('canvas');
      gameScreenCanvas.width = 1024;
      gameScreenCanvas.height = 320;
      const gCtx = gameScreenCanvas.getContext('2d');
      const bgGrad = gCtx.createLinearGradient(0, 0, 1024, 320);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#1e1b4b');
      gCtx.fillStyle = bgGrad;
      gCtx.fillRect(0, 0, 1024, 320);

      // Perspective Cyber Grid Horizon
      gCtx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      gCtx.lineWidth = 2;
      for (let x = -200; x <= 1224; x += 80) {
        gCtx.beginPath();
        gCtx.moveTo(512 + (x - 512) * 0.2, 150);
        gCtx.lineTo(x, 320);
        gCtx.stroke();
      }
      for (let y = 165; y < 320; y += 28) {
        gCtx.beginPath();
        gCtx.moveTo(0, y);
        gCtx.lineTo(1024, y);
        gCtx.stroke();
      }

      // Center Aim Reticle & Telemetry HUD Bars
      gCtx.strokeStyle = '#00f2fe';
      gCtx.lineWidth = 3;
      gCtx.beginPath();
      gCtx.arc(512, 150, 32, 0, Math.PI * 2);
      gCtx.stroke();

      gCtx.fillStyle = '#f43f5e';
      gCtx.fillRect(48, 256, 180, 16);
      gCtx.fillStyle = '#00f2fe';
      gCtx.fillRect(48, 280, 220, 10);

      // Minimap Radar (Top Left)
      gCtx.strokeStyle = '#38bdf8';
      gCtx.strokeRect(42, 32, 110, 110);
      gCtx.fillStyle = '#22c55e';
      gCtx.beginPath();
      gCtx.arc(97, 87, 6, 0, Math.PI * 2);
      gCtx.fill();

      // FPS & GPU Telemetry Readout (Top Right)
      gCtx.fillStyle = '#a5f3fc';
      gCtx.font = '600 22px "JetBrains Mono", monospace';
      gCtx.fillText('240 FPS · 3.8ms', 800, 56);
      gCtx.fillStyle = '#f472b6';
      gCtx.fillText('GPU 58°C · 99%', 800, 88);

      const gameScreenTex = new THREE.CanvasTexture(gameScreenCanvas); gameScreenTex.colorSpace=THREE.SRGBColorSpace;

      // 4. Stream Deck Macro LCD Grid Texture (3x5 illuminated buttons)
      const deckCanvas = document.createElement('canvas');
      deckCanvas.width = 512;
      deckCanvas.height = 320;
      const dCtx = deckCanvas.getContext('2d');
      dCtx.fillStyle = '#090b10';
      dCtx.fillRect(0, 0, 512, 320);
      const btnColors = ['#06b6d4', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          const bx = 28 + c * 94;
          const by = 24 + r * 96;
          dCtx.fillStyle = btnColors[(r * 5 + c) % btnColors.length];
          dCtx.beginPath(); dCtx.roundRect(bx, by, 76, 76, 14);
          dCtx.fill();
          dCtx.fillStyle = '#ffffff';
          dCtx.fillRect(bx + 20, by + 28, 36, 20);
        }
      }
      const streamDeckTex = new THREE.CanvasTexture(deckCanvas); streamDeckTex.colorSpace=THREE.SRGBColorSpace;

      return { carbonTex, padTex, gameScreenTex, streamDeckTex };
    }

    const textures = createProceduralTextures();

    /**
     * Builds an Extended Esports Micro-Weave Desk Pad with a Glowing Fiber-Optic RGB Tube Perimeter
     */
    function buildRGBDeskMat(spanW, spanD, materials) {
      const matGroup = new THREE.Group();
      matGroup.name = 'RGBExtendedDeskPad';

      // Non-slip vulcanized rubber base + micro-weave cloth top
      const padMesh = new THREE.Mesh(
        new RoundedBoxGeometry(spanW, 0.005, spanD, 4, 0.018),
        materials.padMat
      );
      padMesh.position.y = 0.0025;
      matGroup.add(padMesh);

      // Continuous Glowing Fiber-Optic RGB Perimeter Tube
      const hw = spanW * 0.5;
      const hd = spanD * 0.5;
      const r = 0.018;
      const loopPath = new THREE.CurvePath();
      const pts = [
        new THREE.Vector3(-hw + r, 0.0035, -hd),
        new THREE.Vector3(hw - r, 0.0035, -hd),
        new THREE.Vector3(hw, 0.0035, -hd),
        new THREE.Vector3(hw, 0.0035, -hd + r),
        new THREE.Vector3(hw, 0.0035, hd - r),
        new THREE.Vector3(hw, 0.0035, hd),
        new THREE.Vector3(hw - r, 0.0035, hd),
        new THREE.Vector3(-hw + r, 0.0035, hd),
        new THREE.Vector3(-hw, 0.0035, hd),
        new THREE.Vector3(-hw, 0.0035, hd - r),
        new THREE.Vector3(-hw, 0.0035, -hd + r),
        new THREE.Vector3(-hw, 0.0035, -hd)
      ];
      loopPath.add(new THREE.LineCurve3(pts[0], pts[1]));
      loopPath.add(new THREE.QuadraticBezierCurve3(pts[1], pts[2], pts[3]));
      loopPath.add(new THREE.LineCurve3(pts[3], pts[4]));
      loopPath.add(new THREE.QuadraticBezierCurve3(pts[4], pts[5], pts[6]));
      loopPath.add(new THREE.LineCurve3(pts[6], pts[7]));
      loopPath.add(new THREE.QuadraticBezierCurve3(pts[7], pts[8], pts[9]));
      loopPath.add(new THREE.LineCurve3(pts[9], pts[10]));
      loopPath.add(new THREE.QuadraticBezierCurve3(pts[10], pts[11], pts[0]));

      const rgbRim = new THREE.Mesh(
        new THREE.TubeGeometry(loopPath, 72, 0.0026, 8, true),
        materials.rgbMat1
      );
      matGroup.add(rgbRim);

      // Top-left USB Power Controller Box on Mat Edge
      const controllerBox = new THREE.Mesh(
        new RoundedBoxGeometry(0.032, 0.009, 0.018, 2, 0.003),
        materials.chassisMat
      );
      controllerBox.position.set(-hw + 0.055, 0.0045, -hd);
      matGroup.add(controllerBox);

      return matGroup;
    }

    /**
     * Builds a Custom 60% Esports Mechanical Keyboard (with highlighted WASD caps & RGB Underglow)
     * plus an Ultralight Honeycomb Wireless Gaming Mouse & Charging Dock
     */
    function buildEsportsPeripherals(materials) {
      const periphGroup = new THREE.Group();
      periphGroup.name = 'Gaming component peripherals';

      // 1. 60% Compact Mechanical Gaming Keyboard
      const kbGroup = new THREE.Group();
      kbGroup.position.set(-0.08, 0, 0.08);
      kbGroup.rotation.y = 0.06; // Pro FPS player slight keyboard tilt

      const kbW = 0.295, kbD = 0.108, kbH = 0.022;
      const kbChassis = new THREE.Mesh(
        new RoundedBoxGeometry(kbW, kbH, kbD, 4, 0.005),
        materials.chassisMat
      );
      kbChassis.position.y = kbH * 0.5 + 0.003;
      kbChassis.rotation.x = 0.08;
      kbGroup.add(kbChassis);

      // Glowing Acrylic RGB Diffuser Baseplate Under Keyboard
      const rgbUnder = new THREE.Mesh(
        new RoundedBoxGeometry(kbW + 0.004, 0.005, kbD + 0.004, 2, 0.002),
        materials.rgbMat1
      );
      rgbUnder.position.y = 0.003;
      kbGroup.add(rgbUnder);

      // Sculpted Keycap Matrix with Highlighted WASD, Esc & Spacebar
      const rows = 5, cols = 14;
      const startX = -kbW * 0.45;
      const startZ = -kbD * 0.37;
      const stepX = (kbW * 0.90) / (cols - 1);
      const stepZ = (kbD * 0.74) / (rows - 1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 4 && c >= 4 && c <= 9) {
            if (c === 4) {
              const space = new THREE.Mesh(
                new RoundedBoxGeometry(stepX * 5.6, 0.010, stepZ * 0.85, 2, 0.002),
                materials.rgbMat2
              );
              space.position.set(startX + 6.5 * stepX, kbH + 0.007 - r * 0.0015, startZ + r * stepZ);
              space.rotation.x = 0.08;
              kbGroup.add(space);
            }
            continue;
          }

          // Highlight WASD cluster (row 1 col 2, row 2 cols 1,2,3) and Esc (0,0)
          const isWASD = (r === 1 && c === 2) || (r === 2 && (c >= 1 && c <= 3));
          const isEsc = (r === 0 && c === 0);
          const capMat = (isWASD || isEsc) ? materials.rgbMat2 : materials.trimMat;

          const keycap = new THREE.Mesh(
            new RoundedBoxGeometry(stepX * 0.84, 0.010, stepZ * 0.84, 2, 0.002),
            capMat
          );
          keycap.position.set(startX + c * stepX, kbH + 0.007 - r * 0.0015, startZ + r * stepZ);
          keycap.rotation.x = 0.08;
          kbGroup.add(keycap);
        }
      }
      periphGroup.add(kbGroup);

      // 2. Ultralight Wireless Esports Gaming Mouse + RGB Underglow + Scroll Wheel
      const mouseGroup = new THREE.Group();
      mouseGroup.position.set(0.16, 0, 0.09);
      mouseGroup.rotation.y = -0.08;

      const mouseShell = new THREE.Mesh(
        new RoundedBoxGeometry(0.062, 0.036, 0.118, 6, 0.018),
        materials.chassisMat
      );
      mouseShell.position.y = 0.019;
      mouseGroup.add(mouseShell);

      // RGB Scroll Wheel & Rear Palm Logo Glow
      const scrollWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.006, 18),
        materials.rgbMat1
      );
      scrollWheel.rotation.z = Math.PI * 0.5;
      scrollWheel.position.set(0, 0.034, -0.032);
      mouseGroup.add(scrollWheel);

      const mouseUnderglow = new THREE.Mesh(
        new RoundedBoxGeometry(0.056, 0.004, 0.108, 4, 0.012),
        materials.rgbMat2
      );
      mouseUnderglow.position.y = 0.002;
      mouseGroup.add(mouseUnderglow);

      periphGroup.add(mouseGroup);
      return periphGroup;
    }

    /**
     * Builds an Over-Ear Planar Magnetic Gaming Headset on an Anodized Aluminum RGB Stand
     */
    function buildHeadsetAndStand(materials) {
      const group = new THREE.Group();
      group.name = 'Gaming component headset';

      // Base Plinth with RGB Ring
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.064, 0.014, 32),
        materials.chassisMat
      );
      base.position.y = 0.007;
      group.add(base);

      const baseRgb = new THREE.Mesh(
        new THREE.TorusGeometry(0.061, 0.0022, 8, 36),
        materials.rgbMat1
      );
      baseRgb.rotation.x = Math.PI * 0.5;
      baseRgb.position.y = 0.003;
      group.add(baseRgb);

      // Vertical Aluminum Stem & Top Cradle Rest
      const stemH = 0.245;
      const stem = new THREE.Mesh(
        new RoundedBoxGeometry(0.016, stemH, 0.024, 3, 0.004),
        materials.trimMat
      );
      stem.position.set(0, stemH * 0.5 + 0.01, -0.015);
      group.add(stem);

      const hanger = new THREE.Mesh(
        new RoundedBoxGeometry(0.045, 0.012, 0.068, 3, 0.004),
        materials.chassisMat
      );
      hanger.position.set(0, stemH + 0.014, 0.005);
      group.add(hanger);

      // Over-Ear Gaming Headphones Hanging on the Cradle
      const headY = stemH - 0.045;
      const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.072, 0.011, 12, 32, Math.PI),
        materials.chassisMat
      );
      headband.position.set(0, headY, 0.01);
      group.add(headband);

      // Left & Right Plush Earcups + RGB Outer Rings + Boom Mic
      [-1, 1].forEach((side) => {
        const cupGroup = new THREE.Group();
        cupGroup.position.set(side * 0.068, headY - 0.025, 0.01);
        cupGroup.rotation.z = side * 0.14;

        // Memory Foam Ear Cushion
        const cushion = new THREE.Mesh(
          new THREE.CylinderGeometry(0.044, 0.044, 0.022, 28),
          materials.darkPadMat
        );
        cushion.rotation.z = Math.PI * 0.5;
        cupGroup.add(cushion);

        // Outer Driver Shell
        const driverShell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.036, 0.024, 28),
          materials.chassisMat
        );
        driverShell.rotation.z = Math.PI * 0.5;
        driverShell.position.x = side * 0.018;
        cupGroup.add(driverShell);

        // Illuminated RGB Accent Ring on Earcup
        const cupRgb = new THREE.Mesh(
          new THREE.TorusGeometry(0.036, 0.0025, 10, 28),
          materials.rgbMat2
        );
        cupRgb.rotation.y = Math.PI * 0.5;
        cupRgb.position.x = side * 0.030;
        cupGroup.add(cupRgb);

        group.add(cupGroup);
      });

      // Detachable Broadcast Boom Microphone on Left Earcup
      const micCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.075, headY - 0.045, 0.01),
        new THREE.Vector3(-0.065, headY - 0.065, 0.055),
        new THREE.Vector3(-0.025, headY - 0.068, 0.078)
      ]);
      const boomTube = new THREE.Mesh(
        new THREE.TubeGeometry(micCurve, 20, 0.0028, 8, false),
        materials.chromeMat
      );
      group.add(boomTube);

      const popTip = new THREE.Mesh(
        new RoundedBoxGeometry(0.016, 0.012, 0.022, 3, 0.005),
        materials.darkPadMat
      );
      popTip.position.set(-0.022, headY - 0.068, 0.080);
      group.add(popTip);

      return group;
    }

    /**
     * Builds an Ergonomic Pro Wireless Gamepad Controller with Twin Thumbsticks, D-Pad & Face Buttons
     */
    function buildProController(materials, primaryAccent = true) {
      const pad = new THREE.Group();
      pad.name = 'Gaming component controller';

      // Center Bridge Body
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(0.115, 0.026, 0.068, 4, 0.010),
        materials.chassisMat
      );
      body.position.y = 0.022;
      pad.add(body);

      // Left & Right Sculpted Ergonomic Grips (angled outward & backward)
      [-1, 1].forEach((side) => {
        const grip = new THREE.Mesh(
          new RoundedBoxGeometry(0.038, 0.032, 0.105, 5, 0.015),
          materials.chassisMat
        );
        grip.position.set(side * 0.052, 0.020, 0.018);
        grip.rotation.y = side * -0.24;
        grip.rotation.x = -0.14;
        pad.add(grip);

        // Concave Analog Thumbstick + RGB Collar Ring
        const stickX = side === -1 ? -0.034 : 0.022;
        const stickZ = side === -1 ? -0.008 : 0.016;

        const rgbCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.011, 0.0018, 8, 20),
          primaryAccent ? materials.rgbMat1 : materials.rgbMat2
        );
        rgbCollar.rotation.x = Math.PI * 0.5;
        rgbCollar.position.set(stickX, 0.036, stickZ);
        pad.add(rgbCollar);

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, 0.012, 12),
          materials.chromeMat
        );
        shaft.position.set(stickX, 0.040, stickZ);
        pad.add(shaft);

        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.010, 0.008, 0.004, 20),
          materials.darkPadMat
        );
        cap.position.set(stickX, 0.046, stickZ);
        pad.add(cap);
      });

      // D-Pad Cross on Left + 4 Action Buttons on Right
      const dpadH = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.004, 0.007, 1, 0.001), materials.trimMat);
      dpadH.position.set(-0.022, 0.036, 0.016);
      const dpadV = new THREE.Mesh(new RoundedBoxGeometry(0.007, 0.004, 0.022, 1, 0.001), materials.trimMat);
      dpadV.position.set(-0.022, 0.036, 0.016);
      pad.add(dpadH, dpadV);

      // 4 ABXY Face Buttons
      [
        [0.038, -0.018],
        [0.048, -0.008],
        [0.028, -0.008],
        [0.038, 0.002]
      ].forEach(([bx, bz], i) => {
        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 14),
          i % 2 === 0 ? materials.rgbMat1 : materials.rgbMat2
        );
        btn.position.set(bx, 0.036, bz);
        pad.add(btn);
      });

      return pad;
    }

    function buildGamerScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierGamerGear_${cfg.archetype}`;

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const spanW = cfg.spread;
      const spanD = cfg.depth;

      // --- Shared PBR & Emissive RGB Materials ---
      const chassisMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.chassisColor),
        roughness: 0.28,
        metalness: 0.35,
        clearcoat: 0.35,
        clearcoatRoughness: 0.24,
        bumpMap: textures.carbonTex,
        bumpScale: 0.0012,
        wireframe: cfg.wireframe
      });

      const trimMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.trimColor),
        roughness: 0.32,
        metalness: 0.65,
        clearcoat: 0.25,
        wireframe: cfg.wireframe
      });

      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.15,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      const padMat = new THREE.MeshPhysicalMaterial({
        color: 0x161922,
        roughness: 0.86,
        sheen: 0.6,
        bumpMap: textures.padTex,
        bumpScale: 0.0022,
        wireframe: cfg.wireframe
      });

      const darkPadMat = new THREE.MeshStandardMaterial({
        color: 0x11131a,
        roughness: 0.78,
        wireframe: cfg.wireframe
      });

      const temperedGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xcbd5e1,
        roughness: 0.06,
        transmission: 0.86,
        transparent: true,
        opacity: 0.38,
        ior: 1.52,
        wireframe: cfg.wireframe
      });

      const rgbCol1 = new THREE.Color(cfg.rgbColor1);
      const rgbCol2 = new THREE.Color(cfg.rgbColor2);

      const rgbMat1 = new THREE.MeshStandardMaterial({
        color: cfg.rgbOn ? rgbCol1 : new THREE.Color(0x27272a),
        emissive: cfg.rgbOn ? rgbCol1 : new THREE.Color(0x000000),
        emissiveIntensity: cfg.rgbOn ? 2.1 : 0,
        roughness: 0.2,
        wireframe: cfg.wireframe
      });

      const rgbMat2 = new THREE.MeshStandardMaterial({
        color: cfg.rgbOn ? rgbCol2 : new THREE.Color(0x27272a),
        emissive: cfg.rgbOn ? rgbCol2 : new THREE.Color(0x000000),
        emissiveIntensity: cfg.rgbOn ? 2.1 : 0,
        roughness: 0.2,
        wireframe: cfg.wireframe
      });

      for(const [name,m] of Object.entries({chassisMat,trimMat,chromeMat,padMat,darkPadMat,temperedGlassMat,rgbMat1,rgbMat2})){m.name='Gaming '+name; m.userData.roomPaletteLocked=true;}
      rgbMat1.userData.gamerGlow=2.1; rgbMat2.userData.gamerGlow=2.1;
      const materials = {
        chassisMat,
        trimMat,
        chromeMat,
        padMat,
        darkPadMat,
        temperedGlassMat,
        rgbMat1,
        rgbMat2
      };

      const matTopY = cfg.includeDeskMat ? 0.005 : 0.0;
      if (cfg.includeDeskMat) {
        propGroup.add(buildRGBDeskMat(spanW, spanD, materials));
      }

      let maxElevationH = 0.46;
      let lightAnchor1 = new THREE.Vector3(0.28, 0.22, -0.05);
      let lightAnchor2 = new THREE.Vector3(-0.22, 0.18, 0.05);

      // =======================================================================
      // ARCHETYPE 1: LIQUID-COOLED SFF GAMING PC & ULTRAWIDE CURVED MONITOR
      // =======================================================================
      if (cfg.archetype === 'battlestation') {
        // 1. 34" Curved Ultrawide OLED Gaming Monitor on Articulated Gas-Spring Arm
        const monGroup = new THREE.Group(); monGroup.name='Gaming component monitor';
        monGroup.position.set(-0.11, matTopY, -spanD * 0.28);

        // Desk Clamp & Articulated Gas-Spring Monitor Arm
        const clamp = new THREE.Mesh(
          new RoundedBoxGeometry(0.068, 0.045, 0.065, 3, 0.006),
          chassisMat
        );
        clamp.position.set(-0.12, 0.022, -0.04);
        monGroup.add(clamp);

        const lowerArm = new THREE.Mesh(
          new RoundedBoxGeometry(0.032, 0.22, 0.038, 3, 0.005),
          trimMat
        );
        lowerArm.position.set(-0.06, 0.14, -0.04);
        lowerArm.rotation.z = -0.35;
        monGroup.add(lowerArm);

        // Curved Ultrawide Display Panel (Tilts & Elevates via Articulation Slider!)
        const screenPivot = new THREE.Group();
        const elevOffset = (cfg.articulation - 0.35) * 0.06;
        screenPivot.position.set(0, 0.25 + elevOffset, 0.04);
        screenPivot.rotation.x = (cfg.articulation - 0.35) * -0.22;

        // 1800R Curved Bezel & OLED Game Screen Segment
        const curveR = 0.68;
        const arcSpan = 0.76;
        const screenH = 0.235;

        const curvedBackShell = new THREE.Mesh(
          new THREE.CylinderGeometry(
            curveR + 0.014,
            curveR + 0.014,
            screenH + 0.014,
            40,
            1,
            true,
            Math.PI - arcSpan * 0.5,
            arcSpan
          ),
          chassisMat
        );
        curvedBackShell.position.z = curveR;
        screenPivot.add(curvedBackShell);

        // Rear Core RGB Ring on Back of Gaming Monitor
        const rearRgbRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.005, 12, 32),
          rgbMat2
        );
        rearRgbRing.position.set(0, 0, -0.016);
        screenPivot.add(rearRgbRing);

        // Active Illuminated Ultrawide OLED Display Surface
        const oledScreen = new THREE.Mesh(
          new THREE.CylinderGeometry(
            curveR,
            curveR,
            screenH,
            40,
            1,
            true,
            Math.PI - arcSpan * 0.49,
            arcSpan * 0.98
          ),
          new THREE.MeshBasicMaterial({
            map: textures.gameScreenTex,
            side: THREE.DoubleSide,
            wireframe: cfg.wireframe
          })
        );
        oledScreen.name='Gaming curved display'; oledScreen.material.userData.sceneDisplay='theme';
        oledScreen.position.z = curveR + 0.002;
        screenPivot.add(oledScreen);

        // Top Screenbar LED Light + 4K Webcam Perched on Monitor Crest
        const lightBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, 0.28, 16),
          trimMat
        );
        lightBar.rotation.z = Math.PI * 0.5;
        lightBar.position.set(0, screenH * 0.5 + 0.016, 0.025);
        screenPivot.add(lightBar);

        monGroup.add(screenPivot);
        propGroup.add(monGroup);

        // 2. Custom Liquid-Cooled SFF Gaming PC Tower (Right Side of Desk)
        const pcGroup = new THREE.Group(); pcGroup.name='Gaming component pc';
        pcGroup.position.set(spanW * 0.33, matTopY, -0.03);
        pcGroup.rotation.y = -0.24;

        const pcW = 0.165, pcH = 0.285, pcD = 0.315;

        // CNC Anodized Chassis Frame (Top, Bottom, Rear & Front Slat Grille)
        const pcBase = new THREE.Mesh(new RoundedBoxGeometry(pcW, 0.022, pcD, 3, 0.005), chassisMat);
        pcBase.position.y = 0.014;
        const pcTop = new THREE.Mesh(new RoundedBoxGeometry(pcW, 0.018, pcD, 3, 0.005), chassisMat);
        pcTop.position.y = pcH;
        const pcBack = new THREE.Mesh(new RoundedBoxGeometry(pcW, pcH, 0.018, 2, 0.004), chassisMat);
        pcBack.position.set(0, pcH * 0.5, -pcD * 0.5 + 0.009);
        const pcRightWall = new THREE.Mesh(new RoundedBoxGeometry(0.014, pcH, pcD, 2, 0.004), chassisMat);
        pcRightWall.position.set(pcW * 0.5 - 0.007, pcH * 0.5, 0);
        pcGroup.add(pcBase, pcTop, pcBack, pcRightWall);

        // Front Slatted Timber / Alloy Airflow Intake Panel
        for (let s = 0; s < 7; s++) {
          const slat = new THREE.Mesh(
            new RoundedBoxGeometry(0.012, pcH - 0.035, 0.016, 2, 0.003),
            trimMat
          );
          slat.position.set(-pcW * 0.38 + s * (pcW * 0.76 / 6), pcH * 0.5, pcD * 0.5 - 0.008);
          pcGroup.add(slat);
        }

        // Internal Motherboard, AIO Infinity-Mirror Pump Block, RGB RAM & Triple-Fan GPU
        const aioPump = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 0.026, 28),
          chassisMat
        );
        aioPump.rotation.z = Math.PI * 0.5;
        aioPump.position.set(0.02, pcH * 0.66, -0.03);
        pcGroup.add(aioPump);

        const aioRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.022, 0.0035, 10, 28),
          rgbMat1
        );
        aioRing.rotation.y = Math.PI * 0.5;
        aioRing.position.set(0.006, pcH * 0.66, -0.03);
        pcGroup.add(aioRing);

        // 4 Illuminated DDR5 RGB RAM Sticks
        for (let r = 0; r < 4; r++) {
          const ramBar = new THREE.Mesh(
            new RoundedBoxGeometry(0.004, 0.068, 0.009, 1, 0.001),
            r % 2 === 0 ? rgbMat1 : rgbMat2
          );
          ramBar.position.set(0.018, pcH * 0.66, 0.018 + r * 0.009);
          pcGroup.add(ramBar);
        }

        // Braided Liquid-Cooling AIO Tubes
        const tubeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.01, pcH * 0.66, -0.01),
          new THREE.Vector3(-0.02, pcH * 0.76, 0.04),
          new THREE.Vector3(0.0, pcH - 0.025, 0.07)
        ]);
        pcGroup.add(new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 20, 0.0055, 8, false), darkPadMat));

        // Horizontal RTX-Class Triple-Fan GPU Brick with Glowing Side Bar
        const gpuBrick = new THREE.Mesh(
          new RoundedBoxGeometry(0.095, 0.048, 0.245, 3, 0.005),
          trimMat
        );
        gpuBrick.position.set(0.0, 0.068, 0.0);
        pcGroup.add(gpuBrick);

        const gpuLedBar = new THREE.Mesh(
          new RoundedBoxGeometry(0.006, 0.010, 0.21, 1, 0.002),
          rgbMat2
        );
        gpuLedBar.position.set(-0.048, 0.075, 0.0);
        pcGroup.add(gpuLedBar);

        // Twin Top RGB Exhaust Fans
        [-0.065, 0.065].forEach((fz) => {
          const fanRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.052, 0.004, 10, 28),
            rgbMat1
          );
          fanRing.rotation.x = Math.PI * 0.5;
          fanRing.position.set(0, pcH - 0.015, fz);
          pcGroup.add(fanRing);
        });

        // Articulated Tempered Glass Side Panel (Swings Open via Articulation Slider!)
        const glassPivot = new THREE.Group();
        glassPivot.position.set(-pcW * 0.5, pcH * 0.5, -pcD * 0.5);
        glassPivot.rotation.y = -cfg.articulation * 0.65;

        const glassPanel = new THREE.Mesh(
          new RoundedBoxGeometry(0.006, pcH - 0.03, pcD - 0.02, 2, 0.002),
          temperedGlassMat
        );
        glassPanel.position.set(0, 0, (pcD - 0.02) * 0.5);
        glassPivot.add(glassPanel);
        pcGroup.add(glassPivot);

        propGroup.add(pcGroup);

        // 3. Peripherals & Headset
        if (cfg.includePeripherals) {
          const periph = buildEsportsPeripherals(materials);
          periph.position.set(-0.10, matTopY, 0.05);
          propGroup.add(periph);
        }

        if (cfg.includeHeadset) {
          const headset = buildHeadsetAndStand(materials);
          headset.position.set(-spanW * 0.38, matTopY, -0.06);
          headset.rotation.y = 0.35;
          propGroup.add(headset);
        }

        maxElevationH = 0.44;
        lightAnchor1.set(spanW * 0.32, 0.18, -0.03);
        lightAnchor2.set(-0.11, 0.25, -0.10);
      }

      // =======================================================================
      // ARCHETYPE 2: PRO STREAMER BROADCAST XLR MIC, STREAM DECK & MIXER RIG
      // =======================================================================
      else if (cfg.archetype === 'streamer') {
        // 1. Multi-Joint Scissor Broadcast Boom Arm + Dynamic XLR Microphone + Shockmount
        const boomGroup = new THREE.Group(); boomGroup.name='Gaming component microphone';
        boomGroup.position.set(-spanW * 0.34, matTopY, -spanD * 0.24);
        boomGroup.rotation.y = -0.35 + cfg.articulation * 0.48;

        const deskClamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.026, 0.055, 20),
          chassisMat
        );
        deskClamp.position.y = 0.0275;
        boomGroup.add(deskClamp);

        // Lower & Upper Scissor Boom Tubes
        const arm1 = new THREE.Mesh(
          new RoundedBoxGeometry(0.022, 0.26, 0.028, 2, 0.004),
          trimMat
        );
        arm1.position.set(0.06, 0.16, 0);
        arm1.rotation.z = -0.48;
        boomGroup.add(arm1);

        const arm2 = new THREE.Mesh(
          new RoundedBoxGeometry(0.24, 0.022, 0.026, 2, 0.004),
          trimMat
        );
        arm2.position.set(0.22, 0.265, 0);
        arm2.rotation.z = -0.12;
        boomGroup.add(arm2);

        // Suspended Dynamic Broadcast XLR Microphone Capsule + RGB Mute Ring + Pop Filter
        const micHub = new THREE.Group();
        micHub.position.set(0.33, 0.21, 0);

        const shockRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.036, 0.0035, 10, 28),
          chromeMat
        );
        shockRing.rotation.x = Math.PI * 0.5;
        micHub.add(shockRing);

        const micBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.125, 24),
          chassisMat
        );
        micBody.rotation.z = 0.35;
        micHub.add(micBody);

        const micLedRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.0245, 0.0028, 10, 24),
          rgbMat2
        );
        micLedRing.rotation.x = Math.PI * 0.5;
        micLedRing.rotation.y = 0.35;
        micHub.add(micLedRing);

        const foamWindscreen = new THREE.Mesh(
          new RoundedBoxGeometry(0.052, 0.058, 0.052, 5, 0.022),
          darkPadMat
        );
        foamWindscreen.position.set(0.02, -0.055, 0);
        micHub.add(foamWindscreen);

        boomGroup.add(micHub);
        propGroup.add(boomGroup);

        // 2. 15-Key LCD Stream Deck Controller on Angled Stand
        const deckGroup = new THREE.Group(); deckGroup.name='Gaming component streamdeck';
        deckGroup.position.set(-0.16, matTopY, -0.02);
        deckGroup.rotation.y = 0.22;

        const deckStand = new THREE.Mesh(
          new RoundedBoxGeometry(0.135, 0.058, 0.095, 4, 0.008),
          chassisMat
        );
        deckStand.position.y = 0.029;
        deckStand.rotation.x = -0.38;
        deckGroup.add(deckStand);

        const deckFace = new THREE.Mesh(
          new THREE.PlaneGeometry(0.122, 0.078),
          new THREE.MeshBasicMaterial({ map: textures.streamDeckTex, wireframe: cfg.wireframe })
        );
        deckFace.name='Gaming macro key display'; deckFace.material.userData.sceneDisplay='native';
        deckFace.position.set(0, 0.0568, -0.011);
        deckFace.rotation.x = -Math.PI * .5 - .38;
        deckGroup.add(deckFace);

        propGroup.add(deckGroup);

        // 3. 4-Channel RGB Motorized Fader Audio Mixer Interface (GoXLR Style)
        const mixerGroup = new THREE.Group(); mixerGroup.name='Gaming component mixer';
        mixerGroup.position.set(0.08, matTopY, -0.03);
        mixerGroup.rotation.y = -0.12;

        const mixerBase = new THREE.Mesh(
          new RoundedBoxGeometry(0.175, 0.042, 0.145, 4, 0.008),
          chassisMat
        );
        mixerBase.position.y = 0.021;
        mixerBase.rotation.x = 0.16;
        mixerGroup.add(mixerBase);

        // 4 Illuminated RGB Fader Tracks + Motorized Fader Caps + Rotary Encoders
        for (let f = 0; f < 4; f++) {
          const fx = -0.054 + f * 0.036;

          const ledSlot = new THREE.Mesh(
            new RoundedBoxGeometry(0.005, 0.004, 0.068, 1, 0.001),
            f % 2 === 0 ? rgbMat1 : rgbMat2
          );
          ledSlot.position.set(fx, 0.041, 0.018);
          ledSlot.rotation.x = 0.16;
          mixerGroup.add(ledSlot);

          // Fader positions respond to Articulation Slider!
          const faderZ = 0.035 - ((f % 2 === 0 ? cfg.articulation : 1 - cfg.articulation) * 0.042);
          const faderCap = new THREE.Mesh(
            new RoundedBoxGeometry(0.018, 0.012, 0.012, 2, 0.002),
            chromeMat
          );
          faderCap.position.set(fx, 0.046, faderZ);
          faderCap.rotation.x = 0.16;
          mixerGroup.add(faderCap);

          const knob = new THREE.Mesh(
            new THREE.CylinderGeometry(0.009, 0.009, 0.014, 18),
            trimMat
          );
          knob.position.set(fx, 0.048, -0.042);
          knob.rotation.x = 0.16;
          mixerGroup.add(knob);
        }

        propGroup.add(mixerGroup);

        // 4. Dual Studio Key-Light LED Ring & Mirrorless Facecam on Telescoping Stand
        const lightRig = new THREE.Group(); lightRig.name='Gaming component keylight';
        lightRig.position.set(spanW * 0.24, matTopY, -spanD * 0.26);
        lightRig.rotation.y = -0.28;

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.011, 0.34, 16),
          trimMat
        );
        pole.position.y = 0.17;
        lightRig.add(pole);
        const lightFoot=new THREE.Mesh(new THREE.CylinderGeometry(.052,.058,.012,24),chassisMat);lightFoot.position.y=.006;lightRig.add(lightFoot);

        const ringLight = new THREE.Mesh(
          new THREE.TorusGeometry(0.088, 0.012, 16, 40),
          rgbMat1
        );
        ringLight.position.set(0, 0.34, 0.01);
        lightRig.add(ringLight);

        // Mirrorless Stream Camera + Prime Lens Centered Inside Ring Light
        const camBody = new THREE.Mesh(
          new RoundedBoxGeometry(0.068, 0.048, 0.038, 3, 0.005),
          chassisMat
        );
        camBody.position.set(0, 0.33, 0.01);
        const camLens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.042, 24),
          trimMat
        );
        camLens.rotation.x = Math.PI * 0.5;
        camLens.position.set(0, 0.33, 0.045);
        lightRig.add(camBody, camLens);

        propGroup.add(lightRig);

        if (cfg.includePeripherals) {
          const periph = buildEsportsPeripherals(materials);
          periph.position.set(-0.04, matTopY, 0.08);
          propGroup.add(periph);
        }

        if (cfg.includeHeadset) {
          const headset = buildHeadsetAndStand(materials);
          headset.position.set(spanW * 0.34, matTopY, 0.06);
          headset.rotation.y = -0.35;
          propGroup.add(headset);
        }

        maxElevationH = 0.45;
        lightAnchor1.set(spanW * 0.24, 0.34, -0.10);
        lightAnchor2.set(0.08, 0.14, 0.02);
      }

      // =======================================================================
      // ARCHETYPE 3: NEXT-GEN CONSOLE TOWER, DUAL PRO CONTROLLERS & HANDHELD
      // =======================================================================
      else if (cfg.archetype === 'console') {
        // 1. Sculptural Vertical Next-Gen Console Tower with Curved Fins & Central RGB Core
        const consoleGroup = new THREE.Group(); consoleGroup.name='Gaming component console';
        consoleGroup.position.set(-spanW * 0.28, matTopY, -0.04);
        consoleGroup.rotation.y = 0.28;

        const cH = 0.31, cD = 0.195;
        const baseStand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, 0.078, 0.016, 32),
          darkPadMat
        );
        baseStand.position.y = 0.008;
        consoleGroup.add(baseStand);

        // Glossy Dark Inner Core Column + Dual Glowing V-Light Strips
        const innerCore = new THREE.Mesh(
          new RoundedBoxGeometry(0.048, cH - 0.01, cD - 0.015, 4, 0.010),
          darkPadMat
        );
        innerCore.position.y = 0.016 + cH * 0.5;
        consoleGroup.add(innerCore);

        [-0.023, 0.023].forEach((lx) => {
          const ledStrip = new THREE.Mesh(
            new RoundedBoxGeometry(0.004, cH - 0.03, 0.006, 1, 0.002),
            rgbMat1
          );
          ledStrip.position.set(lx, 0.016 + cH * 0.5, cD * 0.5 - 0.008);
          consoleGroup.add(ledStrip);
        });

        // Sculpted Left & Right Aerodynamic Outer Faceplates
        [-1, 1].forEach((side) => {
          const wing = new THREE.Mesh(
            new RoundedBoxGeometry(0.014, cH, cD, 4, 0.006),
            chassisMat
          );
          wing.position.set(side * 0.034, 0.016 + cH * 0.5, 0);
          wing.rotation.z = side * -0.03;
          consoleGroup.add(wing);
        });

        propGroup.add(consoleGroup);

        // 2. Dual Pro Wireless Controllers on Magnetic Charging Dock
        const dockGroup = new THREE.Group(); dockGroup.name='Gaming component controller-dock';
        dockGroup.position.set(0.02, matTopY, -0.02);

        const dockCradle = new THREE.Mesh(
          new RoundedBoxGeometry(0.16, 0.024, 0.22, 4, 0.008),
          trimMat
        );
        dockCradle.position.y = 0.012;
        dockGroup.add(dockCradle);

        const dockLed = new THREE.Mesh(
          new RoundedBoxGeometry(0.164, 0.005, 0.224, 2, 0.004),
          rgbMat2
        );
        dockLed.position.y = 0.003;
        dockGroup.add(dockLed);

        // Rear Docked Controller
        const pad1 = buildProController(materials, true);
        pad1.position.set(0, 0.024, -0.048);
        pad1.rotation.x = 0.32;
        dockGroup.add(pad1);

        // Front Hero Controller (Lifts off dock & rotates via Articulation Slider!)
        const pad2 = buildProController(materials, false);
        pad2.position.set(
          0.02 + cfg.articulation * 0.06,
          0.024 + cfg.articulation * 0.035,
          0.055 + cfg.articulation * 0.04
        );
        pad2.rotation.x = 0.32 - cfg.articulation * 0.22;
        pad2.rotation.y = -cfg.articulation * 0.35;
        dockGroup.add(pad2);

        propGroup.add(dockGroup);

        // 3. Handheld OLED Gaming Console in Desktop Display Dock (Steam Deck / Switch OLED Style)
        if (cfg.includePeripherals) {
          const handheldGroup = new THREE.Group(); handheldGroup.name='Gaming component handheld';
          handheldGroup.position.set(spanW * 0.25, matTopY, 0.05);
          handheldGroup.rotation.y = -0.25;

          const hhDock = new THREE.Mesh(
            new RoundedBoxGeometry(0.14, 0.028, 0.075, 3, 0.006),
            trimMat
          );
          hhDock.position.y = 0.014;
          handheldGroup.add(hhDock);

          const hhBody = new THREE.Mesh(
            new RoundedBoxGeometry(0.265, 0.105, 0.022, 5, 0.010),
            chassisMat
          );
          hhBody.position.set(0, 0.068, 0);
          hhBody.rotation.x = -0.22;
          handheldGroup.add(hhBody);

          const hhScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(0.165, 0.088),
            new THREE.MeshBasicMaterial({ map: textures.gameScreenTex, wireframe: cfg.wireframe })
          );
          hhScreen.name='Gaming handheld display'; hhScreen.material.userData.sceneDisplay='theme';
          hhScreen.position.set(0, 0.069, 0.012);
          hhScreen.rotation.x = -0.22;
          handheldGroup.add(hhScreen);

          // Left & Right Thumbsticks on Handheld
          [-0.105, 0.105].forEach((hx) => {
            const hStick = new THREE.Mesh(
              new THREE.CylinderGeometry(0.009, 0.009, 0.014, 16),
              rgbMat1
            );
            hStick.rotation.x = Math.PI * 0.5 - 0.22;
            hStick.position.set(hx, 0.078, 0.016);
            handheldGroup.add(hStick);
          });

          propGroup.add(handheldGroup);
        }

        if (cfg.includeHeadset) {
          const headset = buildHeadsetAndStand(materials);
          headset.position.set(spanW * 0.32, matTopY, -0.10);
          headset.rotation.y = -0.35;
          propGroup.add(headset);
        }

        maxElevationH = 0.36;
        lightAnchor1.set(-spanW * 0.26, 0.22, 0.0);
        lightAnchor2.set(0.04, 0.14, 0.05);
      }

      // =======================================================================
      // ARCHETYPE 4: SIM-RACING DIRECT-DRIVE WHEEL, SHIFTER & FLIGHT HOTAS
      // =======================================================================
      else {
        // 1. CNC Direct-Drive Force-Feedback Servo Base + F1/GT Carbon Steering Wheel
        const wheelGroup = new THREE.Group(); wheelGroup.name='Gaming component wheel';
        wheelGroup.position.set(-0.04, matTopY, 0.02);

        // Extruded Finned Direct-Drive Motor Block
        const servoMotor = new THREE.Mesh(
          new RoundedBoxGeometry(0.145, 0.135, 0.175, 4, 0.010),
          chassisMat
        );
        servoMotor.position.set(0, 0.17, -0.02);
        servoMotor.rotation.x = 0.18;
        wheelGroup.add(servoMotor);

        const wheelFoot=new THREE.Mesh(new RoundedBoxGeometry(.16,.02,.185,2,.004),chassisMat);wheelFoot.position.set(0,.01,-.02);wheelGroup.add(wheelFoot);
        const wheelRiser=new THREE.Mesh(new RoundedBoxGeometry(.085,.14,.1,2,.006),trimMat);wheelRiser.position.set(0,.08,-.03);wheelGroup.add(wheelRiser);
        // Quick-Release Shaft + Steering Wheel Assembly (Steers Left/Right via Articulation Slider!)
        const steerPivot = new THREE.Group();
        steerPivot.position.set(0, 0.19, 0.075);
        steerPivot.rotation.x = 0.18;
        steerPivot.rotation.z = (cfg.articulation - 0.35) * Math.PI * 0.85;

        const qrCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.055, 24),
          rgbMat2
        );
        qrCollar.rotation.x = Math.PI * 0.5;
        qrCollar.position.z = -0.015;
        steerPivot.add(qrCollar);

        // Sculpted GT / Formula Rim + Carbon Faceplate + Rev-Light RPM LED Strip
        const wheelRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.132, 0.016, 16, 40),
          darkPadMat
        );
        steerPivot.add(wheelRim);

        const centerPlate = new THREE.Mesh(
          new RoundedBoxGeometry(0.195, 0.095, 0.018, 3, 0.006),
          trimMat
        );
        steerPivot.add(centerPlate);

        // Top RPM Shift-Light LED Bar + Telemetry Dash Screen
        const rpmLedBar = new THREE.Mesh(
          new RoundedBoxGeometry(0.11, 0.008, 0.006, 1, 0.002),
          rgbMat1
        );
        rpmLedBar.position.set(0, 0.036, 0.010);
        steerPivot.add(rpmLedBar);

        // Magnetic Carbon Paddle Shifters Behind Rim
        [-0.085, 0.085].forEach((px) => {
          const paddle = new THREE.Mesh(
            new RoundedBoxGeometry(0.024, 0.075, 0.005, 2, 0.002),
            rgbMat2
          );
          paddle.position.set(px, 0, -0.016);
          steerPivot.add(paddle);
        });

        wheelGroup.add(steerPivot);
        propGroup.add(wheelGroup);

        // 2. Left-Hand Dual-Stage Aviation / Space-Sim HOTAS Throttle Quadrant
        const throttleGroup = new THREE.Group(); throttleGroup.name='Gaming component throttle';
        throttleGroup.position.set(-spanW * 0.32, matTopY, 0.02);

        const throtBase = new THREE.Mesh(
          new RoundedBoxGeometry(0.155, 0.038, 0.185, 4, 0.008),
          chassisMat
        );
        throtBase.position.y = 0.019;
        throttleGroup.add(throtBase);

        // Twin Split Throttle Levers (Advance forward with Articulation Slider!)
        const throtZ = 0.03 - cfg.articulation * 0.065;
        [-0.028, 0.028].forEach((tx) => {
          const stalk = new THREE.Mesh(
            new RoundedBoxGeometry(0.014, 0.068, 0.022, 2, 0.003),
            chromeMat
          );
          stalk.position.set(tx, 0.055, throtZ);
          stalk.rotation.x = -0.2 + cfg.articulation * 0.45;
          throttleGroup.add(stalk);

          const gripBar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, 0.048, 20),
            trimMat
          );
          gripBar.rotation.z = Math.PI * 0.5;
          gripBar.position.set(tx, 0.092, throtZ);
          throttleGroup.add(gripBar);
        });

        propGroup.add(throttleGroup);

        // 3. Right-Hand 6-Speed H-Pattern / Sequential Metal Gearbox Shifter
        if (cfg.includePeripherals) {
          const shifterGroup = new THREE.Group(); shifterGroup.name='Gaming component shifter';
          shifterGroup.position.set(spanW * 0.25, matTopY, 0.04);

          const shiftBox = new THREE.Mesh(
            new RoundedBoxGeometry(0.125, 0.078, 0.145, 4, 0.008),
            chassisMat
          );
          shiftBox.position.y = 0.039;
          shifterGroup.add(shiftBox);

          const gatePlate = new THREE.Mesh(
            new RoundedBoxGeometry(0.095, 0.006, 0.105, 2, 0.002),
            chromeMat
          );
          gatePlate.position.y = 0.080;
          shifterGroup.add(gatePlate);

          const shiftRod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.105, 16),
            chromeMat
          );
          shiftRod.position.set(0, 0.125, 0);
          shiftRod.rotation.x = (cfg.articulation - 0.5) * 0.35;
          shifterGroup.add(shiftRod);

          const shiftKnob = new THREE.Mesh(
            new THREE.SphereGeometry(0.024, 24, 24),
            rgbMat1
          );
          shiftKnob.position.set(0, 0.178, (cfg.articulation - 0.5) * 0.018);
          shifterGroup.add(shiftKnob);

          propGroup.add(shifterGroup);
        }

        if (cfg.includeHeadset) {
          const headset = buildHeadsetAndStand(materials);
          headset.position.set(spanW * 0.34, matTopY, -0.11);
          headset.rotation.y = -0.35;
          propGroup.add(headset);
        }

        maxElevationH = 0.34;
        lightAnchor1.set(-0.04, 0.20, 0.08);
        lightAnchor2.set(spanW * 0.25, 0.18, 0.04);
      }

      // Apply Global Scale Multiplier
      propGroup.scale.setScalar(cfg.scale);

      // =======================================================================
      // STUDIO STAGING CONTEXT (Carbon Desk Slab, Acoustic Wedges & Nanoleaf Hexes)
      // =======================================================================
      if (cfg.staging) {
        const deskSlabW = spanW * cfg.scale + 0.58;
        const deskSlabD = spanD * cfg.scale + 0.42;

        // Beveled Carbon-Treated Gaming Desk Slab
        const deskSlab = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW, 0.042, deskSlabD, 4, 0.012),
          new THREE.MeshPhysicalMaterial({
            color: 0x12151e,
            roughness: 0.42,
            clearcoat: 0.22,
            bumpMap: textures.carbonTex,
            bumpScale: 0.001
          })
        );
        deskSlab.position.set(0, -0.021, 0);
        stagingGroup.add(deskSlab);

        // Rear Desk Edge Ambient Bias LED Strip
        const rearBiasStrip = new THREE.Mesh(
          new THREE.BoxGeometry(deskSlabW - 0.12, 0.008, 0.012),
          rgbMat1
        );
        rearBiasStrip.position.set(0, -0.005, -deskSlabD * 0.5);
        stagingGroup.add(rearBiasStrip);

        // Sound-Absorbing Studio Wall Backdrop + Glowing Nanoleaf Hexagon Light Tiles
        const wallZ = -deskSlabD * 0.5 - 0.08;
        const backdropWall = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW + 0.75, 1.35, 0.04, 2, 0.008),
          new THREE.MeshStandardMaterial({ color: 0x0c0f17, roughness: 0.9 })
        );
        backdropWall.position.set(0, 0.52, wallZ);
        stagingGroup.add(backdropWall);

        // Constellation of 7 Illuminated Nanoleaf Hexagon Wall Panels
        const hexPositions = [
          [-0.36, 0.48],
          [-0.23, 0.55],
          [-0.23, 0.40],
          [-0.10, 0.48],
          [0.03, 0.55],
          [0.16, 0.48],
          [0.29, 0.55]
        ];
        hexPositions.forEach(([hx, hy], idx) => {
          const hexFrame = new THREE.Mesh(
            new THREE.CylinderGeometry(0.072, 0.072, 0.012, 6),
            chassisMat
          );
          hexFrame.rotation.x = Math.PI * 0.5;
          hexFrame.position.set(hx, hy, wallZ + 0.024);
          stagingGroup.add(hexFrame);

          const hexGlow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.064, 0.064, 0.014, 6),
            idx % 2 === 0 ? rgbMat1 : rgbMat2
          );
          hexGlow.rotation.x = Math.PI * 0.5;
          hexGlow.position.set(hx, hy, wallZ + 0.025);
          stagingGroup.add(hexGlow);
        });
      }

      // Enable Shadows across all Meshes
      const enableShadows = (grp) => {
        grp.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };
      enableShadows(propGroup);
      enableShadows(stagingGroup);

      return {
        propGroup,
        stagingGroup,
        lightAnchor1: lightAnchor1.multiplyScalar(cfg.scale),
        lightAnchor2: lightAnchor2.multiplyScalar(cfg.scale),
        dimensions: {
          width: spanW * cfg.scale,
          depth: spanD * cfg.scale,
          height: maxElevationH * cfg.scale
        }
      };
    }

// glTF uses normal maps; its bump extension is not supported by the viewer.
const normals=new Map();
function normalTexture(heightMap){
 if(normals.has(heightMap))return normals.get(heightMap);
 const source=heightMap.image,w=source.width,h=source.height,data=source.getContext('2d').getImageData(0,0,w,h).data;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h),sample=(x,y)=>data[(((y+h)%h)*w+(x+w)%w)*4]/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=new THREE.Vector3((sample(x-1,y)-sample(x+1,y))*1.5,(sample(x,y-1)-sample(x,y+1))*1.5,1).normalize(),i=(y*w+x)*4;
  image.data[i]=(n.x*.5+.5)*255;image.data[i+1]=(n.y*.5+.5)*255;image.data[i+2]=(n.z*.5+.5)*255;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.copy(heightMap.repeat);normals.set(heightMap,map);return map;
}


export function createGamingGear(config={}){
 const cfg={archetype:'battlestation',component:'complete',spread:.94,depth:.46,articulation:.15,chassisColor:'#161922',trimColor:'#334155',rgbColor1:'#00d6eb',rgbColor2:'#e84885',includeDeskMat:true,includePeripherals:true,includeHeadset:true,...config,rgbOn:true,scale:1,staging:false,wireframe:false};
 if(!['battlestation','streamer','console','simrig'].includes(cfg.archetype)||cfg.spread<.8||cfg.spread>1.2||cfg.depth<.35||cfg.depth>.6)throw Error('Unsupported gaming loadout dimensions');
 let {propGroup}=buildGamerScene(cfg);
 if(cfg.component!=='complete'){
  const child=propGroup.getObjectByName('Gaming component '+cfg.component);if(!child)throw Error('Missing gaming component '+cfg.component);
  child.removeFromParent();child.position.set(0,0,0);child.rotation.y=0;
  propGroup=new THREE.Group();propGroup.add(child);
 }
 const mats=new Set();propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))mats.add(m);}});
 for(const m of mats){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(.22);m.bumpMap=null;}m.userData.roomPaletteLocked=true;}
 propGroup.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(propGroup,true),c=b.getCenter(new THREE.Vector3());propGroup.position.set(-c.x,-b.min.y,-c.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier gaming '+cfg.archetype+' '+cfg.component;propGroup.userData={atelierGaming:true,archetype:cfg.archetype,component:cfg.component,family:cfg.family};return propGroup;
}
