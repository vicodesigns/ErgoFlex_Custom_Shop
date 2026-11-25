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

// Hard limits of each joint (Vico, 22 Nov 2026: slide 254 mm, swing +-180 degrees; 25 Nov 2026, his real unit: the arm from about 25 deg
// down to about 45 deg (-30 from the rest of rig v2, whose arm rests 14.6 deg down), up to +12.9: the platform levelled 3 mm under the
// desktop, the arm then about 1.6 deg down (fully flat, +14.6, is his photos' everyday pose and would leave 0.8 mm); the arc slot +-30).
export const JOINT_LIMITS = Object.freeze({ slide: [0, 1], swing: [-180, 180], baseTilt: [-30, 12.9], tilt: [-30, 30] });
// The two tilt pivots on the CAD's parts (the track's frame: u across, y up from the track top = the desktop underside, w along the track
// toward the user; mm): the rear bracket's upper bolt (the arm turns on it) and the arm's front bolt (the forks' pin: the platform turns on
// it, the knob below it runs in the arc slot). tray-rig.mjs makes runtime pivots there; the glb is not changed.
export const BASE_TILT_AT = Object.freeze([-10, -23.85, 46.86]);      // rig v2 (tools/props/tray-rig-v2.mjs REAR_BOLT_V2: the bolt 38.1 mm forward)
export const SURFACE_TILT_AT = Object.freeze([-10, -42.7, 119.45]);    // rig v2 (FRONT_BOLT: the forks' pin 27 mm higher)
// The base tilt may not raise the plate while it is under the desk: its top is 19.7 mm under the desktop at rest, +12.9 deg is the most (the plate 3 mm under it, rig v2's 75 mm arm turning on its rear bolt and the platform levelled on its front bolt)
// out front; the limit closes to 0 as the plate goes under (the same ramps as the rider limit, UNDER_RAMPS).
export const BASE_TILT_UNDER_MAX = 0;
export const SLIDE_TRAVEL_MM = 234.5;          // the CAD's travel along the track axis, measured on the rig (tests/tray-rig-asset-test.mjs): carriage rear
                                               // to track rear end. The product says 254 mm (10 in); 239.5 mm is the same arithmetic on the z extents of
                                               // the skewed boxes, which is not along the track, and would push the carriage 5 mm through the rear stop.
export const PLATE_BELOW_TRACK_MM = 19.7;      // the plate top is this far under the track top (= the desktop underside), measured in the glb
export const RIDER_CLEARANCE_MM = 3;           // air kept between a rider and the desktop

// Coupling 1: what the slide allows (starting values, spec 6.2; the probe replaces them).
// Linear between rows. swing = largest |swing|; tilt = [lowest, highest] of the PLATFORM's own angle (baseTilt + tilt).
export const SLIDE_COUPLING = Object.freeze([
    { slide: 0,    swing: 180, tilt: [-15, 15] },
    { slide: 0.4,  swing: 180, tilt: [-15, 15] },
    { slide: 0.85, swing: 0,   tilt: [-2, 0] },     // pushed in: level, no swing
    { slide: 1,    swing: 0,   tilt: [-2, 0] },
]);
// Coupling 2: the swing carries the plate under the desk, where it cannot tilt up into the desktop.
export const SWING_TILT = Object.freeze([
    { swing: 0,   tilt: [-15, 15] },
    { swing: 20,  tilt: [-15, 15] },
    { swing: 60,  tilt: [-2, 0] },
    { swing: 180, tilt: [-2, 0] },
]);
// How far the plate is under the desk, 0..1: the larger of the two ramps. (The probe measures the real thing; this is a
// pose-only stand-in with the authored pose = 0 by construction, so keys at rest never lower the tray.)
export const UNDER_RAMPS = Object.freeze({ slide: [0.45, 0.75], swing: [20, 60] });

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
