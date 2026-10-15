// Owner-supplied Atelier architectural lighting generator. Metres, Y up.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x4c414d50;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function kelvinToColor(kelvin) {
      const temp = kelvin / 100;
      let r, g, b;

      if (temp <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
        b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
      } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
        b = 255;
      }

      return new THREE.Color(
        THREE.MathUtils.clamp(r, 0, 255) / 255,
        THREE.MathUtils.clamp(g, 0, 255) / 255,
        THREE.MathUtils.clamp(b, 0, 255) / 255
      );
    }

    function createProceduralTextures() {
      // 1. Italian Marble Veining Texture (works for both Nero Marquina & Carrara)
      const marbleCanvas = document.createElement('canvas');
      marbleCanvas.width = 512;
      marbleCanvas.height = 512;
      const mCtx = marbleCanvas.getContext('2d');
      mCtx.fillStyle = '#808080';
      mCtx.fillRect(0, 0, 512, 512);

      // Subtle stone clouding
      for (let i = 0; i < 900; i++) {
        const x = random() * 512;
        const y = random() * 512;
        const r = 10 + random() * 35;
        const alpha = 0.02 + random() * 0.04;
        mCtx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(30,30,30,${alpha})`;
        mCtx.beginPath();
        mCtx.arc(x, y, r, 0, Math.PI * 2);
        mCtx.fill();
      }

      // Crystalline mineral veins
      mCtx.strokeStyle = 'rgba(245, 245, 245, 0.55)';
      for (let v = 0; v < 14; v++) {
        mCtx.lineWidth = 0.6 + random() * 2.2;
        mCtx.beginPath();
        let vx = random() * 512;
        let vy = 0;
        mCtx.moveTo(vx, vy);
        while (vy < 512) {
          vy += 12 + random() * 18;
          vx += Math.sin(vy * 0.04 + v) * 14 + (random() - 0.5) * 16;
          mCtx.lineTo(vx, vy);
        }
        mCtx.stroke();
      }
      const marbleTex = new THREE.CanvasTexture(marbleCanvas);
      marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;

      // 2. Tailored Pleated Linen Shade Texture
      const linenCanvas = document.createElement('canvas');
      linenCanvas.width = 512;
      linenCanvas.height = 256;
      const lCtx = linenCanvas.getContext('2d');
      for (let x = 0; x < 512; x++) {
        const pleatWave = Math.sin((x / 512) * Math.PI * 64) * 34;
        const fineWeave = (random() - 0.5) * 12;
        const val = Math.max(40, Math.min(245, Math.floor(155 + pleatWave + fineWeave)));
        lCtx.fillStyle = `rgb(${val},${val},${val})`;
        lCtx.fillRect(x, 0, 1, 256);
      }
      const linenTex = new THREE.CanvasTexture(linenCanvas);
      linenTex.wrapS = linenTex.wrapT = THREE.RepeatWrapping;
      linenTex.repeat.set(2, 1);

      // 3. American Walnut Wood Grain Texture
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x += 2) {
          const grain = Math.sin(y * 0.16 + Math.sin(x * 0.025) * 4.0) * 20 + (random() - 0.5) * 8;
          const v = Math.max(55, Math.min(215, Math.floor(135 + grain)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;

      // 4. Radial Glow Aura Sprite Texture
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = 256;
      glowCanvas.height = 256;
      const gCtx = glowCanvas.getContext('2d');
      const grad = gCtx.createRadialGradient(128, 128, 6, 128, 128, 124);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.28, 'rgba(255, 235, 195, 0.42)');
      grad.addColorStop(0.65, 'rgba(255, 200, 130, 0.10)');
      grad.addColorStop(1, 'rgba(255, 180, 100, 0.0)');
      gCtx.fillStyle = grad;
      gCtx.fillRect(0, 0, 256, 256);
      const glowTex = new THREE.CanvasTexture(glowCanvas);

      return { marbleTex, linenTex, woodTex, glowTex };
    }

    const textures = createProceduralTextures();

    /**
     * Creates a detailed 3D Edison LED bulb + threaded E27 brass socket + glowing filament core
     */
    function createBulbAssembly(kelvinColor, isPowerOn, intensityScale, metalMat, wireframe) {
      const bulbGroup = new THREE.Group();
      bulbGroup.name = 'EdisonBulbAssembly';

      // Brass Socket Cup
      const socketMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.021, 0.023, 0.045, 20),
        metalMat
      );
      socketMesh.position.y = 0.022;
      bulbGroup.add(socketMesh);

      // Glass Bulb Envelope (G25 Globe)
      const bulbGlassMat = new THREE.MeshPhysicalMaterial({
        color: isPowerOn ? kelvinColor : new THREE.Color(0xdde2e8),
        emissive: isPowerOn ? kelvinColor : new THREE.Color(0x000000),
        emissiveIntensity: isPowerOn ? 1.8 * intensityScale : 0,
        roughness: 0.12,
        transmission: 0.72,
        transparent: true,
        opacity: 0.92,
        wireframe
      });
      const glassOrb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 20), bulbGlassMat);
      glassOrb.position.y = -0.022;
      bulbGroup.add(glassOrb);

      // Glowing Inner Filament Hairpin Loop
      if (isPowerOn) {
        const filamentMat = new THREE.MeshStandardMaterial({
          name:'Atelier luminous filament',emissive:kelvinColor,emissiveIntensity:1.3,
          color: 0xffffff,
          wireframe
        });
        const filament = new THREE.Mesh(
          new THREE.TorusGeometry(0.012, 0.0022, 8, 24),
          filamentMat
        );
        filament.position.y = -0.022;
        bulbGroup.add(filament);
      }

      return bulbGroup;
    }

    /**
     * Creates a realistic braided floor power cable with a brass-accented foot dimmer puck
     */
    function createBraidedFloorCord(startVec, metalMat, wireframe) {
      const cordGroup = new THREE.Group();
      const cordMat = new THREE.MeshStandardMaterial({
        color: 0x1a1c20,
        roughness: 0.85,
        wireframe
      });

      const curve = new THREE.CatmullRomCurve3([
        startVec.clone(),
        new THREE.Vector3(startVec.x - 0.14, 0.008, startVec.z - 0.12),
        new THREE.Vector3(startVec.x - 0.34, 0.008, startVec.z - 0.04),
        new THREE.Vector3(startVec.x - 0.52, 0.008, startVec.z - 0.24),
        new THREE.Vector3(startVec.x - 0.72, 0.008, startVec.z - 0.18)
      ]);

      const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0045, 8, false), cordMat);
      cordGroup.add(cordMesh);

      // Inline Floor Foot Switch Puck
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.018, 24), cordMat);
      puck.position.set(startVec.x - 0.34, 0.009, startVec.z - 0.04);

      const brassButton = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 18), metalMat);
      brassButton.position.set(0, 0.011, 0);
      puck.add(brassButton);

      cordGroup.add(puck);
      return cordGroup;
    }

    /**
     * Master Procedural High-End Lamp Builder
     * Returns { propGroup, stagingGroup, dimensions, lightAnchor, lightTarget }
     */
    function buildLampScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierLamp_${cfg.archetype}`;

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const kelvinColor = kelvinToColor(cfg.kelvin);
      const intensityScale = cfg.powerOn ? (cfg.intensityPct / 100) : 0;

      const totalH = cfg.height;
      const shadeDiam = cfg.shadeDiam;
      const shadeRad = shadeDiam * 0.5;
      const reach = cfg.reach;

      // 1. Pedestal Base Material (Marble / Wood / Metal)
      let baseMat;
      if (cfg.baseMat === 'marble') {
        baseMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(cfg.baseColor),
          roughness: 0.18,
          metalness: 0.04,
          clearcoat: 0.65,
          clearcoatRoughness: 0.15,
          bumpMap: textures.marbleTex,
          bumpScale: 0.0015,
          roughnessMap: textures.marbleTex,
          wireframe: cfg.wireframe
        });
      } else if (cfg.baseMat === 'wood') {
        baseMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(cfg.baseColor),
          roughness: 0.34,
          metalness: 0.04,
          clearcoat: 0.32,
          bumpMap: textures.woodTex,
          bumpScale: 0.002,
          wireframe: cfg.wireframe
        });
      } else {
        baseMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cfg.baseColor),
          roughness: 0.26,
          metalness: 0.88,
          wireframe: cfg.wireframe
        });
      }

      // 2. Architectural Metal Hardware Material
      const metalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.metalColor),
        roughness: 0.20,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      // 3. Shade / Diffuser Material with Subsurface Emissive Glow
      const shadeBaseCol = new THREE.Color(cfg.shadeColor);
      let shadeMat;
      if (cfg.shadeMat === 'opal') {
        shadeMat = new THREE.MeshPhysicalMaterial({
          color: shadeBaseCol,
          emissive: kelvinColor,
          emissiveIntensity: cfg.powerOn ? 0.58 * intensityScale : 0,
          roughness: 0.18,
          transmission: 0.62,
          thickness: 0.02,
          clearcoat: 0.4,
          side: THREE.DoubleSide,
          wireframe: cfg.wireframe
        });
      } else if (cfg.shadeMat === 'linen') {
        shadeMat = new THREE.MeshPhysicalMaterial({
          color: shadeBaseCol,
          emissive: kelvinColor,
          emissiveIntensity: cfg.powerOn ? 0.38 * intensityScale : 0,
          roughness: 0.84,
          sheen: 0.9,
          sheenColor: kelvinColor,
          bumpMap: textures.linenTex,
          bumpScale: 0.0032,
          side: THREE.DoubleSide,
          wireframe: cfg.wireframe
        });
      } else if (cfg.shadeMat === 'alabaster') {
        shadeMat = new THREE.MeshPhysicalMaterial({
          color: shadeBaseCol,
          emissive: kelvinColor,
          emissiveIntensity: cfg.powerOn ? 0.48 * intensityScale : 0,
          roughness: 0.28,
          transmission: 0.45,
          bumpMap: textures.marbleTex,
          bumpScale: 0.0022,
          side: THREE.DoubleSide,
          wireframe: cfg.wireframe
        });
      } else {
        // Spun Architectural Metal Outer Shade
        shadeMat = new THREE.MeshStandardMaterial({
          color: shadeBaseCol,
          roughness: 0.24,
          metalness: 0.82,
          side: THREE.DoubleSide,
          wireframe: cfg.wireframe
        });
      }

      // Warm Gold/White Inner Reflector Lining for Metal Shades
      const innerReflectorMat = new THREE.MeshStandardMaterial({
        color: 0xfff0d6,
        emissive: kelvinColor,
        emissiveIntensity: cfg.powerOn ? 0.72 * intensityScale : 0,
        roughness: 0.3,
        metalness: 0.4,
        side: THREE.BackSide,
        wireframe: cfg.wireframe
      });

      let lightAnchor = new THREE.Vector3(0, totalH * 0.78, 0);
      let lightTarget = new THREE.Vector3(0, 0, 0);
      let footprintW = shadeDiam;
      let footprintD = shadeDiam;

      // =========================================================================
      // ARCHETYPE 1: CANTILEVER PARABOLIC ARC FLOOR LAMP (Castiglioni Arco Style)
      // =========================================================================
      if (cfg.archetype === 'arc') {
        const baseX = -reach * 0.46;
        const blockW = 0.24;
        const blockH = Math.min(0.52, totalH * 0.28);
        const blockD = 0.31;

        // Beveled Monolith Marble Pedestal Block
        const monolith = new THREE.Mesh(
          new RoundedBoxGeometry(blockW, blockH, blockD, 5, 0.018),
          baseMat
        );
        monolith.position.set(baseX, blockH * 0.5, 0);
        propGroup.add(monolith);

        // Iconic Cylindrical Counterweight Lifting Hole Lined with Brass Ring
        const holeLiner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, blockW + 0.004, 24, 1, true),
          metalMat
        );
        holeLiner.rotation.z = Math.PI * 0.5;
        holeLiner.position.set(baseX, blockH * 0.58, 0);
        propGroup.add(holeLiner);

        // Anchor Collar where Steel Stem Emerges from Marble Block
        const stemCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.028, 0.08, 20),
          metalMat
        );
        stemCollar.position.set(baseX + blockW * 0.35, blockH + 0.03, 0);
        propGroup.add(stemCollar);

        // Sweeping Parabolic Arch Stem (2-Stage Telescoping Curve)
        const shadeX = baseX + reach;
        const shadeDropY = totalH * 0.74;

        const archCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(baseX + blockW * 0.35, blockH, 0),
          new THREE.Vector3(baseX + reach * 0.08, totalH * 0.66, 0),
          new THREE.Vector3(baseX + reach * 0.38, totalH * 0.96, 0),
          new THREE.Vector3(baseX + reach * 0.76, totalH * 0.98, 0),
          new THREE.Vector3(shadeX, shadeDropY + shadeRad * 0.92, 0)
        ]);

        const archTube = new THREE.Mesh(
          new THREE.TubeGeometry(archCurve, 48, 0.0115, 8, false),
          metalMat
        );
        propGroup.add(archTube);

        // Suspended Spun Dome Shade (Open Bottom Hemisphere + Perforated Vent Ring)
        const domePivot = new THREE.Group();
        domePivot.position.set(shadeX, shadeDropY, 0);

        const outerDomeGeom = new THREE.SphereGeometry(
          shadeRad,
          36,
          24,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.58
        );
        const outerDome = new THREE.Mesh(outerDomeGeom, shadeMat);
        domePivot.add(outerDome);

        // Inner Glowing Reflector Shell
        const innerDome = new THREE.Mesh(
          new THREE.SphereGeometry(shadeRad * 0.985, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.57),
          innerReflectorMat
        );
        domePivot.add(innerDome);

        // Top Heat-Dissipation Cap & Gimbal Ring
        const topCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.055, 0.04, 24),
          metalMat
        );
        topCap.position.y = shadeRad * 0.95;
        domePivot.add(topCap);

        // Internal Bulb Assembly
        if (cfg.showBulb) {
          const bulb = createBulbAssembly(kelvinColor, cfg.powerOn, intensityScale, metalMat, cfg.wireframe);
          bulb.position.y = shadeRad * 0.65;
          domePivot.add(bulb);
        }

        propGroup.add(domePivot);

        if (cfg.showCord) {
          propGroup.add(createBraidedFloorCord(new THREE.Vector3(baseX - blockW * 0.45, 0.01, 0), metalMat, cfg.wireframe));
        }

        lightAnchor.set(shadeX, shadeDropY - 0.02, 0);
        lightTarget.set(shadeX, 0, 0);
        footprintW = reach + shadeRad + blockW * 0.5;
        footprintD = Math.max(shadeDiam, blockD);
      }

      // =========================================================================
      // ARCHETYPE 2: SCULPTURAL ATOLLO MUSHROOM LAMP (Magistretti Geometric Style)
      // =========================================================================
      else if (cfg.archetype === 'mushroom') {
        const cylRadius = shadeRad * 0.46;
        const cylHeight = totalH * 0.42;
        const coneHeight = totalH * 0.26;
        const domeY = cylHeight + coneHeight - 0.02;

        // Lower Monolithic Cylinder Pedestal
        const baseCylinder = new THREE.Mesh(
          new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 40),
          baseMat
        );
        baseCylinder.position.y = cylHeight * 0.5;
        propGroup.add(baseCylinder);

        // Brass Plinth Foot Ring
        const footRing = new THREE.Mesh(
          new THREE.CylinderGeometry(cylRadius * 1.02, cylRadius * 1.02, 0.022, 40),
          metalMat
        );
        footRing.position.y = 0.011;
        propGroup.add(footRing);

        // Tapering Conical Neck (Catches downward warm reflection from the dome)
        const neckCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, cylRadius, coneHeight, 40),
          baseMat
        );
        neckCone.position.y = cylHeight + coneHeight * 0.5;
        propGroup.add(neckCone);

        // Thin Brass Standoff Stem Supporting the Floating Hemisphere
        const riserRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, shadeRad * 0.85, 20),
          metalMat
        );
        riserRod.position.y = domeY + shadeRad * 0.35;
        propGroup.add(riserRod);

        // Floating Hemisphere Mushroom Shade
        const mushGroup = new THREE.Group();
        mushGroup.position.y = domeY;

        const mushDomeGeom = new THREE.SphereGeometry(
          shadeRad,
          44,
          28,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.52
        );
        const mushDome = new THREE.Mesh(mushDomeGeom, shadeMat);
        mushGroup.add(mushDome);

        const mushLiner = new THREE.Mesh(
          new THREE.SphereGeometry(shadeRad * 0.985, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.51),
          innerReflectorMat
        );
        mushGroup.add(mushLiner);

        // Glowing Frosted Diffuser Baffle Plate Under the Dome
        const baffleMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: kelvinColor,
          emissiveIntensity: cfg.powerOn ? 0.95 * intensityScale : 0,
          roughness: 0.25,
          transmission: 0.6,
          wireframe: cfg.wireframe
        });
        const baffleRing = new THREE.Mesh(
          new THREE.RingGeometry(0.03, shadeRad * 0.96, 40),
          baffleMat
        );
        baffleRing.rotation.x = Math.PI * 0.5;
        baffleRing.position.y = 0.02;
        mushGroup.add(baffleRing);

        // Top Finial Cap
        const finial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.018, 20),
          metalMat
        );
        finial.position.y = shadeRad + 0.005;
        mushGroup.add(finial);

        if (cfg.showBulb) {
          const bulb = createBulbAssembly(kelvinColor, cfg.powerOn, intensityScale, metalMat, cfg.wireframe);
          bulb.position.y = shadeRad * 0.55;
          mushGroup.add(bulb);
        }

        propGroup.add(mushGroup);

        if (cfg.showCord) {
          propGroup.add(createBraidedFloorCord(new THREE.Vector3(-cylRadius, 0.01, 0), metalMat, cfg.wireframe));
        }

        lightAnchor.set(0, domeY - 0.02, 0);
        lightTarget.set(0, 0, 0);
        footprintW = shadeDiam * 1.1;
        footprintD = shadeDiam * 1.1;
      }

      // =========================================================================
      // ARCHETYPE 3: MID-CENTURY DANISH TRIPOD FLOOR LAMP
      // =========================================================================
      else if (cfg.archetype === 'tripod') {
        const shadeH = shadeDiam * 0.68;
        const shadeCenterY = totalH - shadeH * 0.52;
        const hubY = totalH * 0.54;
        const legSpread = reach * 0.42;

        // Central Brass Spider Hub
        const hubCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 0.075, 24),
          metalMat
        );
        hubCollar.position.y = hubY;
        propGroup.add(hubCollar);

        // 3 Raked Tapered Tripod Legs with Brass Sabot Ferrules
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + Math.PI * 0.16;
          const footPt = new THREE.Vector3(
            Math.cos(angle) * legSpread,
            0,
            Math.sin(angle) * legSpread
          );
          const topPt = new THREE.Vector3(
            Math.cos(angle) * 0.025,
            hubY + 0.08,
            Math.sin(angle) * 0.025
          );

          const legVec = new THREE.Vector3().subVectors(topPt, footPt);
          const legLen = legVec.length();
          const midPt = new THREE.Vector3().addVectors(footPt, topPt).multiplyScalar(0.5);

          const legGroup = new THREE.Group();
          legGroup.position.copy(midPt);
          legGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), legVec.clone().normalize());

          // Upper Timber/Marble Leg Shaft
          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.012, legLen, 20),
            baseMat
          );
          legGroup.add(shaft);

          // Lower Brass Sabot Foot Boot
          const ferrule = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0135, 0.0105, 0.14, 20),
            metalMat
          );
          ferrule.position.y = -legLen * 0.5 + 0.07;
          legGroup.add(ferrule);

          propGroup.add(legGroup);
        }

        // Upper Brass Riser Column, Harp & Twin Pull Chains
        const riserLen = shadeCenterY - hubY;
        const riser = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, riserLen, 20),
          metalMat
        );
        riser.position.y = hubY + riserLen * 0.5;
        propGroup.add(riser);

        // Twin Pull Chains with Acorn Pendants
        [-1, 1].forEach((side) => {
          const chainX = side * 0.042;
          const chainY = shadeCenterY - shadeH * 0.38;
          const chain = new THREE.Mesh(
            new THREE.CylinderGeometry(0.002, 0.002, 0.14, 8),
            metalMat
          );
          chain.position.set(chainX, chainY, 0.02);
          const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 12), metalMat);
          acorn.position.set(chainX, chainY - 0.07, 0.02);
          propGroup.add(chain, acorn);
        });

        // Tailored Tapered Drum Shade + Top & Bottom Rolled Brass Rim Rings
        const drumGroup = new THREE.Group();
        drumGroup.position.y = shadeCenterY;

        const topR = shadeRad * 0.84;
        const botR = shadeRad;
        const drumWall = new THREE.Mesh(
          new THREE.CylinderGeometry(topR, botR, shadeH, 48, 1, true),
          shadeMat
        );
        drumGroup.add(drumWall);

        const drumInner = new THREE.Mesh(
          new THREE.CylinderGeometry(topR * 0.99, botR * 0.99, shadeH, 40, 1, true),
          innerReflectorMat
        );
        drumGroup.add(drumInner);

        // Top & Bottom Brass Rim Rings + 3 Spider Spokes
        const topRim = new THREE.Mesh(new THREE.TorusGeometry(topR, 0.004, 10, 48), metalMat);
        topRim.rotation.x = Math.PI * 0.5;
        topRim.position.y = shadeH * 0.5;
        const botRim = new THREE.Mesh(new THREE.TorusGeometry(botR, 0.004, 10, 48), metalMat);
        botRim.rotation.x = Math.PI * 0.5;
        botRim.position.y = -shadeH * 0.5;
        drumGroup.add(topRim, botRim);

        for (let s = 0; s < 3; s++) {
          const sa = (s / 3) * Math.PI * 2;
          const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, topR, 8), metalMat);
          spoke.rotation.z = Math.PI * 0.5;
          spoke.rotation.y = sa;
          spoke.position.set(Math.cos(sa) * topR * 0.5, shadeH * 0.46, -Math.sin(sa) * topR * 0.5);
          drumGroup.add(spoke);
        }

        if (cfg.showBulb) {
          const bulb = createBulbAssembly(kelvinColor, cfg.powerOn, intensityScale, metalMat, cfg.wireframe);
          bulb.rotation.x = Math.PI; // Upright socket orientation
          bulb.position.y = -0.02;
          drumGroup.add(bulb);
        }

        propGroup.add(drumGroup);

        if (cfg.showCord) {
          propGroup.add(createBraidedFloorCord(new THREE.Vector3(0, 0.01, 0), metalMat, cfg.wireframe));
        }

        lightAnchor.set(0, shadeCenterY - shadeH * 0.25, 0);
        lightTarget.set(0, 0, 0);
        footprintW = Math.max(shadeDiam, legSpread * 2);
        footprintD = Math.max(shadeDiam, legSpread * 2);
      }

      // =========================================================================
      // ARCHETYPE 4: ARCHITECTURAL ORB & SUSPENDED HALO SCULPTURE (Flos IC / Halo)
      // =========================================================================
      else {
        const pedestalR = 0.16;
        const pedestalH = 0.26;

        // Fluted Monolith Pedestal Base
        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(pedestalR * 0.92, pedestalR, pedestalH, 36),
          baseMat
        );
        pedestal.position.y = pedestalH * 0.5;
        propGroup.add(pedestal);

        const brassCap = new THREE.Mesh(
          new THREE.CylinderGeometry(pedestalR * 0.94, pedestalR * 0.94, 0.016, 36),
          metalMat
        );
        brassCap.position.y = pedestalH + 0.008;
        propGroup.add(brassCap);

        // Vertical Spine Column + Counterbalanced Diagonal Arm
        const spineH = totalH * 0.88;
        const spine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, spineH, 20),
          metalMat
        );
        spine.position.set(-0.05, pedestalH + spineH * 0.5, 0);
        propGroup.add(spine);

        // Angled Counterbalance Boom Arm
        const boomLen = reach * 0.95;
        const boom = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, boomLen, 20),
          metalMat
        );
        boom.position.set(0.06, totalH * 0.72, 0);
        boom.rotation.z = -0.58;
        propGroup.add(boom);

        // Suspended Sculptural LED Halo Ring
        const haloRadius = shadeRad * 0.95;
        const haloY = totalH * 0.72;
        const haloOuter = new THREE.Mesh(
          new THREE.TorusGeometry(haloRadius, 0.013, 16, 64),
          metalMat
        );
        haloOuter.position.set(0.14, haloY, 0.02);
        haloOuter.rotation.y = 0.24;
        propGroup.add(haloOuter);

        // Inner Emissive LED Strip Inside the Halo Ring
        const ledRingMat = new THREE.MeshStandardMaterial({
          name:'Atelier luminous halo',emissive:kelvinColor,emissiveIntensity:1.2,
          color: cfg.powerOn ? kelvinColor : 0x555555,
          wireframe: cfg.wireframe
        });
        const haloInnerGlow = new THREE.Mesh(
          new THREE.TorusGeometry(haloRadius - 0.008, 0.007, 12, 64),
          ledRingMat
        );
        haloInnerGlow.position.copy(haloOuter.position);
        haloInnerGlow.rotation.copy(haloOuter.rotation);
        propGroup.add(haloInnerGlow);

        // Perched Blown-Opal Diffuser Sphere Balanced on the Boom Arm
        const orbMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: kelvinColor,
          emissiveIntensity: cfg.powerOn ? 1.15 * intensityScale : 0,
          roughness: 0.14,
          transmission: 0.75,
          clearcoat: 0.5,
          wireframe: cfg.wireframe
        });
        const orbRadius = shadeRad * 0.42;
        const orbPos = new THREE.Vector3(0.12, haloY - 0.02, 0.02);
        const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(orbRadius, 36, 32), orbMat);
        orbMesh.position.copy(orbPos);
        propGroup.add(orbMesh);

        if (cfg.showCord) {
          propGroup.add(createBraidedFloorCord(new THREE.Vector3(-pedestalR, 0.01, 0), metalMat, cfg.wireframe));
        }

        lightAnchor.copy(orbPos);
        lightTarget.set(0.12, 0, 0);
        footprintW = Math.max(haloRadius * 2.2, boomLen * 0.85);
        footprintD = haloRadius * 2.0;
      }

      // =========================================================================
      // VOLUMETRIC LIGHT CONE & ATMOSPHERIC GLOW AURA (Excluded from GLB if off)
      // =========================================================================
      if (cfg.powerOn && cfg.showBeam) {
        // Soft Atmospheric Glow Sprite at Bulb/Orb Center
        const spriteMat = new THREE.SpriteMaterial({
          map: textures.glowTex,
          color: kelvinColor,
          transparent: true,
          opacity: Math.min(0.85, 0.45 * intensityScale),
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glowSprite = new THREE.Sprite(spriteMat);
        glowSprite.position.copy(lightAnchor);
        glowSprite.scale.set(shadeDiam * 2.2, shadeDiam * 2.2, 1);
        stagingGroup.add(glowSprite);

        // Subtle Volumetric Tyndall Light Cone
        const beamH = Math.max(0.4, lightAnchor.y);
        const beamConeGeom = new THREE.ConeGeometry(shadeRad * 2.1, beamH, 36, 1, true);
        const beamConeMat = new THREE.MeshBasicMaterial({
          color: kelvinColor,
          transparent: true,
          opacity: Math.min(0.11, 0.055 * intensityScale),
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const beamCone = new THREE.Mesh(beamConeGeom, beamConeMat);
        beamCone.position.set(lightAnchor.x, beamH * 0.5, lightAnchor.z);
        stagingGroup.add(beamCone);
      }

      // =========================================================================
      // STUDIO STAGING CONTEXT (Architectural Wall Backdrop, Rug & Side Table)
      // =========================================================================
      if (cfg.staging) {
        // 1. Textured Plaster Gallery Backdrop Wall (catches warm light wash & shadows)
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0x181b22,
          roughness: 0.88,
          bumpMap: textures.marbleTex,
          bumpScale: 0.001
        });
        const wallMesh = new THREE.Mesh(new RoundedBoxGeometry(3.8, 2.8, 0.08, 2, 0.01), wallMat);
        wallMesh.position.set(0.1, 1.4, -0.82);
        stagingGroup.add(wallMesh);

        // Minimalist Brass-Framed Abstract Canvas on the Wall
        const artFrame = new THREE.Mesh(
          new RoundedBoxGeometry(0.78, 1.02, 0.025, 2, 0.004),
          metalMat
        );
        artFrame.position.set(0.32, 1.38, -0.77);
        const artCanvas = new THREE.Mesh(
          new THREE.PlaneGeometry(0.72, 0.96),
          new THREE.MeshStandardMaterial({
            color: 0x262930,
            roughness: 0.75,
            bumpMap: textures.linenTex,
            bumpScale: 0.003
          })
        );
        artCanvas.position.z = 0.014;
        artFrame.add(artCanvas);
        stagingGroup.add(artFrame);

        // 2. Circular Woven Studio Rug
        const rugMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1.45, 1.45, 0.01, 64),
          new THREE.MeshStandardMaterial({
            color: 0x20232a,
            roughness: 0.92,
            bumpMap: textures.linenTex,
            bumpScale: 0.003
          })
        );
        rugMesh.position.set(0.12, 0.005, 0.05);
        stagingGroup.add(rugMesh);

        // 3. Low Travertine & Walnut Lounge Side Table Illuminated Under the Lamp
        const tableX = cfg.archetype === 'arc' ? lightAnchor.x : 0.62;
        const tableZ = cfg.archetype === 'arc' ? 0.05 : -0.18;
        const tableGroup = new THREE.Group();
        tableGroup.position.set(tableX, 0, tableZ);

        const travMat = new THREE.MeshPhysicalMaterial({
          color: 0xdcd3c4,
          roughness: 0.35,
          clearcoat: 0.15,
          bumpMap: textures.marbleTex,
          bumpScale: 0.001
        });
        const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.028, 36), travMat);
        tableTop.position.y = 0.42;
        const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.40, 32), travMat);
        tableBase.position.y = 0.20;

        // Open Hardcover Design Monograph Book on the Table
        const book = new THREE.Mesh(
          new RoundedBoxGeometry(0.21, 0.024, 0.26, 2, 0.004),
          new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6 })
        );
        book.position.set(0, 0.446, 0);
        book.rotation.y = 0.35;

        tableGroup.add(tableTop, tableBase, book);
        stagingGroup.add(tableGroup);
      }

      // Enable Shadows across Prop & Staging
      const applyShadows = (grp) => {
        grp.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };
      applyShadows(propGroup);
      applyShadows(stagingGroup);

      return {
        propGroup,
        stagingGroup,
        lightAnchor,
        lightTarget,
        dimensions: {
          width: footprintW,
          depth: footprintD,
          height: totalH
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

export function createAtelierLamp(config={}){
 const cfg={archetype:'arc',kelvin:2700,intensityPct:100,height:1.88,shadeDiam:.36,reach:.86,shadeMat:'metal',baseMat:'marble',shadeColor:'#f5f2eb',baseColor:'#1e2024',metalColor:'#b69a5e',showBulb:true,showCord:false,...config,staging:false,showBeam:false,wireframe:false,powerOn:true};
 if(!['arc','mushroom','tripod','halo'].includes(cfg.archetype)||cfg.height<.3||cfg.height>2.3||cfg.kelvin<2000||cfg.kelvin>5600)throw Error('Unsupported Atelier lamp configuration');
 const {propGroup,lightAnchor}=buildLampScene(cfg),materials=new Set();
 propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(.3);m.bumpMap=null;}m.userData.roomPaletteLocked=true;if(m.emissiveIntensity>0&&m.emissive?.getHex()>0){m.name=m.name||'Atelier luminous diffuser';m.userData.atelierGlow=m.emissiveIntensity;}else m.name=m.name|| (m.metalness>.8?'Atelier metal hardware':'Atelier natural shade & base');}
 propGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(propGroup),center=bounds.getCenter(new THREE.Vector3());propGroup.position.set(-center.x,-bounds.min.y,-center.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier '+cfg.archetype+' lamp';
 propGroup.userData={atelierLamp:true,archetype:cfg.archetype,kelvin:cfg.kelvin,lightAnchor:lightAnchor.clone().add(propGroup.position).toArray()};
 return propGroup;
}
