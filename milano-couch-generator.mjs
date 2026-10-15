// Adapted from the owner's supplied Atelier 3D couch generator (2026-10-14).
// Geometry is in metres, Y up, with the seating front toward +Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x4d494c41;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Heavy Bouclé / Woven Fabric Bump Map
      const boucleCanvas = document.createElement('canvas');
      boucleCanvas.width = 256;
      boucleCanvas.height = 256;
      const bCtx = boucleCanvas.getContext('2d');
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, 256, 256);

      for (let y = 0; y < 256; y += 3) {
        for (let x = 0; x < 256; x += 3) {
          const n = Math.sin(x * 0.45) * Math.cos(y * 0.45) * 28 + (random() * 55 - 27);
          const v = Math.max(20, Math.min(235, Math.floor(128 + n)));
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.beginPath();
          bCtx.arc(x + (y % 2), y, 1.7, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
      const boucleTex = new THREE.CanvasTexture(boucleCanvas);
      boucleTex.wrapS = boucleTex.wrapT = THREE.RepeatWrapping;
      boucleTex.repeat.set(14, 14);

      // 2. Full-Grain Italian Leather Pebble Map
      const leatherCanvas = document.createElement('canvas');
      leatherCanvas.width = 256;
      leatherCanvas.height = 256;
      const lCtx = leatherCanvas.getContext('2d');
      lCtx.fillStyle = '#787878';
      lCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4200; i++) {
        const x = random() * 256;
        const y = random() * 256;
        const r = 1.2 + random() * 2.2;
        const shade = 135 + Math.floor(random() * 65);
        lCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
        lCtx.beginPath();
        lCtx.arc(x, y, r, 0, Math.PI * 2);
        lCtx.fill();
      }
      const leatherTex = new THREE.CanvasTexture(leatherCanvas);
      leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
      leatherTex.repeat.set(10, 10);

      // 3. American Walnut Wood Grain Texture
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x++) {
          const wave = Math.sin(y * 0.16 + Math.sin(x * 0.025) * 4.0) * 18;
          const fine = (random() - 0.5) * 10;
          const v = Math.max(60, Math.min(210, Math.floor(135 + wave + fine)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(2, 1);

      // 4. Nordic Architectural Area Rug Weave
      const rugCanvas = document.createElement('canvas');
      rugCanvas.width = 512;
      rugCanvas.height = 512;
      const rCtx = rugCanvas.getContext('2d');
      rCtx.fillStyle = '#25272c';
      rCtx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 4) {
        for (let x = 0; x < 512; x += 6) {
          const tone = 34 + Math.floor(random() * 18);
          rCtx.fillStyle = `rgb(${tone},${tone + 1},${tone + 3})`;
          rCtx.fillRect(x, y, 4, 2);
        }
      }
      // Subtle geometric border line on rug
      rCtx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
      rCtx.lineWidth = 6;
      rCtx.strokeRect(28, 28, 456, 456);
      const rugTex = new THREE.CanvasTexture(rugCanvas);

      return { boucleTex, leatherTex, woodTex, rugTex };
    }

    const textures = createProceduralTextures();

    // --- Organic Cushion & Tailoring Geometry Builders ---

    /**
     * Builds a high-resolution cushion with natural down-feather crown,
     * pinched corner seams, and optional center tuft indentation.
     */
    function createOrganicCushionGeometry(width, height, depth, radius, puffAmount = 0.028, addCenterCrease = true) {
      const geom = new RoundedBoxGeometry(width, height, depth, 4, radius);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();

      const halfW = width * 0.5;
      const halfH = height * 0.5;
      const halfD = depth * 0.5;

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        const nx = THREE.MathUtils.clamp(v.x / halfW, -1, 1);
        const ny = THREE.MathUtils.clamp(v.y / halfH, -1, 1);
        const nz = THREE.MathUtils.clamp(v.z / halfD, -1, 1);

        // Cosine crown across top/bottom and front/back faces
        const domeXZ = Math.cos(nx * Math.PI * 0.46) * Math.cos(nz * Math.PI * 0.46);
        const domeXY = Math.cos(nx * Math.PI * 0.46) * Math.cos(ny * Math.PI * 0.46);
        const domeZY = Math.cos(nz * Math.PI * 0.46) * Math.cos(ny * Math.PI * 0.46);

        // Apply vertical loft
        if (Math.abs(ny) > 0.2) {
          v.y += Math.sign(ny) * domeXZ * puffAmount;
        }

        // Apply subtle outward belly on front/back & left/right faces
        v.z += Math.sign(nz) * domeXY * (puffAmount * 0.48);
        v.x += Math.sign(nx) * domeZY * (puffAmount * 0.35);

        // Subtle tailored seam pinch near the 4 corners
        const cornerDist = Math.abs(nx) * Math.abs(nz);
        if (cornerDist > 0.65) {
          const pinch = (cornerDist - 0.65) * 0.018;
          v.y *= (1 - pinch);
        }

        // Optional designer dimple/stitch crease along the center line
        if (addCenterCrease && ny > 0.35) {
          const creaseFactor = Math.exp(-Math.pow(nx * 4.5, 2)) * Math.exp(-Math.pow(nz * 2.2, 2));
          v.y -= creaseFactor * (puffAmount * 0.36);
        }

        pos.setXYZ(i, v.x, v.y, v.z);
      }

      geom.computeVertexNormals();
      return geom;
    }

    /**
     * Builds a 3D welt cord piping loop around a rectangular cushion perimeter
     */
    function createWeltPipingLoop(width, depth, yOffset, cornerRadius = 0.04, tubeRadius = 0.0045) {
      const hw = width * 0.5 - 0.012;
      const hd = depth * 0.5 - 0.012;
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
     * Creates a plush tapered designer throw pillow with gravity slump and pinched ears
     */
    function createThrowPillowGeometry(size = 0.40, thickness = 0.13) {
      const geom = new THREE.BoxGeometry(size, size, thickness, 8, 8, 4);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();
      const half = size * 0.5;
      const halfT = thickness * 0.5;

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const nx = v.x / half;
        const ny = v.y / half;
        const nz = v.z / halfT;

        // Pillow dome profile (tapers to knife-edge seam at perimeter)
        const edgeProfile = Math.cos(nx * Math.PI * 0.5) * Math.cos(ny * Math.PI * 0.5);
        v.z = nz * halfT * (0.18 + 0.95 * edgeProfile);

        // Subtle gravity droop in the lower half & karate-chop top indentation
        const chopIndent = ny > 0.25 ? Math.exp(-Math.pow(nx * 3.2, 2)) * (ny - 0.25) * 0.035 : 0;
        v.y -= chopIndent;
        v.z -= Math.pow(nx, 2) * 0.018; // Slight wrap curvature

        pos.setXYZ(i, v.x, v.y, v.z);
      }

      geom.computeVertexNormals();
      return geom;
    }

    /**
     * Master Procedural High-End Couch Generator
     * Returns { couchGroup, stagingGroup, dimensions }
     */
    function buildCouchScene(cfg) {
      const couchGroup = new THREE.Group();
      couchGroup.name = 'HighEndDesignerCouch';

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const seatCount = cfg.seatCount;
      const seatWidth = cfg.seatWidth;
      const depth = cfg.depth;
      const armWidth = 0.19;
      const innerWidth = seatCount * seatWidth;
      const totalWidth = innerWidth + armWidth * 2;
      const legHeight = 0.145;
      const plinthHeight = 0.055;
      const baseElevation = legHeight + plinthHeight;
      const chaiseExtraDepth = cfg.chaise !== 'none' ? 0.62 : 0;

      // --- Configure PBR Materials ---
      const baseColor = new THREE.Color(cfg.fabricColor);
      const sheenTint = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.32);

      let fabricMat;
      if (cfg.textile === 'leather') {
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.36,
          metalness: 0.02,
          clearcoat: 0.22,
          clearcoatRoughness: 0.42,
          sheen: 0.25,
          sheenColor: sheenTint,
          bumpMap: textures.leatherTex,
          bumpScale: 0.0022,
          wireframe: cfg.wireframe
        });
      } else if (cfg.textile === 'velvet') {
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.62,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.25,
          sheenColor: sheenTint,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0012,
          wireframe: cfg.wireframe
        });
      } else {
        // Heavy Bouclé Weave
        fabricMat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.82,
          metalness: 0.0,
          sheen: 0.95,
          sheenRoughness: 0.45,
          sheenColor: sheenTint,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0038,
          wireframe: cfg.wireframe
        });
      }

      // Contrast Piping Material (slightly richer/darker shade or leather trim)
      const pipingMat = new THREE.MeshPhysicalMaterial({
        color: baseColor.clone().multiplyScalar(0.78),
        roughness: 0.48,
        sheen: 0.6,
        wireframe: cfg.wireframe
      });

      // Primary Accent Pillow Material
      const accentColor = new THREE.Color(cfg.accentColor);
      const accentMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        roughness: 0.52,
        sheen: 0.85,
        sheenRoughness: 0.32,
        sheenColor: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.35),
        bumpMap: textures.leatherTex,
        bumpScale: 0.0018,
        wireframe: cfg.wireframe
      });

      // Secondary Complementary Lumbar Pillow Material
      const secondaryAccentMat = new THREE.MeshPhysicalMaterial({
        color: baseColor.clone().lerp(new THREE.Color(0xe8e2d5), 0.45),
        roughness: 0.75,
        sheen: 0.9,
        bumpMap: textures.boucleTex,
        bumpScale: 0.0025,
        wireframe: cfg.wireframe
      });

      // Architectural Walnut Wood Plinth Material
      const walnutMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.woodColor),
        roughness: 0.34,
        metalness: 0.04,
        clearcoat: 0.32,
        clearcoatRoughness: 0.28,
        bumpMap: textures.woodTex,
        bumpScale: 0.0018,
        wireframe: cfg.wireframe
      });

      // Brushed Champagne Brass Hardware Material
      const brassMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.metalColor),
        roughness: 0.22,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      // --- 1. Architectural Walnut Plinth Base ---
      const mainPlinthGeom = new RoundedBoxGeometry(totalWidth + 0.02, plinthHeight, depth, 4, 0.012);
      const mainPlinth = new THREE.Mesh(mainPlinthGeom, walnutMat);
      mainPlinth.position.set(0, legHeight + plinthHeight * 0.5, 0);
      couchGroup.add(mainPlinth);

      // Subtle brass inlay reveal strip along the front of the walnut plinth
      const brassRevealGeom = new THREE.BoxGeometry(totalWidth - 0.02, 0.006, 0.008);
      const brassReveal = new THREE.Mesh(brassRevealGeom, brassMat);
      brassReveal.position.set(0, legHeight + plinthHeight * 0.5, depth * 0.5 + 0.008);
      couchGroup.add(brassReveal);

      // If Chaise Lounge is active, extend the walnut plinth under the chaise module
      const startX = -innerWidth * 0.5 + seatWidth * 0.5;
      const chaiseIndex = cfg.chaise === 'left' ? 0 : (cfg.chaise === 'right' ? seatCount - 1 : -1);
      const chaiseCenterX = chaiseIndex >= 0 ? startX + chaiseIndex * seatWidth : 0;

      if (cfg.chaise !== 'none') {
        const chaisePlinthWidth = seatWidth + armWidth;
        const chaisePlinthOffsetX = chaiseCenterX + (cfg.chaise === 'left' ? -armWidth * 0.5 : armWidth * 0.5);
        const chaisePlinthGeom = new RoundedBoxGeometry(chaisePlinthWidth, plinthHeight, chaiseExtraDepth + 0.08, 4, 0.012);
        const chaisePlinth = new THREE.Mesh(chaisePlinthGeom, walnutMat);
        chaisePlinth.position.set(
          chaisePlinthOffsetX,
          legHeight + plinthHeight * 0.5,
          depth * 0.5 + chaiseExtraDepth * 0.5 - 0.02
        );
        couchGroup.add(chaisePlinth);
      }

      // --- 2. Tapered Brass Stiletto Legs & Floor Glides ---
      const legGeom = new THREE.CylinderGeometry(0.023, 0.011, legHeight, 24);
      const collarGeom = new THREE.CylinderGeometry(0.028, 0.025, 0.018, 24);
      const glideGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 20);

      const legInsetX = totalWidth * 0.5 - 0.12;
      const legInsetZ = depth * 0.5 - 0.10;

      const legCoords = [
        [-legInsetX, -legInsetZ],
        [legInsetX, -legInsetZ],
        [-legInsetX, legInsetZ],
        [legInsetX, legInsetZ]
      ];
      if (seatCount >= 3) {
        legCoords.push([0, -legInsetZ], [0, legInsetZ]);
      }
      if (cfg.chaise !== 'none') {
        const cSide = cfg.chaise === 'left' ? -1 : 1;
        const outerX = cSide * legInsetX;
        const innerX = chaiseCenterX - cSide * (seatWidth * 0.5 - 0.08);
        const frontChaiseZ = depth * 0.5 + chaiseExtraDepth - 0.10;
        legCoords.push([outerX, frontChaiseZ], [innerX, frontChaiseZ]);
      }

      legCoords.forEach(([lx, lz]) => {
        const legAssembly = new THREE.Group();
        legAssembly.position.set(lx, legHeight * 0.5, lz);
        if (Math.abs(lx) > 0.2) legAssembly.rotation.z = Math.sign(lx) * -0.055;
        legAssembly.rotation.x = Math.sign(lz) * 0.035;

        const legMesh = new THREE.Mesh(legGeom, brassMat);
        const collarMesh = new THREE.Mesh(collarGeom, brassMat);
        collarMesh.position.y = legHeight * 0.5 - 0.01;
        const glideMesh = new THREE.Mesh(glideGeom, brassMat);
        glideMesh.position.y = -legHeight * 0.5 + 0.003;

        legAssembly.add(legMesh, collarMesh, glideMesh);
        couchGroup.add(legAssembly);
      });

      // --- 3. Upholstered Deck & Raked Backrest Spine ---
      const deckHeight = 0.075;
      const backFrameDepth = 0.15;
      const backFrameHeight = 0.49;

      const deckGeom = new RoundedBoxGeometry(innerWidth, deckHeight, depth - 0.04, 4, 0.02);
      const deckMesh = new THREE.Mesh(deckGeom, fabricMat);
      deckMesh.position.set(0, baseElevation + deckHeight * 0.5, 0.01);
      couchGroup.add(deckMesh);

      const backFrameGeom = createOrganicCushionGeometry(
        totalWidth - 0.03,
        backFrameHeight,
        backFrameDepth,
        0.045,
        0.012 * cfg.puffScale,
        false
      );
      const backFrameMesh = new THREE.Mesh(backFrameGeom, fabricMat);
      backFrameMesh.position.set(
        0,
        baseElevation + backFrameHeight * 0.5,
        -depth * 0.5 + backFrameDepth * 0.5 + 0.01
      );
      backFrameMesh.rotation.x = -0.055; // Subtle ergonomic architectural rake
      couchGroup.add(backFrameMesh);

      // --- 4. Wide Track Armrests + Exterior Walnut Inlay Panels + Inner Bolsters ---
      const armHeight = 0.43;
      const armGeom = createOrganicCushionGeometry(
        armWidth,
        armHeight,
        depth - 0.01,
        0.045,
        0.014 * cfg.puffScale,
        false
      );
      const bolsterGeom = new THREE.CylinderGeometry(0.064, 0.064, depth - 0.25, 28);
      bolsterGeom.rotateX(Math.PI * 0.5);

      [-1, 1].forEach((side) => {
        const armX = side * (innerWidth * 0.5 + armWidth * 0.5);
        const armMesh = new THREE.Mesh(armGeom, fabricMat);
        armMesh.position.set(armX, baseElevation + armHeight * 0.5, 0);
        couchGroup.add(armMesh);

        // Top welt piping on armrest
        if (cfg.piping) {
          const armPipe = new THREE.Mesh(
            createWeltPipingLoop(armWidth, depth - 0.015, armHeight * 0.5 - 0.01, 0.035, 0.004),
            pipingMat
          );
          armMesh.add(armPipe);
        }

        // Architectural walnut wrap-around inlay panel on outer side of armrest
        const inlayGeom = new RoundedBoxGeometry(0.014, armHeight * 0.58, depth * 0.74, 3, 0.005);
        const inlayMesh = new THREE.Mesh(inlayGeom, walnutMat);
        inlayMesh.position.set(
          armX + side * (armWidth * 0.5 + 0.002),
          baseElevation + armHeight * 0.42,
          0
        );
        couchGroup.add(inlayMesh);

        // Cylindrical inner arm bolster pillow
        if (cfg.tufting) {
          const bolsterMesh = new THREE.Mesh(bolsterGeom, fabricMat);
          bolsterMesh.position.set(
            side * (innerWidth * 0.5 - 0.058),
            baseElevation + deckHeight + 0.175,
            0.055
          );
          couchGroup.add(bolsterMesh);
        }
      });

      // --- 5. Plush Seat Cushions & Reclined Backrest Cushions ---
      const seatCushionHeight = 0.15;
      const baseSeatDepth = depth - backFrameDepth - 0.02;
      const backCushionHeight = 0.41;
      const backCushionDepth = 0.18;

      const standardSeatGeom = createOrganicCushionGeometry(
        seatWidth - 0.008,
        seatCushionHeight,
        baseSeatDepth,
        0.044,
        0.028 * cfg.puffScale,
        cfg.tufting
      );

      const backCushionGeom = createOrganicCushionGeometry(
        seatWidth - 0.012,
        backCushionHeight,
        backCushionDepth,
        0.055,
        0.032 * cfg.puffScale,
        cfg.tufting
      );

      const seatTopY = baseElevation + deckHeight + seatCushionHeight;

      for (let i = 0; i < seatCount; i++) {
        const cx = startX + i * seatWidth;
        const isChaiseSeat = (i === chaiseIndex);

        if (isChaiseSeat) {
          // Extended Chaise Lounge Cushion + Lower Deck
          const chaiseSeatDepth = baseSeatDepth + chaiseExtraDepth;
          const chaiseDeckGeom = new RoundedBoxGeometry(seatWidth, deckHeight, chaiseExtraDepth + 0.04, 4, 0.02);
          const chaiseDeck = new THREE.Mesh(chaiseDeckGeom, fabricMat);
          chaiseDeck.position.set(
            cx,
            baseElevation + deckHeight * 0.5,
            depth * 0.5 + chaiseExtraDepth * 0.5 - 0.01
          );
          couchGroup.add(chaiseDeck);

          const chaiseCushionGeom = createOrganicCushionGeometry(
            seatWidth - 0.008,
            seatCushionHeight,
            chaiseSeatDepth,
            0.044,
            0.028 * cfg.puffScale,
            cfg.tufting
          );
          const chaiseCushion = new THREE.Mesh(chaiseCushionGeom, fabricMat);
          chaiseCushion.position.set(
            cx,
            baseElevation + deckHeight + seatCushionHeight * 0.5,
            backFrameDepth * 0.5 + 0.01 + chaiseExtraDepth * 0.5
          );
          couchGroup.add(chaiseCushion);

          if (cfg.piping) {
            const topPipe = new THREE.Mesh(
              createWeltPipingLoop(seatWidth - 0.012, chaiseSeatDepth - 0.01, seatCushionHeight * 0.5 - 0.012, 0.04, 0.0045),
              pipingMat
            );
            const botPipe = new THREE.Mesh(
              createWeltPipingLoop(seatWidth - 0.012, chaiseSeatDepth - 0.01, -seatCushionHeight * 0.5 + 0.012, 0.04, 0.0045),
              pipingMat
            );
            chaiseCushion.add(topPipe, botPipe);
          }
        } else {
          // Standard Seat Cushion
          const seatCushion = new THREE.Mesh(standardSeatGeom, fabricMat);
          seatCushion.position.set(
            cx,
            baseElevation + deckHeight + seatCushionHeight * 0.5,
            backFrameDepth * 0.5 + 0.01
          );
          couchGroup.add(seatCushion);

          if (cfg.piping) {
            const topPipe = new THREE.Mesh(
              createWeltPipingLoop(seatWidth - 0.012, baseSeatDepth - 0.01, seatCushionHeight * 0.5 - 0.012, 0.04, 0.0045),
              pipingMat
            );
            const botPipe = new THREE.Mesh(
              createWeltPipingLoop(seatWidth - 0.012, baseSeatDepth - 0.01, -seatCushionHeight * 0.5 + 0.012, 0.04, 0.0045),
              pipingMat
            );
            seatCushion.add(topPipe, botPipe);
          }
        }

        // Reclined Backrest Cushion
        const backCushion = new THREE.Mesh(backCushionGeom, fabricMat);
        backCushion.position.set(
          cx,
          seatTopY + backCushionHeight * 0.45 - 0.018,
          -depth * 0.5 + backFrameDepth + backCushionDepth * 0.42
        );
        backCushion.rotation.x = -0.185; // Ergonomic lounge recline
        couchGroup.add(backCushion);
      }

      // --- 6. Layered Asymmetric Throw Pillows ---
      if (cfg.pillows) {
        const largePillowGeom = createThrowPillowGeometry(0.41, 0.135);
        const smallPillowGeom = createThrowPillowGeometry(0.34, 0.115);

        [-1, 1].forEach((side) => {
          // Outer Large Accent Pillow
          const pLarge = new THREE.Mesh(largePillowGeom, accentMat);
          pLarge.position.set(
            side * (innerWidth * 0.5 - 0.19),
            seatTopY + 0.165,
            -depth * 0.5 + backFrameDepth + 0.23
          );
          pLarge.rotation.set(-0.24, side * -0.46, side * 0.15);
          couchGroup.add(pLarge);

          // Inner Layered Complementary Pillow
          const pSmall = new THREE.Mesh(smallPillowGeom, secondaryAccentMat);
          pSmall.position.set(
            side * (innerWidth * 0.5 - 0.31),
            seatTopY + 0.135,
            -depth * 0.5 + backFrameDepth + 0.29
          );
          pSmall.rotation.set(-0.32, side * -0.25, side * 0.09);
          couchGroup.add(pSmall);
        });
      }

      // --- 7. Optional Studio Staging Context (Woven Rug & Marble Side Table) ---
      if (cfg.staging) {
        // Woven Architectural Area Rug
        const rugWidth = totalWidth + 1.35;
        const rugDepth = depth + chaiseExtraDepth + 1.45;
        const rugGeom = new RoundedBoxGeometry(rugWidth, 0.012, rugDepth, 2, 0.005);
        const rugMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: textures.rugTex,
          bumpMap: textures.rugTex,
          bumpScale: 0.004,
          roughness: 0.92
        });
        const rugMesh = new THREE.Mesh(rugGeom, rugMat);
        rugMesh.position.set(0, 0.006, chaiseExtraDepth * 0.35 + 0.22);
        stagingGroup.add(rugMesh);

        // Minimalist Travertine & Brass Side Table next to the sofa
        const tableGroup = new THREE.Group();
        const tableSide = cfg.chaise === 'right' ? -1 : 1;
        tableGroup.position.set(tableSide * (totalWidth * 0.5 + 0.36), 0, 0.12);

        const travertineMat = new THREE.MeshPhysicalMaterial({
          color: 0xdcd3c2,
          roughness: 0.38,
          clearcoat: 0.15,
          bumpMap: textures.leatherTex,
          bumpScale: 0.001
        });

        const topDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.032, 36), travertineMat);
        topDisk.position.y = 0.49;
        const basePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.28, 32), travertineMat);
        basePedestal.position.y = 0.14;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 20), brassMat);
        stem.position.y = 0.38;

        tableGroup.add(topDisk, basePedestal, stem);
        stagingGroup.add(tableGroup);
      }

      // Enable shadows across all generated meshes
      const enableShadows = (grp) => {
        grp.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };
      enableShadows(couchGroup);
      enableShadows(stagingGroup);

      const finalDepth = depth + chaiseExtraDepth;
      const finalHeight = 0.78;

      return {
        couchGroup,
        stagingGroup,
        dimensions: { width: totalWidth, depth: finalDepth, height: finalHeight }
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
export function createMilanoCouch(config={}){
 const cfg={seatCount:3,seatWidth:.65,depth:.82,chaise:'none',puffScale:1,textile:'boucle',fabricColor:'#2b3438',accentColor:'#c2744b',woodColor:'#3d2415',metalColor:'#d4af37',piping:true,tufting:true,pillows:true,wireframe:false,...config,staging:false};
 if(![2,3].includes(cfg.seatCount)||cfg.seatWidth<.55||cfg.seatWidth>.85||cfg.depth<.68||cfg.depth>1.2)throw Error('Unsupported Milano sofa dimensions');
 const {couchGroup}=buildCouchScene(cfg),materials=new Set();
 couchGroup.traverse(o=>{if(o.isMesh){for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){
  m.name=m===couchGroup.children[0].material?'Milano walnut plinth':m.metalness>.8?'Milano brushed hardware':m.sheen>.5?'Milano tailored upholstery':'Milano contrast piping';
  if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(m.bumpScale>.003?.45:.25);m.bumpMap=null;}
  m.userData.roomPaletteLocked=true;
 }
 couchGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(couchGroup),center=bounds.getCenter(new THREE.Vector3());
 couchGroup.position.set(-center.x,-bounds.min.y,-center.z);couchGroup.updateMatrixWorld(true);
 couchGroup.name='Milano '+cfg.seatCount+'-seat '+(cfg.family||cfg.textile);
 couchGroup.userData={milano:true,seatCount:cfg.seatCount,textile:cfg.textile,family:cfg.family||'original',front:'+Z',generator:'Owner-supplied Atelier 3D'};
 return couchGroup;
}
