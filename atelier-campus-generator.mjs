// Owner-supplied Atelier campus furniture generator. Metres, Y up, front +Z.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x43414d50;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Hardwood Timber Grain (Oak / Walnut / Maple)
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x += 2) {
          const cathedral = Math.sin(y * 0.14 + Math.sin(x * 0.024) * 3.8) * 18;
          const fine = (random() - 0.5) * 8;
          const v = Math.max(60, Math.min(220, Math.floor(142 + cathedral + fine)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(2, 1);

      // 2. Ribbed Acoustic PET Felt Bump Map
      const ribFeltCanvas = document.createElement('canvas');
      ribFeltCanvas.width = 256;
      ribFeltCanvas.height = 256;
      const rfCtx = ribFeltCanvas.getContext('2d');
      for (let x = 0; x < 256; x++) {
        const rib = Math.sin((x / 256) * Math.PI * 48) * 42;
        for (let y = 0; y < 256; y += 2) {
          const wool = (random() - 0.5) * 24;
          const v = Math.max(25, Math.min(235, Math.floor(128 + rib + wool)));
          rfCtx.fillStyle = `rgb(${v},${v},${v})`;
          rfCtx.fillRect(x, y, 1, 2);
        }
      }
      const ribFeltTex = new THREE.CanvasTexture(ribFeltCanvas);
      ribFeltTex.wrapS = ribFeltTex.wrapT = THREE.RepeatWrapping;
      ribFeltTex.repeat.set(4, 4);

      // 3. Soft Bouclé / Upholstery Fabric Texture
      const fabricCanvas = document.createElement('canvas');
      fabricCanvas.width = 256;
      fabricCanvas.height = 256;
      const fCtx = fabricCanvas.getContext('2d');
      fCtx.fillStyle = '#808080';
      fCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5500; i++) {
        const x = random() * 256;
        const y = random() * 256;
        const v = 90 + Math.floor(random() * 85);
        fCtx.fillStyle = `rgb(${v},${v},${v})`;
        fCtx.fillRect(x, y, 2, 2);
      }
      const fabricTex = new THREE.CanvasTexture(fabricCanvas);
      fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
      fabricTex.repeat.set(10, 10);

      // 4. Agile Co-Working Sprint Architecture Diagram & Dot-Grid Whiteboard Texture
      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 1024;
      boardCanvas.height = 512;
      const bCtx = boardCanvas.getContext('2d');
      bCtx.fillStyle = '#f8fafc';
      bCtx.fillRect(0, 0, 1024, 512);

      // Subtle architectural dot grid
      bCtx.fillStyle = '#cbd5e1';
      for (let x = 32; x < 1000; x += 28) {
        for (let y = 32; y < 480; y += 28) {
          bCtx.fillRect(x, y, 2, 2);
        }
      }

      // Hand-drawn style Sprint Roadmap & System Flow Diagram on Whiteboard
      bCtx.strokeStyle = '#1e293b';
      bCtx.lineWidth = 4;
      bCtx.strokeRect(70, 65, 220, 130);
      bCtx.strokeRect(380, 65, 240, 130);
      bCtx.strokeRect(710, 65, 230, 130);

      // Flow arrows
      bCtx.strokeStyle = '#d97706';
      bCtx.beginPath();
      bCtx.moveTo(290, 130);
      bCtx.lineTo(380, 130);
      bCtx.moveTo(620, 130);
      bCtx.lineTo(710, 130);
      bCtx.stroke();

      // Sprint Velocity Curve at bottom
      bCtx.strokeStyle = '#0f766e';
      bCtx.lineWidth = 5;
      bCtx.beginPath();
      bCtx.moveTo(85, 410);
      bCtx.bezierCurveTo(280, 390, 380, 270, 580, 310);
      bCtx.bezierCurveTo(720, 335, 810, 230, 920, 245);
      bCtx.stroke();

      const whiteboardTex = new THREE.CanvasTexture(boardCanvas);whiteboardTex.colorSpace=THREE.SRGBColorSpace;

      // 5. Video-Call / Co-Working Room Booking UI Display Texture
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 512;
      screenCanvas.height = 256;
      const sCtx = screenCanvas.getContext('2d');
      const grad = sCtx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 512, 256);

      // Simulated Video Call Participants & Shared Analytics Card
      sCtx.fillStyle = '#334155';
      sCtx.fillRect(24, 24, 215, 208);
      sCtx.fillRect(255, 24, 232, 98);
      sCtx.fillRect(255, 134, 232, 98);
      sCtx.strokeStyle = '#38bdf8';
      sCtx.lineWidth = 2;
      sCtx.strokeRect(24, 24, 215, 208);

      sCtx.fillStyle = '#fbbf24';
      sCtx.beginPath();
      sCtx.arc(131, 108, 32, 0, Math.PI * 2);
      sCtx.fill();

      const screenTex = new THREE.CanvasTexture(screenCanvas);screenTex.colorSpace=THREE.SRGBColorSpace;

      return { woodTex, ribFeltTex, fabricTex, whiteboardTex, screenTex };
    }

    const textures = createProceduralTextures();

    /**
     * Builds a sculpted, tufted cushion or banquette pad with cosine crown
     */
    function buildPuffedCushion(w, h, d, radius, mat, puff = 0.016) {
      const geom = new RoundedBoxGeometry(w, h, d, 4, radius);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const nx = v.x / (w * 0.5);
        const nz = v.z / (d * 0.5);
        if (v.y > 0) {
          v.y += Math.cos(nx * Math.PI * 0.45) * Math.cos(nz * Math.PI * 0.45) * puff;
        }
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geom.computeVertexNormals();
      return new THREE.Mesh(geom, mat);
    }

    /**
     * Builds a two-tier cylindrical co-working Pouf Stool with leather carry loop & timber plinth
     */
    function buildCoWorkingPoufStool(materials) {
      const pouf = new THREE.Group();
      const radius = 0.21;
      const height = 0.44;

      // Turned Wood Base Plinth
      const woodPlinth = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.94, radius * 0.90, 0.055, 28),
        materials.woodMat
      );
      woodPlinth.position.y = 0.0275;
      pouf.add(woodPlinth);

      // Lower Acoustic Felt Drum
      const lowerDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.96, height * 0.62, 32),
        materials.feltMat
      );
      lowerDrum.position.y = 0.055 + (height * 0.62) * 0.5;
      pouf.add(lowerDrum);

      // Brass Accent Belt Seam
      const belt = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.99, 0.0045, 10, 36),
        materials.brassMat
      );
      belt.rotation.x = Math.PI * 0.5;
      belt.position.y = 0.055 + height * 0.62;
      pouf.add(belt);

      // Upper Plush Upholstered Seat Crown
      const topCushion = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.95, radius, height * 0.26, 32),
        materials.seatMat
      );
      topCushion.position.y = 0.055 + height * 0.62 + (height * 0.26) * 0.5;
      pouf.add(topCushion);

      // Side Saddle-Leather Carry Strap Loop + Brass Rivet
      const strap = new THREE.Mesh(
        new RoundedBoxGeometry(0.012, 0.085, 0.032, 2, 0.004),
        materials.seatMat
      );
      strap.position.set(radius + 0.004, height * 0.55, 0);
      pouf.add(strap);

      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 12), materials.brassMat);
      rivet.position.set(radius + 0.011, height * 0.61, 0);
      pouf.add(rivet);

      return pouf;
    }

    /**
     * Builds a biophilic architectural planter box with sculptural foliage clusters
     */
    function buildBiophilicPlanterCrown(spanW, spanD, materials, wireframe) {
      const group = new THREE.Group();

      // Matte Steel Planter Trough
      const troughH = 0.14;
      const trough = new THREE.Mesh(
        new RoundedBoxGeometry(spanW, troughH, spanD, 4, 0.012),
        materials.frameMat
      );
      trough.position.y = troughH * 0.5;
      group.add(trough);

      // Dark Soil Bed
      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(spanW - 0.04, 0.02, spanD - 0.04),
        materials.darkMat
      );
      soil.position.y = troughH - 0.015;
      group.add(soil);

      // Sculptural Botanical Foliage Stems & Monstera-inspired Leaves
      const leafMat = new THREE.MeshPhysicalMaterial({
        color: 0x2d5a40,
        roughness: 0.48,
        clearcoat: 0.25,
        wireframe
      });
      const leafAccentMat = new THREE.MeshPhysicalMaterial({
        color: 0x457858,
        roughness: 0.52,
        wireframe
      });

      const clusterCount = Math.max(4, Math.floor(spanW * 5));
      for (let i = 0; i < clusterCount; i++) {
        const cx = -spanW * 0.42 + (i / (clusterCount - 1)) * (spanW * 0.84);
        const cz = ((i % 2) - 0.5) * (spanD * 0.35);

        for (let j = 0; j < 3; j++) {
          const leaf = new THREE.Mesh(
            new RoundedBoxGeometry(0.095, 0.16, 0.012, 3, 0.005),
            (i + j) % 2 === 0 ? leafMat : leafAccentMat
          );
          leaf.position.set(
            cx + (j - 1) * 0.04,
            troughH + 0.05 + (j % 2) * 0.03,
            cz
          );
          leaf.rotation.z = (j - 1) * -0.38;
          leaf.rotation.x = (j % 2 === 0 ? 1 : -1) * 0.28;
          leaf.rotation.y = i * 0.6 + j;
          group.add(leaf);
        }
      }

      return group;
    }

    function buildCoWorkingScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierCoWorking_${cfg.archetype}`;

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const w = cfg.width;
      const d = cfg.depth;
      const h = cfg.height;

      // --- Configure Shared PBR Materials ---
      const woodMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.woodColor),
        roughness: 0.32,
        metalness: 0.04,
        clearcoat: 0.32,
        clearcoatRoughness: 0.25,
        bumpMap: textures.woodTex,
        bumpScale: 0.0020,
        wireframe: cfg.wireframe
      });

      const frameMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.frameColor),
        roughness: 0.30,
        metalness: 0.82,
        wireframe: cfg.wireframe
      });

      const seatCol = new THREE.Color(cfg.seatColor);
      const seatMat = new THREE.MeshPhysicalMaterial({
        color: seatCol,
        roughness: 0.65,
        sheen: 0.92,
        sheenColor: seatCol.clone().lerp(new THREE.Color(0xffffff), 0.3),
        bumpMap: textures.fabricTex,
        bumpScale: 0.0024,
        wireframe: cfg.wireframe
      });

      const feltCol = new THREE.Color(cfg.feltColor);
      const feltMat = new THREE.MeshPhysicalMaterial({
        color: feltCol,
        roughness: 0.86,
        sheen: 0.85,
        bumpMap: textures.ribFeltTex,
        bumpScale: 0.0042,
        wireframe: cfg.wireframe
      });

      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.22,
        metalness: 0.92,
        wireframe: cfg.wireframe
      });

      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xdde2eb,
        roughness: 0.18,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xdbeafe,
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.84,
        transparent: true,
        opacity: 0.42,
        ior: 1.5,
        wireframe: cfg.wireframe
      });

      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x15181f,
        roughness: 0.42,
        metalness: 0.25,
        wireframe: cfg.wireframe
      });

      const materials = {
        woodMat,
        frameMat,
        seatMat,
        feltMat,
        brassMat,
        chromeMat,
        glassMat,
        darkMat
      };

      for(const [name,mat] of Object.entries(materials))mat.name='Campus '+name;
      let totalFootprintW = w;
      let totalFootprintD = d;
      let totalFootprintH = h;
      let lightPos = new THREE.Vector3(0, h - 0.15, 0);
      let lightTarget = new THREE.Vector3(0, 0.5, 0);

      // =======================================================================
      // ARCHETYPE 1: ACOUSTIC CO-WORKING PHONE POD & FOCUS BOOTH
      // =======================================================================
      if(cfg.archetype==='pouf'){propGroup.add(buildCoWorkingPoufStool(materials));}
      else if (cfg.archetype === 'pod') {
        const wallThick = 0.075;
        const floorH = 0.075;
        const innerW = w - wallThick * 2;
        const innerD = d - wallThick * 2;
        const innerH = h - floorH * 2;

        // 1. Acoustic Carpeted Floor Plinth with Leveling Feet
        const podFloor = new THREE.Mesh(
          new RoundedBoxGeometry(w, floorH, d, 5, 0.018),
          frameMat
        );
        podFloor.position.set(0, floorH * 0.5, 0);
        propGroup.add(podFloor);

        // Timber Interior Floor Threshold
        const innerFloor = new THREE.Mesh(
          new RoundedBoxGeometry(innerW, 0.016, innerD, 3, 0.005),
          woodMat
        );
        innerFloor.position.set(0, floorH + 0.008, 0);
        propGroup.add(innerFloor);

        // 2. Roof Crown with Ventilation Louvers & Occupancy Status LED Bar
        const podRoof = new THREE.Mesh(
          new RoundedBoxGeometry(w, floorH, d, 5, 0.018),
          frameMat
        );
        podRoof.position.set(0, h - floorH * 0.5, 0);
        propGroup.add(podRoof);

        // Interior Warm LED Ceiling Light Panel
        const ceilingLed = new THREE.Mesh(
          new RoundedBoxGeometry(innerW * 0.56, 0.014, innerD * 0.45, 2, 0.004),
          new THREE.MeshStandardMaterial({
            name:'Campus interior LED',emissive:0xffe4b5,emissiveIntensity:cfg.fixtureLight?1:0,
            color: cfg.fixtureLight ? 0xffe4b5 : 0x333333,
            wireframe: cfg.wireframe
          })
        );
        ceilingLed.position.set(0, h - floorH - 0.004, 0);
        propGroup.add(ceilingLed);

        // Exterior Top Occupancy Indicator Pill (Emerald Green = Available / Amber = In Use)
        const statusPill = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.018, 0.018, 2, 0.006),
          new THREE.MeshBasicMaterial({
            color: cfg.fixtureLight ? 0x34d399 : 0xfbbf24,
            wireframe: cfg.wireframe
          })
        );
        statusPill.position.set(0, h - floorH * 0.5, d * 0.5 + 0.005);
        propGroup.add(statusPill);

        // 3. Left & Right Exterior Ribbed Acoustic Felt Walls + Interior Timber Lining
        [-1, 1].forEach((side) => {
          const wx = side * (w * 0.5 - wallThick * 0.5);

          // Outer Ribbed Acoustic Shell
          const sideWallOuter = new THREE.Mesh(
            new RoundedBoxGeometry(wallThick * 0.62, innerH, d, 4, 0.012),
            feltMat
          );
          sideWallOuter.position.set(wx + side * (wallThick * 0.18), h * 0.5, 0);
          propGroup.add(sideWallOuter);

          // Inner Warm Timber Acoustic Liner
          const sideWallInner = new THREE.Mesh(
            new RoundedBoxGeometry(wallThick * 0.42, innerH, innerD, 3, 0.008),
            woodMat
          );
          sideWallInner.position.set(wx - side * (wallThick * 0.22), h * 0.5, 0);
          propGroup.add(sideWallInner);
        });

        // 4. Rear Acoustic Wall (Half Ribbed Felt + Half Soundproof Glass Window)
        const rearZ = -d * 0.5 + wallThick * 0.5;
        const rearSolid = new THREE.Mesh(
          new RoundedBoxGeometry(innerW, innerH, wallThick, 3, 0.01),
          feltMat
        );
        rearSolid.position.set(0, h * 0.5, rearZ);
        propGroup.add(rearSolid);

        // 5. Interior Built-In Upholstered Banquette Bench Seat (Left Side)
        if (cfg.includeSeating) {
          const benchW = Math.min(0.46, innerW * 0.42);
          const benchH = 0.45;
          const benchD = innerD - 0.08;
          const benchX = -innerW * 0.5 + benchW * 0.5 + 0.01;

          // Timber Banquette Plinth Base
          const benchBase = new THREE.Mesh(
            new RoundedBoxGeometry(benchW, benchH - 0.08, benchD, 3, 0.008),
            woodMat
          );
          benchBase.position.set(benchX, floorH + (benchH - 0.08) * 0.5, 0);
          propGroup.add(benchBase);

          // Plush Seat Cushion
          const seatPad = buildPuffedCushion(benchW + 0.01, 0.085, benchD, 0.025, seatMat, 0.018);
          seatPad.position.set(benchX, floorH + benchH - 0.04, 0);
          propGroup.add(seatPad);

          // Upholstered Lumbar Wall Backrest Bolster
          const backPad = buildPuffedCushion(0.08, 0.36, benchD - 0.04, 0.025, seatMat, 0.015);
          backPad.position.set(-innerW * 0.5 + 0.045, floorH + benchH + 0.22, 0);
          propGroup.add(backPad);
        }

        // 6. Right-Wall Cantilevered Video-Call Ledge + 4K Screen + Power Module
        const shelfW = Math.min(0.34, innerW * 0.32);
        const shelfD = innerD * 0.72;
        const shelfX = innerW * 0.5 - shelfW * 0.5 - 0.01;
        const shelfY = floorH + 0.72;

        const ledge = new THREE.Mesh(
          new RoundedBoxGeometry(shelfW, 0.032, shelfD, 3, 0.008),
          woodMat
        );
        ledge.position.set(shelfX, shelfY, 0);
        propGroup.add(ledge);

        if (cfg.includeTech) {
          // Wall-Mounted 4K Co-Working Video Call Screen + Camera Bar
          const monD = Math.min(0.52, shelfD * 0.78);
          const monH = monD * 0.56;
          const monGroup = new THREE.Group();
          monGroup.position.set(innerW * 0.5 - 0.022, shelfY + monH * 0.5 + 0.16, 0);

          const monChassis = new THREE.Mesh(
            new RoundedBoxGeometry(0.022, monH, monD, 3, 0.005),
            frameMat
          );
          monGroup.add(monChassis);

          const monScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(monD - 0.02, monH - 0.02),
            new THREE.MeshBasicMaterial({
              name:"Campus video screen",map: textures.screenTex,
              color: cfg.fixtureLight ? 0xffffff : 0x2a2e37,
              wireframe: cfg.wireframe
            })
          );
          monScreen.rotation.y = -Math.PI * 0.5;
          monScreen.position.x = -0.012;
          monGroup.add(monScreen);
          propGroup.add(monGroup);

          // Flush Brass Power & USB-C Outlet Strip Above Ledge
          const outletPlate = new THREE.Mesh(
            new RoundedBoxGeometry(0.012, 0.055, 0.16, 2, 0.003),
            brassMat
          );
          outletPlate.position.set(innerW * 0.5 - 0.008, shelfY + 0.055, 0);
          propGroup.add(outletPlate);
        }

        if (cfg.includeAccessories) {
          // Open Laptop & Coffee Tumbler on Pod Ledge
          const laptopBase = new THREE.Mesh(
            new RoundedBoxGeometry(0.21, 0.008, 0.29, 2, 0.003),
            chromeMat
          );
          laptopBase.position.set(shelfX, shelfY + 0.020, -0.04);
          propGroup.add(laptopBase);

          const mug = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.026, 0.11, 20),
            brassMat
          );
          mug.position.set(shelfX, shelfY + 0.071, 0.22);
          propGroup.add(mug);
        }

        // 7. Articulated Front Soundproof Glass Door with Matte Frame & Brass Handle
        const frontFrameThick = 0.042;
        const doorW = innerW - 0.02;
        const doorH = innerH - 0.015;
        const frontZ = d * 0.5 - wallThick * 0.35;

        // Door Hinge Pivot on Left Jamb (Controlled by Articulation Slider!)
        const doorPivot = new THREE.Group();
        doorPivot.position.set(-doorW * 0.5, h * 0.5, frontZ);
        doorPivot.rotation.y = -cfg.articulation * (Math.PI * 0.48); // Opens up to 86 degrees outward

        // Tempered Acoustic Glass Pane
        const glassPane = new THREE.Mesh(
          new THREE.BoxGeometry(doorW - 0.06, doorH - 0.06, 0.012),
          glassMat
        );
        glassPane.position.set(doorW * 0.5, 0, 0);
        doorPivot.add(glassPane);

        // Perimeter Anodized Aluminum Door Stile & Rail Frame
        const topRail = new THREE.Mesh(new RoundedBoxGeometry(doorW, frontFrameThick, 0.028, 2, 0.005), frameMat);
        topRail.position.set(doorW * 0.5, doorH * 0.5 - frontFrameThick * 0.5, 0);
        const botRail = topRail.clone();
        botRail.position.set(doorW * 0.5, -doorH * 0.5 + frontFrameThick * 0.5, 0);

        const leftStile = new THREE.Mesh(new RoundedBoxGeometry(frontFrameThick, doorH, 0.028, 2, 0.005), frameMat);
        leftStile.position.set(frontFrameThick * 0.5, 0, 0);
        const rightStile = leftStile.clone();
        rightStile.position.set(doorW - frontFrameThick * 0.5, 0, 0);
        doorPivot.add(topRail, botRail, leftStile, rightStile);

        // Vertical Architectural Brass & Timber Pull Handle
        const handleBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, 0.42, 16),
          brassMat
        );
        handleBar.position.set(doorW - 0.075, -0.04, 0.032);
        doorPivot.add(handleBar);

        propGroup.add(doorPivot);

        // Optional Biophilic Topper Planter on Roof
        if (cfg.includePlanter) {
          const roofPlanter = buildBiophilicPlanterCrown(w - 0.14, 0.28, materials, cfg.wireframe);
          roofPlanter.position.set(0, h, -d * 0.24);
          propGroup.add(roofPlanter);
          totalFootprintH = h + 0.26;
        }

        lightPos.set(0, h - 0.12, 0);
        lightTarget.set(0, 0.45, 0);
      }

      // =======================================================================
      // ARCHETYPE 2: CO-WORKING & CAMPUS TIERED BLEACHER AMPHITHEATER
      // =======================================================================
      else if (cfg.archetype === 'bleacher') {
        const tiers = 3;
        const tierD = d / tiers;
        const tierH = (h * 0.78) / tiers;
        const stairW = Math.min(0.46, w * 0.26);
        const loungeW = w - stairW;

        // 1. Stepped Architectural Timber Tiers + Integrated Access Staircase
        for (let t = 0; t < tiers; t++) {
          const curH = (t + 1) * tierH;
          const curZ = d * 0.5 - (t + 0.5) * tierD;

          // Main Timber Seating Tier Block (Left Side)
          const tierBlock = new THREE.Mesh(
            new RoundedBoxGeometry(loungeW, curH, tierD + 0.01, 4, 0.012),
            woodMat
          );
          tierBlock.position.set(-stairW * 0.5, curH * 0.5, curZ);
          propGroup.add(tierBlock);

          // Recessed Acoustic Felt Riser Kickplate on Front of Each Tier
          const kickPlate = new THREE.Mesh(
            new RoundedBoxGeometry(loungeW - 0.06, tierH * 0.65, 0.016, 2, 0.005),
            feltMat
          );
          kickPlate.position.set(-stairW * 0.5, curH - tierH * 0.5, curZ + tierD * 0.5 + 0.003);
          propGroup.add(kickPlate);

          // 2 Intermediate Walking Steps per Tier on Right Side Staircase
          for (let s = 0; s < 2; s++) {
            const stepH = t * tierH + (s + 1) * (tierH * 0.5);
            const stepD = tierD * 0.5;
            const stepZ = (curZ + tierD * 0.5) - (s + 0.5) * stepD;

            const stepMesh = new THREE.Mesh(
              new RoundedBoxGeometry(stairW, stepH, stepD + 0.005, 3, 0.008),
              woodMat
            );
            stepMesh.position.set(w * 0.5 - stairW * 0.5, stepH * 0.5, stepZ);
            propGroup.add(stepMesh);

            // Brushed Brass Anti-Slip Stair Nosing Strip
            const nosing = new THREE.Mesh(
              new THREE.BoxGeometry(stairW - 0.03, 0.008, 0.016),
              brassMat
            );
            nosing.position.set(w * 0.5 - stairW * 0.5, stepH + 0.002, stepZ + stepD * 0.5 - 0.01);
            propGroup.add(nosing);
          }

          // Plush Tailored Bleacher Seat Cushions on Each Tier
          if (cfg.includeSeating) {
            const padCount = Math.max(2, Math.floor(loungeW / 0.54));
            const padW = (loungeW - 0.14) / padCount - 0.04;
            const padD = tierD * 0.72;

            for (let p = 0; p < padCount; p++) {
              // Articulation slider subtly shifts cushion spacing/arrangement
              const shiftX = (p - (padCount - 1) * 0.5) * (padW + 0.04 + cfg.articulation * 0.02);
              const px = -stairW * 0.5 + shiftX;
              const cushionMat = (t + p) % 2 === 0 ? seatMat : feltMat;
              const pad = buildPuffedCushion(padW, 0.055, padD, 0.02, cushionMat, 0.014);
              pad.position.set(px, curH + 0.027, curZ + 0.02);
              propGroup.add(pad);
            }
          }

          // Integrated Flush Brass Power & USB-C Charging Puck on Each Tier
          if (cfg.includeTech) {
            const powerPuck = new THREE.Mesh(
              new THREE.CylinderGeometry(0.036, 0.036, 0.012, 20),
              brassMat
            );
            powerPuck.position.set(-w * 0.5 + 0.12, curH + 0.006, curZ - tierD * 0.25);
            propGroup.add(powerPuck);
          }
        }

        // 2. Rear Acoustic Backrest Wall & Top Biophilic Planter Box
        const topTierH = tiers * tierH;
        const backRailH = h - topTierH;
        const backWall = new THREE.Mesh(
          new RoundedBoxGeometry(w, backRailH, 0.09, 4, 0.012),
          feltMat
        );
        backWall.position.set(0, topTierH + backRailH * 0.5, -d * 0.5 + 0.045);
        propGroup.add(backWall);

        if (cfg.includePlanter) {
          const planter = buildBiophilicPlanterCrown(loungeW - 0.08, 0.24, materials, cfg.wireframe);
          planter.position.set(-stairW * 0.5, h - 0.02, -d * 0.5 + 0.12);
          propGroup.add(planter);
        }

        // 3. Architectural Tubular Steel & Brass Side Safety Handrail
        const railCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(w * 0.5 - 0.03, tierH * 0.5 + 0.55, d * 0.5 - 0.08),
          new THREE.Vector3(w * 0.5 - 0.03, topTierH + 0.55, -d * 0.5 + 0.15),
          new THREE.Vector3(w * 0.5 - 0.03, topTierH, -d * 0.5 + 0.15)
        ]);
        const handrail = new THREE.Mesh(
          new THREE.TubeGeometry(railCurve, 32, 0.016, 12, false),
          frameMat
        );
        propGroup.add(handrail);

        // 4. Campus Laptops & Books on the Bleacher Tiers
        if (cfg.includeAccessories) {
          const lapTable = new THREE.Mesh(
            new RoundedBoxGeometry(0.32, 0.26, 0.24, 3, 0.008),
            frameMat
          );
          lapTable.position.set(-stairW * 0.5 + 0.15, tierH * 2 + 0.13, 0);
          propGroup.add(lapTable);

          const bookStack = new THREE.Mesh(
            new RoundedBoxGeometry(0.22, 0.045, 0.28, 2, 0.005),
            seatMat
          );
          bookStack.position.set(-w * 0.32, tierH + 0.025, d * 0.5 - tierD * 0.5);
          bookStack.rotation.y = 0.22;
          propGroup.add(bookStack);
        }

        lightPos.set(0, h + 0.65, 0.35);
        lightTarget.set(0, tierH * 1.5, 0);
      }

      // =======================================================================
      // ARCHETYPE 3: MODULAR CAMPUS LOCKER BANK & INTEGRATED BENCH ALCOVE
      // =======================================================================
      else if (cfg.archetype === 'lockers') {
        const cols = Math.max(3, Math.round(w / 0.42));
        const colW = (w - 0.08) / cols;
        const plinthH = 0.10;
        const crownH = cfg.includePlanter ? 0.16 : 0.04;
        const bodyH = h - plinthH - crownH;
        const benchAlcoveH = 0.44;

        // 1. Recessed Steel Plinth & Main Carcass Surround
        const plinth = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.04, plinthH, d - 0.04, 3, 0.01),
          frameMat
        );
        plinth.position.set(0, plinthH * 0.5, 0);
        propGroup.add(plinth);

        const carcass = new THREE.Mesh(
          new RoundedBoxGeometry(w, bodyH, d - 0.03, 4, 0.014),
          woodMat
        );
        carcass.position.set(0, plinthH + bodyH * 0.5, -0.015);
        propGroup.add(carcass);

        if(!cfg.includePlanter){
          const crown=new THREE.Mesh(new RoundedBoxGeometry(w,.04,d,3,.006),woodMat);
          crown.position.set(0,h-.02,0);propGroup.add(crown);
        }
        // 2. Integrated Central Co-Working Bench Seating Alcove + Upper Lockers
        const startX = -(w - 0.08) * 0.5 + colW * 0.5;
        const tiers = cfg.lockerRows ?? 3;
        const cellH = (bodyH - 0.06) / tiers;

        for (let c = 0; c < cols; c++) {
          const cx = startX + c * colW;
          const isCenterBenchCol = cfg.includeSeating && c > 0 && c < cols - 1;

          for (let r = 0; r < tiers; r++) {
            // Leave bottom row open in center columns for integrated padded bench alcove
            if (isCenterBenchCol && r === 0) continue;

            const cy = plinthH + 0.03 + (r + 0.5) * cellH;
            const doorW = colW - 0.014;
            const doorH = cellH - 0.014;

            // Articulate select locker doors open via the Articulation Slider!
            const isArticulatedDoor = (c === 0 && r === 1) || (c === cols - 1 && r === 2);
            const openAngle = isArticulatedDoor ? cfg.articulation * 1.15 : 0;

            if (isArticulatedDoor && cfg.articulation > 0.02) {
              // Dark Interior Cubby Cavity + Shelf + Books when Locker Door swings open
              const cavity = new THREE.Mesh(
                new RoundedBoxGeometry(doorW - 0.02, doorH - 0.02, 0.04, 2, 0.004),
                darkMat
              );
              cavity.position.set(cx, cy, d * 0.5 - 0.04);
              propGroup.add(cavity);

              if (cfg.includeAccessories) {
                const insideBook = new THREE.Mesh(
                  new RoundedBoxGeometry(doorW * 0.55, 0.035, 0.18, 2, 0.004),
                  seatMat
                );
                insideBook.position.set(cx, cy - doorH * 0.28, d * 0.5 - 0.06);
                propGroup.add(insideBook);
              }
            }

            const doorPivot = new THREE.Group();
            doorPivot.position.set(cx - doorW * 0.5, cy, d * 0.5 - 0.015);
            doorPivot.rotation.y = -openAngle;

            const doorMat = (c + r) % 3 === 0 ? feltMat : woodMat;
            const doorPanel = new THREE.Mesh(
              new RoundedBoxGeometry(doorW, doorH, 0.022, 3, 0.006),
              doorMat
            );
            doorPanel.position.set(doorW * 0.5, 0, 0);
            doorPivot.add(doorPanel);

            // Brushed Brass RFID Digital Keypad Lock & Mail Slot
            if (cfg.includeTech) {
              const rfidPad = new THREE.Mesh(
                new RoundedBoxGeometry(0.028, 0.068, 0.012, 2, 0.003),
                brassMat
              );
              rfidPad.position.set(doorW - 0.038, 0, 0.014);
              doorPivot.add(rfidPad);

              // Subtle Mail / Ventilation Slot
              const slot = new THREE.Mesh(
                new RoundedBoxGeometry(doorW * 0.45, 0.010, 0.008, 1, 0.002),
                darkMat
              );
              slot.position.set(doorW * 0.5, doorH * 0.32, 0.012);
              doorPivot.add(slot);
            }

            propGroup.add(doorPivot);
          }
        }

        // 3. Integrated Upholstered Bench Seat Cushion inside Lower Alcove
        if (cfg.includeSeating && cols >= 3) {
          const benchCols = cols - 2;
          const benchSpanW = benchCols * colW - 0.02;
          const benchCushion = buildPuffedCushion(benchSpanW, 0.075, d + 0.08, 0.024, seatMat, 0.016);
          benchCushion.position.set(0, plinthH + cellH * 0.42, 0.04);
          propGroup.add(benchCushion);

          const benchSupport = new THREE.Mesh(
            new RoundedBoxGeometry(benchSpanW, cellH * 0.36, d + 0.04, 3, 0.008),
            frameMat
          );
          benchSupport.position.set(0, plinthH + cellH * 0.18, 0.02);
          propGroup.add(benchSupport);
        }

        // 4. Biophilic Topper Planter Along Top of Locker Bank
        if (cfg.includePlanter) {
          const topPlanter = buildBiophilicPlanterCrown(w - 0.04, d - 0.06, materials, cfg.wireframe);
          topPlanter.position.set(0, h - crownH, -0.01);
          propGroup.add(topPlanter);
        }

        lightPos.set(0, h + 0.45, d * 0.5 + 0.45);
        lightTarget.set(0, h * 0.5, 0);
      }

      // =======================================================================
      // ARCHETYPE 4: COLLABORATIVE ROLLING AGILE WHITEBOARD, PINBOARD & POUFS
      // =======================================================================
      else {
        const legSpanX = w * 0.5 - 0.08;
        const baseSpreadZ = cfg.baseSpread ?? Math.max(0.56, d * 0.72);
        const casterH = 0.065;
        const lowerTrayY = 0.24;
        const boardCenterY = h * 0.58;
        const boardH = h * 0.66;
        const boardW = w - 0.14;

        // 1. Rolling A-Frame Steel Base & Heavy-Duty Locking Casters
        [-1, 1].forEach((side) => {
          const lx = side * legSpanX;

          // Horizontal Floor Runner Bar
          const runner = new THREE.Mesh(
            new RoundedBoxGeometry(0.042, 0.036, baseSpreadZ, 3, 0.008),
            frameMat
          );
          runner.position.set(lx, casterH + 0.018, 0);
          propGroup.add(runner);

          // Twin Locking Swivel Casters per Side
          [-1, 1].forEach((sz) => {
            const wheel = new THREE.Mesh(
              new THREE.CylinderGeometry(0.028, 0.028, 0.026, 20),
              darkMat
            );
            wheel.rotation.z = Math.PI * 0.5;
            wheel.position.set(lx, 0.028, sz * (baseSpreadZ * 0.42));
            propGroup.add(wheel);

            const fork = new THREE.Mesh(
              new RoundedBoxGeometry(0.034, 0.035, 0.034, 2, 0.005),
              brassMat
            );
            fork.position.set(lx, 0.052, sz * (baseSpreadZ * 0.42));
            propGroup.add(fork);
          });

          // Vertical Upright Stanchion Post
          const postH = boardCenterY + 0.04 - casterH;
          const post = new THREE.Mesh(
            new RoundedBoxGeometry(0.042, postH, 0.048, 3, 0.008),
            frameMat
          );
          post.position.set(lx, casterH + postH * 0.5, 0);
          propGroup.add(post);

          // Brass Gimbal Pivot Knob at Board Rotation Axis
          const knob = new THREE.Mesh(
            new THREE.CylinderGeometry(0.024, 0.024, 0.032, 20),
            brassMat
          );
          knob.rotation.z = Math.PI * 0.5;
          knob.position.set(lx + side * 0.028, boardCenterY, 0);
          propGroup.add(knob);
        });

        // 2. Lower Timber & Felt Storage Caddy Tray + Acoustic Supply Bins
        const tray = new THREE.Mesh(
          new RoundedBoxGeometry(legSpanX * 2, 0.035, baseSpreadZ * 0.58, 3, 0.008),
          woodMat
        );
        tray.position.set(0, lowerTrayY, 0);
        propGroup.add(tray);

        if (cfg.includeAccessories) {
          [-0.25, 0.25].forEach((bx, idx) => {
            const caddyBin = new THREE.Mesh(
              new RoundedBoxGeometry(0.28, 0.14, 0.22, 3, 0.01),
              idx === 0 ? feltMat : seatMat
            );
            caddyBin.position.set(bx, lowerTrayY + 0.085, 0);
            propGroup.add(caddyBin);
          });
        }

        // 3. Pivoting Double-Sided Whiteboard + Ribbed Acoustic Pinboard Frame
        const boardPivot = new THREE.Group();boardPivot.name="Campus writing assembly";
        boardPivot.position.set(0, boardCenterY, 0);
        // Articulation slider tilts/rotates the double-sided easel board!
        boardPivot.rotation.x = (cfg.articulation - 0.38) * 0.45;

        // Solid Wood Perimeter Frame
        const perimeterFrame = new THREE.Mesh(
          new RoundedBoxGeometry(boardW, boardH, 0.042, 4, 0.012),
          woodMat
        );
        boardPivot.add(perimeterFrame);

        // Front Side: Magnetic Porcelain Dot-Grid Whiteboard with Sprint Diagram
        const whiteFace = new THREE.Mesh(
          new THREE.PlaneGeometry(boardW - 0.06, boardH - 0.06),
          new THREE.MeshPhysicalMaterial({
            name:"Campus writing surface",map: textures.whiteboardTex,
            roughness: 0.14,
            clearcoat: 0.85,
            wireframe: cfg.wireframe
          })
        );
        whiteFace.position.z = 0.022;
        boardPivot.add(whiteFace);

        // Rear Side: Ribbed Acoustic PET Felt Pinboard Wall
        const feltBack = new THREE.Mesh(
          new RoundedBoxGeometry(boardW - 0.06, boardH - 0.06, 0.012, 2, 0.004),
          feltMat
        );
        feltBack.position.z = -0.020;
        boardPivot.add(feltBack);

        // Optional Top-Mounted Co-Working Digital Camera & LED Light Bar
        if (cfg.includeTech) {
          const camBar = new THREE.Mesh(
            new RoundedBoxGeometry(boardW * 0.45, 0.028, 0.065, 3, 0.006),
            brassMat
          );
          camBar.position.set(0, boardH * 0.5 + 0.02, 0.02);
          boardPivot.add(camBar);
        }

        // Colorful 3D Kanban Sticky Notes & Dry-Erase Marker Ledge on Whiteboard
        if (cfg.includeAccessories) {
          const noteColors = [0xfbbf24, 0x38bdf8, 0xf472b6, 0x34d399];
          for (let n = 0; n < 6; n++) {
            const note = new THREE.Mesh(
              new RoundedBoxGeometry(0.085, 0.085, 0.005, 1, 0.001),
              new THREE.MeshStandardMaterial({
                color: noteColors[n % noteColors.length],
                roughness: 0.6,
                wireframe: cfg.wireframe
              })
            );
            const col = n % 3;
            const row = Math.floor(n / 3);
            note.position.set(
              -boardW * 0.30 + col * 0.105,
              boardH * 0.16 - row * 0.105,
              0.026
            );
            note.rotation.z = (n % 2 === 0 ? 1 : -1) * 0.04;
            boardPivot.add(note);
          }

          // Magnetic Brass Marker Ledge + Markers
          const markerLedge = new THREE.Mesh(
            new RoundedBoxGeometry(0.38, 0.016, 0.045, 2, 0.004),
            brassMat
          );
          markerLedge.position.set(0.18, -boardH * 0.5 + 0.055, 0.038);
          boardPivot.add(markerLedge);

          [-0.08, -0.03, 0.02].forEach((mx, i) => {
            const marker = new THREE.Mesh(
              new THREE.CylinderGeometry(0.006, 0.006, 0.11, 12),
              new THREE.MeshStandardMaterial({ color: noteColors[i] })
            );
            marker.rotation.z = Math.PI * 0.5;
            marker.position.set(0.18 + mx, -boardH * 0.5 + 0.068, 0.042);
            boardPivot.add(marker);
          });
        }

        propGroup.add(boardPivot);

        // 4. Pair of Matching Co-Working Upholstered Pouf Stools Flanking the Easel
        if (cfg.includeSeating) {
          [-1, 1].forEach((side, idx) => {
            const pouf = buildCoWorkingPoufStool(materials);
            const pullOut = 0.36 + cfg.articulation * 0.25;
            pouf.position.set(
              side * (w * 0.26),
              0,
              (idx === 0 ? 1 : 0.85) * pullOut
            );
            pouf.rotation.y = side * 0.45;
            propGroup.add(pouf);
          });
          totalFootprintD = Math.max(baseSpreadZ, 0.95 + cfg.articulation * 0.25);
        }

        lightPos.set(0, h + 0.35, 0.55);
        lightTarget.set(0, boardCenterY, 0);
      }

      // =======================================================================
      // STUDIO STAGING CONTEXT (Atrium Backdrop Wall, Acoustic Slats & Rug)
      // =======================================================================
      if (cfg.staging) {
        const wallZ = -totalFootprintD * 0.5 - 0.42;

        // 1. Textured Architectural Co-Working Atrium Wall
        const backWall = new THREE.Mesh(
          new RoundedBoxGeometry(totalFootprintW + 1.8, 2.85, 0.08, 2, 0.01),
          new THREE.MeshStandardMaterial({
            color: 0x161922,
            roughness: 0.88,
            bumpMap: textures.fabricTex,
            bumpScale: 0.0015
          })
        );
        backWall.position.set(0, 1.425, wallZ);
        stagingGroup.add(backWall);

        // 2. Vertical Timber Acoustic Slat Feature Panel on Atrium Wall
        const slatCount = 18;
        const slatSpan = Math.min(totalFootprintW + 0.6, 2.5);
        const slatStep = slatSpan / (slatCount - 1);
        for (let i = 0; i < slatCount; i++) {
          const sx = -slatSpan * 0.5 + i * slatStep;
          const slat = new THREE.Mesh(
            new RoundedBoxGeometry(0.032, 2.72, 0.026, 2, 0.004),
            woodMat
          );
          slat.position.set(sx, 1.36, wallZ + 0.052);
          stagingGroup.add(slat);
        }

        // 3. Woven Commercial Co-Working Zone Area Rug
        const rugW = totalFootprintW + 0.95;
        const rugD = totalFootprintD + 0.95;
        const rug = new THREE.Mesh(
          new RoundedBoxGeometry(rugW, 0.010, rugD, 2, 0.004),
          new THREE.MeshStandardMaterial({
            color: 0x1e222b,
            roughness: 0.92,
            bumpMap: textures.fabricTex,
            bumpScale: 0.003
          })
        );
        rug.position.set(0, 0.005, 0.08);
        stagingGroup.add(rug);
      }

      // Enable Shadows on All Meshes
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
        lightPos,
        lightTarget,
        dimensions: {
          width: totalFootprintW,
          depth: totalFootprintD,
          height: totalFootprintH
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

export function createCampusFurniture(config={}){
 const cfg={archetype:'pod',component:'complete',width:1.28,depth:1.18,height:2.18,articulation:.1,woodColor:'#c99b63',frameColor:'#1e2329',seatColor:'#b86443',feltColor:'#3d5247',includeSeating:true,includeTech:true,includePlanter:true,includeAccessories:true,fixtureLight:true,...config,staging:false,wireframe:false};
 if(!['pod','bleacher','lockers','whiteboard','pouf'].includes(cfg.archetype)||cfg.width<.7||cfg.width>3||cfg.height<.5||cfg.height>2.5||cfg.depth<.24||cfg.depth>2.5)throw Error('Unsupported campus furniture dimensions');
 let {propGroup,lightPos}=buildCoWorkingScene(cfg);
 if(cfg.component==='wall-board'){const board=propGroup.getObjectByName('Campus writing assembly');propGroup.remove(board);board.position.set(0,0,0);propGroup=new THREE.Group();propGroup.add(board);}
 const materials=new Set();propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(m.bumpScale>.003?.4:.25);m.bumpMap=null;}m.userData.roomPaletteLocked=true;if(m.name==='Campus interior LED')m.userData.campusGlow=1;if(m.name==='Campus video screen')m.userData.sceneDisplay='theme';}
 propGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(propGroup),center=bounds.getCenter(new THREE.Vector3());
 propGroup.position.set(-center.x,cfg.component==='wall-board'?-center.y:-bounds.min.y,cfg.component==='wall-board'?-bounds.min.z:-center.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier campus '+cfg.archetype+' '+cfg.family;propGroup.userData={campusFurniture:true,archetype:cfg.archetype,family:cfg.family,lightAnchor:lightPos.clone().add(propGroup.position).toArray(),component:cfg.component};
 return propGroup;
}
