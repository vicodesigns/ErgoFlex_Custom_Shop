// Keyboard tray: the joint limits and the coupling between joints, as DATA (docs/keyboard-tray/SPEC.md, 0.1 and 2.3, 6.2).
// Pure: no three.js, no DOM. tray-pose.mjs reads these; the clearance probe (tools/experience/tray-clearance.cjs, phase 6)
// will regenerate the tables below from the real desk geometry, so keep them tables and keep the shape.
//
// Pose = { slide, swing, baseTilt, tilt }
//   slide     0..1       0 = as authored (the tray out in front), 1 = pushed all the way in under the desk
//   swing     degrees    about the vertical pivot at the track's end; + = the plate's front moves to the user's right
//   baseTilt  degrees    "Base tilt": the arm about the rear bracket's upper bolt (BASE_TILT_AT); + = the arm's front up
//   tilt      degrees    "Surface tilt": the platform about the arm's front bolt (SURFACE_TILT_AT); + = front edge up. The platform's
//                        own angle is baseTilt + tilt; "Level the platform" sets tilt = -baseTilt.
// All at 0 is the glb exactly as authored (today's rigid tray).
// (Until 25 Nov 2026 there was a fourth joint, `drop`, and an optional added "mount bracket". Vico: "That drop option, the mount
// bracket, is not even a real thing on the product." Both are gone; an old trayEdits with a `drop` or `bracket: true` still loads, and
// they are ignored: SPEC.md 0.3.)

// Hard limits of each joint. Since rig v3 (26 Nov 2026, SPEC.md 0.6) they are the ranges VICO MODELLED in his own model of his real tray
// (docs/reference/keyboard-tray-real-20261125/vico-model): the slide from pulled out (his P0) to pulled in (P2, 140.1 mm back), the arm from
// level (P0, the most: the platform 12.5 mm under the desktop) to 33.2 deg down (P2/P5/P6), the platform on its front bolt from 59.4 deg
// down (P3) to 33.6 deg up (P5: levelled with the arm down; his "about 90 deg"). Swing is not in his model: +-180 as before.
// (Rig v2: slide 234.5 mm, base -30..+12.9, surface -30..+30.)
export const JOINT_LIMITS = Object.freeze({ slide: [0, 1], swing: [-180, 180], baseTilt: [-33.2, 0], tilt: [-59.4, 33.6] });
// The two tilt pivots (the track's frame: u across, y up from the top plate's top = the desktop underside, w along the track toward the
// user; mm), the bolts of Vico's model: the rear bracket's upper bolt (the arm turns on it) and the arm's upper front bolt (the front
// plates and the platform turn on it; the lock knob's bolt runs in the arc slot round it). Rig v3 has them as nodes in the glb.
export const BASE_TILT_AT = Object.freeze([-9.65, -46.58, 24.29]);    // tools/props/tray-rig-v3.mjs PIVOTS.Tray_BaseTilt
export const SURFACE_TILT_AT = Object.freeze([-9.65, -47.5, 133.06]);  // tools/props/tray-rig-v3.mjs PIVOTS.Tray_SurfaceTilt
export const SWING_AT = Object.freeze([-9.55, -7.23, -6.8]);           // the rear bracket's top centre (the real unit's swivel disc; NOT in his model: an extra joint of ours)
// His top plate's top under the desktop underside (rig v3): his model is placed so that the platform at rest is exactly where the supplied
// tray's plate is (Vico: the tray starts where it is today), and his platform sits 12.47 mm under his plate, the supplied one 19.70 under the
// desktop. The gap is shown, not hidden (no geometry added).
export const MOUNT_GAP_MM = 7.23;
// The base tilt's top is the arm level (0): the platform is then 19.7 mm under the desktop (as the supplied tray's plate), so the arm can never lift it into the desktop
// and the limit no longer closes under the desk (it did for rig v2: +12.9 out front .. 0 under).
export const BASE_TILT_UNDER_MAX = 0;
export const SLIDE_TRAVEL_MM = 140.1;          // Vico's model: the rear bracket 140.06 mm back along the top plate from pulled out (P0) to pulled
                                               // in (P2). His top plate would let it go about 300 mm; the product says 254 mm (10 in). Rig v2: 234.5.
export const PLATE_BELOW_TRACK_MM = 19.7;      // the platform top under the desktop underside at rest, the arm level (as the supplied tray: rig v3 is aligned on it)
export const RIDER_CLEARANCE_MM = 3;           // air kept between a rider and the desktop
// The levelled platform's depth under the desktop as the arm goes down: the arm's bolts 108.8 mm apart (rear upper -> front upper, along w
// and y). platformDepthMm(baseTilt) in tray-pose.mjs; a rider fits under the desk when its thickness + RIDER_CLEARANCE_MM is within it.
export const ARM_BOLTS = Object.freeze({ dw: 108.77, dy: -0.92 });

// Coupling 1: what the slide allows (starting values, spec 6.2; the probe replaces them).
// Linear between rows. swing = largest |swing|; tilt = [lowest, highest] of the PLATFORM's own angle (baseTilt + tilt).
export const SLIDE_COUPLING = Object.freeze([
    { slide: 0,    swing: 180, tilt: [-61.1, 7.8] },    // out front: the platform's own angle as far as Vico modelled it (P6 -61.1 .. P1 +7.8)
    { slide: 0.4,  swing: 180, tilt: [-61.1, 7.8] },
    { slide: 0.85, swing: 0,   tilt: [-2, 0] },     // pushed in: level, no swing
    { slide: 1,    swing: 0,   tilt: [-2, 0] },
]);
// Coupling 2: the swing carries the plate under the desk, where it cannot tilt up into the desktop.
export const SWING_TILT = Object.freeze([
    { swing: 0,   tilt: [-61.1, 7.8] },
    { swing: 20,  tilt: [-61.1, 7.8] },
    { swing: 60,  tilt: [-2, 0] },
    { swing: 180, tilt: [-2, 0] },
]);
// How far the plate is under the desk, 0..1: the larger of the two ramps. (The probe measures the real thing; this is a
// pose-only stand-in with the authored pose = 0 by construction, so keys at rest never lower the tray.)
export const UNDER_RAMPS = Object.freeze({ slide: [0.75, 1], swing: [20, 60] });   // slide 0.75 = 105 mm (rig v2: 0.45 of 234.5, the same 105 mm)

// Thickness of what rides on the plate, mm (assets/props/index.json, the height of each model). A tray with no rider is 0.
export const RIDER_MM = Object.freeze({
    'apple-keyboard': 30.3, 'office-keyboard': 13.4, 'razer-keyboard': 42.2, 'rgb-keyboard': 37.9,
    'ergoflex-ergo-keyboard': 45, 'ergoflex-mechanical-keyboard': 41.7, 'kenney-furniture-computer-keyboard': 42.96,
    'magic-mouse': 22.2, 'gaming-mouse': 56.9, 'ergoflex-mx-master-mouse': 47.2, 'ergoflex-mouse-2': 49.3,
    'kenney-furniture-computer-mouse': 31.85,
});
export const RIDER_UNKNOWN_MM = 45;            // a rider this table does not know is taken as the thickest keyboard

// ---- The rig asset (assets/props/ergoflex-keyboard-tray-rig.glb, built by tools/props/supplied_model_repairs.py rig_keyboard_tray) ----
// glTF frame (Y up, +z toward the user), millimetres at rest pose, the same frame as the rigid ergoflex-keyboard-tray.glb. The file holds
// metres; the stage scales it by 1000 like every prop. tests/tray-rig-asset-test.mjs checks the glb against this table, so the Blender
// script's copy cannot drift.
export const TRAY_SKEW_DEG = 7.43;             // the CAD's turn about the vertical (measured on rod, link and track axes); carried by Tray_Slide only
// Pivot nodes, parent first. `at` = world position at rest. Joint use (node-local axes; every pivot below Tray_Slide has an identity local rotation):
//   Tray_Drop  the mount (no joint since the drop was taken out; the node stays in the glb)
//   Tray_Slide translate along +Z, the track axis, = world (-sin skew, 0, cos skew)   (slide * SLIDE_TRAVEL_MM, toward the back = negative Z)
//   Tray_Swing rotate about Y                (swing; + = the plate's front moves to the user's right = rotation about +Y by +swing in glTF)
//   Tray_Tilt  rotate about X, the rod axis  (tilt; + = front edge up = rotation about -X)
export const TRAY_PIVOTS = Object.freeze([
    { name: 'Tray',       parent: null,         at: [0, 0, 0] },
    { name: 'Tray_Drop',  parent: 'Tray',       at: [9.0, 0, -147.9] },       // the mount: the track's top centre (fixed)
    { name: 'Tray_Slide', parent: 'Tray_Drop',  at: [-5.9, -26.1, -33.8] },   // carriage centre
    { name: 'Tray_Swing', parent: 'Tray_Slide', at: [-14.2, -26.1, 29.7] },   // carriage front on the track's centre line: the track's end when out
    { name: 'Tray_Tilt',  parent: 'Tray_Swing', at: [-9.0, -80.7, 98.6] },    // mid-rod, under the plate's rear
]);
// The seven CAD parts, the original model split at the joints and nothing else (same vertices, triangles and material as the rigid glb),
// with the pivot each hangs from (mesh nodes; no joint of their own).
export const TRAY_PARTS = Object.freeze({
    Tray_Track: 'Tray_Drop', Tray_Carriage: 'Tray_Slide', Tray_Links: 'Tray_Swing',
    Tray_Forks: 'Tray_Tilt', Tray_Plate: 'Tray_Tilt', Tray_Crossbar: 'Tray_Tilt', Tray_Screw: 'Tray_Tilt',
});
export const V1_SLIDE_TRAVEL_MM = 234.5;       // rig v1/v2's travel (the supplied CAD's track), kept for their asset tests

// ---- Rig v3 (assets/props/ergoflex-keyboard-tray-rig-v3.glb, built by tools/props/tray-rig-v3.mjs from Vico's own model) -------------
// Root Tray > Tray_Mount (the 7.43 deg skew, so the existing saved yaws still square it up; the top plate hangs here, fixed) > Tray_Slide
// > Tray_Swing > Tray_BaseTilt > Tray_SurfaceTilt. Every pivot below the mount has an identity rotation: local X = the bolts' axis, Y up,
// Z the track. Mesh nodes have identity transforms (their vertices are stored relative to their pivot). His 18 parts and their pivots:
export const TRAY_V3_PARTS = Object.freeze({
    Tray_MountPlate: 'Tray_Mount',
    Tray_Bracket_L: 'Tray_Swing', Tray_Bracket_R: 'Tray_Swing', Tray_BracketWeb: 'Tray_Swing', Tray_BracketWebFace: 'Tray_Swing',
    Tray_Bolt_RearUpper: 'Tray_Swing', Tray_Bolt_RearLower: 'Tray_Swing',
    Tray_Arm_L: 'Tray_BaseTilt', Tray_Arm_R: 'Tray_BaseTilt', Tray_ArmWeb: 'Tray_BaseTilt', Tray_ArmWebFace: 'Tray_BaseTilt',
    Tray_Bolt_FrontUpper: 'Tray_BaseTilt', Tray_Bolt_FrontKnob: 'Tray_BaseTilt',
    Tray_Front_L: 'Tray_SurfaceTilt', Tray_Front_R: 'Tray_SurfaceTilt', Tray_FrontWeb: 'Tray_SurfaceTilt', Tray_FrontWebFace: 'Tray_SurfaceTilt',
    Tray_Plate: 'Tray_SurfaceTilt',
});
