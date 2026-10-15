// Adapted from the owner's Atelier 3D three-frame chair generator (2026-10-14).
// Metres, Y up; seating faces +Z. Staging is never exported with the furniture.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x43484149;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Heavy Bouclé Weave
      const boucleCanvas = document.createElement('canvas');
      boucleCanvas.width = 256;
      boucleCanvas.height = 256;
      const bCtx = boucleCanvas.getContext('2d');
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 3) {
        for (let x = 0; x < 256; x += 3) {
          const n = Math.sin(x * 0.45) * Math.cos(y * 0.45) * 28 + (random() * 54 - 27);
          const v = Math.max(20, Math.min(235, Math.floor(128 + n)));
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.beginPath();
          bCtx.arc(x + (y % 2), y, 1.6, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
      const boucleTex = new THREE.CanvasTexture(boucleCanvas);
      boucleTex.wrapS = boucleTex.wrapT = THREE.RepeatWrapping;
      boucleTex.repeat.set(11, 11);

      // 2. Full-Grain Leather Pebble
      const leatherCanvas = document.createElement('canvas');
      leatherCanvas.width = 256;
      leatherCanvas.height = 256;
      const lCtx = leatherCanvas.getContext('2d');
      lCtx.fillStyle = '#787878';
      lCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4200; i++) {
        const x = random() * 256;
        const y = random() * 256;
        const r = 1.1 + random() * 2.1;
        const s = 135 + Math.floor(random() * 65);
        lCtx.fillStyle = `rgb(${s},${s},${s})`;
        lCtx.beginPath();
        lCtx.arc(x, y, r, 0, Math.PI * 2);
        lCtx.fill();
      }
      const leatherTex = new THREE.CanvasTexture(leatherCanvas);
      leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
      leatherTex.repeat.set(9, 9);

      // 3. Rosewood / American Walnut Cathedral Grain
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x++) {
          const wave = Math.sin(y * 0.15 + Math.sin(x * 0.028) * 4.2) * 20;
          const fine = (random() - 0.5) * 9;
          const v = Math.max(55, Math.min(215, Math.floor(135 + wave + fine)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(2, 1);

      // 4. Circular Bouclé Studio Rug Texture
      const rugCanvas = document.createElement('canvas');
      rugCanvas.width = 512;
      rugCanvas.height = 512;
      const rCtx = rugCanvas.getContext('2d');
      rCtx.fillStyle = '#23262c';
      rCtx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 3) {
        for (let x = 0; x < 512; x += 5) {
          const tone = 33 + Math.floor(random() * 16);
          rCtx.fillStyle = `rgb(${tone},${tone + 1},${tone + 3})`;
          rCtx.fillRect(x, y, 4, 2);
        }
      }
      rCtx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      rCtx.lineWidth = 8;
      rCtx.beginPath();
      rCtx.arc(256, 256, 232, 0, Math.PI * 2);
      rCtx.stroke();
      const rugTex = new THREE.CanvasTexture(rugCanvas);

      return { boucleTex, leatherTex, woodTex, rugTex };
    }

    const textures = createProceduralTextures();

    /**
     * Generates a high-resolution cushion with cosine crown loft, radiating creasing,
     * and recessed button-tuft dimple wells. Also returns 3D coordinates for buttons.
     */
    function createTuftedCushionGeometry(width, height, depth, radius, puffAmount = 0.028, tuftCols = 2, tuftRows = 2, enableTufting = true) {
      const geom = new RoundedBoxGeometry(width, height, depth, 6, radius);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();

      const halfW = width * 0.5;
      const halfH = height * 0.5;
      const halfD = depth * 0.5;

      // Compute normalized button-tuft UV coordinates (-1..1)
      const tuftPoints = [];
      if (enableTufting && tuftCols > 0 && tuftRows > 0) {
        for (let r = 0; r < tuftRows; r++) {
          for (let c = 0; c < tuftCols; c++) {
            const tx = tuftCols === 1 ? 0 : (c / (tuftCols - 1) - 0.5) * 0.92;
            const tz = tuftRows === 1 ? 0 : (r / (tuftRows - 1) - 0.5) * 0.88;
            tuftPoints.push({ nx: tx, nz: tz });
          }
        }
      }

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        const nx = THREE.MathUtils.clamp(v.x / halfW, -1, 1);
        const ny = THREE.MathUtils.clamp(v.y / halfH, -1, 1);
        const nz = THREE.MathUtils.clamp(v.z / halfD, -1, 1);

        const domeXZ = Math.cos(nx * Math.PI * 0.46) * Math.cos(nz * Math.PI * 0.46);
        const domeXY = Math.cos(nx * Math.PI * 0.46) * Math.cos(ny * Math.PI * 0.46);
        const domeZY = Math.cos(nz * Math.PI * 0.46) * Math.cos(ny * Math.PI * 0.46);

        if (Math.abs(ny) > 0.2) {
          v.y += Math.sign(ny) * domeXZ * puffAmount;
        }
        v.z += Math.sign(nz) * domeXY * (puffAmount * 0.44);
        v.x += Math.sign(nx) * domeZY * (puffAmount * 0.35);

        // Corner tailoring tension
        const corner = Math.abs(nx) * Math.abs(nz);
        if (corner > 0.65) {
          v.y *= 1 - (corner - 0.65) * 0.02;
        }

        // Apply recessed button-tuft dimples on the top/front cushion face (ny > 0.3)
        if (enableTufting && ny > 0.3 && tuftPoints.length > 0) {
          let totalIndent = 0;
          for (let t = 0; t < tuftPoints.length; t++) {
            const dx = nx - tuftPoints[t].nx;
            const dz = nz - tuftPoints[t].nz;
            const distSq = dx * dx + dz * dz;
            // Deep central button well + subtle diamond pleat crease
            const well = Math.exp(-distSq * 26.0);
            const pleat = Math.exp(-Math.pow(Math.abs(dx) - Math.abs(dz), 2) * 35.0) * Math.exp(-distSq * 4.5) * 0.18;
            totalIndent += (well + pleat);
          }
          v.y -= Math.min(1.15, totalIndent) * (puffAmount * 0.72 + 0.012);
        }

        pos.setXYZ(i, v.x, v.y, v.z);
      }

      geom.computeVertexNormals();

      // Calculate exact 3D button anchor positions on top surface
      const buttonAnchors = tuftPoints.map((pt) => {
        const bx = pt.nx * halfW;
        const bz = pt.nz * halfD;
        const dome = Math.cos(pt.nx * Math.PI * 0.46) * Math.cos(pt.nz * Math.PI * 0.46);
        const by = halfH + dome * puffAmount - (puffAmount * 0.72 + 0.010);
        return new THREE.Vector3(bx, by, bz);
      });

      return { geometry: geom, buttonAnchors };
    }

    /**
     * Builds a complete cushion assembly (Mesh + 3D Covered Tuft Buttons + Perimeter Welt Piping)
     */
    function createCushionAssembly({
      width,
      height,
      depth,
      radius = 0.042,
      puffAmount = 0.028,
      tuftCols = 2,
      tuftRows = 2,
      enableTufting = true,
      enablePiping = true,
      fabricMat,
      pipingMat
    }) {
      if (height > depth && height > .2) {
        const upright=new THREE.Group();
        const pad=createCushionAssembly({width,height:depth,depth:height,radius,puffAmount,tuftCols,tuftRows,enableTufting,enablePiping,fabricMat,pipingMat});
        pad.rotation.x=Math.PI/2;upright.add(pad);return upright;
      }
      const group = new THREE.Group();
      const { geometry, buttonAnchors } = createTuftedCushionGeometry(
        width,
        height,
        depth,
        radius,
        puffAmount,
        tuftCols,
        tuftRows,
        enableTufting
      );

      const cushionMesh = new THREE.Mesh(geometry, fabricMat);
      group.add(cushionMesh);

      // Add 3D upholstered buttons nestled inside each recessed dimple
      if (enableTufting && buttonAnchors.length > 0) {
        const btnGeom = new THREE.CylinderGeometry(0.011, 0.009, 0.007, 16);
        buttonAnchors.forEach((anchor) => {
          const btn = new THREE.Mesh(btnGeom, pipingMat);
          btn.position.copy(anchor);
          group.add(btn);
        });
      }

      // Add 3D tubular welt piping around top & bottom perimeters
      if (enablePiping) {
        const topPipe = new THREE.Mesh(
          createWeltPipingLoop(width - 0.012, depth - 0.012, height * 0.5 - 0.011, 0.038, 0.0042),
          pipingMat
        );
        const botPipe = new THREE.Mesh(
          createWeltPipingLoop(width - 0.012, depth - 0.012, -height * 0.5 + 0.011, 0.038, 0.0042),
          pipingMat
        );
        group.add(topPipe, botPipe);
      }

      return group;
    }

    /**
     * Builds a continuous 3D tubular welt seam loop
     */
    function createWeltPipingLoop(width, depth, yOffset, cornerRadius = 0.038, tubeRadius = 0.0042) {
      const hw = width * 0.5 - 0.01;
      const hd = depth * 0.5 - 0.01;
      const r = Math.min(cornerRadius, hw * 0.4, hd * 0.4);

      const path = new THREE.CurvePath();
      const pts = [
        new THREE.Vector3(-hw + r, yOffset, -hd),
        new THREE.Vector3(hw - r, yOffset, -hd),
        new THREE.Vector3(hw, yOffset, -hd),
        new THREE.Vector3(hw, yOffset, -hd + r),
        new THREE.Vector3(hw, yOffset, hd - r),
        new THREE.Vector3(hw, yOffset, hd),
        new THREE.Vector3(hw - r, yOffset, hd),
        new THREE.Vector3(-hw + r, yOffset, hd),
        new THREE.Vector3(-hw, yOffset, hd),
        new THREE.Vector3(-hw, yOffset, hd - r),
        new THREE.Vector3(-hw, yOffset, -hd + r),
        new THREE.Vector3(-hw, yOffset, -hd)
      ];

      path.add(new THREE.LineCurve3(pts[0], pts[1]));
      path.add(new THREE.QuadraticBezierCurve3(pts[1], pts[2], pts[3]));
      path.add(new THREE.LineCurve3(pts[3], pts[4]));
      path.add(new THREE.QuadraticBezierCurve3(pts[4], pts[5], pts[6]));
      path.add(new THREE.LineCurve3(pts[6], pts[7]));
      path.add(new THREE.QuadraticBezierCurve3(pts[7], pts[8], pts[9]));
      path.add(new THREE.LineCurve3(pts[9], pts[10]));
      path.add(new THREE.QuadraticBezierCurve3(pts[10], pts[11], pts[0]));

      return new THREE.TubeGeometry(path, 40, tubeRadius, 6, true);
    }

    /**
     * Creates a tailored rectangular lumbar throw pillow with subtle curve
     */
    function createLumbarPillowGeometry(width = 0.42, height = 0.24, thickness = 0.11) {
      const geom = new THREE.BoxGeometry(width, height, thickness, 8, 8, 4);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();
      const hw = width * 0.5;
      const hh = height * 0.5;
      const ht = thickness * 0.5;

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const nx = v.x / hw;
        const ny = v.y / hh;
        const nz = v.z / ht;

        const dome = Math.cos(nx * Math.PI * 0.5) * Math.cos(ny * Math.PI * 0.5);
        v.z = nz * ht * (0.22 + 0.92 * dome);
        v.z -= Math.pow(nx, 2) * 0.016;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geom.computeVertexNormals();
      return geom;
    }

    /**
     * Master Procedural High-End Chair & Ottoman Builder
     */
    function buildChairScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = 'HighEndDesignerChairProp';

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const seatW = cfg.seatWidth;
      const seatD = 0.58;
      const backH = cfg.backHeight;
      const reclineRad = THREE.MathUtils.degToRad(cfg.reclineDeg);
      const puff = 0.028 * cfg.puffScale;

      // --- Configure PBR Materials ---
      const baseColor = new THREE.Color(cfg.fabricColor);
      const sheenTint = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.32);

      let fabricMat;
      if (cfg.textile === 'leather') {
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.34,
          metalness: 0.02,
          clearcoat: 0.24,
          clearcoatRoughness: 0.38,
          sheen: 0.25,
          sheenColor: sheenTint,
          bumpMap: textures.leatherTex,
          bumpScale: 0.0022,
          wireframe: cfg.wireframe
        });
      } else if (cfg.textile === 'velvet') {
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.60,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.24,
          sheenColor: sheenTint,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0012,
          wireframe: cfg.wireframe
        });
      } else {
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.82,
          metalness: 0.0,
          sheen: 0.95,
          sheenRoughness: 0.45,
          sheenColor: sheenTint,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0036,
          wireframe: cfg.wireframe
        });
      }

      const pipingMat = new THREE.MeshPhysicalMaterial({
        color: baseColor.clone().multiplyScalar(0.74),
        roughness: 0.42,
        sheen: 0.5,
        wireframe: cfg.wireframe
      });

      const accentColor = new THREE.Color(cfg.accentColor);
      const accentMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        roughness: 0.58,
        sheen: 0.85,
        sheenColor: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.3),
        bumpMap: textures.boucleTex,
        bumpScale: 0.0022,
        wireframe: cfg.wireframe
      });

      const woodMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.woodColor),
        roughness: 0.32,
        metalness: 0.04,
        clearcoat: 0.36,
        clearcoatRoughness: 0.26,
        bumpMap: textures.woodTex,
        bumpScale: 0.0020,
        wireframe: cfg.wireframe
      });

      const metalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.metalColor),
        roughness: 0.20,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      const darkHardwareMat = new THREE.MeshStandardMaterial({
        color: 0x1b1d20,
        roughness: 0.35,
        metalness: 0.82,
        wireframe: cfg.wireframe
      });

      fabricMat.name='Atelier tailored '+cfg.textile;
      pipingMat.name='Atelier welt cord';accentMat.name='Atelier lumbar textile';
      woodMat.name='Atelier grained timber';metalMat.name='Atelier polished frame';
      darkHardwareMat.name='Atelier dark hardware';
      // Chair Pivot Group (tilts seat & back together for ergonomic lounge rake)
      const chairRig = new THREE.Group();
      const seatBaseY = 0.36;
      const seatCushionH = 0.135;

      // =========================================================================
      // ARCHETYPE 1: MOLDED PLYWOOD SWIVEL LOUNGE CHAIR (Eames / Rosewood Style)
      // =========================================================================
      if (cfg.archetype === 'molded') {
        // 1. 5-Star Architectural Swivel Base (Anchored on Floor)
        const baseGroup = new THREE.Group();
        const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.16, 24), darkHardwareMat);
        hubMesh.position.y = 0.16;
        baseGroup.add(hubMesh);

        const brassCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.025, 24), metalMat);
        brassCollar.position.y = 0.11;
        baseGroup.add(brassCollar);
        // Carry the shell all the way to the swivel hub; the supplied preview
        // left a visible gap between its base and seat.
        const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.17,20),darkHardwareMat);
        spindle.position.y=.275;baseGroup.add(spindle);
        const seatPlate=new THREE.Mesh(new RoundedBoxGeometry(.25,.025,.22,3,.008),darkHardwareMat);
        seatPlate.position.y=.337;baseGroup.add(seatPlate);

        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + Math.PI * 0.2;
          const armPivot = new THREE.Group();
          armPivot.rotation.y = angle;

          const starBlade = new THREE.Mesh(
            new RoundedBoxGeometry(0.034, 0.026, 0.33, 3, 0.008),
            metalMat
          );
          starBlade.position.set(0, 0.068, 0.165);
          starBlade.rotation.x = 0.24;

          const footGlide = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.025, 0.014, 18),
            metalMat
          );
          footGlide.position.set(0, 0.007, 0.315);

          armPivot.add(starBlade, footGlide);
          baseGroup.add(armPivot);
        }
        propGroup.add(baseGroup);

        // 2. Reclined Seat & Backrest Shell Assembly
        chairRig.position.set(0, seatBaseY, -0.02);
        chairRig.rotation.x = -reclineRad * 0.45;

        // Molded Plywood Under-Seat Shell + Curved Side Flanges
        const underShell = new THREE.Mesh(
          new RoundedBoxGeometry(seatW + 0.03, 0.024, seatD + 0.02, 4, 0.01),
          woodMat
        );
        underShell.position.set(0, -0.015, 0.02);
        chairRig.add(underShell);

        [-1, 1].forEach((side) => {
          const sideCheek = new THREE.Mesh(
            new RoundedBoxGeometry(0.022, 0.13, seatD * 0.86, 4, 0.01),
            woodMat
          );
          sideCheek.position.set(side * (seatW * 0.5 + 0.012), 0.045, 0.02);
          sideCheek.rotation.z = side * -0.12;
          chairRig.add(sideCheek);
        });

        // Plush Tufted Seat Cushion
        const seatCushion = createCushionAssembly({
          width: seatW,
          height: seatCushionH,
          depth: seatD,
          radius: 0.045,
          puffAmount: puff,
          tuftCols: 2,
          tuftRows: 2,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        seatCushion.position.set(0, seatCushionH * 0.5, 0.02);
        chairRig.add(seatCushion);

        // Two-Tier Molded Plywood Backrest & Upper Headrest Shells
        const backGroup = new THREE.Group();
        backGroup.position.set(0, 0.06, -seatD * 0.45);
        backGroup.rotation.x = -reclineRad * 0.65;

        const lowerBackH = backH * 0.56;
        const upperHeadH = backH * 0.40;
        const shellGap = 0.028;

        // Lower Lumbar Wood Shell + Cushion
        const lowerShell = new THREE.Mesh(
          new RoundedBoxGeometry(seatW + 0.02, lowerBackH, 0.024, 4, 0.01),
          woodMat
        );
        lowerShell.position.set(0, lowerBackH * 0.5, -0.075);
        backGroup.add(lowerShell);

        const lowerBackCushion = createCushionAssembly({
          width: seatW - 0.01,
          height: lowerBackH - 0.01,
          depth: 0.135,
          radius: 0.042,
          puffAmount: puff,
          tuftCols: 2,
          tuftRows: 1,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        lowerBackCushion.position.set(0, lowerBackH * 0.5, 0);
        backGroup.add(lowerBackCushion);

        // Upper Headrest Wood Shell + Cushion
        const headCenterY = lowerBackH + shellGap + upperHeadH * 0.5;
        const upperShell = new THREE.Mesh(
          new RoundedBoxGeometry(seatW * 0.96, upperHeadH, 0.024, 4, 0.01),
          woodMat
        );
        upperShell.position.set(0, headCenterY, -0.068);
        upperShell.rotation.x = 0.08; // Ergonomic forward headrest nod
        backGroup.add(upperShell);

        const upperHeadCushion = createCushionAssembly({
          width: seatW * 0.94,
          height: upperHeadH - 0.01,
          depth: 0.125,
          radius: 0.040,
          puffAmount: puff * 0.95,
          tuftCols: 2,
          tuftRows: 1,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        upperHeadCushion.position.set(0, headCenterY, 0.005);
        upperHeadCushion.rotation.x = 0.08;
        backGroup.add(upperHeadCushion);

        // Twin Architectural Metal Spine Brackets Connecting Lower & Upper Shells
        [-1, 1].forEach((side) => {
          const spineBracket = new THREE.Mesh(
            new RoundedBoxGeometry(0.032, backH * 0.72, 0.018, 3, 0.006),
            metalMat
          );
          spineBracket.position.set(side * (seatW * 0.28), backH * 0.46, -0.092);
          backGroup.add(spineBracket);
        });

        chairRig.add(backGroup);

        // Swept Upholstered Armrests
        [-1, 1].forEach((side) => {
          const armPad = createCushionAssembly({
            width: 0.115,
            height: 0.095,
            depth: seatD * 0.78,
            radius: 0.038,
            puffAmount: puff * 0.5,
            tuftCols: 0,
            tuftRows: 0,
            enableTufting: false,
            enablePiping: cfg.piping,
            fabricMat,
            pipingMat
          });
          armPad.position.set(side * (seatW * 0.5 + 0.055), 0.195, -0.02);
          armPad.rotation.z = side * -0.08;
          chairRig.add(armPad);
          for(const z of [-.17,.12]){
            const brace=new THREE.Mesh(new RoundedBoxGeometry(.022,.17,.025,3,.006),metalMat);
            brace.position.set(side*(seatW*.5+.024),.087,z);
            brace.rotation.z=side*-.16;chairRig.add(brace);
          }
        });

        propGroup.add(chairRig);
      }

      // =========================================================================
      // ARCHETYPE 2: DANISH SCULPTURAL TIMBER FRAME LOUNGE CHAIR
      // =========================================================================
      else if (cfg.archetype === 'timber') {
        const frameOuterX = seatW * 0.5 + 0.045;
        const frontZ = seatD * 0.44;
        const backZ = -seatD * 0.44;

        // Sculpted Solid Wood A-Frame Legs & Stretchers
        [-1, 1].forEach((side) => {
          const lx = side * frameOuterX;

          // Front Tapered Leg
          const frontLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.024, 0.016, 0.54, 20),
            woodMat
          );
          frontLeg.position.set(lx, 0.27, frontZ);
          frontLeg.rotation.x = -0.08;
          propGroup.add(frontLeg);

          // Rear Raked Continuous Stile Leg
          const rearLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.016, 0.74, 20),
            woodMat
          );
          rearLeg.position.set(lx, 0.36, backZ - 0.04);
          rearLeg.rotation.x = -0.22;
          propGroup.add(rearLeg);

          // Side Apron Rail
          const sideRail = new THREE.Mesh(
            new RoundedBoxGeometry(0.026, 0.048, seatD + 0.04, 3, 0.008),
            woodMat
          );
          sideRail.position.set(lx, 0.28, 0);
          sideRail.rotation.x = -0.10;
          propGroup.add(sideRail);

          // Sculpted Floating Paddle Armrest
          const paddleArm = new THREE.Mesh(
            new RoundedBoxGeometry(0.078, 0.024, seatD * 0.96, 4, 0.01),
            woodMat
          );
          paddleArm.position.set(lx + side * 0.008, 0.54, -0.01);
          paddleArm.rotation.x = -0.06;
          propGroup.add(paddleArm);

          // Brass Dowel Accent at Armrest Joint
          const brassPin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.028, 16),
            metalMat
          );
          brassPin.position.set(lx + side * 0.008, 0.542, frontZ);
          propGroup.add(brassPin);
        });

        // Front & Rear Cross Stretchers + Woven Support Deck
        const frontStretcher = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, frameOuterX * 2, 16),
          woodMat
        );
        frontStretcher.rotation.z = Math.PI * 0.5;
        frontStretcher.position.set(0, 0.25, frontZ - 0.02);
        propGroup.add(frontStretcher);

        const rearCrestRail = new THREE.Mesh(
          new RoundedBoxGeometry(frameOuterX * 2 + 0.04, 0.065, 0.028, 4, 0.012),
          woodMat
        );
        rearCrestRail.position.set(0, 0.64, backZ - 0.11);
        rearCrestRail.rotation.x = -0.22;
        propGroup.add(rearCrestRail);

        // Reclined Seat & Backrest Cushions
        chairRig.position.set(0, 0.30, 0);
        chairRig.rotation.x = -reclineRad * 0.42;

        const seatCushion = createCushionAssembly({
          width: seatW,
          height: seatCushionH + 0.01,
          depth: seatD,
          radius: 0.042,
          puffAmount: puff,
          tuftCols: 2,
          tuftRows: 2,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        seatCushion.position.set(0, seatCushionH * 0.5, 0.02);
        chairRig.add(seatCushion);

        const backCushion = createCushionAssembly({
          width: seatW - 0.01,
          height: backH * 0.85,
          depth: 0.145,
          radius: 0.046,
          puffAmount: puff * 1.05,
          tuftCols: 2,
          tuftRows: 2,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        backCushion.position.set(0, 0.06 + backH * 0.42, -seatD * 0.42);
        backCushion.rotation.x = -reclineRad * 0.6;
        chairRig.add(backCushion);

        propGroup.add(chairRig);
      }

      // =========================================================================
      // ARCHETYPE 3: ITALIAN CANTILEVER TUBULAR CLUB ARMCHAIR
      // =========================================================================
      else {
        const frameX = seatW * 0.5 + 0.055;
        const zFront = seatD * 0.48;
        const zBack = -seatD * 0.48;
        const armTopY = 0.56;

        // Continuous Bent Metal Sled Frame on Left & Right Sides
        [-1, 1].forEach((side) => {
          const sx = side * frameX;
          const sledCurve = new THREE.CurvePath();
          const p0 = new THREE.Vector3(sx, 0.016, zBack);
          const p1 = new THREE.Vector3(sx, 0.016, zFront);
          const p2 = new THREE.Vector3(sx, armTopY, zFront);
          const p3 = new THREE.Vector3(sx, armTopY, zBack + 0.04);

          sledCurve.add(new THREE.LineCurve3(p0, p1));
          sledCurve.add(new THREE.LineCurve3(p1, p2));
          sledCurve.add(new THREE.LineCurve3(p2, p3));

          const tubeGeom = new THREE.TubeGeometry(sledCurve, 40, 0.015, 8, false);
          const sledMesh = new THREE.Mesh(tubeGeom, metalMat);
          propGroup.add(sledMesh);

          // Tailored Wood/Leather Armrest Wrap Cap
          const armCap = new THREE.Mesh(
            new RoundedBoxGeometry(0.062, 0.028, seatD * 0.72, 4, 0.01),
            woodMat
          );
          armCap.position.set(sx, armTopY + 0.014, -0.02);
          propGroup.add(armCap);
        });

        // Under-seat Tubular Crossbars
        [-0.18, 0.18].forEach((zOff) => {
          const bar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.013, 0.013, frameX * 2, 16),
            metalMat
          );
          bar.rotation.z = Math.PI * 0.5;
          bar.position.set(0, 0.25, zOff);
          propGroup.add(bar);
        });

        // Upholstered Club Basket + Plush Cushions
        chairRig.position.set(0, 0.27, 0);
        chairRig.rotation.x = -reclineRad * 0.35;

        const seatCushion = createCushionAssembly({
          width: seatW + 0.02,
          height: seatCushionH + 0.02,
          depth: seatD + 0.02,
          radius: 0.048,
          puffAmount: puff * 1.1,
          tuftCols: 2,
          tuftRows: 2,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        seatCushion.position.set(0, seatCushionH * 0.5, 0.02);
        chairRig.add(seatCushion);

        const backCushion = createCushionAssembly({
          width: seatW + 0.01,
          height: backH * 0.88,
          depth: 0.16,
          radius: 0.052,
          puffAmount: puff * 1.1,
          tuftCols: 3,
          tuftRows: 2,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        backCushion.position.set(0, 0.06 + backH * 0.44, -seatD * 0.42);
        backCushion.rotation.x = -reclineRad * 0.55;
        chairRig.add(backCushion);

        // Cylindrical Inner Side Bolsters
        const bolsterGeom = new THREE.CylinderGeometry(0.055, 0.055, seatD * 0.72, 24);
        bolsterGeom.rotateX(Math.PI * 0.5);
        [-1, 1].forEach((side) => {
          const bolster = new THREE.Mesh(bolsterGeom, fabricMat);
          bolster.position.set(side * (seatW * 0.5 - 0.03), seatCushionH + 0.055, 0.04);
          chairRig.add(bolster);
        });

        propGroup.add(chairRig);
      }

      // --- Contrast Lumbar Throw Pillow (Shared Across Archetypes) ---
      if (cfg.pillow) {
        const pillowMesh = new THREE.Mesh(
          createLumbarPillowGeometry(seatW * 0.62, 0.22, 0.105),
          accentMat
        );
        pillowMesh.position.set(0, seatCushionH + 0.11, -seatD * 0.25);
        pillowMesh.rotation.x = -reclineRad * 0.65 - 0.12;
        chairRig.add(pillowMesh);
      }

      // =========================================================================
      // OPTIONAL MATCHING FOOTSTOOL OTTOMAN PROP
      // =========================================================================
      const ottomanZ = 0.72;
      if (cfg.ottoman) {
        const ottoGroup = new THREE.Group();
        ottoGroup.name = 'MatchingOttomanProp';
        ottoGroup.position.set(0, 0, ottomanZ);

        const ottoW = seatW * 0.82;
        const ottoD = 0.44;
        const ottoH = 0.125;
        const ottoBaseY = 0.30;

        // Ottoman Cushion + Molded Wood Tray
        const ottoTray = new THREE.Group();
        ottoTray.position.y = ottoBaseY;
        ottoTray.rotation.x = 0.09; // Ergonomic calf slope toward sitter

        const ottoShell = new THREE.Mesh(
          new RoundedBoxGeometry(ottoW + 0.02, 0.022, ottoD + 0.02, 4, 0.01),
          woodMat
        );
        ottoShell.position.y = -0.012;
        ottoTray.add(ottoShell);

        const ottoCushion = createCushionAssembly({
          width: ottoW,
          height: ottoH,
          depth: ottoD,
          radius: 0.040,
          puffAmount: puff * 0.9,
          tuftCols: 2,
          tuftRows: 1,
          enableTufting: cfg.tufting,
          enablePiping: cfg.piping,
          fabricMat,
          pipingMat
        });
        ottoCushion.position.y = ottoH * 0.5;
        ottoTray.add(ottoCushion);
        ottoGroup.add(ottoTray);

        // Ottoman Base (Matches Selected Chair Archetype)
        if (cfg.archetype === 'molded') {
          const ottoHub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, ottoBaseY - 0.06, 20), darkHardwareMat);
          ottoHub.position.y = (ottoBaseY - 0.06) * 0.5 + 0.05;
          ottoGroup.add(ottoHub);

          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
            const legPiv = new THREE.Group();
            legPiv.rotation.y = a;
            const blade = new THREE.Mesh(new RoundedBoxGeometry(0.028, 0.022, 0.25, 3, 0.006), metalMat);
            blade.position.set(0, 0.055, 0.125);
            blade.rotation.x = 0.25;
            legPiv.add(blade);
            ottoGroup.add(legPiv);
          }
        } else if (cfg.archetype === 'timber') {
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, ottoBaseY, 16), woodMat);
            leg.position.set(sx * (ottoW * 0.42), ottoBaseY * 0.5, sz * (ottoD * 0.36));
            leg.rotation.z = sx * -0.08;
            leg.rotation.x = sz * 0.08;
            ottoGroup.add(leg);
          });
        } else {
          [-1, 1].forEach((side) => {
            const ox = side * (ottoW * 0.44);
            const curve = new THREE.CurvePath();
            curve.add(new THREE.LineCurve3(new THREE.Vector3(ox, 0.014, -ottoD * 0.42), new THREE.Vector3(ox, 0.014, ottoD * 0.42)));
            curve.add(new THREE.LineCurve3(new THREE.Vector3(ox, 0.014, ottoD * 0.42), new THREE.Vector3(ox, ottoBaseY, ottoD * 0.42)));
            curve.add(new THREE.LineCurve3(new THREE.Vector3(ox, ottoBaseY, ottoD * 0.42), new THREE.Vector3(ox, ottoBaseY, -ottoD * 0.42)));
            ottoGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 8, false), metalMat));
          });
        }

        propGroup.add(ottoGroup);
      }

      // =========================================================================
      // OPTIONAL STUDIO STAGING CONTEXT (Circular Rug, Marble Side Table & Lamp)
      // =========================================================================
      if (cfg.staging) {
        const rugMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1.38, 1.38, 0.010, 64),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: textures.rugTex,
            bumpMap: textures.rugTex,
            bumpScale: 0.004,
            roughness: 0.92
          })
        );
        rugMesh.position.set(0.08, 0.005, cfg.ottoman ? 0.28 : 0.05);
        stagingGroup.add(rugMesh);

        // Travertine & Brass Drink Side Table + Hardcover Art Book
        const tableGroup = new THREE.Group();
        tableGroup.position.set(seatW * 0.5 + 0.38, 0, -0.05);

        const travertineMat = new THREE.MeshPhysicalMaterial({
          color: 0xded5c5,
          roughness: 0.36,
          clearcoat: 0.16,
          bumpMap: textures.leatherTex,
          bumpScale: 0.001
        });

        const topDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.028, 36), travertineMat);
        topDisk.position.y = 0.50;
        const baseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.26, 32), travertineMat);
        baseCone.position.y = 0.13;
        const brassStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 20), metalMat);
        brassStem.position.y = 0.38;

        // Espresso Cup & Art Book on Side Table
        const bookCover = new THREE.Mesh(
          new RoundedBoxGeometry(0.18, 0.022, 0.23, 2, 0.004),
          new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.6 })
        );
        bookCover.position.set(0, 0.525, 0);
        bookCover.rotation.y = 0.32;

        tableGroup.add(topDisk, baseCone, brassStem, bookCover);
        stagingGroup.add(tableGroup);
      }

      // Enable Shadows on All Meshes
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

      const totalWidth = seatW + 0.16;
      const chairOnlyDepth = 0.84;
      const totalHeight = 0.34 + backH * 0.92;

      return {
        propGroup,
        stagingGroup,
        dimensions: {
          width: totalWidth,
          depth: cfg.ottoman ? 1.38 : chairOnlyDepth,
          chairDepth: chairOnlyDepth,
          height: totalHeight
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

export function createAtelierChair(config={}){
 const cfg={archetype:'molded',component:'chair',seatWidth:.64,backHeight:.56,reclineDeg:16,puffScale:1,textile:'leather',fabricColor:'#8b4324',accentColor:'#262c30',woodColor:'#422312',metalColor:'#d4af37',tufting:true,piping:true,pillow:true,...config,staging:false,wireframe:false};
 if(!['molded','timber','cantilever'].includes(cfg.archetype)||!['chair','ottoman','set'].includes(cfg.component)||cfg.seatWidth<.56||cfg.seatWidth>.86||cfg.backHeight<.42||cfg.backHeight>.68||cfg.reclineDeg<6||cfg.reclineDeg>24)throw Error('Unsupported Atelier chair configuration');
 cfg.ottoman=cfg.component!=='chair';
 let {propGroup}=buildChairScene(cfg);
 if(cfg.component==='ottoman'){const part=propGroup.getObjectByName('MatchingOttomanProp');propGroup.remove(part);propGroup=new THREE.Group();part.position.z=0;propGroup.add(part);}
 const materials=new Set();propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(m.bumpScale>.003?.45:.25);m.bumpMap=null;}m.userData.roomPaletteLocked=true;}
 propGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(propGroup),center=bounds.getCenter(new THREE.Vector3());propGroup.position.set(-center.x,-bounds.min.y,-center.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier '+cfg.archetype+' '+cfg.component+' '+(cfg.family||cfg.textile);
 propGroup.userData={atelierChair:true,archetype:cfg.archetype,component:cfg.component,textile:cfg.textile,family:cfg.family,front:'+Z',generator:'Owner-supplied Atelier 3D'};
 return propGroup;
}
